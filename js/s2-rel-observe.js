/* Неделя 7, четверг 10:00: наблюдаемость и SLO. Канон — _dev/DOMAIN-2.md §6 (три сигнала, RED, OpenTelemetry и один traceId
   через ядро, Kafka и сервисы; SLO записи, пропуска и оплаты; бюджет ошибок 0,1 %; алерты на симптомы) и инцидент 4 (§8).
   Теория (живая): один сбой глазами логов, метрик и трассировки; traceId по цепочке приложение → шлюз → ядро → Kafka → бонусы
   (ui.seq, строка лога на каждом шаге); перцентили на живой гистограмме; калькулятор SLO и расход бюджета; симптом или причина.
   Практика: SLI, цель и окно для записи, пропуска и оплаты; лаборатория «400 алертов»; расследование по трассировке
   «оплатила, а абонемент не активировался»; требования к наблюдаемости в ФТ своими словами. */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc;
  const ID = 'rel-observe';

  if (!document.getElementById('ob-css')) document.head.insertAdjacentHTML('beforeend', `<style id="ob-css">
    .ob-root, .ob-root .stack, .ob-root .stack > * { min-width: 0; }
    .ob-root :not(pre) > code { white-space: normal; overflow-wrap: anywhere; }
    .ob-root .seg button { white-space: normal; text-align: left; }
    .ob-root .row > .btn { white-space: normal; text-align: left; max-width: 100%; }
    .ob-box { display: grid; gap: 12px; padding: 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); min-width: 0; }
    .ob-box > * { min-width: 0; }
    .ob-set { display: grid; grid-template-columns: minmax(0, 170px) minmax(0, 1fr); gap: 8px 14px; align-items: center; }
    .ob-set > .lbl { font-size: 13.5px; color: var(--text-2); min-width: 0; }
    .ob-set > .lbl small { display: block; font-size: 12px; color: var(--text-muted); }
    .ob-set > .seg { justify-self: start; max-width: 100%; }
    .ob-range { width: 100%; margin: 4px 0; accent-color: var(--accent); }
    .ob-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .ob-stats .v { font-size: 16px; overflow-wrap: anywhere; }
    .ob-stats .s { overflow-wrap: anywhere; }
    .ob-sc { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .ob-sc .stat.cur { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
    .ob-sc .v { font-size: 15px; }
    .ob-log { display: grid; gap: 3px; font: 12px/1.45 var(--f-mono); background: var(--code-bg); border: 1px solid var(--border); border-radius: 10px; padding: 8px; overflow-x: auto; }
    .ob-log div { white-space: pre-wrap; overflow-wrap: anywhere; padding: 3px 6px; border-radius: 5px; color: var(--text-2); }
    .ob-log div.hl { background: var(--accent-soft); color: var(--text); }
    .ob-log div.err { background: var(--bad-soft); color: var(--text); }
    .ob-log div.dim { opacity: .45; }
    .ob-log b { color: var(--accent); font-weight: 600; }
    .ob-charts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .ob-chart { border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; background: var(--surface-2); display: grid; gap: 6px; min-width: 0; }
    .ob-chart .h { font-size: 12.5px; color: var(--text-2); display: flex; justify-content: space-between; gap: 6px; flex-wrap: wrap; }
    .ob-chart .h b { font-family: var(--f-mono); }
    .ob-bars { display: grid; grid-template-columns: repeat(var(--n, 20), minmax(0, 1fr)); gap: 2px; align-items: end; height: 70px; }
    .ob-bars i { display: block; background: var(--info); border-radius: 2px 2px 0 0; min-height: 2px; }
    .ob-bars i.bad { background: var(--bad); }
    .ob-axis { display: flex; justify-content: space-between; font: 10.5px/1.2 var(--f-mono); color: var(--text-muted); }
    .ob-wf { display: grid; gap: 3px; }
    .ob-span { display: grid; grid-template-columns: minmax(0, 300px) minmax(0, 1fr) 78px; gap: 8px; align-items: center; padding: 4px 6px; border-radius: 7px; border: 1px solid transparent; background: none; color: var(--text); font: inherit; font-size: 12.5px; text-align: left; cursor: pointer; width: 100%; }
    .ob-span:hover { background: var(--surface-2); }
    .ob-span.sel { border-color: var(--accent); background: var(--accent-soft); }
    .ob-span.ghost { cursor: default; color: var(--text-muted); border: 1px dashed var(--border-strong); }
    .ob-span .nm { min-width: 0; overflow-wrap: anywhere; }
    .ob-span .nm small { display: block; color: var(--text-muted); font: 11px/1.2 var(--f-mono); }
    .ob-span .tr { position: relative; height: 14px; background: var(--surface-3); border-radius: 3px; }
    .ob-span .tr i { position: absolute; top: 2px; bottom: 2px; border-radius: 2px; background: var(--ok); min-width: 3px; }
    .ob-span .tr i.warn { background: var(--warn); } .ob-span .tr i.err { background: var(--bad); } .ob-span .tr i.info { background: var(--info); }
    .ob-span .tr em { position: absolute; top: 0; transform: translateX(-50%); font: 10.5px/1.2 var(--f-mono); font-style: normal; color: var(--text-muted); white-space: nowrap; }
    .ob-span .tr em:first-child { transform: none; }
    .ob-span .tr em:last-child { transform: translateX(-100%); }
    .ob-span .ms { font: 11.5px/1.2 var(--f-mono); text-align: right; color: var(--text-2); }
    .ob-span .ms.err { color: var(--bad); }
    .ob-det { border: 1px solid var(--border-strong); border-radius: 10px; padding: 10px 12px; background: var(--surface); display: grid; gap: 8px; }
    .ob-kv { display: grid; grid-template-columns: minmax(0, 190px) minmax(0, 1fr); gap: 3px 10px; font-size: 12.5px; }
    .ob-kv span:nth-child(odd) { color: var(--text-muted); font-family: var(--f-mono); overflow-wrap: anywhere; }
    .ob-kv span:nth-child(even) { font-family: var(--f-mono); overflow-wrap: anywhere; }
    .ob-hist { margin-top: 18px; display: grid; grid-template-columns: repeat(var(--n, 8), minmax(0, 1fr)); gap: 4px; align-items: end; height: 150px; border-bottom: 1px solid var(--border-strong); }
    .ob-hist i { display: block; background: var(--info); border-radius: 3px 3px 0 0; min-height: 1px; position: relative; }
    .ob-hist i.slow { background: var(--warn); }
    .ob-hist i span { position: absolute; top: -16px; left: 0; right: 0; text-align: center; font: 10.5px/1 var(--f-mono); color: var(--text-2); }
    .ob-hlab { display: grid; grid-template-columns: repeat(var(--n, 8), minmax(0, 1fr)); gap: 4px; font: 10.5px/1.2 var(--f-mono); color: var(--text-muted); text-align: center; }
    .ob-hlab span { overflow-wrap: anywhere; }
    .ob-hlab b { display: block; color: var(--accent); font-weight: 600; min-height: 13px; }
    .ob-budget { height: 22px; border-radius: 6px; background: var(--surface-3); overflow: hidden; display: flex; }
    .ob-budget i { display: block; height: 100%; border-right: 1px solid var(--surface); }
    .ob-budget i.a { background: var(--info); } .ob-budget i.b { background: var(--warn); } .ob-budget i.c { background: var(--bad); }
    .ob-case { display: grid; gap: 8px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); }
    .ob-case .row { flex-wrap: wrap; }
    .ob-crit { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    .ob-crit li { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 8px; font-size: 13.5px; align-items: start; }
    .ob-crit li > b { font: 700 13px/1.4 var(--f-mono); text-align: center; }
    .ob-crit li.ok > b { color: var(--ok); } .ob-crit li.bad > b { color: var(--bad); }
    .ob-crit li small { display: block; color: var(--text-muted); font-size: 12.5px; }
    .ob-rules { display: grid; gap: 6px; }
    .ob-rule { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 12px; align-items: center; padding: 8px 10px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
    .ob-rule > div { min-width: 0; }
    .ob-rule small { display: block; color: var(--text-muted); font-size: 12px; }
    .ob-rule.ok { border-color: var(--ok); } .ob-rule.bad { border-color: var(--bad); } .ob-rule.warn { border-color: var(--warn); }
    .ob-feed { display: grid; gap: 3px; font: 12px/1.4 var(--f-mono); max-height: 230px; overflow: auto; padding: 8px; border: 1px solid var(--border); border-radius: 10px; background: var(--code-bg); }
    .ob-feed div { padding: 2px 6px; border-radius: 4px; overflow-wrap: anywhere; }
    .ob-feed div.sym { color: var(--ok); } .ob-feed div.cause { color: var(--text-2); }
    .ob-feed div.more { color: var(--bad); }
    .ob-ops { display: grid; gap: 12px; }
    .ob-op { display: grid; gap: 8px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); }
    .ob-op.ok { border-color: var(--ok); } .ob-op.bad { border-color: var(--bad); } .ob-op.warn { border-color: var(--warn); }
    .ob-op .means { font-size: 12.5px; color: var(--text-2); }
    @media (max-width: 760px) {
      .ob-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .ob-sc, .ob-charts { grid-template-columns: minmax(0, 1fr); }
      .ob-span { grid-template-columns: minmax(0, 1fr) 70px; }
      .ob-span .tr { grid-column: 1 / -1; grid-row: 2; }
    }
    @media (max-width: 640px) {
      .ob-set { grid-template-columns: minmax(0, 1fr); gap: 4px; }
      .ob-set > .lbl { margin-top: 8px; }
      .ob-rule { grid-template-columns: minmax(0, 1fr); }
      .ob-kv { grid-template-columns: minmax(0, 1fr); }
      .ob-kv span:nth-child(even) { margin-bottom: 4px; }
      .ob-hist { height: 120px; }
    }
  </style>`);

  // ---------- общие помощники ----------
  const L = (id, t, sub) => ({ id, t, sub });
  const mount = (el, cls) => { const d = document.createElement('div'); if (cls) d.className = cls; el.appendChild(d); return d; };
  const plainT = s => String(s || '').replace(/<[^>]+>/g, '');
  const tOf = (list, v) => { const x = list.find(o => o.v === v); return x ? plainT(x.t) : '—'; };
  const quizRef = QS => QS.map(cfg => cfg.options.map((o, i) => o.ok ? i : -1).filter(i => i >= 0));
  const fmtMs = ms => ms < 1000 ? Math.round(ms) + ' мс' : (ms / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' с';
  const fmtMin = m => m < 60 ? m.toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' мин' : Math.floor(m / 60) + ' ч ' + Math.round(m % 60) + ' мин';
  const lockSegs = (el, ro) => { if (ro) TR.$$('[data-seg] button', el).forEach(b => { b.disabled = true; }); };
  const logHTML = o => esc(JSON.stringify(o)).replace(/(&quot;traceId&quot;:&quot;)([0-9a-f]+)(&quot;)/, '$1<b>$2</b>$3');

  // =====================================================================
  // Теория 1. Логи, метрики, трассировки. Соседний пример: код входа по SMS не приходит
  // =====================================================================
  const SMS_TID = '9f2c41d0a7b3e518';
  const SMS_LOGS = [
    { o: { ts: '21:10:02.114', level: 'INFO', svc: 'api-gateway', traceId: SMS_TID, route: 'POST /v1/auth/sms-codes', status: 202, durationMs: 38 }, mine: 1 },
    { o: { ts: '21:10:02.117', level: 'INFO', svc: 'core', traceId: '5b81e0c2d94f7a36', module: 'booking', msg: 'booking created', bookingId: '9e2d7a10…' } },
    { o: { ts: '21:10:02.131', level: 'INFO', svc: 'core', traceId: SMS_TID, module: 'clients', msg: 'sms code issued', clientId: 'c-77…', phone: '+7 9** *** **14' }, mine: 1 },
    { o: { ts: '21:10:02.140', level: 'INFO', svc: 'notifications', traceId: SMS_TID, msg: 'task queued', queue: 'sms', priority: 9 }, mine: 1 },
    { o: { ts: '21:10:02.162', level: 'INFO', svc: 'core', traceId: '0d4a77c1b2e95f08', module: 'schedule', msg: 'schedule served', clubId: 'cl-12', cache: 'hit' } },
    { o: { ts: '21:10:12.152', level: 'ERROR', svc: 'notifications', traceId: SMS_TID, msg: 'sms gateway timeout', timeoutMs: 10000, attempt: 1 }, mine: 1, err: 1 },
    { o: { ts: '21:10:12.160', level: 'WARN', svc: 'notifications', traceId: '71fe2a09c3d4b816', msg: 'sms gateway timeout', timeoutMs: 10000, attempt: 2 }, err: 1 },
    { o: { ts: '21:10:16.410', level: 'INFO', svc: 'notifications', traceId: SMS_TID, msg: 'sms sent', attempt: 2, durationMs: 4250 }, mine: 1 }
  ];
  const SMS_Q = [
    { id: 'who', t: 'Сколько клиентов задело и с какого времени?', v: 'metrics', a: 'Метрики: с 21:08 доля ошибок отправки SMS выросла до 40 %, время отправки — до 10 с. Задело всех, кто входил в эти минуты: около 120 человек. Логи этого не скажут — их тысячи строк, по одной на событие.' },
    { id: 'anna', t: 'Клиентка звонит: «Код не пришёл». Что именно случилось с её кодом?', v: 'logs', a: 'Логи: находим по номеру клиента одну строку, берём из неё traceId и видим все строки этого запроса — код выдан, задача в очереди, шлюз молчал 10 секунд, со второй попытки отправлено. Метрики про конкретного человека не знают.' },
    { id: 'where', t: 'На каком шаге ушли 14 секунд?', v: 'trace', a: 'Трассировка: видно цепочку шагов и сколько длился каждый. 38 мс шлюз, 17 мс ядро, 10 с первая попытка SMS-шлюза, 4,3 с вторая. Сразу ясно, где время.' },
    { id: 'now', t: 'Есть ли проблема прямо сейчас — будить ли дежурного?', v: 'metrics', a: 'Метрики: доля ошибок и время ответа за последние 5 минут сравниваются с порогом. На метриках строят алерты — они дешёвые и показывают картину целиком.' }
  ];
  const SMS_RATE = [42, 40, 44, 41, 43, 45, 44, 42, 46, 48, 51, 55, 58, 54, 50, 47, 45, 44, 43, 42];
  const SMS_ERR = [0.2, 0.1, 0.3, 0.2, 0.1, 0.2, 0.3, 0.2, 18, 41, 38, 36, 40, 33, 12, 1, 0.4, 0.2, 0.3, 0.2];
  const SMS_P95 = [0.6, 0.7, 0.6, 0.6, 0.7, 0.6, 0.8, 0.7, 9.2, 10, 10, 10, 10, 9.6, 6.1, 1.2, 0.8, 0.7, 0.6, 0.6];
  const SMS_SPANS = [
    { n: 'Приложение: «Получить код»', s: 'app-android', t0: 0, d: 120, k: 'ok' },
    { n: 'POST /v1/auth/sms-codes', s: 'api-gateway', t0: 10, d: 38, k: 'ok' },
    { n: 'Выдать код, задача в очередь', s: 'core · clients', t0: 20, d: 17, k: 'ok' },
    { n: 'Отправка SMS, попытка 1 — таймаут', s: 'notifications → SMS-шлюз', t0: 40, d: 10000, k: 'err' },
    { n: 'Отправка SMS, попытка 2', s: 'notifications → SMS-шлюз', t0: 10050, d: 4250, k: 'warn' }
  ];
  function chartHTML(t, arr, fmt, badIf) {
    const max = Math.max.apply(null, arr);
    return `<div class="ob-chart"><div class="h"><span>${t}</span><b>${fmt(arr[arr.length - 1])}</b></div><div class="ob-bars" style="--n:${arr.length}">${arr.map(v => `<i class="${badIf(v) ? 'bad' : ''}" style="height:${Math.max(3, v / max * 100)}%"></i>`).join('')}</div><div class="ob-axis"><span>21:00</span><span>21:10</span><span>21:20</span></div></div>`;
  }
  function drawThree(pane) {
    const st = { view: 'logs', q: '', only: false };
    pane.innerHTML = `<div class="stack">
      <p class="small muted">Вечер, 21:08. Клиенты жалуются: код входа по SMS приходит через 15 секунд или не приходит. Один и тот же сбой — глазами трёх сигналов. Сначала задайте вопрос, потом смотрите, какой сигнал на него отвечает.</p>
      <div class="row" data-obqs></div>
      <div data-obans></div>
      <div class="ob-box"><div class="ob-set"><div class="lbl">Смотрим глазами</div>${ui.seg('view', [{ v: 'logs', t: 'Логи' }, { v: 'metrics', t: 'Метрики' }, { v: 'trace', t: 'Трассировка' }], st.view, 'accent')}</div></div>
      <div data-obv></div>
      <div data-obn></div>
    </div>`;
    function draw() {
      TR.$('[data-obqs]', pane).innerHTML = SMS_Q.map(q => `<button type="button" class="btn xs" data-obq="${q.id}" aria-pressed="${st.q === q.id}">${esc(q.t)}</button>`).join('');
      const q = SMS_Q.find(x => x.id === st.q);
      TR.$('[data-obans]', pane).innerHTML = q ? ui.note(q.v === st.view ? 'ok' : 'warn', q.v === st.view ? 'Этот сигнал и отвечает' : 'Попробуйте другой сигнал', q.v === st.view ? q.a : 'На этот вопрос лучше отвечает другой взгляд — переключите «Смотрим глазами».') : '';
      TR.$$('[data-seg="view"] button', pane).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === st.view)));
      const v = TR.$('[data-obv]', pane);
      if (st.view === 'logs') {
        v.innerHTML = `<div class="row" style="margin-bottom:6px"><button type="button" class="btn xs" data-obonly aria-pressed="${st.only}">Показать только traceId ${SMS_TID}</button></div>
          <div class="ob-log">${SMS_LOGS.filter(l => !st.only || l.mine).map(l => `<div class="${l.err && l.mine ? 'err' : st.only || !l.mine ? '' : 'hl'}">${logHTML(l.o)}</div>`).join('')}</div>`;
        TR.$('[data-obn]', pane).innerHTML = ui.note('', 'Логи — что именно случилось', '<b>Структурированный лог</b> — строка-JSON с полями: время, уровень, сервис, <code>traceId</code>, что произошло, ключи сущностей. По полям ищут и фильтруют. Логи отвечают «что случилось с этим запросом», но их миллионы — для картины целиком не годятся. Заметьте: телефон в логе замаскирован — ПДн в логи не пишут.');
      } else if (st.view === 'metrics') {
        v.innerHTML = `<div class="ob-charts">${chartHTML('Rate · отправок SMS в минуту', SMS_RATE, x => x + '/мин', () => false)}${chartHTML('Errors · доля ошибок, %', SMS_ERR, x => x.toLocaleString('ru-RU') + ' %', x => x > 2)}${chartHTML('Duration · p95 отправки, с', SMS_P95, x => x.toLocaleString('ru-RU') + ' с', x => x > 3)}</div>`;
        TR.$('[data-obn]', pane).innerHTML = ui.note('', 'Метрики — сколько и когда', '<b>Метрики</b> — числа во времени: сколько запросов (<b>R</b>ate), какая доля ошибок (<b>E</b>rrors), сколько длились (<b>D</b>uration, перцентили). Это <b>RED</b>. Дёшево хранить, удобно строить графики и алерты. Видно «с 21:08 плохо всем» — но не видно, почему и что именно с клиенткой, которая звонит.');
      } else {
        const T = 14400;
        v.innerHTML = `<div class="ob-wf">${SMS_SPANS.map((sp, i) => `<div class="ob-span" style="cursor:default"><span class="nm" style="padding-left:${Math.min(i, 2) * 12}px">${esc(sp.n)}<small>${esc(sp.s)}</small></span><span class="tr"><i class="${sp.k === 'ok' ? '' : sp.k}" style="left:${sp.t0 / T * 100}%;width:${Math.max(0.6, sp.d / T * 100)}%"></i></span><span class="ms ${sp.k === 'err' ? 'err' : ''}">${fmtMs(sp.d)}</span></div>`).join('')}</div><div class="small dim">Трасса <code>${SMS_TID}</code> · шкала — 14,4 с</div>`;
        TR.$('[data-obn]', pane).innerHTML = ui.note('', 'Трассировка — где ушло время', '<b>Трасса</b> — путь одного запроса через все сервисы. Каждый шаг — <b>спан</b>: кто, что делал, когда начал, сколько длилось, чем кончилось. Все спаны связаны одним <code>traceId</code>. Видно, что 14 секунд — это SMS-шлюз, а не ядро. Трассы хранят выборочно: все с ошибками и часть обычных.');
      }
    }
    ui.onSeg(pane, (n, val) => { if (n === 'view') { st.view = val; draw(); } });
    TR.on(pane, 'click', '[data-obq]', (e, b) => { st.q = b.dataset.obq; draw(); });
    TR.on(pane, 'click', '[data-obonly]', () => { st.only = !st.only; draw(); });
    draw();
  }
  // traceId по цепочке: приложение → шлюз → ядро → Kafka → бонусы
  const TID = 'a1b2c3d4e5f60718';
  const CHAIN = [
    { from: 'app', to: 'gw', t: 'POST /classes/{id}/bookings\ntraceparent: …a1b2…', note: 'Анна нажала «Записаться». Приложение создаёт трассу и кладёт её номер в заголовок <code>traceparent</code> (стандарт W3C Trace Context).', noteNo: "Анна нажала «Записаться». Приложение пишет номер трассы в свой лог, но в запрос его не кладёт.", svc: 'app-ios', own: 'a1b2c3d4e5f60718', log: { level: 'INFO', msg: 'tap «Записаться»', classId: '4b1f0c3e…' } },
    { from: 'gw', to: 'core', t: 'тот же traceparent', note: 'API-шлюз не придумывает свой номер, а передаёт полученный дальше и пишет свой спан.', noteNo: "API-шлюз номера не получил и придумал свой: <code>7c0e9b13f2a84d55</code>.", svc: 'api-gateway', own: '7c0e9b13f2a84d55', log: { level: 'INFO', route: 'POST /v1/classes/{classId}/bookings', status: 201, durationMs: 84 } },
    { from: 'core', to: 'core', t: 'транзакция:\nзапись + outbox', note: 'Ядро создаёт запись и строку outbox в одной транзакции. В строку outbox попадает и <code>traceId</code> — иначе цепочка оборвётся на Kafka.', noteNo: "Ядро — ещё один свой номер. В строку outbox номер не попадает.", svc: 'core', own: '3d9a51e7c0b26f84', log: { level: 'INFO', module: 'booking', msg: 'booking created', bookingId: '9e2d7a10…' } },
    { from: 'core', to: 'app', t: '201 Created', reply: true, kind: 'ok', note: 'Анна видит «Вы записаны». Для неё всё закончилось — а для системы только начинается.', noteNo: "Анна видит «Вы записаны». Для неё всё закончилось — а для системы только начинается.", svc: 'core', own: '3d9a51e7c0b26f84', log: { level: 'INFO', module: 'booking', msg: 'response sent', status: 201 } },
    { from: 'core', to: 'kafka', t: 'BookingCreated\n"traceId": "a1b2…"', kind: 'accent', note: 'Ретранслятор отправляет событие в <code>puls.booking.events.v1</code>. Сам по себе контекст через брокер не переходит: его кладут в конверт события (поле <code>traceId</code> в каноне «Пульса») или в заголовки сообщения.', noteNo: "Событие уходит в Kafka без traceId: ретранслятор вообще не знает, к какому запросу оно относится.", svc: 'outbox-relay', own: '—', log: { level: 'INFO', topic: 'puls.booking.events.v1', eventId: '6f1c2d9e…', partition: 7 } },
    { from: 'kafka', to: 'bonus', t: 'BookingCreated', note: 'Сервис «Бонусы» — один из шести потребителей события. Он берёт <code>traceId</code> из конверта и продолжает ту же трассу.', noteNo: "«Бонусы» начинают новую трассу со своим номером <code>e45f08a2d1c97b30</code>.", svc: 'bonus', own: 'e45f08a2d1c97b30', log: { level: 'INFO', consumer: 'bonus', eventId: '6f1c2d9e…', msg: 'event received' } },
    { from: 'bonus', to: 'bonus', t: 'обработано', kind: 'ok', note: 'Готово. По одному номеру <code>a1b2c3d4e5f60718</code> дежурный найдёт все строки логов и все спаны — от нажатия Анны до сервиса бонусов.', noteNo: "Готово — но связать пять строк логов теперь можно только по времени и догадкам.", svc: 'bonus', own: 'e45f08a2d1c97b30', log: { level: 'INFO', consumer: 'bonus', msg: 'event processed', durationMs: 6 } }
  ];
  const CH_TIMES = ['20:00:03.101', '20:00:03.118', '20:00:03.170', '20:00:03.202', '20:00:03.640', '20:00:03.910', '20:00:03.916'];
  function chainLog(i, prop) {
    const c = CHAIN[i], tid = prop ? TID : c.own;
    const o = Object.assign({ ts: CH_TIMES[i], svc: c.svc }, tid === '—' ? {} : { traceId: tid }, c.log);
    return o;
  }
  function drawChain(pane) {
    const st = { prop: 'yes', cur: -1, found: false };
    pane.innerHTML = `<div class="stack">
      <div class="ob-box"><div class="ob-set"><div class="lbl">traceId между сервисами</div>${ui.seg('prop', [{ v: 'yes', t: 'Передаём дальше — один на всю цепочку' }, { v: 'no', t: 'Не передаём — каждый сервис свой' }], st.prop, 'accent')}</div></div>
      <div data-obseq></div>
      <div class="row" data-obsteps></div>
      <div data-oblog></div>
      <div class="row"><button type="button" class="btn sm" data-obfind>Найти все строки логов по traceId ${TID}</button></div>
      <div data-obfound></div>
    </div>`;
    let api;
    function steps() { return CHAIN.map(c => ({ from: c.from, to: c.to, t: st.prop === 'yes' ? c.t : c.t.replace(/\n"traceId": "a1b2…"|\ntraceparent: …a1b2…|тот же traceparent/, st.prop === 'yes' ? '' : (c.from === 'gw' ? 'новый traceId' : '')), reply: c.reply, kind: st.prop === 'yes' ? c.kind : (c.kind === 'accent' ? 'bad' : c.kind), note: st.prop === 'yes' ? c.note : c.noteNo })); }
    function showLog(i) {
      st.cur = i;
      TR.$$('[data-obst]', pane).forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.obst === i)));
      TR.$('[data-oblog]', pane).innerHTML = i < 0 ? '<p class="small muted">Нажимайте «Шаг →» или номер шага — под схемой появится строка лога этого сервиса.</p>'
        : `<div class="eyebrow">Строка лога · шаг ${i + 1}</div><div class="ob-log"><div class="hl">${logHTML(chainLog(i, st.prop === 'yes'))}</div></div>`;
    }
    function build() {
      const host = TR.$('[data-obseq]', pane); host.innerHTML = '';
      api = ui.seq(mount(host), {
        title: 'Один traceId через приложение, шлюз, ядро, Kafka и бонусы', laneW: 150,
        hint: 'Нажимайте «Шаг →» и читайте пояснение под схемой.',
        lanes: [L('app', 'Приложение', 'Анна'), L('gw', 'API-шлюз'), L('core', 'Ядро', 'Запись'), L('kafka', 'Kafka', 'booking.events'), L('bonus', 'Бонусы', 'потребитель')],
        steps: steps(),
        onStep: i => showLog(i)
      });
      TR.$('[data-obsteps]', pane).innerHTML = '<span class="small dim">Перейти к шагу:</span>' + CHAIN.map((c, i) => `<button type="button" class="btn xs" data-obst="${i}" aria-pressed="false">${i + 1}</button>`).join('');
      showLog(-1);
    }
    function find() {
      const prop = st.prop === 'yes';
      const lines = CHAIN.map((_, i) => chainLog(i, prop)).filter((o, i, arr) => o.traceId === TID && arr.findIndex(x => JSON.stringify(x) === JSON.stringify(o)) === i);
      TR.$('[data-obfound]', pane).innerHTML = `<div class="ob-log">${lines.map(o => `<div class="hl">${logHTML(o)}</div>`).join('')}</div>` + (prop
        ? ui.note('ok', `Найдено строк: ${lines.length} — из пяти сервисов`, 'Вся история записи Анны — одним поиском. Это и есть корреляция: один номер связывает логи, спаны и событие в Kafka.')
        : ui.note('bad', `Найдено строк: ${lines.length}`, 'Только строка приложения. Дальше у каждого сервиса свой номер, а у ретранслятора — никакого. Чтобы понять, дошло ли событие до бонусов, придётся сопоставлять строки по времени и догадкам. В 20:03, когда таких записей 400 в секунду, это невозможно.'));
    }
    ui.onSeg(pane, (n, v) => { if (n === 'prop') { st.prop = v; TR.$('[data-obfound]', pane).innerHTML = ''; build(); } });
    TR.on(pane, 'click', '[data-obst]', (e, b) => { const i = +b.dataset.obst; api.reset(); for (let k = 0; k <= i; k++) api.step(); });
    TR.on(pane, 'click', '[data-obfind]', () => find());
    build();
  }
  const howSignals = {
    id: 'how-signals', covers: ['sli-pick', 'trace-hunt', 'obs-req'], title: 'Как это работает: логи, метрики, трассировки', free: true, noReset: true,
    simple: {
      icon: '🔦',
      plain: 'Чтобы понять, что сломалось, у системы есть три вида записей: подробный дневник каждого события, счётчики «сколько и как быстро» и маршрут каждого запроса.',
      analogy: 'В клубе: журнал администратора — кто, когда и что сказал (логи); табло на стене — сколько людей прошло за час и сколько ждали у турникета (метрики); маршрутный лист клиента — ресепшен → раздевалка → зал → душ, с отметкой времени на каждом шаге (трассировка). А номер клубной карты связывает все три: по нему находят человека и в журнале, и в маршрутном листе.',
      tech: '<b>Логи</b> — структурированные записи о событиях (JSON с <code>traceId</code>). <b>Метрики</b> — числовые ряды; для сервисов — <b>RED</b>: Rate, Errors, Duration. <b>Трассировки</b> — путь запроса из спанов (OpenTelemetry). Корреляция — один <code>traceId</code> от приложения через шлюз (<code>traceparent</code>), ядро, конверт события Kafka и сервисы-потребители.'
    },
    lead: ui.brief({
      situation: 'Соседний пример: вечером клиенты жалуются, что код входа по SMS приходит через 15 секунд или не приходит вовсе. Второй пример — запись Анны на йогу, которая проходит через приложение, API-шлюз, ядро, Kafka и сервис «Бонусы».',
      todo: [
        'Вкладка «Один сбой — три взгляда»: нажмите вопрос дежурного и найдите сигнал, который на него отвечает. Пройдите все четыре вопроса.',
        'В логах нажмите «Показать только traceId…». Что общего у оставшихся строк?',
        'Вкладка «traceId по цепочке»: пройдите шаги и смотрите строку лога каждого сервиса. Нажмите «Найти все строки…».',
        'Переключите на «Не передаём» и снова найдите строки. Сколько осталось?'
      ],
      look: 'В логах подсвечены строки одного запроса, красным — ошибки, синим выделен traceId. На графиках красные столбики — плохие минуты. В трассе каждая полоса — шаг (спан): где начался и сколько длился.'
    }),
    render(el) {
      el.classList.add('ob-root');
      ui.tabs(mount(el), [
        { id: 'three', t: 'Один сбой — три взгляда', render: pane => drawThree(pane) },
        { id: 'chain', t: 'traceId по цепочке', render: pane => drawChain(pane) }
      ], 'three');
    }
  };

  // =====================================================================
  // Теория 2. Перцентили, SLI → SLO → бюджет ошибок, симптом или причина. Соседний пример: кабинет тренера
  // =====================================================================
  const SLOW = [0, 1, 2, 4, 6, 10, 20];
  const HB = [{ lo: 0, hi: 100, t: '<100' }, { lo: 100, hi: 200, t: '100–200' }, { lo: 200, hi: 300, t: '200–300' }, { lo: 300, hi: 500, t: '300–500' }, { lo: 500, hi: 1000, t: '0,5–1 с' }, { lo: 1000, hi: 1500, t: '1–1,5 с' }, { lo: 1500, hi: 1e9, t: '1,5–2 с' }];
  function latSample(slowPct) {
    const r = TR.rand('ob-lat'), r2 = TR.rand('ob-lat-slow'), n = 1000, k = Math.round(n * slowPct / 100);
    const idx = TR.shuffle(Array.from({ length: n }, (_, i) => i), 'ob-slowpick').slice(0, k), slow = new Set(idx);
    const v = [];
    for (let i = 0; i < n; i++) { const a = r(), b = r2(); v.push(slow.has(i) ? 1000 + 990 * b : 55 + 200 * a * a); }
    const s = v.slice().sort((x, y) => x - y);
    const mean = v.reduce((p, x) => p + x, 0) / n;
    return { v, mean, p50: s[499], p95: s[949], p99: s[989], counts: HB.map(h => v.filter(x => x >= h.lo && x < h.hi).length) };
  }
  function drawPct(pane) {
    const st = { k: 0, err: '0' };
    pane.innerHTML = `<div class="stack">
      <div class="ob-box">
        <label class="field"><span>Медленных запросов (ждут ответа внешнего календаря тренера): <b data-obk></b></span><input type="range" class="ob-range" min="0" max="${SLOW.length - 1}" step="1" value="0" data-obr aria-label="Доля медленных запросов"></label>
        <div class="ob-set"><div class="lbl">Ошибок (5xx)</div>${ui.seg('err', [{ v: '0', t: '0 %' }, { v: '0.5', t: '0,5 %' }, { v: '3', t: '3 %' }], st.err, 'accent')}</div>
      </div>
      <div class="ob-stats" data-obred></div>
      <div class="eyebrow">1 000 открытий «Моя неделя» за последнюю минуту · сколько длились</div>
      <div data-obh></div>
      <div class="ob-stats" data-obp></div>
      <div data-obn></div>
    </div>`;
    function draw() {
      const pct = SLOW[st.k], r = latSample(pct), max = Math.max.apply(null, r.counts);
      TR.$('[data-obk]', pane).textContent = pct + ' %';
      const where = x => HB.findIndex(h => x >= h.lo && x < h.hi);
      const marks = HB.map(() => []);
      [['p50', r.p50], ['p95', r.p95], ['p99', r.p99], ['ср.', r.mean]].forEach(([n, x]) => marks[where(x)].push(n));
      TR.$('[data-obh]', pane).innerHTML = `<div class="ob-hist" style="--n:${HB.length}">${r.counts.map((c, i) => `<i class="${HB[i].lo >= 1000 ? 'slow' : ''}" style="height:${c ? Math.max(1.5, c / max * 100) : 0}%"><span>${c}</span></i>`).join('')}</div>
        <div class="ob-hlab" style="--n:${HB.length}">${HB.map((h, i) => `<span><b>${marks[i].join(' ')}</b>${h.t}</span>`).join('')}</div>`;
      const e = +st.err;
      TR.$('[data-obred]', pane).innerHTML = `
        <div class="stat"><span class="k">Rate</span><span class="v">1 000/мин</span><span class="s">сколько запросов</span></div>
        <div class="stat"><span class="k">Errors</span><span class="v ${e >= 1 ? 'bad' : e > 0 ? 'warn' : 'ok'}">${String(e).replace('.', ',')} %</span><span class="s">${Math.round(e * 10)} ошибок из 1 000</span></div>
        <div class="stat"><span class="k">Duration · p95</span><span class="v ${r.p95 > 300 ? 'bad' : 'ok'}">${fmtMs(r.p95)}</span><span class="s">цель ≤ 300 мс</span></div>
        <div class="stat"><span class="k">Duration · среднее</span><span class="v ${r.mean > 300 ? 'bad' : 'ok'}">${fmtMs(r.mean)}</span><span class="s">то, что «в среднем»</span></div>`;
      TR.$('[data-obp]', pane).innerHTML = `
        <div class="stat"><span class="k">p50 · медиана</span><span class="v">${fmtMs(r.p50)}</span><span class="s">половина быстрее</span></div>
        <div class="stat"><span class="k">p95</span><span class="v ${r.p95 > 300 ? 'bad' : 'ok'}">${fmtMs(r.p95)}</span><span class="s">95 из 100 быстрее</span></div>
        <div class="stat"><span class="k">p99</span><span class="v ${r.p99 > 1000 ? 'bad' : r.p99 > 300 ? 'warn' : 'ok'}">${fmtMs(r.p99)}</span><span class="s">99 из 100 быстрее</span></div>
        <div class="stat"><span class="k">Ждали дольше 1 с</span><span class="v ${pct ? 'bad' : 'ok'}">${r.v.filter(x => x > 1000).length}</span><span class="s">тренеров из 1 000</span></div>`;
      let n;
      if (!pct) n = ui.note('', 'Все быстрые', 'Среднее, медиана и p95 рядом — хвоста нет. Двигайте ползунок: пусть часть запросов ждёт внешний календарь.');
      else if (r.mean <= 300 && r.p95 > 300) n = ui.note('bad', 'Среднее врёт', `Среднее — ${fmtMs(r.mean)}, «всё хорошо, меньше 300 мс». А p95 — ${fmtMs(r.p95)}: ${pct} тренеров из 100 ждут больше секунды. Среднее смешивает ${1000 - pct * 10} быстрых и ${pct * 10} медленных и показывает число, которого не видел никто.`);
      else if (r.p99 <= 300) n = ui.note('warn', 'Хвост не видит даже p99', `${pct * 10} человек из 1 000 ждут больше секунды — это меньше 1 %, и p99 (${fmtMs(r.p99)}) их не замечает. Среднее — тем более. Такой хвост ловят счётчиком «дольше секунды» или p99,9.`);
      else if (r.p95 <= 300) n = ui.note('warn', 'Хвост уже есть', `p95 ещё ${fmtMs(r.p95)}, но p99 — ${fmtMs(r.p99)}: ${pct * 10} человек из 1 000 ждут секунды. Среднее (${fmtMs(r.mean)}) этого почти не заметило. Для турникета, где важен каждый, смотрят p99.`);
      else n = ui.note('bad', 'Плохо уже всем заметно', `Даже среднее (${fmtMs(r.mean)}) вышло за 300 мс. Но p95 (${fmtMs(r.p95)}) сказал бы об этом гораздо раньше.`);
      TR.$('[data-obn]', pane).innerHTML = n;
    }
    ui.onSeg(pane, (nm, v) => { if (nm === 'err') { st.err = v; draw(); } });
    TR.$('[data-obr]', pane).addEventListener('input', e => { st.k = +e.target.value; draw(); });
    draw();
  }
  const TGT = [{ v: '99', t: '99 %' }, { v: '99.5', t: '99,5 %' }, { v: '99.9', t: '99,9 %' }, { v: '99.95', t: '99,95 %' }, { v: '99.99', t: '99,99 %' }];
  const WIN = [{ v: '1', t: 'сутки' }, { v: '7', t: 'неделя' }, { v: '30', t: '30 дней' }, { v: '90', t: 'квартал' }];
  const BURN = [
    { id: 'deploy', t: 'Неудачная выкатка: 3 % ошибок 20 минут', m: 0.6 },
    { id: 'cal', t: 'Внешний календарь лежал, «Моя неделя» падала 50 минут', m: 50 },
    { id: 'slow', t: 'База тормозила: 40 % запросов дольше цели 30 минут', m: 12 },
    { id: 'drill', t: 'Учения на отказ: 10 минут недоступности', m: 10 },
    { id: 'night', t: 'Ночью переключали базу: 70 минут', m: 70 },
    { id: 'big', t: 'Выкатка без canary: 100 % ошибок 90 минут', m: 90 }
  ];
  function drawSlo(pane) {
    const st = { t: '99.5', w: '30', on: {} };
    pane.innerHTML = `<div class="stack">
      <p class="small muted">Соседний пример: кабинет тренера, экран «Моя неделя» — в среднем 50 запросов в секунду. <b>SLI</b> (что меряем) — доля успешных и быстрых ответов. <b>SLO</b> (цель) — какая доля должна быть хорошей за окно. <b>Бюджет ошибок</b> — остаток до 100 %: сколько плохого можно себе позволить.</p>
      <div class="ob-box"><div class="ob-set">
        <div class="lbl">Цель SLO</div>${ui.seg('t', TGT, st.t, 'accent')}
        <div class="lbl">Окно</div>${ui.seg('w', WIN, st.w, 'accent')}
      </div></div>
      <div class="ob-stats" data-obcalc></div>
      <div data-obcn></div>
      <div class="eyebrow" style="margin-top:6px">Расход бюджета за 30 дней · цель 99,5 %</div>
      <div class="row" data-obburn></div>
      <div data-obbar></div>
      <div data-obbn></div>
    </div>`;
    function drawCalc() {
      const t = +st.t, w = +st.w, min = (100 - t) / 100 * w * 1440, req = 50 * 86400 * w, bad = Math.round((100 - t) / 100 * req);
      TR.$('[data-obcalc]', pane).innerHTML = `
        <div class="stat"><span class="k">Можно лежать</span><span class="v ${min < 5 ? 'bad' : min < 60 ? 'warn' : 'ok'}">${fmtMin(min)}</span><span class="s">за ${tOf(WIN, st.w)}</span></div>
        <div class="stat"><span class="k">Или плохих ответов</span><span class="v">${bad.toLocaleString('ru-RU')}</span><span class="s">из ${req.toLocaleString('ru-RU')}</span></div>
        <div class="stat"><span class="k">Бюджет ошибок</span><span class="v">${(100 - t).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} %</span><span class="s">= 100 % − SLO</span></div>
        <div class="stat"><span class="k">Одна авария на 40 мин</span><span class="v ${40 > min ? 'bad' : 'ok'}">${Math.round(40 / min * 100)} %</span><span class="s">бюджета окна</span></div>`;
      TR.$('[data-obcn]', pane).innerHTML = ui.note(t >= 99.99 ? 'warn' : w === 1 ? 'warn' : '', t >= 99.99 ? 'Каждая девятка — в десять раз дороже' : w === 1 ? 'Окно в сутки слишком короткое' : 'Как читать',
        t >= 99.99 ? `${fmtMin(min)} в ${tOf(WIN, st.w)} — меньше, чем идёт любая выкатка или переключение базы. Такую цель держат резервированием всего и вся. Нужно ли это кабинету тренера? А 100 % — это ноль минут: ни одного релиза без риска.`
          : w === 1 ? `За сутки — всего ${fmtMin(min)}. Одна неудачная выкатка сжигает бюджет целиком, а на следующий день он снова полный — окно не учит. Обычно берут скользящие 30 дней.`
            : `Цель ${tOf(TGT, st.t)} за ${tOf(WIN, st.w)} = ${fmtMin(min)} простоя. Посмотрите, как меняется число при каждой лишней девятке и при другом окне.`);
    }
    function drawBurn() {
      const total = 0.005 * 30 * 1440, used = BURN.filter(b => st.on[b.id]).reduce((s, b) => s + b.m, 0), pct = used / total * 100;
      TR.$('[data-obburn]', pane).innerHTML = BURN.map(b => `<button type="button" class="btn xs" data-obb="${b.id}" aria-pressed="${!!st.on[b.id]}">${esc(b.t)} · ${fmtMin(b.m)}</button>`).join('');
      let acc = 0;
      TR.$('[data-obbar]', pane).innerHTML = `<div class="ob-budget">${BURN.filter(b => st.on[b.id]).map(b => { const w = Math.max(0, Math.min(100 - acc, b.m / total * 100)); acc += w; return `<i class="${acc > 99.9 ? 'c' : acc > 50 ? 'b' : 'a'}" style="width:${w}%" title="${esc(b.t)}"></i>`; }).join('')}</div>
        <div class="row between small dim" style="margin-top:4px"><span>потрачено ${fmtMin(used)} из ${fmtMin(total)}</span><span>${Math.round(pct)} %</span></div>`;
      TR.$('[data-obbn]', pane).innerHTML = pct > 100 ? ui.note('bad', 'Бюджет сгорел', 'До конца окна — заморозка рискованных релизов: только исправления надёжности. Это не наказание, а договор: бизнес заранее согласился, что ниже SLO новые функции ждут.')
        : pct > 50 ? ui.note('warn', 'Больше половины бюджета', 'Релизы — только осторожно: canary, флаги функций, не в пиковые часы. Команда смотрит, на что ушёл бюджет, и чинит главное.')
          : ui.note(used ? 'ok' : '', used ? 'Бюджет есть — можно рисковать' : 'Добавляйте события месяца', used ? 'Бюджет — это разрешение на риск: пока он не потрачен, новые функции выкатываются в обычном ритме. Без бюджета каждое падение — скандал, а с ним — плановый расход.' : 'Нажимайте события по одному и смотрите, сколько бюджета съедает каждое. Какое событие сжигает почти всё?');
    }
    ui.onSeg(pane, (n, v) => { if (n === 't' || n === 'w') { st[n] = v; drawCalc(); } });
    TR.on(pane, 'click', '[data-obb]', (e, b) => { st.on[b.dataset.obb] = !st.on[b.dataset.obb]; drawBurn(); });
    drawCalc(); drawBurn();
  }
  const SYM = [
    { id: 'err', t: 'Доля ошибок «Моя неделя» больше 2 % за 5 минут', ok: 'sym', why: 'Симптом: тренеры прямо сейчас видят ошибки. Будим.' },
    { id: 'cpu', t: 'CPU сервера больше 85 %', ok: 'cause', why: 'Причина — возможно. В пик 85 % — норма, а иногда сервис лежит при свободном процессоре. На график и в задачу, не будить.' },
    { id: 'lat', t: 'p95 «Моя неделя» больше 1 с 10 минут подряд', ok: 'sym', why: 'Симптом: тренеры ждут. Будим.' },
    { id: 'mem', t: 'Память JVM заполнена на 90 %', ok: 'cause', why: 'Причина — может, будет проблема, а может, сборщик мусора справится. В дашборд.' },
    { id: 'cal', t: 'Внешний календарь отвечает дольше 2 с', ok: 'cause', why: 'Причина: при запасном варианте (копия занятости) тренер этого не заметит. Тикет команде интеграций.' },
    { id: 'save', t: 'За 15 минут рабочего дня ни одного сохранённого расписания', ok: 'sym', why: 'Симптом бизнеса: ошибок может не быть вовсе (кнопка сломалась в приложении), а работа встала. Будим.' },
    { id: 'pod', t: 'Перезапустился один из трёх экземпляров', ok: 'cause', why: 'Причина: два других обслуживают запросы, клиенты не заметили. В журнал событий.' },
    { id: 'burn', t: 'За час сгорело 5 % месячного бюджета ошибок', ok: 'sym', why: 'Симптом, посчитанный на бюджете: такими темпами месяц кончится за сутки. Будим.' }
  ];
  function drawSym(pane) {
    const open = {};
    function draw() {
      pane.innerHTML = `<div class="stack">
        <p class="small muted">Сергею в 20:03 пришло 400 алертов — почти все про причины. Разложите восемь правил для кабинета тренера: будить дежурного (симптом — это чувствует пользователь) или отправить в дашборд и задачи (причина — может, станет проблемой, а может, нет).</p>
        ${SYM.map(c => {
          const g = open[c.id];
          return `<div class="ob-case"><div><b>${esc(c.t)}</b></div>
            <div class="row"><button type="button" class="btn xs" data-obs="${c.id}|sym" aria-pressed="${g === 'sym'}">Симптом — будить</button><button type="button" class="btn xs" data-obs="${c.id}|cause" aria-pressed="${g === 'cause'}">Причина — в дашборд и задачи</button></div>
            ${g ? ui.note(g === c.ok ? 'ok' : 'warn', g === c.ok ? 'Верно' : 'Посмотрите ещё раз', c.why) : ''}</div>`;
        }).join('')}
        ${ui.note('info', 'Правило', 'Будить человека — только когда пользователю плохо сейчас или скоро будет (бюджет быстро сгорает). Каждый алерт, который будит, должен говорить, что сломалось для клиента, и вести к инструкции (runbook). Причины нужны — для расследования, на графиках и в задачах. Если будить на всё, через неделю дежурный перестанет читать алерты — и пропустит настоящий.')}
      </div>`;
    }
    TR.on(pane, 'click', '[data-obs]', (e, b) => { const [id, v] = b.dataset.obs.split('|'); open[id] = v; draw(); });
    draw();
  }
  const howSlo = {
    id: 'how-slo', covers: ['alert-lab', 'sli-pick'], title: 'Как это работает: перцентили, SLO, бюджет ошибок и алерты', free: true, noReset: true,
    simple: {
      icon: '🎯',
      plain: 'Договоритесь заранее, что значит «работает хорошо», в цифрах. Тогда видно, сколько ещё можно сломать до того, как станет плохо, — и будить дежурного только тогда, когда плохо клиенту.',
      analogy: 'Клуб обещает: «В 95 случаях из 100 у турникета ждут не дольше 10 секунд». Это цель. Если в месяц было 3 «плохих» вечера, а разрешено 5 — можно спокойно ставить новый турникет. Если уже 6 — новшества откладываем и чиним очередь. А администратора будят не потому, что «в серверной жарко», а потому, что у входа стоят люди.',
      tech: '<b>Перцентиль</b> p95 — значение, которое не превышают 95 % измерений; среднее прячет хвост. <b>SLI</b> — измеримый показатель качества для пользователя (доля успешных ответов, доля ответов быстрее 300 мс). <b>SLO</b> — цель для SLI на окне (99,9 % за 30 дней). <b>Бюджет ошибок</b> = 100 % − SLO. Алерты — на <b>симптомы</b> и скорость сгорания бюджета, а не на причины (CPU, память).'
    },
    lead: ui.brief({
      situation: 'Соседний пример: кабинет тренера, экран «Моя неделя». Часть запросов ждёт внешний календарь тренера. Нужно договориться, что такое «работает хорошо», посчитать, сколько плохого можно себе позволить, и решить, на что будить дежурного.',
      todo: [
        'Вкладка «Перцентили»: двигайте «медленных запросов» от 0 до 20 %. При какой доле среднее ещё «хорошее», а p95 уже нет?',
        'Вкладка «SLO и бюджет»: переберите цели от 99 % до 99,99 % и окна. Сколько минут простоя даёт 99,9 % за 30 дней? Потом добавляйте события месяца в «Расход бюджета».',
        'Вкладка «Симптом или причина»: разложите восемь правил сами, потом читайте ответ.'
      ],
      look: 'Гистограмма — сколько запросов уложилось в каждый интервал времени; жёлтые столбики — дольше секунды; над подписями отмечено, куда попали медиана, p95, p99 и среднее. Полоса бюджета: синяя часть — спокойно, жёлтая — больше половины, красная — бюджет сгорел.'
    }),
    render(el) {
      el.classList.add('ob-root');
      ui.tabs(mount(el), [
        { id: 'pct', t: 'Перцентили', render: pane => drawPct(pane) },
        { id: 'slo', t: 'SLO и бюджет', render: pane => drawSlo(pane) },
        { id: 'sym', t: 'Симптом или причина', render: pane => drawSym(pane) }
      ], 'pct');
    }
  };

  // =====================================================================
  // Практика 1. SLI, цель и окно для записи, пропуска и оплаты
  // =====================================================================
  const SOPS = [
    {
      id: 'book', t: 'Запись на занятие', sub: '<code>POST /classes/{classId}/bookings</code> · воскресенье 20:00 — до 400 записей в секунду',
      sli: [
        { v: 'good', t: 'Доля успешных ответов (не 5xx) и p95 времени ответа', ok: 1 },
        { v: 'cpu', t: 'Загрузка CPU ядра', crit: 1, why: 'Причина, а не опыт клиента. В аварию 4 процессор отдыхал — потоки ждали 1С.' },
        { v: 'avg', t: 'Среднее время ответа', why: 'Среднее прячет хвост: 5 % медленных записей в нём почти не видно.' },
        { v: 'up', t: 'Сервер отвечает на проверку здоровья', crit: 1, why: 'Сервер «жив», а запись отвечает 503 — так и было в аварию 4.' }
      ],
      goal: [
        { v: 'g1', t: '99,9 % успешных, p95 ≤ 300 мс', ok: 1 },
        { v: 'g2', t: '100 % успешных, p95 ≤ 100 мс', why: '100 % — бюджет ноль: любая выкатка нарушает SLO. Цель должна быть достижимой.' },
        { v: 'g3', t: '99 % успешных, p95 ≤ 1 с', why: '99 % — 7 часов простоя в месяц. Ольга: «5 минут переживём, час — нет».' }
      ],
      win: [
        { v: 'day', t: 'сутки', half: 1, why: 'За сутки — 1,4 минуты: одна неудачная выкатка сжигает всё, а назавтра бюджет снова полный.' },
        { v: 'month', t: '30 дней (скользящие)', ok: 1 },
        { v: 'year', t: 'год', why: 'За год 99,9 % — почти 9 часов: можно пролежать всё воскресенье и «уложиться». Окно должно быть ближе к ритму релизов.' }
      ]
    },
    {
      id: 'pass', t: 'Проверка пропуска на турникете', sub: 'контроллер клуба спрашивает «пустить?», у него 300 мс на решение, турникет должен открыться быстрее секунды',
      sli: [
        { v: 'p99', t: 'p99 времени решения «пустить / нет»', ok: 1 },
        { v: 'avg', t: 'Среднее время решения', why: 'У турникета очередь людей: важен каждый, кто ждал. Среднее его не покажет.' },
        { v: 'online', t: 'Доля проходов, решённых онлайн через ядро', why: 'Офлайн-решение — не сбой, а запасной вариант. Клиенту всё равно, кто решил, — важно, что быстро и правильно.' },
        { v: 'cpu', t: 'Загрузка CPU контроллера', crit: 1, why: 'Причина, а не то, что чувствует человек у турникета.' }
      ],
      goal: [
        { v: 'g1', t: 'p99 ≤ 300 мс; не ответили за 300 мс — контроллер решает офлайн по локальному списку', ok: 1 },
        { v: 'g2', t: 'p99 ≤ 1 с', why: 'Контроллер ждёт ответа 300 мс, а турникет должен открыться быстрее секунды — секунда на одно решение слишком много.' },
        { v: 'g3', t: '100 % проходов — только онлайн-решение ядра', why: 'В клубах пропадает интернет. «Только онлайн» значит — люди стоят у входа.' }
      ],
      win: [
        { v: 'day', t: 'сутки', half: 1, why: 'Короткое окно: один плохой вечер — и бюджет пуст, а завтра снова полный.' },
        { v: 'month', t: '30 дней (скользящие)', ok: 1 },
        { v: 'year', t: 'год', why: 'Слишком длинное: плохой месяц растворится в хорошем годе.' }
      ]
    },
    {
      id: 'pay', t: 'Оплата абонемента', sub: 'ПэйПоинт, 3-D Secure, вебхук «оплачено»; ПэйПоинт в пик отвечает по 10+ секунд',
      sli: [
        { v: 'lost', t: 'Оплаты, которые ПэйПоинт провёл, а у нас их нет или абонемент не активирован (по сверке)', ok: 1 },
        { v: 'decl', t: 'Доля оплат, отклонённых банком', why: 'Отказ банка — не наша ошибка. SLI должен мерить то, за что отвечаем мы.' },
        { v: 'psp', t: 'Время ответа ПэйПоинта', why: 'Чужой сервис и время клиента в 3-D Secure — не наше качество. Мерить полезно, но не как SLO оплаты.' },
        { v: 'cpu', t: 'Загрузка CPU модуля «Платежи»', crit: 1, why: 'Причина, а не результат для клиента.' }
      ],
      goal: [
        { v: 'g1', t: '0 потерянных платежей', ok: 1, crit: 1 },
        { v: 'g2', t: 'не больше 0,1 % потерянных', crit: 1, why: '0,1 % — это деньги клиентов. «Потерять оплату нельзя» — здесь бюджета ошибок нет.' },
        { v: 'g3', t: '99,9 % оплат проходят успешно', crit: 1, why: 'Это про отказы, а не про потери. И отказы банка не в нашей власти.' }
      ],
      win: [
        { v: 'daily', t: 'ежедневная сверка с ПэйПоинтом', ok: 1 },
        { v: 'month', t: 'сверка раз в месяц', why: 'Месяц клиентка ходит с «ждёт оплаты» после списания денег — слишком поздно.' },
        { v: 'year', t: 'годовой аудит', why: 'Потерю найдёт налоговая, а не мы.' }
      ]
    }
  ];
  const DIMS = [{ k: 'sli', t: 'SLI · что меряем', w: 0.4 }, { k: 'goal', t: 'Цель', w: 0.4 }, { k: 'win', t: 'Окно', w: 0.2 }];
  function sliEval(ans) {
    const a = ans || {};
    const res = SOPS.map(op => {
      const sel = a[op.id] || {};
      const d = DIMS.map(D => { const o = op[D.k].find(x => x.v === sel[D.k]); return { D, o, pts: !o ? 0 : o.ok ? 1 : o.half ? 0.5 : 0 }; });
      const score = d.reduce((s, x) => s + x.pts * x.D.w, 0);
      const crit = d.some(x => x.o && x.o.crit && !x.o.ok) || (op.id === 'pay' && sel.goal !== 'g1');
      return { op, d, score, crit };
    });
    return { res, score: res.reduce((s, x) => s + x.score, 0) / SOPS.length, crit: res.some(x => x.crit) };
  }
  function sloMeans(op, sel) {
    if (op.id === 'book') {
      const t = sel.goal === 'g1' ? 99.9 : sel.goal === 'g2' ? 100 : sel.goal === 'g3' ? 99 : null;
      const w = sel.win === 'day' ? 1 : sel.win === 'month' ? 30 : sel.win === 'year' ? 365 : null;
      if (t == null || w == null) return 'Выберите цель и окно — здесь появится, сколько простоя это разрешает.';
      const m = (100 - t) / 100 * w * 1440;
      return `Это значит: можно лежать ${m ? fmtMin(m) : '0 минут'} за ${tOf(op.win, sel.win)}${t === 100 ? ' — ни одного релиза с риском' : ''}; в пик каждый двадцатый ответ может быть дольше цели.`;
    }
    if (op.id === 'pass') return sel.goal === 'g1' ? 'Это значит: 99 человек из 100 проходят за 300 мс решения; если ядро не успело — контроллер решает сам, по локальному списку пропусков.' : 'Выберите цель — здесь появится, что она значит для человека у турникета.';
    return sel.goal === 'g1' ? 'Это значит: каждый день сверяем проведённые ПэйПоинтом оплаты со своими платежами и активациями; любое расхождение — инцидент.' : 'Выберите цель — здесь появится, что она значит для денег клиентов.';
  }
  const sliTask = {
    id: 'sli-pick', title: 'SLO для записи, пропуска и оплаты',
    simple: howSlo.simple,
    lead: ui.brief({
      situation: 'Сергей: «В 20:03 мне пришло 400 алертов, и ни один не сказал, что сломалось. Начнём с другого конца: договоримся, что значит “работает” для трёх главных операций. Потом на это и повесим алерты». Антон просит записать SLO в нефункциональные требования — по каждой операции: что меряем, какая цель, за какое окно.',
      todo: [
        'Для каждой операции выберите SLI (что меряем), цель и окно.',
        'Под карточкой смотрите строку «Это значит» — в цифрах, что разрешает ваша цель.',
        'Нажмите «Проверить». Засчитывается от 80 %, без критичных ошибок: SLI не про железо, у оплаты — ноль потерь.'
      ],
      look: 'Помните о ловушках: среднее вместо перцентиля, причина вместо симптома, чужое качество вместо своего, недостижимые 100 % и слишком короткое или длинное окно. Опора — факты: «5 минут простоя переживём, час — нет», «турникет быстрее секунды, на решение 300 мс», «потерять оплату нельзя».'
    }),
    blank: () => ({ book: {}, pass: {}, pay: {} }),
    reference: () => Object.fromEntries(SOPS.map(op => [op.id, Object.fromEntries(DIMS.map(D => [D.k, op[D.k].find(o => o.ok).v]))])),
    render(el, ctx) {
      el.classList.add('ob-root');
      const a = ctx.ans; SOPS.forEach(op => { a[op.id] = a[op.id] || {}; });
      const ev = ctx.result || ctx.readonly ? sliEval(a) : null;
      const box = mount(el, 'ob-ops');
      function draw() {
        box.innerHTML = SOPS.map((op, i) => {
          const sel = a[op.id], r = ev && ev.res[i];
          return `<div class="ob-op ${r ? (r.crit ? 'bad' : r.score >= 0.99 ? 'ok' : 'warn') : ''}">
            <div><b>${esc(op.t)}</b><div class="small dim">${op.sub}</div></div>
            <div class="ob-set">${DIMS.map(D => `<div class="lbl">${D.t}</div>${ui.seg(op.id + '-' + D.k, op[D.k].map(o => ({ v: o.v, t: esc(o.t) })), sel[D.k] || '', 'accent')}`).join('')}</div>
            <div class="means">${esc(sloMeans(op, sel))}</div>
            ${r ? r.d.filter(x => x.o && !x.o.ok && x.o.why).map(x => ui.note(x.o.half ? 'warn' : 'bad', x.D.t, x.o.why)).join('') : ''}
          </div>`;
        }).join('');
        lockSegs(box, ctx.readonly);
      }
      draw();
      ui.onSeg(box, (name, v) => {
        if (ctx.readonly) return;
        const [opId, k] = name.split('-');
        a[opId][k] = v; ctx.save();
        const op = SOPS.find(o => o.id === opId);
        ctx.decide('SLO: ' + op.t, DIMS.map(D => `${D.t}: ${tOf(op[D.k], a[opId][D.k])}`).join('; '));
        TR.$$('.means', box)[SOPS.indexOf(op)].textContent = sloMeans(op, a[opId]);
      });
    },
    check(ans) {
      const e = sliEval(ans), notes = [];
      e.res.forEach(r => {
        const miss = r.d.filter(x => !x.o);
        if (miss.length) { notes.push({ ok: false, html: `«${esc(r.op.t)}»: не выбрано — ${miss.map(x => x.D.t.toLowerCase()).join(', ')}.` }); return; }
        r.d.filter(x => !x.o.ok).forEach(x => notes.push({ ok: x.o.half ? 'warn' : false, html: `«${esc(r.op.t)}» · ${esc(x.D.t)}: ${x.o.why || 'посмотрите ещё раз на факты.'}` }));
        if (r.score >= 0.99) notes.push({ ok: true, html: `«${esc(r.op.t)}»: SLO как в каноне.` });
      });
      return { ok: e.score >= 0.8 && !e.crit, score: e.score, notes, summary: `Совпадение: ${Math.round(e.score * 100)} %.`, vera: e.crit ? 'SLO — про то, что чувствует клиент, а не про то, как себя чувствует сервер. И у денег бюджета ошибок нет.' : null };
    },
    explain: `<p>Канон «Пульса» (DOMAIN-2 §6):</p>
      <ul class="checks">
        <li><b>Запись</b> — доступность 99,9 % в месяц (≈ 43 минуты простоя) и p95 ≤ 300 мс. Окно — скользящие 30 дней: короче — бюджет «дёргается», длиннее — плохой месяц растворяется.</li>
        <li><b>Пропуск</b> — p99 ≤ 300 мс; при недоступности ядра контроллер решает офлайн по локальному списку. Перцентиль выше, потому что у турникета стоит очередь: каждый медленный проход видят все за ним.</li>
        <li><b>Оплата</b> — 0 потерянных платежей, сверка с ПэйПоинтом ежедневно. Здесь бюджета ошибок нет: потерянная оплата — всегда инцидент.</li>
      </ul>
      <p>Бюджет ошибок записи — 0,1 % запросов в месяц. Сгорел — заморозка рискованных релизов. Это договор между бизнесом и ИТ, и аналитик фиксирует его в нефункциональных требованиях: SLI (как именно считаем), цель, окно, что делаем при нарушении. Алерты строятся от этих же SLI — это следующее задание.</p>`,
    report: ans => sliEval(ans).res.map(r => `- ${r.op.t}: ${DIMS.map(D => `${D.t} — ${tOf(r.op[D.k], (ans[r.op.id] || {})[D.k])}`).join('; ')} (${Math.round(r.score * 100)} %${r.crit ? ', критично' : ''})`).join('\n')
  };

  // =====================================================================
  // Практика 2. Лаборатория «400 алертов»
  // =====================================================================
  const AMODE = [{ v: 'off', t: 'выкл.' }, { v: 'ticket', t: 'в задачи' }, { v: 'page', t: 'будить' }];
  const ARULES = [
    { id: 'cpu', t: 'CPU ядра > 80 % — на каждом из 6 экземпляров', kind: 'cause', ok: ['off', 'ticket'], start: 'page',
      n: { inc: 30, norm: 54, silent: 0 }, msg: { inc: '20:00 · core-2: CPU 86 %', norm: '20:01 · core-5: CPU 84 %' } },
    { id: 'pool', t: 'Пул потоков ядра > 90 % — на каждом экземпляре, каждую минуту', kind: 'cause', ok: ['off', 'ticket'], start: 'page',
      n: { inc: 240, norm: 0, silent: 0 }, msg: { inc: '20:04 · core-1: пул потоков 300/300' } },
    { id: 'disk', t: 'Диск базы > 80 %', kind: 'cause', ok: ['ticket'], start: 'page',
      n: { inc: 9, norm: 9, silent: 9 }, msg: { inc: '20:00 · pg-master: диск 82 %', norm: '20:00 · pg-master: диск 82 %', silent: '20:00 · pg-master: диск 82 %' } },
    { id: 'e5xx', t: 'Каждый ответ 5xx — отдельный алерт', kind: 'cause', ok: ['off'], start: 'page',
      n: { inc: 96, norm: 3, silent: 0 }, msg: { inc: '20:03 · 503 POST /v1/classes/…/bookings (core-4)', norm: '20:12 · 503 GET /v1/clubs/…/classes (core-3)' } },
    { id: 'onec', t: 'Каждая ошибка вызова 1С', kind: 'cause', ok: ['off', 'ticket'], start: 'page',
      n: { inc: 25, norm: 0, silent: 0 }, msg: { inc: '20:03 · вызов 1С: timeout' } },
    { id: 'berr', t: 'Доля ошибок записи > 1 % за 5 минут', kind: 'sym', ok: ['page'], start: 'off',
      n: { inc: 1, norm: 0, silent: 0 }, msg: { inc: '20:05 · Запись на занятие: 38 % ошибок за 5 минут' } },
    { id: 'blat', t: 'p95 записи > 300 мс 5 минут подряд', kind: 'sym', ok: ['page'], start: 'off',
      n: { inc: 1, norm: 0, silent: 0 }, msg: { inc: '20:08 · Запись: p95 6,2 с при цели 300 мс' } },
    { id: 'burn', t: 'Бюджет ошибок записи сгорает быстро: за час больше 2 % месячного', kind: 'sym', ok: ['page'], start: 'off',
      n: { inc: 1, norm: 0, silent: 0 }, msg: { inc: '20:06 · Запись: за час сгорело 9 % месячного бюджета ошибок' } },
    { id: 'rate', t: 'Записей в минуту вдвое меньше, чем в прошлое воскресенье в это время', kind: 'sym', ok: ['page'], start: 'off',
      n: { inc: 1, norm: 0, silent: 1 }, msg: { inc: '20:05 · Записей в минуту: 310 вместо 2 400 неделю назад', silent: '20:04 · Записей в минуту: 90 вместо 2 400 неделю назад; ошибок нет' } }
  ];
  const ASC = [
    { v: 'inc', t: 'Вс 20:03 — зависла 1С', k: 'авария 4: запись лежит 40 минут' },
    { v: 'norm', t: 'Вс 20:00 — обычный пик', k: 'всё работает, нагрузка высокая' },
    { v: 'silent', t: 'Вс 20:00 — тихий сбой', k: 'после релиза кнопка «Записаться» молчит' }
  ];
  const ACRIT = [
    { id: 'caught', t: 'Авария поймана за 5 минут', s: 'в 20:03 зависла 1С — звонок дежурному не позже 20:08' },
    { id: 'clear', t: 'Первый же звонок говорит, что чувствует клиент', s: 'не «CPU», а «запись: 38 % ошибок»' },
    { id: 'quietInc', t: 'В аварию — не больше 5 звонков', s: 'а не 400' },
    { id: 'quietNorm', t: 'В обычный пик — ни одного звонка', s: 'высокая нагрузка — это не авария' },
    { id: 'silent', t: 'Тихий сбой пойман', s: 'ошибок нет, задержки нет — а записей нет' },
    { id: 'disk', t: 'Медленные проблемы не теряются', s: 'диск 82 % — задача команде, а не звонок ночью и не тишина' }
  ];
  const sigA = a => ARULES.map(r => a.m[r.id] || 'off').join('');
  function alertSim(a, sc) {
    const m = id => (a.m || {})[id] || 'off';
    const pages = [], tickets = [];
    ARULES.forEach(r => { const n = r.n[sc]; if (!n) return; if (m(r.id) === 'page') pages.push({ r, n, msg: r.msg[sc] }); else if (m(r.id) === 'ticket') tickets.push({ r, msg: r.msg[sc] }); });
    pages.sort((x, y) => x.msg.localeCompare(y.msg));
    const total = pages.reduce((s, p) => s + p.n, 0);
    return { pages, tickets, total, sym: pages.some(p => p.r.kind === 'sym'), firstSym: pages.find(p => p.r.kind === 'sym') };
  }
  function alertCrit(a) {
    const inc = alertSim(a, 'inc'), norm = alertSim(a, 'norm'), sil = alertSim(a, 'silent');
    const early = inc.pages.some(p => p.msg.slice(0, 5) <= '20:08');
    return {
      caught: early, clear: inc.sym, quietInc: inc.total > 0 && inc.total <= 5, quietNorm: norm.total === 0, silent: sil.sym, disk: (a.m || {}).disk === 'ticket',
      inc, norm, sil
    };
  }
  const ALAB_Q = {
    q: 'Почему алерт «CPU ядра > 80 %» не должен будить дежурного?', seed: 'ob-alab-q',
    options: [
      { t: 'Это причина, а не симптом: в воскресный пик 80–85 % — норма, а в аварию 4 процессор отдыхал — потоки ждали 1С. Будят по тому, что чувствует клиент', ok: 1, why: 'Верно. CPU полезен на графике при расследовании, но как повод будить — и шумит в норме, и молчит в аварию.' },
      { t: 'CPU вообще не нужно измерять', why: 'Нужно: на графиках и для планирования мощности. Не нужно только будить из-за него.' },
      { t: 'Потому что Сергей и так всё время смотрит на графики', why: 'Дежурный спит и ест. Алерты нужны как раз затем, чтобы не смотреть на графики всё время.' },
      { t: 'Потому что 80 % — слишком низкий порог, надо 95 %', why: 'Порог не спасёт: в аварию 4 процессор был почти свободен — алерт молчал бы при любом пороге.' }
    ]
  };
  const alertTask = {
    id: 'alert-lab', title: 'Лаборатория: 400 алертов',
    simple: howSlo.simple,
    lead: ui.brief({
      situation: 'Набор правил Сергея на сегодня: пять правил про причины — CPU, пул потоков, диск, каждый 5xx, каждая ошибка 1С, — и все будят. В прошлое воскресенье в 20:03 зависла 1С: за 40 минут пришло 400 звонков, а «запись не работает» Сергей понял из чата поддержки. Есть и четыре новых правила-симптома — пока выключены.',
      todo: [
        'Прогоните три сценария с текущими правилами: авария, обычный пик, тихий сбой. Посмотрите на ленту пейджера и шесть проверок.',
        'Для каждого правила выберите: выключить, отправлять в задачи (днём, без звонка) или будить дежурного.',
        'Прогоните все три сценария с новым набором. Засчитывается, когда все шесть проверок зелёные и ответ на вопрос внизу верный.'
      ],
      look: '<p>Карточки сверху — сколько звонков получит дежурный в каждом сценарии и поймана ли беда. Лента — что пришло на пейджер, по времени: зелёные строки — симптомы (что чувствует клиент), серые — причины.</p><p>Шесть проверок: авария поймана за 5 минут; первый звонок про клиента; в аварию не больше 5 звонков; в обычный пик — ноль; тихий сбой пойман; диск не потерян.</p>'
    }),
    blank: () => ({ m: Object.fromEntries(ARULES.map(r => [r.id, r.start])), sc: 'inc', seen: [], q: [] }),
    reference: () => {
      const m = { cpu: 'off', pool: 'ticket', disk: 'ticket', e5xx: 'off', onec: 'off', berr: 'page', blat: 'page', burn: 'page', rate: 'page' };
      const s = ARULES.map(r => m[r.id]).join('');
      return { m, sc: 'inc', seen: ASC.map(x => s + '|' + x.v), q: quizRef([ALAB_Q])[0] };
    },
    render(el, ctx) {
      el.classList.add('ob-root');
      const a = ctx.ans; a.m = a.m || {}; a.seen = a.seen || []; a.q = a.q || [];
      ARULES.forEach(r => { if (!a.m[r.id]) a.m[r.id] = 'off'; });
      const mark = () => { const k = sigA(a) + '|' + a.sc; if (!ctx.readonly && !a.seen.includes(k)) { a.seen.push(k); ctx.save(); } };
      mark();
      el.insertAdjacentHTML('beforeend', ui.say('sergey', 'Мне не нужно больше алертов. Мне нужен один звонок, после которого я знаю, что сломалось для клиентов.'));
      const box = mount(el, 'stack'); box.style.marginTop = '12px';
      box.innerHTML = `
        <div class="stack tight"><div class="eyebrow">Сценарий</div>${ui.seg('sc', ASC.map(s => ({ v: s.v, t: `${s.t} <span class="small dim">· ${s.k}</span>` })), a.sc)}</div>
        <div class="ob-sc" data-obcards></div>
        <div class="eyebrow">Пейджер Сергея</div>
        <div data-obfeed></div>
        <ul class="ob-crit" data-obcrit></ul>
        <div class="eyebrow" style="margin-top:6px">Правила алертов</div>
        <div class="ob-rules" data-obrules></div>
        <div class="card flat" data-obq></div>`;
      function draw() {
        const c = alertCrit(a), sig = sigA(a), cur = alertSim(a, a.sc);
        TR.$('[data-obcards]', box).innerHTML = ASC.map(s => {
          const seen = a.seen.includes(sig + '|' + s.v), r = alertSim(a, s.v);
          const good = s.v === 'inc' ? c.caught && c.clear && c.quietInc : s.v === 'norm' ? c.quietNorm : c.silent;
          return `<div class="stat ${s.v === a.sc ? 'cur' : ''}"><span class="k">${esc(s.t)}</span><span class="v ${seen ? (good ? 'ok' : 'bad') : ''}">${seen ? `${r.total} ${TR.plural(r.total, 'звонок', 'звонка', 'звонков')}` : '—'}</span><span class="s small dim">${!seen ? 'не прогнан с этим набором' : s.v === 'norm' ? (r.total ? 'будим зря' : 'тихо — и правильно') : r.sym ? 'беда поймана, понятно что' : r.total ? 'звонят, но не про клиента' : 'беду пропустили'}</span></div>`;
        }).join('');
        const shown = cur.pages.slice(0, 7);
        const more = cur.total - shown.reduce((s, p) => s + 1, 0);
        TR.$('[data-obfeed]', box).innerHTML = cur.total ? `<div class="ob-feed">${shown.map(p => `<div class="${p.r.kind}">${p.r.kind === 'sym' ? '● ' : '○ '}${esc(p.msg)}${p.n > 1 ? ` · ×${p.n}` : ''}</div>`).join('')}${more > 0 ? `<div class="more">…всего ${cur.total} ${TR.plural(cur.total, 'звонок', 'звонка', 'звонков')} за 45 минут</div>` : ''}</div>${cur.tickets.length ? `<div class="small dim" style="margin-top:4px">В задачи (без звонка): ${cur.tickets.map(t => esc(t.r.t)).join('; ')}</div>` : ''}`
          : `<div class="ob-feed"><div class="cause">Тишина — ни одного звонка.</div></div>${cur.tickets.length ? `<div class="small dim" style="margin-top:4px">В задачи (без звонка): ${cur.tickets.map(t => esc(t.r.t)).join('; ')}</div>` : ''}`;
        const why = {
          caught: c.caught ? 'Первый звонок — в первые минуты аварии.' : 'Никто не позвонил вовремя: о беде узнают из чата поддержки.',
          clear: c.clear ? `Звонок говорит про клиента: «${esc(c.inc.firstSym.msg.slice(8))}».` : 'Звонки есть, но все про железо: что с записью — непонятно.',
          quietInc: c.quietInc ? `${c.inc.total} ${TR.plural(c.inc.total, 'звонок', 'звонка', 'звонков')} — можно прочитать и действовать.` : c.inc.total ? `${c.inc.total} звонков: важное тонет в шуме. Какие правила звонят на каждом экземпляре и каждую минуту?` : 'В аварию — ни одного звонка.',
          quietNorm: c.quietNorm ? 'Пик без аварии — дежурный спокойно ужинает.' : `${c.norm.total} звонков в нормальный вечер. Через месяц такие алерты перестают читать.`,
          silent: c.silent ? 'Записей стало меньше — это видно даже без ошибок.' : 'Ошибок нет, задержка нормальная — и ни одно правило не заметило, что никто не записывается.',
          disk: c.disk ? 'Диск растёт медленно — задача команде на завтра.' : (a.m.disk === 'page' ? 'Диск 82 % будит каждые 5 минут в любой вечер.' : 'Диск выключен совсем: через месяц он кончится — и это будет авария.')
        };
        TR.$('[data-obcrit]', box).innerHTML = ACRIT.map(x => `<li class="${c[x.id] ? 'ok' : 'bad'}"><b>${c[x.id] ? '✓' : '✗'}</b><div><b>${esc(x.t)}</b><small>${why[x.id]}</small></div></li>`).join('');
      }
      function drawRules() {
        const show = ctx.result || ctx.readonly;
        TR.$('[data-obrules]', box).innerHTML = ARULES.map(r => {
          const cls = show ? (r.ok.includes(a.m[r.id]) ? 'ok' : 'bad') : '';
          return `<div class="ob-rule ${cls}"><div><b>${esc(r.t)}</b><small>${r.kind === 'sym' ? 'симптом' : 'причина'}${show ? ' · лучше: ' + r.ok.map(v => tOf(AMODE, v)).join(' или ') : ''}</small></div>${ui.seg('r-' + r.id, AMODE, a.m[r.id], 'accent')}</div>`;
        }).join('');
        lockSegs(TR.$('[data-obrules]', box), ctx.readonly);
      }
      drawRules(); draw();
      ui.quiz(TR.$('[data-obq]', box), Object.assign({}, ALAB_Q, { value: a.q, readonly: ctx.readonly, reveal: ctx.result, onChange: v => { a.q = v; ctx.save(); } }));
      ui.onSeg(box, (name, v) => {
        if (name === 'sc') { a.sc = v; mark(); if (!ctx.readonly) ctx.save(); draw(); return; }
        if (ctx.readonly || !/^r-/.test(name)) return;
        a.m[name.slice(2)] = v; mark(); ctx.save();
        ctx.decide('Правила алертов', ARULES.map(r => `${r.t}: ${tOf(AMODE, a.m[r.id])}`).join('; '));
        draw();
      });
    },
    check(ans) {
      const c = alertCrit(ans), sig = sigA(ans), seen = ans.seen || [];
      const seenAll = ASC.every(s => seen.includes(sig + '|' + s.v)), passed = ACRIT.filter(x => c[x.id]).length;
      const q = ui.quizScore(ALAB_Q, ans.q || []), notes = [];
      const hint = {
        caught: 'Аварию никто не заметил вовремя. Какое правило сработает, как только запись начнёт отвечать ошибками?',
        clear: 'Звонят только причины. Какое правило скажет дежурному, что плохо именно клиентам?',
        quietInc: 'В аварию слишком много звонков. Какие правила срабатывают на каждом экземпляре и на каждую ошибку?',
        quietNorm: 'В обычный пик кто-то звонит. Какое правило путает высокую нагрузку с аварией — и что ещё звонит каждые 5 минут?',
        silent: 'Тихий сбой пропущен: ошибок нет, задержки нет. Какой сигнал покажет, что люди перестали записываться?',
        disk: 'Диск: будить ночью не надо, но и забыть нельзя. Куда отправить такой сигнал?'
      };
      ACRIT.forEach(x => { if (!c[x.id]) notes.push({ ok: false, html: `${esc(x.t)} — нет. ${hint[x.id]}` }); });
      if (passed === ACRIT.length) notes.push({ ok: true, html: 'Все шесть проверок зелёные.' });
      if (!seenAll) notes.push({ ok: 'warn', html: `С этим набором правил прогнаны не все сценарии: ${ASC.filter(s => !seen.includes(sig + '|' + s.v)).map(s => '«' + esc(s.t) + '»').join(', ')}.` });
      notes.push(q.ok ? { ok: true, html: 'Вопрос: верно — CPU это причина, а не симптом.' } : { ok: false, html: 'Вопрос: вспомните, что было с процессором в аварию 4 и в обычный пик.' });
      const score = passed / ACRIT.length * 0.6 + (seenAll ? 0.1 : 0) + q.score * 0.3;
      return { ok: passed === ACRIT.length && seenAll && q.ok, score, notes, summary: `Проверок пройдено: ${passed} из ${ACRIT.length}; звонков в аварию: ${c.inc.total}, в обычный пик: ${c.norm.total}.`, vera: passed < 4 ? 'Начните с вопроса «что чувствует клиент, когда запись сломана?» — ошибки, задержка, записей стало меньше. Это и будит. Всё про железо — на графики и в задачи.' : null };
    },
    explain: `<p>Рабочий набор Сергея:</p>
      <ul class="checks">
        <li><b>Будят четыре симптома записи:</b> доля ошибок > 1 % за 5 минут, p95 > 300 мс 5 минут, быстрое сгорание бюджета ошибок и «записей вдвое меньше, чем неделю назад». В аварию 4 придут 4 звонка за 3–5 минут, и первый же скажет: «запись — 38 % ошибок».</li>
        <li><b>Бизнес-метрика ловит тихий сбой.</b> Кнопка в приложении молчит: ошибок нет, задержка нормальная — заметить можно только по тому, что люди перестали записываться. Эту метрику аналитик описывает в требованиях: что считаем, с чем сравниваем, какой порог.</li>
        <li><b>Причины — в дашборд и задачи.</b> CPU шумит в норме и молчит в аварию. Пул потоков полезен при расследовании, но звонить шестью экземплярами каждую минуту — 240 звонков. Каждый 5xx отдельно — это не алерт, а лог. Диск 82 % — задача на завтра, но не тишина.</li>
      </ul>
      <p>Каждый звонок должен вести к инструкции (runbook): «запись — ошибки: проверь зависимости ядра, рубильники деградации, последнюю выкатку». Тексты алертов и пороги бизнес-метрик — общая работа аналитика и SRE.</p>`,
    report: ans => {
      const c = alertCrit(ans);
      return ARULES.map(r => `- ${r.t}: ${tOf(AMODE, (ans.m || {})[r.id])}`).join('\n') + `\nЗвонков: авария ${c.inc.total}, обычный пик ${c.norm.total}, тихий сбой ${c.sil.total}. Проверок: ${ACRIT.filter(x => c[x.id]).length}/${ACRIT.length}. Вопрос про CPU: ${ui.quizScore(ALAB_Q, ans.q || []).ok ? 'верно' : 'неверно'}.`;
    }
  };

  // =====================================================================
  // Практика 3. Расследование по трассировке: «оплатила, а абонемент не активировался»
  // =====================================================================
  const MTID = '5c9e1a7b3f20d846';
  const MT = 760000;
  const tsOf = t0 => { const sec = 2 + Math.floor(t0 / 1000); return '21:' + String(14 + Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0'); };
  const pos = t => Math.log10(1 + t / 50) / Math.log10(1 + MT / 50) * 100;
  const SPANS = [
    { id: 'a1', d: 0, svc: 'app-android', n: 'Купить «Сеть 12 мес» и перейти к оплате', t0: 0, dur: 2400, st: 'ok', attrs: { 'app.version': '5.12.0', 'screen': 'Покупка абонемента' }, log: { level: 'INFO', svc: 'app-android', msg: 'purchase started', planId: 'net-12m' } },
    { id: 'g1', d: 1, svc: 'api-gateway', n: 'POST /v1/memberships', t0: 30, dur: 180, st: 'ok', attrs: { 'http.status': 201, 'idempotency.key': 'e3c1…' }, log: { level: 'INFO', svc: 'api-gateway', route: 'POST /v1/memberships', status: 201, durationMs: 180 } },
    { id: 's1', d: 2, svc: 'core · Продажи', n: 'Сага покупки: абонемент «ждёт оплаты»', t0: 50, dur: 90, st: 'ok', attrs: { 'saga.id': 'sp-20441', 'membership.status': 'pending_payment', 'membership.startsOn': '2026-10-11' }, log: { level: 'INFO', svc: 'core', module: 'sales', msg: 'saga started', sagaId: 'sp-20441', membershipId: 'm-58…', startsOn: '2026-10-11' } },
    { id: 'b1', d: 2, svc: 'bonus', n: 'Зарезервировать 3 200 бонусов', t0: 150, dur: 45, st: 'ok', attrs: { 'bonus.reserved': 3200 }, log: { level: 'INFO', svc: 'bonus', msg: 'reserve created', amount: 3200 } },
    { id: 'g2', d: 1, svc: 'api-gateway', n: 'POST /v1/memberships/{id}/payments', t0: 260, dur: 2050, st: 'ok', attrs: { 'http.status': 201, 'payment.amount': '50 800 ₽' }, log: { level: 'INFO', svc: 'api-gateway', route: 'POST /v1/memberships/{membershipId}/payments', status: 201, durationMs: 2050 } },
    { id: 'p1', d: 2, svc: 'core · Платежи', n: 'Создать платёж в ПэйПоинте', t0: 280, dur: 1980, st: 'ok', attrs: { 'psp': 'ПэйПоинт', 'psp.latency': '1,98 с', 'Idempotence-Key': 'e3c1…' }, log: { level: 'INFO', svc: 'core', module: 'payments', msg: 'psp payment created', durationMs: 1980 } },
    { id: 'x1', d: 0, svc: 'ПэйПоинт', n: '3-D Secure: клиентка вводит код из SMS банка', t0: 2400, dur: 41200, st: 'info', attrs: { '3ds': 'challenge', 'result': 'authenticated' }, log: { level: 'INFO', svc: 'core', module: 'payments', msg: '3ds completed', durationMs: 41200 } },
    { id: 'w1', d: 0, svc: 'core · Платежи', n: 'Вебхук ПэйПоинта: «оплачено», подпись верна', t0: 43650, dur: 40, st: 'ok', attrs: { 'http.status': 200, 'hmac': 'ok', 'psp.event.id': 'evt_9a1…' }, log: { level: 'INFO', svc: 'core', module: 'payments', msg: 'webhook accepted', status: 'succeeded' } },
    { id: 'o1', d: 1, svc: 'core · Платежи', n: 'payment = succeeded + строка outbox', t0: 43660, dur: 15, st: 'ok', attrs: { 'payment.status': 'succeeded', 'outbox.event': 'PaymentSucceeded' }, log: { level: 'INFO', svc: 'core', module: 'payments', msg: 'payment succeeded', paymentId: 'p-31…' } },
    { id: 'r1', d: 1, svc: 'outbox-relay', n: 'PaymentSucceeded → puls.payment.events.v1', t0: 44100, dur: 8, st: 'ok', attrs: { 'messaging.destination': 'puls.payment.events.v1', 'partition': 3, 'eventId': '7d20…', 'consumers': 'memberships, onec-export, analytics' }, log: { level: 'INFO', svc: 'outbox-relay', topic: 'puls.payment.events.v1', eventId: '7d20…', partition: 3 } },
    { id: 'm1', d: 2, svc: 'core · Продажи (memberships)', n: 'Активировать абонемент', t0: 44200, dur: 60, st: 'err', attrs: { 'consumer.group': 'memberships', 'eventId': '7d20…', 'http.status': 422, 'error.type': 'membership_overlap' }, log: { level: 'ERROR', svc: 'core', module: 'sales', consumer: 'memberships', eventId: '7d20…', error: 'membership_overlap', detail: 'active membership until 2026-11-14; requested startsOn 2026-10-11' } },
    { id: 'm2', d: 3, svc: 'memberships · retry.1m', n: 'Повтор через 1 минуту', t0: 104200, dur: 55, st: 'err', attrs: { 'retry.topic': 'puls.payment.events.v1.retry.1m', 'error.type': 'membership_overlap' }, log: { level: 'ERROR', svc: 'core', consumer: 'memberships', attempt: 2, error: 'membership_overlap' } },
    { id: 'm3', d: 3, svc: 'memberships · retry.10m', n: 'Повтор через 10 минут → DLQ', t0: 704300, dur: 50, st: 'err', attrs: { 'retry.topic': 'puls.payment.events.v1.retry.10m', 'dlq': 'puls.payment.events.v1.dlq', 'alert': 'нет' }, log: { level: 'ERROR', svc: 'core', consumer: 'memberships', attempt: 3, error: 'membership_overlap', msg: 'sent to DLQ' } },
    { id: 'k1', d: 2, svc: 'analytics', n: 'Модель чтения: выручка +50 800 ₽', t0: 45200, dur: 30, st: 'ok', attrs: { 'consumer.group': 'analytics' }, log: { level: 'INFO', svc: 'analytics', consumer: 'analytics', msg: 'revenue updated' } },
    { id: 'k2', d: 2, svc: 'onec-export', n: 'Выгрузка в 1С: отложена до 9:00', t0: 45300, dur: 5, st: 'warn', attrs: { 'consumer.group': 'onec-export', '1c.window': 'будни 9–19', 'status': 'отложено по расписанию' }, log: { level: 'INFO', svc: 'onec-export', msg: 'deferred until 09:00 (1C window 9-19)' } }
  ];
  const GHOST = [{ n: '«Бонусы»: подтвердить списание 3 200', svc: 'bonus' }, { n: '«Уведомления»: пуш «Абонемент активен»', svc: 'notifications' }];
  const TH_Q1 = {
    q: 'Почему абонемент Марии не активировался?', seed: 'ob-th-q1',
    options: [
      { t: 'Активацию отклонило правило «два действующих абонемента одновременно нельзя»: у Марии абонемент до 14.11, а новый пытались начать сегодня. Повторы не помогли — событие ушло в DLQ, и никто не узнал', ok: 1, why: 'Верно. Ошибка «по делу» (422) повторами не лечится. Её нужно было поймать до оплаты и заметить в DLQ.' },
      { t: 'ПэйПоинт думал 41 секунду — слишком долго', why: 'Долго — но это клиентка вводила код из SMS банка, и шаг закончился успешно. Медленно ≠ сломано.' },
      { t: '1С не приняла документ', why: 'Выгрузка отложена до 9:00 — так и задумано: окно 1С 9–19. К активации это не относится.' },
      { t: '«Бонусы» не подтвердили списание', why: 'Подтверждение должно было прийти после активации — его нет, потому что активации нет. Это следствие, а не причина.' }
    ]
  };
  const TH_Q2 = {
    q: 'Что записать в требования, чтобы узнать о таком раньше Марии и не допустить снова?', multi: true, seed: 'ob-th-q2',
    options: [
      { t: 'Алерт дежурному: в DLQ потребителя memberships появилось сообщение', ok: 1, why: 'Да: событие об оплате в DLQ — это деньги клиента без услуги.' },
      { t: 'Бизнес-метрика и алерт: «оплачено, но абонемент не активирован дольше 5 минут» больше нуля', ok: 1, why: 'Да: симптом для клиента в бизнес-терминах — сработает при любой причине.' },
      { t: 'Проверять пересечение абонементов до оплаты: ошибка при покупке, а не после списания денег', ok: 1, why: 'Да: правило из факта «два действующих нельзя — новый начнётся после текущего» должно работать на входе.' },
      { t: 'Писать в лог номер карты и телефон клиентки, чтобы быстрее её искать', why: 'Нельзя: ПДн и платёжные данные в логи не пишут. Искать — по clientId и traceId.' },
      { t: 'Будить дежурного на каждый ответ 4xx', why: '4xx — обычная жизнь (неверный код, нет мест). Это 400 алертов, только других.' }
    ]
  };
  const traceTask = {
    id: 'trace-hunt', title: 'Расследование: оплатила, а абонемент не активировался',
    simple: howSignals.simple,
    lead: ui.brief({
      situation: `Понедельник. В поддержку пишет Мария: «Вчера в 21:14 купила “Сеть 12 мес”: 3 200 бонусами и 50 800 ₽ картой. Деньги списаны, а абонемент в приложении “ждёт оплаты”». Её текущий абонемент действует до 14 ноября — новый она купила заранее. Сергей по номеру платежа нашёл трассу <code>${MTID}</code>. Алертов ночью не было.`,
      todo: [
        'Нажимайте на шаги трассы (спаны) — справа или ниже откроются атрибуты и строка лога с тем же traceId.',
        'Найдите шаг, где цепочка оборвалась, и нажмите в его карточке «Здесь оборвалось».',
        'Ответьте на два вопроса внизу и нажмите «Проверить».'
      ],
      look: '<p>Каждая строка — спан: сервис, что делал, полоса — когда и сколько длился (шкала логарифмическая: первые секунды крупно, минуты — мельче). Зелёный — успешно, синий — ждали человека, жёлтый — отложено, красный — ошибка. Пунктиром внизу — шаги, которые должны были быть по саге, но в трассе их нет.</p>'
    }),
    blank: () => ({ open: [], span: '', q1: [], q2: [] }),
    reference: () => ({ open: ['x1', 'r1', 'm1'], span: 'm1', q1: quizRef([TH_Q1])[0], q2: quizRef([TH_Q2])[0] }),
    render(el, ctx) {
      el.classList.add('ob-root');
      const a = ctx.ans; a.open = a.open || []; a.q1 = a.q1 || []; a.q2 = a.q2 || [];
      let cur = a.span || (ctx.readonly ? 'm1' : '');
      el.innerHTML = `<div class="stack">
        <div class="small dim">Трасса <code>${MTID}</code> · 15 спанов · от нажатия «Купить» до DLQ — 11 минут 45 секунд</div>
        <div class="ob-wf" data-obwf></div>
        <div data-obdet></div>
        <div class="card flat" data-obq1></div>
        <div class="card flat" data-obq2></div>
      </div>`;
      function draw() {
        TR.$('[data-obwf]', el).innerHTML = SPANS.map(s => {
          const l = pos(s.t0), w = Math.max(0.8, pos(s.t0 + s.dur) - l);
          return `<button type="button" class="ob-span ${cur === s.id ? 'sel' : ''}" data-obsp="${s.id}"><span class="nm" style="padding-left:${s.d * 12}px">${esc(s.n)}<small>${esc(s.svc)}${a.span === s.id ? ' · ✎ здесь оборвалось' : ''}</small></span><span class="tr"><i class="${s.st === 'ok' ? '' : s.st}" style="left:${l}%;width:${w}%"></i></span><span class="ms ${s.st === 'err' ? 'err' : ''}">${fmtMs(s.dur)}</span></button>`;
        }).join('') + GHOST.map(g => `<div class="ob-span ghost"><span class="nm" style="padding-left:24px">${esc(g.n)}<small>${esc(g.svc)} · спана нет</small></span><span class="tr"></span><span class="ms">—</span></div>`).join('') +
          `<div class="ob-span" style="cursor:default;border:0;background:none"><span class="nm small dim">шкала времени</span><span class="tr" style="background:none">${[[0, '0'], [2000, '2 с'], [40000, '40 с'], [120000, '2 мин'], [MT, '12 мин']].map(([ms, t]) => `<em style="left:${pos(ms)}%">${t}</em>`).join('')}</span><span></span></div>`;
        const s = SPANS.find(x => x.id === cur);
        TR.$('[data-obdet]', el).innerHTML = !s ? '<p class="small muted">Нажмите на любой спан, чтобы открыть его карточку.</p>'
          : `<div class="ob-det"><div class="row between" style="flex-wrap:wrap;gap:8px"><b>${esc(s.n)}</b><span class="chip ${s.st === 'err' ? 'bad' : s.st === 'warn' ? 'warn' : s.st === 'info' ? 'info' : 'ok'}">${s.st === 'err' ? 'ошибка' : s.st === 'warn' ? 'отложено' : s.st === 'info' ? 'ждали человека' : 'успешно'}</span></div>
            <div class="ob-kv"><span>service</span><span>${esc(s.svc)}</span><span>start</span><span>+${fmtMs(s.t0)}</span><span>duration</span><span>${fmtMs(s.dur)}</span>${Object.entries(s.attrs).map(([k, v]) => `<span>${esc(k)}</span><span>${esc(v)}</span>`).join('')}</div>
            <div class="ob-log"><div class="${s.st === 'err' ? 'err' : 'hl'}">${logHTML(Object.assign({ ts: tsOf(s.t0) }, s.log, { traceId: MTID }))}</div></div>
            ${ctx.readonly ? '' : `<div class="row"><button type="button" class="btn sm ${a.span === s.id ? 'primary' : ''}" data-obhere="${s.id}">${a.span === s.id ? '✓ Отмечено: здесь оборвалось' : 'Здесь оборвалось'}</button></div>`}</div>`;
      }
      draw();
      TR.on(el, 'click', '[data-obsp]', (e, b) => { cur = b.dataset.obsp; if (!ctx.readonly && !a.open.includes(cur)) { a.open.push(cur); ctx.save(); } draw(); });
      TR.on(el, 'click', '[data-obhere]', (e, b) => {
        if (ctx.readonly) return;
        a.span = b.dataset.obhere; ctx.save();
        const s = SPANS.find(x => x.id === a.span);
        ctx.decide('Где оборвалась покупка Марии', `${s.svc}: ${s.n}`);
        draw();
      });
      ui.quiz(TR.$('[data-obq1]', el), Object.assign({}, TH_Q1, { value: a.q1, readonly: ctx.readonly, reveal: ctx.result, onChange: v => { a.q1 = v; ctx.save(); } }));
      ui.quiz(TR.$('[data-obq2]', el), Object.assign({}, TH_Q2, { value: a.q2, readonly: ctx.readonly, reveal: ctx.result, onChange: v => { a.q2 = v; ctx.save(); } }));
    },
    check(ans) {
      const sp = ans.span, q1 = ui.quizScore(TH_Q1, ans.q1 || []), q2 = ui.quizScore(TH_Q2, ans.q2 || []), notes = [];
      const spPts = sp === 'm1' ? 1 : (sp === 'm2' || sp === 'm3') ? 0.5 : 0;
      if (sp === 'm1') notes.push({ ok: true, html: 'Шаг найден: активация абонемента у потребителя memberships — первая ошибка в цепочке.' });
      else if (spPts) notes.push({ ok: 'warn', html: 'Это повтор, а не первый отказ. Где цепочка сломалась впервые?' });
      else if (sp === 'x1') notes.push({ ok: false, html: 'Самый длинный спан — не значит сломанный: чем он закончился? Посмотрите на статус.' });
      else if (sp === 'k2') notes.push({ ok: false, html: 'Выгрузку в 1С отложили по расписанию — это норма. А что с абонементом?' });
      else if (sp) notes.push({ ok: false, html: 'Этот шаг закончился успешно. Ищите первую красную полосу после того, как событие ушло в Kafka.' });
      else notes.push({ ok: false, html: 'Отметьте спан, где оборвалась цепочка: откройте его карточку и нажмите «Здесь оборвалось».' });
      notes.push(q1.ok ? { ok: true, html: 'Причина найдена: правило пересечения абонементов, ошибка ушла в DLQ без алерта.' } : { ok: false, html: 'Причина: прочитайте атрибуты и строку лога красного спана — что именно ответило «Продажи»?' });
      notes.push(q2.score >= 0.66 ? { ok: true, html: 'Меры выбраны.' } : { ok: false, html: 'Меры: что сработает при любой причине такой беды — и что поймает именно эту ошибку до оплаты? Чего в логах быть не должно?' });
      const score = spPts * 0.4 + q1.score * 0.3 + q2.score * 0.3;
      return { ok: sp === 'm1' && q1.ok && q2.score >= 0.66, score, notes, summary: `Шаг: ${sp ? SPANS.find(x => x.id === sp).n : '—'}.`, vera: sp !== 'm1' ? 'Идите по трассе от денег: оплата прошла (вебхук), событие ушло (relay). Кто из потребителей события ответил не так, как остальные?' : null };
    },
    explain: `<p>Цепочка оборвалась на потребителе <code>memberships</code>: «Продажи» получили <code>PaymentSucceeded</code> и попытались активировать абонемент с датой начала «сегодня». Правило «два действующих абонемента одновременно нельзя» ответило 422 <code>membership_overlap</code>. Ретрай-топики через 1 и 10 минут дали тот же ответ (ошибка «по делу» не лечится повтором), событие ушло в <code>puls.payment.events.v1.dlq</code> — а алерта на DLQ не было. Подтверждение бонусов и пуш не случились — это следствия.</p>
      <ul class="checks">
        <li><b>Ложные следы:</b> 41 секунда в 3-D Secure — время клиентки, шаг успешен; выгрузка в 1С отложена по расписанию.</li>
        <li><b>Что чинить:</b> проверять пересечение до оплаты (новый абонемент начинается после текущего — факт про покупку заранее); алерт на DLQ; бизнес-метрика «оплачено, но не активировано дольше 5 минут»; компенсация саги — вернуть деньги или активировать с правильной даты по решению поддержки.</li>
        <li><b>Почему трасса дошла до конца:</b> <code>traceId</code> лежит в конверте события и в строке outbox — поэтому видно и Kafka, и потребителей. Без этого трасса кончилась бы на вебхуке.</li>
      </ul>
      <p>Позиция аналитика: в ФТ на покупку — сценарий ошибки «пересечение абонементов» до оплаты, бизнес-метрика и алерт, что видит поддержка по номеру платежа.</p>`,
    report: ans => {
      const s = SPANS.find(x => x.id === ans.span);
      return `Отмечен шаг: ${s ? s.svc + ' — ' + s.n : '—'}.\nОткрыто спанов: ${(ans.open || []).length}.\nПричина: ${ui.quizScore(TH_Q1, ans.q1 || []).ok ? 'верно' : 'неверно'}; меры: ${(ans.q2 || []).map(i => plainT(TH_Q2.options[i].t)).join('; ') || '—'}.`;
    }
  };

  // =====================================================================
  // Практика 4. Требования к наблюдаемости в ФТ
  // =====================================================================
  const OR_RUBRIC = [
    'SLO по сценариям в цифрах: запись 99,9 % в месяц и p95 ≤ 300 мс; пропуск p99 ≤ 300 мс с офлайн-решением; оплата — 0 потерянных, сверка ежедневно',
    'Поля структурированного лога: время, сервис, traceId, eventId, ключи сущностей (bookingId, paymentId, membershipId, clientId), шаг, результат, код ошибки, длительность',
    'Корреляция: traceId передаётся из приложения через шлюз (traceparent), ядро, строку outbox и конверт события Kafka к потребителям',
    'Бизнес-метрики: записей в минуту против прошлой недели, «оплачено, но не активировано дольше 5 минут», сообщения в DLQ, отставание модели чтения',
    'Алерты на симптомы и сгорание бюджета, кто получает, текст алерта и ссылка на инструкцию; причины — в дашборды и задачи',
    'ПДн и платёжные данные в логи не пишем (телефон, ФИО, номер карты, QR-токен) — только clientId; срок хранения логов'
  ];
  const OR_REF = `<p><b>Наблюдаемость: покупка абонемента и запись на занятие</b></p>
    <ol>
      <li><b>SLO.</b> Запись: 99,9 % успешных ответов за 30 дней, p95 ≤ 300 мс (в т. ч. воскресенье 20:00). Пропуск: p99 решения ≤ 300 мс, иначе офлайн по локальному списку. Оплата: 0 потерянных платежей, сверка с ПэйПоинтом ежедневно.</li>
      <li><b>Логи</b> — JSON: <code>ts</code>, <code>level</code>, <code>svc</code>, <code>traceId</code>, <code>eventId</code>, <code>bookingId</code>/<code>paymentId</code>/<code>membershipId</code>, <code>clientId</code>, шаг, результат, код ошибки, <code>durationMs</code>.</li>
      <li><b>Корреляция.</b> Приложение создаёт <code>traceparent</code>; шлюз и ядро передают его; <code>traceId</code> пишется в строку outbox и в конверт события; потребители продолжают трассу.</li>
      <li><b>Бизнес-метрики:</b> записей в минуту против того же времени неделю назад; «оплачено, но абонемент не активирован дольше 5 минут»; сообщения в DLQ по топикам; отставание модели чтения (≤ 1 мин).</li>
      <li><b>Алерты</b> будят по симптомам: ошибки записи > 1 % за 5 мин, p95 > 300 мс 5 мин, быстрое сгорание бюджета, падение числа записей, DLQ платежей. Получатель — дежурный SRE; в тексте — что чувствует клиент и ссылка на инструкцию. CPU, память, диск — дашборды и задачи.</li>
      <li><b>Запрещено в логах:</b> телефон, ФИО, email, номер карты, QR-токен, SMS-код. Только <code>clientId</code>. Логи храним 30 дней.</li>
    </ol>`;
  const reqTask = {
    id: 'obs-req', title: 'Требования к наблюдаемости в ФТ',
    simple: {
      icon: '📋',
      plain: 'Наблюдаемость не появляется сама: аналитик заранее пишет, что система должна о себе рассказывать — какие цели, какие числа, какие записи и чего в записях быть не должно.',
      analogy: 'Регламент смены администратора: что записывать в журнал (время, номер карты, что случилось), какие цифры сдавать вечером, кому звонить, если очередь у входа больше 10 человек, и что нельзя записывать в журнал — паспортные данные клиентов.',
      tech: 'Нефункциональные требования к наблюдаемости: SLO и SLI по сценариям, формат и поля логов, корреляция (traceId, W3C Trace Context, поле в конверте события), бизнес-метрики, алерты на симптомы с получателем и runbook, запрет ПДн в логах и срок хранения.'
    },
    lead: ui.brief({
      situation: 'Лена готовит ФТ «Покупка абонемента с бонусами, сезон 2». Раздел «Наблюдаемость» — ваш. Сергей прочитает его так: «смогу ли я по этому тексту за 5 минут узнать, что сломалось, и найти клиента». Юрист прочитает раздел про логи.',
      todo: [
        'Напишите 5–8 пунктов требований (от 350 символов).',
        'Опирайтесь на все три задания: SLO, алерты, расследование Марии.',
        'Нажмите «Проверить с Верой (Claude)» или «Сверить с эталоном самому» и отметьте, что прозвучало. Засчитывается от 60 %.'
      ],
      lookTitle: 'Подсказка',
      look: 'Хорошее требование проверяемо: «в каждой строке лога обработки события есть traceId и eventId», «алерт, если сообщение по оплате попало в DLQ». Плохое — «система должна логировать ошибки».'
    }),
    blank: () => ({ j: { text: '' } }),
    reference: () => ({ j: { text: plainT(OR_REF).replace(/\s+/g, ' ').trim(), self: OR_RUBRIC.map(() => true) } }),
    render(el, ctx) {
      el.classList.add('ob-root');
      el.insertAdjacentHTML('beforeend', ui.say('sergey', 'Если в ФТ нет traceId в событии и алерта на DLQ — я об этом узнаю от следующей Марии. А телефоны в логах я каждый квартал вычищаю вручную. Напишите так, чтобы этого не было.'));
      const j = mount(el); j.style.marginTop = '12px';
      ui.justify(j, {
        id: 'ob-req', q: 'Раздел «Наблюдаемость» в ФТ покупки абонемента', qPlain: 'Напишите требования к наблюдаемости для ФТ покупки абонемента и записи в «Пульсе»: SLO, поля логов, корреляция traceId, бизнес-метрики, алерты, что нельзя писать в логи.',
        rubric: OR_RUBRIC, reference: OR_REF, value: ctx.ans.j, readonly: ctx.readonly, minLen: 350,
        onChange: v => { ctx.ans.j = v; ctx.save(); ctx.decide('Требования к наблюдаемости', v.text || ''); }
      });
    },
    check(ans) {
      const s = ui.justifyScore(ans && ans.j), txt = String((ans.j || {}).text || ''), notes = [];
      if (txt.trim().length < 350) notes.push({ ok: false, html: 'Пока коротко: шесть тем в 350 символов не уместить.' });
      else if (!(ans.j.self || ans.j.ai)) notes.push({ ok: 'warn', html: 'Сверьте текст с эталоном (кнопка под полем) или проверьте с Верой.' });
      else notes.push({ ok: s >= 0.6, html: `Покрыто критериев: ${Math.round(s * 100)} %.` });
      if (txt.trim().length >= 350 && !/trace/i.test(txt)) notes.push({ ok: 'warn', html: 'Ни слова про traceId. Как Сергей пройдёт от жалобы Марии до сломанного шага?' });
      if (txt.trim().length >= 350 && !/(пдн|персональн|телефон|фио)/i.test(txt)) notes.push({ ok: 'warn', html: 'А чего в логах быть не должно?' });
      return { ok: s >= 0.6, score: s, notes, summary: s ? `Оценка: ${Math.round(s * 100)} %.` : 'Напишите требования и сверьте с эталоном.' };
    },
    explain: '<p>Наблюдаемость — такое же требование, как кнопка на экране: если его не написать, его не сделают, и узнают об этом в аварию. Аналитик здесь отвечает за смысл: какие сценарии важны и с какими целями, какие бизнес-события надо считать, какие ключи связывают логи с жизнью клиента (номер записи, платежа, абонемента), и где проходит граница персональных данных.</p><p>Чего в требованиях нет: «Prometheus», «Grafana», «пороги CPU». Инструменты выбирает Сергей. Аналитик пишет <b>что</b> должно быть видно и <b>кому</b> — а SRE решает <b>как</b>.</p>',
    report: ans => `Требования (текст студента):\n> ${String((ans.j || {}).text || '—').replace(/\n/g, '\n> ')}\nСамооценка: ${Math.round(ui.justifyScore(ans.j) * 100)} %.`
  };

  // =====================================================================
  TR.stage({
    id: ID, act: 7, order: 440, slot: 'Чт 10:00', title: 'Наблюдаемость и SLO',
    when: 'четверг, 10:00 · дежурка Сергея · разбор воскресного вечера',
    intro: [
      { who: 'sergey', html: 'В 20:03 мне пришло 400 алертов, и ни один не сказал, что сломалось. CPU, пул потоков, диск, каждый 503 отдельно. Двенадцать минут я листал пейджер, а что запись не работает, узнал из чата поддержки.' },
      { who: 'anton', html: 'Нам нужно не больше сигналов, а правильные: что чувствует клиент, сколько ошибок мы готовы себе позволить и как по одному номеру пройти от нажатия в приложении до сервиса бонусов.' },
      { who: 'vera', html: 'Это ваша территория больше, чем кажется. SLO записи, пропуска и оплаты, бизнес-метрики, поля логов, сквозной traceId, запрет персональных данных в логах — всё это пишет аналитик в нефункциональных требованиях. Сначала посмотрим, как устроены три сигнала и бюджет ошибок, потом разберём пейджер Сергея и одну жалобу клиентки.' }
    ],
    facts: ['F-availability', 'F-week-open', 'F-turnstile-fast', 'F-turnstile-vendor', 'F-offline', 'F-no-loss', 'F-overlap', 'F-sms'],
    glossary: [
      { term: 'Наблюдаемость (observability)', simple: 'Способность по записям системы понять, что с ней происходит, не залезая внутрь.', tech: 'Свойство системы отвечать на новые вопросы о своём поведении по внешним сигналам — логам, метрикам и трассировкам. Мониторинг отвечает на заранее известные вопросы, наблюдаемость — и на неожиданные.' },
      { term: 'Структурированный лог', simple: 'Запись в журнале не свободным текстом, а по графам: время, кто, что, номер клиента.', tech: 'Лог в машиночитаемом виде (обычно JSON) с постоянными полями: ts, level, svc, traceId, ключи сущностей, результат, код ошибки. Позволяет искать и фильтровать по полям. ПДн в логи не пишут.' },
      { term: 'RED-метрики', simple: 'Три главных вопроса к любой двери: сколько людей прошло, сколько не пустили, сколько ждали.', tech: 'Rate (запросов в секунду), Errors (доля ошибок), Duration (распределение времени ответа — перцентили). Минимальный набор метрик для каждого сервиса и каждого важного эндпоинта.' },
      { term: 'Трассировка и спан', simple: 'Маршрутный лист клиента: ресепшен → раздевалка → зал, с отметкой времени на каждом шаге.', tech: 'Трасса — путь одного запроса через все сервисы; спан — один шаг (сервис, операция, начало, длительность, статус, атрибуты). Спаны связаны родитель — потомок и общим traceId.' },
      { term: 'Сквозной идентификатор (traceId)', simple: 'Номер клубной карты, по которому клиента находят и в журнале, и в маршрутном листе.', tech: 'Идентификатор трассы, который передаётся через все шаги: в HTTP — заголовок traceparent (W3C Trace Context), через Kafka — поле traceId в конверте события или заголовки сообщения, в outbox — колонка строки.' },
      { term: 'OpenTelemetry', simple: 'Общий стандарт «как вести журналы и маршрутные листы», чтобы все сервисы писали одинаково.', tech: 'Открытый стандарт и набор библиотек для сбора трассировок, метрик и логов (OTel): единый формат, передача контекста, экспорт в любые системы хранения. Канон «Пульса» — один traceId через ядро, Kafka и сервисы.' },
      { term: 'SLI', simple: 'Что именно меряем, чтобы понять, хорошо ли клиенту: например, долю записей, прошедших быстрее 300 мс.', tech: 'Service Level Indicator — измеримый показатель качества с точки зрения пользователя: доля успешных запросов, доля запросов быстрее порога, доля непотерянных платежей. Не CPU и не аптайм сервера.' },
      { term: 'SLO', simple: 'Обещание в цифрах: «99,9 % записей в месяц проходят успешно».', tech: 'Service Level Objective — целевое значение SLI на окне (обычно скользящие 30 дней). Запись в «Пульсе»: 99,9 % в месяц (≈ 43 минуты) и p95 ≤ 300 мс. В отличие от SLA, это внутренняя цель без штрафов.' },
      { term: 'Бюджет ошибок', simple: 'Сколько плохого можно себе позволить за месяц, прежде чем откладывать новшества и чинить.', tech: 'Error budget = 100 % − SLO (для записи — 0,1 % запросов в месяц). Пока бюджет есть — релизы в обычном ритме; сгорел — заморозка рискованных релизов. Скорость сгорания (burn rate) — основа алертов.' },
      { term: 'Алерт по симптому', simple: 'Будят администратора, когда у входа стоит очередь, а не когда в серверной жарко.', tech: 'Оповещение, которое срабатывает на то, что чувствует пользователь (ошибки, задержка, падение бизнес-метрики, быстрое сгорание бюджета), а не на возможные причины (CPU, память). Каждый такой алерт ведёт к инструкции (runbook). Алерты на всё подряд приводят к «усталости от алертов».' }
    ],
    outro: 'Теперь у «Пульса» есть договор о качестве в цифрах — SLO записи, пропуска и оплаты, — бюджет ошибок и четыре звонка вместо четырёхсот: на симптомы для клиента и на бизнес-метрики, которые ловят даже тихий сбой. Один traceId ведёт от нажатия в приложении через ядро и Kafka до последнего потребителя, а в логах нет ни одного телефона. Завтра — выкатка и аварии: canary, который сам откатывает релиз по тем самым SLO, и что делать, когда отказывает целая зона.',
    tasks: [howSignals, howSlo, sliTask, alertTask, traceTask, reqTask]
  });
})();
