/* Неделя 7, вторник 10:00: масштабирование и кэш. Канон — _dev/DOMAIN-2.md §2 (цифры роста) и §6 (масштаб и кэш).
   Теория (живая): вверх или вширь, без состояния (3 экземпляра за балансировщиком, сессия в памяти / в Redis),
   балансировщик (по кругу / наименее загруженный); cache-aside и write-through со шкалой запросов, TTL, сброс по событию
   и счётчик устаревших ответов; громовое стадо и защита; пул соединений (PgBouncer); когда шардировать.
   Соседний пример — приложение бара клуба. Практика: лаборатория «воскресенье через 2 года», кэш расписания,
   где кэш опасен, почему решение о записи — только в базе. */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc;
  const ID = 'rel-scale';

  if (!document.getElementById('rls-css')) document.head.insertAdjacentHTML('beforeend', `<style id="rls-css">
    .rls-root, .rls-root .stack, .rls-root .stack > * { min-width: 0; }
    .rls-root :not(pre) > code { white-space: normal; overflow-wrap: anywhere; }
    .rls-root .seg button { white-space: normal; text-align: left; }
    .rls-box { display: grid; gap: 12px; padding: 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); min-width: 0; }
    .rls-box > * { min-width: 0; }
    .rls-set { display: grid; grid-template-columns: minmax(0, 190px) minmax(0, 1fr); gap: 8px 14px; align-items: center; }
    .rls-set > .lbl { font-size: 13.5px; color: var(--text-2); min-width: 0; }
    .rls-set > .lbl small { display: block; font-size: 12px; color: var(--text-muted); }
    .rls-set > .seg, .rls-set > .rls-rng { justify-self: stretch; max-width: 100%; min-width: 0; }
    .rls-set > .seg { justify-self: start; }
    .rls-set .seg button:disabled { opacity: .45; cursor: not-allowed; }
    .rls-rng { display: flex; gap: 10px; align-items: center; }
    .rls-rng input { flex: 1; min-width: 0; accent-color: var(--accent); }
    .rls-rng b { font: 600 14px/1 var(--f-mono); color: var(--accent); min-width: 2.5ch; text-align: right; }
    .rls-range { width: 100%; margin: 4px 0; accent-color: var(--accent); }
    .rls-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .rls-stats .v { font-size: 16px; overflow-wrap: anywhere; }
    .rls-stats .s { overflow-wrap: anywhere; }
    .rls-inst { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .rls-node { border: 1px solid var(--border-strong); border-radius: 10px; padding: 9px 11px; background: var(--surface-2); display: grid; gap: 4px; min-width: 0; font-size: 13px; align-content: start; }
    .rls-node b { font-size: 13.5px; }
    .rls-node small { color: var(--text-muted); font-size: 12px; overflow-wrap: anywhere; }
    .rls-node.ok { border-color: var(--ok); } .rls-node.warn { border-color: var(--warn); background: var(--warn-soft); }
    .rls-node.bad { border-color: var(--bad); background: var(--bad-soft); } .rls-node.hot { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
    .rls-node.off { border-style: dashed; opacity: .6; }
    .rls-log { display: grid; gap: 4px; font-size: 13px; }
    .rls-log div { padding: 5px 9px; border-radius: 7px; background: var(--surface-2); border-left: 3px solid var(--border-strong); overflow-wrap: anywhere; }
    .rls-log div.ok { border-left-color: var(--ok); } .rls-log div.bad { border-left-color: var(--bad); } .rls-log div.warn { border-left-color: var(--warn); } .rls-log div.info { border-left-color: var(--info); }
    .rls-chips { display: flex; flex-wrap: wrap; gap: 4px; }
    .rls-chips span { min-width: 30px; padding: 3px 6px; border-radius: 6px; text-align: center; font: 11.5px/1.3 var(--f-mono); color: var(--text); }
    .rls-chips .hit { background: var(--ok-soft); border: 1px solid var(--ok); }
    .rls-chips .miss { background: var(--info-soft); border: 1px solid var(--info); }
    .rls-chips .stale { background: var(--bad-soft); border: 1px solid var(--bad); }
    .rls-chips .wr { background: var(--surface-3); border: 1px dashed var(--border-strong); }
    .rls-gantt { display: grid; gap: 6px; }
    .rls-grow { display: grid; grid-template-columns: 64px minmax(0, 1fr) 70px; gap: 8px; align-items: center; font-size: 13px; }
    .rls-grow > * { min-width: 0; }
    .rls-grow .tr { position: relative; height: 20px; background: var(--surface-2); border-radius: 6px; overflow: hidden; }
    .rls-grow .tr i { position: absolute; top: 3px; height: 14px; border-radius: 3px; background: var(--ok); border: 1px solid var(--surface); }
    .rls-grow .tr i.heavy { background: var(--warn); }
    .rls-grow .ms { font: 12px/1.2 var(--f-mono); text-align: right; color: var(--text-2); }
    .rls-chart { position: relative; display: flex; align-items: flex-end; gap: 1px; height: 170px; padding: 0 2px; border-bottom: 1px solid var(--border-strong); background: var(--surface-2); border-radius: 8px 8px 0 0; }
    .rls-chart i { flex: 1; min-width: 0; background: var(--info); border-radius: 2px 2px 0 0; }
    .rls-chart i.over { background: var(--bad); }
    .rls-chart .cap { position: absolute; left: 0; right: 0; border-top: 2px dashed var(--warn); }
    .rls-chart .cap span { position: absolute; right: 6px; top: -18px; font: 11px/1 var(--f-mono); color: var(--warn); background: var(--surface-2); padding: 1px 4px; }
    .rls-axis { display: flex; justify-content: space-between; font: 11px/1.2 var(--f-mono); color: var(--text-muted); }
    .rls-bar { display: grid; gap: 4px; }
    .rls-bar .tr { position: relative; height: 22px; background: var(--surface-3); border-radius: 6px; overflow: hidden; }
    .rls-bar .tr i { position: absolute; left: 0; top: 0; bottom: 0; background: var(--ok); }
    .rls-bar .tr i.warn { background: var(--warn); } .rls-bar .tr i.bad { background: var(--bad); }
    .rls-bar .tr .lim { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--text); }
    .rls-bar .k { display: flex; justify-content: space-between; gap: 8px; font-size: 12.5px; color: var(--text-2); flex-wrap: wrap; }
    .rls-flow { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; align-items: stretch; }
    .rls-flow .col { display: grid; gap: 8px; align-content: start; min-width: 0; }
    .rls-flow .col > .eyebrow { font-size: 10.5px; }
    .rls-mini { display: grid; grid-template-columns: repeat(auto-fill, minmax(34px, 1fr)); gap: 4px; }
    .rls-mini span { height: 26px; border-radius: 5px; display: grid; place-items: center; font: 11px/1 var(--f-mono); background: var(--ok-soft); border: 1px solid var(--ok); color: var(--text); }
    .rls-mini span.warn { background: var(--warn-soft); border-color: var(--warn); } .rls-mini span.bad { background: var(--bad-soft); border-color: var(--bad); }
    .rls-checks { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 6px 10px; }
    .rls-checks label { display: flex; gap: 8px; align-items: flex-start; font-size: 13.5px; cursor: pointer; padding: 7px 9px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); min-width: 0; }
    .rls-checks label > span { min-width: 0; overflow-wrap: anywhere; }
    .rls-checks label small { display: block; color: var(--text-muted); font-size: 12px; }
    .rls-checks label.on { border-color: var(--accent); background: var(--accent-soft); }
    .rls-checks label.ok { border-color: var(--ok); background: var(--ok-soft); } .rls-checks label.bad { border-color: var(--bad); background: var(--bad-soft); } .rls-checks label.warn { border-color: var(--warn); background: var(--warn-soft); }
    .rls-checks input { accent-color: var(--accent); width: 16px; height: 16px; flex: none; margin-top: 2px; }
    .rls-crit { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; font-size: 13.5px; }
    .rls-crit li::before { content: "✗ "; color: var(--bad); font-weight: 700; }
    .rls-crit li.ok::before { content: "✓ "; color: var(--ok); }
    @media (max-width: 760px) {
      .rls-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .rls-flow { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 640px) {
      .rls-set { grid-template-columns: minmax(0, 1fr); gap: 4px; }
      .rls-set > .lbl { margin-top: 8px; }
      .rls-inst { grid-template-columns: minmax(0, 1fr); }
      .rls-grow { grid-template-columns: 48px minmax(0, 1fr) 62px; font-size: 12px; }
      .rls-chart { height: 130px; }
    }
  </style>`);

  // ---------- общие помощники ----------
  const fresh = pane => { const d = document.createElement('div'); pane.appendChild(d); return d; };
  const mount = (el, cls) => { const d = document.createElement('div'); if (cls) d.className = cls; el.appendChild(d); return d; };
  const plainT = s => String(s || '').replace(/<[^>]+>/g, '');
  const tOf = (list, v) => { const x = list.find(o => String(o.v) === String(v)); return x ? plainT(x.t) : '—'; };
  const quizRef = QS => QS.map(cfg => cfg.options.map((o, i) => o.ok ? i : -1).filter(i => i >= 0));
  const nf = (x, d) => Number(x).toLocaleString('ru-RU', { maximumFractionDigits: d == null ? 0 : d });
  const fmtMs = ms => ms === Infinity ? 'таймауты' : ms >= 1000 ? nf(ms / 1000, 1) + ' с' : Math.round(ms) + ' мс';

  // =====================================================================
  // Теория 1. Вверх или вширь, без состояния, балансировщик (соседний пример: приложение бара клуба)
  // =====================================================================
  const VH_LOAD = [100, 300, 600, 1200, 2400, 5000];
  const SIZES = [{ t: 'S · 4 ядра', cap: 300, cost: 1 }, { t: 'M · 8 ядер', cap: 600, cost: 2.2 }, { t: 'L · 16 ядер', cap: 1200, cost: 5 }, { t: 'XL · 32 ядра', cap: 2400, cost: 12 }];
  function drawVH(pane) {
    const st = { k: 2, mode: 'v', down: false };
    pane.innerHTML = `<div class="stack">
      <div class="rls-box">
        <div class="rls-set"><div class="lbl">Как растём</div>${ui.seg('mode', [{ v: 'v', t: 'Вверх: машина мощнее' }, { v: 'h', t: 'Вширь: ещё такие же машины' }], st.mode, 'accent')}</div>
        <label class="field"><span>Заказов в баре в секунду (по всей сети): <b data-k></b></span><input type="range" class="rls-range" min="0" max="${VH_LOAD.length - 1}" value="${st.k}" data-r aria-label="Нагрузка"></label>
        <div class="row"><button type="button" class="btn sm" data-down>Уронить одну машину</button><span class="small dim">отказ железа, обновление ОС, перезапуск</span></div>
      </div>
      <div class="rls-inst" data-m style="grid-template-columns:repeat(auto-fill,minmax(110px,1fr))"></div>
      <div class="rls-stats" data-st></div>
      <div data-n></div>
    </div>`;
    function draw() {
      const load = VH_LOAD[st.k];
      TR.$('[data-k]', pane).textContent = nf(load);
      TR.$('[data-down]', pane).textContent = st.down ? 'Поднять машину' : 'Уронить одну машину';
      let machines = [], cost = 0, ceiling = false, served = 1, note;
      if (st.mode === 'v') {
        const sz = SIZES.find(s => load <= s.cap * 0.7) || SIZES[SIZES.length - 1];
        ceiling = load > sz.cap * 0.7;
        machines = [{ t: sz.t, u: load / sz.cap }]; cost = sz.cost;
        served = st.down ? 0 : Math.min(1, sz.cap / load);
        note = st.down ? ui.note('bad', 'Одна машина — одна точка отказа', 'Машина перезагружается — бар не принимает ни одного заказа. Чтобы обновить ОС или сменить железо, нужна остановка.')
          : ceiling ? ui.note('bad', 'Потолок', `Мощнее ${esc(sz.t)} машин в облаке нет, а она держит ${nf(sz.cap)} в секунду. Расти вверх больше некуда.`)
            : ui.note('', 'Просто — пока хватает', `Код менять не нужно: та же программа на машине побольше. Но цена растёт быстрее мощности (${esc(sz.t)} стоит ${nf(sz.cost, 1)} условных единиц), а у самой большой машины есть предел.`);
      } else {
        const n = Math.max(2, Math.ceil(load / (SIZES[0].cap * 0.7)) + 1);
        const alive = st.down ? n - 1 : n;
        machines = Array.from({ length: n }, (_, i) => ({ t: 'S · №' + (i + 1), u: (st.down && i === 1) ? -1 : load / (alive * SIZES[0].cap) }));
        cost = n * SIZES[0].cost; served = Math.min(1, alive * SIZES[0].cap / load);
        note = st.down ? ui.note('ok', 'Упала одна из многих', `Балансировщик перестал слать запросы на упавшую машину, остальные ${alive} приняли её долю. Поэтому машин всегда на одну больше, чем нужно (N+1).`)
          : ui.note('ok', 'Растём добавлением', `Нужно больше — добавили машину, меньше — убрали (автоскейлинг). Потолка почти нет, цена растёт ровно. Но есть условие: <b>любой запрос может попасть на любую машину</b>. Значит, машина не должна помнить ничего своего — корзину, вход, черновик заказа. Об этом — следующая вкладка.`);
      }
      TR.$('[data-m]', pane).innerHTML = machines.map(m => `<div class="rls-node ${m.u < 0 ? 'off' : m.u > 0.85 ? 'bad' : m.u > 0.7 ? 'warn' : 'ok'}"><b>${esc(m.t)}</b><small>${m.u < 0 ? 'лежит' : 'загрузка ' + Math.round(Math.min(m.u, 9.99) * 100) + ' %'}</small></div>`).join('');
      TR.$('[data-st]', pane).innerHTML = `
        <div class="stat"><span class="k">Машин</span><span class="v">${machines.length}</span><span class="s">${st.mode === 'v' ? 'одна, но большая' : 'одинаковые, с запасом +1'}</span></div>
        <div class="stat"><span class="k">Цена в месяц</span><span class="v">${nf(cost, 1)} ед.</span><span class="s">условные единицы</span></div>
        <div class="stat"><span class="k">Заказы принимаются</span><span class="v ${served >= 1 ? 'ok' : served > 0 ? 'warn' : 'bad'}">${Math.round(served * 100)} %</span><span class="s">${st.down ? 'одна машина лежит' : 'все машины работают'}</span></div>
        <div class="stat"><span class="k">Предел роста</span><span class="v ${st.mode === 'v' && ceiling ? 'bad' : 'ok'}">${st.mode === 'v' ? nf(SIZES[3].cap) + '/с' : 'добавляем ещё'}</span><span class="s">${st.mode === 'v' ? 'самая большая машина' : 'нужен балансировщик'}</span></div>`;
      TR.$('[data-n]', pane).innerHTML = note;
    }
    ui.onSeg(pane, (n, v) => { if (n === 'mode') { st.mode = v; draw(); } });
    TR.$('[data-r]', pane).addEventListener('input', e => { st.k = +e.target.value; draw(); });
    TR.on(pane, 'click', '[data-down]', () => { st.down = !st.down; draw(); });
    draw();
  }
  const ITEMS = ['Смузи «Банан»', 'Протеиновый батончик', 'Вода 0,5 л', 'Смузи «Шпинат»'];
  function drawState(pane) {
    const st = { store: 'mem', lb: 'rr', n: 0, added: 0, carts: [[], [], []], shared: [], down: {}, log: [], sticky: null };
    pane.innerHTML = `<div class="stack">
      <div class="rls-box"><div class="rls-set">
        <div class="lbl">Где корзина</div>${ui.seg('store', [{ v: 'mem', t: 'В памяти экземпляра' }, { v: 'redis', t: 'В общем хранилище Redis' }], st.store, 'accent')}
        <div class="lbl">Балансировщик</div>${ui.seg('lb', [{ v: 'rr', t: 'По кругу' }, { v: 'sticky', t: 'Липкая сессия: Анна всегда на одном' }], st.lb, 'accent')}
      </div>
      <div class="row"><button type="button" class="btn sm primary" data-a="add">Анна: добавить в корзину</button><button type="button" class="btn sm" data-a="open">Анна: открыть корзину</button><button type="button" class="btn sm ghost" data-a="drop">Уронить экземпляр 2</button><button type="button" class="btn sm ghost" data-a="reset">Сначала</button></div></div>
      <div class="rls-inst" data-i></div>
      <div data-redis></div>
      <div class="rls-log" data-log></div>
      <div data-n></div>
    </div>`;
    const alive = () => [0, 1, 2].filter(i => !st.down[i]);
    function route() {
      const al = alive();
      if (st.lb === 'sticky') { if (st.sticky == null || st.down[st.sticky]) st.sticky = al[0]; return st.sticky; }
      const i = al[st.n % al.length]; return i;
    }
    function act(a) {
      if (a === 'reset') { Object.assign(st, { n: 0, added: 0, carts: [[], [], []], shared: [], down: {}, log: [], sticky: null }); return; }
      if (a === 'drop') {
        st.down[1] = !st.down[1];
        if (st.down[1]) { const lost = st.carts[1].length; st.carts[1] = []; st.log.unshift({ k: 'warn', h: `Экземпляр 2 упал${st.store === 'mem' && lost ? ` — его память пропала вместе с ${lost} ${TR.plural(lost, 'товаром', 'товарами', 'товарами')} в корзине` : ''}. Балансировщик шлёт запросы на 1 и 3.` }); }
        else st.log.unshift({ k: 'info', h: 'Экземпляр 2 поднялся — пустой, с чистой памятью.' });
        return;
      }
      const inst = route(); st.n++;
      if (a === 'add') {
        const item = ITEMS[st.added % ITEMS.length]; st.added++;
        (st.store === 'mem' ? st.carts[inst] : st.shared).push(item);
        st.log.unshift({ k: 'info', h: `Запрос №${st.n} → экземпляр ${inst + 1}: добавлен «${esc(item)}»${st.store === 'redis' ? ' (записан в Redis)' : ' (записан в память экземпляра)'}` });
      } else {
        const cart = st.store === 'mem' ? st.carts[inst] : st.shared;
        const ok = cart.length === st.added;
        st.log.unshift({ k: ok ? 'ok' : 'bad', h: `Запрос №${st.n} → экземпляр ${inst + 1}: Анна видит ${cart.length} из ${st.added} ${TR.plural(st.added, 'товара', 'товаров', 'товаров')}${ok ? '' : ' — где остальное?!'}` });
      }
      st.log = st.log.slice(0, 6);
    }
    function draw() {
      TR.$('[data-a="drop"]', pane).textContent = st.down[1] ? 'Поднять экземпляр 2' : 'Уронить экземпляр 2';
      TR.$('[data-i]', pane).innerHTML = [0, 1, 2].map(i => `<div class="rls-node ${st.down[i] ? 'off' : st.lb === 'sticky' && st.sticky === i ? 'hot' : ''}"><b>Экземпляр ${i + 1}</b><small>${st.down[i] ? 'лежит' : st.store === 'mem' ? 'память: ' + (st.carts[i].length ? esc(st.carts[i].join(', ')) : 'пусто') : 'ничего своего не помнит'}</small></div>`).join('');
      TR.$('[data-redis]', pane).innerHTML = st.store === 'redis' ? `<div class="rls-node ok"><b>Redis · cart:anna</b><small>${st.shared.length ? esc(st.shared.join(', ')) : 'пусто'}</small></div>` : '';
      TR.$('[data-log]', pane).innerHTML = st.log.length ? st.log.map(l => `<div class="${l.k}">${l.h}</div>`).join('') : '<div>Нажмите «Добавить в корзину» три раза, потом «Открыть корзину».</div>';
      let n;
      if (!st.n) n = ui.note('', 'Попробуйте', 'Анна добавляет в корзину смузи и батончик. Каждый её запрос балансировщик отправляет на один из трёх экземпляров приложения бара.');
      else if (st.store === 'mem' && st.lb === 'rr') n = ui.note('bad', 'Состояние в памяти + балансировка = корзина то есть, то нет', 'Каждый запрос попадает на следующий экземпляр, а корзина лежит в памяти того, кто её принял. Анна видит то одну часть корзины, то другую. Чтобы любой экземпляр мог обслужить любой запрос, экземпляр не должен хранить ничего своего.');
      else if (st.store === 'mem') n = ui.note('warn', 'Липкая сессия — костыль', 'Балансировщик приклеил Анну к одному экземпляру — корзина цела. Пока этот экземпляр жив. Уроните его: корзина пропадёт. И нагрузка распределяется неровно: «приклеенные» к горячему экземпляру ждут, хотя соседи свободны.');
      else n = ui.note('ok', 'Без состояния', 'Экземпляры ничего не помнят: корзина в общем Redis. Любой запрос — на любой экземпляр, упал один — Анна даже не заметила. Теперь экземпляры можно добавлять и убирать сколько угодно. Ядро «Пульса» устроено так же: вход — по токену, данные — в базе и Redis.');
      TR.$('[data-n]', pane).innerHTML = n;
    }
    TR.on(pane, 'click', '[data-a]', (e, b) => { act(b.dataset.a); draw(); });
    ui.onSeg(pane, (nm, v) => { st[nm] = v; st.sticky = null; draw(); });
    draw();
  }
  function lbSim(algo) {
    const free = [0, 0, 0], jobs = [[], [], []]; let waitL = 0, nL = 0, maxW = 0;
    for (let i = 0; i < 12; i++) {
      const t = i * 0.1, heavy = i % 3 === 2, dur = heavy ? 2 : 0.1;
      let k = i % 3;
      if (algo === 'least') { let best = Infinity; [0, 1, 2].forEach(j => { const rem = Math.max(0, free[j] - t); if (rem < best) { best = rem; k = j; } }); }
      const s = Math.max(t, free[k]), e = s + dur; free[k] = e;
      jobs[k].push({ s, e, heavy }); const w = s - t; maxW = Math.max(maxW, w);
      if (!heavy) { waitL += w; nL++; }
    }
    return { jobs, end: Math.max(...free), maxW, avgL: waitL / nL };
  }
  function drawLB(pane) {
    const st = { algo: 'rr' };
    pane.innerHTML = `<div class="stack">
      <div class="rls-box"><div class="rls-set"><div class="lbl">Как балансировщик выбирает</div>${ui.seg('algo', [{ v: 'rr', t: 'По кругу (round-robin)' }, { v: 'least', t: 'Наименее загруженный' }], st.algo, 'accent')}</div>
      <p class="small muted" style="margin:0">12 запросов к приложению бара, раз в 0,1 с. Каждый третий — тяжёлый: «отчёт о калориях за месяц», 2 секунды. Остальные — лёгкие: «заказать смузи», 0,1 с.</p></div>
      <div class="rls-gantt" data-g></div>
      <div class="rls-stats" data-st></div>
      <div data-n></div>
    </div>`;
    function draw() {
      const r = lbSim(st.algo), dom = Math.max(8.5, r.end);
      TR.$('[data-g]', pane).innerHTML = r.jobs.map((js, k) => `<div class="rls-grow"><span>Экз. ${k + 1}</span><div class="tr">${js.map(j => `<i class="${j.heavy ? 'heavy' : ''}" style="left:${(j.s / dom * 100).toFixed(2)}%;width:${Math.max(0.8, (j.e - j.s) / dom * 100).toFixed(2)}%"></i>`).join('')}</div><span class="ms">до ${nf(js.length ? js[js.length - 1].e : 0, 1)} с</span></div>`).join('') +
        `<div class="rls-grow"><span></span><div class="rls-axis"><span>0 с</span><span>${nf(dom / 2, 1)} с</span><span>${nf(dom, 1)} с</span></div><span></span></div>
         <div class="rls-axis" style="justify-content:flex-start;gap:14px"><span><i style="display:inline-block;width:12px;height:10px;background:var(--ok);border-radius:2px"></i> лёгкий</span><span><i style="display:inline-block;width:12px;height:10px;background:var(--warn);border-radius:2px"></i> тяжёлый</span></div>`;
      TR.$('[data-st]', pane).innerHTML = `
        <div class="stat"><span class="k">Всё готово через</span><span class="v ${r.end > 5 ? 'bad' : 'ok'}">${nf(r.end, 1)} с</span><span class="s">последний ответ</span></div>
        <div class="stat"><span class="k">Самое долгое ожидание</span><span class="v ${r.maxW > 2 ? 'bad' : 'ok'}">${nf(r.maxW, 1)} с</span><span class="s">до начала обработки</span></div>
        <div class="stat"><span class="k">Лёгкие ждут в среднем</span><span class="v ok">${nf(r.avgL, 2)} с</span><span class="s">заказ смузи</span></div>
        <div class="stat"><span class="k">Самый загруженный</span><span class="v">${nf(Math.max(...r.jobs.map(js => js.reduce((s, j) => s + j.e - j.s, 0))), 1)} с работы</span><span class="s">у одного экземпляра</span></div>`;
      TR.$('[data-n]', pane).innerHTML = st.algo === 'rr'
        ? ui.note('warn', 'По кругу — честно, но слепо', 'Балансировщик раздаёт запросы по очереди, не глядя, кто чем занят. Все тяжёлые достались экземпляру 3 — он работает 8 секунд, а первые два давно свободны. Так бывает, когда запросы неравные.')
        : ui.note('ok', 'Наименее загруженный', 'Балансировщик отдаёт запрос тому, у кого меньше всего работы прямо сейчас. Тяжёлые разошлись по всем трём — всё готово намного раньше. Для «Пульса», где запись быстрая, а выгрузка отчёта долгая, это важно. Ещё балансировщик проверяет здоровье экземпляров и не шлёт запросы упавшим.');
    }
    ui.onSeg(pane, (n, v) => { if (n === 'algo') { st.algo = v; draw(); } });
    draw();
  }
  const howScale = {
    id: 'how-scale', covers: ['peak-lab'], title: 'Как это работает: масштабирование, балансировщик и база', free: true, noReset: true,
    simple: {
      icon: '📈',
      plain: 'Справиться с ростом можно двумя путями: поставить одну машину мощнее или поставить рядом ещё такие же. Второй путь почти без предела, но машины не должны хранить ничего своего.',
      analogy: 'Бар клуба. Можно нанять одного супербармена — но он один, заболел — бар закрыт, а быстрее он не станет. Можно поставить пять обычных барменов — но тогда заказ, принятый у одного, должен видеть любой, а не только тот, кто его записал на бумажке. Распорядитель у входа решает, к какому бармену идти, — это балансировщик. А склад у бара один: если каждый бармен займёт себе по десять тележек «про запас», тележек на всех не хватит — их выдаёт кладовщик на время (PgBouncer).',
      tech: '<b>Вертикальное масштабирование</b> — мощнее машина: просто, но дорого и есть потолок. <b>Горизонтальное</b> — больше экземпляров за <b>балансировщиком</b>. Условие — сервис <b>без состояния</b> (stateless): сессии, корзины, черновики хранятся во внешнем хранилище (Redis, база), а не в памяти экземпляра. Алгоритмы балансировки: по кругу (round-robin), наименее загруженный (least connections), липкая сессия (sticky — костыль для сервисов с состоянием). Экземпляры масштабируются легко, база — нет: у PostgreSQL ограничено число соединений (<code>max_connections</code>), поэтому между ними ставят <b>PgBouncer</b>. <b>Шардирование</b> — деление данных на несколько баз — нужно, только когда одна машина упирается в запись или объём.'
    },
    lead: ui.brief({
      situation: 'Соседний пример — приложение бара клуба: заказ смузи, корзина, отчёт о калориях. Бар становится популярным, заказов всё больше. Пять вкладок: как расти, почему память экземпляра ломает рост, как балансировщик раздаёт запросы, сколько соединений выдержит база и когда одной базы мало.',
      todo: [
        '«Вверх или вширь»: двигайте нагрузку до 5 000 в обоих режимах и роняйте машину. Где потолок и что будет при отказе?',
        '«Без состояния»: в режиме «В памяти экземпляра» добавьте три товара и откройте корзину. Потом включите липкую сессию и уроните экземпляр 2. Потом переключитесь на Redis.',
        '«Балансировщик»: сравните «по кругу» и «наименее загруженный». Куда попали тяжёлые запросы?',
        '«Пул соединений»: поставьте 6 экземпляров и пул 100, потом 12 экземпляров. Сколько не подключилось? Включите PgBouncer.',
        '«Когда шардировать»: при каких записях в секунду и объёме одной PostgreSQL мало? Где на этих шкалах «Пульс»?'
      ],
      look: 'Карточки — машины или экземпляры приложения: рамка зелёная — загружен нормально, жёлтая — на пределе, красная — перегружен, пунктир — лежит. В журнале «Без состояния» — куда балансировщик отправил каждый запрос Анны и что она увидела. В «Пуле соединений» полоска — сколько соединений открыто, чёрная черта — предел базы.'
    }),
    render(el) {
      el.classList.add('rls-root');
      ui.tabs(mount(el), [
        { id: 'vh', t: 'Вверх или вширь', render: pane => drawVH(fresh(pane)) },
        { id: 'state', t: 'Без состояния', render: pane => drawState(fresh(pane)) },
        { id: 'lb', t: 'Балансировщик', render: pane => drawLB(fresh(pane)) },
        { id: 'pool', t: 'Пул соединений', render: pane => drawPg(fresh(pane)) },
        { id: 'shard', t: 'Когда шардировать', render: pane => drawShard(fresh(pane)) }
      ], 'vh');
    }
  };

  // =====================================================================
  // Теория 2. Кэш: cache-aside и write-through, TTL, сброс, устаревшие ответы, громовое стадо
  // =====================================================================
  const TTL_T = [{ v: '10', t: '10 с' }, { v: '60', t: '60 с' }, { v: '300', t: '5 мин' }];
  function drawAside(pane) {
    const st = { strat: 'aside', ttl: '60', evict: 'off' };
    const reset = () => Object.assign(st, { t: 0, db: 350, cache: null, log: [], chips: [], hits: 0, miss: 0, stale: 0, dbr: 0 });
    reset();
    pane.innerHTML = `<div class="stack">
      <div class="rls-box">
        <div class="rls-set">
          <div class="lbl">Стратегия</div>${ui.seg('strat', [{ v: 'aside', t: 'Cache-aside: кэш сбоку' }, { v: 'through', t: 'Write-through: пишем через кэш' }], st.strat, 'accent')}
          <div class="lbl">TTL записи в кэше</div>${ui.seg('ttl', TTL_T, st.ttl, 'accent')}
          <div class="lbl">Сброс по событию<small>«цена изменилась» → удалить ключ</small></div><div data-ev></div>
        </div>
        <div class="row"><button type="button" class="btn sm primary" data-a="read">Клиент открыл меню (+5 с)</button><button type="button" class="btn sm" data-a="wait">Прошло 30 с</button><button type="button" class="btn sm" data-a="write">Бармен меняет цену смузи</button><button type="button" class="btn sm ghost" data-a="reset">Сначала</button></div>
      </div>
      <div class="rls-inst" data-s></div>
      <div class="rls-chips" data-c></div>
      <div class="rls-stats" data-st></div>
      <div class="rls-log" data-log></div>
      <div data-n></div>
    </div>`;
    function act(a) {
      if (a === 'reset') { reset(); return; }
      const ttl = +st.ttl;
      if (a === 'wait') { st.t += 30; st.log.unshift({ k: '', h: `Прошло 30 с. Время: ${st.t} с.` }); }
      if (a === 'read') {
        st.t += 5;
        if (st.cache && st.t < st.cache.exp) {
          if (st.cache.v !== st.db) { st.stale++; st.chips.push({ k: 'stale', t: st.t }); st.log.unshift({ k: 'bad', h: `${st.t} с · <b>Попадание, но старое</b>: кэш отдал ${st.cache.v} ₽, а в базе уже ${st.db} ₽. Клиент закажет по одной цене, а на кассе будет другая.` }); }
          else { st.hits++; st.chips.push({ k: 'hit', t: st.t }); st.log.unshift({ k: 'ok', h: `${st.t} с · <b>Попадание</b>: цена ${st.cache.v} ₽ из кэша, база не тронута. Осталось жить ${st.cache.exp - st.t} с.` }); }
        } else {
          st.miss++; st.dbr++; st.chips.push({ k: 'miss', t: st.t });
          st.log.unshift({ k: 'info', h: `${st.t} с · <b>Промах</b>: ${st.cache ? 'запись истекла' : 'в кэше пусто'} → прочитали базу (${st.db} ₽) → положили в кэш на ${ttl} с.` });
          st.cache = { v: st.db, exp: st.t + ttl };
        }
      }
      if (a === 'write') {
        st.db += 30; st.chips.push({ k: 'wr', t: st.t, w: 1 });
        if (st.strat === 'through') { st.cache = { v: st.db, exp: st.t + ttl }; st.log.unshift({ k: 'ok', h: `${st.t} с · Цена ${st.db} ₽ записана в базу <b>и сразу в кэш</b>. Следующий клиент увидит новую.` }); }
        else if (st.evict === 'on') { st.cache = null; st.log.unshift({ k: 'ok', h: `${st.t} с · Цена ${st.db} ₽ в базе; по событию «цена изменилась» ключ <code>menu:club-12</code> удалён. Следующий запрос — промах и свежая цена.` }); }
        else st.log.unshift({ k: 'warn', h: `${st.t} с · Цена ${st.db} ₽ в базе. Кэш об этом не знает${st.cache && st.t < st.cache.exp ? ` и будет отдавать ${st.cache.v} ₽ ещё ${st.cache.exp - st.t} с — до конца TTL` : ''}.` });
      }
      st.log = st.log.slice(0, 5); st.chips = st.chips.slice(-24);
    }
    function draw() {
      const ev = TR.$('[data-ev]', pane);
      ev.innerHTML = ui.seg('evict', [{ v: 'off', t: 'нет' }, { v: 'on', t: 'да' }], st.evict, 'accent') + (st.strat === 'through' ? '<div class="small dim">При write-through кэш обновляется при записи — сброс не нужен.</div>' : '');
      if (st.strat === 'through') TR.$$('button', ev).forEach(b => { b.disabled = true; });
      const live = st.cache && st.t < st.cache.exp;
      TR.$('[data-s]', pane).innerHTML = `
        <div class="rls-node"><b>Время</b><small>${st.t} с от начала</small></div>
        <div class="rls-node ok"><b>База: ${st.db} ₽</b><small>правда</small></div>
        <div class="rls-node ${!live ? 'off' : st.cache.v !== st.db ? 'bad' : 'ok'}"><b>Кэш: ${live ? st.cache.v + ' ₽' : 'пусто'}</b><small>${live ? `истекает через ${st.cache.exp - st.t} с${st.cache.v !== st.db ? ' · устарел!' : ''}` : st.cache ? 'запись истекла' : 'ключа нет'}</small></div>`;
      TR.$('[data-c]', pane).innerHTML = st.chips.length ? st.chips.map(c => `<span class="${c.k}" title="${c.t} с">${c.w ? '✎' : c.k === 'hit' ? '✓' : c.k === 'miss' ? 'БД' : '✗'}</span>`).join('') : '<span class="wr">шкала запросов пуста</span>';
      TR.$('[data-st]', pane).innerHTML = `
        <div class="stat"><span class="k">Попадания</span><span class="v ok">${st.hits}</span><span class="s">ответ из кэша</span></div>
        <div class="stat"><span class="k">Промахи</span><span class="v">${st.miss}</span><span class="s">пошли в базу</span></div>
        <div class="stat"><span class="k">Устаревшие ответы</span><span class="v ${st.stale ? 'bad' : 'ok'}">${st.stale}</span><span class="s">кэш соврал</span></div>
        <div class="stat"><span class="k">Чтений базы</span><span class="v">${st.dbr} из ${st.hits + st.miss + st.stale}</span><span class="s">запросов меню</span></div>`;
      TR.$('[data-log]', pane).innerHTML = st.log.length ? st.log.map(l => `<div class="${l.k}">${l.h}</div>`).join('') : '<div>Откройте меню пару раз, поменяйте цену и снова откройте меню.</div>';
      let n;
      if (st.stale) n = ui.note('bad', 'Кэш — вторая правда', `Пока запись живёт в кэше, он не знает, что база изменилась. Чем длиннее TTL, тем дольше враньё. Лекарства: короткий TTL, сброс ключа по событию «цена изменилась» (<b>инвалидация</b>) или write-through. Попробуйте каждое.`);
      else if (st.strat === 'through') n = ui.note('ok', 'Write-through', 'Каждая запись идёт и в базу, и в кэш — кэш всегда свежий. Цена: каждый, кто меняет данные, обязан обновить кэш. Если цену поменяли в обход (скриптом, другим модулем) — кэш врёт до конца TTL. И в кэш попадает то, что никто не читает.');
      else n = ui.note('', 'Cache-aside', 'Приложение само смотрит в кэш; нет — читает базу и кладёт копию в кэш на время TTL. Кэш ничего не знает о базе — он просто помнит, что ему дали. Это стратегия «Пульса» для расписания: просто и надёжно, если кэш упал — читаем базу.');
      TR.$('[data-n]', pane).innerHTML = n;
    }
    TR.on(pane, 'click', '[data-a]', (e, b) => { act(b.dataset.a); draw(); });
    ui.onSeg(pane, (nm, v) => { if (['strat', 'ttl', 'evict'].includes(nm)) { st[nm] = v; draw(); } });
    draw();
  }
  const H_KEYS = 60, H_RATE = 2000, H_CAP = 300, H_LT = 0.3;
  function herdSim(jit, sf) {
    const per = H_RATE / H_KEYS, bars = [];
    let q0;
    if (!jit) {
      if (sf) q0 = H_KEYS;
      else { q0 = H_KEYS * per * H_LT; if (q0 > H_CAP) q0 = H_KEYS * per * H_LT * q0 / H_CAP; }
    }
    for (let s = -10; s < 60; s++) {
      let q = 2;
      if (!jit) { if (s === 0) q += q0; if (s === 1 && !sf) q += q0 * 0.4; }
      else q += sf ? 1 : per * H_LT;
      bars.push({ s, q });
    }
    return { bars, peak: Math.max(...bars.map(b => b.q)) };
  }
  function drawHerd(pane) {
    const st = { jit: 'off', sf: 'off' };
    pane.innerHTML = `<div class="stack">
      <div class="rls-box"><p class="small muted" style="margin:0">Меню баров ${H_KEYS} клубов лежит в кэше, каждый клуб — свой ключ. Все ключи прогрели в 19:55 с TTL 5 минут. В 20:00 начинается «счастливый час» — ${nf(H_RATE)} запросов меню в секунду. Загрузка меню из базы — ${H_LT * 1000} мс, база спокойно выдерживает ~${H_CAP} таких запросов в секунду.</p>
        <div class="rls-set">
          <div class="lbl">Разнесённый TTL<small>5 мин ± 30 с случайно</small></div>${ui.seg('jit', [{ v: 'off', t: 'нет: у всех ровно 5 мин' }, { v: 'on', t: 'да' }], st.jit, 'accent')}
          <div class="lbl">Одна загрузка на ключ<small>остальные ждут её результат</small></div>${ui.seg('sf', [{ v: 'off', t: 'нет: каждый промах идёт в базу' }, { v: 'on', t: 'да' }], st.sf, 'accent')}
        </div></div>
      <div class="eyebrow">Запросов в базу в секунду, 19:59:50 – 20:01:00</div>
      <div data-ch></div>
      <div class="rls-stats" data-st></div>
      <div data-n></div>
    </div>`;
    function draw() {
      const r = herdSim(st.jit === 'on', st.sf === 'on'), top = Math.max(400, r.peak) * 1.05;
      TR.$('[data-ch]', pane).innerHTML = `<div class="rls-chart">${r.bars.map(b => `<i class="${b.q > H_CAP ? 'over' : ''}" style="height:${Math.max(1, b.q / top * 100).toFixed(1)}%" title="${b.s} с: ${Math.round(b.q)}"></i>`).join('')}<div class="cap" style="bottom:${(H_CAP / top * 100).toFixed(1)}%"><span>предел базы ${H_CAP}/с</span></div></div><div class="rls-axis"><span>19:59:50</span><span>20:00:00</span><span>20:00:30</span><span>20:01:00</span></div>`;
      const over = r.peak > H_CAP;
      TR.$('[data-st]', pane).innerHTML = `
        <div class="stat"><span class="k">Пик запросов в базу</span><span class="v ${over ? 'bad' : 'ok'}">${nf(r.peak)}/с</span><span class="s">при пределе ${H_CAP}</span></div>
        <div class="stat"><span class="k">Меню в 20:00</span><span class="v ${over ? 'bad' : 'ok'}">${over ? 'тормозит' : 'как обычно'}</span><span class="s">${over ? 'база захлебнулась' : 'база спокойна'}</span></div>
        <div class="stat"><span class="k">Ключей истекло сразу</span><span class="v">${st.jit === 'on' ? '≈ 1 в секунду' : H_KEYS}</span><span class="s">${st.jit === 'on' ? 'размазаны на минуту' : 'все в одну секунду'}</span></div>
        <div class="stat"><span class="k">Загрузок одного ключа</span><span class="v">${st.sf === 'on' ? '1' : '≈ ' + nf(H_RATE / H_KEYS * H_LT)}</span><span class="s">${st.sf === 'on' ? 'остальные ждут её' : 'каждый промах сам'}</span></div>`;
      TR.$('[data-n]', pane).innerHTML = st.jit === 'off' && st.sf === 'off'
        ? ui.note('bad', 'Громовое стадо', `В 20:00:00 истекли все ${H_KEYS} ключей разом — ровно когда пришёл пик. Каждый запрос — промах, каждый промах идёт в базу. База медленнее отвечает — загрузка длится дольше — промахов ещё больше. Кэш, который должен был защищать базу, в самый важный момент отправил на неё всех.`)
        : st.jit === 'on' && st.sf === 'on' ? ui.note('ok', 'Обе защиты', 'Ключи истекают вразнобой, и по каждому в базу идёт один запрос. Нагрузка на базу почти не видна. В «Пульсе» ещё прогревают кэш расписания перед 20:00 и обновляют горячие ключи заранее, до истечения.')
          : st.jit === 'on' ? ui.note('warn', 'Размазали во времени', 'Ключи истекают в разные секунды — пик ушёл. Но по каждому ключу в момент истечения в базу всё ещё бежит десяток одинаковых запросов.')
            : ui.note('warn', 'Одна загрузка на ключ', `Первый промах по ключу идёт в базу, остальные ждут его результат (блокировка на ключ или «одна загрузка в полёте»). В базу — ${H_KEYS} запросов вместо тысяч. Но все в одну секунду — нужен ещё и разнесённый TTL.`);
    }
    ui.onSeg(pane, (nm, v) => { if (nm === 'jit' || nm === 'sf') { st[nm] = v; draw(); } });
    draw();
  }
  const howCache = {
    id: 'how-cache', covers: ['cache-design', 'cache-danger', 'why-db'], title: 'Как это работает: кэш, TTL и сброс', free: true, noReset: true,
    simple: {
      icon: '🗂️',
      plain: 'Кэш — быстрая копия данных под рукой, чтобы не ходить каждый раз в базу. Копия может устареть: важно решить, сколько ей жить и когда её выбрасывать.',
      analogy: 'Бармен держит распечатку меню на стойке, чтобы не бегать в кабинет управляющего за каждой ценой. Управляющий поднял цену — а распечатка старая. Можно менять распечатку раз в час (TTL), можно попросить управляющего каждый раз звонить и говорить «выбрось меню» (сброс по событию), а можно, чтобы он сам приносил новую распечатку (write-through).',
      tech: '<b>Cache-aside</b>: приложение ищет в кэше; промах — читает базу и кладёт копию. <b>Write-through</b>: запись идёт через кэш — и в базу, и в кэш. <b>TTL</b> — время жизни записи. <b>Инвалидация</b> — удаление записи при изменении данных. <b>Громовое стадо</b> (thundering herd) — массовое истечение ключей под нагрузкой: все промахи разом бьют в базу; защита — разнесённый TTL (jitter) и одна загрузка на ключ (single flight).'
    },
    lead: ui.brief({
      situation: 'Соседний пример — меню бара клуба. Цены читают тысячи раз, а меняют пару раз в день. Две вкладки: как работает кэш и почему он врёт; что бывает, когда весь кэш истекает в одну секунду.',
      todo: [
        '«Cache-aside и write-through»: откройте меню 3 раза, нажмите «Бармен меняет цену», снова откройте меню. Смотрите на счётчик «Устаревшие ответы».',
        'Повторите с TTL 10 с и 5 мин, потом включите «Сброс по событию», потом переключитесь на write-through. Каждый раз начинайте «Сначала».',
        '«Громовое стадо»: посмотрите на график без защиты, потом включите по одной обе защиты.'
      ],
      look: 'Шкала запросов: ✓ — попадание (ответ из кэша), БД — промах (пошли в базу), ✗ — устаревший ответ (кэш отдал старую цену), ✎ — бармен поменял цену. На графике красные столбцы — секунды, когда база получила больше, чем выдерживает.'
    }),
    render(el) {
      el.classList.add('rls-root');
      ui.tabs(mount(el), [
        { id: 'aside', t: 'Cache-aside и write-through', render: pane => drawAside(fresh(pane)) },
        { id: 'herd', t: 'Громовое стадо', render: pane => drawHerd(fresh(pane)) }
      ], 'aside');
    }
  };

  // =====================================================================
  // Теория 1 (продолжение). База: пул соединений и когда шардировать
  // =====================================================================
  const PG_MAX = 400;
  function drawPg(pane) {
    const st = { n: 6, p: '100', b: 'off' };
    pane.innerHTML = `<div class="stack">
      <div class="rls-box"><div class="rls-set">
        <div class="lbl">Экземпляров приложения</div><div class="rls-rng"><input type="range" min="1" max="12" value="${st.n}" data-n aria-label="Экземпляров"><b data-nv></b></div>
        <div class="lbl">Пул соединений<small>у каждого экземпляра</small></div>${ui.seg('p', [{ v: '10', t: '10' }, { v: '20', t: '20' }, { v: '50', t: '50' }, { v: '100', t: '100 — по умолчанию' }], st.p, 'accent')}
        <div class="lbl">PgBouncer</div>${ui.seg('b', [{ v: 'off', t: 'нет: каждый сам к базе' }, { v: 'on', t: 'да: 60 соединений к базе на всех' }], st.b, 'accent')}
      </div></div>
      <div data-bars></div>
      <div class="rls-stats" data-st></div>
      <div data-note></div>
    </div>`;
    function draw() {
      const n = st.n, p = +st.p, app = n * p, bo = st.b === 'on', db = bo ? 60 : app, over = db > PG_MAX;
      TR.$('[data-nv]', pane).textContent = n;
      const bar = (lbl, v, max, kind, lim) => `<div class="rls-bar"><div class="k"><span>${lbl}</span><span class="mono">${nf(v)}${lim ? ' / предел ' + lim : ''}</span></div><div class="tr"><i class="${kind}" style="width:${Math.min(100, v / max * 100).toFixed(1)}%"></i>${lim ? `<span class="lim" style="left:${(lim / max * 100).toFixed(1)}%"></span>` : ''}</div></div>`;
      const max = Math.max(1300, app);
      TR.$('[data-bars]', pane).innerHTML = `<div class="stack tight">${bo ? bar('Приложение → PgBouncer (дешёвые клиентские соединения)', app, max, 'ok') : ''}${bar('Соединений с PostgreSQL', db, max, over ? 'bad' : db > 200 ? 'warn' : 'ok', PG_MAX)}</div>`;
      TR.$('[data-st]', pane).innerHTML = `
        <div class="stat"><span class="k">Соединений с базой</span><span class="v ${over ? 'bad' : db > 200 ? 'warn' : 'ok'}">${nf(db)}</span><span class="s">max_connections = ${PG_MAX}</span></div>
        <div class="stat"><span class="k">Память на соединения</span><span class="v ${db * 10 > 2000 ? 'warn' : 'ok'}">≈ ${nf(db * 10 / 1000, 1)} ГБ</span><span class="s">≈ 10 МБ на каждое</span></div>
        <div class="stat"><span class="k">Не подключились</span><span class="v ${over ? 'bad' : 'ok'}">${over ? Math.ceil((db - PG_MAX) / p) + ' экз.' : '0'}</span><span class="s">${over ? 'too many clients' : 'всем хватило'}</span></div>
        <div class="stat"><span class="k">Реально работают сразу</span><span class="v">≈ 30–60</span><span class="s">база на 16 ядрах</span></div>`;
      TR.$('[data-note]', pane).innerHTML = over
        ? ui.note('bad', 'База отказывает в соединениях', `${n} × ${p} = ${nf(app)} соединений, а PostgreSQL принимает ${PG_MAX}. Экземпляры, которые стартовали позже, получают <code>FATAL: sorry, too many clients already</code> и отвечают клиентам ошибками. Хуже всего — автоскейлинг: в пик он добавляет экземпляры, и каждый новый делает только хуже. Соединения при этом почти все простаивают: запрос к базе длится миллисекунды.`)
        : bo ? ui.note('ok', 'PgBouncer', `Приложения держат ${nf(app)} лёгких соединений с PgBouncer, а он — ${db} настоящих с PostgreSQL и выдаёт их на время транзакции. Добавляй экземпляры сколько угодно — база этого не почувствует. Так у «Пульса».`)
          : db > 200 ? ui.note('warn', 'На грани', 'Соединения пока помещаются, но каждое — отдельный процесс PostgreSQL с памятью. Сотни простаивающих соединений съедают память и время на переключение. Добавьте экземпляров — и упрётесь в предел.')
            : ui.note('', 'Пока помещается', 'Маленький пул на каждом экземпляре тоже работает — пока экземпляров немного. Подвиньте ползунок до 12 или выберите пул 100.');
    }
    TR.$('[data-n]', pane).addEventListener('input', e => { st.n = +e.target.value; draw(); });
    ui.onSeg(pane, (nm, v) => { if (nm === 'p' || nm === 'b') { st[nm] = v; draw(); } });
    draw();
  }
  const SH_W = [400, 1000, 3000, 8000, 20000, 50000], SH_D = [0.3, 1, 3, 10, 30];
  function drawShard(pane) {
    const st = { w: 0, d: 0 };
    pane.innerHTML = `<div class="stack">
      <div class="rls-box">
        <label class="field"><span>Записей в базу в секунду (в пик): <b data-wv></b></span><input type="range" class="rls-range" min="0" max="${SH_W.length - 1}" value="0" data-w aria-label="Записей в секунду"></label>
        <label class="field"><span>Объём данных в базе: <b data-dv></b></span><input type="range" class="rls-range" min="0" max="${SH_D.length - 1}" value="0" data-d aria-label="Объём данных"></label>
      </div>
      <div data-v></div>
    </div>`;
    function draw() {
      const w = SH_W[st.w], d = SH_D[st.d];
      TR.$('[data-wv]', pane).textContent = nf(w) + (st.w === 0 ? ' — «Пульс» через 2 года' : '');
      TR.$('[data-dv]', pane).textContent = nf(d, 1) + ' ТБ' + (st.d === 0 ? ' — «Пульс» через 2 года' : '');
      const lvl = (w > 10000 || d > 5) ? 2 : (w > 2500 || d > 2) ? 1 : 0;
      const verdict = [
        ui.note('ok', 'Одна PostgreSQL держит', `${nf(w)} записей в секунду и ${nf(d, 1)} ТБ — обычная работа для одной хорошей машины с репликами. Шардирование сейчас — только цена без пользы. «Пульсу» хватает: мастер, синхронная реплика, две реплики для чтения, посещения — в ClickHouse.`),
        ui.note('warn', 'Пора думать, но не резать', 'Сначала дешёвые шаги: машина мощнее, реплики для чтения, кэш, партиционирование больших таблиц (посещения по месяцам), вынос аналитики в отдельное хранилище. Шардирование — когда эти шаги кончились.'),
        ui.note('bad', 'Одной базы мало — шардирование', 'Данные делят по ключу (например, по городу или клиенту) на несколько баз. Цена: запрос «по всей сети» обходит все шарды, транзакция между шардами — сага или 2PC, перенос данных при добавлении шарда, ключ шардирования почти нельзя поменять. Для «Пульса» с ключом «город»: клиент из Казани записывается в клуб Москвы — это уже два шарда.')
      ][lvl];
      TR.$('[data-v]', pane).innerHTML = verdict + ui.note('info', 'Позиция аналитика', 'Решение о шардировании принимают по цифрам, а цифры — из требований: сколько записей в пик, сколько лет храним, растут ли данные. Аналитик приносит оценку нагрузки (как на неделе 2) и отвечает на вопрос «какие запросы пойдут через несколько шардов».');
    }
    TR.$('[data-w]', pane).addEventListener('input', e => { st.w = +e.target.value; draw(); });
    TR.$('[data-d]', pane).addEventListener('input', e => { st.d = +e.target.value; draw(); });
    draw();
  }
  // =====================================================================
  // Практика 1. Лаборатория «Воскресенье через 2 года»
  // =====================================================================
  const RD = 1000, WR = 400, INST = 300, DBCAP = 2500, SLO = 300;
  const HIT = { '5': 0.9, '30': 0.98, '300': 0.997 };
  const O_CACHE = [{ v: 'off', t: 'выключен' }, { v: '5', t: 'TTL 5 с' }, { v: '30', t: 'TTL 30 с' }, { v: '300', t: 'TTL 5 мин' }];
  const O_REP = [0, 1, 2, 3].map(v => ({ v: String(v), t: String(v) }));
  const O_CONN = [{ v: '100', t: 'по 100 на экземпляр (по умолчанию)' }, { v: '20', t: 'по 20 на экземпляр' }, { v: 'bouncer', t: 'PgBouncer: 60 соединений к базе' }];
  const fq = u => u < 0.95 ? 1 / (1 - u) : Infinity;
  function simPeak(a) {
    const n = +a.n, k = +a.rep, cache = a.cache !== 'off', h = cache ? HIT[a.cache] : 0;
    const rhoApp = (WR + RD * (cache ? 0.5 : 1)) / (n * INST);
    const readU = RD * (1 - h) * 2;
    const master = WR * 3 + (k ? 0 : readU), uM = master / DBCAP, uR = k ? readU / k / DBCAP : uM;
    const conns = a.conn === 'bouncer' ? 60 : n * +a.conn, connErr = conns > PG_MAX ? (conns - PG_MAX) / conns : 0;
    const pW = 80 * fq(rhoApp) + 40 * fq(uM);
    const pR = 50 * fq(rhoApp) + (cache && h >= 0.95 ? 5 : 30 * fq(uR));
    let err = connErr;
    [rhoApp, uM, uR].forEach(u => { if (u >= 0.95) err = Math.max(err, (u - 0.95) / u + 0.05); });
    const staleS = cache ? +a.cache : 0;
    const crit = {
      w: pW <= SLO, r: pR <= SLO, e: err < 0.001, c: conns <= PG_MAX, s: staleS <= 30
    };
    return { n, k, cache, h, rhoApp, uM, uR, conns, pW, pR, err, staleS, crit, green: Object.values(crit).every(Boolean), cost: n + k + 1 + (cache ? 1 : 0) + (a.conn === 'bouncer' ? 0.5 : 0) };
  }
  const PEAK_CRIT = [
    { id: 'w', t: `Запись: p95 ≤ ${SLO} мс` }, { id: 'r', t: `Расписание: p95 ≤ ${SLO} мс` }, { id: 'e', t: 'Ошибок меньше 0,1 %' },
    { id: 'c', t: `Соединений с PostgreSQL ≤ ${PG_MAX}` }, { id: 's', t: 'Свободные места на экране отстают не больше чем на 30 с' }
  ];
  const PEAK_Q = {
    q: 'Сергей включил автоскейлинг: в пик ядро вырастает до 12 экземпляров. Что будет, если у каждого пул по 100 соединений и PgBouncer нет?', seed: 'rls-peak-q3',
    options: [
      { t: '1 200 соединений при пределе 400: новые экземпляры не подключатся к базе и будут отвечать ошибками — автоскейлинг сделает хуже', ok: 1, why: 'Верно. Экземпляры масштабируются легко, база — нет. Нужен PgBouncer или маленький пул, рассчитанный на максимум экземпляров.' },
      { t: 'База станет быстрее: больше соединений — больше параллельной работы', why: 'Нет: база на 16 ядрах реально работает с несколькими десятками запросов одновременно. Остальные соединения только едят память.' },
      { t: 'Ничего: PostgreSQL сам закроет лишние соединения', why: 'PostgreSQL не закрывает чужие соединения — он отказывает новым: «too many clients already».' },
      { t: 'Запросы встанут в очередь и выполнятся чуть позже', why: 'Очередь бывает в пуле приложения или в PgBouncer. Сама база при превышении предела отвечает ошибкой подключения.' }
    ]
  };
  function flowHTML(r, a) {
    const inst = Array.from({ length: r.n }, (_, i) => `<span class="${r.rhoApp >= 0.95 ? 'bad' : r.rhoApp > 0.8 ? 'warn' : ''}">${i + 1}</span>`).join('');
    const u = x => Math.round(Math.min(x, 9.99) * 100) + ' %';
    const cls = x => x >= 0.95 ? 'bad' : x > 0.75 ? 'warn' : 'ok';
    return `<div class="rls-flow">
      <div class="col"><div class="eyebrow">Балансировщик → ядро</div><div class="rls-node ${cls(r.rhoApp)}"><b>${r.n} ${TR.plural(r.n, 'экземпляр', 'экземпляра', 'экземпляров')}</b><small>загрузка ${u(r.rhoApp)}</small><div class="rls-mini">${inst}</div></div></div>
      <div class="col"><div class="eyebrow">Кэш</div><div class="rls-node ${r.cache ? (r.staleS > 30 ? 'warn' : 'ok') : 'off'}"><b>Redis</b><small>${r.cache ? `попаданий ${nf(r.h * 100, 1)} % · TTL ${r.staleS >= 60 ? r.staleS / 60 + ' мин' : r.staleS + ' с'}` : 'выключен: все чтения — в базу'}</small></div>
        <div class="rls-node ${a.conn === 'bouncer' ? 'ok' : r.conns > PG_MAX ? 'bad' : 'off'}"><b>${a.conn === 'bouncer' ? 'PgBouncer' : 'Без посредника'}</b><small>${nf(r.conns)} соединений с базой</small></div></div>
      <div class="col"><div class="eyebrow">Мастер</div><div class="rls-node ${cls(r.uM)}"><b>PostgreSQL мастер</b><small>загрузка ${u(r.uM)} · запись ${WR}/с${r.k ? '' : ' + все чтения'}</small></div></div>
      <div class="col"><div class="eyebrow">Реплики для чтения</div>${r.k ? Array.from({ length: r.k }, (_, i) => `<div class="rls-node ${cls(r.uR)}"><b>Реплика ${i + 1}</b><small>загрузка ${u(r.uR)}</small></div>`).join('') : '<div class="rls-node off"><b>Нет реплик</b><small>чтения идут в мастер</small></div>'}</div>
    </div>`;
  }
  const peakTask = {
    id: 'peak-lab', title: 'Воскресенье через два года',
    simple: howScale.simple,
    lead: ui.brief({
      situation: `Через два года в воскресенье в 20:00 приходят 20 000 человек за 5 минут: ~${nf(RD)} чтений расписания и ~${WR} записей в секунду (уже с запасом ×3). Требование: запись и расписание — p95 ≤ ${SLO} мс, ошибок меньше 0,1 %. Один экземпляр ядра держит ~${INST} запросов в секунду (чтение из кэша — вдвое дешевле). PostgreSQL принимает не больше ${PG_MAX} соединений. Сейчас стоит то, что было в сезоне 1: 2 экземпляра, без кэша, без реплик.`,
      todo: [
        'Подвигайте ползунок «Экземпляров ядра» без кэша. Почему после какого-то числа экземпляров p95 записи не лечится?',
        'Добавьте реплики, включите кэш, выберите способ соединения с базой. Следите за пятью проверками под схемой.',
        'Найдите конфигурацию, где все пять проверок зелёные. Подешевле — лучше: лишние машины тоже деньги.',
        'Ответьте на вопрос про автоскейлинг и нажмите «Проверить».'
      ],
      look: `Схема — путь запроса: балансировщик → экземпляры ядра → кэш Redis → PgBouncer → мастер и реплики PostgreSQL. Проценты — загрузка: до 75 % — зелёный, выше — жёлтый, от 95 % — красный (очередь растёт без конца, запросы падают по таймауту). p95 — время, быстрее которого отвечают 95 % запросов.`
    }),
    blank: () => ({ n: 2, rep: '0', cache: 'off', conn: '100', q: [] }),
    reference: () => ({ n: 6, rep: '2', cache: '30', conn: 'bouncer', q: quizRef([PEAK_Q]) }),
    render(el, ctx) {
      el.classList.add('rls-root');
      const a = ctx.ans; a.q = a.q || [];
      el.innerHTML = `<div class="stack">
        <div class="rls-box"><div class="rls-set">
          <div class="lbl">Экземпляров ядра</div><div class="rls-rng"><input type="range" min="1" max="12" value="${a.n}" data-n aria-label="Экземпляров ядра" ${ctx.readonly ? 'disabled' : ''}><b data-nv>${a.n}</b></div>
          <div class="lbl">Реплик для чтения</div>${ui.seg('rep', O_REP, a.rep, 'accent')}
          <div class="lbl">Кэш расписания<small>Redis, cache-aside</small></div>${ui.seg('cache', O_CACHE, a.cache, 'accent')}
          <div class="lbl">Соединения с базой</div>${ui.seg('conn', O_CONN, a.conn, 'accent')}
        </div></div>
        <div data-flow></div>
        <div class="rls-stats" data-st></div>
        <ul class="rls-crit" data-crit></ul>
        <div data-note></div>
        <div class="card flat" data-q></div>
      </div>`;
      if (ctx.readonly) TR.$$('[data-seg] button', el).forEach(b => { b.disabled = true; });
      function draw() {
        const r = simPeak(a);
        TR.$('[data-nv]', el).textContent = a.n;
        TR.$('[data-flow]', el).innerHTML = flowHTML(r, a);
        TR.$('[data-st]', el).innerHTML = `
          <div class="stat"><span class="k">Запись, p95</span><span class="v ${r.crit.w ? 'ok' : 'bad'}">${fmtMs(r.pW)}</span><span class="s">цель ≤ ${SLO} мс</span></div>
          <div class="stat"><span class="k">Расписание, p95</span><span class="v ${r.crit.r ? 'ok' : 'bad'}">${fmtMs(r.pR)}</span><span class="s">цель ≤ ${SLO} мс</span></div>
          <div class="stat"><span class="k">Ошибки</span><span class="v ${r.crit.e ? 'ok' : 'bad'}">${r.err ? nf(Math.max(0.1, r.err * 100), 1) + ' %' : '0 %'}</span><span class="s">${r.conns > PG_MAX ? 'база отказывает в соединениях' : r.err ? 'перегрузка, таймауты' : 'цель < 0,1 %'}</span></div>
          <div class="stat"><span class="k">Машин</span><span class="v">${nf(r.cost, 1)}</span><span class="s">ядро, реплики, мастер, Redis</span></div>`;
        TR.$('[data-crit]', el).innerHTML = PEAK_CRIT.map(c => `<li class="${r.crit[c.id] ? 'ok' : ''}">${esc(c.t)}</li>`).join('');
        let n;
        if (r.green) n = ui.note('ok', 'Держит', `Пик проходит. ${r.n > 8 ? 'Но экземпляров многовато — кэш снял бы нагрузку дешевле.' : 'Запас по загрузке есть, автоскейлинг добавит экземпляры, если придёт больше.'}`);
        else if (!r.crit.c) n = ui.note('bad', 'База отказывает в соединениях', `${r.n} × ${a.conn} = ${nf(r.conns)} соединений при пределе ${PG_MAX}. Часть экземпляров не может подключиться к базе.`);
        else if (r.uM >= 0.95) n = ui.note('bad', 'Мастер захлебнулся', `Мастер делает и ${WR} записей в секунду, и все чтения расписания — загрузка ${Math.round(r.uM * 100)} %. Экземпляры ядра тут не помогут: они все ждут одну базу. Куда увести чтения?`);
        else if (r.rhoApp >= 0.8) n = ui.note('warn', 'Ядру тесно', `Загрузка экземпляров ${Math.round(r.rhoApp * 100)} %: запросы ждут в очереди, p95 растёт. Добавьте экземпляры или сделайте чтения дешевле.`);
        else if (!r.crit.s) n = ui.note('warn', 'Кэш врёт слишком долго', 'TTL 5 минут: человек видит «2 места», жмёт «Записаться» и получает «мест нет». В пик места кончаются за секунды.');
        else n = ui.note('warn', 'Почти', 'Посмотрите, какая проверка красная.');
        TR.$('[data-note]', el).innerHTML = n;
      }
      draw();
      const decide = () => { if (!ctx.readonly) { ctx.save(); ctx.decide('Конфигурация на воскресенье 20:00', `ядро ×${a.n}, реплик ${a.rep}, кэш: ${tOf(O_CACHE, a.cache)}, соединения: ${tOf(O_CONN, a.conn)}`); } };
      TR.$('input[data-n]', el).addEventListener('input', e => { if (ctx.readonly) return; a.n = +e.target.value; draw(); });
      TR.$('input[data-n]', el).addEventListener('change', decide);
      ui.onSeg(el, (nm, v) => { if (ctx.readonly || !['rep', 'cache', 'conn'].includes(nm)) return; a[nm] = v; decide(); draw(); });
      ui.quiz(TR.$('[data-q]', el), Object.assign({}, PEAK_Q, { value: a.q[0] || [], readonly: ctx.readonly, reveal: ctx.result, onChange: v => { a.q = [v]; ctx.save(); } }));
    },
    check(ans) {
      const r = simPeak(ans), q = ui.quizScore(PEAK_Q, (ans.q || [])[0] || []);
      const good = PEAK_CRIT.filter(c => r.crit[c.id]).length, notes = [];
      const hint = {
        w: 'Запись медленная. Кто её тормозит — экземпляры ядра или мастер? Посмотрите на проценты загрузки на схеме.',
        r: 'Расписание медленное. Откуда оно читается и сколько стоит каждое чтение?',
        e: 'Есть ошибки: где-то загрузка 95 % и выше или не хватает соединений.',
        c: 'Соединений больше, чем принимает PostgreSQL. Можно ли раздавать соединения только на время запроса?',
        s: 'Свободные места на экране врут слишком долго. Какой TTL ещё разгружает базу, но не обманывает клиента в пик?'
      };
      PEAK_CRIT.forEach(c => { if (!r.crit[c.id]) notes.push({ ok: false, html: `${esc(c.t)} — нет. ${hint[c.id]}` }); });
      if (r.green) notes.push({ ok: true, html: `Конфигурация держит пик: запись ${fmtMs(r.pW)}, расписание ${fmtMs(r.pR)}.` });
      if (r.green && r.n >= 10) notes.push({ ok: 'warn', html: `${r.n} экземпляров — работает, но дорого. Что снимет нагрузку с ядра дешевле?` });
      notes.push(q.ok ? { ok: true, html: 'Автоскейлинг и соединения: верно.' } : { ok: false, html: 'Вопрос про автоскейлинг: посчитайте соединения и сравните с пределом базы.' });
      return { ok: r.green && q.ok, score: good / 5 * 0.7 + q.score * 0.3, notes, summary: `Проверок пройдено: ${good} из 5.`, vera: r.green ? null : 'Идите от узкого места: сначала уведите чтения с мастера (кэш, реплики), потом добавьте экземпляры ядра до загрузки ниже 75 %, и не забудьте про соединения.' };
    },
    explain: `<p>Канон «Пульса»: <b>6 экземпляров ядра, кэш расписания с TTL 30 с, 2 реплики для чтения, PgBouncer</b>. Что даёт каждый шаг:</p>
      <ul class="checks">
        <li><b>Кэш</b> снимает с базы почти все ${nf(RD)} чтений/с (попаданий ~98 %) и вдвое удешевляет чтение для ядра. Без кэша мастер делает и запись, и чтение — и захлёбывается, сколько ни добавляй экземпляров.</li>
        <li><b>Реплики</b> принимают чтения на промахах кэша и страхуют, если Redis упадёт. И нужны для доступности (неделя 2).</li>
        <li><b>Экземпляры ядра</b> — горизонтально, потому что ядро без состояния: при ${WR} записях и ${nf(RD)} чтениях из кэша 6 экземпляров загружены на ~50 %, есть запас.</li>
        <li><b>PgBouncer</b> — экземпляров может стать 12, а соединений с базой всё равно ~60.</li>
      </ul>
      <p>Шардирование не понадобилось: ${WR} записей в секунду держит одна PostgreSQL. Цифры в модели учебные, но порядок честный: узкое место почти всегда — база, и лечат её не «машиной побольше», а тем, чтобы ходить в неё реже.</p>`,
    report: ans => { const r = simPeak(ans); return `Ядро ×${ans.n}, реплик ${ans.rep}, кэш: ${tOf(O_CACHE, ans.cache)}, соединения: ${tOf(O_CONN, ans.conn)}.\nЗапись p95 ${fmtMs(r.pW)}, расписание p95 ${fmtMs(r.pR)}, ошибки ${nf(r.err * 100, 1)} %, соединений ${r.conns}. ${r.green ? 'Держит.' : 'Не держит: ' + PEAK_CRIT.filter(c => !r.crit[c.id]).map(c => c.t).join('; ')}\nВопрос про автоскейлинг: ${ui.quizScore(PEAK_Q, (ans.q || [])[0] || []).ok ? 'верно' : 'неверно'}.`; }
  };

  // =====================================================================
  // Практика 2. Кэш расписания
  // =====================================================================
  const KEYS = [
    { v: 'club-date', t: '<code>schedule:{clubId}:{date}</code>', s: 'ok' },
    { v: 'date', t: '<code>schedule:{date}</code> — все клубы на дату', s: 'warn', why: 'Ключ на всю сеть за день: 60 клубов в одном значении, и любая запись в любом клубе сбрасывает всё. Работает, но промахов в пик будет много.' },
    { v: 'all', t: '<code>schedule</code> — одно значение на всё', s: 'bad', why: 'Всё расписание сети одним куском: огромное значение и сброс всего при каждой записи.' },
    { v: 'client', t: '<code>schedule:{clubId}:{date}:{clientId}</code>', s: 'bad', why: 'Своя копия на каждого клиента: попаданий почти не будет, а при 300 тыс. клиентов — миллионы ключей. Расписание одинаково для всех.' }
  ];
  const TTLS = [
    { v: '5', t: '5 с', s: 'warn', why: 'Свежо, но в пик чаще промахи и чаще «громовое стадо». Работает, если база выдерживает.' },
    { v: '30', t: '30 с', s: 'ok' },
    { v: '300', t: '5 мин', s: 'bad', why: 'В пик места кончаются за секунды: 5 минут люди будут видеть свободные места, которых нет.' },
    { v: '86400', t: 'сутки', s: 'bad', why: 'Расписание меняется (отмены, переносы), а места — каждую секунду. Сутки — только для того, что почти не меняется.' }
  ];
  const STRATS = [
    { v: 'aside', t: 'Cache-aside: промах — читаем базу и кладём копию', s: 'ok' },
    { v: 'through', t: 'Write-through: каждый, кто меняет расписание или места, сам обновляет кэш', s: 'warn', why: 'Места меняют запись, отмена, лист ожидания, отмена занятия, партнёрский шлюз — все они должны помнить про кэш. Забыл один — кэш врёт. Сброс по событию проще и надёжнее.' },
    { v: 'truth', t: 'Кэш — основное хранилище, в базу пишем раз в минуту', s: 'bad', crit: true, why: 'Redis упал — потеряли минуту записей. Кэш — копия, а не правда.' }
  ];
  const EVENTS = [
    { id: 'BookingCreated', t: 'BookingCreated', sub: 'клиент записался — мест меньше', need: 1 },
    { id: 'BookingCancelled', t: 'BookingCancelled', sub: 'отмена — место освободилось', need: 1 },
    { id: 'ClassCancelled', t: 'ClassCancelled', sub: 'занятие отменено', need: 1 },
    { id: 'WaitlistPromoted', t: 'WaitlistPromoted', sub: 'место перешло первому из листа ожидания', need: 0 },
    { id: 'PaymentSucceeded', t: 'PaymentSucceeded', sub: 'оплата прошла', need: -1 },
    { id: 'VisitRecorded', t: 'VisitRecorded', sub: 'клиент прошёл в клуб', need: -1 },
    { id: 'MembershipFrozen', t: 'MembershipFrozen', sub: 'абонемент заморожен', need: -1 },
    { id: 'BonusAccrued', t: 'BonusAccrued', sub: 'начислены бонусы', need: -1 }
  ];
  const NOCACHE = [
    { id: 'decision', t: 'Решение «есть ли место» при нажатии «Записаться»', bad: 0 },
    { id: 'mine', t: '«Мои записи» в приложении', bad: 0 },
    { id: 'profile', t: 'Профиль клиента: имя, телефон', bad: 0 },
    { id: 'spots', t: 'Число свободных мест на карточке занятия', bad: 1 },
    { id: 'list', t: 'Список занятий клуба на дату', bad: 1 },
    { id: 'types', t: 'Названия направлений, залы, тренеры', bad: 1 }
  ];
  function cacheEval(a) {
    a = a || {};
    const key = KEYS.find(k => k.v === a.key), ttl = TTLS.find(k => k.v === a.ttl), str = STRATS.find(k => k.v === a.strat);
    const sv = s => !s ? 0 : s.s === 'ok' ? 1 : s.s === 'warn' ? 0.5 : 0;
    const ev = a.ev || [], nc = a.nc || [];
    const evGood = EVENTS.filter(e => e.need === 1 && ev.includes(e.id)).length, evBad = EVENTS.filter(e => e.need === -1 && ev.includes(e.id)).length;
    const ncGood = NOCACHE.filter(x => !x.bad && nc.includes(x.id)).length, ncBad = NOCACHE.filter(x => x.bad && nc.includes(x.id)).length;
    const evS = Math.max(0, (evGood - evBad) / 3), ncS = Math.max(0, (ncGood - ncBad) / 3);
    const score = sv(key) * 0.15 + sv(ttl) * 0.15 + sv(str) * 0.15 + evS * 0.25 + ncS * 0.3;
    const crit = (key && key.s === 'bad') || (str && str.crit) || !nc.includes('decision');
    return { key, ttl, str, evGood, evBad, ncGood, ncBad, score, crit };
  }
  const cacheTask = {
    id: 'cache-design', title: 'Кэш расписания',
    simple: howCache.simple,
    lead: ui.brief({
      situation: 'Лена: «Расписание клуба на дату читают ~1 000 раз в секунду, а меняется оно редко — кроме числа свободных мест. Кладём в Redis. Нужна постановка: что за ключ, сколько живёт, когда сбрасываем и чего в кэше быть не должно. Разработчики сделают ровно то, что вы напишете».',
      todo: [
        'Выберите ключ, TTL и стратегию.',
        'Отметьте события из Kafka, по которым ключ расписания надо сбросить. Осторожно: среди них есть лишние.',
        'Отметьте то, что <b>не</b> кладём в общий кэш. Тоже с ловушками.',
        'Проверьте себя на событиях в блоке «Прогон» и нажмите «Проверить».'
      ],
      look: 'В «Прогоне» нажмите событие — увидите, что станет с ключом при ваших настройках: сброшен, не тронут и правильно, или не тронут и врёт. Засчитывается от 80 %, если ключ не «на всех» и не «на каждого», кэш не стал основным хранилищем, а решение о записи вы не кэшируете.'
    }),
    blank: () => ({ key: '', ttl: '', strat: '', ev: [], nc: [] }),
    reference: () => ({ key: 'club-date', ttl: '30', strat: 'aside', ev: EVENTS.filter(e => e.need === 1).map(e => e.id), nc: NOCACHE.filter(x => !x.bad).map(x => x.id) }),
    render(el, ctx) {
      el.classList.add('rls-root');
      const a = ctx.ans; a.ev = a.ev || []; a.nc = a.nc || [];
      const res = ctx.result ? cacheEval(a) : null;
      const mark = (list, v) => { if (!res) return ''; const x = list.find(o => o.v === v); return x ? (x.s === 'ok' ? ' ✓' : x.s === 'warn' ? ' ≈' : ' ✗') : ''; };
      el.innerHTML = `<div class="stack">
        <div class="rls-box"><div class="rls-set">
          <div class="lbl">Ключ</div>${ui.seg('key', KEYS.map(k => ({ v: k.v, t: k.t + mark(KEYS, k.v) })), a.key)}
          <div class="lbl">TTL</div>${ui.seg('ttl', TTLS.map(k => ({ v: k.v, t: k.t + mark(TTLS, k.v) })), a.ttl)}
          <div class="lbl">Стратегия</div>${ui.seg('strat', STRATS.map(k => ({ v: k.v, t: k.t + mark(STRATS, k.v) })), a.strat)}
        </div></div>
        <div class="eyebrow">Сбрасываем ключ по событиям</div>
        <div class="rls-checks" data-ev></div>
        <div class="eyebrow">Не кладём в общий кэш</div>
        <div class="rls-checks" data-nc></div>
        <div class="eyebrow">Прогон: что станет с ключом</div>
        <div class="row" data-run>${['BookingCreated', 'ClassCancelled', 'WaitlistPromoted', 'VisitRecorded', 'PaymentSucceeded'].map(e => `<button type="button" class="btn xs" data-e="${e}">${e}</button>`).join('')}</div>
        <div data-out></div>
      </div>`;
      const checks = (box, list, sel, kind) => {
        box.innerHTML = list.map(x => {
          const on = sel.includes(x.id);
          let cls = on ? 'on' : '';
          if (res) { const good = kind === 'ev' ? x.need === 1 : !x.bad, bad = kind === 'ev' ? x.need === -1 : !!x.bad; if (on && good) cls = 'ok'; else if (on && bad) cls = 'bad'; else if (!on && good) cls = 'warn'; }
          return `<label class="${cls}"><input type="checkbox" data-${kind}="${x.id}" ${on ? 'checked' : ''} ${ctx.readonly ? 'disabled' : ''}><span>${kind === 'ev' ? `<code>${esc(x.t)}</code>` : esc(x.t)}${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</span></label>`;
        }).join('');
      };
      checks(TR.$('[data-ev]', el), EVENTS, a.ev, 'ev');
      checks(TR.$('[data-nc]', el), NOCACHE, a.nc, 'nc');
      if (ctx.readonly) TR.$$('[data-seg] button', el).forEach(b => { b.disabled = true; });
      const save = () => { if (ctx.readonly) return; ctx.save(); ctx.decide('Кэш расписания', `ключ ${plainT(tOf(KEYS, a.key))}; TTL ${tOf(TTLS, a.ttl)}; ${tOf(STRATS, a.strat)}; сброс: ${a.ev.join(', ') || '—'}; не кэшируем: ${NOCACHE.filter(x => a.nc.includes(x.id)).map(x => x.t).join(', ') || '—'}`); };
      ui.onSeg(el, (nm, v) => { if (ctx.readonly || !['key', 'ttl', 'strat'].includes(nm)) return; a[nm] = v; save(); });
      el.addEventListener('change', e => {
        const c = e.target.closest('input[type=checkbox]'); if (!c || ctx.readonly) return;
        const kind = c.dataset.ev ? 'ev' : 'nc', id = c.dataset[kind], arr = a[kind];
        a[kind] = c.checked ? arr.concat(id).filter((x, i, s) => s.indexOf(x) === i) : arr.filter(x => x !== id);
        c.closest('label').className = c.checked ? 'on' : '';
        save();
      });
      TR.on(el, 'click', '[data-e]', (e, b) => {
        const ev = EVENTS.find(x => x.id === b.dataset.e), on = a.ev.includes(ev.id), key = a.key === 'club-date' ? 'schedule:club-12:2026-10-11' : a.key === 'date' ? 'schedule:2026-10-11' : a.key === 'all' ? 'schedule' : a.key === 'client' ? 'schedule:club-12:2026-10-11:*' : '(ключ не выбран)';
        const ttl = a.ttl ? tOf(TTLS, a.ttl) : 'TTL не выбран';
        let n;
        if (a.strat === 'through' && ev.need === 1) n = ui.note('warn', `${ev.id} · write-through`, 'Обработчик записи сам обновит кэш — если не забудет. Сброс по событию надёжнее: событие придёт, даже если запись делал другой модуль.');
        else if (on && ev.need === 1) n = ui.note('ok', `${ev.id} → DEL ${key}`, `${esc(ev.sub)}. Ключ удалён — следующий запрос прочитает свежие места из базы.`);
        else if (on && ev.need === 0) n = ui.note('', `${ev.id} → DEL ${key}`, 'Число свободных мест не изменилось (одно место освободилось при отмене, его занял первый из листа ожидания), но сброс не вредит — отмена и так уже сбросила ключ.');
        else if (on) n = ui.note('bad', `${ev.id} → DEL ${key}`, `Лишний сброс: ${esc(ev.sub)} — расписание и места от этого не меняются. В пик таких событий сотни в секунду — кэш будет пустым, и всё пойдёт в базу.`);
        else if (ev.need === 1) n = ui.note('bad', `${ev.id} → ключ не тронут`, `${esc(ev.sub)}, а кэш ещё ${esc(ttl)} показывает старое число мест. Человек видит «2 места», жмёт «Записаться» — и получает «мест нет».`);
        else if (ev.need === 0) n = ui.note('', `${ev.id} → ключ не тронут`, 'И это нормально: число свободных мест не изменилось.');
        else n = ui.note('ok', `${ev.id} → ключ не тронут`, `И правильно: ${esc(ev.sub)} — на расписание это не влияет.`);
        TR.$('[data-out]', el).innerHTML = n;
      });
      if (ctx.readonly) TR.$('[data-out]', el).innerHTML = ui.code(`GET schedule:club-12:2026-10-11
→ [{"classId":"4b1f…","type":"Сайкл","startsAt":"2026-10-11T19:00:00+03:00","freeSpots":3}, …]
TTL 30 с · сброс: BookingCreated, BookingCancelled, ClassCancelled`, 'text', 'Пример ключа в Redis');
    },
    check(ans) {
      const e = cacheEval(ans), notes = [];
      if (!e.key) notes.push({ ok: false, html: 'Ключ не выбран.' }); else if (e.key.s !== 'ok') notes.push({ ok: e.key.s === 'warn' ? 'warn' : false, html: `Ключ: ${e.key.why}` });
      if (!e.ttl) notes.push({ ok: false, html: 'TTL не выбран.' }); else if (e.ttl.s !== 'ok') notes.push({ ok: e.ttl.s === 'warn' ? 'warn' : false, html: `TTL: ${e.ttl.why}` });
      if (!e.str) notes.push({ ok: false, html: 'Стратегия не выбрана.' }); else if (e.str.s !== 'ok') notes.push({ ok: e.str.s === 'warn' ? 'warn' : false, html: `Стратегия: ${e.str.why}` });
      if (e.evGood < 3) notes.push({ ok: false, html: `События: отмечено нужных ${e.evGood} из 3. Какие события меняют число свободных мест или само расписание?` });
      if (e.evBad) notes.push({ ok: false, html: `События: лишних ${e.evBad}. Меняет ли оплата, проход в клуб или бонусы расписание? В пик лишний сброс опустошает кэш.` });
      if (!(ans.nc || []).includes('decision')) notes.push({ ok: false, html: 'Решение о записи по кэшу — двое увидят одно место и запишутся оба. Где принимается решение?' });
      if (e.ncGood < 3 && (ans.nc || []).includes('decision')) notes.push({ ok: false, html: 'Не кэшируем: что ещё персональное или должно быть видно сразу после действия клиента?' });
      if (e.ncBad) notes.push({ ok: false, html: `Не кэшируем: лишних ${e.ncBad}. Ради чего мы вообще ставим кэш? Свободные места на карточке «Пульс» показывает из кэша.` });
      if (!notes.length) notes.push({ ok: true, html: 'Ключ, TTL, стратегия, события и исключения — как в каноне.' });
      return { ok: e.score >= 0.8 && !e.crit, score: e.score, notes, summary: `Оценка: ${Math.round(e.score * 100)} %.`, vera: e.crit ? 'Три вещи не обсуждаются: ключ — на клуб и дату, кэш — копия, а не хранилище, решение о записи — только в базе.' : null };
    },
    explain: `<p>Канон «Пульса»: Redis, <b>cache-aside</b>, ключ <code>schedule:{clubId}:{date}</code>, <b>TTL 30 с</b> + сброс по событиям, меняющим места: <code>BookingCreated</code>, <code>BookingCancelled</code>, <code>ClassCancelled</code>. Публичное расписание на сайте — ещё и CDN.</p>
      <ul class="checks">
        <li>TTL — страховка: если событие потерялось или обработчик сброса лёг, кэш врёт не дольше 30 секунд.</li>
        <li>Сброс по событию делает отдельный потребитель Kafka: модулю записи не нужно знать про кэш.</li>
        <li>Не кэшируем в общем кэше: решение о записи (атомарный UPDATE в базе), «мои записи» (read-your-writes — клиент должен увидеть свою запись сразу), профиль (персональные данные; <code>Cache-Control: private, no-store</code>).</li>
      </ul>
      <p>Это постановка аналитика, а не детали Redis: какие данные можно показывать «немного старыми», насколько старыми и что видит клиент, когда кэш соврал (409 со ссылкой на лист ожидания).</p>`,
    report: ans => { const e = cacheEval(ans); return `Ключ: ${plainT(tOf(KEYS, ans.key))}; TTL: ${tOf(TTLS, ans.ttl)}; стратегия: ${tOf(STRATS, ans.strat)}.\nСброс: ${(ans.ev || []).join(', ') || '—'}.\nНе кэшируем: ${NOCACHE.filter(x => (ans.nc || []).includes(x.id)).map(x => x.t).join('; ') || '—'}.\nОценка ${Math.round(e.score * 100)} %.`; }
  };

  // =====================================================================
  // Практика 3. Где кэш опасен
  // =====================================================================
  const DANGER = [{ v: 'safe', t: 'Кэш безопасен' }, { v: 'care', t: 'Можно, с оговорками (короткий TTL, сброс)' }, { v: 'never', t: 'Только из базы' }];
  const SITS = [
    { id: 'book', t: 'Анна нажала «Записаться»: проверить, осталось ли место', ok: 'never', crit: true, hint: 'Это показ или решение? Что будет, если двое увидят одно и то же «1 место»?', why: 'Решение — атомарный <code>UPDATE … WHERE booked_count < capacity</code> в базе. По кэшу двое увидят «1 место» — запишутся оба.' },
    { id: 'spots', t: 'Число свободных мест на карточке занятия в расписании', ok: 'care', alt: { safe: 'Слишком смело: без сброса по событию и с длинным TTL места будут врать. Нужны TTL 30 с и сброс по записи и отмене.' }, hint: 'Что случится, если число немного устарело? А если сильно?', why: 'Показ — можно: TTL 30 с и сброс по <code>BookingCreated</code>. Ошибка в показе — неудобство: при записи база ответит 409 со ссылкой на лист ожидания.' },
    { id: 'mine', t: '«Мои записи» сразу после того, как Анна записалась', ok: 'never', crit: true, alt: { care: 'Кэш на клиента со сбросом по событию возможен, но событие приходит асинхронно: Анна может не увидеть только что сделанную запись. Канон: читаем из ядра.' }, hint: 'Должна ли Анна увидеть свою запись в ту же секунду? Успеет ли кэш узнать о ней?', why: 'Read-your-writes: клиент должен сразу увидеть результат своего действия. «Мои записи» «Пульс» читает из ядра. И это персональные данные — в общий кэш нельзя.' },
    { id: 'types', t: 'Названия направлений, залы и фотографии тренеров', ok: 'safe', also: ['care'], hint: 'Как часто это меняется и что будет, если старое название провисит час?', why: 'Меняется раз в месяц, ошибка безвредна: TTL часы плюс сброс при правке. Самые удобные данные для кэша.' },
    { id: 'bonus', t: 'Сколько бонусов на счёте, когда клиент списывает их при покупке абонемента', ok: 'never', crit: true, hint: 'Бонусы — это деньги. Что будет, если списать по устаревшему балансу?', why: 'Списание по устаревшему балансу — списали бонусы, которых нет, или дважды. Решение принимает сервис бонусов по своей базе (резерв в саге покупки).' }
  ];
  function dangerEval(v) {
    v = v || {};
    return SITS.map(s => {
      const got = v[s.id];
      if (got === s.ok || (s.also || []).includes(got)) return { s, r: 'ok', pts: 1 };
      if (s.alt && s.alt[got]) return { s, r: 'warn', pts: 0.5 };
      return { s, r: 'bad', pts: 0, empty: !got };
    });
  }
  const dangerTask = {
    id: 'cache-danger', title: 'Где кэш опасен',
    simple: {
      icon: '⚠️',
      plain: 'Копию можно показывать, когда небольшая ошибка безвредна. По копии нельзя решать, когда ошибка стоит денег, мест или доверия.',
      analogy: 'Табло у входа в зал «свободно 3 места» может отставать на минуту — не страшно. Но пускать в зал по табло нельзя: инструктор считает людей по списку.',
      tech: 'Кэш допустим для чтения, где согласованность в конечном счёте приемлема и ошибка обратима. Запрещён для решений, меняющих данные (проверка-и-действие), для денег и для данных, которые клиент должен увидеть сразу после своего действия (read-your-writes).'
    },
    lead: ui.brief({
      situation: 'Антон: «Кэш — как соль: в меру делает быстрее, переборщил — испортил блюдо». Пять ситуаций, где разработчики предлагают поставить кэш. Для каждой решите: кэш безопасен, допустим с оговорками или здесь только база.',
      todo: [
        'Выберите ответ в каждой из пяти строк.',
        'Для каждой спросите: это показ или решение? Что потеряем, если данные устарели на 30 секунд? Чьи это данные?',
        'Нажмите «Проверить». Засчитывается от 80 %, и три ситуации, где на кону деньги или места, должны быть верными.'
      ],
      lookTitle: 'Подсказка',
      look: 'Показ с небольшой ошибкой — можно. Решение по копии — нельзя. Своё действие клиент должен увидеть сразу.'
    }),
    blank: () => ({ v: {} }),
    reference: () => ({ v: Object.fromEntries(SITS.map(s => [s.id, s.ok])) }),
    render(el, ctx) {
      el.classList.add('rls-root');
      let reveal = null;
      if (ctx.result) { reveal = {}; dangerEval(ctx.ans.v).forEach(x => { reveal[x.s.id] = { s: x.r, why: x.r === 'ok' ? x.s.why : x.r === 'warn' ? x.s.alt[(ctx.ans.v || {})[x.s.id]] : '' }; }); }
      ui.match(mount(el), {
        rows: SITS.map(s => ({ id: s.id, t: esc(s.t) })), choices: DANGER, value: ctx.ans.v || {}, reveal, readonly: ctx.readonly, placeholder: 'Кэш здесь…',
        onChange: v => { ctx.ans.v = v; ctx.save(); }
      });
      if (ctx.readonly) mount(el).innerHTML = '<div style="margin-top:12px">' + ui.table(['Ситуация', 'Ответ', 'Почему'], SITS.map(s => [esc(s.t), esc(tOf(DANGER, s.ok)) + ((s.also || []).length ? ` <span class="small dim">(или ${esc(tOf(DANGER, s.also[0]).toLowerCase())})</span>` : ''), s.why])) + '</div>';
    },
    check(ans) {
      const ev = dangerEval(ans && ans.v), score = ev.reduce((s, x) => s + x.pts, 0) / SITS.length, critBad = ev.filter(x => x.s.crit && x.r !== 'ok'), notes = [];
      ev.forEach(x => {
        if (x.r === 'warn') notes.push({ ok: 'warn', html: `«${esc(x.s.t)}» — ${x.s.alt[(ans.v || {})[x.s.id]]}` });
        else if (x.r === 'bad') notes.push({ ok: false, html: `«${esc(x.s.t)}» — ${x.empty ? 'не выбрано. ' : ''}${x.s.hint}` });
      });
      if (!notes.length) notes.push({ ok: true, html: 'Все пять — верно.' });
      return { ok: score >= 0.8 && !critBad.length, score, notes, summary: `Верно: ${ev.filter(x => x.r === 'ok').length} из ${SITS.length}.`, vera: critBad.length ? 'Разделите показ и решение. Показывать по копии можно, решать — нельзя. А своё действие клиент должен видеть сразу.' : null };
    },
    explain: `<p>Правило: <b>кэш — для показа, база — для решения</b>.</p>
      <ul class="checks">
        <li>Безопасно: то, что меняется редко и чья ошибка безвредна (направления, залы, тренеры).</li>
        <li>С оговорками: часто меняющийся показ (свободные места) — короткий TTL, сброс по событию и честная ошибка при действии.</li>
        <li>Только база: решение о записи (гонка за последнее место), деньги и бонусы (резерв и списание), «мои записи» сразу после действия (read-your-writes и персональные данные).</li>
      </ul>
      <p>В постановке это одна строка на каждое поле экрана: «источник: кэш, допустимое отставание 30 с» или «источник: база, всегда свежее». Её пишет аналитик.</p>`,
    report: ans => dangerEval(ans && ans.v).map(x => `- ${x.s.t} → ${(ans.v || {})[x.s.id] ? tOf(DANGER, ans.v[x.s.id]) : '—'} ${x.r === 'ok' ? '✓' : x.r === 'warn' ? '≈' : '✗'}`).join('\n')
  };

  // =====================================================================
  // Практика 4. Почему решение о записи — только в базе
  // =====================================================================
  const WHY_RUBRIC = [
    'Кэш — копия с задержкой: число мест в нём устаревает (до 30 с или до сброса по событию)',
    'Решение о записи меняет данные и обязано соблюдать жёсткое правило «записанных не больше, чем мест»',
    'Только база даёт атомарность: UPDATE … SET booked_count = booked_count + 1 WHERE booked_count < capacity — даже при 400 записях в секунду и гонке за последнее место',
    'Решение по кэшу — «проверил, потом сделал»: двое видят одно место, записаны оба — 21 человек на 20 мест',
    'Показ из кэша допустим: ошибка в показе — неудобство (увидел «есть место» — получил 409 со ссылкой на лист ожидания), а кэш снимает с базы ~1 000 чтений в секунду',
    'После записи кэш сбрасывается по BookingCreated, а TTL 30 с ограничивает отставание'
  ];
  const WHY_REF = 'Кэш — это копия расписания, которая живёт до 30 секунд или до сброса по событию. Между тем, как клиент увидел «1 место», и тем, как нажал «Записаться», место могли занять. Поэтому решение принимает только база, одним атомарным UPDATE: booked_count = booked_count + 1 WHERE booked_count < capacity. Даже если 50 человек нажмут одновременно, база пропустит ровно столько, сколько мест, остальным ответит 409 со ссылкой на лист ожидания. Если бы решали по кэшу, это была бы проверка, потом действие: двое увидели одно место — записаны оба, 21 человек на 20 велосипедов. А показ из кэша — нормально: ошибка в показе стоит клиенту лишнего нажатия, а не скандала, зато кэш снимает с базы ~1 000 чтений в секунду в воскресенье 20:00. После каждой записи событие BookingCreated сбрасывает ключ, а TTL 30 секунд ограничивает враньё, даже если событие потерялось.';
  const whyTask = {
    id: 'why-db', title: 'Почему решение о записи — только в базе',
    simple: {
      icon: '⚖️',
      plain: 'Показывать можно по копии — ошибка недорогая. Решать — только по оригиналу, и так, чтобы двое не заняли одно место.',
      analogy: 'Табло «свободно 1 место» и инструктор со списком у входа. Табло может отставать. Список — нет: инструктор вписывает человека, только если строка свободна, и вписывает по одному.',
      tech: 'Решение о записи — атомарная операция в базе (неделя 3, «Повторы и гонки»): условный UPDATE счётчика мест в одной транзакции с созданием записи. Кэш — для чтения, допустимое отставание фиксируется в требованиях.'
    },
    lead: ui.brief({
      situation: 'Ольга на демо: «Странно. Свободные места вы показываете из какого-то кэша, а записываете через базу. Почему не сделать всё через кэш, раз он такой быстрый? Или всё через базу, раз она такая точная?»',
      todo: [
        'Ответьте Ольге 5–8 предложениями без жаргона (от 250 символов). Термины можно, но с расшифровкой.',
        'Объясните обе половины: почему показ — из кэша, а решение — только в базе.',
        'Нажмите «Проверить с Верой (Claude)» или «Сверить с эталоном самому». Засчитывается от 60 %.'
      ],
      lookTitle: 'На что опереться',
      look: 'Цифры: ~1 000 чтений и ~400 записей в секунду в пик, TTL 30 с. Правило из блокнота: «двое на одном велосипеде — скандал». Неделя 3: гонка за последнее место и атомарный UPDATE.'
    }),
    blank: () => ({ j: { text: '' } }),
    reference: () => ({ j: { text: WHY_REF, self: WHY_RUBRIC.map(() => true) } }),
    render(el, ctx) {
      el.classList.add('rls-root');
      el.insertAdjacentHTML('beforeend', ui.say('olga', 'Почему не сделать всё через кэш, раз он такой быстрый? Или всё через базу, раз она такая точная?'));
      const j = mount(el); j.style.marginTop = '12px';
      ui.justify(j, {
        id: 'rls-why', q: 'Почему свободные места показываем из кэша, а решение о записи — только в базе?', qPlain: 'Объясните директору фитнес-сети без жаргона: почему свободные места на экране показываем из кэша, а решение о записи на занятие принимает только база данных.',
        rubric: WHY_RUBRIC, reference: WHY_REF, value: ctx.ans.j, readonly: ctx.readonly, minLen: 250,
        onChange: v => { ctx.ans.j = v; ctx.save(); ctx.decide('Почему решение о записи — в базе (для Ольги)', v.text || ''); }
      });
    },
    check(ans) {
      const s = ui.justifyScore(ans && ans.j), txt = String((ans.j || {}).text || '');
      const notes = [];
      if (txt.trim().length < 250) notes.push({ ok: false, html: 'Пока коротко: нужны обе половины — про показ и про решение.' });
      else if (!(ans.j.self || ans.j.ai)) notes.push({ ok: 'warn', html: 'Сверьте ответ с эталоном или проверьте с Верой.' });
      else notes.push({ ok: s >= 0.6, html: `Покрыто критериев: ${Math.round(s * 100)} %.` });
      return { ok: s >= 0.6, score: s, notes, summary: s ? `Оценка: ${Math.round(s * 100)} %.` : 'Напишите ответ и сверьте с эталоном.' };
    },
    explain: '<p>Главная мысль — у показа и у решения <b>разная цена ошибки</b>. Ошибка показа — лишнее нажатие и честное «мест нет, встать в лист ожидания?». Ошибка решения — 21 человек на 20 велосипедах. Поэтому показ берёт скорость (кэш), а решение — точность (атомарный UPDATE в базе). «Всё через базу» в воскресенье 20:00 — это 1 000 лишних чтений в секунду на мастер; «всё через кэш» — гонка за последнее место, которую вы закрыли ещё на неделе 3.</p>',
    report: ans => `Ответ Ольге:\n> ${String((ans.j || {}).text || '—').replace(/\n/g, '\n> ')}\nСамооценка: ${Math.round(ui.justifyScore(ans.j) * 100)} %.`
  };

  // =====================================================================
  TR.stage({
    id: ID, act: 7, order: 420, slot: 'Вт 10:00', title: 'Масштаб и кэш',
    when: 'вторник, 10:00 · переговорная «Кроссфит» · Лена, Антон, Сергей',
    intro: [
      { who: 'lena', html: 'Через два года в воскресенье в 20:00 придут 20 000 человек за 5 минут — это ~1 000 чтений расписания и ~400 записей в секунду, с запасом. Сейчас мы держим 3 000. Тимур спрашивает: может, просто купить сервер в шесть раз мощнее?' },
      { who: 'anton', html: 'Один большой сервер — это потолок и одна точка отказа. Ядро у нас без состояния: ставим экземпляры за балансировщиком, расписание читаем из кэша Redis, у базы — реплики и PgBouncer. Но кэш — это вторая правда о свободных местах. Где ей можно верить, а где нельзя, решает аналитик.' },
      { who: 'vera', html: 'Сначала покрутим масштабирование, кэш и соединения с базой на приложении бара клуба. Потом соберёте конфигурацию на воскресенье через два года и напишете постановку кэша расписания: ключ, срок жизни, события сброса и что в кэш класть нельзя.' }
    ],
    facts: ['F-week-open', 'F-capacity', 'F-site', 'F-availability', 'F-waitlist'],
    glossary: [
      { term: 'Вертикальное и горизонтальное масштабирование', simple: 'Нанять одного супербармена или поставить пять обычных барменов.', tech: 'Вертикальное — более мощная машина: просто, но дорого, с потолком и одной точкой отказа. Горизонтальное — больше одинаковых экземпляров за балансировщиком: почти без предела, но требует сервисов без состояния.' },
      { term: 'Сервис без состояния (stateless)', simple: 'Бармен не держит заказы в голове — всё записано в общей тетради, и любой бармен продолжит.', tech: 'Экземпляр не хранит между запросами ничего своего (сессии, корзины, черновики) — всё во внешнем хранилище (Redis, база) или в токене. Любой запрос может обработать любой экземпляр; экземпляры можно добавлять, убирать и перезапускать.' },
      { term: 'Балансировщик нагрузки', simple: 'Распорядитель у входа: направляет каждого гостя к свободному бармену.', tech: 'Распределяет запросы между экземплярами: по кругу (round-robin), наименее загруженному (least connections), по хешу. Проверяет здоровье экземпляров и не шлёт запросы упавшим. Липкая сессия (sticky) — костыль для сервисов с состоянием.' },
      { term: 'Cache-aside', simple: 'Бармен сначала смотрит в распечатку меню; если её нет — идёт к управляющему и приносит новую.', tech: 'Стратегия кэша: приложение читает из кэша, при промахе читает базу и кладёт копию в кэш с TTL. Кэш ничего не знает о базе. Стратегия «Пульса» для расписания.' },
      { term: 'Write-through', simple: 'Управляющий, меняя цену, сам приносит новую распечатку на стойку.', tech: 'Запись идёт и в базу, и в кэш одной операцией приложения — кэш всегда свежий, если все пишущие про него помнят. Минусы: запись медленнее, в кэш попадает и то, что никто не читает.' },
      { term: 'TTL (время жизни)', simple: 'Срок годности на распечатке меню: через час — выбросить и взять свежую.', tech: 'Time to live — сколько запись живёт в кэше, после чего удаляется. Верхняя граница отставания копии от базы. У расписания «Пульса» — 30 с.' },
      { term: 'Инвалидация кэша', simple: 'Управляющий поднял цену и звонит: «выбросьте старое меню».', tech: 'Удаление (или обновление) записи кэша при изменении исходных данных — обычно по событию (у «Пульса» — BookingCreated, BookingCancelled, ClassCancelled). Вместе с TTL ограничивает время, когда кэш отдаёт устаревшее.' },
      { term: 'Громовое стадо (thundering herd)', simple: 'Распечатки у всех барменов истекли одновременно, и все разом побежали к управляющему.', tech: 'Массовый промах кэша (истечение популярных ключей, перезапуск Redis) под нагрузкой: все запросы одновременно идут в базу и перегружают её. Защита: разнесённый TTL (jitter), одна загрузка на ключ (single flight), прогрев и обновление заранее.' },
      { term: 'Пул соединений (PgBouncer)', simple: 'Гардеробщик выдаёт ключ от шкафчика на время тренировки и забирает обратно — шкафчиков хватает на всех.', tech: 'Пул — переиспользуемые соединения с базой. Каждое соединение PostgreSQL — отдельный процесс, max_connections ограничен. PgBouncer принимает тысячи клиентских соединений и раздаёт десятки серверных на время транзакции.' },
      { term: 'Шардирование', simple: 'Не один журнал записи на всю сеть, а свой журнал в каждом городе.', tech: 'Разделение данных по ключу (город, клиент) на несколько независимых баз. Нужно, когда одна машина упирается в запись или объём. Цена: запросы и транзакции через несколько шардов, перебалансировка, сложно сменить ключ. «Пульсу» пока не нужно.' }
    ],
    outro: 'Масштаб — это не «купить сервер побольше», а сделать так, чтобы можно было просто добавить ещё один: ядро без состояния, балансировщик, кэш для чтения, реплики, PgBouncer. И знать, где копии верить нельзя: решение о записи — всегда в базе. Шардирование «Пульсу» пока не нужно — 400 записей в секунду держит одна PostgreSQL. Завтра — CQRS: отдельная модель чтения для отчётов директора, которая собирается из событий.',
    tasks: [howScale, howCache, peakTask, cacheTask, dangerTask, whyTask]
  });
})();
