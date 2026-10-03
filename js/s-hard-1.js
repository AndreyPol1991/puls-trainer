/* Неделя 3, среда 10:00: узкие места REST — повторы (идемпотентность), гонка за последнее место,
   одновременные правки (ETag + If-Match), PUT против PATCH. Каждое узкое место — лаборатория:
   переключили настройку → проиграли сценарий на ui.seq → увидели последствие в цифрах. */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc;

  if (!document.getElementById('h1-css')) document.head.insertAdjacentHTML('beforeend', `<style id="h1-css">
    .h1-set { display: grid; grid-template-columns: minmax(0, 210px) minmax(0, 1fr); gap: 8px 14px; align-items: center; }
    .h1-set > .lbl { font-size: 13.5px; color: var(--text-2); min-width: 0; }
    .h1-set > .seg { justify-self: start; max-width: 100%; }
    .h1-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .h1-stats .stat.cur { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
    .h1-stats .v { font-size: 18px; }
    :is([data-tid="double-pay"], [data-tid="key-rules"], [data-tid="last-bike"], [data-tid="etag-patch"], .h1-root) :not(pre) > code { white-space: normal; overflow-wrap: anywhere; }
    :is([data-tid="double-pay"], [data-tid="last-bike"], [data-tid="etag-patch"], .h1-root) .seg button { text-align: left; }
    .h1-box { display: grid; gap: 12px; padding: 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); min-width: 0; }
    .h1-box > * { min-width: 0; }
    .h1-root, .h1-root .stack, .h1-box { grid-template-columns: minmax(0, 1fr); }
    .h1-root .stack > *, .h1-root > * { min-width: 0; }
    :is([data-tid="double-pay"], [data-tid="last-bike"], [data-tid="etag-patch"], .h1-root) .seg button { white-space: normal; }
    @media (max-width: 640px) {
      .h1-set { grid-template-columns: minmax(0, 1fr); gap: 4px; }
      .h1-set > .lbl { margin-top: 8px; }
      .h1-stats { grid-template-columns: minmax(0, 1fr); }
    }
  </style>`);

  // ---------- общие помощники ----------
  const lock = (el, ro) => { if (ro) TR.$$('[data-seg] button', el).forEach(b => { b.disabled = true; }); };
  const mount = (el, cls) => { const d = document.createElement('div'); if (cls) d.className = cls; el.appendChild(d); return d; };

  // серия тестов: ответы в ans.q[i]
  function quizSet(el, ctx, QS) {
    QS.forEach((cfg, i) => {
      const d = mount(el, 'card flat');
      ui.quiz(d, Object.assign({}, cfg, {
        value: (ctx.ans.q || [])[i] || [], readonly: ctx.readonly, reveal: ctx.result,
        onChange: v => { const q = (ctx.ans.q || []).slice(); q[i] = v; ctx.ans.q = q; ctx.save(); if (cfg.onPick) cfg.onPick(v, ctx); }
      }));
    });
  }
  function quizSetScore(QS, q) {
    const res = QS.map((cfg, i) => ui.quizScore(cfg, (q || [])[i] || []));
    return { res, good: res.filter(r => r.ok).length, score: res.reduce((s, r) => s + r.score, 0) / QS.length };
  }
  const quizNotes = (QS, res, hints) => res.map((r, i) => ({ ok: r.ok, html: r.ok ? `Вопрос ${i + 1}: верно.` : `Вопрос ${i + 1}: ${hints[i]}` }));
  const quizRef = QS => QS.map(cfg => cfg.options.map((o, i) => o.ok ? i : -1).filter(i => i >= 0));
  const quizReport = (QS, q) => QS.map((cfg, i) => {
    const v = (q || [])[i] || [];
    const pick = v.map(j => cfg.options[j] ? String(cfg.options[j].t).replace(/<[^>]+>/g, '') : '?').join('; ') || '—';
    return `- ${String(cfg.q).replace(/<[^>]+>/g, '')}\n  → ${pick} ${ui.quizScore(cfg, v).ok ? '✓' : '✗'}`;
  }).join('\n');

  // =====================================================================
  // Подход 1. Двойное списание
  // =====================================================================
  const CK = [{ v: 'none', t: 'нет ключа' }, { v: 'fresh', t: 'новый на каждый повтор' }, { v: 'same', t: 'один на операцию' }];
  const STO = [{ v: 'none', t: 'не храним' }, { v: 'mem', t: 'в памяти экземпляра (их 3)' }, { v: 'db', t: 'таблица idempotency_key' }];
  const PPK = [{ v: 'no', t: 'не передаём' }, { v: 'yes', t: 'передаём Idempotence-Key' }];
  const SC = [
    { v: 'lost', t: '📶 Ответ потерялся — клиент повторил', k: 'Ответ потерялся' },
    { v: 'slow', t: '🐢 ПэйПоинт думает 10+ с — жмут ещё раз', k: 'ПэйПоинт думает 10+ с' },
    { v: 'tap', t: '👆 Двойной тап — два запроса разом', k: 'Двойной тап' }
  ];
  const PRICE = 540000; // 5 400 ₽ в копейках
  const tOf = (list, v) => (list.find(x => x.v === v) || { t: '—' }).t;
  const sigOf = a => `${a.ck}|${a.st}|${a.pp}`;
  const keyOf = (a, n) => a.ck === 'none' ? null : a.ck === 'fresh' ? 'k' + n : 'k1';
  const kTxt = k => k ? ` · ключ ${k}` : ' · без ключа';
  const hit = a => a.ck === 'same' && a.st === 'db';
  function charges(a, sc) {
    const pays = hit(a) ? 1 : 2;
    return sc === 'slow' ? pays * (a.pp === 'yes' ? 1 : 2) : pays;
  }
  function missWhy(a, k) {
    if (!k) return 'ключа нет → это новый платёж';
    if (a.ck === 'fresh') return `ключ ${k} новый → новый платёж`;
    if (a.st === 'none') return 'ключи не храним → новый платёж';
    return `балансировщик → экз. №2: ${k} не знаю`;
  }
  function missNote(a) {
    if (a.ck === 'none') return 'Без ключа два одинаковых POST для сервера — две покупки. Вдруг Анна и правда хочет два абонемента?';
    if (a.ck === 'fresh') return 'Приложение придумало новый ключ для повтора. Для сервера это другая операция: ключ работает, только если повтор несёт тот же ключ.';
    if (a.st === 'none') return 'Ключ пришёл, но сервер его нигде не записал — сравнивать не с чем.';
    return 'Ключ запомнил экземпляр №1 в своей памяти. Повтор балансировщик отправил на №2 — у того память своя, пустая. Повезёт в одном случае из трёх, поэтому такой баг ловят месяцами.';
  }
  function paySteps(a, sc) {
    const S = [], k1 = keyOf(a, 1), k2 = keyOf(a, 2), n = charges(a, sc), h = hit(a);
    const pk = p => a.pp === 'yes' ? ` · Idempotence-Key ${p}` : '';
    const store = (k, inst) => {
      if (!k || a.st === 'none') return;
      S.push(a.st === 'db'
        ? { from: 'api', to: 'api', t: `INSERT ${k} → in_progress`, kind: 'info', note: `Сервер записывает ключ ${k} в таблицу <code>idempotency_key</code> со статусом <code>in_progress</code> и отпечатком тела запроса. Первичный ключ <code>(owner, key)</code> не даст записать такой же второй раз.` }
        : { from: 'api', to: 'api', t: `экз. №${inst || 1}: ${k} в памяти`, kind: 'info', note: 'Экземпляр №1 запомнил ключ у себя в памяти. Ещё два экземпляра за балансировщиком об этом не знают.' });
    };
    const verdict = { from: 'app', to: 'pp', box: true, kind: n === 1 ? 'ok' : 'bad', t: n === 1 ? 'Итог: списали 5 400 ₽ один раз' : `Итог: списали ${n} раза — ${TR.fmtRub(n * PRICE)}`, note: n === 1 ? 'Одно списание. Повтор узнан и не превратился в новую оплату.' : `Двойное списание: Анна заплатила ${TR.fmtRub(n * PRICE)} вместо 5 400 ₽. Это ⚑ F-no-loss — «двойное списание — скандал».` };

    if (sc === 'lost') {
      S.push({ from: 'app', to: 'api', t: 'POST …/payments' + kTxt(k1), time: '0 с', note: `Анна в метро жмёт «Оплатить» абонемент за 5 400 ₽. Запрос <code>POST /memberships/{id}/payments</code> ${k1 ? 'с заголовком <code>Idempotency-Key: ' + k1 + '</code>' : 'без ключа'}.` });
      store(k1);
      S.push({ from: 'api', to: 'pp', t: 'создать платёж 5 400 ₽' + pk('p1'), note: 'Сервер создаёт у себя строку <code>payment</code> и просит ПэйПоинт списать деньги.' + (a.pp === 'yes' ? ' В заголовке <code>Idempotence-Key</code> — ключ этой строки платежа.' : '') });
      S.push({ from: 'pp', to: 'pp', box: true, t: 'списано 5 400 ₽' });
      S.push({ from: 'pp', to: 'api', t: '201 · платёж создан', reply: true });
      if (k1 && a.st === 'db') S.push({ from: 'api', to: 'api', t: `${k1} → done, ответ сохранён`, kind: 'info', note: 'Сервер сохраняет код и тело ответа рядом с ключом. Повтор получит ровно этот ответ.' });
      S.push({ from: 'api', to: 'app', t: '201 — потерялся в тоннеле', reply: true, lost: true, kind: 'bad', time: '1 с', note: 'Деньги уже списаны, но ответ до телефона не дошёл. Приложение не знает, прошла ли оплата.' });
      S.push({ from: 'app', to: 'app', t: 'таймаут → повторяю', kind: 'warn', time: '10 с', note: 'Через 10 секунд приложение сдаётся и повторяет запрос. Это правильное поведение: молчание не значит «не прошло».' });
      S.push({ from: 'app', to: 'api', t: 'повтор POST' + kTxt(k2), note: k2 ? `Повтор несёт ключ ${k2}.` : 'Повтор без ключа.' });
      if (h) {
        S.push({ from: 'api', to: 'api', t: `${k1} найден: done`, kind: 'ok', note: 'Ключ найден в таблице со статусом <code>done</code>, отпечаток тела совпал — сервер не идёт в ПэйПоинт, а отдаёт сохранённый ответ.' });
        S.push({ from: 'api', to: 'app', t: '201 — тот же платёж', reply: true, kind: 'ok', note: 'Анна видит «Оплачено». Для неё повтор неотличим от первого ответа.' });
      } else {
        S.push({ from: 'api', to: 'api', t: missWhy(a, k2), kind: 'bad', note: missNote(a) });
        S.push({ from: 'api', to: 'pp', t: 'создать платёж 5 400 ₽' + pk('p2'), kind: 'bad', note: a.pp === 'yes' ? 'Ключ в ПэйПоинт не спасает: наш сервер создал вторую строку платежа, и у неё свой ключ p2. Для ПэйПоинта это честная новая оплата.' : 'Второй платёж уходит в ПэйПоинт.' });
        S.push({ from: 'pp', to: 'pp', box: true, t: 'ещё −5 400 ₽', kind: 'bad' });
        S.push({ from: 'api', to: 'app', t: '201 — второй платёж', reply: true, kind: 'bad' });
      }
    }

    if (sc === 'slow') {
      S.push({ from: 'app', to: 'api', t: 'POST …/payments' + kTxt(k1), time: '0 с', note: 'Воскресный вечер, ПэйПоинт перегружен (F-psp-slow: в пик отвечает по 10+ секунд).' });
      store(k1);
      S.push({ from: 'api', to: 'pp', t: 'создать платёж' + pk('p1') });
      S.push({ from: 'pp', to: 'pp', box: true, t: 'думает… 10+ с', kind: 'warn', note: 'ПэйПоинт принял запрос и обрабатывает его. Ответа пока нет.' });
      S.push({ from: 'app', to: 'app', t: 'крутится 3 с — жмёт ещё раз', kind: 'warn', time: '3 с', note: 'Анна видит бесконечный индикатор и нажимает «Оплатить» ещё раз.' });
      S.push({ from: 'app', to: 'api', t: 'ещё POST' + kTxt(k2) });
      if (h) {
        S.push({ from: 'api', to: 'api', t: `${k1}: in_progress`, kind: 'ok', note: 'Ключ есть, но первый запрос ещё не закончен. Нельзя ни начинать заново, ни отдавать ответ — его ещё нет.' });
        S.push({ from: 'api', to: 'app', t: '409 · ещё обрабатывается', reply: true, kind: 'ok', note: 'Сервер отвечает 409 «запрос с этим ключом ещё обрабатывается» и подсказывает <code>Retry-After</code>. Приложение покажет «Платёж обрабатывается».' });
      } else {
        S.push({ from: 'api', to: 'api', t: missWhy(a, k2), kind: 'bad', note: missNote(a) });
        S.push({ from: 'api', to: 'pp', t: 'второй платёж' + pk('p2'), kind: 'bad' });
      }
      S.push({ from: 'api', to: 'api', t: 'ПэйПоинт молчит 5 с → повтор', kind: 'warn', time: '5 с', note: 'Наш таймаут к ПэйПоинту — 5 секунд. Сервер сам повторяет запрос: теперь уже он клиент, который не знает, прошла ли оплата.' });
      S.push({ from: 'api', to: 'pp', t: 'повтор: создать платёж' + (a.pp === 'yes' ? ' · тот же p1' : ' · без ключа'), kind: a.pp === 'yes' ? '' : 'bad' });
      S.push(a.pp === 'yes'
        ? { from: 'pp', to: 'pp', box: true, t: 'p1 знаком — не списал', kind: 'ok', note: 'ПэйПоинт узнал свой ключ и вернул тот же платёж — денег не списал (F-psp: они поддерживают Idempotence-Key).' }
        : { from: 'pp', to: 'pp', box: true, t: 'ещё −5 400 ₽', kind: 'bad', note: 'Без ключа ПэйПоинт видит два независимых запроса и списывает дважды.' });
      if (!h) S.push({ from: 'api', to: 'api', t: a.pp === 'yes' ? 'со вторым платежом — так же' : 'со вторым платежом — то же ×2', kind: 'bad', note: 'Второй платёж из повторного нажатия проходит тот же путь.' });
      S.push({ from: 'pp', to: 'api', t: '201 (через 11 с)', reply: true, time: '11 с' });
    }

    if (sc === 'tap') {
      S.push({ from: 'app', to: 'app', t: 'двойной тап по «Оплатить»', kind: 'warn', note: 'Палец дрогнул — два нажатия за 40 мс. Кнопку не успели заблокировать.' });
      S.push({ from: 'app', to: 'api', t: 'POST №1' + kTxt(k1), time: '0 мс' });
      S.push({ from: 'app', to: 'api', t: 'POST №2' + kTxt(k2), time: '40 мс', note: a.ck === 'same' ? 'Ключ приложение придумало, когда открылся экран оплаты, — оба нажатия несут один ключ.' : (a.ck === 'fresh' ? 'Каждое нажатие получило свой ключ.' : 'Оба запроса без ключа.') });
      if (h) {
        S.push({ from: 'api', to: 'api', t: `экз. №1: INSERT ${k1} → ок`, kind: 'info' });
        S.push({ from: 'api', to: 'api', t: `экз. №2: INSERT ${k1} → конфликт PK`, kind: 'ok', note: 'Оба экземпляра пишут в одну таблицу. Первичный ключ <code>(owner, key)</code> пропускает только первую вставку — проверка и захват ключа происходят одной командой, гонки нет.' });
        S.push({ from: 'api', to: 'app', t: '409 на второй запрос', reply: true, kind: 'ok' });
        S.push({ from: 'api', to: 'pp', t: 'создать платёж' + pk('p1') });
        S.push({ from: 'pp', to: 'pp', box: true, t: 'списано 5 400 ₽' });
        S.push({ from: 'api', to: 'app', t: '201 на первый запрос', reply: true, kind: 'ok' });
      } else {
        const why = !k1 ? 'ключа нет: два новых платежа' : a.ck === 'fresh' ? 'k1 и k2 разные: два платежа' : a.st === 'none' ? 'ключи не храним: два платежа' : 'у экз. №1 и №2 память своя';
        S.push({ from: 'api', to: 'api', t: why, kind: 'bad', note: missNote(a) });
        S.push({ from: 'api', to: 'pp', t: 'платёж №1' + pk('p1') });
        S.push({ from: 'api', to: 'pp', t: 'платёж №2' + pk('p2'), kind: 'bad' });
        S.push({ from: 'pp', to: 'pp', box: true, t: 'списано дважды', kind: 'bad' });
        S.push({ from: 'api', to: 'app', t: '201 и ещё раз 201', reply: true, kind: 'bad' });
      }
    }
    S.push(verdict);
    return S;
  }
  const LANES_PAY = [{ id: 'app', t: 'Приложение', sub: 'Анна, 5 400 ₽' }, { id: 'api', t: 'API «Пульса»', sub: '3 экземпляра' }, { id: 'pp', t: 'ПэйПоинт', sub: 'платёжный сервис' }];

  function payStats(a, cur) {
    const sig = sigOf(a);
    return `<div class="h1-stats">${SC.map(s => {
      const seen = (a.seen || []).includes(sig + '|' + s.v), n = charges(a, s.v);
      return `<div class="stat ${s.v === cur ? 'cur' : ''}"><div class="k">${esc(s.k)}</div><div class="v ${seen ? (n === 1 ? 'ok' : 'bad') : ''}">${seen ? `${n} × 5 400 ₽` : '—'}</div><div class="s small dim">${seen ? (n === 1 ? 'одно списание' : 'Анна заплатила ' + TR.fmtRub(n * PRICE)) : 'ещё не прогнан с этими настройками'}</div></div>`;
    }).join('')}</div>`;
  }
  function payVerdict(a) {
    const sig = sigOf(a), all = SC.every(s => (a.seen || []).includes(sig + '|' + s.v));
    if (!all) return `<p class="small dim">Прогоните все три сценария с одними настройками — тогда будет видно, держит ли защита.</p>`;
    const bad = SC.filter(s => charges(a, s.v) > 1);
    return bad.length
      ? ui.note('bad', 'Защита дырявая', `Двойное списание в сценариях: ${bad.map(s => '«' + esc(s.k) + '»').join(', ')}. Меняйте настройки и прогоняйте снова.`)
      : ui.note('ok', 'Во всех трёх сценариях — одно списание', 'Эти настройки держат и потерю ответа, и долгий ПэйПоинт, и двойной тап. Нажмите «Проверить».');
  }

  const payTask = {
    id: 'double-pay', title: 'Двойное списание',
    simple: {
      icon: '🧾', plain: 'Повтор запроса не должен повторять действие. Если оплата уже прошла, второй такой же запрос должен получить «уже оплачено», а не списать деньги ещё раз.',
      analogy: 'Кофейня: вы оплатили заказ, но не дождались чека и подошли снова. Хороший кассир спросит номер заказа и скажет «уже оплачено». Плохой пробьёт ещё раз. Номер заказа — это ключ идемпотентности.',
      tech: 'POST не идемпотентен. Защита: клиент придумывает <code>Idempotency-Key</code> (UUID) один раз на операцию и повторяет его при ретраях; сервер хранит ключ, отпечаток тела и ответ. Наш сервер, в свою очередь, передаёт <code>Idempotence-Key</code> в ПэйПоинт (F-psp).'
    },
    lead: ui.brief({
      situation: `Анна в метро оплачивает абонемент за 5 400 ₽. Платёж идёт через три участника: приложение → наш сервер (API «Пульса») → платёжный сервис ПэйПоинт. Один и тот же запрос может прийти дважды: ответ потерялся в тоннеле; ПэйПоинт думает 10+ секунд, и Анна жмёт ещё раз; палец дрогнул — двойное нажатие. Задача — чтобы деньги списались ровно один раз.`,
      todo: [
        `В блоке «Настройки защиты» выберите три вещи: присылает ли приложение ключ <code>Idempotency-Key</code>; где сервер хранит ключи; передаёт ли наш сервер свой ключ в ПэйПоинт.`,
        `Нажмите по очереди все три сценария под настройками — каждый проиграется на схеме.`,
        `Цель — «1 × 5 400 ₽» во всех трёх счётчиках. «Проверить» смотрит на настройки: держат ли они все три сценария.`
      ],
      look: `<p><code>Idempotency-Key</code> — номер операции, как номер заказа в кофейне. Пришёл запрос с уже знакомым номером — значит, это повтор, а не новая покупка. У нашего сервера 3 экземпляра — три одинаковые копии программы; запросы между ними раздаёт балансировщик.</p><p>Схема читается сверху вниз: стрелка — запрос, пунктир — ответ, красный крест — ответ потерялся, под схемой пояснения к шагам. Счётчики над схемой — сколько раз списали деньги в каждом сценарии; «—» значит, с этими настройками сценарий ещё не прогоняли.</p>`
    }),
    blank: () => ({ ck: 'none', st: 'none', pp: 'no', sc: 'lost', seen: [] }),
    reference: () => ({ ck: 'same', st: 'db', pp: 'yes', sc: 'lost', seen: SC.map(s => 'same|db|yes|' + s.v) }),
    render(el, ctx) {
      el.classList.add('h1-root');
      const a = ctx.ans;
      a.seen = a.seen || [];
      const k0 = sigOf(a) + '|' + a.sc;   // диаграмма сразу показана целиком — это сочетание считаем просмотренным
      if (!ctx.readonly && !a.seen.includes(k0)) { a.seen.push(k0); ctx.save(); }
      el.innerHTML = `<div class="stack">
        <div class="h1-box">
          <div class="eyebrow">Настройки защиты</div>
          <div class="h1-set">
            <div class="lbl">Приложение: <code>Idempotency-Key</code></div>${ui.seg('ck', CK, a.ck, 'accent')}
            <div class="lbl">Сервер хранит ключи</div>${ui.seg('st', STO, a.st, 'accent')}
            <div class="lbl">Сервер → ПэйПоинт</div>${ui.seg('pp', PPK, a.pp, 'accent')}
          </div>
        </div>
        <div class="stack tight"><div class="eyebrow">Сценарий — выберите, и он проиграется</div>${ui.seg('sc', SC, a.sc)}</div>
        <div data-stats></div>
        <div data-seq></div>
        <div data-verdict></div>
      </div>`;
      lock(TR.$('.h1-box', el), ctx.readonly);
      const stats = TR.$('[data-stats]', el), verdictEl = TR.$('[data-verdict]', el);
      const redrawStats = () => { stats.innerHTML = payStats(a, a.sc); verdictEl.innerHTML = payVerdict(a); };
      const seq = ui.seq(TR.$('[data-seq]', el), {
        lanes: LANES_PAY, steps: paySteps(a, a.sc), start: 'all', speed: 750, laneW: 190,
        title: 'Оплата абонемента: приложение, API «Пульса», ПэйПоинт',
        hint: 'Нажмите «Проиграть» — или выберите сценарий выше.',
        onEnd() {
          const k = sigOf(a) + '|' + a.sc;
          if (!ctx.readonly && !a.seen.includes(k)) { a.seen.push(k); ctx.save(); }
          redrawStats();
        }
      });
      redrawStats();
      ui.onSeg(el, (name, v) => {
        if (ctx.readonly && name !== 'sc') return;
        a[name] = v;
        if (!ctx.readonly) {
          ctx.save();
          if (name !== 'sc') ctx.decide('Защита оплаты от повторов', `ключ клиента: ${tOf(CK, a.ck)}; хранение: ${tOf(STO, a.st)}; ключ в ПэйПоинт: ${tOf(PPK, a.pp)}`);
        }
        seq.set(paySteps(a, a.sc), { play: name === 'sc' });
        redrawStats();
      });
    },
    check(ans) {
      const notes = []; let pts = 0;
      if (ans.ck === 'same') { pts += 35; notes.push({ ok: true, html: 'Приложение шлёт один ключ на одну операцию — повтор узнаваем.' }); }
      else if (ans.ck === 'fresh') notes.push({ ok: false, html: 'Новый ключ на каждый повтор — для сервера это каждый раз новая операция. Ключ — как номер заказа в кофейне: если при каждом подходе называть новый номер, кассир пробьёт снова.' });
      else notes.push({ ok: false, html: 'Без ключа сервер не отличит повтор от второй покупки: запросы одинаковые, а клиент вправе купить два абонемента.' });
      if (ans.st === 'db') { pts += 35; notes.push({ ok: true, html: 'Ключи в таблице с первичным ключом видят все экземпляры, и они переживают перезапуск.' }); }
      else if (ans.st === 'mem') notes.push({ ok: false, html: 'Память одного экземпляра не видят два других: балансировщик отправит повтор к соседу. А после релиза память пуста. Где хранить то, что должны видеть все экземпляры?' });
      else notes.push({ ok: false, html: 'Ключ, который сервер нигде не записал, бесполезен: повтор не с чем сравнить.' });
      if (ans.pp === 'yes') { pts += 30; notes.push({ ok: true, html: 'Ключ уходит и в ПэйПоинт — наш собственный повтор после таймаута не спишет второй раз.' }); }
      else notes.push({ ok: false, html: 'Наш сервер — тоже клиент, только для ПэйПоинта. Когда он сам повторяет запрос после 5-секундного таймаута, кто узнает этот повтор? Прогоните сценарий «ПэйПоинт думает 10+ с».' });
      const score = pts / 100;
      const sum = SC.map(s => `${esc(s.k)} — <b>${charges(ans, s.v)}</b>`).join(' · ');
      return {
        ok: pts === 100, score, notes,
        summary: `Сколько раз спишут 5 400 ₽ при ваших настройках: ${sum}.`,
        vera: pts === 100 ? null : 'Подсказка: защита нужна на двух участках — между приложением и нами и между нами и ПэйПоинтом. И ключ мало передать, его надо где-то запомнить так, чтобы видели все.'
      };
    },
    explain: `<p>Работают только <b>все три</b> слоя вместе:</p>
      <ul class="checks">
        <li><b>Один ключ на операцию.</b> Приложение создаёт UUID, когда открылся экран оплаты, и повторяет его при любом ретрае и двойном тапе. Новый ключ — только для новой покупки.</li>
        <li><b>Таблица <code>idempotency_key</code> с первичным ключом <code>(owner, key)</code>.</b> Вставка ключа — одна атомарная команда: два одновременных запроса не пройдут оба. Статус <code>in_progress</code> → 409, <code>done</code> → сохранённый ответ. Память экземпляра не годится: их три, и они перезапускаются при каждом релизе.</li>
        <li><b><code>Idempotence-Key</code> в ПэйПоинт</b> — ключ нашей строки <code>payment</code> (<code>payment.idempotency_key</code>). Наш таймаут 5 с, а ПэйПоинт в пик думает 10+ с: без ключа наш же ретрай спишет второй раз. Правило карты интеграций: «ретраи только с ключом».</li>
      </ul>
      ${ui.code(`INSERT INTO idempotency_key (owner, key, request_hash, status)
VALUES ('client:' || $1, $2, $3, 'in_progress')
[[ok]]ON CONFLICT (owner, key) DO NOTHING[[/]]
RETURNING key;   -- 0 строк → ключ уже есть: смотрим status и request_hash`, 'sql', 'Захват ключа одной командой')}
      <p>Стандарт: IETF draft «The Idempotency-Key HTTP Header Field». Ключ живёт 24 часа — дольше любого разумного окна повторов. Подробности — в следующем подходе.</p>`,
    report: ans => `Настройки: ключ клиента — ${tOf(CK, ans.ck)}; хранение — ${tOf(STO, ans.st)}; ключ в ПэйПоинт — ${tOf(PPK, ans.pp)}.\nСписаний: ${SC.map(s => `${s.k} — ${charges(ans, s.v)}`).join('; ')}.\nПрогнано сценариев: ${(ans.seen || []).length}.`
  };

  // =====================================================================
  // Подход 2. Тонкости ключа
  // =====================================================================
  const KQ = [
    {
      q: 'Повтор оплаты пришёл с тем же <code>Idempotency-Key</code>, но в теле уже другой абонемент: Анна успела переключиться на «Сеть 12 мес». Что ответит сервер?', seed: 'h1-k1',
      options: [
        { t: '<code>422</code>: ключ уже использован для другого запроса — отпечаток тела (<code>request_hash</code>) не совпал', ok: 1, why: 'Верно. Ключ привязан к конкретному запросу. Другое тело с тем же ключом — ошибка приложения, о ней надо сказать честно.' },
        { t: '<code>201</code> и новый платёж: тело другое, значит и операция новая', why: 'Тогда ключ теряет смысл: ошибка в приложении (ключ не сменили) приведёт к оплате не того, что ждали.' },
        { t: 'Сохранённый ответ первого запроса — <code>201</code> за первый абонемент', why: 'Анна увидит «оплачено», хотя просила другое. Молча вернуть чужой результат хуже, чем честная ошибка.' },
        { t: '<code>409 Conflict</code>', why: '409 по канону «Пульса» — «тот же ключ, первый запрос ещё обрабатывается». Здесь другое: ключ переиспользован с другим телом.' }
      ]
    },
    {
      q: 'Первый запрос ещё ждёт ПэйПоинт, а с тем же ключом и тем же телом пришёл второй. Что делает сервер?', seed: 'h1-k2',
      options: [
        { t: '<code>409</code> «запрос с этим ключом ещё обрабатывается», можно с <code>Retry-After</code>', ok: 1, why: 'Верно. Ответа ещё нет — отдавать нечего, а начинать заново нельзя.' },
        { t: 'Создаёт второй платёж — вдруг первый завис', why: 'Это и есть двойное списание. Зависший первый запрос разбирает сервер, а не клиент повтором.' },
        { t: '<code>201</code> без тела', why: 'Клиент решит, что всё готово, хотя оплата ещё не прошла и может не пройти.' },
        { t: 'Держит второе соединение открытым, пока ПэйПоинт не ответит', why: 'Можно, если ожидание короткое. Но ПэйПоинт в пик думает 10+ секунд — держать сотни соединений дорого. Канон «Пульса» — 409.' }
      ]
    },
    {
      q: 'Оплата прошла, ответ сохранён. Через 20 секунд приходит повтор с тем же ключом и тем же телом. Что вернуть?', seed: 'h1-k3',
      options: [
        { t: 'Тот же <code>201</code> с тем же телом — сохранённый ответ', ok: 1, why: 'Верно. Для клиента повтор неотличим от первого ответа: он просто наконец узнал, чем всё кончилось.' },
        { t: '<code>200 OK</code> «уже оплачено»', why: 'Приложению придётся различать два вида успеха. Проще и надёжнее — тот же ответ.' },
        { t: '<code>409</code> «ключ уже использован»', why: 'Клиент спрашивает «чем кончилось?». Ошибка его напугает, хотя всё прошло.' },
        { t: '<code>422</code>', why: '422 — для другого тела с тем же ключом. Здесь тело то же.' }
      ]
    },
    {
      q: 'Сколько хранить запись в <code>idempotency_key</code>?', seed: 'h1-k4',
      options: [
        { t: '24 часа — дольше любого разумного окна повторов; потом удаляем фоновой задачей', ok: 1, why: 'Верно. Срок больше окна ретраев, но не вечность.' },
        { t: 'Вечно — вдруг повторят через год', why: 'Таблица растёт без конца, а повтор через год — уже новая операция.' },
        { t: '5 секунд — как таймаут к ПэйПоинту', why: 'Повтор после потери сети приходит через минуты. Ключ к тому времени забыт — двойное списание вернулось.' },
        { t: 'До перезапуска сервера', why: 'Это хранение в памяти. Выкатили релиз — защита пропала.' }
      ]
    },
    {
      q: 'ФитПасс и приложение Анны случайно прислали одинаковый ключ «1001». Что произойдёт?', seed: 'h1-k5',
      options: [
        { t: 'Ничего страшного: первичный ключ таблицы — <code>(owner, key)</code>, у каждого владельца свои ключи', ok: 1, why: 'Верно. И это ещё и защита: никто не получит чужой сохранённый ответ, угадав ключ.' },
        { t: 'ФитПасс получит сохранённый ответ Анны', why: 'Так было бы при глобальном ключе — и это утечка чужих данных. Поэтому ключ хранят вместе с владельцем.' },
        { t: '<code>422</code>: тело другое', why: 'Партнёр не виноват, что ключи совпали. Ключи разных владельцев не должны пересекаться.' },
        { t: 'Запретим партнёрам короткие ключи — и всё', why: 'Формат UUID стоит рекомендовать, но защищает не формат, а область действия ключа.' }
      ]
    }
  ];
  const KQ_HINT = [
    'сервер помнит не только ключ, но и отпечаток тела. Что он должен сделать, если отпечаток другой?',
    'первый запрос ещё не закончен. Можно ли отдать ответ, которого нет? Можно ли начать заново?',
    'клиент повторяет, потому что не узнал результат. Какой ответ ему нужен?',
    'ключ должен пережить окно повторов клиента (минуты, часы), но не копиться вечно.',
    'ключ придумывает клиент. Чьи ключи могут совпасть и что тогда?'
  ];
  const keyTask = {
    id: 'key-rules', title: 'Тонкости ключа',
    simple: {
      icon: '🎟️', plain: 'Ключ сам по себе — просто строка. Важно, что сервер делает, когда видит его второй раз.',
      analogy: 'Номерок в гардеробе. По номерку отдают ту же куртку, а не новую. Если с вашим номерком пришли за чужим пальто — гардеробщик заметит. Пока куртку несут — «подождите минутку». Номерки двух гардеробов не путаются. Вечером номерки собирают.',
      tech: 'Таблица <code>idempotency_key</code>: <code>(owner, key)</code> PK, <code>request_hash</code>, <code>status</code> (<code>in_progress | done</code>), <code>response_code</code>, <code>response_body</code>, <code>created_at</code>, срок жизни 24 часа.'
    },
    lead: ui.brief({
      situation: `Ключ сам по себе — просто строка, например <code>7f3c2b9e-…</code>. Сервер записывает его в таблицу <code>idempotency_key</code>: чей ключ, отпечаток тела запроса (короткая «подпись» содержимого — по ней видно, то же тело или другое), статус «в работе» или «готово» и сохранённый ответ. Всё решает, что сервер сделает, когда увидит ключ второй раз.`,
      todo: [
        `Прочитайте пять ситуаций: в каждой ключ пришёл повторно или совпал с чужим.`,
        `В каждой выберите, как должен поступить сервер.`,
        `Нажмите «Проверить». Нужно 4 верных ответа из 5.`
      ],
      lookTitle: `Подсказка по кодам`,
      look: `<code>201</code> — создано. <code>409</code> — конфликт с текущим состоянием дел. <code>422</code> — запрос понятен, но по правилам выполнить нельзя. В каждой ситуации спросите себя: что клиент хочет узнать и не спишем ли мы деньги второй раз?`
    }),
    blank: () => ({ q: [] }),
    reference: () => ({ q: quizRef(KQ) }),
    render(el, ctx) { el.className = 'stack h1-root'; quizSet(el, ctx, KQ); },
    check(ans) {
      const r = quizSetScore(KQ, ans.q);
      return { ok: r.good >= 4, score: r.score, summary: `Верно: ${r.good} из ${KQ.length}.`, notes: quizNotes(KQ, r.res, KQ_HINT) };
    },
    explain: `<p>Четыре исхода по одному ключу — это и есть контракт идемпотентности:</p>
      ${ui.table(['Что нашли по ключу', 'Ответ'], [
        ['Ключа нет', 'выполняем, сохраняем ответ'],
        ['<code>in_progress</code>, то же тело', ui.st(409) + ' ещё обрабатывается'],
        ['<code>done</code>, то же тело', 'сохранённый ответ (тот же ' + ui.st(201) + ')'],
        ['то же <code>(owner, key)</code>, другое тело', ui.st(422) + ' ключ использован для другого запроса']
      ])}
      ${ui.http({ status: 422, headers: { 'Content-Type': 'application/problem+json' }, body: { type: 'https://api.puls.fit/problems/idempotency-key-reused', title: 'Ключ уже использован для другого запроса', status: 422, detail: 'С этим Idempotency-Key уже оплачивали абонемент «Сеть 1 мес». Для новой покупки нужен новый ключ.' } })}
      <p>Отпечаток тела — хэш нормализованного JSON. Ключ хранится 24 часа. Владелец — <code>client:&lt;public_id&gt;</code> или <code>partner:&lt;code&gt;</code>: для ФитПасса <code>Idempotency-Key</code> на POST обязателен, а ретраят они всё (F-fitpass-tech).</p>`,
    report: ans => quizReport(KQ, ans.q)
  };

  // =====================================================================
  // Подход 3. Гонка за последнее место
  // =====================================================================
  const STRAT = [
    { v: 'count', t: 'SELECT count, потом INSERT' },
    { v: 'forupd', t: 'SELECT … FOR UPDATE' },
    { v: 'atomic', t: 'атомарный UPDATE … < capacity' },
    { v: 'uniq', t: 'уникальный индекс' }
  ];
  const RACE = {
    count: { seats: 21, b: '201 — 21-й в зале', lock: 'нет', ok: false },
    forupd: { seats: 20, b: '409', lock: 'вся транзакция А', ok: true },
    atomic: { seats: 20, b: '409 + ссылка в лист ожидания', lock: 'одна команда', ok: true },
    uniq: { seats: 21, b: '201 — 21-й в зале', lock: 'нет', ok: false }
  };
  const LANES_RACE = [{ id: 'a', t: 'Клиент А', sub: 'Анна' }, { id: 'b', t: 'Клиент Б', sub: 'Пётр' }, { id: 'db', t: 'PostgreSQL', sub: 'занято 19 из 20' }];
  function raceSteps(s) {
    const S = [];
    if (s === 'count' || s === 'uniq') {
      S.push({ from: 'a', to: 'db', t: 'SELECT count(*) …', time: '.000', note: 'Воскресенье, 20:00:00. Анна и Пётр одновременно жмут «Записаться» на последний велосипед.' });
      S.push({ from: 'b', to: 'db', t: 'SELECT count(*) …', time: '.002' });
      S.push({ from: 'db', to: 'a', t: '19 < 20 — место есть', reply: true });
      S.push({ from: 'db', to: 'b', t: '19 < 20 — место есть', reply: true, kind: 'warn', note: 'Оба видят одно и то же: 19 записей. Ни один ещё ничего не вставил, и проверка ничего не заняла.' });
      S.push({ from: 'a', to: 'db', t: 'INSERT booking', time: '.004' });
      S.push({ from: 'b', to: 'db', t: 'INSERT booking', time: '.005' });
      if (s === 'uniq') S.push({ from: 'db', to: 'db', box: true, t: 'индекс доволен ✓', kind: 'warn', note: 'Уникальный индекс <code>booking_one_active (client_id, class_session_id)</code> проверяет, что <b>один клиент</b> не записан дважды. Анна и Пётр — разные клиенты, индекс доволен.' });
      S.push({ from: 'db', to: 'db', box: true, t: 'COMMIT ×2: 21 запись', kind: 'bad' });
      S.push({ from: 'a', to: 'db', box: true, kind: 'bad', t: 'В сайкл-студии на 20 велосипедов записан 21 человек', note: 'Check-then-act: проверка и действие — разные шаги, между ними вклинился другой. «Двое на одном велосипеде — скандал» (F-capacity).' });
    }
    if (s === 'forupd') {
      S.push({ from: 'a', to: 'db', t: 'SELECT … FOR UPDATE', time: '.000', note: 'Анна первой запирает строку занятия в <code>class_session</code>.' });
      S.push({ from: 'db', to: 'db', box: true, t: 'строка заперта за А', kind: 'info' });
      S.push({ from: 'b', to: 'db', t: 'SELECT … FOR UPDATE', time: '.002' });
      S.push({ from: 'db', to: 'db', box: true, t: 'Б ждёт замок', kind: 'warn', note: 'Пётр стоит в очереди к замку. Ждёт он всю транзакцию Анны: проверку, вставку записи, обновление счётчика.' });
      S.push({ from: 'a', to: 'db', t: '19 < 20 → INSERT, +1', time: '.004' });
      S.push({ from: 'a', to: 'db', t: 'COMMIT — замок снят', time: '.015', kind: 'ok' });
      S.push({ from: 'db', to: 'b', t: 'строка отдана: 20 из 20', reply: true });
      S.push({ from: 'b', to: 'db', t: 'мест нет → ROLLBACK, 409', kind: 'ok' });
      S.push({ from: 'a', to: 'db', box: true, kind: 'ok', t: '20 из 20. Пётр ждал всю транзакцию Анны', note: 'Перебора нет. Цена — замок держится всю транзакцию; при 3000 человек за 5 минут очередь к популярному занятию растёт.' });
    }
    if (s === 'atomic') {
      S.push({ from: 'a', to: 'db', t: 'UPDATE … +1 WHERE … < capacity', time: '.000', note: 'Проверка и захват места — <b>одна команда</b>: <code>UPDATE class_session SET booked_count = booked_count + 1 WHERE id = $1 AND booked_count &lt; capacity</code>.' });
      S.push({ from: 'db', to: 'a', t: '1 строка: стало 20', reply: true, kind: 'ok' });
      S.push({ from: 'b', to: 'db', t: 'тот же UPDATE', time: '.001' });
      S.push({ from: 'db', to: 'db', box: true, t: 'Б ждёт ~1 мс', kind: 'info', note: 'PostgreSQL не даст двум командам менять одну строку одновременно. Пётр ждёт миллисекунду, пока транзакция Анны закончится.' });
      S.push({ from: 'a', to: 'db', t: 'INSERT booking; COMMIT', time: '.003' });
      S.push({ from: 'db', to: 'b', t: '0 строк: условие уже ложно', reply: true, kind: 'ok', note: 'После коммита Анны PostgreSQL перепроверяет условие для Петра на свежей версии строки: 20 &lt; 20 — ложь, обновлено 0 строк.' });
      S.push({ from: 'b', to: 'b', t: '409 + ссылка в лист ожидания', kind: 'ok' });
      S.push({ from: 'a', to: 'db', box: true, kind: 'ok', t: '20 из 20. Замок — на одну короткую команду', note: 'Перебора нет, ожидание минимальное. Плюс страховка — <code>CHECK (booked_count BETWEEN 0 AND capacity)</code>: даже ошибка в коде не даст записать 21-го.' });
    }
    return S;
  }
  const RACE_SQL = {
    count: `BEGIN;
SELECT count(*) FROM booking
 WHERE class_session_id = $1 AND status = 'booked';   -- 19 < 20 → «место есть»
[[bad]]-- …тут может вклиниться кто угодно…[[/]]
INSERT INTO booking (client_id, class_session_id, status, source)
VALUES ($2, $1, 'booked', 'app');
COMMIT;`,
    forupd: `BEGIN;
SELECT capacity, booked_count FROM class_session
 WHERE id = $1 [[hl]]FOR UPDATE[[/]];        -- замок до COMMIT
-- booked_count < capacity? да →
INSERT INTO booking (client_id, class_session_id, status, source) VALUES ($2, $1, 'booked', 'app');
UPDATE class_session SET booked_count = booked_count + 1 WHERE id = $1;
COMMIT;`,
    atomic: `BEGIN;
UPDATE class_session
   SET booked_count = booked_count + 1
 WHERE id = $1 [[ok]]AND booked_count < capacity[[/]]
RETURNING booked_count;   -- 0 строк → мест нет → ROLLBACK, 409
INSERT INTO booking (client_id, class_session_id, status, source) VALUES ($2, $1, 'booked', 'app');
COMMIT;`,
    uniq: `CREATE UNIQUE INDEX booking_one_active ON booking (client_id, class_session_id)
  WHERE status IN ('booked','waitlist');
-- запрещает Анне записаться дважды (F-double),
-- [[bad]]но Анна и Пётр — разные строки, вместимость индекс не считает[[/]]`
  };
  const RQ = {
    q: 'Почему выбранная стратегия выдержит воскресенье 20:00?', multi: true, seed: 'h1-race',
    options: [
      { t: 'Проверка «есть ли место» и захват места происходят одной командой — между ними никто не вклинится', ok: 1, why: 'Да. Это лечит главную болезнь — check-then-act.' },
      { t: 'Строка занятия заперта на одну короткую команду, а не на всю транзакцию — очередь в пик короче', ok: 1, why: 'Да. У FOR UPDATE замок держится до COMMIT — при 3000 человек за 5 минут это заметно.' },
      { t: '<code>CHECK (booked_count BETWEEN 0 AND capacity)</code> — последняя страховка: база сама не пустит 21-го, даже если в коде забудут условие', ok: 1, why: 'Да. Правило живёт в базе, а не только в коде.' },
      { t: 'Уникальный индекс не даст записать 21-го', why: 'Уникальный индекс про «один клиент — одна запись». Двух разных клиентов он пропустит.' },
      { t: '<code>COUNT(*)</code> по записям быстрее, чем счётчик', why: 'Наоборот: счётчик — одна строка, а COUNT пересчитывает записи на каждом запросе. Да и проблема не в скорости, а в гонке.' }
    ]
  };
  const raceTask = {
    id: 'last-bike', title: 'Гонка за последнее место',
    simple: {
      icon: '🚲', plain: 'Двое одновременно видят «осталось 1 место» и оба его занимают. Проверка была, но ничего не заняла.',
      analogy: 'Последний велосипед в сайкл-студии. Двое заметили его от двери и пошли. Если «увидел свободный» и «сел» — два разных шага, сядут оба. Правильно — сесть сразу: кто сел, того и велосипед.',
      tech: 'Гонка (race condition) типа check-then-act. Лечится атомарной операцией (проверка внутри <code>UPDATE … WHERE</code>) или блокировкой строки (<code>SELECT … FOR UPDATE</code>). Уровень изоляции по умолчанию в PostgreSQL — READ COMMITTED.'
    },
    lead: ui.brief({
      situation: `Воскресенье, 20:00 — открылась запись на неделю, за 5 минут приходят 3000 человек. На «Сайкл» занято 19 велосипедов из 20. Анна и Пётр жмут «Записаться» в одну и ту же миллисекунду. Место одно, а запросов два. Не окажется ли в зале 21 человек?`,
      todo: [
        `Переключайте «Стратегию записи» — четыре способа, как сервер проверяет место в базе данных. Каждая проиграется на схеме.`,
        `Прогоните все четыре и сравните счётчики: сколько человек в зале, что получил Пётр, как долго держится замок.`,
        `В блоке «Ваше решение» выберите стратегию для пика воскресенья и отметьте все верные доводы «почему».`,
        `Засчитается, если стратегия годится для пика и доводы верны хотя бы на 60 %.`
      ],
      look: `<p>Колонки схемы: Анна, Пётр и база данных PostgreSQL. Сбоку — время в долях секунды. Под схемой — SQL выбранной стратегии. <b>Замок</b> — табличка «занято» на строке занятия: пока один её меняет, второй ждёт у двери. Чем дольше замок, тем длиннее очередь в пик.</p><p>Стратегии простыми словами: «SELECT count, потом INSERT» — сначала посчитать записи, потом записать; «FOR UPDATE» — запереть строку занятия на всё время записи; «атомарный UPDATE» — проверить и занять место одной командой; «уникальный индекс» — правило базы «не бывает двух строк с одинаковыми значениями этих полей».</p>`
    }),
    blank: () => ({ s: 'count', pick: null, seen: [], q: [] }),
    reference: () => ({ s: 'atomic', pick: 'atomic', seen: STRAT.map(x => x.v), q: quizRef([RQ]) }),
    render(el, ctx) {
      el.classList.add('h1-root');
      const a = ctx.ans;
      a.seen = a.seen || [];
      if (!ctx.readonly && !a.seen.includes(a.s)) { a.seen.push(a.s); ctx.save(); }
      el.innerHTML = `<div class="stack">
        <div class="stack tight"><div class="eyebrow">Стратегия записи</div><div data-sv>${ui.seg('s', STRAT, a.s, 'accent')}</div></div>
        <div data-rstats></div>
        <div data-seq></div>
        <div data-sql></div>
        <div class="h1-box">
          <div class="eyebrow">Ваше решение</div>
          <div class="small">Для пика воскресенья 20:00 выбираю:</div>
          <div data-pick>${ui.seg('pick', STRAT, a.pick || '', '')}</div>
          <div data-q></div>
        </div>
      </div>`;
      lock(TR.$('[data-pick]', el), ctx.readonly);
      const st = TR.$('[data-rstats]', el), sqlEl = TR.$('[data-sql]', el);
      const draw = () => {
        const r = RACE[a.s], seen = a.seen.includes(a.s) || ctx.readonly;
        st.innerHTML = `<div class="h1-stats">
          <div class="stat"><div class="k">В зале на 20 мест</div><div class="v ${seen ? (r.ok ? 'ok' : 'bad') : ''}">${seen ? r.seats + ' чел.' : '—'}</div><div class="s small dim">${seen ? (r.ok ? 'перебора нет' : 'двое на одном велосипеде') : 'проиграйте сценарий'}</div></div>
          <div class="stat"><div class="k">Пётр получил</div><div class="v ${seen ? (r.ok ? 'ok' : 'bad') : ''}">${seen ? esc(r.b.split(' ')[0]) : '—'}</div><div class="s small dim">${seen ? esc(r.b) : ''}</div></div>
          <div class="stat"><div class="k">Замок на строке</div><div class="v">${seen ? esc(r.lock.split(' ')[0]) : '—'}</div><div class="s small dim">${seen ? esc(r.lock) : ''}</div></div>
        </div>`;
        sqlEl.innerHTML = ui.code(RACE_SQL[a.s], 'sql', STRAT.find(x => x.v === a.s).t);
      };
      const seq = ui.seq(TR.$('[data-seq]', el), {
        lanes: LANES_RACE, steps: raceSteps(a.s), start: 'all', speed: 750, laneW: 190,
        title: 'Гонка за последнее место', hint: 'Нажмите «Проиграть».',
        onEnd() { if (!ctx.readonly && !a.seen.includes(a.s)) { a.seen.push(a.s); ctx.save(); } draw(); }
      });
      draw();
      quizSet(TR.$('[data-q]', el), ctx, [RQ]);
      ui.onSeg(el, (name, v) => {
        if (name === 's') { a.s = v; if (!ctx.readonly) ctx.save(); seq.set(raceSteps(v), { play: true }); draw(); }
        if (name === 'pick' && !ctx.readonly) { a.pick = v; ctx.save(); ctx.decide('Последнее место в пик', STRAT.find(x => x.v === v).t); }
      });
    },
    check(ans) {
      const notes = [];
      const pickPts = { atomic: 1, forupd: 0.8 }[ans.pick] || 0;
      if (!ans.pick) notes.push({ ok: false, html: 'Стратегия для пика не выбрана.' });
      else if (ans.pick === 'atomic') notes.push({ ok: true, html: 'Атомарный UPDATE: проверка и захват места — одна команда, замок на миллисекунды.' });
      else if (ans.pick === 'forupd') notes.push({ ok: 'warn', html: 'FOR UPDATE тоже не пустит 21-го — засчитано. Но замок держится всю транзакцию: при 3000 человек за 5 минут очередь к популярному сайклу растёт. Сравните, сколько ждёт Пётр в двух вариантах.' });
      else if (ans.pick === 'uniq') notes.push({ ok: false, html: 'Уникальный индекс следит, чтобы <b>один клиент</b> не записался дважды. Сколько клиентов в гонке за последний велосипед?' });
      else notes.push({ ok: false, html: 'Посмотрите на диаграмму: между SELECT и INSERT у Анны вклинился Пётр. Проверка ничего не заняла.' });
      const q = ui.quizScore(RQ, (ans.q || [])[0] || []);
      notes.push({ ok: q.ok ? true : q.score >= 0.6 ? 'warn' : false, html: q.ok ? '«Почему» — все доводы на месте.' : q.score >= 0.6 ? '«Почему» — верно, но не все доводы. Чем ещё хорош выбранный способ — в том числе на уровне базы?' : '«Почему» — есть неверные доводы. Пояснения появятся у вариантов.' });
      const seen = (ans.seen || []).length;
      if (seen < 4) notes.push({ ok: 'info', html: `Прогнано стратегий: ${seen} из 4. Сравнение помогает объяснить выбор.` });
      const score = 0.55 * pickPts + 0.45 * q.score;
      return { ok: pickPts >= 0.8 && q.score >= 0.6, score, notes };
    },
    explain: `<p>Эталон «Пульса» — <b>счётчик <code>booked_count</code> + атомарный UPDATE + CHECK</b>. Это осознанная денормализация (DOMAIN §6): без счётчика пришлось бы считать <code>COUNT(*)</code> под нагрузкой воскресенья, а «не больше мест» нельзя выразить в CHECK по строкам <code>booking</code>.</p>
      <ul class="checks">
        <li>Счётчик меняется в <b>той же транзакции</b>, что и вставка записи. Отмена записи — <code>booked_count - 1</code> там же.</li>
        <li>0 строк в ответе UPDATE → мест нет → ${ui.st(409)} с ссылкой <code>join-waitlist</code> (лист ожидания, F-waitlist).</li>
        <li><code>FOR UPDATE</code> — рабочий запасной вариант, когда правило сложнее одного условия (например, проверка тренера в двух таблицах).</li>
        <li><code>SERIALIZABLE</code> тоже спасает, но ценой ошибок сериализации и повторов транзакций — в пик это лишняя нагрузка.</li>
      </ul>
      <p>Инцидент №9 из финала — «двое на одном велосипеде» — ровно check-then-act без блокировки.</p>`,
    report: ans => `Выбор для пика: ${ans.pick ? STRAT.find(x => x.v === ans.pick).t : '—'}. Прогнано стратегий: ${(ans.seen || []).length} из 4.\n${quizReport([RQ], ans.q)}`
  };

  // =====================================================================
  // Подход 4. ETag и If-Match + PUT или PATCH
  // =====================================================================
  const EMODE = [{ v: 'none', t: 'без условия' }, { v: 'etag', t: 'ETag + If-Match' }, { v: 'required', t: 'сервер требует условие' }];
  const ERES = {
    none: { lost: 1, first: '200', db: 'Мария Лис, 18 мест' },
    etag: { lost: 0, first: '412', db: 'Игорь Ким, 18 мест' },
    required: { lost: 0, first: '428', db: 'Игорь Ким, 18 мест' }
  };
  const LANES_ET = [{ id: 'a', t: 'Админ А', sub: 'ресепшен' }, { id: 'b', t: 'Админ Б', sub: 'управляющий' }, { id: 'api', t: 'API «Пульса»', sub: 'Сайкл, пн 19:00' }];
  function etSteps(m) {
    const S = [], et = m !== 'none';
    S.push({ from: 'a', to: 'api', t: 'GET /classes/{id}', note: 'Два администратора открыли одно занятие в веб-кабинете (F-admin-ui). Сейчас: тренер Мария Лис, 20 мест.' });
    S.push({ from: 'api', to: 'a', t: et ? '200 · ETag: "7"' : '200 · Лис, 20 мест', reply: true });
    S.push({ from: 'b', to: 'api', t: 'GET /classes/{id}' });
    S.push({ from: 'api', to: 'b', t: et ? '200 · ETag: "7"' : '200 · Лис, 20 мест', reply: true, note: et ? 'Оба получили одну редакцию — ETag "7".' : 'Оба видят одно и то же.' });
    if (m === 'none') {
      S.push({ from: 'a', to: 'api', t: 'PUT {тренер Ким, 20 мест}', note: 'А заменяет заболевшую Марию Лис на Игоря Кима.' });
      S.push({ from: 'api', to: 'a', t: '200', reply: true, kind: 'ok' });
      S.push({ from: 'b', to: 'api', t: 'PUT {тренер Лис, 18 мест}', note: 'Б не знает о замене. У него на экране старая карточка — он меняет только число мест: сломались два велосипеда. Но PUT отправляет карточку целиком, со старым тренером.' });
      S.push({ from: 'api', to: 'b', t: '200', reply: true, kind: 'bad' });
      S.push({ from: 'api', to: 'api', box: true, t: 'в базе: Лис, 18 мест', kind: 'bad' });
      S.push({ from: 'a', to: 'api', box: true, kind: 'bad', t: 'Замена тренера потерялась — потерянное обновление', note: 'Последний записавший молча затёр первого. Клиенты придут на сайкл к Марии Лис, которая на больничном.' });
    }
    if (m === 'etag') {
      S.push({ from: 'a', to: 'api', t: 'PUT · If-Match: "7"' });
      S.push({ from: 'api', to: 'api', box: true, t: '7 = 7 → теперь версия 8', kind: 'ok', note: 'Версия совпала — правка А принята, редакция стала "8".' });
      S.push({ from: 'api', to: 'a', t: '200 · ETag: "8"', reply: true, kind: 'ok' });
      S.push({ from: 'b', to: 'api', t: 'PUT · If-Match: "7"' });
      S.push({ from: 'api', to: 'b', t: '412 Precondition Failed', reply: true, kind: 'warn', note: 'Б правил редакцию "7", а на сервере уже "8". Сервер отказывает, ничего не затирая.' });
      S.push({ from: 'b', to: 'api', t: 'GET заново → "8", тренер Ким' });
      S.push({ from: 'b', to: 'api', t: 'PUT · If-Match: "8" {Ким, 18}' });
      S.push({ from: 'api', to: 'b', t: '200 · ETag: "9"', reply: true, kind: 'ok' });
      S.push({ from: 'a', to: 'api', box: true, kind: 'ok', t: 'Оба изменения на месте: Ким, 18 мест', note: 'Кабинет Б перечитал карточку, показал «пока вы правили, сменили тренера» и отправил правку поверх свежей версии.' });
    }
    if (m === 'required') {
      S.push({ from: 'b', to: 'api', t: 'PUT без If-Match', note: 'Б работает в старой вкладке кабинета, которая не умеет присылать условие.' });
      S.push({ from: 'api', to: 'b', t: '428 Precondition Required', reply: true, kind: 'warn', note: 'Сервер требует условный запрос для изменения занятия. Без If-Match — отказ, ничего не записано.' });
      S.push({ from: 'a', to: 'api', t: 'PUT · If-Match: "7"' });
      S.push({ from: 'api', to: 'a', t: '200 · ETag: "8"', reply: true, kind: 'ok' });
      S.push({ from: 'b', to: 'api', t: 'обновил вкладку: GET → "8"' });
      S.push({ from: 'b', to: 'api', t: 'PUT · If-Match: "8" {Ким, 18}' });
      S.push({ from: 'api', to: 'b', t: '200 · ETag: "9"', reply: true, kind: 'ok' });
      S.push({ from: 'a', to: 'api', box: true, kind: 'ok', t: 'Ничего не потеряно: Ким, 18 мест', note: '428 закрывает лазейку «просто не присылать If-Match».' });
    }
    return S;
  }
  const PROFILE = { id: 'c1d2e3f4-…', fullName: 'Анна Смирнова', phone: '+79161112233', email: 'anna@old.ru', birthDate: '1994-03-12' };
  const PMODE = [{ v: 'put', t: 'PUT /me' }, { v: 'patch', t: 'PATCH /me (merge-patch)' }];
  function pmView(v) {
    const req = v === 'put'
      ? ui.http({ method: 'PUT', path: '/v1/me', headers: { 'Content-Type': 'application/json', 'If-Match': '"12"' }, body: { email: 'anna@new.ru' } })
      : ui.http({ method: 'PATCH', path: '/v1/me', headers: { 'Content-Type': 'application/merge-patch+json', 'If-Match': '"12"' }, body: { email: 'anna@new.ru' } });
    const after = v === 'put'
      ? `{\n  "id": "${PROFILE.id}",\n  [[bad]]"fullName": null,[[/]]\n  "phone": "${PROFILE.phone}",\n  [[ok]]"email": "anna@new.ru",[[/]]\n  [[bad]]"birthDate": null[[/]]\n}`
      : `{\n  "id": "${PROFILE.id}",\n  "fullName": "${PROFILE.fullName}",\n  "phone": "${PROFILE.phone}",\n  [[ok]]"email": "anna@new.ru",[[/]]\n  "birthDate": "${PROFILE.birthDate}"\n}`;
    return `<div class="grid2">
      <div class="stack tight" style="min-width:0">${req}</div>
      <div class="stack tight" style="min-width:0">${ui.code(after, 'json', 'Профиль после запроса')}
        ${v === 'put' ? ui.note('bad', 'Имя и дата рождения стёрты', 'PUT — «вот новая версия ресурса целиком». Чего нет в теле — того нет и в ресурсе. Если поле обязательное, честный сервер ответит 422, но не станет молча «додумывать».') : ui.note('ok', 'Изменился только email', 'JSON Merge Patch (RFC 7396): поля из тела заменяются, отсутствующие не трогаются, <code>null</code> — удалить поле.')}
      </div></div>`;
  }
  const EQ = [
    {
      q: 'Админ Б получил <code>412 Precondition Failed</code>. Что должен сделать веб-кабинет?', seed: 'h1-e1',
      options: [
        { t: 'Перечитать занятие (GET), показать, что изменилось, и отправить правку с новым ETag', ok: 1, why: 'Верно. Б должен увидеть замену тренера и решить, что делать со своей правкой.' },
        { t: 'Повторить тот же PUT с тем же <code>If-Match</code>', why: 'Будет тот же 412: версия на сервере уже другая.' },
        { t: 'Отправить PUT без <code>If-Match</code> — так пройдёт', why: 'Пройдёт и затрёт правку А — ровно то, от чего защищались. Поэтому сервер вправе требовать условие (428).' },
        { t: 'Показать «ошибка сервера, попробуйте позже»', why: 'Сервер исправен. Позже будет тот же 412 — нужна свежая версия.' }
      ]
    },
    {
      q: 'Когда сервер отвечает <code>428 Precondition Required</code>?', seed: 'h1-e2',
      options: [
        { t: 'Сервер требует условный запрос, а <code>If-Match</code> не прислали', ok: 1, why: 'Верно (RFC 6585). Это защита от клиентов, которые «забывают» условие.' },
        { t: '<code>If-Match</code> прислали, но версия устарела', why: 'Это 412.' },
        { t: 'Нет прав на правку занятия', why: 'Это 403.' },
        { t: 'Занятие уже кто-то правит прямо сейчас', why: 'HTTP не знает, кто «сейчас правит». Он сравнивает версии в момент записи — это оптимистическая блокировка.' }
      ]
    },
    {
      q: 'Анна отправляет <code>PUT /me</code> с телом <code>{"email": "anna@new.ru"}</code>. Что по смыслу PUT случится с её именем?', seed: 'h1-e3',
      options: [
        { t: 'PUT заменяет ресурс целиком: имени нет в теле — оно сотрётся (или сервер откажет 422, если имя обязательно)', ok: 1, why: 'Верно. PUT — «положи вот это целиком на это место».' },
        { t: 'Имя останется, сервер поменяет только email', why: 'Так ведёт себя PATCH. Если PUT молча ведёт себя как PATCH, контракт врёт, и клиенты перестают понимать, чего ждать.' },
        { t: 'Сервер ответит <code>405</code>', why: '405 — метод не поддерживается. PUT на /me поддерживается, просто опасен для частичных правок.' },
        { t: 'PUT нельзя повторять, поэтому имя может задвоиться', why: 'PUT как раз идемпотентен: повтор того же тела даёт тот же результат.' }
      ]
    },
    {
      q: 'Как в <code>PATCH /me</code> с <code>Content-Type: application/merge-patch+json</code> удалить необязательный email (F-client-id)?', seed: 'h1-e4',
      options: [
        { t: 'Передать <code>{"email": null}</code>', ok: 1, why: 'Верно. В JSON Merge Patch (RFC 7396) <code>null</code> значит «удалить поле».' },
        { t: 'Передать <code>{}</code>', why: 'Пустой патч ничего не меняет.' },
        { t: 'Передать <code>{"email": ""}</code>', why: 'Пустая строка — значение, а не отсутствие. Получится email "", который сломает проверку формата и уникальности.' },
        { t: 'Только через отдельный <code>DELETE /me/email</code>', why: 'Так спроектировать можно, но это лишний ресурс: в merge-patch есть штатный способ.' }
      ]
    }
  ];
  const EQ_HINT = [
    '412 значит «вы правили устаревшую версию». Что нужно, чтобы правка легла на свежую?',
    'вспомните три исхода в лаборатории: 412, 428 и 200. Чем отличался запрос Б в режиме «сервер требует условие»?',
    'PUT — «вот ресурс целиком». Что значит «целиком», если в теле одно поле?',
    'merge-patch различает «поле не прислали» и «поле прислали со значением null».'
  ];
  const etagTask = {
    id: 'etag-patch', title: 'ETag, If-Match и PATCH',
    simple: {
      icon: '📝', plain: 'Когда двое правят одно и то же, второй не должен молча затереть первого. Сервер выдаёт номер версии и принимает правку, только если версия не изменилась.',
      analogy: 'Общий график смен на листе у управляющего. На листе номер редакции. Вы приносите исправления «к редакции 7», а там уже 8 — вам говорят: «посмотрите свежую, её уже поправили». А PATCH против PUT — исправить одну строчку в анкете или переписать анкету целиком.',
      tech: '<code>ETag</code> — версия ресурса в ответе. <code>If-Match: "7"</code> — условие на запись; не совпало → <code>412</code>; условие обязательно, но его нет → <code>428</code>. Это оптимистическая блокировка (RFC 9110, RFC 6585). <code>PUT</code> заменяет ресурс целиком, <code>PATCH</code> с <code>application/merge-patch+json</code> — только присланные поля (RFC 7396).'
    },
    lead: ui.brief({
      situation: `«Сайкл» в понедельник, 19:00. Два администратора открыли это занятие в веб-кабинете. Админ А меняет заболевшего тренера Марию Лис на Игоря Кима. Админ Б в то же время уменьшает число мест с 20 до 18. У Б на экране старая карточка — о замене он не знает. Чья правка выживет?`,
      todo: [
        `Лаборатория 1: переключайте режим сервера — «без условия», «ETag + If-Match», «сервер требует условие» — и смотрите схему.`,
        `Лаборатория 2: переключите PUT и PATCH и сравните, каким стал профиль Анны после смены email.`,
        `Ответьте на четыре вопроса внизу. Нужно 3 верных из 4.`
      ],
      look: `<code>ETag</code> — номер версии, сервер выдаёт его вместе с данными: «редакция 7». <code>If-Match: "7"</code> — правка с условием: «сохраните, только если там всё ещё редакция 7». Счётчики над схемой: сколько правок потерялось, что получил Б на первую попытку, что в итоге в базе. Правильный итог — «Игорь Ким, 18 мест». Во второй лаборатории слева запрос, справа профиль после него: красным — то, что стёрлось. PUT — «замени целиком», PATCH — «поправь только эти поля».`
    }),
    blank: () => ({ m: 'none', pm: 'put', q: [] }),
    reference: () => ({ m: 'etag', pm: 'patch', q: quizRef(EQ) }),
    render(el, ctx) {
      el.classList.add('h1-root');
      const a = ctx.ans;
      el.innerHTML = `<div class="stack">
        <div class="h1-box">
          <div class="eyebrow">Лаборатория 1 · два администратора</div>
          ${ui.seg('m', EMODE, a.m, 'accent')}
          <div data-estats></div>
          <div data-seq></div>
        </div>
        <div class="h1-box">
          <div class="eyebrow">Лаборатория 2 · Анна меняет только email</div>
          ${ui.seg('pm', PMODE, a.pm, 'accent')}
          <div data-pm></div>
        </div>
        <div class="stack" data-q></div>
      </div>`;
      const stEl = TR.$('[data-estats]', el), pmEl = TR.$('[data-pm]', el);
      const drawE = () => {
        const r = ERES[a.m];
        stEl.innerHTML = `<div class="h1-stats">
          <div class="stat"><div class="k">Потеряно правок</div><div class="v ${r.lost ? 'bad' : 'ok'}">${r.lost}</div><div class="s small dim">${r.lost ? 'замена тренера пропала' : 'обе правки на месте'}</div></div>
          <div class="stat"><div class="k">Первая попытка Б</div><div class="v ${r.first === '200' ? 'bad' : 'warn'}">${r.first}</div><div class="s small dim">${r.first === '200' ? 'молча затёр' : 'отказ без потерь'}</div></div>
          <div class="stat"><div class="k">В базе в итоге</div><div class="v" style="font-size:14px">${esc(r.db)}</div><div class="s small dim">нужно: Игорь Ким, 18 мест</div></div>
        </div>`;
      };
      drawE();
      pmEl.innerHTML = pmView(a.pm);
      const seq = ui.seq(TR.$('[data-seq]', el), { lanes: LANES_ET, steps: etSteps(a.m), start: 'all', speed: 800, laneW: 190, title: 'Два администратора правят одно занятие', hint: 'Нажмите «Проиграть».' });
      quizSet(TR.$('[data-q]', el), ctx, EQ);
      ui.onSeg(el, (name, v) => {
        if (name === 'm') { a.m = v; if (!ctx.readonly) ctx.save(); seq.set(etSteps(v), { play: true }); drawE(); }
        if (name === 'pm') { a.pm = v; if (!ctx.readonly) ctx.save(); pmEl.innerHTML = pmView(v); }
      });
    },
    check(ans) {
      const r = quizSetScore(EQ, ans.q);
      return { ok: r.good >= 3, score: r.score, summary: `Верно: ${r.good} из ${EQ.length}.`, notes: quizNotes(EQ, r.res, EQ_HINT) };
    },
    explain: `<p>Для «Пульса»: все изменяющие запросы к занятиям, абонементам и профилю в кабинете — с <code>If-Match</code>, сервер требует условие (<code>428</code> без него). Профиль клиента — <code>PATCH /me</code> с <code>application/merge-patch+json</code> и <code>If-Match</code> (DOMAIN §10).</p>
      ${ui.code(`UPDATE class_session
   SET trainer_id = $2, capacity = $3, version = version + 1
 WHERE public_id = $1 [[ok]]AND version = $4[[/]]   -- $4 — из If-Match
RETURNING version;           -- 0 строк → 412`, 'sql', 'ETag на сервере — например, колонка version у таблиц, которые правят из кабинета')}
      <ul class="checks">
        <li>ETag — это не обязательно хэш тела: подойдёт номер версии строки или время изменения с точностью до микросекунд.</li>
        <li>Оптимистическая блокировка не держит замков, пока админ думает над формой, — поэтому она годится для людей, которые правят минутами.</li>
        <li>Ещё одна ловушка PATCH — mass assignment: поля <code>role</code> и <code>partnerId</code> в теле <code>PATCH /me</code> сервер обязан игнорировать или отвергать.</li>
      </ul>`,
    report: ans => quizReport(EQ, ans.q)
  };

  // =====================================================================
  TR.stage({
    id: 'hard-1', act: 3, order: 110, slot: 'Ср 10:00', title: 'Повторы и гонки',
    when: 'среда, 10:00 · переговорная «Сайкл»',
    intro: [
      { who: 'timur', html: 'Вчера на тестовом стенде: тестировщица в метро оплатила абонемент, связь моргнула, приложение повторило запрос. Два списания по 5 400 ₽. А на нагрузочном тесте «воскресенье 20:00» на последний велосипед в сайкле записались двое.' },
      { who: 'olga', html: 'Мне неважно, как это называется. Деньги дважды не списываем, двое на одном велосипеде не сидят. Это не обсуждается.' },
      { who: 'vera', html: 'Сегодня три узких места, где «на стенде работает» ломается в жизни: повторы, гонки и одновременные правки. Каждое сначала руками в лаборатории — переключаете настройку и смотрите, сколько раз списали деньги.' }
    ],
    facts: ['F-no-loss', 'F-psp', 'F-psp-slow', 'F-capacity', 'F-week-open', 'F-double', 'F-admin-ui'],
    glossary: [
      { term: 'Идемпотентность', simple: 'Повтор не меняет результат. Нажали кнопку лифта пять раз — приедет один лифт.', tech: 'N одинаковых запросов дают тот же эффект, что один. GET, PUT, DELETE идемпотентны по стандарту (RFC 9110), POST — нет: его защищают ключом идемпотентности.' },
      { term: 'Idempotency-Key', simple: 'Номерок в гардеробе: по нему отдают ту же куртку, а не выдают новую.', tech: 'Заголовок с уникальным значением (UUID), который клиент придумывает один раз на операцию и повторяет при ретраях. Сервер хранит ключ, отпечаток тела и ответ 24 часа. ПэйПоинт называет свой заголовок Idempotence-Key.' },
      { term: 'Двойное списание', simple: 'Клиент заплатил дважды за одно и то же — потому что повтор запроса повторил и оплату.', tech: 'Типичная причина — ретрай POST без ключа идемпотентности или ключ, который сервер нигде не хранит. Для «Пульса» — ⚑ F-no-loss.' },
      { term: 'Гонка (race condition)', simple: 'Последний велосипед в сайкле: двое одновременно увидели «1 место» и оба пошли его занимать.', tech: 'Результат зависит от того, чей запрос успел первым. Лечится атомарными операциями, блокировками или ограничениями в базе.' },
      { term: 'Check-then-act', simple: 'Сначала посмотрели, потом сделали — а между этими шагами успел кто-то другой.', tech: 'Шаблон ошибки: SELECT (проверка) и INSERT/UPDATE (действие) разными командами без блокировки. Инцидент «двое на одном велосипеде».' },
      { term: 'Блокировка строки', simple: 'Табличка «занято» на примерочной: пока вы внутри, следующий ждёт у двери.', tech: 'SELECT … FOR UPDATE запирает строку до конца транзакции. Другие, кто хочет её изменить, ждут. UPDATE тоже запирает строку, но только на время своей транзакции.' },
      { term: 'Атомарный UPDATE', simple: 'Проверить и занять одним движением: сел на велосипед — значит, он твой.', tech: 'UPDATE … SET booked_count = booked_count + 1 WHERE id = $1 AND booked_count < capacity. 0 обновлённых строк — мест нет.' },
      { term: 'ETag', simple: 'Номер редакции документа: «у меня на руках редакция 7».', tech: 'Заголовок ответа с версией ресурса. Нужен для условных запросов: If-Match при записи, If-None-Match при чтении (кэш, ответ 304).' },
      { term: 'If-Match', simple: 'Правка с условием: «сохраните, только если там всё ещё редакция 7».', tech: 'Оптимистическая блокировка. Версия не совпала → 412 Precondition Failed. Сервер требует условие, а его нет → 428 Precondition Required.' },
      { term: 'PATCH (merge-patch)', simple: 'Исправить одну строчку в анкете, а не переписывать её целиком.', tech: 'PATCH с Content-Type: application/merge-patch+json (RFC 7396): присланные поля заменяются, отсутствующие не трогаются, null удаляет поле. PUT заменяет ресурс целиком.' }
    ],
    outro: 'Теперь вы видели, как деньги списываются дважды и как двое садятся на один велосипед, — и чем это лечится: один ключ на операцию, ключи в таблице, ключ дальше в ПэйПоинт, атомарный UPDATE со счётчиком, ETag с If-Match. Запишите это в контракт API. После обеда — HATEOAS, страницы и кэш: как сервер сам подсказывает приложению, что можно сделать.',
    tasks: [payTask, keyTask, raceTask, etagTask]
  });
})();
