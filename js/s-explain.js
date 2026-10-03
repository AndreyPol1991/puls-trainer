/* Вводные разделы «Как это работает» перед практикой. Встают первым подходом в свои тренировки:
   hard-1 (повторы, гонка), hard-2 (HATEOAS), hard-3 (ретраи, вебхуки), graphql, styles (gRPC/Protobuf, SSE).
   Без проверки: преподаватель рассказывает по схеме, студенты сами щёлкают шаги и варианты. */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc;

  document.head.insertAdjacentHTML('beforeend', `<style>
    .ex-phone { width: 230px; max-width: 100%; border: 2px solid var(--border-strong); border-radius: 26px; padding: 14px 12px 18px; background: var(--surface); display: grid; gap: 10px; justify-self: center; }
    .ex-phone .bar { height: 5px; width: 60px; border-radius: 5px; background: var(--border-strong); justify-self: center; }
    .ex-phone .ttl { font: 600 15px/1.3 var(--f-brand); }
    .ex-phone .btn { width: 100%; white-space: normal; }
    .ex-tl { position: relative; height: 56px; margin: 6px 40px 0; }
    .ex-tl .axis { position: absolute; left: 0; right: 0; top: 46px; height: 4px; border-radius: 4px; background: var(--surface-3); }
    .ex-tl .free { position: absolute; top: 46px; height: 4px; border-radius: 4px; background: var(--ok); }
    .ex-tl .mk { position: absolute; top: 0; height: 50px; transform: translateX(-50%); display: flex; flex-direction: column; justify-content: flex-end; align-items: center; font: 500 11px/1.2 var(--f-mono); color: var(--text-2); white-space: nowrap; text-align: center; }
    .ex-tl .mk::after { content: ""; display: block; width: 2px; height: 10px; margin-top: 3px; background: var(--border-strong); }
    .ex-tl .mk.now { color: var(--accent); font-weight: 700; z-index: 1; } .ex-tl .mk.now::after { background: var(--accent); }
    .ex-tl .mk.edge { color: var(--warn); } .ex-tl .mk.edge::after { background: var(--warn); }
    .ex-lanes { display: grid; gap: 6px; }
    .ex-lane { display: grid; grid-template-columns: 70px minmax(0, 1fr); gap: 8px; align-items: center; font-size: 13px; }
    .ex-axis { position: relative; height: 24px; border-bottom: 1px dashed var(--border-strong); }
    .ex-dot { position: absolute; top: 5px; width: 12px; height: 12px; margin-left: -6px; border-radius: 50%; background: var(--bad); }
    .ex-dot.ok { background: var(--ok); }
    .ex-down { position: absolute; top: 0; bottom: 0; background: var(--bad-soft); border-left: 1px solid var(--bad); border-right: 1px solid var(--bad); }
    .ex-bytes { font: 13px/1.7 var(--f-mono); display: grid; gap: 6px; }
    .ex-bytes .b { display: inline-block; padding: 0 4px; margin: 1px; border-radius: 4px; background: var(--surface-3); }
    .ex-bytes .b.t { background: var(--violet-soft); color: var(--violet); } .ex-bytes .b.l { background: var(--info-soft); color: var(--info); }
    .ex-tree { display: grid; gap: 4px; font-size: 14px; }
    .ex-tree label { display: flex; gap: 8px; align-items: center; cursor: pointer; }
    .ex-tree input { accent-color: var(--accent); width: 16px; height: 16px; flex: none; }
    .ex-stream { max-height: 260px; overflow: auto; }
  </style>`);

  // ---------- общий проигрыватель сценариев ----------
  // cfg: { scenarios:[{id, t, lanes, steps, sum, sumKind, hint}] }
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
  const L = (id, t, sub) => ({ id, t, sub });

  // ================= hard-1: повтор и идемпотентность =================
  const PAY_LANES = [L('app', 'Приложение', 'телефон Анны'), L('api', 'API «Пульса»', 'наш сервер'), L('db', 'База', 'PostgreSQL'), L('psp', 'ПэйПоинт', 'платёжный сервис')];
  const howRetry = {
    id: 'how-retry', covers: ['double-pay', 'key-rules'], title: 'Как это работает: повтор запроса и идемпотентность', free: true, noReset: true,
    simple: {
      icon: '🛗', plain: 'Идемпотентная операция — та, которую можно повторить сколько угодно раз, а результат будет как от одного раза.',
      analogy: 'Кнопка вызова лифта: жмите хоть десять раз — приедет один лифт. А кнопка «оплатить» без защиты — как кофейный автомат, который на каждое нажатие списывает деньги и наливает новую чашку.',
      tech: 'GET, PUT и DELETE идемпотентны по определению (RFC 9110). POST — нет: каждый вызов создаёт новое. Для POST идемпотентность делают ключом: приложение придумывает уникальный <code>Idempotency-Key</code> на операцию и шлёт его в каждом повторе; сервер запоминает ключ и свой ответ.'
    },
    lead: ui.brief({
      situation: 'Анна покупает абонемент за 5 400 ₽, сидя в метро. Приложение отправило оплату, сервер всё сделал, но ответ не дошёл: поезд въехал в тоннель. Приложение не знает, прошла ли оплата, и через 10 секунд повторяет запрос. Так устроены почти все приложения и партнёры: нет ответа — повторить.',
      todo: ['Вариант «Повтор без ключа»: нажимайте «Шаг →» и читайте пояснение под схемой после каждого шага.', 'Переключитесь на «Повтор с ключом» и пройдите так же.', 'Сравните итог: сколько раз списали деньги и почему сервер во втором случае не списал повторно.'],
      look: 'Колонки — участники. Стрелка — сообщение, пунктир — ответ, красный крест — сообщение потерялось по дороге. Стрелка, которая возвращается в ту же колонку, — действие внутри участника.'
    }),
    render(el) {
      walk(el, {
        scenarios: [
          {
            id: 'nokey', t: 'Повтор без ключа', lanes: PAY_LANES, sumKind: 'bad',
            sum: 'Списали дважды: 10 800 ₽ вместо 5 400 ₽. Сервер ни в чём не ошибся — он просто не мог отличить повтор от второй покупки.',
            steps: [
              { from: 'app', to: 'api', t: 'POST …/payments', note: 'Анна нажала «Оплатить». Приложение отправляет запрос на сервер «Пульса». <b>Ключа в запросе нет.</b>' },
              { from: 'api', to: 'db', t: 'платёж №1: ждёт', note: 'Сервер записывает в базу: создан платёж №1, статус «ожидает».' },
              { from: 'api', to: 'psp', t: 'списать 5 400 ₽', note: 'Сервер просит ПэйПоинт списать деньги с карты.' },
              { from: 'psp', to: 'api', t: 'списано', reply: true, kind: 'ok', note: 'ПэйПоинт списал 5 400 ₽.' },
              { from: 'api', to: 'app', t: '201 Created', lost: true, kind: 'bad', note: 'Сервер отправил «готово», но связь пропала. Приложение ждёт ответ, не дожидается и считает, что запрос не удался.' },
              { from: 'app', to: 'api', t: 'POST …/payments\n(повтор)', kind: 'warn', note: 'Приложение повторяет тот же запрос. Для сервера это <b>новая</b> покупка: в запросе нет ничего, что отличило бы повтор от второй оплаты.' },
              { from: 'api', to: 'db', t: 'платёж №2: ждёт', kind: 'bad', note: 'Вторая запись о платеже.' },
              { from: 'api', to: 'psp', t: 'списать 5 400 ₽', kind: 'bad', note: 'Второе списание.' },
              { from: 'psp', to: 'api', t: 'списано', reply: true, kind: 'bad', note: 'С карты Анны ушло уже 10 800 ₽.' },
              { from: 'api', to: 'app', t: '201 Created', reply: true, note: 'Анна видит «Оплачено» и не знает, что заплатила дважды. Узнает из SMS банка — и напишет в поддержку.' }
            ]
          },
          {
            id: 'key', t: 'Повтор с ключом', lanes: PAY_LANES, sumKind: 'ok',
            sum: 'Одно списание. Ключ — как номерок в гардеробе: по одному номерку выдают одно пальто, сколько бы раз вы его ни показали.',
            steps: [
              { from: 'app', to: 'app', t: 'ключ = 7f3c…b31', note: 'Перед первой отправкой приложение придумывает случайный ключ операции — <code>Idempotency-Key</code> — и <b>запоминает</b> его. В любом повторе этой же оплаты будет тот же ключ.' },
              { from: 'app', to: 'api', t: 'POST …/payments\nключ 7f3c…', note: 'Запрос уходит с ключом в заголовке <code>Idempotency-Key</code>.' },
              { from: 'api', to: 'db', t: 'ключ новый?\nзаписать «в работе»', note: 'Сервер ищет ключ в таблице <code>idempotency_key</code>. Ключа нет — это первый раз. Сервер записывает ключ со статусом «в работе». Первичный ключ таблицы не даст записать тот же ключ дважды, даже если два запроса придут одновременно.' },
              { from: 'api', to: 'psp', t: 'списать 5 400 ₽\nIdempotence-Key', note: 'Тот же ключ сервер передаёт в ПэйПоинт. Тогда и ПэйПоинт не спишет дважды, если повторять придётся уже нашему серверу.' },
              { from: 'psp', to: 'api', t: 'списано', reply: true, kind: 'ok', note: 'Деньги списаны один раз.' },
              { from: 'api', to: 'db', t: 'сохранить ответ\n201 к ключу', note: 'Рядом с ключом сервер сохраняет готовый ответ: код 201 и тело.' },
              { from: 'api', to: 'app', t: '201 Created', lost: true, kind: 'bad', note: 'Ответ снова теряется в тоннеле.' },
              { from: 'app', to: 'api', t: 'повтор\nтот же ключ', kind: 'warn', note: 'Приложение повторяет запрос — <b>с тем же ключом</b>.' },
              { from: 'api', to: 'db', t: 'ключ есть →\nвзять ответ', kind: 'ok', note: 'Сервер находит ключ: операция уже выполнена. Ничего не делает заново — достаёт сохранённый ответ.' },
              { from: 'api', to: 'app', t: '201 (тот же)', reply: true, kind: 'ok', note: 'Анна получает тот же ответ, что и в первый раз. Списание одно.' }
            ]
          }
        ]
      });
    }
  };

  // ================= hard-1: гонка =================
  const RACE_LANES = [L('a', 'Запрос Анны', 'поток сервера 1'), L('b', 'Запрос Петра', 'поток сервера 2'), L('db', 'PostgreSQL', 'занятие: 19 из 20')];
  const howRace = {
    id: 'how-race', covers: ['last-bike'], title: 'Как это работает: гонка за последнее место', free: true, noReset: true,
    simple: {
      icon: '🚲', plain: 'Гонка — когда двое одновременно проверяют «есть ли место?», оба видят «да» и оба занимают.',
      analogy: 'Последний велосипед в сайкл-студии: двое заходят с разных дверей, оба видят свободный велосипед и оба идут к нему. Кто-то останется стоять.',
      tech: 'Ошибка «проверил, потом сделал» (check-then-act): между проверкой и действием вклинивается другой запрос. Лечится, когда проверка и изменение — одна атомарная операция в базе: условный <code>UPDATE … WHERE booked_count &lt; capacity</code>, блокировка строки <code>SELECT … FOR UPDATE</code> или ограничение в схеме.'
    },
    lead: ui.brief({
      situation: 'Воскресенье, 20:00 — открылась запись на неделю. На сайкл в понедельник 19:00 занято 19 мест из 20. Анна и Пётр нажимают «Записаться» в одну и ту же секунду. Сервер обрабатывает оба запроса параллельно, в разных потоках.',
      todo: ['Вариант «Проверка, потом вставка»: пройдите по шагам и найдите момент, где всё пошло не так.', 'Вариант «Атомарный UPDATE»: пройдите так же и посмотрите, что получил Пётр.', 'Подумайте: почему во втором случае двое не могут попасть на одно место, даже если запросы пришли в одну миллисекунду.'],
      look: 'Две левые колонки — два запроса на сервере, правая — база. Важен порядок стрелок сверху вниз: кто что успел прочитать до того, как другой записал.'
    }),
    render(el) {
      walk(el, {
        scenarios: [
          {
            id: 'check', t: 'Проверка, потом вставка', lanes: RACE_LANES, sumKind: 'bad',
            sum: '21 человек на 20 велосипедов. Каждый запрос по отдельности логичен, но между проверкой и записью вклинился другой.',
            steps: [
              { from: 'a', to: 'db', t: 'сколько записано?', note: 'Запрос Анны спрашивает базу: <code>SELECT count(*) …</code>' },
              { from: 'db', to: 'a', t: '19 — место есть', reply: true, note: '19 из 20 — для Анны место есть.' },
              { from: 'b', to: 'db', t: 'сколько записано?', note: 'В ту же миллисекунду запрос Петра спрашивает то же самое.' },
              { from: 'db', to: 'b', t: '19 — место есть', reply: true, kind: 'warn', note: 'Анна ещё ничего не записала, поэтому база честно отвечает 19. Оба запроса уверены, что место свободно.' },
              { from: 'a', to: 'db', t: 'записать Анну', note: 'Запрос Анны вставляет запись. Теперь записано 20.' },
              { from: 'b', to: 'db', t: 'записать Петра', kind: 'bad', note: 'Запрос Петра «уже проверил», что место есть, и тоже вставляет запись. Повторно он не проверяет.' },
              { from: 'a', to: 'db', t: '21 человек на 20 мест', box: true, kind: 'bad', note: 'В понедельник в 19:00 двое придут к одному велосипеду.' }
            ]
          },
          {
            id: 'atomic', t: 'Атомарный UPDATE', lanes: RACE_LANES, sumKind: 'ok',
            sum: '20 из 20 — и никто не сидит вдвоём на одном велосипеде. Защиту держит сама база, а не «аккуратность» кода.',
            steps: [
              { from: 'a', to: 'db', t: '+1, если меньше 20', note: 'Запрос Анны одной командой говорит базе: «увеличь счётчик записанных, <b>если</b> он меньше вместимости»:<br><code>UPDATE class_session SET booked_count = booked_count + 1 WHERE id = 7 AND booked_count &lt; capacity</code><br>Проверка и изменение — одно действие. На время команды база блокирует строку этого занятия.' },
              { from: 'b', to: 'db', t: '+1, если меньше 20', note: 'Запрос Петра приходит с такой же командой. Строку держит команда Анны — команда Петра ждёт доли миллисекунды.' },
              { from: 'db', to: 'a', t: 'изменена 1 строка\nстало 20', reply: true, kind: 'ok', note: 'Команда Анны выполнилась: счётчик стал 20. В той же транзакции сервер вставляет запись Анны.' },
              { from: 'db', to: 'b', t: 'изменено 0 строк', reply: true, kind: 'warn', note: 'Теперь выполняется команда Петра. Условие «меньше 20» уже ложно — база ничего не меняет и отвечает «изменено 0 строк».' },
              { from: 'b', to: 'b', t: '409 «Мест нет»', kind: 'info', note: 'Сервер понимает: места нет. Пётр получает честный ответ «мест нет» и предложение встать в лист ожидания.' }
            ]
          }
        ]
      });
    }
  };

  // ================= hard-2: HATEOAS =================
  const HS = {
    free: { t: 'Не записан, места есть', now: '14:00', who: 'Анна не записана', seats: 'свободно 6 из 20', links: { book: { href: '/v1/classes/c-19/bookings', method: 'POST', title: 'Записаться' } } },
    full: { t: 'Не записан, мест нет', now: '14:00', who: 'Анна не записана', seats: 'свободно 0 из 20', links: { 'join-waitlist': { href: '/v1/classes/c-19/bookings', method: 'POST', title: 'Встать в лист ожидания' } } },
    early: { t: 'Записан, сейчас 14:00', now: '14:00', who: 'Анна записана', seats: 'свободно 0 из 20', links: { cancel: { href: '/v1/bookings/b-71/cancellation', method: 'POST', title: 'Отменить бесплатно' } } },
    late: { t: 'Записан, сейчас 17:30', now: '17:30', who: 'Анна записана', seats: 'свободно 0 из 20', links: { cancel: { href: '/v1/bookings/b-71/cancellation', method: 'POST', title: 'Отменить — будет прогул', warning: 'late-cancel' } } }
  };
  const HATE_LANES = [L('app', 'Приложение', 'телефон Анны'), L('api', 'API «Пульса»', 'сервер'), L('db', 'База', 'занятие, запись')];
  function hateTimeline(now) {
    const pos = t => { const [h, m] = t.split(':').map(Number); return ((h * 60 + m) - 13 * 60) / (6 * 60) * 100; };
    return `<div class="ex-tl" aria-label="Линия времени: занятие в 19:00, бесплатная отмена до 17:00, сейчас ${now}">
      <div class="axis"></div><div class="free" style="left:0;width:${pos('17:00')}%"></div>
      <span class="mk" style="left:${pos('13:00')}%">13:00</span><span class="mk edge" style="left:${pos('17:00')}%">17:00<br>до сюда бесплатно</span><span class="mk" style="left:${pos('19:00')}%">19:00<br>сайкл</span><span class="mk now" style="left:${pos(now)}%">сейчас ${now}</span></div>`;
  }
  const howHate = {
    id: 'how-hateoas', covers: ['hateoas-live', 'why-hateoas'], title: 'Как это работает: HATEOAS', free: true, noReset: true,
    simple: {
      icon: '🧭', plain: 'Сервер присылает не только данные, но и список того, что с ними сейчас можно сделать. Приложение рисует кнопки по этому списку и само правил не считает.',
      analogy: 'Табло в лифте: подсвечены только этажи, куда сейчас можно поехать. Лифт сам решает, что разрешено, вы просто жмёте подсвеченную кнопку. Не нужно помнить, что на 13-й этаж по выходным не возят.',
      tech: 'HATEOAS — Hypermedia As The Engine Of Application State, 3-й уровень зрелости REST по Ричардсону. В ответе есть блок <code>_links</code>: имя действия → адрес и метод. Правила (можно ли отменить бесплатно, есть ли места) живут на сервере; клиент только показывает и переходит по ссылкам.'
    },
    lead: ui.brief({
      situation: 'Сайкл в 19:00, вместимость 20 мест. Правило клуба: бесплатно отменить запись можно не позже чем за 2 часа до начала, то есть до 17:00. Позже — «прогул» (2 прогула за месяц — блокировка записи на неделю). Анна открывает в приложении карточку занятия. Какие кнопки ей показать, зависит от времени, мест и того, записана ли она.',
      todo: ['Переключайте состояния над телефоном: «не записан, места есть», «мест нет», «записан, 14:00», «записан, 17:30».', 'Для каждого смотрите три вещи: где «сейчас» на линии времени, что сервер положил в <code>_links</code>, какие кнопки нарисовал телефон.', 'Внизу пройдите по шагам схему: откуда приложение берёт кнопки и куда идёт нажатие.'],
      look: 'Линия времени: зелёный участок — когда отмена ещё бесплатна (до 17:00), зелёная метка — «сейчас». Справа — ответ сервера: кнопки на телефоне рисуются только из блока <code>_links</code>, по одной кнопке на ссылку.'
    }),
    render(el) {
      let st = 'free';
      el.innerHTML = `<div class="stack">
        <div class="row"><span class="small dim">Состояние:</span>${ui.seg('hs', Object.entries(HS).map(([v, s]) => ({ v, t: s.t })), st, 'accent')}</div>
        <div data-tl></div>
        <div class="grid2" style="align-items:start"><div data-phone></div><div data-json></div></div>
        <div data-note></div>
        <details class="more"><summary>Откуда сервер берёт ссылки и что будет, если Ольга поменяет правило</summary><div>
          <p>Ссылки не лежат готовыми в конфиге — сервер <b>вычисляет их заново при каждом запросе</b>: смотрит, сколько сейчас времени, записана ли Анна, есть ли места, — и применяет правила клуба. Число «2 часа» лучше держать в настройке (таблица или конфиг сервера).</p>
          ${ui.code('если Анна записана:\n    если сейчас раньше (начало − часы_бесплатной_отмены) → ссылка cancel «Отменить бесплатно»\n    иначе если занятие ещё не началось           → ссылка cancel «Отменить — будет прогул»\nесли Анна не записана:\n    если есть места → ссылка book\n    иначе           → ссылка join-waitlist\n\nчасы_бесплатной_отмены = 2      ← настройка', 'text', 'логика сервера, упрощённо')}
          ${ui.table(['Где живёт правило «2 часа»', 'Что нужно, чтобы стало «3 часа»', 'Когда увидят клиенты'], [['В настройке сервера', 'Поменять число', 'Со следующего запроса'], ['В коде сервера', 'Релиз сервера — один деплой командой «Пульса»', 'Через час'], ['В коде приложения (без HATEOAS)', 'Релиз приложения, проверка в App Store и Google Play', 'Через месяцы: старые версии живут у людей долго']])}
          <p><b>Два нюанса.</b> 1) Приложение заранее знает «словарь» ссылок (<code>book</code>, <code>cancel</code>, <code>join-waitlist</code>) и как рисовать каждую кнопку — сервер решает, <i>какие</i> из них показать. Совсем новое действие без релиза приложения не добавить: HATEOAS убирает релизы при смене <i>правил</i>, а не при новых функциях. 2) Ссылка — подсказка для интерфейса, а не пропуск: сервер всё равно перепроверяет правило, когда приходит запрос отмены.</p>
        </div></details>
        <div class="eyebrow">Как приложение пользуется ссылками</div><div data-seq></div></div>`;
      function draw() {
        const s = HS[st];
        const links = Object.assign({ self: { href: '/v1/classes/c-19' } }, s.links);
        const body = { id: 'c-19', title: 'Сайкл', startsAt: '2026-10-05T19:00:00+03:00', freeSpots: +s.seats.match(/\d+/)[0], myBooking: st === 'early' || st === 'late' ? { id: 'b-71', status: 'booked' } : null, _links: links };
        TR.$('[data-tl]', el).innerHTML = hateTimeline(s.now);
        TR.$('[data-json]', el).innerHTML = ui.http({ cap: 'ответ сервера', status: 200, headers: { 'Content-Type': 'application/hal+json' }, body });
        const btns = Object.entries(s.links).map(([rel, l]) => `<span class="btn ${l.warning ? 'danger' : 'primary'}" title="${esc(l.method + ' ' + l.href)}">${esc(l.title)}</span>`).join('');
        TR.$('[data-phone]', el).innerHTML = `<div class="ex-phone"><div class="bar"></div><div class="ttl">Сайкл · 19:00</div><div class="small muted">${esc(s.who)} · ${esc(s.seats)}</div>${btns}<div class="small dim">Кнопок ровно столько, сколько ссылок в <code>_links</code> (кроме self).</div></div>`;
        const why = {
          free: 'Анна не записана, места есть → сервер даёт ссылку <code>book</code>. Приложение рисует «Записаться».',
          full: 'Мест нет → вместо <code>book</code> сервер даёт <code>join-waitlist</code>. Приложение рисует «Встать в лист ожидания» — само про места ничего не считает.',
          early: 'Сейчас 14:00, до занятия 5 часов, граница бесплатной отмены 17:00 ещё не прошла → ссылка <code>cancel</code> без предупреждения: «Отменить бесплатно».',
          late: 'Сейчас 17:30 — граница 17:00 уже прошла. Сервер всё ещё разрешает отмену, но помечает её <code>warning: late-cancel</code>, и приложение пишет «будет прогул». Правило «2 часа» знает только сервер.'
        }[st];
        TR.$('[data-note]', el).innerHTML = ui.note('', 'Почему так', why + ' Если завтра Ольга решит, что бесплатная отмена — за 3 часа, изменится только сервер. Приложение ничего не считает само, поэтому даже старые версии на телефонах покажут правильную кнопку.');
      }
      ui.onSeg(el, (n, v) => { if (n === 'hs') { st = v; draw(); } });
      draw();
      ui.seq(TR.$('[data-seq]', el), {
        lanes: HATE_LANES, steps: [
          { from: 'app', to: 'api', t: 'GET /v1/classes/c-19', note: 'Анна открыла карточку занятия. Приложение просит у сервера данные о занятии.' },
          { from: 'api', to: 'db', t: 'время, места,\nзапись Анны', note: 'Сервер смотрит всё, от чего зависят правила: сколько мест, записана ли Анна, сколько времени до начала, нет ли блокировки за прогулы.' },
          { from: 'api', to: 'api', t: 'что сейчас можно?', note: 'Сервер сам применяет правила клуба и решает, какие действия Анне сейчас разрешены.' },
          { from: 'api', to: 'app', t: '200 + _links', reply: true, kind: 'ok', note: 'В ответ кладёт данные и блок <code>_links</code> — только разрешённые действия с адресами и методами.' },
          { from: 'app', to: 'app', t: 'кнопки из _links', note: 'Приложение рисует по кнопке на каждую ссылку. Нет ссылки <code>cancel</code> — нет кнопки «Отменить». Ничего не вычисляет.' },
          { from: 'app', to: 'api', t: 'POST href из cancel', note: 'Анна жмёт «Отменить». Приложение не собирает адрес само, а берёт <code>href</code> и <code>method</code> прямо из ссылки.' },
          { from: 'api', to: 'app', t: '201 отмена принята', reply: true, kind: 'ok', note: 'Сервер отвечает, что отмена принята (и был ли это прогул). В новом ответе снова будут ссылки — уже другие.' }
        ]
      });
    }
  };

  // ================= hard-3: таймауты, повторы, паузы =================
  const howRetries = {
    id: 'how-retries', covers: ['retries', 'rate'], title: 'Как это работает: таймауты, повторы и паузы', free: true, noReset: true,
    simple: {
      icon: '📞', plain: 'Таймаут — сколько мы готовы ждать ответа. Повтор — ещё одна попытка. Пауза между повторами нужна, чтобы не добить уставший сервис.',
      analogy: 'Звоните на ресепшен — занято. Если сто человек перезванивают каждую секунду, линия не освободится никогда. Если каждый ждёт 1, 2, 4 минуты, да ещё немного «как получится», звонки расходятся, и линия разгружается.',
      tech: 'Таймаут ограничивает ожидание. Повторять можно только идемпотентные операции или запросы с ключом идемпотентности. Экспоненциальная пауза: 1 с, 2 с, 4 с… Jitter — случайная добавка к паузе, чтобы клиенты не повторяли синхронно. Предохранитель (circuit breaker) после серии ошибок перестаёт звать сервис и сразу отвечает «недоступно», а через время пробует один запрос.'
    },
    lead: ui.brief({
      situation: 'SMS-шлюз «Пульса» лёг на 8 секунд — с 0-й по 8-ю. В этот момент шести клиентам нужно получить код входа: наш сервер шлёт запрос в шлюз, получает ошибку и повторяет. Шлюз выдерживает 30 запросов в секунду, а после подъёма ему тяжело принять всех разом.',
      todo: ['Переключайте стратегию повторов и смотрите на точки на шкале времени.', 'Сравните, сколько попыток прилетает в шлюз, пока он лежит, и сколько — в первую секунду после подъёма.', 'Внизу пройдите по шагам, как работает предохранитель.'],
      look: 'Каждая строка — один клиент. Шкала — секунды от 0 до 16. Красная зона — шлюз лежит. Точка — попытка отправить SMS: красная — ошибка, зелёная — успех. Чем гуще точки в красной зоне и в момент подъёма, тем хуже шлюзу.'
    }),
    render(el) {
      let mode = 'flat';
      el.innerHTML = `<div class="stack">
        <div class="row"><span class="small dim">Стратегия:</span>${ui.seg('rm', [{ v: 'flat', t: 'Повтор каждую секунду' }, { v: 'exp', t: 'Пауза 1-2-4 с' }, { v: 'jit', t: 'Пауза 1-2-4 с + разброс' }], mode, 'accent')}</div>
        <div data-chart></div><div data-stats class="grid3"></div><div data-mnote></div>
        <div class="eyebrow">Предохранитель (circuit breaker)</div><div data-seq></div></div>`;
      const DOWN = 8, MAX = 16, N = 6;
      function attempts(i) {
        const r = TR.rand('jit' + i), out = []; let t = 0, k = 0;
        while (t <= MAX) {
          const ok = t >= DOWN;
          out.push({ t, ok });
          if (ok) break;
          let pause = mode === 'flat' ? 1 : Math.pow(2, k);
          if (mode === 'jit') pause = pause * (0.5 + r());
          t = +(t + pause).toFixed(2); k++;
        }
        return out;
      }
      function draw() {
        const all = Array.from({ length: N }, (_, i) => attempts(i));
        const pct = t => (t / MAX * 100).toFixed(2) + '%';
        TR.$('[data-chart]', el).innerHTML = `<div class="ex-lanes">${all.map((a, i) => `<div class="ex-lane"><span class="small">Клиент ${i + 1}</span><div class="ex-axis"><div class="ex-down" style="left:0;width:${pct(DOWN)}"></div>${a.map(p => `<span class="ex-dot ${p.ok ? 'ok' : ''}" style="left:${pct(Math.min(p.t, MAX))}" title="${p.t.toFixed(1)} с"></span>`).join('')}</div></div>`).join('')}
          <div class="ex-lane"><span></span><div class="row between small dim tnum"><span>0 с</span><span>шлюз поднялся — 8 с</span><span>16 с</span></div></div></div>`;
        const inDown = all.reduce((s, a) => s + a.filter(p => !p.ok).length, 0);
        const firstOk = all.map(a => a[a.length - 1]).filter(p => p.ok);
        const burst = firstOk.filter(p => p.t < DOWN + 0.5).length;
        const last = Math.max(...firstOk.map(p => p.t));
        TR.$('[data-stats]', el).innerHTML = `<div class="stat"><span class="k">попыток в лежащий шлюз</span><span class="v ${inDown > 25 ? 'bad' : inDown > 15 ? 'warn' : 'ok'}">${inDown}</span><span class="s">каждая — лишняя нагрузка</span></div>
          <div class="stat"><span class="k">разом в первые 0,5 с после подъёма</span><span class="v ${burst >= 5 ? 'bad' : burst >= 3 ? 'warn' : 'ok'}">${burst} из ${N}</span><span class="s">толпа у только что открывшейся двери</span></div>
          <div class="stat"><span class="k">последний получил код</span><span class="v">${last.toFixed(1)} с</span><span class="s">цена паузы — чуть дольше ждать</span></div>`;
        TR.$('[data-mnote]', el).innerHTML = ui.note(mode === 'jit' ? 'ok' : mode === 'exp' ? 'warn' : 'bad', 'Что видно', {
          flat: 'Все шестеро стучатся каждую секунду: 48 бесполезных попыток в лежащий шлюз, а в момент подъёма — все разом. В жизни клиентов тысячи, и такой «шторм повторов» не даёт сервису подняться.',
          exp: 'Попыток стало намного меньше: паузы растут 1, 2, 4 с. Но все клиенты упали одновременно и повторяют <b>синхронно</b> — точки стоят ровными столбиками, и в момент подъёма шлюз снова получает всех разом.',
          jit: 'Паузы растут, а случайный разброс рассыпает столбики: клиенты приходят вразнобой, и поднявшийся шлюз принимает их постепенно. Цена — кто-то получит код на секунду-две позже.'
        }[mode]);
      }
      ui.onSeg(el, (n, v) => { if (n === 'rm') { mode = v; draw(); } });
      draw();
      ui.seq(TR.$('[data-seq]', el), {
        lanes: [L('api', 'API «Пульса»', 'хочет отправить SMS'), L('cb', 'Предохранитель', 'перед шлюзом'), L('sms', 'SMS-шлюз', 'лежит')],
        steps: [
          { from: 'api', to: 'cb', t: 'отправить SMS', note: 'Предохранитель закрыт (в обычном режиме) — пропускает запросы к шлюзу и считает ошибки.' },
          { from: 'cb', to: 'sms', t: 'запрос', note: 'Запрос уходит в шлюз. Таймаут 3 секунды: дольше не ждём.' },
          { from: 'sms', to: 'cb', t: 'таймаут / 503', reply: true, kind: 'bad', note: 'Ошибка. Потом ещё одна, и ещё. Предохранитель считает: 5 ошибок за 10 секунд.' },
          { from: 'cb', to: 'cb', t: 'разомкнуться на 30 с', kind: 'warn', note: 'Порог превышен — предохранитель <b>размыкается</b>: 30 секунд он вообще не зовёт шлюз.' },
          { from: 'api', to: 'cb', t: 'отправить SMS', note: 'Новый запрос на отправку.' },
          { from: 'cb', to: 'api', t: 'сразу: недоступно', reply: true, kind: 'info', note: 'Предохранитель отвечает мгновенно, не тратя 3 секунды ожидания и поток сервера. Приложение покажет «код придёт чуть позже», а SMS встанет в очередь отправки.' },
          { from: 'cb', to: 'sms', t: 'через 30 с: пробный', note: 'Через 30 секунд предохранитель пропускает <b>один</b> пробный запрос (полуоткрытое состояние).' },
          { from: 'sms', to: 'cb', t: 'успех', reply: true, kind: 'ok', note: 'Шлюз ответил — предохранитель замыкается, отправка идёт как обычно.' }
        ]
      });
    }
  };

  // ================= hard-3: вебхуки =================
  const WH_LANES = [L('app', 'Приложение', 'Анна'), L('api', 'API «Пульса»', '/webhooks/paypoint'), L('db', 'База', 'inbound_event'), L('psp', 'ПэйПоинт', 'платёжный сервис')];
  const howHooks = {
    id: 'how-webhooks', covers: ['webhooks', 'outbound'], title: 'Как это работает: вебхуки', free: true, noReset: true,
    simple: {
      icon: '📨', plain: 'Вебхук — внешняя система сама звонит вам, когда что-то случилось, а не вы ей каждую минуту.',
      analogy: 'Вы не звоните в химчистку каждый час «готово ли пальто?» — вы оставляете номер, и вам позвонят. Но звонок может прийти дважды, может не прийти вовсе, а может позвонить мошенник, который представится химчисткой.',
      tech: 'Вебхук — HTTP POST от внешней системы на ваш адрес. Доставка «хотя бы один раз» (at-least-once): дубли и нарушенный порядок — норма. Защиты: проверка подписи HMAC, дедупликация по id события, быстрый ответ 200 и обработка после ответа, сверка статуса, если вебхук не пришёл.'
    },
    lead: ui.brief({
      situation: 'Анна оплачивает абонемент. Деньги списывает ПэйПоинт, а наш сервер узнаёт результат не сразу: банк проверяет карту через 3-D Secure (код из SMS), это занимает от секунд до минут. Когда всё готово, ПэйПоинт сам присылает нам сообщение — вебхук.',
      todo: ['«Как приходит вебхук»: пройдите путь оплаты по шагам.', '«Пришёл дубль», «Подделка», «Вебхук не пришёл»: посмотрите, как сервер защищается в каждом случае.', 'Для каждого варианта ответьте себе: что случилось бы с абонементом и деньгами без этой защиты?'],
      look: 'Колонки — участники. Обратите внимание, кто начинает разговор: в вебхуке стрелка идёт от ПэйПоинта к нам, а не наоборот.'
    }),
    render(el) {
      walk(el, {
        scenarios: [
          {
            id: 'flow', t: 'Как приходит вебхук', lanes: WH_LANES, sumKind: 'ok',
            sum: 'Мы не ждём ПэйПоинт и не опрашиваем его — он сам сообщает о результате. Наша работа: проверить, что письмо настоящее, не обработать его дважды и ответить быстро.',
            steps: [
              { from: 'app', to: 'api', t: 'оплатить абонемент', note: 'Анна нажала «Оплатить».' },
              { from: 'api', to: 'psp', t: 'создать платёж', note: 'Наш сервер создаёт платёж в ПэйПоинте (с ключом идемпотентности).' },
              { from: 'psp', to: 'api', t: 'ссылка 3-D Secure', reply: true, note: 'ПэйПоинт отвечает ссылкой на страницу банка. Деньги ещё не списаны.' },
              { from: 'api', to: 'app', t: 'перейти к банку', reply: true, note: 'Приложение открывает страницу банка.' },
              { from: 'app', to: 'psp', t: 'код из SMS банка', note: 'Анна вводит код подтверждения. Это общение Анны с банком, наш сервер в нём не участвует.' },
              { from: 'psp', to: 'api', t: 'POST вебхук\npayment.succeeded', kind: 'info', note: 'ПэйПоинт <b>сам</b> вызывает наш адрес <code>/webhooks/paypoint</code>: «платёж прошёл». В заголовке — подпись, в теле — id события <code>evt_51</code>.' },
              { from: 'api', to: 'api', t: 'проверить подпись', note: 'Подпись — хеш тела, посчитанный общим секретом. Мы считаем его сами и сравниваем. Совпало — письмо правда от ПэйПоинта и его не меняли по дороге.' },
              { from: 'api', to: 'db', t: 'записать evt_51', note: 'Записываем id события в <code>inbound_event</code>. Первичный ключ не даст записать его второй раз.' },
              { from: 'api', to: 'psp', t: '200 OK', reply: true, kind: 'ok', note: 'Отвечаем сразу, не дожидаясь обработки. Если думать 12 секунд, ПэйПоинт решит, что мы недоступны, и пришлёт ещё раз.' },
              { from: 'api', to: 'db', t: 'абонемент → active', kind: 'ok', note: 'И уже после ответа спокойно активируем абонемент и шлём Анне пуш.' }
            ]
          },
          {
            id: 'dup', t: 'Пришёл дубль', lanes: WH_LANES, sumKind: 'ok',
            sum: 'Дубль ничего не испортил: абонемент не продлился дважды, пуш не ушёл дважды. Это и есть дедупликация.',
            steps: [
              { from: 'psp', to: 'api', t: 'payment.succeeded\nevt_51 (снова)', kind: 'warn', note: 'ПэйПоинт прислал то же событие ещё раз: не дождался нашего 200 или просто так устроен — «хотя бы один раз» значит «иногда два».' },
              { from: 'api', to: 'api', t: 'подпись верна', note: 'Подпись верна — письмо настоящее.' },
              { from: 'api', to: 'db', t: 'записать evt_51', note: 'Пытаемся записать id события.' },
              { from: 'db', to: 'api', t: 'уже есть', reply: true, kind: 'warn', note: 'База отвечает: такое событие уже записано.' },
              { from: 'api', to: 'psp', t: '200, повтор не обрабатываем', reply: true, kind: 'ok', note: 'Отвечаем 200 («получили»), чтобы ПэйПоинт перестал присылать, но второй раз не обрабатываем.' }
            ]
          },
          {
            id: 'fake', t: 'Подделка', lanes: [L('x', 'Злоумышленник', 'знает наш адрес'), L('api', 'API «Пульса»', '/webhooks/paypoint'), L('db', 'База', 'абонементы')], sumKind: 'ok',
            sum: 'Адрес вебхука — не секрет. Секрет — ключ подписи, который знают только ПэйПоинт и мы. Без проверки подписи любой «оплатил» бы себе абонемент.',
            steps: [
              { from: 'x', to: 'api', t: 'payment.succeeded\nбез подписи', kind: 'bad', note: 'Кто-то узнал адрес и шлёт «платёж прошёл» за свой неоплаченный абонемент.' },
              { from: 'api', to: 'api', t: 'подпись не сходится', kind: 'warn', note: 'Хеш тела с нашим секретом не совпадает с подписью в заголовке (или подписи нет вовсе).' },
              { from: 'api', to: 'x', t: '401', reply: true, kind: 'ok', note: 'Запрос отклонён. В базе ничего не меняется.' }
            ]
          },
          {
            id: 'lost', t: 'Вебхук не пришёл', lanes: WH_LANES, sumKind: 'ok',
            sum: 'Сверка страхует от потерянных вебхуков: без неё Анна заплатила бы, а абонемент так и висел бы «ждёт оплаты».',
            steps: [
              { from: 'psp', to: 'api', t: 'payment.succeeded', lost: true, kind: 'bad', note: 'Вебхук потерялся: у ПэйПоинта сбой или у нас в эту минуту шёл деплой.' },
              { from: 'api', to: 'db', t: 'кто «ждёт» > 15 мин?', note: 'Фоновая задача раз в несколько минут ищет платежи, которые подозрительно долго в статусе «ожидает».' },
              { from: 'api', to: 'psp', t: 'GET статус платежа', note: 'И сама спрашивает ПэйПоинт: какой у платежа статус?' },
              { from: 'psp', to: 'api', t: 'succeeded', reply: true, kind: 'ok', note: 'Платёж прошёл.' },
              { from: 'api', to: 'db', t: 'абонемент → active', kind: 'ok', note: 'Активируем абонемент так же, как при вебхуке.' }
            ]
          }
        ]
      });
    }
  };

  // ================= graphql =================
  const GQ = [
    { id: 'name', t: 'Имя клиента', path: ['me', 'fullName'], v: 'Анна Смирнова', rest: 'me' },
    { id: 'plan', t: 'Название абонемента', path: ['me', 'activeMembership', 'plan', 'name'], v: 'Сеть 12 мес', rest: 'mem' },
    { id: 'days', t: 'Сколько дней осталось', path: ['me', 'activeMembership', 'daysLeft'], v: 214, rest: 'mem' },
    { id: 'time', t: 'Время ближайших занятий', path: ['me', 'upcomingBookings(first: 3)', 'class', 'startsAt'], v: ['2026-10-05T19:00+03:00', '2026-10-07T09:00+03:00'], rest: 'bk' },
    { id: 'type', t: 'Направление занятия', path: ['me', 'upcomingBookings(first: 3)', 'class', 'type', 'name'], v: ['Сайкл', 'Йога'], rest: 'cls' },
    { id: 'trainer', t: 'Имя тренера', path: ['me', 'upcomingBookings(first: 3)', 'class', 'trainer', 'fullName'], v: ['Мария Лис', 'Игорь Ким'], rest: 'tr' },
    { id: 'notif', t: 'Непрочитанные уведомления', path: ['me', 'unreadNotificationsCount'], v: 2, rest: 'nt' }
  ];
  const REST_CALLS = { me: ['GET /me'], mem: ['GET /me/memberships'], bk: ['GET /me/bookings'], cls: ['GET /classes/{id} ×2'], tr: ['GET /classes/{id} ×2', 'GET /trainers/{id} ×2'], nt: ['GET /me/notifications'] };
  function gqlBuild(sel) {
    const tree = {};
    GQ.filter(f => sel.includes(f.id)).forEach(f => { let n = tree; f.path.forEach((p, i) => { n[p] = n[p] || (i === f.path.length - 1 ? true : {}); n = n[p]; }); });
    const print = (n, ind) => Object.entries(n).map(([k, v]) => v === true ? ind + k : `${ind}${k} {\n${print(v, ind + '  ')}\n${ind}}`).join('\n');
    const query = Object.keys(tree).length ? `query HomeScreen {\n${print(tree, '  ')}\n}` : '# отметьте хотя бы одно поле';
    // ответ той же формы
    const val = (n, path, idx) => {
      const o = {};
      Object.entries(n).forEach(([k, v]) => {
        const key = k.replace(/\(.*\)/, ''), p = path.concat(k);
        if (v === true) { const f = GQ.find(g => g.path.join('/') === p.join('/')); o[key] = Array.isArray(f.v) ? f.v[idx || 0] : f.v; }
        else if (k.startsWith('upcomingBookings')) o[key] = [0, 1].map(i => val(v, p, i));
        else o[key] = val(v, p, idx);
      });
      return o;
    };
    return { query, data: Object.keys(tree).length ? { data: val(tree, []) } : null };
  }
  const howGql = {
    id: 'how-graphql', covers: ['waterfall', 'build', 'nplus1', 'errors'], title: 'Как это работает: GraphQL', free: true, noReset: true,
    simple: {
      icon: '🍽️', plain: 'Вместо многих адресов — один. Приложение само пишет, какие поля ему нужны, и получает ровно их одним ответом.',
      analogy: 'REST — это несколько походов к разным стойкам кафе: за кофе, за булкой, за салфетками. GraphQL — официант, которому вы один раз диктуете весь заказ на стол, и он приносит всё сразу и ровно то, что заказали.',
      tech: 'Сервер описывает схему: типы и их поля (<code>Client</code>, <code>Membership</code>, <code>ClassSession</code>…). Клиент шлёт <code>POST /graphql</code> с текстом запроса. Сервер проверяет запрос по схеме и для каждого поля вызывает резолвер — функцию, которая достаёт данные. Ответ повторяет форму запроса.'
    },
    lead: ui.brief({
      situation: 'Главный экран приложения «Пульса» показывает: имя, абонемент и сколько дней осталось, ближайшие занятия с тренерами, число уведомлений. По REST это несколько запросов на разные адреса, часть — по очереди. На 3G каждый запрос — около 0,4 секунды.',
      todo: ['Отмечайте галочками, что должно быть на экране.', 'Смотрите, как меняется текст запроса и ответ сервера: у ответа та же форма, что у запроса.', 'Сравните счётчик: сколько запросов понадобилось бы по REST и сколько по GraphQL.', 'Внизу пройдите по шагам, что происходит на сервере, когда запрос пришёл.'],
      look: 'Слева — галочки (что нужно экрану). В середине — запрос GraphQL, который собирается из галочек. Справа — ответ. Отступы в запросе — это вложенность: тренер находится внутри занятия, занятие — внутри записи.'
    }),
    render(el) {
      let sel = ['name', 'plan', 'days', 'time', 'type', 'trainer'];
      el.innerHTML = `<div class="stack">
        <div class="grid3" style="align-items:start"><div class="card flat ex-tree" data-tree></div><div data-q></div><div data-r></div></div>
        <div class="grid2" data-cnt></div>
        <div class="eyebrow">Что происходит на сервере</div><div data-seq></div></div>`;
      TR.$('[data-tree]', el).innerHTML = `<div class="eyebrow">Что показать на экране</div>${GQ.map(f => `<label><input type="checkbox" data-f="${f.id}" ${sel.includes(f.id) ? 'checked' : ''}> ${esc(f.t)}</label>`).join('')}`;
      function draw() {
        const b = gqlBuild(sel);
        TR.$('[data-q]', el).innerHTML = ui.code(b.query, 'graphql', 'запрос: POST /graphql');
        TR.$('[data-r]', el).innerHTML = ui.code(b.data ? JSON.stringify(b.data, null, 2) : '—', 'json', 'ответ');
        const calls = [...new Set(GQ.filter(f => sel.includes(f.id)).flatMap(f => REST_CALLS[f.rest]))];
        const n = calls.reduce((s, c) => s + (/×(\d)/.test(c) ? +c.match(/×(\d)/)[1] : 1), 0);
        TR.$('[data-cnt]', el).innerHTML = `<div class="stat"><span class="k">по REST</span><span class="v ${n > 4 ? 'bad' : 'warn'}">${n} ${TR.plural(n, 'запрос', 'запроса', 'запросов')}</span><span class="s">${calls.map(esc).join(' · ') || '—'}</span></div>
          <div class="stat"><span class="k">по GraphQL</span><span class="v ok">${sel.length ? 1 : 0} запрос</span><span class="s">все поля одним POST /graphql — сервер сам обойдёт нужные таблицы</span></div>`;
      }
      el.addEventListener('change', e => { const c = e.target.closest('[data-f]'); if (!c) return; sel = c.checked ? sel.concat(c.dataset.f) : sel.filter(x => x !== c.dataset.f); draw(); });
      draw();
      ui.seq(TR.$('[data-seq]', el), {
        lanes: [L('app', 'Приложение', 'главный экран'), L('gql', 'GraphQL-сервер', 'одна точка входа'), L('res', 'Резолверы', 'функции полей'), L('db', 'База', 'PostgreSQL')],
        steps: [
          { from: 'app', to: 'gql', t: 'POST /graphql\nquery HomeScreen', note: 'Приложение отправляет один запрос на один адрес. В теле — текст запроса: какие поля нужны.' },
          { from: 'gql', to: 'gql', t: 'проверить по схеме', note: 'Сервер сверяет запрос со схемой: есть ли такие типы и поля, правильные ли аргументы. Опечатка в имени поля — ошибка ещё до похода в базу.' },
          { from: 'gql', to: 'res', t: 'резолвер me', note: 'Для каждого поля сервер вызывает его резолвер — функцию, которая знает, откуда взять данные.' },
          { from: 'res', to: 'db', t: 'клиент по токену', note: 'Резолвер <code>me</code> читает клиента, которому принадлежит токен.' },
          { from: 'gql', to: 'res', t: 'резолвер\nupcomingBookings', note: 'Резолвер записей берёт 3 ближайшие записи Анны.' },
          { from: 'res', to: 'db', t: 'записи LIMIT 3' },
          { from: 'gql', to: 'res', t: 'резолвер trainer ×3', kind: 'warn', note: 'Для каждой записи вызывается резолвер тренера. Если каждый ходит в базу отдельно — это проблема N+1, её разберём в практике.' },
          { from: 'res', to: 'db', t: 'тренер ×3', kind: 'warn' },
          { from: 'gql', to: 'app', t: '200 { data: … }', reply: true, kind: 'ok', note: 'Сервер собирает ответ ровно той формы, что в запросе, и отдаёт одним ответом. Лишних полей нет, недостающих — тоже.' }
        ]
      });
    }
  };

  // ================= styles: gRPC и Protobuf =================
  const enc = new TextEncoder();
  const hex = n => n.toString(16).padStart(2, '0');
  function varint(n) { const out = []; do { let b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; out.push(b); } while (n); return out; }
  const howGrpc = {
    id: 'how-grpc', covers: ['checkpass'], title: 'Как это работает: gRPC и Protobuf', free: true, noReset: true,
    simple: {
      icon: '📇', plain: 'gRPC — вызов функции на другом компьютере так, будто она у вас. Protobuf — компактный двоичный формат сообщений по заранее описанному контракту.',
      analogy: 'JSON — письмо, где перед каждым значением словами написано, что это: «клуб: …, токен: …». Protobuf — бланк с пронумерованными клетками: обе стороны заранее знают, что в клетке 1 — клуб, в клетке 2 — токен. Писать номер короче, чем слово.',
      tech: 'Контракт — файл <code>.proto</code>. Из него генерируется код для обеих сторон. Каждое поле кодируется так: байт «номер поля + тип», затем длина и значение. Транспорт — HTTP/2: соединение держится открытым, вызовы идут по нему без повторных рукопожатий. У каждого вызова есть дедлайн; не уложился — <code>DEADLINE_EXCEEDED</code>.'
    },
    lead: ui.brief({
      situation: 'Клиент прикладывает QR к турникету. Контроллер турникета в клубе должен за 300 мс спросить сервер «Пульса»: пускать или нет. Таких проверок утром — сотни в час на клуб, а интернет в области бывает медленным.',
      todo: ['Поменяйте значения полей сообщения и посмотрите, как оно выглядит в JSON и в Protobuf и сколько весит.', 'Разберите байты Protobuf: какой байт что означает.', 'Внизу пройдите варианты вызова: «Обычный вызов», «Сеть тормозит», «Поток обновлений».'],
      look: 'Фиолетовые байты — «номер поля и тип», синие — длина значения, серые — сами символы. Сравните размер: в JSON названия полей едут в каждом сообщении, в Protobuf — только номера.'
    }),
    render(el) {
      const v = { club: 'club-07', token: 'a9f3c2e1', turn: 't-2' };
      el.innerHTML = `<div class="stack">
        ${ui.code('message CheckPassRequest {\n  string club_id      = 1;\n  string token        = 2;\n  string turnstile_id = 3;\n}', 'proto', 'контракт .proto — одинаковый у турникета и сервера')}
        <div class="grid3">${[['club', 'club_id (поле 1)'], ['token', 'token (поле 2)'], ['turn', 'turnstile_id (поле 3)']].map(([k, t]) => `<div class="field"><label for="gp-${k}">${t}</label><input id="gp-${k}" type="text" class="mono" data-k="${k}" value="${esc(v[k])}" maxlength="40"></div>`).join('')}</div>
        <div class="grid2" style="align-items:start"><div data-json></div><div data-pb></div></div>
        <div data-size class="grid2"></div>
        <div class="eyebrow">Как идёт вызов</div><div data-seq></div></div>`;
      function draw() {
        const json = JSON.stringify({ clubId: v.club, token: v.token, turnstileId: v.turn });
        const jb = enc.encode(json).length;
        let total = 0;
        const rows = [['club', 1, 'club_id'], ['token', 2, 'token'], ['turn', 3, 'turnstile_id']].map(([k, n, name]) => {
          const bytes = Array.from(enc.encode(v[k])), len = varint(bytes.length);
          total += 1 + len.length + bytes.length;
          return `<div><span class="b t" title="поле ${n}, тип «строка»">${hex((n << 3) | 2)}</span>${len.map(b => `<span class="b l" title="длина ${bytes.length}">${hex(b)}</span>`).join('')}${bytes.map(b => `<span class="b">${hex(b)}</span>`).join('')}<div class="small dim">${hex((n << 3) | 2)} = поле ${n} (${name}), тип «строка»; ${len.map(hex).join(' ')} = длина ${bytes.length}; дальше ${bytes.length} байт текста «${esc(v[k])}»</div></div>`;
        }).join('');
        TR.$('[data-json]', el).innerHTML = ui.code(json, 'json', 'JSON (REST)');
        TR.$('[data-pb]', el).innerHTML = `<div class="code-cap">Protobuf (gRPC), байты в hex</div><div class="card flat ex-bytes">${rows}</div>`;
        TR.$('[data-size]', el).innerHTML = `<div class="stat"><span class="k">JSON</span><span class="v">${jb} байт</span><span class="s">названия полей словами в каждом сообщении</span></div><div class="stat"><span class="k">Protobuf</span><span class="v ok">${total} байт</span><span class="s">вместо названий — номера полей из контракта</span></div>`;
      }
      el.addEventListener('input', e => { const i = e.target.closest('[data-k]'); if (!i) return; v[i.dataset.k] = i.value; draw(); });
      draw();
      const lanes = [L('ctl', 'Контроллер', 'турникет в клубе'), L('stub', 'gRPC-клиент', 'сгенерирован из .proto'), L('srv', 'Сервер «Пульса»', 'AccessControl')];
      walk(TR.$('[data-seq]', el), {
        scenarios: [
          {
            id: 'ok', t: 'Обычный вызов', lanes, sumKind: 'ok', sum: 'Для кода контроллера это обычный вызов функции. Сетью, кодированием и дедлайном занимается сгенерированный клиент.',
            steps: [
              { from: 'ctl', to: 'stub', t: 'CheckPass(club, token)', note: 'Код контроллера вызывает функцию <code>CheckPass</code>, будто она локальная. Эту функцию сгенерировали из .proto.' },
              { from: 'stub', to: 'stub', t: 'в Protobuf\nдедлайн 300 мс', note: 'Клиент кодирует сообщение в байты (как выше) и ставит дедлайн: через 300 мс ждать перестанет.' },
              { from: 'stub', to: 'srv', t: 'HTTP/2 …/CheckPass', note: 'Байты уходят по уже открытому соединению HTTP/2 — без нового рукопожатия, это экономит десятки миллисекунд.' },
              { from: 'srv', to: 'srv', t: 'проверить абонемент', note: 'Сервер раскодирует сообщение тем же контрактом и проверяет абонемент: действует ли, пускает ли в этот клуб, не дневной ли после 17:00.' },
              { from: 'srv', to: 'stub', t: 'allowed = true', reply: true, kind: 'ok', note: 'Ответ — тоже маленькое Protobuf-сообщение.' },
              { from: 'stub', to: 'ctl', t: 'ответ за 40 мс', reply: true, kind: 'ok', note: 'Контроллер получает готовый объект ответа.' },
              { from: 'ctl', to: 'ctl', t: 'открыть турникет', kind: 'ok' }
            ]
          },
          {
            id: 'slow', t: 'Сеть тормозит', lanes, sumKind: 'warn', sum: 'Дедлайн не даёт очереди застрять у турникета: не успели за 300 мс — решаем на месте по локальному списку.',
            steps: [
              { from: 'ctl', to: 'stub', t: 'CheckPass(club, token)' },
              { from: 'stub', to: 'srv', t: 'HTTP/2 …/CheckPass', note: 'Запрос ушёл, но канал в клубе забит.' },
              { from: 'stub', to: 'stub', t: '300 мс прошло', kind: 'warn', note: 'Дедлайн истёк, ответа нет.' },
              { from: 'stub', to: 'ctl', t: 'DEADLINE_EXCEEDED', reply: true, kind: 'bad', note: 'Клиент возвращает ошибку «не уложились в дедлайн». Сервер, получив отменённый вызов, тоже бросает работу.' },
              { from: 'ctl', to: 'ctl', t: 'решить по локальному\nсписку пропусков', kind: 'ok', note: 'Контроллер сверяется со своим списком действующих пропусков и пускает клиента. Событие прохода запомнит и дошлёт позже.' }
            ]
          },
          {
            id: 'stream', t: 'Поток обновлений', lanes, sumKind: 'ok', sum: 'Один вызов — много ответов. Так контроллер держит локальный список пропусков свежим без постоянных опросов.',
            steps: [
              { from: 'ctl', to: 'srv', t: 'WatchAllowlist(club-07)', note: 'Контроллер один раз вызывает <code>WatchAllowlist</code> — серверный поток (stream).' },
              { from: 'srv', to: 'ctl', t: '+ Анна, до 31.12', reply: true, note: 'Сервер не закрывает вызов, а присылает изменения по мере появления: Анна купила абонемент.' },
              { from: 'srv', to: 'ctl', t: '− Пётр, абонемент истёк', reply: true, kind: 'warn', note: 'У Петра истёк абонемент — его убирают из списка.' },
              { from: 'srv', to: 'ctl', t: '+ гость ФитПасса до 21:00', reply: true, kind: 'info', note: 'Гость ФитПасса получил разовый доступ.' }
            ]
          }
        ]
      });
    }
  };

  // ================= styles: SSE =================
  const howSse = {
    id: 'how-sse', covers: ['live'], title: 'Как это работает: SSE', free: true, noReset: true,
    simple: {
      icon: '📺', plain: 'SSE — сервер держит соединение открытым и сам дописывает новые события, как только они случаются.',
      analogy: 'Табло прилёта в аэропорту: вы не спрашиваете каждые 5 секунд «прилетел ли рейс?» — табло обновляется само. Но говорить с табло нельзя, только смотреть: связь в одну сторону.',
      tech: 'Server-Sent Events — обычный HTTP GET с заголовком <code>Accept: text/event-stream</code>. Сервер отвечает и не закрывает соединение, а дописывает строки <code>id:</code>, <code>event:</code>, <code>data:</code>. Браузер сам переподключается после обрыва и присылает <code>Last-Event-ID</code> — сервер досылает пропущенное.'
    },
    lead: ui.brief({
      situation: 'Денис хочет показывать в приложении «сколько людей сейчас в клубе Сокол». Число меняется каждые несколько секунд: кто-то прошёл турникет, кто-то вышел. Нужно, чтобы цифра на телефоне обновлялась сама.',
      todo: ['Нажмите «Подключиться» и посмотрите, как сервер дописывает события в открытое соединение.', 'Нажмите «Оборвать связь» (телефон уехал в лифт), подождите пару событий, затем «Переподключиться».', 'Посмотрите, что приложение отправило при переподключении и что сервер прислал в ответ.'],
      look: 'Слева — экран телефона. Справа — сырой поток, как он идёт по сети: каждое событие — несколько строк и пустая строка в конце. События, которые случились, пока связи не было, помечены «досланы».'
    }),
    render(el) {
      let on = false, timer = null, lastId = 40, seenId = 40, inside = 87, events = [], lines = [];
      el.innerHTML = `<div class="stack">
        <div class="row"><button type="button" class="btn primary sm" data-s="on">Подключиться</button><button type="button" class="btn sm" data-s="off" disabled>Оборвать связь</button><button type="button" class="btn sm" data-s="re" disabled>Переподключиться</button><span class="small dim" data-state>Не подключено</span></div>
        <div class="grid2" style="align-items:start"><div class="ex-phone"><div class="bar"></div><div class="ttl">Пульс Сокол</div><div class="small muted">Сейчас в клубе</div><div style="font:700 40px/1 var(--f-mono)" data-num>—</div><div class="small dim" data-age></div></div>
        <div><div class="code-cap">поток по сети</div><pre class="code ex-stream" data-raw></pre></div></div>
        <div data-snote></div></div>`;
      const raw = TR.$('[data-raw]', el);
      function render() {
        raw.innerHTML = lines.map(l => l.html).join('\n') || '<span class="t-c">(пусто)</span>';
        raw.scrollTop = raw.scrollHeight;
        TR.$('[data-num]', el).textContent = seenId > 40 ? (events.find(e => e.id === seenId) || {}).inside : '—';
        TR.$('[data-state]', el).textContent = on ? 'Соединение открыто' : (lines.length ? 'Связь оборвана — события копятся на сервере' : 'Не подключено');
        TR.$('[data-s="on"]', el).disabled = on || lines.length > 0;
        TR.$('[data-s="off"]', el).disabled = !on;
        TR.$('[data-s="re"]', el).disabled = on || !lines.length;
      }
      const evText = (e, late) => `<span class="t-f">id</span>: ${e.id}\n<span class="t-f">event</span>: occupancy\n<span class="t-f">data</span>: <span class="t-s">{"club":"sokol","inside":${e.inside}}</span>${late ? '  <span class="t-c">← дослано после переподключения</span>' : ''}\n`;
      function tick() {
        if (!el.isConnected) { clearInterval(timer); return; }
        lastId++; inside = Math.max(40, Math.min(140, inside + Math.round((Math.random() - .45) * 6)));
        const e = { id: lastId, inside }; events.push(e);
        if (on) { lines.push({ html: evText(e) }); seenId = e.id; }
        render();
      }
      TR.on(el, 'click', '[data-s]', (ev, b) => {
        const a = b.dataset.s;
        if (a === 'on') {
          on = true;
          lines.push({ html: `<span class="t-k">GET</span> /v1/clubs/sokol/occupancy/stream\n<span class="t-f">Accept</span>: text/event-stream\n\n<span class="t-n">HTTP/1.1 200</span>  <span class="t-c">← соединение не закрывается</span>\n<span class="t-f">Content-Type</span>: text/event-stream\n` });
          clearInterval(timer); timer = setInterval(tick, 1400); tick();
          TR.$('[data-snote]', el).innerHTML = ui.note('', 'Что происходит', 'Приложение сделало один обычный GET. Сервер ответил 200 и не закрыл соединение: каждое изменение он дописывает в тот же ответ. Опрашивать сервер не нужно.');
        }
        if (a === 'off') {
          on = false; lines.push({ html: '<span class="t-c">— связь оборвалась (лифт) —</span>' });
          TR.$('[data-snote]', el).innerHTML = ui.note('warn', 'Связи нет', 'Сервер продолжает фиксировать события, но телефон их не получает. Он помнит id последнего полученного события: ' + seenId + '.');
        }
        if (a === 're') {
          on = true;
          lines.push({ html: `<span class="t-k">GET</span> /v1/clubs/sokol/occupancy/stream\n<span class="t-f">Last-Event-ID</span>: ${seenId}  <span class="t-c">← «последнее, что я видел»</span>\n` });
          events.filter(e => e.id > seenId).forEach(e => { lines.push({ html: evText(e, true) }); seenId = e.id; });
          TR.$('[data-snote]', el).innerHTML = ui.note('ok', 'Досылка', 'Приложение переподключилось и сообщило <code>Last-Event-ID</code>. Сервер дослал всё, что было пропущено, и продолжил поток. В настоящем браузере это делает встроенный <code>EventSource</code> сам.');
        }
        render();
      });
      render();
    }
  };

  // ================= hard-2: лестница Ричардсона =================
  const RL = [
    { n: 0, t: 'Ступень 0 · одно окошко', q: [0, 0, 0],
      what: 'Один адрес на всё — <code>/api</code>. Что сделать, написано в теле запроса (<code>"action"</code>). Ответ всегда <b>200</b>, даже при ошибке: «мест нет» спрятано внутри тела.',
      next: 'До ступени 1 не хватает адресов: у занятия, записи, клуба нет своих «окошек».',
      ops: [
        ['Посмотреть занятие', { method: 'POST', path: '/api', body: { action: 'getClass', classId: 19 } }, { status: 200, body: { ok: true, class: { id: 19, title: 'Сайкл', freeSpots: 6 } } }],
        ['Записаться', { method: 'POST', path: '/api', body: { action: 'bookClass', classId: 19 } }, { status: 200, body: { ok: true, bookingId: 71 } }],
        ['Записаться, а мест нет', { method: 'POST', path: '/api', body: { action: 'bookClass', classId: 19 } }, { status: 200, body: { ok: false, error: 'Мест нет' } }]
      ] },
    { n: 1, t: 'Ступень 1 · у вещей свои адреса', q: [1, 0, 0],
      what: '<b>Что изменилось:</b> у каждой вещи появился свой адрес. Занятие живёт по адресу <code>/classes/19</code>, запись — <code>/bookings/71</code>. Но метод по-прежнему всегда POST, действие — в теле, ответ — всегда 200.',
      next: 'До ступени 2 не хватает смысла у методов и кодов: читаем и создаём одним и тем же POST, а ошибка снова «200, но ok: false».',
      ops: [
        ['Посмотреть занятие', { method: 'POST', path: '/classes/19', body: { action: 'get' } }, { status: 200, body: { id: 19, title: 'Сайкл', freeSpots: 6 } }],
        ['Записаться', { method: 'POST', path: '/classes/19', body: { action: 'book' } }, { status: 200, body: { ok: true, bookingId: 71 } }],
        ['Записаться, а мест нет', { method: 'POST', path: '/classes/19', body: { action: 'book' } }, { status: 200, body: { ok: false, error: 'Мест нет' } }]
      ] },
    { n: 2, t: 'Ступень 2 · методы и коды по смыслу', q: [1, 1, 0],
      what: '<b>Что изменилось:</b> действие выражено <b>методом</b> (GET — прочитать, POST — создать, DELETE — удалить), а результат — <b>кодом ответа</b> (201 — создано, 409 — конфликт, 404 — не найдено). Тело больше не нужно читать, чтобы понять, что произошло. Кэш, повторы, мониторинг и любой разработчик понимают запрос по первой строке. Большинство настоящих API живут здесь.',
      next: 'До ступени 3 не хватает подсказок «что дальше»: приложение само должно знать, куда идти, чтобы отменить запись, и само считать, можно ли.',
      ops: [
        ['Посмотреть занятие', { method: 'GET', path: '/classes/19' }, { status: 200, body: { id: 19, title: 'Сайкл', freeSpots: 6 } }],
        ['Записаться', { method: 'POST', path: '/classes/19/bookings' }, { status: 201, headers: { Location: '/bookings/71' }, body: { id: 71, status: 'booked' } }],
        ['Записаться, а мест нет', { method: 'POST', path: '/classes/19/bookings' }, { status: 409, headers: { 'Content-Type': 'application/problem+json' }, body: { title: 'Мест нет', status: 409 } }]
      ] },
    { n: 3, t: 'Ступень 3 · ссылки «что дальше» (HATEOAS)', q: [1, 1, 1],
      what: '<b>Что изменилось:</b> в каждом ответе появился блок <code>_links</code> — какие действия сейчас доступны и по какому адресу. Мест нет — сервер сам предлагает лист ожидания. Записались — сервер даёт ссылку на отмену. Приложению не нужно знать адреса и правила заранее: оно идёт по ссылкам.',
      next: 'Это верхняя ступень.',
      ops: [
        ['Посмотреть занятие', { method: 'GET', path: '/classes/19' }, { status: 200, body: { id: 19, title: 'Сайкл', freeSpots: 6, _links: { book: { href: '/classes/19/bookings', method: 'POST' } } } }],
        ['Записаться', { method: 'POST', path: '/classes/19/bookings' }, { status: 201, headers: { Location: '/bookings/71' }, body: { id: 71, status: 'booked', _links: { cancel: { href: '/bookings/71/cancellation', method: 'POST' } } } }],
        ['Записаться, а мест нет', { method: 'POST', path: '/classes/19/bookings' }, { status: 409, body: { title: 'Мест нет', _links: { 'join-waitlist': { href: '/classes/19/bookings', method: 'POST' } } } }]
      ] }
  ];
  const RQ = ['У каждой вещи свой адрес?', 'Действие видно по методу, а результат — по коду?', 'В ответе есть ссылки на следующие шаги?'];
  const howRich = {
    id: 'how-richardson', covers: ['richardson'], title: 'Как это работает: лестница Ричардсона', free: true, noReset: true,
    simple: {
      icon: '🏤', plain: 'Лестница Ричардсона — это четыре ступени того, насколько API «по-настоящему REST». Каждая ступень добавляет к предыдущей одну вещь.',
      analogy: 'Почта. <b>Ступень 0</b> — одно окошко на всё: подаёте записку «хочу отправить посылку», на любую записку отвечают «принято», а отказ написан мелко внутри. <b>Ступень 1</b> — окошки по отделам (посылки, письма), но в каждом всё равно пишете записку, что хотите. <b>Ступень 2</b> — в каждом окошке стандартные действия («показать», «оформить», «отменить») и стандартные ответы («оформлено», «не найдено», «занято»), всё понятно без чтения записки. <b>Ступень 3</b> — вместе с ответом вам дают листок «дальше можно: оформить возврат — окно 5, продлить хранение — окно 7».',
      tech: 'Модель зрелости REST Леонарда Ричардсона: 0 — один адрес, действие в теле (так часто устроены SOAP и RPC); 1 — ресурсы, у каждого свой URI; 2 — методы HTTP и коды состояния по их смыслу (RFC 9110); 3 — гипермедиа, HATEOAS.'
    },
    lead: ui.brief({
      situation: 'Одни и те же три действия — «посмотреть занятие», «записаться», «записаться, когда мест нет» — можно сделать в API четырьмя способами. Это и есть четыре ступени. Чем выше ступень, тем больше смысла несёт сам HTTP и тем меньше приложению нужно знать заранее.',
      todo: ['Переключайте ступени 0 → 1 → 2 → 3 и смотрите на одни и те же три действия.', 'На каждой ступени прочитайте «что изменилось»: это одна новая вещь по сравнению с прошлой ступенью.', 'Запомните три вопроса внизу. По ним любой запрос раскладывается по ступеням, с ними выполняется следующее задание.'],
      look: 'Слева — запрос (метод и адрес), справа — ответ сервера (код и тело). Сравнивайте ступени между собой: меняется адрес? меняется метод? меняется код ответа? появляются ли ссылки <code>_links</code>? Зелёные и красные плашки сверху — ответы на три вопроса для этой ступени.'
    }),
    render(el) {
      let lv = 0;
      el.innerHTML = `<div class="stack"><div class="row"><span class="small dim">Ступень:</span>${ui.seg('rl', RL.map(r => ({ v: r.n, t: String(r.n) })), lv, 'accent')}</div><div data-rl></div>
        <div class="card flat"><div class="eyebrow">Три вопроса: как определить ступень любого запроса</div><ol style="margin:0;padding-left:20px;display:grid;gap:6px">
          <li><b>У каждой вещи свой адрес?</b> Нет, всё идёт на один адрес вроде <code>/api</code> → <b>ступень 0</b>.</li>
          <li><b>Действие видно по методу, а результат — по коду?</b> Нет: везде POST, действие в теле или в адресе, ответ всегда 200 → <b>ступень 1</b>.</li>
          <li><b>В ответе есть ссылки на следующие шаги?</b> Нет → <b>ступень 2</b>. Да → <b>ступень 3</b>.</li></ol>
          <p class="small muted">Спрашивайте по порядку и остановитесь на первом «нет».</p></div></div>`;
      function draw() {
        const r = RL[lv];
        TR.$('[data-rl]', el).innerHTML = `<div class="stack"><h3 style="font:600 17px/1.3 var(--f-brand)">${esc(r.t)}</h3>
          <div class="facts-row">${RQ.map((q, i) => `<span class="chip ${r.q[i] ? 'ok' : 'bad'}" style="white-space:normal">${r.q[i] ? '✓' : '✕'} ${esc(q)}</span>`).join('')}</div>
          ${ui.note(lv === 3 ? 'ok' : '', lv ? 'Что изменилось' : 'Как устроено', r.what)}
          ${r.ops.map(([name, req, res]) => `<div class="stack tight"><div class="eyebrow">${esc(name)}</div><div class="grid2" style="align-items:start">${ui.http(Object.assign({ cap: 'запрос' }, req))}${ui.http(Object.assign({ cap: 'ответ' }, res))}</div></div>`).join('')}
          <p class="small muted">${r.next}</p></div>`;
      }
      ui.onSeg(el, (n, v) => { if (n === 'rl') { lv = +v; draw(); } });
      draw();
    }
  };

  // ---------- вставка в тренировки ----------
  function addIntro(stageId, tasks, beforeId) {
    const s = TR.stageById(stageId); if (!s) return;
    tasks.slice().reverse().forEach(t => {
      if (s.tasks.some(x => x.id === t.id)) return;
      const at = beforeId ? s.tasks.findIndex(x => x.id === beforeId) : 0;
      s.tasks.splice(at < 0 ? 0 : at, 0, t);
    });
  }
  addIntro('hard-1', [howRetry, howRace]);
  addIntro('hard-2', [howRich], 'richardson');
  addIntro('hard-2', [howHate], 'hateoas-live');
  addIntro('hard-3', [howRetries, howHooks]);
  addIntro('graphql', [howGql]);
  addIntro('styles', [howGrpc, howSse]);
  TR.glossary([
    { term: 'Дедлайн (gRPC)', simple: 'Срок, после которого клиент перестаёт ждать ответа. Как «если через 5 минут не придёте — отдам место другому».', tech: 'У каждого gRPC-вызова есть дедлайн; не уложились — ошибка DEADLINE_EXCEEDED, и сервер тоже прекращает работу.' },
    { term: 'Server-Sent Events (SSE)', simple: 'Сервер сам дописывает новости в открытое соединение, как табло прилёта в аэропорту.', tech: 'HTTP GET с Accept: text/event-stream; события id/event/data; переподключение с Last-Event-ID.' },
    { term: 'Резолвер', simple: 'Функция, которая знает, где взять одно поле ответа GraphQL. Как сотрудник, который отвечает за свою полку на складе.', tech: 'Для каждого поля схемы сервер вызывает его резолвер; вложенные поля — вложенные вызовы.' }
  ]);
})();
