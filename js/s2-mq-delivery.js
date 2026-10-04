/* Неделя 5, среда 10:00: гарантии доставки в Kafka.
   Теория: когда ставить «закладку» (смещение) — до или после обработки; сбой и ребаланс; идемпотентный потребитель;
   ядовитое сообщение, ретрай-топики, DLQ, отставание; порядок только внутри партиции.
   Практика: лаборатория «пуш пришёл дважды», лаборатория «ядовитое сообщение», гарантии для потребителей «Пульса», обоснование. */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc;
  const ID = 'mq-delivery';

  if (!document.getElementById('mqd-css')) document.head.insertAdjacentHTML('beforeend', `<style id="mqd-css">
    .mqd-root, .mqd-root .stack { min-width: 0; }
    .mqd-root .stack > * { min-width: 0; }
    .mqd-root :not(pre) > code { white-space: normal; overflow-wrap: anywhere; }
    .mqd-root .seg button { white-space: normal; text-align: left; }
    .mqd-box { display: grid; gap: 12px; padding: 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); min-width: 0; }
    .mqd-box > * { min-width: 0; }
    .mqd-set { display: grid; grid-template-columns: minmax(0, 220px) minmax(0, 1fr); gap: 8px 14px; align-items: center; }
    .mqd-set > .lbl { font-size: 13.5px; color: var(--text-2); min-width: 0; }
    .mqd-set > .seg { justify-self: start; max-width: 100%; }
    .mqd-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .mqd-stats.four { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .mqd-stats .stat { min-width: 0; }
    .mqd-stats .stat.cur { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
    .mqd-stats .v { font-size: 17px; }
    .mqd-strip { display: flex; flex-wrap: wrap; gap: 6px; padding: 12px; border-radius: 12px; background: var(--code-bg); border: 1px solid var(--border); }
    .mqd-cell { position: relative; min-width: 84px; flex: 1 1 84px; padding: 6px 8px 8px; border-radius: 9px; border: 1px solid var(--border-strong); background: var(--surface-2); font-size: 12.5px; line-height: 1.3; }
    .mqd-cell .off { font: 500 11px/1 var(--f-mono); color: var(--text-muted); }
    .mqd-cell.done { border-color: var(--ok); }
    .mqd-cell.lost { border-color: var(--bad); background: color-mix(in srgb, var(--bad) 12%, var(--surface-2)); }
    .mqd-cell.dup { border-color: var(--warn); background: color-mix(in srgb, var(--warn) 12%, var(--surface-2)); }
    .mqd-cell.poison { border-color: var(--bad); border-style: dashed; }
    .mqd-cell .mk { display: flex; gap: 2px 6px; flex-wrap: wrap; min-height: 14px; margin-bottom: 2px; font: 600 10.5px/1.25 var(--f-mono); }
    .mqd-cell .mk .bm { color: var(--accent); } .mqd-cell .mk .rd { color: var(--info); }
    .mqd-log { font: 12.5px/1.6 var(--f-mono); background: var(--code-bg); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; max-height: 210px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; }
    .mqd-log .ok { color: var(--ok); } .mqd-log .bad { color: var(--bad); } .mqd-log .warn { color: var(--warn); } .mqd-log .info { color: var(--info); }
    .mqd-btns { display: flex; flex-wrap: wrap; gap: 8px; }
    .mqd-btns .btn { white-space: normal; }
    .mqd-badge { display: inline-block; padding: 4px 10px; border-radius: 999px; font-weight: 600; font-size: 13px; border: 1px solid var(--border-strong); }
    .mqd-badge.ok { color: var(--ok); border-color: var(--ok); } .mqd-badge.bad { color: var(--bad); border-color: var(--bad); } .mqd-badge.warn { color: var(--warn); border-color: var(--warn); }
    .mqd-chart { width: 100%; min-width: 560px; height: auto; display: block; }
    .mqd-q { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .mqd-q .card { min-width: 0; }
    .mqd-q h4 { margin: 0 0 6px; font-size: 13.5px; }
    .mqd-q .msgs { display: flex; flex-wrap: wrap; gap: 4px; min-height: 26px; }
    .mqd-q .m { font: 500 11.5px/1 var(--f-mono); padding: 5px 6px; border-radius: 6px; background: var(--surface-3); }
    .mqd-q .m.p { background: color-mix(in srgb, var(--bad) 22%, var(--surface-3)); color: var(--bad); }
    .mqd-q .m.r { background: color-mix(in srgb, var(--warn) 22%, var(--surface-3)); }
    .mqd-ord { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .mqd-ord .card { min-width: 0; }
    .mqd-ord ol { margin: 4px 0 0; padding-left: 20px; font-size: 13px; }
    @media (max-width: 640px) {
      .mqd-set { grid-template-columns: minmax(0, 1fr); gap: 4px; }
      .mqd-set > .lbl { margin-top: 8px; }
      .mqd-stats, .mqd-q, .mqd-ord { grid-template-columns: minmax(0, 1fr); }
      .mqd-stats.four { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  </style>`);

  // ---------- общие помощники ----------
  const L = (id, t, sub) => ({ id, t, sub });
  const lock = (el, ro) => { if (ro) TR.$$('[data-seg] button', el).forEach(b => { b.disabled = true; }); };
  const tOf = (list, v) => { const x = list.find(o => o.v === v); return x ? String(x.t).replace(/<[^>]+>/g, '') : '—'; };
  const strip = s => String(s || '').replace(/<[^>]+>/g, '');

  function walk(el, scenarios, name) {
    let cur = scenarios[0].id;
    el.innerHTML = `<div class="stack"><div class="row"><span class="small dim">Вариант:</span>${ui.seg(name, scenarios.map(s => ({ v: s.id, t: s.t })), cur, 'accent')}</div><div data-w></div><div data-sum></div></div>`;
    const box = TR.$('[data-w]', el), sum = TR.$('[data-sum]', el);
    function show(id) {
      cur = id; const sc = scenarios.find(s => s.id === id);
      box.innerHTML = ''; sum.innerHTML = '';
      const d = document.createElement('div'); box.appendChild(d);
      ui.seq(d, { lanes: sc.lanes, steps: sc.steps, laneW: sc.laneW || 170, title: sc.t, hint: 'Нажимайте «Шаг →» и читайте пояснение под схемой.', onEnd() { sum.innerHTML = sc.sum ? ui.note(sc.sumKind || '', 'Итог', sc.sum) : ''; } });
    }
    ui.onSeg(el, (n, v) => { if (n === name) show(v); });
    show(cur);
  }

  // =====================================================================
  // Теория 1. Закладка, сбой, ребаланс, идемпотентность
  // =====================================================================
  const VIS = [
    { c: 'Анна', off: 2201, ev: 'e-a1' }, { c: 'Пётр', off: 2202, ev: 'e-p2' }, { c: 'Зарина', off: 2203, ev: 'e-z3' },
    { c: 'Олег', off: 2204, ev: 'e-o4' }, { c: 'Мария', off: 2205, ev: 'e-m5' }, { c: 'Глеб', off: 2206, ev: 'e-g6' }
  ];
  const howCommit = {
    id: 'how-commit', covers: ['dup-push', 'guarantees', 'eo-why'], title: 'Как это работает: закладка, сбой и дубль', free: true, noReset: true,
    simple: {
      icon: '🔖',
      plain: 'Kafka не удаляет прочитанное. Каждая группа потребителей сама ставит «закладку» — до какого места дочитала. Когда ставить закладку — до того, как сделали дело, или после, — решает, что будет при сбое: потеря или повтор.',
      analogy: 'Вы читаете книгу и кладёте закладку. Положили закладку на следующую страницу, а дочитать не успели (уснули) — утром начнёте с закладки и пропустите страницу. Дочитали, а закладку не переложили — утром прочитаете страницу ещё раз.',
      tech: 'Смещение (offset) — номер сообщения в партиции. Подтверждение смещения (commit) — запись «группа X обработала всё до N». Коммит <b>до</b> обработки — <b>at-most-once</b> (не больше раза: возможна потеря). Коммит <b>после</b> — <b>at-least-once</b> (хотя бы раз: возможен дубль). <b>Exactly-once</b> для внешнего действия — это at-least-once + идемпотентный потребитель: таблица <code>processed_event(consumer, event_id)</code> с первичным ключом.'
    },
    lead: ui.brief({
      situation: 'Соседний пример — сервис «Бонусы». Он читает топик <code>puls.access.visits.v1</code> и за каждое посещение начисляет клиенту +10 бонусов. В партиции — шесть посещений подряд: Анна, Пётр, Зарина, Олег, Мария, Глеб. Каждый должен получить ровно +10.',
      todo: [
        'Режим «Закладка до обработки»: нажмите «Обработать следующее» пару раз, потом «💥 Упасть посередине». Посмотрите на бонусы того, на ком упали.',
        'Нажмите «⟲ Сначала», переключите на «Закладка после обработки» и повторите. Кому теперь начислили дважды?',
        'Включите «Помнить обработанные (processed_event)» и снова уроните экземпляр. Попробуйте и «🔄 Ребаланс».',
        'Внизу — то же самое по шагам на схеме.'
      ],
      look: 'Полоса сверху — партиция: ячейки по порядку, в каждой номер (offset) и чьё посещение. ⚑ — закладка группы: с этого места начнёт читать экземпляр после сбоя. ▼ — где сейчас читает экземпляр. Зелёная рамка — начислено ровно +10, красная — потеря, жёлтая — дубль. Ниже — бонусы клиентов и журнал.'
    }),
    render(el) {
      el.classList.add('mqd-root');
      let mode = 'before', idem = false, S;
      const reset = () => { S = { committed: 0, pos: 0, inst: 1, bal: VIS.map(() => 0), seen: new Set(), log: [], skipped: 0 }; };
      reset();
      el.innerHTML = `<div class="stack">
        <div class="mqd-box">
          <div class="mqd-set">
            <div class="lbl">Когда ставим закладку</div>${ui.seg('cm', [{ v: 'before', t: 'до обработки' }, { v: 'after', t: 'после обработки' }], mode, 'accent')}
            <div class="lbl">Защита от повторов</div><label class="toggle"><input type="checkbox" data-idem> <span>Помнить обработанные — таблица <code>processed_event</code></span></label>
          </div>
          <div class="mqd-btns">
            <button type="button" class="btn sm primary" data-c="next">▶ Обработать следующее</button>
            <button type="button" class="btn sm danger" data-c="crash">💥 Упасть посередине</button>
            <button type="button" class="btn sm" data-c="reb">🔄 Ребаланс</button>
            <button type="button" class="btn sm ghost" data-c="reset">⟲ Сначала</button>
          </div>
        </div>
        <div data-g></div>
        <div class="mqd-strip" data-strip></div>
        <div data-stats></div>
        <div class="mqd-log" data-log aria-live="polite"></div>
        <div class="eyebrow">То же по шагам</div><div data-walk></div>
      </div>`;
      const gEl = TR.$('[data-g]', el);
      function guarantee() {
        if (mode === 'before') return ['bad', 'At-most-once — «не больше одного раза»', idem ? 'Таблица от потери не спасает: если закладка уже переложена, событие до потребителя больше не дойдёт.' : 'Дублей не будет, но при сбое событие может пропасть.'];
        if (!idem) return ['warn', 'At-least-once — «хотя бы один раз»', 'Ничего не теряется, но после сбоя или ребаланса часть событий придёт повторно.'];
        return ['ok', 'Exactly-once «на деле» = at-least-once + идемпотентность', 'Повтор приходит, но потребитель узнаёт его по eventId и не начисляет второй раз.'];
      }
      function draw() {
        const g = guarantee();
        gEl.innerHTML = `<div class="row"><span class="mqd-badge ${g[0]}">${g[1]}</span><span class="small muted">${g[2]}</span></div>`;
        TR.$('[data-strip]', el).innerHTML = VIS.map((m, i) => {
          const b = S.bal[i], passed = i < S.pos;
          const cls = b > 10 ? 'dup' : b === 10 ? 'done' : passed ? 'lost' : '';
          return `<div class="mqd-cell ${cls}"><div class="mk">${i === S.committed ? '<span class="bm">⚑ закладка</span>' : ''}${i === S.pos ? `<span class="rd">▼ №${S.inst}</span>` : ''}</div><div class="off">${m.off}</div><b>${m.c}</b><div class="small dim">${b ? '+' + b : passed ? 'потеряно' : 'ждёт'}</div></div>`;
        }).join('') + (S.committed >= VIS.length || S.pos >= VIS.length ? `<div class="mqd-cell"><div class="mk">${S.committed >= VIS.length ? '<span class="bm">⚑ закладка</span>' : ''}${S.pos >= VIS.length ? `<span class="rd">▼ №${S.inst}</span>` : ''}</div><div class="off">${VIS[VIS.length - 1].off + 1}</div><span class="small dim">новых нет</span></div>` : '');
        const lost = VIS.filter((m, i) => i < S.pos && S.bal[i] === 0).length, dup = S.bal.reduce((s, b) => s + Math.max(0, b / 10 - 1), 0);
        TR.$('[data-stats]', el).innerHTML = `<div class="mqd-stats">
          <div class="stat"><div class="k">Потеряно начислений</div><div class="v ${lost ? 'bad' : 'ok'}">${lost}</div><div class="s small dim">клиент пришёл, а +10 нет</div></div>
          <div class="stat"><div class="k">Лишних начислений</div><div class="v ${dup ? 'warn' : 'ok'}">${dup}</div><div class="s small dim">+20 вместо +10</div></div>
          <div class="stat"><div class="k">Повторов отсечено</div><div class="v ${S.skipped ? 'ok' : ''}">${S.skipped}</div><div class="s small dim">processed_event сказала «уже было»</div></div></div>`;
        TR.$('[data-log]', el).innerHTML = S.log.length ? S.log.slice(-12).join('\n') : '<span class="dim">Нажмите «▶ Обработать следующее».</span>';
        const lg = TR.$('[data-log]', el); lg.scrollTop = lg.scrollHeight;
      }
      const log = (cls, t) => S.log.push(`<span class="${cls}">${t}</span>`);
      function effect(i, inst) {
        const m = VIS[i];
        if (idem && S.seen.has(m.ev)) { S.skipped++; log('ok', `№${inst}: ${m.ev} уже есть в processed_event → пропускаю, бонусы не трогаю`); return; }
        S.bal[i] += 10; if (idem) S.seen.add(m.ev);
        log(S.bal[i] > 10 ? 'warn' : '', `№${inst}: ${m.c} +10 бонусов${S.bal[i] > 10 ? ' — второй раз!' : ''}${idem ? ' · processed_event += ' + m.ev : ''}`);
      }
      function commit(to, inst) { S.committed = to; log('info', `№${inst}: закладка ⚑ → ${to < VIS.length ? VIS[to].off : VIS[VIS.length - 1].off + 1}`); }
      TR.on(el, 'click', '[data-c]', (e, b) => {
        const c = b.dataset.c, i = S.pos;
        if (c === 'reset') { reset(); draw(); return; }
        if (i >= VIS.length) { ui.toast('Новых посещений нет. Нажмите «Сначала».', 'warn'); return; }
        if (c === 'next') {
          if (mode === 'before') { commit(i + 1, S.inst); effect(i, S.inst); } else { effect(i, S.inst); commit(i + 1, S.inst); }
          S.pos++;
        }
        if (c === 'crash') {
          if (mode === 'before') { commit(i + 1, S.inst); log('bad', `💥 №${S.inst} упал, не успев начислить ${VIS[i].c}`); }
          else { effect(i, S.inst); log('bad', `💥 №${S.inst} упал, не успев переложить закладку`); }
          S.inst++; S.pos = S.committed;
          log('', `№${S.inst} поднялся и читает с закладки: ${S.pos < VIS.length ? VIS[S.pos].off : 'конец'}`);
        }
        if (c === 'reb') {
          log('warn', `🔄 ребаланс: в группу добавили экземпляр, партицию отдают №${S.inst + 1}`);
          if (mode === 'before') { commit(i + 1, S.inst); effect(i, S.inst); S.pos = i + 1; }
          else { effect(i, S.inst); log('bad', `№${S.inst}: закладку поставить нельзя — партиция уже не моя`); }
          S.inst++; S.pos = S.committed;
          log('', `№${S.inst} получил партицию и читает с закладки: ${S.pos < VIS.length ? VIS[S.pos].off : 'конец'}`);
        }
        draw();
      });
      el.addEventListener('change', e => { if (e.target.matches('[data-idem]')) { idem = e.target.checked; reset(); draw(); } });
      ui.onSeg(el, (n, v) => { if (n === 'cm') { mode = v; reset(); draw(); } });
      draw();

      const LN = [L('k', 'Kafka', 'партиция 3'), L('c', 'Бонусы', 'экземпляр №1 → №2'), L('db', 'БД «Бонусов»', 'счёт и processed_event')];
      walk(TR.$('[data-walk]', el), [
        {
          id: 'amo', t: 'Закладка до · сбой', lanes: LN, sumKind: 'bad', sum: 'Зарина пришла в клуб, а бонусов нет. Kafka считает событие обработанным — само оно уже не вернётся. Это at-most-once.',
          steps: [
            { from: 'k', to: 'c', t: '2203 · Зарина пришла', note: 'Экземпляр №1 получил посещение Зарины.' },
            { from: 'c', to: 'k', t: 'commit 2204', kind: 'warn', note: 'Закладку ставим сразу: «группа bonus дочитала до 2204». Дело ещё не сделано.' },
            { from: 'c', to: 'c', box: true, t: '💥 экземпляр упал', kind: 'bad', note: 'Выкатка или нехватка памяти — процесс убит, бонусы не начислены.' },
            { from: 'k', to: 'c', t: 'с закладки: 2204', note: 'Экземпляр №2 начинает с закладки — со следующего сообщения.' },
            { from: 'c', to: 'db', t: 'Зарина: +0', kind: 'bad', note: 'Посещение Зарины никто больше не обработает.' }
          ]
        },
        {
          id: 'alo', t: 'Закладка после · сбой', lanes: LN, sumKind: 'warn', sum: 'Ничего не потеряно, но Зарина получила +20. Это at-least-once: повтор — нормальная часть жизни, его надо уметь пережить.',
          steps: [
            { from: 'k', to: 'c', t: '2203 · Зарина пришла' },
            { from: 'c', to: 'db', t: 'Зарина +10', kind: 'ok', note: 'Сначала дело: бонусы начислены и закоммичены в базе «Бонусов».' },
            { from: 'c', to: 'c', box: true, t: '💥 упал до commit', kind: 'bad', note: 'Закладку переложить не успели.' },
            { from: 'k', to: 'c', t: 'с закладки: снова 2203', kind: 'warn', note: 'Экземпляр №2 читает с закладки — и получает посещение Зарины второй раз.' },
            { from: 'c', to: 'db', t: 'Зарина +10 ещё раз', kind: 'bad', note: 'Без защиты потребитель не отличает повтор от нового посещения.' },
            { from: 'c', to: 'k', t: 'commit 2204', reply: true }
          ]
        },
        {
          id: 'eo', t: 'После + processed_event', lanes: LN, sumKind: 'ok', sum: 'Ровно +10. Брокер доставил дважды, а действие случилось один раз — потому что потребитель идемпотентен.',
          steps: [
            { from: 'k', to: 'c', t: '2203 · Зарина · e-z3' },
            { from: 'c', to: 'db', t: 'BEGIN\nINSERT processed_event e-z3', note: 'В одной транзакции: запись «bonus обработал e-z3» и начисление. Первичный ключ <code>(consumer, event_id)</code>.' },
            { from: 'c', to: 'db', t: 'Зарина +10 · COMMIT', kind: 'ok', note: 'Оба изменения закоммичены вместе: либо оба, либо ни одного.' },
            { from: 'c', to: 'db', box: true, t: '💥 упал до commit смещения', kind: 'bad' },
            { from: 'k', to: 'c', t: 'снова 2203 · e-z3', kind: 'warn', note: 'Повтор неизбежен — закладка не переложена.' },
            { from: 'c', to: 'db', t: 'INSERT e-z3 → конфликт PK', kind: 'ok', note: 'Вставка не прошла: такой eventId уже есть. Значит, это повтор — откатываем, бонусы не трогаем.' },
            { from: 'c', to: 'k', t: 'commit 2204', reply: true, kind: 'ok', note: 'Повтор пропущен, закладка переложена.' }
          ]
        }
      ], 'mqdw1');
      const r = TR.el(`<div>${ui.code(`BEGIN;
INSERT INTO processed_event (consumer, event_id) VALUES ('bonus', $1)
[[ok]]ON CONFLICT DO NOTHING[[/]];          -- 0 строк → это повтор: ROLLBACK, смещение подтверждаем
UPDATE bonus_account SET balance = balance + 10 WHERE client_id = $2;
COMMIT;                                -- и только потом commit смещения в Kafka`, 'sql', 'Идемпотентный потребитель: проверка и действие — одна транзакция')}
        ${ui.note('', 'Откуда ещё берутся повторы', '<b>Ребаланс</b> — группа перераздаёт партиции, когда экземпляр добавили, убрали или он «задумался» дольше <code>max.poll.interval.ms</code>. Партиция уходит другому, а тот начинает с последней закладки. В воскресенье 20:00 автоскейлинг добавляет экземпляры — ребалансов много. Ещё источник — отправитель повторил публикацию (ответ Kafka потерялся): в топике два сообщения с <b>разными</b> offset и <b>одним</b> eventId. Поэтому повтор узнают по eventId, а не по offset.')}
        ${ui.note('', 'Что здесь делает аналитик', 'В контракте события (AsyncAPI) пишет: «доставка at-least-once, возможны повторы; <code>eventId</code> обязателен и уникален». В требованиях к каждому потребителю — что для него хуже, потеря или дубль, и как он защищается. Критерий приёмки: «повтор события не меняет результат».')}</div>`);
      el.querySelector('.stack').appendChild(r);
    }
  };

  // =====================================================================
  // Теория 2. Ядовитое сообщение, ретраи, DLQ, порядок
  // =====================================================================
  const howPoison = {
    id: 'how-poison', covers: ['poison'], title: 'Как это работает: ядовитое сообщение, повторы и DLQ', free: true, noReset: true,
    simple: {
      icon: '☠️',
      plain: 'Партиция читается строго по порядку. Если одно сообщение не обрабатывается никогда, а потребитель упрямо пробует снова, всё, что за ним, стоит. Выход — после нескольких попыток отложить сообщение в отдельный «отстойник» (DLQ) и идти дальше.',
      analogy: 'Очередь на кассе: у покупателя не проходит карта. Если кассир будет пробовать её бесконечно, очередь растёт до улицы. Хороший кассир просит отойти в сторону, позвать администратора, и обслуживает следующих.',
      tech: '<b>Ядовитое сообщение</b> (poison message) — то, что падает при каждой обработке (битые данные, неизвестная версия). <b>Отставание</b> (consumer lag) — сколько сообщений группа ещё не обработала. <b>Ретрай-топик</b> (<code>…retry.1m</code>, <code>…retry.10m</code>) — повтор с паузой, не блокируя партицию. <b>DLQ</b> (dead letter queue, у «Пульса» — топик <code>….dlq</code>) — куда кладут сообщение после исчерпания повторов + алерт дежурному.'
    },
    lead: ui.brief({
      situation: 'Соседний пример — тот же сервис «Бонусы» и топик посещений. В 20:03 приходит посещение с пустым <code>clubId</code> — его выпустила старая прошивка турникета. Обработать его нельзя никогда: «Бонусы» не знают, какой клуб. Каждую минуту в партицию приходит ещё 8 посещений.',
      todo: [
        'Режим «Повторять, пока не получится»: жмите «+5 минут» и смотрите, как растёт очередь и отставание.',
        '«⟲ Сначала», переключите на «3 повтора через ретрай-топики, потом DLQ» и повторите. Куда делось сломанное сообщение?',
        'Ниже — порядок сообщений: переключайте ключ партиции и ретрай-топик и смотрите, что увидит турникет.'
      ],
      look: 'Три колонки — основная партиция, ретрай-топики, DLQ. В колонках — сообщения: серые — обычные, красное — ядовитое, жёлтое — ждёт повтора. Счётчик «Отставание» — сколько посещений ждут обработки и сколько это в минутах.'
    }),
    render(el) {
      el.classList.add('mqd-root');
      let mode = 'inf', S;
      const reset = () => { S = { t: 0, queue: 0, poison: 'none', retryAt: 0, tries: 0, dlq: 0, alert: false, done: 0 }; };
      reset();
      el.innerHTML = `<div class="stack">
        <div class="mqd-box">
          <div class="mqd-set"><div class="lbl">Что делать при ошибке</div>${ui.seg('pm', [{ v: 'inf', t: 'повторять, пока не получится' }, { v: 'dlq', t: '3 повтора через ретрай-топики, потом DLQ' }], mode, 'accent')}</div>
          <div class="mqd-btns"><button type="button" class="btn sm primary" data-p="tick">▶ +5 минут</button><button type="button" class="btn sm ghost" data-p="reset">⟲ Сначала</button></div>
        </div>
        <div data-pv></div>
        <div class="eyebrow">А что с порядком</div>
        <div data-ord></div>
      </div>`;
      const pv = TR.$('[data-pv]', el);
      function tick() {
        for (let k = 0; k < 5; k++) {
          S.t++;
          S.queue += 8;
          if (S.t === 3) S.poison = 'head';
          if (S.poison === 'head') {
            if (mode === 'inf') { S.tries += 60; continue; }
            S.poison = 'retry'; S.tries = 1; S.retryAt = S.t + 1;
          }
          if (S.poison === 'retry' && S.t >= S.retryAt) {
            S.tries++;
            if (S.tries >= 4) { S.poison = 'dlq'; S.dlq = 1; S.alert = true; } else S.retryAt = S.t + 10;
          }
          S.done += S.queue; S.queue = 0;
        }
      }
      function draw() {
        const stuck = S.poison === 'head';
        const lagMin = Math.round(S.queue / 8);
        const head = stuck ? '<span class="m p">20:03 ☠</span>' : '';
        const waiting = stuck ? Array.from({ length: Math.min(S.queue, 18) }, (_, i) => `<span class="m">${i + 1}</span>`).join('') + (S.queue > 18 ? `<span class="m">… ещё ${S.queue - 18}</span>` : '') : '<span class="small dim">всё обработано</span>';
        pv.innerHTML = `<div class="stack">
          <div class="mqd-stats four">
            <div class="stat"><div class="k">Время</div><div class="v tnum">20:${String(S.t).padStart(2, '0')}</div><div class="s small dim">старт 20:00</div></div>
            <div class="stat"><div class="k">Отставание</div><div class="v ${S.queue > 40 ? 'bad' : S.queue ? 'warn' : 'ok'}">${S.queue} шт.</div><div class="s small dim">≈ ${lagMin} мин без бонусов</div></div>
            <div class="stat"><div class="k">Попыток над ☠</div><div class="v ${S.tries > 4 ? 'bad' : ''}">${S.tries}</div><div class="s small dim">${stuck ? 'каждая падает' : S.poison === 'none' ? 'ещё не пришло' : 'не больше 4'}</div></div>
            <div class="stat"><div class="k">Дежурный</div><div class="v ${S.alert ? 'ok' : stuck ? 'bad' : ''}">${S.alert ? 'в курсе' : stuck ? 'не знает' : '—'}</div><div class="s small dim">${S.alert ? 'алерт: сообщение в DLQ' : 'алерта нет'}</div></div>
          </div>
          <div class="mqd-q">
            <div class="card flat"><h4>Основная партиция</h4><div class="msgs">${head}${waiting}</div></div>
            <div class="card flat"><h4>Ретрай-топики <span class="small dim">retry.1m → retry.10m</span></h4><div class="msgs">${S.poison === 'retry' ? `<span class="m r">☠ попытка ${S.tries + 1} в 20:${String(S.retryAt).padStart(2, '0')}</span>` : mode === 'inf' ? '<span class="small dim">не используются</span>' : '<span class="small dim">пусто</span>'}</div></div>
            <div class="card flat"><h4>DLQ <span class="small dim">visits.dlq</span></h4><div class="msgs">${S.dlq ? '<span class="m p">☠ 20:03 · clubId пуст</span>' : mode === 'inf' ? '<span class="small dim">нет DLQ</span>' : '<span class="small dim">пусто</span>'}</div></div>
          </div>
          ${S.t === 0 ? '<p class="small dim">Нажмите «▶ +5 минут».</p>' : stuck ? ui.note('bad', 'Партиция стоит', `Потребитель снова и снова падает на одном сообщении — ${S.tries} попыток. Все посещения после 20:03 ждут: Олег, Мария, Глеб и ещё ${Math.max(0, S.queue - 3)} человек без бонусов. Kafka тут ни при чём — она честно хранит очередь. Отставание растёт на 8 в минуту, пока кто-то не заметит.`)
          : S.poison === 'retry' ? ui.note('warn', 'Сломанное — в ретрай-топике, очередь идёт', 'Сообщение переложили в ретрай-топик: оно подождёт и попробует ещё раз. Основная партиция не ждёт — остальные посещения обрабатываются сразу.')
          : S.poison === 'dlq' ? ui.note('ok', 'Сломанное в DLQ, дежурный в курсе', 'Три повтора не помогли — значит, ошибка не временная. Сообщение лежит в DLQ, Сергей получил алерт. Починят причину — переотправят из DLQ. Отставание — ноль.')
          : ''}
        </div>`;
      }
      TR.on(el, 'click', '[data-p]', (e, b) => { if (b.dataset.p === 'reset') reset(); else if (S.t < 60) tick(); else ui.toast('Час прошёл. Нажмите «Сначала».', 'warn'); draw(); });
      ui.onSeg(el, (n, v) => { if (n === 'pm') { mode = v; reset(); draw(); } });
      draw();

      // ---- порядок ----
      let key = 'client', rt = false;
      const ord = TR.$('[data-ord]', el);
      const EV = [{ n: 1, t: 'MembershipFrozen', s: 'заморозил' }, { n: 2, t: 'MembershipActivated', s: 'разморозил досрочно' }];
      function drawOrd() {
        const same = key === 'client';
        const p1 = same ? [EV[0], EV[1]] : [EV[0]], p2 = same ? [] : [EV[1]];
        let applied;
        if (same && !rt) applied = [EV[0], EV[1]];
        else if (same && rt) applied = [EV[1], EV[0]];
        else applied = [EV[1], EV[0]];
        const last = applied[applied.length - 1], okRes = last.n === 2;
        const why = same && !rt ? 'Оба события с ключом <code>client_id</code> в одной партиции. Одна партиция — один читатель, строго по очереди.'
          : same && rt ? 'Ключ правильный, но первое событие упало (база на секунду недоступна) и ушло в ретрай-топик ждать минуту. Второе тем временем обработано. Ретрай-топик меняет порядок даже внутри ключа.'
          : 'Без ключа события раскидало по разным партициям. Их читают разные экземпляры с разной скоростью — «разморозка» обогнала «заморозку».';
        ord.innerHTML = `<div class="stack">
          <div class="mqd-box"><div class="small">Сервис «Доступ» строит список пропусков для турникетов из <code>puls.membership.events.v1</code>. Клиент Олег утром заморозил абонемент, а через минуту передумал и разморозил. Порядок: 1 — заморозка, 2 — разморозка.</div>
          <div class="mqd-set"><div class="lbl">Ключ партиции</div>${ui.seg('ok', [{ v: 'client', t: '<code>client_id</code>, как в каноне' }, { v: 'none', t: 'без ключа — по кругу' }], key, 'accent')}
          <div class="lbl">Первое событие упало</div><label class="toggle"><input type="checkbox" data-rt ${rt ? 'checked' : ''}> <span>…и ушло в ретрай-топик</span></label></div></div>
          <div class="mqd-ord">
            <div class="card flat"><h4>Партиция 4</h4><ol>${p1.map(e => `<li><code>${e.t}</code> — ${e.s}</li>`).join('') || '<span class="small dim">пусто</span>'}</ol></div>
            <div class="card flat"><h4>Партиция 9</h4><ol>${p2.map(e => `<li><code>${e.t}</code> — ${e.s}</li>`).join('') || '<span class="small dim">пусто</span>'}</ol></div>
          </div>
          <div class="small">Порядок применения у «Доступа»: ${applied.map(e => `<b>${e.n}</b> ${e.s}`).join(' → ')}</div>
          ${ui.note(okRes ? 'ok' : 'bad', okRes ? 'Турникет пускает Олега' : 'Турникет не пускает Олега', why + (okRes ? '' : ' Последним применилась заморозка — абонемент «заморожен», хотя Олег его разморозил.'))}
          <p class="small muted">Kafka гарантирует порядок <b>только внутри одной партиции</b>. Нужен порядок для одного клиента или занятия — один ключ на всё, что с ним связано. Потребителю, которому важен порядок, ретрай-топик не подходит «как есть»: пока сообщение ждёт повтора, следующие с тем же ключом тоже должны ждать. Аналитике порядок обычно не важен — ей ретрай-топики подходят.</p>
        </div>`;
      }
      ui.onSeg(ord, (n, v) => { if (n === 'ok') { key = v; drawOrd(); } });
      ord.addEventListener('change', e => { if (e.target.matches('[data-rt]')) { rt = e.target.checked; drawOrd(); } });
      drawOrd();
    }
  };

  // =====================================================================
  // Практика 1. Пуш пришёл дважды
  // =====================================================================
  const CM = [{ v: 'auto', t: 'автокоммит по таймеру, раз в 5 с' }, { v: 'before', t: 'сразу после получения пачки' }, { v: 'after', t: 'после обработки пачки' }];
  const ST = [{ v: 'none', t: 'нигде' }, { v: 'mem', t: 'в памяти экземпляра' }, { v: 'db', t: 'таблица processed_event' }];
  const KY = [{ v: 'off', t: 'номер сообщения (partition:offset)' }, { v: 'ev', t: '<code>eventId</code> из конверта' }];
  const SCN = [
    { v: 'crash', t: '💥 Экземпляр упал посреди пачки', k: 'Падение' },
    { v: 'reb', t: '🔄 20:03 — автоскейлинг, ребаланс', k: 'Ребаланс' },
    { v: 'twice', t: '📨 Событие попало в топик дважды', k: 'Дубль в топике' }
  ];
  const sigP = a => `${a.cm}|${a.st}|${a.ky}`;
  const PL = [L('k', 'Kafka', 'партиция 7'), L('a', 'Уведомления №1', 'consumer group'), L('b', 'Уведомления №2', 'consumer group'), L('db', 'БД уведомлений', 'processed_event'), L('ph', 'Телефоны', 'пуш через FCM/APNs')];

  function pushSim(a, sc) {
    const S = [], pushes = {}, mem = { a: new Set(), b: new Set() }, dbSet = new Set();
    let lost = 0;
    const msgs = sc === 'twice'
      ? [{ c: 'Анна', off: 1041, ev: 'e-91' }, { c: 'Пётр', off: 1042, ev: 'e-92' }, { c: 'Пётр', off: 1043, ev: 'e-92', copy: true }]
      : [{ c: 'Анна', off: 1041, ev: 'e-91' }, { c: 'Пётр', off: 1042, ev: 'e-92' }, { c: 'Зарина', off: 1043, ev: 'e-93' }];
    const keyOf = m => a.ky === 'ev' ? m.ev : '7:' + m.off;
    const proc = (m, inst, again) => {
      const k = keyOf(m), mine = mem[inst];
      if (a.st === 'mem') {
        if (mine.has(k)) { S.push({ from: inst, to: inst, t: `${k} в памяти → пропуск`, kind: 'ok', note: `Экземпляр помнит ключ ${k} — это повтор, пуш не шлём.` }); return; }
        S.push({ from: inst, to: inst, t: `${k} в памяти? нет`, kind: again ? 'warn' : 'info', note: again ? `Это повтор, но у экземпляра №${inst === 'a' ? 1 : 2} своя память — про ${k} он ничего не знает.` : (m.copy && a.ky === 'off' ? `У копии другой offset — ${k}. Для памяти это новое сообщение.` : 'Ключа нет в памяти — обрабатываем.') });
        mine.add(k);
      }
      if (a.st === 'db') {
        if (dbSet.has(k)) {
          S.push({ from: inst, to: 'db', t: `INSERT ${k}`, note: 'Потребитель пытается записать «я обработал это событие».' });
          S.push({ from: 'db', to: inst, t: 'конфликт PK → повтор', reply: true, kind: 'ok', note: `Ключ ${k} уже в таблице — это повтор. Пуш не шлём, просто подтверждаем.` });
          return;
        }
        S.push({ from: inst, to: 'db', t: `INSERT ${k} + задача на пуш`, kind: m.copy && a.ky === 'off' ? 'warn' : '', note: (m.copy && a.ky === 'off' ? `У копии свой offset (${k}) — для таблицы это новое сообщение, хотя eventId тот же. ` : '') + 'В одной транзакции: строка в <code>processed_event</code> и задача «отправить пуш» в журнал отправок.' });
        dbSet.add(k);
      }
      pushes[m.c] = (pushes[m.c] || 0) + 1;
      const n = pushes[m.c];
      S.push({ from: inst, to: 'ph', t: `${m.c}: «Вы записаны»${n > 1 ? ' ×' + n : ''}`, kind: n > 1 ? 'bad' : 'ok', note: n > 1 ? `${m.c} получает тот же пуш ещё раз. Это и есть жалоба в поддержку.` : `${m.c} получает пуш «Вы записаны на сайкл».` });
    };
    if (sc === 'crash') {
      S.push({ from: 'k', to: 'a', t: 'пачка 1041–1043', note: 'Экземпляр №1 получил пачку из трёх событий <code>BookingCreated</code>: Анна, Пётр, Зарина.' });
      if (a.cm === 'before') S.push({ from: 'a', to: 'k', t: 'commit 1044', kind: 'warn', note: 'Закладка ставится сразу после получения: «дочитали до 1044». Пуши ещё не отправлены.' });
      proc(msgs[0], 'a');
      if (a.cm === 'auto') S.push({ from: 'a', to: 'k', t: 'автокоммит: 1044', kind: 'warn', note: 'Прошло 5 секунд — клиент Kafka сам записал закладку «прочитано до 1044». Он знает, что прочитано, но не знает, что обработано.' });
      proc(msgs[1], 'a');
      S.push({ from: 'a', to: 'b', box: true, t: '💥 №1 упал на Зарине', kind: 'bad', note: 'Нехватка памяти — процесс убит, пуш Зарине не отправлен.' });
      const from = a.cm === 'after' ? 1041 : 1044;
      S.push({ from: 'k', to: 'b', t: `с закладки: ${from}`, kind: from === 1041 ? 'warn' : '', note: `Партицию 7 получил экземпляр №2 и читает с последней закладки — ${from}.` });
      if (from === 1044) { S.push({ from: 'b', to: 'b', t: 'Зарину никто не обработает', kind: 'bad', note: 'Закладка уже за Зариной. Её событие для группы <code>notifications</code> «прочитано», пуша не будет.' }); lost = 1; }
      else { msgs.forEach(m => proc(m, 'b', m.c !== 'Зарина')); S.push({ from: 'b', to: 'k', t: 'commit 1044', reply: true }); }
    }
    if (sc === 'reb') {
      S.push({ from: 'k', to: 'a', t: 'пачка 1041–1043', time: '20:03:00', note: 'Воскресенье, 20:03, пик записи. Экземпляр №1 получил пачку: Анна, Пётр, Зарина.' });
      if (a.cm === 'before') S.push({ from: 'a', to: 'k', t: 'commit 1044', kind: 'warn', note: 'Закладка ставится сразу после получения.' });
      msgs.forEach(m => proc(m, 'a'));
      S.push({ from: 'k', to: 'a', box: true, t: '🔄 ребаланс: добавили экземпляр', kind: 'warn', time: '20:03:02', note: 'Автоскейлинг добавил экземпляр — группа перераздаёт партиции. Партицию 7 отдают экземпляру №2.' });
      if (a.cm === 'before') S.push({ from: 'k', to: 'b', t: 'с закладки: 1044', note: 'Закладка уже стоит на 1044 — повторов нет.' });
      else {
        S.push({ from: 'a', to: 'k', t: a.cm === 'auto' ? 'таймер ещё не сработал' : 'commit 1044 — отказ', kind: 'bad', lost: a.cm !== 'auto', note: a.cm === 'auto' ? 'Автокоммит раз в 5 секунд, а прошло две. Закладка осталась на 1041.' : 'Пачку обработали, но партиция уже не наша — Kafka отказывает в коммите. Закладка осталась на 1041.' });
        S.push({ from: 'k', to: 'b', t: 'с закладки: 1041', kind: 'warn', note: 'Экземпляр №2 получает всю пачку заново.' });
        msgs.forEach(m => proc(m, 'b', true));
        S.push({ from: 'b', to: 'k', t: 'commit 1044', reply: true });
      }
    }
    if (sc === 'twice') {
      S.push({ from: 'k', to: 'b', box: true, t: '1042 и 1043 — оба e-92 (Пётр)', kind: 'warn', note: 'Модуль «Запись» отправил событие о записи Петра, ответ Kafka потерялся, отправка повторилась. В партиции две копии: разные offset (1042, 1043), один <code>eventId</code> e-92.' });
      S.push({ from: 'k', to: 'a', t: 'пачка 1041–1043' });
      msgs.forEach(m => proc(m, 'a'));
      S.push({ from: 'a', to: 'k', t: 'commit 1044', reply: true, note: 'Сбоев не было — закладка встала как надо. Здесь коммит ни при чём: дубль пришёл из самого топика.' });
    }
    const names = sc === 'twice' ? ['Анна', 'Пётр'] : ['Анна', 'Пётр', 'Зарина'];
    const dup = names.reduce((s, n) => s + Math.max(0, (pushes[n] || 0) - 1), 0);
    const okRes = !lost && !dup;
    S.push({ from: 'k', to: 'ph', box: true, kind: okRes ? 'ok' : 'bad', t: okRes ? 'Итог: каждому — ровно один пуш' : `Итог: ${lost ? 'потерян ' + lost : ''}${lost && dup ? ', ' : ''}${dup ? 'лишних пушей ' + dup : ''}`, note: names.map(n => `${n} — ${pushes[n] || 0}`).join(' · ') });
    return { steps: S, lost, dup };
  }
  const pushRes = (a, sc) => { const r = pushSim(a, sc); return { lost: r.lost, dup: r.dup }; };

  const taskDupPush = {
    id: 'dup-push', title: 'Пуш о записи пришёл дважды',
    simple: howCommit.simple,
    lead: ui.brief({
      situation: 'Инцидент: в воскресенье в 20:03 автоскейлинг добавил экземпляр сервиса «Уведомления», и часть клиентов получила пуш «Вы записаны» дважды. Группа <code>notifications</code> читает <code>puls.booking.events.v1</code> (12 партиций). Лена спрашивает: «Как настроить потребителя, чтобы пуш приходил ровно один раз — и при падении, и при ребалансе, и если событие попало в топик дважды?»',
      todo: [
        'В блоке «Настройки потребителя» выберите: когда подтверждать смещение; где помнить обработанные события; по какому признаку узнавать повтор.',
        'Прогоните все три сценария под настройками — каждый проиграется на схеме.',
        'Цель — «0 / 0» (ноль потерь, ноль лишних пушей) во всех трёх счётчиках. «Проверить» смотрит на настройки: держат ли они все три сценария.'
      ],
      look: 'Колонки — Kafka, два экземпляра «Уведомлений», их база и телефоны клиентов. Стрелка — сообщение, пунктир — ответ, плашка через колонки — событие. Под схемой — пояснение к шагу. Счётчики — «потеряно / лишних пушей» для каждого сценария; «—» — с этими настройками ещё не прогоняли.'
    }),
    blank: () => ({ cm: 'auto', st: 'none', ky: 'off', sc: 'crash', seen: [] }),
    reference: () => ({ cm: 'after', st: 'db', ky: 'ev', sc: 'crash', seen: SCN.map(s => 'after|db|ev|' + s.v) }),
    render(el, ctx) {
      el.classList.add('mqd-root');
      const a = ctx.ans; a.seen = a.seen || [];
      const k0 = sigP(a) + '|' + a.sc;
      if (!ctx.readonly && !a.seen.includes(k0)) { a.seen.push(k0); ctx.save(); }
      el.innerHTML = `<div class="stack">
        <div class="mqd-box"><div class="row"><span class="eyebrow">Настройки потребителя</span><span class="small dim">группа <code>notifications</code></span></div>
          <div class="mqd-set">
            <div class="lbl">Когда подтверждаем смещение</div>${ui.seg('cm', CM, a.cm, 'accent')}
            <div class="lbl">Где помним обработанные</div>${ui.seg('st', ST, a.st, 'accent')}
            <div class="lbl">Повтор узнаём по</div>${ui.seg('ky', KY, a.ky, 'accent')}
          </div></div>
        <div class="stack tight"><div class="eyebrow">Сценарий — выберите, и он проиграется</div>${ui.seg('sc', SCN, a.sc)}</div>
        <div data-stats></div><div data-seq></div><div data-verdict></div>
      </div>`;
      lock(TR.$('.mqd-box', el), ctx.readonly);
      const stats = TR.$('[data-stats]', el), vEl = TR.$('[data-verdict]', el);
      const redraw = () => {
        const sig = sigP(a);
        stats.innerHTML = `<div class="mqd-stats">${SCN.map(s => {
          const seen = a.seen.includes(sig + '|' + s.v), r = pushRes(a, s.v), good = !r.lost && !r.dup;
          return `<div class="stat ${s.v === a.sc ? 'cur' : ''}"><div class="k">${esc(s.k)}</div><div class="v ${seen ? (good ? 'ok' : 'bad') : ''}">${seen ? `${r.lost} / ${r.dup}` : '—'}</div><div class="s small dim">${seen ? (good ? 'потерь нет, дублей нет' : `потеряно ${r.lost}, лишних пушей ${r.dup}`) : 'ещё не прогнан с этими настройками'}</div></div>`;
        }).join('')}</div>`;
        const all = SCN.every(s => a.seen.includes(sig + '|' + s.v));
        if (!all) { vEl.innerHTML = '<p class="small dim">Прогоните все три сценария с одними настройками — тогда будет видно, держат ли они.</p>'; return; }
        const bad = SCN.filter(s => { const r = pushRes(a, s.v); return r.lost || r.dup; });
        vEl.innerHTML = bad.length ? ui.note('bad', 'Настройки не держат', `Проблемы в сценариях: ${bad.map(s => '«' + esc(s.k) + '»').join(', ')}. Меняйте настройки и прогоняйте снова.`) : ui.note('ok', 'Во всех трёх сценариях — ровно один пуш', 'Эти настройки держат и падение, и ребаланс, и дубль в топике. Нажмите «Проверить».');
      };
      const seq = ui.seq(TR.$('[data-seq]', el), {
        lanes: PL, steps: pushSim(a, a.sc).steps, start: 'all', speed: 750, laneW: 150,
        title: 'Пуш о записи: Kafka, два экземпляра «Уведомлений», база, телефоны',
        onEnd() { const k = sigP(a) + '|' + a.sc; if (!ctx.readonly && !a.seen.includes(k)) { a.seen.push(k); ctx.save(); } redraw(); }
      });
      redraw();
      ui.onSeg(el, (name, v) => {
        if (ctx.readonly && name !== 'sc') return;
        a[name] = v;
        if (!ctx.readonly) {
          const k = sigP(a) + '|' + a.sc; if (!a.seen.includes(k)) a.seen.push(k);
          ctx.save();
          if (name !== 'sc') ctx.decide('Потребитель уведомлений', `смещение: ${tOf(CM, a.cm)}; помним: ${tOf(ST, a.st)}; повтор по: ${tOf(KY, a.ky)}`);
        }
        seq.set(pushSim(a, a.sc).steps, { all: true });
        redraw();
      });
    },
    check(ans) {
      const notes = []; let pts = 0;
      if (ans.cm === 'after') { pts += 35; notes.push({ ok: true, html: 'Смещение подтверждается после обработки — событие не потеряется: при сбое его прочитают снова.' }); }
      else if (ans.cm === 'before') notes.push({ ok: false, html: 'Закладка до обработки — at-most-once. Упал экземпляр посреди пачки — и последнему клиенту пуш не придёт никогда. Прогоните «Падение».' });
      else notes.push({ ok: false, html: 'Автокоммит по таймеру знает, что <b>прочитано</b>, а не что <b>обработано</b>. Он даёт и потери (таймер успел), и дубли (не успел) — смотря как повезёт.' });
      if (ans.st === 'db') { pts += 35; notes.push({ ok: true, html: 'Обработанные события — в таблице <code>processed_event</code>: её видят все экземпляры, и она переживает перезапуск.' }); }
      else if (ans.st === 'mem') notes.push({ ok: false, html: 'Память экземпляра не видит соседей и пропадает при падении. Повтор после ребаланса придёт к <b>другому</b> экземпляру — что он знает о чужой памяти?' });
      else notes.push({ ok: false, html: 'Повторы при at-least-once неизбежны. Если нигде не помнить, что уже обработано, каждый повтор — новый пуш.' });
      if (ans.ky === 'ev') { pts += 30; notes.push({ ok: true, html: 'Повтор узнаётся по <code>eventId</code> — он одинаковый у копий события, даже если они лежат в топике под разными номерами.' }); }
      else notes.push({ ok: false, html: 'Номер сообщения (offset) различает копии, а не события. Если отправитель повторил публикацию, в топике две копии с <b>разными</b> offset. Прогоните «Дубль в топике».' });
      const sum = SCN.map(s => { const r = pushRes(ans, s.v); return `${esc(s.k)} — <b>${r.lost} / ${r.dup}</b>`; }).join(' · ');
      return { ok: pts === 100, score: pts / 100, notes, summary: `Потеряно / лишних пушей при ваших настройках: ${sum}.`, vera: pts === 100 ? null : 'Подсказка: сначала решите, что хуже для этого пуша — потеря или дубль. Потом — где помнить обработанное, чтобы это видели все экземпляры. И что одинаково у двух копий одного события.' };
    },
    explain: `<p>Работают только <b>три настройки вместе</b>:</p>
      <ul class="checks">
        <li><b>Смещение — после обработки.</b> Терять «вы записаны» нельзя, поэтому выбираем at-least-once. Автокоммит по таймеру отключаем (<code>enable.auto.commit=false</code>) — он не знает о вашей обработке.</li>
        <li><b>Таблица <code>processed_event(consumer, event_id)</code> с первичным ключом</b> в базе «Уведомлений». Вставка строки и задача «отправить пуш» — в одной транзакции. Память экземпляра не годится: при ребалансе повтор приходит к соседу.</li>
        <li><b>Ключ — <code>eventId</code>.</b> Копии одного события в топике лежат под разными offset. Поэтому <code>eventId</code> в конверте события обязателен.</li>
      </ul>
      <p>Как это было в инциденте «Пульса»: автокоммит + никакой памяти. В 20:03 ребаланс — пачки, обработанные за последние секунды, ушли новому экземпляру и были отправлены повторно.</p>
      <p>Тонкость: пуш уходит наружу (FCM/APNs) и в нашу транзакцию не входит. Между «отправил» и «отметил отправленным» всегда есть щель — редкий дубль остаётся возможным. Это честно пишут в требованиях: «потеря недопустима, редкий дубль терпим».</p>`,
    report: ans => `Настройки: смещение — ${tOf(CM, ans.cm)}; помним — ${tOf(ST, ans.st)}; повтор по — ${tOf(KY, ans.ky)}.\nПотеряно/дублей: ${SCN.map(s => { const r = pushRes(ans, s.v); return `${s.k} — ${r.lost}/${r.dup}`; }).join('; ')}.\nПрогнано сочетаний: ${(ans.seen || []).length}.`
  };

  // =====================================================================
  // Практика 2. Ядовитое сообщение
  // =====================================================================
  const RT = [{ v: '0', t: '0 — сразу дальше' }, { v: '3', t: '3 повтора' }, { v: 'inf', t: 'пока не получится' }];
  const PS = [{ v: 'none', t: 'без пауз, подряд' }, { v: 'block', t: '1 мин → 10 мин, ждём в самом потребителе' }, { v: 'topic', t: '1 мин → 10 мин через ретрай-топики' }];
  const AF = [{ v: 'skip', t: 'пропустить и забыть' }, { v: 'dlq', t: 'положить в DLQ-топик' }];
  const AL = [{ v: 'no', t: 'нет' }, { v: 'yes', t: 'да: сообщение в DLQ или отставание > 5 мин' }];
  const T_POISON = 5, T_CH = 90, END = 180;

  function poisonSim(a) {
    const r = a.rt, p = a.ps;
    let pBlock = 0, pFate, stuck = false, loop = false;
    if (r === 'inf') {
      if (p === 'topic') { loop = true; pFate = 'loop'; }
      else { stuck = true; pFate = a.al === 'yes' ? 'manual' : 'stuck'; }
    } else {
      pBlock = r === '3' && p === 'block' ? 21 : 0;
      pFate = a.af === 'dlq' ? 'dlq' : 'skip';
    }
    let tBlock = 0, tFate;
    if (r === '0' || (r === '3' && p === 'none')) tFate = a.af === 'dlq' ? 'dlq' : 'skip';
    else { tFate = 'ok'; tBlock = p === 'block' ? 11 : p === 'none' ? 3 : 0; }
    const fixAt = a.al === 'yes' ? 40 : END;
    const lag = t => {
      if (stuck) {
        if (t < T_POISON) return 0;
        if (t <= fixAt) return t - T_POISON;
        return Math.max(0, (fixAt - T_POISON) - (t - fixAt) * 6);
      }
      let v = 0;
      if (pBlock && t >= T_POISON) v = t <= T_POISON + pBlock ? t - T_POISON : Math.max(0, pBlock - (t - T_POISON - pBlock) * 6);
      if (tBlock && t >= T_CH) v = Math.max(v, t <= T_CH + tBlock ? t - T_CH : Math.max(0, tBlock - (t - T_CH - tBlock) * 6));
      return v;
    };
    const pts = []; let max = 0;
    for (let t = 0; t <= END; t++) { const v = lag(t); pts.push(v); if (v > max) max = v; }
    const reachCH = !stuck || a.al === 'yes';
    const seen = a.al === 'yes' && (pFate === 'dlq' || pFate === 'manual' || tFate === 'dlq' || max > 5);
    return { pts, max, pFate, tFate: reachCH ? tFate : 'wait', loop, stuck, seen };
  }
  const P_FATE = {
    dlq: ['ok', 'в DLQ — ждёт разбора', 'в DLQ'], skip: ['bad', 'выброшено молча', 'потеряно'], stuck: ['bad', 'партиция стоит до утра', 'застряло'],
    manual: ['warn', 'дежурный вручную пропустил его в 20:40 — событие потеряно для отчёта', 'вручную'], loop: ['bad', 'вечно кружит в ретрай-топике, никто не знает', 'по кругу']
  };
  const T_FATE = { ok: ['ok', 'дошли после повтора', 'дошли'], dlq: ['warn', '≈ 450 событий в DLQ — переотправлять руками', 'в DLQ'], skip: ['bad', '≈ 450 событий потеряно молча', 'потеряны'], wait: ['bad', 'до них очередь не дошла — партиция стоит', 'ждут'] };
  const hm = t => `${20 + Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;

  function lagChart(sim) {
    const W = 640, H = 180, PL0 = 44, PR = 22, PT = 24, PB = 26;
    const maxY = Math.max(10, Math.ceil(sim.max / 10) * 10);
    const x = t => PL0 + (W - PL0 - PR) * t / END, y = v => PT + (H - PT - PB) * (1 - v / maxY);
    const line = sim.pts.map((v, t) => `${x(t).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const k = sim.max > 30 ? 'var(--bad)' : sim.max > 5 ? 'var(--warn)' : 'var(--ok)';
    let s = `<svg class="mqd-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Отставание потребителя аналитики, минуты">`;
    [0, maxY / 2, maxY].forEach(v => { s += `<line x1="${PL0}" x2="${W - PR}" y1="${y(v)}" y2="${y(v)}" style="stroke:var(--border);stroke-dasharray:3 4"/><text x="${PL0 - 6}" y="${y(v) + 4}" text-anchor="end" style="fill:var(--text-muted);font-size:11px">${Math.round(v)}</text>`; });
    [0, 60, 120, 180].forEach(t => { s += `<text x="${x(t)}" y="${H - 8}" text-anchor="${t === 0 ? 'start' : t === END ? 'end' : 'middle'}" style="fill:var(--text-muted);font-size:11px">${hm(t)}</text>`; });
    s += `<line x1="${x(5)}" x2="${x(5)}" y1="${PT}" y2="${H - PB}" style="stroke:var(--bad);stroke-dasharray:2 3"/><text x="${x(5) + 4}" y="${PT - 8}" style="fill:var(--bad);font-size:11px">☠ 20:05</text>`;
    s += `<line x1="${x(90)}" x2="${x(90)}" y1="${PT}" y2="${H - PB}" style="stroke:var(--warn);stroke-dasharray:2 3"/><text x="${x(90) + 4}" y="${PT - 8}" style="fill:var(--warn);font-size:11px">ClickHouse лёг 21:30</text>`;
    s += `<polyline points="${line}" style="fill:none;stroke:${k};stroke-width:2.4;stroke-linejoin:round"/>`;
    s += `<text x="${PL0 - 6}" y="11" text-anchor="end" style="fill:var(--text-muted);font-size:10.5px">мин</text></svg>`;
    return `<div class="board" style="padding:10px">${s}</div>`;
  }

  const taskPoison = {
    id: 'poison', title: 'Ядовитое сообщение',
    simple: howPoison.simple,
    lead: ui.brief({
      situation: 'Инцидент: потребитель аналитики (группа <code>analytics</code>, топик <code>puls.booking.events.v1</code>) отстал на 3 часа — отчёт директора утром пустой. Причина: в 20:05 пришло событие <code>BookingCreated</code> от старой версии приложения с <code>startsAt: "завтра 19:00"</code> вместо даты. Оно падает при каждой попытке. А в 21:30 ещё и ClickHouse был недоступен 3 минуты — это ошибка временная. Сергей просит политику обработки ошибок, при которой ночь пройдёт спокойно.',
      todo: [
        'В блоке «Политика ошибок» выберите: сколько повторов; как ждать между ними; что делать, когда повторы кончились; нужен ли алерт дежурному.',
        'Смотрите на график отставания с 20:00 до 23:00 и на три итога под ним — каждое изменение пересчитывает вечер.',
        'Засчитывается политика, при которой: отставание не больше 5 минут, временный сбой ClickHouse пережит без потерь, ядовитое сообщение не потеряно, и дежурный о нём знает.'
      ],
      look: 'График — отставание потребителя в минутах: насколько отчёт позади жизни. Красная пунктирная линия — ядовитое событие, жёлтая — 3 минуты недоступности ClickHouse. Ниже — судьба ядовитого события, судьба ≈ 450 событий из окна сбоя ClickHouse и знает ли дежурный.'
    }),
    blank: () => ({ rt: 'inf', ps: 'none', af: 'skip', al: 'no' }),
    reference: () => ({ rt: '3', ps: 'topic', af: 'dlq', al: 'yes' }),
    render(el, ctx) {
      el.classList.add('mqd-root');
      const a = ctx.ans;
      el.innerHTML = `<div class="stack">
        <div class="mqd-box"><div class="row"><span class="eyebrow">Политика ошибок</span><span class="small dim">группа <code>analytics</code></span></div>
          <div class="mqd-set">
            <div class="lbl">Повторов при ошибке</div>${ui.seg('rt', RT, a.rt, 'accent')}
            <div class="lbl">Паузы между повторами</div>${ui.seg('ps', PS, a.ps, 'accent')}
            <div class="lbl">Повторы кончились</div>${ui.seg('af', AF, a.af, 'accent')}
            <div class="lbl">Алерт дежурному</div>${ui.seg('al', AL, a.al, 'accent')}
          </div></div>
        <div data-out></div>
      </div>`;
      lock(TR.$('.mqd-box', el), ctx.readonly);
      const out = TR.$('[data-out]', el);
      function draw() {
        const s = poisonSim(a), pf = P_FATE[s.pFate], tf = T_FATE[s.tFate];
        const lagK = s.max > 30 ? 'bad' : s.max > 5 ? 'warn' : 'ok';
        const notes = [];
        if (a.rt === 'inf' && a.ps === 'none') notes.push('Повторы без пауз и без конца: потребитель крутит одно и то же сообщение тысячи раз в секунду, логи растут на гигабайты.');
        if (a.rt === 'inf' && a.ps === 'topic') notes.push('Ретрай-топики без предела: сообщение вечно переходит из retry.10m обратно в retry.10m. Основная очередь идёт, но о сломанном событии никто не узнает.');
        if (a.ps === 'block' && a.rt !== '0') notes.push('Пауза «в самом потребителе» — это ожидание на месте: пока ждём повтора, вся партиция стоит.');
        if (a.rt === '3' && a.ps === 'none') notes.push('Три повтора подряд за миллисекунды — ClickHouse за это время не поднимется. Повтор без паузы почти не отличается от отсутствия повтора.');
        if (a.af === 'skip' && a.rt !== 'inf') notes.push('«Пропустить и забыть» — событие пропадает из отчёта навсегда, и никто не узнает, сколько таких было.');
        if (a.af === 'dlq' && a.al === 'no' && a.rt !== 'inf') notes.push('DLQ без алерта — кладбище: сообщения лежат, отчёт врёт, но никто не смотрит.');
        out.innerHTML = `<div class="stack">
          ${lagChart(s)}
          <div class="mqd-stats four">
            <div class="stat"><div class="k">Макс. отставание</div><div class="v ${lagK}">${s.max >= 60 ? Math.floor(s.max / 60) + ' ч ' + (s.max % 60) + ' мин' : s.max + ' мин'}</div><div class="s small dim">цель — не больше 5 мин</div></div>
            <div class="stat"><div class="k">Ядовитое событие</div><div class="v ${pf[0]}">${pf[2]}</div><div class="s small dim">${pf[1]}</div></div>
            <div class="stat"><div class="k">Сбой ClickHouse</div><div class="v ${tf[0]}">${tf[2]}</div><div class="s small dim">${tf[1]}</div></div>
            <div class="stat"><div class="k">Дежурный Сергей</div><div class="v ${s.seen ? 'ok' : 'bad'}">${s.seen ? 'в курсе' : 'не знает'}</div><div class="s small dim">${s.seen ? 'получил алерт' : 'узнает от директора утром'}</div></div>
          </div>
          ${notes.length ? `<ul class="checks small">${notes.map(n => `<li class="warn">${n}</li>`).join('')}</ul>` : ''}
        </div>`;
      }
      draw();
      ui.onSeg(el, (n, v) => {
        if (ctx.readonly) return;
        a[n] = v; ctx.save();
        ctx.decide('Политика ошибок аналитики', `повторов: ${tOf(RT, a.rt)}; паузы: ${tOf(PS, a.ps)}; потом: ${tOf(AF, a.af)}; алерт: ${tOf(AL, a.al)}`);
        draw();
      });
    },
    check(ans) {
      const s = poisonSim(ans), notes = []; let pts = 0;
      if (s.max <= 5) { pts += 30; notes.push({ ok: true, html: `Отставание не больше ${s.max} мин — основная партиция не стоит.` }); }
      else notes.push({ ok: false, html: `Отставание доходит до ${s.max} мин. Что держит партицию: бесконечные попытки или ожидание паузы прямо в потребителе? Где ещё можно подождать, не останавливая очередь?` });
      if (s.tFate === 'ok') { pts += 20; notes.push({ ok: true, html: 'Временный сбой ClickHouse пережит повторами — без потерь и без ручной работы.' }); }
      else notes.push({ ok: false, html: 'Сбой ClickHouse длился 3 минуты. Ошибка временная — её лечит повтор с паузой, а не DLQ и не выброс. Хватит ли паузы, чтобы ClickHouse успел подняться?' });
      if (s.pFate === 'dlq') { pts += 25; notes.push({ ok: true, html: 'Ядовитое событие после трёх попыток ушло в DLQ — не потеряно, его можно разобрать и переотправить.' }); }
      else notes.push({ ok: false, html: s.pFate === 'skip' ? 'Ядовитое событие выброшено молча — запись Анны пропала из отчёта навсегда.' : 'Ядовитое событие так и не покинуло цикл повторов. Повторы должны заканчиваться.' });
      if (ans.al === 'yes' && s.seen) { pts += 25; notes.push({ ok: true, html: 'Алерт на DLQ и на отставание — дежурный узнаёт о проблеме сразу, а не от директора утром.' }); }
      else notes.push({ ok: false, html: 'Кто узнает о сломанном событии? Без алерта DLQ превращается в кладбище, а отставание замечает директор утром по пустому отчёту.' });
      const ok = pts === 100;
      return { ok, score: pts / 100, notes, summary: `Отставание до ${s.max} мин · ядовитое: ${P_FATE[s.pFate][1]} · ClickHouse: ${T_FATE[s.tFate][1]}.`, vera: ok ? null : 'Подумайте о двух видах ошибок по отдельности. Временную (ClickHouse прилёг) лечит повтор с паузой. Постоянную (битые данные) повтор не вылечит — её надо отложить в сторону и позвать человека. А партиция не должна ждать ни ту, ни другую.' };
    },
    explain: `<p>Эталон канона «Пульса»: <b>3 повтора с паузой через ретрай-топики</b> (<code>…retry.1m</code>, <code>…retry.10m</code>), потом <b>DLQ-топик</b> <code>….dlq</code> и <b>алерт дежурному</b>.</p>
      <ul class="checks">
        <li><b>Повторы нужны</b> — для временных ошибок: ClickHouse, сеть, таймаут. Без пауз они бесполезны: за миллисекунды ничего не поднимется.</li>
        <li><b>Повторы должны кончаться</b> — постоянную ошибку (битые данные, неизвестная версия) повтор не вылечит. Бесконечный цикл = остановленная партиция = инцидент 5.</li>
        <li><b>Ждать — не на месте.</b> Пауза внутри потребителя держит всю партицию. Ретрай-топик забирает сообщение из очереди и возвращает позже, остальные идут дальше.</li>
        <li><b>DLQ — не мусорка.</b> В сообщении DLQ — исходное событие, текст ошибки, число попыток. Алерт на «появилось в DLQ» и на «отставание > 5 мин». После исправления — переотправка из DLQ.</li>
      </ul>
      <p>Цена ретрай-топиков — <b>порядок</b>: пока событие ждёт в retry.10m, следующие с тем же ключом уже обработаны. Аналитике это не страшно: ClickHouse агрегирует, а не применяет по шагам. Листу ожидания — страшно: ему нужна блокирующая пауза по ключу или «парковка» всех событий занятия.</p>
      <p>Что делает аналитик: пишет в требованиях к потребителю классы ошибок (временные и постоянные), число повторов и паузы, содержимое DLQ, кто и как разбирает DLQ, порог алерта по отставанию.</p>`,
    report: ans => { const s = poisonSim(ans); return `Повторов: ${tOf(RT, ans.rt)}; паузы: ${tOf(PS, ans.ps)}; потом: ${tOf(AF, ans.af)}; алерт: ${tOf(AL, ans.al)}.\nИтог: отставание до ${s.max} мин; ядовитое — ${P_FATE[s.pFate][1]}; ClickHouse — ${T_FATE[s.tFate][1]}.`; }
  };

  // =====================================================================
  // Практика 3. Гарантии для разных потребителей
  // =====================================================================
  const CONS = [
    { id: 'bonus', t: 'Бонусы', sub: '<code>bonus</code> · +10 за посещение из <code>puls.access.visits.v1</code>; бонусами платят до 30 % абонемента' },
    { id: 'push', t: 'Пуш «Место освободилось — вы записаны»', sub: '<code>notifications</code> · <code>WaitlistPromoted</code>; пуш уходит наружу через FCM/APNs' },
    { id: 'an', t: 'Аналитика и отчёт директора', sub: '<code>analytics</code> · ClickHouse; выручку в отчёте сверяют с 1С' },
    { id: 'onec', t: 'Выгрузка оплат в 1С', sub: '<code>onec-export</code> · <code>PaymentSucceeded</code>, <code>PaymentRefunded</code>; SOAP «ЗагрузитьОплаты»' },
    { id: 'reco', t: 'Рекомендации «Вам подойдёт»', sub: '<code>recommendations</code> · пересчёт раз в сутки по истории посещений за год' }
  ];
  const TOL = [
    { v: 'loss', t: 'Можно редко терять — дубль хуже' },
    { v: 'dup', t: 'Можно редкий дубль — потеря хуже' },
    { v: 'none', t: 'Нельзя ни терять, ни задваивать' },
    { v: 'both', t: 'Терпимо и то, и другое понемногу' }
  ];
  const DEF = [
    { v: 'tx', t: 'processed_event в той же транзакции, что и действие' },
    { v: 'journal', t: 'Проверка eventId в журнале отправок; редкий дубль терпим' },
    { v: 'load', t: 'Дедупликация по eventId при загрузке + перечитать топик' },
    { v: 'docid', t: 'Ключ — id платежа: документ не создаётся дважды + сверка' },
    { v: 'nothing', t: 'Ничего особенного: at-least-once без отдельной защиты' },
    { v: 'amo', t: 'At-most-once: подтверждать смещение до обработки' }
  ];
  const TOL_KEY = {
    bonus: { none: ['ok', 'Бонусы — это деньги: недоначислили — жалоба, начислили дважды — убыток.'], loss: ['bad', 'Клиент пришёл, а +10 нет — он это заметит и придёт в поддержку. Бонусы — деньги.'], dup: ['bad', 'Лишние бонусы — это лишние деньги: ими платят до 30 % абонемента.'], both: ['bad', '2 млн событий в день: «понемногу» — это сотни ошибок в деньгах каждый вечер.'] },
    push: { dup: ['ok', 'Не узнал о переводе из листа ожидания — не пришёл — прогул и блокировка (F-cancel). Лишний пуш только раздражает.'], none: ['warn', 'Хотелось бы, но пуш уходит наружу: между «отправил» и «отметил» всегда есть щель. Честное требование — «потеря недопустима, редкий дубль терпим».'], loss: ['bad', 'Потерянный пуш = прогул и блокировка на 7 дней (F-cancel). Это хуже лишнего уведомления.'], both: ['bad', 'Потерю этому пушу простить нельзя — от него зависит, придёт ли человек.'] },
    an: { none: ['ok', 'Отчёт сверяют с 1С — расхождение в рублях видно сразу (инцидент 7). Зато можно подождать: задержка до минуты допустима.'], both: ['bad', 'Директор сверяет выручку с 1С — «понемногу» превращается в «отчёту нельзя верить» (инцидент 7).'], loss: ['bad', 'Потерянные события — выручка в отчёте меньше 1С. Это инцидент 7.'], dup: ['bad', 'Дубль — выручка в отчёте больше реальной.'] },
    onec: { none: ['ok', 'Задвоение в 1С — неделя сверки (F-1c-dup), потеря — дыра в бухгалтерии. Ни то, ни другое.'], dup: ['bad', 'F-1c-dup: «загрузить дважды — задвоится выручка, потом неделя сверки».'], loss: ['bad', 'Потерянная оплата — дыра в бухгалтерии и вопросы налоговой.'], both: ['bad', 'Это бухгалтерия: ни потерь, ни дублей.'] },
    reco: { both: ['ok', 'Пересчёт раз в сутки по всей истории за год: одно лишнее или потерянное посещение рекомендацию не изменит.'], dup: ['warn', 'Можно и так, но потеря одного события здесь тоже почти незаметна.'], loss: ['warn', 'Можно и так, но и дубль одного посещения здесь почти незаметен.'], none: ['warn', 'Строже, чем нужно: защита стоит денег и сложности, а пользы здесь мало.'] }
  };
  const DEF_KEY = {
    bonus: { tx: ['ok', 'Отметка «обработано» и начисление — одна транзакция: либо оба, либо ни одного.'] },
    push: { journal: ['ok', 'Перед отправкой проверяем eventId в журнале отправок «Уведомлений». Щель между отправкой и отметкой остаётся — редкий дубль терпим.'], tx: ['warn', 'Пуш уходит в FCM — в транзакцию не входит. Журнал отправок и проверка eventId — то же по смыслу, но честнее.'] },
    an: { load: ['ok', 'ClickHouse без транзакций «как в PostgreSQL»: дубли схлопывают по eventId при загрузке (например, ReplacingMergeTree), а при пересоздании витрины перечитывают топик с начала (7 дней хранения).'], tx: ['warn', 'В ClickHouse так не сделать: нет обычных транзакций. Дедупликация по eventId при загрузке.'] },
    onec: { docid: ['ok', '1С — внешняя система, в нашу транзакцию не входит. Защита — на стороне загрузки: документ по id платежа не создаётся дважды. Плюс ежедневная сверка.'], tx: ['warn', '1С вызываем по SOAP — она в нашу транзакцию не входит. Дубль надо гасить по id платежа на стороне 1С.'] },
    reco: { nothing: ['ok', 'Не переусложняем: at-least-once и так есть, отдельная защита не окупится.'], amo: ['warn', 'Можно, но зачем: at-least-once ничего не стоит, а события не теряются.'], tx: ['warn', 'Работает, но это лишняя сложность там, где ошибка в одно событие незаметна.'], load: ['warn', 'Работает, но это лишняя сложность там, где ошибка в одно событие незаметна.'] }
  };
  const DEF_BAD = {
    amo: 'At-most-once — значит, при сбое событие теряется.', nothing: 'Повторы при at-least-once неизбежны — без защиты будут дубли.',
    tx: 'Здесь действие уходит во внешнюю систему или в хранилище без обычных транзакций.', journal: 'Журнал отправок — защита для уведомлений; здесь действие другое.',
    load: 'Это приём для загрузки в хранилище аналитики.', docid: 'Id платежа — защита для выгрузки документов; здесь нет платежа.'
  };
  const tolMark = (row, v) => v ? (TOL_KEY[row][v] || ['bad', '']) : null;
  const defMark = (row, v) => v ? (DEF_KEY[row][v] || ['bad', DEF_BAD[v] || '']) : null;
  function guarScore(ans) {
    let s = 0; const crit = [];
    CONS.forEach(c => {
      const t = tolMark(c.id, (ans.tol || {})[c.id]), d = defMark(c.id, (ans.def || {})[c.id]);
      s += t ? (t[0] === 'ok' ? 1 : t[0] === 'warn' ? .5 : 0) : 0;
      s += d ? (d[0] === 'ok' ? 1 : d[0] === 'warn' ? .5 : 0) : 0;
      if (['bonus', 'onec'].includes(c.id) && ['nothing', 'amo'].includes((ans.def || {})[c.id])) crit.push(c.t);
    });
    return { score: s / (CONS.length * 2), crit };
  }

  const taskGuar = {
    id: 'guarantees', title: 'Кому что можно простить',
    simple: { icon: '⚖️', plain: 'У каждого потребителя своя цена ошибки. Где-то лишнее сообщение — мелочь, а потеря — беда. Где-то наоборот. Где-то нельзя ни того, ни другого.', analogy: 'Курьер привёз пиццу дважды — неприятно, но переживём. Привёз дважды один и тот же счёт в бухгалтерию — его оплатят дважды. Не привёз лекарство — беда.', tech: 'Требование к доставке формулируется для каждого потребителя: что допустимо (потеря, дубль, задержка) и чем он защищается (идемпотентность в транзакции, журнал отправок, дедупликация при загрузке, ключ документа во внешней системе, сверка).' },
    lead: ui.brief({
      situation: 'Антон собирает ADR «Гарантии доставки событий». Kafka у «Пульса» — at-least-once для всех. Но потребители разные, и требования к ним надо записать по отдельности. Пять потребителей ниже.',
      todo: [
        'Шаг 1 — для каждого потребителя выберите, что ему можно простить.',
        'Шаг 2 — для каждого выберите, чем он защищается.',
        'Нажмите «Проверить». Засчитывается от 80 %; бонусы и 1С без защиты — критическая ошибка.'
      ],
      lookTitle: 'На что смотреть',
      look: 'Для каждого потребителя спросите себя: что увидит клиент или бухгалтер, если событие потеряется? А если придёт дважды? Входит ли действие в нашу транзакцию — или уходит наружу (пуш, 1С)?'
    }),
    blank: () => ({ tol: {}, def: {} }),
    reference: () => ({ tol: { bonus: 'none', push: 'dup', an: 'none', onec: 'none', reco: 'both' }, def: { bonus: 'tx', push: 'journal', an: 'load', onec: 'docid', reco: 'nothing' } }),
    render(el, ctx) {
      el.classList.add('mqd-root');
      const a = ctx.ans; a.tol = a.tol || {}; a.def = a.def || {};
      el.innerHTML = '<div class="stack"><div class="eyebrow">Шаг 1. Что можно простить</div><div data-t></div><div class="eyebrow">Шаг 2. Чем защищаемся</div><div data-d></div></div>';
      const rv = (fn, val) => ctx.result ? Object.fromEntries(CONS.filter(c => val[c.id]).map(c => { const m = fn(c.id, val[c.id]); return [c.id, { s: m[0], why: m[1] }]; })) : null;
      ui.match(TR.$('[data-t]', el), { rows: CONS, choices: TOL, value: a.tol, readonly: ctx.readonly, reveal: rv(tolMark, a.tol), onChange: v => { a.tol = v; ctx.save(); ctx.decide('Что допустимо потребителям', CONS.map(c => `${c.t}: ${tOf(TOL, v[c.id])}`).join('; ')); } });
      ui.match(TR.$('[data-d]', el), { rows: CONS, choices: DEF, value: a.def, readonly: ctx.readonly, reveal: rv(defMark, a.def), onChange: v => { a.def = v; ctx.save(); ctx.decide('Защита потребителей', CONS.map(c => `${c.t}: ${tOf(DEF, v[c.id])}`).join('; ')); } });
    },
    check(ans) {
      const g = guarScore(ans), notes = [];
      const filled = CONS.filter(c => (ans.tol || {})[c.id] && (ans.def || {})[c.id]).length;
      if (filled < CONS.length) notes.push({ ok: false, html: `Заполнено ${filled} из ${CONS.length} строк в обоих шагах.` });
      CONS.forEach(c => {
        const t = tolMark(c.id, (ans.tol || {})[c.id]), d = defMark(c.id, (ans.def || {})[c.id]);
        if (t && t[0] !== 'ok') notes.push({ ok: t[0] === 'warn' ? 'warn' : false, html: `<b>${c.t}</b>, что простить: ${t[1]}` });
        if (d && d[0] !== 'ok') notes.push({ ok: d[0] === 'warn' ? 'warn' : false, html: `<b>${c.t}</b>, защита: ${d[1] || 'не подходит этому потребителю.'}` });
      });
      if (g.crit.length) notes.push({ ok: false, html: `Критично: ${g.crit.join(', ')} без защиты — это деньги и документы.` });
      const ok = g.score >= .8 && !g.crit.length;
      if (ok && !notes.length) notes.push({ ok: true, html: 'Все пять потребителей разобраны верно.' });
      return { ok, score: g.score, notes, summary: `Верно ${Math.round(g.score * 10)} из 10 выборов.`, vera: ok ? null : 'Для каждого спросите: что увидит человек, если событие потеряется, и что — если придёт дважды? И входит ли действие в нашу транзакцию?' };
    },
    explain: `<p>Одна гарантия брокера (at-least-once) — и пять разных требований к потребителям:</p>
      ${ui.table(['Потребитель', 'Что можно простить', 'Чем защищается'], [
        ['Бонусы', 'ничего', '<code>processed_event</code> в той же транзакции, что и начисление'],
        ['Пуш из листа ожидания', 'редкий дубль', 'журнал отправок + проверка <code>eventId</code>'],
        ['Аналитика', 'задержку до минуты; не потерю и не дубль', 'дедупликация по <code>eventId</code> при загрузке; перечитать топик при пересоздании'],
        ['1С', 'ничего', 'id платежа как ключ документа в 1С + ежедневная сверка'],
        ['Рекомендации', 'понемногу и то, и другое', 'ничего особенного — не переусложняем']
      ])}
      <p>Это и есть работа аналитика в ADR: не «exactly-once для всех», а требование и защита для каждого потребителя — с ценой ошибки в рублях, прогулах и днях сверки.</p>`,
    report: ans => CONS.map(c => `- ${c.t}: простить — ${tOf(TOL, (ans.tol || {})[c.id])}; защита — ${tOf(DEF, (ans.def || {})[c.id])}`).join('\n')
  };

  // =====================================================================
  // Практика 4. Почему exactly-once = at-least-once + идемпотентность
  // =====================================================================
  const EO_RUBRIC = [
    'Подтверждение смещения и действие потребителя (пуш, начисление, запись в свою базу, вызов 1С) — две разные операции; между ними можно упасть',
    'Поэтому выбор только из двух: подтверждать до (рискуем потерять) или после (рискуем повторить); терять нельзя — значит, после, и повторы неизбежны',
    'Повторы приходят из разных мест: падение, ребаланс группы, повторная публикация отправителем (одно событие под разными offset)',
    'Транзакции Kafka дают exactly-once только внутри Kafka (прочитал из топика — записал в топик); внешние системы в них не входят',
    'Дубль гасит потребитель: processed_event(consumer, event_id) с первичным ключом в той же транзакции, что и действие; узнаём по eventId',
    'Для аналитика: в требованиях и контракте писать «at-least-once + идемпотентный потребитель», eventId обязателен; критерий приёмки — повтор не меняет результат'
  ];
  const EO_REF = 'Брокер не знает, сделал ли потребитель своё дело: подтверждение смещения и действие (пуш, начисление бонусов, запись в 1С) — две разные операции, и между ними можно упасть. Значит, выбор только из двух: подтверждать до обработки и рисковать потерей (at-most-once) или после — и получать повторы (at-least-once). Терять события «Пульсу» нельзя, поэтому подтверждаем после, и повторы неизбежны: падение экземпляра, ребаланс группы, повторная публикация отправителем. Транзакции Kafka дают exactly-once только внутри Kafka (прочитал из топика — записал в топик), а наши действия уходят в PostgreSQL, FCM и 1С. Поэтому «ровно один раз» обеспечивает потребитель: таблица processed_event(consumer, event_id) с первичным ключом, вставка — в той же транзакции, что и действие; повтор узнаём по eventId. В требованиях пишем не «exactly-once», а «at-least-once, eventId обязателен, потребитель идемпотентен», критерий приёмки — «повторная доставка события не меняет результат».';
  const taskEo = {
    id: 'eo-why', title: 'Почему «ровно один раз» — это «хотя бы раз» + идемпотентность',
    simple: howCommit.simple,
    lead: ui.brief({
      situation: 'Ольга прочитала статью и спрашивает Тимура: «Почему мы не включим exactly-once? Там же написано, что Kafka умеет». Тимур просит вас ответить письменно — так, чтобы поняли и Ольга, и разработчики, и это можно было вставить в ADR.',
      todo: [
        'Напишите своими словами (от 150 знаков): почему «ровно один раз» между сервисами на практике = at-least-once + идемпотентный потребитель.',
        'Опирайтесь на то, что видели в лаборатории «Пуш пришёл дважды».',
        'Нажмите «Проверить с Верой (Claude)» или «Сверить с эталоном самому» и отметьте раскрытые пункты. Засчитывается от 60 %.'
      ],
      lookTitle: 'На что опереться',
      look: 'Где в цепочке «прочитал → сделал → поставил закладку» можно упасть? Что брокер знает о вашем пуше или о вашей базе? Откуда ещё берутся повторы? Кто в итоге может сказать «это я уже делал»?'
    }),
    blank: () => ({ j: {} }),
    reference: () => ({ j: { text: EO_REF, self: EO_RUBRIC.map(() => true) } }),
    render(el, ctx) {
      el.classList.add('mqd-root');
      ui.justify(el, {
        id: 'mqd-eo', q: 'Почему exactly-once между сервисами на практике = at-least-once + идемпотентность?', qPlain: 'Почему exactly-once между сервисами на практике = at-least-once + идемпотентный потребитель?',
        rubric: EO_RUBRIC, reference: EO_REF, value: ctx.ans.j, readonly: ctx.readonly, minLen: 150,
        onChange: v => { ctx.ans.j = v; ctx.save(); ctx.decide('Exactly-once — почему так', v.text || ''); }
      });
    },
    check(ans) {
      const s = ui.justifyScore(ans && ans.j);
      return { ok: s >= .6, score: s, summary: s ? `Оценка обоснования: ${Math.round(s * 100)} %.` : 'Напишите ответ (от 150 символов) и проверьте его с Верой или сверьте с эталоном сами.', notes: s && s < .6 ? [{ ok: false, html: 'Вспомните лабораторию: где между «сделал» и «поставил закладку» можно упасть, и кто тогда узнаёт повтор.' }] : [] };
    },
    explain: '<p>Короткая формула для ADR: <b>брокер доставляет хотя бы раз, потребитель делает ровно один раз</b>. Exactly-once Kafka (идемпотентный продюсер + транзакции) честно работает для цепочки «топик → обработка → топик» внутри Kafka. Как только действие уходит наружу — в PostgreSQL сервиса, в FCM, в SOAP 1С, — Kafka о нём ничего не знает, и между «сделал» и «закоммитил смещение» остаётся щель.</p><p>Поэтому аналитик пишет требование не к брокеру, а к каждому потребителю: «идемпотентен по <code>eventId</code>», и добавляет критерий приёмки: «повторная доставка того же события не меняет результат — проверяется тестом с повтором».</p>',
    report: ans => (ans.j && ans.j.text) ? ans.j.text : '—'
  };

  // =====================================================================
  TR.stage({
    id: ID, act: 5, order: 230, slot: 'Ср 10:00', title: 'Гарантии доставки',
    when: 'среда, 10:00 · переговорная «Кардио» · разбор воскресных инцидентов',
    intro: [
      { who: 'sergey', html: 'Воскресенье, 20:03: автоскейлинг добавил экземпляр «Уведомлений» — и люди получили пуш «Вы записаны» дважды. А ночью аналитика встала: отставание три часа, утром у Ольги пустой отчёт.' },
      { who: 'lena', html: 'Но Kafka же гарантирует доставку? Мы ничего не теряем.' },
      { who: 'vera', html: 'Гарантирует. Вопрос — какую: «хотя бы раз» или «не больше раза». Сегодня разберём, откуда берутся дубли, почему одно сломанное сообщение может остановить целую очередь и что из этого писать в требованиях.' }
    ],
    facts: ['F-no-loss', 'F-1c-dup', 'F-waitlist', 'F-cancel'],
    glossary: [
      { term: 'At-most-once', simple: '«Не больше одного раза»: сообщение может потеряться, но дважды не придёт. Как письмо без уведомления о вручении.', tech: 'Смещение подтверждается до обработки. Сбой посередине — сообщение потеряно для этой группы.' },
      { term: 'At-least-once', simple: '«Хотя бы один раз»: не потеряется, но может прийти повторно. Как курьер, который привезёт посылку снова, если не получил вашу подпись.', tech: 'Смещение подтверждается после обработки. Сбой, ребаланс или повторная публикация дают дубли. Режим Kafka у «Пульса».' },
      { term: 'Exactly-once', simple: '«Ровно один раз»: сообщение обработано один раз, даже если пришло дважды.', tech: 'Между системами достигается как at-least-once + идемпотентный потребитель. Транзакции Kafka дают exactly-once только внутри Kafka.' },
      { term: 'Подтверждение смещения (commit)', simple: 'Закладка в книге: «дочитал до этой страницы». После перезапуска чтение начнётся с закладки.', tech: 'Группа потребителей записывает в Kafka номер следующего непрочитанного сообщения партиции. Автокоммит по таймеру не знает, обработано ли сообщение.' },
      { term: 'Ребаланс группы', simple: 'Перераздача работы, когда в бригаде стало больше или меньше людей: чужие участки достаются другим.', tech: 'При входе или выходе экземпляра из consumer group партиции перераспределяются; новый владелец читает с последнего подтверждённого смещения.' },
      { term: 'Идемпотентный потребитель', simple: 'Потребитель с журналом «это я уже сделал»: второй раз то же событие не выполняет.', tech: 'Таблица processed_event(consumer, event_id) с первичным ключом; вставка в той же транзакции, что и действие. Повтор узнаётся по eventId, а не по offset.' },
      { term: 'Ядовитое сообщение', simple: 'Сообщение, на котором обработка падает каждый раз — как карта, которая никогда не пройдёт на кассе.', tech: 'Poison message: битые данные, неизвестная версия схемы. Без предела повторов останавливает партицию.' },
      { term: 'Отставание потребителя (lag)', simple: 'Насколько потребитель позади жизни: сколько сообщений ждут своей очереди.', tech: 'Consumer lag = последнее смещение партиции − подтверждённое смещение группы. Алерт — на отставание в минутах.' },
      { term: 'Ретрай-топик', simple: 'Скамейка «подождите минутку»: сообщение отходит в сторону и пробует снова позже, не задерживая очередь.', tech: 'Отдельные топики …retry.1m, …retry.10m с отложенной повторной обработкой. Цена — нарушение порядка внутри ключа.' },
      { term: 'DLQ (очередь недоставленных)', simple: 'Полка для писем, которые не получилось доставить: их не выбрасывают, а разбирают вручную.', tech: 'Dead letter queue — у «Пульса» топик ….dlq: исходное событие, ошибка, число попыток. Алерт дежурному, переотправка после исправления.' }
    ],
    outro: 'Главное за сегодня: брокер доставляет «хотя бы раз», а «ровно один раз» делает потребитель — таблицей processed_event и eventId. Повторы должны кончаться, сломанное — уходить в DLQ с алертом, а партиция — не ждать. Завтра — обратная сторона: как модулю «Запись» вообще надёжно отправить событие, если база и Kafka — две разные системы. Это outbox.',
    tasks: [howCommit, howPoison, taskDupPush, taskPoison, taskGuar, taskEo]
  });
})();
