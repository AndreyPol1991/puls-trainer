/* Неделя 6, понедельник 10:00: монолит, модульный монолит или микросервисы. Канон — _dev/DOMAIN-2.md §5 (ADR-007).
   Теория (живая): три стиля на одной картинке (деплой, базы, сеть, что падает вместе) и признаки выноса;
   цена микросервисов (вызовы по сети, доступность цепочки, распределённая транзакция); ползунки «какой стиль подходит» и анатомия ADR.
   Практика: что выносить из ядра (8 частей), лаборатория «запись на занятие при разных стилях», ADR своими словами. */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc;

  if (!document.getElementById('ars-css')) document.head.insertAdjacentHTML('beforeend', `<style id="ars-css">
    .ars-root, .ars-root .stack, .ars-root .stack > * { min-width: 0; }
    .ars-root :not(pre) > code { white-space: normal; overflow-wrap: anywhere; }
    .ars-root .seg button { white-space: normal; text-align: left; }
    .ars-sub { font: 600 16px/1.3 var(--f-brand); display: flex; gap: 10px; align-items: baseline; }
    .ars-sub .l { font: 600 12px/1 var(--f-mono); color: var(--accent); border: 1px solid var(--accent); border-radius: 6px; padding: 3px 6px; }
    .ars-box { display: grid; gap: 12px; padding: 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); min-width: 0; }
    .ars-box > * { min-width: 0; }
    .ars-pic { display: grid; gap: 10px; padding: 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface-2); min-width: 0; }
    .ars-proc { border: 2px solid var(--border-strong); border-radius: 12px; padding: 10px; display: grid; gap: 8px; background: var(--surface); min-width: 0; }
    .ars-proc.down { border-color: var(--bad); background: var(--bad-soft); }
    .ars-proc.dep { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-glow); }
    .ars-proc > .h { font: 600 11px/1.3 var(--f-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--text-muted); display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
    .ars-proc.down > .h { color: var(--bad); }
    .ars-mods { display: grid; grid-template-columns: repeat(auto-fit, minmax(118px, 1fr)); gap: 8px; }
    .ars-mod { border: 1px solid var(--border-strong); border-radius: 9px; padding: 7px 9px; background: var(--surface-2); font-size: 13.5px; text-align: left; cursor: pointer; display: grid; gap: 2px; min-width: 0; color: var(--text); }
    .ars-mod small { font-size: 11.5px; color: var(--text-muted); overflow-wrap: anywhere; }
    .ars-mod.loose { border-style: dashed; }
    .ars-mod.down { border-color: var(--bad); background: var(--bad-soft); color: var(--bad); }
    .ars-mod.warn { border-color: var(--warn); background: var(--warn-soft); }
    .ars-mod.dep { border-color: var(--accent); background: var(--accent-soft); }
    .ars-mod:hover { border-color: var(--text-muted); }
    .ars-svcs { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
    .ars-db { border: 1px dashed var(--border-strong); border-radius: 10px; padding: 6px 10px; font: 12px/1.4 var(--f-mono); color: var(--text-2); background: var(--surface); overflow-wrap: anywhere; }
    .ars-db b { color: var(--text); }
    .ars-net { font: 12px/1.4 var(--f-mono); color: var(--warn); }
    .ars-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .ars-stats .v { font-size: 17px; }
    .ars-stats .stat.cur { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
    .ars-range { width: 100%; margin: 4px 0; accent-color: var(--accent); }
    .ars-inputs { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
    .ars-inputs .field b { font: 600 14px/1.2 var(--f-mono); color: var(--accent); }
    .ars-signs { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 6px 10px; }
    .ars-signs label { display: flex; gap: 8px; align-items: flex-start; font-size: 13.5px; cursor: pointer; padding: 7px 9px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); min-width: 0; }
    .ars-signs label > span { min-width: 0; }
    .ars-signs label.pro.on { border-color: var(--ok); background: var(--ok-soft); }
    .ars-signs label.con.on { border-color: var(--warn); background: var(--warn-soft); }
    .ars-signs input { accent-color: var(--accent); width: 16px; height: 16px; flex: none; margin-top: 2px; }
    .ars-styles3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .ars-styles3 .card { gap: 6px; }
    .ars-styles3 .card.best { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset; }
    .ars-styles3 .card h4 { display: flex; justify-content: space-between; gap: 6px; }
    .ars-why { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; font-size: 13px; color: var(--text-2); }
    .ars-why li::before { content: "→ "; color: var(--accent); }
    .ars-parts { display: grid; gap: 8px; }
    .ars-part { display: grid; grid-template-columns: minmax(0, 1.2fr) auto minmax(0, 1.2fr); gap: 8px 12px; align-items: center; border: 1px solid var(--border); border-radius: 10px; padding: 9px 12px; background: var(--surface-2); min-width: 0; }
    .ars-part > * { min-width: 0; }
    .ars-part .t b { display: block; font-size: 14.5px; }
    .ars-part .t small { font-size: 12.5px; color: var(--text-muted); }
    .ars-part select { width: 100%; min-width: 0; }
    .ars-part .why { grid-column: 1 / -1; font-size: 13px; color: var(--text-2); }
    .ars-part.ok { border-color: var(--ok); background: var(--ok-soft); }
    .ars-part.warn { border-color: var(--warn); background: var(--warn-soft); }
    .ars-part.bad { border-color: var(--bad); background: var(--bad-soft); }
    .ars-adr { display: grid; gap: 6px; }
    .ars-adr button { text-align: left; border: 1px solid var(--border); border-left: 3px solid var(--border-strong); border-radius: 8px; padding: 8px 10px; background: var(--surface-2); color: var(--text); font-size: 13.5px; cursor: pointer; display: grid; gap: 2px; }
    .ars-adr button b { font: 600 11px/1.3 var(--f-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--text-muted); }
    .ars-adr button[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); }
    .ars-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .ars-set { display: grid; grid-template-columns: minmax(0, 160px) minmax(0, 1fr); gap: 10px 14px; align-items: center; }
    .ars-set > .lbl { font-size: 13.5px; color: var(--text-2); }
    .ars-set > .seg { justify-self: start; max-width: 100%; }
    @media (max-width: 760px) {
      .ars-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .ars-styles3 { grid-template-columns: minmax(0, 1fr); }
      .ars-part { grid-template-columns: minmax(0, 1fr); }
      .ars-set { grid-template-columns: minmax(0, 1fr); gap: 4px; }
      .ars-set > .lbl { margin-top: 8px; }
    }
  </style>`);

  const L = (id, t, sub) => ({ id, t, sub });
  const tOf = (list, v) => { const x = list.find(o => o.v === v); return x ? String(x.t).replace(/<[^>]+>/g, '') : '—'; };
  const mount = (el, cls) => { const d = document.createElement('div'); if (cls) d.className = cls; el.appendChild(d); return d; };

  // =====================================================================
  // Теория 1. Три стиля на одной картинке + признаки выноса
  // =====================================================================
  const MODS = [
    { id: 'memb', t: 'Абонементы', team: 'команда 1' }, { id: 'book', t: 'Запись', team: 'команда 1' }, { id: 'pay', t: 'Платежи', team: 'команда 1' },
    { id: 'sched', t: 'Расписание', team: 'команда 2' }, { id: 'notif', t: 'Уведомления', team: 'команда 2' }, { id: 'bonus', t: 'Бонусы', team: 'команда 3' }
  ];
  const STY = [{ v: 'mono', t: 'Монолит' }, { v: 'modmono', t: 'Модульный монолит' }, { v: 'micro', t: 'Микросервисы' }];
  const STY_INFO = {
    mono: { deploy: '1', dbs: '1', net: '0', bound: 'Границ нет: любой код читает и пишет любую таблицу. Быстро на старте, через год — «тронешь Бонусы, сломаешь Платежи».', rel: 'Один общий релиз: три команды ждут друг друга в одной ветке.' },
    modmono: { deploy: '1', dbs: '1 (схема на модуль)', net: '0', bound: 'Граница — API модуля и своя схема в базе. Модуль ходит к соседу через его API (в памяти), чужие таблицы не трогает — это проверяет ArchUnit в сборке.', rel: 'Релиз по-прежнему общий, но команды не лезут в код друг друга.' },
    micro: { deploy: '6', dbs: '6', net: '2–3', bound: 'Граница — сеть. В чужую базу не залезть физически. Каждый вызов соседа — запрос по сети: задержка, таймауты, ретраи.', rel: 'Каждый выкатывается сам — но и каждый сам дежурит, мониторит и держит контракт API.' }
  };
  const DEP_ON = { book: ['memb', 'sched'] };   // запись синхронно спрашивает абонементы и расписание
  function stylesPic(st, broken, dep) {
    const one = st !== 'micro';
    const downAll = one && broken;
    const modCls = id => {
      if (dep && (one || id === 'bonus')) return 'dep';
      if (!broken) return st === 'mono' ? 'loose' : '';
      if (downAll || id === broken) return 'down';
      if (st === 'micro' && (DEP_ON[id] || []).includes(broken)) return 'warn';
      return st === 'mono' ? 'loose' : '';
    };
    const modBtn = m => `<button type="button" class="ars-mod ${modCls(m.id)}" data-mod="${m.id}"><span>${esc(m.t)}</span><small>${st === 'modmono' ? 'схема ' + m.id : st === 'micro' ? 'своя база' : esc(m.team)}</small></button>`;
    if (one) return `<div class="ars-pic"><div class="ars-proc ${downAll ? 'down' : ''} ${dep ? 'dep' : ''}"><div class="h"><span>процесс «Пульс-ядро» · 1 деплой · 6 экземпляров</span><span>${downAll ? 'упал целиком' : dep ? 'выкатывается целиком' : 'работает'}</span></div><div class="ars-mods">${MODS.map(modBtn).join('')}</div></div>
      <div class="ars-db">${st === 'mono' ? '<b>PostgreSQL</b> · общие таблицы: membership, booking, payment, class_session… — читает и пишет кто угодно' : '<b>PostgreSQL</b> · схемы: memb · book · pay · sched · notif · bonus — каждая только у своего модуля'}</div></div>`;
    return `<div class="ars-pic"><div class="ars-svcs">${MODS.map(m => `<div class="ars-proc ${broken === m.id ? 'down' : ''} ${dep && m.id === 'bonus' ? 'dep' : ''}"><div class="h"><span>сервис</span><span>${broken === m.id ? 'упал' : dep && m.id === 'bonus' ? 'выкатка' : ''}</span></div>${modBtn(m)}<div class="ars-db"><b>БД</b> ${m.id}</div></div>`).join('')}</div>
      <div class="ars-net">↔ по сети: Запись → Абонементы (активен ли абонемент?) · Запись → Расписание (занять место) · остальные — событиями через Kafka</div></div>`;
  }
  function stylesVerdict(st, broken, dep) {
    if (dep) {
      return st === 'micro'
        ? ui.note('ok', 'Выкатка «Бонусов»', 'Выкатывается один сервис. Команды 1 и 2 даже не знают о релизе. Но «Бонусы» сами отвечают за свой конвейер сборки, мониторинг и дежурство.')
        : ui.note('warn', 'Выкатка «Бонусов»', `Правка в одном модуле — а выкатывается всё ядро. Команда 3 ждёт общего релизного окна, команды 1 и 2 проверяют, не задело ли их.${st === 'modmono' ? ' Модульность помогает в коде, но не в выкатке.' : ''}`);
    }
    if (!broken) return ui.note('', 'Попробуйте', 'Нажмите на любой модуль — он «упадёт» (например, утечка памяти). Посмотрите, что упадёт вместе с ним. Потом нажмите «Выкатить правку в «Бонусах»».');
    const m = MODS.find(x => x.id === broken).t;
    if (st !== 'micro') return ui.note('bad', `Упали «${m}» — упало всё`, `Модули живут в одном процессе: утечка памяти или зависшие потоки в «${esc(m)}» роняют весь процесс — и запись, и оплату. ${st === 'modmono' ? '<b>Модульный монолит не изолирует отказы</b> — он наводит порядок в коде и данных, но процесс общий.' : ''} Балансировщик перезапустит экземпляры, но причина в каждом одна и та же.`);
    const deps = Object.keys(DEP_ON).filter(k => DEP_ON[k].includes(broken));
    return deps.length
      ? ui.note('warn', `Упали «${m}» — запись тоже не работает`, `Сервис «${esc(m)}» лежит один, но «Запись» синхронно спрашивает его по сети на каждой записи. Изоляция есть на бумаге: без таймаута, кэша или запасного варианта запись ждёт и падает вслед.`)
      : ui.note('ok', `Упали «${m}» — остальное работает`, `«${esc(m)}» общаются с остальными событиями. Упал сервис — события копятся в брокере и будут обработаны, когда он встанет. Запись и оплата этого не заметили.`);
  }

  const SIGNS = [
    { id: 'load', t: 'Своя нагрузка: масштабировать отдельно от ядра', pro: 1 },
    { id: 'fail', t: 'Сбой должен быть изолирован (или часть должна жить без ядра)', pro: 1 },
    { id: 'team', t: 'Своя команда и свой темп релизов', pro: 1 },
    { id: 'tech', t: 'Другое хранилище или технология', pro: 1 },
    { id: 'edge', t: 'Внешний периметр: устройства, партнёры, своя безопасность', pro: 1 },
    { id: 'tx', t: 'Частые общие транзакции с модулями ядра', pro: 0 },
    { id: 'chat', t: 'На каждый запрос ходит к соседям за данными', pro: 0 },
    { id: 'small', t: 'Небольшой, меняется вместе с ядром одной командой', pro: 0 }
  ];
  const CAND = {
    access: { t: 'Доступ', on: ['fail', 'tech', 'edge'], note: 'Вынесен ещё в сезоне 1: стоит рядом с турникетами, пускает клиентов без интернета по локальному списку, говорит с контроллерами по gRPC.' },
    sched: { t: 'Расписание', on: ['tx', 'chat', 'small'], note: 'Запись на занятие атомарно меняет счётчик мест в строке занятия — это одна транзакция с «Расписанием». Вынести — значит превратить один UPDATE в распределённую транзакцию.' },
    clients: { t: 'Клиенты', on: ['chat', 'small', 'tx'], note: 'Данные клиента нужны почти каждому запросу, а регистрация и покупка первого абонемента идут вместе. Отдельный сервис добавит сетевой вызов почти везде.' }
  };
  function signVerdict(on) {
    const p = SIGNS.filter(s => s.pro && on.has(s.id)).length, c = SIGNS.filter(s => !s.pro && on.has(s.id)).length;
    if (p >= 2 && c === 0) return ['ok', 'Выносить в отдельный сервис', p, c];
    if (p >= 2 && c >= 1) return ['warn', 'Спорно: сначала развязать общие транзакции (события, сага), потом выносить', p, c];
    if (c >= 2 && p <= 1) return ['info', 'Оставить модулем ядра', p, c];
    return ['', 'Пока модулем — и следить за признаками', p, c];
  }
  function drawSigns(box) {
    let cand = 'access', on = new Set(CAND.access.on);
    box.innerHTML = `<div class="stack"><div class="row"><span class="small dim">Кандидат (не из сегодняшнего задания):</span>${ui.seg('cand', Object.entries(CAND).map(([v, c]) => ({ v, t: c.t })), cand, 'accent')}</div>
      <div class="small muted" data-cnote></div>
      <div class="ars-signs" data-signs></div><div data-sv></div></div>`;
    function draw() {
      TR.$('[data-cnote]', box).innerHTML = CAND[cand].note + ' <i>Галочки выставлены по фактам — снимайте и ставьте, чтобы увидеть, как меняется вывод.</i>';
      TR.$('[data-signs]', box).innerHTML = SIGNS.map(s => `<label class="${s.pro ? 'pro' : 'con'} ${on.has(s.id) ? 'on' : ''}"><input type="checkbox" data-sg="${s.id}" ${on.has(s.id) ? 'checked' : ''}><span>${s.pro ? '＋' : '−'} ${esc(s.t)}</span></label>`).join('');
      const v = signVerdict(on);
      TR.$('[data-sv]', box).innerHTML = `<div class="row"><span class="chip ok">за вынос: ${v[2]}</span><span class="chip warn">против: ${v[3]}</span></div>` + ui.note(v[0], 'Вывод', `<b>${esc(v[1])}.</b> ${v[0] === 'ok' ? 'Признаков «за» несколько, общих транзакций нет — сеть здесь окупается.' : v[0] === 'warn' ? 'Причины выносить есть, но общие транзакции превратятся в распределённые. Это дорого — нужен план.' : v[0] === 'info' ? 'Отдельный сервис принесёт сетевые вызовы и распределённые транзакции, а пользы почти не даст.' : 'Одного признака мало, чтобы платить цену сети.'}`);
    }
    ui.onSeg(box, (n, v) => { if (n === 'cand') { cand = v; on = new Set(CAND[v].on); draw(); } });
    box.addEventListener('change', e => { const c = e.target.closest('[data-sg]'); if (!c) return; if (c.checked) on.add(c.dataset.sg); else on.delete(c.dataset.sg); draw(); });
    draw();
  }

  const howStyles = {
    id: 'how-styles', covers: ['split'], title: 'Как это работает: три стиля на одной картинке', free: true, noReset: true,
    simple: {
      icon: '🏢', plain: 'Монолит — одна программа. Модульный монолит — одна программа, внутри разделённая на отсеки с дверями. Микросервисы — много отдельных программ, которые общаются по сети.',
      analogy: 'Монолит — студия, где кухня, спальня и кабинет в одной комнате. Модульный монолит — квартира с комнатами и дверями: порядок, но один электрощиток — выбило пробки, темно везде. Микросервисы — отдельные домики: в одном пожар — другие стоят, зато между домиками ходить по улице, в дождь.',
      tech: '<b>Монолит</b>: один деплой, одна база, границ в коде нет. <b>Модульный монолит</b>: один деплой, модули с API и своей схемой в базе, зависимости проверяются (ArchUnit). <b>Микросервисы</b>: независимые деплои и базы, взаимодействие по сети (REST, gRPC, события).'
    },
    lead: ui.brief({
      situation: 'Шесть частей «Пульса»: абонементы, запись, платежи, расписание, уведомления, бонусы. Три команды. Одна и та же система, нарисованная в трёх стилях. Сначала смотрим механику, потом — признаки, по которым часть выносят в отдельный сервис.',
      todo: [
        'Переключайте «Монолит / Модульный монолит / Микросервисы» и смотрите на картинку и счётчики.',
        'Нажмите на модуль — он «упадёт». Найдите, в каком стиле падает всё, а в каком — один сервис. Отдельно попробуйте уронить «Абонементы» в микросервисах.',
        'Нажмите «Выкатить правку в «Бонусах»» в каждом стиле.',
        'Внизу переключайте кандидатов и галочки признаков — смотрите, как меняется вывод «выносить или нет».'
      ],
      look: 'Рамка — процесс (одна запущенная программа). Красная рамка — упало, жёлтая — работает, но ждёт упавшего соседа, зелёная подсветка — выкатывается. Пунктирная рамка модуля в монолите — «границ нет».'
    }),
    render(el) {
      el.classList.add('ars-root');
      let st = 'mono', broken = null, dep = false;
      el.innerHTML = `<div class="stack" style="gap:20px">
        <div class="row"><span class="small dim">Стиль:</span>${ui.seg('st', STY, st, 'accent')}<button type="button" class="btn sm" data-dep>Выкатить правку в «Бонусах»</button><button type="button" class="btn sm ghost" data-fix>Всё починить</button></div>
        <div data-pic></div><div class="ars-stats" data-stats></div><div data-verdict></div><div data-bound></div>
        <div class="ars-sub"><span class="l">2</span>Когда выносить часть в отдельный сервис</div>
        <div data-signs-box></div>
        ${ui.note('', 'Что здесь делает аналитик', 'Признаки — это требования. «Своя нагрузка» — из цифр нагрузки (300 тыс. пушей за вечер). «Изолировать сбой» — из требований доступности («запись работает всегда»). «Частые общие транзакции» — из сценариев: аналитик знает, какие операции меняют данные нескольких модулей сразу. Архитектор без этих фактов выбирает стиль по моде.')}
      </div>`;
      function draw() {
        const i = STY_INFO[st];
        TR.$('[data-pic]', el).innerHTML = stylesPic(st, broken, dep);
        const fell = broken ? (st === 'micro' ? 1 + Object.keys(DEP_ON).filter(k => DEP_ON[k].includes(broken)).length : 6) : 0;
        TR.$('[data-stats]', el).innerHTML = `
          <div class="stat"><div class="k">единиц деплоя</div><div class="v">${i.deploy}</div><div class="s">что выкатывается отдельно</div></div>
          <div class="stat"><div class="k">баз данных</div><div class="v">${i.dbs}</div><div class="s">кто чем владеет</div></div>
          <div class="stat"><div class="k">вызовов по сети</div><div class="v ${st === 'micro' ? 'warn' : 'ok'}">${i.net}</div><div class="s">на одну запись на занятие</div></div>
          <div class="stat"><div class="k">не работает</div><div class="v ${fell > 1 ? 'bad' : fell ? 'warn' : 'ok'}">${fell} из 6</div><div class="s">${broken ? 'после падения одного модуля' : 'нажмите на модуль'}</div></div>`;
        TR.$('[data-verdict]', el).innerHTML = stylesVerdict(st, broken, dep);
        TR.$('[data-bound]', el).innerHTML = `<div class="grid2"><div class="card flat"><div class="eyebrow">Границы</div><div class="small">${i.bound}</div></div><div class="card flat"><div class="eyebrow">Релизы</div><div class="small">${i.rel}</div></div></div>`;
      }
      ui.onSeg(el, (n, v) => { if (n === 'st') { st = v; draw(); } });
      TR.on(el, 'click', '[data-mod]', (e, b) => { dep = false; broken = broken === b.dataset.mod ? null : b.dataset.mod; draw(); });
      TR.on(el, 'click', '[data-dep]', () => { broken = null; dep = true; draw(); });
      TR.on(el, 'click', '[data-fix]', () => { broken = null; dep = false; draw(); });
      draw();
      drawSigns(TR.$('[data-signs-box]', el));
    }
  };

  // =====================================================================
  // Теория 2. Цена микросервисов: покупка абонемента
  // =====================================================================
  const BUY = [
    { id: 'memb', t: 'Абонементы', what: 'создать абонемент «ждёт оплаты»', writes: 1 },
    { id: 'clients', t: 'Клиенты', what: 'клиент есть, согласие на оферту есть', writes: 0 },
    { id: 'bonus', t: 'Бонусы', what: 'зарезервировать списание бонусов', writes: 1 },
    { id: 'pay', t: 'Платежи', what: 'создать платёж, ссылку на 3-D Secure', writes: 1 }
  ];
  const AV = [99, 99.5, 99.9, 99.95];
  const SAGA = {
    local: {
      lanes: [L('app', 'Приложение', 'Анна'), L('core', 'Ядро', 'Продажи, Абонементы, Платежи'), L('db', 'PostgreSQL', 'одна база')],
      sum: ['ok', 'Одна транзакция: либо всё, либо ничего. Сбой посередине — откат, как будто покупки не было. Ни «висящих» абонементов, ни ручной уборки.'],
      steps: [
        { from: 'app', to: 'core', t: 'купить «Сеть 12 мес»', note: 'Анна покупает абонемент.' },
        { from: 'core', to: 'db', t: 'BEGIN', note: 'Ядро открывает одну транзакцию в одной базе.' },
        { from: 'core', to: 'db', t: 'INSERT membership\n(ждёт оплаты)', note: 'Модуль «Абонементы» пишет в свою схему.' },
        { from: 'core', to: 'db', t: 'INSERT payment', note: 'Модуль «Платежи» пишет в свою схему — та же транзакция.' },
        { from: 'core', to: 'core', t: 'ошибка: нет\nсогласия на оферту', kind: 'bad', note: 'Посреди операции — ошибка.' },
        { from: 'core', to: 'db', t: 'ROLLBACK', kind: 'ok', note: 'Откат: обе строки исчезают разом. База сама гарантирует «всё или ничего».' },
        { from: 'core', to: 'app', t: '422 · ничего не создано', reply: true, kind: 'ok', note: 'Анна видит понятную ошибку. В базе чисто.' }
      ]
    },
    saga: {
      lanes: [L('app', 'Приложение', 'Анна'), L('sales', 'Продажи', 'оркестратор'), L('memb', 'Абонементы', 'свой сервис и база'), L('bonus', 'Бонусы', 'свой сервис и база'), L('pay', 'Платежи', 'свой сервис и база')],
      sum: ['warn', 'Каждый сервис зафиксировал своё у себя. Общего отката нет — откатывать приходится руками кода: компенсирующими шагами. Их надо придумать, описать в требованиях и протестировать. Это и есть сага; у «Пульса» она нужна только там, где без неё нельзя (бонусы — отдельный сервис).'],
      steps: [
        { from: 'app', to: 'sales', t: 'купить «Сеть 12 мес»', note: 'Анна покупает абонемент с бонусами.' },
        { from: 'sales', to: 'memb', t: 'создать (ждёт оплаты)', note: 'Вызов по сети. «Абонементы» сохраняют абонемент в своей базе и <b>фиксируют</b> — их транзакция закончилась.' },
        { from: 'memb', to: 'sales', t: 'ok', reply: true, kind: 'ok', note: 'Готово.' },
        { from: 'sales', to: 'bonus', t: 'зарезервировать 500', note: '«Бонусы» резервируют списание в своей базе и тоже фиксируют.' },
        { from: 'bonus', to: 'sales', t: 'ok', reply: true, kind: 'ok', note: 'Готово.' },
        { from: 'sales', to: 'pay', t: 'создать платёж', note: 'Вызов «Платежей»…' },
        { from: 'pay', to: 'sales', t: 'таймаут 5 с', lost: true, kind: 'bad', note: '…ответа нет. Создан платёж или нет — неизвестно. Общего ROLLBACK не существует: у каждого своя база.' },
        { from: 'sales', to: 'pay', t: 'статус платежа?', kind: 'warn', note: 'Оркестратор выясняет судьбу платежа (повтор с тем же ключом идемпотентности или запрос статуса).' },
        { from: 'sales', to: 'bonus', t: 'отменить резерв', kind: 'warn', note: 'Платёж не создан — запускаем <b>компенсации</b>: «Бонусы» снимают резерв…' },
        { from: 'sales', to: 'memb', t: 'абонемент → terminated', kind: 'warn', note: '…«Абонементы» закрывают абонемент. Состояние саги хранится в таблице <code>saga_purchase</code> — чтобы пережить перезапуск оркестратора.' },
        { from: 'sales', to: 'app', t: 'оплата не прошла', reply: true, note: 'Анна видит ошибку. Если бы компенсаций не было — бонусы висели бы в резерве навсегда (инцидент 8 сезона).' }
      ]
    }
  };
  const howCost = {
    id: 'how-cost', covers: ['lab'], title: 'Как это работает: цена микросервисов', free: true, noReset: true,
    simple: {
      icon: '🧾', plain: 'Каждая часть, вынесенная в отдельный сервис, превращает вызов функции в запрос по сети. Сеть медленнее, иногда рвётся, и одной транзакцией её не накрыть.',
      analogy: 'В квартире сказать «передай соль» — секунда. Если кухня в соседнем доме — надо звонить, ждать, перезванивать, если не взяли трубку. А если соль передали, а перец нет — сам разбирайся, что вернуть.',
      tech: 'Цена: задержка каждого вызова (p95 складывается), доступность цепочки — произведение доступностей (0,999³ ≈ 0,997), распределённые транзакции — саги с компенсациями вместо ROLLBACK, наблюдаемость (трассировки через сервисы), DevOps: конвейер, мониторинг и дежурство на каждый сервис.'
    },
    lead: ui.brief({
      situation: 'Соседний пример — покупка абонемента: Продажи (оркестратор в ядре) по очереди обращаются к «Абонементам», «Клиентам», «Бонусам» и «Платежам». Плюс внешний ПэйПоинт — он по сети всегда. Посчитаем, сколько стоит вынести каждого из них в отдельный сервис.',
      todo: [
        'Переключайте для каждой части «в ядре / отдельный сервис» — смотрите счётчики.',
        'Подвигайте ползунки «задержка одного вызова» и «доступность одного сервиса».',
        'Внизу проиграйте сбой посреди покупки: «одна транзакция» против «сага в сервисах».'
      ],
      look: 'Главные цифры: вызовов по сети на одну покупку, добавленная задержка, доступность всей цепочки в процентах и в минутах простоя за месяц (в месяце ≈ 43 200 минут). SLO «Пульса» — 99,9 %, это ≈ 43 минуты.'
    }),
    render(el) {
      el.classList.add('ars-root');
      const where = { memb: 'core', clients: 'core', bonus: 'svc', pay: 'core' };
      let lat = 20, av = 2, sc = 'local';
      el.innerHTML = `<div class="stack" style="gap:18px">
        <div class="ars-box"><div class="ars-set">${BUY.map(b => `<div class="lbl"><b>${esc(b.t)}</b><br><span class="small dim">${esc(b.what)}</span></div>${ui.seg('w-' + b.id, [{ v: 'core', t: 'в ядре' }, { v: 'svc', t: 'отдельный сервис' }], where[b.id], 'accent')}`).join('')}</div></div>
        <div class="ars-inputs">
          <label class="field"><span>Задержка одного вызова по сети (p95): <b data-o="lat"></b></span><input type="range" class="ars-range" min="5" max="100" step="5" value="${lat}" data-r="lat"></label>
          <label class="field"><span>Доступность одного сервиса: <b data-o="av"></b></span><input type="range" class="ars-range" min="0" max="3" step="1" value="${av}" data-r="av"></label>
        </div>
        <div class="ars-stats" data-stats></div>
        <div data-build></div>
        <div class="ars-sub"><span class="l">2</span>Сбой посреди покупки</div>
        <div class="row"><span class="small dim">Как устроено:</span>${ui.seg('sc', [{ v: 'local', t: 'Всё в ядре: одна транзакция' }, { v: 'saga', t: 'Отдельные сервисы: сага' }], sc, 'accent')}</div>
        <div data-seq></div><div data-sum></div>
      </div>`;
      function draw() {
        const n = BUY.filter(b => where[b.id] === 'svc').length, a = AV[av] / 100;
        const chain = 0.999 * Math.pow(a, n) * 0.999;   // ядро × сервисы × ПэйПоинт (у него своя доступность — берём 99,9 %)
        const down = Math.round((1 - chain) * 43200);
        const dist = BUY.some(b => b.writes && where[b.id] === 'svc');
        TR.$('[data-o="lat"]', el).textContent = lat + ' мс';
        TR.$('[data-o="av"]', el).textContent = String(AV[av]).replace('.', ',') + ' %';
        TR.$('[data-stats]', el).innerHTML = `
          <div class="stat"><div class="k">вызовов по сети</div><div class="v ${n ? 'warn' : 'ok'}">${n} + 1</div><div class="s">внутренних + ПэйПоинт</div></div>
          <div class="stat"><div class="k">добавит к ответу</div><div class="v ${n * lat > 150 ? 'bad' : n ? 'warn' : 'ok'}">+${n * lat} мс</div><div class="s">p95, без ретраев</div></div>
          <div class="stat"><div class="k">доступность цепочки</div><div class="v ${chain >= 0.998 ? 'ok' : chain >= 0.995 ? 'warn' : 'bad'}">${(chain * 100).toFixed(2).replace('.', ',')} %</div><div class="s">≈ ${down} мин простоя в месяц</div></div>
          <div class="stat"><div class="k">транзакция</div><div class="v ${dist ? 'warn' : 'ok'}">${dist ? 'сага' : 'одна'}</div><div class="s">${dist ? 'компенсации вместо отката' : 'ROLLBACK, если что'}</div></div>`;
        const items = [];
        if (n >= 1) items.push('таймауты и повторы с ключом идемпотентности на каждом вызове', 'контракт API на каждый сервис и его версии', 'сквозная трассировка: один <code>traceId</code> через все сервисы');
        if (n >= 2) items.push('предохранители (circuit breaker), чтобы зависший сосед не съел потоки', 'отдельный конвейер сборки, мониторинг и дежурство на каждый сервис');
        if (dist) items.push('сага: состояние в таблице, компенсации на каждый шаг, сценарии «что если» в требованиях');
        TR.$('[data-build]', el).innerHTML = items.length ? ui.note('warn', `Что придётся построить и поддерживать (${items.length})`, `<ul class="checks">${items.map(x => `<li class="warn">${x}</li>`).join('')}</ul>`) : ui.note('ok', 'Строить ничего не нужно', 'Все части в ядре: вызовы в памяти, одна транзакция, один процесс в мониторинге. Это и есть главное преимущество монолита.');
      }
      const seq = ui.seq(TR.$('[data-seq]', el), { lanes: SAGA[sc].lanes, steps: SAGA[sc].steps, laneW: 150, title: 'Сбой посреди покупки абонемента', hint: 'Нажмите «Проиграть» или «Шаг →».', onEnd: () => { const s = SAGA[sc].sum; TR.$('[data-sum]', el).innerHTML = ui.note(s[0], 'Итог', s[1]); } });
      ui.onSeg(el, (n, v) => {
        if (n.startsWith('w-')) { where[n.slice(2)] = v; draw(); }
        if (n === 'sc') { sc = v; TR.$('[data-sum]', el).innerHTML = ''; const box = TR.$('[data-seq]', el); box.innerHTML = ''; const d = mount(box); const s2 = ui.seq(d, { lanes: SAGA[sc].lanes, steps: SAGA[sc].steps, laneW: 150, title: 'Сбой посреди покупки абонемента', hint: 'Нажмите «Проиграть» или «Шаг →».', onEnd: () => { const s = SAGA[sc].sum; TR.$('[data-sum]', el).innerHTML = ui.note(s[0], 'Итог', s[1]); } }); s2.play(); }
      });
      el.addEventListener('input', e => { const r = e.target.closest('[data-r]'); if (!r) return; if (r.dataset.r === 'lat') lat = +r.value; else av = +r.value; draw(); });
      draw();
      return seq;
    }
  };

  // =====================================================================
  // Теория 3. Какой стиль подходит + анатомия ADR
  // =====================================================================
  const TEAM = [2, 4, 8, 15, 30, 60, 120, 200], SPREAD = [1, 3, 10, 30, 100, 1000];
  function fitScores(s) {
    const team = TEAM[s.team], spread = SPREAD[s.spread];
    const mono = (team <= 8 ? 2 : team <= 15 ? 0.5 : 0) + (s.tx >= 50 ? 1 : 0) + (spread <= 3 ? 1 : 0) + (s.rel === 0 ? 1 : 0);
    const modmono = (team <= 8 ? 1.5 : team <= 60 ? 2.5 : 0.5) + (s.tx >= 30 ? 1 : 0) + (spread >= 10 ? 1 : 0.5) + (s.rel <= 3 ? 1 : 0);
    const micro = (team >= 60 ? 2 : team >= 30 ? 1 : 0) + (s.tx <= 20 ? 1.5 : s.tx <= 40 ? 0.5 : -1) + (spread >= 30 ? 1 : 0) + (s.rel >= 4 ? 1 : 0);
    return { mono, modmono, micro };
  }
  function fitWhy(s) {
    const team = TEAM[s.team], spread = SPREAD[s.spread], w = { mono: [], modmono: [], micro: [] };
    if (team <= 8) w.mono.push(`${team} разработчиков помещаются в одну комнату — делить код по сети незачем`);
    else if (team <= 60) w.modmono.push(`${team} разработчиков — несколько команд; им нужны границы в коде, но не обязательно сеть`);
    else w.micro.push(`${team} разработчиков — десятки команд мешают друг другу в одном релизе`);
    if (s.tx >= 50) { w.mono.push(`${s.tx} % операций меняют несколько частей сразу — одна транзакция бесценна`); w.modmono.push('общие транзакции остаются локальными'); }
    else if (s.tx <= 20) w.micro.push(`всего ${s.tx} % общих операций — распределённых транзакций будет мало`);
    else w.modmono.push(`${s.tx} % общих операций — резать по сети дорого`);
    if (spread >= 10) { w.modmono.push(`нагрузка различается в ${spread} раз — горячие части выносим отдельно`); if (spread >= 30) w.micro.push('разная нагрузка — масштабировать по частям'); }
    else w.mono.push('нагрузка ровная — масштабируем целиком');
    if (s.rel >= 4) w.micro.push(`${s.rel} частей хотят свой темп релизов`);
    else if (s.rel >= 1) w.modmono.push(`${s.rel} ${TR.plural(s.rel, 'часть хочет', 'части хотят', 'частей хотят')} свой ритм — их и выносим`);
    else w.mono.push('все выкатываются вместе — общий релиз не мешает');
    return w;
  }
  const PRESETS = {
    mvp: { t: '«Пульс» год назад', s: { team: 1, tx: 70, spread: 1, rel: 0 } },
    now: { t: '«Пульс» сейчас', s: { team: 3, tx: 60, spread: 4, rel: 3 } },
    mp: { t: 'Маркетплейс, 200 разработчиков', s: { team: 7, tx: 10, spread: 5, rel: 5 } }
  };
  const ADR_PARTS = [
    { id: 'status', t: 'Статус', ex: 'Принято · 2025-09-12 · комитет: Тимур, архитектор, аналитик', what: 'Предложено / принято / заменено другим ADR. Решения не стирают — заменяют новым ADR со ссылкой.', an: 'Аналитик следит, чтобы требования ссылались на действующий ADR.' },
    { id: 'ctx', t: 'Контекст', ex: 'Интернет в клубах области пропадает (F-offline), турникет должен открыться быстрее секунды (F-turnstile-fast), у «ПроходПро» есть локальный контроллер со списком пропусков.', what: 'Факты и ограничения, из-за которых вообще нужно решение. Цифры, требования, боли.', an: '<b>Главный вклад аналитика</b>: факты из блокнота, цифры нагрузки, сценарии качества («проход ≤ 1 с даже без интернета»).' },
    { id: 'opts', t: 'Варианты', ex: '1) Модуль «Доступ» в ядре, турникет спрашивает ядро по сети. 2) Отдельный сервис рядом с контроллерами, офлайн-список. 3) Только локальный контроллер без связи с ядром.', what: 'Два-три реальных варианта с плюсами и минусами. Без вариантов ADR превращается в приказ.', an: 'Аналитик проверяет каждый вариант по сценариям: «интернет пропал», «клиент заморозил абонемент 5 минут назад».' },
    { id: 'dec', t: 'Решение', ex: 'Вариант 2: сервис «Доступ» отдельно; решение принимает по локальному списку, события проходов — в ядро, когда связь есть.', what: 'Что выбрали — одной-двумя фразами, без «возможно».', an: 'Аналитик переводит решение в требования и контракты: какие события, какой список, какой срок устаревания.' },
    { id: 'cons', t: 'Последствия', ex: '+ проход работает без интернета; + отказ ядра не останавливает турникеты. − заморозка доходит до турникета с задержкой; − ещё один сервис в дежурстве; − нужна сверка проходов.', what: 'И хорошие, и плохие. Плохие — обязательно: это цена, которую согласились платить.', an: 'Аналитик пишет, как бизнес живёт с минусами: «заморозка вступает в силу на турникете в течение 5 минут» — и согласует это с заказчиком.' }
  ];
  const howFit = {
    id: 'how-fit', covers: ['adr'], title: 'Как это работает: какой стиль подходит и как записать решение', free: true, noReset: true,
    simple: {
      icon: '⚖️', plain: 'Стиль выбирают не по моде, а по четырём вопросам: сколько людей, как часто части меняют данные вместе, одинаковая ли у них нагрузка, хотят ли они выкатываться по отдельности.',
      analogy: 'Семье из трёх человек нужна квартира, а не три домика. Общежитию на 200 человек — подъезды с отдельными входами. Строят под жильцов, а не под картинку из журнала.',
      tech: 'Закон Конвея: архитектура повторяет структуру команд. Микросервисы окупаются при многих независимых командах, слабо связанных данных и разной нагрузке. Решение фиксируют в ADR (Architecture Decision Record): контекст → варианты → решение → последствия.'
    },
    lead: ui.brief({
      situation: 'Ольга спросила Тимура: «Почему у конкурентов микросервисы, а у нас нет — мы отстаём?» Тимур хочет ответить не мнением, а расчётом. Покрутим четыре ползунка на трёх готовых компаниях, а потом разберём, как такие решения записывают.',
      todo: [
        'Нажмите на готовые варианты: «“Пульс” год назад», «“Пульс” сейчас», «Маркетплейс». Посмотрите, какая карточка подсветилась и почему.',
        'Двигайте ползунки по одному и найдите, при каких значениях выигрывают микросервисы.',
        'Внизу нажимайте на части ADR — пример из сезона 1, «Доступ — отдельный сервис».'
      ],
      look: 'Три карточки — три стиля. Подсвеченная — лучший при текущих ползунках. Стрелки под каждой — какие ползунки её поддерживают. Это учебная модель, а не формула: она показывает, куда тянет каждый фактор.'
    }),
    render(el) {
      el.classList.add('ars-root');
      const s = Object.assign({}, PRESETS.now.s);
      let part = 'ctx';
      el.innerHTML = `<div class="stack" style="gap:18px">
        <div class="row"><span class="small dim">Готовые варианты:</span>${Object.entries(PRESETS).map(([k, p]) => `<button type="button" class="btn sm" data-pre="${k}">${esc(p.t)}</button>`).join('')}</div>
        <div class="ars-inputs">
          <label class="field"><span>Разработчиков: <b data-o="team"></b></span><input type="range" class="ars-range" min="0" max="${TEAM.length - 1}" step="1" data-r="team"></label>
          <label class="field"><span>Операций, меняющих несколько частей сразу: <b data-o="tx"></b></span><input type="range" class="ars-range" min="0" max="100" step="10" data-r="tx"></label>
          <label class="field"><span>Самая «горячая» часть нагружена больше остальных в: <b data-o="spread"></b></span><input type="range" class="ars-range" min="0" max="${SPREAD.length - 1}" step="1" data-r="spread"></label>
          <label class="field"><span>Частей, которым нужен свой темп релизов: <b data-o="rel"></b></span><input type="range" class="ars-range" min="0" max="5" step="1" data-r="rel"></label>
        </div>
        <div class="ars-styles3" data-cards></div>
        <div data-fitnote></div>
        <div class="ars-sub"><span class="l">2</span>Как записать решение: ADR</div>
        <div class="grid2" style="align-items:start"><div class="ars-adr" data-adr></div><div data-adr-out></div></div>
      </div>`;
      const setInputs = () => { TR.$$('[data-r]', el).forEach(r => { r.value = s[r.dataset.r]; }); };
      function draw() {
        TR.$('[data-o="team"]', el).textContent = TEAM[s.team];
        TR.$('[data-o="tx"]', el).textContent = s.tx + ' %';
        TR.$('[data-o="spread"]', el).textContent = SPREAD[s.spread] + ' раз';
        TR.$('[data-o="rel"]', el).textContent = s.rel;
        const sc = fitScores(s), w = fitWhy(s), best = Object.keys(sc).reduce((a, b) => sc[b] > sc[a] ? b : a);
        const max = Math.max(5.5, ...Object.values(sc));
        const name = { mono: 'Монолит', modmono: SPREAD[s.spread] >= 10 || s.rel >= 1 ? 'Модульный монолит + вынести горячие части' : 'Модульный монолит', micro: 'Микросервисы' };
        TR.$('[data-cards]', el).innerHTML = ['mono', 'modmono', 'micro'].map(k => `<div class="card ${k === best ? 'best' : ''}"><h4><span>${esc(name[k])}</span>${k === best ? ui.status('подходит', 'ok') : ''}</h4>${ui.meter(Math.max(0, sc[k]) / max, k === best ? 'ok' : '')}<ul class="ars-why">${w[k].map(x => `<li>${esc(x)}</li>`).join('') || '<li class="dim">ползунки сейчас не в его пользу</li>'}</ul></div>`).join('');
        TR.$('[data-fitnote]', el).innerHTML = best === 'micro'
          ? ui.note('warn', 'Микросервисы окупаются здесь', 'Много команд, мало общих транзакций, разная нагрузка. Цена сети (предыдущий раздел) платится — но её платят десятки команд, и каждая выигрывает свободу.')
          : best === 'mono'
            ? ui.note('', 'Хватит монолита', 'Маленькая команда и общие данные. Можно сразу делать модульный — если ждёте роста. «Пульс» так и сделал в MVP.')
            : ui.note('ok', 'Модульный монолит + отдельные сервисы там, где есть признаки', 'Ядро с частыми общими транзакциями — одним процессом. Части со своей нагрузкой, командой или периметром — отдельно. Это решение комитета «Пульса» (ADR-007).');
      }
      function drawAdr() {
        TR.$('[data-adr]', el).innerHTML = ADR_PARTS.map(p => `<button type="button" data-ap="${p.id}" aria-pressed="${p.id === part}"><b>${esc(p.t)}</b><span class="small">${esc(p.ex)}</span></button>`).join('');
        const p = ADR_PARTS.find(x => x.id === part);
        TR.$('[data-adr-out]', el).innerHTML = `<div class="card flat"><div class="eyebrow">${esc(p.t)}</div><p>${p.what}</p>${ui.note('ok', 'Что приносит аналитик', p.an)}</div>`;
      }
      TR.on(el, 'click', '[data-pre]', (e, b) => { Object.assign(s, PRESETS[b.dataset.pre].s); setInputs(); draw(); });
      TR.on(el, 'click', '[data-ap]', (e, b) => { part = b.dataset.ap; drawAdr(); });
      el.addEventListener('input', e => { const r = e.target.closest('[data-r]'); if (!r) return; s[r.dataset.r] = +r.value; draw(); });
      setInputs(); draw(); drawAdr();
    }
  };

  // =====================================================================
  // Практика 1. Что выносить из ядра
  // =====================================================================
  const REASONS = [
    { v: 'load', t: 'Своя нагрузка — масштабировать отдельно' },
    { v: 'fail', t: 'Его сбой не должен задевать запись' },
    { v: 'team', t: 'Своя команда и свой темп релизов' },
    { v: 'ext', t: 'Внешний трафик: партнёры, лимиты, OAuth' },
    { v: 'store', t: 'Своё хранилище и тяжёлые запросы' },
    { v: 'vendor', t: 'Внешний поставщик и своя пиковая нагрузка' },
    { v: 'tx', t: 'Частые общие транзакции с соседями' },
    { v: 'one', t: 'Одна команда, общий релиз — делить незачем' },
    { v: 'fashion', t: 'Микросервисы — это современно' },
    { v: 'mess', t: 'Код запутан — сеть наведёт порядок' }
  ];
  const PARTS = [
    { id: 'notif', t: 'Уведомления', sub: 'до 300 тыс. пушей за вечер воскресенья; SMS-шлюз иногда думает 5–10 с', ok: 'out', reasons: ['load', 'fail'], why: 'Своя нагрузка и изоляция: зависший SMS-шлюз не должен занимать потоки ядра. Своя очередь RabbitMQ.' },
    { id: 'partner', t: 'Партнёрский шлюз', sub: 'ФитПасс и ещё 3 агрегатора: ретраи, OAuth, лимиты', ok: 'out', reasons: ['ext', 'team', 'load'], why: 'Внешний трафик с чужими ретраями — за свою дверь с лимитами и OAuth. Свой ритм релизов под партнёров.' },
    { id: 'anal', t: 'Аналитика и рекомендации', sub: 'тяжёлые отчёты директора, история посещений, пересчёт раз в сутки', ok: 'out', reasons: ['store', 'load'], why: 'Тяжёлые запросы не должны тормозить запись. Своя база ClickHouse, данные — из событий Kafka.' },
    { id: 'bonus', t: 'Бонусы', sub: 'новый домен, новая команда; резервирует бонусы при покупке абонемента', ok: 'out', alt: 'in', reasons: ['team', 'fail'], why: 'Новая команда и новый домен, общается событиями. Оставить в ядре тоже можно — тогда без саги при покупке, но с общей очередью релизов.' },
    { id: 'stream', t: 'Онлайн-трансляции', sub: 'до 2 000 зрителей на эфир, видео — у внешнего сервиса', ok: 'out', alt: 'in', reasons: ['vendor', 'load'], why: 'Внешний видеосервис и своя пиковая нагрузка в начале эфира. Запись на эфир могла бы жить в ядре — комитет вынес всё целиком.' },
    { id: 'memb', t: 'Абонементы', sub: 'покупка, заморозка, продление', ok: 'in', reasons: ['tx', 'one'], why: 'Покупка абонемента — общая транзакция с платежами, запись проверяет активный абонемент. Одна команда.' },
    { id: 'book', t: 'Запись', sub: '400 записей в секунду в пик, атомарный счётчик мест', ok: 'in', reasons: ['tx', 'one'], why: 'Запись меняет места в занятии и проверяет абонемент — в одной транзакции. 400 записей/с держит одна PostgreSQL.' },
    { id: 'pay', t: 'Платежи', sub: 'оплата, возвраты, вебхуки ПэйПоинта', ok: 'in', reasons: ['tx', 'one'], why: 'Платёж и активация абонемента — одна транзакция. Вынести — значит сделать сагу там, где сейчас COMMIT.' }
  ];
  const DEC = [{ v: 'out', t: 'Вынести в сервис' }, { v: 'in', t: 'Оставить в ядре' }];
  function partState(p, a) {
    const d = (a.dec || {})[p.id], r = (a.why || {})[p.id];
    const decS = !d ? 'none' : d === p.ok ? 'ok' : d === p.alt ? 'warn' : 'bad';
    const rS = !r ? 'none' : p.reasons.includes(r) ? 'ok' : (r === 'fashion' || r === 'mess') ? 'trap' : 'bad';
    return { d, r, decS, rS };
  }
  function splitPic(a) {
    const dec = a.dec || {};
    const inCore = PARTS.filter(p => dec[p.id] === 'in'), out = PARTS.filter(p => dec[p.id] === 'out');
    const warns = [];
    ['memb', 'book', 'pay'].forEach(id => { if (dec[id] === 'out') warns.push(`«${PARTS.find(p => p.id === id).t}» вне ядра — общие транзакции с соседями станут сагами.`); });
    if (dec.notif === 'in') warns.push('«Уведомления» в ядре — зависший SMS-шлюз снова может занять потоки записи (как в «воскресенье, 40 минут»).');
    if (dec.anal === 'in') warns.push('«Аналитика» в ядре — отчёт директора по истории посещений будет нагружать ту же базу, что запись в пик.');
    return `<div class="ars-pic"><div class="grid2" style="align-items:start">
      <div class="ars-proc"><div class="h"><span>ядро · модульный монолит</span><span>${inCore.length}</span></div><div class="ars-mods">${inCore.map(p => `<span class="ars-mod" style="cursor:default">${esc(p.t)}</span>`).join('') || '<span class="small dim">пока пусто</span>'}<span class="ars-mod" style="cursor:default;opacity:.7">Клиенты<small>всегда в ядре</small></span><span class="ars-mod" style="cursor:default;opacity:.7">Расписание<small>всегда в ядре</small></span></div></div>
      <div class="stack tight"><div class="ars-svcs">${out.map(p => `<div class="ars-proc"><div class="h"><span>сервис</span></div><span class="ars-mod" style="cursor:default">${esc(p.t)}</span></div>`).join('')}<div class="ars-proc" style="opacity:.7"><div class="h"><span>сервис · с сезона 1</span></div><span class="ars-mod" style="cursor:default">Доступ</span></div></div></div></div>
      <div class="small">Единиц деплоя: <b>${1 + out.length + 1}</b> на 15 разработчиков${out.length >= 7 ? ' — уже почти по сервису на двоих: кто будет дежурить?' : ''}.</div>
      ${warns.length ? `<ul class="checks">${warns.map(x => `<li class="warn">${esc(x)}</li>`).join('')}</ul>` : ''}</div>`;
  }
  const splitTask = {
    id: 'split', title: 'Что выносить из ядра',
    simple: {
      icon: '✂️', plain: 'Выносить часть в отдельный сервис стоит, только когда у неё есть своя причина: нагрузка, команда, внешний периметр, изоляция сбоя. Иначе — оставить модулем.',
      analogy: 'Из квартиры выносят в отдельное помещение то, что шумит, пахнет или нужно соседям: мастерскую, склад, приёмную для гостей. Кухню и ванную оставляют — ими пользуются вместе каждый день.',
      tech: 'Признаки выноса: независимое масштабирование, изоляция отказов, своя команда и темп релизов, отдельное хранилище, внешний периметр. Против: частые общие транзакции, «болтливость» (много синхронных вызовов), одна команда.'
    },
    lead: ui.brief({
      situation: 'Комитет ADR-007 в пятницу. Антон положил на стол восемь частей: пять кандидатов на вынос и три части ядра. 15 разработчиков в трёх командах; пик — 400 записей в секунду; до 300 тыс. пушей за вечер воскресенья; ФитПасс и ещё три агрегатора; «Клиенты», «Расписание» и сервис «Доступ» не обсуждаются.',
      todo: [
        'Для каждой части выберите: <b>«Вынести в сервис»</b> или <b>«Оставить в ядре»</b>.',
        'В выпадающем списке выберите <b>главный довод</b> — признак, на котором держится решение.',
        'Смотрите на картинку внизу: что осталось в ядре, сколько единиц деплоя, какие появились предупреждения. Потом «Проверить».'
      ],
      look: 'Картинка внизу собирается из ваших решений. Жёлтые предупреждения — последствия, которые придётся объяснять на комитете. У двух частей допустимы оба решения — с оговорками, их покажет разбор.'
    }),
    blank: () => ({ dec: {}, why: {} }),
    reference: () => ({ dec: Object.fromEntries(PARTS.map(p => [p.id, p.ok])), why: Object.fromEntries(PARTS.map(p => [p.id, p.reasons[0]])) }),
    render(el, ctx) {
      el.classList.add('ars-root');
      const a = ctx.ans; a.dec = a.dec || {}; a.why = a.why || {};
      const rv = !!ctx.result;
      el.innerHTML = `<div class="stack"><div class="ars-parts">${PARTS.map(p => {
        const s = partState(p, a), cls = rv && s.d ? (s.decS === 'bad' || s.rS === 'trap' ? 'bad' : s.decS === 'warn' || s.rS !== 'ok' ? 'warn' : 'ok') : '';
        return `<div class="ars-part ${cls}"><div class="t"><b>${esc(p.t)}</b><small>${esc(p.sub)}</small></div>${ui.seg('d-' + p.id, DEC, s.d, 'accent')}
          <select data-why="${p.id}" aria-label="Главный довод: ${esc(p.t)}" ${ctx.readonly ? 'disabled' : ''}><option value="">Главный довод…</option>${REASONS.map(r => `<option value="${r.v}" ${s.r === r.v ? 'selected' : ''}>${esc(r.t)}</option>`).join('')}</select>
          ${rv || ctx.readonly ? `<div class="why">${esc(p.why)}</div>` : ''}</div>`;
      }).join('')}</div><div class="eyebrow">Что получилось</div><div data-pic></div></div>`;
      if (ctx.readonly) TR.$$('[data-seg] button', el).forEach(b => { b.disabled = true; });
      const pic = () => { TR.$('[data-pic]', el).innerHTML = splitPic(a); };
      const decide = () => ctx.decide('Что вынести из ядра', PARTS.map(p => `${p.t}: ${a.dec[p.id] === 'out' ? 'сервис' : a.dec[p.id] === 'in' ? 'ядро' : '—'}${a.why[p.id] ? ' (' + tOf(REASONS, a.why[p.id]) + ')' : ''}`).join('; '));
      ui.onSeg(el, (n, v) => { if (ctx.readonly || !n.startsWith('d-')) return; a.dec[n.slice(2)] = v; ctx.save(); decide(); pic(); });
      el.addEventListener('change', e => { const s = e.target.closest('[data-why]'); if (!s || ctx.readonly) return; if (s.value) a.why[s.dataset.why] = s.value; else delete a.why[s.dataset.why]; ctx.save(); decide(); });
      pic();
    },
    check(ans) {
      const notes = []; let pts = 0, bad = 0, traps = 0, empty = 0;
      PARTS.forEach(p => {
        const s = partState(p, ans);
        if (!s.d) { empty++; return; }
        if (s.decS === 'ok') pts += 0.6;
        else if (s.decS === 'warn') { pts += 0.45; notes.push({ ok: 'warn', html: `<b>${esc(p.t)}</b> в ядре — допустимо с оговоркой. ${p.id === 'bonus' ? 'Новой команде придётся жить в общем релизе ядра, зато покупка с бонусами — без саги. Комитет выбрал вынос: команда новая, домен новый, общение только событиями.' : 'Запись на эфир могла бы жить в ядре, а видео всё равно у внешнего сервиса. Но 2 000 зрителей в начале эфира — своя пиковая нагрузка; комитет вынес целиком.'}` }); }
        else {
          bad++;
          const hint = { notif: 'Вспомните прошлое воскресенье: зависший внешний вызов в общем пуле потоков положил запись на 40 минут. Где SMS-шлюз сейчас?', partner: 'Кто управляет трафиком ФитПасса — их ретраи, их пик 50 запросов/с? Нужна ли этому трафику своя дверь?', anal: 'Отчёт директора по трём годам посещений и запись 400/с — в одной базе. Что будет в воскресенье?', memb: 'Сколько операций абонемента идут в одной транзакции с платежами и записью? Что станет с COMMIT?', book: '400 записей/с — это много для сети, но норма для одной PostgreSQL. А места в занятии и абонемент проверяются в той же транзакции.', pay: 'Платёж и активация абонемента сейчас — один COMMIT. Что будет вместо него, если их разнести?' }[p.id];
          notes.push({ ok: false, html: `<b>${esc(p.t)}</b>: ${hint || 'посмотрите на признаки ещё раз.'}` });
        }
        if (s.rS === 'ok') pts += 0.4;
        else if (s.rS === 'trap') { traps++; notes.push({ ok: false, html: `<b>${esc(p.t)}</b>: «${esc(tOf(REASONS, s.r))}» — не довод для комитета. ${s.r === 'fashion' ? 'Антон спросит: «какую проблему “Пульса” это решает?»' : 'Запутанный код распутывают границами модулей; сеть превратит запутанный код в запутанную распределённую систему.'}` }); }
        else if (s.rS === 'bad') { pts += s.decS === 'ok' && s.r && (p.ok === 'out' ? ['load', 'fail', 'team', 'ext', 'store', 'vendor'] : ['tx', 'one']).includes(s.r) ? 0.2 : 0; notes.push({ ok: 'warn', html: `<b>${esc(p.t)}</b>: довод «${esc(tOf(REASONS, s.r))}» не главный. Что в описании части бросается в глаза первым?` }); }
        else notes.push({ ok: false, html: `<b>${esc(p.t)}</b>: не выбран главный довод.` });
      });
      if (empty) notes.push({ ok: false, html: `Без решения частей: ${empty}.` });
      if (!bad && !empty && !traps) notes.unshift({ ok: true, html: 'Ядро и сервисы разделены по признакам, а не по вкусу.' });
      const score = pts / PARTS.length;
      const ok = !bad && !empty && !traps && score >= 0.8;
      return { ok, score, notes, summary: `Решений по сути верно: ${PARTS.length - bad - empty} из ${PARTS.length} · ловушек в доводах: ${traps}.`, vera: ok ? null : 'Для каждой части задайте два вопроса: «что у неё своё — нагрузка, команда, периметр, хранилище?» и «с кем она меняет данные в одной транзакции?». Первое тянет наружу, второе — внутрь.' };
    },
    explain: `${ui.table(['Часть', 'Решение ADR-007', 'Главный довод'], PARTS.map(p => [esc(p.t), p.ok === 'out' ? 'сервис' + (p.alt ? ' (допустимо и ядро)' : '') : 'ядро', esc(p.why)]))}
      <p>Ядро остаётся модульным монолитом не «потому что так проще», а потому что абонементы, запись и платежи меняют данные вместе: покупка = абонемент + платёж, запись = место + проверка абонемента. Распределённые транзакции там стоили бы дороже пользы. А пять вынесенных частей общаются с ядром событиями — им не нужна общая транзакция.</p>
      <p>В проде: 7 единиц деплоя (ядро, «Доступ» и пять сервисов) на 15 человек — по сервису на 2 человека в среднем. Больше — и дежурства съедят разработку.</p>`,
    report: ans => PARTS.map(p => `- ${p.t}: ${(ans.dec || {})[p.id] === 'out' ? 'сервис' : (ans.dec || {})[p.id] === 'in' ? 'ядро' : '—'}; довод: ${tOf(REASONS, (ans.why || {})[p.id])}`).join('\n')
  };

  // =====================================================================
  // Практика 2. Лаборатория: запись на занятие при разных стилях
  // =====================================================================
  const LSTY = [{ v: 'mono', t: 'Монолит без границ' }, { v: 'adr', t: 'Модульный монолит + 5 сервисов (ADR-007)' }, { v: 'micro', t: 'Микросервисы на всё' }];
  const LSC = [{ v: 'normal', t: 'Обычный вечер' }, { v: 'peak', t: 'Воскресенье 20:00 (400 записей/с)' }, { v: 'net', t: 'Сеть внутри ДЦ: +200 мс на вызов' }, { v: 'notif', t: 'Уведомления зависли' }];
  const LAB = {
    mono: { calls: 0, units: 2, avail: 99.9, p95: { normal: 70, peak: 150, net: 70, notif: null }, tx: 'одна транзакция' },
    adr: { calls: 0, units: 7, avail: 99.9, p95: { normal: 60, peak: 140, net: 60, notif: 60 }, tx: 'одна транзакция + outbox' },
    micro: { calls: 2, units: 11, avail: 99.7, p95: { normal: 100, peak: 260, net: 500, notif: 100 }, tx: 'две базы: нужна компенсация' }
  };
  function labLanes(st) {
    if (st === 'micro') return [L('app', 'Приложение', 'Анна'), L('book', 'Запись', 'сервис'), L('memb', 'Абонементы', 'сервис'), L('sched', 'Расписание', 'сервис'), L('bus', 'Kafka', 'события'), L('notif', 'Уведомления', 'сервис')];
    if (st === 'mono') return [L('app', 'Приложение', 'Анна'), L('core', 'Монолит', 'один процесс'), L('db', 'PostgreSQL', 'общие таблицы'), L('push', 'Пуш/SMS-шлюз', 'внешний')];
    return [L('app', 'Приложение', 'Анна'), L('core', 'Ядро', 'модульный монолит'), L('db', 'PostgreSQL', 'схемы модулей'), L('bus', 'Kafka', 'события'), L('notif', 'Уведомления', 'сервис')];
  }
  function labSteps(st, sc) {
    const S = [], p = LAB[st].p95[sc], peak = sc === 'peak';
    S.push({ from: 'app', to: st === 'micro' ? 'book' : 'core', t: 'записаться на сайкл', note: `Анна жмёт «Записаться».${peak ? ' Вместе с ней — ещё 400 человек в секунду.' : ''}` });
    if (st === 'mono') {
      S.push({ from: 'core', to: 'db', t: 'SELECT из таблиц абонементов\n(границ нет)', note: 'Код записи сам читает таблицу абонементов — так быстрее, но теперь «Запись» зависит от устройства чужой таблицы.' });
      S.push({ from: 'core', to: 'db', t: 'UPDATE места + INSERT\nодна транзакция', kind: 'ok', note: 'Место и запись — в одной транзакции. Здесь монолит хорош.' });
      if (sc === 'notif') {
        S.push({ from: 'core', to: 'push', t: 'отправить пуш\n(в том же пуле потоков)', note: 'Уведомление отправляется тут же, в потоке запроса — отдельной двери нет.' });
        S.push({ from: 'push', to: 'core', t: 'молчит 10 с…', lost: true, kind: 'bad', note: 'Шлюз завис. Поток ждёт ответа.' });
        S.push({ from: 'core', to: 'core', t: 'все потоки ждут шлюз', kind: 'bad', note: 'Каждая новая запись тоже отправляет пуш и тоже зависает. Через минуту свободных потоков нет.' });
        S.push({ from: 'core', to: 'app', t: '503 / таймаут', reply: true, kind: 'bad', note: '<b>Запись легла</b> из-за пушей. Ровно так «Пульс» лежал 40 минут в прошлое воскресенье — только там была 1С.' });
        return S;
      }
      S.push({ from: 'core', to: 'push', t: 'отправить пуш', note: 'Пуш уходит из того же процесса. Пока шлюз жив — незаметно.' });
      S.push({ from: 'core', to: 'app', t: `201 · p95 ≈ ${p} мс`, reply: true, kind: 'ok', note: `Ответ за ~${p} мс.${sc === 'net' ? ' Внутренней сети нет — задержки ДЦ не задели.' : ''}` });
      return S;
    }
    if (st === 'adr') {
      S.push({ from: 'core', to: 'core', t: 'Абонементы.isActive()\nвызов в памяти', note: 'Модуль «Запись» спрашивает модуль «Абонементы» через его API — это вызов функции в том же процессе, сеть не участвует. В чужие таблицы не лезет.' });
      S.push({ from: 'core', to: 'db', t: 'UPDATE места + INSERT\n+ INSERT outbox', kind: 'ok', note: 'Одна локальная транзакция: место, запись и строка outbox для события.' });
      S.push({ from: 'core', to: 'app', t: `201 · p95 ≈ ${p} мс`, reply: true, kind: 'ok', note: `Анна получила ответ за ~${p} мс.${sc === 'net' ? ' Внутри ядра сети нет — задержки ДЦ запись не задели.' : ''}` });
      S.push({ from: 'core', to: 'bus', t: 'BookingCreated\n(из outbox)', kind: 'accent', note: 'Уже после ответа ретранслятор публикует событие из outbox в Kafka.' });
      S.push({ from: 'bus', to: 'notif', t: 'событие', note: '«Уведомления» читают событие в своём темпе.' });
      S.push(sc === 'notif'
        ? { from: 'notif', to: 'notif', t: 'завис: шлюз молчит', kind: 'bad', note: '«Уведомления» зависли — но это их процесс и их потоки. События ждут в брокере, пуши придут позже. <b>Запись этого не заметила.</b>' }
        : { from: 'notif', to: 'notif', t: 'пуш Анне', kind: 'ok', note: 'Пуш «Вы записаны» ушёл.' });
      return S;
    }
    const hop = sc === 'net' ? 220 : peak ? 60 : 20;
    S.push({ from: 'book', to: 'memb', t: 'GET абонемент активен?', time: `+${hop}мс`, kind: sc === 'net' ? 'warn' : '', note: `Вызов по сети к сервису «Абонементы» — ~${hop} мс${sc === 'net' ? ' (сеть ДЦ медленная)' : peak ? ' (в пик очередь у каждого сервиса)' : ''}.` });
    S.push({ from: 'memb', to: 'book', t: 'да', reply: true, note: 'Ответ пришёл. Если бы «Абонементы» лежали — запись ждала бы таймаут и падала.' });
    S.push({ from: 'book', to: 'sched', t: 'занять место', time: `+${hop}мс`, kind: sc === 'net' ? 'warn' : '', note: 'Второй вызов по сети: «Расписание» уменьшает счётчик мест в своей базе и фиксирует.' });
    S.push({ from: 'sched', to: 'book', t: 'место занято', reply: true, note: 'Место занято в чужой базе. Если сейчас упадёт INSERT записи — место «повиснет»: нужна компенсация «освободить место».' });
    S.push({ from: 'book', to: 'book', t: 'INSERT booking\n(своя база)', note: 'Запись сохраняется в базе сервиса «Запись».' });
    S.push({ from: 'book', to: 'app', t: `201 · p95 ≈ ${p} мс`, reply: true, kind: p > 300 ? 'bad' : p > 200 ? 'warn' : 'ok', note: p > 300 ? `<b>${p} мс — SLO «p95 ≤ 300 мс» нарушен</b>, хотя ни один сервис не сломан. Просто два вызова по медленной сети.` : `Ответ за ~${p} мс.${peak ? ' Близко к границе SLO 300 мс.' : ''}` });
    S.push({ from: 'book', to: 'bus', t: 'BookingCreated', kind: 'accent', note: 'Событие в Kafka.' });
    S.push(sc === 'notif'
      ? { from: 'notif', to: 'notif', t: 'завис: шлюз молчит', kind: 'bad', note: 'Уведомления зависли отдельно — запись работает. Здесь изоляция такая же, как в ADR-007.' }
      : { from: 'bus', to: 'notif', t: 'пуш Анне', kind: 'ok', note: 'Пуш ушёл.' });
    return S;
  }
  function labStats(st, sc) {
    const x = LAB[st], p = x.p95[sc], down = Math.round((1 - x.avail / 100) * 43200);
    const pTxt = p == null ? 'не отвечает' : `${p} мс`, pK = p == null || p > 300 ? 'bad' : p > 200 ? 'warn' : 'ok';
    return `<div class="stat"><div class="k">вызовов по сети</div><div class="v ${x.calls ? 'warn' : 'ok'}">${x.calls}</div><div class="s">внутри записи</div></div>
      <div class="stat"><div class="k">p95 записи</div><div class="v ${pK}">${pTxt}</div><div class="s">SLO: ≤ 300 мс</div></div>
      <div class="stat"><div class="k">доступность цепочки</div><div class="v ${x.avail >= 99.9 ? 'ok' : 'warn'}">${String(x.avail).replace('.', ',')} %</div><div class="s">≈ ${down} мин простоя в месяц</div></div>
      <div class="stat"><div class="k">единиц деплоя</div><div class="v ${x.units > 8 ? 'warn' : ''}">${x.units}</div><div class="s">на 15 разработчиков · ${esc(x.tx)}</div></div>`;
  }
  const LQ = [
    {
      q: 'Требования «Пульса»: p95 записи ≤ 300 мс при 400 записях/с, доступность 99,9 %, сбой уведомлений не задевает запись, 15 разработчиков в трёх командах. Какой стиль выбираем?', seed: 'ars-q1',
      options: [
        { t: 'Модульный монолит + 5 сервисов (ADR-007)', ok: 1, why: 'Верно. Запись — одна локальная транзакция без сетевых вызовов, уведомления изолированы в своём сервисе, и всего 7 единиц деплоя на 15 человек.' },
        { t: 'Монолит без границ — он самый быстрый', why: 'Быстрый, пока жив шлюз уведомлений. Сценарий «Уведомления зависли» кладёт запись. И три команды в одном коде без границ мешают друг другу.' },
        { t: 'Микросервисы на всё — каждая команда независима', why: 'Работает, но цена высокая: два сетевых вызова на запись (в пик — на грани SLO, при медленной сети — за ним), 99,7 % вместо 99,9 %, компенсации на занятое место и 11 сервисов на 15 человек.' },
        { t: 'Монолит сейчас, микросервисы — когда-нибудь потом', why: '«Потом» уже наступило: зависший внешний вызов положил запись на 40 минут. Ждать нельзя — но и резать всё не нужно.' }
      ]
    },
    {
      q: 'Чего модульный монолит НЕ даёт сам по себе — из-за чего уведомления всё-таки вынесли в отдельный сервис?', seed: 'ars-q2',
      options: [
        { t: 'Изоляции сбоев: модули живут в одном процессе и падают вместе', ok: 1, why: 'Верно. Границы модулей — в коде и данных, а память и потоки общие. Зависание одного модуля может съесть ресурсы всех.' },
        { t: 'Границ в коде между командами', why: 'Даёт: у модуля свой API и своя схема, зависимости проверяет ArchUnit.' },
        { t: 'Одной транзакции на запись', why: 'Даёт — это его главный плюс перед микросервисами.' },
        { t: 'Возможности читать события из Kafka', why: 'Модульный монолит прекрасно публикует и читает события — через outbox, как у «Пульса».' }
      ]
    }
  ];
  const labTask = {
    id: 'lab', title: 'Запись на занятие при разных стилях',
    simple: {
      icon: '🧪', plain: 'Один и тот же сценарий «Анна записывается на сайкл» по-разному ведёт себя в разных стилях: где-то это одна транзакция, где-то — цепочка звонков по сети.',
      analogy: 'Записаться в клуб у одного администратора, у которого всё под рукой, — или обойти три окошка в разных зданиях: в одном проверяют абонемент, в другом выдают место, в третьем вписывают в журнал.',
      tech: 'Задержка p95 складывается из вызовов по сети; доступность синхронной цепочки — произведение доступностей; изоляция отказов требует отдельного процесса; общие данные в разных базах — компенсации вместо отката.'
    },
    lead: ui.brief({
      situation: 'Антон: «Хватит спорить на словах. Прогоним главный сценарий “Пульса” — запись на занятие — в трёх стилях и четырёх условиях. Требования: p95 ≤ 300 мс при 400 записях/с, доступность 99,9 % (≈ 43 минуты простоя в месяц), сбой уведомлений не задевает запись».',
      todo: [
        'Выберите <b>стиль</b> и <b>условия</b> — схема проиграется, счётчики пересчитаются.',
        'Прогоните все три стиля хотя бы в двух условиях: «Воскресенье 20:00» и «Уведомления зависли». Не пропустите «Сеть +200 мс» в микросервисах.',
        'Ответьте на два вопроса внизу и нажмите «Проверить».'
      ],
      look: 'Счётчики: красный — требование нарушено, жёлтый — на грани или дорого, зелёный — в норме. Метка слева от стрелки на схеме — сколько миллисекунд добавил вызов по сети. Плашка «просмотрено» внизу показывает, какие стили вы уже прогнали.'
    }),
    blank: () => ({ st: 'mono', sc: 'normal', seen: [], q: [] }),
    reference: () => ({ st: 'adr', sc: 'notif', seen: ['mono', 'adr', 'micro'], q: LQ.map(q => [q.options.findIndex(o => o.ok)]) }),
    render(el, ctx) {
      el.classList.add('ars-root');
      const a = ctx.ans; a.seen = a.seen || []; a.q = a.q || [];
      if (!ctx.readonly && !a.seen.includes(a.st)) { a.seen.push(a.st); ctx.save(); }
      el.innerHTML = `<div class="stack">
        <div class="ars-box"><div class="ars-set"><div class="lbl">Стиль</div>${ui.seg('st', LSTY, a.st, 'accent')}<div class="lbl">Условия</div>${ui.seg('sc', LSC, a.sc, 'accent')}</div></div>
        <div class="ars-stats" data-stats></div>
        <div data-seq></div>
        <div class="small" data-seen></div>
        <div class="eyebrow">Выводы</div><div data-q></div>
      </div>`;
      const seqBox = TR.$('[data-seq]', el);
      let seq = null;
      const drawSeq = play => { seqBox.innerHTML = ''; seq = ui.seq(mount(seqBox), { lanes: labLanes(a.st), steps: labSteps(a.st, a.sc), start: play ? 0 : 'all', speed: 800, laneW: a.st === 'micro' ? 140 : 170, title: 'Запись на занятие', hint: 'Нажмите «Проиграть».' }); if (play) seq.play(); };
      const drawStats = () => {
        TR.$('[data-stats]', el).innerHTML = labStats(a.st, a.sc);
        TR.$('[data-seen]', el).innerHTML = 'Просмотрено: ' + LSTY.map(s => `<span class="chip ${a.seen.includes(s.v) ? 'ok' : ''}">${a.seen.includes(s.v) ? '✓' : '·'} ${esc(s.t)}</span>`).join(' ');
      };
      drawSeq(false); drawStats();
      ui.onSeg(el, (n, v) => {
        if (n !== 'st' && n !== 'sc') return;
        a[n] = v;
        if (!ctx.readonly) { if (n === 'st' && !a.seen.includes(v)) a.seen.push(v); ctx.save(); }
        drawStats(); drawSeq(true);
      });
      const qb = TR.$('[data-q]', el);
      LQ.forEach((cfg, i) => {
        const d = mount(qb, 'card flat');
        ui.quiz(d, Object.assign({}, cfg, {
          value: a.q[i] || [], readonly: ctx.readonly, reveal: ctx.result,
          onChange: v => { const q = (a.q || []).slice(); q[i] = v; a.q = q; ctx.save(); if (i === 0) ctx.decide('Стиль для записи на занятие', String(cfg.options[v[0]].t).replace(/<[^>]+>/g, '')); }
        }));
      });
    },
    check(ans) {
      const notes = []; let pts = 0;
      const q1 = ui.quizScore(LQ[0], (ans.q || [])[0]), q2 = ui.quizScore(LQ[1], (ans.q || [])[1]);
      if (q1.ok) { pts += 40; notes.push({ ok: true, html: 'Стиль выбран под требования, а не под моду.' }); }
      else notes.push({ ok: false, html: 'Стиль пока не сходится с требованиями. Прогоните «Уведомления зависли» в монолите и «Сеть +200 мс» в микросервисах — какое требование где нарушается?' });
      if (q2.ok) { pts += 30; notes.push({ ok: true, html: 'Понятно, зачем вынесли уведомления: модульность не изолирует сбои.' }); }
      else notes.push({ ok: false, html: 'Посмотрите в теории, что падает вместе в модульном монолите, если «уронить» один модуль.' });
      const seen = (ans.seen || []).filter(s => LSTY.some(x => x.v === s));
      pts += seen.length * 10;
      if (seen.length < 3) notes.push({ ok: 'warn', html: `Прогнано стилей: ${seen.length} из 3. Выводы надёжнее, когда сравнили все.` });
      const score = pts / 100;
      return { ok: q1.ok && q2.ok && seen.length >= 2, score, notes, summary: `Стилей прогнано: ${seen.length} из 3.`, vera: q1.ok ? null : 'Требований три, и каждый неверный стиль нарушает своё: монолит — изоляцию уведомлений, микросервисы — задержку и доступность.' };
    },
    explain: `${ui.table(['', 'Монолит без границ', 'ADR-007', 'Микросервисы на всё'], [
      ['Вызовов по сети на запись', '0', '0', '2'],
      ['p95 в пик', '~150 мс', '~140 мс', '~260 мс (на грани)'],
      ['Сеть +200 мс', 'не задевает', 'не задевает', '~500 мс — SLO нарушен'],
      ['Уведомления зависли', '<b>запись легла</b>', 'запись работает', 'запись работает'],
      ['Доступность цепочки', '99,9 %', '99,9 %', '≈ 99,7 % (3 сервиса подряд)'],
      ['Единиц деплоя на 15 человек', '2', '7', '11']
    ])}
      <p>ADR-007 берёт лучшее из двух миров: горячий путь «записаться» — одна локальная транзакция в ядре, без сети; всё, что может зависнуть или имеет свою нагрузку, — отдельными сервисами за брокером.</p>
      <p>Цифры учебные, но порядок честный: внутри дата-центра вызов стоит 5–30 мс, в пик — больше, а доступность синхронной цепочки — произведение доступностей (0,999 × 0,999 × 0,999 ≈ 0,997 → около 130 минут простоя в месяц вместо 43).</p>`,
    report: ans => `Прогнанные стили: ${(ans.seen || []).map(s => tOf(LSTY, s)).join(', ') || '—'}.\nВыбор стиля: ${(ans.q || [])[0] && (ans.q[0] || []).length ? String(LQ[0].options[ans.q[0][0]].t) : '—'}.\nЧего не даёт модульный монолит: ${(ans.q || [])[1] && (ans.q[1] || []).length ? String(LQ[1].options[ans.q[1][0]].t) : '—'}.`
  };

  // =====================================================================
  // Практика 3. ADR своими словами
  // =====================================================================
  const ADR_RUBRIC = [
    'Контекст с цифрами: 60 клубов, 300 тыс. клиентов, 400 записей/с, до 300 тыс. пушей за вечер, 15 разработчиков в трёх командах, 40 минут простоя в прошлое воскресенье',
    'Варианты: монолит как есть / модульный монолит + выделение сервисов / микросервисы на всё — с плюсами и минусами каждого',
    'Решение: ядро (абонементы, запись, платежи) — модульный монолит; вынести уведомления, партнёрский шлюз, аналитику, бонусы, трансляции',
    'Почему так: частые общие транзакции и одна команда ядра — против выноса; своя нагрузка, изоляция сбоев, внешний трафик, своя команда — за',
    'Последствия «плюс»: запись не зависит от уведомлений, сервисы масштабируются и выкатываются отдельно',
    'Последствия «минус» (цена): брокер и outbox, контракты событий, наблюдаемость и дежурства на 7 единиц деплоя, сага при покупке с бонусами, дисциплина модулей (ArchUnit)',
    'Когда пересмотреть: например, команда ядра выросла до нескольких команд или запись упёрлась в одну базу; роль аналитика — сценарии качества и контракты'
  ];
  const ADR_REF = `<p><b>ADR-007. Модульный монолит + выделение пяти сервисов</b> · статус: принято</p>
    <p><b>Контекст.</b> Через два года — 60 клубов, 300 тыс. клиентов, пик 400 записей/с, до 300 тыс. пушей за вечер воскресенья, ещё три агрегатора. 15 разработчиков в трёх командах делят один релиз. В прошлое воскресенье запись лежала 40 минут: зависший внешний вызов занял общий пул потоков. Требования: запись p95 ≤ 300 мс, доступность 99,9 %, сбой уведомлений не задевает запись.</p>
    <p><b>Варианты.</b> 1) Оставить монолит — дёшево, но нет изоляции сбоев и границ между командами. 2) Модульный монолит + вынести части с собственными признаками. 3) Микросервисы на всё — независимость команд, но 2–3 вызова по сети на запись, распределённые транзакции и 11 сервисов на 15 человек.</p>
    <p><b>Решение.</b> Вариант 2. Абонементы, запись, платежи (и клиенты, расписание) — модульный монолит с схемами по модулям и проверкой зависимостей. В сервисы: уведомления (нагрузка, изоляция, RabbitMQ), партнёрский шлюз (внешний трафик, OAuth, лимиты), аналитика и рекомендации (ClickHouse, тяжёлые запросы), бонусы (новая команда, общение событиями), онлайн-трансляции (внешний видеосервис, своя нагрузка).</p>
    <p><b>Последствия.</b> Плюс: запись — одна локальная транзакция без сети; зависание уведомлений не трогает запись; сервисы масштабируются и выкатываются отдельно. Минус: нужны Kafka и outbox, контракты событий (AsyncAPI), трассировки и дежурства на 7 единиц деплоя, сага при покупке абонемента с бонусами, дисциплина границ модулей (ArchUnit).</p>
    <p><b>Пересмотреть,</b> если команда ядра вырастет до нескольких команд или запись упрётся в возможности одной PostgreSQL. Аналитик отвечает за сценарии качества, контракты API и событий и модели данных владельцев.</p>`;
  const ADR_HEADS = ['Контекст', 'Варианты', 'Решение', 'Последствия +', 'Последствия −', 'Когда пересмотреть'];
  const adrTask = {
    id: 'adr', title: 'ADR-007 своими словами',
    simple: {
      icon: '📝', plain: 'ADR — короткая записка «что решили и почему»: чтобы через год не спорить заново и не гадать, почему сделано так.',
      analogy: 'Протокол собрания жильцов: «решили поставить шлагбаум, потому что чужие машины занимают места; варианты были — охранник или камеры; минус — гостям придётся звонить».',
      tech: 'Architecture Decision Record (формат Майкла Найгарда, MADR): статус, контекст, рассмотренные варианты, решение, последствия (положительные и отрицательные). Хранится рядом с кодом, решения не переписывают — заменяют новым ADR.'
    },
    lead: ui.brief({
      situation: 'Комитет в пятницу: Ольга, Тимур (CTO), Антон (архитектор), Сергей (SRE). Антон: «Черновик ADR-007 пишет аналитик — у вас все факты и цифры. Я добавлю технические детали». Ольге нужно понять «почему не как у всех», Сергею — сколько всего будет дежурить.',
      todo: [
        'Кнопками-заголовками добавьте разделы ADR в текст: контекст → варианты → решение → последствия → когда пересмотреть.',
        'Заполните каждый раздел: цифры из канона, ваши решения из заданий 2.1 и 2.2, и обязательно минусы решения.',
        'Нажмите «Сверить с эталоном самому» (или «Проверить с Верой») и отметьте, что прозвучало.'
      ],
      lookTitle: 'Как проверяется',
      look: 'Засчитывается, когда покрыто не меньше 60 % критериев. Самое частое упущение — раздел «Последствия» без минусов: ADR, где у решения нет цены, комитет не примет.'
    }),
    blank: () => ({ j: { text: '' } }),
    reference: () => ({ j: { text: ADR_REF.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), self: ADR_RUBRIC.map(() => true) } }),
    render(el, ctx) {
      el.classList.add('ars-root');
      el.innerHTML = `<div class="stack">${ctx.readonly ? '' : `<div class="ars-chips"><span class="small dim">Добавить раздел:</span>${ADR_HEADS.map((h, i) => `<button type="button" class="chip" data-h="${i}">+ ${esc(h)}</button>`).join('')}</div>`}<div data-j></div></div>`;
      const box = TR.$('[data-j]', el);
      ui.justify(box, {
        id: 'ars-adr', q: 'ADR-007: модульный монолит или микросервисы', rubric: ADR_RUBRIC, reference: ADR_REF, value: ctx.ans.j, readonly: ctx.readonly, minLen: 400,
        onChange: j => { ctx.save({ j }); ctx.decide('ADR-007 (черновик)', j.text || ''); }
      });
      TR.on(el, 'click', '[data-h]', (e, b) => {
        const ta = TR.$('textarea', box); if (!ta) return;
        const h = ADR_HEADS[+b.dataset.h];
        if (ta.value.includes(h + ':')) { ta.focus(); return; }
        ta.value = (ta.value.trim() ? ta.value.replace(/\s+$/, '') + '\n\n' : 'ADR-007. Модульный монолит или микросервисы\n\n') + `${h}: `;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
      });
    },
    check(ans) {
      const s = ui.justifyScore(ans.j), j = ans.j || {}, txt = String(j.text || ''), len = txt.trim().length, notes = [];
      if (len < 400) notes.push({ ok: false, html: 'Пока коротко: в ADR пять разделов, в 400 символов их не уместить. Добавьте разделы кнопками сверху.' });
      else if (!j.self && !j.ai) notes.push({ ok: 'warn', html: 'Сверьте черновик с эталоном (кнопка под полем) или проверьте с Верой.' });
      else notes.push({ ok: s >= 0.6, html: `Покрыто критериев: ${Math.round(s * 100)}%.` });
      if (len >= 400 && !/минус|цена|последств[^\n]*[−-]/i.test(txt)) notes.push({ ok: 'warn', html: 'Не видно минусов решения. Что придётся строить и кому дежурить?' });
      return { ok: s >= 0.6, score: s, notes, vera: s < 0.6 && len >= 400 ? 'Пройдитесь по порядку: цифры роста и боль → три варианта с ценой → что выносим и что оставляем, с признаками → плюсы и минусы → когда пересмотреть.' : null };
    },
    explain: `<p>Сильный ADR короткий и честный. Контекст — из требований (это ваш вклад: цифры, сценарии качества, инцидент). Варианты — реальные, с ценой. Решение — одной фразой и списком. Последствия — с минусами: брокер, контракты, дежурства, сага. И условие пересмотра: архитектура — не навсегда, а до тех пор, пока верны предпосылки.</p>
      <p>Ольге — на её языке: «запись живёт отдельно от пушей и отчётов; пять частей, где есть своя нагрузка или своя команда, — отдельно; ядро не режем, потому что покупка, оплата и запись — одно движение».</p>`,
    report: ans => `ADR-007 (черновик студента):\n> ${String((ans.j || {}).text || '—').replace(/\n/g, '\n> ')}\nСамооценка: ${Math.round(ui.justifyScore(ans.j) * 100)}%.`
  };

  // =====================================================================
  TR.stage({
    id: 'arch-style', act: 6, order: 310, slot: 'Пн 10:00', title: 'Монолит или сервисы',
    when: 'понедельник, 10:00 · большая переговорная «Кроссфит»',
    intro: [
      { who: 'timur', html: 'Нас уже 15 разработчиков в трёх командах. Каждый релиз — очередь из трёх команд в одну ветку. На конференциях все говорят: режьте на микросервисы. Может, пора?' },
      { who: 'anton', html: 'Я пришёл из банка, где было двести микросервисов. Падали хором, а распределённые транзакции разбирали неделями. Резать надо там, где больно, а не везде. Решение запишем в ADR-007 — комитет в пятницу.' },
      { who: 'vera', html: 'Аналитик здесь не зритель: вы приносите цифры нагрузки, требования к доступности и знаете, какие операции меняют данные нескольких модулей сразу. Сначала посмотрим три стиля на одной картинке и цену сети, потом решим, что выносить, и напишем ADR.' }
    ],
    facts: ['F-availability', 'F-week-open', 'F-no-loss', 'F-partners-more', 'F-reports', 'F-sms'],
    glossary: [
      { term: 'Монолит', simple: 'Квартира-студия: всё в одной комнате. Удобно, пока жильцов мало.', tech: 'Приложение — одна единица деплоя с одной базой; границ между частями в коде нет, любой код может читать любую таблицу.' },
      { term: 'Модульный монолит', simple: 'Квартира с комнатами и дверями: порядок, но электрощиток один — выбило пробки, темно везде.', tech: 'Одна единица деплоя, внутри модули с явным API и своей схемой в базе; зависимости проверяются автоматически (Spring Modulith, ArchUnit). Транзакции локальные, отказы не изолированы.' },
      { term: 'Микросервисы', simple: 'Отдельные домики: в одном пожар — другие стоят, но между домиками ходить по улице.', tech: 'Набор независимо развёртываемых сервисов, у каждого своя база; взаимодействие по сети (REST, gRPC, события). Цена: сеть, распределённые транзакции, наблюдаемость, DevOps.' },
      { term: 'Независимый деплой', simple: 'Отремонтировать одну комнату, не выселяя соседей.', tech: 'Возможность выкатить один компонент, не выкатывая остальные. Главная причина выносить часть, у которой свой темп релизов.' },
      { term: 'Вызов по сети', simple: 'Не крикнуть в соседнюю комнату, а позвонить в другое здание: дольше, и трубку могут не взять.', tech: 'Удалённый вызов между процессами: добавляет задержку (единицы–десятки мс), может не дойти или зависнуть; требует таймаутов, ретраев, предохранителей.' },
      { term: 'Распределённая транзакция', simple: 'Деньги списали в одном окошке, а абонемент выдают в другом здании — если там закрыто, деньги надо вернуть вручную.', tech: 'Изменение данных в нескольких базах как одно целое. Двухфазную фиксацию (2PC) «Пульс» не использует; вместо неё — сага с компенсирующими шагами.' },
      { term: 'Изоляция отказов', simple: 'Перегорела лампа на кухне — в спальне свет есть.', tech: 'Сбой одного компонента не роняет остальные: отдельный процесс, свои пулы потоков (bulkhead), асинхронное общение через брокер.' },
      { term: 'Закон Конвея', simple: 'Как устроены команды, так получится и система: три команды — три больших куска.', tech: 'Организации проектируют системы, повторяющие их структуру коммуникаций (Мелвин Конвей, 1968). Поэтому стиль архитектуры выбирают вместе со структурой команд.' },
      { term: 'ADR-007', simple: 'Протокол решения: «ядро не режем, пять частей выносим — и вот почему».', tech: 'Решение комитета «Пульса»: ядро (абонементы, запись, платежи) — модульный монолит; в сервисы — уведомления, партнёрский шлюз, аналитика и рекомендации, бонусы, онлайн-трансляции.' }
    ],
    outro: 'Вы прошли путь, который архитекторы проходят годами: не «микросервисы — это модно», а «у этой части своя нагрузка, команда или периметр — выносим; а эти три меняют данные вместе — оставляем». И записали это в ADR с ценой решения. Завтра — границы модулей: кто владеет какой таблицей и как не залезть к соседу.',
    tasks: [howStyles, howCost, howFit, splitTask, labTask, adrTask]
  });
})();
