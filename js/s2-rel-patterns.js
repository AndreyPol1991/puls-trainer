/* Неделя 7, понедельник 10:00: отказоустойчивость на уровне системы. Канон — _dev/DOMAIN-2.md §6 и инцидент 4 (§8).
   Теория (живая): пул потоков и каскадный отказ, переборки (общий пул / раздельные), защита по шагам;
   пять способов ответить на отказ, деградация экрана, сброс нагрузки по приоритетам.
   Соседние примеры: кабинет тренера с внешним календарём, распродажа абонементов.
   Практика: лаборатория «воскресенье 20:00 и зависшая 1С», поведение каждой зависимости при отказе,
   план деградации на пик, требования к отказоустойчивости записи. */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc;
  const ID = 'rel-patterns';

  if (!document.getElementById('rlp-css')) document.head.insertAdjacentHTML('beforeend', `<style id="rlp-css">
    .rlp-root, .rlp-root .stack, .rlp-root .stack > * { min-width: 0; }
    .rlp-root :not(pre) > code { white-space: normal; overflow-wrap: anywhere; }
    .rlp-root .seg button { white-space: normal; text-align: left; }
    .rlp-box { display: grid; gap: 12px; padding: 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); min-width: 0; }
    .rlp-box > * { min-width: 0; }
    .rlp-set { display: grid; grid-template-columns: minmax(0, 190px) minmax(0, 1fr); gap: 8px 14px; align-items: center; }
    .rlp-set > .lbl { font-size: 13.5px; color: var(--text-2); min-width: 0; }
    .rlp-set > .lbl small { display: block; font-size: 12px; color: var(--text-muted); }
    .rlp-set > .seg { justify-self: start; max-width: 100%; }
    .rlp-range { width: 100%; margin: 4px 0; accent-color: var(--accent); }
    .rlp-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .rlp-stats .v { font-size: 16px; overflow-wrap: anywhere; }
    .rlp-stats .s { overflow-wrap: anywhere; }
    .rlp-sc { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .rlp-sc .stat.cur { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
    .rlp-sc .v { font-size: 15px; }
    .rlp-pools { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
    .rlp-pool { border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; background: var(--surface-2); display: grid; gap: 6px; min-width: 0; align-content: start; }
    .rlp-pool.wide { grid-column: 1 / -1; }
    .rlp-pool.full { border-color: var(--bad); }
    .rlp-pool .h { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; font-size: 12.5px; color: var(--text-2); }
    .rlp-pool .h span { font-family: var(--f-mono); }
    .rlp-pool.full .h span { color: var(--bad); }
    .rlp-g { display: grid; grid-template-columns: repeat(var(--c, 10), minmax(0, 1fr)); gap: 2px; }
    .rlp-g i { display: block; aspect-ratio: 1; border-radius: 2px; background: var(--surface-3); }
    .rlp-g i.core { background: var(--accent); }
    .rlp-g i.other { background: var(--info); }
    .rlp-g i.hung { background: var(--bad); }
    .rlp-legend { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 12px; color: var(--text-2); }
    .rlp-legend i { display: inline-block; width: 11px; height: 11px; border-radius: 2px; margin-right: 5px; vertical-align: -1px; }
    .rlp-strip { display: grid; grid-template-columns: repeat(45, minmax(0, 1fr)); gap: 2px; }
    .rlp-strip i { display: block; height: 22px; border-radius: 3px; background: var(--ok); }
    .rlp-strip i.bad { background: var(--bad); }
    .rlp-strip i.warn { background: var(--warn); }
    .rlp-axis { display: flex; justify-content: space-between; font: 11px/1.2 var(--f-mono); color: var(--text-muted); }
    .rlp-crit { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    .rlp-crit li { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 8px; font-size: 13.5px; align-items: start; }
    .rlp-crit li > b { font: 700 13px/1.4 var(--f-mono); text-align: center; }
    .rlp-crit li.ok > b { color: var(--ok); } .rlp-crit li.bad > b { color: var(--bad); }
    .rlp-crit li small { display: block; color: var(--text-muted); font-size: 12.5px; }
    .rlp-case { display: grid; gap: 8px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); }
    .rlp-case .row { flex-wrap: wrap; }
    .rlp-beh { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 8px; }
    .rlp-beh .card { gap: 4px; padding: 10px 12px; }
    .rlp-beh .card b { font-size: 13.5px; }
    .rlp-beh .card span { font-size: 12.5px; color: var(--text-2); }
    .rlp-screen { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; padding: 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface-2); }
    .rlp-tile { border: 1px solid var(--border-strong); border-radius: 10px; padding: 10px 12px; background: var(--surface); display: grid; gap: 4px; min-width: 0; font-size: 13px; }
    .rlp-tile b { font-size: 13.5px; }
    .rlp-tile small { color: var(--text-muted); font-size: 12px; }
    .rlp-tile.ok { border-color: var(--ok); }
    .rlp-tile.warn { border-color: var(--warn); background: var(--warn-soft); }
    .rlp-tile.off { border-style: dashed; color: var(--text-muted); }
    .rlp-tile.bad { border-color: var(--bad); background: var(--bad-soft); }
    .rlp-err { grid-column: 1 / -1; display: grid; gap: 6px; place-items: center; text-align: center; padding: 26px 12px; border: 1px dashed var(--bad); border-radius: 10px; color: var(--bad); }
    .rlp-src { display: flex; flex-wrap: wrap; gap: 6px; }
    .rlp-bars { display: grid; gap: 8px; }
    .rlp-bar { display: grid; grid-template-columns: 190px minmax(0, 1fr) 110px; gap: 8px; align-items: center; font-size: 13px; }
    .rlp-bar > * { min-width: 0; }
    .rlp-bar .tr { display: flex; height: 18px; border-radius: 5px; overflow: hidden; background: var(--surface-3); }
    .rlp-bar .tr i { display: block; height: 100%; }
    .rlp-bar .tr i.ok { background: var(--ok); } .rlp-bar .tr i.warn { background: var(--warn); } .rlp-bar .tr i.bad { background: var(--bad); }
    .rlp-bar .ms { font: 12px/1.25 var(--f-mono); color: var(--text-2); text-align: right; overflow-wrap: anywhere; }
    .rlp-bar .ms.bad { color: var(--bad); } .rlp-bar .ms.ok { color: var(--ok); }
    @media (max-width: 760px) {
      .rlp-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .rlp-sc { grid-template-columns: minmax(0, 1fr); }
    }
    @media (max-width: 640px) {
      .rlp-set { grid-template-columns: minmax(0, 1fr); gap: 4px; }
      .rlp-set > .lbl { margin-top: 8px; }
      .rlp-bar { grid-template-columns: minmax(0, 1fr) 84px; }
      .rlp-bar .tr { grid-column: 1 / -1; grid-row: 2; }
      .rlp-strip i { height: 18px; }
    }
  </style>`);

  // ---------- общие помощники ----------
  const L = (id, t, sub) => ({ id, t, sub });
  const fresh = pane => { const d = document.createElement('div'); pane.appendChild(d); return d; };
  const mount = (el, cls) => { const d = document.createElement('div'); if (cls) d.className = cls; el.appendChild(d); return d; };
  const plainT = s => String(s || '').replace(/<[^>]+>/g, '');
  const tOf = (list, v) => { const x = list.find(o => o.v === v); return x ? plainT(x.t) : '—'; };
  const quizRef = QS => QS.map(cfg => cfg.options.map((o, i) => o.ok ? i : -1).filter(i => i >= 0));
  const fmtS = s => s === Infinity ? '∞' : s < 1 ? Math.round(s * 1000) + ' мс' : s.toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' с';
  const n1 = x => x.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
  const lock = (el, ro) => { if (ro) TR.$$('[data-seg] button', el).forEach(b => { b.disabled = true; }); };

  // пошаговые сценарии на ui.seq с переключателем вариантов
  function walk(el, cfg) {
    let cur = cfg.scenarios[0].id;
    el.innerHTML = `<div class="stack">${cfg.scenarios.length > 1 ? `<div class="row"><span class="small dim">Вариант:</span>${ui.seg('wk', cfg.scenarios.map(s => ({ v: s.id, t: s.t })), cur, 'accent')}</div>` : ''}<div data-w></div><div data-sum></div></div>`;
    const box = TR.$('[data-w]', el), sum = TR.$('[data-sum]', el);
    function show(id) {
      cur = id; const sc = cfg.scenarios.find(s => s.id === id);
      box.innerHTML = ''; sum.innerHTML = '';
      ui.seq(mount(box), { lanes: sc.lanes, steps: sc.steps, title: sc.t, laneW: cfg.laneW || 160, hint: 'Нажимайте «Шаг →» и читайте пояснение под схемой.', onEnd() { sum.innerHTML = sc.sum ? ui.note(sc.sumKind || '', 'Итог', sc.sum) : ''; } });
    }
    ui.onSeg(el, (n, v) => { if (n === 'wk') show(v); });
    show(cur);
  }

  // Сетка потоков: pools = [{t, size, cols, wide, parts:[{n, kind}]}]
  function poolsHTML(pools) {
    return `<div class="rlp-pools">${pools.map(p => {
      const cells = []; let used = 0;
      p.parts.forEach(pt => { const k = Math.max(0, Math.min(p.size - used, Math.round(pt.n))); for (let i = 0; i < k; i++) cells.push(pt.kind); used += k; });
      while (cells.length < p.size) cells.push('');
      return `<div class="rlp-pool ${p.wide ? 'wide' : ''} ${used >= p.size ? 'full' : ''}"><div class="h"><b>${esc(p.t)}</b><span>${used} из ${p.size}${p.tag ? ' · ' + esc(p.tag) : ''}</span></div><div class="rlp-g" style="--c:${p.cols || 10}">${cells.map(k => `<i class="${k}"></i>`).join('')}</div></div>`;
    }).join('')}</div>
    <div class="rlp-legend"><span><i style="background:var(--accent)"></i>запись и расписание</span><span><i style="background:var(--info)"></i>другие вызовы</span><span><i style="background:var(--bad)"></i>ждут зависшую систему</span><span><i style="background:var(--surface-3)"></i>свободен</span></div>`;
  }
  // если спрос больше пула — делим пул пропорционально спросу (зависшая система забирает почти всё)
  function fitParts(parts, size) {
    const total = parts.reduce((s, p) => s + p.n, 0);
    if (total <= size) return parts;
    // последняя часть (зависшая система) забирает всё, что осталось
    return parts.map((p, i) => ({ n: i === parts.length - 1 ? size : total === Infinity ? 0 : Math.floor(size * p.n / total), kind: p.kind }));
  }

  // =====================================================================
  // Теория 1. Пул потоков, каскадный отказ, переборки (соседний пример: кабинет тренера и внешний календарь)
  // =====================================================================
  const T_POOL = 300;
  const T_CORE = { rate: 200, ms: 50, pool: 150 };
  const T_DEPS = [
    { id: 'cal', t: 'Календарь тренеров', sub: 'внешний сервис', rate: 20, ms: 200, pool: 30 },
    { id: 'sms', t: 'SMS-шлюз', sub: 'код входа', rate: 5, ms: 300, pool: 20 },
    { id: 'psp', t: 'ПэйПоинт', sub: 'создать платёж', rate: 10, ms: 600, pool: 40 },
    { id: 'recs', t: 'Рекомендации', sub: '«Вам подойдёт»', rate: 60, ms: 80, pool: 40 },
    { id: 'onec', t: '1С', sub: 'выгрузка оплаты', rate: 10, ms: 200, pool: 20 }
  ];
  const T_HANG = [0.2, 0.5, 1, 2, 5, 10, 20, 30];
  function tSim(hung, sec, mode) {
    const core = T_CORE.rate * T_CORE.ms / 1000;
    const dem = T_DEPS.map(d => ({ d, n: d.rate * (d.id === hung ? sec : d.ms / 1000) }));
    const others = dem.filter(x => x.d.id !== hung).reduce((s, x) => s + x.n, 0);
    const h = dem.find(x => x.d.id === hung), hd = h.d;
    const crit = (T_POOL - core - others) / hd.rate;
    if (mode === 'shared') {
      const total = core + others + h.n, dead = total > T_POOL;
      const parts = fitParts([{ n: core, kind: 'core' }, { n: others, kind: 'other' }, { n: h.n, kind: 'hung' }], T_POOL);
      return { dead, total, crit, hd, used: Math.min(T_POOL, Math.round(total)), hungN: h.n, pools: [{ t: 'Общий пул ядра', size: T_POOL, cols: 30, wide: true, parts }] };
    }
    const pools = [{ t: 'Запись и расписание', size: T_CORE.pool, cols: 30, wide: true, parts: [{ n: core, kind: 'core' }] }]
      .concat(dem.map(x => ({ t: x.d.t, size: x.d.pool, cols: 10, parts: [{ n: Math.min(x.n, x.d.pool), kind: x.d.id === hung ? 'hung' : 'other' }] })));
    return { dead: false, total: core, crit, hd, used: Math.round(core), hungN: h.n, full: h.n > hd.pool, pools };
  }
  function drawPool(pane) {
    const st = { hung: 'cal', k: 0, mode: 'shared' };
    pane.innerHTML = `<div class="stack">
      <div class="rlp-box">
        <div class="rlp-set">
          <div class="lbl">Что зависло</div>${ui.seg('hung', T_DEPS.map(d => ({ v: d.id, t: `${d.t} · ${d.rate}/с` })), st.hung)}
          <div class="lbl">Потоки ядра</div>${ui.seg('mode', [{ v: 'shared', t: 'Один общий пул на 300' }, { v: 'split', t: 'Переборки: у каждого свой пул' }], st.mode, 'accent')}
        </div>
        <label class="field"><span>Зависшая система отвечает за: <b data-k></b></span><input type="range" class="rlp-range" min="0" max="${T_HANG.length - 1}" step="1" value="${st.k}" data-r aria-label="Сколько отвечает зависшая система"></label>
      </div>
      <div data-pool></div>
      <div class="rlp-stats" data-st></div>
      <div data-n></div>
    </div>`;
    function draw() {
      const sec = T_HANG[st.k], r = tSim(st.hung, sec, st.mode), hd = r.hd;
      TR.$('[data-k]', pane).textContent = fmtS(sec) + (sec >= 30 ? ' — по сути не отвечает' : sec <= hd.ms / 1000 ? ' — как обычно' : '');
      TR.$('[data-pool]', pane).innerHTML = poolsHTML(r.pools);
      const hungTxt = st.mode === 'shared'
        ? [r.dead ? 'bad' : r.hungN > 30 ? 'warn' : 'ok', `держит ${Math.round(Math.min(r.hungN, T_POOL))} ${TR.plural(Math.round(Math.min(r.hungN, T_POOL)), 'поток', 'потока', 'потоков')}`, `${hd.rate} вызовов/с × ${fmtS(sec)}`]
        : r.full ? ['warn', 'свой пул полон', 'лишним вызовам — сразу отказ'] : ['ok', `занято ${Math.round(r.hungN)} из ${hd.pool}`, 'в своём пуле'];
      const critTxt = st.mode === 'split' ? ['ok', 'не зависит', `«${hd.t}» живёт в своём пуле`] : r.crit > 30 ? ['ok', `> 30 с`, `пул выдержит любое зависание «${hd.t}»`] : [r.dead ? 'bad' : 'warn', `≈ ${n1(r.crit)} с`, `дольше — и пул кончится`];
      TR.$('[data-st]', pane).innerHTML = `
        <div class="stat"><span class="k">Запись на занятие</span><span class="v ${r.dead ? 'bad' : 'ok'}">${r.dead ? 'не отвечает' : '≈ 50 мс'}</span><span class="s">${r.dead ? 'ждёт свободный поток → 503' : 'потоки есть'}</span></div>
        <div class="stat"><span class="k">${st.mode === 'shared' ? 'Потоков занято' : 'Пул записи'}</span><span class="v ${r.dead ? 'bad' : 'ok'}">${st.mode === 'shared' ? `${r.used} из ${T_POOL}` : `${r.used} из ${T_CORE.pool}`}</span><span class="s">${st.mode === 'shared' ? 'нужно = вызовов/с × время' : 'чужие пулы его не трогают'}</span></div>
        <div class="stat"><span class="k">${esc(hd.t)}</span><span class="v ${hungTxt[0]}">${hungTxt[1]}</span><span class="s">${hungTxt[2]}</span></div>
        <div class="stat"><span class="k">Порог зависания</span><span class="v ${critTxt[0]}">${critTxt[1]}</span><span class="s">${critTxt[2]}</span></div>`;
      let n;
      if (st.mode === 'shared') {
        if (r.dead) n = ui.note('bad', 'Каскадный отказ', `«${esc(hd.t)}» вызывают ${hd.rate} раз в секунду, и каждый вызов держит поток ${fmtS(sec)}. Нужно ${Math.round(hd.rate * sec)} потоков — а их всего ${T_POOL} на всех. Пул кончился: запись, расписание, оплата встают в очередь за свободным потоком и получают 503. Записи календарь тренеров вообще не нужен, но она легла вместе с ним.`);
        else if (r.hungN > 30) n = ui.note('warn', 'Пока держится', `Зависшая система уже держит ${Math.round(r.hungN)} потоков. Запас тает: если «${esc(hd.t)}» будет отвечать дольше ≈ ${n1(r.crit)} с, пул кончится.${hd.id !== 'recs' ? ' Попробуйте «Рекомендации» — их вызывают 60 раз в секунду, и порог у них всего несколько секунд.' : ''}`);
        else n = ui.note('', 'Все здоровы — всё работает', `Потоки быстро освобождаются. Двигайте ползунок вправо и смотрите, как красные квадратики вытесняют свободные. Сравните «SMS-шлюз» (5 вызовов/с) и «Рекомендации» (60 вызовов/с): опаснее та система, которую зовут чаще.`);
      } else {
        n = r.full
          ? ui.note('ok', 'Переборка сработала', `Пул «${esc(hd.t)}» — ${hd.pool} потоков — забит целиком, и новым вызовам в него сразу отвечают «недоступно». Плохо только функциям, которым нужен «${esc(hd.t)}». Пул записи на ${T_CORE.pool} потоков этого не заметил. Цена: каждый пул надо рассчитать, и вместе они не больше 300 — запас у каждого меньше, чем в общем.`)
          : ui.note('', 'Переборки', `Каждая внешняя система получает свой отсек — отдельный пул потоков. Зависнет одна — затопит только свой отсек. Подвиньте ползунок до 30 с.`);
      }
      TR.$('[data-n]', pane).innerHTML = n;
    }
    ui.onSeg(pane, (n, v) => { st[n] = v; draw(); });
    TR.$('[data-r]', pane).addEventListener('input', e => { st.k = +e.target.value; draw(); });
    draw();
  }
  function drawGuard(pane) {
    pane.innerHTML = '<div data-w></div>';
    const lanesNone = [L('tr', 'Кабинет тренера', 'тренеры, 20/с'), L('app', 'Приложение', 'клиенты'), L('core', 'Ядро', 'общий пул · 300'), L('cal', 'Внешний календарь', 'завис')];
    const lanesGuard = [L('tr', 'Кабинет тренера', 'тренеры, 20/с'), L('app', 'Приложение', 'клиенты'), L('core', 'Ядро', 'пул записи · 150'), L('bh', 'Пул «Календарь»', '30 потоков + предохр.'), L('cal', 'Внешний календарь', 'завис')];
    walk(TR.$('[data-w]', pane), {
      laneW: 150,
      scenarios: [
        {
          id: 'none', t: 'Без защиты', lanes: lanesNone, sumKind: 'bad',
          sum: 'Одна внешняя система, которая нужна только тренерам, положила запись клиентов. Ничего не «сломалось» в коде записи — у неё просто кончились общие потоки.',
          steps: [
            { from: 'tr', to: 'core', t: 'открыть «Моя неделя»', note: 'Тренер открывает свою неделю. Ядро берёт для запроса поток из общего пула на 300.' },
            { from: 'core', to: 'cal', t: 'занятость тренера?', note: 'Ядро синхронно спрашивает внешний календарь, когда тренер занят. Таймаута нет: ждём, сколько понадобится.' },
            { from: 'cal', to: 'cal', t: 'молчит', kind: 'bad', note: 'Календарь завис: соединение открыто, ответа нет. Поток ядра стоит и ждёт.' },
            { from: 'tr', to: 'core', t: '…ещё 20 запросов\nкаждую секунду', kind: 'warn', note: 'Каждую секунду ещё 20 тренеров и администраторов открывают кабинет. Каждый запрос забирает поток и тоже встаёт ждать.' },
            { from: 'core', to: 'core', t: 'занято 300 из 300', kind: 'bad', note: 'Через ~15 секунд ждут все 300 потоков: 20 вызовов/с × 15 с = 300. Это <b>закон Литтла</b>: сколько потоков занято = сколько запросов в секунду × сколько держим каждый.' },
            { from: 'app', to: 'core', t: 'POST /classes/{id}/bookings', note: 'Анна записывается на йогу. Записи календарь не нужен — но свободного потока нет, запрос встаёт в очередь.' },
            { from: 'core', to: 'app', t: '503 / таймаут', reply: true, kind: 'bad', note: 'Через несколько секунд Анна получает ошибку. Запись легла из-за календаря тренеров — это <b>каскадный отказ</b>.' }
          ]
        },
        {
          id: 'guard', t: 'Таймаут + переборка + предохранитель', lanes: lanesGuard, sumKind: 'ok',
          sum: 'Три слоя защиты делают разное: <b>таймаут</b> ограничивает ожидание одного вызова, <b>переборка</b> — сколько потоков может забрать одна система, <b>предохранитель</b> перестаёт звать лежачего и сразу отдаёт запасной вариант. Ни один слой не заменяет другие.',
          steps: [
            { from: 'tr', to: 'core', t: 'открыть «Моя неделя»', note: 'Запрос приходит в ядро. Обычная работа — в пуле записи на 150 потоков.' },
            { from: 'core', to: 'bh', t: 'нужна занятость', note: 'Вызовы календаря идут только через свой пул на 30 потоков — <b>переборку</b>. Больше 30 потоков календарь не заберёт никогда.' },
            { from: 'bh', to: 'cal', t: 'занятость?\n(таймаут 2 с)', note: 'Ждём не дольше 2 секунд — <b>таймаут</b>.' },
            { from: 'cal', to: 'cal', t: 'молчит', kind: 'bad', note: 'Календарь завис.' },
            { from: 'bh', to: 'core', t: 'таймаут', reply: true, kind: 'warn', note: 'Через 2 секунды поток свободен. Предохранитель записывает: одна ошибка.' },
            { from: 'core', to: 'tr', t: 'копия занятости от 19:50', reply: true, kind: 'ok', note: '<b>Запасной вариант</b>: показываем последнюю сохранённую копию с пометкой «обновлено в 19:50». Тренер видит свою неделю.' },
            { from: 'bh', to: 'bh', t: '5 ошибок за 10 с →\nразомкнуться на 30 с', kind: 'warn', note: '<b>Предохранитель</b> размыкается: следующие 30 секунд календарь вообще не зовём.' },
            { from: 'tr', to: 'core', t: '…20 запросов/с', note: 'Новые запросы получают копию сразу — ни один поток не ждёт. Это <b>быстрый отказ</b>: лучше сразу «нет», чем «подождите 30 секунд, а потом нет».' },
            { from: 'app', to: 'core', t: 'POST /classes/{id}/bookings', note: 'Анна записывается. Пул записи свободен: календарь живёт в своём отсеке.' },
            { from: 'core', to: 'app', t: '201 Created', reply: true, kind: 'ok', note: 'Запись работает.' },
            { from: 'bh', to: 'cal', t: 'через 30 с: пробный', note: 'Через 30 секунд предохранитель пропускает один пробный запрос.' },
            { from: 'cal', to: 'bh', t: 'ответ', reply: true, kind: 'ok', note: 'Календарь поднялся — предохранитель замыкается, данные снова свежие. Перезапускать ничего не пришлось.' }
          ]
        }
      ]
    });
  }
  const howCascade = {
    id: 'how-cascade', covers: ['sunday-lab'], title: 'Как это работает: каскадный отказ и переборки', free: true, noReset: true,
    simple: {
      icon: '🧱',
      plain: 'Если все задачи делят одних и тех же работников, одна зависшая задача может забрать их всех. Переборка — это когда у каждой внешней системы свои работники.',
      analogy: 'На ресепшене 300 администраторов. Один клиент просит дозвониться в бухгалтерию, а там не берут трубку. Каждый администратор, к которому подходят с такой просьбой, стоит с трубкой у уха. Через минуту с трубками стоят все 300 — и записать на йогу уже некому. Переборка: на звонки в бухгалтерию выделено 10 администраторов. Все 10 заняты — клиенту сразу говорят «бухгалтерия сейчас недоступна», а остальные 290 записывают на занятия. Слово из кораблестроения: трюм делят на отсеки, и пробоина топит один отсек, а не корабль.',
      tech: '<b>Пул потоков</b> — ограниченный набор рабочих потоков сервера. Сколько их занято = запросов в секунду × время ответа (закон Литтла). <b>Каскадный отказ</b> — зависшая зависимость держит потоки, общий пул кончается, и встают функции, которым она не нужна. <b>Переборка (bulkhead)</b> — отдельный пул потоков или соединений на каждую внешнюю систему. Таймауты, повторы и предохранитель для одного вызова — неделя 3, раздел «Таймауты, повторы и паузы»; здесь — как они работают вместе в системе.'
    },
    lead: ui.brief({
      situation: 'Соседний пример. Ядро «Пульса» обслуживает запись и расписание и ещё зовёт пять внешних систем. Одна из них новая: кабинет тренера показывает занятость тренера из его личного внешнего календаря — 20 запросов в секунду. У ядра 300 потоков на всех.',
      todo: [
        'Вкладка «Пул потоков»: оставьте «Календарь тренеров» и двигайте ползунок от 0,2 до 30 секунд. На каком зависании запись перестаёт отвечать?',
        'Переключите «Что зависло» на «SMS-шлюз», потом на «Рекомендации». Почему порог у них такой разный?',
        'Включите «Переборки» и снова дойдите до 30 секунд. Что стало с записью — и с функциями, которым нужен календарь?',
        'Вкладка «Защита по шагам»: пройдите оба варианта и найдите, что делает каждый из трёх слоёв защиты.'
      ],
      look: 'Квадратик — один поток ядра. Зелёные заняты записью и расписанием, синие — другими внешними вызовами, красные ждут зависшую систему, серые свободны. «Порог зависания» — сколько секунд должна думать система, чтобы съесть весь общий пул.'
    }),
    render(el) {
      el.classList.add('rlp-root');
      ui.tabs(mount(el), [
        { id: 'pool', t: 'Пул потоков', render: pane => drawPool(fresh(pane)) },
        { id: 'guard', t: 'Защита по шагам', render: pane => drawGuard(fresh(pane)) }
      ], 'pool');
    }
  };

  // =====================================================================
  // Теория 2. Как отвечать на отказ: пять способов, деградация экрана, сброс нагрузки
  // =====================================================================
  const BEH = [
    { v: 'retry', t: 'Ждать с таймаутом и повторить', d: 'результат нужен сейчас и запрос безопасно повторить: короткий таймаут, 1–2 повтора с паузой, потом честная ошибка' },
    { v: 'fallback', t: 'Запасной вариант', d: 'вместо ответа показать замену: сохранённую копию, значение по умолчанию, популярное' },
    { v: 'degrade', t: 'Деградация: выключить функцию', d: 'временно убрать функцию или её часть, остальное работает' },
    { v: 'shed', t: 'Сбросить запрос (503)', d: 'при перегрузке сразу ответить «занято, повторите позже», не занимая поток' },
    { v: 'defer', t: 'Отложить через очередь', d: 'запомнить задачу и выполнить, когда система поднимется' }
  ];
  const FIVE = [
    { id: 'cal', t: 'Тренер открыл «Моя неделя», а его внешний календарь не отвечает', ok: 'fallback', why: 'Показываем копию занятости, сохранённую при прошлом успешном запросе, с пометкой «обновлено в 19:50». Тренеру немного устаревшие данные полезнее пустого экрана.' },
    { id: 'addr', t: 'При регистрации не работает сервис подсказок адреса', ok: 'degrade', why: 'Выключаем подсказки: поле адреса остаётся обычным, клиент вводит руками. Регистрация работает, неудобство маленькое.' },
    { id: 'ofd', t: 'После оплаты не отвечает оператор электронных чеков', ok: 'defer', why: 'Чек обязателен, но не в ту же секунду. Кладём задачу в очередь и отправим, когда оператор поднимется. Клиенту — «чек придёт на почту».' },
    { id: 'cert', t: 'Клиент платит за абонемент подарочным сертификатом магазина-партнёра — сертификат надо проверить', ok: 'retry', why: 'Без ответа продать нельзя: результат нужен сейчас. Таймаут 2 с, один повтор с паузой — проверка ничего не меняет, повторять безопасно. Не вышло — честно: «Не удалось проверить сертификат, попробуйте через пару минут».' },
    { id: 'promo', t: 'Реклама нового клуба гонит 3 000 запросов в секунду на страницу «Акции», сервер захлёбывается', ok: 'shed', why: 'Лишние запросы к некритичной странице сразу получают 503 с заголовком <code>Retry-After</code> и не занимают потоки. Покупка абонемента и запись продолжают работать.' }
  ];
  function drawFive(pane) {
    const open = {};
    function draw() {
      pane.innerHTML = `<div class="stack">
        <div class="rlp-beh">${BEH.map(b => `<div class="card flat"><b>${esc(b.t)}</b><span>${esc(b.d)}</span></div>`).join('')}</div>
        <p class="small muted">Пять ситуаций не из «Пульса» — по одной на каждый способ. Решите сами, потом смотрите ответ.</p>
        ${FIVE.map(c => {
          const g = open[c.id];
          return `<div class="rlp-case"><div><b>${esc(c.t)}</b></div>
            <div class="row">${BEH.map(b => `<button type="button" class="btn xs" data-cs="${c.id}|${b.v}" aria-pressed="${g === b.v}">${esc(b.t)}</button>`).join('')}</div>
            ${g ? ui.note(g === c.ok ? 'ok' : 'warn', (g === c.ok ? 'Верно' : 'Лучше иначе') + ' · ' + tOf(BEH, c.ok), c.why) : ''}</div>`;
        }).join('')}
        ${ui.note('info', 'Как выбирать', 'Три вопроса: <b>нужен ли результат прямо сейчас?</b> (нет — откладываем); <b>можно ли чем-то заменить?</b> (да — запасной вариант, нет — выключаем функцию); <b>это отказ или перегрузка?</b> (перегрузка — сбрасываем лишнее, пока не поздно). «Ждать и повторить» — только когда ответ нужен немедленно и повтор безопасен.')}
      </div>`;
    }
    TR.on(pane, 'click', '[data-cs]', (e, b) => { const [id, v] = b.dataset.cs.split('|'); open[id] = v; draw(); });
    draw();
  }
  const SRC = [{ id: 'core', t: 'Ядро' }, { id: 'cal', t: 'Внешний календарь' }, { id: 'rev', t: 'Сервис отзывов' }, { id: 'ana', t: 'Аналитика' }];
  const TILES = [
    { id: 'classes', t: 'Мои занятия на неделе', src: 'core', plan: 'need', okTxt: '12 занятий · пн 19:00 сайкл, ср 9:00 йога…', downTxt: 'Не загрузилось — без ядра кабинет бесполезен' },
    { id: 'busy', t: 'Занятость из личного календаря', src: 'cal', plan: 'fallback', okTxt: 'вт 12:00–14:00 занят, чт свободен', downTxt: 'Копия от 19:50 · может быть неточной' },
    { id: 'reviews', t: 'Отзывы клиентов', src: 'rev', plan: 'degrade', okTxt: '«Отличный сайкл!» · 4,9 ★', downTxt: 'Блок скрыт: отзывы временно недоступны' },
    { id: 'stats', t: 'Посещаемость моих занятий', src: 'ana', plan: 'degrade', okTxt: 'в среднем 17 из 20 мест', downTxt: 'Блок скрыт: статистика появится позже' },
    { id: 'swap', t: 'Кнопка «Обменяться сменой»', src: 'core', plan: 'need', okTxt: 'доступна', downTxt: 'Недоступна вместе с ядром' }
  ];
  function drawScreen(pane) {
    const st = { mode: 'all', down: { cal: true } };
    function draw() {
      const anyDown = SRC.some(s => st.down[s.id]), coreDown = !!st.down.core;
      let body;
      if (st.mode === 'all' && anyDown) body = `<div class="rlp-err"><b>Что-то пошло не так</b><span class="small">Страница ждала все источники 30 секунд и сдалась.</span></div>`;
      else body = TILES.map(tl => {
        const dn = !!st.down[tl.src];
        const cls = !dn ? 'ok' : tl.plan === 'fallback' ? 'warn' : tl.plan === 'degrade' ? 'off' : 'bad';
        return `<div class="rlp-tile ${cls}"><b>${esc(tl.t)}</b><span>${esc(dn ? tl.downTxt : tl.okTxt)}</span><small>${dn ? (tl.plan === 'fallback' ? 'запасной вариант' : tl.plan === 'degrade' ? 'деградация' : 'критично') : 'источник: ' + esc(SRC.find(s => s.id === tl.src).t)}</small></div>`;
      }).join('');
      const work = !(st.mode === 'all' && anyDown) && !coreDown;
      pane.innerHTML = `<div class="stack">
        <div class="rlp-box">
          <div class="rlp-set"><div class="lbl">Как устроена страница</div>${ui.seg('mode', [{ v: 'all', t: 'Ждёт все источники' }, { v: 'plan', t: 'У каждого блока свой план отказа' }], st.mode, 'accent')}
          <div class="lbl">Что лежит</div><div class="rlp-src">${SRC.map(s => `<button type="button" class="chip ${st.down[s.id] ? 'bad' : ''}" data-src="${s.id}" aria-pressed="${!!st.down[s.id]}">${st.down[s.id] ? '✕ ' : '✓ '}${esc(s.t)}</button>`).join('')}</div></div>
        </div>
        <div class="eyebrow">Кабинет тренера · «Моя неделя»</div>
        <div class="rlp-screen">${body}</div>
        ${ui.note(work ? 'ok' : 'bad', work ? 'Тренер может работать' : 'Тренер не может работать', st.mode === 'all' && anyDown && !coreDown
          ? 'Один некритичный блок уронил всю страницу. Переключитесь на «свой план отказа».'
          : coreDown ? 'Ядро — критичный источник: без него нет ни занятий, ни кнопок. Его защищают иначе — запасом мощности, репликами, отказоустойчивой базой (это — завтра и в пятницу).'
            : anyDown ? 'Сломанные блоки заменены копией или спрятаны, главное — занятия и кнопки — работает. Это и есть <b>плавная деградация</b>: хуже, но не «всё легло».' : 'Все источники здоровы. «Положите» календарь, отзывы или аналитику.')}
        ${ui.note('info', 'Позиция аналитика', 'План отказа каждого блока — требование, а не решение разработчика «по ходу». В постановке экрана аналитик пишет: какой источник у блока, критичен ли он, что показываем при отказе (текст, копия, скрыть) и как долго копия считается допустимой.')}
      </div>`;
    }
    TR.on(pane, 'click', '[data-src]', (e, b) => { st.down[b.dataset.src] = !st.down[b.dataset.src]; draw(); });
    ui.onSeg(pane, (n, v) => { if (n === 'mode') { st.mode = v; draw(); } });
    draw();
  }
  const SH_T = [
    { id: 'pay', t: 'Оплата абонемента', p: 1, share: 0.08 },
    { id: 'cat', t: 'Каталог абонементов и цены', p: 2, share: 0.32 },
    { id: 'live', t: '«Сколько людей в клубе»', p: 3, share: 0.35 },
    { id: 'recs', t: '«Вам подойдёт»', p: 3, share: 0.25 }
  ];
  const SH_LOAD = [50, 80, 100, 120, 150, 200, 300];
  function shedSim(pct, mode) {
    const rho = pct / 100;
    if (mode === 'none') {
      let ok, ms;
      if (rho <= 0.85) { ok = 1; ms = 120; }
      else if (rho <= 1) { ok = 1; ms = Math.round(120 / Math.max(0.08, 1 - rho + 0.05) / 6.7 * 2.2); }
      else { ok = Math.max(0, 1 / rho - (rho - 1)); ms = Infinity; }
      return SH_T.map(c => ({ c, ok, rej: 0, late: 1 - ok, ms }));
    }
    let budget = 0.9;
    const res = {};
    [1, 2, 3].forEach(p => {
      const cls = SH_T.filter(c => c.p === p), dem = cls.reduce((s, c) => s + c.share * rho, 0);
      const adm = Math.min(dem, budget); budget -= adm;
      cls.forEach(c => { res[c.id] = dem ? adm / dem : 1; });
    });
    return SH_T.map(c => ({ c, ok: res[c.id], rej: 1 - res[c.id], late: 0, ms: 120 }));
  }
  function drawShed(pane) {
    const st = { k: 4, mode: 'none' };
    pane.innerHTML = `<div class="stack">
      <div class="rlp-box">
        <div class="rlp-set"><div class="lbl">Что делаем при перегрузке</div>${ui.seg('mode', [{ v: 'none', t: 'Обслуживаем всех по очереди' }, { v: 'prio', t: 'Сбрасываем лишнее по приоритету' }], st.mode, 'accent')}</div>
        <label class="field"><span>Нагрузка: <b data-k></b> от того, что сервер держит</span><input type="range" class="rlp-range" min="0" max="${SH_LOAD.length - 1}" value="${st.k}" data-r aria-label="Нагрузка"></label>
      </div>
      <div class="rlp-bars" data-b></div>
      <div class="rlp-legend"><span><i style="background:var(--ok)"></i>ответили вовремя</span><span><i style="background:var(--warn)"></i>сразу 503 + Retry-After</span><span><i style="background:var(--bad)"></i>ждали и не дождались</span></div>
      <div data-n></div>
    </div>`;
    function draw() {
      const pct = SH_LOAD[st.k], r = shedSim(pct, st.mode);
      TR.$('[data-k]', pane).textContent = pct + ' %';
      TR.$('[data-b]', pane).innerHTML = r.map(x => {
        const okP = Math.round(x.ok * 100), rejP = Math.round(x.rej * 100), lateP = Math.max(0, 100 - okP - rejP);
        return `<div class="rlp-bar"><span><b>${esc(x.c.t)}</b> <span class="small dim">· приоритет ${x.c.p}</span></span><div class="tr"><i class="ok" style="width:${okP}%"></i><i class="warn" style="width:${rejP}%"></i><i class="bad" style="width:${lateP}%"></i></div><span class="ms ${x.ms === Infinity ? 'bad' : okP === 100 ? 'ok' : ''}">${okP} % · ${x.ms === Infinity ? '> 5 с' : x.ms + ' мс'}</span></div>`;
      }).join('');
      let n;
      if (pct <= 80) n = ui.note('', 'Запас есть', 'Сервер справляется — сбрасывать нечего. Двигайте ползунок вправо.');
      else if (st.mode === 'none') n = pct <= 100
        ? ui.note('warn', 'На пределе', 'Очередь растёт, ответы замедляются у всех одинаково — и у оплаты, и у «сколько людей в клубе».')
        : ui.note('bad', 'Перегрузка бьёт по всем', `При ${pct} % очередь растёт без конца: ответ приходит позже, чем клиент готов ждать, клиент жмёт ещё раз — и нагрузка растёт сама. Оплата страдает так же, как «сколько людей в клубе». ${pct >= 200 ? 'Полезных ответов почти нет — сервер работает в полную силу, но впустую.' : ''}`);
      else n = ui.note('ok', 'Жертвуем малым, чтобы спасти главное', `Сервер берёт работы на 90 % своей мощности — по приоритету. Оплата проходит вся, каталог — ${Math.round(r[1].ok * 100)} %, а «сколько людей в клубе» и рекомендации получают сразу <code>503</code> с <code>Retry-After</code> — без ожидания и без занятых потоков. Приложение в ответ на 503 прячет блок или показывает «обычно в это время». В «Пульсе» так же: запись важнее, чем «сколько людей в клубе».`);
      TR.$('[data-n]', pane).innerHTML = n;
    }
    ui.onSeg(pane, (n, v) => { if (n === 'mode') { st.mode = v; draw(); } });
    TR.$('[data-r]', pane).addEventListener('input', e => { st.k = +e.target.value; draw(); });
    draw();
  }
  const howDegrade = {
    id: 'how-degrade', covers: ['deps', 'shed-plan', 'req'], title: 'Как это работает: запасной вариант, деградация и сброс нагрузки', free: true, noReset: true,
    simple: {
      icon: '🪫',
      plain: 'Когда что-то сломалось, есть выбор получше, чем «всё легло»: показать замену, выключить мелочь, сделать позже или отказать лишним, чтобы успеть главное.',
      analogy: 'В клубе выключили свет в сауне. Можно закрыть весь клуб — а можно повесить табличку «сауна не работает», выдать полотенца из запаса вместо прачечной и записать жалобу в журнал на завтра. А в час пик администратор сначала обслуживает тех, кто пришёл на занятие, а вопросы «сколько стоит персональная» — потом.',
      tech: '<b>Запасной вариант (fallback)</b> — подмена ответа: кэш, копия, значение по умолчанию. <b>Деградация</b> — временное отключение функции, обычно рубильником (флагом функции). <b>Отложить</b> — очередь и повтор позже. <b>Сброс нагрузки (load shedding)</b> — при перегрузке сразу отвечать <code>503</code> с <code>Retry-After</code> на некритичные запросы, чтобы критичные успели.'
    },
    lead: ui.brief({
      situation: 'Три вкладки на соседних примерах. Первая — пять способов ответить на отказ. Вторая — кабинет тренера, где у каждого блока свой источник данных. Третья — распродажа абонементов, когда пришло больше людей, чем сервер может обслужить.',
      todo: [
        '«Пять способов»: в каждой ситуации сначала выберите способ сами, потом читайте ответ.',
        '«Деградация экрана»: в режиме «Ждёт все источники» положите только внешний календарь. Потом включите «свой план отказа» и положите по очереди календарь, отзывы, аналитику и ядро.',
        '«Сброс нагрузки»: доведите нагрузку до 150 % в обоих режимах. Сравните, что стало с оплатой.'
      ],
      look: 'На экране тренера: зелёная рамка — блок работает, жёлтая — показана копия, пунктир — блок выключен, красная — блок нужен и не работает. В сбросе нагрузки: полоска — что случилось с запросами этого вида.'
    }),
    render(el) {
      el.classList.add('rlp-root');
      ui.tabs(mount(el), [
        { id: 'five', t: 'Пять способов', render: pane => drawFive(fresh(pane)) },
        { id: 'screen', t: 'Деградация экрана', render: pane => drawScreen(fresh(pane)) },
        { id: 'shed', t: 'Сброс нагрузки', render: pane => drawShed(fresh(pane)) }
      ], 'five');
    }
  };

  // =====================================================================
  // Практика 1. Лаборатория «Воскресенье 20:00 и зависшая 1С»
  // =====================================================================
  const POOL = 300, CORE_N = 40;
  const LDEP = {
    onec: { t: '1С', full: 'выгрузка оплаты в 1С', rate: 25, ms: 0.2, to: 3, bh: 10 },
    psp: { t: 'ПэйПоинт', full: 'создание платежа', rate: 25, ms: 0.6, to: 10, bh: 60 },
    recs: { t: 'Рекомендации', full: '«Вам подойдёт» на главном экране', rate: 200, ms: 0.08, to: 0.5, bh: 30 }
  };
  const BH_CORE = 200;
  const O_TO = [{ v: 'off', t: 'нет — ждём, сколько понадобится' }, { v: 'on', t: 'есть: 1С 3 с, ПэйПоинт 10 с, рекомендации 0,5 с' }];
  const O_BH = [{ v: 'off', t: 'общий пул на 300' }, { v: 'on', t: 'свои пулы: ядро 200, ПэйПоинт 60, рекомендации 30, 1С 10' }];
  const O_CB = [{ v: 'off', t: 'нет' }, { v: 'on', t: 'есть: 5 ошибок за 10 с → 30 с не звать, потом пробный' }];
  const O_EX = [{ v: 'sync', t: 'синхронно при каждой оплате' }, { v: 'async', t: 'событием PaymentSucceeded → обработчик onec-export' }];
  const SCN = [
    { v: 'onec', t: '1С зависла', k: 'как в прошлое воскресенье' },
    { v: 'psp', t: 'ПэйПоинт завис', k: 'в пик бывает' },
    { v: 'recs', t: 'Рекомендации зависли', k: 'сервис аналитики' }
  ];
  const CRIT = [
    { id: 'a', t: 'Запись работает всё время', s: 'ни минуты простоя, даже короткой' },
    { id: 'b', t: 'Подъём без перезапуска', s: 'зависшая система поднялась — всё восстановилось само' },
    { id: 'c', t: 'Чужой сбой не ломает лишнего и ничего не теряется', s: 'оплаты не падают из-за бухгалтерии, документы не пропадают' },
    { id: 'd', t: 'Не добиваем лежачего', s: 'пока система лежит, шлём ей только пробные запросы' }
  ];
  const sigOf = a => `${a.to}|${a.bh}|${a.cb}|${a.ex}`;

  function simLab(a, sc) {
    const D = LDEP[sc], T = a.to === 'on' ? D.to : Infinity, fin = isFinite(T);
    const brk = a.cb === 'on' && fin, bh = a.bh === 'on', sync1c = a.ex === 'sync';
    const base = { onec: sync1c ? LDEP.onec.rate * LDEP.onec.ms : 0, psp: LDEP.psp.rate * LDEP.psp.ms, recs: LDEP.recs.rate * LDEP.recs.ms };
    const r = { sc, T, crit: {}, notes: {} };
    if (sc === 'onec' && !sync1c) {
      const others = CORE_N + base.psp + base.recs;
      r.book = 'ok'; r.threads = Math.round(others);
      r.pools = bh ? [
        { t: 'Ядро: запись и расписание', size: BH_CORE, cols: 20, wide: true, parts: [{ n: CORE_N, kind: 'core' }] },
        { t: 'ПэйПоинт', size: 60, parts: [{ n: base.psp, kind: 'other' }] }, { t: 'Рекомендации', size: 30, parts: [{ n: base.recs, kind: 'other' }] }, { t: '1С', size: 10, tag: 'не нужен', parts: [] }
      ] : [{ t: 'Общий пул ядра', size: POOL, cols: 30, wide: true, parts: [{ n: CORE_N, kind: 'core' }, { n: base.psp + base.recs, kind: 'other' }] }];
      r.client = ['ok', 'оплата проходит', 'документ уйдёт в 1С позже'];
      r.dep = fin ? ['ok', 'обработчик ждёт', 'пробует раз в 3 с'] : ['bad', 'обработчик завис', 'на первом вызове, навсегда'];
      r.crit.a = true; r.crit.c = true; r.crit.d = true; r.crit.b = fin;
      r.notes.b = fin ? 'Обработчик выгрузки ждёт 1С не дольше 3 с и пробует снова. 1С поднялась — он вычитал накопленные события и догнал.' : 'Без таймаута обработчик выгрузки висит на первом вызове к 1С вечно. 1С поднялась, а выгрузка стоит, пока кто-то не перезапустит обработчик.';
    } else {
      const others = CORE_N + Object.keys(base).filter(k => k !== sc).reduce((s, k) => s + base[k], 0);
      const demand = fin ? D.rate * T : Infinity;
      if (!bh) {
        const trans = others + demand, steady = brk ? others + 1 : trans;
        r.book = steady > POOL ? 'down' : trans > POOL ? 'blip' : 'ok';
        r.threads = Math.min(POOL, Math.round(steady));
        r.pools = [{ t: 'Общий пул ядра', size: POOL, cols: 30, wide: true, parts: fitParts([{ n: CORE_N, kind: 'core' }, { n: others - CORE_N, kind: 'other' }, { n: brk ? 1 : demand, kind: 'hung' }], POOL) }];
      } else {
        r.book = 'ok'; r.threads = CORE_N;
        const inPool = brk ? 1 : Math.min(demand, D.bh);
        const mk = (k, t, size) => ({ t, size, parts: [{ n: k === sc ? inPool : base[k], kind: k === sc ? 'hung' : 'other' }], tag: k === 'onec' && !sync1c ? 'не нужен' : '' });
        r.pools = [{ t: 'Ядро: запись и расписание', size: BH_CORE, cols: 20, wide: true, parts: [{ n: CORE_N, kind: 'core' }] }, mk('psp', 'ПэйПоинт', 60), mk('recs', 'Рекомендации', 30), mk('onec', '1С', 10)];
      }
      r.crit.a = r.book === 'ok';
      r.crit.b = fin;
      r.crit.c = !(sc === 'onec' && sync1c);
      r.crit.d = brk;
      // что видит клиент функции, которой нужна зависшая система
      const what = { onec: 'оплата', psp: 'оплата', recs: 'главный экран' }[sc];
      const fb = { onec: 'ошибка, хотя деньги списаны', psp: '«Оплата временно недоступна»', recs: 'популярные занятия вместо подборки' }[sc];
      if (r.book === 'down') r.client = ['bad', 'всё легло', 'и запись, и всё остальное'];
      else if (brk) r.client = [sc === 'onec' ? 'bad' : 'ok', `${what}: сразу`, fb];
      else if (bh && !fin) r.client = ['warn', `${what}: сразу отказ`, 'свой пул забит навсегда'];
      else if (bh) r.client = ['warn', `${what}: до ${fmtS(T)} ожидания`, 'часть сразу, часть после таймаута'];
      else if (fin) r.client = [sc === 'onec' ? 'bad' : 'warn', `${what}: ${fmtS(T)} ожидания`, fb];
      else r.client = ['bad', `${what}: висит`, 'без ответа'];
      if (brk) r.dep = ['ok', '1 пробный в 30 с', 'предохранитель разомкнут'];
      else if (!fin) r.dep = ['bad', 'сотни висящих вызовов', 'соединения открыты'];
      else r.dep = ['bad', `${n1(bh ? Math.min(D.rate, D.bh / T) : D.rate)} запросов/с`, 'долбим лежачего'];
      r.notes.a = r.book === 'down' ? `Каждый вызов «${D.t}» держит поток ${fin ? fmtS(T) : 'бесконечно'}, а их ${D.rate} в секунду. Общий пул кончился — запись ждёт свободный поток и отвечает 503.`
        : r.book === 'blip' ? `Предохранитель размыкается только после первых ошибок, а они приходят через ${fmtS(T)}. За это время ${D.rate} вызовов/с × ${fmtS(T)} = ${Math.round(D.rate * T)} потоков плюс ${Math.round(others)} обычных — больше ${POOL}. Запись лежит секунд десять, пока предохранитель не сработал.`
          : bh ? `«${D.t}» может забрать только свой пул. Пул ядра (${BH_CORE}) этого не замечает.` : `${D.rate} вызовов/с × ${fmtS(brk ? 0.01 : T)} — потоков хватает с запасом.`;
      r.notes.b = fin ? `Каждый вызов отпускает поток не позже чем через ${fmtS(T)}. «${D.t}» поднялся — следующие вызовы проходят.` : `Без таймаута вызовы висят на мёртвых соединениях и после подъёма «${D.t}». Пул ${bh ? `«${D.t}»` : 'ядра'} остаётся забит — помогает только перезапуск. Так и было в прошлое воскресенье.`;
      r.notes.c = sc === 'onec' && sync1c ? 'Оплата синхронно ждёт 1С. 1С лежит — клиент получает ошибку (или ждёт), хотя ПэйПоинт уже списал деньги, а документ этого платежа в 1С не ушёл. Бухгалтерия не должна стоять на пути оплаты.' : sc === 'onec' ? '' : `Без «${D.t}» его функция честно не работает — это ожидаемо. Остальное не задето.`;
      r.notes.d = brk ? 'Предохранитель разомкнулся: раз в 30 с один пробный запрос. Поднявшаяся система не ляжет снова от нашего шквала.' : !fin ? 'Предохранитель считает ошибки, а зависший вызов без таймаута ошибкой не становится — он просто висит. Предохранитель его не видит.' : `Каждые ${fmtS(T)} вызовы падают по таймауту — и мы шлём новые. Поднимаясь, «${D.t}» получит весь накопленный поток и может лечь снова.`;
    }
    r.green = CRIT.every(c => r.crit[c.id]);
    return r;
  }
  function stripHTML(r) {
    const cells = [];
    for (let m = 0; m < 45; m++) {
      let k = '';
      if (m >= 3 && m <= 42) k = r.book === 'down' ? 'bad' : (r.book === 'blip' && m === 3) ? 'warn' : '';
      if (m === 43 && r.book === 'down' && !isFinite(r.T)) k = 'warn';
      cells.push(`<i class="${k}" title="20:${String(m).padStart(2, '0')}"></i>`);
    }
    return `<div class="stack tight"><div class="rlp-strip">${cells.join('')}</div><div class="rlp-axis"><span>20:00</span><span>20:03 — зависло</span><span>20:43 — поднялось</span><span>20:45</span></div></div>`;
  }
  const LAB_Q = {
    q: 'Зачем таймаут, если предохранитель уже включён?', seed: 'rlp-lab-q2',
    options: [
      { t: 'Предохранитель размыкается по ошибкам, а зависший вызов без таймаута ошибкой не становится — он просто висит, и предохранитель его не видит', ok: 1, why: 'Верно. Таймаут превращает «висит» в «ошибку», и только тогда предохранитель может её посчитать. Слои защиты работают вместе.' },
      { t: 'Таймаут ускоряет ответ зависшей системы', why: 'Таймаут ничего не ускоряет — он ограничивает, сколько мы готовы ждать.' },
      { t: 'Незачем: с предохранителем таймаут лишний', why: 'Проверьте в лаборатории: выключите таймаут при включённом предохранителе и посмотрите на проверки «Подъём без перезапуска» и «Не добиваем лежачего».' },
      { t: 'Таймаут нужен только для 1С, остальным хватит предохранителя', why: 'Зависнуть может любая внешняя система. Таймаут нужен на каждом внешнем вызове — каждый со своим значением.' }
    ]
  };
  const labTask = {
    id: 'sunday-lab', title: 'Воскресенье 20:00 и зависшая 1С',
    simple: howCascade.simple,
    lead: ui.brief({
      situation: `Разбор аварии. Прошлое воскресенье, 20:03 — пик записи, и у франчайзи зависла 1С. Ядро при каждой оплате (в пик ${LDEP.onec.rate} в секунду) синхронно отправляло документ в 1С — в общем пуле на ${POOL} потоков (6 экземпляров по 50) и без таймаута. Запись лежала 40 минут. Сергей хочет, чтобы следующая такая авария прошла для клиентов незаметно. И не только с 1С: в пик так же может зависнуть ПэйПоинт (бывает, отвечает по 10+ секунд) и рекомендации на главном экране (${LDEP.recs.rate} вызовов в секунду).`,
      todo: [
        'Ничего не меняя, посмотрите сценарий «1С зависла»: полоса — доступность записи с 20:00 до 20:45. Узнаёте 40 минут?',
        'Включайте защиту по одной: «Таймаут», «Переборка», «Предохранитель», «Выгрузка в 1С». После каждого изменения смотрите на четыре проверки под сеткой потоков.',
        'Прогоните все три сценария кнопками «Что зависло». Засчитывается настройка, при которой все три карточки зелёные.',
        'Ответьте на вопрос внизу и нажмите «Проверить».'
      ],
      look: `<p>Полоса — 45 минут воскресного вечера: зелёная минута — запись работает, красная — лежит, жёлтая — короткий сбой или перезапуск. Сетка — потоки ядра в 20:10: зелёные заняты записью и расписанием, синие — другими вызовами, красные ждут зависшую систему. С переборками сетка делится на отдельные пулы.</p><p>Четыре проверки: запись работает всё время; после подъёма всё восстанавливается само; чужой сбой не ломает лишнего и ничего не теряется; пока система лежит, мы её не добиваем.</p>`
    }),
    blank: () => ({ to: 'off', bh: 'off', cb: 'off', ex: 'sync', sc: 'onec', seen: [], q: [] }),
    reference: () => ({ to: 'on', bh: 'on', cb: 'on', ex: 'async', sc: 'onec', seen: SCN.map(s => 'on|on|on|async|' + s.v), q: quizRef([LAB_Q]) }),
    render(el, ctx) {
      el.classList.add('rlp-root');
      const a = ctx.ans; a.seen = a.seen || []; a.q = a.q || [];
      const mark = () => { const k = sigOf(a) + '|' + a.sc; if (!ctx.readonly && !a.seen.includes(k)) { a.seen.push(k); ctx.save(); } };
      mark();
      el.innerHTML = `<div class="stack">
        <div class="rlp-box">
          <div class="eyebrow">Защита ядра</div>
          <div class="rlp-set">
            <div class="lbl">Таймаут<small>на каждый внешний вызов</small></div>${ui.seg('to', O_TO, a.to, 'accent')}
            <div class="lbl">Переборка<small>пулы потоков</small></div>${ui.seg('bh', O_BH, a.bh, 'accent')}
            <div class="lbl">Предохранитель<small>на каждой зависимости</small></div>${ui.seg('cb', O_CB, a.cb, 'accent')}
            <div class="lbl">Выгрузка в 1С</div>${ui.seg('ex', O_EX, a.ex, 'accent')}
          </div>
        </div>
        <div class="stack tight"><div class="eyebrow">Что зависло в 20:03 на 40 минут</div>${ui.seg('sc', SCN.map(s => ({ v: s.v, t: `${s.t} · ${s.k}` })), a.sc)}</div>
        <div class="rlp-sc" data-cards></div>
        <div class="eyebrow">Запись на занятие, 20:00–20:45</div>
        <div data-strip></div>
        <div class="eyebrow">Потоки ядра в 20:10</div>
        <div data-pool></div>
        <div class="rlp-stats" data-st></div>
        <ul class="rlp-crit" data-crit></ul>
        <div class="card flat" data-q></div>
      </div>`;
      lock(TR.$('.rlp-box', el), ctx.readonly);
      function draw() {
        const r = simLab(a, a.sc), sig = sigOf(a);
        TR.$('[data-cards]', el).innerHTML = SCN.map(s => {
          const seen = a.seen.includes(sig + '|' + s.v), rr = simLab(a, s.v), bad = CRIT.filter(c => !rr.crit[c.id]).length;
          return `<div class="stat ${s.v === a.sc ? 'cur' : ''}"><span class="k">${esc(s.t)}</span><span class="v ${seen ? (rr.green ? 'ok' : 'bad') : ''}">${!seen ? '—' : rr.green ? 'держит' : rr.book === 'down' ? 'запись легла' : `не прошло проверок: ${bad}`}</span><span class="s small dim">${seen ? `потоков ядра ${rr.threads}` : 'ещё не прогнан с этими настройками'}</span></div>`;
        }).join('');
        TR.$('[data-strip]', el).innerHTML = stripHTML(r);
        TR.$('[data-pool]', el).innerHTML = poolsHTML(r.pools);
        const bk = { ok: ['ok', 'работает', 'потоки есть'], blip: ['warn', 'сбой ~' + fmtS(r.T), 'пока не сработал предохранитель'], down: ['bad', 'лежит 40 минут', 'потоки кончились'] }[r.book];
        TR.$('[data-st]', el).innerHTML = `
          <div class="stat"><span class="k">Запись</span><span class="v ${bk[0]}">${bk[1]}</span><span class="s">${bk[2]}</span></div>
          <div class="stat"><span class="k">Потоков ${a.bh === 'on' ? 'в пуле ядра' : 'занято'}</span><span class="v ${r.book === 'down' ? 'bad' : 'ok'}">${r.threads} из ${a.bh === 'on' ? BH_CORE : POOL}</span><span class="s">в 20:10</span></div>
          <div class="stat"><span class="k">Клиент видит</span><span class="v ${r.client[0]}" style="font-size:14px">${esc(r.client[1])}</span><span class="s">${esc(r.client[2])}</span></div>
          <div class="stat"><span class="k">${esc(LDEP[a.sc].t)} в это время</span><span class="v ${r.dep[0]}" style="font-size:14px">${esc(r.dep[1])}</span><span class="s">${esc(r.dep[2])}</span></div>`;
        TR.$('[data-crit]', el).innerHTML = CRIT.map(c => `<li class="${r.crit[c.id] ? 'ok' : 'bad'}"><b>${r.crit[c.id] ? '✓' : '✗'}</b><div><b>${esc(c.t)}</b><small>${r.notes[c.id] || esc(c.s)}</small></div></li>`).join('');
      }
      draw();
      ui.quiz(TR.$('[data-q]', el), Object.assign({}, LAB_Q, { value: a.q[0] || [], readonly: ctx.readonly, reveal: ctx.result, onChange: v => { a.q = [v]; ctx.save(); } }));
      ui.onSeg(el, (name, v) => {
        if (!['to', 'bh', 'cb', 'ex', 'sc'].includes(name)) return;
        if (ctx.readonly && name !== 'sc') return;
        a[name] = v; mark();
        if (!ctx.readonly) {
          ctx.save();
          if (name !== 'sc') ctx.decide('Защита ядра от зависшей зависимости', `таймаут: ${tOf(O_TO, a.to)}; переборка: ${tOf(O_BH, a.bh)}; предохранитель: ${tOf(O_CB, a.cb)}; выгрузка в 1С: ${tOf(O_EX, a.ex)}`);
        }
        draw();
      });
    },
    check(ans) {
      const sig = sigOf(ans), seen = ans.seen || [];
      const res = SCN.map(s => ({ s, r: simLab(ans, s.v), seen: seen.includes(sig + '|' + s.v) }));
      const greens = res.filter(x => x.r.green).length, seenAll = res.every(x => x.seen);
      const q = ui.quizScore(LAB_Q, (ans.q || [])[0] || []);
      const notes = [];
      res.forEach(({ s, r, seen: sn }) => {
        if (!sn) { notes.push({ ok: 'warn', html: `Сценарий «${esc(s.t)}» с этими настройками ещё не прогнан — нажмите его в «Что зависло».` }); return; }
        if (r.green) { notes.push({ ok: true, html: `«${esc(s.t)}»: держит по всем четырём проверкам.` }); return; }
        const miss = CRIT.filter(c => !r.crit[c.id]);
        const hint = {
          a: 'Запись простаивает. Что ограничит, сколько потоков может забрать одна зависшая система — даже в первые секунды?',
          b: 'После подъёма само не восстановится. Что заставит зависший вызов когда-нибудь закончиться?',
          c: 'Оплата ждёт бухгалтерию. Нужно ли клиенту, чтобы документ ушёл в 1С прямо во время оплаты?',
          d: 'Лежачую систему продолжают звать. Что перестанет её звать после серии ошибок?'
        };
        notes.push({ ok: false, html: `«${esc(s.t)}»: не прошло — ${miss.map(c => esc(c.t.toLowerCase())).join('; ')}. ${hint[miss[0].id]}` });
      });
      notes.push(q.ok ? { ok: true, html: 'Вопрос: верно — таймаут превращает зависание в ошибку, которую видит предохранитель.' } : { ok: false, html: 'Вопрос внизу: подумайте, что именно считает предохранитель и когда зависший вызов попадает в этот счёт.' });
      const score = greens / 3 * 0.6 + (seenAll ? 0.1 : 0) + q.score * 0.3;
      return {
        ok: greens === 3 && seenAll && q.ok, score, notes,
        summary: `Сценариев держит: ${greens} из 3.`,
        vera: greens === 3 ? null : 'Каждый слой закрывает свою дыру. Таймаут — «висит вечно». Переборка — «съел все потоки». Предохранитель — «долбим лежачего». Событие — «бухгалтерия на пути оплаты». Посмотрите, какая проверка красная, и спросите себя, какой слой её закрывает.'
      };
    },
    explain: `<p>Устойчива только настройка «всё включено», и каждый слой нужен для своего:</p>
      <ul class="checks">
        <li><b>Выгрузка событием</b> убирает 1С с пути оплаты: <code>PaymentSucceeded</code> уходит в Kafka, группа <code>onec-export</code> выгружает, когда 1С жива (у бухгалтерии и так окно 9–19). Документы ждут в журнале 7 дней — ничего не теряется.</li>
        <li><b>Таймаут</b> превращает «висит вечно» в ошибку: поток освобождается, предохранитель может её посчитать, и после подъёма всё оживает без перезапуска. Без таймаута не помогают ни предохранитель, ни переборка — в 2025-м «Пульс» перезапускали вручную.</li>
        <li><b>Переборка</b> держит первые секунды: пока предохранитель не разомкнулся, ПэйПоинт успевает занять 25/с × 10 с = 250 потоков — с обычной работой это больше 300. В своём пуле на 60 он забирает только свои 60.</li>
        <li><b>Предохранитель</b> перестаёт звать лежачего (раз в 30 с — пробный запрос) и даёт быстрый ответ: «оплата временно недоступна», «популярные занятия» вместо подборки.</li>
      </ul>
      <p>Обратите внимание: в аварии «ПэйПоинт завис» оплата не работает в любом случае — и это нормально. Цель не «ничего не ломается», а «ломается только то, без чего нельзя, и быстро, понятно, без каскада». Значения таймаутов (1С 3 с, ПэйПоинт 10 с, рекомендации 0,5 с) — тоже требования: их считают от обычного времени ответа и от того, сколько готов ждать клиент.</p>`,
    report: ans => {
      const sig = sigOf(ans);
      return `Таймаут: ${tOf(O_TO, ans.to)}; переборка: ${tOf(O_BH, ans.bh)}; предохранитель: ${tOf(O_CB, ans.cb)}; выгрузка в 1С: ${tOf(O_EX, ans.ex)}.\n` +
        SCN.map(s => { const r = simLab(ans, s.v); return `- ${s.t}: ${r.green ? 'держит' : 'не держит (' + CRIT.filter(c => !r.crit[c.id]).map(c => c.t.toLowerCase()).join('; ') + ')'}${(ans.seen || []).includes(sig + '|' + s.v) ? '' : ' — не прогнан'}`; }).join('\n') +
        `\nВопрос о таймауте и предохранителе: ${ui.quizScore(LAB_Q, (ans.q || [])[0] || []).ok ? 'верно' : 'неверно'}.`;
    }
  };

  // =====================================================================
  // Практика 2. Карта отказов: поведение каждой зависимости
  // =====================================================================
  const DEPS = [
    { id: 'psp', t: 'ПэйПоинт не отвечает', sub: 'клиент нажал «Оплатить абонемент», нужна ссылка на 3-D Secure прямо сейчас', ok: 'retry', crit: true,
      alt: { degrade: 'Это следующий шаг, если ПэйПоинт лежит долго: предохранитель разомкнут — кнопка оплаты честно говорит «временно недоступна». Но сначала — короткое ожидание и повтор.' },
      hint: 'Клиенту нужна ссылка на оплату сейчас — ни копии, ни «потом» тут не бывает. Можно ли безопасно спросить ещё раз?',
      why: 'Таймаут ~10 с (ПэйПоинт в пик думает долго), повтор с тем же <code>Idempotence-Key</code> — двойного платежа не будет. Не вышло — «Оплата временно недоступна, попробуйте через пару минут». Предохранитель — чтобы не ждать каждому.' },
    { id: 'sms', t: 'SMS-шлюз отвечает по 10 секунд', sub: 'коды входа и напоминания о занятиях; лимит шлюза 30 SMS/с', ok: 'defer',
      alt: { retry: 'Повтор при сбое нужен, но не в запросе клиента: держать поток 10 секунд — путь к каскаду. Повторы делает отправщик из очереди.' },
      hint: 'Должен ли запрос клиента и поток ядра ждать, пока шлюз думает 10 секунд?',
      why: 'Задача «отправь SMS» — в очередь RabbitMQ (код входа — с высоким приоритетом). Отправщик соблюдает лимит 30/с, повторяет с паузой. Клиенту — «код отправлен», а не крутилка.' },
    { id: 'onec', t: '1С зависла', sub: 'выгрузка оплат и возвратов для бухгалтерии', ok: 'defer', crit: true,
      hint: 'Нужен ли документ в 1С в ту же секунду, когда клиент платит? Когда бухгалтерия его читает?',
      why: 'Событие <code>PaymentSucceeded</code> в Kafka, группа <code>onec-export</code> выгружает пачками в окно 9–19. Лежит 1С — события ждут, номер документа = <code>public_id</code>, дублей нет.' },
    { id: 'recs', t: 'Рекомендации не отвечают', sub: 'блок «Вам подойдёт» на главном экране, 200 вызовов/с в пик', ok: 'fallback', crit: true,
      alt: { degrade: 'Тоже работает — блок просто скрыт. Но экран пустеет, а замена у рекомендаций есть дешёвая и полезная.' },
      hint: 'Есть ли чем заменить персональную подборку, чтобы экран не опустел?',
      why: 'Запасной вариант — «популярные занятия клуба» (заранее посчитанный список в кэше). Таймаут 0,5 с и предохранитель: в пик клиент не ждёт подборку.' },
    { id: 'bonus', t: 'Сервис бонусов лежит', sub: 'клиент покупает абонемент и хочет списать бонусы (до 30 % цены)', ok: 'degrade',
      alt: { retry: 'Короткий повтор допустим, но если «Бонусы» лежат — повторы не помогут, а клиент ждёт у кассы.' },
      hint: 'Можно ли продать абонемент без бонусов? Можно ли отложить списание, если от него зависит цена?',
      why: 'Выключаем только оплату бонусами: «Списать бонусы сейчас нельзя — оплатите картой, бонусы останутся на счёте». Покупка работает. Отложить нельзя — от списания зависит сумма к оплате.' },
    { id: 'partner', t: 'Ядро перегружено, а партнёры читают расписание', sub: 'ФитПасс и ещё 3 агрегатора — по 50 запросов/с и повторяют любую ошибку', ok: 'shed',
      alt: { fallback: 'Отдавать партнёрам расписание из кэша — правильно и в обычный день. Но когда ядро уже перегружено, лишние партнёрские запросы режут первыми.' },
      hint: 'Это отказ или перегрузка? Чьи запросы важнее для «Пульса» в эту минуту?',
      why: 'Партнёрский шлюз снижает лимит и отвечает <code>503</code> (или <code>429</code>) с <code>Retry-After</code>: ФитПасс всё равно повторит — пусть повторит позже. Свои клиенты записываются.' },
    { id: 'video', t: 'Видеосервис не отвечает', sub: 'начало онлайн-тренировки, 2 000 зрителей ждут эфир', ok: 'degrade',
      alt: { retry: 'Плеер переподключается с паузой — да. Но если сервис лежит, нужно честное «эфир временно недоступен».' },
      hint: 'Можно ли показать эфир без видеосервиса? Что из функции онлайн-тренировок работает и без него?',
      why: 'Деградация: «Эфир временно недоступен, запись появится позже». Запись на эфир, чат, расписание — работают. Своё видео «Пульс» не строит (DOMAIN-2 §7).' }
  ];
  function depsEval(v) {
    v = v || {};
    return DEPS.map(d => {
      const got = v[d.id];
      if (got === d.ok) return { d, s: 'ok', pts: 1 };
      if (d.alt && d.alt[got]) return { d, s: 'warn', pts: 0.5 };
      return { d, s: 'bad', pts: 0, empty: !got };
    });
  }
  const depsTask = {
    id: 'deps', title: 'Карта отказов: что делаем, когда лежит',
    simple: howDegrade.simple,
    lead: ui.brief({
      situation: 'Сергей собирает «карту отказов» ядра: для каждой внешней зависимости — что делаем, когда она лежит или тормозит. Антон: «Ответ “покажем ошибку” принимаю, только если доказано, что лучше нельзя». В каждой строке — кто ждёт и что ему нужно.',
      todo: [
        'Для каждой из семи зависимостей выберите поведение в выпадающем списке.',
        'Задайте себе три вопроса: нужен ли результат прямо сейчас? есть ли чем заменить? это отказ или перегрузка?',
        'Нажмите «Проверить». Засчитывается от 80 %, и три опорные строки — ПэйПоинт, 1С, рекомендации — должны быть верными. У некоторых строк есть второй допустимый ответ: он засчитывается наполовину, с пояснением.'
      ],
      lookTitle: 'Пять способов',
      look: BEH.map(b => `<b>${esc(b.t)}</b> — ${esc(b.d)}.`).join('<br>')
    }),
    blank: () => ({ v: {} }),
    reference: () => ({ v: Object.fromEntries(DEPS.map(d => [d.id, d.ok])) }),
    render(el, ctx) {
      el.classList.add('rlp-root');
      let reveal = null;
      if (ctx.result) { reveal = {}; depsEval(ctx.ans.v).forEach(x => { reveal[x.d.id] = { s: x.s, why: x.s === 'ok' ? x.d.why : x.s === 'warn' ? x.d.alt[(ctx.ans.v || {})[x.d.id]] : '' }; }); }
      ui.match(mount(el), {
        rows: DEPS.map(d => ({ id: d.id, t: `<b>${esc(d.t)}</b>`, sub: esc(d.sub) })), choices: BEH.map(b => ({ v: b.v, t: b.t })),
        value: ctx.ans.v || {}, reveal, readonly: ctx.readonly, placeholder: 'Что делаем…',
        onChange: v => { ctx.ans.v = v; ctx.save(); ctx.decide('Карта отказов', DEPS.map(d => `${d.t}: ${v[d.id] ? tOf(BEH, v[d.id]) : '—'}`).join('; ')); }
      });
      if (ctx.readonly) mount(el).innerHTML = '<div style="margin-top:12px">' + ui.table(['Зависимость', 'Поведение', 'Почему'], DEPS.map(d => [esc(d.t), esc(tOf(BEH, d.ok)), d.why + (d.alt ? `<div class="small dim">Допустимо наполовину: ${Object.keys(d.alt).map(k => esc(tOf(BEH, k))).join(', ')}.</div>` : '')])) + '</div>';
    },
    check(ans) {
      const ev = depsEval(ans && ans.v), pts = ev.reduce((s, x) => s + x.pts, 0), score = pts / DEPS.length;
      const critBad = ev.filter(x => x.d.crit && x.s !== 'ok'), notes = [];
      ev.forEach(x => {
        if (x.s === 'warn') notes.push({ ok: 'warn', html: `«${esc(x.d.t)}» — ${x.d.alt[(ans.v || {})[x.d.id]]}` });
        else if (x.s === 'bad') notes.push({ ok: false, html: `«${esc(x.d.t)}» — ${x.empty ? 'не выбрано. ' : ''}${x.d.hint}` });
      });
      if (!notes.length) notes.push({ ok: true, html: 'Все семь — по своим местам.' });
      return { ok: score >= 0.8 && !critBad.length, score, notes, summary: `Точно: ${ev.filter(x => x.s === 'ok').length} из ${DEPS.length}, допустимо: ${ev.filter(x => x.s === 'warn').length}.`, vera: critBad.length ? 'Начните с опорных. Оплате ссылка нужна сейчас. Бухгалтерии документ нужен не сейчас. Подборке есть замена.' : null };
    },
    explain: `<p>Карта отказов «Пульса»:</p>
      <ul class="checks">
        <li><b>Ждать и повторить</b> — только ПэйПоинт: ответ нужен сейчас, повтор безопасен благодаря ключу идемпотентности. И всё равно — таймаут и предохранитель.</li>
        <li><b>Отложить</b> — 1С и SMS: результат нужен не в ту же секунду. Событие в Kafka и задача в RabbitMQ.</li>
        <li><b>Запасной вариант</b> — рекомендации: популярные занятия.</li>
        <li><b>Деградация</b> — бонусы при покупке и видео: функция честно выключена, остальное живёт.</li>
        <li><b>Сброс</b> — партнёрские чтения при перегрузке: <code>503</code> + <code>Retry-After</code>.</li>
      </ul>
      <p>Эта таблица — артефакт аналитика: она попадает в постановку («что видит клиент при отказе X»), в тексты экранов и в тест-сценарии. Сергею она нужна для дежурства: какой рубильник нажимать и что считать нормой во время сбоя.</p>`,
    report: ans => depsEval(ans && ans.v).map(x => `- ${x.d.t} → ${(ans.v || {})[x.d.id] ? tOf(BEH, ans.v[x.d.id]) : '—'} ${x.s === 'ok' ? '✓' : x.s === 'warn' ? '≈' : '✗'}`).join('\n')
  };

  // =====================================================================
  // Практика 3. План деградации на пик
  // =====================================================================
  const SHED = [
    { id: 'recs', t: '«Вам подойдёт» — рекомендации на главном экране', sub: 'вместо них — популярные занятия клуба' },
    { id: 'live', t: '«Сколько людей в клубе» в реальном времени', sub: 'тысячи открытых SSE-соединений; вместо — «обычно в это время»' },
    { id: 'hist', t: 'История посещений и статистика в приложении', sub: 'тяжёлые выборки за 3 года' },
    { id: 'partner', t: 'Чтение расписания партнёрами', sub: 'ФитПасс и 3 агрегатора: лимит ниже, лишнее — 503 + Retry-After' },
    { id: 'bonus', t: 'Списание бонусов при покупке абонемента', sub: 'покупка — только картой, бонусы останутся на счёте' },
    { id: 'pay', t: 'Покупка и продление абонементов', sub: 'деньги и допуск к записи' },
    { id: 'book', t: 'Запись на занятие и расписание клуба', sub: 'ради неё всё и затевается' }
  ];
  const SHED_OK = SHED.map(s => s.id);
  const SIG_Q = {
    q: 'По какому сигналу включать ступени плана?', seed: 'rlp-sig',
    options: [
      { t: 'По симптомам для клиента: p95 записи подбирается к 300 мс или доля ошибок больше 1 % — ступени включаются автоматически, дежурный получает сигнал', ok: 1, why: 'Верно. Сигнал — то, что чувствует клиент. Автоматика успеет за секунды, человек — за минуты, а пик длится пять.' },
      { t: 'Когда загрузка процессора превысит 80 %', why: 'Процессор — причина, а не симптом. В прошлое воскресенье процессор отдыхал: все потоки ждали 1С. А при 85 % процессора запись может работать отлично.' },
      { t: 'Когда клиенты начнут жаловаться в поддержку', why: 'Поздно: жалобы приходят через 10–15 минут, а пик записи длится пять.' },
      { t: 'Вручную, когда Сергей заметит неладное', why: 'Дежурный нужен, но в пик он реагирует минутами. Ступени должны включаться сами, а человек — подтверждать и разбираться.' }
    ]
  };
  function shedEval(ans) {
    const v = (ans && ans.order && ans.order.length === SHED.length) ? ans.order : [];
    const os = v.length ? ui.orderScore(v, SHED_OK) : 0;
    const lastOk = v.length && v[v.length - 1] === 'book';
    const payOk = v.length && v.indexOf('pay') === SHED.length - 2;
    const cheapFirst = v.length && v.slice(0, 3).includes('recs') && v.slice(0, 3).includes('live');
    const q = ui.quizScore(SIG_Q, ans && ans.q || []);
    return { v, os, lastOk, payOk, cheapFirst, q };
  }
  const shedTask = {
    id: 'shed-plan', title: 'План деградации на пик',
    simple: {
      icon: '🎚️',
      plain: 'План деградации — заранее согласованный список: что выключаем первым, когда не хватает мощности, и что не выключаем никогда.',
      analogy: 'Пожарный план в клубе: сначала выводят людей из бассейна и сауны, потом из залов, а ресепшен уходит последним, потому что считает людей. Порядок решают заранее, а не во время пожара.',
      tech: 'Ступени деградации включаются рубильниками (флагами функций) — автоматически по симптомам (p95, доля ошибок) и вручную дежурным. Первыми — функции, которые дороги для системы и мало стоят клиенту; критичный путь (запись) — никогда.'
    },
    lead: ui.brief({
      situation: 'Воскресенье, 19:55. Через пять минут откроется запись на неделю — придут 20 000 человек, ~400 записей и ~1 000 чтений в секунду. Если нагрузка окажется больше, чем ждали, ядро будет выключать функции по одной — рубильниками. Ольга: «Только запись не трогайте. Остальное — как скажете, но объясните, почему в таком порядке».',
      todo: [
        'Расставьте семь функций: сверху — что выключаем первым, снизу — что не выключаем никогда. Перетаскивайте карточки или жмите стрелки.',
        'Для каждой спросите: сколько она стоит ядру в пик, что потеряет клиент без неё и есть ли замена?',
        'Ответьте, по какому сигналу включать ступени, и нажмите «Проверить».'
      ],
      lookTitle: 'Как проверяется',
      look: 'Засчитывается, когда порядок совпадает с эталоном хотя бы на 80 % пар, запись стоит последней, а сигнал выбран верно. Соседние «дешёвые» функции можно поменять местами — балл почти не снизится.'
    }),
    blank: () => ({ order: [], q: [] }),
    reference: () => ({ order: SHED_OK.slice(), q: quizRef([SIG_Q])[0] }),
    render(el, ctx) {
      el.classList.add('rlp-root');
      let reveal = null;
      if (ctx.result && ctx.ans.order && ctx.ans.order.length === SHED.length) {
        reveal = {};
        ctx.ans.order.forEach((id, i) => { const j = SHED_OK.indexOf(id); reveal[id] = Math.abs(i - j) <= 1 ? 'ok' : 'bad'; });
      }
      mount(el).innerHTML = '<div class="row between small dim" style="margin-bottom:6px"><span>↑ выключаем первым</span><span>не выключаем никогда ↓</span></div>';
      ui.order(mount(el), {
        items: SHED.map(s => ({ id: s.id, t: `<b>${esc(s.t)}</b>`, sub: esc(s.sub) })), value: ctx.ans.order, reveal, readonly: ctx.readonly, seed: 'rlp-plan',
        onChange: v => { ctx.ans.order = v; ctx.save(); if (!ctx.readonly) ctx.decide('План деградации на пик', v.map((id, i) => `${i + 1}. ${SHED.find(s => s.id === id).t}`).join('; ')); }
      });
      const q = mount(el, 'card flat'); q.style.marginTop = '12px';
      ui.quiz(q, Object.assign({}, SIG_Q, { value: ctx.ans.q || [], readonly: ctx.readonly, reveal: ctx.result, onChange: v => { ctx.ans.q = v; ctx.save(); } }));
    },
    check(ans) {
      const e = shedEval(ans), notes = [];
      if (!e.v.length) return { ok: false, score: 0, notes: [{ ok: false, html: 'Расставьте функции по порядку.' }], summary: 'Порядок не задан.' };
      notes.push({ ok: e.os >= 0.8, html: `Совпадение порядка: ${Math.round(e.os * 100)} % пар.` });
      if (!e.lastOk) notes.push({ ok: false, html: 'Внизу должна стоять функция, ради которой всё затевается в воскресенье 20:00. Что это?' });
      if (e.lastOk && !e.payOk) notes.push({ ok: 'warn', html: 'Что идёт сразу перед записью? Без какой функции часть клиентов не сможет записаться вовсе?' });
      if (!e.cheapFirst) notes.push({ ok: false, html: 'Первыми выключают то, что дорого для системы и легко заменяется: какие две функции приложения дают тысячи запросов и соединений, но клиент почти не заметит их пропажи?' });
      notes.push(e.q.ok ? { ok: true, html: 'Сигнал выбран верно: симптомы для клиента и автоматика.' } : { ok: false, html: 'Сигнал: подумайте, что чувствует клиент и сколько длится пик.' });
      const score = e.os * 0.55 + (e.lastOk ? 0.15 : 0) + e.q.score * 0.3;
      return { ok: e.os >= 0.8 && e.lastOk && e.q.ok, score, notes, summary: `Порядок: ${Math.round(e.os * 100)} %, запись ${e.lastOk ? 'последней' : 'не последней'}.` };
    },
    explain: `<p>Эталонный порядок и логика:</p>
      <ol>
        <li><b>Рекомендации</b> — 200 вызовов/с к другому сервису, а замена готова (популярные занятия).</li>
        <li><b>«Сколько людей в клубе»</b> — тысячи открытых SSE-соединений; клиент не потеряет ничего важного, увидит «обычно в это время».</li>
        <li><b>История посещений</b> — тяжёлые выборки, в воскресенье 20:00 их никто не ждёт.</li>
        <li><b>Партнёрские чтения</b> — ниже лимит, 503 + <code>Retry-After</code>: ФитПасс всё равно повторит. Партнёров режут позже своих «украшений», потому что их клиенты тоже записываются.</li>
        <li><b>Бонусы при покупке</b> — покупка остаётся, только картой.</li>
        <li><b>Покупка абонементов</b> — без неё часть клиентов не запишется; выключать только в крайнем случае.</li>
        <li><b>Запись</b> — никогда. Если и её не хватает мощности — это уже не деградация, а авария: масштабируемся (завтра).</li>
      </ol>
      <p>Включение — по симптомам и автоматически: p95 записи растёт к 300 мс → ступень 1, дальше → ступень 2… Каждая ступень — рубильник (флаг функции), который можно включить без релиза. Аналитик пишет, что видит клиент на каждой ступени, и согласует порядок с Ольгой заранее, а не в 20:01.</p>`,
    report: ans => {
      const e = shedEval(ans);
      return (e.v.length ? e.v.map((id, i) => `${i + 1}. ${SHED.find(s => s.id === id).t}`).join('\n') : 'Порядок не задан.') + `\nСигнал: ${(ans.q || []).length ? plainT(SIG_Q.options[ans.q[0]].t) : '—'} ${e.q.ok ? '✓' : '✗'}`;
    }
  };

  // =====================================================================
  // Практика 4. Требования к отказоустойчивости записи
  // =====================================================================
  const REQ_RUBRIC = [
    'Цели в цифрах: доступность записи 99,9 % в месяц (≈ 43 минуты), p95 ≤ 300 мс при 400 записях/с в воскресенье 20:00',
    'Запись синхронно ждёт только свою базу; 1С, уведомления, бонусы, рекомендации, аналитика узнают о записи событием после неё',
    'Каждый оставшийся внешний вызов ядра — с таймаутом, в своём пуле (переборка) и за предохранителем; повтор — только безопасный (идемпотентный)',
    'Поведение при отказе каждой зависимости: запасной вариант, деградация, отложить через очередь или честная ошибка — по карте отказов',
    'План деградации и сброс нагрузки: порядок ступеней, запись — последней; некритичным — 503 с Retry-After; включение автоматически по симптомам',
    'Что видит клиент при каждом отказе: понятный текст вместо «что-то пошло не так»',
    'Как проверяем: сценарии отказов (1С зависла на 40 минут в 20:03, ПэйПоинт не отвечает) на нагрузочном стенде или учениях до пика; алерты по симптомам'
  ];
  const REQ_REF = `<p><b>Требования к отказоустойчивости: запись на занятие</b></p>
    <ol>
      <li>Доступность записи — 99,9 % в месяц; в воскресенье 20:00 при 400 записях/с p95 ответа ≤ 300 мс.</li>
      <li>Запись синхронно обращается только к базе ядра (места, абонемент, запись — одна транзакция). Уведомления, бонусы, рекомендации, аналитика, партнёры и выгрузка в 1С получают событие <code>BookingCreated</code> / <code>PaymentSucceeded</code> через outbox и Kafka.</li>
      <li>Каждый внешний синхронный вызов ядра имеет таймаут (ПэйПоинт 10 с, рекомендации 0,5 с), отдельный пул потоков и предохранитель; повтор — только с ключом идемпотентности.</li>
      <li>При отказе: рекомендации → популярные занятия; бонусы → покупка только картой; видео → «эфир временно недоступен»; 1С и SMS → очередь, догоняем после подъёма; ПэйПоинт → «оплата временно недоступна, попробуйте позже».</li>
      <li>План деградации на пик: рекомендации → «сколько людей в клубе» → история посещений → лимит партнёров → бонусы → покупка; запись не отключается. Ступени включаются автоматически, когда p95 записи приближается к 300 мс или ошибок больше 1 %; некритичные запросы получают 503 с <code>Retry-After</code>.</li>
      <li>Клиент видит понятные тексты: «Бонусы начислятся в течение часа», «Подборка обновится позже».</li>
      <li>Приёмка: на нагрузочном стенде 1С «зависает» на 40 минут в 20:03 — запись отвечает с p95 ≤ 300 мс, выгрузка догоняет после подъёма без перезапуска; то же для ПэйПоинта и рекомендаций. Учения раз в квартал, алерты — на ошибки и задержку записи.</li>
    </ol>`;
  const reqTask = {
    id: 'req', title: 'Требования к отказоустойчивости записи',
    simple: {
      icon: '📋',
      plain: 'Требование к надёжности — не «система должна быть надёжной», а проверяемые обещания: что работает при каком отказе, как быстро и что видит клиент.',
      analogy: 'Договор с охранной фирмой: не «охранять хорошо», а «приехать за 7 минут после сигнала, раз в квартал учения, при отключении света — резервное питание 4 часа».',
      tech: 'Нефункциональные требования к отказоустойчивости: SLO (доступность, задержка), изоляция критичного пути, поведение при отказе каждой зависимости, план деградации, сценарии отказов как критерии приёмки, учения на отказ.'
    },
    lead: ui.brief({
      situation: 'Лена готовит постановку «Запись на занятие, сезон 2». Раздел «Требования к отказоустойчивости» — ваш. Сергей прочитает его на проверяемость, Антон — на архитектуру, Ольга — на «что увидит клиент».',
      todo: [
        'Напишите 6–10 пунктов требований (от 350 символов).',
        'Опирайтесь на лабораторию, карту отказов и план деградации: цели в цифрах, что запись не ждёт синхронно, защита внешних вызовов, поведение при отказах, деградация и сброс нагрузки, тексты для клиента, как проверяем.',
        'Нажмите «Проверить с Верой (Claude)» или «Сверить с эталоном самому» и отметьте, что прозвучало. Засчитывается от 60 %.'
      ],
      lookTitle: 'Подсказка',
      look: 'Хорошее требование проверяемо: «при зависании 1С на 40 минут в 20:03 запись отвечает с p95 ≤ 300 мс, выгрузка догоняет после подъёма без перезапуска». Плохое — «система должна быть отказоустойчивой».'
    }),
    blank: () => ({ j: { text: '' } }),
    reference: () => ({ j: { text: plainT(REQ_REF).replace(/\s+/g, ' ').trim(), self: REQ_RUBRIC.map(() => true) } }),
    render(el, ctx) {
      el.classList.add('rlp-root');
      el.insertAdjacentHTML('beforeend', ui.say('sergey', 'Только без «система должна быть надёжной». Мне нужно то, что я смогу проверить на стенде и в алертах.'));
      const j = mount(el); j.style.marginTop = '12px';
      ui.justify(j, {
        id: 'rlp-req', q: 'Требования к отказоустойчивости записи на занятие', qPlain: 'Напишите требования к отказоустойчивости записи на занятие в «Пульсе»: цели в цифрах, изоляция записи от внешних систем, защита внешних вызовов, поведение при отказах, деградация и сброс нагрузки, что видит клиент, как проверяем.',
        rubric: REQ_RUBRIC, reference: REQ_REF, value: ctx.ans.j, readonly: ctx.readonly, minLen: 350,
        onChange: v => { ctx.ans.j = v; ctx.save(); ctx.decide('Требования к отказоустойчивости записи', v.text || ''); }
      });
    },
    check(ans) {
      const s = ui.justifyScore(ans && ans.j), txt = String((ans.j || {}).text || ''), notes = [];
      if (txt.trim().length < 350) notes.push({ ok: false, html: 'Пока коротко: семь тем в 350 символов не уместить.' });
      else if (!(ans.j.self || ans.j.ai)) notes.push({ ok: 'warn', html: 'Сверьте текст с эталоном (кнопка под полем) или проверьте с Верой.' });
      else notes.push({ ok: s >= 0.6, html: `Покрыто критериев: ${Math.round(s * 100)} %.` });
      if (txt.trim().length >= 350 && !/\d/.test(txt)) notes.push({ ok: 'warn', html: 'Ни одной цифры. Как Сергей проверит «быстро» и «надёжно»?' });
      return { ok: s >= 0.6, score: s, notes, summary: s ? `Оценка: ${Math.round(s * 100)} %.` : 'Напишите требования и сверьте с эталоном.' };
    },
    explain: '<p>Сильный раздел — это обещания, которые можно проверить: цифры (99,9 %, 300 мс, 400/с), изоляция критичного пути, поведение при каждом отказе, порядок деградации и сценарии приёмки. Последний пункт важнее всего: требование «переживаем зависание 1С» без учений — пожелание. Сценарий «1С зависла в 20:03 на 40 минут» станет тестом на стенде и пунктом квартальных учений.</p><p>Обратите внимание, чего в требованиях нет: «использовать Resilience4j», «пул на 60 потоков». Это решения разработчиков и архитектора. Аналитик фиксирует <b>что</b> и <b>насколько</b>, а значения таймаутов согласует с ними — от обычного времени ответа и терпения клиента.</p>',
    report: ans => `Требования (текст студента):\n> ${String((ans.j || {}).text || '—').replace(/\n/g, '\n> ')}\nСамооценка: ${Math.round(ui.justifyScore(ans.j) * 100)} %.`
  };

  // =====================================================================
  TR.stage({
    id: ID, act: 7, order: 410, slot: 'Пн 10:00', title: 'Отказоустойчивость',
    when: 'понедельник, 10:00 · переговорная «Сайкл» · разбор аварии с Сергеем и Антоном',
    intro: [
      { who: 'sergey', html: 'Постмортем прошлого воскресенья. 20:03, пик записи — у франчайзи зависла 1С. Ядро при каждой оплате синхронно отправляло в 1С документ, в общем пуле потоков и без таймаута. Через полторы минуты все 300 потоков ждали 1С: запись, расписание, оплата — всё отвечало ошибкой. Лежали 40 минут, пока не перезапустили ядро с выключенной выгрузкой.' },
      { who: 'anton', html: 'Таймауты и предохранитель вы проектировали на неделе 3 — для одного вызова. Сегодня смотрим на систему целиком: у ядра много внешних зависимостей, и зависнуть может любая. Нужна схема, при которой зависание любой из них не трогает запись.' },
      { who: 'vera', html: 'Ваша часть — требования: что критично, что видит клиент при каждом отказе, что выключаем в пик и как это проверить. Сначала покрутим модель пула потоков и способы отвечать на отказ, потом — лаборатория на том самом воскресенье.' }
    ],
    facts: ['F-availability', 'F-week-open', 'F-1c-soap', 'F-psp-slow', 'F-sms', 'F-live', 'F-fitpass-tech'],
    glossary: [
      { term: 'Переборка (bulkhead)', simple: 'Отсеки в трюме корабля: пробоина топит один отсек, а не весь корабль. На звонки в бухгалтерию — свои 10 администраторов, остальные записывают на занятия.', tech: 'Отдельный пул потоков или соединений на каждую внешнюю зависимость. Зависшая система забирает только свой пул; лишние вызовы к ней сразу получают отказ. Цена — пулы надо рассчитать, общий запас делится.' },
      { term: 'Запасной вариант (fallback)', simple: 'Прачечная не привезла полотенца — выдаём из запаса.', tech: 'Ответ-замена при отказе зависимости: сохранённая копия, кэш, значение по умолчанию, упрощённый результат (популярные занятия вместо персональной подборки). Должен быть дешёвым и сам не зависеть от сломанной системы.' },
      { term: 'Плавная деградация', simple: 'Сауна не работает — висит табличка, а клуб открыт.', tech: 'Graceful degradation: при отказе или перегрузке система отключает второстепенные функции и продолжает выполнять главные. Что и в каком порядке отключать — требование, согласованное заранее.' },
      { term: 'Сброс нагрузки (load shedding)', simple: 'В час пик администратор сначала записывает пришедших на занятие, а на вопросы о ценах просит зайти позже.', tech: 'При перегрузке сервер сразу отклоняет часть запросов (обычно 503 с Retry-After) по приоритету, не ставя их в очередь, — чтобы критичные запросы обслуживались вовремя. Без сброса перегрузка замедляет всех одинаково.' },
      { term: 'Быстрый отказ (fail fast)', simple: 'Лучше сразу сказать «бухгалтерия сегодня не работает», чем держать клиента у стойки полчаса.', tech: 'Отвечать отказом немедленно, когда успех заведомо невозможен (предохранитель разомкнут, пул зависимости полон, сервер перегружен), — не занимая потоки и не заставляя клиента ждать таймаута.' },
      { term: 'Закон Литтла', simple: 'Сколько людей стоит у стойки = сколько приходит в минуту × сколько минут обслуживают каждого.', tech: 'L = λ × W: среднее число запросов в системе равно интенсивности потока, умноженной на время обработки. 20 вызовов/с × 30 с ожидания = 600 занятых потоков. Главная формула для расчёта пулов.' },
      { term: 'Критичный путь', simple: 'То, ради чего клиент пришёл: в воскресенье 20:00 — записаться на занятие.', tech: 'Цепочка шагов главного сценария, от которых зависит результат для клиента и бизнеса. Всё, что можно, выносят с критичного пути (события, очереди), а оставшиеся зависимости защищают таймаутом, переборкой и предохранителем.' },
      { term: 'Рубильник функции (kill switch)', simple: 'Выключатель на щитке: обесточить сауну, не трогая весь клуб.', tech: 'Флаг функции, который отключает её в работающей системе без релиза — вручную дежурным или автоматически по симптомам. Основа плана деградации.' },
      { term: 'Учения на отказ (chaos engineering)', simple: 'Пожарная тревога по расписанию: проверяем, что все знают, куда бежать, пока пожара нет.', tech: 'Намеренное внесение сбоев (зависание зависимости, падение экземпляра) на стенде или осторожно в проде, чтобы проверить, что защита работает. Сценарии отказов из требований становятся планом учений.' }
    ],
    outro: 'Надёжность — не «ничего не ломается», а «сломалось — и никто, кроме дежурного, не заметил». Таймаут ограничивает ожидание, переборка не даёт одной беде съесть все потоки, предохранитель перестаёт добивать лежачего, событие убирает чужую систему с пути клиента, а план деградации заранее решает, чем жертвуем. Завтра — второй враг воскресенья: не сбой, а сама нагрузка. Масштабирование, кэш и соединения с базой.',
    tasks: [howCascade, howDegrade, labTask, depsTask, shedTask, reqTask]
  });
})();
