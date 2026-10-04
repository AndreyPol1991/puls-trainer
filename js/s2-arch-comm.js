/* Неделя 6, среда 10:00: как модули общаются. Канон — _dev/DOMAIN-2.md §5 («Как общаются», C4), §4 (Kafka, RabbitMQ).
   Теория (живая): три способа — синхронный запрос, событие, команда в очередь (переключатель, отказ получателя, ui.seq);
   C4 — переключатель уровня «контекст → контейнеры → компоненты» с приближением по клику;
   API-шлюз и BFF — прохождение запроса по шагам (нормальный запрос, истёкший токен, лимит, без шлюза; экран с BFF и без).
   Практика: способ для 10 взаимодействий, диаграмма контейнеров C4 «Пульс, сезон 2» (протокол и направление каждой стрелки),
   лаборатория «Мои записи и бонусы» (шлюз, BFF, кэш, 3G, падение Бонусов), требования к шлюзу своими словами. */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc;

  if (!document.getElementById('acm-css')) document.head.insertAdjacentHTML('beforeend', `<style id="acm-css">
    .acm-root, .acm-root .stack, .acm-root .stack > * { min-width: 0; }
    .acm-root :not(pre) > code { white-space: normal; overflow-wrap: anywhere; }
    .acm-root .seg { max-width: 100%; flex-wrap: wrap; }
    .acm-root .seg button { white-space: normal; text-align: left; }
    .acm-box { display: grid; gap: 12px; padding: 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); min-width: 0; }
    .acm-box > * { min-width: 0; }
    .acm-set { display: grid; grid-template-columns: minmax(0, 170px) minmax(0, 1fr); gap: 8px 14px; align-items: center; }
    .acm-set > .lbl { font-size: 13.5px; color: var(--text-2); }
    .acm-sub { font: 600 16px/1.3 var(--f-brand); display: flex; gap: 10px; align-items: baseline; }
    .acm-sub .l { font: 600 12px/1 var(--f-mono); color: var(--accent); border: 1px solid var(--accent); border-radius: 6px; padding: 3px 6px; }
    .acm-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .acm-stats .v { font-size: 15px; overflow-wrap: anywhere; }
    .acm-verb { font: 600 15px/1.3 var(--f-brand); }
    .acm-ask { display: grid; gap: 8px; }
    .acm-ask .q { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 12px; align-items: center; padding: 8px 10px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); font-size: 13.5px; }
    .acm-ask .q > * { min-width: 0; }
    .acm-board { overflow-x: auto; border: 1px solid var(--border); border-radius: 12px; background: var(--surface-2); padding: 6px; }
    .acm-board svg { display: block; width: 100%; height: auto; }
    .acm-board .nd { cursor: pointer; }
    .acm-board .nd:hover rect { stroke-width: 2.6; }
    .acm-c4 { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 14px; align-items: start; }
    .acm-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .acm-chips button { border: 1px solid var(--border-strong); border-radius: 999px; padding: 6px 12px; background: var(--surface-2); color: var(--text); font-size: 13px; cursor: pointer; text-align: left; }
    .acm-chips button.ok { border-color: var(--ok); background: var(--ok-soft); }
    .acm-chips button.bad { border-color: var(--bad); background: var(--bad-soft); }
    .acm-dir { display: inline-flex; gap: 4px; flex-wrap: wrap; margin-top: 4px; }
    .acm-dir button { border: 1px solid var(--border-strong); border-radius: 7px; padding: 3px 8px; background: var(--surface); color: var(--text-2); font-size: 12.5px; cursor: pointer; }
    .acm-dir button[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); color: var(--text); font-weight: 600; }
    .acm-dir button:disabled { cursor: default; opacity: .8; }
    .acm-phone { width: 260px; max-width: 100%; border: 2px solid var(--border-strong); border-radius: 26px; padding: 14px 12px 18px; background: var(--surface); display: grid; gap: 8px; justify-self: center; }
    .acm-phone .bar { font: 11px/1 var(--f-mono); color: var(--text-muted); display: flex; justify-content: space-between; }
    .acm-phone h5 { margin: 0; font: 600 15px/1.3 var(--f-brand); }
    .acm-phone .bk { border: 1px solid var(--border); border-radius: 10px; padding: 7px 9px; font-size: 13px; background: var(--surface-2); }
    .acm-phone .bk small { display: block; color: var(--text-muted); font-size: 11.5px; }
    .acm-phone .bn { border-radius: 10px; padding: 8px 10px; font-size: 13px; border: 1px solid var(--ok); background: var(--ok-soft); }
    .acm-phone .bn.warn { border-color: var(--warn); background: var(--warn-soft); }
    .acm-phone .bn.info { border-color: var(--info); background: var(--info-soft); }
    .acm-phone .err { border: 1px solid var(--bad); background: var(--bad-soft); border-radius: 10px; padding: 18px 10px; text-align: center; font-size: 13.5px; }
    .acm-phone .spin { border: 1px dashed var(--warn); border-radius: 10px; padding: 18px 10px; text-align: center; font-size: 13.5px; color: var(--text-2); }
    .acm-lab { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 14px; align-items: start; }
    .acm-mx { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .acm-mx .stat .v { font-size: 14px; }
    .acm-mx .stat.cur { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
    .acm-toggles { display: flex; flex-wrap: wrap; gap: 8px 18px; }
    .acm-toggles label { display: inline-flex; gap: 8px; align-items: center; font-size: 13.5px; cursor: pointer; }
    .acm-toggles input { accent-color: var(--accent); width: 17px; height: 17px; }
    .acm-path { font: 12.5px/1.5 var(--f-mono); color: var(--text-2); overflow-wrap: anywhere; }
    @media (max-width: 760px) {
      .acm-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .acm-set { grid-template-columns: minmax(0, 1fr); gap: 4px; }
      .acm-set > .lbl { margin-top: 6px; }
      .acm-c4, .acm-lab { grid-template-columns: minmax(0, 1fr); }
      .acm-mx { grid-template-columns: minmax(0, 1fr); }
    }
  </style>`);

  const L = (id, t, sub) => ({ id, t, sub });
  const tOf = (list, v) => { const x = list.find(o => o.v === v); return x ? String(x.t).replace(/<[^>]+>/g, '') : '—'; };
  const quizRef = QS => QS.map(cfg => cfg.options.map((o, i) => o.ok ? i : -1).filter(i => i >= 0));
  const plainT = s => String(s || '').replace(/<[^>]+>/g, '');
  const mount = (el, cls) => { const d = document.createElement('div'); if (cls) d.className = cls; el.appendChild(d); return d; };
  const fmtMs = ms => ms >= 1000 ? (ms / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' с' : Math.round(ms) + ' мс';
  const COL = { ok: 'var(--ok)', bad: 'var(--bad)', warn: 'var(--warn)', info: 'var(--info)', accent: 'var(--accent)', mute: 'var(--border-strong)', dim: 'var(--text-muted)' };

  // ---------- общий рисовальщик схем: узлы-прямоугольники и стрелки ----------
  function defs(p) { return `<defs>${Object.keys(COL).map(k => `<marker id="${p}-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" style="fill:${COL[k]}"/></marker>`).join('')}</defs>`; }
  function clipPt(n, tx, ty) {
    const cx = n.x + n.w / 2, cy = n.y + n.h / 2, dx = tx - cx, dy = ty - cy;
    const t = Math.min((n.w / 2 + 2) / Math.max(Math.abs(dx), 1e-6), (n.h / 2 + 2) / Math.max(Math.abs(dy), 1e-6));
    return [cx + dx * Math.min(1, t), cy + dy * Math.min(1, t)];
  }
  function edgePts(N, e) {
    if (e.pts) return e.pts;
    const a = N[e.a], b = N[e.b];
    return [clipPt(a, b.x + b.w / 2, b.y + b.h / 2), clipPt(b, a.x + a.w / 2, a.y + a.h / 2)];
  }
  function nodeSVG(n, o) {
    o = o || {};
    const k = n.kind || 'cont';
    const stroke = o.tone ? COL[o.tone] : k === 'ext' ? 'var(--border-strong)' : k === 'db' || k === 'broker' ? 'var(--info)' : k === 'person' ? 'var(--violet)' : k === 'system' ? 'var(--accent)' : 'var(--border-strong)';
    const fill = k === 'ext' ? 'var(--surface-3)' : k === 'system' ? 'var(--accent-soft)' : 'var(--surface)';
    const lines = String(n.t).split('\n');
    const sub = n.sub ? String(n.sub) : '';
    const total = lines.length + (sub ? 1 : 0);
    let s = `<g class="${o.click ? 'nd' : ''}" ${o.click ? `data-nd="${n.id}"` : ''}><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${k === 'db' ? 16 : k === 'person' ? 22 : 9}" style="fill:${fill};stroke:${stroke}" stroke-width="${o.sel ? 2.8 : 1.6}" ${k === 'ext' ? 'stroke-dasharray="5 4"' : ''}/>`;
    lines.forEach((ln, j) => { s += `<text x="${n.x + n.w / 2}" y="${n.y + n.h / 2 + 4 + (j - (total - 1) / 2) * 15}" text-anchor="middle" style="fill:var(--text);font:600 12.5px var(--f-body, sans-serif)">${esc(ln)}</text>`; });
    if (sub) s += `<text x="${n.x + n.w / 2}" y="${n.y + n.h / 2 + 4 + (lines.length - (total - 1) / 2) * 15}" text-anchor="middle" style="fill:var(--text-muted);font:400 10.5px var(--f-mono, monospace)">${esc(sub)}</text>`;
    return s + '</g>';
  }
  function edgeSVG(p, e, pts, o) {
    o = o || {};
    const col = o.col || 'mute';
    const d = 'M' + pts.map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' L');
    const mk = o.dir === 'none' ? '' : o.dir === 'back' ? `marker-start="url(#${p}-${col})"` : `marker-end="url(#${p}-${col})"`;
    let s = `<path d="${d}" fill="none" style="stroke:${COL[col]}" stroke-width="${o.w || 1.7}" ${o.dash ? 'stroke-dasharray="5 4"' : ''} ${mk}/>`;
    if (o.label) {
      const lp = e.lp || [(pts[0][0] + pts[pts.length - 1][0]) / 2, (pts[0][1] + pts[pts.length - 1][1]) / 2];
      const lines = String(o.label).split('\n');
      lines.forEach((ln, j) => { s += `<text x="${lp[0]}" y="${lp[1] + j * 12}" text-anchor="${e.la || 'middle'}" style="fill:${o.lcol ? COL[o.lcol] : 'var(--text-2)'};font:600 10.5px var(--f-mono, monospace);paint-order:stroke;stroke:var(--surface-2);stroke-width:4px">${esc(ln)}</text>`; });
    }
    return s;
  }

  // =====================================================================
  // Теория 1. Три способа общения (соседний пример: заморозка абонемента)
  // =====================================================================
  const WAYS_T = {
    sync: {
      t: 'Синхронный запрос', verb: '«Сделай и ответь — я жду»',
      lanes: [L('app', 'Приложение', 'Анна'), L('gw', 'API-шлюз', 'вход'), L('memb', 'Абонементы', 'модуль ядра'), L('db', 'PostgreSQL', 'схема memb')],
      ok: [
        { from: 'app', to: 'gw', t: 'POST …/freezes\n10.10–24.10', note: 'Анна замораживает абонемент на две недели. Приложение отправляет запрос и <b>ждёт ответа</b>: от него зависит, что покажет экран.' },
        { from: 'gw', to: 'memb', t: 'передать запрос', note: 'Шлюз проверил вход и передал запрос владельцу — модулю «Абонементы».' },
        { from: 'memb', to: 'memb', t: 'проверить: ≤ 30 дней в год,\nкусок ≥ 7 дней', note: 'Правила заморозки знает только хозяин.' },
        { from: 'memb', to: 'db', t: 'INSERT membership_freeze', note: 'Сохраняет заморозку в своей схеме.' },
        { from: 'memb', to: 'gw', t: '201 · до 24.10', reply: true, kind: 'ok', note: 'Ответ: заморозка создана, абонемент продлён до новой даты.' },
        { from: 'gw', to: 'app', t: '201', reply: true, kind: 'ok', note: 'Анна сразу видит результат — или понятную ошибку 422, если дней не хватает. Это и есть плюс синхронного запроса.' }
      ],
      down: [
        { from: 'app', to: 'gw', t: 'POST …/freezes', note: 'Тот же запрос. Но ядро сейчас недоступно (авария).' },
        { from: 'gw', to: 'memb', t: 'передать запрос', lost: true, kind: 'bad', note: 'Получатель не отвечает. Запрос нигде не сохранился — у синхронного вызова нет «почтового ящика».' },
        { from: 'gw', to: 'gw', t: 'таймаут 3 с', kind: 'bad', note: 'Шлюз ждёт не бесконечно: через 3 секунды сдаётся.' },
        { from: 'gw', to: 'app', t: '503 · попробуйте позже', reply: true, kind: 'bad', note: 'Анна видит ошибку <b>сразу</b> и знает: заморозки нет. Повторить должен вызывающий — приложение, с тем же ключом идемпотентности.' }
      ],
      st: { wait: ['Анна', 'ждёт на экране'], lat: ['~150 мс', 'ответ сразу'], rcv: ['1', 'ровно один получатель'], fail: ['ошибка сразу', 'повторяет вызывающий'] },
      stDown: { lat: ['3 с', 'и ошибка'], fail: ['запрос пропал', 'нигде не сохранён'] },
      sum: ['Синхронный запрос — когда вызывающему нужен ответ, чтобы продолжить: показать экран, принять решение. Цена: вызывающий ждёт и зависит от того, жив ли получатель прямо сейчас.']
    },
    event: {
      t: 'Событие', verb: '«Это случилось» — кто хочет, прочтёт',
      lanes: [L('memb', 'Абонементы', 'издатель'), L('k', 'Kafka', 'membership.events'), L('acc', 'Доступ', 'список пропусков'), L('notif', 'Уведомления', 'подписчик'), L('an', 'Аналитика', 'подписчик')],
      ok: [
        { from: 'memb', to: 'memb', t: 'заморозка + строка в outbox', note: 'Абонементы сохранили заморозку и в той же транзакции записали событие в outbox. Анне уже ответили.' },
        { from: 'memb', to: 'k', t: 'MembershipFrozen', note: 'Событие — факт в прошедшем времени. Абонементы не знают, кто его прочтёт.' },
        { from: 'k', to: 'memb', t: 'принято', reply: true, kind: 'ok', note: 'Kafka сохранила событие. Дальше издатель свободен.' },
        { from: 'acc', to: 'k', t: 'что нового?', note: 'Доступ сам забирает новые события со своей закладки.' },
        { from: 'k', to: 'acc', t: 'MembershipFrozen', reply: true, kind: 'accent', note: 'Доступ обновляет список пропусков: с 10.10 не пускать.' },
        { from: 'notif', to: 'k', t: 'что нового?', note: 'Уведомления — тоже сами.' },
        { from: 'k', to: 'notif', t: 'MembershipFrozen', reply: true, kind: 'accent', note: 'Уведомления решат, что отправить Анне.' },
        { from: 'an', to: 'k', t: 'что нового?', note: 'Аналитика читает то же событие для отчёта о заморозках.' },
        { from: 'k', to: 'an', t: 'MembershipFrozen', reply: true, kind: 'accent', note: 'Трое читателей — одно событие. Завтра появится четвёртый — Абонементы этого даже не заметят.' }
      ],
      down: [
        { from: 'memb', to: 'k', t: 'MembershipFrozen', note: 'Событие опубликовано.' },
        { from: 'k', to: 'memb', t: 'принято', reply: true, kind: 'ok', note: 'Издатель свободен.' },
        { from: 'acc', to: 'acc', t: 'лежит (выкатка)', kind: 'bad', note: 'Доступ сейчас выкатывается и ничего не читает. Абонементы об этом не знают — и знать не должны.' },
        { from: 'notif', to: 'k', t: 'что нового?', note: 'Остальные читают как обычно.' },
        { from: 'k', to: 'notif', t: 'MembershipFrozen', reply: true, kind: 'accent', note: 'Уведомления получили событие.' },
        { from: 'acc', to: 'k', t: 'через 10 мин:\nчто я пропустил?', kind: 'warn', note: 'Доступ поднялся и читает со своей закладки.' },
        { from: 'k', to: 'acc', t: 'MembershipFrozen', reply: true, kind: 'ok', note: 'Ничего не потеряно, просто позже: Kafka хранит события 7 дней.' }
      ],
      st: { wait: ['никто', 'Анне уже ответили'], lat: ['доли секунды', 'читатели узнают сами'], rcv: ['сколько угодно', 'сейчас трое'], fail: ['ждёт в журнале', 'до 7 дней'] },
      stDown: { lat: ['+10 минут', 'у упавшего читателя'], fail: ['дочитает', 'со своей закладки'] },
      sum: ['Событие — когда надо сообщить факт тем, кому он интересен, и никого не ждать. Цена: читатели узнают не мгновенно (согласованность в конечном счёте), а издатель не узнает, получилось ли у них.']
    },
    cmd: {
      t: 'Команда в очередь', verb: '«Сделай это» — одному исполнителю',
      lanes: [L('notif', 'Уведомления', 'кладут задачу'), L('q', 'RabbitMQ', 'очередь push'), L('w', 'Отправщик', 'исполнитель'), L('fcm', 'FCM / APNs', 'внешний')],
      ok: [
        { from: 'notif', to: 'q', t: 'задача: пуш Анне\n«Заморожено до 24.10»', note: 'Уведомления прочитали событие и поручают отправку. Это команда — в повелительном наклонении: «отправь».' },
        { from: 'q', to: 'notif', t: 'принято', reply: true, kind: 'ok', note: 'Очередь взяла задачу. Уведомления свободны.' },
        { from: 'q', to: 'w', t: 'задача', kind: 'accent', note: 'Задачу получает <b>один</b> исполнитель из нескольких — иначе Анна получит два пуша.' },
        { from: 'w', to: 'fcm', t: 'отправить пуш', note: 'Отправщик зовёт Google или Apple.' },
        { from: 'fcm', to: 'w', t: '200', reply: true, kind: 'ok', note: 'Пуш принят к доставке.' },
        { from: 'w', to: 'q', t: 'ack · готово', reply: true, kind: 'ok', note: 'Подтверждение — и очередь удаляет задачу.' }
      ],
      down: [
        { from: 'notif', to: 'q', t: 'задача: пуш Анне', note: 'Задача поставлена.' },
        { from: 'q', to: 'w', t: 'задача', kind: 'accent', note: 'Исполнитель взял её.' },
        { from: 'w', to: 'fcm', t: 'отправить пуш', lost: true, kind: 'bad', note: 'FCM не отвечает.' },
        { from: 'w', to: 'q', t: 'не вышло (nack)', reply: true, kind: 'warn', note: 'Исполнитель честно говорит: не получилось.' },
        { from: 'q', to: 'q', t: 'повтор через 1 мин', kind: 'warn', note: 'Очередь откладывает задачу и выдаст её снова. После трёх неудач — в очередь недоставленных (DLQ) и сигнал дежурному.' },
        { from: 'q', to: 'w', t: 'задача снова', kind: 'accent', note: 'Через минуту — вторая попытка.' },
        { from: 'w', to: 'fcm', t: 'отправить пуш', note: 'FCM ожил.' },
        { from: 'w', to: 'q', t: 'ack · готово', reply: true, kind: 'ok', note: 'Задача выполнена с опозданием на минуту. Никто не ждал — и ничего не потерялось.' }
      ],
      st: { wait: ['никто', 'Уведомления свободны'], lat: ['1–3 с', 'пуш придёт'], rcv: ['1 исполнитель', 'из нескольких'], fail: ['повтор, потом DLQ', 'очередь держит задачу'] },
      stDown: { lat: ['+1 минута', 'повтор'], fail: ['повторили', 'задача не потеряна'] },
      sum: ['Команда в очередь — когда надо поручить работу одному исполнителю и быть уверенным, что она будет сделана: подтверждение, повтор, приоритет, очередь недоставленных. Ответа вызывающему не нужно.']
    }
  };
  const ASK = [
    { id: 'now', t: 'Нужен ли ответ прямо сейчас, чтобы продолжить (показать экран, принять решение)?', o: [{ v: 'y', t: 'да' }, { v: 'n', t: 'нет' }] },
    { id: 'kind', t: 'Это факт («уже случилось») или поручение («сделай»)?', o: [{ v: 'fact', t: 'факт' }, { v: 'order', t: 'поручение' }] },
    { id: 'who', t: 'Сколько получателей?', o: [{ v: 'one', t: 'один' }, { v: 'many', t: 'несколько, и будут ещё' }] },
    { id: 'out', t: 'Кто начинает разговор?', o: [{ v: 'in', t: 'наш модуль' }, { v: 'out', t: 'приложение или партнёр снаружи' }] }
  ];
  function askVerdict(a) {
    if (a.out === 'out') return ['info', 'Снаружи — через API-шлюз', 'Приложения и партнёры не видят наши модули и брокеры: они приходят в одну дверь — шлюз. Дальше внутри — синхронно (нужен ответ) или событием.'];
    if (a.now === 'y') return ['ok', 'Синхронный запрос', 'Ответ нужен сейчас — REST внутри или снаружи, gRPC к устройствам. Не забудьте таймаут и что делать при ошибке.'];
    if (a.now === 'n' && a.kind === 'fact') return ['ok', 'Событие в Kafka', a.who === 'one' ? 'Даже при одном получателе событие оставляет дверь открытой: завтра появится второй — издатель не изменится.' : 'Факт для многих — каждый читает своей группой, издатель никого не ждёт.'];
    if (a.now === 'n' && a.kind === 'order') return ['ok', 'Команда в очередь RabbitMQ', a.who === 'many' ? 'Поручение всё равно выполняет один исполнитель. Если «многим» нужно узнать — это уже факт, то есть событие.' : 'Поручение одному исполнителю: подтверждение, повтор, приоритет.'];
    return ['', 'Ответьте на вопросы', 'Начните с первого: нужен ли ответ прямо сейчас.'];
  }
  const howWays = {
    id: 'how-ways', covers: ['ways'], title: 'Как это работает: три способа общения', free: true, noReset: true,
    simple: {
      icon: '📞',
      plain: 'Модули разговаривают тремя способами. Спросить и ждать ответ — как позвонить. Сообщить всем, что случилось, — как повесить объявление. Поручить задачу — как оставить заказ на кухне: сделает один повар, а ты свободен.',
      analogy: 'Администратор клуба. Звонит в бухгалтерию «подтвердите оплату» и держит трубку — это синхронный запрос. Пишет в журнале смены «Анна заморозила абонемент» — кто надо, прочтёт: это событие. Кладёт в лоток кладовщику записку «выдать Анне шкафчик №12» — это команда в очередь: выполнит один, отметит «готово».',
      tech: '<b>Синхронный запрос</b> (запрос-ответ, REST/gRPC): вызывающий ждёт, получатель должен работать сейчас. <b>Событие</b> (Kafka): факт в прошедшем времени, издатель не знает читателей, они читают сами. <b>Команда в очередь</b> (RabbitMQ): поручение одному исполнителю с подтверждением (ack), повтором и очередью недоставленных (DLQ).'
    },
    lead: ui.brief({
      situation: 'Соседний пример — Анна замораживает абонемент на две недели. В этой истории есть все три способа: приложение спрашивает Абонементы и ждёт ответа; Абонементы сообщают о заморозке Доступу, Уведомлениям и Аналитике; Уведомления поручают отправщику пуш.',
      todo: [
        'Выберите способ и проиграйте схему (кнопка «Проиграть» или «Шаг →»). Смотрите на четыре счётчика.',
        'Включите «Получатель лежит» и проиграйте снова. Сравните, что видит Анна и что теряется в каждом способе.',
        'Внизу ответьте на четыре вопроса о любом взаимодействии из своей практики — получите подсказку, какой способ подходит.'
      ],
      look: 'На схеме колонки — участники, сплошная стрелка — сообщение, пунктир — ответ, красный крест — сообщение не дошло. Пояснение к каждому шагу — под схемой. Счётчики: кто ждёт, задержка, сколько получателей, что будет при отказе получателя.'
    }),
    render(el) {
      el.classList.add('acm-root');
      const st = { way: 'sync', down: false };
      const ans = {};
      el.innerHTML = `<div class="stack">
        <div class="acm-box"><div class="acm-set">
          <div class="lbl">Способ</div>${ui.seg('way', Object.keys(WAYS_T).map(k => ({ v: k, t: WAYS_T[k].t })), st.way, 'accent')}
          <div class="lbl">Получатель</div>${ui.seg('down', [{ v: '0', t: 'работает' }, { v: '1', t: 'лежит' }], '0')}
        </div><div class="acm-verb" data-verb></div></div>
        <div class="acm-stats" data-st></div>
        <div data-seq></div><div data-sum></div>
        <div class="acm-sub"><span class="l">?</span>Как выбрать способ</div>
        <div class="acm-ask" data-ask></div><div data-av></div>
      </div>`;
      function draw() {
        const w = WAYS_T[st.way], s = Object.assign({}, w.st, st.down ? w.stDown : {});
        TR.$('[data-verb]', el).textContent = w.verb;
        const k = (key, i) => key === 'fail' ? (st.down ? (st.way === 'sync' ? 'bad' : 'ok') : '') : key === 'lat' && st.down ? 'warn' : '';
        TR.$('[data-st]', el).innerHTML = [['wait', 'Кто ждёт'], ['lat', 'Задержка'], ['rcv', 'Получателей'], ['fail', 'Если получатель лежит']].map(([key, nm]) => `<div class="stat"><div class="k">${nm}</div><div class="v ${k(key)}">${esc(s[key][0])}</div><div class="s">${esc(s[key][1])}</div></div>`).join('');
        const box = TR.$('[data-seq]', el); box.innerHTML = ''; TR.$('[data-sum]', el).innerHTML = '';
        ui.seq(mount(box), { lanes: w.lanes, steps: st.down ? w.down : w.ok, laneW: w.lanes.length > 4 ? 150 : 170, title: w.t, hint: 'Нажмите «Проиграть» или «Шаг →».', onEnd: () => { TR.$('[data-sum]', el).innerHTML = ui.note(st.down && st.way === 'sync' ? 'warn' : 'ok', w.t, w.sum[0]); } });
      }
      function drawAsk() {
        TR.$('[data-ask]', el).innerHTML = ASK.map(q => `<div class="q"><span>${esc(q.t)}</span>${ui.seg('ask-' + q.id, q.o, ans[q.id] || '')}</div>`).join('');
        const v = askVerdict(ans);
        TR.$('[data-av]', el).innerHTML = ui.note(v[0], v[1], v[2]);
      }
      ui.onSeg(el, (n, v) => {
        if (n === 'way') { st.way = v; draw(); }
        else if (n === 'down') { st.down = v === '1'; draw(); }
        else if (n.startsWith('ask-')) { ans[n.slice(4)] = v; TR.$('[data-av]', el).innerHTML = (() => { const x = askVerdict(ans); return ui.note(x[0], x[1], x[2]); })(); }
      });
      draw(); drawAsk();
      el.insertAdjacentHTML('beforeend', `<div style="margin-top:14px">${ui.note('info', 'Что здесь делает аналитик', 'Для каждого взаимодействия в постановке пишет: кто начинает, нужен ли ответ сразу, что будет, если получатель лежит, сколько можно опаздывать. Из этих ответов способ выбирается почти сам — а архитектор подтверждает его в ADR.')}</div>`);
    }
  };

  // =====================================================================
  // Теория 2. C4: три масштаба одной карты
  // =====================================================================
  const C4 = {
    ctx: {
      t: 'Уровень 1 · Контекст', W: 760, H: 400,
      scale: 'Карта страны: «Пульс» — одна точка, вокруг — люди и чужие системы. Что внутри «Пульса», здесь не видно.',
      who: 'Ольга, инвестор, новые сотрудники, партнёры',
      an: 'Список ролей и внешних систем → карта интеграций и раздел «Интеграции» в постановке. Каждая стрелка наружу — будущий договор с чужой компанией.',
      nodes: {
        client: { t: 'Клиент', sub: 'приложение, сайт', x: 20, y: 30, w: 170, h: 52, kind: 'person', d: 'Человек с абонементом: записывается, платит, проходит в клуб.' },
        staff: { t: 'Сотрудник клуба', sub: 'ресепшен, тренер', x: 20, y: 170, w: 170, h: 52, kind: 'person', d: 'Ведёт расписание, отмечает пришедших, продаёт на ресепшене.' },
        fp: { t: 'ФитПасс и агрегаторы', sub: 'внешние', x: 20, y: 310, w: 170, h: 52, kind: 'ext', d: 'Партнёры: смотрят расписание, записывают своих клиентов, раз в месяц сверяют визиты.' },
        puls: { t: 'Пульс', sub: 'нажмите — приблизить', x: 290, y: 150, w: 180, h: 90, kind: 'system', d: 'Вся наша система одним прямоугольником. Нажмите ещё раз — увидите, из чего она состоит (уровень 2).', zoom: 'cont' },
        psp: { t: 'ПэйПоинт', sub: 'платежи', x: 580, y: 14, w: 160, h: 46, kind: 'ext', d: 'Платёжный сервис: создаём платёж, результат приходит вебхуком.' },
        onec: { t: '1С бухгалтерии', sub: 'SOAP', x: 580, y: 88, w: 160, h: 46, kind: 'ext', d: 'Принимает оплаты и возвраты пачками в будни 9–19.' },
        sms: { t: 'SMS и пуши', sub: 'шлюз, FCM/APNs', x: 580, y: 162, w: 160, h: 46, kind: 'ext', d: 'Доставка кодов входа и уведомлений на телефон.' },
        turn: { t: 'Турникеты', sub: '«ПроходПро»', x: 580, y: 236, w: 160, h: 46, kind: 'ext', d: 'Контроллеры в клубах: спрашивают, пускать ли, держат офлайн-список.' },
        video: { t: 'Видеосервис', sub: 'онлайн-эфиры', x: 580, y: 310, w: 160, h: 46, kind: 'ext', d: 'Внешний сервис трансляций (сезон 2): эфиры до 2 000 зрителей.' }
      },
      edges: [
        { a: 'client', b: 'puls', t: 'записывается, платит' }, { a: 'staff', b: 'puls', t: 'ведёт расписание' }, { a: 'fp', b: 'puls', t: 'записывает своих' },
        { a: 'puls', b: 'psp', t: 'платежи' }, { a: 'puls', b: 'onec', t: 'оплаты за день' }, { a: 'puls', b: 'sms', t: 'коды, пуши' }, { a: 'turn', b: 'puls', t: 'пускать ли?' }, { a: 'puls', b: 'video', t: 'эфиры' }
      ]
    },
    cont: {
      t: 'Уровень 2 · Контейнеры (сезон 1)', W: 760, H: 420,
      scale: 'Карта города: из чего «Пульс» состоит — приложения, сервисы, базы. На стрелках — протоколы. Это MVP сезона 1; контейнеры сезона 2 вы соберёте в практике.',
      who: 'архитектор, разработчики, SRE',
      an: 'На каждой стрелке — контракт: OpenAPI для REST, описание SOAP, proto для gRPC. Это ваши документы. Контейнер — то, что отдельно запускается или хранит данные, а не «модуль кода».',
      nodes: {
        app: { t: 'Мобильное приложение', sub: 'iOS / Android', x: 16, y: 20, w: 170, h: 48, d: 'Наш контейнер: приложение клиента. Ходит в ядро по REST, главный экран — GraphQL.' },
        site: { t: 'Сайт', sub: 'публичное расписание', x: 16, y: 100, w: 170, h: 48, d: 'Расписание без входа, до 500 запросов/с — через CDN.' },
        cab: { t: 'Веб-кабинет', sub: 'ресепшен, тренеры', x: 16, y: 180, w: 170, h: 48, d: 'Кабинет сотрудников, вход через SSO.' },
        fp: { t: 'ФитПасс', sub: 'внешний', x: 16, y: 300, w: 170, h: 48, kind: 'ext', d: 'Партнёр, Partner API /partner/v1.' },
        core: { t: 'Ядро «Пульса»', sub: 'нажмите — приблизить', x: 290, y: 140, w: 190, h: 70, d: 'Java/Spring, модульный монолит: один деплой, внутри модули. Нажмите — увидите компоненты (уровень 3).', zoom: 'comp' },
        pg: { t: 'PostgreSQL', sub: 'схема на модуль', x: 300, y: 300, w: 170, h: 50, kind: 'db', d: 'Управляемый PostgreSQL: мастер и реплики, у каждого модуля своя схема.' },
        psp: { t: 'ПэйПоинт', sub: 'внешний', x: 580, y: 14, w: 160, h: 44, kind: 'ext', d: 'Платежи.' },
        onec: { t: '1С', sub: 'внешний', x: 580, y: 80, w: 160, h: 44, kind: 'ext', d: 'Бухгалтерия.' },
        acc: { t: 'Доступ', sub: 'сервис у турникетов', x: 580, y: 220, w: 160, h: 48, d: 'Отдельный сервис ещё с сезона 1: пускает по офлайн-списку, когда нет интернета.' },
        turn: { t: 'Контроллеры', sub: 'турникеты, внешние', x: 580, y: 320, w: 160, h: 46, kind: 'ext', d: 'Устройства «ПроходПро» в клубах.' }
      },
      edges: [
        { a: 'app', b: 'core', t: 'REST + GraphQL' }, { a: 'site', b: 'core', t: 'REST через CDN' }, { a: 'cab', b: 'core', t: 'REST · SSO' }, { a: 'fp', b: 'core', t: 'REST /partner/v1' },
        { a: 'core', b: 'pg', t: 'SQL' }, { a: 'core', b: 'psp', t: 'REST' }, { a: 'core', b: 'onec', t: 'SOAP · пачки' }, { a: 'acc', b: 'core', t: 'REST' }, { a: 'turn', b: 'acc', t: 'gRPC · mTLS' }
      ]
    },
    comp: {
      t: 'Уровень 3 · Компоненты ядра', W: 760, H: 400,
      scale: 'Карта улицы: модули внутри одного контейнера — ядра — и их API. Стрелки — вызовы методов в памяти, а не по сети.',
      who: 'команда ядра',
      an: 'Постановки по модулям: какой модуль чем владеет и что отдаёт соседям. Четвёртый уровень C4 — код (классы) — аналитик обычно не рисует.',
      nodes: {
        in: { t: 'Вход', sub: 'API-шлюз и BFF', x: 16, y: 160, w: 140, h: 50, kind: 'ext', d: 'Запросы приходят снаружи — через шлюз и BFF (в следующем разделе).' },
        book: { t: 'Запись', sub: 'booking', x: 230, y: 40, w: 150, h: 48, d: 'Записи и лист ожидания. Публичный API: записать, отменить.' },
        clients: { t: 'Клиенты', sub: 'client', x: 230, y: 140, w: 150, h: 48, d: 'Персональные данные и согласия.' },
        sales: { t: 'Продажи', sub: 'оркестратор саги', x: 230, y: 240, w: 150, h: 48, d: 'Ведёт покупку абонемента с бонусами по шагам, хранит состояние в saga_purchase.' },
        memb: { t: 'Абонементы', sub: 'membership', x: 450, y: 40, w: 150, h: 48, d: 'Абонементы, прайс, заморозки. API: isActive(), freeze().' },
        sched: { t: 'Расписание', sub: 'class_session', x: 450, y: 140, w: 150, h: 48, d: 'Сетка занятий, тренеры, залы. API: reserveSeat().' },
        pay: { t: 'Платежи', sub: 'payment', x: 450, y: 240, w: 150, h: 48, d: 'Платежи, возвраты, вебхуки ПэйПоинта.' },
        relay: { t: 'Outbox-ретранслятор', sub: 'читает outbox', x: 230, y: 336, w: 150, h: 46, d: 'Отправляет события из таблиц outbox в Kafka.' },
        kafka: { t: 'Kafka', sub: 'другой контейнер', x: 650, y: 336, w: 100, h: 46, kind: 'ext', d: 'Брокер — отдельный контейнер; на этом уровне он «снаружи».' }
      },
      edges: [
        { a: 'in', b: 'book', t: 'записаться' }, { a: 'in', b: 'sales', t: 'купить' }, { a: 'book', b: 'memb', t: 'isActive()' }, { a: 'book', b: 'sched', t: 'reserveSeat()' },
        { a: 'sales', b: 'memb', t: 'создать' }, { a: 'sales', b: 'pay', t: 'оплатить' }, { a: 'relay', b: 'kafka', t: 'события' }
      ]
    }
  };
  function c4SVG(lv, sel) {
    const m = C4[lv], N = {};
    Object.keys(m.nodes).forEach(id => { N[id] = Object.assign({ id }, m.nodes[id]); });
    let s = `<svg viewBox="0 0 ${m.W} ${m.H}" style="min-width:600px" role="img" aria-label="${esc(m.t)}">${defs('acm-c4')}`;
    if (lv === 'comp') s += `<rect x="206" y="20" width="420" height="372" rx="14" style="fill:var(--accent-soft);stroke:var(--accent)" stroke-dasharray="6 4"/><text x="616" y="384" text-anchor="end" style="fill:var(--accent);font:600 11px var(--f-mono, monospace)">КОНТЕЙНЕР «ЯДРО»</text>`;
    m.edges.forEach(e => { const pts = edgePts(N, e); s += edgeSVG('acm-c4', e, pts, { col: 'dim', label: e.t }); });
    Object.keys(N).forEach(id => { s += nodeSVG(N[id], { click: true, sel: id === sel, tone: id === sel ? 'accent' : null }); });
    return s + '</svg>';
  }
  const howC4 = {
    id: 'how-c4', covers: ['c4'], title: 'Как это работает: C4 — одна карта в трёх масштабах', free: true, noReset: true,
    simple: {
      icon: '🗺️',
      plain: 'C4 — способ рисовать архитектуру как карту с приближением. Сначала вся система — одна точка среди соседей. Приблизили — видны её части. Ещё приблизили — модули внутри одной части.',
      analogy: 'Карта в телефоне: страна → город → улица. На карте страны не рисуют подъезды, а на карте улицы не нужны соседние города. Каждому зрителю — свой масштаб: директору — страна, разработчику — улица.',
      tech: '<b>C4</b> (Саймон Браун): <b>контекст</b> — система, люди и внешние системы; <b>контейнеры</b> — то, что отдельно запускается или хранит данные (приложение, сервис, база, брокер), на стрелках — протоколы; <b>компоненты</b> — модули внутри одного контейнера; четвёртый уровень — код. Нотация простая: прямоугольники, подписи «что и на чём», стрелки «кто кого вызывает и как».'
    },
    lead: ui.brief({
      situation: 'Антону к пятнице нужна схема «Пульса» для комитета. Ольге хватит одной картинки, Сергею нужны все базы и брокеры, команде ядра — модули. Это одна и та же система в трёх масштабах.',
      todo: [
        'Переключайте уровни: «Контекст», «Контейнеры», «Компоненты».',
        'Нажимайте на прямоугольники — справа появится, что это. На «Пульс» и «Ядро» нажмите дважды — карта приблизится.',
        'Сравните подписи на стрелках: на каком уровне появляются протоколы?'
      ],
      look: 'Сиреневые — люди, зелёный — наша система, пунктир — чужие системы, синие округлые — базы и брокеры. Подпись на стрелке — что передают или по какому протоколу. Контейнеры здесь — сезона 1; сезон 2 соберёте сами.'
    }),
    render(el) {
      el.classList.add('acm-root');
      let lv = 'ctx', sel = null;
      el.innerHTML = `<div class="stack">
        <div class="row"><span class="small dim">Уровень:</span>${ui.seg('lv', [{ v: 'ctx', t: '1 · Контекст' }, { v: 'cont', t: '2 · Контейнеры' }, { v: 'comp', t: '3 · Компоненты' }], lv, 'accent')}</div>
        <div class="acm-c4"><div class="acm-board" data-svg></div><div data-out></div></div>
      </div>`;
      function draw() {
        TR.$$('[data-seg="lv"] button', el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === lv)));
        TR.$('[data-svg]', el).innerHTML = c4SVG(lv, sel);
        const m = C4[lv], n = sel && m.nodes[sel];
        TR.$('[data-out]', el).innerHTML = `<div class="card flat stack tight"><div class="eyebrow">${esc(m.t)}</div><p class="small">${m.scale}</p>
          ${n ? ui.note('', n.t, n.d + (n.zoom ? ' <b>Нажмите ещё раз, чтобы приблизить.</b>' : '')) : '<p class="small dim">Нажмите на прямоугольник на схеме.</p>'}
          <div class="small"><b>Кто читает:</b> ${esc(m.who)}</div>${ui.note('info', 'Что берёт аналитик', m.an)}</div>`;
      }
      ui.onSeg(el, (n, v) => { if (n === 'lv') { lv = v; sel = null; draw(); } });
      TR.on(el, 'click', '[data-nd]', (e, g) => {
        const id = g.dataset.nd, node = C4[lv].nodes[id];
        if (sel === id && node.zoom) { lv = node.zoom; sel = null; } else sel = id;
        draw();
      });
      draw();
    }
  };

  // =====================================================================
  // Теория 3. API-шлюз и BFF
  // =====================================================================
  const GW_SC = {
    ok: {
      t: 'Обычный запрос ФитПасса', lanes: [L('fp', 'ФитПасс', 'партнёр'), L('gw', 'API-шлюз', 'api.puls.fit'), L('pgw', 'Партнёрский шлюз', 'сервис'), L('core', 'Ядро', 'Расписание')],
      steps: [
        { from: 'fp', to: 'gw', t: 'GET /partner/v1/clubs/\n{id}/classes', note: 'Все внешние запросы приходят в одну дверь — <code>api.puls.fit</code>. ФитПасс не знает, какие у нас внутри сервисы.' },
        { from: 'gw', to: 'gw', t: 'TLS · токен OAuth,\nscope partner:read', kind: 'info', note: '<b>Вход</b>: шлюз проверяет токен (Client Credentials) и права. Один раз — за все сервисы.' },
        { from: 'gw', to: 'gw', t: 'лимит: 14 из 20 в секунду', kind: 'info', note: '<b>Лимит</b>: 20 запросов в секунду на партнёра. Пока в пределах.' },
        { from: 'gw', to: 'pgw', t: 'маршрут /partner/v1/* →\nПартнёрский шлюз', kind: 'accent', note: '<b>Маршрутизация</b>: по пути шлюз решает, какому сервису отдать запрос. Добавляет <code>traceId</code> для трассировки.' },
        { from: 'pgw', to: 'core', t: 'расписание клуба', note: 'Партнёрский шлюз (сервис с логикой партнёров) спрашивает ядро по внутреннему REST.' },
        { from: 'core', to: 'pgw', t: '200', reply: true, kind: 'ok', note: 'Ядро отвечает.' },
        { from: 'pgw', to: 'gw', t: '200 · в терминах партнёра', reply: true, kind: 'ok', note: 'Партнёрский шлюз переводит ответ в формат Partner API.' },
        { from: 'gw', to: 'fp', t: '200 · RateLimit-Remaining: 6', reply: true, kind: 'ok', note: 'Шлюз добавляет заголовки лимитов: партнёр видит, сколько осталось.' }
      ],
      st: [['где проверяют вход', '1 место', 'ok'], ['адресов в интернете', '1', 'ok'], ['кто держит лимит 20/с', 'шлюз', 'ok'], ['сервисы увидели запрос', 'да', '']]
    },
    token: {
      t: 'Токен истёк', lanes: [L('fp', 'ФитПасс', 'партнёр'), L('gw', 'API-шлюз', 'api.puls.fit'), L('pgw', 'Партнёрский шлюз', 'сервис'), L('core', 'Ядро', 'Расписание')],
      steps: [
        { from: 'fp', to: 'gw', t: 'GET /partner/v1/…', note: 'Тот же запрос, но токен ФитПасса истёк час назад.' },
        { from: 'gw', to: 'gw', t: 'токен истёк', kind: 'bad', note: 'Шлюз отвергает запрос на входе.' },
        { from: 'gw', to: 'fp', t: '401 + WWW-Authenticate', reply: true, kind: 'bad', note: 'Сервисы даже не узнали о запросе — ни одного лишнего потока внутри.' }
      ],
      st: [['где проверяют вход', '1 место', 'ok'], ['адресов в интернете', '1', 'ok'], ['кто держит лимит 20/с', 'шлюз', 'ok'], ['сервисы увидели запрос', 'нет', 'ok']]
    },
    limit: {
      t: '21-й запрос за секунду', lanes: [L('fp', 'ФитПасс', 'партнёр'), L('gw', 'API-шлюз', 'api.puls.fit'), L('pgw', 'Партнёрский шлюз', 'сервис'), L('core', 'Ядро', 'Расписание')],
      steps: [
        { from: 'fp', to: 'gw', t: '21-й запрос за секунду', note: 'ФитПасс повторяет любую ошибку через 3 секунды — в пик это шторм.' },
        { from: 'gw', to: 'gw', t: 'лимит 20/с исчерпан', kind: 'warn', note: 'Лимит считается на шлюзе, по партнёру.' },
        { from: 'gw', to: 'fp', t: '429 + Retry-After: 1', reply: true, kind: 'warn', note: 'Партнёр получает понятный ответ «подождите секунду». Ядро в воскресенье 20:00 этого шторма не почувствует.' }
      ],
      st: [['где проверяют вход', '1 место', 'ok'], ['адресов в интернете', '1', 'ok'], ['кто держит лимит 20/с', 'шлюз', 'ok'], ['сервисы увидели запрос', 'нет', 'ok']]
    },
    nogw: {
      t: 'Без шлюза', lanes: [L('fp', 'ФитПасс', 'партнёр'), L('pgw', 'Партнёрский шлюз', 'открыт в интернет'), L('core', 'Ядро', 'тоже открыто'), L('app', 'Приложение', 'ходит в ядро и Бонусы')],
      steps: [
        { from: 'fp', to: 'pgw', t: 'GET partner.puls.fit/…', note: 'Каждый сервис, которому нужен внешний трафик, открыт в интернет со своим адресом.' },
        { from: 'pgw', to: 'pgw', t: 'свой TLS, своя проверка\nтокена, свои лимиты', kind: 'warn', note: 'Партнёрский шлюз сам проверяет токен и лимиты…' },
        { from: 'app', to: 'core', t: 'GET core.puls.fit/…', note: '…приложение ходит в ядро по другому адресу…' },
        { from: 'core', to: 'core', t: 'своя проверка токена,\nсвои лимиты', kind: 'warn', note: '…и ядро делает то же самое своим кодом. А ещё Бонусы, Уведомления…' },
        { from: 'core', to: 'app', t: '200', reply: true, note: 'Работает. Но четыре копии одной логики — четыре места для ошибки безопасности, четыре разные реализации лимитов, а приложение знает адреса всех сервисов.' }
      ],
      st: [['где проверяют вход', 'в каждом сервисе', 'bad'], ['адресов в интернете', '4', 'bad'], ['кто держит лимит 20/с', 'каждый по-своему', 'warn'], ['сервисы увидели запрос', 'все', 'warn']]
    }
  };
  const GW_FN = [
    { t: 'Проверить подпись и срок токена', ok: true, why: 'В шлюз: вход проверяется один раз на входе, сервисы получают уже проверенного пользователя.' },
    { t: 'Лимит 20 запросов/с на партнёра, 429 + Retry-After', ok: true, why: 'В шлюз: лимиты — защита всей системы, а не одного сервиса.' },
    { t: 'Маршрут /partner/v1/* → Партнёрский шлюз', ok: true, why: 'В шлюз: это его основная работа.' },
    { t: 'Присвоить traceId и записать журнал запросов', ok: true, why: 'В шлюз: так один запрос видно от входа до последнего сервиса.' },
    { t: 'Проверить, что в зале есть свободные места', ok: false, why: 'Не в шлюз: это правило Записи. Бизнес-логика в шлюзе размазывает границы модулей.' },
    { t: 'Посчитать штраф за позднюю отмену', ok: false, why: 'Не в шлюз: правило «за 2 часа» знает только Запись.' },
    { t: 'Проверить, что Анна открывает свою запись, а не чужую', ok: false, why: 'Не в шлюз: шлюз знает, кто вошёл, но чья запись — знает только хозяин данных. Именно эту дыру нашли на пентесте (BOLA).' }
  ];
  function gwSim(mode, net) {
    const per = net === '3g' ? 700 : 60;
    if (mode === 'nobff') return { req: 3, ms: per * 2 + 40 + 60 + 10, kb: 29 };
    return { req: 1, ms: per + 5 + 10 + 60, kb: 4 };
  }
  const BFF_SC = {
    nobff: {
      lanes: [L('app', 'Приложение', 'телефон, 3G'), L('gw', 'API-шлюз'), L('core', 'Ядро', 'занятие, тренер'), L('str', 'Трансляции', 'есть ли эфир')],
      steps: [
        { from: 'app', to: 'gw', t: 'GET /classes/{id}', note: 'Экран «Карточка занятия». Первый запрос — само занятие: нужен id тренера и время.' },
        { from: 'gw', to: 'core', t: '→', note: 'Шлюз передаёт в ядро.' },
        { from: 'core', to: 'app', t: '200 · 9 КБ', reply: true, note: 'Ответ — со всеми полями занятия, нужными и ненужными экрану. По 3G — около 0,7 с на запрос.' },
        { from: 'app', to: 'gw', t: 'GET /trainers/{id}', note: 'Второй — тренер (имя, фото).' },
        { from: 'app', to: 'gw', t: 'GET /streams?classId=…', note: 'Третий — есть ли трансляция этого занятия.' },
        { from: 'gw', to: 'str', t: '→', note: 'В другой сервис.' },
        { from: 'str', to: 'app', t: '200 · 6 КБ', reply: true, note: 'И ещё ответ. Экран собирается на телефоне из трёх кусков, логика склейки — в каждой версии приложения.' }
      ]
    },
    bff: {
      lanes: [L('app', 'Приложение', 'телефон, 3G'), L('gw', 'API-шлюз'), L('bff', 'BFF', 'для мобильного'), L('core', 'Ядро'), L('str', 'Трансляции')],
      steps: [
        { from: 'app', to: 'gw', t: 'query classCard(id)', note: 'Один запрос: «дай мне карточку занятия для экрана».' },
        { from: 'gw', to: 'bff', t: 'маршрут /mobile/*', note: 'Шлюз отдаёт его BFF — серверу, который знает этот экран.' },
        { from: 'bff', to: 'core', t: 'занятие + тренер', note: 'BFF ходит внутри дата-центра: вызов — миллисекунды, а не 0,7 секунды.' },
        { from: 'bff', to: 'str', t: 'есть ли эфир', note: 'Параллельно — в Трансляции.' },
        { from: 'core', to: 'bff', t: '200', reply: true, note: 'Ответы приходят за десятки миллисекунд.' },
        { from: 'str', to: 'bff', t: '200', reply: true, note: '' },
        { from: 'bff', to: 'bff', t: 'собрать экран:\nтолько нужные поля', kind: 'accent', note: 'BFF склеивает и выкидывает лишнее.' },
        { from: 'bff', to: 'app', t: '200 · 4 КБ', reply: true, kind: 'ok', note: 'Один ответ по 3G. Логика склейки — на сервере: поменяли экран — не надо ждать, пока все обновят приложение.' }
      ]
    }
  };
  const howGw = {
    id: 'how-gateway', covers: ['lab', 'gw-req'], title: 'Как это работает: API-шлюз и BFF', free: true, noReset: true,
    simple: {
      icon: '🚪',
      plain: 'API-шлюз — единственная входная дверь в систему снаружи: проверяет, кто пришёл, не слишком ли часто, и провожает к нужному сервису. BFF — помощник для конкретного экрана: сам обходит сервисы внутри и приносит телефону всё одним ответом.',
      analogy: 'Шлюз — ресепшен клуба: проверяет карту, считает гостей, подсказывает, куда идти. Гость не бродит по служебным коридорам. BFF — персональный консьерж: вы просите «всё для тренировки», и он сам приносит полотенце, ключ от шкафчика и бутылку воды, а не отправляет вас в три окна.',
      tech: '<b>API-шлюз</b> (API gateway): маршрутизация по пути, аутентификация (проверка токена), лимиты частоты (429 + <code>Retry-After</code>), TLS, <code>traceId</code>, журнал. Бизнес-правил в шлюзе нет. <b>BFF</b> (Backend for Frontend): сервер под конкретный клиент — мобильному свой, вебу свой; собирает данные из нескольких сервисов одним запросом (у «Пульса» — GraphQL главного экрана), отдаёт только нужные поля, решает, что показать при частичном отказе.'
    },
    lead: ui.brief({
      situation: 'Две вкладки. Первая — запрос ФитПасса к расписанию проходит через API-шлюз: нормальный, с истёкшим токеном, сверх лимита и «как было бы без шлюза». Вторая — соседний экран приложения «Карточка занятия»: без BFF и с BFF, на 3G и на Wi-Fi.',
      todo: [
        'Вкладка «API-шлюз»: проиграйте четыре варианта. Найдите, в каких вариантах сервисы вообще не узнали о запросе.',
        'Ниже нажимайте на функции — в шлюз они или нет. Сначала решите сами.',
        'Вкладка «BFF»: переключайте «без BFF / с BFF» и «3G / Wi-Fi», проиграйте схему. Сравните запросы с телефона, время и объём.'
      ],
      look: 'Колонки — участники запроса. Действие внутри одной колонки (стрелка «в себя») — проверка или решение участника. Счётчики под схемой: сколько мест проверяет вход, сколько адресов открыто в интернет, кто держит лимит.'
    }),
    render(el) {
      el.classList.add('acm-root');
      const tabsEl = mount(el);
      ui.tabs(tabsEl, [
        { id: 'gw', t: 'API-шлюз', render: drawGw },
        { id: 'bff', t: 'BFF для мобильного', render: drawBff }
      ], 'gw');
      el.insertAdjacentHTML('beforeend', `<div style="margin-top:14px">${ui.note('info', 'Что здесь делает аналитик', 'Требования к шлюзу — это нефункциональные требования и правила входа: какие пути куда ведут, какой вход на каком пути, какие лимиты и что отвечаем при превышении, сколько шлюз может добавить к задержке. Для BFF — контракт экрана: какие данные, что показать, если часть недоступна.')}</div>`);
    }
  };
  function drawGw(pane) {
    let sc = 'ok';
    const open = {};
    pane.innerHTML = `<div class="stack">
      <div class="row"><span class="small dim">Вариант:</span>${ui.seg('gsc', Object.keys(GW_SC).map(k => ({ v: k, t: GW_SC[k].t })), sc, 'accent')}</div>
      <div data-seq></div><div class="acm-stats" data-st></div>
      <div class="acm-sub"><span class="l">?</span>Что положить в шлюз</div>
      <div class="acm-chips" data-fn></div><div data-fo></div>
    </div>`;
    function draw() {
      const g = GW_SC[sc], box = TR.$('[data-seq]', pane); box.innerHTML = '';
      ui.seq(mount(box), { lanes: g.lanes, steps: g.steps, laneW: 160, title: g.t, hint: 'Нажмите «Проиграть» или «Шаг →».' });
      TR.$('[data-st]', pane).innerHTML = g.st.map(x => `<div class="stat"><div class="k">${esc(x[0])}</div><div class="v ${x[2]}">${esc(x[1])}</div></div>`).join('');
    }
    function drawFn() {
      TR.$('[data-fn]', pane).innerHTML = GW_FN.map((f, i) => `<button type="button" data-fi="${i}" class="${open[i] ? (f.ok ? 'ok' : 'bad') : ''}">${esc(f.t)}${open[i] ? (f.ok ? ' — в шлюз' : ' — не в шлюз') : ''}</button>`).join('');
      const last = Object.keys(open).map(Number).pop();
      TR.$('[data-fo]', pane).innerHTML = last != null ? ui.note(GW_FN[last].ok ? 'ok' : 'warn', GW_FN[last].t, GW_FN[last].why) : '<p class="small dim">Нажмите на функцию: решите сами, в шлюз она или нет, — и проверьте.</p>';
    }
    ui.onSeg(pane, (n, v) => { if (n === 'gsc') { sc = v; draw(); } });
    TR.on(pane, 'click', '[data-fi]', (e, b) => { const i = +b.dataset.fi; delete open[i]; open[i] = true; drawFn(); });
    draw(); drawFn();
  }
  function drawBff(pane) {
    let mode = 'nobff', net = '3g';
    pane.innerHTML = `<div class="stack">
      <div class="acm-box"><div class="acm-set">
        <div class="lbl">Как собираем экран</div>${ui.seg('bm', [{ v: 'nobff', t: 'Приложение само: 3 запроса' }, { v: 'bff', t: 'Через BFF: 1 запрос' }], mode, 'accent')}
        <div class="lbl">Сеть телефона</div>${ui.seg('bn', [{ v: '3g', t: '3G' }, { v: 'wifi', t: 'Wi-Fi' }], net)}
      </div></div>
      <div class="acm-stats" data-st></div><div data-seq></div><div data-n></div>
    </div>`;
    function draw() {
      const r = gwSim(mode, net);
      TR.$('[data-st]', pane).innerHTML = `
        <div class="stat"><div class="k">запросов с телефона</div><div class="v ${r.req > 1 ? 'warn' : 'ok'}">${r.req}</div><div class="s">каждый — через сеть телефона</div></div>
        <div class="stat"><div class="k">экран готов через</div><div class="v ${r.ms > 1000 ? 'bad' : r.ms > 500 ? 'warn' : 'ok'}">${fmtMs(r.ms)}</div><div class="s">${net === '3g' ? '≈ 0,7 с на запрос по 3G' : 'Wi-Fi: разница меньше'}</div></div>
        <div class="stat"><div class="k">скачано</div><div class="v ${r.kb > 10 ? 'warn' : 'ok'}">${r.kb} КБ</div><div class="s">${mode === 'bff' ? 'только поля экрана' : 'все поля трёх ответов'}</div></div>
        <div class="stat"><div class="k">логика склейки</div><div class="v ${mode === 'bff' ? 'ok' : 'warn'}">${mode === 'bff' ? 'на сервере' : 'в приложении'}</div><div class="s">${mode === 'bff' ? 'поменять — релиз BFF' : 'старые версии живут месяцами'}</div></div>`;
      const box = TR.$('[data-seq]', pane); box.innerHTML = '';
      const b = BFF_SC[mode];
      ui.seq(mount(box), { lanes: b.lanes, steps: b.steps, laneW: b.lanes.length > 4 ? 140 : 165, title: 'Карточка занятия', hint: 'Нажмите «Проиграть» или «Шаг →».' });
      TR.$('[data-n]', pane).innerHTML = mode === 'bff'
        ? ui.note('ok', 'Один ответ по медленной сети', `Дорогая часть пути — от телефона до дата-центра. BFF делает её один раз, а обход сервисов — внутри, где вызов стоит миллисекунды. ${net === 'wifi' ? 'На Wi-Fi выигрыш меньше — BFF нужен в первую очередь для мобильных сетей.' : ''}`)
        : ui.note('warn', 'Телефон сам обходит сервисы', `Три запроса по ${net === '3g' ? '3G' : 'Wi-Fi'}: второй и третий ждут первого (нужен id тренера). ${net === '3g' ? 'Это и есть «экран грузится 4–6 секунд» из жалобы Дениса — только меньше.' : 'На Wi-Fi терпимо, но в клубе часто ловит только 3G.'}`);
    }
    ui.onSeg(pane, (n, v) => { if (n === 'bm') { mode = v; draw(); } if (n === 'bn') { net = v; draw(); } });
    draw();
  }

  // =====================================================================
  // Практика 1. Способ для десяти взаимодействий
  // =====================================================================
  const WAY_CH = [
    { v: 'sync', t: 'Синхронно: REST или gRPC' },
    { v: 'event', t: 'Событие в Kafka' },
    { v: 'task', t: 'Задача в RabbitMQ' },
    { v: 'edge', t: 'Снаружи через API-шлюз' }
  ];
  const WROWS = [
    { id: 'w1', t: 'Запись перед записью Анны проверяет, действует ли её абонемент в этом клубе', sub: 'модули ядра', ok: ['sync'], crit: true, why: 'Ответ нужен сейчас: от него зависит, записывать ли. Внутри ядра — вызов публичного API модуля Абонементов.', hint: 'Может ли Запись продолжить, не зная ответа?', no: { event: 'Событие ответа не даёт: Запись не сможет решить, записывать ли Анну.', task: 'Задача — поручение без ответа. А Записи нужно «да» или «нет» прямо сейчас.', edge: 'Это разговор двух модулей внутри ядра. Шлюз — только для входа снаружи.' } },
    { id: 'w2', t: 'Анна прошла через турникет — Бонусы, Партнёрский шлюз и Аналитика должны об этом узнать', ok: ['event'], crit: true, why: '<code>VisitRecorded</code> в <code>puls.access.visits.v1</code>: факт для троих, каждый читает своей группой.', hint: 'Сколько получателей у этого факта и нужен ли Доступу их ответ?', no: { sync: 'Доступ будет ждать троих, и упадёт любой — проход затормозит. Доступу их ответ не нужен.', task: 'Задачу получает один исполнитель, а читателей трое — каждому нужен сам факт.', edge: 'Все участники внутри «Пульса». Шлюз здесь ни при чём.' } },
    { id: 'w3', t: 'Отправить Анне пуш «Начислено 10 бонусов»', ok: ['task', 'event'], alt: 0.5, altWhy: 'Факт «бонусы начислены» — действительно событие <code>BonusAccrued</code>. Но сам пуш — поручение: Уведомления читают событие и кладут задачу «отправь» в RabbitMQ.', why: 'Задача в RabbitMQ: подтверждение, повтор, приоритет, лимиты FCM.', hint: 'Это факт для многих или поручение одному исполнителю?', no: { sync: 'Бонусы не должны ждать FCM и его лимитов: пуш — не повод держать начисление.', edge: 'Пуш уходит изнутри наружу, а шлюз — для запросов снаружи внутрь.' } },
    { id: 'w4', t: 'Приложение открывает экран «Мои записи»', ok: ['edge', 'sync'], alt: 0.5, altWhy: 'Да, это синхронный запрос. Но приходит он снаружи — значит, через API-шлюз: вход, лимиты, маршрут к BFF. Эталон — «через шлюз».', why: 'Снаружи — через API-шлюз и BFF, синхронно.', hint: 'Откуда приходит запрос: изнутри «Пульса» или из телефона в интернете?', no: { event: 'Приложение не читает нашу Kafka — и Анне нужен экран сейчас.', task: 'Анна ждёт экран, а не «задача принята».' } },
    { id: 'w5', t: 'ФитПасс записывает своего клиента на йогу', sub: 'Partner API', ok: ['edge', 'sync'], alt: 0.5, altWhy: 'Синхронно — верно: ФитПассу нужен ответ 201 или 409. Но он внешний — значит, через API-шлюз с OAuth и лимитом 20/с.', why: 'Снаружи через API-шлюз: OAuth, лимит 20 запросов/с, маршрут к Партнёрскому шлюзу.', hint: 'ФитПасс — внешняя компания. Через какую дверь он входит?', no: { event: 'ФитПасс не пишет в нашу Kafka, и ему нужен ответ сразу.', task: 'Партнёру нужно «записан» или «мест нет» сейчас.' } },
    { id: 'w6', t: 'Продажи просят Бонусы зарезервировать 500 бонусов при покупке абонемента', sub: 'шаг саги', ok: ['sync', 'task'], alt: 0.5, altWhy: 'Можно и командой в очередь с ответом позже — так строят асинхронные саги. Но покупка ждёт результата резерва; у «Пульса» шаг саги — синхронный вызов API Бонусов с таймаутом.', why: 'Синхронно: Продажам нужен результат резерва, чтобы списать остаток картой.', hint: 'Может ли покупка идти дальше, не зная, удался ли резерв?', no: { event: 'Событие — факт о прошлом. «Зарезервируйте» — просьба к конкретному получателю, и Продажам нужен ответ.', edge: 'Оба участника внутри «Пульса».' } },
    { id: 'w7', t: 'Контроллер турникета спрашивает «пускать ли?» — решение за 300 мс', ok: ['sync', 'edge'], alt: 0.5, altWhy: 'Контроллер действительно снаружи дата-центра, но это наше устройство с сертификатом клуба (mTLS): он говорит с Доступом по gRPC напрямую, а не через публичный шлюз клиентов.', why: 'Синхронный gRPC к сервису «Доступ» с дедлайном 300 мс; без связи — офлайн-список.', hint: 'Человек стоит у турникета. Можно ли ответить «потом»?', no: { event: 'Человек у турникета ждёт решения — событие ответа не даёт.', task: 'Задача без ответа: турникет так и не откроется.' } },
    { id: 'w8', t: 'Абонемент Анны заморожен — списки пропусков на турникетах 60 клубов должны обновиться', ok: ['event'], why: 'Событие в сжатый топик <code>puls.access.allowlist.v1</code>: каждый контроллер держит последнее состояние, новый читает с начала.', hint: 'Сколько получателей, и что будет с клубом, где сейчас нет интернета?', no: { sync: 'Абонементы будут ждать 60 контроллеров, а клуб без интернета не ответит вовсе.', task: 'Список нужен всем контроллерам сразу, и новому — с начала. Это журнал, а не задача одному.', edge: 'Это внутренний поток данных, а не вход снаружи.' } },
    { id: 'w9', t: 'В воскресенье вечером разослать 300 тыс. пушей «Запись на неделю открыта»', ok: ['task'], crit: true, why: '300 тыс. задач «отправь» в RabbitMQ: отправщики разбирают их с лимитами и приоритетом (код входа важнее рекламы).', hint: 'Это 300 тыс. поручений, которые надо надёжно выполнить. Кто их разбирает?', no: { event: 'Здесь нет факта для многих систем — есть 300 тыс. поручений «отправь».', sync: '300 тыс. синхронных вызовов FCM из ядра в пик — верный способ занять все потоки.', edge: 'Пуши уходят изнутри наружу; шлюз — для входящих запросов.' } },
    { id: 'w10', t: 'ПэйПоинт сообщает, что оплата Анны прошла', sub: 'вебхук', ok: ['edge', 'sync'], alt: 0.5, altWhy: 'Синхронный вызов — да, ПэйПоинт ждёт быстрый 200. Но он приходит снаружи: через шлюз (маршрут <code>/webhooks/paypoint</code>, список IP), подпись проверяют Платежи.', why: 'Снаружи через API-шлюз: маршрут к Платежам, список IP. После этого Платежи публикуют <code>PaymentSucceeded</code>.', hint: 'ПэйПоинт — внешняя компания. Через какую дверь он к нам стучится?', no: { event: 'ПэйПоинт не пишет в нашу Kafka. Он вызывает наш вебхук; уже потом Платежи публикуют событие.', task: 'ПэйПоинт не кладёт задачи в нашу очередь — он вызывает наш адрес.' } }
  ];
  function matchEval(rows, m) {
    m = m || {};
    return rows.map(r => {
      const v = m[r.id];
      if (!v) return { r, s: 'bad', pts: 0, empty: true };
      if (v === r.ok[0]) return { r, s: 'ok', pts: 1 };
      if (r.ok.includes(v)) return { r, s: 'warn', pts: r.alt || 0.5 };
      return { r, s: 'bad', pts: 0, v };
    });
  }
  const waysTask = {
    id: 'ways', title: 'Как общаются: десять взаимодействий',
    simple: howWays.simple,
    lead: ui.brief({
      situation: 'Антон собирает таблицу взаимодействий для ADR: кто с кем говорит и как. Внутри «Пульса» — синхронные запросы, события в Kafka и задачи в RabbitMQ. Снаружи — всё через API-шлюз. Нужно выбрать способ для десяти случаев.',
      todo: [
        'В каждой строке выберите способ из списка.',
        'Для каждой задайте себе вопросы из теории: нужен ли ответ сейчас? факт или поручение? сколько получателей? снаружи или внутри?',
        'Нажмите «Проверить». Засчитывается от 80 % и без ошибок в опорных строках. Второй допустимый ответ даёт половину балла и пояснение.'
      ],
      lookTitle: 'Подсказка',
      look: 'Если начинает внешний участник — приложение, партнёр, платёжный сервис — он входит через шлюз. Устройства клуба с сертификатом — отдельная история. Внутри: ответ нужен — синхронно; факт — событие; поручение — задача.'
    }),
    blank: () => ({ m: {} }),
    reference: () => ({ m: Object.fromEntries(WROWS.map(r => [r.id, r.ok[0]])) }),
    render(el, ctx) {
      el.classList.add('acm-root');
      let rv = null;
      if (ctx.result) { rv = {}; matchEval(WROWS, ctx.ans.m).forEach(x => { if (!x.empty) rv[x.r.id] = { s: x.s, why: x.s === 'ok' ? x.r.why : x.s === 'warn' ? x.r.altWhy : ((x.r.no && x.r.no[x.v]) || x.r.hint) }; }); }
      if (ctx.readonly) { rv = {}; WROWS.forEach(r => { rv[r.id] = { s: 'ok', why: r.why + (r.ok.length > 1 ? ` <span class="dim">Допустимо: ${esc(tOf(WAY_CH, r.ok[1]))} — половина балла.</span>` : '') }; }); }
      ui.match(mount(el), {
        rows: WROWS.map(r => ({ id: r.id, t: r.t, sub: r.sub })), choices: WAY_CH, value: ctx.ans.m || {}, reveal: rv, readonly: ctx.readonly, placeholder: 'Выберите способ…',
        onChange: v => { ctx.ans.m = v; ctx.save(); }
      });
    },
    check(ans) {
      const ev = matchEval(WROWS, ans && ans.m), score = ev.reduce((s, x) => s + x.pts, 0) / WROWS.length;
      const critBad = ev.filter(x => x.r.crit && x.s !== 'ok');
      const notes = [];
      ev.forEach(x => {
        const nm = plainT(x.r.t);
        if (x.s === 'warn') notes.push({ ok: 'warn', html: `«${esc(nm)}» — ${x.r.altWhy}` });
        else if (x.s === 'bad') notes.push({ ok: false, html: `«${esc(nm)}» — ${x.empty ? 'не выбрано. ' + x.r.hint : ((x.r.no && x.r.no[x.v]) || x.r.hint)}` });
      });
      if (!notes.length) notes.push({ ok: true, html: 'Все десять — своим способом.' });
      return {
        ok: score >= 0.8 && !critBad.length, score, notes,
        summary: `Точно: ${ev.filter(x => x.s === 'ok').length} из ${WROWS.length}, допустимо: ${ev.filter(x => x.s === 'warn').length}.`,
        vera: critBad.length ? 'Опорные строки — проверка абонемента (ответ нужен сейчас), проход через турникет (факт для троих) и 300 тыс. пушей (поручения). На них держится вся таблица.' : null
      };
    },
    explain: `<p>Способ выбирается не по моде, а по четырём вопросам: <b>кто начинает</b> (снаружи — через шлюз), <b>нужен ли ответ сейчас</b> (да — синхронно), <b>факт или поручение</b> (факт — событие, поручение — задача), <b>сколько получателей</b>.</p>
      <ul class="checks">
        <li>Одна история часто использует все три способа: оплата прошла (вебхук через шлюз) → <code>PaymentSucceeded</code> (событие) → Уведомления кладут «отправь пуш» (задача).</li>
        <li>Шлюз — не «четвёртый протокол», а дверь: за ней запрос всё равно синхронный. Но в ADR важно, что снаружи никто не ходит к модулям напрямую.</li>
        <li>Турникеты — исключение из «снаружи через шлюз»: это наши устройства с сертификатом клуба (mTLS), у них свой вход в Доступ по gRPC.</li>
      </ul>`,
    report: ans => matchEval(WROWS, ans && ans.m).map(x => `- ${plainT(x.r.t)} → ${tOf(WAY_CH, (ans.m || {})[x.r.id])} ${x.s === 'ok' ? '✓' : x.s === 'warn' ? '≈' : '✗'}`).join('\n')
  };

  // =====================================================================
  // Практика 2. Диаграмма контейнеров C4 «Пульс, сезон 2»
  // =====================================================================
  const CN = {
    app: { t: 'Мобильное\nприложение', x: 16, y: 56, w: 140, h: 52 },
    fp: { t: 'ФитПасс', sub: 'внешний', x: 16, y: 384, w: 140, h: 48, kind: 'ext' },
    gw: { t: 'API-шлюз', x: 196, y: 220, w: 128, h: 48 },
    bff: { t: 'BFF мобильного', x: 372, y: 56, w: 156, h: 48 },
    core: { t: 'Ядро «Пульса»', sub: 'модульный монолит', x: 372, y: 210, w: 156, h: 64 },
    pg: { t: 'PostgreSQL ядра', x: 372, y: 304, w: 156, h: 44, kind: 'db' },
    pgw: { t: 'Партнёрский шлюз', x: 372, y: 384, w: 156, h: 48 },
    bonus: { t: 'Бонусы', x: 590, y: 56, w: 124, h: 48 },
    kafka: { t: 'Kafka', x: 590, y: 220, w: 124, h: 48, kind: 'broker' },
    notif: { t: 'Уведомления', x: 590, y: 384, w: 124, h: 48 },
    an: { t: 'Аналитика', sub: 'ClickHouse', x: 760, y: 220, w: 124, h: 48 },
    rmq: { t: 'RabbitMQ', x: 760, y: 384, w: 124, h: 48, kind: 'broker' }
  };
  const PROTO = [
    { v: 'rest', t: 'REST (HTTP/JSON)', s: 'REST' },
    { v: 'graphql', t: 'GraphQL (HTTP)', s: 'GraphQL' },
    { v: 'grpc', t: 'gRPC', s: 'gRPC' },
    { v: 'sql', t: 'SQL', s: 'SQL' },
    { v: 'kpub', t: 'Kafka: публикует события', s: 'Kafka: пишет' },
    { v: 'ksub', t: 'Kafka: читает события (группа)', s: 'Kafka: читает' },
    { v: 'amqp', t: 'RabbitMQ: кладёт задачи (AMQP)', s: 'AMQP' },
    { v: 'hook', t: 'Вебхук (HTTPS наружу)', s: 'вебхук' }
  ];
  const CE = [
    { id: 'e1', a: 'app', b: 'gw', pts: [[156, 96], [196, 236]], lp: [150, 170], la: 'start', ok: ['graphql', 'rest'], alt: 1, why: 'Приложение ходит в шлюз по HTTPS: REST для действий, GraphQL для главного экрана. Оба ответа верны.', hint: 'Как телефон разговаривает с сервером в интернете?', no: { kpub: 'Телефон не пишет в нашу Kafka — брокер внутри.', ksub: 'Телефон не читает нашу Kafka.', sql: 'Прямой доступ к базе с телефона — дыра в безопасности.', grpc: 'Возможно, но неудобно для мобильной студии: нет HTTP-кэша, нужен прокси для отладки. У «Пульса» — REST и GraphQL.' } },
    { id: 'e2', a: 'gw', b: 'bff', pts: [[300, 220], [372, 92]], lp: [342, 150], la: 'middle', ok: ['graphql', 'rest'], alt: 0.75, altWhy: 'Шлюз просто передаёт запрос приложения дальше. Для главного экрана это GraphQL; REST допустим, если BFF отдаёт REST.', why: 'Шлюз передаёт BFF запрос приложения как есть — GraphQL главного экрана.', hint: 'Шлюз не меняет язык запроса — он только провожает.' },
    { id: 'e3', a: 'bff', b: 'core', pts: [[450, 104], [450, 210]], lp: [458, 160], la: 'start', ok: ['rest', 'grpc'], alt: 0.85, altWhy: 'gRPC внутри тоже бывает, но у «Пульса» внутренний синхронный протокол — REST.', why: 'BFF спрашивает ядро по внутреннему REST и ждёт ответ.', hint: 'BFF собирает экран сейчас. Ему нужен ответ или факт «когда-нибудь»?', no: { ksub: 'BFF собирает экран сейчас — ждать событий он не может.', sql: 'BFF не лезет в чужую базу: у ядра есть API.' } },
    { id: 'e4', a: 'bff', b: 'bonus', pts: [[528, 80], [590, 80]], lp: [559, 72], la: 'middle', ok: ['rest', 'grpc'], alt: 0.85, altWhy: 'gRPC тоже синхронный, но внутри «Пульса» договорились о REST.', why: 'Баланс бонусов для экрана — синхронный REST к API Бонусов с коротким таймаутом.', hint: 'Экрану нужен баланс сейчас. Каким способом спросить?', no: { ksub: 'Экрану нужен баланс сейчас, а не «когда придёт событие».', sql: 'Чужая база — только через API хозяина.' } },
    { id: 'e5', a: 'core', b: 'pg', pts: [[450, 274], [450, 304]], lp: [458, 292], la: 'start', ok: ['sql'], why: 'Ядро работает со своей базой по SQL.', hint: 'Как приложение говорит со своей базой данных?' },
    { id: 'e6', a: 'core', b: 'kafka', pts: [[528, 244], [590, 244]], lp: [559, 236], la: 'middle', ok: ['kpub'], why: 'Ядро публикует доменные события через outbox.', hint: 'Ядро сообщает миру факты: «записался», «оплатил». Что оно делает с Kafka?', no: { ksub: 'Ядро здесь издатель: оно пишет факты, а не читает чужие.' } },
    { id: 'e7', a: 'bonus', b: 'kafka', pts: [[652, 104], [652, 220]], lp: [660, 166], la: 'start', ok: ['ksub'], why: 'Бонусы читают события посещений и записей своей группой.', hint: 'Бонусы узнают о посещениях. Пишут они в Kafka или читают?', no: { kpub: 'Бонусы тоже публикуют <code>BonusAccrued</code>, но эта стрелка — про то, как они узнают о посещениях.', rest: 'По ADR-007 Бонусы общаются с ядром только событиями.' } },
    { id: 'e8', a: 'notif', b: 'kafka', pts: [[652, 384], [652, 268]], lp: [660, 330], la: 'start', ok: ['ksub'], why: 'Уведомления читают события и решают, кому что отправить.', hint: 'Откуда Уведомления узнают, что пора отправить пуш?', no: { kpub: 'Уведомления здесь читатель: факты пишут Запись, Абонементы, Бонусы.' } },
    { id: 'e9', a: 'notif', b: 'rmq', pts: [[714, 408], [760, 408]], lp: [737, 400], la: 'middle', ok: ['amqp'], why: 'Уведомления кладут задачи «отправь пуш/SMS» в RabbitMQ.', hint: 'Поручение «отправь» одному исполнителю — через что?' },
    { id: 'e10', a: 'fp', b: 'gw', pts: [[130, 384], [230, 268]], lp: [132, 330], la: 'start', ok: ['rest'], why: 'Partner API — REST с OAuth Client Credentials и лимитом 20 запросов/с.', hint: 'Какой протокол поймёт любой новый партнёр и легко ограничивается по частоте?', no: { graphql: 'Партнёрам — стабильный, кэшируемый, ограничиваемый по частоте REST (неделя 3).', grpc: 'Каждому новому партнёру генерировать код из .proto и поднимать HTTP/2 — лишнее.', hook: 'Вебхук — наш звонок им. А тут они спрашивают нас.' } },
    { id: 'e11', a: 'gw', b: 'pgw', pts: [[290, 268], [372, 400]], lp: [334, 346], la: 'end', ok: ['rest'], why: 'Шлюз передаёт <code>/partner/v1/*</code> Партнёрскому шлюзу по REST.', hint: 'Шлюз провожает запрос партнёра дальше. На каком языке?' },
    { id: 'e12', a: 'pgw', b: 'fp', pts: [[372, 420], [156, 420]], lp: [264, 436], la: 'middle', ok: ['hook', 'rest'], alt: 0.75, altWhy: 'Технически вебхук — это REST-вызов к партнёру. Но на диаграмме важен смысл: мы сами сообщаем о событии (<code>visit.completed</code>), с подписью и повторами.', why: 'Вебхук <code>visit.completed</code>: мы сообщаем ФитПассу, что его клиент прошёл в клуб.', hint: 'Кирилл просил присылать им уведомление, когда клиент прошёл в клуб. Как называется такой вызов?' }
  ];
  const CE_SAMPLE = { id: 's1', a: 'an', b: 'kafka', pts: [[760, 244], [714, 244]], lp: [737, 236] };
  const nm = id => CN[id].t.replace(/\n/g, ' ');
  function c4Eval(a) {
    a = a || {};
    const p = a.p || {}, d = a.d || {};
    return CE.map(e => {
      const pv = p[e.id], dv = d[e.id];
      const pp = !pv ? 0 : pv === e.ok[0] ? 1 : e.ok.includes(pv) ? (e.alt || 0.5) : 0;
      const dirOk = dv === 'ab';
      const pts = pp * 0.7 + (dirOk ? 0.3 : 0);
      const s = !pv || !dv ? 'bad' : pts >= 0.99 ? 'ok' : pp > 0 ? 'warn' : 'bad';
      return { e, pv, dv, pp, dirOk, pts, s };
    });
  }
  function c4PracticeSVG(a, rv) {
    const W = 900, H = 450;
    let s = `<svg viewBox="0 0 ${W} ${H}" style="min-width:720px" role="img" aria-label="Диаграмма контейнеров «Пульс», сезон 2">${defs('acm-p2')}`;
    CE.forEach(e => {
      const pv = (a.p || {})[e.id], dv = (a.d || {})[e.id], r = rv && rv[e.id];
      const col = r ? r : pv && dv ? 'accent' : 'mute';
      const label = pv ? (PROTO.find(x => x.v === pv) || {}).s : '?';
      s += edgeSVG('acm-p2', e, e.pts, { col, dir: dv === 'ab' ? 'fwd' : dv === 'ba' ? 'back' : 'none', dash: !pv || !dv, w: pv && dv ? 2.2 : 1.5, label, lcol: pv ? (r || 'accent') : 'dim' });
    });
    s += edgeSVG('acm-p2', CE_SAMPLE, CE_SAMPLE.pts, { col: 'dim', label: 'Kafka: читает', lcol: 'dim' });
    Object.keys(CN).forEach(id => { s += nodeSVG(Object.assign({ id }, CN[id])); });
    s += `<text x="822" y="290" text-anchor="middle" style="fill:var(--text-muted);font:400 10.5px var(--f-mono, monospace)">пример</text>`;
    return s + '</svg>';
  }
  const c4Task = {
    id: 'c4', title: 'Диаграмма контейнеров «Пульс, сезон 2»',
    simple: howC4.simple,
    lead: ui.brief({
      situation: 'Для комитета в пятницу Антон рисует уровень 2 C4 — контейнеры «Пульса» после ADR-007: ядро, BFF, API-шлюз, Бонусы, Уведомления, Аналитика, Партнёрский шлюз, PostgreSQL, Kafka, RabbitMQ и ФитПасс снаружи. Прямоугольники стоят, линии проведены — осталось подписать 12 стрелок.',
      todo: [
        'В каждой строке под схемой нажмите направление: кто начинает разговор.',
        'Выберите протокол из списка. Схема перерисовывается по вашим ответам: стрелка получает наконечник и подпись.',
        'Стрелка «Аналитика → Kafka» — пример, она уже подписана.',
        'Нажмите «Проверить». Засчитывается от 80 %, когда подписаны все стрелки.'
      ],
      lookTitle: 'Как читать стрелку',
      look: 'Стрелка идёт от того, кто начинает разговор: вызывает, публикует или читает. Kafka никого не вызывает — читатели сами забирают события, поэтому стрелка читателя смотрит <b>на</b> Kafka. Пунктир — стрелка ещё не подписана. Синие округлые — базы и брокеры, пунктирная рамка вокруг узла — внешняя система.'
    }),
    blank: () => ({ p: {}, d: {} }),
    reference: () => ({ p: Object.fromEntries(CE.map(e => [e.id, e.ok[0]])), d: Object.fromEntries(CE.map(e => [e.id, 'ab'])) }),
    render(el, ctx) {
      el.classList.add('acm-root');
      const a = ctx.ans; a.p = a.p || {}; a.d = a.d || {};
      let rv = null, mrv = null;
      if (ctx.result) {
        rv = {}; mrv = {};
        c4Eval(a).forEach(x => {
          if (!x.pv && !x.dv) return;
          rv[x.e.id] = x.s;
          const why = !x.dv ? 'Выберите направление.' : !x.dirOk ? (x.e.ok[0] === 'ksub' ? 'Направление: Kafka никого не вызывает — читатель сам забирает события. Стрелка от читателя к Kafka.' : `Направление: разговор начинает «${esc(nm(x.e.a))}».`) : '';
          const pw = !x.pv ? 'Выберите протокол.' : x.pp === 1 ? x.e.why : x.pp > 0 ? x.e.altWhy : ((x.e.no && x.e.no[x.pv]) || x.e.hint);
          mrv[x.e.id] = { s: x.s, why: [pw, why].filter(Boolean).join(' ') };
        });
      }
      if (ctx.readonly) { mrv = {}; CE.forEach(e => { mrv[e.id] = { s: 'ok', why: e.why }; }); }
      const board = mount(el, 'acm-board'); board.style.marginBottom = '12px';
      const drawSvg = () => { board.innerHTML = c4PracticeSVG(a, rv); };
      drawSvg();
      const rowT = e => `<b>${esc(nm(e.a))} — ${esc(nm(e.b))}</b><div class="acm-dir">${['ab', 'ba'].map(k => `<button type="button" data-dir="${e.id}|${k}" aria-pressed="${a.d[e.id] === k}" ${ctx.readonly ? 'disabled' : ''}>${esc(k === 'ab' ? nm(e.a) : nm(e.b))} → ${esc(k === 'ab' ? nm(e.b) : nm(e.a))}</button>`).join('')}</div>`;
      const box = mount(el);
      ui.match(box, {
        rows: CE.map(e => ({ id: e.id, t: rowT(e) })), choices: PROTO.map(p => ({ v: p.v, t: p.t })), value: a.p, reveal: mrv, readonly: ctx.readonly, placeholder: 'Протокол…',
        onChange: v => { a.p = v; rv = null; ctx.save(); drawSvg(); }
      });
      if (ctx.readonly) return;
      TR.on(box, 'click', '[data-dir]', (e, b) => {
        const [id, k] = b.dataset.dir.split('|');
        a.d[id] = k; rv = null; ctx.save();
        TR.$$(`[data-dir^="${id}|"]`, box).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.dir === b.dataset.dir)));
        drawSvg();
        ctx.decide('C4: стрелки подписаны', `${Object.keys(a.p).length} протоколов, ${Object.keys(a.d).length} направлений из ${CE.length}`);
      });
    },
    check(ans) {
      const ev = c4Eval(ans), score = ev.reduce((s, x) => s + x.pts, 0) / CE.length;
      const empty = ev.filter(x => !x.pv || !x.dv).length;
      const notes = [];
      ev.forEach(x => {
        const name = `${nm(x.e.a)} — ${nm(x.e.b)}`;
        if (!x.pv || !x.dv) { notes.push({ ok: false, html: `«${esc(name)}»: ${!x.pv && !x.dv ? 'не подписана' : !x.pv ? 'нет протокола' : 'нет направления'}.` }); return; }
        if (x.s === 'ok') return;
        const parts = [];
        if (x.pp === 0) parts.push((x.e.no && x.e.no[x.pv]) || x.e.hint);
        else if (x.pp < 1) parts.push(x.e.altWhy);
        if (!x.dirOk) parts.push(x.e.ok[0] === 'ksub' ? 'Kafka никого не вызывает: читатель сам забирает события — стрелка от читателя.' : `Кто начинает разговор? Подумайте, кто здесь вызывает или публикует.`);
        notes.push({ ok: x.pp > 0 ? 'warn' : false, html: `«${esc(name)}»: ${parts.join(' ')}` });
      });
      if (!notes.length) notes.push({ ok: true, html: 'Все 12 стрелок подписаны верно.' });
      return {
        ok: empty === 0 && score >= 0.8, score, notes,
        summary: `Подписано: ${CE.length - empty} из ${CE.length}. Точно: ${ev.filter(x => x.s === 'ok').length}.`,
        vera: empty ? 'Подпишите все стрелки: на диаграмме контейнеров стрелка без протокола — дыра в контракте.' : null
      };
    },
    explain: `<p>Диаграмма контейнеров — главная картинка для разработчиков и SRE: на ней видно, <b>что отдельно запускается</b> и <b>как оно разговаривает</b>. Каждая стрелка — будущий контракт: OpenAPI для REST, схема GraphQL, AsyncAPI для топиков Kafka, описание очереди RabbitMQ.</p>
      <ul class="checks">
        <li>Снаружи — одна дверь: приложение и ФитПасс входят через API-шлюз. Внутрь к модулям напрямую никто не ходит.</li>
        <li>Стрелки к Kafka от читателей — частая ловушка. Данные текут из Kafka к Бонусам, но разговор начинают Бонусы: брокер никого не вызывает.</li>
        <li>Вебхук ФитПассу — единственная стрелка изнутри наружу к партнёру: мы сообщаем, они не опрашивают.</li>
      </ul>`,
    report: ans => c4Eval(ans).map(x => `- ${nm(x.e.a)} — ${nm(x.e.b)}: ${x.dv ? (x.dv === 'ab' ? nm(x.e.a) + ' → ' + nm(x.e.b) : nm(x.e.b) + ' → ' + nm(x.e.a)) : '—'}, ${tOf(PROTO, x.pv)} ${x.s === 'ok' ? '✓' : x.s === 'warn' ? '≈' : '✗'}`).join('\n')
  };

  // =====================================================================
  // Практика 3. Лаборатория «Мои записи и бонусы»
  // =====================================================================
  const PER3G = 700;
  const LSC = [
    { v: 'ok', t: 'Бонусы работают' },
    { v: 'down', t: 'Бонусы лежат' },
    { v: 'slow', t: 'Бонусы тормозят 5 с' }
  ];
  const sigOf = a => `${a.gw ? 1 : 0}${a.bff ? 1 : 0}${a.bff && a.cache ? 1 : 0}`;
  function labSim(a, sc) {
    const cache = a.bff && a.cache;
    let req, ms, screen, open, auth, path;
    if (a.bff) {
      req = 1;
      const bonusMs = cache ? 0 : sc === 'slow' ? 200 : sc === 'down' ? 5 : 40;
      ms = PER3G + (a.gw ? 5 : 0) + 10 + Math.max(60, bonusMs);
      if (sc === 'ok') screen = 'full';
      else screen = cache ? 'cached' : 'partial';
      open = a.gw ? 1 : 1; auth = a.gw ? 'шлюз' : 'BFF сам';
      path = `телефон → ${a.gw ? 'шлюз → ' : ''}BFF → (ядро ‖ ${cache ? 'кэш баланса' : 'Бонусы'})`;
    } else {
      req = 3;
      const tls = a.gw ? 0 : PER3G * 0.6;
      const bonusMs = sc === 'slow' ? 5000 : 40;
      ms = PER3G * 2 + tls + 60 + (sc === 'slow' ? bonusMs : 40);
      screen = sc === 'ok' ? 'full' : sc === 'down' ? 'error' : 'slow';
      if (sc === 'down') ms = PER3G * 2 + tls + 100;
      open = a.gw ? 1 : 2; auth = a.gw ? 'шлюз' : 'ядро и Бонусы — каждый сам';
      path = `телефон → ${a.gw ? 'шлюз → ' : ''}ядро; телефон → ${a.gw ? 'шлюз → ' : ''}Бонусы ×2`;
    }
    const green = req === 1 && ms <= 1000 && screen !== 'error' && screen !== 'slow' && a.gw;
    return { req, ms, screen, open, auth, path, green };
  }
  function phone(r) {
    const books = '<div class="bk">Йога для начинающих<small>пн, 09:00 · Зал 2 · Пульс Сокол</small></div><div class="bk">Сайкл<small>ср, 19:00 · Сайкл-студия</small></div>';
    let body;
    if (r.screen === 'error') body = '<div class="err">Не удалось загрузить экран<br><small>Повторить</small></div>';
    else if (r.screen === 'slow') body = books + '<div class="spin">Бонусы загружаются… 5 с</div>';
    else body = books + (r.screen === 'full' ? '<div class="bn"><b>1 240 бонусов</b><br><small>+10 за йогу в понедельник</small></div>' : r.screen === 'cached' ? '<div class="bn info"><b>1 240 бонусов</b><br><small>на 19:42 · обновятся позже</small></div>' : '<div class="bn warn"><b>Бонусы обновятся позже</b><br><small>записи — актуальные</small></div>');
    return `<div class="acm-phone"><div class="bar"><span>3G</span><span>${fmtMs(r.ms)}</span></div><h5>Мои записи и бонусы</h5>${body}</div>`;
  }
  const LAB_Q = {
    q: 'Сервис Бонусов лежит. Что BFF должен вернуть приложению на экран «Мои записи и бонусы»?', seed: 'acm-lab-q',
    options: [
      { t: 'Записи и пустой блок бонусов с пометкой об ошибке — частичный ответ: HTTP 200, в GraphQL и data, и errors', ok: 1, why: 'Верно. Ядро работает — Анна должна видеть свои записи. Неизвестное честно помечено, а не выдано за ноль.' },
      { t: '503 на весь экран — пусть приложение повторит запрос', why: 'Анна не увидит даже записи, хотя ядро работает. Один упавший сервис ломает весь экран.' },
      { t: 'Ждать, пока Бонусы поднимутся, и только потом ответить', why: 'Экран повиснет. BFF ждёт Бонусы не дольше своего таймаута (200 мс) — и отвечает тем, что есть.' },
      { t: 'Баланс «0 бонусов» — главное, чтобы экран не падал', why: 'Неправда на экране: Анна решит, что бонусы сгорели, и позвонит в поддержку. Неизвестно — не ноль.' }
    ]
  };
  const labTask = {
    id: 'lab', title: 'Лаборатория: «Мои записи и бонусы»',
    simple: howGw.simple,
    lead: ui.brief({
      situation: 'Денис: экран «Мои записи и бонусы» сейчас собирается в приложении из трёх запросов — записи из ядра, баланс и история из Бонусов. В клубе часто ловит только 3G: около 0,7 с на каждый запрос. А когда Бонусы падают, старые версии приложения (они живут у клиентов месяцами) показывают пустой экран. Цель из требований: не больше одного запроса с телефона, экран за 1 секунду на 3G, при падении Бонусов записи видны, вход проверяется в одном месте.',
      todo: [
        'Включайте и выключайте «API-шлюз», «BFF», «Кэш баланса в BFF».',
        'Для каждой настройки нажмите все три ситуации: «Бонусы работают», «Бонусы лежат», «Бонусы тормозят 5 с». Смотрите на телефон и счётчики.',
        'Найдите настройку, при которой все три карточки ситуаций зелёные. Засчитывается, когда все три прогнаны с этой настройкой.',
        'Ответьте на вопрос внизу и нажмите «Проверить».'
      ],
      look: 'Телефон справа — что видит Анна. «Запросов с телефона» — сколько раз приложение идёт через медленную сеть. «Время на 3G» — когда экран готов. «Адресов в интернете» и «Где проверяют вход» — сколько дверей открыто наружу. BFF ждёт Бонусы не дольше 200 мс; кэш держит баланс 60 секунд.'
    }),
    blank: () => ({ gw: false, bff: false, cache: false, sc: 'ok', seen: [], q: [] }),
    reference: () => ({ gw: true, bff: true, cache: true, sc: 'ok', seen: LSC.map(s => '111|' + s.v), q: quizRef([LAB_Q]) }),
    render(el, ctx) {
      el.classList.add('acm-root');
      const a = ctx.ans; a.seen = a.seen || []; a.q = a.q || [];
      const mark = () => { const k = sigOf(a) + '|' + a.sc; if (!ctx.readonly && !a.seen.includes(k)) { a.seen.push(k); ctx.save(); } };
      mark();
      el.innerHTML = `<div class="stack">
        <div class="acm-box"><div class="eyebrow">Настройки</div><div class="acm-toggles">
          <label><input type="checkbox" data-t="gw" ${a.gw ? 'checked' : ''} ${ctx.readonly ? 'disabled' : ''}> API-шлюз</label>
          <label><input type="checkbox" data-t="bff" ${a.bff ? 'checked' : ''} ${ctx.readonly ? 'disabled' : ''}> BFF для мобильного</label>
          <label><input type="checkbox" data-t="cache" ${a.cache ? 'checked' : ''} ${ctx.readonly ? 'disabled' : ''}> Кэш баланса в BFF (60 с)</label>
        </div><div class="acm-path" data-path></div></div>
        <div class="stack tight"><div class="eyebrow">Ситуация</div>${ui.seg('sc', LSC, a.sc)}</div>
        <div class="acm-mx" data-mx></div>
        <div class="acm-lab"><div class="stack"><div class="acm-stats" data-st style="grid-template-columns:repeat(2,minmax(0,1fr))"></div><div data-n></div></div><div data-ph></div></div>
        <div class="card flat" data-q></div>
      </div>`;
      function draw() {
        const r = labSim(a, a.sc), sig = sigOf(a);
        TR.$('[data-path]', el).textContent = 'Путь запроса: ' + r.path + (!a.bff && a.cache ? ' · кэш работает только в BFF' : '');
        TR.$('[data-mx]', el).innerHTML = LSC.map(s => { const seen = a.seen.includes(sig + '|' + s.v), x = labSim(a, s.v); return `<div class="stat ${s.v === a.sc ? 'cur' : ''}"><div class="k">${esc(s.t)}</div><div class="v ${seen ? (x.green ? 'ok' : 'bad') : ''}">${seen ? (x.green ? 'цель достигнута' : 'не дотягивает') : '—'}</div><div class="s small dim">${seen ? `${x.req} ${TR.plural(x.req, 'запрос', 'запроса', 'запросов')} · ${fmtMs(x.ms)}` : 'не прогнано с этими настройками'}</div></div>`; }).join('');
        TR.$('[data-st]', el).innerHTML = `
          <div class="stat"><div class="k">запросов с телефона</div><div class="v ${r.req > 1 ? 'bad' : 'ok'}">${r.req}</div><div class="s">цель — 1</div></div>
          <div class="stat"><div class="k">время на 3G</div><div class="v ${r.ms > 1000 ? 'bad' : 'ok'}">${fmtMs(r.ms)}</div><div class="s">цель — до 1 с</div></div>
          <div class="stat"><div class="k">адресов в интернете</div><div class="v ${r.open > 1 ? 'bad' : 'ok'}">${r.open}</div><div class="s">${a.gw ? 'одна дверь — шлюз' : a.bff ? 'BFF открыт сам' : 'ядро и Бонусы'}</div></div>
          <div class="stat"><div class="k">где проверяют вход</div><div class="v ${a.gw ? 'ok' : 'warn'}" style="font-size:13.5px">${esc(r.auth)}</div><div class="s">${a.gw ? 'один раз за всех' : 'копии одной логики'}</div></div>`;
        let n;
        if (r.screen === 'error') n = ui.note('bad', 'Пустой экран из-за Бонусов', 'Приложение само склеивает экран: один из трёх запросов упал — старая версия показывает «Не удалось загрузить». Анна не видит даже свои записи, хотя ядро работает.');
        else if (r.screen === 'slow') n = ui.note('bad', 'Экран ждёт медленного соседа', `Приложение ждёт Бонусы 5 секунд — таймаут на телефоне длинный, а решать, когда хватит ждать, некому. Экран готов через ${fmtMs(r.ms)}.`);
        else if (r.screen === 'partial') n = ui.note('warn', 'Частичный ответ', 'BFF не дождался Бонусов (ошибка или таймаут 200 мс) и ответил тем, что есть: записи — актуальные, блок бонусов — «обновятся позже». Экран жив. Включите кэш — Анна увидит последний известный баланс.');
        else if (r.screen === 'cached') n = ui.note('ok', 'Последний известный баланс', 'BFF взял баланс из кэша и честно подписал время. Бонусы лежат или тормозят — Анна этого почти не замечает.');
        else n = r.green ? ui.note('ok', 'Цель достигнута', `Один запрос через шлюз, BFF собирает экран внутри дата-центра — ${fmtMs(r.ms)} на 3G.`) : ui.note(r.req > 1 ? 'warn' : '', 'Работает, но не по требованиям', r.req > 1 ? `${r.req} запроса по 3G — ${fmtMs(r.ms)}. Каждый запрос с телефона дорог.` : 'Экран быстрый, но без шлюза BFF открыт в интернет сам и сам проверяет вход и лимиты.');
        TR.$('[data-n]', el).innerHTML = n;
        TR.$('[data-ph]', el).innerHTML = phone(r);
      }
      draw();
      ui.quiz(TR.$('[data-q]', el), Object.assign({}, LAB_Q, { value: a.q[0] || [], readonly: ctx.readonly, reveal: ctx.result, onChange: v => { a.q = [v]; ctx.save(); } }));
      ui.onSeg(el, (name, v) => { if (name !== 'sc') return; a.sc = v; mark(); if (!ctx.readonly) ctx.save(); draw(); });
      if (ctx.readonly) return;
      el.addEventListener('change', e => {
        const c = e.target.closest('[data-t]'); if (!c) return;
        a[c.dataset.t] = c.checked; mark(); ctx.save();
        ctx.decide('Экран «Мои записи и бонусы»', `шлюз: ${a.gw ? 'да' : 'нет'}, BFF: ${a.bff ? 'да' : 'нет'}, кэш: ${a.bff && a.cache ? 'да' : 'нет'}`);
        draw();
      });
    },
    check(ans) {
      const sig = sigOf(ans), seen = ans.seen || [];
      const res = LSC.map(s => ({ s, r: labSim(ans, s.v), seen: seen.includes(sig + '|' + s.v) }));
      const greens = res.filter(x => x.r.green).length, seenAll = res.every(x => x.seen);
      const q = ui.quizScore(LAB_Q, (ans.q || [])[0] || []);
      const notes = [];
      if (!ans.gw) notes.push({ ok: false, html: 'Без шлюза наружу открыто несколько дверей, и каждая сама проверяет вход и лимиты. Где должна быть единственная дверь?' });
      if (!ans.bff) notes.push({ ok: false, html: 'Без BFF телефон сам ходит за тремя ответами по 3G и сам решает, что делать при ошибке. Кто мог бы собрать экран на сервере?' });
      if (ans.bff && !ans.cache) notes.push({ ok: 'warn', html: 'Работает и без кэша: при падении Бонусов Анна видит «обновятся позже». С кэшем — последний известный баланс. Это вопрос требований: что лучше показать?' });
      res.forEach(x => { if (!x.seen) notes.push({ ok: 'warn', html: `Ситуация «${esc(x.s.t)}» с этими настройками не прогнана.` }); });
      notes.push(q.ok ? { ok: true, html: 'Вопрос: верно — частичный ответ.' } : { ok: false, html: 'Вопрос внизу: что честнее показать Анне, когда о бонусах ничего не известно, а записи известны?' });
      const score = (ans.gw ? 0.2 : 0) + (ans.bff ? 0.3 : 0) + (ans.bff && ans.cache ? 0.1 : 0) + (seenAll ? 0.15 : 0) + q.score * 0.25;
      return {
        ok: greens === 3 && seenAll && q.ok, score, notes,
        summary: `Ситуаций, где цель достигнута: ${greens} из 3 (шлюз ${ans.gw ? 'да' : 'нет'}, BFF ${ans.bff ? 'да' : 'нет'}, кэш ${ans.bff && ans.cache ? 'да' : 'нет'}).`,
        vera: greens < 3 ? 'Цель про три вещи: один запрос с телефона, одна дверь наружу и экран, который живёт без Бонусов. Каждая — своя деталь архитектуры.' : null
      };
    },
    explain: `<p>Эталон — <b>шлюз + BFF</b> (кэш — по желанию бизнеса). Каждая деталь отвечает за своё требование:</p>
      <ul class="checks">
        <li><b>API-шлюз</b> — одна дверь: вход, лимиты, маршрут. Без него каждый сервис открыт сам и сам проверяет токены.</li>
        <li><b>BFF</b> — один запрос по медленной сети вместо трёх, таймаут 200 мс на Бонусы и <b>частичный ответ</b>: записи видны, даже когда Бонусы лежат. Логика склейки на сервере — старые версии приложения получают то же поведение.</li>
        <li><b>Кэш баланса</b> — «последний известный» вместо «неизвестно». Решение бизнеса, а не техники: Ольга может предпочесть честное «обновится позже».</li>
      </ul>
      <p>Что написать в постановке: «Экран “Мои записи и бонусы”: один запрос; p95 ≤ 1 с на 3G; при недоступности Бонусов — записи и плашка “Бонусы обновятся позже” (или баланс из кэша с временем); статус 200, ошибка части — в <code>errors</code>».</p>`,
    report: ans => `Шлюз: ${ans.gw ? 'да' : 'нет'}, BFF: ${ans.bff ? 'да' : 'нет'}, кэш: ${ans.bff && ans.cache ? 'да' : 'нет'}.\n` + LSC.map(s => { const r = labSim(ans, s.v); return `- ${s.t}: ${r.req} запр., ${fmtMs(r.ms)}, экран: ${r.screen}${(ans.seen || []).includes(sigOf(ans) + '|' + s.v) ? '' : ' (не прогнано)'}`; }).join('\n') + `\nВопрос: ${ui.quizScore(LAB_Q, (ans.q || [])[0] || []).ok ? 'верно' : 'неверно'}.`
  };

  // =====================================================================
  // Практика 4. Требования к шлюзу
  // =====================================================================
  const GW_RUBRIC = [
    'Маршрутизация: какие пути куда ведут (/v1/* → BFF и ядро, /partner/v1/* → Партнёрский шлюз, /webhooks/paypoint → Платежи), версия в пути',
    'Вход по путям: JWT приложения, OAuth Client Credentials со scopes для партнёров, публичное расписание без входа, вебхук ПэйПоинта — список IP (подпись проверяют Платежи)',
    'Лимиты: 20 запросов/с на партнёра → 429 + Retry-After и заголовки RateLimit-*; защита входа по SMS от перебора',
    'Измеримые нефункциональные требования: сколько шлюз добавляет к задержке (например, p95 ≤ 10 мс), доступность не ниже ядра (две зоны) — это единая дверь; таймауты к сервисам',
    'Наблюдаемость и безопасность: traceId на каждый запрос, журнал, TLS, ограничение размера тела, CORS для сайта',
    'Чего шлюз не делает: бизнес-правил (места, штрафы, «чужая запись» — это проверяют хозяева данных)'
  ];
  const GW_REF = 'Требования к API-шлюзу «Пульса». 1) Маршрутизация: /v1/* — к BFF мобильного и ядру, /partner/v1/* — к Партнёрскому шлюзу, /webhooks/paypoint — к Платежам; версия API в пути, снятие версии — заголовками Deprecation и Sunset. 2) Вход: для приложения — JWT (OAuth 2.0 + PKCE), для партнёров — OAuth Client Credentials со scopes, публичное расписание — без входа, вебхук ПэйПоинта — только со списка IP, а подпись HMAC проверяют сами Платежи. 3) Лимиты: 20 запросов в секунду на партнёра, при превышении 429 и Retry-After, в каждом ответе RateLimit-Limit/Remaining/Reset; отдельный лимит на отправку SMS-кода. 4) Качество: шлюз добавляет не больше 10 мс к p95, его доступность не ниже, чем у записи (99,9 %, две зоны), — это единственная дверь; таймауты к сервисам заданы, BFF — 3 с. 5) Каждому запросу — traceId, журнал без персональных данных, только TLS, тело не больше 1 МБ, CORS для сайта. 6) Чего шлюз не делает: не проверяет места, не считает штрафы, не решает, чья запись, — это правила хозяев данных, иначе шлюз станет вторым монолитом.';
  const gwReqTask = {
    id: 'gw-req', title: 'Требования к шлюзу',
    simple: howGw.simple,
    lead: ui.brief({
      situation: 'Антон: «Шлюз ставим. Но DevOps спрашивают, что именно настраивать. Мне нужны требования от аналитика — не “чтобы было безопасно”, а конкретно: что, где, сколько». Сергей добавляет: «И сколько шлюз может стоить нам по задержке — он же на каждом запросе».',
      todo: [
        'Напишите требования к API-шлюзу списком или абзацами (от 400 символов).',
        'Покройте: маршруты, вход по путям, лимиты, измеримые требования к качеству, наблюдаемость и безопасность — и чего шлюз делать не должен.',
        'Нажмите «Проверить с Верой (Claude)» или «Сверить с эталоном самому». Засчитывается от 60 %.'
      ],
      lookTitle: 'На что опереться',
      look: 'Из блокнота: ФитПасс — OAuth 2.0, ретраит любую ошибку через 3 с, до 50 запросов/с; Partner API — лимит 20 запросов/с на партнёра; ПэйПоинт шлёт вебхуки с подписью HMAC; пентест нашёл чужую запись по номеру в адресе. Из теории — четыре варианта прохождения запроса и «что положить в шлюз».'
    }),
    blank: () => ({ j: {} }),
    reference: () => ({ j: { text: GW_REF, self: GW_RUBRIC.map(() => true) } }),
    render(el, ctx) {
      el.classList.add('acm-root');
      el.insertAdjacentHTML('beforeend', ui.say('sergey', 'И не забудьте: шлюз — это единая точка отказа. Если он лёг, лежит всё. Напишите, сколько он должен держать.'));
      const j = mount(el); j.style.marginTop = '12px';
      ui.justify(j, {
        id: 'acm-gw', q: 'Какие требования к API-шлюзу вы запишете?',
        qPlain: 'Сформулируйте требования аналитика к API-шлюзу «Пульса»: маршрутизация, вход по путям, лимиты, измеримые нефункциональные требования, наблюдаемость и безопасность, и чего шлюз делать не должен.',
        rubric: GW_RUBRIC, reference: GW_REF, value: ctx.ans.j, readonly: ctx.readonly, minLen: 400,
        onChange: v => { ctx.ans.j = v; ctx.save(); ctx.decide('Требования к API-шлюзу', v.text || ''); }
      });
    },
    check(ans) {
      const s = ui.justifyScore(ans && ans.j), txt = String(((ans && ans.j) || {}).text || '');
      const notes = [];
      if (txt.length >= 400 && !/\d/.test(txt)) notes.push({ ok: 'warn', html: 'Не видно ни одной цифры. Требование без числа не проверить: сколько запросов в секунду, сколько миллисекунд, какой процент доступности?' });
      if (txt.length >= 400 && !/не (делает|долж|провер|счита)|бизнес/i.test(txt)) notes.push({ ok: 'warn', html: 'Не сказано, чего шлюз не делает. Где граница между шлюзом и хозяевами данных?' });
      if (s && s < 0.6) notes.push({ ok: false, html: 'Пройдитесь по шести темам: маршруты, вход, лимиты, качество с цифрами, наблюдаемость, граница ответственности.' });
      return { ok: s >= 0.6, score: s, notes, summary: s ? `Оценка требований: ${Math.round(s * 100)} %.` : 'Напишите требования (от 400 символов) и проверьте их с Верой или сверьте с эталоном сами.' };
    },
    explain: `<p>Хорошие требования к шлюзу — <b>таблица, которую DevOps может настроить</b>, и <b>цифры, которые SRE может проверить</b>: путь → сервис → вход → лимит → таймаут. Плюс нефункциональные: задержка шлюза, доступность (он единая дверь — значит, держит не меньше, чем самое важное за ним), трассировка.</p>
      <p>И отдельной строкой — чего шлюз не делает. Бизнес-правила в шлюзе — частая беда: «давайте проверим места прямо на входе». Тогда правила Записи живут в двух местах, а шлюз становится вторым монолитом, который выкатывают вместе со всеми.</p>`,
    report: ans => (ans.j && ans.j.text) ? ans.j.text : '—'
  };

  // =====================================================================
  TR.stage({
    id: 'arch-comm', act: 6, order: 330, slot: 'Ср 10:00', title: 'Как модули общаются',
    when: 'среда, 10:00 · переговорная «Кроссфит» · Антон, Денис, Сергей',
    intro: [
      { who: 'anton', html: 'Границы провели. Теперь — как модули разговаривают. Способов три: спросить и ждать ответ, сообщить всем событием, поручить задачу через очередь. Плюс вход снаружи: API-шлюз и BFF для приложения. К пятнице всё это должно лечь на схему C4 для комитета.' },
      { who: 'denis', html: 'Мне главное — экран «Мои записи и бонусы». Сейчас приложение ходит в ядро и в Бонусы отдельно, на 3G это две-три секунды. А когда Бонусы падают, старые версии показывают пустой экран — и звонят в поддержку.' },
      { who: 'vera', html: 'Сначала три способа на соседнем примере, потом C4 — как читать одну карту в трёх масштабах, и путь запроса через шлюз и BFF по шагам. В практике — способ для десяти взаимодействий, диаграмма контейнеров, лаборатория экрана Дениса и требования к шлюзу.' }
    ],
    facts: ['F-mobile', 'F-old-apps', 'F-fitpass-tech', 'F-turnstile-fast', 'F-push', 'F-psp'],
    glossary: [
      { term: 'Запрос-ответ', simple: 'Позвонить и держать трубку, пока не ответят: сразу знаешь результат, но и ждёшь сам.', tech: 'Синхронное взаимодействие (REST, gRPC): вызывающий ждёт ответа; получатель должен работать прямо сейчас. Нужны таймаут и решение, что делать при ошибке.' },
      { term: 'API-шлюз (API gateway)', simple: 'Ресепшен клуба: проверяет карту, считает гостей и подсказывает, куда идти. По служебным коридорам гости не ходят.', tech: 'Единая точка входа снаружи: маршрутизация по пути, аутентификация, лимиты частоты, TLS, traceId, журнал. Бизнес-правил не содержит.' },
      { term: 'Маршрутизация запросов', simple: 'Табличка на ресепшене: «бассейн — налево, тренажёрный — второй этаж».', tech: 'Правило шлюза «путь → сервис»: /v1/* — к BFF и ядру, /partner/v1/* — к Партнёрскому шлюзу, /webhooks/paypoint — к Платежам. Клиент не знает внутренних адресов.' },
      { term: 'Частичный ответ', simple: 'Кафе закончило десерты — вам всё равно принесли обед и честно сказали про десерт.', tech: 'Ответ, в котором часть данных недоступна, но остальное показано: в GraphQL — data и errors при статусе 200. Решение, что показать вместо недоступного, — требование к экрану.' },
      { term: 'Агрегация запросов (fan-out)', simple: 'Консьерж сам обходит три окна и приносит всё сразу — вам не надо стоять в каждой очереди.', tech: 'BFF или шлюз параллельно вызывает несколько сервисов и склеивает ответы в один. Время ответа — по самому медленному вызову, поэтому у каждого вызова свой короткий таймаут и план на случай отказа.' },
      { term: 'Контейнер (в C4)', simple: 'Отдельное здание клуба: свой вход, своё электричество. Ремонтируют отдельно.', tech: 'То, что отдельно запускается или хранит данные: приложение, сервис, база, брокер. Не путать с Docker-контейнером. На стрелках между контейнерами — протоколы.' },
      { term: 'Компонент (в C4)', simple: 'Комната внутри здания: тренерская, касса, раздевалка.', tech: 'Модуль внутри одного контейнера с понятной ответственностью и API, например «Запись» или «Абонементы» внутри ядра. Вызовы между компонентами — в памяти, не по сети.' },
      { term: 'Единая точка отказа', simple: 'Один вход в клуб: заклинило дверь — не попадёт никто, даже если внутри всё работает.', tech: 'Компонент, без которого не работает вся система (single point of failure). Для шлюза нужны несколько экземпляров в двух зонах и доступность не ниже самого важного сервиса за ним.' },
      { term: 'Задержка сети (RTT)', simple: 'Сколько идёт письмо туда и ответ обратно. В соседний кабинет — секунда, на почте 3G — долго.', tech: 'Round-trip time: время «туда и обратно». Внутри дата-центра — миллисекунды, по 3G — сотни миллисекунд. Поэтому лишние запросы с телефона дороги, а внутри BFF — почти бесплатны.' }
    ],
    outro: 'Три способа — четыре вопроса: кто начинает, нужен ли ответ сейчас, факт это или поручение, сколько получателей. Снаружи — одна дверь: шлюз, а для телефона — BFF, который собирает экран и честно показывает то, что есть. А на диаграмме контейнеров каждая стрелка — контракт, который пишете вы. Завтра — саги: как довести до конца покупку абонемента с бонусами, когда её шаги живут в разных сервисах.',
    tasks: [howWays, howC4, howGw, waysTask, c4Task, labTask, gwReqTask]
  });
})();
