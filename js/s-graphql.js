/* Неделя 3, пятница 10:00: GraphQL для главного экрана приложения (F-mobile).
   Подходы: водопад запросов на 3G → собрать запрос по схеме → N+1 и «злой запрос» → ошибки, мутации, кэш.
   Канон: _dev/DOMAIN.md §11. */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc;

  if (!document.getElementById('gql-style')) {
    document.head.insertAdjacentHTML('beforeend', `<style id="gql-style">
      .gql-wf { display: grid; gap: 5px; min-width: 0; }
      .gql-wf .r { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); gap: 8px; align-items: center; min-width: 0; }
      .gql-wf .lbl { font: 500 11.5px/1.3 var(--f-mono); color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
      .gql-wf .trk { position: relative; height: 16px; background: var(--surface-3); border-radius: 4px; overflow: hidden; }
      .gql-wf .bar { position: absolute; top: 2px; bottom: 2px; display: flex; border-radius: 3px; overflow: hidden; min-width: 2px; }
      .gql-wf .bar i { display: block; height: 100%; }
      .gql-wf .n { background: var(--warn); }
      .gql-wf .s { background: var(--violet); }
      .gql-wf .d { background: var(--info); }
      .gql-wf .axis { display: flex; justify-content: space-between; font: 500 10.5px/1 var(--f-mono); color: var(--text-muted); }
      .gql-legend { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: var(--text-2); }
      .gql-legend span::before { content: ''; display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 5px; vertical-align: -1px; background: var(--c); }
      .gql-phone { align-content: start; align-self: start; max-width: 300px; border: 2px solid var(--border-strong); border-radius: 22px; padding: 14px; background: var(--surface); display: grid; gap: 8px; font-size: 13px; }
      .gql-phone .pb { border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; background: var(--surface-2); display: grid; gap: 2px; }
      .gql-tree { font: 500 13px/1.35 var(--f-mono); display: grid; gap: 3px; min-width: 0; }
      .gql-tree .obj { color: var(--text-2); }
      .gql-tree .ty { color: var(--text-muted); font-size: 11.5px; }
      .gql-tree label { display: flex; gap: 8px; align-items: center; cursor: pointer; min-width: 0; flex-wrap: wrap; }
      .gql-tree label.ok { color: var(--ok); }
      .gql-tree label.bad { color: var(--bad); }
      .gql-tree input { accent-color: var(--accent); width: 15px; height: 15px; flex: none; }
      .gql-log { max-height: 340px; overflow: auto; }
      .gql-root { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
      .gql-root .stack > * { min-width: 0; }
    </style>`);
  }

  // ======================================================================
  // Подход 1. Водопад запросов на 3G
  // ======================================================================
  const NET = 400;   // мс — задержка одного похода по сети 3G туда-обратно
  const BW = 50;     // КБ/с — скорость скачивания на 3G
  const HDR = 0.4;   // КБ — заголовки запроса и ответа
  const R = (p, kb, srv, up) => ({ p, kb, srv: srv || 30, up: up || 0 });
  const WF = {
    rest: { t: 'REST, как сейчас', sub: 'запросы по очереди', waves: [
      [R('GET /me', 1.4)], [R('GET /me/memberships', 2.2)], [R('GET /membership-plans', 6.0)], [R('GET /me/bookings?status=upcoming&limit=3', 1.5)],
      [R('GET /classes/{id} · запись 1', 1.1)], [R('GET /trainers/{id} · тренер 1', 1.6)],
      [R('GET /classes/{id} · запись 2', 1.1)], [R('GET /trainers/{id} · тренер 2', 1.6)],
      [R('GET /classes/{id} · запись 3', 1.1)], [R('GET /trainers/{id} · тренер 3', 1.6)]] },
    par: { t: 'REST, параллельно', sub: 'независимые разом', waves: [
      [R('GET /me', 1.4), R('GET /me/memberships', 2.2), R('GET /membership-plans', 6.0), R('GET /me/bookings?status=upcoming&limit=3', 1.5)],
      [R('GET /classes/{id} · запись 1', 1.1), R('GET /classes/{id} · запись 2', 1.1), R('GET /classes/{id} · запись 3', 1.1)],
      [R('GET /trainers/{id} · тренер 1', 1.6), R('GET /trainers/{id} · тренер 2', 1.6), R('GET /trainers/{id} · тренер 3', 1.6)]] },
    incl: { t: 'REST + ?include', sub: 'вложить связанные', waves: [
      [R('GET /me', 1.4), R('GET /me/memberships?include=plan', 2.6, 40), R('GET /me/bookings?…&include=class.trainer', 9.6, 45)]] },
    bff: { t: 'BFF /screens/home', sub: 'эндпоинт под экран', waves: [[R('GET /screens/home', 2.1, 120)]] },
    gql: { t: 'GraphQL', sub: 'один запрос', waves: [[R('POST /graphql · query HomeScreen', 1.9, 140, 0.6)]] }
  };
  function wfCalc(key) {
    const v = WF[key]; let t = 0; const rows = [];
    let kb = 0, n = 0;
    v.waves.forEach(w => {
      const dl = w.reduce((s, r) => s + r.kb + HDR + r.up, 0) / BW * 1000;
      const srv = Math.max(...w.map(r => r.srv));
      w.forEach(r => { rows.push({ p: r.p, start: t, net: NET, srv: r.srv, dl: (r.kb + HDR + r.up) / BW * 1000 * (w.length > 1 ? w.length : 1) }); kb += r.kb; n++; });
      t += NET + srv + dl;
    });
    return { rows, total: Math.round(t), kb: Math.round(kb * 10) / 10, n, waves: v.waves.length };
  }
  const Q_WF = {
    q: 'Что сильнее всего тормозит главный экран на 3G?', seed: 'gql-wf',
    options: [
      { t: 'Число последовательных походов по сети: каждый стоит ~400 мс ожидания, даже если ответ крошечный', ok: 1, why: 'Да. На 3G дорого не «сколько байт», а «сколько раз сходить туда и обратно». Оранжевые куски полосок — это и есть ожидание сети.' },
      { t: 'Объём JSON: 19 КБ — это много для 3G', why: '19 КБ на 3G качаются меньше чем за полсекунды. Сравните: синяя часть полосок (скачивание) в разы короче оранжевой (ожидание).' },
      { t: 'Медленная база данных', why: 'Сервер отвечает за 30 мс — это тонкая фиолетовая полоска. База здесь ни при чём.' },
      { t: 'Протокол REST сам по себе медленный', why: 'Тот же REST, запущенный параллельно, уже в 2,7 раза быстрее. Дело в числе последовательных походов, а не в REST.' }
    ]
  };
  const PICK = [{ v: 'rest', t: 'Оставить как есть' }, { v: 'par', t: 'REST параллельно' }, { v: 'incl', t: 'REST + include' }, { v: 'bff', t: 'BFF' }, { v: 'gql', t: 'GraphQL' }];

  function drawWaterfall(key) {
    const c = wfCalc(key), scale = 5000;
    const ticks = [0, 1, 2, 3, 4, 5].map(s => `<span>${s} с</span>`).join('');
    return `<div class="gql-wf">
      ${c.rows.map(r => {
        const w = r.net + r.srv + r.dl;
        return `<div class="r"><div class="lbl" title="${esc(r.p)}">${esc(r.p)}</div><div class="trk"><div class="bar" style="left:${(r.start / scale * 100).toFixed(2)}%;width:${Math.min(100, w / scale * 100).toFixed(2)}%"><i class="n" style="flex:${r.net}"></i><i class="s" style="flex:${r.srv}"></i><i class="d" style="flex:${Math.round(r.dl)}"></i></div></div></div>`;
      }).join('')}
      <div class="r"><div></div><div class="axis">${ticks}</div></div>
    </div>
    <div class="gql-legend"><span style="--c:var(--warn)">ожидание сети</span><span style="--c:var(--violet)">работа сервера</span><span style="--c:var(--info)">скачивание</span></div>`;
  }

  const taskWaterfall = {
    id: 'waterfall', title: 'Шесть запросов на 3G',
    simple: { icon: '🍽️', plain: 'Экран ждёт не данные, а дорогу: каждый запрос — это поход по сети туда и обратно.', analogy: 'Официант, который ходит к стойке за каждой ложкой отдельно, кормит стол полчаса. Тот, кто берёт заказ на весь стол сразу, — за пять минут. Еды столько же, походов меньше.', tech: 'На мобильной сети задержка одного запроса (RTT) — сотни миллисекунд. Последовательные запросы складывают задержки: 10 запросов × 400 мс = 4 с ожидания. Лечится уменьшением числа <b>последовательных</b> походов: параллельностью, вложением связанных данных, эндпоинтом под экран (BFF) или GraphQL.' },
    lead: ui.brief({
      situation: `Денис жалуется: главный экран приложения открывается 4–6 секунд, если у клиента медленный мобильный интернет (3G). На экране немного: приветствие, абонемент, три ближайшие записи с тренерами. Но сейчас приложение собирает его из 10 запросов по очереди. Сначала «кто я», потом «мои записи», потом по каждой записи — занятие, а потом по каждому занятию — тренера. На 3G каждый такой поход по сети стоит 0,4 секунды только на дорогу туда и обратно.`,
      todo: [
        `Переключите все пять вариантов загрузки: «REST, как сейчас», «REST, параллельно», «REST + ?include», «BFF /screens/home», «GraphQL». Внизу счётчик «Опробовано вариантов».`,
        `Ответьте на вопрос «Что сильнее всего тормозит главный экран на 3G?».`,
        `В блоке «Что предложите студии» выберите решение.`,
        `Засчитывается, когда вопрос решён и выбрано решение, которое убирает и лишние походы, и лишние данные. Сравните хотя бы 3 варианта — это тоже даёт баллы.`
      ],
      lookTitle: 'Как читать диаграмму',
      look: `Каждая строка — один запрос, ось внизу — секунды от 0 до 5. Полоска запроса из трёх цветов. Жёлтый — ждём сеть: эту часть не ускорить, она есть у каждого похода. Фиолетовый — сервер думает. Синий — скачиваем данные. Если полоски идут лесенкой, запросы ждут друг друга. Это «волны»: следующая не начнётся, пока не кончилась предыдущая. Справа три плитки: общее время, сколько запросов и волн, сколько килобайт скачали. <b>BFF</b> — отдельный адрес, сделанный под один экран. <b>GraphQL</b> — один адрес, куда экран присылает список нужных полей.`
    }),
    blank: () => ({ tried: [], cur: 'rest', q: [], pick: '' }),
    reference: () => ({ tried: ['rest', 'par', 'incl', 'bff', 'gql'], cur: 'gql', q: [0], pick: 'gql' }),
    render(el, ctx) {
      el.classList.add('gql-root');
      const a = ctx.ans;
      a.tried = a.tried || []; if (!a.cur) a.cur = 'rest';
      if (!a.tried.includes(a.cur)) { a.tried.push(a.cur); ctx.save(); }
      el.innerHTML = `<div class="stack">
        <div class="grid2" style="align-items:start">
          <div class="stack tight"><div class="eyebrow">Что на экране</div>
            <div class="gql-phone"><b>Привет, Анна!</b>
              <div class="pb"><span class="small dim">Абонемент</span><b>Вся сеть · 12 мес</b><span class="small">осталось 143 дня</span></div>
              <div class="pb"><span class="small dim">Ближайшие записи</span><span>Пт 19:00 · сайкл · Игорь Белов</span><span>Сб 09:00 · йога · Мария Лебедева</span><span>Вс 11:00 · пилатес · Ксения Ким <span class="chip warn" style="padding:0 6px;font-size:11px">ожидание</span></span></div>
              <div class="small dim">🔔 2 новых уведомления</div></div></div>
          <div class="stack tight"><div class="eyebrow">Условия</div>
            <div class="small">3G: каждый поход по сети — <b>${NET} мс</b> ожидания, скорость скачивания <b>${BW} КБ/с</b>. Сервер отвечает за 30 мс.</div>
            <div class="small">Сейчас приложение берёт профиль, абонемент, каталог абонементов (ради названия), записи, а потом <b>по каждой записи</b> — занятие и тренера.</div>
            <div data-seg>${ui.seg('wf', Object.keys(WF).map(k => ({ v: k, t: WF[k].t })), a.cur, 'accent')}</div>
            <div data-stats></div></div>
        </div>
        <div data-wf></div>
        <div class="card flat" data-q></div>
        <div class="stack tight"><div class="eyebrow">Что предложите студии для главного экрана</div>
          <div data-pick>${ui.seg('pick', PICK, a.pick, 'accent')}</div><div data-pnote></div></div>
      </div>`;
      const draw = () => {
        const c = wfCalc(a.cur), base = wfCalc('rest');
        TR.$('[data-wf]', el).innerHTML = drawWaterfall(a.cur);
        const k = c.total > 3000 ? 'bad' : c.total > 1000 ? 'warn' : 'ok';
        TR.$('[data-stats]', el).innerHTML = `<div class="grid3">
          <div class="stat"><div class="k">время</div><div class="v ${k}">${(c.total / 1000).toFixed(1)} с</div><div class="s">${c.total < base.total ? 'в ' + (base.total / c.total).toFixed(1) + ' раза быстрее' : 'как сейчас'}</div></div>
          <div class="stat"><div class="k">запросов</div><div class="v">${c.n}</div><div class="s">${c.waves} ${TR.plural(c.waves, 'волна', 'волны', 'волн')} по очереди</div></div>
          <div class="stat"><div class="k">данные</div><div class="v ${c.kb > 10 ? 'warn' : ''}">${String(c.kb).replace('.', ',')} КБ</div><div class="s">${c.kb > 10 ? 'много лишнего' : 'только нужное'}</div></div></div>
          <div class="small dim">Опробовано вариантов: ${a.tried.length} из ${Object.keys(WF).length}</div>`;
        const pn = TR.$('[data-pnote]', el);
        const PN = {
          rest: ui.note('bad', '', 'Студия так и будет грузить экран 4–5 секунд.'),
          par: ui.note('warn', '', 'Быстрее, но цепочка «записи → занятие → тренер» всё равно требует трёх походов по очереди, и данных качается в 10 раз больше нужного.'),
          incl: ui.note('warn', '', 'Походов мало, но в ответ приезжают целые объекты занятия и тренера — 13 КБ вместо 2. И каждый новый экран будет просить новый <code>include</code>.'),
          bff: ui.note('ok', '', 'Один поход и ровно нужные данные. Но под каждую версию экрана придётся менять эндпоинт — а старые приложения живут месяцами.'),
          gql: ui.note('ok', '', 'Один поход и ровно нужные данные. Экран сам описывает, что ему нужно; новые поля добавляются, не ломая старые версии приложения.')
        };
        pn.innerHTML = a.pick ? PN[a.pick] : '';
      };
      ui.onSeg(el, (name, v) => {
        if (name === 'wf') { a.cur = v; if (!a.tried.includes(v)) a.tried.push(v); }
        if (name === 'pick') { a.pick = v; ctx.decide('Главный экран: способ загрузки', (PICK.find(p => p.v === v) || {}).t); }
        ctx.save(); draw();
      });
      ui.quiz(TR.$('[data-q]', el), Object.assign({}, Q_WF, { value: a.q, readonly: ctx.readonly, reveal: ctx.result, onChange: v => { a.q = v; ctx.save(); } }));
      draw();
    },
    check(a) {
      const tried = (a.tried || []).length, q = ui.quizScore(Q_WF, a.q);
      const PS = { gql: 1, bff: 1, incl: 0.5, par: 0.2, rest: 0 };
      const ps = PS[a.pick] || 0;
      const score = Math.min(1, tried / 3) * 0.2 + q.score * 0.4 + ps * 0.4;
      const notes = [];
      notes.push(tried >= 3 ? { ok: true, html: `Сравнили ${tried} ${TR.plural(tried, 'вариант', 'варианта', 'вариантов')} загрузки.` } : { ok: false, html: 'Прогоните хотя бы три варианта загрузки, включая текущий. Решение без замера — догадка.' });
      notes.push(q.ok ? { ok: true, html: 'Главный тормоз найден верно.' } : { ok: false, html: 'Посмотрите на цвета полосок: какой кусок самый длинный у каждого запроса? Его и надо сокращать.' });
      if (!a.pick) notes.push({ ok: false, html: 'Выберите, что предложите студии.' });
      else if (ps === 1) notes.push({ ok: true, html: a.pick === 'gql' ? 'GraphQL: один поход и ровно нужные поля. Студия сама меняет состав экрана.' : 'BFF — тоже честное решение: один поход, ровно нужные данные. Цена — новый эндпоинт под каждую версию экрана.' });
      else if (a.pick === 'incl') notes.push({ ok: 'warn', html: 'Число походов вы сократили, но тащите целые объекты занятия и тренера. На тарифе с ограниченным трафиком это заметно, а каждый новый экран попросит свой <code>include</code>.' });
      else notes.push({ ok: false, html: 'Этот вариант оставляет цепочку походов по очереди. Посмотрите, сколько «волн» у него на диаграмме.' });
      return { ok: score >= 0.8 && q.ok && ps === 1, score, summary: a.pick ? `Ваш выбор: ${esc((PICK.find(p => p.v === a.pick) || {}).t || '')}.` : '', notes };
    },
    explain: `<p>Время на 3G уходит на <b>ожидание сети</b>, а не на байты и не на базу. Значит, лечим число последовательных походов. Параллельный REST убирает половину ожидания, но цепочка «записи → занятие → тренер» остаётся.</p>
      <p><b>BFF и GraphQL</b> дают одинаково быстрый экран — один поход и ~2 КБ. Разница в том, кто управляет составом экрана. BFF — бэкенд пишет эндпоинт под экран, и при каждой переделке экрана меняет его, помня, что старые версии приложения живут месяцами (<code>F-old-apps</code>). GraphQL — экран сам описывает нужные поля; схема растёт добавлением полей, старые поля помечаются <code>@deprecated</code>, но продолжают работать.</p>
      <p>У «Пульса» в эталоне — <b>REST для всего + GraphQL для главного экрана</b> приложения. Но за GraphQL придётся платить: N+1 в резолверах, защита от тяжёлых запросов, ошибки со статусом 200 и сложности с HTTP-кэшем. Это — следующие подходы.</p>`,
    report: a => `Опробовано вариантов: ${(a.tried || []).length}. Выбор для главного экрана: ${(PICK.find(p => p.v === a.pick) || { t: '—' }).t}. Вопрос про главный тормоз: ${ui.quizScore(Q_WF, a.q).ok ? 'верно' : 'неверно'}.`
  };

  // ======================================================================
  // Подход 2. Соберите запрос
  // ======================================================================
  const B1 = { id: 'bk-9e2d', status: 'BOOKED', class: { id: 'cl-4b1f', startsAt: '2026-10-09T19:00:00+03:00', type: 'CYCLE', trainer: { id: 'tr-41', fullName: 'Игорь Белов', photoUrl: 'https://cdn.puls.fit/t/41.jpg' }, room: { name: 'Сайкл-студия' }, freeSpots: 2 } };
  const B2 = { id: 'bk-7a10', status: 'BOOKED', class: { id: 'cl-5c20', startsAt: '2026-10-10T09:00:00+03:00', type: 'YOGA', trainer: { id: 'tr-17', fullName: 'Мария Лебедева', photoUrl: 'https://cdn.puls.fit/t/17.jpg' }, room: { name: 'Зал 2' }, freeSpots: 0 } };
  const B3 = { id: 'bk-3c4b', status: 'WAITLIST', class: { id: 'cl-6d31', startsAt: '2026-10-11T11:00:00+03:00', type: 'PILATES', trainer: { id: 'tr-08', fullName: 'Ксения Ким', photoUrl: null }, room: { name: 'Зал 1' }, freeSpots: 0 } };
  const TCL = n => Array.from({ length: n }, (_, i) => ({ startsAt: `2026-10-${String(12 + i).padStart(2, '0')}T19:00:00+03:00` }));
  [B1, B2, B3].forEach(b => { b.class.trainer.classes = TCL(5); });
  const DATA = {
    me: {
      id: 'c-1a2b', fullName: 'Анна Смирнова',
      activeMembership: { id: 'm-77f0', plan: { name: 'Вся сеть · 12 мес', priceKopecks: 5400000 }, endsOn: '2027-02-24', daysLeft: 143, status: 'ACTIVE' },
      upcomingBookings: [B1, B2, B3],
      unreadNotificationsCount: 2,
      recommendedClasses: [B1, B2, B3, B1, B2].map((b, i) => ({ startsAt: b.class.startsAt.replace(/T\d\d/, 'T' + (10 + i)), type: b.class.type }))
    }
  };
  // дерево схемы §11; why — почему поле лишнее; id — служебный идентификатор (без штрафа)
  const TREE = [{ f: 'me', t: 'Client!', kids: [
    { f: 'id', t: 'ID!', id: 1 },
    { f: 'fullName', t: 'String!' },
    { f: 'activeMembership', t: 'Membership', kids: [
      { f: 'id', t: 'ID!', id: 1 },
      { f: 'plan', t: 'MembershipPlan!', kids: [
        { f: 'name', t: 'String!' },
        { f: 'priceKopecks', t: 'Int!', why: 'цену купленного абонемента экран не показывает' }] },
      { f: 'endsOn', t: 'Date!', why: 'экран пишет «осталось N дней», а не дату — сервер уже считает это поле' },
      { f: 'daysLeft', t: 'Int!' },
      { f: 'status', t: 'MembershipStatus!', why: 'activeMembership и так возвращает только действующий абонемент' }] },
    { f: 'upcomingBookings', a: '(first: 3)', t: '[Booking!]!', kids: [
      { f: 'id', t: 'ID!' },
      { f: 'status', t: 'BookingStatus!' },
      { f: 'class', t: 'ClassSession!', kids: [
        { f: 'id', t: 'ID!', id: 1 },
        { f: 'startsAt', t: 'DateTime!' },
        { f: 'type', t: 'ClassType!' },
        { f: 'trainer', t: 'Trainer!', kids: [
          { f: 'id', t: 'ID!', id: 1 },
          { f: 'fullName', t: 'String!' },
          { f: 'photoUrl', t: 'String', why: 'фото тренера на главном экране нет — это лишняя картинка на 3G' },
          { f: 'classes', a: '(first: 5)', t: '[ClassSession!]!', kids: [{ f: 'startsAt', t: 'DateTime!', why: 'расписание тренера внутри записи — лишняя глубина: +15 занятий и нагрузка на базу' }] }] },
        { f: 'room', t: 'Room!', kids: [{ f: 'name', t: 'String!', why: 'зал на карточке записи не показан' }] },
        { f: 'freeSpots', t: 'Int!', why: 'вы уже записаны — свободные места вам не нужны, а сервер их пересчитает' }] }] },
    { f: 'unreadNotificationsCount', t: 'Int!' },
    { f: 'recommendedClasses', a: '(first: 5)', t: '[ClassSession!]!', kids: [
      { f: 'startsAt', t: 'DateTime!', why: 'блока «Рекомендуем» на этом экране нет' },
      { f: 'type', t: 'ClassType!', why: 'блока «Рекомендуем» на этом экране нет' }] }] }];
  const REQ = {
    'me.fullName': 'Экран здоровается по имени. В каком поле клиента оно лежит?',
    'me.activeMembership.plan.name': 'Название «Вся сеть · 12 мес» — свойство вида абонемента, а не самого абонемента. Загляните внутрь <code>plan</code>.',
    'me.activeMembership.daysLeft': '«Осталось 143 дня» — в схеме есть готовое поле, телефону не нужно считать дни самому.',
    'me.upcomingBookings.id': 'По нажатию открывается карточка записи и кнопка «Отменить». Чем адресовать запись?',
    'me.upcomingBookings.status': 'Третья запись показана с меткой «ожидание». Откуда экран это знает?',
    'me.upcomingBookings.class.startsAt': 'У каждой записи на экране время занятия.',
    'me.upcomingBookings.class.type': 'У каждой записи на экране направление: сайкл, йога, пилатес.',
    'me.upcomingBookings.class.trainer.fullName': 'У каждой записи имя тренера — до него три шага по связям.',
    'me.unreadNotificationsCount': 'Колокольчик с цифрой «2» — тоже часть экрана.'
  };
  const LEAVES = [];
  (function walk(nodes, pre) { nodes.forEach(n => { const p = pre ? pre + '.' + n.f : n.f; if (n.kids) walk(n.kids, p); else LEAVES.push(Object.assign({ path: p }, n)); }); })(TREE, '');
  const LEAF = Object.fromEntries(LEAVES.map(l => [l.path, l]));

  function buildQuery(sel) {
    const has = p => sel.some(s => s === p || s.startsWith(p + '.'));
    const out = ['query HomeScreen {'];
    (function walk(nodes, pre, ind) {
      nodes.forEach(n => {
        const p = pre ? pre + '.' + n.f : n.f;
        if (!has(p)) return;
        const pad = '  '.repeat(ind);
        if (n.kids) { out.push(`${pad}${n.f}${n.a || ''} {`); walk(n.kids, p, ind + 1); out.push(`${pad}}`); }
        else out.push(`${pad}${n.f}`);
      });
    })(TREE, '', 1);
    out.push('}');
    return sel.length ? out.join('\n') : '# отметьте поля слева — запрос соберётся здесь';
  }
  function buildData(sel) {
    const has = p => sel.some(s => s === p || s.startsWith(p + '.'));
    function pick(nodes, obj, pre) {
      if (Array.isArray(obj)) return obj.map(o => pick(nodes, o, pre));
      if (obj == null) return null;
      const r = {};
      nodes.forEach(n => { const p = pre ? pre + '.' + n.f : n.f; if (!has(p)) return; r[n.f] = n.kids ? pick(n.kids, obj[n.f], p) : obj[n.f]; });
      return r;
    }
    return { data: pick(TREE, DATA, '') };
  }
  function buildEval(sel) {
    const s = new Set(sel || []);
    const miss = Object.keys(REQ).filter(p => !s.has(p));
    const extra = [...s].filter(p => !REQ[p] && LEAF[p] && !LEAF[p].id);
    const ids = [...s].filter(p => LEAF[p] && LEAF[p].id);
    return { miss, extra, ids };
  }

  const taskBuild = {
    id: 'build', title: 'Соберите запрос',
    simple: { icon: '📝', plain: 'В GraphQL экран сам пишет список того, что ему нужно, — и получает ровно это, одним ответом.', analogy: 'Заказ в кафе по меню: «капучино без сахара и сырник». Не «принесите всё с витрины» (лишнее — over-fetching) и не «принесите кофе», а потом бегом за сырником (недобор — under-fetching).', tech: 'Схема (SDL) описывает типы и связи. Запрос — дерево полей; форма ответа повторяет форму запроса. Объектное поле (<code>trainer</code>) обязательно раскрывается до скалярных полей (<code>fullName</code>).' },
    lead: ui.brief({
      situation: `Студия Дениса переводит главный экран на GraphQL. В GraphQL экран сам пишет, что ему нужно, — как заказ по пунктам меню. Сервер отдаёт ровно это, одним ответом. Слева — макет экрана Анны: имя, абонемент, сколько дней осталось, три записи (день, время, занятие, тренер) и счётчик уведомлений. Записи на экране можно нажать и открыть.`,
      todo: [
        `В схеме справа поставьте галочки у полей, которые нужны экрану. Запрос и ответ внизу соберутся сами.`,
        `Сверяйте с макетом: всё, что видно на экране, должно быть отмечено, и ничего сверх этого. Что нужно, чтобы запись можно было открыть нажатием?`,
        `Засчитывается, когда отмечены все нужные поля и нет лишних.`
      ],
      lookTitle: 'Как читать схему',
      look: `Схема — дерево. Строка без галочки — это «папка» (объект), например <code>me</code> — «я», <code>membership</code> — абонемент. Строка с галочкой — конкретное поле. Серым справа написан тип: <code>String</code> — текст, <code>Int</code> — число, <code>!</code> — «всегда есть», <code>[ … ]</code> — список. Внизу слева — готовый запрос, справа — что придёт в ответ. Плитки над ними: сколько нужных полей отмечено и сколько байт весит ответ. Для сравнения: REST сейчас качает 19 200 байт.`
    }),
    blank: () => ({ sel: [] }),
    reference: () => ({ sel: Object.keys(REQ) }),
    render(el, ctx) {
      el.classList.add('gql-root');
      const a = ctx.ans; a.sel = a.sel || [];
      const ev = ctx.result ? buildEval(a.sel) : null;
      const treeHTML = (function walk(nodes, pre, ind) {
        return nodes.map(n => {
          const p = pre ? pre + '.' + n.f : n.f, pad = `padding-left:${ind * 16}px`;
          if (n.kids) return `<div class="obj" style="${pad}">${esc(n.f)}${n.a ? `<span class="ty">${esc(n.a)}</span>` : ''} <span class="ty">${esc(n.t)}</span></div>${walk(n.kids, p, ind + 1)}`;
          const on = a.sel.includes(p);
          let cls = '';
          if (ev && on) cls = REQ[p] || LEAF[p].id ? 'ok' : 'bad';
          return `<label class="${cls}" style="${pad}"><input type="checkbox" data-p="${esc(p)}" ${on ? 'checked' : ''} ${ctx.readonly ? 'disabled' : ''}> ${esc(n.f)} <span class="ty">${esc(n.t)}</span></label>`;
        }).join('');
      })(TREE, '', 0);
      el.innerHTML = `<div class="stack">
        <div class="grid2" style="align-items:start">
          <div class="stack tight"><div class="eyebrow">Макет главного экрана</div>
            <div class="gql-phone"><b>Привет, Анна!</b>
              <div class="pb"><b>Вся сеть · 12 мес</b><span class="small">осталось 143 дня</span></div>
              <div class="pb"><span class="small dim">Ближайшие записи · нажмите, чтобы открыть</span><span>Пт 19:00 · сайкл · Игорь Белов</span><span>Сб 09:00 · йога · Мария Лебедева</span><span>Вс 11:00 · пилатес · Ксения Ким <span class="chip warn" style="padding:0 6px;font-size:11px">ожидание</span></span></div>
              <div class="small dim">🔔 2</div></div></div>
          <div class="stack tight"><div class="eyebrow">Схема: отметьте нужные поля</div><div class="card flat gql-tree">${treeHTML}</div></div>
        </div>
        <div data-stats></div>
        <div class="grid2"><div data-qtext></div><div data-resp></div></div>
      </div>`;
      const draw = () => {
        TR.$('[data-qtext]', el).innerHTML = ui.code(buildQuery(a.sel), 'graphql', 'Запрос — POST /graphql');
        const resp = JSON.stringify(buildData(a.sel), null, 2);
        TR.$('[data-resp]', el).innerHTML = ui.code(a.sel.length ? resp : '{ }', 'json', 'Ответ 200 OK');
        const bytes = a.sel.length ? JSON.stringify(buildData(a.sel)).length : 0;
        const e = buildEval(a.sel);
        TR.$('[data-stats]', el).innerHTML = `<div class="grid3">
          <div class="stat"><div class="k">нужных полей</div><div class="v ${e.miss.length ? 'warn' : 'ok'}">${Object.keys(REQ).length - e.miss.length} / ${Object.keys(REQ).length}</div><div class="s">${e.miss.length ? 'экрану чего-то не хватит' : 'экран собран'}</div></div>
          <div class="stat"><div class="k">размер ответа</div><div class="v tnum">${bytes} Б</div><div class="s">REST сейчас — 19 200 Б</div></div>
          <div class="stat"><div class="k">в ответе объектов</div><div class="v ${resp.split('{').length - 1 > 20 ? 'warn' : ''}">${a.sel.length ? resp.split('{').length - 2 : 0}</div><div class="s">чем больше, тем больше работы резолверам</div></div></div>`;
      };
      el.addEventListener('change', e => {
        const c = e.target.closest('[data-p]'); if (!c || ctx.readonly) return;
        const p = c.dataset.p;
        a.sel = c.checked ? a.sel.concat(p) : a.sel.filter(x => x !== p);
        ctx.save(); draw();
      });
      draw();
    },
    check(a) {
      const e = buildEval(a.sel), total = Object.keys(REQ).length;
      const got = total - e.miss.length;
      const score = Math.max(0, got / total - e.extra.length * 0.08);
      const notes = [];
      e.miss.slice(0, 5).forEach(p => notes.push({ ok: false, html: REQ[p] }));
      e.extra.slice(0, 5).forEach(p => notes.push({ ok: false, html: `<code>${esc(p.replace(/^me\./, ''))}</code> — лишнее: ${LEAF[p].why}.` }));
      if (e.ids.length && !e.miss.length) notes.push({ ok: 'info', html: 'Служебные <code>id</code> не штрафуем: клиентский кэш GraphQL (Apollo, Relay) склеивает по ним одинаковые объекты.' });
      if (!e.miss.length && !e.extra.length) notes.push({ ok: true, html: 'Экран получает всё нужное и ничего лишнего.' });
      return { ok: !e.miss.length && !e.extra.length, score, summary: `Нужных полей: ${got} из ${total}, лишних: ${e.extra.length}.`, notes };
    },
    explain: `<p>Запрос — это «форма» ответа: в ответе ровно те поля и та вложенность, что вы попросили. Девять полей дают ответ около 600 байт против 19 КБ у шести REST-запросов.</p>
      <p>Типичные ошибки: взять <code>endsOn</code> и считать дни на телефоне (часовые пояса, заморозки — правила должны жить на сервере); прихватить <code>photoUrl</code> «на всякий случай» (лишняя картинка на 3G); раскрыть <code>trainer → classes</code> (глубина растёт, резолверы ходят в базу).</p>
      <p>Каждое поле в запросе — работа сервера. Поэтому GraphQL не «бесплатный»: лишнее поле стоит не только байтов, но и запросов к базе. Об этом — следующий подход.</p>`,
    report: a => { const e = buildEval(a.sel); return `Выбрано полей: ${(a.sel || []).length}. Не хватает: ${e.miss.join(', ') || 'нет'}. Лишние: ${e.extra.join(', ') || 'нет'}.`; }
  };

  // ======================================================================
  // Подход 3. N+1 в резолверах и «злой запрос»
  // ======================================================================
  function sqlLog(n, dl) {
    const ids = Array.from({ length: n }, (_, i) => 101 + i), tids = Array.from({ length: n }, (_, i) => [41, 17, 8][i % 3] + Math.floor(i / 3) * 3);
    const L = [
      "SELECT id, full_name FROM client WHERE public_id = $1;",
      "SELECT id, plan_id, ends_on FROM membership WHERE client_id = $1 AND status = 'active';",
      "SELECT name FROM membership_plan WHERE id = $1;",
      `SELECT public_id, status, class_session_id FROM booking WHERE client_id = $1 AND status IN ('booked','waitlist') ORDER BY created_at LIMIT ${n};`
    ];
    if (dl) {
      L.push(`[[ok]]SELECT id, starts_at, class_type_id, trainer_id FROM class_session WHERE id = ANY($1);  -- $1 = {${ids.slice(0, 4).join(',')}${n > 4 ? ',…' : ''}}[[/]]`);
      L.push(`[[ok]]SELECT id, full_name FROM trainer WHERE id = ANY($1);  -- ${n} ${TR.plural(n, 'тренер', 'тренера', 'тренеров')} одним запросом[[/]]`);
    } else {
      ids.forEach((id, i) => {
        L.push(`[[bad]]SELECT id, starts_at, class_type_id, trainer_id FROM class_session WHERE id = $1;  -- ${id}[[/]]`);
        L.push(`[[bad]]SELECT id, full_name FROM trainer WHERE id = $1;  -- ${tids[i]}[[/]]`);
      });
    }
    return L;
  }
  function evil(k, prot) {
    const depth = 4 + 2 * k, objs = 9 + Array.from({ length: k }, (_, i) => 3 * Math.pow(50, i + 1)).reduce((s, x) => s + x, 0);
    let q = 'query {\n  me {\n    upcomingBookings(first: 3) {\n      class {\n        trainer {\n';
    let close = '', ind = 8;
    for (let i = 0; i < k; i++) {
      const pad = ' '.repeat(ind + 2 + i * 4);
      q += `${pad}classes(first: 50) {\n`;
      if (i < k - 1) q += `${pad}  trainer {\n`; else q += `${pad}  startsAt\n`;
    }
    for (let i = k - 1; i >= 0; i--) { const pad = ' '.repeat(ind + 2 + i * 4); if (i < k - 1) close += `${pad}  }\n`; close += `${pad}}\n`; }
    q += close + '        }\n      }\n    }\n  }\n}';
    let verdict;
    if (prot === 'depth') verdict = depth > 7 ? { k: 'ok', t: `Отклонён до выполнения: глубина ${depth} больше лимита 7.` } : { k: 'warn', t: `Глубина ${depth} — в пределах лимита 7, запрос выполнен: ${objs.toLocaleString('ru-RU')} объектов. Лимит глубины не ловит «широкие» запросы — нужен ещё лимит стоимости.` };
    else if (prot === 'cost') verdict = objs > 1000 ? { k: 'ok', t: `Отклонён до выполнения: оценка стоимости ${objs.toLocaleString('ru-RU')} больше лимита 1 000.` } : { k: 'ok', t: `Стоимость ${objs.toLocaleString('ru-RU')} — в пределах лимита, запрос выполнен.` };
    else if (prot === 'persisted') verdict = { k: 'ok', t: 'Отклонён: такого запроса нет в списке сохранённых. Наше приложение шлёт только id готовых запросов (HomeScreen, Schedule…), чужой текст сервер не исполняет.' };
    else verdict = objs > 1000 ? { k: 'bad', t: `Выполняется: ${objs.toLocaleString('ru-RU')} объектов, ~${Math.max(1, Math.round(objs * 180 / 1e6))} МБ JSON. ${k >= 3 ? 'Сервер считает десятки секунд, база захлёбывается — десяток таких запросов кладёт API для всех.' : 'Ещё один уровень — и счёт пойдёт на сотни тысяч.'}` } : { k: 'warn', t: `Выполняется: ${objs} объектов. Пока терпимо — попробуйте вложенность поглубже.` };
    return { depth, objs, q, verdict };
  }
  const Q_N1 = {
    q: 'Почему в GraphQL так легко получить N+1?', seed: 'gql-n1',
    options: [
      { t: 'Резолвер поля вызывается отдельно для каждого объекта и не знает о соседях: «тренер записи 1», «тренер записи 2»…', ok: 1, why: 'Да. Код резолвера выглядит невинно — один SELECT. Но вызывают его N раз. DataLoader копит id за один «тик» и делает один пакетный запрос.' },
      { t: 'GraphQL не умеет JOIN', why: 'GraphQL вообще не про базу — это язык запросов к API. Резолвер может сделать JOIN, но заранее не знает, какие поля попросит клиент.' },
      { t: 'Потому что запрос приходит POST-ом', why: 'Метод HTTP не влияет на то, сколько раз резолверы ходят в базу.' },
      { t: 'Это ошибка клиента: он попросил слишком много полей', why: 'Даже правильный запрос из подхода 2 даёт N+1, если резолверы написаны наивно. Это проблема сервера.' }
    ]
  };
  const Q_PROT = {
    q: 'Какие защиты включить для GraphQL «Пульса»?', multi: true, seed: 'gql-prot',
    options: [
      { t: 'Лимит глубины запроса', ok: 1, why: 'Да, дёшево и отсекает бесконечную вложенность trainer → classes → trainer.' },
      { t: 'Лимит стоимости (оценка числа объектов с учётом first)', ok: 1, why: 'Да. Ловит «широкие» запросы, которые проходят по глубине.' },
      { t: 'Только сохранённые запросы для нашего приложения', ok: 1, why: 'Да. Клиент у GraphQL один — наше приложение, значит, можно разрешить только заранее известные запросы. Это и защита, и путь к кэшу через GET.' },
      { t: 'Выключить интроспекцию — и больше ничего не нужно', why: 'Интроспекцию в проде выключают, но схему всё равно можно восстановить из приложения. Это не защита от тяжёлых запросов.' },
      { t: 'HTTPS', why: 'HTTPS защищает канал, а злой запрос приходит от вполне авторизованного клиента.' }
    ]
  };
  const taskN1 = {
    id: 'nplus1', title: 'N+1 в резолверах',
    simple: { icon: '🏃', plain: 'Сервер на каждый объект в списке ходит в базу отдельно — один раз за списком и ещё N раз за подробностями.', analogy: 'Официант принёс список из 20 заказов и бегает на кухню за каждым блюдом по одному: 21 поход. Толковый официант собирает все блюда в один поднос — DataLoader так и делает.', tech: 'N+1 — 1 запрос за списком + N запросов за связанными объектами. В GraphQL резолвер поля <code>trainer</code> вызывается для каждой записи. DataLoader собирает ключи за один проход и делает один пакетный запрос <code>WHERE id = ANY($1)</code>, плюс кэширует в пределах одного запроса.' },
    lead: ui.brief({
      situation: `GraphQL-запрос пришёл на сервер. Теперь сервер собирает ответ из базы данных. Для каждого поля у него есть маленький помощник — <b>резолвер</b>, «тот, кто знает, где взять это поле». Беда: помощник «тренер» ходит в базу за каждым тренером отдельно. 3 записи на экране — 6 лишних походов, 20 записей — 40. В воскресенье в 20:00 экран открывают 50 раз в секунду. А ещё любой, у кого есть приложение, может прислать огромный «злой запрос».`,
      todo: [
        `Часть 1. Переключите «Без DataLoader» / «С DataLoader» и «3 записи» / «20 записей». Смотрите, сколько строк в журнале SQL.`,
        `Часть 2. Выберите «3 круга» вложенности без защиты, потом включите любую защиту и посмотрите, что изменится.`,
        `Ответьте на два вопроса внизу. Во втором ответов несколько.`,
        `Засчитывается, когда сделаны хотя бы три из четырёх опытов (включить DataLoader, 20 записей, злой запрос в 3 круга, защита) и оба вопроса решены.`
      ],
      lookTitle: 'Как читать',
      look: `Журнал SQL — список запросов к базе за одно открытие экрана. Одна строка — один поход в базу. Красные строки — повторяющиеся походы «по одному». Зелёные — DataLoader собрал все номера и сходил один раз: <code>WHERE id = ANY(…)</code> значит «дай всех из списка». <b>DataLoader</b> — как официант, который записывает заказ всего стола и идёт на кухню один раз. Плитки: сколько запросов к базе, сколько это в воскресный пик и сколько времени уходит. В части 2 слева злой запрос, справа — что с ним сделал сервер. «Круг» — ещё один шаг «тренер → его занятия», и каждый круг умножает объекты в 50 раз.`
    }),
    blank: () => ({ dl: 'off', n: '3', k: '1', prot: 'none', saw: {}, q1: [], q2: [] }),
    reference: () => ({ dl: 'on', n: '20', k: '3', prot: 'cost', saw: { dl: true, many: true, evil: true, prot: true }, q1: [0], q2: [0, 1, 2] }),
    render(el, ctx) {
      el.classList.add('gql-root');
      const a = ctx.ans; a.saw = a.saw || {};
      ['dl', 'n', 'k', 'prot'].forEach(k => { if (a[k] == null) a[k] = this.blank()[k]; });
      el.innerHTML = `<div class="stack">
        <div class="eyebrow">Часть 1 · журнал SQL одного открытия главного экрана</div>
        <div class="row">${ui.seg('dl', [{ v: 'off', t: 'Без DataLoader' }, { v: 'on', t: 'С DataLoader' }], a.dl, 'accent')}
          ${ui.seg('n', [{ v: '3', t: '3 записи' }, { v: '20', t: '20 записей' }], a.n)}</div>
        <div data-n1stats></div>
        <div class="gql-log" data-log></div>
        <div class="eyebrow">Часть 2 · «злой запрос»</div>
        <div class="small">Схема разрешает идти по кругу: запись → занятие → тренер → его занятия → тренер → … Любой, у кого есть токен приложения, может прислать такой запрос.</div>
        <div class="row"><span class="small dim">Вложенность trainer → classes:</span>${ui.seg('k', [{ v: '1', t: '1 круг' }, { v: '2', t: '2 круга' }, { v: '3', t: '3 круга' }], a.k)}</div>
        <div class="row"><span class="small dim">Защита:</span>${ui.seg('prot', [{ v: 'none', t: 'нет' }, { v: 'depth', t: 'глубина ≤ 7' }, { v: 'cost', t: 'стоимость ≤ 1000' }, { v: 'persisted', t: 'сохранённые запросы' }], a.prot, 'accent')}</div>
        <div data-evil></div>
        <div class="card flat" data-q1></div>
        <div class="card flat" data-q2></div>
      </div>`;
      const draw = () => {
        const n = +a.n, log = sqlLog(n, a.dl === 'on'), cnt = log.length;
        TR.$('[data-log]', el).innerHTML = ui.code(log.join('\n'), 'sql');
        TR.$('[data-n1stats]', el).innerHTML = `<div class="grid3">
          <div class="stat"><div class="k">запросов к базе</div><div class="v ${a.dl === 'on' ? 'ok' : n > 3 ? 'bad' : 'warn'}">${cnt}</div><div class="s">${a.dl === 'on' ? 'не зависит от числа записей' : '4 + 2 × ' + n}</div></div>
          <div class="stat"><div class="k">в воскресенье 20:00</div><div class="v ${cnt * 50 > 1000 ? 'bad' : ''}">${(cnt * 50).toLocaleString('ru-RU')}/с</div><div class="s">при 50 открытиях экрана в секунду</div></div>
          <div class="stat"><div class="k">время резолверов</div><div class="v ${cnt > 10 ? 'warn' : ''}">~${cnt * 2} мс</div><div class="s">по 2 мс на поход в базу</div></div></div>`;
        const ev = evil(+a.k, a.prot);
        TR.$('[data-evil]', el).innerHTML = `<div class="grid2"><div>${ui.code(ev.q, 'graphql', `Глубина ${ev.depth} · объектов ${ev.objs.toLocaleString('ru-RU')}`)}</div><div class="stack tight">${ui.note(ev.verdict.k, ev.verdict.k === 'bad' ? 'Сервер в беде' : ev.verdict.k === 'warn' ? 'Прошёл' : 'Остановлен', ev.verdict.t)}</div></div>`;
      };
      ui.onSeg(el, (name, v) => {
        a[name] = v;
        if (name === 'dl' && v === 'on') a.saw.dl = true;
        if (name === 'n' && v === '20') a.saw.many = true;
        if (+a.k >= 3 && a.prot === 'none') a.saw.evil = true;
        if (name === 'prot' && v !== 'none') a.saw.prot = true;
        ctx.save(); draw();
      });
      ui.quiz(TR.$('[data-q1]', el), Object.assign({}, Q_N1, { value: a.q1, readonly: ctx.readonly, reveal: ctx.result, onChange: v => { a.q1 = v; ctx.save(); } }));
      ui.quiz(TR.$('[data-q2]', el), Object.assign({}, Q_PROT, { value: a.q2, readonly: ctx.readonly, reveal: ctx.result, onChange: v => { a.q2 = v; ctx.save(); } }));
      draw();
    },
    check(a) {
      const s = a.saw || {}, q1 = ui.quizScore(Q_N1, a.q1), q2 = ui.quizScore(Q_PROT, a.q2);
      const lab = ['dl', 'many', 'evil', 'prot'].filter(k => s[k]).length / 4;
      const score = lab * 0.3 + q1.score * 0.35 + q2.score * 0.35;
      const notes = [];
      if (!s.dl || !s.many) notes.push({ ok: false, html: 'Сравните журнал SQL на 20 записях без DataLoader и с ним — сколько запросов к базе уходит в каждом случае?' });
      if (!s.evil) notes.push({ ok: false, html: 'Пошлите «злой запрос» в 3 круга без защиты — посмотрите, во что превращается невинная вложенность.' });
      if (!s.prot) notes.push({ ok: false, html: 'Попробуйте хотя бы одну защиту против злого запроса.' });
      notes.push(q1.ok ? { ok: true, html: 'Причина N+1 названа верно.' } : { ok: false, html: 'Вопрос 1: подумайте, кто и сколько раз вызывает резолвер поля <code>trainer</code>.' });
      notes.push(q2.ok ? { ok: true, html: 'Набор защит верный.' } : { ok: false, html: 'Вопрос 2: нужны защиты, которые останавливают тяжёлый запрос до выполнения. Пояснения у вариантов.' });
      return { ok: q1.ok && q2.ok && lab >= 0.75, score, notes };
    },
    explain: `<p><b>N+1</b> — главная болезнь GraphQL-серверов. Наивный резолвер <code>trainer</code> делает один SELECT, но вызывают его для каждой записи. На 20 записях — 44 запроса к базе на одно открытие экрана, в воскресенье 20:00 — больше двух тысяч в секунду. Это ровно инцидент «главный экран грузится 8 секунд». <b>DataLoader</b> собирает ключи и делает один <code>WHERE id = ANY($1)</code> на тип: 6 запросов при любом числе записей.</p>
      <p><b>Злой запрос</b> не требует взлома — достаточно токена приложения и схемы. Защита в три слоя: лимит глубины (дёшево, но не ловит широкие запросы), лимит стоимости (оценивает число объектов с учётом <code>first</code>), сохранённые запросы — сервер исполняет только заранее зарегистрированные запросы нашего приложения. Плюс таймаут на выполнение и лимит частоты на пользователя.</p>`,
    report: a => `Лаборатория: DataLoader ${a.saw && a.saw.dl ? 'включали' : 'не включали'}, злой запрос без защиты ${a.saw && a.saw.evil ? 'пробовали' : 'не пробовали'}. Вопрос про N+1: ${ui.quizScore(Q_N1, a.q1).ok ? 'верно' : 'неверно'}; защиты: ${ui.quizScore(Q_PROT, a.q2).ok ? 'верно' : 'неверно'}.`
  };

  // ======================================================================
  // Подход 4. Ошибки, мутации и кэш + обоснование
  // ======================================================================
  const QE = [
    {
      q: `Ответ сервера на запрос HomeScreen — <code>HTTP 200</code>. Мониторинг студии считает ошибками только коды 4xx и 5xx. Что не так?${ui.code(`{
  "data": { "me": { "fullName": "Анна Смирнова",
    "upcomingBookings": [
      { "id": "bk-9e2d", "class": { "startsAt": "2026-10-09T19:00:00+03:00", "trainer": { "fullName": "Игорь Белов" } } },
      { "id": "bk-7a10", "class": { "startsAt": "2026-10-10T09:00:00+03:00", [[bad]]"trainer": null[[/]] } } ] } },
  [[bad]]"errors": [ { "message": "trainer service timeout",
    "path": ["me", "upcomingBookings", 1, "class", "trainer"],
    "extensions": { "code": "UPSTREAM_TIMEOUT" } } ][[/]]
}`, 'json')}`, seed: 'gql-e1',
      options: [
        { t: 'В GraphQL ошибка поля приходит в массиве <code>errors</code> при статусе 200 вместе с частичными данными. Клиент и мониторинг обязаны смотреть <code>errors</code>, а экран — показать запись без тренера, а не падать', ok: 1, why: 'Верно. Частичный ответ — норма GraphQL: одно сломанное поле не роняет весь экран. Но мониторинг по HTTP-статусам такую ошибку не увидит.' },
        { t: 'Сервер ошибся: при любой ошибке надо отвечать 500', why: 'Тогда пропадёт весь экран из-за одного тренера. GraphQL специально отдаёт частичные данные.' },
        { t: 'Всё нормально, раз 200 — значит, ошибок нет', why: 'Посмотрите на массив errors: тренер второй записи не загрузился.' },
        { t: 'Надо повторить весь запрос, пока не придёт без errors', why: 'Слепой повтор при таймауте соседнего сервиса только добавит нагрузки. Лучше показать то, что есть.' }
      ]
    },
    {
      q: `Мутация записи на занятие. Мест нет — как сообщить об этом приложению?${ui.code(`mutation Book($input: BookClassInput!) {
  bookClass(input: $input) {
    __typename
    ... on BookingCreated { booking { id status } }
    ... on ClassFull { waitlistAvailable }
    ... on MembershipInvalid { reason }
  }
}`, 'graphql')}`, seed: 'gql-e2',
      options: [
        { t: 'Вернуть вариант <code>ClassFull</code> из union <code>BookClassPayload</code>: это ожидаемый бизнес-исход, он описан в схеме, и приложение обязано его обработать', ok: 1, why: 'Верно. Бизнес-исходы («мест нет», «абонемент не действует») — часть контракта и типизированы. В errors — только сбои.' },
        { t: 'Бросить исключение: придёт в errors с текстом «Class full», приложение разберёт текст', why: 'Разбор текста ошибки ломается от первой правки формулировки. И бизнес-исход смешивается со сбоями.' },
        { t: 'Ответить HTTP 409, как в REST', why: 'В GraphQL один HTTP-статус на весь ответ, а в одном запросе может быть несколько операций. Статус не годится для бизнес-исходов.' },
        { t: 'Вернуть booking: null без пояснений', why: 'Приложение не поймёт, почему: мест нет, абонемент истёк или сбой. Не сможет предложить лист ожидания.' }
      ]
    },
    {
      q: 'Расписание клуба через GraphQL читают тысячи телефонов. CDN не кэширует ни одного ответа. Почему и что делать?', seed: 'gql-e3',
      options: [
        { t: 'Запросы идут POST-ом на один адрес /graphql — HTTP-кэши POST не кэшируют. Сохранённые запросы позволяют слать GET /graphql?id=Schedule&variables=… и ставить Cache-Control и ETag', ok: 1, why: 'Верно. GET с id сохранённого запроса — обычный кэшируемый адрес. Только для публичных данных: главный экран личный — у него Cache-Control: private.' },
        { t: 'CDN не умеет JSON', why: 'Умеет. Проблема в методе POST и в том, что адрес у всех запросов один.' },
        { t: 'Включить на CDN кэширование POST по телу запроса', why: 'Опасно и нестандартно: тело с токеном и переменными, легко отдать чужие данные. Стандартный путь — GET.' },
        { t: 'Кэшировать на телефоне — этого достаточно', why: 'Кэш на телефоне не снимет нагрузку при первом открытии у тысяч людей в воскресенье 20:00.' }
      ]
    }
  ];
  const J_GQL = {
    id: 'gql-why', q: 'Почему мобильному приложению можно GraphQL, а партнёру ФитПасс даём REST?',
    rubric: [
      'Приложение — наш клиент: мы контролируем запросы и можем разрешить только сохранённые',
      'Партнёру нужен стабильный контракт с версией (/partner/v1) и анонсом снятия (Deprecation, Sunset)',
      'Расписание партнёр читает до 50 запросов в секунду — REST GET кэшируется (CDN, ETag)',
      'Лимит частоты 20 запросов в секунду легко считать по запросам REST; в GraphQL один запрос может стоить как тысяча',
      'ФитПасс ретраит ошибки: им нужны понятные HTTP-коды (409, 429 + Retry-After) и Idempotency-Key, а в GraphQL всё 200'
    ],
    reference: 'GraphQL выгоден, когда клиент наш и экраны меняются часто: студия сама собирает экран одним запросом, а мы разрешаем только сохранённые запросы её приложения. ФитПасс — внешний партнёр. Ему нужен стабильный контракт с версией /partner/v1 и анонсом снятия; расписание он читает до 50 раз в секунду — REST GET кэшируется через CDN и ETag; лимит 20 запросов в секунду считается по запросам, а в GraphQL один запрос может стоить как тысяча. И партнёр ретраит ошибки — ему нужны понятные коды 409 и 429 с Retry-After и Idempotency-Key, а у GraphQL почти всё приходит с кодом 200.'
  };
  const taskErr = {
    id: 'errors', title: 'Ошибки, мутации и кэш',
    simple: { icon: '📦', plain: 'В GraphQL почти всё приходит со статусом 200: и успех, и частичный сбой. Бизнес-ответы вроде «мест нет» описывают прямо в схеме.', analogy: 'Курьер привёз заказ из трёх блюд, одного нет. Он не разворачивается со всем заказом, а отдаёт два блюда и записку «суп закончился». Записку надо прочитать — по коробкам не видно.', tech: 'Ответ GraphQL: <code>{ data, errors }</code>. Ошибки полей — в <code>errors</code> с <code>path</code>, данные — частичные. Бизнес-исходы мутаций — union-типы payload (<code>BookingCreated | ClassFull | MembershipInvalid</code>). HTTP-кэш работает только для GET — отсюда сохранённые запросы (persisted queries).' },
    lead: ui.brief({
      situation: `GraphQL отвечает почти на всё кодом 200 «всё хорошо», даже когда часть данных не пришла. В «Пульсе» с этим столкнутся трижды. Мониторинг Дениса не видит сбоев. Приложение не понимает, почему не записало на занятие. CDN — сеть складов с копиями ответов поближе к людям — не кэширует расписание, которое читают тысячи телефонов.`,
      todo: [
        `Ответьте на три вопроса — по одному на ситуацию. Внимательно читайте код в вопросах.`,
        `Напишите Денису и Кириллу (от 100 знаков), почему приложению можно GraphQL, а партнёру ФитПасс даём REST. Сверьте с Верой или с эталоном.`,
        `Засчитывается, когда все три вопроса решены и обоснование покрывает от 60 % пунктов.`
      ],
      lookTitle: 'На что смотреть',
      look: `В первом вопросе красным подсвечены два места: тренер пришёл пустым (<code>null</code>), а в конце есть массив <code>errors</code> с причиной. Во втором <code>union</code> — «один из нескольких ответов»: запись создана, мест нет или абонемент не годится. <code>__typename</code> говорит, какой именно пришёл. В третьем вспомните: GraphQL обычно шлют методом POST на один адрес <code>/graphql</code>. Для обоснования вспомните ФитПасс из этапа про ретраи: лимит 20 запросов в секунду, повторы, коды 409 и 429.`
    }),
    blank: () => ({ a: [], b: [], c: [], j: {} }),
    reference: () => ({ a: [0], b: [0], c: [0], j: { text: J_GQL.reference, self: J_GQL.rubric.map(() => true) } }),
    render(el, ctx) {
      el.classList.add('gql-root');
      const a = ctx.ans;
      ['a', 'b', 'c'].forEach((k, i) => {
        const d = document.createElement('div'); d.className = 'card flat'; el.appendChild(d);
        ui.quiz(d, Object.assign({}, QE[i], { value: a[k], readonly: ctx.readonly, reveal: ctx.result, onChange: v => { a[k] = v; ctx.save(); } }));
      });
      const j = document.createElement('div'); j.className = 'card'; el.appendChild(j);
      ui.justify(j, Object.assign({}, J_GQL, { value: a.j, readonly: ctx.readonly, minLen: 100, onChange: v => { a.j = v; ctx.save(); ctx.decide('GraphQL для приложения, REST для партнёра', v.text || ''); } }));
    },
    check(a) {
      const r = ['a', 'b', 'c'].map((k, i) => ui.quizScore(QE[i], a[k]));
      const js = ui.justifyScore(a.j);
      const score = r.reduce((s, x) => s + x.score, 0) / 3 * 0.7 + js * 0.3;
      const NT = ['ошибки в errors при 200', 'бизнес-исход мутации', 'HTTP-кэш и GET'];
      const notes = r.map((x, i) => ({ ok: x.ok, html: `Вопрос ${i + 1} (${NT[i]}): ${x.ok ? 'верно' : 'есть ошибка — пояснения у вариантов'}.` }));
      notes.push(js >= 0.6 ? { ok: true, html: 'Обоснование засчитано.' } : { ok: false, html: (a.j && a.j.text && a.j.text.trim().length >= 30) ? 'Обоснование неполное: подумайте про кэш, лимит частоты, стабильность контракта и ретраи партнёра.' : 'Напишите обоснование и проверьте его с Верой или сверьте с эталоном.' });
      return { ok: r.every(x => x.ok) && js >= 0.6, score, notes };
    },
    explain: `<p>Три правила, которые стоит записать в контракт GraphQL для студии:</p>
      <ul class="checks"><li><b>Ошибки.</b> Статус 200 не значит «всё хорошо». Клиент рисует частичные данные и логирует <code>errors</code>; мониторинг считает долю ответов с <code>errors</code>, а не только 5xx.</li>
      <li><b>Мутации.</b> Ожидаемые исходы — в схеме: <code>union BookClassPayload = BookingCreated | ClassFull | MembershipInvalid</code>. И <code>idempotencyKey</code> во входе <code>BookClassInput</code> — ретрай на плохой сети не должен создать две записи.</li>
      <li><b>Кэш.</b> POST не кэшируется. Сохранённые запросы через GET — и защита (белый список), и кэш для публичных данных.</li></ul>
      <p>Партнёрам GraphQL не даём: им нужен стабильный, кэшируемый, ограничиваемый по частоте REST с понятными кодами ответа. GraphQL — инструмент для своего клиента, а не универсальный ответ.</p>`,
    report: a => {
      const r = ['a', 'b', 'c'].map((k, i) => ui.quizScore(QE[i], a[k]).ok ? 'верно' : 'неверно');
      return `Ошибки при 200: ${r[0]}; бизнес-исход мутации: ${r[1]}; кэш: ${r[2]}.\n\nОбоснование: ${(a.j && a.j.text) || '—'}`;
    }
  };

  TR.stage({
    id: 'graphql', act: 3, order: 150, slot: 'Пт 10:00', title: 'GraphQL для экрана',
    when: 'пятница, 10:00 · созвон с мобильной студией',
    intro: [
      { who: 'denis', html: '«Главный экран — шесть запросов, на 3G грузится 4–6 секунд. Пользователи жалуются, что приложение тупит. Сделайте нам GraphQL — все так делают».' },
      { who: 'vera', html: 'GraphQL — не волшебная кнопка. Сначала замерим, куда уходят секунды. Потом соберём запрос сами, найдём, где GraphQL бьёт по базе, и решим, кому его давать, а кому нет.' }
    ],
    facts: ['F-mobile', 'F-old-apps', 'F-fitpass-tech', 'F-week-open'],
    glossary: [
      { term: 'GraphQL', simple: 'Экран одним запросом говорит, какие именно данные ему нужны, и получает ровно их. Как официант, который берёт заказ на весь стол сразу, а не ходит к стойке шесть раз.', tech: 'Язык запросов к API со строгой схемой типов. Обычно один адрес <code>POST /graphql</code>; форма ответа повторяет форму запроса. Операции: query (чтение), mutation (изменение), subscription (поток).' },
      { term: 'Схема GraphQL (SDL)', simple: 'Меню с составом блюд: что можно заказать и из чего оно состоит.', tech: 'Описание типов, полей, аргументов и связей: <code>type Client { fullName: String! … }</code>. <code>!</code> — поле не бывает null.' },
      { term: 'Over-fetching и under-fetching', simple: 'Over — принесли весь комплексный обед, когда нужен был суп. Under — принесли суп без ложки, бегите ещё раз.', tech: 'Лишние данные в ответе (трафик, работа сервера) и недостающие данные, из-за которых нужен ещё один запрос (задержка).' },
      { term: 'Резолвер', simple: 'Повар, отвечающий за одно блюдо: его зовут, когда заказали именно это поле.', tech: 'Функция сервера, которая вычисляет значение поля. Вызывается для каждого объекта, у которого запрошено поле.' },
      { term: 'N+1', simple: 'Официант бегает на кухню за каждой тарелкой по отдельности: один раз за списком заказов и ещё N раз за блюдами.', tech: '1 запрос за списком + N запросов за связанными объектами. Растёт вместе с длиной списка и убивает базу в пик.' },
      { term: 'DataLoader', simple: 'Официант собирает заказы со всех столов и несёт на кухню один общий список.', tech: 'Батчинг и кэш в пределах одного запроса: копит ключи за проход и делает один <code>WHERE id = ANY($1)</code>.' },
      { term: 'BFF (Backend for Frontend)', simple: 'Личный помощник одного экрана: собирает всё, что нужно именно ему, в один ответ.', tech: 'Эндпоинт или сервис под конкретный клиент или экран (<code>GET /screens/home</code>). Просто и быстро, но меняется вместе с экраном.' },
      { term: 'Сохранённые запросы (persisted queries)', simple: 'Комплексный обед №3: называете номер, а не перечисляете блюда. Чужих заказов кухня не готовит.', tech: 'Клиент шлёт id заранее зарегистрированного запроса (часто GET). Белый список против злых запросов, меньше байт, работает HTTP-кэш.' },
      { term: 'Union-payload мутации', simple: 'Бланк ответа с заранее напечатанными вариантами: «записаны», «мест нет», «абонемент не действует».', tech: '<code>union BookClassPayload = BookingCreated | ClassFull | MembershipInvalid</code> — бизнес-исходы типизированы в схеме, а не прячутся в тексте ошибки.' }
    ],
    outro: 'Главный экран — один запрос и полкилобайта вместо шести запросов и 19 КБ. Но вы видели и цену: N+1, злые запросы, ошибки со статусом 200 и кэш, который не работает для POST. GraphQL остаётся для своего приложения, партнёрам — REST. После обеда — турникеты, 1С и живой счётчик: там REST тоже не всегда лучший ответ.',
    tasks: [taskWaterfall, taskBuild, taskN1, taskErr]
  });
})();
