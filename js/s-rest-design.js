/* Неделя 3, понедельник 15:00: ресурсы и методы REST.
   Студент сортирует адреса, сам собирает справочник API из историй пользователя (метод, путь, код успеха) с живым линтером пути,
   разбирается в безопасных и идемпотентных методах на симуляторе «отправить 3 раза» и обосновывает дизайн отмены записи. Канон: _dev/DOMAIN.md §10. */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc;

  if (!document.getElementById('rd-css')) {
    document.head.insertAdjacentHTML('beforeend', `<style id="rd-css">
      .rd-story { border: 1px solid var(--border); border-radius: 10px; padding: 10px; background: var(--surface); display: grid; gap: 8px; min-width: 0; }
      .rd-story.ok { border-color: var(--ok); } .rd-story.warn { border-color: var(--warn); } .rd-story.bad { border-color: var(--bad); }
      .rd-story .st { font-weight: 600; font-size: 14.5px; }
      .rd-story .st small { display: block; font-weight: 400; color: var(--text-muted); font-size: 12.5px; }
      .rd-in { display: grid; grid-template-columns: 104px minmax(0, 1fr) 84px; gap: 8px; align-items: center; min-width: 0; }
      .rd-in input { font-family: var(--f-mono); font-size: 13.5px; }
      .rd-lint { font-size: 12.5px; color: var(--warn); display: grid; gap: 2px; }
      .rd-lint.ok { color: var(--text-muted); }
      .rd-mx td, .rd-mx th { text-align: center !important; }
      .rd-mx td:first-child, .rd-mx th:first-child { text-align: left !important; }
      .rd-mx input { width: 18px; height: 18px; accent-color: var(--accent); }
      .rd-log { font: 12.5px/1.6 var(--f-mono); background: var(--code-bg); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; min-height: 64px; overflow-x: auto; white-space: pre; }
      .rd-log .ok { color: var(--ok); } .rd-log .bad { color: var(--bad); } .rd-log .warn { color: var(--warn); } .rd-log .dim { color: var(--text-muted); }
      @media (max-width: 520px) { .rd-in { grid-template-columns: 1fr 1fr; } .rd-in input { grid-column: 1 / -1; grid-row: 1; } }
    </style>`);
  }
  const mkEl = (parent, cls) => { const d = document.createElement('div'); if (cls) d.className = cls; parent.appendChild(d); return d; };

  // ---------- подход 1: существительные, а не глаголы ----------
  const NOUN_BUCKETS = [
    { id: 'good', t: 'Хороший ресурс', sub: 'существительное, понятная иерархия' },
    { id: 'caveat', t: 'Допустимо с оговоркой', sub: 'работает, но можно лучше' },
    { id: 'bad', t: 'Плохо, переделать', sub: 'глагол, хаос, утечка деталей' }
  ];
  const NOUNS = [
    { id: 'n1', t: '<code>/getSchedule</code>', ok: ['bad'], hint: 'в адресе глагол. Что тогда делает метод HTTP?' },
    { id: 'n2', t: '<code>/clubs/{clubId}/classes</code>', ok: ['good'], hint: 'это коллекция занятий внутри клуба — существительные во множественном числе.' },
    { id: 'n3', t: '<code>/createBooking</code>', ok: ['bad'], hint: '«create» уже говорит метод POST. Адрес должен называть ресурс.' },
    { id: 'n4', t: '<code>/classes?clubId=…&amp;date=…</code>', ok: ['good', 'caveat'], why: 'Это нормальный REST: коллекция с фильтрами в параметрах запроса. Канон допускает оба вида.', hint: 'фильтры в параметрах запроса — обычная практика REST.' },
    { id: 'n5', t: '<code>/Clubs/List</code>', ok: ['bad'], hint: 'заглавные буквы и «List» — глагол-действие. Список уже означает GET на коллекцию.' },
    { id: 'n6', t: '<code>/me/bookings</code>', ok: ['good'], hint: '«мои записи»: клиент берётся из токена, в адресе нет чужого id.' },
    { id: 'n7', t: '<code>/bookings/{bookingId}/cancellation</code>', ok: ['good'], hint: '«отмена» — существительное: событие со своими данными (штраф, время). Это ресурс.' },
    { id: 'n8', t: '<code>/users/1/bookings/2/payments/3/refunds/4</code>', ok: ['bad', 'caveat'], why: 'Работать будет, но четыре уровня вложенности и последовательные номера — это плохо.', hint: 'четыре уровня вложенности и номера по порядку. Вспомните пентест: номер в адресе меняли на соседний.' },
    { id: 'n9', t: '<code>/api/doAction</code>', ok: ['bad'], hint: 'по адресу непонятно ни ресурса, ни действия. Это RPC, переодетый в HTTP.' },
    { id: 'n10', t: '<code>/booking</code>', ok: ['caveat', 'bad'], why: 'Единственное число — не ошибка протокола, но коллекции принято называть во множественном: /bookings.', hint: 'существительное есть, но коллекция в единственном числе. Принято ли так?' },
    { id: 'n11', t: '<code>/membership_plans</code>', ok: ['caveat', 'bad'], why: 'Подчёркивание работает, но в адресах принят дефис: /membership-plans.', hint: 'ресурс верный, а вот разделитель слов?' },
    { id: 'n12', t: '<code>/clubs/{clubId}/classes/{classId}/bookings</code>', ok: ['caveat', 'good'], why: 'Работает, но classId и так уникален по всей сети — clubId в пути лишний. Хватит /classes/{classId}/bookings.', hint: 'нужен ли clubId, если classId уникален по всей сети?' },
    { id: 'n13', t: '<code>/bookings/{id}?action=cancel</code>', ok: ['bad'], hint: 'действие спрятано в параметр. Как выразить отмену ресурсом или методом?' }
  ];

  // ---------- подход 2: конструктор эндпоинтов ----------
  const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  const CODES = ['200', '201', '202', '204'];
  const ID = '\\{id\\}';
  const R = s => new RegExp('^' + s.replace(/\{id\}/g, ID) + '$');
  const STORIES = [
    { id: 'sched', t: 'Посмотреть расписание клуба на дату', who: 'клиент в приложении, посетитель сайта',
      v: [{ m: 'GET', re: R('/clubs/{id}/classes'), c: ['200'], ref: '/clubs/{clubId}/classes?date=2026-10-05' }, { m: 'GET', re: R('/classes'), c: ['200'], note: 'фильтры в параметрах (?clubId=…&date=…) — тоже чистый REST.' }, { m: 'GET', re: R('/clubs/{id}/schedule'), c: ['200'], pts: 0.85, note: '«schedule» понятно, но ресурс здесь — занятия: тот же /classes пригодится для карточки занятия.' }],
      hm: 'только читаем — какой метод ничего не меняет?', hp: 'ресурс — занятия клуба, а дата — фильтр. Фильтрам место в параметрах запроса (?date=…), а не в пути.', hc: 'отдаём данные — обычный успешный ответ.' },
    { id: 'book', t: 'Записаться на занятие', who: 'клиент',
      v: [{ m: 'POST', re: R('/classes/{id}/bookings'), c: ['201'], ref: '/classes/{classId}/bookings' }, { m: 'POST', re: R('/bookings'), c: ['201'], note: 'classId в теле — тоже верно. Вложенный путь нагляднее показывает, куда записываемся.' }],
      traps: [{ m: 'PUT', note: 'PUT кладёт ресурс по адресу, который знает клиент. А id новой записи выдаёт сервер.' }],
      hm: 'создаём новую запись, а её id выдаст сервер. Какой метод для этого?', hp: 'записи живут внутри занятия: коллекция записей занятия. Существительное во множественном числе.', hc: 'создан новый ресурс — какой код говорит «создано» и отдаёт Location?' },
    { id: 'my', t: 'Посмотреть мои предстоящие записи', who: 'клиент',
      v: [{ m: 'GET', re: R('/me/bookings'), c: ['200'], ref: '/me/bookings?status=upcoming' }, { m: 'GET', re: R('/clients/{id}/bookings'), c: ['200'], pts: 0.75, note: 'работает, но id клиента в адресе — приглашение подставить чужой. Это ровно дыра из пентеста. /me берёт клиента из токена.' }, { m: 'GET', re: R('/bookings'), c: ['200'], pts: 0.85, note: 'можно, если сервер всегда фильтрует по владельцу токена. /me/bookings делает это явным.' }],
      hm: 'только читаем.', hp: 'чьи записи? Того, кто вошёл. Как сказать «мои», не показывая id в адресе?', hc: 'отдаём список — обычный успех.' },
    { id: 'cancel', t: 'Отменить запись', who: 'клиент; позже чем за 2 часа — это прогул',
      v: [{ m: 'POST', re: R('/bookings/{id}/cancellations?'), c: ['201', '200'], ref: '/bookings/{bookingId}/cancellation' }, { m: 'DELETE', re: R('/bookings/{id}'), c: ['204', '200'], pts: 0.85, note: 'DELETE работает, но ответ 204 без тела — клиент не узнает, засчитан ли прогул. И запись исчезает, хотя нужна для истории.' }, { m: 'PATCH', re: R('/bookings/{id}'), c: ['200'], pts: 0.85, note: 'PATCH со статусом cancelled работает, но серверу придётся проверять, какие переходы статуса разрешены, а время отмены и штраф теряются в общем PATCH.' }],
      hm: 'вариантов несколько. Подумайте, что вернуть клиенту: был ли штраф.', hp: 'отмена — это событие со своими данными. Может, это отдельный ресурс внутри записи?', hc: 'если создаёте «отмену» как ресурс — какой код у созданного?' },
    { id: 'attend', t: 'Тренер отмечает пришедших — весь список сразу', who: 'тренер в веб-кабинете, Wi-Fi в зале плохой',
      v: [{ m: 'PUT', re: R('/classes/{id}/attendance'), c: ['200', '204'], ref: '/classes/{classId}/attendance' }],
      traps: [{ m: 'POST', note: 'POST при повторе (тренер нажал «Сохранить» дважды) добавит отметки ещё раз. Весь список целиком — это замена, а замена идемпотентна.' }, { m: 'PATCH', note: 'PATCH — частичное изменение. А тренер присылает список целиком.' }],
      hm: 'тренер присылает список целиком и может нажать дважды. Какой метод заменяет ресурс целиком и безопасен для повтора?', hp: 'посещаемость — одна на занятие. Ресурс-«ведомость» внутри занятия.', hc: 'ведомость заменили — обычный успех.' },
    { id: 'qr', t: 'Получить QR-код для прохода (живёт 30 секунд)', who: 'клиент у турникета',
      v: [{ m: 'POST', re: R('/me/pass-tokens'), c: ['201'], ref: '/me/pass-tokens' }, { m: 'POST', re: /^\/me\/[a-z-]*(token|qr|pass|code)[a-z-]*$/, c: ['201'], pts: 0.9, note: 'смысл верный. В эталоне — /me/pass-tokens: каждый вызов создаёт новый токен прохода.' }],
      traps: [{ m: 'GET', note: 'GET должен быть безопасным: браузер, прокси или CDN вправе вернуть закэшированный ответ — вчерашний QR. А каждый вызов на самом деле создаёт новый токен на 30 секунд.' }],
      hm: 'кажется, что мы «получаем» QR. Но каждый вызов создаёт новый токен. Что тогда с безопасностью и кэшем?', hp: 'это мой токен прохода. Коллекция токенов у «меня».', hc: 'создан новый токен.' },
    { id: 'buy', t: 'Купить абонемент', who: 'клиент; дальше будет оплата',
      v: [{ m: 'POST', re: R('/memberships'), c: ['201'], ref: '/memberships' }, { m: 'POST', re: R('/me/memberships'), c: ['201'], pts: 0.9, note: 'можно. В эталоне POST /memberships, а /me/memberships — для чтения своих.' }],
      hm: 'создаём новый абонемент клиента.', hp: 'ресурс — абонементы (memberships), не тарифы (plans).', hc: 'создан новый ресурс со статусом «ждёт оплаты».' },
    { id: 'freeze', t: 'Заморозить абонемент на 2 недели', who: 'клиент; до 30 дней в год, кусок не меньше 7 дней',
      v: [{ m: 'POST', re: R('/memberships/{id}/freezes'), c: ['201'], ref: '/memberships/{membershipId}/freezes' }, { m: 'PATCH', re: R('/memberships/{id}'), c: ['200'], pts: 0.6, note: 'статус «заморожен» теряет главное: заморозок в году несколько, у каждой свои даты, а будущую можно отменить. Это отдельный ресурс.' }],
      hm: 'появляется новая заморозка со своими датами.', hp: 'заморозок у абонемента может быть несколько. Значит, это коллекция внутри абонемента.', hc: 'создана заморозка.' },
    { id: 'email', t: 'Сменить email в профиле', who: 'клиент; остальные поля не трогаем',
      v: [{ m: 'PATCH', re: R('/me'), c: ['200', '204'], ref: '/me' }, { m: 'PUT', re: R('/me'), c: ['200', '204'], pts: 0.8, note: 'PUT заменяет ресурс целиком: придётся прислать все поля профиля, а забытое поле сотрётся. Для одного поля — PATCH.' }],
      hm: 'меняем одно поле из многих.', hp: 'профиль — это «я», id в адресе не нужен.', hc: 'изменили — обычный успех (или без тела).' },
    { id: 'export', t: 'Директор заказывает выгрузку выручки за месяц', who: 'считается несколько минут',
      v: [{ m: 'POST', re: R('/reports/revenue-exports'), c: ['202'], ref: '/reports/revenue-exports' }, { m: 'POST', re: /^\/(reports\/)?(revenue[-/])?exports$/, c: ['202'], pts: 0.9, note: 'смысл верный. В эталоне — /reports/revenue-exports.' }],
      traps: [{ m: 'GET', note: 'GET будет ждать минуты: прокси оборвёт по таймауту, директор нажмёт ещё раз — и отчёт посчитается дважды. Заказ отчёта — это создание задачи.' }],
      hm: 'мы не читаем готовое, а заказываем работу, которая займёт минуты.', hp: 'ресурс — заказ выгрузки (export) внутри отчётов.', hc: 'работа принята, но ещё не сделана. Какой код говорит «принято, ждите» и даёт адрес для опроса?' }
  ];

  function normPath(raw) {
    let s = String(raw || '').trim();
    s = s.replace(/^[A-Z]+\s+/, '').replace(/^https?:\/\/[^/]+/i, '');
    const q = s.indexOf('?'); const query = q >= 0 ? s.slice(q + 1) : ''; if (q >= 0) s = s.slice(0, q);
    if (s && s[0] !== '/') s = '/' + s;
    s = s.replace(/^\/(api\/)?v\d+(?=\/|$)/i, '');
    s = s.replace(/\{[^}]*\}/g, '{id}').replace(/\/:[A-Za-z_]\w*/g, '/{id}').replace(/\/(\d+|[0-9a-f]{8}-[0-9a-f-]{20,})(?=\/|$)/gi, '/{id}');
    s = s.replace(/\/+$/, '') || '/';
    return { path: s, query };
  }
  const VERB = /^(get|create|add|delete|del|remove|update|edit|cancel|do|make|book|set|list|fetch|save|new|send|generate|mark|check|start|stop|buy|purchase|pay|change|show)(?=[A-Z_-]|$)/;
  const SINGULAR = ['booking', 'class', 'membership', 'club', 'freeze', 'user', 'client', 'trainer', 'report', 'payment', 'export', 'token', 'plan'];
  function lint(raw) {
    const out = [];
    if (!String(raw || '').trim()) return out;
    const { path, query } = normPath(raw);
    const segs = path.split('/').filter(Boolean);
    segs.forEach(sg => { if (sg !== '{id}' && VERB.test(sg.charAt(0).toLowerCase() + sg.slice(1))) out.push(`«${esc(sg)}» — глагол в пути. Действие задаёт метод HTTP, а путь называет ресурс.`); });
    if (/[A-Z]/.test(path.replace(/\{id\}/g, ''))) out.push('Заглавные буквы: пути пишут строчными, слова через дефис.');
    if (/_/.test(path)) out.push('Подчёркивание: в адресах принят дефис (membership-plans).');
    if ((path.match(/\{id\}/g) || []).length >= 3 || segs.length > 5) out.push('Глубокая вложенность: больше двух уровней читать и поддерживать тяжело.');
    segs.forEach((sg, i) => { if (segs[i + 1] === '{id}' && SINGULAR.includes(sg)) out.push(`«${esc(sg)}» — коллекцию называют во множественном числе.`); });
    if (/(^|&)(action|op|do|method)=/i.test(query)) out.push('Действие спрятано в параметр запроса. Выразите его методом или ресурсом.');
    if (/\{id\}/.test(segs[0] || '') || /^\/\{id\}/.test(path)) out.push('Путь начинается с id — с чего начинается коллекция?');
    return out;
  }
  // оценка одной строки конструктора — чистая
  function rowScore(st, a) {
    a = a || {};
    const { path } = normPath(a.p);
    let best = { total: 0, raw: 0, v: null, mOk: false, pOk: false, cOk: false };
    st.v.forEach(v => {
      const mOk = a.m === v.m, pOk = !!a.p && v.re.test(path), cOk = v.c.includes(String(a.c || ''));
      const raw = (mOk ? 0.4 : 0) + (pOk ? 0.4 : 0) + (cOk ? 0.2 : 0);
      const total = raw * (v.pts || 1);
      if (total > best.total || (!best.v && raw === 0)) best = { total, raw, v, mOk, pOk, cOk };
    });
    const trap = (st.traps || []).find(t => t.m === a.m);
    return Object.assign(best, { trap });
  }
  function rowNote(st, a, r) {
    if (!a || (!a.m && !a.p && !a.c)) return { ok: false, html: `«${esc(st.t)}» — не заполнено.` };
    if (r.raw === 1 && (r.v.pts || 1) === 1) return null;
    if (r.raw === 1) return { ok: 'warn', html: `«${esc(st.t)}» — засчитано частично: ${r.v.note}` };
    const parts = [];
    if (r.trap) parts.push(r.trap.note);
    else if (!r.mOk) parts.push('Метод: ' + st.hm);
    if (!r.pOk) parts.push('Путь: ' + st.hp);
    if (!r.cOk) parts.push('Код: ' + st.hc);
    return { ok: false, html: `«${esc(st.t)}» — ${parts.join(' ')}` };
  }

  // ---------- подход 3: безопасные и идемпотентные ----------
  const PROPS = [{ id: 'safe', t: 'Безопасный', sub: 'ничего не меняет на сервере' }, { id: 'idem', t: 'Идемпотентный', sub: 'повтор даёт то же состояние' }];
  const TRUTH = { 'GET.safe': true, 'GET.idem': true, 'POST.safe': false, 'POST.idem': false, 'PUT.safe': false, 'PUT.idem': true, 'PATCH.safe': false, 'PATCH.idem': false, 'DELETE.safe': false, 'DELETE.idem': true };
  const CELL_WHY = {
    'GET.safe': 'GET только читает — его можно повторять и кэшировать.',
    'GET.idem': 'Всё безопасное заодно идемпотентно: ничего не меняем — повтор ничего не меняет.',
    'POST.safe': 'POST создаёт или запускает действие — состояние меняется.',
    'POST.idem': 'Каждый POST создаёт новое: три повтора — три платежа. Лечится заголовком Idempotency-Key.',
    'PUT.safe': 'PUT меняет ресурс — это не чтение.',
    'PUT.idem': 'PUT «положи вот это целиком»: второй и третий раз кладём то же самое — состояние не меняется.',
    'PATCH.safe': 'PATCH меняет ресурс.',
    'PATCH.idem': 'Стандарт не гарантирует: «поменяй email» повторять можно, а «добавь в список» или «увеличь счётчик» — нет.',
    'DELETE.safe': 'DELETE меняет состояние — удаляет.',
    'DELETE.idem': 'Удалённое второй раз не удалить: состояние то же, хотя ответ может быть 404.'
  };

  // симулятор «отправить 3 раза»
  const DEMOS = [
    { id: 'post', m: 'POST', path: '/v1/memberships/m-71/payments', what: 'Оплата абонемента 5 400 ₽', key: true },
    { id: 'put', m: 'PUT', path: '/v1/classes/c-42/attendance', what: 'Тренер сохраняет ведомость «Анна, Борис»' },
    { id: 'del', m: 'DELETE', path: '/v1/bookings/b-17', what: 'Клиент отменяет запись' }
  ];
  function demoRun(d, withKey) {
    const lines = [], st = {};
    if (d.id === 'post') {
      let charged = 0, n = 0;
      for (let i = 1; i <= 3; i++) {
        if (withKey) { if (i === 1) { charged += 540000; n = 1; } lines.push([`#${i} POST ${d.path}  Idempotency-Key: 7f3c…`, i === 1 ? '201 Created · платёж pay_1 · ответ потерялся в сети' : '201 Created · pay_1 — сервер узнал ключ и вернул сохранённый ответ', i === 1 ? 'warn' : 'ok']); }
        else { charged += 540000; n++; lines.push([`#${i} POST ${d.path}`, `201 Created · платёж pay_${i}${i < 3 ? ' · ответ потерялся, приложение повторяет' : ''}`, i < 3 ? 'warn' : 'bad']); }
      }
      st.k = 'Списано с карты'; st.v = TR.fmtRub(charged); st.kind = n > 1 ? 'bad' : 'ok';
      st.s = n > 1 ? `${n} платежа вместо одного — скандал` : 'один платёж, как и задумано';
    } else if (d.id === 'put') {
      for (let i = 1; i <= 3; i++) lines.push([`#${i} PUT ${d.path}  ["Анна","Борис"]`, '200 OK · отмечены: Анна, Борис', 'ok']);
      st.k = 'Отмечено в ведомости'; st.v = '2 человека'; st.kind = 'ok'; st.s = 'после первого раза ничего не изменилось';
    } else {
      lines.push([`#1 DELETE ${d.path}`, '204 No Content · запись отменена', 'ok']);
      lines.push([`#2 DELETE ${d.path}`, '404 Not Found · такой записи уже нет', 'warn']);
      lines.push([`#3 DELETE ${d.path}`, '404 Not Found · такой записи уже нет', 'warn']);
      st.k = 'Запись'; st.v = 'отменена 1 раз'; st.kind = 'ok'; st.s = 'ответы разные, состояние одно';
    }
    return { lines, st };
  }

  // ---------- подход 4: дизайн отмены ----------
  const CANCEL_OPTS = [
    { v: 'post', t: 'POST /bookings/{id}/cancellation' },
    { v: 'delete', t: 'DELETE /bookings/{id}' },
    { v: 'patch', t: 'PATCH /bookings/{id} {"status":"cancelled"}' }
  ];
  const CANCEL_RUBRIC = [
    'Отмена — событие со своими данными: время, кто отменил, штраф (позже чем за 2 часа — прогул)',
    'Клиенту нужен ответ с телом: засчитан ли прогул, не заблокирована ли запись на 7 дней',
    'DELETE с 204 теряет эту информацию, а сама запись нужна для истории и подсчёта прогулов',
    'PATCH со статусом заставляет сервер проверять разрешённые переходы, а детали отмены теряются',
    'Повтор отмены (плохая сеть) не должен давать второй штраф — ответ на повтор тот же'
  ];
  const CANCEL_REF = 'Выбираю POST /bookings/{id}/cancellation → 201. Отмена — это не удаление записи, а событие со своими данными: когда отменили, кто, и главное — был ли штраф. По правилу «Пульса» отмена позже чем за 2 часа считается прогулом, а 2 прогула за 30 дней блокируют запись на 7 дней. Клиенту нужно увидеть это в ответе. DELETE вернул бы 204 без тела и «стёр» запись, которая нужна для истории и подсчёта прогулов. PATCH со статусом cancelled работает, но сервер должен проверять допустимые переходы статуса, а время и штраф прячутся в общем изменении. Повтор отмены из-за плохой сети не должен начислить второй прогул: второй вызов возвращает ту же отмену.';

  TR.stage({
    id: 'rest-design', act: 3, order: 90, slot: 'Пн 15:00', title: 'Ресурсы и методы',
    when: 'понедельник, 15:00 · переговорная «Сайкл» · с Денисом на созвоне',
    intro: [
      { who: 'vera', html: 'Утром нарисовали карту. Теперь самая толстая стрелка — приложение и бэкенд. Сегодня вы сами соберёте справочник API: какой ресурс, какой метод, какой код успеха. Не по шаблону, а из историй пользователя.' },
      { who: 'denis', html: '«Только давайте без <code>/api/doAction?type=17</code>, как в прошлом проекте. Хочу по адресу понимать, что происходит».' },
      { who: 'vera', html: 'REST держится на двух идеях. Адрес называет вещь — <i>ресурс</i>. Метод говорит, что с ней сделать. Остальное — следствия.' }
    ],
    facts: ['F-pentest', 'F-qr', 'F-cancel', 'F-reports', 'F-no-loss', 'F-freeze', 'F-double'],
    glossary: [
      { term: 'Ресурс', simple: 'Вещь, о которой можно говорить: занятие, запись, абонемент. Как предмет на полке с ярлыком, а не действие «принеси».', tech: 'Сущность или коллекция, доступная по адресу. Называется существительным во множественном числе: <code>/bookings</code>, <code>/classes/{classId}</code>.' },
      { term: 'URI', simple: 'Адрес вещи — как номер шкафчика в раздевалке: по нему всегда находишь одно и то же.', tech: 'Uniform Resource Identifier. В REST — строчные буквы, слова через дефис, без глаголов; фильтры — в параметрах запроса.' },
      { term: 'Метод HTTP', simple: 'Что сделать с вещью: посмотреть, создать, заменить, поправить, убрать.', tech: '<code>GET</code> — прочитать, <code>POST</code> — создать или запустить, <code>PUT</code> — заменить целиком, <code>PATCH</code> — изменить часть, <code>DELETE</code> — удалить (RFC 9110).' },
      { term: 'Безопасный метод', simple: 'Ничего не меняет — как посмотреть расписание на стенде.', tech: 'Не меняет состояние сервера: <code>GET</code>, <code>HEAD</code>, <code>OPTIONS</code>. Его можно повторять, кэшировать и подгружать заранее.' },
      { term: 'Идемпотентность', simple: 'Повтор не меняет итог — как кнопка вызова лифта: жми сколько угодно, лифт приедет один.', tech: 'Повторный запрос оставляет сервер в том же состоянии: <code>PUT</code>, <code>DELETE</code>, все безопасные. <code>POST</code> и <code>PATCH</code> — не гарантированно.' },
      { term: 'Idempotency-Key', simple: 'Номер квитанции: принесли её второй раз — кассир видит, что уже оплачено, и не берёт деньги снова.', tech: 'Заголовок с уникальным ключом (UUID) на POST. Сервер запоминает ответ по ключу и на повтор возвращает его же (IETF draft «The Idempotency-Key HTTP Header Field»).' },
      { term: 'Код ответа', simple: 'Короткий итог от сервера, как «принято», «нет мест», «приходите позже».', tech: '2xx — успех (<code>200</code>, <code>201 + Location</code>, <code>202</code>, <code>204</code>), 4xx — ошибка клиента, 5xx — ошибка сервера.' }
    ],
    outro: 'Справочник API собран вашими руками. Заметили, как много решают мелочи: QR — это POST, потому что каждый раз создаётся новый токен; ведомость — PUT, потому что тренер жмёт «Сохранить» дважды; отчёт — 202, потому что считается минуты. Завтра — контракт: заголовки, тело, коды ошибок и формат проблем.',
    tasks: [
      {
        id: 'nouns', title: 'Существительные, а не глаголы',
        simple: { icon: '🏷️', plain: 'Адрес называет вещь, а не действие. Действие говорит метод.', analogy: 'На двери раздевалки пишут «Раздевалка», а не «Переодеться». Что делать внутри — понятно и так.', tech: 'Ресурсы — существительные во множественном числе, строчные, через дефис. Иерархия — не глубже двух уровней. Фильтры — в параметрах. Глаголы в пути — признак RPC.' },
        lead: ui.brief({
          situation: `Денис просит: «По адресу хочу понимать, что происходит». В REST адрес называет вещь — <b>ресурс</b>: занятие, запись, абонемент. А что с ней сделать, говорит <b>метод</b>: GET — посмотреть, POST — создать, DELETE — удалить. Пример не из задания: не <code>/deleteClub</code>, а <code>DELETE /clubs/{clubId}</code>.`,
          todo: [
            `Разложите 13 адресов по трём корзинам: «Хороший ресурс», «Допустимо с оговоркой», «Плохо, переделать». Нажмите карточку, потом корзину — или перетащите.`,
            `Проверяйте каждый адрес по признакам: есть ли глагол, заглавные буквы, единственное или множественное число, глубина вложенности, что видно в адресе.`,
            `Нажмите «Проверить». Нужно не меньше 80 %. Где подходят две корзины, засчитаем обе.`
          ],
          lookTitle: `Как читать адреса`,
          look: `Часть в фигурных скобках — место для настоящего номера: <code>/clubs/{clubId}/classes</code> — это, например, занятия клуба «Сокол». Часть после <code>?</code> — фильтры: <code>?date=2026-10-05</code> значит «на 5 октября». После проверки карточки окрасятся: зелёная — верно, жёлтая — допустимо, красная — подумайте ещё.`
        }),
        blank: () => ({ m: {} }),
        reference: () => ({ m: Object.fromEntries(NOUNS.map(i => [i.id, i.ok[0]])) }),
        render(el, ctx) {
          let reveal = null;
          if (ctx.result || ctx.readonly) { reveal = {}; NOUNS.forEach(i => { const v = (ctx.ans.m || {})[i.id]; if (v) reveal[i.id] = i.ok[0] === v ? 'ok' : i.ok.includes(v) ? 'warn' : 'bad'; }); }
          ui.sort(el, { items: NOUNS.map(i => ({ id: i.id, t: i.t })), buckets: NOUN_BUCKETS, value: ctx.ans.m, readonly: ctx.readonly, reveal, seed: 'rd-nouns', onChange: m => ctx.save({ m }) });
        },
        check(ans) {
          let pts = 0; const notes = [];
          NOUNS.forEach(i => {
            const v = (ans.m || {})[i.id], name = i.t.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
            if (!v) { notes.push({ ok: false, html: `<code>${esc(name)}</code> — не разложено.` }); return; }
            if (v === i.ok[0]) pts += 1;
            else if (i.ok.includes(v)) { pts += 0.8; notes.push({ ok: 'warn', html: `<code>${esc(name)}</code> — можно и так. ${i.why}` }); }
            else notes.push({ ok: false, html: `<code>${esc(name)}</code> — ${i.hint}` });
          });
          const score = pts / NOUNS.length;
          return { ok: score >= 0.8, score, summary: `Разложено верно: ${Math.round(score * 100)}%.`, notes: notes.slice(0, 7) };
        },
        explain: `<p>Пять признаков плохого адреса: <b>глагол</b> (<code>/getSchedule</code>, <code>/createBooking</code>), <b>действие в параметре</b> (<code>?action=cancel</code>), <b>заглавные буквы</b>, <b>глубокая вложенность</b> и <b>последовательные номера</b>.</p>
          <p>Последнее — не про красоту. <code>/users/1/bookings/2</code> подсказывает: попробуй 3. Так и нашли дыру на пентесте «Пульса». Наружу отдаём <code>public_id</code> (UUID), а сервер на каждый запрос проверяет владельца.</p>
          <p><code>/bookings/{id}/cancellation</code> — не глагол, а существительное: «отмена» как документ со своими данными. Это законный приём, когда действие порождает что-то новое.</p>`,
        report: ans => NOUNS.map(i => `- ${i.t.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&')} → ${(NOUN_BUCKETS.find(b => b.id === (ans.m || {})[i.id]) || { t: '—' }).t}`).join('\n')
      },
      {
        id: 'builder', title: 'Конструктор эндпоинтов',
        simple: { icon: '🛠️', plain: 'Каждая история пользователя превращается в строку справочника: метод, путь и код успеха.', analogy: 'Как табличка у каждой двери клуба: что за дверью (путь), что там можно делать (метод) и что услышите на выходе (код).', tech: 'Метод выбирают по смыслу: читать — <code>GET</code>, создать новое с id от сервера — <code>POST</code>, заменить целиком — <code>PUT</code>, изменить часть — <code>PATCH</code>, удалить — <code>DELETE</code>. Успех: <code>200</code>, <code>201 + Location</code>, <code>202</code> — принято в работу, <code>204</code> — без тела.' },
        lead: ui.brief({
          situation: `Десять историй пользователя — десять строк будущего справочника API. Каждая строка — три вещи: <b>метод</b> (что делаем), <b>путь</b> (с чем) и <b>код успеха</b> (что ответит сервер, если всё хорошо). Пример не из списка: «посмотреть клубы» — <code>GET /clubs</code> → <code>200</code>.`,
          todo: [
            `В каждой карточке выберите метод в левом списке.`,
            `Впишите путь без <code>/v1</code>. Номера пишите в фигурных скобках: <code>{bookingId}</code>. Фильтры — после знака <code>?</code>.`,
            `Выберите код успеха в правом списке.`,
            `Нажмите «Проверить». Нужно совпадение с эталоном не меньше 80 %: за метод — 40 %, за путь — 40 %, за код — 20 %. Другие разумные пути тоже засчитаем.`
          ],
          lookTitle: `Шпаргалка`,
          look: `<p><b>Методы:</b> GET — посмотреть; POST — создать новое; PUT — заменить целиком; PATCH — поправить часть; DELETE — удалить.<br><b>Коды:</b> <code>200</code> — готово, вот данные; <code>201</code> — создано новое; <code>202</code> — принято, сделаем позже; <code>204</code> — готово, показать нечего.</p><p>Серая подпись под историей — кто это делает и важные условия. Под полем пути работает проверка стиля: сразу подскажет про глагол, заглавные буквы, единственное число. Внизу из ваших ответов собирается справочник API.</p>`
        }),
        blank: () => ({ r: {} }),
        reference: () => ({ r: Object.fromEntries(STORIES.map(s => [s.id, { m: s.v[0].m, p: s.v[0].ref, c: s.v[0].c[0] }])) }),
        render(el, ctx) {
          const r = ctx.ans.r = ctx.ans.r || {};
          const show = ctx.result || ctx.readonly;
          const list = mkEl(el, 'stack tight');
          STORIES.forEach(st => {
            const a = r[st.id] || {};
            const sc = show ? rowScore(st, a) : null;
            const k = sc ? (sc.raw === 1 ? ((sc.v.pts || 1) === 1 ? 'ok' : 'warn') : 'bad') : '';
            const box = mkEl(list, 'rd-story ' + k);
            box.dataset.s = st.id;
            box.innerHTML = `<div class="st">${esc(st.t)}<small>${esc(st.who)}</small></div>
              <div class="rd-in">
                <select data-f="m" aria-label="Метод: ${esc(st.t)}" ${ctx.readonly ? 'disabled' : ''}><option value="">метод</option>${METHODS.map(m => `<option ${a.m === m ? 'selected' : ''}>${m}</option>`).join('')}</select>
                <input type="text" data-f="p" spellcheck="false" autocomplete="off" placeholder="/путь/{id}/…" aria-label="Путь: ${esc(st.t)}" value="${esc(a.p || '')}" ${ctx.readonly ? 'readonly' : ''}>
                <select data-f="c" aria-label="Код успеха: ${esc(st.t)}" ${ctx.readonly ? 'disabled' : ''}><option value="">код</option>${CODES.map(c => `<option ${a.c === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
              </div><div class="rd-lint" data-lint></div>`;
          });
          const tblTitle = mkEl(el); tblTitle.innerHTML = '<div class="eyebrow" style="margin-top:14px">Справочник API · собирается из ваших ответов</div>';
          const tbl = mkEl(el);
          const drawLint = id => {
            const box = TR.$(`[data-s="${id}"] [data-lint]`, list), p = (r[id] || {}).p || '';
            const ls = lint(p);
            box.className = 'rd-lint' + (ls.length ? '' : ' ok');
            box.innerHTML = !p.trim() ? '' : ls.length ? ls.map(x => `<span>⚠ ${x}</span>`).join('') : '<span>Стиль пути без замечаний</span>';
          };
          const drawTable = () => {
            tbl.innerHTML = ui.table(['История', 'Запрос', 'Успех', 'Стиль'], STORIES.map(st => {
              const a = r[st.id] || {}, ls = lint(a.p);
              const p = a.p ? normPath(a.p) : null;
              return [esc(st.t), a.m || a.p ? `${a.m ? ui.mth(a.m) : '<span class="dim">—</span>'} <code>${esc(p ? p.path + (p.query ? '?' + p.query : '') : '…')}</code>` : '<span class="dim">—</span>', a.c ? ui.st(a.c) : '<span class="dim">—</span>', !a.p ? '' : ls.length ? `<span class="chip warn">${ls.length} ${TR.plural(ls.length, 'замечание', 'замечания', 'замечаний')}</span>` : '<span class="chip ok">чисто</span>'];
            }));
          };
          STORIES.forEach(st => drawLint(st.id));
          drawTable();
          if (ctx.readonly) return;
          const upd = (e) => {
            const f = e.target.closest('[data-f]'); if (!f) return;
            const id = f.closest('[data-s]').dataset.s;
            r[id] = Object.assign({}, r[id], { [f.dataset.f]: f.value });
            ctx.save();
            if (f.dataset.f === 'p') drawLint(id);
            f.closest('.rd-story').classList.remove('ok', 'warn', 'bad');
            drawTable();
            if (['qr', 'cancel', 'export'].includes(id)) { const a = r[id]; ctx.decide('Эндпоинт: ' + STORIES.find(s => s.id === id).t, `${a.m || '?'} ${a.p || '?'} → ${a.c || '?'}`); }
          };
          list.addEventListener('input', upd);
          list.addEventListener('change', upd);
        },
        check(ans) {
          const r = ans.r || {};
          let sum = 0; const notes = [];
          STORIES.forEach(st => { const sc = rowScore(st, r[st.id]); sum += sc.total; const n = rowNote(st, r[st.id], sc); if (n) notes.push(n); });
          const style = STORIES.reduce((s, st) => s + lint((r[st.id] || {}).p).length, 0);
          const score = sum / STORIES.length;
          if (style) notes.unshift({ ok: 'warn', html: `Линтер нашёл замечаний по стилю путей: ${style}. Посмотрите подсказки под полями.` });
          return { ok: score >= 0.8, score, summary: `Справочник совпадает с эталоном на ${Math.round(score * 100)}%.`, notes: notes.slice(0, 8), vera: score >= 0.8 ? null : 'Начните с метода: читаем, создаём новое, заменяем целиком, правим часть или удаляем? Путь — существительное, код — что именно получилось.' };
        },
        explain: `<p>Три ловушки, на которых спотыкаются почти все:</p>
          <ul class="checks">
            <li><b>QR — это <code>POST /me/pass-tokens</code>, а не GET.</b> Каждый вызов создаёт новый токен на 30 секунд. GET обязан быть безопасным, его вправе закэшировать браузер или прокси — и у турникета окажется вчерашний QR.</li>
            <li><b>Ведомость — <code>PUT /classes/{classId}/attendance</code>.</b> Тренер присылает список целиком и жмёт «Сохранить» дважды при плохом Wi-Fi. PUT заменяет — повтор ничего не меняет. POST добавил бы отметки ещё раз.</li>
            <li><b>Выгрузка — <code>POST /reports/revenue-exports</code> → <code>202 Accepted</code> + <code>Location</code>.</b> Это номерок в гардеробе: заказ принят, приходите по адресу статуса.</li>
          </ul>
          <p>Обратите внимание на <code>/me/…</code>: клиент берётся из токена, в адресе нет id, который можно подменить. Это прямой ответ на находку пентеста.</p>`,
        refNote: 'Где засчитаны и другие варианты (например, <code>GET /classes?clubId=…&amp;date=…</code> или <code>POST /bookings</code> с classId в теле), проверка подскажет, чем эталон удобнее.',
        report: ans => STORIES.map(st => { const a = (ans.r || {})[st.id] || {}; return `- ${st.t}: ${a.m || '—'} ${a.p || '—'} → ${a.c || '—'}`; }).join('\n')
      },
      {
        id: 'props', title: 'Безопасный, идемпотентный',
        simple: { icon: '🔁', plain: '«Безопасный» — ничего не меняет. «Идемпотентный» — повтор не меняет итог.', analogy: 'Посмотреть расписание на стенде — безопасно. Нажать кнопку лифта пять раз — идемпотентно: приедет один лифт. А купить кофе пять раз — пять кофе и пять списаний.', tech: 'RFC 9110 §9.2: безопасные — <code>GET</code>, <code>HEAD</code>, <code>OPTIONS</code>; идемпотентные — они же плюс <code>PUT</code> и <code>DELETE</code>. Сеть рвётся, приложение повторяет — поэтому это свойство важно на практике.' },
        lead: ui.brief({
          situation: `В метро пропала сеть. Приложение не получило ответ и само отправило запрос ещё раз. Для одних запросов повтор безвреден, для других — нет. <b>Безопасный</b> метод ничего не меняет на сервере: посмотреть расписание. <b>Идемпотентный</b> — повтор не меняет итог: сколько ни жми кнопку лифта, приедет один лифт.`,
          todo: [
            `В таблице отметьте галочками свойства каждого из 5 методов: GET, POST, PUT, PATCH, DELETE.`,
            `Ниже, в симуляторе, нажмите «Отправить 3 раза» в каждой из трёх строк. У оплаты попробуйте и без галочки «с Idempotency-Key», и с ней.`,
            `Нажмите «Проверить». Засчитывается таблица: нужно не меньше 9 верных клеток из 10.`
          ],
          lookTitle: `Как читать симулятор`,
          look: `Симулятор — это плохая сеть: приложение трижды отправляет один и тот же запрос, потому что ответы терялись. Слева журнал: что ушло и что ответил сервер. Справа итог на сервере: сколько списали с карты, сколько человек в ведомости, сколько раз отменена запись. Смотрите на итог, а не на ответы: ответы могут отличаться, а итог должен остаться тем же. <code>Idempotency-Key</code> — номер операции: по нему сервер узнаёт повтор.`
        }),
        blank: () => ({ c: {} }),
        reference: () => ({ c: Object.assign({}, TRUTH) }),
        render(el, ctx) {
          const c = ctx.ans.c = ctx.ans.c || {};
          const show = ctx.result || ctx.readonly;
          const mx = mkEl(el);
          mx.innerHTML = ui.table(['Метод', ...PROPS.map(p => `${p.t}<div class="small dim" style="text-transform:none;letter-spacing:0;font-weight:400">${p.sub}</div>`)], METHODS.map(m => [ui.mth(m), ...PROPS.map(p => `<input type="checkbox" data-c="${m}.${p.id}" aria-label="${m}: ${p.t}" ${c[m + '.' + p.id] ? 'checked' : ''} ${ctx.readonly ? 'disabled' : ''}>`)]));
          TR.$('table', mx).classList.add('rd-mx');
          if (show) TR.$$('[data-c]', mx).forEach(i => { const k = i.dataset.c, ok = !!c[k] === TRUTH[k]; const soft = k === 'PATCH.idem' && c[k]; i.closest('td').classList.add(ok ? 'cell-ok' : soft ? 'cell-hl' : 'cell-bad'); });
          if (!ctx.readonly) mx.addEventListener('change', e => { const i = e.target.closest('[data-c]'); if (!i) return; c[i.dataset.c] = i.checked; ctx.save(); const td = i.closest('td'); td.classList.remove('cell-ok', 'cell-bad', 'cell-hl'); });
          // симулятор
          const sim = mkEl(el, 'card flat');
          sim.style.marginTop = '14px';
          sim.innerHTML = `<div class="eyebrow">Симулятор · плохая сеть, приложение повторяет запрос</div>
            <div class="stack tight">${DEMOS.map(d => `<div class="stack tight" data-d="${d.id}">
              <div class="row between"><div style="min-width:0"><b>${esc(d.what)}</b><div class="small mono" style="overflow-wrap:anywhere">${ui.mth(d.m)} ${esc(d.path)}</div></div>
              <div class="row">${d.key ? '<label class="toggle small"><input type="checkbox" data-key> с Idempotency-Key</label>' : ''}<button type="button" class="btn sm" data-run="${d.id}">Отправить 3 раза</button></div></div>
              <div class="grid2"><div class="rd-log" data-log><span class="dim">Нажмите «Отправить 3 раза»</span></div><div class="stat" data-st><div class="k">Состояние на сервере</div><div class="v">—</div><div class="s">ещё не отправляли</div></div></div></div>`).join('<hr style="border:0;border-top:1px solid var(--border);margin:6px 0">')}</div>`;
          TR.on(sim, 'click', '[data-run]', async (e, b) => {
            const d = DEMOS.find(x => x.id === b.dataset.run), wrap = b.closest('[data-d]');
            const withKey = !!(TR.$('[data-key]', wrap) || {}).checked;
            const res = demoRun(d, withKey), log = TR.$('[data-log]', wrap), stb = TR.$('[data-st]', wrap);
            b.disabled = true; log.innerHTML = '';
            for (const [req, resp, kind] of res.lines) {
              log.insertAdjacentHTML('beforeend', `<div><span class="dim">${esc(req)}</span>\n  → <span class="${kind}">${esc(resp)}</span></div>`);
              await TR.sleep(380);
            }
            stb.innerHTML = `<div class="k">${esc(res.st.k)}</div><div class="v ${res.st.kind}">${esc(res.st.v)}</div><div class="s">${esc(res.st.s)}</div>`;
            b.disabled = false;
            if (d.id === 'post') ctx.decide && ctx.decide('Симулятор POST', withKey ? 'с ключом — одно списание' : 'без ключа — тройное списание');
          });
        },
        check(ans) {
          const c = ans.c || {};
          let pts = 0; const notes = [];
          Object.keys(TRUTH).forEach(k => {
            const v = !!c[k];
            if (v === TRUTH[k]) { pts += 1; return; }
            const [m, p] = k.split('.');
            if (k === 'PATCH.idem') { pts += 0.5; notes.push({ ok: 'warn', html: `PATCH идемпотентный? Иногда да. ${CELL_WHY[k]}` }); return; }
            notes.push({ ok: false, html: `${m} — ${p === 'safe' ? 'безопасный' : 'идемпотентный'}: ${v ? 'отмечено зря' : 'не отмечено'}. ${v ? 'Подумайте, что будет с состоянием сервера.' : 'Что станет с сервером после второго такого же запроса?'}` });
          });
          const score = pts / Object.keys(TRUTH).length;
          return { ok: score >= 0.9, score, summary: `Матрица верна на ${Math.round(score * 100)}%.`, notes };
        },
        explain: `<p>Идемпотентность — про <b>состояние сервера</b>, а не про одинаковый ответ. Второй <code>DELETE</code> вернёт 404, но запись как была отменена один раз, так и осталась.</p>
          <p>POST не идемпотентен, а повторять его приходится: сеть рвётся, ПэйПоинт отвечает по 10 секунд. Поэтому на POST оплаты и записи «Пульс» требует <code>Idempotency-Key</code>. Сервер сохраняет ответ по ключу и на повтор отдаёт тот же <code>201</code> с тем же платежом. В симуляторе видно разницу: 16 200 ₽ против 5 400 ₽.</p>
          <ul class="checks"><li><b>GET</b> — безопасный и идемпотентный.</li><li><b>PUT, DELETE</b> — идемпотентные, но не безопасные.</li><li><b>POST</b> — ни то ни другое, лечится ключом.</li><li class="warn"><b>PATCH</b> — не гарантирован: «смени email» можно повторять, «добавь в список» — нет.</li></ul>`,
        report: ans => METHODS.map(m => `- ${m}: безопасный ${(ans.c || {})[m + '.safe'] ? 'да' : 'нет'}, идемпотентный ${(ans.c || {})[m + '.idem'] ? 'да' : 'нет'}`).join('\n')
      },
      {
        id: 'cancel', title: 'Как отменять запись',
        simple: { icon: '✂️', plain: 'У отмены записи три законных дизайна. Выбор зависит от того, что важно бизнесу.', analogy: 'Можно вычеркнуть клиента из журнала (DELETE), исправить в журнале «отменено» (PATCH) или оформить бланк отмены с датой и отметкой о штрафе (POST отмены). Третий способ оставляет след и даёт квитанцию.', tech: '<code>DELETE /bookings/{id}</code> → 204; <code>PATCH /bookings/{id}</code> со статусом → 200; <code>POST /bookings/{id}/cancellation</code> → 201 с телом. Правило «Пульса»: позже чем за 2 часа — прогул, 2 прогула за 30 дней — блок на 7 дней.' },
        lead: ui.brief({
          situation: `Анна записана на «Сайкл» в 19:00 и хочет отменить запись. Правило «Пульса»: отмена до 17:00 (за 2 часа) — бесплатно, позже — «прогул». Два прогула за 30 дней — запись закрыта на 7 дней. Сделать отмену в API можно тремя способами, и все три встречаются в настоящих системах.`,
          todo: [
            `Выберите один из трёх вариантов вверху.`,
            `В поле ниже своими словами объясните выбор (от 80 символов): что получаем и что теряем с двумя другими вариантами.`,
            `Проверьте ответ с Верой или сверьте с эталоном. Засчитается, если вариант выбран и обоснование принято.`
          ],
          lookTitle: `Что значат варианты`,
          look: `<code>POST /bookings/{id}/cancellation</code> — создать «бланк отмены»: отдельный документ со временем отмены и штрафом. <code>DELETE /bookings/{id}</code> — удалить запись; ответ обычно пустой (<code>204</code>). <code>PATCH /bookings/{id}</code> с телом <code>{"status":"cancelled"}</code> — исправить в записи одно поле — статус. Подумайте, что Анна должна узнать из ответа.`
        }),
        blank: () => ({ v: '', j: {} }),
        reference: () => ({ v: 'post', j: { text: CANCEL_REF, self: CANCEL_RUBRIC.map(() => true) } }),
        render(el, ctx) {
          const top = mkEl(el, 'stack tight'), jt = mkEl(el);
          jt.style.marginTop = '12px';
          top.innerHTML = `<div class="small dim">Ваш выбор:</div>${ui.seg('cv', CANCEL_OPTS.map(o => ({ v: o.v, t: `<span class="mono" style="font-size:12.5px">${esc(o.t)}</span>` })), ctx.ans.v || '', 'accent')}`;
          if (!ctx.readonly) ui.onSeg(top, (n, v) => { ctx.ans.v = v; ctx.save(); ctx.decide('Дизайн отмены записи', CANCEL_OPTS.find(o => o.v === v).t); });
          else TR.$$('button', top).forEach(b => { b.disabled = true; });
          ui.justify(jt, {
            id: 'rd-cancel', q: 'Почему именно так? Что потеряем с двумя другими вариантами?', rubric: CANCEL_RUBRIC, reference: CANCEL_REF,
            value: ctx.ans.j, readonly: ctx.readonly, minLen: 80,
            onChange: j => { ctx.ans.j = j; ctx.save(); ctx.decide('Почему такой дизайн отмены', j.text || ''); }
          });
        },
        check(ans) {
          const js = ui.justifyScore(ans.j);
          const cv = ans.v === 'post' ? 1 : ans.v ? 0.8 : 0;
          const notes = [];
          if (!ans.v) notes.push({ ok: false, html: 'Выберите дизайн отмены.' });
          else if (ans.v === 'delete') notes.push({ ok: 'warn', html: 'DELETE допустим. Но что клиент узнает из ответа 204 без тела — засчитан ли прогул? И где потом считать прогулы, если запись удалена?' });
          else if (ans.v === 'patch') notes.push({ ok: 'warn', html: 'PATCH допустим. Но сервер должен знать, из каких статусов можно перейти в cancelled, а штраф и время отмены прячутся в общем изменении.' });
          else notes.push({ ok: true, html: 'POST отмены — эталон «Пульса»: отмена как документ с телом ответа.' });
          notes.push(js >= 0.6 ? { ok: true, html: 'Обоснование засчитано.' } : { ok: false, html: 'Напишите обоснование (от 80 символов) и проверьте его с Верой или сверьте с эталоном сами.' });
          return { ok: !!ans.v && js >= 0.6, score: cv * 0.3 + js * 0.7, summary: `Выбор: ${Math.round(cv * 100)}%, обоснование: ${Math.round(js * 100)}%.`, notes };
        },
        explain: `<p>Все три дизайна живут в реальных API. Решает бизнес-правило: у «Пульса» отмена порождает последствия — прогул, блокировку. Поэтому отмена — <b>документ</b>: <code>POST /bookings/{bookingId}/cancellation</code> → <code>201</code> и тело:</p>
          ${ui.code('{\n  "bookingId": "9e2d7a10-…",\n  "cancelledAt": "2026-10-05T08:10:00+03:00",\n  [[hl]]"late": true,\n  "penalty": "no_show"[[/]],\n  "bookingBlockedUntil": null\n}', 'json', 'Ответ на отмену позже чем за 2 часа')}
          <p>DELETE хорош, когда удалять действительно нечего помнить (будущая заморозка: <code>DELETE /memberships/{id}/freezes/{freezeId}</code> → 204). PATCH со статусом — когда переходов мало и последствий нет.</p>`,
        report: ans => `Выбор: ${(CANCEL_OPTS.find(o => o.v === ans.v) || { t: '—' }).t}\n\nОбоснование: ${(ans.j && ans.j.text) || '—'}`
      }
    ]
  });
})();
