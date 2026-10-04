/* Неделя 7, среда 10:00: CQRS и отчёты. Канон — _dev/DOMAIN-2.md §6 (CQRS: команды в ядре, модель чтения в ClickHouse
   из событий Kafka, отставание до 1 минуты, «Мои записи» из ядра) и §8 инцидент 7.
   Теория (живая): команды и запросы на табло загрузки тренажёрного зала, что видит пользователь при отставании;
   проекция из шкалы событий и перестройка («с начала» против «с текущего места»); event sourcing на бонусном счёте.
   Практика: лаборатория «отчёт директора» (ядро / реплика / ClickHouse), проекция «загрузка занятий» с живым
   предпросмотром, лаборатория инцидента 7 (перестройка, хранение 7 дней), «где CQRS не нужен» своими словами. */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc;
  const ID = 'rel-cqrs';

  if (!document.getElementById('cq-css')) document.head.insertAdjacentHTML('beforeend', `<style id="cq-css">
    .cq-root, .cq-root .stack, .cq-root .stack > * { min-width: 0; }
    .cq-root :not(pre) > code { white-space: normal; overflow-wrap: anywhere; }
    .cq-root .seg button { white-space: normal; text-align: left; }
    .cq-root .row > .btn { white-space: normal; text-align: left; max-width: 100%; }
    .cq-box { display: grid; gap: 12px; padding: 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); min-width: 0; }
    .cq-box > * { min-width: 0; }
    .cq-set { display: grid; grid-template-columns: minmax(0, 190px) minmax(0, 1fr); gap: 8px 14px; align-items: center; }
    .cq-set > .lbl { font-size: 13.5px; color: var(--text-2); min-width: 0; }
    .cq-set > .lbl small { display: block; font-size: 12px; color: var(--text-muted); }
    .cq-set > .seg { justify-self: start; max-width: 100%; }
    .cq-range { width: 100%; margin: 4px 0; accent-color: var(--accent); }
    .cq-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .cq-stats .v { font-size: 16px; overflow-wrap: anywhere; }
    .cq-stats .s { overflow-wrap: anywhere; }
    .cq-sc { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .cq-sc .stat.cur { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
    .cq-sc .v { font-size: 15px; }
    .cq-flow { display: grid; gap: 10px; padding: 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface-2); }
    .cq-lane { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; min-width: 0; }
    .cq-node { display: inline-grid; gap: 1px; padding: 7px 11px; border: 1px solid var(--border-strong); border-radius: 9px; background: var(--surface); font-size: 13px; font-weight: 600; min-width: 0; }
    .cq-node small { font-weight: 400; font-size: 11.5px; color: var(--text-muted); }
    .cq-node.rm { border-color: var(--info); }
    .cq-node.hot { border-color: var(--bad); background: var(--bad-soft); }
    .cq-arr { font: 12px/1.3 var(--f-mono); color: var(--text-muted); overflow-wrap: anywhere; min-width: 0; }
    .cq-arr.on { color: var(--info); }
    .cq-arr.bad { color: var(--bad); }
    .cq-case { display: grid; gap: 8px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); }
    .cq-case .row { flex-wrap: wrap; }
    .cq-screens { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; }
    .cq-tile { border: 1px solid var(--border-strong); border-radius: 10px; padding: 10px 12px; background: var(--surface); display: grid; gap: 4px; min-width: 0; font-size: 13px; align-content: start; }
    .cq-tile b { font-size: 13.5px; }
    .cq-tile small { color: var(--text-muted); font-size: 12px; }
    .cq-tile.ok { border-color: var(--ok); }
    .cq-tile.warn { border-color: var(--warn); background: var(--warn-soft); }
    .cq-tile.bad { border-color: var(--bad); background: var(--bad-soft); }
    .cq-tl { display: grid; gap: 3px; max-height: 360px; overflow: auto; padding-right: 2px; }
    .cq-ev { display: grid; grid-template-columns: 48px minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 5px 8px; border-radius: 7px; border: 1px solid transparent; font-size: 13px; color: var(--text-muted); }
    .cq-ev .tm { font: 12px/1.2 var(--f-mono); }
    .cq-ev.done { color: var(--text); background: var(--surface-2); }
    .cq-ev.cur { border-color: var(--accent); background: var(--accent-soft); color: var(--text); }
    .cq-ev.skip { color: var(--text-muted); text-decoration: line-through; }
    .cq-ev .tag { font: 11px/1.2 var(--f-mono); color: var(--warn); white-space: nowrap; }
    .cq-two { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 14px; align-items: start; }
    .cq-kv { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 12px; font-size: 13.5px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
    .cq-kv b { font-family: var(--f-mono); text-align: right; }
    .cq-kv .h { grid-column: 1 / -1; font: 600 11px/1.2 var(--f-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 2px; }
    .cq-kv .bad { color: var(--bad); }
    .cq-days { display: grid; grid-template-columns: repeat(var(--n, 10), minmax(0, 1fr)); gap: 4px; align-items: end; }
    .cq-day { display: grid; gap: 4px; min-width: 0; text-align: center; }
    .cq-col { position: relative; height: 130px; border-bottom: 1px solid var(--border-strong); }
    .cq-col .g { position: absolute; bottom: 0; left: 8%; right: 8%; border: 1.5px dashed var(--text-muted); border-bottom: 0; border-radius: 4px 4px 0 0; }
    .cq-col .f { position: absolute; bottom: 0; left: 26%; right: 26%; border-radius: 3px 3px 0 0; background: var(--ok); }
    .cq-col .f.bad { background: var(--bad); }
    .cq-col .f.warn { background: var(--warn); }
    .cq-col .x { position: absolute; bottom: 4px; left: 0; right: 0; font: 700 13px/1 var(--f-mono); color: var(--bad); }
    .cq-day .d { font: 11px/1.2 var(--f-mono); color: var(--text-muted); }
    .cq-day .d b { color: var(--text); }
    .cq-src { display: grid; gap: 6px; }
    .cq-srow { display: grid; grid-template-columns: minmax(0, 210px) repeat(var(--n, 10), minmax(0, 1fr)); gap: 3px; align-items: center; font-size: 12.5px; }
    .cq-srow > span:first-child { min-width: 0; color: var(--text-2); }
    .cq-srow i { display: block; height: 16px; border-radius: 3px; background: var(--surface-3); }
    .cq-srow i.on { background: var(--info); }
    .cq-srow i.snap { background: var(--violet); }
    .cq-legend { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 12px; color: var(--text-2); }
    .cq-legend i { display: inline-block; width: 11px; height: 11px; border-radius: 2px; margin-right: 5px; vertical-align: -1px; }
    .cq-crit { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    .cq-crit li { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 8px; font-size: 13.5px; align-items: start; }
    .cq-crit li > b { font: 700 13px/1.4 var(--f-mono); text-align: center; }
    .cq-crit li.ok > b { color: var(--ok); } .cq-crit li.bad > b { color: var(--bad); }
    .cq-crit li small { display: block; color: var(--text-muted); font-size: 12.5px; }
    .cq-picks { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 8px; }
    .cq-pick { display: grid; grid-template-columns: 20px minmax(0, 1fr); gap: 8px; align-items: start; text-align: left; padding: 9px 11px; border: 1px solid var(--border-strong); border-radius: 10px; background: var(--surface); color: var(--text); font: inherit; font-size: 13.5px; cursor: pointer; min-width: 0; }
    .cq-pick:disabled { cursor: default; }
    .cq-pick .mk { width: 16px; height: 16px; margin-top: 2px; border: 1.5px solid var(--border-strong); border-radius: 4px; display: grid; place-items: center; font-size: 11px; line-height: 1; }
    .cq-pick[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); }
    .cq-pick[aria-pressed="true"] .mk { background: var(--accent); border-color: var(--accent); color: var(--surface); }
    .cq-pick[aria-pressed="true"] .mk::after { content: '✓'; }
    .cq-pick.ok { border-color: var(--ok); } .cq-pick.bad { border-color: var(--bad); } .cq-pick.warn { border-color: var(--warn); }
    .cq-pick small { display: block; color: var(--text-muted); font-size: 12px; margin-top: 2px; overflow-wrap: anywhere; }
    .cq-pick code { font-size: 12px; }
    .cq-acct { display: grid; gap: 4px; }
    .cq-op { display: grid; grid-template-columns: 52px 64px minmax(0, 1fr); gap: 8px; font-size: 13px; padding: 4px 8px; border-radius: 6px; background: var(--surface-2); }
    .cq-op .n { font-family: var(--f-mono); text-align: right; }
    .cq-op .n.p { color: var(--ok); } .cq-op .n.m { color: var(--bad); }
    .cq-op.hl { outline: 1.5px solid var(--warn); }
    .cq-op.fix { outline: 1.5px solid var(--info); }
    .cq-row1 { padding: 14px; border: 1px solid var(--border-strong); border-radius: 10px; background: var(--surface); font: 14px/1.5 var(--f-mono); overflow-wrap: anywhere; }
    @media (max-width: 760px) {
      .cq-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .cq-sc { grid-template-columns: minmax(0, 1fr); }
      .cq-two { grid-template-columns: minmax(0, 1fr); }
    }
    @media (max-width: 640px) {
      .cq-set { grid-template-columns: minmax(0, 1fr); gap: 4px; }
      .cq-set > .lbl { margin-top: 8px; }
      .cq-srow { grid-template-columns: repeat(var(--n, 10), minmax(0, 1fr)); }
      .cq-srow > span:first-child { grid-column: 1 / -1; }
      .cq-col { height: 100px; }
      .cq-day .d { font-size: 10px; }
    }
  </style>`);

  // ---------- общие помощники ----------
  const L = (id, t, sub) => ({ id, t, sub });
  const mount = (el, cls) => { const d = document.createElement('div'); if (cls) d.className = cls; el.appendChild(d); return d; };
  const plainT = s => String(s || '').replace(/<[^>]+>/g, '');
  const tOf = (list, v) => { const x = list.find(o => o.v === v); return x ? plainT(x.t) : '—'; };
  const quizRef = QS => QS.map(cfg => cfg.options.map((o, i) => o.ok ? i : -1).filter(i => i >= 0));
  const mln = x => x.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' млн ₽';
  const fmtSec = s => s < 1 ? Math.round(s * 1000) + ' мс' : s < 60 ? s.toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' с' : Math.floor(s / 60) + ' мин' + (s % 60 ? ' ' + Math.round(s % 60) + ' с' : '');
  const lockSegs = (el, ro) => { if (ro) TR.$$('[data-seg] button', el).forEach(b => { b.disabled = true; }); };

  // =====================================================================
  // Теория 1. Команды и запросы. Соседний пример: табло загрузки тренажёрного зала
  // =====================================================================
  const VIEW = [50, 500, 2000, 5000, 10000, 30000];
  function boardSim(mode, n) {
    const qps = n / 10, cap = 8000, base = 3700;            // мс работы базы в секунду: 8 ядер; обычная работа + проходы
    const rho = mode === 'one' ? (base + qps * 8) / cap : base / cap;
    const turn = rho < 0.97 ? Math.round(60 + 40 * rho / (1 - rho)) : Infinity;
    return { qps, rho, turn };
  }
  function drawBoard(pane) {
    const st = { mode: 'one', k: 1 };
    pane.innerHTML = `<div class="stack">
      <div class="cq-box">
        <div class="cq-set">
          <div class="lbl">Откуда табло берёт цифру</div>${ui.seg('mode', [{ v: 'one', t: 'Из той же таблицы проходов, что и турникет' }, { v: 'split', t: 'Из отдельного счётчика — модели чтения' }], st.mode, 'accent')}
        </div>
        <label class="field"><span>Сколько людей смотрят табло (на экранах в клубах и в приложении): <b data-cqk></b></span><input type="range" class="cq-range" min="0" max="${VIEW.length - 1}" step="1" value="${st.k}" data-cqr aria-label="Сколько людей смотрят табло"></label>
      </div>
      <div data-cqflow></div>
      <div class="cq-stats" data-cqst></div>
      <div data-cqn></div>
    </div>`;
    function draw() {
      const n = VIEW[st.k], r = boardSim(st.mode, n), hot = r.rho >= 0.9;
      TR.$('[data-cqk]', pane).textContent = n.toLocaleString('ru-RU') + ' → ' + r.qps.toLocaleString('ru-RU') + ' запросов в секунду (обновление раз в 10 с)';
      TR.$('[data-cqflow]', pane).innerHTML = `<div class="cq-flow">
        <div class="cq-lane"><span class="cq-node">Турникет<small>20 проходов в секунду</small></span><span class="cq-arr">команда «впусти» →</span><span class="cq-node ${hot ? 'hot' : ''}">Ядро · PostgreSQL<small>таблица проходов</small></span>${st.mode === 'split' ? `<span class="cq-arr on">событие «вошёл / вышел» →</span><span class="cq-node rm">Модель чтения<small>счётчик «в зале сейчас»</small></span>` : ''}</div>
        <div class="cq-lane"><span class="cq-node">Табло и приложение<small>«в зале 37 человек»</small></span><span class="cq-arr ${st.mode === 'one' && hot ? 'bad' : st.mode === 'split' ? 'on' : ''}">запрос «сколько в зале?» · ${r.qps.toLocaleString('ru-RU')}/с →</span><span class="cq-node ${st.mode === 'one' ? (hot ? 'hot' : '') : 'rm'}">${st.mode === 'one' ? 'Ядро · та же таблица<small>count(*) по проходам</small>' : 'Модель чтения<small>готовое число</small>'}</span></div>
      </div>`;
      const over = r.rho >= 1;
      TR.$('[data-cqst]', pane).innerHTML = `
        <div class="stat"><span class="k">База ядра занята</span><span class="v ${over ? 'bad' : hot ? 'warn' : 'ok'}">${Math.round(r.rho * 100)} %</span><span class="s">${over ? 'очередь растёт без конца' : st.mode === 'split' ? 'табло её не трогает' : 'проходы + табло'}</span></div>
        <div class="stat"><span class="k">Турникет решает за</span><span class="v ${r.turn > 1000 ? 'bad' : r.turn > 300 ? 'warn' : 'ok'}">${r.turn === Infinity ? '> 1 с' : r.turn + ' мс'}</span><span class="s">${r.turn > 1000 ? 'люди стоят у входа' : 'нужно быстрее секунды'}</span></div>
        <div class="stat"><span class="k">Табло показывает</span><span class="v ${st.mode === 'one' ? 'ok' : 'warn'}">${st.mode === 'one' ? 'ровно сейчас' : '≈ 2 с назад'}</span><span class="s">${st.mode === 'one' ? 'считает по живой таблице' : 'счётчик обновляется событием'}</span></div>
        <div class="stat"><span class="k">Где считается</span><span class="v">${st.mode === 'one' ? 'при каждом показе' : 'один раз на событие'}</span><span class="s">${st.mode === 'one' ? r.qps.toLocaleString('ru-RU') + ' подсчётов в секунду' : '20 обновлений в секунду, сколько бы ни смотрели'}</span></div>`;
      let note;
      if (st.mode === 'one') note = over ? ui.note('bad', 'Чтение задушило запись', `${n.toLocaleString('ru-RU')} человек смотрят табло — это ${r.qps.toLocaleString('ru-RU')} подсчётов в секунду по той же таблице, куда турникет пишет проходы. База занята на ${Math.round(r.rho * 100)} %: проходы встают в очередь, турникет думает дольше секунды. Люди стоят у входа из-за того, что другие люди смотрят на табло.`)
        : hot ? ui.note('warn', 'На пределе', 'Турникет уже думает дольше обычного. Ещё немного зрителей — и вход встанет.')
          : ui.note('', 'Пока хватает', 'Зрителей мало, подсчёт дешёвый. Двигайте ползунок вправо: что будет в воскресенье вечером, когда табло открыто у тысяч людей?');
      else note = ui.note('ok', 'Команды отдельно, запросы отдельно', `Турникет пишет в ядро и отправляет событие «вошёл». Отдельный обработчик держит готовое число «в зале сейчас» в модели чтения. Табло читает готовое число — сколько бы людей ни смотрело, база ядра занята на ${Math.round(r.rho * 100)} %. Цена: табло отстаёт на пару секунд, и у нас теперь две модели данных вместо одной. Это и есть <b>CQRS</b> — разделение ответственности команд и запросов.`);
      TR.$('[data-cqn]', pane).innerHTML = note;
    }
    ui.onSeg(pane, (n, v) => { if (n === 'mode') { st.mode = v; draw(); } });
    TR.$('[data-cqr]', pane).addEventListener('input', e => { st.k = +e.target.value; draw(); });
    draw();
  }
  const OPS = [
    { id: 'in', t: 'Клиент проходит через турникет', ok: 'cmd', why: 'Меняет мир: в зале стало на одного больше, появилась строка посещения. Это <b>команда</b>: её выполняет ядро, с проверками — действует ли абонемент, тот ли клуб.' },
    { id: 'board', t: 'Табло на входе показывает «в зале 37 человек»', ok: 'qry', why: 'Только читает, ничего не меняет. Значит, можно читать из копии, которая чуть отстаёт.' },
    { id: 'book', t: 'Записаться на сайкл в пятницу 19:00', ok: 'cmd', why: 'Команда: занимает место. Решение «есть ли место» принимает только ядро — атомарным UPDATE в транзакции.' },
    { id: 'hours', t: 'Управляющий смотрит загрузку зала по часам за месяц', ok: 'qry', why: 'Запрос, причём тяжёлый: сотни тысяч проходов. Его место — в модели чтения, а не в базе, которая пускает людей в зал.' },
    { id: 'freeze', t: 'Заморозить абонемент на 14 дней', ok: 'cmd', why: 'Команда: меняет срок абонемента и проверяет правила заморозки (до 30 дней в год, кусок не меньше 7 дней).' },
    { id: 'mine', t: '«Мои записи» — сразу после того, как клиент нажал «Записаться»', ok: 'qry', why: 'Это запрос — но особый: клиент только что сам что-то изменил и ждёт это увидеть. Такой запрос читают из ядра, а не из модели чтения. Посмотрите вкладку «Отставание».' }
  ];
  function drawOps(pane) {
    const open = {};
    function draw() {
      pane.innerHTML = `<div class="stack">
        <p class="small muted">Команда меняет данные и отвечает «сделано» или «нельзя». Запрос только читает и ничего не меняет. Решите сами для каждой строки, потом смотрите ответ.</p>
        ${OPS.map(c => {
          const g = open[c.id];
          return `<div class="cq-case"><div><b>${esc(c.t)}</b></div>
            <div class="row"><button type="button" class="btn xs" data-cqo="${c.id}|cmd" aria-pressed="${g === 'cmd'}">Команда — меняет</button><button type="button" class="btn xs" data-cqo="${c.id}|qry" aria-pressed="${g === 'qry'}">Запрос — только читает</button></div>
            ${g ? ui.note(g === c.ok ? 'ok' : 'warn', g === c.ok ? 'Верно' : 'Посмотрите ещё раз', c.why) : ''}</div>`;
        }).join('')}
        ${ui.note('info', 'Зачем делить', 'У команд и запросов разные заботы. Командам нужны проверки, транзакции и точность до последней записи. Запросам — скорость, удобная форма и умение выдержать тысячи читателей. CQRS (Command Query Responsibility Segregation) — когда для них заводят <b>разные модели</b>: команды пишут в одну, запросы читают из другой, удобной для чтения.')}
      </div>`;
    }
    TR.on(pane, 'click', '[data-cqo]', (e, b) => { const [id, v] = b.dataset.cqo.split('|'); open[id] = v; draw(); });
    draw();
  }
  const LAGS = [{ s: 1, t: '1 секунда' }, { s: 5, t: '5 секунд' }, { s: 30, t: '30 секунд' }, { s: 60, t: '1 минута' }, { s: 600, t: '10 минут' }, { s: 10800, t: '3 часа' }];
  function lagScreens(s, mine) {
    const out = [];
    out.push(s <= 60 ? { k: 'ok', t: 'Табло загрузки зала', v: '«В зале 37» — данные пару секунд назад', why: 'Для табло секунды не важны.' }
      : s <= 600 ? { k: 'warn', t: 'Табло загрузки зала', v: '«В зале 37», а пришли уже 52 — вечерний наплыв', why: 'Клиент приехал «в пустой зал» и ждёт тренажёр.' }
        : { k: 'bad', t: 'Табло загрузки зала', v: 'Показывает дневную пустоту, а зал полон', why: 'Табло вредит: им перестают верить.' });
    out.push({ k: 'ok', t: 'Отчёт директора за вчера', v: s >= 3600 ? 'Вчерашний день целиком — отставание в 3 часа ночью не видно' : 'Вчерашний день целиком', why: 'Отчёт раз в сутки: отставание в минуты и даже часы не мешает.' });
    out.push(s <= 5 ? { k: 'ok', t: '«Свободно мест: 2» в расписании', v: 'Почти всегда правда', why: 'Показываем из копии, решаем в ядре.' }
      : s <= 60 ? { k: 'warn', t: '«Свободно мест: 2» в расписании', v: 'Иногда мест уже нет: ядро ответит 409 и предложит лист ожидания', why: 'Терпимо: показать можно из копии, решение о записи — только в ядре.' }
        : { k: 'bad', t: '«Свободно мест: 2» в расписании', v: 'Часто врёт: «2 места», а занятие давно полное', why: 'Клиенты злятся на каждый отказ.' });
    out.push(mine === 'core' ? { k: 'ok', t: '«Мои записи» сразу после «Записаться»', v: 'Новая запись видна сразу', why: 'Читаем из ядра: клиент видит то, что сам только что сделал.' }
      : { k: 'bad', t: '«Мои записи» сразу после «Записаться»', v: `Записался — а в списке пусто ещё ${LAGS.find(x => x.s === s).t}`, why: 'Клиент жмёт «Записаться» ещё раз или звонит в клуб. Даже секунды хватает.' });
    return out;
  }
  function drawLag(pane) {
    const st = { k: 1, mine: 'read' };
    pane.innerHTML = `<div class="stack">
      <div class="cq-box">
        <label class="field"><span>Модель чтения отстаёт от ядра на: <b data-cqk></b></span><input type="range" class="cq-range" min="0" max="${LAGS.length - 1}" step="1" value="${st.k}" data-cqr aria-label="Отставание модели чтения"></label>
        <div class="cq-set"><div class="lbl">«Мои записи» читаем</div>${ui.seg('mine', [{ v: 'read', t: 'Из модели чтения — как всё остальное' }, { v: 'core', t: 'Из ядра' }], st.mine, 'accent')}</div>
      </div>
      <div class="cq-screens" data-cqs></div>
      <div data-cqn></div>
    </div>`;
    function draw() {
      const s = LAGS[st.k].s, scr = lagScreens(s, st.mine);
      TR.$('[data-cqk]', pane).textContent = LAGS[st.k].t;
      TR.$('[data-cqs]', pane).innerHTML = scr.map(x => `<div class="cq-tile ${x.k}"><b>${esc(x.t)}</b><span>${esc(x.v)}</span><small>${esc(x.why)}</small></div>`).join('');
      const bad = scr.filter(x => x.k === 'bad').length;
      TR.$('[data-cqn]', pane).innerHTML = (st.mine === 'read'
        ? ui.note('bad', 'Модель чтения — всегда немного в прошлом', 'Она собирается из событий <b>после</b> того, как команда выполнена. Поэтому «0 секунд» не бывает. Экрану, где человек смотрит на результат своего же действия, нужна правда «прямо сейчас» — это называют <b>read-your-writes</b>: «прочитай то, что сам записал». Переключите «Мои записи» на ядро.')
        : bad ? ui.note('warn', 'Отставание слишком большое', `Экранов, которым оно мешает: ${bad}. Такое отставание — уже авария модели чтения: её надо мониторить и чинить.`)
          : ui.note('ok', 'Каждому экрану — своё допустимое отставание', 'Канон «Пульса»: модель чтения в ClickHouse отстаёт до 1 минуты — отчётам и загрузке залов этого хватает. «Мои записи» читаем из ядра.')) +
        ui.note('info', 'Позиция аналитика', 'Для каждого экрана аналитик пишет в требованиях: откуда он читает и какое отставание допустимо («загрузка залов — не старше 1 минуты», «мои записи — сразу»). Без этой строчки разработчик выберет сам — и обычно одинаково для всех.');
    }
    ui.onSeg(pane, (n, v) => { if (n === 'mine') { st.mine = v; draw(); } });
    TR.$('[data-cqr]', pane).addEventListener('input', e => { st.k = +e.target.value; draw(); });
    draw();
  }
  const howCqrs = {
    id: 'how-cqrs', covers: ['report-lab', 'no-cqrs'], title: 'Как это работает: команды отдельно, запросы отдельно', free: true, noReset: true,
    simple: {
      icon: '📺',
      plain: 'Одни действия меняют данные, другие только смотрят. Если смотрящих тысячи, им дают отдельную, удобную для чтения копию — и они не мешают тем, кто меняет.',
      analogy: 'Администратор на ресепшене пропускает людей и записывает каждого в журнал. Если каждый, кто хочет узнать «сколько народу в зале», будет подходить к администратору и просить пересчитать журнал, — очередь на вход встанет. Поэтому над входом вешают табло: администратор после каждого прохода меняет на нём цифру, а любопытные смотрят на табло и администратора не трогают.',
      tech: '<b>Команда</b> меняет состояние (записаться, пройти, заморозить). <b>Запрос</b> только читает. <b>CQRS</b> (Command Query Responsibility Segregation) — разные модели для записи и для чтения: команды идут в модель записи (у «Пульса» — PostgreSQL ядра), запросы читают <b>модель чтения</b>, которая собирается из событий и отстаёт на секунды. Плата — две модели, отставание и работа по их поддержке.'
    },
    lead: ui.brief({
      situation: 'Соседний пример. В каждом клубе над входом висит табло «сколько людей в тренажёрном зале», и то же число есть в приложении. Турникеты пускают людей — это запись в базу. Табло смотрят тысячи людей — это чтение. Пока всё в одной таблице.',
      todo: [
        'Вкладка «Табло зала»: оставьте «из той же таблицы» и двигайте ползунок до 30 000 зрителей. Когда турникет начинает думать дольше секунды?',
        'Переключите на «отдельный счётчик» и снова дойдите до 30 000. Что стало с базой и турникетом? Чем пришлось заплатить?',
        'Вкладка «Команда или запрос»: разберите шесть действий сами, потом читайте ответ.',
        'Вкладка «Отставание»: двигайте отставание от 1 секунды до 3 часов и смотрите на четыре экрана. Потом переключите «Мои записи» на ядро.'
      ],
      look: 'На схеме верхняя строка — путь команды, нижняя — путь запроса. Красная рамка — база перегружена. На вкладке «Отставание» зелёная карточка — экрану отставание не мешает, жёлтая — мешает иногда, красная — клиент видит неправду.'
    }),
    render(el) {
      el.classList.add('cq-root');
      ui.tabs(mount(el), [
        { id: 'board', t: 'Табло зала', render: pane => drawBoard(pane) },
        { id: 'ops', t: 'Команда или запрос', render: pane => drawOps(pane) },
        { id: 'lag', t: 'Отставание', render: pane => drawLag(pane) }
      ], 'board');
    }
  };

  // =====================================================================
  // Теория 2. Проекция из событий и её перестройка. Соседний пример: то же табло зала
  // =====================================================================
  const GYM = [
    { id: 'e1', t: '18:00', k: 'in', c: 'c-17' },
    { id: 'e2', t: '18:02', k: 'in', c: 'c-42' },
    { id: 'e3', t: '18:05', k: 'in', c: 'c-08' },
    { id: 'e4', t: '18:20', k: 'out', c: 'c-17' },
    { id: 'e5', t: '18:21', k: 'in', c: 'c-93' },
    { id: 'e5', t: '18:21', k: 'in', c: 'c-93', dup: true },
    { id: 'e6', t: '18:40', k: 'in', c: 'c-51' },
    { id: 'e7', t: '18:55', k: 'out', c: 'c-42' },
    { id: 'e8', t: '19:02', k: 'in', c: 'c-64' },
    { id: 'e9', t: '19:10', k: 'out', c: 'c-08' },
    { id: 'e10', t: '19:12', k: 'in', c: 'c-17' }
  ];
  function gymProj(k, dedup) {
    const seen = new Set(), marks = [], hours = { '18': 0, '19': 0 };
    let now = 0, peak = 0, entries = 0, last = '—';
    for (let i = 0; i < k; i++) {
      const e = GYM[i];
      if (dedup && seen.has(e.id)) { marks[i] = 'skip'; continue; }
      seen.add(e.id); marks[i] = 'done';
      if (e.k === 'in') { now++; entries++; hours[e.t.slice(0, 2)]++; } else now--;
      peak = Math.max(peak, now); last = e.t;
    }
    return { now, peak, entries, hours, last, marks };
  }
  function drawTimeline(pane) {
    const st = { k: 0, dedup: 'no' };
    pane.innerHTML = `<div class="stack">
      <div class="cq-box">
        <label class="field"><span>Проекция прочитала событий: <b data-cqk></b></span><input type="range" class="cq-range" min="0" max="${GYM.length}" step="1" value="0" data-cqr aria-label="Сколько событий прочитано"></label>
        <div class="cq-set"><div class="lbl">Если событие пришло второй раз</div>${ui.seg('dedup', [{ v: 'no', t: 'Считаем как новое' }, { v: 'yes', t: 'Отсекаем по eventId — уже обработано' }], st.dedup, 'accent')}</div>
      </div>
      <div class="cq-two">
        <div class="stack tight"><div class="eyebrow">Журнал событий турникетов · клуб на Соколе</div><div class="cq-tl" data-cqtl></div></div>
        <div class="stack tight" data-cqp></div>
      </div>
      <div data-cqn></div>
    </div>`;
    function draw() {
      const p = gymProj(st.k, st.dedup === 'yes'), truth = gymProj(GYM.length, true);
      TR.$('[data-cqk]', pane).textContent = `${st.k} из ${GYM.length}`;
      TR.$('[data-cqtl]', pane).innerHTML = GYM.map((e, i) => {
        const cls = i === st.k - 1 ? (p.marks[i] === 'skip' ? 'skip cur' : 'cur') : i < st.k ? p.marks[i] : '';
        return `<div class="cq-ev ${cls}"><span class="tm">${e.t}</span><span>${e.k === 'in' ? 'Вошёл' : 'Вышел'} · клиент <code>${e.c}</code> · <span class="dim">eventId ${e.id}</span></span>${e.dup ? '<span class="tag">повтор доставки</span>' : '<span></span>'}</div>`;
      }).join('');
      const wrong = st.k === GYM.length && p.now !== truth.now;
      TR.$('[data-cqp]', pane).innerHTML = `
        <div class="cq-kv"><span class="h">Модель чтения 1 · «Табло»</span><span>В зале сейчас</span><b class="${wrong ? 'bad' : ''}">${p.now}</b><span>Пик за вечер</span><b>${p.peak}</b><span>Входов за вечер</span><b class="${wrong ? 'bad' : ''}">${p.entries}</b><span>Данные на</span><b>${p.last}</b></div>
        <div class="cq-kv"><span class="h">Модель чтения 2 · «Входы по часам»</span><span>18:00–19:00</span><b>${p.hours['18']}</b><span>19:00–20:00</span><b>${p.hours['19']}</b></div>`;
      const cur = GYM[st.k - 1];
      let n;
      if (!st.k) n = ui.note('', 'Пустая модель', 'Проекция ещё ничего не прочитала — и ничего не знает. Двигайте ползунок: каждое событие по очереди меняет обе модели.');
      else if (cur.dup && st.dedup === 'no') n = ui.note('bad', 'Повтор посчитан дважды', `Событие <code>${cur.id}</code> пришло второй раз (брокер доставляет «хотя бы один раз»). Проекция решила, что вошёл ещё один человек. ${st.k === GYM.length ? '' : 'Дочитайте до конца — '}табло будет врать на одного человека весь вечер. Включите «Отсекаем по eventId».`);
      else if (cur.dup) n = ui.note('ok', 'Повтор отсечён', `Событие <code>${cur.id}</code> уже обработано — проекция помнит его eventId и пропускает. Обновлять модель чтения нужно <b>идемпотентно</b>.`);
      else n = ui.note(st.k === GYM.length ? (wrong ? 'bad' : 'ok') : '', `Событие ${st.k}: ${cur.k === 'in' ? 'вошёл' : 'вышел'} клиент ${cur.c}`, st.k === GYM.length
        ? (wrong ? `Дочитали журнал: в зале ${p.now}, а на самом деле ${truth.now}. Ошибка — из-за повтора.` : `Дочитали журнал: в зале ${p.now} — как на самом деле. Две разные модели чтения собраны из одного и того же журнала: у каждого экрана может быть своя.`)
        : `Проекция берёт событие и меняет свои числа: ${cur.k === 'in' ? '«в зале» +1, «входов» +1, час ' + cur.t.slice(0, 2) + ':00 +1' : '«в зале» −1'}. Больше она ничего не делает — ни проверок, ни запросов в ядро.`);
      TR.$('[data-cqn]', pane).innerHTML = n + ui.note('info', 'Что такое проекция', 'Проекция — обработчик, который читает события по порядку и складывает из них модель чтения. Модель чтения — просто результат «прочитали N событий». Отсюда два следствия: нет событий — нет данных; прочитали не с того места — данные неполные.');
    }
    ui.onSeg(pane, (n, v) => { if (n === 'dedup') { st.dedup = v; draw(); } });
    TR.$('[data-cqr]', pane).addEventListener('input', e => { st.k = +e.target.value; draw(); });
    draw();
  }
  const WEEK = [{ d: 'Пн', n: 410 }, { d: 'Вт', n: 385 }, { d: 'Ср', n: 402 }, { d: 'Чт до 12:00', n: 160 }, { d: 'Чт после 12:00', n: 230, after: true }];
  function drawRebuild(pane) {
    const st = { m: '' };
    pane.innerHTML = `<div class="stack">
      <p class="small muted">Четверг, 12:00. Управляющие попросили добавить на табло «среднее время в зале». Старую модель чтения меняем: создаём новую таблицу и наполняем её заново из журнала. Журнал турникетов хранит всё с понедельника. С какого места читать?</p>
      <div class="row"><button type="button" class="btn sm" data-cqm="latest" aria-pressed="false">Перестроить: читать с текущего места</button><button type="button" class="btn sm" data-cqm="earliest" aria-pressed="false">Перестроить: читать с начала журнала</button></div>
      <div data-cqbars></div>
      <div data-cqn></div>
      <div class="eyebrow" style="margin-top:6px">Как перестраивают без простоя</div>
      <div data-cqseq></div>
    </div>`;
    function draw() {
      TR.$$('[data-cqm]', pane).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cqm === st.m)));
      const max = 420;
      const got = w => !st.m ? 0 : st.m === 'earliest' || w.after ? w.n : 0;
      TR.$('[data-cqbars]', pane).innerHTML = `<div class="cq-days" style="--n:${WEEK.length}">${WEEK.map(w => {
        const g = got(w), lost = st.m && !g;
        return `<div class="cq-day"><div class="cq-col"><div class="g" style="height:${w.n / max * 100}%"></div>${g ? `<div class="f" style="height:${g / max * 100}%"></div>` : ''}${lost ? '<div class="x">✕</div>' : ''}</div><span class="d"><b>${esc(w.d)}</b><br>${g}/${w.n}</span></div>`;
      }).join('')}</div>
      <div class="cq-legend"><span><i style="border:1.5px dashed var(--text-muted)"></i>событий в журнале</span><span><i style="background:var(--ok)"></i>попало в новую модель</span><span style="color:var(--bad)">✕ — пропало</span></div>`;
      const lost = WEEK.filter(w => !w.after).reduce((s, w) => s + w.n, 0);
      TR.$('[data-cqn]', pane).innerHTML = !st.m ? ui.note('', 'Выберите способ', 'Нажмите обе кнопки по очереди и сравните.')
        : st.m === 'latest' ? ui.note('bad', `Пропало ${lost.toLocaleString('ru-RU')} событий`, '«С текущего места» — значит, новая модель узнает только о том, что случится после перестройки. Понедельник, вторник, среда и утро четверга для неё не существуют: «входов за неделю» — 230, «среднее время» — по одному вечеру. Ошибки никто не увидит: модель просто молча неполная.')
          : ui.note('ok', 'Ничего не пропало', `Новая модель перечитала все ${WEEK.reduce((s, w) => s + w.n, 0).toLocaleString('ru-RU')} событий с понедельника, догнала настоящее время и дальше читает как обычно. Здесь это 2 секунды; в «Пульсе» — миллионы событий и часы. Но это работает, <b>только если журнал помнит начало</b>. Сколько дней хранит ваш журнал — первый вопрос перед любой перестройкой.`);
    }
    TR.on(pane, 'click', '[data-cqm]', (e, b) => { st.m = b.dataset.cqm; draw(); });
    draw();
    ui.seq(TR.$('[data-cqseq]', pane), {
      title: 'Перестройка модели чтения без простоя', laneW: 150,
      hint: 'Нажимайте «Шаг →» и читайте пояснение под схемой.',
      lanes: [L('jr', 'Журнал событий', 'с понедельника'), L('v1', 'Табло v1', 'старая модель'), L('v2', 'Табло v2', 'новая модель'), L('scr', 'Экраны табло', 'клуб и приложение')],
      steps: [
        { from: 'v2', to: 'v2', t: 'создать пустую v2\n+ «среднее время»', note: 'Новую модель строят рядом со старой. Старая продолжает отвечать — табло не гаснет.' },
        { from: 'jr', to: 'v2', t: 'читать с начала журнала', kind: 'accent', note: 'Новая группа потребителей читает журнал с самого первого события, а не «с текущего места».' },
        { from: 'v2', to: 'v2', t: 'догоняет:\nотставание 3 дня → 0', note: 'Пока v2 догоняет, её никто не показывает. Сколько осталось — видно по метрике отставания потребителя.' },
        { from: 'v1', to: 'v2', t: 'сверить итоги по дням', kind: 'warn', box: true, note: 'Перед переключением сравнивают итоги: входов за каждый день в v1 и v2 должно быть поровну. Разошлось — ищем причину до переключения, а не после жалобы.' },
        { from: 'scr', to: 'v2', t: 'читать из v2', kind: 'ok', note: 'Переключаем чтение на v2. Никто ничего не заметил.' },
        { from: 'v1', to: 'v1', t: 'удалить v1 через неделю', note: 'Старую модель держат ещё немного — на случай отката.' }
      ]
    });
  }
  const howProj = {
    id: 'how-proj', covers: ['proj-design', 'rebuild-lab'], title: 'Как это работает: модель чтения собирается из событий', free: true, noReset: true,
    simple: {
      icon: '🧮',
      plain: 'Модель чтения — это итог, который кто-то посчитал, читая журнал событий по порядку. Прочитал не всё — итог неправильный.',
      analogy: 'Табло «в зале 37 человек» ведёт помощник администратора. Он сидит у журнала входов и выходов и на каждую строчку делает +1 или −1. Если его подменят в обед и новый помощник начнёт «с текущей строчки», утренние посетители для него не существуют. Если строчку случайно переписали дважды, а помощник не сверяет номера строк, — на табло на одного человека больше.',
      tech: '<b>Проекция</b> — обработчик, который читает события по порядку и обновляет модель чтения. Должна быть <b>идемпотентной</b> (повтор события по <code>eventId</code> не меняет результат). <b>Перестройка проекции</b> (replay) — заново наполнить модель, перечитав журнал; читать надо с начала истории, а не с текущей позиции. Перестраивают рядом со старой моделью, сверяют итоги и только потом переключают чтение.'
    },
    lead: ui.brief({
      situation: 'Тот же соседний пример — табло зала. Турникеты клуба на Соколе пишут в журнал события «вошёл» и «вышел». Из одного журнала собираются две модели чтения: «Табло» и «Входы по часам».',
      todo: [
        'Вкладка «Шкала событий»: двигайте ползунок от 0 до 11 и смотрите, как каждое событие меняет обе модели. Что случилось на шестом событии?',
        'Переключите «Отсекаем по eventId» и дочитайте журнал до конца. Сходится ли число людей в зале?',
        'Вкладка «Перестройка»: нажмите обе кнопки. Что пропало при «с текущего места»? При каком условии «с начала» работает?',
        'Пройдите по шагам перестройку без простоя.'
      ],
      look: 'Слева — журнал: обработанные события подсвечены, текущее — в рамке, отсечённый повтор зачёркнут. Справа — модели чтения: красное число — расходится с правдой. На вкладке «Перестройка» пунктир — сколько событий в журнале за день, зелёный столбик — сколько попало в новую модель.'
    }),
    render(el) {
      el.classList.add('cq-root');
      ui.tabs(mount(el), [
        { id: 'tl', t: 'Шкала событий', render: pane => drawTimeline(pane) },
        { id: 'rb', t: 'Перестройка', render: pane => drawRebuild(pane) }
      ], 'tl');
    }
  };

  // =====================================================================
  // Теория 3. Event sourcing: журнал операций вместо одной цифры. Соседний пример: бонусный счёт Анны
  // =====================================================================
  const BOPS = [
    { d: '02.09', v: 500, why: 'привела подругу' },
    { d: '05.09', v: 10, why: 'посещение' },
    { d: '07.09', v: 10, why: 'посещение' },
    { d: '07.09', v: 10, why: 'посещение — турникет дослал тот же проход второй раз', dup: true },
    { d: '12.09', v: 10, why: 'посещение' },
    { d: '20.09', v: -300, why: 'оплатила бонусами 30 % разового посещения за 1 000 ₽' },
    { d: '26.09', v: 10, why: 'посещение' }
  ];
  const BQ = [
    { id: 'now', t: 'Сколько бонусов сейчас?' },
    { id: 'past', t: 'Сколько было на 10 сентября?' },
    { id: 'why', t: 'Анна спорит: «Посещений было пять, откуда столько?»' },
    { id: 'fix', t: 'Исправить ошибку начисления' },
    { id: 'rep', t: 'Новый отчёт: сколько начислено за посещения в сентябре' }
  ];
  function drawES(pane) {
    const st = { mode: 'state', q: '', fixed: false };
    pane.innerHTML = `<div class="stack">
      <div class="cq-box"><div class="cq-set"><div class="lbl">Что храним о бонусном счёте</div>${ui.seg('mode', [{ v: 'state', t: 'Состояние: одну цифру остатка' }, { v: 'events', t: 'События: журнал всех операций' }], st.mode, 'accent')}</div></div>
      <div class="cq-two"><div class="stack tight" data-cqstore></div><div class="stack tight"><div class="eyebrow">Вопросы к счёту</div><div class="row" data-cqqs></div><div data-cqans></div></div></div>
      <div data-cqn></div>
    </div>`;
    function ops() { return st.fixed ? BOPS.concat([{ d: '01.10', v: -10, why: 'сторно: двойное начисление 07.09', fix: true }]) : BOPS; }
    function draw() {
      const list = ops(), bal = list.reduce((s, o) => s + o.v, 0);
      const stateBal = st.fixed && st.mode === 'state' ? 240 : 250;
      TR.$('[data-cqstore]', pane).innerHTML = st.mode === 'state'
        ? `<div class="eyebrow">Таблица bonus_account</div><div class="cq-row1">client: Анна<br>balance: <b>${stateBal}</b><br>updated_at: ${st.fixed ? '01.10 10:02' : '26.09 19:14'}</div><p class="small muted">Одна строка. Каждая операция переписывает число — старое значение пропадает.</p>`
        : `<div class="eyebrow">Журнал операций · только дописываем</div><div class="cq-acct">${list.map(o => `<div class="cq-op ${o.dup && st.q === 'why' ? 'hl' : ''} ${o.fix ? 'fix' : ''}"><span class="small dim">${o.d}</span><span class="n ${o.v > 0 ? 'p' : 'm'}">${o.v > 0 ? '+' : '−'}${Math.abs(o.v)}</span><span class="small">${esc(o.why)}</span></div>`).join('')}</div><p class="small muted">Остаток = сумма всех операций = <b>${bal}</b>. Прошлое не переписываем никогда.</p>`;
      TR.$('[data-cqqs]', pane).innerHTML = BQ.map(q => `<button type="button" class="btn xs" data-cqq="${q.id}" aria-pressed="${st.q === q.id}">${esc(q.t)}</button>`).join('');
      const A = {
        state: {
          now: ['ok', `${stateBal} — мгновенно: одна строка, одно число.`],
          past: ['bad', 'Неизвестно. Хранится только последнее число — история перезаписана.'],
          why: ['bad', 'Ответить нечем: «у вас 250, так посчитала система». Анна уходит недовольной.'],
          fix: ['warn', 'UPDATE balance = 240. Готово — но следов нет: через месяц никто не поймёт, куда делись 10 бонусов и кто это сделал.'],
          rep: ['bad', 'Нельзя: из одной цифры остатка историю не восстановить.']
        },
        events: {
          now: ['warn', `${bal} — но надо сложить все операции. У постоянного клиента их тысячи, поэтому рядом хранят готовый остаток (снимок) и досчитывают только хвост.`],
          past: ['ok', 'Складываем операции до 10.09: 500 + 10 + 10 + 10 = <b>530</b>.'],
          why: ['ok', 'Видно сразу: 07.09 два начисления за один и тот же проход (подсвечено). Пять посещений — это 50, а начислено 60.'],
          fix: ['ok', 'Добавляем новую операцию «−10, сторно двойного начисления 07.09» (подсвечено синим). Прошлое не трогаем — ошибка и её исправление видны в истории.'],
          rep: ['ok', `Пересчитываем из журнала: начислено за посещения ${list.filter(o => /посещение/.test(o.why)).reduce((s, o) => s + o.v, 0)}${st.fixed ? ' и −10 сторно' : ''}. Новый отчёт можно построить по всей истории — даже если о нём не думали, когда запускали бонусы.`]
        }
      };
      const a = st.q ? A[st.mode][st.q] : null;
      TR.$('[data-cqans]', pane).innerHTML = a ? ui.note(a[0], BQ.find(q => q.id === st.q).t, a[1]) : '<p class="small muted">Нажмите вопрос — и сравните ответ в обоих режимах.</p>';
      TR.$('[data-cqn]', pane).innerHTML = ui.note('info', 'Event sourcing и «Пульс»', '<b>Event sourcing</b> — когда источник истины — журнал событий, а текущее состояние из него вычисляется. Это не то же самое, что CQRS: модель чтения «Пульса» собирается из событий, но источник истины — таблицы ядра в PostgreSQL. Сервис «Бонусы» хранит операции по счёту — по сути журнал. А Kafka хранит события <b>7 дней</b> — это журнал доставки, а не вечная история: перечитать из неё «всё с первого дня» нельзя.');
    }
    ui.onSeg(pane, (n, v) => { if (n === 'mode') { st.mode = v; draw(); } });
    TR.on(pane, 'click', '[data-cqq]', (e, b) => { st.q = b.dataset.cqq; if (st.q === 'fix') st.fixed = true; draw(); });
    draw();
  }
  const howES = {
    id: 'how-es', covers: ['rebuild-lab'], title: 'Как это работает: журнал операций вместо одной цифры', free: true, noReset: true,
    simple: {
      icon: '📒',
      plain: 'Можно хранить только итог («на счёте 250»), а можно — все операции, из которых итог складывается. Второе позволяет ответить на любой вопрос о прошлом.',
      analogy: 'Банковское приложение показывает остаток, но под ним — выписка: каждая покупка и каждое пополнение. Ошибку банк не стирает, а добавляет новую строку «возврат». По выписке всегда можно понять, откуда взялся остаток и каким он был в любой день.',
      tech: '<b>Event sourcing</b> — хранение состояния как последовательности событий: текущее значение = свёртка журнала, исправления — новыми событиями (сторно), прошлое неизменно. Плюсы: полная история, аудит, новые модели чтения по всей истории. Минусы: сложнее читать «сейчас» (нужны снимки), сложнее менять схему событий. С CQRS часто идёт в паре, но это разные решения.'
    },
    lead: ui.brief({
      situation: 'Соседний пример: бонусный счёт Анны за сентябрь. +500 за подругу, +10 за каждое посещение, −300 при оплате разового посещения бонусами. В одном месте закралась ошибка.',
      todo: [
        'В режиме «Состояние» нажмите все пять вопросов по очереди. На какие можно ответить?',
        'Переключите на «События» и пройдите те же вопросы.',
        'Подумайте: какой из двух режимов похож на Kafka с хранением 7 дней — и чего в нём не хватает?'
      ],
      look: 'Слева — что лежит в хранилище. Справа — ответ на выбранный вопрос: зелёный — ответить легко, жёлтый — можно, но с оговоркой, красный — нельзя.'
    }),
    render(el) { el.classList.add('cq-root'); drawES(mount(el)); }
  };

  // =====================================================================
  // Практика 1. Лаборатория «Отчёт директора»: ядро, реплика или модель чтения
  // =====================================================================
  const RSRC = [
    { v: 'core', t: 'Запрос в ядро — мастер PostgreSQL' },
    { v: 'replica', t: 'Асинхронная реплика PostgreSQL' },
    { v: 'ch', t: 'Модель чтения в ClickHouse' }
  ];
  const RREP = [
    { v: 'rev', t: 'Выручка по клубам за месяц', pg: 35, ch: 0.3, miss: '' },
    { v: 'load', t: 'Загрузка занятий и залов за квартал', pg: 240, ch: 0.8, miss: 'нет фактических проходов: посещения живут в сервисе «Доступ», в базе ядра их нет' },
    { v: 'churn', t: 'Отток: кто перестал ходить и копит бонусы', pg: 160, ch: 1.2, miss: 'нет проходов (сервис «Доступ») и бонусов (сервис «Бонусы»)' }
  ];
  const RWHEN = [{ v: 'mon', t: 'Пн 09:00 — обычное утро' }, { v: 'sun', t: 'Вс 20:00 — пик записи' }];
  const RCRIT = [
    { id: 'fast', t: 'Отчёт открывается быстрее 10 секунд', s: 'Ольга смотрит с телефона' },
    { id: 'book', t: 'Запись не страдает: p95 ≤ 300 мс', s: 'даже если отчёт открыли в воскресенье 20:00' },
    { id: 'sched', t: 'Расписание с реплик не тормозит', s: 'в пик реплики отдают ~1 000 чтений расписания в секунду' },
    { id: 'full', t: 'Данные полные', s: 'записи, проходы, бонусы — у разных владельцев' },
    { id: 'fresh', t: 'Данные не старше суток', s: 'Ольге «раз в сутки достаточно»' }
  ];
  function repSim(src, rep, when) {
    const R = RREP.find(r => r.v === rep), peak = when === 'sun';
    const r = { crit: {}, why: {} };
    r.time = src === 'ch' ? R.ch : R.pg;
    r.p95 = src === 'core' ? (peak ? 1900 : 210) : (peak ? 250 : 140);
    r.sched = src === 'replica' && peak ? 900 : peak ? 120 : 60;
    r.fresh = src === 'core' ? '0 с' : src === 'replica' ? (peak ? '≈ 40 с, растёт' : '≈ 1 с') : 'до 1 мин';
    r.full = src === 'ch' || !R.miss;
    r.crit.fast = r.time <= 10; r.crit.book = r.p95 <= 300; r.crit.sched = r.sched <= 300; r.crit.full = r.full; r.crit.fresh = true;
    r.why.fast = r.crit.fast ? `${fmtSec(r.time)}: ClickHouse хранит данные по столбцам и считает суммы по миллионам строк за доли секунды.` : `${fmtSec(r.time)}: PostgreSQL перебирает миллионы строк платежей, записей и посещений, соединяя таблицы. Он создан для коротких транзакций, а не для сумм за квартал.`;
    r.why.book = src === 'core' ? (peak ? 'Отчёт съел процессор и диск мастера — те же, на которых идут 400 записей в секунду. p95 записи 1,9 с: клиенты видят крутилку.' : 'Утром запись почти не идёт — отчёт её не задел. Но откройте этот же отчёт в воскресенье 20:00.') : 'Мастер отчёт не видит — запись работает как обычно.';
    r.why.sched = src === 'replica' ? (peak ? 'Реплика, на которой строится отчёт, в пик отдаёт расписание. Отчёт забрал её ресурсы: расписание отвечает 900 мс, а отставание реплики растёт — клиенты видят старые свободные места.' : 'Утром реплики почти свободны — отчёт не мешает. А в воскресенье 20:00?') : 'Реплики расписания отчёт не трогает.';
    r.why.full = r.full ? (src === 'ch' ? 'Модель чтения собирается из событий всех владельцев: записи, проходы, бонусы — в одном месте.' : 'Для выручки хватает платежей и возвратов — они в ядре.') : `Неполный отчёт: ${R.miss}. Реплика ядра — копия только базы ядра.`;
    r.why.fresh = src === 'ch' ? 'Отстаёт до минуты — для отчёта раз в сутки с запасом.' : 'Свежее не бывает — но отчёту это и не нужно.';
    r.green = RCRIT.every(c => r.crit[c.id]);
    return r;
  }
  const RROWS = [
    { id: 'dir', t: 'Отчёты Ольги: выручка, загрузка, отток', sub: 'раз в сутки, тяжёлые суммы по данным разных сервисов', ok: 'ch', alt: {}, why: 'Тяжёлые суммы по данным разных владельцев, отставание в минуту не важно — модель чтения.' },
    { id: 'mgr', t: 'Загрузка залов для управляющих клубами', sub: 'экран обновляется раз в минуту, 60 клубов', ok: 'ch', alt: {}, why: 'Отставание до минуты допустимо, а считать загрузку по живым таблицам ядра каждую минуту для 60 клубов — лишняя нагрузка.' },
    { id: 'sched', t: 'Расписание клуба в приложении', sub: '~1 000 чтений в секунду в пик, свободные места', ok: 'replica', alt: { core: 'Ядро справится, но мастер нужен записи. Расписание — то, ради чего у «Пульса» реплики и кэш (неделя 7, вторник).' }, why: 'Реплики + кэш Redis с TTL 30 с: тысячи мелких чтений по ключу, отставание в секунды терпимо, решение о записи всё равно в ядре.' },
    { id: 'mine', t: '«Мои записи» сразу после «Записаться»', sub: 'клиент проверяет, что записался', ok: 'core', alt: {}, crit: true, why: 'Read-your-writes: только ядро. С реплики — «запись пропала» (инцидент сезона 1), из модели чтения — то же, только хуже.' }
  ];
  const RQ = {
    q: 'В сезоне 1 отчёты директора шли с асинхронной реплики — и это было правильно. Почему теперь нужна модель чтения в ClickHouse?', seed: 'cq-rep-q',
    options: [
      { t: 'Реплики теперь отдают расписание в пик — тяжёлый отчёт отнимает у них ресурсы и растит отставание; а проходов и бонусов в базе ядра нет вовсе: они у других сервисов', ok: 1, why: 'Верно. Изменились две вещи: реплики стали частью пути клиента, а данные разъехались по владельцам. Модель чтения собирает данные всех владельцев из событий и считает суммы за доли секунды.' },
      { t: 'Реплика всегда отстаёт на сутки', why: 'Нет: асинхронная реплика отстаёт на секунды. В пик под тяжёлым отчётом — на десятки секунд, но не на сутки.' },
      { t: 'С реплики нельзя выполнять SQL-запросы', why: 'Можно — только читать. Отчёт и есть чтение.' },
      { t: 'ClickHouse дешевле PostgreSQL', why: 'Дело не в цене: отдельная база — это ещё одна система, которую надо поддерживать. Платим за то, что она умеет считать суммы и не мешает пути клиента.' }
    ]
  };
  const RCHOICE = RSRC.map(s => ({ v: s.v, t: s.t }));
  function repMatchEval(v) {
    v = v || {};
    return RROWS.map(r => {
      const g = v[r.id];
      if (g === r.ok) return { r, s: 'ok', pts: 1 };
      if (r.alt[g]) return { r, s: 'warn', pts: 0.5 };
      return { r, s: 'bad', pts: 0, empty: !g };
    });
  }
  const repTask = {
    id: 'report-lab', title: 'Лаборатория: откуда строить отчёт директора',
    simple: howCqrs.simple,
    lead: ui.brief({
      situation: 'Ольга хочет каждое утро — а иногда и в воскресенье вечером — видеть три отчёта: выручку по клубам, загрузку занятий и залов, отток. В прошлое воскресенье кто-то открыл квартальный отчёт прямо на мастере — и запись на 4 минуты стала отвечать по 2 секунды. Данные отчётов лежат у разных владельцев: платежи и записи — в ядре, проходы — в сервисе «Доступ», бонусы — в сервисе «Бонусы».',
      todo: [
        'Выберите отчёт и время. Переключайте «Откуда строим» и смотрите на пять требований под цифрами.',
        'Прогоните все три источника в «Вс 20:00 — пик записи». Карточки сверху показывают итог для каждого источника.',
        'В блоке «Кто откуда читает» выберите источник для четырёх экранов.',
        'Ответьте на вопрос внизу и нажмите «Проверить».'
      ],
      look: '<p>Пять требований Ольги и Сергея: отчёт быстрее 10 секунд; запись в пик не страдает (p95 ≤ 300 мс); расписание с реплик не тормозит; данные полные; не старше суток. Зелёная галочка — требование выполнено, красный крест — нет, под ним объяснение.</p><p>Засчитывается: все три источника прогнаны в пик, четыре экрана разложены верно («Мои записи» — обязательно), ответ на вопрос верный.</p>'
    }),
    blank: () => ({ src: 'core', rep: 'load', when: 'mon', seen: [], m: {}, q: [] }),
    reference: () => ({ src: 'ch', rep: 'load', when: 'sun', seen: RSRC.map(s => s.v + '|sun'), m: Object.fromEntries(RROWS.map(r => [r.id, r.ok])), q: quizRef([RQ])[0] }),
    render(el, ctx) {
      el.classList.add('cq-root');
      const a = ctx.ans; a.seen = a.seen || []; a.m = a.m || {}; a.q = a.q || [];
      const mark = () => { const k = a.src + '|' + a.when; if (!ctx.readonly && !a.seen.includes(k)) { a.seen.push(k); ctx.save(); } };
      mark();
      el.innerHTML = `<div class="stack">
        <div class="cq-box">
          <div class="cq-set">
            <div class="lbl">Отчёт</div>${ui.seg('rep', RREP.map(r => ({ v: r.v, t: r.t })), a.rep)}
            <div class="lbl">Когда открывают</div>${ui.seg('when', RWHEN, a.when)}
            <div class="lbl">Откуда строим</div>${ui.seg('src', RSRC, a.src, 'accent')}
          </div>
        </div>
        <div class="cq-sc" data-cqcards></div>
        <div class="cq-stats" data-cqst></div>
        <ul class="cq-crit" data-cqcrit></ul>
        <div class="eyebrow" style="margin-top:6px">Кто откуда читает</div>
        <div data-cqmatch></div>
        <div class="card flat" data-cqq></div>
      </div>`;
      function draw() {
        const r = repSim(a.src, a.rep, a.when);
        TR.$('[data-cqcards]', el).innerHTML = RSRC.map(s => {
          const seen = a.seen.includes(s.v + '|sun'), rr = repSim(s.v, a.rep, 'sun'), bad = RCRIT.filter(c => !rr.crit[c.id]).length;
          return `<div class="stat ${s.v === a.src ? 'cur' : ''}"><span class="k">${esc(s.t)}</span><span class="v ${seen ? (rr.green ? 'ok' : 'bad') : ''}">${!seen ? '—' : rr.green ? 'подходит' : 'не прошло: ' + bad}</span><span class="s small dim">${seen ? 'в пик, для выбранного отчёта' : 'ещё не прогнан в Вс 20:00'}</span></div>`;
        }).join('');
        TR.$('[data-cqst]', el).innerHTML = `
          <div class="stat"><span class="k">Отчёт строится</span><span class="v ${r.crit.fast ? 'ok' : 'bad'}">${fmtSec(r.time)}</span><span class="s">${a.src === 'ch' ? 'по столбцам' : 'по строкам, с соединениями'}</span></div>
          <div class="stat"><span class="k">p95 записи</span><span class="v ${r.crit.book ? 'ok' : 'bad'}">${r.p95.toLocaleString('ru-RU')} мс</span><span class="s">${a.when === 'sun' ? '400 записей/с' : 'обычная нагрузка'}</span></div>
          <div class="stat"><span class="k">Расписание с реплик</span><span class="v ${r.crit.sched ? 'ok' : 'bad'}">${r.sched} мс</span><span class="s">p95 ответа</span></div>
          <div class="stat"><span class="k">Свежесть данных</span><span class="v ${a.src === 'replica' && a.when === 'sun' ? 'warn' : 'ok'}" style="font-size:14px">${r.fresh}</span><span class="s">${r.full ? 'данные полные' : 'данные неполные'}</span></div>`;
        TR.$('[data-cqcrit]', el).innerHTML = RCRIT.map(c => `<li class="${r.crit[c.id] ? 'ok' : 'bad'}"><b>${r.crit[c.id] ? '✓' : '✗'}</b><div><b>${esc(c.t)}</b><small>${r.why[c.id]}</small></div></li>`).join('');
      }
      draw();
      let reveal = null;
      if (ctx.result) { reveal = {}; repMatchEval(a.m).forEach(x => { reveal[x.r.id] = { s: x.s, why: x.s === 'ok' ? x.r.why : x.s === 'warn' ? x.r.alt[a.m[x.r.id]] : '' }; }); }
      ui.match(TR.$('[data-cqmatch]', el), {
        rows: RROWS.map(r => ({ id: r.id, t: `<b>${esc(r.t)}</b>`, sub: esc(r.sub) })), choices: RCHOICE, value: a.m, reveal, readonly: ctx.readonly, placeholder: 'Откуда читать…',
        onChange: v => { a.m = v; ctx.save(); ctx.decide('Кто откуда читает', RROWS.map(r => `${r.t}: ${v[r.id] ? tOf(RSRC, v[r.id]) : '—'}`).join('; ')); }
      });
      ui.quiz(TR.$('[data-cqq]', el), Object.assign({}, RQ, { value: a.q, readonly: ctx.readonly, reveal: ctx.result, onChange: v => { a.q = v; ctx.save(); } }));
      ui.onSeg(TR.$('.cq-box', el), (name, v) => {
        if (!['src', 'rep', 'when'].includes(name)) return;
        a[name] = v; mark();
        if (!ctx.readonly) { ctx.save(); if (name === 'src') ctx.decide('Источник отчёта директора', tOf(RSRC, v)); }
        draw();
      });
    },
    check(ans) {
      const seen = ans.seen || [], seenAll = RSRC.every(s => seen.includes(s.v + '|sun'));
      const ev = repMatchEval(ans.m), mScore = ev.reduce((s, x) => s + x.pts, 0) / RROWS.length;
      const q = ui.quizScore(RQ, ans.q || []), notes = [];
      RSRC.forEach(s => { if (!seen.includes(s.v + '|sun')) notes.push({ ok: 'warn', html: `Источник «${esc(s.t)}» не прогнан в воскресенье 20:00 — выберите «Вс 20:00» и этот источник.` }); });
      ev.forEach(x => {
        if (x.s === 'warn') notes.push({ ok: 'warn', html: `«${esc(x.r.t)}» — ${x.r.alt[(ans.m || {})[x.r.id]]}` });
        else if (x.s === 'bad') notes.push({ ok: false, html: `«${esc(x.r.t)}» — ${x.empty ? 'не выбрано. ' : ''}${{ dir: 'Сколько данных перебирает этот отчёт и у скольких владельцев они лежат?', mgr: 'Нужна ли управляющему точность до секунды? А нагрузка на ядро каждую минуту для 60 клубов?', sched: 'Тысячи мелких чтений в секунду и отставание в секунды терпимо. Для чего у «Пульса» реплики и кэш?', mine: 'Клиент только что записался и проверяет, что запись есть. Какой источник видит запись сразу?' }[x.r.id]}` });
      });
      if (!ev.filter(x => x.s !== 'ok').length) notes.push({ ok: true, html: 'Все четыре экрана читают из подходящего места.' });
      notes.push(q.ok ? { ok: true, html: 'Вопрос: верно — изменились нагрузка на реплики и расположение данных.' } : { ok: false, html: 'Вопрос: что изменилось с сезона 1 — в работе реплик и в том, где лежат данные?' });
      const mineOk = ev.find(x => x.r.id === 'mine').s === 'ok', dirOk = ev.find(x => x.r.id === 'dir').s === 'ok';
      const score = (seenAll ? 0.15 : 0.05 * RSRC.filter(s => seen.includes(s.v + '|sun')).length) + mScore * 0.55 + q.score * 0.3;
      return { ok: seenAll && mScore >= 0.75 && mineOk && dirOk && q.ok, score, notes, summary: `Экранов верно: ${ev.filter(x => x.s === 'ok').length} из ${RROWS.length}; источников прогнано в пик: ${RSRC.filter(s => seen.includes(s.v + '|sun')).length} из 3.`, vera: !mineOk ? '«Мои записи» — главный капкан: это тоже чтение, но клиент ждёт увидеть свою же запись. Отставание в секунду здесь — уже ошибка.' : null };
    },
    explain: `<p>В пик проходит только модель чтения в ClickHouse:</p>
      <ul class="checks">
        <li><b>Мастер</b> — тяжёлый отчёт ест процессор и диск, на которых идут 400 записей в секунду. Утром незаметно, в воскресенье 20:00 — p95 записи 1,9 с. Плюс данных о проходах и бонусах в ядре просто нет.</li>
        <li><b>Реплика</b> — мастер спасён, но в сезоне 2 реплики отдают расписание в пик: отчёт забирает их ресурсы, отставание растёт, клиенты видят старые места. И она по-прежнему копия только базы ядра.</li>
        <li><b>ClickHouse</b> — колоночная база для сумм по миллионам строк; модель чтения собирается из событий всех владельцев (<code>booking</code>, <code>access</code>, <code>bonus</code>, <code>payment</code>). Отстаёт до минуты — отчёту раз в сутки хватает.</li>
      </ul>
      <p>Решение «откуда читать» — не одно на всю систему, а своё для каждого экрана: отчёты и загрузка — модель чтения; расписание — реплики и кэш; «Мои записи» — ядро (read-your-writes). Аналитик фиксирует это в требованиях вместе с допустимым отставанием.</p>`,
    report: ans => {
      const ev = repMatchEval(ans.m);
      return `Прогнано в пик: ${RSRC.filter(s => (ans.seen || []).includes(s.v + '|sun')).map(s => s.t).join(', ') || '—'}.\n` + ev.map(x => `- ${x.r.t} → ${(ans.m || {})[x.r.id] ? tOf(RSRC, ans.m[x.r.id]) : '—'} ${x.s === 'ok' ? '✓' : x.s === 'warn' ? '≈' : '✗'}`).join('\n') + `\nВопрос про реплику: ${ui.quizScore(RQ, ans.q || []).ok ? 'верно' : 'неверно'}.`;
    }
  };

  // =====================================================================
  // Практика 2. Проекция «Загрузка занятий»
  // =====================================================================
  const PEV = [
    { id: 'created', t: '<code>BookingCreated</code>', sub: 'записался или встал в лист ожидания (status booked | waitlist) · puls.booking.events.v1', ok: true, hint: 'С чего вообще начинается загрузка занятия?' },
    { id: 'cancelled', t: '<code>BookingCancelled</code>', sub: 'отменил запись, в том числе поздно · puls.booking.events.v1', ok: true, crit: true, hint: 'Люди отменяют записи. Если витрина об этом не узнает, сколько будет «записано»?' },
    { id: 'promoted', t: '<code>WaitlistPromoted</code>', sub: 'переведён из листа ожидания в записанные · puls.booking.events.v1', ok: true, hint: 'Место освободилось, и его занял человек из листа ожидания. Какое событие об этом говорит?' },
    { id: 'classcanc', t: '<code>ClassCancelled</code>', sub: 'занятие отменено (тренер заболел) · puls.booking.events.v1', ok: true, crit: true, hint: 'Занятие отменили. Должно ли оно попадать в загрузку клуба?' },
    { id: 'card', t: 'Карточка занятия из API «Расписания»', sub: 'клуб, зал, вместимость, направление, тренер, время — у владельца, при первом событии занятия', ok: true, hint: 'Загрузка = записано / вместимость. Откуда витрина узнает вместимость, если в событии её нет?' },
    { id: 'attend', t: 'Новое событие об отметке посещения', sub: 'тренер отмечает пришедших (PUT /classes/{classId}/attendance), а события об этом в топике нет — попросить команду «Расписание и запись» его публиковать', ok: true, hint: 'Ольге нужно «пришли / прогулы». Какое событие несёт отметку тренера? А если такого нет — что делает аналитик?' },
    { id: 'visit', t: '<code>VisitRecorded</code> как «пришёл на занятие»', sub: 'проход через турникет клуба · puls.access.visits.v1', ok: false, warn: true, why: 'Проход в клуб — не присутствие на занятии: человек мог прийти в тренажёрный зал или бассейн, а на сайкл не дойти.' },
    { id: 'pay', t: '<code>PaymentSucceeded</code>', sub: 'оплата прошла · puls.payment.events.v1', ok: false, why: 'Деньги к загрузке занятий не относятся.' },
    { id: 'frozen', t: '<code>MembershipFrozen</code>', sub: 'абонемент заморожен · puls.membership.events.v1', ok: false, why: 'Заморозка сама не меняет число записанных: отмены приходят своими событиями.' },
    { id: 'sql', t: 'Раз в 5 минут читать таблицу <code>booking</code> ядра напрямую', sub: 'SELECT … FROM booking — «так проще»', ok: false, crit: true, why: 'Чужая таблица: владелец — «Запись». Прямое чтение ломает правило владения и снова нагружает ядро — ровно то, от чего уходим.' }
  ];
  const PF = [
    { id: 'key', t: 'Ключ занятия <code>class_session_id</code>', ok: true },
    { id: 'where', t: 'Клуб, зал, направление, тренер', ok: true },
    { id: 'local', t: 'Начало занятия в местном времени клуба', ok: true },
    { id: 'msk', t: 'Начало занятия по Москве', ok: false, why: 'Новосибирск +4, Владивосток +7: в «загрузке по часам» утренняя йога во Владивостоке окажется ночной.' },
    { id: 'cap', t: 'Вместимость', ok: true },
    { id: 'counts', t: 'Записано / в листе ожидания / отменили', ok: true },
    { id: 'att', t: 'Пришли / прогулы', ok: true },
    { id: 'pct', t: 'Загрузка, % = записано / вместимость', ok: true },
    { id: 'upd', t: 'Время последнего учтённого события', ok: true, why: 'По нему экран покажет «данные на 20:41» и видно, что витрина отстала.' },
    { id: 'pii', t: 'ФИО и телефоны записанных', ok: false, crit: true, why: 'Персональные данные в аналитической витрине не нужны: загрузка — это числа. Канон: ПДн в события не кладём, только clientId.' },
    { id: 'money', t: 'Сумма оплат абонементов записанных', ok: false, why: 'К загрузке не относится — это другая витрина (выручка).' }
  ];
  const PLAG = [{ v: 'zero', t: '0 — всегда точно как в ядре' }, { v: 'min', t: 'до 1 минуты' }, { v: 'day', t: 'до суток' }];
  const PDED = [{ v: 'none', t: 'ничего — считаем каждое событие' }, { v: 'event', t: 'отсекаем повтор по eventId' }, { v: 'class', t: 'отсекаем по class_session_id' }];
  // Живой предпросмотр: два занятия пятницы и поток их событий
  function projPreview(a) {
    const ev = a.ev || {}, f = a.f || {}, d = a.dedup;
    const C1 = { t: 'Сайкл · пт 19:00 · клуб на Соколе', cap: 20, truth: { booked: 19, wait: 0, att: '17 / 2', pct: 95 } };
    const res = [];
    // C1: 20 записались, 3 в лист ожидания, 4 отмены, 3 перевода из листа, 1 повтор доставки BookingCreated
    let b1, w1;
    if (d === 'class') { b1 = ev.created ? 1 : 0; w1 = 0; }
    else {
      b1 = ev.created ? 20 + (d === 'event' ? 0 : 1) : 0;
      w1 = ev.created ? 3 : 0;
      if (ev.cancelled) b1 -= 4;
      if (ev.promoted) { b1 += ev.created ? 3 : 0; w1 -= ev.created ? 3 : 0; }
      b1 = Math.max(0, b1); w1 = Math.max(0, w1);
    }
    const att1 = ev.attend ? (d === 'class' ? '0 / 0' : '17 / 2') : ev.visit ? '23 прохода в клуб' : '—';
    res.push({ t: C1.t, cap: ev.card ? 20 : null, booked: b1, wait: w1, att: att1, pct: ev.card ? Math.round(b1 / 20 * 100) : null, truth: C1.truth, cancelled: false });
    // C2: 12 записались, 1 отмена, затем занятие отменено тренером
    const cc = !!ev.classcanc && d !== 'class';
    let b2 = d === 'class' ? (ev.created ? 1 : 0) : (ev.created ? 12 : 0) - (ev.cancelled ? 1 : 0);
    b2 = Math.max(0, b2);
    res.push({ t: 'Йога · пт 20:30 · отменена тренером', cap: ev.card ? 16 : null, booked: b2, wait: 0, att: cc ? '—' : ev.attend ? '0 / 0' : ev.visit ? '0 проходов' : '—', pct: ev.card ? Math.round(b2 / 16 * 100) : null, truth: { cancelled: true }, cancelled: cc });
    const counted = res.filter(x => !x.cancelled && x.cap);
    const club = counted.length ? Math.round(counted.reduce((s, x) => s + x.booked, 0) / counted.reduce((s, x) => s + x.cap, 0) * 100) : null;
    return { rows: res, club, clubTruth: 95, pii: !!f.pii, upd: !!f.upd, local: !!f.local, msk: !!f.msk };
  }
  function projEval(ans) {
    const ev = ans.ev || {}, f = ans.f || {};
    const evPts = PEV.map(x => (!!ev[x.id] === x.ok ? 1 : (x.warn && ev[x.id] ? 0.5 : 0)));
    const fPts = PF.map(x => (!!f[x.id] === x.ok ? 1 : 0));
    const evS = evPts.reduce((s, x) => s + x, 0) / PEV.length, fS = fPts.reduce((s, x) => s + x, 0) / PF.length;
    const lagS = ans.lag === 'min' ? 1 : ans.lag === 'day' ? 0.5 : 0, dedS = ans.dedup === 'event' ? 1 : 0;
    const crit = [];
    if (!ev.cancelled) crit.push('cancelled'); if (!ev.classcanc) crit.push('classcanc'); if (ev.sql) crit.push('sql'); if (f.pii) crit.push('pii'); if (ans.dedup !== 'event') crit.push('dedup');
    const any = Object.values(ev).some(Boolean) || Object.values(f).some(Boolean);
    const score = any ? evS * 0.4 + fS * 0.3 + lagS * 0.15 + dedS * 0.15 : 0;
    return { evS, fS, lagS, dedS, crit, score };
  }
  const projTask = {
    id: 'proj-design', title: 'Проекция «Загрузка занятий»',
    simple: howProj.simple,
    lead: ui.brief({
      situation: 'Ольге и управляющим нужна витрина «Загрузка занятий»: по каждому занятию — сколько мест, сколько записано, сколько в листе ожидания, сколько пришло и сколько прогуляло; дальше её режут по клубам, направлениям и часам. Строит её сервис «Аналитика» в ClickHouse — из событий Kafka. Антон: «Опишите проекцию так, чтобы её можно было сделать без вопросов: из чего собираем, что храним, как быстро».',
      todo: [
        '«Из чего собираем»: отметьте нужные события и данные. Осторожно: среди них есть ловушки.',
        'Сразу смотрите на «Предпросмотр витрины»: два занятия пятницы и поток их событий. Добейтесь, чтобы витрина совпала с ядром.',
        '«Поля витрины»: отметьте, что храним. Не всё, что есть, нужно.',
        'Выберите допустимое отставание и что делать с повтором события. Нажмите «Проверить».'
      ],
      look: '<p>Предпросмотр считает витрину по вашему выбору. Сайкл: 20 записались, 3 встали в лист ожидания, 4 человека отменили, 3 перевели из листа, одно событие брокер доставил дважды; тренер отметил 17 пришедших. Йогу в 20:30 тренер отменил. Красная ячейка — витрина расходится с ядром.</p><p>Засчитывается от 80 %, и без критичных ошибок: отмены записей и отмены занятий учтены, чужую таблицу напрямую не читаем, ПДн не храним, повторы отсекаем.</p>'
    }),
    blank: () => ({ ev: {}, f: {}, lag: '', dedup: '' }),
    reference: () => ({ ev: Object.fromEntries(PEV.filter(x => x.ok).map(x => [x.id, true])), f: Object.fromEntries(PF.filter(x => x.ok).map(x => [x.id, true])), lag: 'min', dedup: 'event' }),
    render(el, ctx) {
      el.classList.add('cq-root');
      const a = ctx.ans; a.ev = a.ev || {}; a.f = a.f || {};
      const show = ctx.result || ctx.readonly;
      const pick = (grp, x) => {
        const on = !!a[grp][x.id];
        const cls = show ? (on === x.ok ? (on ? 'ok' : '') : (x.warn && on ? 'warn' : 'bad')) : '';
        return `<button type="button" class="cq-pick ${cls}" data-cqpk="${grp}|${x.id}" aria-pressed="${on}" ${ctx.readonly ? 'disabled' : ''}><span class="mk"></span><span>${x.t}${x.sub ? `<small>${esc(x.sub)}</small>` : ''}${show && x.why && on !== x.ok ? `<small style="color:var(--text-2)">${x.why}</small>` : ''}</span></button>`;
      };
      el.innerHTML = `<div class="stack">
        <div class="eyebrow">Из чего собираем</div>
        <div class="cq-picks" data-cqev></div>
        <div class="eyebrow" style="margin-top:6px">Предпросмотр витрины · пятница</div>
        <div data-cqprev></div>
        <div class="eyebrow" style="margin-top:6px">Поля витрины</div>
        <div class="cq-picks" data-cqf></div>
        <div class="cq-box"><div class="cq-set">
          <div class="lbl">Допустимое отставание<small>от события до витрины</small></div>${ui.seg('lag', PLAG, a.lag, 'accent')}
          <div class="lbl">Событие пришло второй раз</div>${ui.seg('dedup', PDED, a.dedup, 'accent')}
        </div></div>
      </div>`;
      lockSegs(el, ctx.readonly);
      function draw() {
        TR.$('[data-cqev]', el).innerHTML = PEV.map(x => pick('ev', x)).join('');
        TR.$('[data-cqf]', el).innerHTML = PF.map(x => pick('f', x)).join('');
        const p = projPreview(a);
        const cell = (v, ok) => `<span style="color:var(--${ok ? 'ok' : 'bad'})">${v}</span>`;
        const rows = p.rows.map((x, i) => {
          if (i === 1) {
            const okC = x.cancelled;
            return [esc(x.t), x.cap == null ? '—' : x.cap, okC ? cell('исключено', true) : cell(x.booked, false), '—', '—', okC ? cell('не в загрузке', true) : cell(x.pct == null ? '?' : x.pct + ' %', false), 'отменено — в загрузку не входит'];
          }
          return [esc(x.t), x.cap == null ? cell('?', false) : x.cap, cell(x.booked, x.booked === 19), cell(x.wait, x.wait === 0 && !!a.ev.created), cell(esc(x.att), x.att === '17 / 2'), x.pct == null ? cell('?', false) : cell(x.pct + ' %', x.pct === 95), '19 из 20, лист пуст, пришли 17 / прогул 2'];
        });
        TR.$('[data-cqprev]', el).innerHTML = ui.table(['Занятие', 'Мест', 'Записано', 'Лист ожид.', 'Пришли / прогул', 'Загрузка', 'В ядре (правда)'], rows) +
          `<div class="row" style="margin-top:8px;flex-wrap:wrap;gap:6px">
            <span class="chip ${p.club === p.clubTruth ? 'ok' : 'bad'}">Загрузка клуба вечером: ${p.club == null ? '?' : p.club + ' %'} (правда — ${p.clubTruth} %)</span>
            <span class="chip ${p.upd ? 'ok' : 'warn'}">${p.upd ? 'Данные на 20:41:07' : 'Неизвестно, насколько данные свежие'}</span>
            ${p.msk && !p.local ? '<span class="chip warn">Время по Москве: во Владивостоке «19:00» станет 12:00</span>' : ''}
            ${p.pii ? '<span class="chip bad">В витрине ФИО и телефоны 19 человек — ПДн</span>' : ''}
          </div>`;
      }
      draw();
      TR.on(el, 'click', '[data-cqpk]', (e, b) => {
        if (ctx.readonly) return;
        const [grp, id] = b.dataset.cqpk.split('|');
        a[grp][id] = !a[grp][id]; ctx.save();
        ctx.decide('Проекция «Загрузка занятий»: источники', PEV.filter(x => a.ev[x.id]).map(x => plainT(x.t)).join(', ') || '—');
        draw();
      });
      ui.onSeg(el, (name, v) => {
        if (ctx.readonly || !['lag', 'dedup'].includes(name)) return;
        a[name] = v; ctx.save();
        ctx.decide('Проекция «Загрузка занятий»: отставание и повторы', `${tOf(PLAG, a.lag)}; повтор: ${tOf(PDED, a.dedup)}`);
        draw();
      });
    },
    check(ans) {
      const e = projEval(ans), ev = ans.ev || {}, f = ans.f || {}, notes = [];
      PEV.forEach(x => {
        if (x.ok && !ev[x.id]) notes.push({ ok: x.crit ? false : 'warn', html: `Не хватает источника. ${x.hint}` });
        if (!x.ok && ev[x.id]) notes.push({ ok: x.warn ? 'warn' : false, html: `${x.t}: ${x.why}` });
      });
      PF.forEach(x => {
        if (!x.ok && f[x.id]) notes.push({ ok: x.crit ? false : 'warn', html: `Поле «${x.t}»: ${x.why}` });
      });
      const missF = PF.filter(x => x.ok && !f[x.id]);
      if (missF.length) notes.push({ ok: 'warn', html: `Полей не хватает: ${missF.length}. ${missF.some(x => x.id === 'upd') ? 'Как экран покажет, насколько данные свежие? ' : ''}${missF.some(x => x.id === 'local') ? 'В каком времени управляющий во Владивостоке смотрит «загрузку по часам»? ' : ''}${missF.some(x => x.id === 'cap') ? 'Без чего не посчитать процент загрузки?' : ''}` });
      if (ans.lag === 'zero') notes.push({ ok: false, html: 'Отставание 0 у модели чтения не бывает: она собирается из событий после того, как команда выполнена. Если нужно «точно сейчас» — это чтение из ядра.' });
      else if (ans.lag === 'day') notes.push({ ok: 'warn', html: 'Ольге раз в сутки хватает, а управляющим? Они смотрят загрузку сегодняшнего вечера и переносят занятия.' });
      else if (!ans.lag) notes.push({ ok: false, html: 'Выберите допустимое отставание.' });
      if (ans.dedup === 'class') notes.push({ ok: false, html: 'По class_session_id все события одного занятия выглядят «повтором» первого — витрина увидит одну запись на занятие. Что уникально у каждого события?' });
      else if (ans.dedup !== 'event') notes.push({ ok: false, html: 'Kafka у «Пульса» доставляет «хотя бы один раз» — повторы будут. Посмотрите в предпросмотре на «Записано».' });
      if (!notes.length) notes.push({ ok: true, html: 'Проекция описана полностью: витрина совпадает с ядром.' });
      return { ok: e.score >= 0.8 && !e.crit.length, score: e.score, notes, summary: `Источники: ${Math.round(e.evS * 100)} %, поля: ${Math.round(e.fS * 100)} %, отставание: ${e.lagS === 1 ? 'да' : e.lagS ? 'наполовину' : 'нет'}, повторы: ${e.dedS ? 'да' : 'нет'}.`, vera: e.crit.length ? 'Сначала добейтесь, чтобы предпросмотр совпал с ядром: каждое красное число — это событие, которое вы не учли, или повтор, который посчитали.' : null };
    },
    explain: `<p>Эталон проекции:</p>
      <ul class="checks">
        <li><b>События:</b> <code>BookingCreated</code>, <code>BookingCancelled</code>, <code>WaitlistPromoted</code>, <code>ClassCancelled</code> из <code>puls.booking.events.v1</code>. Все события одного занятия лежат в одной партиции по порядку (ключ <code>class_session_id</code>) — поэтому перевод из листа никогда не обгонит отмену.</li>
        <li><b>Справочные данные</b> — вместимость, зал, направление — из API владельца «Расписания». Чужую таблицу <code>booking</code> не читаем: владелец один.</li>
        <li><b>«Пришли / прогулы»</b> — такого события нет. Это находка аналитика: заводим требование к команде «Расписание и запись» публиковать событие отметки посещения (контракт в AsyncAPI). <code>VisitRecorded</code> — проход в клуб, а не на занятие.</li>
        <li><b>Поля:</b> ключ занятия, клуб/зал/направление/тренер, начало в местном времени клуба (60 клубов в 8 городах), вместимость, счётчики, загрузка, время последнего события. Без ПДн и денег.</li>
        <li><b>Отставание</b> — до 1 минуты (канон). <b>Повторы</b> — по <code>eventId</code>: проекция идемпотентна.</li>
      </ul>
      <p>Обратите внимание: половина работы здесь — не «нарисовать таблицу», а найти, каких данных не хватает и у кого их попросить.</p>`,
    report: ans => {
      const e = projEval(ans), ev = ans.ev || {}, f = ans.f || {};
      return `Источники: ${PEV.filter(x => ev[x.id]).map(x => plainT(x.t)).join(', ') || '—'}\nПоля: ${PF.filter(x => f[x.id]).map(x => plainT(x.t)).join(', ') || '—'}\nОтставание: ${tOf(PLAG, ans.lag)}; повторы: ${tOf(PDED, ans.dedup)}\nОценка: ${Math.round(e.score * 100)} %${e.crit.length ? ', критичные ошибки: ' + e.crit.join(', ') : ''}.`;
    }
  };

  // =====================================================================
  // Практика 3. Лаборатория инцидента 7: пересоздали модель чтения — выручка не сходится с 1С
  // =====================================================================
  const DAYS = [1.72, 1.85, 1.64, 1.91, 2.12, 1.58, 1.77, 1.96, 1.83, 2.02];   // выручка по дням 1–10 октября, млн ₽ (как в 1С)
  const DUP6 = 0.12;                                                       // повторы доставки в Kafka 6 октября (relay отправил трижды)
  const T1C = DAYS.reduce((s, x) => s + x, 0);
  const RBM = [
    { v: 'latest', t: 'Новая группа потребителей: с текущего места', k: 'так сделали в пятницу' },
    { v: 'earliest', t: 'Перечитать топик с самого начала', k: 'earliest' },
    { v: 'snap', t: 'Снимок платежей из ядра + догнать из Kafka', k: 'история из PostgreSQL до 9 окт 00:00, дальше — топик' }
  ];
  const RBK = [{ v: 'none', t: 'ничего не отсекаем' }, { v: 'event', t: 'по eventId события' }, { v: 'pay', t: 'по ключу операции — paymentId' }];
  function rbSim(m, key) {
    // пересоздание: пятница 9 октября 00:00; топик хранит 7 дней → самое раннее событие — 2 октября 00:00
    return DAYS.map((v, i) => {
      const day = i + 1, inKafka = day >= 2, after = day >= 9, inSnap = day <= 8;
      const dup = day === 6 && key === 'none' ? DUP6 : 0;
      let r = 0, src = [];
      if (m === 'latest') { if (after) { r = v; src.push('kafka'); } }
      else if (m === 'earliest') { if (inKafka) { r = v + dup; src.push('kafka'); } }
      else if (m === 'snap') {
        if (inSnap) { r += v; src.push('snap'); }
        if (inKafka) {
          const overlap = inSnap;
          if (!overlap || key !== 'pay') r += v + (key === 'none' ? dup : 0);
          src.push('kafka');
        }
      }
      return { day, truth: v, r: Math.round(r * 100) / 100, src };
    });
  }
  const RB_Q1 = {
    q: 'Почему «перечитать топик с самого начала» тоже не сошлось с 1С?', seed: 'cq-rb-q1',
    options: [
      { t: 'Kafka хранит события 7 дней: «начало» топика при пересоздании — 2 октября, событий за 1 октября там уже нет', ok: 1, why: 'Верно. «С начала» значит «с начала того, что журнал ещё помнит». Начало топика — не начало истории.' },
      { t: 'Потребитель analytics медленный и не успел дочитать', why: 'Отставание до минуты — а здесь не хватает целого дня, и он не появится, сколько ни жди.' },
      { t: '1С считает выручку иначе — например, с другим округлением', why: 'Расхождение ровно на выручку 1 октября — не округление.' },
      { t: 'Часть событий потерялась при отправке — нет outbox', why: 'Outbox в «Платежах» есть с недели 5. События 1 октября были в топике — и удалились по сроку хранения.' }
    ]
  };
  const RB_Q2 = {
    q: 'Что записать в требования к модели чтения, чтобы инцидент не повторился?', multi: true, seed: 'cq-rb-q2',
    options: [
      { t: 'Процедура перестройки: снимок из источника истины (таблицы ядра) + догон из Kafka; повторы отсекаются по ключу операции', ok: 1, why: 'Да: источник истины для платежей — ядро (хранит 5 лет), Kafka — только догнать свежее.' },
      { t: 'Хранить сырые события в аналитике без срока (архив) и перестраивать витрины из него', ok: 1, why: 'Да: тогда «с начала» действительно значит с первого дня, и не нужно трогать ядро.' },
      { t: 'Ежедневная автоматическая сверка выручки витрины с ядром и 1С, алерт при расхождении', ok: 1, why: 'Да: расхождение увидит дежурный в тот же день, а не бухгалтер через неделю.' },
      { t: 'Новую группу потребителей всегда запускать «с текущего места» — так быстрее', why: 'Именно так и потеряли 8 дней выручки.' },
      { t: 'Строить отчёт о выручке прямо из ядра, раз модель чтения ненадёжна', why: 'Вернём нагрузку на ядро и проблему воскресенья. Ненадёжна не модель чтения, а процедура её перестройки.' }
    ]
  };
  const rbTask = {
    id: 'rebuild-lab', title: 'Инцидент 7: выручка в отчёте меньше, чем в 1С',
    simple: howProj.simple,
    lead: ui.brief({
      situation: `Понедельник, 12 октября. Ирина: «В вашем отчёте выручка за 1–10 октября — 3,85 млн, а в 1С — ${mln(T1C).replace(' млн ₽', ' млн')}. Кому верить?» Что было: в ночь на пятницу, 9 октября, в 00:00 команда аналитики пересоздала витрину выручки — добавили разбивку по способу оплаты. Новую таблицу наполняла новая группа потребителей топика <code>puls.payment.events.v1</code> (6 партиций, хранение 7 дней). Платежи в ядре хранятся 5 лет.`,
      todo: [
        'Выберите способ «Как наполнить новую витрину» и посмотрите на столбики по дням. Начните с того, что сделали в пятницу.',
        'Попробуйте все три способа. Для снимка из ядра переключайте «Повторы отсекаем».',
        'Найдите способ, при котором отчёт совпадает с 1С до копейки, и ответьте на два вопроса внизу. Нажмите «Проверить».'
      ],
      look: '<p>Пунктирный столбик — выручка дня в 1С. Сплошной — что попало в витрину: зелёный — совпало, красный — меньше, жёлтый — больше (посчитали дважды), крест — день пропал. Полоски под графиком — откуда витрина взяла данные за каждый день: синяя — Kafka, фиолетовая — снимок из ядра, серая — данных нет.</p>'
    }),
    blank: () => ({ m: 'latest', key: 'none', seen: [], q1: [], q2: [] }),
    reference: () => ({ m: 'snap', key: 'pay', seen: RBM.map(x => x.v), q1: quizRef([RB_Q1])[0], q2: quizRef([RB_Q2])[0] }),
    render(el, ctx) {
      el.classList.add('cq-root');
      const a = ctx.ans; a.seen = a.seen || []; a.q1 = a.q1 || []; a.q2 = a.q2 || [];
      const mark = () => { if (!ctx.readonly && !a.seen.includes(a.m)) { a.seen.push(a.m); ctx.save(); } };
      mark();
      el.insertAdjacentHTML('beforeend', ui.say('ira', 'Я не против новых отчётов. Я против того, чтобы у директора и у меня были разные цифры за одни и те же дни.'));
      const box = mount(el, 'stack');
      box.style.marginTop = '12px';
      box.innerHTML = `
        <div class="cq-box"><div class="cq-set">
          <div class="lbl">Как наполнить новую витрину</div>${ui.seg('m', RBM.map(x => ({ v: x.v, t: `${x.t} <span class="small dim">· ${x.k}</span>` })), a.m, 'accent')}
          <div class="lbl">Повторы отсекаем<small>одна и та же оплата из двух мест или дважды</small></div>${ui.seg('key', RBK, a.key, 'accent')}
        </div></div>
        <div class="cq-stats" data-cqst></div>
        <div data-cqbars></div>
        <div class="cq-src" data-cqsrc></div>
        <div data-cqn></div>
        <div class="card flat" data-cqq1></div>
        <div class="card flat" data-cqq2></div>`;
      lockSegs(box, ctx.readonly);
      function draw() {
        const res = rbSim(a.m, a.key), tot = res.reduce((s, x) => s + x.r, 0), diff = Math.round((tot - T1C) * 100) / 100;
        const max = 4.4;
        TR.$('[data-cqst]', box).innerHTML = `
          <div class="stat"><span class="k">В 1С за 1–10 окт</span><span class="v">${mln(T1C)}</span><span class="s">источник для бухгалтерии</span></div>
          <div class="stat"><span class="k">В витрине</span><span class="v ${Math.abs(diff) < 0.005 ? 'ok' : 'bad'}">${mln(tot)}</span><span class="s">после пересоздания</span></div>
          <div class="stat"><span class="k">Разница</span><span class="v ${Math.abs(diff) < 0.005 ? 'ok' : 'bad'}">${Math.abs(diff) < 0.005 ? '0' : (diff > 0 ? '+' : '−') + mln(Math.abs(diff))}</span><span class="s">${Math.abs(diff) < 0.005 ? 'сходится' : diff < 0 ? 'потеряли' : 'посчитали лишнее'}</span></div>
          <div class="stat"><span class="k">Дней сходится</span><span class="v ${res.every(x => Math.abs(x.r - x.truth) < 0.005) ? 'ok' : 'bad'}">${res.filter(x => Math.abs(x.r - x.truth) < 0.005).length} из 10</span><span class="s">по каждому дню</span></div>`;
        TR.$('[data-cqbars]', box).innerHTML = `<div class="cq-days" style="--n:10">${res.map(x => {
          const k = Math.abs(x.r - x.truth) < 0.005 ? '' : x.r > x.truth ? 'warn' : 'bad';
          return `<div class="cq-day"><div class="cq-col"><div class="g" style="height:${x.truth / max * 100}%"></div>${x.r ? `<div class="f ${k}" style="height:${Math.min(100, x.r / max * 100)}%"></div>` : '<div class="x">✕</div>'}</div><span class="d"><b>${x.day}</b><br>${x.r.toLocaleString('ru-RU')}</span></div>`;
        }).join('')}</div><div class="small dim" style="margin-top:4px">Дни октября; подпись — млн ₽ в витрине.</div>`;
        TR.$('[data-cqsrc]', box).innerHTML = `
          <div class="cq-srow" style="--n:10"><span>Kafka на 9 окт 00:00 (хранение 7 дней)</span>${DAYS.map((_, i) => `<i class="${i + 1 >= 2 ? 'on' : ''}" title="${i + 1} октября"></i>`).join('')}</div>
          <div class="cq-srow" style="--n:10"><span>Витрина взяла из Kafka</span>${res.map(x => `<i class="${x.src.includes('kafka') ? 'on' : ''}"></i>`).join('')}</div>
          <div class="cq-srow" style="--n:10"><span>Витрина взяла из снимка ядра</span>${res.map(x => `<i class="${x.src.includes('snap') ? 'snap' : ''}"></i>`).join('')}</div>
          <div class="cq-legend"><span><i style="background:var(--info)"></i>события Kafka</span><span><i style="background:var(--violet)"></i>снимок из ядра</span><span><i style="background:var(--surface-3)"></i>данных нет</span></div>`;
        const ok = Math.abs(diff) < 0.005;
        let n;
        if (a.m === 'latest') n = ui.note('bad', 'Так и сделали в пятницу', 'Новая группа потребителей начала «с текущего места» — с событий после 9 октября 00:00. Всё, что было раньше, для витрины не существует: 1–8 октября пусты. Ошибки нигде не было — витрина молча неполная.');
        else if (a.m === 'earliest') n = ui.note('bad', `Ближе, но не сходится: не хватает ${mln(DAYS[0])}`, `Группа читает топик с самого раннего события, которое в нём осталось. Посмотрите на верхнюю полоску: какого дня в топике уже нет и почему?${a.key === 'none' ? ' И 6 октября столбик выше пунктира: relay отправил три оплаты дважды — at-least-once.' : ''}`);
        else if (ok) n = ui.note('ok', 'Сходится до копейки', 'История до 9 октября — из ядра (платежи хранятся 5 лет), остальное — из Kafka. Дни 2–8 есть в обоих местах, но ключ <code>paymentId</code> склеивает строку снимка и событие об одной и той же оплате. Перед переключением чтения — сверка итогов по дням с ядром.');
        else if (a.key === 'event') n = ui.note('warn', `Больше, чем в 1С, на ${mln(diff)}`, 'Повторы из Kafka отсеклись, но дни 2–8 посчитаны дважды: строка снимка из таблицы <code>payment</code> и событие <code>PaymentSucceeded</code> про ту же оплату — у строки снимка нет <code>eventId</code>. Что общего у строки и события об одной оплате?');
        else n = ui.note('warn', `Больше, чем в 1С, на ${mln(diff)}`, 'Дни 2–8 пришли и из снимка, и из Kafka — каждая оплата посчитана дважды, а 6 октября ещё и повторы доставки. Нужен ключ, который одинаков у строки снимка и у события.');
        TR.$('[data-cqn]', box).innerHTML = n;
      }
      draw();
      ui.quiz(TR.$('[data-cqq1]', box), Object.assign({}, RB_Q1, { value: a.q1, readonly: ctx.readonly, reveal: ctx.result, onChange: v => { a.q1 = v; ctx.save(); } }));
      ui.quiz(TR.$('[data-cqq2]', box), Object.assign({}, RB_Q2, { value: a.q2, readonly: ctx.readonly, reveal: ctx.result, onChange: v => { a.q2 = v; ctx.save(); } }));
      ui.onSeg(TR.$('.cq-box', box), (name, v) => {
        if (ctx.readonly || !['m', 'key'].includes(name)) return;
        a[name] = v; mark(); ctx.save();
        ctx.decide('Перестройка витрины выручки', `${tOf(RBM, a.m)}; повторы: ${tOf(RBK, a.key)}`);
        draw();
      });
    },
    check(ans) {
      const res = rbSim(ans.m, ans.key), tot = res.reduce((s, x) => s + x.r, 0), exact = Math.abs(tot - T1C) < 0.005 && res.every(x => Math.abs(x.r - x.truth) < 0.005);
      const seen = ans.seen || [], seenAll = RBM.every(x => seen.includes(x.v));
      const q1 = ui.quizScore(RB_Q1, ans.q1 || []), q2 = ui.quizScore(RB_Q2, ans.q2 || []), notes = [];
      if (exact) notes.push({ ok: true, html: 'Витрина сходится с 1С по каждому дню.' });
      else if (ans.m === 'latest') notes.push({ ok: false, html: 'Так сделали в пятницу — и потеряли 8 дней. Откуда ещё можно взять историю?' });
      else if (ans.m === 'earliest') notes.push({ ok: false, html: 'Не хватает одного дня. Что хранит топик и сколько? Где ещё лежат платежи за 1 октября?' });
      else notes.push({ ok: false, html: 'Снимок + Kafka — верное направление, но часть оплат посчитана дважды. Каким ключом склеить строку снимка и событие об одной оплате?' });
      if (!seenAll) notes.push({ ok: 'warn', html: `Попробуйте все три способа — не хватает: ${RBM.filter(x => !seen.includes(x.v)).map(x => '«' + esc(x.t) + '»').join(', ')}.` });
      notes.push(q1.ok ? { ok: true, html: 'Причина найдена: срок хранения топика 7 дней.' } : { ok: false, html: 'Вопрос о причине: сравните верхнюю полоску «Kafka на 9 окт» с днями октября.' });
      notes.push(q2.score >= 0.66 ? { ok: true, html: 'Меры на будущее выбраны.' } : { ok: false, html: 'Меры: что сделает перестройку полной, а расхождение — заметным в тот же день? И какие варианты возвращают нас к старым проблемам?' });
      const score = (exact ? 0.35 : ans.m === 'snap' ? 0.15 : 0) + (seenAll ? 0.1 : 0) + q1.score * 0.25 + q2.score * 0.3;
      return { ok: exact && q1.ok && q2.score >= 0.66, score, notes, summary: `Витрина: ${mln(tot)} против ${mln(T1C)} в 1С.`, vera: exact ? null : 'У платежей два места, где хранится история: ядро (5 лет) и Kafka (7 дней). Одно полное, но медленное, другое быстрое, но короткое. Как их сложить, ничего не потеряв и не посчитав дважды?' };
    },
    explain: `<p>Инцидент 7 — две ошибки подряд:</p>
      <ul class="checks">
        <li><b>«С текущего места».</b> Новая группа потребителей по умолчанию начинает с конца топика. Витрина пересоздана — а история в неё не попала. Молча.</li>
        <li><b>«С начала» — не панацея.</b> Топик <code>puls.payment.events.v1</code> хранит 7 дней. Kafka — журнал доставки, а не архив. Всё, что старше недели, есть только в источнике истины — таблице <code>payment</code> ядра (5 лет).</li>
        <li><b>Как правильно.</b> Снимок из ядра до момента T + догон из Kafka (с начала или с отметки времени T — Kafka умеет искать смещение по времени). Повторы отсекаются по ключу операции <code>paymentId</code>: у строки снимка нет <code>eventId</code>, а у события и строки об одной оплате <code>paymentId</code> общий. Перестраивают рядом со старой витриной и переключают после сверки.</li>
        <li><b>На будущее.</b> Архив сырых событий в аналитике (без срока) — тогда «с начала» значит с первого дня. И ежедневная автоматическая сверка выручки витрины с ядром и 1С: расхождение видит дежурный, а не Ирина.</li>
      </ul>
      <p>Позиция аналитика: процедура перестройки и сверка — это требования к модели чтения, как и допустимое отставание. В ADR про CQRS пишут не только «читаем из ClickHouse», но и «как наполняем заново и как проверяем, что ничего не потеряли».</p>`,
    report: ans => {
      const res = rbSim(ans.m, ans.key), tot = res.reduce((s, x) => s + x.r, 0);
      return `Способ: ${tOf(RBM, ans.m)}; повторы: ${tOf(RBK, ans.key)} → витрина ${mln(tot)} (в 1С ${mln(T1C)}).\nПопробовано: ${(ans.seen || []).map(v => tOf(RBM, v)).join(', ') || '—'}.\nПричина: ${ui.quizScore(RB_Q1, ans.q1 || []).ok ? 'верно (хранение 7 дней)' : 'неверно'}; меры: ${(ans.q2 || []).map(i => plainT(RB_Q2.options[i].t)).join('; ') || '—'}.`;
    }
  };

  // =====================================================================
  // Практика 4. Где CQRS не нужен
  // =====================================================================
  const NC_RUBRIC = [
    '«Мои записи» и «Мои абонементы» сразу после действия — read-your-writes: читаем из ядра, иначе «записался — а записи нет»',
    'Решение о записи (есть ли место, действует ли абонемент) — только в ядре, атомарным UPDATE в транзакции; по модели чтения можно показывать, но не решать',
    'Простые экраны с малой нагрузкой (профиль, каталог абонементов) — вторая модель не окупается: хватит ядра, реплики или кэша',
    'Цена CQRS: две модели, отставание, перестройка, мониторинг отставания, сверка — платим только там, где есть тяжёлое чтение',
    'Где CQRS оправдан: отчёты директора, загрузка залов, рекомендации — тяжёлые суммы по данным разных владельцев, отставание до минуты допустимо',
    'Аналитик фиксирует в требованиях для каждого экрана источник чтения и допустимое отставание'
  ];
  const NC_REF = `<p><b>Где CQRS «Пульсу» не нужен</b></p>
    <ol>
      <li><b>«Мои записи», «Мои абонементы» после действия.</b> Клиент проверяет то, что сам только что сделал (read-your-writes). Модель чтения отстаёт до минуты — «записался, а записи нет», повторное нажатие, звонок в клуб. Читаем из ядра.</li>
      <li><b>Решение о записи и проходе.</b> «Есть ли место», «действует ли абонемент» решает только ядро — атомарный UPDATE в транзакции. По модели чтения можно <i>показать</i> «осталось 2 места», но не решать.</li>
      <li><b>Простые экраны.</b> Профиль, каталог абонементов, карточка клуба — мало данных и мало нагрузки. Вторая модель стоит дороже пользы: хватит ядра, реплики или кэша.</li>
      <li><b>Цена CQRS.</b> Две модели, отставание, проекции, которые надо перестраивать (инцидент 7), мониторинг отставания, сверка. Это оправдано для отчётов директора, загрузки залов, рекомендаций — тяжёлых сумм по данным разных владельцев.</li>
      <li>В требованиях к каждому экрану пишем источник чтения и допустимое отставание: «загрузка залов — модель чтения, не старше 1 минуты»; «мои записи — ядро, сразу».</li>
    </ol>`;
  const ncTask = {
    id: 'no-cqrs', title: 'Где CQRS не нужен',
    simple: {
      icon: '⚖️',
      plain: 'Отдельная модель для чтения — не бесплатна. Её заводят там, где чтение тяжёлое и может немного отставать, а не везде.',
      analogy: 'Табло над входом полезно, когда на него смотрят сотни людей. Но если клиент спрашивает «я записан на 19:00?», администратор смотрит в журнал, а не на табло: табло могло ещё не обновиться.',
      tech: 'CQRS добавляет вторую модель данных, отставание, проекции и их перестройку, мониторинг и сверку. Не подходит для read-your-writes и для чтения, на основании которого принимается решение о записи. Решение принимают по каждому экрану отдельно и фиксируют в требованиях.'
    },
    lead: ui.brief({
      situation: 'Ревью постановки. Денис из мобильной студии: «Раз ClickHouse такой быстрый, давайте всё приложение читать из него: и “Мои записи”, и свободные места, и проверку, можно ли записаться. Ядро разгрузим совсем». Лена против, но просит вас ответить письменно — ответ пойдёт в ADR про CQRS.',
      todo: [
        'Напишите 4–6 пунктов (от 300 символов): где CQRS «Пульсу» не нужен и почему, чем он платит за модель чтения и где она оправдана.',
        'Опирайтесь на лабораторию отчёта, вкладку «Отставание» и инцидент 7.',
        'Нажмите «Проверить с Верой (Claude)» или «Сверить с эталоном самому» и отметьте, что прозвучало. Засчитывается от 60 %.'
      ],
      lookTitle: 'Подсказка',
      look: 'Хороший ответ называет конкретные экраны «Пульса» и объясняет, что будет у клиента, если читать их из модели чтения. «CQRS — это сложно» — не аргумент: назовите, в чём именно сложность.'
    }),
    blank: () => ({ j: { text: '' } }),
    reference: () => ({ j: { text: plainT(NC_REF).replace(/\s+/g, ' ').trim(), self: NC_RUBRIC.map(() => true) } }),
    render(el, ctx) {
      el.classList.add('cq-root');
      el.insertAdjacentHTML('beforeend', ui.say('denis', 'ClickHouse отвечает за 300 мс на квартальный отчёт. Неужели «Мои записи» он не вытянет?'));
      el.insertAdjacentHTML('beforeend', ui.say('lena', 'Вытянет. Вопрос не в скорости, а в том, что он покажет человеку, который нажал «Записаться» секунду назад.'));
      const j = mount(el); j.style.marginTop = '12px';
      ui.justify(j, {
        id: 'cq-nocqrs', q: 'Где CQRS «Пульсу» не нужен — и почему', qPlain: 'Где в «Пульсе» не нужна отдельная модель чтения (CQRS) и почему: экраны, решение о записи, цена CQRS, где он оправдан, что записать в требования.',
        rubric: NC_RUBRIC, reference: NC_REF, value: ctx.ans.j, readonly: ctx.readonly, minLen: 300,
        onChange: v => { ctx.ans.j = v; ctx.save(); ctx.decide('Где CQRS не нужен', v.text || ''); }
      });
    },
    check(ans) {
      const s = ui.justifyScore(ans && ans.j), txt = String((ans.j || {}).text || ''), notes = [];
      if (txt.trim().length < 300) notes.push({ ok: false, html: 'Пока коротко: нужны конкретные экраны и причины.' });
      else if (!(ans.j.self || ans.j.ai)) notes.push({ ok: 'warn', html: 'Сверьте текст с эталоном (кнопка под полем) или проверьте с Верой.' });
      else notes.push({ ok: s >= 0.6, html: `Покрыто критериев: ${Math.round(s * 100)} %.` });
      if (txt.trim().length >= 300 && !/запис/i.test(txt)) notes.push({ ok: 'warn', html: 'Ни слова про запись. Что увидит человек, который только что записался, если «Мои записи» читать из модели чтения?' });
      return { ok: s >= 0.6, score: s, notes, summary: s ? `Оценка: ${Math.round(s * 100)} %.` : 'Напишите ответ и сверьте с эталоном.' };
    },
    explain: '<p>CQRS — инструмент для тяжёлого чтения, а не стиль всего приложения. Граница проходит по двум вопросам: <b>видит ли человек результат своего действия</b> (тогда ядро) и <b>принимается ли по этим данным решение</b> (тогда только ядро, в транзакции). Всё остальное решается ценой: если чтение лёгкое — кэш или реплика проще второй модели.</p><p>Денису можно предложить компромисс: главный экран и расписание — из кэша и реплик (это уже есть), «Мои записи» — из ядра, а в ClickHouse — то, что считается по истории: «ваша статистика за месяц», рекомендации.</p>',
    report: ans => `Ответ студента:\n> ${String((ans.j || {}).text || '—').replace(/\n/g, '\n> ')}\nСамооценка: ${Math.round(ui.justifyScore(ans.j) * 100)} %.`
  };

  // =====================================================================
  TR.stage({
    id: ID, act: 7, order: 430, slot: 'Ср 10:00', title: 'CQRS и отчёты',
    when: 'среда, 10:00 · переговорная «Сайкл» · Ольга, Антон и Ирина',
    intro: [
      { who: 'olga', html: 'Я хочу каждое утро видеть выручку по клубам, загрузку занятий и залов, отток. И чтобы цифры сходились с бухгалтерией. А мне говорят, что мой квартальный отчёт в прошлое воскресенье на 4 минуты подвесил запись. Как отчёт может мешать записи?' },
      { who: 'anton', html: 'Отчёт — это тяжёлое чтение по миллионам строк, а запись — тысячи коротких команд. Пока они делят одну базу, мешают друг другу. Разделяем: команды — в ядре, а для отчётов отдельная модель чтения в ClickHouse, которая собирается из событий Kafka. Это CQRS.' },
      { who: 'vera', html: 'И у этого решения есть цена: модель чтения отстаёт, её надо уметь пересобирать, и не все экраны можно из неё читать. Ирина, кстати, уже нашла расхождение с 1С — разберём и его. Ваша часть — откуда читает каждый экран, из каких событий собирается витрина и как её наполнить заново, ничего не потеряв.' }
    ],
    facts: ['F-reports', 'F-1c', 'F-history', 'F-no-loss', 'F-week-open', 'F-live'],
    glossary: [
      { term: 'CQRS', simple: 'Одни меняют данные, другие только смотрят — и смотрят на отдельное табло, а не в рабочий журнал.', tech: 'Command Query Responsibility Segregation: разные модели для команд (изменение состояния, проверки, транзакции) и для запросов (чтение в удобной форме). У «Пульса»: команды — PostgreSQL ядра, отчёты и загрузка — модель чтения в ClickHouse из событий Kafka.' },
      { term: 'Модель чтения (read model)', simple: 'Готовый ответ на частый вопрос — посчитанный заранее и лежащий отдельно.', tech: 'Денормализованное представление данных под конкретные запросы (витрина). Обновляется асинхронно из событий, поэтому отстаёт от модели записи; у «Пульса» — до 1 минуты. Не годится для read-your-writes и для решений о записи.' },
      { term: 'Проекция', simple: 'Помощник, который читает журнал по строчке и меняет цифры на табло.', tech: 'Обработчик событий, который строит и обновляет модель чтения. Должен быть идемпотентным (повтор по eventId или ключу операции не меняет результат) и уметь перестраиваться с нуля.' },
      { term: 'Перестройка проекции (replay)', simple: 'Стереть табло и заново пересчитать по журналу — с первой строчки, а не с текущей.', tech: 'Повторное наполнение модели чтения: новая группа потребителей читает журнал с начала истории (или снимок источника + догон), рядом со старой моделью; после сверки итогов чтение переключают. Запуск «с текущего места» молча теряет историю (инцидент 7).' },
      { term: 'Срок хранения топика (retention)', simple: 'Журнал на ресепшене хранят неделю, потом выбрасывают старые листы.', tech: 'Сколько Kafka держит сообщения (у «Пульса» — 7 дней, у сжатого топика — последнее значение по ключу). Самое раннее доступное смещение (earliest) — это начало хранимого, а не начало истории. Kafka — журнал доставки, а не архив.' },
      { term: 'Снимок и догон (backfill)', simple: 'Старое берём из архива бухгалтерии, новое — из свежего журнала, и следим, чтобы ничего не записать дважды.', tech: 'Способ перестроить модель чтения, когда журнал короче истории: выгрузка из источника истины до момента T + чтение событий с T (или с начала с дедупликацией по ключу операции, например paymentId).' },
      { term: 'Event sourcing', simple: 'Хранить не остаток на счёте, а выписку всех операций — остаток из неё всегда можно посчитать.', tech: 'Источник истины — неизменяемый журнал событий; текущее состояние — свёртка журнала (со снимками для скорости); исправления — новыми событиями (сторно). Часто идёт вместе с CQRS, но это разные решения; «Пульс» хранит состояние в PostgreSQL.' },
      { term: 'Колоночная база (ClickHouse)', simple: 'Таблица, сложенная по столбцам: чтобы сложить все суммы, не нужно листать каждую строку целиком.', tech: 'СУБД для аналитики (OLAP): хранит данные по столбцам, сжимает, считает агрегаты по миллиардам строк за секунды. Плохо подходит для частых точечных изменений и транзакций — для этого PostgreSQL (OLTP).' },
      { term: 'OLTP и OLAP', simple: 'Касса и бухгалтерия: касса пробивает много маленьких чеков, бухгалтерия редко, но считает итоги за квартал.', tech: 'OLTP — много коротких транзакций с точечными чтениями и записями (запись на занятие). OLAP — редкие тяжёлые аналитические запросы по большим объёмам (выручка по клубам за квартал). Одна база плохо делает оба дела одновременно.' }
    ],
    outro: 'Теперь отчёты Ольги не трогают запись: команды идут в ядро, тяжёлое чтение — в модель чтения, которая собирается из событий всех владельцев. Вы знаете её цену — отставание, проекции, перестройку — и знаете, где она не нужна: «мои записи» и решение о записи остаются в ядре. Инцидент 7 закрыт: история — из снимка ядра, свежее — из Kafka, повторы склеены по paymentId, и каждый день витрину сверяют с 1С. Завтра — наблюдаемость: как узнать о таком расхождении раньше Ирины, а об аварии — раньше клиентов.',
    tasks: [howCqrs, howES, howProj, repTask, projTask, rbTask, ncTask]
  });
})();
