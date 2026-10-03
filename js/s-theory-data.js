/* Разделы теории «Как это работает» для недель 1–2: вопросы заказчику, чужие системы, сущности и связи,
   ключи, время и деньги, нормальные формы, ограничения, ON DELETE, нагрузка, реплики и бэкапы.
   Каждый раздел — интерактив на соседнем примере (шкафчики, бар клуба, облачная касса, тренажёры),
   чтобы студент увидел механизм, но задание практики решал сам. Встают в теорию своих тренировок по covers. */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc;

  if (!document.getElementById('thd-style')) document.head.insertAdjacentHTML('beforeend', `<style id="thd-style">
    .thd-w { width: 0; min-width: 100%; }
    .thd-x .tbl th, .thd-x .tbl td { white-space: nowrap; }
    .thd-x .tbl tr.gone td { text-decoration: line-through; opacity: .6; }
    .thd-er { contain: inline-size; min-width: 0; }
    .thd-cons { border-left: 3px solid var(--border-strong); padding: 6px 12px; font-size: 14px; }
    .thd-cons.ok { border-color: var(--ok); } .thd-cons.bad { border-color: var(--bad); } .thd-cons.warn { border-color: var(--warn); } .thd-cons.info { border-color: var(--info); }
    .thd-btns { display: flex; flex-wrap: wrap; gap: 8px; }
    .thd-btns .btn { white-space: normal; text-align: left; justify-content: flex-start; }
    .thd-phrase { font: 600 17px/1.45 var(--f-brand); padding: 12px 14px; border-radius: 12px; background: var(--surface-2); border: 1px solid var(--border-strong); }
    .thd-sea { border-top: 2px dashed color-mix(in srgb, var(--info) 55%, transparent); padding-top: 10px; display: grid; gap: 8px; }
    .thd-slots { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; }
    .thd-slot { border: 1px dashed var(--border-strong); border-radius: 10px; padding: 10px 12px; font-size: 13.5px; color: var(--text-muted); display: grid; gap: 6px; align-content: start; justify-items: start; min-width: 0; }
    .thd-slot b { color: var(--text); font-weight: 600; }
    .thd-slot .chip { white-space: normal; max-width: 100%; }
    .thd-slot.on { border-style: solid; border-color: color-mix(in srgb, var(--ok) 45%, var(--border)); background: var(--ok-soft); color: var(--text-2); }
    .thd-slot.cur { box-shadow: 0 0 0 2px var(--accent); }
    .thd-word { font: inherit; color: inherit; background: none; border: 0; border-bottom: 2px dotted var(--accent); padding: 0 3px; border-radius: 4px; cursor: pointer; }
    .thd-word.ent { background: var(--info-soft); border-bottom-color: var(--info); }
    .thd-word.attr { background: var(--violet-soft); border-bottom-color: var(--violet); }
    .thd-word.none { background: var(--surface-3); border-bottom-color: var(--text-muted); }
    .thd-word.cur { box-shadow: 0 0 0 2px var(--accent); }
    .thd-legend { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 12.5px; color: var(--text-2); align-items: center; }
    .thd-legend > span { display: inline-flex; align-items: center; gap: 6px; }
    .thd-sym { flex: none; display: block; }
    .thd-range { width: 100%; margin: 4px 0; accent-color: var(--accent); }
    .thd-clocks { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
    .thd-clock { border: 1px solid var(--border); background: var(--surface-2); border-radius: 12px; padding: 10px 12px; display: grid; gap: 2px; min-width: 0; }
    .thd-clock .tm { font: 700 28px/1.1 var(--f-mono); font-variant-numeric: tabular-nums; }
    .thd-clock .dt { font: 600 12px/1.2 var(--f-mono); color: var(--text-2); }
    .thd-clock.next .dt { color: var(--warn); }
    .thd-bars { display: flex; align-items: flex-end; gap: 2px; height: 110px; border-bottom: 1px solid var(--border-strong); position: relative; }
    .thd-bars i { flex: 1 1 0; min-width: 2px; background: var(--accent); border-radius: 3px 3px 0 0; opacity: .75; }
    .thd-bars i.pk { background: var(--warn); opacity: 1; }
    .thd-bars .avg { position: absolute; left: 0; right: 0; border-top: 2px dashed var(--ok); pointer-events: none; }
    .thd-calc { display: grid; gap: 6px; }
    .thd-calc .ln { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: baseline; padding: 6px 10px; border-radius: 8px; background: var(--surface-2); font-size: 14px; }
    .thd-calc .ln b { font: 600 15px/1.2 var(--f-mono); font-variant-numeric: tabular-nums; white-space: nowrap; }
    .thd-calc .ln.tot { background: var(--accent-soft); }
    .thd-inputs { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
    .thd-inputs .field b { font: 600 14px/1.2 var(--f-mono); color: var(--accent); }
    .thd-db { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
    .thd-node { border: 1px solid var(--border-strong); border-radius: 12px; padding: 10px 12px; background: var(--surface-2); display: grid; gap: 4px; align-content: start; min-width: 0; }
    .thd-node.bad { border-color: var(--bad); background: var(--bad-soft); } .thd-node.ok { border-color: color-mix(in srgb, var(--ok) 55%, var(--border)); } .thd-node.warn { border-color: var(--warn); background: var(--warn-soft); }
    .thd-node .v { font: 700 22px/1.2 var(--f-mono); font-variant-numeric: tabular-nums; }
    .thd-node .s { font-size: 12.5px; color: var(--text-muted); }
    .thd-node ul { margin: 0; padding-left: 18px; font-size: 13px; }
    .thd-steps { display: flex; flex-wrap: wrap; gap: 6px; }
    .thd-steps span { font: 600 12px/1 var(--f-mono); padding: 6px 9px; border-radius: 99px; border: 1px solid var(--border-strong); color: var(--text-muted); }
    .thd-steps span.on { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
    .thd-steps span.done { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 45%, var(--border)); }
    .thd-tbls { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; align-items: start; }
    .thd-tbls > * { min-width: 0; }
    .thd-cap { font: 600 12px/1.3 var(--f-mono); color: var(--text-2); margin-bottom: 4px; }
    .thd-letter { white-space: pre-wrap; font-size: 14px; line-height: 1.55; background: var(--surface); border: 1px solid var(--border-strong); border-radius: 10px; padding: 12px 14px; }
    .thd-checks { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; font-size: 13.5px; }
    .thd-checks li::before { content: '✕ '; color: var(--bad); font-weight: 700; }
    .thd-checks li.ok::before { content: '✓ '; color: var(--ok); }
    .thd-pick { display: grid; gap: 8px; }
    .thd-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; }
    .thd-flags { display: flex; flex-wrap: wrap; gap: 6px 16px; }
    .thd-log { display: grid; gap: 4px; font-size: 13px; max-height: 190px; overflow: auto; }
    .thd-log div { padding: 4px 8px; border-radius: 6px; background: var(--surface-2); }
    .thd-log div.bad { background: var(--bad-soft); } .thd-log div.ok { background: var(--ok-soft); }
  </style>`);

  // ---------- помощники ----------
  const L = (id, t, sub) => ({ id, t, sub });
  const add = (el, cls, html) => { const d = document.createElement('div'); if (cls) d.className = cls; if (html != null) d.innerHTML = html; el.appendChild(d); return d; };
  const W = h => `<div class="thd-w thd-x">${h}</div>`;
  // таблица, где ячейка может быть объектом {h, c} — тогда c станет классом td (cell-bad, cell-ok, click…)
  const xt = (cols, rows, rowCls) => W(`<div class="tbl-wrap"><table class="tbl"><thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map((r, i) => `<tr class="${rowCls ? rowCls(r, i) || '' : ''}">${r.map(c => c && typeof c === 'object' ? `<td class="${c.c || ''}" ${c.a || ''}>${c.h}</td>` : `<td>${c == null ? '' : c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
  const nf = n => Math.round(n).toLocaleString('ru-RU');
  const nf1 = n => (Math.round(n * 10) / 10).toLocaleString('ru-RU');
  const pad = n => String(n).padStart(2, '0');
  const errBox = (txt, title, html) => ui.note('ok', title || 'База не пустила', `${ui.code(txt, 'text')}${html ? `<div>${html}</div>` : ''}`);

  // проигрыватель сценариев: переключатель вариантов + пошаговая схема + итог (как в s-explain.js)
  function walk(el, cfg) {
    let cur = cfg.scenarios[0].id;
    el.innerHTML = `<div class="stack">${cfg.scenarios.length > 1 ? `<div class="row"><span class="small dim">Вариант:</span>${ui.seg('sc', cfg.scenarios.map(s => ({ v: s.id, t: s.t })), cur, 'accent')}</div>` : ''}<div data-w></div><div data-sum></div></div>`;
    const box = TR.$('[data-w]', el), sum = TR.$('[data-sum]', el);
    function show(id) {
      cur = id; const sc = cfg.scenarios.find(s => s.id === id);
      box.innerHTML = ''; sum.innerHTML = '';
      const d = document.createElement('div'); box.appendChild(d);
      ui.seq(d, { lanes: sc.lanes, steps: sc.steps, title: sc.t, hint: sc.hint || 'Нажимайте «Шаг →» и читайте пояснение под схемой. «Проиграть» покажет всё подряд.', onEnd() { sum.innerHTML = sc.sum ? ui.note(sc.sumKind || '', 'Итог', sc.sum) : ''; } });
    }
    ui.onSeg(el, (n, v) => { if (n === 'sc') show(v); });
    show(cur);
  }
  // вкладки: каждая рисуется в свежий div, чтобы обработчики не копились при переключении
  function tabs(el, list) { ui.tabs(el, list.map(t => ({ id: t.id, t: t.t, render: pane => t.render(add(pane, 'stack')) }))); }

  // =====================================================================
  // 1. interview-biz: как задавать вопросы заказчику
  // =====================================================================
  const LAND = { schema: 'Схема данных', integ: 'Интеграции и API', load: 'Нагрузка и хранение' };
  const LAND_ICO = { schema: '🗂️', integ: '🔌', load: '📈' };
  const landChip = k => k ? `<span class="chip">${LAND_ICO[k]} приземлится: ${esc(LAND[k])}</span>` : '';
  const ASK_T = [{ id: 'count', t: 'Сколько?' }, { id: 'what', t: 'Что если…?' }, { id: 'forbid', t: 'Что запрещено?' }, { id: 'ever', t: 'Бывает ли, что…?' }, { id: 'fields', t: 'Какие поля нужны?' }];
  const ASK = {
    locker: {
      t: 'Разминка: «Клиент арендует шкафчик»',
      phrase: '«Хотим сдавать шкафчики в аренду на месяц. Клиент арендует шкафчик — и всё».',
      who: 'Представим, что Ольга задумала платные шкафчики. Ответы в разминке выдуманные, но устроены так же, как на настоящей встрече.',
      q: {
        count: { q: 'Сколько шкафчиков отдадим в аренду и сколько людей захотят?', a: 'В Соколе 120 шкафчиков, в аренду отдадим 40. Желающих — человек двести, и придут все в первый же день.', rule: 'Желающих в 5 раз больше, чем шкафчиков, и все придут разом: лимит и пик.', land: 'load' },
        what: { q: 'Что если клиент не продлил аренду, а вещи остались внутри?', a: 'Ждём три дня. Потом администратор вскрывает шкафчик при свидетеле, вещи — на хранение.', rule: 'У аренды есть жизнь после конца: «просрочена», три дня отсрочки, акт вскрытия.', land: 'schema' },
        forbid: { q: 'Что здесь запрещено?', a: 'Один шкафчик — одному человеку. И одному человеку — не больше одного шкафчика, а то займут под сумки.', rule: 'Два запрета на повторы: шкафчик не сдать двоим, человеку не дать два.', land: 'schema' },
        ever: { q: 'Бывает ли, что шкафчик не открывается?', a: 'Бывает. Замки электронные, открываются браслетом. Если в клубе пропал интернет, замок сверяется со своим списком браслетов.', rule: 'Есть чужое устройство со своим списком. Надо договориться, как этот список обновлять.', land: 'integ' },
        fields: { q: 'Какие поля нужны в таблице аренды?', bad: 'Это же вы мне должны сказать? Я про шкафчики расскажу, а таблицы — ваша работа.' }
      }
    },
    booking: {
      t: 'Фраза Ольги: «Клиент записывается на занятие»',
      phrase: '«Клиент записывается на занятие».',
      who: 'Это фраза с вашей встречи. Здесь видно, какой слой правил откроет каждый тип вопроса. Сами ответы добудете на встрече — Ольга скажет их, только если спросите.',
      q: {
        count: { q: 'Вопросы «сколько?» про занятия, места, людей и время', a: 'Ответ — на встрече.', rule: 'Откроет масштаб: сколько мест, сколько людей и когда они приходят разом. Без этих чисел не посчитать пик.', land: 'load' },
        what: { q: 'Вопросы «что если?» про то, что идёт не по плану', a: 'Ответ — на встрече.', rule: 'Откроет запасные ветки сценария: что происходит, когда всё идёт не так, как задумано.', land: 'schema' },
        forbid: { q: 'Вопросы «что запрещено?» и «можно ли…?»', a: 'Ответ — на встрече.', rule: 'Откроет жёсткие правила, которые потом будет охранять база.', land: 'schema' },
        ever: { q: 'Вопросы «бывает ли, что…?» про сбои и исключения', a: 'Ответ — на встрече.', rule: 'Откроет крайние случаи: что ломается сейчас и что делать, когда пропала связь.', land: 'integ' },
        fields: { q: 'Какие поля нужны в таблице записей?', bad: 'Это же вы мне должны сказать? Я про бизнес могу рассказать, а таблицы — ваша работа.' }
      }
    }
  };
  function askQuestions(el) {
    let ph = 'locker', open = new Set(), cur = null, bad = 0;
    el.innerHTML = `<div class="row"><span class="small dim">Фраза:</span>${ui.seg('ph', Object.keys(ASK).map(v => ({ v, t: ASK[v].t })), ph, 'accent')}</div><div class="stack" data-a></div>`;
    const box = TR.$('[data-a]', el);
    function draw() {
      const P = ASK[ph], x = cur && P.q[cur];
      const slot = id => {
        const s = P.q[id], on = open.has(id), T = ASK_T.find(t => t.id === id);
        return `<div class="thd-slot ${on ? 'on' : ''} ${cur === id ? 'cur' : ''}"><span class="eyebrow">${esc(T.t)}</span>${on ? `<b>${esc(s.rule)}</b>${landChip(s.land)}` : '<span>??? — правило ещё под водой</span>'}</div>`;
      };
      let ans = '';
      if (x && x.bad) ans = ui.note('bad', 'Вопрос не по адресу', `<b>Вы:</b> ${esc(x.q)}<br><b>Ольга:</b> «${esc(x.bad)}»<br><span class="small">Такой вопрос ничего не открывает. На встрече он стоит 3 минуты и доверия. Поля вы выведете сами — из правил, которые расскажет заказчик.</span>`);
      else if (x) ans = ui.note(ph === 'locker' ? 'ok' : '', 'Что открылось', `<b>Вы:</b> ${esc(x.q)}<br>${ph === 'locker' ? `<b>Ольга:</b> «${esc(x.a)}»` : `<span class="dim">${esc(x.a)}</span>`}<br><b>Скрытое правило:</b> ${esc(x.rule)}`);
      box.innerHTML = `<div class="small muted">${esc(P.who)}</div>
        <div class="thd-phrase">${esc(P.phrase)}</div>
        <div class="thd-btns">${ASK_T.map(t => `<button type="button" class="btn sm ${t.id === 'fields' ? 'danger' : ''}" data-ask="${t.id}" aria-pressed="${cur === t.id}">${esc(t.t)}</button>`).join('')}</div>
        ${ans}
        <div class="thd-sea"><div class="row between"><span class="eyebrow">Под водой — то, что заказчик не сказал вслух</span><span class="small tnum">открыто ${open.size} из 4${bad ? ` · не по адресу: ${bad}` : ''}</span></div>
          <div class="thd-slots">${['count', 'what', 'forbid', 'ever'].map(slot).join('')}</div></div>
        ${open.size === 4 ? ui.note('ok', 'Итог', ph === 'locker' ? 'Одна фраза «клиент арендует шкафчик» превратилась в четыре правила: лимит и пик, жизнь после конца аренды, два запрета на повторы, чужие замки со своим списком. Ни одно из них Ольга не сказала бы сама.' : 'Четыре типа вопросов — четыре слоя правил. На встрече задавайте каждый тип про каждую тему: абонементы, запись, тренеры, проход, деньги, партнёры.') : ''}`;
    }
    ui.onSeg(el, (n, v) => { if (n === 'ph') { ph = v; open = new Set(); cur = null; bad = 0; draw(); } });
    TR.on(el, 'click', '[data-ask]', (e, b) => { cur = b.dataset.ask; if (ASK[ph].q[cur].bad) bad++; else open.add(cur); draw(); });
    draw();
  }
  const LANDS = [
    { id: 'l1', t: 'Один шкафчик — одному человеку одновременно', ok: ['schema'], why: 'Это запрет на повторы в данных. Его охраняет ограничение базы, а не память администратора.' },
    { id: 'l2', t: 'В первый день продаж придут 200 человек за 10 минут', ok: ['load'], why: 'Это пик: сколько запросов система должна выдержать в самую тяжёлую минуту.' },
    { id: 'l3', t: 'Замки открываются браслетом, у замков свой контроллер от поставщика', ok: ['integ'], why: 'Появилась чужая система. Надо договориться, как она узнаёт, кому открывать, и что делать без интернета.' },
    { id: 'l4', t: 'Аренду оплачивают картой в приложении', ok: ['integ'], why: 'Деньги идут через внешний платёжный сервис — это ещё одна интеграция.' },
    { id: 'l5', t: 'Историю аренд храним год — разбирать жалобы о пропажах', ok: ['load', 'schema'], why: 'Срок хранения задаёт объём и способ удалять старое. Немного задевает и схему: что именно хранить про аренду.' },
    { id: 'l6', t: 'Шкафчик в ремонте сдавать нельзя', ok: ['schema'], why: 'У шкафчика есть состояние, и база не даст сдать сломанный.' }
  ];
  function askLand(el) {
    const val = {};
    el.innerHTML = `<p class="small muted">Правила из разминки про шкафчики. Для каждого нажмите, куда оно «приземлится». Схема — что храним и что запрещено. Интеграции — с какой чужой системой придётся говорить. Нагрузка и хранение — сколько, как долго, что если упадёт.</p><div class="stack tight" data-l></div><div data-s></div>`;
    function draw() {
      TR.$('[data-l]', el).innerHTML = LANDS.map(c => {
        const v = val[c.id], st = v ? (c.ok[0] === v ? 'ok' : c.ok.includes(v) ? 'warn' : 'bad') : '';
        return `<div class="card flat thd-pick"><b>${esc(c.t)}</b><div class="row">${Object.keys(LAND).map(k => `<button type="button" class="btn xs" data-ld="${c.id}:${k}" aria-pressed="${v === k}">${LAND_ICO[k]} ${esc(LAND[k])}</button>`).join('')}</div>${v ? `<div class="thd-cons ${st}">${st === 'ok' ? 'Верно. ' : st === 'warn' ? 'Можно и так, но сильнее бьёт в другое место. ' : 'Скорее нет. '}${esc(c.why)}</div>` : ''}</div>`;
      }).join('');
      const n = Object.keys(val).length, good = LANDS.filter(c => val[c.id] && c.ok.includes(val[c.id])).length;
      TR.$('[data-s]', el).innerHTML = n === LANDS.length ? ui.note(good === n ? 'ok' : 'warn', 'Итог', `${good} из ${n} — в подходящем месте. Зачем раскладывать: через неделю, когда будете строить схему, сразу видно, какие правила охраняет база, а какие — интеграции и железо.`) : `<div class="small dim tnum">Разложено ${n} из ${LANDS.length}</div>`;
    }
    TR.on(el, 'click', '[data-ld]', (e, b) => { const [id, k] = b.dataset.ld.split(':'); val[id] = k; draw(); });
    draw();
  }
  const LETTER = [
    { id: 'p1', biz: 'Один шкафчик — одному человеку, у человека — не больше одного шкафчика.', tech: 'UNIQUE (locker_id) и UNIQUE (client_id) WHERE status = active.' },
    { id: 'p2', biz: 'В аренду идут 40 шкафчиков из 120, в первый день ждём около 200 желающих.', tech: 'Пик ~0,3 запроса в секунду, не больше 40 строк со статусом active.' },
    { id: 'p3', biz: 'Аренда кончилась — ждём 3 дня, потом вскрываем шкафчик при свидетеле.', tech: 'status = expired, grace_days = 3, затем строка в locker_opening.' },
    { id: 'p4', biz: 'Шкафчик в ремонте не сдаём.', tech: 'Нельзя создать аренду, если locker.status = repair.' },
    { id: 'p5', biz: 'Замки открываются браслетом и работают без интернета.', tech: 'Интеграция с контроллером замков, офлайн-список браслетов.' }
  ];
  function askLetter(el) {
    const st = { on: new Set(['p1', 'p2']), lang: 'tech', num: false, next: false };
    el.innerHTML = `<p class="small muted">Соберите письмо Ольге после разговора о шкафчиках. Включайте пункты и настройки — письмо и проверка под ним меняются сразу. Добейтесь, чтобы все строки проверки стали зелёными.</p>
      <div class="row"><span class="small dim">Язык письма:</span>${ui.seg('lang', [{ v: 'tech', t: 'технический' }, { v: 'biz', t: 'словами заказчика' }], st.lang, 'accent')}</div>
      <div class="thd-flags"><label class="toggle"><input type="checkbox" data-opt="num"> Пронумеровать пункты</label><label class="toggle"><input type="checkbox" data-opt="next"> Следующий шаг, срок и «поправьте, если не так»</label></div>
      <div class="card flat stack tight"><div class="eyebrow">Что включить в письмо</div>${LETTER.map(p => `<label class="toggle"><input type="checkbox" data-p="${p.id}" ${st.on.has(p.id) ? 'checked' : ''}> <span>${esc(p.biz)}</span></label>`).join('')}</div>
      <div data-let></div><div data-chk></div>`;
    function draw() {
      const items = LETTER.filter(p => st.on.has(p.id)).map(p => p[st.lang]);
      const body = items.map((t, i) => (st.num ? (i + 1) + ') ' : '— ') + t).join('\n');
      const text = `Ольга Викторовна, спасибо за разговор про шкафчики. Фиксирую, как понял:\n${body || '(пока ни одного пункта)'}${st.next ? '\n\nДальше: в четверг пришлю схему, в пятницу согласуем замки с Тимуром. Если что-то понял неверно — поправьте, пожалуйста.' : ''}`;
      TR.$('[data-let]', el).innerHTML = `<div class="code-cap">письмо</div><div class="thd-letter">${esc(text)}</div>`;
      const checks = [
        [items.length >= 3, 'Главное — 3–6 пунктов. Не стенограмма, но и не один пункт'],
        [st.num && items.length > 0, 'Пункты пронумерованы: на них удобно ответить «пункт 3 не так»'],
        [st.lang === 'biz', 'Словами заказчика: Ольга не знает, что такое UNIQUE и status'],
        [st.next, 'Есть следующий шаг, срок и просьба поправить: видно, что работа идёт']
      ];
      const ok = checks.filter(c => c[0]).length;
      TR.$('[data-chk]', el).innerHTML = `<div class="card flat stack tight"><div class="row between"><span class="eyebrow">Проверка письма</span><span class="small tnum">${ok} из ${checks.length}</span></div><ul class="thd-checks">${checks.map(c => `<li class="${c[0] ? 'ok' : ''}">${esc(c[1])}</li>`).join('')}</ul>${ok === checks.length ? ui.note('ok', 'Готово', 'Такое письмо Ольга прочитает за минуту и ответит «всё верно» или «пункт 2 не так». Через месяц спор «мы так не договаривались» закрывается одной ссылкой на письмо.') : ''}</div>`;
    }
    ui.onSeg(el, (n, v) => { if (n === 'lang') { st.lang = v; draw(); } });
    el.addEventListener('change', e => {
      const p = e.target.closest('[data-p]'), o = e.target.closest('[data-opt]');
      if (p) { if (p.checked) st.on.add(p.dataset.p); else st.on.delete(p.dataset.p); }
      if (o) st[o.dataset.opt] = o.checked;
      draw();
    });
    draw();
  }
  const howAsk = {
    id: 'how-ask', covers: ['talk', 'impact', 'letter'], title: 'Как это работает: вопросы заказчику', free: true, noReset: true,
    simple: {
      icon: '🧊', plain: 'Заказчик говорит одной фразой, а за ней прячутся десятки правил. Правила достают вопросами, а не догадками.',
      analogy: 'Айсберг: над водой — «клиент записывается на занятие», под водой — лимит мест, отмены, очереди и пики. Или врач: пациент говорит «болит», а врач спрашивает «где? с какого дня? когда хуже?». Какое лекарство выписать, врач у пациента не спрашивает — это его работа.',
      tech: 'Четыре рабочих типа вопросов. «Сколько?» — масштаб и нагрузка. «Что если…?» — запасные ветки сценария. «Что запрещено?» — ограничения данных. «Бывает ли, что…?» — исключения и сбои. Про поля, базы и технологии заказчика не спрашивают. Каждое правило потом «приземляется» в схему, интеграции или расчёт нагрузки. После встречи — письмо-резюме: пункты словами заказчика и следующий шаг.'
    },
    lead: ui.brief({
      situation: 'Перед встречей с Ольгой потренируемся на соседней фразе: «Клиент арендует шкафчик». Ответы в разминке выдуманные, но устроены так же, как на настоящей встрече. Потом посмотрим, куда каждое правило «приземлится» и как его зафиксировать в письме.',
      todo: [
        'Вкладка «Вопросы»: нажмите все пять типов вопросов и смотрите, какое правило всплывает «из-под воды». Потом переключите фразу на «Клиент записывается на занятие»: какие слои правил откроются на вашей встрече?',
        'Вкладка «Куда приземлится»: для каждого правила про шкафчики выберите — схема, интеграции или нагрузка.',
        'Вкладка «Письмо после встречи»: соберите письмо и добейтесь, чтобы все строки проверки стали зелёными.'
      ],
      look: 'Над пунктирной линией — что заказчик сказал вслух. Под ней — четыре пустых места для правил, которые он не сказал. Каждый хороший тип вопроса открывает одно место. Красная кнопка — вопрос не по адресу: он ничего не открывает и стоит доверия.'
    }),
    render(el) { tabs(el, [{ id: 'q', t: 'Вопросы', render: askQuestions }, { id: 'land', t: 'Куда приземлится', render: askLand }, { id: 'letter', t: 'Письмо после встречи', render: askLetter }]); }
  };

  // =====================================================================
  // 2. interview-tech: как расспросить про чужую систему
  // =====================================================================
  const SYS_Q = [
    { id: 'proto', t: 'На каком протоколе и в каком формате?', slot: 'Протокол и формат', short: 'REST + JSON, документация их', a: 'REST и JSON. Документация открыта. У нас пять тысяч магазинов — под каждого не переделываем.', risk: ['Они меняют свой API', 'интеграция ломается внезапно', 'следить за их версиями, тесты на их песочнице'] },
    { id: 'who', t: 'Кто начинает разговор?', slot: 'Кто начинает', short: 'чек шлём мы, номер чека — их вебхук', a: 'Чек присылаете вы. А фискальный номер чека мы сами пришлём на ваш адрес, когда налоговая его примет. Обычно через 5–30 секунд.', risk: ['Номер чека приходит не сразу и сам', 'не знаем, пробит ли чек', 'свой адрес для вебхука, проверка подписи, статус «ждёт номер»'] },
    { id: 'limits', t: 'Какие лимиты и окна работы?', slot: 'Лимиты и окна', short: '10 чеков/с; 03:00–03:30 закрыто', a: 'Не больше 10 чеков в секунду с одного магазина. Каждую ночь с 03:00 до 03:30 — регламентные работы, чеки не принимаем.', risk: ['В пик шлём больше 10 чеков в секунду', 'часть чеков отклонят', 'своя очередь и отправка не чаще лимита; ночью копим'] },
    { id: 'fail', t: 'Что будет при сбое?', slot: 'При сбое', short: '503; ответ бывает до 20 с', a: 'Если лежим — отвечаем 503. Если тормозит налоговая — держим запрос до 20 секунд.', risk: ['Касса думает 20 секунд или отвечает 503', 'клиент ждёт, сервер занят', 'свой таймаут, повтор с паузами, чек дошлём позже'] },
    { id: 'dup', t: 'Бывают ли повторы и дубли?', slot: 'Повторы и дубли', short: 'дубли возможны; защита — external_id', a: 'Пришлёте чек дважды — пробьём дважды. Чтобы не было дубля, кладите свой номер операции в поле external_id: второй чек с тем же номером не создадим. А вебхук с номером чека можем прислать повторно.', risk: ['Повтор после таймаута', 'два чека на одну покупку — двойная выручка в налоговой', 'свой неизменный номер операции (external_id); дубли вебхуков отсекаем по id'] }
  ];
  function sysQuestions(el) {
    const asked = [];
    let cur = null;
    el.innerHTML = `<div class="card flat stack tight"><div class="row between"><b>ЧекОблако — облачная касса</b><span class="chip">чужая система</span></div><div class="small muted">Регистрирует электронные чеки в налоговой. Понадобится «Пульсу», если клуб начнёт продавать коктейли бара через приложение. На созвоне — инженер ЧекОблака.</div><div data-slots class="stack tight"></div></div>
      <div class="thd-btns">${SYS_Q.map(q => `<button type="button" class="btn sm" data-sysq="${q.id}">${esc(q.t)}</button>`).join('')}</div>
      <div data-ans></div><div data-risk></div>`;
    function draw() {
      TR.$('[data-slots]', el).innerHTML = SYS_Q.map(q => `<div class="row between" style="gap:4px 10px"><span class="small dim">${esc(q.slot)}</span><span class="small ${asked.includes(q.id) ? '' : 'dim'}" style="text-align:right">${asked.includes(q.id) ? `<b>${esc(q.short)}</b>` : '?'}</span></div>`).join('');
      TR.$$('[data-sysq]', el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sysq === cur)));
      const q = SYS_Q.find(x => x.id === cur);
      TR.$('[data-ans]', el).innerHTML = q ? ui.note('', 'Инженер ЧекОблака', `<b>Вы:</b> ${esc(q.t)}<br>«${esc(q.a)}»<br><b>Какой риск это открывает:</b> ${esc(q.risk[0])} → ${esc(q.risk[1])}.`) : '<div class="small dim">Нажимайте вопросы. Пустые строки карточки заполнятся, а внизу соберётся список рисков.</div>';
      const rows = SYS_Q.filter(x => asked.includes(x.id)).map(x => x.risk.map(esc));
      TR.$('[data-risk]', el).innerHTML = rows.length ? `<div class="eyebrow">Блокнот рисков · ${rows.length} из 5</div>${xt(['Что может случиться', 'Чем обернётся', 'Где понадобится защита'], rows)}${rows.length === 5 ? ui.note('ok', 'Итог', 'Пять вопросов — пять рисков. Решать их прямо на созвоне не нужно: достаточно записать тройку «что случится → чем обернётся → где защита». На неделе интеграций каждая строка превратится в конкретное решение.') : ''}` : '';
    }
    TR.on(el, 'click', '[data-sysq]', (e, b) => { cur = b.dataset.sysq; if (!asked.includes(cur)) asked.push(cur); draw(); });
    draw();
  }
  const KASSA_LANES = [L('api', 'Сервер «Пульса»', 'продал коктейль'), L('kassa', 'ЧекОблако', 'облачная касса'), L('fns', 'Налоговая', 'принимает чеки')];
  function sysBreak(el) {
    add(el, 'small muted', 'Анна купила в приложении протеиновый коктейль за 290 ₽. Сервер отправил чек в кассу, но ответ потерялся. Сервер повторяет. Что получится — зависит от одного поля.');
    walk(add(el), {
      scenarios: [
        {
          id: 'nokey', t: 'Повтор без своего номера', lanes: KASSA_LANES, sumKind: 'bad',
          sum: 'В налоговой два чека на 290 ₽ за одну покупку. Касса не ошиблась: для неё второй чек ничем не отличался от первого.',
          steps: [
            { from: 'api', to: 'kassa', t: 'чек 290 ₽', note: 'Сервер «Пульса» отправляет чек в ЧекОблако. Своего номера операции в запросе нет.' },
            { from: 'kassa', to: 'fns', t: 'зарегистрировать', note: 'Касса регистрирует чек в налоговой.' },
            { from: 'kassa', to: 'api', t: '200 «принято»', reply: true, lost: true, kind: 'bad', note: 'Касса ответила «принято», но ответ потерялся: моргнула сеть. Сервер не знает, создан ли чек.' },
            { from: 'api', to: 'kassa', t: 'чек 290 ₽\n(повтор)', kind: 'warn', note: 'Через 20 секунд сервер повторяет запрос. Для кассы это новый чек.' },
            { from: 'kassa', to: 'fns', t: 'зарегистрировать\nещё раз', kind: 'bad', note: 'Второй чек на ту же покупку.' },
            { from: 'api', to: 'fns', t: 'два чека на одну покупку', box: true, kind: 'bad', note: 'Выручка в налоговой задвоилась. Исправлять — чеком коррекции и объяснениями бухгалтера.' }
          ]
        },
        {
          id: 'key', t: 'Повтор с external_id', lanes: KASSA_LANES, sumKind: 'ok',
          sum: 'Один чек. Номер операции — как номерок в гардеробе: сколько раз его ни покажи, выдадут одно пальто.',
          steps: [
            { from: 'api', to: 'api', t: 'операция op-5521', note: 'Сервер заранее присваивает продаже свой номер операции и сохраняет его в базе. В любом повторе номер будет тот же.' },
            { from: 'api', to: 'kassa', t: 'чек 290 ₽\nexternal_id op-5521', note: 'Номер уходит в поле <code>external_id</code>, которое касса сама предложила на созвоне.' },
            { from: 'kassa', to: 'fns', t: 'зарегистрировать', note: 'Касса регистрирует чек и запоминает: op-5521 → чек №1.' },
            { from: 'kassa', to: 'api', t: '200 «принято»', reply: true, lost: true, kind: 'bad', note: 'Ответ снова теряется.' },
            { from: 'api', to: 'kassa', t: 'повтор\nop-5521', kind: 'warn', note: 'Сервер повторяет запрос — с тем же номером операции.' },
            { from: 'kassa', to: 'kassa', t: 'op-5521 уже есть', kind: 'ok', note: 'Касса видит знакомый номер и второй чек не создаёт.' },
            { from: 'kassa', to: 'api', t: 'тот же чек №1', reply: true, kind: 'ok', note: 'Сервер получает тот же ответ, что и в первый раз. В налоговой один чек.' }
          ]
        }
      ]
    });
  }
  const WHOSE_B = { theirs: 'Подстраиваемся', ours: 'Проектируем сами', deal: 'Договариваемся' };
  const WHOSE = [
    { id: 'w1', t: 'ЧекОблако — облачная касса', sub: '5 000 магазинов, документация открыта', ok: ['theirs'], why: 'Крупный сервис с тысячами клиентов под «Пульс» переделываться не станет. Читаем документацию и защищаемся от её особенностей.' },
    { id: 'w2', t: 'Табло в холле: «свободно N шкафчиков»', sub: 'экран делает своя студия по заказу «Пульса»', ok: ['ours'], why: 'Это наш собственный клиент. Какие данные и в каком виде ему отдавать, решаем мы.' },
    { id: 'w3', t: 'Поставщик электронных замков', sub: 'контроллер умеет REST и офлайн-список браслетов', ok: ['deal', 'theirs'], why: 'Железо умеет только то, что умеет. Но что передавать замку и как обновлять список браслетов, согласуем вместе.' },
    { id: 'w4', t: 'Сервис карт: клубы на карте города', sub: 'миллионы пользователей', ok: ['theirs'], why: 'Огромный сервис со своим форматом. Отправляем данные клубов так, как он требует.' }
  ];
  function sysWhose(el) {
    const val = {};
    el.innerHTML = `<p class="small muted">Для каждой системы спросите: кто здесь сильнее и кто кому платит? Большой сервис под вас не переделается. Свой экран или приложение — ваши правила. Если у обеих сторон жёсткие требования — договариваетесь.</p><div class="stack tight" data-w></div>`;
    function draw() {
      TR.$('[data-w]', el).innerHTML = WHOSE.map(c => {
        const v = val[c.id], st = v ? (c.ok[0] === v ? 'ok' : c.ok.includes(v) ? 'warn' : 'bad') : '';
        return `<div class="card flat thd-pick"><div><b>${esc(c.t)}</b><div class="small dim">${esc(c.sub)}</div></div><div class="row">${Object.keys(WHOSE_B).map(k => `<button type="button" class="btn xs" data-wh="${c.id}:${k}" aria-pressed="${v === k}">${esc(WHOSE_B[k])}</button>`).join('')}</div>${v ? `<div class="thd-cons ${st}">${st === 'ok' ? 'Да. ' : st === 'warn' ? 'Можно и так. ' : 'Скорее нет. '}${esc(c.why)}</div>` : ''}</div>`;
      }).join('');
    }
    TR.on(el, 'click', '[data-wh]', (e, b) => { const [id, k] = b.dataset.wh.split(':'); val[id] = k; draw(); });
    draw();
  }
  const howSystems = {
    id: 'how-systems', covers: ['talk', 'whose', 'risks'], title: 'Как это работает: расспросить про чужую систему', free: true, noReset: true,
    simple: {
      icon: '🔌', plain: 'Про каждую чужую систему надо узнать пять вещей: на каком языке она говорит, кто начинает разговор, когда и сколько она готова слушать, что делает при сбое и бывают ли повторы.',
      analogy: 'Как договориться с курьерской службой. Звонить им или они сами приедут? Работают ли ночью? Сколько посылок берут за раз? Что будет, если курьер не застал дома? Может ли он привезти одну посылку дважды?',
      tech: 'Протокол и формат (REST/JSON, SOAP/XML, gRPC/Protobuf). Направление: мы вызываем их или они нас (вебхук). Ограничения: лимит запросов в секунду, окно работы, время ответа. Поведение при сбое: коды ошибок, таймауты, ретраи. Гарантии доставки: дубли, порядок, идемпотентность. Каждый ответ записывают риском: что случится → чем обернётся → где нужна защита.'
    },
    lead: ui.brief({
      situation: 'На созвоне с ИТ вы будете расспрашивать про 1С, оплату, турникеты, SMS и партнёра. Потренируемся на системе, которой в «Пульсе» пока нет: облачная касса ЧекОблако регистрирует чеки в налоговой. «Пульсу» она понадобится, если бар клуба начнёт продавать коктейли через приложение.',
      todo: [
        'Вкладка «Пять вопросов»: задайте все пять и смотрите, как заполняется карточка системы и блокнот рисков.',
        'Вкладка «Как ломается»: пройдите по шагам повтор без своего номера операции и с ним. Сколько чеков окажется в налоговой?',
        'Вкладка «Чьи правила»: для четырёх систем решите — подстраиваемся, проектируем сами или договариваемся.'
      ],
      look: 'Карточка системы сверху — пять строк. Знак «?» — вы ещё не спросили. Каждый ответ инженера открывает риск: что может случиться, чем обернётся и где понадобится защита. Это и есть результат технического созвона — не решения, а записанные риски.'
    }),
    render(el) { tabs(el, [{ id: 'q', t: 'Пять вопросов', render: sysQuestions }, { id: 'br', t: 'Как ломается', render: sysBreak }, { id: 'wh', t: 'Чьи правила', render: sysWhose }]); }
  };

  // =====================================================================
  // 3. concept: сущности, атрибуты, связи
  // =====================================================================
  const ENT_TESTS = ['Таких много, и мы их различаем?', 'У этого есть свои свойства?', 'На это ссылается что-то другое?'];
  const WORDS = {
    barista: { t: 'бариста', v: 'ent', name: 'Сущность «Сотрудник бара»', tests: [[1, 'Да: в смене Лена, Игорь, Света — их различают по имени.'], [1, 'Да: имя, телефон, график смен.'], [1, 'Да: в каждой покупке записано, кто продал.']] },
    drink: { t: 'протеиновый коктейль', v: 'ent', name: 'Сущность «Позиция меню»', tests: [[1, 'Да: в меню два десятка позиций — коктейли, кофе, вода.'], [1, 'Да: название, объём, цена в меню.'], [1, 'Да: покупка ссылается на то, что купили.']] },
    vol: { t: 'стакан 300 мл', v: 'attr', name: 'Атрибут позиции меню (объём)', tests: [[0, 'Нет: «300 мл» — число, его не различают как отдельный предмет.'], [0, 'Нет: у объёма нет своих свойств.'], [0, 'Нет: никто не ссылается на «300 мл».']] },
    price: { t: '290 ₽', v: 'attr', name: 'Атрибут — но чего? Позиции меню (цена сейчас) и покупки (сколько заплатили)', tests: [[0, 'Нет: это число, а не предмет.'], [0, 'Нет: у цены нет своих свойств.'], [0, 'Нет. Но цена описывает две разные вещи — откройте вкладку «Цена во времени».']] },
    sale: { t: 'покупку', v: 'ent', name: 'Сущность «Покупка»', tests: [[1, 'Да: сотни покупок в день, у каждой свой номер чека.'], [1, 'Да: время, сумма, кто продал, что купили.'], [1, 'Да: на покупку ссылается возврат.']] },
    time: { t: 'время', v: 'attr', name: 'Атрибут покупки', tests: [[0, 'Нет: время само по себе не предмет учёта.'], [0, 'Нет.'], [0, 'Нет: это черта покупки — когда её пробили.']] },
    queue: { t: 'очередь', v: 'none', name: 'Не храним', tests: [[0, 'Очередь есть, пока люди стоят. Через минуту её нет.'], [0, 'Нет.'], [0, 'Нет.']], why: 'Нечего помнить: очередь не нужна ни в отчёте, ни в споре с клиентом. Не всё, что есть в жизни, есть в модели.' }
  };
  const VERD = { ent: 'Сущность', attr: 'Атрибут', none: 'Не храним' };
  function entWords(el) {
    let cur = null; const seen = new Set();
    const w = id => `<button type="button" class="thd-word ${seen.has(id) ? WORDS[id].v : ''} ${cur === id ? 'cur' : ''}" data-wd="${id}">${esc(WORDS[id].t)}</button>`;
    el.innerHTML = `<div class="thd-legend"><span><span class="thd-word ent">синий</span> сущность</span><span><span class="thd-word attr">фиолетовый</span> атрибут</span><span><span class="thd-word none">серый</span> не храним</span></div><div data-ph></div><div data-card></div>`;
    function draw() {
      TR.$('[data-ph]', el).innerHTML = `<div class="thd-phrase">В баре клуба ${w('barista')} готовит ${w('drink')}: ${w('vol')} стоит ${w('price')}. Каждую ${w('sale')} пробивают по чеку, в чеке есть ${w('time')}. У стойки — ${w('queue')}.</div><div class="small dim tnum">Разобрано ${seen.size} из ${Object.keys(WORDS).length}. Нажимайте на подчёркнутые слова.</div>`;
      const x = cur && WORDS[cur];
      TR.$('[data-card]', el).innerHTML = x ? `<div class="card flat stack tight"><div class="row between"><b>«${esc(x.t)}»</b><span class="chip ${x.v === 'ent' ? 'info' : x.v === 'attr' ? '' : 'warn'}">${VERD[x.v]}</span></div>
        <ul class="thd-checks">${ENT_TESTS.map((q, i) => `<li class="${x.tests[i][0] ? 'ok' : ''}"><b>${esc(q)}</b> ${esc(x.tests[i][1])}</li>`).join('')}</ul>
        <div class="thd-cons ${x.v === 'ent' ? 'info' : x.v === 'attr' ? '' : 'warn'}">${esc(x.name)}.${x.why ? ' ' + esc(x.why) : x.v === 'ent' ? ' Три «да» — отдельный предмет учёта.' : ' Три «нет» — это черта чего-то другого.'}</div></div>` : '<div class="small muted">Для каждого слова — три вопроса. Три «да» — сущность. «Нет», но это черта чего-то — атрибут. Ни то ни другое и помнить незачем — не храним.</div>';
    }
    TR.on(el, 'click', '[data-wd]', (e, b) => { cur = b.dataset.wd; seen.add(cur); draw(); });
    draw();
  }
  const CARD_T = { '1': 'ровно один', '0..1': 'ноль или один', '1..N': 'один или много', '0..N': 'ноль или много' };
  function sym(card) {
    const c = 'var(--text-2)';
    const bar = d => `<line x1="${50 - d}" y1="5" x2="${50 - d}" y2="19" style="stroke:${c};stroke-width:1.6"/>`;
    const circ = d => `<circle cx="${50 - d}" cy="12" r="4.5" style="fill:var(--surface);stroke:${c};stroke-width:1.5"/>`;
    const crow = `<path d="M36 12 L50 4 M36 12 L50 12 M36 12 L50 20" style="stroke:${c};stroke-width:1.6;fill:none"/>`;
    const m = { '1': bar(7) + bar(13), '0..1': bar(7) + circ(19), '1..N': crow + bar(20), '0..N': crow + circ(23) }[card] || '';
    return `<svg class="thd-sym" width="64" height="24" viewBox="0 0 64 24" aria-hidden="true"><line x1="2" y1="12" x2="50" y2="12" style="stroke:${c};stroke-width:1.5"/>${m}<rect x="50" y="3" width="12" height="18" rx="3" style="fill:var(--surface-3);stroke:var(--border-strong)"/></svg>`;
  }
  const many = c => c === '1..N' || c === '0..N';
  function entRels(el) {
    const st = { inRoom: '0..N', rooms: '1' };
    const opts = Object.keys(CARD_T).map(v => ({ v, t: CARD_T[v] }));
    el.innerHTML = `<div class="thd-legend">${Object.keys(CARD_T).map(k => `<span>${sym(k)} ${esc(CARD_T[k])}</span>`).join('')}</div>
      <div class="small muted">Значок стоит у той сущности, <b>про количество которой</b> он говорит. Квадратик справа на значке — это сама сущность.</div>
      <div class="stack tight"><span class="small"><b>Сколько тренажёров может стоять в одном зале?</b> (значок у Тренажёра)</span>${ui.seg('inRoom', opts, st.inRoom)}</div>
      <div class="stack tight"><span class="small"><b>В скольких залах стоит один тренажёр?</b> (значок у Зала)</span>${ui.seg('rooms', opts, st.rooms)}</div>
      <div class="thd-er" data-er></div><div data-verd></div>`;
    const ents = [
      { id: 'room', t: 'Зал', x: 10, y: 20, w: 130, attrs: [{ n: 'название' }, { n: 'клуб' }] },
      { id: 'mach', t: 'Тренажёр', x: 250, y: 20, w: 130, attrs: [{ n: 'вид' }, { n: 'инв. номер' }] }
    ];
    const er = ui.er(TR.$('[data-er]', el), { entities: ents, rels: [], width: 390, height: 110, title: 'Зал и тренажёр' });
    function draw() {
      const a = st.rooms, b = st.inRoom;
      const kind = many(a) && many(b) ? 'M:N' : many(a) || many(b) ? '1:N' : '1:1';
      let k = 'ok', t;
      if (many(a)) { k = 'bad'; t = 'Одна беговая дорожка стоит сразу в нескольких залах? Так не бывает. А схема это разрешит — и отчёт «тренажёры по залам» посчитает дорожку дважды.'; }
      else if (!many(b)) { k = 'bad'; t = 'В зале не больше одного тренажёра? В тренажёрном зале их тридцать. Схема запретит поставить второй.'; }
      else if (a === '0..1') { k = 'warn'; t = 'Тренажёр может не стоять ни в одном зале — например, лежит на складе после ремонта. Если так бывает на самом деле, это честная необязательная связь: кружок.'; }
      else if (b === '1..N') { k = 'warn'; t = 'В каждом зале хотя бы один тренажёр. А зал для йоги, где тренажёров нет? Его тогда не завести. Обычно с этой стороны ставят «ноль или много».'; }
      else t = 'Так и есть в жизни: в зале ноль или много тренажёров, а каждый тренажёр стоит ровно в одном зале.';
      er.redraw({ rels: [{ a: 'room', b: 'mach', ca: a, cb: b, t: 'стоит в', tone: k === 'bad' ? 'bad' : '' }] });
      TR.$('[data-verd]', el).innerHTML = `<div class="small">Читаем от зала: тренажёров в одном зале — <b>${esc(CARD_T[b])}</b>. Читаем от тренажёра: залов, где он стоит, — <b>${esc(CARD_T[a])}</b>. Тип связи: <b>${kind}</b>.</div><div class="thd-cons ${k}">${t}</div>`;
    }
    ui.onSeg(el, (n, v) => { if (n === 'inRoom' || n === 'rooms') { st[n] = v; draw(); } });
    draw();
  }
  const MN_V = {
    client: { t: 'в Клиента', tone: 'bad',
      ents: [{ id: 'c', t: 'Клиент', x: 10, y: 10, w: 160, attrs: [{ n: 'имя' }, { n: 'время брони', tone: 'bad' }], tone: 'bad' }, { id: 'm', t: 'Тренажёр', x: 230, y: 10, w: 160, attrs: [{ n: 'вид' }, { n: 'инв. номер' }] }],
      rels: [{ a: 'c', b: 'm', ca: '0..N', cb: '0..N', tone: 'bad' }],
      table: () => xt(['Клиент', 'время брони'], [['Анна Смирнова', { h: '18:00 или 18:30?', c: 'cell-bad' }], ['Пётр Орлов', '19:00']]),
      cons: 'У Анны две брони — дорожка в 18:00 и велотренажёр в 18:30. Поле одно: вторая бронь затрёт первую.' },
    mach: { t: 'в Тренажёр', tone: 'bad',
      ents: [{ id: 'c', t: 'Клиент', x: 10, y: 10, w: 160, attrs: [{ n: 'имя' }, { n: 'телефон' }] }, { id: 'm', t: 'Тренажёр', x: 230, y: 10, w: 160, attrs: [{ n: 'вид' }, { n: 'время брони', tone: 'bad' }], tone: 'bad' }],
      rels: [{ a: 'c', b: 'm', ca: '0..N', cb: '0..N', tone: 'bad' }],
      table: () => xt(['Тренажёр', 'время брони'], [['Дорожка №7', { h: '18:00 — Анна? 19:00 — Пётр?', c: 'cell-bad' }], ['Велотренажёр №3', '18:30']]),
      cons: 'Дорожку №7 бронируют Анна в 18:00 и Пётр в 19:00. Поле одно на тренажёр — чья это бронь?' },
    list: { t: 'списком в ячейку', tone: 'bad',
      ents: [{ id: 'c', t: 'Клиент', x: 10, y: 10, w: 160, attrs: [{ n: 'имя' }, { n: 'телефон' }] }, { id: 'm', t: 'Тренажёр', x: 230, y: 10, w: 160, attrs: [{ n: 'вид' }, { n: 'брони: «Анна 18…»', tone: 'bad' }], tone: 'bad' }],
      rels: [],
      table: () => xt(['Тренажёр', 'брони'], [['Дорожка №7', { h: 'Анна 18:00; Пётр 19:00', c: 'cell-bad' }], ['Велотренажёр №3', { h: 'Анна 18:30', c: 'cell-bad' }]]),
      cons: 'Чтобы найти все брони Анны, надо прочитать списки всех тренажёров клуба. Проверить, что две брони не пересекаются, база не сможет: для неё это просто текст.' },
    assoc: { t: 'в отдельную сущность', tone: 'ok',
      ents: [{ id: 'c', t: 'Клиент', x: 10, y: 10, w: 160, attrs: [{ n: 'имя' }, { n: 'телефон' }] }, { id: 'm', t: 'Тренажёр', x: 230, y: 10, w: 160, attrs: [{ n: 'вид' }, { n: 'инв. номер' }] }, { id: 'b', t: 'Бронь тренажёра', x: 120, y: 120, w: 170, attrs: [{ n: 'с', tone: 'ok' }, { n: 'до', tone: 'ok' }], tone: 'ok' }],
      rels: [{ a: 'c', b: 'b', ca: '1', cb: '0..N' }, { a: 'm', b: 'b', ca: '1', cb: '0..N' }],
      table: () => xt(['Бронь', 'клиент', 'тренажёр', 'с', 'до'], [['1', 'Анна Смирнова', 'Дорожка №7', '18:00', '18:30'], ['2', 'Анна Смирнова', 'Велотренажёр №3', '18:30', '19:00'], ['3', 'Пётр Орлов', 'Дорожка №7', '19:00', '19:30']], () => 'ok'),
      cons: 'Каждая пара «клиент + тренажёр» со своим временем — отдельная строка. Одна связь «многие ко многим» превратилась в две связи «один ко многим»: у клиента много броней, у тренажёра много броней, а у брони — ровно один клиент и ровно один тренажёр.' }
  };
  function entMn(el) {
    let v = 'client';
    el.innerHTML = `<div class="small muted">Клиент бронирует тренажёры на полчаса. Анна — дорожку №7 в 18:00 и велотренажёр №3 в 18:30. Пётр — дорожку №7 в 19:00. Клиент бронирует много тренажёров, тренажёр бронируют многие клиенты: «многие ко многим». Куда записать <b>время брони</b>?</div>
      <div class="row"><span class="small dim">Положить время брони:</span>${ui.seg('mn', Object.keys(MN_V).map(k => ({ v: k, t: MN_V[k].t })), v, 'accent')}</div>
      <div class="thd-er" data-er></div><div data-t></div><div data-c></div>`;
    function draw() {
      const V = MN_V[v];
      ui.er(TR.$('[data-er]', el), { entities: V.ents, rels: V.rels, width: 400, height: v === 'assoc' ? 215 : 110, title: 'Клиент и тренажёр: где время брони' });
      TR.$('[data-t]', el).innerHTML = `<div class="code-cap">как это выглядит в данных</div>${V.table()}`;
      TR.$('[data-c]', el).innerHTML = `<div class="thd-cons ${V.tone}">${esc(V.cons)}</div>${v === 'assoc' ? '<div class="small muted">Правило на всю жизнь: если данные описывают <b>пару</b>, а не одного из двух, у пары должна быть своя сущность.</div>' : ''}`;
    }
    ui.onSeg(el, (n, x) => { if (n === 'mn') { v = x; draw(); } });
    draw();
  }
  const MON = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  const SALES = [{ d: '12 марта', m: 3, who: 'Анна Смирнова', qty: 1 }, { d: '20 мая', m: 5, who: 'Пётр Орлов', qty: 2 }, { d: '15 августа', m: 8, who: 'Анна Смирнова', qty: 1 }];
  const menuPrice = m => (m >= 6 ? 210 : 180);
  function entPrice(el) {
    const st = { now: 4, where: 'menu' };
    el.innerHTML = `<div class="small muted">Капучино в баре стоил 180 ₽, с 1 июня — 210 ₽. Двигайте «сегодня» по году и смотрите, что система расскажет о прошлых покупках.</div>
      <div class="row"><span class="small dim">Где хранится цена:</span>${ui.seg('where', [{ v: 'menu', t: 'только в меню' }, { v: 'both', t: 'в меню и в покупке' }], st.where, 'accent')}</div>
      <label class="field"><span>Сегодня: <b data-now></b> · цена в меню: <b data-mp></b></span><input type="range" class="thd-range" min="3" max="12" step="1" value="${st.now}" data-r aria-label="Какой сейчас месяц"></label>
      <div data-t></div><div data-c></div>`;
    function draw() {
      TR.$('[data-now]', el).textContent = MON[st.now - 1];
      TR.$('[data-mp]', el).textContent = menuPrice(st.now) + ' ₽';
      let wrong = 0;
      const rows = SALES.map(s => {
        if (s.m > st.now) return [esc(s.d), esc(s.who), s.qty + ' шт.', { h: '—', c: 'dim' }, { h: 'ещё не было', c: 'dim' }];
        const paid = s.qty * menuPrice(s.m), shown = st.where === 'both' ? paid : s.qty * menuPrice(st.now);
        if (shown !== paid) wrong++;
        return [esc(s.d), esc(s.who), s.qty + ' шт.', paid + ' ₽', { h: shown + ' ₽', c: shown !== paid ? 'cell-bad' : 'cell-ok' }];
      });
      TR.$('[data-t]', el).innerHTML = xt(['Когда', 'Кто', 'Сколько', 'Заплатили тогда', 'Система покажет сейчас'], rows);
      TR.$('[data-c]', el).innerHTML = wrong
        ? `<div class="thd-cons bad">Цена в меню выросла — и вместе с ней «выросли» прошлые покупки. Выручка за март и май задним числом стала больше, а Пётр по чеку платил 360 ₽, хотя система уверена, что 420 ₽. Цена в меню живёт в настоящем, а покупка — в прошлом.</div>`
        : st.where === 'both' && st.now >= 6
          ? '<div class="thd-cons ok">Меню подорожало, а прошлое не изменилось: в каждой покупке записано, сколько заплатили в тот день. Это не дубль: два поля законно расходятся.</div>'
          : '<div class="thd-cons">Пока цена в меню не менялась, оба способа показывают одно и то же. Сдвиньте «сегодня» дальше июня.</div>';
    }
    ui.onSeg(el, (n, v) => { if (n === 'where') { st.where = v; draw(); } });
    el.addEventListener('input', e => { if (e.target.matches('[data-r]')) { st.now = +e.target.value; draw(); } });
    draw();
  }
  const howEntities = {
    id: 'how-entities', covers: ['nouns', 'rels', 'mn', 'price'], title: 'Как это работает: сущности, атрибуты, связи', free: true, noReset: true,
    simple: {
      icon: '🧩', plain: 'Сущность — то, чего много и про что система помнит несколько вещей. Атрибут — одна черта сущности. Связь — как сущности относятся друг к другу и сколько их с каждой стороны.',
      analogy: 'Бар клуба. Позиции меню — сущность: их два десятка, у каждой название и цена. «300 мл» — атрибут: черта одной позиции. Очередь у стойки — ничего: она есть, пока люди стоят. А чек — отдельная сущность: в нём записано, сколько вы заплатили именно тогда.',
      tech: 'Концептуальная модель: сущности, атрибуты и связи без таблиц и типов. Кардинальность: 1:1, 1:N, M:N. На ER-диаграмме значок у сущности говорит, сколько её экземпляров приходится на один экземпляр с другого конца: черта — один, кружок — может не быть, «воронья лапка» — много. M:N с собственными данными разрешается отдельной (ассоциативной) сущностью.'
    },
    lead: ui.brief({
      situation: 'Перед доской сущностей «Пульса» разберём механику на соседнем примере — бар и тренажёрный зал клуба. Тех же слов, что будут на доске, здесь нет: только приёмы, которыми вы будете раскладывать доску.',
      todo: [
        '«Сущность или атрибут»: нажмите на каждое подчёркнутое слово во фразе и прочитайте три проверочных вопроса.',
        '«Связи и значки»: отвечайте на два вопроса про зал и тренажёр и смотрите, как меняются значки на концах линии. Найдите вариант, который совпадает с жизнью.',
        '«Многие ко многим»: попробуйте положить время брони в разные места и найдите то, где данные не путаются.',
        '«Цена во времени»: двигайте «сегодня» по году при двух способах хранить цену.'
      ],
      look: 'На ER-диаграмме прямоугольник — сущность, линия — связь. Значок на конце линии читается так: «у одного экземпляра с той стороны — столько вот этих». Красная линия или поле — так в жизни не бывает или данные сломаются; зелёное — всё на своём месте.'
    }),
    render(el) { tabs(el, [{ id: 'w', t: 'Сущность или атрибут', render: entWords }, { id: 'r', t: 'Связи и значки', render: entRels }, { id: 'mn', t: 'Многие ко многим', render: entMn }, { id: 'p', t: 'Цена во времени', render: entPrice }]); }
  };

  // =====================================================================
  // 4. logical: таблицы и ключи
  // =====================================================================
  const K_LOCK = [{ id: 1, club: 'Пульс Сокол', num: '117', zone: 'женская' }, { id: 2, club: 'Пульс Сокол', num: '118', zone: 'женская' }, { id: 3, club: 'Пульс Химки', num: '117', zone: 'мужская' }];
  const K_CLI = [{ id: 11, name: 'Анна Смирнова' }, { id: 12, name: 'Пётр Орлов' }, { id: 13, name: 'Дмитрий Ковалёв' }];
  const K_RENT = [{ id: 501, locker: 1, client: 11, from: '01.10', to: '31.10' }, { id: 502, locker: 3, client: 12, from: '01.10', to: '31.12' }, { id: 503, locker: 2, client: 13, from: '15.09', to: '14.10' }];
  const K_COLS = [
    { id: 'zone', t: 'раздевалка: мужская или женская', tb: 'locker', why: 'Это черта самого шкафчика: он стоит в своей раздевалке, кто бы его ни арендовал.' },
    { id: 'from', t: 'дата начала аренды', tb: 'locker_rental', why: 'Это про конкретную аренду. У одного шкафчика за год десяток аренд, у каждой свои даты.' },
    { id: 'name', t: 'имя клиента', tb: 'client', why: 'Это про человека. В аренде лежит только ссылка client_id, а имя — один раз в карточке клиента.' },
    { id: 'paid', t: 'сколько заплатили за месяц аренды', tb: 'locker_rental', why: 'Цена сделки — в аренде. Прайс может подорожать, а эта аренда — нет.' },
    { id: 'num', t: 'номер на дверце (117)', tb: 'locker', why: 'Черта шкафчика. Уникален только вместе с клубом: №117 есть и в Соколе, и в Химках.' }
  ];
  const K_TB = { locker: 'locker (шкафчик)', locker_rental: 'locker_rental (аренда)', client: 'client (клиент)' };
  function keysCols(el) {
    const val = {};
    el.innerHTML = `<p class="small muted">Каждый столбец живёт в той таблице, <b>про что</b> он рассказывает. Спросите себя: это про шкафчик, про человека или про конкретную аренду?</p><div class="stack tight" data-c></div><div class="thd-tbls" data-t></div>`;
    function draw() {
      TR.$('[data-c]', el).innerHTML = K_COLS.map(c => {
        const v = val[c.id], ok = v === c.tb;
        return `<div class="card flat thd-pick"><b>${esc(c.t)}</b><div class="row">${Object.keys(K_TB).map(k => `<button type="button" class="btn xs" data-kc="${c.id}:${k}" aria-pressed="${v === k}"><span class="mono">${esc(k)}</span></button>`).join('')}</div>${v ? `<div class="thd-cons ${ok ? 'ok' : 'bad'}">${ok ? 'Да. ' : 'Не сюда. '}${esc(c.why)}</div>` : ''}</div>`;
      }).join('');
      TR.$('[data-t]', el).innerHTML = Object.keys(K_TB).map(k => {
        const base = { locker: ['id PK', 'club_id FK'], locker_rental: ['id PK', 'locker_id FK', 'client_id FK'], client: ['id PK', 'phone UK'] }[k];
        const mine = K_COLS.filter(c => val[c.id] === k);
        return `<div class="card flat stack tight"><div class="thd-cap">${esc(K_TB[k])}</div><div class="small mono">${base.map(esc).join('<br>')}${mine.map(c => `<br><span style="color:${c.tb === k ? 'var(--ok)' : 'var(--bad)'}">+ ${esc(c.t)}</span>`).join('')}</div></div>`;
      }).join('');
    }
    TR.on(el, 'click', '[data-kc]', (e, b) => { const [id, k] = b.dataset.kc.split(':'); val[id] = k; draw(); });
    draw();
  }
  function keysFk(el) {
    let st;
    const reset = () => { st = { fk: st ? st.fk : 'on', uk: st ? st.uk : 'on', lockers: TR.clone(K_LOCK), rentals: TR.clone(K_RENT), sel: null, msg: '' }; };
    reset();
    el.innerHTML = `<div class="small muted">Три маленькие таблицы. В аренде вместо шкафчика и клиента лежат их номера — это внешние ключи (FK). <b>Нажмите на число в колонках locker_id или client_id</b> — подсветится строка, на которую оно ссылается.</div>
      <div data-tb></div><div data-msg></div>
      <div class="eyebrow">Эксперименты</div>
      <div class="row"><span class="small dim">Внешний ключ <code>locker_id → locker</code>:</span>${ui.seg('fk', [{ v: 'on', t: 'есть' }, { v: 'off', t: 'нет' }], st.fk, 'accent')}</div>
      <div class="row"><span class="small dim">Уникальный ключ <code>locker (club, number)</code>:</span>${ui.seg('uk', [{ v: 'on', t: 'есть' }, { v: 'off', t: 'нет' }], st.uk, 'accent')}</div>
      <div class="thd-btns"><button type="button" class="btn sm" data-kx="del">Удалить шкафчик id = 1</button><button type="button" class="btn sm" data-kx="ghost">Записать аренду на шкафчик id = 99</button><button type="button" class="btn sm" data-kx="dup">Добавить ещё один №117 в «Пульс Сокол»</button><button type="button" class="btn sm ghost" data-kx="reset">⟲ Как было</button></div>`;
    function draw() {
      const has = id => st.lockers.some(l => l.id === id);
      const sel = st.sel; // {t:'locker'|'client', id, from}
      const dupKey = l => st.lockers.filter(x => x.club === l.club && x.num === l.num).length > 1;
      const lockRows = st.lockers.map(l => [{ h: l.id, c: 'mono' }, esc(l.club), { h: l.num, c: dupKey(l) ? 'cell-bad' : '' }, esc(l.zone)]);
      const cliRows = K_CLI.map(c => [{ h: c.id, c: 'mono' }, esc(c.name)]);
      const rentRows = st.rentals.map(r => [{ h: r.id, c: 'mono' }, { h: r.locker, c: 'click mono ' + (!has(r.locker) ? 'cell-bad' : sel && sel.from === r.id && sel.t === 'locker' ? 'cell-hl' : ''), a: `data-fk="locker:${r.locker}:${r.id}" title="Куда ссылается?"` }, { h: r.client, c: 'click mono ' + (sel && sel.from === r.id && sel.t === 'client' ? 'cell-hl' : ''), a: `data-fk="client:${r.client}:${r.id}" title="Куда ссылается?"` }, r.from, r.to]);
      TR.$('[data-tb]', el).innerHTML = `<div class="thd-tbls">
        <div><div class="thd-cap">locker — шкафчики</div>${xt(['id PK', 'club', 'number', 'zone'], lockRows, (r, i) => sel && sel.t === 'locker' && st.lockers[i].id === sel.id ? 'ok' : '')}</div>
        <div><div class="thd-cap">client — клиенты</div>${xt(['id PK', 'full_name'], cliRows, (r, i) => sel && sel.t === 'client' && K_CLI[i].id === sel.id ? 'ok' : '')}</div></div>
        <div><div class="thd-cap">locker_rental — аренды</div>${xt(['id PK', 'locker_id FK', 'client_id FK', 'с', 'по'], rentRows)}</div>`;
      TR.$('[data-msg]', el).innerHTML = st.msg;
    }
    TR.on(el, 'click', '[data-fk]', (e, td) => {
      const [t, id, from] = td.dataset.fk.split(':');
      st.sel = { t, id: +id, from: +from };
      if (t === 'locker') {
        const l = st.lockers.find(x => x.id === +id);
        st.msg = l ? ui.note('', 'Куда ведёт ссылка', `Аренда ${from} → <code>locker_id = ${id}</code> → шкафчик №${esc(l.num)}, «${esc(l.club)}». Внешний ключ — это просто номер чужой строки. Имя клуба и номер на дверце в аренде не повторяются.`) : ui.note('bad', 'Ссылка в пустоту', `Аренда ${from} ссылается на шкафчик id = ${id}, а такой строки нет. Клиент приходит с браслетом — какой шкафчик ему открыть?`);
      } else {
        const c = K_CLI.find(x => x.id === +id);
        st.msg = ui.note('', 'Куда ведёт ссылка', `Аренда ${from} → <code>client_id = ${id}</code> → ${esc(c ? c.name : '?')}. Сменит Анна телефон — поменяется одна строка в <code>client</code>, а все её аренды увидят новый номер.`);
      }
      draw();
    });
    TR.on(el, 'click', '[data-kx]', (e, b) => {
      const a = b.dataset.kx; st.sel = null;
      if (a === 'reset') { reset(); }
      if (a === 'del') {
        if (!st.lockers.some(l => l.id === 1)) st.msg = ui.note('', 'Уже удалён', 'Шкафчика id = 1 уже нет. Нажмите «Как было».');
        else if (st.fk === 'on') st.msg = errBox('ERROR:  update or delete on table "locker" violates foreign key constraint "locker_rental_locker_id_fkey" on table "locker_rental"\nDETAIL:  Key (id)=(1) is still referenced from table "locker_rental".', 'База не дала удалить', 'На шкафчик ссылается аренда Анны. Внешний ключ охраняет обе стороны: нельзя сослаться на несуществующее и нельзя удалить то, на что ссылаются. Что делать с такими ссылками при удалении — решает правило ON DELETE, его разберём в физической модели.');
        else { st.lockers = st.lockers.filter(l => l.id !== 1); st.msg = ui.note('bad', 'Удалено — и ссылка повисла', 'Строки шкафчика нет, а аренда 501 всё ещё ссылается на id = 1 (красная ячейка). Анна приходит с браслетом, а шкафчика «не существует».'); }
      }
      if (a === 'ghost') {
        if (st.fk === 'on') st.msg = errBox('ERROR:  insert or update on table "locker_rental" violates foreign key constraint "locker_rental_locker_id_fkey"\nDETAIL:  Key (locker_id)=(99) is not present in table "locker".', 'База не пустила', 'Шкафчика 99 нет — значит, и аренды на него быть не может.');
        else if (st.rentals.some(r => r.id === 504)) st.msg = ui.note('', 'Уже добавлено', 'Аренда на шкафчик 99 уже в таблице. Нажмите «Как было».');
        else { st.rentals.push({ id: 504, locker: 99, client: 12, from: '12.10', to: '11.11' }); st.msg = ui.note('bad', 'Принято — а шкафчика нет', 'Пётр заплатил за аренду шкафчика 99, которого не существует. Без внешнего ключа база проверяет только, что это число.'); }
      }
      if (a === 'dup') {
        if (st.uk === 'on') st.msg = errBox('ERROR:  duplicate key value violates unique constraint "locker_club_number_key"\nDETAIL:  Key (club, number)=(Пульс Сокол, 117) already exists.', 'База не пустила', 'Номер на дверце уникален внутри клуба. Поэтому номер — уникальный ключ (UK) вместе с клубом, а первичный ключ — внутренний id: №117 есть и в Химках.');
        else if (st.lockers.some(l => l.id === 4)) st.msg = ui.note('', 'Уже добавлено', 'Второй №117 уже есть. Нажмите «Как было».');
        else { st.lockers.push({ id: 4, club: 'Пульс Сокол', num: '117', zone: 'мужская' }); st.msg = ui.note('bad', 'Принято — два №117 в Соколе', 'Администратор говорит «ваш — сто семнадцатый», и клиент идёт не в ту раздевалку. По номеру на дверце шкафчик больше не найти однозначно.'); }
      }
      draw();
    });
    ui.onSeg(el, (n, v) => { if (n === 'fk' || n === 'uk') { st[n] = v; st.msg = ui.note('', 'Настройка изменена', `${n === 'fk' ? 'Внешний ключ' : 'Уникальный ключ'} ${v === 'on' ? 'включён' : 'выключен'}. Попробуйте эксперименты ещё раз.`); draw(); } });
    draw();
  }
  const RATES = [10, 100, 1000, 10000, 100000];
  function sci(x) { const e = Math.floor(Math.log10(x)), m = x / Math.pow(10, e); return `${m.toFixed(1).replace('.', ',')}·10<sup>${e}</sup>`; }
  function keysPub(el) {
    const st = { mode: 'seq', rate: 2, own: 'off', leak: false };
    el.innerHTML = `<div class="small muted">Пётр открыл в приложении свою аренду шкафчика. Номер аренды виден в адресе. Что будет, если поменять номер в адресе руками?</div>
      <div class="row"><span class="small dim">В адресе:</span>${ui.seg('mode', [{ v: 'seq', t: 'порядковый номер' }, { v: 'uuid', t: 'uuid' }], st.mode, 'accent')}</div>
      <label class="field"><span>Злоумышленник шлёт запросов в секунду: <b data-rv></b></span><input type="range" class="thd-range" min="0" max="4" step="1" value="${st.rate}" data-r aria-label="Запросов в секунду"></label>
      <div data-o></div>
      <div class="eyebrow">А если адрес всё-таки утёк?</div>
      <div class="row"><span class="small dim">Сервер проверяет, чья аренда:</span>${ui.seg('own', [{ v: 'off', t: 'нет' }, { v: 'on', t: 'да' }], st.own, 'accent')}<button type="button" class="btn sm" data-leak>Пётр выложил скриншот со ссылкой в чат</button></div>
      <div data-l></div>`;
    function draw() {
      const rate = RATES[st.rate];
      TR.$('[data-rv]', el).textContent = nf(rate);
      const my = st.mode === 'seq' ? '/v1/locker-rentals/502' : '/v1/locker-rentals/9f1c2e7a-4b3d-4c8e-a1f0-7d2b5e9c3a61';
      let calc;
      if (st.mode === 'seq') calc = `<div class="thd-calc"><div class="ln"><span>Адрес Петра</span><b>${esc(my)}</b></div><div class="ln"><span>Соседи: 501 и 503 — угадываются с первой попытки</span><b>1–2 запроса</b></div><div class="ln tot"><span>Время, чтобы открыть чужую аренду</span><b>${rate >= 10 ? 'меньше секунды' : '—'}</b></div></div><div class="thd-cons bad">Порядковый номер — как номера квартир в подъезде: зная свой, знаешь и соседние. Перебрать 10 000 аренд — минута работы скрипта.</div>`;
      else {
        const combos = Math.pow(2, 122), years = combos / 2 / rate / 31557600;
        calc = `<div class="thd-calc"><div class="ln"><span>Адрес Петра</span><b style="white-space:normal;word-break:break-all">${esc(my)}</b></div><div class="ln"><span>Вариантов uuid (122 случайных бита)</span><b>${sci(combos)}</b></div><div class="ln tot"><span>В среднем, чтобы наткнуться на чужую аренду</span><b>${sci(years)} лет</b></div></div><div class="thd-cons ok">Для сравнения: Вселенной около 1,4·10<sup>10</sup> лет. Угадать uuid перебором нельзя — соседних номеров у него нет.</div>`;
      }
      TR.$('[data-o]', el).innerHTML = calc;
      TR.$('[data-l]', el).innerHTML = st.leak ? (st.own === 'on'
        ? ui.note('ok', 'Сервер проверил владельца', `Чужой человек открыл ссылку из чата → сервер видит, что аренда принадлежит Петру, а токен — не Петра → <code>404</code>. Ссылка утекла, но толку от неё нет.`)
        : ui.note('bad', 'Чужая аренда открылась', `Чужой человек открыл ссылку из чата → <code>200</code>: имя Петра, номер шкафчика, даты. ${st.mode === 'uuid' ? 'uuid не помог: его не угадали, его просто увидели.' : 'А с порядковым номером и скриншот не нужен.'} uuid мешает перебору, но права проверяет только сервер.`)) : '';
    }
    ui.onSeg(el, (n, v) => { if (n === 'mode' || n === 'own') { st[n] = v; draw(); } });
    el.addEventListener('input', e => { if (e.target.matches('[data-r]')) { st.rate = +e.target.value; draw(); } });
    TR.on(el, 'click', '[data-leak]', () => { st.leak = true; draw(); });
    draw();
  }
  const ARC_V = {
    two: { t: 'два столбца, без проверки', sql: 'client_id  bigint REFERENCES client,\ntrainer_id bigint REFERENCES trainer' },
    check: { t: 'два столбца + CHECK', sql: 'client_id  bigint REFERENCES client,\ntrainer_id bigint REFERENCES trainer,\nCHECK (num_nonnulls(client_id, trainer_id) = 1)  -- ровно один' },
    poly: { t: 'owner_id + owner_type', sql: "owner_id   bigint NOT NULL,  -- номер «кого-то»\nowner_type text   NOT NULL   -- 'client' или 'trainer'\n-- внешний ключ не объявить: столбец смотрит то в одну таблицу, то в другую" }
  };
  const ARC_A = ['Аренда клиенту Анне (client_id = 11)', 'Аренда тренеру Марии Лис (trainer_id = 7)', 'Ни клиента, ни тренера', 'И клиент 11, и тренер 7 сразу', 'Тренер 999 — такого нет'];
  const ARC_R = {
    two: [['принято', 1], ['принято', 1], ['принято — шкафчик «ничей»', 0], ['принято — у шкафчика два хозяина', 0], ['ошибка внешнего ключа: тренера 999 нет', 1]],
    check: [['принято', 1], ['принято', 1], ['ошибка CHECK: нужен ровно один хозяин', 1], ['ошибка CHECK: нужен ровно один хозяин', 1], ['ошибка внешнего ключа: тренера 999 нет', 1]],
    poly: [['принято', 1], ['принято', 1], ['ошибка NOT NULL', 1], ['не записать: столбец всего один', 1], ['принято — ссылка в пустоту', 0]]
  };
  function keysArc(el) {
    let v = 'two';
    el.innerHTML = `<div class="small muted">Шкафчик в аренде либо у клиента, либо у тренера — <b>строго у одного</b>. Ничей или сразу двоих — ошибка. Такое правило «одно из двух, но ровно одно» называют исключающей дугой. Переключайте устройство таблицы и смотрите, что пропустит база.</div>
      <div class="row"><span class="small dim">Как устроить:</span>${ui.seg('arc', Object.keys(ARC_V).map(k => ({ v: k, t: ARC_V[k].t })), v, 'accent')}</div><div data-o></div>`;
    function draw() {
      const R = ARC_R[v], bad = R.filter(r => !r[1]).length;
      TR.$('[data-o]', el).innerHTML = `${W(ui.code(ARC_V[v].sql, 'sql', 'locker_rental — кто хозяин'))}
        ${xt(['Попытка', 'Что сделает база'], ARC_A.map((a, i) => [esc(a), esc(R[i][0])]), (r, i) => R[i][1] ? 'ok' : 'bad')}
        <div class="thd-cons ${bad ? 'bad' : 'ok'}">${bad ? `База пропустила ${bad} ${TR.plural(bad, 'ошибку', 'ошибки', 'ошибок')}. Их придётся ловить в коде — и однажды не поймать.` : 'Все пять попыток обработаны верно, и всё — силами самой базы.'}${v === 'poly' ? ' Красная строка — главная беда этого способа: база не знает, в какую таблицу смотрит owner_id, и не может проверить, что хозяин существует.' : ''}</div>`;
    }
    ui.onSeg(el, (n, x) => { if (n === 'arc') { v = x; draw(); } });
    draw();
  }
  const howKeys = {
    id: 'how-keys', covers: ['tables', 'keys', 'arc'], title: 'Как это работает: таблицы и ключи', free: true, noReset: true,
    simple: {
      icon: '🔑', plain: 'Таблица — журнал про что-то одно. Первичный ключ — номер строки, по которому её находят однозначно. Внешний ключ — номер строки из другой таблицы: ссылка. Уникальный ключ — запрет на повторы.',
      analogy: 'Номер шкафчика в журнале раздевалки — первичный ключ. Номерок на браслете клиента указывает на шкафчик — внешний ключ: браслет на несуществующий шкафчик не выдадут. Номер на дверце (117) повторяется в разных клубах, поэтому уникален только вместе с клубом.',
      tech: 'PK — уникальный непустой идентификатор строки. FK — столбец, значения которого обязаны существовать в ключе другой таблицы; он же не даёт удалить строку, на которую ссылаются. UK — UNIQUE на столбец или набор столбцов. Наружу в адресах отдают непредсказуемый uuid, а внутри ссылаются компактным bigint. Исключающая дуга — несколько необязательных FK и CHECK «ровно один заполнен».'
    },
    lead: ui.brief({
      situation: 'Вчерашняя доска превращается в таблицы. Механику ключей разберём на шкафчиках: <code>locker</code> — шкафчики, <code>client</code> — клиенты, <code>locker_rental</code> — аренды шкафчиков. Таблиц «Пульса» здесь нет — их вы будете раскладывать сами.',
      todo: [
        '«Чей столбец»: для каждого столбца выберите таблицу и прочитайте, почему.',
        '«Ссылки (FK)»: нажимайте на числа в аренде — подсвечивается строка, на которую они ссылаются. Затем выключайте и включайте ключи и проводите эксперименты.',
        '«Номер наружу»: сравните порядковый номер и uuid в адресе, затем «слейте» ссылку в чат с проверкой владельца и без неё.',
        '«Одно из двух»: переключайте три способа устроить «хозяина» шкафчика и считайте красные строки.'
      ],
      look: 'PK — первичный ключ, FK — внешний, UK — уникальный. Подсвеченная строка — та, на которую указывает выбранная ссылка. Красная ячейка — ссылка в пустоту или повтор там, где его быть не должно. Зелёная плашка с текстом ошибки — база сама не пустила плохие данные.'
    }),
    render(el) { tabs(el, [{ id: 'c', t: 'Чей столбец', render: keysCols }, { id: 'fk', t: 'Ссылки (FK)', render: keysFk }, { id: 'pub', t: 'Номер наружу', render: keysPub }, { id: 'arc', t: 'Одно из двух', render: keysArc }]); }
  };

  // =====================================================================
  // 5. logical: время с поясом и деньги в копейках
  // =====================================================================
  const TZ = [{ t: 'Сервер в облаке', z: 'UTC', off: 0 }, { t: 'Пульс Сокол, Москва', z: 'Europe/Moscow', off: 3 }, { t: 'Клуб в Екатеринбурге', z: 'Asia/Yekaterinburg', off: 5 }];
  function tmClock(el) {
    let h = 14;
    el.innerHTML = `<div class="small muted">Двигайте ползунок — это один момент времени для всего мира. Смотрите, что в этот момент показывают часы в разных местах.</div>
      <label class="field"><span>Момент в базе: <b data-iso></b></span><input type="range" class="thd-range" min="0" max="47" step="1" value="${h}" data-r aria-label="Момент времени"></label>
      <div class="thd-clocks" data-c></div><div data-n></div>`;
    function draw() {
      const base = Date.UTC(2026, 9, 12, 12, 0) + h * 1800000;
      const f = off => { const d = new Date(base + off * 3600000); return { tm: pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()), dt: pad(d.getUTCDate()) + '.' + pad(d.getUTCMonth() + 1) + '.2026', day: d.getUTCDate() }; };
      const u = f(0);
      TR.$('[data-iso]', el).textContent = `2026-${u.dt.slice(3, 5)}-${u.dt.slice(0, 2)} ${u.tm}:00+00`;
      const cl = TZ.map(z => ({ z, v: f(z.off) }));
      TR.$('[data-c]', el).innerHTML = cl.map(({ z, v }) => `<div class="thd-clock ${v.day !== u.day ? 'next' : ''}"><span class="small">${esc(z.t)}</span><span class="tm">${v.tm}</span><span class="dt">${v.dt}</span><span class="small dim mono">${esc(z.z)} · UTC+${z.off}</span></div>`).join('');
      const days = new Set(cl.map(c => c.v.day));
      TR.$('[data-n]', el).innerHTML = `<div class="thd-cons ${days.size > 1 ? 'warn' : 'info'}">В базе лежит одно число — момент. «Сколько на часах» получается переводом момента в пояс места.${days.size > 1 ? ' <b>Смотрите на даты:</b> в одном месте уже 13 октября, в другом ещё 12-е. Один и тот же момент может попасть в разные сутки — это важно для всего, что считается «за день».' : ' Подвиньте ползунок к вечеру — посмотрите на даты.'}</div>`;
    }
    el.addEventListener('input', e => { if (e.target.matches('[data-r]')) { h = +e.target.value; draw(); } });
    draw();
  }
  function tmNaive(el) {
    const st = { store: 'naive', srv: 'utc' };
    el.innerHTML = `<div class="small muted">Администратор клуба в Екатеринбурге ставит в расписание «Стретчинг, 13 октября, 08:00» — по местному времени. За 2 часа до начала сервер шлёт записанным пуш «скоро стретчинг». Анна живёт в Москве и смотрит расписание этого клуба в приложении.</div>
      <div class="row"><span class="small dim">Как хранится начало:</span>${ui.seg('store', [{ v: 'naive', t: 'время без пояса' }, { v: 'tz', t: 'момент с поясом' }], st.store, 'accent')}</div>
      <div class="row"><span class="small dim">Где сервер:</span>${ui.seg('srv', [{ v: 'utc', t: 'в облаке, UTC' }, { v: 'msk', t: 'в Москве' }], st.srv, 'accent')}</div>
      <div data-o></div>`;
    function draw() {
      const so = st.srv === 'utc' ? 0 : 3, tz = st.store === 'tz';
      const startUtc = tz ? 3 : 8 - so; // истинное начало: 08:00 Екб = 03:00 UTC
      const loc = x => pad(((x + 5) % 24 + 24) % 24) + ':00';
      const push = startUtc - 2, shownEkb = startUtc + 5;
      const ok = startUtc === 3;
      const rows = [
        ['Что лежит в базе', `<span class="mono">${tz ? '2026-10-13 08:00:00+05' : '2026-10-13 08:00:00'}</span>${tz ? '' : ' <span class="small dim">(какой это пояс — неизвестно)</span>'}`],
        ['Как это понял сервер', `<span class="mono">${pad(startUtc)}:00 UTC</span>${tz ? ' — верно' : st.srv === 'utc' ? ' — прочитал «08:00» в своём поясе, UTC' : ' — прочитал «08:00» как московское'}`],
        ['Пуш «через 2 часа стретчинг» придёт в', `${loc(push)} по Екатеринбургу${ok ? ' — за 2 часа до начала' : push + 5 >= 9 ? ' — занятие уже закончилось' : ' — занятие уже начинается'}`],
        ['Анна в Москве увидит начало', `${loc(startUtc)} <span class="small dim">(время клуба)</span>`]
      ];
      TR.$('[data-o]', el).innerHTML = `${xt(['', 'Результат'], rows, (r, i) => i === 0 ? '' : ok ? 'ok' : 'bad')}
        <div class="thd-cons ${ok ? 'ok' : 'bad'}">${ok ? 'Момент один для всех: сервер где угодно, телефон где угодно — пуш приходит вовремя, а расписание показывается по времени клуба. Пояс клуба нужен только для перевода в «сколько на часах».' : `Ошибка на ${shownEkb - 8} ${TR.plural(shownEkb - 8, 'час', 'часа', 'часов')}. Строка «08:00» без пояса — это не момент, а цифры на чьих-то часах. Сервер подставил свой пояс — и всё расписание клуба съехало. На тестовом стенде в Москве такую ошибку часто не видно.`}</div>`;
    }
    ui.onSeg(el, (n, v) => { if (n === 'store' || n === 'srv') { st[n] = v; draw(); } });
    draw();
  }
  function tmMoney(el) {
    const st = { price: '89,90', n: '10' };
    el.innerHTML = `<div class="small muted">Бар продаёт протеиновый батончик. Вечером продажи выгружаются в 1С, и сумма должна сойтись с банком до копейки. Сравним два способа считать.</div>
      <div class="thd-inputs"><label class="field"><span>Цена, ₽</span><input type="text" inputmode="decimal" class="mono" value="${st.price}" data-p maxlength="10"></label>
        <div class="field"><span>Сколько продаж</span>${ui.seg('n', [{ v: '3', t: '3' }, { v: '10', t: '10' }, { v: '100', t: '100' }, { v: '1000', t: '1000' }], st.n, 'accent')}</div></div>
      <div data-o></div>
      <div class="row"><button type="button" class="btn sm" data-z>Классика: 0,1 + 0,2</button><span class="small mono" data-zr></span></div>`;
    function draw() {
      const p = Number(String(st.price).replace(/\s/g, '').replace(',', '.')), n = +st.n;
      if (!isFinite(p) || p <= 0 || p > 1e6) { TR.$('[data-o]', el).innerHTML = '<div class="thd-cons warn">Введите цену числом, например 89,90.</div>'; return; }
      const kop = Math.round(p * 100);
      let s = 0; for (let i = 0; i < n; i++) s += p;
      const cut = Math.floor(s * 100), ok = cut === kop * n;
      const rub = k => (k / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽';
      TR.$('[data-o]', el).innerHTML = `<div class="thd-calc">
          <div class="ln"><span>Как <code>float</code> на самом деле хранит ${esc(st.price)}</span><b>${esc(p.toPrecision(20))}</b></div>
          <div class="ln"><span>Сложили ${n} раз во <code>float</code></span><b>${esc(String(s))}</b></div>
          <div class="ln"><span>Обрезали до копеек для выгрузки в 1С</span><b style="color:${ok ? 'var(--ok)' : 'var(--bad)'}">${rub(cut)}</b></div>
          <div class="ln tot"><span>В копейках (<code>bigint</code>): ${n} × ${kop}</span><b>${rub(kop * n)}</b></div></div>
        <div class="thd-cons ${ok ? (String(s).length > 12 ? 'warn' : 'ok') : 'bad'}">${ok ? (String(s).length > 12 ? 'Пока сошлось, но число уже «кривое»: хвост ошибки есть и копится. Переключите на 10 или 100 продаж.' : 'Сошлось.') : `Не сошлось на ${rub(kop * n - cut)}. Компьютер хранит дробь в двоичном виде, а ${esc(st.price)} в двоичном виде бесконечна — как 1/3 в десятичном. Каждое сложение добавляет крошечную ошибку, обрезка её «проявляет». В копейках ошибки нет: целые числа складываются точно.`}</div>`;
    }
    el.addEventListener('input', e => { if (e.target.matches('[data-p]')) { st.price = e.target.value; draw(); } });
    ui.onSeg(el, (n, v) => { if (n === 'n') { st.n = v; draw(); } });
    TR.on(el, 'click', '[data-z]', () => { TR.$('[data-zr]', el).textContent = `0.1 + 0.2 = ${0.1 + 0.2}`; });
    draw();
  }
  const howTimeMoney = {
    id: 'how-timemoney', covers: ['timemoney'], title: 'Как это работает: время с поясом и деньги в копейках', free: true, noReset: true,
    simple: {
      icon: '🕘', plain: 'Время храним как момент, одинаковый для всего мира, а «08:00» получаем переводом в пояс места. Деньги храним целыми копейками.',
      analogy: 'Созвон «в девять» без города: кто-то придёт на два часа раньше. Поэтому пишут «09:00 по Екатеринбургу». С деньгами — как на кассе: монеты считают поштучно, а не «примерно треть рубля».',
      tech: '<code>timestamptz</code> хранит момент (внутри — в UTC) и переводит его в нужный пояс при выводе. Пояс места — имя из базы IANA (<code>Asia/Yekaterinburg</code>), а не «+5». <code>timestamp</code> без пояса хранит «цифры на часах» — какой это пояс, база не знает. Деньги — <code>bigint</code> в копейках или <code>numeric</code>; <code>float</code> хранит двоичное приближение и копит ошибку.'
    },
    lead: ui.brief({
      situation: 'Через год у «Пульса» клубы в других часовых поясах, а сервер может жить в облаке по UTC — мировому времени. Деньги уходят в 1С, и бухгалтерия сверяет их с банком до копейки. Разберём обе ловушки на соседних примерах: стретчинг в Екатеринбурге и батончики в баре.',
      todo: [
        '«Один момент — разные часы»: двигайте ползунок и смотрите на часы и даты в трёх местах.',
        '«Время без пояса»: переключайте способ хранения и место сервера. Когда придёт пуш и что увидит Анна?',
        '«Деньги»: меняйте цену и число продаж. Найдите, когда сумма во float перестаёт сходиться, и нажмите «0,1 + 0,2».'
      ],
      look: 'Часы с жёлтой датой — там уже наступили другие сутки. В таблицах зелёная строка — всё совпало с жизнью, красная — система ошиблась. В расчёте денег сравнивайте две последние строки: обрезанную сумму float и точную сумму в копейках.'
    }),
    render(el) { tabs(el, [{ id: 'clock', t: 'Один момент — разные часы', render: tmClock }, { id: 'naive', t: 'Время без пояса', render: tmNaive }, { id: 'money', t: 'Деньги', render: tmMoney }]); }
  };

  // =====================================================================
  // 6. normal: нормальные формы по шагам
  // =====================================================================
  // журнал персональных тренировок; ключ строки — тренер + начало (тренер не бывает в двух местах сразу)
  const PT_C = ['начало', 'клиент', 'телефоны клиента', 'тренер', 'телефон тренера', 'клуб', 'адрес клуба', 'цена, ₽'];
  const PT_R = [
    ['12.10 18:00', 'Анна Смирнова', '+7 916 111-22-33', 'Мария Лис', '+7 926 777-02-02', 'Пульс Сокол', 'Ленинградский пр., 74', '3 000'],
    ['12.10 19:00', 'Пётр Орлов', '+7 925 222-33-44; +7 499 123-45-67', 'Мария Лис', '+7 926 777-02-02', 'Пульс Сокол', 'Ленинградский пр., 74', '3 000'],
    ['13.10 10:00', 'Анна Смирнова', '+7 916 111-22-33', 'Олег Шин', '+7 916 888-03-03', 'Пульс Химки', 'ул. Ленина, 1', '2 500'],
    ['14.10 08:00', 'Дмитрий Ковалёв', '+7 926 444-55-66', 'Мария Лис', '+7 926 777-02-02', 'Пульс Химки', 'ул. Ленина, 1', '3 000']
  ];
  const T_PHONES = () => xt(['клиент', 'телефон'], [['Анна Смирнова', '+7 916 111-22-33'], ['Пётр Орлов', '+7 925 222-33-44'], ['Пётр Орлов', '+7 499 123-45-67'], ['Дмитрий Ковалёв', '+7 926 444-55-66']], () => 'ok');
  const T_TRAINER = () => xt(['тренер', 'телефон'], [['Мария Лис', '+7 926 777-02-02'], ['Олег Шин', '+7 916 888-03-03']], () => 'ok');
  const T_CLUB = () => xt(['клуб', 'адрес'], [['Пульс Сокол', 'Ленинградский пр., 74'], ['Пульс Химки', 'ул. Ленина, 1']], () => 'ok');
  const NF = [
    { t: 'Плоская', drop: [], hl: null, cut: [], note: 'Журнал персональных тренировок — так его вёл бы администратор в Excel. <b>Ключ строки — тренер + начало</b>: тренер не бывает в двух местах сразу, поэтому эта пара определяет тренировку однозначно. Посмотрите, сколько раз повторяются телефон Марии Лис и адрес Химок. Нажмите «Следующий шаг».' },
    { t: '1НФ', drop: [], hl: 2, bad: [[1, 2]], cut: [['Телефоны клиента', T_PHONES]], note: '<b>Правило 1НФ: одна ячейка — одно значение.</b> У Петра в ячейке два телефона через «;». По второму номеру его не найти, уникальность номера не проверить. Режем: телефоны уезжают в отдельную таблицу — по строке на номер.' },
    { t: '2НФ', drop: [2], hl: 4, cut: [['Тренер', T_TRAINER]], note: '<b>Правило 2НФ: всё в строке зависит от всего ключа, а не от его куска.</b> Ключ — тренер + начало. Телефон тренера зависит только от тренера, то есть от половины ключа. Поэтому он повторяется в каждой тренировке Марии Лис. Режем: телефон — в карточку тренера.' },
    { t: '3НФ', drop: [2, 4], hl: 6, cut: [['Клуб', T_CLUB]], note: '<b>Правило 3НФ: ничего не зависит через посредника.</b> Адрес зависит от клуба, а клуб — от тренировки: цепочка «тренировка → клуб → адрес». Поэтому адрес Химок записан дважды. Режем: адрес — в карточку клуба.' },
    { t: 'Итог', drop: [2, 4, 6], hl: null, cut: [], note: 'Каждый факт записан ровно один раз. В журнале остались только факты о самой тренировке: кто, с кем, где, когда и почём. Телефон Марии Лис меняется в одной строке, адрес Химок — в одной строке.' }
  ];
  function nfFlat(drop, cellCls) {
    const keep = PT_C.map((c, i) => i).filter(i => !drop.includes(i));
    return xt(keep.map(i => esc(PT_C[i]) + (i === 0 || i === 3 ? ' 🔑' : '')), PT_R.map((r, ri) => keep.map(ci => ({ h: esc(r[ci]), c: cellCls ? cellCls(ri, ci) : '' }))));
  }
  function nfSteps(el) {
    let k = 0;
    el.innerHTML = `<div class="thd-steps" data-ind></div><div data-o class="stack"></div>
      <div class="row"><button type="button" class="btn sm ghost" data-nf="-1">← Назад</button><button type="button" class="btn sm primary" data-nf="1">Следующий шаг →</button></div>`;
    function draw() {
      const S = NF[k];
      TR.$('[data-ind]', el).innerHTML = NF.map((s, i) => `<span class="${i === k ? 'on' : i < k ? 'done' : ''}">${esc(s.t)}</span>`).join('');
      const cls = (ri, ci) => (S.bad || []).some(([r, c]) => r === ri && c === ci) ? 'cell-bad' : S.hl === ci ? 'cell-hl' : '';
      const made = NF.slice(1, k + 1).flatMap(s => s.cut);
      const phoneN = k >= 2 ? 1 : 3, addrN = k >= 3 ? 1 : 2;
      TR.$('[data-o]', el).innerHTML = `<div class="thd-cons ${k === 4 ? 'ok' : 'info'}">${S.note}</div>
        <div><div class="thd-cap">${k === 4 ? 'Журнал тренировок — что осталось' : k ? 'Журнал до разреза — жёлтое уезжает' : 'Журнал тренировок (🔑 — части ключа)'}</div>${nfFlat(k === 4 ? S.drop : (NF[k].drop), cls)}</div>
        ${made.length ? `<div class="thd-tbls">${made.map(([t, f]) => `<div><div class="thd-cap">новая таблица: ${esc(t)}</div>${f()}</div>`).join('')}</div>` : ''}
        <div class="grid2"><div class="stat"><span class="k">после шага: телефон Марии Лис</span><span class="v ${phoneN > 1 ? 'warn' : 'ok'}">${phoneN} ${TR.plural(phoneN, 'раз', 'раза', 'раз')}</span><span class="s">${phoneN > 1 ? 'сменит номер — править в каждой строке' : 'сменит номер — одна правка'}</span></div>
        <div class="stat"><span class="k">после шага: адрес «Пульс Химки»</span><span class="v ${addrN > 1 ? 'warn' : 'ok'}">${addrN} ${TR.plural(addrN, 'раз', 'раза', 'раз')}</span><span class="s">${addrN > 1 ? 'копии могут разойтись' : 'одна правда'}</span></div></div>`;
      TR.$('[data-nf="-1"]', el).disabled = k === 0;
      TR.$('[data-nf="1"]', el).disabled = k === NF.length - 1;
    }
    TR.on(el, 'click', '[data-nf]', (e, b) => { k = Math.max(0, Math.min(NF.length - 1, k + +b.dataset.nf)); draw(); });
    draw();
  }
  const ANOM = {
    upd: { t: 'Мария Лис сменила телефон', flat: { rows: (ri, ci) => ci === 4 && [0, 1, 3].includes(ri) ? (ri === 0 ? 'cell-ok' : 'cell-bad') : '', val: (ri, ci, v) => ci === 4 && ri === 0 ? '+7 926 777-02-99' : v, kind: 'bad', txt: 'Телефон Марии записан в трёх строках. Администратор поправил первую и ушёл на тренировку. Теперь у Марии два «правильных» номера, и какой из них настоящий — неизвестно. Это <b>аномалия обновления</b>.' },
      norm: { kind: 'ok', txt: 'В таблице «Тренер» у Марии одна строка. Поправили её — все тренировки сразу видят новый номер.', tbl: () => xt(['тренер', 'телефон'], [['Мария Лис', { h: '+7 926 777-02-99', c: 'cell-ok' }], ['Олег Шин', '+7 916 888-03-03']]) } },
    del: { t: 'Анна отменила тренировку с Олегом Шином', flat: { gone: 2, kind: 'bad', txt: 'Строку удалили — и вместе с ней пропал телефон Олега Шина: больше он нигде не записан. Хотели убрать тренировку, а потеряли контакт тренера. Это <b>аномалия удаления</b>.' },
      norm: { kind: 'ok', txt: 'Из журнала ушла одна тренировка. Карточка Олега Шина с телефоном осталась в таблице «Тренер».', tbl: () => xt(['тренер', 'телефон'], [['Мария Лис', '+7 926 777-02-02'], ['Олег Шин', { h: '+7 916 888-03-03', c: 'cell-ok' }]]) } },
    ins: { t: 'В Химки пришла новый тренер Светлана Белова', flat: { ghost: true, kind: 'bad', txt: 'Тренировок у Светланы пока нет. Ключ строки — тренер + начало, а начала нет. Строку-призрак с пустым временем и клиентом не сохранить, а если сохранить — отчёт посчитает тренировку, которой не было. Это <b>аномалия вставки</b>.' },
      norm: { kind: 'ok', txt: 'Светлана — новая строка в таблице «Тренер». Тренировки появятся, когда клиенты запишутся.', tbl: () => xt(['тренер', 'телефон'], [['Мария Лис', '+7 926 777-02-02'], ['Олег Шин', '+7 916 888-03-03'], [{ h: 'Светлана Белова', c: 'cell-ok' }, { h: '+7 915 333-77-11', c: 'cell-ok' }]]) } }
  };
  function nfAnom(el) {
    let a = null;
    el.innerHTML = `<div class="small muted">Три обычных события из жизни клуба. Нажмите каждое и сравните, что происходит в плоском журнале и в разложенных таблицах.</div>
      <div class="thd-btns">${Object.keys(ANOM).map(k => `<button type="button" class="btn sm" data-an="${k}">${esc(ANOM[k].t)}</button>`).join('')}</div><div data-o class="stack"></div>`;
    function draw() {
      TR.$$('[data-an]', el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.an === a)));
      if (!a) { TR.$('[data-o]', el).innerHTML = `<div><div class="thd-cap">плоский журнал</div>${nfFlat([])}</div>`; return; }
      const A = ANOM[a], F = A.flat;
      const keep = PT_C.map((c, i) => i);
      let rows = PT_R.map((r, ri) => keep.map(ci => ({ h: esc(F.val ? F.val(ri, ci, r[ci]) : r[ci]), c: F.rows ? F.rows(ri, ci) : '' })));
      if (F.ghost) rows = rows.concat([[{ h: '?', c: 'cell-bad' }, { h: '?', c: 'cell-bad' }, '', 'Светлана Белова', '+7 915 333-77-11', 'Пульс Химки', 'ул. Ленина, 1', { h: '?', c: 'cell-bad' }]]);
      TR.$('[data-o]', el).innerHTML = `<div><div class="thd-cap">в плоском журнале</div>${xt(PT_C.map(esc), rows, (r, i) => F.gone === i ? 'gone bad' : '')}</div><div class="thd-cons ${F.kind}">${F.txt}</div>
        <div><div class="thd-cap">в разложенных таблицах</div>${A.norm.tbl()}</div><div class="thd-cons ${A.norm.kind}">${A.norm.txt}</div>
        ${ui.note('', 'Откуда беда', 'Все три аномалии — от одного: в строке плоской таблицы смешаны факты о разных вещах — о тренировке, тренере, клиенте, клубе. Тронул одно — задел другое.')}`;
    }
    TR.on(el, 'click', '[data-an]', (e, b) => { a = b.dataset.an; draw(); });
    draw();
  }
  function nfDenorm(el) {
    const st = { mode: 'count', views: 100, upd: 'tx', log: 87, board: 87, msg: '' };
    el.innerHTML = `<div class="small muted">На экране у входа в «Пульс Сокол» и в приложении — «Сейчас в клубе: N человек». За день через турникет проходит ~800 человек. В вечерний пик экран и приложения спрашивают число сотни раз в секунду. Посчитать каждый раз или хранить готовое число?</div>
      <div class="row"><span class="small dim">Как получаем число:</span>${ui.seg('dm', [{ v: 'count', t: 'считаем каждый раз' }, { v: 'store', t: 'храним счётчик в клубе' }], st.mode, 'accent')}</div>
      <label class="field"><span>Сколько раз в секунду спрашивают: <b data-vv></b></span><input type="range" class="thd-range" min="10" max="500" step="10" value="${st.views}" data-r aria-label="Запросов в секунду"></label>
      <div data-cost></div><div data-cons class="stack"></div>
      <div class="card flat stack tight"><div class="eyebrow">Рецепт: когда хранить посчитанное</div><ul class="thd-checks" style="list-style:none"><li class="ok">Читают в десятки и сотни раз чаще, чем меняют.</li><li class="ok">Посчитать заново дорого — много строк на каждый показ.</li><li class="ok">Есть чем держать копию честной: та же транзакция, CHECK, ночная сверка.</li></ul><div class="small muted">Нет хотя бы одного пункта — считайте на лету. Нормализуем по умолчанию, денормализуем по рецепту.</div></div>`;
    function draw() {
      TR.$('[data-vv]', el).textContent = nf(st.views);
      const rows = st.mode === 'count' ? st.views * 800 : st.views + 3;
      TR.$('[data-cost]', el).innerHTML = `<div class="grid2"><div class="stat"><span class="k">строк прочитать за секунду</span><span class="v ${rows > 50000 ? 'bad' : rows > 5000 ? 'warn' : 'ok'}">${nf(rows)}</span><span class="s">${st.mode === 'count' ? `${nf(st.views)} показов × ~800 проходов за день` : `${nf(st.views)} показов × 1 строка + ~3 изменения счётчика`}</span></div>
        <div class="stat"><span class="k">чтений на одно изменение</span><span class="v">${nf(st.views / 3)}</span><span class="s">в пик через турникет ~3 человека в секунду</span></div></div>`;
      if (st.mode === 'count') { TR.$('[data-cons]', el).innerHTML = '<div class="thd-cons warn">Число всегда честное: его считают по журналу посещений. Цена — каждый показ перебирает сотни строк. Двигайте ползунок: чем больше показов, тем дороже честность.</div>'; return; }
      const diff = st.log !== st.board;
      TR.$('[data-cons]', el).innerHTML = `<div class="thd-cons ok">Показ стоит одну строку. Цена — счётчик надо менять при каждом проходе, и он обязан совпадать с журналом.</div>
        <div class="row"><span class="small dim">Как меняем счётчик:</span>${ui.seg('du', [{ v: 'tx', t: 'в той же транзакции, что и проход' }, { v: 'sep', t: 'отдельным шагом после' }], st.upd, 'accent')}</div>
        <div class="thd-btns"><button type="button" class="btn sm" data-dn="pass">Клиент прошёл турникет</button><button type="button" class="btn sm danger" data-dn="crash">Проход — и сервер упал между шагами</button><button type="button" class="btn sm ghost" data-dn="fix">Ночная сверка: пересчитать</button></div>
        <div class="thd-db"><div class="thd-node ok"><span class="s">по журналу посещений (правда)</span><span class="v">${st.log}</span></div><div class="thd-node ${diff ? 'bad' : 'ok'}"><span class="s">на экране (счётчик)</span><span class="v">${st.board}</span></div></div>
        ${st.msg}`;
    }
    TR.on(el, 'click', '[data-dn]', (e, b) => {
      const a = b.dataset.dn;
      if (a === 'pass') { st.log++; st.board++; st.msg = '<div class="thd-cons ok">Проход записан, счётчик +1. Пока всё штатно, оба способа обновлять счётчик работают одинаково.</div>'; }
      if (a === 'crash') {
        if (st.upd === 'tx') st.msg = '<div class="thd-cons ok">Проход и счётчик — одна транзакция. Сервер упал до её конца — база откатила оба изменения. Турникет повторит событие, и оба числа вырастут вместе.</div>';
        else { st.log++; st.msg = '<div class="thd-cons bad">Проход записан, а до счётчика дело не дошло. Копия разошлась с правдой — и сама уже не сойдётся: каждый следующий проход прибавит по единице к неверному числу.</div>'; }
      }
      if (a === 'fix') { st.board = st.log; st.msg = '<div class="thd-cons info">Ночная задача пересчитала счётчик по журналу. Это страховка, а не замена транзакции: днём экран мог врать часами.</div>'; }
      draw();
    });
    ui.onSeg(el, (n, v) => { if (n === 'dm') { st.mode = v; st.msg = ''; draw(); } if (n === 'du') { st.upd = v; st.msg = ''; draw(); } });
    el.addEventListener('input', e => { if (e.target.matches('[data-r]')) { st.views = +e.target.value; draw(); } });
    draw();
  }
  const howNf = {
    id: 'how-nf', covers: ['find', 'anomalies', 'cut', 'denorm'], title: 'Как это работает: нормальные формы по шагам', free: true, noReset: true,
    simple: {
      icon: '✂️', plain: 'Нормализация — разложить данные так, чтобы каждый факт хранился ровно в одном месте. Тогда его нельзя поправить «не везде».',
      analogy: 'Телефон тренера записан на каждом листке журнала тренировок. Тренер сменил номер — переписывай все листки, и один обязательно забудешь. Если телефон живёт в одной карточке тренера, правка одна.',
      tech: '1НФ — одна ячейка, одно значение (без списков и склеек). 2НФ — каждый неключевой столбец зависит от всего ключа, а не от его части. 3НФ — нет зависимостей через посредника (тренировка → клуб → адрес). Нарушения дают аномалии обновления, удаления и вставки. Денормализация — сознательная копия ради скорости, и к ней обязателен механизм согласованности.'
    },
    lead: ui.brief({
      situation: 'Перед Excel предшественника потренируемся на соседней таблице: журнал персональных тренировок. Тренер не может быть в двух местах сразу, поэтому строку однозначно определяют тренер и время начала — это ключ.',
      todo: [
        '«Шаги нормализации»: нажимайте «Следующий шаг» от плоской таблицы до 3НФ. На каждом шаге читайте правило и смотрите, какой столбец уезжает (жёлтый) и куда.',
        '«Три аномалии»: нажмите три события и сравните плоский журнал с разложенными таблицами.',
        '«Денормализация»: переключите «считаем каждый раз» и «храним счётчик», подвигайте ползунок, затем устройте сбой между шагами в двух режимах.'
      ],
      look: '🔑 — столбцы, из которых состоит ключ. Жёлтые ячейки — то, что сейчас вырежем. Красные — данные уже испорчены или пропали. Зелёные таблицы — новые, где факт живёт один раз. Счётчики внизу показывают, сколько раз один и тот же факт записан.'
    }),
    render(el) { tabs(el, [{ id: 's', t: 'Шаги нормализации', render: nfSteps }, { id: 'a', t: 'Три аномалии', render: nfAnom }, { id: 'd', t: 'Денормализация: счётчик', render: nfDenorm }]); }
  };

  // =====================================================================
  // 7. physical: типы и ограничения — «попробуй вставить»
  // =====================================================================
  const CN = [
    { id: 'nn', t: 'NOT NULL (client_id)', ddl: 'client_id     bigint NOT NULL REFERENCES client' },
    { id: 'ck', t: 'CHECK (до > с, цена ≥ 0)', ddl: 'CHECK (ends_at > starts_at AND price_kopecks >= 0)' },
    { id: 'uq', t: 'UNIQUE: одна активная бронь клиента', ddl: 'CREATE UNIQUE INDEX one_active ON locker_booking (client_id) WHERE status = \'active\'' },
    { id: 'ex', t: 'EXCLUDE: шкафчик не сдать двоим', ddl: 'EXCLUDE USING gist (locker_id WITH =, tstzrange(starts_at, ends_at) WITH &&)' },
    { id: 'fk', t: 'FOREIGN KEY (locker_id)', ddl: 'locker_id     bigint REFERENCES locker' }
  ];
  const CN_CLI = { 11: 'Анна', 12: 'Пётр', 13: 'Дмитрий' };
  const CN_BASE = [{ locker: 117, client: 11, from: 18, to: 20, price: 15000 }, { locker: 118, client: 12, from: 19, to: 21, price: 15000 }];
  const CN_PRE = [
    { t: 'Обычная бронь', v: { locker: '118', client: '13', from: '21', to: '22', price: '15000' } },
    { t: 'Двойная бронь шкафчика', v: { locker: '117', client: '13', from: '19', to: '21', price: '15000' } },
    { t: 'Без клиента', v: { locker: '118', client: '', from: '21', to: '22', price: '15000' } },
    { t: 'Конец раньше начала', v: { locker: '118', client: '13', from: '22', to: '21', price: '15000' } },
    { t: 'Шкафчик №999', v: { locker: '999', client: '13', from: '19', to: '20', price: '15000' } },
    { t: 'Вторая бронь Анны', v: { locker: '118', client: '11', from: '21', to: '22', price: '15000' } },
    { t: 'Цена «сто»', v: { locker: '118', client: '13', from: '21', to: '22', price: 'сто' } }
  ];
  function cnTry(el) {
    const st = { on: new Set(CN.map(c => c.id)), rows: TR.clone(CN_BASE), f: Object.assign({}, CN_PRE[1].v), msg: '', ok: 0, miss: 0 };
    const hours = [17, 18, 19, 20, 21, 22, 23];
    el.innerHTML = `<div class="small muted">Таблица броней шкафчика на вечер. Включайте и выключайте ограничения, заполняйте поля или берите готовую попытку — и жмите «Вставить». База ответит так, как ответил бы PostgreSQL.</div>
      <div class="thd-flags">${CN.map(c => `<label class="toggle"><input type="checkbox" data-cn="${c.id}" checked> <span>${esc(c.t)}</span></label>`).join('')}</div>
      <div data-ddl></div><div data-rows></div>
      <div class="eyebrow">Готовые попытки</div><div class="thd-btns">${CN_PRE.map((p, i) => `<button type="button" class="btn xs" data-pre="${i}">${esc(p.t)}</button>`).join('')}</div>
      <div class="thd-form">
        <label class="field"><span>Шкафчик</span><select data-f="locker"><option value="117">№117</option><option value="118">№118</option><option value="999">№999 (нет такого)</option></select></label>
        <label class="field"><span>Клиент</span><select data-f="client"><option value="11">Анна (11)</option><option value="12">Пётр (12)</option><option value="13">Дмитрий (13)</option><option value="">— пусто</option></select></label>
        <label class="field"><span>С</span><select data-f="from">${hours.map(h => `<option value="${h}">${h}:00</option>`).join('')}</select></label>
        <label class="field"><span>До</span><select data-f="to">${hours.map(h => `<option value="${h}">${h}:00</option>`).join('')}</select></label>
        <label class="field"><span>Цена, копейки</span><input type="text" class="mono" data-f="price" maxlength="12"></label></div>
      <div class="row"><button type="button" class="btn primary sm" data-ins>Вставить</button><button type="button" class="btn ghost sm" data-rst>⟲ Как было</button><span class="small dim tnum" data-cnt></span></div>
      <div data-sql></div><div data-msg></div>`;
    function fillForm() { TR.$$('[data-f]', el).forEach(i => { i.value = st.f[i.dataset.f]; }); }
    function draw() {
      const on = id => st.on.has(id);
      const lines = [
        'id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,',
        on('fk') ? 'locker_id     bigint REFERENCES locker,' : 'locker_id     bigint,                 -- внешний ключ выключен',
        on('nn') ? 'client_id     bigint NOT NULL REFERENCES client,' : 'client_id     bigint REFERENCES client, -- NOT NULL выключен',
        'starts_at     timestamptz,', 'ends_at       timestamptz,', 'price_kopecks bigint,', "status        text DEFAULT 'active'" + (on('ck') || on('ex') ? ',' : ''),
        on('ck') ? CN[1].ddl + (on('ex') ? ',' : '') : '-- CHECK выключен',
        on('ex') ? CN[3].ddl : '-- EXCLUDE выключен'
      ];
      TR.$('[data-ddl]', el).innerHTML = W(ui.code('CREATE TABLE locker_booking (\n' + lines.map(s => '  ' + s).join('\n') + '\n);\n' + (on('uq') ? CN[2].ddl + ';' : '-- частичный UNIQUE выключен'), 'sql', 'схема таблицы'));
      TR.$('[data-rows]', el).innerHTML = `<div class="thd-cap">locker_booking — что уже лежит в базе</div>${xt(['шкафчик', 'клиент', 'с', 'до', 'цена, коп.'], st.rows.map(r => [r.locker, r.client == null ? { h: 'NULL', c: 'cell-bad' } : esc(CN_CLI[r.client] || r.client), r.from + ':00', r.to + ':00', r.price]), r => r.bad ? 'bad' : '')}`;
      TR.$('[data-cnt]', el).textContent = `отбито: ${st.ok} · прошло плохих: ${st.miss}`;
      TR.$('[data-msg]', el).innerHTML = st.msg;
    }
    function insert() {
      const f = st.f, sql = `INSERT INTO locker_booking (locker_id, client_id, starts_at, ends_at, price_kopecks)\nVALUES (${f.locker}, ${f.client || 'NULL'}, '2026-10-12 ${f.from}:00+03', '2026-10-12 ${f.to}:00+03', ${/^-?\d+$/.test(f.price.trim()) ? f.price.trim() : `'${f.price}'`});`;
      TR.$('[data-sql]', el).innerHTML = W(ui.code(sql, 'sql', 'что ушло в базу'));
      const on = id => st.on.has(id);
      const locker = +f.locker, client = f.client ? +f.client : null, from = +f.from, to = +f.to;
      if (!/^-?\d+$/.test(f.price.trim())) { st.ok++; st.msg = errBox(`ERROR:  invalid input syntax for type bigint: "${f.price}"`, 'Отбито типом', 'Столбец цены — целое число копеек. Тип — первая линия обороны: «сто», «150 р.» и «1,5» база не примет вообще, без всяких ограничений.'); return draw(); }
      const price = +f.price;
      const errs = [], probs = [];
      const test = (id, cond, err, prob) => { if (!cond) return; if (on(id)) errs.push(err); else probs.push(prob); };
      test('nn', client == null, 'ERROR:  null value in column "client_id" of relation "locker_booking" violates not-null constraint', 'бронь без клиента: кто платит и кому открывать?');
      test('ck', to <= from || price < 0, 'ERROR:  new row for relation "locker_booking" violates check constraint "locker_booking_check"', to <= from ? `бронь с ${from}:00 до ${to}:00 — время идёт назад` : 'отрицательная цена');
      test('uq', client != null && st.rows.some(r => r.client === client), `ERROR:  duplicate key value violates unique constraint "one_active"\nDETAIL:  Key (client_id)=(${client}) already exists.`, `у клиента ${CN_CLI[client] || client} две активные брони — одна лишняя`);
      test('ex', st.rows.some(r => r.locker === locker && r.from < to && from < r.to), 'ERROR:  conflicting key value violates exclusion constraint "locker_booking_locker_id_tstzrange_excl"\nDETAIL:  Key (locker_id, tstzrange(starts_at, ends_at)) conflicts with existing key.', `шкафчик №${locker} сдан двоим на одно и то же время`);
      test('fk', locker === 999, 'ERROR:  insert or update on table "locker_booking" violates foreign key constraint "locker_booking_locker_id_fkey"\nDETAIL:  Key (locker_id)=(999) is not present in table "locker".', 'бронь шкафчика, которого не существует');
      if (errs.length) { st.ok++; st.msg = errBox(errs[0], 'Отбито: база не пустила', probs.length ? `Но если бы не это ограничение, прошла бы ещё одна беда: ${esc(probs[0])}.` : 'Строка не записана, данные целы. Приложение покажет человеку понятную ошибку.'); return draw(); }
      st.rows.push({ locker, client, from, to, price, bad: probs.length > 0 });
      if (probs.length) { st.miss++; st.msg = ui.note('bad', 'Прошло — и это плохие данные', `<code>INSERT 0 1</code>. База приняла строку: проверять было некому. В базе теперь ${probs.map(esc).join('; ')}.`); }
      else st.msg = ui.note('ok', 'Принято', '<code>INSERT 0 1</code>. Строка честная: все правила соблюдены.');
      draw();
    }
    el.addEventListener('change', e => {
      const c = e.target.closest('[data-cn]'); if (c) { if (c.checked) st.on.add(c.dataset.cn); else st.on.delete(c.dataset.cn); st.msg = ''; draw(); return; }
      const f = e.target.closest('[data-f]'); if (f) st.f[f.dataset.f] = f.value;
    });
    el.addEventListener('input', e => { const f = e.target.closest('[data-f]'); if (f) st.f[f.dataset.f] = f.value; });
    TR.on(el, 'click', '[data-pre]', (e, b) => { st.f = Object.assign({}, CN_PRE[+b.dataset.pre].v); fillForm(); insert(); });
    TR.on(el, 'click', '[data-ins]', insert);
    TR.on(el, 'click', '[data-rst]', () => { st.rows = TR.clone(CN_BASE); st.msg = ''; st.ok = 0; st.miss = 0; TR.$('[data-sql]', el).innerHTML = ''; draw(); });
    fillForm(); draw();
  }
  const RACE2 = [L('a', 'Администратор 1', 'поток сервера 1'), L('b', 'Администратор 2', 'поток сервера 2'), L('db', 'PostgreSQL', 'брони шкафчиков')];
  function cnRace(el) {
    add(el, 'small muted', 'Два администратора на ресепшене одновременно сдают шкафчик №117 на 19:00–21:00 — Дмитрию и Ольге Беловой. В приложении есть проверка «свободен ли шкафчик». Почему её мало?');
    walk(add(el), {
      scenarios: [
        {
          id: 'app', t: 'Проверка в приложении', lanes: RACE2, sumKind: 'bad',
          sum: 'Шкафчик сдан двоим. Каждый запрос по отдельности проверил честно — но между проверкой и записью вклинился другой. Проверка в приложении видит прошлое, а не то, что происходит прямо сейчас.',
          steps: [
            { from: 'a', to: 'db', t: 'свободен ли №117\n19–21?', note: 'Запрос первого администратора проверяет: есть ли пересекающиеся брони?' },
            { from: 'db', to: 'a', t: 'свободен', reply: true, note: 'Пересечений нет.' },
            { from: 'b', to: 'db', t: 'свободен ли №117\n19–21?', note: 'В ту же миллисекунду второй запрос спрашивает то же самое.' },
            { from: 'db', to: 'b', t: 'свободен', reply: true, kind: 'warn', note: 'Первый ещё ничего не записал — база честно отвечает «свободен».' },
            { from: 'a', to: 'db', t: 'INSERT бронь Дмитрия', note: 'Первый записывает бронь.' },
            { from: 'b', to: 'db', t: 'INSERT бронь Ольги', kind: 'bad', note: 'Второй «уже проверил» и тоже записывает. Перепроверять ему некому.' },
            { from: 'a', to: 'db', t: 'два ключа от одного шкафчика', box: true, kind: 'bad', note: 'Вечером двое придут к одному шкафчику.' }
          ]
        },
        {
          id: 'db', t: 'EXCLUDE в базе', lanes: RACE2, sumKind: 'ok',
          sum: 'Правило держит база, а не аккуратность кода. Запросы могут прийти в одну миллисекунду, из разных серверов, из старой версии приложения — второй всё равно получит отказ.',
          steps: [
            { from: 'a', to: 'db', t: 'INSERT бронь Дмитрия', note: 'Проверять заранее не нужно: запрос сразу пытается записать бронь.' },
            { from: 'b', to: 'db', t: 'INSERT бронь Ольги', note: 'Второй запрос делает то же самое.' },
            { from: 'db', to: 'a', t: 'INSERT 0 1', reply: true, kind: 'ok', note: 'Ограничение EXCLUDE проверяет пересечение времени внутри самой вставки. Первая бронь записана.' },
            { from: 'db', to: 'b', t: 'ERROR 23P01', reply: true, kind: 'warn', note: 'Вторая пересекается с первой — база отвечает ошибкой исключения (SQLSTATE 23P01).' },
            { from: 'b', to: 'b', t: '409 «Шкафчик занят»', kind: 'info', note: 'Сервер переводит ошибку базы в понятный ответ: «Шкафчик №117 на это время занят, свободен №118».' }
          ]
        }
      ]
    });
  }
  const howConstraints = {
    id: 'how-constraints', covers: ['types', 'rules', 'attack'], title: 'Как это работает: типы и ограничения', free: true, noReset: true,
    simple: {
      icon: '🛡️', plain: 'Тип решает, какое значение вообще можно положить в столбец. Ограничение — правило, которое база проверяет сама при каждой записи. Плохая строка просто не попадает в базу.',
      analogy: 'Турникет пускает только с действующим браслетом — его не уговорить и не обмануть. А табличка «вход только по абонементам» — это проверка в приложении: работает, пока все честные и никто не спешит.',
      tech: 'Тип (<code>bigint</code>, <code>timestamptz</code>…) — первая линия. <code>NOT NULL</code> — обязательно. <code>CHECK</code> — условие внутри одной строки. <code>UNIQUE</code> (и частичный, с <code>WHERE</code>) — без повторов. <code>FOREIGN KEY</code> — ссылка на существующее. <code>EXCLUDE</code> — запрет пересечений, например интервалов времени. Нарушение — ошибка класса 23: 23502, 23514, 23505, 23P01, 23503.'
    },
    lead: ui.brief({
      situation: 'Перед физической моделью «Пульса» разберём механизм на соседней таблице: брони шкафчиков на вечер. Шкафчик №117 уже занят Анной с 18:00 до 20:00, №118 — Петром с 19:00 до 21:00.',
      todo: [
        '«Попробуй вставить»: прогоните все готовые попытки при включённых ограничениях. Затем выключите одно-два ограничения и повторите — посмотрите, что прошло в базу.',
        'Попробуйте свою попытку: поменяйте поля формы и нажмите «Вставить».',
        '«Проверка в приложении»: пройдите по шагам оба варианта и найдите момент, где всё ломается.'
      ],
      look: 'Зелёная плашка с текстом ошибки — база сама отбила плохие данные (это хорошо). Красная «Прошло» — плохая строка уже в базе, и она подсвечена в таблице. Счётчик рядом с кнопкой: сколько попыток отбито и сколько плохих прошло. В схеме таблицы выключенные ограничения превращаются в комментарии.'
    }),
    render(el) { tabs(el, [{ id: 'try', t: 'Попробуй вставить', render: cnTry }, { id: 'race', t: 'Проверка в приложении', render: cnRace }]); }
  };

  // =====================================================================
  // 8. physical: ON DELETE
  // =====================================================================
  const OD_RENT = [{ id: 501, who: 'Анна Смирнова', p: '01.10–31.10', now: true }, { id: 480, who: 'Пётр Орлов', p: '01.09–30.09' }, { id: 455, who: 'Дмитрий Ковалёв', p: '01.08–31.08' }];
  const OD_CLEAN = [{ id: 71, d: '10.10', who: 'уборка, замена замка' }, { id: 72, d: '11.10', who: 'уборка' }];
  const OD_T = { CASCADE: 'CASCADE — удалить вместе', RESTRICT: 'RESTRICT — запретить', 'SET NULL': 'SET NULL — обнулить ссылку' };
  function odLab(el) {
    const st = { r: 'CASCADE', c: 'CASCADE', done: null };
    el.innerHTML = `<div class="small muted">Шкафчик №117 в «Пульс Сокол» решили убрать. На него ссылаются две таблицы: аренды (история за три месяца, одна аренда идёт прямо сейчас) и отметки уборки. Для каждой ссылки выберите правило и удалите шкафчик.</div>
      <div class="stack tight"><span class="small"><code>locker_rental.locker_id</code> — аренды:</span>${ui.seg('odr', Object.keys(OD_T).map(v => ({ v, t: OD_T[v] })), st.r, 'accent')}</div>
      <div class="stack tight"><span class="small"><code>locker_cleaning.locker_id</code> — уборка:</span>${ui.seg('odc', Object.keys(OD_T).map(v => ({ v, t: OD_T[v] })), st.c, 'accent')}</div>
      <div class="thd-btns"><button type="button" class="btn sm danger" data-od="del">DELETE FROM locker WHERE id = 117</button><button type="button" class="btn sm" data-od="soft">Списать вместо удаления</button><button type="button" class="btn sm ghost" data-od="reset">⟲ Как было</button></div>
      <div data-o class="stack"></div>`;
    function draw() {
      const d = st.done;
      const blocked = d === 'del' && (st.r === 'RESTRICT' || st.c === 'RESTRICT');
      const applied = d === 'del' && !blocked;
      const parent = d === 'soft' ? [[{ h: '117', c: 'mono' }, 'Пульс Сокол', { h: 'списан', c: 'cell-hl' }]] : applied ? [[{ h: '117', c: 'mono' }, 'Пульс Сокол', 'в работе']] : [[{ h: '117', c: 'mono' }, 'Пульс Сокол', 'в работе']];
      const childRows = (list, rule, f) => list.map(x => {
        if (!applied) return f(x, '117', '');
        if (rule === 'CASCADE') return f(x, '117', 'gone');
        return f(x, 'NULL', 'null');
      });
      const rRows = childRows(OD_RENT, st.r, (x, ref, s) => [{ h: x.id, c: 'mono' }, { h: ref, c: 'mono ' + (s === 'null' ? 'cell-hl' : '') }, esc(x.who) + (x.now ? ' <span class="small dim">(идёт сейчас)</span>' : ''), x.p]);
      const cRows = childRows(OD_CLEAN, st.c, (x, ref, s) => [{ h: x.id, c: 'mono' }, { h: ref, c: 'mono ' + (s === 'null' ? 'cell-hl' : '') }, x.d, esc(x.who)]);
      const rCls = () => applied && st.r === 'CASCADE' ? 'gone bad' : '';
      const cCls = () => applied && st.c === 'CASCADE' ? 'gone bad' : '';
      let verdict = '';
      if (blocked) verdict = errBox(`ERROR:  update or delete on table "locker" violates foreign key constraint "${st.r === 'RESTRICT' ? 'locker_rental' : 'locker_cleaning'}_locker_id_fkey" on table "${st.r === 'RESTRICT' ? 'locker_rental' : 'locker_cleaning'}"\nDETAIL:  Key (id)=(117) is still referenced from table "${st.r === 'RESTRICT' ? 'locker_rental' : 'locker_cleaning'}".`, 'Удаление запрещено', `Ничего не изменилось — даже то, что по правилу CASCADE могло бы удалиться: команда целиком откатывается. ${st.r === 'RESTRICT' ? 'Аренды с историей защитили шкафчик от удаления.' : 'Удалению мешают отметки уборки: придётся стирать их вручную — ради бесполезных строк.'}`);
      else if (applied) {
        const rv = { CASCADE: ['bad', 'Аренды удалены вместе со шкафчиком. Жалобу «у меня пропали вещи в сентябре» больше не проверить. А Анна арендует шкафчик прямо сейчас: вечером она придёт с браслетом, а аренды нет.'], 'SET NULL': ['warn', 'Аренды остались, но шкафчик в них стёрт: «Пётр арендовал… что-то». История есть, а ответа на главный вопрос — какой шкафчик — нет. Да и столбец должен разрешать NULL.'] }[st.r];
        const cv = { CASCADE: ['ok', 'Отметки уборки удалены вместе со шкафчиком — без него они никому не нужны. Здесь CASCADE разумен.'], 'SET NULL': ['warn', 'Отметки уборки «непонятно чего» остались мусором.'] }[st.c];
        verdict = `<div class="thd-cons ${rv[0]}"><b>Аренды:</b> ${rv[1]}</div><div class="thd-cons ${cv[0]}"><b>Уборка:</b> ${cv[1]}</div>`;
      } else if (d === 'soft') verdict = ui.note('ok', 'Списан, а не удалён', '<code>UPDATE locker SET status = \'written_off\' WHERE id = 117</code>. Строка шкафчика осталась, все ссылки целы, история аренд на месте. Новые аренды на списанный шкафчик база не даст создать — это уже проверка статуса. Ценные данные обычно не удаляют, а помечают.');
      else verdict = '<div class="small dim">Выберите правила и нажмите DELETE. Подумайте заранее: что ценнее для клуба — сам шкафчик или то, что на него ссылается?</div>';
      TR.$('[data-o]', el).innerHTML = `<div class="thd-tbls"><div><div class="thd-cap">locker — родитель</div>${xt(['id', 'клуб', 'статус'], parent, () => applied ? 'gone bad' : '')}</div>
        <div><div class="thd-cap">locker_cleaning — уборка</div>${xt(['id', 'locker_id', 'дата', 'что'], cRows, cCls)}</div></div>
        <div><div class="thd-cap">locker_rental — аренды</div>${xt(['id', 'locker_id', 'клиент', 'период'], rRows, rCls)}</div>${verdict}`;
    }
    ui.onSeg(el, (n, v) => { if (n === 'odr') { st.r = v; st.done = null; draw(); } if (n === 'odc') { st.c = v; st.done = null; draw(); } });
    TR.on(el, 'click', '[data-od]', (e, b) => { const a = b.dataset.od; st.done = a === 'reset' ? null : a; draw(); });
    draw();
  }
  const howOnDelete = {
    id: 'how-ondelete', covers: ['ondelete'], title: 'Как это работает: ON DELETE — что будет с зависимыми строками', free: true, noReset: true,
    simple: {
      icon: '🗑️', plain: 'Когда удаляют строку, на которую ссылаются другие, база должна знать, что делать с этими ссылками: удалить их вместе, запретить удаление или стереть ссылку.',
      analogy: 'Шкафчик отправили в утиль. Журнал уборки этого шкафчика можно выбросить вместе с ним. А журнал аренд — нет: по нему разбирают жалобы о пропажах. Поэтому шкафчик не уничтожают, а списывают.',
      tech: '<code>ON DELETE CASCADE</code> — удалить зависимые строки. <code>RESTRICT</code> (и <code>NO ACTION</code> по умолчанию) — запретить удаление, пока есть ссылки. <code>SET NULL</code> — обнулить внешний ключ (столбец должен допускать NULL). Если хоть одна ссылка запрещает удаление, вся команда откатывается. Для ценных данных вместо удаления — пометка статусом.'
    },
    lead: ui.brief({
      situation: 'Шкафчик №117 убирают из «Пульс Сокол». На него ссылаются аренды (одна идёт прямо сейчас, две — в прошлом) и отметки уборки. Правило ON DELETE задаётся для каждой ссылки отдельно — и для разных детей оно может быть разным.',
      todo: [
        'Поставьте обеим ссылкам CASCADE и нажмите DELETE. Что пропало?',
        'Попробуйте RESTRICT и SET NULL для аренд. Что стало с арендами и с самим шкафчиком?',
        'Подберите правила, при которых всё ненужное удаляется, а ценное защищено. Нажмите «Списать вместо удаления» и сравните.'
      ],
      look: 'Зачёркнутые красные строки — удалены. Жёлтая ячейка NULL — ссылку стёрли, строка осталась без родителя. Зелёная плашка с ошибкой — база запретила удаление, и ничего не изменилось. Под таблицами — чем это обернётся для клуба.'
    }),
    render(el) { odLab(add(el, 'stack')); }
  };

  // =====================================================================
  // 9. replica: как считать нагрузку
  // =====================================================================
  function decay(m, k) {
    // веса r^i, у которых первая минута в k раз больше средней
    k = Math.max(1, Math.min(k, m));
    if (k === 1 || m === 1) return Array(m).fill(1);
    let lo = 1e-6, hi = 1;
    for (let i = 0; i < 50; i++) { const r = (lo + hi) / 2, f = m * (1 - r) / (1 - Math.pow(r, m)); if (f > k) lo = r; else hi = r; }
    const r = (lo + hi) / 2; return Array.from({ length: m }, (_, i) => Math.pow(r, i));
  }
  function loadCalc(el) {
    const st = { people: 2000, win: 10, rd: 6, wr: 1, k: 3 };
    const F = [['people', 'Людей придёт', 500, 10000, 500], ['win', 'За сколько минут', 1, 60, 1], ['rd', 'Чтений на человека', 1, 20, 1], ['wr', 'Записей на человека', 0, 5, 1], ['k', 'Пиковый коэффициент', 1, 5, 0.5]];
    el.innerHTML = `<div class="small muted">Новогодний марафон «Пульса»: запись открывается в 12:00. Каждый посмотрит программу и расписание несколько раз (чтения — база только отдаёт данные) и запишется (запись — база сохраняет новое). Двигайте ползунки.</div>
      <div class="thd-inputs">${F.map(([k, t, mi, ma, s]) => `<label class="field"><span>${esc(t)}: <b data-out="${k}"></b></span><input type="range" class="thd-range" min="${mi}" max="${ma}" step="${s}" value="${st[k]}" data-ld="${k}" aria-label="${esc(t)}"></label>`).join('')}</div>
      <div data-bars></div><div data-calc></div>`;
    function draw() {
      F.forEach(([k]) => { TR.$(`[data-out="${k}"]`, el).textContent = k === 'k' ? '×' + String(st.k).replace('.', ',') : nf(st[k]); });
      const sec = st.win * 60, R = st.people * st.rd, Wt = st.people * st.wr;
      const rAvg = R / sec, wAvg = Wt / sec, kEff = Math.min(st.k, st.win), rPk = rAvg * kEff, wPk = wAvg * kEff, tot = rPk + wPk, cap = 5000;
      const w = decay(st.win, st.k), sum = w.reduce((a, b) => a + b, 0), perMin = w.map(x => x / sum * st.people), mx = Math.max(...perMin), avg = st.people / st.win;
      TR.$('[data-bars]', el).innerHTML = `<div class="thd-cap">Сколько людей приходит в каждую минуту окна</div><div class="thd-bars" role="img" aria-label="Распределение людей по минутам">${perMin.map((x, i) => `<i class="${i === 0 ? 'pk' : ''}" style="height:${Math.max(2, x / mx * 100)}%" title="${i + 1}-я минута: ${nf(x)} чел."></i>`).join('')}<span class="avg" style="bottom:${avg / mx * 100}%"></span></div>
        <div class="small dim">Оранжевый столбик — первая минута: <b>${nf(perMin[0])}</b> чел. Зелёный пунктир — среднее: <b>${nf(avg)}</b> чел. в минуту. Во сколько раз самая плотная минута больше средней — это и есть пиковый коэффициент.${st.k > st.win ? ' Окно короче коэффициента: больше, чем «все в первую минуту», не бывает.' : ''}</div>`;
      TR.$('[data-calc]', el).innerHTML = `<div class="grid2"><div class="thd-calc"><div class="eyebrow">Чтения</div>
          <div class="ln"><span>1. Всего: ${nf(st.people)} × ${st.rd}</span><b>${nf(R)}</b></div>
          <div class="ln"><span>2. Секунд в окне: ${st.win} × 60</span><b>${nf(sec)}</b></div>
          <div class="ln"><span>3. Среднее: ${nf(R)} ÷ ${nf(sec)}</span><b>${nf1(rAvg)}/с</b></div>
          <div class="ln tot"><span>4. В пик: × ${String(kEff).replace('.', ',')}</span><b>${nf1(rPk)}/с</b></div></div>
        <div class="thd-calc"><div class="eyebrow">Записи</div>
          <div class="ln"><span>1. Всего: ${nf(st.people)} × ${st.wr}</span><b>${nf(Wt)}</b></div>
          <div class="ln"><span>2. Секунд в окне</span><b>${nf(sec)}</b></div>
          <div class="ln"><span>3. Среднее: ${nf(Wt)} ÷ ${nf(sec)}</span><b>${nf1(wAvg)}/с</b></div>
          <div class="ln tot"><span>4. В пик: × ${String(kEff).replace('.', ',')}</span><b>${nf1(wPk)}/с</b></div></div></div>
        <div class="stack tight"><div class="row between"><span class="small">Пик всего: <b>${nf1(tot)}</b> запросов/с против ~${nf(cap)}/с, которые грубо держит одна PostgreSQL</span><span class="small tnum">${nf1(tot / cap * 100)} %</span></div>${ui.meter(tot / cap, tot / cap > 0.7 ? 'bad' : tot / cap > 0.3 ? 'warn' : '')}</div>
        <div class="thd-cons ${tot / cap > 0.7 ? 'bad' : 'ok'}">${tot / cap > 0.7 ? 'Близко к пределу одной машины: пора думать о кэше и разгрузке чтения.' : 'Запас большой. Считать под среднее за сутки было бы ошибкой — но и под пик это не тысячи запросов в секунду. Сначала посчитать, потом покупать серверы.'}</div>`;
    }
    el.addEventListener('input', e => { const i = e.target.closest('[data-ld]'); if (i) { st[i.dataset.ld] = +i.value; draw(); } });
    draw();
  }
  function loadVol(el) {
    const st = { day: 1500, years: 5, bytes: 200 };
    el.innerHTML = `<div class="small muted">Объём считают так же просто: строк в день × дней в году × лет хранения × размер строки. Пример — покупки в баре, которые храним 5 лет для налоговой.</div>
      <div class="thd-inputs"><label class="field"><span>Покупок в день по сети: <b data-out="day"></b></span><input type="range" class="thd-range" min="100" max="20000" step="100" value="${st.day}" data-vl="day"></label>
      <label class="field"><span>Лет хранения: <b data-out="years"></b></span><input type="range" class="thd-range" min="1" max="10" step="1" value="${st.years}" data-vl="years"></label>
      <label class="field"><span>Байт на строку с индексами: <b data-out="bytes"></b></span><input type="range" class="thd-range" min="100" max="1000" step="50" value="${st.bytes}" data-vl="bytes"></label></div><div data-o></div>`;
    function draw() {
      ['day', 'years', 'bytes'].forEach(k => { TR.$(`[data-out="${k}"]`, el).textContent = nf(st[k]); });
      const rows = st.day * 365 * st.years, gb = rows * st.bytes / 1073741824;
      TR.$('[data-o]', el).innerHTML = `<div class="thd-calc"><div class="ln"><span>Строк за год: ${nf(st.day)} × 365</span><b>${nf(st.day * 365)}</b></div><div class="ln"><span>За ${st.years} ${TR.plural(st.years, 'год', 'года', 'лет')}</span><b>${nf(rows)}</b></div><div class="ln tot"><span>Объём: строки × ${st.bytes} байт</span><b>${gb < 1 ? nf1(gb * 1024) + ' МБ' : nf1(gb) + ' ГБ'}</b></div></div>
        <div class="thd-cons ${gb > 500 ? 'warn' : 'ok'}">${gb > 500 ? 'Сотни гигабайт: стоит заранее решить, как удалять старое целыми кусками.' : 'Для одной базы это немного. Важнее другое: как раз в год убирать самые старые строки, не нагружая базу долгим удалением.'}</div>`;
    }
    el.addEventListener('input', e => { const i = e.target.closest('[data-vl]'); if (i) { st[i.dataset.vl] = +i.value; draw(); } });
    draw();
  }
  const howLoad = {
    id: 'how-load', covers: ['load'], title: 'Как это работает: как считать нагрузку', free: true, noReset: true,
    simple: {
      icon: '🧮', plain: 'Нагрузку считают под самый тяжёлый момент, а не под среднее за день. Четыре действия: всего действий → разделить на секунды окна → умножить на пиковый коэффициент.',
      analogy: 'Раздевалка в 19:00. За вечер приходят 300 человек — вроде немного. Но половина приходит за 15 минут до начала групповых занятий. Шкафчиков и мест на скамейках считают под эти 15 минут, а не «300 за вечер».',
      tech: 'Пик в секунду = (люди × действий на человека) ÷ секунд в окне × пиковый коэффициент. Чтения и записи считают отдельно: их по-разному разгружают. Пиковый коэффициент — во сколько раз самая плотная минута больше средней. Объём = строк в день × 365 × лет хранения × байт на строку.'
    },
    lead: ui.brief({
      situation: 'Перед расчётом воскресенья 20:00 потренируемся на другом событии: запись на новогодний марафон «Пульса». Числа здесь свои — в практике будут цифры из блокнота.',
      todo: [
        '«Пиковая нагрузка»: двигайте ползунки и следите за четырьмя шагами расчёта для чтений и записей.',
        'Поставьте пиковый коэффициент ×1, затем ×5 и посмотрите на столбики: как распределены люди по минутам окна.',
        '«Объём данных»: посчитайте, сколько места займут покупки бара за 5 лет.'
      ],
      look: 'Столбики — сколько людей приходит в каждую минуту окна. Оранжевый — самая плотная минута, зелёный пунктир — среднее. Полоса внизу сравнивает пик с грубым ориентиром: одна PostgreSQL держит ~5 000 простых запросов в секунду. Чем короче полоса, тем больше запас.'
    }),
    render(el) { tabs(el, [{ id: 'peak', t: 'Пиковая нагрузка', render: loadCalc }, { id: 'vol', t: 'Объём данных', render: loadVol }]); }
  };

  // =====================================================================
  // 10. replica: мастер, реплика, лаг и бэкап
  // =====================================================================
  function repLag(el) {
    const st = { lag: 2, master: 500, replica: 500, queue: [], log: [] };
    let timer = null;
    el.innerHTML = `<div class="small muted">Анна платит бонусами за коктейль в баре. Списание записывается на мастер — главную базу. Реплика — копия на другой машине — повторяет каждое изменение, но с опозданием (лагом). Приложение показывает баланс.</div>
      <label class="field"><span>Лаг реплики: <b data-lv></b></span><input type="range" class="thd-range" min="0" max="5" step="0.5" value="${st.lag}" data-r aria-label="Лаг реплики в секундах"></label>
      <div class="thd-btns"><button type="button" class="btn sm primary" data-rp="w">Анна потратила 90 бонусов</button><button type="button" class="btn sm" data-rp="rr">Прочитать баланс с реплики</button><button type="button" class="btn sm" data-rp="rm">Прочитать с мастера</button></div>
      <div class="thd-db" data-n></div><div class="thd-log" data-log></div><div data-note></div>`;
    function tick() {
      if (!el.isConnected) { clearInterval(timer); timer = null; return; }
      const now = Date.now();
      while (st.queue.length && now - st.queue[0].at >= st.lag * 1000) st.replica = st.queue.shift().v;
      if (!st.queue.length) { clearInterval(timer); timer = null; }
      drawNodes();
    }
    function drawNodes() {
      const stale = st.replica !== st.master;
      const left = st.queue.length ? Math.max(0, st.lag - (Date.now() - st.queue[0].at) / 1000) : 0;
      TR.$('[data-lv]', el).textContent = String(st.lag).replace('.', ',') + ' с';
      TR.$('[data-n]', el).innerHTML = `<div class="thd-node ok"><span class="s">Мастер — сюда пишут</span><span class="v">${st.master}</span><span class="s">бонусов у Анны</span></div>
        <div class="thd-node ${st.queue.length ? 'warn' : ''}"><span class="s">В пути — журнал изменений</span><span class="v">${st.queue.length}</span><span class="s">${st.queue.length ? `дойдёт через ${left.toFixed(1).replace('.', ',')} с` : 'всё доставлено'}</span></div>
        <div class="thd-node ${stale ? 'bad' : 'ok'}"><span class="s">Реплика — копия</span><span class="v">${st.replica}</span><span class="s">${stale ? 'отстаёт от мастера' : 'совпадает с мастером'}</span></div>`;
    }
    function drawLog() { TR.$('[data-log]', el).innerHTML = st.log.slice(-6).map(x => `<div class="${x.k}">${x.t}</div>`).join(''); }
    TR.on(el, 'click', '[data-rp]', (e, b) => {
      const a = b.dataset.rp;
      if (a === 'w') {
        if (st.master < 90) { st.log.push({ k: '', t: 'Бонусов не хватает. Нажмите ещё раз позже — или обновите страницу раздела.' }); }
        else {
          st.master -= 90; st.queue.push({ v: st.master, at: Date.now() });
          st.log.push({ k: '', t: `Мастер: списано 90 → <b>${st.master}</b>. Изменение ушло в журнал для реплики.` });
          if (st.lag === 0) { st.replica = st.master; st.queue = []; }
          else if (!timer) timer = setInterval(tick, 100);
        }
      }
      if (a === 'rr') {
        const stale = st.replica !== st.master;
        st.log.push({ k: stale ? 'bad' : 'ok', t: stale ? `Реплика ответила <b>${st.replica}</b> — устарело, на мастере уже ${st.master}. Анна думает, что оплата не прошла, и платит ещё раз.` : `Реплика ответила <b>${st.replica}</b> — совпадает с мастером.` });
        TR.$('[data-note]', el).innerHTML = stale ? ui.note('warn', 'Почему так', 'Реплика честно показывает прошлое: изменение ещё в пути. Для отчёта директору это не страшно. Для «мой баланс сразу после оплаты» — страшно. Правило: свои только что сделанные изменения читаем с мастера (read-your-writes), с реплики — то, что может подождать.') : '';
      }
      if (a === 'rm') st.log.push({ k: 'ok', t: `Мастер ответил <b>${st.master}</b> — всегда свежее.` });
      drawNodes(); drawLog();
    });
    el.addEventListener('input', e => { if (e.target.matches('[data-r]')) { st.lag = +e.target.value; drawNodes(); } });
    drawNodes(); drawLog();
  }
  const REP_LANES = [L('app', 'Приложение', 'Анна платит 900 ₽'), L('m', 'Мастер', 'главная база'), L('r', 'Реплика', 'в другой зоне')];
  const REP_STEPS = {
    sync: [
      { from: 'app', to: 'm', t: 'оплата аренды 900 ₽', note: 'Анна оплачивает месяц аренды шкафчика. Запрос пишет на мастер.' },
      { from: 'm', to: 'm', t: 'записать в журнал', note: 'Мастер записывает изменение в свой журнал (WAL).' },
      { from: 'm', to: 'r', t: 'журнал: оплата', note: 'Мастер отправляет запись реплике и <b>ждёт</b> подтверждения.' },
      { from: 'r', to: 'm', t: 'сохранила', reply: true, kind: 'ok', note: 'Реплика сохранила журнал у себя на диске.' },
      { from: 'm', to: 'app', t: 'готово (+2 мс)', reply: true, kind: 'ok', note: 'Только теперь мастер отвечает «готово». Цена — пара миллисекунд на ожидание реплики.' },
      { from: 'm', to: 'm', t: '💥 мастер упал', kind: 'bad', note: 'Сразу после ответа у мастера сгорел диск.' },
      { from: 'r', to: 'r', t: 'стала мастером', kind: 'ok', note: 'Реплика автоматически становится новым мастером (failover) — меньше чем за минуту.' },
      { from: 'app', to: 'r', t: 'оплата на месте', box: true, kind: 'ok', note: 'Оплата Анны есть в новой главной базе. Ничего не потеряно.' }
    ],
    async: [
      { from: 'app', to: 'm', t: 'оплата аренды 900 ₽', note: 'Анна оплачивает месяц аренды шкафчика. Запрос пишет на мастер.' },
      { from: 'm', to: 'm', t: 'записать в журнал', note: 'Мастер записывает изменение в свой журнал.' },
      { from: 'm', to: 'app', t: 'готово', reply: true, kind: 'ok', note: 'Мастер отвечает сразу, реплику не ждёт. Быстро.' },
      { from: 'm', to: 'r', t: 'журнал: оплата', lost: true, kind: 'bad', note: 'Журнал отправлен реплике, но не дошёл: лаг. И в этот момент…' },
      { from: 'm', to: 'm', t: '💥 мастер упал', kind: 'bad', note: '…у мастера сгорел диск.' },
      { from: 'r', to: 'r', t: 'стала мастером', kind: 'warn', note: 'Реплика становится мастером — но последних секунд у неё нет.' },
      { from: 'app', to: 'r', t: 'оплаты нет: деньги списаны, аренды нет', box: true, kind: 'bad', note: 'Анна заплатила 900 ₽ и видела «готово». В новой главной базе оплаты нет.' }
    ]
  };
  function repSync(el) {
    let mode = 'sync';
    el.innerHTML = `<div class="small muted">Синхронная реплика: мастер говорит «готово», только когда копия подтвердила запись. Асинхронная: мастер отвечает сразу, копия догоняет. Посмотрим, что будет, если мастер упадёт через миг после ответа.</div>
      <div class="row"><span class="small dim">Реплика:</span>${ui.seg('rs', [{ v: 'sync', t: 'синхронная' }, { v: 'async', t: 'асинхронная' }], mode, 'accent')}</div>
      <div class="grid2" data-st></div><div data-seq></div>
      <details class="more"><summary>Как сказать это заказчику</summary><div><p>Без слов «реплика» и «журнал». Схема: <b>риск → цена риска → цена защиты</b>.</p><p>«Если сервер сгорит вечером, без копии час никто не сможет ни арендовать шкафчик, ни открыть оплаченный, а последние оплаты могут пропасть. С копией, которая подтверждает каждую оплату, через полминуты всё работает и ни одна оплата не теряется. Цена — ещё одна машина в счёте за облако».</p></div></details>`;
    const seq = ui.seq(TR.$('[data-seq]', el), { lanes: REP_LANES, steps: REP_STEPS[mode], title: 'Запись и падение мастера' });
    function stats() {
      TR.$('[data-st]', el).innerHTML = mode === 'sync'
        ? '<div class="stat"><span class="k">время записи</span><span class="v warn">+2 мс</span><span class="s">мастер ждёт подтверждения реплики</span></div><div class="stat"><span class="k">потеряно при аварии</span><span class="v ok">0 оплат</span><span class="s">всё подтверждённое уже в двух местах</span></div>'
        : '<div class="stat"><span class="k">время записи</span><span class="v ok">+0 мс</span><span class="s">мастер отвечает сразу</span></div><div class="stat"><span class="k">потеряно при аварии</span><span class="v bad">последние секунды</span><span class="s">всё, что не успело доехать (лаг)</span></div>';
    }
    ui.onSeg(el, (n, v) => { if (n === 'rs') { mode = v; seq.set(REP_STEPS[mode]); stats(); } });
    stats();
  }
  const BK_ROWS = [{ id: 1, t: 'вчера 21:40', who: 'Пётр Орлов' }, { id: 2, t: '09:15', who: 'Анна Смирнова' }, { id: 3, t: '12:40', who: 'Дмитрий Ковалёв' }, { id: 4, t: '18:10', who: 'Ольга Белова' }, { id: 5, t: '20:02', who: 'Игорь Ким' }];
  function repBackup(el) {
    const st = { master: BK_ROWS.map(r => r.id), replica: BK_ROWS.map(r => r.id), target: 'pitr', phase: 'ok' };
    el.innerHTML = `<div class="small muted">Воскресенье, 20:15. Сотрудник хотел удалить одну тестовую аренду, но забыл условие WHERE. Бэкап: снимок базы каждую ночь в 03:00 плюс непрерывный архив журнала изменений.</div>
      <div class="thd-btns"><button type="button" class="btn sm danger" data-bk="del">DELETE FROM locker_rental;  — без WHERE</button><button type="button" class="btn sm ghost" data-bk="reset">⟲ Как было</button></div>
      <div class="row"><span class="small dim">Восстановить на:</span>${ui.seg('bt', [{ v: 'snap', t: '03:00 — только ночной снимок' }, { v: 'pitr', t: '20:14:59 — снимок + журнал' }], st.target, 'accent')}<button type="button" class="btn sm primary" data-bk="restore">Восстановить мастер</button></div>
      <div class="thd-db" data-n></div><div data-msg></div>`;
    let t1 = null;
    const list = ids => ids.length ? `<ul>${BK_ROWS.filter(r => ids.includes(r.id)).map(r => `<li>${esc(r.who)} <span class="dim">· ${esc(r.t)}</span></li>`).join('')}</ul>` : '<span class="s">пусто</span>';
    function draw(msg) {
      const full = BK_ROWS.length;
      TR.$('[data-n]', el).innerHTML = `<div class="thd-node ${st.master.length === full ? 'ok' : 'bad'}"><span class="s">Мастер</span><span class="v">${st.master.length} ${TR.plural(st.master.length, 'аренда', 'аренды', 'аренд')}</span>${list(st.master)}</div>
        <div class="thd-node ${st.replica.length === full ? 'ok' : 'bad'}"><span class="s">Реплика</span><span class="v">${st.replica.length}</span>${list(st.replica)}</div>
        <div class="thd-node ok"><span class="s">Бэкап</span><span class="v">снимок 03:00</span><span class="s">в снимке: 1 аренда (вчерашняя)</span><span class="s">+ архив журнала: все изменения до 20:15</span></div>`;
      if (msg !== undefined) TR.$('[data-msg]', el).innerHTML = msg;
    }
    TR.on(el, 'click', '[data-bk]', (e, b) => {
      const a = b.dataset.bk;
      if (a === 'reset') { clearTimeout(t1); st.master = BK_ROWS.map(r => r.id); st.replica = BK_ROWS.map(r => r.id); draw(''); }
      if (a === 'del') {
        st.master = []; draw(ui.note('bad', 'Мастер: DELETE 5', 'Все аренды стёрты. Смотрите на реплику…'));
        clearTimeout(t1);
        t1 = setTimeout(() => { if (!el.isConnected) return; st.replica = []; draw(ui.note('bad', 'Реплика повторила удаление', 'Через доли секунды реплика послушно повторила DELETE — она копирует всё, и ошибки тоже. Реплика спасает от сгоревшего сервера, но не от ошибки человека или программы. Спасти может только бэкап.')); }, 700);
      }
      if (a === 'restore') {
        clearTimeout(t1);
        if (st.target === 'snap') { st.master = [1]; st.replica = [1]; draw(ui.note('warn', 'Восстановлено на 03:00', 'Вернулась только вчерашняя аренда. Всё, что сделали сегодня с 03:00 до 20:15, — четыре аренды и оплаты к ним — потеряно. Снимок без журнала возвращает «на вчера».')); }
        else { st.master = BK_ROWS.map(r => r.id); st.replica = BK_ROWS.map(r => r.id); draw(ui.note('ok', 'Восстановлено на 20:14:59', 'Взяли ночной снимок и «проиграли» по архиву журнала все изменения до минуты перед ошибкой (PITR — восстановление на момент времени). Вернулись все пять аренд. Реплики потом заново копируют восстановленный мастер.')); }
      }
    });
    ui.onSeg(el, (n, v) => { if (n === 'bt') st.target = v; });
    draw('');
  }
  const howReplica = {
    id: 'how-replica', covers: ['why', 'lab', 'olga', 'backup'], title: 'Как это работает: мастер, реплика, лаг и бэкап', free: true, noReset: true,
    simple: {
      icon: '🪞', plain: 'Мастер — главная база, все изменения пишут в неё. Реплика — копия на другой машине, которая повторяет каждое изменение. Бэкап — копия на прошлый момент, из которой можно вернуть данные.',
      analogy: 'Дубликат ключей у соседа: потеряли свои — через пять минут вы дома. Но если вы сами забыли выключить утюг, дубликат не поможет: он повторяет всё. От этого спасает только страховка — бэкап.',
      tech: 'Мастер (primary) пишет журнал изменений (WAL) и передаёт его репликам (standby). Синхронная реплика подтверждает запись до ответа клиенту: без потерь, но +мс к записи. Асинхронная отстаёт на лаг: при аварии теряются последние секунды, а чтение с неё может вернуть устаревшее. Реплика не бэкап: DELETE без WHERE она повторит. Бэкап — снимок + архив журнала, восстановление на любую минуту (PITR).'
    },
    lead: ui.brief({
      situation: 'Механику копий разберём на аренде шкафчиков и бонусах в баре клуба. В практике вы будете решать, зачем копии «Пульсу», ломать их в лаборатории и объяснять Ольге — здесь смотрим, как они устроены.',
      todo: [
        '«Лаг и чтение»: поставьте лаг 3 секунды, потратьте бонусы и сразу прочитайте баланс с реплики, потом с мастера.',
        '«Синхронная или асинхронная»: пройдите по шагам оба варианта. Что стоит синхронность и что даёт?',
        '«Реплика — не бэкап»: выполните DELETE без WHERE и посмотрите на реплику. Затем восстановите мастер двумя способами и сравните.'
      ],
      look: 'Карточки — машины: мастер, путь журнала, реплика, бэкап. Красная — данные не совпадают с правдой или пропали. На схеме сплошная стрелка — запрос, пунктир — ответ, красный крест — сообщение не дошло.'
    }),
    render(el) { tabs(el, [{ id: 'lag', t: 'Лаг и чтение', render: repLag }, { id: 'sync', t: 'Синхронная или асинхронная', render: repSync }, { id: 'bk', t: 'Реплика — не бэкап', render: repBackup }]); }
  };

  // ---------- вставка в тренировки ----------
  function addTheory(stageId, task) {
    const s = TR.stageById(stageId); if (!s) return;
    if (s.tasks.some(x => x.id === task.id)) return;
    s.tasks.push(task);
  }
  addTheory('interview-biz', howAsk);
  addTheory('interview-tech', howSystems);
  addTheory('concept', howEntities);
  addTheory('logical', howKeys);
  addTheory('logical', howTimeMoney);
  addTheory('normal', howNf);
  addTheory('physical', howConstraints);
  addTheory('physical', howOnDelete);
  addTheory('replica', howLoad);
  addTheory('replica', howReplica);
  TR.glossary([{ term: 'Висячая ссылка', simple: 'Ссылка на строку, которой нет: браслет на несуществующий шкафчик.', tech: 'Значение внешнего столбца без пары в целевой таблице. Внешний ключ (FK) не даёт её создать.' }], 'logical');
  TR.glossary([{ term: 'Транзитивная зависимость', simple: 'Зависимость через посредника: тренировка → клуб → адрес клуба.', tech: 'Неключевой столбец зависит от другого неключевого. Убирается при приведении к 3НФ.' }], 'normal');
  TR.glossary([{ term: 'Мягкое удаление', simple: 'Не стирать строку, а пометить: «шкафчик списан». История и ссылки остаются целы.', tech: 'UPDATE статуса (или deleted_at) вместо DELETE. Для персональных данных — обезличивание.' }], 'physical');
  TR.glossary([{ term: 'Пиковый коэффициент', simple: 'Во сколько раз самая загруженная минута больше средней. Все приходят в раздевалку к 19:00, а не равномерно за вечер.', tech: 'Множитель к средней нагрузке за окно; систему считают под пик, а не под среднее.' }], 'replica');
})();
