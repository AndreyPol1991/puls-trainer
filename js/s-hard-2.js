/* Неделя 3, среда 15:00: зрелость REST и HATEOAS, пагинация (offset против курсора), HTTP-кэш, 304 и 202.
   Главная лаборатория — карточка занятия в макете телефона: кнопки рисуются только из _links ответа сервера. */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc;

  if (!document.getElementById('h2-css')) document.head.insertAdjacentHTML('beforeend', `<style id="h2-css">
    .h2-set { display: grid; grid-template-columns: minmax(0, 150px) minmax(0, 1fr); gap: 8px 14px; align-items: center; }
    .h2-set > .lbl { font-size: 13.5px; color: var(--text-2); min-width: 0; }
    .h2-set > .seg { justify-self: start; max-width: 100%; }
    .h2-box { display: grid; gap: 12px; padding: 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); min-width: 0; }
    .h2-box > * { min-width: 0; }
    .h2-root, .h2-root .stack, .h2-box { grid-template-columns: minmax(0, 1fr); }
    .h2-root .stack > *, .h2-root > * { min-width: 0; }
    .h2-root .seg button { white-space: normal; text-align: left; }
    .h2-tt { display: block; min-width: 0; }
    .h2-lab { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); gap: 14px; align-items: start; }
    .h2-lab > * { min-width: 0; }
    .h2-phones { display: flex; flex-wrap: wrap; gap: 12px; }
    .h2-phone { flex: 1 1 210px; max-width: 270px; min-width: 0; border: 2px solid var(--border-strong); border-radius: 22px; padding: 10px 10px 12px; background: var(--surface-2); display: grid; gap: 8px; }
    .h2-phone.bad { border-color: var(--bad); }
    .h2-phone.ok { border-color: var(--ok); }
    .h2-phone .notch { width: 64px; height: 5px; border-radius: 9px; background: var(--border-strong); justify-self: center; }
    .h2-phone .cap { font: 600 11px/1.3 var(--f-mono); color: var(--text-muted); text-align: center; }
    .h2-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 12px; display: grid; gap: 6px; }
    .h2-card .ttl { font-weight: 700; font-size: 15px; }
    .h2-card .btn { width: 100%; justify-content: center; }
    .h2-card .none { font-size: 12.5px; color: var(--text-muted); text-align: center; padding: 6px 0; }
    .h2-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .h2-stats .v { font-size: 18px; }
    :is([data-tid="richardson"], [data-tid="hateoas-live"], [data-tid="why-hateoas"], [data-tid="pages"], [data-tid="cache-202"], .h2-root) :not(pre) > code { white-space: normal; overflow-wrap: anywhere; }
    .h2-ids { display: flex; flex-wrap: wrap; gap: 6px; }
    .h2-ck td { text-align: center; }
    .h2-ck td:first-child { text-align: left; min-width: 190px; }
    .h2-ck th .small { white-space: normal; min-width: 70px; }
    .h2-rich .tok { white-space: normal; max-width: 100%; text-align: left; overflow-wrap: anywhere; }
    .h2-rich .tok code { white-space: normal; overflow-wrap: anywhere; }
    .h2-rich .sorter, .h2-rich .pool, .h2-rich .buckets { min-width: 0; max-width: 100%; }
    .h2-box .btn.h2-wrapbtn { white-space: normal; text-align: left; justify-content: flex-start; height: auto; line-height: 1.3; padding-top: 6px; padding-bottom: 6px; max-width: 100%; }
    .h2-root .h2-ck code, [data-tid="hateoas-live"] .h2-ck code { white-space: nowrap; overflow-wrap: normal; }
    .h2-tl { display: grid; gap: 4px; min-width: 0; }
    .h2-tl-top, .h2-tl-ticks { position: relative; height: 18px; }
    .h2-tl-now { position: absolute; top: 0; font: 700 12px/18px var(--f-mono); color: var(--info); white-space: nowrap; }
    .h2-tl-bar { position: relative; height: 30px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); background: var(--surface-2); }
    .h2-tl-bar .z { position: absolute; top: 0; bottom: 0; display: flex; align-items: center; justify-content: center; font-size: 11.5px; font-weight: 600; white-space: nowrap; overflow: hidden; }
    .h2-tl-bar .z.free, .h2-tl-leg .sw.free { background: var(--ok-soft); color: var(--ok); }
    .h2-tl-bar .z.late, .h2-tl-leg .sw.late { background: var(--bad-soft); color: var(--bad); }
    .h2-tl-bar .z.cls { background: var(--surface-3); color: var(--text-2); }
    .h2-tl-bar i { position: absolute; top: 0; bottom: 0; width: 0; }
    .h2-tl-bar i.old, .h2-tl-leg .ln.old { border-left: 2px dashed var(--text); }
    .h2-tl-bar i.now, .h2-tl-leg .ln.now { border-left: 3px solid var(--info); }
    .h2-tl-bar i.now { margin-left: -1px; }
    .h2-tl-ticks span { position: absolute; top: 0; transform: translateX(-50%); font: 11px/18px var(--f-mono); color: var(--text-muted); }
    .h2-tl-leg { display: flex; flex-wrap: wrap; gap: 4px 14px; color: var(--text-2); }
    .h2-tl-leg .sw { display: inline-block; width: 12px; height: 12px; border-radius: 3px; vertical-align: -2px; margin-right: 6px; border: 1px solid currentColor; }
    .h2-tl-leg .sw.free { border-color: var(--ok); } .h2-tl-leg .sw.late { border-color: var(--bad); }
    .h2-tl-leg .ln { display: inline-block; width: 0; height: 13px; vertical-align: -2px; margin-right: 6px; }
    @media (max-width: 760px) { .h2-lab { grid-template-columns: minmax(0, 1fr); } }
    @media (max-width: 640px) {
      .h2-set { grid-template-columns: minmax(0, 1fr); gap: 4px; }
      .h2-set > .lbl { margin-top: 8px; }
      .h2-stats { grid-template-columns: minmax(0, 1fr); }
      .h2-phone { max-width: none; }
    }
  </style>`);

  // ---------- общие помощники ----------
  const lock = (el, ro) => { if (ro) TR.$$('[data-seg] button', el).forEach(b => { b.disabled = true; }); };
  const mount = (el, cls) => { const d = document.createElement('div'); if (cls) d.className = cls; el.appendChild(d); return d; };
  function quizSet(el, ctx, QS, onPick) {
    QS.forEach((cfg, i) => {
      const d = mount(el, 'card flat');
      ui.quiz(d, Object.assign({}, cfg, {
        value: (ctx.ans.q || [])[i] || [], readonly: ctx.readonly, reveal: ctx.result,
        onChange: v => { const q = (ctx.ans.q || []).slice(); q[i] = v; ctx.ans.q = q; ctx.save(); onPick && onPick(i, v); }
      }));
    });
  }
  function quizSetScore(QS, q) {
    const res = QS.map((cfg, i) => ui.quizScore(cfg, (q || [])[i] || []));
    return { res, good: res.filter(r => r.ok).length, score: res.reduce((s, r) => s + r.score, 0) / QS.length };
  }
  const quizNotes = (res, hints) => res.map((r, i) => ({ ok: r.ok, html: r.ok ? `Вопрос ${i + 1}: верно.` : `Вопрос ${i + 1}: ${hints[i]}` }));
  const quizRef = QS => QS.map(cfg => cfg.options.map((o, i) => o.ok ? i : -1).filter(i => i >= 0));
  const plain = s => String(s).replace(/<[^>]+>/g, '');
  const quizReport = (QS, q) => QS.map((cfg, i) => {
    const v = (q || [])[i] || [];
    return `- ${plain(cfg.q)}\n  → ${v.map(j => cfg.options[j] ? plain(cfg.options[j].t) : '?').join('; ') || '—'} ${ui.quizScore(cfg, v).ok ? '✓' : '✗'}`;
  }).join('\n');

  // =====================================================================
  // Подход 1. Лестница Ричардсона
  // =====================================================================
  const LV = [
    { id: 'l0', t: 'Уровень 0', sub: 'один адрес на всё, HTTP — просто труба' },
    { id: 'l1', t: 'Уровень 1 · ресурсы', sub: 'у каждого объекта свой адрес' },
    { id: 'l2', t: 'Уровень 2 · методы и коды', sub: 'GET/POST/PUT/DELETE и статусы по смыслу' },
    { id: 'l3', t: 'Уровень 3 · гипермедиа', sub: 'ответ подсказывает следующие шаги' }
  ];
  const RI = [
    { id: 'a', lv: 'l0', t: '<code>POST /api</code> с телом <code>{"method": "bookClass", "classId": "4b1f…"}</code> → <code>200 {"ok": false, "error": "NO_SEATS"}</code>', hint: 'сколько здесь адресов и что значит код 200 при ошибке?' },
    { id: 'b', lv: 'l0', t: 'SOAP-конверт «ЗаписатьНаЗанятие» на <code>POST /ws</code>; любой исход — <code>200</code>', hint: 'один адрес на все операции — какая это ступень?' },
    { id: 'c', lv: 'l1', t: '<code>POST /classes/4b1f…/book</code> → <code>200 {"ok": true}</code>', hint: 'адрес у занятия уже свой, но глагол спрятан в адресе, а ответ всегда 200.' },
    { id: 'd', lv: 'l1', t: '<code>POST /bookings/9e2d…/delete</code> → <code>200 {"ok": true}</code>', hint: 'у записи свой адрес, но действие — слово в пути, а не метод HTTP.' },
    { id: 'e', lv: 'l2', t: '<code>POST /classes/4b1f…/bookings</code> → <code>201 Created</code> + <code>Location: /bookings/9e2d…</code>', hint: 'метод и код по смыслу. А подсказывает ли ответ, что делать дальше?' },
    { id: 'f', lv: 'l2', t: '<code>POST /classes/4b1f…/bookings</code> → <code>409 Conflict</code>, problem+json «Мест нет»', hint: 'честный код ошибки — но есть ли в ответе путь дальше?' },
    { id: 'g', lv: 'l3', t: '<code>201 Created</code> + <code>"_links": {"self", "cancel", "class"}</code>', hint: 'ответ сам говорит, что можно сделать с записью.' },
    { id: 'h', lv: 'l3', t: '<code>409 Conflict</code> + <code>"_links": {"join-waitlist": {"href": …, "method": "POST"}}</code>', hint: 'ошибка, но с готовым следующим шагом.' }
  ];
  const richTask = {
    id: 'richardson', title: 'Лестница Ричардсона',
    simple: {
      icon: '🪜', plain: 'REST бывает разной зрелости. Чем выше ступень, тем больше API использует сам HTTP и тем меньше клиенту нужно знать заранее.',
      analogy: 'Как записаться в клуб. Ступень 0 — один телефон ресепшена на всё, всё решают на словах. Ступень 1 — у каждого зала свой номер. Ступень 2 — у каждого номера понятные действия и стандартные ответы: «записал», «мест нет». Ступень 3 — администратор сам говорит: «Мест нет. Хотите в лист ожидания? Вот кнопка».',
      tech: 'Модель зрелости Ричардсона: 0 — один адрес (RPC поверх HTTP); 1 — ресурсы; 2 — HTTP-методы и коды состояния (RFC 9110); 3 — гипермедиа (HATEOAS): ссылки на допустимые действия в ответе.'
    },
    lead: ui.brief({
      situation: 'Одну и ту же операцию — «записаться на занятие» или «отменить запись» — в API можно сделать по-разному. Модель Ричардсона — это лестница из четырёх ступеней, от 0 до 3. Чем выше ступень, тем больше API пользуется возможностями HTTP и тем меньше приложению надо знать заранее.',
      todo: [
        'Перед вами 8 карточек: запрос и ответ сервера. Разложите их по четырём ступеням — нажмите карточку, потом ступень (или перетащите).',
        'Для каждой карточки задайте три вопроса. У объекта свой адрес? Метод и код ответа говорят правду? Есть ли в ответе подсказка, что делать дальше?',
        'Нажмите «Проверить». Нужно 7 верных из 8.'
      ],
      lookTitle: 'Как читать карточки',
      look: 'Слева — запрос, после стрелки → — ответ сервера. <code>200 {"ok": false}</code> значит: «ошибка, но код говорит "всё хорошо"». <code>201 Created</code> — «создано», <code>409 Conflict</code> — «конфликт, например мест нет». <code>_links</code> — список ссылок «что можно сделать дальше»: <code>cancel</code> — «отменить», <code>join-waitlist</code> — «встать в лист ожидания».'
    }),
    blank: () => ({ m: {} }),
    reference: () => ({ m: Object.fromEntries(RI.map(i => [i.id, i.lv])) }),
    render(el, ctx) {
      el.classList.add('h2-root');
      let reveal = null;
      if (ctx.result) { reveal = {}; RI.forEach(i => { const v = ctx.ans.m[i.id]; if (v) reveal[i.id] = v === i.lv ? 'ok' : 'bad'; }); }
      el.classList.add('h2-rich');
      ui.sort(el, { items: RI.map(i => ({ id: i.id, t: `<span class="h2-tt">${i.t}</span>` })), buckets: LV, value: ctx.ans.m, readonly: ctx.readonly, reveal, seed: 'h2-rich', onChange: m => ctx.save({ m }) });
    },
    check(ans) {
      const m = ans.m || {}, notes = []; let good = 0;
      RI.forEach(i => {
        if (!m[i.id]) { notes.push({ ok: false, html: `Не разложено: ${i.t}` }); return; }
        if (m[i.id] === i.lv) good++;
        else notes.push({ ok: false, html: `${i.t} — ${i.hint}` });
      });
      const score = good / RI.length;
      return { ok: good >= 7, score, summary: `Верно: ${good} из ${RI.length}.`, notes: notes.slice(0, 6) };
    },
    explain: `<p>Каждая ступень что-то даёт:</p>
      <ul class="checks">
        <li><b>1 — ресурсы:</b> адреса можно логировать, кэшировать и защищать по отдельности.</li>
        <li><b>2 — методы и коды:</b> GET безопасно повторять и кэшировать, PUT и DELETE идемпотентны, а 409 и 422 видны мониторингу без разбора тела. 200 с <code>"ok": false</code> мониторинг считает успехом.</li>
        <li><b>3 — гипермедиа:</b> правила «что можно сделать сейчас» живут на сервере. Приложению не нужно знать про 2 часа до отмены и лист ожидания — оно рисует кнопки по ссылкам.</li>
      </ul>
      <p>Эталон «Пульса» — ступень 2 для всего API и ступень 3 там, где действия зависят от состояния: карточка занятия, запись, страницы списков. SOAP в 1С — ступень 0, и это нормально: это чужой контракт (F-1c-soap).</p>`,
    report: ans => RI.map(i => `- ${plain(i.t)} → ${(LV.find(b => b.id === (ans.m || {})[i.id]) || { t: '—' }).t}${(ans.m || {})[i.id] === i.lv ? ' ✓' : ' ✗'}`).join('\n')
  };

  // =====================================================================
  // Подход 2. HATEOAS вживую
  // Сцена: «Сайкл» в понедельник в 19:00. Переключатель «Сейчас» — часы: 14:00, 16:30, 17:30, 19:10.
  // Правило клуба: бесплатная отмена не позже чем за 2 часа (до 17:00). Ольга сдвигает границу на 3 часа (до 16:00).
  // =====================================================================
  const TIME = [{ v: '5', t: '14:00 · за 5 ч' }, { v: '2.5', t: '16:30 · за 2,5 ч' }, { v: '1.5', t: '17:30 · за 1,5 ч' }, { v: 'live', t: '19:10 · уже идёт' }];
  const SEATS = [{ v: 'yes', t: 'есть' }, { v: 'no', t: 'нет' }];
  const ME = [{ v: 'none', t: 'не записан' }, { v: 'booked', t: 'записан' }, { v: 'wait', t: 'в листе ожидания' }, { v: 'blocked', t: 'заблокирован за прогулы' }];
  const RELS = ['book', 'join-waitlist', 'cancel', 'leave-waitlist'];
  const REL_RU = { book: 'записаться', 'join-waitlist': 'встать в лист ожидания', cancel: 'отменить запись', 'leave-waitlist': 'выйти из листа ожидания' };
  const CLS = '/v1/classes/4b1f0c3e-…', BKG = '/v1/bookings/9e2d7a10-…';
  // часы сцены (в минутах от полуночи)
  const START = 19 * 60, T0 = 13 * 60 + 30, T1 = 20 * 60;
  const NOW = { '5': 14 * 60, '2.5': 16 * 60 + 30, '1.5': 17 * 60 + 30, live: 19 * 60 + 10 };
  const hm = m => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  const pct = m => +((m - T0) / (T1 - T0) * 100).toFixed(2);
  const edgeOf = rule => START - (+rule || 2) * 60;   // до какого часа отмена бесплатна
  function links(s) {
    const L = { self: { href: CLS } }, rule = +s.rule || 2;
    if (s.t === 'live') return L;
    const h = +s.t;
    if (s.me === 'none') {
      if (s.seats === 'yes') L.book = { href: CLS + '/bookings', method: 'POST', title: 'Записаться' };
      else L['join-waitlist'] = { href: CLS + '/bookings', method: 'POST', body: { waitlist: true }, title: 'В лист ожидания' };
    }
    if (s.me === 'booked') {
      const free = h >= rule;
      L.cancel = { href: BKG + '/cancellation', method: 'POST', title: free ? 'Отменить бесплатно' : 'Отменить — будет прогул', lateCancel: !free };
    }
    if (s.me === 'wait') L['leave-waitlist'] = { href: BKG + '/cancellation', method: 'POST', title: 'Выйти из листа ожидания' };
    return L;
  }
  const relsOf = s => Object.keys(links(s)).filter(r => r !== 'self');
  function body(s) {
    const b = { id: '4b1f0c3e-6a1d-4f0e-9a51-2a7c1e9d1b10', title: 'Сайкл', startsAt: '2026-10-05T19:00:00+03:00', trainer: 'Игорь Ким', capacity: 20, freeSpots: s.seats === 'yes' ? 3 : 0 };
    if (s.me === 'booked') b.myBooking = { id: '9e2d7a10-…', status: 'booked', freeCancellationUntil: `2026-10-05T${hm(edgeOf(s.rule))}:00+03:00` };
    if (s.me === 'wait') b.myBooking = { id: '9e2d7a10-…', status: 'waitlist', position: 2 };
    if (s.me === 'blocked') b.bookingBlockedUntil = '2026-10-09T00:00:00+03:00';
    b._links = links(s);
    return b;
  }
  // «старое приложение» версии 1.8: кнопки считает само, правило «больше 2 часов — бесплатно» зашито в его код
  function oldButtons(s) {
    if (s.t === 'live') return [];
    if (s.me === 'none' || s.me === 'blocked') return s.seats === 'yes' ? [{ t: 'Записаться', k: 'primary' }] : [];
    if (s.me === 'booked') return +s.t >= 2 ? [{ t: 'Отменить бесплатно', k: '' }] : [{ t: 'Отменить — будет прогул', k: 'danger' }];
    if (s.me === 'wait') return [{ t: 'Выйти из листа ожидания', k: 'ghost' }];
    return [];
  }
  const KIND = { book: 'primary', 'join-waitlist': '', cancel: '', 'leave-waitlist': 'ghost' };
  const newButtons = s => Object.entries(links(s)).filter(([r]) => r !== 'self').map(([r, l]) => ({ t: l.title, k: r === 'cancel' && l.lateCancel ? 'danger' : KIND[r], rel: r, href: l.href, method: l.method }));
  const hoursTxt = t => t === 'live' ? 'занятие уже идёт' : `до начала ${String(t).replace('.', ',')} ч`;
  function phoneHTML(cap, s, btns, cls, ro) {
    const status = s.me === 'booked' ? '✓ Вы записаны' : s.me === 'wait' ? 'Вы в листе ожидания: 2-й' : s.me === 'blocked' ? 'Запись закрыта до 9 октября: 2 прогула' : '';
    return `<div class="h2-phone ${cls || ''}"><div class="notch"></div><div class="cap">${esc(cap)}</div>
      <div class="h2-card"><div class="eyebrow">Пульс Сокол · сайкл-студия</div><div class="ttl">Сайкл</div>
        <div class="small muted">пн, 5 октября, 19:00 · Игорь Ким</div>
        <div class="small">${s.seats === 'yes' ? 'Свободно 3 из 20' : 'Мест нет · 20 из 20'}</div>
        <div class="small">Сейчас ${hm(NOW[s.t])} · ${hoursTxt(s.t)}</div>
        ${status ? `<div class="small"><b>${esc(status)}</b></div>` : ''}
        ${btns.length ? btns.map(b => `<button type="button" class="btn sm ${b.k || ''}" ${b.rel ? `data-rel="${esc(b.rel)}"` : ''} ${ro ? 'disabled' : ''}>${esc(b.t)}</button>`).join('') : '<div class="none">Действий нет</div>'}
      </div></div>`;
  }
  // линия времени над телефонами: где «сейчас» и где граница бесплатной отмены
  function timeline(s) {
    const rule = +s.rule || 2, edge = edgeOf(rule), old = edgeOf(2), now = NOW[s.t];
    const pn = pct(now), pe = pct(edge), ps = pct(START);
    return `<div class="h2-tl" role="img" aria-label="Линия времени: сейчас ${hm(now)}, бесплатная отмена до ${hm(edge)}, занятие в 19:00">
      <div class="h2-tl-top"><span class="h2-tl-now" style="left:${pn}%;transform:translateX(-${pn}%)">сейчас ${hm(now)}</span></div>
      <div class="h2-tl-bar">
        <div class="z free" style="left:0;width:${pe}%">бесплатно</div>
        <div class="z late" style="left:${pe}%;width:${(ps - pe).toFixed(2)}%">прогул</div>
        <div class="z cls" style="left:${ps}%;right:0">занятие</div>
        <i class="old" style="left:${pct(old)}%"></i>
        <i class="now" style="left:${pn}%"></i>
      </div>
      <div class="h2-tl-ticks">${[14, 15, 16, 17, 18, 19].map(h => `<span style="left:${pct(h * 60)}%">${h}:00</span>`).join('')}</div>
      <div class="h2-tl-leg small">
        <span><i class="sw free"></i>бесплатная отмена — до ${hm(edge)} (правило сервера: за ${rule} ч)</span>
        <span><i class="sw late"></i>отмена = прогул</span>
        <span><i class="ln old"></i>граница, зашитая в версии 1.8: 17:00</span>
        <span><i class="ln now"></i>сейчас</span>
      </div>
    </div>`;
  }
  const ruleRow = (a, ro) => {
    const r3 = a.rule === '3';
    return `<button type="button" class="btn sm h2-wrapbtn" data-rule ${ro ? 'disabled' : ''}>${r3 ? '↺ Вернуть правило «за 2 часа»' : '📣 Ольга: «Бесплатная отмена — за 3 часа»'}</button>
      <span class="chip ${r3 ? 'warn' : ''}" style="white-space:normal;max-width:100%">Сервер: бесплатно до ${hm(edgeOf(a.rule))} (за ${r3 ? 3 : 2} ч)</span>
      <span class="chip" style="white-space:normal;max-width:100%">Версия 1.8: бесплатно, если до начала больше 2 ч</span>`;
  };
  const STATES = [
    { id: 's1', t: '14:00 (за 5 ч) · места есть · клиент не записан', s: { t: '5', seats: 'yes', me: 'none' }, hint: 'место есть, клиент свободен — какое одно действие ему доступно?' },
    { id: 's2', t: '14:00 (за 5 ч) · мест нет · клиент не записан', s: { t: '5', seats: 'no', me: 'none' }, hint: 'записаться нельзя, но и оставлять клиента ни с чем не стоит (F-waitlist).' },
    { id: 's3', t: '17:30 (за 1,5 ч) · клиент записан', s: { t: '1.5', seats: 'no', me: 'booked' }, hint: 'до начала занятия записанный всегда может отменить — вопрос только в цене.' },
    { id: 's4', t: '17:30 (за 1,5 ч) · клиент в листе ожидания', s: { t: '1.5', seats: 'no', me: 'wait' }, hint: 'записи на место ещё нет — отменять нечего. Но из очереди выйти можно.' },
    { id: 's5', t: '14:00 (за 5 ч) · места есть · клиент заблокирован за прогулы', s: { t: '5', seats: 'yes', me: 'blocked' }, hint: 'блокировка за прогулы (F-cancel) закрывает запись — и в лист ожидания тоже, это тоже запись.' },
    { id: 's6', t: '19:10 · занятие идёт · клиент записан', s: { t: 'live', seats: 'no', me: 'booked' }, hint: 'занятие началось: что ещё можно сделать с записью через приложение?' }
  ];
  const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));

  const hateoasTask = {
    id: 'hateoas-live', title: 'HATEOAS вживую',
    simple: {
      icon: '🧭', plain: 'Сервер в каждом ответе перечисляет, что клиент может сделать прямо сейчас. Приложение не вычисляет правила само, а рисует кнопки по этому списку.',
      analogy: 'Кофемашина в клубе подсвечивает только те напитки, на которые хватает денег и молока. Вам не нужно знать правила — вы видите доступные кнопки. Поменяли рецепт — подсветка поменялась сама, инструкцию никто не перепечатывал.',
      tech: 'HATEOAS (Hypermedia As The Engine Of Application State): в ответе <code>_links</code> — ссылки на допустимые переходы: <code>rel → {href, method, title}</code> (формат в духе HAL). Нет ссылки — нет кнопки. Клиент знает имена отношений (<code>book</code>, <code>cancel</code>), а не правила и не адреса.'
    },
    lead: ui.brief({
      situation: `<p>Понедельник, 5 октября. В 19:00 в клубе «Пульс Сокол» — «Сайкл» на 20 велосипедов. Анна смотрит это занятие в приложении.</p>
        <p>Правило клуба: отменить запись бесплатно можно не позже чем за 2 часа до начала, то есть <b>до 17:00</b>. Отмена позже — «прогул». Два прогула за 30 дней — запись закрыта на 7 дней.</p>
        <p>Три переключателя — это то, что видит сервер. <b>«Сейчас»</b> — во сколько Анна открыла карточку: 14:00 (до начала 5 ч), 16:30 (2,5 ч), 17:30 (1,5 ч) или 19:10 (занятие уже идёт). <b>«Места»</b> — остались ли свободные велосипеды. <b>«Клиент»</b> — кто Анна для этого занятия: не записана, записана, стоит в листе ожидания (очередь на освободившееся место) или заблокирована за прогулы.</p>`,
      todo: [
        'Поставьте «Сейчас: 16:30» и «Клиент: записан». Оба телефона пишут «Отменить бесплатно»: до 17:00 ещё полчаса.',
        'Нажмите «📣 Ольга: …». Посмотрите, что стало с линией времени и с каждым телефоном. Потом переключите «Сейчас» на 14:00 и 17:30 и сравните снова.',
        'Покрутите остальное: «Места: нет», лист ожидания, блокировку, «уже идёт». Нажимайте кнопки на левом телефоне — всплывёт, по какой ссылке оно идёт.',
        'Внизу таблица на 6 состояний. В каждой строке отметьте галочками ссылки, которые сервер положит в <code>_links</code> при обычном правиле (бесплатно до 17:00). <code>self</code> — ссылка «на эту карточку», она есть всегда, её отмечать не нужно. Если сервер не разрешает ни одного действия — оставьте строку пустой.',
        'Нажмите «Проверить». Строка засчитана, если галочки совпали с ответом сервера полностью — ни лишней, ни пропущенной. Нужно 5 строк из 6.'
      ],
      lookTitle: 'Как устроена симуляция',
      look: `<p><b>Сервер.</b> Каждый раз, когда приложение открывает карточку (<code>GET /classes/{classId}</code>), сервер смотрит на часы, на свободные места и на статус Анны. И решает, что ей можно сделать прямо сейчас. Разрешённые действия он кладёт в ответ, в раздел <code>_links</code> («ссылки»). Этот ответ — справа. Нет ссылки — действие сейчас запрещено.</p>
        <p><b>Левый телефон</b> (любая версия приложения) сам ничего не считает. Он рисует кнопку, только если пришла ссылка, а надпись берёт из поля <code>title</code>.</p>
        <p><b>Правый телефон — старое приложение версии 1.8.</b> На <code>_links</code> он не смотрит, а считает кнопки сам. В его код зашито правило «отмена бесплатна, если до начала больше 2 часов». Про лист ожидания и блокировку он не знает. Разошёлся с сервером — рамка красная.</p>
        <p><b>Кнопка Ольги</b> меняет правило только на сервере: бесплатно теперь за 3 часа, граница сдвигается с 17:00 на 16:00. Приложение 1.8 об этом не узнает, пока клиент его не обновит.</p>
        <p><b>Почему телефоны расходятся только в 16:30.</b> В 14:00 бесплатно по обоим правилам: до 16:00 и до 17:00 ещё далеко. В 17:30 поздно по обоим. А в 16:30 сервер уже предупреждает «будет прогул» (16:00 прошло), а версия 1.8 считает «2,5 ч больше 2 — бесплатно». Анна жмёт «Отменить бесплатно» и получает прогул, которого не ждала.</p>
        <p><b>Линия времени</b> над телефонами: зелёный участок — бесплатная отмена, красный — прогул, синяя черта — «сейчас», пунктир — граница 17:00 из кода версии 1.8.</p>`
    }),
    blank: () => ({ t: '5', seats: 'yes', me: 'none', rule: '2', m: {} }),
    reference: () => ({ t: '2.5', seats: 'yes', me: 'booked', rule: '3', m: Object.fromEntries(STATES.map(x => [x.id, relsOf(Object.assign({ rule: 2 }, x.s))])) }),
    render(el, ctx) {
      el.classList.add('h2-root');
      const a = ctx.ans;
      a.m = a.m || {};
      el.innerHTML = `<div class="stack">
        <div class="h2-box">
          <div class="h2-set">
            <div class="lbl">Сейчас</div>${ui.seg('t', TIME, a.t, 'accent')}
            <div class="lbl">Места</div>${ui.seg('seats', SEATS, a.seats, 'accent')}
            <div class="lbl">Клиент</div>${ui.seg('me', ME, a.me, 'accent')}
          </div>
          <div class="row" style="flex-wrap:wrap;gap:8px" data-rule-row>${ruleRow(a, ctx.readonly)}</div>
        </div>
        <div class="h2-box"><div class="eyebrow">Линия времени · понедельник, 5 октября</div><div data-tl></div></div>
        <div class="h2-lab"><div class="stack tight" data-phones></div><div data-json></div></div>
        <div data-diff></div>
        <div class="h2-box">
          <div class="eyebrow">Задание · что сервер положит в _links (обычное правило: бесплатно до 17:00)</div>
          <div data-ck></div>
        </div>
      </div>`;
      lock(TR.$('.h2-set', el), ctx.readonly);
      const phonesEl = TR.$('[data-phones]', el), jsonEl = TR.$('[data-json]', el), diffEl = TR.$('[data-diff]', el), tlEl = TR.$('[data-tl]', el);
      function draw() {
        const s = { t: a.t, seats: a.seats, me: a.me, rule: a.rule };
        const nb = newButtons(s), ob = oldButtons(s);
        const same = sameSet(nb.map(b => b.t), ob.map(b => b.t));
        tlEl.innerHTML = timeline(s);
        phonesEl.innerHTML = `<div class="h2-phones">${phoneHTML('любая версия · рисует по _links', s, nb, 'ok', ctx.readonly)}${phoneHTML('версия 1.8 · считает сама', s, ob, same ? '' : 'bad', true)}</div>`;
        jsonEl.innerHTML = ui.code(JSON.stringify(body(s), null, 2), 'json', 'Ответ сервера на GET /v1/classes/{classId} · что в _links, то и кнопки слева');
        let d = '';
        if (s.me === 'wait' && s.seats === 'yes' && s.t !== 'live') d = ui.note('', 'Редкое состояние', 'Так почти не бывает: освободившееся место сразу получает первый из листа ожидания (F-waitlist). Сервер покажет то же, что и для очереди.');
        else if (!same) {
          const why = s.me === 'blocked' ? 'Версия 1.8 не знает о блокировке за прогулы. Она показывает «Записаться», Анна жмёт — и получает ошибку. Сервер просто не дал ссылку <code>book</code>, поэтому слева кнопки нет.'
            : s.me === 'none' && s.seats === 'no' ? 'Версия 1.8 не умеет лист ожидания — Анне нечего нажать. Сервер дал ссылку <code>join-waitlist</code> с готовой надписью «В лист ожидания».'
              : s.me === 'booked' ? `Сейчас ${hm(NOW[s.t])}. По новому правилу Ольги бесплатно было до ${hm(edgeOf(s.rule))} — сервер честно пишет «Отменить — будет прогул». Версия 1.8 считает по-старому: «до начала 2,5 ч, это больше 2 — бесплатно». Анна отменяет, уверенная, что бесплатно, а получает прогул. Левый телефон показывает правду без новой версии приложения.`
                : 'Набор кнопок расходится с правилами сервера.';
          d = ui.note('bad', 'Телефоны разошлись', why);
        } else if (s.me === 'booked' && s.rule === '3' && s.t !== 'live') {
          d = ui.note('ok', 'Телефоны совпадают', `${s.t === '5' ? 'В 14:00 до обеих границ далеко: бесплатно и по правилу «за 3 часа» (до 16:00), и по правилу «за 2 часа» (до 17:00).' : 'В 17:30 поздно по обоим правилам: и 16:00, и 17:00 уже прошли.'} Разойдутся телефоны только между 16:00 и 17:00 — поставьте «16:30».`);
        } else d = ui.note('ok', 'Телефоны совпадают', 'Пока правила не менялись, оба приложения правы. Разница видна, когда меняется правило или появляется новое состояние. Попробуйте лист ожидания, блокировку или кнопку Ольги при «16:30, записан».');
        diffEl.innerHTML = d;
      }
      draw();
      ui.onSeg(TR.$('.h2-set', el), (name, v) => { if (ctx.readonly) return; a[name] = v; ctx.save(); draw(); });
      TR.on(el, 'click', '[data-rule]', () => {
        if (ctx.readonly) return;
        a.rule = a.rule === '3' ? '2' : '3'; ctx.save();
        TR.$('[data-rule-row]', el).innerHTML = ruleRow(a, false);
        if (a.rule === '3') ctx.toast('Граница бесплатной отмены на сервере сдвинулась на 16:00. Приложение 1.8 об этом не знает. Поставьте «16:30» и «записан».', 'warn');
        draw();
      });
      TR.on(phonesEl, 'click', '[data-rel]', (e, b) => {
        const l = links({ t: a.t, seats: a.seats, me: a.me, rule: a.rule })[b.dataset.rel]; if (!l) return;
        ctx.toast(`Приложение не знает адресов — оно идёт по ссылке: <code>${esc(l.method || 'GET')} ${esc(l.href)}</code>${l.body ? ' с телом <code>' + esc(JSON.stringify(l.body)) + '</code>' : ''}`, '');
      });
      // таблица-задание
      const ck = TR.$('[data-ck]', el);
      const res = ctx.result;
      const sub = t => `<div class="small dim" style="text-transform:none;letter-spacing:0;font-weight:400">${t}</div>`;
      ck.innerHTML = `<div class="tbl-wrap"><table class="tbl h2-ck"><thead><tr><th>Состояние</th><th><code>self</code>${sub('есть всегда')}</th>${RELS.map(r => `<th><code>${r}</code>${sub(REL_RU[r])}</th>`).join('')}</tr></thead><tbody>
        ${STATES.map(x => {
          const exp = relsOf(Object.assign({ rule: 2 }, x.s)), got = a.m[x.id] || [];
          return `<tr><td>${esc(x.t)}</td><td>✓</td>${RELS.map(r => {
            const on = got.includes(r);
            const cls = res ? (on && exp.includes(r) ? 'cell-ok' : on !== exp.includes(r) ? 'cell-bad' : '') : '';
            return `<td class="${cls}"><input type="checkbox" aria-label="${esc(x.t)}: ${r}" data-st="${x.id}" data-rel="${r}" ${on ? 'checked' : ''} ${ctx.readonly ? 'disabled' : ''} style="width:17px;height:17px;accent-color:var(--accent)"></td>`;
          }).join('')}</tr>`;
        }).join('')}</tbody></table></div>
        <p class="small dim">${ctx.result ? 'Красная клетка — лишняя или пропущенная ссылка.' : 'Отметьте ссылки, кроме <code>self</code>. Ни одного разрешённого действия — оставьте строку пустой. Проверить себя можно на симуляции выше: выставьте то же состояние и посмотрите на <code>_links</code>.'}</p>`;
      ck.addEventListener('change', e => {
        const c = e.target.closest('input[data-st]'); if (!c || ctx.readonly) return;
        const id = c.dataset.st, set = new Set(a.m[id] || []);
        if (c.checked) set.add(c.dataset.rel); else set.delete(c.dataset.rel);
        a.m[id] = RELS.filter(r => set.has(r)); ctx.save();
        c.parentElement.className = '';
      });
    },
    check(ans) {
      const m = ans.m || {}, notes = []; let good = 0;
      STATES.forEach(x => {
        const exp = relsOf(Object.assign({ rule: 2 }, x.s)), got = m[x.id] || [];
        if (sameSet(exp, got)) good++;
        else notes.push({ ok: false, html: `«${esc(x.t)}» — ${x.hint}` });
      });
      const score = good / STATES.length;
      if (!notes.length) notes.push({ ok: true, html: 'Все шесть состояний верны.' });
      return { ok: good >= 5, score, summary: `Верно: ${good} из ${STATES.length} состояний.`, notes };
    },
    explain: `<p>Правила записи (F-cancel, F-waitlist, блокировка за прогулы) живут <b>в одном месте — на сервере</b>. Приложение знает только имена ссылок и рисует кнопку, если ссылка пришла. Поэтому:</p>
      <ul class="checks">
        <li>Ольга меняет «2 часа» на «3 часа» — меняется одна настройка на сервере. Все версии приложения, которые рисуют кнопки по ссылкам, в 16:30 сразу показывают «Отменить — будет прогул». Без выпуска новой версии и без ожидания, пока все обновятся (F-old-apps).</li>
        <li>Нет ссылки — нет кнопки — нет запроса, который кончится 409 или 422.</li>
        <li><code>title</code> в ссылке — готовый текст кнопки, <code>lateCancel</code> — повод покрасить её в красный. Отмена с прогулом — всё ещё отмена: ссылку дают, но честно предупреждают.</li>
        <li>Ссылка не заменяет проверку: если клиент пришлёт запрос в обход кнопки, сервер всё равно проверит правило и ответит 409 или 422.</li>
      </ul>
      <p>Тот же приём в ошибках: 409 «мест нет» несёт ссылку <code>join-waitlist</code> (DOMAIN §10).</p>`,
    report: ans => {
      const m = ans.m || {};
      return STATES.map(x => { const exp = relsOf(Object.assign({ rule: 2 }, x.s)), got = m[x.id] || []; return `- ${x.t}: ${got.join(', ') || '—'} ${sameSet(exp, got) ? '✓' : '✗ (нужно: ' + (exp.join(', ') || 'только self') + ')'}`; }).join('\n') + `\nСобытие Ольги (правило 3 ч) пробовали: ${ans.rule === '3' ? 'да' : 'нет / вернули обратно'}.`;
    }
  };

  // =====================================================================
  // Подход 3. Зачем HATEOAS
  // =====================================================================
  const WHY_RUBRIC = [
    'Правила (когда можно отменить, бесплатно ли, лист ожидания, блокировка) живут на сервере, а не копируются в каждую версию приложения',
    'Старые версии приложения ведут себя правильно после смены правил — без релиза (F-old-apps, пример с 3 часами)',
    'Кнопка показывается, только когда действие разрешено, — меньше ошибочных запросов и ответов 409/422',
    'Адреса и параметры (курсор следующей страницы, ссылка на файл выгрузки) клиент берёт из ответа, а не собирает сам',
    'Честно названа цена: ответы длиннее, а сервер всё равно проверяет правило при самом действии'
  ];
  const WHY_REF = 'Знать адреса мало — важно знать, что разрешено сейчас. Это правила: отмена бесплатно за 2 часа, лист ожидания, блокировка за прогулы. Если правила зашиты в приложение, каждое изменение — релиз, а старые версии живут месяцами (F-old-apps): Ольга поменяет правило на 3 часа, и половина клиентов увидит неверную кнопку. С HATEOAS сервер присылает ссылки только на разрешённые действия, приложение рисует кнопки по ним — правило меняется в одном месте. Плюс меньше ошибочных запросов и готовые адреса для следующей страницы или файла. Цена — ответы чуть длиннее, а проверка на сервере при самом действии всё равно нужна.';
  const whyTask = {
    id: 'why-hateoas', title: 'Зачем HATEOAS',
    lead: ui.brief({
      situation: 'Созвон со студией Дениса — она делает приложение «Пульса». Денис сомневается: «Зачем нам ссылки в ответах? Мои разработчики и так знают все адреса API. А это лишние байты на медленном мобильном интернете». Убедите его простыми словами, на примере «Пульса», а не термином.',
      todo: [
        'Напишите ответ Денису в поле — от 120 символов.',
        'Опирайтесь на то, что видели в прошлом подходе: два телефона, 16:30 и правило Ольги «за 3 часа».',
        'Проверьте ответ с Верой или откройте эталон под полем и честно отметьте, что раскрыли. Засчитается, если раскрыто хотя бы 60 % пунктов.'
      ],
      lookTitle: 'Как проверяется',
      look: 'Ответ сравнивают со списком пунктов — доводов, которые должны прозвучать. Вера читает текст и отмечает раскрытые пункты. Если Вера недоступна, откройте эталон и отметьте их сами.'
    }),
    blank: () => ({ j: {} }),
    reference: () => ({ j: { text: WHY_REF, self: WHY_RUBRIC.map(() => true) } }),
    render(el, ctx) {
      el.classList.add('h2-root');
      el.innerHTML = ui.say('denis', 'Зачем нам ссылки в ответах? Мои ребята и так знают все адреса API. Это лишние байты на 3G.');
      const d = mount(el);
      ui.justify(d, {
        id: 'h2-why', q: 'Что вы ответите Денису?', rubric: WHY_RUBRIC, reference: WHY_REF, value: ctx.ans.j, readonly: ctx.readonly, minLen: 120,
        onChange: j => { ctx.save({ j }); ctx.decide('Зачем HATEOAS (ответ Денису)', j.text || ''); }
      });
    },
    check(ans) {
      const s = ui.justifyScore(ans.j);
      const len = ((ans.j || {}).text || '').trim().length;
      const notes = [];
      if (len < 120) notes.push({ ok: false, html: 'Ответ слишком короткий — Денис не услышит доводов. Нужно хотя бы 120 символов.' });
      else if (!(ans.j || {}).self && !(ans.j || {}).ai) notes.push({ ok: 'warn', html: 'Сверьте ответ с эталоном (кнопка под полем) или проверьте с Верой.' });
      else notes.push({ ok: s >= 0.6, html: `Покрыто критериев: ${Math.round(s * 100)}%.` });
      return { ok: s >= 0.6, score: s, notes, vera: s < 0.6 && len >= 120 ? 'Главный довод не «красиво», а «правило меняется в одном месте, и старые приложения не врут клиенту». Вспомните телефоны в 16:30 после правила Ольги «за 3 часа».' : null };
    },
    explain: '<p>Хороший ответ клиенту говорит на языке его боли. У Дениса боль — старые версии и релизы через сторы. HATEOAS снимает с приложения знание правил: приложение знает «как показать кнопку <code>cancel</code>», а сервер знает «когда её показать». Лишние байты — около сотни на ответ, на фоне фотографии тренера это ничто.</p>',
    report: ans => `Ответ Денису:\n> ${String((ans.j || {}).text || '—').replace(/\n/g, '\n> ')}\nСамооценка: ${Math.round(ui.justifyScore(ans.j) * 100)}%.`
  };

  // =====================================================================
  // Подход 4. Страницы: offset или курсор
  // =====================================================================
  const PMODE = [{ v: 'offset', t: 'offset (пропусти N)' }, { v: 'cursor', t: 'курсор (после записи X)' }];
  const PEV = [{ v: 'add', t: 'пришли 2 новых визита' }, { v: 'del', t: 'удалили ошибочный визит' }];
  const BASE = Array.from({ length: 12 }, (_, i) => 112 - i); // v112 … v101, новые сверху
  function paging(mode, ev) {
    const p1 = BASE.slice(0, 5);
    const list = ev === 'add' ? [114, 113].concat(BASE) : BASE.filter(x => x !== 110);
    const p2 = mode === 'offset' ? list.slice(5, 10) : list.filter(x => x < p1[p1.length - 1]).slice(0, 5);
    const all = p1.concat(p2), dups = p2.filter(x => p1.includes(x));
    const lo = Math.min(...all), hi = Math.max(...all);
    const skips = list.filter(x => x >= lo && x <= hi && !all.includes(x));
    return { p1, p2, dups, skips, list };
  }
  const vid = n => 'v' + n;
  function pageSteps(mode, ev) {
    const r = paging(mode, ev), S = [];
    S.push({ from: 'fp', to: 'api', t: 'GET …/visits?month=2026-10&limit=5', note: 'ФитПасс начинает сверку за октябрь (F-fitpass-recon). Список — новые визиты сверху, по 5 на страницу.' });
    S.push({ from: 'api', to: 'fp', t: `200: ${vid(r.p1[0])}…${vid(r.p1[4])}` + (mode === 'cursor' ? ' + next' : ''), reply: true, note: mode === 'cursor' ? 'В ответе ссылка <code>_links.next</code> с курсором: «дальше — всё, что старше v108».' : 'ФитПасс запоминает: следующая страница — <code>offset=5</code>.' });
    S.push(ev === 'add'
      ? { from: 'club', to: 'api', t: 'проходы: v113, v114', kind: 'warn', note: 'Пока ФитПасс обрабатывал первую страницу, в клубах прошли ещё двое. Они встали в начало списка.' }
      : { from: 'club', to: 'api', t: 'удалён ошибочный v110', kind: 'warn', note: 'Администратор удалил задвоенный проход v110 — он был на первой странице.' });
    S.push({ from: 'fp', to: 'api', t: mode === 'offset' ? 'GET …&limit=5&offset=5' : 'GET по ссылке next (после v108)' });
    const bad = r.dups.length || r.skips.length;
    S.push({ from: 'api', to: 'fp', t: `200: ${vid(r.p2[0])}…${vid(r.p2[r.p2.length - 1])}`, reply: true, kind: bad ? 'bad' : 'ok', note: mode === 'offset' ? 'Сервер честно пропустил первые 5 строк — но это уже другие 5 строк.' : 'Сервер отдал то, что идёт после v108, независимо от того, что случилось сверху.' });
    S.push({ from: 'fp', to: 'fp', t: r.dups.length ? `дубли: ${r.dups.map(vid).join(', ')}` : r.skips.length ? `пропущен ${r.skips.map(vid).join(', ')}` : 'без дублей и пропусков', kind: bad ? 'bad' : 'ok' });
    S.push({ from: 'fp', to: 'club', box: true, kind: bad ? 'bad' : 'ok', t: bad ? (r.dups.length ? 'Визиты посчитаны дважды — спор о деньгах' : 'Визит потерян — ФитПасс его не оплатит') : 'Сверка сходится', note: bad ? 'Расхождения в сверке разбирают вручную. Каждый дубль или пропуск — это деньги и часы бухгалтерии.' : 'Новые визиты v113 и v114 попадут в следующий проход сверки — курсор не путает старое с новым.' });
    return S;
  }
  const PSQL = {
    offset: `SELECT … FROM visit
 WHERE partner_id = $1 AND entered_at >= '2026-10-01' AND entered_at < '2026-11-01'
 ORDER BY entered_at DESC, id DESC
 LIMIT 5 [[bad]]OFFSET 5[[/]];          -- «пропусти 5 строк» — каких, решает момент запроса`,
    cursor: `SELECT … FROM visit
 WHERE partner_id = $1 AND entered_at >= '2026-10-01' AND entered_at < '2026-11-01'
   [[ok]]AND (entered_at, id) < ($2, $3)[[/]]   -- из курсора: время и id последней выданной записи
 ORDER BY entered_at DESC, id DESC
 LIMIT 5;`
  };
  const PQ = [
    {
      q: 'Почему с offset ФитПасс получил часть визитов дважды?', seed: 'h2-p1',
      options: [
        { t: 'offset считает позиции в списке, а не записи: два новых визита сверху сдвинули всё на две позиции', ok: 1, why: 'Верно. «Пропусти 5» — это «пропусти 5 мест в очереди», а очередь успела измениться.' },
        { t: 'Сервер перепутал сортировку', why: 'Сортировка одинаковая в обоих запросах. Поменялся сам список.' },
        { t: 'ФитПасс повторил запрос из-за таймаута', why: 'Повтор GET ничего не задваивает — он просто вернёт ту же страницу.' },
        { t: 'Так работает кэш CDN', why: 'Партнёрский API с персональными данными не кэшируется на CDN. Дело в offset.' }
      ]
    },
    {
      q: 'Что хранит курсор?', seed: 'h2-p2',
      options: [
        { t: 'Где остановились: время и id последней выданной записи — «дальше всё, что старше неё»', ok: 1, why: 'Верно. Курсор привязан к записи, а не к позиции.' },
        { t: 'Номер страницы, закодированный в base64', why: 'Тогда он сломается так же, как offset: смысл в привязке к записи.' },
        { t: 'Снимок всей выборки на сервере', why: 'Хранить снимки для каждого клиента дорого; курсору это не нужно.' },
        { t: 'Время первого запроса', why: 'По одному времени не понять, где остановились внутри списка.' }
      ]
    },
    {
      q: 'Зачем в курсоре, кроме времени прохода, ещё и id?', seed: 'h2-p3',
      options: [
        { t: 'Двое могут пройти в одну секунду — без id на границе страницы один из них потеряется или повторится', ok: 1, why: 'Верно. Ключ сортировки должен быть уникальным: (entered_at, id).' },
        { t: 'id нужен для проверки прав партнёра', why: 'Права проверяются по токену партнёра, курсор здесь ни при чём.' },
        { t: 'Без id курсор нельзя закодировать', why: 'Закодировать можно что угодно. Вопрос в однозначности позиции.' },
        { t: 'Незачем, времени хватит', why: 'В пик через турникеты проходят несколько человек в секунду — время не уникально.' }
      ]
    }
  ];
  const PQ_HINT = ['вспомните сценарий: что изменилось в списке между двумя запросами?', 'курсор должен пережить вставки и удаления выше по списку. К чему его привязать?', 'что будет на границе страницы, если у двух визитов одинаковое время?'];
  const pageTask = {
    id: 'pages', title: 'Страницы: offset или курсор',
    simple: {
      icon: '🔖', plain: 'Длинный список отдают порциями. Важно, как сказать «дай следующую порцию»: «пропусти первые N» или «дай всё после этой записи».',
      analogy: 'Offset — «встаньте шестым в очереди»: пока вы отходили, двое влезли вперёд, и вы снова стоите за тем же человеком. Курсор — закладка в книге: в начало вклеили страницы, а вы всё равно открываете там, где остановились.',
      tech: '<code>LIMIT 5 OFFSET 5</code> против keyset-пагинации: <code>WHERE (entered_at, id) &lt; ($2, $3)</code>. Курсор — непрозрачная строка, клиент берёт его из ссылки <code>_links.next</code>. Нет ссылки <code>next</code> — список кончился.'
    },
    lead: ui.brief({
      situation: 'Раз в месяц ФитПасс сверяет визиты своих клиентов: их список против нашего. Визитов за октябрь много, поэтому сервер отдаёт их порциями — страницами по 5, новые сверху (<code>GET /partner/v1/visits?month=2026-10</code>). Беда в том, что пока ФитПасс читает первую страницу, список меняется: в клубе прошли новые люди, админ удалил ошибочную отметку. Каждый дубль или пропуск в сверке — спор о деньгах.',
      todo: [
        'Выберите «Способ» — как ФитПасс просит следующую страницу. <b>offset</b> — «пропусти первые 5 строк». <b>Курсор</b> — «дай всё, что старше визита v108».',
        'Выберите, что случится «Между страницами»: пришли 2 новых визита или удалили ошибочный.',
        'Проиграйте все 4 сочетания и следите за счётчиками «Дубли» и «Пропуски».',
        'Ответьте на три вопроса внизу. Засчитается при 2 верных из 3, причём первый вопрос должен быть верным.'
      ],
      look: 'Схема — три участника: ФитПасс, наш API и клубы. Читайте её сверху вниз, под ней пояснения к шагам. Каждый визит — фишка с номером, например v112: чем больше номер, тем новее визит. Под схемой — что ФитПасс собрал за две страницы. Черта │ отделяет первую страницу от второй. Красная фишка «×2» — визит пришёл дважды. Жёлтая «пропущен» — визит не попал ни на одну страницу. Ниже — SQL-запрос второй страницы: красным — опасное место, зелёным — исправление.'
    }),
    blank: () => ({ mode: 'offset', ev: 'add', seen: [], q: [] }),
    reference: () => ({ mode: 'cursor', ev: 'add', seen: ['offset|add', 'offset|del', 'cursor|add', 'cursor|del'], q: quizRef(PQ) }),
    render(el, ctx) {
      el.classList.add('h2-root');
      const a = ctx.ans;
      a.seen = a.seen || [];
      if (!ctx.readonly && !a.seen.includes(a.mode + '|' + a.ev)) { a.seen.push(a.mode + '|' + a.ev); ctx.save(); }
      el.innerHTML = `<div class="stack">
        <div class="h2-box">
          <div class="h2-set">
            <div class="lbl">Способ</div>${ui.seg('mode', PMODE, a.mode, 'accent')}
            <div class="lbl">Между страницами</div>${ui.seg('ev', PEV, a.ev, 'accent')}
          </div>
          <div data-pstats></div>
          <div data-seq></div>
          <div data-ids></div>
          <div data-sql></div>
        </div>
        <div class="stack" data-q></div>
      </div>`;
      const stEl = TR.$('[data-pstats]', el), idsEl = TR.$('[data-ids]', el), sqlEl = TR.$('[data-sql]', el);
      function draw() {
        const r = paging(a.mode, a.ev), seen = ctx.readonly || a.seen.includes(a.mode + '|' + a.ev);
        stEl.innerHTML = `<div class="h2-stats">
          <div class="stat"><div class="k">Получено строк</div><div class="v">${seen ? r.p1.length + r.p2.length : '—'}</div><div class="s small dim">две страницы по 5</div></div>
          <div class="stat"><div class="k">Дубли</div><div class="v ${seen ? (r.dups.length ? 'bad' : 'ok') : ''}">${seen ? r.dups.length : '—'}</div><div class="s small dim">${seen && r.dups.length ? r.dups.map(vid).join(', ') : 'визиты дважды'}</div></div>
          <div class="stat"><div class="k">Пропуски</div><div class="v ${seen ? (r.skips.length ? 'bad' : 'ok') : ''}">${seen ? r.skips.length : '—'}</div><div class="s small dim">${seen && r.skips.length ? r.skips.map(vid).join(', ') : 'визиты мимо сверки'}</div></div>
        </div>`;
        idsEl.innerHTML = seen ? `<div class="small dim">Что собрал ФитПасс:</div><div class="h2-ids">${r.p1.concat(r.p2).map((x, i) => `<span class="chip ${i >= 5 && r.dups.includes(x) ? 'bad' : ''}">${i === 5 ? '│ ' : ''}${vid(x)}${i >= 5 && r.dups.includes(x) ? ' ×2' : ''}</span>`).join('')}${r.skips.map(x => `<span class="chip warn">пропущен ${vid(x)}</span>`).join('')}</div>` : '';
        sqlEl.innerHTML = ui.code(PSQL[a.mode], 'sql', a.mode === 'offset' ? 'Вторая страница через offset' : 'Вторая страница через курсор');
      }
      const seq = ui.seq(TR.$('[data-seq]', el), {
        lanes: [{ id: 'fp', t: 'ФитПасс', sub: 'сверка визитов' }, { id: 'api', t: 'API «Пульса»', sub: 'Partner API' }, { id: 'club', t: 'Клубы', sub: 'турникеты, админы' }],
        steps: pageSteps(a.mode, a.ev), start: 'all', speed: 800, laneW: 190, title: 'Пагинация визитов для сверки', hint: 'Нажмите «Проиграть».',
        onEnd() { const k = a.mode + '|' + a.ev; if (!ctx.readonly && !a.seen.includes(k)) { a.seen.push(k); ctx.save(); } draw(); }
      });
      draw();
      lock(TR.$('.h2-set', el), ctx.readonly);
      ui.onSeg(TR.$('.h2-set', el), (name, v) => { if (ctx.readonly) return; a[name] = v; ctx.save(); seq.set(pageSteps(a.mode, a.ev), { play: true }); draw(); });
      quizSet(TR.$('[data-q]', el), ctx, PQ, (i, v) => { if (i === 1 && PQ[1].options[v[0]] && PQ[1].options[v[0]].ok) ctx.decide('Пагинация партнёрских списков', 'курсор (entered_at, id) + _links.next'); });
    },
    check(ans) {
      const r = quizSetScore(PQ, ans.q), notes = quizNotes(r.res, PQ_HINT);
      const seen = (ans.seen || []).length;
      if (seen < 4) notes.push({ ok: 'info', html: `Проиграно сочетаний: ${seen} из 4. Удаление визита показывает второй вид поломки offset — пропуск.` });
      return { ok: r.good >= 2 && r.res[0].ok, score: r.score, summary: `Верно: ${r.good} из ${PQ.length}.`, notes };
    },
    explain: `<p>Для «Пульса» эталон — <b>курсоры</b> во всех списках, которые растут: «мои записи», история посещений, расписание для партнёра, сверка визитов (DOMAIN §10). Курсор приходит в ссылке — это тот же HATEOAS:</p>
      ${ui.code(`{
  "items": [ … 5 визитов … ],
  "_links": {
    "self": { "href": "/partner/v1/visits?month=2026-10&limit=5" },
    [[hl]]"next": { "href": "/partner/v1/visits?month=2026-10&limit=5&cursor=eyJ0IjoiMjAyNi0xMC0wNVQxODo0NyIsImlkIjoxMDh9" }[[/]]
  }
}`, 'json')}
      <ul class="checks">
        <li>Курсор непрозрачен: клиент не разбирает его, а просто идёт по <code>next</code>. Формат можно менять без новой версии API.</li>
        <li>Ещё плюс: <code>OFFSET 100000</code> заставляет базу прочитать и выбросить сто тысяч строк, а курсор идёт по индексу сразу в нужное место.</li>
        <li>Offset уместен там, где список почти не меняется и нужен переход «на страницу 7»: например, справочник в кабинете.</li>
        <li>Для сверки ещё надёжнее читать «старые сверху» за закрытый месяц: новые визиты встают в конец и ничего не сдвигают.</li>
      </ul>`,
    report: ans => `Проиграно сочетаний: ${(ans.seen || []).length} из 4.\n${quizReport(PQ, ans.q)}`
  };

  // =====================================================================
  // Подход 5. HTTP-кэш и 202
  // =====================================================================
  const CQ = [
    {
      q: 'Публичное расписание клуба на сайте: до 500 запросов в секунду (F-site). Что поставить в ответ <code>GET /clubs/{clubId}/classes?date=…</code>?', seed: 'h2-c1',
      options: [
        { t: '<code>Cache-Control: public, max-age=30</code> и <code>ETag</code>', ok: 1, why: 'Верно. CDN 30 секунд отдаёт свою копию — до базы доходят единицы запросов. Потом переспрашивает с <code>If-None-Match</code> и обычно получает короткий 304.' },
        { t: '<code>Cache-Control: no-store</code>', why: 'Все 500 запросов в секунду пойдут в базу. Расписание одинаково для всех — его и надо кэшировать.' },
        { t: '<code>Cache-Control: public, max-age=86400</code>', why: 'Сутки — слишком долго: отменённое занятие сайт будет показывать до завтра.' },
        { t: '<code>Cache-Control: private, max-age=30</code>', why: '<code>private</code> запрещает общий кэш (CDN) — разгрузки не будет. Расписание не персональное.' }
      ]
    },
    {
      q: 'Тренер отменил занятие в 19:00:05. Расписание на сайте кэшируется с <code>max-age=30</code>. Когда посетители сайта увидят отмену?', seed: 'h2-c2',
      options: [
        { t: 'Не позже чем через 30 секунд — это осознанная цена кэша; записанным клиентам уйдёт пуш, а их «мои записи» читаются с мастера без кэша', ok: 1, why: 'Верно. Кэш — всегда компромисс между свежестью и нагрузкой. Важным людям сообщаем отдельно.' },
        { t: 'Мгновенно: CDN сам узнаёт об изменениях в базе', why: 'CDN ничего не знает о вашей базе. Мгновенно — только если явно сбросить кэш (purge), и это отдельная работа.' },
        { t: 'Через сутки', why: 'Копия живёт не дольше <code>max-age</code> — 30 секунд.' },
        { t: 'Никогда, пока кэш не очистят вручную', why: 'После 30 секунд CDN обязан перепроверить копию у сервера.' }
      ]
    },
    {
      q: 'Тимур: «На старом сайте Анна открыла профиль и увидела данные Петра». В ответе <code>GET /me</code> стояло <code>Cache-Control: public, max-age=60</code>. Что исправить?', seed: 'h2-c3',
      options: [
        { t: '<code>Cache-Control: private, no-store</code> на всех персональных ответах', ok: 1, why: 'Верно. CDN — общий кэш: с <code>public</code> он раздал профиль Петра всем, кто открыл /me следующую минуту. Канон: <code>GET /me</code> — <code>private, no-store</code>.' },
        { t: 'Уменьшить <code>max-age</code> до 5 секунд', why: 'Чужой профиль будут видеть 5 секунд вместо минуты. Утечка остаётся утечкой.' },
        { t: 'Добавить <code>ETag</code>', why: 'ETag помогает проверять свежесть, но не отделяет Анну от Петра.' },
        { t: 'Включить HTTPS', why: 'Канал и так шифрован. Беда в том, что общий кэш отдал чужой ответ.' }
      ]
    },
    {
      q: 'Директор просит выгрузку выручки за месяц (F-reports), она считается около двух минут. Как устроить <code>POST /reports/revenue-exports</code>?', seed: 'h2-c4',
      options: [
        { t: '<code>202 Accepted</code> + <code>Location: /reports/revenue-exports/{id}</code>; кабинет опрашивает статус, по готовности — ссылка на файл', ok: 1, why: 'Верно. «Принято, делаем, следите вот здесь» — как квитанция в химчистке.' },
        { t: 'Держать соединение две минуты и вернуть <code>200</code> с файлом', why: 'Балансировщик и браузер оборвут соединение раньше. Директор нажмёт ещё раз — и запустит вторую тяжёлую выгрузку.' },
        { t: '<code>201 Created</code> сразу с пустым файлом', why: '201 обещает, что ресурс готов. Пустой файл — неправда.' },
        { t: '<code>200</code> и письмо на почту, когда будет готово', why: 'Письмо — приятное дополнение, но по 200 кабинет решит, что всё готово. Нужен статус «принято» и адрес, где следить.' }
      ]
    }
  ];
  const CQ_HINT = [
    'расписание одинаково для всех и меняется нечасто. Кто может хранить копию и как долго — без вреда?',
    'кто и когда заставит CDN перепроверить копию?',
    'чем общий кэш (CDN) отличается от кэша в браузере самой Анны?',
    'операция долгая. Какой код говорит «принято, но ещё не готово» и где клиенту следить за результатом?'
  ];
  const cacheTask = {
    id: 'cache-202', title: 'HTTP-кэш, 304 и 202',
    simple: {
      icon: '🗞️', plain: 'Одинаковые для всех ответы можно раздавать копиями, не дёргая базу. Персональные — никогда. А долгую работу не ждут на открытом соединении: принимают и дают адрес, где следить.',
      analogy: 'Расписание на стенде у входа: его печатают раз в полминуты, а не по просьбе каждого. На листе номер редакции: «у меня редакция 41 — есть новее?» — «нет, та же» (это 304). Но личную карточку клиента на общий стенд не вешают. А выгрузка за месяц — как химчистка: «приняли, вот квитанция, заходите за готовым».',
      tech: '<code>Cache-Control: public, max-age=N</code> — можно хранить в общем кэше (CDN) N секунд; <code>private, no-store</code> — нельзя. <code>ETag</code> + <code>If-None-Match</code> → <code>304 Not Modified</code> без тела. Долгая операция — <code>202 Accepted</code> + <code>Location</code> на ресурс статуса.'
    },
    lead: ui.brief({
      situation: 'Сайт «Пульса» показывает расписание без входа. С рекламы туда приходит до 500 запросов в секунду. Если каждый пойдёт в базу, она не выдержит. Выход — раздавать копии. Между сайтом и нами стоит <b>CDN</b> — сеть серверов-посредников, которые хранят копии наших ответов. Можно ли хранить копию и сколько — сервер пишет в заголовке <code>Cache-Control</code>.',
      todo: [
        'Сначала разберите пример вверху: как CDN через 5 минут спрашивает сервер «не изменилось ли?» и получает короткий ответ 304.',
        'Ответьте на четыре вопроса: кэш расписания, когда сайт покажет отмену занятия, чужой профиль, долгая выгрузка выручки.',
        'Нажмите «Проверить». Нужно 3 верных из 4, и обязательно верный ответ про чужой профиль: ошибка там — утечка личных данных.'
      ],
      lookTitle: 'Как читать пример',
      look: '<p>Слева — первый ответ сервера. <code>max-age=300</code> — «копия свежая 300 секунд, то есть 5 минут». <code>ETag: "41"</code> — номер редакции ответа. Справа — через 5 минут CDN спрашивает: <code>If-None-Match: "41"</code> — «у меня редакция 41, есть новее?». Сервер отвечает <code>304 Not Modified</code> — «не изменилось», без тела.</p><p>Слова в <code>Cache-Control</code>: <code>public</code> — копию можно хранить в общем кэше для всех; <code>private</code> — только в браузере самого клиента; <code>no-store</code> — не хранить нигде. После проверки внизу появится схема ответа <code>202</code> — «принято, делаем, следите вот здесь».</p>'
    }),
    blank: () => ({ q: [] }),
    reference: () => ({ q: quizRef(CQ) }),
    render(el, ctx) {
      el.classList.add('h2-root');
      el.innerHTML = `<div class="stack">
        <div class="grid2">
          <div style="min-width:0">${ui.http({ cap: 'первый запрос CDN', status: 200, headers: { 'Cache-Control': 'public, max-age=300', ETag: '"41"', 'Content-Type': 'application/json' }, body: '{ "items": [ … 15 видов абонементов … ] }' })}</div>
          <div style="min-width:0" class="stack tight">${ui.http({ cap: 'через 5 минут CDN переспрашивает', method: 'GET', path: '/v1/membership-plans', headers: { 'If-None-Match': '"41"' } })}${ui.http({ status: 304, headers: { ETag: '"41"', 'Cache-Control': 'public, max-age=300' } })}</div>
        </div>
        <p class="small muted">Каталог не изменился — сервер ответил 304 без тела, CDN продлил свою копию ещё на 5 минут. Изменилась бы цена — пришёл бы 200 с новым телом и новым ETag.</p>
        <div class="stack" data-q></div>
        <div data-seq202></div>
      </div>`;
      quizSet(TR.$('[data-q]', el), ctx, CQ, (i, v) => {
        const o = CQ[i].options[v[0]]; if (!o) return;
        if (i === 0) ctx.decide('Кэш публичного расписания', plain(o.t));
        if (i === 3) ctx.decide('Выгрузка выручки', plain(o.t));
      });
      if (ctx.result || ctx.readonly) {
        const box = TR.$('[data-seq202]', el);
        box.innerHTML = '<div class="eyebrow">Как выглядит 202 вживую</div><div data-s></div>';
        ui.seq(TR.$('[data-s]', box), {
          lanes: [{ id: 'dir', t: 'Кабинет', sub: 'директор' }, { id: 'api', t: 'API «Пульса»' }, { id: 'job', t: 'Фоновая задача', sub: 'считает выручку' }],
          start: 'all', speed: 800, laneW: 190, title: '202 Accepted и опрос статуса',
          steps: [
            { from: 'dir', to: 'api', t: 'POST /reports/revenue-exports', note: 'Тело: <code>{"month": "2026-09"}</code>.' },
            { from: 'api', to: 'job', t: 'задание → таблица заданий', note: 'Без брокеров: строка в таблице заданий, её забирает фоновый обработчик.' },
            { from: 'api', to: 'dir', t: '202 · Location: …/exports/e-15', reply: true, kind: 'ok', note: 'Ответ за миллисекунды: «принято, следите по этому адресу».' },
            { from: 'job', to: 'job', box: true, t: 'считаю… 40 %', kind: 'info' },
            { from: 'dir', to: 'api', t: 'GET …/exports/e-15' },
            { from: 'api', to: 'dir', t: '200 {"status":"running"} · Retry-After: 10', reply: true, note: '<code>Retry-After</code> подсказывает, когда спросить снова, — кабинет не долбит сервер каждую секунду.' },
            { from: 'job', to: 'job', box: true, t: 'файл готов', kind: 'ok' },
            { from: 'dir', to: 'api', t: 'GET …/exports/e-15' },
            { from: 'api', to: 'dir', t: '200 {"status":"done"} + _links.file', reply: true, kind: 'ok', note: 'Ссылка на файл — снова гипермедиа: кабинет не собирает адрес файла сам.' }
          ]
        });
      }
    },
    check(ans) {
      const r = quizSetScore(CQ, ans.q), notes = quizNotes(r.res, CQ_HINT);
      if (!r.res[2].ok) notes.push({ ok: false, html: 'Вопрос про чужой профиль — критичный: это утечка персональных данных.' });
      return { ok: r.good >= 3 && r.res[2].ok, score: r.score, summary: `Верно: ${r.good} из ${CQ.length}.`, notes };
    },
    explain: `${ui.table(['Ответ', 'Cache-Control', 'Почему'], [
        ['Публичное расписание, клубы, каталог абонементов', '<code>public, max-age=30</code> + <code>ETag</code>', 'одинаково для всех; 500 запросов в секунду с сайта гасит CDN'],
        ['<code>GET /me</code>, мои записи, мои абонементы', '<code>private, no-store</code>', 'персональные данные; читаем с мастера (read-your-writes)'],
        ['Partner API (ФитПасс)', 'кэш расписания на нашей стороне', 'партнёр ходит под своим токеном, CDN не участвует'],
        ['POST, PATCH, DELETE', 'не кэшируются', 'изменяют данные']
      ])}
      <p>304 работает и для приложения: главный экран на 3G (F-mobile) экономит трафик, если расписание не изменилось. Для изменяющих запросов тот же ETag работает уже как <code>If-Match</code> — это было утром, в лаборатории двух администраторов.</p>
      <p>202 + <code>Location</code> + опрос — способ асинхронности без брокеров: выгрузки, отчёты, тяжёлые пересчёты. Ссылку на результат сервер отдаёт в <code>_links</code>.</p>`,
    report: ans => quizReport(CQ, ans.q)
  };

  // =====================================================================
  TR.stage({
    id: 'hard-2', act: 3, order: 120, slot: 'Ср 15:00', title: 'HATEOAS, страницы, кэш',
    when: 'среда, 15:00 · созвон со студией Дениса',
    intro: [
      { who: 'denis', html: 'У нас в приложении логика «можно ли отменить бесплатно» зашита в коде: больше двух часов до начала — зелёная кнопка. Старые версии живут у клиентов месяцами.' },
      { who: 'olga', html: 'А я хочу с понедельника сделать бесплатную отмену за 3 часа. Это что, ждать, пока все обновятся?' },
      { who: 'vera', html: 'Не обязательно. Если правила живут на сервере, а приложение рисует кнопки по ссылкам из ответа, смена правила не требует релиза. Это HATEOAS — сейчас покажу на телефоне. А заодно разберём страницы для сверки с ФитПассом и кэш для сайта.' }
    ],
    facts: ['F-old-apps', 'F-cancel', 'F-waitlist', 'F-fitpass-recon', 'F-site', 'F-reports'],
    glossary: [
      { term: 'HATEOAS', simple: 'Ответ сервера сам подсказывает, что можно сделать дальше, — как кофемашина, на которой подсвечены только доступные напитки.', tech: 'Hypermedia As The Engine Of Application State: в ответе ссылки на разрешённые действия (_links), клиент рисует кнопки по ним, а не вычисляет правила сам. Ступень 3 модели Ричардсона.' },
      { term: 'Ссылка _links', simple: 'Указатель «выход здесь» в торговом центре: не нужно помнить план этажа, идёте по стрелке.', tech: 'Объект rel → {href, method, title}. rel — имя действия (book, cancel, next), его знает клиент; адрес и условия знает сервер.' },
      { term: 'Модель зрелости Ричардсона', simple: 'Лестница: от «один телефон ресепшена на всё» до «администратор сам предлагает следующий шаг».', tech: '0 — один адрес (RPC), 1 — ресурсы, 2 — HTTP-методы и коды, 3 — гипермедиа.' },
      { term: 'Пагинация', simple: 'Длинный список отдают порциями, как меню по страницам.', tech: 'Способы: offset (LIMIT/OFFSET) и курсор (keyset). Для растущих списков — курсор.' },
      { term: 'Курсор', simple: 'Закладка в книге: открываете там, где остановились, даже если в начало вклеили новые страницы.', tech: 'Непрозрачная строка с ключом последней выданной записи, например (entered_at, id). Запрос: WHERE (entered_at, id) < ($2, $3). Клиент берёт её из _links.next.' },
      { term: 'Cache-Control', simple: 'Надпись на листке с расписанием: «годен 30 секунд, можно вешать на общий стенд» или «лично в руки».', tech: 'public — можно хранить в общем кэше (CDN), private — только в браузере владельца, no-store — нигде, max-age — сколько секунд копия свежая.' },
      { term: '304 Not Modified', simple: '«У вас свежая редакция, перепечатывать не надо».', tech: 'Ответ на условный GET с If-None-Match, когда ETag не изменился. Без тела — экономия трафика и работы сервера.' },
      { term: 'CDN', simple: 'Сеть стендов с копиями расписания по всему городу: люди читают копию рядом, а не едут в главный офис.', tech: 'Сеть общих кэширующих серверов перед вашим API. Кэширует только то, что разрешил Cache-Control: public.' },
      { term: '202 Accepted', simple: 'Химчистка: вещь приняли, выдали квитанцию — забирайте, когда будет готово.', tech: 'Запрос принят, но ещё не выполнен. В заголовке Location — адрес статуса; клиент опрашивает его GET-ом, по готовности получает ссылку на результат.' }
    ],
    outro: 'Сегодня сервер научился разговаривать с приложением: не только отдавать данные, но и подсказывать, что можно сделать, — и Ольга меняет правило отмены без релиза. Курсоры спасли сверку с ФитПассом от дублей и пропусков, кэш разгрузил сайт, а чужой профиль больше не утечёт через CDN. Завтра утром — версии API, ретраи с паузами и вебхуки.',
    tasks: [richTask, hateoasTask, whyTask, pageTask, cacheTask]
  });
})();
