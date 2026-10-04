/* Неделя 6, вторник 10:00: границы модулей. Канон — _dev/DOMAIN-2.md §5 (контексты, владение данными, как общаются).
   Теория (живая): одно слово — разные смыслы (переключатель контекста меняет поля «клиента» и «занятия», режим «одна общая модель»),
   у каждой таблицы один хозяин (клик по таблице, «как есть / как правильно», владелец меняет схему — что ломается),
   связность и сцепление (ползунок вызовов, перенос границы) и карта контекстов.
   Практика: разложить таблицы и сценарии по 10 контекстам, лаборатория «чужая таблица», нарушения границ на схеме,
   обоснование «почему Запись и Платежи вместе, а Бонусы отдельно». */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc;

  if (!document.getElementById('abd-css')) document.head.insertAdjacentHTML('beforeend', `<style id="abd-css">
    .abd-root, .abd-root .stack, .abd-root .stack > * { min-width: 0; }
    .abd-root :not(pre) > code { white-space: normal; overflow-wrap: anywhere; }
    .abd-root .seg { max-width: 100%; flex-wrap: wrap; }
    .abd-root .seg button { white-space: normal; text-align: left; }
    .abd-box { display: grid; gap: 12px; padding: 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); min-width: 0; }
    .abd-box > * { min-width: 0; }
    .abd-set { display: grid; grid-template-columns: minmax(0, 150px) minmax(0, 1fr); gap: 8px 14px; align-items: center; }
    .abd-set > .lbl { font-size: 13.5px; color: var(--text-2); }
    .abd-sub { font: 600 16px/1.3 var(--f-brand); display: flex; gap: 10px; align-items: baseline; }
    .abd-sub .l { font: 600 12px/1 var(--f-mono); color: var(--accent); border: 1px solid var(--accent); border-radius: 6px; padding: 3px 6px; }
    .abd-word { display: grid; gap: 10px; padding: 14px; border: 1px solid var(--accent); border-radius: 12px; background: var(--accent-soft); min-width: 0; }
    .abd-word h4 { margin: 0; font: 600 17px/1.3 var(--f-brand); overflow-wrap: anywhere; }
    .abd-word .q { font-size: 13.5px; color: var(--text-2); }
    .abd-fields { display: grid; gap: 6px; }
    .abd-f { display: grid; grid-template-columns: minmax(0, 190px) minmax(0, 1fr) auto; grid-template-areas: "n d t"; gap: 4px 12px; align-items: center; padding: 6px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); font-size: 13.5px; }
    .abd-f .n { grid-area: n; } .abd-f .d { grid-area: d; } .abd-f > .abd-tag, .abd-f > .tg { grid-area: t; justify-self: end; }
    .abd-f > * { min-width: 0; overflow-wrap: anywhere; }
    .abd-f .n { font: 12.5px/1.3 var(--f-mono); color: var(--text); }
    .abd-f .who { font-size: 12px; color: var(--text-muted); grid-area: d; }
    .abd-tag { font: 600 11px/1.2 var(--f-mono); border-radius: 6px; padding: 3px 6px; white-space: nowrap; border: 1px solid var(--border-strong); color: var(--text-2); }
    .abd-tag.own { border-color: var(--ok); color: var(--ok); background: var(--ok-soft); }
    .abd-tag.ref { border-color: var(--info); color: var(--info); background: var(--info-soft); }
    .abd-tag.copy { border-color: var(--violet); color: var(--violet); background: var(--violet-soft); }
    .abd-tag.api { border-color: var(--warn); color: var(--warn); background: var(--warn-soft); }
    .abd-tag.many { border-color: var(--bad); color: var(--bad); background: var(--bad-soft); }
    .abd-legend { display: flex; flex-wrap: wrap; gap: 6px 12px; font-size: 12.5px; color: var(--text-2); align-items: center; }
    .abd-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(118px, 1fr)); gap: 6px; }
    .abd-strip button { text-align: left; border: 1px solid var(--border); border-radius: 8px; padding: 6px 9px; background: var(--surface-2); color: var(--text); font-size: 13px; cursor: pointer; display: grid; gap: 1px; min-width: 0; }
    .abd-strip button small { font-size: 11.5px; color: var(--text-muted); overflow-wrap: anywhere; }
    .abd-strip button[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); }
    .abd-mods { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
    .abd-mod { border: 1.5px solid var(--border-strong); border-radius: 10px; padding: 8px 10px; background: var(--surface-2); display: grid; gap: 6px; align-content: start; min-width: 0; }
    .abd-mod .h { font: 600 13.5px/1.25 var(--f-brand); display: flex; justify-content: space-between; gap: 6px; flex-wrap: wrap; }
    .abd-mod .h small { font: 500 10.5px/1.3 var(--f-mono); color: var(--text-muted); text-transform: uppercase; letter-spacing: .06em; }
    .abd-mod .tbls { display: flex; flex-wrap: wrap; gap: 4px; }
    .abd-mod .role { font-size: 12px; color: var(--text-2); }
    .abd-mod.owner { border-color: var(--info); background: var(--info-soft); }
    .abd-mod.legit { border-color: var(--ok); background: var(--ok-soft); }
    .abd-mod.direct { border-color: var(--bad); border-style: dashed; }
    .abd-mod.broken { border-color: var(--bad); background: var(--bad-soft); }
    .abd-mod.silent { border-color: var(--warn); background: var(--warn-soft); }
    .abd-tb { font: 12px/1.2 var(--f-mono); border: 1px solid var(--border-strong); border-radius: 6px; padding: 4px 7px; background: var(--surface); color: var(--text); cursor: pointer; }
    .abd-tb:hover { border-color: var(--accent); }
    .abd-tb[aria-pressed="true"] { border-color: var(--accent); background: var(--accent); color: var(--accent-text, #fff); }
    .abd-rd { display: grid; gap: 6px; }
    .abd-rd .it { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 8px; align-items: start; font-size: 13.5px; }
    .abd-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .abd-stats .v { font-size: 15px; overflow-wrap: anywhere; }
    .abd-stats .stat.cur { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
    .abd-range { width: 100%; margin: 4px 0; accent-color: var(--accent); }
    .abd-pair { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr) minmax(0, 1fr); gap: 10px; align-items: stretch; }
    .abd-pair.one { grid-template-columns: minmax(0, 1fr); }
    .abd-pm { border: 1.5px solid var(--border-strong); border-radius: 12px; padding: 10px 12px; background: var(--surface-2); display: grid; gap: 6px; align-content: start; }
    .abd-pm h5 { margin: 0; font: 600 14px/1.3 var(--f-brand); }
    .abd-pm ul { margin: 0; padding-left: 18px; font-size: 13px; color: var(--text-2); display: grid; gap: 3px; }
    .abd-pm li.mv { color: var(--accent); }
    .abd-calls { display: grid; gap: 4px; align-content: center; }
    .abd-call { font-size: 12.5px; border: 1px dashed var(--warn); border-radius: 7px; padding: 4px 8px; background: var(--warn-soft); overflow-wrap: anywhere; }
    .abd-call::before { content: "→ "; color: var(--warn); font-weight: 700; }
    .abd-call.rev { border-color: var(--info); background: var(--info-soft); }
    .abd-call.rev::before { content: "← "; color: var(--info); }
    .abd-calls .none { font-size: 12.5px; color: var(--text-muted); text-align: center; }
    .abd-board { overflow-x: auto; border: 1px solid var(--border); border-radius: 12px; background: var(--surface-2); padding: 6px; }
    .abd-board svg { display: block; width: 100%; height: auto; }
    .abd-board .edge { cursor: pointer; }
    .abd-board .edge:hover path, .abd-board .edge:hover line { stroke-width: 3.2; }
    .abd-board .node { cursor: default; }
    .abd-arr { display: grid; gap: 6px; }
    .abd-ar { display: grid; grid-template-columns: 30px minmax(0, 1fr) auto; gap: 6px 10px; align-items: center; padding: 8px 10px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); min-width: 0; }
    .abd-ar > * { min-width: 0; }
    .abd-ar .no { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font: 600 12px/1 var(--f-mono); background: var(--surface-3); color: var(--text); }
    .abd-ar .tx { font-size: 13.5px; overflow-wrap: anywhere; }
    .abd-ar .tx b { font-weight: 600; }
    .abd-ar .ctl { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
    .abd-ar .fix { grid-column: 2 / -1; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-size: 13px; }
    .abd-ar .fix select { min-width: 0; max-width: 100%; }
    .abd-ar .why { grid-column: 2 / -1; font-size: 13px; color: var(--text-2); }
    .abd-ar.marked { border-color: var(--bad); }
    .abd-ar.marked .no { background: var(--bad); color: #fff; }
    .abd-ar.flash { box-shadow: 0 0 0 2px var(--accent); }
    .abd-ar.ok { border-color: var(--ok); background: var(--ok-soft); }
    .abd-ar.bad { border-color: var(--bad); background: var(--bad-soft); }
    .abd-ar.warn { border-color: var(--warn); background: var(--warn-soft); }
    .abd-time { display: grid; gap: 4px; }
    .abd-time .t { display: grid; grid-template-columns: 76px minmax(0, 1fr); gap: 8px; font-size: 13.5px; padding: 6px 10px; border-left: 3px solid var(--border-strong); background: var(--surface); border-radius: 0 8px 8px 0; }
    .abd-time .t > * { min-width: 0; overflow-wrap: anywhere; }
    .abd-time .t b.tm { font: 600 12px/1.4 var(--f-mono); color: var(--text-2); }
    .abd-time .t.bad { border-left-color: var(--bad); } .abd-time .t.ok { border-left-color: var(--ok); } .abd-time .t.warn { border-left-color: var(--warn); }
    .abd-mx { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .abd-mx .stat .v { font-size: 14px; }
    .abd-mx .stat.cur { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
    .abd-cm { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 14px; align-items: start; }
    @media (max-width: 760px) {
      .abd-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .abd-set { grid-template-columns: minmax(0, 1fr); gap: 4px; }
      .abd-set > .lbl { margin-top: 6px; }
      .abd-f { grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "n t" "d d"; }
      .abd-pair { grid-template-columns: minmax(0, 1fr); }
      .abd-mx { grid-template-columns: minmax(0, 1fr); }
      .abd-cm { grid-template-columns: minmax(0, 1fr); }
      .abd-ar { grid-template-columns: 30px minmax(0, 1fr); }
      .abd-ar .ctl { grid-column: 2 / -1; justify-content: flex-start; }
    }
  </style>`);

  const tOf = (list, v) => { const x = list.find(o => o.v === v); return x ? String(x.t).replace(/<[^>]+>/g, '') : '—'; };
  const quizRef = QS => QS.map(cfg => cfg.options.map((o, i) => o.ok ? i : -1).filter(i => i >= 0));
  const plainT = s => String(s || '').replace(/<[^>]+>/g, '');
  const lock = (el, ro) => { if (ro) TR.$$('[data-seg] button', el).forEach(b => { b.disabled = true; }); };
  const COL = { ok: 'var(--ok)', bad: 'var(--bad)', warn: 'var(--warn)', info: 'var(--info)', accent: 'var(--accent)', mute: 'var(--border-strong)', dim: 'var(--text-muted)' };
  const TAGS = {
    own: ['свои', 'свои данные: контекст их создаёт и меняет'],
    ref: ['ссылка', 'только идентификатор чужой сущности'],
    copy: ['копия', 'копия у себя: приходит событием от владельца, сам контекст её не меняет'],
    api: ['спрашивает', 'берёт у владельца через его API, когда нужно']
  };
  const tag = k => `<span class="abd-tag ${k}" title="${esc(TAGS[k][1])}">${TAGS[k][0]}</span>`;

  // SVG: прямоугольник-узел и стрелка-ломаная с номером
  function svgNode(n, tone) {
    const stroke = tone ? COL[tone] : n.ext ? 'var(--border-strong)' : n.db ? 'var(--info)' : 'var(--border-strong)';
    const fill = n.core ? 'var(--surface)' : n.ext ? 'var(--surface-3)' : 'var(--surface)';
    const lines = String(n.t).split('\n');
    let s = `<g class="node"><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${n.db ? 14 : 9}" style="fill:${fill};stroke:${stroke}" stroke-width="1.6" ${n.ext ? 'stroke-dasharray="5 4"' : ''}/>`;
    lines.forEach((ln, j) => { s += `<text x="${n.x + n.w / 2}" y="${n.y + n.h / 2 + 5 + (j - (lines.length - 1) / 2) * 15}" text-anchor="middle" style="fill:var(--text);font:${j ? '400 11.5px var(--f-mono, monospace)' : '600 13px var(--f-body, sans-serif)'}">${esc(ln)}</text>`; });
    return s + '</g>';
  }
  function svgDefs(prefix) {
    return `<defs>${Object.keys(COL).map(k => `<marker id="${prefix}-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" style="fill:${COL[k]}"/></marker>`).join('')}</defs>`;
  }

  // =====================================================================
  // Теория 1. Одно слово — разные смыслы
  // =====================================================================
  const F = (n, t, k) => ({ n, t, k: k || 'own' });
  const WORDS = {
    client: {
      t: 'Клиент',
      ctxs: [
        { id: 'clients', t: 'Клиенты', who: 'ресепшен и профиль в приложении', name: 'Клиент', q: 'Кто этот человек и как с ним связаться?',
          fields: [F('id', 'идентификатор клиента — его знают все контексты'), F('full_name', 'ФИО'), F('phone', 'телефон — уникальный, по нему вход'), F('email', 'email, необязательный'), F('birth_date', 'дата рождения'), F('consents', 'согласия на обработку ПДн и рассылки'), F('medical_valid_until', 'медсправка для бассейна действует до')] },
        { id: 'pay', t: 'Платежи', who: 'бухгалтерия', name: 'Плательщик', q: 'Сколько заплатил, что вернули, что ушло в 1С?',
          fields: [F('client_id', 'кто платил', 'ref'), F('payments', 'платежи и попытки оплаты'), F('refunds', 'возвраты'), F('card_mask', 'карта ****4417 — как её вернул ПэйПоинт'), F('exported_to_1c_at', 'когда выгружено в 1С')] },
        { id: 'book', t: 'Запись', who: 'тренер у входа в зал', name: 'Участник занятия', q: 'Записан ли, пришёл ли, можно ли его записывать?',
          fields: [F('client_id', 'кто записан', 'ref'), F('display_name', '«Анна С.» в списке тренера', 'copy'), F('membership_ok', 'действует ли абонемент в этом клубе', 'api'), F('status', 'записан / лист ожидания / пришёл / прогул'), F('no_shows_30d', 'прогулов за 30 дней'), F('blocked_until', 'запись заблокирована до')] },
        { id: 'bonus', t: 'Бонусы', who: 'маркетинг', name: 'Участник программы', q: 'Сколько бонусов и за что начислены?',
          fields: [F('client_id', 'чей счёт', 'ref'), F('balance', 'баланс бонусов'), F('operations', 'начисления и списания'), F('referred_by', 'кто привёл — для +500', 'copy')] },
        { id: 'access', t: 'Доступ', who: 'турникет в клубе', name: 'Пропуск', q: 'Пустить через турникет прямо сейчас?',
          fields: [F('client_id', 'чей пропуск', 'ref'), F('allowed', 'пускать ли сейчас', 'copy'), F('home_club', 'домашний клуб', 'copy'), F('daytime_only', 'только до 17:00', 'copy'), F('last_visit', 'последний проход')] }
      ],
      conflicts: [
        'Бухгалтерия просит сделать email обязательным — для чеков. Маркетинг против: при регистрации по телефону email не спрашивают. Одна таблица — спор двух команд о чужом поле.',
        'Анна просит удалить её персональные данные (F-delete). Что стереть в таблице на 25 полей? ФИО — да, а платежи хранить 5 лет. Пять команд спорят, чьё это поле.',
        'Тренеру нужны «прогулы», маркетингу — «баланс», турникету — «пускать ли». Каждая правка — миграция общей таблицы, которую читают пять команд. Тронул одно — проверяй всех.'
      ]
    },
    cls: {
      t: 'Занятие',
      ctxs: [
        { id: 'sched', t: 'Расписание', who: 'управляющий клубом', name: 'Занятие в сетке', q: 'Что, где, когда и кто ведёт?',
          fields: [F('id', 'идентификатор занятия'), F('class_type', 'направление: йога, сайкл, пилатес'), F('room', 'зал и его вместимость'), F('trainer', 'тренер с допуском к направлению'), F('starts_at', 'начало и конец — по времени клуба'), F('status', 'по плану / отменено (заболел тренер)')] },
        { id: 'book', t: 'Запись', who: 'клиент в приложении', name: 'Места на занятие', q: 'Есть ли место и до какого времени отменять бесплатно?',
          fields: [F('class_session_id', 'на какое занятие', 'ref'), F('starts_at', 'начало — для правила «за 2 часа»', 'copy'), F('free_seats', 'занять место — у Расписания', 'api'), F('bookings', 'кто записан'), F('waitlist', 'очередь листа ожидания'), F('cancel_rule', 'бесплатная отмена — не позже чем за 2 часа')] },
        { id: 'analytics', t: 'Аналитика', who: 'директор', name: 'Строка отчёта', q: 'Насколько загружено и стоит ли оставлять в сетке?',
          fields: [F('class_session_id', 'какое занятие', 'ref'), F('type_club_trainer', 'направление, клуб, тренер — из событий', 'copy'), F('load_pct', 'загрузка, %'), F('no_show_pct', 'доля прогулов'), F('hour_of_week', 'день и час — для тепловой карты')] },
        { id: 'partners', t: 'Партнёры', who: 'ФитПасс', name: 'Слот для партнёра', q: 'Можно ли записать клиента ФитПасса и что ему показать?',
          fields: [F('public_id', 'публичный id занятия', 'ref'), F('title_time', 'название и время', 'copy'), F('free_seats', 'свободно мест — у владельца', 'api'), F('partner_rules', 'правила партнёра: лимит визитов, отмена')] }
      ],
      conflicts: [
        '«Отменить занятие» у Расписания — тренер заболел, занятия не будет. «Отменить» у Записи — Анна передумала. В общей модели одно слово — два разных действия и один статус на двоих.',
        'Записи нужно место, которое в пик меняется сотни раз в секунду. Аналитике — загрузка за месяц. Если обе читают одну и ту же строку, тяжёлый отчёт тормозит запись.',
        'Партнёрам нужен публичный id и название, но не внутренний номер зала и не прогулы. Общая модель отдаёт наружу всё подряд — и каждое поле становится чьей-то зависимостью.'
      ]
    }
  };
  function unionFields(w) {
    const m = new Map();
    w.ctxs.forEach(c => c.fields.forEach(f => {
      const key = f.n === 'client_id' || f.n === 'class_session_id' || f.n === 'public_id' ? 'id' : f.n;
      if (!m.has(key)) m.set(key, { n: key, t: f.t, by: [] });
      if (!m.get(key).by.includes(c.t)) m.get(key).by.push(c.t);
    }));
    return [...m.values()];
  }

  const howContext = {
    id: 'how-context', covers: ['sort'], title: 'Как это работает: одно слово — разные смыслы', free: true, noReset: true,
    simple: {
      icon: '🗂️',
      plain: 'Одно и то же слово в разных отделах означает разное. Бухгалтерии «клиент» — это тот, кто платит. Тренеру — тот, кто пришёл на занятие. Ограниченный контекст — участок системы, внутри которого у каждого слова один смысл и одна модель.',
      analogy: 'В клубе есть бухгалтерия, тренерская и ресепшен. У каждого своя папка на Анну: у бухгалтера — чеки и возвраты, у тренера — посещения и прогулы, у ресепшена — паспортные данные и телефон. Общая у всех только карточка с номером клиента. Если завести одну папку на всех — она распухнет, и каждый будет бояться что-то в ней поменять.',
      tech: '<b>Ограниченный контекст</b> (bounded context, DDD) — граница, внутри которой действует одна модель и <b>единый язык</b>: термины, правила, данные. У контекста одна команда-владелец. Между контекстами общий только идентификатор (<code>clientId</code>), а данные ходят через API и события владельца.'
    },
    lead: ui.brief({
      situation: 'Лена и Антон спорят на доске: «А что такое “клиент”?» Бухгалтерия, тренеры, маркетинг и турникет понимают под ним разное. Посмотрим, как одно слово превращается в разные модели — и что бывает, если сделать одну модель «на всех».',
      todo: [
        'Слово «Клиент»: переключайте контексты в полосе под настройками — смотрите, как меняется название, главный вопрос и поля.',
        'Найдите поля с метками «ссылка», «копия» и «спрашивает». Чьи это данные на самом деле?',
        'Переключите «Одна общая модель на всех». Посчитайте поля и прочитайте, о чём начинают спорить команды.',
        'То же самое — для слова «Занятие».'
      ],
      look: 'Метки полей: <b>свои</b> — контекст сам их создаёт и меняет; <b>ссылка</b> — только номер чужой сущности; <b>копия</b> — приходит событием от владельца; <b>спрашивает</b> — берёт у владельца через API, когда нужно. В режиме «одна модель» красная метка — скольким контекстам нужно это поле: каждый из них будет просить его поменять.'
    }),
    render(el) {
      el.classList.add('abd-root');
      const st = { w: 'client', mode: 'split', c: { client: 'book', cls: 'book' } };
      el.innerHTML = `<div class="stack">
        <div class="abd-box"><div class="abd-set">
          <div class="lbl">Слово</div>${ui.seg('w', [{ v: 'client', t: '«Клиент»' }, { v: 'cls', t: '«Занятие»' }], st.w, 'accent')}
          <div class="lbl">Модель</div>${ui.seg('mode', [{ v: 'split', t: 'Своя в каждом контексте' }, { v: 'one', t: 'Одна общая модель на всех' }], st.mode, 'accent')}
        </div></div>
        <div data-strip></div><div data-card></div><div data-note></div>
      </div>`;
      function draw() {
        const w = WORDS[st.w];
        if (st.mode === 'split') {
          const cur = w.ctxs.find(c => c.id === st.c[st.w]);
          TR.$('[data-strip]', el).innerHTML = `<div class="abd-strip">${w.ctxs.map(c => `<button type="button" data-cx="${c.id}" aria-pressed="${c.id === cur.id}"><span>${esc(c.t)}</span><small>${esc(c.name)} · ${c.fields.length} ${TR.plural(c.fields.length, 'поле', 'поля', 'полей')}</small></button>`).join('')}</div>`;
          TR.$('[data-card]', el).innerHTML = `<div class="abd-word"><h4>«${esc(w.t)}» в контексте «${esc(cur.t)}» — это «${esc(cur.name)}»</h4>
            <div class="q">Кто спрашивает: ${esc(cur.who)}. Главный вопрос: <b>${esc(cur.q)}</b></div>
            <div class="abd-fields">${cur.fields.map(f => `<div class="abd-f"><span class="n">${esc(f.n)}</span><span class="d">${esc(f.t)}</span>${tag(f.k)}</div>`).join('')}</div>
            <div class="abd-legend">${Object.keys(TAGS).map(k => `<span>${tag(k)} ${esc(TAGS[k][1])}</span>`).join('')}</div></div>`;
          const own = cur.fields.filter(f => f.k === 'own').length;
          TR.$('[data-note]', el).innerHTML = ui.note('ok', 'Маленькая модель под свой вопрос', `В «${esc(cur.t)}» у «${esc(w.t.toLowerCase())}а» ${cur.fields.length} ${TR.plural(cur.fields.length, 'поле', 'поля', 'полей')}, из них своих — ${own}. Остальное — ссылка, копия или вопрос к владельцу. Команда «${esc(cur.t)}» меняет свои поля, ни с кем не согласуя, — пока не трогает то, что обещала соседям в API и событиях. Связывает контексты только идентификатор.`);
        } else {
          const all = unionFields(w);
          const teams = w.ctxs.length;
          TR.$('[data-strip]', el).innerHTML = '';
          TR.$('[data-card]', el).innerHTML = `<div class="abd-word" style="border-color:var(--bad);background:var(--bad-soft)"><h4>Одна таблица «${esc(w.t)}» на ${teams} ${TR.plural(teams, 'контекст', 'контекста', 'контекстов')}: ${all.length} ${TR.plural(all.length, 'поле', 'поля', 'полей')}</h4>
            <div class="q">Читают и меняют: ${w.ctxs.map(c => esc(c.t)).join(', ')}.</div>
            <div class="abd-fields">${all.map(f => `<div class="abd-f"><span class="n">${esc(f.n)}</span><span class="who">${esc(f.t)} · нужно: ${esc(f.by.join(', '))}</span>${f.by.length > 1 ? `<span class="abd-tag many">${f.by.length} ${TR.plural(f.by.length, 'контексту', 'контекстам', 'контекстам')}</span>` : '<span class="tg"></span>'}</div>`).join('')}</div></div>`;
          TR.$('[data-note]', el).innerHTML = ui.note('bad', 'О чём начинают спорить', `<ul class="checks">${w.conflicts.map(c => `<li class="bad">${esc(c)}</li>`).join('')}</ul><p class="small">Одна модель на всех называется «большой ком грязи»: её боятся менять, а любое изменение требует согласия всех команд.</p>`);
        }
      }
      ui.onSeg(el, (n, v) => { if (n === 'w' || n === 'mode') { st[n] = v; draw(); } });
      TR.on(el, 'click', '[data-cx]', (e, b) => { st.c[st.w] = b.dataset.cx; draw(); });
      draw();
      el.insertAdjacentHTML('beforeend', `<div style="margin-top:14px">${ui.note('info', 'Что здесь делает аналитик', 'На интервью аналитик первым слышит, что слово значит разное: «клиент» у бухгалтерии и у тренера, «отменить» у управляющего и у клиента. Он ведёт словарь по контекстам (единый язык), а границы контекстов предлагает вместе с архитектором: где меняется смысл слова — там, скорее всего, и граница.')}</div>`);
    }
  };

  // =====================================================================
  // Теория 2. У каждой таблицы один хозяин
  // =====================================================================
  const OWN_MODS = [
    { id: 'clients', t: 'Клиенты', k: 'ядро', tables: ['client', 'consent'] },
    { id: 'memb', t: 'Абонементы', k: 'ядро', tables: ['membership_plan', 'membership', 'membership_freeze'] },
    { id: 'pay', t: 'Платежи', k: 'ядро', tables: ['payment', 'refund'] },
    { id: 'sched', t: 'Расписание', k: 'ядро', tables: ['class_session', 'trainer', 'room'] },
    { id: 'book', t: 'Запись', k: 'ядро', tables: ['booking'] },
    { id: 'notif', t: 'Уведомления', k: 'сервис', tables: [] },
    { id: 'stream', t: 'Онлайн-трансляции', k: 'сервис', tables: [] },
    { id: 'access', t: 'Доступ', k: 'сервис', tables: [] },
    { id: 'onec', t: 'Скрипт выгрузки в 1С', k: 'подрядчик', tables: [] },
    { id: 'site', t: 'Сайт клуба', k: 'подрядчик', tables: [] }
  ];
  const OWN_T = {
    client: {
      owner: 'clients',
      legit: [{ m: 'book', how: 'api', what: '<code>clients.displayName(clientId)</code> — «Анна С.» для списка тренера' }],
      direct: { m: 'notif', sql: 'SELECT [[bad]]phone, full_name[[/]]\n  FROM clients.client\n WHERE id = :clientId', fix: 'api', fixWhat: '<code>GET /internal/clients/{id}/contacts</code> → <code>{"phone": "+7…", "firstName": "Анна"}</code>' },
      change: 'Команда «Клиентов» разделила <code>full_name</code> на <code>last_name</code> и <code>first_name</code> — чтобы писать «Анна, вы записаны», а не «Смирнова Анна Сергеевна, вы записаны».',
      broke: { kind: 'bad', h: 'Уведомления падают: <code>column "full_name" does not exist</code>. SMS с кодом входа не уходят — клиенты не могут войти в приложение, пока дежурный не найдёт причину. Команда «Клиентов» не знала, что Уведомления читают её таблицу.' },
      fixed: 'Владелец поменял таблицу и поправил свой API: поле <code>firstName</code> в ответе осталось тем же. Уведомления ничего не заметили.'
    },
    membership: {
      owner: 'memb',
      legit: [{ m: 'book', how: 'api', what: '<code>memberships.isActive(clientId, clubId)</code> — перед записью на занятие' }, { m: 'access', how: 'event', what: '<code>MembershipFrozen</code>, <code>MembershipActivated</code> → список пропусков турникетов' }],
      direct: { m: 'stream', sql: "SELECT 1 FROM memb.membership\n WHERE client_id = :clientId\n   AND [[bad]]status = 'active'[[/]]", fix: 'api', fixWhat: '<code>GET /internal/clients/{id}/membership-status</code> → <code>{"active": true, "until": "2026-12-31"}</code>' },
      change: 'Команда «Абонементов» отключила ночное задание, которое переводило абонемент в <code>expired</code>: срок теперь проверяют по дате <code>ends_on</code>.',
      broke: { kind: 'warn', h: 'Ошибок нет, тревог нет. Но у истёкших абонементов статус так и остался <code>active</code> — и Трансляции пускают на эфир всех, у кого абонемент давно кончился. Узнают через месяц из жалобы бухгалтерии. <b>Тихая поломка</b> — хуже громкой.' },
      fixed: 'Ответ «действует ли абонемент» по-прежнему считает владелец — теперь по дате. Трансляции получают тот же <code>active: false</code> и ничего не заметили.'
    },
    payment: {
      owner: 'pay',
      legit: [{ m: 'memb', how: 'event', what: '<code>PaymentSucceeded</code> → активировать абонемент (группа <code>memberships</code>)' }],
      direct: { m: 'onec', sql: 'SELECT public_id, amount_kopecks\n  FROM pay.payment\n WHERE [[bad]]paid_at[[/]]::date = current_date - 1', fix: 'event', fixWhat: 'группа <code>onec-export</code> читает <code>PaymentSucceeded</code> из <code>puls.payment.events.v1</code>' },
      change: 'Команда «Платежей» переименовала <code>paid_at</code> в <code>captured_at</code> — теперь это момент списания денег, а не создания платежа.',
      broke: { kind: 'bad', h: 'В 09:15 скрипт падает: <code>column "paid_at" does not exist</code>. Ирина получает пустую выгрузку, 1С закрывает день без оплат. Команда «Платежей» узнаёт о скрипте подрядчика от бухгалтерии.' },
      fixed: 'Поле <code>paidAt</code> в событии осталось — «Платежи» заполняют его из новой колонки. Выгрузка ничего не заметила.'
    },
    class_session: {
      owner: 'sched',
      legit: [{ m: 'book', how: 'api', what: '<code>schedule.reserveSeat(classId)</code> — занять место в той же транзакции, что и запись' }],
      direct: { m: 'site', sql: 'SELECT title, starts_at,\n       [[bad]]capacity - booked_count[[/]] AS free\n  FROM sched.class_session', fix: 'api', fixWhat: 'публичный <code>GET /clubs/{clubId}/classes</code> через CDN — поле <code>freeSpots</code> считает владелец' },
      change: 'Команда «Расписания» разрешила не задавать вместимость у занятия: если <code>capacity</code> пустая — действует вместимость зала.',
      broke: { kind: 'warn', h: 'Ошибок нет: <code>NULL − 12 = NULL</code>, и сайт честно показывает «мест: нет» у половины занятий. Маркетинг неделю гадает, почему с рекламы никто не записывается.' },
      fixed: 'Владелец сам подставляет вместимость зала и отдаёт готовое <code>freeSpots</code>. Сайт ничего не заметил.'
    }
  };
  const ownerOf = tb => OWN_MODS.find(m => m.tables.includes(tb));

  const howOwn = {
    id: 'how-own', covers: ['foreign', 'violations'], title: 'Как это работает: у каждой таблицы один хозяин', free: true, noReset: true,
    simple: {
      icon: '🔑',
      plain: 'У каждой таблицы есть один хозяин — модуль, который её создаёт и меняет. Остальные не лезут в неё сами, а просят у хозяина: вызовом его API или читая его события.',
      analogy: 'Склад клуба: полотенца выдаёт только кладовщик. Если каждый тренер сам ходит на склад и берёт с полок, кладовщик однажды переставит полки — и полтренерской будет искать полотенца не там. А окошко выдачи остаётся на месте, как бы он ни переставлял склад.',
      tech: '<b>Владелец данных</b> — единственный модуль, который пишет в таблицу и отвечает за её смысл. Чужим — только <b>контракт</b>: API (синхронно) или события (асинхронно). Прямое чтение чужой таблицы делает её схему общим контрактом, о котором владелец даже не знает. В модульном монолите правило держат схемы PostgreSQL с правами и тесты зависимостей (ArchUnit).'
    },
    lead: ui.brief({
      situation: 'Соседний пример — таблицы ядра «Пульса» и те, кто их читает: Уведомления, Онлайн-трансляции, скрипт подрядчика для 1С, сайт подрядчика маркетинга. Сейчас часть из них лезет в чужие таблицы напрямую — «так было быстрее».',
      todo: [
        'Нажмите на таблицу <code>client</code>, <code>membership</code>, <code>payment</code> или <code>class_session</code>. Посмотрите, кто хозяин, кто читает правильно и кто лезет напрямую.',
        'В режиме «Как есть» нажмите «Владелец меняет схему». Что сломалось — громко или тихо? Знал ли владелец, что ломает?',
        'Переключите «Как правильно» и повторите. Найдите, что изменилось у читателя.'
      ],
      look: 'Рамки модулей: синяя заливка — хозяин таблицы; зелёная — читает правильно (через API или событие); красный пунктир — лезет в таблицу напрямую; красная заливка — сломался громко (ошибка); жёлтая — сломался тихо (неверные данные без ошибок).'
    }),
    render(el) {
      el.classList.add('abd-root');
      const st = { tb: 'client', mode: 'asis', changed: false };
      el.innerHTML = `<div class="stack">
        <div class="abd-box"><div class="abd-set">
          <div class="lbl">Как читают чужие</div>${ui.seg('mode', [{ v: 'asis', t: 'Как есть: кто-то лезет напрямую' }, { v: 'right', t: 'Как правильно: только API и события' }], st.mode, 'accent')}
        </div>
        <div class="row"><button type="button" class="btn sm primary" data-chg>Владелец меняет схему таблицы</button><button type="button" class="btn sm ghost" data-undo>Откатить</button></div></div>
        <div class="abd-mods" data-mods></div>
        <div data-detail></div>
      </div>`;
      function draw() {
        const own = ownerOf(st.tb), d = OWN_T[st.tb];
        const cls = {};
        cls[own.id] = 'owner';
        if (d) {
          d.legit.forEach(l => { cls[l.m] = 'legit'; });
          if (st.mode === 'right') cls[d.direct.m] = 'legit';
          else cls[d.direct.m] = st.changed ? (d.broke.kind === 'bad' ? 'broken' : 'silent') : 'direct';
        }
        TR.$('[data-mods]', el).innerHTML = OWN_MODS.map(m => {
          let role = '';
          if (m.id === own.id) role = 'хозяин таблицы';
          else if (d && d.legit.find(l => l.m === m.id)) role = d.legit.find(l => l.m === m.id).how === 'api' ? 'читает через API' : 'читает события';
          else if (d && d.direct.m === m.id) role = st.mode === 'right' ? (d.direct.fix === 'api' ? 'читает через API' : 'читает события') : st.changed ? (d.broke.kind === 'bad' ? 'сломался: ошибка' : 'сломался тихо') : 'лезет напрямую (SQL)';
          return `<div class="abd-mod ${cls[m.id] || ''}"><div class="h"><span>${esc(m.t)}</span><small>${esc(m.k)}</small></div>
            ${m.tables.length ? `<div class="tbls">${m.tables.map(t => `<button type="button" class="abd-tb" data-tb="${t}" aria-pressed="${t === st.tb}">${esc(t)}</button>`).join('')}</div>` : ''}
            ${role ? `<div class="role">${esc(role)}</div>` : ''}</div>`;
        }).join('');
        let h = `<div class="card flat"><div class="eyebrow">Таблица <code>${esc(st.tb)}</code> · хозяин — «${esc(own.t)}»</div>`;
        if (!d) {
          h += `<p class="small">Снаружи эту таблицу никто напрямую не читает: соседям «${esc(own.t)}» отдают нужное через свой API и события. Поэтому хозяин может менять её как угодно — проверьте кнопкой.</p>`;
          if (st.changed) h += ui.note('ok', 'Схему поменяли — никто не заметил', 'Таблица — внутреннее дело хозяина. Пока контракт (API, события) тот же, соседям всё равно, как устроены колонки.');
          TR.$('[data-detail]', el).innerHTML = h + '</div>';
          return;
        }
        const reader = OWN_MODS.find(m => m.id === d.direct.m).t;
        h += `<div class="abd-rd">${d.legit.map(l => `<div class="it">${ui.status(l.how === 'api' ? 'API' : 'событие', 'ok')}<div><b>${esc(OWN_MODS.find(m => m.id === l.m).t)}</b>: ${l.what}</div></div>`).join('')}
          ${st.mode === 'right'
            ? `<div class="it">${ui.status(d.direct.fix === 'api' ? 'API' : 'событие', 'ok')}<div><b>${esc(reader)}</b>: ${d.direct.fixWhat}</div></div>`
            : `<div class="it">${ui.status('SQL напрямую', 'bad')}<div><b>${esc(reader)}</b> читает чужую таблицу сам:</div></div>${ui.code(d.direct.sql, 'sql')}`}</div>`;
        if (st.changed) {
          h += `<div class="small" style="margin-top:8px"><b>Изменение:</b> ${d.change}</div>`;
          h += st.mode === 'right'
            ? ui.note('ok', 'Ничего не сломалось', d.fixed + ' Таблицу хозяин меняет как хочет: обещание соседям — это API и события, а не колонки.')
            : ui.note(d.broke.kind, d.broke.kind === 'bad' ? 'Сломалось громко' : 'Сломалось тихо', d.broke.h);
        } else h += `<p class="small dim" style="margin-top:8px">Нажмите «Владелец меняет схему таблицы».</p>`;
        TR.$('[data-detail]', el).innerHTML = h + '</div>';
      }
      ui.onSeg(el, (n, v) => { if (n === 'mode') { st.mode = v; draw(); } });
      TR.on(el, 'click', '[data-tb]', (e, b) => { st.tb = b.dataset.tb; st.changed = false; draw(); });
      TR.on(el, 'click', '[data-chg]', () => { st.changed = true; draw(); });
      TR.on(el, 'click', '[data-undo]', () => { st.changed = false; draw(); });
      draw();
      el.insertAdjacentHTML('beforeend', `<div class="grid2" style="margin-top:14px">
        ${ui.note('', 'Как правило держат в модульном монолите', 'Схема PostgreSQL на модуль (<code>book</code>, <code>pay</code>, <code>memb</code>…) и права: у пользователя модуля нет доступа к чужой схеме. Тесты зависимостей (ArchUnit) падают при сборке, если модуль импортирует чужой внутренний класс. В микросервисах проще: чужая база физически за сетью.')}
        ${ui.note('info', 'Что здесь делает аналитик', 'Пишет постановку не «взять из таблицы <code>booking</code>», а «получить из события <code>BookingCreated</code>» или «спросить API Записи». Модель данных описывает по владельцам: у каждой таблицы указан хозяин. Контракты API и событий согласует с хозяином — это и есть обещание, которое нельзя ломать.')}
      </div>`);
    }
  };

  // =====================================================================
  // Теория 3. Связность и сцепление + карта контекстов
  // =====================================================================
  const PT_CALLS = [
    { t: 'есть ли у тренера допуск к пилатесу', win: false },
    { t: 'свободные окна тренера на 12 октября', win: true },
    { t: 'в каком клубе тренер в это время', win: true },
    { t: 'не в отпуске ли тренер', win: true },
    { t: 'цена часа этого тренера', win: false },
    { t: 'занять окно 19:00–20:00', win: true },
    { t: 'имя и фото тренера для экрана', win: false },
    { t: 'процент тренеру с продажи', win: false }
  ];
  const CUTS = [{ v: 'split', t: 'Как сейчас: «Тренеры» и «Персональные»' }, { v: 'move', t: 'Окна тренера — к «Персональным»' }, { v: 'merge', t: 'Один модуль' }];
  function coupleSim(n, cut, dep) {
    const used = PT_CALLS.slice(0, n);
    const cross = cut === 'merge' ? [] : cut === 'move' ? used.filter(c => !c.win) : used;
    const rev = cut === 'move' && used.some(c => c.win) ? 1 : 0;
    const k = cross.length + rev;
    const lat = dep === 'svc' ? k * 15 : 0;
    const av = dep === 'svc' ? Math.pow(0.999, k) : 1;
    const verdict = k <= 1 ? ['ok', 'Слабое сцепление — граница удачная'] : k <= 3 ? ['warn', 'Терпимо в одном процессе, дорого по сети'] : ['bad', 'Граница проведена не там'];
    return { cross, rev, k, lat, av, verdict };
  }
  const CMAP_N = {
    memb: { t: 'Абонементы', x: 20, y: 30, w: 150, h: 40 },
    pay: { t: 'Платежи', x: 20, y: 150, w: 150, h: 40 },
    psp: { t: 'ПэйПоинт', x: 20, y: 262, w: 150, h: 40, ext: true },
    book: { t: 'Запись', x: 250, y: 120, w: 140, h: 40 },
    bonus: { t: 'Бонусы', x: 480, y: 14, w: 160, h: 36 },
    notif: { t: 'Уведомления', x: 480, y: 70, w: 160, h: 36 },
    an: { t: 'Аналитика', x: 480, y: 126, w: 160, h: 36 },
    pgw: { t: 'Партнёрский шлюз', x: 480, y: 182, w: 160, h: 36 },
    fp: { t: 'ФитПасс', x: 480, y: 266, w: 160, h: 36, ext: true }
  };
  const CMAP = [
    { id: 'pub', t: 'Издатель и подписчики', edges: [['book', 'bonus'], ['book', 'notif'], ['book', 'an'], ['book', 'pgw']], lbl: 'события',
      an: 'Объявление на доске раздевалки: Запись пишет его по шаблону, читает каждый, кому надо. Новый читатель не просит Запись ничего менять.',
      tech: 'Вышестоящий контекст (upstream) публикует события по опубликованному контракту — <b>опубликованный язык</b> (AsyncAPI, реестр схем, совместимость BACKWARD). Нижестоящие (downstream) подстраиваются под контракт, но не под таблицы. Сцепление слабое: Запись не знает своих читателей.',
      who: 'Контракт события, список потребителей, допустимое отставание каждого.' },
    { id: 'cs', t: 'Заказчик и поставщик', edges: [['memb', 'book']], lbl: 'API',
      an: 'Зал и кухня ресторана: зал (Запись) заказывает «скажите, действует ли абонемент в этом клубе», кухня (Абонементы) включает это блюдо в своё меню и держит его.',
      tech: 'Customer–supplier: нижестоящий (Запись) формулирует потребности, вышестоящий (Абонементы) планирует их в своём API. Работает, когда команды договариваются — у «Пульса» это одна команда ядра.',
      who: 'Требования к API хозяина: какие вопросы задаёт Запись, за сколько миллисекунд нужен ответ, что при ошибке.' },
    { id: 'part', t: 'Партнёрство', edges: [['memb', 'pay']], lbl: 'вместе',
      an: 'Касса и стойка продаж: одна смена, одна инструкция. Договариваются голосом, а не письмами.',
      tech: 'Partnership: контексты связаны общими сценариями (покупка = абонемент + платёж), меняются вместе и планируют изменения вместе. Поэтому у «Пульса» они в одном модульном монолите и одной команде — но в разных схемах базы.',
      who: 'Общие сценарии и где проходит граница транзакции.' },
    { id: 'conf', t: 'Конформист', edges: [['psp', 'pay']], lbl: 'как есть',
      an: 'Банк диктует форму платёжки — заполняем как есть, спорить бесполезно.',
      tech: 'Conformist: нижестоящий принимает модель вышестоящего без споров, потому что повлиять не может (<code>Idempotence-Key</code>, статусы и вебхуки ПэйПоинта). Часто добавляют тонкий переводчик, чтобы чужие статусы не расползлись по ядру.',
      who: 'Описывает контракт внешней системы как есть и место, где её статусы переводятся в наши.' },
    { id: 'acl', t: 'Слой защиты от искажений', edges: [['fp', 'pgw']], lbl: 'перевод',
      an: 'Переводчик на ресепшене: гость говорит «мембер-код», переводчик записывает «гостевой визит». Чужие слова не попадают в журнал клуба.',
      tech: 'Anti-corruption layer (ACL): контекст переводит чужую модель в свою на самой границе. Термины и статусы ФитПасса живут только в Партнёрском шлюзе; ядро видит «клиент партнёра» и «гостевой визит». Придёт второй агрегатор — ядро не меняется.',
      who: 'Таблица соответствия «их поле и статус → наше», правило для неизвестных значений.' }
  ];
  function cmapSVG(sel) {
    const W = 660, H = 316, N = CMAP_N;
    const c = (id, side) => { const n = N[id]; return side === 'r' ? [n.x + n.w, n.y + n.h / 2] : side === 'l' ? [n.x, n.y + n.h / 2] : side === 'b' ? [n.x + n.w / 2, n.y + n.h] : [n.x + n.w / 2, n.y]; };
    const geo = (a, b) => {
      if (a === 'book') return [c('book', 'r'), c(b, 'l')];
      if (a === 'memb' && b === 'book') return [c('memb', 'r'), c('book', 'l')];
      if (a === 'memb' && b === 'pay') return [c('memb', 'b'), c('pay', 't')];
      if (a === 'psp') return [c('psp', 't'), c('pay', 'b')];
      if (a === 'fp') return [c('fp', 't'), c('pgw', 'b')];
      return [c(a, 'r'), c(b, 'l')];
    };
    let s = `<svg viewBox="0 0 ${W} ${H}" style="min-width:560px" role="img" aria-label="Карта контекстов «Пульса»">${svgDefs('abd-cm')}`;
    CMAP.forEach(r => {
      const on = r.id === sel, col = on ? 'accent' : 'mute';
      r.edges.forEach((e, i) => {
        const [p, q] = geo(e[0], e[1]);
        s += `<g class="edge" data-rel="${r.id}"><line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" style="stroke:transparent" stroke-width="14"/><line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" style="stroke:${COL[col]}" stroke-width="${on ? 2.8 : 1.6}" marker-end="url(#abd-cm-${col})"/>`;
        if (i === 0) { const vert = Math.abs(p[0] - q[0]) < 4, mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2; s += `<text x="${vert ? mx + 8 : mx}" y="${vert ? my + 4 : my - 8}" text-anchor="${vert ? 'start' : 'middle'}" style="fill:${on ? 'var(--accent)' : 'var(--text-muted)'};font:600 11px var(--f-mono, monospace)">${esc(r.lbl)}</text>`; }
        s += '</g>';
      });
    });
    Object.keys(N).forEach(id => { const n = Object.assign({ id }, N[id]); const inv = CMAP.find(r => r.id === sel).edges.some(e => e.includes(id)); s += svgNode(n, inv ? 'accent' : null); });
    return s + '</svg>';
  }

  const howCouple = {
    id: 'how-couple', covers: ['why-split'], title: 'Как это работает: связность, сцепление и карта контекстов', free: true, noReset: true,
    simple: {
      icon: '🧲',
      plain: 'Хорошая граница режет систему там, где связей мало. Внутри модуля части тесно работают вместе — это связность. Между модулями вопросов друг к другу немного — это слабое сцепление. Если соседи на каждую операцию спрашивают друг друга по пять раз, граница проведена не там.',
      analogy: 'Персональный тренер и его расписание. Если расписание тренера ведёт ресепшен, а продаёт тренировки отдел продаж, то на каждую продажу менеджер звонит на ресепшен пять раз: свободен ли, в каком клубе, не в отпуске ли, займите окно… Перенесите расписание к тем, кто продаёт, — и звонков почти не останется.',
      tech: '<b>Связность</b> (cohesion) — насколько функции и данные внутри модуля служат одной цели. <b>Сцепление</b> (coupling) — сколько модуль знает о соседях и сколько раз их зовёт. Цель — высокая связность и слабое сцепление. В одном процессе лишний вызов почти бесплатен; по сети каждый вызов — задержка, отказ и повод для саги. <b>Карта контекстов</b> (context map) показывает, как контексты связаны и кто под кого подстраивается.'
    },
    lead: ui.brief({
      situation: 'Соседний пример — модули «Тренеры» и «Персональные тренировки». Чтобы продать Анне персональную тренировку, «Персональные» спрашивают у «Тренеров» то одно, то другое. На второй вкладке — карта, как связаны контексты «Пульса».',
      todo: [
        'Вкладка «Связность и сцепление»: двигайте ползунок «вопросов к соседу» от 0 до 8. Сравните «в одном процессе» и «отдельные сервисы».',
        'Поставьте 6 вопросов и переключите границу: «Окна тренера — к “Персональным”», потом «Один модуль». Что стало со стрелками и счётчиками — и какая появилась цена?',
        'Вкладка «Карта контекстов»: нажимайте на связи (или на кнопки) — читайте, кто под кого подстраивается.'
      ],
      look: 'Жёлтые стрелки — вопросы «Персональных» к «Тренерам» на одну продажу. Синяя — обратный вопрос, который появляется после переноса границы. «Задержка» и «доступность» считаются только для отдельных сервисов: 15 мс и 99,9 % на каждый сетевой вызов.'
    }),
    render(el) {
      el.classList.add('abd-root');
      const tabsEl = document.createElement('div'); el.appendChild(tabsEl);
      ui.tabs(tabsEl, [
        { id: 'cc', t: 'Связность и сцепление', render: drawCouple },
        { id: 'map', t: 'Карта контекстов', render: drawMap }
      ], 'cc');
    }
  };
  function drawCouple(pane) {
    const st = { n: 6, cut: 'split', dep: 'mono' };
    pane.innerHTML = `<div class="stack">
      <div class="abd-box">
        <label class="field"><span>Вопросов «Персональных» к «Тренерам» на одну продажу: <b data-o></b></span><input type="range" class="abd-range" min="0" max="8" step="1" value="${st.n}" data-r aria-label="Сколько вызовов между модулями"></label>
        <div class="abd-set">
          <div class="lbl">Где живут</div>${ui.seg('dep', [{ v: 'mono', t: 'В одном процессе (модули)' }, { v: 'svc', t: 'Отдельные сервисы' }], st.dep, 'accent')}
          <div class="lbl">Граница</div>${ui.seg('cut', CUTS, st.cut, 'accent')}
        </div>
      </div>
      <div data-pair></div><div class="abd-stats" data-st></div><div data-n></div>
    </div>`;
    function draw() {
      const r = coupleSim(st.n, st.cut, st.dep);
      TR.$('[data-o]', pane).textContent = st.n;
      const used = PT_CALLS.slice(0, st.n);
      const trainerFns = ['допуски к направлениям', 'ставка и процент', 'профиль и фото'].concat(st.cut === 'move' ? [] : ['окна и отпуска', 'в каком клубе когда']);
      const ptFns = ['продать тренировку', 'оплата и отмена', 'напоминание клиенту'];
      const movedFns = ['окна и отпуска', 'в каком клубе когда'];
      if (st.cut === 'merge') {
        TR.$('[data-pair]', pane).innerHTML = `<div class="abd-pair one"><div class="abd-pm" style="border-color:var(--ok)"><h5>Модуль «Тренеры и персональные тренировки»</h5><ul>${trainerFns.concat(ptFns).map(f => `<li>${esc(f)}</li>`).join('')}</ul><div class="small dim">${used.length ? `${used.length} ${TR.plural(used.length, 'вопрос стал', 'вопроса стали', 'вопросов стали')} вызовами внутри модуля.` : ''}</div></div></div>`;
      } else {
        TR.$('[data-pair]', pane).innerHTML = `<div class="abd-pair">
          <div class="abd-pm"><h5>«Персональные тренировки»</h5><ul>${ptFns.map(f => `<li>${esc(f)}</li>`).join('')}${st.cut === 'move' ? movedFns.map(f => `<li class="mv">${esc(f)} — переехало</li>`).join('') : ''}</ul></div>
          <div class="abd-calls">${r.cross.map(c => `<div class="abd-call">${esc(c.t)}</div>`).join('')}${r.rev ? '<div class="abd-call rev">Расписание групповых: свободен ли тренер в это время</div>' : ''}${!r.k ? '<div class="none">вопросов нет</div>' : ''}</div>
          <div class="abd-pm"><h5>«Тренеры»</h5><ul>${trainerFns.map(f => `<li>${esc(f)}</li>`).join('')}</ul></div></div>`;
      }
      const vk = r.verdict[0];
      TR.$('[data-st]', pane).innerHTML = `
        <div class="stat"><div class="k">вызовов через границу</div><div class="v ${vk}">${r.k}</div><div class="s">на одну продажу</div></div>
        <div class="stat"><div class="k">добавит задержки</div><div class="v ${r.lat > 45 ? 'bad' : r.lat ? 'warn' : 'ok'}">${st.dep === 'svc' ? '+' + r.lat + ' мс' : '≈ 0'}</div><div class="s">${st.dep === 'svc' ? 'по 15 мс на вызов по сети' : 'вызов в памяти'}</div></div>
        <div class="stat"><div class="k">доступность продажи</div><div class="v ${r.av < 0.996 ? 'bad' : r.av < 0.999 ? 'warn' : 'ok'}">${(r.av * 100).toFixed(2).replace('.', ',')} %</div><div class="s">${st.dep === 'svc' ? '≈ ' + Math.round((1 - r.av) * 43200) + ' мин простоя в месяц' : 'один процесс — нет сетевых отказов'}</div></div>
        <div class="stat"><div class="k">новая фича</div><div class="v ${r.k >= 4 ? 'bad' : r.k >= 2 ? 'warn' : 'ok'}">${r.k >= 4 ? 'две команды' : r.k >= 2 ? 'часто две' : 'одна команда'}</div><div class="s">правят оба модуля?</div></div>`;
      let n;
      if (st.cut === 'merge') n = ui.note('ok', 'Сцепления нет — модуль стал крупнее', 'Все вопросы теперь внутри одного модуля: высокая связность. Цена — модуль больше, его меняет одна команда. Это нормально, если у функций один словарь и они меняются вместе. Плохо, если внутри окажутся две несвязанные половины — тогда это снова «ком грязи».');
      else if (st.cut === 'move') n = ui.note(vk === 'bad' ? 'warn' : 'ok', 'Перенесли границу — вопросов меньше', `Окна и отпуска тренера переехали к тем, кто их чаще всех спрашивает. Осталось ${r.cross.length} ${TR.plural(r.cross.length, 'вопрос', 'вопроса', 'вопросов')} туда и ${r.rev ? 'один обратно' : 'ни одного обратно'}. ${r.rev ? 'Честная цена: теперь «Расписание групповых» спрашивает у «Персональных», свободен ли тренер (тренер не может быть в двух местах сразу). Идеальной границы нет — выбирают ту, где вопросов меньше и они реже.' : ''}`);
      else if (vk === 'bad') n = ui.note('bad', r.verdict[1], `На одну продажу — ${r.k} ${TR.plural(r.k, 'вопрос', 'вопроса', 'вопросов')} к соседу. ${st.dep === 'svc' ? `По сети это +${r.lat} мс и ${r.k} ${TR.plural(r.k, 'шанс', 'шанса', 'шансов')} упасть из-за соседа.` : 'В одном процессе это почти бесплатно — но любая новая фича правится в двух модулях двумя командами.'} Признак: модули — одно целое, разрезанное не по шву. Попробуйте перенести границу.`);
      else if (vk === 'warn') n = ui.note('warn', r.verdict[1], `${r.k} ${TR.plural(r.k, 'вопрос', 'вопроса', 'вопроса')} к соседу. ${st.dep === 'svc' ? 'По сети уже заметно: задержка и отказы складываются.' : 'Внутри одного процесса — нормально: вызов API модуля стоит микросекунды.'}`);
      else n = ui.note('ok', r.verdict[1], `${r.k ? 'Один вопрос' : 'Ни одного вопроса'} к соседу. Модули можно даже разнести по разным сервисам — цена сети будет небольшой.`);
      TR.$('[data-n]', pane).innerHTML = n;
    }
    ui.onSeg(pane, (nm, v) => { if (nm === 'cut' || nm === 'dep') { st[nm] = v; draw(); } });
    TR.$('[data-r]', pane).addEventListener('input', e => { st.n = +e.target.value; draw(); });
    draw();
  }
  function drawMap(pane) {
    let sel = 'pub';
    pane.innerHTML = `<div class="stack">
      <div class="row">${CMAP.map(r => `<button type="button" class="btn xs" data-rl="${r.id}">${esc(r.t)}</button>`).join('')}</div>
      <div class="abd-cm"><div class="abd-board" data-svg></div><div data-out></div></div>
      ${ui.note('', 'Зачем карта аналитику', 'По стрелкам видно, кто под кого подстраивается. Если Запись меняет событие — затронуты четыре подписчика. Если ПэйПоинт меняет API — переделывать нам, мы конформисты. Карта отвечает на вопрос «кого позвать на согласование» до того, как что-то сломалось.')}
    </div>`;
    function draw() {
      TR.$('[data-svg]', pane).innerHTML = cmapSVG(sel);
      TR.$$('[data-rl]', pane).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rl === sel)));
      const r = CMAP.find(x => x.id === sel);
      TR.$('[data-out]', pane).innerHTML = `<div class="card flat stack tight"><div class="eyebrow">${esc(r.t)}</div><p class="small"><b>Аналогия.</b> ${r.an}</p><p class="small">${r.tech}</p>${ui.note('info', 'Что пишет аналитик', r.who)}</div>`;
    }
    TR.on(pane, 'click', '[data-rl]', (e, b) => { sel = b.dataset.rl; draw(); });
    TR.on(pane, 'click', '[data-rel]', (e, g) => { sel = g.dataset.rel; draw(); });
    draw();
  }

  // =====================================================================
  // Практика 1. Разложить «Пульс» по контекстам
  // =====================================================================
  const CTX = [
    { id: 'clients', t: 'Клиенты', sub: 'ядро' },
    { id: 'memb', t: 'Абонементы', sub: 'ядро' },
    { id: 'sched', t: 'Расписание', sub: 'ядро' },
    { id: 'book', t: 'Запись', sub: 'ядро' },
    { id: 'pay', t: 'Платежи', sub: 'ядро' },
    { id: 'access', t: 'Доступ', sub: 'сервис' },
    { id: 'partners', t: 'Партнёры', sub: 'сервис «Партнёрский шлюз»' },
    { id: 'notif', t: 'Уведомления', sub: 'сервис' },
    { id: 'bonus', t: 'Бонусы', sub: 'сервис' },
    { id: 'an', t: 'Аналитика', sub: 'сервис, ClickHouse' }
  ];
  const ITEMS = [
    { id: 'i-client', t: '<code>client</code>: ФИО, телефон, согласия', ok: 'clients', crit: true, hint: 'Персональные данные человека. Кто отвечает на вопрос «кто это и как с ним связаться»?', why: 'Персональные данные и согласия — у Клиентов.' },
    { id: 'i-del', t: 'Удалить персональные данные по просьбе клиента, а платежи хранить 5 лет', ok: 'clients', alt: { pay: 'Платежи хранят свои записи 5 лет, но решение «обезличить человека» принимает хозяин персональных данных. Платежи при этом получают событие и ничего не стирают.' }, hint: 'Чьи данные удаляем? И кто хозяин этих данных?', why: 'Хозяин ПДн — Клиенты: обезличивают у себя и сообщают событием. Платежи хранят обезличенные платежи.' },
    { id: 'i-plan', t: '<code>membership_plan</code>: прайс видов абонементов', ok: 'memb', hint: 'Это то, что продаём, или то, чем платят?', why: 'Прайс — у Абонементов. Цена покупки сохраняется в самом абонементе.' },
    { id: 'i-freeze', t: '<code>membership_freeze</code>: заморозка до 30 дней в год', ok: 'memb', hint: 'Заморозка сдвигает срок чего?', why: 'Заморозка — правило абонемента: Абонементы.' },
    { id: 'i-session', t: '<code>class_session</code>: занятие в сетке — зал, тренер, время', ok: 'sched', crit: true, hint: 'Кто ставит занятие в сетку, ещё до того, как кто-то записался?', why: 'Сетка занятий — Расписание. Запись только ссылается на занятие.' },
    { id: 'i-trainer', t: '<code>trainer</code> и допуски тренеров к направлениям', ok: 'sched', hint: 'Кому нужно знать допуски, чтобы поставить тренера на занятие?', why: 'Тренеры и допуски — в контексте Расписания.' },
    { id: 'i-wait', t: 'Лист ожидания: место освободилось — первый в очереди записан автоматически', ok: 'book', crit: true, hint: 'Лист ожидания — это про сетку занятий или про то, кто записан на занятие?', why: 'Лист ожидания — статус записи: контекст Записи.' },
    { id: 'i-noshow', t: '2 прогула за 30 дней — запись блокируется на 7 дней', ok: 'book', alt: { clients: 'Блокировку покажут в профиле клиента, но правило «прогулы → блокировка записи» — правило Записи. Клиенты только отображают.' }, hint: 'Чьё это правило: кто решает, можно ли записаться?', why: 'Прогулы и блокировка — правило Записи.' },
    { id: 'i-refund', t: '<code>refund</code>: возврат денег за неиспользованные дни', ok: 'pay', alt: { memb: 'Сумму к возврату считают Абонементы (дни минус 10 %), но сам возврат, его статус у ПэйПоинта и выгрузка в 1С — Платежи.' }, hint: 'Таблица про деньги и ПэйПоинт или про срок абонемента?', why: 'Таблица возвратов — Платежи. Сумму к возврату считают Абонементы и передают её Платежам.' },
    { id: 'i-hook', t: '<code>inbound_event</code>: вебхуки ПэйПоинта — дубли и не по порядку', ok: 'pay', hint: 'Кто разговаривает с платёжным сервисом?', why: 'Входящие вебхуки ПэйПоинта и их дедупликация — Платежи.' },
    { id: 'i-visit', t: '<code>visit</code>: проход через турникет', ok: 'access', crit: true, hint: 'Кто стоит рядом с турникетами и работает даже без интернета?', why: 'Посещения — у Доступа, он рядом с контроллерами.' },
    { id: 'i-allow', t: 'Офлайн-список пропусков на контроллере клуба', ok: 'access', alt: { memb: 'Источник списка — события Абонементов (сжатый топик), но держит список у контроллеров и отвечает за него Доступ.' }, hint: 'Кому нужен этот список, когда пропал интернет?', why: 'Список держит Доступ; данные для него публикуют Абонементы.' },
    { id: 'i-recon', t: 'Ежемесячная сверка визитов с ФитПассом', ok: 'partners', alt: { an: 'Аналитика тоже считает визиты, но сверка — договор с конкретным партнёром: его формат, его расхождения. Это Партнёры.' }, hint: 'Это отчёт для директора или договорённость с внешним агрегатором?', why: 'Сверка с агрегатором — контекст Партнёров.' },
    { id: 'i-quiet', t: 'Тихие часы: не присылать пуши с 23:00 до 8:00', ok: 'notif', alt: { clients: 'Согласие на рассылку — у Клиентов, а как и когда слать — настройка Уведомлений.' }, hint: 'Кто решает, когда отправлять пуш?', why: 'Настройки доставки — Уведомления.' },
    { id: 'i-ref', t: 'Начислить +500 бонусов за приведённого друга', ok: 'bonus', alt: { clients: 'Кто кого привёл, хранят Клиенты (<code>referred_by_id</code>). Но начисление — операция бонусного счёта.' }, hint: 'Это данные о человеке или операция со счётом бонусов?', why: 'Начисление — Бонусы; «кто привёл» они узнают из данных Клиентов.' },
    { id: 'i-rev', t: 'Выручка по клубам за месяц для директора', ok: 'an', alt: { pay: 'Платежи — источник данных, но отчёт собирают в модели чтения Аналитики (ClickHouse), чтобы тяжёлые запросы не мешали ядру.' }, hint: 'Где строят тяжёлые отчёты, чтобы не мешать записи?', why: 'Отчёты — модель чтения Аналитики из событий.' },
    { id: 'i-recs', t: '«Вам подойдёт»: пересчёт рекомендаций раз в сутки', ok: 'an', hint: 'Кто считает по истории посещений всех клиентов?', why: 'Рекомендации — Аналитика.' }
  ];
  function sortEval(v) {
    v = v || {};
    return ITEMS.map(it => {
      const got = v[it.id];
      if (got === it.ok) return { it, s: 'ok', pts: 1 };
      if (it.alt && it.alt[got]) return { it, s: 'warn', pts: 0.5 };
      return { it, s: 'bad', pts: 0, empty: !got };
    });
  }
  const sortTask = {
    id: 'sort', title: 'Разложить «Пульс» по контекстам',
    simple: howContext.simple,
    lead: ui.brief({
      situation: 'Антон рисует на доске десять контекстов «Пульса» — пять внутри ядра и пять отдельных сервисов. Лена принесла стопку карточек: таблицы и правила из постановок. Надо решить, кто хозяин каждой. Пока у карточки нет хозяина, её меняют все — и никто за неё не отвечает.',
      todo: [
        'Разложите 17 карточек по 10 контекстам: нажмите карточку, потом контекст (на компьютере можно перетаскивать).',
        'Для каждой спросите: чьё это правило? кто отвечает на вопрос, ради которого эти данные существуют?',
        'Нажмите «Проверить». Засчитывается от 80 %. На некоторых карточках есть второй допустимый ответ — он даёт половину балла и пояснение, почему первый точнее.'
      ],
      lookTitle: 'Подсказка',
      look: 'Хозяин — не тот, кто данные читает, а тот, кто их создаёт и отвечает за их смысл. Отчёт о выручке читает директор, а платежи создают Платежи — но строит отчёт Аналитика.'
    }),
    blank: () => ({ v: {} }),
    reference: () => ({ v: Object.fromEntries(ITEMS.map(i => [i.id, i.ok])) }),
    render(el, ctx) {
      el.classList.add('abd-root');
      let reveal = null;
      if (ctx.result) { reveal = {}; sortEval(ctx.ans.v).forEach(x => { if ((ctx.ans.v || {})[x.it.id]) reveal[x.it.id] = x.s; }); }
      const box = document.createElement('div'); el.appendChild(box);
      ui.sort(box, {
        items: ITEMS.map(i => ({ id: i.id, t: i.t })), buckets: CTX, value: ctx.ans.v || {}, reveal, readonly: ctx.readonly, seed: 'abd-sort',
        onChange: v => { ctx.ans.v = v; ctx.save(); }
      });
      if (ctx.readonly) {
        const d = document.createElement('div'); d.style.marginTop = '12px';
        d.innerHTML = ui.table(['Карточка', 'Контекст', 'Почему'], ITEMS.map(i => [i.t, esc(CTX.find(c => c.id === i.ok).t), i.why + (i.alt ? `<div class="small dim">Допустимо: ${Object.keys(i.alt).map(k => esc(CTX.find(c => c.id === k).t)).join(', ')} — половина балла.</div>` : '')]));
        el.appendChild(d);
      }
    },
    check(ans) {
      const ev = sortEval(ans && ans.v), pts = ev.reduce((s, x) => s + x.pts, 0), score = pts / ITEMS.length;
      const critBad = ev.filter(x => x.it.crit && x.s !== 'ok');
      const notes = [];
      ev.forEach(x => {
        if (x.s === 'ok') return;
        const name = plainT(x.it.t);
        if (x.s === 'warn') notes.push({ ok: 'warn', html: `«${esc(name)}» — ${x.it.alt[(ans.v || {})[x.it.id]]}` });
        else notes.push({ ok: false, html: `«${esc(name)}» — ${x.empty ? 'не разложено. ' : ''}${x.it.hint}` });
      });
      if (!notes.length) notes.push({ ok: true, html: 'Все 17 карточек — у своих хозяев.' });
      return {
        ok: score >= 0.8 && !critBad.length, score, notes,
        summary: `Точно: ${ev.filter(x => x.s === 'ok').length} из ${ITEMS.length}, допустимо: ${ev.filter(x => x.s === 'warn').length}.`,
        vera: critBad.length ? 'Начните с опорных: человек (<code>client</code>), сетка занятий (<code>class_session</code>), лист ожидания, проход через турникет. Если они легли неверно, границы поплывут у всех остальных.' : null
      };
    },
    explain: `<p>Главный вопрос раскладки — <b>кто отвечает за смысл данных</b>, а не кто их читает. Директор читает выручку, но её хозяин — модель чтения Аналитики; тренер видит прогулы, но правило блокировки — у Записи.</p>
      <ul class="checks">
        <li>Пограничные карточки — норма: «возврат» живёт на стыке Абонементов (сколько вернуть) и Платежей (вернуть деньги). Решение: разделить ответственность и связать их API или событием, а не дать обоим писать в одну таблицу.</li>
        <li>Пять контекстов ядра всё равно разные, хотя живут в одном процессе: у каждого своя схема PostgreSQL и свой API.</li>
        <li>Таблица из этой раскладки — основа раздела «Модель данных» в постановке: у каждой таблицы указан хозяин, а у каждого читателя — способ (API или событие).</li>
      </ul>`,
    report: ans => sortEval(ans && ans.v).map(x => `- ${plainT(x.it.t)} → ${(CTX.find(c => c.id === (ans.v || {})[x.it.id]) || { t: '—' }).t} ${x.s === 'ok' ? '✓' : x.s === 'warn' ? '≈' : '✗'}`).join('\n')
  };

  // =====================================================================
  // Практика 2. Лаборатория «чужая таблица»
  // =====================================================================
  const HOWS = [
    { v: 'sql', t: 'Читать таблицу <code>booking</code> напрямую (как сейчас)' },
    { v: 'api', t: 'Спрашивать API Записи' },
    { v: 'event', t: 'Читать события Записи из Kafka' }
  ];
  const LSC = [
    { v: 'rename', t: 'Лена переименовывает колонку', k: '<code>class_session_id</code> → <code>session_id</code>' },
    { v: 'down', t: 'Ядро недоступно 10 минут', k: 'авария в 18:00' },
    { v: 'peak', t: 'Воскресенье 20:00', k: '400 записей в секунду' }
  ];
  const HOW_CODE = {
    sql: { lang: 'sql', cap: 'Бонусы, раз в 5 минут, по логину к реплике базы ядра', src: "SELECT client_id, [[bad]]class_session_id[[/]], updated_at\n  FROM book.booking\n WHERE status = 'attended'\n   AND updated_at > :last_run" },
    api: { lang: 'http', cap: 'Бонусы, раз в 5 минут, через API хозяина', src: 'GET /internal/bookings?status=attended&since=2026-10-05T17:55:00%2B03:00&limit=500 HTTP/1.1\nHost: core.puls.internal\n\n[[ok]]→ 200 {"items":[{"bookingId":"9e2d…","classId":"4b1f…","clientId":"c-77…"}],"next":"…"}[[/]]' },
    event: { lang: 'json', cap: 'Бонусы, группа bonus, топик puls.booking.events.v1', src: '{\n  "eventId": "0c9d…",\n  "type": "BookingAttended",\n  "version": 1,\n  "producer": "booking",\n  "data": {\n    "bookingId": "9e2d…",\n    [[ok]]"classId": "4b1f…"[[/]],\n    "clientId": "c-77…",\n    "status": "attended"\n  }\n}' }
  };
  const LAB = {
    'sql|rename': { bonus: ['bad', '5,5 часа без начислений'], lena: ['bad', 'не знала, что ломает'], core: ['ok', 'без изменений'], know: 'Бонусы знают внутренние колонки Записи',
      tl: [['14:00', 'Лена выкатывает миграцию: <code>class_session_id</code> → <code>session_id</code>. Тесты Записи зелёные: свой код она поправила.', 'ok'], ['14:05', 'Задание Бонусов: <code>ERROR: column "class_session_id" does not exist</code>. Через 5 минут — снова.', 'bad'], ['14:05–19:30', 'Бонусы не начисляются. Поддержка: «Пришла на йогу — бонусов нет».', 'bad'], ['19:30', 'Команда Бонусов находит причину и правит запрос. Лена впервые слышит, что у её таблицы был ещё читатель.', 'warn']],
      note: ['bad', 'Чужая схема стала контрактом, о котором хозяин не знал', 'Лена не нарушила никаких договорённостей — их просто не было. Колонку читал чужой код, и любое внутреннее изменение Записи теперь может уронить Бонусы. Хуже: после такого случая команды начинают бояться менять свои таблицы вообще.'] },
    'api|rename': { bonus: ['ok', 'начисляются как раньше'], lena: ['ok', 'поправила свой API'], core: ['ok', 'без изменений'], know: 'Бонусы знают только контракт API',
      tl: [['14:00', 'Лена выкатывает миграцию и в том же релизе правит свой API: поле <code>classId</code> в ответе теперь берётся из новой колонки.', 'ok'], ['14:05', 'Бонусы спрашивают API — ответ такой же, как вчера.', 'ok']],
      note: ['ok', 'Контракт устоял', 'API — обещание хозяина. Колонки — его внутреннее дело: он меняет их и сам переводит в прежний ответ.'] },
    'event|rename': { bonus: ['ok', 'начисляются как раньше'], lena: ['ok', 'то же поле в событии'], core: ['ok', 'без изменений'], know: 'Запись не знает о Бонусах',
      tl: [['14:00', 'Лена выкатывает миграцию. Код Записи кладёт в outbox событие с тем же полем <code>classId</code>.', 'ok'], ['14:00:01', 'Бонусы читают события как раньше и начисляют +10.', 'ok']],
      note: ['ok', 'Контракт устоял', 'Событие — опубликованный контракт: его схема в реестре и проверяется на совместимость. Внутри Записи можно переименовывать что угодно.'] },
    'sql|down': { bonus: ['ok', 'работают'], lena: ['ok', '—'], core: ['ok', 'реплика жива'], know: 'Бонусы знают внутренние колонки Записи',
      tl: [['18:00', 'Ядро недоступно. Реплика базы жива — запрос Бонусов проходит.', 'ok'], ['18:10', 'Ядро поднялось. Новых отметок за эти 10 минут не было: тренеры не могли их поставить.', 'ok']],
      note: ['warn', 'Единственный плюс прямого чтения', 'Бонусы не зависят от того, работает ли код Записи. Но этот плюс даёт и событие — без чужих колонок.'] },
    'api|down': { bonus: ['warn', 'опоздали на 10 минут'], lena: ['ok', '—'], core: ['warn', 'Бонусы ждут ядро'], know: 'Бонусы знают только контракт API',
      tl: [['18:00', 'Ядро недоступно. Задание Бонусов: таймаут, повтор через 5 минут — снова таймаут.', 'warn'], ['18:10', 'Ядро поднялось. Бонусы запрашивают всё с отметки <code>since</code> и догоняют.', 'ok']],
      note: ['warn', 'Синхронная зависимость', 'API связывает Бонусы с ядром во времени: ядро лежит — Бонусы ждут. Здесь это терпимо, потому что Бонусы спрашивают «всё с отметки <code>since</code>». Без отметки — потеряли бы начисления.'] },
    'event|down': { bonus: ['ok', 'работают'], lena: ['ok', '—'], core: ['ok', 'Бонусы не ждут ядро'], know: 'Запись не знает о Бонусах',
      tl: [['18:00', 'Ядро недоступно — новых событий нет. Всё, что успело попасть в Kafka, Бонусы прочитали.', 'ok'], ['18:10', 'Ядро поднялось, outbox дослал неотправленное. Бонусы дочитали со своей закладки.', 'ok']],
      note: ['ok', 'Развязаны во времени', 'Kafka хранит события 7 дней. Бонусам всё равно, работает ли ядро прямо сейчас.'] },
    'sql|peak': { bonus: ['ok', 'работают'], lena: ['bad', 'расписание тормозит'], core: ['bad', 'реплику грузят Бонусы'], know: 'Бонусы знают внутренние колонки Записи',
      tl: [['20:00', 'Пик: 400 записей в секунду, расписание читают с реплик.', 'warn'], ['20:05', 'Запрос Бонусов идёт без индекса по <code>updated_at</code> — 4 секунды держит диск той же реплики.', 'bad'], ['20:05–20:20', 'Расписание у клиентов грузится по 2–3 секунды. Бонусы мешают записи, хотя к ней не относятся.', 'bad']],
      note: ['bad', 'Чужой запрос в твоей базе', 'Хозяин не знает о чужом запросе — значит, не может построить под него индекс и не учитывает его в нагрузке. В пик он отнимает ресурсы у главного сценария.'] },
    'api|peak': { bonus: ['ok', 'работают'], lena: ['warn', 'API ядра грузится'], core: ['warn', '+ выгрузка каждые 5 минут'], know: 'Бонусы знают только контракт API',
      tl: [['20:00', 'Пик: 400 записей в секунду.', 'warn'], ['20:05', 'Бонусы забирают через API тысячи отметок постранично. Ядро тратит потоки на Бонусы в самый пик.', 'warn']],
      note: ['warn', 'Терпимо, но ядро работает на Бонусы', 'Хозяин хотя бы знает о нагрузке и может её ограничить (лимит, страницы, окно). Но опрос — лишняя работа ядра ровно тогда, когда ему тяжелее всего.'] },
    'event|peak': { bonus: ['ok', 'отставание — секунды'], lena: ['ok', 'ничего лишнего'], core: ['ok', 'только публикует'], know: 'Запись не знает о Бонусах',
      tl: [['20:00', 'Пик: 400 записей в секунду. Запись публикует события — их и так читают шестеро.', 'ok'], ['20:00–20:05', 'Бонусы читают со своей скоростью, отставание — секунды. Ядро ничего не делает сверх обычного.', 'ok']],
      note: ['ok', 'Нагрузка не передаётся', 'Потребитель сам выбирает темп. Ядру всё равно, сколько у события читателей.'] }
  };
  const LAB_Q = {
    q: 'Почему переименование колонки сломало Бонусы при прямом чтении, но не при API и событии?', seed: 'abd-lab-q',
    options: [
      { t: 'API и событие — контракт, который хозяин обещает держать. Свои таблицы он меняет как хочет и сам переводит их в прежний контракт', ok: 1, why: 'Верно. Граница модуля — это контракт. Всё, что за ним, — внутреннее дело хозяина.' },
      { t: 'API и Kafka быстрее, чем SQL-запрос к реплике', why: 'Скорость здесь ни при чём: запрос упал не от медленности, а потому что колонки больше нет.' },
      { t: 'При API и событии Лена заранее предупредила команду Бонусов', why: 'Предупреждать не понадобилось: контракт не менялся. А при прямом чтении Лена и не знала, кого предупреждать.' },
      { t: 'Реплика базы отстаёт от мастера, поэтому новой колонки там ещё не было', why: 'Отставание реплики — доли секунды. Дело не во времени: старой колонки нет и больше не будет.' }
    ]
  };
  const sigL = (h, s) => h + '|' + s;
  const labTask = {
    id: 'foreign', title: 'Лаборатория: чужая таблица',
    simple: howOwn.simple,
    lead: ui.brief({
      situation: 'Бонусы — отдельный сервис новой команды. Правило: +10 бонусов, когда тренер отметил клиента пришедшим на занятие. В прототипе Бонусам «на время» дали логин к реплике базы ядра, и раз в 5 минут они читают таблицу <code>booking</code> Лены напрямую. Лена готовит онлайн-тренировки: запись теперь бывает и на занятие в зале, и на эфир, — и она переименовывает колонку <code>class_session_id</code> в <code>session_id</code>.',
      todo: [
        'Выберите в блоке «Как Бонусы узнают об отметках» один из трёх способов. Ниже появится, как именно они это делают.',
        'Нажмите по очереди все три ситуации: «Лена переименовывает колонку», «Ядро недоступно 10 минут», «Воскресенье 20:00». Читайте хронику и четыре счётчика.',
        'Прогоните все три ситуации для каждого способа и выберите тот, который запишете в требования. Засчитывается способ, при котором все три ситуации прогнаны.',
        'Ответьте на вопрос внизу и нажмите «Проверить».'
      ],
      look: 'Хроника — что происходит по минутам. Счётчики: «Бонусы» — начисляются ли бонусы; «Лене пришлось» — что пришлось делать хозяйке таблицы; «Ядро» — чувствует ли ядро чужую нагрузку; «Кто о ком знает» — чья схема стала чужим контрактом. Таблица 3 × 3 внизу копит ваши прогоны.'
    }),
    blank: () => ({ how: 'sql', sc: 'rename', seen: [], q: [] }),
    reference: () => ({ how: 'event', sc: 'rename', seen: ['sql|rename'].concat(LSC.map(s => sigL('event', s.v))), q: quizRef([LAB_Q]) }),
    render(el, ctx) {
      el.classList.add('abd-root');
      const a = ctx.ans; a.seen = a.seen || []; a.q = a.q || [];
      const mark = () => { const k = sigL(a.how, a.sc); if (!ctx.readonly && !a.seen.includes(k)) { a.seen.push(k); ctx.save(); } };
      mark();
      el.innerHTML = `<div class="stack">
        <div class="abd-box"><div class="eyebrow">Как Бонусы узнают об отметках</div>${ui.seg('how', HOWS, a.how, 'accent')}<div data-code></div></div>
        <div class="stack tight"><div class="eyebrow">Ситуация</div>${ui.seg('sc', LSC.map(s => ({ v: s.v, t: `${s.t} · ${s.k}` })), a.sc)}</div>
        <div class="abd-stats" data-st></div>
        <div class="abd-time" data-tl></div>
        <div data-n></div>
        <div class="stack tight"><div class="eyebrow">Ваши прогоны: способ × ситуация</div><div class="abd-mx" data-mx></div></div>
        <div class="card flat" data-q></div>
      </div>`;
      function draw() {
        const r = LAB[sigL(a.how, a.sc)], c = HOW_CODE[a.how];
        TR.$('[data-code]', el).innerHTML = ui.code(c.src, c.lang, c.cap);
        TR.$('[data-st]', el).innerHTML = `
          <div class="stat"><div class="k">Бонусы</div><div class="v ${r.bonus[0]}">${esc(r.bonus[1])}</div><div class="s">+10 за посещение</div></div>
          <div class="stat"><div class="k">Лене пришлось</div><div class="v ${r.lena[0]}">${esc(r.lena[1])}</div><div class="s">хозяйке таблицы</div></div>
          <div class="stat"><div class="k">Ядро</div><div class="v ${r.core[0]}">${esc(r.core[1])}</div><div class="s">чужая нагрузка и зависимость</div></div>
          <div class="stat"><div class="k">Кто о ком знает</div><div class="v ${a.how === 'sql' ? 'bad' : a.how === 'api' ? 'warn' : 'ok'}" style="font-size:13.5px">${esc(r.know)}</div><div class="s">${a.how === 'sql' ? 'схема таблицы — чужой контракт' : a.how === 'api' ? 'зависимость во времени' : 'слабое сцепление'}</div></div>`;
        TR.$('[data-tl]', el).innerHTML = r.tl.map(t => `<div class="t ${t[2]}"><b class="tm">${t[0]}</b><span>${t[1]}</span></div>`).join('');
        TR.$('[data-n]', el).innerHTML = ui.note(r.note[0], r.note[1], r.note[2]);
        TR.$('[data-mx]', el).innerHTML = HOWS.map(h => `<div class="stat ${h.v === a.how ? 'cur' : ''}"><div class="k">${h.t}</div>${LSC.map(s => { const seen = a.seen.includes(sigL(h.v, s.v)), x = LAB[sigL(h.v, s.v)]; const bad = [x.bonus[0], x.lena[0], x.core[0]].includes('bad'), warn = [x.bonus[0], x.lena[0], x.core[0]].includes('warn'); return `<div class="small">${esc(s.t)}: ${seen ? ui.status(bad ? 'плохо' : warn ? 'терпимо' : 'хорошо', bad ? 'bad' : warn ? 'warn' : 'ok') : '<span class="dim">не прогнано</span>'}</div>`; }).join('')}</div>`).join('');
      }
      draw();
      ui.quiz(TR.$('[data-q]', el), Object.assign({}, LAB_Q, { value: a.q[0] || [], readonly: ctx.readonly, reveal: ctx.result, onChange: v => { a.q = [v]; ctx.save(); } }));
      ui.onSeg(el, (name, v) => {
        if (name !== 'how' && name !== 'sc') return;
        a[name] = v; mark();
        if (!ctx.readonly) { ctx.save(); if (name === 'how') ctx.decide('Как Бонусы узнают об отметках Записи', tOf(HOWS, v)); }
        draw();
      });
    },
    check(ans) {
      const seen = ans.seen || [], how = ans.how;
      const seenAll = LSC.every(s => seen.includes(sigL(how, s.v)));
      const sawBreak = seen.includes('sql|rename');
      const q = ui.quizScore(LAB_Q, (ans.q || [])[0] || []);
      const notes = [];
      if (!sawBreak) notes.push({ ok: 'warn', html: 'Вы ещё не видели, как ломается прямое чтение: выберите «Читать таблицу напрямую» и ситуацию «Лена переименовывает колонку».' });
      LSC.forEach(s => { if (!seen.includes(sigL(how, s.v))) notes.push({ ok: 'warn', html: `Ситуация «${esc(s.t)}» для выбранного способа ещё не прогнана.` }); });
      let m = 0;
      if (how === 'event') { m = 1; notes.push({ ok: true, html: 'Способ: события хозяина. Переименование не задело Бонусы, авария ядра — тоже, нагрузка в пик не передаётся.' }); }
      else if (how === 'api') { m = 0.8; notes.push({ ok: 'warn', html: 'API хозяина спасает от переименования — это главное. Но Бонусы зависят от ядра во времени и нагружают его опросом в пик. По ADR-007 Бонусы общаются с ядром только событиями: они не ждут ответа, им нужен факт.' }); }
      else notes.push({ ok: false, html: 'Прямое чтение оставляет схему таблицы Лены чужим контрактом, о котором она не знает. Какой способ сделал бы обещание хозяина явным?' });
      notes.push(q.ok ? { ok: true, html: 'Вопрос: верно — граница держится на контракте.' } : { ok: false, html: 'Вопрос внизу: подумайте, что именно обещает хозяин соседям — колонки или ответ API и поля события.' });
      const score = m * 0.55 + (seenAll ? 0.15 : 0) + (sawBreak ? 0.05 : 0) + q.score * 0.25;
      return {
        ok: how !== 'sql' && seenAll && q.ok && score >= 0.8, score, notes,
        summary: `Способ: ${esc(tOf(HOWS, how))}. Ситуаций прогнано для него: ${LSC.filter(s => seen.includes(sigL(how, s.v))).length} из 3.`,
        vera: how === 'sql' ? 'Прогоните переименование для всех трёх способов и посмотрите, у кого Лене пришлось хоть что-то согласовывать.' : null
      };
    },
    explain: `<p>Эталон — <b>события хозяина</b>: Запись публикует факт «клиента отметили пришедшим» в <code>puls.booking.events.v1</code>, Бонусы читают его своей группой. Так и записано в ADR-007: Бонусы общаются с ядром только событиями.</p>
      <ul class="checks">
        <li><b>Прямое чтение</b> — схема таблицы становится контрактом, о котором хозяин не знает: переименование роняет соседа, чужой запрос грузит реплику в пик, а хозяин боится менять собственную таблицу.</li>
        <li><b>API хозяина</b> — контракт явный, переименование не страшно. Цена — зависимость во времени и опрос ядра в пик. Хороший выбор, когда ответ нужен сейчас (проверить абонемент перед записью).</li>
        <li><b>Событие</b> — контракт явный и развязка во времени. Цена — согласованность в конечном счёте: бонусы появятся через секунды, а не мгновенно.</li>
      </ul>
      <p>Логин «на время» к чужой базе — частая история. Аналитик ловит её на постановке: если в требованиях написано «взять из таблицы <code>booking</code>», это не требование, а дыра в границе.</p>`,
    report: ans => `Способ: ${tOf(HOWS, ans.how)}.\nПрогнано: ${(ans.seen || []).join(', ') || '—'}.\nВопрос: ${ui.quizScore(LAB_Q, (ans.q || [])[0] || []).ok ? 'верно' : 'неверно'}.`
  };

  // =====================================================================
  // Практика 3. Найти нарушения границ на схеме
  // =====================================================================
  const VN = {
    memb: { t: 'Абонементы', x: 34, y: 66, w: 160, h: 44, core: true },
    book: { t: 'Запись', x: 234, y: 66, w: 160, h: 44, core: true },
    clients: { t: 'Клиенты', x: 34, y: 176, w: 160, h: 44, core: true },
    sched: { t: 'Расписание', x: 234, y: 176, w: 160, h: 44, core: true },
    pg: { t: 'PostgreSQL ядра\nмастер и реплики', x: 196, y: 318, w: 200, h: 48, db: true },
    kafka: { t: 'Kafka', x: 470, y: 160, w: 110, h: 46 },
    bonus: { t: 'Бонусы', x: 470, y: 30, w: 130, h: 44 },
    bdb: { t: 'БД Бонусов', x: 650, y: 30, w: 130, h: 44, db: true },
    pgw: { t: 'Партнёрский шлюз', x: 620, y: 160, w: 160, h: 46 },
    an: { t: 'Аналитика', x: 470, y: 392, w: 140, h: 44 },
    ch: { t: 'ClickHouse', x: 660, y: 392, w: 120, h: 44, db: true },
    notif: { t: 'Уведомления', x: 20, y: 318, w: 150, h: 48 }
  };
  const ARROWS = [
    { id: 'a1', n: 1, from: 'book', to: 'memb', pts: [[234, 88], [194, 88]], b: [214, 76], t: 'Запись → Абонементы', what: 'вызывает <code>memberships.isActive(clientId, clubId)</code> — метод публичного API модуля, в том же процессе', bad: false, why: 'Норма: публичный API хозяина. В модульном монолите это вызов функции, а ответ нужен сразу — перед записью.' },
    { id: 'a2', n: 2, from: 'book', to: 'sched', pts: [[300, 110], [300, 176]], b: [288, 143], t: 'Запись → Расписание', what: 'вызывает <code>schedule.reserveSeat(classId)</code> в той же транзакции, что и запись', bad: false, why: 'Норма: API хозяина. Место на занятии меняет Расписание, Запись лишь просит — одна транзакция в одном процессе.' },
    { id: 'a3', n: 3, from: 'sched', to: 'book', pts: [[334, 176], [334, 110]], b: [346, 143], t: 'Расписание → Запись', what: 'импортирует <code>BookingRepository</code> — внутренний класс Записи — и сам считает записанных на занятие', bad: true, fix: { api: 1, event: 0.5 }, fixWhy: { api: 'Верно: Запись отдаёт число через свой API, внутренний класс остаётся внутренним. ArchUnit поймает такой импорт при сборке.', event: 'Можно держать копию счётчика по событиям, но это один процесс и одна команда: проще спросить API Записи.', move: 'Переносить нечего: записи — данные Записи, Расписанию нужно только число.' }, hint: 'Чей это класс — публичный API модуля или его внутренность?' },
    { id: 'a4', n: 4, from: 'book', to: 'kafka', pts: [[394, 92], [470, 172]], b: [432, 134], t: 'Запись → Kafka', what: 'публикует <code>BookingCreated</code> в <code>puls.booking.events.v1</code> через outbox', bad: false, why: 'Норма: хозяин публикует свои события — это его опубликованный контракт.' },
    { id: 'a5', n: 5, from: 'bonus', to: 'kafka', pts: [[530, 74], [528, 160]], b: [529, 117], t: 'Бонусы → Kafka', what: 'читают <code>puls.access.visits.v1</code> группой <code>bonus</code> и начисляют +10 за посещение', bad: false, why: 'Норма: подписчик читает события хозяина (Доступа).' },
    { id: 'a6', n: 6, from: 'memb', to: 'bdb', pts: [[114, 66], [114, 14], [715, 14], [715, 30]], b: [420, 14], t: 'Абонементы → БД Бонусов', what: '<code>SELECT balance FROM bonus_account WHERE client_id = …</code> — по логину к чужой базе, чтобы посчитать, сколько бонусов можно списать при покупке', bad: true, fix: { api: 1 }, fixWhy: { api: 'Верно: резерв бонусов делает хозяин через свой API — это шаг саги покупки. Только он знает актуальный баланс и резервы.', event: 'Копия баланса по событиям может отстать: спишем бонусы, которых уже нет. Списание — решение хозяина, нужен его ответ сейчас.', move: 'Баланс — данные Бонусов. Перенести их в Абонементы — значит снова склеить два контекста.' }, hint: 'Чья это база? Кто знает актуальный баланс с учётом резервов?' },
    { id: 'a7', n: 7, from: 'bonus', to: 'bdb', pts: [[600, 52], [650, 52]], b: [625, 52], t: 'Бонусы → БД Бонусов', what: 'пишут и читают свой бонусный счёт и операции', bad: false, why: 'Норма: своя база.' },
    { id: 'a8', n: 8, from: 'pgw', to: 'pg', pts: [[700, 206], [700, 342], [396, 342]], b: [700, 280], t: 'Партнёрский шлюз → PostgreSQL ядра', what: '<code>INSERT INTO book.booking (…)</code> — записывает клиентов ФитПасса напрямую, «чтобы быстрее»', bad: true, fix: { api: 1 }, fixWhy: { api: 'Верно: только API Записи проверяет места, абонемент партнёра и дубли. Партнёру нужен ответ сразу — 201 или 409.', event: 'ФитПассу нужен ответ сейчас: записан или мест нет. Событие ответа не даёт.', move: 'Записи — данные Записи. Вторая таблица записей у шлюза — это двое на одном велосипеде.' }, hint: 'Кто проверяет, что мест хватает и человек не записан дважды? Обходит ли шлюз эти проверки?' },
    { id: 'a9', n: 9, from: 'pgw', to: 'kafka', pts: [[620, 183], [580, 183]], b: [600, 183], t: 'Партнёрский шлюз → Kafka', what: 'читает <code>puls.access.visits.v1</code> группой <code>partner-gateway</code>, чтобы отправить ФитПассу вебхук <code>visit.completed</code>', bad: false, why: 'Норма: подписчик на события Доступа.' },
    { id: 'a10', n: 10, from: 'an', to: 'pg', pts: [[470, 414], [296, 414], [296, 366]], b: [383, 414], t: 'Аналитика → PostgreSQL ядра', what: 'каждую ночь копирует таблицы <code>booking</code>, <code>payment</code>, <code>membership</code> с реплики к себе', bad: true, fix: { event: 1, api: 0.5 }, fixWhy: { event: 'Верно: модель чтения в ClickHouse собирается из событий Kafka (CQRS). Хозяева меняют таблицы свободно, отставание — до минуты.', api: 'Лучше, чем SQL: контракт явный. Но ночная выгрузка всех таблиц через API тяжела для ядра, а данные на сутки старше. Канон — события.', move: 'Таблицы ядра — данные ядра. У Аналитики своя модель чтения, а не копия чужих таблиц.' }, hint: 'Что будет с отчётами, когда Лена переименует колонку в <code>booking</code>?' },
    { id: 'a11', n: 11, from: 'an', to: 'ch', pts: [[610, 414], [660, 414]], b: [635, 402], t: 'Аналитика → ClickHouse', what: 'пишет витрины и читает их для отчётов директора', bad: false, why: 'Норма: своя база витрин.' },
    { id: 'a12', n: 12, from: 'notif', to: 'clients', pts: [[95, 318], [95, 220]], b: [95, 268], t: 'Уведомления → Клиенты', what: 'вызывают <code>GET /internal/clients/{id}/contacts</code> — телефон и имя для SMS', bad: false, why: 'Норма: API хозяина персональных данных. Телефон в события не кладём — его спрашивают у владельца.' }
  ];
  const FIXES = [{ v: 'api', t: 'через API хозяина' }, { v: 'event', t: 'через события хозяина' }, { v: 'move', t: 'перенести данные к себе' }];
  function vioEval(m) {
    m = m || {};
    return ARROWS.map(a => {
      const x = m[a.id] || {};
      if (a.bad) {
        if (!x.on) return { a, s: 'bad', pts: 0, miss: true };
        const f = x.fix && a.fix[x.fix];
        if (f === 1) return { a, s: 'ok', pts: 1 };
        if (f) return { a, s: 'warn', pts: 0.75 };
        return { a, s: 'warn', pts: x.fix ? 0.5 : 0.6, nofix: !x.fix, wrong: !!x.fix };
      }
      return x.on ? { a, s: 'bad', pts: 0, fp: true } : { a, s: 'ok', pts: 1 };
    });
  }
  function vioSVG(m, rv, sel) {
    const W = 800, H = 450;
    let s = `<svg viewBox="0 0 ${W} ${H}" style="min-width:660px" role="img" aria-label="Схема зависимостей «Пульса»">${svgDefs('abd-v')}`;
    s += `<rect x="16" y="40" width="396" height="200" rx="14" style="fill:var(--accent-soft);stroke:var(--accent)" stroke-width="1.2" stroke-dasharray="6 4"/><text x="404" y="233" text-anchor="end" style="fill:var(--accent);font:600 11px var(--f-mono, monospace);letter-spacing:.06em">ЯДРО · МОДУЛЬНЫЙ МОНОЛИТ</text>`;
    ARROWS.forEach(a => {
      const on = (m[a.id] || {}).on, r = rv && rv[a.id];
      const col = r ? r : on ? 'bad' : a.id === sel ? 'accent' : 'dim';
      const d = 'M' + a.pts.map(p => p.join(' ')).join(' L');
      s += `<g class="edge" data-ar="${a.id}"><path d="${d}" fill="none" style="stroke:transparent" stroke-width="16"/><path d="${d}" fill="none" style="stroke:${COL[col]}" stroke-width="${on || a.id === sel ? 2.6 : 1.7}" ${on ? 'stroke-dasharray="7 4"' : ''} marker-end="url(#abd-v-${col})"/>
        <circle cx="${a.b[0]}" cy="${a.b[1]}" r="10" style="fill:${on ? 'var(--bad)' : 'var(--surface)'};stroke:${COL[col]}" stroke-width="1.6"/><text x="${a.b[0]}" y="${a.b[1] + 4}" text-anchor="middle" style="fill:${on ? '#fff' : 'var(--text)'};font:600 11px var(--f-mono, monospace)">${a.n}</text></g>`;
    });
    Object.keys(VN).forEach(id => { s += svgNode(Object.assign({ id }, VN[id])); });
    return s + '</svg>';
  }
  const vioTask = {
    id: 'violations', title: 'Найти нарушения границ',
    simple: howOwn.simple,
    lead: ui.brief({
      situation: 'Антон выгрузил из кода и логов базы схему зависимостей «Пульса»: 12 стрелок. Среди них есть нарушения границ — кто-то лезет в чужую таблицу, чужую базу или чужие внутренности. Перед комитетом в пятницу их надо найти и предложить, как исправить.',
      todo: [
        'Нажмите на стрелку на схеме или на её строку в списке — прочитайте, что именно происходит.',
        'Если это нарушение, нажмите «Нарушение» и выберите, как исправить: через API хозяина, через события хозяина или перенести данные к себе.',
        'Нормальные стрелки не трогайте. Нажмите «Проверить». Засчитывается, когда найдены все нарушения, нет ложных и балл от 80 %.'
      ],
      lookTitle: 'Как читать схему',
      look: 'Пунктирная рамка — ядро (модульный монолит), внутри модули. Овальные — базы данных. Номер на стрелке — строка в списке. Красный пунктир — вы отметили нарушение. Подсказка: само слово SQL ещё не нарушение — у каждого есть своя база. Вопрос в том, <b>чья</b> таблица и <b>чей</b> код.'
    }),
    blank: () => ({ m: {} }),
    reference: () => ({ m: Object.fromEntries(ARROWS.filter(a => a.bad).map(a => [a.id, { on: true, fix: Object.keys(a.fix).find(k => a.fix[k] === 1) }])) }),
    render(el, ctx) {
      el.classList.add('abd-root');
      const a = ctx.ans; a.m = a.m || {};
      let sel = null;
      let rv = null;
      if (ctx.result) { rv = {}; vioEval(a.m).forEach(x => { if ((a.m[x.a.id] || {}).on || x.a.bad) rv[x.a.id] = x.s; }); }
      el.innerHTML = `<div class="stack"><div class="abd-board" data-svg></div><div class="abd-arr" data-list></div></div>`;
      function drawSvg() { TR.$('[data-svg]', el).innerHTML = vioSVG(a.m, rv, sel); }
      function row(ar) {
        const x = a.m[ar.id] || {}, r = rv && rv[ar.id];
        const ev = rv ? vioEval(a.m).find(e => e.a.id === ar.id) : null;
        let why = '';
        if (ev && (x.on || ar.bad)) {
          if (ev.fp) why = 'Это норма. ' + ar.why;
          else if (ev.miss) why = 'Пропущено. ' + ar.hint;
          else if (ar.bad && x.fix) why = ar.fixWhy[x.fix] || '';
          else if (ar.bad && !x.fix) why = 'Нарушение найдено — выберите, как исправить.';
        }
        if (ctx.readonly) why = ar.bad ? ar.fixWhy[Object.keys(ar.fix).find(k => ar.fix[k] === 1)] : ar.why;
        return `<div class="abd-ar ${x.on ? 'marked' : ''} ${r || ''}" data-row="${ar.id}">
          <span class="no">${ar.n}</span>
          <div class="tx"><b>${esc(ar.t)}</b>: ${ar.what}</div>
          <div class="ctl">${ctx.readonly ? (ar.bad ? ui.status('нарушение', 'bad') : ui.status('норма', 'ok')) : `<button type="button" class="btn xs" data-mk="${ar.id}|0" aria-pressed="${!x.on}">Норма</button><button type="button" class="btn xs" data-mk="${ar.id}|1" aria-pressed="${!!x.on}">Нарушение</button>`}</div>
          ${x.on && !ctx.readonly ? `<div class="fix"><span class="small dim">Как исправить:</span><select data-fx="${ar.id}" aria-label="Как исправить нарушение ${ar.n}"><option value="">выберите…</option>${FIXES.map(f => `<option value="${f.v}" ${x.fix === f.v ? 'selected' : ''}>${esc(f.t)}</option>`).join('')}</select></div>` : ''}
          ${ctx.readonly && ar.bad ? `<div class="fix"><span class="small dim">Исправить:</span> <b>${esc(tOf(FIXES, Object.keys(ar.fix).find(k => ar.fix[k] === 1)))}</b></div>` : ''}
          ${why ? `<div class="why">${why}</div>` : ''}
        </div>`;
      }
      function drawList() { TR.$('[data-list]', el).innerHTML = ARROWS.map(row).join(''); }
      function flash(id) {
        sel = id; drawSvg();
        const r = TR.$(`[data-row="${id}"]`, el); if (!r) return;
        TR.$$('.abd-ar.flash', el).forEach(x => x.classList.remove('flash'));
        r.classList.add('flash');
        try { r.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { }
      }
      drawSvg(); drawList();
      TR.on(el, 'click', '[data-ar]', (e, g) => flash(g.dataset.ar));
      if (ctx.readonly) return;
      TR.on(el, 'click', '[data-mk]', (e, b) => {
        const [id, v] = b.dataset.mk.split('|');
        const cur = a.m[id] || {};
        if (v === '1') a.m[id] = Object.assign({}, cur, { on: true }); else delete a.m[id];
        rv = null; ctx.save(); sel = id; drawSvg(); drawList();
        const found = ARROWS.filter(x => (a.m[x.id] || {}).on).map(x => x.n);
        ctx.decide('Нарушения границ', found.length ? found.join(', ') : '—');
      });
      el.addEventListener('change', e => {
        const s = e.target.closest('[data-fx]'); if (!s) return;
        a.m[s.dataset.fx] = Object.assign({}, a.m[s.dataset.fx], { fix: s.value || undefined });
        rv = null; ctx.save();
      });
    },
    check(ans) {
      const ev = vioEval(ans && ans.m);
      const v = ev.filter(x => x.a.bad), legit = ev.filter(x => !x.a.bad);
      const found = v.filter(x => !x.miss).length, fp = legit.filter(x => x.fp).length;
      const vScore = v.reduce((s, x) => s + x.pts, 0) / v.length, lScore = legit.filter(x => !x.fp).length / legit.length;
      const score = Math.max(0, vScore * 0.8 + lScore * 0.2 - (fp ? 0.05 * fp : 0));
      const notes = [];
      v.forEach(x => {
        const nm = `${x.a.n}. ${x.a.t}`;
        if (x.miss) notes.push({ ok: false, html: `Стрелка ${esc(nm)}: ${x.a.hint}` });
        else if (x.nofix) notes.push({ ok: 'warn', html: `Стрелка ${esc(nm)} — нарушение найдено. Как исправить?` });
        else if (x.s === 'ok') notes.push({ ok: true, html: `Стрелка ${esc(nm)}: ${x.a.fixWhy[(ans.m[x.a.id] || {}).fix]}` });
        else notes.push({ ok: 'warn', html: `Стрелка ${esc(nm)}: ${x.a.fixWhy[(ans.m[x.a.id] || {}).fix] || ''}` });
      });
      legit.filter(x => x.fp).forEach(x => notes.push({ ok: false, html: `Стрелка ${x.a.n}. ${esc(x.a.t)} — это норма. ${x.a.why}` }));
      return {
        ok: found === v.length && fp === 0 && score >= 0.8, score, notes,
        summary: `Найдено нарушений: ${found} из ${v.length}, ложных: ${fp}.`,
        vera: found < v.length ? 'Для каждой стрелки задайте два вопроса: чья это таблица или класс? и это публичный вход хозяина (API, событие) — или его внутренности?' : null
      };
    },
    explain: `<p>Четыре нарушения — четыре разных вида одной беды «лезть к соседу не через дверь»:</p>
      <ul class="checks">
        <li><b>3. Чужой внутренний класс</b> в модульном монолите. Ловит ArchUnit при сборке: модулю можно звать только публичный API соседа.</li>
        <li><b>6. Чужая база по логину «на время»</b>. Баланс бонусов знает только хозяин — резерв делают через его API, это шаг саги покупки.</li>
        <li><b>8. Запись в чужую таблицу</b> в обход правил хозяина: нет проверки мест и дублей — двое на одном велосипеде.</li>
        <li><b>10. Копия чужих таблиц для отчётов</b>. Модель чтения строят из событий (CQRS), иначе любое переименование в ядре ломает отчёты директора.</li>
      </ul>
      <p>Обратите внимание на нормальные стрелки с SQL: Бонусы → своя база, Аналитика → ClickHouse. «SQL» не нарушение — нарушение, когда таблица чужая.</p>`,
    report: ans => vioEval(ans && ans.m).filter(x => (ans.m[x.a.id] || {}).on || x.a.bad).map(x => `- ${x.a.n}. ${x.a.t}: ${(ans.m[x.a.id] || {}).on ? 'нарушение, исправить ' + tOf(FIXES, (ans.m[x.a.id] || {}).fix) : 'не отмечено'} ${x.s === 'ok' ? '✓' : x.s === 'warn' ? '≈' : '✗'}`).join('\n') || '—'
  };

  // =====================================================================
  // Практика 4. Почему Запись и Платежи вместе, а Бонусы отдельно
  // =====================================================================
  const WHY_RUBRIC = [
    'Запись, Абонементы и Платежи часто меняют данные вместе в одной операции (записаться = проверить абонемент и занять место; купить = абонемент + платёж) — в одном процессе это одна транзакция с откатом',
    'Между ними много вызовов на каждую операцию (сильное сцепление): по сети это задержка, лишние отказы и сага вместо ROLLBACK',
    'Их ведёт одна команда в общем ритме, а границы всё равно есть: свои схемы в базе, публичный API модулей, проверка зависимостей (ArchUnit)',
    'Бонусы — новый домен и новая команда со своим темпом релизов',
    'Бонусам почти не нужны синхронные ответы ядра: о посещениях и записях они узнают из событий — сцепление слабое, их падение не задевает запись',
    'Цена выноса Бонусов названа честно: сага при покупке с бонусами (резерв и компенсации) и задержка начисления («бонусы появятся в течение минуты»)'
  ];
  const WHY_REF = 'Граница проходит там, где связей мало. Запись, Абонементы и Платежи на каждую операцию спрашивают друг друга: записаться — значит проверить абонемент и занять место на занятии; купить абонемент — значит создать абонемент и платёж. Это сильное сцепление и общие транзакции: в одном процессе они откатываются целиком, а по сети превратились бы в задержку, лишние отказы и саги вместо ROLLBACK. Их ведёт одна команда в одном ритме, поэтому разносить по сервисам незачем. Но границы внутри есть: у каждого модуля своя схема в PostgreSQL и свой API, чужие таблицы закрыты правами и проверкой ArchUnit. Бонусы — наоборот: новый домен, новая команда со своим темпом релизов. Синхронно им от ядра почти ничего не нужно — о посещениях и записях они узнают из событий Kafka. Сцепление слабое: Бонусы упали — запись работает, события дождутся. Цена выноса: покупка абонемента с бонусами становится сагой с резервом и компенсациями, а бонусы начисляются не мгновенно, а в течение минуты — это надо записать в требования и согласовать с Ольгой.';
  const whyTask = {
    id: 'why-split', title: 'Почему так, а не иначе',
    simple: howCouple.simple,
    lead: ui.brief({
      situation: 'Новый разработчик в команде Бонусов спрашивает в общем чате: «Почему Запись и Платежи остались в одном модульном монолите, а нас вынесли в отдельный сервис? Несправедливо: нам теперь и Kafka, и сага, и дежурства». Антон просит ответить вас — на языке связности и сцепления.',
      todo: [
        'Напишите ответ в 6–10 предложениях (от 300 символов).',
        'Ответьте на три вопроса: почему Запись, Абонементы и Платежи вместе; почему Бонусы отдельно; какую цену за вынос платят.',
        'Нажмите «Проверить с Верой (Claude)» или «Сверить с эталоном самому» и отметьте раскрытые пункты. Засчитывается от 60 %.'
      ],
      lookTitle: 'На что опереться',
      look: 'Сколько вызовов между модулями на одну операцию; есть ли общие транзакции; одна команда или разные; нужен ли ответ сейчас или хватит события; что будет, если упадёт сосед. Из теории — ползунок «вопросов к соседу» и карта контекстов.'
    }),
    blank: () => ({ j: {} }),
    reference: () => ({ j: { text: WHY_REF, self: WHY_RUBRIC.map(() => true) } }),
    render(el, ctx) {
      el.classList.add('abd-root');
      el.insertAdjacentHTML('beforeend', ui.say('lena', 'Мне тоже интересно, как вы это объясните. Мы с Платежами правда каждый день правим общие сценарии — а Бонусы я вижу только в событиях.'));
      const j = document.createElement('div'); j.style.marginTop = '12px'; el.appendChild(j);
      ui.justify(j, {
        id: 'abd-why', q: 'Почему Запись и Платежи остались в одном модульном монолите, а Бонусы — отдельный сервис?',
        qPlain: 'Объясните разработчику Бонусов на языке связности и сцепления: почему Запись, Абонементы и Платежи живут в одном модульном монолите, а Бонусы вынесены в отдельный сервис, и какая у этого цена.',
        rubric: WHY_RUBRIC, reference: WHY_REF, value: ctx.ans.j, readonly: ctx.readonly, minLen: 300,
        onChange: v => { ctx.ans.j = v; ctx.save(); ctx.decide('Почему Запись+Платежи вместе, а Бонусы отдельно', v.text || ''); }
      });
    },
    check(ans) {
      const s = ui.justifyScore(ans && ans.j), txt = String(((ans && ans.j) || {}).text || '');
      const notes = [];
      if (s && s < 0.6) notes.push({ ok: false, html: 'Не хватает опоры: сколько связей и общих транзакций у Записи с Абонементами и Платежами — и сколько у Бонусов с ядром?' });
      if (txt.length >= 300 && !/саг|компенсац|задержк|минут|не мгновенно/i.test(txt)) notes.push({ ok: 'warn', html: 'Не видно цены выноса Бонусов. Что стало сложнее при покупке с бонусами и что увидит клиент?' });
      return { ok: s >= 0.6, score: s, notes, summary: s ? `Оценка ответа: ${Math.round(s * 100)} %.` : 'Напишите ответ (от 300 символов) и проверьте его с Верой или сверьте с эталоном сами.' };
    },
    explain: '<p>Сильный ответ опирается не на «так решил комитет», а на измеримые признаки: <b>сколько вызовов через границу</b>, <b>есть ли общие транзакции</b>, <b>одна ли команда</b>, <b>нужен ли ответ сейчас</b>. У Записи, Абонементов и Платежей все четыре говорят «вместе». У Бонусов — «отдельно»: им хватает событий.</p><p>И важная мысль для разработчика: «в одном монолите» не значит «без границ». Модули ядра так же не лезут в чужие схемы — просто вызов соседа у них стоит микросекунды, а не сетевой запрос.</p>',
    report: ans => (ans.j && ans.j.text) ? ans.j.text : '—'
  };

  // =====================================================================
  TR.stage({
    id: 'arch-bounded', act: 6, order: 320, slot: 'Вт 10:00', title: 'Границы модулей',
    when: 'вторник, 10:00 · переговорная «Сайкл» · Лена, Антон',
    intro: [
      { who: 'lena', html: 'Вчера решили: ядро остаётся модульным монолитом. Но внутри у нас каша. Бонусы читают мою таблицу <code>booking</code> напрямую, партнёрский шлюз пишет в неё сам. Мне нужно переименовать колонку под онлайн-тренировки — и я боюсь: не знаю, кто ещё в неё смотрит.' },
      { who: 'anton', html: 'Значит, границ у нас нет, есть папки. Делим систему на контексты: у каждого свой словарь, свои таблицы и одна команда-хозяин. Чужие данные — только через API или события хозяина. Границы рисуем вместе с аналитиком: он знает, где одно слово значит разное.' },
      { who: 'vera', html: 'Сначала посмотрим, как слово «клиент» расползается на пять смыслов, кто хозяин каждой таблицы и как считать связи между модулями. Потом разложим «Пульс» по контекстам, своими руками сломаем «чужую таблицу» и найдём нарушения на схеме Антона.' }
    ],
    facts: ['F-delete', 'F-capacity', 'F-cancel', 'F-referral', 'F-1c', 'F-fitpass-recon'],
    glossary: [
      { term: 'Ограниченный контекст (bounded context)', simple: 'Отдел клуба со своей папкой на клиента: у бухгалтерии — чеки, у тренера — посещения. Внутри отдела слова понимают одинаково.', tech: 'Граница, внутри которой действует одна модель предметной области и один словарь. У контекста одна команда-владелец; между контекстами общий только идентификатор, данные ходят через API и события.' },
      { term: 'Единый язык (ubiquitous language)', simple: 'Договорились, что в тренерской «отменить» значит «клиент передумал», а не «занятия не будет», — и так говорят все: в постановке, в коде, на планёрке.', tech: 'Словарь терминов контекста, общий для бизнеса, аналитика и разработчиков. Одни и те же слова — в требованиях, API, событиях и коде. В разных контекстах один термин может значить разное.' },
      { term: 'Владелец данных', simple: 'Кладовщик: полотенца выдаёт только он, через окошко. Полки внутри склада он переставляет когда хочет.', tech: 'Единственный модуль, который пишет в таблицу и отвечает за её смысл. Остальным — только его контракт: API или события. У каждой таблицы один владелец.' },
      { term: 'Интеграция через общую базу', simple: 'Каждый тренер сам ходит на склад и берёт с полок. Кладовщик переставил полки — половина тренерской ищет полотенца не там.', tech: 'Антипаттерн: модули читают или пишут чужие таблицы напрямую. Схема таблицы становится скрытым контрактом, о котором владелец не знает; любое переименование ломает соседей, чужие запросы грузят базу.' },
      { term: 'Публичный API модуля', simple: 'Окошко выдачи на складе: что можно попросить и что ответят. Остальное — за стеной.', tech: 'Набор методов (в модульном монолите) или эндпоинтов (в сервисе), через которые соседи обращаются к модулю. Внутренние классы и таблицы модуля снаружи недоступны.' },
      { term: 'Связность (cohesion)', simple: 'В тренерской лежит всё для тренировок и ничего лишнего — тренерам не надо бегать по клубу.', tech: 'Насколько функции и данные внутри модуля служат одной цели и меняются вместе. Высокая связность — признак удачной границы.' },
      { term: 'Сцепление (coupling)', simple: 'Сколько раз за продажу менеджер звонит на ресепшен. Пять звонков на каждую продажу — расписание лежит не там.', tech: 'Насколько модуль зависит от соседей: сколько о них знает и сколько раз их вызывает. Цель — слабое сцепление: по сети каждый вызов добавляет задержку и шанс отказа.' },
      { term: 'Карта контекстов (context map)', simple: 'Схема отделов клуба со стрелками: кто кому что передаёт и кто под кого подстраивается.', tech: 'Схема связей между ограниченными контекстами с типом отношений: издатель и подписчики, заказчик и поставщик, партнёрство, конформист, слой защиты от искажений. Показывает, кого затронет изменение.' },
      { term: 'Слой защиты от искажений (ACL)', simple: 'Переводчик на ресепшене: гость говорит «мембер-код», в журнал пишут «гостевой визит».', tech: 'Anti-corruption layer: компонент на границе, который переводит модель внешней системы в свою, чтобы чужие термины и статусы не расползлись по ядру. У «Пульса» — в Партнёрском шлюзе.' },
      { term: 'ArchUnit', simple: 'Охранник у двери тренерской: проверяет, что чужие не заходят через служебный вход.', tech: 'Библиотека тестов архитектуры для Java: падает при сборке, если модуль импортирует внутренний класс соседа или нарушает правила зависимостей. Так держат границы модульного монолита.' }
    ],
    outro: 'Граница модуля — не папка в коде, а договор: свой словарь, свои таблицы, один хозяин, а наружу — только API и события. Аналитик в этом договоре отвечает за словарь, за хозяина каждой таблицы и за то, чтобы в постановке было «спросить API Записи», а не «взять из таблицы <code>booking</code>». Завтра — как модули разговаривают: синхронный запрос, событие или задача в очередь, зачем API-шлюз и BFF и как нарисовать всё это в C4.',
    tasks: [howContext, howOwn, howCouple, sortTask, labTask, vioTask, whyTask]
  });
})();
