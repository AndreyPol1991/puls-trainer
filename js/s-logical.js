/* Неделя 2, вторник: логическая модель «Пульса». Студент сам раскладывает атрибуты по таблицам и видит,
   как растёт ER-диаграмма; расставляет ключи и смотрит на перебор чужих записей; разбирает время с поясом
   и деньги в копейках на живых примерах; выбирает, как устроить платёж «за абонемент ИЛИ за тренировку».
   Канон — _dev/DOMAIN.md §5. */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc;
  const strip = s => String(s == null ? '' : s).replace(/<[^>]+>/g, '');
  const add = (el, cls, html) => { const d = document.createElement('div'); if (cls) d.className = cls; if (html) d.innerHTML = html; el.appendChild(d); return d; };

  if (!document.getElementById('lgc-style')) {
    document.head.insertAdjacentHTML('beforeend', `<style id="lgc-style">
      .lgc-er { contain: inline-size; min-width: 0; }
      .lgc-cons { border-left: 3px solid var(--border-strong); padding: 6px 12px; font-size: 14px; }
      .lgc-cons.ok { border-color: var(--ok); } .lgc-cons.bad { border-color: var(--bad); } .lgc-cons.warn { border-color: var(--warn); }
      .lgc-keys .matcher { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      @media (max-width: 860px) { .lgc-keys .matcher { grid-template-columns: minmax(0, 1fr); } }
      .lgc-lab .seg { flex-wrap: wrap; }
      .lgc-sort .tok { display: inline-grid; gap: 1px; justify-items: start; }
      .lgc-lab td { vertical-align: top; }
    </style>`);
  }
  const mono = s => `<span class="mono">${esc(s)}</span>`;

  // ======================================================================
  // Подход 1. Разложите атрибуты по таблицам + живая ER-диаграмма
  // ======================================================================
  const TABLES = [
    { id: 'class_session', t: 'Занятие' },
    { id: 'booking', t: 'Запись на занятие' },
    { id: 'client', t: 'Клиент' },
    { id: 'visit', t: 'Посещение' },
    { id: 'membership_plan', t: 'Вид абонемента' },
    { id: 'membership', t: 'Абонемент' },
    { id: 'payment', t: 'Платёж' }
  ];
  const OTHER = 'other';
  const BUCKETS = TABLES.map(t => ({ id: t.id, t: mono(t.id), sub: t.t })).concat({ id: OTHER, t: 'Другая таблица', sub: 'зал, клуб — их здесь нет' });
  const BASE = {
    class_session: [{ n: 'id', k: 'PK' }, { n: 'class_type_id', k: 'FK' }, { n: 'room_id', k: 'FK' }],
    booking: [{ n: 'id', k: 'PK' }, { n: 'client_id', k: 'FK' }, { n: 'class_session_id', k: 'FK' }],
    client: [{ n: 'id', k: 'PK' }],
    visit: [{ n: 'id', k: 'PK' }, { n: 'client_id', k: 'FK' }, { n: 'club_id', k: 'FK' }],
    membership_plan: [{ n: 'id', k: 'PK' }],
    membership: [{ n: 'id', k: 'PK' }, { n: 'client_id', k: 'FK' }, { n: 'plan_id', k: 'FK' }],
    payment: [{ n: 'id', k: 'PK' }, { n: 'client_id', k: 'FK' }, { n: 'membership_id', k: 'FK', nul: 1 }]
  };
  const ATTRS = [
    { id: 'phone', n: 'phone', s: 'телефон, по нему вход', ok: ['client'], hint: 'по телефону входят в приложение. Чей это телефон?' },
    { id: 'referred_by_id', n: 'referred_by_id', s: 'кто привёл', k: 'FK', nul: 1, ok: ['client'], hint: '«приведи друга» — ссылка с клиента на клиента.' },
    { id: 'medical', n: 'medical_valid_until', s: 'справка действует до', nul: 1, ok: ['client'], hint: 'справку приносит человек, и она годится на все занятия бассейна. Одна дата — на кого?' },
    { id: 'starts_at', n: 'starts_at', s: 'когда начинается', ok: ['class_session'], hint: 'у чего в расписании есть время начала?' },
    { id: 'cap_s', n: 'capacity', s: 'мест на этом занятии', ok: ['class_session'], hint: 'с этим числом сравнивают записанных (F-capacity). Это места конкретного занятия, а не помещения.' },
    { id: 'booked_count', n: 'booked_count', s: 'сколько уже записано', ok: ['class_session'], hint: 'счётчик нужен, чтобы в воскресенье 20:00 занять место одной командой «+1, если ещё есть места». Где лежит лимит мест, там и счётчик.' },
    { id: 'club_id', n: 'club_id', s: 'клуб, где идёт занятие', k: 'FK', ok: ['class_session', OTHER], why: 'Строго по правилам клуб можно узнать через зал. Эталон дублирует <code>club_id</code> в занятии осознанно: «расписание клуба на дату» — самый частый запрос. Согласованность держит составной внешний ключ (room_id, club_id).', hint: 'это ссылка на клуб, где проходит занятие. Какой запрос в «Пульсе» самый частый?' },
    { id: 'trainer_id', n: 'trainer_id', s: 'кто ведёт', k: 'FK', ok: ['class_session'], hint: 'групповое занятие ведёт один тренер. Чьё это свойство?' },
    { id: 'b_status', n: 'status', s: 'booked · waitlist · cancelled · attended · no_show', ok: ['booking'], hint: 'waitlist и no_show — состояние пары «клиент + занятие», а не всего занятия.' },
    { id: 'late_cancel', n: 'late_cancel', s: 'отменил позже, чем за 2 часа', ok: ['booking'], hint: 'поздняя отмена — про конкретную запись: по ним считают прогулы (F-cancel).' },
    { id: 'cancelled_at', n: 'cancelled_at', s: 'когда отменили запись', nul: 1, ok: ['booking'], hint: 'отменяют запись, а не клиента.' },
    { id: 'price_plan', n: 'price_kopecks', s: 'цена в прайсе сейчас', ok: ['membership_plan'], crit: 1, hint: 'это цена, по которой продают сегодня. Одна на весь вид абонемента.' },
    { id: 'duration', n: 'duration_days', s: 'срок: 30, 90, 180, 365', ok: ['membership_plan'], hint: 'срок одинаков у всех проданных абонементов одного вида. Где описать его один раз?' },
    { id: 'access', n: 'access_scope', s: 'домашний клуб или вся сеть', ok: ['membership_plan'], hint: 'это условие из прайса: «Сеть 12 мес» или «Домашний клуб 3 мес».' },
    { id: 'freeze_allowed', n: 'freeze_days_allowed', s: 'сколько дней заморозки можно', ok: ['membership_plan'], hint: 'правило вида: для 6 и 12 месяцев — 30 дней в год. Сколько уже потрачено — другое поле.' },
    { id: 'price_paid', n: 'price_paid_kopecks', s: 'цена, по которой продали', ok: ['membership'], crit: 1, hint: 'это цена сделки: прайс поменяется, а она — нет (F-price-change). Попыток оплаты бывает несколько, а сделка одна.' },
    { id: 'starts_on', n: 'starts_on', s: 'дата начала действия', ok: ['membership'], hint: 'даты действия есть у проданного абонемента, а не у строки прайса.' },
    { id: 'ends_on', n: 'ends_on', s: 'дата окончания, сдвигается заморозкой', ok: ['membership'], hint: 'заморозка сдвигает окончание конкретного проданного абонемента.' },
    { id: 'home_club', n: 'home_club_id', s: 'домашний клуб, может быть пусто', k: 'FK', nul: 1, ok: ['membership'], hint: 'домашний клуб выбирают при покупке «домашнего» абонемента, у сетевого — пусто. Следующий абонемент клиент может взять в другом клубе.' },
    { id: 'amount', n: 'amount_kopecks', s: 'сумма этой оплаты', ok: ['payment'], hint: 'сумма конкретной попытки оплаты.' },
    { id: 'idem', n: 'idempotency_key', s: 'защита от повторного списания', ok: ['payment'], hint: 'повтор запроса оплаты с тем же ключом должен найти уже созданный платёж (F-no-loss).' },
    { id: 'provider_id', n: 'provider_payment_id', s: 'номер платежа в ПэйПоинте', nul: 1, ok: ['payment'], hint: 'это номер, который выдал платёжный сервис для конкретной оплаты.' },
    { id: 'export1c', n: 'exported_to_1c_at', s: 'когда выгрузили в 1С', nul: 1, ok: ['payment'], hint: 'в 1С выгружают оплаты. Повторная выгрузка задвоит выручку (F-1c-dup) — отметка нужна на каждой оплате.' },
    { id: 'turnstile', n: 'turnstile_event_id', s: 'номер события турникета', ok: ['visit'], hint: 'после обрыва связи турникет досылает буфер событий (F-offline). По номеру события повтор не создаст второй проход.' },
    { id: 'entered_at', n: 'entered_at', s: 'время прохода', ok: ['visit'], hint: 'это момент, когда клиент прошёл через турникет.' },
    { id: 'method', n: 'method', s: 'qr · bracelet · partner_code', ok: ['visit'], hint: 'способ, которым клиент прошёл через турникет.' },
    { id: 'cap_room', n: 'capacity', s: 'вместимость зала', ok: [OTHER], hint: 'это свойство помещения, одно на все занятия в нём. Таблицы зала среди корзин нет.' },
    { id: 'tz', n: 'timezone', s: 'часовой пояс клуба', ok: [OTHER], hint: 'пояс — свойство места. Таблицы этого места среди корзин нет.' }
  ];
  const TBL_RELS = [
    { a: 'class_session', b: 'booking', ca: '1', cb: '0..N' },
    { a: 'client', b: 'booking', ca: '1', cb: '0..N' },
    { a: 'client', b: 'visit', ca: '1', cb: '0..N' },
    { a: 'client', b: 'membership', ca: '1', cb: '0..N' },
    { a: 'membership_plan', b: 'membership', ca: '1', cb: '0..N' },
    { a: 'membership', b: 'payment', ca: '0..1', cb: '0..N' },
    { a: 'client', b: 'payment', ca: '1', cb: '0..N' }
  ];
  const ROW0 = ['class_session', 'booking', 'client', 'visit'], ROW1 = ['membership_plan', 'membership', 'payment'];
  const XS = [20, 262, 504, 746], W = 196;

  function tablesER(m, reveal) {
    const attrsOf = id => BASE[id].concat(ATTRS.filter(a => m[a.id] === id).map(a => ({ n: a.n, k: a.k || '', nul: a.nul, tone: reveal && reveal[a.id] ? reveal[a.id] : '' })));
    const h = id => 30 + attrsOf(id).length * 19 + 8;
    const y1 = 20 + Math.max(...ROW0.map(h)) + 56;
    const ents = ROW0.map((id, i) => ({ id, t: id, x: XS[i], y: 20, w: W, attrs: attrsOf(id) }))
      .concat(ROW1.map((id, i) => ({ id, t: id, x: XS[i], y: y1, w: W, attrs: attrsOf(id) })));
    return { entities: ents, rels: TBL_RELS };
  }

  const tablesTask = {
    id: 'tables', title: 'Разложите атрибуты по таблицам',
    simple: {
      icon: '🗂️',
      plain: 'Логическая модель — та же доска сущностей, но у каждой сущности теперь есть точный список полей и ключи.',
      analogy: 'Анкета нового клиента на ресепшене: в ней строго определённые графы. Графу «вместимость зала» в анкету клиента не впишешь — у зала своя карточка.',
      tech: 'Сущность становится таблицей (отношением), атрибут — столбцом. Каждый столбец зависит от ключа своей таблицы, и только от него. Связи выражаются внешними ключами.'
    },
    lead: ui.brief({
      situation: 'Вторник. Из доски сущностей делаем таблицы базы. Таблица — как журнал на ресепшене: каждая строка — одна запись, каждый столбец — одна графа. Перед вами 28 столбцов, например <code>phone</code> — телефон клиента, <code>price_kopecks</code> — цена в прайсе. Надо понять, в какой журнал вписать каждую графу.',
      todo: [
        'Разложите карточки-столбцы по корзинам-таблицам: <code>client</code> — клиенты, <code>booking</code> — записи на занятия, <code>payment</code> — платежи и так далее. Под английским названием столбца — подсказка по-русски.',
        'Столбец про зал или клуб кладите в «Другая таблица»: этих таблиц здесь нет.',
        'Нажмите «Проверить». Засчитывается при 85 % верных. Столбцы с ценой — ключевые: ошибка в них не даст засчитать подход.'
      ],
      lookTitle: 'Как читать схему',
      look: 'Под корзинами — схема «Что получается в базе». Каждый прямоугольник — таблица. В ней уже есть <code>id</code> (номер строки) и столбцы на <code>_id</code> — ссылки на другие таблицы. Ваш столбец появляется в таблице сразу, как вы его положили. Названия похожи нарочно: читайте подпись. После проверки: зелёный — верно, жёлтый — можно и так, красный — не туда.'
    }),
    blank: () => ({ m: {} }),
    reference: () => ({ m: Object.fromEntries(ATTRS.map(a => [a.id, a.ok[0]])) }),
    render(el, ctx) {
      let reveal = null;
      if (ctx.result) {
        reveal = {};
        ATTRS.forEach(a => { const v = ctx.ans.m[a.id]; if (v) reveal[a.id] = a.ok[0] === v ? 'ok' : a.ok.includes(v) ? 'warn' : 'bad'; });
      }
      const sorter = add(el, 'lgc-sort');
      add(el, 'eyebrow', 'Что получается в базе');
      const erEl = add(el, 'lgc-er');
      const other = add(el, 'small muted');
      const cur = Object.assign({}, ctx.ans.m || {});
      const er = ui.er(erEl, Object.assign({ title: 'Таблицы «Пульса» с вашими столбцами' }, tablesER(cur, reveal)));
      const drawOther = m => {
        const o = ATTRS.filter(a => m[a.id] === OTHER);
        other.innerHTML = o.length ? `В других таблицах (на схеме их нет): ${o.map(a => `<code>${esc(a.n)}</code> — ${esc(a.s)}`).join(', ')}.` : '';
      };
      drawOther(cur);
      ui.sort(sorter, {
        items: ATTRS.map(a => ({ id: a.id, t: mono(a.n), sub: esc(a.s) })), buckets: BUCKETS, value: ctx.ans.m, readonly: ctx.readonly, reveal, seed: 'lgc-tables',
        onChange: m => {
          if (reveal) Object.keys(reveal).forEach(k => { if (m[k] !== cur[k]) delete reveal[k]; });
          Object.keys(cur).forEach(k => delete cur[k]); Object.assign(cur, m);
          ctx.save({ m });
          er.redraw(tablesER(cur, reveal));
          drawOther(cur);
        }
      });
    },
    check(ans) {
      const m = (ans && ans.m) || {};
      let pts = 0; const notes = [], miss = []; let critBad = false;
      ATTRS.forEach(a => {
        const v = m[a.id];
        if (!v) { miss.push(a.n); return; }
        if (v === a.ok[0]) pts += 1;
        else if (a.ok.includes(v)) { pts += 0.9; notes.push({ ok: 'warn', html: `<code>${esc(a.n)}</code> (${esc(a.s)}) — засчитано. ${a.why}` }); }
        else { notes.push({ ok: false, html: `<code>${esc(a.n)}</code> (${esc(a.s)}) — ${a.hint}` }); if (a.crit) critBad = true; }
      });
      if (miss.length) notes.unshift({ ok: false, html: `Не разложено: ${miss.map(n => `<code>${esc(n)}</code>`).join(', ')}.` });
      if (critBad) notes.unshift({ ok: false, html: 'Две цены — ключевая ловушка этой модели: без верного ответа про цену подход не засчитывается.' });
      const score = pts / ATTRS.length;
      return { ok: !miss.length && !critBad && score >= 0.85, score, summary: `Разложено верно: ${Math.round(score * 100)}%.`, notes: notes.slice(0, 9) };
    },
    explain: `<p>Проверка для каждого столбца: <b>«что он описывает — и только это?»</b> Если ответ «зал», ему не место в занятии, даже если так удобнее.</p>
      <ul class="checks">
        <li><b>Две цены.</b> <code>price_kopecks</code> в прайсе меняется, <code>price_paid_kopecks</code> в абонементе — никогда. Это два факта.</li>
        <li><b>Две вместимости.</b> Вместимость зала — свойство помещения. Места на занятии — свойство занятия: тренер может ограничить группу. Лимит записи сравнивают с местами занятия.</li>
        <li><b>Защита от повторов живёт рядом с данными.</b> <code>idempotency_key</code> у платежа и <code>turnstile_event_id</code> у посещения: повтор запроса или события находит уже созданную строку, а не создаёт вторую.</li>
        <li><b><code>club_id</code> в занятии</b> — осознанная денормализация ради запроса «расписание клуба на дату». Цена — нужно держать согласованность с залом составным ключом. Об этом подробнее на тренировке про нормализацию.</li>
        <li><b><code>late_cancel</code> у записи</b>, а не у клиента: «2 прогула за 30 дней» считается по записям.</li>
      </ul>`,
    report: ans => BUCKETS.map(b => `- ${strip(b.t)}: ${ATTRS.filter(a => (ans.m || {})[a.id] === b.id).map(a => a.n + (a.ok.includes(b.id) ? '' : ' ✗')).join(', ') || '—'}`).join('\n')
  };

  // ======================================================================
  // Подход 2. Ключи
  // ======================================================================
  const KEY_CHOICES = [
    { v: 'PK', t: 'PK — первичный' },
    { v: 'FK', t: 'FK — внешний' },
    { v: 'UK', t: 'UK — уникальный' },
    { v: 'PKFK', t: 'Составной PK + FK' },
    { v: 'NONE', t: 'Обычный атрибут' }
  ];
  const KEY_T = Object.fromEntries(KEY_CHOICES.map(c => [c.v, c.t]));
  const KEYS = [
    { id: 'c-id', t: 'client.id', s: 'bigint, внутренний номер', ok: 'PK', hint: 'внутренний номер строки. На него ссылаются записи, абонементы, платежи.' },
    { id: 'c-pub', t: 'client.public_id', s: 'uuid, виден в API', ok: 'UK', hint: 'это второй, «внешний» номер клиента. Он обязан быть уникальным, но ссылаются ли на него другие таблицы?' },
    { id: 'c-phone', t: 'client.phone', s: 'номер телефона', ok: 'UK', hint: 'номер уникален (F-client-id). Но человек может сменить номер — годится ли такое поле в первичный ключ, на который ссылаются тысячи строк?' },
    { id: 'c-name', t: 'client.full_name', s: 'ФИО', ok: 'NONE', hint: 'тёзок много: ни уникальности, ни ссылки.' },
    { id: 'c-ref', t: 'client.referred_by_id', s: 'кто привёл', ok: 'FK', hint: 'это ссылка на другую строку той же таблицы.' },
    { id: 'b-sess', t: 'booking.class_session_id', s: 'на какое занятие', ok: 'FK', hint: 'запись указывает на конкретное занятие в другой таблице.' },
    { id: 'tc-tr', t: 'trainer_club.trainer_id', s: 'тренер в паре «тренер + клуб»', ok: 'PKFK', hint: 'у этой таблицы нет своего id: строка — это пара. Что тогда первичный ключ и на что ссылается каждая половина?' },
    { id: 'tc-cl', t: 'trainer_club.club_id', s: 'клуб в паре «тренер + клуб»', ok: 'PKFK', hint: 'это вторая половина пары. Пара целиком не может повториться, а каждая половина куда-то ссылается.' },
    { id: 'p-idem', t: 'payment.idempotency_key', s: 'ключ повтора оплаты', ok: 'UK', hint: 'по этому ключу повторный запрос оплаты находит первый. Может ли один ключ встретиться дважды?' },
    { id: 'p-prov', t: 'payment.provider_payment_id', s: 'номер в ПэйПоинте, пусто до создания', ok: 'UK', hint: 'один платёж ПэйПоинта — одна наша строка. Пустых значений много, но заполненные не повторяются.' },
    { id: 'p-amt', t: 'payment.amount_kopecks', s: 'сумма', ok: 'NONE', hint: 'одинаковых сумм тысячи.' },
    { id: 'pl-code', t: 'membership_plan.code', s: 'код позиции прайса, например NET-12', ok: 'UK', hint: 'по коду вид абонемента находят интеграции и отчёты. Двух одинаковых кодов быть не должно.' },
    { id: 'v-client', t: 'visit.client_id', s: 'кто прошёл', ok: 'FK', hint: 'проход указывает на клиента в другой таблице.' },
    { id: 'cs-start', t: 'class_session.starts_at', s: 'время начала', ok: 'NONE', hint: 'в одно время по сети идут десятки занятий.' }
  ];
  const PUB_Q = {
    q: 'Зачем клиенту два номера: <code>id</code> (bigint) внутри и <code>public_id</code> (uuid) в адресах API?', seed: 'lgc-pub',
    options: [
      { t: 'uuid в адресе нельзя угадать перебором, а компактный bigint удобен для внешних ключей и индексов. Проверка владельца всё равно нужна', ok: 1, why: 'Да. uuid затрудняет перебор, но не заменяет проверку «это ваша запись?» (F-pentest).' },
      { t: 'uuid полностью защищает от доступа к чужим записям', why: 'Нет. uuid может утечь: скриншот, лог, ссылка в чате. Без проверки владельца по нему откроют чужое.' },
      { t: 'uuid быстрее в соединениях таблиц', why: 'Наоборот: uuid занимает 16 байт против 8 у bigint, индексы и внешние ключи на нём тяжелее.' },
      { t: 'Второй номер не нужен: можно показывать наружу id', why: 'Именно так и случилось на старом сайте: поменяли номер в адресе и открыли чужую запись. По росту номеров ещё и видно, сколько записей в сети за день.' }
    ]
  };
  const PEN_NAMES = ['Пётр О.', 'Ольга Т.', 'Сергей М.', 'Анна С.', 'Ирина К.', 'Дмитрий Л.', 'Мария В.', 'Алексей Н.'];
  const PEN_CLS = ['йога 09:00', 'сайкл 19:00', 'пилатес 10:00', 'йога 19:00', 'сайкл 07:30', 'пилатес 18:00', 'йога 08:00', 'сайкл 20:00'];
  function penRows(idMode, ownerCheck) {
    const r = TR.rand('lgc-pen');
    return PEN_NAMES.map((nm, i) => {
      const id = 10481 + i, own = i === 3;
      const path = idMode === 'id' ? `/v1/bookings/${id}` : `/v1/bookings/${Math.floor(r() * 0xffffffff).toString(16).padStart(8, '0')}-…`;
      let res, cls;
      if (idMode === 'uuid') { res = own ? '200 — ваша запись' : '404 — такого адреса нет'; cls = own ? '' : 'ok'; }
      else if (ownerCheck === 'on') { res = own ? '200 — ваша запись' : '404 — не ваша, сервер не признаётся, что она есть'; cls = own ? '' : 'ok'; }
      else { res = own ? '200 — ваша запись' : `200 — чужая: ${nm}, ${PEN_CLS[i]}`; cls = own ? '' : 'bad'; }
      return { path, res, cls };
    });
  }

  const keysTask = {
    id: 'keys', title: 'Ключи',
    simple: {
      icon: '🔑',
      plain: 'Первичный ключ — по нему строку находят однозначно. Внешний ключ — ссылка на строку в другой таблице. Уникальный ключ — запрет на повторы.',
      analogy: 'Номер шкафчика — первичный ключ: по нему находят ровно один шкафчик. Номерок на браслете клиента — внешний ключ: он указывает на шкафчик. А номер телефона в анкете уникален, но шкафчики по нему не ищут.',
      tech: 'PK — уникальный и непустой идентификатор строки. FK — столбец, значения которого обязаны существовать в PK другой (или этой же) таблицы. UK — ограничение уникальности на столбец или набор столбцов. Составной PK — ключ из нескольких столбцов.'
    },
    lead: ui.brief({
      situation: 'Некоторые столбцы работают как номера и ссылки. Шкафчик №17 находят по номеру однозначно. Браслет с цифрой 17 ссылается на этот шкафчик. А на старом сайте «Пульса» нашли дыру: в адресе <code>/bookings/10484</code> меняли номер на 10485 и видели чужую запись на занятие.',
      todo: [
        'В каждой из 14 строк откройте список «Роль столбца…» и выберите. PK — главный номер строки. FK — ссылка на строку другой таблицы. UK — значение не может повториться. «Составной PK + FK» — у строки нет своего номера, её номер — пара ссылок. «Обычный атрибут» — просто данные.',
        'Проведите эксперимент: выберите, что «Наружу показываем» и проверяет ли сервер владельца, и нажмите «Перебрать 8 соседних адресов».',
        'Ответьте на вопрос про два номера клиента.',
        'Нажмите «Проверить». Засчитывается, когда верно не меньше 85 % ролей и ответ на вопрос.'
      ],
      lookTitle: 'Как читать эксперимент',
      look: 'Вы — клиент со своей записью №10484. Таблица показывает 8 запросов к соседним номерам и ответ сервера. Красная строка — вы увидели чужую запись: имя и занятие другого человека. Зелёная — чужое не отдали. Попробуйте все четыре сочетания переключателей и найдите, какое по-настоящему закрывает дыру.'
    }),
    blank: () => ({ m: {}, q: [] }),
    reference: () => ({ m: Object.fromEntries(KEYS.map(k => [k.id, k.ok])), q: [0] }),
    render(el, ctx) {
      let reveal = null;
      if (ctx.result) {
        reveal = {};
        KEYS.forEach(k => { const v = ctx.ans.m[k.id]; if (v) reveal[k.id] = v === k.ok ? { s: 'ok' } : { s: 'bad', why: esc(k.hint.charAt(0).toUpperCase() + k.hint.slice(1)) }; });
      }
      const mEl = add(el, 'lgc-keys');
      ui.match(mEl, {
        rows: KEYS.map(k => ({ id: k.id, t: mono(k.t), sub: esc(k.s) })), choices: KEY_CHOICES, value: ctx.ans.m, readonly: ctx.readonly, reveal, placeholder: 'Роль столбца…',
        onChange: m => { ctx.ans.m = m; ctx.save(); }
      });
      // живой пример: перебор соседних адресов
      const lab = add(el, 'card flat lgc-lab');
      const st = { idm: 'id', own: 'off', run: false };
      const draw = () => {
        const rows = penRows(st.idm, st.own), bad = rows.filter(x => x.cls === 'bad').length;
        lab.innerHTML = `<div class="eyebrow">Эксперимент: вы — любопытный клиент со своей записью №10484</div>
          <div class="row"><span class="small muted">Наружу показываем:</span>${ui.seg('idm', [{ v: 'id', t: 'id (10481, 10482…)' }, { v: 'uuid', t: 'public_id (uuid)' }], st.idm)}</div>
          <div class="row"><span class="small muted">Сервер проверяет владельца:</span>${ui.seg('own', [{ v: 'off', t: 'нет, как на старом сайте' }, { v: 'on', t: 'да' }], st.own)}</div>
          <div><button type="button" class="btn sm primary" data-pen>Перебрать 8 соседних адресов</button></div>
          ${st.run ? ui.table(['Запрос', 'Ответ'], rows.map(x => [`<code>GET ${esc(x.path)}</code>`, esc(x.res)]), { rowClass: (r, i) => rows[i].cls }) + `<div class="lgc-cons ${bad ? 'bad' : st.idm === 'uuid' && st.own === 'off' ? 'warn' : 'ok'}">${bad ? `Открыто чужих записей: ${bad} из 7. Ровно это нашёл пентест (F-pentest).` : st.idm === 'uuid' && st.own === 'off' ? 'Перебор не сработал: uuid не угадать. Но если чужой uuid утечёт — скриншотом или ссылкой в чате, — сервер без проверки владельца отдаст запись.' : st.idm === 'id' ? 'Чужое не открывается. Но по номерам видно, сколько записей в сети за день, а «404» на соседних номерах подтверждает, что они существуют.' : 'Чужое не открыть и не угадать. Так и задумано: uuid наружу плюс проверка владельца.'}</div>` : ''}`;
      };
      draw();
      ui.onSeg(lab, (name, v) => { st[name] = v; draw(); });
      TR.on(lab, 'click', '[data-pen]', () => { st.run = true; draw(); });
      const qEl = add(el, 'card flat');
      ui.quiz(qEl, Object.assign({}, PUB_Q, { value: ctx.ans.q, readonly: ctx.readonly, reveal: ctx.result, onChange: v => { ctx.ans.q = v; ctx.save(); ctx.decide('Зачем public_id', strip(PUB_Q.options[v[0]].t)); } }));
    },
    check(ans) {
      const m = (ans && ans.m) || {};
      let good = 0; const notes = [], miss = [];
      KEYS.forEach(k => {
        const v = m[k.id];
        if (!v) { miss.push(k.t); return; }
        if (v === k.ok) good++; else notes.push({ ok: false, html: `<code>${esc(k.t)}</code> — ${k.hint}` });
      });
      if (miss.length) notes.unshift({ ok: false, html: `Без ответа: ${miss.map(n => `<code>${esc(n)}</code>`).join(', ')}.` });
      const q = ui.quizScore(PUB_Q, (ans && ans.q) || []);
      notes.push({ ok: q.ok, html: q.ok ? 'Вопрос про public_id — верно.' : (ans && ans.q && ans.q.length) ? 'Вопрос про public_id: перечитайте пояснение у выбранного варианта.' : 'Ответьте на вопрос про public_id под экспериментом.' });
      const ms = good / KEYS.length, score = ms * 0.8 + q.score * 0.2;
      return { ok: !miss.length && ms >= 0.85 && q.ok, score, summary: `Ключи: верно ${good} из ${KEYS.length}.`, notes: notes.slice(0, 9) };
    },
    explain: `<p>Первичный ключ выбирают <b>неизменным и бессмысленным</b>: внутренний <code>bigint</code>. Всё «осмысленное» — телефон, код прайса, номер в ПэйПоинте — получает уникальный ключ, но не становится первичным: телефон меняется, а внешние ключи тысяч строк менять никто не будет.</p>
      <ul class="checks">
        <li><b>Составной PK</b> у <code>trainer_club</code>: пара (trainer_id, club_id). Каждая половина — ещё и FK. Своего id таблице не нужно: повтор пары и так запрещён.</li>
        <li><b>Уникальный, но может быть пустым:</b> <code>provider_payment_id</code> пуст, пока платёж не создан в ПэйПоинте. В PostgreSQL UNIQUE не мешает многим NULL.</li>
        <li><b>Два номера клиента.</b> <code>id</code> — для внешних ключей внутри базы, <code>public_id</code> (uuid, RFC 9562) — для адресов API. uuid мешает перебору, но защиту даёт только проверка владельца на каждом запросе.</li>
      </ul>`,
    report: ans => KEYS.map(k => `- ${k.t}: ${KEY_T[(ans.m || {})[k.id]] || '—'}${(ans.m || {})[k.id] && (ans.m || {})[k.id] !== k.ok ? ' ✗' : ''}`).join('\n') + `\n- Зачем public_id: ${(ans.q || []).length ? strip(PUB_Q.options[ans.q[0]].t) : '—'}`
  };

  // ======================================================================
  // Подход 3. Время и деньги
  // ======================================================================
  const TM_Q = [
    {
      q: 'Как хранить время начала занятия, если клубы есть в Москве, Казани и Екатеринбурге?', seed: 'lgc-tm-1',
      options: [
        { t: 'Момент времени с поясом (<code>timestamptz</code>), а показывать в часовом поясе клуба', ok: 1, why: 'Да. Момент один для всех серверов и телефонов, а «09:00» получается переводом в пояс клуба.' },
        { t: 'Местное время без пояса (<code>timestamp</code>): администратор и так знает, где клуб', why: 'Администратор знает, а сервер — нет. Сервер прочтёт «09:00» в своём поясе и ошибётся на 2 часа.' },
        { t: 'Строкой «09:00» и датой отдельно', why: 'По строке нельзя посчитать «за 2 часа до начала» и сравнить с моментом отмены. И пояса в ней всё равно нет.' },
        { t: 'Всё по московскому времени без пометки', why: 'Работает, пока все серверы в Москве. Облако часто живёт в UTC — и всё расписание съедет на 3 часа.' }
      ]
    },
    {
      q: 'Где хранить часовой пояс?', seed: 'lgc-tm-2',
      options: [
        { t: 'В клубе: <code>timezone = \'Asia/Yekaterinburg\'</code>', ok: 1, why: 'Да. Пояс — свойство места. Имя пояса из базы IANA, а не «+5»: так правила переходов на летнее время, если их введут, учтутся сами.' },
        { t: 'В каждом занятии', why: 'Занятие всегда идёт в клубе, пояс повторится в тысячах строк и однажды разойдётся с клубом.' },
        { t: 'У клиента', why: 'Клиент из Москвы приехал в Екатеринбург — занятие от этого не сдвинулось. Время занятия привязано к клубу.' },
        { t: 'Нигде: при timestamptz пояс не нужен', why: 'Момент хранить можно, но чтобы показать «09:00» и посчитать границы дня для отчёта, нужен пояс клуба.' }
      ]
    },
    {
      q: 'Как хранить суммы денег?', seed: 'lgc-tm-3',
      options: [
        { t: 'Целым числом копеек (<code>bigint</code>): 54 000 ₽ = 5 400 000', ok: 1, why: 'Да, это эталон. Целые складываются и сравниваются без ошибок, и суммы передаются между системами без округлений.' },
        { t: 'Точным десятичным типом <code>numeric(12,2)</code>', ok: 1, why: 'Тоже точный тип, рабочий вариант. В эталоне «Пульса» — копейки: так проще в API и в обмене с другими системами.' },
        { t: 'Числом с плавающей точкой (<code>float</code>) в рублях', why: '0,1 + 0,2 ≠ 0,3. Посмотрите в эксперимент выше: копейка теряется уже на трёх платежах.' },
        { t: 'Строкой «54 000,00 ₽»', why: 'Строки не складываются, а формат с пробелами и запятой у каждой системы свой.' }
      ]
    },
    {
      q: 'Директор просит «выручку клуба в Екатеринбурге за 1 октября». По какому времени считать границы дня?', seed: 'lgc-tm-4',
      options: [
        { t: 'С 00:00 до 24:00 по времени Екатеринбурга', ok: 1, why: 'Да. День клуба — местный день. Иначе ночные оплаты попадут не в те сутки.' },
        { t: 'С 00:00 до 24:00 по Москве', why: 'Тогда оплата в 23:30 по Екатеринбургу (21:30 МСК) уйдёт в правильный день, а оплата в 01:00 по Екатеринбургу (23:00 МСК) — в предыдущий.' },
        { t: 'С 00:00 до 24:00 по UTC', why: 'Для Екатеринбурга это 05:00–05:00 местного: ранние утренние оплаты попадут во вчерашний день.' }
      ]
    }
  ];
  // занятие 09:00 по Екатеринбургу (UTC+5) = 04:00 UTC
  const pad = n => String(n).padStart(2, '0');
  const hh = h => pad(((h % 24) + 24) % 24) + ':00';
  function timeRows(store, srv) {
    const S = srv === 'msk' ? 3 : 0, SN = srv === 'msk' ? 'МСК' : 'UTC';
    if (store === 'tz') {
      return { rows: [
        ['Что лежит в базе', '<code>2026-10-12 04:00:00+00</code> — момент', ''],
        [`Как видит сервер (${SN})`, `${hh(4 + S)} ${SN} — тот же момент`, 'ok'],
        ['Что увидит клиент в приложении', '09:00 по времени клуба', 'ok'],
        ['Бесплатная отмена — до', '07:00 по времени клуба', 'ok']
      ], cons: ['ok', 'Где бы ни стоял сервер, момент один. Приложение переводит его в пояс клуба — Asia/Yekaterinburg.'] };
    }
    const startUtc = 9 - S, local = startUtc + 5;
    return { rows: [
      ['Что лежит в базе', '<code>2026-10-12 09:00</code> — без пояса', ''],
      [`Как видит сервер (${SN})`, `09:00 ${SN} — считает, что это его время`, 'bad'],
      ['Что увидит клиент в приложении', `${hh(local)} — на ${local - 9} ч позже`, 'bad'],
      ['Бесплатная отмена — до', `${hh(local - 2)} по Екатеринбургу${local - 2 > 9 ? ' — уже после начала занятия' : local - 2 === 9 ? ' — то есть до самого начала' : ''}`, 'bad']
    ], cons: ['bad', srv === 'msk' ? 'Сервер в Москве принял «09:00» за московское. Клиент придёт к закрытой двери и сможет отменить запись бесплатно до самого начала.' : 'Сервер переехал в облако с UTC — и всё расписание съехало ещё на 3 часа. Код никто не менял.'] };
  }
  function moneyRows(kind, n) {
    if (kind === 'kop') {
      const sum = 129010 * n;
      return { sum: `<code>${sum}</code> копеек`, rub: TR.fmtRub(sum), ok: true };
    }
    let s = 0; for (let i = 0; i < n; i++) s += 1290.1;
    const cut = Math.floor(s * 100);
    return { sum: `<code>${s}</code> ₽`, rub: TR.fmtRub(cut), ok: cut === 129010 * n };
  }

  const tmTask = {
    id: 'timemoney', title: 'Время и деньги',
    simple: {
      icon: '🕘',
      plain: 'Время храним как момент, который одинаков для всего мира, а «09:00» получаем, переводя его в пояс клуба. Деньги храним целыми копейками.',
      analogy: 'Созвон в «09:00» без указания города — кто-то придёт на два часа раньше. Пишут «09:00 по Екатеринбургу». С деньгами — как на кассе: копейки считают поштучно, а не «примерно 0,3 рубля».',
      tech: '<code>timestamptz</code> хранит момент (в UTC), при выводе переводится в нужный пояс; пояс клуба — имя IANA (<code>Asia/Yekaterinburg</code>). Деньги — <code>bigint</code> в копейках или <code>numeric</code>; <code>float</code> хранит двоичное приближение и копит ошибку.'
    },
    lead: ui.brief({
      situation: 'Через год у «Пульса» клубы в Казани (там то же время, что в Москве) и Екатеринбурге (на 2 часа впереди). Йога в Екатеринбурге в 09:00 по местному — это 07:00 по Москве. Сервер стоит в Москве или в облаке, где часы идут по UTC — мировому времени, на 3 часа позади Москвы. И деньги: оплаты по 1 290,10 ₽ уходят в 1С бухгалтерии, итог должен сойтись до копейки.',
      todo: [
        'Эксперимент 1: переключайте «Тип столбца» (время без пояса или момент с поясом) и «Где сервер». Смотрите, во сколько клиент увидит занятие.',
        'Эксперимент 2: переключайте «Тип суммы» (<code>float</code> — дробное число рублей, <code>bigint</code> — целое число копеек) и «Сколько оплат».',
        'Ответьте на четыре вопроса ниже и нажмите «Проверить». Засчитывается, когда верны вопросы про время и про деньги и всего не меньше трёх из четырёх.'
      ],
      lookTitle: 'Как читать эксперименты',
      look: 'В каждом эксперименте — таблица «Результат». Красная строка — система ошиблась: клиент увидел не то время или сумма не сошлась с выпиской ПэйПоинта. Зелёная — всё совпало. Под таблицей написано, чем это кончится в жизни. Найдите настройки, при которых всё зелёное, — это и подсказка к вопросам.'
    }),
    blank: () => ({ a: [], b: [], c: [], d: [] }),
    reference: () => ({ a: [0], b: [0], c: [0], d: [0] }),
    render(el, ctx) {
      const st = { store: 'naive', srv: 'msk', money: 'float', n: '3' };
      const lab = add(el, 'card flat lgc-lab');
      const draw = () => {
        const T = timeRows(st.store, st.srv), M = moneyRows(st.money, +st.n);
        lab.innerHTML = `<div class="eyebrow">Эксперимент 1 · йога 09:00 в клубе в Екатеринбурге (UTC+5)</div>
          <div class="row"><span class="small muted">Тип столбца:</span>${ui.seg('store', [{ v: 'naive', t: 'время без пояса' }, { v: 'tz', t: 'момент с поясом' }], st.store)}</div>
          <div class="row"><span class="small muted">Где сервер:</span>${ui.seg('srv', [{ v: 'msk', t: 'в Москве' }, { v: 'utc', t: 'в облаке, UTC' }], st.srv)}</div>
          ${ui.table(['', 'Результат'], T.rows.map(r => [r[0], r[1]]), { rowClass: (r, i) => T.rows[i][2] })}
          <div class="lgc-cons ${T.cons[0]}">${T.cons[1]}</div>
          <div class="eyebrow" style="margin-top:8px">Эксперимент 2 · оплаты по 1 290,10 ₽, сверка с 1С</div>
          <div class="row"><span class="small muted">Тип суммы:</span>${ui.seg('money', [{ v: 'float', t: 'float, рубли' }, { v: 'kop', t: 'bigint, копейки' }], st.money)}</div>
          <div class="row"><span class="small muted">Сколько оплат:</span>${ui.seg('n', [{ v: '3', t: '3' }, { v: '300', t: '300' }], st.n)}</div>
          ${ui.table(['', 'Результат'], [['Сумма в программе', M.sum], ['Обрезали до копеек для выгрузки в 1С', M.rub], ['По выписке ПэйПоинта', TR.fmtRub(129010 * +st.n)]], { rowClass: (r, i) => i === 1 ? (M.ok ? 'ok' : 'bad') : '' })}
          <div class="lgc-cons ${M.ok ? 'ok' : 'bad'}">${M.ok ? 'Копейка в копейку: целые числа складываются точно.' : 'Компьютер хранит 1290,1 приближённо. Сумма вышла чуть меньше, обрезка до копеек потеряла копейку — сверка с 1С не сходится.'}</div>`;
      };
      draw();
      ui.onSeg(lab, (name, v) => { st[name] = v; draw(); });
      ['a', 'b', 'c', 'd'].forEach((k, i) => {
        const d = add(el, 'card flat');
        ui.quiz(d, Object.assign({}, TM_Q[i], { value: ctx.ans[k], readonly: ctx.readonly, reveal: ctx.result, onChange: v => { ctx.ans[k] = v; ctx.save(); if (i < 3) ctx.decide(['Как хранить время', 'Где часовой пояс', 'Как хранить деньги'][i], strip(TM_Q[i].options[v[0]].t)); } }));
      });
    },
    check(ans) {
      const r = ['a', 'b', 'c', 'd'].map((k, i) => ui.quizScore(TM_Q[i], (ans && ans[k]) || []));
      const good = r.filter(x => x.ok).length, score = good / 4;
      const names = ['Время начала занятия', 'Где часовой пояс', 'Как хранить деньги', 'Границы дня в отчёте'];
      const notes = r.map((x, i) => ({ ok: x.ok, html: `${names[i]}: ${x.ok ? 'верно.' : (ans && ans[['a', 'b', 'c', 'd'][i]] || []).length ? 'не то. Перечитайте пояснение у варианта и вернитесь к эксперименту.' : 'нет ответа.'}` }));
      if (ans && ans.c && ans.c[0] === 1) notes.push({ ok: 'info', html: '<code>numeric</code> засчитан: тип точный. В эталоне — целые копейки.' });
      return { ok: r[0].ok && r[2].ok && good >= 3, score, notes };
    },
    explain: `<p><b>Время:</b> хранить момент, показывать в поясе клуба. Тип без пояса работает ровно до первого клуба в другом городе или до переезда сервера в облако. Пояс — свойство клуба, имя из базы IANA. В API время отдаём в ISO 8601 со смещением: <code>2026-10-12T09:00:00+05:00</code>.</p>
      <p><b>Деньги:</b> целые копейки. <code>float</code> не умеет точно хранить 0,1 — ошибка маленькая, но копится и вылезает в сверке с 1С и ПэйПоинтом. Округлять нужно один раз и по правилу, записанному в требованиях: например, возврат «минус 10 %» — до копейки вниз.</p>
      <p>Обе ошибки не видны на тестовом стенде в Москве. Они всплывают в день открытия клуба в Екатеринбурге и в первую сверку месяца.</p>`,
    report: ans => TM_Q.map((q, i) => { const v = (ans[['a', 'b', 'c', 'd'][i]] || [])[0]; return `- ${strip(q.q)} → ${v != null ? strip(q.options[v].t) : '—'}`; }).join('\n')
  };

  // ======================================================================
  // Подход 4. Исключающая дуга
  // ======================================================================
  const ARC_Q = {
    q: 'Платёж бывает за абонемент ИЛИ за персональную тренировку — ровно за одно. Как это устроить в таблице <code>payment</code>?', seed: 'lgc-arc', shuffle: false,
    options: [
      { t: 'Два внешних ключа, оба могут быть пустыми, + проверка «заполнен ровно один»', ok: 1, why: 'Эталон. База сама гарантирует и существование покупки, и «ровно одно».' },
      { t: 'Два внешних ключа, оба могут быть пустыми, без дополнительной проверки', why: 'База примет платёж «ни за что» и платёж «сразу за всё». Правило останется только в коде — до первой ошибки.' },
      { t: 'Одно поле <code>item_id</code> и поле <code>item_type</code> = membership | personal_session, без внешнего ключа', why: 'Внешний ключ не может смотреть в две таблицы, поэтому его нет совсем. База примет платёж за несуществующий абонемент и позволит удалить оплаченную тренировку.' },
      { t: 'Общая таблица «заказ»: платёж ссылается на заказ, а абонемент и тренировка — на свой заказ', ok: 1, why: 'Рабочий вариант, если видов покупок станет много (товары бара, аренда шкафчика). Для двух видов — лишняя таблица и лишнее соединение в каждом запросе.' }
    ]
  };
  const ARC_SQL = [
    `CREATE TABLE payment (
  id                  bigint PRIMARY KEY,
  membership_id       bigint REFERENCES membership(id),
  personal_session_id bigint REFERENCES personal_session(id),
  amount_kopecks      bigint NOT NULL,
  [[ok]]CHECK (num_nonnulls(membership_id, personal_session_id) = 1)[[/]]
);`,
    `CREATE TABLE payment (
  id                  bigint PRIMARY KEY,
  membership_id       bigint REFERENCES membership(id),
  personal_session_id bigint REFERENCES personal_session(id),
  amount_kopecks      bigint NOT NULL
  [[bad]]-- «ровно одно» нигде не проверяется[[/]]
);`,
    `CREATE TABLE payment (
  id              bigint PRIMARY KEY,
  [[bad]]item_id         bigint NOT NULL,       -- без REFERENCES[[/]]
  item_type       text NOT NULL CHECK (item_type IN ('membership','personal_session')),
  amount_kopecks  bigint NOT NULL
);`,
    `CREATE TABLE purchase (id bigint PRIMARY KEY, kind text NOT NULL);
CREATE TABLE payment (
  id              bigint PRIMARY KEY,
  purchase_id     bigint NOT NULL REFERENCES purchase(id),
  amount_kopecks  bigint NOT NULL
);
-- membership.purchase_id и personal_session.purchase_id: UNIQUE REFERENCES purchase(id)`
  ];
  const ATTEMPTS = ['Платёж 54 000 ₽ за существующий абонемент', 'Платёж ни за что: обе ссылки пустые', 'Платёж сразу за абонемент и за тренировку', 'Платёж за абонемент №999999, которого нет', 'Удалить персональную тренировку, у которой есть платёж'];
  // что ответит база: [a — принято/отклонено, правильно ли это]
  const ARC_RES = [
    [['принят', 1], ['отклонён: CHECK', 1], ['отклонён: CHECK', 1], ['отклонён: FK', 1], ['отклонено: FK', 1]],
    [['принят', 1], ['принят', 0], ['принят', 0], ['отклонён: FK', 1], ['отклонено: FK', 1]],
    [['принят', 1], ['отклонён: NOT NULL', 1], ['не выразить: одно поле', 1], ['принят', 0], ['удалено, платёж «висит»', 0]],
    [['принят', 1], ['отклонён: NOT NULL', 1], ['зависит от проверок в заказе', 'w'], ['отклонён: FK', 1], ['отклонено: FK', 1]]
  ];
  const ARC_REF = 'Выбираю два внешних ключа (membership_id и personal_session_id, оба nullable) и проверку CHECK (num_nonnulls(membership_id, personal_session_id) = 1). Внешние ключи гарантируют, что платят за существующую покупку и что оплаченную тренировку нельзя удалить. CHECK гарантирует «ровно одно». Вариант item_id + item_type не даёт внешнего ключа: база примет платёж за несуществующий абонемент, а после удаления тренировки платёж повиснет — для денег, которые храним 5 лет, это недопустимо. Общая таблица «заказ» оправдана, когда видов покупок станет много; для двух видов это лишняя сложность.';
  const ARC_RUBRIC = [
    'Назван выбранный вариант (два FK + CHECK «ровно один» или общая таблица заказа)',
    'Внешний ключ гарантирует существование покупки и не даёт удалить оплаченное',
    'Проверка «ровно один» не даёт платежа «ни за что» и «за всё сразу»',
    'item_id + item_type без FK: база не проверяет ссылку, возможны висячие платежи',
    'Учтены деньги и хранение 5 лет (F-no-loss) или рост числа видов покупок'
  ];

  const arcTask = {
    id: 'arc', title: 'Исключающая дуга',
    simple: {
      icon: '🔀',
      plain: 'Иногда строка должна ссылаться на одно из двух — но строго на одно. Это правило надо поручить базе, а не памяти программиста.',
      analogy: 'Чек на ресепшене выбивают либо за абонемент, либо за персональную тренировку. Чек «ни за что» или «за всё сразу» кассир не пробьёт — касса не даст.',
      tech: 'Исключающая дуга (exclusive arc): несколько необязательных связей, из которых заполнена ровно одна. Классическая реализация — nullable FK на каждую цель + <code>CHECK (num_nonnulls(…) = 1)</code>.'
    },
    lead: ui.brief({
      situation: 'Клиент платит либо за абонемент (например, «Сеть 12 мес» за 54 000 ₽), либо за персональную тренировку с тренером. Строго за что-то одно. Платёж «ни за что» или «сразу за всё» — ошибка, которую потом не разберёт бухгалтерия. Правило «одно из двух, но ровно одно» называют исключающей дугой.',
      todo: [
        'Выберите один из четырёх вариантов устройства таблицы <code>payment</code> (платежи).',
        'Под выбором появятся код таблицы и «Пять попыток — что сделает база». Посмотрите, какие ошибки база пропустит.',
        'Ниже своими словами объясните выбор и чем плох вариант <code>item_id</code> + <code>item_type</code>. Нажмите «Проверить с Верой (Claude)» или «Сверить с эталоном самому».',
        'Нажмите «Проверить». Засчитывается подходящий вариант и обоснование на 60 % и выше.'
      ],
      lookTitle: 'Как читать попытки',
      look: 'Пять попыток — пять действий с базой: обычный платёж, платёж ни за что, сразу за всё, за абонемент, которого нет, и удаление оплаченного абонемента. Зелёная строка — база поступила правильно. Красная — пропустила ошибку: ловить её придётся в программе, и однажды не поймают. Код читать не обязательно — смотрите на цвет строк.'
    }),
    blank: () => ({ q: [], j: {} }),
    reference: () => ({ q: [0], j: { text: ARC_REF, self: ARC_RUBRIC.map(() => true) } }),
    render(el, ctx) {
      const qEl = add(el, 'card flat'), lab = add(el, 'stack tight');
      const drawLab = v => {
        const i = v && v.length ? v[0] : null;
        if (i == null) { lab.innerHTML = '<div class="lgc-cons">Выберите вариант — здесь появится его SQL и то, что база сделает с пятью попытками.</div>'; return; }
        const res = ARC_RES[i];
        const badN = res.filter(x => x[1] === 0).length;
        lab.innerHTML = `<div class="eyebrow">Ваш вариант в SQL</div>${ui.code(ARC_SQL[i], 'sql')}
          <div class="eyebrow">Пять попыток — что сделает база</div>
          ${ui.table(['Попытка', 'База'], ATTEMPTS.map((a, k) => [esc(a), esc(res[k][0])]), { rowClass: (r, k) => res[k][1] === 1 ? 'ok' : res[k][1] === 0 ? 'bad' : '' })}
          <div class="lgc-cons ${badN ? 'bad' : i === 3 ? 'warn' : 'ok'}">${badN ? `База пропустила ${badN} ${TR.plural(badN, 'ошибку', 'ошибки', 'ошибок')}. Их придётся ловить в коде — и однажды не поймать.` : i === 3 ? 'База защищена, но правило «ровно одна покупка на заказ» переехало в таблицу заказа. Для двух видов покупок — лишний слой.' : 'Все пять попыток обработаны верно, и всё — силами базы.'}</div>`;
      };
      ui.quiz(qEl, Object.assign({}, ARC_Q, { value: ctx.ans.q, readonly: ctx.readonly, reveal: ctx.result, onChange: v => { ctx.ans.q = v; ctx.save(); drawLab(v); ctx.decide('Платёж за абонемент ИЛИ тренировку', strip(ARC_Q.options[v[0]].t)); } }));
      drawLab(ctx.ans.q);
      const j = add(el);
      ui.justify(j, {
        id: 'lgc-arc', q: 'Почему вы выбрали этот вариант и чем плох <code>item_id</code> + <code>item_type</code>?', qPlain: 'Почему вы выбрали этот вариант устройства платежа (за абонемент или за персональную тренировку) и чем плох item_id + item_type без внешнего ключа?',
        rubric: ARC_RUBRIC, reference: ARC_REF, value: ctx.ans.j, readonly: ctx.readonly, minLen: 80,
        onChange: v => { ctx.ans.j = v; ctx.save(); ctx.decide('Обоснование исключающей дуги', v.text || ''); }
      });
    },
    check(ans) {
      const v = ((ans && ans.q) || [])[0];
      const qs = v === 0 ? 1 : v === 3 ? 0.8 : 0;
      const js = ui.justifyScore(ans && ans.j);
      const notes = [];
      if (v == null) notes.push({ ok: false, html: 'Выберите вариант устройства таблицы.' });
      else if (v === 0) notes.push({ ok: true, html: 'Вариант: два FK + проверка «ровно один» — эталон.' });
      else if (v === 3) notes.push({ ok: 'warn', html: 'Общая таблица заказа — засчитано. Для двух видов покупок она избыточна; оправдана, когда видов станет много.' });
      else notes.push({ ok: false, html: 'Посмотрите таблицу попыток под вариантом: какие ошибки база пропустила? Правило «ровно одна покупка, и она существует» должно держать хранилище.' });
      if (!js) notes.push({ ok: false, html: 'Напишите обоснование (от 80 символов) и проверьте его с Верой или сверьте с эталоном.' });
      else if (js < 0.6) notes.push({ ok: false, html: 'Обоснование пока слабое: что именно гарантирует внешний ключ и чего не гарантирует item_type?' });
      const score = qs * 0.5 + js * 0.5;
      return { ok: qs >= 0.8 && js >= 0.6, score, notes };
    },
    explain: `<p>Главная мысль: <b>правило о деньгах должна держать база.</b> Код пишут четыре бэкендера, интеграции пишут в базу из трёх мест — кто-нибудь однажды забудет проверку.</p>
      <ul class="checks">
        <li><b>Два FK + CHECK</b> — просто, проверяемо, видно в схеме. <code>num_nonnulls</code> есть в PostgreSQL; в других базах то же пишут через <code>(a IS NULL) &lt;&gt; (b IS NULL)</code>.</li>
        <li><b>item_id + item_type</b> («полиморфная ссылка») популярна в ORM, но у базы нет внешнего ключа, а значит — нет гарантий. Платежи храним 5 лет: висячая ссылка в 2031 году никому не объяснит, за что платили.</li>
        <li><b>Общий «заказ»</b> — правильное направление, если появятся товары бара или аренда шкафчика. Тогда переход — отдельная миграция, а не переписывание с нуля.</li>
      </ul>`,
    report: ans => `- Вариант: ${(ans.q || []).length ? strip(ARC_Q.options[ans.q[0]].t) : '—'}\n- Обоснование: ${(ans.j && ans.j.text) || '—'}`
  };

  // ======================================================================
  TR.stage({
    id: 'logical', act: 2, order: 40, slot: 'Вт 10:00', title: 'Логическая модель',
    when: 'вторник, 10:00 · переговорная «Сайкл» · ноутбук и проектор',
    intro: [
      { who: 'vera', html: 'Вчерашняя доска превращается в таблицы. Теперь у каждой сущности точный список полей, ключи и типы. Здесь живут самые дорогие ошибки: две цены, время без пояса, деньги в дробях.' },
      { who: 'timur', html: '«Мои ребята возьмут вашу схему и сразу напишут миграции. Если в ней будет float для денег — я узнаю об этом от Ирины в конце месяца».' },
      { who: 'ira', html: '«И пожалуйста, чтобы выгрузка в 1С сходилась до копейки. В прошлом году неделю искали 3 рубля».' }
    ],
    facts: ['F-price-change', 'F-capacity', 'F-clubs', 'F-money', 'F-pentest', 'F-no-loss', 'F-offline', 'F-1c-dup', 'F-pt'],
    glossary: [
      { term: 'Логическая модель', simple: 'Доска сущностей, расписанная до полей: в каждой карточке точный список граф и ключи.', tech: 'Таблицы (отношения), столбцы, первичные и внешние ключи, ограничения — без привязки к конкретной СУБД и её настройкам.' },
      { term: 'Первичный ключ (PK)', simple: 'Номер шкафчика: по нему находят ровно один шкафчик, и номер не меняется.', tech: 'Уникальный непустой идентификатор строки. В «Пульсе» — внутренний bigint id.' },
      { term: 'Внешний ключ (FK)', simple: 'Номерок на браслете, который указывает на конкретный шкафчик. Номерок на несуществующий шкафчик выдать нельзя.', tech: 'Столбец, значение которого обязано существовать в ключе другой (или этой же) таблицы. Защищает от висячих ссылок и удаления нужного.' },
      { term: 'Уникальный ключ (UK)', simple: 'Запрет на повторы: два клиента с одним телефоном не зарегистрируются.', tech: 'Ограничение UNIQUE на столбец или набор столбцов. Не обязан быть первичным; в PostgreSQL допускает много NULL.' },
      { term: 'Составной ключ', simple: 'Ключ из двух частей, как «ряд + место» в зале: по отдельности повторяются, вместе — нет.', tech: 'PK или UK из нескольких столбцов: trainer_club (trainer_id, club_id).' },
      { term: 'timestamptz', simple: 'Время, записанное как единый для всего мира момент. «09:00 в Екатеринбурге» и «07:00 в Москве» — один и тот же момент.', tech: 'Тип PostgreSQL: хранит момент в UTC, при выводе переводит в пояс сессии. Пояс клуба — имя IANA, например Asia/Yekaterinburg.' },
      { term: 'Деньги в копейках', simple: 'Считаем деньги целыми копейками, как кассир монеты, — без «примерно».', tech: 'bigint в минимальных единицах валюты (или numeric). float хранит двоичное приближение: 0,1 + 0,2 ≠ 0,3.' },
      { term: 'Исключающая дуга', simple: 'Ссылка на одно из двух — строго на одно. Чек либо за абонемент, либо за тренировку.', tech: 'Несколько nullable FK + CHECK (num_nonnulls(…) = 1). Альтернатива — общая таблица-супертип («заказ»).' }
    ],
    outro: 'Схема обрела ключи, типы и правила. Две цены, две вместимости, момент с поясом, копейки, uuid наружу и дуга с проверкой — каждое из этих решений закрывает конкретный факт из блокнота. Завтра откроем Excel предшественника и посмотрим, что бывает без всего этого.',
    tasks: [tablesTask, keysTask, tmTask, arcTask]
  });
})();
