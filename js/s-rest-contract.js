/* Неделя 3, вторник 11:00: контракт REST — заголовки и тело запроса, коды ответа, ошибки по RFC 9457, форматы данных.
   Студент сам собирает запрос записи на занятие и видит живой ответ сервера, сопоставляет ситуации и коды,
   находит проблемы в плохих ошибках и формулирует правила форматов. Канон: _dev/DOMAIN.md §10. */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc;
  const mkEl = (parent, cls) => { const d = document.createElement('div'); if (cls) d.className = cls; parent.appendChild(d); return d; };

  // ---------- подход 1: соберите запрос ----------
  const HDR = [
    { id: 'auth', k: 'Authorization', v: 'Bearer eyJhbGciOi…', need: true, miss: 'Как сервер узнает, кто записывается? Без этого — 401.', extra: '' },
    { id: 'idem', k: 'Idempotency-Key', v: '7f3c2b9e-1d4a-4c8e-b6f1-0a9d2e5c7b31', need: true, miss: 'Ответ потерялся в сети — приложение повторит POST. Как серверу понять, что это повтор, а не новая попытка?', extra: '' },
    { id: 'ct', k: 'Content-Type', v: 'application/json', need: true, miss: 'В запросе есть тело. В каком оно формате? Сервер не должен гадать (иначе 415).', extra: '' },
    { id: 'ifm', k: 'If-Match', v: '"v7"', need: false, miss: '', extra: 'If-Match сверяет версию (ETag) существующего ресурса перед изменением. Запись ещё не создана — сверять не с чем.' },
    { id: 'cookie', k: 'Cookie', v: 'session=a81f…', need: false, miss: '', extra: 'Приложение несёт токен в Authorization. Куки — история браузера, вместе с ними приходит риск CSRF.' },
    { id: 'xcid', k: 'X-Client-Id', v: '1042', need: false, miss: '', extra: 'Кто клиент — уже сказано в токене. Отдельный заголовок подделать проще простого: это та самая дыра из пентеста.' }
  ];
  const BODY = [
    { id: 'source', k: 'source', v: 'app', need: true, miss: 'Откуда пришла запись: приложение, кабинет или ФитПасс? Это нужно аналитике и при разборе споров.', extra: '' },
    { id: 'clientId', k: 'clientId', v: 1042, need: false, miss: '', extra: 'Клиента сервер берёт из токена. Пришлёте clientId — кто-то пришлёт чужой и запишет соседа (пентест «Пульса»).' },
    { id: 'classId', k: 'classId', v: '4b1f0c3e-…', need: false, miss: '', extra: 'Занятие уже есть в пути /classes/{classId}/bookings. Два источника правды — два шанса разойтись.' },
    { id: 'price', k: 'price', v: 0, need: false, miss: '', extra: 'Цену и право на занятие сервер считает по абонементу. Клиент пришлёт 0 — и что?' },
    { id: 'status', k: 'status', v: 'booked', need: false, miss: '', extra: 'Статус выставляет сервер: booked, если место есть, иначе 409 со ссылкой на лист ожидания.' }
  ];
  const CLASS_PATH = '/v1/classes/4b1f0c3e-6a1d-4f0e-9a51-2a7c1e9d1b10/bookings';
  function serverReply(a) {
    const h = a.h || {}, b = a.b || {};
    const body = Object.fromEntries(BODY.filter(x => b[x.id]).map(x => [x.k, x.v]));
    const hasBody = Object.keys(body).length > 0;
    if (!h.auth) return { status: 401, headers: { 'WWW-Authenticate': 'Bearer', 'Content-Type': 'application/problem+json' }, body: { type: 'https://api.puls.fit/problems/unauthorized', title: 'Нужен вход', status: 401 }, why: 'Нет токена — сервер не знает, кто вы.' };
    if (hasBody && !h.ct) return { status: 415, headers: { 'Content-Type': 'application/problem+json' }, body: { type: 'https://api.puls.fit/problems/unsupported-media-type', title: 'Не указан формат тела', status: 415 }, why: 'Тело есть, а формат не указан.' };
    const bad = BODY.filter(x => b[x.id] && !x.need).map(x => x.k);
    if (bad.length) return { status: 400, headers: { 'Content-Type': 'application/problem+json' }, body: { type: 'https://api.puls.fit/problems/validation', title: 'Лишние поля в запросе', status: 400, errors: bad.map(k => ({ field: k, detail: 'Это поле задаёт сервер' })) }, why: 'Строгий сервер отклоняет поля, которые клиент задавать не вправе. Мягкий — молча игнорирует. Главное — не доверяет.' };
    return { status: 201, headers: { Location: '/v1/bookings/9e2d7a10-3c4b-4e5f-8a6b-1c2d3e4f5a6b', 'Content-Type': 'application/json' }, body: { id: '9e2d7a10-…', status: 'booked', freeCancellationUntil: '2026-10-05T07:00:00+03:00', _links: { self: { href: '/v1/bookings/9e2d7a10-…' }, cancel: { href: '/v1/bookings/9e2d7a10-…/cancellation', method: 'POST' } } }, why: h.idem ? 'Запись создана. Повтор с тем же ключом вернёт этот же ответ.' : 'Запись создана. Но если ответ потеряется и приложение повторит запрос без ключа — клиент получит 409 «уже записан», хотя записался успешно, а для оплаты так случается двойное списание.' };
  }

  // ---------- подход 2: коды ответа ----------
  const CODE_T = { 200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 409: 'Conflict', 412: 'Precondition Failed', 415: 'Unsupported Media Type', 422: 'Unprocessable Content', 429: 'Too Many Requests', 500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout' };
  const CODE_CH = Object.keys(CODE_T).map(c => ({ v: c, t: `${c} ${CODE_T[c]}` }));
  const SIT = [
    { id: 'created', t: 'Клиент записался на занятие', ok: ['201'], why: '201 Created + Location: адрес новой записи.', hint: 'создан новый ресурс — какой код это говорит и отдаёт его адрес?', no: { 200: '200 — просто «хорошо». Для созданного ресурса есть точный код с заголовком Location.' } },
    { id: 'export', t: 'Директор заказал выгрузку выручки, она считается минуты', ok: ['202'], why: '202 Accepted + Location на статус — номерок в гардеробе.', hint: 'работа принята, но не сделана.' },
    { id: 'unfreeze', t: 'Клиент отменил будущую заморозку', ok: ['204'], why: '204 No Content: удалили, возвращать нечего.', hint: 'удалили, в ответе нечего показать.' },
    { id: 'noauth', t: 'Токен истёк', ok: ['401'], why: '401 + WWW-Authenticate: приложение обновит токен через refresh и повторит.', hint: 'сервер не знает, кто вы.', no: { 403: '403 — «знаю, кто вы, но вам нельзя». Здесь сервер вообще не знает, кто вы: токен истёк. Приложению нужен сигнал «обнови токен» — это 401.' } },
    { id: 'admin', t: 'Клиент вызвал эндпоинт администратора', ok: ['403'], why: '403: личность известна, прав не хватает.', hint: 'токен в порядке, личность известна. Чего не хватает?', no: { 401: 'Токен действующий — повторный вход ничего не даст. Не хватает прав.' } },
    { id: 'foreign', t: 'Клиент открыл чужую запись, подставив её id', ok: ['404', '403'], alt: 0.6, why: '404: не раскрываем, что запись с таким id существует.', altWhy: '403 честнее, но подтверждает: запись с таким id есть. Перебором можно собрать чужие id. Канон «Пульса» — 404.', hint: 'вспомните пентест. Стоит ли подтверждать, что такая запись вообще есть?' },
    { id: 'full', t: 'Мест на занятие нет', ok: ['409'], why: '409 Conflict: запрос верный, но конфликтует с состоянием занятия. В теле — ссылка на лист ожидания.', hint: 'запрос правильный, но состояние занятия не позволяет.', no: { 422: '422 — запрос нарушает правила сам по себе. А здесь тот же запрос минуту назад прошёл бы: конфликт с текущим состоянием — 409.', 400: '400 — запрос сломан. А он правильный — просто мест нет.' } },
    { id: 'membership', t: 'Абонемент «домашний клуб» не действует в этом клубе', ok: ['422'], why: '422: запрос понятен, но по правилам абонемента невыполним.', hint: 'запрос корректен, права у клиента есть, но бизнес-правило не позволяет.', no: { 403: '403 — про права доступа к операции. Записываться клиент вправе, просто абонемент не подходит: это бизнес-правило — 422.', 409: '409 — конфликт с меняющимся состоянием (места кончились). Абонемент не станет действовать через минуту — 422.' } },
    { id: 'keybody', t: 'Повтор с тем же Idempotency-Key, но с другим телом', ok: ['422'], why: '422: ключ уже связан с другим запросом — ошибка клиента.', hint: 'один ключ — один запрос. Тело другое — кто ошибся?', no: { 409: '409 по тому же ключу — когда первый запрос ещё выполняется. Другое тело с тем же ключом — ошибка в запросе: 422.' } },
    { id: 'json', t: 'В теле сломанный JSON', ok: ['400'], why: '400: запрос даже не прочитать.', hint: 'сервер не может разобрать запрос.', no: { 422: '422 — JSON правильный, но нарушено правило. Сломанный JSON даже не прочитать — 400.', 500: 'Ошибка клиента — не повод для 5xx. ФитПасс начнёт повторять запрос.' } },
    { id: 'ifmatch', t: 'If-Match не совпал — профиль уже изменили с другого устройства', ok: ['412'], why: '412 Precondition Failed: условие запроса не выполнено, перечитайте и повторите.', hint: 'для условных запросов есть свой точный код.', no: { 409: 'Почти: это конфликт. Но для условия If-Match есть точный код — 412.' } },
    { id: 'rate', t: 'ФитПасс прислал больше 20 запросов в секунду', ok: ['429'], why: '429 + Retry-After и заголовки RateLimit.', hint: 'партнёр шлёт слишком часто.', no: { 503: '503 — «мы сами не можем». А здесь «вы шлёте слишком часто» — 429 с Retry-After.' } },
    { id: 'pspslow', t: 'ПэйПоинт не ответил за 5 секунд', ok: ['504'], why: '504 Gateway Timeout: вышестоящий сервис не ответил вовремя.', hint: 'мы работаем посредником, а сервис за нами молчит.', no: { 502: '502 — ответ пришёл, но негодный. Здесь ответа нет вовсе — 504.', 500: '500 — ошибка в нашем коде. Здесь подвёл внешний сервис, коды 502 и 504 говорят точнее.' } },
    { id: 'pspjunk', t: 'ПэйПоинт ответил HTML-страницей вместо JSON', ok: ['502'], why: '502 Bad Gateway: вышестоящий сервис ответил мусором.', hint: 'мы посредник, ответ от сервиса за нами пришёл, но он негодный.', no: { 504: '504 — когда ответа нет. Здесь он пришёл, но негодный — 502.' } },
    { id: 'maint', t: 'Плановые работы ночью', ok: ['503'], why: '503 + Retry-After: временно недоступны, приходите позже.', hint: 'сервис временно недоступен — и знает, когда вернётся.', no: { 429: '429 — «вы шлёте слишком часто». Здесь виноваты не вы, сервис закрыт на работы — 503.' } }
  ];
  function matchReveal(rows, m, show) {
    if (!show) return null;
    const rv = {};
    rows.forEach(r => { const v = m[r.id]; if (!v) return; const s = r.ok[0] === v ? 'ok' : r.ok.includes(v) ? 'warn' : 'bad'; rv[r.id] = { s, why: s === 'bad' ? ((r.no && r.no[v]) || r.hint) : s === 'warn' ? r.altWhy : r.why }; });
    return rv;
  }
  function matchScore(rows, m) {
    let pts = 0; const notes = [];
    rows.forEach(r => {
      const v = m[r.id], name = String(r.t).replace(/<[^>]+>/g, '');
      if (!v) { notes.push({ ok: false, html: `«${esc(name)}» — не выбрано.` }); return; }
      if (v === r.ok[0]) pts += 1;
      else if (r.ok.includes(v)) { pts += r.alt || 0.8; notes.push({ ok: 'warn', html: `«${esc(name)}» — ${r.altWhy}` }); }
      else notes.push({ ok: false, html: `«${esc(name)}» — ${(r.no && r.no[v]) || r.hint}` });
    });
    return { score: rows.length ? pts / rows.length : 0, notes };
  }

  // ---------- подход 3: ошибка по RFC 9457 ----------
  const VARIANTS = [
    { id: 'A', http: { status: 200, headers: { 'Content-Type': 'application/json' }, body: { success: false, message: 'Мест нет' } } },
    { id: 'B', http: { status: 400, headers: { 'Content-Type': 'application/json' }, body: { error: 'CLASS_FULL' } } },
    { id: 'C', http: { status: 409, headers: { 'Content-Type': 'application/problem+json' }, body: { type: 'https://api.puls.fit/problems/class-full', title: 'Мест нет', status: 409, detail: 'На занятие «Йога для начинающих» 5 октября в 09:00 записаны все 20 человек.', instance: '/v1/classes/4b1f0c3e-…/bookings', _links: { 'join-waitlist': { href: '/v1/classes/4b1f0c3e-…/bookings', method: 'POST', body: { waitlist: true } } } } } },
    { id: 'D', http: { status: 409, headers: { 'Content-Type': 'application/problem+json' }, body: { type: 'https://api.puls.fit/problems/class-full', title: 'Мест нет', status: 409, detail: 'ERROR: duplicate key value violates unique constraint "booking_class_id_client_id_key"', trace: 'at BookingService.book(BookingService.java:142)' } } }
  ];
  const PICK = {
    q: 'Какой ответ на «мест нет» правильный?',
    options: [
      { t: 'A', why: 'Код 200 при ошибке: приложение, кэш и мониторинг считают это успехом. Чтобы понять, что случилось, придётся читать тело.' },
      { t: 'B', why: '400 — «запрос сломан». А запрос правильный, просто мест нет. И ни слова человеку, ни ссылки на лист ожидания.' },
      { t: 'C', ok: 1, why: 'Верно: 409, application/problem+json, машиночитаемый type, понятные title и detail, ссылка «встать в лист ожидания».' },
      { t: 'D', why: 'Формат верный, но наружу утёк текст ошибки базы и строка кода. Это подарок атакующему, а клиенту — непонятный текст.' }
    ]
  };
  const BAD = [
    { id: 'e1', t: '<code>200 OK</code> · <code>{"error": true, "message": "Мест нет"}</code>', ok: ['code'], why: 'Ошибку маскируют под успех: кэш сохранит её, мониторинг не заметит, ретраи не сработают.', hint: 'посмотрите на код ответа. Что подумает кэш или мониторинг?' },
    { id: 'e2', t: '<code>500</code> на запрос, где дата начала заморозки не в формате', ok: ['blame'], why: 'Ошибка клиента выдана за ошибку сервера: ФитПасс ретраит любую 5xx, а дежурного разбудят зря.', hint: 'кто виноват — клиент или сервер? Что сделает ФитПасс, получив такой код?' },
    { id: 'e3', t: '<code>409</code> · <code>"detail": "PSQLException … at BookingService.java:142"</code>', ok: ['leak'], why: 'Наружу утекают внутренности: СУБД, имена классов, строки кода.', hint: 'кому полезен этот текст? И кому он полезен больше, чем клиенту?' },
    { id: 'e4', t: '<code>409</code> · <code>Content-Type: text/plain</code> · «Ошибка записи»', ok: ['nomachine'], why: 'Нет машиночитаемого type: приложению придётся сравнивать строки, а их переведут или поправят.', hint: 'как приложению отличить «мест нет» от «уже записаны» по такому ответу?' }
  ];
  const BAD_CH = [
    { v: 'code', t: 'Ошибка с кодом успеха' },
    { v: 'blame', t: '5xx на ошибку клиента' },
    { v: 'leak', t: 'Утечка внутренностей' },
    { v: 'nomachine', t: 'Нет машиночитаемого типа' }
  ];

  // ---------- подход 4: форматы ----------
  const FMT = [
    {
      q: 'Йога в клубе Екатеринбурга начинается в 9:00 по местному времени. Какие значения <code>startsAt</code> корректны?', multi: true, seed: 'rc-time',
      options: [
        { t: '<code>"2026-10-05T09:00:00+05:00"</code>', ok: 1, why: 'ISO 8601 со смещением: видно и местные 9:00, и точный момент.' },
        { t: '<code>"2026-10-05T04:00:00Z"</code>', ok: 1, why: 'Тот же момент в UTC — корректно. Но чтобы показать «9:00», экрану придётся знать пояс клуба. Смещение удобнее.' },
        { t: '<code>"2026-10-05T09:00:00"</code>', why: 'Без смещения: чьи это 9 утра — московские или екатеринбургские? Разница два часа, клиент опоздает.' },
        { t: '<code>"05.10.2026 9:00"</code>', why: 'Локальный формат: нет пояса, плохо сортируется, библиотеки путают день и месяц.' }
      ]
    },
    {
      q: 'Месячный абонемент стоит 5 400 ₽. Как передать цену?', seed: 'rc-money',
      options: [
        { t: '<code>{"amount": 540000, "currency": "RUB"}</code>', ok: 1, why: 'Целые копейки и валюта: никаких ошибок округления, сверка с 1С сходится до копейки.' },
        { t: '<code>{"price": 5400.00}</code>', why: 'Дробное число: 0,1 + 0,2 ≠ 0,3. На тысячах платежей копейки разъедутся со сверкой 1С.' },
        { t: '<code>{"price": "5 400 ₽"}</code>', why: 'Строка для глаз, а не для расчётов: пробел, знак рубля — клиенту придётся разбирать текст.' },
        { t: '<code>{"amount": 5400}</code>', why: 'Целое — хорошо, но это рубли или копейки? И какая валюта? Каждый прочитает по-своему.' }
      ]
    },
    {
      q: 'Старая версия приложения получила статус записи <code>"late_cancelled"</code>, которого не знает. Что она должна сделать?', seed: 'rc-enum',
      options: [
        { t: 'Показать нейтрально («Статус обновлён») и продолжить работу', ok: 1, why: 'Терпимый читатель: неизвестное значение — не повод падать. Старые приложения живут у клиентов месяцами.' },
        { t: 'Упасть с ошибкой разбора — данные некорректны', why: 'Ровно так случился инцидент «после релиза старые приложения падают». Новое значение — обычное развитие API.' },
        { t: 'Ничего: сервер не должен добавлять новые значения никогда', why: 'Тогда API заморожен навсегда. Правильнее заранее договориться: клиент терпит неизвестное.' },
        { t: 'Молча показать как «записан»', why: 'Хуже падения: клиент думает, что записан, и приходит на занятие.' }
      ]
    },
    {
      q: '<code>PATCH /me</code> с <code>application/merge-patch+json</code>. Чем отличаются тела <code>{"email": null}</code> и <code>{}</code>?', seed: 'rc-null',
      options: [
        { t: '<code>{"email": null}</code> — удалить email; <code>{}</code> — ничего не менять', ok: 1, why: 'Так по RFC 7396: null — команда «удалить поле», отсутствие поля — «не трогать».' },
        { t: 'Ничем: оба ничего не меняют', why: 'Тогда необязательный email не удалить. В merge-patch null — это «удалить».' },
        { t: '<code>{"email": null}</code> — ошибка 400', why: 'Email необязателен, его можно удалить. null здесь законен.' },
        { t: '<code>{}</code> — стереть все поля профиля', why: 'Отсутствие поля значит «не трогать». Иначе любой PATCH стирал бы профиль.' }
      ]
    }
  ];
  const FMT_RUBRIC = [
    'Время — ISO 8601 со смещением: клубы в разных поясах (Москва и Екатеринбург, +2 ч)',
    'Деньги — целые копейки и валюта, без дробных чисел: сверка с 1С до копейки',
    'Терпимый читатель: неизвестные поля и значения клиент не роняет — старые приложения живут месяцами',
    'null и отсутствие поля — разные вещи: null удаляет, отсутствие не трогает'
  ];
  const FMT_REF = 'Три правила в гайд API «Пульса». Первое: время всегда в ISO 8601 со смещением, например 2026-10-05T09:00:00+05:00 — клубы будут в Москве, Казани и Екатеринбурге, без смещения клиент опоздает на два часа. Второе: деньги — целое число копеек и валюта, {"amount": 540000, "currency": "RUB"}; дробные числа теряют копейки, и сверка с 1С не сойдётся. Третье: клиент — терпимый читатель: неизвестные поля и значения enum не роняют приложение, ведь старые версии живут месяцами. И отдельно: null и отсутствие поля различаем — в merge-patch null удаляет поле, а отсутствие ничего не меняет.';

  TR.stage({
    id: 'rest-contract', act: 3, order: 100, slot: 'Вт 11:00', title: 'Контракт и ошибки',
    when: 'вторник, 11:00 · созвон с Денисом и Кириллом',
    intro: [
      { who: 'vera', html: 'Справочник API есть. Но адрес и метод — это половина контракта. Вторая половина: что положить в заголовки и тело, что ответить при успехе и при каждой из десятка ошибок, в каком формате даты и деньги. Ошибки контракта находят не тесты, а клиенты в воскресенье в 20:00.' },
      { who: 'kirill', html: '«Для нас главное — по коду понять, повторять запрос или нет. Мы ретраим всё, что похоже на временную ошибку. Отдадите 500 на кривую дату — будем долбить, пока не надоест».' },
      { who: 'denis', html: '«А мне нужны ошибки, которые можно показать человеку. И чтобы старые версии приложения не падали от новых полей».' }
    ],
    facts: ['F-pentest', 'F-capacity', 'F-waitlist', 'F-fitpass-tech', 'F-old-apps', 'F-money', 'F-clubs', 'F-psp-slow'],
    glossary: [
      { term: 'Контракт API', simple: 'Договор, как в абонементе: что клиент приносит, что получает и что будет, если что-то пошло не так.', tech: 'Описание запросов и ответов: методы, пути, заголовки, тела, коды и форматы ошибок. Обычно в OpenAPI. Меняется только обратно совместимо.' },
      { term: 'Заголовок HTTP', simple: 'Надписи на конверте: от кого, в каком формате, номер квитанции. Само письмо — внутри.', tech: 'Метаданные запроса и ответа: <code>Authorization</code>, <code>Content-Type</code>, <code>Idempotency-Key</code>, <code>Location</code>, <code>Retry-After</code>, <code>ETag</code>.' },
      { term: 'Тело запроса', simple: 'Содержимое письма — только то, что знает и вправе решать отправитель.', tech: 'JSON с данными операции. Поля, которые определяет сервер (id клиента, цена, статус), в теле не принимаются — защита от подмены (mass assignment).' },
      { term: 'problem+json', simple: 'Бланк жалобы единого образца: код проблемы, заголовок, пояснение — любой сотрудник поймёт, что случилось.', tech: 'RFC 9457: <code>application/problem+json</code> с полями <code>type</code> (URI проблемы), <code>title</code>, <code>status</code>, <code>detail</code>, <code>instance</code> и своими расширениями.' },
      { term: '401 и 403', simple: '401 — охрана не знает, кто вы: покажите пропуск. 403 — знает, но в тренерскую вам нельзя.', tech: '<code>401 Unauthorized</code> + <code>WWW-Authenticate</code> — нет или истёк токен. <code>403 Forbidden</code> — личность известна, прав нет.' },
      { term: 'ISO 8601', simple: 'Запись времени, которую поймут в любом городе: с датой, временем и поправкой на пояс.', tech: '<code>2026-10-05T09:00:00+05:00</code>. Смещение обязательно: клубы будут в трёх поясах.' },
      { term: 'Терпимый читатель', simple: 'Как тренер, который видит в анкете незнакомую графу и просто пропускает её, а не выгоняет клиента.', tech: 'Принцип Постела для клиентов API: неизвестные поля и значения enum игнорировать или показывать нейтрально, не падать.' },
      { term: 'Retry-After', simple: 'Табличка «Перерыв, вернёмся через 10 минут».', tech: 'Заголовок с секундами или датой: когда можно повторить. Идёт с <code>429</code> и <code>503</code>.' }
    ],
    outro: 'Контракт стал полным: заголовки и тело запроса, точные коды, ошибки по RFC 9457, форматы времени и денег. Теперь Кирилл по коду понимает, повторять ли, а Денис может показать ошибку человеку. Дальше самое интересное — узкие места: повторы, гонки за последнее место и что бывает, когда два запроса приходят одновременно.',
    tasks: [
      {
        id: 'request', title: 'Соберите запрос записи',
        simple: { icon: '✉️', plain: 'Запрос — это конверт: заголовки снаружи, данные внутри. Класть нужно только то, что вправе решать клиент.', analogy: 'Как записка на ресепшен: пропуск (Authorization), номер квитанции, чтобы не записали дважды (Idempotency-Key), и пометка «пишу по-русски» (Content-Type). Цену и «запишите Иванова» клиент не диктует — это решает клуб.', tech: '<code>POST</code> <code>/classes/{classId}/bookings</code>: <code>Authorization</code> с токеном, <code>Idempotency-Key: UUID</code>, <code>Content-Type: application/json</code>, тело <code>{"source": "app"}</code>. Клиент, цена, статус — на стороне сервера.' },
        lead: ui.brief({
          situation: `Анна жмёт «Записаться» на «Йогу для начинающих» 5 октября в 09:00. Приложение отправляет <code>POST /v1/classes/{classId}/bookings</code>. Запрос похож на конверт. Снаружи — <b>заголовки</b>: кто отправил, в каком формате, номер операции. Внутри — <b>тело</b>: данные. Класть нужно только то, что клиент вправе решать сам.`,
          todo: [
            `Слева отметьте галочками заголовки и поля тела, которые должно прислать приложение.`,
            `Справа сразу видно запрос и ответ сервера. Пробуйте: снимите или поставьте галочку — посмотрите, что изменится в ответе.`,
            `Нажмите «Проверить». Нужно не меньше 90 % верных галочек и ни одной грубой ошибки в защите.`
          ],
          lookTitle: `Как читать`,
          look: `<p>Справа — сервер-симулятор. Он отвечает по вашему набору: нет пропуска — <code>401</code> «нужен вход»; есть тело, но не сказано, в каком оно формате, — <code>415</code>; лишние поля — <code>400</code>; всё верно — <code>201</code> «запись создана». Под ответом — почему сервер так решил.</p><p>Заголовки простыми словами: <code>Authorization</code> — пропуск (токен) клиента; <code>Idempotency-Key</code> — номер операции; <code>Content-Type</code> — формат тела; <code>If-Match</code> — «меняй, только если версия не менялась»; <code>Cookie</code> — данные, которые хранит браузер; <code>X-Client-Id</code> — номер клиента отдельным заголовком.</p>`
        }),
        blank: () => ({ h: {}, b: {} }),
        reference: () => ({ h: Object.fromEntries(HDR.map(x => [x.id, x.need])), b: Object.fromEntries(BODY.map(x => [x.id, x.need])) }),
        render(el, ctx) {
          const a = ctx.ans; a.h = a.h || {}; a.b = a.b || {};
          const show = ctx.result || ctx.readonly;
          const g = mkEl(el, 'grid2'); g.style.alignItems = 'start';
          const left = mkEl(g, 'stack tight'), right = mkEl(g, 'stack tight');
          const item = (grp, x) => {
            const on = !!a[grp][x.id], k = show ? (on === x.need ? 'ok' : 'bad') : '';
            const tipText = show ? (on && !x.need ? x.extra : x.need && !on ? x.miss : '') : '';
            const tip = tipText ? `<div class="small" style="color:var(--text-2);padding-left:24px">${esc(tipText)}</div>` : '';
            return `<label class="toggle" style="align-items:flex-start"><input type="checkbox" data-g="${grp}" data-i="${x.id}" ${on ? 'checked' : ''} ${ctx.readonly ? 'disabled' : ''}> <span class="mono small" style="overflow-wrap:anywhere${k ? ';color:var(--' + k + ')' : ''}">${esc(grp === 'h' ? `${x.k}: ${x.v}` : `"${x.k}": ${JSON.stringify(x.v)}`)}</span></label>${tip}`;
          };
          left.innerHTML = `<div class="eyebrow">Заголовки</div>${HDR.map(x => item('h', x)).join('')}<div class="eyebrow" style="margin-top:10px">Поля тела</div>${BODY.map(x => item('b', x)).join('')}`;
          const draw = () => {
            const body = Object.fromEntries(BODY.filter(x => a.b[x.id]).map(x => [x.k, x.v]));
            const rep = serverReply(a);
            right.innerHTML = ui.http({ method: 'POST', path: CLASS_PATH, cap: 'Запрос приложения', headers: [['Host', 'api.puls.fit'], ...HDR.filter(x => a.h[x.id]).map(x => [x.k, x.v])], body: Object.keys(body).length ? body : '' }) +
              ui.http({ status: rep.status, cap: 'Ответ сервера', headers: rep.headers, body: rep.body }) +
              `<div class="small" style="color:var(--text-2)">${esc(rep.why)}</div>`;
          };
          draw();
          if (!ctx.readonly) left.addEventListener('change', e => {
            const i = e.target.closest('[data-i]'); if (!i) return;
            a[i.dataset.g][i.dataset.i] = i.checked; ctx.save(); draw();
            if (i.dataset.i === 'clientId') ctx.decide('clientId в теле записи', i.checked ? 'да' : 'нет');
          });
        },
        check(ans) {
          const h = ans.h || {}, b = ans.b || {};
          let pts = 0; const notes = [];
          [['h', HDR], ['b', BODY]].forEach(([g, list]) => list.forEach(x => {
            const on = !!(g === 'h' ? h : b)[x.id];
            if (on === x.need) { pts++; return; }
            const name = g === 'h' ? x.k : x.k;
            notes.push({ ok: false, html: x.need ? `Не хватает важного ${g === 'h' ? 'заголовка' : 'поля'}. ${x.miss}` : `<code>${esc(name)}</code> — лишнее. ${x.extra}` });
          }));
          const total = HDR.length + BODY.length, score = pts / total;
          const critical = h.auth && h.idem && !b.clientId;
          return { ok: score >= 0.9 && !!critical, score, summary: `Запрос собран верно на ${Math.round(score * 100)}%.`, notes: notes.slice(0, 7), vera: critical ? null : 'Два обязательных правила записи: сервер знает клиента только из токена, а любой POST, который могут повторить, несёт ключ идемпотентности.' };
        },
        explain: `<p>Главный принцип: <b>клиент присылает только то, что вправе решать сам</b>. Кто записывается — из токена. Какое занятие — из пути. Цена, статус, право на занятие — считает сервер. Всё остальное — путь к подмене: пентест «Пульса» нашёл чужие записи именно так.</p>
          <p><code>Idempotency-Key</code> генерирует приложение один раз на нажатие кнопки и повторяет его при каждом ретрае. Сервер хранит ответ по ключу 24 часа: повтор вернёт тот же <code>201</code> и ту же запись.</p>
          <p><code>If-Match</code> понадобится позже — для <code>PATCH /me</code>, где есть версия, с которой можно сравнить.</p>`,
        report: ans => `Заголовки: ${HDR.filter(x => (ans.h || {})[x.id]).map(x => x.k).join(', ') || '—'}\nПоля тела: ${BODY.filter(x => (ans.b || {})[x.id]).map(x => x.k).join(', ') || '—'}`
      },
      {
        id: 'codes', title: 'Коды ответа',
        simple: { icon: '🚦', plain: 'Код ответа — короткий итог, по которому программа решает, что делать дальше: показать, повторить, перелогиниться или сдаться.', analogy: 'Как ответы на ресепшене: «записали» (201), «номерок, зайдите позже» (202), «покажите пропуск» (401), «вам сюда нельзя» (403), «мест нет» (409), «абонемент не тот» (422), «слишком часто, подождите» (429), «касса не отвечает» (504).', tech: '2xx — успех. 4xx — ошибка клиента: повтор того же запроса не поможет (кроме 429 и 409 «ещё обрабатывается»). 5xx — проблема на стороне сервера или за ним: повтор с паузой может помочь.' },
        lead: ui.brief({
          situation: `Код ответа — короткий итог из трёх цифр. По нему программа решает, что делать: показать «готово», повторить запрос, попросить войти заново или сдаться. Пример: ФитПасс повторяет запрос, если код начинается на 5, и не повторяет, если на 4. Перепутаете — получите лавину повторов или потерянный визит.`,
          todo: [
            `Для каждой из 15 ситуаций выберите код в выпадающем списке.`,
            `Сначала решите, чья это проблема: всё хорошо (2xx), ошибся клиент (4xx) или сломалось у нас или у сервиса за нами (5xx). Потом выбирайте точный код.`,
            `Нажмите «Проверить». Нужно не меньше 80 % верных.`
          ],
          lookTitle: `Перевод названий кодов`,
          look: `<p>Created — создано; Accepted — принято; No Content — без содержимого; Bad Request — запрос не прочитать; Unauthorized — не знаю, кто вы; Forbidden — запрещено; Not Found — не найдено; Conflict — конфликт; Precondition Failed — условие не выполнено; Unsupported Media Type — формат не поддерживается; Unprocessable Content — не могу обработать; Too Many Requests — слишком много запросов; Bad Gateway — плохой ответ от сервиса за нами; Service Unavailable — сервис недоступен; Gateway Timeout — сервис за нами не ответил вовремя.</p><p>Коварнее всего пары похожих кодов: 401 / 403 / 404, 409 / 422 / 412, 400 / 422, 502 / 504, 429 / 503. После проверки у строк появятся пояснения.</p>`
        }),
        blank: () => ({ m: {} }),
        reference: () => ({ m: Object.fromEntries(SIT.map(s => [s.id, s.ok[0]])) }),
        render(el, ctx) {
          ui.match(el, { rows: SIT.map(s => ({ id: s.id, t: s.t })), choices: CODE_CH, value: ctx.ans.m, readonly: ctx.readonly, placeholder: 'Код…', reveal: matchReveal(SIT, ctx.ans.m || {}, ctx.result || ctx.readonly), onChange: m => { ctx.save({ m }); if (m.foreign) ctx.decide('Код на чужую запись', m.foreign); } });
        },
        check(ans) {
          const r = matchScore(SIT, ans.m || {});
          return { ok: r.score >= 0.8, score: r.score, summary: `Коды выбраны верно: ${Math.round(r.score * 100)}%.`, notes: r.notes.slice(0, 7) };
        },
        explain: `<p>Пять тонких пар, которые путают даже опытные:</p>
          <ul class="checks">
            <li><b>401 / 403 / 404.</b> Не знаем, кто вы — 401. Знаем, но нельзя — 403. Чужой объект — 404, чтобы не подтверждать, что он существует.</li>
            <li><b>409 / 422 / 412.</b> Конфликт с текущим состоянием (места кончились) — 409. Запрос нарушает правило сам по себе (абонемент не тот) — 422. Не выполнено условие <code>If-Match</code> — 412.</li>
            <li><b>400 / 422.</b> Не можем прочитать — 400. Прочитали, но по правилам нельзя — 422.</li>
            <li><b>502 / 504.</b> Сервис за нами ответил мусором — 502, не ответил вовсе — 504.</li>
            <li><b>429 / 503.</b> Вы шлёте слишком часто — 429. Мы сами недоступны — 503. Оба с <code>Retry-After</code>.</li>
          </ul>
          <p>Для ФитПасса это вопрос денег: 4xx он не повторяет, 5xx — повторяет. Неверный класс кода — это либо лавина повторов, либо потерянный визит.</p>`,
        report: ans => SIT.map(s => `- ${s.t} → ${(ans.m || {})[s.id] || '—'}`).join('\n')
      },
      {
        id: 'problem', title: 'Ошибка по RFC 9457',
        simple: { icon: '🧾', plain: 'У ошибок должен быть единый бланк: что случилось — для программы, и что сказать человеку — для экрана.', analogy: 'Как акт о проблеме в клубе: номер типа проблемы по справочнику, короткий заголовок, подробности, где случилось. Любой администратор в любом клубе поймёт его одинаково. А «ошибка!!!» на стикере не поймёт никто.', tech: 'RFC 9457, <code>application/problem+json</code>: <code>type</code> — URI вида проблемы (по нему ветвится код клиента), <code>title</code>, <code>status</code>, <code>detail</code> — для человека, <code>instance</code>, плюс свои поля (например, <code>_links</code>). Без стектрейсов и SQL.' },
        lead: ui.brief({
          situation: `На «Йогу для начинающих» записаны все 20 человек. Анна жмёт «Записаться» — сервер должен отказать. Как оформить отказ? Есть стандарт RFC 9457 — единый бланк ошибки в формате <code>application/problem+json</code>. В бланке: <code>type</code> — код проблемы для программы, <code>title</code> и <code>detail</code> — текст для человека, <code>status</code> — код ответа.`,
          todo: [
            `Посмотрите четыре варианта ответа A, B, C, D и выберите правильный.`,
            `Ниже — четыре плохих ответа. Для каждого выберите в списке его главную проблему.`,
            `Нажмите «Проверить». Нужно выбрать верный вариант и найти главную проблему хотя бы в 3 ответах из 4.`
          ],
          lookTitle: `На что смотреть в ответе`,
          look: `Проверьте три вещи. <b>Код</b>: честный ли он? Ошибка не должна приходить с кодом 200 «всё хорошо». <b>Content-Type</b>: поймёт ли программа, что это бланк ошибки? <b>Тело</b>: есть ли код проблемы для программы, понятный текст для человека и подсказка, что делать дальше. И нет ли там лишнего — например, внутренних сообщений базы данных.`
        }),
        blank: () => ({ pick: [], m: {} }),
        reference: () => ({ pick: [2], m: Object.fromEntries(BAD.map(x => [x.id, x.ok[0]])) }),
        render(el, ctx) {
          const vars = mkEl(el, 'grid2'); vars.style.alignItems = 'start';
          vars.innerHTML = VARIANTS.map(v => `<div class="stack tight" style="min-width:0"><div class="eyebrow">Вариант ${v.id}</div>${ui.http(v.http)}</div>`).join('');
          const qz = mkEl(el); qz.style.marginTop = '12px';
          ui.quiz(qz, Object.assign({}, PICK, { shuffle: false, value: ctx.ans.pick, readonly: ctx.readonly, reveal: ctx.result || ctx.readonly, onChange: v => { ctx.ans.pick = v; ctx.save(); } }));
          const t2 = mkEl(el); t2.innerHTML = '<div class="eyebrow" style="margin-top:12px">Что не так с этими ответами</div>';
          const mt = mkEl(el);
          ui.match(mt, { rows: BAD.map(x => ({ id: x.id, t: x.t })), choices: BAD_CH, value: ctx.ans.m, readonly: ctx.readonly, placeholder: 'Главная проблема…', reveal: matchReveal(BAD, ctx.ans.m || {}, ctx.result || ctx.readonly), onChange: m => { ctx.ans.m = m; ctx.save(); } });
        },
        check(ans) {
          const q = ui.quizScore(PICK, ans.pick);
          const r = matchScore(BAD, ans.m || {});
          const notes = [q.ok ? { ok: true, html: 'Правильный ответ на «мест нет» выбран.' } : { ok: false, html: (ans.pick || []).length ? 'Выбранный ответ на «мест нет» с изъяном — пояснение у варианта.' : 'Выберите правильный ответ на «мест нет».' }].concat(r.notes);
          const score = q.score * 0.4 + r.score * 0.6;
          return { ok: q.ok && r.score >= 0.75, score, summary: `Ошибки разобраны на ${Math.round(score * 100)}%.`, notes: notes.slice(0, 6) };
        },
        explain: `<p>Хорошая ошибка отвечает на три вопроса: <b>что случилось</b> (код и <code>type</code> — для программы), <b>что сказать человеку</b> (<code>title</code>, <code>detail</code>) и <b>что делать дальше</b> (<code>_links</code> на лист ожидания, <code>Retry-After</code>).</p>
          ${ui.code('HTTP/1.1 409 Conflict\nContent-Type: application/problem+json\n\n{\n  [[ok]]"type": "https://api.puls.fit/problems/class-full"[[/]],\n  "title": "Мест нет",\n  "status": 409,\n  "detail": "На занятие «Йога для начинающих» 5 октября в 09:00 записаны все 20 человек.",\n  "instance": "/v1/classes/4b1f0c3e-…/bookings",\n  [[hl]]"_links": { "join-waitlist": { "href": "/v1/classes/4b1f0c3e-…/bookings", "method": "POST" } }[[/]]\n}', 'http', 'Эталон «Пульса»')}
          <p>Приложение ветвится по <code>type</code>, а не по тексту: текст переведут или поправят, а <code>type</code> — часть контракта. Стектрейс пишем в свой лог с <code>instance</code> или id трассировки, наружу — никогда.</p>`,
        report: ans => `Выбран вариант: ${(ans.pick || []).map(i => PICK.options[i].t).join(', ') || '—'}\n` + BAD.map(x => `- ${x.t.replace(/<[^>]+>/g, '')} → ${(BAD_CH.find(c => c.v === (ans.m || {})[x.id]) || { t: '—' }).t}`).join('\n')
      },
      {
        id: 'formats', title: 'Форматы данных',
        simple: { icon: '📐', plain: 'Мелочи формата — время, деньги, неизвестные значения, пустые поля — ломают системы чаще, чем сложная логика.', analogy: 'Как записка «встречаемся в 9»: в Москве или в Екатеринбурге? И квитанция «5400» — рублей или копеек? Договориться о формате — как договориться о времени и валюте в договоре.', tech: 'Время — ISO 8601 со смещением. Деньги — целые копейки + валюта. Клиенты — терпимые читатели (неизвестные поля и enum не роняют). В <code>merge-patch+json</code> (RFC 7396) <code>null</code> удаляет поле, отсутствие поля — не трогает.' },
        lead: ui.brief({
          situation: `Через год у «Пульса» клубы в Казани и Екатеринбурге, а в Екатеринбурге время на 2 часа впереди Москвы. Абонемент стоит 5 400 ₽ — а в ответе «5400»: это рубли или копейки? Старые версии приложения живут у клиентов месяцами и не знают новых статусов. Такие мелочи ломают системы чаще, чем сложная логика.`,
          todo: [
            `Ответьте на четыре вопроса: время, деньги, незнакомый статус, пустое поле. В первом можно выбрать несколько вариантов.`,
            `Ниже своими словами запишите правила форматов для гайда API «Пульса» (от 80 символов): какие правила и что сломается без них.`,
            `Проверьте ответ с Верой или сверьте с эталоном. Засчитается, если вопросы верны хотя бы на 75 % и правила приняты.`
          ],
          lookTitle: `Как читать варианты`,
          look: `<code>2026-10-05T09:00:00+05:00</code> — формат ISO 8601: дата, буква T, время и сдвиг от мирового времени. <code>+05:00</code> — Екатеринбург, <code>+03:00</code> — Москва, <code>Z</code> на конце — само мировое время (UTC). <code>null</code> в JSON значит «пусто, значения нет». После проверки под каждым вариантом появится пояснение.`
        }),
        blank: () => ({ q: [[], [], [], []], j: {} }),
        reference: () => ({ q: FMT.map(f => f.options.map((o, i) => o.ok ? i : -1).filter(i => i >= 0)), j: { text: FMT_REF, self: FMT_RUBRIC.map(() => true) } }),
        render(el, ctx) {
          const q = ctx.ans.q = ctx.ans.q || [[], [], [], []];
          FMT.forEach((f, i) => {
            const d = mkEl(el, 'card flat');
            if (i) d.style.marginTop = '10px';
            ui.quiz(d, Object.assign({}, f, { shuffle: !ctx.readonly, value: q[i], readonly: ctx.readonly, reveal: ctx.result || ctx.readonly, onChange: v => { q[i] = v; ctx.save(); } }));
          });
          const jt = mkEl(el); jt.style.marginTop = '14px';
          ui.justify(jt, { id: 'rc-formats', q: 'Какие правила форматов вы запишете в гайд API «Пульса» и почему? Что сломается, если их нарушить?', rubric: FMT_RUBRIC, reference: FMT_REF, value: ctx.ans.j, readonly: ctx.readonly, minLen: 80, onChange: j => { ctx.ans.j = j; ctx.save(); ctx.decide('Правила форматов API', j.text || ''); } });
        },
        check(ans) {
          const rs = FMT.map((f, i) => ui.quizScore(f, (ans.q || [])[i]));
          const avg = rs.reduce((s, r) => s + r.score, 0) / FMT.length;
          const js = ui.justifyScore(ans.j);
          const names = ['время', 'деньги', 'неизвестный статус', 'null и отсутствие поля'];
          const notes = rs.map((r, i) => ({ ok: r.ok, html: `Вопрос про ${names[i]}: ${r.ok ? 'верно' : ((ans.q || [])[i] || []).length ? 'есть ошибки — пояснения у вариантов' : 'не отвечено'}.` }));
          notes.push(js >= 0.5 ? { ok: true, html: 'Правила сформулированы.' } : { ok: false, html: 'Напишите правила (от 80 символов) и проверьте их с Верой или сверьте с эталоном сами.' });
          return { ok: avg >= 0.75 && js >= 0.5, score: avg * 0.7 + js * 0.3, summary: `Вопросы: ${Math.round(avg * 100)}%, правила: ${Math.round(js * 100)}%.`, notes };
        },
        explain: `<p>Каждое из этих правил — будущий инцидент, если его нарушить:</p>
          <ul class="checks">
            <li><b>Время без смещения</b> — клиент в Екатеринбурге приходит на два часа позже. Через год у «Пульса» три пояса.</li>
            <li><b>Деньги дробным числом</b> — копейки теряются при округлении, сверка с 1С расходится, Ирина неделю ищет разницу.</li>
            <li><b>Нетерпимый клиент</b> — новый статус ломает старые приложения, а они живут у клиентов месяцами.</li>
            <li><b>null = отсутствие</b> — нельзя удалить необязательный email или, хуже, PATCH стирает поля, которые клиент не прислал.</li>
          </ul>`,
        report: ans => FMT.map((f, i) => `- ${f.q.replace(/<[^>]+>/g, '')}: ${((ans.q || [])[i] || []).map(k => f.options[k].t.replace(/<[^>]+>/g, '')).join('; ') || '—'}`).join('\n') + `\n\nПравила: ${(ans.j && ans.j.text) || '—'}`
      }
    ]
  });
})();
