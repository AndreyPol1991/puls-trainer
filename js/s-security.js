/* Неделя 3, четверг 15:00 — «Безопасность API».
   Аутентификация и авторизация (401/403/404), какой поток OAuth 2.0 кому (и почему PKCE),
   живой перебор чужих записей (BOLA, пентест «Пульса»), лишние поля в PATCH и что не так с JWT. */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc;
  const ID = 'security';

  if (typeof document !== 'undefined' && !document.getElementById('sec-style')) {
    document.head.insertAdjacentHTML('beforeend', `<style id="sec-style">
      .sec-set{display:grid;grid-template-columns:minmax(120px,190px) minmax(0,1fr);gap:8px 12px;align-items:center}
      .sec-set .lbl{font-size:13px;color:var(--text-2);min-width:0}
      .sec-sc{min-width:0;max-width:100%;overflow-x:auto}
      .sec-row-anim{animation:secIn .25s ease-out}
      @keyframes secIn{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}
      .sec-jwt{font:12.5px/1.5 var(--f-mono);word-break:break-all;background:var(--code-bg);border:1px solid var(--border);border-radius:8px;padding:8px 10px}
      .sec-jwt .h{color:var(--bad)} .sec-jwt .p{color:var(--violet)} .sec-jwt .s{color:var(--info)}
      @media (max-width:560px){.sec-set{grid-template-columns:minmax(0,1fr)}}
    </style>`);
  }
  const setRow = (label, name, opts, cur) => `<div class="lbl">${label}</div><div style="min-width:0">${ui.seg(name, opts, cur)}</div>`;
  const stat = (k, v, kind, s) => `<div class="stat"><div class="k">${k}</div><div class="v ${kind || ''}">${v}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`;
  const qScore = (q, v) => ui.quizScore(q, v || []);
  const strip = s => String(s || '').replace(/<[^>]+>/g, '');

  // =====================================================================
  // Подход 1. Кто вы и что вам можно: 401 / 403 / 404
  // =====================================================================
  const AZ_CH = [{ v: '401', t: '401 — кто вы?' }, { v: '403', t: '403 — вам нельзя' }, { v: '404', t: '404 — такого нет' }, { v: '200', t: '200 — всё законно' }];
  const AZ = [
    { id: 'noauth', t: 'Приложение прислало запрос без заголовка <code>Authorization</code>', ok: '401', why: 'Личность не установлена — это вопрос аутентификации. В ответе <code>WWW-Authenticate: Bearer</code>.' },
    { id: 'expired', t: 'Access-токен истёк 2 минуты назад', ok: '401', why: 'Пропуск просрочен — «кто вы?» заново. Приложение по 401 обновит токен через refresh и повторит запрос.' },
    { id: 'forged', t: 'Подпись токена не сходится — в нём подправили <code>sub</code>', ok: '401', why: 'Поддельный пропуск = никакого пропуска. Подробности, что именно не так, наружу не сообщаем.' },
    { id: 'admin', t: 'Клиент вызывает <code>GET /admin/clients</code> — список для администраторов', ok: '403', why: 'Кто он — известно, но роль «клиент» сюда не пускает. Существование админского эндпоинта не секрет.' },
    { id: 'scope', t: 'ФитПасс с токеном <code>scope=schedule:read</code> вызывает <code>POST /partner/v1/bookings</code>', ok: '403', why: 'Партнёр опознан, но разрешения на запись ему не выдали: <code>insufficient_scope</code>.' },
    { id: 'trainer', t: 'Тренер в веб-кабинете пытается удалить абонемент клиента — это может только администратор', ok: '403', why: 'Роль trainer есть, нужной роли admin нет.' },
    { id: 'foreign', t: 'Клиент открывает чужую запись <code>GET /bookings/{id}</code> — id подсмотрел у друга', ok: '404', why: 'Для этого клиента чужой записи «не существует». Ответ 403 подтвердил бы, что запись с таким id есть.' },
    { id: 'missing', t: 'Записи с таким id нет вообще', ok: '404', why: 'Обычный 404. И он должен выглядеть точно так же, как ответ на чужую запись.' },
    { id: 'own', t: 'Клиент с действующим токеном открывает свою запись', ok: '200', why: 'Личность установлена, запись его — всё законно.' }
  ];
  const azReveal = ans => { const m = (ans && ans.m) || {}, r = {}; AZ.forEach(x => { if (m[x.id]) r[x.id] = { s: m[x.id] === x.ok ? 'ok' : 'bad', why: m[x.id] === x.ok ? x.why : '' }; }); return r; };
  const taskAuthz = {
    id: 'authz', title: 'Кто вы и что вам можно',
    simple: {
      icon: '🪪',
      plain: 'Сначала сервер выясняет, кто пришёл (аутентификация), потом — что этому человеку можно (авторизация). Это два разных вопроса и две разные ошибки.',
      analogy: 'На входе в клуб вы прикладываете карту — турникет узнаёт, что вы Анна (аутентификация). В раздевалке ваш ключ открывает только шкафчик № 47 (авторизация). Нет карты — «кто вы?» (401). Карта есть, но вы ломитесь в служебное помещение — «вам нельзя» (403). Чужой шкафчик ваш ключ просто «не видит» — для вас его нет (404).',
      tech: '<code>401 Unauthorized</code> — нет, истёк или поддельный токен (+ <code>WWW-Authenticate</code>). <code>403 Forbidden</code> — личность известна, прав не хватает (роль, scope). <code>404 Not Found</code> — объекта нет или он чужой: не раскрываем, что он существует.'
    },
    lead: ui.brief({
      situation: `Тимур выписал из логов старого сайта девять запросов. На каждый сервер должен ответить кодом — коротким числом, которое приложение понимает без слов. Ошибиться опасно: на «401» приложение выкинет клиента на экран входа, а на «403» покажет «нет доступа». А неверный код может подсказать взломщику, какие записи существуют.`,
      todo: [
        `В каждой строке откройте список «Какой ответ?» и выберите код.`,
        `Засчитывается, если верно не меньше 8 из 9.`
      ],
      lookTitle: 'Как выбирать',
      look: `Задайте два вопроса по очереди, как охранник в клубе. Первый: «Мы знаем, кто это?» — пропуска (токена) нет, он просрочен или поддельный → <b>401</b> «кто вы?». Второй: «Ему сюда можно?» — человек известен, но прав не хватает → <b>403</b> «вам нельзя». <b>404</b> «такого нет» — когда объекта нет или его нельзя даже показывать, что он есть. <b>200</b> — всё законно. Пример правильного ответа 401 — под списком, в «Как выглядит 401 по-хорошему».`
    }),
    blank: () => ({ m: {} }),
    reference: () => ({ m: Object.fromEntries(AZ.map(x => [x.id, x.ok])) }),
    render(el, ctx) {
      ui.match(el, { rows: AZ.map(x => ({ id: x.id, t: x.t })), choices: AZ_CH, value: ctx.ans.m || {}, readonly: ctx.readonly, reveal: ctx.result ? azReveal(ctx.ans) : null, placeholder: 'Какой ответ?', onChange: m => { ctx.ans.m = m; ctx.save(); } });
      el.insertAdjacentHTML('beforeend', `<details class="more" style="margin-top:12px"><summary>Как выглядит 401 по-хорошему</summary><div class="sec-sc">${ui.http({ status: 401, headers: [['WWW-Authenticate', 'Bearer error="invalid_token", error_description="token expired"'], ['Content-Type', 'application/problem+json']], body: { type: 'https://api.puls.fit/problems/unauthorized', title: 'Нужен вход', status: 401 } })}</div></details>`);
    },
    check(ans) {
      const m = (ans && ans.m) || {};
      let good = 0; const notes = [];
      AZ.forEach(x => {
        if (m[x.id] === x.ok) { good++; return; }
        let hint = 'кто это — известно? И если известно, можно ли ему сюда?';
        if (x.ok === '404' && m[x.id] === '403') hint = '403 честно скажет «запись есть, но не ваша». Тот, кто перебирает id, узнает, какие записи существуют. Что ответить, чтобы чужое было неотличимо от несуществующего?';
        else if (x.ok === '401' && m[x.id] === '403') hint = 'сервер вообще знает, кто пришёл? 403 — когда личность установлена, но прав не хватает.';
        else if (x.ok === '403' && m[x.id] === '401') hint = 'личность установлена — токен действующий. Вопрос не «кто вы», а «можно ли вам».';
        else if (x.ok === '403' && m[x.id] === '404') hint = 'скрывать нечего: эндпоинт общий и известен. Прав просто не хватает.';
        notes.push({ ok: false, html: `${x.t}: ${m[x.id] ? hint : 'не выбрано.'}` });
      });
      const s = good / AZ.length;
      return { ok: s >= .88, score: s, summary: `Верно ${good} из ${AZ.length}.`, notes: notes.length ? notes.slice(0, 6) : [{ ok: true, html: 'Все ситуации разобраны верно.' }] };
    },
    explain: `<p><b>Два вопроса — две ошибки.</b> «Кто вы?» — 401: токена нет, он истёк или подделан. «Можно ли вам?» — 403: роль или scope не позволяют. Приложение реагирует по-разному: на 401 обновляет токен или просит войти, на 403 показывает «нет доступа».</p>
      <p><b>Чужой объект — 404, а не 403.</b> Ответ 403 на <code>/bookings/1004</code> значит «запись есть, но не ваша». Перебирая номера, злоумышленник узнаёт, сколько записей в системе и какие id живые. Для клиента чужая запись просто не существует. Так и написано в каноне API «Пульса».</p>
      <p>Где 403 уместен — там, где скрывать нечего: админские эндпоинты, нехватка scope у партнёра, роль тренера вместо администратора.</p>`,
    report: ans => AZ.map(x => `- ${strip(x.t)} → ${(ans.m || {})[x.id] || '—'}${(ans.m || {})[x.id] && (ans.m || {})[x.id] !== x.ok ? ' ✗' : ''}`).join('\n')
  };

  // =====================================================================
  // Подход 2. OAuth 2.0: какой поток кому
  // =====================================================================
  const FL_CH = [
    { v: 'pkce', t: 'Authorization Code + PKCE' }, { v: 'cc', t: 'Client Credentials + scopes' }, { v: 'oidc', t: 'SSO через OpenID Connect' },
    { v: 'mtls', t: 'mTLS — сертификат клуба' }, { v: 'hmac', t: 'Подпись HMAC' }, { v: 'none', t: 'Без входа (публично)' },
    { v: 'basic', t: 'Basic по TLS (логин:секрет магазина)' }, { v: 'apikey', t: 'API-ключ' }, { v: 'implicit', t: 'Implicit' }, { v: 'password', t: 'Password grant (логин и пароль в приложении)' }
  ];
  const FL = [
    { id: 'app', t: 'Мобильное приложение клиента', sub: 'клиент входит по SMS-коду', ok: 'pkce', why: 'Публичный клиент: секрет в приложении не спрятать. PKCE заменяет секрет одноразовой парой verifier/challenge.' },
    { id: 'fitpass', t: 'Бэкенд ФитПасса → Partner API', sub: 'сервер к серверу, без пользователя', ok: 'cc', why: 'Пользователя нет, есть сервер партнёра со своим client_id и секретом. Scopes ограничивают, что ему можно.' },
    { id: 'cabinet', t: 'Веб-кабинет администраторов и тренеров', sub: 'сотрудники «Пульса»', ok: 'oidc', why: 'У сотрудников уже есть корпоративный SSO: вход один раз, роли — из корпоративного каталога, уволенный теряет доступ сразу.' },
    { id: 'turnstile', t: 'Контроллер турникета в клубе', sub: 'железка, gRPC, 300 мс', ok: 'mtls', why: 'Устройство, а не человек. Сертификат клуба проверяется при установке соединения, без лишних запросов за токеном.' },
    { id: 'pspwh', t: 'Вебхук ПэйПоинта к нам', sub: 'POST /webhooks/paypoint', ok: 'hmac', why: 'ПэйПоинт не получает наши токены — он подписывает тело общим секретом. Мы проверяем подпись и время.' },
    { id: 'site', t: 'Сайт с публичным расписанием', sub: 'без входа, до 500 запросов/с', ok: 'none', why: 'Расписание публичное, его отдаёт CDN. Защита здесь — лимиты и кэш, а не вход.' },
    { id: 'topsp', t: 'Наш бэкенд → API ПэйПоинта', sub: 'так требует ПэйПоинт', ok: 'basic', why: 'Чужие правила: ПэйПоинт выдаёт идентификатор магазина и секрет. Обязательно поверх TLS, секрет — в хранилище секретов.' },
    { id: 'sms', t: 'Наш бэкенд → SMS-шлюз', sub: 'так требует шлюз', ok: 'apikey', why: 'Шлюз принимает API-ключ в заголовке. Ключ живёт в хранилище секретов и регулярно меняется.' }
  ];
  const Q_FLOW = {
    q: 'Почему для мобильного приложения не годятся Implicit и Password grant? Выберите все верные причины.',
    multi: true,
    options: [
      { t: 'Implicit отдаёт токен прямо в адресе редиректа — он оседает в истории, логах и у перехватчика. Поток признан устаревшим', ok: 1, why: 'OAuth 2.0 Security Best Current Practice прямо запрещает Implicit. В OAuth 2.1 его нет.' },
      { t: 'Password grant приучает вводить учётные данные прямо в приложении и не поддерживает вход по SMS-коду, второй фактор, SSO', ok: 1, why: 'Тоже устарел и исключён из OAuth 2.1. Вход должен жить на сервере авторизации.' },
      { t: 'В приложении нельзя хранить <code>client_secret</code> — его вытащат из сборки. PKCE заменяет секрет одноразовой парой', ok: 1, why: 'Код из перехваченного редиректа бесполезен без <code>code_verifier</code>, который не покидал телефон.' },
      { t: 'Implicit медленнее: лишний запрос за токеном', why: 'Наоборот, Implicit на один запрос короче. Отказались от него не из-за скорости, а из-за утечки токена.' },
      { t: 'Password grant запрещён законом о персональных данных', why: 'Закон тут ни при чём. Причина — безопасность и невозможность нормального входа.' }
    ]
  };
  function pkceSteps(on) {
    const S = (from, to, t, kind, x) => Object.assign({ from, to, t, kind: kind || '' }, x || {});
    const s = [
      S('app', 'app', on ? 'code_verifier = случайные 43+ символа\ncode_challenge = SHA-256(verifier)' : 'PKCE нет: просто открываем вход', on ? 'info' : '', { note: on ? 'Verifier остаётся в телефоне. Наружу уходит только его хэш.' : 'Без PKCE код авторизации — как ключ на предъявителя: кто принёс, тот и получил токены.' }),
      S('app', 'auth', on ? '/authorize?…&code_challenge=…' : '/authorize?client_id=puls-app…'),
      S('auth', 'auth', 'клиент ввёл SMS-код ✓', 'ok'),
      S('auth', 'app', 'redirect puls://cb?code=K7f…', '', { reply: true }),
      S('auth', 'evil', 'тот же redirect перехвачен', 'warn', { note: 'Чужое приложение зарегистрировало ту же схему puls:// и получило код.' }),
      S('evil', 'auth', 'POST /token code=K7f…', 'warn')
    ];
    if (on) {
      s.push(S('auth', 'evil', '400 invalid_grant: нет verifier', 'ok', { reply: true, note: 'Сервер считает SHA-256 от присланного verifier и сравнивает с challenge. Verifier-а у вора нет.' }),
        S('app', 'auth', 'POST /token code + code_verifier'), S('auth', 'app', 'access 15 мин + refresh', 'ok', { reply: true }),
        S('app', 'api', 'GET /me/bookings · Bearer …', 'ok'),
        S('app', 'api', 'Итог: код без verifier бесполезен — токены только у Анны', 'ok', { box: true }));
    } else {
      s.push(S('auth', 'evil', 'access + refresh токены', 'bad', { reply: true }),
        S('evil', 'api', 'GET /me/bookings · чужой токен', 'bad', { note: 'Чужое приложение видит записи, абонемент и может записывать от имени Анны.' }),
        S('app', 'auth', 'POST /token code=K7f…'), S('auth', 'app', '400: код уже использован', 'bad', { reply: true }),
        S('app', 'api', 'Итог: токены у вора, Анна видит «ошибку входа»', 'bad', { box: true }));
    }
    return s;
  }
  const taskOauth = {
    id: 'oauth', title: 'OAuth 2.0: какой поток кому',
    simple: {
      icon: '🔑',
      plain: 'OAuth 2.0 — способ выдать программе временный пропуск с ограниченными правами, не отдавая ей ваш пароль. Для разных «программ» — разные способы получить пропуск.',
      analogy: 'Гостевой браслет в клубе: администратор выдаёт его по паспорту, браслет пускает только в бассейн и только до 22:00. Клиенту — браслет после проверки на ресепшене (Authorization Code). Партнёру — договор и пропуск для курьера (Client Credentials). Сотрудникам — корпоративный бейдж (SSO). Турникету — пломба и сертификат от производителя (mTLS).',
      tech: 'Authorization Code + PKCE — для приложений с пользователем (мобильное, SPA). Client Credentials — сервер к серверу, права через scopes. OpenID Connect поверх OAuth — вход сотрудников через SSO. mTLS — взаимная проверка сертификатов для устройств. Вебхуки — подпись HMAC. Implicit и Password grant устарели (OAuth 2.0 Security BCP, OAuth 2.1).'
    },
    lead: ui.brief({
      situation: `В «Пульс» входят очень разные «гости»: Анна с телефона, сервер ФитПасса, тренер в веб-кабинете, турникет в клубе, платёжный сервис со своими уведомлениями. Пароль Анны нельзя давать никому из них. Каждый должен получить свой временный пропуск (<b>токен</b>), и способ его выдачи у каждого свой.`,
      todo: [
        `Сначала посмотрите опыт с перехватом. Переключите «Вход в приложение»: «с PKCE» и «без PKCE». Схема проиграется сама.`,
        `Для каждого из 8 участников выберите в списке «Как входит?» подходящий способ.`,
        `Ответьте на вопрос, почему старые способы входа не годятся для приложения. Ответов несколько.`,
        `Засчитывается, если верно 7 из 8 участников и вопрос решён полностью.`
      ],
      lookTitle: 'Как читать схему',
      look: `Четыре колонки: приложение «Пульса», чужое приложение на том же телефоне, сервер входа, API «Пульса». Стрелки идут сверху вниз по времени. После SMS-кода сервер входа даёт приложению одноразовый <b>код</b>, а приложение меняет его на токен. Чужое приложение умеет подсмотреть этот код. <b>PKCE</b> — это как номерок в гардеробе: Анна заранее загадала секрет и показала серверу только его «отпечаток». Без самого секрета код не обменять. Красные шаги — вор получил токен, зелёные — сервер ему отказал.`
    }),
    blank: () => ({ m: {}, q: [] }),
    reference: () => ({ m: Object.fromEntries(FL.map(x => [x.id, x.ok])), q: [0, 1, 2] }),
    render(el, ctx) {
      const lab = document.createElement('div'); lab.className = 'card flat'; el.appendChild(lab);
      let on = true;
      lab.innerHTML = `<div class="sec-set">${setRow('Вход в приложение', 'pkce', [{ v: '1', t: 'с PKCE' }, { v: '0', t: 'без PKCE' }], '1')}</div><div data-seq></div>`;
      const lanes = [{ id: 'app', t: 'Приложение «Пульса»', sub: 'телефон Анны' }, { id: 'evil', t: 'Чужое приложение', sub: 'на том же телефоне' }, { id: 'auth', t: 'Сервер входа', sub: 'auth.puls.fit' }, { id: 'api', t: 'API «Пульса»', sub: 'api.puls.fit/v1' }];
      const seq = ui.seq(TR.$('[data-seq]', lab), { lanes, steps: pkceSteps(true), start: 'all', laneW: 170, speed: 900, title: 'Вход в приложение: Authorization Code + PKCE' });
      ui.onSeg(lab, (n, v) => { on = v === '1'; seq.set(pkceSteps(on), { play: !ctx.readonly, all: !!ctx.readonly }); });
      const m = document.createElement('div'); m.style.marginTop = '14px'; el.appendChild(m);
      const rv = ctx.result ? (() => { const r = {}, a = ctx.ans.m || {}; FL.forEach(x => { if (a[x.id]) r[x.id] = { s: a[x.id] === x.ok ? 'ok' : 'bad', why: a[x.id] === x.ok ? x.why : '' }; }); return r; })() : null;
      ui.match(m, { rows: FL.map(x => ({ id: x.id, t: x.t, sub: x.sub })), choices: FL_CH, value: ctx.ans.m || {}, readonly: ctx.readonly, reveal: rv, placeholder: 'Как входит?', onChange: v => { ctx.ans.m = v; ctx.save(); if (v.app) ctx.decide('Вход мобильного приложения', (FL_CH.find(c => c.v === v.app) || {}).t || v.app); } });
      const q = document.createElement('div'); q.style.marginTop = '14px'; el.appendChild(q);
      ui.quiz(q, Object.assign({}, Q_FLOW, { value: ctx.ans.q || [], readonly: ctx.readonly, reveal: ctx.result, seed: 'sec-flow', onChange: v => { ctx.ans.q = v; ctx.save(); } }));
    },
    check(ans) {
      const m = (ans && ans.m) || {};
      let good = 0; const notes = [];
      FL.forEach(x => {
        if (m[x.id] === x.ok) { good++; return; }
        let h = 'кто здесь входит: человек, сервер партнёра, устройство или внешняя система с чужими правилами?';
        if (m[x.id] === 'implicit' || m[x.id] === 'password') h = 'этот поток устарел и запрещён рекомендациями по безопасности OAuth.';
        else if (x.id === 'app' && m[x.id] === 'cc') h = 'Client Credentials требует секрет, а секрет в приложении не спрятать: его достанут из сборки.';
        else if (x.id === 'topsp' || x.id === 'sms') h = 'это чужой API — способ входа диктует он, а не мы. Что говорил Тимур?';
        else if (x.id === 'pspwh') h = 'ПэйПоинт не ходит за нашими токенами. Как он доказывает, что письмо от него?';
        notes.push({ ok: false, html: `${x.t}: ${m[x.id] ? h : 'не выбрано.'}` });
      });
      const ms = good / FL.length, q = qScore(Q_FLOW, ans && ans.q);
      if (!(q.score >= .99)) notes.push({ ok: false, html: 'Почему не старые потоки: подумайте, где оказывается токен в Implicit, кто видит пароль в Password grant и где хранить секрет в приложении.' });
      return { ok: ms >= .87 && q.ok, score: .7 * ms + .3 * q.score, summary: `Способы входа: ${good} из ${FL.length} · вопрос про старые потоки: ${Math.round(q.score * 100)} %.`, notes: notes.length ? notes.slice(0, 7) : [{ ok: true, html: 'Все способы входа подобраны верно.' }] };
    },
    explain: `<p><b>Главный вопрос — кто входит и может ли он хранить секрет.</b> Сервер ФитПасса может (Client Credentials). Приложение на телефоне — нет: секрет вытащат из сборки. Поэтому Authorization Code + PKCE: код, перехваченный по дороге, бесполезен без <code>code_verifier</code>, который не покидал телефон.</p>
      <p><b>Сотрудникам — SSO</b> через OpenID Connect: они уже есть в корпоративном каталоге, роли admin/trainer берутся оттуда, уволенный теряет доступ сразу. <b>Турникету — mTLS</b>: устройство с сертификатом клуба, проверка при соединении, без лишних запросов в 300 мс.</p>
      <p><b>Где правила чужие</b> — ПэйПоинт (Basic по TLS), SMS-шлюз (API-ключ) — подчиняемся им, а секреты держим в хранилище секретов, не в коде и не в конфиге в git. <b>Вебхуки</b> — подпись HMAC.</p>
      <p>Токены приложения: access 15 минут (JWT), refresh — дольше, с ротацией и возможностью отозвать. Этого требует канон «Пульса».</p>`,
    report: ans => FL.map(x => `- ${x.t} → ${((FL_CH.find(c => c.v === (ans.m || {})[x.id]) || {}).t) || '—'}${(ans.m || {})[x.id] && (ans.m || {})[x.id] !== x.ok ? ' ✗' : ''}`).join('\n') + `\n- Почему не Implicit/Password: ${Math.round(qScore(Q_FLOW, ans.q).score * 100)} %`
  };

  // =====================================================================
  // Подход 3. Чужая запись (BOLA)
  // =====================================================================
  const BK = [
    { id: 1001, who: 'Пётр Орлов', phone: '+7 925 222-33-44', cls: 'Сайкл, пн 19:00' },
    { id: 1002, who: 'Ирина Котова', phone: '+7 916 404-12-90', cls: 'Пилатес, пн 10:00' },
    { id: 1003, who: 'Анна Смирнова', phone: '+7 916 111-22-33', cls: 'Йога, пн 09:00', mine: true },
    { id: 1004, who: 'Олег Тихонов', phone: '+7 903 777-15-15', cls: 'Бассейн, пн 07:00' },
    { id: 1005, gone: true },
    { id: 1006, who: 'Анна Смирнова', phone: '+7 916 111-22-33', cls: 'Сайкл, ср 19:00', mine: true },
    { id: 1007, who: 'Светлана Воронина', phone: '+7 926 330-41-08', cls: 'Йога, ср 09:00' },
    { id: 1008, gone: true }
  ];
  const SRV = [
    { v: 'none', t: 'v1 · без проверки владельца', sql: 'SELECT * FROM booking\n WHERE id = $1   -- id из адреса' },
    { v: '403', t: 'v2 · проверка, но 403', sql: 'SELECT * FROM booking WHERE id = $1;\n-- потом в коде: if (b.client_id != me) return 403' },
    { v: 'safe', t: 'v3 · владелец в запросе + 404 + uuid', sql: 'SELECT b.* FROM booking b\n WHERE b.public_id = $1          -- uuid из адреса\n   AND b.client_id = $2          -- id из токена, не из запроса\n-- не нашли → 404, чужое или несуществующее — неважно' }
  ];
  function bolaRow(srv, b) {
    if (srv === 'safe') return { code: 404, kind: 'ok', res: 'не найдено', leak: false, exists: false };
    if (b.gone) return { code: 404, kind: '', res: 'не найдено', leak: false, exists: false };
    if (b.mine) return { code: 200, kind: 'ok', res: `своя: ${b.cls}`, leak: false, exists: true, mine: true };
    if (srv === 'none') return { code: 200, kind: 'bad', res: `${b.who}, ${b.phone}, ${b.cls}`, leak: true, exists: true };
    return { code: 403, kind: 'warn', res: 'запрет — значит, запись существует', leak: false, exists: true };
  }
  const Q_UUID = {
    q: 'Тимур предлагает: «Давайте просто сделаем в адресе uuid вместо 1001, 1002… — подобрать будет невозможно». Этого достаточно?',
    options: [
      { t: 'Да: uuid не угадать, значит, и проверка владельца не нужна', why: 'Угадать нельзя, а узнать можно: uuid утекают через ссылки «поделиться», скриншоты, логи, выгрузки партнёрам. Чужой uuid без проверки владельца — та же утечка.' },
      { t: 'Нет: uuid затрудняет перебор, но защищает проверка владельца — <code>WHERE client_id</code> из токена. Uuid — второй слой', ok: 1, why: 'Именно. Uuid прячет, сколько у вас записей, и делает перебор бессмысленным. А доступ решает только проверка владельца на каждом запросе.' },
      { t: 'Uuid вообще бесполезны, хватит проверки владельца', why: 'Проверка — главное. Но последовательные id раскрывают объёмы бизнеса и упрощают атаку, если проверку где-то забудут. Uuid наружу — дешёвая страховка.' }
    ]
  };
  const BOLA_RUBRIC = [
    'Владелец берётся из токена (<code>sub</code>), никогда из тела или адреса запроса',
    'Проверка владельца — в самом запросе к БД: <code>WHERE public_id = $1 AND client_id = $2</code>',
    'Чужое и несуществующее — одинаковый ответ 404, без подсказок в тексте',
    'Наружу — только <code>public_id</code> (uuid); внутренние числовые id в API не показываем',
    'Автотест на каждый эндпоинт с id: «токен клиента Б к объекту клиента А → 404»',
    'Мониторинг: много 404 подряд от одного клиента — алерт и лимит частоты'
  ];
  const BOLA_REF = 'Требование: для всех эндпоинтов с идентификатором объекта (<code>/bookings/{id}</code>, <code>/memberships/{id}</code>, <code>/payments/{id}</code>) владелец берётся только из токена (<code>sub</code>), а не из запроса. Проверка встроена в запрос к БД: <code>WHERE public_id = $1 AND client_id = $2</code>. Не нашли — 404, и он одинаков для чужого и несуществующего объекта. Наружу отдаём только <code>public_id</code> (uuid), внутренние bigint не показываем. На каждый такой эндпоинт — автотест «чужой токен → 404». В мониторинге — алерт, если один клиент получает много 404 подряд.';
  const taskBola = {
    id: 'bola', title: 'Чужая запись',
    simple: {
      icon: '🕵️',
      plain: 'Самая частая дыра в API: сервер проверяет, что вы вошли, но не проверяет, что объект ваш. Меняете номер в адресе — видите чужое.',
      analogy: 'Раздевалка, где ключ подходит к любому шкафчику: охранник проверил карту на входе, а дальше — открывай любой. Именно это нашёл пентест на старом сайте «Пульса»: поменяли номер записи в адресе — открылась чужая, с именем и телефоном.',
      tech: 'BOLA (Broken Object Level Authorization) — №1 в OWASP API Security Top 10 (2023). Лечится проверкой владельца на каждом обращении к объекту: <code>WHERE client_id = :id_из_токена</code>. Чужое и несуществующее — одинаковый 404. Последовательные id в адресе облегчают перебор; uuid наружу — второй слой защиты, но не замена проверки.'
    },
    lead: ui.brief({
      situation: `Вы — клиентка Анна Смирнова. Вы вошли в приложение, у вас две свои записи: 1003 и 1006. Ваша запись открывается по адресу <code>/v1/bookings/1003</code>. А что если поменять число на 1001? Именно так пентестер (нанятый «взломщик» для проверки) нашёл дыру в старом сайте «Пульса»: он видел чужие имена, телефоны и занятия.`,
      todo: [
        `Выберите «Версия сервера» и нажмите «▶ Перебрать 1001…1008». Прогоните все три версии: v1, v2, v3.`,
        `Ответьте на вопрос Тимура про uuid.`,
        `Напишите требование для разработчиков (от 100 знаков) и сверьте его с Верой или с эталоном.`,
        `Засчитывается, когда прогнаны все три версии, вопрос решён и требование покрывает от 60 % пунктов.`
      ],
      lookTitle: 'Как читать опыт',
      look: `Под переключателем — как версия сервера ищет запись в базе (SQL). <code>$1</code> — номер из адреса, <code>$2</code> — кто вошёл (из токена). Таблица заполняется по строке на каждый номер: какой запрос, какой код вернул сервер, что увидела Анна. Плитки внизу считают ущерб. «Утечки» — Анна увидела чужие данные. «Раскрыто, что запись есть» — данных не видно, но по ответу понятно, что такой номер существует. <b>uuid</b> — длинный случайный номер вроде <code>9e2d7a10-3c4b-…</code> вместо 1001.`
    }),
    blank: () => ({ srv: 'none', seen: {}, q: [], j: {} }),
    reference: () => ({ srv: 'safe', seen: { none: true, '403': true, safe: true }, q: [1], j: { text: strip(BOLA_REF), self: BOLA_RUBRIC.map(() => true) } }),
    render(el, ctx) {
      const a = ctx.ans; a.seen = a.seen || {}; a.srv = a.srv || 'none';
      const lab = document.createElement('div'); lab.className = 'stack'; el.appendChild(lab);
      let runId = 0, shown = ctx.readonly ? BK.length : (a.seen[a.srv] ? BK.length : 0);
      const draw = () => {
        const srv = SRV.find(x => x.v === a.srv) || SRV[0];
        const rows = BK.slice(0, shown).map(b => ({ b, r: bolaRow(a.srv, b) }));
        const leaks = rows.filter(x => x.r.leak).length, exist = rows.filter(x => x.r.exists && !x.r.mine).length;
        const path = b => a.srv === 'safe' ? `/v1/bookings/${b.id}` : `/v1/bookings/${b.id}`;
        lab.innerHTML = `
          <div class="card flat"><div class="sec-set">${setRow('Версия сервера', 'srv', SRV.map(x => ({ v: x.v, t: x.t })), a.srv)}</div>
            ${ui.code(srv.sql, 'sql')}
            ${ctx.readonly ? '' : `<div class="row"><button type="button" class="btn sm primary" data-run>▶ Перебрать 1001…1008</button><span class="small dim">Прогнано версий: ${Object.keys(a.seen).filter(k => a.seen[k]).length} из 3</span></div>`}</div>
          ${ui.table(['Запрос', 'Ответ', 'Что увидела Анна'], rows.map(x => [`<span class="mono">${ui.mth('GET')} ${esc(path(x.b))}</span>`, ui.st(x.r.code), `<span class="${x.r.leak ? '' : 'dim'}">${esc(x.r.res)}</span>`]), { rowClass: (r, i) => rows[i].r.leak ? 'bad' : rows[i].r.mine ? 'ok' : '' })}
          ${a.srv === 'safe' && shown >= BK.length ? ui.note('', 'А как Анна видит свои записи?', 'Через <code>GET /v1/me/bookings</code> — там у записей uuid, например <code>/v1/bookings/9e2d7a10-3c4b-…</code>. Числовые id сервер наружу не принимает и не показывает. А если чужой uuid утечёт со скриншота — проверка владельца в запросе всё равно ответит 404.') : ''}
          <div class="grid3">
            ${stat('Утечки чужих данных', String(leaks), leaks ? 'bad' : 'ok', 'имя, телефон, занятие')}
            ${stat('Раскрыто, что запись есть', String(exist), exist ? 'warn' : 'ok', 'чужие id, которые точно существуют')}
            ${stat('Проверено адресов', `${shown} / ${BK.length}`, '', '')}
          </div>`;
      };
      ui.onSeg(lab, (n, v) => { if (ctx.readonly) return; runId++; a.srv = v; ctx.ans.srv = v; ctx.save(); shown = a.seen[v] ? BK.length : 0; draw(); });
      TR.on(lab, 'click', '[data-run]', async () => {
        const my = ++runId; shown = 0; draw();
        for (let i = 1; i <= BK.length; i++) { await TR.sleep(220); if (my !== runId || !lab.isConnected) return; shown = i; draw(); }
        ctx.ans.seen = Object.assign({}, ctx.ans.seen, { [a.srv]: true }); a.seen = ctx.ans.seen; ctx.save();
        ctx.decide('BOLA: прогнаны версии', Object.keys(a.seen).join(', '));
        draw();
      });
      draw();
      const q = document.createElement('div'); q.style.marginTop = '14px'; el.appendChild(q);
      ui.quiz(q, Object.assign({}, Q_UUID, { value: a.q || [], readonly: ctx.readonly, reveal: ctx.result, seed: 'sec-uuid', onChange: v => { ctx.ans.q = v; ctx.save(); } }));
      const j = document.createElement('div'); j.style.marginTop = '14px'; el.appendChild(j);
      ui.justify(j, {
        id: 'sec-bola', q: 'Требование для разработчиков: как сделать, чтобы история пентеста не повторилась?', rubric: BOLA_RUBRIC, reference: BOLA_REF,
        value: a.j, readonly: ctx.readonly, minLen: 100, onChange: v => { ctx.ans.j = v; ctx.save(); ctx.decide('Требование против BOLA', v.text || ''); }
      });
    },
    check(ans) {
      const seen = (ans && ans.seen) || {}, n = ['none', '403', 'safe'].filter(k => seen[k]).length;
      const q = qScore(Q_UUID, ans && ans.q), j = ui.justifyScore(ans && ans.j);
      const notes = [];
      if (n < 3) notes.push({ ok: false, html: `Прогнано версий сервера: ${n} из 3. ${!seen['403'] ? 'Обязательно посмотрите v2: утечек нет, но кое-что всё равно утекает.' : !seen.safe ? 'Посмотрите v3: чем её ответы отличаются от v2?' : 'Посмотрите v1 — так было на старом сайте.'}` });
      else notes.push({ ok: true, html: 'Все три версии сервера прогнаны.' });
      if (!q.ok) notes.push({ ok: false, html: 'Uuid: подумайте, можно ли узнать чужой uuid, не угадывая его. И что тогда остановит доступ?' });
      if (j < .6) notes.push({ ok: false, html: j ? 'Требование неполное: откуда берётся владелец, где проверка, какой ответ на чужое, как это проверять тестами и мониторингом?' : 'Напишите требование для разработчиков (от 100 символов) и сверьте с эталоном.' });
      const score = .4 * n / 3 + .3 * q.score + .3 * Math.min(1, j / .6);
      return { ok: n === 3 && q.ok && j >= .6, score: Math.min(1, score), summary: `Версий прогнано: ${n}/3 · вопрос про uuid: ${q.ok ? 'верно' : 'нет'} · требование: ${Math.round(j * 100)} %.`, notes };
    },
    explain: `<p><b>v1 — дыра из пентеста.</b> Сервер проверил токен («вы вошли»), но взял запись по номеру из адреса, не спросив, чья она. Перебор восьми номеров — четыре чужих имени и телефона.</p>
      <p><b>v2 — лучше, но не всё.</b> Данных не видно, но 403 на 1001, 1002, 1004, 1007 и 404 на 1005, 1008 рассказывают, какие записи существуют и сколько их. Для конкурента это объём бизнеса, для злоумышленника — список целей.</p>
      <p><b>v3 — эталон «Пульса».</b> Владелец — в самом запросе к базе (<code>AND client_id = $2</code>, значение из токена). Не нашли — 404, неважно почему. Наружу — <code>public_id</code> (uuid), числовой <code>id</code> живёт только внутри. Проверку не «забудешь» в одном месте: она часть запроса, а не отдельный if где-то ниже.</p>
      <p>Как не допустить снова: автотест «чужой токен → 404» на каждый эндпоинт с id, ревью по чек-листу OWASP API Top 10, алерт на серии 404 от одного клиента.</p>`,
    report(ans) {
      return `- Прогнаны версии: ${Object.keys(ans.seen || {}).filter(k => (ans.seen || {})[k]).join(', ') || '—'}\n- Uuid вместо id: ${qScore(Q_UUID, ans.q).ok ? 'верно (второй слой, не замена проверки)' : 'неверно'}\n- Требование: ${(ans.j && ans.j.text) || '—'}`;
    }
  };

  // =====================================================================
  // Подход 4. Лишние поля и JWT
  // =====================================================================
  const MA = [
    { v: 'copy', t: 'копирует все поля из запроса' },
    { v: 'ignore', t: 'DTO: берёт только email и fullName' },
    { v: 'strict', t: 'DTO + 422 на лишние поля' }
  ];
  const Q_JWT = {
    q: 'Это access-токен из старого прототипа приложения (выше — расшифровка). Найдите все проблемы.',
    multi: true,
    options: [
      { t: '<code>"alg": "none"</code> — токен без подписи', ok: 1, why: 'Такой токен может «выпустить» кто угодно. Сервер обязан принимать только ожидаемый алгоритм (например, RS256 или ES256) и отвергать none.' },
      { t: '<code>exp</code> через 30 дней после <code>iat</code>', ok: 1, why: 'Украденный access-токен работает месяц, и отозвать его нельзя. Access — 15 минут; долго живёт только refresh, и его можно отозвать.' },
      { t: 'Телефон и ФИО в payload', ok: 1, why: 'JWT не шифруется: payload — это base64, его прочитает любой, кто увидит токен в логах, прокси, отладчике. Персональным данным там не место.' },
      { t: '<code>sub</code> — uuid клиента, а не номер телефона', why: 'Это правильно: uuid ничего не говорит о человеке и не меняется при смене номера.' },
      { t: 'В токене есть <code>scope</code>', why: 'Нормально: scope говорит, что этому токену можно.' },
      { t: '<code>aud</code> указывает на <code>api.puls.fit</code>', why: 'Правильно: токен для API «Пульса» не примет другой сервис.' }
    ]
  };
  const JWT_H = { alg: 'none', typ: 'JWT' };
  const JWT_P = { iss: 'https://auth.puls.fit', sub: '8c2f6b1e-4d7a-4a3e-9f10-5b6c7d8e9f01', aud: 'api.puls.fit', scope: 'bookings:write memberships:read', phone: '+79161112233', fullName: 'Анна Смирнова', iat: 1791100800, exp: 1793692800 };
  const b64 = o => { try { return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); } catch (e) { return 'eyJ…'; } };
  const taskMass = {
    id: 'mass', title: 'Лишние поля и JWT',
    simple: {
      icon: '📝',
      plain: 'Клиент меняет в профиле почту — и заодно дописывает в запрос «я администратор». Если сервер бездумно копирует все поля, он так и запишет.',
      analogy: 'Анкета на ресепшене: клиент исправляет телефон, а в поле «скидка» мелко дописывает «100 %». Администратор, который переносит в базу всё подряд, выдаст бесплатный абонемент. Нормальный администратор переносит только то, что клиенту разрешено менять.',
      tech: 'Mass assignment (OWASP API3:2023 — Broken Object Property Level Authorization): автоматическое связывание тела запроса с сущностью. Лечится DTO — отдельным классом входных данных с белым списком полей. Лишние поля игнорируются или дают 422. Отдельно — JWT: подписанный, но не зашифрованный пропуск; внутри только то, что не страшно показать.'
    },
    lead: ui.brief({
      situation: `Анна меняет в профиле почту. Приложение шлёт запрос <code>PATCH /v1/me</code> — «поправь мои данные». Анна хитрая: в тот же запрос она дописала <code>"role": "admin"</code> («я администратор») и <code>"partnerId": 7</code>. Дальше — токен из старого прототипа приложения: в нём тоже есть ошибки.`,
      todo: [
        `Переключайте «Сервер» и смотрите, что окажется в базе после запроса.`,
        `Оставьте версию, при которой Анна не получает лишних прав.`,
        `Найдите все проблемы в токене. Ответов несколько, лишние отметки снижают балл.`,
        `Засчитывается, когда сервер не копирует всё подряд и все проблемы токена найдены.`
      ],
      lookTitle: 'На что смотреть',
      look: `Слева — запрос Анны и ответ сервера. Справа — строка о клиенте в базе после запроса: зелёным подсвечено разрешённое изменение, красным — то, что Анна не имела права менять. <b>DTO</b> — короткий бланк «что можно менять»: сервер берёт из запроса только поля из бланка. Ниже — <b>JWT</b>, пропуск-токен. Он как браслет в клубе с надписью «Анна, бассейн, до 22:00» и пломбой. Пломба (подпись) мешает подделать надпись, но прочитать её может любой. Смотрите: есть ли пломба, сколько живёт браслет и что лишнего на нём написано.`
    }),
    blank: () => ({ srv: 'copy', q: [] }),
    reference: () => ({ srv: 'strict', q: [0, 1, 2] }),
    render(el, ctx) {
      const a = ctx.ans; a.srv = a.srv || 'copy';
      const box = document.createElement('div'); box.className = 'stack'; el.appendChild(box);
      const req = { email: 'anna@mail.ru', role: 'admin', partnerId: 7 };
      const draw = () => {
        const before = { id: '8c2f6b1e-…', phone: '+79161112233', email: null, role: 'client', partnerId: null };
        let after, resp;
        if (a.srv === 'copy') { after = Object.assign({}, before, req); resp = { status: 200, body: { id: '8c2f6b1e-…', email: 'anna@mail.ru', role: 'admin' } }; }
        else if (a.srv === 'ignore') { after = Object.assign({}, before, { email: req.email }); resp = { status: 200, body: { id: '8c2f6b1e-…', email: 'anna@mail.ru' } }; }
        else { after = before; resp = { status: 422, headers: [['Content-Type', 'application/problem+json']], body: { type: 'https://api.puls.fit/problems/unknown-fields', title: 'Эти поля менять нельзя', status: 422, invalidFields: ['role', 'partnerId'] } }; }
        const lines = Object.keys(after).map(k => {
          const changed = JSON.stringify(after[k]) !== JSON.stringify(before[k]);
          const bad = changed && (k === 'role' || k === 'partnerId');
          const val = `  "${k}": ${JSON.stringify(after[k])}`;
          return bad ? `[[bad]]${val}[[/]]` : changed ? `[[ok]]${val}[[/]]` : val;
        }).join(',\n');
        box.innerHTML = `
          <div class="card flat"><div class="sec-set">${setRow('Сервер', 'srv', MA, a.srv)}</div>
          ${a.srv === 'copy' ? ui.code('client.merge(requestBody);   // все поля тела → в сущность\nrepository.save(client);', 'js', 'как написан обработчик') : ui.code('record UpdateMeRequest(String email, String fullName) {}   // белый список\nclient.setEmail(req.email());' + (a.srv === 'strict' ? '\n// неизвестные поля → 422 (FAIL_ON_UNKNOWN_PROPERTIES)' : '\n// неизвестные поля молча пропускаются'), 'js', 'как написан обработчик')}</div>
          <div class="grid2" style="align-items:start">
            <div class="sec-sc">${ui.http({ method: 'PATCH', path: '/v1/me', headers: [['Content-Type', 'application/merge-patch+json'], ['If-Match', '"v7"']], body: req })}${ui.http(resp)}</div>
            <div class="sec-sc">${ui.code('{\n' + lines + '\n}', 'json', 'строка client в базе после запроса')}
            ${a.srv === 'copy' ? ui.note('bad', 'Анна стала администратором', 'Следующим запросом она откроет <code>/admin/clients</code> — и 403 из прошлого подхода больше не спасёт.') : a.srv === 'ignore' ? ui.note('ok', 'Права не изменились', 'Почта обновлена, лишнее молча проигнорировано.') : ui.note('ok', 'Права не изменились', 'Запрос отклонён целиком, клиенту понятно, какие поля лишние.')}</div>
          </div>`;
      };
      ui.onSeg(box, (n, v) => { if (ctx.readonly) return; a.srv = v; ctx.ans.srv = v; ctx.save(); ctx.decide('PATCH /me: версия сервера', (MA.find(x => x.v === v) || {}).t || v); draw(); });
      draw();
      const jwt = document.createElement('div'); jwt.className = 'stack'; jwt.style.marginTop = '16px'; el.appendChild(jwt);
      jwt.innerHTML = `<div class="eyebrow">Токен из старого прототипа</div>
        <div class="sec-jwt"><span class="h">${b64(JWT_H)}</span>.<span class="p">${b64(JWT_P)}</span>.<span class="s"></span></div>
        <div class="small dim">Три части через точку: заголовок, данные, подпись. Первые две — просто base64, их расшифрует любой. Подписи здесь нет — после второй точки пусто.</div>
        <div class="grid2" style="align-items:start"><div>${ui.code(JSON.stringify(JWT_H, null, 2), 'json', 'заголовок')}</div><div>${ui.code(JSON.stringify(JWT_P, null, 2), 'json', 'данные (payload)')}<div class="small dim">iat — 4 окт 2026, 11:00 МСК; exp — 3 ноя 2026, 11:00 МСК</div></div></div>`;
      const q = document.createElement('div'); el.appendChild(q);
      ui.quiz(q, Object.assign({}, Q_JWT, { value: a.q || [], readonly: ctx.readonly, reveal: ctx.result, seed: 'sec-jwt', onChange: v => { ctx.ans.q = v; ctx.save(); } }));
    },
    check(ans) {
      const srv = (ans && ans.srv) || 'copy', q = qScore(Q_JWT, ans && ans.q);
      const notes = [];
      if (srv === 'copy') notes.push({ ok: false, html: 'Сервер, который копирует все поля, только что сделал клиента администратором. Как ограничить, какие поля клиент вообще может прислать?' });
      else if (srv === 'ignore') notes.push({ ok: true, html: 'DTO с белым списком полей — права не меняются. Вариант с 422 чуть лучше: клиент сразу видит, что прислал лишнее, а попытки подменить роль заметны в логах.' });
      else notes.push({ ok: true, html: 'DTO + 422: права не меняются, лишнее видно сразу.' });
      const sel = new Set((ans && ans.q) || []);
      const missed = Q_JWT.options.filter((o, i) => o.ok && !sel.has(i)).length, extra = Q_JWT.options.filter((o, i) => !o.ok && sel.has(i)).length;
      if (missed) notes.push({ ok: false, html: `В токене пропущено проблем: ${missed}. Посмотрите на заголовок, на разницу между iat и exp и на то, что лежит в данных.` });
      if (extra) notes.push({ ok: 'warn', html: `Отмечено лишнее: ${extra}. Не всё необычное — проблема: какие поля как раз и должны быть в токене?` });
      const sScore = srv === 'copy' ? 0 : 1;
      return { ok: sScore === 1 && q.ok, score: .4 * sScore + .6 * q.score, summary: `Сервер: ${(MA.find(x => x.v === srv) || {}).t} · токен: ${Math.round(q.score * 100)} %.`, notes };
    },
    explain: `<p><b>Mass assignment</b> — когда фреймворк сам раскладывает JSON по полям сущности. Удобно, пока клиент не пришлёт поле, которого нет на экране. Лечение — DTO: отдельный класс входных данных с белым списком. В каноне «Пульса»: в <code>PATCH /me</code> поля <code>role</code> и <code>partnerId</code> игнорируются или запрещены. Роль меняет только администратор через свой эндпоинт с проверкой роли.</p>
      <p><b>JWT</b> — подписанный, но не зашифрованный пропуск. Подпись гарантирует, что его не подделали; прочитать его может любой. Поэтому:</p>
      <ul class="checks"><li>алгоритм подписи фиксирован на сервере, <code>none</code> не принимаем никогда;</li><li>access живёт 15 минут, refresh — дольше, с ротацией и отзывом;</li><li>в payload — <code>sub</code> (uuid), <code>aud</code>, <code>scope</code>, роли; никаких телефонов, ФИО, адресов.</li></ul>`,
    report: ans => `- PATCH /me: ${(MA.find(x => x.v === ans.srv) || {}).t || '—'}\n- Проблемы JWT: ${(ans.q || []).map(i => strip((Q_JWT.options[i] || {}).t)).join('; ') || '—'}`
  };

  // =====================================================================
  TR.stage({
    id: ID, act: 3, order: 140, slot: 'Чт 15:00', title: 'Безопасность API',
    when: 'четверг, 15:00 · переговорная «Кардио» · Тимур принёс отчёт пентеста',
    intro: [
      { who: 'timur', html: '«Вот отчёт прошлогоднего пентеста. Главное: на старом сайте можно было открыть чужую запись, поменяв номер в адресе. С именем и телефоном. Второй раз я такое читать не хочу».' },
      { who: 'vera', html: 'Безопасность API — это не «поставить пароль». Это четыре вопроса: кто пришёл, что ему можно, к каким именно объектам и какие поля он может менять. Сегодня пройдём все четыре — и в каждом сами попробуете взломать.' },
      { who: 'kirill', html: '«От нас: ФитПасс ходит к вам по OAuth 2.0. Только не просите нас хранить логины ваших клиентов».' }
    ],
    facts: ['F-pentest', 'F-auth', 'F-fitpass-tech', 'F-admin-ui', 'F-turnstile-vendor', 'F-psp', 'F-client-id'],
    glossary: [
      { term: 'Аутентификация', simple: 'Выяснить, кто пришёл. Карта клиента на турникете.', tech: 'Проверка личности: токен, сертификат, подпись. Не прошла — 401 + WWW-Authenticate.' },
      { term: 'Авторизация', simple: 'Решить, что этому человеку можно. Ваш ключ открывает только ваш шкафчик.', tech: 'Проверка прав: роль, scope, владелец объекта. Нет права на действие — 403; чужой объект — 404.' },
      { term: 'OAuth 2.0', simple: 'Способ выдать программе временный пропуск с ограниченными правами, не отдавая ей пароль.', tech: 'Протокол выдачи токенов доступа (RFC 6749). Потоки: Authorization Code + PKCE, Client Credentials; Implicit и Password grant устарели.' },
      { term: 'PKCE', simple: 'Одноразовый секрет, который приложение придумывает само и не отдаёт: перехваченный код без него бесполезен.', tech: 'Proof Key for Code Exchange (RFC 7636): code_verifier остаётся на устройстве, на сервер уходит code_challenge = SHA-256(verifier).' },
      { term: 'Client Credentials', simple: 'Вход сервера к серверу без пользователя: у партнёра свой логин и секрет.', tech: 'Поток OAuth 2.0 для доверенных серверов. ФитПасс получает токен по client_id и секрету, права — через scopes.' },
      { term: 'Scope', simple: 'Перечень того, что можно этому пропуску: «только бассейн», «только чтение расписания».', tech: 'Область доступа в токене, например schedule:read, bookings:write. Не хватает — 403 insufficient_scope.' },
      { term: 'JWT', simple: 'Пропуск с печатью: подделать нельзя, а прочитать может любой.', tech: 'JSON Web Token (RFC 7519): заголовок, данные и подпись в base64url. Подписан, но не зашифрован. alg none не принимаем, access живёт 15 минут.' },
      { term: 'mTLS', simple: 'Взаимная проверка удостоверений: не только клиент проверяет сервер, но и сервер — клиента.', tech: 'TLS с клиентским сертификатом. Для устройств: контроллер турникета предъявляет сертификат своего клуба.' },
      { term: 'BOLA', simple: 'Ключ подходит к чужому шкафчику: вошли законно, а открыть можно любой объект, поменяв номер.', tech: 'Broken Object Level Authorization, №1 в OWASP API Security Top 10. Лечится проверкой владельца в каждом запросе к объекту.' },
      { term: 'Mass assignment', simple: 'Сервер переносит в базу всё, что прислал клиент, включая «я администратор».', tech: 'Автосвязывание тела запроса с сущностью. Лечится DTO с белым списком полей; лишнее игнорируется или даёт 422.' }
    ],
    outro: 'Четыре вопроса безопасности теперь у вас в руках: кто пришёл (401), что ему можно (403), чей это объект (404 и проверка владельца в запросе), какие поля он может менять (DTO). И один честный вывод: uuid и HTTPS — хорошо, но дыру закрывает только проверка прав на каждом запросе. Завтра — GraphQL для главного экрана, там эти же вопросы встанут острее.',
    tasks: [taskAuthz, taskOauth, taskBola, taskMass]
  });
})();
