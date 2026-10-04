/* Неделя 8, понедельник 10:00: системный дизайн с нуля на новой функции «Онлайн-тренировки». Канон — _dev/DOMAIN-2.md §7
   (2 000 зрителей на эфир, запись на эфир, чат тренеру, запись эфира 30 дней, внешний видеосервис по HLS/WebRTC, события
   StreamStarted, ViewerJoined), §5 (ADR-007: «Онлайн-трансляции» — отдельный сервис), §4 (Kafka, outbox, конверт события).
   Теория (живая): рамка системного дизайна из 7 шагов на соседнем примере «онлайн-запись к массажисту»; оценка нагрузки
   на салфетке — калькулятор (подключения, чат, трафик видео, куда идёт видео); «строить или купить» — свой видеосервер
   или внешний видеосервис, HLS или WebRTC, петля задержки «тренер спросил — зритель ответил».
   Практика: требования и вопросы Ольге; оценки нагрузки числами; API и события; схема из блоков с живым предпросмотром;
   ADR-010 своими словами. Цифры упражнения (3 Мбит/с, 10 эфиров в день, 10 % пишут в чат) заданы в условиях — их нет в каноне. */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc;
  const ID = 'sd-design';

  if (!document.getElementById('sdd-css')) document.head.insertAdjacentHTML('beforeend', `<style id="sdd-css">
    .sdd-root, .sdd-root .stack, .sdd-root .stack > * { min-width: 0; }
    .sdd-root :not(pre) > code { white-space: normal; overflow-wrap: anywhere; }
    .sdd-root .seg button { white-space: normal; text-align: left; }
    .sdd-root .btn { white-space: normal; text-align: left; }
    .sdd-box { display: grid; gap: 12px; padding: 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); min-width: 0; }
    .sdd-box > * { min-width: 0; }
    .sdd-sub { display: flex; gap: 10px; align-items: center; font-weight: 700; font-size: 15px; margin-top: 6px; }
    .sdd-sub .l { display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--accent); color: var(--bg); font: 700 12px/1 var(--f-mono); flex: none; }
    .sdd-steps { display: flex; flex-wrap: wrap; gap: 6px; }
    .sdd-step { display: inline-flex; gap: 7px; align-items: center; padding: 5px 11px 5px 5px; border-radius: 99px; border: 1px solid var(--border-strong); background: var(--surface-2); color: var(--text-2); font-size: 13px; font-weight: 600; cursor: pointer; }
    .sdd-step .n { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: var(--surface-3); font: 700 11px/1 var(--f-mono); color: var(--text); }
    .sdd-step.done .n { background: var(--ok-soft); color: var(--ok); }
    .sdd-step.skip .n { background: var(--bad-soft); color: var(--bad); }
    .sdd-step[aria-pressed="true"] { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
    .sdd-step:disabled { opacity: .4; cursor: not-allowed; }
    .sdd-two { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 14px; align-items: start; }
    .sdd-two > * { min-width: 0; }
    .sdd-set { display: grid; grid-template-columns: minmax(0, 210px) minmax(0, 1fr); gap: 8px 14px; align-items: center; }
    .sdd-set > .lbl { font-size: 13.5px; color: var(--text-2); min-width: 0; }
    .sdd-set > .lbl small { display: block; font-size: 12px; color: var(--text-muted); }
    .sdd-set > .seg { justify-self: start; max-width: 100%; }
    .sdd-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
    .sdd-stats .v { font-size: 18px; overflow-wrap: anywhere; }
    .sdd-stats .s { overflow-wrap: anywhere; }
    .sdd-pipe { display: grid; gap: 6px; }
    .sdd-pipe .row2 { display: grid; grid-template-columns: minmax(0, 170px) minmax(0, 1fr) 76px; gap: 10px; align-items: center; font-size: 13px; }
    .sdd-pipe .row2 > * { min-width: 0; }
    .sdd-pipe .tr { position: relative; height: 16px; background: var(--surface-3); border-radius: 6px; overflow: hidden; }
    .sdd-pipe .tr i { position: absolute; left: 0; top: 0; bottom: 0; background: var(--ok); border-radius: 6px; }
    .sdd-pipe .tr i.warn { background: var(--warn); } .sdd-pipe .tr i.bad { background: var(--bad); }
    .sdd-pipe .pc { font: 600 12px/1 var(--f-mono); text-align: right; }
    .sdd-tl { display: grid; gap: 8px; }
    .sdd-tl .bar { display: flex; height: 26px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); background: var(--surface-2); }
    .sdd-tl .bar span { display: flex; align-items: center; justify-content: center; font: 600 11px/1 var(--f-mono); color: var(--text); min-width: 0; overflow: hidden; white-space: nowrap; transition: width .4s; }
    .sdd-tl .bar .v { background: color-mix(in srgb, var(--info) 40%, var(--surface-2)); }
    .sdd-tl .bar .h { background: color-mix(in srgb, var(--violet) 30%, var(--surface-2)); }
    .sdd-tl .bar .c { background: color-mix(in srgb, var(--ok) 40%, var(--surface-2)); }
    .sdd-tl .leg { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 12.5px; color: var(--text-2); }
    .sdd-tl .leg i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 5px; vertical-align: -1px; }
    .sdd-crit { display: grid; gap: 6px; }
    .sdd-crit .r { display: grid; grid-template-columns: minmax(0, 170px) minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 7px 10px; border-radius: 9px; background: var(--surface-2); font-size: 13.5px; }
    .sdd-crit .r > * { min-width: 0; }
    .sdd-crit .r b { font-size: 13px; color: var(--text-2); font-weight: 600; }
    .sdd-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 8px; }
    .sdd-card { text-align: left; display: grid; gap: 4px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); color: var(--text); font: inherit; cursor: pointer; width: 100%; min-width: 0; align-content: start; }
    .sdd-card:disabled { cursor: default; }
    .sdd-card[aria-pressed="true"] { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset; background: var(--accent-soft); }
    .sdd-card.ok { border-color: var(--ok); box-shadow: 0 0 0 1px var(--ok) inset; }
    .sdd-card.bad { border-color: var(--bad); box-shadow: 0 0 0 1px var(--bad) inset; }
    .sdd-card .t { font: 600 13px/1.4 var(--f-mono); overflow-wrap: anywhere; }
    .sdd-card .s { font-size: 12.5px; color: var(--text-muted); overflow-wrap: anywhere; }
    .sdd-card .why { font-size: 12.5px; color: var(--text-2); border-top: 1px dashed var(--border-strong); padding-top: 5px; margin-top: 2px; }
    .sdd-card .mk { font: 700 11px/1 var(--f-mono); letter-spacing: .06em; color: var(--text-muted); }
    .sdd-card[aria-pressed="true"] .mk { color: var(--accent); }
    .sdd-nums { display: grid; gap: 8px; }
    .sdd-num { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 170px); gap: 6px 12px; align-items: center; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
    .sdd-num > * { min-width: 0; }
    .sdd-num .q { font-size: 14px; }
    .sdd-num .q small { display: block; color: var(--text-muted); font-size: 12.5px; margin-top: 2px; }
    .sdd-num .in { display: flex; gap: 8px; align-items: center; }
    .sdd-num .in input { font: 600 15px/1.2 var(--f-mono); text-align: right; }
    .sdd-num .in span { font-size: 12.5px; color: var(--text-muted); white-space: nowrap; min-width: 66px; }
    .sdd-num.ok { border-color: var(--ok); } .sdd-num.bad { border-color: var(--bad); }
    .sdd-num .why { grid-column: 1 / -1; font-size: 13px; color: var(--text-2); }
    .sdd-napkin { font: 13px/1.6 var(--f-mono); padding: 12px 14px; border-radius: 10px; background: var(--surface-2); border: 1px dashed var(--border-strong); display: grid; gap: 4px; overflow-wrap: anywhere; }
    .sdd-svg svg text { pointer-events: none; }
    .sdd-sim { display: grid; gap: 5px; font-size: 13px; }
    .sdd-sim div { padding: 6px 10px; border-radius: 8px; background: var(--surface-2); border-left: 3px solid var(--border-strong); overflow-wrap: anywhere; }
    .sdd-sim div.ok { border-left-color: var(--ok); } .sdd-sim div.bad { border-left-color: var(--bad); background: var(--bad-soft); } .sdd-sim div.warn { border-left-color: var(--warn); } .sdd-sim div.info { border-left-color: var(--info); }
    .sdd-ans { display: grid; gap: 8px; }
    @media (max-width: 760px) {
      .sdd-two { grid-template-columns: minmax(0, 1fr); }
      .sdd-set { grid-template-columns: minmax(0, 1fr); gap: 4px; }
      .sdd-set > .lbl { margin-top: 6px; }
      .sdd-num { grid-template-columns: minmax(0, 1fr); }
      .sdd-pipe .row2 { grid-template-columns: minmax(0, 1fr) 60px; }
      .sdd-pipe .row2 .tr { grid-column: 1 / -1; grid-row: 2; }
      .sdd-crit .r { grid-template-columns: minmax(0, 1fr) auto; }
      .sdd-crit .r b { grid-column: 1 / -1; }
    }
  </style>`);

  const mount = (el, cls) => { const d = document.createElement('div'); if (cls) d.className = cls; el.appendChild(d); return d; };
  const nf = (x, d) => Number(x).toLocaleString('ru-RU', { maximumFractionDigits: d == null ? 0 : d });
  const plainT = s => String(s == null ? '' : s).replace(/<[^>]+>/g, '');

  // =====================================================================
  // Теория 1. Рамка системного дизайна: 7 шагов на примере «онлайн-запись к массажисту»
  // =====================================================================
  const FRAME = [
    {
      id: 'req', t: 'Требования', q: 'Что функция делает и насколько хорошо она должна это делать?',
      good: ['<b>Что делает</b> (функциональные): клиент видит свободные окна массажиста на неделю, записывается, платит картой, бесплатно отменяет не позже чем за 12 часов.',
        '<b>Насколько хорошо</b> (нефункциональные): одно окно не продаётся двоим; экран окон открывается быстрее секунды; работает во всех 60 клубах.',
        '<b>Вопросы заказчику</b>: сколько массажистов в клубе? можно ли записаться без абонемента? что делаем, если массажист заболел?'],
      skip: 'Сразу рисуем схему. Через месяц выясняется, что массаж продают и тем, у кого нет абонемента, — оплату и проверку прав переделываем.',
      an: 'Самая «аналитическая» часть: отделить «что делает» от «насколько хорошо», найти вопросы, без которых схема будет ошибочной, и получить на них ответы.'
    },
    {
      id: 'est', t: 'Оценка нагрузки', q: 'Сколько запросов, данных и трафика — хотя бы по порядку величины?',
      good: ['60 клубов × 2 массажиста × 8 сеансов = около 1 000 сеансов в день.',
        'Просмотров окон — около 10 000 в день: в среднем 0,1 запроса в секунду, в вечерний пик — единицы в секунду.',
        '<b>Вывод</b>: нагрузка крошечная. Хватит модуля в ядре и той же PostgreSQL — отдельный сервис, кэш и брокер не нужны.'],
      skip: 'Без оценки команда «на всякий случай» делает отдельный сервис с кэшем и брокером. Полгода работы ради пяти запросов в секунду.',
      an: 'Аналитик приносит исходные числа (сколько клубов, массажистов, сеансов, когда пик), считает вместе с архитектором и делает вывод: что нам НЕ нужно — тоже результат.'
    },
    {
      id: 'api', t: 'API и события', q: 'Как приложение и другие системы общаются с функцией?',
      good: ['<code>GET /v1/clubs/{clubId}/massage-slots?date=…</code> — свободные окна.',
        '<code>POST /v1/massage-bookings</code> с <code>Idempotency-Key</code> → 201; 409, если окно уже заняли.',
        'Событие <code>MassageBooked</code> → «Уведомления» шлют пуш, «Аналитика» считает загрузку.'],
      skip: 'Каждая команда придумывает свой формат. Мобильная студия ждёт одно, бэкенд отдаёт другое, а повтор оплаты при плохой сети создаёт две записи.',
      an: 'Контракт API (OpenAPI) и событий (AsyncAPI) — прямой артефакт аналитика: ресурсы, поля, ошибки, идемпотентность, кто читает событие.'
    },
    {
      id: 'data', t: 'Данные', q: 'Что храним, кто владелец, какие правила держит сама база?',
      good: ['<code>massage_slot</code> (массажист, клуб, начало, конец) и <code>massage_booking</code> (клиент, окно, статус).',
        'Правила: одно окно — одна действующая запись (уникальный ключ); массажист не в двух местах сразу (EXCLUDE, как у тренеров).',
        'Владелец — модуль «Запись» в ядре; остальные читают через его API или события.'],
      skip: 'Правило «одно окно — один клиент» живёт только в коде. В пятницу вечером два клиента приходят на один сеанс.',
      an: 'Логическая модель и правила целостности — работа аналитика; физическую модель (индексы, типы) доводят вместе с командой.'
    },
    {
      id: 'arch', t: 'Архитектура', q: 'Из каких блоков собрано и как они связаны?',
      good: ['Новый модуль внутри ядра (модульный монолит, ADR-007): «занять окно» и оплата остаются в одной базе.',
        'Оплата — существующий модуль «Платежи» и ПэйПоинт.',
        'Пуш — событием через outbox в Kafka, дальше сервис «Уведомления».'],
      skip: 'Начали с технологий: «давайте отдельный микросервис и свой брокер». Через месяц выясняется, что распределённая транзакция с оплатой стоит дороже самой функции.',
      an: 'Аналитик сверяет схему с требованиями: на каждой стрелке есть контракт, у каждой таблицы — один владелец, каждый сценарий проходит по схеме.'
    },
    {
      id: 'neck', t: 'Узкие места и отказы', q: 'Где сломается и что тогда видит клиент?',
      good: ['Двое жмут на одно окно → уникальный ключ в базе: второй получает 409 «окно уже заняли».',
        'ПэйПоинт думает 10+ секунд → окно держим 15 минут как резерв, потом освобождаем.',
        'Массажист заболел → отменяем его окна, пуш и возврат денег.'],
      skip: 'Узкие места находят клиенты: двойная продажа окна, «зависшие» резервы, гневные отзывы.',
      an: 'Сценарии отказов «что если» пишет аналитик: что делает система, что видит клиент, что видит администратор.'
    },
    {
      id: 'trade', t: 'Компромиссы и ADR', q: 'Чем мы платим за выбранное решение и где это записано?',
      good: ['Резерв на 15 минут: окно «висит», пока клиент платит, — приняли.',
        'Модуль в ядре: релизится вместе с ядром — приняли, нагрузка маленькая.',
        'Всё записано в ADR: контекст с цифрами, варианты, решение, последствия.'],
      skip: 'Через полгода новичок предлагает «вынести массаж в отдельный сервис» — и спор начинается заново: никто не помнит, почему сделали так.',
      an: 'В ADR аналитик приносит контекст с цифрами и последствия для бизнеса; варианты и решение — вместе с архитектором.'
    }
  ];
  const howFrame = {
    id: 'how-frame', covers: ['req', 'api'], title: 'Как это работает: рамка системного дизайна из 7 шагов', free: true, noReset: true,
    simple: {
      icon: '🧭',
      plain: 'Системный дизайн — это путь от «хотим новую функцию» до схемы, которую можно строить. Чтобы не утонуть, идут по одним и тем же семи шагам: требования, оценка нагрузки, API, данные, архитектура, узкие места, компромиссы.',
      analogy: 'Как ремонт квартиры: сначала решают, что нужно семье (детская, кабинет), потом меряют комнаты, потом рисуют розетки и трубы, и только потом выбирают плитку. Кто начинает с плитки, переделывает ванную дважды.',
      tech: '<b>Рамка системного дизайна</b>: 1) функциональные и нефункциональные требования; 2) оценка нагрузки «на салфетке» (запросы в секунду, объём данных, трафик); 3) API и события; 4) модель данных и владельцы; 5) архитектура верхнего уровня (блоки и связи); 6) узкие места и отказы; 7) компромиссы и ADR. Шаги идут по порядку, но к ним возвращаются: оценка может перевернуть архитектуру.'
    },
    lead: ui.brief({
      situation: 'Соседний пример — небольшая функция «онлайн-запись к массажисту» в SPA-зоне клубов. Антон: «Покажу на ней рамку. Потом вы пройдёте её сами на онлайн-тренировках, а это задача в сотни раз тяжелее».',
      todo: [
        'Открывайте шаги по одному кнопкой «Следующий шаг». Читайте, что делают на шаге и что приносит аналитик.',
        'На любом шаге переключите «Как делает аналитик» на «Шаг пропустили» — увидите, что случится с проектом.',
        'Откройте все 7 шагов и посмотрите итог проекта внизу.'
      ],
      look: 'Кружки сверху — шаги рамки: зелёный — сделан, красный — пропущен, серый — ещё не открыт. Внизу — итог проекта «Массаж»: сколько шагов сделано и что сломается из-за пропущенных.'
    }),
    render(el) {
      el.classList.add('sdd-root');
      let open = 1, sel = 0;
      const mode = FRAME.map(() => 'good');
      el.innerHTML = `<div class="stack" style="gap:14px">
        <div class="sdd-steps" data-sdd-steps></div>
        <div data-sdd-card></div>
        <div class="row"><button type="button" class="btn primary sm" data-sdd-next>Следующий шаг →</button><button type="button" class="btn ghost sm" data-sdd-all>Открыть все</button></div>
        <div data-sdd-sum></div>
      </div>`;
      function draw() {
        TR.$('[data-sdd-steps]', el).innerHTML = FRAME.map((s, i) => `<button type="button" class="sdd-step ${i < open ? (mode[i] === 'good' ? 'done' : 'skip') : ''}" data-sdd-step="${i}" aria-pressed="${i === sel}" ${i < open ? '' : 'disabled'}><span class="n">${i + 1}</span>${esc(s.t)}</button>`).join('');
        const s = FRAME[sel];
        TR.$('[data-sdd-card]', el).innerHTML = `<div class="sdd-box">
          <div class="row between"><div><div class="eyebrow">Шаг ${sel + 1} из 7 · массаж</div><b style="font-size:16px">${esc(s.t)}</b></div>${ui.seg('fm', [{ v: 'good', t: 'Как делает аналитик' }, { v: 'skip', t: 'Шаг пропустили' }], mode[sel], 'accent')}</div>
          <p class="muted" style="margin:0">${esc(s.q)}</p>
          ${mode[sel] === 'good' ? `<ul class="checks">${s.good.map(g => `<li>${g}</li>`).join('')}</ul>` : ui.note('bad', 'Что случится с проектом', s.skip)}
          ${ui.note('ok', 'Что здесь делает аналитик', s.an)}
        </div>`;
        const nx = TR.$('[data-sdd-next]', el); nx.disabled = open >= FRAME.length; nx.textContent = open >= FRAME.length ? 'Все шаги открыты' : 'Следующий шаг →';
        const skipped = FRAME.filter((x, i) => i < open && mode[i] === 'skip');
        const done = FRAME.filter((x, i) => i < open && mode[i] === 'good').length;
        TR.$('[data-sdd-sum]', el).innerHTML = `<div class="stack tight"><div class="row between"><b>Итог проекта «Массаж»: шагов сделано ${done} из 7</b><span class="small dim">${open < 7 ? `открыто ${open} из 7` : 'все шаги открыты'}</span></div>${ui.meter(done / 7, done === 7 ? 'ok' : skipped.length ? 'bad' : 'warn')}
          ${skipped.length ? `<ul class="checks">${skipped.map(x => `<li class="bad"><b>${esc(x.t)}</b>: ${esc(x.skip)}</li>`).join('')}</ul>` : open === 7 ? ui.note('ok', 'Функция готова к разработке', 'Требования ясны, нагрузка посчитана (и оказалась маленькой — значит, модуль в ядре), контракт и модель данных есть, узкие места закрыты, решение записано. Заметьте: оценка на шаге 2 определила архитектуру на шаге 5.') : ''}</div>`;
      }
      TR.on(el, 'click', '[data-sdd-step]', (e, b) => { sel = +b.dataset.sddStep; draw(); });
      TR.on(el, 'click', '[data-sdd-next]', () => { if (open < FRAME.length) { open++; sel = open - 1; draw(); } });
      TR.on(el, 'click', '[data-sdd-all]', () => { open = FRAME.length; draw(); });
      ui.onSeg(el, (n, v) => { if (n === 'fm') { mode[sel] = v; draw(); } });
      draw();
    }
  };

  // =====================================================================
  // Теория 2. Оценка нагрузки на салфетке: калькулятор эфира (соседний пример — лекция диетолога)
  // =====================================================================
  const NP = {
    viewers: [{ v: '300', t: '300' }, { v: '1000', t: '1 000' }, { v: '5000', t: '5 000' }, { v: '20000', t: '20 000' }],
    arrive: [{ v: '600', t: 'за 10 минут' }, { v: '60', t: 'за 1 минуту' }, { v: '10', t: 'за 10 секунд' }],
    share: [{ v: '1', t: '1 %' }, { v: '5', t: '5 %' }, { v: '20', t: '20 %' }],
    every: [{ v: '10', t: 'раз в 10 с' }, { v: '60', t: 'раз в минуту' }],
    rate: [{ v: '1', t: '1 Мбит/с · 480p' }, { v: '3', t: '3 Мбит/с · 720p' }, { v: '6', t: '6 Мбит/с · 1080p' }],
    route: [{ v: 'own', t: 'через наши серверы' }, { v: 'ext', t: 'внешний видеосервис + CDN' }]
  };
  const OUR_GBPS = 2; // условный исходящий канал всех экземпляров ядра вместе
  const howNapkin = {
    id: 'how-napkin', covers: ['calc'], title: 'Как это работает: оценка нагрузки на салфетке', free: true, noReset: true,
    simple: {
      icon: '🧮',
      plain: 'Прежде чем рисовать схему, прикидывают числа: сколько запросов в секунду, сколько данных, какой трафик. Точность не нужна — нужен порядок: десятки, тысячи или миллионы. От порядка зависит, хватит ли одного сервера или нужен совсем другой подход.',
      analogy: 'Как планировать праздник: «гостей 30, каждый съест по 3 куска — нужно 90 кусков, это 6 пицц». Вы не знаете точно, кто сколько съест, но заказывать 1 пиццу или 50 точно не будете.',
      tech: '<b>Оценка «на салфетке»</b> (back-of-the-envelope): нагрузка = количество × частота / время. Правила: округляйте смело; в сутках ≈ 86 400 с (≈ 100 тыс.); 1 байт = 8 бит; пик считают отдельно от среднего и берут запас (у «Пульса» — ×3). <b>Рассылка</b> (fan-out): одно сообщение в чате доставляется всем зрителям — доставок в секунду = сообщений в секунду × зрителей. <b>Трафик видео</b> = зрители × битрейт.'
    },
    lead: ui.brief({
      situation: 'Соседний пример. Раз в месяц «Пульс» хочет проводить открытую лекцию диетолога в прямом эфире для всех клиентов, с чатом вопросов. Тимур: «Прежде чем выбирать технологии, посчитайте, что нас ждёт». Калькулятор считает четыре числа и показывает, куда упрётся система.',
      todo: [
        'Двигайте зрителей от 300 до 20 000. Смотрите на трафик видео и на полоску «Наш канал».',
        'Меняйте, за сколько до начала все подключаются. Что происходит с подключениями в секунду?',
        'Поиграйте с чатом: доля пишущих и частота. Сравните «сообщений в секунду» и «доставок в секунду».',
        'Переключите «Куда идёт видео» на «внешний видеосервис + CDN». Что стало с нашим каналом?'
      ],
      look: 'Плитки — четыре оценки. Под ними — расчёт «на салфетке» с вашими цифрами: так его и пишут на доске. Полоски — сколько занято в нашем канале: зелёная — свободно, жёлтая — тесно, красная — канал забит и вместе с эфиром тормозит запись на занятия.'
    }),
    render(el) {
      el.classList.add('sdd-root');
      const st = { viewers: '1000', arrive: '600', share: '5', every: '60', rate: '1', route: 'own' };
      const row = (k, lbl, sub) => `<div class="lbl">${lbl}${sub ? `<small>${sub}</small>` : ''}</div>${ui.seg('np-' + k, NP[k], st[k], 'accent')}`;
      el.innerHTML = `<div class="stack" style="gap:14px">
        <div class="sdd-box"><div class="sdd-set">
          ${row('viewers', 'Зрителей на эфире')}
          ${row('arrive', 'Почти все подключаются', 'до начала эфира')}
          ${row('share', 'Пишут в чат', 'доля зрителей')}
          ${row('every', 'Каждый пишущий пишет')}
          ${row('rate', 'Качество видео', 'битрейт на одного зрителя')}
          ${row('route', 'Куда идёт видео')}
        </div></div>
        <div class="sdd-stats" data-sdd-st></div>
        <div data-sdd-calc></div>
        <div data-sdd-pipe></div>
        <div data-sdd-out></div>
      </div>`;
      function draw() {
        const V = +st.viewers, conn = V / +st.arrive, msg = V * (+st.share / 100) / +st.every, fan = msg * V, gbps = V * +st.rate / 1000, gbHour = +st.rate * 3600 / 8 / 1000;
        TR.$('[data-sdd-st]', el).innerHTML = [
          ['Подключений', nf(conn, conn < 10 ? 1 : 0) + '/с', 'в последние ' + plainT(NP.arrive.find(x => x.v === st.arrive).t).replace('за ', '')],
          ['Сообщений в чат', nf(msg, msg < 10 ? 1 : 0) + '/с', 'входящих от зрителей'],
          ['Доставок сообщений', nf(fan) + '/с', 'каждое — всем зрителям'],
          ['Трафик видео', nf(gbps, gbps < 10 ? 1 : 0) + ' Гбит/с', 'на один эфир']
        ].map(([k, v, s]) => `<div class="stat"><span class="k">${k}</span><span class="v">${v}</span><span class="s">${s}</span></div>`).join('');
        TR.$('[data-sdd-calc]', el).innerHTML = `<div class="sdd-napkin">
          <div>подключения: ${nf(V)} / ${st.arrive} с = <b>${nf(conn, 1)}/с</b></div>
          <div>чат: ${nf(V)} × ${st.share} % / ${st.every} с = <b>${nf(msg, 1)} сообщ./с</b></div>
          <div>рассылка: ${nf(msg, 1)} × ${nf(V)} зрителей = <b>${nf(fan)} доставок/с</b></div>
          <div>видео: ${nf(V)} × ${st.rate} Мбит/с = ${nf(V * +st.rate)} Мбит/с ≈ <b>${nf(gbps, 1)} Гбит/с</b></div>
          <div>час записи: ${st.rate} Мбит/с × 3 600 с / 8 = ${nf(+st.rate * 450)} МБ ≈ <b>${nf(gbHour, 2)} ГБ</b></div>
        </div>`;
        const own = st.route === 'own';
        const api = conn * 0.02 + msg * 0.002; // Гбит/с на API и чат — копейки
        const load = own ? (gbps + api) / OUR_GBPS : api / OUR_GBPS;
        const k = load > 1 ? 'bad' : load > .4 ? 'warn' : '';
        TR.$('[data-sdd-pipe]', el).innerHTML = `<div class="sdd-box"><div class="eyebrow">Наш исходящий канал (условно ${OUR_GBPS} Гбит/с на все экземпляры ядра)</div><div class="sdd-pipe">
          <div class="row2"><span>${own ? 'Видео + API + чат' : 'Только API и чат'}</span><div class="tr"><i class="${k}" style="width:${Math.min(100, Math.max(1.5, load * 100))}%"></i></div><span class="pc">${load > 9.99 ? '×' + nf(load) : nf(load * 100, load < .01 ? 2 : 0) + ' %'}</span></div>
          <div class="row2"><span>CDN видеосервиса</span><div class="tr"><i style="width:${own ? 0 : Math.min(100, Math.max(4, gbps / 40 * 100))}%"></i></div><span class="pc">${own ? '—' : nf(gbps, 1) + ' Гбит/с'}</span></div>
        </div></div>`;
        const out = [];
        if (own && load > 1) out.push(ui.note('bad', `Канал забит в ${nf(load, 1)} раза`, `Видео ${nf(gbps, 1)} Гбит/с не помещается в наш канал. Эфир заикается, а вместе с ним тормозят запись на занятия и проход по QR — они идут по тому же каналу. Вот почему видео не гонят через свои серверы.`));
        else if (own && load > .4) out.push(ui.note('warn', 'Влезает, но съедает канал записи', `Эфир занимает ${nf(load * 100)} % канала. Стоит зрителям прийти чуть больше — и запись на занятия начнёт тормозить. Видео — это не наш профиль нагрузки.`));
        else if (own) out.push(ui.note('', 'Пока влезает', 'На маленьком эфире трафик терпимый. Сдвиньте зрителей вправо — канал кончится очень быстро: трафик растёт ровно пропорционально зрителям.'));
        else out.push(ui.note('ok', 'Видео идёт мимо нас', `Зрители берут видео с серверов CDN рядом с ними. Наши серверы выдают только ссылки, принимают записи на эфир и держат чат — это ${api < .01 ? 'меньше 10' : nf(api * 1000)} Мбит/с.`));
        if (fan >= 1000) out.push(ui.note('warn', 'Чат — это рассылка', `${nf(msg, 1)} сообщений в секунду выглядят безобидно, но каждое уходит всем ${nf(V)} зрителям — это ${nf(fan)} доставок в секунду. Если каждый зритель будет спрашивать «есть новые?» раз в секунду, получится ${nf(V)} запросов в секунду впустую. Нужно постоянное соединение (WebSocket или SSE), через которое сервер сам толкает сообщения.`));
        if (conn >= 30) out.push(ui.note('info', 'Всплеск подключений', `${nf(conn)} подключений в секунду — это всплеск, как воскресенье 20:00. Значит, в момент подключения не должно быть тяжёлой работы: право смотреть проверяем заранее (при записи на эфир), а подключение — это выдача готовой ссылки.`));
        TR.$('[data-sdd-out]', el).innerHTML = `<div class="stack tight">${out.join('')}</div>`;
      }
      ui.onSeg(el, (n, v) => { if (n.startsWith('np-')) { st[n.slice(3)] = v; draw(); } });
      draw();
      el.querySelector('.stack').insertAdjacentHTML('beforeend', ui.note('', 'Что здесь делает аналитик', 'Аналитик приносит исходные числа от бизнеса (сколько зрителей, когда приходят, как живо общаются) и записывает их в требования. Оценку делают вместе с архитектором — и она часто решает спор «строить или купить» ещё до спора.'));
    }
  };

  // =====================================================================
  // Теория 3. Строить или купить: свой видеосервер или внешний видеосервис; HLS или WebRTC
  // =====================================================================
  const BUY = {
    own: {
      t: 'Свой видеосервер', sub: 'серверы в облаке, перекодирование, хранение — всё сами',
      crit: [
        ['Срок запуска', '4–6 месяцев, 3 разработчика', 'bad'],
        ['Деньги на старте', 'серверы перекодирования, хранилище, канал на пик', 'bad'],
        ['Деньги каждый месяц', 'серверы оплачены и простаивают между эфирами', 'warn'],
        ['Задержка видео', 'как сделаем: от долей секунды до 30 с', 'warn'],
        ['Кто чинит ночью', 'мы — дежурство Сергея', 'bad'],
        ['Риск для записи на занятия', 'высокий, если канал и серверы общие', 'bad'],
        ['Зависимость от поставщика', 'нет', 'ok']
      ],
      who: ['timur', '«Это полгода трёх человек на то, что не является сутью фитнес-клуба. И кто будет чинить видео в воскресенье?»']
    },
    hls: {
      t: 'Внешний видеосервис, HLS', sub: 'поставщик принимает поток из студии, раздаёт через CDN по HLS, пишет запись',
      crit: [
        ['Срок запуска', '3–4 недели на интеграцию', 'ok'],
        ['Деньги на старте', 'почти ноль', 'ok'],
        ['Деньги каждый месяц', 'плата за минуты просмотра: растёт вместе со зрителями', 'warn'],
        ['Задержка видео', '3–5 с у HLS с низкой задержкой, 10–30 с у обычного', 'warn'],
        ['Кто чинит ночью', 'поставщик по договору (SLA); мы — свою интеграцию', 'ok'],
        ['Риск для записи на занятия', 'нет: видео идёт мимо наших серверов', 'ok'],
        ['Зависимость от поставщика', 'есть: договор, цена, вывоз записей при смене', 'warn']
      ],
      who: ['anton', '«Разумно. Но в ADR запишите зависимость от поставщика и как мы уйдём, если он поднимет цену».']
    },
    rtc: {
      t: 'Внешний видеосервис, WebRTC', sub: 'тот же поставщик, но видео идёт по WebRTC через его серверы-ретрансляторы',
      crit: [
        ['Срок запуска', '4–6 недель', 'ok'],
        ['Деньги на старте', 'почти ноль', 'ok'],
        ['Деньги каждый месяц', 'минута просмотра в несколько раз дороже HLS', 'bad'],
        ['Задержка видео', 'меньше секунды — как видеозвонок', 'ok'],
        ['Кто чинит ночью', 'поставщик по договору (SLA)', 'ok'],
        ['Риск для записи на занятия', 'нет', 'ok'],
        ['Зависимость от поставщика', 'есть', 'warn']
      ],
      who: ['olga', '«Мгновенно — это красиво. Но платить в несколько раз больше за каждого зрителя? Тренер ведь и так отвечает голосом».']
    }
  };
  const LAT = [{ v: '20', t: 'Обычный HLS · 20 с' }, { v: '4', t: 'HLS с низкой задержкой · 4 с' }, { v: '0.5', t: 'WebRTC · 0,5 с' }];
  const howBuy = {
    id: 'how-buy', covers: ['arch', 'adr'], title: 'Как это работает: строить или купить', free: true, noReset: true,
    simple: {
      icon: '🛒',
      plain: 'Не всё нужно делать самим. Если задача сложная, но не главная для вашего бизнеса, а готовые сервисы делают её хорошо, — дешевле и надёжнее купить. Свои силы тратят на то, что отличает вас от конкурентов.',
      analogy: 'Клуб не строит свою электростанцию, хотя без света тренировок нет, — он платит за электричество. А вот программы тренировок и атмосферу в зале не купить — их делают сами.',
      tech: '<b>Строить или купить</b> (build vs buy): сравнивают срок, деньги на старте и в месяц, качество (задержка, масштаб), эксплуатацию (кто дежурит), риски и зависимость от поставщика. Для видео: <b>HLS</b> (HTTP Live Streaming) режет видео на короткие куски-файлы и раздаёт их по HTTP через CDN — масштабируется до миллионов зрителей, но с задержкой (обычный — 10–30 с, с низкой задержкой — 2–5 с). <b>WebRTC</b> — технология видеозвонков: задержка меньше секунды, но для тысяч зрителей нужны серверы-ретрансляторы, и это дороже.'
    },
    lead: ui.brief({
      situation: 'Соседний пример — та же лекция диетолога: 5 000 зрителей раз в месяц. Тимур собрал три варианта и просит сравнить их без эмоций: по сроку, деньгам, задержке, рискам. Цифры условные, но соотношения честные.',
      todo: [
        'Переключайте вариант и читайте таблицу: зелёное — хорошо, жёлтое — терпимо, красное — плохо. Смотрите, что скажет комитет.',
        'Ниже — «петля задержки»: тренер задаёт вопрос, зритель отвечает в чат. Переключите протокол и нажмите «Тренер спрашивает». Сколько ждёт тренер?'
      ],
      look: 'В петле задержки три отрезка: синий — видео летит к зрителю, фиолетовый — зритель думает и печатает, зелёный — сообщение чата летит к тренеру. Если петля длиннее 10 секунд, тренер уже показывает следующее упражнение — чат «не живой».'
    }),
    render(el) {
      el.classList.add('sdd-root');
      let opt = 'own', lat = '20';
      el.innerHTML = `<div class="stack" style="gap:14px">
        <div class="sdd-sub"><span class="l">1</span>Три варианта для видео</div>
        ${ui.seg('bv', Object.keys(BUY).map(k => ({ v: k, t: BUY[k].t })), opt, 'accent')}
        <div data-sdd-buy></div>
        <div class="sdd-sub"><span class="l">2</span>Петля задержки: тренер спросил — зритель ответил</div>
        ${ui.seg('lat', LAT, lat, 'accent')}
        <div class="row"><button type="button" class="btn primary sm" data-sdd-ask>▶ Тренер спрашивает: «Как пульс?»</button></div>
        <div data-sdd-loop></div>
      </div>`;
      function drawBuy() {
        const b = BUY[opt];
        const sc = b.crit.reduce((s, c) => s + (c[2] === 'ok' ? 1 : c[2] === 'warn' ? .5 : 0), 0) / b.crit.length;
        TR.$('[data-sdd-buy]', el).innerHTML = `<div class="sdd-box"><div><b>${esc(b.t)}</b><div class="small dim">${esc(b.sub)}</div></div>
          <div class="sdd-crit">${b.crit.map(c => `<div class="r"><b>${esc(c[0])}</b><span>${esc(c[1])}</span>${ui.status(c[2] === 'ok' ? 'хорошо' : c[2] === 'warn' ? 'терпимо' : 'плохо', c[2])}</div>`).join('')}</div>
          <div class="row between"><span class="small">Сумма по критериям для «Пульса»</span><span class="small tnum">${nf(sc * 100)} %</span></div>${ui.meter(sc, sc >= .7 ? 'ok' : sc >= .5 ? 'warn' : 'bad')}
          ${ui.say(b.who[0], b.who[1], b.who[0] === 'timur' ? { role: 'CTO «Пульса»' } : null)}</div>`;
      }
      let timers = [];
      function drawLoop(go) {
        timers.forEach(clearTimeout); timers = [];
        const v = +lat, h = 5, c = 0.3, tot = v + h + c;
        const pct = x => (x / 31 * 100).toFixed(1) + '%';
        const box = TR.$('[data-sdd-loop]', el);
        const verdict = tot > 10 ? ui.note('bad', `Петля ${nf(tot, 1)} с — чат «опаздывает»`, `Тренер спросил, а ответы приходят через ${nf(tot, 1)} с — он уже показывает следующее упражнение. Зрители видят, что тренер «не слышит». Для лекции диетолога, где вопросы разбирают в конце, это терпимо. Для тренировки, где тренер отвечает голосом, — нет.`)
          : tot > 6 ? ui.note('ok', `Петля ${nf(tot, 1)} с — живой разговор`, 'Ответы приходят, пока тренер ещё на этом упражнении. Большую часть петли занимает сам зритель — он думает и печатает. Ускорять видео дальше почти бессмысленно.')
          : ui.note('ok', `Петля ${nf(tot, 1)} с — как видеозвонок`, 'Почти мгновенно. Но выигрыш против HLS с низкой задержкой — 3–4 секунды, а цена минуты просмотра — в разы выше. Стоит ли это денег — вопрос к требованиям, а не к технологии.');
        box.innerHTML = `<div class="sdd-box sdd-tl"><div class="bar"><span class="v" style="width:${go ? '0' : pct(v)}">${v >= 2 ? 'видео ' + nf(v, 1) + ' с' : ''}</span><span class="h" style="width:${go ? '0' : pct(h)}">печатает 5 с</span><span class="c" style="width:${go ? '0' : pct(Math.max(c, .6))}"></span></div>
          <div class="leg"><span><i style="background:color-mix(in srgb, var(--info) 40%, var(--surface-2))"></i>видео к зрителю: ${nf(v, 1)} с</span><span><i style="background:color-mix(in srgb, var(--violet) 30%, var(--surface-2))"></i>зритель печатает: ~5 с</span><span><i style="background:color-mix(in srgb, var(--ok) 40%, var(--surface-2))"></i>чат к тренеру по WebSocket: 0,3 с</span></div>
          <div data-sdd-verd>${go ? '' : verdict}</div></div>`;
        if (go) {
          const spans = TR.$$('.bar span', box);
          timers.push(setTimeout(() => { spans[0].style.width = pct(v); }, 50));
          timers.push(setTimeout(() => { spans[1].style.width = pct(h); }, 500));
          timers.push(setTimeout(() => { spans[2].style.width = pct(Math.max(c, .6)); }, 950));
          timers.push(setTimeout(() => { const d = TR.$('[data-sdd-verd]', box); if (d) d.innerHTML = verdict; }, 1400));
        }
      }
      TR.on(el, 'click', '[data-sdd-ask]', () => drawLoop(true));
      ui.onSeg(el, (n, v) => { if (n === 'bv') { opt = v; drawBuy(); } if (n === 'lat') { lat = v; drawLoop(false); } });
      drawBuy(); drawLoop(false);
      el.querySelector('.stack').insertAdjacentHTML('beforeend', ui.note('', 'Что здесь делает аналитик', 'Аналитик не выбирает поставщика — он приносит то, по чему выбирают: требования (сколько зрителей, какая задержка терпима для чата, сколько хранить записи, кто может смотреть) и таблицу сравнения по ним. И пишет контракт интеграции с поставщиком: вебхуки о начале и конце эфира, личные ссылки на просмотр, что будет, если поставщик лёг.'));
    }
  };

  // =====================================================================
  // Практика 1. Требования и вопросы Ольге
  // =====================================================================
  const RQ = [
    { id: 'f1', t: 'Клиент записывается на онлайн-эфир из расписания в приложении', ok: 'fr' },
    { id: 'f2', t: 'Клиент смотрит эфир в приложении', ok: 'fr' },
    { id: 'f3', t: 'Клиент пишет вопросы тренеру в чат во время эфира', ok: 'fr' },
    { id: 'f4', t: 'Клиент пересматривает запись эфира в течение 30 дней', ok: 'fr' },
    { id: 'f5', t: 'Тренер запускает и завершает эфир из веб-кабинета', ok: 'fr' },
    { id: 'n1', t: 'Один эфир выдерживает до 2 000 зрителей', ok: 'nfr' },
    { id: 'n2', t: 'Вопрос из чата доходит до тренера, пока он ещё на этом упражнении', ok: 'nfr' },
    { id: 'n3', t: 'Если трансляции упали, запись на занятия в клубе и проход работают как обычно', ok: 'nfr' },
    { id: 'n4', t: 'Ссылку на эфир нельзя переслать постороннему: она личная и живёт недолго', ok: 'nfr', alt: 'fr', altWhy: 'Можно спорить: «смотрит только записавшийся» — функция. Но «ссылку нельзя переслать, она живёт недолго» — это про безопасность, то есть «насколько хорошо защищено».' },
    { id: 's1', t: 'Видео раздаём через CDN', ok: 'sol' },
    { id: 's2', t: 'Чат делаем на WebSocket', ok: 'sol' },
    { id: 's3', t: 'События эфира публикуем в Kafka', ok: 'sol' }
  ];
  const RQ_B = [{ id: 'fr', t: 'Функциональное', sub: 'что система делает' }, { id: 'nfr', t: 'Нефункциональное', sub: 'насколько хорошо' }, { id: 'sol', t: 'Не требование, а решение', sub: 'как сделать — это потом' }];
  const RQ_WHY = {
    fr: 'Это действие пользователя или системы — «что делает»?',
    nfr: 'Это свойство: сколько, как быстро, насколько надёжно или защищено?',
    sol: 'Здесь названа технология или способ — «как». Требование говорит, что нужно, а не чем это сделать.'
  };
  const QO = [
    { t: 'Сколько эфиров в день и сколько может идти одновременно?', ok: true, why: 'Это множитель для всех оценок: трафик, хранение записей, нагрузка на чат.', a: '«Вечером — до трёх эфиров одновременно. Всего около десяти в день, каждый по часу».' },
    { t: 'Кто может смотреть: только записавшиеся с действующим абонементом или любой клиент?', ok: true, why: 'Определяет проверку права смотреть, API выдачи ссылки и связь с «Абонементами».', a: '«Только записавшиеся, с действующим абонементом. Записаться можно заранее, мест — 2 000».' },
    { t: 'Насколько живым должен быть чат: тренер отвечает сразу голосом или после эфира?', ok: true, why: 'От ответа зависит допустимая задержка видео — а значит, HLS или WebRTC и цена.', a: '«Тренер отвечает голосом прямо в эфире. Пять секунд задержки — терпимо, полминуты — нет».' },
    { t: 'Что делаем, если эфир сорвался: переносим, уведомляем, возвращаем деньги?', ok: true, why: 'Сценарий отказа: без него поддержка не знает, что ответить 2 000 людям.', a: '«Пуш всем записавшимся и перенос на другое время. Денег за эфир не берём — он входит в абонемент».' },
    { t: 'Какой видеокодек использовать: H.264 или VP9?', ok: false, why: 'Технический вопрос — Ольга не ответит. Его решают с архитектором и поставщиком.', a: '«Я не знаю, что это. Это же ваша работа?»' },
    { t: 'Сделать свой видеосервер или купить готовый сервис?', ok: false, why: 'Это архитектурное решение, а не требование. Ольге приносят сравнение с ценой и рисками, а не перекладывают на неё выбор.', a: '«Вы мне скажите. Принесите варианты с ценой — я выберу».' },
    { t: 'Сколько хранить записи эфиров?', ok: false, why: 'Уже известно: 30 дней. Повторный вопрос тратит время и доверие заказчика.', a: '«Мы же говорили — 30 дней. Вы записываете?»' },
    { t: 'Нужна ли нам Kafka для онлайн-тренировок?', ok: false, why: 'Ольга не знает, что это. Спрашивайте про бизнес: кто, сколько, как часто, что будет при сбое.', a: '«Понятия не имею, что такое Kafka».' }
  ];
  const qCfg = { multi: true, options: QO };
  function rqScore(place) {
    let pts = 0; const rv = {};
    RQ.forEach(r => { const v = place[r.id]; if (!v) return; if (v === r.ok) { pts++; rv[r.id] = 'ok'; } else if (r.alt === v) { pts += .5; rv[r.id] = 'warn'; } else rv[r.id] = 'bad'; });
    return { pts, rv, score: pts / RQ.length };
  }
  const taskReq = {
    id: 'req', title: 'Шаг 1. Требования к онлайн-тренировкам',
    simple: howFrame.simple,
    lead: ui.brief({
      situation: 'Ольга принесла идею: «Эфиры из наших студий, до 2 000 зрителей на эфир, запись на эфир заранее, чат с тренером и запись эфира на 30 дней». Тимур накидал в общий документ 12 строк «требований» — часть из них вовсе не требования. А у Ольги есть 15 минут на вопросы.',
      todo: [
        'Разложите 12 карточек по корзинам: «Функциональное», «Нефункциональное», «Не требование, а решение».',
        'Ниже отметьте вопросы, которые стоит задать Ольге за эти 15 минут. Полезных — четыре.',
        'Нажмите «Проверить». После проверки Ольга ответит на выбранные вопросы — ответы пригодятся в следующих шагах. Засчитывается от 80 % по карточкам и от 3 баллов по вопросам: полезный вопрос +1, лишний −1.'
      ],
      lookTitle: 'Как отличать',
      look: 'Функциональное — глагол: «записывается», «смотрит», «пишет». Нефункциональное — мера: «сколько», «как быстро», «что работает при сбое», «кому нельзя». Если в строке назван инструмент (CDN, WebSocket, Kafka) — это уже решение. Вопрос к Ольге хорош, если на него может ответить только бизнес и от ответа меняется схема.'
    }),
    blank: () => ({ place: {}, q: [] }),
    reference: () => ({ place: Object.fromEntries(RQ.map(r => [r.id, r.ok])), q: QO.map((o, i) => o.ok ? i : -1).filter(i => i >= 0) }),
    render(el, ctx) {
      el.classList.add('sdd-root');
      const a = ctx.ans; a.place = a.place || {}; a.q = a.q || [];
      el.innerHTML = `<div class="stack" style="gap:16px">
        <div class="sdd-sub"><span class="l">А</span>Что из этого требования — и какие</div><div data-sdd-sort></div>
        <div class="sdd-sub"><span class="l">Б</span>Вопросы Ольге: 15 минут</div><div data-sdd-q></div>
        <div data-sdd-olga></div></div>`;
      const rv = ctx.result ? rqScore(a.place).rv : null;
      ui.sort(TR.$('[data-sdd-sort]', el), {
        items: RQ.map(r => ({ id: r.id, t: esc(r.t) })), buckets: RQ_B, value: a.place, readonly: ctx.readonly, reveal: rv, seed: 'sdd-req',
        onChange: v => { a.place = v; ctx.save(); ctx.decide('Требования: нефункциональные', RQ.filter(r => v[r.id] === 'nfr').map(r => r.id).join(', ') || '—'); }
      });
      ui.quiz(TR.$('[data-sdd-q]', el), {
        q: 'Какие вопросы задать Ольге?', multi: true, options: QO, value: a.q, readonly: ctx.readonly, reveal: ctx.result && (ctx.result.ok || ctx.readonly) ? ctx.result : null, seed: 'sdd-olga',
        onChange: v => { a.q = v; ctx.save(); ctx.decide('Вопросы Ольге', v.map(i => QO[i].t).join(' | ')); }
      });
      if (ctx.result && a.q.length) {
        TR.$('[data-sdd-olga]', el).innerHTML = `<div class="stack tight"><div class="eyebrow">Ольга отвечает на ваши вопросы</div>${a.q.map(i => QO[i]).filter(Boolean).map(o => `<div class="small dim">Вы: «${esc(o.t)}»</div>${ui.say('olga', esc(o.a))}`).join('')}</div>`;
      }
    },
    check(ans) {
      const place = ans.place || {}, q = ans.q || [], notes = [];
      const s = rqScore(place), qs = ui.quizScore(qCfg, q);
      const miss = RQ.filter(r => !place[r.id]).length;
      if (miss) notes.push({ ok: false, html: `Не разложено карточек: ${miss}.` });
      RQ.forEach(r => { const v = place[r.id]; if (!v || v === r.ok) return; notes.push({ ok: r.alt === v ? 'warn' : false, html: `«${esc(r.t)}»: ${r.alt === v ? r.altWhy : RQ_WHY[v]}` }); });
      const good = q.filter(i => QO[i] && QO[i].ok).length, bad = q.filter(i => QO[i] && !QO[i].ok);
      if (!q.length) notes.push({ ok: false, html: 'Вопросы Ольге не выбраны. Что вам нужно узнать у бизнеса, чтобы посчитать нагрузку и выбрать решение?' });
      bad.forEach(i => notes.push({ ok: false, html: `Вопрос «${esc(QO[i].t)}» — ${QO[i].why}` }));
      if (q.length && good < 4) notes.push({ ok: 'warn', html: `Полезных вопросов выбрано ${good} из 4. Подумайте: что из несказанного Ольгой меняет схему — сколько эфиров, кто смотрит, насколько живой чат, что при срыве?` });
      const score = .6 * s.score + .4 * qs.score;
      const ok = s.score >= .8 && qs.score >= .75;
      if (ok && !notes.length) notes.push({ ok: true, html: 'Требования отделены от решений, вопросы — только те, на которые может ответить бизнес.' });
      return { ok, score, summary: `Карточки: ${nf(s.pts, 1)} из ${RQ.length}. Вопросы: полезных ${good} из 4, лишних ${bad.length}.`, notes, vera: ok ? null : 'Две проверки на каждую строку: «это про что или про насколько?» и «назван ли здесь инструмент?». А к вопросу: «может ли на него ответить только Ольга — и изменится ли от ответа схема?».' };
    },
    explain: `<p><b>Функциональные</b> — пять действий: записаться, смотреть, писать в чат, пересматривать запись, запускать эфир. <b>Нефункциональные</b> — четыре меры: 2 000 зрителей, живой чат (задержка), независимость от записи на занятия, личная ссылка. <b>Решения</b> — CDN, WebSocket, Kafka: они появятся на шаге 4, а в требованиях закрывают другие варианты раньше времени.</p>
      <p>Хорошие вопросы Ольге дают <b>множители</b> (10 эфиров в день, до трёх одновременно), <b>права</b> (только записавшиеся), <b>меру качества</b> (5 секунд задержки — терпимо) и <b>сценарий отказа</b> (пуш и перенос). Кодек и «свой или купить» — не к ней; «30 дней» уже известно.</p>
      <p>Заметьте: «5 секунд терпимо» уже почти выбрало технологию — обычный HLS с задержкой 20 секунд не подходит, а платить за WebRTC не обязательно.</p>`,
    report: ans => {
      const p = ans.place || {};
      return RQ_B.map(b => `- ${b.t}: ${RQ.filter(r => p[r.id] === b.id).map(r => r.id + (r.ok === b.id ? '' : r.alt === b.id ? '~' : '✗')).join(', ') || '—'}`).join('\n') + '\n- Вопросы Ольге: ' + ((ans.q || []).map(i => (QO[i].ok ? '✓ ' : '✗ ') + QO[i].t).join('; ') || '—');
    }
  };

  // =====================================================================
  // Практика 2. Оценки нагрузки
  // =====================================================================
  const NUMS = [
    { id: 'conn', q: 'Подключений к эфиру в секунду в пик', hint: '2 000 зрителей за последнюю минуту', unit: 'в секунду', ref: 2000 / 60, lo: 28, hi: 40, why: '2 000 человек приходят за 60 секунд. Сколько это в одну секунду?' },
    { id: 'msg', q: 'Сообщений в чат в секунду', hint: 'входящих от зрителей', unit: 'в секунду', ref: 2000 * 0.1 / 30, lo: 5.5, hi: 8, why: 'Сколько человек пишет (10 % от 2 000) и как часто каждый (раз в 30 секунд)?' },
    { id: 'fan', q: 'Доставок сообщений зрителям в секунду', hint: 'каждое сообщение видят все', unit: 'в секунду', ref: 2000 * 0.1 / 30 * 2000, lo: 11000, hi: 16000, why: 'Каждое сообщение чата нужно доставить всем 2 000 зрителям. Умножьте предыдущее число на зрителей.' },
    { id: 'video', q: 'Трафик видео на один эфир', hint: 'все зрители смотрят одновременно', unit: 'Гбит/с', ref: 6, lo: 5, hi: 7, why: 'Зрители × 3 Мбит/с. Не забудьте перевести мегабиты в гигабиты (÷ 1 000).' },
    { id: 'store', q: 'Объём записей эфиров за 30 дней', hint: '10 эфиров в день по 60 минут', unit: 'ГБ', ref: 405, lo: 340, hi: 470, why: 'Сначала один час: 3 Мбит/с × 3 600 с, потом из битов в байты (÷ 8), потом × 10 эфиров × 30 дней.' }
  ];
  const parseNum = s => { const x = parseFloat(String(s == null ? '' : s).replace(/\s/g, '').replace(',', '.')); return isFinite(x) ? x : null; };
  const QC = {
    multi: true,
    options: [
      { t: 'Видео идёт мимо наших серверов: гигабиты в секунду — работа внешнего видеосервиса и CDN', ok: true, why: 'Да: трафик эфира в тысячи раз больше всего API «Пульса». Через ядро он задушит запись на занятия.' },
      { t: 'Чат — это рассылка: тысячи доставок в секунду требуют постоянного соединения, а не опроса', ok: true, why: 'Да: сервер сам толкает сообщения в открытые соединения (WebSocket или SSE). Опрос раз в секунду дал бы 2 000 запросов в секунду впустую.' },
      { t: 'Нужно шардировать PostgreSQL ядра', ok: false, why: 'Запись на эфир — десятки операций в секунду, одна PostgreSQL держит 400 записей в секунду. База — не узкое место.' },
      { t: 'Записи эфиров храним в PostgreSQL рядом с записями на занятия', ok: false, why: 'Сотни гигабайт видео в транзакционной базе раздуют бэкапы и реплики. Видео живёт в хранилище видеосервиса.' },
      { t: 'Нагрузка маленькая — всё делаем модулем в ядре, как массаж', ok: false, why: 'Запись на эфир — да, маленькая. Но видео и чат на порядки тяжелее: это и есть причина вынести трансляции в отдельный сервис (ADR-007).' }
    ]
  };
  function numScore(v) {
    const res = {}; let good = 0;
    NUMS.forEach(n => { const x = parseNum((v || {})[n.id]); res[n.id] = x == null ? null : (x >= n.lo && x <= n.hi); if (res[n.id]) good++; });
    return { res, good, score: good / NUMS.length };
  }
  const taskCalc = {
    id: 'calc', title: 'Шаг 2. Оценка нагрузки на салфетке',
    simple: howNapkin.simple,
    lead: ui.brief({
      situation: 'Ответы Ольги и Тимура: на эфир до 2 000 зрителей, почти все подключаются в последнюю минуту перед началом. В чат пишет примерно каждый десятый зритель, раз в 30 секунд. Видео — 3 Мбит/с на зрителя (720p). Эфиров — около 10 в день по 60 минут, запись храним 30 дней в одном качестве. Антон: «Посчитайте, и решим, что из этого вообще можно делать самим».',
      todo: [
        'Посчитайте пять чисел и впишите их в поля (можно с запятой). Достаточно порядка: допуск около ±15 %.',
        'Справа от полей «салфетка» сравнит ваши числа с тем, что «Пульс» уже держит.',
        'Ниже выберите выводы из оценок (их два).',
        'Нажмите «Проверить». Засчитывается от 4 верных чисел из 5 и без ложных выводов.'
      ],
      lookTitle: 'Подсказки',
      look: '1 байт = 8 бит. 1 Гбит = 1 000 Мбит. В часе 3 600 секунд. Чат — рассылка: одно сообщение видят все зрители. Для сравнения: в пик воскресенья «Пульс» принимает около 400 записей на занятия в секунду.'
    }),
    blank: () => ({ v: {}, q: [] }),
    reference: () => ({ v: { conn: '33', msg: '6,7', fan: '13300', video: '6', store: '405' }, q: [0, 1] }),
    render(el, ctx) {
      el.classList.add('sdd-root');
      const a = ctx.ans; a.v = a.v || {}; a.q = a.q || [];
      const res = ctx.result ? numScore(a.v).res : null;
      el.innerHTML = `<div class="stack" style="gap:16px"><div class="sdd-two">
        <div class="sdd-nums">${NUMS.map(n => `<label class="sdd-num ${res ? (res[n.id] ? 'ok' : 'bad') : ''}"><span class="q">${esc(n.q)}<small>${esc(n.hint)}</small></span>
          <span class="in"><input type="text" inputmode="decimal" autocomplete="off" data-sdd-n="${n.id}" value="${esc(a.v[n.id] || '')}" ${ctx.readonly ? 'readonly' : ''} aria-label="${esc(n.q)}"><span>${esc(n.unit)}</span></span>
          ${res && !res[n.id] ? `<span class="why">${res[n.id] === null ? 'Пусто. ' : ''}${esc(n.why)}</span>` : ''}</label>`).join('')}</div>
        <div data-sdd-napkin></div></div>
        <div data-sdd-qc></div></div>`;
      function napkin() {
        const g = id => parseNum(a.v[id]);
        const line = (k, x, cmp) => `<div>${k}: <b>${x == null ? '…' : nf(x, x < 10 ? 1 : 0)}</b>${x != null && cmp ? ' — ' + cmp(x) : ''}</div>`;
        TR.$('[data-sdd-napkin]', el).innerHTML = `<div class="stack tight"><div class="eyebrow">Ваша салфетка</div><div class="sdd-napkin">
          ${line('подключений/с', g('conn'), x => `${x > 400 ? 'больше' : 'меньше'} пика записи на занятия (400/с)`)}
          ${line('сообщений/с', g('msg'))}
          ${line('доставок/с', g('fan'), x => x >= 400 ? `в ${nf(x / 400, 1)} раза больше пика записи` : 'меньше пика записи')}
          ${line('видео, Гбит/с', g('video'), x => `≈ ${nf(x * 1000 / 3)} зрителей по 3 Мбит/с`)}
          ${line('записи за 30 дней, ГБ', g('store'), x => `≈ ${nf(x / 300, 2)} ГБ на один эфир`)}
        </div><div class="small dim">Правая часть строк — сверка смысла: если «видео» даёт не 2 000 зрителей, где-то потерялся множитель.</div></div>`;
      }
      napkin();
      el.addEventListener('input', e => {
        const i = e.target.closest('[data-sdd-n]'); if (!i || ctx.readonly) return;
        a.v[i.dataset.sddN] = i.value; ctx.save(); napkin();
        ctx.decide('Оценки нагрузки', NUMS.map(n => `${n.id}=${a.v[n.id] || '—'}`).join(', '));
      });
      ui.quiz(TR.$('[data-sdd-qc]', el), {
        q: 'Какие выводы следуют из ваших оценок?', multi: true, options: QC.options, value: a.q, readonly: ctx.readonly, reveal: ctx.result && (ctx.result.ok || ctx.readonly) ? ctx.result : null, seed: 'sdd-qc',
        onChange: v => { a.q = v; ctx.save(); }
      });
    },
    check(ans) {
      const d = numScore(ans.v), qs = ui.quizScore(QC, ans.q || []), notes = [];
      NUMS.forEach(n => { if (d.res[n.id] === null) notes.push({ ok: false, html: `«${esc(n.q)}» — пусто.` }); else if (!d.res[n.id]) notes.push({ ok: false, html: `«${esc(n.q)}» — не сходится. ${n.why}` }); });
      (ans.q || []).forEach(i => { const o = QC.options[i]; if (o && !o.ok) notes.push({ ok: false, html: `Вывод «${esc(o.t)}» — ${o.why}` }); });
      if (!(ans.q || []).length) notes.push({ ok: false, html: 'Выводы не выбраны. Что из посчитанного не помещается в обычную схему «Пульса»?' });
      const score = .7 * d.score + .3 * qs.score;
      const ok = d.score >= .8 && qs.score >= .5 && !(ans.q || []).some(i => QC.options[i] && !QC.options[i].ok);
      if (ok && !notes.length) notes.push({ ok: true, html: 'Все пять чисел в допуске, выводы верные.' });
      return { ok, score, summary: `Чисел в допуске: ${d.good} из ${NUMS.length}.`, notes, vera: ok ? null : 'Пишите расчёт строкой, как на доске: «2 000 × 3 Мбит/с = …». Ошибки почти всегда в единицах: биты и байты, мегабиты и гигабиты, минуты и секунды.' };
    },
    explain: `<div class="sdd-napkin">
        <div>подключения: 2 000 / 60 с ≈ <b>33/с</b> (с запасом ×3 — ~100/с)</div>
        <div>чат: 2 000 × 10 % / 30 с ≈ <b>6,7 сообщ./с</b></div>
        <div>рассылка: 6,7 × 2 000 ≈ <b>13 300 доставок/с</b></div>
        <div>видео: 2 000 × 3 Мбит/с = 6 000 Мбит/с = <b>6 Гбит/с</b> (три эфира вечером — 18 Гбит/с)</div>
        <div>час записи: 3 × 3 600 / 8 = 1 350 МБ; × 10 эфиров × 30 дней ≈ <b>405 ГБ</b></div></div>
      <p>Что говорят числа. Подключения и записи на эфир — маленькие: десятки в секунду, ядро и PostgreSQL их держат. <b>Чат</b> — тысячи доставок в секунду: это работа постоянных соединений и отдельного сервиса, а не REST. <b>Видео</b> — гигабиты: этого в «Пульсе» не было никогда, и это ровно та часть, которую покупают у видеосервиса с CDN. 405 ГБ записей — не проблема для хранилища видеосервиса, но и не место для PostgreSQL.</p>
      <p>Оценка заняла 5 минут и уже разрезала систему: что делаем сами (запись на эфир, права, чат), что покупаем (видео и записи).</p>`,
    report: ans => NUMS.map(n => { const x = parseNum((ans.v || {})[n.id]); return `- ${n.q}: ${x == null ? '—' : nf(x, 1) + ' ' + n.unit}${x == null ? '' : (x >= n.lo && x <= n.hi ? ' ✓' : ' ✗')}`; }).join('\n') + '\n- Выводы: ' + ((ans.q || []).map(i => (QC.options[i].ok ? '✓ ' : '✗ ') + QC.options[i].t).join('; ') || '—')
  };

  // =====================================================================
  // Практика 3. API и события
  // =====================================================================
  const EP = [
    { id: 'e1', m: 'GET', p: '/v1/streams?from=…&to=…', s: 'Расписание эфиров на неделю: 200, курсор, кэш', ok: true },
    { id: 'e2', m: 'POST', p: '/v1/streams/{streamId}/registrations', s: 'Записаться на эфир: Idempotency-Key → 201; 409 — уже записан; 422 — абонемент не действует', ok: true },
    { id: 'e3', m: 'POST', p: '/v1/streams/{streamId}/playback-tokens', s: 'Получить личную ссылку на просмотр: 201 { url, expiresAt } — подписанная ссылка CDN на 2 часа', ok: true },
    { id: 'e4', m: 'WS', p: '/v1/streams/{streamId}/chat', s: 'Канал чата по WebSocket: сообщения в обе стороны; не чаще 1 сообщения в 3 с от клиента', ok: true },
    { id: 'e5', m: 'GET', p: '/v1/streams/{streamId}/recording', s: 'Запись эфира: 200 { url, availableUntil }; через 30 дней — 410 Gone', ok: true },
    { id: 'e6', m: 'POST', p: '/internal/video/webhooks', s: 'Вебхук видеосервиса: эфир начался, закончился, запись готова; подпись HMAC, дедупликация по id события', ok: true },
    { id: 't1', m: 'GET', p: '/v1/streams/{streamId}/video.mp4', s: 'Отдаём видео зрителям через наш API', ok: false, crit: true, why: '2 000 × 3 Мбит/с = 6 Гбит/с через наши серверы — канал записи на занятия ляжет. Видео отдаёт CDN по личной ссылке из playback-tokens.' },
    { id: 't2', m: 'GET', p: '/v1/streams/{streamId}/register?clientId=…', s: 'Записаться на эфир одним GET-запросом', ok: false, why: 'GET обязан быть безопасным: его повторяют кэши, браузеры, предзагрузка. А clientId в адресе — путь к чужим записям, как на пентесте. Клиент берётся из токена, запись — POST.' },
    { id: 't3', m: 'GET', p: '/v1/streams/{streamId}/chat/messages?since=…', s: 'Каждый зритель раз в секунду спрашивает новые сообщения', ok: false, why: '2 000 зрителей × 1 запрос в секунду = 2 000 запросов в секунду — в 5 раз больше пика записи на занятия, и всё равно с задержкой до секунды. Нужен постоянный канал.' }
  ];
  const EV = [
    { id: 'v1', t: 'ViewerRegistered', d: '{ streamId, clientId }', s: 'Клиент записался на эфир', ok: true, who: 'Уведомления (напоминание за 15 минут), Аналитика' },
    { id: 'v2', t: 'StreamStarted', d: '{ streamId, trainerId, startedAt }', s: 'Эфир начался', ok: true, who: 'Уведомления (пуш «начинаем»), Аналитика' },
    { id: 'v3', t: 'ViewerJoined', d: '{ streamId, clientId, joinedAt }', s: 'Зритель подключился', ok: true, who: 'Аналитика (посещаемость), Рекомендации' },
    { id: 'v4', t: 'StreamEnded', d: '{ streamId, endedAt, viewersPeak }', s: 'Эфир закончился', ok: true, who: 'Аналитика' },
    { id: 'v5', t: 'RecordingReady', d: '{ streamId, availableUntil }', s: 'Запись эфира готова', ok: true, who: 'Уведомления (пуш «запись доступна 30 дней»)' },
    { id: 'v6', t: 'StreamCancelled', d: '{ streamId, reason }', s: 'Эфир отменён', ok: true, who: 'Уведомления (пуш и перенос), Аналитика' },
    { id: 'x1', t: 'StartStream', d: '{ streamId }', s: 'Запустить эфир', ok: false, why: 'Это команда «сделай», а не факт «случилось». События называют в прошедшем времени; команды — вызов API или очередь задач.' },
    { id: 'x2', t: 'ViewerJoined', d: '{ streamId, fullName, phone }', s: 'Зритель подключился — с ФИО и телефоном', ok: false, crit: true, why: 'Персональные данные в события не кладём — только clientId. Событие читают несколько сервисов и хранят 7 дней.' },
    { id: 'x3', t: 'VideoChunkUploaded', d: '{ streamId, bytes }', s: 'Кусок видео загружен — каждые 2 секунды', ok: false, why: 'Видео — не доменное событие. Гигабиты в Kafka — это уже свой видеосервис, который мы решили не строить.' },
    { id: 'x4', t: 'ViewerWatching', d: '{ streamId, clientId }', s: 'Зритель всё ещё смотрит — от каждого раз в 5 секунд', ok: false, why: '2 000 / 5 = 400 событий в секунду с одного эфира — больше, чем все доменные события «Пульса» (~2 млн в день, это около 23 в секунду). Это телеметрия; статистику просмотров даёт видеосервис.' }
  ];
  function apiScore(ans) {
    const ep = ans.ep || [], ev = ans.ev || [];
    const part = (list, sel) => { const goodN = list.filter(x => x.ok).length; const g = sel.filter(id => (list.find(x => x.id === id) || {}).ok).length; const b = sel.filter(id => { const x = list.find(y => y.id === id); return x && !x.ok; }).length; return Math.max(0, (g - b) / goodN); };
    const crit = [...EP, ...EV].filter(x => x.crit && (ep.includes(x.id) || ev.includes(x.id)));
    return { ep: part(EP, ep), ev: part(EV, ev), crit, score: (part(EP, ep) + part(EV, ev)) / 2 };
  }
  const taskApi = {
    id: 'api', title: 'Шаг 3. API и события',
    simple: {
      icon: '🔌',
      plain: 'API — это кнопки, которые приложение может «нажать» на сервере. События — это объявления «случилось вот это», которые читают другие сервисы. Нужны ровно те, без которых сценарии не пройти, и ни одного опасного.',
      analogy: 'Ресепшен клуба: «запишите меня», «дайте ключ от шкафчика» — это запросы. А объявление на доске «зал йоги закрыт на ремонт» — событие: его прочтут все, кому важно, и сами решат, что делать.',
      tech: 'Эндпоинты проектируют от сценариев: каждый шаг пользователя — запрос (ресурс, метод, ответы, ошибки, идемпотентность). События — факты в прошедшем времени в конверте с <code>eventId</code>; ПДн не кладём, только <code>clientId</code>. Для потока в реальном времени (чат) — постоянное соединение: WebSocket (в обе стороны) или SSE (от сервера) + POST.'
    },
    lead: ui.brief({
      situation: 'Денис из мобильной студии ждёт контракт: «Что приложение вызывает, чтобы записаться, посмотреть эфир и написать тренеру?». Лена — про события: «Кто узнает, что эфир начался, чтобы отправить пуш 2 000 людям?». На доске после мозгового штурма — 9 эндпоинтов и 10 событий. Часть из них опасна.',
      todo: [
        'Нажмите на эндпоинты, которые войдут в контракт сервиса «Трансляции». Нужных — шесть.',
        'Нажмите на события для топика <code>puls.stream.events.v1</code> (ключ — <code>streamId</code>). Нужных — шесть.',
        'Внизу собирается набросок контракта и список потребителей. Нажмите «Проверить». Засчитывается от 80 % и без опасных пунктов.'
      ],
      lookTitle: 'Как проверять каждый пункт',
      look: 'Пройдите сценарий клиента: записался → получил ссылку → смотрит → пишет в чат → пересматривает запись. Каждому шагу — один запрос. Не забудьте, откуда «Пульс» узнает, что эфир начался: это знает видеосервис. Для каждого пункта спросите: сколько запросов в секунду он даст при 2 000 зрителях (вспомните шаг 2)? Нет ли в нём персональных данных или видео?'
    }),
    blank: () => ({ ep: [], ev: [] }),
    reference: () => ({ ep: EP.filter(x => x.ok).map(x => x.id), ev: EV.filter(x => x.ok).map(x => x.id) }),
    render(el, ctx) {
      el.classList.add('sdd-root');
      const a = ctx.ans; a.ep = a.ep || []; a.ev = a.ev || [];
      const rv = !!ctx.result;
      el.innerHTML = `<div class="stack" style="gap:16px">
        <div class="sdd-sub"><span class="l">1</span>Эндпоинты</div><div class="sdd-cards" data-sdd-eps></div>
        <div class="sdd-sub"><span class="l">2</span>События в <code>puls.stream.events.v1</code></div><div class="sdd-cards" data-sdd-evs></div>
        <div class="sdd-sub"><span class="l">3</span>Набросок контракта</div><div class="sdd-two"><div data-sdd-oa></div><div data-sdd-aa></div></div>
      </div>`;
      const order = (list, seed) => TR.shuffle(list.map(x => x.id), seed);
      const epO = order(EP, 'sdd-ep'), evO = order(EV, 'sdd-ev');
      function cls(x, on) { if (!rv || !on) return ''; return x.ok ? 'ok' : 'bad'; }
      function draw() {
        TR.$('[data-sdd-eps]', el).innerHTML = epO.map(id => { const x = EP.find(y => y.id === id), on = a.ep.includes(id); return `<button type="button" class="sdd-card ${cls(x, on)}" data-sdd-ep="${id}" aria-pressed="${on}" ${ctx.readonly ? 'disabled' : ''}><span class="mk">${on ? '✓ В КОНТРАКТЕ' : 'НЕ ВЫБРАН'}</span><span class="t">${x.m === 'WS' ? '<span class="chip info" style="padding:0 6px">WS</span>' : ui.mth(x.m)} ${esc(x.p)}</span><span class="s">${esc(x.s)}</span>${rv && !x.ok && on ? `<span class="why">${esc(x.why)}</span>` : ''}</button>`; }).join('');
        TR.$('[data-sdd-evs]', el).innerHTML = evO.map(id => { const x = EV.find(y => y.id === id), on = a.ev.includes(id); return `<button type="button" class="sdd-card ${cls(x, on)}" data-sdd-ev="${id}" aria-pressed="${on}" ${ctx.readonly ? 'disabled' : ''}><span class="mk">${on ? '✓ В ТОПИКЕ' : 'НЕ ВЫБРАНО'}</span><span class="t">${esc(x.t)} ${esc(x.d)}</span><span class="s">${esc(x.s)}</span>${rv && !x.ok && on ? `<span class="why">${esc(x.why)}</span>` : ''}</button>`; }).join('');
        const eps = EP.filter(x => a.ep.includes(x.id)), evs = EV.filter(x => a.ev.includes(x.id));
        TR.$('[data-sdd-oa]', el).innerHTML = `<div class="card flat"><div class="eyebrow">OpenAPI · сервис «Трансляции»</div>${eps.length ? `<ul class="checks">${eps.map(x => `<li class="info"><b class="mono">${x.m} ${esc(x.p)}</b><br><span class="small">${esc(x.s)}</span></li>`).join('')}</ul>` : '<p class="small dim">Пока пусто.</p>'}</div>`;
        TR.$('[data-sdd-aa]', el).innerHTML = `<div class="card flat"><div class="eyebrow">AsyncAPI · puls.stream.events.v1</div>${evs.length ? `<ul class="checks">${evs.map(x => `<li class="info"><b class="mono">${esc(x.t)}</b> <span class="small mono">${esc(x.d)}</span><br><span class="small">читают: ${esc(x.who || 'кто? непонятно')}</span></li>`).join('')}</ul>` : '<p class="small dim">Пока пусто.</p>'}
          <div class="small dim">Конверт как у всех событий «Пульса»: eventId, type, version, occurredAt, producer, key = streamId, traceId. Публикация — через outbox.</div></div>`;
      }
      TR.on(el, 'click', '[data-sdd-ep]', (e, b) => { if (ctx.readonly) return; const id = b.dataset.sddEp; a.ep = a.ep.includes(id) ? a.ep.filter(x => x !== id) : a.ep.concat(id); ctx.save(); ctx.decide('API трансляций', a.ep.join(', ')); draw(); });
      TR.on(el, 'click', '[data-sdd-ev]', (e, b) => { if (ctx.readonly) return; const id = b.dataset.sddEv; a.ev = a.ev.includes(id) ? a.ev.filter(x => x !== id) : a.ev.concat(id); ctx.save(); ctx.decide('События трансляций', a.ev.join(', ')); draw(); });
      draw();
    },
    check(ans) {
      const d = apiScore(ans), notes = [], ep = ans.ep || [], ev = ans.ev || [];
      [...EP, ...EV].forEach(x => { const on = ep.includes(x.id) || ev.includes(x.id); if (on && !x.ok) notes.push({ ok: false, html: `${x.crit ? 'Опасно: ' : ''}<code>${esc(x.p || (x.t + ' ' + x.d))}</code> — ${x.why}` }); });
      const missEp = EP.filter(x => x.ok && !ep.includes(x.id)).length, missEv = EV.filter(x => x.ok && !ev.includes(x.id)).length;
      if (missEp) notes.push({ ok: false, html: `Не хватает эндпоинтов: ${missEp}. Пройдите сценарий: записался → ссылка → смотрит → чат → запись. И откуда мы узнаем, что эфир начался?` });
      if (missEv) notes.push({ ok: false, html: `Не хватает событий: ${missEv}. Кому нужно знать о записи на эфир, начале, подключении, конце, готовой записи и отмене?` });
      const ok = d.score >= .8 && !d.crit.length;
      if (ok && !notes.length) notes.push({ ok: true, html: 'Контракт полный и без опасных пунктов.' });
      return { ok, score: d.score, summary: `Эндпоинты: ${nf(d.ep * 100)} %. События: ${nf(d.ev * 100)} %.${d.crit.length ? ' Есть опасные пункты.' : ''}`, notes, vera: ok ? null : 'Для каждого пункта задайте два вопроса из шага 2: сколько это даст в секунду при 2 000 зрителях, и что будет, если это прочитает не тот сервис или человек?' };
    },
    explain: `<p><b>Шесть эндпоинтов</b> закрывают сценарий клиента целиком: расписание → запись на эфир (POST с <code>Idempotency-Key</code>, как запись на занятие) → <b>личная ссылка на просмотр</b> (POST, потому что создаёт новый токен — как QR-пропуск) → чат по WebSocket → запись эфира с <code>410 Gone</code> после 30 дней. Шестой — <b>вебхук от видеосервиса</b>: только он знает, что эфир реально начался и запись готова. Его контракт тоже пишет аналитик: подпись HMAC, повторы, дедупликация.</p>
      <p>Опасные пункты: видео через API (6 Гбит/с), запись через GET с <code>clientId</code> в адресе, опрос чата (2 000 запросов в секунду).</p>
      <p><b>Шесть событий</b> — факты в прошедшем времени, по одному на каждую «новость», которую ждут другие: напоминание, пуш «начинаем», посещаемость, итог эфира, пуш о записи, отмена. Ловушки: команда <code>StartStream</code>, ПДн в <code>ViewerJoined</code>, видео и «пульс зрителя» раз в 5 секунд — это телеметрия, а не доменные события.</p>`,
    report: ans => `- Эндпоинты: ${(ans.ep || []).map(id => { const x = EP.find(y => y.id === id); return x ? `${x.m} ${x.p}${x.ok ? '' : ' ✗'}` : id; }).join('; ') || '—'}\n- События: ${(ans.ev || []).map(id => { const x = EV.find(y => y.id === id); return x ? `${x.t} ${x.d}${x.ok ? '' : ' ✗'}` : id; }).join('; ') || '—'}`
  };

  // =====================================================================
  // Практика 4. Архитектура: блоки и роли с живым предпросмотром
  // =====================================================================
  const AR = [
    { id: 'r1', t: 'Сервис «Трансляции»', ok: 'a' },
    { id: 'r2', t: 'Внешний видеосервис', ok: 'b' },
    { id: 'r3', t: 'CDN', ok: 'c' },
    { id: 'r4', t: 'Чат: приложение ↔ «Трансляции»', ok: 'd' },
    { id: 'r5', t: 'Kafka, топик puls.stream.events.v1', ok: 'e' },
    { id: 'r6', t: 'Видеосервис → «Трансляции»', ok: 'f' },
    { id: 'r7', t: '«Трансляции» → ядро («Абонементы»)', ok: 'g', alt: 'e', altWhy: 'Можно и так: держать у себя копию статусов абонементов из puls.membership.events.v1. Но тогда «Трансляции» — ещё один потребитель, а проверка идёт с задержкой. Для записи на эфир (десятки в секунду) простой синхронный вызов честнее.' },
    { id: 'r8', t: 'Сервис «Уведомления»', ok: 'h' }
  ];
  const ARC = [
    { v: 'a', t: 'Владелец эфиров, записей на эфир и чата; выдаёт личные ссылки на просмотр', sh: 'владелец эфиров и чата' },
    { v: 'b', t: 'Принимает поток из студии, перекодирует в несколько качеств, пишет запись', sh: 'приём, перекодирование, запись' },
    { v: 'c', t: 'Раздаёт видео 2 000 зрителей по HLS с ближайших к ним серверов', sh: 'раздаёт HLS зрителям' },
    { v: 'd', t: 'Постоянное соединение WebSocket: сообщения в обе стороны за доли секунды', sh: 'WebSocket' },
    { v: 'e', t: 'События StreamStarted, ViewerJoined… для уведомлений и аналитики (через outbox)', sh: 'события через outbox' },
    { v: 'f', t: 'Вебхук с подписью HMAC: эфир начался, закончился, запись готова', sh: 'вебхук с HMAC' },
    { v: 'g', t: 'Синхронный REST-вызов при записи на эфир: «действует ли абонемент клиента?»', sh: 'REST: абонемент?' },
    { v: 'h', t: 'Читает события и кладёт задачи «отправь пуш» в свою очередь RabbitMQ', sh: 'задачи в RabbitMQ' },
    { v: 'x1', t: 'Раздаёт видео зрителям через наши экземпляры ядра', sh: 'видео через ядро', trap: 'Ядро раздаёт 6 Гбит/с: канал забит, запись на занятия и проход по QR тормозят вместе с эфиром.' },
    { v: 'x2', t: 'Опрос по REST раз в секунду', sh: 'опрос раз в секунду', trap: '2 000 опросов в секунду — в 5 раз больше пика записи на занятия, а чат всё равно запаздывает до секунды.' },
    { v: 'x3', t: 'Двухфазная фиксация (2PC) с ядром', sh: '2PC с ядром', trap: 'Видеосервис 2PC не поддерживает, а держать блокировки ядра на время эфира нельзя — запись встанет.' }
  ];
  const AR_HINT = {
    r1: 'Чей это сервис и какими данными он владеет? Кто выдаёт ссылку на просмотр только записавшимся?',
    r2: 'Что происходит с видео между камерой в студии и тысячами телефонов?',
    r3: 'Кто ближе всех к зрителям и выдерживает гигабиты?',
    r4: 'Какой канал нужен, чтобы сервер сам толкал сообщения тысячам клиентов?',
    r5: 'Как остальные сервисы узнают, что эфир начался или запись готова?',
    r6: 'Видеосервис — внешний. Как внешняя система сообщает нам о том, что у неё случилось?',
    r7: 'Право смотреть зависит от абонемента. Абонементы — в ядре. Как спросить, нужен ли ответ сразу?',
    r8: 'Пуш — это задача «сделай». Где у «Пульса» живут такие задачи?'
  };
  function arScore(m) {
    let pts = 0; const rv = {};
    AR.forEach(r => { const v = m[r.id]; if (!v) return; if (v === r.ok) { pts++; rv[r.id] = { s: 'ok' }; } else if (r.alt === v) { pts += .6; rv[r.id] = { s: 'warn', why: r.altWhy }; } else rv[r.id] = { s: 'bad', why: (ARC.find(c => c.v === v) || {}).trap || AR_HINT[r.id] }; });
    const traps = AR.filter(r => /^x/.test(m[r.id] || ''));
    return { pts, rv, traps, score: pts / AR.length };
  }
  function arSvg(m, rv) {
    const W = 890, H = 420;
    const N = {
      studio: [20, 22, 160, 56, 'Студия клуба', 'камера тренера'],
      vsvc: [330, 18, 220, 64, 'Внешний видеосервис', 'r2'],
      cdn: [700, 18, 170, 64, 'CDN', 'r3'],
      core: [20, 172, 160, 60, 'Ядро', '«Абонементы»'],
      streams: [330, 168, 220, 68, 'Сервис «Трансляции»', 'r1'],
      app: [700, 172, 170, 60, 'Приложение', '2 000 зрителей'],
      kafka: [330, 330, 220, 64, 'Kafka', 'r5'],
      notif: [700, 330, 170, 64, 'Уведомления', 'r8']
    };
    const sh = v => { const c = ARC.find(x => x.v === v); return c ? c.sh : '?'; };
    const tone = rid => { if (rv && rv[rid]) return rv[rid].s; const v = m[rid]; if (!v) return 'none'; return /^x/.test(v) ? 'trapv' : 'set'; };
    const clr = t => t === 'ok' ? 'var(--ok)' : t === 'bad' ? 'var(--bad)' : t === 'warn' ? 'var(--warn)' : t === 'trapv' ? 'var(--bad)' : t === 'none' ? 'var(--text-muted)' : 'var(--accent)';
    const clip = (n, tx, ty) => { const cx = n[0] + n[2] / 2, cy = n[1] + n[3] / 2, dx = tx - cx, dy = ty - cy; if (!dx && !dy) return { x: cx, y: cy }; const s = Math.min((n[2] / 2 + 4) / Math.abs(dx || 1e-9), (n[3] / 2 + 4) / Math.abs(dy || 1e-9)); return { x: cx + dx * s, y: cy + dy * s }; };
    let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="min-width:660px;max-width:${W}px" role="img" aria-label="Схема онлайн-тренировок"><defs><marker id="sdd-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" style="fill:var(--text-2)"/></marker></defs>`;
    const edge = (a, b, label, rid, both, dy) => {
      const A = N[a], B = N[b];
      const p = clip(A, B[0] + B[2] / 2, B[1] + B[3] / 2), q = clip(B, A[0] + A[2] / 2, A[1] + A[3] / 2);
      const t = rid ? tone(rid) : 'fixed';
      const col = rid ? clr(t) : 'var(--text-muted)';
      s += `<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" style="stroke:${col};stroke-width:${rid ? 2 : 1.3};${t === 'none' ? 'stroke-dasharray:5 4;' : ''}" marker-end="url(#sdd-ar)" ${both ? 'marker-start="url(#sdd-ar)"' : ''}/>`;
      const txt = rid ? (m[rid] ? sh(m[rid]) : '?') : label;
      if (txt) s += `<text x="${(p.x + q.x) / 2}" y="${(p.y + q.y) / 2 - 6 + (dy || 0)}" text-anchor="middle" style="fill:${rid ? col : 'var(--text-2)'};font-size:11.5px;font-weight:${rid ? 600 : 400};paint-order:stroke;stroke:var(--code-bg);stroke-width:4px;stroke-linejoin:round">${esc(txt)}</text>`;
    };
    edge('studio', 'vsvc', 'поток эфира');
    edge('vsvc', 'cdn', 'видео');
    edge('cdn', 'app', 'видео по ссылке');
    edge('vsvc', 'streams', '', 'r6');
    edge('app', 'streams', '', 'r4', true);
    edge('streams', 'core', '', 'r7');
    edge('streams', 'kafka', 'outbox');
    edge('kafka', 'notif', 'события');
    edge('notif', 'app', 'пуш', null, false, 0);
    if (AR.some(r => m[r.id] === 'x1')) {
      s += `<path d="M100 233 V 262 H 735 V 238" style="fill:none;stroke:var(--bad);stroke-width:3;stroke-dasharray:7 5" marker-end="url(#sdd-ar)"/><text x="215" y="284" text-anchor="middle" style="fill:var(--bad);font-size:12px;font-weight:700;paint-order:stroke;stroke:var(--code-bg);stroke-width:4px">видео 6 Гбит/с через ядро</text>`;
    }
    Object.keys(N).forEach(k => {
      const n = N[k], rid = /^r\d$/.test(n[5]) ? n[5] : null, t = rid ? tone(rid) : 'fixed';
      const ext = k === 'vsvc' || k === 'cdn' || k === 'studio';
      s += `<rect x="${n[0]}" y="${n[1]}" width="${n[2]}" height="${n[3]}" rx="10" style="fill:${k === 'streams' ? 'color-mix(in srgb, var(--accent) 18%, var(--surface-2))' : k === 'kafka' ? 'color-mix(in srgb, var(--warn) 14%, var(--surface-2))' : 'var(--surface-2)'};stroke:${rid ? clr(t) : 'var(--border-strong)'};stroke-width:${rid ? 2 : 1.2};${ext || t === 'none' ? 'stroke-dasharray:6 4;' : ''}"/>`;
      s += `<text x="${n[0] + n[2] / 2}" y="${n[1] + n[3] / 2 - 4}" text-anchor="middle" style="fill:var(--text);font-size:13px;font-weight:600">${esc(n[4])}</text>`;
      const sub = rid ? (m[rid] ? sh(m[rid]) : 'роль: ?') : n[5];
      s += `<text x="${n[0] + n[2] / 2}" y="${n[1] + n[3] / 2 + 14}" text-anchor="middle" style="fill:${rid ? clr(t) : 'var(--text-muted)'};font-size:11.5px">${esc(sub)}</text>`;
    });
    return s + '</svg>';
  }
  const taskArch = {
    id: 'arch', title: 'Шаг 4. Архитектура: собрать схему',
    simple: howBuy.simple,
    lead: ui.brief({
      situation: 'Антон нарисовал на доске блоки, но подписи стёрлись: «Восстановите, кто за что отвечает и как блоки общаются. И помните про оценки: 6 Гбит/с видео, 13 000 доставок в чате в секунду». Сервис «Трансляции» уже есть в ADR-007 — один из пяти, вынесенных из ядра.',
      todo: [
        'Для каждого блока или связи выберите в списке его роль или протокол. Три варианта в списке — ловушки.',
        'Под списками схема перерисовывается по вашим выборам, ещё ниже — симуляция «19:59, 2 000 зрителей подключаются».',
        'Нажмите «Проверить». Засчитывается от 80 % и без ловушек.'
      ],
      lookTitle: 'Как читать схему',
      look: 'Пунктир — внешний блок или связь без роли. Цветные подписи — ваши выборы. Если выбор ломает систему в пик, симуляция покажет это красным ещё до проверки. После проверки рамки станут зелёными или красными.'
    }),
    blank: () => ({ m: {} }),
    reference: () => ({ m: Object.fromEntries(AR.map(r => [r.id, r.ok])) }),
    render(el, ctx) {
      el.classList.add('sdd-root');
      const a = ctx.ans; a.m = a.m || {};
      const rv = ctx.result ? arScore(a.m).rv : null;
      el.innerHTML = `<div class="stack" style="gap:14px"><div data-sdd-match></div><div class="board sdd-svg" data-sdd-svg></div><div class="small dim">На узком экране схему можно прокрутить вбок.</div><div data-sdd-sim></div></div>`;
      function drawLive() {
        TR.$('[data-sdd-svg]', el).innerHTML = arSvg(a.m, rv);
        const lines = [];
        const set = AR.filter(r => a.m[r.id]).length;
        lines.push(`<div class="info">Назначено ролей: ${set} из ${AR.length}.</div>`);
        AR.forEach(r => { const c = ARC.find(x => x.v === a.m[r.id]); if (c && c.trap) lines.push(`<div class="bad"><b>${esc(r.t)}:</b> ${esc(c.trap)}</div>`); });
        const vid = AR.some(r => a.m[r.id] === 'c'), chat = a.m.r4;
        if (set === AR.length && !AR.some(r => /^x/.test(a.m[r.id] || ''))) lines.push(`<div class="${vid ? 'ok' : 'warn'}">19:59: ${vid ? 'видео 6 Гбит/с уходит зрителям с CDN, наши серверы его не видят' : 'кто раздаёт видео 2 000 зрителям? Проверьте роли'}.</div>`, `<div class="${chat === 'd' ? 'ok' : 'warn'}">20:00: ${chat === 'd' ? 'чат держит открытые соединения — сообщения доходят за доли секунды' : 'как сообщения чата доходят до зрителей?'}.</div>`);
        TR.$('[data-sdd-sim]', el).innerHTML = `<div class="stack tight"><div class="eyebrow">Симуляция: 19:59, 2 000 зрителей подключаются</div><div class="sdd-sim">${lines.join('')}</div></div>`;
      }
      ui.match(TR.$('[data-sdd-match]', el), {
        rows: AR.map(r => ({ id: r.id, t: esc(r.t) })), choices: ARC.map(c => ({ v: c.v, t: c.t })), value: a.m, readonly: ctx.readonly, reveal: rv, placeholder: 'Роль или протокол…',
        onChange: v => { a.m = v; ctx.save(); drawLive(); ctx.decide('Схема трансляций', AR.map(r => `${r.id}=${a.m[r.id] || '—'}`).join(', ')); }
      });
      drawLive();
    },
    check(ans) {
      const m = ans.m || {}, d = arScore(m), notes = [];
      const miss = AR.filter(r => !m[r.id]).length;
      if (miss) notes.push({ ok: false, html: `Без роли: ${miss} ${TR.plural(miss, 'блок', 'блока', 'блоков')}.` });
      AR.forEach(r => { const v = m[r.id]; if (!v || v === r.ok) return; const c = ARC.find(x => x.v === v); notes.push({ ok: r.alt === v ? 'warn' : false, html: `${esc(r.t)}: ${r.alt === v ? r.altWhy : c && c.trap ? 'ловушка — ' + c.trap : AR_HINT[r.id]}` }); });
      const ok = d.score >= .8 && !d.traps.length;
      if (ok && !notes.length) notes.push({ ok: true, html: 'Схема собрана: видео мимо нас, чат на постоянных соединениях, события через outbox, право смотреть — у владельца абонементов.' });
      return { ok, score: d.score, summary: `Ролей на месте: ${nf(d.pts, 1)} из ${AR.length}.${d.traps.length ? ' Есть ловушки.' : ''}`, notes, vera: ok ? null : 'Идите по пути видео (студия → видеосервис → CDN → телефон), потом по пути сообщения чата, потом по пути новости «эфир начался» (видеосервис → вебхук → «Трансляции» → Kafka → «Уведомления» → пуш). У каждого пути — свой инструмент.' };
    },
    explain: `<p>Схема разделена по природе нагрузки:</p>
      <ul class="checks">
        <li><b>Видео</b> (гигабиты) — целиком у поставщика: видеосервис принимает поток из студии, перекодирует и пишет запись, CDN раздаёт HLS. Наши серверы видео не видят.</li>
        <li><b>Чат</b> (тысячи доставок в секунду) — сервис «Трансляции» держит WebSocket-соединения. Это его нагрузка, ядро о ней не знает.</li>
        <li><b>Деловая часть</b> (десятки операций) — «Трансляции» владеют эфирами, записями на эфир и чатом; право смотреть спрашивают у «Абонементов» в ядре синхронно, при записи на эфир, а не при каждом подключении.</li>
        <li><b>Новости</b> — видеосервис сообщает вебхуком с HMAC, «Трансляции» публикуют события через outbox в Kafka, «Уведомления» превращают их в задачи RabbitMQ и шлют пуши.</li>
      </ul>
      <p>Главное свойство схемы — <b>эфир не может положить запись на занятия</b>: ни видео, ни чат не идут через ядро. Это и было нефункциональным требованием из шага 1.</p>`,
    report: ans => AR.map(r => { const c = ARC.find(x => x.v === (ans.m || {})[r.id]); return `- ${r.t} → ${c ? c.t : '—'}${c ? (c.v === r.ok ? ' ✓' : r.alt === c.v ? ' ~' : ' ✗') : ''}`; }).join('\n')
  };

  // =====================================================================
  // Практика 5. ADR-010 своими словами
  // =====================================================================
  const ADR_RUBRIC = [
    'Контекст с цифрами: 2 000 зрителей на эфир, ~33 подключения/с в пик, видео ~6 Гбит/с на эфир, чат ~13 000 доставок/с, записи ~400 ГБ за 30 дней',
    'Варианты: свой видеосервер или внешний видеосервис; HLS или WebRTC — и почему отвергнутые не подошли',
    'Решение: внешний видеосервис + CDN (HLS с низкой задержкой); сервис «Трансляции» владеет эфирами, записью на эфир и чатом; чат по WebSocket; события в Kafka через outbox',
    'Узкие места и защита: пик подключения (право проверено при записи, подключение — выдача готовой ссылки), чат (лимит сообщений), сбой видеосервиса (пуш и перенос), эфир не задевает запись на занятия',
    'Компромиссы и цена: зависимость от поставщика и плата за минуты, задержка 3–5 с, ещё один сервис в эксплуатации',
    'Наблюдаемость: что мониторит дежурный — время старта видео, доля зрителей с остановками, ошибки подключения к чату, отставание событий'
  ];
  const ADR_REF = 'ADR-010. Онлайн-тренировки: внешний видеосервис + сервис «Трансляции». Контекст: до 2 000 зрителей на эфир, почти все подключаются за минуту до начала — около 33 подключений в секунду; видео 3 Мбит/с — около 6 Гбит/с на эфир, вечером до трёх эфиров одновременно; чат: 10 % зрителей пишут раз в 30 с — около 7 сообщений и 13 000 доставок в секунду; запись хранится 30 дней — около 400 ГБ. Требование: эфир не должен задевать запись на занятия; задержка до 5 с, чтобы тренер отвечал голосом. Варианты: 1) свой видеосервер — 4–6 месяцев и канал на 6+ Гбит/с, видео не наша суть, отвергнут; 2) внешний видеосервис по WebRTC — задержка меньше секунды, но минута в разы дороже, а 5 с нам хватает; 3) внешний видеосервис + CDN по HLS с низкой задержкой (3–5 с). Решение: вариант 3. Сервис «Трансляции» (ADR-007) владеет эфирами, записями на эфир и чатом; запись на эфир — POST с Idempotency-Key, право смотреть проверяем у «Абонементов» синхронно при записи; при подключении только выдаём личную подписанную ссылку на 2 часа; чат — WebSocket, не чаще одного сообщения в 3 с от клиента; видеосервис сообщает о начале, конце и записи вебхуком с HMAC; события StreamStarted, ViewerJoined, RecordingReady и др. — в puls.stream.events.v1 через outbox. Узкие места: пик подключения держит CDN и лёгкая выдача ссылки; чат — отдельная нагрузка «Трансляций», не ядра; если видеосервис лёг — пуш записавшимся и перенос эфира, запись на занятия не страдает. Последствия: + запуск за недели, масштаб и хранение записей у поставщика, эфир изолирован от ядра; − зависимость от поставщика (в договоре — выгрузка записей при уходе), плата за минуты растёт со зрителями, задержка 3–5 с, ещё один сервис в эксплуатации. Наблюдаемость: время старта видео, доля зрителей с остановками, ошибки и число соединений чата, отставание событий; алерт — на симптомы для зрителя.';
  const taskAdr = {
    id: 'adr', title: 'Шаг 5. Узкие места, компромиссы и ADR-010',
    simple: howBuy.simple,
    lead: ui.brief({
      situation: 'Антон: «В пятницу комитет. Ольга спросит, когда запустимся и сколько стоит, Тимур — что будет, если поставщик ляжет, Сергей — что ему мониторить. Напишите ADR-010 — я подпишу, если в нём есть всё». Ниже — ваши материалы из прошлых шагов.',
      todo: [
        'Напишите ADR-010 своими словами (от 400 знаков): контекст с цифрами, варианты, решение, узкие места и защита, компромиссы, что мониторим.',
        'Нажмите «Проверить с Верой (Claude)» или «Сверить с эталоном самому» и отметьте раскрытые пункты. Засчитывается от 60 %.'
      ],
      lookTitle: 'Из чего собрать',
      look: 'Контекст — числа из шага 2 и требования из шага 1. Варианты — таблица «строить или купить» из теории. Решение — схема из шага 4. Узкие места — пик подключения и чат. Компромиссы — честные минусы: так комитет поверит плюсам.'
    }),
    blank: () => ({ j: {} }),
    reference: () => ({ j: { text: ADR_REF, self: ADR_RUBRIC.map(() => true) } }),
    render(el, ctx) {
      el.classList.add('sdd-root');
      const box = mount(el, 'stack');
      if (!ctx.readonly) {
        const calc = (TR.taskState(ID, 'calc').ans || {}).v || {}, arch = (TR.taskState(ID, 'arch').ans || {}).m || {};
        const has = NUMS.some(n => calc[n.id]);
        box.insertAdjacentHTML('beforeend', `<details class="more"><summary>Ваши материалы из шагов 2 и 4</summary><div class="stack tight">
          ${has ? `<div class="sdd-napkin">${NUMS.map(n => `<div>${esc(n.q)}: <b>${esc(calc[n.id] || '—')}</b> ${esc(n.unit)}</div>`).join('')}</div>` : '<p class="small dim">Оценки ещё не заполнены — вернитесь к шагу 2.</p>'}
          <ul class="checks">${AR.map(r => { const c = ARC.find(x => x.v === arch[r.id]); return `<li class="${c ? 'info' : 'warn'}">${esc(r.t)} — ${c ? esc(c.t) : 'роль не выбрана'}</li>`; }).join('')}</ul></div></details>`);
      }
      ui.justify(mount(box), {
        id: 'sdd-adr010', q: 'ADR-010: онлайн-тренировки',
        qPlain: 'Напишите архитектурное решение ADR-010 «Онлайн-тренировки» для сети фитнес-клубов «Пульс»: контекст с оценками нагрузки, варианты (свой видеосервер или внешний видеосервис, HLS или WebRTC), решение, узкие места и защиту, компромиссы и цену, наблюдаемость.',
        rubric: ADR_RUBRIC, reference: ADR_REF, value: ctx.ans.j, readonly: ctx.readonly, minLen: 400,
        onChange: v => { ctx.ans.j = v; ctx.save(); ctx.decide('ADR-010', v.text || ''); }
      });
    },
    check(ans) {
      const s = ui.justifyScore(ans && ans.j);
      return { ok: s >= .6, score: s, summary: s ? `Оценка ADR: ${nf(s * 100)} %.` : 'Напишите ADR (от 400 символов) и проверьте с Верой или сверьте с эталоном сами.', notes: s && s < .6 ? [{ ok: false, html: 'Проверьте, есть ли: цифры контекста, два-три варианта с причинами, решение одной-двумя фразами, узкие места с защитой, честные минусы, что мониторим.' }] : [] };
    },
    explain: '<p>Сильный ADR-010 читается как история: <b>числа</b> (6 Гбит/с, 13 000 доставок) → <b>почему не сами</b> (видео не суть фитнес-клуба, полгода работы, канал на пик) → <b>почему HLS, а не WebRTC</b> (5 секунд Ольге хватает, а минута WebRTC в разы дороже) → <b>что строим сами</b> (то, что знает только «Пульс»: кто записан, кто может смотреть, чат с тренером) → <b>чем платим</b>.</p><p>Обратите внимание на роль аналитика в этом документе: цифры контекста, требование «эфир не задевает запись», задержка «5 секунд терпимо», сценарий «видеосервис лёг» и контракты (API, события, вебхук) — всё это ваше. Варианты и подпись — вместе с Антоном.</p>',
    report: ans => (ans.j && ans.j.text) ? ans.j.text : '—'
  };

  // =====================================================================
  TR.stage({
    id: ID, act: 8, order: 510, slot: 'Пн 10:00', title: 'Онлайн-тренировки с нуля',
    when: 'понедельник, 10:00 · студия «Сайкл» — отсюда пойдут первые эфиры',
    intro: [
      { who: 'olga', html: 'Инвестор спрашивает про онлайн-тренировки: эфиры из наших студий, до 2 000 зрителей, запись на эфир, чат с тренером и запись эфира на 30 дней. Когда запустимся?' },
      { who: 'anton', html: 'Прежде чем отвечать «когда», пройдём всю рамку системного дизайна: требования, оценки, API, данные, архитектура, узкие места, компромиссы. Ведёте вы, я подстрахую.' },
      { who: 'vera', html: 'Сегодня — системный дизайн целиком, с нуля. Сначала на маленьком примере разберём семь шагов, научимся считать нагрузку на салфетке и решать «строить или купить». Потом ваша очередь: онлайн-тренировки от требований до ADR-010.' }
    ],
    facts: ['F-availability', 'F-pentest', 'F-push'],
    glossary: [
      { term: 'Системный дизайн', simple: 'Путь от «хотим новую функцию» до схемы, которую можно строить, — по одним и тем же шагам.', tech: 'Проектирование системы верхнего уровня: требования → оценка нагрузки → API → данные → архитектура → узкие места → компромиссы. Итог — схема, контракты и ADR.' },
      { term: 'Оценка «на салфетке»', simple: 'Быстрый подсчёт порядка чисел: десятки, тысячи или миллионы запросов — чтобы понять, какой нужен подход.', tech: 'Back-of-the-envelope estimation: количество × частота / время; трафик = пользователи × битрейт; объём = скорость × длительность. Округляют смело, пик считают отдельно, берут запас.' },
      { term: 'Функциональное требование', simple: 'Что система делает: «клиент записывается на эфир», «пишет в чат».', tech: 'Описывает поведение системы — действия пользователей и реакции системы. В паре с нефункциональными («насколько хорошо») задаёт рамку проекта; решения («на WebSocket») требованиями не являются.' },
      { term: 'Строить или купить', simple: 'Делать самим или взять готовый сервис. Самим — то, что отличает вас от других; остальное выгоднее купить.', tech: 'Build vs buy: сравнение по сроку, деньгам на старте и в месяц, качеству, эксплуатации, рискам и зависимости от поставщика. Решение фиксируют в ADR.' },
      { term: 'HLS', simple: 'Способ показывать прямой эфир тысячам людей: видео режут на короткие кусочки-файлы и раздают как обычные файлы.', tech: 'HTTP Live Streaming: сегменты по 2–6 с и плейлист по HTTP, раздача через CDN, несколько качеств на выбор. Задержка — 10–30 с, у варианта с низкой задержкой (LL-HLS) — 2–5 с.' },
      { term: 'WebRTC', simple: 'Технология видеозвонков: почти без задержки, но дорого раздавать тысячам зрителей.', tech: 'Web Real-Time Communication: передача медиа в реальном времени с задержкой меньше секунды. Для больших эфиров нужны серверы-ретрансляторы (SFU), что дороже HLS.' },
      { term: 'Битрейт', simple: 'Сколько данных в секунду нужно, чтобы смотреть видео. Чем лучше качество, тем больше.', tech: 'Объём потока в бит/с: 480p ≈ 1 Мбит/с, 720p ≈ 3 Мбит/с, 1080p ≈ 6 Мбит/с. Трафик эфира = зрители × битрейт; 1 байт = 8 бит.' },
      { term: 'Подписанная ссылка', simple: 'Личная ссылка на видео, которая работает недолго и только для того, кому выдана.', tech: 'Signed URL: адрес с подписью и сроком действия, который проверяет CDN. Выдаёт наш сервис после проверки прав; переслать её на неделю или подделать нельзя.' },
      { term: 'Узкое место', simple: 'Место, которое первым не выдерживает нагрузку, — как узкая дверь в зал, когда все выходят разом.', tech: 'Bottleneck: компонент, ограничивающий пропускную способность всей системы. Ищут по оценкам нагрузки (канал, соединения, база) и закрывают отдельным решением.' }
    ],
    outro: 'Вы прошли системный дизайн целиком: от «хотим эфиры» до ADR-010. Требования отделили от решений, вопросами Ольге получили множители, за пять минут на салфетке нашли, что видео — гигабиты, а чат — рассылка, и разрезали систему по природе нагрузки: видео покупаем, деловую часть и чат строим сами, ядро от эфира изолировано. В пятницу это решение — и всё, что мы приняли за четыре недели, — придётся защищать перед комитетом.',
    tasks: [howFrame, howNapkin, howBuy, taskReq, taskCalc, taskApi, taskArch, taskAdr]
  });
})();
