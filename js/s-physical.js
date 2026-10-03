/* Неделя 2, четверг: физическая модель под PostgreSQL 16. Студент выбирает типы данных, механизмы
   для бизнес-правил, затем атакует собственную схему плохими вставками и решает судьбу клиента,
   который просит удалить данные. Канон: _dev/DOMAIN.md §7. */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc;

  if (!document.getElementById('phy-style')) document.head.insertAdjacentHTML('beforeend', `<style id="phy-style">
    .phy-w { width: 0; min-width: 100%; }
    .phy-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .phy-atk { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 12px; align-items: start; }
    .phy-atk .phy-res { grid-column: 1 / -1; }
    .phy-atk pre.code { margin: 0; font-size: 12px; }
    .phy-mech { font-size: 12px; color: var(--text-muted); }
    .phy-big { font: 600 18px/1.3 var(--f-mono); font-variant-numeric: tabular-nums; }
    @media (max-width: 560px) { .phy-stats { grid-template-columns: minmax(0, 1fr); } .phy-atk { grid-template-columns: minmax(0, 1fr); } }
  </style>`);
  const W = h => `<div class="phy-w">${h}</div>`;
  const tbl = (...a) => W(ui.table(...a)), code = (...a) => W(ui.code(...a));
  const stat = (k, v, kind, s) => `<div class="stat"><span class="k">${k}</span><span class="v ${kind || ''}">${v}</span>${s ? `<span class="s">${s}</span>` : ''}</div>`;

  // ---------- подход 1: типы данных ----------
  const TYPES = [
    { v: 'bigint', t: 'bigint' }, { v: 'int', t: 'int' }, { v: 'numeric', t: 'numeric(12,2)' }, { v: 'float', t: 'double precision (float)' },
    { v: 'money', t: 'money' }, { v: 'text', t: 'text' }, { v: 'textcheck', t: 'text + CHECK' }, { v: 'citext', t: 'citext' },
    { v: 'uuid', t: 'uuid' }, { v: 'identity', t: 'bigint GENERATED ALWAYS AS IDENTITY' }, { v: 'date', t: 'date' },
    { v: 'timestamp', t: 'timestamp' }, { v: 'timestamptz', t: 'timestamptz' }
  ];
  const typeName = v => (TYPES.find(x => x.v === v) || { t: '—' }).t;
  const TROWS = [
    { id: 'amount', t: 'Сумма платежа', sub: 'рубли с копейками, потом складываем в отчётах', ok: ['bigint'], okWhy: 'bigint в копейках: 540000 = 5 400,00 ₽. Целые числа складываются без потерь.',
      warn: { numeric: 'Тоже точно. Но медленнее и легко забыть про масштаб; эталон «Пульса» — bigint копеек.', int: 'Копеек в int влезает до 21,4 млн ₽ — на платёж хватит, на выручку сети за год уже нет. Берите bigint.' },
      bad: { float: 'float хранит числа приблизительно: 0,1 + 0,2 ≠ 0,3. Тысяча платежей — и копейки поплыли. Посмотрите опыт выше.', money: 'money зависит от настроек локали сервера: перенесли базу — рубли могут показаться долларами. Плохо переносится и считается.' },
      hint: 'Деньги складывают тысячами. Сколько стоит одна ошибка округления на копейку при сверке с 1С?' },
    { id: 'starts', t: 'Время начала занятия', sub: 'клубы в Москве, Казани и Екатеринбурге', ok: ['timestamptz'], okWhy: 'timestamptz хранит точный момент. Показываем в поясе клуба из club.timezone.',
      bad: { timestamp: '«09:00» без пояса: в Екатеринбурге и в Москве это разные моменты, а в базе — одинаковые. Напоминания придут на два часа раньше.' },
      hint: 'У клубов разные часовые пояса. Что значит «09:00», если не сказано, где?' },
    { id: 'phone', t: 'Телефон клиента', sub: '+79161112233, по нему вход и он уникален', ok: ['textcheck'], okWhy: "text + CHECK (phone ~ '^\\+7[0-9]{10}$'): один формат, уникальность работает.",
      warn: { text: 'Без проверки пролезут «8 (916) 111-22-33» и «+7916…» — один человек станет двумя клиентами, UNIQUE не поможет.' },
      bad: { bigint: 'Телефон — не число: его не складывают, теряется «+», а ведущие нули пропадают.', int: 'Номер даже не влезет в int, да и числом он не является.' },
      hint: 'Телефон состоит из цифр, но это не число. А ещё его формат надо проверять.' },
    { id: 'id', t: 'Внутренний ключ клиента', sub: 'для связей между таблицами', ok: ['identity'], okWhy: 'bigint с автонумерацией: компактный, быстрый для связей, база сама выдаёт номера.',
      warn: { uuid: 'Работает, но случайный uuid как первичный ключ большой таблицы раздувает индекс. Эталон: bigint внутри, uuid наружу.', bigint: 'Тип верный, но кто выдаёт номера? Добавьте GENERATED ALWAYS AS IDENTITY.', int: '2,1 млрд — для клиентов хватит, для посещений за годы впритык. bigint дешевле переделки.' },
      hint: 'Ключ для связей внутри базы: короткий, растущий, выдаётся базой.' },
    { id: 'pub', t: 'Идентификатор клиента в адресе API', sub: 'GET /v1/clients/{…}', ok: ['uuid'], okWhy: 'uuid непредсказуем: соседний номер не подобрать. Проверку прав это не заменяет, но перебор затрудняет.',
      bad: { identity: 'Последовательный номер в адресе — подставь соседний и смотри чужое. Ровно это нашли пентестеры «Пульса».', bigint: 'Число в адресе легко перебрать — вспомните пентест.', int: 'Число в адресе легко перебрать — вспомните пентест.' },
      hint: 'Вспомните пентест: чужую запись открыли, поменяв номер в адресе.' },
    { id: 'status', t: 'Статус записи', sub: 'booked, waitlist, cancelled, attended, no_show', ok: ['textcheck'], okWhy: "text + CHECK (status IN ('booked', …)): читаемо и без мусора. Можно и enum-тип — но новый статус в enum добавить сложнее.",
      warn: { text: 'Без CHECK пролезут «Booked» и «bookd» — отчёты начнут врать.' },
      bad: { int: 'Через год никто не вспомнит, что 3 — это no_show.' },
      hint: 'Значений немного, и они фиксированы. Как не пустить опечатку?' },
    { id: 'email', t: 'Email клиента', sub: 'необязательный, уникальный без учёта регистра', ok: ['citext'], okWhy: 'citext сравнивает без учёта регистра: Anna@Mail.ru и anna@mail.ru — один адрес, и UNIQUE это видит.',
      warn: { text: 'Anna@Mail.ru и anna@mail.ru станут разными клиентами. Спасёт уникальный индекс по lower(email) — или citext.', textcheck: 'Формат проверите, а регистр — нет: Anna@ и anna@ станут двумя клиентами.' },
      hint: 'Люди пишут один и тот же адрес то с большой буквы, то с маленькой.' },
    { id: 'birth', t: 'Дата рождения', sub: 'может быть пустой', ok: ['date'], okWhy: 'date: у дня рождения нет часового пояса и времени.',
      bad: { timestamptz: 'У дня рождения нет пояса. Показали в другом поясе — день «съехал» на вчера.', timestamp: 'Время суток дню рождения не нужно, а сравнения станут путаными.', text: 'Как текст дату не сравнить и не проверить: «31.02.1990» пролезет.' },
      hint: 'Нужен календарный день, без времени и пояса.' }
  ];
  function typeVerdict(r, v) {
    if (!v) return null;
    if (r.ok.includes(v)) return { s: 'ok', why: r.okWhy };
    if (r.warn && r.warn[v]) return { s: 'warn', why: r.warn[v] };
    return { s: 'bad', why: (r.bad && r.bad[v]) || r.hint };
  }
  function floatDemo() {
    let f = 0, k = 0;
    for (let i = 0; i < 1000; i++) { f += 0.1; k += 10; }
    return { sum: String(0.1 + 0.2), f: String(f), k };
  }

  const taskTypes = {
    id: 'types', title: 'Типы данных',
    simple: { icon: '📏', plain: 'Тип — это форма ящика, в который кладут значение. Неудачная форма портит то, что внутри.', analogy: 'Деньги в кассе считают монетами, а не «примерно столько». Время занятия пишут с городом: «09:00 по Москве», иначе клиент из Екатеринбурга придёт не тогда. Телефон пишут как строку — никто не прибавляет единицу к номеру.', tech: 'Физическая модель — это уже конкретная база, PostgreSQL. Каждому столбцу выбирают тип: целое число, дробное, строка, дата, момент времени с поясом, уникальный идентификатор. От типа зависит, что база сама не даст испортить: копейки при сложении, время у клуба в другом городе, ведущий ноль или плюс в номере телефона.' },
    lead: ui.brief({
      situation: 'Четверг. Модель готова, пора записать её в настоящую базу PostgreSQL. У каждого поля должен быть тип — форма ящика для значения: целое число, текст, дата, момент времени. Неудачная форма портит содержимое. Деньги в «дробном» типе теряют копейки. «09:00» без часового пояса в Москве и в Екатеринбурге — разные моменты, а база их не различит.',
      todo: [
        'Нажмите «Сложить во float и в копейках». Браузер по-настоящему сложит тысячу платежей по 0,10 ₽ двумя способами.',
        'Для каждого из 8 полей откройте список «Тип…» и выберите тип. Под названием поля — что в нём хранится.',
        'Нажмите «Проверить». Засчитывается при 80 %, причём у суммы платежа и времени занятия не должно быть грубой ошибки.'
      ],
      lookTitle: 'Шпаргалка по типам',
      look: 'В опыте две карточки: слева дробное число (<code>float</code>), справа целые копейки (<code>bigint</code>). Красная цифра — сумма не сошлась, зелёная — точно. Типы коротко: <code>bigint</code>/<code>int</code> — целое число (большое/поменьше); <code>numeric</code> — точная дробь; <code>text</code> — текст; «text + CHECK» — текст с проверкой формата; <code>citext</code> — текст, где «Anna» и «anna» одно и то же; <code>uuid</code> — длинный случайный номер; <code>date</code> — день без времени; <code>timestamp</code> — время без пояса; <code>timestamptz</code> — момент с поясом; IDENTITY — номер, который база выдаёт сама. После проверки: зелёный — верно, жёлтый — работает с минусом, красный — ошибка.'
    }),
    blank: () => ({ m: {}, demo: false }),
    reference: () => ({ m: Object.fromEntries(TROWS.map(r => [r.id, r.ok[0]])), demo: true }),
    render(el, ctx) {
      const ans = ctx.ans; ans.m = ans.m || {};
      el.innerHTML = `<div class="stack">
        <div class="card flat"><div class="eyebrow">Опыт: тысяча платежей по 0,10 ₽</div>
          <div class="row"><button type="button" class="btn sm" data-demo ${ctx.readonly ? 'disabled' : ''}>Сложить во float и в копейках</button></div>
          <div data-dout></div></div>
        <div data-m></div></div>`;
      const out = TR.$('[data-dout]', el);
      function drawDemo() {
        if (!ans.demo) { out.innerHTML = '<div class="small dim">Браузер посчитает по-настоящему: JavaScript хранит дробные числа так же, как <code>double precision</code> в PostgreSQL.</div>'; return; }
        const d = floatDemo();
        out.innerHTML = `<div class="grid2">
          <div class="card"><div class="eyebrow">float</div><div class="small">0.1 + 0.2 =</div><div class="phy-big" style="color:var(--bad)">${esc(d.sum)}</div><div class="small">1000 × 0,10 ₽ =</div><div class="phy-big" style="color:var(--bad)">${esc(d.f)}</div><div class="small">До ста рублей не хватило долей копейки. Сравнение «= 100» вернёт false, а сверка с 1С не сойдётся.</div></div>
          <div class="card"><div class="eyebrow">bigint, копейки</div><div class="small">10 + 20 =</div><div class="phy-big" style="color:var(--ok)">30</div><div class="small">1000 × 10 коп. =</div><div class="phy-big" style="color:var(--ok)">${d.k} коп. = ${esc(TR.fmtRub(d.k))}</div><div class="small">Целые числа складываются точно. Рубли — только при показе.</div></div></div>`;
      }
      if (!ctx.readonly) TR.on(el, 'click', '[data-demo]', () => { ans.demo = true; ctx.save(); drawDemo(); });
      drawDemo();
      let reveal = null;
      if (ctx.result || ctx.readonly) { reveal = {}; TROWS.forEach(r => { const x = typeVerdict(r, ans.m[r.id]); if (x) reveal[r.id] = ctx.result || ctx.readonly ? x : { s: x.s }; }); }
      ui.match(TR.$('[data-m]', el), { rows: TROWS.map(r => ({ id: r.id, t: `<b>${esc(r.t)}</b>`, sub: esc(r.sub) })), choices: TYPES, value: ans.m, readonly: ctx.readonly, reveal, placeholder: 'Тип…',
        onChange: m => { ans.m = m; ctx.save(); if (m.amount) ctx.decide('Тип денег', typeName(m.amount)); if (m.starts) ctx.decide('Тип времени занятия', typeName(m.starts)); } });
    },
    check(ans) {
      const m = ans.m || {};
      let pts = 0; const notes = [];
      TROWS.forEach(r => {
        const x = typeVerdict(r, m[r.id]);
        if (!x) { notes.push({ ok: false, html: `<b>${esc(r.t)}</b> — тип не выбран.` }); return; }
        if (x.s === 'ok') pts += 1;
        else if (x.s === 'warn') { pts += 0.6; notes.push({ ok: 'warn', html: `<b>${esc(r.t)}</b>: ${esc(typeName(m[r.id]))} — ${esc(x.why)}` }); }
        else notes.push({ ok: false, html: `<b>${esc(r.t)}</b>: ${esc(typeName(m[r.id]))} — ${esc(x.why)}` });
      });
      const score = pts / TROWS.length;
      const critical = ['amount', 'starts'].every(id => { const x = typeVerdict(TROWS.find(r => r.id === id), m[id]); return x && x.s !== 'bad'; });
      if (!ans.demo) notes.push({ ok: 'info', html: 'Опыт с float не проведён — нажмите кнопку, это десять секунд.' });
      return { ok: score >= 0.8 && critical, score, notes: notes.slice(0, 9), summary: `Типы подобраны на ${Math.round(score * 100)}%.${critical ? '' : ' Деньги и время занятия — критичные поля, там ошибка недопустима.'}` };
    },
    explain: `<p>Типы — первая линия обороны. Самые дорогие ошибки:</p>
      <ul class="checks"><li><span><b>Деньги во float.</b> Копейки теряются при сложении, сверка с 1С расходится. <code>bigint</code> копеек или <code>numeric(12,2)</code>; <code>money</code> зависит от локали сервера.</span></li>
      <li><span><b>Время без пояса.</b> Екатеринбург +2 ч к Москве (Казань живёт по московскому). <code>timestamptz</code> хранит момент, а показываем в поясе клуба.</span></li>
      <li><span><b>Последовательный id наружу.</b> Перебор номеров — та самая дыра из пентеста. Внутри <code>bigint</code>, наружу <code>public_id uuid</code> (RFC 9562).</span></li></ul>
      <p>Телефон и статус — строки с <code>CHECK</code>. Без проверки формата уникальность бессильна: «8 916…» и «+7 916…» для базы — разные люди.</p>`,
    report: ans => TROWS.map(r => { const x = typeVerdict(r, (ans.m || {})[r.id]); return `- ${r.t} → ${typeName((ans.m || {})[r.id])}${x ? (x.s === 'ok' ? ' ✓' : x.s === 'warn' ? ' (допустимо)' : ' ✗') : ''}`; }).join('\n') + `\n\nОпыт с float: ${ans.demo ? 'проведён' : 'нет'}.`
  };

  // ---------- подход 2: правило → механизм ----------
  const MECH = [
    { v: 'notnull', t: 'NOT NULL' }, { v: 'unique', t: 'UNIQUE' }, { v: 'partial', t: 'Частичный UNIQUE-индекс' },
    { v: 'check', t: 'CHECK' }, { v: 'fk', t: 'Внешний ключ (REFERENCES)' }, { v: 'exclude', t: 'EXCLUDE (пересечения)' },
    { v: 'counter', t: 'Счётчик + CHECK + UPDATE' }, { v: 'tx', t: 'Транзакция + FOR UPDATE' }, { v: 'app', t: 'Только в приложении' }
  ];
  const mechName = v => (MECH.find(x => x.v === v) || { t: 'не выбран' }).t;
  const RULES = [
    { id: 'cap', fact: 'F-capacity', t: 'Записанных на занятие не больше мест', ok: ['counter'],
      warn: { tx: 'Сработает: блокируем строку занятия и считаем записи. Но в воскресенье 20:00 все ждут одну блокировку и каждый раз считают COUNT(*). Счётчик дешевле.' },
      bad: { check: 'CHECK видит только свою строку и не умеет считать другие записи.', app: 'Два запроса одновременно прочитают «19 из 20» и оба запишут — гонка.' },
      hint: 'Правило про количество строк в другой таблице. Какой механизм не проигрывает гонке двух одновременных записей?',
      ddl: { counter: "-- class_session\nbooked_count int NOT NULL DEFAULT 0,\nCHECK (booked_count BETWEEN 0 AND capacity)\n-- в той же транзакции, что INSERT INTO booking:\nUPDATE class_session SET booked_count = booked_count + 1\n WHERE id = $1 AND booked_count < capacity;  -- 0 строк = мест нет",
        tx: "BEGIN;\nSELECT capacity FROM class_session WHERE id = $1 FOR UPDATE;\nSELECT count(*) FROM booking WHERE class_session_id = $1 AND status = 'booked';\n-- мест нет -> ROLLBACK, иначе INSERT\nCOMMIT;" } },
    { id: 'dbl', fact: 'F-double', t: 'Одна активная запись клиента на занятие (после отмены можно записаться снова)', ok: ['partial'],
      warn: { unique: 'Дубли отобьёт, но отменённая запись навсегда займёт пару «клиент–занятие»: записаться снова после отмены нельзя.' },
      bad: { app: 'Администратор нажал «Записать» дважды, оба запроса проверили «записи нет» одновременно.' },
      hint: 'Уникальность нужна не среди всех строк, а только среди активных.',
      ddl: { partial: "CREATE UNIQUE INDEX booking_one_active ON booking (client_id, class_session_id)\n  WHERE status IN ('booked','waitlist');", unique: "ALTER TABLE booking ADD UNIQUE (client_id, class_session_id);\n-- отменённая запись мешает записаться снова" } },
    { id: 'tr', fact: 'F-trainer-overlap', t: 'Тренер не ведёт два занятия в пересекающееся время', ok: ['exclude'],
      warn: { tx: 'Можно: блокировка строки тренера и проверка. Но EXCLUDE сделает это сам, и никто не забудет проверку в новом коде.' },
      bad: { unique: 'UNIQUE сравнивает на равенство: 19:00–20:00 и 19:30–20:30 не равны, но пересекаются.', partial: 'Индекс уникальности сравнивает на равенство, а не на пересечение.' },
      hint: 'Интервалы пересекаются, не совпадая. Нужен механизм, который умеет оператор «пересекается» (&&).',
      ddl: { exclude: "EXCLUDE USING gist (trainer_id WITH =, tstzrange(starts_at, ends_at) WITH &&)\n  WHERE (status = 'scheduled')", tx: "SELECT 1 FROM trainer WHERE id = $1 FOR UPDATE;\n-- проверить пересечения, затем INSERT" } },
    { id: 'ovl', fact: 'F-overlap', t: 'Два действующих абонемента клиента не пересекаются по датам', ok: ['exclude'],
      warn: { tx: 'Можно, но EXCLUDE надёжнее: правило живёт в схеме, а не в одном месте кода.' },
      hint: 'То же, что с тренером, только даты вместо времени.',
      ddl: { exclude: "EXCLUDE USING gist (client_id WITH =, daterange(starts_on, ends_on) WITH &&)\n  WHERE (status IN ('active','frozen'))", tx: "SELECT 1 FROM client WHERE id = $1 FOR UPDATE;\n-- проверить пересечение абонементов, затем INSERT" } },
    { id: 'frz', fact: 'F-freeze', t: 'Кусок заморозки не короче 7 дней', ok: ['check'], hint: 'Правило смотрит на два поля одной строки.',
      ddl: { check: '-- membership_freeze\nCHECK (ends_on - starts_on >= 7)' } },
    { id: 'phone', fact: 'F-client-id', t: 'Телефон клиента уникален', ok: ['unique'],
      warn: { partial: 'Сработает, но условие не нужно: NULL после обезличивания UNIQUE и так не считает дублями.' },
      bad: { app: 'Две регистрации с одного номера одновременно — обе пройдут проверку «номера нет».' },
      hint: 'Самое простое ограничение уникальности.',
      ddl: { unique: 'phone text UNIQUE CHECK (phone ~ \'^\\+7[0-9]{10}$\')', partial: 'CREATE UNIQUE INDEX ON client (phone) WHERE phone IS NOT NULL;' } },
    { id: 'pay', t: 'Платёж — ровно за абонемент или за персональную тренировку (не за оба и не «ни за что»)', ok: ['check'], hint: 'Два поля одной строки: сколько из них заполнено?',
      ddl: { check: '-- payment\nCHECK (num_nonnulls(membership_id, personal_session_id) = 1)' } },
    { id: 'ref', fact: 'F-refund', t: 'Сумма возвратов по платежу не больше суммы платежа', ok: ['tx'],
      warn: { counter: 'Тоже работает: refunded_kopecks в платеже + CHECK (refunded_kopecks <= amount_kopecks) + атомарный UPDATE. В эталоне — транзакция: возвратов мало.' },
      bad: { check: 'CHECK видит одну строку возврата и не знает про остальные.', app: 'Два возврата одновременно прочитают «вернули 0» и оба пройдут.' },
      hint: 'Правило между несколькими строками — и два возврата могут прийти одновременно.',
      ddl: { tx: "BEGIN;\nSELECT amount_kopecks FROM payment WHERE id = $1 FOR UPDATE;\nSELECT coalesce(sum(amount_kopecks), 0) FROM refund\n WHERE payment_id = $1 AND status <> 'canceled';\n-- сумма + новый возврат > платежа -> ROLLBACK\nINSERT INTO refund (...) VALUES (...);\nCOMMIT;", counter: "-- payment\nrefunded_kopecks bigint NOT NULL DEFAULT 0,\nCHECK (refunded_kopecks <= amount_kopecks)\nUPDATE payment SET refunded_kopecks = refunded_kopecks + $2 WHERE id = $1;" } },
    { id: 'birth', t: 'Дата рождения не в будущем', ok: ['app'],
      warn: { check: 'CHECK (birth_date <= current_date) зависит от сегодняшней даты. PostgreSQL считает CHECK неизменными во времени и не перепроверяет их — правило «плавает». Канон «Пульса»: в приложении.' },
      hint: 'Ответ на «в будущем ли?» меняется со временем. Может ли ограничение базы зависеть от сегодняшней даты?',
      ddl: { app: '-- в приложении: birth_date <= сегодня в поясе клиента -> иначе 422', check: 'CHECK (birth_date <= current_date)  -- [[bad]]не неизменяемо во времени[[/]]' } },
    { id: 'room', t: 'Вместимость зала от 1 до 200 мест', ok: ['check'], hint: 'Одно поле одной строки, диапазон.',
      ddl: { check: '-- room\ncapacity int NOT NULL CHECK (capacity BETWEEN 1 AND 200)' } },
    { id: 'fk', t: 'Нельзя записаться на занятие, которого нет', ok: ['fk'], hint: 'Значение обязано существовать в другой таблице.',
      bad: { app: 'Занятие могут удалить между проверкой и вставкой.' },
      ddl: { fk: 'class_session_id bigint NOT NULL REFERENCES class_session(id) ON DELETE RESTRICT' } },
    { id: 'nn', t: 'У занятия обязательно есть время начала', ok: ['notnull'],
      warn: { check: 'CHECK (starts_at IS NOT NULL) сработает, но для этого есть NOT NULL — короче и понятнее.' },
      hint: 'Простейшее ограничение: поле обязано быть заполнено.',
      ddl: { notnull: 'starts_at timestamptz NOT NULL', check: 'CHECK (starts_at IS NOT NULL)' } }
  ];
  const ruleVerdict = (r, v) => !v ? null : r.ok.includes(v) ? 's' : (r.warn && r.warn[v]) ? 'w' : 'b';
  function rulesDDL(m) {
    return RULES.map(r => {
      const v = m[r.id], head = `-- ${r.t}`;
      if (!v) return `${head}\n-- механизм не выбран`;
      const d = r.ddl && r.ddl[v];
      if (d) return `${head}\n${d}`;
      if (v === 'app') return `${head}\n-- проверка в коде Java, база ничего не гарантирует`;
      return `${head}\n[[bad]]-- ${mechName(v)}: этим механизмом такое правило не записать[[/]]`;
    }).join('\n\n');
  }

  const taskRules = {
    id: 'rules', title: 'Правило → механизм',
    simple: { icon: '🛡️', plain: 'Правило бизнеса надо поручить тому, кто его точно не забудет. Лучше всего — самой базе.', analogy: 'Турникет пускает только с действующим абонементом — его не уговорить и не обмануть. А табличка «вход только по абонементам» — это «проверка в приложении»: работает, пока все честные и никто не спешит.', tech: 'Ограничения целостности PostgreSQL: <code>NOT NULL</code>, <code>UNIQUE</code>, частичный уникальный индекс, <code>CHECK</code> (одна строка), <code>FOREIGN KEY</code>, <code>EXCLUDE</code> (пересечения). Правила между строками под конкурентной нагрузкой — счётчик с атомарным <code>UPDATE</code> или транзакция с <code>SELECT … FOR UPDATE</code>.' },
    lead: ui.brief({
      situation: 'В блокноте 12 правил: «записанных не больше мест», «тренер не ведёт два занятия в одно время», «телефон клиента уникален»… Кто-то должен их соблюдать. Можно поручить программе — но её пишут четыре разработчика, и однажды кто-то забудет проверку. А можно поручить самой базе: она просто не примет неправильную строку. В следующем подходе вашу схему будут ломать — выбирайте всерьёз.',
      todo: [
        'Для каждого из 12 правил откройте список «Механизм…» и выберите, чем база удержит правило.',
        'Раскройте «DDL по вашим ответам». DDL — код, которым создают таблицы; он собирается из ваших ответов.',
        'Нажмите «Проверить». Засчитывается при 80 %, и у правила про лимит мест не должно быть грубой ошибки.'
      ],
      lookTitle: 'Механизмы простыми словами',
      look: 'NOT NULL — поле обязано быть заполнено. UNIQUE — значение не повторяется. Частичный UNIQUE — не повторяется только среди «живых» строк, например неотменённых. CHECK — проверка внутри одной строки («от 1 до 200»). Внешний ключ — значение обязано существовать в другой таблице. EXCLUDE — запрет пересечений по времени. Счётчик + CHECK + UPDATE — число занятых мест хранится в занятии, и база не даст его превысить. Транзакция + FOR UPDATE — «живая очередь»: пока один проверяет, остальные ждут. Только в приложении — база ничего не проверяет. Красная строка в DDL — этим механизмом правило не записать.'
    }),
    blank: () => ({ m: {} }),
    reference: () => ({ m: Object.fromEntries(RULES.map(r => [r.id, r.ok[0]])) }),
    render(el, ctx) {
      const ans = ctx.ans; ans.m = ans.m || {};
      el.innerHTML = `<div class="stack"><div data-m></div><details class="more" ${ctx.readonly ? '' : 'open'}><summary>DDL по вашим ответам</summary><div data-ddl></div></details></div>`;
      const ddl = TR.$('[data-ddl]', el);
      const drawDDL = () => { ddl.innerHTML = code(rulesDDL(ans.m), 'sql'); };
      let reveal = null;
      if (ctx.result || ctx.readonly) {
        reveal = {};
        RULES.forEach(r => { const v = ans.m[r.id], s = ruleVerdict(r, v); if (!s) return; reveal[r.id] = s === 's' ? { s: 'ok' } : s === 'w' ? { s: 'warn', why: r.warn[v] } : { s: 'bad', why: (r.bad && r.bad[v]) || r.hint }; });
      }
      ui.match(TR.$('[data-m]', el), { rows: RULES.map(r => ({ id: r.id, t: esc(r.t), sub: r.fact ? `<span class="tnum">${esc(r.fact)}</span>` : '' })), choices: MECH, value: ans.m, readonly: ctx.readonly, reveal, placeholder: 'Механизм…',
        onChange: m => {
          ans.m = m; ctx.save(); drawDDL();
          ['cap', 'dbl', 'ref', 'birth'].forEach(id => { if (m[id]) ctx.decide('Механизм: ' + RULES.find(r => r.id === id).t, mechName(m[id])); });
        } });
      drawDDL();
    },
    check(ans) {
      const m = ans.m || {};
      let pts = 0; const notes = [];
      RULES.forEach(r => {
        const v = m[r.id], s = ruleVerdict(r, v);
        if (!s) { notes.push({ ok: false, html: `«${esc(r.t)}» — механизм не выбран.` }); return; }
        if (s === 's') pts += 1;
        else if (s === 'w') { pts += 0.6; notes.push({ ok: 'warn', html: `«${esc(r.t)}»: ${esc(mechName(v))} — ${esc(r.warn[v])}` }); }
        else notes.push({ ok: false, html: `«${esc(r.t)}»: ${esc(mechName(v))} — ${esc((r.bad && r.bad[v]) || r.hint)}` });
      });
      const score = pts / RULES.length;
      const capOk = ruleVerdict(RULES[0], m.cap) !== 'b' && !!m.cap;
      return { ok: score >= 0.8 && capOk, score, notes: notes.slice(0, 10), summary: `Механизмы подобраны на ${Math.round(score * 100)}%.${capOk ? '' : ' Лимит мест — главный риск воскресенья 20:00, там ошибка недопустима.'}`,
        vera: score < 0.8 ? 'Задайте каждому правилу два вопроса: сколько строк оно видит — одну или много? И что будет, если два запроса придут в одну миллисекунду?' : null };
    },
    explain: `<p>Есть простая лесенка выбора:</p>
      <ul class="checks"><li><span><b>Одно поле, одна строка</b> — <code>NOT NULL</code>, <code>CHECK</code>.</span></li>
      <li><span><b>Не повторяться среди строк</b> — <code>UNIQUE</code>; только среди активных — частичный уникальный индекс.</span></li>
      <li><span><b>Не пересекаться во времени</b> — <code>EXCLUDE USING gist</code> с <code>tstzrange</code>/<code>daterange</code> (нужно расширение <code>btree_gist</code>).</span></li>
      <li><span><b>Считать другие строки</b> — <code>CHECK</code> не умеет. Счётчик с атомарным <code>UPDATE … WHERE booked_count &lt; capacity</code> или транзакция с блокировкой <code>FOR UPDATE</code>.</span></li>
      <li><span><b>Зависит от «сегодня»</b> — в приложении: ограничение базы обязано быть неизменным во времени.</span></li></ul>
      <p>Ещё правило между таблицами из канона: пересечение группового занятия и персональной тренировки одного тренера. <code>EXCLUDE</code> работает в одной таблице, поэтому здесь — транзакция с блокировкой строки тренера.</p>`,
    report: ans => RULES.map(r => { const v = (ans.m || {})[r.id], s = ruleVerdict(r, v); return `- ${r.t} → ${mechName(v)}${s === 's' ? ' ✓' : s === 'w' ? ' (допустимо)' : s ? ' ✗' : ''}`; }).join('\n')
  };

  // ---------- подход 3: атака на схему ----------
  const ATTACKS = [
    { id: 'a-cap', rule: 'cap', t: '21-й на 20 мест', story: 'Воскресенье, 20:00:00.3. На «Сайкл 19:00» осталось одно место. Анна и Пётр жмут «Записаться» в одну миллисекунду.',
      sql: "INSERT INTO booking (client_id, class_session_id, status, source)\nVALUES (1, 2, 'booked', 'app'), (2, 2, 'booked', 'app');  -- параллельно",
      okBy: { counter: 'Отбито. Второй UPDATE … WHERE booked_count < capacity вернул 0 строк — мест нет. Пётр встал в лист ожидания и получил честный ответ.', tx: 'Отбито. Второй запрос ждал блокировку занятия, пересчитал — 20 из 20 — и откатился. Работает, но в пике все стоят в очереди за одной блокировкой.' },
      pass: 'Прошло. В базе 21 запись на 20 мест. В 19:00 двое у одного велосипеда — и пост в соцсетях.' },
    { id: 'a-dbl', rule: 'dbl', t: 'Двойная запись', story: 'Администратор на ресепшене нажал «Записать Анну на Йогу» дважды — сайт подтормозил.',
      sql: "INSERT INTO booking (client_id, class_session_id, status, source)\nVALUES (1, 1, 'booked', 'reception');  -- второй раз",
      ok: 'Отбито. ERROR: duplicate key value violates unique constraint "booking_one_active"',
      okBy: { unique: 'Отбито. ERROR: duplicate key value violates unique constraint "booking_client_id_class_session_id_key". Но завтра Анна отменит запись и не сможет записаться снова.' },
      pass: 'Прошло. У Анны две записи на одно занятие, одно место пропадает впустую, лист ожидания стоит.' },
    { id: 'a-tr', rule: 'tr', t: 'Тренер в двух залах одновременно', story: 'Управляющий Химок ставит Игоря Кима на 19:30, не зная, что в 19:00 у него сайкл в Соколе.',
      sql: "INSERT INTO class_session (trainer_id, room_id, club_id, starts_at, ends_at, ...)\nVALUES (7, 5, 2, '2026-10-05 19:30+03', '2026-10-05 20:30+03', ...);",
      ok: 'Отбито. ERROR: conflicting key value violates exclusion constraint "class_session_trainer_id_tstzrange_excl"',
      okBy: { tx: 'Отбито. Транзакция заблокировала строку тренера, нашла пересечение и откатилась. Работает — пока все пути создания занятия помнят про эту проверку.' },
      pass: 'Прошло. Игорь Ким в расписании двух клубов одновременно. В Химках 15 человек ждут тренера, который не придёт.' },
    { id: 'a-ovl', rule: 'ovl', t: 'Пересекающиеся абонементы', story: 'Анне продают второй сетевой абонемент на те же даты — администратор не заметил действующий.',
      sql: "INSERT INTO membership (client_id, plan_id, starts_on, ends_on, status, ...)\nVALUES (1, 4, '2026-10-01', '2027-10-01', 'active', ...);",
      ok: 'Отбито. ERROR: conflicting key value violates exclusion constraint "membership_client_id_daterange_excl"',
      okBy: { tx: 'Отбито. Блокировка клиента, проверка пересечения, откат. Работает, если никто не забудет её в новом коде.' },
      pass: 'Прошло. У Анны два действующих абонемента на одни даты — 54 000 ₽ за воздух и неизбежный возврат.' },
    { id: 'a-frz', rule: 'frz', t: 'Заморозка на 3 дня', story: 'Клиент просит заморозить абонемент на выходные, администратор соглашается.',
      sql: "INSERT INTO membership_freeze (membership_id, starts_on, ends_on)\nVALUES (11, '2026-10-10', '2026-10-13');",
      ok: 'Отбито. ERROR: new row for relation "membership_freeze" violates check constraint "membership_freeze_check"',
      pass: 'Прошло. Заморозка на 3 дня при правиле «не меньше 7». Через месяц «а почему ему можно, а мне нет?».' },
    { id: 'a-phone', rule: 'phone', t: 'Второй аккаунт с тем же телефоном', story: 'Клиент нажал «Зарегистрироваться» в приложении и на сайте почти одновременно.',
      sql: "INSERT INTO client (phone, full_name) VALUES ('+79161112233', 'Анна Смирнова');",
      ok: 'Отбито. ERROR: duplicate key value violates unique constraint "client_phone_key"',
      pass: 'Прошло. Две Анны с одним телефоном: абонемент на одной, записи на другой. Вход по SMS-коду пускает то в один, то в другой аккаунт.' },
    { id: 'a-pay', rule: 'pay', t: 'Платёж без привязки', story: 'Баг в новой версии: платёж создаётся, но не привязан ни к абонементу, ни к тренировке.',
      sql: "INSERT INTO payment (client_id, amount_kopecks, status, idempotency_key)\nVALUES (1, 540000, 'pending', gen_random_uuid());",
      ok: 'Отбито. ERROR: new row for relation "payment" violates check constraint "payment_check" — num_nonnulls(…) = 0',
      pass: 'Прошло. 5 400 ₽ списаны, а за что — неизвестно. Ирина в 1С не может провести документ, клиент без абонемента.' },
    { id: 'a-ref', rule: 'ref', t: 'Возврат больше платежа', story: 'Платёж 5 400 ₽. Два администратора одновременно оформляют возврат по 3 000 ₽.',
      sql: "INSERT INTO refund (payment_id, amount_kopecks, status, reason)\nVALUES (5, 300000, 'pending', 'расторжение'),\n       (5, 300000, 'pending', 'расторжение');  -- параллельно",
      okBy: { tx: 'Отбито. Второй ждал блокировку платежа, пересчитал: 3 000 + 3 000 > 5 400 — откат.', counter: 'Отбито. ERROR: new row for relation "payment" violates check constraint "payment_refunded_check" — 6 000 > 5 400.' },
      pass: 'Прошло. Вернули 6 000 ₽ при платеже 5 400 ₽. 600 ₽ подарили, а в 1С минус.' },
    { id: 'a-birth', rule: 'birth', t: 'Дата рождения в будущем', story: 'Клиентка опечаталась в годе: 01.05.2031.',
      sql: "UPDATE client SET birth_date = '2031-05-01' WHERE id = 1;",
      okBy: { app: 'Отбито приложением: 422, «Дата рождения не может быть в будущем». До базы запрос не дошёл.', check: 'Отбито сегодня: ERROR: … violates check constraint "client_birth_date_check". Но такой CHECK зависит от даты, и PostgreSQL не обещает, что он будет вести себя одинаково (например, при восстановлении из дампа). Канон — в приложении.' },
      pass: 'Прошло. Клиентке минус пять лет, отчёт по возрасту сломан, а детский тариф выдаётся автоматически.' },
    { id: 'a-fk', rule: 'fk', t: 'Запись на несуществующее занятие', story: 'Старая версия приложения хранит в кэше занятие, которое уже удалили из расписания.',
      sql: "INSERT INTO booking (client_id, class_session_id, status, source)\nVALUES (1, 999999, 'booked', 'app');",
      ok: 'Отбито. ERROR: insert or update on table "booking" violates foreign key constraint "booking_class_session_id_fkey"',
      pass: 'Прошло. Запись висит на занятии, которого нет. Отчёт загрузки падает, в «Моих записях» пустая карточка.' }
  ];
  function attackOutcome(a, m) {
    const r = RULES.find(x => x.id === a.rule), v = m[a.rule], s = ruleVerdict(r, v);
    if (!v) return { win: false, msg: a.pass, why: 'Механизм для этого правила не выбран — база ничего не проверяет.' };
    if (s === 's' || s === 'w') return { win: true, msg: (a.okBy && a.okBy[v]) || a.ok, why: s === 'w' ? 'Работает, но есть цена — см. разбор в прошлом подходе.' : '' };
    return { win: false, msg: a.pass, why: (r.bad && r.bad[v]) || `${mechName(v)} это правило не проверяет.` };
  }
  const QATK = {
    q: 'Какие выводы из атаки верны?', multi: true, seed: 'phy-atk',
    options: [
      { t: 'CHECK видит только одну строку: правила «между строками» (вместимость, сумма возвратов) им не выразить', ok: 1, why: 'Да. Для них — счётчик с атомарным UPDATE или транзакция с блокировкой.' },
      { t: 'Проверка «только в приложении» без блокировки проигрывает гонке: два запроса одновременно видят «место есть»', ok: 1, why: 'Да. Между «проверил» и «вставил» проходит время, и в него влезает второй запрос.' },
      { t: 'Пересечение интервалов времени ловит EXCLUDE USING gist, а не UNIQUE', ok: 1, why: 'Да. UNIQUE сравнивает на равенство, EXCLUDE умеет «пересекается» (&&).' },
      { t: 'Достаточно проверять всё в приложении: база — для хранения, а не для правил', why: 'Нет. Приложений несколько (сайт, кабинет, API ФитПасса), багов — ещё больше. Правило в схеме нельзя обойти.' },
      { t: 'UNIQUE (client_id, class_session_id) лучше частичного индекса: строже — значит надёжнее', why: 'Нет. Строже, чем требует бизнес: отменил запись — не можешь записаться снова. Ограничение должно совпадать с правилом, а не быть «построже».' }
    ]
  };

  const taskAttack = {
    id: 'attack', title: 'Атака на схему',
    simple: { icon: '🧨', plain: 'Лучший способ проверить защиту — попробовать её сломать. Плохие данные приходят не от злодеев, а от спешки, двойных кликов и багов.', analogy: 'Как пожарные учения в клубе: не ждём настоящего пожара, а проверяем, открываются ли запасные выходы. Здесь «пожар» — 3000 человек в воскресенье 20:00 и два администратора у одной кнопки.', tech: 'Каждая атака — вставка, которую реально пришлёт система: параллельные запросы, повторы, баги клиентов. Ограничение базы отвечает ошибкой (SQLSTATE 23505 — уникальность, 23514 — CHECK, 23P01 — EXCLUDE, 23503 — внешний ключ), и приложение превращает её в понятный ответ.' },
    lead: ui.brief({
      situation: 'Пожарные учения для базы. Десять обычных бед из жизни клуба: двойной клик на «Записать», два администратора оформляют один возврат одновременно, баг в новой версии приложения, опечатка в дате рождения. Каждая атака бьёт по одному правилу — и по тому механизму, который <b>вы</b> выбрали в подходе «Правило → механизм».',
      todo: [
        'Нажмите «Атаковать» у каждой атаки или сразу «Запустить все атаки».',
        'Если что-то прошло — можно вернуться в «Правило → механизм», сменить механизм и атаковать снова.',
        'Ответьте на вопрос «Какие выводы из атаки верны?» (верных вариантов несколько).',
        'Нажмите «Проверить». Засчитывается, когда запущены все 10 атак и вывод верный. Сколько атак отбито — на зачёт не влияет.'
      ],
      lookTitle: 'Как читать результат',
      look: 'В карточке атаки — история, ваш механизм и итог. Зелёная плашка «Отбито» — база не пустила плохие данные; рядом настоящий текст ошибки PostgreSQL. Красная «Прошло» — плохие данные уже в базе, и написано, чем это обернётся для клуба. В «SQL атаки» спрятан сам запрос. Счётчики сверху: сколько атак запущено, отбито и прошло.'
    }),
    blank: () => ({ ran: [], q: [] }),
    reference: () => ({ ran: ATTACKS.map(a => a.id), q: [0, 1, 2] }),
    render(el, ctx) {
      const ans = ctx.ans; ans.ran = ans.ran || []; ans.q = ans.q || [];
      const m = ctx.readonly ? taskRules.reference().m : ((TR.taskState('physical', 'rules').ans || {}).m || {});
      const chosen = Object.keys(m).length;
      el.innerHTML = `<div class="stack">
        ${!ctx.readonly && chosen < RULES.length ? ui.note('warn', 'Не все механизмы выбраны', `В подходе «Правило → механизм» выбрано ${chosen} из ${RULES.length}. Там, где механизма нет, база ничего не проверяет — атака пройдёт.`) : ''}
        <div class="phy-stats" data-st></div>
        <div class="row"><button type="button" class="btn primary sm" data-all ${ctx.readonly ? 'disabled' : ''}>Запустить все атаки</button><button type="button" class="btn ghost sm" data-clr ${ctx.readonly ? 'disabled' : ''}>Очистить результаты</button></div>
        <div class="stack tight" data-list></div>
        <div class="card flat" data-q></div></div>`;
      const list = TR.$('[data-list]', el);
      function draw() {
        let won = 0, lost = 0;
        list.innerHTML = ATTACKS.map(a => {
          const ran = ans.ran.includes(a.id), o = attackOutcome(a, m);
          if (ran) { if (o.win) won++; else lost++; }
          return `<div class="card flat phy-atk">
            <div class="stack tight"><b>${esc(a.t)}</b><span class="small">${esc(a.story)}</span><span class="phy-mech">Ваш механизм: ${esc(mechName(m[a.rule]))}</span></div>
            <button type="button" class="btn sm ${ran ? 'ghost' : 'danger'}" data-atk="${a.id}" ${ctx.readonly ? 'disabled' : ''}>${ran ? 'Ещё раз' : 'Атаковать'}</button>
            <div class="phy-res">${ran ? `<details class="more"><summary class="small">SQL атаки</summary><div>${code(a.sql, 'sql')}</div></details>${ui.note(o.win ? 'ok' : 'bad', o.win ? 'Отбито' : 'Прошло', esc(o.msg) + (o.why ? `<div class="small" style="margin-top:4px">${esc(o.why)}</div>` : ''))}` : ''}</div>
          </div>`;
        }).join('');
        TR.$('[data-st]', el).innerHTML = stat('Запущено', `${ans.ran.length} / ${ATTACKS.length}`, '') + stat('Отбито', won, won ? 'ok' : '') + stat('Прошло', lost, lost ? 'bad' : 'ok', lost ? 'укрепите схему в прошлом подходе' : '');
        if (!ctx.readonly && ans.ran.length) ctx.decide('Атака на схему', `отбито ${won} из ${ans.ran.length}`);
      }
      if (!ctx.readonly) {
        TR.on(el, 'click', '[data-atk]', (e, b) => { const id = b.dataset.atk; if (!ans.ran.includes(id)) ans.ran.push(id); ctx.save(); draw(); });
        TR.on(el, 'click', '[data-all]', () => { ans.ran = ATTACKS.map(a => a.id); ctx.save(); draw(); });
        TR.on(el, 'click', '[data-clr]', () => { ans.ran = []; ctx.save(); draw(); });
      }
      draw();
      ui.quiz(TR.$('[data-q]', el), Object.assign({}, QATK, { value: ans.q, readonly: ctx.readonly, reveal: ctx.result, onChange: v => { ans.q = v; ctx.save(); } }));
    },
    check(ans) {
      const ran = (ans.ran || []).filter(id => ATTACKS.some(a => a.id === id)).length;
      const q = ui.quizScore(QATK, ans.q);
      const score = 0.4 * ran / ATTACKS.length + 0.6 * q.score;
      const notes = [
        { ok: ran === ATTACKS.length, html: ran === ATTACKS.length ? 'Все атаки запущены.' : `Запущено атак: ${ran} из ${ATTACKS.length}. Смысл — увидеть, где схема пропускает, а не угадать.` },
        { ok: q.ok, html: q.ok ? 'Вывод верный.' : (ans.q || []).length ? 'Вывод: вспомните, какие атаки прошли через CHECK и через «только приложение», и почему. Пояснения — у вариантов.' : 'Ответьте на вопрос-вывод.' }
      ];
      return { ok: ran === ATTACKS.length && q.ok, score, notes };
    },
    explain: `<p>Ни одна атака не была «хакерской». Двойной клик, два администратора, баг новой версии, старое приложение с кэшем, опечатка — это обычный вторник. Поэтому правила живут в схеме: <b>их нельзя обойти ни багом, ни гонкой, ни новым сервисом</b>, который через год напишет другая команда.</p>
      <p>Что делает приложение с ошибкой базы? Превращает её в понятный ответ API: нарушение уникальности (<code>23505</code>) или исключения (<code>23P01</code>) — в <code>409 Conflict</code>, нарушение <code>CHECK</code> (<code>23514</code>) — в <code>422</code>. Это пригодится на неделе REST.</p>
      <p>Обратите внимание на «отбито, но с ценой»: транзакция с блокировкой тоже держит правило, но в пике все стоят в одной очереди. Механизм выбирают не только по «работает», но и по «сколько стоит в воскресенье 20:00».</p>`,
    report: ans => {
      const m = (TR.taskState('physical', 'rules').ans || {}).m || {};
      const rows = ATTACKS.filter(a => (ans.ran || []).includes(a.id)).map(a => { const o = attackOutcome(a, m); return `- ${a.t}: ${o.win ? 'отбито' : 'ПРОШЛО'} (${mechName(m[a.rule])})`; });
      return `Запущено ${rows.length} из ${ATTACKS.length}.\n${rows.join('\n')}\n\nВывод: ${ui.quizScore(QATK, ans.q).ok ? 'верный' : 'с ошибками'}.`;
    }
  };

  // ---------- подход 4: ON DELETE и удаление клиента ----------
  const ODCH = [{ v: 'cascade', t: 'CASCADE' }, { v: 'restrict', t: 'RESTRICT' }, { v: 'setnull', t: 'SET NULL' }];
  const FKS = [
    { id: 'pay', t: '<code>payment.client_id → client</code>', sub: 'платежи клиента; храним 5 лет для налоговой', ok: 'restrict',
      why: { restrict: 'База не даст удалить клиента, пока есть платежи. И правильно: клиента не удаляют, а обезличивают.', cascade: 'Удалили клиента — молча исчезли платежи, которые обязаны храниться 5 лет.', setnull: 'Платёж без клиента: непонятно, чей он при споре и возврате; да и client_id NOT NULL.' } },
    { id: 'book', t: '<code>booking.client_id → client</code>', sub: 'записи на занятия; история нужна для споров', ok: 'restrict',
      why: { restrict: 'История записей и прогулов остаётся. Споры «я не прогуливал» решаются по ней.', cascade: 'Исчезнет история записей — и загрузка занятий в прошлых отчётах «похудеет» задним числом.', setnull: 'Запись без клиента — бессмысленная строка в отчёте загрузки.' } },
    { id: 'ref', t: '<code>client.referred_by_id → client</code>', sub: 'кто привёл клиента («приведи друга»)', ok: 'setnull',
      why: { setnull: 'Пригласивший ушёл — связь «кто привёл» обнуляется, а сам приведённый клиент остаётся.', cascade: 'Удалили Анну — и каскадом удалились все, кого она привела! Катастрофа.', restrict: 'Анну нельзя будет удалить, пока у неё есть приведённые друзья. Держит зря: эта связь не важнее самих людей.' } },
    { id: 'tc', t: '<code>trainer_club.trainer_id → trainer</code>', sub: 'в каких клубах работает тренер', ok: 'cascade',
      why: { cascade: 'Строка «тренер работает в клубе» без тренера бессмысленна — удаляется вместе с ним.', restrict: 'Безопасно, но лишняя ручная работа: сначала отвязать тренера от всех клубов.', setnull: 'trainer_id — часть первичного ключа, NULL туда нельзя.' } },
    { id: 'room', t: '<code>room.club_id → club</code>', sub: 'залы клуба', ok: 'restrict',
      why: { restrict: 'Клуб с залами (а значит, с расписанием и историей) просто так не удалить. Закрытие клуба — отдельный процесс.', cascade: 'Удалили клуб — каскадом исчезли залы, а за ними тянутся занятия и записи. Одна команда — минус год истории.', setnull: 'Зал без клуба — непонятно, где он.' } }
  ];
  const odWarn = (f, v) => (f.id === 'tc' && v === 'restrict') || (f.id === 'ref' && v === 'restrict');
  const QDEL = {
    q: 'Анна пишет: «Удалите мои персональные данные». Что делает система?', seed: 'phy-del',
    options: [
      { t: 'Обезличивает: телефон, ФИО, email, дату рождения — в NULL, ставит anonymized_at; строка клиента и платежи остаются', ok: 1, why: 'Верно. Персональных данных больше нет, а платежи остаются на 5 лет и привязаны к обезличенной строке.' },
      { t: 'DELETE FROM client с CASCADE на всё', why: 'Вместе с Анной исчезнут платежи, которые надо хранить 5 лет. Налоговая не поймёт.' },
      { t: 'Отказывает: платежи же надо хранить', why: 'Удалить персональные данные по просьбе — обязанность (F-delete). Платежи хранятся без персональных данных.' },
      { t: 'Переносит строку клиента как есть в архивную таблицу', why: 'Персональные данные никуда не делись — просто лежат в другом месте.' }
    ]
  };
  const ANNA_PAY = [['1', 'membership 11', '54 000,00 ₽', 'succeeded'], ['2', 'personal 3', '3 500,00 ₽', 'succeeded'], ['3', 'membership 15', '5 900,00 ₽', 'succeeded']];

  const taskDelete = {
    id: 'ondelete', title: 'ON DELETE и удаление клиента',
    simple: { icon: '🗑️', plain: 'Когда удаляют строку, на которую ссылаются другие, база должна знать, что делать со ссылающимися: удалить их, запретить удаление или обнулить ссылку.', analogy: 'Клиент уходит из клуба. Его шкафчик освобождают (удалить вместе), чеки оставляют в бухгалтерии (запретить уничтожать), а в анкете друга вычёркивают «привела Анна» (обнулить ссылку).', tech: '<code>ON DELETE CASCADE</code> — удалить зависимые строки, <code>RESTRICT</code> — запретить удаление, <code>SET NULL</code> — обнулить внешний ключ. Персональные данные по просьбе клиента не удаляют строкой, а обезличивают — так платежи сохраняются.' },
    lead: ui.brief({
      situation: 'Анна Смирнова пишет: «Удалите мои персональные данные». По закону это надо сделать. Но у Анны 3 платежа на 63 400 ₽, а платежи «Пульс» обязан хранить 5 лет для налоговой. Что станет с её платежами, записями и отметкой «кто кого привёл», если стереть строку Анны? Это решает правило ON DELETE — «что делать со ссылками при удалении».',
      todo: [
        'Для каждой из 5 связей выберите правило. CASCADE — удалить вместе с родителем. RESTRICT — запретить удаление, пока есть ссылки. SET NULL — оставить строку, но стереть ссылку.',
        'Проведите опыт: нажмите <code>DELETE FROM client WHERE id = 1</code> (удалить Анну) и посмотрите, что будет при вашем правиле для платежей. Потом нажмите «Обезличить».',
        'Ответьте на вопрос, что система делает с просьбой Анны.',
        'Нажмите «Проверить». Засчитывается при 80 % верных правил, верном правиле для платежей и верном ответе на вопрос.'
      ],
      lookTitle: 'Как читать',
      look: 'Строку <code>payment.client_id → client</code> читайте так: «платёж ссылается на клиента». Спросите себя: что ценнее для бизнеса — родитель (клиент, клуб) или то, что на него ссылается (платежи, залы)? В опыте до нажатия видно, что сейчас лежит в базе. После — зелёная плашка: нужные данные целы, красная: что-то потеряно. Сравните «удалить» и «обезличить».'
    }),
    blank: () => ({ m: {}, q: [], run: '' }),
    reference: () => ({ m: Object.fromEntries(FKS.map(f => [f.id, f.ok])), q: [0], run: 'anon' }),
    render(el, ctx) {
      const ans = ctx.ans; ans.m = ans.m || {}; ans.q = ans.q || [];
      el.innerHTML = `<div class="stack"><div data-m></div>
        <div class="card flat"><div class="eyebrow">Опыт: Анна (client.id = 1) просит удалить её данные</div>
          <div class="row"><button type="button" class="btn sm danger" data-run="del" ${ctx.readonly ? 'disabled' : ''}>DELETE FROM client WHERE id = 1</button><button type="button" class="btn sm" data-run="anon" ${ctx.readonly ? 'disabled' : ''}>Обезличить</button></div>
          <div data-out></div></div>
        <div class="card flat" data-q></div></div>`;
      const out = TR.$('[data-out]', el);
      function drawRun() {
        const before = tbl(['id', 'phone', 'full_name', 'email', 'anonymized_at'], [['1', '+79161112233', 'Анна Смирнова', 'anna@mail.ru', 'NULL']]);
        const pays = rowCls => tbl(['payment.id', 'за что', 'сумма', 'status'], ANNA_PAY, { rowClass: rowCls });
        if (!ans.run) { out.innerHTML = `<div class="small dim">Сейчас в базе:</div>${before}${pays()}`; return; }
        if (ans.run === 'del') {
          const v = ans.m.pay;
          let res;
          if (!v) res = ui.note('warn', 'Сначала выберите', 'Выберите правило для <code>payment.client_id</code> выше — от него зависит, что случится.');
          else if (v === 'restrict') res = ui.note('ok', 'База защитила платежи', 'ERROR: update or delete on table "client" violates foreign key constraint "payment_client_id_fkey" on table "payment". Удалить нельзя — и это хорошо. Но просьбу Анны всё ещё надо выполнить.') + pays();
          else if (v === 'cascade') res = ui.note('bad', 'DELETE 1 — и платежи исчезли', 'Вместе с Анной удалились 3 платежа на 63 400 ₽. Через год налоговая просит документы — их нет. Бэкап? Восстанавливать базу ради одного клиента — день работы.') + pays(() => 'bad');
          else res = ui.note('bad', 'Ошибка', 'ERROR: null value in column "client_id" of relation "payment" violates not-null constraint. А если бы client_id разрешал NULL — остались бы ничьи платежи на 63 400 ₽.');
          out.innerHTML = code('DELETE FROM client WHERE id = 1;', 'sql') + res;
          return;
        }
        out.innerHTML = code("UPDATE client\n   SET phone = NULL, full_name = NULL, email = NULL,\n       birth_date = NULL, medical_valid_until = NULL,\n       anonymized_at = now()\n WHERE id = 1;\n-- UPDATE 1", 'sql') +
          `<div class="grid2"><div class="stack tight"><div class="small dim">До</div>${before}</div><div class="stack tight"><div class="small dim">После</div>${tbl(['id', 'phone', 'full_name', 'email', 'anonymized_at'], [['1', 'NULL', 'NULL', 'NULL', '2026-10-08 12:04']], { rowClass: () => 'ok' })}</div></div>` +
          `<div class="small dim">Платежи на месте и привязаны к строке 1 — без имени и телефона:</div>${pays(() => 'ok')}` +
          ui.note('ok', 'Обе цели выполнены', 'Персональных данных нет, платежи хранятся 5 лет. CHECK в канонной таблице client пропускает пустые телефон и ФИО только при заполненном anonymized_at.');
      }
      if (!ctx.readonly) TR.on(el, 'click', '[data-run]', (e, b) => { ans.run = b.dataset.run; ctx.save(); drawRun(); });
      drawRun();
      let reveal = null;
      if (ctx.result || ctx.readonly) { reveal = {}; FKS.forEach(f => { const v = ans.m[f.id]; if (v) reveal[f.id] = { s: v === f.ok ? 'ok' : odWarn(f, v) ? 'warn' : 'bad', why: f.why[v] }; }); }
      ui.match(TR.$('[data-m]', el), { rows: FKS.map(f => ({ id: f.id, t: f.t, sub: esc(f.sub) })), choices: ODCH, value: ans.m, readonly: ctx.readonly, reveal, placeholder: 'ON DELETE…',
        onChange: m => { ans.m = m; ctx.save(); if (m.pay) ctx.decide('ON DELETE для платежей клиента', m.pay.toUpperCase()); if (ans.run === 'del') drawRun(); } });
      ui.quiz(TR.$('[data-q]', el), Object.assign({}, QDEL, { value: ans.q, readonly: ctx.readonly, reveal: ctx.result, onChange: v => { ans.q = v; ctx.save(); ctx.decide('Удаление клиента по просьбе', v.length ? QDEL.options[v[0]].t.slice(0, 80) : '—'); } }));
    },
    check(ans) {
      const m = ans.m || {};
      let pts = 0; const notes = [];
      FKS.forEach(f => {
        const v = m[f.id], name = f.t.replace(/<[^>]+>/g, '');
        if (!v) { notes.push({ ok: false, html: `${esc(name)} — не выбрано.` }); return; }
        if (v === f.ok) { pts += 1; return; }
        if (odWarn(f, v)) { pts += 0.6; notes.push({ ok: 'warn', html: `${esc(name)}: ${esc(f.why[v])}` }); }
        else notes.push({ ok: false, html: `${esc(name)}: ${esc(f.why[v])}` });
      });
      const q = ui.quizScore(QDEL, ans.q);
      const mScore = pts / FKS.length;
      notes.push({ ok: q.ok, html: q.ok ? 'Просьба Анны: обезличивание вместо удаления.' : (ans.q || []).length ? 'Просьба Анны: нужно выполнить обе обязанности сразу — убрать персональные данные и сохранить платежи.' : 'Ответьте, что делать с просьбой Анны.' });
      return { ok: m.pay === 'restrict' && mScore >= 0.8 && q.ok, score: 0.7 * mScore + 0.3 * q.score, notes, summary: m.pay && m.pay !== 'restrict' ? 'Платежи клиента — самая дорогая связь: их обязаны хранить 5 лет.' : '' };
    },
    explain: `<p>Выбор ON DELETE — это ответ на вопрос «что для бизнеса важнее: строка-родитель или строки-дети?».</p>
      <ul class="checks"><li><span><b>RESTRICT</b> — для всего, что имеет ценность само по себе: платежи (5 лет), записи и посещения (3 года), залы клуба.</span></li>
      <li><span><b>CASCADE</b> — для строк-связок без собственной ценности: <code>trainer_club</code>, <code>trainer_class_type</code>.</span></li>
      <li><span><b>SET NULL</b> — для необязательных ссылок, без которых строка живёт: «кто привёл».</span></li></ul>
      <p>Главное: <b>клиента в «Пульсе» не удаляют вообще</b>. Его обезличивают: <code>phone</code>, <code>full_name</code>, <code>email</code>, <code>birth_date</code> → NULL, <code>anonymized_at = now()</code>. RESTRICT на платежах — страховка: даже если кто-то в спешке напишет <code>DELETE</code>, база не даст.</p>`,
    report: ans => FKS.map(f => `- ${f.t.replace(/<[^>]+>/g, '')} → ${((ans.m || {})[f.id] || '—').toUpperCase()}${(ans.m || {})[f.id] === f.ok ? ' ✓' : ''}`).join('\n') +
      `\n\nПросьба Анны: ${(ans.q || []).length ? (QDEL.options[ans.q[0]].ok ? 'обезличивание ✓' : '«' + QDEL.options[ans.q[0]].t.slice(0, 60) + '…» ✗') : '—'}. Опыт: ${ans.run === 'del' ? 'пробовал DELETE' : ans.run === 'anon' ? 'обезличил' : 'не проводил'}.`
  };

  TR.stage({
    id: 'physical', act: 2, order: 60, slot: 'Чт 10:00', title: 'Физическая модель',
    when: 'четверг, 10:00 · переговорная «Пилатес» · с Тимуром и бэкендерами',
    intro: [
      { who: 'timur', html: 'Бэкендеры спрашивают: «Какие типы? Какие ограничения? Проверки делаем в Java или в базе?» Нам нужна физическая модель под PostgreSQL 16 — управляемый, в Yandex Cloud.' },
      { who: 'vera', html: 'Физическая модель — это логическая, переведённая на язык конкретной базы: типы, ключи, ограничения, индексы. Главная мысль дня: правило, которое держит сама база, нельзя обойти ни багом, ни гонкой, ни вторым администратором. Выберете механизмы — а потом мы вашу схему атакуем.' }
    ],
    facts: ['F-money', 'F-clubs', 'F-capacity', 'F-double', 'F-trainer-overlap', 'F-overlap', 'F-freeze', 'F-refund', 'F-client-id', 'F-delete', 'F-history', 'F-pentest', 'F-team'],
    glossary: [
      { term: 'Физическая модель', simple: 'Чертёж базы под конкретную СУБД: какие типы, ключи, ограничения и индексы. Как рабочий чертёж зала с размерами, а не эскиз.', tech: 'DDL для PostgreSQL 16: CREATE TABLE с типами, PRIMARY KEY, FOREIGN KEY, UNIQUE, CHECK, EXCLUDE, индексы, партиции.' },
      { term: 'Ограничение целостности', simple: 'Правило, которое база проверяет сама при каждой записи. Как турникет: не уговорить и не обмануть.', tech: 'Constraint: NOT NULL, UNIQUE, CHECK, FOREIGN KEY, EXCLUDE. При нарушении — ошибка с SQLSTATE класса 23.' },
      { term: 'CHECK', simple: 'Проверка значения внутри одной строки: «заморозка не короче 7 дней».', tech: 'CHECK видит только поля своей строки и должен быть неизменным во времени: подсчёты других строк и current_date в нём не работают как правило.' },
      { term: 'Частичный уникальный индекс', simple: 'Уникальность не среди всех, а только среди «живых»: одна активная запись, а отменённых — сколько угодно.', tech: "CREATE UNIQUE INDEX … ON booking (client_id, class_session_id) WHERE status IN ('booked','waitlist')." },
      { term: 'EXCLUDE', simple: 'Запрет на пересечение: два занятия одного тренера не могут накрыть друг друга по времени.', tech: 'EXCLUDE USING gist (trainer_id WITH =, tstzrange(starts_at, ends_at) WITH &&); нужно расширение btree_gist.' },
      { term: 'SELECT … FOR UPDATE', simple: 'Взять строку «на себя», пока работаешь с ней. Как повесить табличку «занято» на тренажёр: второй подождёт.', tech: 'Блокировка строки до конца транзакции. Нужна для правил между строками: сумма возвратов не больше платежа.' },
      { term: 'ON DELETE', simple: 'Что делать с теми, кто ссылается на удаляемую строку: удалить вместе, запретить или обнулить ссылку.', tech: 'CASCADE, RESTRICT, SET NULL. Для платежей — RESTRICT; клиента не удаляют, а обезличивают.' },
      { term: 'timestamptz', simple: 'Время с привязкой к часовому поясу: «09:00 по Екатеринбургу», а не просто «09:00».', tech: 'timestamp with time zone хранит момент в UTC и показывает в нужном поясе; у «Пульса» — по club.timezone.' }
    ],
    outro: 'Ваша схема прошла крещение огнём: двойные клики, гонки за последнее место, баги и опечатки отбиваются самой базой. Вы видели, где CHECK бессилен и почему проверка «только в приложении» проигрывает гонке. Завтра — нагрузка и репликация: выдержит ли одна база воскресенье 20:00 и что будет, если она упадёт.',
    tasks: [taskTypes, taskRules, taskAttack, taskDelete]
  });
})();
