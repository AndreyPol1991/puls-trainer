/* Неделя 5, пятница 10:00: проектирование событий. Аналитик — автор контракта событий.
   Теория (живая): событие против команды, конверт события, «тонкое» уведомление против события с данными,
   персональные данные, эволюция схемы (Schema Registry, BACKWARD, топик .v2), AsyncAPI.
   Практика: событие BookingCancelled, изменения схемы и стратегия выпуска, AsyncAPI канала puls.booking.events.v1,
   общие соглашения по событиям «Пульса». Канон — _dev/DOMAIN-2.md §4. */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc;
  const SID = 'mq-events';

  if (!document.getElementById('mqe-css')) document.head.insertAdjacentHTML('beforeend', `<style id="mqe-css">
    .mqe-root, .mqe-root .stack, .mqe-root .stack > * { min-width: 0; }
    .mqe-root :not(pre) > code { white-space: normal; overflow-wrap: anywhere; }
    .mqe-root .seg button { white-space: normal; text-align: left; }
    .mqe-sub { font: 600 16px/1.3 var(--f-brand); display: flex; gap: 10px; align-items: baseline; }
    .mqe-sub .l { font: 600 12px/1 var(--f-mono); color: var(--accent); border: 1px solid var(--accent); border-radius: 6px; padding: 3px 6px; }
    .mqe-box { display: grid; gap: 12px; padding: 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); min-width: 0; }
    .mqe-box > * { min-width: 0; }
    .mqe-flow { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 14px; align-items: start; }
    .mqe-flow > * { min-width: 0; }
    .mqe-env { display: grid; gap: 1px; font: 13px/1.5 var(--f-mono); background: var(--code-bg); border: 1px solid var(--border); border-radius: 10px; padding: 8px; overflow-x: auto; }
    .mqe-env button { display: block; width: 100%; text-align: left; border: 1px solid transparent; background: none; border-radius: 6px; padding: 1px 6px; font: inherit; color: var(--text); cursor: pointer; white-space: pre; }
    .mqe-env button:hover { border-color: var(--border-strong); }
    .mqe-env button[aria-pressed="true"] { background: var(--accent-soft); border-color: var(--accent); }
    .mqe-env button.seen:not([aria-pressed="true"]) { border-left-color: var(--ok); }
    .mqe-env .static { padding: 1px 6px; white-space: pre; color: var(--tok-p); }
    .mqe-env .k { color: var(--tok-f); } .mqe-env .s { color: var(--tok-s); } .mqe-env .n { color: var(--tok-n); } .mqe-env .p { color: var(--tok-p); } .mqe-env .c { color: var(--tok-c); font-style: italic; }
    .mqe-cons { display: grid; gap: 6px; }
    .mqe-con { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 8px; align-items: center; border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; background: var(--surface-2); font-size: 13.5px; }
    .mqe-con > * { min-width: 0; }
    .mqe-con .who { font: 600 12.5px/1.3 var(--f-mono); overflow-wrap: anywhere; }
    .mqe-con .what { grid-column: 1 / -1; font-size: 12.5px; color: var(--text-muted); }
    .mqe-con.back { border-color: var(--warn); background: var(--warn-soft); }
    .mqe-con.bad { border-color: var(--bad); background: var(--bad-soft); }
    .mqe-con.ok { border-color: color-mix(in srgb, var(--ok) 50%, transparent); }
    .mqe-con.off { opacity: .45; }
    .mqe-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .mqe-stats .v { font-size: 17px; }
    .mqe-places { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px; }
    .mqe-place { border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; font-size: 12.5px; color: var(--text-muted); background: var(--surface-2); min-width: 0; }
    .mqe-place b { display: block; font-size: 13.5px; color: var(--text); }
    .mqe-place.hot { border-color: var(--bad); background: var(--bad-soft); }
    .mqe-place.hot b::after { content: " · есть ПДн"; color: var(--bad); font-weight: 600; }
    .mqe-range { width: 100%; margin: 4px 0; accent-color: var(--accent); }
    .mqe-inputs { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
    .mqe-inputs .field b { font: 600 14px/1.2 var(--f-mono); color: var(--accent); }
    .mqe-checks { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 6px 10px; }
    .mqe-checks label { display: flex; gap: 8px; align-items: flex-start; font-size: 14px; cursor: pointer; padding: 7px 9px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); min-width: 0; }
    .mqe-checks label > span { min-width: 0; overflow-wrap: anywhere; }
    .mqe-checks label.on { border-color: var(--accent); }
    .mqe-checks label.ok { border-color: var(--ok); background: var(--ok-soft); }
    .mqe-checks label.bad { border-color: var(--bad); background: var(--bad-soft); }
    .mqe-checks label.warn { border-color: var(--warn); background: var(--warn-soft); }
    .mqe-checks input { accent-color: var(--accent); width: 16px; height: 16px; flex: none; margin-top: 2px; }
    .mqe-checks .sub { display: block; font-size: 12px; color: var(--text-muted); }
    .mqe-set { display: grid; grid-template-columns: minmax(0, 190px) minmax(0, 1fr); gap: 10px 14px; align-items: center; }
    .mqe-set > .lbl { font-size: 13.5px; color: var(--text-2); min-width: 0; }
    .mqe-set > .seg { justify-self: start; max-width: 100%; }
    .mqe-yaml { display: grid; gap: 2px; font: 12.5px/1.5 var(--f-mono); background: var(--code-bg); border: 1px solid var(--border); border-radius: 10px; padding: 8px; overflow-x: auto; }
    .mqe-yaml button { display: block; width: 100%; text-align: left; border: 1px solid transparent; border-left: 3px solid var(--border-strong); background: none; border-radius: 6px; padding: 3px 8px; font: inherit; color: var(--text); cursor: pointer; white-space: pre; }
    .mqe-yaml button:hover { border-color: var(--border-strong); }
    .mqe-yaml button[aria-pressed="true"] { background: var(--accent-soft); border-color: var(--accent); }
    .mqe-yaml .k { color: var(--tok-f); } .mqe-yaml .c { color: var(--tok-c); font-style: italic; }
    .mqe-yaml .static { padding: 3px 8px; white-space: pre; color: var(--text-2); }
    .mqe-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .mqe-run td:first-child { min-width: 150px; }
    @media (max-width: 720px) {
      .mqe-flow { grid-template-columns: minmax(0, 1fr); }
      .mqe-set { grid-template-columns: minmax(0, 1fr); gap: 4px; }
      .mqe-set > .lbl { margin-top: 8px; }
      .mqe-stats { grid-template-columns: minmax(0, 1fr); }
    }
  </style>`);

  // ---------- общие помощники ----------
  const mount = (el, cls) => { const d = document.createElement('div'); if (cls) d.className = cls; el.appendChild(d); return d; };
  const lock = (el, ro) => { if (ro) TR.$$('[data-seg] button, input, select', el).forEach(b => { b.disabled = true; }); };
  const L = (id, t, sub) => ({ id, t, sub });
  const tOf = (list, v) => { const x = list.find(o => o.v === v); return x ? String(x.t).replace(/<[^>]+>/g, '') : '—'; };
  const quizRef = QS => QS.map(q => [q.options.findIndex(o => o.ok)]);
  const yk = s => esc(s).replace(/^(\s*-?\s*)([\w.$-]+)(:)/gm, '$1<span class="k">$2</span>$3');

  // =====================================================================
  // Теория 1. Событие, конверт и начинка
  // =====================================================================
  const EC = [
    { id: 'bc', t: '<code>BookingCreated</code>', sub: 'клиент записался на занятие', b: 'ev', why: 'Факт в прошедшем времени: запись уже есть, отменить «событие» нельзя. «Запись» не знает, кто его прочитает: шесть потребителей подписались сами.' },
    { id: 'sp', t: '<code>SendPush</code>', sub: '«отправь Анне пуш»', b: 'cmd', why: 'Повелительное наклонение и один исполнитель — «Уведомления». Это команда, задача. У «Пульса» такие живут в очереди RabbitMQ: её берёт один обработчик и подтверждает.' },
    { id: 'ps', t: '<code>PaymentSucceeded</code>', sub: 'оплата прошла', b: 'ev', why: 'Уже случилось: деньги списаны. Абонементы, выгрузка в 1С и аналитика решают сами, что с этим делать.' },
    { id: 'cc', t: '<code>ChargeCard</code>', sub: '«спиши 5 400 ₽ с карты»', b: 'cmd', why: 'Просьба к конкретному исполнителю, и ответ нужен сразу: прошло списание или нет. Это синхронная команда — REST-вызов в ПэйПоинт, а не событие в журнал.' },
    { id: 'mf', t: '<code>MembershipFrozen</code>', sub: 'абонемент заморожен', b: 'ev', why: 'Факт: заморозка оформлена. Турникетам, уведомлениям и аналитике это интересно — каждому по-своему.' },
    { id: 'ab', t: '<code>AccrueBonus</code>', sub: '«начисли 10 бонусов»', b: 'cmd', why: 'Команда. Если «Доступ» приказывает бонусам «начисли 10», он знает их правила. Правильнее — событие <code>VisitRecorded</code>, а «Бонусы» сами решают, сколько начислить.' },
    { id: 'vr', t: '<code>VisitRecorded</code>', sub: 'клиент прошёл в клуб', b: 'ev', why: 'Факт от турникета. Бонусы начисляют +10, партнёрский шлюз сообщает ФитПассу, аналитика считает загрузку.' },
    { id: 'ex', t: '<code>ExportPaymentTo1C</code>', sub: '«выгрузи оплату в 1С»', b: 'cmd', why: 'Задача для одного исполнителя. Обычно её порождает обработчик события <code>PaymentSucceeded</code>: событие — «что случилось», команда — «что теперь сделать».' }
  ];
  const EC_B = [{ id: 'ev', t: 'Событие', sub: 'факт: уже случилось, адресата нет' }, { id: 'cmd', t: 'Команда', sub: 'просьба «сделай», есть исполнитель' }];

  function drawEC(box) {
    box.innerHTML = '<div data-s></div><div data-w></div>';
    const sbox = TR.$('[data-s]', box), wbox = TR.$('[data-w]', box);
    let prev = {}; const reveal = {};
    const ctl = ui.sort(sbox, {
      items: EC.map(x => ({ id: x.id, t: x.t, sub: x.sub })), buckets: EC_B, value: {}, seed: 'mqe-ec',
      onChange(v) {
        const moved = Object.keys(v).find(k => v[k] !== prev[k]);
        prev = Object.assign({}, v);
        Object.keys(reveal).forEach(k => delete reveal[k]);
        Object.entries(v).forEach(([k, b]) => { const it = EC.find(x => x.id === k); reveal[k] = it.b === b ? 'ok' : 'bad'; });
        ctl.redraw(reveal);
        const good = Object.values(reveal).filter(x => x === 'ok').length, placed = Object.keys(v).length;
        let h = '';
        if (moved) { const it = EC.find(x => x.id === moved), ok = it.b === v[moved]; h += ui.note(ok ? 'ok' : 'bad', ok ? 'Верно' : 'Посмотрите ещё раз', `${it.t} — ${it.why}`); }
        h += `<p class="small dim">Разложено верно: <b>${good}</b> из ${EC.length}${placed > good ? ` · ошибок: ${placed - good} — красные карточки можно перетащить заново` : ''}.</p>`;
        if (good === EC.length) h += ui.note('ok', 'Все восемь на местах', `<b>Как отличить на слух:</b> событие — прошедшее время («записался», «оплачено»), у него нет адресата, и его нельзя «отклонить» — оно уже случилось. Команда — повелительное наклонение («отправь», «спиши»), у неё один исполнитель, и он может отказать.<br><b>Где живут у «Пульса»:</b> события — в журнале Kafka (читают все, кому интересно, можно перечитать за 7 дней); задачи — в очереди RabbitMQ (берёт один обработчик); команды с ответом «прямо сейчас» — синхронный REST.`);
        wbox.innerHTML = h;
      }
    });
    wbox.innerHTML = '<p class="small dim">Перетащите карточку в корзину (или нажмите на карточку, потом на корзину) — реакция сразу.</p>';
  }

  const ENV = [
    { k: 'eventId', v: '"1d0b7c4e-2f3a-4b5c-8d9e-0a1b2c3d4e5f"', c: 's', t: 'Номер события', why: 'Уникальный номер (UUID), как номер чека. Потребитель записывает его в свою таблицу <code>processed_event(consumer, event_id)</code> и второй раз то же событие не обрабатывает.', miss: 'Kafka у «Пульса» доставляет «хотя бы один раз» — дубли бывают, например после перебалансировки потребителей. Без номера дубль не отличить от нового события: Анне придёт два пуша (инцидент 1 сезона).' },
    { k: 'type', v: '"MembershipFrozen"', c: 's', t: 'Тип события', why: 'Что случилось — в прошедшем времени. В одном топике живут несколько типов: <code>MembershipActivated</code>, <code>MembershipFrozen</code>… Потребитель смотрит на тип и решает, нужно ли ему это событие.', miss: 'Потребителю пришлось бы угадывать смысл по набору полей. Новый тип в топике сломал бы всех, кто «угадывает».' },
    { k: 'version', v: '1', c: 'n', t: 'Версия схемы', why: 'Номер версии схемы для блока <code>data</code>. По нему потребитель знает, какой формат ждать, а реестр схем — с чем сравнивать изменения.', miss: 'Нельзя спокойно развивать формат: старый и новый вид события неотличимы.' },
    { k: 'occurredAt', v: '"2026-10-02T11:15:40.512+03:00"', c: 's', t: 'Когда случилось', why: 'Момент в реальном мире, а не время отправки или чтения. Всегда со смещением часового пояса: у «Пульса» клубы в Москве, Екатеринбурге (+2 ч), скоро в Новосибирске (+4 ч) и Владивостоке (+7 ч).', miss: '«11:15» — чьи? Без смещения аналитика сдвинет время на часы, а правило «отмена за 2 часа» посчитается неверно. И нельзя упорядочить события, если они пришли не по порядку.' },
    { k: 'producer', v: '"membership"', c: 's', t: 'Кто опубликовал', why: 'Модуль-владелец данных. Только он пишет в свой топик. К нему идут с вопросами по смыслу полей.', miss: 'Непонятно, кто отвечает за событие, когда в нём ошибка. Сергей в 3 часа ночи будет искать владельца по чату.' },
    { k: 'key', v: '"c-77…"', c: 's', t: 'Ключ партиции', why: 'По ключу Kafka выбирает партицию: события с одним ключом лежат в одной партиции по порядку. В топике абонементов ключ — <code>client_id</code>: все события одного клиента читаются в том порядке, в котором случились.', miss: 'События одного клиента разлетятся по партициям: «разморозили» можно прочитать раньше, чем «заморозили». Так у «Пульса» уже был инцидент — только в топике записей.' },
    { k: 'traceId', v: '"a1b2c3d4e5f60718"', c: 's', t: 'Сквозной номер запроса', why: 'Один номер от нажатия кнопки в приложении через ядро, Kafka и сервисы. Сергей вставляет его в поиск трассировок и видит всю цепочку.', miss: 'Пуш не пришёл — и непонятно, где потерялось: в ядре, в брокере или в «Уведомлениях». Разбор по логам трёх систем вручную.' },
    { k: 'data', v: null, c: '', t: 'Начинка', why: 'То, что случилось, в цифрах: какой абонемент, с какого по какое число заморозка, какая новая дата окончания. Ровно столько, сколько нужно большинству потребителей.', miss: 'Без начинки событие становится «тонким уведомлением»: каждый потребитель пойдёт в ядро за подробностями. Это следующий блок, «В».' }
  ];
  const ENV_DATA = ['{', '    "membershipId": "m-5521…",', '    "clientId": "c-77…",', '    "freezeFrom": "2026-10-03",', '    "freezeTo": "2026-10-16",', '    "newEndDate": "2027-03-15"', '  }'];
  function envLine(f, i) {
    const val = f.k === 'data'
      ? ENV_DATA.map((ln, j) => j === 0 || j === ENV_DATA.length - 1 ? `<span class="p">${esc(ln)}</span>` : esc(ln).replace(/^(\s*)("[^"]+")(: )(.*?)(,?)$/, '$1<span class="k">$2</span><span class="p">$3</span><span class="s">$4</span><span class="p">$5</span>')).join('\n')
      : `<span class="${f.c}">${esc(f.v)}</span>`;
    return `<button type="button" data-env="${f.k}" aria-pressed="false">  <span class="k">"${f.k}"</span><span class="p">: </span>${val}${i < ENV.length - 1 ? '<span class="p">,</span>' : ''}</button>`;
  }
  function drawEnvelope(box) {
    const seen = new Set();
    box.innerHTML = `<div class="mqe-flow"><div class="stack tight"><div class="code-cap">событие из топика puls.membership.events.v1 — нажимайте на строки</div><div class="mqe-env" role="group" aria-label="Конверт события">
      <div class="static">{</div>${ENV.map(envLine).join('')}<div class="static">}</div></div></div>
      <div class="stack tight"><div data-env-out></div><div class="small dim" data-env-n></div></div></div>`;
    const out = TR.$('[data-env-out]', box), n = TR.$('[data-env-n]', box);
    const show = k => {
      const f = ENV.find(x => x.k === k); seen.add(k);
      TR.$$('[data-env]', box).forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.env === k)); b.classList.toggle('seen', seen.has(b.dataset.env)); });
      out.innerHTML = `<div class="card flat"><div class="eyebrow">${esc(f.k)}</div><h4>${esc(f.t)}</h4><p>${f.why}</p>${ui.note('bad', 'Если поля нет', f.miss)}</div>`;
      n.innerHTML = seen.size < ENV.length ? `Посмотрено ${seen.size} из ${ENV.length} строк конверта.` : 'Все строки разобраны. Семь полей вокруг <code>data</code> одинаковы для всех событий «Пульса» — их формат фиксируют один раз в общих соглашениях.';
    };
    TR.on(box, 'click', '[data-env]', (e, b) => show(b.dataset.env));
    out.innerHTML = ui.note('', 'Конверт', 'Событие — как письмо: внутри содержимое (<code>data</code>), снаружи на конверте — номер, тип, дата, отправитель. Нажмите на любую строку слева: что это и что сломается, если её не будет.');
    n.textContent = `Посмотрено 0 из ${ENV.length}.`;
  }

  const PM = [{ v: 'thin', t: 'Тонкое: только id' }, { v: 'enough', t: 'С данными: сколько нужно' }, { v: 'full', t: 'Вся строка таблицы' }];
  const PM_JSON = {
    thin: '{\n  "type": "MembershipActivated",\n  "data": {\n    "membershipId": "m-5521…"\n  }\n}',
    enough: '{\n  "type": "MembershipActivated",\n  "data": {\n    "membershipId": "m-5521…",\n    "clientId": "c-77…",\n    "planId": "net-12m",\n    "access": "network",\n    "startsOn": "2026-10-05",\n    "endsOn": "2027-10-04",\n    "pricePaidKop": 5400000\n  }\n}',
    full: '{\n  "type": "MembershipActivated",\n  "data": {\n    "membershipId": "m-5521…",\n    ...ещё 14 колонок таблицы membership...,\n    "plan": { ...все 11 колонок вида абонемента... },\n    "client": {\n      [[bad]]"fullName": "Анна Смирнова",[[/]]\n      [[bad]]"phone": "+79161112233",[[/]]\n      [[bad]]"birthDate": "1994-03-12"[[/]]\n    },\n    "freezes": [ ...история заморозок... ]\n  }\n}'
  };
  const PM_CONS = [
    { id: 'notifications', what: 'пуш «Абонемент активен до 4 октября»' },
    { id: 'access-allowlist', what: 'список пропусков для турникетов: доступ и срок' },
    { id: 'analytics', what: 'продажи по видам абонементов' },
    { id: 'onec-export', what: 'выгрузка в 1С: сумма и дата' },
    { id: 'bonus', what: 'план: бонусы за покупку годового' },
    { id: 'partner-gateway', what: 'план: партнёрам — статус клиента' }
  ];
  function drawPayload(box) {
    let mode = 'thin', n = 4, rate = 100;
    box.innerHTML = `<div class="stack">
      <div class="row"><span class="small dim">Что кладём в <code>data</code>:</span>${ui.seg('pm', PM, mode, 'accent')}</div>
      <div class="mqe-inputs">
        <label class="field"><span>Потребителей подписано на топик: <b data-o="n"></b></span><input type="range" class="mqe-range" min="1" max="6" step="1" value="${n}" data-r="n" aria-label="Потребителей"></label>
        <label class="field"><span>Событий в секунду в пик: <b data-o="rate"></b></span><input type="range" class="mqe-range" min="10" max="400" step="10" value="${rate}" data-r="rate" aria-label="Событий в секунду"></label>
      </div>
      <div class="mqe-flow"><div data-json></div><div class="stack tight"><div class="eyebrow">Потребители топика</div><div class="mqe-cons" data-cons></div></div></div>
      <div class="mqe-stats" data-stats></div>
      <div data-pnote></div></div>`;
    function draw() {
      TR.$('[data-o="n"]', box).textContent = n;
      TR.$('[data-o="rate"]', box).textContent = rate;
      TR.$('[data-json]', box).innerHTML = ui.code(PM_JSON[mode], 'json', 'событие в топике puls.membership.events.v1 (конверт сокращён)');
      TR.$('[data-cons]', box).innerHTML = PM_CONS.map((c, i) => {
        const on = i < n, cls = !on ? 'off' : mode === 'thin' ? 'back' : mode === 'full' ? 'bad' : 'ok';
        const right = !on ? '<span class="small dim">не подписан</span>' : mode === 'thin' ? `<span class="small">↩ <code>GET /v1/memberships/m-5521</code></span>` : mode === 'full' ? '<span class="small">хватает, но лишнее</span>' : '<span class="small">✓ хватает</span>';
        return `<div class="mqe-con ${cls}"><span class="who">${esc(c.id)}</span>${right}<span class="what">${esc(c.what)}</span></div>`;
      }).join('');
      const back = mode === 'thin' ? n * rate : 0, size = { thin: 0.3, enough: 0.6, full: 2.6 }[mode];
      TR.$('[data-stats]', box).innerHTML = `
        <div class="stat"><div class="k">запросов обратно в ядро</div><div class="v ${back ? (back > 400 ? 'bad' : 'warn') : 'ok'}">${back.toLocaleString('ru-RU')} / с</div><div class="s">${back ? `${n} потребител${n === 1 ? 'ь' : n < 5 ? 'я' : 'ей'} × ${rate} событий` : 'потребителям хватает того, что в событии'}</div></div>
        <div class="stat"><div class="k">размер события</div><div class="v ${mode === 'full' ? 'warn' : ''}">≈ ${String(size).replace('.', ',')} КБ</div><div class="s">${(size * rate).toFixed(0)} КБ/с в топик</div></div>
        <div class="stat"><div class="k">ядро лежит 5 минут</div><div class="v ${mode === 'thin' ? 'bad' : 'ok'}">${mode === 'thin' ? 'стоят все' : 'работают'}</div><div class="s">${mode === 'thin' ? 'каждому нужен ответ ядра' : 'данные уже в событии'}</div></div>`;
      const notes = {
        thin: ui.note('warn', 'Тонкое уведомление', 'Событие говорит только «что-то случилось с абонементом m-5521, подробности у меня». Каждый потребитель идёт в ядро за данными — нагрузка растёт с каждым новым потребителем, и брокер больше не развязывает системы: ядро лежит — стоят все. Ещё и гонка: пока потребитель шёл за данными, абонемент могли уже заморозить, и он прочитает не то состояние, о котором было событие.'),
        enough: ui.note('ok', 'Событие с данными (event-carried state transfer)', 'Событие несёт то, что нужно большинству потребителей, и фиксирует состояние <b>на момент события</b>. Ядру не звонят, ядро может лежать — потребители работают. Это канон «Пульса»: «достаточно данных, но не вся таблица». Редкому потребителю, которому нужно что-то особенное, можно сходить в API владельца.'),
        full: ui.note('bad', 'Вся строка таблицы', 'В ядро никто не ходит — но какой ценой: в событие уехали ФИО, телефон и дата рождения, а потребители начали зависеть от устройства таблиц ядра. Переименовали колонку в базе — поменялось событие — упали все шесть. Событие — это публичный контракт, а не выгрузка таблицы.')
      };
      TR.$('[data-pnote]', box).innerHTML = notes[mode];
    }
    ui.onSeg(box, (name, v) => { if (name === 'pm') { mode = v; draw(); } });
    box.addEventListener('input', e => { const r = e.target.closest('[data-r]'); if (!r) return; if (r.dataset.r === 'n') n = +r.value; else rate = +r.value; draw(); });
    draw();
  }

  const PII = [{ id: 'phone', t: 'телефон' }, { id: 'name', t: 'ФИО' }, { id: 'email', t: 'email' }, { id: 'birth', t: 'дата рождения' }];
  const PLACES = [
    { t: 'Топик Kafka', s: 'хранится 7 дней, копии на нескольких брокерах' },
    { t: 'Ретрай-топики', s: '…retry.1m и …retry.10m' },
    { t: 'DLQ-топик', s: 'сломанные события ждут разбора' },
    { t: 'Базы 6 потребителей', s: 'inbox, свои таблицы, кэши' },
    { t: 'ClickHouse аналитики', s: 'витрины живут годами' },
    { t: 'Логи потребителей', s: 'при ошибке тело события пишут в лог' }
  ];
  function drawPII(box) {
    const on = new Set(); let asked = false;
    box.innerHTML = `<div class="stack">
      <div class="small muted">Отметьте, какие персональные данные (ПДн) «для удобства» положить в событие <code>MembershipActivated</code>:</div>
      <div class="row" data-pii>${PII.map(p => `<label class="toggle"><input type="checkbox" data-p="${p.id}"> <span>${esc(p.t)}</span></label>`).join('')}</div>
      <div class="mqe-places" data-places></div>
      <div class="row"><button type="button" class="btn sm" data-del>Клиент просит удалить свои данные</button><span class="small dim">правило «Пульса»: по просьбе клиента ПДн удаляем, платежи храним 5 лет</span></div>
      <div data-out></div></div>`;
    function draw() {
      const hot = on.size > 0;
      TR.$('[data-places]', box).innerHTML = `<div class="mqe-place"><b>Модуль «Клиенты»</b>единственный владелец ПДн</div>` + PLACES.map(p => `<div class="mqe-place ${hot ? 'hot' : ''}"><b>${esc(p.t)}</b>${esc(p.s)}</div>`).join('');
      const out = TR.$('[data-out]', box);
      if (!asked) { out.innerHTML = hot ? ui.note('warn', 'Копии разъехались', `${[...on].map(id => PII.find(p => p.id === id).t).join(', ')} — теперь в ${PLACES.length + 1} местах вместо одного. И каждый, у кого есть доступ к топику, видит их.`) : ''; return; }
      out.innerHTML = hot
        ? ui.note('bad', `Чистить ${PLACES.length + 1} мест`, 'Удалить ПДн надо в «Клиентах», в шести базах потребителей, в ClickHouse, в логах… А из журнала Kafka отдельное сообщение не удалить вообще: оно неизменяемо и лежит до конца срока хранения. Закон о персональных данных (152-ФЗ) требует удалить — а вы не можете даже найти все копии.')
        : ui.note('ok', 'Удаляем в одном месте', 'ПДн живут только у владельца — в модуле «Клиенты». В событиях — только <code>clientId</code>: по нему человека не узнать без справочника «Клиентов». Удалили запись клиента — во всех событиях остался обезличенный номер. «Уведомлениям» телефон нужен — они берут его по <code>clientId</code> через API «Клиентов» в момент отправки.');
    }
    box.addEventListener('change', e => { const c = e.target.closest('[data-p]'); if (!c) return; if (c.checked) on.add(c.dataset.p); else on.delete(c.dataset.p); draw(); });
    TR.on(box, 'click', '[data-del]', () => { asked = true; draw(); });
    draw();
  }

  const howEvent = {
    id: 'how-event', covers: ['design-cancel'], title: 'Как это работает: событие, конверт и начинка', free: true, noReset: true,
    simple: {
      icon: '📣', plain: 'Событие — это объявление «вот что уже случилось». Кто захочет, тот отреагирует. Команда — просьба к конкретному исполнителю «сделай».',
      analogy: 'Объявление на ресепшене «Сайкл в 19:00 отменён» — факт: тренеры, клиенты и уборщица сами решают, что делать. А записка администратору «позвони Анне» — команда: исполнитель один, и он может не успеть.',
      tech: 'Доменное событие — неизменяемый факт в прошедшем времени (<code>BookingCreated</code>) с конвертом: <code>eventId</code>, <code>type</code>, <code>version</code>, <code>occurredAt</code>, <code>producer</code>, <code>key</code>, <code>traceId</code> и <code>data</code>. У «Пульса» события — в Kafka, задачи вида «отправь пуш» — в RabbitMQ.'
    },
    lead: ui.brief({
      situation: 'Сегодня вы — автор контракта событий. Прежде чем проектировать своё событие, разберём чужие: события абонементов из топика <code>puls.membership.events.v1</code>. Их читают четыре потребителя: уведомления, список пропусков для турникетов, аналитика и выгрузка в 1С.',
      todo: [
        '<b>А.</b> Разложите восемь сообщений на «событие» и «команду» — реакция после каждой карточки.',
        '<b>Б.</b> Нажмите на каждую строку конверта события: зачем она и что сломается без неё.',
        '<b>В.</b> Переключите «тонкое» событие, «с данными» и «всю строку таблицы», подвигайте ползунки — смотрите, сколько запросов вернётся в ядро.',
        '<b>Г.</b> Отметьте телефон или ФИО в событии и нажмите «Клиент просит удалить свои данные».'
      ],
      look: 'В блоке «В» жёлтые карточки — потребители, которые пошли в ядро за данными; красные — получили лишнее. Счётчик «запросов обратно в ядро» — главная цифра: чем она больше, тем сильнее брокер перестаёт развязывать системы.'
    }),
    render(el) {
      el.classList.add('mqe-root');
      el.innerHTML = `<div class="stack" style="gap:24px">
        <section class="stack"><div class="mqe-sub"><span class="l">А</span>Событие или команда</div><div data-sec="a"></div></section>
        <section class="stack"><div class="mqe-sub"><span class="l">Б</span>Конверт: что лежит вокруг данных</div><div data-sec="b"></div></section>
        <section class="stack"><div class="mqe-sub"><span class="l">В</span>Сколько данных класть в событие</div><div data-sec="c"></div></section>
        <section class="stack"><div class="mqe-sub"><span class="l">Г</span>Почему в событии нет телефона</div><div data-sec="d"></div></section>
        ${ui.note('', 'Что здесь делает аналитик', 'Аналитик — автор контракта события: какое имя, какие поля и почему, какой ключ, что точно не кладём (ПДн), кто читает. Разработчики реализуют, архитектор следит за общими правилами, а смысл полей и их потребителей знает аналитик.')}
      </div>`;
      drawEC(TR.$('[data-sec="a"]', el));
      drawEnvelope(TR.$('[data-sec="b"]', el));
      drawPayload(TR.$('[data-sec="c"]', el));
      drawPII(TR.$('[data-sec="d"]', el));
    }
  };

  // =====================================================================
  // Теория 2. Схема меняется — потребители живут
  // =====================================================================
  const EV_CH = [
    { v: 'addOpt', t: 'Добавить необязательное поле' },
    { v: 'addReq', t: 'Добавить обязательное поле' },
    { v: 'del', t: 'Удалить поле' },
    { v: 'rename', t: 'Переименовать поле' },
    { v: 'type', t: 'Сменить тип поля' }
  ];
  const EV = {
    addOpt: {
      compat: true, data: '    "clientId": "c-77…",\n    "points": 10,\n    "reason": "visit",\n    "visitId": "v-90…",\n    [[ok]]"expiresAt": "2027-10-05"[[/]]   // новое, необязательное',
      notif: ['ok', 'Начислено 10 бонусов за посещение', 'новое поле просто не читает'], anal: ['ok', 'сумма за день: 20', 'новое поле игнорирует'],
      note: 'Совместимо. Старый потребитель не знает про <code>expiresAt</code> и спокойно его пропускает. Новый потребитель, который ждёт <code>expiresAt</code>, готов к тому, что в старых событиях его нет, — поле ведь необязательное.'
    },
    addReq: {
      compat: false, data: '    "clientId": "c-77…",\n    "points": 10,\n    "reason": "visit",\n    "visitId": "v-90…",\n    [[bad]]"clubId": "club-12"[[/]]   // новое, ОБЯЗАТЕЛЬНОЕ',
      notif: ['ok', 'Начислено 10 бонусов за посещение', 'старый код лишнее поле не замечает'], anal: ['bad', 'ошибка проверки схемы', 'обновился, перечитывает топик за 7 дней — в старых событиях clubId нет'],
      note: 'Ломает — и не тех, кого ждёшь. Старым потребителям лишнее поле не мешает. Падают <b>новые</b>: аналитика обновила схему и перечитывает топик с начала (7 дней хранения), а в старых событиях обязательного <code>clubId</code> нет. BACKWARD как раз проверяет: «новая схема читает все старые события».'
    },
    del: {
      compat: false, data: '    "clientId": "c-77…",\n    "points": 10,\n    [[bad]]// "reason" удалили[[/]]\n    "visitId": "v-90…"',
      notif: ['bad', 'Начислено 10 бонусов undefined', 'код читает data.reason, а его нет'], anal: ['ok', 'сумма за день: 20', 'reason не читает'],
      note: 'Ломает. «Уведомления» строили текст пуша по <code>reason</code> («за посещение», «за друга»). Продюсер решил, что поле никому не нужно, — но он не знает всех своих потребителей. У «Пульса» правило: поля не удаляем; сначала помечаем устаревшими и убираем только в новой версии топика.'
    },
    rename: {
      compat: false, data: '    "clientId": "c-77…",\n    [[bad]]"amount": 10,[[/]]   // было "points"\n    "reason": "visit",\n    "visitId": "v-90…"',
      notif: ['bad', 'Начислено undefined бонусов', 'читает data.points — его больше нет'], anal: ['bad', 'упал: NULL в обязательной колонке', 'отставание растёт, события копятся'],
      note: 'Ломает — это ровно инцидент 6 «Пульса»: после релиза бонусов переименовали поле, и старые потребители упали. Для потребителя переименование = «старое поле удалили + новое добавили». Красивое имя не стоит упавшей аналитики.'
    },
    type: {
      compat: false, data: '    "clientId": "c-77…",\n    [[bad]]"points": "10",[[/]]   // было число, стала строка\n    "reason": "visit",\n    "visitId": "v-90…"',
      notif: ['ok', 'Начислено 10 бонусов за посещение', 'в тексте строка и число выглядят одинаково'], anal: ['bad', 'сумма за день: «1010»', 'тихо врёт: "10" + "10" склеились'],
      note: 'Ломает, причём тихо: уведомления выглядят нормально, а аналитика складывает строки и показывает Ольге 1 010 бонусов вместо 20. Самые опасные поломки — те, что не падают.'
    }
  };
  const EV_LANES = [L('prod', '«Бонусы»', 'продюсер'), L('reg', 'Schema Registry', 'реестр схем'), L('kafka', 'Kafka', '…bonus.events.v1'), L('notif', 'notifications', 'старый код'), L('anal', 'analytics', 'старый код')];
  function evSteps(ch, reg) {
    const c = EV[ch], S = [];
    if (reg === 'on') {
      S.push({ from: 'prod', to: 'reg', t: 'новая схема\nBonusAccrued', note: 'Перед выкаткой сборка «Бонусов» отправляет новую схему в реестр. Это делает конвейер сборки (CI), а не человек — забыть нельзя.' });
      S.push({ from: 'reg', to: 'reg', t: 'сравнить с прошлой:\nBACKWARD', note: 'Реестр сравнивает новую схему с прошлой по правилу совместимости. У «Пульса» — BACKWARD: новая схема должна читать все старые события, и договорились поля не удалять.' });
      if (!c.compat) {
        S.push({ from: 'reg', to: 'prod', t: '409: несовместимо', reply: true, kind: 'bad', note: 'Реестр отказывает: изменение несовместимо. Сборка падает.' });
        S.push({ from: 'prod', to: 'prod', t: 'выкатка остановлена\nдо прода', kind: 'ok', note: 'Плохая новость для разработчика, хорошая для всех остальных: поломка остановлена <b>до</b> продакшена. Потребители даже не узнали. Дальше — делать изменение совместимым или выпускать новую версию топика (ниже).' });
        return S;
      }
      S.push({ from: 'reg', to: 'prod', t: 'ок, схема id 42', reply: true, kind: 'ok', note: 'Изменение совместимо — реестр сохраняет новую версию схемы и выдаёт ей номер.' });
    } else {
      S.push({ from: 'prod', to: 'prod', t: 'выкатка без проверки', kind: c.compat ? '' : 'warn', note: 'Реестра нет: схема живёт в коде и в головах. Совместимость никто не проверяет — узнаем в проде.' });
    }
    S.push({ from: 'prod', to: 'kafka', t: 'BonusAccrued\n(новый формат)', note: 'События нового формата идут в топик.' });
    S.push({ from: 'kafka', to: 'notif', t: 'событие', note: '«Уведомления» читают событие старым кодом.' });
    S.push({ from: 'notif', to: 'notif', t: c.notif[1], kind: c.notif[0], note: `notifications: ${esc(c.notif[2])}.` });
    S.push({ from: 'kafka', to: 'anal', t: 'событие', note: 'Аналитика читает то же событие.' });
    S.push({ from: 'anal', to: 'anal', t: c.anal[1], kind: c.anal[0], note: `analytics: ${esc(c.anal[2])}.` });
    return S;
  }
  const V2_SC = {
    inplace: {
      sum: ['bad', 'Как было в инциденте 6: переименовали в v1 в пятницу вечером — упали все, кто читал старое имя. Откат релиза не помогает: события нового формата уже лежат в журнале 7 дней.'],
      steps: [
        { from: 'prod', to: 'v1', t: 'amount вместо points', kind: 'bad', note: '«Бонусы» переименовали поле прямо в топике v1.' },
        { from: 'v1', to: 'cons', t: 'новый формат', kind: 'bad', note: 'Потребители получают события с незнакомым полем.' },
        { from: 'cons', to: 'cons', t: 'notifications, analytics\nпадают', kind: 'bad', note: 'Два потребителя из трёх упали, отставание растёт. Сергей будит команду бонусов.' }
      ]
    },
    v2: {
      sum: ['ok', 'Ни один потребитель не упал: каждый переехал на v2, когда был готов. Цена — несколько недель двойной публикации и аккуратный учёт, кто где читает. Поэтому .v2 — для действительно ломающих изменений, а не ради красивого имени.'],
      steps: [
        { from: 'prod', to: 'prod', t: 'описать v2 в AsyncAPI', note: 'Аналитик описывает новую версию контракта и список потребителей, которых надо перевести. Договариваются о сроке.' },
        { from: 'prod', to: 'v1', t: 'пишем как раньше', note: 'Старый топик <code>…bonus.events.v1</code> продолжает получать события в старом формате.' },
        { from: 'prod', to: 'v2', t: 'и параллельно в v2', kind: 'accent', note: 'Те же события в новом формате — в новый топик <code>…bonus.events.v2</code>. Удобно через outbox: две строки в той же транзакции.' },
        { from: 'cons', to: 'v2', t: 'notifications → v2', kind: 'ok', note: '«Уведомления» обновили код и переключились на v2. Остальные пока читают v1 — им ничего не грозит.' },
        { from: 'cons', to: 'v2', t: 'analytics → v2', kind: 'ok', note: 'Аналитика переехала на следующей неделе.' },
        { from: 'prod', to: 'prod', t: 'в v1 никто не читает →\nперестаём писать', note: 'По списку групп потребителей видно: у v1 читателей не осталось. Публикацию в v1 выключают.' },
        { from: 'v1', to: 'v1', t: 'через 7 дней удалить', note: 'Ждём срок хранения — вдруг кому-то понадобится перечитать — и удаляем старый топик.' }
      ]
    }
  };
  const V2_LANES = [L('prod', '«Бонусы»', 'продюсер'), L('v1', 'топик v1', 'старый формат'), L('v2', 'топик v2', 'новый формат'), L('cons', 'Потребители', 'notifications, analytics')];

  const howEvolve = {
    id: 'how-evolve', covers: ['evolve'], title: 'Как это работает: схема меняется, потребители живут', free: true, noReset: true,
    simple: {
      icon: '📜', plain: 'Формат события — обещание потребителям. Менять его можно только так, чтобы старые потребители не заметили. Сторож этого обещания — реестр схем.',
      analogy: 'Бланк заявления на заморозку в клубе. Добавить внизу строку «по желанию: причина» — никого не смутит. А если поменять местами «дату начала» и «дату конца» или переименовать графу — администраторы со старой инструкцией заполнят неправильно.',
      tech: '<b>Schema Registry</b> — хранилище версий схем (у «Пульса» JSON Schema) с проверкой совместимости при каждой выкатке. Режим <code>BACKWARD</code>: новая схема должна читать старые события. Поверх «Пульс» договорился: поля только добавляем необязательными; удалять, переименовывать, менять тип и смысл — нельзя. Ломающее изменение — новый топик <code>.v2</code> с параллельной публикацией. Точные правила реестра зависят от формата схем и настроек.'
    },
    lead: ui.brief({
      situation: 'Месяц назад команда «Бонусов» выпустила релиз и переименовала в событии <code>BonusAccrued</code> поле <code>points</code> в <code>amount</code>. Старые потребители упали (инцидент 6). Разберёмся на этом событии, какие изменения безопасны и как выпускать опасные.',
      todo: [
        'Выберите изменение: добавить необязательное, добавить обязательное, удалить, переименовать, сменить тип.',
        'Переключите «Реестр схем: проверка включена / реестра нет» и проиграйте схему.',
        'Внизу сравните два способа выпустить ломающее изменение: «прямо в v1» и «через топик v2».'
      ],
      look: 'Слева — новая версия <code>data</code>: зелёным безопасное, красным опасное. Справа — что увидят два старых потребителя. На схеме: реестр либо пропускает схему, либо останавливает выкатку ещё до прода.'
    }),
    render(el) {
      el.classList.add('mqe-root');
      let ch = 'rename', reg = 'off', v2 = 'inplace';
      el.innerHTML = `<div class="stack" style="gap:20px">
        <div class="mqe-box"><div class="mqe-set">
          <div class="lbl">Что меняем в <code>BonusAccrued</code></div>${ui.seg('ch', EV_CH, ch, 'accent')}
          <div class="lbl">Реестр схем</div>${ui.seg('reg', [{ v: 'on', t: 'проверка BACKWARD включена' }, { v: 'off', t: 'реестра нет' }], reg, 'accent')}
        </div></div>
        <div class="mqe-flow"><div data-schema></div><div class="stack tight"><div class="code-cap">старые потребители читают так</div>${ui.code("// notifications: текст пуша\ntext = 'Начислено ' + e.data.points\n     + ' бонусов ' + REASON[e.data.reason];\n\n// analytics: сумма бонусов за день\ntotal = total + e.data.points;", 'js')}<div class="mqe-stats" style="grid-template-columns:repeat(2,minmax(0,1fr))" data-res></div></div></div>
        <div data-seq></div><div data-note></div>
        <div class="mqe-sub"><span class="l">2</span>Как выпустить ломающее изменение</div>
        <div class="row"><span class="small dim">Способ:</span>${ui.seg('v2', [{ v: 'inplace', t: 'Прямо в v1' }, { v: 'v2', t: 'Через топик v2 рядом с v1' }], v2, 'accent')}</div>
        <div data-seq2></div><div data-sum2></div>
        ${ui.note('', 'Что здесь делает аналитик', 'Аналитик ведёт контракт: знает всех потребителей события (они перечислены в AsyncAPI), оценивает каждое изменение «совместимо или ломает», а для ломающего пишет план перехода на v2 — кто, когда, до какой даты пишем в оба топика.')}
      </div>`;
      const res = TR.$('[data-res]', el);
      const seq = ui.seq(TR.$('[data-seq]', el), { lanes: EV_LANES, steps: evSteps(ch, reg), laneW: 158, title: 'Выкатка новой схемы BonusAccrued', hint: 'Нажмите «Проиграть» или «Шаг →».', onEnd: () => drawRes(true) });
      function drawRes(done) {
        const c = EV[ch], blocked = reg === 'on' && !c.compat;
        const cell = (k, r) => `<div class="stat"><div class="k">${k}</div><div class="v ${!done ? '' : blocked ? 'ok' : r[0]}">${!done ? '…' : blocked ? 'жив' : r[0] === 'ok' ? 'жив' : 'сломан'}</div><div class="s">${!done ? 'проиграйте схему' : blocked ? 'новое до него не дошло' : esc(r[1])}</div></div>`;
        res.innerHTML = cell('notifications', c.notif) + cell('analytics', c.anal);
        TR.$('[data-note]', el).innerHTML = done ? ui.note(c.compat ? 'ok' : blocked ? 'warn' : 'bad', c.compat ? 'Совместимо' : blocked ? 'Несовместимо — реестр остановил' : 'Несовместимо — дошло до прода', c.note) : '';
      }
      function drawSchema() { TR.$('[data-schema]', el).innerHTML = ui.code('"type": "BonusAccrued",\n"version": 1,\n"data": {\n' + EV[ch].data + '\n}', 'json', 'новая версия события'); }
      const seq2 = ui.seq(TR.$('[data-seq2]', el), { lanes: V2_LANES, steps: V2_SC[v2].steps, laneW: 170, title: 'Выпуск ломающего изменения', hint: 'Нажмите «Проиграть».', onEnd: () => { const s = V2_SC[v2].sum; TR.$('[data-sum2]', el).innerHTML = ui.note(s[0], 'Итог', s[1]); } });
      ui.onSeg(el, (name, v) => {
        if (name === 'ch' || name === 'reg') { if (name === 'ch') ch = v; else reg = v; drawSchema(); drawRes(false); seq.set(evSteps(ch, reg), { play: true }); }
        if (name === 'v2') { v2 = v; TR.$('[data-sum2]', el).innerHTML = ''; seq2.set(V2_SC[v2].steps, { play: true }); }
      });
      drawSchema(); drawRes(false);
    }
  };

  // =====================================================================
  // Теория 3. AsyncAPI — паспорт канала
  // =====================================================================
  const AA = [
    { id: 'info', y: 'asyncapi: 3.0.0\ninfo:\n  title: Пульс — события абонементов\n  version: 1.2.0', o: 'openapi: 3.1.0\ninfo:\n  title: Пульс — API абонементов\n  version: 1.2.0', t: 'Шапка документа', h: 'Название и версия описания. Как в OpenAPI. Версию документа меняют при каждом изменении контракта — по ней видно, что описание обновилось.' },
    { id: 'servers', y: 'servers:\n  prod:\n    host: kafka.puls.internal:9091\n    protocol: kafka-secure', o: 'servers:\n  - url: https://api.puls.ru', t: 'Где брокер', h: 'Вместо базового адреса API — адрес брокера и протокол. Потребитель знает, куда подключаться.' },
    { id: 'channels', y: 'channels:\n  membershipEvents:\n    address: puls.membership.events.v1\n    messages:\n      MembershipActivated: { $ref: \'#/components/messages/MembershipActivated\' }\n      MembershipFrozen: { $ref: \'#/components/messages/MembershipFrozen\' }\n    bindings:\n      kafka: { partitions: 12, topicConfiguration: { retention.ms: 604800000 } }', o: 'paths:\n  /v1/memberships/{id}:', t: 'Канал = топик', h: 'В OpenAPI — адреса ресурсов (<code>paths</code>), в AsyncAPI — каналы. <code>address</code> — имя топика. <code>messages</code> — какие типы событий в нём живут. <code>bindings.kafka</code> — особенности Kafka: 12 партиций, хранение 7 дней (604 800 000 мс).' },
    { id: 'operations', y: 'operations:\n  publishMembershipEvents:\n    action: send\n    channel: { $ref: \'#/channels/membershipEvents\' }', o: '    get:\n      operationId: getMembership', t: 'Кто что делает', h: 'Действие приложения с каналом: <code>send</code> — публикует, <code>receive</code> — читает. Этот документ описывает модуль «Абонементы», поэтому <code>send</code>. В OpenAPI на этом месте метод: <code>get</code>, <code>post</code>.' },
    { id: 'messages', y: 'components:\n  messages:\n    MembershipFrozen:\n      contentType: application/json\n      bindings:\n        kafka: { key: { type: string, description: clientId } }\n      payload: { $ref: \'#/components/schemas/MembershipFrozenV1\' }', o: '      responses:\n        "200":\n          content:\n            application/json:\n              schema: { $ref: \'#/components/schemas/Membership\' }', t: 'Сообщение', h: 'Одно сообщение — один тип события: формат, ключ партиции (<code>bindings.kafka.key</code>) и ссылка на схему начинки. В OpenAPI похожую роль играют тело запроса и ответы.' },
    { id: 'schemas', y: '  schemas:\n    MembershipFrozenV1:\n      type: object\n      required: [membershipId, clientId, freezeFrom, freezeTo]\n      properties:\n        membershipId: { type: string }\n        freezeFrom: { type: string, format: date }', o: '  schemas:\n    Membership:\n      type: object\n      required: [id, clientId, status]', t: 'Схема начинки', h: 'Тот же язык JSON Schema, что и в OpenAPI. Эту же схему кладут в реестр схем — описание и проверка не расходятся.' }
  ];
  const howAsync = {
    id: 'how-asyncapi', covers: ['asyncapi', 'conventions'], title: 'Как это работает: AsyncAPI — паспорт канала', free: true, noReset: true,
    simple: {
      icon: '🗂️', plain: 'AsyncAPI — это OpenAPI для событий: один документ, где написано, какой топик, какие в нём события, какие поля и кто публикует.',
      analogy: 'Расписание и правила на двери зала: какие занятия здесь проходят, сколько мест, кто тренер, что взять с собой. Не нужно спрашивать администратора — всё на двери.',
      tech: 'AsyncAPI 3.0: <code>servers</code> (брокер), <code>channels</code> (топик, его сообщения и настройки Kafka в <code>bindings</code>), <code>operations</code> (<code>send</code> / <code>receive</code>), <code>components.messages</code> и <code>components.schemas</code> (JSON Schema). Из описания генерируют документацию и проверяют контракт в тестах.'
    },
    lead: ui.brief({
      situation: 'OpenAPI вы писали на неделе 3: адреса, методы, тела запросов. Для событий есть такой же стандарт — AsyncAPI. Посмотрим на описание топика абонементов <code>puls.membership.events.v1</code> и найдём в нём знакомое.',
      todo: ['Нажимайте на блоки слева — справа подсветится похожая часть OpenAPI и появится пояснение.', 'Пройдите все шесть блоков.'],
      look: 'Слева — AsyncAPI канала событий, справа — для сравнения кусок OpenAPI того же модуля. Подсвеченная пара — одно и то же по смыслу.'
    }),
    render(el) {
      el.classList.add('mqe-root');
      const seen = new Set();
      el.innerHTML = `<div class="stack">
        <div class="mqe-flow">
          <div class="stack tight"><div class="code-cap">AsyncAPI · puls.membership.events.v1</div><div class="mqe-yaml">${AA.map(b => `<button type="button" data-aa="${b.id}" aria-pressed="false">${yk(b.y)}</button>`).join('')}</div></div>
          <div class="stack tight"><div class="code-cap">OpenAPI · тот же модуль, для сравнения</div><div class="mqe-yaml" data-oa>${AA.map(b => `<div class="static" data-o="${b.id}" style="border-left:3px solid transparent">${yk(b.o)}</div>`).join('')}</div><div data-exp></div></div>
        </div>
        <div class="small dim" data-n></div>
        ${ui.note('', 'Что здесь делает аналитик', 'AsyncAPI канала пишет или ревьюит аналитик: это тот же контракт, что OpenAPI, только для событий. По нему новый потребитель (скажем, будущий партнёрский шлюз) подключается без звонков авторам, а реестр схем и тесты проверяют, что код не разошёлся с описанием.')}
      </div>`;
      const show = id => {
        const b = AA.find(x => x.id === id); seen.add(id);
        TR.$$('[data-aa]', el).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.aa === id)));
        TR.$$('[data-o]', el).forEach(x => { const on = x.dataset.o === id; x.style.borderLeftColor = on ? 'var(--accent)' : 'transparent'; x.style.background = on ? 'var(--accent-soft)' : ''; x.style.borderRadius = '6px'; });
        TR.$('[data-exp]', el).innerHTML = `<div class="card flat"><div class="eyebrow">${esc(id)}</div><h4>${esc(b.t)}</h4><p>${b.h}</p></div>`;
        TR.$('[data-n]', el).textContent = seen.size < AA.length ? `Посмотрено ${seen.size} из ${AA.length} блоков.` : 'Все блоки разобраны: канал, сообщения, схемы, кто публикует. Это и есть «паспорт» топика.';
      };
      TR.on(el, 'click', '[data-aa]', (e, b) => show(b.dataset.aa));
      TR.$('[data-exp]', el).innerHTML = ui.note('', 'Подсказка', 'Нажмите на любой блок AsyncAPI слева.');
      TR.$('[data-n]', el).textContent = `Посмотрено 0 из ${AA.length} блоков.`;
    }
  };

  // =====================================================================
  // Практика 1. Событие BookingCancelled
  // =====================================================================
  const NAMES = [
    { v: 'BookingCancelled', t: 'BookingCancelled' },
    { v: 'CancelBooking', t: 'CancelBooking' },
    { v: 'BookingDeleted', t: 'BookingDeleted' },
    { v: 'BookingCancel', t: 'BookingCancel' },
    { v: 'booking.cancelled.event', t: 'booking.cancelled.event' }
  ];
  const FIELDS = [
    { id: 'bookingId', sub: 'какая запись отменена', kind: 'need', ex: '"9e2d7a10-3c4b-4e5f-8a6b-1c2d3e4f5a6b"' },
    { id: 'classId', sub: 'с какого занятия', kind: 'need', ex: '"4b1f0c3e-6a1d-4f0e-9a51-2a7c1e9d1b10"' },
    { id: 'clientId', sub: 'чья запись', kind: 'need', ex: '"c-77…"' },
    { id: 'lateCancel', sub: 'отмена позже чем за 2 часа — прогул', kind: 'need', ex: 'true' },
    { id: 'cancelledAt', sub: 'когда отменили', kind: 'need', ex: null },
    { id: 'startsAt', sub: 'когда начинается занятие', kind: 'opt', ex: '"2026-10-06T19:00:00+03:00"' },
    { id: 'source', sub: 'откуда отменили: app, admin, partner', kind: 'opt', ex: '"app"' },
    { id: 'clientName', sub: 'ФИО — чтобы пуш был «Анна, вы отменили…»', kind: 'trap', ex: '"Анна Смирнова"' },
    { id: 'clientPhone', sub: 'телефон — чтобы SMS ушла сразу', kind: 'trap', ex: '"+79161112233"' },
    { id: 'classSession', sub: 'вся строка занятия: зал, тренер, вместимость, список записанных', kind: 'trap', ex: '{ …34 поля… }' },
    { id: 'membership', sub: 'абонемент клиента: вид, срок, остаток заморозки', kind: 'trap', ex: '{ …12 полей… }' }
  ];
  const NEED = FIELDS.filter(f => f.kind === 'need').map(f => f.id), TRAPS = FIELDS.filter(f => f.kind === 'trap').map(f => f.id);
  const TS = [
    { v: 'offset', t: '2026-10-06T17:30:00+03:00' },
    { v: 'utc', t: '2026-10-06T14:30:00Z' },
    { v: 'local', t: '2026-10-06 17:30' },
    { v: 'date', t: '2026-10-06' }
  ];
  const KEYS = [{ v: 'class', t: 'classId (class_session_id)' }, { v: 'client', t: 'clientId' }, { v: 'booking', t: 'bookingId' }, { v: 'none', t: 'без ключа' }];
  const KEY_EX = { class: '"4b1f0c3e-6a1d-4f0e-9a51-2a7c1e9d1b10"', client: '"c-77…"', booking: '"9e2d7a10-3c4b-4e5f-8a6b-1c2d3e4f5a6b"', none: 'null' };
  const CONS = [
    { id: 'notifications', need: ['clientId', 'classId', 'lateCancel'], nice: 'startsAt', what: 'пуш «Запись отменена» или «Засчитан прогул»' },
    { id: 'waitlist', need: ['bookingId', 'classId'], order: true, what: 'освободилось место — записать первого из листа ожидания' },
    { id: 'analytics', need: ['classId', 'cancelledAt', 'lateCancel'], what: 'отмены и прогулы по занятиям и часам' },
    { id: 'partner-gateway', need: ['bookingId', 'clientId'], nice: 'source', what: 'сказать ФитПассу, что их клиент отменил' },
    { id: 'recommendations', need: ['clientId', 'classId'], what: 'не советовать то, что клиент отменяет' },
    { id: 'bonus', need: [], what: 'отмены не интересны — пропускает этот тип' }
  ];
  function cancelJson(a) {
    const f = a.fields || [], ts = a.ts ? (TS.find(x => x.v === a.ts) || TS[0]).t : '…';
    const lines = FIELDS.filter(x => f.includes(x.id)).map(x => {
      const v = x.id === 'cancelledAt' ? `"${ts}"` : x.ex;
      const ln = `    "${x.id}": ${v}`;
      return x.kind === 'trap' ? `[[bad]]${ln}[[/]]` : ln;
    });
    return `{\n  "eventId": "e5a1…",\n  "type": "${a.name || '…'}",\n  "version": 1,\n  "occurredAt": "${a.ts === 'offset' || !a.ts ? '2026-10-06T17:30:00.204+03:00' : ts}",\n  "producer": "booking",\n  "key": ${a.key ? KEY_EX[a.key] : '…'},\n  "traceId": "9f8e7d6c5b4a3210",\n  "data": {\n${lines.join(',\n') || '    …'}\n  }\n}`;
  }
  function consRows(a) {
    const f = a.fields || [];
    return CONS.map(c => {
      const miss = c.need.filter(x => !f.includes(x));
      let cls = 'ok', right = '✓ хватает';
      if (!c.need.length) { cls = 'off'; right = 'пропускает'; }
      else if (miss.length) { cls = 'back'; right = `↩ в ядро за: ${miss.join(', ')}`; }
      if (c.order && a.key && a.key !== 'class') { cls = 'bad'; right = 'порядок не гарантирован'; }
      if (c.nice && !f.includes(c.nice) && cls === 'ok') right = `✓ хватает (${c.nice} — было бы удобно)`;
      return `<div class="mqe-con ${cls}"><span class="who">${esc(c.id)}</span><span class="small">${esc(right)}</span><span class="what">${esc(c.what)}</span></div>`;
    }).join('');
  }

  const designTask = {
    id: 'design-cancel', title: 'Событие BookingCancelled',
    simple: {
      icon: '✉️', plain: 'Событие — объявление о факте. В нём то, что нужно большинству читателей, и ничего личного.',
      analogy: 'Объявление на ресепшене «Анна (карта 77) отменила сайкл в 19:00, отмена поздняя». Без телефона Анны и без копии всего журнала расписания.',
      tech: 'Имя — прошедшее время. <code>data</code> — идентификаторы и факты момента (event-carried state transfer), без ПДн. Время — ISO 8601 со смещением. Ключ партиции — сущность, внутри которой важен порядок.'
    },
    lead: ui.brief({
      situation: 'Лена: «Делаем отмену записи. Событие уходит в <code>puls.booking.events.v1</code> рядом с <code>BookingCreated</code> и <code>WaitlistPromoted</code>. Читают шесть групп потребителей.» Пример: Анна записана на сайкл во вторник 6 октября в 19:00 и отменяет в 17:30. Правило клуба: бесплатно — не позже чем за 2 часа, позже — прогул.',
      todo: [
        '<b>Имя события</b> — выберите из пяти вариантов.',
        '<b>Поля data</b> — отметьте галочками, что положить в событие. Среди вариантов есть ловушки.',
        '<b>Формат cancelledAt</b> — выберите, как записать время отмены.',
        '<b>Ключ партиции</b> — по какому полю Kafka разложит события по партициям.',
        'Следите за предпросмотром JSON и за списком потребителей справа, потом нажмите «Проверить».'
      ],
      look: 'Справа — шесть групп потребителей топика. Зелёная — ей хватает данных. Жёлтая «↩ в ядро за…» — пойдёт в ядро за недостающим полем. Красная — сломается порядок. Серая — этот тип ей не нужен. Красным в JSON — то, чего в событии быть не должно.'
    }),
    blank: () => ({ name: '', fields: [], ts: '', key: '' }),
    reference: () => ({ name: 'BookingCancelled', fields: ['bookingId', 'classId', 'clientId', 'lateCancel', 'cancelledAt', 'startsAt'], ts: 'offset', key: 'class' }),
    render(el, ctx) {
      el.classList.add('mqe-root');
      const a = ctx.ans; a.fields = a.fields || [];
      const rv = ctx.result ? true : ctx.readonly;
      const fCls = id => { if (!rv) return a.fields.includes(id) ? 'on' : ''; const f = FIELDS.find(x => x.id === id), on = a.fields.includes(id); if (f.kind === 'trap') return on ? 'bad' : ''; if (f.kind === 'need') return on ? 'ok' : 'warn'; return on ? 'on' : ''; };
      el.innerHTML = `<div class="stack">
        <div class="mqe-box"><div class="mqe-set">
          <div class="lbl">Имя события (<code>type</code>)</div>${ui.seg('name', NAMES, a.name, 'accent')}
          <div class="lbl">Формат <code>cancelledAt</code></div>${ui.seg('ts', TS, a.ts, 'accent')}
          <div class="lbl">Ключ партиции (<code>key</code>)</div>${ui.seg('key', KEYS, a.key, 'accent')}
        </div></div>
        <div class="stack tight"><div class="eyebrow">Поля data</div><div class="mqe-checks">${FIELDS.map(f => `<label class="${fCls(f.id)}"><input type="checkbox" data-f="${f.id}" ${a.fields.includes(f.id) ? 'checked' : ''} ${ctx.readonly ? 'disabled' : ''}><span><code>${f.id}</code><span class="sub">${esc(f.sub)}</span></span></label>`).join('')}</div></div>
        <div class="mqe-flow"><div data-json></div><div class="stack tight"><div class="eyebrow">Кому хватит данных</div><div class="mqe-cons" data-cons></div></div></div>
      </div>`;
      lock(TR.$('.mqe-box', el), ctx.readonly);
      const redraw = () => { TR.$('[data-json]', el).innerHTML = ui.code(cancelJson(a), 'json', 'предпросмотр события'); TR.$('[data-cons]', el).innerHTML = consRows(a); };
      const decide = () => ctx.decide('BookingCancelled', `имя ${a.name || '—'}; поля: ${a.fields.join(', ') || '—'}; время: ${tOf(TS, a.ts)}; ключ: ${tOf(KEYS, a.key)}`);
      ui.onSeg(el, (name, v) => { if (ctx.readonly) return; a[name] = v; ctx.save(); decide(); redraw(); });
      el.addEventListener('change', e => {
        const c = e.target.closest('[data-f]'); if (!c || ctx.readonly) return;
        const id = c.dataset.f; a.fields = c.checked ? FIELDS.map(f => f.id).filter(x => x === id || a.fields.includes(x)) : a.fields.filter(x => x !== id);
        c.closest('label').className = c.checked ? 'on' : '';
        ctx.save(); decide(); redraw();
      });
      redraw();
    },
    check(ans) {
      const f = ans.fields || [], notes = []; let pts = 0;
      const nameOk = ans.name === 'BookingCancelled';
      if (nameOk) { pts += 15; notes.push({ ok: true, html: '<code>BookingCancelled</code> — факт в прошедшем времени, в одном стиле с <code>BookingCreated</code>.' }); }
      else if (ans.name === 'booking.cancelled.event') { pts += 7; notes.push({ ok: 'warn', html: 'Смысл верный, но стиль чужой: в топике уже живут <code>BookingCreated</code> и <code>WaitlistPromoted</code>. Разные стили имён в одном топике — путаница в коде потребителей.' }); }
      else if (ans.name === 'CancelBooking') notes.push({ ok: false, html: '«Отмени запись» — это просьба, команда. Событие сообщает о том, что <b>уже</b> случилось. Как звучит этот факт в прошедшем времени?' });
      else if (ans.name === 'BookingDeleted') notes.push({ ok: false, html: 'Запись не удаляется: она остаётся со статусом «отменена», по ней считают прогулы (2 за 30 дней — блокировка). Имя должно говорить, что случилось на самом деле.' });
      else if (ans.name === 'BookingCancel') notes.push({ ok: false, html: '«Отмена записи» — процесс, а не факт. Имена событий у «Пульса» — в прошедшем времени.' });
      else notes.push({ ok: false, html: 'Выберите имя события.' });
      const miss = NEED.filter(x => !f.includes(x));
      pts += (NEED.length - miss.length) * 8;
      if (!miss.length) notes.push({ ok: true, html: 'Все нужные поля на месте: что отменили, с какого занятия, чья запись, поздняя ли отмена и когда.' });
      else {
        if (miss.includes('bookingId') || miss.includes('classId') || miss.includes('clientId')) notes.push({ ok: false, html: `Не хватает идентификаторов: ${miss.filter(x => x.endsWith('Id')).map(x => '<code>' + x + '</code>').join(', ')}. Посмотрите на жёлтых потребителей — кто и за чем пойдёт в ядро?` });
        if (miss.includes('lateCancel')) notes.push({ ok: false, html: 'Нет признака поздней отмены. Правило «за 2 часа» знает только «Запись». Если каждый потребитель будет считать сам, правило окажется в шести местах — а Ольга его однажды поменяет.' });
        if (miss.includes('cancelledAt')) notes.push({ ok: false, html: 'Нет времени отмены. <code>occurredAt</code> в конверте — время события, но аналитике нужно поле в данных, описанное в схеме, а не служебное поле конверта.' });
      }
      const traps = TRAPS.filter(x => f.includes(x));
      if (!traps.length) { pts += 20; notes.push({ ok: true, html: 'Ловушки обошли: ни ПДн, ни чужих таблиц в событии.' }); }
      else {
        pts += Math.max(0, 20 - traps.length * 10);
        if (traps.includes('clientName') || traps.includes('clientPhone')) notes.push({ ok: false, html: 'ФИО и телефон в событии разъедутся по шести потребителям, ретрай-топикам, DLQ и логам, а из журнала Kafka их не удалить. Кому реально нужен телефон и где он может его взять по <code>clientId</code>?' });
        if (traps.includes('classSession')) notes.push({ ok: false, html: 'Вся строка занятия — это выгрузка таблицы, а не факт. Потребители привяжутся к устройству таблицы «Расписания», и любое изменение колонки их сломает.' });
        if (traps.includes('membership')) notes.push({ ok: false, html: 'Абонемент — данные другого контекста («Абонементы»). «Запись» не владелец этих данных и не должна их публиковать: у каждой таблицы один владелец.' });
      }
      if (f.includes('cancelledAt')) {
        if (ans.ts === 'offset') { pts += 10; notes.push({ ok: true, html: 'Время со смещением: видно и момент, и местное время клуба.' }); }
        else if (ans.ts === 'utc') { pts += 8; notes.push({ ok: 'warn', html: 'UTC однозначен — момент не потеряется. Но местное время клуба придётся восстанавливать по справочнику; канон «Пульса» — ISO 8601 со смещением клуба.' }); }
        else if (ans.ts === 'local') notes.push({ ok: false, html: '«17:30» — по какому времени? Клубы в Москве, Екатеринбурге, скоро в Новосибирске и Владивостоке. Аналитика сдвинет отмены на часы.' });
        else if (ans.ts === 'date') notes.push({ ok: false, html: 'Только дата: нельзя понять, была ли отмена поздней и в какой час отменяют чаще всего.' });
        else notes.push({ ok: false, html: 'Выберите формат времени отмены.' });
      }
      const keyOk = ans.key === 'class';
      if (keyOk) { pts += 15; notes.push({ ok: true, html: 'Ключ — занятие: все события одного занятия (запись, отмена, перевод из листа ожидания) идут в одну партицию по порядку.' }); }
      else if (ans.key === 'client') notes.push({ ok: false, html: 'Это инцидент 2 «Пульса»: с ключом <code>clientId</code> события одного занятия от разных клиентов попадают в разные партиции, и лист ожидания может увидеть отмену Анны позже записи Петра. Чей порядок важен листу ожидания?' });
      else if (ans.key === 'booking') { pts += 3; notes.push({ ok: false, html: 'Порядок внутри одной записи будет, но лист ожиданий работает с местами <b>занятия</b>: отмена одной записи и создание другой на то же занятие должны идти по порядку.' }); }
      else notes.push({ ok: false, html: 'Без ключа Kafka раскидает события по партициям как попало — порядок не гарантирован ни для кого.' });
      if (f.includes('startsAt')) notes.push({ ok: 'info', html: '<code>startsAt</code> — необязательно, но удобно: уведомлениям не придётся ходить в расписание за временем занятия.' });
      const score = Math.min(1, pts / 100);
      const ok = nameOk && !miss.length && !traps.length && keyOk && (ans.ts === 'offset' || ans.ts === 'utc');
      return { ok, score, notes, summary: `Нужных полей: ${NEED.length - miss.length} из ${NEED.length} · ловушек в событии: ${traps.length}.`, vera: ok ? null : 'Проверяйте каждое поле двумя вопросами: «кому из шести потребителей это нужно?» и «чьи это данные?». Если ответ «никому» или «не наши» — поле лишнее.' };
    },
    explain: `<p>Эталон:</p>
      ${ui.code('{\n  "eventId": "e5a1…",\n  "type": "BookingCancelled",\n  "version": 1,\n  "occurredAt": "2026-10-06T17:30:00.204+03:00",\n  "producer": "booking",\n  "key": "4b1f0c3e-…",            // classId — порядок внутри занятия\n  "traceId": "9f8e7d6c5b4a3210",\n  "data": {\n    "bookingId": "9e2d7a10-…",\n    "classId": "4b1f0c3e-…",\n    "clientId": "c-77…",\n    "lateCancel": true,           // считает «Запись», а не каждый потребитель\n    "cancelledAt": "2026-10-06T17:30:00+03:00",\n    "startsAt": "2026-10-06T19:00:00+03:00"   // по желанию\n  }\n}', 'json')}
      <ul class="checks">
        <li><b>Почему lateCancel в событии.</b> Правило «за 2 часа» — бизнес-правило «Записи». Флаг считает владелец, потребители только читают. Ольга поменяет правило на 3 часа — поменяется одно место.</li>
        <li><b>Почему без ФИО и телефона.</b> ПДн живут только в «Клиентах». «Уведомления» берут телефон по <code>clientId</code> в момент отправки — и если клиент удалил данные, SMS просто не уйдёт.</li>
        <li><b>Почему ключ — занятие.</b> Лист ожидания решает «кого записать на освободившееся место», ему важен порядок событий <b>одного занятия</b>. Ключ <code>clientId</code> — это инцидент 2.</li>
      </ul>
      <p>Что в проде: потребитель <code>bonus</code> этот тип просто пропускает — поэтому в соглашениях пишут «незнакомые и ненужные типы игнорировать», иначе новый тип в топике уронит старых.</p>`,
    report: ans => `Имя: ${ans.name || '—'}; поля data: ${(ans.fields || []).join(', ') || '—'}; формат cancelledAt: ${tOf(TS, ans.ts)}; ключ партиции: ${tOf(KEYS, ans.key)}.`
  };

  // =====================================================================
  // Практика 2. Совместимо или ломает + стратегия выпуска
  // =====================================================================
  const CH = [
    { id: 'c1', t: 'Добавить в <code>BookingCancelled</code> необязательное поле <code>cancelReason</code>', ok: ['compat'], why: 'Старые потребители незнакомое поле пропускают.' },
    { id: 'c2', t: 'Переименовать <code>clientId</code> в <code>customerId</code> во всех событиях записи', ok: ['break'], why: 'Переименование = удалить старое + добавить новое. Инцидент 6.' },
    { id: 'c3', t: 'Сменить тип <code>lateCancel</code>: <code>true/false</code> → строка <code>"yes"/"no"</code>', ok: ['break'], why: 'Строка <code>"no"</code> в JavaScript — это «истина»: каждая отмена станет поздней.' },
    { id: 'c4', t: 'Удалить из <code>BookingCreated</code> поле <code>source</code> — «вроде никто не читает»', ok: ['break'], why: 'Партнёрский шлюз читает <code>source</code>. Продюсер не знает всех потребителей.' },
    { id: 'c5', t: 'Добавить в <code>BookingCreated</code> обязательное поле <code>clubId</code>', ok: ['break'], why: 'В событиях за последние 7 дней его нет — потребитель с новой схемой упадёт, перечитывая топик.' },
    { id: 'c6', t: 'Начать публиковать в топик новый тип <code>BookingNoShow</code> (неявка)', ok: ['compat'], why: 'Совместимо, если соглашение «незнакомые типы пропускаем» соблюдают все потребители.' },
    { id: 'c7', t: 'Добавить значение <code>"kiosk"</code> в список возможных <code>source</code>', ok: ['compat', 'break'], warn: 1, why: 'Схема совместима, но потребитель со строгим <code>switch</code> упадёт на незнакомом значении. Поэтому в соглашениях: «неизвестные значения перечислений — обрабатывать как прочее».' },
    { id: 'c8', t: 'В <code>classId</code> теперь кладём id направления (йога, сайкл), а не занятия — тип тот же, строка', ok: ['break'], why: 'Реестр не заметит: тип не поменялся. А смысл другой — лист ожидания начнёт искать занятие по id направления. Смысл полей сторожит аналитик, а не реестр.' }
  ];
  const CH_B = [{ id: 'compat', t: 'Совместимо', sub: 'старые потребители не заметят' }, { id: 'break', t: 'Ломает', sub: 'кто-то упадёт или начнёт врать' }];
  const PLAN_ROWS = [
    { id: 'n1', t: '«Бонусам» нужен <code>clubId</code> в <code>BookingCreated</code>', sub: 'за посещение «чужого» клуба — повышенные бонусы' },
    { id: 'n2', t: 'Партнёрский шлюз просит переименовать <code>classId</code> в <code>sessionId</code>', sub: 'так называется поле в API ФитПасса' },
    { id: 'n3', t: 'Аналитике нужно не <code>lateCancel</code>, а «за сколько минут до начала отменили»', sub: 'хотят строить распределение' },
    { id: 'n4', t: 'Поле <code>source</code> в <code>BookingCreated</code> хотят убрать', sub: 'в трёх группах из шести его не читают' }
  ];
  const PLAN_CH = [
    { v: 'opt', t: 'Добавить необязательное поле в v1' },
    { v: 'inplace', t: 'Поменять прямо в v1' },
    { v: 'v2', t: 'Новая версия: топик .v2, писать в оба, перевести потребителей' },
    { v: 'map', t: 'Событие не трогать: перевести имя в шлюзе' },
    { v: 'deprecate', t: 'Пометить устаревшим в AsyncAPI, удалить только в v2' }
  ];
  const PLAN = {
    n1: { opt: ['ok', 'Совместимо: старые потребители поле не заметят, «Бонусы» получат своё. 6 из 6 живы.'], inplace: ['bad', 'Если сделать <code>clubId</code> обязательным в v1 — упадут потребители, перечитывающие топик за 7 дней: в старых событиях поля нет.'], v2: ['warn', 'Сработает, но недели двойной публикации ради одного нового поля — стрельба из пушки по воробьям.'], map: ['bad', 'Шлюз тут ни при чём: поле нужно «Бонусам».'], deprecate: ['bad', 'Помечать устаревшим нечего — поле новое.'] },
    n2: { opt: ['warn', 'Совместимо, но в событии станет два поля с одним смыслом: <code>classId</code> и <code>sessionId</code>. Через год никто не вспомнит, какое главное.'], inplace: ['bad', 'Инцидент 6 заново: упадут пять потребителей, которые читают <code>classId</code>.'], v2: ['warn', 'Сработает, но переводить шесть потребителей ради чужого имени — дорого. Имена своего контракта не подстраивают под каждого партнёра.'], map: ['ok', 'Переименование — забота адаптера. Шлюз читает <code>classId</code> и отдаёт ФитПассу <code>sessionId</code>. Контракт «Пульса» не тронут, 6 из 6 живы.'], deprecate: ['bad', 'Поле <code>classId</code> никто не собирается убирать — его читают пять потребителей.'] },
    n3: { opt: ['ok', 'Добавить <code>minutesBeforeStart</code> рядом, <code>lateCancel</code> не трогать. Аналитика получила своё, остальные живы.'], inplace: ['bad', 'Сменить тип <code>lateCancel</code> с «да/нет» на число — уведомления и лист ожидания упадут или начнут врать.'], v2: ['warn', 'Можно, если хотят заодно убрать <code>lateCancel</code>. Но новому полю переезд не нужен.'], map: ['bad', 'Это не вопрос имени — нужны новые данные.'], deprecate: ['bad', '<code>lateCancel</code> нужен уведомлениям, помечать его устаревшим рано.'] },
    n4: { opt: ['bad', 'Задача — убрать поле, а не добавить.'], inplace: ['bad', 'Три группы не читают, а три — читают (партнёрский шлюз точно). Удаление в v1 уронит их.'], v2: ['warn', 'Сработает, но отдельная v2 ради одного поля дорога. Обычно копят несколько ломающих изменений и делают v2 одну.'], map: ['bad', 'Переименовывать нечего.'], deprecate: ['ok', 'Пометили <code>deprecated</code> в AsyncAPI и в схеме, предупредили потребителей, проверили, кто читает. Удалим, когда соберётся следующая ломающая версия.'] }
  };
  const CH_REF = () => Object.fromEntries(CH.map(c => [c.id, c.ok[0]]));
  const PLAN_REF = () => ({ n1: 'opt', n2: 'map', n3: 'opt', n4: 'deprecate' });

  const evolveTask = {
    id: 'evolve', title: 'Совместимо или ломает',
    simple: {
      icon: '🧩', plain: 'Совместимое изменение старые потребители не замечают. Ломающее — замечают падением или, хуже, тихим враньём.',
      analogy: 'В бланк заявления можно добавить графу «по желанию». Переименовать графу, поменять её смысл или убрать — нельзя, пока у администраторов на руках старая инструкция.',
      tech: 'Совместимо: новое необязательное поле, новый тип события в топике (если потребители пропускают незнакомые). Ломает: удаление, переименование, смена типа, новое обязательное поле, смена смысла. Ломающее выпускают через топик <code>.v2</code> с двойной публикацией.'
    },
    lead: ui.brief({
      situation: 'После инцидента 6 Антон поручил вам ревью всех изменений событий записи. Пришло восемь предложений от разных команд и четыре запроса на доработку. В топике <code>puls.booking.events.v1</code> шесть групп потребителей; режим реестра — BACKWARD; события хранятся 7 дней.',
      todo: [
        '<b>Часть 1.</b> Разложите восемь изменений на «Совместимо» и «Ломает».',
        '<b>Часть 2.</b> Для каждого из четырёх запросов выберите стратегию выпуска в выпадающем списке.',
        'Под таблицей появится «прогон релиза» — что случится с потребителями при выбранной стратегии. Потом «Проверить».'
      ],
      look: '«Прогон релиза» — зелёный: все живы и дёшево; жёлтый: работает, но дорого или неаккуратно; красный: кто-то упадёт. Раскладку в части 1 проверяет кнопка «Проверить».'
    }),
    blank: () => ({ sort: {}, plan: {} }),
    reference: () => ({ sort: CH_REF(), plan: PLAN_REF() }),
    render(el, ctx) {
      el.classList.add('mqe-root');
      const a = ctx.ans; a.sort = a.sort || {}; a.plan = a.plan || {};
      const r = ctx.result;
      const sortReveal = r ? Object.fromEntries(Object.entries(a.sort).map(([k, b]) => { const c = CH.find(x => x.id === k); return [k, !c.ok.includes(b) ? 'bad' : c.warn ? 'warn' : 'ok']; })) : null;
      el.innerHTML = `<div class="stack">
        <div class="eyebrow">Часть 1 · восемь изменений</div><div data-sort></div>
        <div class="eyebrow">Часть 2 · четыре запроса — как выпускать</div><div data-plan></div>
        <div class="stack tight"><div class="eyebrow">Прогон релиза</div><div data-run></div></div>
      </div>`;
      ui.sort(TR.$('[data-sort]', el), {
        items: CH.map(c => ({ id: c.id, t: c.t })), buckets: CH_B, value: a.sort, readonly: ctx.readonly, seed: 'mqe-ch', reveal: sortReveal,
        onChange: v => { a.sort = v; ctx.save(); }
      });
      const run = () => {
        TR.$('[data-run]', el).innerHTML = ui.table(['Запрос', 'Стратегия', 'Что будет'], PLAN_ROWS.map(row => {
          const v = a.plan[row.id];
          if (!v) return [row.t, '<span class="dim">не выбрано</span>', '—'];
          const o = PLAN[row.id][v];
          return [row.t, esc(tOf(PLAN_CH, v)), `<span class="chip ${o[0]}">${o[0] === 'ok' ? 'хорошо' : o[0] === 'warn' ? 'дорого' : 'сломает'}</span> ${o[1]}`];
        }), { rowClass: (x, i) => { const v = a.plan[PLAN_ROWS[i].id]; return v ? PLAN[PLAN_ROWS[i].id][v][0] : ''; } }).replace('class="tbl"', 'class="tbl mqe-run"');
      };
      ui.match(TR.$('[data-plan]', el), {
        rows: PLAN_ROWS, choices: PLAN_CH, value: a.plan, readonly: ctx.readonly, placeholder: 'Стратегия…',
        onChange: v => { a.plan = v; ctx.save(); ctx.decide('Стратегии изменения схемы', PLAN_ROWS.map(x => `${x.id}: ${tOf(PLAN_CH, v[x.id])}`).join('; ')); run(); }
      });
      run();
    },
    check(ans) {
      const s = ans.sort || {}, p = ans.plan || {}, notes = [];
      let sortGood = 0;
      CH.forEach(c => { if (c.ok.includes(s[c.id])) sortGood++; });
      const wrong = CH.filter(c => s[c.id] && !c.ok.includes(s[c.id])), empty = CH.filter(c => !s[c.id]);
      if (sortGood === CH.length) notes.push({ ok: true, html: 'Все восемь изменений оценены верно.' });
      wrong.forEach(c => {
        const hint = { c1: 'Что сделает старый потребитель с полем, о котором не знает?', c2: 'Для старого кода новое имя — это «старое поле пропало». Вспомните инцидент 6.', c3: 'Как потребитель на JavaScript проверит <code>if (e.data.lateCancel)</code>, если там строка <code>"no"</code>?', c4: '«Вроде никто не читает» — а вы проверили все шесть групп? Кто сообщает партнёрам, откуда запись?', c5: 'Подумайте не о старых, а о новых потребителях: они перечитывают топик за 7 дней. Что в старых событиях?', c6: 'Если в соглашениях написано «незнакомые типы пропускаем» — кто упадёт?', c8: 'Тип поля не поменялся — значит, реестр промолчит. А что станет со смыслом?' }[c.id];
        notes.push({ ok: false, html: `${c.t}: ${hint}` });
      });
      if (empty.length) notes.push({ ok: false, html: `Не разложено изменений: ${empty.length}.` });
      if (s.c7) notes.push({ ok: 'info', html: 'Про <code>"kiosk"</code> засчитаны оба ответа: схема совместима, но строгий <code>switch</code> у потребителя упадёт. Лечится соглашением «незнакомые значения — как “прочее”».' });
      let planPts = 0, planBad = 0, planOk = 0;
      PLAN_ROWS.forEach(row => {
        const v = p[row.id];
        if (!v) { planBad++; notes.push({ ok: false, html: `Не выбрана стратегия: ${row.t}.` }); return; }
        const o = PLAN[row.id][v];
        if (o[0] === 'ok') { planPts += 1; planOk++; }
        else if (o[0] === 'warn') { planPts += 0.5; notes.push({ ok: 'warn', html: `${row.t}: ${o[1]}` }); }
        else { planBad++; notes.push({ ok: false, html: `${row.t}: ${o[1]}` }); }
      });
      if (planOk === PLAN_ROWS.length) notes.push({ ok: true, html: 'Стратегии выпуска выбраны самые дешёвые из безопасных.' });
      const score = (sortGood / CH.length) * 0.5 + (planPts / PLAN_ROWS.length) * 0.5;
      const ok = sortGood >= CH.length - 1 && planBad === 0 && planOk >= 3;
      return { ok, score, notes, summary: `Изменения: верно ${sortGood} из ${CH.length} · стратегии: хороших ${planOk} из ${PLAN_ROWS.length}.`, vera: ok ? null : 'Порядок мысли: 1) старый потребитель заметит? 2) если да — можно ли получить то же самое добавлением, а не изменением? 3) только если нельзя — v2.' };
    },
    explain: `${ui.table(['Изменение', 'Вердикт', 'Почему'], CH.map(c => [c.t, c.warn ? 'зависит от потребителя' : c.ok[0] === 'compat' ? 'совместимо' : 'ломает', c.why]))}
      <p><b>Стратегии:</b> <code>clubId</code> и «минуты до начала» — новые необязательные поля в v1; переименование под партнёра — перевод в шлюзе (адаптер), контракт не трогаем; удаление <code>source</code> — пометить <code>deprecated</code> и убрать в следующей v2, когда накопится несколько ломающих изменений.</p>
      <p>Главное: реестр схем ловит структуру (типы, обязательность), но не смысл. Изменение c8 он пропустит. Смысл полей сторожит автор контракта — аналитик.</p>`,
    report: ans => `Раскладка: ${CH.map(c => `${c.id}=${(ans.sort || {})[c.id] === 'compat' ? 'совместимо' : (ans.sort || {})[c.id] === 'break' ? 'ломает' : '—'}`).join(', ')}.\nСтратегии: ${PLAN_ROWS.map(r => `${r.id} — ${tOf(PLAN_CH, (ans.plan || {})[r.id])}`).join('; ')}.`
  };

  // =====================================================================
  // Практика 3. AsyncAPI для puls.booking.events.v1
  // =====================================================================
  const A_ADDR = [{ v: 'v1', t: 'puls.booking.events.v1' }, { v: 'pertype', t: 'puls.booking.cancelled.v1 (свой топик на тип)' }, { v: 'nover', t: 'booking-events' }];
  const A_ACT = [{ v: 'send', t: 'send' }, { v: 'receive', t: 'receive' }];
  const A_MSGS = [
    { id: 'BookingCreated', ok: 1 }, { id: 'BookingCancelled', ok: 1 }, { id: 'WaitlistPromoted', ok: 1 },
    { id: 'SendPush', ok: 0, why: 'команда — в очереди RabbitMQ' }, { id: 'PaymentSucceeded', ok: 0, why: 'живёт в puls.payment.events.v1' }, { id: 'VisitRecorded', ok: 0, why: 'живёт в puls.access.visits.v1' }
  ];
  const A_KEY = [{ v: 'classId', t: 'classId' }, { v: 'clientId', t: 'clientId' }, { v: 'bookingId', t: 'bookingId' }];
  const A_PART = [{ v: '12', t: '12' }, { v: '6', t: '6' }, { v: '1', t: '1' }];
  const A_RET = [{ v: '7d', t: '7 дней' }, { v: 'compact', t: 'сжатие (compact)' }, { v: 'forever', t: 'вечно' }];
  const A_COMP = [{ v: 'BACKWARD', t: 'BACKWARD' }, { v: 'NONE', t: 'NONE (без проверки)' }];
  const A_GROUPS = [
    { id: 'notifications', ok: 1 }, { id: 'bonus', ok: 1 }, { id: 'recommendations', ok: 1 }, { id: 'analytics', ok: 1 }, { id: 'partner-gateway', ok: 1 }, { id: 'waitlist', ok: 1 },
    { id: 'onec-export', ok: 0, why: 'читает платежи и абонементы' }, { id: 'access-allowlist', ok: 0, why: 'читает абонементы и сжатый топик пропусков' }
  ];
  const DEF_FIELDS = ['bookingId', 'classId', 'clientId', 'lateCancel', 'cancelledAt'];
  function asyncYaml(a, cancelFields) {
    const addr = a.addr === 'pertype' ? 'puls.booking.cancelled.v1' : a.addr === 'nover' ? 'booking-events' : a.addr === 'v1' ? 'puls.booking.events.v1' : '…';
    const msgs = (a.msgs || []).length ? a.msgs : [];
    const ret = { '7d': '{ cleanup.policy: delete, retention.ms: 604800000 }   # 7 дней', compact: '{ cleanup.policy: compact }', forever: '{ retention.ms: -1 }   # вечно' }[a.ret] || '…';
    const groups = (a.groups || []).length ? a.groups.join(', ') : '…';
    const fields = (cancelFields && cancelFields.length ? cancelFields : DEF_FIELDS).filter(x => FIELDS.some(f => f.id === x));
    const req = fields.filter(x => NEED.includes(x));
    const typ = { lateCancel: 'boolean', cancelledAt: 'string, format: date-time', startsAt: 'string, format: date-time' };
    return `asyncapi: 3.0.0
info:
  title: Пульс — события записи на занятия
  version: 1.0.0
  description: Владелец — модуль «Запись». Совместимость схем — ${a.compat || '…'}.
servers:
  prod: { host: kafka.puls.internal:9091, protocol: kafka-secure }
channels:
  bookingEvents:
    address: [[hl]]${addr}[[/]]
    messages:
${msgs.length ? msgs.map(m => `      ${m}: { $ref: '#/components/messages/${m}' }`).join('\n') : '      …'}
    bindings:
      kafka:
        partitions: [[hl]]${a.parts || '…'}[[/]]
        topicConfiguration: ${ret}
    x-consumer-groups: [${groups}]
operations:
  publishBookingEvents:
    action: [[hl]]${a.action || '…'}[[/]]
    channel: { $ref: '#/channels/bookingEvents' }
components:
  messages:
    BookingCancelled:
      contentType: application/json
      bindings:
        kafka: { key: { type: string, description: [[hl]]${a.key || '…'}[[/]] } }
      payload: { $ref: '#/components/schemas/BookingCancelledV1' }
  schemas:
    BookingCancelledV1:          # поля — из задания 2.1
      type: object
      required: [${req.join(', ')}]
      properties:
${fields.map(x => `        ${x}: { type: ${typ[x] || 'string'} }`).join('\n')}`;
  }
  const asyncTask = {
    id: 'asyncapi', title: 'AsyncAPI канала записей',
    simple: {
      icon: '🗂️', plain: 'Паспорт топика: где он, какие события в нём живут, по какому ключу разложены, сколько хранятся и кто читает.',
      analogy: 'Табличка на двери зала: «Сайкл. 20 мест. Тренер — Ирина. Вход по записи». Пришёл новый клиент — прочитал и всё понял без администратора.',
      tech: '<code>channels.*.address</code> — топик; <code>messages</code> — типы событий; <code>bindings.kafka</code> — партиции, хранение, ключ сообщения; <code>operations.*.action</code> — <code>send</code> у продюсера. Схемы — JSON Schema, те же, что в реестре.'
    },
    lead: ui.brief({
      situation: 'Партнёрский шлюз — новый потребитель топика записей, его пишет новая команда. Антон: «Хочу, чтобы они подключились по документу, а не по чату». Описание пишет модуль «Запись» — продюсер. Поля <code>BookingCancelled</code> подставятся из вашего задания 2.1.',
      todo: [
        'Выберите <b>адрес канала</b>, <b>действие</b> модуля «Запись», <b>ключ</b>, <b>число партиций</b>, <b>хранение</b> и <b>совместимость</b>.',
        'Отметьте <b>сообщения</b>, которые живут в этом топике, и <b>группы потребителей</b>, которые его читают.',
        'Смотрите, как собирается YAML справа (на телефоне — ниже), потом «Проверить».'
      ],
      look: 'Жёлтая подсветка в YAML — места, которые вы заполняете переключателями. Подсказка по цифрам: в каноне «Пульса» у топика записей 12 партиций и хранение 7 дней.'
    }),
    blank: () => ({ addr: '', action: '', msgs: [], key: '', parts: '', ret: '', compat: '', groups: [] }),
    reference: () => ({ addr: 'v1', action: 'send', msgs: ['BookingCreated', 'BookingCancelled', 'WaitlistPromoted'], key: 'classId', parts: '12', ret: '7d', compat: 'BACKWARD', groups: A_GROUPS.filter(g => g.ok).map(g => g.id) }),
    render(el, ctx) {
      el.classList.add('mqe-root');
      const a = ctx.ans; a.msgs = a.msgs || []; a.groups = a.groups || [];
      const rv = !!ctx.result || ctx.readonly;
      let cf = null;
      try { cf = ctx.readonly ? designTask.reference().fields : ((TR.taskState(SID, 'design-cancel') || {}).ans || {}).fields; } catch (e) { cf = null; }
      const lbl = (list, key, id, okF, whyF) => list.map(x => {
        const on = a[key].includes(x.id), cls = rv ? (on ? (x.ok ? 'ok' : 'bad') : (x.ok ? 'warn' : '')) : (on ? 'on' : '');
        return `<label class="${cls}"><input type="checkbox" data-${id}="${x.id}" ${on ? 'checked' : ''} ${ctx.readonly ? 'disabled' : ''}><span><code>${x.id}</code>${rv && on && !x.ok ? `<span class="sub">${esc(x.why)}</span>` : ''}</span></label>`;
      }).join('');
      el.innerHTML = `<div class="stack">
        <div class="mqe-box"><div class="mqe-set">
          <div class="lbl">Адрес канала</div>${ui.seg('addr', A_ADDR, a.addr, 'accent')}
          <div class="lbl">Действие «Записи»</div>${ui.seg('action', A_ACT, a.action, 'accent')}
          <div class="lbl">Ключ сообщения</div>${ui.seg('key', A_KEY, a.key, 'accent')}
          <div class="lbl">Партиций</div>${ui.seg('parts', A_PART, a.parts, 'accent')}
          <div class="lbl">Хранение</div>${ui.seg('ret', A_RET, a.ret, 'accent')}
          <div class="lbl">Совместимость схем</div>${ui.seg('compat', A_COMP, a.compat, 'accent')}
        </div></div>
        <div class="grid2"><div class="stack tight"><div class="eyebrow">Сообщения в топике</div><div class="mqe-checks" style="grid-template-columns:minmax(0,1fr)">${lbl(A_MSGS, 'msgs', 'm')}</div></div>
        <div class="stack tight"><div class="eyebrow">Группы потребителей</div><div class="mqe-checks" style="grid-template-columns:minmax(0,1fr)">${lbl(A_GROUPS, 'groups', 'g')}</div></div></div>
        <div data-yaml></div>
      </div>`;
      lock(TR.$('.mqe-box', el), ctx.readonly);
      const redraw = () => { TR.$('[data-yaml]', el).innerHTML = ui.code(asyncYaml(a, cf), 'yaml', 'asyncapi.yaml — модуль «Запись»' + (cf && cf.length ? ' · поля BookingCancelled из задания 2.1' : ' · поля BookingCancelled по умолчанию')); };
      ui.onSeg(el, (name, v) => { if (ctx.readonly) return; a[name] = v; ctx.save(); redraw(); });
      el.addEventListener('change', e => {
        const c = e.target.closest('[data-m],[data-g]'); if (!c || ctx.readonly) return;
        const key = c.dataset.m ? 'msgs' : 'groups', id = c.dataset.m || c.dataset.g, list = key === 'msgs' ? A_MSGS : A_GROUPS;
        a[key] = c.checked ? list.map(x => x.id).filter(x => x === id || a[key].includes(x)) : a[key].filter(x => x !== id);
        c.closest('label').className = c.checked ? 'on' : '';
        ctx.save(); redraw();
      });
      redraw();
    },
    check(ans) {
      const notes = []; let pts = 0;
      const one = (cond, w, okHtml, badHtml, warn) => { if (cond) { pts += w; if (okHtml) notes.push({ ok: true, html: okHtml }); } else notes.push({ ok: warn ? 'warn' : false, html: badHtml }); };
      one(ans.addr === 'v1', 15, 'Канал — общий топик <code>puls.booking.events.v1</code>.', ans.addr === 'pertype' ? 'Свой топик на каждый тип разорвёт порядок: <code>BookingCreated</code> и <code>BookingCancelled</code> одного занятия окажутся в разных топиках, и лист ожидания снова увидит отмену раньше записи.' : ans.addr === 'nover' ? 'Имя без префикса и версии: непонятно, чей топик и куда переезжать при ломающем изменении. Соглашение «Пульса»: <code>puls.&lt;контекст&gt;.&lt;что&gt;.v&lt;N&gt;</code>.' : 'Выберите адрес канала.');
      one(ans.action === 'send', 10, null, ans.action === 'receive' ? 'Документ описывает модуль «Запись» — он публикует. <code>receive</code> пишут потребители в своих описаниях.' : 'Выберите действие.');
      const m = ans.msgs || [], mGood = A_MSGS.filter(x => x.ok && m.includes(x.id)).length, mBad = A_MSGS.filter(x => !x.ok && m.includes(x.id));
      pts += Math.max(0, mGood * 5 - mBad.length * 5);
      if (mGood === 3 && !mBad.length) notes.push({ ok: true, html: 'В топике три типа: запись, отмена, перевод из листа ожидания — все про места одного занятия.' });
      else { if (mGood < 3) notes.push({ ok: false, html: 'Не все события записи отмечены. Что, кроме записи и отмены, меняет места на занятии?' }); mBad.forEach(x => notes.push({ ok: false, html: `<code>${x.id}</code> — не отсюда: ${esc(x.why)}.` })); }
      one(ans.key === 'classId', 15, 'Ключ — <code>classId</code>: порядок внутри занятия.', 'Ключ сообщения должен держать порядок там, где он важен листу ожидания. Вспомните задание 2.1 и инцидент 2.');
      one(ans.parts === '12', 10, null, ans.parts === '1' ? 'Одна партиция — один читатель в группе: 400 записей в секунду в пик никто не распараллелит.' : 'Число партиций — из канона: у топика записей их 12.', ans.parts === '6');
      one(ans.ret === '7d', 10, null, ans.ret === 'compact' ? 'Сжатие оставит по одному последнему событию на ключ — на каждое занятие одно событие. История записей и отмен пропадёт. Сжатие — для списка пропусков, где важно только последнее состояние.' : ans.ret === 'forever' ? 'Вечно — дорого и опасно: журнал растёт без конца. Канон — 7 дней; длинная история живёт в ClickHouse.' : 'Выберите срок хранения.', ans.ret === 'forever');
      one(ans.compat === 'BACKWARD', 10, null, 'Без проверки совместимости переименование поля снова доедет до прода (инцидент 6).');
      const g = ans.groups || [], gGood = A_GROUPS.filter(x => x.ok && g.includes(x.id)).length, gBad = A_GROUPS.filter(x => !x.ok && g.includes(x.id));
      pts += Math.max(0, Math.round(gGood * 15 / 6) - gBad.length * 3);
      if (gGood === 6 && !gBad.length) notes.push({ ok: true, html: 'Все шесть групп потребителей перечислены — при изменении схемы видно, кого предупреждать.' });
      else { if (gGood < 6) notes.push({ ok: false, html: `Отмечено ${gGood} из 6 групп, которые читают топик записей. Список потребителей — главное, что нужно автору контракта при любом изменении.` }); gBad.forEach(x => notes.push({ ok: false, html: `<code>${x.id}</code> — ${esc(x.why)}.` })); }
      const score = Math.min(1, pts / 100);
      const ok = score >= 0.85 && ans.addr === 'v1' && ans.key === 'classId' && ans.ret !== 'compact' && !mBad.length;
      return { ok, score, notes, summary: `Паспорт канала заполнен на ${Math.round(score * 100)}%.`, vera: ok ? null : 'Каждую строку AsyncAPI сверяйте с каноном: таблица топиков в §4 — имя, ключ, партиции, хранение, кто читает.' };
    },
    explain: `<p>В описании ничего не придумано — всё взято из решений: таблица топиков (ключ, 12 партиций, 7 дней, шесть групп), ваш <code>BookingCancelled</code>, режим реестра.</p>
      <ul class="checks">
        <li><b>Один топик на все события занятия</b> — иначе нет общего порядка.</li>
        <li><b><code>x-consumer-groups</code></b> — расширение «Пульса»: кто читает. Без этого списка невозможно оценить ломающее изменение.</li>
        <li><b>Сжатие не для этого топика.</b> Сжатый топик <code>puls.access.allowlist.v1</code> хранит последнее состояние клиента; топик событий хранит историю.</li>
      </ul>
      <p>AsyncAPI 3.0 — стандарт; из него генерируют документацию и заготовки кода, а схемы из <code>components.schemas</code> регистрируют в реестре.</p>`,
    report: ans => `Канал: ${tOf(A_ADDR, ans.addr)}; действие: ${ans.action || '—'}; ключ: ${ans.key || '—'}; партиций: ${ans.parts || '—'}; хранение: ${tOf(A_RET, ans.ret)}; совместимость: ${ans.compat || '—'}.\nСообщения: ${(ans.msgs || []).join(', ') || '—'}.\nГруппы: ${(ans.groups || []).join(', ') || '—'}.`
  };

  // =====================================================================
  // Практика 4. Общие соглашения
  // =====================================================================
  const CONV_RUBRIC = [
    'Имена: прошедшее время, PascalCase (<code>BookingCancelled</code>); команды («отправь пуш») — не в Kafka, а в очередь',
    'Конверт обязателен: <code>eventId</code> (для дедупликации), <code>type</code>, <code>version</code>, <code>occurredAt</code> со смещением, <code>producer</code>, <code>key</code>, <code>traceId</code>',
    'Данные: достаточно для большинства потребителей, не вся таблица; без ПДн — только <code>clientId</code>; только данные своего контекста',
    'Ключ партиции — сущность, внутри которой важен порядок (для записи — занятие)',
    'Изменения: реестр схем, BACKWARD; только добавляем необязательные поля; удалять/переименовывать/менять тип и смысл нельзя; ломающее — топик <code>.v2</code> с двойной публикацией, сначала <code>deprecated</code>',
    'Потребители: идемпотентны по <code>eventId</code>, пропускают незнакомые поля, типы и значения',
    'Каждый топик описан в AsyncAPI (имя <code>puls.&lt;контекст&gt;.&lt;что&gt;.v&lt;N&gt;</code>, владелец, потребители); изменения проходят ревью аналитика'
  ];
  const CONV_REF = `<p><b>Общие соглашения по событиям «Пульса»</b></p>
    <ol><li><b>Имена.</b> Событие — факт в прошедшем времени, PascalCase: <code>BookingCancelled</code>. Команды («отправь пуш») — в очереди RabbitMQ, не в Kafka.</li>
    <li><b>Конверт.</b> У каждого события: <code>eventId</code> (UUID, для дедупликации), <code>type</code>, <code>version</code>, <code>occurredAt</code> (ISO 8601 со смещением), <code>producer</code>, <code>key</code>, <code>traceId</code>, <code>data</code>.</li>
    <li><b>Данные.</b> Столько, сколько нужно большинству потребителей, на момент события. Не вся строка таблицы. Только данные своего контекста. Персональных данных нет — только <code>clientId</code>.</li>
    <li><b>Ключ.</b> Сущность, внутри которой важен порядок: занятие для записи, клиент для абонементов и платежей, клуб для проходов.</li>
    <li><b>Изменения.</b> Схемы — в реестре, JSON Schema, BACKWARD. Только добавляем необязательные поля. Удалять, переименовывать, менять тип и смысл нельзя. Ломающее изменение — новый топик <code>.v2</code>, публикация в оба, перевод потребителей, затем закрытие v1. Перед удалением поле помечаем <code>deprecated</code>.</li>
    <li><b>Потребители.</b> Идемпотентны по <code>eventId</code> (таблица <code>processed_event</code>). Незнакомые поля, типы и значения пропускают, а не падают.</li>
    <li><b>Документация.</b> Топик <code>puls.&lt;контекст&gt;.&lt;что&gt;.v&lt;N&gt;</code>, у топика один владелец. Каждый канал описан в AsyncAPI со списком групп потребителей. Изменения схемы проходят ревью аналитика.</li></ol>`;
  const CONV_HEADS = ['Имена', 'Конверт', 'Данные', 'Ключ', 'Изменения', 'Потребители', 'Документация'];
  const convTask = {
    id: 'conventions', title: 'Правила для всех событий «Пульса»',
    simple: {
      icon: '📘', plain: 'Один раз договориться, как выглядят все события, — и не спорить об этом на каждом новом событии.',
      analogy: 'Правила клуба на стене: «вход по карте, полотенце с собой, отмена за 2 часа». Новый тренер прочитал — и работает как все.',
      tech: 'Раздел «Общие соглашения» в документации интеграций: именование, конверт, состав данных и ПДн, ключи, эволюция схем, требования к потребителям, AsyncAPI.'
    },
    lead: ui.brief({
      situation: 'Антон: «В сезоне у нас будет 10+ типов событий и пять команд. Если каждый будет проектировать событие по-своему, инцидент 6 повторится. Напишите раздел “Общие соглашения” — я вставлю его в архитектурную документацию, и ревью будем вести по нему».',
      todo: [
        'Нажимайте на кнопки-заголовки — они добавят пункты в текст, чтобы не начинать с чистого листа.',
        'Под каждым пунктом напишите правило одной-двумя фразами и, где можно, — почему (какой инцидент оно предотвращает).',
        'Нажмите «Сверить с эталоном самому» (или «Проверить с Верой») и отметьте, что у вас прозвучало.'
      ],
      lookTitle: 'Как проверяется',
      look: 'Засчитывается, когда покрыто не меньше 60 % критериев. Ориентиры — всё, что вы сегодня видели: конверт, «тонкое» против «с данными», ПДн, ключ занятия, BACKWARD и .v2, AsyncAPI.'
    }),
    blank: () => ({ j: { text: '' } }),
    reference: () => ({ j: { text: CONV_REF.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), self: CONV_RUBRIC.map(() => true) } }),
    render(el, ctx) {
      el.classList.add('mqe-root');
      el.innerHTML = `<div class="stack">${ctx.readonly ? '' : `<div class="mqe-chips"><span class="small dim">Добавить пункт:</span>${CONV_HEADS.map((h, i) => `<button type="button" class="chip" data-h="${i}">+ ${esc(h)}</button>`).join('')}</div>`}<div data-j></div></div>`;
      const box = TR.$('[data-j]', el);
      ui.justify(box, {
        id: 'mqe-conv', q: 'Общие соглашения: правила для всех событий «Пульса»', rubric: CONV_RUBRIC, reference: CONV_REF, value: ctx.ans.j, readonly: ctx.readonly, minLen: 300,
        onChange: j => { ctx.save({ j }); ctx.decide('Общие соглашения по событиям', j.text || ''); }
      });
      TR.on(el, 'click', '[data-h]', (e, b) => {
        const ta = TR.$('textarea', box); if (!ta) return;
        const h = CONV_HEADS[+b.dataset.h];
        if (ta.value.includes(h + ':')) { ta.focus(); return; }
        ta.value = (ta.value.trim() ? ta.value.replace(/\s+$/, '') + '\n' : '') + `${CONV_HEADS.indexOf(h) + 1}. ${h}: `;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
      });
    },
    check(ans) {
      const s = ui.justifyScore(ans.j), len = ((ans.j || {}).text || '').trim().length, notes = [];
      if (len < 300) notes.push({ ok: false, html: 'Пока коротко: семь разделов соглашений в 300 символов не уместить. Добавьте пункты кнопками сверху.' });
      else if (!(ans.j || {}).self && !(ans.j || {}).ai) notes.push({ ok: 'warn', html: 'Сверьте текст с эталоном (кнопка под полем) или проверьте с Верой.' });
      else notes.push({ ok: s >= 0.6, html: `Покрыто критериев: ${Math.round(s * 100)}%.` });
      return { ok: s >= 0.6, score: s, notes, vera: s < 0.6 && len >= 300 ? 'Пройдитесь по сегодняшним блокам по порядку: имя → конверт → данные и ПДн → ключ → изменения схемы → потребители → AsyncAPI. Каждый блок — одно правило.' : null };
    },
    explain: `<p>Хорошие соглашения коротки и проверяемы: по каждому пункту на ревью можно ответить «да» или «нет». И у каждого пункта есть история — инцидент, который он предотвращает: дубли пушей (<code>eventId</code>), лист ожидания на отменённое занятие (ключ), упавшие потребители после релиза бонусов (BACKWARD и .v2).</p>
      <p>Соглашения живут рядом с AsyncAPI и ADR, а не в чате. Аналитик — их автор и главный ревьюер изменений событий.</p>`,
    report: ans => `Общие соглашения:\n> ${String((ans.j || {}).text || '—').replace(/\n/g, '\n> ')}\nСамооценка: ${Math.round(ui.justifyScore(ans.j) * 100)}%.`
  };

  // =====================================================================
  TR.stage({
    id: SID, act: 5, order: 250, slot: 'Пт 10:00', title: 'Проектирование событий',
    when: 'пятница, 10:00 · переговорная «Сайкл»',
    intro: [
      { who: 'lena', html: 'Бонусы и уведомления уже читают <code>puls.booking.events.v1</code>. Теперь нужна отмена записи — <code>BookingCancelled</code>. Разработчики спрашивают: какие поля класть? Кто вообще это решает?' },
      { who: 'anton', html: 'Решает аналитик. Контракт события — такой же контракт, как OpenAPI. В прошлом месяце команда бонусов переименовала поле в событии, и упали старые потребители. Больше так не хочу.' },
      { who: 'vera', html: 'Сегодня вы — автор контракта событий. Сначала разберёмся, чем событие отличается от команды, что лежит в конверте и как менять схему, никого не уронив. Потом спроектируете <code>BookingCancelled</code>, опишете канал в AsyncAPI и напишете правила для всех событий.' }
    ],
    facts: ['F-cancel', 'F-waitlist', 'F-delete', 'F-clubs', 'F-old-apps'],
    glossary: [
      { term: 'Событие и команда', simple: 'Событие — объявление «уже случилось», его читает кто хочет. Команда — записка «сделай» конкретному исполнителю.', tech: 'Событие — неизменяемый факт в прошедшем времени (BookingCreated), у него нет адресата. Команда — запрос на действие (SendPush), у неё один обработчик, она может быть отклонена.' },
      { term: 'Конверт события', simple: 'Как конверт письма: снаружи номер, тип, дата и отправитель, внутри — содержимое.', tech: 'Служебные поля, одинаковые для всех событий: eventId, type, version, occurredAt, producer, key, traceId; содержимое — в data.' },
      { term: 'Тонкое уведомление', simple: 'Объявление «что-то случилось с абонементом 5521, подробности у меня» — и все бегут переспрашивать.', tech: 'Event notification: в событии только идентификатор. Потребители идут за данными в API владельца — растёт нагрузка и связанность.' },
      { term: 'Event-carried state transfer', simple: 'В объявлении сразу всё нужное — переспрашивать не надо.', tech: 'Событие несёт состояние на момент события, достаточное большинству потребителей. Канон «Пульса»: достаточно данных, но не вся таблица и без ПДн.' },
      { term: 'Schema Registry (реестр схем)', simple: 'Архив образцов бланков с вахтёром: новый бланк не пустят, если старые инструкции по нему не сработают.', tech: 'Хранилище версий схем событий с проверкой совместимости при выкатке. У «Пульса» — JSON Schema.' },
      { term: 'Совместимость BACKWARD', simple: 'Новый бланк можно заполнять по старой инструкции, а новые читатели понимают и старые бланки.', tech: 'Режим реестра: новая схема читает данные старой. У «Пульса» плюс правило: поля только добавляем необязательными; удалять, переименовывать, менять тип нельзя.' },
      { term: 'Ломающее изменение схемы события', simple: 'Переименовали графу в бланке — администраторы со старой инструкцией заполняют неправильно.', tech: 'Изменение схемы, после которого существующий потребитель падает или неверно понимает данные: удаление, переименование, смена типа или смысла, новое обязательное поле. Выпускается через топик .v2.' },
      { term: 'Версия топика (.v2)', simple: 'Новый журнал рядом со старым: пишем в оба, пока все не переедут.', tech: 'puls.booking.events.v2 рядом с v1; продюсер публикует в оба, потребители переходят по одному, затем v1 закрывают и удаляют после срока хранения.' },
      { term: 'AsyncAPI', simple: 'Табличка на двери зала: что здесь проходит, сколько мест, кто ведёт.', tech: 'Стандарт описания асинхронных API (как OpenAPI для событий): servers, channels, operations (send/receive), messages, schemas, bindings для Kafka.' }
    ],
    outro: 'Теперь вы автор контрактов событий: имя в прошедшем времени, конверт с <code>eventId</code> и временем со смещением, данные без ПДн и без чужих таблиц, ключ там, где важен порядок, BACKWARD и .v2 для ломающих изменений, AsyncAPI со списком потребителей. Неделя брокеров закончена. В понедельник — архитектура: Антон и Тимур спорят, резать ли ядро на микросервисы.',
    tasks: [howEvent, howEvolve, howAsync, designTask, evolveTask, asyncTask, convTask]
  });
})();
