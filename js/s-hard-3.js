/* Неделя 3, четверг 10:00 — «Версии, ретраи, вебхуки».
   Узкие места интеграций вживую: что ломает клиентов, таймауты и повторы к SMS-шлюзу,
   лимит частоты для ФитПасса (429), вебхуки ПэйПоинта со всеми их сюрпризами, наш вебхук партнёру.
   Брокеров нет: асинхронность — вебхуки, опрос, таблица-очередь в своей БД. */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc;
  const ID = 'hard-3';

  if (typeof document !== 'undefined' && !document.getElementById('h3-style')) {
    document.head.insertAdjacentHTML('beforeend', `<style id="h3-style">
      .h3-set{display:grid;grid-template-columns:minmax(120px,190px) minmax(0,1fr);gap:8px 12px;align-items:center}
      .h3-set .lbl{font-size:13px;color:var(--text-2);min-width:0}
      .h3-set .lbl small{display:block;color:var(--text-muted);font-size:11.5px}
      .h3-bars{position:relative;display:flex;align-items:flex-end;gap:1px;height:86px;padding:4px 4px 0;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;overflow:hidden;min-width:0}
      .h3-bars i{flex:1 1 0;min-width:0;display:block;background:var(--info);border-radius:1px 1px 0 0}
      .h3-bars i.bad{background:var(--bad)} .h3-bars i.warn{background:var(--warn)} .h3-bars i.ok{background:var(--ok)} .h3-bars i.off{opacity:.12}
      .h3-bars .cap{position:absolute;left:0;right:0;border-top:1.5px dashed var(--bad);pointer-events:none}
      .h3-bars .cap span{position:absolute;right:4px;top:-15px;font:600 10.5px/1 var(--f-mono);color:var(--bad);background:var(--surface-2);padding:1px 3px;border-radius:3px}
      .h3-phase{display:flex;font:600 10.5px/1.2 var(--f-mono);margin-top:3px;min-width:0}
      .h3-phase span{padding:3px 4px;border-radius:4px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;min-width:0;border:1px solid var(--border)}
      .h3-phase .ok{background:var(--ok-soft);color:var(--ok)} .h3-phase .warn{background:var(--warn-soft);color:var(--warn)} .h3-phase .bad{background:var(--bad-soft);color:var(--bad)} .h3-phase .info{background:var(--info-soft);color:var(--info)}
      .h3-chart-h{display:flex;justify-content:space-between;gap:8px;font-size:12.5px;color:var(--text-2);margin-bottom:4px;flex-wrap:wrap}
      .h3-ev{cursor:pointer;text-align:left;font:inherit;color:inherit}
      .h3-ev .ln{font-size:12.5px;color:var(--text-2)}
      .h3-ev.sel{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent) inset}
      .h3-ev.ok{border-left:4px solid var(--ok)} .h3-ev.bad{border-left:4px solid var(--bad)} .h3-ev.warn{border-left:4px solid var(--warn)}
      .h3-def{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px}
      .h3-def label{align-items:flex-start;background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:8px 10px;min-width:0}
      .h3-def label small{display:block;color:var(--text-muted);font-size:12px}
      .h3-sc{min-width:0;max-width:100%;overflow-x:auto}
      .h3-phone{border:1px solid var(--border-strong);border-radius:14px;padding:12px;background:var(--surface);max-width:280px}
      @media (max-width:560px){.h3-set{grid-template-columns:minmax(0,1fr)}}
    </style>`);
  }

  // ---------- мелкие помощники ----------
  const setRow = (label, sub, name, opts, cur) => `<div class="lbl">${label}${sub ? `<small>${sub}</small>` : ''}</div><div style="min-width:0">${ui.seg(name, opts, cur)}</div>`;
  const stat = (k, v, kind, s) => `<div class="stat"><div class="k">${k}</div><div class="v ${kind || ''}">${v}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`;
  const pct = x => Math.round(x * 100) + ' %';
  function bars(arr, o) {
    const max = o.max || Math.max(1, ...arr);
    const cap = o.cap != null ? `<div class="cap" style="bottom:${Math.min(96, o.cap / max * 100)}%"><span>${esc(o.capLabel || String(o.cap))}</span></div>` : '';
    return `<div class="h3-bars" role="img" aria-label="${esc(o.title || 'диаграмма')}">${arr.map((v, i) => `<i class="${o.cls ? o.cls(v, i) : ''} ${o.shown != null && i >= o.shown ? 'off' : ''}" style="height:${Math.max(v > 0 ? 2 : 0, Math.min(100, v / max * 100))}%" title="${i} с: ${v}"></i>`).join('')}${cap}</div>`;
  }
  const qScore = (q, v) => ui.quizScore(q, v || []);

  // =====================================================================
  // Подход 1. Ломает или нет
  // =====================================================================
  const BRK = [
    { id: 'optresp', t: 'В ответ расписания добавили необязательное поле <code>freeSpots</code>', ok: 'safe', alt: 'depends', hint: 'клиент, который просто не читает незнакомое поле, ничего не заметит. Ломается только тот, кто падает на любом неизвестном поле.' },
    { id: 'rename', t: 'Переименовали <code>startsAt</code> → <code>startTime</code>', ok: 'break', hint: 'старое приложение ищет поле по старому имени. Что оно найдёт после релиза?' },
    { id: 'reqfield', t: 'В <code>POST /bookings</code> появилось новое обязательное поле <code>deviceId</code>', ok: 'break', hint: 'старые версии приложения не знают про это поле и не пришлют его. Что ответит сервер?' },
    { id: 'enum', t: 'У записи новый статус <code>"transferred"</code> (перенесена)', ok: 'depends', hint: 'одно приложение покажет «неизвестный статус», другое упадёт на строгом switch. От чего это зависит?' },
    { id: 'type', t: '<code>capacity</code> было числом <code>20</code>, стало строкой <code>"20"</code>', ok: 'break', hint: 'типизированный клиент (Kotlin, Swift) ждёт число. Что случится при разборе JSON?' },
    { id: 'remove', t: 'Убрали из ответа поле <code>trainer.phone</code>', ok: 'break', hint: 'кто-то мог показывать это поле на экране. Удаление — всегда риск, даже если «вроде никто не пользуется».' },
    { id: 'newep', t: 'Новый эндпоинт <code>GET /clubs/{id}/occupancy</code>', ok: 'safe', hint: 'старые клиенты про него не знают и не вызывают.' },
    { id: 'strict', t: 'Ужесточили проверку: комментарий к записи теперь не длиннее 50 символов (было 100)', ok: 'break', alt: 'depends', hint: 'запрос, который вчера проходил, сегодня получает 400. Для того, кто пишет длинные комментарии, — это поломка.' },
    { id: 'code', t: 'Для «мест нет» вместо <code>409</code> теперь отвечаем <code>422</code>', ok: 'break', hint: 'приложение по коду 409 показывает кнопку «встать в лист ожидания». Что оно покажет на 422?' },
    { id: 'optq', t: 'Новый необязательный параметр <code>?level=beginner</code> в расписании', ok: 'safe', hint: 'без параметра ответ такой же, как раньше.' },
    { id: 'order', t: 'Поля в JSON-ответе теперь идут в другом порядке', ok: 'safe', hint: 'по стандарту порядок полей в JSON-объекте ничего не значит.' },
    { id: 'limit', t: 'Размер страницы по умолчанию поменяли: <code>limit</code> 20 → 50', ok: 'depends', hint: 'кто передаёт limit явно — не заметит. Кто рассчитывал на 20 по умолчанию — получит другой ответ.' }
  ];
  const BRK_B = [
    { id: 'safe', t: 'Не ломает', sub: 'старые клиенты работают как раньше' },
    { id: 'break', t: 'Ломает', sub: 'старое приложение или партнёр сломаются' },
    { id: 'depends', t: 'Зависит от клиента', sub: 'смотря как написан клиент' }
  ];
  const Q_EXP = {
    q: 'Переименовать <code>startsAt</code> → <code>startTime</code> всё-таки нужно. Старые версии приложения живут у клиентов месяцами. Как выкатить?',
    options: [
      { t: 'Переименовать сразу и разослать пуш «Обновите приложение»', why: 'Обновятся не все: старые версии живут месяцами. У остальных расписание сломается в момент релиза.' },
      { t: 'Расширить и сузить: сначала добавить <code>startTime</code> рядом со <code>startsAt</code>, перевести новые версии на новое поле, старое убрать, когда старых версий почти не останется', ok: 1, why: 'Это expand–contract. Ни в какой момент никто не ломается. Когда убирать старое поле, решаем по метрике: доля запросов от старых версий приложения.' },
      { t: 'Выпустить <code>/v2</code> ради одного поля', why: 'Сработает, но дорого: две версии API придётся поддерживать и тестировать месяцами. Новая версия оправдана, когда ломающих изменений много.' },
      { t: 'Старым версиям отвечать 426 и показывать экран «Обновитесь»', why: 'Крайняя мера для дыр безопасности. Ради переименования поля так терять клиентов нельзя.' }
    ]
  };
  const Q_SUN = {
    q: 'ФитПассу нужно ломающее изменение в <code>/partner/v1</code>. Какие шаги верные? Выберите все.',
    multi: true,
    options: [
      { t: 'Выпустить <code>/partner/v2</code> рядом, <code>v1</code> продолжает работать как раньше', ok: 1, why: 'Версия в пути — понятный контракт для партнёра: v1 не меняется, пока не снята.' },
      { t: 'В ответах <code>v1</code> отдавать заголовки <code>Deprecation</code> и <code>Sunset</code> с датой отключения и ссылку на v2', ok: 1, why: '<code>Deprecation</code> (RFC 9745) — «версия устарела», <code>Sunset</code> (RFC 8594) — «отключим тогда-то». Их видят и логи, и мониторинг партнёра.' },
      { t: 'Написать Кириллу минимум за 6 месяцев до отключения', ok: 1, why: 'У партнёра свой план релизов. Шесть месяцев — договорённость из контракта Partner API.' },
      { t: 'После даты Sunset <code>v1</code> отвечает <code>410 Gone</code> со ссылкой на v2', ok: 1, why: '410 честно говорит «этого больше нет навсегда», в отличие от 404 или 500.' },
      { t: 'Тихо поменять <code>v1</code> ночью — ФитПасс заметит по ошибкам и поправит', why: 'Ошибки увидят клиенты ФитПасса в воскресенье вечером. А ретраи ФитПасса на любую ошибку устроят нам шторм.' },
      { t: 'Поменять поведение <code>v1</code>, но описать это в списке изменений на сайте', why: 'Список изменений никто не читает в момент релиза. Контракт v1 ломать нельзя.' }
    ]
  };
  const brkMark = ans => {
    const m = (ans && ans.m) || {}, r = {};
    BRK.forEach(it => { const v = m[it.id]; if (!v) return; r[it.id] = v === it.ok ? 'ok' : v === it.alt ? 'warn' : 'bad'; });
    return r;
  };

  const taskBreaking = {
    id: 'breaking', title: 'Ломает или нет',
    simple: {
      icon: '🧩',
      plain: 'API — это обещание. Изменение «ломающее», если клиент, который вчера работал, сегодня перестанет работать — хотя он ничего не менял.',
      analogy: 'Клуб перенёс раздевалку на второй этаж. Новички найдут по табличкам, а постоянные клиенты по привычке пойдут на первый и упрутся в стену. Добавить вторую раздевалку — никому не мешает. Убрать старую — мешает всем, кто привык.',
      tech: 'Обратно совместимые изменения: новое необязательное поле в ответе, новый эндпоинт, новый необязательный параметр. Ломающие: переименование, удаление, смена типа, новое обязательное поле в запросе, новый код ответа, ужесточение проверок. Новое значение enum ломает «строгих» клиентов. Клиент должен игнорировать незнакомые поля (принцип tolerant reader).'
    },
    lead: ui.brief({
      situation: `Денис принёс 12 правок к новому релизу API. Беда в том, что обновляются не все. У многих клиентов стоит старое приложение 2.3 — его не обновляли полгода. ФитПасс обновляет свою программу раз в квартал. Если правка «ломающая», в день релиза у этих людей перестанет открываться расписание. Хотя они сами ничего не трогали.`,
      todo: [
        `Разложите 12 карточек по корзинам: «Не ломает», «Ломает», «Зависит от клиента». Нажмите карточку, потом корзину. Или перетащите.`,
        `В блоке «Посмотрите вживую» переключайте «Что отдаёт сервер» и «Кто спрашивает». Смотрите, что показывает телефон.`,
        `Ответьте на два вопроса ниже. Во втором можно выбрать несколько ответов.`,
        `Засчитывается, если верно разложено не меньше 80 % карточек и оба вопроса решены.`
      ],
      lookTitle: 'Как читать пример',
      look: `Для каждой карточки спросите себя: «Старое приложение работало вчера. Сработает ли оно сегодня?». В примере слева — что прислал сервер, справа — экран телефона. Зелёное «работает» — приложение нашло нужное поле. Красное «Invalid Date» — поля, которое оно ищет, в ответе больше нет. Заголовки <code>Deprecation</code> и <code>Sunset</code> над вторым вопросом — это записка в самом ответе: «версия устарела, отключим тогда-то».`
    }),
    blank: () => ({ m: {}, q1: [], q2: [] }),
    reference: () => ({ m: Object.fromEntries(BRK.map(i => [i.id, i.ok])), q1: [1], q2: [0, 1, 2, 3] }),
    render(el, ctx) {
      const a = ctx.ans; a.m = a.m || {};
      const sortEl = document.createElement('div'); el.appendChild(sortEl);
      ui.sort(sortEl, { items: BRK.map(i => ({ id: i.id, t: '<span style="min-width:0;overflow-wrap:anywhere">' + i.t + '</span>' })), buckets: BRK_B, value: a.m, readonly: ctx.readonly, seed: 'h3-brk', reveal: ctx.result ? brkMark(a) : null, onChange: m => { ctx.ans.m = m; ctx.save(); } });

      // живой пример: старое приложение против нового ответа
      const demo = document.createElement('div'); demo.className = 'card flat'; demo.style.marginTop = '14px'; el.appendChild(demo);
      let srv = 'rename', app = 'old';
      const drawDemo = () => {
        const body = srv === 'old' ? { id: 'b1f…', title: 'Йога для начинающих', startsAt: '2026-10-05T09:00:00+03:00' }
          : srv === 'rename' ? { id: 'b1f…', title: 'Йога для начинающих', startTime: '2026-10-05T09:00:00+03:00' }
            : { id: 'b1f…', title: 'Йога для начинающих', startsAt: '2026-10-05T09:00:00+03:00', startTime: '2026-10-05T09:00:00+03:00' };
        const field = app === 'old' ? body.startsAt : (body.startTime || body.startsAt);
        const okShow = !!field;
        const phone = okShow
          ? `<div class="h3-phone"><div class="eyebrow">Приложение ${app === 'old' ? '2.3' : '3.0'}</div><b>Йога для начинающих</b><div class="mono">пн 5 октября · 09:00</div>${ui.status('работает', 'ok')}</div>`
          : `<div class="h3-phone"><div class="eyebrow">Приложение ${app === 'old' ? '2.3' : '3.0'}</div><b>Йога для начинающих</b><div class="mono" style="color:var(--bad)">Invalid Date</div>${ui.status('расписание сломано', 'bad')}<div class="small dim">Поля <code>startsAt</code> в ответе нет — приложение получило undefined.</div></div>`;
        demo.innerHTML = `<div class="eyebrow">Посмотрите вживую: переименование поля</div>
          <div class="h3-set">${setRow('Что отдаёт сервер', '', 'srv', [{ v: 'old', t: 'как раньше' }, { v: 'rename', t: 'переименовали' }, { v: 'expand', t: 'оба поля' }], srv)}
          ${setRow('Кто спрашивает', '', 'app', [{ v: 'old', t: 'старое приложение 2.3' }, { v: 'new', t: 'новое 3.0' }], app)}</div>
          <div class="grid2" style="align-items:start"><div class="h3-sc">${ui.http({ status: 200, body })}</div>${phone}</div>
          <div class="small dim">${srv === 'expand' ? 'Оба поля сразу — первый шаг expand–contract: старые читают старое, новые — новое.' : srv === 'rename' ? 'Новое приложение справится, а у всех, кто не обновился, расписание сломается в момент релиза.' : 'Пока ничего не меняли — все работают.'}</div>`;
      };
      ui.onSeg(demo, (n, v) => { if (n === 'srv') srv = v; else app = v; drawDemo(); });
      drawDemo();

      const q1 = document.createElement('div'); q1.style.marginTop = '14px'; el.appendChild(q1);
      ui.quiz(q1, Object.assign({}, Q_EXP, { value: a.q1 || [], readonly: ctx.readonly, reveal: ctx.result, seed: 'h3-q1', onChange: v => { ctx.ans.q1 = v; ctx.save(); ctx.decide('Как переименовать поле', (Q_EXP.options[v[0]] || {}).t || ''); } }));
      const vh = document.createElement('div'); vh.className = 'h3-sc'; vh.style.marginTop = '10px'; el.appendChild(vh);
      vh.innerHTML = ui.http({ status: 200, cap: 'так выглядит ответ устаревшей версии', headers: [['Deprecation', '@1790812800'], ['Sunset', 'Thu, 01 Apr 2027 00:00:00 GMT'], ['Link', '<https://api.puls.fit/partner/v2/clubs>; rel="successor-version"']], body: '' });
      const q2 = document.createElement('div'); q2.style.marginTop = '10px'; el.appendChild(q2);
      ui.quiz(q2, Object.assign({}, Q_SUN, { value: a.q2 || [], readonly: ctx.readonly, reveal: ctx.result, seed: 'h3-q2', onChange: v => { ctx.ans.q2 = v; ctx.save(); } }));
    },
    check(ans) {
      const m = (ans && ans.m) || {};
      let s = 0; const notes = []; let wrong = 0;
      BRK.forEach(it => {
        const v = m[it.id];
        if (v === it.ok) s += 1;
        else if (v && v === it.alt) { s += .5; if (notes.length < 6) notes.push({ ok: 'warn', html: `${it.t}: спорно. ${it.hint}` }); }
        else { wrong++; if (notes.length < 6) notes.push({ ok: false, html: `${it.t}: ${v ? 'подумайте ещё' : 'не разложено'} — ${it.hint}` }); }
      });
      const sortS = s / BRK.length;
      const q1 = qScore(Q_EXP, ans.q1), q2 = qScore(Q_SUN, ans.q2);
      if (!q1.ok) notes.push({ ok: false, html: 'Переименование: ищите способ, при котором в любой день релиза работают и старые, и новые версии приложения.' });
      if (!(q2.score >= .75)) notes.push({ ok: false, html: 'Снятие версии для партнёра: нужен и параллельный запуск, и предупреждение в самих ответах API, и срок, и понятный ответ после отключения.' });
      const score = .6 * sortS + .2 * q1.score + .2 * q2.score;
      return {
        ok: sortS >= .8 && q1.ok && q2.score >= .75, score,
        summary: `Корзины: ${Math.round(sortS * 100)} % · переименование: ${q1.ok ? 'верно' : 'нет'} · снятие версии: ${Math.round(q2.score * 100)} %.`,
        notes: notes.length ? notes : [{ ok: true, html: 'Все изменения разложены верно.' }]
      };
    },
    explain: `<p><b>Главное правило:</b> добавлять можно, менять и удалять — нельзя. Новое необязательное поле, новый эндпоинт, новый необязательный параметр не ломают никого, если клиент игнорирует незнакомые поля. Об этом надо договориться с Денисом заранее: «незнакомое поле — пропусти, незнакомый статус — покажи как „другое“».</p>
      <p><b>Коварные случаи.</b> Новое значение enum и новый размер страницы по умолчанию «ломают» только часть клиентов — поэтому в контракте сразу пишут: «список статусов может расширяться». Смена 409 → 422 выглядит невинно, но приложение ветвится по коду: на 409 показывает «встать в лист ожидания».</p>
      <p><b>Как менять, не ломая:</b> expand–contract. Добавили новое рядом со старым → новые версии перешли → дождались, пока старых почти нет (смотрим по заголовку версии приложения) → убрали старое. У «Пульса» именно на этом погорели в прошлом: переименовали <code>startsAt</code> без переходного периода, и старые приложения упали.</p>
      <p><b>Партнёрам</b> — версия в пути (<code>/partner/v1</code>), снятие через заголовки <code>Deprecation</code> (RFC 9745) и <code>Sunset</code> (RFC 8594), анонс за 6 месяцев, после — <code>410 Gone</code>.</p>`,
    report(ans) {
      const m = ans.m || {};
      const lines = BRK.map(i => `- ${i.t.replace(/<[^>]+>/g, '')} → ${(BRK_B.find(b => b.id === m[i.id]) || { t: '—' }).t}${m[i.id] && m[i.id] !== i.ok ? ' ✗' : ''}`);
      lines.push(`- Переименование: ${((Q_EXP.options[(ans.q1 || [])[0]] || {}).t || '—').replace(/<[^>]+>/g, '')}`);
      lines.push(`- Снятие версии: ${(ans.q2 || []).map(i => (Q_SUN.options[i] || {}).t || '').map(s => s.replace(/<[^>]+>/g, '')).join('; ') || '—'}`);
      return lines.join('\n');
    }
  };

  // =====================================================================
  // Подход 2. Таймауты и повторы (SMS-шлюз)
  // =====================================================================
  const SMS = { T: 150, P: 60, CAP: 30, D: 10, ARR_END: 90, SLOW: 20, DOWN: 35, UP: 70 };
  const smsPhase = t => t < SMS.SLOW ? 'ok' : t < SMS.DOWN ? 'slow' : t < SMS.UP ? 'down' : 'up';
  // Чистая детерминированная модель: каждую секунду 10 новых SMS (коды входа) первые 90 секунд.
  // Шлюз: 0–19 с норма (ответ за 1 с), 20–34 тормозит (6 с), 35–69 лежит (не отвечает), с 70 поднялся, держит 30 запросов/с.
  function simSms(c) {
    const T = SMS.T, R = TR.rand('h3-sms');
    const tmo = c.timeout === 'none' ? Infinity : +c.timeout;
    const maxTry = c.retries === 'inf' ? Infinity : +c.retries + 1;
    const N = T + 70;
    const due = Array.from({ length: N }, () => []), ev = Array.from({ length: N }, () => []), rel = new Array(N).fill(0);
    const jobs = [], sent = new Array(T).fill(0), busyA = new Array(T).fill(0);
    let busy = 0, delivered = 0, lost = 0, starved = 0, dup = 0, r429 = 0, fullSec = 0, attempts = 0, firstFull = -1;
    let br = 'closed', openUntil = 0, probes = 0, opened = 0;
    const win = [];
    const delay = n => c.backoff === 'none' ? 1 : c.backoff === 'exp' ? Math.min(2 ** (n - 1), 60) : 1 + Math.floor(R() * Math.min(2 ** n, 60));
    const fail = (j, t) => { if (j.tries < maxTry) { const s = t + delay(j.tries); if (s < T) due[s].push(j.id); } else { lost++; j.lost = true; } };
    for (let t = 0; t < T; t++) {
      busy -= rel[t];
      for (const e of ev[t]) {
        const j = jobs[e.id];
        if (c.breaker === 'on' && !e.rl) {
          win.push({ t, ok: e.ok });
          if (br === 'half') { if (e.ok) { br = 'closed'; win.length = 0; } else { br = 'open'; openUntil = t + 10; } }
        }
        if (e.ok) { j.done = true; delivered++; if (j.maybe) dup++; } else fail(j, t);
      }
      if (c.breaker === 'on') {
        while (win.length && win[0].t < t - 5) win.shift();
        const f = win.filter(x => !x.ok).length;
        if (br === 'closed' && f >= 8 && f / win.length >= .5) { br = 'open'; openUntil = t + 10; opened++; }
        if (br === 'open' && t >= openUntil) { br = 'half'; probes = 0; }
      }
      if (t < SMS.ARR_END) for (let k = 0; k < SMS.D; k++) { const id = jobs.length; jobs.push({ id, tries: 0 }); due[t].push(id); }
      const ph = smsPhase(t);
      for (const id of due[t]) {
        const j = jobs[id];
        if (c.breaker === 'on' && (br === 'open' || (br === 'half' && probes >= 3))) { j.tries++; attempts++; fail(j, t); continue; }
        if (c.throttle === 'on' && sent[t] >= SMS.CAP) { due[t + 1].push(id); continue; }
        if (busy >= SMS.P) { starved++; j.tries++; attempts++; fail(j, t); continue; }
        if (br === 'half') probes++;
        j.tries++; attempts++; busy++; sent[t]++;
        let ok, at;
        if (ph === 'ok') { ok = true; at = 1; }
        else if (ph === 'up') { if (sent[t] > SMS.CAP) { ok = false; at = 1; r429++; } else { ok = true; at = 1; } }
        else if (ph === 'slow') { if (tmo >= 6) { ok = true; at = 6; } else { ok = false; at = tmo; j.maybe = true; } }
        else { if (tmo === Infinity) { j.hung = true; continue; } ok = false; at = tmo; }
        rel[t + at]++; ev[t + at].push({ id, ok, rl: ph === 'up' && !ok });
      }
      busyA[t] = busy;
      if (busy >= SMS.P) { fullSec++; if (firstFull < 0) firstFull = t; }
    }
    const total = jobs.length;
    return { total, delivered, lost, starved, dup, r429, fullSec, firstFull, attempts, opened, hung: jobs.filter(j => j.hung && !j.done).length, peakUp: Math.max(...sent.slice(SMS.UP)), maxBusy: Math.max(...busyA), sent, busyA };
  }
  const SMS_REF = { timeout: '3', retries: 'inf', backoff: 'jitter', breaker: 'on', throttle: 'on' };
  const SMS_BLANK = { timeout: 'none', retries: '0', backoff: 'none', breaker: 'off', throttle: 'off' };
  const smsVerdict = (c, r) => ({
    pool: r.fullSec === 0,
    dlv: r.delivered >= .95 * r.total,
    storm: r.r429 <= 20,
    pause: c.backoff !== 'none'
  });
  const Q_TMO = {
    q: 'Шлюз не ответил за 3 секунды, сработал таймаут. Отправлено ли SMS клиенту?',
    options: [
      { t: 'Нет — раз ошибка, значит не отправлено', why: 'Таймаут значит «мы не дождались ответа», а не «шлюз ничего не сделал». Шлюз мог отправить SMS и просто не успеть ответить.' },
      { t: 'Неизвестно: шлюз мог отправить и не успеть ответить. Для кода входа дубль SMS терпим, для оплаты повтор допустим только с ключом идемпотентности', ok: 1, why: 'Именно. Поэтому в счётчике «возможные дубли» не ноль. Для SMS-кода это мелочь, а для ПэйПоинта повтор без Idempotence-Key — двойное списание.' },
      { t: 'Да — шлюз всегда отправляет, просто медленно', why: 'Не всегда: если шлюз лежит, он ничего не отправит. Мы просто не знаем.' }
    ]
  };
  const SMS_OPTS = [
    ['timeout', 'Таймаут ответа', 'сколько ждём шлюз', [{ v: 'none', t: 'нет' }, { v: '30', t: '30 с' }, { v: '3', t: '3 с' }]],
    ['retries', 'Повторы', 'если не получилось', [{ v: '0', t: '0' }, { v: '3', t: '3' }, { v: 'inf', t: 'до успеха (код живёт 5 мин)' }]],
    ['backoff', 'Пауза между повторами', '', [{ v: 'none', t: 'нет' }, { v: 'exp', t: '1-2-4-8… с' }, { v: 'jitter', t: '1-2-4-8… + случайный разброс' }]],
    ['breaker', 'Предохранитель', 'circuit breaker', [{ v: 'off', t: 'выкл' }, { v: 'on', t: 'вкл' }]],
    ['throttle', 'Темп отправки', 'отправщик из таблицы-очереди', [{ v: 'off', t: 'как получится' }, { v: 'on', t: 'не больше 30 в секунду' }]]
  ];
  const smsLabel = c => SMS_OPTS.map(([k, n, , o]) => `${n}: ${(o.find(x => x.v === c[k]) || {}).t || '—'}`).join('; ');

  const taskRetries = {
    id: 'retries', title: 'Таймауты и повторы',
    simple: {
      icon: '⏱️',
      plain: 'Если внешний сервис тормозит или лежит, главное — не повиснуть вместе с ним и не добить его повторами, когда он встаёт.',
      analogy: 'Вы звоните в доставку воды. Таймаут — сколько гудков ждёте, прежде чем положить трубку. Повтор — перезвонить. Пауза — перезванивать не сразу, а через минуту, потом через две. Разброс (jitter) — чтобы сто человек не перезвонили в одну и ту же секунду. Предохранитель — после пяти неудачных звонков подряд не звоните полчаса: там явно авария. А темп — не больше одного звонка в минуту, даже если очередь большая.',
      tech: 'Таймаут ограничивает время, на которое занят поток. Повторы с экспоненциальной паузой и jitter (случайный разброс) не дают повторам синхронизироваться в «шторм». Circuit breaker после серии ошибок временно перестаёт обращаться к сервису (open), потом пробует понемногу (half-open). Отправка SMS идёт через таблицу-очередь в своей БД, отправщик держит темп в пределах лимита шлюза — 30 запросов/с.'
    },
    lead: ui.brief({
      situation: `Утро. Клиенты входят в приложение по коду из SMS. Полторы минуты подряд приходит по 10 просьб «Пришлите код» в секунду. Коды рассылает чужой SMS-шлюз — как почта для SMS. Он успевает 30 штук в секунду. Сегодня ему плохо: 15 секунд он тормозит, потом 35 секунд молчит, потом оживает.<br>У нашего сервиса 60 «рук» (потоков). Пока рука ждёт ответа шлюза, она занята. Эти же руки обслуживают вход в приложение. Если все 60 держат трубку с молчащим шлюзом — Анна жмёт «Получить код» и видит вечную крутилку.`,
      todo: [
        `Выставьте пять переключателей. <b>Таймаут</b> — сколько секунд ждём шлюз, прежде чем бросить трубку. <b>Повторы</b> — сколько раз пробуем снова. <b>Пауза</b> «1-2-4-8» — первый повтор через 1 с, второй через 2, третий через 4. «Разброс» — к паузе добавляется случайная доля секунды. <b>Предохранитель</b> — после серии неудач 10 секунд вообще не звоним в шлюз. <b>Темп отправки</b> — сколько SMS в секунду берём из очереди.`,
        `Нажмите «▶ Проиграть 2,5 минуты», чтобы увидеть аварию по секундам. Числа внизу меняются сразу при любом переключении.`,
        `Ответьте на вопрос про таймаут под графиками.`,
        `Засчитывается, когда вход ни разу не висел, дошло не меньше 95 % кодов, отказов 429 не больше 20, между повторами есть пауза и вопрос решён.`
      ],
      lookTitle: 'Как читать симуляцию',
      look: `Один столбик — одна секунда, всего 150. Цветная полоса под верхним графиком — что в эту секунду со шлюзом: норма, тормозит, лежит, поднялся.<br><b>Верхний график</b> — сколько SMS мы отправили в шлюз. Красный пунктир — его предел, 30 в секунду. Всё, что выше, шлюз отобьёт отказом 429 («слишком много»).<br><b>Нижний график</b> — сколько из 60 рук занято. Красный столбик — свободных рук нет, вход в приложение висит.<br>Плитки внизу — итог: сколько кодов дошло, сколько секунд висел вход, сколько было отказов и попыток.`
    }),
    blank: () => ({ cfg: Object.assign({}, SMS_BLANK), q: [] }),
    reference: () => ({ cfg: Object.assign({}, SMS_REF), q: [1] }),
    render(el, ctx) {
      const a = ctx.ans; a.cfg = Object.assign({}, SMS_BLANK, a.cfg || {});
      const wrap = document.createElement('div'); wrap.className = 'stack'; el.appendChild(wrap);
      let shown = SMS.T, timer = null;
      const draw = () => {
        const c = a.cfg, r = simSms(c), v = smsVerdict(c, r);
        wrap.innerHTML = `
          <div class="card flat"><div class="h3-set">${SMS_OPTS.map(([k, n, s, o]) => setRow(n, s, k, o, c[k])).join('')}</div>
            ${ctx.readonly ? '' : `<div class="row"><button type="button" class="btn sm primary" data-play>▶ Проиграть 2,5 минуты</button><span class="small dim">Переключили настройку — числа ниже пересчитаны сразу. Кнопка показывает по секундам, как это было.</span></div>`}</div>
          <div>
            <div class="h3-chart-h"><span><b>Запросов в шлюз за секунду</b></span><span class="tnum" data-tsec>${shown >= SMS.T ? '' : shown + ' с'}</span></div>
            ${bars(r.sent, { max: 70, cap: 30, capLabel: 'лимит шлюза 30', shown, title: 'запросов в шлюз по секундам', cls: (x, i) => x > SMS.CAP ? 'bad' : smsPhase(i) === 'down' && x ? 'warn' : '' })}
            <div class="h3-phase"><span class="ok" style="width:${SMS.SLOW / SMS.T * 100}%">норма</span><span class="warn" style="width:${(SMS.DOWN - SMS.SLOW) / SMS.T * 100}%">тормозит</span><span class="bad" style="width:${(SMS.UP - SMS.DOWN) / SMS.T * 100}%">лежит</span><span class="info" style="width:${(SMS.T - SMS.UP) / SMS.T * 100}%">поднялся</span></div>
          </div>
          <div>
            <div class="h3-chart-h"><span><b>Занято потоков</b> (из ${SMS.P}; на красном вход в приложение висит)</span></div>
            ${bars(r.busyA, { max: SMS.P, shown, title: 'занятые потоки по секундам', cls: x => x >= SMS.P ? 'bad' : x >= SMS.P * .7 ? 'warn' : 'ok' })}
          </div>
          <div class="grid3">
            ${stat('Доставлено SMS', `${r.delivered} / ${r.total}`, v.dlv ? 'ok' : 'bad', r.lost ? `брошено после повторов: ${r.lost}` : r.hung ? `висят без ответа: ${r.hung}` : 'никто не потерян')}
            ${stat('Вход висел', `${r.fullSec} с`, v.pool ? 'ok' : 'bad', v.pool ? 'потоки ни разу не кончились' : `потоки кончились на ${r.firstFull}-й секунде`)}
            ${stat('Шторм: отказов 429', String(r.r429), v.storm ? 'ok' : 'bad', `пик после подъёма: ${r.peakUp} запросов/с`)}
            ${stat('Попыток всего', String(r.attempts), v.pause ? '' : 'warn', v.pause ? 'с паузами' : 'без пауз — отправщик молотит очередь')}
            ${stat('Предохранитель', c.breaker === 'on' ? `срабатывал ${r.opened} раз` : 'выключен', '', c.breaker === 'on' ? 'пока открыт — шлюз не трогаем' : '')}
            ${stat('Возможные дубли', String(r.dup), r.dup ? 'warn' : '', 'таймаут, а шлюз успел отправить')}
          </div>
          ${v.pool && v.dlv && v.storm && v.pause ? ui.note('ok', 'Устойчиво', 'Вход не висел, все коды дошли, поднявшийся шлюз не завалили повторами.') : ''}
          <div data-q></div>`;
        ui.quiz(TR.$('[data-q]', wrap), Object.assign({}, Q_TMO, { value: a.q || [], readonly: ctx.readonly, reveal: ctx.result, seed: 'h3-tmo', onChange: q => { ctx.ans.q = q; ctx.save(); } }));
      };
      ui.onSeg(wrap, (n, v) => {
        if (ctx.readonly) return;
        clearInterval(timer); shown = SMS.T;
        ctx.ans.cfg = Object.assign({}, ctx.ans.cfg, { [n]: v }); ctx.save();
        ctx.decide('Настройки отправки SMS', smsLabel(ctx.ans.cfg));
        draw();
      });
      TR.on(wrap, 'click', '[data-play]', () => {
        clearInterval(timer); shown = 0; draw();
        timer = setInterval(() => { shown = Math.min(SMS.T, shown + 3); if (shown >= SMS.T) clearInterval(timer); if (!wrap.isConnected) { clearInterval(timer); return; } draw(); }, 60);
      });
      draw();
    },
    check(ans) {
      const c = Object.assign({}, SMS_BLANK, (ans && ans.cfg) || {});
      const r = simSms(c), v = smsVerdict(c, r), q = qScore(Q_TMO, ans && ans.q);
      const notes = [];
      if (!v.pool) notes.push({ ok: false, html: `Потоки кончились на ${r.firstFull}-й секунде и были заняты ${r.fullSec} с — всё это время экран «Получить код» в приложении висел. Что держит поток так долго, пока шлюз молчит? И кто не даёт стучаться в лежащий шлюз?` });
      else notes.push({ ok: true, html: 'Потоки ни разу не кончились: вход в приложение работал.' });
      if (!v.dlv) notes.push({ ok: false, html: `Доставлено ${r.delivered} из ${r.total}. Шлюз лежал 35 секунд — ${r.lost ? `${r.lost} кодов отправщик бросил, потому что повторы кончились раньше, чем авария` : 'часть кодов так и не ушла'}. Сколько повторов нужно, если код живёт 5 минут, а SMS лежит в таблице-очереди?` });
      else notes.push({ ok: true, html: `Доставлено ${r.delivered} из ${r.total}.` });
      if (!v.storm) notes.push({ ok: false, html: `Шлюз вернул ${r.r429} отказов 429, пик — ${r.peakUp} запросов/с при лимите 30. Накопленные повторы обрушились на него разом. Что ограничит темп отправки?` });
      if (!v.pause) notes.push({ ok: false, html: `Повторы без паузы: ${r.attempts} попыток. Отправщик каждую секунду дёргает одни и те же задачи. Как растянуть повторы во времени?` });
      if (v.pause && c.backoff === 'exp') notes.push({ ok: 'info', html: 'Пауза без разброса: в модели с одним отправщиком этого хватает. Но у «Пульса» 4 копии сервиса: без jitter их повторы совпадают по времени и бьют волнами. Разброс дешёвый — добавьте.' });
      if (!q.ok) notes.push({ ok: false, html: 'Вопрос про таймаут: «не дождались ответа» и «не сделано» — это одно и то же?' });
      const parts = [v.pool, v.dlv, v.storm, v.pause, q.ok];
      const score = parts.filter(Boolean).length / parts.length;
      return { ok: parts.every(Boolean), score, summary: `Доставлено ${r.delivered}/${r.total} · вход висел ${r.fullSec} с · отказов 429: ${r.r429} · попыток: ${r.attempts}.`, notes };
    },
    explain: `<p><b>Таймаут — первая защита.</b> Без него поток ждёт мёртвый шлюз вечно; 60 потоков кончаются за 6 секунд, и падает уже не SMS, а вход в приложение. 30 секунд — то же самое, только медленнее. 3 секунды при нормальном ответе за 1 секунду — запас втрое.</p>
      <p><b>Повторы без паузы — шторм.</b> Шлюз встаёт, а на него разом сыплются все накопленные повторы, и он снова ложится. Пауза 1-2-4-8 секунд растягивает повторы, разброс (jitter) не даёт им совпадать по времени, а темп «не больше 30 в секунду» гарантирует, что мы сами не превысим лимит шлюза.</p>
      <p><b>Предохранитель</b> во время аварии вообще не трогает шлюз: задачи ждут в таблице, потоки свободны. Раз в 10 секунд он пробует несколько запросов — получилось, значит, закрывается.</p>
      <p><b>Где живут повторы.</b> Не в потоке запроса клиента, а в таблице-очереди своей БД (<code>sms_outbox</code>: статус, число попыток, <code>next_attempt_at</code>). Приложение сразу получает «код отправляется», отправщик забирает задачи и повторяет, пока код действует (5 минут). Брокер для этого не нужен.</p>
      <p><b>Цена короткого таймаута</b> — возможные дубли: шлюз мог отправить SMS, но не успеть ответить. Для кода входа это терпимо. Для оплаты — нет: там повтор только с ключом идемпотентности.</p>`,
    report(ans) {
      const c = Object.assign({}, SMS_BLANK, ans.cfg || {}), r = simSms(c);
      return `- ${smsLabel(c)}\n- Итог: доставлено ${r.delivered}/${r.total}, вход висел ${r.fullSec} с, 429: ${r.r429}, попыток ${r.attempts}\n- Вопрос про таймаут: ${qScore(Q_TMO, ans.q).ok ? 'верно' : 'неверно'}`;
    }
  };

  // =====================================================================
  // Подход 3. Лимит частоты: 429
  // =====================================================================
  const RL = { T: 120, CAP: 300, APP: 210, NEW: 10, LIM: 20 };
  // Воскресенье 20:00:00–20:02:00. Приложение «Пульса» — 210 запросов/с. ФитПасс — 10 новых записей в секунду
  // (расписание он берёт из кэша). Места на популярные занятия кончаются: доля ответов 409 растёт до 80 %.
  // ФитПасс повторяет через 3 с любую ошибку и таймаут. API выдерживает 300 запросов/с.
  function simRate(c) {
    const T = RL.T, R = TR.rand('h3-rate');
    const lim = c.limit === '20' ? RL.LIM : Infinity;
    const due = Array.from({ length: T + 400 }, () => []), plan = new Array(T + 400).fill(0);
    const it = [];
    const fpIn = new Array(T).fill(0), loadA = new Array(T).fill(0), appA = new Array(T).fill(0);
    let rej = 0, r409 = 0;
    for (let t = 0; t < T; t++) {
      for (let k = 0; k < RL.NEW; k++) { const id = it.length; it.push({ id, at: t, done: null }); due[t].push(id); }
      const list = due[t]; fpIn[t] = list.length;
      const adm = list.slice(0, lim), rj = list.slice(lim);
      const load = RL.APP + adm.length + .02 * rj.length;
      const okr = Math.min(1, RL.CAP / load);
      loadA[t] = load / RL.CAP; appA[t] = okr;
      const full = Math.min(.8, t / 30);
      for (const id of adm) {
        const j = it[id];
        if (R() > okr) { due[t + 3].push(id); continue; }
        if (j.full || R() < full) { j.full = true; r409++; if (c.retry4xx === 'yes') due[t + 3].push(id); else j.done = 'full'; }
        else j.done = 'ok';
      }
      for (const id of rj) {
        rej++;
        if (c.resp === '429' && c.honor === 'yes') { let s = t + 1; while (plan[s] + RL.NEW >= lim) s++; plan[s]++; due[s].push(id); }
        else due[t + 3].push(id);
      }
    }
    const mine = it.filter(j => j.at < T - 15);
    const answered = mine.filter(j => j.done).length / mine.length;
    const tail = appA.slice(T - 30);
    return { appEnd: tail.reduce((s, x) => s + x, 0) / tail.length, appMin: Math.min(...appA), peakLoad: Math.max(...loadA), fpPeak: Math.max(...fpIn), answered, rej, r409, fpIn, loadA, appA };
  }
  const RL_REF = { limit: '20', resp: '429', honor: 'yes', retry4xx: 'no' };
  const RL_BLANK = { limit: 'none', resp: '503', honor: 'no', retry4xx: 'yes' };
  const RL_OPTS = [
    ['limit', 'Лимит на партнёра', 'решаем мы', [{ v: 'none', t: 'нет' }, { v: '20', t: '20 запросов/с' }]],
    ['resp', 'Ответ сверх лимита', 'решаем мы', [{ v: '503', t: '503 без подсказки' }, { v: '429', t: '429 + Retry-After' }]],
    ['honor', 'ФитПасс ждёт Retry-After', 'договорённость с Кириллом', [{ v: 'no', t: 'нет, повтор через 3 с' }, { v: 'yes', t: 'да' }]],
    ['retry4xx', 'ФитПасс повторяет 409 «мест нет»', 'договорённость с Кириллом', [{ v: 'yes', t: 'да, любую ошибку' }, { v: 'no', t: 'нет, только 5xx, 429 и таймауты' }]]
  ];
  const rlLabel = c => RL_OPTS.map(([k, n, , o]) => `${n}: ${(o.find(x => x.v === c[k]) || {}).t || '—'}`).join('; ');
  const Q_RLH = {
    q: 'Какие заголовки отдаём ФитПассу в каждом ответе, чтобы он притормаживал ещё до 429?',
    options: [
      { t: '<code>RateLimit-Limit</code>, <code>RateLimit-Remaining</code>, <code>RateLimit-Reset</code>', ok: 1, why: 'Партнёр видит «осталось 3 запроса, окно обнулится через 1 с» и сам сбавляет темп.' },
      { t: '<code>Retry-After</code> в каждом ответе', why: '<code>Retry-After</code> нужен в 429 и 503 — «когда приходить снова». В обычном ответе он ничего не значит.' },
      { t: '<code>Cache-Control: no-store</code>', why: 'Это про кэширование, а не про темп запросов.' },
      { t: 'Никаких: пусть читают документацию', why: 'Документацию читают один раз, а заголовки — каждый ответ. Машине нужны машинные подсказки.' }
    ]
  };

  const taskRate = {
    id: 'rate', title: 'Лимит частоты: 429',
    simple: {
      icon: '🚦',
      plain: 'Лимит частоты — «не больше N запросов в секунду от одного клиента». Сверх лимита сервер вежливо отказывает и говорит, когда приходить снова.',
      analogy: 'На ресепшене очередь. Курьер от партнёра приносит пачку из 50 анкет и требует оформить всех сразу, а клиенты с абонементами стоят и ждут. Администратор говорит: «От вас — не больше 20 в минуту, остальные — через минуту». И курьер приходит через минуту, а не ломится каждые три секунды.',
      tech: 'Rate limit на партнёра (по <code>client_id</code> из токена). Сверх лимита — <code>429 Too Many Requests</code> с <code>Retry-After</code>. В каждом ответе — <code>RateLimit-Limit/Remaining/Reset</code>. Отказ 429 почти бесплатный: запрос отбрасывается до бизнес-логики и базы. Клиент обязан ждать <code>Retry-After</code> и не повторять 4xx, кроме 429: повтор «мест нет» ничего не изменит.'
    },
    lead: ui.brief({
      situation: `Воскресенье, 20:00 — открылась запись на неделю. Приложение «Пульса» шлёт в наш сервер (API) 210 запросов в секунду. Сервер выдерживает 300. Партнёр ФитПасс добавляет ещё 10 записей в секунду за своих клиентов. Его программа устроена просто: на любую ошибку повторяет запрос через 3 секунды. Места быстро кончаются: уже через полминуты 8 из 10 записей получают ответ 409 «мест нет». ФитПасс повторяет и их — хотя от повтора место не появится.`,
      todo: [
        `Верхние два переключателя решаете вы. <b>Лимит на партнёра</b> — сколько запросов в секунду пускаем от ФитПасса. Остальным сразу отказываем. <b>Ответ сверх лимита</b> — каким кодом отказываем.`,
        `Нижние два — о чём договориться с Кириллом из ФитПасса. Ждёт ли он паузу, которую мы подсказали в заголовке <code>Retry-After</code> («приходите через 1 секунду»). Повторяет ли он ответ 409.`,
        `Ответьте на вопрос про заголовки внизу.`,
        `Засчитывается, когда приложение «Пульса» не страдает из-за партнёра, ФитПасс не делает пустых повторов, а вопрос решён.`
      ],
      lookTitle: 'Как читать симуляцию',
      look: `Время — с 20:00:00 до 20:02:00, один столбик — одна секунда.<br><b>Верхний график</b> — сколько запросов прислал ФитПасс вместе с повторами. Растёт с 10 до 40–60 — значит, повторы копятся снежным комом. Пунктир — ваш лимит.<br><b>Нижний график</b> — какая доля записей в приложении «Пульса» проходит. Зелёный — почти все, жёлтый — 9 из 10, красный — меньше.<br>Плитка «Нагрузка на API» больше 100 % — сервер не успевает и отказывает всем подряд, в том числе нашим клиентам.`
    }),
    blank: () => ({ cfg: Object.assign({}, RL_BLANK), q: [] }),
    reference: () => ({ cfg: Object.assign({}, RL_REF), q: [0] }),
    render(el, ctx) {
      const a = ctx.ans; a.cfg = Object.assign({}, RL_BLANK, a.cfg || {});
      const wrap = document.createElement('div'); wrap.className = 'stack'; el.appendChild(wrap);
      const draw = () => {
        const c = a.cfg, r = simRate(c);
        const appK = r.appEnd >= .99 ? 'ok' : r.appEnd >= .9 ? 'warn' : 'bad';
        wrap.innerHTML = `
          <div class="card flat"><div class="h3-set">${RL_OPTS.map(([k, n, s, o]) => setRow(n, s, k, o, c[k])).join('')}</div>
          ${c.limit === 'none' ? '<div class="small dim">Пока лимита нет, второй переключатель ни на что не влияет: отказывать нечем.</div>' : ''}</div>
          <div>
            <div class="h3-chart-h"><span><b>Запросов от ФитПасса в секунду</b> (вместе с повторами)</span><span class="small dim">20:00:00 → 20:02:00</span></div>
            ${bars(r.fpIn, { max: Math.max(60, r.fpPeak), cap: c.limit === '20' ? 20 : null, capLabel: 'лимит 20', title: 'запросы ФитПасса по секундам', cls: x => x > 40 ? 'bad' : x > 20 ? 'warn' : '' })}
          </div>
          <div>
            <div class="h3-chart-h"><span><b>Запись в приложении «Пульса» проходит</b></span></div>
            ${bars(r.appA.map(x => Math.round(x * 100)), { max: 100, title: 'доля успешных записей в приложении', cls: x => x >= 99 ? 'ok' : x >= 90 ? 'warn' : 'bad' })}
          </div>
          <div class="grid4">
            ${stat('Приложение «Пульса»', pct(r.appEnd), appK, 'запросов проходит в конце минуты')}
            ${stat('Нагрузка на API', pct(r.peakLoad), r.peakLoad > 1 ? 'bad' : r.peakLoad > .85 ? 'warn' : 'ok', 'в пике, от 300 запросов/с')}
            ${stat('Пик от ФитПасса', `${r.fpPeak}/с`, r.fpPeak > 40 ? 'bad' : r.fpPeak > 20 ? 'warn' : 'ok', 'новые + повторы')}
            ${stat('Клиенты ФитПасса', pct(r.answered), r.answered >= .97 ? 'ok' : r.answered >= .8 ? 'warn' : 'bad', 'получили ответ: записан или мест нет')}
          </div>
          ${c.limit === '20' ? `<div class="grid2"><div class="h3-sc">${ui.http({ status: c.resp === '429' ? 429 : 503, cap: 'ответ сверх лимита', headers: c.resp === '429' ? [['Retry-After', '1'], ['RateLimit-Limit', '20'], ['RateLimit-Remaining', '0'], ['RateLimit-Reset', '1'], ['Content-Type', 'application/problem+json']] : [['Content-Type', 'application/problem+json']], body: c.resp === '429' ? { type: 'https://api.puls.fit/problems/rate-limit', title: 'Слишком много запросов', status: 429, detail: 'Не больше 20 запросов в секунду. Повторите через 1 с.' } : { title: 'Service Unavailable', status: 503 } })}</div>
            <div class="small">${c.resp === '429' ? 'Партнёр видит: дело в нём, а не в нас, и знает, когда приходить.' : '503 говорит «у нас авария», без подсказки, когда повторять. Партнёр повторит через свои 3 секунды — и снова упрётся в лимит.'} Отказ сверх лимита почти ничего не стоит API: запрос отбрасывается до базы.</div></div>` : ''}
          <div data-q></div>`;
        ui.quiz(TR.$('[data-q]', wrap), Object.assign({}, Q_RLH, { value: a.q || [], readonly: ctx.readonly, reveal: ctx.result, seed: 'h3-rlh', onChange: q => { ctx.ans.q = q; ctx.save(); } }));
      };
      ui.onSeg(wrap, (n, v) => {
        if (ctx.readonly) return;
        ctx.ans.cfg = Object.assign({}, ctx.ans.cfg, { [n]: v }); ctx.save();
        ctx.decide('Лимит частоты для ФитПасса', rlLabel(ctx.ans.cfg));
        draw();
      });
      draw();
    },
    check(ans) {
      const c = Object.assign({}, RL_BLANK, (ans && ans.cfg) || {}), r = simRate(c), q = qScore(Q_RLH, ans && ans.q);
      const notes = [];
      if (c.limit !== '20') notes.push({ ok: false, html: `Без лимита к концу минуты ФитПасс шлёт ${r.fpPeak} запросов/с вместо 10, нагрузка — ${pct(r.peakLoad)}, в приложении проходит ${pct(r.appEnd)} записей. ${c.retry4xx === 'no' ? 'Сейчас обошлось только потому, что ФитПасс ведёт себя хорошо. Следующий партнёр или сбой у ФитПасса — и защиты нет.' : 'Один партнёр положил запись для всех.'}` });
      else notes.push({ ok: true, html: `Лимит на партнёра есть: приложение «Пульса» получает ${pct(r.appEnd)} успешных ответов, что бы ни делал ФитПасс.` });
      if (c.limit === '20' && c.resp !== '429') notes.push({ ok: false, html: '503 говорит «у нас авария» и не подсказывает, когда приходить. Какой код говорит «это вы слишком часто», и какой заголовок — «приходите через секунду»?' });
      if (c.honor !== 'yes') notes.push({ ok: false, html: 'ФитПасс игнорирует подсказку о паузе и долбит каждые 3 секунды. Это надо закрепить в договоре интеграции с Кириллом.' });
      if (c.retry4xx !== 'no') notes.push({ ok: false, html: `ФитПасс повторяет даже «мест нет»: ${r.r409} ответов 409 за 2 минуты, и каждый повтор бесполезен — места от повтора не появятся. Какие ошибки вообще есть смысл повторять?` });
      if (!q.ok) notes.push({ ok: false, html: 'Заголовки: что поможет партнёру притормозить заранее, а не после отказа?' });
      const parts = [c.limit === '20', c.resp === '429', c.honor === 'yes', c.retry4xx === 'no', q.ok];
      return { ok: parts.every(Boolean), score: parts.filter(Boolean).length / parts.length, summary: `Приложение: ${pct(r.appEnd)} · нагрузка в пике: ${pct(r.peakLoad)} · клиенты ФитПасса получили ответ: ${pct(r.answered)}.`, notes };
    },
    explain: `<p><b>Без лимита один партнёр кладёт всех.</b> ФитПасс повторяет «мест нет» каждые 3 секунды. Безнадёжные повторы копятся, и к концу второй минуты их сотни в секунду. API тонет, и запись перестаёт работать у своих клиентов. Ровно так «Пульс» уже лежал в воскресенье в 20:00.</p>
      <p><b>Лимит 20 запросов/с на партнёра</b> отсекает лишнее до базы, а отказ почти ничего не стоит. Даже если партнёр ведёт себя плохо, свои клиенты не страдают. Это решаем мы сами, ни с кем не договариваясь.</p>
      <p><b>429 + Retry-After, а не 503.</b> 429 значит «это вы слишком часто», 503 — «у нас авария». С Retry-After партнёр знает, когда приходить. В каждом ответе — <code>RateLimit-*</code>, чтобы он тормозил заранее.</p>
      <p><b>Договорённости с Кириллом</b> вписываем в контракт Partner API: ждать <code>Retry-After</code>; повторять только таймауты, 5xx и 429; никогда не повторять 400, 409, 422 — от повтора они не изменятся. Повторы POST — только с тем же <code>Idempotency-Key</code>.</p>`,
    report(ans) {
      const c = Object.assign({}, RL_BLANK, ans.cfg || {}), r = simRate(c);
      return `- ${rlLabel(c)}\n- Итог: приложение ${pct(r.appEnd)}, нагрузка ${pct(r.peakLoad)}, клиенты ФитПасса получили ответ ${pct(r.answered)}\n- Заголовки: ${qScore(Q_RLH, ans.q).ok ? 'верно' : 'неверно'}`;
    }
  };

  // =====================================================================
  // Подход 4. Вебхуки ПэйПоинта
  // =====================================================================
  const DEF = [
    { id: 'dedup', t: 'Дедупликация по <code>event.id</code>', sub: 'первым делом INSERT в inbound_event; повтор — конфликт ключа' },
    { id: 'hmac', t: 'Подпись HMAC + окно по времени', sub: 'подпись тела с секретом и метка времени не старше 5 минут' },
    { id: 'fast', t: 'Быстрый 200, обработка после ответа', sub: 'сохранили событие → 200 → обработчик забирает из таблицы' },
    { id: 'mono', t: 'Статусы не ходят назад', sub: 'из succeeded и canceled переходов нет' },
    { id: 'recon', t: 'Сверка <code>GET /payments/{id}</code>', sub: 'телу не верим на слово; зависшие pending проверяем раз в 5 минут' }
  ];
  const DEF_NONE = { dedup: false, hmac: false, fast: false, mono: false, recon: false };
  const LANES = [
    { id: 'src', t: 'Отправитель', sub: 'ПэйПоинт или чужой' },
    { id: 'api', t: 'Наш вебхук', sub: 'POST /webhooks/paypoint' },
    { id: 'db', t: 'БД «Пульса»', sub: 'payment, inbound_event' },
    { id: 'psp', t: 'API ПэйПоинта', sub: 'GET /payments/{id}' }
  ];
  const S = (from, to, t, kind, x) => Object.assign({ from, to, t, kind: kind || '' }, x || {});
  const WH = [
    {
      id: 'dup', t: 'Успех пришёл дважды', sub: 'тот же <code>payment.succeeded</code>, тот же <code>event.id</code>',
      hint: 'Повтор того же события. Как узнать, что именно это событие вы уже обработали?',
      run(d) {
        const s = [S('src', 'api', 'payment.succeeded\nevt_7Kq · pay_31', '', { note: 'Клиент оплатил абонемент «Сеть 12 мес» — 54 000 ₽.' })];
        if (d.hmac) s.push(S('api', 'api', 'подпись ✓ время ✓', 'ok'));
        if (d.dedup) s.push(S('api', 'db', 'INSERT inbound_event evt_7Kq', '', { note: 'Сначала записываем id события. Первичный ключ не даст записать его второй раз.' }));
        if (d.fast) s.push(S('api', 'src', '200 OK · 40 мс', 'ok', { reply: true }));
        s.push(S('api', 'db', 'pay_31 → succeeded\nабонемент → active'), S('api', 'api', 'чек, пуш, строка в 1С'));
        if (!d.fast) s.push(S('api', 'src', '200 OK', 'ok', { reply: true }));
        s.push(S('src', 'api', 'тот же evt_7Kq ещё раз', 'warn', { note: 'ПэйПоинт доставляет «хотя бы один раз»: у него сбой подтверждения — шлёт снова. Это нормальное поведение, а не ошибка.' }));
        if (d.hmac) s.push(S('api', 'api', 'подпись ✓ время ✓', 'ok'));
        let out;
        if (d.dedup) { s.push(S('api', 'db', 'INSERT → конфликт ключа', 'ok', { note: 'Это событие уже есть в inbound_event. Ничего не делаем.' }), S('api', 'src', '200 OK · уже обработано', 'ok', { reply: true })); out = { s: 'ok', m: 'активирован один раз', r: 'одно списание, одна строка в 1С' }; }
        else if (d.mono) { s.push(S('api', 'db', 'succeeded → succeeded: пропуск', 'ok'), S('api', 'api', 'второй чек и пуш, строка в 1С', 'warn'), S('api', 'src', '200 OK', '', { reply: true })); out = { s: 'warn', m: 'активирован один раз', r: 'но второй чек клиенту и вторая строка в 1С — выручка задвоится' }; }
        else { s.push(S('api', 'db', 'снова «оплачено»: бонус ×2', 'bad'), S('api', 'api', 'второй чек, пуш, строка в 1С', 'bad'), S('api', 'src', '200 OK', '', { reply: true })); out = { s: 'bad', m: 'бонус «приведи друга» начислен дважды', r: 'в 1С две оплаты по 54 000 ₽ — неделя сверки' }; }
        return { steps: s, out };
      }
    },
    {
      id: 'order', t: 'Отмена пришла после успеха', sub: '<code>payment.canceled</code> отправлен раньше, а дошёл позже',
      hint: 'Другое событие с другим id приходит не по порядку. Какое правило не даст платежу «откатиться» из конечного статуса?',
      run(d) {
        const s = [S('src', 'api', 'payment.succeeded · pay_31\n(отправлен в 12:00:05)'), S('api', 'db', 'succeeded, абонемент active'), S('api', 'src', '200 OK', 'ok', { reply: true }),
          S('src', 'api', 'payment.canceled · pay_31\n(отправлен в 12:00:01, дошёл позже)', 'warn', { note: 'Первая попытка 3-D Secure не прошла, вторая прошла. Событие об отмене задержалось в сети и пришло последним.' })];
        if (d.hmac) s.push(S('api', 'api', 'подпись ✓ время ✓', 'ok'));
        if (d.dedup) s.push(S('api', 'db', 'INSERT inbound_event: новое', '', { note: 'Дедупликация не поможет: это другое событие с другим id.' }));
        let out;
        if (d.mono) { s.push(S('api', 'db', 'succeeded → canceled? запрещено', 'ok', { note: 'succeeded — конечный статус. Событие записано в журнал и пропущено.' })); out = { s: 'ok', m: 'остаётся активным', r: 'списано 54 000 ₽ — и абонемент есть' }; }
        else if (d.recon) { s.push(S('api', 'psp', 'GET /payments/pay_31'), S('psp', 'api', 'status: succeeded', 'ok', { reply: true }), S('api', 'db', 'оставляем succeeded', 'ok')); out = { s: 'warn', m: 'остаётся активным', r: 'спасла сверка; но без правила «назад не ходим» гонка сверки и вебхука возможна' }; }
        else { s.push(S('api', 'db', 'pay_31 → canceled\nабонемент снят', 'bad'), S('api', 'api', 'пуш «Оплата не прошла»', 'bad')); out = { s: 'bad', m: 'снят с активных', r: 'деньги списаны, абонемента нет — звонок на ресепшен' }; }
        s.push(S('api', 'src', '200 OK', '', { reply: true }));
        return { steps: s, out };
      }
    },
    {
      id: 'slow', t: 'Обработчик думает 12 секунд', sub: 'ПэйПоинт ждёт 10 с и повторяет',
      hint: 'ПэйПоинт ждёт ответа 10 секунд, а обработка идёт 12. Что если отвечать сразу, а работать потом?',
      run(d) {
        const s = [S('src', 'api', 'payment.succeeded · evt_9Lm')];
        if (d.hmac) s.push(S('api', 'api', 'подпись ✓ время ✓', 'ok'));
        if (d.dedup) s.push(S('api', 'db', 'INSERT inbound_event evt_9Lm'));
        let out;
        if (d.fast) {
          if (!d.dedup) s.push(S('api', 'db', 'сохранили событие в таблицу'));
          s.push(S('api', 'src', '200 OK · 40 мс', 'ok', { reply: true, note: 'Ответили сразу после сохранения. Обработчик заберёт событие из таблицы.' }), S('api', 'api', 'после ответа: 12 с\nчек, 1С, SMS, пуш', 'info'));
          out = { s: 'ok', m: 'активирован один раз', r: 'повторов от ПэйПоинта нет' };
        } else {
          s.push(S('api', 'api', 'обрабатываем…\nчек, 1С, SMS — 12 с', 'warn'), S('src', 'src', '10 с без ответа — таймаут', 'bad'), S('src', 'api', 'повтор evt_9Lm', 'warn', { note: 'Для ПэйПоинта доставка не удалась — он повторяет. Первый обработчик всё ещё работает.' }));
          if (d.dedup) { s.push(S('api', 'db', 'INSERT → конфликт: уже есть', 'ok'), S('api', 'src', '200 OK · уже в работе', '', { reply: true })); out = { s: 'warn', m: 'активирован один раз', r: 'дубль отсечён, но у ПэйПоинта копятся неудачные доставки; в пик всё приходит с опозданием' }; }
          else { s.push(S('api', 'api', 'второй обработчик параллельно', 'bad'), S('api', 'db', 'активировали дважды, 2 чека', 'bad')); out = { s: 'bad', m: 'обработан дважды', r: 'два чека, две строки в 1С; ПэйПоинт продолжает повторять' }; }
        }
        return { steps: s, out };
      }
    },
    {
      id: 'forged', t: 'Поддельный вебхук', sub: '«успех» без подписи от постороннего',
      hint: 'Адрес вебхука не секрет. Как отличить ПэйПоинт от постороннего — или вообще не верить телу запроса?',
      run(d) {
        const s = [S('src', 'api', 'payment.succeeded · pay_99\nбез подписи', 'warn', { note: 'Адрес /webhooks/paypoint не секрет: его видно в логах, у подрядчиков, в старых репозиториях. Платёж pay_99 мошенник не оплачивал.' })];
        let out;
        if (d.hmac) { s.push(S('api', 'api', 'подписи нет → 401', 'ok'), S('api', 'src', '401 Unauthorized', 'ok', { reply: true })); out = { s: 'ok', m: 'не активирован', r: 'подделка отброшена до базы' }; }
        else if (d.recon) { s.push(S('api', 'psp', 'GET /payments/pay_99'), S('psp', 'api', 'status: pending', 'ok', { reply: true }), S('api', 'api', 'телу не верим — ничего не делаем', 'ok'), S('api', 'src', '200 OK', '', { reply: true })); out = { s: 'warn', m: 'не активирован', r: 'спасла сверка, но каждый поддельный запрос — лишний запрос в ПэйПоинт' }; }
        else { s.push(S('api', 'db', 'pay_99 → succeeded\n«Сеть 12 мес» active', 'bad'), S('api', 'src', '200 OK', '', { reply: true })); out = { s: 'bad', m: 'годовой абонемент бесплатно', r: '54 000 ₽ не получено' }; }
        return { steps: s, out };
      }
    },
    {
      id: 'replay', t: 'Повтор старого вебхука', sub: 'настоящий вебхук перехватили и прислали через сутки',
      hint: 'Подпись у старого вебхука настоящая. Что в нём выдаёт «старость» — и что вы помните о прошлых событиях?',
      run(d) {
        const s = [S('src', 'api', 'вчерашний payment.succeeded\nevt_2Ab · подпись настоящая', 'warn', { note: 'Подпись не подделана — это настоящий вебхук ПэйПоинта, просто отправлен повторно через сутки.' })];
        let out;
        if (d.hmac) { s.push(S('api', 'api', 'подпись ✓, но метка времени\nсутки назад > 5 мин → 401', 'ok'), S('api', 'src', '401 Unauthorized', 'ok', { reply: true })); out = { s: 'ok', m: 'не продлён', r: 'старый вебхук отброшен' }; }
        else if (d.dedup) { s.push(S('api', 'db', 'INSERT evt_2Ab → уже есть', 'ok'), S('api', 'src', '200 OK · уже обработано', 'ok', { reply: true })); out = { s: 'ok', m: 'не продлён', r: 'событие узнали по id' }; }
        else if (d.mono) { s.push(S('api', 'db', 'succeeded → succeeded: пропуск', 'ok'), S('api', 'api', 'чек и строка в 1С ещё раз', 'warn'), S('api', 'src', '200 OK', '', { reply: true })); out = { s: 'warn', m: 'не продлён', r: 'но лишний чек и строка в 1С' }; }
        else { s.push(S('api', 'db', 'продлили абонемент ещё раз', 'bad'), S('api', 'src', '200 OK', '', { reply: true })); out = { s: 'bad', m: 'продлён бесплатно', r: 'месяц занятий подарен постороннему' }; }
        return { steps: s, out };
      }
    },
    {
      id: 'lost', t: 'Вебхук не пришёл', sub: 'сбой доставки у ПэйПоинта',
      hint: 'Вебхук может не прийти вовсе. Кто через 15 минут сам спросит ПэйПоинт, чем кончился платёж?',
      run(d) {
        const s = [S('src', 'api', 'payment.succeeded · pay_44', 'bad', { lost: true, note: 'Сбой у ПэйПоинта: событие не дошло. Клиент при этом уже заплатил.' }), S('db', 'db', 'pay_44: pending 15 мин', 'warn')];
        let out;
        if (d.recon) { s.push(S('api', 'api', 'сверка раз в 5 минут:\npending дольше 15 мин', 'info'), S('api', 'psp', 'GET /payments/pay_44'), S('psp', 'api', 'status: succeeded', 'ok', { reply: true }), S('api', 'db', 'succeeded, абонемент active', 'ok')); out = { s: 'ok', m: 'активирован через 15 минут', r: 'деньги и абонемент сходятся' }; }
        else { s.push(S('api', 'api', 'ждём вебхук… вечно', 'bad')); out = { s: 'bad', m: 'висит в pending_payment', r: 'клиент заплатил 54 000 ₽, абонемента нет' }; }
        return { steps: s, out };
      }
    }
  ];
  const whEval = d => WH.map(w => ({ id: w.id, ...w.run(Object.assign({}, DEF_NONE, d || {})).out }));
  const KS = { ok: 'ok', warn: 'warn', bad: 'bad' }, KT = { ok: 'защищено', warn: 'частично', bad: 'беда' };

  const taskWebhooks = {
    id: 'webhooks', title: 'Вебхуки ПэйПоинта',
    simple: {
      icon: '📨',
      plain: 'Вебхук — ПэйПоинт сам сообщает нам «оплата прошла». Но он может прислать это дважды, не по порядку, с опозданием, а может не прислать вовсе. И кто угодно может прислать подделку.',
      analogy: 'Курьер приносит в клуб уведомления из банка. Иногда приносит одно и то же дважды, иногда вчерашнее позже сегодняшнего, иногда теряет. А иногда под видом курьера заходит посторонний. Администратор сверяет печать, отмечает номер уведомления в журнале, расписывается сразу и разбирает почту потом. А по сомнительным — звонит в банк.',
      tech: 'Доставка «хотя бы один раз» (at-least-once): дубли и нарушение порядка — норма. Защиты: дедупликация по <code>event.id</code> (таблица <code>inbound_event</code>), проверка подписи HMAC-SHA256 и метки времени, быстрый <code>200</code> и обработка после ответа, монотонная статусная модель платежа, сверка статуса через <code>GET /payments/{id}</code> и задача для зависших <code>pending</code>.'
    },
    lead: ui.brief({
      situation: `Клиентка покупает в приложении абонемент «Сеть 12 мес» за 54 000 ₽. Деньги проводит платёжный сервис ПэйПоинт. Когда оплата прошла, ПэйПоинт сам присылает нам сообщение «платёж pay_31 прошёл». Это и есть <b>вебхук</b> — уведомление, которое чужая система шлёт на наш адрес. По нему мы включаем абонемент.<br>Но эта «почта» ненадёжна. Сообщение может прийти дважды, не по порядку, с опозданием, поддельным — или не прийти вовсе. Шесть карточек — шесть таких случаев.`,
      todo: [
        `Включайте и выключайте пять защит-галочек сверху. Под каждой мелко написано, что она делает.`,
        `Нажмите на карточку события — оно проиграется по шагам на схеме ниже.`,
        `Засчитывается, когда все шесть карточек стали зелёными: «Защищено событий: 6 из 6».`
      ],
      lookTitle: 'Как читать схему',
      look: `Карточка показывает, чем кончится событие при включённых сейчас защитах: «защищено», «частично» (повезло) или «беда». И что стало с абонементом и деньгами.<br>На схеме четыре колонки: кто прислал (ПэйПоинт или чужой), наш приёмник вебхуков, наша база данных и сервер ПэйПоинта, где можно самим спросить статус платежа. Стрелки идут сверху вниз по времени. Зелёный шаг — защита сработала, жёлтый — подозрительно, красный — ущерб.`
    }),
    blank: () => ({ d: Object.assign({}, DEF_NONE), ev: 'dup' }),
    reference: () => ({ d: { dedup: true, hmac: true, fast: true, mono: true, recon: true }, ev: 'dup' }),
    render(el, ctx) {
      const a = ctx.ans; a.d = Object.assign({}, DEF_NONE, a.d || {}); a.ev = a.ev || 'dup';
      el.innerHTML = `<div class="stack">
        <div class="h3-def">${DEF.map(x => `<label class="toggle"><input type="checkbox" data-def="${x.id}" ${a.d[x.id] ? 'checked' : ''} ${ctx.readonly ? 'disabled' : ''}><span><b>${x.t}</b><small>${x.sub}</small></span></label>`).join('')}</div>
        <div class="row between"><b data-sum></b><span class="small dim">Нажмите на событие, чтобы проиграть его по шагам</span></div>
        <div class="grid3" data-evs></div>
        <div><div class="eyebrow" data-evt></div><div data-seq></div></div>
      </div>`;
      const evs = TR.$('[data-evs]', el), sum = TR.$('[data-sum]', el), evt = TR.$('[data-evt]', el);
      let seq = null;
      const drawCards = () => {
        const res = whEval(a.d);
        const okN = res.filter(r => r.s === 'ok').length;
        sum.innerHTML = `Защищено событий: ${okN} из ${WH.length}`;
        evs.innerHTML = WH.map((w, i) => { const r = res[i]; return `<button type="button" class="card h3-ev ${KS[r.s]} ${a.ev === w.id ? 'sel' : ''}" data-ev="${w.id}">
          <div class="row between"><b>${w.t}</b>${ui.status(KT[r.s], r.s)}</div><div class="small dim">${w.sub}</div>
          <div class="ln">Абонемент: ${esc(r.m)}</div><div class="ln">Деньги: ${esc(r.r)}</div></button>`; }).join('');
      };
      const drawSeq = (play) => {
        const w = WH.find(x => x.id === a.ev) || WH[0];
        const run = w.run(a.d);
        const steps = run.steps.concat([S('src', 'psp', `Итог: ${KT[run.out.s]} · абонемент: ${run.out.m}`, run.out.s, { box: true, note: 'Деньги: ' + run.out.r })]);
        evt.textContent = 'Сценарий: ' + w.t.toLowerCase();
        if (!seq) seq = ui.seq(TR.$('[data-seq]', el), { lanes: LANES, steps, start: 'all', laneW: 170, speed: 900, title: 'Сценарий вебхука: ' + w.t });
        else seq.set(steps, { all: !play, play: !!play });
      };
      drawCards(); drawSeq(false);
      el.addEventListener('change', e => {
        const c = e.target.closest('[data-def]'); if (!c || ctx.readonly) return;
        ctx.ans.d = Object.assign({}, ctx.ans.d, { [c.dataset.def]: c.checked }); a.d = ctx.ans.d; ctx.save();
        ctx.decide('Защиты вебхука ПэйПоинта', DEF.filter(x => a.d[x.id]).map(x => x.t.replace(/<[^>]+>/g, '')).join(', ') || 'нет');
        drawCards(); drawSeq(false);
      });
      TR.on(el, 'click', '[data-ev]', (e, b) => { a.ev = b.dataset.ev; if (!ctx.readonly) { ctx.ans.ev = a.ev; ctx.save(); } drawCards(); drawSeq(true); });
    },
    check(ans) {
      const res = whEval(ans && ans.d);
      const sc = res.reduce((s, r) => s + (r.s === 'ok' ? 1 : r.s === 'warn' ? .5 : 0), 0) / res.length;
      const notes = WH.map((w, i) => { const r = res[i]; return r.s === 'ok' ? { ok: true, html: `${w.t}: защищено.` } : { ok: r.s === 'warn' ? 'warn' : false, html: `${w.t}: ${r.s === 'warn' ? 'держится на случайности' : 'беда'} (${esc(r.r)}). ${w.hint}` }; });
      return { ok: res.every(r => r.s === 'ok'), score: sc, summary: `Защищено ${res.filter(r => r.s === 'ok').length} из ${res.length} событий.`, notes };
    },
    explain: `<p><b>Каждая защита закрывает свою дыру — и ни одна не закрывает все.</b></p>
      <ul class="checks">
        <li><b>Дедупликация по <code>event.id</code></b> — дубли и повторная отправка. Первым шагом <code>INSERT INTO inbound_event</code>: первичный ключ сам скажет «уже было».</li>
        <li><b>Подпись HMAC + окно 5 минут</b> — подделки и повтор перехваченного. Подпись без метки времени не спасает от повтора: старый вебхук подписан по-настоящему.</li>
        <li><b>Быстрый 200</b> — сохранили событие, ответили, обработали потом. Иначе медленный обработчик сам вызывает повторы и гонку двух обработчиков.</li>
        <li><b>Статусы не ходят назад</b> — события не по порядку. <code>succeeded</code> и <code>canceled</code> — конечные: позднее событие пишем в журнал и пропускаем.</li>
        <li><b>Сверка <code>GET /payments/{id}</code></b> — единственная защита от потерянного вебхука. Задача раз в 5 минут проверяет платежи, которые висят в <code>pending</code> дольше 15 минут.</li>
      </ul>
      <p>В проде у «Пульса»: <code>POST /webhooks/paypoint</code> проверяет подпись → <code>INSERT inbound_event ON CONFLICT DO NOTHING</code> → <code>200</code>. Обработчик забирает необработанные строки (<code>processed_at IS NULL</code>) и меняет статус платежа по правилам перехода. Брокер для этого не нужен: таблица в своей БД и есть очередь.</p>`,
    report(ans) {
      const res = whEval(ans.d);
      return `- Защиты: ${DEF.filter(x => (ans.d || {})[x.id]).map(x => x.t.replace(/<[^>]+>/g, '')).join(', ') || 'нет'}\n` + WH.map((w, i) => `- ${w.t}: ${KT[res[i].s]}`).join('\n');
    }
  };

  // =====================================================================
  // Подход 5. Наш вебхук для ФитПасса
  // =====================================================================
  const OUT_RUBRIC = [
    'У события постоянный <code>event_id</code> — ФитПасс по нему отсекает дубли (доставка «хотя бы один раз»)',
    'Подпись HMAC тела + метка времени; ФитПасс проверяет подпись и окно в несколько минут',
    'Повторы с паузой 1-2-4-8… и разбросом из таблицы <code>outbound_webhook</code> (attempts, next_attempt_at), пока не получим 2xx; потолок по времени, потом — в ручной разбор',
    'Порядок не гарантирован: в событии есть время прохода (<code>occurred_at</code>), ФитПасс не полагается на порядок прихода',
    'От ФитПасса ждём быстрый 2xx с таймаутом в несколько секунд; обработка у них — после ответа',
    'Страховка — ежемесячная сверка через <code>GET /partner/v1/visits?month=…</code>'
  ];
  const OUT_REF = 'Отправляем <code>visit.completed</code> из таблицы <code>outbound_webhook</code>: запись создаётся в той же транзакции, что и посещение, отправщик забирает её отдельно. У события постоянный <code>event_id</code> — при повторе он тот же, ФитПасс отсекает дубли. Тело подписываем HMAC-SHA256 общим секретом, в подпись входит метка времени — ФитПасс проверяет подпись и окно 5 минут. Ждём 2xx не дольше 5 секунд; нет ответа — повторяем через 1, 2, 4, 8… минут с разбросом, сутки, потом событие уходит в ручной разбор и алерт. Порядок не гарантируем: в событии есть <code>occurred_at</code>. Раз в месяц — сверка визитов по <code>GET /partner/v1/visits</code>.';
  const taskOutbound = {
    id: 'outbound', title: 'Наш вебхук для ФитПасса',
    simple: {
      icon: '📤',
      plain: 'Теперь мы сами отправляем вебхук: ФитПасс хочет знать, что его клиент прошёл в клуб. Всё, от чего мы защищались у ПэйПоинта, теперь должны обеспечить сами — уже как вежливый отправитель.',
      analogy: 'Раньше вы получали уведомления от банка, теперь сами рассылаете уведомления партнёру. Хороший отправитель нумерует письма, ставит печать и дату, переотправляет, если не дошло, и не обижается, если одно письмо придёт дважды.',
      tech: 'Outbound webhook: событие <code>visit.completed</code>, таблица <code>outbound_webhook</code> (event_id UK, attempts, next_attempt_at, delivered_at), подпись HMAC, повторы с backoff и jitter, доставка «хотя бы один раз», сверка как страховка.'
    },
    lead: ui.brief({
      situation: `Клиент ФитПасса в 19:42 прошёл турникет в клубе «Пульс Сокол». ФитПасс платит «Пульсу» за каждый такой визит. Кирилл хочет узнавать о визите сразу, а не из отчёта в конце месяца. Теперь вебхук отправляем мы. Роли поменялись: от чего мы защищались у ПэйПоинта, то теперь должны обеспечить сами.`,
      todo: [
        `Рассмотрите пример нашего запроса сверху.`,
        `Напишите своими словами (от 120 знаков): что сделать, чтобы ФитПасс узнал о каждом визите ровно один раз — даже если его сервер лежал час.`,
        `Нажмите «Проверить с Верой (Claude)» или «Сверить с эталоном самому» и отметьте пункты, которые вы раскрыли. Засчитывается от 60 % пунктов.`
      ],
      lookTitle: 'На что смотреть',
      look: `<code>X-Puls-Event-Id</code> — номер события. При повторной отправке он тот же, так ФитПасс узнает дубль. <code>X-Puls-Signature</code> — подпись: <code>t=</code> — время отправки, <code>v1=</code> — «печать», которую можем поставить только мы. <code>occurredAt</code> — когда человек прошёл, а не когда ушло письмо. Вспомните шесть бед из прошлого подхода: дубль, не тот порядок, долгий ответ, подделка, старое письмо, потеря. Для каждой решите, что сделать нам как отправителю.`
    }),
    blank: () => ({ j: {} }),
    reference: () => ({ j: { text: OUT_REF.replace(/<[^>]+>/g, ''), self: OUT_RUBRIC.map(() => true) } }),
    render(el, ctx) {
      el.insertAdjacentHTML('beforeend', '<div class="h3-sc">' + ui.http({
        method: 'POST', path: 'https://partner.fitpass.example/webhooks/puls', cap: 'наш вебхук ФитПассу',
        headers: [['Content-Type', 'application/json'], ['X-Puls-Event-Id', 'evt_01J9ZK4Q7M'], ['X-Puls-Signature', 't=1791223512,v1=5f2c…9ab0']],
        body: { id: 'evt_01J9ZK4Q7M', type: 'visit.completed', occurredAt: '2026-10-05T19:42:10+03:00', data: { visitId: '6c1e…', partnerClientId: 'fp-883120', club: { id: '4b1f…', name: 'Пульс Сокол' } } }
      }) + '</div>');
      const j = document.createElement('div'); j.style.marginTop = '12px'; el.appendChild(j);
      ui.justify(j, {
        id: 'h3-outbound', q: 'Как сделать вебхук <code>visit.completed</code> надёжным?', qPlain: 'Как сделать вебхук visit.completed для ФитПасса надёжным?',
        rubric: OUT_RUBRIC, reference: OUT_REF, value: ctx.ans.j, readonly: ctx.readonly, minLen: 120,
        onChange: v => { ctx.ans.j = v; ctx.save(); ctx.decide('Наш вебхук для ФитПасса', v.text || ''); }
      });
    },
    check(ans) {
      const s = ui.justifyScore(ans && ans.j);
      return { ok: s >= .6, score: s, summary: s ? `Оценка обоснования: ${Math.round(s * 100)} %.` : 'Напишите ответ (от 120 символов) и проверьте его с Верой или сверьте с эталоном сами.', notes: s && s < .6 ? [{ ok: false, html: 'Вспомните, от чего вы защищались у ПэйПоинта: дубли, порядок, подделка, медленный ответ, потеря. Что из этого теперь ваша забота как отправителя?' }] : [] };
    },
    explain: '<p>Вы только что были по другую сторону: ПэйПоинт присылал дубли, события не по порядку, и вы строили защиту. Хороший отправитель делает жизнь получателя проще: постоянный <code>event_id</code>, подпись с меткой времени, время события в теле, повторы с паузой, предсказуемый потолок повторов. И честно пишет в контракте: «доставка хотя бы один раз, порядок не гарантирован, сверка раз в месяц».</p><p>Запись в <code>outbound_webhook</code> создаётся в той же транзакции, что и посещение: прошёл клиент — событие точно будет отправлено, даже если отправщик сейчас лежит.</p>',
    report: ans => (ans.j && ans.j.text) ? ans.j.text : '—'
  };

  // =====================================================================
  TR.stage({
    id: ID, act: 3, order: 130, slot: 'Чт 10:00', title: 'Версии, ретраи, вебхуки',
    when: 'четверг, 10:00 · переговорная «Кардио» · разбор с Тимуром и Денисом',
    intro: [
      { who: 'vera', html: 'Сегодня — то, что ломается не в день релиза, а через месяц, в воскресенье в 20:00. Изменили поле — упали старые приложения. SMS-шлюз прилёг — повис вход. ФитПасс ретраит — лежим все. ПэйПоинт прислал успех дважды — двойной бонус.' },
      { who: 'timur', html: '«У меня одна просьба: покажите, что будет, если. На словах все умные, а потом ночные звонки».' },
      { who: 'denis', html: '«И не ломайте нам API. У нас половина клиентов на версии полугодовой давности».' }
    ],
    facts: ['F-old-apps', 'F-sms', 'F-fitpass-tech', 'F-psp', 'F-psp-slow', 'F-no-loss', 'F-1c-dup', 'F-week-open'],
    glossary: [
      { term: 'Обратная совместимость', simple: 'Новая версия API не ломает тех, кто работал со старой. Как новая раздевалка рядом со старой, а не вместо неё.', tech: 'Можно: добавить необязательное поле, эндпоинт, параметр. Нельзя: переименовать, удалить, сменить тип, добавить обязательное поле в запрос, сменить код ответа.' },
      { term: 'Expand–contract', simple: 'Сначала добавить новое рядом со старым, перевести всех, и только потом убрать старое.', tech: 'Расширение → миграция клиентов → сужение. Момент сужения определяют по метрике: доля запросов от старых версий.' },
      { term: 'Deprecation и Sunset', simple: 'Табличка «скоро закроемся» прямо в ответе API: устарело и вот дата отключения.', tech: 'Заголовки Deprecation (RFC 9745) и Sunset (RFC 8594), ссылка Link rel="successor-version". После даты — 410 Gone.' },
      { term: 'Таймаут', simple: 'Сколько ждём ответа, прежде чем бросить трубку. Без него можно ждать вечно.', tech: 'Ограничивает время, на которое занят поток или соединение. Таймаут не значит «не сделано»: сервис мог выполнить запрос и не успеть ответить.' },
      { term: 'Экспоненциальная пауза (backoff)', simple: 'Перезванивать не сразу, а через 1, 2, 4, 8 секунд — каждый раз ждать дольше.', tech: 'Пауза растёт как 2ⁿ до потолка. Даёт упавшему сервису время подняться и не превращает повторы в шторм.' },
      { term: 'Jitter', simple: 'Случайный разброс паузы, чтобы сто клиентов не перезвонили в одну и ту же секунду.', tech: 'Пауза выбирается случайно в пределах окна (full jitter). Без разброса повторы разных клиентов совпадают и бьют волнами.' },
      { term: 'Предохранитель (circuit breaker)', simple: 'Как пробки в щитке: после серии ошибок перестаём обращаться к сервису на время, потом осторожно пробуем снова.', tech: 'Состояния closed → open (вызовы сразу отклоняются) → half-open (несколько пробных) → closed. Бережёт свои потоки и не добивает лежачего.' },
      { term: 'Лимит частоты (rate limit)', simple: 'Не больше N запросов в секунду от одного клиента; лишним — «приходите через секунду».', tech: '429 Too Many Requests + Retry-After; в каждом ответе RateLimit-Limit/Remaining/Reset. Лимит считают по партнёру (client_id из токена).' },
      { term: 'Подпись HMAC', simple: 'Печать на письме: подделать без секретного ключа нельзя, и видно, если письмо меняли.', tech: 'HMAC-SHA256 от тела и метки времени с общим секретом. Проверка подписи + окно по времени защищают от подделки и повтора.' },
      { term: 'Дедупликация событий', simple: 'Журнал номеров полученных уведомлений: второй раз то же самое не обрабатываем.', tech: 'Таблица inbound_event с первичным ключом provider_event_id: первым шагом INSERT, конфликт ключа значит «уже было».' }
    ],
    outro: 'Теперь вы видели, как ломаются интеграции не на схеме, а под нагрузкой: поле переименовали — упали старые приложения; нет таймаута — повис вход; нет лимита — один партнёр положил всех; вебхуку поверили на слово — подарили абонемент. Во второй половине дня — безопасность: кто вы, что вам можно и как не отдать чужую запись.',
    tasks: [taskBreaking, taskRetries, taskRate, taskWebhooks, taskOutbound]
  });
})();
