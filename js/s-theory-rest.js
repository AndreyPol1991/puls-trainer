/* Интерактивная теория «Как это работает» для тренировок REST и интеграций:
   intmap (стили обмена, аутентификация), rest-design (адрес и метод, повторы), rest-contract (анатомия запроса, коды и ошибки),
   hard-1 (ETag и PATCH), hard-2 (страницы, HTTP-кэш и 202), hard-3 (обратная совместимость).
   Механизм показываем на соседних примерах (шкафчики, прачечная, фитнес-бар), чтобы не решать практику за студента. */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc;

  document.head.insertAdjacentHTML('beforeend', `<style id="thr-css">
    .thr-badges { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 8px; }
    .thr-badge { border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; background: var(--surface-2); display: grid; gap: 2px; min-width: 0; }
    .thr-badge .k { font: 600 10.5px/1.25 var(--f-mono); letter-spacing: .1em; text-transform: uppercase; color: var(--text-muted); }
    .thr-badge .v { font-weight: 600; font-size: 14px; line-height: 1.35; }
    .thr-badge.ok .v { color: var(--ok); } .thr-badge.warn .v { color: var(--warn); } .thr-badge.info .v { color: var(--info); } .thr-badge.bad .v { color: var(--bad); }
    .thr-fit { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
    .thr-fit ul { margin: 0; padding-left: 18px; display: grid; gap: 3px; font-size: 14px; }
    .thr-auto { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px; align-items: start; }
    .thr-auto > * { min-width: 0; }
    .thr-set { display: grid; grid-template-columns: minmax(110px, 170px) minmax(0, 1fr); gap: 8px 12px; align-items: center; }
    .thr-set > * { min-width: 0; }
    .thr-set .lbl { font-size: 13px; color: var(--text-2); }
    .thr-set .lbl small { display: block; color: var(--text-muted); font-size: 11.5px; }
    .thr-box { border: 1px solid var(--border); border-radius: 12px; padding: 12px; background: var(--surface); display: grid; gap: 10px; min-width: 0; }
    .thr-range { width: 100%; accent-color: var(--accent); }
    .thr-log { font: 12.5px/1.6 var(--f-mono); background: var(--code-bg); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; min-height: 60px; max-height: 240px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; }
    .thr-log .ok { color: var(--ok); } .thr-log .bad { color: var(--bad); } .thr-log .warn { color: var(--warn); } .thr-log .dim { color: var(--text-muted); } .thr-log .info { color: var(--info); }
    .thr-kv { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 3px 10px; font-size: 13.5px; }
    .thr-kv > * { min-width: 0; overflow-wrap: anywhere; }
    .thr-kv .k { color: var(--text-muted); }
    .thr-kv .chg { color: var(--accent); font-weight: 600; } .thr-kv .lost { color: var(--bad); font-weight: 600; }
    .thr-phone { width: 250px; max-width: 100%; border: 2px solid var(--border-strong); border-radius: 24px; padding: 14px 12px 16px; background: var(--surface); display: grid; gap: 8px; justify-self: center; align-content: start; }
    .thr-phone .bar { height: 5px; width: 56px; border-radius: 5px; background: var(--border-strong); justify-self: center; }
    .thr-phone .ttl { font: 600 15px/1.3 var(--f-brand); }
    .thr-phone .crash { border: 1px solid var(--bad); background: var(--bad-soft); color: var(--bad); border-radius: 10px; padding: 10px; font-size: 13px; }
    .thr-phone .fine { font-size: 12.5px; color: var(--text-muted); }
    .thr-url { display: flex; flex-wrap: wrap; gap: 3px; font: 14px/1.4 var(--f-mono); padding: 10px; background: var(--code-bg); border: 1px solid var(--border); border-radius: 10px; }
    .thr-url button { border: 1px solid transparent; border-radius: 6px; padding: 3px 5px; font: inherit; overflow-wrap: anywhere; text-align: left; max-width: 100%; }
    .thr-url button[aria-pressed="true"] { border-color: currentColor; box-shadow: 0 0 0 1px currentColor; }
    .thr-r-scheme { background: var(--surface-3); color: var(--text-2); }
    .thr-r-host { background: var(--info-soft); color: var(--info); }
    .thr-r-ver { background: var(--violet-soft); color: var(--violet); }
    .thr-r-coll { background: var(--ok-soft); color: var(--ok); }
    .thr-r-id { background: var(--warn-soft); color: var(--warn); }
    .thr-r-query { background: color-mix(in srgb, var(--cyan) 14%, transparent); color: var(--cyan); }
    .thr-r-verb { background: var(--bad-soft); color: var(--bad); }
    .thr-toks { display: flex; flex-wrap: wrap; gap: 4px; font: 13.5px/1.4 var(--f-mono); }
    .thr-toks span { padding: 2px 6px; border-radius: 6px; overflow-wrap: anywhere; }
    .thr-env { border: 1px solid var(--border); border-radius: 10px; background: var(--code-bg); overflow: hidden; font: 13px/1.5 var(--f-mono); min-width: 0; }
    .thr-env .zone { font: 600 10px/1 var(--f-mono); letter-spacing: .1em; text-transform: uppercase; color: var(--text-muted); padding: 8px 12px 2px; }
    .thr-env button { display: block; width: 100%; text-align: left; border: 0; border-left: 3px solid transparent; background: none; padding: 5px 12px 5px 9px; color: var(--text); font: inherit; white-space: pre-wrap; overflow-wrap: anywhere; }
    .thr-env button:hover { background: var(--surface-2); }
    .thr-env button[aria-pressed="true"] { background: var(--accent-soft); border-left-color: var(--accent); }
    .thr-env button.off { color: var(--bad); text-decoration: line-through; background: var(--bad-soft); }
    .thr-env button.bad { background: var(--bad-soft); border-left-color: var(--bad); }
    .thr-env .hk { color: var(--tok-f); } .thr-env .mt { color: var(--tok-k); font-weight: 600; }
    .thr-lights { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .thr-light { border: 1px solid var(--border); border-radius: 12px; padding: 10px; background: var(--surface-2); text-align: left; display: grid; gap: 4px; color: var(--text); min-width: 0; }
    .thr-light .big { font: 700 22px/1 var(--f-mono); }
    .thr-light .sm { font-size: 12.5px; color: var(--text-2); }
    .thr-light.c2 .big { color: var(--ok); } .thr-light.c3 .big { color: var(--info); } .thr-light.c4 .big { color: var(--warn); } .thr-light.c5 .big { color: var(--bad); }
    .thr-light[aria-pressed="true"] { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset; background: var(--surface); }
    .thr-tree { display: grid; gap: 6px; }
    .thr-q { display: grid; grid-template-columns: 24px minmax(0, 1fr) auto; gap: 8px; align-items: center; border: 1px solid var(--border); border-radius: 10px; padding: 7px 10px; background: var(--surface); font-size: 14px; }
    .thr-q .num { font: 600 12px/1 var(--f-mono); color: var(--text-muted); }
    .thr-q .sub { display: block; font-size: 12.5px; color: var(--text-muted); }
    .thr-q .ans { display: flex; gap: 4px; }
    .thr-q.yes { border-color: color-mix(in srgb, var(--ok) 45%, var(--border)); }
    .thr-q.no { border-color: var(--warn); background: var(--warn-soft); }
    .thr-q.cur { box-shadow: 0 0 0 2px var(--accent) inset; }
    .thr-q.later { opacity: .45; }
    .thr-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .thr-chips .chip { white-space: normal; text-align: left; }
    .thr-lab3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; align-items: start; }
    .thr-adm { border: 1px solid var(--border); border-radius: 12px; padding: 10px; background: var(--surface); display: grid; gap: 8px; min-width: 0; }
    .thr-adm.srv { background: var(--surface-2); border-color: var(--border-strong); }
    .thr-adm h4 { font: 600 14px/1.3 var(--f-brand); margin: 0; }
    .thr-adm .btns { display: grid; gap: 6px; }
    .thr-adm .btns .btn { width: 100%; white-space: normal; }
    .thr-feed { display: grid; gap: 4px; }
    .thr-n { display: grid; grid-template-columns: 30px minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 5px 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); font-size: 13px; min-width: 0; }
    .thr-n > span { min-width: 0; overflow-wrap: anywhere; }
    .thr-n .pos { font: 600 11px/1 var(--f-mono); color: var(--text-muted); }
    .thr-n.new { border-color: var(--accent); background: var(--accent-soft); }
    .thr-n.del { opacity: .55; text-decoration: line-through; border-style: dashed; }
    .thr-n.skip { border-color: var(--warn); background: var(--warn-soft); }
    .thr-n.dup { border-color: var(--bad); background: var(--bad-soft); }
    .thr-pg { font: 600 10.5px/1 var(--f-mono); padding: 3px 6px; border-radius: 99px; white-space: nowrap; }
    .thr-pg.p1 { background: var(--info-soft); color: var(--info); } .thr-pg.p2 { background: var(--violet-soft); color: var(--violet); } .thr-pg.p3 { background: color-mix(in srgb, var(--cyan) 15%, transparent); color: var(--cyan); }
    .thr-pg.p4 { background: var(--surface-3); color: var(--text-2); }
    .thr-pg.x2 { background: var(--bad-soft); color: var(--bad); } .thr-pg.sk { background: var(--warn-soft); color: var(--warn); } .thr-pg.nw { background: var(--accent-soft); color: var(--accent); }
    .thr-pages { display: grid; gap: 8px; }
    .thr-page { border: 1px solid var(--border); border-radius: 10px; padding: 8px; background: var(--surface-2); display: grid; gap: 6px; }
    .thr-page .chips { display: flex; flex-wrap: wrap; gap: 4px; }
    .thr-cl { display: grid; gap: 4px; max-height: 340px; overflow: auto; padding-right: 2px; }
    .thr-cr { display: grid; grid-template-columns: 46px 52px minmax(90px, 1fr) 64px; gap: 6px; align-items: center; font-size: 12.5px; border-bottom: 1px dashed var(--border); padding: 3px 0; min-width: 0; }
    .thr-cr.head { font: 600 10.5px/1.2 var(--f-mono); letter-spacing: .06em; text-transform: uppercase; color: var(--text-muted); border-bottom: 1px solid var(--border); }
    .thr-cr .t { font-family: var(--f-mono); color: var(--text-muted); }
    .thr-cr.last { background: var(--surface-2); border-radius: 6px; }
    .thr-hops { position: relative; height: 20px; }
    .thr-hops .ln { position: absolute; top: 9px; height: 2px; background: var(--border-strong); left: 16.6%; }
    .thr-hops .dt { position: absolute; top: 3px; width: 14px; height: 14px; margin-left: -7px; border-radius: 50%; border: 2px solid var(--surface); }
    .thr-hops .dt.b { background: var(--ok); } .thr-hops .dt.c { background: var(--info); } .thr-hops .dt.s { background: var(--violet); }
    .thr-hops .tick { position: absolute; top: 7px; width: 6px; height: 6px; margin-left: -3px; border-radius: 50%; background: var(--border-strong); }
    .thr-hopsh { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); text-align: center; }
    .thr-code { font: 12.5px/1.65 var(--f-mono); background: var(--code-bg); border: 1px solid var(--border); border-radius: 10px; padding: 8px 0; overflow-x: auto; }
    .thr-code div { padding: 0 12px; white-space: pre; }
    .thr-code div.bad { background: var(--bad-soft); box-shadow: inset 3px 0 0 var(--bad); }
    .thr-code div.warn { background: var(--warn-soft); box-shadow: inset 3px 0 0 var(--warn); }
    .thr-code div.ok { background: var(--ok-soft); box-shadow: inset 3px 0 0 var(--ok); }
    .thr-code .c { color: var(--tok-c); font-style: italic; }
    .thr-state { display: grid; gap: 6px; }
    .thr-st { border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; background: var(--surface); font-size: 13.5px; display: grid; gap: 2px; }
    .thr-st.hl { border-color: var(--warn); background: var(--warn-soft); }
    .thr-st.gone { opacity: .55; text-decoration: line-through; }
    .thr-mx td, .thr-mx th { text-align: center !important; }
    .thr-mx td:first-child, .thr-mx th:first-child { text-align: left !important; }
    @media (max-width: 760px) { .thr-lab3 { grid-template-columns: minmax(0, 1fr); } }
    @media (max-width: 560px) {
      .thr-set { grid-template-columns: minmax(0, 1fr); }
      .thr-lights { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .thr-q { grid-template-columns: 20px minmax(0, 1fr); } .thr-q .ans { grid-column: 2; }
      .thr-cr { grid-template-columns: 40px 46px minmax(80px, 1fr) 54px; font-size: 12px; }
    }
  </style>`);

  // ---------- общие помощники ----------
  const L = (id, t, sub) => ({ id, t, sub });
  // действие внутри крайней правой дорожки рисуем плашкой: подпись справа от неё не помещается в схему
  const fitSelf = (lanes, steps) => steps.map(s => s.from === s.to && !s.box && s.from === lanes[lanes.length - 1].id ? Object.assign({}, s, { box: true, t: String(s.t).split('\n').join(' ') }) : s);
  const mk = (parent, cls, html) => { const d = document.createElement('div'); if (cls) d.className = cls; if (html) d.innerHTML = html; parent.appendChild(d); return d; };
  const badge = (k, v, kind) => `<div class="thr-badge ${kind || ''}"><span class="k">${k}</span><span class="v">${v}</span></div>`;
  const stat = (k, v, kind, s) => `<div class="stat"><span class="k">${k}</span><span class="v ${kind || ''}">${v}</span>${s ? `<span class="s">${s}</span>` : ''}</div>`;
  const setRow = (label, sub, html) => `<div class="lbl">${label}${sub ? `<small>${sub}</small>` : ''}</div><div>${html}</div>`;
  // проигрыватель сценариев: переключатель вариантов + ui.seq + итог после последнего шага
  function walk(el, cfg) {
    const name = cfg.name || 'thrsc';
    let cur = cfg.scenarios[0].id;
    el.innerHTML = `<div class="stack">${cfg.scenarios.length > 1 ? `<div class="row"><span class="small dim">${cfg.label || 'Вариант:'}</span>${ui.seg(name, cfg.scenarios.map(s => ({ v: s.id, t: s.t })), cur, 'accent')}</div>` : ''}<div data-w></div><div data-sum></div></div>`;
    const box = TR.$('[data-w]', el), sum = TR.$('[data-sum]', el);
    function show(id) {
      cur = id; const sc = cfg.scenarios.find(s => s.id === id);
      box.innerHTML = ''; sum.innerHTML = '';
      const d = document.createElement('div'); box.appendChild(d);
      ui.seq(d, { lanes: sc.lanes, steps: fitSelf(sc.lanes, sc.steps), title: sc.t, laneW: cfg.laneW, hint: sc.hint || 'Нажимайте «Шаг →» и читайте пояснение под схемой. «Проиграть» покажет всё подряд.', onEnd() { sum.innerHTML = sc.sum ? ui.note(sc.sumKind || '', 'Итог', sc.sum) : ''; } });
    }
    ui.onSeg(el, (n, v) => { if (n === name) show(v); });
    show(cur);
  }
  const b64 = s => { const bytes = new TextEncoder().encode(s); let bin = ''; bytes.forEach(b => { bin += String.fromCharCode(b); }); return btoa(bin); };
  const unb64 = s => { try { const bin = atob(s); return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))); } catch (e) { return '—'; } };
  // учебная «подпись»: детерминированный хеш секрета и тела (в жизни — HMAC-SHA256)
  function toySign(secret, body) {
    let h1 = 0x811c9dc5, h2 = 0x1b873593;
    const s = secret + '|' + body + '|' + secret;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
      h2 = Math.imul(h2 ^ c, 2246822507) >>> 0; h2 = (h2 ^ (h2 >>> 13)) >>> 0;
    }
    return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
  }

  // =====================================================================
  // intmap · 1. Семь способов обмена
  // =====================================================================
  const STY = [
    {
      v: 'rest', t: 'REST', ex: 'Сервер «Пульса» спрашивает прачечную «Чистый лист»: сколько чистых полотенец привезут в «Сокол» завтра.',
      who: 'вызывающий — мы', wait: 'да, ответ сразу', addr: 'у прачечной: мы звоним им', waitKind: 'ok',
      lanes: [L('us', 'Сервер «Пульса»', 'спрашивает'), L('them', 'API прачечной', 'отвечает')],
      steps: [
        { from: 'us', to: 'them', t: 'GET /deliveries?clubId=sokol\n&date=2026-10-06', note: 'Начинаем мы: нужен ответ — спрашиваем. Обычный HTTP-запрос. Адрес называет вещь — «доставки», а фильтры стоят после знака <code>?</code>.' },
        { from: 'them', to: 'them', t: 'ищет доставки', note: 'Прачечная ищет у себя доставки на нужную дату.' },
        { from: 'them', to: 'us', t: '200 OK + JSON', reply: true, kind: 'ok', note: 'Ответ приходит в том же соединении через доли секунды. Всё это время наш сервер ждал. Это <b>синхронный</b> вызов: спросил — подождал — получил.' }
      ],
      msg: () => `<div class="thr-auto">${ui.http({ cap: 'запрос', method: 'GET', path: '/v1/deliveries?clubId=sokol&date=2026-10-06', headers: { Authorization: 'Bearer eyJhbGciOi…' } })}${ui.http({ cap: 'ответ', status: 200, headers: { 'Content-Type': 'application/json' }, body: { items: [{ id: 'd-31', clubId: 'sokol', towels: 400, eta: '2026-10-06T08:00:00+03:00' }] } })}</div>`,
      good: ['API понятен любому разработчику: HTTP и JSON', 'Чужие системы и партнёры — им нужен простой, стабильный контракт', 'Ответы на GET можно кэшировать и ограничивать по частоте'],
      bad: ['Экрану нужны данные из 5–6 мест сразу — получится много запросов', 'Ответ нужен за доли секунды по слабому каналу', 'Результат будет готов через минуты или часы']
    },
    {
      v: 'graphql', t: 'GraphQL', ex: 'Экран «Мой день» в приложении тренера: занятия Марии Лис на сегодня, направление и сколько свободных мест.',
      who: 'приложение (клиент)', wait: 'да, ответ сразу', addr: 'у сервера «Пульса»', waitKind: 'ok',
      lanes: [L('app', 'Приложение тренера', 'экран «Мой день»'), L('gql', 'GraphQL «Пульса»', 'одна точка входа'), L('db', 'Данные', 'занятия, записи')],
      steps: [
        { from: 'app', to: 'gql', t: 'POST /graphql\nquery TrainerDay', note: 'Начинает приложение. Адрес один на всё, а в теле — список полей, которые нужны экрану.' },
        { from: 'gql', to: 'db', t: 'занятия Марии\n+ места + направления', note: 'Сервер сам обходит нужные таблицы: занятия, записи, направления.' },
        { from: 'gql', to: 'app', t: '200 { data: … }', reply: true, kind: 'ok', note: 'Ответ ровно той формы, что в запросе: ни лишних полей, ни недостающих. Приложение ждёт его — это тоже синхронный вызов.' }
      ],
      msg: () => `<div class="thr-auto"><div>${ui.code('query TrainerDay {\n  me {\n    classes(date: "2026-10-05") {\n      startsAt\n      type { name }\n      freeSpots\n    }\n  }\n}', 'graphql', 'тело POST /graphql')}</div><div>${ui.code(JSON.stringify({ data: { me: { classes: [{ startsAt: '2026-10-05T09:00:00+03:00', type: { name: 'Йога' }, freeSpots: 4 }, { startsAt: '2026-10-05T19:00:00+03:00', type: { name: 'Сайкл' }, freeSpots: 0 }] } } }, null, 2), 'json', 'ответ той же формы')}</div></div>`,
      good: ['Экрану нужны данные из многих мест одним запросом', 'Разным экранам нужны разные наборы полей', 'Важен каждый запрос на медленной мобильной сети'],
      bad: ['Внешним партнёрам: такой API труднее кэшировать и ограничивать', 'Простые формы и списки — лишняя сложность на сервере']
    },
    {
      v: 'grpc', t: 'gRPC', ex: 'Касса фитнес-бара в клубе «Сокол» списывает 250 ₽ за коктейль с браслета клиента. Решение нужно за 200 мс.',
      who: 'касса (клиент)', wait: 'да, но не дольше дедлайна', addr: 'у сервера «Пульса»', waitKind: 'ok',
      lanes: [L('pos', 'Касса бара', 'клуб «Сокол»'), L('srv', 'Сервер «Пульса»', 'сервис BarPos')],
      steps: [
        { from: 'pos', to: 'pos', t: 'Charge(br-5521, 25000)\nдедлайн 200 мс', note: 'Код кассы вызывает функцию <code>Charge</code>, будто она локальная. Клиент для неё сгенерирован из общего файла-контракта <code>.proto</code>.' },
        { from: 'pos', to: 'srv', t: 'HTTP/2 · 13 байт', note: 'По сети уходит двоичное сообщение — 13 байт. Соединение HTTP/2 уже открыто, повторное рукопожатие не нужно.' },
        { from: 'srv', to: 'srv', t: 'проверить баланс', note: 'Сервер раскодирует сообщение тем же контрактом и проверяет баланс.' },
        { from: 'srv', to: 'pos', t: 'ok · остаток 1 750 ₽', reply: true, kind: 'ok', note: 'Ответ — тоже маленькое двоичное сообщение. Касса ждёт его, но не дольше дедлайна: не уложились — ошибка <code>DEADLINE_EXCEEDED</code>.' }
      ],
      msg: () => `<div class="thr-auto"><div>${ui.code('service BarPos {\n  rpc Charge (ChargeRequest) returns (ChargeReply);\n}\nmessage ChargeRequest {\n  string bracelet_id    = 1;\n  int64  amount_kopecks = 2;\n}', 'proto', 'контракт .proto — общий у кассы и сервера')}</div><div>${ui.code('0a 07 62 72 2d 35 35 32 31 10 a8 c3 01\n\n0a       — поле 1, строка\n07       — длина 7\n62 … 31  — «br-5521»\n10       — поле 2, число\na8 c3 01 — 25000 копеек', 'text', 'по сети — 13 байт (в JSON было бы 46)')}</div></div>`,
      good: ['Обе стороны — «свои» системы, контракт .proto общий', 'Нужна скорость и маленькие сообщения на слабом канале', 'Нужны потоки: сервер долго шлёт обновления по одному вызову'],
      bad: ['Браузер напрямую так не умеет', 'Чужой партнёр, которого вы не контролируете', 'Ответ должен кэшировать CDN']
    },
    {
      v: 'soap', t: 'SOAP', ex: 'Клиент пришёл в бассейн по полису ДМС. Сервер «Пульса» спрашивает старый сервис страховой: действует ли полис.',
      who: 'вызывающий — мы', wait: 'да, ответ сразу', addr: 'у страховой', waitKind: 'ok',
      lanes: [L('us', 'Сервер «Пульса»', 'проверяет полис'), L('ins', 'Страховая', 'SOAP-сервис')],
      steps: [
        { from: 'us', to: 'ins', t: 'POST /ws/PolicyService\nXML-конверт', note: 'Начинаем мы. Запрос — XML-«конверт» строго по контракту WSDL: имена тегов и их порядок заданы заранее. Почти всегда это POST на один адрес.' },
        { from: 'ins', to: 'ins', t: 'проверить полис', note: 'Страховая проверяет номер полиса и услугу.' },
        { from: 'ins', to: 'us', t: '200 + XML-ответ', reply: true, kind: 'ok', note: 'Ответ — тоже в конверте. Ждём его сразу. Ошибка придёт как <code>soap:Fault</code> внутри конверта.' }
      ],
      msg: () => `<div class="thr-auto"><div>${ui.code('POST /ws/PolicyService HTTP/1.1\nContent-Type: text/xml; charset=utf-8\nSOAPAction: "ПроверитьПолис"\n\n<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">\n  <soap:Body>\n    <ПроверитьПолис>\n      <НомерПолиса>ДМС-778-1201</НомерПолиса>\n      <Услуга>бассейн</Услуга>\n    </ПроверитьПолис>\n  </soap:Body>\n</soap:Envelope>', 'http', 'запрос')}</div><div>${ui.code('<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">\n  <soap:Body>\n    <ПроверитьПолисОтвет>\n      <Действует>true</Действует>\n      <ДействуетДо>2026-12-31</ДействуетДо>\n    </ПроверитьПолисОтвет>\n  </soap:Body>\n</soap:Envelope>', 'xml', 'ответ')}</div></div>`,
      good: ['Старая система уже умеет только так — подстраиваемся', 'Строгий контракт: каждое поле описано в WSDL'],
      bad: ['Новая разработка с нуля — тяжёлый XML без пользы', 'Мобильное приложение и браузер']
    },
    {
      v: 'hook', t: 'Вебхук', ex: 'Утром «Пульс» заказал стирку. Вечером прачечная сама сообщает: «полотенца доставлены в „Сокол“».',
      who: 'тот, у кого случилось событие — прачечная', wait: 'нет — сообщат, когда случится', addr: 'у нас: прачечная звонит нам', waitKind: 'warn',
      lanes: [L('us', 'Сервер «Пульса»', 'адрес /webhooks/laundry'), L('ln', 'Прачечная', '«Чистый лист»')],
      steps: [
        { from: 'us', to: 'ln', t: 'POST /orders\n400 полотенец', note: 'Утром мы заказали стирку. Ответ «заказ принят» пришёл сразу — но сами полотенца будут только вечером.' },
        { from: 'ln', to: 'us', t: '201 заказ принят', reply: true, note: 'Это обычный синхронный ответ: «приняли». Результата пока нет.' },
        { from: 'ln', to: 'ln', t: 'стирка и доставка', kind: 'info', note: 'Проходят часы. Мы не спрашиваем каждые 5 минут «готово?» — ждём звонка.' },
        { from: 'ln', to: 'us', t: 'POST /webhooks/laundry\ndelivery.completed', kind: 'info', note: 'Теперь <b>начинает прачечная</b>: сама вызывает наш адрес. Значит, у нас должен быть открытый адрес, а у письма — подпись, чтобы его не подделали.' },
        { from: 'us', to: 'ln', t: '200 получил', reply: true, kind: 'ok', note: 'Отвечаем быстро, а обрабатываем после ответа. Не ответим — прачечная пришлёт ещё раз. Поэтому дубли — норма, их отсекают по id события.' }
      ],
      msg: () => `<div class="thr-auto">${ui.http({ cap: 'прачечная → «Пульс»', method: 'POST', path: 'https://api.puls.fit/webhooks/laundry', headers: { 'Content-Type': 'application/json', 'X-Signature': 'sha256=9f2c…' }, body: { eventId: 'evt_88', type: 'delivery.completed', clubId: 'sokol', towels: 400, at: '2026-10-06T19:52:00+03:00' } })}${ui.http({ cap: 'наш ответ — сразу', status: 200 })}</div>`,
      good: ['Событие случится потом, и неизвестно когда', 'Не хочется спрашивать «готово?» каждую минуту', 'Получатель может держать открытый адрес и проверять подпись'],
      bad: ['У получателя нет публичного адреса (телефон, устройство за роутером)', 'Ответ нужен прямо сейчас, в том же вызове']
    },
    {
      v: 'sse', t: 'SSE', ex: 'Планшет тренера в зале показывает, кто уже прошёл турникет на его занятие в 19:00. Список растёт сам.',
      who: 'экран подписывается, дальше пишет сервер', wait: 'поток: события по мере появления', addr: 'у сервера «Пульса»', waitKind: 'info',
      lanes: [L('scr', 'Экран тренера', 'планшет в зале'), L('srv', 'Сервер «Пульса»', 'поток событий')],
      steps: [
        { from: 'scr', to: 'srv', t: 'GET …/arrivals/stream\nAccept: text/event-stream', note: 'Экран один раз подписывается обычным GET.' },
        { from: 'srv', to: 'scr', t: '200, соединение открыто', reply: true, note: 'Сервер отвечает и <b>не закрывает</b> соединение.' },
        { from: 'srv', to: 'scr', t: 'arrived: Анна С.', reply: true, kind: 'info', note: 'Анна прошла турникет — сервер дописывает событие в открытый ответ.' },
        { from: 'srv', to: 'scr', t: 'arrived: Пётр О.', reply: true, kind: 'info', note: 'И следующее — как только оно случилось.' },
        { from: 'scr', to: 'scr', t: 'обновить список', kind: 'ok', note: 'Экран ничего не спрашивает повторно. Связь в одну сторону: от сервера к экрану. Оборвалась — браузер переподключится сам.' }
      ],
      msg: () => ui.code('GET /v1/classes/c-19/arrivals/stream\nAccept: text/event-stream\n\nHTTP/1.1 200 OK\nContent-Type: text/event-stream\n\nid: 7\nevent: arrived\ndata: {"client":"Анна С.","at":"18:52"}\n\nid: 8\nevent: arrived\ndata: {"client":"Пётр О.","at":"18:54"}', 'text', 'одно соединение — много событий'),
      good: ['Цифра или список на экране меняются постоянно', 'Данные идут в одну сторону — от сервера к экрану'],
      bad: ['Событие раз в сутки — проще спросить, когда нужно', 'Нужно и отправлять, и получать по одному каналу']
    },
    {
      v: 'batch', t: 'Пакетная выгрузка', ex: 'Раз в неделю «Пульс» отправляет прачечной реестр: сколько полотенец сдал каждый клуб. По нему выставляют счёт.',
      who: 'мы, по расписанию', wait: 'нет — пачка раз в неделю', addr: 'у прачечной: приём файлов', waitKind: 'warn',
      lanes: [L('us', 'Задача «Пульса»', 'по расписанию'), L('db', 'База «Пульса»', 'сдачи полотенец'), L('ln', 'Прачечная', 'приём файлов')],
      steps: [
        { from: 'us', to: 'us', t: 'понедельник 06:00\nзадача проснулась', note: 'Никто ничего не ждёт: задача запускается по расписанию.' },
        { from: 'us', to: 'db', t: 'сдачи за неделю\nпо клубам', note: 'Собираем всё, что накопилось за неделю.' },
        { from: 'us', to: 'ln', t: 'загрузить\nreestr_2026-W40.csv', note: 'Отправляем одним файлом — 12 строк, по строке на клуб.' },
        { from: 'ln', to: 'us', t: 'принято: 12 строк', reply: true, kind: 'ok', note: 'Ответ «файл принят». Обрабатывает прачечная, когда ей удобно.' },
        { from: 'us', to: 'db', t: 'отметить «выгружено»', kind: 'ok', note: 'Отмечаем выгруженное. Файл не дошёл — завтра задача отправит снова, а прачечная не задвоит строки: у реестра есть номер недели.' }
      ],
      msg: () => ui.code('клуб;неделя;сдано_полотенец\nПульс Сокол;2026-W40;2840\nПульс Химки;2026-W40;1910\n… ещё 10 клубов', 'text', 'reestr_2026-W40.csv — уходит в понедельник в 06:00'),
      good: ['Получателю не нужно «прямо сейчас»: раз в день, неделю, месяц', 'Много записей — дешевле одним файлом', 'Получатель работает по своему графику'],
      bad: ['Человек ждёт результат прямо сейчас', 'Данные устаревают за минуты']
    }
  ];
  const howStyles = {
    id: 'how-styles', title: 'Как это работает: семь способов обмена', covers: ['who', 'style', 'sync'], free: true, noReset: true,
    simple: {
      icon: '🔌', plain: 'Системы обмениваются данными по-разному: одни спрашивают и ждут ответ, другие сами сообщают новости, третьи копят и отправляют пачкой.',
      analogy: 'Как общаются люди в клубе: спросить у стойки и подождать ответ; оставить телефон, чтобы перезвонили; раз в неделю отнести ведомость в бухгалтерию; смотреть на табло, которое обновляется само.',
      tech: 'У любой связи три вопроса. Кто начинает разговор — у того, кому звонят, должен быть открытый адрес. В каком виде сообщение — JSON, XML, двоичный Protobuf, файл. Ждёт ли вызывающий ответ сразу (синхронно) или результат придёт потом (асинхронно: вебхук, 202 + опрос статуса, пакет, поток событий).'
    },
    lead: ui.brief({
      situation: 'Перед картой «Пульса» разберём семь способов обмена на соседнем примере. «Пульс» открывает в клубах фитнес-бары и подключает прачечную «Чистый лист» — она стирает полотенца. Новые связи появляются со всех сторон, и для каждой подходит свой способ.',
      todo: ['Выбирайте способ в переключателе.', 'Пройдите схему по шагам: кто начинает разговор, как выглядит сообщение, ждёт ли вызывающий ответ.', 'Прочитайте «Подходит» и «Не подходит». Внизу сравните все семь способов в таблице — строка выбранного подсвечена.'],
      look: 'Три плашки над схемой отвечают на три вопроса: кто начинает, ждём ли ответ, у кого открытый адрес. Эти же вопросы вы зададите каждой связи на карте «Пульса». Стрелка в схеме идёт от того, кто начинает, пунктир — ответ.'
    }),
    render(el) {
      let cur = 'rest';
      el.innerHTML = `<div class="stack">
        <div class="row"><span class="small dim">Способ:</span>${ui.seg('thrsty', STY.map(s => ({ v: s.v, t: s.t })), cur, 'accent')}</div>
        <div data-ex></div><div class="thr-badges" data-bd></div><div data-seq></div>
        <div class="eyebrow">Как выглядит сообщение</div><div data-msg></div>
        <div class="thr-fit" data-fit></div>
        <div class="eyebrow">Все семь рядом</div><div data-tbl></div></div>`;
      const seqEl = TR.$('[data-seq]', el);
      function draw() {
        const s = STY.find(x => x.v === cur);
        TR.$('[data-ex]', el).innerHTML = ui.note('', 'Пример', s.ex);
        TR.$('[data-bd]', el).innerHTML = badge('Кто начинает', s.who, 'info') + badge('Ждём ответ сразу?', s.wait, s.waitKind) + badge('У кого открытый адрес', s.addr);
        seqEl.innerHTML = '';
        ui.seq(mk(seqEl), { lanes: s.lanes, steps: fitSelf(s.lanes, s.steps), title: s.t, hint: 'Нажимайте «Шаг →»: под схемой появится пояснение к каждому шагу.' });
        TR.$('[data-msg]', el).innerHTML = s.msg();
        TR.$('[data-fit]', el).innerHTML = `<div class="note ok"><div class="ttl">Подходит, когда</div><ul>${s.good.map(x => `<li>${x}</li>`).join('')}</ul></div><div class="note warn"><div class="ttl">Не подходит, когда</div><ul>${s.bad.map(x => `<li>${x}</li>`).join('')}</ul></div>`;
        const rows = [
          ['rest', 'REST', 'вызывающий', 'JSON по HTTP', 'сразу'],
          ['graphql', 'GraphQL', 'клиент-экран', 'запрос полей → JSON', 'сразу'],
          ['grpc', 'gRPC', 'клиент', 'двоичный Protobuf, HTTP/2', 'сразу, с дедлайном'],
          ['soap', 'SOAP', 'вызывающий', 'XML-конверт', 'сразу'],
          ['hook', 'Вебхук', 'тот, у кого событие', 'POST на ваш адрес', 'потом, когда случится'],
          ['sse', 'SSE', 'клиент подписывается', 'текстовые события', 'поток'],
          ['batch', 'Пакет', 'по расписанию', 'файл: CSV, XML', 'раз в день, неделю']
        ];
        TR.$('[data-tbl]', el).innerHTML = ui.table(['Способ', 'Кто начинает', 'Формат', 'Ответ'], rows.map(r => [`<b>${r[1]}</b>`, r[2], r[3], r[4]]), { rowClass: (r, i) => rows[i][0] === cur ? 'ok' : '' });
      }
      ui.onSeg(el, (n, v) => { if (n === 'thrsty') { cur = v; draw(); } });
      draw();
    }
  };

  // =====================================================================
  // intmap · 2. Как системы доказывают, кто они
  // =====================================================================
  const AUTHM = [
    {
      v: 'key', t: 'API-ключ', proves: 'знает постоянный секрет', wire: 'сам секрет — в каждом запросе', life: 'пока не отзовут вручную',
      ex: 'Сервер «Пульса» отправляет клиентам письма через сервис e-mail-рассылок. Сервис выдал ключ в личном кабинете.',
      lanes: [L('us', 'Сервер «Пульса»', 'шлёт письма'), L('svc', 'Сервис рассылок', 'чужой REST API')],
      steps: [
        { from: 'us', to: 'us', t: 'взять ключ\nиз хранилища секретов', note: 'Ключ лежит в хранилище секретов — не в коде и не в git. Иначе он утечёт вместе с репозиторием.' },
        { from: 'us', to: 'svc', t: 'POST /v3/mail/send\nX-Api-Key: sk_live_7Hq…', kind: 'warn', note: 'Ключ едет <b>в каждом запросе</b>. Канал шифрован TLS, но сам ключ — это и есть пароль.' },
        { from: 'svc', to: 'svc', t: 'чей ключ? что можно?', note: 'Сервис находит ключ у себя и узнаёт владельца: «Пульс», тариф, лимиты.' },
        { from: 'svc', to: 'us', t: '202 письмо в очереди', reply: true, kind: 'ok', note: 'Ключ верный — письмо принято.' }
      ],
      leak: ['bad', 'Злоумышленник шлёт письма от имени «Пульса» сколько угодно: ключ не протухает. Заметят по счёту за рассылку. Что делать: отозвать ключ в кабинете сервиса, выпустить новый, заменить в хранилище секретов.']
    },
    {
      v: 'basic', t: 'Basic', proves: 'знает логин и пароль', wire: 'логин и пароль — в каждом запросе', life: 'пока не сменят пароль',
      ex: 'Сервер «Пульса» передаёт данные в старую учётную систему прачечной. Там вход по логину и паролю.',
      lanes: [L('us', 'Сервер «Пульса»', 'передаёт данные'), L('old', 'Учёт прачечной', 'старый сервис')],
      steps: [
        { from: 'us', to: 'us', t: 'логин:пароль\n→ base64', note: 'Basic — это «логин:пароль», закодированные base64. <b>Закодированные — не зашифрованные.</b> Попробуйте ниже: раскодировать может кто угодно.' },
        { from: 'us', to: 'old', t: 'POST /api/towels\nAuthorization: Basic cHVs…', kind: 'warn', note: 'Пароль едет в каждом запросе. Поэтому только по HTTPS — иначе его прочитает любой на пути.' },
        { from: 'old', to: 'old', t: 'сверить пароль', note: 'Сервис раскодирует строку и сверяет пароль с базой.' },
        { from: 'old', to: 'us', t: '200', reply: true, kind: 'ok', note: 'Пароль верный — запрос принят.' }
      ],
      leak: ['bad', 'Как с любым паролем: доступ без срока, пока пароль не сменят. Хуже, если тот же пароль используют где-то ещё. Что делать: сменить пароль у прачечной и в нашем хранилище секретов.']
    },
    {
      v: 'cc', t: 'OAuth Client Credentials', proves: 'сервер знает свой секрет и получает временный пропуск', wire: 'секрет — один раз на сервер входа, дальше только токен', life: 'токен 15 минут, секрет — пока не отзовут',
      ex: 'Сервер прачечной сам, без человека, сообщает в API «Пульса» о доставках. «Пульс» выдал прачечной client_id и секрет.',
      lanes: [L('cli', 'Сервер прачечной', 'без человека'), L('auth', 'Сервер входа', '«Пульс», выдаёт токены'), L('api', 'API «Пульса»', 'принимает доставки')],
      steps: [
        { from: 'cli', to: 'auth', t: 'POST /oauth/token\nclient_id + secret', kind: 'warn', note: 'Сервер прачечной обменивает свои постоянные данные на временный пропуск. Секрет едет <b>один раз</b> и только на сервер входа.' },
        { from: 'auth', to: 'auth', t: 'секрет верный?\nкакие права (scope)?', note: 'Сервер входа проверяет секрет и решает, что прачечной можно: например, только <code>deliveries:write</code>.' },
        { from: 'auth', to: 'cli', t: 'access_token · 15 мин', reply: true, kind: 'ok', note: 'Токен — подписанный пропуск: кто, какие права, до какого времени.' },
        { from: 'cli', to: 'api', t: 'POST /v1/deliveries\nBearer eyJ…', note: 'Дальше в запросах едет только токен.' },
        { from: 'api', to: 'api', t: 'подпись, срок, scope', note: 'API проверяет подпись токена, срок и права — в базу паролей не ходит. Нет нужного права — <code>403</code>.' },
        { from: 'api', to: 'cli', t: '201', reply: true, kind: 'ok' },
        { from: 'cli', to: 'auth', t: 'через 15 мин —\nза новым токеном', note: 'Токен кончился — сервер прачечной получит <code>401</code> и сам возьмёт новый.' }
      ],
      leak: ['warn', 'Утёк токен — он работает не больше 15 минут и только в своих правах. Утёк секрет — отзываем его у одного этого партнёра, остальные работают как раньше.']
    },
    {
      v: 'pkce', t: 'Authorization Code + PKCE', proves: 'человек вошёл сам, приложение — то же, что начинало вход', wire: 'одноразовый код, потом токены; секрета клиента нет', life: 'access 15 минут, refresh — дни',
      ex: 'Тренер Мария Лис входит в приложение тренера по телефону и SMS-коду.',
      lanes: [L('app', 'Приложение тренера', 'телефон Марии'), L('auth', 'Сервер входа', 'SMS-код, токены'), L('api', 'API «Пульса»', '')],
      steps: [
        { from: 'app', to: 'app', t: 'придумать verifier\nи его хеш challenge', note: 'Перед входом приложение придумывает случайную строку <code>code_verifier</code> и считает её хеш <code>code_challenge</code>. Саму строку оставляет у себя.' },
        { from: 'app', to: 'auth', t: 'вход: телефон, SMS\n+ challenge', note: 'Мария вводит телефон и код из SMS на странице сервера входа. С запросом уходит только хеш.' },
        { from: 'auth', to: 'app', t: 'одноразовый code', reply: true, note: 'Сервер входа возвращает одноразовый код. Его могут перехватить: на телефоне живут и другие приложения.' },
        { from: 'app', to: 'auth', t: 'code + verifier', kind: 'warn', note: 'Приложение меняет code на токены и прикладывает исходную строку <code>code_verifier</code>.' },
        { from: 'auth', to: 'auth', t: 'хеш(verifier)\n= challenge?', note: 'Сервер считает хеш от присланной строки и сравнивает с полученным на втором шаге. Совпало — обменивает то же приложение, что начинало вход.' },
        { from: 'auth', to: 'app', t: 'access 15 мин\n+ refresh', reply: true, kind: 'ok', note: 'Короткий access-токен для запросов и refresh-токен, чтобы получать новые без повторного SMS.' },
        { from: 'app', to: 'api', t: 'GET /v1/me · Bearer' },
        { from: 'api', to: 'app', t: '200', reply: true, kind: 'ok' }
      ],
      leak: ['ok', 'Перехватили одноразовый code — без <code>code_verifier</code>, который не покидал телефон, его не обменять. Секрета клиента в приложении нет вовсе: приложение можно разобрать, и любой «зашитый» секрет достанут. Украли токен — access живёт 15 минут, refresh отзывают при выходе.']
    },
    {
      v: 'mtls', t: 'mTLS', proves: 'у устройства есть закрытый ключ к сертификату', wire: 'сертификаты и подпись, сам ключ не едет', life: 'сертификат — год, можно отозвать',
      ex: 'Касса фитнес-бара в клубе «Сокол» подключается к серверу «Пульса». Это железка в клубе, человека рядом нет.',
      lanes: [L('pos', 'Касса бара', 'клуб «Сокол»'), L('srv', 'Сервер «Пульса»', '')],
      steps: [
        { from: 'pos', to: 'srv', t: 'TLS: привет', note: 'Касса открывает защищённое соединение.' },
        { from: 'srv', to: 'pos', t: 'сертификат сервера', reply: true, note: 'Сервер показывает свой сертификат — как в обычном HTTPS.' },
        { from: 'pos', to: 'pos', t: 'сервер настоящий?', note: 'Касса проверяет: сертификат выдан для <code>api.puls.fit</code>. Подменить сервер не выйдет.' },
        { from: 'pos', to: 'srv', t: 'сертификат кассы\n+ подпись ключом', kind: 'warn', note: 'Отличие от обычного HTTPS: касса тоже показывает сертификат и доказывает подписью, что у неё есть закрытый ключ. <b>Сам ключ по сети не едет.</b>' },
        { from: 'srv', to: 'srv', t: 'проверить сертификат', note: 'Сервер проверяет: сертификат выдал удостоверяющий центр «Пульса», он не отозван, в нём записан клуб «Сокол».' },
        { from: 'pos', to: 'srv', t: 'запросы по каналу', kind: 'ok', note: 'Каждый запрос по этому соединению — точно от этой кассы. Пароли и токены не нужны.' }
      ],
      leak: ['ok', 'Закрытый ключ не покидает кассу — по сети его не перехватить. Украли саму кассу — отзываем сертификат одного клуба, остальные работают.']
    },
    {
      v: 'hmac', t: 'Подпись HMAC', proves: 'отправитель знает общий секрет, тело не меняли', wire: 'тело и подпись, секрет не едет', life: 'пока секрет не сменят',
      ex: 'Прачечная присылает вебхук «полотенца доставлены». Любой может прислать такое письмо на наш адрес — нужна подпись.',
      lanes: [L('ln', 'Прачечная', 'шлёт вебхук'), L('srv', 'Сервер «Пульса»', '/webhooks/laundry')],
      steps: [
        { from: 'ln', to: 'ln', t: 'подпись =\nHMAC(секрет, тело)', note: 'Общий секрет знают только прачечная и «Пульс». Прачечная считает подпись от тела письма этим секретом.' },
        { from: 'ln', to: 'srv', t: 'POST /webhooks/laundry\nтело + X-Signature', kind: 'warn', note: 'По сети едут тело и подпись. <b>Секрет не едет.</b>' },
        { from: 'srv', to: 'srv', t: 'пересчитать подпись', note: 'Сервер сам считает подпись от полученного тела тем же секретом и сравнивает.' },
        { from: 'srv', to: 'ln', t: '200', reply: true, kind: 'ok', note: 'Совпало: письмо от прачечной и по дороге его не меняли. Не совпало — <code>401</code>, ничего не делаем.' }
      ],
      leak: ['warn', 'Секрет по сети не едет. Но если он утёк с сервера, письма можно подделывать: меняем секрет (какое-то время принимаем оба). От повтора старого настоящего письма подпись не спасает — нужна метка времени внутри подписи и проверка id события.']
    }
  ];
  const howAuth = {
    id: 'how-auth', title: 'Как это работает: как системы доказывают, кто они', covers: ['auth'], free: true, noReset: true,
    simple: {
      icon: '🔑', plain: 'Аутентификация — доказательство «это правда я». Можно назвать секрет, получить временный пропуск, показать сертификат или поставить подпись.',
      analogy: 'Вход в служебную часть клуба: назвать пароль охраннику (ключ), получить на ресепшене браслет на день (токен), показать паспорт (сертификат) или принести письмо с печатью (подпись). Пароль можно подслушать, браслет к вечеру перестанет работать, паспорт без владельца бесполезен.',
      tech: 'API-ключ и Basic — постоянный секрет в каждом запросе. OAuth 2.0 меняет секрет на короткоживущий токен: Client Credentials — сервер без человека, Authorization Code + PKCE — человек в приложении. mTLS — обе стороны показывают сертификаты при установке соединения. HMAC — отправитель подписывает тело общим секретом, получатель пересчитывает подпись.'
    },
    lead: ui.brief({
      situation: 'Шесть способов доказать «это я» на соседних примерах: сервис рассылок, прачечная, касса фитнес-бара, приложение тренера. У «Пульса» встречаются все шесть, но где какой — решите сами в практике.',
      todo: ['Выберите способ и пройдите схему по шагам: что едет по сети и что проверяет сервер.', 'Нажмите «А если секрет утёк?»: что сможет злоумышленник и как это закрыть.', 'У Basic и подписи HMAC внизу есть живые поля — попробуйте раскодировать пароль и подделать письмо.', 'Сравните способы в таблице.'],
      look: 'Жёлтая стрелка — по сети едет секрет, токен или подпись. Главное, на что смотреть: <b>едет ли по сети сам секрет</b> и <b>сколько он живёт</b>. Чем короче жизнь и чем реже секрет в пути, тем меньше вреда от утечки.'
    }),
    render(el) {
      let cur = 'key', leakOn = false, basicStr = 'puls:Tow3ls-2026', towels = 400, tamper = false;
      el.innerHTML = `<div class="stack">
        <div class="row"><span class="small dim">Способ:</span>${ui.seg('thrau', AUTHM.map(s => ({ v: s.v, t: s.t })), cur, 'accent')}</div>
        <div data-ex></div><div class="thr-badges" data-bd></div><div data-seq></div>
        <div class="row"><button type="button" class="btn sm" data-leak aria-pressed="false">А если секрет утёк?</button></div><div data-lk></div>
        <div data-live></div>
        <div class="eyebrow">Сравнение</div>
        ${ui.table(['Способ', 'Что доказывает', 'Что едет по сети', 'Сколько живёт'], AUTHM.map(a => [`<b>${a.t}</b>`, a.proves, a.wire, a.life]))}</div>`;
      const seqEl = TR.$('[data-seq]', el), live = TR.$('[data-live]', el);
      function drawLive() {
        if (cur === 'basic') {
          const enc = b64(basicStr);
          live.innerHTML = `<div class="thr-box"><div class="eyebrow">Живое поле · Basic</div>
            <div class="field"><label for="thr-basic">логин:пароль</label><input id="thr-basic" class="mono" type="text" value="${esc(basicStr)}" maxlength="60" data-basic></div>
            ${ui.code('Authorization: Basic ' + enc, 'text', 'что уходит в заголовке')}
            ${ui.note('warn', 'Злоумышленник видит заголовок и раскодирует', `<code>${esc(enc)}</code> → <b>${esc(unb64(enc))}</b>. Base64 — это не шифр, а способ записать байты буквами. Защищает только HTTPS.`)}</div>`;
        } else if (cur === 'hmac') {
          live.innerHTML = `<div class="thr-box"><div class="eyebrow">Живое поле · подпись</div>
            <div class="thr-set">${setRow('Полотенец в письме', '', `<input class="thr-range" type="range" min="100" max="900" step="50" value="${towels}" data-tw aria-label="Сколько полотенец в письме">`)}
            ${setRow('По дороге', 'кто-то перехватил письмо', `<label class="toggle"><input type="checkbox" data-tamper ${tamper ? 'checked' : ''}> злоумышленник дописал ноль</label>`)}</div>
            <div data-hm></div>
            <p class="small dim">Здесь учебная подпись из 16 символов. Настоящая HMAC-SHA256 — 64 символа, принцип тот же.</p></div>`;
          drawHm();
        } else live.innerHTML = '';
      }
      function drawHm() {
        const box = TR.$('[data-hm]', live); if (!box) return;
        const SECRET = 'whsec_laundry_51';
        const sent = JSON.stringify({ eventId: 'evt_88', type: 'delivery.completed', towels }, null, 2);
        const sig = toySign(SECRET, sent);
        const got = tamper ? JSON.stringify({ eventId: 'evt_88', type: 'delivery.completed', towels: towels * 10 }, null, 2) : sent;
        const mine = toySign(SECRET, got), ok = mine === sig;
        box.innerHTML = `<div class="thr-auto"><div>${ui.code(sent + '\nX-Signature: ' + sig, 'text', 'прачечная отправила')}</div><div>${ui.code(got + '\nсчитаем сами: ' + mine, 'text', 'сервер «Пульса» получил')}</div></div>
          ${ok ? ui.note('ok', 'Подпись совпала → 200', 'Письмо настоящее и его не меняли. Подвигайте ползунок: при любом изменении тела подпись меняется целиком.') : ui.note('bad', 'Подпись не совпала → 401', 'Тело изменили, а пересчитать подпись без секрета нельзя. Сервер отклоняет письмо и ничего не делает.')}`;
      }
      function draw() {
        const a = AUTHM.find(x => x.v === cur);
        TR.$('[data-ex]', el).innerHTML = ui.note('', 'Пример', a.ex);
        TR.$('[data-bd]', el).innerHTML = badge('Что доказывает', a.proves, 'info') + badge('Что едет по сети', a.wire, 'warn') + badge('Сколько живёт', a.life);
        seqEl.innerHTML = '';
        ui.seq(mk(seqEl), { lanes: a.lanes, steps: fitSelf(a.lanes, a.steps), title: a.t, hint: 'Нажимайте «Шаг →»: под схемой — что передаётся и что проверяется.' });
        TR.$('[data-lk]', el).innerHTML = leakOn ? ui.note(a.leak[0], 'Если утёк', a.leak[1]) : '';
        drawLive();
      }
      ui.onSeg(el, (n, v) => { if (n === 'thrau') { cur = v; draw(); } });
      TR.on(el, 'click', '[data-leak]', (e, b) => { leakOn = !leakOn; b.setAttribute('aria-pressed', String(leakOn)); draw(); });
      el.addEventListener('input', e => {
        if (e.target.matches('[data-basic]')) {
          basicStr = e.target.value;
          const enc = b64(basicStr), codes = TR.$$('pre.code', live), notes = TR.$$('.note', live);
          if (codes[0]) codes[0].innerHTML = ui.hl('Authorization: Basic ' + enc, 'text');
          if (notes[0]) notes[0].lastElementChild.innerHTML = `<code>${esc(enc)}</code> → <b>${esc(unb64(enc))}</b>. Base64 — это не шифр, а способ записать байты буквами. Защищает только HTTPS.`;
        }
        if (e.target.matches('[data-tw]')) { towels = +e.target.value; drawHm(); }
      });
      el.addEventListener('change', e => { if (e.target.matches('[data-tamper]')) { tamper = e.target.checked; drawHm(); } });
      draw();
    }
  };

  // =====================================================================
  // rest-design · 3. Ресурс, адрес, метод
  // =====================================================================
  const URLP = [
    { r: 'scheme', s: 'https://', t: 'Схема', d: 'Как ехать до сервера. <code>https</code> — шифрованный канал. Без «s» токены и пароли видит любой в Wi-Fi клуба.' },
    { r: 'host', s: 'api.puls.fit', t: 'Хост', d: 'Чей это сервер. Один хост на весь API «Пульса».' },
    { r: 'ver', s: '/v1', t: 'Версия API', d: 'Номер контракта. Когда придётся что-то сломать, появится <code>/v2</code>, а старые приложения продолжат ходить в <code>/v1</code>.' },
    { r: 'coll', s: '/lockers', t: 'Коллекция', d: 'Все шкафчики. Существительное во множественном числе, строчными буквами, слова через дефис.' },
    { r: 'id', s: '/L-017', t: 'Параметр пути', d: 'Один конкретный шкафчик. В справочнике API его пишут в фигурных скобках: <code>/lockers/{lockerId}</code>. Уберите его — получится другая вещь: вся коллекция.' },
    { r: 'coll', s: '/rentals', t: 'Вложенная коллекция', d: 'Аренды именно этого шкафчика. Вложенность показывает «чьё». Больше двух уровней читать трудно.' },
    { r: 'query', s: '?status=active&limit=20', t: 'Параметры запроса', d: 'Фильтры, сортировка, размер страницы. Они меняют выборку, а не вещь: те же аренды, только отфильтрованные. Начинаются с <code>?</code>, разделяются <code>&amp;</code>.' }
  ];
  const RACT = [
    { v: 'list', t: 'Посмотреть свободные шкафчики клуба', want: 'GET', code: 200, paths: ['/lockers?clubId=sokol&status=free', '/clubs/sokol/lockers?status=free', '/getFreeLockers?club=sokol', '/Lockers/List', '/locker?club=sokol'] },
    { v: 'rent', t: 'Взять шкафчик L-017 в аренду', want: 'POST', code: 201, paths: ['/lockers/L-017/rentals', '/rentals', '/rentLocker', '/lockers/L-017?action=rent'] },
    { v: 'one', t: 'Посмотреть одну свою аренду', want: 'GET', code: 200, paths: ['/rentals/r-5', '/getRental?id=5', '/users/1042/lockers/17/rentals/5'] },
    { v: 'extend', t: 'Продлить аренду ещё на месяц', want: 'POST', code: 201, paths: ['/rentals/r-5/extensions', '/rentals/r-5', '/rentals/r-5/extend', '/extendRental'] }
  ];
  const RVERB = /^(get|create|add|delete|del|remove|update|edit|cancel|do|make|rent|book|set|list|fetch|save|new|send|extend|return|close|open|buy|pay|change|show)(?=[A-Z_-]|$)/;
  const isVerb = sg => RVERB.test(sg.charAt(0).toLowerCase() + sg.slice(1));
  const RWORD = { lockers: 'шкафчики', rentals: 'аренды', clubs: 'клубы', extensions: 'продления', me: 'мои', users: 'пользователи', locker: 'шкафчик', rental: 'аренда' };
  const isIdSeg = (sg, prev) => /^\{[^}]+\}$/.test(sg) || /^(?:[a-z]{1,3}-)?\d+$/i.test(sg) || /^[0-9a-f]{8}-/i.test(sg) || prev === 'clubs';
  function lintPath(raw) {
    let s = String(raw || '').trim().replace(/^https?:\/\/[^/]+/i, '');
    const qi = s.indexOf('?'), query = qi >= 0 ? s.slice(qi + 1) : '';
    let path = qi >= 0 ? s.slice(0, qi) : s;
    if (path && path[0] !== '/') path = '/' + path;
    path = path.replace(/^\/v\d+(?=\/|$)/i, '');
    const segs = path.split('/').filter(Boolean), toks = [], msgs = [];
    let ids = 0;
    segs.forEach((sg, i) => {
      const prev = segs[i - 1];
      if (isIdSeg(sg, prev)) { ids++; toks.push(['id', sg, 'параметр пути']); if (/^\d+$/.test(sg)) msgs.push(['warn', `«${esc(sg)}» — номер по порядку. Соседний номер легко подобрать: наружу лучше отдавать непрозрачный id.`]); return; }
      if (isVerb(sg)) { toks.push(['verb', sg, 'глагол']); msgs.push(['bad', `«${esc(sg)}» — глагол в пути. Что сделать, говорит метод HTTP, а путь называет вещь.`]); return; }
      if (sg === 'me') { toks.push(['coll', sg, 'я — из токена']); return; }
      if (/[A-Z]/.test(sg)) msgs.push(['warn', `«${esc(sg)}» — заглавные буквы. Пути пишут строчными, слова через дефис.`]);
      if (/_/.test(sg)) msgs.push(['warn', `«${esc(sg)}» — подчёркивание. В адресах принят дефис.`]);
      if (['locker', 'rental', 'club', 'user'].includes(sg)) msgs.push(['warn', `«${esc(sg)}» — коллекцию называют во множественном числе: ${esc(sg)}s.`]);
      toks.push(['coll', sg, 'существительное']);
    });
    if (query) toks.push(['query', '?' + query, 'параметры']);
    if (/(^|&)(action|op|do|method)=/i.test(query)) msgs.push(['bad', 'Действие спрятано в параметр запроса. Выразите его методом или отдельным ресурсом.']);
    if (ids >= 3) msgs.push(['warn', 'Глубокая вложенность: три и больше id в пути. Хватит одного-двух уровней: у аренды свой уникальный id.']);
    if (segs.length && isIdSeg(segs[0])) msgs.push(['bad', 'Путь начинается с id. Сначала коллекция, потом номер.']);
    const reading = segs.map((sg, i) => isIdSeg(sg, segs[i - 1]) ? sg : isVerb(sg) ? '«' + sg + '»?' : (RWORD[sg] || sg)).join(' → ');
    return { toks, msgs, reading, query, empty: !segs.length };
  }
  const MWORD = { GET: 'покажи', POST: 'создай в', PUT: 'положи целиком в', PATCH: 'поправь', DELETE: 'удали' };
  function methodVerdict(act, m, path) {
    const ext = /\/extensions\b/.test(path);
    if (act.v === 'list' || act.v === 'one') {
      if (m === 'GET') return ['ok', 'GET — «только посмотреть». Его можно повторять и кэшировать.'];
      if (m === 'POST') return ['bad', 'POST для чтения: ответ не закэшируется, а повтор сервер считает новым действием. Читают методом GET.'];
      return ['bad', 'Этот метод меняет данные, а вы только смотрите.'];
    }
    if (act.v === 'rent') {
      if (m === 'POST') return ['ok', 'POST — «создай новое в коллекции». Номер новой аренды выдаст сервер и вернёт его в <code>Location</code>.'];
      if (m === 'GET') return ['bad', 'GET не должен ничего менять: браузер, CDN или повтор вызовут его ещё раз — и Анна снимет ещё один шкафчик.'];
      if (m === 'PUT') return ['warn', 'PUT кладёт вещь по адресу, который знает клиент. А номер новой аренды выдаёт сервер.'];
      if (m === 'PATCH') return ['warn', 'PATCH правит то, что уже есть. Аренды ещё нет — её создают.'];
      return ['bad', 'DELETE удаляет, а нам нужно создать.'];
    }
    if (m === 'POST' && ext) return ['ok', 'Продление — новый документ со своей датой и оплатой. Создаём его в коллекции продлений этой аренды.'];
    if (m === 'POST') return ['warn', 'POST подходит: продление — новое событие. Но куда? Назовите ресурс существительным: «продления» этой аренды.'];
    if (m === 'PATCH') return ['warn', 'Сработает: поменять дату конца. Но каждое продление — это оплата, а в одном поле их историю не сохранить. И повтор «+1 месяц» продлит дважды.'];
    if (m === 'PUT') return ['warn', 'PUT заменит аренду целиком — придётся прислать все поля, а забытое сотрётся.'];
    return ['bad', m === 'GET' ? 'GET ничего не меняет — продления не будет.' : 'DELETE удаляет, а нам нужно продлить.'];
  }
  const howRest = {
    id: 'how-rest', title: 'Как это работает: ресурс, адрес, метод', covers: ['nouns', 'builder'], free: true, noReset: true,
    simple: {
      icon: '🧭', plain: 'В REST адрес называет вещь, а метод говорит, что с ней сделать.',
      analogy: 'Шкафчики в раздевалке: на каждом номер, а действия всегда одни и те же — посмотреть, занять, освободить. Никто не вешает на дверцу табличку «Открыть-шкафчик-17»: номер — на дверце, действие — в руках.',
      tech: 'URL = схема + хост + версия + путь к ресурсу + параметры запроса. Путь — существительные во множественном числе (<code>/lockers</code>), строчными, через дефис. Конкретный объект — параметр пути (<code>/lockers/{lockerId}</code>). Фильтры, сортировка, страницы — в query (<code>?clubId=…</code>). Действие задаёт метод: GET, POST, PUT, PATCH, DELETE.'
    },
    lead: ui.brief({
      situation: 'Соседний пример: «Пульс» запускает аренду шкафчиков — клиент снимает шкафчик в своём клубе на месяц за 900 ₽. Нужен API: посмотреть свободные шкафчики, взять в аренду, посмотреть аренду, продлить.',
      todo: ['Нажимайте на части адреса — под ним появится, что это за часть и по каким правилам её пишут.', 'В конструкторе выберите задачу, метод и путь: из готовых вариантов или впишите свой. Подсказка сразу скажет, где существительное, где глагол, и подходит ли метод.', 'Нарочно попробуйте плохие варианты — с глаголом, заглавными буквами, действием в параметре — и прочитайте, что не так.'],
      look: 'Цвет части адреса — её роль: зелёный — ресурс (существительное), жёлтый — параметр пути, голубой — параметры запроса, красный — глагол, которому в пути не место. Строка «Читается как» — адрес, произнесённый вслух: хороший адрес звучит как фраза.'
    }),
    render(el) {
      let part = 3, act = 'list', m = 'GET', path = RACT[0].paths[0];
      el.innerHTML = `<div class="stack">
        <div class="eyebrow">Анатомия адреса · нажимайте на части</div>
        <div class="thr-url" data-url>${URLP.map((p, i) => `<button type="button" class="thr-r-${p.r}" data-p="${i}" aria-pressed="${i === part}">${esc(p.s)}</button>`).join('')}</div>
        <div data-pd></div>
        ${ui.note('', 'Путь или параметр запроса?', 'Спросите: «если это убрать, получится <b>другая вещь</b> или <b>та же, но отфильтрованная</b>?» Другая вещь — часть пути: <code>/lockers/L-017</code> и <code>/lockers</code> — шкафчик и все шкафчики. Та же, но отфильтрованная — query: <code>/lockers?status=free</code> — всё те же шкафчики, только свободные.')}
        <div class="thr-box"><div class="eyebrow">Конструктор на шкафчиках</div>
          <div class="thr-set">
            ${setRow('Задача', '', ui.seg('thract', RACT.map(a => ({ v: a.v, t: a.t })), act))}
            ${setRow('Метод', '', ui.seg('thrm', ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(x => ({ v: x, t: x })), m, 'accent'))}
            ${setRow('Путь', 'после /v1', `<input type="text" class="mono" data-path value="${esc(path)}" aria-label="Путь запроса" maxlength="90" style="width:100%">`)}
          </div>
          <div class="thr-chips" data-pre></div>
          <div data-out></div></div></div>`;
      const out = TR.$('[data-out]', el);
      function drawPart() {
        const p = URLP[part];
        TR.$('[data-pd]', el).innerHTML = ui.note('ok', p.t + ': ' + p.s, p.d);
      }
      function drawPre() {
        const a = RACT.find(x => x.v === act);
        TR.$('[data-pre]', el).innerHTML = '<span class="small dim">Готовые варианты:</span>' + a.paths.map(x => `<button type="button" class="chip mono" data-pp="${esc(x)}" aria-pressed="${x === path}">${esc(x)}</button>`).join('');
      }
      function drawOut() {
        const a = RACT.find(x => x.v === act), r = lintPath(path), v = methodVerdict(a, m, path);
        TR.$$('[data-pp]', el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pp === path)));
        if (r.empty) { out.innerHTML = ui.note('warn', 'Путь пуст', 'Впишите путь или выберите готовый вариант.'); return; }
        const pathOk = !r.msgs.some(x => x[0] === 'bad'), allOk = pathOk && v[0] === 'ok' && !r.msgs.length;
        out.innerHTML = `<div class="stack tight">
          <div class="small dim">Из чего состоит путь</div>
          <div class="thr-toks">${r.toks.map(t => `<span class="thr-r-${t[0]}" title="${esc(t[2])}">${esc(t[1])}<span class="small" style="opacity:.75"> · ${esc(t[2])}</span></span>`).join('')}</div>
          <div class="small"><span class="dim">Читается как:</span> <b>${esc(MWORD[m])}</b> ${esc(r.reading)}${r.query ? ' <span class="dim">(с фильтрами)</span>' : ''}</div>
          ${r.msgs.length ? `<ul class="checks">${r.msgs.map(x => `<li class="${x[0]}">${x[1]}</li>`).join('')}</ul>` : '<ul class="checks"><li>Путь по правилам: существительные, строчные, без глаголов.</li></ul>'}
          ${ui.note(v[0], 'Метод ' + m + ' для задачи «' + a.t + '»', v[1])}
          <div class="thr-auto">${ui.http({ cap: 'запрос', method: m, path: '/v1' + (path[0] === '/' ? '' : '/') + path })}${allOk ? ui.http({ cap: 'ответ при успехе', status: a.code, headers: a.code === 201 ? { Location: act === 'rent' ? '/v1/rentals/r-6' : '/v1/rentals/r-5/extensions/e-1' } : {} }) : `<div class="note warn"><div class="ttl">Ответ</div><div>Сначала добейтесь зелёного: путь по правилам и метод по смыслу задачи.</div></div>`}</div></div>`;
      }
      TR.on(el, 'click', '[data-p]', (e, b) => { part = +b.dataset.p; TR.$$('[data-p]', el).forEach(x => x.setAttribute('aria-pressed', String(x === b))); drawPart(); });
      TR.on(el, 'click', '[data-pp]', (e, b) => { path = b.dataset.pp; TR.$('[data-path]', el).value = path; drawOut(); });
      ui.onSeg(el, (n, v) => {
        if (n === 'thract') { act = v; path = RACT.find(x => x.v === v).paths[0]; TR.$('[data-path]', el).value = path; drawPre(); drawOut(); }
        if (n === 'thrm') { m = v; drawOut(); }
      });
      el.addEventListener('input', e => { if (e.target.matches('[data-path]')) { path = e.target.value; drawOut(); } });
      drawPart(); drawPre(); drawOut();
    }
  };

  // =====================================================================
  // rest-design · 4. Безопасные и идемпотентные методы
  // =====================================================================
  const MEXP = [
    { v: 'get', m: 'GET', path: '/v1/rentals/r-5', what: 'Посмотреть аренду шкафчика' },
    { v: 'post', m: 'POST', path: '/v1/clubs/sokol/locker-rentals', body: { months: 1 }, what: 'Взять любой свободный шкафчик на месяц', key: true },
    { v: 'put', m: 'PUT', path: '/v1/rentals/r-5/reminder', body: { daysBefore: 3 }, what: 'Напоминать за 3 дня до конца аренды' },
    { v: 'patchSet', m: 'PATCH', path: '/v1/rentals/r-5', body: { until: '2026-12-05' }, what: 'PATCH «конец аренды — 5 декабря»' },
    { v: 'patchAdd', m: 'PATCH', path: '/v1/rentals/r-5', body: { extendMonths: 1 }, what: 'PATCH «продли ещё на месяц»' },
    { v: 'del', m: 'DELETE', path: '/v1/rentals/r-5', what: 'Удалить аренду' }
  ];
  const MONTHS = ['05.11.2026', '05.12.2026', '05.01.2027', '05.02.2027'];
  const mInit = () => ({ rentals: [{ id: 'r-5', locker: 'L-017', until: MONTHS[0], reminder: null, gone: false }], paid: 90000, n: 0, log: [], hl: [] });
  function mSend(x, st, withKey) {
    st.n++; const n = st.n, r5 = st.rentals[0]; st.hl = [];
    let code, txt, changed = false;
    if (x.v === 'get') { code = r5.gone ? '404 Not Found' : '200 OK'; txt = r5.gone ? 'аренды нет' : `аренда r-5, шкафчик L-017, до ${r5.until}`; }
    if (x.v === 'post') {
      if (withKey && n > 1) { code = '201 Created'; txt = 'r-6 — сервер узнал ключ и вернул сохранённый ответ'; }
      else {
        const id = 'r-' + (5 + st.rentals.length), lk = 'L-0' + (16 + st.rentals.length + 1);
        st.rentals.push({ id, locker: lk, until: MONTHS[0], reminder: null, gone: false }); st.paid += 90000; changed = true; st.hl = [id, 'paid'];
        code = '201 Created'; txt = `аренда ${id}, шкафчик ${lk}, списано 900 ₽`;
      }
    }
    if (x.v === 'put') { code = '200 OK'; txt = 'напоминание: за 3 дня'; if (r5.reminder !== 3) { r5.reminder = 3; changed = true; st.hl = ['r-5']; } }
    if (x.v === 'patchSet') { code = '200 OK'; txt = 'конец аренды 05.12.2026'; if (r5.until !== MONTHS[1]) { r5.until = MONTHS[1]; changed = true; st.hl = ['r-5']; } }
    if (x.v === 'patchAdd') { const i = Math.min(MONTHS.indexOf(r5.until) + 1, MONTHS.length - 1); r5.until = MONTHS[i]; st.paid += 90000; changed = true; st.hl = ['r-5', 'paid']; code = '200 OK'; txt = `конец аренды ${r5.until}, списано ещё 900 ₽`; }
    if (x.v === 'del') { if (!r5.gone) { r5.gone = true; changed = true; st.hl = ['r-5']; code = '204 No Content'; txt = 'удалено'; } else { code = '404 Not Found'; txt = 'такой аренды уже нет'; } }
    const kind = n === 1 ? (changed ? 'warn' : 'ok') : (changed ? 'bad' : 'ok');
    st.log.push({ n, line: `#${n} ${x.m} ${x.path}${withKey && x.key ? '  Idempotency-Key: 4d2a…' : ''}`, res: `${code} · ${txt}`, kind, changed });
    return changed;
  }
  const howMethods = {
    id: 'how-methods', title: 'Как это работает: безопасные и идемпотентные методы', covers: ['props', 'cancel'], free: true, noReset: true,
    simple: {
      icon: '🔁', plain: 'Сеть рвётся, и приложение повторяет запрос. Важно, что станет на сервере после повтора: ничего, то же самое или ещё одна покупка.',
      analogy: 'Шкафчик в раздевалке. Заглянуть, свободен ли он, — сколько угодно раз. Повесить табличку «занят Анной» трижды — табличка всё равно одна. А трижды сказать «дайте шкафчик» — получите три шкафчика и три чека.',
      tech: '<b>Безопасный</b> метод не меняет состояние сервера. <b>Идемпотентный</b> — повтор оставляет сервер в том же состоянии, что и один вызов. Ответ при повторе может отличаться (было 204, стало 404) — смотрят на итог на сервере, а не на ответ. Свойства задаёт RFC 9110 §9.2.'
    },
    lead: ui.brief({
      situation: 'Анна снимает шкафчик L-017 в клубе «Сокол»: аренда r-5, до 5 ноября, уже оплачено 900 ₽. В раздевалке плохой Wi-Fi: ответы теряются, и приложение повторяет запросы. Проверим опытом, какие запросы переживают повтор.',
      todo: ['Выберите запрос и нажмите «Отправить» три раза. Смотрите на состояние сервера справа после каждого раза.', 'Когда запрос отправлен трижды, в таблице внизу появится наблюдение. Проведите опыты для всех запросов, включая оба PATCH.', 'Посмотрите блок «Три способа закрыть аренду»: что узнаёт Анна из ответа и что остаётся в истории.'],
      look: 'Слева — журнал: что ушло и что ответил сервер. Справа — состояние на сервере: аренды и сколько списано с карты. Жёлтым подсвечено то, что изменил последний запрос. В журнале красная строка — повтор что-то изменил, зелёная — повтор ничего не изменил.'
    }),
    render(el) {
      let cur = 'get', withKey = false, st = mInit();
      const obs = {};
      el.innerHTML = `<div class="stack">
        <div class="row"><span class="small dim">Запрос:</span>${ui.seg('thrmx', MEXP.map(x => ({ v: x.v, t: `${x.m}${x.v === 'patchSet' ? ' «поставь»' : x.v === 'patchAdd' ? ' «прибавь»' : ''}` })), cur, 'accent')}</div>
        <div data-req></div>
        <div class="row"><button type="button" class="btn primary sm" data-send>Отправить</button><button type="button" class="btn ghost sm" data-again>⟲ Сначала</button><span class="small dim tnum" data-cnt></span><span data-key></span></div>
        <div class="thr-auto"><div><div class="small dim">Журнал</div><div class="thr-log" data-log></div></div><div><div class="small dim">Состояние на сервере</div><div class="thr-state" data-st></div></div></div>
        <div data-obs></div>
        <div class="eyebrow">Три способа закрыть аренду</div><div data-close></div></div>`;
      const x = () => MEXP.find(e => e.v === cur);
      function drawReq() {
        const e = x();
        TR.$('[data-req]', el).innerHTML = `<div class="thr-auto">${ui.http({ cap: e.what, method: e.m, path: e.path, headers: e.body ? Object.assign({ 'Content-Type': e.m === 'PATCH' ? 'application/merge-patch+json' : 'application/json' }, withKey && e.key ? { 'Idempotency-Key': '4d2a…' } : {}) : {}, body: e.body || null })}</div>`;
        TR.$('[data-key]', el).innerHTML = e.key ? `<label class="toggle"><input type="checkbox" data-k ${withKey ? 'checked' : ''}> с <code>Idempotency-Key</code></label>` : '';
      }
      function drawState() {
        TR.$('[data-cnt]', el).textContent = `отправлено ${st.n} из 3`;
        TR.$('[data-send]', el).disabled = st.n >= 3;
        TR.$('[data-log]', el).innerHTML = st.log.length ? st.log.map(l => `<span class="dim">${esc(l.line)}</span>\n<span class="${l.kind}">  → ${esc(l.res)}${l.n > 1 ? (l.changed ? '  · повтор изменил итог' : '  · повтор ничего не изменил') : (l.changed ? '  · данные изменились' : '  · данные не изменились')}</span>`).join('\n') : '<span class="dim">Нажмите «Отправить».</span>';
        TR.$('[data-st]', el).innerHTML = st.rentals.map(r => `<div class="thr-st ${st.hl.includes(r.id) ? 'hl' : ''} ${r.gone ? 'gone' : ''}"><b>${r.id} · шкафчик ${r.locker}</b><span class="small">${r.gone ? 'удалена' : `до ${r.until}${r.reminder ? ` · напомнить за ${r.reminder} дня` : ''}`}</span></div>`).join('')
          + `<div class="thr-st ${st.hl.includes('paid') ? 'hl' : ''}"><span class="small dim">Списано с карты Анны</span><b class="mono">${TR.fmtRub(st.paid)}</b></div>`;
      }
      function drawObs() {
        const rows = [['GET', ['get']], ['POST', ['post']], ['PUT', ['put']], ['PATCH', ['patchSet', 'patchAdd']], ['DELETE', ['del']]];
        const cell = (ids, k) => {
          const got = ids.map(i => obs[i]).filter(Boolean);
          if (got.length < ids.length) return got.length ? '<span class="dim">ещё один опыт</span>' : '<span class="dim">—</span>';
          const vals = got.map(g => g[k]);
          if (vals.every(Boolean)) return '<span class="status bad">да</span>';
          if (vals.every(v => !v)) return '<span class="status ok">нет</span>';
          return '<span class="status warn">смотря что в теле</span>';
        };
        const done = rows.every(r => r[1].every(i => obs[i]));
        TR.$('[data-obs]', el).innerHTML = `<div class="eyebrow">Что вы наблюдали</div>${ui.table(['Метод', 'Первый вызов изменил данные?', 'Повтор изменил итог?'], rows.map(r => [ui.mth(r[0]), cell(r[1], 'first'), cell(r[1], 'rep')]), {}).replace('class="tbl"', 'class="tbl thr-mx"')}
          <p class="small muted">Первый столбец — проверка на <b>безопасность</b>: безопасный метод не меняет ничего даже с первого раза. Второй — на <b>идемпотентность</b>: идемпотентный можно повторять, итог не изменится.${withKey ? '' : ' Попробуйте POST ещё раз — с <code>Idempotency-Key</code>.'}</p>
          ${done ? ui.note('ok', 'Все опыты проведены', 'Теперь вы видели своими глазами, какие запросы можно спокойно повторять, а какие — только с ключом идемпотентности. Сформулируйте вывод сами — он понадобится в практике.') : ''}`;
      }
      function reset() { st = mInit(); drawState(); }
      TR.on(el, 'click', '[data-send]', () => {
        if (st.n >= 3) return;
        const e = x(), ch = mSend(e, st, withKey);
        if (st.n === 1) obs['_' + cur] = { first: ch };
        if (st.n === 3) { const rep = st.log.slice(1).some(l => l.changed); const key = cur === 'post' && withKey ? 'postKey' : cur; obs[key] = { first: (obs['_' + cur] || {}).first, rep }; drawObs(); }
        drawState();
      });
      TR.on(el, 'click', '[data-again]', reset);
      ui.onSeg(el, (n, v) => { if (n === 'thrmx') { cur = v; drawReq(); reset(); } });
      el.addEventListener('change', e => { if (e.target.matches('[data-k]')) { withKey = e.target.checked; drawReq(); reset(); } });
      drawReq(); drawState(); drawObs();

      // три способа закрыть аренду
      const CL = [
        { v: 'del', t: 'DELETE /rentals/r-5' }, { v: 'patch', t: 'PATCH /rentals/r-5' }, { v: 'post', t: 'POST /rentals/r-5/closure' }
      ];
      let cv = 'post', lost = false;
      const cbox = TR.$('[data-close]', el);
      cbox.innerHTML = `<div class="thr-box">
        <p class="small muted">Анна сдаёт ключ на 10 дней раньше: по правилам ей вернут 300 ₽ за неиспользованные дни. Если ключ потерян — штраф 500 ₽. Закрыть аренду в API можно тремя способами.</p>
        <div class="thr-set">${setRow('Способ', '', ui.seg('thrcl', CL.map(c => ({ v: c.v, t: c.t })), cv, 'accent'))}${setRow('Ключ', '', ui.seg('thrkey', [{ v: 'ok', t: 'сдан' }, { v: 'lost', t: 'потерян — штраф 500 ₽' }], 'ok'))}</div>
        <div data-cv></div></div>`;
      function drawClose() {
        const fine = lost ? { amount: 50000, currency: 'RUB', reason: 'key-lost' } : null;
        let req, res, rows;
        if (cv === 'del') {
          req = ui.http({ cap: 'запрос', method: 'DELETE', path: '/v1/rentals/r-5' }); res = ui.http({ cap: 'ответ', status: 204 });
          rows = [['bad', 'Что узнала Анна', `Ничего: тело пустое. Сколько вернут${lost ? ' и что будет штраф 500 ₽' : ''}, она узнает из SMS банка.`], ['warn', 'Что осталось в истории', 'Аренда исчезла или спрятана. Когда и почему её закрыли, нужно искать по логам.'], ['ok', 'Повтор', 'Второй DELETE получит 404 — итог тот же. Но приложение должно понимать, что 404 после потерянного ответа значит «уже удалено».']];
        } else if (cv === 'patch') {
          req = ui.http({ cap: 'запрос', method: 'PATCH', path: '/v1/rentals/r-5', headers: { 'Content-Type': 'application/merge-patch+json' }, body: { status: 'closed' } });
          res = ui.http({ cap: 'ответ', status: 200, body: { id: 'r-5', locker: 'L-017', status: 'closed', until: '2026-10-26' } });
          rows = [['warn', 'Что узнала Анна', `Новый статус. Возврат${lost ? ' и штраф' : ''} придётся дописывать полями в саму аренду — карточка аренды разрастается.`], ['warn', 'Что осталось в истории', 'Аренда на месте со статусом <code>closed</code>. Но через PATCH можно прислать любой статус: сервер должен сам запрещать переходы вроде <code>closed → active</code>.'], ['ok', 'Повтор', 'Тот же статус второй раз ничего не меняет.']];
        } else {
          req = ui.http({ cap: 'запрос', method: 'POST', path: '/v1/rentals/r-5/closure', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'b81e…' }, body: { keyReturned: !lost } });
          res = ui.http({ cap: 'ответ', status: 201, headers: { Location: '/v1/rentals/r-5/closure' }, body: { closedAt: '2026-10-26T18:40:00+03:00', refund: { amount: 30000, currency: 'RUB' }, fine } });
          rows = [['ok', 'Что узнала Анна', `Всё сразу: когда закрыли, сколько вернут${lost ? ', какой штраф и за что' : ', штрафа нет'}.`], ['ok', 'Что осталось в истории', 'Закрытие — отдельный документ со своими данными. Аренда остаётся в истории как была.'], ['warn', 'Повтор', 'POST сам по себе не идемпотентен. Спасает ключ: повтор с тем же <code>Idempotency-Key</code> вернёт тот же ответ, а без ключа сервер ответит 409 «уже закрыта».']];
        }
        TR.$('[data-cv]', cbox).innerHTML = `<div class="thr-auto"><div>${req}</div><div>${res}</div></div>${rows.map(r => ui.note(r[0], r[1], r[2])).join('')}`;
      }
      ui.onSeg(cbox, (n, v) => { if (n === 'thrcl') { cv = v; drawClose(); } if (n === 'thrkey') { lost = v === 'lost'; drawClose(); } });
      drawClose();
    }
  };

  // =====================================================================
  // rest-contract · 5. Анатомия запроса и ответа
  // =====================================================================
  const ENV = [
    { id: 'start', zone: 'Стартовая строка', line: () => '<span class="mt">POST</span> /v1/memberships/m-71/freezes HTTP/1.1', d: 'Метод (что сделать), путь (с чем) и версия протокола. По этой строке любой посредник — балансировщик, кэш, журнал — понимает, что за запрос.' },
    { id: 'host', zone: 'Заголовки', k: 'Host', v: 'api.puls.fit', d: 'Какому сайту письмо. На одном сервере может жить много сайтов.' },
    { id: 'auth', k: 'Authorization', v: 'Bearer eyJhbGciOi…', d: 'Пропуск. Внутри токена подписью заверено, кто вы. Поэтому id клиента в теле не нужен: сервер берёт его из токена, и подделать его нельзя.', brk: 'noAuth' },
    { id: 'ct', k: 'Content-Type', v: 'application/json', d: 'В каком формате тело. Без него сервер не знает, как его читать.', brk: 'noCT' },
    { id: 'acc', k: 'Accept', v: 'application/json', d: 'В каком формате клиент хочет получить ответ.' },
    { id: 'idem', k: 'Idempotency-Key', v: '3c9a6f1e-…', d: 'Номер операции. Повтор с тем же номером сервер узнает и не создаст вторую заморозку.', brk: 'retry' },
    { id: 'body', zone: 'Тело (после пустой строки)', d: 'Данные операции — только то, что решает клиент: даты заморозки. Кто клиент, сколько дней заморозки осталось в году, можно ли морозить — решает сервер.' }
  ];
  const BRK = [
    { v: 'noAuth', t: 'без Authorization' }, { v: 'noCT', t: 'без Content-Type' }, { v: 'badDate', t: 'дата «12.10.2026»' }, { v: 'client', t: 'clientId в теле' }, { v: 'retry', t: 'повтор без Idempotency-Key' }
  ];
  function anatomyReply(b) {
    const P = (type, title, status, detail, extra) => Object.assign({ type: 'https://api.puls.fit/problems/' + type, title, status, detail }, extra || {});
    if (b.noAuth) return { status: 401, headers: { 'WWW-Authenticate': 'Bearer', 'Content-Type': 'application/problem+json' }, body: P('unauthorized', 'Нужен вход', 401, 'Токена нет — непонятно, чей абонемент морозить.'), why: ['bad', 'Сервер не знает, кто вы. Дальше он даже не смотрит. Приложение по коду 401 обновит токен или попросит войти.'] };
    if (b.noCT) return { status: 415, headers: { 'Content-Type': 'application/problem+json' }, body: P('unsupported-media-type', 'Неизвестный формат тела', 415, 'Ожидаем application/json.'), why: ['bad', 'Тело есть, а формат не указан. Сервер не гадает — отказывает.'] };
    if (b.badDate) return { status: 400, headers: { 'Content-Type': 'application/problem+json' }, body: P('validation', 'Ошибка в запросе', 400, 'Дата должна быть в формате ГГГГ-ММ-ДД.', { errors: [{ field: 'startsOn', detail: '«12.10.2026» — не дата ISO 8601' }] }), why: ['bad', '«12.10.2026» — это 12 октября или 10 декабря? Сервер не угадывает, а точно говорит, какое поле не так.'] };
    if (b.client) return { status: 400, headers: { 'Content-Type': 'application/problem+json' }, body: P('validation', 'Лишнее поле в запросе', 400, 'Клиента сервер берёт из токена.', { errors: [{ field: 'clientId', detail: 'Это поле задаёт сервер' }] }), why: ['warn', 'Если бы сервер поверил полю <code>clientId</code>, любой подставил бы чужой номер и заморозил чужой абонемент. Строгий сервер отвечает 400, мягкий молча игнорирует поле. Главное — не доверять.'] };
    const ok = { status: 201, headers: { Location: '/v1/memberships/m-71/freezes/f-12', 'Content-Type': 'application/json' }, body: { id: 'f-12', startsOn: '2026-10-12', endsOn: '2026-10-25', days: 14, freezeDaysLeft: 16, membershipEndsOn: '2027-09-14' } };
    if (b.retry) return Object.assign({}, ok, { headers: { Location: '/v1/memberships/m-71/freezes/f-13', 'Content-Type': 'application/json' }, body: Object.assign({}, ok.body, { id: 'f-13', freezeDaysLeft: 2 }), why: ['bad', 'Ответ на первый запрос потерялся, приложение повторило его без ключа. Сервер не отличил повтор от новой заморозки: создана вторая, f-13, на те же даты. Из 30 дней заморозки в году осталось 2 вместо 16.'] });
    return Object.assign(ok, { why: ['ok', 'Всё на месте: сервер знает, кто вы, понимает формат, даты в порядке. Ответ 201 и адрес новой заморозки в <code>Location</code>.'] });
  }
  const PHONES = [
    { id: 'ekb', t: 'Телефон тренера', sub: 'Екатеринбург, UTC+5' },
    { id: 'msk', t: 'Телефон клиента', sub: 'настроен по Москве, UTC+3' },
    { id: 'srv', t: 'Сервер напоминаний', sub: 'работает в UTC' }
  ];
  const TFMT = {
    offset: { v: '2026-10-14T18:30:00+05:00', rows: { ekb: ['ok', '18:30', 'придёт вовремя'], msk: ['ok', '16:30 по Москве (18:30 в клубе)', 'придёт вовремя'], srv: ['ok', '13:30 UTC', 'напоминание за час — в 17:30 по клубу'] }, note: ['ok', 'Смещение <code>+05:00</code> говорит, чьи это 18:30. Любое устройство пересчитает момент без ошибки и при этом видно местное время клуба.'] },
    utc: { v: '2026-10-14T13:30:00Z', rows: { ekb: ['ok', '18:30', 'придёт вовремя'], msk: ['ok', '16:30 по Москве', 'придёт вовремя'], srv: ['ok', '13:30 UTC', 'напоминание вовремя'] }, note: ['warn', 'Момент точный — <code>Z</code> значит UTC. Но чтобы написать «18:30 по времени клуба», приложению придётся отдельно знать пояс клуба.'] },
    none: { v: '2026-10-14T18:30:00', rows: { ekb: ['ok', '18:30', 'повезло: пояс совпал'], msk: ['bad', '18:30 по Москве', 'придёт в 20:30 по клубу — на 2 часа позже'], srv: ['bad', '18:30 UTC', 'напоминание в 22:30 по клубу — после тренировки'] }, note: ['bad', 'Без смещения каждый читает время по-своему. Чьи это 18:30 — неизвестно, и разница между городами — часы.'] }
  };
  const howAnatomy = {
    id: 'how-anatomy', title: 'Как это работает: анатомия запроса и ответа', covers: ['request', 'formats'], free: true, noReset: true,
    simple: {
      icon: '✉️', plain: 'HTTP-запрос — это письмо в конверте: на конверте адрес и пометки, внутри — само письмо.',
      analogy: 'Заказное письмо. Первая строка — куда и что сделать («вручить лично»). Штампы на конверте — заголовки: кто отправил, на каком языке письмо, номер квитанции. Внутри — само письмо, тело. Почтальон читает только конверт, а письмо — адресат.',
      tech: 'Запрос = стартовая строка (метод, путь, версия HTTP) + заголовки (<code>Authorization</code>, <code>Content-Type</code>, <code>Accept</code>, <code>Idempotency-Key</code>…) + пустая строка + тело. Ответ = строка статуса + заголовки + тело. Кто вызывает, сервер берёт из токена, а не из тела. Время — ISO 8601 со смещением, деньги — целые копейки.'
    },
    lead: ui.brief({
      situation: 'Соседний пример: Анна замораживает абонемент на две недели — с 12 по 25 октября. Приложение отправляет <code>POST /v1/memberships/m-71/freezes</code>. Разберём это письмо по частям и посмотрим, что ответит сервер, если что-то забыть или прислать лишнее.',
      todo: ['Нажимайте на строки запроса: стартовую строку, каждый заголовок, тело. Под запросом — зачем эта часть.', 'Включайте поломки по одной и смотрите, как меняется ответ сервера справа и почему.', 'Внизу — форматы данных. Время: переключайте запись и смотрите, когда придёт клиент. Деньги: двигайте ползунок. Новое значение статуса: переключайте, как написано приложение.'],
      look: 'Слева запрос, справа ответ. Зачёркнутая красная строка — её убрала поломка, красная — в ней ошибка. Код ответа подсказывает, кто виноват: 4xx — клиент, 5xx — сервер.'
    }),
    render(el) {
      let sel = 'auth';
      const b = {};
      el.innerHTML = `<div class="stack">
        <div class="thr-chips"><span class="small dim">Поломки:</span>${BRK.map(x => `<button type="button" class="chip" data-brk="${x.v}" aria-pressed="false">${x.t}</button>`).join('')}</div>
        <div class="thr-auto"><div class="stack tight"><div class="code-cap">запрос — нажимайте на строки</div><div class="thr-env" data-env></div></div><div class="stack tight" data-res></div></div>
        <div data-why></div><div data-pexp></div>
        <div class="eyebrow">Форматы данных</div><div data-fmt></div></div>`;
      const envEl = TR.$('[data-env]', el);
      function body() {
        const o = { startsOn: b.badDate ? '12.10.2026' : '2026-10-12', endsOn: '2026-10-25' };
        if (b.client) o.clientId = 1042;
        return JSON.stringify(o, null, 2);
      }
      function draw() {
        let h = '', zone = '';
        ENV.forEach(p => {
          if (p.zone && p.zone !== zone) { zone = p.zone; h += `<div class="zone">${esc(zone)}</div>`; }
          const off = p.brk && b[p.brk];
          const bad = p.id === 'body' && (b.badDate || b.client);
          const txt = p.id === 'start' ? p.line() : p.id === 'body' ? esc(body()) : `<span class="hk">${esc(p.k)}</span>: ${esc(p.v)}`;
          h += `<button type="button" data-part="${p.id}" aria-pressed="${sel === p.id}" class="${off ? 'off' : ''} ${bad ? 'bad' : ''}">${txt}</button>`;
        });
        envEl.innerHTML = h;
        const r = anatomyReply(b);
        TR.$('[data-res]', el).innerHTML = `<div class="code-cap">ответ сервера</div>${ui.http({ status: r.status, headers: r.headers, body: r.body })}`;
        TR.$('[data-why]', el).innerHTML = ui.note(r.why[0], 'Почему ' + r.status, r.why[1]);
        const p = ENV.find(x => x.id === sel);
        TR.$('[data-pexp]', el).innerHTML = ui.note('', (p.k || p.zone) + ' — зачем', p.d);
      }
      TR.on(el, 'click', '[data-brk]', (e, btn) => { const v = btn.dataset.brk; b[v] = !b[v]; btn.setAttribute('aria-pressed', String(!!b[v])); draw(); });
      TR.on(envEl, 'click', '[data-part]', (e, btn) => { sel = btn.dataset.part; draw(); });
      draw();

      // форматы
      ui.tabs(TR.$('[data-fmt]', el), [
        {
          id: 'time', t: 'Время', render(pane) {
            let f = 'none';
            pane.innerHTML = `<div class="stack"><p class="small muted">Персональная тренировка в клубе Екатеринбурга в 18:30 по местному времени (UTC+5). Один и тот же ответ API читают три устройства.</p>
              <div class="row"><span class="small dim">Как записали <code>startsAt</code>:</span>${ui.seg('thrtf', [{ v: 'none', t: 'без смещения' }, { v: 'utc', t: 'в UTC (Z)' }, { v: 'offset', t: 'со смещением +05:00' }], f, 'accent')}</div><div data-t></div></div>`;
            const drawT = () => {
              const F = TFMT[f];
              TR.$('[data-t]', pane).innerHTML = `${ui.code('"startsAt": "' + F.v + '"', 'json')}
                ${ui.table(['Устройство', 'Что покажет', 'Итог'], PHONES.map(p => { const r = F.rows[p.id]; return [`<b>${p.t}</b><div class="small dim">${p.sub}</div>`, `<span class="mono">${r[1]}</span>`, `<span class="status ${r[0]}">${r[2]}</span>`]; }))}
                ${ui.note(F.note[0], 'Вывод', F.note[1])}`;
            };
            ui.onSeg(pane, (n, v) => { if (n === 'thrtf') { f = v; drawT(); } });
            drawT();
          }
        },
        {
          id: 'money', t: 'Деньги', render(pane) {
            let n = 1000;
            pane.innerHTML = `<div class="stack"><p class="small muted">Протеиновый коктейль в фитнес-баре — 129,90 ₽. Складываем выручку бара за день: дробными рублями и целыми копейками.</p>
              <div class="thr-set">${setRow('Продано коктейлей', '', `<input class="thr-range" type="range" min="1" max="2000" value="${n}" data-n aria-label="Сколько коктейлей продано">`)}</div><div data-m></div></div>`;
            const drawM = () => {
              let fl = 0; for (let i = 0; i < n; i++) fl += 129.9;
              const kop = n * 12990, cut = Math.floor(fl * 100) / 100, diff = Math.round((kop / 100 - cut) * 100);
              const same = fl === kop / 100;
              TR.$('[data-m]', pane).innerHTML = `<div class="grid2">${stat('Дробными рублями (float)', String(fl), same ? 'ok' : 'bad', `${n} × 129.9, сложено по одному`)}${stat('Целыми копейками', kop.toLocaleString('ru-RU') + ' коп.', 'ok', '= ' + TR.fmtRub(kop))}</div>
                ${same ? ui.note('ok', 'Пока сошлось', 'На маленьких числах дробь иногда сходится. Подвигайте ползунок: при некоторых количествах в сумме появится хвост.') : ui.note('bad', 'Хвост в сумме', `Компьютер хранит 129,9 приблизительно, и при сложении погрешность копится. Если отрезать дробь до копеек, как делают многие программы, выйдет ${cut.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽${diff ? ` — на ${diff} ${TR.plural(diff, 'копейку', 'копейки', 'копеек')} меньше` : ''}. Бухгалтерия сверяет до копейки, и такие расхождения потом ищут вручную.`)}
                ${ui.code('{ "amount": ' + kop + ', "currency": "RUB" }   ← так в API: целое число копеек и валюта', 'json')}`;
            };
            pane.addEventListener('input', e => { if (e.target.matches('[data-n]')) { n = +e.target.value; drawM(); } });
            drawM();
          }
        },
        {
          id: 'enum', t: 'Новое значение', render(pane) {
            let sv = 'grace', cl = 'strict';
            pane.innerHTML = `<div class="stack"><p class="small muted">Экран «Мой абонемент» знает статусы <code>active</code>, <code>frozen</code>, <code>expired</code>. Сервер добавил новый — <code>grace</code>: оплата просрочена, но три дня ещё пускаем. Старое приложение о нём не знает.</p>
              <div class="thr-set">${setRow('Сервер прислал', '', ui.seg('thrsv', [{ v: 'active', t: '"active"' }, { v: 'grace', t: '"grace" (новый)' }], sv, 'accent'))}${setRow('Приложение написано', '', ui.seg('thrcl2', [{ v: 'strict', t: 'строго: только известные' }, { v: 'tolerant', t: 'терпимо: есть «другое»' }, { v: 'silent', t: 'неизвестное = «действует»' }], cl, 'accent'))}</div>
              <div class="thr-auto"><div data-c></div><div data-p></div></div></div>`;
            const drawE = () => {
              const code = {
                strict: 'enum Status { active, frozen, expired }\nval s = Status.valueOf(json.status)  // нет такого → ошибка',
                tolerant: 'val s = when (json.status) {\n  "active" -> "Действует"\n  "frozen" -> "Заморожен"\n  "expired" -> "Истёк"\n  else -> "Статус обновлён"   // незнакомое — нейтрально\n}',
                silent: 'val s = if (json.status == "frozen") "Заморожен"\n        else if (json.status == "expired") "Истёк"\n        else "Действует"   // всё прочее — «действует»'
              }[cl];
              TR.$('[data-c]', pane).innerHTML = ui.code(code, 'js', 'код старого приложения') + ui.code('{ "plan": "Сеть 12 мес", "status": "' + sv + '" }', 'json', 'ответ сервера');
              let screen;
              if (sv === 'active') screen = `${ui.status('Действует', 'ok')}<div class="fine">Знакомое значение — все три варианта кода работают.</div>`;
              else if (cl === 'strict') screen = `<div class="crash"><b>Что-то пошло не так</b><br>Не удалось загрузить абонемент.</div><div class="fine">Приложение упало на незнакомом слове. Так ломаются старые версии, которых у клиентов много.</div>`;
              else if (cl === 'tolerant') screen = `${ui.status('Статус обновлён', 'warn')}<div class="fine">Нейтрально и честно. Подробности — в карточке. Приложение работает.</div>`;
              else screen = `${ui.status('Действует', 'ok')}<div class="fine" style="color:var(--bad)">Хуже падения: Анна думает, что всё оплачено, а через три дня турникет её не пустит.</div>`;
              TR.$('[data-p]', pane).innerHTML = `<div class="thr-phone"><div class="bar"></div><div class="ttl">Мой абонемент</div><div class="small muted">Сеть 12 мес</div>${screen}</div>`;
            };
            ui.onSeg(pane, (n, v) => { if (n === 'thrsv') sv = v; if (n === 'thrcl2') cl = v; drawE(); });
            drawE();
          }
        }
      ], 'time');
    }
  };

  // =====================================================================
  // rest-contract · 6. Коды ответа и ошибки RFC 9457
  // =====================================================================
  const LIGHTS = [
    { c: 2, t: '2xx', name: 'Успех', who: 'Никто не виноват — всё получилось.', retry: 'Повторять незачем.', codes: [['200', 'готово, вот данные'], ['201', 'создано, адрес — в Location'], ['202', 'принято, сделаем позже'], ['204', 'готово, показать нечего']], app: 'Показывает результат.' },
    { c: 3, t: '3xx', name: 'Вам в другое место', who: 'Никто не виноват.', retry: 'Клиент сам идёт по адресу из <code>Location</code> или берёт свою сохранённую копию (304).', codes: [['301', 'переехало навсегда'], ['304', 'не изменилось — берите свою копию']], app: 'Обычно это делают браузер и библиотека сами.' },
    { c: 4, t: '4xx', name: 'Ошибка клиента', who: 'Клиент: прислал не то, не тот, не туда или не вовремя.', retry: 'Повторять тот же запрос бесполезно — нужно что-то исправить. Исключение — 429: подождать и повторить.', codes: [['400', 'запрос не прочитать'], ['401', 'не знаю, кто вы'], ['403', 'знаю, но нельзя'], ['404', 'такого нет'], ['409', 'мешает текущее состояние'], ['412', 'версия устарела'], ['422', 'не позволяют правила'], ['429', 'слишком часто']], app: 'Объясняет человеку, что не так, или исправляет запрос.' },
    { c: 5, t: '5xx', name: 'Ошибка сервера', who: 'Сервер или сервис, который он вызывал.', retry: 'Можно повторить позже, с паузой. POST — только с ключом идемпотентности.', codes: [['500', 'ошибка в нашем коде'], ['502', 'сервис за нами ответил мусором'], ['503', 'временно недоступны'], ['504', 'сервис за нами не ответил вовремя']], app: '«Попробуйте позже». Мониторинг будит дежурного.' }
  ];
  const TREE = [
    { id: 'rate', q: 'Клиент спрашивает не слишком часто?', sub: 'лимит частоты', no: 429 },
    { id: 'auth', q: 'Известно, кто это?', sub: 'токен есть и не истёк', no: 401 },
    { id: 'perm', q: 'Этой роли можно такое действие?', sub: 'клиент, тренер, администратор', no: 403 },
    { id: 'ct', q: 'Формат тела понятен?', sub: 'Content-Type', no: 415 },
    { id: 'parse', q: 'Запрос читается?', sub: 'JSON цел, нужные поля на месте, даты в формате', no: 400 },
    { id: 'exists', q: 'Такой объект есть и доступен этому клиенту?', sub: 'шкафчик, аренда', no: 404 },
    { id: 'state', q: 'Текущее состояние не мешает?', sub: 'не занято, версия та же', no: 409 },
    { id: 'rules', q: 'Бизнес-правила позволяют?', sub: 'абонемент, сроки, лимиты', no: 422 },
    { id: 'srv', q: 'Сервер и сервисы за ним отработали без сбоев?', sub: 'наш код, база, платёжный сервис', no: 500 }
  ];
  const PROB = {
    429: { h: { 'Retry-After': '1' }, b: ['rate-limit', 'Слишком много запросов', 'Не больше 20 запросов в секунду. Повторите через 1 с.'] },
    401: { h: { 'WWW-Authenticate': 'Bearer' }, b: ['unauthorized', 'Нужен вход', 'Токен истёк. Обновите его и повторите запрос.'] },
    403: { b: ['forbidden', 'Недостаточно прав', 'Выдавать шкафчики бесплатно может только администратор клуба.'] },
    415: { b: ['unsupported-media-type', 'Неизвестный формат тела', 'Ожидаем application/json.'] },
    400: { b: ['validation', 'Ошибка в запросе', 'Поле until должно быть датой в формате ГГГГ-ММ-ДД.'], x: { errors: [{ field: 'until', detail: '«5 ноября» — не дата ISO 8601' }] } },
    404: { b: ['not-found', 'Шкафчик не найден', 'В клубе «Сокол» нет шкафчика L-999.'] },
    409: { b: ['locker-taken', 'Шкафчик уже занят', 'Шкафчик L-017 занят до 05.11.2026. Свободные рядом: L-018, L-021.'], x: { _links: { 'free-lockers': { href: '/v1/lockers?clubId=sokol&status=free' } } } },
    422: { b: ['plan-not-allowed', 'Аренда недоступна по вашему абонементу', 'Шкафчики сдаются только с абонементом «Сеть». У вас «Дневной 3 мес».'] },
    500: { b: ['internal', 'Внутренняя ошибка', 'Мы уже разбираемся. Номер обращения: 7f3c-b31.'] }
  };
  const CSIT = [
    { t: 'Анна берёт шкафчик L-017, а его минуту назад занял Пётр', stop: 'state' },
    { t: 'Приложение просит шкафчик L-999 — такого в клубе нет', stop: 'exists' },
    { t: 'Шкафчики сдают только с абонементом «Сеть», у Анны «Дневной»', stop: 'rules' },
    { t: 'Тренер выдаёт шкафчик бесплатно — это право администратора', stop: 'perm' },
    { t: 'Приложение прислало конец аренды как «5 ноября»', stop: 'parse' },
    { t: 'Аренда оформлена', stop: null, fin: 201 }
  ];
  const FIELD_D = {
    type: 'Машиночитаемый тип ошибки — адрес-идентификатор. По нему приложение решает, что показать. Не меняется, даже если поправят текст.',
    title: 'Короткое название типа для человека. Одинаковое для всех ошибок этого типа.',
    status: 'Тот же код, что в строке статуса. Удобно, когда тело переслали отдельно, например в лог.',
    detail: 'Объяснение именно этого случая: какой шкафчик, до какого числа занят. Без внутренностей сервера.',
    instance: 'Адрес конкретного случая — по нему поддержка найдёт запрос в журналах.',
    extra: 'Свои поля — разрешены стандартом: список ошибок по полям, ссылки на следующие действия.'
  };
  function probJson(code, field) {
    const p = PROB[code]; if (!p) return '';
    const lines = [['type', `"type": "https://api.puls.fit/problems/${p.b[0]}"`], ['title', `"title": "${p.b[1]}"`], ['status', `"status": ${code}`], ['detail', `"detail": "${p.b[2]}"`], ['instance', `"instance": "/v1/lockers/L-017/rentals/req-8c41"`]];
    if (p.x) Object.entries(p.x).forEach(([k, v]) => lines.push(['extra', `"${k}": ${JSON.stringify(v)}`]));
    return '{\n' + lines.map(([f, s], i) => '  ' + (f === field ? '[[hl]]' + s + '[[/]]' : s) + (i < lines.length - 1 ? ',' : '')).join('\n') + '\n}';
  }
  const BG = [
    { v: 'ok200', t: '200 с ошибкой внутри', http: { status: 200, headers: { 'Content-Type': 'application/json' }, body: { success: false, message: 'Шкафчик занят' } }, r: [['bad', 'Приложение', 'Видит 200 и пишет «Готово!». Анна идёт к чужому шкафчику.'], ['bad', 'Мониторинг', 'Считает успехом — проблему никто не видит.'], ['bad', 'Партнёр', 'Не отличит отказ от успеха, пока не разберёт текст.']] },
    { v: 'c500', t: '500 на ошибку клиента', http: { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: 'Шкафчик занят' } }, r: [['bad', 'Приложение', '«Сервер сломался, попробуйте позже». Анна жмёт ещё раз — и снова то же.'], ['bad', 'Мониторинг', 'Будит дежурного ночью из-за обычного отказа.'], ['bad', 'Партнёр', 'Повторяет запрос снова и снова: 5xx значит «можно повторить».']] },
    { v: 'leak', t: 'наружу текст базы', http: { status: 409, headers: { 'Content-Type': 'application/problem+json' }, body: { type: 'https://api.puls.fit/problems/locker-taken', title: 'Шкафчик уже занят', status: 409, detail: 'ERROR: duplicate key value violates unique constraint "locker_rental_active_key"', trace: 'at LockerService.rent(LockerService.java:88)' } }, r: [['bad', 'Приложение', 'Показывает Анне непонятный английский текст.'], ['ok', 'Мониторинг', '409 — нормальный отказ, не авария.'], ['bad', 'Атакующий', 'Узнаёт имена таблиц, классов и строк кода — подсказки, куда бить.']] },
    { v: 'good', t: 'по RFC 9457', http: { status: 409, headers: { 'Content-Type': 'application/problem+json' }, body: { type: 'https://api.puls.fit/problems/locker-taken', title: 'Шкафчик уже занят', status: 409, detail: 'Шкафчик L-017 занят до 05.11.2026. Свободные рядом: L-018, L-021.', instance: '/v1/lockers/L-017/rentals/req-8c41', _links: { 'free-lockers': { href: '/v1/lockers?clubId=sokol&status=free' } } } }, r: [['ok', 'Приложение', 'По <code>type</code> понимает «занят» и показывает свободные шкафчики рядом.'], ['ok', 'Мониторинг', '409 — нормальный отказ, не авария.'], ['ok', 'Партнёр', '4xx не повторяет, человеку показывает <code>detail</code>.']] }
  ];
  const howCodes = {
    id: 'how-codes', title: 'Как это работает: коды ответа и ошибки RFC 9457', covers: ['codes', 'problem'], free: true, noReset: true,
    simple: {
      icon: '🚦', plain: 'Код ответа — короткий итог в первой строке: получилось; вам в другое место; ошибся клиент; сломался сервер.',
      analogy: 'Светофор у ресепшена. Зелёный — «готово» (2xx). Синий — «вам в соседнее окно» (3xx). Жёлтый — «вы что-то не так заполнили», повторять так же бесполезно (4xx). Красный — «у нас сломалось», можно прийти позже (5xx). А на бланке отказа — понятная причина, а не «ошибка 23505».',
      tech: '2xx — успех, 3xx — перенаправление или «не изменилось» (304), 4xx — ошибка клиента, 5xx — ошибка сервера (RFC 9110). Тело ошибки — <code>application/problem+json</code> по RFC 9457: <code>type</code>, <code>title</code>, <code>status</code>, <code>detail</code>, <code>instance</code> и свои поля.'
    },
    lead: ui.brief({
      situation: 'Код читают не только люди, но и программы. Приложение по коду решает, какую кнопку показать. Партнёр — повторять ли запрос. Мониторинг — будить ли дежурного. Поэтому код должен быть точным, а тело ошибки — понятным и человеку, и программе. Соседний пример — аренда шкафчиков.',
      todo: ['Нажимайте на классы светофора: чья это проблема и можно ли повторить.', 'Пройдите проводник: выберите ситуацию со шкафчиком (он сам пройдёт вопросы) или отвечайте «да / нет» сами. В конце — код и тело ошибки.', 'Нажимайте на поля problem+json. Затем сравните три плохие ошибки с хорошей: как на них реагируют приложение, мониторинг и партнёр.'],
      look: 'Проводник — типичный порядок, в котором сервер проверяет запрос. На первом «нет» проверка останавливается, и у каждого «нет» свой код. Подсвеченная строка — текущий вопрос, жёлтая — где остановились.'
    }),
    render(el) {
      let light = 4, answers = {}, fin = null, field = 'type', bg = 'ok200', anim = 0;
      el.innerHTML = `<div class="stack">
        <div class="thr-lights">${LIGHTS.map(l => `<button type="button" class="thr-light c${l.c}" data-l="${l.c}" aria-pressed="${l.c === light}"><span class="big">${l.t}</span><span class="sm">${l.name}</span></button>`).join('')}</div>
        <div data-ld></div>
        <div class="eyebrow">Проводник: какой код вернуть</div>
        <div class="thr-chips"><span class="small dim">Ситуации:</span>${CSIT.map((s, i) => `<button type="button" class="chip" data-sit="${i}" aria-pressed="false">${esc(s.t)}</button>`).join('')}</div>
        <div class="row"><button type="button" class="btn ghost sm" data-treset>⟲ Сначала</button></div>
        <div class="thr-tree" data-tree></div><div data-res></div>
        <div class="eyebrow">Плохая ошибка и хорошая · «шкафчик занят»</div>
        <div class="row">${ui.seg('thrbg', BG.map(x => ({ v: x.v, t: x.t })), bg, 'accent')}</div><div data-bg></div></div>`;
      function drawLight() {
        const l = LIGHTS.find(x => x.c === light);
        TR.$('[data-ld]', el).innerHTML = `<div class="thr-box"><div class="thr-badges">${badge('Чья проблема', l.who, l.c === 4 ? 'warn' : l.c === 5 ? 'bad' : 'ok')}${badge('Повторять?', l.retry)}${badge('Что делает приложение', l.app)}</div>
          <div class="thr-chips">${l.codes.map(c => `<span class="chip">${ui.st(c[0])} ${c[1]}</span>`).join('')}</div></div>`;
      }
      function stopAt() { for (const t of TREE) { if (answers[t.id] === 'no') return t; if (answers[t.id] !== 'yes') return null; } return 'pass'; }
      function drawTree() {
        const st = stopAt();
        let reached = true;
        TR.$('[data-tree]', el).innerHTML = TREE.map((t, i) => {
          const a = answers[t.id], isCur = reached && !a;
          const cls = a === 'yes' ? 'yes' : a === 'no' ? 'no' : isCur ? 'cur' : 'later';
          const row = `<div class="thr-q ${cls}"><span class="num">${i + 1}</span><span>${esc(t.q)}<span class="sub">${esc(t.sub)} · «нет» → ${t.no}</span></span><span class="ans">${reached ? `<button type="button" class="btn xs" data-a="${t.id}|yes" aria-pressed="${a === 'yes'}">да</button><button type="button" class="btn xs" data-a="${t.id}|no" aria-pressed="${a === 'no'}">нет</button>` : ''}</span></div>`;
          if (a !== 'yes') reached = false;
          return row;
        }).join('') + (st === 'pass' ? `<div class="thr-q cur"><span class="num">✓</span><span>Всё получилось. Что сделали?</span><span class="ans">${[[200, 'прочитали'], [201, 'создали'], [202, 'приняли в работу'], [204, 'без тела']].map(([c, t]) => `<button type="button" class="btn xs" data-fin="${c}" aria-pressed="${fin === c}">${c} ${t}</button>`).join('')}</span></div>` : '');
        const res = TR.$('[data-res]', el);
        if (st && st !== 'pass') {
          const p = PROB[st.no];
          res.innerHTML = `<div class="thr-box"><div class="row">${ui.st(st.no)} <b>${esc(p.b[1])}</b> <span class="small dim">${st.no >= 500 ? 'ошибка сервера: можно повторить позже' : st.no === 429 ? 'подождать Retry-After и повторить' : 'ошибка клиента: повтор без исправлений не поможет'}</span></div>
            <div class="thr-chips"><span class="small dim">Поля:</span>${['type', 'title', 'status', 'detail', 'instance'].concat(p.x ? ['extra'] : []).map(f => `<button type="button" class="chip mono" data-f="${f}" aria-pressed="${f === field}">${f === 'extra' ? Object.keys(p.x)[0] : f}</button>`).join('')}</div>
            ${ui.http({ status: st.no, headers: Object.assign({ 'Content-Type': 'application/problem+json' }, p.h || {}) })}
            ${ui.code(probJson(st.no, field), 'json')}
            ${ui.note('', field === 'extra' ? 'Свои поля' : field, FIELD_D[field])}</div>`;
        } else if (st === 'pass' && fin) {
          const H = { 200: [{}, { id: 'r-5', locker: 'L-017', until: '2026-11-05' }], 201: [{ Location: '/v1/rentals/r-6' }, { id: 'r-6', locker: 'L-018', until: '2026-11-05' }], 202: [{ Location: '/v1/rentals/jobs/j-3' }, { status: 'queued' }], 204: [{}, null] }[fin];
          res.innerHTML = ui.http({ status: fin, headers: H[0], body: H[1] }) + ui.note('ok', 'Успех', fin === 201 ? 'Создали новое — 201 и адрес нового в <code>Location</code>.' : fin === 202 ? 'Приняли, но ещё не сделали — 202 и адрес, где следить за статусом.' : fin === 204 ? 'Сделали, показать нечего — 204 без тела.' : 'Отдали данные — 200.');
        } else res.innerHTML = '';
      }
      function drawBg() {
        const x = BG.find(b => b.v === bg);
        TR.$('[data-bg]', el).innerHTML = `<div class="thr-auto"><div>${ui.http(x.http)}</div><div class="stack tight">${x.r.map(r => ui.note(r[0], r[1], r[2])).join('')}</div></div>`;
      }
      function play(i) {
        const s = CSIT[i], my = ++anim;
        answers = {}; fin = null; field = 'type'; drawTree();
        let k = 0;
        const stepIt = () => {
          if (my !== anim || !el.isConnected) return;
          const t = TREE[k];
          if (!t) { fin = s.fin; drawTree(); return; }
          answers[t.id] = s.stop === t.id ? 'no' : 'yes'; drawTree();
          if (s.stop === t.id) return;
          k++; setTimeout(stepIt, 260);
        };
        setTimeout(stepIt, 200);
      }
      TR.on(el, 'click', '[data-l]', (e, b) => { light = +b.dataset.l; TR.$$('[data-l]', el).forEach(x => x.setAttribute('aria-pressed', String(x === b))); drawLight(); });
      TR.on(el, 'click', '[data-a]', (e, b) => {
        anim++;
        const [id, v] = b.dataset.a.split('|'), i = TREE.findIndex(t => t.id === id);
        TREE.slice(i).forEach(t => { delete answers[t.id]; });
        answers[id] = v; fin = null; field = 'type'; drawTree();
      });
      TR.on(el, 'click', '[data-fin]', (e, b) => { fin = +b.dataset.fin; drawTree(); });
      TR.on(el, 'click', '[data-f]', (e, b) => { field = b.dataset.f; drawTree(); });
      TR.on(el, 'click', '[data-sit]', (e, b) => { TR.$$('[data-sit]', el).forEach(x => x.setAttribute('aria-pressed', String(x === b))); play(+b.dataset.sit); });
      TR.on(el, 'click', '[data-treset]', () => { anim++; answers = {}; fin = null; drawTree(); });
      ui.onSeg(el, (n, v) => { if (n === 'thrbg') { bg = v; drawBg(); } });
      drawLight(); drawTree(); drawBg();
    }
  };

  // =====================================================================
  // hard-1 · 7. ETag, If-Match, PUT и PATCH
  // =====================================================================
  const ROOM0 = { name: 'Зал 2', capacity: 20, description: 'Йога и пилатес. Коврики у стены.' };
  const EDITS = { a: { k: 'description', v: 'Йога и пилатес. Коврики и блоки — у стены.', t: 'новое описание' }, b: { k: 'capacity', v: 18, t: 'мест: 18' } };
  const ADM = { a: { t: 'Админ А', sub: 'ресепшен: уточняет описание' }, b: { t: 'Админ Б', sub: 'управляющий: два места под стеллаж' } };
  const PROF = { fullName: 'Мария Лис', phone: '+79267770202', photoUrl: 'https://cdn.puls.fit/t/maria-old.jpg', bio: 'Сайкл и функциональный тренинг, 8 лет опыта.' };
  const PMOD = {
    put: { t: 'PUT', req: { method: 'PUT', path: '/v1/trainers/t-12/profile', headers: { 'Content-Type': 'application/json', 'If-Match': '"5"' }, body: { photoUrl: 'https://cdn.puls.fit/t/maria-new.jpg' } }, note: ['bad', 'Имя, телефон и описание стёрты', 'PUT — «вот ресурс целиком, положи его на это место». Чего нет в теле, того нет и в ресурсе. Честный сервер ответит 422, если поле обязательное, но не станет молча «додумывать».'] },
    patch: { t: 'PATCH', req: { method: 'PATCH', path: '/v1/trainers/t-12/profile', headers: { 'Content-Type': 'application/merge-patch+json', 'If-Match': '"5"' }, body: { photoUrl: 'https://cdn.puls.fit/t/maria-new.jpg' } }, note: ['ok', 'Поменялось только фото', 'JSON Merge Patch (RFC 7396): поля из тела заменяются, остальные не трогаются.'] },
    pnull: { t: 'PATCH с null', req: { method: 'PATCH', path: '/v1/trainers/t-12/profile', headers: { 'Content-Type': 'application/merge-patch+json', 'If-Match': '"5"' }, body: { photoUrl: null } }, note: ['warn', 'Фото удалено', 'В merge-patch <code>null</code> — команда «удалить поле». А поле, которого нет в теле, не трогается. <code>{}</code> не меняет ничего.'] }
  };
  function profAfter(m) {
    const k = Object.keys(PROF);
    const val = f => m === 'put' ? (f === 'photoUrl' ? 'https://cdn.puls.fit/t/maria-new.jpg' : null) : m === 'patch' ? (f === 'photoUrl' ? 'https://cdn.puls.fit/t/maria-new.jpg' : PROF[f]) : (f === 'photoUrl' ? undefined : PROF[f]);
    const lines = k.map(f => { const v = val(f); if (v === undefined) return null; const s = `"${f}": ${JSON.stringify(v)}`; return v === PROF[f] ? s : (v === null ? '[[bad]]' + s + '[[/]]' : '[[ok]]' + s + '[[/]]'); }).filter(Boolean);
    return '{\n  ' + lines.join(',\n  ') + '\n}';
  }
  const ET_LANES = [L('a', 'Админ А', 'ресепшен'), L('b', 'Админ Б', 'управляющий'), L('api', 'API «Пульса»', 'карточка «Зал 2»')];
  const howEtag = {
    id: 'how-etag', title: 'Как это работает: ETag, If-Match, PUT и PATCH', covers: ['etag-patch'], free: true, noReset: true,
    simple: {
      icon: '📝', plain: 'Когда двое правят одну карточку, второй не должен молча затереть первого. Сервер выдаёт номер версии и принимает правку, только если версия не изменилась.',
      analogy: 'Табличка с описанием зала у двери. Чтобы её поменять, вы берёте у управляющего текущую — на ней номер редакции. Принесли правку «к редакции 3», а висит уже 4 — вам скажут: «сначала посмотрите свежую, её уже поправили».',
      tech: 'Сервер отдаёт <code>ETag: "3"</code> — версию ресурса. Клиент пишет с условием <code>If-Match: "3"</code>. Версия на сервере другая → <code>412 Precondition Failed</code>, ничего не записано. Сервер требует условие, а его нет → <code>428</code>. Это оптимистическая блокировка. <code>PUT</code> заменяет ресурс целиком, <code>PATCH</code> с <code>application/merge-patch+json</code> — только присланные поля.'
    },
    lead: ui.brief({
      situation: 'Соседний пример — карточка «Зал 2» клуба «Сокол» в веб-кабинете. Админ А уточняет описание: «Коврики и блоки — у стены». В это же время управляющий, Админ Б, уменьшает число мест с 20 до 18: два места заняли под стеллаж. Оба открыли карточку до того, как другой сохранил.',
      todo: ['В лаборатории выполните по порядку: А открывает → Б открывает → А правит и сохраняет → Б правит и сохраняет. Сначала с выключенной проверкой версии.', 'Нажмите «Сначала», включите «Сервер проверяет If-Match» и повторите. Что получил Б? Что ему делать дальше?', 'Ниже переключайте PUT и PATCH на профиле тренера и сравните профиль до и после.', 'В самом низу — то же самое по шагам на схеме.'],
      look: 'Слева и справа — экраны двух администраторов, в середине — карточка на сервере и её версия (ETag). Зелёным в карточке — сохранённая правка, красным — правка, которая молча пропала. В журнале — запросы и ответы по порядку.'
    }),
    render(el) {
      let cond = false, S;
      const reset = () => { S = { ver: 3, card: TR.clone(ROOM0), a: { copy: null, ver: null, edited: false, saved: null }, b: { copy: null, ver: null, edited: false, saved: null }, log: [], got412: false }; };
      reset();
      el.innerHTML = `<div class="stack">
        <div class="row"><label class="toggle"><input type="checkbox" data-cond> Сервер проверяет <code>If-Match</code></label><button type="button" class="btn ghost sm" data-er>⟲ Сначала</button></div>
        <div class="thr-lab3" data-lab></div>
        <div data-verdict></div>
        <div><div class="small dim">Журнал</div><div class="thr-log" data-elog></div></div>
        <div class="eyebrow">PUT или PATCH · тренер Мария Лис меняет только фото</div>
        <div class="row">${ui.seg('thrpm', Object.entries(PMOD).map(([v, x]) => ({ v, t: x.t })), 'put', 'accent')}</div><div data-pm></div>
        <div class="eyebrow">То же по шагам</div><div data-walk></div></div>`;
      const lab = TR.$('[data-lab]', el);
      const kv = (card, base, mark) => `<div class="thr-kv">${['name', 'capacity', 'description'].map(k => `<span class="k">${k === 'name' ? 'название' : k === 'capacity' ? 'мест' : 'описание'}</span><span class="${mark && mark[k] || ''}">${esc(String(card[k]))}</span>`).join('')}</div>`;
      function admHTML(id) {
        const a = S[id], e = EDITS[id];
        const mark = a.copy && a.edited ? { [e.k]: 'chg' } : null;
        return `<div class="thr-adm"><h4>${ADM[id].t}</h4><div class="small dim">${ADM[id].sub}</div>
          ${a.copy ? `<div class="small dim">копия версии <b class="mono">"${a.ver}"</b></div>${kv(a.copy, null, mark)}` : '<div class="small dim">Карточка не открыта.</div>'}
          <div class="btns"><button type="button" class="btn sm" data-ea="${id}|get">1. Открыть (GET)</button>
          <button type="button" class="btn sm" data-ea="${id}|edit" ${a.copy && !a.edited ? '' : 'disabled'}>2. Правка: ${esc(e.t)}</button>
          <button type="button" class="btn sm primary" data-ea="${id}|put" ${a.copy && a.edited && a.saved !== 200 ? '' : 'disabled'}>3. Сохранить (PUT${cond ? ', If-Match' : ''})</button></div></div>`;
      }
      function draw() {
        const hasA = S.card.description === EDITS.a.v, hasB = S.card.capacity === EDITS.b.v;
        const lostA = S.a.saved === 200 && !hasA, lostB = S.b.saved === 200 && !hasB;
        const mark = { description: hasA ? 'chg' : lostA ? 'lost' : '', capacity: hasB ? 'chg' : lostB ? 'lost' : '' };
        lab.innerHTML = admHTML('a') + `<div class="thr-adm srv"><h4>Сервер · «Зал 2»</h4><div class="small dim">текущая версия <b class="mono">ETag: "${S.ver}"</b></div>${kv(S.card, null, mark)}
          ${lostA ? '<div class="small" style="color:var(--bad)">Правка А пропала: её затёрла старая копия Б.</div>' : ''}${lostB ? '<div class="small" style="color:var(--bad)">Правка Б пропала.</div>' : ''}</div>` + admHTML('b');
        let v = '';
        if (lostA || lostB) v = ui.note('bad', 'Потерянное обновление', 'Оба администратора видели «200 OK», но одна правка молча исчезла. Последний сохранивший затёр первого своей старой копией. Никто не узнает, пока клиенты не придут в зал.');
        else if (S.got412 && !(hasA && hasB)) v = ui.note('warn', 'Сервер отказал: 412', 'Копия Б устарела — на сервере уже другая версия. Ничего не затёрто. Б должен перечитать карточку (снова «Открыть»), увидеть правку А, заново внести свою и сохранить уже с новой версией.');
        else if (hasA && hasB) v = ui.note('ok', 'Обе правки на месте', S.got412 ? 'Сервер не дал записать старую копию, Б перечитал карточку и наложил правку поверх свежей версии.' : 'Правки не пересеклись по времени — или каждый работал со свежей копией.');
        TR.$('[data-verdict]', el).innerHTML = v;
        TR.$('[data-elog]', el).innerHTML = S.log.length ? S.log.join('\n') : '<span class="dim">Начните: «Админ А → 1. Открыть».</span>';
      }
      TR.on(el, 'click', '[data-ea]', (e, b) => {
        const [id, act] = b.dataset.ea.split('|'), a = S[id], who = ADM[id].t;
        if (act === 'get') { a.copy = TR.clone(S.card); a.ver = S.ver; a.edited = false; a.saved = null; S.log.push(`<span class="dim">${who}: GET /v1/rooms/room-2</span>\n<span class="ok">  → 200 OK · ETag: "${S.ver}"</span>`); }
        if (act === 'edit') { a.copy[EDITS[id].k] = EDITS[id].v; a.edited = true; S.log.push(`<span class="dim">${who}: правит у себя на экране — ${esc(EDITS[id].t)}</span>`); }
        if (act === 'put') {
          const hdr = cond ? `  If-Match: "${a.ver}"` : '';
          if (cond && a.ver !== S.ver) { S.got412 = true; a.saved = 412; S.log.push(`<span class="dim">${who}: PUT /v1/rooms/room-2${hdr}</span>\n<span class="warn">  → 412 Precondition Failed · на сервере уже "${S.ver}"</span>`); }
          else { S.card = TR.clone(a.copy); S.ver++; a.ver = S.ver; a.saved = 200; S.log.push(`<span class="dim">${who}: PUT /v1/rooms/room-2${hdr} · вся карточка из своей копии</span>\n<span class="ok">  → 200 OK · ETag: "${S.ver}"</span>`); }
        }
        draw();
      });
      el.addEventListener('change', e => { if (e.target.matches('[data-cond]')) { cond = e.target.checked; reset(); draw(); } });
      TR.on(el, 'click', '[data-er]', () => { reset(); draw(); });
      draw();
      const drawPm = m => { const x = PMOD[m]; TR.$('[data-pm]', el).innerHTML = `<div class="thr-auto"><div>${ui.code(JSON.stringify(PROF, null, 2), 'json', 'профиль до')}${ui.http(Object.assign({ cap: 'запрос' }, x.req))}</div><div>${ui.code(profAfter(m), 'json', 'профиль после')}${ui.note(x.note[0], x.note[1], x.note[2])}</div></div>`; };
      ui.onSeg(el, (n, v) => { if (n === 'thrpm') drawPm(v); });
      drawPm('put');
      walk(TR.$('[data-walk]', el), {
        name: 'thretw', laneW: 180, scenarios: [
          {
            id: 'none', t: 'Без условия', lanes: ET_LANES, sumKind: 'bad', sum: 'Правка А пропала молча. Оба получили 200 — и оба уверены, что всё сохранено.',
            steps: [
              { from: 'a', to: 'api', t: 'GET /rooms/room-2', note: 'А открывает карточку: 20 мест, старое описание.' },
              { from: 'b', to: 'api', t: 'GET /rooms/room-2', note: 'Б открывает ту же карточку — копия такая же.' },
              { from: 'a', to: 'api', t: 'PUT {новое описание, 20}', note: 'А сохраняет. PUT отправляет карточку целиком.' },
              { from: 'api', to: 'a', t: '200', reply: true, kind: 'ok' },
              { from: 'b', to: 'api', t: 'PUT {старое описание, 18}', kind: 'warn', note: 'Б сохраняет свою копию — в ней <b>старое</b> описание, ведь Б открыл карточку до правки А.' },
              { from: 'api', to: 'b', t: '200', reply: true, kind: 'bad', note: 'Сервер не знает, что копия Б устарела, и записывает её поверх.' },
              { from: 'a', to: 'api', box: true, kind: 'bad', t: 'в базе: старое описание, 18 мест', note: 'Потерянное обновление: правки А больше нет.' }
            ]
          },
          {
            id: 'etag', t: 'С If-Match', lanes: ET_LANES, sumKind: 'ok', sum: 'Обе правки на месте. Сервер не дал записать устаревшую копию, а Б перечитал карточку и сохранил поверх свежей версии.',
            steps: [
              { from: 'a', to: 'api', t: 'GET → ETag "3"', note: 'Вместе с карточкой сервер отдаёт её версию — ETag "3".' },
              { from: 'b', to: 'api', t: 'GET → ETag "3"', note: 'У Б та же версия "3".' },
              { from: 'a', to: 'api', t: 'PUT · If-Match: "3"', note: 'А сохраняет с условием: «запиши, только если версия всё ещё 3».' },
              { from: 'api', to: 'a', t: '200 · ETag "4"', reply: true, kind: 'ok', note: 'Версия совпала — правка принята, версия стала "4".' },
              { from: 'b', to: 'api', t: 'PUT · If-Match: "3"', kind: 'warn', note: 'Б сохраняет копию версии "3".' },
              { from: 'api', to: 'b', t: '412 Precondition Failed', reply: true, kind: 'warn', note: 'На сервере уже "4". Сервер отказывает и ничего не записывает.' },
              { from: 'b', to: 'api', t: 'GET → ETag "4"', note: 'Кабинет Б перечитывает карточку и показывает: «пока вы правили, описание изменили».' },
              { from: 'b', to: 'api', t: 'PUT · If-Match: "4"\n{новое описание, 18}', note: 'Б вносит свою правку поверх свежей версии.' },
              { from: 'api', to: 'b', t: '200 · ETag "5"', reply: true, kind: 'ok' }
            ]
          }
        ]
      });
    }
  };

  // =====================================================================
  // hard-2 · 8. Страницы: offset и курсор
  // =====================================================================
  const NTXT = ['Подтвердите email', 'Добро пожаловать в «Пульс»!', 'Скидка 10 % на персональные тренировки', 'Вы пропустили сайкл — это прогул', 'Бассейн закрыт на санобработку 7 октября', 'Оплата 5 400 ₽ прошла', 'Напоминание: йога завтра в 09:00', 'Новое занятие: стретчинг в «Соколе»', 'Запись на пилатес подтверждена', 'Тренер Игорь Ким перенёс йогу на 09:30', 'Абонемент продлён до 31.08.2027', 'Место освободилось: сайкл, пн 19:00'];
  const NNEW = ['Место освободилось: йога, вт 19:00', 'Акция «Приведи друга» до конца месяца', 'Изменилось расписание бассейна', 'Ваш тренер ответил на отзыв', 'Новый клуб: «Пульс Химки»'];
  const PG = 4;
  const howPages = {
    id: 'how-pages', title: 'Как это работает: страницы — offset и курсор', covers: ['pages'], free: true, noReset: true,
    simple: {
      icon: '🔖', plain: 'Длинный список отдают страницами. Следующую можно попросить двумя способами: «пропусти первые N» (offset) или «дай всё после вот этой записи» (курсор).',
      analogy: 'Offset — «я стоял шестым в очереди». Пока вы отходили, двое влезли вперёд, и шестое место теперь у того, кого вы уже видели. Курсор — закладка в книге: в начало вклеили страницы, а закладка лежит там, где вы остановились.',
      tech: 'Offset: <code>ORDER BY created_at DESC, id DESC LIMIT 4 OFFSET 4</code> — база отсчитывает позиции от начала в момент запроса. Курсор (keyset): <code>WHERE (created_at, id) &lt; (:t, :id) … LIMIT 4</code> — продолжаем от последней выданной записи. Курсор непрозрачен: клиент берёт его из <code>_links.next</code> и не разбирает.'
    },
    lead: ui.brief({
      situation: 'Соседний пример — лента уведомлений Анны в приложении: новые сверху, по 4 на страницу. Анна листает вниз, а в это время приходят новые уведомления, а что-то она удаляет. Посмотрим, что она увидит при двух способах листать.',
      todo: ['Выберите способ: offset или курсор.', 'Нажмите «Страница 1». Затем «Пришло новое уведомление» и «Следующая страница». Посмотрите, что попало на страницу 2.', 'Нажмите «Сначала» и попробуйте «Удалили уведомление» между страницами. Затем всё то же — другим способом.', 'Внизу подвиньте ползунок: сколько строк базе приходится пролистать при большом offset.'],
      look: 'Слева — вся лента на сервере прямо сейчас: номер позиции, текст и на какой странице Анна видела уведомление. Справа — что Анна получила, страница за страницей. Красное «×2» — показано дважды. Жёлтое «пропущено» — Анна его так и не увидела. Зелёное «новое» — пришло, пока она листала.'
    }),
    render(el) {
      let mode = 'offset', S;
      const reset = () => { S = { items: NTXT.map((t, i) => ({ n: i + 1, t, del: false, isNew: false })), pages: [], msg: null, last: null }; };
      reset();
      el.innerHTML = `<div class="stack">
        <div class="row"><span class="small dim">Способ:</span>${ui.seg('thrpgm', [{ v: 'offset', t: 'offset — «пропусти N»' }, { v: 'cursor', t: 'курсор — «после записи X»' }], mode, 'accent')}</div>
        <div class="row"><button type="button" class="btn primary sm" data-pa="p1">Страница 1</button><button type="button" class="btn sm" data-pa="next">Следующая страница</button><button type="button" class="btn sm" data-pa="add">Пришло новое уведомление</button><button type="button" class="btn sm" data-pa="del">Удалили уведомление</button><button type="button" class="btn ghost sm" data-pa="reset">⟲ Сначала</button></div>
        <div class="grid3" data-pst></div>
        <div data-pmsg></div>
        <div class="thr-auto"><div><div class="small dim">Лента на сервере · новые сверху</div><div class="thr-feed" data-feed></div></div><div><div class="small dim">Что увидела Анна</div><div class="thr-pages" data-pgs></div><div data-preq></div></div></div>
        <div class="eyebrow">Цена большого offset</div><div data-cost></div></div>`;
      const live = () => S.items.filter(x => !x.del).sort((a, b) => b.n - a.n);
      const shownOn = n => S.pages.map((p, i) => p.items.includes(n) ? i : -1).filter(i => i >= 0);
      function load(next) {
        const L0 = live();
        if (!next) S.pages = [];
        const k = S.pages.length;
        let items, req, sql;
        if (k === 0 || mode === 'offset') {
          items = L0.slice(k * PG, k * PG + PG).map(x => x.n);
          req = `GET /v1/me/notifications?limit=${PG}${k ? '&offset=' + k * PG : ''}`;
          sql = `SELECT … FROM notification\n WHERE client_id = $1\n ORDER BY created_at DESC, id DESC\n LIMIT ${PG}${k ? ` [[bad]]OFFSET ${k * PG}[[/]]` : ''};`;
        } else {
          const last = S.pages[k - 1].items[S.pages[k - 1].items.length - 1];
          items = L0.filter(x => x.n < last).slice(0, PG).map(x => x.n);
          req = `GET /v1/me/notifications?limit=${PG}&cursor=${b64('{"id":' + last + '}').replace(/=+$/, '')}`;
          sql = `SELECT … FROM notification\n WHERE client_id = $1\n   [[ok]]AND (created_at, id) < (…, ${last})[[/]]   -- из курсора: последнее, что видела Анна\n ORDER BY created_at DESC, id DESC\n LIMIT ${PG};`;
        }
        S.pages.push({ items, top: k === 0 ? (L0[0] || {}).n : S.pages[0].top });
        S.last = { req, sql };
        const dups = items.filter(n => shownOn(n).length > 1);
        if (k === 0) S.msg = ['', 'Страница 1', 'Анна видит 4 самых новых уведомления.'];
        else if (dups.length) S.msg = ['bad', 'Дубль', `Сервер честно пропустил ${k * PG} позиций. Но сверху появилось новое уведомление, и всё съехало вниз на одну позицию. Первое на этой странице Анна уже видела.`];
        else if (skipped().length) S.msg = ['warn', 'Пропуск', `Сервер пропустил ${k * PG} позиций. Но одно из уже просмотренных удалили, всё поднялось на позицию вверх — и уведомление на стыке страниц проскочило мимо Анны.`];
        else S.msg = ['ok', 'Без потерь', mode === 'cursor' ? 'Курсор помнит последнее, что видела Анна, и продолжает с него. Что случилось выше — не важно. Новые уведомления Анна увидит наверху, когда потянет ленту вниз.' : 'Пока лента не менялась, offset работает честно. Добавьте или удалите уведомление между страницами.'];
      }
      function skipped() {
        if (!S.pages.length) return [];
        const shown = new Set(S.pages.flatMap(p => p.items)), min = Math.min(...shown), top = S.pages[0].top;
        return S.items.filter(x => !x.del && !shown.has(x.n) && x.n <= top && x.n > min).map(x => x.n);
      }
      function draw() {
        const L0 = live(), sk = skipped();
        const all = S.items.slice().sort((a, b) => b.n - a.n);
        TR.$('[data-feed]', el).innerHTML = all.map(x => {
          const on = shownOn(x.n), dup = on.length > 1, skip = sk.includes(x.n), pos = x.del ? '—' : L0.indexOf(x) + 1;
          return `<div class="thr-n ${x.del ? 'del' : ''} ${dup ? 'dup' : skip ? 'skip' : x.isNew ? 'new' : ''}"><span class="pos">${pos}</span><span>${esc(x.t)}</span><span>${x.del ? '<span class="thr-pg p4">удалено</span>' : ''}${x.isNew ? '<span class="thr-pg nw">новое</span>' : ''}${on.map(i => `<span class="thr-pg p${Math.min(i + 1, 4)}">стр. ${i + 1}</span>`).join('')}${dup ? '<span class="thr-pg x2">×2</span>' : ''}${skip ? '<span class="thr-pg sk">пропущено</span>' : ''}</span></div>`;
        }).join('');
        const seen = [];
        TR.$('[data-pgs]', el).innerHTML = S.pages.length ? S.pages.map((p, i) => `<div class="thr-page"><span class="thr-pg p${Math.min(i + 1, 4)}" style="justify-self:start">страница ${i + 1}</span><div class="chips">${p.items.length ? p.items.map(n => { const it = S.items.find(x => x.n === n); const d = seen.includes(n); seen.push(n); return `<span class="chip ${d ? 'bad' : ''}" style="white-space:normal">${d ? '×2 · ' : ''}${esc(it.t)}</span>`; }).join('') : '<span class="small dim">пусто — список кончился</span>'}</div></div>`).join('') : '<p class="small dim">Нажмите «Страница 1».</p>';
        TR.$('[data-preq]', el).innerHTML = S.last ? ui.code(S.last.req, 'text', 'последний запрос') + ui.code(S.last.sql, 'sql', 'что делает база') : '';
        const total = S.pages.reduce((s, p) => s + p.items.length, 0), dups = total - new Set(S.pages.flatMap(p => p.items)).size;
        TR.$('[data-pst]', el).innerHTML = stat('Показано', String(total), '', 'уведомлений на всех страницах') + stat('Дубли', String(dups), dups ? 'bad' : 'ok', 'показано дважды') + stat('Пропуски', String(sk.length), sk.length ? 'warn' : 'ok', 'Анна так и не увидела');
        TR.$('[data-pmsg]', el).innerHTML = S.msg ? ui.note(S.msg[0], S.msg[1], S.msg[2]) : '';
        TR.$('[data-pa="next"]', el).disabled = !S.pages.length || S.pages.length >= 4 || !S.pages[S.pages.length - 1].items.length;
      }
      TR.on(el, 'click', '[data-pa]', (e, b) => {
        const a = b.dataset.pa;
        if (a === 'reset') reset();
        if (a === 'p1') load(false);
        if (a === 'next') load(true);
        if (a === 'add') {
          const n = Math.max(...S.items.map(x => x.n)) + 1, cnt = S.items.filter(x => x.isNew).length;
          S.items.push({ n, t: NNEW[cnt % NNEW.length], del: false, isNew: true });
          S.msg = ['', 'Пришло новое уведомление', 'Оно встало на самый верх ленты — все остальные сдвинулись на одну позицию вниз. Теперь загрузите следующую страницу.'];
        }
        if (a === 'del') {
          const p1 = S.pages.length ? S.pages[0].items : [];
          const victim = live().find(x => p1.includes(x.n) && x.n !== p1[0]) || live()[0];
          if (victim) { victim.del = true; S.msg = ['', 'Удалили уведомление', `«${esc(victim.t)}» удалено${p1.includes(victim.n) ? ' — Анна его уже видела' : ''}. Всё, что ниже, поднялось на одну позицию вверх. Теперь загрузите следующую страницу.`]; }
        }
        draw();
      });
      ui.onSeg(el, (n, v) => { if (n === 'thrpgm') { mode = v; reset(); draw(); } });
      draw();
      // цена большого offset
      const OFFS = [0, 100, 1000, 10000, 100000, 1000000];
      const cost = TR.$('[data-cost]', el);
      cost.innerHTML = `<div class="thr-box"><p class="small muted">Представьте большую таблицу: уведомления всех клиентов сети за 3 года — миллионы строк. Страницы по 20. Чем дальше страница, тем больше строк база читает и выбрасывает при offset.</p>
        <div class="thr-set">${setRow('OFFSET', 'двигайте', `<input class="thr-range" type="range" min="0" max="${OFFS.length - 1}" value="4" data-off aria-label="Размер offset">`)}</div><div data-cv></div></div>`;
      const drawCost = i => {
        const off = OFFS[i], ms = Math.max(1, Math.round(off / 1000));
        TR.$('[data-cv]', cost).innerHTML = `<div class="grid2">
          <div class="stack tight">${stat('Offset ' + off.toLocaleString('ru-RU'), (off + 20).toLocaleString('ru-RU') + ' строк', off >= 100000 ? 'bad' : off >= 10000 ? 'warn' : 'ok', `прочитать ${off.toLocaleString('ru-RU')} и выбросить, отдать 20 · ≈ ${ms.toLocaleString('ru-RU')} мс`)}${ui.meter(Math.max(0.01, (off + 20) / 1000020), off >= 100000 ? 'bad' : 'warn')}</div>
          <div class="stack tight">${stat('Курсор', '20 строк', 'ok', 'по индексу сразу к месту «после записи X» · ≈ 1 мс на любой странице')}${ui.meter(0.01, 'ok')}</div></div>
          <p class="small dim">Порядок величин условный: примерно 1 мс на тысячу строк. Важна форма: у offset время растёт с номером страницы, у курсора — нет.</p>`;
      };
      cost.addEventListener('input', e => { if (e.target.matches('[data-off]')) drawCost(+e.target.value); });
      drawCost(4);
    }
  };

  // =====================================================================
  // hard-2 · 9. HTTP-кэш, 304 и 202
  // =====================================================================
  const CRES = {
    menu: { t: 'Меню фитнес-бара', path: '/v1/bar/menu', sub: 'одинаковое для всех' },
    mine: { t: 'Мои абонементы', path: '/v1/me/memberships', sub: 'у каждого своё' }
  };
  const CUSERS = { anna: 'Анна', petr: 'Пётр' };
  const HOPN = { b: 'браузер', c: 'CDN', s: 'сервер' };
  function cBody(res, ver, u) {
    if (res === 'menu') return 'коктейль ' + TR.fmtRub(12990 + (ver - 1) * 1000);
    if (u === 'anna') return ver > 1 ? 'Анна: «Сеть 12 мес», заморожен до 25.10' : 'Анна: «Сеть 12 мес», до 31.08.2027';
    return ver > 1 ? 'Пётр: «Дневной 3 мес», продлён до 15.03.2027' : 'Пётр: «Дневной 3 мес», до 15.12.2026';
  }
  const howCache = {
    id: 'how-cache', title: 'Как это работает: HTTP-кэш, 304 и 202', covers: ['cache-202'], free: true, noReset: true,
    simple: {
      icon: '🗄️', plain: 'Кэш — сохранённая копия ответа. Одинаковое для всех можно раздавать копиями и не трогать базу. Личное нельзя класть туда, где его увидят другие.',
      analogy: 'Меню фитнес-бара висит на стене: его печатают раз в день, бармена каждый раз не спрашивают. Если меню могло поменяться, вы уточняете: «у меня меню от вторника — оно ещё в силе?» — «да» (это 304). А чек конкретного клиента на общую стену не вешают.',
      tech: '<code>Cache-Control: max-age=N</code> — копия свежая N секунд. <code>public</code> — можно хранить в общем кэше (CDN), <code>private</code> — только в браузере владельца, <code>no-store</code> — нигде. <code>ETag</code> + <code>If-None-Match</code> — проверка «не изменилось ли?» → <code>304 Not Modified</code> без тела. Долгая работа — <code>202 Accepted</code> + <code>Location</code>, клиент опрашивает статус.'
    },
    lead: ui.brief({
      situation: 'Соседний пример: меню фитнес-бара — коктейли и цены, одинаковые для всех (<code>GET /v1/bar/menu</code>). И «мои абонементы» — у каждого свои (<code>GET /v1/me/memberships</code>). Между браузерами и сервером «Пульса» стоит <b>CDN</b> — сеть серверов-посредников, которые хранят копии ответов. Хранить ли копию и сколько, сервер пишет в заголовке <code>Cache-Control</code>.',
      todo: ['Выберите ресурс и правило кэша, ползунком задайте <code>max-age</code>.', 'Нажимайте «Запрос: Анна», «Запрос: Пётр», «+10 с», «Поменяли данные». Смотрите на шкалу: кто ответил и с каким кодом.', 'Включите «Мои абонементы» и <code>public</code>: Анна, потом Пётр. Что получил Пётр?', 'Внизу пройдите схему: что делать, если работа идёт две минуты.'],
      look: 'Каждая строка шкалы — один запрос. Точка — кто ответил: зелёная — браузер (сам себе, без сети), синяя — CDN, фиолетовая — сервер «Пульса». Чем короче линия, тем меньше нагрузки. 200 — пришло тело целиком, 304 — «не изменилось», тело не нужно. «Устарело» — показали старые данные, «чужое» — утечка.'
    }),
    render(el) {
      let res = 'menu', cc = 'public', maxAge = 30, S;
      const reset = () => { S = { t: 0, ver: 1, bc: { anna: null, petr: null }, cdn: null, log: [] }; };
      reset();
      el.innerHTML = `<div class="stack">
        <div class="thr-set">
          ${setRow('Ресурс', '', ui.seg('thrcr', Object.entries(CRES).map(([v, x]) => ({ v, t: x.t })), res, 'accent'))}
          ${setRow('Cache-Control', '', ui.seg('thrcc', [{ v: 'public', t: 'public' }, { v: 'private', t: 'private' }, { v: 'no-store', t: 'no-store' }], cc, 'accent'))}
          ${setRow('max-age', '', `<div class="row"><input class="thr-range" style="flex:1 1 160px" type="range" min="0" max="120" step="10" value="${maxAge}" data-ma aria-label="max-age в секундах"><span class="mono" data-mav>${maxAge} с</span></div>`)}
        </div>
        <div class="row"><button type="button" class="btn primary sm" data-cq="anna">Запрос: Анна</button><button type="button" class="btn primary sm" data-cq="petr">Запрос: Пётр</button><button type="button" class="btn sm" data-cq="t10">+10 с</button><button type="button" class="btn sm" data-cq="t60">+60 с</button><button type="button" class="btn sm" data-cq="chg">Поменяли данные</button><button type="button" class="btn ghost sm" data-cq="reset">⟲ Сначала</button><span class="mono small" data-clock></span></div>
        <div data-hdr></div>
        <div class="thr-cl" data-cl></div>
        <div data-cnote></div>
        <div class="grid4" data-cst></div>
        <div class="eyebrow">Долгая работа: 202 Accepted</div><div data-w202></div></div>`;
      const etagOf = u => res === 'menu' ? `"m${S.ver}"` : `"${u}-${S.ver}"`;
      const fresh = e => e && S.t - e.at < maxAge;
      function request(u) {
        const storeB = cc !== 'no-store', storeC = cc === 'public', b = S.bc[u], c = S.cdn;
        let hop, code, got, note;
        if (storeB && fresh(b)) { hop = 'b'; code = 200; got = b; note = `Копия в браузере ${CUSERS[u] === 'Анна' ? 'Анны' : 'Петра'} ещё свежая (${S.t - b.at} с из ${maxAge}) — запрос даже не ушёл в сеть.`; }
        else {
          const inm = storeB && b ? b.etag : null;
          if (storeC && fresh(c)) {
            hop = 'c';
            if (inm && inm === c.etag) { code = 304; b.at = S.t; got = b; note = `Браузер спросил «у меня ${inm} — есть новее?». У CDN свежая копия с тем же ETag — он сам ответил 304, сервер не трогали.`; }
            else { code = 200; got = c; if (storeB) S.bc[u] = Object.assign({}, c, { at: S.t }); note = 'CDN отдал свою копию целиком. Сервер «Пульса» этот запрос даже не увидел.'; }
          } else {
            hop = 's';
            const etag = etagOf(u), ask = storeC && c ? c.etag : inm;
            if (ask && ask === etag) {
              code = 304;
              if (storeC && c) c.at = S.t;
              if (b && b.etag === etag) { b.at = S.t; got = b; } else { got = c; if (storeB) S.bc[u] = Object.assign({}, c, { at: S.t }); }
              note = `Копия устарела по времени, поэтому ${storeC && c ? 'CDN' : 'браузер'} переспросил сервер: «у меня ${ask} — есть новее?». Данные не менялись — сервер ответил 304 без тела, копия продлена ещё на ${maxAge} с.`;
            } else {
              code = 200; const e = { etag, at: S.t, ver: S.ver, owner: u, body: cBody(res, S.ver, u) };
              got = e; if (storeC) S.cdn = Object.assign({}, e); if (storeB) S.bc[u] = Object.assign({}, e);
              note = cc === 'no-store' ? 'no-store: копий нет нигде, каждый запрос идёт до сервера и получает тело целиком.' : ask ? `Переспросили сервер с ${ask}, а у него уже ${etag}: данные изменились — 200 с новым телом и новым ETag.` : 'Копии не было — запрос дошёл до сервера, ответ 200 с телом. ' + (storeC ? 'CDN и браузер сохранили копию.' : cc === 'private' ? 'Копию сохранил только браузер, CDN — нет (private).' : '');
            }
          }
        }
        const stale = got.ver < S.ver, leak = res === 'mine' && got.owner !== u;
        if (leak) note = `CDN — общий кэш для всех. По адресу ${CRES.mine.path} у него лежит копия ответа для Анны, и он отдал её Петру. Пётр видит чужой абонемент. Личные ответы — только private или no-store.`;
        S.log.push({ t: S.t, u, hop, code, body: got.body, stale, leak, note });
      }
      function draw() {
        TR.$('[data-clock]', el).textContent = `t = ${S.t} с`;
        TR.$('[data-mav]', el).textContent = maxAge + ' с';
        TR.$('[data-hdr]', el).innerHTML = ui.http({ cap: `так сервер отвечает на GET ${CRES[res].path}`, status: 200, headers: { 'Cache-Control': cc === 'no-store' ? 'no-store' : `${cc}, max-age=${maxAge}`, ETag: res === 'menu' ? `"m${S.ver}"` : `"anna-${S.ver}"` } });
        const pos = { b: 16.66, c: 50, s: 83.33 };
        TR.$('[data-cl]', el).innerHTML = `<div class="thr-cr head"><span>время</span><span>кто</span><div class="thr-hopsh"><span>браузер</span><span>CDN</span><span>сервер</span></div><span>ответ</span></div>` + (S.log.length ? S.log.map((r, i) => `<div class="thr-cr ${i === S.log.length - 1 ? 'last' : ''}"><span class="t">${r.t} с</span><span>${CUSERS[r.u]}</span><div class="thr-hops" title="${esc(r.body)}"><span class="tick" style="left:16.66%"></span><span class="tick" style="left:50%"></span><span class="tick" style="left:83.33%"></span><span class="ln" style="width:${pos[r.hop] - 16.66}%"></span><span class="dt ${r.hop}" style="left:${pos[r.hop]}%"></span></div><span>${ui.st(r.code)}${r.leak ? ' <span class="thr-pg x2">чужое</span>' : r.stale ? ' <span class="thr-pg sk">устарело</span>' : ''}</span></div>`).join('') : '<p class="small dim">Нажмите «Запрос: Анна».</p>');
        const cl = TR.$('[data-cl]', el); cl.scrollTop = cl.scrollHeight;
        const last = S.log[S.log.length - 1];
        TR.$('[data-cnote]', el).innerHTML = last ? ui.note(last.leak ? 'bad' : last.stale ? 'warn' : last.hop === 's' && last.code === 200 ? '' : 'ok', `${CUSERS[last.u]} · ответил ${HOPN[last.hop]} · ${last.code}`, `${last.note}<br><span class="small dim">На экране: ${esc(last.body)}</span>`) : '';
        const n = S.log.length, srv = S.log.filter(r => r.hop === 's').length, n304 = S.log.filter(r => r.code === 304).length, st = S.log.filter(r => r.stale).length, lk = S.log.filter(r => r.leak).length;
        TR.$('[data-cst]', el).innerHTML = stat('Запросов', String(n), '', 'всего') + stat('До сервера', `${srv} из ${n}`, n && srv / n > .6 ? 'warn' : 'ok', 'нагрузка на «Пульс»') + stat('Устаревших', String(st), st ? 'warn' : 'ok', 'цена кэша: до max-age') + stat('Чужих данных', String(lk), lk ? 'bad' : 'ok', 'утечка');
      }
      TR.on(el, 'click', '[data-cq]', (e, b) => {
        const a = b.dataset.cq;
        if (a === 'anna' || a === 'petr') request(a);
        if (a === 't10') S.t += 10;
        if (a === 't60') S.t += 60;
        if (a === 'chg') S.ver++;
        if (a === 'reset') reset();
        draw();
        if (a === 'chg') TR.$('[data-cnote]', el).innerHTML = ui.note('', 'Данные изменились', res === 'menu' ? `Цена коктейля теперь ${TR.fmtRub(12990 + (S.ver - 1) * 1000)}. У сервера новый ETag. Но копии в браузерах и CDN об этом не знают, пока не истечёт max-age.` : 'Абонементы изменились, у сервера новый ETag. Копии об этом не знают, пока не истечёт max-age.');
      });
      ui.onSeg(el, (n, v) => { if (n === 'thrcr') { res = v; reset(); draw(); } if (n === 'thrcc') { cc = v; reset(); draw(); } });
      el.addEventListener('input', e => { if (e.target.matches('[data-ma]')) { maxAge = +e.target.value; draw(); } });
      draw();
      const W = [L('cab', 'Кабинет', 'директор'), L('api', 'API «Пульса»', ''), L('job', 'Фоновая задача', 'считает отчёт')];
      walk(TR.$('[data-w202]', el), {
        name: 'thrw202', laneW: 180, scenarios: [
          {
            id: 'wait', t: 'Ждём на открытом соединении', lanes: W, sumKind: 'bad', sum: 'Ответа нет, а расчётов два. Держать соединение минутами нельзя: его оборвёт балансировщик, браузер или мобильная сеть.',
            steps: [
              { from: 'cab', to: 'api', t: 'POST /reports/\ntrainer-load-exports', note: 'Директор заказывает отчёт «загрузка тренеров за год». Он считается около двух минут.' },
              { from: 'api', to: 'job', t: 'считать…', note: 'Сервер начинает считать прямо внутри запроса и держит соединение открытым.' },
              { from: 'api', to: 'cab', t: 'обрыв через 60 с', reply: true, lost: true, kind: 'bad', note: 'Балансировщик ждёт ответа 60 секунд и обрывает соединение. Директор видит ошибку, хотя расчёт ещё идёт.' },
              { from: 'cab', to: 'api', t: 'POST ещё раз', kind: 'warn', note: 'Директор жмёт «Ещё раз» — и запускает второй тяжёлый расчёт.' },
              { from: 'job', to: 'job', box: true, t: 'два расчёта грузят базу', kind: 'bad' }
            ]
          },
          {
            id: 'a202', t: '202 + опрос статуса', lanes: W, sumKind: 'ok', sum: '«Принято, следите вот здесь» — как квитанция в химчистке. Соединение не висит, повторное нажатие с тем же ключом не запустит второй расчёт.',
            steps: [
              { from: 'cab', to: 'api', t: 'POST /reports/\ntrainer-load-exports', note: 'Тело: <code>{"year": 2026}</code>, плюс <code>Idempotency-Key</code> — на случай двойного нажатия.' },
              { from: 'api', to: 'job', t: 'задание в таблицу заданий', note: 'Без брокеров: строка в таблице заданий, её забирает фоновый обработчик.' },
              { from: 'api', to: 'cab', t: '202 · Location: …/x-7', reply: true, kind: 'ok', note: 'Ответ за миллисекунды: «принято, статус — по адресу из <code>Location</code>».' },
              { from: 'job', to: 'job', box: true, t: 'считаю… 30 %', kind: 'info' },
              { from: 'cab', to: 'api', t: 'GET …/x-7', note: 'Кабинет спрашивает статус.' },
              { from: 'api', to: 'cab', t: '200 running · Retry-After: 15', reply: true, note: '<code>Retry-After</code> подсказывает, когда спросить снова, — кабинет не дёргает сервер каждую секунду.' },
              { from: 'job', to: 'job', box: true, t: 'готово', kind: 'ok' },
              { from: 'cab', to: 'api', t: 'GET …/x-7' },
              { from: 'api', to: 'cab', t: '200 done + ссылка на файл', reply: true, kind: 'ok', note: 'Готово: в ответе ссылка на файл в <code>_links</code>. Кабинет не собирает адрес файла сам.' }
            ]
          }
        ]
      });
    }
  };

  // =====================================================================
  // hard-3 · 10. Обратная совместимость
  // =====================================================================
  const CHG = [
    { v: 'add', t: 'добавили поле freezeDaysLeft' },
    { v: 'rename', t: 'переименовали endsOn → validUntil' },
    { v: 'type', t: 'daysLeft: число → строка' },
    { v: 'enum', t: 'новый статус "grace"' },
    { v: 'req', t: 'новое обязательное поле в запросе заморозки' }
  ];
  const EXP = [
    { m: 'октябрь 2026', old: 100, both: false, nu: false, step: 'Сейчас', txt: 'Все версии приложения читают <code>endsOn</code>. Решили переименовать в <code>validUntil</code>.' },
    { m: 'ноябрь', old: 100, both: true, step: 'Расширить (expand)', txt: 'Сервер отдаёт <b>оба</b> поля с одинаковым значением. Никто не сломался: старые читают старое.' },
    { m: 'декабрь', old: 80, both: true, step: 'Новая версия приложения', txt: 'Вышло приложение 3.0, оно читает <code>validUntil</code>. Старое 2.3 по-прежнему читает <code>endsOn</code> — работают оба.' },
    { m: 'январь 2027', old: 55, both: true, dep: true, step: 'Объявить устаревшим', txt: 'В ответах появились заголовки <code>Deprecation</code> (RFC 9745) и <code>Sunset</code> (RFC 8594): «поле устарело, уберём 30 июня 2027». Их видят логи и мониторинг партнёров. Партнёрам — письмо минимум за 6 месяцев.' },
    { m: 'февраль', old: 35, both: true, dep: true, step: 'Ждём и считаем', txt: 'Смотрим метрику: какая доля запросов приходит от старых версий приложения (по заголовку с версией).' },
    { m: 'март', old: 20, both: true, dep: true, step: 'Ждём и считаем', txt: 'Старых всё меньше, но 20 % — это тысячи людей.' },
    { m: 'апрель', old: 9, both: true, dep: true, step: 'Напоминаем', txt: 'Тем, кто на старой версии, — экран «Обновите приложение» с кнопкой, но без запрета.' },
    { m: 'май', old: 3, both: true, dep: true, step: 'Почти все обновились', txt: 'Осталось 3 %. Дата Sunset ещё не наступила — обещание держим.' },
    { m: 'июль 2027', old: 0.8, both: false, nu: true, step: 'Сузить (contract)', txt: 'Дата Sunset прошла — старое поле убрали. Для партнёров отключённая версия API отвечала бы <code>410 Gone</code> со ссылкой на новую.' }
  ];
  const howCompat = {
    id: 'how-compat', title: 'Как это работает: обратная совместимость', covers: ['breaking'], free: true, noReset: true,
    simple: {
      icon: '🧩', plain: 'API — это обещание. Изменение ломающее, если приложение, которое вчера работало, сегодня падает, хотя его никто не трогал.',
      analogy: 'Ключи от шкафчиков. Поставили новые шкафчики — старые ключи работают как раньше. Поменяли замки на старых — у всех, кто не зашёл за новым ключом, шкафчик не откроется.',
      tech: 'Старые версии приложения живут у клиентов месяцами. Добавлять обычно можно, менять и удалять — нет. Многое зависит от клиента: «терпимый читатель» пропускает незнакомые поля и значения, строгий — падает. Менять без поломок помогает expand–contract: добавить новое рядом со старым, перевести клиентов, убрать старое после объявленной даты (<code>Deprecation</code>, <code>Sunset</code>).'
    },
    lead: ui.brief({
      situation: 'Соседний пример — экран «Мой абонемент». У многих клиентов стоит старое приложение 2.3: оно читает ответ <code>GET /v1/me/memberships/current</code> и показывает название, дату окончания, сколько дней осталось и статус. Ещё на экране есть кнопка «Заморозить». Разработчики хотят поменять API. Что увидит человек со старым приложением?',
      todo: ['Включайте изменения по одному и смотрите на телефон: работает ли старое приложение.', 'Для каждого изменения переключите, как написано приложение: строго или терпимо. Где исход зависит от этого, а где ломаются оба?', 'Внизу двигайте ползунок по месяцам: как переименовать поле по схеме expand–contract, никого не сломав.'],
      look: 'Слева — ответ сервера, изменённое подсвечено. Ниже — код старого приложения: красная строка — здесь оно падает, жёлтая — работает, но показывает ерунду. Справа — экран телефона.'
    }),
    render(el) {
      const on = {};
      let cl = 'strict', mi = 0;
      el.innerHTML = `<div class="stack">
        <div class="thr-chips"><span class="small dim">Изменения:</span>${CHG.map(c => `<button type="button" class="chip" data-chg="${c.v}" aria-pressed="false">${c.t}</button>`).join('')}</div>
        <div class="row"><span class="small dim">Приложение 2.3 написано:</span>${ui.seg('thrcmp', [{ v: 'strict', t: 'строго' }, { v: 'tolerant', t: 'терпимо' }], cl, 'accent')}</div>
        <div class="thr-auto"><div class="stack tight" data-resp></div><div data-ph></div></div>
        <div data-cmpnote></div>
        <div class="eyebrow">Expand–contract на шкале времени</div>
        <div class="thr-box"><div class="thr-set">${setRow('Месяц', '', `<input class="thr-range" type="range" min="0" max="${EXP.length - 1}" value="0" data-mon aria-label="Месяц">`)}</div><div data-exp></div></div></div>`;
      function respJson() {
        const L1 = [`"plan": "Сеть 12 мес"`];
        L1.push(on.rename ? `[[hl]]"validUntil": "2027-08-31"[[/]]` : `"endsOn": "2027-08-31"`);
        L1.push(on.type ? `[[hl]]"daysLeft": "214"[[/]]` : `"daysLeft": 214`);
        L1.push(on.enum ? `[[hl]]"status": "grace"[[/]]` : `"status": "active"`);
        if (on.add) L1.push(`[[hl]]"freezeDaysLeft": 16[[/]]`);
        return '{\n  ' + L1.join(',\n  ') + '\n}';
      }
      function run() {
        // какая строка падает и что на экране
        const lines = [
          cl === 'strict' ? 'val m = json.decode<Membership>(body)   // строго: всё как в описании' : 'val m = json.decodeLenient(body)   // лишнее пропускаем',
          'title.text = m.plan',
          'until.text = "до " + format(m.endsOn)',
          'days.text = m.daysLeft + 1 - 1   // число дней',
          cl === 'strict' ? 'badge.text = Status.valueOf(m.status).label' : 'badge.text = labels[m.status] ?: "Статус обновлён"',
          'freeze.onClick = POST /freezes {startsOn, endsOn}'
        ];
        const mark = {}; let crash = null; const scr = { until: 'до 31.08.2027', days: '214 дней', badge: ['Действует', 'ok'], freeze: null };
        if (cl === 'strict') {
          if (on.add) crash = crash || [0, 'Неизвестное поле freezeDaysLeft'];
          if (on.rename) crash = crash || [0, 'Нет обязательного поля endsOn'];
          if (on.type) crash = crash || [0, 'daysLeft: ожидалось число, пришла строка'];
          if (on.enum && !crash) crash = [4, 'Неизвестный статус grace'];
        } else {
          if (on.type) crash = [0, 'daysLeft: ожидалось число, пришла строка'];
          if (on.rename) { mark[2] = 'warn'; scr.until = 'до Invalid Date'; }
          if (on.enum) { mark[4] = 'ok'; scr.badge = ['Статус обновлён', 'warn']; }
          if (on.add) mark[0] = 'ok';
        }
        if (on.req) { mark[5] = 'bad'; scr.freeze = 'Не удалось заморозить: 400 — поле reason обязательно.'; }
        if (crash) mark[crash[0]] = 'bad';
        return { lines, mark, crash, scr };
      }
      function draw() {
        const r = run();
        TR.$('[data-resp]', el).innerHTML = ui.code(respJson(), 'json', 'ответ сервера') + `<div class="code-cap">код старого приложения 2.3</div><div class="thr-code">${r.lines.map((l, i) => `<div class="${r.mark[i] || ''}">${esc(l)}</div>`).join('')}</div>`;
        const s = r.scr;
        TR.$('[data-ph]', el).innerHTML = `<div class="thr-phone"><div class="bar"></div><div class="ttl">Мой абонемент</div>${r.crash ? `<div class="crash"><b>Что-то пошло не так</b><br>Не удалось загрузить абонемент.</div><div class="fine">Упало на строке ${r.crash[0] + 1}: ${esc(r.crash[1])}.</div>` : `<div class="small muted">Сеть 12 мес</div><div class="mono" ${/Invalid/.test(s.until) ? 'style="color:var(--bad)"' : ''}>${esc(s.until)}</div><div class="small">${esc(s.days)}</div>${ui.status(s.badge[0], s.badge[1])}`}
          <span class="btn sm ${s.freeze ? 'danger' : ''}">Заморозить</span>${s.freeze ? `<div class="crash">${esc(s.freeze)}</div>` : ''}</div>`;
        const any = Object.values(on).some(Boolean);
        TR.$('[data-cmpnote]', el).innerHTML = !any ? ui.note('', 'Пока ничего не меняли', 'Старое приложение работает. Включите любое изменение сверху.') : r.crash || on.req || on.rename ? ui.note('bad', 'Старое приложение сломалось', 'Человек ничего не обновлял — а экран перестал работать. Проверьте то же изменение при другом способе написания приложения.') : ui.note('ok', 'Старое приложение работает', cl === 'tolerant' ? 'Терпимый читатель пропускает незнакомое. Но работает ли так же строгое приложение?' : 'Это изменение старому приложению не мешает.');
      }
      function drawExp() {
        const x = EXP[mi];
        const body = x.nu ? `{\n  "plan": "Сеть 12 мес",\n  [[ok]]"validUntil": "2027-08-31"[[/]]\n}` : x.both ? `{\n  "plan": "Сеть 12 мес",\n  ${x.dep ? '[[bad]]"endsOn": "2027-08-31"[[/]]' : '"endsOn": "2027-08-31"'},\n  [[ok]]"validUntil": "2027-08-31"[[/]]\n}` : `{\n  "plan": "Сеть 12 мес",\n  "endsOn": "2027-08-31"\n}`;
        const hdr = x.dep ? ui.http({ cap: 'заголовки ответа', status: 200, headers: [['Deprecation', '@1798761600'], ['Sunset', 'Wed, 30 Jun 2027 00:00:00 GMT'], ['Link', '<https://api.puls.fit/docs/changes#validUntil>; rel="deprecation"']] }) : '';
        const ppl = Math.round(45000 * x.old / 100);
        TR.$('[data-exp]', el).innerHTML = `<div class="row"><b>${esc(x.m)}</b>${ui.status(x.step, x.nu ? 'ok' : x.dep ? 'warn' : '')}</div><p class="small">${x.txt}</p>
          <div class="thr-auto"><div class="stack tight">${ui.code(body, 'json', 'что отдаёт сервер')}${hdr}</div>
          <div class="stack tight">${stat('Старых версий 2.3', x.old.toLocaleString('ru-RU') + ' %', x.old > 10 ? 'bad' : x.old > 1 ? 'warn' : 'ok', 'доля запросов от приложений, которые читают endsOn')}${ui.meter(x.old / 100, x.old > 10 ? 'bad' : 'warn')}
          ${x.nu ? ui.note('ok', 'Старое поле убрано', 'Почти все обновились, дата Sunset прошла, обещание выполнено.') : ui.note(x.old > 10 ? 'bad' : 'warn', 'Если убрать endsOn прямо сейчас', `Сломается у ${x.old.toLocaleString('ru-RU')} % клиентов — около ${ppl.toLocaleString('ru-RU')} человек из 45&nbsp;000.`)}</div></div>`;
      }
      TR.on(el, 'click', '[data-chg]', (e, b) => { const v = b.dataset.chg; on[v] = !on[v]; b.setAttribute('aria-pressed', String(!!on[v])); draw(); });
      ui.onSeg(el, (n, v) => { if (n === 'thrcmp') { cl = v; draw(); } });
      el.addEventListener('input', e => { if (e.target.matches('[data-mon]')) { mi = +e.target.value; drawExp(); } });
      draw(); drawExp();
    }
  };

  // ---------- вставка в тренировки ----------
  function add(stageId, task) {
    const s = TR.stageById(stageId);
    if (!s || s.tasks.some(x => x.id === task.id)) return;
    s.tasks.push(task);
  }
  add('intmap', howStyles); add('intmap', howAuth);
  add('rest-design', howRest); add('rest-design', howMethods);
  add('rest-contract', howAnatomy); add('rest-contract', howCodes);
  add('hard-1', howEtag);
  add('hard-2', howPages); add('hard-2', howCache);
  add('hard-3', howCompat);
  TR.glossary([
    { term: 'Параметр пути', simple: 'Часть адреса, которая называет одну конкретную вещь: номер шкафчика на дверце.', tech: 'Сегмент пути вида <code>/lockers/{lockerId}</code>. Без него — другой ресурс (вся коллекция).' },
    { term: 'Параметры запроса (query)', simple: 'Фильтры после знака «?»: та же вещь, только отобранная или упорядоченная.', tech: '<code>?clubId=sokol&amp;status=free</code> — не меняют ресурс, меняют выборку, сортировку, страницу.' }
  ], 'rest-design');
  TR.glossary([
    { term: 'Потерянное обновление', simple: 'Двое правят одно и то же, и второй молча затирает первого своей старой копией.', tech: 'Lost update. Лечится условной записью: <code>ETag</code> + <code>If-Match</code> → <code>412</code> на устаревшую копию.' }
  ], 'hard-1');
  TR.glossary([
    { term: 'Терпимый читатель', simple: 'Приложение, которое не падает на незнакомом поле или значении, а пропускает его или показывает нейтрально.', tech: 'Tolerant reader: игнорировать неизвестные поля, иметь ветку «другое» для неизвестных значений enum.' }
  ], 'hard-3');
})();
