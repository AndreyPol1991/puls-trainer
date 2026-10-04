/* Неделя 5, четверг 10:00: transactional outbox и итоговая согласованность.
   Теория: двойная запись (база + брокер) и её сбои; outbox + ретранслятор или CDC (Debezium) + inbox у потребителя;
   итоговая согласованность — что и когда видно после записи.
   Практика: лаборатория «запись есть, а бонусов и пуша нет», проект таблицы outbox и ретранслятора, где берутся дубли, требование для разработчиков. */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc;
  const ID = 'mq-outbox';

  if (!document.getElementById('mqo-css')) document.head.insertAdjacentHTML('beforeend', `<style id="mqo-css">
    .mqo-root, .mqo-root .stack { min-width: 0; }
    .mqo-root .stack > * { min-width: 0; }
    .mqo-root :not(pre) > code { white-space: normal; overflow-wrap: anywhere; }
    .mqo-root .seg button { white-space: normal; text-align: left; }
    .mqo-box { display: grid; gap: 12px; padding: 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); min-width: 0; }
    .mqo-box > * { min-width: 0; }
    .mqo-set { display: grid; grid-template-columns: minmax(0, 200px) minmax(0, 1fr); gap: 8px 14px; align-items: center; }
    .mqo-set > .lbl { font-size: 13.5px; color: var(--text-2); min-width: 0; }
    .mqo-set > .seg { justify-self: start; max-width: 100%; }
    .mqo-state { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .mqo-state .stat { min-width: 0; }
    .mqo-state .v { font-size: 16px; }
    .mqo-cols { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .mqo-cols .card { min-width: 0; display: grid; gap: 6px; align-content: start; }
    .mqo-cols h4 { margin: 0; font-size: 13.5px; }
    .mqo-row { font: 12px/1.45 var(--f-mono); padding: 4px 7px; border-radius: 6px; background: var(--surface-3); overflow-wrap: anywhere; }
    .mqo-row.new { background: color-mix(in srgb, var(--warn) 18%, var(--surface-3)); }
    .mqo-row.ok { background: color-mix(in srgb, var(--ok) 16%, var(--surface-3)); }
    .mqo-row.dup { background: color-mix(in srgb, var(--bad) 18%, var(--surface-3)); }
    .mqo-btns { display: flex; flex-wrap: wrap; gap: 8px; }
    .mqo-btns .btn { white-space: normal; }
    .mqo-log { font: 12.5px/1.6 var(--f-mono); background: var(--code-bg); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; max-height: 190px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; }
    .mqo-log .ok { color: var(--ok); } .mqo-log .bad { color: var(--bad); } .mqo-log .warn { color: var(--warn); } .mqo-log .info { color: var(--info); }
    .mqo-mx td, .mqo-mx th { text-align: center; }
    .mqo-mx td:first-child, .mqo-mx th:first-child { text-align: left; }
    .mqo-tl { display: grid; gap: 8px; }
    .mqo-tl .r { display: grid; grid-template-columns: minmax(0, 220px) minmax(0, 1fr) 76px; gap: 10px; align-items: center; font-size: 13.5px; }
    .mqo-tl .bar { position: relative; height: 14px; border-radius: 7px; background: var(--surface-3); overflow: hidden; }
    .mqo-tl .bar i { position: absolute; top: 0; bottom: 0; left: 0; background: color-mix(in srgb, var(--accent) 35%, transparent); }
    .mqo-tl .bar b { position: absolute; top: -2px; bottom: -2px; width: 2px; background: var(--text); }
    .mqo-tl .st { font: 600 12px/1.2 var(--f-mono); text-align: right; white-space: nowrap; }
    .mqo-tl .st.ok { color: var(--ok); } .mqo-tl .st.wait { color: var(--warn); }
    .mqo-tl .ax { display: grid; grid-template-columns: minmax(0, 220px) minmax(0, 1fr) 76px; gap: 10px; font: 11px/1 var(--f-mono); color: var(--text-muted); }
    .mqo-tl .ax .ticks { display: flex; justify-content: space-between; }
    @media (max-width: 640px) {
      .mqo-set { grid-template-columns: minmax(0, 1fr); gap: 4px; }
      .mqo-set > .lbl { margin-top: 8px; }
      .mqo-state, .mqo-cols { grid-template-columns: minmax(0, 1fr); }
      .mqo-tl .r, .mqo-tl .ax { grid-template-columns: minmax(0, 1fr) 84px; }
      .mqo-tl .r .bar { grid-column: 1 / -1; grid-row: 2; }
      .mqo-tl .ax > span:first-child, .mqo-tl .ax > span:last-child { display: none; }
      .mqo-tl .ax { grid-template-columns: minmax(0, 1fr); }
    }
  </style>`);

  const L = (id, t, sub) => ({ id, t, sub });
  const lock = (el, ro) => { if (ro) TR.$$('[data-seg] button', el).forEach(b => { b.disabled = true; }); };
  const mount = (el, cls) => { const d = document.createElement('div'); if (cls) d.className = cls; el.appendChild(d); return d; };
  const tOf = (list, v) => { const x = list.find(o => o.v === v); return x ? String(x.t).replace(/<[^>]+>/g, '') : '—'; };

  // серия тестов: ответы в ans.q[i]
  function quizSet(el, ctx, QS) {
    QS.forEach((cfg, i) => {
      const d = mount(el, 'card flat');
      ui.quiz(d, Object.assign({}, cfg, {
        value: (ctx.ans.q || [])[i] || [], readonly: ctx.readonly, reveal: ctx.result,
        onChange: v => { const q = (ctx.ans.q || []).slice(); q[i] = v; ctx.ans.q = q; ctx.save(); }
      }));
    });
  }
  const quizRes = (QS, q) => QS.map((cfg, i) => ui.quizScore(cfg, (q || [])[i] || []));
  const quizRef = QS => QS.map(cfg => cfg.options.map((o, i) => o.ok ? i : -1).filter(i => i >= 0));
  const quizReport = (QS, q) => QS.map((cfg, i) => {
    const v = (q || [])[i] || [];
    const pick = v.map(j => cfg.options[j] ? String(cfg.options[j].t).replace(/<[^>]+>/g, '') : '?').join('; ') || '—';
    return `- ${String(cfg.q).replace(/<[^>]+>/g, '')}\n  → ${pick} ${ui.quizScore(cfg, v).ok ? '✓' : '✗'}`;
  }).join('\n');

  // =====================================================================
  // Теория 1. Двойная запись
  // =====================================================================
  const DW_LANES = [L('svc', 'Модуль «Абонементы»', 'ядро'), L('db', 'PostgreSQL', 'membership_freeze'), L('k', 'Kafka', 'membership.events'), L('acc', '«Доступ»', 'турникеты')];
  function dualSteps(order, fail) {
    const S = [];
    const tx = (k, n) => S.push({ from: 'svc', to: 'db', t: 'BEGIN · INSERT заморозка', kind: k || '', note: n || 'Олег замораживает абонемент на 14 дней. Модуль открывает транзакцию и пишет строку заморозки, срок абонемента сдвигается.' });
    const send = () => S.push({ from: 'svc', to: 'k', t: 'MembershipFrozen', note: 'Модуль публикует событие «абонемент заморожен» в <code>puls.membership.events.v1</code>.' });
    const deliver = (ghost) => {
      S.push({ from: 'k', to: 'acc', t: 'MembershipFrozen', kind: ghost ? 'bad' : '', note: ghost ? '«Доступ» получает событие и верит ему: в базе заморозки нет, но кто об этом скажет?' : '«Доступ» получает событие.' });
      S.push({ from: 'acc', to: 'acc', t: 'Олега не пускать', kind: ghost ? 'bad' : 'ok', note: ghost ? 'Турникет не пускает Олега с действующим абонементом. Олег у ресепшена, администратор видит в кабинете «абонемент активен» и ничего не понимает.' : 'Список пропусков обновлён: абонемент заморожен — турникет не пустит.' });
    };
    if (order === 'db') {
      tx();
      if (fail === 'rollback') {
        S.push({ from: 'db', to: 'svc', t: '✗ нарушено правило: кусок < 7 дней', reply: true, kind: 'warn', note: 'База отказала: заморозка короче 7 дней (правило F-freeze). Транзакция откатилась.' });
        S.push({ from: 'svc', to: 'svc', t: 'событие не отправляем', kind: 'ok', note: 'Раз в базе ничего не изменилось, событие и не нужно. Олег увидит ошибку и выберет другой срок.' });
        return S;
      }
      S.push({ from: 'svc', to: 'db', t: 'COMMIT', kind: 'ok', note: 'Заморозка сохранена.' });
      if (fail === 'crash') {
        S.push({ from: 'svc', to: 'db', box: true, t: '💥 сервис упал до отправки', kind: 'bad', note: 'Выкатка новой версии: процесс остановили ровно между COMMIT и отправкой.' });
        S.push({ from: 'k', to: 'acc', t: 'ничего не пришло', lost: true, kind: 'bad', note: 'Событие потеряно. В базе Олег заморожен, а турникеты об этом не знают и пускают его. Уведомления «заморозка оформлена» тоже нет.' });
        return S;
      }
      send(); deliver(false);
      return S;
    }
    send();
    S.push({ from: 'k', to: 'svc', t: 'ack', reply: true });
    if (fail === 'crash') {
      tx();
      S.push({ from: 'svc', to: 'db', box: true, t: '💥 сервис упал до COMMIT', kind: 'bad', note: 'Процесс убит. Соединение с базой оборвалось — PostgreSQL откатывает незавершённую транзакцию.' });
      S.push({ from: 'db', to: 'db', t: 'ROLLBACK: заморозки нет', kind: 'bad' });
      deliver(true); return S;
    }
    if (fail === 'rollback') {
      tx('', 'Событие уже ушло. Теперь модуль пишет заморозку в базу.');
      S.push({ from: 'db', to: 'svc', t: '✗ нарушено правило: кусок < 7 дней', reply: true, kind: 'bad', note: 'База отказала: заморозка короче 7 дней. Транзакция откатилась — а событие уже в Kafka, вернуть его нельзя.' });
      deliver(true); return S;
    }
    tx(); S.push({ from: 'svc', to: 'db', t: 'COMMIT', kind: 'ok' }); deliver(false);
    return S;
  }
  function dualRes(order, fail) {
    if (order === 'db') return fail === 'crash' ? ['bad', 'Потерянное событие', 'В базе заморозка есть, в Kafka события нет.'] : ['ok', 'Согласовано', fail === 'rollback' ? 'Нет ни заморозки, ни события.' : 'Заморозка есть, событие есть.'];
    return fail === 'none' ? ['ok', 'Согласовано', 'Заморозка есть, событие есть.'] : ['bad', 'Призрачное событие', 'В базе заморозки нет, а событие о ней ушло.'];
  }
  const howDual = {
    id: 'how-dual', covers: ['no-bonus'], title: 'Как это работает: двойная запись', free: true, noReset: true,
    simple: {
      icon: '✌️',
      plain: 'Модулю надо сделать две вещи: сохранить изменение в своей базе и сообщить о нём в Kafka. Это две разные системы, общей транзакции у них нет. Между двумя действиями можно упасть — и тогда одно случилось, а другое нет.',
      analogy: 'Вы переводите деньги другу и пишете ему «скинул». Отправили сообщение, а перевод банк отклонил — друг ждёт денег, которых нет («призрачное» сообщение). Перевели, а сообщение не ушло — деньги пришли, а друг не знает (потерянное сообщение).',
      tech: '<b>Двойная запись</b> (dual write): изменение в БД и публикация в брокер без общей транзакции. Порядок «БД → брокер» даёт <b>потерянные события</b> (упали после COMMIT), порядок «брокер → БД» — <b>призрачные события</b> (событие ушло, транзакция откатилась). 2PC между PostgreSQL и Kafka не используют.'
    },
    lead: ui.brief({
      situation: 'Соседний пример — заморозка абонемента. Олег замораживает абонемент на 14 дней. Модуль «Абонементы» сохраняет заморозку в PostgreSQL и публикует <code>MembershipFrozen</code> в Kafka. Сервис «Доступ» по этому событию обновляет список пропусков турникетов.',
      todo: [
        'Выберите порядок «сначала база, потом Kafka» и прогоните три варианта: без сбоя, «💥 упали между действиями», «⛔ база отказала».',
        'Переключите на «сначала Kafka, потом база» и прогоните те же три.',
        'Сравните итоги в таблице: где событие теряется, а где появляется «призрак».'
      ],
      look: 'Колонки — модуль, база, Kafka, «Доступ». Стрелка — запрос, пунктир — ответ, красный крест — ничего не дошло. Над схемой — что в итоге в базе, в Kafka и на турникете. Таблица под схемой заполняется по мере прогонов.'
    }),
    render(el) {
      el.classList.add('mqo-root');
      let order = 'db', fail = 'none'; const seen = {};
      el.innerHTML = `<div class="stack">
        <div class="mqo-box"><div class="mqo-set">
          <div class="lbl">Порядок в коде</div>${ui.seg('dwo', [{ v: 'db', t: 'сначала база, потом Kafka' }, { v: 'k', t: 'сначала Kafka, потом база' }], order, 'accent')}
          <div class="lbl">Что случилось</div>${ui.seg('dwf', [{ v: 'none', t: 'без сбоя' }, { v: 'crash', t: '💥 упали между действиями' }, { v: 'rollback', t: '⛔ база отказала' }], fail)}
        </div></div>
        <div data-st></div><div data-sq></div><div data-mx></div>
      </div>`;
      const stEl = TR.$('[data-st]', el), mxEl = TR.$('[data-mx]', el);
      function drawSt() {
        const r = dualRes(order, fail);
        const inDb = order === 'db' ? fail !== 'rollback' : fail === 'none';
        const inK = order === 'db' ? fail === 'none' : true;
        stEl.innerHTML = `<div class="mqo-state">
          <div class="stat"><div class="k">В базе</div><div class="v ${inDb ? 'ok' : ''}">${inDb ? 'заморожен' : 'не заморожен'}</div></div>
          <div class="stat"><div class="k">В Kafka</div><div class="v ${inK ? 'ok' : ''}">${inK ? 'событие есть' : 'события нет'}</div></div>
          <div class="stat"><div class="k">Итог</div><div class="v ${r[0]}">${r[1]}</div><div class="s small dim">${r[2]}</div></div></div>`;
        seen[order + fail] = true;
        mxEl.innerHTML = ui.table(['Порядок', 'без сбоя', 'упали между', 'база отказала'], [['db', 'сначала база'], ['k', 'сначала Kafka']].map(([o, t]) => [t].concat(['none', 'crash', 'rollback'].map(f => { if (!seen[o + f]) return '<span class="dim">—</span>'; const x = dualRes(o, f); return `<span class="status ${x[0]}">${x[1]}</span>`; })))).replace('class="tbl"', 'class="tbl mqo-mx"');
      }
      const sq = ui.seq(TR.$('[data-sq]', el), { lanes: DW_LANES, steps: dualSteps(order, fail), laneW: 165, title: 'Двойная запись: база и Kafka', hint: 'Нажмите «Проиграть» или «Шаг →».' });
      ui.onSeg(el, (n, v) => { if (n === 'dwo') order = v; if (n === 'dwf') fail = v; sq.set(dualSteps(order, fail), { play: true }); drawSt(); });
      drawSt();
      el.querySelector('.stack').insertAdjacentHTML('beforeend', ui.note('', 'Почему не «одна транзакция на двоих»', 'Двухфазная фиксация (2PC) между PostgreSQL и Kafka на практике не используется: Kafka в ней не участвует, а держать блокировки строк на время ответа брокера в пик нельзя. Нужен способ, при котором модуль пишет <b>только в свою базу</b>, а событие доезжает до Kafka потом — гарантированно. Это следующий раздел.'));
    }
  };

  // =====================================================================
  // Теория 2. Outbox, ретранслятор, CDC, inbox
  // =====================================================================
  const howOutbox = {
    id: 'how-outbox', covers: ['outbox-design', 'dup-where'], title: 'Как это работает: outbox, ретранслятор и inbox', free: true, noReset: true,
    simple: {
      icon: '📮',
      plain: 'Модуль не отправляет событие сам. В той же транзакции, что и изменение, он кладёт письмо в «ящик исходящих» — таблицу outbox в своей же базе. Отдельный почтальон (ретранслятор) забирает письма из ящика и относит в Kafka. Потребитель ведёт журнал полученных (inbox), чтобы не выполнить одно письмо дважды.',
      analogy: 'Ресепшен клуба: администратор оформил заморозку и тут же положил в лоток «исходящие» записку для охраны. Записка и заморозка появляются одновременно — или не появляются вовсе. Курьер раз в минуту обходит лоток и разносит записки. Если курьер не уверен, что отдал, он отнесёт ещё раз — а охрана сверит номер записки со своим журналом.',
      tech: '<b>Transactional outbox</b>: <code>INSERT INTO outbox</code> в той же транзакции, что и бизнес-изменение. <b>Ретранслятор</b> (relay) опрашивает <code>outbox WHERE published_at IS NULL</code>, отправляет в Kafka, после подтверждения ставит <code>published_at</code>. Вариант — <b>CDC</b>: Debezium читает журнал WAL PostgreSQL и публикует вставки в outbox. Доставка — at-least-once, поэтому у потребителя <b>inbox</b>: <code>processed_event</code> с первичным ключом.'
    },
    lead: ui.brief({
      situation: 'Тот же пример с заморозкой, но теперь модуль «Абонементы» пишет событие в таблицу <code>outbox</code>. Ниже — живая модель: база ядра, топик Kafka и потребитель «Доступ».',
      todo: [
        'Нажмите «1. Заморозить» пару раз — посмотрите, что появилось в базе. В Kafka пока пусто.',
        'Нажмите «2. Ретранслятор» — строки уходят в Kafka и получают <code>published_at</code>. Потом «3. «Доступ» читает».',
        'Заморозьте ещё раз и нажмите «💥 Ретранслятор упал после отправки», затем снова «2» и «3». Сколько раз «Доступ» применил событие? Включите inbox и повторите с «Сначала».',
        'Переключите способ доставки на «Debezium читает журнал WAL» и повторите сбой.'
      ],
      look: 'Три колонки: строки базы, сообщения Kafka (offset · eventId), что применил «Доступ». Жёлтая строка — ещё не отправлена, зелёная — отправлена или применена один раз, красная — дубль. Внизу — журнал действий.'
    }),
    render(el) {
      el.classList.add('mqo-root');
      let mode = 'poll', inbox = false, S;
      const reset = () => { S = { nid: 101, fr: 0, ob: [], wal: [], k: [], off: 5001, cdc: 0, ap: {}, seen: new Set(), cpos: 0, skip: 0, log: [] }; };
      reset();
      el.innerHTML = `<div class="stack">
        <div class="mqo-box">
          <div class="mqo-set">
            <div class="lbl">Как событие попадает в Kafka</div>${ui.seg('obm', [{ v: 'poll', t: 'ретранслятор опрашивает outbox' }, { v: 'cdc', t: 'Debezium читает журнал WAL (CDC)' }], mode, 'accent')}
            <div class="lbl">У «Доступа»</div><label class="toggle"><input type="checkbox" data-inbox> <span>inbox — таблица <code>processed_event</code></span></label>
          </div>
          <div class="mqo-btns">
            <button type="button" class="btn sm primary" data-o="tx">1. Заморозить</button>
            <button type="button" class="btn sm" data-o="relay">2. Ретранслятор</button>
            <button type="button" class="btn sm danger" data-o="crash">💥 Ретранслятор упал после отправки</button>
            <button type="button" class="btn sm" data-o="cons">3. «Доступ» читает</button>
            <button type="button" class="btn sm ghost" data-o="reset">⟲ Сначала</button>
          </div>
        </div>
        <div class="mqo-cols" data-cols></div>
        <div class="mqo-log" data-log aria-live="polite"></div>
        <div data-code></div>
      </div>`;
      const log = (c, t) => S.log.push(`<span class="${c}">${t}</span>`);
      function draw() {
        const cnt = {}; S.k.forEach(m => { cnt[m.ev] = (cnt[m.ev] || 0) + 1; });
        const obRows = S.ob.length ? S.ob.map(r => `<div class="mqo-row ${mode === 'poll' ? (r.pub ? 'ok' : 'new') : ''}">id ${r.id} · ${r.ev} · ${mode === 'poll' ? (r.pub ? 'published_at ✓' : 'published_at NULL') : 'в WAL'}</div>`).join('') : '<span class="small dim">пусто</span>';
        TR.$('[data-cols]', el).innerHTML = `
          <div class="card flat"><h4>PostgreSQL ядра</h4><div class="small dim">заморозок: ${S.fr}${mode === 'cdc' ? ` · Debezium сохранил позицию: ${S.cdc} из ${S.wal.length}` : ''}</div><div class="small"><code>outbox</code></div>${obRows}</div>
          <div class="card flat"><h4>Kafka · membership.events</h4>${S.k.length ? S.k.map(m => `<div class="mqo-row ${cnt[m.ev] > 1 ? 'dup' : ''}">${m.off} · ${m.ev}${cnt[m.ev] > 1 ? ' · копия' : ''}</div>`).join('') : '<span class="small dim">пусто</span>'}</div>
          <div class="card flat"><h4>«Доступ»</h4><div class="small dim">прочитано до: ${S.cpos} из ${S.k.length}${inbox ? ` · отсечено повторов: ${S.skip}` : ''}</div>${Object.keys(S.ap).length ? Object.entries(S.ap).map(([ev, n]) => `<div class="mqo-row ${n > 1 ? 'dup' : 'ok'}">${ev} применено ×${n}</div>`).join('') : '<span class="small dim">ничего не применено</span>'}</div>`;
        const lg = TR.$('[data-log]', el);
        lg.innerHTML = S.log.length ? S.log.slice(-10).join('\n') : '<span class="dim">Нажмите «1. Заморозить».</span>';
        lg.scrollTop = lg.scrollHeight;
      }
      function send(list, crash) {
        list.forEach(ev => { S.k.push({ ev, off: S.off++ }); });
        log('', `→ Kafka: ${list.join(', ')} · ack (acks=all)`);
        if (crash) { log('bad', mode === 'poll' ? '💥 ретранслятор упал до UPDATE published_at — строки по-прежнему «не отправлены»' : '💥 Debezium упал до сохранения позиции в журнале — после рестарта начнёт с прежней'); return; }
        if (mode === 'poll') { S.ob.forEach(r => { if (list.includes(r.ev)) r.pub = true; }); log('info', `UPDATE outbox SET published_at = now() WHERE id IN (…); COMMIT`); }
        else { S.cdc = S.wal.length; log('info', 'Debezium сохранил позицию в журнале'); }
      }
      TR.on(el, 'click', '[data-o]', (e, b) => {
        const o = b.dataset.o;
        if (o === 'reset') reset();
        if (o === 'tx') { const id = S.nid++, ev = 'e-' + id; S.fr++; S.ob.push({ id, ev, pub: false }); S.wal.push(ev); log('', `BEGIN; INSERT membership_freeze; INSERT outbox (id ${id}, ${ev}); COMMIT`); }
        if (o === 'relay' || o === 'crash') {
          const list = mode === 'poll' ? S.ob.filter(r => !r.pub).map(r => r.ev) : S.wal.slice(S.cdc);
          if (mode === 'poll') log('dim', 'SELECT … FROM outbox WHERE published_at IS NULL ORDER BY id FOR UPDATE SKIP LOCKED');
          else log('dim', `Debezium читает WAL с позиции ${S.cdc}`);
          if (!list.length) log('dim', 'нечего отправлять');
          else send(list, o === 'crash');
        }
        if (o === 'cons') {
          const fresh = S.k.slice(S.cpos);
          if (!fresh.length) log('dim', '«Доступ»: новых сообщений нет');
          fresh.forEach(m => {
            if (inbox && S.seen.has(m.ev)) { S.skip++; log('ok', `«Доступ»: ${m.ev} уже в processed_event → пропуск`); return; }
            S.ap[m.ev] = (S.ap[m.ev] || 0) + 1; if (inbox) S.seen.add(m.ev);
            log(S.ap[m.ev] > 1 ? 'warn' : '', `«Доступ»: ${m.ev} применено${S.ap[m.ev] > 1 ? ' второй раз!' : ''}`);
          });
          S.cpos = S.k.length;
        }
        draw();
      });
      ui.onSeg(el, (n, v) => { if (n === 'obm') { mode = v; reset(); draw(); } });
      el.addEventListener('change', e => { if (e.target.matches('[data-inbox]')) { inbox = e.target.checked; reset(); draw(); } });
      draw();
      TR.$('[data-code]', el).innerHTML = `<div class="stack">
        ${ui.code(`BEGIN;
INSERT INTO membership_freeze (membership_id, starts_on, ends_on) VALUES ($1, $2, $3);
UPDATE membership SET ends_on = ends_on + 14 WHERE id = $1;
[[ok]]INSERT INTO outbox (event_id, topic, key, payload)
VALUES ($4, 'puls.membership.events.v1', $5 /* client_id */, $6 /* конверт MembershipFrozen */);[[/]]
COMMIT;   -- заморозка и «письмо» появляются вместе или не появляются вовсе`, 'sql', 'Модуль пишет только в свою базу')}
        ${ui.note('', 'Опрос или CDC', '<b>Ретранслятор с опросом</b> — простая программа: раз в 200–500 мс берёт неотправленные строки по порядку <code>id</code>, отправляет, отмечает. Понятно, легко отлаживать, но опрос нагружает базу и добавляет задержку. <b>CDC</b> (change data capture, захват изменений) — Debezium читает журнал предзаписи (WAL) PostgreSQL, как реплика, и публикует каждую вставку в <code>outbox</code>. Задержка меньше, базу не опрашивает, но это ещё одна система, которую надо держать. В обоих случаях после сбоя возможен повтор — это at-least-once.')}
        ${ui.note('', 'Inbox у потребителя', 'Outbox защищает отправителя от потерь и призраков, но дубли не убирает — наоборот, честно их допускает. Поэтому у каждого потребителя — inbox: <code>processed_event(consumer, event_id)</code>, вставка в той же транзакции, что и действие. Outbox + inbox вместе дают «ровно один раз» в результате.')}
      </div>`;
    }
  };

  // =====================================================================
  // Теория 3. Итоговая согласованность
  // =====================================================================
  const EC_ROWS = [
    { id: 'my', t: '«Мои записи» у Петра', sub: 'читает из ядра', sync: 0.2 },
    { id: 'wl', t: 'Лист ожидания пересчитан', sub: 'waitlist', d: 0.5 },
    { id: 'bonus', t: '+500 бонусов Анне за друга', sub: 'bonus', d: 1.5 },
    { id: 'push', t: 'Пуш Петру «Вы записаны»', sub: 'notifications → RabbitMQ → FCM', d: 2 },
    { id: 'seats', t: 'Счётчик мест у других', sub: 'кэш Redis, TTL 30 с + сброс по событию', d: 0.3, ttl: 30 },
    { id: 'rep', t: 'Отчёт директора', sub: 'ClickHouse, отставание до 1 мин', d: 45 }
  ];
  const EC_RELAY = { p500: 0.5, p5: 5, cdc: 0.1 };
  const EC_T = [0.1, 1, 3, 10, 60, 180];
  function ecTime(row, relay, down) {
    if (row.sync) return row.sync;
    const base = (down ? 120 : 0) + EC_RELAY[relay] + row.d;
    return row.ttl ? Math.min(row.ttl, base) : base;
  }
  const fmtS = s => s < 1 ? s.toFixed(1).replace('.', ',') + ' с' : s < 60 ? (Math.round(s * 10) / 10).toString().replace('.', ',') + ' с' : Math.floor(s / 60) + ' мин' + (Math.round(s % 60) ? ' ' + Math.round(s % 60) + ' с' : '');
  const howEventual = {
    id: 'how-eventual', covers: ['req-spec'], title: 'Как это работает: итоговая согласованность', free: true, noReset: true,
    simple: {
      icon: '⏳',
      plain: 'После записи не всё в системе меняется в ту же секунду. Сама запись видна сразу, а бонусы, пуш и отчёт подтягиваются через секунды или минуты. Это не ошибка, а свойство — важно, чтобы «потом» было коротким, измеримым и честно показанным пользователю.',
      analogy: 'Вы оплатили абонемент на ресепшене: чек в руке сразу, браслет активируют через минуту, а письмо о покупке придёт вечером. Никто не считает это обманом — если администратор предупредил.',
      tech: '<b>Итоговая согласованность</b> (eventual consistency): если новых изменений нет, все копии данных со временем сойдутся. Окно несогласованности = задержка ретранслятора + Kafka + обработка потребителя. <b>Read-your-writes</b>: свои изменения пользователь видит сразу — экран «Мои записи» читает из ядра, а не из модели чтения.'
    },
    lead: ui.brief({
      situation: 'Пётр (его привела Анна) записался на сайкл. Запись сохранена в ядре вместе со строкой outbox. Что и когда увидят Пётр, Анна и Ольга?',
      todo: [
        'Переключайте «Прошло после записи» и смотрите, что уже видно.',
        'Поменяйте способ доставки: опрос раз в 500 мс, раз в 5 с, Debezium. Как меняется «потом»?',
        'Включите «Kafka недоступна 2 минуты». Что сломалось, а что продолжает работать?'
      ],
      look: 'Строка — что видит человек. Полоса — шкала времени (логарифмическая: 0,1 с … 5 мин): закрашено — сколько прошло после записи, риска — когда это станет видно. Справа — видно уже или ещё нет, и через сколько.'
    }),
    render(el) {
      el.classList.add('mqo-root');
      let t = 3, relay = 'p500', down = false;
      el.innerHTML = `<div class="stack">
        <div class="mqo-box"><div class="mqo-set">
          <div class="lbl">Прошло после записи</div>${ui.seg('ect', EC_T.map(v => ({ v, t: fmtS(v) })), t, 'accent')}
          <div class="lbl">Как событие уходит</div>${ui.seg('ecr', [{ v: 'p500', t: 'опрос outbox раз в 500 мс' }, { v: 'p5', t: 'опрос раз в 5 с' }, { v: 'cdc', t: 'Debezium (CDC)' }], relay)}
          <div class="lbl">Авария</div><label class="toggle"><input type="checkbox" data-down> <span>Kafka недоступна 2 минуты</span></label>
        </div></div>
        <div data-tl></div>
      </div>`;
      const lg = s => Math.max(0, Math.min(1, (Math.log10(s) + 1) / (Math.log10(300) + 1)));
      function draw() {
        const rows = EC_ROWS.map(r => {
          const at = ecTime(r, relay, down), vis = t >= at;
          return `<div class="r"><div><b>${r.t}</b><div class="small dim">${r.sub}</div></div><div class="bar"><i style="width:${(lg(t) * 100).toFixed(1)}%"></i><b style="left:${(lg(at) * 100).toFixed(1)}%"></b></div><div class="st ${vis ? 'ok' : 'wait'}">${vis ? '✓ видно' : '⏳ ' + fmtS(at)}</div></div>`;
        }).join('');
        const msg = down
          ? ui.note('warn', 'Kafka лежит — запись работает', 'Пётр записался и видит запись: ядро пишет только в свою базу. Строки копятся в <code>outbox</code>. Через 2 минуты ретранслятор отправит всё накопленное — бонусы и пуш придут с опозданием, но придут. Счётчик мест у других обновится по TTL кэша через 30 секунд, не дожидаясь события.')
          : relay === 'p5' ? ui.note('', 'Опрос раз в 5 секунд', 'Бонусы и пуш опаздывают на несколько секунд. Для пуша «вы записаны» это заметно: Пётр уже закрыл приложение. Чаще опрашивать — больше нагрузка на базу; CDC — быстрее, но это ещё одна система.')
          : ui.note('ok', 'Обычный вечер', 'Запись видна сразу, бонусы Анне — примерно через 2 секунды, отчёт директора — в пределах минуты. Всё сходится, просто не в одну секунду.');
        TR.$('[data-tl]', el).innerHTML = `<div class="mqo-tl">${rows}<div class="ax"><span></span><span class="ticks"><span>0,1 с</span><span>1 с</span><span>10 с</span><span>1 мин</span><span>5 мин</span></span><span></span></div></div>${msg}
          ${ui.note('', 'Что здесь делает аналитик', 'Пишет окно согласованности как измеримое требование: «бонусы за друга видны в приложении не позже 5 с после записи в 99 % случаев; при недоступности Kafka — не позже 1 минуты после восстановления». Решает, какие экраны обязаны показывать свежее (read-your-writes: «Мои записи» — из ядра), и что показать, пока данные в пути: «бонусы начисляются в течение минуты».')}`;
      }
      ui.onSeg(el, (n, v) => { if (n === 'ect') t = +v; if (n === 'ecr') relay = v; draw(); });
      el.addEventListener('change', e => { if (e.target.matches('[data-down]')) { down = e.target.checked; draw(); } });
      draw();
    }
  };

  // =====================================================================
  // Практика 1. Запись есть, а бонусов и пуша нет
  // =====================================================================
  const VAR = [{ v: 'inside', t: 'отправка в Kafka внутри транзакции, до COMMIT', s: 'внутри транзакции' }, { v: 'after', t: 'отправка после COMMIT отдельным вызовом', s: 'после COMMIT' }, { v: 'outbox', t: 'строка в outbox в той же транзакции + ретранслятор', s: 'outbox' }];
  const FAIL = [
    { v: 'crash', t: '💥 Сервис упал между действиями', k: 'Упал между' },
    { v: 'commit', t: '⛔ COMMIT не прошёл', k: 'COMMIT не прошёл' },
    { v: 'kafka', t: '🐢 Kafka недоступна 2 мин в 20:00', k: 'Kafka 2 мин' },
    { v: 'sender', t: '📨 Отправитель упал сразу после отправки', k: 'Упал после отправки' }
  ];
  const OUT = {
    inside: {
      crash: ['bad', 'призрак', 'Пуш «вы записаны» ушёл, Анне +500, а записи Петра нет: транзакция откатилась вместе с упавшим сервисом.'],
      commit: ['bad', 'призрак', 'Событие уже в Kafka, а COMMIT не прошёл — записи нет. Пётр придёт на занятие, где его нет в списке.'],
      kafka: ['bad', 'запись легла', 'Каждая транзакция ждёт Kafka до таймаута и держит блокировку строки занятия. В пик соединения кончаются — запись не работает для всех.'],
      sender: ['bad', 'призрак', 'Отправили, упали до COMMIT — база откатила запись. Событие о несуществующей записи.']
    },
    after: {
      crash: ['bad', 'потеря', 'Запись сохранена, событие не ушло: ни пуша Петру, ни бонусов Анне. Это инцидент 3.'],
      commit: ['ok', 'согласовано', 'COMMIT не прошёл — событие и не отправляли. Пётр получил ошибку и повторил.'],
      kafka: ['bad', 'потеря', 'Записи за 2 минуты пика сохранены, события не отправились. Повтор в памяти пропал при перезапуске — тысячи записей без пуша и бонусов.'],
      sender: ['ok', 'согласовано', 'Событие ушло до падения, отмечать нечего.']
    },
    outbox: {
      crash: ['ok', 'согласовано', 'Запись и строка outbox закоммичены вместе. Сервис упал — ретранслятор всё равно отправит событие.'],
      commit: ['ok', 'согласовано', 'COMMIT не прошёл — нет ни записи, ни строки outbox. Отправлять нечего.'],
      kafka: ['ok', 'с задержкой', 'Запись работает как обычно, строки копятся в outbox. Через 2 минуты ретранслятор отправит всё — бонусы и пуш опоздают, но придут.'],
      sender: ['warn', 'дубль в топике', 'Ретранслятор упал до отметки published_at и отправил событие ещё раз. Потребители идемпотентны по eventId — Пётр получит один пуш.']
    }
  };
  const NB_LANES = [L('core', 'Модуль «Запись»', 'ядро'), L('db', 'PostgreSQL', 'booking, outbox'), L('relay', 'Ретранслятор', 'только outbox'), L('k', 'Kafka', 'booking.events'), L('cons', 'Бонусы, Уведомления', 'потребители')];
  function nbSteps(v, f) {
    const S = [];
    S.push({ from: 'core', to: 'core', t: 'Пётр записывается', time: '20:00', note: 'Пётр (его привела Анна) записывается на первое занятие — сайкл в понедельник 19:00. После записи Петру должен прийти пуш, а Анне — +500 бонусов за друга.' });
    const good = () => { S.push({ from: 'k', to: 'cons', t: 'BookingCreated', kind: 'ok', note: 'Потребители получают событие.' }); S.push({ from: 'cons', to: 'cons', t: 'пуш Петру · +500 Анне', kind: 'ok' }); };
    const ghost = () => { S.push({ from: 'k', to: 'cons', t: 'BookingCreated', kind: 'bad', note: 'Событие о записи, которой нет в базе.' }); S.push({ from: 'cons', to: 'cons', t: 'пуш и +500 — за пустоту', kind: 'bad' }); };
    if (v === 'inside') {
      S.push({ from: 'core', to: 'db', t: 'BEGIN · UPDATE мест · INSERT booking', note: 'Транзакция открыта, строка занятия заблокирована (атомарный UPDATE счётчика мест).' });
      if (f === 'kafka') {
        S.push({ from: 'core', to: 'k', t: 'BookingCreated', lost: true, kind: 'bad', note: 'Kafka не отвечает. Модуль ждёт до таймаута, а транзакция всё это время держит блокировку.' });
        S.push({ from: 'core', to: 'relay', box: true, t: 'пул соединений занят — запись встала', kind: 'bad', note: 'В пик сотни записей в секунду. Все соединения пула висят в ожидании Kafka — новые записи не проходят. Kafka легла — легла и запись.' });
        return S;
      }
      S.push({ from: 'core', to: 'k', t: 'BookingCreated' });
      S.push({ from: 'k', to: 'core', t: 'ack', reply: true });
      if (f === 'commit') { S.push({ from: 'core', to: 'db', t: 'COMMIT' }); S.push({ from: 'db', to: 'core', t: '✗ мастер переключился', reply: true, kind: 'bad', note: 'В момент COMMIT база переключилась на реплику — транзакция не зафиксирована.' }); }
      else { S.push({ from: 'core', to: 'db', box: true, t: f === 'sender' ? '💥 упал после отправки' : '💥 упал до COMMIT', kind: 'bad', note: 'Процесс убит. Соединение оборвалось — PostgreSQL откатывает транзакцию.' }); S.push({ from: 'db', to: 'db', t: 'ROLLBACK: записи нет', kind: 'bad' }); }
      ghost(); return S;
    }
    if (v === 'after') {
      S.push({ from: 'core', to: 'db', t: 'BEGIN · INSERT booking · COMMIT', kind: f === 'commit' ? '' : 'ok' });
      if (f === 'commit') { S.push({ from: 'db', to: 'core', t: '✗ мастер переключился', reply: true, kind: 'warn' }); S.push({ from: 'core', to: 'core', t: 'событие не шлём · 503', kind: 'ok', note: 'Раз записи нет, и событие не нужно. Приложение покажет ошибку, Пётр повторит.' }); return S; }
      if (f === 'crash') { S.push({ from: 'core', to: 'db', box: true, t: '💥 упал после COMMIT', kind: 'bad', note: 'Выкатка новой версии в 20:01 — процесс остановили между COMMIT и отправкой.' }); S.push({ from: 'k', to: 'cons', t: 'ничего не пришло', lost: true, kind: 'bad', note: 'Запись есть, события нет. Ни пуша, ни бонусов. Никто не узнает, пока Анна не спросит про свои 500.' }); return S; }
      if (f === 'kafka') { S.push({ from: 'core', to: 'k', t: 'BookingCreated', lost: true, kind: 'bad', note: 'Kafka недоступна. Можно повторять из памяти — но при перезапуске экземпляра всё накопленное пропадёт.' }); S.push({ from: 'k', to: 'cons', t: 'событий за 2 мин нет', lost: true, kind: 'bad' }); return S; }
      S.push({ from: 'core', to: 'k', t: 'BookingCreated' });
      S.push({ from: 'core', to: 'db', box: true, t: '💥 упал после отправки', kind: 'warn', note: 'Событие уже ушло — отмечать нечего.' });
      good(); return S;
    }
    S.push({ from: 'core', to: 'db', t: 'BEGIN · INSERT booking\nINSERT outbox · COMMIT', kind: f === 'commit' ? '' : 'ok', note: 'Запись и строка outbox — в одной транзакции. Модуль пишет только в свою базу и в Kafka не ходит.' });
    if (f === 'commit') { S.push({ from: 'db', to: 'core', t: '✗ мастер переключился', reply: true, kind: 'warn' }); S.push({ from: 'db', to: 'db', t: 'нет ни записи, ни outbox', kind: 'ok', note: 'Откат убрал обе строки. Ретранслятору нечего отправлять — призрака не будет.' }); return S; }
    if (f === 'crash') S.push({ from: 'core', to: 'db', box: true, t: '💥 упал после COMMIT', kind: 'warn', note: 'Модуль упал — но строка outbox уже в базе.' });
    S.push({ from: 'relay', to: 'db', t: 'SELECT … published_at IS NULL', note: 'Ретранслятор раз в 500 мс берёт неотправленные строки по порядку id.' });
    if (f === 'kafka') {
      S.push({ from: 'relay', to: 'k', t: 'BookingCreated', lost: true, kind: 'warn', note: 'Kafka недоступна. Ретранслятор ничего не отмечает и пробует снова.' });
      S.push({ from: 'db', to: 'db', t: 'строки копятся в outbox', kind: 'warn', time: '20:01', note: 'Запись работает как обычно: ядро пишет только в свою базу.' });
      S.push({ from: 'relay', to: 'k', t: 'всё накопленное', kind: 'ok', time: '20:02', note: 'Kafka вернулась — ретранслятор отправляет накопленное по порядку.' });
    } else S.push({ from: 'relay', to: 'k', t: 'BookingCreated · e-41' });
    S.push({ from: 'k', to: 'relay', t: 'ack', reply: true });
    if (f === 'sender') {
      S.push({ from: 'relay', to: 'k', box: true, t: '💥 упал до UPDATE published_at', kind: 'bad', note: 'Kafka подтвердила, но отметить строку ретранслятор не успел.' });
      S.push({ from: 'relay', to: 'k', t: 'снова e-41', kind: 'warn', note: 'После перезапуска строка всё ещё «не отправлена» — уходит второй раз. В топике две копии с одним eventId.' });
      S.push({ from: 'k', to: 'cons', t: 'e-41 ×2', kind: 'warn' });
      S.push({ from: 'cons', to: 'cons', t: 'второй — конфликт PK', kind: 'ok', note: 'Потребители идемпотентны: <code>processed_event</code> отсекает повтор. Пётр получает один пуш, Анна — одни 500.' });
      return S;
    }
    S.push({ from: 'relay', to: 'db', t: 'UPDATE published_at', reply: true });
    good(); return S;
  }
  const NB_QS = [
    {
      q: 'Почему в варианте с outbox не бывает «призрачных» событий?', seed: 'mqo-nb1',
      options: [
        { t: 'Строка outbox и запись — в одной транзакции: откат убирает обе, ретранслятор видит только закоммиченное', ok: 1, why: 'Верно. Событие физически не может существовать без записи.' },
        { t: 'Ретранслятор перед отправкой проверяет, есть ли запись в booking', why: 'Не нужно: он и так видит только закоммиченные строки outbox.' },
        { t: 'Kafka не принимает события о несуществующих записях', why: 'Kafka ничего не знает о вашей базе и примет любое сообщение.' },
        { t: 'Потребители отбрасывают события без записи', why: 'Потребители в чужую базу не ходят — они верят событию.' }
      ]
    },
    {
      q: 'Чем «Пульс» платит за outbox? Отметьте всё, что верно.', multi: true, seed: 'mqo-nb2',
      options: [
        { t: 'Задержкой: событие уходит не сразу, а при следующем проходе ретранслятора', ok: 1, why: 'Доли секунды — секунды. Итоговая согласованность.' },
        { t: 'Возможными дублями: потребители обязаны быть идемпотентными', ok: 1, why: 'Ретранслятор после сбоя может отправить строку ещё раз.' },
        { t: 'Ещё одним процессом и таблицей, которую надо чистить и мониторить', ok: 1, why: 'Алерт «есть неотправленные строки старше минуты», чистка отправленных.' },
        { t: 'Запись становится медленнее на время ответа Kafka', why: 'Наоборот: «Запись» больше не ждёт Kafka, только свою базу.' },
        { t: 'События могут теряться при падении ретранслятора', why: 'Нет: строка остаётся неотправленной и уйдёт после перезапуска.' }
      ]
    }
  ];
  const nbSig = (v, f) => v + '|' + f;
  const taskNoBonus = {
    id: 'no-bonus', title: 'Запись есть, а бонусов и пуша нет',
    simple: howDual.simple,
    lead: ui.brief({
      situation: 'Инцидент 3. Воскресенье, 20:01, выкатка новой версии ядра. Пётр (его привела Анна) записался на сайкл: запись в базе есть, а пуша «Вы записаны» нет, и Анне не начислили +500 бонусов за друга. Сергей насчитал за вечер несколько десятков таких записей. Сейчас модуль «Запись» отправляет событие отдельным вызовом после COMMIT. Лена предлагает два других варианта.',
      todo: [
        'Для каждого из трёх вариантов реализации прогоните все четыре сбоя — таблица под схемой заполняется.',
        'В блоке «Ваше решение» выберите вариант для модуля «Запись».',
        'Ответьте на два вопроса и нажмите «Проверить».'
      ],
      look: 'Колонки — модуль «Запись», PostgreSQL ядра, ретранслятор (работает только в варианте outbox), Kafka и потребители. Красный крест — ничего не дошло. В таблице: «призрак» — событие о несуществующей записи, «потеря» — запись без события, «дубль в топике» — событие ушло дважды, но потребители его отсекают.'
    }),
    blank: () => ({ v: 'after', f: 'crash', seen: [], pick: '', q: [] }),
    reference: () => ({ v: 'outbox', f: 'crash', seen: VAR.flatMap(x => FAIL.map(y => nbSig(x.v, y.v))), pick: 'outbox', q: quizRef(NB_QS) }),
    render(el, ctx) {
      el.classList.add('mqo-root');
      const a = ctx.ans; a.seen = a.seen || [];
      if (!ctx.readonly && !a.seen.includes(nbSig(a.v, a.f))) { a.seen.push(nbSig(a.v, a.f)); ctx.save(); }
      el.innerHTML = `<div class="stack">
        <div class="mqo-box"><div class="mqo-set">
          <div class="lbl">Вариант реализации</div>${ui.seg('v', VAR, a.v, 'accent')}
          <div class="lbl">Сбой</div>${ui.seg('f', FAIL, a.f)}
        </div></div>
        <div data-sq></div><div data-mx></div>
        <div class="mqo-box"><div class="eyebrow">Ваше решение</div><div class="mqo-set"><div class="lbl">Вариант для «Записи»</div>${ui.seg('pick', VAR, a.pick, 'accent')}</div></div>
        <div class="stack" data-q></div>
      </div>`;
      if (ctx.readonly) TR.$$('[data-seg="pick"] button', el).forEach(b => { b.disabled = true; });
      const mx = TR.$('[data-mx]', el);
      const drawMx = () => {
        mx.innerHTML = ui.table(['Вариант'].concat(FAIL.map(f => esc(f.k))), VAR.map(x => [esc(x.s)].concat(FAIL.map(f => {
          if (!a.seen.includes(nbSig(x.v, f.v))) return '<span class="dim">—</span>';
          const o = OUT[x.v][f.v]; return `<span class="status ${o[0]}">${o[1]}</span>`;
        })))) + `<p class="small dim">Прогнано ${a.seen.length} из 12 сочетаний.</p>`;
      };
      const sq = ui.seq(TR.$('[data-sq]', el), { lanes: NB_LANES, steps: nbSteps(a.v, a.f), start: 'all', laneW: 150, title: 'Запись Петра: модуль, база, ретранслятор, Kafka, потребители', onEnd() { } });
      const verdict = mount(TR.$('[data-sq]', el));
      const drawV = () => { const o = OUT[a.v][a.f]; verdict.innerHTML = ui.note(o[0], `Итог: ${o[1]}`, o[2]); };
      drawMx(); drawV();
      ui.onSeg(el, (n, val) => {
        if (n === 'pick') { if (ctx.readonly) return; a.pick = val; ctx.save(); ctx.decide('Как «Запись» отправляет события', tOf(VAR, val)); return; }
        a[n] = val;
        if (!ctx.readonly) { if (!a.seen.includes(nbSig(a.v, a.f))) a.seen.push(nbSig(a.v, a.f)); ctx.save(); }
        sq.set(nbSteps(a.v, a.f), { all: true }); drawMx(); drawV();
      });
      quizSet(TR.$('[data-q]', el), ctx, NB_QS);
    },
    check(ans) {
      const notes = []; let pts = 0;
      const seen = (ans.seen || []).length;
      if (ans.pick === 'outbox') { pts += 40; notes.push({ ok: true, html: 'Выбран outbox — единственный вариант без потерь и без призраков во всех четырёх сбоях.' }); }
      else if (ans.pick === 'inside') notes.push({ ok: false, html: 'Отправка внутри транзакции даёт призраков (событие ушло, а COMMIT не случился) и делает запись заложником Kafka. Прогоните «Kafka 2 мин».' });
      else if (ans.pick === 'after') notes.push({ ok: false, html: 'Это текущая реализация — она и дала инцидент 3. Прогоните «Упал между» и «Kafka 2 мин».' });
      else notes.push({ ok: false, html: 'Выберите вариант в блоке «Ваше решение».' });
      pts += Math.round(20 * Math.min(12, seen) / 12);
      if (seen < 12) notes.push({ ok: 'warn', html: `Прогнано ${seen} из 12 сочетаний. Решение надёжнее, когда видно, как ломаются остальные.` });
      const r = quizRes(NB_QS, ans.q);
      r.forEach((x, i) => { if (x.ok) pts += 20; else pts += Math.round(20 * x.score * .5); notes.push({ ok: x.ok, html: x.ok ? `Вопрос ${i + 1}: верно.` : i === 0 ? 'Вопрос 1: что происходит со строкой outbox, если транзакция откатилась?' : 'Вопрос 2: за outbox платят не скоростью записи и не потерями. Что добавилось — процесс, задержка, повторы?' }); });
      const score = Math.min(1, pts / 100);
      const ok = ans.pick === 'outbox' && r[0].ok && r[1].ok && score >= .8;
      return { ok, score, notes, summary: `Ваш выбор: ${esc(tOf(VAR, ans.pick))}. Прогнано сочетаний: ${seen} из 12.`, vera: ok ? null : 'Ищите вариант, где у события нет шанса существовать отдельно от записи — ни в одну, ни в другую сторону.' };
    },
    explain: `<p>Единственный вариант без потерь и призраков — <b>transactional outbox</b>:</p>
      <ul class="checks">
        <li><b>Внутри транзакции</b> — призраки при любом сбое между отправкой и COMMIT, а главное, запись становится заложником Kafka: Kafka легла — легла и запись (как инцидент с 1С в прошлое воскресенье).</li>
        <li><b>После COMMIT</b> — потери: упали между COMMIT и отправкой (выкатка в 20:01) — события нет навсегда. Это и есть инцидент 3.</li>
        <li><b>Outbox</b> — запись и «письмо» в одной транзакции; ретранслятор доставит при любом сбое. Плата — задержка, ещё один процесс и дубли, которые гасят идемпотентные потребители.</li>
      </ul>
      <p>Что делает аналитик: описывает сценарии отказа «что если» (упали между, база отказала, Kafka недоступна) и требование «событие не теряется и не появляется без записи» — его проверяют тестом с принудительным падением.</p>`,
    report: ans => `Выбор: ${tOf(VAR, ans.pick)}. Прогнано сочетаний: ${(ans.seen || []).length} из 12.\n${quizReport(NB_QS, ans.q)}`
  };

  // =====================================================================
  // Практика 2. Таблица outbox и шаги ретранслятора
  // =====================================================================
  const FIELDS = [
    { id: 'id', t: '<code>id bigint identity</code>', sub: 'порядковый номер строки', ok: 'in', why: 'Задаёт порядок отправки: ретранслятор берёт строки ORDER BY id.' },
    { id: 'ev', t: '<code>event_id uuid UNIQUE</code>', sub: 'номер события', ok: 'in', why: 'По нему потребители отсекают дубли. Без него идемпотентность не построить.' },
    { id: 'topic', t: '<code>topic text</code>', sub: 'куда отправлять', ok: 'in', why: 'Одна таблица outbox на модуль, а топиков может быть несколько.' },
    { id: 'key', t: '<code>key text</code>', sub: 'ключ партиции', ok: 'in', why: 'Без ключа события одного занятия разлетятся по партициям — порядок потерян.' },
    { id: 'payload', t: '<code>payload jsonb</code>', sub: 'конверт события целиком', ok: 'in', why: 'То, что уйдёт в Kafka: eventId, type, version, occurredAt, data.' },
    { id: 'created', t: '<code>created_at timestamptz</code>', sub: 'когда положили', ok: 'in', why: 'Для алерта «есть неотправленные старше минуты» и для чистки.' },
    { id: 'pub', t: '<code>published_at timestamptz</code>', sub: 'NULL — ещё не отправлено', ok: 'in', why: 'Главный флаг ретранслятора: что уже ушло, а что нет.' },
    { id: 'phone', t: '<code>client_phone text</code>', sub: 'чтобы уведомления знали, куда слать', ok: 'out', why: 'Персональные данные в события не кладём — только clientId. Телефон «Уведомления» берут у себя.' },
    { id: 'offset', t: '<code>kafka_offset bigint</code>', sub: 'номер сообщения в Kafka', ok: 'out', why: 'До отправки он неизвестен, а порядок и так задаёт id. Ретранслятору он не нужен.' },
    { id: 'deliv', t: '<code>delivered_to text[]</code>', sub: 'какие потребители уже обработали', ok: 'out', why: 'Отправитель не знает и не должен знать своих потребителей. У каждого группы — своя закладка в Kafka и свой inbox.' },
    { id: 'snap', t: '<code>booking_row jsonb</code>', sub: 'вся строка booking вместе с клиентом', ok: 'out', why: 'Событие — не копия таблицы: в нём достаточно данных для потребителей, без лишнего и без ПДн.' }
  ];
  const STEPS = [
    { id: 's1', t: 'Взять пачку неотправленных', sub: 'SELECT … FROM outbox WHERE published_at IS NULL ORDER BY id LIMIT 100 FOR UPDATE SKIP LOCKED' },
    { id: 's2', t: 'Отправить в Kafka по порядку id', sub: 'топик — topic, ключ — key, тело — payload' },
    { id: 's3', t: 'Дождаться подтверждения Kafka', sub: 'acks=all: сообщение записано на все реплики' },
    { id: 's4', t: 'Отметить отправленные', sub: 'UPDATE outbox SET published_at = now() WHERE id IN (…)' },
    { id: 's5', t: 'Закоммитить транзакцию ретранслятора', sub: 'COMMIT — блокировки строк сняты' },
    { id: 's6', t: 'Раз в сутки удалить отправленные старше 7 дней', sub: 'DELETE … WHERE published_at < now() - interval \'7 days\'' }
  ];
  const ST_OK = STEPS.map(s => s.id);
  const KEY_Q = {
    q: 'Какой <code>key</code> записать в строку outbox для <code>BookingCreated</code>?', seed: 'mqo-key',
    options: [
      { t: '<code>class_session_id</code> — все события одного занятия попадут в одну партицию по порядку', ok: 1, why: 'Верно, это канон «Пульса»: записался → отменил → переведён из листа ожидания — строго по очереди.' },
      { t: '<code>client_id</code> — события одного клиента вместе', why: 'Так случился инцидент 2: события одного занятия от разных клиентов разошлись по партициям, лист ожидания увидел отмену раньше записи.' },
      { t: '<code>event_id</code> — равномерно по партициям', why: 'Равномерно, но порядок событий занятия потерян полностью.' },
      { t: 'Пусто — Kafka сама разложит', why: 'Без ключа — по кругу: порядок внутри занятия не гарантирован.' }
    ]
  };
  function designScore(ans) {
    const pl = ans.place || {};
    let good = 0; const crit = [];
    FIELDS.forEach(f => { if (pl[f.id] === f.ok) good++; });
    if (pl.pub !== 'in') crit.push('нет <code>published_at</code> — ретранслятор не отличит отправленное от неотправленного');
    if (pl.ev !== 'in') crit.push('нет <code>event_id</code> — потребителям нечем отсекать дубли');
    if (pl.phone === 'in') crit.push('телефон клиента в событии — персональные данные в Kafka');
    const ord = ans.order && ans.order.length === ST_OK.length ? ans.order : [];
    const os = ord.length ? ui.orderScore(ord, ST_OK) : 0;
    if (ord.length && !(ord.indexOf('s4') > ord.indexOf('s3') && ord.indexOf('s3') > ord.indexOf('s2'))) crit.push('отметка <code>published_at</code> стоит раньше подтверждения Kafka — при падении событие потеряется');
    const kq = ui.quizScore(KEY_Q, ans.key || []);
    const score = .45 * good / FIELDS.length + .4 * os + .15 * kq.score;
    return { score, good, os, kq, crit };
  }
  const taskDesign = {
    id: 'outbox-design', title: 'Таблица outbox и шаги ретранслятора',
    simple: howOutbox.simple,
    lead: ui.brief({
      situation: 'Антон утвердил outbox для модуля «Запись». Лена просит у вас постановку: какие поля в таблице <code>outbox</code>, какой ключ партиции у событий записи и что по шагам делает ретранслятор. Разработчик предложил ещё четыре поля «на всякий случай».',
      todo: [
        'Шаг 1 — разложите поля: «В таблицу outbox» или «Не нужно».',
        'Шаг 2 — выберите ключ партиции для <code>BookingCreated</code>.',
        'Шаг 3 — расставьте шаги ретранслятора по порядку (стрелки ↑↓ или перетаскивание).',
        'Нажмите «Проверить». Засчитывается от 80 % и без критических ошибок.'
      ],
      lookTitle: 'На что смотреть',
      look: 'Про каждое поле спросите: кто его читает и зачем? Нужен ли он ретранслятору, потребителю, дежурному? Не персональные ли это данные? Про шаги: что будет, если ретранслятор упадёт после каждого шага?'
    }),
    blank: () => ({ place: {}, key: [], order: [] }),
    reference: () => ({ place: Object.fromEntries(FIELDS.map(f => [f.id, f.ok])), key: [0], order: ST_OK.slice() }),
    render(el, ctx) {
      el.classList.add('mqo-root');
      const a = ctx.ans; a.place = a.place || {};
      el.innerHTML = '<div class="stack"><div class="eyebrow">Шаг 1. Поля таблицы outbox</div><div data-s></div><div class="eyebrow">Шаг 2. Ключ партиции</div><div class="card flat" data-k></div><div class="eyebrow">Шаг 3. Шаги ретранслятора</div><div data-o></div><div data-ddl></div></div>';
      const rvS = ctx.result ? Object.fromEntries(FIELDS.filter(f => a.place[f.id]).map(f => [f.id, a.place[f.id] === f.ok ? 'ok' : 'bad'])) : null;
      ui.sort(TR.$('[data-s]', el), { items: FIELDS.map(f => ({ id: f.id, t: f.t, sub: f.sub })), buckets: [{ id: 'in', t: 'В таблицу outbox' }, { id: 'out', t: 'Не нужно' }], value: a.place, readonly: ctx.readonly, reveal: rvS, seed: 'mqo-f', onChange: v => { a.place = v; ctx.save(); ctx.decide('Поля outbox', FIELDS.filter(f => v[f.id] === 'in').map(f => f.id).join(', ')); } });
      ui.quiz(TR.$('[data-k]', el), Object.assign({}, KEY_Q, { value: a.key || [], readonly: ctx.readonly, reveal: ctx.result, onChange: v => { a.key = v; ctx.save(); } }));
      const rvO = ctx.result && a.order && a.order.length ? Object.fromEntries(a.order.map((id, i) => [id, ST_OK[i] === id ? 'ok' : 'bad'])) : null;
      ui.order(TR.$('[data-o]', el), { items: STEPS, value: a.order, readonly: ctx.readonly, reveal: rvO, seed: 'mqo-st', onChange: v => { a.order = v; ctx.save(); } });
      if (ctx.readonly) TR.$('[data-ddl]', el).innerHTML = ui.code(`CREATE TABLE outbox (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id      uuid NOT NULL UNIQUE,
  topic         text NOT NULL,
  key           text NOT NULL,
  payload       jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  published_at  timestamptz
);
CREATE INDEX outbox_unpublished ON outbox (id) WHERE published_at IS NULL;`, 'sql', 'Эталон: DDL таблицы outbox');
    },
    check(ans) {
      const d = designScore(ans), notes = [];
      FIELDS.forEach(f => { const v = (ans.place || {})[f.id]; if (v && v !== f.ok) notes.push({ ok: false, html: `${f.t}: ${f.ok === 'in' ? 'это поле нужно. ' : 'это поле лишнее. '}${f.why}` }); });
      const miss = FIELDS.filter(f => !(ans.place || {})[f.id]).length;
      if (miss) notes.push({ ok: false, html: `Не разложено полей: ${miss}.` });
      if (!d.kq.ok) notes.push({ ok: false, html: 'Ключ партиции: какие события должны идти строго по порядку — одного клиента или одного занятия? Вспомните лист ожидания.' });
      if (d.os < 1) notes.push({ ok: d.os >= .8 ? 'warn' : false, html: `Шаги ретранслятора: ${Math.round(d.os * 100)} % пар в верном порядке. Что будет, если упасть после каждого шага? Отметку «отправлено» ставят только после подтверждения Kafka.` });
      d.crit.forEach(c => notes.push({ ok: false, html: 'Критично: ' + c + '.' }));
      const ok = d.score >= .8 && !d.crit.length;
      if (ok && !notes.length) notes.push({ ok: true, html: 'Поля, ключ и порядок шагов — верно.' });
      return { ok, score: d.score, notes, summary: `Поля: ${d.good} из ${FIELDS.length} · ключ: ${d.kq.ok ? 'верно' : 'нет'} · порядок шагов: ${Math.round(d.os * 100)} %.`, vera: ok ? null : 'Ретранслятор — почтальон: взял письма, отнёс, дождался расписки, отметил в журнале. Если отметить до расписки — письмо может потеряться.' };
    },
    explain: `<p>Таблица из канона «Пульса» — семь полей, и у каждого есть читатель: <code>id</code> — порядок, <code>event_id</code> — дедупликация у потребителей, <code>topic</code> и <code>key</code> — куда и в какую партицию, <code>payload</code> — конверт, <code>created_at</code> — алерт и чистка, <code>published_at</code> — флаг ретранслятора. Частичный индекс <code>WHERE published_at IS NULL</code> делает выборку неотправленных дешёвой.</p>
      <p>Порядок шагов важен из-за сбоев: <b>отметка — только после подтверждения Kafka</b>. Упали до отметки — событие уйдёт ещё раз (дубль, его погасит inbox). Отметили до отправки и упали — событие потеряно навсегда.</p>
      <p><code>FOR UPDATE SKIP LOCKED</code> не даёт двум экземплярам ретранслятора взять одни и те же строки. Но если их несколько, порядок между пачками не гарантирован — поэтому у «Пульса» ретранслятор один активный, второй в резерве.</p>
      <p>Ловушки: телефон (ПДн — в событиях только <code>clientId</code>), offset (неизвестен до отправки), «кто обработал» (это дело потребителей), копия всей строки (событие — не дамп таблицы).</p>`,
    report: ans => { const d = designScore(ans); return `Поля в outbox: ${FIELDS.filter(f => (ans.place || {})[f.id] === 'in').map(f => f.id).join(', ') || '—'}.\nКлюч: ${(ans.key || []).map(i => String(KEY_Q.options[i].t).replace(/<[^>]+>/g, '')).join('') || '—'}.\nШаги: ${(ans.order || []).map(id => STEPS.find(s => s.id === id).t).join(' → ') || '—'} (${Math.round(d.os * 100)} %).`; }
  };

  // =====================================================================
  // Практика 3. Где задваивается и кто гасит
  // =====================================================================
  const DQ = [
    {
      q: 'Где при outbox событие может задвоиться? Отметьте все места.', multi: true, seed: 'mqo-d1',
      options: [
        { t: 'Ретранслятор отправил в Kafka и упал до <code>UPDATE … published_at</code>', ok: 1, why: 'После рестарта строка всё ещё «не отправлена» — уйдёт второй раз.' },
        { t: 'Два экземпляра ретранслятора взяли одни и те же строки без блокировки', ok: 1, why: 'Оба отправят. Лечится <code>FOR UPDATE SKIP LOCKED</code> или одним активным ретранслятором.' },
        { t: 'Потребитель обработал событие, но не успел подтвердить смещение (сбой, ребаланс)', ok: 1, why: 'Повтор на стороне чтения — обычный at-least-once.' },
        { t: 'Транзакция «Записи» откатилась, а строка outbox осталась', why: 'Они в одной транзакции — откат убирает обе. В этом и смысл outbox.' },
        { t: 'Событие прочитали две группы: <code>bonus</code> и <code>notifications</code>', why: 'Это не дубль: у каждой группы своя закладка, каждая читает событие по одному разу.' }
      ]
    },
    {
      q: 'Кто в итоге гасит дубль?', seed: 'mqo-d2',
      options: [
        { t: 'Каждый потребитель: inbox — <code>processed_event(consumer, event_id)</code> в одной транзакции с действием', ok: 1, why: 'Верно. Outbox гарантирует «не потеряем», inbox — «не сделаем дважды».' },
        { t: 'Kafka: включим exactly-once — и дублей не будет', why: 'Транзакции Kafka не знают, что ретранслятор уже отправлял эту строку: факт «отправлено» живёт в PostgreSQL.' },
        { t: 'Ретранслятор: перед отправкой проверит, нет ли события в топике', why: 'Kafka — журнал, а не база: искать сообщение по eventId в топике нельзя.' },
        { t: 'Уникальный индекс <code>outbox.event_id</code>', why: 'Он не даст дважды вставить строку в outbox, но не помешает дважды её отправить.' }
      ]
    },
    {
      q: '«Бонусы» получили <code>BookingCreated</code> с тем же <code>eventId</code> второй раз. Что они делают?', seed: 'mqo-d3',
      options: [
        { t: '<code>INSERT INTO processed_event … ON CONFLICT DO NOTHING</code> вернул 0 строк → ничего не начисляют и подтверждают смещение', ok: 1, why: 'Верно. Повтор — норма at-least-once, его тихо пропускают.' },
        { t: 'Бросают ошибку — пусть уйдёт в DLQ', why: 'Дубль — не ошибка. DLQ засорится тысячами нормальных повторов, и настоящие проблемы в ней утонут.' },
        { t: 'Начисляют, а ночная сверка найдёт и спишет лишнее', why: 'Анна успеет потратить бонусы. Дешевле не начислять.' },
        { t: 'Проверяют по offset: такой номер уже был?', why: 'У копии от ретранслятора другой offset — проверка её пропустит.' }
      ]
    },
    {
      q: 'Вместо ретранслятора поставили Debezium (CDC). Дубли исчезнут?', seed: 'mqo-d4',
      options: [
        { t: 'Нет: Debezium тоже «хотя бы раз» — после перезапуска перечитает журнал с последней сохранённой позиции', ok: 1, why: 'Верно. Меняется способ доставки, а не гарантия. Inbox у потребителей остаётся.' },
        { t: 'Да: журнал WAL читается ровно один раз', why: 'Позицию в журнале Debezium сохраняет периодически. Упал между — перечитает кусок.' },
        { t: 'Да, потому что Debezium не использует таблицу outbox', why: 'Использует: он читает из журнала именно вставки в outbox (outbox event router).' },
        { t: 'Нет, потому что Debezium всегда отправляет каждое изменение дважды', why: 'Не всегда — только после сбоя может повторить кусок.' }
      ]
    },
    {
      q: 'Где у потребителя должна быть вставка в <code>processed_event</code>?', seed: 'mqo-d5',
      options: [
        { t: 'В той же транзакции, что и начисление бонусов', ok: 1, why: 'Верно: либо оба, либо ни одного.' },
        { t: 'Отдельной транзакцией до начисления', why: 'Упали между — событие помечено, а бонусы не начислены. При повторе его пропустят — потеря.' },
        { t: 'Отдельной транзакцией после начисления', why: 'Упали между — начислено, но не помечено. Повтор начислит снова.' },
        { t: 'В памяти экземпляра — так быстрее', why: 'Ребаланс или перезапуск — и память пуста.' }
      ]
    }
  ];
  const DQ_HINT = [
    'вспомните, где между «сделал» и «отметил» можно упасть — у ретранслятора и у потребителя. А что точно не дубль?',
    'кто знает, что он уже это делал: брокер, отправитель или получатель?',
    'повтор — это ошибка или норма?',
    'меняет ли CDC гарантию доставки — или только способ?',
    'что будет, если упасть между вставкой и начислением — в каждом варианте?'
  ];
  const taskDup = {
    id: 'dup-where', title: 'Где задваивается и кто гасит',
    simple: howOutbox.simple,
    lead: ui.brief({
      situation: 'Антон на ревью: «Outbox — это at-least-once. Покажите, где именно будут дубли и кто их гасит. В ADR это должно быть написано явно, иначе через полгода кто-нибудь уберёт processed_event “для скорости”».',
      todo: ['Ответьте на пять вопросов.', 'Нажмите «Проверить». Засчитывается от 4 верных.'],
      lookTitle: 'На что опереться',
      look: 'Модель «outbox, ретранслятор и inbox» в теории: нажмите там «💥 Ретранслятор упал после отправки» с выключенным и включённым inbox.'
    }),
    blank: () => ({ q: [] }),
    reference: () => ({ q: quizRef(DQ) }),
    render(el, ctx) { el.classList.add('mqo-root'); const box = mount(el, 'stack'); quizSet(box, ctx, DQ); },
    check(ans) {
      const r = quizRes(DQ, ans.q), good = r.filter(x => x.ok).length, score = r.reduce((s, x) => s + x.score, 0) / DQ.length;
      return { ok: good >= 4, score, notes: r.map((x, i) => ({ ok: x.ok, html: x.ok ? `Вопрос ${i + 1}: верно.` : `Вопрос ${i + 1}: ${DQ_HINT[i]}` })), summary: `Верно ${good} из ${DQ.length}.` };
    },
    explain: `<p>Дубли при outbox возникают в двух местах: <b>у отправителя</b> (ретранслятор или Debezium упал между отправкой и отметкой) и <b>у получателя</b> (обработал, но не подтвердил смещение). Гасит их всегда <b>получатель</b> — inbox <code>processed_event</code> в одной транзакции с действием, по <code>eventId</code>.</p>
      <p>В ADR это пишут явно: «Доставка at-least-once. Каждый потребитель идемпотентен по eventId (inbox). Удаление processed_event — только по сроку хранения, не раньше 7 дней — сколько Kafka хранит события».</p>`,
    report: ans => quizReport(DQ, ans.q)
  };

  // =====================================================================
  // Практика 4. Требование для разработчиков
  // =====================================================================
  const RQ_RUBRIC = [
    'Событие пишется в таблицу outbox в той же транзакции, что и запись booking: либо оба, либо ничего — нет потерь и нет событий о несуществующих записях',
    'Отправляет отдельный ретранслятор (или Debezium/CDC); published_at ставится только после подтверждения Kafka (acks=all); порядок по id; ключ — class_session_id',
    'Доставка at-least-once: у события постоянный eventId, все потребители идемпотентны (processed_event в одной транзакции с действием)',
    'Измеримое окно согласованности и мониторинг: например, событие в Kafka не позже 2 с в 99 % случаев; алерт, если в outbox есть неотправленные старше 1 минуты; чистка отправленных старше 7 дней',
    'Критерии приёмки как тесты сбоев: убить сервис после COMMIT — событие всё равно уходит; откат транзакции — события нет; повтор отправки — один пуш и одно начисление'
  ];
  const RQ_REF = 'Требование к модулю «Запись»: событие BookingCreated (и другие события записи) не теряется и не публикуется для записи, которой нет в базе. Реализация: строка события пишется в таблицу outbox в той же транзакции, что и booking, — либо обе, либо ни одной. Модуль «Запись» в Kafka напрямую не пишет. Отдельный ретранслятор (или Debezium) берёт неотправленные строки по порядку id, отправляет в puls.booking.events.v1 с ключом class_session_id и ставит published_at только после подтверждения Kafka (acks=all). Доставка at-least-once: eventId постоянный, все потребители идемпотентны (processed_event в одной транзакции с действием). Нефункционально: событие в Kafka не позже 2 с после COMMIT в 99 % случаев; алерт дежурному, если в outbox есть неотправленные строки старше 1 минуты; отправленные строки удаляются через 7 дней. Критерии приёмки: (1) процесс убит сразу после COMMIT — событие всё равно опубликовано; (2) транзакция откатилась — события нет; (3) ретранслятор упал после отправки — потребители выполнили действие один раз; (4) Kafka недоступна 2 минуты — запись работает, события доставлены после восстановления.';
  const taskReq = {
    id: 'req-spec', title: 'Требование для разработчиков',
    simple: howEventual.simple,
    lead: ui.brief({
      situation: 'Лена: «Напишите нам требование, по которому мы сделаем и протестируем: события о записи не теряются и не появляются для несуществующих записей. Без “ну вы поняли” — чтобы тестировщик мог проверить».',
      todo: [
        'Напишите требование своими словами (от 200 знаков): что реализовать, какие гарантии и цифры, как проверить.',
        'Нажмите «Проверить с Верой (Claude)» или «Сверить с эталоном самому» и отметьте раскрытые пункты. Засчитывается от 60 %.'
      ],
      lookTitle: 'Из чего собрать',
      look: 'Что пишем в одной транзакции? Кто и когда отправляет, когда ставит отметку? Что обещаем потребителям (дубли возможны — значит?). Какое окно согласованности и какой алерт? Какие сбои тестировщик устроит руками и что должен увидеть?'
    }),
    blank: () => ({ j: {} }),
    reference: () => ({ j: { text: RQ_REF, self: RQ_RUBRIC.map(() => true) } }),
    render(el, ctx) {
      el.classList.add('mqo-root');
      ui.justify(el, {
        id: 'mqo-req', q: 'Требование: события о записи не теряются и не появляются для несуществующих записей', qPlain: 'Напишите требование для разработчиков модуля «Запись»: события о записи не теряются и не появляются для несуществующих записей. Что реализовать, какие гарантии и цифры, как проверить.',
        rubric: RQ_RUBRIC, reference: RQ_REF, value: ctx.ans.j, readonly: ctx.readonly, minLen: 200,
        onChange: v => { ctx.ans.j = v; ctx.save(); ctx.decide('Требование: события записи', v.text || ''); }
      });
    },
    check(ans) {
      const s = ui.justifyScore(ans && ans.j);
      return { ok: s >= .6, score: s, summary: s ? `Оценка требования: ${Math.round(s * 100)} %.` : 'Напишите требование (от 200 символов) и проверьте его с Верой или сверьте с эталоном сами.', notes: s && s < .6 ? [{ ok: false, html: 'Проверьте, есть ли в тексте: одна транзакция, кто и когда отправляет, обещание про дубли, цифры окна и алерта, тесты сбоев.' }] : [] };
    },
    explain: '<p>Хорошее требование отвечает на три вопроса разработчика и тестировщика: <b>что сделать</b> (outbox в той же транзакции, ретранслятор, отметка после подтверждения), <b>что обещаем</b> (at-least-once, eventId, идемпотентные потребители, окно согласованности в секундах) и <b>как проверить</b> (убить процесс после COMMIT, откатить транзакцию, уронить ретранслятор, выключить Kafka).</p><p>Слова «надёжно» и «гарантированно» без сценариев отказа ничего не значат — тестировщик не сможет их проверить. Поэтому критерии приёмки пишут как сбои, которые устраивают руками на стенде.</p>',
    report: ans => (ans.j && ans.j.text) ? ans.j.text : '—'
  };

  // =====================================================================
  TR.stage({
    id: ID, act: 5, order: 240, slot: 'Чт 10:00', title: 'Outbox и согласованность',
    when: 'четверг, 10:00 · переговорная «Сайкл» · разбор с Леной и Антоном',
    intro: [
      { who: 'lena', html: 'В воскресенье в 20:01 мы выкатывали ядро. Несколько десятков человек записались — записи в базе есть, а пушей нет, и бонусы за друзей не начислились. В логах — ни одной ошибки.' },
      { who: 'anton', html: 'Классическая двойная запись: сохранили в базу, а до Kafka не дошли. Между двумя системами общей транзакции нет. Нужен outbox — и требование, по которому его сделают и проверят.' },
      { who: 'vera', html: 'Сегодня посмотрим, как событие теряется и как появляется «призрак», соберём outbox своими руками и разберёмся, почему бонусы приходят не мгновенно — и что честно написать об этом в требованиях.' }
    ],
    facts: ['F-no-loss', 'F-availability', 'F-week-open', 'F-referral'],
    glossary: [
      { term: 'Двойная запись (dual write)', simple: 'Нужно записать одно и то же в два места, а общей «кнопки сохранить» у них нет. Между двумя записями можно упасть.', tech: 'Изменение в БД и публикация в брокер без общей транзакции. Даёт потерянные события (упали после COMMIT) или призрачные (событие ушло, транзакция откатилась).' },
      { term: 'Призрачное событие', simple: 'Сообщение о том, чего не было: «вы записаны», а записи нет.', tech: 'Событие опубликовано, а бизнес-транзакция откатилась. Потребители верят событию и выполняют действия впустую.' },
      { term: 'Transactional outbox', simple: 'Ящик «исходящие» в своей же базе: письмо кладут вместе с изменением, а относит его курьер.', tech: 'INSERT INTO outbox в той же транзакции, что и бизнес-изменение; публикацию делает отдельный процесс. Гарантия — at-least-once.' },
      { term: 'Ретранслятор (relay)', simple: 'Курьер, который обходит ящик «исходящие» и относит письма в Kafka.', tech: 'Процесс опрашивает outbox WHERE published_at IS NULL ORDER BY id, отправляет, после подтверждения ставит published_at. Упал до отметки — отправит ещё раз.' },
      { term: 'CDC (захват изменений)', simple: 'Подглядывать в журнал базы: всё, что записали, сразу пересылать дальше.', tech: 'Change data capture: чтение журнала изменений СУБД (WAL в PostgreSQL) и публикация изменений в брокер.' },
      { term: 'Debezium', simple: 'Готовая программа, которая читает журнал PostgreSQL и пересылает изменения в Kafka.', tech: 'Платформа CDC на Kafka Connect; для outbox есть маршрутизатор событий (outbox event router). Позицию в журнале сохраняет периодически — после сбоя возможен повтор.' },
      { term: 'Журнал предзаписи (WAL)', simple: 'Черновик базы: прежде чем изменить данные, база записывает, что собирается сделать.', tech: 'Write-ahead log PostgreSQL: по нему восстанавливают базу после сбоя, строят реплики и делают CDC.' },
      { term: 'Inbox (журнал входящих)', simple: 'Журнал «эти письма я уже получил и выполнил» у получателя.', tech: 'Таблица processed_event(consumer, event_id) с первичным ключом; вставка в одной транзакции с действием. Вместе с outbox даёт «ровно один раз» в результате.' },
      { term: 'Read-your-writes', simple: 'Своё изменение человек видит сразу, даже если остальные узнают о нём чуть позже.', tech: 'Гарантия чтения собственных записей: экраны после действия пользователя читают из источника правды (ядра), а не из модели чтения или кэша.' },
      { term: 'FOR UPDATE SKIP LOCKED', simple: '«Возьми свободные строки, а занятые другим — пропусти»: два курьера не схватят одно письмо.', tech: 'Блокировка выбранных строк в PostgreSQL с пропуском уже заблокированных. Защищает от двойной выборки, но не от повтора после падения.' }
    ],
    outro: 'Теперь у модуля «Запись» нет способа потерять событие или отправить «призрака»: запись и письмо в outbox появляются вместе, ретранслятор доставит при любом сбое, а inbox у потребителей погасит повторы. Плата — секунды согласованности, и это вы теперь умеете записать в требованиях цифрами. Завтра — сами события: какие поля, какие версии и как их менять, никого не сломав.',
    tasks: [howDual, howOutbox, howEventual, taskNoBonus, taskDesign, taskDup, taskReq]
  });
})();
