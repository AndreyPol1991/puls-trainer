/* Неделя 7, пятница 10:00: выкатка и аварии. Канон — _dev/DOMAIN-2.md §6 («Выкатка и аварии»), §3 (бонусы), §4 (схемы событий).
   Теория (живая): всё сразу / blue-green / канарейка с автооткатом — симулятор бага на N % запросов, канарейка по шагам;
   флаги функций по клубам и по проценту клиентов, аварийный выключатель, долг флагов;
   expand–contract на соседнем примере (переименование колонки trainer.name) и авария зоны доступности (RPO/RTO, PITR).
   Практика: лаборатория «выкатка бонусов», шаги миграции под бонусы и откат на каждом шаге,
   флаги для пяти функций сезона 2, требования к выкатке в постановке. */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc;
  const ID = 'rel-deploy';

  if (!document.getElementById('rld-css')) document.head.insertAdjacentHTML('beforeend', `<style id="rld-css">
    .rld-root, .rld-root .stack, .rld-root .stack > * { min-width: 0; }
    .rld-root :not(pre) > code { white-space: normal; overflow-wrap: anywhere; }
    .rld-root .seg button { white-space: normal; text-align: left; }
    .rld-box { display: grid; gap: 12px; padding: 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); min-width: 0; }
    .rld-box > * { min-width: 0; }
    .rld-set { display: grid; grid-template-columns: minmax(0, 200px) minmax(0, 1fr); gap: 8px 14px; align-items: center; }
    .rld-set > .lbl { font-size: 13.5px; color: var(--text-2); min-width: 0; }
    .rld-set > .lbl small { display: block; font-size: 12px; color: var(--text-muted); }
    .rld-set > .seg { justify-self: start; max-width: 100%; }
    .rld-set.dim > .seg { opacity: .45; }
    .rld-range { width: 100%; margin: 4px 0; accent-color: var(--accent); }
    .rld-cmp { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .rld-mc { text-align: left; cursor: pointer; font: inherit; color: inherit; width: 100%; }
    .rld-mc.cur, .rld-sc .stat.cur { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
    .rld-mc .v, .rld-sc .v { font-size: 15px; overflow-wrap: anywhere; }
    .rld-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .rld-stats .v { font-size: 15px; overflow-wrap: anywhere; }
    .rld-stats .s { overflow-wrap: anywhere; }
    .rld-sc { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .rld-tl { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 1px; align-items: end; }
    .rld-tl > span { position: relative; display: block; height: 58px; background: var(--surface-3); border-radius: 2px; }
    .rld-tl > span > i { position: absolute; left: 0; right: 0; bottom: 0; border-radius: 2px; background: var(--ok); }
    .rld-tl > span.warn > i { background: var(--warn); }
    .rld-tl > span.bad > i { background: var(--bad); }
    .rld-tl > span.off > i { background: transparent; }
    .rld-tl > span.mk { box-shadow: 0 0 0 2px var(--accent); z-index: 1; }
    .rld-axis { display: flex; justify-content: space-between; gap: 6px; font: 11px/1.2 var(--f-mono); color: var(--text-muted); }
    .rld-legend { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 12px; color: var(--text-2); }
    .rld-legend i { display: inline-block; width: 11px; height: 11px; border-radius: 2px; margin-right: 5px; vertical-align: -1px; }
    .rld-crit { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    .rld-crit li { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 8px; font-size: 13.5px; align-items: start; }
    .rld-crit li > b { font: 700 13px/1.4 var(--f-mono); text-align: center; }
    .rld-crit li.ok > b { color: var(--ok); } .rld-crit li.bad > b { color: var(--bad); }
    .rld-crit li small { display: block; color: var(--text-muted); font-size: 12.5px; }
    .rld-cities { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
    .rld-city { border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; background: var(--surface-2); display: grid; gap: 6px; min-width: 0; align-content: start; }
    .rld-city .h { display: flex; justify-content: space-between; gap: 6px; font-size: 12.5px; color: var(--text-2); }
    .rld-city .h span { font-family: var(--f-mono); }
    .rld-cells { display: flex; flex-wrap: wrap; gap: 4px; }
    .rld-club { width: 20px; height: 20px; padding: 0; border-radius: 5px; border: 1px solid var(--border-strong); background: var(--surface); cursor: pointer; background-image: linear-gradient(to top, var(--ok) var(--p, 0%), transparent var(--p, 0%)); }
    .rld-club.on { background: var(--ok); border-color: var(--ok); }
    .rld-club:disabled { cursor: default; }
    .rld-cities.killed .rld-club { background: var(--surface-3); border-color: var(--bad); background-image: none; }
    .rld-kill { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; padding: 10px 12px; border: 1px solid var(--bad); border-radius: 10px; background: var(--bad-soft); color: var(--bad); font-size: 13.5px; }
    .rld-who { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .rld-who .card { padding: 8px 10px; gap: 2px; font-size: 13px; }
    .rld-who .card.on { border-color: var(--ok); }
    .rld-dots { display: flex; flex-wrap: wrap; gap: 6px; }
    .rld-dots button { font: 600 12px/1 var(--f-mono); width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text-2); cursor: pointer; }
    .rld-dots button[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: var(--surface); }
    .rld-mig { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .rld-mig .card { gap: 6px; padding: 10px 12px; }
    .rld-colrow { display: grid; grid-template-columns: minmax(0, 110px) minmax(0, 1fr); gap: 8px; align-items: center; font-size: 13px; }
    .rld-colrow b { font-family: var(--f-mono); font-size: 12.5px; overflow-wrap: anywhere; }
    .rld-fill { height: 12px; border-radius: 4px; background: var(--surface-3); overflow: hidden; }
    .rld-fill i { display: block; height: 100%; background: var(--ok); }
    .rld-fill.stale i { background: var(--warn); }
    .rld-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .rld-zones { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .rld-zone { border: 1px solid var(--border-strong); border-radius: 12px; padding: 10px 12px; display: grid; gap: 6px; background: var(--surface-2); min-width: 0; }
    .rld-zone.down { border-color: var(--bad); background: var(--bad-soft); }
    .rld-zone .it { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; font-size: 13px; padding: 6px 8px; border-radius: 8px; background: var(--surface); border: 1px solid var(--border); }
    .rld-zone .it.bad { border-color: var(--bad); color: var(--bad); }
    .rld-zone .it.ok { border-color: var(--ok); }
    .rld-zone .it.warn { border-color: var(--warn); }
    .rld-btns { display: flex; flex-wrap: wrap; gap: 6px; }
    @media (max-width: 760px) {
      .rld-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .rld-cmp, .rld-sc, .rld-mig, .rld-zones, .rld-who { grid-template-columns: minmax(0, 1fr); }
    }
    @media (max-width: 640px) {
      .rld-set { grid-template-columns: minmax(0, 1fr); gap: 4px; }
      .rld-set > .lbl { margin-top: 8px; }
      .rld-tl > span { height: 44px; }
      .rld-axis span:nth-child(even) { display: none; }
    }
  </style>`);

  // ---------- общие помощники ----------
  const L = (id, t, sub) => ({ id, t, sub });
  const fresh = pane => { const d = document.createElement('div'); pane.appendChild(d); return d; };
  const mount = (el, cls) => { const d = document.createElement('div'); if (cls) d.className = cls; el.appendChild(d); return d; };
  const plainT = s => String(s || '').replace(/<[^>]+>/g, '');
  const tOf = (list, v) => { const x = list.find(o => o.v === v); return x ? plainT(x.t) : '—'; };
  const quizRef = QS => QS.map(cfg => cfg.options.map((o, i) => o.ok ? i : -1).filter(i => i >= 0));
  const nf = x => Math.round(x).toLocaleString('ru-RU');
  const pct = x => (x * 100).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' %';
  const clock = (h, add) => { const t = ((h * 60 + add) % 1440 + 1440) % 1440; return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
  const barH = sh => sh ? Math.round(14 + 86 * Math.sqrt(sh)) : 0;
  const sumBy = (arr, k) => arr.reduce((s, x) => s + x[k], 0);

  // пошаговые сценарии на ui.seq с переключателем вариантов
  function walk(el, cfg) {
    let cur = cfg.scenarios[0].id;
    el.innerHTML = `<div class="stack">${cfg.scenarios.length > 1 ? `<div class="row"><span class="small dim">Вариант:</span>${ui.seg('rld-wk', cfg.scenarios.map(s => ({ v: s.id, t: s.t })), cur, 'accent')}</div>` : ''}<div class="rld-wbox"></div><div class="rld-wsum"></div></div>`;
    const box = TR.$('.rld-wbox', el), sum = TR.$('.rld-wsum', el);
    function show(id) {
      cur = id; const sc = cfg.scenarios.find(s => s.id === id);
      box.innerHTML = ''; sum.innerHTML = '';
      ui.seq(mount(box), { lanes: sc.lanes, steps: sc.steps, title: sc.t, laneW: cfg.laneW || 150, hint: 'Нажимайте «Шаг →» и читайте пояснение под схемой.', onEnd() { sum.innerHTML = sc.sum ? ui.note(sc.sumKind || '', 'Итог', sc.sum) : ''; } });
    }
    ui.onSeg(el, (n, v) => { if (n === 'rld-wk') show(v); });
    show(cur);
  }
  // полоса минут: высота — доля трафика на новой версии, цвет — что с ней происходит
  function barsHTML(mins, mark) {
    return `<div class="rld-tl" style="--n:${mins.length}">${mins.map((x, i) => {
      const cls = !x.sh ? 'off' : x.f > 0.001 ? 'bad' : x.slow ? 'warn' : 'ok';
      return `<span class="${cls}${mark === i ? ' mk' : ''}"><i style="height:${barH(x.sh)}%"></i></span>`;
    }).join('')}</div>`;
  }
  function axisHTML(startH, len, marks) {
    return `<div class="rld-axis">${marks.map(m => `<span>${clock(startH, m)}</span>`).join('')}</div>`;
  }
  const LEGEND = `<div class="rld-legend"><span><i style="background:var(--ok)"></i>новая версия работает</span><span><i style="background:var(--warn)"></i>медленно: p95 &gt; 300 мс</span><span><i style="background:var(--bad)"></i>ошибки у клиентов</span><span><i style="background:var(--surface-3)"></i>новой версии нет</span><span>высота столбика — доля трафика на новой версии</span></div>`;

  // =====================================================================
  // Теория 1. Три способа выкатки и автоматический откат (соседний пример: новый поиск занятий)
  // =====================================================================
  const TH_R = 400, TH_H = 45, TH_BUG = [0.5, 1, 2, 5, 10, 20];
  const TH_M = [
    { v: 'all', t: 'Всё сразу', rb: 10, d: 'все 6 экземпляров ядра заменяют на новую версию', rbT: 'откат — выкатить старую версию заново, ~10 минут' },
    { v: 'bg', t: 'Blue-green', rb: 1, d: 'рядом поднято второе окружение, трафик переключают разом', rbT: 'откат — переключить обратно, секунды' },
    { v: 'canary', t: 'Канарейка 5 → 50 → 100 %', rb: 1, d: 'новая версия получает долю трафика, шаг каждые 15 минут', rbT: 'откат — убрать долю, секунды' }
  ];
  const thShare = (m, t) => m !== 'canary' ? 1 : t < 15 ? 0.05 : t < 30 ? 0.5 : 1;
  function thSim(m, bug, auto) {
    const D = TH_M.find(x => x.v === m).rb, mins = [];
    let trig = null, how = null, end = Infinity, cum = 0, saw = 0;
    for (let t = 0; t < TH_H; t++) {
      const sh = t > end ? 0 : thShare(m, t), nw = TH_R * sh, f = nw * bug / 100;
      mins.push({ sh, nw, f, slow: 0 }); cum += f; saw += nw;
      if (auto && how !== 'auto' && (trig === null || t < trig)) {
        const w = mins.slice(Math.max(0, t - 4)), wn = sumBy(w, 'nw'), wf = sumBy(w, 'f');
        if (wn >= 50 && wf / wn > 0.01) { trig = t; how = 'auto'; end = t + D; }
      }
      if (trig === null && cum >= 30) { trig = t + 15; how = 'manual'; end = trig + D; }
    }
    return { mins, trig, how, end, aff: sumBy(mins, 'f'), saw };
  }
  function drawRoll(pane) {
    const st = { k: 3, auto: 'on', m: 'canary' };
    pane.innerHTML = `<div class="stack">
      <div class="rld-box">
        <label class="field"><span>В новой версии падает: <b class="rld-kv"></b> поисков</span><input type="range" class="rld-range" min="0" max="${TH_BUG.length - 1}" step="1" value="${st.k}" aria-label="Доля запросов с ошибкой"></label>
        <div class="rld-set"><div class="lbl">Автоматический откат<small>ошибок у новой версии больше 1 % за окно 5 минут</small></div>${ui.seg('rld-auto', [{ v: 'off', t: 'нет — ждём жалоб' }, { v: 'on', t: 'есть' }], st.auto, 'accent')}</div>
      </div>
      <div class="small dim">Сравните три способа при одном и том же баге. Нажмите на карточку — внизу покажется, как шла выкатка минута за минутой.</div>
      <div class="rld-cmp"></div>
      <div class="eyebrow rld-tlt"></div>
      <div class="stack tight"><div class="rld-tlw"></div>${axisHTML(11, TH_H, [0, 15, 30, 45])}</div>
      ${LEGEND}
      <div class="rld-n"></div>
      <details class="more"><summary>Цена каждого способа</summary><div>${ui.table(['Способ', 'Кто видит баг', 'Откат', 'Чем платим'], [
        ['Всё сразу', 'все клиенты, сразу', 'новая выкатка старой версии, минуты', 'ничем — поэтому так и делают, пока не обожгутся'],
        ['Blue-green', 'все клиенты, пока не переключили обратно', 'переключение, секунды', 'вдвое больше серверов на время выкатки; обе версии работают с одной базой'],
        ['Канарейка', 'доля клиентов на текущем шаге', 'убрать долю, секунды', 'балансировщик по долям, хорошие метрики по версиям, выкатка идёт дольше']
      ])}</div></details>
    </div>`;
    function draw() {
      const bug = TH_BUG[st.k], auto = st.auto === 'on';
      TR.$('.rld-kv', pane).textContent = String(bug).replace('.', ',') + ' %';
      const R = {}; TH_M.forEach(m => { R[m.v] = thSim(m.v, bug, auto); });
      TR.$('.rld-cmp', pane).innerHTML = TH_M.map(m => {
        const r = R[m.v], n = Math.round(r.aff);
        return `<button type="button" class="stat rld-mc ${m.v === st.m ? 'cur' : ''}" data-rdm="${m.v}"><span class="k">${esc(m.t)}</span><span class="v ${n <= 10 ? 'ok' : n <= 60 ? 'warn' : 'bad'}">${nf(n)} ${TR.plural(n, 'клиент', 'клиента', 'клиентов')} с ошибкой</span><span class="s">${r.trig === null ? 'отката не было за 45 минут' : `${r.how === 'auto' ? 'автооткат' : 'откат вручную'} на ${r.trig}-й минуте · ${esc(m.rbT)}`}</span></button>`;
      }).join('');
      const r = R[st.m], m = TH_M.find(x => x.v === st.m);
      TR.$('.rld-tlt', pane).textContent = `Как шла выкатка: ${m.t} · 400 поисков в минуту`;
      TR.$('.rld-tlw', pane).innerHTML = barsHTML(r.mins, r.trig !== null && r.trig < TH_H ? r.trig : -1);
      let n;
      if (auto && bug <= 1) n = ui.note('warn', 'Баг ниже порога', `Ошибок ${String(bug).replace('.', ',')} %, а порог отката — «больше 1 %». Автоматика молчит, баг ловят по жалобам. Порог нельзя ставить «в ноль»: у любой версии есть фоновые ошибки. Маленькие баги ловят по бюджету ошибок за сутки — это уже наблюдаемость, вчерашняя тема.`);
      else if (st.m === 'all') n = ui.note('bad', 'Всё сразу', `Баг сразу получили все 400 клиентов в минуту. ${auto ? 'Автоматика заметила быстро, но откат — это новая выкатка старой версии: 10 минут ошибок у всех.' : 'Пока жалобы дошли до дежурного и он решился — прошло 15 минут, и ещё 10 минут выкатывали старую версию.'}`);
      else if (st.m === 'bg') n = ui.note('warn', 'Blue-green', `Переключение мгновенное в обе стороны: старая версия стоит рядом прогретая. Но в первые минуты баг видят <b>все</b> — радиус поражения такой же, как у «всё сразу», просто короче. ${auto ? '' : 'Без автоматики «короче» не получается: ждём жалоб.'}`);
      else n = auto ? ui.note('ok', 'Канарейка с автооткатом', `На шаге 5 % новая версия получает 20 поисков в минуту. Через ${r.trig === null ? '…' : r.trig + 1} мин у правила отката набралось 50 запросов, ошибок больше 1 % — балансировщик убрал долю. Задело ${nf(r.aff)} ${TR.plural(Math.round(r.aff), 'клиента', 'клиентов', 'клиентов')}, остальные 95 % ничего не заметили.`)
        : ui.note('bad', 'Канарейка без автоматики', `Канарейка без правила отката почти бесполезна: на 5 % баг тихо задевает по клиенту в минуту, жалоб мало — и выкатка спокойно идёт дальше, на 50 % и 100 %. Шаги дают время заметить, а замечать должна автоматика.`);
      TR.$('.rld-n', pane).innerHTML = n;
    }
    TR.on(pane, 'click', '[data-rdm]', (e, b) => { st.m = b.dataset.rdm; draw(); });
    TR.$('.rld-range', pane).addEventListener('input', e => { st.k = +e.target.value; draw(); });
    ui.onSeg(pane, (n, v) => { if (n === 'rld-auto') { st.auto = v; draw(); } });
    draw();
  }
  function drawCanaryWalk(pane) {
    const lc = [L('lb', 'Балансировщик', 'делит трафик'), L('old', 'Ядро 2.7', 'старая'), L('new', 'Ядро 2.8', 'новая'), L('mon', 'Мониторинг', 'правило отката'), L('srg', 'Сергей', 'дежурный')];
    const lb = [L('lb', 'Балансировщик', 'делит трафик'), L('blue', 'Синее', '2.7 · 6 экз.'), L('green', 'Зелёное', '2.8 · 6 экз.'), L('mon', 'Мониторинг', 'правило отката'), L('srg', 'Сергей', 'дежурный')];
    walk(pane, {
      laneW: 140,
      scenarios: [
        {
          id: 'bad', t: 'Канарейка ловит баг', lanes: lc, sumKind: 'ok',
          sum: 'Ошибку увидели 3 клиента из 400 в минуту, и откатил её не человек, а правило. Сергей узнал о проблеме уже после отката — и разбирается спокойно, днём.',
          steps: [
            { from: 'lb', to: 'new', t: '5 % поисков', note: 'Шаг 1: балансировщик отправляет на новую версию 5 % запросов — 20 поисков в минуту. Остальные 95 % идут на 2.7.' },
            { from: 'lb', to: 'old', t: '95 %', note: 'Старая версия работает как работала. Если с новой что-то не так — пострадают только эти 5 %.' },
            { from: 'new', to: 'mon', t: 'ошибки 5 %', kind: 'bad', note: 'Новая версия падает на каждом двадцатом поиске. Мониторинг считает ошибки <b>отдельно по версиям</b>: у 2.7 — 0,1 %, у 2.8 — 5 %.' },
            { from: 'mon', to: 'mon', t: 'окно 5 мин: 60 запросов,\nошибок 5 % > 1 %', kind: 'warn', note: 'Правило отката: «у новой версии ошибок больше 1 % или p95 больше 300 мс за окно 5 минут, и запросов в окне не меньше 50». Минимум запросов нужен, чтобы не откатывать из-за одной случайной ошибки.' },
            { from: 'mon', to: 'lb', t: 'откат: 0 % на 2.8', kind: 'bad', note: 'Правило срабатывает само. Балансировщик убирает новую версию из маршрута за секунды — никаких новых выкаток.' },
            { from: 'lb', to: 'old', t: '100 %', kind: 'ok', note: 'Все запросы снова на 2.7.' },
            { from: 'mon', to: 'srg', t: 'выкатка 2.8 остановлена', reply: true, note: 'Сергей получает уведомление: что откатили и почему. Его задача — понять причину, а не нажимать кнопку в панике в 20:00.' }
          ]
        },
        {
          id: 'ok', t: 'Канарейка без бага', lanes: lc, sumKind: 'ok',
          sum: 'Новая версия прошла три шага. На каждом — пауза и сравнение метрик со старой версией. Старую держат живой ещё час: откат остаётся мгновенным.',
          steps: [
            { from: 'lb', to: 'new', t: '5 %', note: 'Шаг 1: 5 % трафика. Проверяем, что новая версия вообще работает: ошибки, задержка, логи.' },
            { from: 'mon', to: 'mon', t: '15 минут: ошибок 0,1 %,\np95 180 мс', kind: 'ok', note: 'Пауза наблюдения. Метрики новой версии не хуже старой — можно дальше.' },
            { from: 'lb', to: 'new', t: '50 %', note: 'Шаг 2: половина трафика. Здесь проверяется то, что на 5 % не видно: нагрузка на базу, соединения, кэш, лимиты внешних систем.' },
            { from: 'mon', to: 'mon', t: '15 минут: в норме', kind: 'ok', note: 'Под настоящей нагрузкой новая версия держит.' },
            { from: 'lb', to: 'new', t: '100 %', kind: 'ok', note: 'Шаг 3: весь трафик на 2.8.' },
            { from: 'old', to: 'old', t: 'живёт ещё час', note: 'Старую версию не гасят сразу: если что-то всплывёт через 20 минут, откат — снова секунды.' }
          ]
        },
        {
          id: 'bg', t: 'Blue-green: переключить и вернуть', lanes: lb, sumKind: 'warn',
          sum: 'Откат за секунды — сильная сторона blue-green. Слабая: в первые минуты баг видят все, и на время выкатки нужно вдвое больше серверов. А база одна на оба окружения — её изменения должны подходить обеим версиям.',
          steps: [
            { from: 'lb', to: 'blue', t: '100 % трафика', note: 'Сейчас весь трафик идёт в синее окружение — версия 2.7.' },
            { from: 'green', to: 'green', t: 'развернули 2.8,\nпрогрели, тесты', note: 'Рядом поднято зелёное — полная копия на 6 экземпляров. Его проверяют без клиентов: автотесты, прогрев кэша.' },
            { from: 'lb', to: 'green', t: 'переключить 100 %', kind: 'warn', note: 'Переключение мгновенное — и сразу на всех.' },
            { from: 'green', to: 'mon', t: 'ошибки 5 %', kind: 'bad', note: 'Баг задевает каждого двадцатого из всех 400 клиентов в минуту.' },
            { from: 'mon', to: 'lb', t: 'вернуть на синее', kind: 'warn', note: 'Откат — тоже переключение. Синее окружение ещё живо и прогрето.' },
            { from: 'lb', to: 'blue', t: '100 %', kind: 'ok', note: 'За две минуты задело около 40 клиентов: меньше, чем при «всё сразу», но больше, чем у канарейки.' }
          ]
        }
      ]
    });
  }
  const howRollout = {
    id: 'how-rollout', covers: ['launch-lab', 'deploy-req'], title: 'Как это работает: всё сразу, blue-green и канарейка', free: true, noReset: true,
    simple: {
      icon: '🐤',
      plain: 'Ошибки в новой версии будут — вопрос, скольких клиентов они заденут и как быстро вы вернёте старую. Выкатывать можно всем сразу, переключением «рубильника» или маленькими долями.',
      analogy: 'Шахтёры брали с собой канарейку: она чувствует газ раньше людей. Новая версия сначала достаётся 5 % клиентов — это и есть канарейка. Если ей плохо, остальных в шахту не пускают. А blue-green — как два одинаковых зала: готовите второй, переводите всех разом, а если там что-то не так — переводите обратно.',
      tech: '<b>Всё сразу</b> (обычная замена экземпляров) — откат новой выкаткой. <b>Blue-green</b> — два окружения, переключение балансировщиком, откат за секунды, но баг видят все. <b>Канарейка (canary)</b> — доля трафика 5 → 50 → 100 % с паузами наблюдения. <b>Автоматический откат</b> — правило по симптомам SLO (доля ошибок, p95) отдельно для новой версии; срабатывает без человека. <b>Радиус поражения</b> — сколько клиентов заденет ошибка.'
    },
    lead: ui.brief({
      situation: 'Соседний пример. Будний день, 11:00. Выходит релиз ядра 2.8 с новым поиском занятий в приложении — 400 поисков в минуту. В новой версии спрятан баг: часть поисков падает с ошибкой 500. Посмотрим, сколько клиентов он заденет при каждом способе выкатки.',
      todo: [
        'Вкладка «Три способа»: оставьте баг 5 % и сравните три карточки. Потом выключите автоматический откат — что стало с канарейкой?',
        'Подвигайте ползунок бага от 0,5 % до 20 %. При каком значении автоматика перестаёт замечать баг и почему?',
        'Вкладка «По шагам»: пройдите три варианта — канарейка ловит баг, канарейка без бага, blue-green.'
      ],
      look: 'Карточки — сколько клиентов получили ошибку за 45 минут при каждом способе. Столбики внизу — минуты выбранного способа: высота — какая доля трафика шла на новую версию, красный — были ошибки, серый — новую версию уже откатили. Рамка вокруг столбика — минута, когда сработал откат.'
    }),
    render(el) {
      el.classList.add('rld-root');
      ui.tabs(mount(el), [
        { id: 'sim', t: 'Три способа', render: pane => drawRoll(fresh(pane)) },
        { id: 'walk', t: 'По шагам', render: pane => drawCanaryWalk(fresh(pane)) }
      ], 'sim');
    }
  };

  // =====================================================================
  // Теория 2. База при выкатке и при аварии (соседний пример: trainer.name → full_name; зона доступности)
  // =====================================================================
  const EC = [
    { t: 'Было', sql: '-- таблица trainer: id, name, …\n-- код v1 читает и пишет name', cols: [['name', 1, '']], code: [['v1', '100 %', 'читает и пишет name']], both: false, back: true,
      note: 'Задача: переименовать колонку <code>name</code> в <code>full_name</code>. Одной командой нельзя — посмотрите вкладку выше. Идём по шагам.', backT: 'Пока ничего не меняли.' },
    { t: '1. Расширить', sql: 'ALTER TABLE trainer ADD COLUMN full_name text;', cols: [['name', 1, ''], ['full_name', 0, 'новая, пустая']], code: [['v1', '100 %', 'о full_name не знает — и не мешает']], both: false, back: true,
      note: '<b>Expand</b>: добавляем новую колонку рядом со старой. Без значения по умолчанию это мгновенно — таблица не перезаписывается, долгой блокировки нет.', backT: 'Новую колонку можно просто не использовать: данных в ней ещё нет.' },
    { t: '2. Писать в обе', sql: '-- релиз v2 канарейкой:\n-- INSERT/UPDATE пишут и name, и full_name\n-- SELECT читает name', cols: [['name', 1, ''], ['full_name', 0.3, 'только новые и изменённые строки']], code: [['v1', '95 %', 'пишет только name'], ['v2', '5 %', 'пишет в обе, читает name']], both: true, back: true,
      note: 'Новый код пишет в обе колонки, но читает по-старому. Пока идёт канарейка, <b>v1 и v2 работают одновременно</b> — и обе довольны: старая колонка на месте.', backT: 'Откат на v1: name полная, ничего не теряем.' },
    { t: '3. Перенести старое', sql: 'UPDATE trainer SET full_name = name\n WHERE full_name IS NULL\n   AND id BETWEEN $1 AND $2;  -- пачками по 1 000', cols: [['name', 1, ''], ['full_name', 1, 'перенесено']], code: [['v2', '100 %', 'пишет в обе, читает name']], both: false, back: true,
      note: 'Переносим старые строки <b>пачками</b>: один огромный UPDATE — долгая транзакция, блокировки и нагрузка на реплики. И только когда v2 на 100 %: иначе v1 успеет написать строки без <code>full_name</code>.', backT: 'Новая колонка — копия старой. Откатывать нечего.' },
    { t: '4. Читать новое', sql: '-- релиз v3 канарейкой:\n-- SELECT читает full_name\n-- пишет по-прежнему в обе', cols: [['name', 1, ''], ['full_name', 1, 'теперь основная']], code: [['v2', '50 %', 'читает name'], ['v3', '50 %', 'читает full_name, пишет в обе']], both: true, back: true,
      note: 'Переключаем чтение. <b>v2 и v3 снова живут вместе</b> — и снова обе колонки полные, каждой версии хватает своей.', backT: 'Откат на v2 без потерь: name по-прежнему заполняется.' },
    { t: '5. Перестать писать старое', sql: '-- релиз v4:\n-- пишет только full_name', cols: [['name', 1, 'устаревает'], ['full_name', 1, 'основная']], code: [['v3', '5 %', 'читает full_name'], ['v4', '95 %', 'пишет только full_name']], both: true, back: true, stale: true,
      note: 'Старую колонку больше не пишут — она начинает отставать. Код, который её читает, уже не работает нигде.', backT: 'Откат на v3 без потерь: v3 читает full_name. А вот на v2 — уже нет: name отстаёт.' },
    { t: '6. Сузить', sql: '-- через 2 недели, когда точно не понадобится откат:\nALTER TABLE trainer DROP COLUMN name;', cols: [['full_name', 1, 'единственная']], code: [['v4', '100 %', '']], both: false, back: false,
      note: '<b>Contract</b>: удаляем старую колонку. Это <b>точка невозврата</b> — поэтому последним шагом и с паузой в недели, когда откат на старые версии больше не понадобится.', backT: 'Откатить код на версии, читающие name, нельзя: колонки нет. Только вперёд.' }
  ];
  function drawEC(pane) {
    const st = { mode: 'ec', i: 0 };
    pane.innerHTML = `<div class="stack">
      <div class="row"><span class="small dim">Как переименовать:</span>${ui.seg('rld-ecm', [{ v: 'alter', t: 'Одним ALTER RENAME' }, { v: 'ec', t: 'Expand–contract по шагам' }], st.mode, 'accent')}</div>
      <div class="rld-ecb"></div>
    </div>`;
    const box = TR.$('.rld-ecb', pane);
    function drawAlter() {
      box.innerHTML = '';
      walk(mount(box), { laneW: 170, scenarios: [{
        id: 'alt', t: 'ALTER RENAME во время канарейки', lanes: [L('old', 'Ядро 2.7', '95 % трафика'), L('new', 'Ядро 2.8', '5 % трафика'), L('db', 'PostgreSQL', 'таблица trainer')], sumKind: 'bad',
        sum: 'Старый и новый код работают одновременно <b>всегда</b>: во время канарейки, blue-green и даже обычной замены экземпляров по одному. Значит, каждое состояние базы должно подходить и старому, и новому коду. Одна команда RENAME этому правилу не подчиняется.',
        steps: [
          { from: 'db', to: 'db', t: 'ALTER TABLE trainer\nRENAME name TO full_name', kind: 'warn', note: 'Релиз 2.8 переименовывает колонку одной командой. Сама команда быстрая, но берёт исключительную блокировку таблицы — если в этот момент идёт долгий запрос, все остальные встанут в очередь за ней.' },
          { from: 'new', to: 'db', t: 'SELECT full_name …', kind: 'ok', note: 'Новая версия довольна: колонка с новым именем есть.' },
          { from: 'old', to: 'db', t: 'SELECT name …', kind: 'bad', note: 'Старая версия ещё обслуживает 95 % запросов — и получает ошибку «column name does not exist».' },
          { from: 'db', to: 'old', t: '500 у 95 % запросов', reply: true, kind: 'bad', note: 'Кабинет тренера и расписание лежат почти у всех. Канарейка не защитила: сломали не новую версию, а старую.' },
          { from: 'old', to: 'old', t: 'откатить код на 2.7?', kind: 'warn', note: 'Откат кода не поможет: колонки name уже нет. Нужен обратный ALTER — ещё одна миграция, в аварийном режиме.' }
        ]
      }] });
    }
    function drawStep() {
      const s = EC[st.i];
      box.innerHTML = `<div class="stack">
        <div class="row between"><div class="rld-dots">${EC.map((x, i) => `<button type="button" data-rdi="${i}" aria-pressed="${i === st.i}" title="${esc(x.t)}">${i}</button>`).join('')}</div>
          <div class="row"><button type="button" class="btn sm ghost" data-rdn="-1" ${st.i === 0 ? 'disabled' : ''}>← Назад</button><button type="button" class="btn sm primary" data-rdn="1" ${st.i === EC.length - 1 ? 'disabled' : ''}>Дальше →</button></div></div>
        <b>${esc(s.t)}</b>
        ${ui.code(s.sql, 'sql')}
        <div class="rld-mig">
          <div class="card flat"><div class="eyebrow">База: колонки</div>${s.cols.map(c => `<div class="rld-colrow"><b>${esc(c[0])}</b><div><div class="rld-fill ${s.stale && c[0] === 'name' ? 'stale' : ''}"><i style="width:${Math.round(c[1] * 100)}%"></i></div><span class="small dim">${esc(c[2] || 'заполнена')}</span></div></div>`).join('')}</div>
          <div class="card flat"><div class="eyebrow">Работает сейчас</div>${s.code.map(c => `<div class="rld-colrow"><b>${esc(c[0])} · ${esc(c[1])}</b><span class="small">${esc(c[2] || '—')}</span></div>`).join('')}</div>
        </div>
        <div class="rld-chips">${s.both ? '<span class="chip warn">старый и новый код работают вместе</span>' : '<span class="chip">работает одна версия кода</span>'}${s.back ? '<span class="chip ok">откат без потери данных</span>' : '<span class="chip bad">точка невозврата</span>'}</div>
        ${ui.note(s.back ? '' : 'bad', '', s.note + ' <span class="dim">' + esc(s.backT) + '</span>')}
        ${st.i === EC.length - 1 ? ui.note('info', 'Итог', 'Шесть шагов вместо одной команды. Зато на каждом шаге, кроме последнего, можно откатиться без потери данных, а старый и новый код всегда находят свою колонку. Пятничное правило «Пульса» из канона: миграции только expand–contract, без блокирующих ALTER в пик.') : ''}
      </div>`;
    }
    function draw() { if (st.mode === 'alter') drawAlter(); else drawStep(); }
    TR.on(pane, 'click', '[data-rdi]', (e, b) => { st.i = +b.dataset.rdi; drawStep(); });
    TR.on(pane, 'click', '[data-rdn]', (e, b) => { st.i = Math.max(0, Math.min(EC.length - 1, st.i + (+b.dataset.rdn))); drawStep(); });
    ui.onSeg(pane, (n, v) => { if (n === 'rld-ecm') { st.mode = v; draw(); } });
    draw();
  }
  function drawZone(pane) {
    const st = { rep: 'sync', drill: 'yes', ev: 'none' };
    pane.innerHTML = `<div class="stack">
      <div class="rld-box">
        <div class="rld-set">
          <div class="lbl">Реплика в зоне B</div>${ui.seg('rld-rep', [{ v: 'sync', t: 'синхронная' }, { v: 'async', t: 'асинхронная' }], st.rep, 'accent')}
          <div class="lbl">Восстановление из бэкапа</div>${ui.seg('rld-drill', [{ v: 'yes', t: 'проверяем раз в квартал' }, { v: 'no', t: 'ни разу не проверяли' }], st.drill, 'accent')}
        </div>
        <div class="rld-btns"><button type="button" class="btn sm danger" data-rde="zone">💥 Зона A недоступна</button><button type="button" class="btn sm danger" data-rde="del">🗑 DELETE без WHERE в 14:20</button><button type="button" class="btn sm ghost" data-rde="none">⟲ Всё работает</button></div>
      </div>
      <div class="rld-zw"></div>
      <div class="rld-stats rld-zs"></div>
      <div class="rld-zn"></div>
    </div>`;
    function draw() {
      const z = st.ev === 'zone', d = st.ev === 'del', sync = st.rep === 'sync';
      const it = (t, s, cls) => `<div class="it ${cls || ''}"><span>${t}</span><span class="small">${s}</span></div>`;
      TR.$('.rld-zw', pane).innerHTML = `<div class="rld-zones">
        <div class="rld-zone ${z ? 'down' : ''}"><b>Зона доступности A</b>${it('Ядро × 3', z ? 'недоступно' : 'работает', z ? 'bad' : 'ok')}${it('PostgreSQL — мастер', z ? 'недоступен' : d ? 'таблица booking пуста' : 'принимает записи', z ? 'bad' : d ? 'bad' : 'ok')}</div>
        <div class="rld-zone"><b>Зона доступности B</b>${it('Ядро × 3', z ? 'держит весь трафик' : 'работает', z ? 'warn' : 'ok')}${it(`PostgreSQL — ${sync ? 'синхронная' : 'асинхронная'} реплика`, z ? 'стала мастером' : d ? 'DELETE доехал и сюда' : sync ? 'подтверждает каждую запись' : `отстаёт на ~2 с`, z ? (sync ? 'ok' : 'warn') : d ? 'bad' : 'ok')}</div>
      </div>
      <div class="rld-zone"><b>Бэкап</b>${it('Полный снимок раз в сутки + непрерывный архив журнала (WAL), 30 дней', d ? (st.drill === 'yes' ? 'восстанавливаем на 14:19:59' : 'архив WAL не пишется с 1 сентября') : 'на месте', d ? (st.drill === 'yes' ? 'warn' : 'bad') : '')}</div>`;
      let rpo, rto, saved, n;
      if (st.ev === 'none') { rpo = ['ok', '—', 'аварии нет']; rto = ['ok', '—', '']; saved = ['', '—', '']; n = ui.note('', 'Две зоны доступности', 'Зона доступности — отдельный дата-центр в том же регионе облака: своё питание, охлаждение, сеть. Ядро и база «Пульса» стоят в двух зонах. Нажмите на одну из аварий.'); }
      else if (z) {
        rpo = sync ? ['ok', '0', 'ни одной подтверждённой записи не потеряно'] : ['bad', '≈ 2 с', '≈ 14 записей и 1–2 оплаты, которые клиент видел как «прошли»'];
        rto = ['ok', '≈ 1–3 мин', 'переключение на реплику < 1 мин + балансировщик убирает зону A'];
        saved = ['ok', 'реплика в зоне B', 'не бэкап'];
        n = ui.note(sync ? 'ok' : 'bad', sync ? 'Пережили' : 'Пережили, но потеряли деньги', (sync ? 'Синхронная реплика подтверждает каждую запись раньше, чем клиент увидит «готово», — поэтому потерь нет (RPO = 0). ' : 'Асинхронная реплика отстаёт на секунды: всё, что мастер подтвердил за эти секунды, пропало вместе с зоной A. Для оплат «Пульса» это недопустимо — потерять оплату нельзя. ') + 'Важная мелочь: три экземпляра ядра в зоне B должны выдержать воскресный пик <b>одни</b>. Если запас считали на обе зоны вместе, аварию пережили, а от нагрузки легли.');
      } else {
        rpo = st.drill === 'yes' ? ['warn', '0 до ошибки', 'записи 14:20–14:31 дозаливаем из outbox и Kafka (7 дней)'] : ['bad', '≈ 33 дня', 'восстановить можно только на 1 сентября'];
        rto = st.drill === 'yes' ? ['warn', '≈ 40 мин', 'восстановление снимка + проигрывание журнала'] : ['bad', 'часы', 'и месяц данных вручную'];
        saved = st.drill === 'yes' ? ['ok', 'бэкап + PITR', 'реплика не помогла'] : ['bad', 'ничего', 'бэкап оказался пустым'];
        n = ui.note(st.drill === 'yes' ? 'warn' : 'bad', 'Реплика — не бэкап', st.drill === 'yes'
          ? 'DELETE без WHERE доехал до реплики за миллисекунды — переключение не спасает. Спасает восстановление на момент времени (PITR): вчерашний снимок + журнал изменений до 14:19:59. Это неделя 2, «Нагрузка и репликация». Записи после ошибки возвращаем из событий — ещё одна польза outbox и журнала Kafka.'
          : 'Бэкап, который ни разу не восстанавливали, — это надежда, а не бэкап. Архив журнала тихо перестал писаться месяц назад, и никто не заметил. Поэтому в каноне — учения по восстановлению раз в квартал: проверка, что из бэкапа правда поднимается база и сколько это занимает.');
      }
      TR.$('.rld-zs', pane).innerHTML = `
        <div class="stat"><span class="k">Потеряно данных (RPO)</span><span class="v ${rpo[0]}">${rpo[1]}</span><span class="s">${rpo[2]}</span></div>
        <div class="stat"><span class="k">Простой записи (RTO)</span><span class="v ${rto[0]}">${rto[1]}</span><span class="s">${rto[2]}</span></div>
        <div class="stat"><span class="k">Что спасло</span><span class="v ${saved[0]}">${saved[1]}</span><span class="s">${saved[2]}</span></div>
        <div class="stat"><span class="k">Цель «Пульса»</span><span class="v">RPO 0 · RTO ≤ 5 мин</span><span class="s">оплаты · запись на занятие</span></div>`;
      TR.$('.rld-zn', pane).innerHTML = n + ui.note('info', 'Позиция аналитика', 'RPO и RTO пишут в требования <b>для каждой функции отдельно</b>: оплата — ничего не терять (RPO = 0), запись — лежать не дольше 5 минут, отчёты директора — могут подождать часы. От этих цифр зависят реплики, бэкапы и цена инфраструктуры. И критерий приёмки: учения по восстановлению раз в квартал.');
    }
    TR.on(pane, 'click', '[data-rde]', (e, b) => { st.ev = b.dataset.rde; draw(); });
    ui.onSeg(pane, (n, v) => { if (n === 'rld-rep') { st.rep = v; draw(); } if (n === 'rld-drill') { st.drill = v; draw(); } });
    draw();
  }
  const howDb = {
    id: 'how-db', covers: ['migration'], title: 'Как это работает: база при выкатке и при аварии', free: true, noReset: true,
    simple: {
      icon: '🧩',
      plain: 'Код можно откатить за секунды, а базу — нет. Поэтому базу меняют маленькими шагами так, чтобы и старый, и новый код в любой момент находили свои данные. А на случай аварии заранее решают, сколько данных можно потерять и сколько можно лежать.',
      analogy: 'Переезд раздевалки: сначала ставят новые шкафчики рядом со старыми, неделю кладут вещи и туда, и туда, потом выдают ключи только от новых — и лишь в конце выносят старые. Если бы старые вынесли в первый день, половина клиентов осталась бы без вещей.',
      tech: '<b>Expand–contract</b> (были на неделе 3 для API): расширить схему → писать в обе формы → перенести данные пачками → читать новую → перестать писать старую → удалить старую. Каждое состояние базы совместимо с двумя соседними версиями кода. <b>RPO</b> — сколько данных можно потерять, <b>RTO</b> — сколько можно лежать (неделя 2). <b>Зона доступности</b> — отдельный дата-центр того же региона. <b>PITR</b> — восстановление на момент времени из снимка и журнала.'
    },
    lead: ui.brief({
      situation: 'Соседний пример. В таблице тренеров колонку <code>name</code> хотят переименовать в <code>full_name</code>. Выкатка — канарейкой, значит старый и новый код какое-то время работают одновременно. А во второй вкладке — что бывает, когда ломается не код, а целый дата-центр.',
      todo: [
        'Вкладка «Миграция»: сначала «Одним ALTER RENAME» — пройдите по шагам и посмотрите, кого сломала канарейка.',
        'Переключитесь на «Expand–contract по шагам» и пройдите шаги 0–6. На каких шагах старый и новый код работают вместе? Где появляется точка невозврата?',
        'Вкладка «Авария»: уроните зону A с синхронной и с асинхронной репликой. Потом — DELETE без WHERE, и с проверенным, и с непроверенным бэкапом.'
      ],
      look: 'В миграции: полоска у колонки — насколько она заполнена; жёлтая — колонка устаревает. Справа — какие версии кода сейчас работают и в какой доле. Значки внизу: работают ли версии вместе и можно ли откатиться без потери данных. В аварии: RPO — сколько данных потеряли, RTO — сколько лежали.'
    }),
    render(el) {
      el.classList.add('rld-root');
      ui.tabs(mount(el), [
        { id: 'mig', t: 'Миграция', render: pane => drawEC(fresh(pane)) },
        { id: 'zone', t: 'Авария', render: pane => drawZone(fresh(pane)) }
      ], 'mig');
    }
  };

  // =====================================================================
  // Теория 3. Флаги функций (соседний пример: экран «Мой прогресс»)
  // =====================================================================
  const CITIES = [['Москва', 26], ['Санкт-Петербург', 8], ['Казань', 6], ['Екатеринбург', 6], ['Нижний Новгород', 5], ['Самара', 3], ['Новосибирск', 3], ['Владивосток', 3]];
  const CLUBS = []; CITIES.forEach((c, ci) => { for (let i = 0; i < c[1]; i++) CLUBS.push({ id: ci + '-' + i, city: ci }); });
  const PER_CLUB = 5000, PCTS = [0, 1, 5, 10, 25, 50, 100];
  const PEOPLE3 = [{ n: 'Анна', b: 3 }, { n: 'Олег', b: 37 }, { n: 'Зарина', b: 81 }];
  function drawFlags(pane) {
    const st = { mode: 'club', on: new Set(['0-0', '0-1', '0-2']), k: 2, killed: false };
    pane.innerHTML = `<div class="stack">
      <div class="rld-box">
        <div class="rld-set"><div class="lbl">Флаг «Мой прогресс»<small>как решаем, кому показать</small></div>${ui.seg('rld-fm', [{ v: 'off', t: 'выключен' }, { v: 'club', t: 'по клубам' }, { v: 'pct', t: 'процент клиентов' }], st.mode, 'accent')}</div>
        <div class="rld-fctl"></div>
        <div class="row"><button type="button" class="btn sm danger" data-rdf="kill">⛔ Аварийно выключить</button><span class="small dim">выключатель работает поверх любого режима</span></div>
      </div>
      <div class="rld-fkill"></div>
      <div class="rld-cities"></div>
      <div class="rld-stats rld-fs"></div>
      <div class="rld-fn"></div>
    </div>`;
    function seeing() {
      if (st.killed || st.mode === 'off') return 0;
      if (st.mode === 'club') return st.on.size * PER_CLUB;
      return CLUBS.length * PER_CLUB * PCTS[st.k] / 100;
    }
    function draw() {
      TR.$('.rld-fctl', pane).innerHTML = st.mode === 'club'
        ? `<div class="rld-btns"><button type="button" class="btn xs" data-rdf="pilot">Пилот: 3 клуба Москвы</button><button type="button" class="btn xs" data-rdf="kzn">+ вся Казань</button><button type="button" class="btn xs" data-rdf="all">Все 60</button><button type="button" class="btn xs ghost" data-rdf="none">Никому</button><span class="small dim">или нажимайте на клубы</span></div>`
        : st.mode === 'pct'
          ? `<label class="field"><span>Видят функцию: <b>${PCTS[st.k]} %</b> клиентов в каждом клубе</span><input type="range" class="rld-range rld-fpr" min="0" max="${PCTS.length - 1}" value="${st.k}" aria-label="Процент клиентов"></label>
             <div class="rld-who">${PEOPLE3.map(p => { const on = !st.killed && p.b < PCTS[st.k]; return `<div class="card flat ${on ? 'on' : ''}"><b>${p.n}</b><span class="small dim">корзина ${p.b} из 100</span><span class="small">${on ? '✓ видит' : 'не видит'}</span></div>`; }).join('')}</div>`
          : '<span class="small dim">Функция выкачена, но спрятана: код есть везде, его ветка не выполняется.</span>';
      const fr = TR.$('.rld-fpr', pane); if (fr) fr.addEventListener('input', e => { st.k = +e.target.value; draw(); });
      TR.$('.rld-fkill', pane).innerHTML = st.killed ? `<div class="rld-kill"><span><b>Аварийно выключено в 20:04:31.</b> Без релиза — за секунды. Ветка функции не выполняется ни у кого.</span><button type="button" class="btn xs" data-rdf="unkill">Вернуть</button></div>` : '';
      const cities = TR.$('.rld-cities', pane);
      cities.classList.toggle('killed', st.killed);
      cities.innerHTML = CITIES.map((c, ci) => {
        const cl = CLUBS.filter(x => x.city === ci);
        const onN = st.mode === 'club' ? cl.filter(x => st.on.has(x.id)).length : 0;
        return `<div class="rld-city"><div class="h"><b>${esc(c[0])}</b><span>${st.mode === 'club' ? onN + '/' + c[1] : st.mode === 'pct' ? PCTS[st.k] + ' %' : '0/' + c[1]}</span></div><div class="rld-cells">${cl.map(x => {
          const on = !st.killed && st.mode === 'club' && st.on.has(x.id);
          const p = !st.killed && st.mode === 'pct' ? PCTS[st.k] : 0;
          return `<button type="button" class="rld-club ${on ? 'on' : ''}" style="--p:${p}%" data-rdc="${x.id}" ${st.mode !== 'club' || st.killed ? 'disabled' : ''} aria-label="Клуб ${esc(c[0])} ${x.id}" aria-pressed="${on}"></button>`;
        }).join('')}</div></div>`;
      }).join('');
      const n = seeing();
      TR.$('.rld-fs', pane).innerHTML = `
        <div class="stat"><span class="k">Видят функцию</span><span class="v ${n ? 'ok' : ''}">${nf(n)}</span><span class="s">из 300 000 клиентов</span></div>
        <div class="stat"><span class="k">Релизов для этого</span><span class="v ok">0</span><span class="s">флаг меняют в настройках</span></div>
        <div class="stat"><span class="k">Сколько ждать</span><span class="v ok">секунды</span><span class="s">приложения перечитывают флаги</span></div>
        <div class="stat"><span class="k">Код функции</span><span class="v">во всех клубах</span><span class="s">выкачен заранее, спрятан</span></div>`;
      TR.$('.rld-fn', pane).innerHTML = st.killed
        ? ui.note('bad', 'Выключатель аварии', 'Новая функция начала ронять что-то важное — например, тяжёлые запросы «Моего прогресса» грузят базу в воскресенье. Дежурный жмёт выключатель: без релиза, без отката всей версии — остальные изменения 2.8 продолжают работать.')
        : st.mode === 'club'
          ? ui.note('', 'Флаг по клубам', 'Включаем там, где готовы: персонал обучен, клиентам объяснили. Пилот в трёх клубах → город → вся сеть. Все клиенты одного клуба видят одно и то же — администратору не приходится объяснять, «почему у подруги есть, а у меня нет».')
          : st.mode === 'pct'
            ? ui.note('', 'Процент клиентов', 'Клиента относят к «корзине» от 0 до 99 по его <code>client_id</code> — всегда к одной и той же. Поэтому при 5 % Анна видит функцию каждый раз, а не через раз, а при 50 % к ней добавляется Олег. Так сравнивают «было — стало» (A/B) и постепенно переводят нагрузку.')
            : ui.note('', 'Выключен', 'Функция выкачена вместе с релизом, но спрятана. Выкатка кода и запуск функции разделены: код едет в будни днём канарейкой, а включают функцию, когда бизнес готов.');
    }
    TR.on(pane, 'click', '[data-rdc]', (e, b) => { const id = b.dataset.rdc; if (st.on.has(id)) st.on.delete(id); else st.on.add(id); draw(); });
    TR.on(pane, 'click', '[data-rdf]', (e, b) => {
      const c = b.dataset.rdf;
      if (c === 'kill') st.killed = true;
      else if (c === 'unkill') st.killed = false;
      else if (c === 'pilot') st.on = new Set(['0-0', '0-1', '0-2']);
      else if (c === 'kzn') CLUBS.filter(x => x.city === 2).forEach(x => st.on.add(x.id));
      else if (c === 'all') st.on = new Set(CLUBS.map(x => x.id));
      else if (c === 'none') st.on = new Set();
      draw();
    });
    ui.onSeg(pane, (n, v) => { if (n === 'rld-fm') { st.mode = v; draw(); } });
    draw();
  }
  const FLAG_NAMES = ['progress-screen', 'bonus-by-club', 'recs-model-v2', 'notify-new-service', 'online-watch', 'checkout-v3', 'dark-theme', 'referral-500'];
  function drawDebt(pane) {
    const st = { n: 3 };
    pane.innerHTML = `<div class="stack">
      <label class="field"><span>Флагов живёт в коде: <b class="rld-dn"></b></span><input type="range" class="rld-range" min="1" max="${FLAG_NAMES.length}" value="${st.n}" aria-label="Число флагов"></label>
      <div class="rld-dc"></div>
      <div class="rld-stats rld-ds"></div>
      <div class="rld-dno"></div>
    </div>`;
    function draw() {
      const n = st.n, combos = Math.pow(2, n);
      TR.$('.rld-dn', pane).textContent = n;
      TR.$('.rld-dc', pane).innerHTML = ui.code(FLAG_NAMES.slice(0, n).map((f, i) => `${'  '.repeat(Math.min(i, 3))}if (flags.on('${f}', client)) { … } else { … }`).join('\n'), 'js', 'Каждый флаг — развилка в коде');
      TR.$('.rld-ds', pane).innerHTML = `
        <div class="stat"><span class="k">Сочетаний поведения</span><span class="v ${combos > 16 ? 'bad' : combos > 4 ? 'warn' : 'ok'}">${nf(combos)}</span><span class="s">2 в степени ${n}</span></div>
        <div class="stat"><span class="k">Проверить все на стенде</span><span class="v ${combos > 16 ? 'bad' : 'warn'}">${nf(combos * 20 / 60)} ч</span><span class="s">по 20 минут на сочетание</span></div>
        <div class="stat"><span class="k">Шанс ошибиться флагом</span><span class="v ${n > 4 ? 'bad' : 'warn'}">${n > 4 ? 'высокий' : 'есть'}</span><span class="s">кто-то выключит не тот</span></div>
        <div class="stat"><span class="k">Правило</span><span class="v ok">владелец и срок</span><span class="s">у каждого флага</span></div>`;
      TR.$('.rld-dno', pane).innerHTML = ui.note(n > 4 ? 'bad' : 'warn', 'Долг флагов', `Флаг дёшев в день запуска и дорог через полгода: каждая развилка удваивает число вариантов поведения. Флаг выпуска (по клубам, по проценту) живёт <b>недели</b> — включили везде и удалили из кода. Выключатель аварии живёт долго, но таких мало и у каждого есть хозяин — обычно дежурный. В постановке аналитик пишет: какой флаг, кто владелец, когда удаляем.`);
    }
    TR.$('.rld-range', pane).addEventListener('input', e => { st.n = +e.target.value; draw(); });
    draw();
  }
  const howFlags = {
    id: 'how-flags', covers: ['flags'], title: 'Как это работает: флаги функций и аварийный выключатель', free: true, noReset: true,
    simple: {
      icon: '🎛️',
      plain: 'Флаг функции — переключатель в настройках: код новой функции уже выкачен, но работает только там, где флаг включён. Его можно включить в нескольких клубах, у части клиентов или выключить в аварии — без нового релиза.',
      analogy: 'Новый тренажёр привезли во все клубы сразу, но накрыли чехлом. Сначала снимают чехол в трёх клубах — смотрят, как идёт. Потом в городе, потом везде. А если тренажёр начал искрить — выдёргивают вилку из розетки, не увозя его обратно на склад.',
      tech: '<b>Флаг функции (feature flag)</b> — условие в коде, которое читает настройку во время работы. Виды: <b>флаг выпуска</b> (по клубам, городам), <b>процент клиентов</b> (стабильная корзина по <code>client_id</code>, A/B и постепенный перевод нагрузки), <b>выключатель аварии</b> (kill switch — рубильник с прошлого понедельника). Флаги отделяют выкатку кода от запуска функции. Цена — <b>долг флагов</b>: каждый удваивает число вариантов поведения.'
    },
    lead: ui.brief({
      situation: 'Соседний пример. В приложении появляется экран «Мой прогресс» — статистика тренировок клиента. Код выкачен во все 60 клубов, но кто его увидит, решает флаг.',
      todo: [
        'Вкладка «Флаг»: режим «по клубам» — включите пилот в трёх клубах Москвы, добавьте Казань, потом все 60. Сколько понадобилось релизов?',
        'Переключите на «процент клиентов» и подвигайте ползунок: в каком порядке функцию начинают видеть Анна, Олег и Зарина и почему порядок не меняется?',
        'Нажмите «Аварийно выключить». Что стало с функцией и с остальным релизом?',
        'Вкладка «Долг флагов»: подвигайте число флагов в коде. Почему флаги выпуска удаляют через недели?'
      ],
      look: 'Квадратик — клуб, ~5 000 клиентов. Зелёный — функция включена; в режиме процента квадратик залит снизу на долю клиентов, которые видят функцию. Красная рамка — сработал аварийный выключатель.'
    }),
    render(el) {
      el.classList.add('rld-root');
      ui.tabs(mount(el), [
        { id: 'flag', t: 'Флаг', render: pane => drawFlags(fresh(pane)) },
        { id: 'debt', t: 'Долг флагов', render: pane => drawDebt(fresh(pane)) }
      ], 'flag');
    }
  };

  // =====================================================================
  // Практика 1. Лаборатория «Выкатка бонусов»
  // =====================================================================
  const O_ST = [{ v: 'all', t: 'Всё сразу' }, { v: 'bg', t: 'Blue-green' }, { v: 'canary', t: 'Канарейка' }];
  const O_STEPS = [{ v: 'std', t: '5 → 50 → 100 %, шаг каждые 15 мин' }, { v: 'fast', t: '5 → 50 → 100 %, шаг каждые 2 мин' }, { v: 'skip', t: '5 → 100 % через 15 мин' }, { v: 'half', t: '50 → 100 % через 15 мин' }];
  const O_RB = [{ v: 'none', t: 'нет: Сергей откатит по жалобам' }, { v: 'cpu', t: 'автоматически, если CPU > 80 %' }, { v: 'slo', t: 'автоматически по SLO записи: ошибок > 1 % или p95 > 300 мс за 5 мин' }];
  const O_WIN = [{ v: 'wd11', t: 'будни, 11:00' }, { v: 'sun19', t: 'воскресенье, 19:00 — успеть к пику' }, { v: 'night', t: 'ночь на понедельник, 03:00 — никто не заметит' }];
  const WIN_H = { wd11: 11, sun19: 19, night: 3 };
  const SCN = [{ v: 'logic', t: 'Баг в логике', k: '6 % записей с бонусами падают с 500' }, { v: 'load', t: 'Медленнее под нагрузкой', k: 'на каждую запись — лишний запрос в «Бонусы»' }];
  const LCRIT = [
    { id: 'a', t: 'Задело не больше 10 клиентов', s: 'ошибка 500 или таймаут при записи' },
    { id: 'b', t: 'Поймали раньше, чем новую версию получили все', s: 'откат случился, пока на новой версии меньше 100 % трафика' },
    { id: 'c', t: 'Откат сам и за минуту', s: 'без человека и без новой выкатки' },
    { id: 'd', t: 'Окно релиза по правилам', s: 'не воскресенье 18–22, команда на месте' }
  ];
  const LH = 75;
  const sigOf = a => `${a.st}|${a.steps}|${a.rb}|${a.win}`;
  const lRate = (win, t) => win === 'wd11' ? 300 : win === 'night' ? 12 : (t >= 60 && t < 66 ? 4000 : 1500);
  function lShare(a, t) {
    if (a.st !== 'canary') return 1;
    if (a.steps === 'fast') return t < 2 ? 0.05 : t < 4 ? 0.5 : 1;
    if (a.steps === 'skip') return t < 15 ? 0.05 : 1;
    if (a.steps === 'half') return t < 15 ? 0.5 : 1;
    return t < 15 ? 0.05 : t < 30 ? 0.5 : 1;
  }
  function lEff(sc, nw) {
    if (sc === 'logic') return { f: nw * 0.06, slow: 0 };
    if (nw >= 250) return { f: nw * 0.3, slow: nw };
    if (nw >= 100) return { f: 0, slow: nw };
    return { f: 0, slow: 0 };
  }
  function lRun(a, sc, rate, shareFn, H) {
    const D = a.st === 'all' ? 10 : 1, mins = [];
    let trig = null, how = null, end = Infinity;
    for (let t = 0; t < H; t++) {
      const sh = t > end ? 0 : shareFn(t), nw = rate(t) * sh, e = lEff(sc, nw);
      mins.push({ sh, nw, f: e.f, slow: e.slow });
      if (a.rb === 'slo' && how !== 'auto' && (trig === null || t < trig)) {
        const w = mins.slice(Math.max(0, t - 4)), wn = sumBy(w, 'nw');
        if (wn >= 50 && (sumBy(w, 'f') / wn > 0.01 || sumBy(w, 'slow') / wn > 0.05)) { trig = t; how = 'auto'; end = t + D; }
      }
      if (trig === null && (sumBy(mins, 'f') >= 20 || sumBy(mins, 'slow') >= 600)) { trig = t + 15; how = 'manual'; end = trig + D; }
    }
    const trigShare = trig === null ? null : trig < H ? mins[trig].sh : shareFn(trig);
    return { mins, trig: trig !== null && trig < H ? trig : null, late: trig !== null && trig >= H, how, trigShare, D, fail: sumBy(mins, 'f'), slow: sumBy(mins, 'slow'), maxSh: Math.max(...mins.map(x => x.sh)) };
  }
  function simDeploy(a, sc) {
    const main = lRun(a, sc, t => lRate(a.win, t), t => lShare(a, t), LH);
    let morning = null;
    if (a.win === 'night' && main.trig === null) {
      const last = lShare(a, LH - 1);
      morning = lRun(a, sc, () => 300, () => last, 30);
    }
    const caught = main.trig !== null ? main : morning && morning.trig !== null ? morning : null;
    const fail = main.fail + (morning ? morning.fail : 0), slow = main.slow + (morning ? morning.slow : 0);
    const r = { main, morning, caught, fail, slow, crit: {} };
    r.crit.a = Math.round(fail) <= 10;
    r.crit.b = !!caught && caught.trigShare < 1;
    r.crit.c = !!caught && caught.how === 'auto' && main.D <= 1;
    r.crit.d = a.win === 'wd11';
    r.green = LCRIT.every(c => r.crit[c.id]);
    return r;
  }
  function labNotes(r, a) {
    const c = r.caught, n = Math.round(r.fail), N = {};
    const when = c ? `${c === r.morning ? 'утром в ' + clock(9, c.trig) : 'в ' + clock(WIN_H[a.win], c.trig)} на ${pct(c.trigShare)} трафика` : '';
    N.a = r.crit.a ? `Ошибку получили ${nf(n)} ${TR.plural(n, 'клиент', 'клиента', 'клиентов')}.` : `Ошибку получили ${nf(n)} ${TR.plural(n, 'клиент', 'клиента', 'клиентов')}: ${c ? 'откат ' + when : 'отката не было'}${r.morning && r.morning.fail > 1 ? ', и большая часть — утром понедельника, когда проснулись клиенты' : ''}.`;
    N.b = r.crit.b ? `Откат ${when}.` : c ? `Откат ${when} — новую версию к этому моменту получили все.` : 'Отката не было совсем.';
    N.c = r.crit.c ? 'Правило по SLO сработало само, балансировщик убрал новую версию за минуту.'
      : a.rb === 'cpu' ? 'Процессор бага не заметил: ошибки логики и ожидание «Бонусов» CPU не грузят. Откатывали по жалобам — плюс 15 минут.'
        : a.rb === 'none' ? 'Откат ждал жалоб и решения дежурного: плюс 15 минут к каждой аварии.'
          : a.st === 'all' ? 'Правило сработало, но откат при «всё сразу» — это новая выкатка старой версии: 10 минут ошибок у всех.' : 'Откат не случился.';
    N.d = r.crit.d ? 'Будний день, команда на месте, трафик ровный.'
      : a.win === 'sun19' ? 'Сергей запретил релизы в воскресенье 18–22: шаги выкатки въезжают в пик 20:00, трафик в 5–13 раз больше — и разбираться придётся во время пика.'
        : 'Ночью трафик в 25 раз меньше: на 5 % канарейка получает ползапроса в минуту — правилу отката не из чего сложить сигнал, а проблемы нагрузки ночью не проявляются вовсе. И разбираться некому до утра.';
    return N;
  }
  const LAB_Q = {
    q: 'Почему баг «медленнее под нагрузкой» не поймать на шаге 5 %?', seed: 'rld-lab-q',
    options: [
      { t: 'На 5 % новая версия получает около 15 записей в минуту — нагрузки, при которой проявляется проблема, ещё нет. Шаг 50 % — проверка под настоящей нагрузкой, но с откатом за минуту', ok: 1, why: 'Верно. Маленький шаг ловит ошибки логики, большой промежуточный — проблемы нагрузки: соединения, пулы, лимиты соседних сервисов.' },
      { t: 'На 5 % слишком мало клиентов, чтобы кто-то пожаловался', why: 'Жалобы тут ни при чём: правило отката смотрит на метрики. На 5 % метрики в норме — новая версия ещё не нагружена.' },
      { t: 'Автоматический откат умеет смотреть только на ошибки, а не на задержку', why: 'Правило отката «Пульса» смотрит и на долю ошибок, и на p95. На 5 % p95 просто в норме.' },
      { t: 'Проблемы скорости ловит только нагрузочный тест, выкатка тут ни при чём', why: 'Нагрузочный тест нужен, но прод всегда отличается от стенда. Шаги выкатки — последняя сетка безопасности.' }
    ]
  };
  const labTask = {
    id: 'launch-lab', title: 'Выкатка бонусов',
    simple: howRollout.simple,
    lead: ui.brief({
      situation: 'Ядро 3.0 с бонусной программой готово. Ольга анонсирует бонусы в понедельник. Сергей: «Никаких релизов в воскресенье с 18 до 22. И чтобы ошибка в новой версии задела десяток клиентов, а не 20 000». В будни днём к записи и оплате обращаются ~300 клиентов в минуту, в воскресенье с 19:00 — 1 500, в 20:00 — 4 000, ночью — 12. В новой версии спрятан баг — какой, заранее не знаем.',
      todo: [
        'Выберите способ выкатки, шаги канарейки, правило автоматического отката и время релиза.',
        'Прогоните оба варианта бага кнопками «Что спрятано в новой версии». Смотрите на полосу минут и на четыре проверки под ней.',
        'Засчитывается план, при котором обе карточки зелёные. Потом ответьте на вопрос внизу и нажмите «Проверить».'
      ],
      look: `<p>Полоса — 75 минут после начала выкатки: высота столбика — доля трафика на новой версии, красный — клиенты получают ошибку, жёлтый — медленные ответы, серый — новую версию откатили. Рамка — минута, когда сработал откат. Ночью под полосой появится ещё и утро понедельника.</p><p>Четыре проверки: задело не больше 10 клиентов; поймали раньше, чем новую версию получили все; откат сам и за минуту; окно релиза по правилам.</p>`
    }),
    blank: () => ({ st: 'all', steps: 'skip', rb: 'none', win: 'sun19', sc: 'logic', seen: [], q: [] }),
    reference: () => ({ st: 'canary', steps: 'std', rb: 'slo', win: 'wd11', sc: 'logic', seen: SCN.map(s => 'canary|std|slo|wd11|' + s.v), q: quizRef([LAB_Q]) }),
    render(el, ctx) {
      el.classList.add('rld-root');
      const a = ctx.ans; a.seen = a.seen || []; a.q = a.q || [];
      const mark = () => { const k = sigOf(a) + '|' + a.sc; if (!ctx.readonly && !a.seen.includes(k)) { a.seen.push(k); ctx.save(); } };
      mark();
      el.innerHTML = `<div class="stack">
        <div class="rld-box rld-lctl">
          <div class="eyebrow">План выкатки ядра 3.0</div>
          <div class="rld-set">
            <div class="lbl">Способ выкатки</div>${ui.seg('rld-st', O_ST, a.st, 'accent')}
            <div class="lbl rld-stepl">Шаги канарейки<small>только для канарейки</small></div>${ui.seg('rld-steps', O_STEPS, a.steps, 'accent')}
            <div class="lbl">Автоматический откат</div>${ui.seg('rld-rb', O_RB, a.rb, 'accent')}
            <div class="lbl">Когда начинаем</div>${ui.seg('rld-win', O_WIN, a.win, 'accent')}
          </div>
        </div>
        <div class="stack tight"><div class="eyebrow">Что спрятано в новой версии</div>${ui.seg('rld-sc', SCN.map(s => ({ v: s.v, t: `${s.t} · ${s.k}` })), a.sc)}</div>
        <div class="rld-sc rld-cards"></div>
        <div class="eyebrow rld-lt"></div>
        <div class="stack tight"><div class="rld-lbar"></div><div class="rld-lax"></div></div>
        <div class="rld-lmorn"></div>
        ${LEGEND}
        <div class="rld-stats rld-lst"></div>
        <ul class="rld-crit rld-lcrit"></ul>
        <div class="card flat rld-lq"></div>
      </div>`;
      if (ctx.readonly) TR.$$('.rld-lctl .seg button', el).forEach(b => { b.disabled = true; });
      function draw() {
        const r = simDeploy(a, a.sc), sig = sigOf(a), N = labNotes(r, a), h0 = WIN_H[a.win];
        TR.$('.rld-stepl', el).style.opacity = a.st === 'canary' ? '' : '.5';
        TR.$('.rld-cards', el).innerHTML = SCN.map(s => {
          const seen = a.seen.includes(sig + '|' + s.v), rr = simDeploy(a, s.v), bad = LCRIT.filter(c => !rr.crit[c.id]).length;
          return `<div class="stat ${s.v === a.sc ? 'cur' : ''}"><span class="k">${esc(s.t)}</span><span class="v ${seen ? (rr.green ? 'ok' : 'bad') : ''}">${!seen ? '—' : rr.green ? 'безопасно' : `не прошло проверок: ${bad}`}</span><span class="s small dim">${seen ? `задело клиентов: ${nf(rr.fail)}` : 'ещё не прогнан с этим планом'}</span></div>`;
        }).join('');
        TR.$('.rld-lt', el).textContent = `Запись и оплата, ${O_WIN.find(w => w.v === a.win).t.split(' —')[0]} и следующие 75 минут`;
        TR.$('.rld-lbar', el).innerHTML = barsHTML(r.main.mins, r.main.trig !== null ? r.main.trig : -1);
        TR.$('.rld-lax', el).innerHTML = axisHTML(h0, LH, [0, 15, 30, 45, 60, 75]);
        TR.$('.rld-lmorn', el).innerHTML = r.morning ? `<div class="stack tight"><div class="eyebrow">Утро понедельника, 09:00–09:30: клиенты проснулись, новая версия на ${pct(lShare(a, LH - 1))}</div>${barsHTML(r.morning.mins, r.morning.trig !== null ? r.morning.trig : -1)}${axisHTML(9, 30, [0, 10, 20, 30])}</div>` : '';
        const c = r.caught;
        TR.$('.rld-lst', el).innerHTML = `
          <div class="stat"><span class="k">Задело клиентов</span><span class="v ${r.crit.a ? 'ok' : 'bad'}">${nf(r.fail)}</span><span class="s">ошибка или таймаут при записи</span></div>
          <div class="stat"><span class="k">Медленных ответов</span><span class="v ${r.slow ? 'warn' : 'ok'}">${nf(r.slow)}</span><span class="s">p95 выше 300 мс</span></div>
          <div class="stat"><span class="k">Откат</span><span class="v ${c ? (c.how === 'auto' ? 'ok' : 'warn') : 'bad'}" style="font-size:14px">${c ? `${c.how === 'auto' ? 'сам' : 'вручную'} в ${c === r.morning ? clock(9, c.trig) : clock(h0, c.trig)}` : 'не было'}</span><span class="s">${c ? 'на ' + pct(c.trigShare) + ' трафика' : r.main.late ? 'дежурный не успел за 75 минут' : 'новая версия осталась'}</span></div>
          <div class="stat"><span class="k">Новая версия дошла до</span><span class="v">${pct(Math.max(r.main.maxSh, r.morning ? r.morning.maxSh : 0))}</span><span class="s">трафика до отката</span></div>`;
        TR.$('.rld-lcrit', el).innerHTML = LCRIT.map(cr => `<li class="${r.crit[cr.id] ? 'ok' : 'bad'}"><b>${r.crit[cr.id] ? '✓' : '✗'}</b><div><b>${esc(cr.t)}</b><small>${N[cr.id] || esc(cr.s)}</small></div></li>`).join('');
      }
      draw();
      ui.quiz(TR.$('.rld-lq', el), Object.assign({}, LAB_Q, { value: a.q[0] || [], readonly: ctx.readonly, reveal: ctx.result, onChange: v => { a.q = [v]; ctx.save(); } }));
      const MAP = { 'rld-st': 'st', 'rld-steps': 'steps', 'rld-rb': 'rb', 'rld-win': 'win', 'rld-sc': 'sc' };
      ui.onSeg(el, (name, v) => {
        const k = MAP[name]; if (!k) return;
        if (ctx.readonly && k !== 'sc') return;
        a[k] = v; mark();
        if (!ctx.readonly) {
          ctx.save();
          if (k !== 'sc') ctx.decide('План выкатки бонусов', `способ: ${tOf(O_ST, a.st)}; шаги: ${a.st === 'canary' ? tOf(O_STEPS, a.steps) : '—'}; откат: ${tOf(O_RB, a.rb)}; когда: ${tOf(O_WIN, a.win)}`);
        }
        draw();
      });
    },
    check(ans) {
      const sig = sigOf(ans), seen = ans.seen || [];
      const res = SCN.map(s => ({ s, r: simDeploy(ans, s.v), seen: seen.includes(sig + '|' + s.v) }));
      const greens = res.filter(x => x.r.green).length, seenAll = res.every(x => x.seen);
      const q = ui.quizScore(LAB_Q, (ans.q || [])[0] || []);
      const hint = {
        a: 'Задело больше 10 клиентов. Какая доля трафика была на новой версии, когда баг заметили, и сколько минут прошло до отката?',
        b: 'Новую версию получили все раньше, чем сработал откат. Хватило ли маленькому шагу времени набрать сигнал? Есть ли промежуточный шаг под настоящей нагрузкой?',
        c: 'Откат не сам или не за минуту. Кто заметит баг, который не грузит процессор? Сколько длится откат при «всё сразу»?',
        d: 'Окно релиза: что Сергей сказал про воскресенье? И кто будет на месте ночью — и будет ли ночью трафик, чтобы канарейка что-то увидела?'
      };
      const notes = [];
      res.forEach(({ s, r, seen: sn }) => {
        if (!sn) { notes.push({ ok: 'warn', html: `Вариант «${esc(s.t)}» с этим планом ещё не прогнан — нажмите его в «Что спрятано в новой версии».` }); return; }
        if (r.green) { notes.push({ ok: true, html: `«${esc(s.t)}»: безопасно по всем четырём проверкам.` }); return; }
        const miss = LCRIT.filter(c => !r.crit[c.id]);
        notes.push({ ok: false, html: `«${esc(s.t)}»: не прошло — ${miss.map(c => esc(c.t.toLowerCase())).join('; ')}. ${hint[miss[0].id]}` });
      });
      notes.push(q.ok ? { ok: true, html: 'Вопрос: верно — маленький шаг ловит логику, промежуточный — нагрузку.' } : { ok: false, html: 'Вопрос внизу: сколько записей в минуту получает новая версия на 5 % и при какой нагрузке проявляется лишний запрос в «Бонусы»?' });
      const score = greens / 2 * 0.6 + (seenAll ? 0.1 : 0) + q.score * 0.3;
      return {
        ok: greens === 2 && seenAll && q.ok, score, notes,
        summary: `Безопасно в вариантах: ${greens} из 2.`,
        vera: greens === 2 ? null : 'Каждая настройка закрывает свою дыру. Способ — сколько клиентов увидят баг. Шаги — успеет ли правило набрать сигнал и будет ли проверка под нагрузкой. Правило отката — заметит ли баг автоматика. Окно — будет ли трафик и люди.'
      };
    },
    explain: `<p>Безопасен один план: <b>канарейка 5 → 50 → 100 % с шагом 15 минут, автоматический откат по SLO записи, будний день 11:00</b>. Каждая настройка нужна для своего:</p>
      <ul class="checks">
        <li><b>Канарейка</b> ограничивает радиус поражения: на 5 % баг логики задевает ~1 клиента в минуту. При «всё сразу» и blue-green его видят все — разница только в скорости отката (10 минут и секунды).</li>
        <li><b>Пауза 15 минут</b> даёт правилу набрать сигнал: 15 записей в минуту → 50 запросов за 4 минуты. С шагом 2 минуты новая версия успевает дойти до 50 % раньше, чем на 5 % что-то стало видно. <b>Шаг 50 %</b> — проверка под настоящей нагрузкой: лишний запрос в «Бонусы» становится заметен только тогда. Без него («5 → 100») проблема нагрузки бьёт сразу по всем.</li>
        <li><b>Откат по SLO</b> смотрит на то, что чувствует клиент: долю ошибок и p95 записи — отдельно у новой версии. CPU баг логики и ожидание соседнего сервиса не замечает.</li>
        <li><b>Будни днём</b>: трафика хватает для сигнала, команда на месте. В воскресенье 19:00 шаги въезжают в пик 20:00, ночью канарейка «слепая», а проблема нагрузки проявится утром понедельника на 100 %.</li>
      </ul>
      <p>Всё это — требования, а не детали DevOps: аналитик пишет в постановку способ выкатки, критерии отката в цифрах SLO и окно релиза. Бонусы при этом выкачены, но <b>выключены флагом</b> — включать их будут по клубам, отдельно от выкатки кода.</p>`,
    report: ans => {
      const sig = sigOf(ans);
      return `Способ: ${tOf(O_ST, ans.st)}; шаги: ${ans.st === 'canary' ? tOf(O_STEPS, ans.steps) : '—'}; откат: ${tOf(O_RB, ans.rb)}; когда: ${tOf(O_WIN, ans.win)}.\n` +
        SCN.map(s => { const r = simDeploy(ans, s.v); return `- ${s.t}: ${r.green ? 'безопасно' : 'не безопасно (' + LCRIT.filter(c => !r.crit[c.id]).map(c => c.t.toLowerCase()).join('; ') + ')'}, задело ${nf(r.fail)}${(ans.seen || []).includes(sig + '|' + s.v) ? '' : ' — не прогнан'}`; }).join('\n') +
        `\nВопрос о шаге 50 %: ${ui.quizScore(LAB_Q, (ans.q || [])[0] || []).ok ? 'верно' : 'неверно'}.`;
    }
  };

  // =====================================================================
  // Практика 2. Миграция под бонусы: порядок expand–contract и откат на каждом шаге
  // =====================================================================
  const MIG = [
    { id: 'add', t: 'Добавить колонки <code>card_paid_kopecks bigint NULL</code> и <code>bonus_paid_kopecks bigint NOT NULL DEFAULT 0</code>', sub: 'быстро: таблица не перезаписывается, старый код новых колонок не замечает', rb: 'back', why: 'Старый код колонок не видит; их можно не использовать или удалить — данных ещё нет.' },
    { id: 'v2', t: 'Релиз v2 канарейкой: пишет и в <code>price_paid_kopecks</code>, и в новые колонки; читает старую', sub: 'бонусы в коде есть, но за выключенным флагом', rb: 'back', why: 'Откат на v1: старая колонка полная, новые просто перестанут заполняться — перенос догонит.' },
    { id: 'fill', t: 'Перенести старые строки: <code>SET card_paid_kopecks = price_paid_kopecks WHERE card_paid_kopecks IS NULL</code> пачками по 5 000', sub: 'в будни днём, вне пика; ~300 тыс. абонементов', rb: 'back', why: 'Новые колонки — копия старой. Откатывать нечего.' },
    { id: 'nn', t: 'Сверить и закрепить: строк, где карта + бонусы ≠ цена, — 0; затем <code>NOT NULL</code> через <code>CHECK … NOT VALID</code> + <code>VALIDATE</code>', sub: 'проверка без долгой блокировки таблицы', rb: 'back', why: 'Ограничение можно снять одной командой; данные не трогаем.' },
    { id: 'v3', t: 'Релиз v3: возвраты, выгрузка в 1С и отчёты читают новые колонки; пишет по-прежнему в обе', sub: 'в событие MembershipActivated добавлены необязательные cardPaidKopecks и bonusPaidKopecks, старое поле на месте', rb: 'back', why: 'Откат на v2 без потерь: v3 продолжала писать старую колонку.' },
    { id: 'flag', t: 'Включить флаг бонусов: пилот в 3 клубах, потом по городам', sub: 'покупки с бонусами пишутся в новые колонки', rb: 'flag', why: 'Здесь откатывают не код, а флаг: выключили — бонусы спрятаны, покупки уже записаны правильно, v3 их понимает.' },
    { id: 'v4', t: 'Релиз v4: больше не пишет <code>price_paid_kopecks</code>', sub: 'старое поле в событии пока заполняется как карта + бонусы и помечено устаревшим', rb: 'back', why: 'Откат на v3 без потерь: v3 читает новые колонки и снова начнёт писать старую. А вот на v2 уже нельзя — старая колонка отстала.' },
    { id: 'drop', t: 'Через 2 недели, когда старое поле никто не читает: <code>DROP COLUMN price_paid_kopecks</code>', sub: 'поле из события убирают только новой версией контракта', rb: 'fwd', why: 'Точка невозврата: колонки нет, вернуть её можно только из бэкапа. Поэтому — последней и через недели.' }
  ];
  const MIG_OK = MIG.map(m => m.id);
  const MRB = [{ v: 'back', t: 'Откатить релиз — без потери данных' }, { v: 'flag', t: 'Выключить флаг' }, { v: 'fwd', t: 'Только вперёд: точка невозврата' }];
  function migEval(ans) {
    const v = (ans && ans.order && ans.order.length === MIG.length) ? ans.order : [];
    const os = v.length ? ui.orderScore(v, MIG_OK) : 0;
    const at = id => v.indexOf(id);
    const crit = [];
    if (v.length) {
      if (at('v2') < at('add')) crit.push('Релиз v2 пишет в колонки, которых ещё нет: каждая покупка абонемента — ошибка 500. Что должно появиться в базе раньше кода, который туда пишет?');
      if (at('fill') < at('v2')) crit.push('Перенос до того, как новый код начал писать в обе колонки: пока v1 работает, она добавит строки без новых колонок — и они останутся пустыми. Когда переносить, чтобы новых пустых строк больше не появлялось?');
      if (at('v3') < at('fill') || at('v3') < at('nn')) crit.push('v3 читает новые колонки раньше, чем в них перенесены и сверены старые данные: возврат по старому абонементу посчитается от пустоты.');
      if (at('flag') < at('v3')) crit.push('Бонусы включены, когда возвраты и 1С ещё читают старую колонку: они не знают, что часть цены оплачена бонусами, и вернут её деньгами.');
      if (at('drop') !== MIG.length - 1) crit.push('Удаление старой колонки не последним шагом: кто-то из работающих версий её ещё читает или пишет — и откат дальше невозможен.');
    }
    const rbv = (ans && ans.rb) || {};
    const rbOk = MIG.filter(m => rbv[m.id] === m.rb).length;
    const rbCrit = rbv.drop === 'fwd' && rbv.flag === 'flag';
    return { v, os, crit, rbOk, rbCrit, rbv };
  }
  const migTask = {
    id: 'migration', title: 'Миграция под бонусы',
    simple: howDb.simple,
    lead: ui.brief({
      situation: 'Сейчас в <code>membership</code> одна сумма — <code>price_paid_kopecks</code>: сколько клиент заплатил. С бонусами цена делится: «Сеть 12 мес» за 54 000 ₽ = 3 200 бонусами + 50 800 картой. Возвраты, выгрузка в 1С и отчёты должны знать, какая часть — деньги. Антон: «Миграция без простоя и без блокировок, выкатка — канарейкой, бонусы включаем флагом по клубам». Лена набросала восемь шагов — вперемешку.',
      todo: [
        'Расставьте восемь шагов по порядку: сверху — первый. Перетаскивайте карточки или жмите стрелки.',
        'Ниже для каждого шага выберите, что делать, если сразу после него всплыл баг: откатить релиз без потери данных, выключить флаг или только чинить вперёд.',
        'Нажмите «Проверить». Засчитывается, когда порядок совпадает с эталоном хотя бы на 85 % пар без критичных ошибок, точка невозврата и шаг с флагом отмечены верно, а всего верных отметок — не меньше 6 из 8.'
      ],
      lookTitle: 'Подсказка',
      look: 'Задавайте каждому шагу два вопроса: «какие версии кода сейчас работают одновременно?» и «найдёт ли каждая из них свои данные?». Шаги ниже, в выборе отката, стоят не по порядку — это не подсказка.'
    }),
    blank: () => ({ order: [], rb: {} }),
    reference: () => ({ order: MIG_OK.slice(), rb: Object.fromEntries(MIG.map(m => [m.id, m.rb])) }),
    render(el, ctx) {
      el.classList.add('rld-root');
      let reveal = null;
      if (ctx.result && ctx.ans.order && ctx.ans.order.length === MIG.length) {
        reveal = {}; ctx.ans.order.forEach((id, i) => { reveal[id] = Math.abs(i - MIG_OK.indexOf(id)) <= 0 ? 'ok' : Math.abs(i - MIG_OK.indexOf(id)) === 1 ? 'warn' : 'bad'; });
      }
      mount(el).innerHTML = '<div class="row between small dim" style="margin-bottom:6px"><span>↑ первый шаг</span><span>последний шаг ↓</span></div>';
      ui.order(mount(el), {
        items: MIG.map(m => ({ id: m.id, t: m.t, sub: esc(m.sub) })), value: ctx.ans.order, reveal, readonly: ctx.readonly, seed: 'rld-mig',
        onChange: v => { ctx.ans.order = v; ctx.save(); if (!ctx.readonly) ctx.decide('Порядок миграции под бонусы', v.map((id, i) => `${i + 1}. ${plainT(MIG.find(m => m.id === id).t)}`).join('; ')); }
      });
      const h = mount(el); h.style.marginTop = '14px';
      h.innerHTML = '<div class="eyebrow">Если сразу после шага всплыл баг — что делаем?</div>';
      let rrv = null;
      if (ctx.result) { rrv = {}; MIG.forEach(m => { const g = (ctx.ans.rb || {})[m.id]; rrv[m.id] = { s: g === m.rb ? 'ok' : 'bad', why: g === m.rb ? m.why : '' }; }); }
      ui.match(mount(el), {
        rows: TR.shuffle(MIG, 'rld-mig-rb').map(m => ({ id: m.id, t: m.t })), choices: MRB, value: ctx.ans.rb || {}, reveal: rrv, readonly: ctx.readonly, placeholder: 'Что делаем…',
        onChange: v => { ctx.ans.rb = v; ctx.save(); if (!ctx.readonly) ctx.decide('Откат на шагах миграции', MIG.map(m => `${plainT(m.t).slice(0, 40)}…: ${v[m.id] ? tOf(MRB, v[m.id]) : '—'}`).join('; ')); }
      });
      if (ctx.readonly) mount(el).innerHTML = '<div style="margin-top:12px">' + ui.table(['Шаг', 'Если баг', 'Почему'], MIG.map(m => [m.t, esc(tOf(MRB, m.rb)), esc(m.why)])) + '</div>';
    },
    check(ans) {
      const e = migEval(ans), notes = [];
      if (!e.v.length) return { ok: false, score: 0, notes: [{ ok: false, html: 'Расставьте шаги по порядку.' }], summary: 'Порядок не задан.' };
      notes.push({ ok: e.os >= 0.85, html: `Совпадение порядка: ${Math.round(e.os * 100)} % пар.` });
      e.crit.forEach(c => notes.push({ ok: false, html: c }));
      if (e.rbv.drop && e.rbv.drop !== 'fwd') notes.push({ ok: false, html: 'Удаление старой колонки: можно ли «откатить» DROP COLUMN без бэкапа?' });
      if (e.rbv.flag && e.rbv.flag !== 'flag') notes.push({ ok: false, html: 'Включение бонусов — не релиз кода. Чем его выключают за секунды?' });
      const wrongBack = MIG.filter(m => m.rb === 'back' && e.rbv[m.id] && e.rbv[m.id] !== 'back');
      if (wrongBack.length) notes.push({ ok: 'warn', html: `Шагов, где вы не доверяете откату, хотя он безопасен: ${wrongBack.length}. Найдёт ли предыдущая версия свои данные? Именно для этого expand–contract и придуман.` });
      const empty = MIG.filter(m => !e.rbv[m.id]).length;
      if (empty) notes.push({ ok: false, html: `Не отмечено, что делать при баге: ${empty} ${TR.plural(empty, 'шаг', 'шага', 'шагов')}.` });
      notes.push({ ok: e.rbOk >= 6, html: `Отметок про откат верно: ${e.rbOk} из ${MIG.length}.` });
      const score = e.os * 0.5 + (e.crit.length ? 0 : 0.15) + e.rbOk / MIG.length * 0.35;
      return { ok: e.os >= 0.85 && !e.crit.length && e.rbCrit && e.rbOk >= 6, score, notes, summary: `Порядок: ${Math.round(e.os * 100)} %, критичных ошибок: ${e.crit.length}, откат: ${e.rbOk} из 8.`, vera: e.crit.length ? 'Проверяйте каждый шаг вопросом: какие версии кода сейчас работают и есть ли у каждой её колонка?' : null };
    },
    explain: `<p>Эталон: <b>добавить колонки → v2 пишет в обе → перенос пачками → сверка и NOT NULL → v3 читает новые → флаг бонусов по клубам → v4 перестаёт писать старую → через 2 недели DROP</b>.</p>
      <ul class="checks">
        <li>Каждое состояние базы подходит <b>двум соседним версиям</b> кода — потому что во время канарейки они работают одновременно.</li>
        <li>Откатить без потери данных можно на любом шаге, кроме последнего. Шаг с бонусами откатывают <b>флагом</b>, а не релизом: выключили — функция спрятана за секунды.</li>
        <li>Перенос — только после v2 на 100 %: иначе v1 успеет добавить строки с пустыми новыми колонками. Пачками — чтобы не держать долгую транзакцию в рабочее время.</li>
        <li>Сверка «карта + бонусы = цена» — критерий перехода к v3. Без неё возвраты по старым абонементам посчитаются неправильно, а это деньги.</li>
        <li>То же правило для контракта событий: в <code>MembershipActivated</code> только <b>добавляют</b> необязательные поля (совместимость BACKWARD в реестре схем, неделя 5); старое поле уходит лишь новой версией контракта, когда его не читает ни 1С, ни аналитика.</li>
      </ul>`,
    report: ans => {
      const e = migEval(ans);
      return (e.v.length ? e.v.map((id, i) => `${i + 1}. ${plainT(MIG.find(m => m.id === id).t)}`).join('\n') : 'Порядок не задан.') +
        '\nЕсли баг:\n' + MIG.map(m => `- ${plainT(m.t).slice(0, 60)}… → ${e.rbv[m.id] ? tOf(MRB, e.rbv[m.id]) : '—'} ${e.rbv[m.id] === m.rb ? '✓' : '✗'}`).join('\n');
    }
  };

  // =====================================================================
  // Практика 3. Флаги для пяти функций сезона 2
  // =====================================================================
  const FT = [{ v: 'club', t: 'Флаг по клубам' }, { v: 'pct', t: 'Процент клиентов' }, { v: 'none', t: 'Без флага' }, { v: 'kill', t: 'Выключатель аварии' }];
  const FEAT = [
    { id: 'bonus', t: 'Бонусная программа', sub: '+10 за посещение, списание до 30 % цены абонемента. Администраторы должны объяснять правила, кассы и 1С — видеть оплату бонусами. Ольга хочет пилот в 3 клубах Москвы, потом по городам.', ok: 'club', crit: true,
      alt: { pct: 'Процент клиентов разрежет программу внутри клуба: подруги в одном зале с разными правилами, администратор не знает, что отвечать. Бонусы — программа клуба, а не эксперимент.' },
      hint: 'Кто должен быть готов к запуску, кроме кода? Видят ли все клиенты одного клуба одно и то же?',
      why: 'Бонусы — программа клуба: персонал, кассы, правила. Пилот в 3 клубах → город → вся сеть. Отдельно — выключатель «списание бонусами» на случай, если сервис «Бонусы» лежит (покупка картой работает).' },
    { id: 'online', t: 'Онлайн-тренировки: кнопка «Смотреть эфир»', sub: 'Видео отдаёт внешний видеосервис. Если он лежит, до 2 000 зрителей смотрят на чёрный экран и звонят в клуб.', ok: 'kill', crit: true,
      alt: { club: 'Студии оснащают постепенно, поэтому флаг по клубам уместен на запуске. Но главный риск этой функции — чужой сервис, и без выключателя аварии не обойтись.' },
      hint: 'Что здесь чаще всего сломается — наш код или чужой сервис? Как быстро убрать чёрный экран у 2 000 человек?',
      why: 'Выключатель аварии: видеосервис лёг — дежурный (или автоматика по ошибкам плеера) прячет кнопку, приложение показывает «эфир временно недоступен, запись появится позже». Запись на эфир и расписание работают.' },
    { id: 'recs', t: 'Рекомендации «Вам подойдёт»: новая модель подбора', sub: 'Не знаем, станут ли люди чаще записываться. Хотим сравнить с нынешним блоком на одинаковых клиентах.', ok: 'pct',
      alt: { club: 'Клубы разные — сравнение «клуб с новой моделью против клуба со старой» смешает модель с районом и публикой. Для сравнения нужны случайные клиенты.' },
      hint: 'Как честно сравнить «было» и «стало»? Кого делить на группы — клубы или клиентов?',
      why: 'Процент клиентов: 10 % по <code>client_id</code> видят новую модель, остальные — старую; сравниваем долю записей с главного экрана. Клиент всегда в одной группе. Потом 50 % и 100 %.' },
    { id: 'notify', t: 'Новый сервис «Уведомления» на RabbitMQ вместо отправки пушей из ядра', sub: 'Должен выдержать 300 тыс. пушей за вечер воскресенья. Отправку переводят на него постепенно.', ok: 'pct',
      alt: { kill: 'Выключатель «вернуть отправку старым путём» полезен на время перевода. Но сам перевод — постепенный, по клиентам: 5 % → 25 % → 100 %, смотрим очередь и задержку.' },
      hint: 'Это новая функция для клиента или перенос нагрузки? Как проверить, что сервис выдержит воскресенье, не рискуя всеми пушами сразу?',
      why: 'Процент клиентов: сначала 5 % клиентов получают пуши через новый сервис, смотрим глубину очереди и задержку; к воскресенью — 100 %. Клиенту всё равно, каким путём пришёл пуш, а нагрузка растёт ступенями.' },
    { id: 'partner', t: 'Новый партнёр-агрегатор «СпортЛайф» в партнёрском шлюзе', sub: 'У партнёра свой OAuth-клиент, свои лимиты и список клубов в договоре. Подключение — выдать доступ.', ok: 'none',
      alt: { club: 'Список клубов партнёра — часть договора и настройка шлюза, а не флаг в коде. Флаг продублировал бы то, что уже делает доступ.' },
      hint: 'Чем партнёр «включается» уже сейчас? Нужен ли для этого ещё и переключатель в коде?',
      why: 'Без флага: «включатель» — выданный OAuth-клиент и лимиты в шлюзе. Отозвать доступ — тоже выключатель. Лишний флаг — лишняя развилка и долг флагов.' }
  ];
  const FLAG_Q = {
    q: 'Прошёл месяц, бонусы включены во всех 60 клубах. Что делать с флагом «бонусы по клубам»?', seed: 'rld-flag-q',
    options: [
      { t: 'Удалить флаг из кода и настроек, а для аварий оставить отдельный выключатель «списание бонусами» с владельцем — дежурным', ok: 1, why: 'Верно. Флаг выпуска своё отработал. Выключатель аварии нужен: «Бонусы» — отдельный сервис и может лечь.' },
      { t: 'Оставить навсегда — вдруг пригодится', why: 'Это долг флагов: развилка в коде, лишние сочетания для тестов и риск, что кто-то случайно выключит клуб.' },
      { t: 'Выключить флаг, а код оставить', why: 'Выключенный флаг выключит бонусы во всех клубах.' },
      { t: 'Удалить и флаг, и любую возможность выключить бонусы — функция уже стабильна', why: 'Списание зависит от сервиса «Бонусы». Если он лежит, покупка должна работать картой — нужен выключатель (понедельник, план деградации).' }
    ]
  };
  function flagEval(v) {
    v = v || {};
    return FEAT.map(f => { const g = v[f.id]; return g === f.ok ? { f, s: 'ok', pts: 1 } : f.alt && f.alt[g] ? { f, s: 'warn', pts: 0.5 } : { f, s: 'bad', pts: 0, empty: !g }; });
  }
  const flagsTask = {
    id: 'flags', title: 'Флаги для функций сезона 2',
    simple: howFlags.simple,
    lead: ui.brief({
      situation: 'Антон собирает «карту флагов» сезона 2: для каждой новой функции — как её включают и чем выключают. Сергей: «Каждый флаг — это развилка, которую я ночью должен понимать. Лишних не надо, нужные — с владельцем».',
      todo: [
        'Для каждой из пяти функций выберите вид флага в выпадающем списке.',
        'Спросите себя: кто должен быть готов к запуску, кроме кода? нужно ли честное сравнение? что чаще всего сломается — наш код или чужой сервис? не включается ли функция уже чем-то другим?',
        'Ответьте на вопрос о судьбе флага через месяц и нажмите «Проверить». Засчитывается от 80 %, бонусы и онлайн-тренировки должны быть верными, вопрос — тоже. У некоторых строк есть второй допустимый ответ — он засчитывается наполовину.'
      ],
      lookTitle: 'Четыре варианта',
      look: '<b>Флаг по клубам</b> — включаем там, где готовы, все клиенты клуба видят одно и то же. <b>Процент клиентов</b> — стабильная доля по client_id: сравнение и постепенный перевод нагрузки. <b>Выключатель аварии</b> — спрятать функцию за секунды, когда ломается. <b>Без флага</b> — когда переключатель уже есть или флаг дороже пользы.'
    }),
    blank: () => ({ v: {}, q: [] }),
    reference: () => ({ v: Object.fromEntries(FEAT.map(f => [f.id, f.ok])), q: quizRef([FLAG_Q])[0] }),
    render(el, ctx) {
      el.classList.add('rld-root');
      let reveal = null;
      if (ctx.result) { reveal = {}; flagEval(ctx.ans.v).forEach(x => { reveal[x.f.id] = { s: x.s, why: x.s === 'ok' ? x.f.why : x.s === 'warn' ? x.f.alt[(ctx.ans.v || {})[x.f.id]] : '' }; }); }
      ui.match(mount(el), {
        rows: FEAT.map(f => ({ id: f.id, t: `<b>${esc(f.t)}</b>`, sub: esc(f.sub) })), choices: FT, value: ctx.ans.v || {}, reveal, readonly: ctx.readonly, placeholder: 'Какой флаг…',
        onChange: v => { ctx.ans.v = v; ctx.save(); if (!ctx.readonly) ctx.decide('Карта флагов сезона 2', FEAT.map(f => `${f.t}: ${v[f.id] ? tOf(FT, v[f.id]) : '—'}`).join('; ')); }
      });
      const q = mount(el, 'card flat'); q.style.marginTop = '12px';
      ui.quiz(q, Object.assign({}, FLAG_Q, { value: ctx.ans.q || [], readonly: ctx.readonly, reveal: ctx.result, onChange: v => { ctx.ans.q = v; ctx.save(); } }));
      if (ctx.readonly) mount(el).innerHTML = '<div style="margin-top:12px">' + ui.table(['Функция', 'Флаг', 'Почему'], FEAT.map(f => [esc(f.t), esc(tOf(FT, f.ok)), f.why])) + '</div>';
    },
    check(ans) {
      const ev = flagEval(ans && ans.v), pts = ev.reduce((s, x) => s + x.pts, 0), ms = pts / FEAT.length;
      const critBad = ev.filter(x => x.f.crit && x.s !== 'ok'), q = ui.quizScore(FLAG_Q, (ans && ans.q) || []), notes = [];
      ev.forEach(x => {
        if (x.s === 'warn') notes.push({ ok: 'warn', html: `«${esc(x.f.t)}» — ${x.f.alt[(ans.v || {})[x.f.id]]}` });
        else if (x.s === 'bad') notes.push({ ok: false, html: `«${esc(x.f.t)}» — ${x.empty ? 'не выбрано. ' : ''}${x.f.hint}` });
      });
      if (!notes.length) notes.push({ ok: true, html: 'Все пять — по своим местам.' });
      notes.push(q.ok ? { ok: true, html: 'Вопрос о флаге через месяц: верно.' } : { ok: false, html: 'Вопрос о флаге через месяц: чем флаг выпуска отличается от выключателя аварии и сколько каждый должен жить?' });
      const score = ms * 0.75 + q.score * 0.25;
      return { ok: ms >= 0.8 && !critBad.length && q.ok, score, notes, summary: `Точно: ${ev.filter(x => x.s === 'ok').length} из ${FEAT.length}, допустимо: ${ev.filter(x => x.s === 'warn').length}.` };
    },
    explain: `<p>Карта флагов сезона 2:</p>
      <ul class="checks">
        <li><b>Бонусы — по клубам</b>: запуск зависит от людей и касс, а не только от кода. Плюс выключатель списания на случай отказа сервиса «Бонусы».</li>
        <li><b>Онлайн-тренировки — выключатель аварии</b>: главный риск — внешний видеосервис.</li>
        <li><b>Рекомендации — процент клиентов</b>: честное сравнение на случайных клиентах (A/B).</li>
        <li><b>Новые «Уведомления» — процент клиентов</b>: нагрузку переводят ступенями до воскресенья.</li>
        <li><b>Новый партнёр — без флага</b>: выключатель уже есть — OAuth-клиент и лимиты шлюза.</li>
      </ul>
      <p>Флаг — тоже требование: в постановке аналитик пишет имя флага, вид, кто им управляет, план включения (пилот → город → сеть) и <b>когда флаг удаляют</b>. Без последнего пункта через полгода в коде восемь развилок и 256 вариантов поведения.</p>`,
    report: ans => flagEval(ans && ans.v).map(x => `- ${x.f.t} → ${(ans.v || {})[x.f.id] ? tOf(FT, ans.v[x.f.id]) : '—'} ${x.s === 'ok' ? '✓' : x.s === 'warn' ? '≈' : '✗'}`).join('\n') + `\nФлаг через месяц: ${ui.quizScore(FLAG_Q, ans.q || []).ok ? 'верно' : 'неверно'}.`
  };

  // =====================================================================
  // Практика 4. Требования к выкатке в постановке
  // =====================================================================
  const REQ_RUBRIC = [
    'Способ выкатки и шаги: канарейка 5 → 50 → 100 % с паузой наблюдения (около 15 минут) на каждом шаге',
    'Критерии автоматического отката в цифрах SLO записи и оплаты: ошибок у новой версии > 1 % или p95 > 300 мс за окно 5 минут; откат без человека за минуту',
    'Флаги: бонусы по клубам (пилот 3 клуба → города → сеть), выключатель списания бонусами, владелец каждого флага и срок удаления',
    'Миграция базы — expand–contract без блокирующих ALTER в пик; удаление старой колонки — отдельным шагом через 2 недели',
    'Совместимость контрактов: API /v1 и события только расширяются необязательными полями (BACKWARD), старые приложения и потребители работают',
    'Окно релиза: будни в рабочее время; не в воскресенье 18:00–22:00, не ночью и не перед выходными; заморозка рискованных релизов при сгоревшем бюджете ошибок',
    'Как проверяем: что смотреть на каждом шаге (ошибки и p95 записи по версиям), откат отрепетирован на стенде, критерий «старая версия работает с новой схемой»'
  ];
  const REQ_REF = `<p><b>Требования к выкатке: «Бонусная программа», ядро 3.0</b></p>
    <ol>
      <li>Выкатка — канарейкой: 5 % → 50 % → 100 % трафика, на каждом шаге пауза 15 минут и сравнение метрик новой версии со старой.</li>
      <li>Автоматический откат без участия человека, если у новой версии за окно 5 минут доля ошибок записи или оплаты больше 1 % или p95 записи больше 300 мс. Откат — снятие доли трафика за ≤ 1 минуту; дежурный получает уведомление.</li>
      <li>Бонусы выкатываются выключенными. Флаг <code>bonus-by-club</code>: пилот в 3 клубах Москвы → по городам → сеть; владелец — Лена, удалить через месяц после включения во всех клубах. Постоянный выключатель «списание бонусами» — у дежурного: при отказе сервиса «Бонусы» покупка работает картой.</li>
      <li>Миграция <code>membership</code> — expand–contract: новые колонки → запись в обе → перенос пачками вне пика → сверка «карта + бонусы = цена» → чтение новых → удаление <code>price_paid_kopecks</code> не раньше чем через 2 недели. Без блокирующих ALTER.</li>
      <li>Контракты: в API <code>/v1</code> и событиях <code>MembershipActivated</code>, <code>PaymentSucceeded</code> только добавляются необязательные поля, совместимость BACKWARD проверяется в реестре схем при сборке. Старые версии приложения работают.</li>
      <li>Окно релиза: будни 10:00–17:00. Запрещено: воскресенье 18:00–22:00, ночь, вечер пятницы. При сгоревшем бюджете ошибок — заморозка рискованных релизов.</li>
      <li>Приёмка: на стенде отрепетирован откат на каждом шаге миграции; v2.x работает с новой схемой; дашборд «ошибки и p95 по версиям» готов до выкатки.</li>
    </ol>`;
  const reqTask = {
    id: 'deploy-req', title: 'Требования к выкатке в постановке',
    simple: {
      icon: '📋',
      plain: 'Как выкатывать — тоже требование. Если его не написать, решат «по ходу» в пятницу вечером.',
      analogy: 'План открытия нового зала: в какой день (не в субботу в час пик), сначала для своих сотрудников, потом для части клиентов, кто и по какому признаку закрывает зал, если что-то пошло не так.',
      tech: 'Нефункциональные требования к выкатке: стратегия и шаги, критерии автоматического отката в терминах SLO, флаги функций (вид, владелец, план включения, срок удаления), миграции expand–contract, совместимость контрактов (API, события), окно релиза и заморозка, проверка отката.'
    },
    lead: ui.brief({
      situation: 'Лена дописывает постановку «Бонусная программа». Раздел «Требования к выкатке» — ваш. Сергей прочитает его как дежурный, Антон — как архитектор, Ольга — чтобы знать, когда и где бонусы появятся у клиентов.',
      todo: [
        'Напишите 6–10 пунктов требований (от 350 символов).',
        'Опирайтесь на лабораторию, миграцию и карту флагов: способ и шаги выкатки, критерии отката в цифрах, флаги, миграция, совместимость контрактов, окно релиза, как проверяем.',
        'Нажмите «Проверить с Верой (Claude)» или «Сверить с эталоном самому» и отметьте, что прозвучало. Засчитывается от 60 %.'
      ],
      lookTitle: 'Подсказка',
      look: 'Хорошее требование проверяемо: «откат автоматически, если у новой версии за 5 минут ошибок записи больше 1 % или p95 больше 300 мс». Плохое — «выкатывать аккуратно и откатывать при проблемах».'
    }),
    blank: () => ({ j: { text: '' } }),
    reference: () => ({ j: { text: plainT(REQ_REF).replace(/\s+/g, ' ').trim(), self: REQ_RUBRIC.map(() => true) } }),
    render(el, ctx) {
      el.classList.add('rld-root');
      el.insertAdjacentHTML('beforeend', ui.say('sergey', 'Мне нужно три вещи, которые я смогу проверить ночью: при каких цифрах откат, какими флагами что выключается и когда выкатывать запрещено.'));
      const j = mount(el); j.style.marginTop = '12px';
      ui.justify(j, {
        id: 'rld-req', q: 'Требования к выкатке бонусной программы', qPlain: 'Напишите требования к выкатке бонусной программы «Пульса»: способ и шаги выкатки, критерии автоматического отката, флаги функций, миграция базы, совместимость контрактов API и событий, окно релиза, как проверяем.',
        rubric: REQ_RUBRIC, reference: REQ_REF, value: ctx.ans.j, readonly: ctx.readonly, minLen: 350,
        onChange: v => { ctx.ans.j = v; ctx.save(); if (!ctx.readonly) ctx.decide('Требования к выкатке', v.text || ''); }
      });
    },
    check(ans) {
      const s = ui.justifyScore(ans && ans.j), txt = String(((ans && ans.j) || {}).text || ''), notes = [];
      if (txt.trim().length < 350) notes.push({ ok: false, html: 'Пока коротко: семь тем в 350 символов не уместить.' });
      else if (!(ans.j.self || ans.j.ai)) notes.push({ ok: 'warn', html: 'Сверьте текст с эталоном (кнопка под полем) или проверьте с Верой.' });
      else notes.push({ ok: s >= 0.6, html: `Покрыто критериев: ${Math.round(s * 100)} %.` });
      if (txt.trim().length >= 350 && !/\d/.test(txt)) notes.push({ ok: 'warn', html: 'Ни одной цифры. При каких значениях Сергей откатит релиз?' });
      return { ok: s >= 0.6, score: s, notes, summary: s ? `Оценка: ${Math.round(s * 100)} %.` : 'Напишите требования и сверьте с эталоном.' };
    },
    explain: '<p>Сильный раздел отвечает на три вопроса дежурного: <b>при каких цифрах откат</b> (SLO, окно, доля трафика), <b>чем выключить</b> (флаги и их владельцы), <b>когда нельзя</b> (окно релиза, заморозка). И на вопрос архитектора: <b>совместимо ли</b> — миграция expand–contract и контракты, которые только расширяются.</p><p>Чего в требованиях нет: «использовать Argo Rollouts» или «LaunchDarkly». Инструмент выбирают разработчики и Сергей. Аналитик фиксирует, <b>что</b> должно происходить и <b>насколько</b>, — так, чтобы это можно было проверить на стенде до релиза.</p>',
    report: ans => `Требования (текст студента):\n> ${String((ans.j || {}).text || '—').replace(/\n/g, '\n> ')}\nСамооценка: ${Math.round(ui.justifyScore(ans.j) * 100)} %.`
  };

  // =====================================================================
  TR.stage({
    id: ID, act: 7, order: 450, slot: 'Пт 10:00', title: 'Выкатка и аварии',
    when: 'пятница, 10:00 · переговорная «Кардио» · запуск бонусной программы',
    intro: [
      { who: 'olga', html: 'В понедельник анонсируем бонусы: +10 за каждое посещение, +500 за друга, оплата бонусами до 30 %. Хочу, чтобы всё заработало — и чтобы ничего не легло, как в то воскресенье.' },
      { who: 'sergey', html: 'Мои условия. Никаких релизов в воскресенье с 18 до 22. Новая версия сначала идёт на малую долю трафика, и если запись начинает сыпать ошибками — откат без людей. И миграция базы под бонусы — без блокировок таблиц.' },
      { who: 'vera', html: 'Сегодня — как выкатывать так, чтобы ошибка задела десяток клиентов, а не 20 000; как включать функции флагами по клубам; как менять базу, когда старый и новый код работают одновременно; и что делать, если упал целый дата-центр. Ваша часть — требования к выкатке в постановке.' }
    ],
    facts: ['F-availability', 'F-week-open', 'F-old-apps', 'F-no-loss', 'F-1c'],
    glossary: [
      { term: 'Канареечная выкатка (canary)', simple: 'Новую версию сначала получают 5 % клиентов. Если им плохо — остальных не пускают, как шахтёры не спускались туда, где замолчала канарейка.', tech: 'Стратегия выкатки: доля трафика на новой версии растёт ступенями (5 → 50 → 100 %) с паузами наблюдения; метрики считаются отдельно по версиям; при нарушении порога — автоматический откат снятием доли.' },
      { term: 'Сине-зелёная выкатка (blue-green)', simple: 'Два одинаковых зала: готовите второй, переводите всех разом, а если там что-то не так — переводите обратно.', tech: 'Два полных окружения; балансировщик переключает весь трафик с одного на другое. Откат — обратное переключение за секунды. Цена — двойная инфраструктура на время выкатки; баг сразу видят все; база общая, её изменения должны подходить обеим версиям.' },
      { term: 'Автоматический откат', simple: 'Правило, которое само убирает новую версию, если клиентам стало хуже, — не дожидаясь, пока проснётся дежурный.', tech: 'Условие по симптомам SLO у новой версии (доля ошибок, p95) за окно наблюдения с минимальным числом запросов. Срабатывает без человека; дежурный получает уведомление. Метрики ресурсов (CPU) для этого не годятся.' },
      { term: 'Радиус поражения (blast radius)', simple: 'Скольких клиентов заденет ошибка, если она случится.', tech: 'Доля пользователей, функций или клубов, которых затронет отказ или неудачный релиз. Его уменьшают канарейкой, флагами по клубам, переборками и разделением на сервисы.' },
      { term: 'Флаг функции (feature flag)', simple: 'Переключатель в настройках: код уже выкачен, а работает только там, где флаг включён.', tech: 'Условие в коде, читающее конфигурацию во время работы. Виды: флаг выпуска (по клубам, городам), процент пользователей (стабильно по client_id), выключатель аварии. Отделяет выкатку кода от запуска функции.' },
      { term: 'Долг флагов', simple: 'Флаги, которые забыли убрать: каждый — развилка в коде, и через полгода никто не помнит, что будет, если их переключить.', tech: 'Накопление устаревших флагов: n флагов дают 2ⁿ вариантов поведения. Лечение — у каждого флага владелец и срок удаления, флаги выпуска удаляют после полного включения.' },
      { term: 'Окно релиза и заморозка', simple: 'Время, когда выкатывать можно, и время, когда нельзя. В воскресенье 18–22 в «Пульсе» — нельзя.', tech: 'Правило, когда разрешены изменения в проде: будни в рабочее время, вне пиков. Заморозка (change freeze) — запрет рискованных релизов в пики и при сгоревшем бюджете ошибок.' },
      { term: 'Зона доступности', simple: 'Отдельный дата-центр в том же городе облака: своё питание, охлаждение, сеть. Пожар в одном не трогает другой.', tech: 'Изолированная площадка внутри региона облака. Сервисы и реплики базы разносят по двум-трём зонам; каждая зона должна выдержать пик одна, иначе авария превращается в перегрузку.' },
      { term: 'Аварийное восстановление (disaster recovery)', simple: 'Заранее написанный и отрепетированный план «что делаем, если всё сгорело».', tech: 'Набор мер и процедур для восстановления после крупной аварии: реплики в другой зоне, бэкап и PITR, цели RPO/RTO по функциям, ранбуки и регулярные учения по восстановлению.' }
    ],
    outro: 'Выкатка — тоже часть проектирования. Канарейка с автооткатом делает ошибку маленькой, флаги отделяют выкатку кода от запуска функции, expand–contract позволяет старому и новому коду жить на одной базе, а RPO и RTO заранее отвечают, сколько можно потерять и сколько лежать. Неделя 7 закончена: система не падает от зависшей 1С, держит пик, считает отчёты отдельно, видна дежурному и выкатывается без страха. На следующей неделе — всё вместе: проектируем онлайн-тренировки с нуля.',
    tasks: [howRollout, howDb, howFlags, labTask, migTask, flagsTask, reqTask]
  });
})();
