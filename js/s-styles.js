/* Неделя 3, пятница 15:00: gRPC турникета, офлайн-режим, SOAP-выгрузка в 1С, SSE и выбор стиля.
   Канон: _dev/DOMAIN.md §8 (офлайн-турникет), §9 (карта интеграций), §12 (gRPC), §13 (SOAP). Брокеры не используем. */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc;

  if (!document.getElementById('sty-style')) {
    document.head.insertAdjacentHTML('beforeend', `<style id="sty-style">
      .sty-hex { font: 500 12px/1.6 var(--f-mono); word-break: break-all; background: var(--code-bg); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; color: var(--text-2); }
      .sty-strip { display: grid; gap: 6px; min-width: 0; }
      .sty-strip .r { display: grid; grid-template-columns: minmax(0, 120px) minmax(0, 1fr); gap: 8px; align-items: center; font-size: 12px; color: var(--text-2); }
      .sty-strip .trk { position: relative; height: 18px; background: var(--surface-3); border-radius: 4px; }
      .sty-strip .dot { position: absolute; top: 3px; width: 12px; height: 12px; margin-left: -6px; border-radius: 50%; }
      .sty-strip .dot.ev { background: var(--accent); }
      .sty-strip .dot.up { background: var(--ok); }
      .sty-strip .dot.q { background: var(--text-muted); width: 6px; height: 6px; top: 6px; margin-left: -3px; }
      .sty-strip .axis { display: flex; justify-content: space-between; font: 500 10.5px/1 var(--f-mono); color: var(--text-muted); }
      .sty-root { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
      .sty-root .stack > * { min-width: 0; }
      @media (max-width: 560px) { .sty-strip .r { grid-template-columns: minmax(0, 84px) minmax(0, 1fr); } }
    </style>`);
  }
  const stat = (k, v, s, kind) => `<div class="stat"><div class="k">${k}</div><div class="v ${kind || ''}">${v}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`;
  const quizBox = (el, cfg, ctx, key) => { const d = document.createElement('div'); d.className = 'card flat'; el.appendChild(d); ui.quiz(d, Object.assign({}, cfg, { value: ctx.ans[key], readonly: ctx.readonly, reveal: ctx.result, onChange: v => { ctx.ans[key] = v; ctx.save(); } })); };
  const box = (el, cls) => { const d = document.createElement('div'); if (cls) d.className = cls; d.style.minWidth = '0'; el.appendChild(d); return d; };

  // ======================================================================
  // Подход 1. Турникет: 300 мс
  // ======================================================================
  const enc = s => Array.from(new TextEncoder().encode(s));
  const pbStr = (no, s) => { const b = enc(s); return b.length ? [(no << 3) | 2, b.length].concat(b) : []; };
  const pbBool = (no, v) => v ? [(no << 3), 1] : [];
  const REQ = { club_id: 'club-07', token: 'qr.7Hk2pQ9xVw3LmN8s', turnstile_id: 't-07-02' };
  const RES = { allowed: true, reason: '', client_display_name: 'Анна С.' };
  const JSON_REQ = JSON.stringify(REQ), JSON_RES = JSON.stringify(RES);
  const REST_HDR = 'POST /access/v1/check-pass HTTP/1.1\r\nHost: api.puls.fit\r\nContent-Type: application/json\r\nAccept: application/json\r\nUser-Agent: ProhodPro/4.2\r\nContent-Length: 76\r\n\r\n';
  const REST_RHDR = 'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 65\r\nDate: Fri, 09 Oct 2026 15:12:04 GMT\r\n\r\n';
  const PB_REQ = pbStr(1, REQ.club_id).concat(pbStr(2, REQ.token), pbStr(3, REQ.turnstile_id));
  const PB_RES = pbBool(1, RES.allowed).concat(pbStr(2, RES.reason), pbStr(3, RES.client_display_name));
  const SIZE = {
    json: { req: enc(JSON_REQ).length + enc(REST_HDR).length, res: enc(JSON_RES).length + enc(REST_RHDR).length, body: enc(JSON_REQ).length },
    pb: { req: PB_REQ.length + 5 + 14, res: PB_RES.length + 5 + 12, body: PB_REQ.length }   // 5 байт — рамка gRPC, 12–14 — сжатые заголовки HTTP/2 (HPACK)
  };
  const PROTO = { 'rest-new': { t: 'REST/JSON, новое соединение', rtt: 3, fmt: 'json' }, 'rest-ka': { t: 'REST/JSON, keep-alive', rtt: 1, fmt: 'json' }, grpc: { t: 'gRPC/Protobuf, HTTP/2', rtt: 1, fmt: 'pb' } };
  const NETS = { good: { t: 'Сеть хорошая', rtt: 40 }, bad: { t: 'Сеть плохая', rtt: 120 }, down: { t: 'Интернет пропал', rtt: Infinity } };
  const SRV = 25, DEADLINE = 300;
  function passCalc(proto, net) {
    const P = PROTO[proto], N = NETS[net];
    const ms = N.rtt === Infinity ? Infinity : P.rtt * N.rtt + SRV;
    return { ms, late: ms > DEADLINE, P, N, sz: SIZE[P.fmt] };
  }
  function passSteps(proto, net) {
    const c = passCalc(proto, net), steps = [], rtt = c.N.rtt;
    steps.push({ from: 'cl', to: 'ct', t: 'QR-код к сканеру', time: '0 мс', note: 'Клиент подносит телефон. Часы пошли: на всё решение у турникета 300 мс (F-turnstile-vendor).' });
    let t = 0;
    if (proto === 'rest-new') {
      if (rtt === Infinity) steps.push({ from: 'ct', to: 'bk', t: 'TCP: установка соединения', lost: true, kind: 'bad', time: '…', note: 'Соединения нет и не будет: интернет пропал.' });
      else {
        t += rtt; steps.push({ from: 'ct', to: 'bk', t: 'TCP: установка соединения', time: t + ' мс', kind: 'warn', note: 'Новое соединение на каждый проход — первый поход по сети уходит только на «алло».' });
        t += rtt; steps.push({ from: 'ct', to: 'bk', t: 'TLS: рукопожатие', time: t + ' мс', kind: 'warn', note: 'Второй поход — договориться о шифровании. Данных ещё не отправили.' });
      }
    } else steps.push({ from: 'ct', to: 'bk', box: true, t: proto === 'grpc' ? 'HTTP/2-соединение уже открыто и держится' : 'TCP + TLS уже открыты (keep-alive)', kind: 'info', note: 'Соединение открыто заранее и переиспользуется: на проход тратится один поход по сети.' });
    if (rtt !== Infinity || proto !== 'rest-new') {
      const what = proto === 'grpc' ? `CheckPass · Protobuf ${c.sz.req} Б` : `POST /check-pass · JSON ${c.sz.req} Б`;
      if (rtt === Infinity) steps.push({ from: 'ct', to: 'bk', t: what, lost: true, kind: 'bad', time: '…', note: 'Запрос ушёл в никуда.' });
      else if (c.late) steps.push({ from: 'ct', to: 'bk', t: what, kind: 'warn', time: (t + rtt / 2) + ' мс', note: 'Запрос ещё в пути, а бюджет почти съеден.' });
      else {
        steps.push({ from: 'ct', to: 'bk', t: what + (proto === 'grpc' ? ', дедлайн 300 мс' : ''), time: (t + rtt / 2) + ' мс', note: proto === 'grpc' ? 'Дедлайн едет вместе с запросом: сервер знает, сколько у него осталось времени, и не работает зря.' : 'В REST дедлайн — это таймаут на стороне клиента; сервер о нём не знает.' });
        steps.push({ from: 'bk', to: 'bk', t: `проверка\n${SRV} мс`, time: (t + rtt / 2 + SRV) + ' мс' });
        steps.push({ from: 'bk', to: 'ct', t: `allowed = true · ${c.sz.res} Б`, reply: true, kind: 'ok', time: c.ms + ' мс' });
        steps.push({ from: 'ct', to: 'cl', t: 'открыто ✓', kind: 'ok', time: c.ms + ' мс', note: `Решение за ${c.ms} мс — в пределах 300 мс.` });
      }
    }
    if (c.late) {
      steps.push({ from: 'ct', to: 'ct', t: 'DEADLINE_EXCEEDED · 300 мс', kind: 'bad', time: '300 мс', note: 'Ответа нет за 300 мс. Ждать дальше нельзя: за спиной очередь.' });
      steps.push({ from: 'ct', to: 'ct', t: 'решение по локальному списку', kind: 'warn', time: '301 мс', note: 'Контроллер решает сам — по локальному списку пропусков. Насколько он свежий — тема следующего подхода.' });
      steps.push({ from: 'ct', to: 'cl', t: 'открыто (по локальному списку)', kind: 'warn', time: '302 мс' });
    }
    return steps;
  }
  const PROTO_SRC = `syntax = "proto3";
package puls.access.v1;

service AccessControl {
  rpc CheckPass (CheckPassRequest) returns (CheckPassResponse);           // дедлайн 300 мс
  rpc ReportPassages (stream PassageEvent) returns (ReportAck);           // досылка буфера после офлайна
  rpc WatchAllowlist (WatchAllowlistRequest) returns (stream AllowlistUpdate); // локальный список пропусков
}

message CheckPassRequest  { string club_id = 1; string token = 2; string turnstile_id = 3; }
message CheckPassResponse { bool allowed = 1; string reason = 2; string client_display_name = 3; }
message PassageEvent      { string turnstile_event_id = 1; string club_id = 2; string client_id = 3;
                            int64 occurred_at_unix_ms = 4; Direction direction = 5; }
enum Direction { DIRECTION_UNSPECIFIED = 0; IN = 1; OUT = 2; }`;
  const QP = [
    {
      q: 'Вендор просит вместо текстового <code>reason = 2</code> в <code>CheckPassResponse</code> числовой код отказа. В клубах — старые контроллеры, обновятся не сразу. Как поменять контракт?', seed: 'sty-p1',
      options: [
        { t: 'Удалить поле, записать <code>reserved 2; reserved "reason";</code> и добавить новое <code>int32 deny_code = 4;</code>', ok: 1, why: 'Верно. Номер 2 больше никогда не используется: старые контроллеры просто не увидят нового поля, а не прочтут чужие байты как своё.' },
        { t: 'Оставить номер 2, поменять тип на <code>int32</code> и имя на <code>deny_code</code>', why: 'Старые контроллеры ждут под номером 2 строку и получат число — неверное чтение или ошибка разбора.' },
        { t: 'Удалить <code>reason</code> и отдать номер 2 новому полю', why: 'Номер — это и есть имя поля на проводе. Старый контроллер прочтёт новое поле как reason.' },
        { t: 'Ничего не делать с номерами — Protobuf сам разберётся по именам', why: 'Имён на проводе нет — только номера. Сам он ничего не разберёт.' }
      ]
    },
    {
      q: 'Зачем в <code>enum Direction</code> первым идёт <code>DIRECTION_UNSPECIFIED = 0</code>?', seed: 'sty-p2',
      options: [
        { t: 'В proto3 незаполненное поле читается как 0. Если бы 0 был IN, потерянное направление молча превратилось бы во «вход»', ok: 1, why: 'Верно. Ноль — значение «не указано», и сервер может отличить ошибку от настоящего входа.' },
        { t: 'Так компактнее: ноль занимает меньше байт', why: 'Дело не в размере. Ноль — это значение по умолчанию, и он не должен нести смысл.' },
        { t: 'Это требование HTTP/2', why: 'HTTP/2 ничего не знает о перечислениях Protobuf.' },
        { t: 'Просто соглашение об именах, на работу не влияет', why: 'Влияет: без UNSPECIFIED забытое поле молча станет первым значением перечисления.' }
      ]
    },
    {
      q: 'Разработчик переименовал в <code>.proto</code> поле <code>turnstile_id = 3</code> в <code>gate_id = 3</code>. Что заметят контроллеры в клубах?', seed: 'sty-p3',
      options: [
        { t: 'Ничего: по проводу едет номер поля 3, а не имя. Поменяется только код, который пересоберут', ok: 1, why: 'Верно. Поэтому имя менять можно, а номер и тип — нельзя. Осторожно только с JSON-представлением Protobuf: там имена есть.' },
        { t: 'Все контроллеры сломаются, пока их не обновят', why: 'На проводе нет имён. Сломался бы только перенос на другой номер или тип.' },
        { t: 'Сервер начнёт отвечать ошибкой UNIMPLEMENTED', why: 'UNIMPLEMENTED — про отсутствующий метод, а не про имя поля.' }
      ]
    }
  ];
  const taskPass = {
    id: 'checkpass', title: 'Турникет: 300 мс',
    simple: { icon: '🚪', plain: 'gRPC — это вызов функции на сервере по заранее заготовленному бланку, через линию, которая всё время открыта.', analogy: 'Охранник у турникета говорит с диспетчером по рации, которая всегда включена: нажал — спросил. REST с новым соединением — каждый раз набирать номер, ждать гудков, представляться. А Protobuf — бланк с пронумерованными графами: пишешь «3: t-07-02», а не «номер турникета: t-07-02».', tech: 'gRPC: HTTP/2 (одно долгое соединение, много запросов), Protobuf (бинарный формат, поля по номерам), контракт в <code>.proto</code> с генерацией кода, встроенные дедлайны и потоки (stream). Дедлайн 300 мс задаёт клиент; по истечении — <code>DEADLINE_EXCEEDED</code>.' },
    lead: ui.brief({
      situation: `Вечер, у турникета в клубе очередь. Клиент подносит телефон с QR-кодом. Контроллер турникета «ПроходПро» спрашивает наш сервер: «Пустить?». На ответ у него 300 мс — это треть секунды, человек паузы не заметит. Не успели — турникет решает сам, по своему списку. Каждый поход по сети туда и обратно стоит 40 мс при хорошей сети и 120 мс при плохой. Значит, лишние походы съедают время быстрее всего.`,
      todo: [
        `Переключайте способ связи: «REST/JSON, новое соединение», «REST/JSON, keep-alive», «gRPC/Protobuf, HTTP/2». И качество сети: хорошая, плохая, интернет пропал.`,
        `Обязательно устройте турникету плохой день (плохая сеть или пропавший интернет) и проиграйте проход через gRPC.`,
        `Прочитайте контракт турникета и ответьте на три вопроса под ним.`,
        `Засчитывается, когда все три вопроса решены и вы попробовали хотя бы один из двух опытов.`
      ],
      lookTitle: 'Как читать',
      look: `Схема — три колонки: клиент с QR, контроллер турникета, наш сервер. Числа слева — сколько миллисекунд прошло с момента, как поднесли телефон. Кнопка «▶ Проиграть» показывает проход по шагам. «Новое соединение» — каждый раз сначала два похода, чтобы «дозвониться» (TCP) и «договориться о шифре» (TLS). Только потом сам вопрос. <b>Keep-alive</b> — линию не вешают, следующий проход идёт сразу. <b>gRPC</b> — вызов функции на сервере по готовому бланку. <b>Protobuf</b> — сам бланк: вместо названий полей в нём номера, поэтому сообщение крошечное. Плитки: за сколько принято решение, размер запроса и ответа в байтах, сколько походов по сети.`
    }),
    blank: () => ({ proto: 'rest-new', net: 'good', tried: [], q1: [], q2: [], q3: [] }),
    reference: () => ({ proto: 'grpc', net: 'bad', tried: ['rest-new:good', 'rest-new:bad', 'grpc:bad', 'grpc:down'], q1: [0], q2: [0], q3: [0] }),
    render(el, ctx) {
      el.classList.add('sty-root');
      const a = ctx.ans; a.tried = a.tried || [];
      const mark = () => { const k = a.proto + ':' + a.net; if (!a.tried.includes(k)) a.tried.push(k); };
      mark();
      const top = box(el, 'stack');
      top.innerHTML = `<div class="row">${ui.seg('proto', Object.keys(PROTO).map(k => ({ v: k, t: PROTO[k].t })), a.proto, 'accent')}</div>
        <div class="row">${ui.seg('net', Object.keys(NETS).map(k => ({ v: k, t: NETS[k].t + (NETS[k].rtt !== Infinity ? ` · ${NETS[k].rtt} мс` : '') })), a.net)}</div>
        <div data-st></div><div data-seq style="min-width:0"></div>
        <details class="more"><summary>Как выглядит одно и то же сообщение: JSON против Protobuf</summary><div class="stack">
          <div class="grid2"><div>${ui.code(JSON_REQ, 'json', `JSON: тело ${SIZE.json.body} Б + заголовки HTTP/1.1`)}</div>
          <div class="stack tight"><div class="code-cap">Protobuf: ${SIZE.pb.body} Б — номер поля, длина, байты</div><div class="sty-hex">${PB_REQ.map(b => b.toString(16).padStart(2, '0')).join(' ')}</div>
          <div class="small dim"><code>0a 07</code> = поле 1, длина 7 → «club-07». Имён полей на проводе нет — только номера.</div></div></div></div></details>`;
      const seqBox = TR.$('[data-seq]', top);
      const sq = ui.seq(seqBox, { lanes: [{ id: 'cl', t: 'Клиент', sub: 'QR в приложении' }, { id: 'ct', t: 'Контроллер', sub: 'турникет клуба' }, { id: 'bk', t: 'Бэкенд', sub: '«Пульс»' }], steps: passSteps(a.proto, a.net), start: 'all', title: 'Проход через турникет' });
      const drawStats = () => {
        const c = passCalc(a.proto, a.net);
        TR.$('[data-st]', top).innerHTML = `<div class="grid4">
          ${stat('решение', c.late ? 'локально' : c.ms + ' мс', c.late ? (c.ms === Infinity ? 'сервер недоступен' : `сервер ответил бы за ${c.ms} мс`) : 'ответ сервера', c.late ? 'warn' : 'ok')}
          ${stat('запрос', c.sz.req + ' Б', c.P.fmt === 'pb' ? 'Protobuf + рамка' : 'JSON + заголовки')}
          ${stat('ответ', c.sz.res + ' Б', c.P.fmt === 'pb' ? `JSON было бы ${SIZE.json.res} Б` : `Protobuf — ${SIZE.pb.res} Б`)}
          ${stat('походов по сети', c.P.rtt, c.P.rtt > 1 ? 'TCP + TLS + запрос' : 'соединение держится')}</div>`;
      };
      ui.onSeg(top, (name, v) => { a[name] = v; mark(); ctx.save(); sq.set(passSteps(a.proto, a.net), { all: true }); drawStats(); });
      drawStats();
      const pr = box(el); pr.innerHTML = `<div class="eyebrow">Контракт турникета (DOMAIN §12)</div>${ui.code(PROTO_SRC, 'proto')}`;
      quizBox(el, QP[0], ctx, 'q1'); quizBox(el, QP[1], ctx, 'q2'); quizBox(el, QP[2], ctx, 'q3');
    },
    check(a) {
      const t = a.tried || [];
      const sawLate = t.some(k => k === 'rest-new:bad' || /:down$/.test(k)), sawGrpc = t.some(k => /^grpc:/.test(k));
      const r = ['q1', 'q2', 'q3'].map((k, i) => ui.quizScore(QP[i], a[k]));
      const lab = (sawLate ? 0.5 : 0) + (sawGrpc ? 0.5 : 0);
      const score = lab * 0.25 + r.reduce((s, x) => s + x.score, 0) / 3 * 0.75;
      const notes = [];
      if (!sawLate) notes.push({ ok: false, html: 'Устройте турникету плохой день: плохая сеть или пропавший интернет. Что он делает, когда 300 мс прошли?' });
      if (!sawGrpc) notes.push({ ok: false, html: 'Проиграйте проход через gRPC и сравните размер сообщения и число походов по сети.' });
      const NT = ['поле больше не нужно', 'ноль в enum', 'переименование поля'];
      r.forEach((x, i) => notes.push({ ok: x.ok, html: `Вопрос ${i + 1} (${NT[i]}): ${x.ok ? 'верно' : 'подумайте, что на самом деле едет по проводу — имена или номера?'}` }));
      return { ok: r.every(x => x.ok) && lab >= 0.5, score, notes };
    },
    explain: `<p>Главный выигрыш по времени дают <b>не байты, а открытое соединение</b>: новое соединение с TLS съедает два лишних похода по сети, и на плохой сети REST не укладывается в 300 мс. REST с keep-alive почти догоняет gRPC. Почему тогда gRPC? Вендор его умеет, контракт <code>.proto</code> генерирует код на обеих сторонах, дедлайн встроен в протокол и едет с запросом, а главное — есть <b>потоки</b>: <code>WatchAllowlist</code> (список пропусков) и <code>ReportPassages</code> (досылка буфера). Это следующий подход.</p>
      <p>Правила эволюции <code>.proto</code>: номера полей вечные — удалённые закрываем <code>reserved</code>; тип поля не меняем; имя менять можно; в enum ноль — <code>…_UNSPECIFIED</code>. И когда сервер не успел, турникет не «висит», а решает сам по локальному списку.</p>`,
    report: a => {
      const r = ['q1', 'q2', 'q3'].map((k, i) => ui.quizScore(QP[i], a[k]).ok ? 'верно' : 'неверно');
      return `Прогнано комбинаций: ${(a.tried || []).length}. Вопросы по .proto: reserved — ${r[0]}, UNSPECIFIED — ${r[1]}, переименование — ${r[2]}.`;
    }
  };

  // ======================================================================
  // Подход 2. Офлайн-режим турникета
  // ======================================================================
  const UPD = { stream: 'Поток изменений', minute: 'Раз в минуту', daily: 'Раз в сутки' };
  const BUF = { none: 'Без буфера', noid: 'Буфер без id', id: 'Буфер с turnstile_event_id' };
  const OFF = { valid: 226, stopped: 5, bought: 7, during: 2, dup: 120, fitpass: 18 };
  function offCalc(upd, buf) {
    const daily = upd === 'daily';
    const inNew = upd === 'stream' ? 7 : upd === 'minute' ? 6 : 0;
    const passed = OFF.valid + (daily ? OFF.stopped : 0) + inNew;
    const wrongIn = daily ? OFF.stopped : 0;
    const wrongOut = (OFF.bought - inNew) + OFF.during;
    const saved = buf === 'none' ? 0 : passed;
    const dupIn = buf === 'noid' ? OFF.dup : 0, dupCut = buf === 'id' ? OFF.dup : 0;
    const traffic = upd === 'stream' ? '≈ 0,1 МБ' : upd === 'minute' ? '≈ 253 МБ' : '≈ 0,2 МБ';
    return { passed, wrongIn, wrongOut, saved, dupIn, dupCut, traffic };
  }
  function offSteps(upd, buf) {
    const c = offCalc(upd, buf), s = [];
    if (upd === 'stream') s.push({ from: 'bk', to: 'ct', t: 'WatchAllowlist: изменения потоком', kind: 'ok', time: '17:59', note: 'Сервер шлёт каждое изменение сразу: заморозили, продали, расторгли. К обрыву список свежий.' });
    else if (upd === 'minute') s.push({ from: 'ct', to: 'bk', t: 'забрать список целиком (раз в минуту)', time: '17:59', note: 'Список почти свежий: отстаёт не больше чем на минуту. Цена — полный список 1 440 раз в сутки.' });
    else s.push({ from: 'bk', to: 'ct', t: 'список целиком, раз в сутки', kind: 'warn', time: '03:00', note: 'Список собран ночью. Всё, что случилось за день, контроллер не знает.' });
    s.push({ from: 'cl', to: 'bk', box: true, t: '18:00 — интернет в клубе пропал на 2 часа', kind: 'bad', time: '18:00', note: 'Клуб в области, пик вечерних посещений. Сервер недоступен — решает только контроллер.' });
    s.push({ from: 'cl', to: 'ct', t: 'QR · абонемент заморожен сегодня в 14:00', time: '18:12' });
    s.push(upd === 'daily' ? { from: 'ct', to: 'ct', t: 'в списке ещё активен → открыто', kind: 'bad', time: '18:12', note: `Пустили без действующего абонемента. Таких за 2 часа — ${OFF.stopped}: заморозки и расторжения за день.` } : { from: 'ct', to: 'ct', t: 'в списке заморожен → отказ', kind: 'ok', time: '18:12', note: 'Список знает о заморозке — турникет не пустил.' });
    s.push({ from: 'cl', to: 'ct', t: 'QR · купил абонемент сегодня в 16:30', time: '18:25' });
    s.push(upd === 'daily' ? { from: 'ct', to: 'ct', t: 'нет в списке → отказ', kind: 'warn', time: '18:25', note: 'Клиент только что заплатил, а его не пускают. Очередь на ресепшен и злой отзыв.' } : { from: 'ct', to: 'ct', t: 'есть в списке → открыто', kind: 'ok', time: '18:25' });
    if (buf === 'none') s.push({ from: 'ct', to: 'ct', t: 'проход никуда не записан', kind: 'bad', time: '18:25', note: 'Событие прохода потеряно навсегда. Посещения за 2 часа не попадут в базу.' });
    else s.push({ from: 'ct', to: 'ct', t: buf === 'id' ? 'в буфер:\nturnstile_event_id = t2-000187' : 'в буфер (без id события)', kind: buf === 'id' ? 'ok' : '', time: '18:25', note: buf === 'id' ? 'Контроллер сам присваивает событию уникальный id в момент прохода — до первой отправки.' : 'Событие сохранено, но отличить его повтор от нового прохода будет нечем.' });
    s.push({ from: 'cl', to: 'bk', box: true, t: '20:00 — связь вернулась', kind: 'ok', time: '20:00' });
    if (buf === 'none') s.push({ from: 'ct', to: 'bk', box: true, t: 'в базе нет посещений с 18:00 до 20:00', kind: 'bad', time: '20:00', note: `Из потерянных проходов ${OFF.fitpass} — клиенты ФитПасса: в сверке их не будет, ФитПасс за них не заплатит.` });
    else {
      s.push({ from: 'ct', to: 'bk', t: `ReportPassages: ${c.passed} событий потоком`, time: '20:00', note: 'Контроллер досылает буфер клиентским потоком gRPC.' });
      s.push({ from: 'bk', to: 'ct', t: 'ReportAck — потерялся', reply: true, lost: true, kind: 'bad', time: '20:01', note: 'Связь мигнула: сервер принял первые 120 событий, но подтверждение не дошло. Контроллер не знает, что они приняты.' });
      s.push({ from: 'ct', to: 'bk', t: 'повтор: те же 120 событий', kind: 'warn', time: '20:02' });
      s.push(buf === 'id' ? { from: 'ct', to: 'bk', box: true, t: 'ON CONFLICT DO NOTHING: 120 дублей отсечено', kind: 'ok', time: '20:02', note: 'Уникальный ключ (club_id, turnstile_event_id, entered_at) не пустил повтор в таблицу visit.' } : { from: 'ct', to: 'bk', box: true, t: 'INSERT: 120 визитов задвоены', kind: 'bad', time: '20:02', note: 'Отличить повтор от нового прохода нечем — в базе 120 лишних посещений. Сверка с ФитПассом разойдётся.' });
    }
    return s;
  }
  const QO = [
    {
      q: 'Связь пропала вечером и не вернулась к утру. Что положить в каждую запись локального списка, чтобы абонемент, закончившийся в полночь, утром уже не пускал?', seed: 'sty-o1',
      options: [
        { t: 'Дату окончания действия и ограничения (домашний клуб, «до 17:00») — контроллер проверит их сам по своим часам', ok: 1, why: 'Верно. Запись в списке сама «протухает» по дате. Именно отсутствие срока годности дало инцидент «прошёл клиент с истёкшим абонементом».' },
        { t: 'Только id клиента — этого достаточно', why: 'Тогда список не знает, до какого числа пускать. Без связи истёкший абонемент будет пускать бесконечно.' },
        { t: 'QR-код клиента', why: 'QR меняется каждые 30 секунд — хранить его бессмысленно. Контроллер проверяет подпись токена и ищет клиента в списке.' },
        { t: 'Ничего: без связи турникет просто закрывается', why: 'Нельзя: проход должен работать всегда (F-offline, F-availability). Вечером в области это сотни людей у закрытого турникета.' }
      ]
    },
    {
      q: 'Почему id события прохода генерирует контроллер, а не сервер при вставке?', seed: 'sty-o2',
      options: [
        { t: 'Id должен существовать до первой отправки: тогда повтор несёт тот же id, и сервер узнаёт дубль', ok: 1, why: 'Верно. Сервер не может дать id событию, о котором ещё не знает. Это тот же принцип, что Idempotency-Key у оплаты.' },
        { t: 'Так быстрее работает база', why: 'Скорость тут ни при чём. Дело в том, чтобы повтор был узнаваем.' },
        { t: 'Серверные id нельзя хранить в PostgreSQL', why: 'Можно. Но серверный id появляется только после вставки — повтор получит новый id и станет дублем.' }
      ]
    }
  ];
  const taskOffline = {
    id: 'offline', title: 'Офлайн-режим турникета',
    simple: { icon: '📒', plain: 'Если сервер недоступен, турникет решает сам по своей копии списка пропусков, а проходы записывает в тетрадку и потом сдаёт.', analogy: 'Охранник на входе со списком гостей. Рация сломалась — он сверяется со списком. Но если список ему дали вчера утром, он пропустит того, кого днём вычеркнули. А проходы он пишет в тетрадку с номерами строк — чтобы, если сдаст тетрадку дважды, никого не посчитали два раза.', tech: 'Локальный список пропусков (allowlist) обновляется потоком <code>WatchAllowlist</code> (server streaming). Буфер событий досылается <code>ReportPassages</code> (client streaming). Каждое событие несёт <code>turnstile_event_id</code>; в таблице <code>visit</code> уникальный ключ из клуба, <code>turnstile_event_id</code> и времени прохода отсекает повторы.' },
    lead: ui.brief({
      situation: `Клуб в области, 18:00, вечерний пик. В клубе пропал интернет на 2 часа. За это время к турникету подойдут 240 человек. Сервер недоступен, и турникет решает сам — по своей копии списка «кому можно войти». Это как список гостей у охранника на случай, если рация сломалась. Днём кто-то заморозил абонемент, кто-то купил новый. Знает ли об этом список? И куда записать 240 проходов, чтобы потом они попали в базу?`,
      todo: [
        `В первом переключателе выберите, как часто контроллер обновляет свой список пропусков.`,
        `Во втором — что он делает с проходами без связи. <b>Буфер</b> — «тетрадка», куда он записывает проходы, чтобы отправить потом. <code>turnstile_event_id</code> — номер записи, который придумывает сам контроллер.`,
        `Прогоните хотя бы две разные настройки и ответьте на два вопроса.`,
        `Засчитывается, когда никого не пустили по устаревшему списку, все проходы дошли до базы без дублей, а вопросы решены.`
      ],
      lookTitle: 'Как читать',
      look: `Плитки сверху — итог вечера. «Пустили зря» — вошли с замороженным абонементом. «Не пустили зря» — клиент заплатил, а турникет его не знает. «Событий в базе» — сколько проходов доехало на сервер. «Дубли» — проходы, записанные дважды. «Трафик» — сколько данных уходит на обновление списка за сутки. Схема по времени: 18:00 связь пропала, клиенты подходят, 20:00 связь вернулась и контроллер досылает тетрадку. В 20:01 связь мигает — подтверждение теряется, и контроллер шлёт часть записей ещё раз.`
    }),
    blank: () => ({ upd: 'daily', buf: 'none', runs: [], q1: [], q2: [] }),
    reference: () => ({ upd: 'stream', buf: 'id', runs: ['daily:none', 'minute:noid', 'stream:id'], q1: [0], q2: [0] }),
    render(el, ctx) {
      el.classList.add('sty-root');
      const a = ctx.ans; a.runs = a.runs || [];
      const mark = () => { const k = a.upd + ':' + a.buf; if (!a.runs.includes(k)) a.runs.push(k); };
      mark();
      const top = box(el, 'stack');
      top.innerHTML = `<div class="stack tight"><span class="small dim">Как контроллер обновляет локальный список пропусков</span>${ui.seg('upd', Object.keys(UPD).map(k => ({ v: k, t: UPD[k] })), a.upd, 'accent')}</div>
        <div class="stack tight"><span class="small dim">Что делает с событиями прохода без связи</span>${ui.seg('buf', Object.keys(BUF).map(k => ({ v: k, t: BUF[k] })), a.buf, 'accent')}</div>
        <div data-st></div><div data-seq style="min-width:0"></div><div data-sum></div>`;
      const sq = ui.seq(TR.$('[data-seq]', top), { lanes: [{ id: 'cl', t: 'Клиенты', sub: '240 за 2 часа' }, { id: 'ct', t: 'Контроллер', sub: 'клуб в области' }, { id: 'bk', t: 'Бэкенд', sub: '«Пульс»' }], steps: offSteps(a.upd, a.buf), start: 'all', title: 'Два часа без связи' });
      const draw = () => {
        const c = offCalc(a.upd, a.buf);
        TR.$('[data-st]', top).innerHTML = `<div class="grid3">
          ${stat('прошли', c.passed, 'из 240 подошедших')}
          ${stat('пустили зря', c.wrongIn, 'заморожен или расторгнут', c.wrongIn ? 'bad' : 'ok')}
          ${stat('не пустили зря', c.wrongOut, c.wrongOut > OFF.during ? 'купили днём — список не знает' : 'купили уже без связи — к администратору', c.wrongOut > OFF.during ? 'warn' : '')}
          ${stat('событий в базе', c.saved + ' / ' + c.passed, c.saved ? 'досланы после 20:00' : 'посещения потеряны', c.saved ? 'ok' : 'bad')}
          ${stat('дубли', a.buf === 'id' ? c.dupCut + ' отсечено' : a.buf === 'noid' ? c.dupIn + ' в базе' : '—', a.buf === 'id' ? 'уникальный ключ сработал' : a.buf === 'noid' ? 'визиты задвоены' : 'нечего дублировать', a.buf === 'id' ? 'ok' : a.buf === 'noid' ? 'bad' : '')}
          ${stat('трафик на список', c.traffic, 'в сутки на клуб', a.upd === 'minute' ? 'warn' : '')}</div>
          <div class="small dim">Прогнано настроек: ${a.runs.length}</div>`;
        const bad = [];
        if (c.wrongIn) bad.push(`${c.wrongIn} человек прошли без действующего абонемента`);
        if (c.wrongOut > OFF.during) bad.push(`${c.wrongOut - OFF.during} только что купивших не пустили`);
        if (!c.saved) bad.push(`посещения за 2 часа потеряны, ${OFF.fitpass} визитов ФитПасса не попадут в сверку`);
        if (c.dupIn) bad.push(`${c.dupIn} визитов задвоены — сверка с ФитПассом разойдётся`);
        TR.$('[data-sum]', top).innerHTML = bad.length ? ui.note('bad', 'Итог прогона', bad.join('; ') + '.') : ui.note('ok', 'Итог прогона', `Без связи клуб работал: пустили всех с действующим абонементом, события досланы, дубли отсечены. ${OFF.during} человека, купивших абонемент уже без связи, прошли через администратора — это неизбежно.`);
      };
      ui.onSeg(top, (name, v) => { a[name] = v; mark(); ctx.save(); sq.set(offSteps(a.upd, a.buf), { all: true }); draw(); ctx.decide('Офлайн-режим турникета', `${UPD[a.upd]}; ${BUF[a.buf]}`); });
      draw();
      quizBox(el, QO[0], ctx, 'q1'); quizBox(el, QO[1], ctx, 'q2');
    },
    check(a) {
      const U = { stream: 1, minute: 0.85, daily: 0 }, B = { id: 1, noid: 0.2, none: 0 };
      const u = U[a.upd] || 0, b = B[a.buf] || 0, runs = Math.min(1, (a.runs || []).length / 3);
      const q1 = ui.quizScore(QO[0], a.q1), q2 = ui.quizScore(QO[1], a.q2);
      const score = u * 0.25 + b * 0.25 + runs * 0.1 + q1.score * 0.2 + q2.score * 0.2;
      const notes = [];
      if (runs < 1) notes.push({ ok: false, html: 'Прогоните хотя бы три разные настройки — сравните, что меняется в итоге.' });
      if (a.upd === 'daily') notes.push({ ok: false, html: 'Список раз в сутки не знает ничего, что случилось за день: заморозки, расторжения, новые покупки. Посмотрите на «пустили зря» и «не пустили зря».' });
      else if (a.upd === 'minute') notes.push({ ok: 'warn', html: 'Раз в минуту — почти так же свежо, как поток, и проще. Но полный список 1 440 раз в сутки — это сотни мегабайт на клуб, а изменения всё равно отстают на минуту. Поток шлёт только изменения.' });
      else notes.push({ ok: true, html: 'Поток изменений: к моменту обрыва список свежий.' });
      if (a.buf === 'none') notes.push({ ok: false, html: 'Без буфера проходы за 2 часа исчезают: ни отчётов, ни сверки с ФитПассом, ни доказательств в споре.' });
      else if (a.buf === 'noid') notes.push({ ok: false, html: 'Буфер есть, но подтверждение может потеряться, и контроллер пошлёт события снова. Как сервер отличит повтор от нового прохода?' });
      else notes.push({ ok: true, html: 'Буфер с id события: повтор узнаётся по уникальному ключу.' });
      notes.push(q1.ok ? { ok: true, html: 'Срок годности записи в списке — верно.' } : { ok: false, html: 'Вопрос 1: как контроллеру без связи понять, что абонемент уже кончился?' });
      notes.push(q2.ok ? { ok: true, html: 'Кто генерирует id события — верно.' } : { ok: false, html: 'Вопрос 2: когда должен появиться id, чтобы повтор нёс тот же id?' });
      return { ok: a.upd !== 'daily' && a.buf === 'id' && q1.ok && q2.ok && runs >= 0.66, score, summary: `Ваша настройка: ${UPD[a.upd] || '—'}; ${BUF[a.buf] || '—'}.`, notes };
    },
    explain: `<p>Офлайн-режим — это два механизма. <b>Список пропусков</b> решает «пускать или нет» без сервера. Его свежесть определяет, сколько ошибок будет: список раз в сутки пускает замороженных и не пускает тех, кто купил абонемент днём. Поток <code>WatchAllowlist</code> шлёт только изменения и держит список свежим. Раз в минуту — допустимый упрощённый вариант. У каждой записи — дата окончания: список сам «протухает» даже без связи.</p>
      <p><b>Буфер событий</b> не даёт потерять посещения: на них держатся отчёты, споры «я не приходил» и деньги от ФитПасса. Досылка — это ретрай, а у ретрая бывают дубли: подтверждение теряется, и контроллер шлёт снова. Поэтому id события генерирует контроллер, а таблица <code>visit</code> держит уникальный ключ <code>club_id</code> + <code>turnstile_event_id</code> + <code>entered_at</code> и вставляет с <code>ON CONFLICT DO NOTHING</code>.</p>
      <p>Это ровно инцидент из финала: «прошёл клиент с истёкшим абонементом — список не обновлялся сутки, у кэша нет срока годности».</p>`,
    report: a => `Настройка: ${UPD[a.upd] || '—'}; ${BUF[a.buf] || '—'}. Прогнано настроек: ${(a.runs || []).length}. Срок годности записи: ${ui.quizScore(QO[0], a.q1).ok ? 'верно' : 'неверно'}; кто генерирует id события: ${ui.quizScore(QO[1], a.q2).ok ? 'верно' : 'неверно'}.`
  };

  // ======================================================================
  // Подход 3. SOAP и 1С
  // ======================================================================
  const ENV = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:buh="http://puls.fit/1c/exchange">
  <soap:Header/>
  <soap:Body>
    <buh:ЗагрузитьОплаты>
      <buh:Пачка>2026-10-12-01</buh:Пачка>
      <buh:Документ>
        <buh:Номер>[[hl]]7f3c2b9e-1d4a-4c8e-b6f1-0a9d2e5c7b31[[/]]</buh:Номер>   <!-- public_id платежа -->
        <buh:Дата>2026-10-10T18:42:11+03:00</buh:Дата>
        <buh:Клуб>Пульс Химки</buh:Клуб>
        <buh:СуммаКоп>5400000</buh:СуммаКоп>
        <buh:Назначение>Абонемент «Вся сеть · 12 мес»</buh:Назначение>
      </buh:Документ>
      <!-- …ещё 99 документов в пачке -->
    </buh:ЗагрузитьОплаты>
  </soap:Body>
</soap:Envelope>`;
  const FAULT = `HTTP/1.1 500 Internal Server Error
Content-Type: text/xml; charset=utf-8

<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <soap:Fault>
      <faultcode>soap:Server</faultcode>
      <faultstring>Информационная база недоступна: обновление конфигурации</faultstring>
      <detail><КодОшибки>1C-503</КодОшибки></detail>
    </soap:Fault>
  </soap:Body>
</soap:Envelope>`;
  const ORD = [
    { id: 'wake', t: 'Будний день, 09:15 — задача выгрузки просыпается', sub: '1С принимает данные только в будни 9–19' },
    { id: 'pick', t: 'Выбираем оплаты и возвраты с <code>exported_to_1c_at IS NULL</code>', sub: 'за прошедшие сутки и всё, что не ушло раньше, в том числе за выходные' },
    { id: 'split', t: 'Делим на пачки по 100 документов' },
    { id: 'send', t: 'Отправляем пачку в «ЗагрузитьОплаты» / «ЗагрузитьВозвраты», номер документа = <code>public_id</code>' },
    { id: 'mark', t: 'Успешный ответ — проставляем <code>exported_to_1c_at</code> у документов этой пачки' },
    { id: 'retry', t: 'SOAP Fault или таймаут — повторяем через 30 минут, до 19:00' },
    { id: 'recon', t: 'Раз в неделю сверяем сумму за период у нас и в 1С' }
  ];
  const ORD_OK = ORD.map(o => o.id);
  const BATCH = [61240000, 58790000, 60325000];   // копейки: сумма каждой пачки из 100 оплат
  function soapCalc(num, mark) {
    const resend = mark === 'batch' ? [2] : [0, 1, 2];
    const dupB = num === 'new' ? resend : [];
    const dupSum = dupB.reduce((s, i) => s + BATCH[i], 0);
    return { resend, dupB, dup: dupB.length * 100, dupSum };
  }
  const QS = {
    q: 'В 11:00 повтор выгрузки получил SOAP Fault «Информационная база недоступна». Что делает задача?', seed: 'sty-s1',
    options: [
      { t: 'Ничего не помечает, ждёт и повторяет в 11:30 — до 19:00, потом завтра в 09:15', ok: 1, why: 'Верно. Документы без exported_to_1c_at сами попадут в следующую попытку, а номера = public_id не дадут задвоить то, что 1С всё-таки успела принять.' },
      { t: 'Помечает пачку выгруженной, чтобы не мешала следующим', why: 'Тогда оплаты не попадут в 1С никогда, а выручка у бухгалтерии не сойдётся.' },
      { t: 'Повторяет каждую секунду, пока 1С не ответит', why: 'Долбёжка мешает 1С подняться после обновления. Окно 9–19 даёт время: 30 минут — нормальный интервал.' },
      { t: 'Шлёт пачку заново с новыми номерами документов, чтобы 1С точно её приняла', why: 'Это и есть рецепт задвоения выручки: 1С не узнает повтор.' }
    ]
  };
  const taskSoap = {
    id: 'soap', title: 'SOAP и 1С',
    simple: { icon: '✉️', plain: 'SOAP — обмен строгими XML-письмами в конверте. 1С бухгалтерии говорит только так, и выбирать не нам.', analogy: 'Заказное письмо по бланку: конверт, внутри строго заполненная форма. Если что-то не так, почта возвращает официальный бланк отказа с кодом причины — это SOAP Fault. А номер документа — как номер квитанции: принесли ту же квитанцию дважды — бухгалтер узнает её и второй раз не проведёт.', tech: 'SOAP: XML-конверт <code>Envelope</code> → <code>Header</code> + <code>Body</code>; контракт в WSDL; ошибка — <code>Fault</code> (в SOAP 1.1 с HTTP 500). Идемпотентность выгрузки — стабильный номер документа (<code>public_id</code>) + отметка <code>exported_to_1c_at</code> после каждой успешной пачки.' },
    lead: ui.brief({
      situation: `Каждый будний день наши оплаты должны попадать в 1С — программу, где бухгалтер Ирина ведёт учёт. 1С понимает только <b>SOAP</b>: обмен строгими XML-письмами в «конверте». Выбирать не нам. Оплаты едут пачками по 100 штук. Понедельник, 09:15: за выходные набралось 300 оплат — 3 пачки. Пачки 1 и 2 дошли. Пачку 3 1С приняла, но ответ потерялся по дороге. Для нас это ошибка, и в 09:45 мы отправим повтор. Если 1С примет пачку дважды, выручка в отчёте Ирины задвоится.`,
      todo: [
        `Рассмотрите два кода сверху: так выглядит письмо в 1С и так 1С отвечает, когда недоступна.`,
        `Расставьте 7 шагов ежедневной выгрузки по порядку стрелками ↑ ↓.`,
        `В «Лаборатории» переключите «Номер документа в 1С» и «Когда ставим exported_to_1c_at». Смотрите таблицу пачек.`,
        `Ответьте на вопрос внизу. Засчитывается, когда шаги стоят почти без ошибок, в 1С нет дублей, заново уходит только то, что не дошло, и вопрос решён.`
      ],
      lookTitle: 'Как читать',
      look: `В письме: <code>Envelope</code> — конверт, <code>Body</code> — содержимое, <code>Документ</code> — одна оплата. <code>СуммаКоп</code> 5400000 — это 54 000 ₽ в копейках. <code>SOAP Fault</code> — ответ-отказ, тоже в конверте. <code>exported_to_1c_at</code> — отметка в нашей базе: «этот платёж уже ушёл в 1С, тогда-то». <code>public_id</code> — постоянный номер платежа, он никогда не меняется. В таблице лаборатории по строке на пачку: что было в 09:15, что при повторе в 09:45, и сколько раз пачка оказалась в 1С. Красная строка — задвоенная выручка.`
    }),
    blank: () => ({ order: [], num: 'new', mark: 'end', runs: [], q: [] }),
    reference: () => ({ order: ORD_OK.slice(), num: 'public', mark: 'batch', runs: ['new:end', 'new:batch', 'public:batch'], q: [0] }),
    render(el, ctx) {
      el.classList.add('sty-root');
      const a = ctx.ans; a.runs = a.runs || [];
      const codes = box(el, 'grid2');
      codes.innerHTML = `<div>${ui.code(ENV, 'xml', 'Запрос: ЗагрузитьОплаты (пачка из 100)')}</div><div>${ui.code(FAULT, 'http', 'Ответ, когда 1С недоступна: SOAP Fault')}</div>`;
      const oh = box(el, 'stack tight'); oh.innerHTML = '<div class="eyebrow">Шаги ежедневной выгрузки — расставьте по порядку</div><div data-ord></div>';
      let reveal = null;
      if (ctx.result) { reveal = {}; (a.order || []).forEach((id, i) => { reveal[id] = ORD_OK[i] === id ? 'ok' : 'bad'; }); }
      ui.order(TR.$('[data-ord]', oh), { items: ORD, value: a.order, readonly: ctx.readonly, reveal, seed: 'order-1c-x', onChange: v => { a.order = v; ctx.save(); } });
      const lab = box(el, 'stack');
      const mark = () => { const k = a.num + ':' + a.mark; if (!a.runs.includes(k)) a.runs.push(k); };
      mark();
      lab.innerHTML = `<div class="eyebrow">Лаборатория «упала посередине»</div>
        <div class="small">Понедельник, 09:15: за выходные накопилось 300 оплат — 3 пачки. Пачки 1 и 2 приняты. Пачку 3 1С <b>загрузила</b>, но ответ не дошёл — таймаут. В 09:45 задача повторяет.</div>
        <div class="stack tight"><span class="small dim">Номер документа в 1С</span>${ui.seg('num', [{ v: 'new', t: 'Новый номер на каждую отправку' }, { v: 'public', t: 'public_id платежа' }], a.num, 'accent')}</div>
        <div class="stack tight"><span class="small dim">Когда ставим exported_to_1c_at</span>${ui.seg('mark', [{ v: 'end', t: 'В конце всей выгрузки' }, { v: 'batch', t: 'После каждой успешной пачки' }], a.mark, 'accent')}</div>
        <div data-out></div>`;
      const draw = () => {
        const c = soapCalc(a.num, a.mark);
        const rows = [0, 1, 2].map(i => {
          const first = i < 2 ? ui.status('принята', 'ok') : ui.status('таймаут, но 1С загрузила', 'warn');
          const again = c.resend.includes(i);
          const second = !again ? '<span class="dim">не отправляется</span>' : a.num === 'public' ? ui.status('1С: номер уже есть, пропуск', 'ok') : ui.status('1С: новый документ', 'bad');
          const res = c.dupB.includes(i) ? `<b style="color:var(--bad)">задвоена: +${TR.fmtRub(BATCH[i])}</b>` : 'один раз';
          return [`Пачка ${i + 1} · ${TR.fmtRub(BATCH[i])}`, first, second, res];
        });
        TR.$('[data-out]', lab).innerHTML = `${ui.table(['Пачка', '09:15', '09:45 — повтор', 'В 1С'], rows, { rowClass: (r, i) => c.dupB.includes(i) ? 'bad' : '' })}
          <div class="grid3">${stat('отправлено повторно', c.resend.length * 100 + ' док.', a.mark === 'end' ? 'отметок нет — шлём всё заново' : 'только неотмеченные', a.mark === 'end' ? 'warn' : 'ok')}
          ${stat('дублей в 1С', c.dup, c.dup ? 'неделя сверки у Ирины' : 'повтор узнан по номеру', c.dup ? 'bad' : 'ok')}
          ${stat('выручка завышена', c.dupSum ? TR.fmtRub(c.dupSum) : '0 ₽', '', c.dupSum ? 'bad' : 'ok')}</div>
          <div class="small dim">Прогнано настроек: ${a.runs.length}</div>`;
      };
      ui.onSeg(lab, (name, v) => { a[name] = v; mark(); ctx.save(); draw(); ctx.decide('Выгрузка в 1С', `номер документа: ${a.num === 'public' ? 'public_id' : 'новый на каждую отправку'}; отметка: ${a.mark === 'batch' ? 'после каждой пачки' : 'в конце выгрузки'}`); });
      draw();
      quizBox(el, QS, ctx, 'q');
    },
    check(a) {
      const os = (a.order || []).length === ORD_OK.length ? ui.orderScore(a.order, ORD_OK) : 0;
      const q = ui.quizScore(QS, a.q);
      const runs = Math.min(1, (a.runs || []).length / 2);
      const score = os * 0.35 + (a.num === 'public' ? 0.25 : 0) + (a.mark === 'batch' ? 0.15 : 0) + runs * 0.05 + q.score * 0.2;
      const notes = [];
      notes.push(os >= 0.85 ? { ok: true, html: 'Шаги выгрузки по порядку.' } : { ok: false, html: 'Порядок шагов: что нужно знать, прежде чем делить на пачки? И когда можно ставить отметку «выгружено» — до ответа 1С или после?' });
      notes.push(a.num === 'public' ? { ok: true, html: 'Номер документа = <code>public_id</code>: повтор 1С узнаёт.' } : { ok: false, html: 'Посмотрите на столбец «В 1С»: почему 1С создаёт новый документ при повторе той же оплаты?' });
      notes.push(a.mark === 'batch' ? { ok: true, html: 'Отметка после каждой пачки: повтор продолжает с места падения.' } : { ok: 'warn', html: 'С отметкой в конце упавшая выгрузка начинается с нуля и шлёт заново уже принятые пачки. Даже без дублей это лишняя нагрузка на 1С в её узкое окно.' });
      notes.push(q.ok ? { ok: true, html: 'Реакция на SOAP Fault верная.' } : { ok: false, html: 'Вопрос про Fault: что будет с документами, которые пометили или перенумеровали?' });
      return { ok: os >= 0.85 && a.num === 'public' && a.mark === 'batch' && q.ok, score, notes };
    },
    explain: `<p>SOAP здесь не выбор, а данность: франчайзи 1С сделал сервис «ЗагрузитьОплаты», и REST не будет. Наша задача — сделать обмен <b>идемпотентным</b> и <b>продолжаемым</b>.</p>
      <ul class="checks"><li><b>Идемпотентность</b> — номер документа = <code>public_id</code> платежа. Повтор той же оплаты 1С узнаёт и не создаёт второй документ (договорились с франчайзи). Новый номер на каждую отправку — ровно инцидент «в 1С задвоилась выручка».</li>
      <li><b>Продолжаемость</b> — <code>exported_to_1c_at</code> после каждой успешной пачки. Упавшая выгрузка продолжается с места падения, а не с начала.</li>
      <li><b>Окно 9–19</b> — старт в 09:15, повтор каждые 30 минут до 19:00; выходные уходят в понедельник.</li>
      <li><b>Сверка</b> раз в неделю ловит то, что не поймали механизмы.</li></ul>
      <p>SOAP Fault — это «официальный отказ»: его разбирают так же, как 5xx в REST — повторяем позже, ничего не помечаем.</p>`,
    report: a => `Порядок шагов: ${(a.order || []).length ? Math.round(ui.orderScore(a.order, ORD_OK) * 100) + '%' : '—'}. Номер документа: ${a.num === 'public' ? 'public_id' : 'новый на каждую отправку'}; отметка: ${a.mark === 'batch' ? 'после каждой пачки' : 'в конце'}. Реакция на Fault: ${ui.quizScore(QS, a.q).ok ? 'верно' : 'неверно'}.`
  };

  // ======================================================================
  // Подход 4. Сколько людей в клубе: опрос, SSE, WebSocket
  // ======================================================================
  const LIVE = {
    poll5: { t: 'Опрос каждые 5 с', req: 720, kb: 650, lag: '≈ 2,5 с', rps: 1000, conn: '—', note: 'Три ответа из четырёх — «ничего не изменилось». Радио телефона почти не засыпает — батарея тает.' },
    poll30: { t: 'Опрос каждые 30 с', req: 120, kb: 108, lag: '≈ 15 с', rps: 167, conn: '—', note: 'Дёшево, но цифра отстаёт на полминуты. Хороший запасной вариант, если поток недоступен.' },
    sse: { t: 'SSE', req: 1, kb: 22, lag: '< 1 с', rps: 0, conn: '5 000', note: 'Один долгий HTTP-ответ: сервер дописывает события по мере изменений. Обрыв — браузер или клиент сам переподключится и пришлёт Last-Event-ID.' },
    ws: { t: 'WebSocket', req: 1, kb: 20, lag: '< 1 с', rps: 0, conn: '5 000', note: 'Тоже быстро, но это двусторонний канал со своим протоколом поверх: переподключение, пропущенные события, авторизацию при обрыве — писать самим. Говорить телефону серверу здесь нечего.' }
  };
  const EVTS = [7, 19, 33, 41, 58];
  function learnAt(m) {
    if (m === 'sse' || m === 'ws') return EVTS.map(t => t + 0.3);
    const step = m === 'poll5' ? 5 : 30;
    return EVTS.map(t => Math.ceil(t / step) * step).filter(t => t <= 60);
  }
  const SSE_SRC = `GET /v1/clubs/{clubId}/occupancy/stream HTTP/1.1
Accept: text/event-stream
Authorization: Bearer eyJhbGciOi...
Last-Event-ID: 1842

HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-store

id: 1843
event: occupancy
data: {"inside": 137, "at": "2026-10-09T18:41:07+03:00"}

: ping — раз в 25 с, чтобы прокси не закрыл соединение

id: 1844
event: occupancy
data: {"inside": 138, "at": "2026-10-09T18:41:26+03:00"}`;
  const QL = {
    q: 'Почему для счётчика «сколько людей в клубе» выбирают SSE, а не WebSocket?', seed: 'sty-l1',
    options: [
      { t: 'Данные идут только от сервера к телефону. SSE — обычный HTTP-ответ, который не заканчивается: проходит через прокси и балансировщики, сам переподключается и присылает Last-Event-ID', ok: 1, why: 'Верно. Двусторонний канал здесь не нужен, а SSE бесплатно даёт переподключение и досылку пропущенного.' },
      { t: 'WebSocket не работает на мобильных телефонах', why: 'Работает. Просто для одностороннего потока он избыточен.' },
      { t: 'SSE доставляет события быстрее WebSocket', why: 'По задержке они одинаковы. Разница — в простоте и в том, что SSE — обычный HTTP.' },
      { t: 'SSE шифрует данные, а WebSocket — нет', why: 'Оба работают поверх TLS (https:// и wss://).' }
    ]
  };
  const LPICK = [{ v: 'poll5', t: 'Опрос 5 с' }, { v: 'poll30', t: 'Опрос 30 с' }, { v: 'sse', t: 'SSE' }, { v: 'ws', t: 'WebSocket' }];
  const taskLive = {
    id: 'live', title: 'Сколько людей в клубе',
    simple: { icon: '📻', plain: 'Опрос — телефон всё время спрашивает «ну что, изменилось?». SSE — сервер сам сообщает, когда изменилось.', analogy: 'Опрос — звонить в клуб каждые пять секунд: «сколько у вас людей?». SSE — включить радиоточку: диктор говорит, когда есть новости; если связь прервалась, приёмник переподключается и просит «с того места, где я остановился». WebSocket — телефонный разговор: говорить можно обоим, но здесь клиенту сказать нечего.', tech: 'Polling — периодические GET. SSE (Server-Sent Events) — ответ <code>Content-Type: text/event-stream</code>, сервер пишет события <code>id/event/data</code>; клиент при обрыве переподключается с заголовком <code>Last-Event-ID</code>. WebSocket — двусторонний канал после Upgrade.' },
    lead: ui.brief({
      situation: `Денис хочет показывать в приложении, сколько людей сейчас в клубе: «В Пульс Химки — 137 человек». Вечером этот экран открыт у 5 000 телефонов сразу. Цифра меняется примерно раз в 10–15 секунд. Как телефону узнавать новую цифру? Можно каждые несколько секунд спрашивать «ну что, изменилось?» (<b>опрос</b>). А можно держать линию открытой, чтобы сервер сам сообщал (<b>SSE</b> или <b>WebSocket</b>).`,
      todo: [
        `Переключите способы: «Опрос каждые 5 с», «Опрос каждые 30 с», «SSE», «WebSocket». Опробуйте хотя бы три.`,
        `В блоке «Ваш выбор для счётчика» выберите способ.`,
        `Ответьте на вопрос внизу. Засчитывается, когда выбор подходит к задаче, вопрос решён и сравнено несколько способов.`
      ],
      lookTitle: 'Как читать',
      look: `Полоса — одна минута. Верхний ряд «в клубе изменилось» — моменты, когда кто-то вошёл или вышел. Нижний ряд «телефон узнал» — когда цифра на экране обновилась. Серые точки — пустые запросы с ответом «без изменений». Чем дальше нижняя точка от верхней, тем дольше на экране старая цифра. Плитки — цена для одного телефона за час (запросы, трафик) и для сервера на все 5 000 телефонов. <b>SSE</b> — сервер дописывает новости в один длинный ответ, как радио: включил и слушаешь. <b>WebSocket</b> — телефонный разговор, где говорить могут обе стороны.`
    }),
    blank: () => ({ m: 'poll5', tried: [], pick: '', q: [] }),
    reference: () => ({ m: 'sse', tried: ['poll5', 'poll30', 'sse', 'ws'], pick: 'sse', q: [0] }),
    render(el, ctx) {
      el.classList.add('sty-root');
      const a = ctx.ans; a.tried = a.tried || [];
      if (!a.tried.includes(a.m)) a.tried.push(a.m);
      const top = box(el, 'stack');
      top.innerHTML = `${ui.seg('m', Object.keys(LIVE).map(k => ({ v: k, t: LIVE[k].t })), a.m, 'accent')}
        <div data-strip></div><div data-st></div><div data-note></div>
        <details class="more"><summary>Как выглядит SSE на проводе</summary><div>${ui.code(SSE_SRC, 'text')}</div></details>
        <div class="stack tight"><div class="eyebrow">Ваш выбор для счётчика</div>${ui.seg('pick', LPICK, a.pick, 'accent')}</div>`;
      const draw = () => {
        const L = LIVE[a.m], up = learnAt(a.m), polls = a.m === 'poll5' ? Array.from({ length: 12 }, (_, i) => (i + 1) * 5) : a.m === 'poll30' ? [30, 60] : [];
        const pos = t => (t / 60 * 100).toFixed(1) + '%';
        TR.$('[data-strip]', top).innerHTML = `<div class="sty-strip">
          <div class="r"><span>в клубе изменилось</span><div class="trk">${EVTS.map(t => `<i class="dot ev" style="left:${pos(t)}"></i>`).join('')}</div></div>
          <div class="r"><span>телефон узнал</span><div class="trk">${polls.map(t => `<i class="dot q" style="left:${pos(t)}"></i>`).join('')}${up.map(t => `<i class="dot up" style="left:${pos(t)}"></i>`).join('')}</div></div>
          <div class="r"><span></span><div class="axis"><span>0 с</span><span>15</span><span>30</span><span>45</span><span>60 с</span></div></div>
          <div class="small dim">Серые точки — запросы, которые вернули «без изменений».</div></div>`;
        TR.$('[data-st]', top).innerHTML = `<div class="grid4">
          ${stat('запросов в час', L.req === 1 ? '1 поток' : L.req, 'с одного телефона', L.req > 200 ? 'bad' : '')}
          ${stat('трафик в час', L.kb + ' КБ', 'на телефон', L.kb > 200 ? 'bad' : L.kb > 50 ? 'warn' : 'ok')}
          ${stat('опоздание', L.lag, 'цифра на экране', a.m === 'poll30' ? 'warn' : a.m === 'poll5' ? '' : 'ok')}
          ${stat('нагрузка', L.rps ? L.rps + ' запр/с' : L.conn + ' соед.', L.rps ? 'на 5 000 телефонов' : 'открытых, почти без работы', L.rps >= 1000 ? 'bad' : '')}</div>`;
        TR.$('[data-note]', top).innerHTML = ui.note(a.m === 'poll5' ? 'bad' : a.m === 'sse' ? 'ok' : 'warn', LIVE[a.m].t, L.note);
      };
      ui.onSeg(top, (name, v) => {
        if (name === 'm') { a.m = v; if (!a.tried.includes(v)) a.tried.push(v); }
        if (name === 'pick') { a.pick = v; ctx.decide('Счётчик «сколько людей в клубе»', (LPICK.find(p => p.v === v) || {}).t); }
        ctx.save(); draw();
      });
      draw();
      quizBox(el, QL, ctx, 'q');
    },
    check(a) {
      const tried = Math.min(1, (a.tried || []).length / 3), q = ui.quizScore(QL, a.q);
      const P = { sse: 1, poll30: 0.5, ws: 0.5, poll5: 0 }, p = P[a.pick] || 0;
      const score = tried * 0.2 + q.score * 0.4 + p * 0.4;
      const notes = [];
      if (tried < 1) notes.push({ ok: false, html: 'Сравните хотя бы три способа: посмотрите на трафик и на то, когда телефон узнаёт об изменении.' });
      if (!a.pick) notes.push({ ok: false, html: 'Выберите способ для счётчика.' });
      else if (a.pick === 'sse') notes.push({ ok: true, html: 'SSE: свежо, дёшево, переподключение из коробки.' });
      else if (a.pick === 'poll30') notes.push({ ok: 'warn', html: 'Опрос раз в 30 с — хороший запасной вариант, но «в реальном времени» он не даёт: цифра отстаёт на полминуты.' });
      else if (a.pick === 'ws') notes.push({ ok: 'warn', html: 'WebSocket сработает, но телефону нечего говорить серверу. Переподключение и досылку пропущенного придётся писать самим.' });
      else notes.push({ ok: false, html: 'Посмотрите на нагрузку и трафик у опроса каждые 5 с: тысяча запросов в секунду ради цифры, которая меняется раз в 20 секунд.' });
      notes.push(q.ok ? { ok: true, html: 'Разница SSE и WebSocket понята.' } : { ok: false, html: 'Вопрос: в какую сторону идут данные у счётчика? И что SSE даёт при обрыве связи?' });
      return { ok: q.ok && a.pick === 'sse' && tried >= 0.66, score, notes };
    },
    explain: `<p>Для «сколько людей в клубе» данные идут только в одну сторону, меняются раз в десятки секунд и нужны многим. <b>SSE</b> — ровно под это: один долгий HTTP-ответ, события с <code>id</code>, при обрыве клиент переподключается с <code>Last-Event-ID</code> и получает пропущенное. Сервер держит соединения, но почти не работает: событие — это пара сотен байт раз в 20 секунд.</p>
      <p>Опрос каждые 5 с — тысяча запросов в секунду, три четверти впустую, и разряженная батарея. Опрос раз в 30 с — запасной вариант (в эталоне «Пульса» он описан на случай, если поток недоступен). WebSocket уместен, когда говорят обе стороны: чат с тренером, совместное редактирование.</p>`,
    report: a => `Сравнено способов: ${(a.tried || []).length}. Выбор: ${(LPICK.find(p => p.v === a.pick) || { t: '—' }).t}. SSE против WebSocket: ${ui.quizScore(QL, a.q).ok ? 'верно' : 'неверно'}.`
  };

  // ======================================================================
  // Подход 5. Какой стиль где
  // ======================================================================
  const CH = [{ v: 'rest', t: 'REST' }, { v: 'gql', t: 'GraphQL' }, { v: 'grpc', t: 'gRPC' }, { v: 'soap', t: 'SOAP' }, { v: 'sse', t: 'SSE' }, { v: 'hook', t: 'Вебхук' }, { v: 'poll', t: '202 + опрос статуса' }];
  const MROWS = [
    { id: 'home', t: 'Главный экран приложения: шесть источников данных одним запросом', ok: 'gql', alt: { rest: 'BFF — тоже REST и тоже один запрос. Засчитываем частично: в эталоне «Пульса» для главного экрана GraphQL.' } },
    { id: 'pass', t: 'Турникет спрашивает «пустить?» — ответ нужен за 300 мс', ok: 'grpc' },
    { id: 'allow', t: 'Контроллер клуба получает изменения списка пропусков', ok: 'grpc', alt: { sse: 'Поток от сервера — верная мысль, но контроллер уже говорит с нами по gRPC: server streaming WatchAllowlist.' } },
    { id: 'onec', t: 'Ежедневная выгрузка оплат в 1С франчайзи', ok: 'soap' },
    { id: 'live', t: '«Сколько людей в клубе» на экране приложения', ok: 'sse', alt: { poll: 'Опрос — запасной вариант, но не основной.' } },
    { id: 'psp', t: 'ПэйПоинт сообщает, что оплата прошла', ok: 'hook' },
    { id: 'fpvisit', t: 'Сообщаем ФитПассу, что их клиент прошёл в клуб', ok: 'hook' },
    { id: 'fpbook', t: 'ФитПасс записывает своего клиента на занятие', ok: 'rest' },
    { id: 'report', t: 'Директор заказал выгрузку выручки за месяц — файл готовится минуту', ok: 'poll' },
    { id: 'site', t: 'Сайт показывает публичное расписание через CDN', ok: 'rest' }
  ];
  const J_ZOO = {
    id: 'sty-zoo', q: 'Тимур: «Зачем нам зоопарк — REST, GraphQL, gRPC, SOAP, SSE? Давайте всё на REST». Ответьте ему.',
    rubric: [
      'Основа и так REST: приложение, сайт, кабинет, ФитПасс, оплаты; другие стили — точечно, где REST не справляется',
      'SOAP — не наш выбор: 1С франчайзи, «REST не будет»',
      'gRPC — турникет: 300 мс, соединение держится, потоки для списка пропусков и досылки событий, вендор его умеет',
      'GraphQL — только главный экран своего приложения (6 запросов → 1), партнёрам не даём',
      'SSE — односторонний поток поверх обычного HTTP; иначе опрос с лишним трафиком',
      'Каждый стиль — цена в поддержке, поэтому их ровно столько, сколько требуют ограничения'
    ],
    reference: 'Тимур, основа и так REST: приложение, сайт, кабинет, ФитПасс и ПэйПоинт. Остальные стили — только там, где REST упирается в ограничение. SOAP — не наш выбор: франчайзи 1С сделал SOAP-сервис, REST там не будет. gRPC — для турникета: решение за 300 мс, соединение держится, а потоки дают свежий список пропусков и досылку событий после офлайна; вендор gRPC умеет. GraphQL — только главный экран своего приложения: шесть запросов превращаются в один; партнёрам его не даём. SSE — односторонний поток для счётчика людей поверх обычного HTTP, иначе опрос с лишним трафиком. Каждый стиль стоит поддержки, поэтому их ровно столько, сколько требуют ограничения, — и все они по силам команде на Java/Spring.'
  };
  const taskPick = {
    id: 'pick', title: 'Какой стиль где',
    simple: { icon: '🧰', plain: 'Стиль интеграции выбирают по ограничениям: кто начинает разговор, как быстро нужен ответ, в какую сторону идут данные и чьи правила.', analogy: 'Ящик с инструментами: молоток для гвоздей, отвёртка для шурупов. Можно забить шуруп молотком — но держаться будет плохо.', tech: 'REST — ресурсы и кэш; GraphQL — гибкая выборка для своего клиента; gRPC — быстрые вызовы и потоки между сервисами; SOAP — строгий XML-контракт у легаси; SSE — поток сервер → клиент; вебхук — внешняя система сама сообщает о событии; 202 + опрос — долгая операция.' },
    lead: ui.brief({
      situation: `За неделю вы применили в «Пульсе» несколько способов связи систем — их называют стилями интеграции. Тимур ворчит: «Зачем зоопарк? Давайте всё на REST». Теперь соберите картину целиком: какой стиль где стоит и почему. Стиль выбирают не по моде, а по условиям. Кто начинает разговор? Как быстро нужен ответ? Кто клиент — наш или чужой? Можем ли мы вообще выбирать?`,
      todo: [
        `Для каждой из 10 ситуаций выберите стиль в списке «Стиль…».`,
        `Ответьте Тимуру своими словами (от 120 знаков) и сверьте с Верой или с эталоном.`,
        `Засчитывается, когда верно не меньше 9 из 10 и ответ покрывает от 60 % пунктов.`
      ],
      lookTitle: 'Подсказка по стилям',
      look: `<b>REST</b> — обычные запросы к адресам, понятные всем. <b>GraphQL</b> — экран сам перечисляет нужные поля, всё одним запросом. <b>gRPC</b> — быстрый вызов по готовому бланку через открытую линию. <b>SOAP</b> — строгие XML-письма в конверте, так говорит 1С. <b>SSE</b> — сервер сам шлёт новости по открытой линии. <b>Вебхук</b> — другая система сама стучится к нам (или мы к ней), когда что-то случилось. <b>202 + опрос статуса</b> — «заказ принят, готовлю», а клиент потом спрашивает «готово?».`
    }),
    blank: () => ({ m: {}, j: {} }),
    reference: () => ({ m: Object.fromEntries(MROWS.map(r => [r.id, r.ok])), j: { text: J_ZOO.reference, self: J_ZOO.rubric.map(() => true) } }),
    render(el, ctx) {
      el.classList.add('sty-root');
      const a = ctx.ans; a.m = a.m || {};
      let reveal = null;
      if (ctx.result) {
        reveal = {};
        MROWS.forEach(r => { const v = a.m[r.id]; if (!v) return; reveal[r.id] = v === r.ok ? { s: 'ok' } : r.alt && r.alt[v] ? { s: 'warn', why: r.alt[v] } : { s: 'bad' }; });
      }
      const mt = box(el);
      ui.match(mt, { rows: MROWS.map(r => ({ id: r.id, t: r.t })), choices: CH, value: a.m, readonly: ctx.readonly, reveal, placeholder: 'Стиль…', onChange: v => { a.m = v; ctx.save(); } });
      const j = box(el, 'card');
      ui.justify(j, Object.assign({}, J_ZOO, { value: a.j, readonly: ctx.readonly, minLen: 120, onChange: v => { a.j = v; ctx.save(); ctx.decide('Зачем несколько стилей интеграции', v.text || ''); } }));
    },
    check(a) {
      const m = a.m || {};
      let pts = 0; const notes = [];
      const HINT = {
        home: 'экрану нужны данные из шести мест за один поход по сети, и клиент наш.',
        pass: 'ответ нужен за 300 мс, соединение лучше держать открытым, вендор умеет не только REST.',
        allow: 'это поток изменений от сервера к контроллеру, а контроллер уже говорит с нами на одном протоколе.',
        onec: 'здесь не мы выбираем: франчайзи уже сделал сервис, «REST не будет».',
        live: 'данные идут только от сервера к телефону, часто и многим.',
        psp: 'событие случается у них, и они сами сообщают нам о нём.',
        fpvisit: 'событие случается у нас, а узнать о нём хочет партнёр.',
        fpbook: 'внешний партнёр, лимиты, кэш, понятные коды ответа.',
        report: 'операция долгая — ответ сразу дать нельзя.',
        site: 'публичные данные, CDN и кэш.'
      };
      MROWS.forEach(r => {
        const v = m[r.id];
        if (!v) { notes.push({ ok: false, html: `«${esc(r.t)}» — не выбрано.` }); return; }
        if (v === r.ok) pts += 1;
        else if (r.alt && r.alt[v]) { pts += 0.6; notes.push({ ok: 'warn', html: `«${esc(r.t)}» — ${r.alt[v]}` }); }
        else notes.push({ ok: false, html: `«${esc(r.t)}» — подумайте: ${HINT[r.id]}` });
      });
      const ms = pts / MROWS.length, js = ui.justifyScore(a.j);
      notes.push(js >= 0.6 ? { ok: true, html: 'Ответ Тимуру засчитан.' } : { ok: false, html: 'Ответ Тимуру: объясните, почему каждый не-REST стиль появился именно там, где появился.' });
      return { ok: ms >= 0.85 && js >= 0.6, score: ms * 0.6 + js * 0.4, summary: `Сопоставлено верно: ${Math.round(ms * 100)}%.`, notes: notes.slice(0, 8) };
    },
    explain: `<p>Почти всё у «Пульса» — REST. Остальные стили появляются только там, где REST упирается в ограничение:</p>
      <ul class="checks"><li><b>SOAP</b> — чужие правила: 1С франчайзи.</li><li><b>gRPC</b> — 300 мс и потоки между нашим сервером и контроллером клуба.</li><li><b>GraphQL</b> — гибкая выборка для своего приложения.</li><li><b>SSE</b> — поток сервер → телефон.</li><li><b>Вебхуки</b> — когда о событии сообщает тот, у кого оно случилось: ПэйПоинт нам, мы ФитПассу.</li><li><b>202 + опрос статуса</b> — долгая операция без брокеров и без висящего соединения.</li></ul>
      <p>Брокеры сообщений здесь не нужны: асинхронность закрывают вебхуки, опрос, пакетные выгрузки и SSE. Лишний стиль — это лишняя поддержка, мониторинг и компетенции.</p>`,
    report: a => `${MROWS.map(r => `- ${r.t} → ${(CH.find(c => c.v === (a.m || {})[r.id]) || { t: '—' }).t}`).join('\n')}\n\nОтвет Тимуру: ${(a.j && a.j.text) || '—'}`
  };

  TR.stage({
    id: 'styles', act: 3, order: 160, slot: 'Пт 15:00', title: 'gRPC, SOAP, SSE',
    when: 'пятница, 15:00 · переговорная «Пилатес» · Тимур, Ирина, Денис',
    intro: [
      { who: 'timur', html: '«Турникеты, 1С и живой счётчик людей — три разных мира. Вендор турникетов предлагает gRPC, у 1С только SOAP, а Денис хочет цифру „в реальном времени“. И везде что-то может отвалиться посередине».' },
      { who: 'vera', html: 'Сегодня выбираем стиль не по моде, а по ограничениям: 300 мс у турникета, интернет, который пропадает в области, окно 9–19 у 1С и тысячи телефонов, которые хотят свежую цифру. И в каждом случае смотрим, что будет при повторе.' },
      { who: 'ira', html: '«Только, пожалуйста, чтобы выручка в 1С больше не задваивалась. В прошлый раз неделю сверяли».' }
    ],
    facts: ['F-turnstile-vendor', 'F-turnstile-fast', 'F-offline', 'F-1c-soap', 'F-1c-dup', 'F-live'],
    glossary: [
      { term: 'gRPC', simple: 'Вызов функции на другом сервере по заранее заготовленному бланку, через линию, которая всё время открыта. Как рация охранника с диспетчером.', tech: 'RPC-фреймворк поверх HTTP/2: контракт в <code>.proto</code>, генерация кода, Protobuf, дедлайны, потоки (server/client/bidirectional streaming).' },
      { term: 'Protobuf', simple: 'Бланк с пронумерованными графами: пишешь «3: t-07-02», а не «номер турникета: t-07-02». Короче и быстрее читается.', tech: 'Бинарный формат: на проводе номер поля, тип и значение, имён нет. Номера полей вечные: удалённые закрывают <code>reserved</code>, тип не меняют.' },
      { term: 'Дедлайн', simple: 'Если диспетчер не ответил за 300 мс, охранник решает сам — очередь ждать не будет.', tech: 'Крайний срок вызова, задаёт клиент и передаёт серверу. По истечении — статус <code>DEADLINE_EXCEEDED</code>, сервер прекращает работу.' },
      { term: 'Локальный список пропусков', simple: 'Список гостей у охранника на случай, если рация сломалась. Чем он свежее, тем меньше ошибок.', tech: 'Копия действующих пропусков на контроллере клуба с датами окончания; обновляется потоком <code>WatchAllowlist</code>.' },
      { term: 'Буфер событий', simple: 'Тетрадка охранника с пронумерованными строками: записал проходы, связь вернулась — сдал в офис. Сдал дважды — по номерам видно, что это те же строки.', tech: 'Очередь событий прохода на контроллере; досылка <code>ReportPassages</code> с <code>turnstile_event_id</code>; дубли отсекает уникальный ключ в <code>visit</code>.' },
      { term: 'SOAP', simple: 'Заказное письмо по строгому бланку в конверте. 1С говорит только так.', tech: 'XML-протокол: <code>Envelope</code> → <code>Header</code> + <code>Body</code>; контракт в WSDL; обычно поверх HTTP POST.' },
      { term: 'SOAP Fault', simple: 'Официальный бланк отказа с кодом причины.', tech: 'Элемент <code>Fault</code> в теле ответа: <code>faultcode</code>, <code>faultstring</code>, <code>detail</code>; в SOAP 1.1 приходит с HTTP 500.' },
      { term: 'SSE (Server-Sent Events)', simple: 'Радиоточка: сервер вещает, вы слушаете. Связь прервалась — приёмник переподключается и просит «с того места, где я остановился».', tech: 'HTTP-ответ <code>text/event-stream</code>, события <code>id/event/data</code>, автоматическое переподключение с <code>Last-Event-ID</code>. Только сервер → клиент.' },
      { term: 'WebSocket', simple: 'Телефонный разговор: говорить могут обе стороны в любой момент.', tech: 'Двусторонний канал после HTTP Upgrade. Переподключение и досылку пропущенного реализуют сами.' },
      { term: 'Опрос (polling)', simple: 'Звонить в клуб каждые пять минут: «ну что, изменилось?». Чаще всего ответ — «нет».', tech: 'Периодические GET-запросы. Просто, но тратит трафик и нагрузку впустую; с ETag/304 дешевле.' }
    ],
    outro: 'Неделя интеграций позади. REST — основа, а остальное появляется там, где REST упирается в ограничение: gRPC и офлайн-список для турникета, идемпотентный SOAP для 1С, SSE для живой цифры, GraphQL для экрана приложения. Заметили общее? Везде, где есть повтор, есть и защита от дубля: ключ события, номер документа, Last-Event-ID. На следующей неделе соберём всё в сквозные сценарии и проверим ночью инцидентов.',
    tasks: [taskPass, taskOffline, taskSoap, taskLive, taskPick]
  });
})();
