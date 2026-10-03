/* Теория «Как это работает» для недель 3–4: безопасность (security), стили интеграции (styles),
   сквозные сценарии (flows), ночь инцидентов (incidents) и защита решения (final).
   Разделы без проверки: преподаватель показывает на экране, студенты повторяют у себя.
   Механизм объясняем на соседнем примере — ответы практики здесь не выдаём. */
'use strict';
(function () {
  const TR = window.TR, ui = TR && TR.ui, esc = TR && TR.esc;
  if (!TR || !ui) return;

  if (!document.getElementById('thi-style')) document.head.insertAdjacentHTML('beforeend', `<style id="thi-style">
    .thi-set { display: grid; grid-template-columns: minmax(110px, 180px) minmax(0, 1fr); gap: 8px 12px; align-items: center; }
    .thi-set > .lbl { font-size: 13px; color: var(--text-2); min-width: 0; }
    .thi-set > * { min-width: 0; transition: opacity .2s; }
    .thi-set > .thi-off { opacity: .4; }
    @media (max-width: 560px) { .thi-set { grid-template-columns: minmax(0, 1fr); gap: 4px; } .thi-set > .lbl { margin-top: 6px; } }
    .thi-gates { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    @media (max-width: 860px) { .thi-gates { grid-template-columns: minmax(0, 1fr); } }
    .thi-gate { border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; background: var(--surface); display: grid; gap: 4px; align-content: start; min-width: 0; }
    .thi-gate .gs { font: 600 10.5px/1.2 var(--f-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--text-muted); }
    .thi-gate .gq { font: 600 15px/1.3 var(--f-brand); }
    .thi-gate .gr { font-size: 13px; color: var(--text-2); }
    .thi-gate.pass { border-color: color-mix(in srgb, var(--ok) 45%, transparent); background: var(--ok-soft); }
    .thi-gate.pass .gq { color: var(--ok); }
    .thi-gate.stop { border-color: var(--bad); background: var(--bad-soft); box-shadow: 0 0 0 1px var(--bad) inset; }
    .thi-gate.stop .gq { color: var(--bad); }
    .thi-gate.skip { opacity: .45; border-style: dashed; }
    .thi-code { font: 700 30px/1 var(--f-mono); }
    .thi-code.ok { color: var(--ok); } .thi-code.bad { color: var(--bad); } .thi-code.warn { color: var(--warn); }
    .thi-kv { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 10px; font-size: 13.5px; align-items: baseline; }
    .thi-kv > b { font-weight: 600; color: var(--text-2); }
    .thi-mono { font: 12.5px/1.5 var(--f-mono); overflow-wrap: anywhere; }
    .thi-jwt { font: 13px/1.65 var(--f-mono); word-break: break-all; background: var(--code-bg); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; }
    .thi-jwt [data-pt] { cursor: pointer; border-radius: 4px; padding: 0 1px; }
    .thi-jwt [data-pt]:focus-visible { outline: 2px solid var(--accent); }
    .thi-jwt .h { color: var(--bad); } .thi-jwt .p { color: var(--violet); } .thi-jwt .s { color: var(--info); }
    .thi-jwt [data-pt][aria-pressed="true"] { background: var(--surface-3); box-shadow: 0 0 0 1px currentColor; }
    .thi-jwt .dot { color: var(--text-muted); font-weight: 700; }
    .thi-jwt .tamp { text-decoration: underline wavy var(--bad); text-underline-offset: 3px; }
    .thi-lines { background: var(--code-bg); border: 1px solid var(--border); border-radius: 10px; padding: 6px 0; overflow-x: auto; }
    .thi-ln { display: block; width: 100%; min-width: max-content; text-align: left; border: 0; border-left: 3px solid transparent; background: transparent; color: var(--text); font: 12.5px/1.6 var(--f-mono); padding: 0 12px; white-space: pre; cursor: pointer; }
    .thi-ln:hover { background: var(--surface-3); }
    .thi-ln.on { background: var(--accent-soft); border-left-color: var(--accent); }
    .thi-cells { display: grid; grid-template-columns: repeat(auto-fill, minmax(10px, 1fr)); gap: 2px; }
    .thi-cells i { display: block; height: 10px; border-radius: 2px; background: var(--surface-3); }
    .thi-cells i.ok { background: var(--ok); } .thi-cells i.bad { background: var(--bad); } .thi-cells i.go { background: var(--info); }
    .thi-legend { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12.5px; color: var(--text-2); }
    .thi-legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 5px; vertical-align: -1px; background: var(--surface-3); }
    .thi-legend i.ok { background: var(--ok); } .thi-legend i.bad { background: var(--bad); } .thi-legend i.go { background: var(--info); }
    .thi-box { border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; background: var(--surface); display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; align-content: start; min-width: 0; }
    .thi-box > * { min-width: 0; }
    .thi-box .btn, .thi-step .btn { white-space: normal; text-align: left; }
    .thi-box > h4 { font: 600 14.5px/1.3 var(--f-brand); margin: 0; }
    .thi-verdict { border-radius: 10px; padding: 10px 12px; text-align: center; font: 700 19px/1.2 var(--f-brand); text-transform: uppercase; letter-spacing: .04em; }
    .thi-verdict.ok { background: var(--ok-soft); color: var(--ok); } .thi-verdict.bad { background: var(--bad-soft); color: var(--bad); }
    .thi-verdict.warn { background: var(--warn-soft); color: var(--warn); } .thi-verdict.idle { background: var(--surface-2); color: var(--text-muted); }
    .thi-verdict small { display: block; font: 400 13px/1.4 var(--f-body, inherit); color: var(--text-2); margin-top: 4px; text-transform: none; letter-spacing: 0; }
    .thi-log { max-height: 190px; overflow: auto; font-size: 12px; white-space: pre-wrap; }
    .thi-row { cursor: pointer; }
    .thi-row:hover td { background: var(--surface-3); }
    .thi-sty { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px; }
    .thi-sty > div { border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; background: var(--surface); display: grid; gap: 6px; align-content: start; min-width: 0; transition: opacity .2s; }
    .thi-sty > div.top { border-color: var(--ok); box-shadow: 0 0 0 1px var(--ok) inset; background: var(--ok-soft); }
    .thi-sty > div.alt { border-color: color-mix(in srgb, var(--info) 55%, transparent); box-shadow: 0 0 0 1px color-mix(in srgb, var(--info) 55%, transparent) inset; }
    .thi-sty > div.dim { opacity: .5; }
    .thi-sty .nm { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; font: 600 15px/1.2 var(--f-brand); }
    .thi-sty .chips { display: flex; flex-wrap: wrap; gap: 4px; }
    .thi-sty .chip { font-size: 11.5px; padding: 1px 8px; white-space: normal; }
    .thi-step { border: 1px solid var(--border); border-radius: 12px; background: var(--surface); display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; padding: 12px 14px; min-width: 0; }
    .thi-step.lock { opacity: .55; border-style: dashed; }
    .thi-step > header { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .thi-step .no { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font: 700 12.5px/1 var(--f-mono); background: var(--accent-soft); color: var(--accent); flex: none; }
    .thi-step.lock .no { background: var(--surface-3); color: var(--text-muted); }
    .thi-step h4 { font: 600 15px/1.3 var(--f-brand); margin: 0; flex: 1 1 200px; min-width: 0; }
    .thi-why { display: grid; gap: 6px; }
    .thi-why > div { border-left: 3px solid var(--accent); padding: 5px 10px; background: var(--surface-2); border-radius: 0 8px 8px 0; font-size: 14px; }
    .thi-why > div b { color: var(--accent); }
    .thi-why > div.root { border-left-color: var(--ok); background: var(--ok-soft); }
    .thi-why > div.root b { color: var(--ok); }
    .thi-meas { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 10px; align-items: center; padding: 8px 0; border-top: 1px dashed var(--border); }
    .thi-meas .why { grid-column: 1 / -1; font-size: 13px; }
    .thi-meas .why.ok { color: var(--ok); } .thi-meas .why.bad { color: var(--bad); }
    @media (max-width: 520px) { .thi-meas { grid-template-columns: minmax(0, 1fr); } }
    .thi-hyp { display: grid; gap: 6px; }
    .thi-hyp button { text-align: left; border: 1px solid var(--border-strong); background: var(--surface-2); border-radius: 9px; padding: 8px 11px; font-size: 14px; color: var(--text-2); }
    .thi-hyp button[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); color: var(--text); }
    .thi-hyp button.ok { border-color: var(--ok); } .thi-hyp button.bad { border-color: color-mix(in srgb, var(--bad) 60%, transparent); }
    .thi-phrase { border: 1px solid var(--border-strong); border-radius: 12px; padding: 14px 16px; background: var(--surface); font-size: 15.5px; line-height: 1.75; }
    .thi-phrase span { border-radius: 4px; padding: 1px 2px; }
    .thi-phrase .f { background: var(--info-soft); } .thi-phrase .b { background: var(--bad-soft); } .thi-phrase .g { background: var(--ok-soft); } .thi-phrase .c { background: var(--warn-soft); }
    .thi-phrase .weak { text-decoration: underline wavy var(--bad); text-underline-offset: 4px; }
    .thi-slots { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    @media (max-width: 860px) { .thi-slots { grid-template-columns: minmax(0, 1fr); } }
    .thi-slot { display: grid; gap: 6px; align-content: start; min-width: 0; }
    .thi-slot .sl { font: 600 11px/1.2 var(--f-mono); letter-spacing: .1em; text-transform: uppercase; }
    .thi-slot .sl.f { color: var(--info); } .thi-slot .sl.b { color: var(--bad); } .thi-slot .sl.g { color: var(--ok); } .thi-slot .sl.c { color: var(--warn); }
    .thi-opts { display: grid; gap: 6px; }
    .thi-opts button { text-align: left; border: 1px solid var(--border-strong); background: var(--surface-2); border-radius: 9px; padding: 7px 10px; font-size: 13.5px; color: var(--text-2); }
    .thi-opts button[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); color: var(--text); }
    .thi-thread { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 13.5px; }
    .thi-thread > span.k { border: 1px solid var(--border-strong); border-radius: 10px; padding: 4px 10px; background: var(--surface-2); min-width: 0; }
    .thi-thread > span.a { color: var(--text-muted); }
  </style>`);

  // ---------- общие помощники ----------
  const L = (id, t, sub) => ({ id, t, sub });
  const pad = n => String(n).padStart(2, '0');
  const stat = (k, v, kind, s) => `<div class="stat"><span class="k">${k}</span><span class="v ${kind || ''}">${v}</span>${s ? `<span class="s">${s}</span>` : ''}</div>`;
  const setRow = (key, label, opts, cur) => `<div class="lbl" data-row="${key}">${label}</div><div data-row="${key}">${ui.seg(key, opts, cur, 'accent')}</div>`;

  // проигрыватель сценариев: переключатель вариантов + ui.seq + итог в конце
  function walk(el, cfg) {
    let cur = cfg.scenarios[0].id;
    el.innerHTML = `<div class="stack">${cfg.scenarios.length > 1 ? `<div class="row"><span class="small dim">${cfg.label || 'Вариант'}:</span>${ui.seg('sc', cfg.scenarios.map(s => ({ v: s.id, t: s.t })), cur, 'accent')}</div>` : ''}<div data-w></div><div data-sum></div></div>`;
    const box = TR.$('[data-w]', el), sum = TR.$('[data-sum]', el);
    function show(id) {
      cur = id; const sc = cfg.scenarios.find(s => s.id === id);
      box.innerHTML = ''; sum.innerHTML = '';
      const d = document.createElement('div'); box.appendChild(d);
      ui.seq(d, { lanes: sc.lanes || cfg.lanes, steps: sc.steps, laneW: cfg.laneW, title: sc.t, hint: sc.hint || 'Нажимайте «Шаг →» и читайте пояснение под схемой. «Проиграть» покажет всё подряд.', onEnd() { sum.innerHTML = sc.sum ? ui.note(sc.sumKind || '', 'Итог', sc.sum) : ''; } });
    }
    ui.onSeg(el, (n, v) => { if (n === 'sc') show(v); });
    show(cur);
  }

  // ---------- SHA-256 и HMAC без внешних библиотек (для живых PKCE и JWT) ----------
  const enc = new TextEncoder();
  const K256 = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  function sha256(msg) {
    const l = msg.length, nb = ((l + 9 + 63) >> 6) << 6, m = new Uint8Array(nb); m.set(msg); m[l] = 0x80;
    const dv = new DataView(m.buffer); dv.setUint32(nb - 4, (l * 8) >>> 0); dv.setUint32(nb - 8, Math.floor(l / 0x20000000));
    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], w = new Uint32Array(64);
    const r = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < nb; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
      for (let i = 16; i < 64; i++) { const a = w[i - 15], b = w[i - 2]; w[i] = (w[i - 16] + (r(a, 7) ^ r(a, 18) ^ (a >>> 3)) + w[i - 7] + (r(b, 17) ^ r(b, 19) ^ (b >>> 10))) >>> 0; }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K256[i] + w[i]) >>> 0;
        const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      [a, b, c, d, e, f, g, h].forEach((v, i) => { H[i] = (H[i] + v) >>> 0; });
    }
    const out = new Uint8Array(32);
    H.forEach((v, i) => { out[i * 4] = v >>> 24; out[i * 4 + 1] = (v >>> 16) & 255; out[i * 4 + 2] = (v >>> 8) & 255; out[i * 4 + 3] = v & 255; });
    return out;
  }
  function hmac(key, msg) {
    const kk = new Uint8Array(64); kk.set(key.length > 64 ? sha256(key) : key);
    const inner = new Uint8Array(64 + msg.length); inner.set(kk.map(x => x ^ 0x36)); inner.set(msg, 64);
    const outer = new Uint8Array(96); outer.set(kk.map(x => x ^ 0x5c)); outer.set(sha256(inner), 64);
    return sha256(outer);
  }
  const b64u = bytes => { let s = ''; bytes.forEach(b => { s += String.fromCharCode(b); }); return btoa(s).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); };
  const b64uJson = o => b64u(enc.encode(JSON.stringify(o)));

  // =====================================================================
  // security · 1. Кто вы и что вам можно (к заданию authz)
  // =====================================================================
  const AU_ROWS = [
    { k: 'tok', t: 'Токен в запросе', o: [{ v: 'yes', t: 'есть' }, { v: 'no', t: 'нет' }] },
    { k: 'exp', t: 'Срок токена', o: [{ v: 'ok', t: 'действует' }, { v: 'old', t: 'истёк 2 мин назад' }] },
    { k: 'role', t: 'Роль в токене', o: [{ v: 'client', t: 'клиент' }, { v: 'admin', t: 'администратор' }] },
    { k: 'where', t: 'Куда идём', o: [{ v: 'mem', t: 'абонемент по номеру' }, { v: 'list', t: 'раздел «Все клиенты»' }] },
    { k: 'whose', t: 'Чей абонемент', o: [{ v: 'own', t: 'Анны' }, { v: 'foreign', t: 'чужой' }, { v: 'none', t: 'такого нет' }] }
  ];
  const AU_ID = { own: '3f6b2a90-…', foreign: 'b71c0e4d-…', none: '0a9d2e5c-…' };
  const AU_LBL = { 401: 'кто вы?', 403: 'вам нельзя', 404: 'такого нет', 200: 'всё законно' };
  function authDecide(s) {
    const G = [
      { q: 'Кто вы?', sub: 'аутентификация', st: 'skip', r: 'до этого вопроса не дошли' },
      { q: 'Вам сюда можно?', sub: 'роль и права', st: 'skip', r: 'до этого вопроса не дошли' },
      { q: 'Это ваше?', sub: 'владелец объекта', st: 'skip', r: 'до этого вопроса не дошли' }
    ];
    const R = (code, why, app) => ({ G, code, why, app });
    const who = s.role === 'admin' ? 'администратор клуба' : 'Анна, клиент';
    if (s.tok === 'no') {
      G[0].st = 'stop'; G[0].r = 'Токена нет — кто пришёл, неизвестно.';
      return R(401, 'Остановились на <b>первом</b> вопросе. В запросе нет заголовка <code>Authorization</code>, и сервер не знает, кто пришёл. Куда этот человек идёт, сервер даже не смотрит.', 'Приложение покажет экран входа.');
    }
    if (s.exp === 'old') {
      G[0].st = 'stop'; G[0].r = 'Пропуск настоящий, но просрочен.';
      return R(401, 'Остановились на <b>первом</b> вопросе. Токен настоящий, но просрочен: access-токен «Пульса» живёт 15 минут. Просроченный пропуск — всё равно что никакого.', 'Приложение тихо обменяет refresh-токен на новый access-токен и повторит запрос. Анна ничего не заметит. Не получится — покажет экран входа.');
    }
    G[0].st = 'pass'; G[0].r = `Подпись цела, срок не вышел: это ${who}.`;
    if (s.where === 'list') {
      if (s.role === 'client') {
        G[1].st = 'stop'; G[1].r = 'Роль «клиент» в этот раздел не пускает.';
        return R(403, 'Остановились на <b>втором</b> вопросе. Кто это, известно: Анна, клиент. Но список всех клиентов открыт только администраторам. Скрывать тут нечего: что такой раздел есть, не секрет. Поэтому сервер честно отвечает «вам нельзя».', 'Приложение покажет «Нет доступа». Входить заново бесполезно: права от этого не появятся.');
      }
      G[1].st = 'pass'; G[1].r = 'Роль «администратор» сюда пускает.'; G[2].r = 'для списка не нужен: он общий для роли';
      return R(200, 'Нужные вопросы пройдены. Третий вопрос для списка не задаётся: администратор видит клиентов своего клуба по роли, а не потому, что они «его».', 'Кабинет администратора покажет список клиентов.');
    }
    G[1].st = 'pass'; G[1].r = 'Смотреть абонементы можно и клиенту, и администратору.';
    if (s.whose === 'none') {
      G[2].st = 'stop'; G[2].r = 'Абонемента с таким номером нет.';
      return R(404, 'Остановились на <b>третьем</b> вопросе. Такого абонемента нет вообще. Ответ — 404 «не найдено». Запомните, как он выглядит: дальше он понадобится.', 'Приложение покажет «Не найдено».');
    }
    if (s.whose === 'own' || s.role === 'admin') {
      G[2].st = 'pass'; G[2].r = s.role === 'admin' ? 'Администратору можно смотреть абонементы клиентов своего клуба.' : 'Абонемент принадлежит Анне.';
      return R(200, s.role === 'admin' ? 'Все три вопроса пройдены. Абонемент не его, но правила клуба разрешают администратору смотреть абонементы клиентов. Владельца проверяют с учётом роли, а не «никогда».' : 'Все три вопроса пройдены: пропуск цел и свеж, клиентам абонементы смотреть можно, и этот абонемент — Анны.', 'Приложение покажет абонемент.');
    }
    G[2].st = 'stop'; G[2].r = 'Абонемент есть, но он Петра, а не Анны.';
    return R(404, 'Остановились на <b>третьем</b> вопросе. Абонемент существует, но принадлежит Петру. Для Анны его «нет»: сервер отвечает ровно так же, как на несуществующий номер — 404. Почему не 403, смотрите внизу.', 'Приложение покажет «Не найдено».');
  }
  function authRes(s, d) {
    const prob = (type, title) => ({ type: 'https://api.puls.fit/problems/' + type, title, status: d.code });
    if (d.code === 401) return { status: 401, headers: [['WWW-Authenticate', s.tok === 'no' ? 'Bearer' : 'Bearer error="invalid_token", error_description="token expired"'], ['Content-Type', 'application/problem+json']], body: prob('unauthorized', 'Нужен вход') };
    if (d.code === 403) return { status: 403, headers: { 'Content-Type': 'application/problem+json' }, body: prob('forbidden', 'Нет доступа') };
    if (d.code === 404) return { status: 404, headers: { 'Content-Type': 'application/problem+json' }, body: prob('not-found', 'Не найдено') };
    if (s.where === 'list') return { status: 200, body: { items: [{ id: '8c2f6b1e-…', fullName: 'Анна Смирнова' }, { id: '1d9a4c07-…', fullName: 'Пётр Орлов' }], next: 'eyJhZnRlciI6…' } };
    return { status: 200, body: s.whose === 'own' ? { id: AU_ID.own, plan: 'Вся сеть · 12 мес', endsOn: '2027-03-31', status: 'active' } : { id: AU_ID.foreign, client: 'Пётр Орлов', plan: 'Дневной · 3 мес', endsOn: '2026-12-20', status: 'active' } };
  }
  const AU_ENUM = [[5001, 'чужой'], [5002, 'нет'], [5003, 'чужой'], [5004, 'Анны'], [5005, 'нет'], [5006, 'чужой']];
  const howAuthn = {
    id: 'how-authn', covers: ['authz'], title: 'Как это работает: кто вы и что вам можно', free: true, noReset: true,
    simple: {
      icon: '🛂',
      plain: 'Сервер задаёт каждому запросу три вопроса по очереди: кто вы, можно ли вам сюда, ваше ли это. На каком вопросе запрос споткнулся, такой код ответа и вернётся.',
      analogy: 'Охранник в клубе. Сначала смотрит карту: нет карты или она просрочена — «кто вы?». Карта есть, но клиент идёт в служебное помещение — «вам нельзя». Клиент пытается открыть чужой шкафчик — охранник делает вид, что такого шкафчика нет. Все три вопроса пройдены — проходите.',
      tech: '1) Аутентификация — проверка токена: есть ли он, цела ли подпись, не вышел ли срок. Нет — <code>401 Unauthorized</code> и заголовок <code>WWW-Authenticate</code>. 2) Авторизация по роли и правам (scope): прав нет — <code>403 Forbidden</code>. 3) Проверка владельца объекта: объект чужой или его нет — <code>404 Not Found</code>, в обоих случаях одинаково. Всё пройдено — <code>200 OK</code>.'
    },
    lead: ui.brief({
      situation: 'Анна открывает в приложении свой абонемент. Приложение шлёт запрос серверу «Пульса». В заголовке <code>Authorization</code> лежит <b>токен</b> — электронный пропуск, который Анна получила при входе по SMS-коду. В токене записано, кто она и какая у неё роль. Сервер не верит на слово и на каждый запрос заново проходит три проверки.',
      todo: ['Меняйте переключатели: есть ли токен, не истёк ли он, какая роль, куда идём и чей абонемент.', 'Смотрите на три «двери» проверки: на какой запрос остановился и какой код вернул сервер.', 'Добейтесь всех четырёх ответов: 401, 403, 404 и 200. Для каждого скажите вслух, на каком вопросе остановились.', 'Внизу сравните, что узнаёт взломщик, если на чужое отвечать 403, а не 404.'],
      look: 'Двери слева направо — порядок вопросов. Зелёная — проверка пройдена, красная — здесь остановились, серая — до неё не дошли. Бледные переключатели сейчас ни на что не влияют: запрос до них не доходит. Под дверями — запрос приложения и ответ сервера. <b>Код ответа</b> — короткое число, по которому приложение понимает, что делать: показать экран входа, «нет доступа» или «не найдено».'
    }),
    render(el) {
      const s = { tok: 'yes', exp: 'ok', role: 'client', where: 'mem', whose: 'own' };
      let pol = '403';
      el.innerHTML = `<div class="stack">
        <div class="thi-set">${AU_ROWS.map(r => setRow(r.k, r.t, r.o, s[r.k])).join('')}</div>
        <div class="thi-gates" data-gates></div>
        <div data-why></div>
        <div class="grid2" style="align-items:start"><div data-req></div><div data-res></div></div>
        <div class="card flat stack tight"><div class="eyebrow">Почему чужое — 404, а не 403</div>
          <p class="small muted">Взломщик вошёл как обычный клиент и перебирает номера абонементов подряд. Сравните два способа отвечать на чужое.</p>
          <div class="row"><span class="small dim">На чужой абонемент сервер отвечает:</span>${ui.seg('pol', [{ v: '403', t: '403 «не ваше»' }, { v: '404', t: '404 «нет такого»' }], pol, 'accent')}</div>
          <div data-enum></div></div></div>`;
      function draw() {
        const d = authDecide(s);
        const stop = d.G.findIndex(g => g.st === 'stop');
        const off = { exp: s.tok === 'no', role: s.tok === 'no' || s.exp === 'old', where: s.tok === 'no' || s.exp === 'old', whose: s.tok === 'no' || s.exp === 'old' || s.where === 'list' || (stop >= 0 && stop < 2) };
        TR.$$('[data-row]', el).forEach(x => x.classList.toggle('thi-off', !!off[x.dataset.row]));
        const kind = d.code === 200 ? 'ok' : 'bad';
        TR.$('[data-gates]', el).innerHTML = d.G.map((g, i) => `<div class="thi-gate ${g.st}"><span class="gs">${i + 1} · ${g.sub}</span><span class="gq">${g.st === 'pass' ? '✓ ' : g.st === 'stop' ? '✕ ' : ''}${g.q}</span><span class="gr">${g.r}</span></div>`).join('')
          + `<div class="thi-gate ${kind === 'ok' ? 'pass' : 'stop'}"><span class="gs">ответ сервера</span><span class="thi-code ${kind}">${d.code}</span><span class="gr">«${AU_LBL[d.code]}»</span></div>`;
        TR.$('[data-why]', el).innerHTML = ui.note(kind === 'ok' ? 'ok' : d.code === 401 ? 'warn' : 'bad', `Почему ${d.code}`, `${d.why}<br><span class="small"><b>Что сделает приложение:</b> ${d.app}</span>`);
        const path = s.where === 'list' ? '/v1/admin/clients' : '/v1/memberships/' + AU_ID[s.whose];
        const hdr = s.tok === 'yes' ? { Authorization: 'Bearer eyJhbGciOiJSUzI1NiJ9.eyJzdWIi…' } : {};
        const inTok = s.tok === 'yes' ? `в токене: ${s.role === 'admin' ? 'администратор, role=admin' : 'Анна, role=client'}, ${s.exp === 'old' ? 'срок вышел 2 минуты назад' : 'действует ещё 11 минут'}` : 'токена нет';
        TR.$('[data-req]', el).innerHTML = ui.http({ method: 'GET', path, headers: hdr, cap: 'запрос · ' + inTok });
        TR.$('[data-res]', el).innerHTML = ui.http(Object.assign({ cap: 'ответ сервера' }, authRes(s, d)));
      }
      function drawEnum() {
        const rows = AU_ENUM.map(([n, real]) => {
          let code, learn, cls = '';
          if (real === 'Анны') { code = 200; learn = 'это свой абонемент'; }
          else if (real === 'чужой') { code = +pol; learn = pol === '403' ? '<b>номер занят</b>: у кого-то есть абонемент' : 'ничего'; cls = pol === '403' ? 'bad' : ''; }
          else { code = 404; learn = pol === '403' ? 'номер свободен' : 'ничего'; cls = pol === '403' ? 'bad' : ''; }
          return [`<span class="mono">/memberships/${n}</span>`, real, ui.st(code), learn, cls];
        });
        const known = pol === '403' ? AU_ENUM.filter(x => x[1] !== 'Анны').length : 0;
        TR.$('[data-enum]', el).innerHTML = ui.table(['Номер', 'На самом деле', 'Ответ', 'Что понял взломщик'], rows.map(r => r.slice(0, 4)), { rowClass: (r, i) => rows[i][4] })
          + ui.note(pol === '403' ? 'bad' : 'ok', pol === '403' ? 'Утечка без утечки' : 'Чужое неотличимо от несуществующего', pol === '403'
            ? `Чужих данных взломщик не увидел, но узнал про ${known} из 5 чужих номеров, есть они или нет. Так считают клиентов сети и выбирают, что ломать дальше. 403 честно говорит «есть, но не ваше» — и этим подсказывает.`
            : 'Все чужие и все несуществующие номера отвечают одинаково. Взломщик не узнал ничего, кроме своего абонемента. 403 оставляем там, где скрывать нечего: разделы для ролей, нехватка прав у партнёра.');
      }
      ui.onSeg(el, (n, v) => { if (n === 'pol') { pol = v; drawEnum(); } else if (n in s) { s[n] = v; draw(); } });
      draw(); drawEnum();
    }
  };

  // =====================================================================
  // security · 2. OAuth 2.0 и PKCE (к заданию oauth)
  // =====================================================================
  const OA_LANES = [L('app', 'Приложение Анны', 'телефон'), L('auth', 'Сервер входа', 'auth.puls.fit'), L('evil', 'Чужое приложение', 'перехватчик'), L('api', 'API «Пульса»', 'данные Анны')];
  const OA_PKCE = [
    { from: 'app', to: 'app', t: 'verifier = случайное слово\nchallenge = SHA-256(verifier)', kind: 'info', note: 'Перед входом приложение придумывает секретное слово — <code>code_verifier</code> — и считает его отпечаток <code>code_challenge</code>. Слово остаётся в памяти телефона и никуда не уходит.' },
    { from: 'app', to: 'auth', t: 'открыть вход\n+ code_challenge', note: 'Приложение открывает страницу сервера входа <code>auth.puls.fit</code> и передаёт туда только отпечаток. SMS-код Анны приложение не увидит: его вводят на странице сервера.' },
    { from: 'auth', to: 'auth', t: 'Анна ввела SMS-код ✓', kind: 'ok', note: 'Анна подтверждает вход. Сервер запоминает отпечаток рядом с будущим кодом.' },
    { from: 'auth', to: 'app', t: 'redirect puls://cb?code=K7f…', reply: true, note: 'Сервер возвращает Анну в приложение по особому адресу <code>puls://</code> и кладёт в адрес одноразовый <b>код</b>. Код живёт около минуты.' },
    { from: 'auth', to: 'evil', t: 'тот же адрес поймало\nчужое приложение', kind: 'warn', note: 'Опасность: другое приложение на телефоне зарегистрировало тот же адрес <code>puls://</code> и тоже получило код.' },
    { from: 'evil', to: 'auth', t: 'POST /token\ncode=K7f…', kind: 'warn', note: 'Вор пробует обменять код на токены.' },
    { from: 'auth', to: 'evil', t: '400 invalid_grant', reply: true, kind: 'ok', note: 'Сервер просит предъявить <code>code_verifier</code> и считает от него SHA-256. Секретного слова у вора нет — отпечаток не сходится. Код для него бесполезен.' },
    { from: 'app', to: 'auth', t: 'POST /token\ncode + code_verifier', note: 'Приложение Анны предъявляет код вместе со своим секретным словом — напрямую, не через адрес редиректа.' },
    { from: 'auth', to: 'app', t: 'access 15 мин + refresh', reply: true, kind: 'ok', note: 'Отпечаток сошёлся: это то самое приложение, которое начинало вход. Анна получает токены.' },
    { from: 'app', to: 'api', t: 'GET /me/memberships\nBearer …', kind: 'ok', note: 'Дальше приложение ходит в API с access-токеном. Через 15 минут обменяет refresh на новый.' }
  ];
  const OA_NOPKCE = [
    { from: 'app', to: 'auth', t: 'открыть вход', note: 'Вход начинается так же, но без секретного слова и отпечатка.' },
    { from: 'auth', to: 'auth', t: 'Анна ввела SMS-код ✓', kind: 'ok', note: 'Анна честно подтверждает вход.' },
    { from: 'auth', to: 'app', t: 'redirect puls://cb?code=K7f…', reply: true, note: 'Одноразовый код уходит в адрес редиректа.' },
    { from: 'auth', to: 'evil', t: 'тот же адрес поймало\nчужое приложение', kind: 'warn', note: 'Перехватчик тоже получил код.' },
    { from: 'evil', to: 'auth', t: 'POST /token\ncode=K7f…', kind: 'warn', note: 'Вор успел первым.' },
    { from: 'auth', to: 'evil', t: 'access + refresh', reply: true, kind: 'bad', note: 'Сервер проверяет только код — а код настоящий. Токены уходят вору. Спасти мог бы секрет приложения, но в мобильном приложении его не спрятать: любой вытащит его из установочного файла.' },
    { from: 'evil', to: 'api', t: 'GET /me/memberships\nчужим токеном', kind: 'bad', note: 'Вор видит абонемент Анны и может записываться на занятия от её имени.' },
    { from: 'app', to: 'auth', t: 'POST /token\ncode=K7f…', note: 'Приложение Анны пытается обменять тот же код.' },
    { from: 'auth', to: 'app', t: '400: код уже использован', reply: true, kind: 'bad', note: 'Код одноразовый — Анне достаётся «ошибка входа». Она попробует ещё раз и, скорее всего, ничего не заподозрит.' }
  ];
  const OA_WHO = {
    spa: { t: 'Личный кабинет клиента на сайте', human: 'да — клиент входит сам', secret: 'нет — весь код сайта лежит в браузере, его видно любому', way: 'Authorization Code + PKCE', kind: 'ok',
      why: 'Устроено как у мобильного приложения: вход на странице сервера входа, одноразовый код и PKCE вместо секрета. Сайт получает токены клиента и ходит с ними в API.',
      no: 'Нельзя класть <code>client_secret</code> в код сайта и нельзя спрашивать SMS-код в форме самого сайта: код подтверждения видит только сервер входа.' },
    partner: { t: 'Бэкенд второго партнёра-агрегатора', human: 'нет — сервер ходит к нам сам, ночью и без людей', secret: 'да — секрет лежит на их сервере, в хранилище секретов', way: 'Client Credentials + scopes', kind: 'info',
      why: 'Партнёру выдают <code>client_id</code> и секрет. Он меняет их на токен на 15 минут. В токене — <code>scope</code>: что ему можно, например только читать расписание. Пароли и коды клиентов партнёр не видит никогда.',
      no: 'Нельзя давать партнёру логины клиентов или «вечный» ключ без ограничений прав: утечёт — точечно не отзовёшь.' },
    kiosk: { t: 'Киоск самообслуживания в холле клуба', human: 'нет — это устройство, человек за ним не входит', secret: 'да — при установке на устройство кладут сертификат клуба', way: 'mTLS — сертификат устройства', kind: 'violet',
      why: 'При каждом соединении обе стороны предъявляют сертификаты: сервер проверяет киоск, киоск — сервер. Не нужен отдельный поход за токеном. Украли киоск — отзываем один сертификат.',
      no: 'Нельзя «зашить» в киоск логин администратора: уволится администратор — сломается киоск, а утечёт логин — войдут от его имени.' }
  };
  const howOauth = {
    id: 'how-oauth', covers: ['oauth'], title: 'Как это работает: OAuth 2.0 и PKCE', free: true, noReset: true,
    simple: {
      icon: '🎟️',
      plain: 'OAuth 2.0 — правила, по которым программа получает временный пропуск (токен) вместо вашего пароля. PKCE защищает этот пропуск, когда программа живёт на телефоне и спрятать в ней секрет нельзя.',
      analogy: 'Гардероб. Вы сдаёте пальто и получаете номерок. Украдут номерок — пальто отдадут вору. PKCE — как если бы вы при сдаче загадали слово и сказали гардеробщику только его «отпечаток». Пальто выдают по номерку <b>и</b> слову. Вор с номерком, но без слова, уйдёт ни с чем.',
      tech: 'Authorization Code + PKCE (RFC 7636): приложение придумывает случайный <code>code_verifier</code>, а на сервер входа отправляет только <code>code_challenge = SHA-256(verifier)</code>. После входа сервер выдаёт одноразовый код. Обменять его на токены можно, только предъявив сам verifier. Для сервера без человека — Client Credentials, для устройств — сертификат (mTLS).'
    },
    lead: ui.brief({
      situation: 'Анна входит в приложение «Пульса» по SMS-коду. Само приложение код не видит: вход идёт на странице сервера входа <code>auth.puls.fit</code>. После входа сервер отдаёт приложению одноразовый <b>код</b>, и приложение меняет его на токены. Опасность в том, что на телефоне может стоять чужое приложение, которое перехватит код по дороге.',
      todo: ['В блоке «Секретное слово» нажмите «Придумать новое слово». Посмотрите, что остаётся в телефоне, а что уходит на сервер.', 'Сыграйте за вора: впишите любое слово и нажмите «Обменять код за вора». Потом — «за Анну».', 'Пройдите по шагам вариант «С PKCE», затем «Без PKCE — код перехватили». Сравните, что получил вор.', 'Внизу переключайте «Кто входит» и смотрите, какой способ входа подходит и почему.'],
      look: 'Колонки схемы — приложение Анны, сервер входа, чужое приложение-перехватчик и API «Пульса». Пунктир — ответ. Красное — то, что досталось вору. <b>Verifier</b> — секретное слово, оно не покидает телефон. <b>Challenge</b> — отпечаток слова (хэш SHA-256): по отпечатку слово не восстановить, а по слову отпечаток посчитать легко.'
    }),
    render(el) {
      const CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
      const gen = () => { const a = new Uint8Array(43); try { crypto.getRandomValues(a); } catch (e) { a.forEach((_, i) => { a[i] = Math.floor(Math.random() * 256); }); } return Array.from(a, x => CH[x % CH.length]).join(''); };
      const chal = v => b64u(sha256(enc.encode(v)));
      let ver = gen(), who = 'spa';
      el.innerHTML = `<div class="stack">
        <div class="thi-box"><h4>Секретное слово и отпечаток</h4>
          <div class="thi-kv" data-pk></div>
          <div class="row"><button type="button" class="btn sm" data-pk-act="gen">Придумать новое слово</button></div>
          <div class="field"><label for="thi-thief">Вор присылает verifier — впишите любое слово</label><input id="thi-thief" type="text" class="mono" value="угадаю-с-первого-раза" maxlength="80" data-thief></div>
          <div class="row"><button type="button" class="btn sm" data-pk-act="thief">Обменять код за вора</button><button type="button" class="btn sm primary" data-pk-act="anna">Обменять код за Анну</button></div>
          <div data-pk-out></div></div>
        <div class="eyebrow">Вход по шагам</div><div data-walk></div>
        <div class="card flat stack"><div class="eyebrow">Кто входит — и каким способом</div>
          <p class="small muted">Соседние примеры: в практике участники будут свои. Смотрите на признаки — есть ли человек и можно ли спрятать секрет.</p>
          <div>${ui.seg('who', Object.entries(OA_WHO).map(([v, w]) => ({ v, t: w.t })), who, 'accent')}</div><div data-who></div></div></div>`;
      const drawPk = () => { TR.$('[data-pk]', el).innerHTML = `<b>В телефоне</b><span class="thi-mono">code_verifier = ${esc(ver)}</span><b>Уходит на сервер</b><span class="thi-mono">code_challenge = ${esc(chal(ver))}</span>`; };
      const drawWho = () => {
        const w = OA_WHO[who];
        TR.$('[data-who]', el).innerHTML = `<div class="thi-kv"><b>Есть человек?</b><span>${w.human}</span><b>Можно спрятать секрет?</b><span>${w.secret}</span><b>Способ</b><span><span class="chip ${w.kind === 'violet' ? 'info' : w.kind}">${w.way}</span></span></div>${ui.note('', 'Почему', w.why)}${ui.note('warn', 'Чего нельзя', w.no)}`;
      };
      TR.on(el, 'click', '[data-pk-act]', (e, b) => {
        const a = b.dataset.pkAct, out = TR.$('[data-pk-out]', el), want = chal(ver);
        if (a === 'gen') { ver = gen(); drawPk(); out.innerHTML = ui.note('', 'Новое слово', 'Каждый вход — новое слово. Даже если когда-то одно утечёт, к следующему входу оно не подойдёт.'); return; }
        if (a === 'anna') { out.innerHTML = ui.note('ok', 'Анна: 200, токены выданы', `Сервер посчитал SHA-256 от присланного слова: <span class="thi-mono">${esc(want)}</span>. Совпало с отпечатком из начала входа — это то самое приложение. Выдаёт access-токен на 15 минут и refresh-токен.`); return; }
        const guess = TR.$('[data-thief]', el).value, got = chal(guess);
        out.innerHTML = got === want
          ? ui.note('warn', 'Совпало', 'Вы знали слово — вот и совпало. Поэтому verifier и не покидает телефон: в адресе редиректа его нет, на сервер он уходит только в последнем шаге и напрямую от приложения.')
          : ui.note('bad', 'Вор: 400 invalid_grant', `Сервер посчитал SHA-256 от присланного: <span class="thi-mono">${esc(got)}</span><br>Ждал отпечаток: <span class="thi-mono">${esc(want)}</span><br>Не совпало. Код сгорел, токенов у вора нет. Подобрать слово из 43 случайных символов невозможно.`);
      });
      ui.onSeg(el, (n, v) => { if (n === 'who') { who = v; drawWho(); } });
      drawPk(); drawWho();
      walk(TR.$('[data-walk]', el), {
        lanes: OA_LANES, laneW: 168, scenarios: [
          { id: 'pkce', t: 'С PKCE', steps: OA_PKCE, sumKind: 'ok', sum: 'Перехват не помог: код без секретного слова ничего не стоит, а слово не покидало телефон.' },
          { id: 'none', t: 'Без PKCE — код перехватили', steps: OA_NOPKCE, sumKind: 'bad', sum: 'Токены у вора. Код из адреса — как номерок от гардероба: кто принёс, тому и выдали.' }
        ]
      });
    }
  };

  // =====================================================================
  // security · 3. Проверка владельца (к заданию bola)
  // =====================================================================
  const LK = { 101: { who: 'Пётр О.', code: '4471', until: '2026-10-31' }, 102: { who: 'Мария К.', code: '9032', until: '2026-11-15' }, 104: { who: 'Анна С.', code: '2580', until: '2026-11-04', me: true }, 105: { who: 'Игорь Н.', code: '7719', until: '2026-10-20' }, 106: { who: 'Светлана Р.', code: '3306', until: '2026-12-01' }, 108: { who: 'Алексей В.', code: '6123', until: '2026-10-28' } };
  const LK_UUID = { mine: { id: 'c41e7b52-9a3d-4f60-8b1e-5d2f7a9c0e14', n: 104 }, next: { id: 'c41e7b53-9a3d-4f60-8b1e-5d2f7a9c0e14', n: null }, leak: { id: 'f7a90d21-6c4e-4b8a-9f13-2e5d8c7b6a03', n: 101 } };
  const howOwner = {
    id: 'how-owner', covers: ['bola'], title: 'Как это работает: проверка владельца', free: true, noReset: true,
    simple: {
      icon: '🗄️',
      plain: 'Мало узнать, кто пришёл. Каждый раз, когда человек просит объект по номеру, сервер обязан проверить: а это его объект?',
      analogy: 'Раздевалка, где охранник проверил карту на входе, а дальше любой ключ открывает любой шкафчик. Шкафчики пронумерованы подряд — перебрать соседние номера может даже ребёнок.',
      tech: 'BOLA (Broken Object Level Authorization) — первое место в OWASP API Security Top 10 (2023). Защита — условие владельца прямо в запросе к базе: <code>WHERE id = $1 AND client_id = $2</code>, где <code>$2</code> берётся из токена, а не из запроса. Строки нет — 404. Случайные uuid вместо порядковых номеров мешают угадывать, но не заменяют проверку.'
    },
    lead: ui.brief({
      situation: 'Учебный пример, в задании его нет. Допустим, «Пульс» начал сдавать шкафчики в аренду на месяц. В приложении есть экран «Мой шкафчик»: номер, код замка, до какого числа оплачено. Приложение получает его запросом <code>GET /v1/lockers/{номер}</code>. Анна арендует шкафчик № 104. Что будет, если поменять в адресе 104 на 105?',
      todo: ['Сервер «без проверки владельца»: нажимайте «−1» и «+1» или впишите номер сами. Смотрите, что видит Анна.', 'Переключите сервер на «с проверкой владельца» и пройдите те же номера. Сравните запросы к базе (SQL).', 'Переключите номера на uuid. Нажмите «+1 к uuid», затем «uuid соседа попал в чат» — на обоих серверах.'],
      look: 'Слева — запрос приложения и SQL, которым сервер ищет шкафчик. <code>$1</code> — номер из адреса: его может вписать кто угодно. <code>$2</code> — кто вошёл: сервер берёт это из токена, подделать нельзя. Справа — ответ, то есть что увидела Анна. Плитки считают ущерб.'
    }),
    render(el) {
      let n = 104, srv = 'open', ids = 'seq', uid = 'mine', tries = 0;
      const leaked = new Set(), known = new Set();
      el.innerHTML = `<div class="stack">
        <div class="thi-set">
          ${setRow('srv', 'Сервер', [{ v: 'open', t: 'без проверки владельца' }, { v: 'own', t: 'с проверкой владельца' }], srv)}
          ${setRow('ids', 'Номера шкафчиков', [{ v: 'seq', t: 'порядковые: 101, 102…' }, { v: 'uuid', t: 'uuid' }], ids)}
          <div class="lbl">Номер в адресе</div><div data-pick></div>
        </div>
        <div class="grid2" style="align-items:start"><div class="stack tight" data-left></div><div class="stack tight" data-right></div></div>
        <div class="grid3" data-stats></div><div data-sum></div></div>`;
      function drawPick() {
        TR.$('[data-pick]', el).innerHTML = ids === 'seq'
          ? `<div class="row"><button type="button" class="btn sm" data-d="-1" aria-label="Номер на один меньше">−1</button><input type="number" class="mono" min="100" max="109" value="${n}" style="width:90px" data-n aria-label="Номер шкафчика"><button type="button" class="btn sm" data-d="1" aria-label="Номер на один больше">+1</button></div>`
          : ui.seg('uid', [{ v: 'mine', t: 'мой uuid' }, { v: 'next', t: '+1 к uuid' }, { v: 'leak', t: 'uuid соседа попал в чат' }], uid, 'accent');
      }
      function draw() {
        const u = LK_UUID[uid];
        const num = ids === 'seq' ? n : u.n;
        const key = ids === 'seq' ? String(n) : u.id;
        const rec = num != null && LK[num] ? Object.assign({ n: num }, LK[num]) : null;
        const visible = !!rec && (srv === 'open' || rec.me);
        if (visible && !rec.me) leaked.add(num);
        if (srv === 'open' && ids === 'seq' && !(rec && rec.me)) known.add(n);
        const where = ids === 'seq' ? 'number = $1' : 'public_id = $1';
        const p1 = ids === 'seq' ? key : `'${key.slice(0, 8)}…'`;
        const sql = srv === 'open'
          ? `SELECT number, lock_code, paid_until\n  FROM locker_rent\n WHERE ${where}\n-- $1 = ${p1} (из адреса)\n-- [[bad]]кто спрашивает — не проверяется[[/]]`
          : `SELECT number, lock_code, paid_until\n  FROM locker_rent\n WHERE ${where}\n   [[ok]]AND client_id = $2[[/]]\n-- $1 = ${p1} (из адреса)\n-- $2 = Анна (из токена, подделать нельзя)`;
        TR.$('[data-left]', el).innerHTML = ui.http({ method: 'GET', path: '/v1/lockers/' + key, headers: { Authorization: 'Bearer eyJ… (Анна)' }, cap: 'запрос приложения' }) + ui.code(sql, 'sql', 'как сервер ищет шкафчик');
        let res, note;
        if (visible) {
          res = { status: 200, body: { number: rec.n, lockCode: rec.code, paidUntil: rec.until, renter: rec.who } };
          note = rec.me ? ui.note('ok', 'Свой шкафчик', 'Анна видит свой код замка — так и должно быть.') : ui.note('bad', 'Чужой шкафчик', `Это шкафчик ${esc(rec.who)}. Анна узнала код замка ${esc(rec.code)}. Вечером в раздевалке вещи этого человека может забрать кто угодно.`);
        } else {
          res = { status: 404, headers: { 'Content-Type': 'application/problem+json' }, body: { type: 'https://api.puls.fit/problems/not-found', title: 'Не найдено', status: 404 } };
          note = srv === 'own'
            ? ui.note('ok', 'Нет такого шкафчика у Анны', rec ? `Шкафчик № ${rec.n} существует, но сервер искал его только среди шкафчиков Анны — и не нашёл. Ответ такой же, как на несуществующий номер.` : 'Сервер искал среди шкафчиков Анны и не нашёл. Чужой и несуществующий номер выглядят одинаково.')
            : ui.note('warn', 'Свободный номер', ids === 'seq' ? `Шкафчик № ${n} никто не арендует. Но и это подсказка: у занятых номеров ответ 200, у свободных 404 — видно, какие заняты.` : 'uuid с «+1» не существует: угадать соседний uuid нельзя. Номер не порядковый — перебор не работает.');
        }
        TR.$('[data-right]', el).innerHTML = ui.http(Object.assign({ cap: 'ответ: что увидела Анна' }, res)) + note;
        TR.$('[data-stats]', el).innerHTML = stat('попыток', tries, '', 'сколько номеров Анна попробовала')
          + stat('чужих кодов узнала', leaked.size, leaked.size ? 'bad' : 'ok', leaked.size ? 'шкафчики ' + [...leaked].join(', ') : 'пока ни одного')
          + (ids === 'seq' ? stat('узнала, занят ли номер', known.size, known.size ? 'warn' : 'ok', 'даже без кода — уже подсказка') : stat('шанс угадать uuid', '≈ 0', 'ok', '1 к 5·10³⁶ — но uuid можно подсмотреть'));
        const sum = srv === 'open' && ids === 'seq'
          ? ['bad', 'Сервер проверил только, что Анна вошла. Номер из адреса он подставил в запрос как есть и отдал любой шкафчик. Порядковые номера облегчают перебор: соседний номер почти всегда чей-то.']
          : srv === 'open'
            ? ['warn', 'uuid угадать нельзя — «+1» ведёт в пустоту. Но uuid — не пароль: он светится в ссылках, скриншотах, логах. Попал в чат — и сервер без проверки отдаёт чужое.']
            : ['ok', `Проверка владельца встроена прямо в запрос к базе: шкафчик ищется среди шкафчиков <i>этого</i> клиента. Номер можно подбирать сколько угодно — чужого не будет. ${ids === 'uuid' ? 'uuid здесь — второй слой: мешает даже подбирать.' : 'Переключите на uuid — получите второй слой защиты.'}`];
        TR.$('[data-sum]', el).innerHTML = ui.note(sum[0], 'Что видно', sum[1]);
      }
      const act = () => { tries++; draw(); };
      TR.on(el, 'click', '[data-d]', (e, b) => { n = Math.max(100, Math.min(109, n + (+b.dataset.d))); const i = TR.$('[data-n]', el); if (i) i.value = n; act(); });
      el.addEventListener('change', e => { const i = e.target.closest('[data-n]'); if (!i) return; const v = parseInt(i.value, 10); n = Math.max(100, Math.min(109, isNaN(v) ? 104 : v)); i.value = n; act(); });
      ui.onSeg(el, (k, v) => {
        if (k === 'srv') { srv = v; draw(); }
        if (k === 'ids') { ids = v; drawPick(); draw(); }
        if (k === 'uid') { uid = v; act(); }
      });
      drawPick(); draw();
    }
  };

  // =====================================================================
  // security · 4. JWT и лишние поля (к заданию mass)
  // =====================================================================
  const JW_H = { alg: 'HS256', typ: 'JWT' };
  const JW_P = { iss: 'https://auth.puls.fit', sub: '5d0c8e2a-7b1f-4c6d-9e3a-2f8b1a7c4d90', aud: 'api.puls.fit', role: 'trainer', clubs: ['sokol', 'khimki'], iat: 1791790200, exp: 1791791100 };
  const JW_KEY = enc.encode('demo-secret-puls');
  const jwSign = (h64, p64) => b64u(hmac(JW_KEY, enc.encode(h64 + '.' + p64)));
  const MF = [
    { k: 'photoUrl', v: 'https://cdn.puls.fit/t/maria-2026.jpg', was: 'https://cdn.puls.fit/t/maria-2024.jpg', ok: true, t: 'новое фото' },
    { k: 'phone', v: '+79267770303', was: '+79267770202', ok: true, t: 'новый рабочий телефон' },
    { k: 'hiredOn', v: '2012-01-10', was: '2021-03-01', ok: false, t: 'дата найма: «стаж с 2012 года» — ставка выше' },
    { k: 'clubIds', v: ['sokol', 'khimki', 'kazan', '…ещё 9'], was: 'sokol, khimki', now: 'все 12 клубов', ok: false, t: 'доступ к клиентам всех 12 клубов' }
  ];
  const howJwt = {
    id: 'how-jwt', covers: ['mass'], title: 'Как это работает: JWT и лишние поля', free: true, noReset: true,
    simple: {
      icon: '🎫',
      plain: 'JWT — пропуск из трёх частей: заголовок, данные и подпись. Прочитать данные может любой. Подделать нельзя: подпись сразу перестанет сходиться.',
      analogy: 'Браслет в клубе с надписью «Мария, тренер, до 10:45» и пломбой. Надпись видна каждому, кто держит браслет в руках. Если стереть «тренер» и написать «администратор», пломба порвётся — охранник это заметит.',
      tech: 'JSON Web Token (RFC 7519): <code>base64url(header).base64url(payload).подпись</code>. Подпись — HMAC или RSA/ECDSA от первых двух частей с ключом сервера. Это не шифрование: payload читается без ключа. Отдельная беда — массовое присваивание (mass assignment): сервер копирует в базу все поля из запроса. Лечится бланком входных данных (DTO) со списком разрешённых полей.'
    },
    lead: ui.brief({
      situation: 'Соседний пример, в задании его нет. Тренер Мария Лис входит в веб-кабинет, и сервер выдаёт ей токен — JWT. С ним она правит свою карточку на сайте: фото и телефон. Посмотрим, как устроен её токен и что будет, если Мария (или тот, кто взял её ноутбук) попробует себе что-нибудь «приписать».',
      todo: ['Нажимайте на три цветные части токена и читайте расшифровку каждой.', 'Переключите в данных роль на admin. Посмотрите, что стало с подписью и что ответил сервер.', 'Ниже — правка карточки тренера. Отмечайте, какие поля Мария дописала в запрос, и переключайте способ, которым сервер переносит поля в базу.'],
      look: 'Токен — одна длинная строка из трёх частей через точку. Красная часть — заголовок (каким способом подписано), фиолетовая — данные (кто это и что ему можно), синяя — подпись. В таблице базы зелёным — разрешённое изменение, красным — то, что Мария не имела права менять.'
    }),
    render(el) {
      let part = 'p', role = 'trainer', mode = 'copy';
      const sent = { photoUrl: true, phone: false, hiredOn: true, clubIds: true };
      const h64 = b64uJson(JW_H), p64 = b64uJson(JW_P), sig = jwSign(h64, p64);
      el.innerHTML = `<div class="stack">
        <div class="eyebrow">Токен Марии Лис — нажимайте на части</div>
        <div class="thi-jwt" data-tok></div>
        <div class="row"><span class="small dim">Данные в токене:</span>${ui.seg('role', [{ v: 'trainer', t: 'role: trainer — как выдали' }, { v: 'admin', t: 'role: admin — подправили' }], role, 'accent')}</div>
        <div class="grid2" style="align-items:start"><div data-part></div><div data-chk></div></div>
        <div class="card flat stack"><div class="eyebrow">Лишние поля: Мария правит свою карточку</div>
          <div class="stack tight"><span class="small dim">Что Мария положила в запрос:</span>${MF.map(f => `<label class="toggle"><input type="checkbox" data-mf="${f.k}" ${sent[f.k] ? 'checked' : ''}> <span><code>${f.k}</code> — ${f.t}${f.ok ? '' : ' <span class="chip bad">нельзя</span>'}</span></label>`).join('')}</div>
          <div class="row"><span class="small dim">Сервер:</span>${ui.seg('mm', [{ v: 'copy', t: 'копирует все поля из запроса' }, { v: 'form', t: 'бланк: только разрешённые поля' }], mode, 'accent')}</div>
          <div class="grid2" style="align-items:start"><div class="stack tight" data-mreq></div><div class="stack tight" data-mdb></div></div>
          <div data-mnote></div></div></div>`;
      function drawTok() {
        const pCur = role === 'trainer' ? p64 : b64uJson(Object.assign({}, JW_P, { role: 'admin' }));
        const sp = (k, cls, t, v) => `<span role="button" tabindex="0" class="${cls}" data-pt="${k}" aria-pressed="${part === k}" title="${t}">${v}</span>`;
        TR.$('[data-tok]', el).innerHTML = sp('h', 'h', 'Заголовок', h64) + '<span class="dot">.</span>' + sp('p', 'p' + (role === 'admin' ? ' tamp' : ''), 'Данные', pCur) + '<span class="dot">.</span>' + sp('s', 's', 'Подпись', sig);
        const pl = Object.assign({}, JW_P, role === 'admin' ? { role: 'admin' } : {});
        TR.$('[data-part]', el).innerHTML = part === 'h'
          ? ui.code(JSON.stringify(JW_H, null, 2), 'json', 'часть 1 · заголовок (header)') + '<p class="small">Здесь написано, каким способом поставлена подпись: <code>HS256</code> — HMAC с SHA-256. Сервер заранее знает, каким способом подписывает он сам, и другого не принимает, что бы ни было написано в заголовке.</p>'
          : part === 'p'
            ? ui.code(JSON.stringify(pl, null, 2), 'json', 'часть 2 · данные (payload) — расшифровано без всякого ключа') + `<div class="thi-kv small"><b>iss</b><span>кто выдал пропуск</span><b>sub</b><span>кто это: uuid тренера — не имя и не телефон</span><b>aud</b><span>для какого сервиса пропуск</span><b>role</b><span>роль${role === 'admin' ? ' — <b style="color:var(--bad)">подправлена</b>' : ''}</span><b>clubs</b><span>в каких клубах работает</span><b>iat / exp</b><span>выдан 12.10 в 10:30, действует до 10:45</span></div><p class="small">Base64url — не шифр, а просто другая запись тех же букв. Всё, что лежит в данных, прочитает любой, у кого токен окажется в руках: в логе, в отладчике, на скриншоте.</p>`
            : ui.code(`HMAC-SHA256(\n  заголовок + "." + данные,\n  секрет сервера\n)\n= ${sig}`, 'text', 'часть 3 · подпись (signature)') + '<p class="small">Секрет знает только сервер. Поменяйте в данных хоть одну букву — подпись, которую насчитает сервер, станет совсем другой. Подделать подпись без секрета нельзя. В жизни секрет длинный и хранится в хранилище секретов.</p>';
        const fresh = jwSign(h64, pCur), okSig = fresh === sig;
        TR.$('[data-chk]', el).innerHTML = `<div class="code-cap">сервер проверяет подпись</div><div class="thi-kv"><b>в токене</b><span class="thi-mono">${sig}</span><b>насчитал сам</b><span class="thi-mono" style="color:var(--${okSig ? 'ok' : 'bad'})">${fresh}</span></div>`
          + (okSig ? ui.note('ok', 'Совпало', 'Пропуск настоящий, данным можно верить: это тренер, роль trainer.')
            : ui.note('bad', 'Не совпало — 401', 'Данные поменяли, а подпись осталась старой: пересчитать её без секрета сервера нельзя. Сервер отвергает токен целиком и ничего из него не читает.') + ui.http({ status: 401, headers: [['WWW-Authenticate', 'Bearer error="invalid_token", error_description="signature mismatch"']] }));
      }
      function drawMass() {
        const body = {}; MF.forEach(f => { if (sent[f.k]) body[f.k] = f.v; });
        TR.$('[data-mreq]', el).innerHTML = ui.http({ method: 'PATCH', path: '/v1/trainers/me', headers: { Authorization: 'Bearer eyJ… (Мария, trainer)', 'Content-Type': 'application/merge-patch+json' }, body, cap: 'запрос из кабинета' })
          + ui.code(mode === 'copy' ? '// сервер: «переложить всё, что пришло»\ntrainer.updateFrom(body)\nsave(trainer)' : '// бланк правки карточки — только два поля\nTrainerCardForm { photoUrl, phone }\n\nform = read(body, TrainerCardForm)  // остальное не читаем\nif (form.photoUrl) trainer.photoUrl = form.photoUrl\nif (form.phone)    trainer.phone    = form.phone\nsave(trainer)', 'js', 'код сервера, упрощённо');
        let bad = 0, blocked = 0;
        const rows = MF.map(f => {
          const asked = sent[f.k], applied = asked && (mode === 'copy' || f.ok);
          if (applied && !f.ok) bad++;
          if (asked && !applied) blocked++;
          const wasT = typeof f.was === 'string' ? f.was : '';
          const nowT = applied ? (f.now || (Array.isArray(f.v) ? f.v.join(', ') : f.v)) : wasT;
          return { cells: [`<code style="white-space:nowrap">${f.k}</code>`, `<span class="thi-mono">${esc(wasT)}</span>`, `<span class="thi-mono">${esc(nowT)}</span>${asked && !applied ? ' <span class="chip">бланк не пустил</span>' : ''}`], cls: applied ? (f.ok ? 'ok' : 'bad') : '' };
        });
        TR.$('[data-mdb]', el).innerHTML = '<div class="code-cap">строка trainer в базе после запроса</div>' + ui.table(['Поле', 'Было', 'Стало'], rows.map(r => r.cells), { rowClass: (r, i) => rows[i].cls });
        TR.$('[data-mnote]', el).innerHTML = mode === 'copy'
          ? (bad ? ui.note('bad', 'Сервер записал всё', 'Мария подняла себе ставку и получила доступ к клиентам всех клубов. Сервер ни в чём не «ошибся»: он сделал ровно то, что ему прислали. Токен при этом настоящий — подпись тут не спасает, ведь Мария подправила не токен, а тело запроса.')
            : ui.note('warn', 'Сейчас всё прилично', 'Лишних полей нет — но только потому, что Мария их не дописала. Сервер не защищает: защищает её честность. Отметьте лишнее поле и посмотрите снова.'))
          : ui.note('ok', 'Бланк держит', `Бланк знает только два поля, остальное сервер не читает${blocked ? ` — отброшено полей: ${blocked}` : ''}. Лишнее можно молча отбросить или ответить ошибкой. Что честнее для приложения — решите в практике.`);
      }
      TR.on(el, 'click', '[data-pt]', (e, b) => { part = b.dataset.pt; drawTok(); });
      TR.on(el, 'keydown', '[data-pt]', (e, b) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); part = b.dataset.pt; drawTok(); const n = TR.$(`[data-pt="${part}"]`, el); if (n) n.focus(); } });
      el.addEventListener('change', e => { const c = e.target.closest('[data-mf]'); if (!c) return; sent[c.dataset.mf] = c.checked; drawMass(); });
      ui.onSeg(el, (k, v) => { if (k === 'role') { role = v; if (v === 'admin') part = 'p'; drawTok(); } if (k === 'mm') { mode = v; drawMass(); } });
      drawTok(); drawMass();
    }
  };

  // =====================================================================
  // styles · 5. Локальный список и буфер событий (к заданию offline)
  // =====================================================================
  const OF_MAX = 960, OF_TTL = 720;
  const ofClock = t => { const a = 18 * 60 + t; return `${a >= 1440 ? 'Сб' : 'Пт'} ${pad(Math.floor(a % 1440 / 60))}:${pad(a % 60)}`; };
  const ofAge = m => `${Math.floor(m / 60)} ч ${pad(m % 60)} мин`;
  const OF_NAMES = { anna: 'Анна', petr: 'Пётр', oleg: 'Олег', nina: 'Нина' };
  const ofStart = () => ({ anna: { st: 'active', until: 99999, txt: 'до 31.12' }, petr: { st: 'active', until: 359, txt: 'до сегодня, 23:59' }, oleg: { st: 'active', until: 99999, txt: 'до 30.11' } });
  function ofJudge(book, id, t) {
    const r = book[id];
    if (!r) return { ok: false, why: 'нет в списке действующих' };
    if (r.st === 'frozen') return { ok: false, why: 'абонемент заморожен' };
    if (t > r.until) return { ok: false, why: `срок абонемента вышел (${r.txt})` };
    return { ok: true, why: `абонемент действует (${r.txt})` };
  }
  const ofStatus = (r, t) => r.st === 'frozen' ? ['заморожен', 'warn'] : t > r.until ? ['истёк', 'bad'] : ['действует', 'ok'];
  const howOffline = {
    id: 'how-offline', covers: ['offline'], title: 'Как это работает: локальный список и буфер событий', free: true, noReset: true,
    simple: {
      icon: '📒',
      plain: 'Пока связь есть, «пускать или нет» решает сервер. Связь пропала — решает сам турникет по своей копии списка, а проходы записывает в тетрадку, чтобы сдать потом.',
      analogy: 'Охранник со списком гостей и тетрадкой. Рация работает — он спрашивает диспетчера. Рация сломалась — сверяется со списком. Строки в тетрадке он нумерует сам: если сдаст тетрадку дважды, в офисе по номерам увидят, что это те же строки.',
      tech: 'Контроллер турникета держит локальный список пропусков (allowlist) и обновляет его потоком gRPC <code>WatchAllowlist</code>. Без связи события прохода копятся в буфере, каждое — со своим <code>turnstile_event_id</code>, который придумывает контроллер. После восстановления связи буфер досылается <code>ReportPassages</code>, а уникальный ключ в таблице <code>visit</code> отсекает повторы. У списка есть срок годности: слишком старому не верим.'
    },
    lead: ui.brief({
      situation: 'Клуб «Пульс Химки», пятница, 18:00. Контроллер турникета — маленький компьютер в клубе — спрашивает сервер «пускать?» на каждый QR. Но интернет в клубе иногда пропадает, а люди должны проходить всегда. Поэтому у контроллера есть своя копия списка «кого пускать» и буфер — «тетрадка» для проходов без связи.',
      todo: ['При включённом интернете нажмите «Анна» — решает сервер.', 'Выключите интернет. Нажмите «Олег заморозил абонемент» и «Нина купила абонемент», затем приложите QR Олега и Нины. Сравните решение контроллера с правдой на сервере.', 'Пропустите ещё пару человек — смотрите, как растёт буфер. Подвиньте часы за полночь и приложите QR Петра.', 'Включите интернет: буфер уйдёт на сервер. Нажмите «Подтверждение потерялось» — и посмотрите, что стало с дублями.', 'Выключите интернет и подвиньте часы на утро субботы: что контроллер делает со списком, которому больше 12 часов?'],
      look: 'Слева — контроллер в клубе: решение на последний QR, его копия списка с временем версии и буфер событий. Жёлтым подсвечены строки списка, которые уже разошлись с сервером, — сам контроллер этого не видит. Справа — сервер: правда об абонементах и таблица посещений <code>visit</code>. Внизу — журнал всего, что произошло.'
    }),
    render(host) {
      const el = document.createElement('div'); host.appendChild(el);
      const S = { on: true, t: 0, at: 0, truth: ofStart(), list: ofStart(), buf: [], vis: [], seen: new Set(), dup: 0, last: [], seq: 186, log: ['Пт 18:00  связь есть, список пропусков свежий (поток WatchAllowlist)'], dec: null, ev: {} };
      el.innerHTML = `<div class="stack">
        <div class="thi-set">
          <div class="lbl">Интернет в клубе</div><div>${ui.seg('net', [{ v: 'on', t: 'есть' }, { v: 'off', t: 'пропал' }], 'on', 'accent')}</div>
          <div class="lbl">Часы</div><div class="row" style="flex-wrap:nowrap"><input type="range" min="0" max="${OF_MAX}" step="30" value="0" data-clock style="flex:1;min-width:0;accent-color:var(--accent)" aria-label="Часы: с пятницы 18:00 до субботы 10:00"><b class="mono tnum" data-clk style="white-space:nowrap">Пт 18:00</b></div>
        </div>
        <div class="stack tight"><span class="small dim">Клиент прикладывает QR к турникету:</span><div class="row">${Object.entries(OF_NAMES).map(([k, v]) => `<button type="button" class="btn sm primary" data-qr="${k}">${v}</button>`).join('')}</div></div>
        <div class="stack tight"><span class="small dim">Тем временем в приложении «Пульса»:</span><div class="row"><button type="button" class="btn sm" data-ev="freeze">Олег заморозил абонемент</button><button type="button" class="btn sm" data-ev="buy">Нина купила абонемент</button><button type="button" class="btn sm ghost" data-of-reset>⟲ Сначала</button></div></div>
        <div class="grid2" style="align-items:start"><div class="thi-box" data-ctl></div><div class="thi-box" data-srv></div></div>
        <div data-note></div>
        <div><div class="code-cap">журнал</div><pre class="code thi-log" data-log></pre></div></div>`;
      const log = s => { S.log.push(s); if (S.log.length > 40) S.log.shift(); };
      const note = (k, t, h) => { TR.$('[data-note]', el).innerHTML = ui.note(k, t, h); };
      const sync = () => { S.list = TR.clone(S.truth); S.at = S.t; };
      function addVisits(batch) { let added = 0; batch.forEach(e => { if (S.seen.has(e.id)) S.dup++; else { S.seen.add(e.id); S.vis.push(e); added++; } }); return added; }
      function draw() {
        TR.$('[data-clk]', el).textContent = ofClock(S.t);
        const age = Math.max(0, S.t - S.at), stale = !S.on && age > OF_TTL;
        const d = S.dec;
        const listRows = Object.keys(OF_NAMES).filter(k => S.list[k]).map(k => { const r = S.list[k], [st, sk] = ofStatus(r, S.t), tr = S.truth[k]; const diff = !tr || tr.st !== r.st; return { c: [OF_NAMES[k], `<span class="chip ${sk}">${st}</span>`, r.txt], cls: diff ? 'hl' : '' }; });
        const missing = Object.keys(S.truth).filter(k => !S.list[k]).map(k => ({ c: [OF_NAMES[k], '<span class="chip">нет в списке</span>', '—'], cls: 'hl' }));
        const allRows = listRows.concat(missing);
        TR.$('[data-ctl]', el).innerHTML = `<h4>Контроллер турникета · Пульс Химки</h4>
          ${d ? `<div class="thi-verdict ${d.kind}">${d.big}<small>${d.why}</small><small class="dim">${d.by}</small></div>` : '<div class="thi-verdict idle">ждёт QR<small>приложите QR кнопками выше</small></div>'}
          <div class="row between small"><span>Список: версия ${ofClock(S.at)}</span><span class="chip ${S.on ? 'ok' : stale ? 'bad' : age > 240 ? 'warn' : 'info'}">${S.on ? 'свежий: поток идёт' : stale ? 'просрочен: ' + ofAge(age) : 'возраст ' + ofAge(age)}</span></div>
          ${ui.table(['Клиент', 'Статус', 'До'], allRows.map(r => r.c), { rowClass: (r, i) => allRows[i].cls })}
          <div class="small dim">Буфер (тетрадка): <b>${S.buf.length}</b> ${TR.plural(S.buf.length, 'событие', 'события', 'событий')}${S.on ? ' · связь есть, события уходят сразу' : ''}</div>
          ${S.buf.length ? `<div class="facts-row">${S.buf.slice(-6).map(e => `<span class="chip">${e.id} · ${e.who}</span>`).join('')}</div>` : ''}`;
        const truthRows = Object.keys(S.truth).map(k => { const r = S.truth[k], [st, sk] = ofStatus(r, S.t); return [OF_NAMES[k], `<span class="chip ${sk}">${st}</span>`, r.txt]; });
        TR.$('[data-srv]', el).innerHTML = `<h4>Сервер «Пульса»</h4>
          ${ui.table(['Клиент', 'На самом деле', 'До'], truthRows)}
          <div class="grid2">${stat('визитов в базе', S.vis.length, '', 'таблица visit')}${stat('дублей отсечено', S.dup, S.dup ? 'ok' : '', 'по номеру события')}</div>
          ${S.vis.length ? `<div class="facts-row">${S.vis.slice(-6).map(e => `<span class="chip ok">${e.id} · ${e.who} · ${e.at.slice(3)}</span>`).join('')}</div>` : '<div class="small dim">Посещений пока нет.</div>'}
          <button type="button" class="btn sm" data-resend ${S.last.length && S.on ? '' : 'disabled'}>Подтверждение потерялось — контроллер шлёт пачку ещё раз</button>`;
        const lg = TR.$('[data-log]', el); lg.textContent = S.log.join('\n'); lg.scrollTop = lg.scrollHeight;
        TR.$$('[data-ev]', el).forEach(b => { b.disabled = !!S.ev[b.dataset.ev]; });
      }
      function pass(k) {
        const name = OF_NAMES[k], truth = ofJudge(S.truth, k, S.t), now = ofClock(S.t);
        if (!S.on && S.t - S.at > OF_TTL) {
          S.dec = { kind: 'warn', big: 'К администратору', why: `Список не обновлялся ${ofAge(S.t - S.at)} — дольше 12 часов. Такому списку верить нельзя.`, by: 'контроллер · срок годности списка вышел' };
          log(`${now}  ${name}: список старше 12 ч → к администратору`);
          note('warn', 'Срок годности списка', 'Пока список был свежим, контроллер решал сам. Теперь ему больше 12 часов: за это время могло случиться что угодно — заморозки, расторжения, возвраты. Контроллер не пускает «на авось», а зовёт человека, и мониторинг уже поднял тревогу: клуб давно без связи.');
          draw(); return;
        }
        const d = S.on ? truth : ofJudge(S.list, k, S.t);
        S.dec = { kind: d.ok ? 'ok' : 'bad', big: d.ok ? 'Открыто' : 'Отказ', why: `${name}: ${d.why}.`, by: S.on ? 'решил сервер · CheckPass за 40 мс' : `решил контроллер · по списку версии ${ofClock(S.at)}` };
        if (d.ok) {
          const e = { id: 'h2-' + String(++S.seq).padStart(6, '0'), who: name, at: now };
          if (S.on) { addVisits([e]); log(`${now}  ${name}: открыто (сервер) · событие ${e.id} сразу в visit`); }
          else { S.buf.push(e); log(`${now}  ${name}: открыто по списку · событие ${e.id} → буфер (${S.buf.length})`); }
        } else log(`${now}  ${name}: отказ — ${d.why}${S.on ? '' : ' (по списку)'}`);
        if (S.on) note('', 'Решает сервер', `Связь есть — решает сервер: он знает всё, что случилось минуту назад. ${d.ok ? 'Событие прохода сразу записано в базу.' : 'Отказ честный: на сервере правда.'}`);
        else if (d.ok && !truth.ok) note('bad', 'Список устарел', `На сервере у ${name === 'Олег' ? 'Олега' : name} ${truth.why}, а контроллер об этом не знает: изменения после ${ofClock(S.at)} до клуба не доехали. Пустили зря.`);
        else if (!d.ok && truth.ok) note('warn', 'Список устарел', `${name} купила абонемент, когда связи уже не было. Список о ней не знает — придётся идти к администратору.`);
        else if (!d.ok && k === 'petr') note('ok', 'Решил контроллер — и правильно', 'Связи нет, а Петра всё равно не пустили: в записи списка лежит дата окончания, и контроллер сверил её со своими часами. Связь для этого не нужна.');
        else note('ok', 'Решил контроллер', d.ok ? `Связи нет — контроллер решил сам по списку. Проход записан в буфер под номером, который контроллер придумал прямо сейчас. С этим номером событие и поедет на сервер.` : 'Список сказал «нет» — и сервер сказал бы то же самое.');
        draw();
      }
      ui.onSeg(el, (k, v) => {
        if (k !== 'net') return;
        if (v === 'off' && S.on) { S.on = false; log(`${ofClock(S.t)}  связь пропала · список зафиксирован на версии ${ofClock(S.at)}`); note('warn', 'Связи нет', 'Теперь контроллер решает сам — по копии списка на момент обрыва. Всё, что случится на сервере дальше, он не узнает, пока связь не вернётся.'); }
        if (v === 'on' && !S.on) {
          S.on = true; sync();
          if (S.buf.length) {
            const batch = S.buf.splice(0), added = addVisits(batch); S.last = batch;
            log(`${ofClock(S.t)}  связь вернулась · ReportPassages: дослано ${batch.length}, принято ${added} · список обновлён`);
            note('ok', 'Досылка', `Связь вернулась. Контроллер отправил всю тетрадку — ${batch.length} ${TR.plural(batch.length, 'событие', 'события', 'событий')} — и получил свежий список. Каждое событие несёт свой номер, поэтому сервер может узнать повтор.`);
          } else { log(`${ofClock(S.t)}  связь вернулась · буфер пуст · список обновлён`); note('ok', 'Связь вернулась', 'Досылать нечего: без связи никто не проходил. Список снова свежий.'); }
        }
        draw();
      });
      el.addEventListener('input', e => { const c = e.target.closest('[data-clock]'); if (!c) return; S.t = Math.max(+c.value, S.on ? 0 : S.at); c.value = S.t; if (S.on) S.at = S.t; draw(); });
      TR.on(el, 'click', '[data-of-reset]', () => { el.remove(); howOffline.render(host); });
      TR.on(el, 'click', '[data-qr]', (e, b) => pass(b.dataset.qr));
      TR.on(el, 'click', '[data-ev]', (e, b) => {
        const k = b.dataset.ev; S.ev[k] = true;
        if (k === 'freeze') S.truth.oleg.st = 'frozen'; else S.truth.nina = { st: 'active', until: 99999, txt: 'до 12.10.2027' };
        const what = k === 'freeze' ? 'Олег заморозил абонемент' : 'Нина купила абонемент';
        if (S.on) { sync(); log(`${ofClock(S.t)}  сервер: ${what} → WatchAllowlist: изменение доехало до клуба`); note('', 'Поток изменений', `${what}. Связь есть — сервер тут же прислал изменение в поток <code>WatchAllowlist</code>, и список в клубе обновился.`); }
        else { log(`${ofClock(S.t)}  сервер: ${what} → клуб без связи, список об этом не знает`); note('warn', 'Изменение не доехало', `${what}. На сервере это уже правда, но клуб без связи — его список остался прежним.`); }
        draw();
      });
      TR.on(el, 'click', '[data-resend]', () => {
        const batch = S.last, before = S.dup; addVisits(batch);
        log(`${ofClock(S.t)}  повтор пачки: ${batch.length} событий · уникальный ключ (club_id, turnstile_event_id, entered_at) → ${S.dup - before} дублей отсечено`);
        note('ok', 'Дубли отсечены', `Подтверждение от сервера потерялось, и контроллер честно отправил пачку ещё раз. Но у каждого события есть номер, который контроллер дал в момент прохода. Такие номера в таблице <code>visit</code> уже есть — вставка ничего не делает (<code>ON CONFLICT DO NOTHING</code>). Посещений не стало больше: их по-прежнему ${S.vis.length}.`);
        draw();
      });
      draw();
    }
  };

  // =====================================================================
  // styles · 6. SOAP: конверт, контракт, Fault (к заданию soap)
  // =====================================================================
  const SO_NS = 'xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"';
  const SO_REQ = [
    ['env', `<soap:Envelope ${SO_NS}`], ['env', '               xmlns:buh="http://puls.fit/1c/exchange">'], ['hdr', '  <soap:Header/>'], ['body', '  <soap:Body>'],
    ['op', '    <buh:ЗагрузитьВозвраты>'], ['doc', '      <buh:Документ>'], ['doc', '        <buh:Номер>2b8e41c7-5f3a-4d19-a6c2-9e0f7d3b1a55</buh:Номер>'],
    ['doc', '        <buh:Дата>2026-10-12T11:05:00+03:00</buh:Дата>'], ['doc', '        <buh:СуммаКоп>1620000</buh:СуммаКоп>'], ['doc', '        <buh:Основание>Расторжение абонемента</buh:Основание>'],
    ['doc', '      </buh:Документ>'], ['op', '    </buh:ЗагрузитьВозвраты>'], ['body', '  </soap:Body>'], ['env', '</soap:Envelope>']
  ];
  const soFault = (code, text, det) => [['env', `<soap:Envelope ${SO_NS}>`], ['body', '  <soap:Body>'], ['fault', '    <soap:Fault>'], ['fault', `      <faultcode>soap:${code}</faultcode>`], ['fault', `      <faultstring>${text}</faultstring>`], ['fault', `      <detail><КодОшибки>${det}</КодОшибки></detail>`], ['fault', '    </soap:Fault>'], ['body', '  </soap:Body>'], ['env', '</soap:Envelope>']];
  const SO_RES = {
    ok: { http: 'HTTP/1.1 200 OK', kind: 'ok', title: 'Успех', lines: [['env', `<soap:Envelope ${SO_NS}`], ['env', '               xmlns:buh="http://puls.fit/1c/exchange">'], ['body', '  <soap:Body>'], ['op', '    <buh:ЗагрузитьВозвратыResponse>'], ['op', '      <buh:Принято>1</buh:Принято>'], ['op', '      <buh:Номер>2b8e41c7-5f3a-4d19-a6c2-9e0f7d3b1a55</buh:Номер>'], ['op', '    </buh:ЗагрузитьВозвратыResponse>'], ['body', '  </soap:Body>'], ['env', '</soap:Envelope>']],
      what: '1С приняла документ. Только теперь у себя ставим отметку <code>exported_to_1c_at</code> — «ушло в 1С тогда-то». Без ответа «принято» отметку не ставим никогда.' },
    client: { http: 'HTTP/1.1 500 Internal Server Error', kind: 'bad', title: 'Fault: ошибка в нашем письме', lines: soFault('Client', 'Документ 2b8e41c7-…: сумма возврата больше суммы оплаты', '1C-422'),
      what: '<code>faultcode = Client</code> — «с вашим письмом что-то не так». Повтор того же письма даст ту же ошибку, поэтому повторять бесполезно. Отметку не ставим, поднимаем тревогу и разбираемся с данными.' },
    server: { http: 'HTTP/1.1 500 Internal Server Error', kind: 'warn', title: 'Fault: 1С недоступна', lines: soFault('Server', 'Информационная база недоступна: идёт закрытие месяца', '1C-503'),
      what: '<code>faultcode = Server</code> — «у нас сломалось». Письмо в порядке, просто 1С сейчас не может его принять. Отметку не ставим и пробуем позже: 1С работает в будни с 9 до 19.' }
  };
  const SO_PART = {
    env: ['Envelope — конверт', 'Всё письмо SOAP лежит внутри конверта. В атрибутах <code>xmlns</code> — «словари»: <code>soap</code> — стандартные слова протокола, <code>buh</code> — слова, которые придумал франчайзи 1С и описал в контракте.'],
    hdr: ['Header — служебный отсек', 'Сюда кладут служебное: подпись письма, данные для входа, номер сообщения. Отсек необязательный. У нашей 1С он пустой: вход идёт по логину и паролю на уровне HTTP (Basic поверх TLS).'],
    body: ['Body — содержимое', 'Само письмо. В запросе внутри ровно одно действие — операция. В ответе — результат операции или бланк отказа Fault.'],
    op: ['Операция — что просим сделать', 'Имя операции и состав полей заранее описаны в контракте — файле <b>WSDL</b>. Это как бланк с графами: графу не переставишь и не переименуешь, иначе 1С письмо не поймёт. В ответе — элемент с тем же именем и словом Response.'],
    doc: ['Документ — одна строка учёта', '<b>Номер</b> — постоянный номер нашего возврата (его public_id). Если 1С получит тот же номер второй раз, она узнает документ и не проведёт его повторно — как бухгалтер узнаёт квитанцию по номеру. Сумма — в копейках: 1620000 — это 16 200 ₽.'],
    fault: ['Fault — бланк отказа', '<code>faultcode</code> говорит, чья ошибка: <code>Client</code> — «с вашим письмом что-то не так», <code>Server</code> — «у нас сломалось». <code>faultstring</code> — текст для человека, <code>detail</code> — подробности. В SOAP 1.1 Fault приходит с HTTP-кодом 500.']
  };
  const howSoap = {
    id: 'how-soap', covers: ['soap'], title: 'Как это работает: SOAP — конверт, контракт, Fault', free: true, noReset: true,
    simple: {
      icon: '✉️',
      plain: 'SOAP — обмен строгими XML-письмами в конверте по заранее согласованному бланку. Если что-то не так, в ответ приходит официальный бланк отказа — Fault.',
      analogy: 'Заказное письмо по форме. Конверт, внутри строго заполненный бланк: графы и их порядок не меняются. Почта возвращает либо «вручено», либо бланк отказа с причиной: «адрес неверный» (ваша ошибка) или «отделение закрыто» (их ошибка, приходите позже).',
      tech: 'SOAP — XML-протокол поверх HTTP POST. Письмо: <code>Envelope</code> → необязательный <code>Header</code> → <code>Body</code> с одной операцией. Контракт — файл WSDL: операции, поля, типы. Ошибка — <code>Fault</code> с <code>faultcode</code> (Client или Server), в SOAP 1.1 с HTTP 500. Большие объёмы шлют пачками и после каждой успешной пачки ставят у себя отметку «выгружено».'
    },
    lead: ui.brief({
      situation: 'Соседний пример: не оплаты, а <b>возвраты</b>. Клиент расторг абонемент, ему вернули 16 200 ₽. Этот возврат должен попасть в 1С бухгалтерии через операцию <code>ЗагрузитьВозвраты</code>. 1С говорит только на SOAP — выбирать не нам. Разберём письмо по частям, посмотрим возможные ответы, а затем — как большая выгрузка идёт пачками.',
      todo: ['Нажимайте на строки письма слева — под ним появится объяснение части.', 'Переключайте «Ответ 1С»: успех, ошибка в нашем письме, 1С недоступна. Читайте, что делаем в каждом случае.', 'Внизу отправляйте пачки по одной кнопкой «Отправить пачку». Сначала с «1С примет всё», затем «Сначала» и с «на 2-й пачке 1С упадёт». Следите за отметками.'],
      look: 'Цвет строки после нажатия — выбранная часть конверта. На шкале внизу каждая клетка — одна оплата. Серая — ещё не в 1С, синяя — уходит прямо сейчас, зелёная — 1С приняла и у нас стоит отметка <code>exported_to_1c_at</code>, красная — пачка получила Fault и осталась без отметки.'
    }),
    render(el) {
      let part = 'env', res = 'ok';
      el.innerHTML = `<div class="stack">
        <div class="grid2" style="align-items:start">
          <div class="stack tight"><div class="code-cap">запрос · POST …/ws/exchange · SOAPAction: ЗагрузитьВозвраты</div><div class="thi-lines" data-req></div></div>
          <div class="stack tight"><div class="row"><span class="small dim">Ответ 1С:</span>${ui.seg('res', Object.entries(SO_RES).map(([v, r]) => ({ v, t: r.title })), res, 'accent')}</div><div class="code-cap" data-http></div><div class="thi-lines" data-res></div></div>
        </div>
        <div data-expl></div><div data-what></div>
        <details class="more"><summary>Как выглядит контракт WSDL (фрагмент)</summary><div>${ui.code('<wsdl:operation name="ЗагрузитьВозвраты">\n  <wsdl:input  message="buh:ЗагрузитьВозвратыЗапрос"/>\n  <wsdl:output message="buh:ЗагрузитьВозвратыОтвет"/>\n  <wsdl:fault  name="Ошибка" message="buh:ОшибкаЗагрузки"/>\n</wsdl:operation>\n<xs:element name="Документ">\n  <xs:sequence>\n    <xs:element name="Номер"     type="xs:string"/>\n    <xs:element name="Дата"      type="xs:dateTime"/>\n    <xs:element name="СуммаКоп"  type="xs:long"/>\n    <xs:element name="Основание" type="xs:string"/>\n  </xs:sequence>\n</xs:element>', 'xml', 'WSDL франчайзи 1С')}<p class="small">WSDL — договор в виде файла: какие операции есть, какие поля и каких типов. По нему генерируют код клиента. Поменяли поле без нового WSDL — письма перестали проходить.</p></div></details>
        <div class="eyebrow" style="margin-top:6px">Пачки и отметка «выгружено»</div><div data-batch></div></div>`;
      const lines = (arr, sel) => arr.map(([p, t]) => `<button type="button" class="thi-ln ${p === sel ? 'on' : ''}" data-part="${p}">${ui.hl(t, 'xml')}</button>`).join('');
      function draw() {
        const r = SO_RES[res];
        TR.$('[data-req]', el).innerHTML = lines(SO_REQ, part);
        TR.$('[data-res]', el).innerHTML = lines(r.lines, part);
        TR.$('[data-http]', el).textContent = r.http + ' · Content-Type: text/xml';
        const p = SO_PART[part];
        TR.$('[data-expl]', el).innerHTML = ui.note('', p[0], p[1]);
        TR.$('[data-what]', el).innerHTML = ui.note(r.kind, 'Что делаем: ' + r.title.toLowerCase(), r.what);
      }
      TR.on(el, 'click', '[data-part]', (e, b) => { part = b.dataset.part; draw(); });
      ui.onSeg(el, (k, v) => { if (k === 'res') { res = v; if (v !== 'ok' && part === 'op') part = 'fault'; if (v === 'ok' && part === 'fault') part = 'op'; draw(); } });
      draw();
      // --- пачки ---
      const N = 230, SZ = 100, bx = TR.$('[data-batch]', el);
      let st, T, att, fails, fail = 'no', sql, logs;
      const tm = m => `${pad(9 + Math.floor(m / 60))}:${pad(m % 60)}`;
      const reset = () => { st = new Array(N).fill(0); T = 15; att = null; fails = 0; sql = '-- нажмите «Отправить пачку»'; logs = ['вторник: за понедельник накопилось 230 оплат без отметки']; };
      reset();
      bx.innerHTML = `<div class="stack">
        <p class="small muted">Соседний пример: во вторник в 09:15 задача выгрузки отправляет в 1С оплаты за понедельник — 230 штук, пачками по 100.</p>
        <div class="row"><span class="small dim">1С на второй пачке:</span>${ui.seg('fl', [{ v: 'no', t: '1С примет всё' }, { v: 'yes', t: 'на 2-й пачке 1С упадёт' }], fail, 'accent')}</div>
        <div class="row"><button type="button" class="btn sm primary" data-b="next">Отправить пачку ▶</button><button type="button" class="btn sm ghost" data-b="reset">⟲ Сначала</button><span class="small dim tnum" data-bt></span></div>
        <div class="thi-cells" data-cells aria-label="230 оплат"></div>
        <div class="thi-legend"><span><i></i>ещё не в 1С</span><span><i class="go"></i>уходит сейчас</span><span><i class="ok"></i>принято, отметка стоит</span><span><i class="bad"></i>Fault, отметки нет</span></div>
        <div class="grid3" data-bs></div><div data-bsql></div><div data-bnote></div><pre class="code thi-log" data-blog></pre></div>`;
      function bdraw(noteK, noteT, noteH) {
        const cur = att && att.batches[att.b] ? new Set(att.batches[att.b]) : new Set();
        TR.$('[data-cells]', bx).innerHTML = st.map((s, i) => `<i class="${s === 1 ? 'ok' : s === 2 ? 'bad' : cur.has(i) ? 'go' : ''}"></i>`).join('');
        const okN = st.filter(s => s === 1).length;
        TR.$('[data-bs]', bx).innerHTML = stat('выгружено, с отметкой', `${okN} / ${N}`, okN === N ? 'ok' : '', 'exported_to_1c_at стоит')
          + stat('без отметки', N - okN, N - okN ? 'warn' : 'ok', 'их возьмёт следующая попытка') + stat('время', tm(T), '', att ? `попытка идёт · пачка ${att.b + 1} из ${att.batches.length}` : okN === N ? 'всё выгружено' : 'ждём запуска');
        TR.$('[data-bt]', bx).textContent = okN === N ? 'Готово: все 230 в 1С, ни одной дважды.' : '';
        TR.$('[data-bsql]', bx).innerHTML = ui.code(sql, 'sql', 'что задача делает в нашей базе');
        if (noteT) TR.$('[data-bnote]', bx).innerHTML = ui.note(noteK, noteT, noteH);
        const lg = TR.$('[data-blog]', bx); lg.textContent = logs.join('\n'); lg.scrollTop = lg.scrollHeight;
        TR.$('[data-b="next"]', bx).disabled = okN === N;
      }
      function next() {
        if (!att) {
          const list = st.map((s, i) => s === 1 ? -1 : i).filter(i => i >= 0);
          st = st.map(s => s === 2 ? 0 : s);
          const batches = []; for (let i = 0; i < list.length; i += SZ) batches.push(list.slice(i, i + SZ));
          att = { batches, b: 0 };
          sql = `SELECT public_id, paid_at, amount_kopecks\n  FROM payment\n WHERE status = 'succeeded'\n   AND exported_to_1c_at IS NULL   -- только без отметки\n ORDER BY paid_at;                -- нашлось ${list.length}`;
          logs.push(`${tm(T)}  задача проснулась: без отметки ${list.length} оплат → пачек ${batches.length}`);
          bdraw('', 'Задача проснулась', `Задача берёт <b>только оплаты без отметки</b> — ${list.length} штук — и делит на ${batches.length} ${TR.plural(batches.length, 'пачку', 'пачки', 'пачек')}. Синие клетки уйдут первой пачкой.`);
          return;
        }
        const batch = att.batches[att.b];
        if (fail === 'yes' && fails === 0 && att.b === 1) {
          batch.forEach(i => { st[i] = 2; }); fails++;
          sql = `-- пачка ${att.b + 1}: SOAP Fault, faultcode = Server\n-- UPDATE не делаем: эти ${batch.length} оплат остаются без отметки`;
          logs.push(`${tm(T)}  пачка ${att.b + 1}: SOAP Fault «база недоступна» → отметки не ставим`);
          T += 30; att = null; logs.push(`${tm(T)}  следующая попытка`);
          const okN = st.filter(s => s === 1).length;
          bdraw('warn', 'Fault на второй пачке', `Первая пачка уже в 1С и с отметкой. Вторая получила Fault и осталась без отметки, третья даже не уходила. Следующая попытка в ${tm(T)} возьмёт только оплаты без отметки — ${N - okN} штук. Первая сотня второй раз в 1С не поедет.`);
          return;
        }
        batch.forEach(i => { st[i] = 1; });
        sql = `UPDATE payment\n   SET exported_to_1c_at = now()\n WHERE public_id IN (…${batch.length} номеров этой пачки…);\n-- отметка сразу после «принято» от 1С`;
        logs.push(`${tm(T)}  пачка ${att.b + 1} (${batch.length}): 1С ответила «принято» → отметка у ${batch.length} оплат`);
        att.b++;
        if (att.b >= att.batches.length) { att = null; logs.push(`${tm(T)}  выгрузка закончена`); }
        const done = st.every(s => s === 1);
        bdraw('ok', done ? 'Выгрузка закончена' : 'Пачка принята', done ? (fails ? 'Все 230 оплат в 1С ровно по одному разу: упавшая пачка ушла заново, а уже принятые — нет. Отметка после каждой пачки работает как закладка в книге.' : 'Все 230 оплат в 1С. Теперь нажмите «Сначала», включите «на 2-й пачке 1С упадёт» и посмотрите, что будет при сбое.') : `1С ответила «принято» — сразу ставим отметку этим ${batch.length} оплатам. Если дальше что-то упадёт, они уже не повторятся.`);
      }
      TR.on(bx, 'click', '[data-b]', (e, b) => { if (b.dataset.b === 'reset') { reset(); bdraw('', 'Сначала', 'Все 230 оплат снова без отметки.'); } else next(); });
      ui.onSeg(bx, (k, v) => { if (k === 'fl') { fail = v; reset(); bdraw('', 'Сначала', v === 'yes' ? 'На второй пачке 1С ответит Fault «база недоступна». Отправляйте пачки и следите за клетками.' : '1С примет все пачки. Отправляйте по одной.'); } });
      bdraw();
    }
  };

  // =====================================================================
  // styles · 7. Как выбирать стиль интеграции (к заданию pick)
  // =====================================================================
  const PK_Q = [
    { k: 'speed', t: 'Нужен ответ сразу?', o: [{ v: 'fast', t: 'да, за доли секунды', s: 'доли секунды' }, { v: 'normal', t: 'да, обычный запрос', s: 'обычный ответ' }, { v: 'later', t: 'нет: работа долгая или событие случится потом', s: 'ответ не сразу' }] },
    { k: 'who', t: 'Кто начинает разговор?', o: [{ v: 'ask', t: 'тот, кому нужны данные, спрашивает сам', s: 'спрашивает сам' }, { v: 'push', t: 'наш сервер сам шлёт новости на экран', s: 'сервер шлёт новости' }, { v: 'event', t: 'система, где случилось событие, сама сообщает другой', s: 'о событии сообщают сами' }] },
    { k: 'data', t: 'Сколько данных и как часто?', o: [{ v: 'one', t: 'одна вещь за раз', s: 'одна вещь' }, { v: 'many', t: 'много разных данных на один экран', s: 'много на один экран' }, { v: 'stream', t: 'поток мелких изменений', s: 'поток изменений' }, { v: 'batch', t: 'пачка документов по расписанию', s: 'пачка по расписанию' }] },
    { k: 'rules', t: 'Чьи правила?', o: [{ v: 'ours', t: 'выбираем мы', s: 'выбираем мы' }, { v: 'theirs', t: 'выбора нет: у другой стороны готовый сервис', s: 'правила чужие' }] }
  ];
  const PK_W = {
    rest: { speed: { fast: 1, normal: 2, later: -1 }, who: { ask: 2, push: -2, event: 0 }, data: { one: 2, many: 0, stream: -2, batch: 0 }, rules: { ours: 1, theirs: 0 } },
    gql: { speed: { fast: -1, normal: 2, later: -1 }, who: { ask: 2, push: -2, event: -3 }, data: { one: -1, many: 4, stream: -2, batch: -2 }, rules: { ours: 1, theirs: -3 } },
    grpc: { speed: { fast: 4, normal: 0, later: -2 }, who: { ask: 2, push: 0, event: -2 }, data: { one: 1, many: -1, stream: 1, batch: -1 }, rules: { ours: 1, theirs: -1 } },
    soap: { speed: { fast: -3, normal: 0, later: 1 }, who: { ask: 1, push: -3, event: -1 }, data: { one: 0, many: -2, stream: -3, batch: 2 }, rules: { ours: -3, theirs: 4 } },
    sse: { speed: { fast: 0, normal: 1, later: -1 }, who: { ask: -2, push: 4, event: -2 }, data: { one: -1, many: -1, stream: 3, batch: -3 }, rules: { ours: 1, theirs: -2 } },
    hook: { speed: { fast: -2, normal: 0, later: 2 }, who: { ask: -3, push: 0, event: 4 }, data: { one: 2, many: -2, stream: 0, batch: -1 }, rules: { ours: 0, theirs: 1 } },
    poll: { speed: { fast: -4, normal: -1, later: 3 }, who: { ask: 2, push: -2, event: -2 }, data: { one: 1, many: -1, stream: -2, batch: 1 }, rules: { ours: 1, theirs: -1 } }
  };
  const PK_S = {
    rest: ['REST', 'Обычные запросы к адресам: GET — прочитать, POST — создать. Понятен всем, кэшируется, ошибки видны по кодам.'],
    gql: ['GraphQL', 'Экран сам перечисляет нужные поля и получает всё одним запросом. Для своего приложения, не для партнёров.'],
    grpc: ['gRPC', 'Вызов функции на другом сервере по бланку .proto через постоянно открытую линию. Быстро, есть потоки и дедлайны.'],
    soap: ['SOAP', 'Строгие XML-письма в конверте по контракту WSDL. Обычно его не выбирают, а встречают у старых систем.'],
    sse: ['SSE', 'Сервер держит соединение и сам дописывает новости. Только в одну сторону: сервер → экран.'],
    hook: ['Вебхук', 'Система, где случилось событие, сама зовёт ваш адрес. Нужны подпись, защита от дублей и сверка.'],
    poll: ['202 + опрос статуса', '«Заказ принят, готовлю»: сервер сразу отвечает 202 и адрес статуса, клиент время от времени спрашивает «готово?».']
  };
  const PK_PRE = [
    { t: 'Тренер видит новые записи на своё занятие сразу', a: { speed: 'normal', who: 'push', data: 'stream', rules: 'ours' } },
    { t: 'SMS-шлюз сообщает, что SMS доставлено', a: { speed: 'later', who: 'event', data: 'one', rules: 'theirs' } },
    { t: 'Экран «Мой тренер»: фото, отзывы, занятия, свободные окна', a: { speed: 'normal', who: 'ask', data: 'many', rules: 'ours' } },
    { t: 'Отчёт о загрузке тренеров за год — считается 2 минуты', a: { speed: 'later', who: 'ask', data: 'one', rules: 'ours' } },
    { t: 'Электронный замок шкафчика спрашивает «открыть?» за 200 мс', a: { speed: 'fast', who: 'ask', data: 'one', rules: 'ours' } },
    { t: '1С франчайзи в Казани — тоже только SOAP', a: { speed: 'later', who: 'ask', data: 'batch', rules: 'theirs' } },
    { t: 'Карточка клуба на сайте: адрес и часы работы', a: { speed: 'normal', who: 'ask', data: 'one', rules: 'ours' } }
  ];
  const howPick = {
    id: 'how-pick', covers: ['pick'], title: 'Как это работает: как выбирать стиль интеграции', free: true, noReset: true,
    simple: {
      icon: '🧭',
      plain: 'Стиль интеграции выбирают не по моде, а по четырём вопросам: нужен ли ответ сразу, кто начинает разговор, сколько данных и как часто, чьи правила.',
      analogy: 'Как связаться с клубом. Спросить расписание — позвонить на ресепшен. Узнать, что освободилось место, — клуб сам пришлёт SMS. Заказать справку для бухгалтерии — оставить заявку и потом спросить «готово?». В налоговую — только по их форме, другой не примут.',
      tech: 'REST — ресурсы и кэш; GraphQL — гибкая выборка для своего клиента; gRPC — быстрые вызовы и потоки между своими сервисами и устройствами; SOAP — строгий XML-контракт у старых систем; SSE — поток сервер → клиент; вебхук — событие сообщает тот, у кого оно случилось; 202 + опрос — долгая операция без висящего соединения.'
    },
    lead: ui.brief({
      situation: 'Перед вами семь стилей связи систем. Чтобы выбрать, не нужно помнить их все наизусть — достаточно ответить на четыре вопроса о связи. Потренируемся на соседних примерах «Пульса» — их нет в задании.',
      todo: ['Нажмите на пример сверху — переключатели встанут сами. Посмотрите, какой стиль подсветился и почему.', 'Меняйте по одному ответу и смотрите, как меняется подсветка. Например, у замка шкафчика поменяйте «доли секунды» на «обычный запрос».', 'Попробуйте собрать свою ситуацию из жизни клуба и проверить себя.'],
      look: 'Зелёная рамка — лучший выбор при ваших ответах, синяя — тоже подойдёт, бледные — не подходят. На карточке стиля метки показывают, с какими ответами он согласен (✓) и с какими спорит (✕). Число справа — сколько «очков» набрал стиль: это подсказка, а не закон.'
    }),
    render(el) {
      const a = Object.assign({}, PK_PRE[4].a);
      el.innerHTML = `<div class="stack">
        <div class="stack tight"><span class="small dim">Соседние примеры:</span><div class="facts-row">${PK_PRE.map((p, i) => `<button type="button" class="chip" data-pre="${i}" aria-pressed="${i === 4}" style="white-space:normal;text-align:left">${p.t}</button>`).join('')}</div></div>
        <div class="thi-set" data-qs></div>
        <div class="thi-sty" data-sty></div><div data-pnote></div></div>`;
      const drawQ = () => { TR.$('[data-qs]', el).innerHTML = PK_Q.map(q => `<div class="lbl"><b>${q.t}</b></div><div>${ui.seg(q.k, q.o, a[q.k], 'accent')}</div>`).join(''); };
      function draw() {
        const sc = Object.entries(PK_W).map(([id, w]) => ({ id, s: PK_Q.reduce((s, q) => s + w[q.k][a[q.k]], 0) })).sort((x, y) => y.s - x.s);
        const top = sc[0].s;
        TR.$('[data-sty]', el).innerHTML = sc.map((x, i) => {
          const cls = i === 0 ? 'top' : (x.s >= top - 2 && x.s > 0 ? 'alt' : 'dim');
          const chips = PK_Q.map(q => { const w = PK_W[x.id][q.k][a[q.k]], o = q.o.find(x => x.v === a[q.k]), ans = o.s || o.t; return w > 0 ? `<span class="chip ok">✓ ${ans}</span>` : w < 0 ? `<span class="chip bad">✕ ${ans}</span>` : ''; }).join('');
          return `<div class="${cls}"><div class="nm"><span>${PK_S[x.id][0]}</span><span class="small mono">${x.s > 0 ? '+' : ''}${x.s}</span></div><div class="small">${PK_S[x.id][1]}</div><div class="chips">${chips}</div></div>`;
        }).join('');
        const best = PK_S[sc[0].id][0];
        TR.$('[data-pnote]', el).innerHTML = ui.note(a.rules === 'theirs' ? 'warn' : 'ok', 'Вывод', a.rules === 'theirs'
          ? `Лучше всего подходит <b>${best}</b>. Но помните: когда правила чужие, стиль не выбирают, а принимают. Ваша работа — защитить себя на стыке: повторы без дублей, окна работы, сверка.`
          : `Лучше всего подходит <b>${best}</b>. Проверьте себя: можете ли вы объяснить выбор одной фразой через ответы на четыре вопроса? Если стиль выбран «потому что модно» — это лишняя поддержка и лишний мониторинг.`);
      }
      TR.on(el, 'click', '[data-pre]', (e, b) => { Object.assign(a, PK_PRE[+b.dataset.pre].a); TR.$$('[data-pre]', el).forEach(x => x.setAttribute('aria-pressed', String(x === b))); drawQ(); draw(); });
      ui.onSeg(el, (k, v) => { if (k in a) { a[k] = v; TR.$$('[data-pre]', el).forEach(x => x.setAttribute('aria-pressed', 'false')); draw(); } });
      drawQ(); draw();
    }
  };

  // =====================================================================
  // flows · 8. Сквозной сценарий и таблица потоков (к заданиям buy, whatif, pass, bugs)
  // =====================================================================
  const FZ_LANES = [L('app', 'Приложение', 'телефон Анны'), L('api', 'API «Пульса»', 'бэкенд'), L('db', 'БД', 'PostgreSQL'), L('ctl', 'Контроллер', 'турникет клуба'), L('push', 'FCM / APNs', 'пуши')];
  const FZ_ROWS = [
    { from: 'Приложение → API', how: 'REST, HTTPS', what: 'даты заморозки + <code>Idempotency-Key</code>', fail: 'Ответа нет → повтор с тем же ключом: второй заморозки не будет' },
    { from: 'API → БД', how: 'SQL', what: 'вид абонемента, сколько дней заморозки уже потрачено', fail: 'Правило нарушено → <code>422</code> с понятным текстом' },
    { from: 'API → БД', how: 'SQL, одна транзакция', what: 'строка заморозки + новый срок абонемента', fail: 'Два запроса наперегонки → база не даст заморозкам пересечься, второму <code>409</code>' },
    { from: 'API → Приложение', how: 'REST', what: '<code>201</code>: id заморозки, новый срок, ссылки', fail: 'Ответ потерялся → шаг 1 повторится и получит этот же 201' },
    { from: 'API → Контроллер', how: 'gRPC-поток, Protobuf', what: 'изменение списка пропусков', fail: 'Клуб без связи → изменение доедет при переподключении' },
    { from: 'API → FCM / APNs', how: 'REST, HTTP/2', what: 'текст пуша + id абонемента', fail: 'Пуш не дошёл → не страшно: правда в приложении берётся из GET' },
    { from: 'Приложение → API', how: 'REST', what: 'мои абонементы: статус и срок', fail: 'С отстающей копии базы читать нельзя → «моё» читаем с мастера' }
  ];
  const FZ_STEPS = [
    { from: 'app', to: 'api', t: 'POST …/freezes\nIdempotency-Key: F1', row: 0, note: 'Анна выбрала даты: пауза с 13 по 26 октября, 14 дней. Приложение придумывает ключ F1 один раз на нажатие и отправляет запрос.' },
    { from: 'api', to: 'db', t: 'проверить правила:\n12 мес, дни, ≥ 7', row: 1, note: 'Сервер проверяет правила клуба: заморозка только для 6 и 12 месяцев, не больше 30 дней в год, кусок не меньше 7 дней. У Анны «Вся сеть · 12 мес», потрачено 0 дней — можно.' },
    { from: 'api', to: 'db', t: 'транзакция: заморозка\n+ срок +14 дней', row: 2, kind: 'ok', note: 'Одной транзакцией: записать заморозку и сдвинуть окончание абонемента на 14 дней — с 31.03 на 14.04. Всё или ничего.' },
    { from: 'api', to: 'app', t: '201 Created', reply: true, kind: 'ok', row: 3, note: 'Сервер отвечает 201 Created: заморозка создана, вот её id и новый срок абонемента.' },
    { from: 'api', to: 'ctl', t: 'WatchAllowlist:\nАнна — пауза 13–26.10', kind: 'info', row: 4, note: 'Сервер сообщает контроллерам клубов: у Анны пауза. Это поток gRPC <code>WatchAllowlist</code> — тот же, что держит офлайн-список пропусков свежим.' },
    { from: 'api', to: 'push', t: 'пуш «Заморозка оформлена»', kind: 'info', row: 5, note: 'Пуш — вежливость, а не источник правды. Если он не дойдёт, ничего не сломается.' },
    { from: 'app', to: 'api', t: 'GET /me/memberships', row: 6, note: 'Анна открывает «Мои абонементы». Сервер читает с главной базы — мастера: только что изменённое берём только оттуда.' },
    { from: 'api', to: 'app', t: '200: пауза, срок до 14.04', reply: true, kind: 'ok', row: 6, note: 'Анна видит: абонемент на паузе с 13.10, срок продлён до 14.04.2027. Сквозной сценарий закончен.' }
  ];
  const FZ_WHATIF = [
    { id: 'lost', t: 'Ответ потерялся', sumKind: 'ok', sum: 'Одна заморозка, а не две. Без ключа Анна потратила бы 28 дней из 30 и летом заморозить абонемент уже не смогла бы. В таблице потоков — строки № 1 и № 4, колонка «Если сбой».',
      steps: [
        { from: 'app', to: 'api', t: 'POST …/freezes\nключ F1', note: 'Анна нажала «Заморозить». Запрос ушёл с ключом F1.' },
        { from: 'api', to: 'db', t: 'заморозка\n+ срок +14 дней', kind: 'ok', note: 'Сервер всё сделал.' },
        { from: 'api', to: 'app', t: '201 Created', lost: true, kind: 'bad', note: 'Анна в лифте: ответ не дошёл. Приложение не знает, оформилась ли заморозка.' },
        { from: 'app', to: 'api', t: 'повтор, тот же F1', kind: 'warn', note: 'Через 10 секунд приложение повторяет запрос — <b>с тем же</b> ключом.' },
        { from: 'api', to: 'db', t: 'ключ F1 уже есть →\nвзять ответ', kind: 'ok', note: 'Сервер находит ключ: операция уже сделана. Заново ничего не делает, а достаёт сохранённый ответ.' },
        { from: 'api', to: 'app', t: '201 (тот же)', reply: true, kind: 'ok', note: 'Анна получает тот же ответ, что и в первый раз.' }
      ] },
    { id: 'race', t: 'Два запроса наперегонки', sumKind: 'ok', sum: 'Защиту держит сама база, а не «аккуратный код»: ограничение не даёт заморозкам одного абонемента пересекаться. В таблице — строка № 3.',
      steps: [
        { from: 'app', to: 'api', t: 'POST …/freezes\nключ F1 (телефон)', note: 'Анна нажала «Заморозить» в приложении…' },
        { from: 'app', to: 'api', t: 'POST …/freezes\nключ W7 (сайт)', kind: 'warn', note: '…и в ту же секунду — в личном кабинете на сайте. Ключи разные: для сервера это две разные операции.' },
        { from: 'api', to: 'db', t: 'транзакция 1:\nзаморозка 13–26.10', kind: 'ok', note: 'Первая транзакция записывает заморозку.' },
        { from: 'api', to: 'db', t: 'транзакция 2:\nзаморозка 13–26.10', kind: 'bad', note: 'Вторая пытается записать заморозку на те же дни.' },
        { from: 'db', to: 'api', t: 'даты пересекаются —\nотказ', reply: true, kind: 'warn', note: 'Ограничение в базе: у одного абонемента заморозки не пересекаются по датам. Вставка отклонена, транзакция откатилась — срок не сдвинулся второй раз.' },
        { from: 'api', to: 'app', t: '201 телефону, 409 сайту', reply: true, kind: 'ok', note: 'Телефон получил 201, сайт — 409 «на эти даты заморозка уже есть».' }
      ] },
    { id: 'offline', t: 'Клуб без связи', sumKind: 'warn', sum: 'Небольшая утечка: клиент на паузе прошёл в клуб. Это вопрос к бизнесу, а не баг: допустимо ли так, пока клуб без связи? Записываем в таблицу потоков, строка № 5, и спрашиваем Ольгу.',
      steps: [
        { from: 'api', to: 'ctl', t: 'WatchAllowlist:\nАнна — пауза', lost: true, kind: 'bad', note: 'В клубе «Пульс Химки» пропал интернет: изменение не доехало.' },
        { from: 'app', to: 'ctl', t: 'QR · 14.10, 08:00', note: 'Анна забыла про паузу и пришла в клуб.' },
        { from: 'ctl', to: 'ctl', t: 'по списку: действует →\nоткрыто', kind: 'warn', note: 'Контроллер решает по своему списку — там паузы ещё нет. Анну пустили.' },
        { from: 'api', to: 'ctl', t: 'связь вернулась:\nизменение доехало', kind: 'ok', note: 'Связь восстановилась, поток прислал изменение.' },
        { from: 'ctl', to: 'api', t: 'досылка события прохода', note: 'Проход Анны досылается в базу — его увидят в отчётах.' }
      ] },
    { id: 'push', t: 'Пуш не дошёл', sumKind: 'ok', sum: 'Ничего не сломалось: пуш — уведомление, а не источник правды. В таблице — строка № 6.',
      steps: [
        { from: 'api', to: 'push', t: 'пуш «Заморозка оформлена»', note: 'Сервер отдал пуш в FCM.' },
        { from: 'push', to: 'app', t: 'доставка', lost: true, kind: 'bad', note: 'Телефон был выключен — пуш потерялся.' },
        { from: 'app', to: 'api', t: 'GET /me/memberships', note: 'Вечером Анна открывает приложение.' },
        { from: 'api', to: 'app', t: '200: пауза, до 14.04', reply: true, kind: 'ok', note: 'Экран показывает правду из базы.' }
      ] },
    { id: 'replica', t: 'Читаем с реплики', sumKind: 'bad', sum: 'Лечение: «моё» — абонементы, записи, платежи — читаем с мастера, сразу после изменения. В таблице — строка № 7.',
      steps: [
        { from: 'api', to: 'db', t: 'транзакция: заморозка', kind: 'ok', note: 'Заморозка записана в главную базу — мастер.' },
        { from: 'app', to: 'api', t: 'GET /me/memberships', note: 'Через секунду приложение обновляет экран.' },
        { from: 'api', to: 'db', t: 'читаем с реплики\n(отстаёт на 2 с)', kind: 'warn', note: 'Сервер по ошибке читает «мои абонементы» с асинхронной реплики — копии базы, которая отстаёт на пару секунд.' },
        { from: 'api', to: 'app', t: '200: без паузы,\nсрок до 31.03', reply: true, kind: 'bad', note: 'Анна видит старый срок и думает, что заморозка не оформилась.' },
        { from: 'app', to: 'api', t: 'POST …/freezes\nновый ключ', kind: 'bad', note: 'Она нажимает «Заморозить» ещё раз — уже с новым ключом.' },
        { from: 'api', to: 'app', t: '409: даты пересекаются', reply: true, kind: 'warn', note: 'База не дала задвоить, но Анна в недоумении и звонит на ресепшен.' }
      ] }
  ];
  const FZ_EX = [
    { t: '1', html: () => ui.http({ method: 'POST', path: '/v1/memberships/3f6b2a90-…/freezes', headers: [['Authorization', 'Bearer eyJhbGciOi…'], ['Idempotency-Key', 'b5e0c2d4-8a1f-4e7b-9c3d-6f2a1e0b7d58'], ['Content-Type', 'application/json']], body: { startsOn: '2026-10-13', endsOn: '2026-10-26' }, cap: 'шаг 1 · приложение → API' }),
      why: ['<code>startsOn</code> и <code>endsOn</code> — даты без времени: заморозка считается целыми днями.', 'В теле нет <code>clientId</code>: кто замораживает, сервер знает из токена.', 'Ключ придуман один раз на нажатие и повторяется в каждом повторе.'] },
    { t: '2', html: () => ui.code('SELECT p.duration_days, p.freeze_days_allowed,\n       m.freeze_days_used, m.status\n  FROM membership m\n  JOIN membership_plan p ON p.id = m.plan_id\n WHERE m.public_id = $1\n   AND m.client_id = $2;   -- $2 из токена', 'sql', 'шаг 2 · API → БД'),
      why: ['Владелец проверяется прямо в запросе: чужой абонемент не найдётся.', 'Доступно 30 дней, потрачено 0, просим 14, кусок не меньше 7 — правила выполнены.'] },
    { t: '3', html: () => ui.code('BEGIN;\nINSERT INTO membership_freeze (membership_id, starts_on, ends_on)\n     VALUES ($1, $2, $3);      -- 13.10 … 26.10\nUPDATE membership\n   SET ends_on = ends_on + 14,\n       freeze_days_used = freeze_days_used + 14\n WHERE id = $1;\nCOMMIT;', 'sql', 'шаг 3 · одна транзакция'),
      why: ['Обе записи — в одной транзакции: не бывает «заморозка есть, а срок не сдвинут».', 'Пересечение двух заморозок не пропустит ограничение в самой таблице.'] },
    { t: '4', html: () => ui.http({ status: 201, headers: [['Location', '/v1/memberships/3f6b2a90-…/freezes/7c1d9e40-…'], ['Content-Type', 'application/json']], body: { id: '7c1d9e40-2b6a-4f1e-8d3c-5a9b0e7f2c11', startsOn: '2026-10-13', endsOn: '2026-10-26', membership: { id: '3f6b2a90-…', endsOn: '2027-04-14', status: 'active' }, createdAt: '2026-10-12T14:31:07+03:00', _links: { cancel: { href: '/v1/memberships/3f6b2a90-…/freezes/7c1d9e40-…', method: 'DELETE' } } }, cap: 'шаг 4 · API → приложение' }),
      why: ['<code>id</code> — uuid: наружу показываем постоянный внешний номер, а не внутренние 1, 2, 3.', '<code>createdAt</code> — момент времени, поэтому с поясом <code>+03:00</code>.', '<code>_links.cancel</code> — будущую заморозку можно отменить, пока она не началась.'] },
    { t: '5', html: () => ui.code('AllowlistUpdate {\n  client_id: "8c2f6b1e-…"\n  action:    PAUSE\n  from:      "2026-10-13"\n  until:     "2026-10-26"\n}', 'proto', 'шаг 5 · API → контроллер, сообщение в потоке'),
      why: ['Контроллеру не нужен весь абонемент — только «кого и до какого числа не пускать».'] },
    { t: '6', html: () => ui.http({ method: 'POST', path: 'https://fcm.googleapis.com/v1/projects/puls/messages:send', headers: { Authorization: 'Bearer ya29…(сервисный ключ)' }, body: { message: { token: 'dJ3k…', notification: { title: 'Заморозка оформлена', body: 'Пауза 13–26 октября. Абонемент продлён до 14 апреля.' }, data: { membershipId: '3f6b2a90-…' } } }, cap: 'шаг 6 · API → FCM' }),
      why: ['В пуше ничего лишнего: текст и id абонемента, чтобы приложение открыло нужный экран.'] },
    { t: '7', html: () => ui.http({ status: 200, headers: { 'Cache-Control': 'private, no-store' }, body: { items: [{ id: '3f6b2a90-…', plan: 'Вся сеть · 12 мес', status: 'active', endsOn: '2027-04-14', freezes: [{ startsOn: '2026-10-13', endsOn: '2026-10-26' }] }] }, cap: 'шаг 7 · ответ на GET /me/memberships' }),
      why: ['Ответ — та же правда, что в главной базе: новый срок и пауза.', 'Личные данные кэшировать по дороге нельзя: <code>private, no-store</code>.'] }
  ];
  const howE2e = {
    id: 'how-e2e', covers: ['buy', 'whatif', 'pass', 'bugs'], title: 'Как это работает: сквозной сценарий и таблица потоков', free: true, noReset: true,
    simple: {
      icon: '🧾',
      plain: 'Сквозной сценарий — путь одного дела через все системы, от нажатия кнопки до последней записи. Его описывают тремя вещами: схемой по шагам, таблицей потоков и примерами сообщений.',
      analogy: 'Как посылка: магазин → склад → курьер → пункт выдачи. По отдельности все работают хорошо, а теряется посылка на передаче из рук в руки. Поэтому на каждой передаче спрашивают: «А если не дошло? А если пришло дважды?»',
      tech: 'Диаграмма последовательности — кто кому что шлёт и в каком порядке. Таблица потоков — по строке на стрелку: откуда, куда, протокол, данные, что при сбое. Альтернативные потоки («что если») — ответ не пришёл, пришёл дважды, участник недоступен. Сквозной пример — настоящие JSON, SQL и XML на каждом шаге: по нему пишут код.'
    },
    lead: ui.brief({
      situation: 'Соседний сценарий, в задании его нет: <b>заморозка абонемента</b>. Анна уезжает в отпуск и в приложении ставит абонемент на паузу с 13 по 26 октября. Кажется, это одна кнопка. На деле дело проходит через пять участников: приложение, наш сервер, базу, контроллеры турникетов и сервис пушей.',
      todo: ['Вкладка «Схема и таблица»: нажимайте «Шаг →» — в таблице подсветится строка этого шага. Нажмите на строку таблицы — схема перескочит к ней.', 'Вкладка «Что если…»: переключайте сбои и проходите каждый по шагам. Чем кончилось и какая строка таблицы это описывает?', 'Вкладка «Сквозной пример»: переключайте шаги и читайте, почему каждое значение записано именно так.'],
      look: 'Колонки схемы — участники, стрелки сверху вниз — порядок во времени. Пунктир — ответ, красный крест — сообщение потерялось. Таблица потоков — та же схема словами: по строке на стрелку. Последняя колонка «Если сбой» — самая важная: её заполняют, задавая на каждой стрелке вопрос «а если не дошло?».'
    }),
    render(el) {
      const host = document.createElement('div'); el.appendChild(host);
      ui.tabs(host, [
        { id: 'flow', t: 'Схема и таблица', render(tp) {
          const pane = document.createElement('div'); tp.appendChild(pane);
          pane.innerHTML = '<div class="stack"><div data-seq></div><div class="eyebrow">Таблица потоков · нажмите на строку</div><div data-tbl></div></div>';
          let cur = -1;
          const drawT = () => {
            TR.$('[data-tbl]', pane).innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>№</th><th>Откуда → куда</th><th>Как</th><th>Что передаём</th><th>Если сбой</th></tr></thead><tbody>${FZ_ROWS.map((r, i) => `<tr class="thi-row ${i === cur ? 'hl' : ''}" data-r="${i}" tabindex="0"><td class="num">${i + 1}</td><td>${r.from}</td><td>${r.how}</td><td>${r.what}</td><td>${r.fail}</td></tr>`).join('')}</tbody></table></div>`;
          };
          const sq = ui.seq(TR.$('[data-seq]', pane), { lanes: FZ_LANES, steps: FZ_STEPS, laneW: 150, title: 'Заморозка абонемента', hint: 'Нажимайте «Шаг →»: в таблице ниже подсветится строка этого шага.', onStep(i, st) { cur = st.row; drawT(); } });
          const jump = tr => { const r = +tr.dataset.r, target = FZ_STEPS.findIndex(s => s.row === r); sq.reset(); for (let k = 0; k <= target; k++) sq.step(); };
          TR.on(pane, 'click', 'tr[data-r]', (e, tr) => jump(tr));
          TR.on(pane, 'keydown', 'tr[data-r]', (e, tr) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); jump(tr); } });
          drawT();
        } },
        { id: 'what', t: 'Что если…', render(tp) {
          const pane = document.createElement('div'); tp.appendChild(pane);
          walk(pane, { lanes: FZ_LANES, laneW: 150, label: 'Сбой', scenarios: FZ_WHATIF });
        } },
        { id: 'ex', t: 'Сквозной пример', render(tp) {
          const pane = document.createElement('div'); tp.appendChild(pane);
          let k = 0;
          pane.innerHTML = `<div class="stack"><div class="row"><span class="small dim">Шаг:</span>${ui.seg('fx', FZ_EX.map((x, i) => ({ v: i, t: x.t })), 0, 'accent')}</div><div data-fx></div></div>`;
          const draw = () => { const x = FZ_EX[k]; TR.$('[data-fx]', pane).innerHTML = `<div class="small dim">${FZ_ROWS[Math.min(k, FZ_ROWS.length - 1)].from} · ${FZ_ROWS[Math.min(k, FZ_ROWS.length - 1)].how}</div>${x.html()}${ui.note('', 'Почему записано так', `<ul class="checks">${x.why.map(w => `<li>${w}</li>`).join('')}</ul>`)}`; };
          ui.onSeg(pane, (n, v) => { if (n === 'fx') { k = +v; draw(); } });
          draw();
        } }
      ], 'flow');
    }
  };

  // =====================================================================
  // incidents · 9. Как расследовать инцидент (к заданиям money, data, contract, edge)
  // =====================================================================
  const IV_LOG = `Пт 18:00:00         deploy push-sender: экземпляров 1 → 2 (pod-a, pod-b)
Сб 09:12:03.114  pod-a  outbox: взял задачи 88101…88120 (20 шт.)
Сб 09:12:03.131  pod-b  outbox: взял задачи 88101…88120 (20 шт.)
Сб 09:12:03.402  pod-a  FCM send push=88107 booking=e1f4… → 200 msg=…a91
Сб 09:12:03.419  pod-b  FCM send push=88107 booking=e1f4… → 200 msg=…b37
Сб 09:12:03.455  pod-a  outbox: отмечены отправленными 88101…88120
Сб 09:12:03.470  pod-b  outbox: отмечены отправленными 88101…88120`;
  const IV_LINES = IV_LOG.split('\n');
  const IV_HYP = [
    { id: 'fcm', t: 'FCM доставляет один пуш дважды', ok: false, mark: { 3: 'hl', 4: 'hl' }, why: 'Опровергнута. У двух пушей <b>разные</b> номера сообщений FCM: <code>…a91</code> и <code>…b37</code>. Значит, мы сами отправили два раза, FCM ни при чём.' },
    { id: 'twice', t: 'Клиент записался дважды — пуши честные', ok: false, mark: { 3: 'hl', 4: 'hl' }, why: 'Опровергнута. В обоих пушах одна и та же запись <code>booking=e1f4…</code>. Да и уникальный индекс «одна активная запись на занятие» второй записи не дал бы.' },
    { id: 'pods', t: 'Два экземпляра рассыльщика берут одни и те же задачи', ok: true, mark: { 0: 'ok', 1: 'ok', 2: 'ok' }, why: 'Подтверждена. <code>pod-a</code> и <code>pod-b</code> за 17 мс взяли <b>одни и те же</b> задачи 88101…88120. И началось всё в пятницу в 18:00 — сразу после того, как экземпляров стало два.' },
    { id: 'app', t: 'Приложение рисует один пуш дважды', ok: false, mark: { 3: 'hl', 4: 'hl' }, why: 'Опровергнута. Если бы дело было в приложении, в логе была бы одна отправка. Их две — от двух разных экземпляров сервера.' }
  ];
  const IV_WHY = [
    ['Почему клиент получил два пуша?', 'Мы отправили пуш дважды: у FCM два разных номера сообщений.'],
    ['Почему отправили дважды?', 'Два экземпляра рассыльщика взяли одну и ту же задачу.'],
    ['Почему взяли одну задачу?', 'Задачу берут простым чтением «все неотправленные» без блокировки: прочитал — потом отметил. Между «прочитал» и «отметил» успевает прочитать второй.'],
    ['Почему это не всплыло раньше?', 'Пока экземпляр был один, читать наперегонки было некому. В пятницу добавили второй — к воскресному пику в 20:00.'],
    ['Почему второй экземпляр добавили без проверки?', 'Нет теста «два рассыльщика на одну очередь» и нет тревоги «два пуша одному клиенту за секунду».']
  ];
  const IV_MEAS = [
    { t: 'Оставить один экземпляр рассыльщика', ok: false, why: 'Пластырь. Дубли пропадут, но в воскресенье в 20:00 один экземпляр не справится — пуши опоздают на минуты.' },
    { t: 'Брать задачи атомарно: «забрать и пометить» одной командой, с пропуском уже занятых строк (<code>FOR UPDATE SKIP LOCKED</code>)', ok: true, why: 'Лечение. Два экземпляра больше не могут взять одну задачу: база отдаёт каждую строку только одному.' },
    { t: 'Ключ схлопывания у пуша = id записи (collapse key): два одинаковых пуша телефон покажет как один', ok: true, why: 'Лечение, второй слой. Даже если дубль когда-нибудь уйдёт, клиент увидит одно уведомление.' },
    { t: 'Извиниться перед клиентами в отзывах', ok: false, why: 'Пластырь. Нужно и вежливо, но причину не трогает.' },
    { t: 'Тест «два рассыльщика, 1 000 задач → ровно 1 000 пушей» и тревога на дубли', ok: true, why: 'Лечение. Не даст повториться при следующем масштабировании и заметит дубли за минуты, а не по отзывам.' }
  ];
  const IV_FAM = {
    dup: ['Что-то случилось дважды', 'Сравните две попытки: номера, ключи, id событий. Один и тот же номер или новый? Кто повторял — клиент, наш сервер, партнёр? Повторы будут всегда — ищите, где повтор стал небезопасным.'],
    old: ['Видно старое или «пропало»', 'Смотрите, <b>откуда</b> читали и <b>когда</b> записали. С какой копии базы? Насколько она отставала? Не прочитали ли двое одно и то же до того, как кто-то записал?'],
    rel: ['Сломалось после релиза или увидели чужое', 'Сравните ответ сервера и заголовки до и после изменения. Какое поле ищет старая версия приложения? Кто ещё хранит копию ответа по дороге?'],
    ext: ['Виноват «внешний» участник', 'Посчитайте, сколько раз и с какой паузой он повторяет. Что мы отвечали ему о лимитах? Каким данным верило устройство и сколько им было лет?']
  };
  const howInvestigate = {
    id: 'how-investigate', covers: ['money', 'data', 'contract', 'edge'], title: 'Как это работает: как расследовать инцидент', free: true, noReset: true,
    simple: {
      icon: '🔦',
      plain: 'Расследование идёт по шагам: симптом → логи → гипотеза → проверка → корневая причина → лечение → строка постмортема. Сначала логи, потом выводы.',
      analogy: 'Как врач. Температура — симптом. Жаропонижающее — пластырь: снимает симптом сегодня. Лечат причину, а чтобы её найти, сдают анализы — у нас это логи. И врач не ругает пациента, а выясняет, почему так вышло.',
      tech: 'Симптом фиксируют фактами (что, с какого момента, сколько). Гипотезу проверяют строкой лога, а не ощущением. Корневую причину ищут методом «пять почему» — пока не дойдут до решения в системе, которое можно изменить. «Человек ошибся» — не корневая причина. Постмортем пишут без поиска виноватых (blameless): что случилось, влияние, причина, почему не заметили, действия с владельцами и сроками.'
    },
    lead: ui.brief({
      situation: 'Учебный инцидент, в задании его нет. Суббота. Клиенты пишут в отзывах: пуш «Вы записаны на йогу 09:00» приходит два раза подряд. Ничего не горит, деньги не задеты, но магазин приложений полон жалоб. Пройдём расследование целиком — так же вы будете разбирать тревоги ночью.',
      todo: ['Открывайте шаги по одному кнопкой «Следующий шаг». Не забегайте вперёд: сначала подумайте сами.', 'На шаге «Гипотеза» выберите, что, по-вашему, случилось. На шаге «Проверка» посмотрите, что говорит лог. Попробуйте и другие гипотезы.', 'На шаге «Пять почему» нажимайте «Почему?», пока не дойдёте до причины в системе.', 'Разложите меры: пластырь или лечение.', 'Внизу — подсказка на ночь: куда смотреть в логе при разных симптомах.'],
      look: 'Лог — журнал, где сервер записывает каждое событие: время, кто, что сделал. В логе на шаге «Проверка» зелёным подсвечены строки, которые подтверждают гипотезу, жёлтым — строки, которые её опровергают. <b>Пластырь</b> снимает симптом сегодня, <b>лечение</b> не даёт повториться.'
    }),
    render(el) {
      let open = 1, hyp = null, whys = 1;
      const tried = new Set(), meas = {};
      let blame = 'sys';
      const STEPS = [
        { t: 'Симптом', body: () => `${ui.say('denis', '«В отзывах пишут: пуш „Вы записаны на йогу“ приходит два раза подряд. С субботы уже 14 отзывов. Это у нас приложение глючит?»')}
          <div class="grid3">${stat('двойных пушей', '1 840', 'bad', 'с пятницы, 18:00')}${stat('кого задело', 'всех', 'warn', 'кто записывался на занятия')}${stat('деньги', 'не задеты', 'ok', 'только уведомления')}</div>
          <p class="small">Зафиксируйте симптом фактами: <b>что</b> видят люди, <b>с какого момента</b>, <b>сколько</b>. Денис уже предлагает гипотезу («приложение глючит») — запомним её, но проверим.</p>` },
        { t: 'Логи', body: () => `${ui.code(IV_LOG, 'text', 'лог рассыльщика пушей (push-sender)')}<p class="small">Читайте по колонкам: время, кто (<code>pod-a</code>, <code>pod-b</code> — два экземпляра сервера), что сделал, какие номера. Номера — главное: одна и та же задача или разные?</p>` },
        { t: 'Гипотеза', body: () => `<p class="small">Выберите, что, по-вашему, случилось. Гипотезу можно поменять.</p><div class="thi-hyp">${IV_HYP.map(h => `<button type="button" data-hyp="${h.id}" aria-pressed="${hyp === h.id}" class="${tried.has(h.id) && open > 3 ? (h.ok ? 'ok' : 'bad') : ''}">${h.t}</button>`).join('')}</div>` },
        { t: 'Проверка', body: () => {
          if (!hyp) return ui.note('warn', 'Сначала гипотеза', 'Выберите гипотезу на шаге 3 — здесь появится её проверка по логу.');
          const h = IV_HYP.find(x => x.id === hyp);
          const marked = IV_LINES.map((ln, i) => h.mark[i] ? `[[${h.mark[i]}]]${ln}[[/]]` : ln).join('\n');
          return `${ui.code(marked, 'text', 'лог: подсвечены строки, на которые опирается проверка')}${ui.note(h.ok ? 'ok' : 'bad', h.ok ? 'Гипотеза подтверждена' : 'Гипотеза опровергнута', h.why)}<p class="small dim">Проверено гипотез: ${tried.size} из ${IV_HYP.length}. Хорошая привычка — опровергнуть и остальные: тогда в постмортеме не будет «наверное».</p>`;
        } },
        { t: 'Корневая причина: пять «почему»', body: () => `<div class="thi-why">${IV_WHY.slice(0, whys).map(([q, a], i) => `<div class="${i === IV_WHY.length - 1 ? 'root' : ''}"><b>${i + 1}. ${q}</b><br>${a}</div>`).join('')}</div>
          ${whys < IV_WHY.length ? '<div class="row"><button type="button" class="btn sm primary" data-whymore>Почему?</button></div>' : ui.note('ok', 'Корневая причина', 'Задачу из очереди берут не атомарно, и никто не проверил это при масштабировании. Это решение в системе, которое можно изменить. «Разработчик добавил сервер» — не причина: он сделал то, что система позволила.')}` },
        { t: 'Пластырь или лечение', body: () => `<p class="small">Для каждой меры выберите: пластырь или лечение.</p>${IV_MEAS.map((m, i) => `<div class="thi-meas"><div>${m.t}</div><div>${ui.seg('m' + i, [{ v: 'p', t: 'пластырь' }, { v: 'l', t: 'лечение' }], meas[i] || '')}</div>${meas[i] ? `<div class="why ${(meas[i] === 'l') === m.ok ? 'ok' : 'bad'}">${(meas[i] === 'l') === m.ok ? '✓ ' : '✕ Не совсем. '}${m.why}</div>` : ''}</div>`).join('')}
          <p class="small dim">Пластыри тоже нужны — ими останавливают ущерб, пока готовится лечение. Плохо, когда в постмортеме только они.</p>` },
        { t: 'Строка постмортема', body: () => `<div class="row"><span class="small dim">Как написать причину:</span>${ui.seg('blame', [{ v: 'man', t: 'виноват человек' }, { v: 'sys', t: 'виновата система проверок' }], blame, 'accent')}</div>
          ${blame === 'man'
            ? ui.note('bad', 'Так не пишут', '«Причина: Вася добавил второй сервер и не подумал». После такого постмортема люди начинают прятать ошибки, а система остаётся прежней: следующий «Вася» сделает то же самое.')
            : `<div class="thi-box"><div class="thi-kv"><b>Что</b><span>Сб 09:12 — пуши о записи уходят по два раза; с Пт 18:00 1 840 дублей</span><b>Влияние</b><span>все, кто записывался; 14 отзывов; деньги не задеты</span><b>Причина</b><span>задачи рассылки берутся не атомарно; второй экземпляр читал те же задачи</span><b>Не заметили</b><span>нет теста на два экземпляра и тревоги на дубли пушей</span><b>Действия</b><span>атомарный захват задач — бэкенд, до среды; ключ схлопывания — бэкенд, до среды; тест и тревога — QA и ИТ, до пятницы</span></div></div>`}` }
      ];
      el.innerHTML = '<div class="stack"><div class="row"><button type="button" class="btn sm primary" data-iv="next">Следующий шаг →</button><button type="button" class="btn sm" data-iv="all">Открыть все</button><button type="button" class="btn sm ghost" data-iv="reset">⟲ Сначала</button><span class="small dim tnum" data-ivn></span></div><div class="stack" data-steps></div><div class="card flat stack" data-fam></div></div>';
      function draw() {
        TR.$('[data-steps]', el).innerHTML = STEPS.map((s, i) => i < open
          ? `<div class="thi-step"><header><span class="no">${i + 1}</span><h4>${s.t}</h4></header>${s.body()}</div>`
          : `<div class="thi-step lock"><header><span class="no">${i + 1}</span><h4>${s.t}</h4><span class="small dim">🔒 откроется следующим</span></header></div>`).join('');
        TR.$('[data-ivn]', el).textContent = `открыто ${open} из ${STEPS.length}`;
        TR.$('[data-iv="next"]', el).disabled = open >= STEPS.length;
      }
      let fam = 'dup';
      function drawFam() {
        const f = IV_FAM[fam];
        TR.$('[data-fam]', el).innerHTML = `<div class="eyebrow">Подсказка на ночь: куда смотреть в логе</div><div>${ui.seg('fam', Object.entries(IV_FAM).map(([v, x]) => ({ v, t: x[0] })), fam, 'accent')}</div>${ui.note('', f[0], f[1])}`;
      }
      TR.on(el, 'click', '[data-iv]', (e, b) => { const a = b.dataset.iv; if (a === 'next') open = Math.min(STEPS.length, open + 1); if (a === 'all') { open = STEPS.length; whys = IV_WHY.length; } if (a === 'reset') { open = 1; hyp = null; whys = 1; tried.clear(); Object.keys(meas).forEach(k => delete meas[k]); blame = 'sys'; } draw(); });
      TR.on(el, 'click', '[data-hyp]', (e, b) => { hyp = b.dataset.hyp; tried.add(hyp); draw(); });
      TR.on(el, 'click', '[data-whymore]', () => { whys = Math.min(IV_WHY.length, whys + 1); draw(); });
      ui.onSeg(el, (k, v) => {
        if (k === 'fam') { fam = v; drawFam(); return; }
        if (k === 'blame') { blame = v; draw(); return; }
        const m = /^m(\d+)$/.exec(k); if (m) { meas[+m[1]] = v; draw(); }
      });
      draw(); drawFam();
    }
  };

  // =====================================================================
  // final · 10. Как защищать решение (к заданиям blitz, trace, speech, summary)
  // =====================================================================
  const DF_SLOTS = [['f', 'Факт', 'из блокнота: что сказал заказчик'], ['b', 'Что сломается', 'без защиты, конкретно'], ['g', 'Чем защищаемся', 'механизм, а не намерение'], ['c', 'Цена решения', 'чем платим']];
  const DF = {
    tz: { t: 'Часовые пояса',
      f: [['Через год откроются клубы в Екатеринбурге (+2 ч к Москве)', 1], ['Так принято во всех серьёзных системах', 0]],
      b: [['занятие «йога 09:00» в Екатеринбурге москвичу покажется в 07:00, а напоминание придёт на два часа раньше', 1], ['со временем могут быть проблемы', 0]],
      g: [['храним момент времени вместе с поясом, а показываем во времени клуба — у каждого клуба записан его пояс', 1], ['разработчики будут внимательны к датам', 0]],
      c: [['каждый экран и отчёт обязан знать пояс клуба, а «выручка за день» считается по местному дню', 1], ['минусов нет', 0]],
      dev: 'Все моменты храним в timestamptz, отображаем в club.timezone по IANA-идентификатору; агрегаты отчётов считаем по локальным суткам клуба.',
      olga: 'Когда откроются Казань и Екатеринбург, время занятий и напоминаний будет правильным в каждом городе, а отчёт «за день» — по местному дню клуба. Переделывать ничего не придётся.',
      thread: ['F-clubs: Казань и Екатеринбург', 'время с поясом + пояс у каждого клуба', 'занятие 09:00 в Екатеринбурге видно как 09:00 по местному'] },
    cdn: { t: 'Сайт и реклама',
      f: [['С рекламы на сайт приходит до 500 запросов в секунду к расписанию, без входа', 1], ['Сайты обычно тормозят', 0]],
      b: [['каждый запрос дошёл бы до базы, а в воскресенье в 20:00 она нужна записи на занятия, а не рекламе', 1], ['будет медленно', 0]],
      g: [['расписание раздаёт CDN-кэш: копия живёт 30 секунд, до базы доходят единицы запросов', 1], ['купим сервер помощнее', 0]],
      c: [['число свободных мест на сайте может отставать до 30 секунд — запись всё равно проверяет места в базе', 1], ['минусов нет', 0]],
      dev: 'Публичный GET расписания отдаём через CDN с Cache-Control: public, max-age=30 и ETag/304; до origin доходят единицы rps.',
      olga: 'Рекламный наплыв не помешает записи: расписание раздаёт отдельный «склад копий», а основная база занята клиентами. Цена — цифра свободных мест на сайте может отставать на полминуты.',
      thread: ['F-site: 500 запросов в секунду', 'CDN, копия на 30 секунд, ETag', 'нагрузка 500 запросов/с на сайт — база не замечает'] },
    onec: { t: 'Выгрузка в 1С',
      f: [['Ирина: одну оплату загрузили дважды — в 1С задвоилась выручка, потом неделя сверки', 1], ['В 1С иногда бывают ошибки', 0]],
      b: [['упавшая утренняя выгрузка при перезапуске зальёт в 1С уже отправленные оплаты ещё раз', 1], ['что-то может пойти не так', 0]],
      g: [['номер документа — постоянный номер платежа, 1С узнаёт повтор; отметка «выгружено» ставится после каждой пачки', 1], ['попросим Ирину проверять вручную', 0]],
      c: [['договорённость с франчайзи 1С о повторах и еженедельная сверка сумм', 1], ['минусов нет', 0]],
      dev: 'Идемпотентная выгрузка: номер документа = public_id, exported_to_1c_at после каждой пачки, ретрай каждые 30 минут в окне 9–19.',
      olga: 'Ирина больше не увидит задвоенной выручки: даже если выгрузка оборвётся и начнётся заново, 1С узнает уже загруженные оплаты и не проведёт их второй раз.',
      thread: ['F-1c-dup: дубль задваивает выручку', 'номер документа = номер платежа, отметка по пачкам', 'оборвать выгрузку на 2-й пачке и запустить заново — дублей нет'] }
  };
  const DF_WEAK = {
    f: '«Так принято» — не факт из блокнота. Комитет спросит: а у нас это зачем?',
    b: 'Расплывчато. Назовите, что именно сломается и у кого — в цифрах и именах.',
    g: '«Будем внимательны» и «купим помощнее» — не механизм. Нужна вещь, которая сработает, даже если человек ошибся.',
    c: '«Минусов нет» — красный флаг. У любого решения есть цена; не назовёте её вы — её назовёт Тимур.'
  };
  const DF_DICT = [['timestamptz', 'время с поясом: в каждом городе — своё правильное время'], ['CDN-кэш', 'склад готовых копий страницы поближе к посетителю'], ['идемпотентность', 'повтор не делает дело второй раз'], ['ретрай с паузами', 'повторяем не сразу, а с растущими паузами, чтобы не добить того, кто и так упал']];
  const howDefend = {
    id: 'how-defend', covers: ['blitz', 'trace', 'speech', 'summary'], title: 'Как это работает: как защищать решение', free: true, noReset: true,
    simple: {
      icon: '🛡️',
      plain: 'Сильная защита решения — одна фраза из четырёх частей: факт → что сломается → чем защищаемся → цена решения. И сказать её нужно на языке того, кто слушает.',
      analogy: 'Как тренер объясняет клиенту программу: «У вас болит колено (факт). Глубокие приседания его добьют (что сломается). Поэтому жим ногами в тренажёре (защита). Цена — прогресс медленнее на месяц». Клиент понимает и соглашается, потому что видит причину.',
      tech: 'Трассируемость: требование → механизм → тест. «Так принято», «будем внимательны», «минусов нет» — слабые звенья, их ловят на комитете. Компромисс (trade-off) называют сами, до вопроса. Бизнесу — язык последствий и цифр из его же слов, разработчикам — термины и механизмы.'
    },
    lead: ui.brief({
      situation: 'Перед защитой потренируемся на соседних темах — их нет в блице. Тимур, Ирина и Ольга спрашивают «почему так?». Ответ из одного звена («так надо») не принимают. Ответ из четырёх звеньев принимают почти всегда.',
      todo: ['Выберите тему и соберите фразу: в каждом из четырёх звеньев выберите вариант. Смотрите, как меняется фраза и её сила.', 'Нарочно выберите слабые варианты и прочитайте, за что их поймает комитет.', 'Сравните плохую и хорошую защиту рядом.', 'Переключите «язык разработчика / язык Ольги» и сравните, как одно и то же звучит для разных людей.'],
      look: 'Цвета фразы: синий — факт, красный — что сломается, зелёный — защита, жёлтый — цена. Волнистое подчёркивание — слабое звено. Полоска «сила» — сколько звеньев из четырёх крепкие. Внизу — «ниточка» трассировки: факт → механизм → тест.'
    }),
    render(el) {
      let topic = 'tz', lang = 'olga';
      const pick = { f: 1, b: 1, g: 1, c: 1 };
      el.innerHTML = `<div class="stack">
        <div class="row"><span class="small dim">Тема:</span>${ui.seg('topic', Object.entries(DF).map(([v, x]) => ({ v, t: x.t })), topic, 'accent')}</div>
        <div class="thi-slots" data-slots></div>
        <div class="thi-phrase" data-phrase></div>
        <div class="row"><span class="small dim">Сила:</span><div style="flex:1;min-width:120px" data-meter></div><span class="small mono" data-mn></span></div>
        <div data-weak></div>
        <div class="eyebrow">Плохая и хорошая защита рядом</div><div class="grid2" data-cmp></div>
        <div class="card flat stack"><div class="row"><span class="eyebrow">Как говорить с бизнесом</span>${ui.seg('lang', [{ v: 'dev', t: 'язык разработчика' }, { v: 'olga', t: 'язык Ольги' }], lang, 'accent')}</div><div data-lang></div>
          <details class="more"><summary>Словарик перевода</summary><div>${ui.table(['Термин', 'Как сказать Ольге'], DF_DICT)}</div></details></div>
        <div class="card flat stack tight"><div class="eyebrow">Ниточка трассировки</div><div class="thi-thread" data-thread></div><p class="small muted">Комитет проверяет, что от каждого важного факта тянется ниточка к механизму и к тесту, который докажет, что механизм работает.</p></div></div>`;
      const phrase = (x, sel, mark) => {
        const part = (k, pre, post) => { const [txt, strong] = x[k][sel[k]]; return `${pre}<span class="${k}${mark && !strong ? ' weak' : ''}">${txt}</span>${post}`; };
        return part('f', '', '. ') + part('b', 'Без защиты ', '. ') + part('g', 'Поэтому ', '. ') + part('c', 'Цена: ', '.');
      };
      function draw() {
        const x = DF[topic];
        TR.$('[data-slots]', el).innerHTML = DF_SLOTS.map(([k, t, sub]) => {
          const order = TR.shuffle([0, 1], topic + k);
          return `<div class="thi-slot"><span class="sl ${k}">${t}</span><span class="small dim">${sub}</span><div class="thi-opts">${order.map(i => `<button type="button" data-sl="${k}" data-i="${i}" aria-pressed="${pick[k] === i}">${x[k][i][0]}</button>`).join('')}</div></div>`;
        }).join('');
        TR.$('[data-phrase]', el).innerHTML = phrase(x, pick, true);
        const strong = DF_SLOTS.filter(([k]) => x[k][pick[k]][1]).length;
        TR.$('[data-meter]', el).innerHTML = ui.meter(strong / 4, strong === 4 ? 'ok' : strong >= 2 ? 'warn' : 'bad');
        TR.$('[data-mn]', el).textContent = `${strong} из 4`;
        const weak = DF_SLOTS.filter(([k]) => !x[k][pick[k]][1]);
        TR.$('[data-weak]', el).innerHTML = weak.length
          ? ui.note('bad', 'Где поймает комитет', `<ul class="checks">${weak.map(([k, t]) => `<li class="bad"><b>${t}:</b> ${DF_WEAK[k]}</li>`).join('')}</ul>`)
          : ui.note('ok', 'Крепкая защита', 'Все четыре звена на месте: факт из блокнота, конкретный ущерб, механизм и честная цена. На такой ответ комитет обычно кивает — и переходит к следующему вопросу.');
        const bad = { f: 0, b: 0, g: 0, c: 0 }, good = { f: 1, b: 1, g: 1, c: 1 };
        const weakIdx = k => x[k][0][1] ? 1 : 0, strongIdx = k => x[k][0][1] ? 0 : 1;
        DF_SLOTS.forEach(([k]) => { bad[k] = weakIdx(k); good[k] = strongIdx(k); });
        TR.$('[data-cmp]', el).innerHTML = `<div class="stack tight"><span class="chip bad" style="justify-self:start">плохо</span><div class="thi-phrase" style="font-size:14px">${phrase(x, bad, true)}</div><p class="small muted">Звучит уверенно, но ни одного звена, за которое можно взяться: нет факта, нет ущерба, нет механизма, а «минусов нет» вызывает недоверие.</p></div>
          <div class="stack tight"><span class="chip ok" style="justify-self:start">хорошо</span><div class="thi-phrase" style="font-size:14px">${phrase(x, good, false)}</div><p class="small muted">Каждое звено проверяемо: факт есть в блокноте, ущерб можно показать, механизм можно протестировать, цена названа заранее.</p></div>`;
        TR.$('[data-lang]', el).innerHTML = lang === 'dev'
          ? `${ui.say('timur', esc(x.dev))}<p class="small muted">Так говорят с Тимуром и разработчиками: точные термины, по ним пишут код. Ольга на этой фразе потеряет нить.</p>`
          : `${ui.say('me', esc(x.olga))}<p class="small muted">Так говорят с Ольгой: что изменится для клиентов и денег, цифры из её же слов, ни одного термина. Термины остаются в документации для Тимура.</p>`;
        TR.$('[data-thread]', el).innerHTML = x.thread.map((s, i) => `${i ? '<span class="a">→</span>' : ''}<span class="k">${['факт', 'механизм', 'тест'][i]}: ${esc(s)}</span>`).join('');
      }
      TR.on(el, 'click', '[data-sl]', (e, b) => { pick[b.dataset.sl] = +b.dataset.i; draw(); });
      ui.onSeg(el, (k, v) => { if (k === 'topic') { topic = v; DF_SLOTS.forEach(([s]) => { pick[s] = DF[v][s][0][1] ? 0 : 1; }); draw(); } if (k === 'lang') { lang = v; draw(); } });
      DF_SLOTS.forEach(([s]) => { pick[s] = DF[topic][s][0][1] ? 0 : 1; });
      draw();
    }
  };

  // ---------- вставка в тренировки ----------
  function addTheory(stageId, list) {
    const s = TR.stageById(stageId); if (!s) return;
    list.forEach(t => { if (!s.tasks.some(x => x.id === t.id)) s.tasks.push(t); });
  }
  addTheory('security', [howAuthn, howOauth, howOwner, howJwt]);
  addTheory('styles', [howOffline, howSoap, howPick]);
  addTheory('flows', [howE2e]);
  addTheory('incidents', [howInvestigate]);
  addTheory('final', [howDefend]);

  TR.glossary([{ term: 'code_verifier и code_challenge', simple: 'Секретное слово и его отпечаток. Слово остаётся в телефоне, на сервер уходит отпечаток; код обменяют на токены, только если предъявят само слово.', tech: 'PKCE (RFC 7636): code_challenge = BASE64URL(SHA-256(code_verifier)). Перехваченный код авторизации без verifier бесполезен.' }], 'security');
  TR.glossary([{ term: 'WSDL', simple: 'Договор в виде файла: какие письма можно слать SOAP-сервису и какие в них графы.', tech: 'Web Services Description Language: операции, сообщения, типы полей. По нему генерируют код клиента; поменяли поле без нового WSDL — письма перестают проходить.' }], 'styles');
  TR.glossary([{ term: 'Таблица потоков', simple: 'Та же схема последовательности, но словами: по строке на каждую стрелку.', tech: 'Колонки: откуда → куда, протокол, данные, что при сбое. Последняя колонка заполняется вопросом «а если не дошло, дошло дважды, участник недоступен?».' }], 'flows');
  TR.glossary([{ term: 'Пять «почему»', simple: 'Спрашиваем «почему?», пока не дойдём до того, что можно изменить в системе.', tech: 'Метод поиска корневой причины. Останавливаются не на «человек ошибся», а на отсутствующей проверке, ограничении или тесте.' }], 'incidents');
  TR.glossary([{ term: 'Цена решения', simple: 'Чем мы платим за выбранную защиту. Называть её нужно самим и заранее.', tech: 'Trade-off: CDN — разгрузка базы, но отставание данных до 30 с; время с поясом — правильные часы в каждом городе, но каждый отчёт обязан знать пояс клуба.' }], 'final');
})();
