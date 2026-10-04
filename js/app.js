/* Оболочка: обложка, программа (маршрут), проигрыватель этапа и подходов, блокнот, словарь, отчёт, тема. */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc, $ = TR.$;
  const view = $('#view'), route = $('#route');
  let current = null;

  // ---------- тема ----------
  const THEME_KEY = 'amp-puls-theme';
  try { const t = localStorage.getItem(THEME_KEY); if (t) document.documentElement.setAttribute('data-theme', t); } catch (e) { }
  $('#themeBtn').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { }
  });

  // ---------- шапка ----------
  function hud(ev) {
    const S = TR.S();
    $('#hudTrust').textContent = S.trust;
    $('#hudXp').textContent = S.xp;
    $('#nbCnt').textContent = TR.facts.count();
    const p = $('#hudPulse');
    p.style.stroke = S.trust >= 60 ? 'var(--accent)' : S.trust >= 30 ? 'var(--warn)' : 'var(--bad)';
    if (ev && ev.dTrust) {
      p.animate([{ transform: 'scaleY(1)' }, { transform: 'scaleY(1.6)' }, { transform: 'scaleY(1)' }], { duration: 380 });
      if (ev.dTrust < 0 && ev.reason) ui.toast(`Доверие ${ev.dTrust}: ${esc(ev.reason)}`, 'bad');
      else if (ev.dTrust > 0 && ev.reason) ui.toast(`Доверие +${ev.dTrust}: ${esc(ev.reason)}`, 'ok', 2200);
    }
  }
  TR.sub('hud', hud);
  TR.sub('fact', () => { if ($('#nb').classList.contains('open')) drawNotebook(); });

  // ---------- маршрут ----------
  function drawRoute() {
    const stages = TR.stages();
    let h = '';
    TR.ACTS.forEach(a => {
      const list = stages.filter(s => s.act === a.n);
      if (!list.length) return;
      const done = list.filter(s => TR.stageState(s.id).done).length;
      h += `<h4>${esc(a.title)} <span class="tnum">${done}/${list.length}</span></h4>`;
      list.forEach(s => {
        const p = TR.stageProgress(s.id), st = TR.stageState(s.id);
        const cls = st.done ? 'done' : p.done ? 'part' : '';
        h += `<button type="button" class="rt ${cls}" data-go="${esc(s.id)}" aria-current="${current === s.id}"><span class="slot">${esc(s.slot || '')}</span><span class="t">${esc(s.title)}</span><span class="st" aria-label="${st.done ? 'пройдено' : p.done ? 'начато' : 'не начато'}"></span></button>`;
      });
    });
    h += `<div class="foot"><button type="button" class="btn sm ghost" data-go="">← Обложка и легенда</button><button type="button" class="btn sm danger" data-reset-all>⟲ Сбросить всё и начать с нуля</button>${TR.teacher() ? '<span class="chip warn">Режим преподавателя</span>' : ''}</div>`;
    route.innerHTML = h;
  }
  TR.on(route, 'click', '[data-go]', (e, b) => { route.classList.remove('open'); go(b.dataset.go); });
  // общий сброс: первое нажатие — подтверждение, второе — стереть всё (ответы, блокнот, доверие, опыт)
  let resetArmed = null;
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-reset-all]'); if (!b) return;
    if (resetArmed !== b) {
      resetArmed = b; const old = b.textContent; b.textContent = 'Точно? Всё пройденное сотрётся — нажмите ещё раз';
      setTimeout(() => { if (resetArmed === b) { resetArmed = null; b.textContent = old; } }, 3500);
      return;
    }
    resetArmed = null; route.classList.remove('open');
    const keepTeacher = TR.teacher();
    TR.reset(); if (keepTeacher) TR.setTeacher(true);
    if ($('#nb').classList.contains('open')) toggleNb(false);
    ui.toast('Всё обнулено: доверие 50, блокнот пуст, тренировки с нуля', 'ok', 4000);
  });
  $('#menuBtn').addEventListener('click', () => route.classList.toggle('open'));
  $('#homeBtn').addEventListener('click', () => go(''));

  // ---------- навигация ----------
  function go(id) {
    const def = id ? TR.stageById(id) : null;
    current = def ? def.id : null;
    try { history.replaceState(null, '', def ? '#s-' + def.id : '#home'); } catch (e) { }
    if (def) drawStage(def); else drawCover();
    drawRoute();
    window.scrollTo({ top: 0 });
  }
  TR.sub('go', id => go(id));
  TR.sub('stages', () => { if (booted) drawRoute(); });
  TR.sub('teacher', () => { drawRoute(); if (current) drawStage(TR.stageById(current)); else drawCover(); });
  TR.sub('reset', () => go(''));

  // ---------- обложка ----------
  function drawCover() {
    const S = TR.S(), stages = TR.stages();
    const acts = TR.ACTS.filter(a => stages.some(s => s.act === a.n));
    const started = stages.some(s => TR.stageProgress(s.id).done);
    const next = stages.find(s => !TR.stageState(s.id).done) || stages[0];
    view.innerHTML = `<div class="wrap">
      <section class="hero">
        <div class="eyebrow">Интерактивный кейс · ${acts.length} ${TR.plural(acts.length, 'неделя', 'недели', 'недель')} · ${stages.length} ${TR.plural(stages.length, 'тренировка', 'тренировки', 'тренировок')}</div>
        <h1>Сеть «Пульс» растёт.<br>Данные и интеграции — <em>ваши</em>.</h1>
        <svg class="ecg" viewBox="0 0 1000 56" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="ecgGrad" x1="0" x2="1"><stop offset="0" stop-color="#6ee7ff"/><stop offset=".5" stop-color="#a78bfa"/><stop offset="1" stop-color="#f0abfc"/></linearGradient></defs>
          <path d="M0 30 H170 L182 30 L190 18 L198 30 H260 L272 6 L284 52 L296 30 H420 L430 22 L440 30 H560 L572 4 L586 54 L598 30 H700 L710 20 L720 30 H840 L852 8 L864 50 L876 30 H1000"/></svg>
        <p class="lede">12 фитнес-клубов, через год 25. Сейчас всё в Excel и старой 1С, клиенты записываются по телефону. Директор хочет приложение, онлайн-оплату, проход по QR и партнёра-агрегатора. Схемы нет, требований нет — есть заказчик, ИТ-команда и вы.</p>
      </section>
      <div class="facts3">
        <div class="fact3"><div class="eyebrow">Задача</div><p>С нуля: выспросить требования, построить <b>три модели данных</b>, решить про <b>репликацию</b>, спроектировать <b>REST</b>, <b>GraphQL</b> и <b>gRPC</b>, пройти все узкие места интеграций. Потом сеть вырастет: брокеры сообщений, архитектура, надёжность и системный дизайн целиком.</p></div>
        <div class="fact3"><div class="eyebrow">Ставка</div><p><b>Доверие команды</b>: начинаете с 50. Ошибки и подсмотренный эталон его тратят, точные решения возвращают.</p></div>
        <div class="fact3"><div class="eyebrow">Правило</div><p>Решения <b>переносятся</b>. Не спросили про офлайн-турникеты в понедельник — в четверг их не будет в блокноте.</p></div>
      </div>
      <div class="weeks">${acts.map(a => {
        const list = stages.filter(s => s.act === a.n), done = list.filter(s => TR.stageState(s.id).done).length;
        return `<div class="week"><div class="eyebrow">${esc(a.title.split(' · ')[0])}</div><h3>${esc(a.title.split(' · ')[1] || a.title)}</h3><p class="small muted">${esc(a.sub)}</p>${ui.meter(list.length ? done / list.length : 0)}<ul>${list.map(s => `<li>${esc(s.title)}</li>`).join('')}</ul></div>`;
      }).join('')}</div>
      <div class="card flat">
        <div class="start-row">
          <div class="field" style="flex:1 1 220px"><label for="stName">Как вас зовут (для отчёта преподавателю)</label><input id="stName" type="text" value="${esc(S.name)}" placeholder="Имя и фамилия" autocomplete="name"></div>
          <div class="field" style="flex:1 1 160px"><label for="stGroup">Группа или поток</label><input id="stGroup" type="text" value="${esc(S.group)}" placeholder="Например, СА-12"></div>
          <button type="button" class="btn primary" id="startBtn">${started ? 'Продолжить: ' + esc(next ? next.title : '') : 'Начать с первой встречи'} →</button>
        </div>
        <div class="row between"><p class="small dim">Прогресс хранится в этом браузере. Отчёт для преподавателя — кнопка «Отчёт» вверху.</p>${started ? '<button type="button" class="btn sm danger" data-reset-all>⟲ Сбросить всё и начать с нуля</button>' : ''}</div>
      </div>
      ${ui.say('vera', `Привет! Я Вера, буду рядом всю программу. Каждая тренировка — несколько подходов: вы делаете сами, потом жмёте «Проверить» и читаете разбор. Эталон открывается после первой попытки, но стоит доверия. Непонятное слово — загляните в «Словарь» вверху, там всё объяснено на бытовых примерах.`)}
    </div>`;
    $('#stName').addEventListener('input', e => { TR.S().name = e.target.value; TR.save(); });
    $('#stGroup').addEventListener('input', e => { TR.S().group = e.target.value; TR.save(); });
    $('#startBtn').addEventListener('click', () => { if (!TR.S().started) { TR.S().started = Date.now(); TR.save(); } next && go(next.id); });
  }

  // ---------- этап ----------
  function drawStage(def) {
    const st = TR.stageState(def.id);
    if (!st.visited) { st.visited = Date.now(); TR.save(); }
    const stages = TR.stages(), idx = stages.indexOf(def), act = TR.ACTS.find(a => a.n === def.act) || { title: '' };
    const prev = stages[idx - 1], next = stages[idx + 1];
    view.innerHTML = `<div class="wrap">
      <div class="stage-head">
        <div class="eyebrow">${esc(act.title)} · тренировка ${idx + 1} из ${stages.length}</div>
        <h1>${esc(def.title)}</h1>
        ${def.when ? `<div class="when">${esc(def.when)}</div>` : ''}
      </div>
      ${def.intro && def.intro.length ? `<div class="talk">${def.intro.map(x => ui.say(x.who || 'vera', x.html || x.t || '', { role: x.role || (def.act >= 5 && x.who === 'timur' ? 'CTO «Пульса»' : null) })).join('')}</div>` : ''}
      <section class="part theory"><header class="part-h"><span class="part-n">1</span><div><h2>Теория</h2><p>Что вспомнить перед практикой. Преподаватель проходит это с группой, вы щёлкаете у себя.</p></div></header>
        <div class="stack" data-theory style="gap:18px"></div></section>
      <section class="part practice"><header class="part-h"><span class="part-n">2</span><div><h2>Практика</h2><p>Делаете сами, шаг за шагом: задание → «Проверить» → разбор. Следующее задание открывается после предыдущего.</p></div></header>
        ${def.facts && def.facts.length ? `<div class="stack tight"><div class="eyebrow">Опора из блокнота</div><div class="facts-row" data-facts></div></div>` : ''}
        <div class="stack" data-tasks style="gap:18px"></div></section>
      <div data-outro></div>
      <div class="stage-nav">${prev ? `<button type="button" class="btn ghost" data-nav="${esc(prev.id)}">← ${esc(prev.title)}</button>` : '<span></span>'}${next ? `<button type="button" class="btn" data-nav="${esc(next.id)}">${esc(next.title)} →</button>` : ''}</div>
    </div>`;
    if (def.facts && def.facts.length) drawFacts(def);
    // практика: задания по порядку
    const practice = TR.practiceTasks(def), theory = def.tasks.filter(TR.isTheory);
    const box = $('[data-tasks]', view);
    const pg = { kind: 'practice', list: practice };
    practice.forEach((t, i) => { const c = document.createElement('section'); c.className = 'task'; c.dataset.tid = t.id; box.appendChild(c); mountTask(def, t, i, c, pg); });
    // теория: в том же порядке, что и задания; вводный раздел встаёт перед первым заданием, которое он объясняет
    const items = [], used = new Set();
    practice.forEach(t => {
      const ex = theory.find(x => (x.covers || []).includes(t.id));
      if (ex) { if (!used.has(ex.id)) { used.add(ex.id); items.push({ ex }); } }
      else if (t.simple) items.push({ card: t });
    });
    theory.filter(x => !used.has(x.id)).reverse().forEach(ex => items.unshift({ ex }));
    const tbox = $('[data-theory]', view), tg = { kind: 'theory', list: items.map(x => x.ex).filter(Boolean) };
    items.forEach((it, k) => {
      if (it.ex) { const c = document.createElement('section'); c.className = 'task'; c.dataset.tid = it.ex.id; tbox.appendChild(c); mountTask(def, it.ex, tg.list.indexOf(it.ex), c, tg, k + 1); }
      else tbox.insertAdjacentHTML('beforeend', `<article class="tcard"><div class="n">1.${k + 1} · к заданию 2.${practice.indexOf(it.card) + 1}</div><h3>${esc(it.card.title)}</h3>${ui.simple(it.card.simple)}</article>`);
    });
    const gl = TR.GLOSSARY.filter(g => g.stage === def.id);
    if (gl.length) tbox.insertAdjacentHTML('beforeend', `<details class="more"><summary>Словарь тренировки · ${gl.length} ${TR.plural(gl.length, 'термин', 'термина', 'терминов')}</summary><div>${gl.map(g => `<div class="gl-item"><b>${esc(g.term)}</b>${g.simple ? `<div>${g.simple}</div>` : ''}${g.tech ? `<div class="small muted">${g.tech}</div>` : ''}</div>`).join('')}</div></details>`);
    if (!items.length && !gl.length) tbox.innerHTML = '<p class="muted">В этой тренировке теория встроена прямо в задания.</p>';
    drawOutro(def);
    try { def.onOpen && def.onOpen(); } catch (e) { console.error(e); }
  }

  function drawFacts(def) {
    const row = $('[data-facts]', view); if (!row) return;
    row.innerHTML = def.facts.map(id => {
      const f = TR.FACTS[id]; if (!f) return '';
      const has = TR.facts.has(id);
      return `<button type="button" class="fchip ${has ? '' : 'miss'} ${f.flag ? 'flag' : ''}" data-fact="${esc(id)}" title="${has ? esc(f.text) : 'Этого нет в блокноте: вы не спросили на встрече'}">${has ? esc(f.short || f.text) : esc(f.topic) + ': не выяснено'}</button>`;
    }).join('');
  }
  TR.on(view, 'click', '[data-nav]', (e, b) => go(b.dataset.nav));
  TR.on(view, 'click', '[data-fact]', (e, b) => {
    const f = TR.FACTS[b.dataset.fact]; if (!f) return;
    if (TR.facts.has(f.id)) { ui.toast(`<b>${esc(f.topic)}.</b> ${esc(f.text)}`, '', 6000); return; }
    const who = TR.PEOPLE[f.who] || TR.PEOPLE.olga;
    const m = ui.modal({ title: 'Этого нет в блокноте', html: `<p>На встрече вы не спросили про тему «${esc(f.topic)}». Можно написать ${esc(who.name)} и уточнить сейчас, но вопрос вдогонку стоит доверия: <b>−2</b>.</p><div class="row"><button type="button" class="btn primary" data-ask>Уточнить сейчас (−2)</button><button type="button" class="btn ghost" data-x>Обойдусь</button></div>` });
    TR.on(m.body, 'click', '[data-ask]', () => {
      TR.facts.unlock(f.id, 'late'); TR.score(-2, 0, 'вопрос вдогонку: ' + f.topic);
      m.body.innerHTML = ui.say(f.who || 'olga', esc(f.answer || f.text)) + `<p class="small dim">Записано в блокнот.</p>`;
      drawFacts(TR.stageById(current));
    });
  });

  // ---------- подход ----------
  function mountTask(def, t, i, card, group, theoryNo) {
    group = group || { kind: 'practice', list: TR.practiceTasks(def) };
    const isTh = group.kind === 'theory';
    const ts = TR.taskState(def.id, t.id);
    if (ts.ans == null) ts.ans = t.blank ? TR.clone(t.blank()) : {};
    const prevDone = isTh || i === 0 || TR.taskState(def.id, group.list[i - 1].id).done;
    const locked = !prevDone && !TR.teacher();
    const total = group.list.length;
    card.dataset.no = theoryNo || card.dataset.no || '';
    const stTag = ts.ok ? ui.status('засчитано', 'ok') : ts.revealed ? ui.status('по эталону', 'warn') : ts.attempts ? ui.status('есть ошибки', 'bad') : locked ? ui.status('закрыто', '') : ui.status('в работе', '');
    card.className = 'task' + (locked ? ' locked' : '');
    const label = isTh ? `1.${card.dataset.no} · теория` : `2.${i + 1} · задание ${i + 1} из ${total}`;
    card.innerHTML = `<header><span class="n">${label}</span><h2>${esc(isTh ? t.title.replace(/^Как это работает:\s*/, 'Как это работает: ') : t.title)}</h2>${isTh ? (ts.done ? ui.status('прочитано', 'ok') : '') : stTag}</header>
      ${locked ? '' : `<div class="tbody">
        ${t.simple ? (isTh ? ui.simple(t.simple) : `<details class="more"><summary>Вспомнить теорию к заданию</summary><div>${ui.simple(t.simple)}</div></details>`) : ''}
        ${t.lead ? `<div class="lead">${t.lead}</div>` : ''}
        <div data-mount></div>
        <div class="feedback" data-fb></div>
        <div data-ref></div>
      </div>
      <div class="tfoot">
        ${t.check ? `<button type="button" class="btn primary" data-act="check">Проверить</button>` : `<button type="button" class="btn primary" data-act="done" ${ts.done || t.free || TR.teacher() ? '' : 'disabled'}>${ts.done ? 'Пройдено ✓' : 'Готово, дальше'}</button>`}
        ${t.check && t.reference ? `<button type="button" class="btn" data-act="ref" ${ts.attempts || ts.revealed || ts.ok || TR.teacher() ? '' : 'disabled'} title="Открывается после первой проверки">${ts.revealed || ts.ok || TR.teacher() ? 'Эталон' : 'Эталон (−3)'}</button>` : ''}
        ${t.blank && !t.noReset ? `<button type="button" class="btn ghost" data-act="reset">Сбросить ответ</button>` : ''}
        <span class="small dim" data-hint>${t.check && !ts.attempts ? 'Эталон откроется после первой проверки.' : ''}</span>
      </div>`}`;
    if (locked) return;
    const mount = $('[data-mount]', card), fb = $('[data-fb]', card), refBox = $('[data-ref]', card);
    let lastResult = null, refOpen = false, armed = false;
    const ctx = {
      stage: def, task: t, state: ts, el: mount,
      get ans() { return ts.ans; },
      set ans(v) { ts.ans = v; TR.save(); },
      save(v) { if (v !== undefined) ts.ans = v; TR.save(); },
      readonly: false,
      get teacher() { return TR.teacher(); },
      get result() { return lastResult; },
      rerender() { render(); },
      ready(on) { const b = $('[data-act="done"]', card); if (b && !ts.done) b.disabled = on === false; },
      decide: (label, value) => TR.decide(def.id, label, value),
      score: TR.score, toast: ui.toast, facts: TR.facts,
      check: () => doCheck()
    };
    function render() {
      mount.innerHTML = '';
      const inner = document.createElement('div'); mount.appendChild(inner);
      try { t.render(inner, ctx); } catch (e) { console.error(e); inner.innerHTML = ui.note('bad', 'Ошибка подхода', esc(e.message)); }
    }
    function showFeedback(r) {
      const k = r.ok ? 'ok' : (r.score >= .6 ? 'warn' : 'bad');
      fb.innerHTML = `<div class="note ${k}"><div class="ttl">${r.ok ? 'Засчитано' : 'Пока не сходится'} · ${Math.round((r.score != null ? r.score : (r.ok ? 1 : 0)) * 100)}%</div>
        ${r.summary ? `<div class="sum">${r.summary}</div>` : ''}
        ${r.notes && r.notes.length ? `<ul class="checks">${r.notes.map(n => `<li class="${n.ok === true ? '' : n.ok === false ? 'bad' : (n.ok || 'warn')}">${n.html || esc(n.t || '')}</li>`).join('')}</ul>` : ''}</div>
        ${r.vera ? ui.say('vera', r.vera) : ''}`;
    }
    function showExplain() {
      if (!t.explain) return;
      if ($('[data-explain]', card)) return;
      fb.insertAdjacentHTML('beforeend', `<div class="ref-box" data-explain><div class="eyebrow">Разбор Веры</div><div class="stack">${t.explain}</div></div>`);
    }
    function doCheck() {
      let r;
      try { r = t.check(TR.clone(ts.ans), ctx) || { ok: false, score: 0 }; } catch (e) { console.error(e); r = { ok: false, score: 0, summary: 'Проверка споткнулась: ' + esc(e.message) }; }
      if (r.score == null) r.score = r.ok ? 1 : 0;
      ts.attempts++;
      ts.best = Math.max(ts.best || 0, r.score);
      if (r.ok && !ts.ok) {
        ts.ok = true;
        if (ts.revealed) TR.score(0, 5, null);
        else if (ts.attempts === 1) TR.score(3, 20, 'с первой попытки: ' + t.title);
        else TR.score(1, 12, null);
      } else if (!r.ok && ts.attempts <= 3 && !ts.ok) TR.score(-1, 0, null);
      const wasDone = ts.done;
      ts.done = ts.done || ts.ok;
      TR.save();
      lastResult = r;
      showFeedback(r);
      if (ts.done) showExplain();
      render();
      refreshFoot();
      if (!wasDone && ts.done) afterDone();
      return r;
    }
    function refreshFoot() {
      const head = $('header .status', card);
      if (head) head.outerHTML = ts.ok ? ui.status('засчитано', 'ok') : ts.revealed ? ui.status('по эталону', 'warn') : ts.attempts ? ui.status('есть ошибки', 'bad') : ui.status('в работе', '');
      const rb = $('[data-act="ref"]', card);
      if (rb) { rb.disabled = !(ts.attempts || ts.revealed || ts.ok || TR.teacher()); rb.textContent = refOpen ? 'Скрыть эталон' : (ts.revealed || ts.ok || TR.teacher() ? 'Эталон' : 'Эталон (−3)'); }
      const hint = $('[data-hint]', card);
      if (hint) hint.textContent = ts.ok ? '' : ts.attempts && !ts.revealed ? 'Исправьте и проверьте снова — или откройте эталон.' : '';
      const db = $('[data-act="done"]', card);
      if (db && ts.done) { db.disabled = true; db.textContent = 'Пройдено ✓'; }
    }
    function showRef() {
      refOpen = !refOpen;
      if (!refOpen) { refBox.innerHTML = ''; refreshFoot(); return; }
      refBox.innerHTML = `<div class="ref-box"><div class="eyebrow">Эталон</div><div data-refmount></div></div>`;
      const m = $('[data-refmount]', refBox);
      const refAns = TR.clone(t.reference());
      let refRes = null; try { refRes = t.check(TR.clone(refAns), {}); } catch (e) { }
      const rctx = Object.assign({}, ctx, { readonly: true, result: refRes, save() { }, rerender() { }, state: { ans: refAns } });
      Object.defineProperty(rctx, 'ans', { get: () => refAns, set() { } });
      try { t.render(m, rctx); } catch (e) { m.innerHTML = ui.note('bad', 'Ошибка эталона', esc(e.message)); }
      if (t.refNote) m.insertAdjacentHTML('beforeend', `<div class="note" style="margin-top:12px">${t.refNote}</div>`);
      refreshFoot();
    }
    card.addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b || !card.contains(b)) return;
      const a = b.dataset.act;
      if (a === 'check') doCheck();
      if (a === 'reset') {
        if (!armed) { armed = true; b.textContent = 'Точно сбросить?'; setTimeout(() => { armed = false; b.textContent = 'Сбросить ответ'; }, 2500); return; }
        armed = false; b.textContent = 'Сбросить ответ';
        ts.ans = TR.clone(t.blank()); lastResult = null; fb.innerHTML = ''; TR.save(); render();
      }
      if (a === 'ref') {
        if (!ts.revealed && !ts.ok && !TR.teacher() && !refOpen) {
          ts.revealed = true; TR.score(-3, 0, 'подсмотрели эталон');
          const wasDone = ts.done; ts.done = true; TR.save();
          showExplain();
          if (!wasDone) afterDone();
        }
        showRef();
      }
      if (a === 'done') {
        if (ts.done) return;
        ts.done = true; ts.ok = true; ts.best = 1; TR.score(0, 10, null); TR.save();
        refreshFoot(); showExplain(); afterDone();
      }
    });
    function afterDone() {
      if (!isTh) {
        const box = card.parentElement, cards = TR.$$('section.task', box), j = cards.indexOf(card);
        const nextCard = cards[j + 1];
        if (nextCard && nextCard.classList.contains('locked')) { mountTask(def, group.list[j + 1], j + 1, nextCard, group); }
      }
      const st = TR.stageState(def.id);
      if (!st.done && TR.practiceTasks(def).every(x => TR.taskState(def.id, x.id).done)) { st.done = Date.now(); TR.score(2, 30, 'тренировка пройдена: ' + def.title); TR.save(); TR.emit('stage-done', def.id); drawOutro(def); }
      drawRoute();
    }
    render();
    if (ts.done && t.explain && (ts.ok || ts.revealed || TR.teacher())) showExplain();
    if (TR.teacher() && t.reference && t.check) { /* преподаватель видит эталон по кнопке без штрафа */ }
  }

  function drawOutro(def) {
    const box = $('[data-outro]', view); if (!box) return;
    const st = TR.stageState(def.id);
    if (!st.done) { box.innerHTML = ''; return; }
    const stages = TR.stages(), next = stages[stages.indexOf(def) + 1], p = TR.stageProgress(def.id);
    box.innerHTML = `<div class="outro"><div class="eyebrow">Тренировка пройдена · точность ${Math.round(p.score * 100)}%</div>
      ${def.outro ? ui.say('vera', def.outro) : ''}
      ${next ? `<div><button type="button" class="btn primary" data-nav="${esc(next.id)}">Следующая: ${esc(next.title)} →</button></div>` : ''}</div>`;
  }

  // ---------- блокнот ----------
  function drawNotebook() {
    const S = TR.S(), teacher = TR.teacher();
    const topics = TR.TOPICS;
    let h = `<p class="small muted">Сюда попадает всё, что вы выяснили на встречах. На эти факты опираются следующие тренировки. ⚑ — критичные.</p>`;
    topics.forEach(tp => {
      const all = TR.facts.all().filter(f => f.topic === tp);
      const got = all.filter(f => TR.facts.has(f.id));
      if (!got.length && !teacher) { h += `<div class="nb-topic"><h4>${esc(tp)} <span>0/${all.length}</span></h4><div class="small dim">Пока ничего не выяснено.</div></div>`; return; }
      h += `<div class="nb-topic"><h4>${esc(tp)} <span>${got.length}/${all.length}</span></h4>${(teacher ? all : got).map(f => {
        const has = TR.facts.has(f.id), who = TR.PEOPLE[f.who];
        return `<div class="nb-item ${f.flag ? 'flag' : ''} ${has ? '' : 'teacher-off'}" ${teacher ? `data-tfact="${esc(f.id)}" title="Преподаватель: нажмите, чтобы ${has ? 'убрать' : 'отметить'} факт"` : ''}>${esc(f.text)}<span class="src">${who ? esc(who.name) : ''}${S.facts[f.id] && S.facts[f.id].how === 'late' ? ' · уточнено вдогонку' : ''}</span></div>`;
      }).join('')}</div>`;
    });
    h += `<div class="field"><label for="nbNotes">Мои заметки</label><textarea id="nbNotes" rows="6" placeholder="Гипотезы, вопросы на потом, договорённости">${esc(S.notes)}</textarea></div>`;
    $('#nbBody').innerHTML = h;
  }
  $('#nbBody').addEventListener('input', e => { if (e.target.id === 'nbNotes') { TR.S().notes = e.target.value; TR.save(); } });
  TR.on($('#nbBody'), 'click', '[data-tfact]', (e, b) => { const id = b.dataset.tfact; if (TR.facts.has(id)) TR.facts.lock(id); else TR.facts.unlock(id, 'teacher'); drawNotebook(); if (current) drawFacts(TR.stageById(current)); });
  function toggleNb(open) {
    const nb = $('#nb'), on = open == null ? !nb.classList.contains('open') : open;
    if (on) drawNotebook();
    nb.classList.toggle('open', on);
    $('#nbBtn').setAttribute('aria-pressed', String(on));
  }
  $('#nbBtn').addEventListener('click', () => toggleNb());
  TR.on($('#nb'), 'click', '[data-close-nb]', () => toggleNb(false));
  TR.notebook = toggleNb;

  // ---------- словарь ----------
  $('#glBtn').addEventListener('click', () => {
    const list = TR.GLOSSARY.slice().sort((a, b) => a.term.localeCompare(b.term, 'ru'));
    ui.modal({
      title: `Словарь · ${list.length} ${TR.plural(list.length, 'термин', 'термина', 'терминов')}`,
      html: `<input type="text" id="glQ" placeholder="Найти термин: идемпотентность, ETag, реплика…" aria-label="Поиск по словарю"><div class="stack" id="glList"></div>`,
      onMount(body) {
        const draw = q => {
          const n = TR.norm(q);
          const hits = list.filter(g => !n || TR.norm(g.term + ' ' + (g.simple || '') + ' ' + (g.tech || '')).includes(n));
          $('#glList', body).innerHTML = hits.length ? hits.map(g => `<div class="gl-item"><b>${esc(g.term)}</b>${g.simple ? `<div>${g.simple}</div>` : ''}${g.tech ? `<div class="small muted">${g.tech}</div>` : ''}${g.stage && TR.stageById(g.stage) ? `<div><button type="button" class="btn xs ghost" data-glgo="${esc(g.stage)}">Тренировка: ${esc(TR.stageById(g.stage).title)} →</button></div>` : ''}</div>`).join('') : '<p class="muted">Ничего не нашлось.</p>';
        };
        $('#glQ', body).addEventListener('input', e => draw(e.target.value));
        TR.on(body, 'click', '[data-glgo]', (e, b) => { body.closest('.modal').remove(); go(b.dataset.glgo); });
        draw('');
      }
    });
  });

  // ---------- отчёт ----------
  function reportMd() {
    const S = TR.S(), stages = TR.stages();
    const L = [];
    L.push(`# Отчёт по тренажёру «Пульс»`, '');
    L.push(`- Студент: ${S.name || '—'}${S.group ? ' · ' + S.group : ''}`);
    L.push(`- Дата: ${new Date().toLocaleString('ru-RU')}`);
    L.push(`- Доверие команды: ${S.trust} из 100 · опыт: ${S.xp}`);
    L.push(`- Фактов в блокноте: ${TR.facts.count()} из ${TR.facts.all().length} (критичных: ${TR.facts.all().filter(f => f.flag && TR.facts.has(f.id)).length} из ${TR.facts.all().filter(f => f.flag).length})`, '');
    L.push(`## Тренировки`, '', '| Тренировка | Подходы | Точность | С эталоном |', '|---|---|---|---|');
    stages.forEach(s => {
      const p = TR.stageProgress(s.id), st = TR.stageState(s.id);
      const rev = s.tasks.filter(t => (st.tasks[t.id] || {}).revealed).length;
      L.push(`| ${s.title} | ${p.done}/${p.total} | ${Math.round(p.score * 100)}% | ${rev} |`);
    });
    const miss = TR.facts.all().filter(f => f.flag && !TR.facts.has(f.id));
    if (miss.length) { L.push('', '## Не выяснены критичные факты', ''); miss.forEach(f => L.push(`- ${f.topic}: ${f.text}`)); }
    if (S.decisions.length) {
      L.push('', '## Решения и обоснования', '');
      stages.forEach(s => {
        const ds = S.decisions.filter(d => d.stage === s.id); if (!ds.length) return;
        L.push(`### ${s.title}`, ''); ds.forEach(d => L.push(`- **${d.label}:** ${d.value.replace(/\n+/g, ' ')}`)); L.push('');
      });
    }
    stages.forEach(s => {
      const st = TR.stageState(s.id), lines = [];
      s.tasks.forEach(t => { const ts = st.tasks[t.id]; if (ts && ts.ans && t.report) { try { const r = t.report(ts.ans); if (r) lines.push(`**${t.title}**`, '', r, ''); } catch (e) { } } });
      if (lines.length) L.push(`## ${s.title} — ответы`, '', ...lines);
    });
    if (S.notes) L.push('## Заметки студента', '', S.notes, '');
    return L.join('\n');
  }
  TR.reportMd = reportMd;
  $('#repBtn').addEventListener('click', () => {
    const md = reportMd();
    ui.modal({
      title: 'Отчёт для преподавателя',
      html: `<p class="muted">Отчёт собирается из ваших ответов и обоснований. Отправьте его преподавателю — скопируйте или скачайте.</p>
        <div class="row"><button type="button" class="btn primary" data-r="copy">Скопировать</button><button type="button" class="btn" data-r="dl" hidden>Скачать .md</button></div>
        <pre class="code" style="max-height:340px">${esc(md)}</pre>
        <details class="more"><summary>Для преподавателя и сброс прогресса</summary><div>
          <div class="row"><input type="text" id="tCode" placeholder="Кодовое слово преподавателя" style="max-width:260px" aria-label="Кодовое слово"><button type="button" class="btn sm" data-r="teacher">${TR.teacher() ? 'Выключить режим преподавателя' : 'Включить режим преподавателя'}</button></div>
          <p class="small dim">В режиме преподавателя все подходы открыты, эталоны без штрафа, в блокноте можно отмечать факты, выясненные на живой встрече.</p>
          <div class="row"><button type="button" class="btn danger sm" data-r="reset">Начать заново (сотрёт прогресс)</button></div>
        </div></details>`,
      onMount(body, close) {
        TR.downloads().then(d => { if (d) { const b = $('[data-r="dl"]', body); if (b) b.hidden = false; } });
        let armed = false;
        TR.on(body, 'click', '[data-r]', async (e, b) => {
          const a = b.dataset.r;
          if (a === 'copy') ui.copy(md);
          if (a === 'dl') {
            const d = await TR.downloads(); if (!d) return;
            try { await d.save({ filename: `puls-otchet-${(TR.S().name || 'student').replace(/\s+/g, '-')}.md`, data: md }); ui.toast('Файл сохранён', 'ok'); }
            catch (err) { if (err && err.code !== 'declined') ui.toast('Скачать не получилось — скопируйте текст', 'warn'); }
          }
          if (a === 'teacher') {
            if (TR.teacher()) { TR.setTeacher(false); close(); ui.toast('Режим преподавателя выключен'); return; }
            const v = TR.norm($('#tCode', body).value).replace(/\s/g, '');
            if (v === 'пульс2026' || v === 'puls2026') { TR.setTeacher(true); close(); ui.toast('Режим преподавателя включён', 'ok'); }
            else ui.toast('Кодовое слово не подошло', 'bad');
          }
          if (a === 'reset') {
            if (!armed) { armed = true; b.textContent = 'Точно? Нажмите ещё раз'; return; }
            TR.reset(); close(); ui.toast('Прогресс сброшен');
          }
        });
      }
    });
  });

  // ---------- старт ----------
  let booted = false;
  function boot() {
    booted = true;
    hud();
    const h = (location.hash || '').replace(/^#/, '');
    const id = h.startsWith('s-') ? h.slice(2) : '';
    go(TR.stageById(id) ? id : '');
  }
  const start = () => boot();
  if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(start); else start();
})();
