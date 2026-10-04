/* Неделя 5, вторник 10:00: Kafka и RabbitMQ.
   Теория: Kafka как журнал (ключ → партиция живым расчётом, смещения и группы, порядок и ребаланс, сжатый топик);
   RabbitMQ как почтовое отделение (симулятор маршрутизации direct/topic/fanout, ack, повтор, DLQ, приоритеты;
   «журнал или почта» под требования). Практика: кому что, топик записей (лаборатория перемешанных событий),
   очередь уведомлений, почему оба брокера. */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc;
  const ID = 'mq-kafka';

  if (!document.getElementById('mqk-css')) document.head.insertAdjacentHTML('beforeend', `<style id="mqk-css">
    .mqk-root, .mqk-root .stack { min-width: 0; }
    .mqk-root .stack > * { min-width: 0; }
    .mqk-root :not(pre) > code { white-space: normal; overflow-wrap: anywhere; }
    .mqk-root .seg button { white-space: normal; text-align: left; }
    .mqk-box { display: grid; gap: 12px; padding: 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); min-width: 0; }
    .mqk-box > * { min-width: 0; }
    .mqk-set { display: grid; grid-template-columns: minmax(0, 230px) minmax(0, 1fr); gap: 8px 14px; align-items: center; }
    .mqk-set > .lbl { font-size: 13.5px; color: var(--text-2); min-width: 0; }
    .mqk-set > .seg, .mqk-set > select { justify-self: start; max-width: 100%; }
    .mqk-parts { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px; }
    .mqk-p { border: 1px solid var(--border); border-radius: 8px; padding: 6px 7px; background: var(--surface-2); min-width: 0; display: grid; gap: 3px; align-content: start; min-height: 52px; }
    .mqk-p .pn { font: 600 11px/1.2 var(--f-mono); color: var(--text-muted); }
    .mqk-p.hit { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); background: color-mix(in srgb, var(--accent) 10%, var(--surface)); }
    .mqk-p .ev { font: 11px/1.25 var(--f-mono); color: var(--text-2); overflow-wrap: anywhere; }
    .mqk-p.idle { opacity: .55; }
    .mqk-log { display: flex; flex-wrap: wrap; gap: 4px; align-items: flex-end; }
    .mqk-cell { display: grid; gap: 2px; justify-items: center; min-width: 40px; }
    .mqk-cell .c { width: 100%; padding: 4px 4px; border-radius: 6px; text-align: center; font: 12px/1.2 var(--f-mono); background: var(--surface-3); color: var(--text-2); }
    .mqk-cell .c.gone { background: transparent; border: 1px dashed var(--border-strong); color: var(--text-muted); text-decoration: line-through; }
    .mqk-cell .mk { font: 600 10.5px/1.1 var(--f-mono); min-height: 12px; }
    .mqk-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .mqk-chip { display: inline-flex; gap: 6px; align-items: center; padding: 4px 9px; border-radius: 999px; border: 1px solid var(--border); background: var(--surface-2); font-size: 12.5px; }
    .mqk-chip.bad { border-color: var(--bad); color: var(--bad); background: color-mix(in srgb, var(--bad) 10%, var(--surface)); }
    .mqk-chip.ok { border-color: var(--ok); }
    .mqk-chip .n { font: 600 11px/1 var(--f-mono); color: var(--text-muted); }
    .mqk-q { display: grid; gap: 6px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); min-width: 0; }
    .mqk-q.hit { border-color: var(--ok); box-shadow: 0 0 0 1px var(--ok); }
    .mqk-q .bd { font: 12px/1.3 var(--f-mono); color: var(--text-muted); overflow-wrap: anywhere; }
    .mqk-q .cnt { font: 600 18px/1.1 var(--f-mono); }
    .mqk-qs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .mqk-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .mqk-stats .v { font-size: 16px; overflow-wrap: anywhere; }
    .mqk-fit { display: grid; grid-template-columns: 110px minmax(0, 1fr) 46px; gap: 8px; align-items: center; font-size: 13px; }
    .mqk-req { display: grid; gap: 6px; }
    .mqk-req label { display: flex; gap: 8px; align-items: flex-start; cursor: pointer; font-size: 13.5px; }
    .mqk-req input { accent-color: var(--accent); width: 16px; height: 16px; flex: none; margin-top: 2px; }
    .mqk-range { width: 100%; margin: 4px 0; accent-color: var(--accent); }
    .mqk-lane { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 8px; align-items: center; font-size: 12.5px; }
    .mqk-lane > * { min-width: 0; }
    .mqk-root input[type=text] { max-width: 100%; }
    @media (max-width: 640px) {
      .mqk-set { grid-template-columns: minmax(0, 1fr); gap: 4px; }
      .mqk-set > .lbl { margin-top: 8px; }
      .mqk-parts { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .mqk-qs, .mqk-stats { grid-template-columns: minmax(0, 1fr); }
      .mqk-lane { grid-template-columns: 84px minmax(0, 1fr); }
      .mqk-fit { grid-template-columns: 84px minmax(0, 1fr) 40px; }
    }
  </style>`);

  // ---------- общие помощники ----------
  const L = (id, t, sub) => ({ id, t, sub });
  const lock = (el, ro) => { if (ro) TR.$$('[data-seg] button, select', el).forEach(b => { b.disabled = true; }); };
  const tOf = (list, v) => (list.find(x => x.v === v) || { t: '?' }).t;
  const partOf = (key, n) => TR.hash(String(key)) % n;
  const fresh = pane => { const d = document.createElement('div'); pane.appendChild(d); return d; };
  const PCOL = ['var(--p1)', 'var(--p2)', 'var(--p3)', 'var(--p4)', 'var(--p5)', 'var(--p6)', 'var(--info)', 'var(--warn)', 'var(--ok)', 'var(--accent)', 'var(--violet)', 'var(--cyan)', 'var(--bad)', 'var(--text-2)'];

  function walk(el, cfg) {
    let cur = cfg.scenarios[0].id;
    el.innerHTML = `<div class="stack">${cfg.scenarios.length > 1 ? `<div class="row"><span class="small dim">Вариант:</span>${ui.seg('wk', cfg.scenarios.map(s => ({ v: s.id, t: s.t })), cur, 'accent')}</div>` : ''}<div data-w></div><div data-sum></div></div>`;
    const box = TR.$('[data-w]', el), sum = TR.$('[data-sum]', el);
    function show(id) {
      cur = id; const sc = cfg.scenarios.find(s => s.id === id);
      box.innerHTML = ''; sum.innerHTML = '';
      const d = document.createElement('div'); box.appendChild(d);
      ui.seq(d, { lanes: sc.lanes, steps: sc.steps, title: sc.t, laneW: cfg.laneW || 170, hint: 'Нажимайте «Шаг →» и читайте пояснение под схемой.', onEnd() { sum.innerHTML = sc.sum ? ui.note(sc.sumKind || '', 'Итог', sc.sum) : ''; } });
    }
    ui.onSeg(el, (n, v) => { if (n === 'wk') show(v); });
    show(cur);
  }

  // =====================================================================
  // Теория 1. Kafka — журнал
  // =====================================================================
  const MEM_EVENTS = ['MembershipActivated', 'MembershipFrozen', 'MembershipUnfrozen', 'MembershipActivated', 'MembershipFrozen'];
  const PRESET = [{ k: 'c-1001', t: 'Анна' }, { k: 'c-2002', t: 'Пётр' }, { k: 'c-3003', t: 'Ира' }, { k: 'c-4004', t: 'Марат' }];
  const howKafka = {
    id: 'how-kafka', covers: ['who-what', 'topic-design'], title: 'Как это работает: Kafka — журнал с партициями', free: true, noReset: true,
    simple: {
      icon: '📒',
      plain: 'Kafka — это большой журнал, куда только дописывают в конец. Прочитанное не вычёркивают. Каждый читатель держит свою закладку и может вернуться назад.',
      analogy: 'Журнал посещений на ресепшене, только разделённый на 12 тетрадей, чтобы писать и читать параллельно. Записи одного клиента всегда идут в одну и ту же тетрадь — по первой букве фамилии. Бухгалтерия и маркетинг читают одни и те же тетради, каждый со своей закладкой.',
      tech: '<b>Топик</b> — именованный журнал (<code>puls.membership.events.v1</code>). <b>Партиция</b> — одна «тетрадь» топика; порядок есть только внутри неё. <b>Ключ</b> сообщения определяет партицию: <code>hash(ключ) % число_партиций</code>. <b>Смещение</b> (offset) — номер сообщения в партиции. <b>Группа потребителей</b> — один сервис; партиции делятся между его экземплярами, а разные группы читают всё независимо. Хранение у «Пульса» — 7 дней.'
    },
    lead: ui.brief({
      situation: 'Соседний пример — топик <code>puls.membership.events.v1</code>: события абонементов (активирован, заморожен, разморожен). Ключ — <code>client_id</code>, 12 партиций, хранение 7 дней. Читают уведомления, список пропусков, аналитика и выгрузка в 1С. Четыре вкладки — четыре свойства журнала.',
      todo: [
        '«Ключ → партиция»: впишите любой ключ или выберите клиента — увидите, в какую из 12 партиций он попадёт. Опубликуйте несколько событий одного клиента.',
        '«Смещения и группы»: читайте журнал двумя группами по очереди, «уроните» аналитику, перечитайте с начала, промотайте 7 дней.',
        '«Порядок и ребаланс»: двигайте число экземпляров и прогоняйте события с ключом и без ключа.',
        '«Сжатый топик»: пройдите, как контроллер нового клуба получает список пропусков.'
      ],
      look: 'P0…P11 — партиции. Число под событием (#0, #1…) — его смещение внутри партиции: у каждой партиции своя нумерация. Треугольник ▲ под ячейкой — закладка группы: «прочитано до сюда».'
    }),
    render(el) {
      el.classList.add('mqk-root');
      const t = document.createElement('div'); el.appendChild(t);
      ui.tabs(t, [
        { id: 'key', t: 'Ключ → партиция', render: pane => kTabKey(fresh(pane)) },
        { id: 'off', t: 'Смещения и группы', render: pane => kTabOffsets(fresh(pane)) },
        { id: 'ord', t: 'Порядок и ребаланс', render: pane => kTabOrder(fresh(pane)) },
        { id: 'cmp', t: 'Сжатый топик', render: pane => kTabCompact(fresh(pane)) }
      ], 'key');
    }
  };
  function kTabKey(pane) {
    const st = { key: 'c-1001', parts: Array.from({ length: 12 }, () => []), n: 0, last: null };
    pane.innerHTML = `<div class="stack">
      <div class="mqk-box">
        <label class="field"><span>Ключ сообщения (<code>client_id</code>)</span><input type="text" data-k value="${esc(st.key)}" maxlength="40" aria-label="Ключ сообщения"></label>
        <div class="row">${PRESET.map(p => `<button type="button" class="btn xs" data-pre="${p.k}">${esc(p.t)} · ${p.k}</button>`).join('')}</div>
        <div data-calc></div>
        <div class="row"><button type="button" class="btn sm primary" data-pub>Опубликовать событие с этим ключом</button><button type="button" class="btn sm ghost" data-clr>Очистить топик</button></div>
      </div>
      <div class="mqk-parts" data-parts></div>
      <div data-n></div>
    </div>`;
    const inp = TR.$('[data-k]', pane);
    function draw() {
      const k = st.key.trim(), p = k ? partOf(k, 12) : null;
      TR.$('[data-calc]', pane).innerHTML = k ? `<div class="mono small">hash(«${esc(k)}») = ${TR.hash(k)} → ${TR.hash(k)} % 12 = <b style="color:var(--accent)">${p}</b> → партиция P${p}</div>` : '<div class="small dim">Без ключа Kafka раскладывает сообщения по партициям по кругу — куда попадёт, заранее не знаете.</div>';
      TR.$('[data-parts]', pane).innerHTML = st.parts.map((list, i) => `<div class="mqk-p ${i === p ? 'hit' : ''}"><span class="pn">P${i}</span>${list.slice(-3).map(e => `<span class="ev">#${e.off} ${esc(e.who)}: ${esc(e.t.replace('Membership', ''))}</span>`).join('')}${list.length > 3 ? `<span class="ev">…ещё ${list.length - 3}</span>` : ''}</div>`).join('');
      TR.$('[data-n]', pane).innerHTML = st.last ? ui.note('info', 'Что произошло', st.last) : ui.note('', 'Попробуйте', 'Опубликуйте 3–4 события одного клиента, потом другого. Посмотрите, куда они ложатся и как растёт номер (#) внутри партиции.');
    }
    inp.addEventListener('input', () => { st.key = inp.value; draw(); });
    TR.on(pane, 'click', '[data-pre]', (e, b) => { st.key = b.dataset.pre; inp.value = st.key; draw(); });
    TR.on(pane, 'click', '[data-clr]', () => { st.parts = Array.from({ length: 12 }, () => []); st.last = null; draw(); });
    TR.on(pane, 'click', '[data-pub]', () => {
      const k = st.key.trim(), p = k ? partOf(k, 12) : (st.n % 12);
      const who = (PRESET.find(x => x.k === k) || { t: k || 'без ключа' }).t;
      const mine = st.parts.reduce((s, l) => s + l.filter(e => e.key === k).length, 0);
      const ev = { key: k, who, t: MEM_EVENTS[mine % MEM_EVENTS.length], off: st.parts[p].length };
      st.parts[p].push(ev); st.n++;
      st.last = k ? `Событие <code>${ev.t}</code> клиента «${esc(who)}» легло в P${p} со смещением #${ev.off}. ${mine ? `Это уже ${mine + 1}-е событие этого ключа — и снова в P${p}: все события одного клиента стоят в одной партиции друг за другом, значит, их прочтут в том же порядке.` : 'Опубликуйте ещё одно с тем же ключом — оно попадёт туда же.'}` : `Без ключа событие легло в P${p} по кругу. Следующее уйдёт в другую партицию — порядок событий одного клиента уже не гарантирован.`;
      draw();
    });
    draw();
  }
  function kTabOffsets(pane) {
    const st = { start: 0, end: 6, g: { notifications: { off: 6, up: true }, analytics: { off: 3, up: true } }, msg: '' };
    const GN = { notifications: 'notifications', analytics: 'analytics' };
    function draw() {
      const cells = [];
      for (let o = Math.max(0, st.start - 2); o < st.end; o++) cells.push(o);
      const mk = o => Object.keys(st.g).filter(k => st.g[k].off === o).map(k => `<span style="color:${k === 'notifications' ? 'var(--info)' : 'var(--violet)'}">▲${k === 'notifications' ? 'N' : 'A'}</span>`).join(' ');
      pane.innerHTML = `<div class="stack">
        <div class="small muted">Партиция P7 топика <code>puls.membership.events.v1</code>. Ячейка — сообщение, номер — его смещение. ▲N — закладка группы <code>notifications</code>, ▲A — группы <code>analytics</code>: смещение, <b>следующее</b> к чтению.</div>
        <div class="mqk-log">${cells.map(o => `<div class="mqk-cell"><span class="c ${o < st.start ? 'gone' : ''}">#${o}</span><span class="mk">${mk(o)}</span></div>`).join('')}<div class="mqk-cell"><span class="c" style="background:transparent;border:1px dashed var(--accent)">…</span><span class="mk">${mk(st.end)}</span></div></div>
        <div class="row"><button type="button" class="btn sm primary" data-o="pub">+ опубликовать</button><button type="button" class="btn sm ghost" data-o="week">Прошло 7 дней</button></div>
        ${Object.keys(st.g).map(k => { const g = st.g[k], lag = st.end - Math.max(g.off, st.start); return `<div class="mqk-q"><div class="row between"><b>Группа <code>${GN[k]}</code></b>${g.up ? ui.status('работает', 'ok') : ui.status('лежит', 'bad')}</div><div class="small">прочитано до #${g.off - 1 < 0 ? '—' : g.off - 1} · отстаёт (lag): <b>${lag}</b></div><div class="row"><button type="button" class="btn xs" data-o="read|${k}" ${g.up ? '' : 'disabled'}>Прочитать следующее</button><button type="button" class="btn xs" data-o="all|${k}" ${g.up ? '' : 'disabled'}>Дочитать всё</button><button type="button" class="btn xs ghost" data-o="rew|${k}" ${g.up ? '' : 'disabled'}>Перечитать с начала</button><button type="button" class="btn xs ghost" data-o="tg|${k}">${g.up ? 'Уронить' : 'Поднять'}</button></div></div>`; }).join('')}
        ${st.msg ? ui.note(st.msg.k, '', st.msg.h) : ''}
      </div>`;
    }
    TR.on(pane, 'click', '[data-o]', (e, b) => {
      const [a, k] = b.dataset.o.split('|'), g = st.g[k];
      if (a === 'pub') { st.end++; st.msg = { k: 'info', h: `Новое сообщение получило смещение #${st.end - 1}. Его увидят <b>обе</b> группы — каждая когда дойдёт.` }; }
      if (a === 'read') { if (g.off < st.start) g.off = st.start; if (g.off < st.end) { g.off++; st.msg = { k: 'info', h: `<code>${k}</code> прочла #${g.off - 1} и подвинула закладку (сделала commit смещения). Сообщение <b>осталось</b> в журнале — вторая группа прочтёт его сама.` }; } else st.msg = { k: '', h: `<code>${k}</code> прочла всё — ждёт новых сообщений.` }; }
      if (a === 'all') { const was = Math.max(g.off, st.start); g.off = st.end; st.msg = { k: 'ok', h: `<code>${k}</code> дочитала ${st.end - was} ${TR.plural(st.end - was, 'сообщение', 'сообщения', 'сообщений')} — отставание 0.` }; }
      if (a === 'rew') { g.off = st.start; st.msg = { k: 'warn', h: `<code>${k}</code> сдвинула закладку на самое старое хранимое сообщение #${st.start}. Так аналитика пересчитывает отчёт после исправления ошибки. Вторая группа ничего не заметила.` }; }
      if (a === 'tg') { g.up = !g.up; st.msg = { k: g.up ? 'ok' : 'warn', h: g.up ? `<code>${k}</code> поднялась и продолжит со своей закладки.` : `<code>${k}</code> лежит. Публикуйте дальше — сообщения копятся, отставание растёт.` }; }
      if (a === 'week') {
        const old = st.start; st.start = st.end;
        const lost = Object.keys(st.g).filter(x => st.g[x].off < st.start).map(x => `<code>${x}</code> (не дочитала ${st.start - Math.max(st.g[x].off, old)})`);
        Object.keys(st.g).forEach(x => { if (st.g[x].off < st.start) st.g[x].off = st.start; });
        st.msg = { k: lost.length ? 'bad' : 'ok', h: `Срок хранения 7 дней: сообщения #${old}…#${st.start - 1} удалены, прочитаны они или нет. ${lost.length ? `Пропали непрочитанными для: ${lost.join(', ')}. Их закладки переехали на самое старое, что осталось. Отставание дольше срока хранения = потеря. Поэтому за отставанием следит дежурный.` : 'Все группы успели прочитать — никто ничего не потерял.'}` };
      }
      draw();
    });
    draw();
  }
  const ORD_EVENTS = [
    { id: 'a1', who: 'Анна', key: 'c-1001', t: 'активирован' }, { id: 'p1', who: 'Пётр', key: 'c-2002', t: 'активирован' },
    { id: 'a2', who: 'Анна', key: 'c-1001', t: 'заморожен' }, { id: 'p2', who: 'Пётр', key: 'c-2002', t: 'заморожен' },
    { id: 'a3', who: 'Анна', key: 'c-1001', t: 'разморожен' }
  ];
  function kTabOrder(pane) {
    const st = { inst: 3, prev: 3, keyed: true, run: 1 };
    pane.innerHTML = `<div class="stack">
      <div class="eyebrow">Экземпляры в группе <code>notifications</code> и 12 партиций</div>
      <label class="field"><span>Экземпляров сервиса уведомлений: <b data-iv></b></span><input type="range" class="mqk-range" min="1" max="14" value="3" data-inst aria-label="Экземпляров в группе"></label>
      <div class="mqk-parts" data-asg></div>
      <div data-rb></div>
      <div class="eyebrow">Порядок: события двух клиентов</div>
      <div class="row">${ui.seg('keyed', [{ v: '1', t: 'с ключом client_id' }, { v: '0', t: 'без ключа' }], '1', 'accent')}<button type="button" class="btn sm" data-rerun>Прогнать ещё раз</button></div>
      <div data-ord></div>
    </div>`;
    function drawAsg() {
      TR.$('[data-iv]', pane).textContent = st.inst;
      const owner = p => p % st.inst;
      TR.$('[data-asg]', pane).innerHTML = Array.from({ length: 12 }, (_, p) => `<div class="mqk-p"><span class="pn">P${p}</span><span class="ev" style="color:${PCOL[owner(p) % PCOL.length]};font-weight:600">экз. ${owner(p) + 1}</span></div>`).join('');
      const idle = Math.max(0, st.inst - 12);
      const changed = st.inst !== st.prev;
      TR.$('[data-rb]', pane).innerHTML = (changed ? ui.note('warn', 'Ребаланс', `Число экземпляров изменилось (${st.prev} → ${st.inst}). Группа на несколько секунд перестаёт читать и заново делит партиции. То, что экземпляр успел обработать, но не подтвердил смещение до ребаланса, прочитает уже другой экземпляр — ещё раз. Отсюда дубли; разберём в среду.`) : '') +
        (idle ? ui.note('bad', `${idle} ${TR.plural(idle, 'экземпляр простаивает', 'экземпляра простаивают', 'экземпляров простаивают')}`, 'Одну партицию в группе читает только один экземпляр. Партиций 12 — значит, больше 12 экземпляров группе не помогут: лишние ждут, пока кто-то упадёт.') : ui.note('', 'Деление работы', `Каждая партиция — ровно у одного экземпляра группы, поэтому порядок внутри партиции сохраняется. ${st.inst === 12 ? 'По одной партиции на экземпляр — максимум параллельности.' : `Экземпляр читает ${Math.ceil(12 / st.inst)}–${Math.floor(12 / st.inst)} ${TR.plural(Math.floor(12 / st.inst), 'партицию', 'партиции', 'партиций')}.`}`));
    }
    function drawOrd() {
      const r = TR.rand('ord' + st.run + st.keyed);
      const part = (ev, i) => st.keyed ? partOf(ev.key, 12) : i % 12;
      const lagByPart = {};
      const timed = ORD_EVENTS.map((ev, i) => { const p = part(ev, i); if (lagByPart[p] == null) lagByPart[p] = r() * 3; return { ev, p, at: i + lagByPart[p] + (st.keyed ? 0 : r() * 2) }; });
      // внутри партиции порядок сохраняется
      const byPart = {};
      timed.forEach(x => { (byPart[x.p] = byPart[x.p] || []).push(x); });
      Object.values(byPart).forEach(list => { for (let i = 1; i < list.length; i++) list[i].at = Math.max(list[i].at, list[i - 1].at + 0.01); });
      const done = timed.slice().sort((a, b) => a.at - b.at);
      const seen = {}, broken = new Set();
      done.forEach(x => { const prev = ORD_EVENTS.filter(e => e.key === x.ev.key && ORD_EVENTS.indexOf(e) < ORD_EVENTS.indexOf(x.ev)); if (prev.some(e => !seen[e.id])) broken.add(x.ev.id); seen[x.ev.id] = 1; });
      TR.$('[data-ord]', pane).innerHTML = `<div class="stack tight">
        <div class="small dim">Как опубликовали: ${ORD_EVENTS.map(e => `${esc(e.who)} — ${esc(e.t)}`).join(' → ')}</div>
        <div class="small dim">Партиции: ${[...new Set(timed.map(x => x.p))].map(p => `P${p}: ${timed.filter(x => x.p === p).map(x => esc(x.ev.who[0]) + (ORD_EVENTS.filter(e => e.key === x.ev.key).indexOf(x.ev) + 1)).join(', ')}`).join(' · ')}</div>
        <div class="mqk-chips">${done.map((x, i) => `<span class="mqk-chip ${broken.has(x.ev.id) ? 'bad' : ''}"><span class="n">${i + 1}</span>${esc(x.ev.who)}: ${esc(x.ev.t)}</span>`).join('')}</div>
        ${broken.size ? ui.note('bad', 'Порядок клиента нарушен', 'Без ключа события одного клиента попали в разные партиции, а партиции читаются параллельно с разной скоростью. Уведомления сообщили «разморожен» раньше, чем «заморожен» — клиент запутался.') : ui.note('ok', 'У каждого клиента — свой правильный порядок', st.keyed ? 'Общий порядок от прогона к прогону разный: партиции читаются параллельно. Но события <b>одного ключа</b> лежат в одной партиции и всегда обрабатываются по очереди. Kafka гарантирует порядок только внутри партиции.' : 'В этот раз повезло. Нажмите «Прогнать ещё раз» — без ключа порядок держится только случайно.')}
      </div>`;
    }
    TR.$('[data-inst]', pane).addEventListener('input', e => { st.prev = st.inst; st.inst = +e.target.value; drawAsg(); });
    ui.onSeg(pane, (n, v) => { if (n === 'keyed') { st.keyed = v === '1'; drawOrd(); } });
    TR.on(pane, 'click', '[data-rerun]', () => { st.run++; drawOrd(); });
    st.prev = st.inst; drawAsg(); drawOrd();
  }
  function kTabCompact(pane) {
    const UPD = [
      { k: 'c-1001', who: 'Анна', v: 'пускать до 31.03' }, { k: 'c-2002', who: 'Пётр', v: 'пускать до 15.11' },
      { k: 'c-1001', who: 'Анна', v: 'заморожен — не пускать' }, { k: 'c-3003', who: 'Ира', v: 'пускать до 01.02' },
      { k: 'c-2002', who: 'Пётр', v: 'истёк — не пускать' }, { k: 'c-1001', who: 'Анна', v: 'пускать до 14.04' }
    ];
    let compacted = false;
    function draw() {
      const last = {}; UPD.forEach((u, i) => { last[u.k] = i; });
      const rows = UPD.map((u, i) => ({ u, i, keep: last[u.k] === i }));
      pane.innerHTML = `<div class="stack">
        <div class="small muted">Топик <code>puls.access.allowlist.v1</code>: ключ — <code>client_id</code>, значение — «пускать ли и до какого числа». Настройка <code>cleanup.policy=compact</code>: Kafka не удаляет сообщения по сроку, а оставляет <b>последнее значение каждого ключа</b>.</div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Смещение</th><th>Ключ</th><th>Значение</th><th>После сжатия</th></tr></thead><tbody>${rows.map(x => `<tr class="${compacted && !x.keep ? '' : ''}"><td class="num">#${x.i}</td><td><code>${x.u.k}</code> ${esc(x.u.who)}</td><td style="${compacted && !x.keep ? 'text-decoration:line-through;color:var(--text-muted)' : ''}">${esc(x.u.v)}</td><td>${compacted ? (x.keep ? ui.status('осталось', 'ok') : ui.status('удалено', '')) : '<span class="dim">—</span>'}</td></tr>`).join('')}</tbody></table></div>
        <div class="row"><button type="button" class="btn sm primary" data-c>${compacted ? 'Вернуть как было' : 'Запустить сжатие'}</button></div>
        ${compacted ? ui.note('ok', 'Новый контроллер клуба читает с начала', `Открылся клуб в Новосибирске. Его контроллер турникетов читает топик с самого начала и получает ровно по одной строке на клиента: ${Object.keys(last).map(k => `${esc(UPD[last[k]].who)} — «${esc(UPD[last[k]].v)}»`).join('; ')}. Это готовый актуальный список пропусков. В обычном топике за 7 дней не было бы тех, у кого абонемент не менялся месяц.`) : ui.note('', 'Нажмите «Запустить сжатие»', 'Сейчас у Анны три сообщения, у Петра два. Контроллеру нужно только последнее состояние — история ему не важна.')}
      </div>`;
    }
    TR.on(pane, 'click', '[data-c]', () => { compacted = !compacted; draw(); });
    draw();
  }

  // =====================================================================
  // Теория 2. RabbitMQ — почтовое отделение
  // =====================================================================
  const RKEYS = ['msk.sokol.cleaning', 'msk.sokol.turnstile', 'kzn.center.turnstile', 'nsk.lenina.turnstile'];
  const RKEY_T = { 'msk.sokol.cleaning': 'Москва, «Сокол»: нужна уборка', 'msk.sokol.turnstile': 'Москва, «Сокол»: турникет сломался', 'kzn.center.turnstile': 'Казань, «Центр»: турникет сломался', 'nsk.lenina.turnstile': 'Новосибирск, «Ленина»: турникет сломался' };
  const RQUEUES = [
    { id: 'q1', t: 'Сокол: администратор', bind: 'msk.sokol.cleaning' },
    { id: 'q2', t: 'Техники Москвы', bind: 'msk.*.turnstile' },
    { id: 'q3', t: 'Турникеты всей сети', bind: '*.*.turnstile' },
    { id: 'q4', t: 'Журнал всего', bind: '#' }
  ];
  function topicMatch(pat, key) {
    const p = pat.split('.'), k = key.split('.');
    const go = (i, j) => {
      if (i === p.length) return j === k.length;
      if (p[i] === '#') { for (let x = j; x <= k.length; x++) if (go(i + 1, x)) return true; return false; }
      if (j === k.length) return false;
      return (p[i] === '*' || p[i] === k[j]) && go(i + 1, j + 1);
    };
    return go(0, 0);
  }
  const routeTo = (type, bind, key) => type === 'fanout' ? true : type === 'direct' ? bind === key : topicMatch(bind, key);
  const howRabbit = {
    id: 'how-rabbit', covers: ['rabbit-lab', 'why-both'], title: 'Как это работает: RabbitMQ — почтовое отделение', free: true, noReset: true,
    simple: {
      icon: '🏤',
      plain: 'RabbitMQ — почта с сортировкой. Письмо приходит на сортировочный стол, оттуда по адресу раскладывается в ящики-очереди. Из ящика письмо забирает один почтальон и, когда доставил, отмечает «вручено» — тогда письмо выбрасывают.',
      analogy: 'Сортировщик смотрит на индекс: «все письма на 101…» — в ящик района, «все письма Москвы» — в ящик города, «копию всего» — в архив. Почтальон не смог вручить — письмо возвращается на полку и уходит снова. После трёх неудачных попыток — в отдел «невостребованные». Срочные телеграммы почтальон берёт раньше рекламных буклетов.',
      tech: '<b>Обменник</b> (exchange) принимает сообщение и по <b>ключу маршрутизации</b> (routing key) раскладывает в очереди по <b>привязкам</b> (binding). Типы: <code>direct</code> — ключ совпал буква в букву; <code>topic</code> — шаблон, <code>*</code> = одно слово, <code>#</code> = любое число слов; <code>fanout</code> — копия во все привязанные очереди. Исполнитель подтверждает обработку (<b>ack</b>), без ack сообщение доставят снова. Повтор с паузой, DLQ для неразобранных, приоритеты в очереди (<code>x-max-priority</code>).'
    },
    lead: ui.brief({
      situation: 'Соседний пример — оповещения персонала клубов: «сломался турникет», «нужна уборка». Обменник <code>puls.staff</code>, ключ маршрутизации — <code>город.клуб.что_случилось</code>, например <code>msk.sokol.turnstile</code>. Четыре очереди с разными привязками.',
      todo: [
        '«Обменник и очереди»: выберите тип обменника и ключ сообщения, нажмите «Отправить». Посмотрите, какие очереди его получили. Пройдите все три типа.',
        '«Ack, повтор, DLQ, приоритеты»: пройдите три сценария по шагам и включите-выключите приоритеты в очереди.',
        '«Журнал или почта»: отметьте требования задачи — увидите, какой брокер подходит больше.'
      ],
      look: 'Под названием очереди — её привязка (шаблон адреса). Зелёная рамка — очередь получила сообщение. Число — сколько сообщений в ней лежит.'
    }),
    render(el) {
      el.classList.add('mqk-root');
      const t = document.createElement('div'); el.appendChild(t);
      ui.tabs(t, [
        { id: 'route', t: 'Обменник и очереди', render: pane => rTabRoute(fresh(pane)) },
        { id: 'ack', t: 'Ack, повтор, DLQ, приоритеты', render: pane => rTabAck(fresh(pane)) },
        { id: 'fit', t: 'Журнал или почта', render: pane => rTabFit(fresh(pane)) }
      ], 'route');
    }
  };
  function rTabRoute(pane) {
    const st = { type: 'topic', key: RKEYS[1], cnt: { q1: 0, q2: 0, q3: 0, q4: 0 }, hit: [], msg: null };
    pane.innerHTML = `<div class="stack">
      <div class="mqk-box"><div class="mqk-set">
        <div class="lbl">Тип обменника <code>puls.staff</code></div>${ui.seg('rt', [{ v: 'direct', t: 'direct' }, { v: 'topic', t: 'topic' }, { v: 'fanout', t: 'fanout' }], st.type, 'accent')}
        <div class="lbl">Ключ маршрутизации</div><select data-key aria-label="Ключ маршрутизации">${RKEYS.map(k => `<option value="${k}" ${k === st.key ? 'selected' : ''}>${k} — ${esc(RKEY_T[k])}</option>`).join('')}</select>
      </div><div class="row"><button type="button" class="btn sm primary" data-send>Отправить</button><button type="button" class="btn sm ghost" data-zero>Очистить очереди</button></div></div>
      <div class="mqk-qs" data-qs></div>
      <div data-n></div>
    </div>`;
    function draw() {
      TR.$('[data-qs]', pane).innerHTML = RQUEUES.map(q => `<div class="mqk-q ${st.hit.includes(q.id) ? 'hit' : ''}"><b>${esc(q.t)}</b><span class="bd">${st.type === 'fanout' ? 'привязка без ключа' : 'привязка: ' + q.bind}</span><span class="cnt">${st.cnt[q.id]}</span></div>`).join('');
      TR.$('[data-n]', pane).innerHTML = st.msg || ui.note('', 'Как читать', { direct: '<code>direct</code> сравнивает ключ с привязкой буква в букву. Звёздочка для него — просто символ.', topic: '<code>topic</code> понимает шаблоны: <code>*</code> — ровно одно слово между точками, <code>#</code> — сколько угодно слов, даже ноль.', fanout: '<code>fanout</code> не смотрит на ключ: копия — во все привязанные очереди.' }[st.type]);
    }
    ui.onSeg(pane, (n, v) => { if (n === 'rt') { st.type = v; st.hit = []; st.msg = null; draw(); } });
    TR.$('[data-key]', pane).addEventListener('change', e => { st.key = e.target.value; st.hit = []; st.msg = null; draw(); });
    TR.on(pane, 'click', '[data-zero]', () => { Object.keys(st.cnt).forEach(k => { st.cnt[k] = 0; }); st.hit = []; st.msg = null; draw(); });
    TR.on(pane, 'click', '[data-send]', () => {
      st.hit = RQUEUES.filter(q => routeTo(st.type, q.bind, st.key)).map(q => q.id);
      st.hit.forEach(id => { st.cnt[id]++; });
      const names = RQUEUES.filter(q => st.hit.includes(q.id)).map(q => '«' + esc(q.t) + '»');
      if (!st.hit.length) st.msg = ui.note('bad', 'Сообщение никуда не попало', `Ни одна привязка не совпала с <code>${st.key}</code>. RabbitMQ такое сообщение просто выбрасывает (если не настроен запасной обменник). ${st.type === 'direct' ? 'В <code>direct</code> шаблоны не работают: <code>msk.*.turnstile</code> ≠ <code>msk.sokol.turnstile</code>.' : ''}`);
      else st.msg = ui.note(st.type === 'fanout' && st.hit.length === RQUEUES.length ? 'warn' : 'ok', `Попало в ${st.hit.length} ${TR.plural(st.hit.length, 'очередь', 'очереди', 'очередей')}`, `${names.join(', ')}. ${st.type === 'topic' ? 'Каждая очередь получила свою копию по своему шаблону.' : st.type === 'fanout' ? 'Копия ушла всем, даже администратору «Сокола» про турникет в Новосибирске. Fanout хорош, когда всем действительно нужно всё.' : 'Совпала только точная привязка.'}`);
      draw();
    });
    draw();
  }
  const ACK_LANES = [L('pub', 'Сервис', 'кладёт задачу'), L('q', 'Очередь', 'RabbitMQ'), L('w', 'Исполнитель', 'отправщик'), L('dlq', 'DLQ', 'неразобранные')];
  const PRIO_MSGS = [
    { t: 'реклама #1', p: 1 }, { t: 'реклама #2', p: 1 }, { t: 'реклама #3', p: 1 }, { t: 'турникет сломался', p: 9 }, { t: 'реклама #4', p: 1 }, { t: 'уборка', p: 5 }
  ];
  function rTabAck(pane) {
    pane.innerHTML = '<div class="stack"><div data-w></div><div class="eyebrow">Приоритеты в очереди</div><div data-pr></div></div>';
    walk(TR.$('[data-w]', pane), {
      laneW: 160,
      scenarios: [
        {
          id: 'ok', t: 'Обработано (ack)', lanes: ACK_LANES, sumKind: 'ok', sum: 'Сообщение удаляется только после подтверждения. Пока ack нет, RabbitMQ считает его «в работе» у этого исполнителя.',
          steps: [
            { from: 'pub', to: 'q', t: 'задача: «турникет»', note: 'Сервис кладёт сообщение в очередь через обменник.' },
            { from: 'q', to: 'w', t: 'доставка', kind: 'accent', note: 'Очередь отдаёт сообщение одному исполнителю и помечает его «выдано, ждём подтверждения».' },
            { from: 'w', to: 'w', t: 'отправить техникам', note: 'Исполнитель делает работу — шлёт оповещение.' },
            { from: 'w', to: 'q', t: 'ack', reply: true, kind: 'ok', note: 'Исполнитель подтверждает: <b>ack</b> — «готово».' },
            { from: 'q', to: 'q', t: 'удалить сообщение', kind: 'ok', note: 'Только теперь сообщение удаляется из очереди.' }
          ]
        },
        {
          id: 'crash', t: 'Исполнитель упал', lanes: ACK_LANES, sumKind: 'warn', sum: 'Подтверждение после работы (ручной ack) — защита от потерь. Если включить автоподтверждение (auto-ack: «удалить сразу при выдаче»), падение исполнителя молча теряет сообщение. Цена ручного ack: работу могут сделать дважды — исполнитель должен это переживать.',
          steps: [
            { from: 'q', to: 'w', t: 'доставка', kind: 'accent', note: 'Сообщение выдано исполнителю.' },
            { from: 'w', to: 'w', t: 'упал на середине', kind: 'bad', note: 'Исполнитель упал, не прислав ack. Соединение с RabbitMQ оборвалось.' },
            { from: 'q', to: 'q', t: 'вернуть в очередь', kind: 'warn', note: 'RabbitMQ видит: соединение закрыто, ack не было — значит, работа не сделана. Сообщение возвращается в очередь.' },
            { from: 'q', to: 'w', t: 'доставка снова', kind: 'accent', note: 'Его получает другой (или перезапущенный) исполнитель. Возможно, первый всё-таки успел отправить — поэтому повторная доставка может дать дубль.' },
            { from: 'w', to: 'q', t: 'ack', reply: true, kind: 'ok', note: 'Готово.' }
          ]
        },
        {
          id: 'poison', t: 'Ядовитое сообщение', lanes: ACK_LANES, sumKind: 'ok', sum: 'Повтор с паузой спасает от временных сбоев, а DLQ — от бесконечного цикла с ядовитым сообщением. Без DLQ оно крутилось бы тысячи раз в минуту и занимало исполнителя.',
          steps: [
            { from: 'q', to: 'w', t: 'доставка', kind: 'accent', note: 'В сообщении ошибка: клуба с таким кодом нет. Обработать его нельзя в принципе — такое называют <b>ядовитым</b>.' },
            { from: 'w', to: 'q', t: 'nack: ошибка', reply: true, kind: 'bad', note: 'Исполнитель отвечает «не смог» (nack).' },
            { from: 'q', to: 'q', t: 'пауза 1 мин, попытка 2', kind: 'warn', note: 'Сообщение уходит в очередь ожидания и возвращается через минуту — вдруг сбой был временный.' },
            { from: 'q', to: 'w', t: 'попытка 3', kind: 'warn', note: 'Третья попытка — снова ошибка.' },
            { from: 'q', to: 'dlq', t: 'в DLQ', kind: 'bad', note: 'После трёх попыток сообщение перекладывается в <b>DLQ</b> — очередь недоставленных. Основная очередь свободна, дежурный получает сигнал и разбирает вручную.' }
          ]
        }
      ]
    });
    const pr = TR.$('[data-pr]', pane);
    let on = false;
    function draw() {
      const order = on ? PRIO_MSGS.map((m, i) => ({ m, i })).sort((a, b) => b.m.p - a.m.p || a.i - b.i) : PRIO_MSGS.map((m, i) => ({ m, i }));
      const pos = order.findIndex(x => x.m.p === 9) + 1;
      pr.innerHTML = `<div class="stack tight"><label class="toggle"><input type="checkbox" data-pon ${on ? 'checked' : ''}> <span>Очередь с приоритетами (<code>x-max-priority=10</code>): «турникет» — 9, «уборка» — 5, реклама — 1</span></label>
        <div class="small dim">Порядок, в котором исполнитель заберёт сообщения:</div>
        <div class="mqk-chips">${order.map((x, k) => `<span class="mqk-chip ${x.m.p === 9 ? 'ok' : ''}"><span class="n">${k + 1}</span>${esc(x.m.t)}</span>`).join('')}</div>
        ${ui.note(on ? 'ok' : 'warn', on ? 'Срочное — первым' : 'По очереди прихода', on ? 'Сообщение с высоким приоритетом обгоняет рекламу, даже если пришло позже.' : `«Турникет сломался» стоит ${pos}-м — за рекламой. Если рекламы 900 штук, техник узнает через полчаса.`)}</div>`;
    }
    pr.addEventListener('change', e => { if (e.target.matches('[data-pon]')) { on = e.target.checked; draw(); } });
    draw();
  }
  const REQS = [
    { id: 'many', t: 'Одно сообщение читают несколько независимых сервисов', k: 3, r: 0 },
    { id: 'replay', t: 'Нужно перечитать сообщения за прошлую неделю', k: 3, r: 0 },
    { id: 'order', t: 'Строгий порядок сообщений одного ключа', k: 3, r: 1 },
    { id: 'thru', t: 'Миллионы сообщений в день, всё хранится', k: 2, r: 1 },
    { id: 'last', t: 'Хранить последнее значение по каждому ключу', k: 3, r: 0 },
    { id: 'prio', t: 'Срочные сообщения обгоняют несрочные', k: 0, r: 3 },
    { id: 'retry1', t: 'Повторить одно сообщение через минуту, не задерживая остальные', k: 1, r: 3 },
    { id: 'ackeach', t: 'Подтверждение каждого сообщения и повторная выдача, если исполнитель упал', k: 1, r: 3 },
    { id: 'route', t: 'Раскладывать по очередям по шаблону адреса', k: 0, r: 3 }
  ];
  function rTabFit(pane) {
    const sel = new Set(['many', 'replay']);
    function draw() {
      let k = 0, r = 0, mx = 0;
      REQS.forEach(q => { if (sel.has(q.id)) { k += q.k; r += q.r; mx += 3; } });
      const kp = mx ? k / mx : 0, rp = mx ? r / mx : 0;
      pane.innerHTML = `<div class="stack">
        <div class="small muted">Отметьте, что важно в задаче. Шкалы покажут, кто справится естественно (3 балла), с оговорками (1–2) или никак (0).</div>
        <div class="mqk-req">${REQS.map(q => `<label><input type="checkbox" data-rq="${q.id}" ${sel.has(q.id) ? 'checked' : ''}> <span>${esc(q.t)}</span></label>`).join('')}</div>
        <div class="mqk-fit"><b>Kafka</b>${ui.meter(kp, kp >= rp ? 'ok' : '')}<span class="mono small">${Math.round(kp * 100)}%</span></div>
        <div class="mqk-fit"><b>RabbitMQ</b>${ui.meter(rp, rp > kp ? 'ok' : '')}<span class="mono small">${Math.round(rp * 100)}%</span></div>
        ${ui.note('info', 'Правило «Пульса»', 'Факты, которые читают многие, — в Kafka (журнал). Поручения, которые надо надёжно выполнить по одному, — в RabbitMQ (почта). Попробуйте отметить требования к уведомлениям: приоритет, повтор одного сообщения, ack каждого.')}
      </div>`;
    }
    pane.addEventListener('change', e => { const c = e.target.closest('[data-rq]'); if (!c) return; if (c.checked) sel.add(c.dataset.rq); else sel.delete(c.dataset.rq); draw(); });
    draw();
  }

  // =====================================================================
  // Практика 1. Кому что
  // =====================================================================
  const WW_CH = [
    { v: 'kafka', t: 'Kafka — топик событий' },
    { v: 'compact', t: 'Kafka — сжатый топик' },
    { v: 'rabbit', t: 'RabbitMQ — очередь задач' },
    { v: 'table', t: 'Таблица-очередь в PostgreSQL' },
    { v: 'none', t: 'Брокер не нужен' }
  ];
  const WW = [
    { id: 'ww-book', t: 'Событие «клиент записался»: его читают 6 сервисов, аналитика иногда перечитывает неделю', ok: 'kafka', crit: true, hint: 'Сколько читателей у одного сообщения и нужно ли его перечитывать?', why: 'Много независимых групп и перечитывание за 7 дней — журнал. Топик <code>puls.booking.events.v1</code>.' },
    { id: 'ww-push', t: 'Отправить до 300 тыс. пушей и SMS за вечер воскресенья: код входа важнее рекламы, недоставленные — в разбор', ok: 'rabbit', crit: true, hint: 'Это поручения. Что им нужно: приоритеты, подтверждение, повтор, отдельная очередь неразобранных — у кого это есть «из коробки»?', why: 'Поручения с приоритетами, ack, отложенным повтором и DLQ — RabbitMQ.' },
    { id: 'ww-allow', t: 'Контроллеру нового клуба нужен актуальный список пропусков всех клиентов сети', ok: 'compact', alt: { kafka: 'Обычный топик хранит 7 дней: клиента, у которого абонемент не менялся месяц, новый контроллер не увидит. Нужно последнее значение по ключу — сжатый топик.' }, hint: 'Контроллеру нужна не история, а последнее состояние каждого клиента — даже того, у кого ничего не менялось месяц.', why: 'Последнее значение по <code>client_id</code> — сжатый топик <code>puls.access.allowlist.v1</code>.' },
    { id: 'ww-pay', t: 'Платёж прошёл — абонементы, выгрузка в 1С и аналитика должны узнать', ok: 'kafka', hint: 'Это факт или поручение? Сколько у него получателей?', why: 'Факт для трёх групп — <code>puls.payment.events.v1</code>.' },
    { id: 'ww-bonus', t: 'Начислить +10 бонусов за каждое посещение клуба (50 тыс. в день)', ok: 'kafka', alt: { rabbit: 'Сработает, но тогда сервис «Доступ» должен знать о бонусах и класть им задачу. Проще: бонусы сами читают событие о визите из Kafka (группа <code>bonus</code> в <code>puls.access.visits.v1</code>).' }, hint: 'Кто здесь источник факта — и должен ли он знать, что на этот факт кто-то начисляет бонусы?', why: 'Бонусы читают визиты из <code>puls.access.visits.v1</code> своей группой — «Доступ» о них не знает.' },
    { id: 'ww-report', t: 'Выгрузка выручки для директора: 1–2 задачи в месяц, готовится 2 минуты, один исполнитель', ok: 'table', alt: { rabbit: 'Работать будет, но ради двух задач в месяц таблицы со статусом хватает с запасом — так и было в сезоне 1 (202 + опрос статуса).' }, hint: 'Две задачи в месяц и один исполнитель. Что проще всего, если база уже есть?', why: 'Строка в таблице со статусом и фоновая задача — как в сезоне 1 (202 + опрос статуса).' },
    { id: 'ww-reg', t: 'Клиент записывается на занятие и ждёт: «записаны» или «мест нет»', ok: 'none', crit: true, hint: 'Клиенту нужен ответ сейчас, на экране.', why: 'Синхронный REST-запрос. Событие публикуется уже после — для остальных.' },
    { id: 'ww-turn', t: 'Турникет проверяет пропуск — решение за 300 мс', ok: 'none', hint: 'Человек стоит у турникета. Брокер добавит задержку и ответ «потом».', why: 'Синхронный gRPC к сервису «Доступ», без связи — локальный список.' }
  ];
  function wwEval(v) {
    v = v || {};
    return WW.map(w => { const g = v[w.id]; if (g === w.ok) return { w, s: 'ok', pts: 1 }; if (w.alt && w.alt[g]) return { w, s: 'warn', pts: 0.5 }; return { w, s: 'bad', pts: 0, empty: !g }; });
  }
  const whoTask = {
    id: 'who-what', title: 'Кому что: Kafka, RabbitMQ или без брокера',
    simple: {
      icon: '🧭',
      plain: 'Брокер выбирают под задачу. Факт для многих — в журнал. Поручение, которое надо выполнить по одному, — в почту с очередями. А там, где человек ждёт ответа, брокер не нужен.',
      analogy: 'Журнал смены на ресепшене — чтобы все узнали, что случилось. Стопка заказов на кухне — чтобы каждый заказ приготовили один раз. Звонок по телефону — когда ответ нужен прямо сейчас.',
      tech: 'Kafka — журнал: много групп, хранение и перечитывание, порядок по ключу, сжатые топики. RabbitMQ — очереди задач: ack, повтор, DLQ, приоритеты, маршрутизация. Таблица-очередь — когда задач мало и исполнитель один. Синхронный вызов — когда нужен ответ сразу.'
    },
    lead: ui.brief({
      situation: 'Антон положил на стол восемь задач «Пульса» после роста. В каждой надо выбрать: Kafka (обычный топик), Kafka (сжатый топик), RabbitMQ, таблица-очередь в PostgreSQL или брокер вообще не нужен.',
      todo: [
        'В каждой строке выберите вариант в выпадающем списке.',
        'Спрашивайте себя: это факт или поручение? сколько получателей? нужна ли история или только последнее состояние? ждёт ли человек ответа?',
        'Нажмите «Проверить». Засчитывается от 80 %; второй допустимый ответ засчитывается наполовину с пояснением.'
      ],
      lookTitle: 'Подсказка',
      look: 'Kafka хранит всё 7 дней и даёт читать многим. RabbitMQ удаляет сообщение после ack, зато умеет приоритеты, повтор одного сообщения и DLQ. Сжатый топик хранит последнее значение каждого ключа бессрочно.'
    }),
    blank: () => ({ v: {} }),
    reference: () => ({ v: Object.fromEntries(WW.map(w => [w.id, w.ok])) }),
    render(el, ctx) {
      el.classList.add('mqk-root');
      let reveal = null;
      if (ctx.result) { reveal = {}; wwEval(ctx.ans.v).forEach(x => { reveal[x.w.id] = { s: x.s, why: x.s === 'ok' ? x.w.why : x.s === 'warn' ? x.w.alt[(ctx.ans.v || {})[x.w.id]] : x.w.hint }; }); }
      const d = document.createElement('div'); el.appendChild(d);
      ui.match(d, { rows: WW.map(w => ({ id: w.id, t: w.t })), choices: WW_CH, value: ctx.ans.v || {}, reveal, readonly: ctx.readonly, placeholder: 'Выберите…', onChange: v => { ctx.ans.v = v; ctx.save(); } });
    },
    check(ans) {
      const ev = wwEval(ans && ans.v), score = ev.reduce((s, x) => s + x.pts, 0) / WW.length, crit = ev.filter(x => x.w.crit && x.s !== 'ok');
      const notes = ev.filter(x => x.s !== 'ok').map(x => ({ ok: x.s === 'warn' ? 'warn' : false, html: `«${esc(x.w.t)}» — ${x.s === 'warn' ? x.w.alt[(ans.v || {})[x.w.id]] : (x.empty ? 'не выбрано. ' : '') + x.w.hint}` }));
      if (!notes.length) notes.push({ ok: true, html: 'Все восемь — по делу.' });
      return { ok: score >= 0.8 && !crit.length, score, notes, summary: `Точно: ${ev.filter(x => x.s === 'ok').length} из ${WW.length}, допустимо: ${ev.filter(x => x.s === 'warn').length}.`, vera: crit.length ? 'Сначала три опорные строки: «записался» (факт для шести), пуши и SMS (поручения с приоритетом), запись на занятие (человек ждёт).' : null };
    },
    explain: `<p>Решение «Пульса» (DOMAIN-2, §4): <b>Kafka</b> — для доменных событий (<code>booking</code>, <code>membership</code>, <code>payment</code>, <code>access</code>, <code>bonus</code>), <b>RabbitMQ</b> — для очереди задач на отправку уведомлений, <b>сжатый топик</b> — для списка пропусков контроллеров. Всё, где человек ждёт ответа, — синхронно. Редкие фоновые задачи — по-прежнему таблицей.</p><p>Обратите внимание на бонусы: «Доступ» не кладёт задачу «начисли бонусы» — он публикует факт «клиент прошёл», а бонусы сами решают, что с ним делать. Так «Доступ» не меняется, когда появляется новый потребитель.</p>`,
    report: ans => wwEval(ans && ans.v).map(x => `- ${x.w.t} → ${tOf(WW_CH, (ans.v || {})[x.w.id])} ${x.s === 'ok' ? '✓' : x.s === 'warn' ? '≈' : '✗'}`).join('\n')
  };

  // =====================================================================
  // Практика 2. Топик записей: ключ, партиции, группы (лаборатория перемешанных событий)
  // =====================================================================
  const KEYS = [{ v: 'none', t: 'без ключа' }, { v: 'client', t: 'client_id' }, { v: 'booking', t: 'booking_id' }, { v: 'session', t: 'class_session_id' }];
  const PARTS = [{ v: '1', t: '1' }, { v: '3', t: '3' }, { v: '12', t: '12' }, { v: '48', t: '48' }];
  const INST = [{ v: '1', t: '1' }, { v: '4', t: '4' }, { v: '8', t: '8' }, { v: '12', t: '12' }, { v: '20', t: '20' }];
  const GRP = [{ v: 'one', t: 'одна группа на все 6 сервисов' }, { v: 'svc', t: 'своя группа у каждого сервиса' }, { v: 'inst', t: 'своя группа у каждого экземпляра' }];
  const RATE = 400, PER = 50;
  const STORY = [
    { id: 'e1', at: '17:50', type: 'BookingCreated', txt: 'Ира встала в лист ожидания', client: 'c-3003', booking: 'b-ira', who: 'Ира' },
    { id: 'e2', at: '18:05', type: 'BookingCancelled', txt: 'Анна отменила запись — место свободно', client: 'c-1001', booking: 'b-anna', who: 'Анна' },
    { id: 'e3', at: '18:06', type: 'ClassCancelled', txt: 'Тренер заболел — занятие отменено', client: null, booking: null, who: 'клуб' }
  ];
  function storyParts(a) {
    const n = +a.parts;
    return STORY.map((e, i) => {
      if (n === 1) return 0;
      if (a.key === 'session') return partOf('S-19', n);
      if (a.key === 'client' && e.client) return partOf(e.client, n);
      if (a.key === 'booking' && e.booking) return partOf(e.booking, n);
      return (i * 5 + 1) % n; // без ключа — по кругу
    });
  }
  const orderSafe = a => a.parts === '1' || a.key === 'session';
  function storyRun(a, run) {
    const ps = storyParts(a), r = TR.rand('mqk-st' + run + a.key + a.parts), lag = {};
    const t = STORY.map((e, i) => { const p = ps[i]; if (lag[p] == null) lag[p] = r() * 30; return { e, p, at: i * 10 + lag[p] }; });
    const byP = {}; t.forEach(x => (byP[x.p] = byP[x.p] || []).push(x));
    Object.values(byP).forEach(l => { for (let i = 1; i < l.length; i++) l[i].at = Math.max(l[i].at, l[i - 1].at + 0.1); });
    const order = t.slice().sort((x, y) => x.at - y.at).map(x => x.e.id);
    // «Лист ожидания»: cancelled → список закрыт; e1 добавляет Иру; e2 освобождает место и переводит первого из листа
    let cancelled = false, list = [], promotedAfterCancel = false, iraState = 'не в списке';
    order.forEach(id => {
      if (id === 'e1') { list.push('Ира'); iraState = cancelled ? 'в листе ожидания отменённого занятия' : 'в листе ожидания'; }
      if (id === 'e2') { if (list.length) { list.shift(); iraState = 'переведена в записанные'; if (cancelled) promotedAfterCancel = true; } }
      if (id === 'e3') { cancelled = true; if (iraState === 'переведена в записанные' || iraState === 'в листе ожидания') iraState = 'получила «занятие отменено»'; list = []; }
    });
    const bad = promotedAfterCancel || iraState === 'в листе ожидания отменённого занятия' || iraState === 'переведена в записанные';
    return { ps, order, bad, iraState: promotedAfterCancel ? 'получила пуш «Вы записаны» на отменённое занятие' : iraState };
  }
  function topicEval(a) {
    const n = +a.parts, inst = +a.inst;
    const active = a.group === 'svc' ? Math.min(n, inst) : a.group === 'inst' ? 1 : Math.min(n, inst * 6);
    const cap = a.group === 'inst' ? PER : a.group === 'one' ? Math.min(n, inst * 6) * PER / 6 : active * PER;
    const idle = a.group === 'svc' ? Math.max(0, inst - n) : 0;
    const backlog = Math.max(0, (RATE - cap) * 300);
    return { n, inst, active, cap, idle, backlog, order: orderSafe(a), capOk: cap >= RATE };
  }
  const topicTask = {
    id: 'topic-design', title: 'Топик записей: ключ, партиции, группы',
    simple: howKafka.simple,
    lead: ui.brief({
      situation: `Проектируем <code>puls.booking.events.v1</code>. Пример из жизни: сайкл в понедельник в 19:00, 20 мест, всё занято. В 17:50 Ира встала в лист ожидания. В 18:05 Анна отменила запись. В 18:06 тренер заболел и клуб отменил занятие. Потребитель «Лист ожидания» должен увидеть эти три события <b>в том же порядке</b> — иначе переведёт Иру на отменённое занятие. Лена: «Такое у нас уже было на тесте». Нагрузка: в пик ~${RATE} событий в секунду; один экземпляр сервиса обрабатывает ~${PER} событий в секунду. Читают шесть сервисов.`,
      todo: [
        'Выберите ключ партиции — по какому полю событие попадает в партицию.',
        'Нажимайте «Прогнать ещё раз» несколько раз: партиции читаются с разной скоростью. Смотрите, в каком порядке «Лист ожидания» обработал три события и что стало с Ирой.',
        'Выберите число партиций, число экземпляров сервиса «Лист ожидания» и как устроены группы потребителей. Смотрите на «Пропускную способность» и «Простаивают».',
        'Цель: порядок занятия держится при любом прогоне, пик проходит без отставания, лишних экземпляров нет. Нажмите «Проверить».'
      ],
      look: `<p>Три дорожки — партиции, куда легли события при вашем ключе. Чипы ниже — порядок, в котором «Лист ожидания» их обработал. Красный чип — событие обработано раньше того, что случилось до него.</p><p>Пропускная способность группы = число работающих экземпляров × ${PER}/с. Работает не больше экземпляров, чем партиций. Не хватает — события копятся: за 5 минут пика отставание растёт, и пуш «Вы записаны» приходит через минуты.</p>`
    }),
    blank: () => ({ key: 'client', parts: '3', inst: '4', group: 'one', run: 1 }),
    reference: () => ({ key: 'session', parts: '12', inst: '12', group: 'svc', run: 1 }),
    render(el, ctx) {
      el.classList.add('mqk-root');
      const a = ctx.ans; a.run = a.run || 1;
      el.innerHTML = `<div class="stack">
        <div class="mqk-box"><div class="eyebrow">Топик <code>puls.booking.events.v1</code></div>
          <div class="mqk-set">
            <div class="lbl">Ключ партиции</div>${ui.seg('key', KEYS, a.key, 'accent')}
            <div class="lbl">Партиций</div>${ui.seg('parts', PARTS, a.parts, 'accent')}
            <div class="lbl">Экземпляров «Листа ожидания»</div>${ui.seg('inst', INST, a.inst, 'accent')}
            <div class="lbl">Группы потребителей</div>${ui.seg('group', GRP, a.group, 'accent')}
          </div></div>
        <div class="row between"><div class="eyebrow">Три события одного занятия</div><button type="button" class="btn sm" data-rerun>Прогнать ещё раз</button></div>
        <div data-lanes></div>
        <div data-ord></div>
        <div class="mqk-stats" data-st></div>
        <div data-gn></div>
      </div>`;
      lock(TR.$('.mqk-box', el), ctx.readonly);
      function draw() {
        const r = storyRun(a, a.run), ev = topicEval(a);
        const parts = [...new Set(r.ps)];
        TR.$('[data-lanes]', el).innerHTML = `<div class="stack tight">${parts.map(p => `<div class="mqk-lane"><span class="mono small">P${p}</span><div class="mqk-chips">${STORY.filter((e, i) => r.ps[i] === p).map(e => `<span class="mqk-chip"><span class="n">${e.at}</span>${esc(e.type)}</span>`).join('')}</div></div>`).join('')}</div>`;
        const pos = {}; r.order.forEach((id, i) => { pos[id] = i; });
        TR.$('[data-ord]', el).innerHTML = `<div class="stack tight"><div class="small dim">Порядок обработки в «Листе ожидания»:</div>
          <div class="mqk-chips">${r.order.map((id, i) => { const e = STORY.find(x => x.id === id), early = STORY.some(x => STORY.indexOf(x) < STORY.indexOf(e) && pos[x.id] > i); return `<span class="mqk-chip ${early ? 'bad' : 'ok'}"><span class="n">${i + 1}</span>${e.at} ${esc(e.txt)}</span>`; }).join('')}</div>
          ${r.bad ? ui.note('bad', 'Ира: ' + r.iraState, `События одного занятия легли в ${parts.length} ${TR.plural(parts.length, 'партицию', 'партиции', 'партиций')} и обработаны не в том порядке. ${a.key === 'client' || a.key === 'booking' ? 'У события «занятие отменено» вообще нет ни клиента, ни брони — с таким ключом оно ложится куда придётся.' : ''} Это инцидент №2 сезона.`) : ui.note(orderSafe(a) ? 'ok' : 'warn', 'Ира: ' + r.iraState, orderSafe(a) ? (a.parts === '1' ? 'Одна партиция — один общий порядок. Но и вся нагрузка на одного читателя.' : 'Все события занятия — в одной партиции, порядок как в жизни при любом прогоне.') : 'В этот раз повезло. Нажмите «Прогнать ещё раз».')}</div>`;
        TR.$('[data-st]', el).innerHTML = `
          <div class="stat"><span class="k">Порядок занятия</span><span class="v ${ev.order ? 'ok' : 'bad'}">${ev.order ? 'держится всегда' : 'случайный'}</span><span class="s">ключ ${esc(tOf(KEYS, a.key))}</span></div>
          <div class="stat"><span class="k">Пропускная способность</span><span class="v ${ev.capOk ? 'ok' : 'bad'}">${Math.round(ev.cap)}/с</span><span class="s">нужно ${RATE}/с в пик</span></div>
          <div class="stat"><span class="k">Отставание к 20:05</span><span class="v ${ev.backlog ? 'bad' : 'ok'}">${ev.backlog ? Math.round(ev.backlog).toLocaleString('ru-RU') : '0'}</span><span class="s">${ev.backlog ? `пуши опоздают на ~${Math.max(1, Math.round(ev.backlog / Math.max(ev.cap, 1) / 60))} мин` : 'успевает за пиком'}</span></div>
          <div class="stat"><span class="k">Простаивают</span><span class="v ${ev.idle ? 'warn' : 'ok'}">${ev.idle}</span><span class="s">${ev.idle ? 'партиций меньше, чем экземпляров' : 'все при деле'}</span></div>`;
        TR.$('[data-gn]', el).innerHTML = a.group === 'one' ? ui.note('bad', 'Одна группа на шестерых', 'В группе каждое событие получает только один участник. Шесть сервисов в одной группе делят партиции между собой: бонусы видят примерно 1/6 событий, уведомления — другую 1/6. Каждый сервис — своя группа.')
          : a.group === 'inst' ? ui.note('bad', 'Группа на каждый экземпляр', `Каждая группа получает <b>все</b> события. ${a.inst} ${TR.plural(+a.inst, 'экземпляр', 'экземпляра', 'экземпляров')} «Листа ожидания» в разных группах обработают каждое событие ${a.inst} раз: Ира получит ${a.inst} ${TR.plural(+a.inst, 'пуш', 'пуша', 'пушей')}. И работа не делится: каждый тащит все ${RATE}/с в одиночку.`)
          : ui.note(ev.capOk && !ev.idle ? 'ok' : '', 'Своя группа у каждого сервиса', `Шесть групп читают топик независимо — каждая получает все события. Внутри группы «Лист ожидания» партиции поделены между экземплярами: работает ${ev.active} из ${a.inst}. ${a.parts === '48' ? 'Партиций с запасом ×4: работает, но каждая партиция — это файлы, соединения и время ребаланса. Без нужды столько не берут.' : ''}`);
      }
      draw();
      ui.onSeg(el, (name, v) => {
        if (!['key', 'parts', 'inst', 'group'].includes(name) || ctx.readonly) return;
        a[name] = v; ctx.save();
        ctx.decide('Топик записей', `ключ ${tOf(KEYS, a.key)}; партиций ${a.parts}; экземпляров ${a.inst}; группы — ${tOf(GRP, a.group)}`);
        draw();
      });
      TR.on(el, 'click', '[data-rerun]', () => { a.run = (a.run || 1) + 1; if (!ctx.readonly) ctx.save(); draw(); });
    },
    check(ans) {
      const ev = topicEval(ans), notes = []; let pts = 0;
      if (ans.key === 'session') { pts += 35; notes.push({ ok: true, html: 'Ключ <code>class_session_id</code>: все события занятия — в одной партиции, по порядку.' }); }
      else if (ans.key === 'client') notes.push({ ok: false, html: 'С ключом <code>client_id</code> события Иры и Анны о <b>одном</b> занятии лежат в разных партициях. А у «занятие отменено» клиента нет вовсе. Чей порядок важен «Листу ожидания» — клиента или занятия?' });
      else if (ans.key === 'booking') notes.push({ ok: false, html: 'Каждая бронь — свой ключ: события разных людей об одном занятии разъезжаются по партициям. Порядок нужен в пределах чего?' });
      else notes.push({ ok: false, html: 'Без ключа сообщения раскладываются по кругу — порядок держится только случайно. Прогоните несколько раз.' });
      if (ans.group === 'svc') { pts += 25; notes.push({ ok: true, html: 'Своя группа у каждого сервиса — каждый получает все события, внутри сервиса работа делится.' }); }
      else if (ans.group === 'one') notes.push({ ok: false, html: 'В одной группе каждое событие достаётся только одному участнику. Сколько событий тогда увидят бонусы?' });
      else notes.push({ ok: false, html: 'Группа на экземпляр — каждый экземпляр получает все события: дубли пушей и никакого деления работы.' });
      if (ev.capOk) { pts += 25; notes.push({ ok: true, html: `Пропускная способность ${Math.round(ev.cap)}/с — пик ${RATE}/с проходит.` }); }
      else notes.push({ ok: false, html: `Пропускная способность ${Math.round(ev.cap)}/с при нужных ${RATE}/с — к концу пика отставание ${Math.round(ev.backlog).toLocaleString('ru-RU')} событий. Сколько экземпляров по ${PER}/с нужно — и хватит ли им партиций?` });
      if (!ev.idle) pts += 10; else notes.push({ ok: 'warn', html: `${ev.idle} ${TR.plural(ev.idle, 'экземпляр простаивает', 'экземпляра простаивают', 'экземпляров простаивают')}: в группе одну партицию читает один экземпляр.` });
      if (ans.parts !== '48') pts += 5; else notes.push({ ok: 'warn', html: '48 партиций — с запасом ×4. Работать будет, но лишние партиции стоят ресурсов и удлиняют ребаланс. Канон «Пульса» — 12.' });
      const score = pts / 100;
      return { ok: ans.key === 'session' && ans.group === 'svc' && ev.capOk && score >= 0.85, score, notes, summary: `Ключ — ${esc(tOf(KEYS, ans.key))}, партиций ${ans.parts}, экземпляров ${ans.inst}, группы — ${esc(tOf(GRP, ans.group))}.`, vera: ans.key !== 'session' ? 'Подсказка Лены: «Мне важен порядок событий одного занятия». По какому полю их собрать в одну партицию?' : null };
    },
    explain: `<p>Канон «Пульса»: <code>puls.booking.events.v1</code>, ключ <b><code>class_session_id</code></b>, <b>12 партиций</b>, хранение 7 дней, у каждого из шести сервисов своя группа (<code>notifications</code>, <code>bonus</code>, <code>recommendations</code>, <code>analytics</code>, <code>partner-gateway</code>, <code>waitlist</code>).</p>
      <ul class="checks">
        <li><b>Ключ выбирают по тому, чей порядок важен потребителю.</b> «Листу ожидания» важен порядок внутри занятия, поэтому ключ — занятие. Для абонементов и платежей важен порядок по клиенту — там ключ <code>client_id</code>.</li>
        <li><b>Число партиций</b> = потолок параллельности группы. Нужно ${RATE}/с при ${PER}/с на экземпляр → минимум 8; 12 — с запасом на рост. Менять число партиций потом больно: ключи «переезжают» в другие партиции, и порядок на время ломается.</li>
        <li><b>Группа = сервис.</b> Разные группы читают всё независимо; внутри группы партиции делятся между экземплярами.</li>
        <li>Риск ключа по занятию — «горячая» партиция: на одно занятие много событий. У «Пульса» на занятие максимум 40 мест — не страшно.</li>
      </ul>
      <p>Инцидент №2 сезона — ровно эта ошибка: ключ <code>client_id</code> вместо <code>class_session_id</code>, и «Лист ожидания» записал человека на отменённое занятие.</p>`,
    report: ans => { const ev = topicEval(ans); return `Ключ: ${tOf(KEYS, ans.key)}; партиций: ${ans.parts}; экземпляров: ${ans.inst}; группы: ${tOf(GRP, ans.group)}.\nПорядок занятия: ${ev.order ? 'держится' : 'случайный'}; пропускная способность ${Math.round(ev.cap)}/с; простаивают ${ev.idle}.`; }
  };

  // =====================================================================
  // Практика 3. RabbitMQ для уведомлений
  // =====================================================================
  const XT = [{ v: 'direct', t: 'direct' }, { v: 'topic', t: 'topic' }, { v: 'fanout', t: 'fanout' }];
  const BSMS = [{ v: 'sms.*', t: 'sms.*' }, { v: 'sms.login-code', t: 'sms.login-code' }, { v: '#', t: '#' }];
  const BPUSH = [{ v: 'push.*', t: 'push.*' }, { v: 'push.booking', t: 'push.booking' }, { v: '#', t: '#' }];
  const PRI = [{ v: 'h', t: 'высокий (9)' }, { v: 'm', t: 'обычный (5)' }, { v: 'l', t: 'низкий (1)' }];
  const ACK = [{ v: 'auto', t: 'автоматически при выдаче' }, { v: 'manual', t: 'после отправки (ручной ack)' }];
  const FAIL = [{ v: 'drop', t: 'выбросить' }, { v: 'requeue', t: 'сразу вернуть в очередь' }, { v: 'dlq', t: 'повтор через 1 мин, 3 попытки, потом DLQ' }];
  const NMSG = [
    { k: 'sms.promo', t: 'Рекламные SMS «−20 % на персональные»', n: 900, want: 'sms', pk: 'promo' },
    { k: 'sms.login-code', t: 'SMS с кодом входа', n: 4, want: 'sms', pk: 'code' },
    { k: 'push.booking', t: 'Пуш «Вы записаны»', n: 3, want: 'push', pk: 'booking' }
  ];
  const PV = { h: 9, m: 5, l: 1 };
  function rabbitSim(a) {
    const binds = { sms: a.bs, push: a.bp };
    const routes = NMSG.map(m => ({ m, qs: ['sms', 'push'].filter(q => routeTo(a.xt, binds[q], m.k)) }));
    const rOf = k => routes.find(r => r.m.k === k).qs;
    const misroute = routes.filter(r => !(r.qs.length === 1 && r.qs[0] === r.m.want));
    const codeInSms = rOf('sms.login-code').includes('sms'), promoInSms = rOf('sms.promo').includes('sms');
    const prioOk = PV[a.p.code] > PV[a.p.promo];
    const codeWait = !codeInSms ? null : (promoInSms && !prioOk) ? Math.round(900 / 30) : 0.1;
    const lost = [], notes = [];
    if (a.ack === 'auto') lost.push('1 SMS с кодом: отправщик упал, взяв сообщение, — оно уже удалено');
    if (a.fail === 'drop') { lost.push('1 SMS с кодом: шлюз один раз ответил таймаутом — сообщение выброшено'); lost.push('пуш Петру с устаревшим токеном выброшен молча — никто не узнает, что у него не работают пуши'); }
    const poison = a.fail === 'requeue' ? 'крутится: ~1 200 попыток в минуту, отправщик пушей занят им' : a.fail === 'dlq' ? 'после 3 попыток — в DLQ, дежурному сигнал' : 'выброшено без следа';
    return { routes, misroute, codeInSms, codeWait, prioOk, lost, poison, green: !misroute.length && codeWait != null && codeWait < 1 && !lost.length && a.fail === 'dlq' };
  }
  const rabbitTask = {
    id: 'rabbit-lab', title: 'RabbitMQ для уведомлений',
    simple: howRabbit.simple,
    lead: ui.brief({
      situation: 'Сервис «Уведомления» кладёт задачи в обменник <code>puls.notify</code> с ключами <code>sms.login-code</code>, <code>sms.promo</code>, <code>push.booking</code>. Очереди две: <code>notify.sms</code> (отправщик SMS, шлюз держит 30 в секунду) и <code>notify.push</code> (отправщик пушей). Воскресенье, 19:59: маркетинг поставил 900 рекламных SMS. В 20:00 четверо клиентов просят код входа, трое записываются. По дороге случится три неприятности: отправщик SMS упадёт, держа сообщение; шлюз один раз ответит таймаутом; у Петра в пуше устаревший токен телефона — такой пуш не отправится никогда.',
      todo: [
        'Выберите тип обменника и привязки двух очередей.',
        'Расставьте приоритеты трём видам сообщений.',
        'Выберите, когда отправщик подтверждает сообщение (ack) и что делать при ошибке отправки.',
        'Нажмите «Прогнать сообщения» и прочитайте таблицу исходов. Добейтесь, чтобы всё дошло куда надо, код входа — меньше чем за секунду, без потерь, а пуш Петра оказался в DLQ. Нажмите «Проверить».'
      ],
      look: 'В карточках очередей — сколько сообщений какого вида туда попало. Таблица — что стало с каждым видом. «Код входа дошёл за» — сколько ждал клиент: шлюз отправляет 30 SMS в секунду, и если код стоит за 900 рекламными, ждать полминуты.'
    }),
    blank: () => ({ xt: 'fanout', bs: '#', bp: '#', p: { code: 'm', booking: 'm', promo: 'm' }, ack: 'auto', fail: 'requeue', ran: false }),
    reference: () => ({ xt: 'topic', bs: 'sms.*', bp: 'push.*', p: { code: 'h', booking: 'm', promo: 'l' }, ack: 'manual', fail: 'dlq', ran: true }),
    render(el, ctx) {
      el.classList.add('mqk-root');
      const a = ctx.ans; a.p = a.p || { code: 'm', booking: 'm', promo: 'm' };
      el.innerHTML = `<div class="stack">
        <div class="mqk-box"><div class="eyebrow">Обменник <code>puls.notify</code> и очереди</div>
          <div class="mqk-set">
            <div class="lbl">Тип обменника</div>${ui.seg('xt', XT, a.xt, 'accent')}
            <div class="lbl">Привязка <code>notify.sms</code></div>${ui.seg('bs', BSMS, a.bs, 'accent')}
            <div class="lbl">Привязка <code>notify.push</code></div>${ui.seg('bp', BPUSH, a.bp, 'accent')}
          </div>
          <div class="eyebrow">Приоритеты</div>
          <div class="mqk-set">
            <div class="lbl">Код входа <code>sms.login-code</code></div>${ui.seg('p.code', PRI, a.p.code, 'accent')}
            <div class="lbl">«Вы записаны» <code>push.booking</code></div>${ui.seg('p.booking', PRI, a.p.booking, 'accent')}
            <div class="lbl">Реклама <code>sms.promo</code></div>${ui.seg('p.promo', PRI, a.p.promo, 'accent')}
          </div>
          <div class="eyebrow">Надёжность</div>
          <div class="mqk-set">
            <div class="lbl">Подтверждение (ack)</div>${ui.seg('ack', ACK, a.ack, 'accent')}
            <div class="lbl">Ошибка отправки</div>${ui.seg('fail', FAIL, a.fail, 'accent')}
          </div>
          <div class="row"><button type="button" class="btn primary sm" data-run ${ctx.readonly ? 'disabled' : ''}>Прогнать сообщения</button></div>
        </div>
        <div data-out></div>
      </div>`;
      lock(TR.$('.mqk-box', el), ctx.readonly);
      function draw() {
        const out = TR.$('[data-out]', el);
        if (!a.ran) { out.innerHTML = ui.note('', 'Ещё не прогоняли', 'Настройте и нажмите «Прогнать сообщения».'); return; }
        const s = rabbitSim(a);
        const qCnt = q => NMSG.filter(m => s.routes.find(r => r.m.k === m.k).qs.includes(q)).map(m => `${m.n} × <code>${m.k}</code>`).join('<br>') || '<span class="dim">пусто</span>';
        const unrouted = s.routes.filter(r => !r.qs.length);
        out.innerHTML = `<div class="stack">
          <div class="grid2"><div class="mqk-q"><b><code>notify.sms</code></b><span class="small">${qCnt('sms')}</span></div><div class="mqk-q"><b><code>notify.push</code></b><span class="small">${qCnt('push')}</span></div></div>
          ${unrouted.length ? ui.note('bad', 'Никуда не попало', unrouted.map(r => `<code>${r.m.k}</code> (${r.m.n})`).join(', ') + ' — ни одна привязка не совпала, RabbitMQ выбросил сообщения.') : ''}
          ${ui.table(['Сообщения', 'Куда попали', 'Что стало'], NMSG.map(m => {
            const r = s.routes.find(x => x.m.k === m.k), ok = r.qs.length === 1 && r.qs[0] === m.want;
            let res = !r.qs.length ? '<span style="color:var(--bad)">потеряны — не нашли очередь</span>' : !ok ? `<span style="color:var(--bad)">${r.qs.includes('push') && m.want === 'sms' ? 'SMS ушли ещё и как пуши' : m.want === 'push' && r.qs.includes('sms') ? 'пуши ушли ещё и как SMS — по 3 ₽ за штуку' : 'не в ту очередь'}</span>` : '';
            if (ok && m.pk === 'code') res = (s.codeWait < 1 ? '<span style="color:var(--ok)">дошли за ~0,1 с</span>' : `<span style="color:var(--bad)">ждали ~${s.codeWait} с за рекламой</span>`) + (a.ack === 'manual' ? '; один — повторно, после падения отправщика' : '') + (a.fail === 'dlq' ? '; один — через минуту, после таймаута шлюза' : a.fail === 'requeue' ? '; один — сразу со второй попытки' : '');
            if (ok && m.pk === 'promo') res = 'ушли за ~30 с по лимиту шлюза';
            if (ok && m.pk === 'booking') res = `2 дошли; пуш Петру — ${s.poison}`;
            return [`${m.n} × ${esc(m.t)}`, r.qs.length ? r.qs.map(q => '<code style="white-space:nowrap;overflow-wrap:normal">notify.' + q + '</code>').join(', ') : '—', res];
          }))}
          <div class="mqk-stats">
            <div class="stat"><span class="k">Маршрутизация</span><span class="v ${s.misroute.length ? 'bad' : 'ok'}">${s.misroute.length ? 'ошибки' : 'всё по адресу'}</span><span class="s">${s.misroute.length ? s.misroute.length + ' ' + TR.plural(s.misroute.length, 'вид', 'вида', 'видов') + ' не туда' : 'SMS — в SMS, пуши — в пуши'}</span></div>
            <div class="stat"><span class="k">Код входа дошёл за</span><span class="v ${s.codeWait != null && s.codeWait < 1 ? 'ok' : 'bad'}">${s.codeWait == null ? 'не дошёл' : s.codeWait < 1 ? '0,1 с' : s.codeWait + ' с'}</span><span class="s">${s.prioOk ? 'код обгоняет рекламу' : 'код в общей очереди'}</span></div>
            <div class="stat"><span class="k">Потеряно</span><span class="v ${s.lost.length ? 'bad' : 'ok'}">${s.lost.length}</span><span class="s">${s.lost.length ? 'см. ниже' : 'ничего'}</span></div>
            <div class="stat"><span class="k">Пуш с плохим токеном</span><span class="v ${a.fail === 'dlq' ? 'ok' : 'bad'}" style="font-size:14px">${a.fail === 'dlq' ? 'в DLQ' : a.fail === 'requeue' ? 'крутится' : 'исчез'}</span><span class="s">ядовитое сообщение</span></div>
          </div>
          ${s.lost.length ? ui.note('bad', 'Потери', '<ul class="checks">' + s.lost.map(x => `<li class="bad">${esc(x)}</li>`).join('') + '</ul>') : ''}
          ${s.green ? ui.note('ok', 'Всё прошло', 'Коды входа — первыми, реклама — следом по лимиту, падение отправщика и сбой шлюза ничего не потеряли, а пуш с плохим токеном ждёт разбора в DLQ.') : ''}
        </div>`;
      }
      draw();
      ui.onSeg(el, (name, v) => {
        if (ctx.readonly) return;
        if (name.indexOf('p.') === 0) a.p[name.slice(2)] = v; else if (['xt', 'bs', 'bp', 'ack', 'fail'].includes(name)) a[name] = v; else return;
        ctx.save(); draw();
      });
      TR.on(el, 'click', '[data-run]', () => {
        if (ctx.readonly) return;
        a.ran = true; ctx.save();
        ctx.decide('Очередь уведомлений', `${a.xt}; sms ← ${a.bs}, push ← ${a.bp}; приоритеты код/запись/реклама: ${a.p.code}/${a.p.booking}/${a.p.promo}; ack: ${tOf(ACK, a.ack)}; ошибка: ${tOf(FAIL, a.fail)}`);
        draw();
      });
    },
    check(ans) {
      const a = Object.assign({ p: {} }, ans), s = rabbitSim(a), notes = []; let pts = 0;
      if (!s.misroute.length) { pts += 30; notes.push({ ok: true, html: 'Маршрутизация: SMS — в <code>notify.sms</code>, пуши — в <code>notify.push</code>, ничего не потеряно и не задвоено.' }); }
      else {
        if (a.xt === 'fanout') notes.push({ ok: false, html: 'Fanout кладёт копию в каждую очередь: пуши уйдут ещё и SMS-ками. Какой тип раскладывает по шаблону ключа?' });
        else if (a.xt === 'direct') notes.push({ ok: false, html: 'Direct сравнивает ключ с привязкой буква в букву: звёздочка для него — просто символ. Что-то из сообщений не нашло очередь.' });
        else notes.push({ ok: false, html: 'Тип верный, но привязки не те: проверьте, куда попадают рекламные SMS и не получает ли очередь чужие сообщения (<code>#</code> — это «всё»).' });
        if (a.xt === 'topic') pts += 10;
      }
      const pOk = PV[a.p.code] === 9 && PV[a.p.promo] === 1;
      if (pOk) { pts += 20; notes.push({ ok: PV[a.p.booking] === 1 ? 'warn' : true, html: PV[a.p.booking] === 1 ? 'Приоритеты: код — высокий, реклама — низкая. Но «Вы записаны» наравне с рекламой: в пик клиент узнает о записи через минуты.' : 'Приоритеты: код входа обгоняет всё, реклама — в конце.' }); if (PV[a.p.booking] === 1) pts -= 5; }
      else notes.push({ ok: false, html: 'Приоритеты: клиент ждёт код входа у экрана, а реклама подождёт. Что должно стоять первым в очереди SMS, если в ней уже 900 рекламных?' });
      if (a.ack === 'manual') { pts += 20; notes.push({ ok: true, html: 'Ack после отправки: упавший отправщик не теряет сообщение.' }); }
      else notes.push({ ok: false, html: 'Автоподтверждение удаляет сообщение в момент выдачи. Что станет с ним, если отправщик упадёт, не успев отправить?' });
      if (a.fail === 'dlq') { pts += 30; notes.push({ ok: true, html: 'Повтор с паузой и DLQ: временный сбой шлюза переживаем, ядовитое сообщение не крутится вечно.' }); }
      else if (a.fail === 'requeue') notes.push({ ok: false, html: 'Сразу вернуть в очередь — для пуша с плохим токеном это вечный круг: тысячи попыток в минуту. Где остановиться и куда его деть?' });
      else notes.push({ ok: false, html: 'Выбросить — значит потерять и код входа после единичного таймаута шлюза, и сигнал о плохом токене Петра.' });
      if (!ans.ran) notes.push({ ok: 'warn', html: 'Вы ни разу не нажали «Прогнать сообщения» — посмотрите исходы.' });
      const score = Math.max(0, pts) / 100;
      return { ok: !s.misroute.length && pOk && a.ack === 'manual' && a.fail === 'dlq', score, notes, summary: s.codeWait != null ? `Код входа дойдёт за ${s.codeWait < 1 ? '0,1 с' : s.codeWait + ' с'}; потерь: ${s.lost.length}.` : 'Код входа не дойдёт: не нашёл очередь.' };
    },
    explain: `<p>Эталон: обменник <b><code>topic</code></b>, <code>notify.sms</code> ← <code>sms.*</code>, <code>notify.push</code> ← <code>push.*</code>. Очередь SMS с приоритетами (<code>x-max-priority=10</code>): код входа 9, «вы записаны» 5, реклама 1. <b>Ручной ack</b> после ответа шлюза. Ошибка — <b>повтор через 1 минуту</b> (очередь ожидания с TTL), не больше 3 попыток, потом <b>DLQ <code>notify.dlq</code></b> и сигнал дежурному.</p>
      <ul class="checks">
        <li><code>direct</code> тоже можно, если привязать к <code>notify.sms</code> два точных ключа. Но новый вид SMS (например, <code>sms.bonus</code>) придётся не забыть привязать — шаблон <code>sms.*</code> это делает сам.</li>
        <li>Ручной ack значит «хотя бы один раз»: если отправщик упал после отправки, но до ack, клиент получит SMS дважды. Для кода входа это терпимо, для списаний — нет. Про это — завтра.</li>
        <li>У кода входа есть срок жизни: в задаче стоит указать TTL сообщения (например, 5 минут), чтобы не слать протухший код. Это требование аналитика.</li>
      </ul>`,
    report: ans => `Обменник ${ans.xt}; sms ← ${ans.bs}; push ← ${ans.bp}; приоритеты код/запись/реклама: ${(ans.p || {}).code}/${(ans.p || {}).booking}/${(ans.p || {}).promo}; ack — ${tOf(ACK, ans.ack)}; ошибка — ${tOf(FAIL, ans.fail)}; прогон: ${ans.ran ? 'да' : 'нет'}.`
  };

  // =====================================================================
  // Практика 4. Почему не только Kafka и не только RabbitMQ
  // =====================================================================
  const BOTH_RUBRIC = [
    'Kafka — для фактов: много независимых групп, перечитать за 7 дней, порядок по ключу, сжатый топик для пропусков',
    'RabbitMQ — для поручений: ack каждого сообщения, отложенный повтор одного сообщения, приоритеты, DLQ, маршрутизация по ключу',
    'Только Kafka: нет приоритетов (код входа ждёт за рекламой), повтор одного сообщения не задерживая партицию — только обходными путями',
    'Только RabbitMQ: прочитанное удаляется — не перечитать неделю и не подключить нового потребителя с историей; на шесть сервисов — шесть копий; порядок по ключу при нескольких исполнителях не гарантирован',
    'Цена двух систем честно: эксплуатация и знания; смягчает управляемый сервис и ясная граница «факты — Kafka, поручения — RabbitMQ»'
  ];
  const BOTH_REF = 'Kafka и RabbitMQ решают разные задачи. Kafka — журнал фактов: событие «клиент записался» читают шесть сервисов, каждый своей группой; аналитика может перечитать неделю; события одного занятия идут по порядку благодаря ключу; сжатый топик даёт контроллеру клуба актуальный список пропусков. RabbitMQ — очередь поручений: «отправь SMS» нужно выполнить один раз, подтвердить, при сбое повторить через минуту, ядовитое сообщение отправить в DLQ, а код входа пропустить вперёд рекламы. Если всё на Kafka — нет приоритетов, и код входа будет ждать за 900 рекламными SMS; повторить одно сообщение, не задерживая всю партицию, можно только ретрай-топиками. Если всё на RabbitMQ — сообщение удаляется после подтверждения: не перечитать за неделю, новый сервис не получит историю, на шесть потребителей нужны шесть очередей-копий, а порядок при нескольких исполнителях не гарантирован. Цена — две системы в эксплуатации; смягчаем управляемым Kafka в Yandex Cloud и правилом: факты — в Kafka, поручения — в RabbitMQ.';
  const bothTask = {
    id: 'why-both', title: 'Почему два брокера',
    simple: {
      icon: '⚖️',
      plain: 'Журнал хорош, чтобы многие узнали о факте и могли перечитать. Почта с очередями хороша, чтобы каждое поручение выполнили один раз, вовремя и в нужном порядке срочности.',
      analogy: 'В клубе есть и журнал смены, и стопка заказов на кухне. Можно вести заказы в журнале смены — но повар не поймёт, какой заказ срочный и какой уже готов. Можно писать новости заказами на кухню — но тогда каждому сотруднику нужна своя копия, и вчерашние новости уже выброшены.',
      tech: 'Kafka: журнал, группы, хранение, перечитывание, порядок в партиции, compaction; нет приоритетов и поштучного отложенного повтора. RabbitMQ: exchange/queue/binding, ack, TTL + DLX, приоритеты; сообщение удаляется после ack, нет перечитывания.'
    },
    lead: ui.brief({
      situation: 'Тимур (CTO) на обсуждении ADR: «Две системы — двойная поддержка и двойное обучение. Kafka же мощнее, давайте всё на ней». Сергей (SRE): «А я бы всё на RabbitMQ — его мы хотя бы знаем». Антон смотрит на вас: аргументы за решение должен дать аналитик.',
      todo: [
        'Напишите от 200 символов: чем плох вариант «только Kafka» и чем — «только RabbitMQ», на примерах «Пульса».',
        'Назовите честно цену двух систем и как её снизить.',
        'Нажмите «Проверить с Верой (Claude)» или «Сверить с эталоном самому». Засчитывается от 60 %.'
      ],
      lookTitle: 'На что опереться',
      look: 'Примеры из сегодняшних заданий: событие записи для шести сервисов, перечитывание аналитикой, порядок занятия, список пропусков; 900 рекламных SMS и код входа, пуш с плохим токеном, упавший отправщик.'
    }),
    blank: () => ({ j: {} }),
    reference: () => ({ j: { text: BOTH_REF, self: BOTH_RUBRIC.map(() => true) } }),
    render(el, ctx) {
      el.classList.add('mqk-root');
      el.insertAdjacentHTML('beforeend', ui.say('timur', 'Две системы — двойная поддержка. Давайте всё на Kafka, она же мощнее.') + ui.say('sergey', 'А я бы всё на RabbitMQ — его мы хотя бы знаем.'));
      const j = document.createElement('div'); j.style.marginTop = '12px'; el.appendChild(j);
      ui.justify(j, {
        id: 'mqk-both', q: 'Почему «Пульсу» нужны и Kafka, и RabbitMQ?', qPlain: 'Почему «Пульсу» нужны и Kafka, и RabbitMQ, а не что-то одно? Чем плох вариант «только Kafka» и «только RabbitMQ», какова цена двух систем.',
        rubric: BOTH_RUBRIC, reference: BOTH_REF, value: ctx.ans.j, readonly: ctx.readonly, minLen: 200,
        onChange: v => { ctx.ans.j = v; ctx.save(); ctx.decide('Почему два брокера', v.text || ''); }
      });
    },
    check(ans) {
      const s = ui.justifyScore(ans && ans.j);
      return { ok: s >= 0.6, score: s, summary: s ? `Оценка обоснования: ${Math.round(s * 100)} %.` : 'Напишите ответ (от 200 символов) и проверьте его с Верой или сверьте с эталоном сами.', notes: s && s < 0.6 ? [{ ok: false, html: 'Пройдитесь по двум провалам: что сломается у уведомлений на одной Kafka и что — у событий записи на одном RabbitMQ. И не забудьте цену.' }] : [] };
    },
    explain: '<p>Это типичный спор в ADR. Сильный аргумент — не «Kafka лучше» или «RabbitMQ проще», а <b>требования конкретных задач</b>: у событий — много читателей, история и порядок; у уведомлений — приоритеты, поштучный повтор и DLQ. Для каждого варианта «одна система на всё» есть сценарий, где он ломается или требует костылей.</p><p>Цена тоже реальна: две системы — два набора метрик, алертов и навыков. Поэтому граница должна быть простой и записанной в ADR: «факты — Kafka, поручения на отправку — RabbitMQ». Появится третья задача — сначала проверяем, не подходит ли одна из двух.</p>',
    report: ans => (ans.j && ans.j.text) ? ans.j.text : '—'
  };

  // =====================================================================
  TR.stage({
    id: ID, act: 5, order: 220, slot: 'Вт 10:00', title: 'Kafka и RabbitMQ',
    when: 'вторник, 10:00 · переговорная «Кардио» · Антон, Лена, Сергей',
    intro: [
      { who: 'anton', html: 'Брокер берём — вопрос, какой. Предлагаю Kafka для доменных событий и RabbitMQ для уведомлений. Да, два. Сегодня покажу почему, а вы проверьте, не зря ли.' },
      { who: 'lena', html: 'Мне важно одно: события одного занятия — запись, отмена, перевод из листа ожидания — должны обрабатываться по порядку. На тесте лист ожидания уже записал человека на отменённое занятие.' },
      { who: 'vera', html: 'Kafka — это журнал, RabbitMQ — почтовое отделение. Сначала пощупаем оба в теории: ключи и партиции, обменники и очереди. Потом спроектируем топик записей и очередь уведомлений сами.' }
    ],
    facts: ['F-week-open', 'F-waitlist', 'F-offline', 'F-turnstile-vendor', 'F-sms', 'F-push'],
    glossary: [
      { term: 'Топик', simple: 'Отдельный журнал на одну тему: «записи», «платежи», «проходы».', tech: 'Именованный поток сообщений в Kafka, например puls.booking.events.v1. Делится на партиции, хранит сообщения заданный срок (у «Пульса» 7 дней) или по последнему значению ключа (compact).' },
      { term: 'Партиция', simple: 'Одна тетрадь из нескольких, на которые разделён журнал, чтобы писать и читать параллельно.', tech: 'Упорядоченная часть топика. Порядок сообщений Kafka гарантирует только внутри партиции. В группе одну партицию читает один экземпляр — число партиций ограничивает параллельность.' },
      { term: 'Ключ партиции', simple: 'По чему решают, в какую тетрадь записать: все записи одного занятия — в одну тетрадь.', tech: 'Ключ сообщения; номер партиции = hash(ключ) % число партиций. Одинаковый ключ — одна партиция — сохранённый порядок. Выбирают по тому, чей порядок важен потребителю: для записи — class_session_id.' },
      { term: 'Смещение (offset)', simple: 'Номер строки в тетради и закладка читателя: «дочитал до 41-й».', tech: 'Порядковый номер сообщения в партиции. Группа потребителей фиксирует (commit) смещение после обработки; отставание (lag) = последнее смещение − закоммиченное.' },
      { term: 'Группа потребителей', simple: 'Один сервис со всеми своими копиями: работу внутри делят, а другие сервисы читают то же самое отдельно.', tech: 'Consumer group: внутри группы каждая партиция назначена одному экземпляру; разные группы читают топик независимо со своими смещениями. У «Пульса» группа = сервис (notifications, bonus, waitlist…).' },
      { term: 'Сжатый топик', simple: 'Журнал, где от каждого клиента остаётся только последняя запись — как актуальный список пропусков.', tech: 'cleanup.policy=compact: Kafka удаляет старые сообщения с тем же ключом, оставляя последнее. Новый читатель с начала получает текущее состояние. У «Пульса» — puls.access.allowlist.v1 с ключом client_id.' },
      { term: 'Обменник (exchange)', simple: 'Сортировочный стол на почте: смотрит на адрес и раскладывает письма по ящикам.', tech: 'Точка входа RabbitMQ. Типы: direct (точное совпадение ключа), topic (шаблоны * и #), fanout (копия во все привязанные очереди), headers.' },
      { term: 'Ключ маршрутизации и привязка', simple: 'Адрес на конверте и правило ящика: «сюда — все письма по Москве».', tech: 'Routing key задаёт отправитель (sms.login-code), binding — правило связи очереди с обменником (sms.*). В topic: * — ровно одно слово, # — любое число слов.' },
      { term: 'Подтверждение (ack)', simple: 'Отметка почтальона «вручено»: до неё письмо считается в пути.', tech: 'Исполнитель сообщает брокеру об успешной обработке; только тогда RabbitMQ удаляет сообщение. Нет ack и соединение оборвалось — сообщение доставят снова. Auto-ack удаляет при выдаче — риск потери.' },
      { term: 'Приоритет сообщения', simple: 'Срочная телеграмма, которую почтальон берёт раньше рекламных буклетов.', tech: 'Очередь RabbitMQ с x-max-priority; сообщение с большим priority выдаётся раньше. У «Пульса»: код входа 9, «вы записаны» 5, реклама 1. В Kafka приоритетов нет.' }
    ],
    outro: 'Теперь у брокеров «Пульса» есть внятная граница: факты — в Kafka (журнал, группы, порядок по ключу, сжатый топик для пропусков), поручения на отправку — в RabbitMQ (обменник, ack, повтор, DLQ, приоритеты). Ключ топика выбирают по тому, чей порядок важен потребителю. Завтра — гарантии доставки: почему сообщения приходят дважды и как потребителю не начислить бонусы два раза.',
    tasks: [howKafka, howRabbit, whoTask, topicTask, rabbitTask, bothTask]
  });
})();
