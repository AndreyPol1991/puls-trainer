/* Неделя 6, четверг 10:00: саги. Канон — _dev/DOMAIN-2.md §5 (сага «Покупка абонемента с бонусами», оркестратор «Продажи»,
   таблица saga_purchase, отказ от 2PC) и §8 инцидент 8.
   Теория (живая): почему не одна транзакция и не 2PC; сага = локальные шаги + компенсации на соседнем примере (бронь
   персональной тренировки, «сбой на шаге N»); дедлайны шагов, зависшие саги, идемпотентность шагов и компенсаций;
   оркестрация против хореографии на одной схеме.
   Практика: шаги саги покупки и компенсации; лаборатория «сбой на любом шаге» (деньги / абонемент / бонусы);
   оркестрация или хореография для трёх процессов «Пульса»; таблица saga_purchase своими словами. */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc;
  const ID = 'arch-saga';

  if (!document.getElementById('asg-css')) document.head.insertAdjacentHTML('beforeend', `<style id="asg-css">
    .asg-root, .asg-root .stack, .asg-root .stack > * { min-width: 0; }
    .asg-root :not(pre) > code { white-space: normal; overflow-wrap: anywhere; }
    .asg-root .seg button { white-space: normal; text-align: left; }
    .asg-box { display: grid; gap: 12px; padding: 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); min-width: 0; }
    .asg-box > * { min-width: 0; }
    .asg-set { display: grid; grid-template-columns: minmax(0, 190px) minmax(0, 1fr); gap: 8px 14px; align-items: center; }
    .asg-set > .lbl { font-size: 13.5px; color: var(--text-2); min-width: 0; }
    .asg-set > .seg { justify-self: start; max-width: 100%; }
    .asg-set .seg button:disabled, .asg-acts .chip:disabled { opacity: .5; cursor: not-allowed; }
    .asg-state { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .asg-state .stat { min-width: 0; }
    .asg-state .v { font-size: 15px; line-height: 1.3; overflow-wrap: anywhere; }
    .asg-sub { display: flex; gap: 10px; align-items: center; font-weight: 700; font-size: 15px; margin-top: 6px; }
    .asg-sub .l { display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--accent); color: var(--bg); font: 700 12px/1 var(--f-mono); flex: none; }
    .asg-lock { display: grid; grid-template-columns: minmax(0, 210px) minmax(0, 1fr) 90px; gap: 10px; align-items: center; font-size: 13px; }
    .asg-lock .bar { position: relative; height: 14px; border-radius: 7px; background: var(--surface-3); overflow: hidden; }
    .asg-lock .bar i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 7px; }
    .asg-lock .t { font: 600 12px/1.2 var(--f-mono); text-align: right; }
    .asg-acts { display: flex; flex-wrap: wrap; gap: 8px; }
    .asg-acts .chip { white-space: normal; text-align: left; font-size: 13px; }
    .asg-btns { display: flex; flex-wrap: wrap; gap: 8px; }
    .asg-btns .btn { white-space: normal; }
    .asg-log { font: 12.5px/1.6 var(--f-mono); background: var(--code-bg); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; max-height: 180px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; }
    .asg-log .ok { color: var(--ok); } .asg-log .bad { color: var(--bad); } .asg-log .warn { color: var(--warn); } .asg-log .dim { color: var(--text-muted); }
    .asg-procs { display: grid; gap: 14px; }
    .asg-proc { display: grid; gap: 10px; }
    .asg-proc h4 { margin: 0; font-size: 15px; }
    .asg-row td, .asg-row th { font-size: 12.5px; }
    .asg-row td:first-child { font-family: var(--f-mono); color: var(--text-2); white-space: nowrap; }
    .asg-mx td { font-size: 12.5px; vertical-align: top; }
    .asg-cmp td.cur { background: color-mix(in srgb, var(--accent) 12%, transparent); }
    .asg-cmp th.cur { color: var(--accent); }
    .asg-dry { font-size: 13.5px; }
    @media (max-width: 640px) {
      .asg-set { grid-template-columns: minmax(0, 1fr); gap: 4px; }
      .asg-set > .lbl { margin-top: 8px; }
      .asg-state { grid-template-columns: minmax(0, 1fr); }
      .asg-lock { grid-template-columns: minmax(0, 1fr) 80px; }
      .asg-lock .bar { grid-column: 1 / -1; grid-row: 2; }
    }
  </style>`);

  const L = (id, t, sub) => ({ id, t, sub });
  const mount = (el, cls) => { const d = document.createElement('div'); if (cls) d.className = cls; el.appendChild(d); return d; };
  const strip = s => String(s == null ? '' : s).replace(/<[^>]+>/g, '');
  const lock = (el, ro) => { if (ro) TR.$$('[data-seg] button', el).forEach(b => { b.disabled = true; }); };
  const stat = (k, v, kind, s) => `<div class="stat"><div class="k">${k}</div><div class="v ${kind || ''}">${v}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`;

  // =====================================================================
  // Теория 1. Почему не одна транзакция — и как устроена сага
  // =====================================================================
  const WAYS = [{ v: 'one', t: 'Одна транзакция на всё' }, { v: '2pc', t: 'Двухфазная фиксация (2PC)' }, { v: 'saga', t: 'Сага: шаги + компенсации' }];
  const DS = [{ v: '10', t: '10 секунд' }, { v: '40', t: '40 секунд' }, { v: '180', t: '3 минуты — ушла искать телефон' }];
  function wayView(way, ds) {
    const sec = +ds;
    if (way === 'one') return {
      can: ['нет', 'bad'], lock: 0, lockT: '—', wait: ['—', ''],
      note: ui.note('bad', 'Так не бывает', 'Транзакция PostgreSQL (<code>BEGIN … COMMIT</code>) живёт внутри <b>одной</b> базы. У «Бонусов» своя база (ADR-007), а ПэйПоинт — чужая система за интернетом. Общего «сохранить всё или ничего» на троих нет. Внутри ядра «Абонементы» и «Платежи» могут писать в одной транзакции — но бонусы и деньги в ПэйПоинте ею не накрыть.')
    };
    if (way === '2pc') return {
      can: ['нет', 'bad'], lock: sec, lockT: sec + ' с', wait: ['все операции со счётом Анны', 'bad'],
      note: ui.note('bad', 'Двухфазная фиксация: «все готовы? — фиксируем!»', `Координатор говорит всем: «подготовьтесь». Каждый участник блокирует свои строки и ждёт команды «фиксируем». Пока Анна вводит код 3-D Secure (у вас — ${esc(DS.find(d => d.v === ds).t)}), заблокированы её абонемент и бонусный счёт: начисление +10 за посещение, покупка персональной тренировки, администратор на ресепшене — все ждут. Упал координатор между фазами — участники висят «в сомнении» с блокировками. А главное: <b>ПэйПоинт фазу «подготовься» не поддерживает</b> — он либо списал деньги, либо нет. Поэтому «Пульс» 2PC не использует.`)
    };
    return {
      can: ['да', 'ok'], lock: 0.1, lockT: '< 0,1 с', wait: ['никто', 'ok'],
      note: ui.note('ok', 'Сага: каждый сохраняет своё сразу', 'Каждый участник делает свой маленький шаг и сразу фиксирует у себя — блокировка на доли секунды. Пока Анна проходит 3-D Secure, сага просто ждёт ответа, ничего не заблокировано. Цена: промежуточные состояния видны (абонемент «ждёт оплаты», бонусы «в резерве»), и если дальше что-то сломается, сделанное надо отменить. Отмену придумывают заранее — это <b>компенсации</b>. Ниже — как они работают.')
    };
  }

  // соседний пример: бронь персональной тренировки (F-pt)
  const PT_LANES = [L('orch', 'Оркестратор', 'ведёт сагу'), L('slot', 'Расписание', 'окна тренера'), L('pay', 'Платежи', '→ ПэйПоинт'), L('pt', 'Перс. тренировки', 'personal_session'), L('ntf', 'Уведомления', 'пуш')];
  const PT = [
    { n: 1, lane: 'slot', t: '1. занять окно чт 19:00', ok: 'окно за Олегом', fail: 'окно уже занято', c: 'C1. освободить окно', type: 'можно отменить', comp: 'освободить окно', fNote: 'Пока Олег выбирал, это окно занял другой клиент. Сага сломалась на первом шаге — отменять ещё нечего.' },
    { n: 2, lane: 'pay', t: '2. списать 3 500 ₽', ok: 'списано', fail: 'карта отклонена', c: 'C2. вернуть 3 500 ₽', type: 'можно отменить', comp: 'вернуть деньги (возврат через ПэйПоинт)', fNote: 'Банк отклонил карту Олега. Окно тренера уже занято за Олегом — его надо освободить.' },
    { n: 3, lane: 'pt', t: '3. создать тренировку', ok: 'booked', fail: 'Игорь в это время\nведёт группу', c: '', type: 'точка невозврата', comp: '— (после этого шага только вперёд)', fNote: 'Оказалось, у Игоря Кима в это время групповое занятие (тренер не может быть в двух местах). Окно занято, деньги списаны — откатываем оба шага.' },
    { n: 4, lane: 'ntf', t: '4. пуш Олегу и тренеру', ok: 'отправлено', fail: 'таймаут', c: '', type: 'повторяемый', comp: '— (не отменяем, повторяем)', fNote: '«Уведомления» не ответили. Но тренировка уже создана и оплачена — это после точки невозврата.' }
  ];
  function ptSteps(k, comp) {
    const S = [{ from: 'orch', to: 'orch', t: 'Олег бронирует Игоря Кима\nчт 19:00 · 3 500 ₽', note: 'Олег выбирает свободное окно тренера и оплачивает персональную тренировку. Участвуют четыре модуля; оплата идёт через внешний ПэйПоинт — значит, одной транзакцией всё не накрыть.' }];
    for (const st of PT) {
      if (k === 0 || st.n < k) {
        S.push({ from: 'orch', to: st.lane, t: st.t, note: `Шаг ${st.n}: участник делает своё и <b>сразу сохраняет</b> в своей базе.` });
        S.push({ from: st.lane, to: 'orch', t: st.ok, reply: true, kind: 'ok', note: st.n === 3 ? 'Тренировка создана. Это <b>точка невозврата</b>: после неё сага только идёт вперёд.' : 'Готово, сохранено.' });
      } else if (st.n === k) {
        S.push({ from: 'orch', to: st.lane, t: st.t });
        S.push({ from: st.lane, to: 'orch', t: '✗ ' + st.fail, reply: true, kind: 'bad', note: st.fNote });
        break;
      }
    }
    if (k === 0) { S.push({ from: 'orch', to: 'orch', t: 'сага завершена ✓', kind: 'ok', note: 'Все четыре шага прошли. Общей транзакции не было — каждый сохранил своё, и всё сошлось.' }); return S; }
    if (!comp) {
      S.push({ from: 'orch', to: 'ntf', box: true, t: k === 4 ? 'ошибка в лог — и всё' : 'ошибка в лог — и всё: отмены нет', kind: k === 1 ? 'warn' : 'bad', note: 'Наивная реализация: упало — записали ошибку в лог. Никто не отменяет уже сделанные шаги и не повторяет упавший.' });
      return S;
    }
    if (k === 4) {
      S.push({ from: 'orch', to: 'ntf', t: 'повтор через 1 мин', kind: 'warn', note: 'После точки невозврата не откатываем: тренировка оплачена и создана. Пуш просто повторяем с паузой — тем же ключом, чтобы не отправить дважды.' });
      S.push({ from: 'ntf', to: 'orch', t: 'отправлено', reply: true, kind: 'ok' });
      S.push({ from: 'orch', to: 'orch', t: 'сага завершена ✓', kind: 'ok' });
      return S;
    }
    if (k === 1) { S.push({ from: 'orch', to: 'orch', t: 'отменять нечего', kind: 'ok', note: 'Ни один шаг не успел выполниться — компенсаций нет. Олег видит «окно уже занято» и выбирает другое.' }); return S; }
    for (let j = k - 1; j >= 1; j--) {
      const st = PT[j - 1];
      S.push({ from: 'orch', to: st.lane, t: st.c, kind: 'warn', note: j === k - 1 ? `Компенсации идут <b>в обратном порядке</b>: сначала отменяем последний сделанный шаг (${st.n}), потом предыдущие. Поздние шаги опираются на ранние — разбираем «стопку» сверху.` : `Затем шаг ${st.n}.` });
      S.push({ from: st.lane, to: 'orch', t: 'отменено', reply: true, kind: 'ok' });
    }
    S.push({ from: 'orch', to: 'orch', t: 'сага откатилась ✓', kind: 'ok', note: 'Всё вернулось в согласованное состояние: как будто брони не было. Олег видит понятную ошибку.' });
    return S;
  }
  function ptState(k, comp) {
    const slot = k === 0 || k === 4 ? ['за Олегом', 'ok'] : k === 1 ? ['свободно', 'ok'] : comp ? ['свободно', 'ok'] : ['занято навсегда', 'bad'];
    const money = k === 0 || k === 4 ? ['списано 3 500 ₽', 'ok'] : k <= 2 ? ['не списаны', 'ok'] : comp ? ['возвращены', 'ok'] : ['списаны, тренировки нет', 'bad'];
    const pt = k === 0 || k === 4 ? ['booked', 'ok'] : ['нет', 'ok'];
    const V = {
      0: ['ok', 'Без сбоя', 'Четыре локальных шага — и всё сошлось.'],
      1: ['ok', 'Сломалось на первом шаге', 'Отменять нечего: ничего не успели сделать.'],
      2: comp ? ['ok', 'Откат: окно освобождено', 'Деньги не списывались, окно вернулось в расписание.'] : ['bad', 'Окно тренера занято навсегда', 'Игорь сидит без клиента, Олег без тренировки, а в расписании окно занято.'],
      3: comp ? ['ok', 'Откат: C2, потом C1', 'Деньги вернули, окно освободили — в обратном порядке.'] : ['bad', 'Деньги списаны, тренировки нет', 'Олег заплатил 3 500 ₽, окно занято, тренировки нет. Звонок в поддержку обеспечен.'],
      4: comp ? ['ok', 'После точки невозврата — только вперёд', 'Пуш повторили. Тренировку и деньги не трогали.'] : ['warn', 'Всё оплачено, но Олег не знает', 'Тренировка есть, деньги списаны, а пуш так и не дошёл.']
    };
    return { slot, money, pt, v: V[k] };
  }
  const howSaga = {
    id: 'how-saga', covers: ['order-comp'], title: 'Как это работает: сага вместо одной транзакции', free: true, noReset: true,
    simple: {
      icon: '🧩',
      plain: 'Когда покупка задевает несколько сервисов, общей кнопки «отменить всё» нет. Поэтому покупку делят на маленькие шаги: каждый сервис делает свой шаг и сразу сохраняет. Для каждого шага заранее придумывают «шаг назад» — компенсацию. Сломалось посередине — выполняем шаги назад в обратном порядке.',
      analogy: 'Отпуск: забронировали отель, купили билеты, записались на экскурсию. Рейс отменили — звоните в отель и на экскурсию и снимаете бронь. Одной кнопки «отменить отпуск» нет: у каждого своя отмена, и её надо знать заранее.',
      tech: '<b>Сага</b> (saga) — цепочка локальных транзакций T1…Tn в разных сервисах; для каждой Ti есть <b>компенсирующая</b> Ci. Сбой на шаге k → выполняются C(k−1)…C1 в обратном порядке. Шаги после <b>точки невозврата</b> (pivot) не компенсируют, а повторяют до успеха. Сага даёт итоговую согласованность, а не атомарность: промежуточные состояния видны.'
    },
    lead: ui.brief({
      situation: 'Сначала — почему покупку абонемента с бонусами нельзя сделать одной транзакцией. Потом механизм саги на соседнем примере: Олег бронирует персональную тренировку у Игоря Кима на четверг 19:00 за 3 500 ₽. Участвуют «Расписание» (окно тренера), «Платежи» (через ПэйПоинт), «Персональные тренировки» и «Уведомления».',
      todo: [
        'Вверху переключайте «Как устроить покупку» и «Сколько Анна проходит 3-D Secure». Смотрите, что заблокировано и кто ждёт.',
        'Ниже нажимайте «Сбой на шаге 1…4» — схема проигрывается заново. Какие компенсации запускаются и в каком порядке?',
        'Переключите «Сага умеет откатываться» на «нет» и повторите сбой на шагах 2 и 3.'
      ],
      look: 'Полоса — сколько времени заблокированы строки Анны. На схеме: стрелка — команда, пунктир — ответ, жёлтые стрелки — компенсации. Над схемой — что в итоге с окном тренера, деньгами и тренировкой. Таблица «карта саги» — у какого шага какая отмена.'
    }),
    render(el) {
      el.classList.add('asg-root');
      let way = '2pc', ds = '40', k = 3, comp = true;
      el.innerHTML = `<div class="stack" style="gap:16px">
        <div class="asg-sub"><span class="l">1</span>Почему не одна транзакция</div>
        <div class="small muted">Анна покупает «Сеть 12 мес» за 54 000 ₽: 3 200 ₽ бонусами (1 бонус = 1 ₽), остальное картой через ПэйПоинт с 3-D Secure. Участвуют «Абонементы» и «Платежи» (ядро), сервис «Бонусы» (своя база) и ПэйПоинт.</div>
        <div class="asg-box"><div class="asg-set">
          <div class="lbl">Как устроить покупку</div>${ui.seg('way', WAYS, way, 'accent')}
          <div class="lbl">Анна проходит 3-D Secure</div>${ui.seg('ds', DS, ds)}
        </div></div>
        <div data-way></div>
        <div class="asg-sub"><span class="l">2</span>Сага на соседнем примере: бронь персональной тренировки</div>
        <div class="asg-box"><div class="asg-set">
          <div class="lbl">Где сломалось</div>${ui.seg('k', [{ v: 0, t: 'без сбоя' }, { v: 1, t: 'сбой на шаге 1' }, { v: 2, t: 'на шаге 2' }, { v: 3, t: 'на шаге 3' }, { v: 4, t: 'на шаге 4' }], k, 'accent')}
          <div class="lbl">Сага умеет откатываться</div>${ui.seg('cmp', [{ v: 'y', t: 'да: компенсации и повторы' }, { v: 'n', t: 'нет: «упало — в лог»' }], 'y')}
        </div></div>
        <div data-st></div><div data-sq></div><div data-map></div>
      </div>`;
      function drawWay() {
        const w = wayView(way, ds);
        TR.$('[data-way]', el).innerHTML = `<div class="stack">
          <div class="asg-state">${stat('Так можно?', w.can[0], w.can[1])}${stat('Строки Анны заблокированы', w.lockT, w.lock > 1 ? 'bad' : w.lock ? 'ok' : '')}${stat('Кто ждёт', w.wait[0], w.wait[1])}</div>
          <div class="asg-lock"><span>Блокировка на время 3-D Secure</span><span class="bar"><i style="width:${Math.min(100, w.lock / 180 * 100).toFixed(1)}%;min-width:${w.lock ? 3 : 0}px;background:${w.lock > 1 ? 'var(--bad)' : 'var(--ok)'}"></i></span><span class="t">${w.lockT}</span></div>
          ${w.note}</div>`;
      }
      function drawSt() {
        const s = ptState(k, comp);
        TR.$('[data-st]', el).innerHTML = `<div class="stack tight"><div class="asg-state">${stat('Окно тренера', s.slot[0], s.slot[1])}${stat('Деньги Олега', s.money[0], s.money[1])}${stat('Тренировка', s.pt[0], s.pt[1])}</div>${ui.note(s.v[0], s.v[1], s.v[2])}</div>`;
        TR.$('[data-map]', el).innerHTML = `<div class="eyebrow">Карта саги</div>` + ui.table(['Шаг', 'Компенсация', 'Тип шага'], PT.map(st => [esc(st.t), esc(st.comp), st.type === 'точка невозврата' ? ui.status(st.type, 'warn') : st.type === 'повторяемый' ? ui.status(st.type, 'info') : ui.status(st.type, '')]), { rowClass: (r, i) => i + 1 === k ? 'hl' : '' })
          + ui.note('', 'Три вида шагов', '<b>Можно отменить</b> — до точки невозврата: у каждого есть компенсация. <b>Точка невозврата</b> — шаг, после которого отменять уже не будем. <b>Повторяемые</b> — после неё: их не отменяют, а повторяют, пока не получится. Поэтому самые рискованные шаги (оплату) ставят до точки невозврата, а «безобидные» (пуш) — после.');
      }
      const sq = ui.seq(TR.$('[data-sq]', el), { lanes: PT_LANES, steps: ptSteps(k, comp), laneW: 148, title: 'Сага брони персональной тренировки', hint: 'Нажмите «Проиграть» или «Шаг →».' });
      ui.onSeg(el, (n, v) => {
        if (n === 'way') { way = v; drawWay(); }
        if (n === 'ds') { ds = v; drawWay(); }
        if (n === 'k' || n === 'cmp') { if (n === 'k') k = +v; else comp = v === 'y'; drawSt(); sq.set(ptSteps(k, comp), { play: true }); }
      });
      drawWay(); drawSt();
    }
  };

  // =====================================================================
  // Теория 2. Дедлайны, зависшие саги и идемпотентность
  // =====================================================================
  const ST_T = [{ v: 't1', t: '19:02' }, { v: 't2', t: '19:20' }, { v: 't3', t: '20:00' }, { v: 't4', t: 'через 3 дня' }];
  function stuckView(dl, act, t) {
    if (t === 't1') return {
      row: ['PAYMENT_PENDING', '2 · оплата', dl === 'y' ? '19:16' : 'NULL', '1', 'NULL', '19:01'],
      slot: ['за Олегом (держим)', 'warn'], money: ['списаны — «Пульс» ещё не знает', 'warn'], pt: ['нет', ''],
      v: ['info', 'Идёт оплата — это нормально', 'Олег прошёл 3-D Secure в 19:02, ПэйПоинт списал 3 500 ₽ и отправил вебхук «оплачено». Но в эту минуту выкатывали ядро — вебхук потерялся. Сага пока ничего не знает и ждёт.']
    };
    if (dl === 'n') return {
      row: ['PAYMENT_PENDING', '2 · оплата', 'NULL', '1', 'NULL', '19:01'],
      slot: ['занято навсегда', 'bad'], money: ['списаны 3 500 ₽', 'bad'], pt: ['нет', 'bad'],
      v: ['bad', t === 't4' ? 'Через 3 дня — звонок в поддержку' : 'Сага зависла', t === 't4' ? 'Олег пришёл в четверг к Игорю — тренировки нет, деньги списаны, окно занято. Поддержка ищет, что случилось, по логам четырёх модулей. Ровно так выглядит инцидент 8 в покупке абонемента.' : 'Срока у шага нет — сага будет ждать вечно. Никто не спросит ПэйПоинт и никто не запустит компенсации.']
    };
    if (act === 'undo') return {
      row: ['COMPENSATED', '— откат', 'NULL', '1', 'истёк дедлайн оплаты 19:16', '19:17'],
      slot: ['свободно', 'ok'], money: ['возвращены (1–3 дня)', 'warn'], pt: ['нет', 'ok'],
      v: ['warn', 'Сходится, но Олег недоволен', 'В 19:16 планировщик нашёл сагу с истёкшим сроком и откатил всё: вернул деньги, освободил окно. Ничего не висит. Но Олег заплатил и прошёл 3-D Secure — а брони нет: деньги вернутся только через 1–3 дня. Дешевле сначала спросить.']
    };
    return {
      row: ['COMPLETED', '4 · готово', 'NULL', '2', 'вебхук не пришёл; статус получен запросом 19:16', '19:16'],
      slot: ['за Олегом', 'ok'], money: ['списано 3 500 ₽', 'ok'], pt: ['booked', 'ok'],
      v: ['ok', 'Сначала спросили — потом решили', 'В 19:16 планировщик нашёл сагу с истёкшим сроком и спросил ПэйПоинт о платеже по ключу идемпотентности: «оплачено». Сага пошла вперёд: создала тренировку, отправила пуш. Если бы ответ был «не оплачено» или «платежа нет» — откатила бы.']
    };
  }
  const howStuck = {
    id: 'how-stuck', covers: ['lab', 'saga-table'], title: 'Как это работает: сроки шагов, зависшие саги и повторы', free: true, noReset: true,
    simple: {
      icon: '⏰',
      plain: 'Участник может не ответить ни «да», ни «нет». Если сага будет ждать вечно — деньги, окно тренера и бонусы застрянут посередине. Поэтому у каждого шага есть срок: не уложился — сага сама выясняет, что случилось, и решает: идти дальше или откатываться. А чтобы повторы ничего не задвоили, каждый шаг и каждая отмена должны спокойно выдерживать повтор.',
      analogy: 'Вы сдали куртку в химчистку, в квитанции — «готово к пятнице». В пятницу тишина: вы звоните и спрашиваете по номеру квитанции, а не сдаёте вторую куртку. Позвонили дважды — куртку всё равно почистят один раз.',
      tech: 'У шага — <b>дедлайн</b>: поле <code>deadline_at</code> в таблице состояния саги. Планировщик раз в минуту ищет саги с <code>deadline_at &lt; now()</code> в нефинальном статусе: спрашивает участника о статусе (по ключу идемпотентности), потом повторяет шаг или запускает компенсации. Шаги и компенсации <b>идемпотентны</b>: команда несёт ключ (<code>sagaId:шаг</code>), участник помнит выполненные ключи. Компенсация тоже может упасть — её повторяют до успеха.'
    },
    lead: ui.brief({
      situation: 'Соседний пример — та же бронь Олега. В 19:01 сага создала платёж, в 19:02 Олег прошёл 3-D Secure, ПэйПоинт списал деньги и отправил вебхук «оплачено». В эту минуту выкатывали ядро — вебхук потерялся. Что будет дальше, зависит от того, есть ли у шага «оплата» срок и что сага делает, когда срок истёк.',
      todo: [
        'Включите «Срок у шага оплаты: нет» и двигайте время от 19:02 до «через 3 дня». Смотрите строку состояния саги и итог.',
        'Включите «15 минут» и сравните два поведения: «сразу откатить всё» и «спросить ПэйПоинт о статусе».',
        'Ниже — повторы. Отправьте команду, потом нажмите «💥 Ответ потерялся — повторить» без ключа идемпотентности и с ключом. Сравните, сколько списано и возвращено.'
      ],
      look: 'Строка <code>saga_pt</code> — как сага хранит своё состояние в базе: статус, шаг, срок (<code>deadline_at</code>), попытки, последняя ошибка. Три карточки — окно тренера, деньги Олега, тренировка. Внизу — счётчики денег и журнал запросов к ПэйПоинту.'
    }),
    render(el) {
      el.classList.add('asg-root');
      let dl = 'n', act = 'ask', t = 't2';
      let cmd = 'pay', key = false, P = { charged: 0, refunded: 0, seen: {}, log: [] };
      el.innerHTML = `<div class="stack" style="gap:16px">
        <div class="asg-sub"><span class="l">1</span>Вебхук потерялся: сага ждёт</div>
        <div class="asg-box"><div class="asg-set">
          <div class="lbl">Срок у шага оплаты</div>${ui.seg('dl', [{ v: 'n', t: 'нет: ждём, сколько потребуется' }, { v: 'y', t: '15 минут (deadline_at = 19:16)' }], dl, 'accent')}
          <div class="lbl">Когда срок истёк</div>${ui.seg('act', [{ v: 'undo', t: 'сразу откатить всё' }, { v: 'ask', t: 'спросить ПэйПоинт о статусе, потом решить' }], act)}
          <div class="lbl">Сейчас</div>${ui.seg('t', ST_T, t)}
        </div></div>
        <div data-row></div><div data-st></div>
        <div class="asg-sub"><span class="l">2</span>Повтор команды: идемпотентность шагов и компенсаций</div>
        <div class="asg-box">
          <div class="asg-set">
            <div class="lbl">Команда</div>${ui.seg('cmd', [{ v: 'pay', t: 'шаг «списать 3 500 ₽»' }, { v: 'refund', t: 'компенсация «вернуть 3 500 ₽»' }], cmd, 'accent')}
            <div class="lbl">В команде</div><label class="toggle"><input type="checkbox" data-key> <span>ключ идемпотентности <code>pt-7f3:шаг</code></span></label>
          </div>
          <div class="asg-btns">
            <button type="button" class="btn sm primary" data-p="send">Отправить команду</button>
            <button type="button" class="btn sm danger" data-p="again">💥 Ответ потерялся — повторить</button>
            <button type="button" class="btn sm ghost" data-p="reset">⟲ Сначала</button>
          </div>
        </div>
        <div data-pay></div>
        <div class="asg-log" data-log aria-live="polite"></div>
      </div>`;
      function draw() {
        const v = stuckView(dl, act, t);
        TR.$$('[data-seg="act"] button', el).forEach(b => { b.disabled = dl === 'n'; });
        TR.$('[data-row]', el).innerHTML = `<div class="eyebrow" style="margin-bottom:6px">Строка в таблице состояния саги <code>saga_pt</code></div>` + ui.table(['id', 'status', 'step', 'deadline_at', 'attempts', 'last_error', 'updated_at'], [['pt-7f3'].concat(v.row.map((x, i) => i === 0 ? `<b>${esc(x)}</b>` : esc(x)))]).replace('class="tbl"', 'class="tbl asg-row"');
        TR.$('[data-st]', el).innerHTML = `<div class="stack tight"><div class="asg-state">${stat('Окно тренера', v.slot[0], v.slot[1])}${stat('Деньги Олега', v.money[0], v.money[1])}${stat('Тренировка', v.pt[0], v.pt[1])}</div>${ui.note(v.v[0], v.v[1], v.v[2])}
          ${dl === 'y' ? ui.code(`-- планировщик, раз в минуту: какие саги просрочили свой шаг
SELECT id, step, attempts FROM saga_pt
 WHERE deadline_at < now()
   AND status NOT IN ('COMPLETED', 'COMPENSATED', 'FAILED')
 FOR UPDATE SKIP LOCKED;`, 'sql', 'Как сага замечает, что зависла') : ''}</div>`;
      }
      function drawPay() {
        const net = P.charged - P.refunded;
        TR.$('[data-pay]', el).innerHTML = `<div class="asg-state">${stat('Списано с карты Олега', TR.fmtRub(P.charged * 100), P.charged > 3500 ? 'bad' : '')}${stat('Возвращено Олегу', TR.fmtRub(P.refunded * 100), P.refunded > 3500 ? 'bad' : '')}${stat('Итог для Олега', (net > 0 ? '−' : net < 0 ? '+' : '') + TR.fmtRub(Math.abs(net) * 100), net > 3500 || net < 0 ? 'bad' : net === 3500 || net === 0 ? 'ok' : '', net < 0 ? 'клуб подарил деньги' : net > 3500 ? 'двойное списание' : '')}</div>`;
        const lg = TR.$('[data-log]', el);
        lg.innerHTML = P.log.length ? P.log.slice(-9).join('\n') : '<span class="dim">Выберите команду и нажмите «Отправить команду».</span>';
        lg.scrollTop = lg.scrollHeight;
      }
      function sendCmd(retry) {
        const k = 'pt-7f3:' + cmd, sum = 3500;
        const hdr = key ? ` · Idempotence-Key: ${k}` : '';
        if (retry) P.log.push(`<span class="warn">💥 ответ на прошлую команду потерялся по дороге — оркестратор повторяет</span>`);
        P.log.push(`→ ПэйПоинт: ${cmd === 'pay' ? 'POST /payments 3 500 ₽' : 'POST /refunds 3 500 ₽'}${hdr}`);
        if (key && P.seen[k]) { P.log.push(`<span class="ok">← ПэйПоинт: ключ ${k} уже был — возвращаю прежний ответ, деньги не трогаю</span>`); return; }
        if (cmd === 'pay') P.charged += sum; else P.refunded += sum;
        P.seen[k] = true;
        const twice = cmd === 'pay' ? P.charged > sum : P.refunded > sum;
        P.log.push(`<span class="${twice ? 'bad' : ''}">← ПэйПоинт: ${cmd === 'pay' ? 'списано' : 'возвращено'} 3 500 ₽${twice ? ' — ещё раз!' : ''}</span>`);
      }
      TR.on(el, 'click', '[data-p]', (e, b) => {
        const p = b.dataset.p;
        if (p === 'reset') P = { charged: 0, refunded: 0, seen: {}, log: [] };
        if (p === 'send') sendCmd(false);
        if (p === 'again') { if (!P.log.length) sendCmd(false); sendCmd(true); }
        drawPay();
      });
      el.addEventListener('change', e => { if (e.target.matches('[data-key]')) { key = e.target.checked; P = { charged: 0, refunded: 0, seen: {}, log: [] }; drawPay(); } });
      ui.onSeg(el, (n, v) => {
        if (n === 'dl') dl = v; if (n === 'act') act = v; if (n === 't') t = v;
        if (n === 'cmd') { cmd = v; P = { charged: 0, refunded: 0, seen: {}, log: [] }; drawPay(); return; }
        draw();
      });
      draw(); drawPay();
      el.querySelector('.stack').insertAdjacentHTML('beforeend', ui.note('', 'Что здесь делает аналитик', 'Пишет для каждого шага: <b>срок</b> (оплата — 15 минут: столько живёт ссылка на 3-D Secure), <b>что делать по сроку</b> (сначала спросить участника, потом идти вперёд или откатываться), <b>сколько повторов</b> и что видит клиент, пока сага в пути («оплата проверяется»). И требование: «каждая команда саги несёт ключ идемпотентности; повтор не меняет деньги и бонусы второй раз».'));
    }
  };

  // =====================================================================
  // Теория 3. Оркестрация или хореография
  // =====================================================================
  const CO_LANES = {
    orch: [L('orch', 'Оркестратор', 'знает сценарий'), L('slot', 'Расписание', 'окна тренера'), L('pay', 'Платежи', '→ ПэйПоинт'), L('pt', 'Перс. тренировки', ''), L('ntf', 'Уведомления', '')],
    chor: [L('slot', 'Расписание', 'окна тренера'), L('k', 'Kafka', 'события'), L('pay', 'Платежи', '→ ПэйПоинт'), L('pt', 'Перс. тренировки', ''), L('ntf', 'Уведомления', '')]
  };
  function coSteps(mode, fail) {
    if (mode === 'orch') {
      const S = [
        { from: 'orch', to: 'slot', t: 'занять окно', note: 'Оркестратор знает весь сценарий и по очереди <b>командует</b> участникам. Участники не знают друг о друге.' },
        { from: 'slot', to: 'orch', t: 'занято', reply: true, kind: 'ok' },
        { from: 'orch', to: 'pay', t: 'списать 3 500 ₽' }
      ];
      if (fail) {
        S.push({ from: 'pay', to: 'orch', t: '✗ карта отклонена', reply: true, kind: 'bad', note: 'Отказ пришёл оркестратору — он знает, что сделано до этого.' });
        S.push({ from: 'orch', to: 'slot', t: 'C1. освободить окно', kind: 'warn', note: 'Оркестратор сам командует компенсацию. Вся логика отката — в одном месте.' });
        S.push({ from: 'slot', to: 'orch', t: 'освобождено', reply: true, kind: 'ok' });
        S.push({ from: 'orch', to: 'orch', t: 'saga_pt: COMPENSATED', kind: 'ok', note: 'Состояние саги — одна строка в таблице оркестратора.' });
        return S;
      }
      S.push({ from: 'pay', to: 'orch', t: 'списано', reply: true, kind: 'ok' });
      S.push({ from: 'orch', to: 'pt', t: 'создать тренировку' }, { from: 'pt', to: 'orch', t: 'booked', reply: true, kind: 'ok' });
      S.push({ from: 'orch', to: 'ntf', t: 'пуш Олегу и тренеру' });
      S.push({ from: 'orch', to: 'orch', t: 'saga_pt: COMPLETED', kind: 'ok', note: 'Где сейчас бронь Олега — видно в одной строке таблицы оркестратора.' });
      return S;
    }
    const S = [
      { from: 'slot', to: 'slot', t: 'окно за Олегом', note: 'Дирижёра нет. «Расписание» заняло окно и <b>публикует событие</b> — дальше каждый сам знает, на что реагировать.' },
      { from: 'slot', to: 'k', t: 'SlotHeld' },
      { from: 'k', to: 'pay', t: 'SlotHeld', note: '«Платежи» подписаны на SlotHeld и сами решают списать деньги.' },
      { from: 'pay', to: 'pay', t: fail ? '✗ карта отклонена' : 'списано 3 500 ₽', kind: fail ? 'bad' : 'ok' }
    ];
    if (fail) {
      S.push({ from: 'pay', to: 'k', t: 'PaymentFailed', kind: 'warn', note: '«Платежи» публикуют отказ. Кто должен его услышать?' });
      S.push({ from: 'k', to: 'slot', t: 'PaymentFailed', kind: 'warn', note: '«Расписание» обязано быть подписано на события «Платежей» — иначе окно останется занятым навсегда. Логика отката размазана по участникам.' });
      S.push({ from: 'slot', to: 'slot', t: 'освободить окно', kind: 'ok', note: 'Откат случился — если подписку не забыли. Общего статуса «сага откатилась» нигде нет.' });
      return S;
    }
    S.push({ from: 'pay', to: 'k', t: 'PaymentSucceeded' });
    S.push({ from: 'k', to: 'pt', t: 'PaymentSucceeded', note: '«Персональные тренировки» ждут оплату и создают тренировку.' });
    S.push({ from: 'pt', to: 'k', t: 'PersonalSessionBooked' });
    S.push({ from: 'k', to: 'ntf', t: 'PersonalSessionBooked', kind: 'ok', note: '«Уведомления» шлют пуш. Процесс сложился из реакций — но целиком его никто не видит.' });
    return S;
  }
  const CO_Q = [
    { v: 'who', t: 'Кто знает весь процесс?', orch: 'Оркестратор: сценарий записан в одном месте — шаги, сроки, компенсации. Новый разработчик читает один класс и одну таблицу.', chor: 'Никто целиком. Каждый участник знает только свою реакцию. Весь процесс живёт на схеме в базе знаний — если её не забыли обновить.' },
    { v: 'where', t: 'Где посмотреть, где застряла бронь Олега?', orch: 'Одна строка: <code>SELECT status, step, deadline_at, last_error FROM saga_pt WHERE id = …</code>. Поддержка видит шаг и причину.', chor: 'Собирать по журналам четырёх участников по <code>traceId</code> или строить отдельную проекцию из событий. Поддержке без разработчика не разобраться.' },
    { v: 'fail', t: 'Карта отклонена — кто запускает откат?', orch: 'Оркестратор получил отказ и сам командует «освободить окно». Забыть некому: компенсации описаны рядом с шагами.', chor: '«Платежи» публикуют PaymentFailed, «Расписание» обязано на него подписаться. Забыли подписку — окно занято навсегда, и никто этого не заметит.' },
    { v: 'add', t: 'Нужно добавить шаг «списать бонусы»', orch: 'Меняем оркестратор: новый шаг, его компенсация и срок — в одном месте. Участники не меняются.', chor: 'Меняем подписки двух-трёх участников: кто теперь слушает SlotHeld, кто — BonusReserved. Легко нарушить порядок или получить цикл событий.' },
    { v: 'dep', t: 'Кто от кого зависит?', orch: 'Оркестратор знает API всех участников (риск — «всезнающий» оркестратор, в который утекает чужая логика). Участники друг о друге не знают.', chor: 'Связь слабая: участники знают только события. Но цепочка событий неявная: «кто на что подписан» — главный источник ошибок.' }
  ];
  const howCoord = {
    id: 'how-coord', covers: ['coord'], title: 'Как это работает: оркестрация или хореография', free: true, noReset: true,
    simple: {
      icon: '🎼',
      plain: 'Сагу можно вести двумя способами. Оркестрация: есть «дирижёр», он знает весь сценарий и по очереди командует участникам. Хореография: дирижёра нет, каждый участник слушает события и сам знает, что делать дальше.',
      analogy: 'Оркестрация — свадьба с ведущим: он объявляет торт, танец, тосты и всегда знает, на каком мы этапе. Хореография — вечеринка, где каждый знает свою роль: заиграла музыка — танцуем, вынесли торт — режем. Без ведущего проще, но спросить «на каком мы этапе?» не у кого.',
      tech: '<b>Оркестрация</b>: оркестратор шлёт команды и ждёт ответов, хранит состояние саги в своей таблице; процесс и компенсации в одном месте, состояние видно. <b>Хореография</b>: участники публикуют события и подписаны на чужие (Kafka); слабая связанность, нет центральной точки, но процесс неявный, состояние собирают по журналам, легко получить цикл. Правило: много шагов, деньги, компенсации, нужен статус для поддержки — оркестрация; одна-две независимые реакции без отката — хореография.'
    },
    lead: ui.brief({
      situation: 'Та же бронь персональной тренировки Олега — двумя способами на одной схеме. Слева направо — участники; в хореографии посредине появляется Kafka.',
      todo: [
        'Переключайте «Кто ведёт» и проиграйте схему в обоих вариантах.',
        'Включите «карта отклонена» — посмотрите, кто и как запускает откат.',
        'Нажимайте вопросы под схемой. Ответ меняется вместе с переключателем; в таблице подсвечена текущая колонка.'
      ],
      look: 'В оркестрации все стрелки идут от оркестратора и обратно — команды и ответы. В хореографии стрелки идут через Kafka — это события. Жёлтое — откат.'
    }),
    render(el) {
      el.classList.add('asg-root');
      let mode = 'orch', fail = false, q = 'where';
      el.innerHTML = `<div class="stack" style="gap:16px">
        <div class="asg-box"><div class="asg-set">
          <div class="lbl">Кто ведёт</div>${ui.seg('mode', [{ v: 'orch', t: 'оркестрация: дирижёр командует' }, { v: 'chor', t: 'хореография: каждый реагирует на события' }], mode, 'accent')}
          <div class="lbl">Оплата</div>${ui.seg('fail', [{ v: 'n', t: 'прошла' }, { v: 'y', t: 'карта отклонена' }], 'n')}
        </div></div>
        <div data-sq></div>
        <div class="asg-box"><div class="eyebrow">Вопрос</div>${ui.seg('q', CO_Q.map(x => ({ v: x.v, t: x.t })), q)}<div data-ans></div></div>
        <div data-cmp></div>
      </div>`;
      const box = TR.$('[data-sq]', el);
      let sq = null;
      const drawSeq = play => { box.innerHTML = ''; sq = ui.seq(mount(box), { lanes: CO_LANES[mode], steps: coSteps(mode, fail), laneW: 148, title: mode === 'orch' ? 'Оркестрация' : 'Хореография', hint: 'Нажмите «Проиграть».' }); if (play) sq.play(); };
      function drawAns() {
        const x = CO_Q.find(o => o.v === q);
        TR.$('[data-ans]', el).innerHTML = ui.note(mode === 'orch' ? 'ok' : 'warn', mode === 'orch' ? 'Оркестрация' : 'Хореография', x[mode]);
        const c = (m, h) => `<th class="${m === mode ? 'cur' : ''}">${h}</th>`;
        TR.$('[data-cmp]', el).innerHTML = `<div class="tbl-wrap"><table class="tbl asg-cmp"><thead><tr><th>Вопрос</th>${c('orch', 'Оркестрация')}${c('chor', 'Хореография')}</tr></thead><tbody>${[
          ['Кто знает процесс', 'оркестратор', 'никто целиком'],
          ['Где состояние', 'строка в таблице саги', 'по журналам участников'],
          ['Откат', 'командует оркестратор', 'каждый слушает отказы'],
          ['Связанность', 'оркестратор знает всех', 'слабая, через события'],
          ['Когда брать', 'много шагов, деньги, компенсации', '1–2 независимые реакции без отката']
        ].map(r => `<tr><td>${r[0]}</td><td class="${mode === 'orch' ? 'cur' : ''}">${r[1]}</td><td class="${mode === 'chor' ? 'cur' : ''}">${r[2]}</td></tr>`).join('')}</tbody></table></div>`;
      }
      ui.onSeg(el, (n, v) => {
        if (n === 'mode') { mode = v; drawSeq(true); drawAns(); }
        if (n === 'fail') { fail = v === 'y'; drawSeq(true); }
        if (n === 'q') { q = v; drawAns(); }
      });
      drawSeq(false); drawAns();
    }
  };

  // =====================================================================
  // Практика 1. Шаги саги покупки и компенсации
  // =====================================================================
  const STEPS = [
    { id: 's1', t: '«Абонементы»: создать абонемент «Сеть 12 мес» в статусе «ждёт оплаты»', sub: 'membership.status = pending_payment' },
    { id: 's2', t: '«Бонусы»: зарезервировать списание 3 200 бонусов', sub: 'до 30 % цены абонемента' },
    { id: 's3', t: '«Платежи»: списать картой остаток 50 800 ₽ через ПэйПоинт', sub: '3-D Secure, вебхук «оплачено»' },
    { id: 's4', t: '«Абонементы»: активировать абонемент', sub: 'pending_payment → active' },
    { id: 's5', t: '«Бонусы»: подтвердить списание зарезервированных бонусов', sub: 'резерв → списано' },
    { id: 's6', t: '«Уведомления»: пуш «Абонемент активен»', sub: 'через очередь RabbitMQ' }
  ];
  const OK_ORDER = STEPS.map(s => s.id);
  const COMP = [
    { v: 'term', t: 'Абонемент → terminated (закрыт, строка остаётся)' },
    { v: 'del', t: 'Удалить строку абонемента из базы' },
    { v: 'unres', t: 'Отменить резерв бонусов' },
    { v: 'refund', t: 'Вернуть деньги: возврат через ПэйПоинт' },
    { v: 'pivot', t: 'Не нужна: точка невозврата, дальше только вперёд' },
    { v: 'retry', t: 'Не компенсируем: повторяем шаг до успеха' }
  ];
  const COMP_OK = {
    s1: { ok: 'term', bad: { del: 'Удалять нельзя: на абонемент ссылается платёж, его видит история и аудит. Отменённый абонемент закрывают статусом.' }, hint: 'Что делают с абонементом, который так и не оплатили, — удаляют или закрывают статусом? Кто на него ссылается?' },
    s2: { ok: 'unres', hint: 'Если оплата сорвётся, что станет с зарезервированными бонусами Анны?' },
    s3: { ok: 'refund', hint: 'Деньги уже ушли в ПэйПоинт. Чем отменяют списание?' },
    s4: { ok: 'pivot', warn: { retry: 'Активация может не пройти по правилу (например, второй действующий абонемент) — повтор тут не поможет. Активация — точка невозврата: прошла — дальше только вперёд.' }, hint: 'Если абонемент активирован и Анна уже может пройти в клуб — будем ли мы когда-нибудь отменять этот шаг?' },
    s5: { ok: 'retry', warn: { pivot: 'Почти: после точки невозврата шаг не отменяют. Но точнее — «повторяем до успеха»: «Бонусы» должны в итоге списать резерв.' }, hint: 'Абонемент уже активен. «Бонусы» лежат 10 минут — откатывать покупку или дождаться?' },
    s6: { ok: 'retry', warn: { pivot: 'Почти: пуш не отменяют. Точнее — повторяем через очередь, пока не уйдёт.' }, hint: 'Пуш не дошёл. Отменять из-за этого абонемент? Или…' }
  };
  const MATCH_ROWS = TR.shuffle(STEPS.map(s => s.id), 'asg-mrows').map(id => STEPS.find(s => s.id === id));
  function ocScore(ans) {
    const ord = ans.order && ans.order.length === OK_ORDER.length ? ans.order : [];
    const os = ord.length ? ui.orderScore(ord, OK_ORDER) : 0;
    const comp = ans.comp || {};
    let ms = 0; const rv = {}, crit = [];
    STEPS.forEach(s => {
      const v = comp[s.id], d = COMP_OK[s.id];
      if (!v) return;
      if (v === d.ok) { ms += 1; rv[s.id] = { s: 'ok' }; }
      else if (d.warn && d.warn[v]) { ms += .5; rv[s.id] = { s: 'warn', why: d.warn[v] }; }
      else rv[s.id] = { s: 'bad', why: (d.bad && d.bad[v]) || d.hint };
    });
    const ix = id => ord.indexOf(id);
    if (ord.length && ix('s4') < ix('s3')) crit.push('активация стоит раньше оплаты — абонемент заработает до того, как пришли деньги');
    if (ord.length && ix('s6') < ix('s4')) crit.push('пуш «абонемент активен» уходит раньше активации');
    if (ord.length && ix('s5') < ix('s3')) crit.push('бонусы списываются окончательно раньше оплаты — сорвётся оплата, и их придётся возвращать');
    if (comp.s1 === 'del') crit.push('компенсация «удалить абонемент» — строки не удаляют, их закрывают статусом');
    if (['refund', 'term', 'unres'].includes(comp.s5) || ['refund', 'term', 'unres'].includes(comp.s6)) crit.push('после активации покупку откатывают из-за сбоя «Бонусов» или пуша — Анна уже может быть в клубе');
    const score = .45 * os + .55 * ms / STEPS.length;
    return { os, ms, rv, crit, score };
  }
  const taskOrder = {
    id: 'order-comp', title: 'Шаги саги покупки и их компенсации',
    simple: howSaga.simple,
    lead: ui.brief({
      situation: 'Антон: «Покупку абонемента с бонусами ведёт модуль “Продажи” — оркестратор. Мне нужна карта саги: шаги по порядку и у каждого — что делать, если дальше что-то сломалось». Анна покупает «Сеть 12 мес» за 54 000 ₽: 3 200 бонусами, 50 800 ₽ картой через ПэйПоинт.',
      todo: [
        'Шаг 1 — расставьте шесть шагов саги по порядку (стрелки ↑↓ или перетаскивание).',
        'Шаг 2 — для каждого шага выберите компенсацию в выпадающем списке.',
        'Внизу «Проверка на сухую»: выберите, где сломалось, — увидите, какие отмены запустит ваша карта и в каком порядке.',
        'Нажмите «Проверить». Засчитывается от 80 % и без критических ошибок.'
      ],
      lookTitle: 'Как рассуждать',
      look: 'Про порядок: что нужно знать, чтобы списать картой правильную сумму? Что нельзя делать до прихода денег? Про компенсации: какие шаги ещё можно отменить, где точка невозврата, а какие шаги после неё просто повторяют?'
    }),
    blank: () => ({ order: [], comp: {}, dry: 's3' }),
    reference: () => ({ order: OK_ORDER.slice(), comp: Object.fromEntries(STEPS.map(s => [s.id, COMP_OK[s.id].ok])), dry: 's4' }),
    render(el, ctx) {
      el.classList.add('asg-root');
      const a = ctx.ans; a.comp = a.comp || {}; a.dry = a.dry || 's3';
      el.innerHTML = `<div class="stack">
        <div class="eyebrow">Шаг 1. Порядок шагов саги</div><div data-o></div>
        <div class="eyebrow">Шаг 2. Компенсация для каждого шага</div><div data-m></div>
        <div class="asg-box"><div class="eyebrow">Проверка на сухую</div><div class="asg-set"><div class="lbl">Сломался шаг</div><div data-dryseg></div></div><div data-dry class="asg-dry"></div></div>
      </div>`;
      const sc = ctx.result ? ocScore(a) : null;
      const rvO = ctx.result && a.order && a.order.length ? Object.fromEntries(a.order.map((id, i) => [id, OK_ORDER[i] === id ? 'ok' : 'bad'])) : null;
      ui.order(TR.$('[data-o]', el), { items: STEPS, value: a.order, readonly: ctx.readonly, reveal: rvO, seed: 'asg-ord', onChange: v => { a.order = v; ctx.save(); drawDry(); } });
      ui.match(TR.$('[data-m]', el), { rows: MATCH_ROWS.map(s => ({ id: s.id, t: s.t })), choices: COMP, value: a.comp, readonly: ctx.readonly, reveal: sc ? sc.rv : null, placeholder: 'Компенсация…', onChange: v => { a.comp = v; ctx.save(); ctx.decide('Компенсации саги покупки', STEPS.map(s => `${s.id}: ${v[s.id] || '—'}`).join('; ')); drawDry(); } });
      const drawDrySeg = () => {
        const ord = a.order && a.order.length === 6 ? a.order : OK_ORDER;
        TR.$('[data-dryseg]', el).innerHTML = ui.seg('dry', ord.map((id, i) => ({ v: id, t: `${i + 1}` })), a.dry);
      };
      function drawDry() {
        drawDrySeg();
        const ord = a.order && a.order.length === 6 ? a.order : OK_ORDER;
        const pos = ord.indexOf(a.dry), st = STEPS.find(s => s.id === a.dry);
        const before = ord.slice(0, pos).reverse();
        const lines = before.map(id => {
          const v = (a.comp || {})[id], s = STEPS.find(x => x.id === id);
          const c = COMP.find(x => x.v === v);
          return `<li class="${!v ? 'warn' : ['pivot', 'retry'].includes(v) ? 'info' : ''}">${esc(strip(s.t))} → ${c ? '<b>' + esc(c.t) + '</b>' : '<i>компенсация не выбрана</i>'}</li>`;
        });
        const pivotBefore = before.some(id => (a.comp || {})[id] === 'pivot');
        TR.$('[data-dry]', el).innerHTML = `<p>Сломался шаг ${pos + 1}: <b>${esc(strip(st.t))}</b>.</p>${before.length ? `<p class="small dim">Уже сделано ${before.length} ${TR.plural(before.length, 'шаг', 'шага', 'шагов')}. Ваша карта, от последнего к первому:</p><ul class="checks">${lines.join('')}</ul>` : '<p class="small dim">До него ничего не сделано — отменять нечего.</p>'}${pivotBefore ? ui.note('info', 'Точка невозврата уже пройдена', 'По вашей карте до этого шага уже была точка невозврата — значит, упавший шаг надо повторять, а не откатывать покупку.') : ''}`;
      }
      TR.on(el, 'click', '[data-seg="dry"] button', (e, b) => { a.dry = b.dataset.v; if (!ctx.readonly) ctx.save(); drawDry(); });
      drawDry();
    },
    check(ans) {
      const d = ocScore(ans), notes = [];
      if (!(ans.order && ans.order.length === 6)) notes.push({ ok: false, html: 'Расставьте шаги по порядку.' });
      else if (d.os < 1) notes.push({ ok: d.os >= .8 ? 'warn' : false, html: `Порядок: ${Math.round(d.os * 100)} % пар на своих местах. Подсказка: сумму к оплате картой можно посчитать только после резерва бонусов; активировать — только после денег.` });
      const filled = STEPS.filter(s => (ans.comp || {})[s.id]).length;
      if (filled < 6) notes.push({ ok: false, html: `Компенсации выбраны для ${filled} из 6 шагов.` });
      STEPS.forEach(s => { const r = d.rv[s.id]; if (r && r.s !== 'ok') notes.push({ ok: r.s === 'warn' ? 'warn' : false, html: `${esc(strip(s.t))} — ${r.why}` }); });
      d.crit.forEach(c => notes.push({ ok: false, html: 'Критично: ' + c + '.' }));
      const ok = d.score >= .8 && !d.crit.length;
      if (ok && !notes.length) notes.push({ ok: true, html: 'Порядок и компенсации — верно.' });
      return { ok, score: d.score, notes, summary: `Порядок: ${Math.round(d.os * 100)} % · компенсации: ${d.ms} из 6.`, vera: ok ? null : 'Разделите шаги на три группы: до точки невозврата (у каждого есть отмена), сама точка, после неё (только повторяем). Где у покупки момент «Анна уже может пройти в клуб»?' };
    },
    explain: `<p>Канон «Пульса»: <b>создать абонемент «ждёт оплаты» → резерв бонусов → списание картой → активация → подтверждение списания бонусов → пуш</b>.</p>
      <ul class="checks">
        <li>Резерв бонусов — до карты: только так известна сумма к оплате (54 000 − 3 200 = 50 800 ₽), и бонусы не потратят параллельно в другой покупке.</li>
        <li>Активация — после денег: иначе абонемент заработает бесплатно, если оплата сорвётся.</li>
        <li>Компенсации: абонемент → <code>terminated</code> (не удаляем: на него ссылаются платёж и история), отмена резерва, возврат через ПэйПоинт.</li>
        <li><b>Активация — точка невозврата.</b> После неё Анна может пройти в клуб; подтверждение бонусов и пуш не отменяют, а повторяют до успеха — поэтому они идемпотентны.</li>
      </ul>
      <p>Что из этого пишет аналитик: карту саги таблицей «шаг — участник — компенсация — срок — сколько повторов — что видит клиент». Это и есть постановка для команды и тест-кейсы для тестировщика: по одному на сбой каждого шага.</p>`,
    report: ans => { const d = ocScore(ans); return `Порядок: ${(ans.order || []).map(id => OK_ORDER.indexOf(id) + 1).join(' → ') || '—'} (${Math.round(d.os * 100)} %).\nКомпенсации: ${STEPS.map(s => `${OK_ORDER.indexOf(s.id) + 1}) ${strip((COMP.find(c => c.v === (ans.comp || {})[s.id]) || {}).t || '—')}`).join('; ')}.`; }
  };

  // =====================================================================
  // Практика 2. Лаборатория «сбой на любом шаге»
  // =====================================================================
  const SCN = [
    { v: 'b', t: 'Шаг 2: «Бонусы» отказали', k: 'Бонусы отказали', fail: 2, story: '«Бонусы» отвечают «недостаточно бонусов»: Анна в эту же минуту оплатила бонусами персональную тренировку. Отказ по делу — сколько ни повторяй, бонусов не прибавится.' },
    { v: 'p', t: 'Шаг 3: банк отклонил карту', k: 'Карта отклонена', fail: 3, story: 'Анна дважды ввела неверный код 3-D Secure — ПэйПоинт отвечает «отклонено». Повторить списание без Анны нельзя: 3-D Secure проходит она сама.' },
    { v: 't', t: 'Шаг 3: ПэйПоинт молчит 15 минут', k: 'Оплата: тишина', fail: 3, story: 'Инцидент 8. Анна прошла 3-D Secure в 20:03, ПэйПоинт списал 50 800 ₽ и отправил вебхук — он потерялся во время выкатки ядра. Срок шага оплаты (15 минут) истёк, а ответа нет. Что на самом деле с деньгами, сага не знает.' },
    { v: 'a', t: 'Шаг 4: активация отклонена', k: 'Активация отклонена', fail: 4, story: 'Пока Анна платила, администратор на ресепшене продал ей такой же абонемент на те же даты. Два действующих одновременно нельзя — «Абонементы» отказывают в активации. Деньги уже списаны.' },
    { v: 'c', t: 'Шаг 5: «Бонусы» лежат 10 минут', k: 'Бонусы лежат', fail: 5, story: 'Абонемент уже активен. «Бонусы» выкатывают новую версию — 10 минут не отвечают, подтверждение списания не проходит.' },
    { v: 'n', t: 'Шаг 6: «Уведомления» не отвечают', k: 'Пуш не ушёл', fail: 6, story: 'Абонемент активен, бонусы списаны. Очередь уведомлений недоступна — пуш «Абонемент активен» не ушёл.' }
  ];
  const ACTS = [
    { v: 'status', t: '🔎 Спросить ПэйПоинт о статусе платежа' },
    { v: 'retry', t: '🔁 Повторять упавший шаг до успеха' },
    { v: 'refund', t: '↩ Вернуть деньги' },
    { v: 'unres', t: '↩ Отменить резерв бонусов' },
    { v: 'term', t: '↩ Абонемент → terminated' }
  ];
  const actT = v => strip((ACTS.find(x => x.v === v) || {}).t || v).replace(/^\S+\s/, '');
  const LAB_LANES = [L('orch', 'Продажи', 'оркестратор'), L('memb', 'Абонементы', 'ядро'), L('bonus', 'Бонусы', 'сервис'), L('pay', 'Платежи', '+ ПэйПоинт'), L('ntf', 'Уведомления', 'сервис')];
  const FWD = [
    { lane: 'memb', t: '1. создать (pending_payment)', ok: 'создан' },
    { lane: 'bonus', t: '2. резерв 3 200', ok: 'зарезервировано' },
    { lane: 'pay', t: '3. списать 50 800 ₽', ok: 'списано' },
    { lane: 'memb', t: '4. активировать', ok: 'active' },
    { lane: 'bonus', t: '5. подтвердить списание', ok: 'списано' },
    { lane: 'ntf', t: '6. пуш «Абонемент активен»', ok: 'отправлено' }
  ];
  const FAILT = { b: '✗ недостаточно бонусов', p: '✗ отклонено банком', t: 'нет ответа 15 мин', a: '✗ уже есть действующий', c: 'нет ответа', n: 'нет ответа' };
  const MONEY = { none: 'не списаны', charged: 'списаны 50 800 ₽', refunded: 'возвращены' };
  const MEMB = { pending: 'ждёт оплаты', active: 'активен', terminated: 'закрыт' };
  const BONUS = { free: '3 200 на счёте', reserved: '3 200 в резерве', spent: '3 200 списаны' };
  function sim(v, acts) {
    const sc = SCN.find(s => s.v === v), A = new Set(acts || []), S = [], notes = [];
    let money = 'none', memb = 'pending', bonus = 'free', push = false, stuck = false, forward = false;
    // вперёд до сбоя
    FWD.forEach((f, i) => {
      const n = i + 1;
      if (n < sc.fail) { S.push({ from: 'orch', to: f.lane, t: f.t }); S.push({ from: f.lane, to: 'orch', t: f.ok, reply: true, kind: 'ok' }); }
      else if (n === sc.fail) { S.push({ from: 'orch', to: f.lane, t: f.t }); S.push({ from: f.lane, to: 'orch', t: FAILT[v], reply: true, kind: 'bad', lost: ['t', 'c', 'n'].includes(v), note: sc.story }); }
    });
    if (sc.fail > 2) bonus = 'reserved';
    if (sc.fail > 3 || v === 't') money = 'charged';
    if (sc.fail > 4) memb = 'active';
    if (sc.fail > 5) bonus = 'spent';
    const goForward = from => {
      forward = true;
      FWD.slice(from - 1).forEach(f => { S.push({ from: 'orch', to: f.lane, t: f.t, kind: 'ok' }); });
      memb = 'active'; bonus = 'spent'; push = true;
    };
    // 1) статус
    if (A.has('status')) {
      const ans = { b: 'платежа нет', p: 'отклонён', t: 'succeeded · 50 800 ₽', a: 'succeeded', c: 'succeeded', n: 'succeeded' }[v];
      S.push({ from: 'orch', to: 'pay', t: 'статус платежа?', kind: 'info', note: 'Оркестратор спрашивает ПэйПоинт по ключу идемпотентности платежа.' });
      S.push({ from: 'pay', to: 'orch', t: ans, reply: true, kind: v === 't' ? 'ok' : 'info', note: v === 't' ? 'Оплата прошла — вебхук просто потерялся. Значит, сага идёт вперёд.' : 'Ответ ничего не меняет в этом сценарии — но и не вредит.' });
      if (v === 't') goForward(4);
    }
    // 2) повтор
    if (A.has('retry') && !forward) {
      if (['b', 'p', 'a'].includes(v)) {
        const f = FWD[sc.fail - 1];
        S.push({ from: 'orch', to: f.lane, t: 'повтор: ' + f.t.replace(/^\d\.\s/, ''), kind: 'warn' });
        S.push({ from: f.lane, to: 'orch', t: FAITH(v), reply: true, kind: 'bad' });
        S.push({ from: 'orch', to: 'ntf', box: true, t: 'повтор № 2, 3, 4… сага крутится вечно', kind: 'bad', note: 'Отказ по делу не лечится повтором. Сага никогда не дойдёт до компенсаций — всё зависло.' });
        stuck = true;
      } else if (v === 't') {
        S.push({ from: 'orch', to: 'pay', t: 'повтор: создать платёж\n(тот же ключ)', kind: 'info', note: 'Повтор с тем же ключом идемпотентности: ПэйПоинт не спишет второй раз, а вернёт прежний платёж — «оплачено».' });
        S.push({ from: 'pay', to: 'orch', t: 'тот же платёж: succeeded', reply: true, kind: 'ok' });
        goForward(4);
      } else if (v === 'c') {
        S.push({ from: 'orch', to: 'bonus', t: 'повтор через 1, 2, 4 мин', kind: 'warn', note: 'Повтор с паузой и тем же ключом. Через 10 минут «Бонусы» поднялись.' });
        S.push({ from: 'bonus', to: 'orch', t: 'списано (20:12)', reply: true, kind: 'ok' });
        bonus = 'spent';
        S.push({ from: 'orch', to: 'ntf', t: '6. пуш «Абонемент активен»', kind: 'ok' }); push = true;
      } else if (v === 'n') {
        S.push({ from: 'orch', to: 'ntf', t: 'повтор через очередь', kind: 'warn' });
        S.push({ from: 'ntf', to: 'orch', t: 'отправлено', reply: true, kind: 'ok' }); push = true;
      }
    }
    // 3) компенсации в обратном порядке
    if (!stuck) {
      if (forward && ['refund', 'unres', 'term'].some(x => A.has(x))) notes.push('Компенсации не понадобились: оплата подтверждена, сага пошла вперёд.');
      else {
        if (A.has('refund')) {
          S.push({ from: 'orch', to: 'pay', t: 'вернуть 50 800 ₽', kind: 'warn' });
          if (money === 'charged') { money = 'refunded'; S.push({ from: 'pay', to: 'orch', t: 'возврат создан', reply: true, kind: 'ok' }); }
          else S.push({ from: 'pay', to: 'orch', t: 'нечего возвращать', reply: true, kind: 'info', note: 'Возвращать нечего — компенсация идемпотентна и спокойно отвечает «уже/нечего».' });
        }
        if (A.has('unres')) {
          S.push({ from: 'orch', to: 'bonus', t: 'отменить резерв', kind: 'warn' });
          if (bonus === 'reserved') { bonus = 'free'; S.push({ from: 'bonus', to: 'orch', t: 'резерв снят', reply: true, kind: 'ok' }); }
          else S.push({ from: 'bonus', to: 'orch', t: bonus === 'spent' ? 'уже списано — отменять нечего' : 'резерва нет', reply: true, kind: 'info' });
        }
        if (A.has('term')) {
          S.push({ from: 'orch', to: 'memb', t: 'абонемент → terminated', kind: 'warn' });
          memb = 'terminated'; S.push({ from: 'memb', to: 'orch', t: 'закрыт', reply: true, kind: 'ok' });
        }
      }
    }
    // итог
    const bought = money === 'charged' && memb === 'active' && bonus === 'spent';
    const cancelled = money !== 'charged' && memb === 'terminated' && bonus === 'free';
    const why = [];
    if (stuck) why.push({ b: 'Повторять отказ «недостаточно бонусов» бесполезно — сага крутится вечно, абонемент навсегда «ждёт оплаты».', p: 'Повторить списание без Анны нельзя: 3-D Secure проходит она сама. Сага зависла, бонусы в резерве.', a: 'Правило «два действующих нельзя» повтором не обойти. Сага зависла, деньги списаны.' }[v]);
    else {
      if (money === 'charged' && memb !== 'active') why.push(memb === 'terminated' ? 'Деньги списаны, а абонемент закрыт — Анна заплатила за ничего.' : 'Деньги списаны, а абонемент не активирован.');
      if (memb === 'pending') why.push('Абонемент навсегда «ждёт оплаты».');
      if (bonus === 'reserved' && !bought) why.push('3 200 бонусов зарезервированы навсегда — потратить их Анна не сможет.');
      if (memb === 'active' && money === 'refunded') why.push('Абонемент активен, а деньги вернули — клуб подарил абонемент.');
      if (memb === 'active' && bonus === 'free' && money === 'charged') why.push('Бонусы вернулись на счёт, а скидку Анна уже получила — 3 200 ₽ подарили.');
      if (memb === 'terminated' && ['c', 'n'].includes(v)) why.push('Отменили уже активный абонемент из-за сбоя после точки невозврата — Анна, возможно, уже в зале.');
    }
    let kind, title;
    if (stuck || !(bought || cancelled)) { kind = 'bad'; title = 'Не сходится'; }
    else if (v === 't' && cancelled) { kind = 'warn'; title = 'Сходится, но покупку потеряли'; why.push('Всё откатили, ничего не висит. Но Анна оплатила и прошла 3-D Secure — а абонемента нет, деньги вернутся через 1–3 дня. Можно было сначала спросить ПэйПоинт.'); }
    else if (v === 'n' && !push) { kind = 'warn'; title = 'Сходится, но пуша нет'; why.push('Деньги, абонемент и бонусы согласованы. Анна просто не узнала об активации — пуш стоит повторить через очередь.'); }
    else if (cancelled && ['c', 'n'].includes(v)) { kind = 'bad'; title = 'Не сходится'; }
    else { kind = 'ok'; title = bought ? 'Сходится: покупка состоялась' : 'Сходится: покупка отменена'; why.push(bought ? 'Деньги списаны один раз, абонемент активен, бонусы списаны.' : 'Деньги не списаны или возвращены, абонемент закрыт, бонусы на счёте.'); }
    notes.forEach(x => why.push(x));
    S.push({ from: 'orch', to: 'ntf', box: true, t: kind === 'bad' ? '✗ ' + title : '✓ ' + title, kind: kind === 'bad' ? 'bad' : kind === 'warn' ? 'warn' : 'ok', note: why.join(' ') });
    return { money, memb, bonus, kind, title, why: why.join(' '), steps: S };
  }
  function FAITH(v) { return { b: '✗ снова недостаточно', p: '✗ снова отклонено', a: '✗ снова: уже есть действующий' }[v]; }
  const LAB_Q = {
    q: 'Что в первую очередь исправить в саге, чтобы инцидент 8 не повторился?', seed: 'asg-labq',
    options: [
      { t: 'Дать шагу оплаты срок: по истечении спросить ПэйПоинт о статусе и пойти вперёд или откатиться', ok: 1, why: 'Верно. Корень инцидента — бесконечное ожидание: никто не спросил и никто не запустил компенсации.' },
      { t: 'Увеличить таймаут ответа ПэйПоинта с 10 до 60 секунд', why: 'Проблема не в длине ожидания, а в том, что оно бесконечное и без решения по его итогу.' },
      { t: 'Перейти на двухфазную фиксацию, чтобы всё откатывалось само', why: 'ПэйПоинт 2PC не поддерживает, а блокировки на время 3-D Secure недопустимы.' },
      { t: 'Ночной скрипт снимает все резервы бонусов старше суток', why: 'Лечит один симптом: деньги так и останутся списаны без абонемента.' }
    ]
  };
  const taskLab = {
    id: 'lab', title: 'Лаборатория: сбой на любом шаге',
    simple: howStuck.simple,
    lead: ui.brief({
      situation: 'Сергей принёс инцидент 8: «Деньги списаны, абонемент не активирован, бонусы зарезервированы навсегда. За месяц — 14 обращений в поддержку». Антон: «Проверим сагу на всех сбоях, а не только на этом. Для каждого сбоя — план оркестратора, и чтобы в конце деньги, абонемент и бонусы сходились».',
      todo: [
        'Выберите сбой в переключателе «Где сломалось». Прочитайте, что случилось.',
        'Отметьте действия оркестратора для этого сбоя (кнопки-флажки). Схема и итог пересчитываются сразу.',
        'Добейтесь «сходится» во всех шести сценариях — смотрите таблицу внизу.',
        'Ответьте на вопрос и нажмите «Проверить».'
      ],
      look: 'Оркестратор выполняет отмеченные действия в таком порядке: сначала «спросить статус», потом «повторять», потом компенсации — от последнего шага к первому. «Сходится» — либо покупка состоялась (деньги списаны один раз, абонемент активен, бонусы списаны), либо отменена (денег нет или вернули, абонемент закрыт, бонусы на счёте). Всё остальное — не сходится.'
    }),
    blank: () => ({ scn: 'b', plan: {}, q: [] }),
    reference: () => ({ scn: 't', plan: { b: ['term'], p: ['unres', 'term'], t: ['status'], a: ['refund', 'unres', 'term'], c: ['retry'], n: ['retry'] }, q: [[0]] }),
    render(el, ctx) {
      el.classList.add('asg-root');
      const a = ctx.ans; a.plan = a.plan || {}; a.scn = a.scn || 'b';
      el.innerHTML = `<div class="stack">
        <div class="asg-box">
          <div class="asg-set"><div class="lbl">Где сломалось</div>${ui.seg('scn', SCN.map(s => ({ v: s.v, t: s.t })), a.scn, 'accent')}</div>
          <div data-story></div>
          <div class="eyebrow">План оркестратора для этого сбоя</div>
          <div class="asg-acts" data-acts></div>
        </div>
        <div data-st></div><div data-sq></div>
        <div class="eyebrow">Все сценарии с вашими планами</div><div data-mx></div>
        <div class="card flat" data-q></div>
      </div>`;
      const sq = ui.seq(TR.$('[data-sq]', el), { lanes: LAB_LANES, steps: sim(a.scn, a.plan[a.scn]).steps, start: 'all', laneW: 142, title: 'Сага покупки абонемента с бонусами', hint: 'Нажмите «Проиграть».' });
      function draw(play) {
        const sc = SCN.find(s => s.v === a.scn), acts = a.plan[a.scn] || [], r = sim(a.scn, acts);
        TR.$('[data-story]', el).innerHTML = `<p class="small">${sc.story}</p>`;
        TR.$('[data-acts]', el).innerHTML = ACTS.map(x => `<button type="button" class="chip" data-act="${x.v}" aria-pressed="${acts.includes(x.v)}" ${ctx.readonly ? 'disabled' : ''}>${x.t}</button>`).join('');
        TR.$('[data-st]', el).innerHTML = `<div class="stack tight"><div class="asg-state">${stat('Деньги Анны', MONEY[r.money], r.kind === 'bad' && r.money === 'charged' ? 'bad' : '')}${stat('Абонемент', MEMB[r.memb], r.memb === 'pending' ? 'bad' : '')}${stat('Бонусы', BONUS[r.bonus], r.bonus === 'reserved' ? 'bad' : '')}</div>${ui.note(r.kind, r.title, r.why)}</div>`;
        sq.set(r.steps, play ? { play: true } : { all: true });
        TR.$('[data-mx]', el).innerHTML = ui.table(['Сбой', 'План', 'Деньги', 'Абонемент', 'Бонусы', 'Итог'], SCN.map(s => {
          const p = a.plan[s.v] || [], x = sim(s.v, p);
          return [`<b>${esc(s.k)}</b>`, p.length ? p.map(actT).map(esc).join(', ') : '<span class="dim">ничего</span>', MONEY[x.money], MEMB[x.memb], BONUS[x.bonus], `<span class="status ${x.kind}">${x.kind === 'bad' ? 'не сходится' : 'сходится'}</span>`];
        }), { rowClass: r2 => strip(r2[0]) === sc.k ? 'hl' : '' }).replace('class="tbl"', 'class="tbl asg-mx"')
          + `<p class="small dim">Сходится ${SCN.filter(s => sim(s.v, a.plan[s.v]).kind !== 'bad').length} из ${SCN.length}.</p>`;
      }
      TR.on(el, 'click', '[data-act]', (e, b) => {
        if (ctx.readonly) return;
        const v = b.dataset.act, cur = (a.plan[a.scn] || []).slice();
        a.plan[a.scn] = cur.includes(v) ? cur.filter(x => x !== v) : ACTS.map(x => x.v).filter(x => x === v || cur.includes(x));
        ctx.save(); ctx.decide('План саги: ' + SCN.find(s => s.v === a.scn).k, (a.plan[a.scn] || []).map(actT).join(', ') || 'ничего');
        draw(true);
      });
      ui.onSeg(el, (n, v) => { if (n === 'scn') { a.scn = v; if (!ctx.readonly) ctx.save(); draw(true); } });
      draw(false);
      ui.quiz(TR.$('[data-q]', el), Object.assign({}, LAB_Q, { value: (a.q || [])[0] || [], readonly: ctx.readonly, reveal: ctx.result, onChange: v => { a.q = [v]; ctx.save(); } }));
    },
    check(ans) {
      const res = SCN.map(s => ({ s, r: sim(s.v, (ans.plan || {})[s.v] || []) }));
      const good = res.filter(x => x.r.kind !== 'bad').length;
      const qz = ui.quizScore(LAB_Q, (ans.q || [])[0] || []);
      const notes = res.map(({ s, r }) => ({ ok: r.kind === 'ok' ? true : r.kind === 'warn' ? 'warn' : false, html: `<b>${esc(s.k)}</b>: ${r.kind === 'bad' ? r.why : r.kind === 'warn' ? r.title + '. ' + r.why : 'сходится.'}` }));
      notes.push({ ok: qz.ok, html: qz.ok ? 'Вопрос: верно.' : 'Вопрос: что именно не сработало в инциденте 8 — длина ожидания или то, что у ожидания нет конца и решения?' });
      const score = .8 * good / SCN.length + .2 * qz.score;
      const ok = good === SCN.length && qz.ok;
      return { ok, score, notes, summary: `Сходится ${good} из ${SCN.length} сценариев.`, vera: ok ? null : 'Для каждого сбоя спросите себя: что уже сделано? Можно ли это отменить — или мы уже за точкой невозврата? Отказ «по делу» повторять бесполезно, временную тишину — стоит.' };
    },
    explain: `<p>Сводная карта сбоев:</p>
      <ul class="checks">
        <li><b>Отказ по делу до оплаты</b> («Бонусы» отказали, карта отклонена) — компенсируем сделанное: резерв → отменить, абонемент → <code>terminated</code>. Повторять бесполезно.</li>
        <li><b>Тишина на оплате</b> (инцидент 8) — по сроку шага спросить ПэйПоинт о статусе (или повторить с тем же ключом идемпотентности). «Оплачено» — идём вперёд, «нет» — откатываем. Откатить всё вслепую тоже согласовано, но теряем оплаченную покупку.</li>
        <li><b>Отказ после оплаты</b> (активация отклонена) — возврат денег, отмена резерва, абонемент закрыт: в обратном порядке.</li>
        <li><b>Сбой после точки невозврата</b> (бонусы не подтвердили, пуш не ушёл) — не откатываем, а повторяем до успеха. Поэтому эти шаги обязаны быть идемпотентными.</li>
      </ul>
      <p>Каждая строка таблицы — готовый тест-кейс для тестировщика и сценарий отказа в постановке. Аналитик описывает их до кода: «что если шаг N упал — что делает сага, что видит Анна, что видит поддержка».</p>`,
    report: ans => `${SCN.map(s => { const p = (ans.plan || {})[s.v] || [], r = sim(s.v, p); return `- ${s.k}: ${p.map(actT).join(', ') || 'ничего'} → ${r.kind === 'bad' ? 'не сходится' : 'сходится'}`; }).join('\n')}\nВопрос: ${ui.quizScore(LAB_Q, (ans.q || [])[0] || []).ok ? 'верно' : 'неверно'}`
  };

  // =====================================================================
  // Практика 3. Оркестрация или хореография для трёх процессов
  // =====================================================================
  const PROCS = [
    {
      id: 'buy', t: 'Покупка абонемента с бонусами', sub: '«Абонементы», «Бонусы», «Платежи» + ПэйПоинт, «Уведомления» · 6 шагов · деньги и компенсации', ok: 'orch',
      orch: '«Продажи» по очереди командуют: создать → резерв → списать → активировать → подтвердить → пуш. Состояние — строка в <code>saga_purchase</code>.',
      chor: '«Абонементы» публикуют MembershipCreated → «Бонусы» резервируют и публикуют BonusReserved → «Платежи» списывают и публикуют PaymentSucceeded → … Откат — подписки на отказы у каждого.',
      q: {
        q: 'Почему так?', seed: 'asg-c1', options: [
          { t: 'Деньги и компенсации в строгом порядке; поддержке нужно видеть, на каком шаге застряла покупка', ok: 1, why: 'Верно — канон «Пульса»: оркестратор «Продажи», состояние в saga_purchase.' },
          { t: 'Каждый участник сам знает, что делать дальше, — так проще добавлять шаги', why: 'Это довод за хореографию. Но здесь шаги связаны деньгами и откатом: размазанный по подпискам процесс трудно отлаживать и откатывать.' },
          { t: 'Так меньше сетевых вызовов', why: 'Вызовов примерно столько же. Дело в контроле и видимости, а не в их числе.' },
          { t: 'Без событий Kafka тут не обойтись', why: 'События Kafka есть в обоих способах (оркестратор тоже может слать команды через брокер). Выбор — не про транспорт, а про то, кто держит сценарий.' }
        ]
      }
    },
    {
      id: 'visit', t: 'Начисление +10 бонусов за посещение', sub: '«Доступ» записал проход → «Бонусы» начисляют → «Уведомления» пушат «+10»', ok: 'chor',
      orch: 'Оркестратор после прохода командует «Бонусам» начислить и «Уведомлениям» отправить пуш; хранит состояние каждого начисления.',
      chor: '«Доступ» публикует VisitRecorded в <code>puls.access.visits.v1</code>; «Бонусы» подписаны и начисляют, публикуют BonusAccrued; «Уведомления» шлют пуш.',
      q: {
        q: 'Почему так?', seed: 'asg-c2', options: [
          { t: 'Отката нет: проход уже случился, «Бонусы» и «Уведомления» реагируют независимо — дирижёр не нужен', ok: 1, why: 'Верно. Сбой «Бонусов» лечится повтором: at-least-once + идемпотентный потребитель.' },
          { t: 'При сбое «Бонусов» нужно отменить проход', why: 'Проход не отменяют: клиент уже в клубе. Бонусы догонят повтором.' },
          { t: '«Доступ» должен дождаться ответа «Бонусов», прежде чем открыть турникет', why: 'Турникет решает за 300 мс и не ждёт бонусов. Бонусы — следствие прохода, а не условие.' },
          { t: 'События всегда быстрее команд', why: 'Не «всегда быстрее». Просто здесь нечего координировать.' }
        ]
      }
    },
    {
      id: 'wait', t: 'Перевод из листа ожидания', sub: 'кто-то отменил запись → первый в очереди записан автоматически → пуш ему', ok: 'chor',
      orch: 'Оркестратор слушает отмены, командует «Записи» перевести первого из листа ожидания и «Уведомлениям» отправить пуш; хранит состояние перевода.',
      chor: '«Запись» публикует BookingCancelled (ключ — <code>class_session_id</code>); потребитель «лист ожидания» переводит первого в своей локальной транзакции и публикует WaitlistPromoted; «Уведомления» шлют пуш.',
      q: {
        q: 'Почему так?', seed: 'asg-c3', options: [
          { t: 'Денег и отката нет: перевод — одна локальная транзакция в «Записи», дальше — реакция «Уведомлений»', ok: 1, why: 'Верно. Порядок событий занятия держит ключ партиции class_session_id; состояние видно в самой записи (booked / waitlist).' },
          { t: 'Если пуш не дошёл, место надо вернуть отменившему', why: 'Пуш не отменяет перевод — его повторяют. Отменивший уже отменил.' },
          { t: 'Поддержке надо видеть, на каком шаге перевод', why: 'Шаг по сути один; статус и так виден в записи. Отдельная таблица саги здесь — лишняя сложность.' },
          { t: 'Оркестратор не умеет работать с листом ожидания', why: 'Умеет — просто здесь он не нужен.' }
        ]
      }
    }
  ];
  const CO_CH = [{ v: 'orch', t: 'Оркестрация' }, { v: 'chor', t: 'Хореография' }];
  const taskCoord = {
    id: 'coord', title: 'Оркестрация или хореография для трёх процессов',
    simple: howCoord.simple,
    lead: ui.brief({
      situation: 'Лена: «Бонусная команда спрашивает, как им строить все процессы — везде оркестратор или везде события? Давайте решим по каждому процессу отдельно и запишем почему». На столе три процесса «Пульса».',
      todo: [
        'Для каждого процесса выберите «Оркестрация» или «Хореография» — под переключателем появится, как это будет выглядеть.',
        'Ответьте, почему так.',
        'Нажмите «Проверить». Засчитывается, если все три решения верны и хотя бы два «почему».'
      ],
      lookTitle: 'Вопросы к каждому процессу',
      look: 'Сколько шагов и участников? Есть ли деньги и откат? Нужно ли кому-то видеть «на каком шаге»? Зависят ли реакции друг от друга — или каждая сама по себе?'
    }),
    blank: () => ({ dec: {}, q: {} }),
    reference: () => ({ dec: Object.fromEntries(PROCS.map(p => [p.id, p.ok])), q: Object.fromEntries(PROCS.map(p => [p.id, [0]])) }),
    render(el, ctx) {
      el.classList.add('asg-root');
      const a = ctx.ans; a.dec = a.dec || {}; a.q = a.q || {};
      el.innerHTML = `<div class="asg-procs">${PROCS.map(p => `<div class="card flat asg-proc" data-p="${p.id}">
        <h4>${esc(p.t)}</h4><div class="small dim">${esc(p.sub)}</div>
        <div>${ui.seg('d-' + p.id, CO_CH, a.dec[p.id] || '', 'accent')}</div>
        <div data-how></div><div data-q></div></div>`).join('')}</div>`;
      lock(el, ctx.readonly);
      const drawHow = p => {
        const v = a.dec[p.id], box = TR.$(`[data-p="${p.id}"] [data-how]`, el);
        const mark = ctx.result && v ? (v === p.ok ? 'ok' : 'bad') : '';
        box.innerHTML = v ? ui.note(mark, v === 'orch' ? 'Как это будет: оркестрация' : 'Как это будет: хореография', p[v]) : '<span class="small dim">Выберите способ.</span>';
      };
      PROCS.forEach(p => {
        drawHow(p);
        ui.quiz(TR.$(`[data-p="${p.id}"] [data-q]`, el), Object.assign({}, p.q, { value: a.q[p.id] || [], readonly: ctx.readonly, reveal: ctx.result, onChange: v => { a.q[p.id] = v; ctx.save(); } }));
      });
      ui.onSeg(el, (n, v) => {
        if (ctx.readonly || !n.startsWith('d-')) return;
        const id = n.slice(2); a.dec[id] = v; ctx.save();
        const p = PROCS.find(x => x.id === id); ctx.decide('Сага: ' + p.t, v === 'orch' ? 'оркестрация' : 'хореография');
        drawHow(p);
      });
    },
    check(ans) {
      const dec = ans.dec || {}, q = ans.q || {}, notes = [];
      let dOk = 0, qOk = 0, qs = 0;
      PROCS.forEach(p => {
        const d = dec[p.id], r = ui.quizScore(p.q, q[p.id] || []);
        if (d === p.ok) dOk++;
        if (r.ok) qOk++; qs += r.score;
        if (!d) notes.push({ ok: false, html: `«${esc(p.t)}»: способ не выбран.` });
        else if (d !== p.ok) notes.push({ ok: false, html: `«${esc(p.t)}»: ${p.ok === 'orch' ? 'есть ли здесь деньги, откат в строгом порядке и потребность видеть шаг?' : 'есть ли здесь откат и деньги? Или это независимые реакции на один факт?'}` });
        else notes.push({ ok: true, html: `«${esc(p.t)}»: способ верный.` });
        if (!r.ok) notes.push({ ok: 'warn', html: `«${esc(p.t)}» — почему: перечитайте варианты — какой из них про этот процесс, а какой про другой способ?` });
      });
      const score = .6 * dOk / PROCS.length + .4 * qs / PROCS.length;
      const ok = dOk === PROCS.length && qOk >= 2;
      return { ok, score, notes, summary: `Способ верен для ${dOk} из 3 процессов, «почему» — ${qOk} из 3.`, vera: ok ? null : 'Не бывает «везде оркестрация» или «везде события». Дирижёр нужен там, где есть что отменять и кому смотреть на статус.' };
    },
    explain: `<p>У «Пульса» оба способа живут рядом:</p>
      <ul class="checks">
        <li><b>Покупка с бонусами — оркестрация</b> («Продажи»): шесть шагов, деньги, компенсации в строгом порядке, сроки шагов и строка <code>saga_purchase</code> для поддержки.</li>
        <li><b>Бонусы за посещение — хореография</b>: <code>VisitRecorded</code> → «Бонусы» → <code>BonusAccrued</code> → «Уведомления». Отката нет, сбои лечатся повтором и идемпотентностью.</li>
        <li><b>Лист ожидания — хореография</b>: <code>BookingCancelled</code> → перевод в локальной транзакции → <code>WaitlistPromoted</code> → пуш. Порядок держит ключ партиции <code>class_session_id</code> (инцидент 2 — что бывает без него).</li>
      </ul>
      <p>Признак, что хореография разрослась и пора заводить оркестратор: чтобы ответить «на каком шаге застряло», нужно открыть журналы трёх сервисов.</p>`,
    report: ans => PROCS.map(p => `- ${p.t}: ${(ans.dec || {})[p.id] === 'orch' ? 'оркестрация' : (ans.dec || {})[p.id] === 'chor' ? 'хореография' : '—'} ${(ans.dec || {})[p.id] === p.ok ? '✓' : '✗'}; почему: ${((ans.q || {})[p.id] || []).map(i => strip(p.q.options[i].t)).join('') || '—'}`).join('\n')
  };

  // =====================================================================
  // Практика 4. Таблица saga_purchase своими словами
  // =====================================================================
  const SP_RUBRIC = [
    'Ключи и связи: id саги, client_id, membership_id, payment_id, сумма картой и бонусами, ключ идемпотентности для повторов; без ФИО и телефона',
    'Статус и текущий шаг: понятный список статусов — например STARTED, BONUS_RESERVED, PAYMENT_PENDING, PAID, ACTIVATED, COMPLETED; при откате COMPENSATING, COMPENSATED; FAILED — требует ручного разбора',
    'Время и повторы: created_at, updated_at, deadline_at текущего шага, attempts, next_retry_at — зависшие находятся запросом «deadline_at < now() и статус не финальный»',
    'Причина и история: last_error (какой шаг, что ответил участник) и журнал переходов по шагам (отдельная таблица шагов или jsonb)',
    'Как пользуется поддержка: поиск по клиенту и платежу, список зависших покупок, алерт дежурному, ручные действия «повторить шаг» и «запустить компенсацию»'
  ];
  const SP_REF = 'Таблица saga_purchase — одна строка на покупку. Связи: id (uuid саги), client_id, membership_id, payment_id, plan_code, amount_card_kopecks (5 080 000), bonus_amount (3 200), idempotency_key — с ним повторяем команды участникам без задвоений. ФИО и телефона нет — только client_id. Состояние: status — STARTED, MEMBERSHIP_CREATED, BONUS_RESERVED, PAYMENT_PENDING, PAID, ACTIVATED, BONUS_CONFIRMED, COMPLETED; при откате — COMPENSATING, COMPENSATED; FAILED — компенсация не прошла, нужен человек. current_step — номер и название шага. Время: created_at, updated_at, deadline_at текущего шага (оплата — 15 минут), attempts, next_retry_at. Причина: last_error — какой шаг и что ответил участник («ПэйПоинт: нет ответа 15 мин»). История — таблица saga_purchase_step (saga_id, step, action: do/compensate, result, at). Поддержка ищет покупку по client_id или payment_id и видит шаг, статус и причину. Экран «зависшие покупки»: deadline_at < now() и статус не финальный; алерт дежурному, если таких больше 0 дольше 15 минут. Ручные действия с журналом: «повторить шаг», «запустить компенсацию».';
  const taskTable = {
    id: 'saga-table', title: 'Таблица saga_purchase для поддержки',
    simple: howStuck.simple,
    lead: ui.brief({
      situation: 'Поддержка после инцидента 8: «Анна звонит: деньги списали, абонемента нет. Мы полчаса ищем по логам. Хотим открыть покупку и сразу видеть: на каком шаге, почему, что уже отменено и что нажать». Антон: «Оркестратор хранит состояние в таблице <code>saga_purchase</code>. Опишите её — поля и статусы».',
      todo: [
        'Напишите своими словами (от 200 знаков): какие поля нужны, какие статусы, как найти зависшие покупки и что видит и делает поддержка.',
        'Нажмите «Проверить с Верой (Claude)» или «Сверить с эталоном самому» и отметьте раскрытые пункты. Засчитывается от 60 %.'
      ],
      lookTitle: 'Из чего собрать',
      look: 'Вспомните строку <code>saga_pt</code> из теории и спросите себя: по каким номерам поддержка найдёт покупку? Как понять, что она зависла? Где причина? Что уже откатили? Что можно нажать руками — и кто это потом увидит?'
    }),
    blank: () => ({ j: {} }),
    reference: () => ({ j: { text: SP_REF, self: SP_RUBRIC.map(() => true) } }),
    render(el, ctx) {
      el.classList.add('asg-root');
      ui.justify(el, {
        id: 'asg-table', q: 'Таблица saga_purchase: какие поля и статусы, чтобы поддержка видела, где застряла покупка',
        qPlain: 'Опишите таблицу состояния саги saga_purchase для покупки абонемента с бонусами: какие поля и статусы нужны, как найти зависшие покупки и что видит и делает поддержка.',
        rubric: SP_RUBRIC, reference: SP_REF, value: ctx.ans.j, readonly: ctx.readonly, minLen: 200,
        onChange: v => { ctx.ans.j = v; ctx.save(); ctx.decide('Таблица saga_purchase', v.text || ''); }
      });
    },
    check(ans) {
      const s = ui.justifyScore(ans && ans.j);
      return { ok: s >= .6, score: s, summary: s ? `Оценка описания: ${Math.round(s * 100)} %.` : 'Опишите таблицу (от 200 символов) и проверьте с Верой или сверьте с эталоном сами.', notes: s && s < .6 ? [{ ok: false, html: 'Проверьте, есть ли: ключи для поиска, статусы и шаг, срок шага и попытки, причина и история, что видит и делает поддержка.' }] : [] };
    },
    explain: '<p>Таблица состояния саги — это одновременно память оркестратора (пережить перезапуск и выкатку) и окно для людей. Хороший тест: может ли сотрудник поддержки без разработчика за минуту ответить Анне «оплата прошла, абонемент активируется, бонусы спишутся в течение 10 минут» — или «мы вернули 50 800 ₽, они придут за 1–3 дня».</p><p>Статусы пишут <b>понятными словами процесса</b>, а не «state=7». Поле <code>deadline_at</code> превращает «зависла» из догадки в запрос. История шагов отвечает на вопрос «что уже откатили» — без неё ручная компенсация может отменить что-то второй раз.</p>',
    report: ans => (ans.j && ans.j.text) ? ans.j.text : '—'
  };

  // =====================================================================
  TR.stage({
    id: ID, act: 6, order: 340, slot: 'Чт 10:00', title: 'Саги',
    when: 'четверг, 10:00 · переговорная «Сайкл» · разбор инцидента 8 с Антоном и Сергеем',
    intro: [
      { who: 'sergey', html: 'За месяц 14 обращений: деньги за абонемент списаны, абонемент «ждёт оплаты», а бонусы клиента заморожены в резерве. Висят неделями. В логах — тишина: никто ничего не упал, просто никто ничего не сделал.' },
      { who: 'anton', html: 'Покупка с бонусами идёт через «Абонементы», «Платежи» и сервис «Бонусы» — общей транзакции у них нет и не будет. Это сага. И у нашей саги нет ответа на вопрос «а что, если шаг так и не ответил?».' },
      { who: 'vera', html: 'Сегодня разберём, почему тут не спасёт одна транзакция, как сага откатывается шагами назад, кто ею дирижирует — и проверим нашу покупку на сбое каждого шага. Ваша работа как аналитика — карта шагов, компенсаций и сроков: по ней пишут код и тесты.' }
    ],
    facts: ['F-psp', 'F-no-loss', 'F-psp-slow', 'F-overlap', 'F-pt', 'F-waitlist'],
    glossary: [
      { term: 'Сага', simple: 'Большое дело, разбитое на маленькие шаги в разных местах. У каждого шага есть «шаг назад» на случай, если дальше что-то сломается.', tech: 'Последовательность локальных транзакций в разных сервисах с компенсирующими действиями вместо общего отката. Даёт итоговую согласованность; промежуточные состояния видны.' },
      { term: 'Компенсирующее действие', simple: '«Шаг назад» для уже сделанного: вернуть деньги, снять бронь, закрыть абонемент.', tech: 'Бизнес-операция, отменяющая результат шага саги (не ROLLBACK, а новая транзакция). Выполняются в обратном порядке, обязаны быть идемпотентными и выдерживать «шага не было».' },
      { term: 'Точка невозврата (pivot)', simple: 'Момент, после которого покупку уже не отменяют — только доводят до конца.', tech: 'Шаг саги, после успеха которого последующие шаги не компенсируются, а повторяются до успеха (retriable). В покупке абонемента — активация.' },
      { term: 'Оркестрация саги', simple: 'Есть «дирижёр»: знает весь сценарий и по очереди командует участникам.', tech: 'Оркестратор отправляет команды участникам, ждёт ответов, хранит состояние саги и запускает компенсации. У «Пульса» — модуль «Продажи», таблица saga_purchase.' },
      { term: 'Хореография саги', simple: 'Дирижёра нет: каждый слушает события и сам знает, что делать дальше.', tech: 'Участники публикуют доменные события и подписаны на чужие. Слабая связанность, но процесс неявный, состояние собирается по журналам, возможны циклы.' },
      { term: 'Двухфазная фиксация (2PC)', simple: '«Все готовы? — Фиксируем!» Пока все не ответили, все держат замки.', tech: 'Протокол распределённой транзакции: фаза подготовки (участники блокируют данные) и фаза фиксации. Требует поддержки всеми участниками; блокировки на время самого медленного. «Пульс» не использует: ПэйПоинт не умеет, 3-D Secure длится минуты.' },
      { term: 'Зависшая сага', simple: 'Покупка, застрявшая посередине: никто не ответил, никто не отменил.', tech: 'Сага в нефинальном статусе, чей шаг не получил ответа и не имеет срока. Лечится дедлайном шага (deadline_at), планировщиком, запросом статуса у участника и алертом.' },
      { term: 'Резерв (холд)', simple: 'Отложить бонусы «на кассе»: потратить их в другом месте нельзя, но и списаны они ещё не окончательно.', tech: 'Предварительная блокировка ресурса участником саги (бонусы, окно тренера, сумма на карте) с последующим подтверждением или отменой.' },
      { term: 'Таблица состояния саги', simple: 'Карточка покупки: на каком она шаге, до какого времени ждём, что пошло не так.', tech: 'Таблица оркестратора (saga_purchase): ключи, статус, текущий шаг, deadline_at, attempts, last_error, история шагов. Нужна, чтобы пережить перезапуск, находить зависшие саги и показывать их поддержке.' }
    ],
    outro: 'Теперь вы видите покупку абонемента как цепочку шагов с отменами, сроками и точкой невозврата — и проверили её на сбое каждого шага. Инцидент 8 больше не повторится: у шага оплаты есть срок, сага сначала спрашивает ПэйПоинт, а поддержка видит покупку в saga_purchase. Завтра — пятница и комитет: соберём пакет документов, который аналитик приносит архитектору.',
    tasks: [howSaga, howStuck, howCoord, taskOrder, taskLab, taskCoord, taskTable]
  });
})();
