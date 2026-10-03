/* Ядро тренажёра «AMP Пульс»: состояние, факты блокнота, регистрация этапов, очки, словарь, доступ к Claude.
   Контракт для модулей этапов — _dev/CONTRACT.md. */
'use strict';
(function () {
  const TR = window.TR = window.TR || {};

  // ---------- утилиты ----------
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  TR.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC[c]);
  TR.$ = (sel, root) => (root || document).querySelector(sel);
  TR.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  TR.el = html => { const t = document.createElement('template'); t.innerHTML = String(html).trim(); return t.content.firstElementChild; };
  TR.on = (root, type, sel, fn) => root.addEventListener(type, e => { const t = e.target.closest(sel); if (t && root.contains(t)) fn(e, t); });
  TR.clone = o => o == null ? o : JSON.parse(JSON.stringify(o));
  TR.norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9{}/\-_.:+ ]+/g, ' ').replace(/\s+/g, ' ').trim();
  TR.hash = s => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  TR.rand = seed => { let a = TR.hash(seed) || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  TR.shuffle = (arr, seed) => { const r = TR.rand(seed || 'puls'), a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  TR.plural = (n, one, few, many) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? one : (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many); };
  TR.fmtRub = kop => (kop / 100).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' ₽';
  TR.sleep = ms => new Promise(r => setTimeout(r, ms));

  // ---------- события ----------
  const subs = {};
  TR.sub = (ev, fn) => { (subs[ev] = subs[ev] || []).push(fn); return () => { subs[ev] = subs[ev].filter(f => f !== fn); }; };
  TR.emit = (ev, data) => (subs[ev] || []).slice().forEach(fn => { try { fn(data); } catch (e) { console.error(e); } });

  // ---------- состояние ----------
  const KEY = 'amp-puls-trainer-v1';
  const fresh = () => ({ v: 1, name: '', group: '', trust: 50, xp: 0, facts: {}, notes: '', stages: {}, decisions: [], log: [], teacher: false, started: null });
  let S = fresh();
  try {
    const hot = window.claude && window.claude.hot && window.claude.hot.data;
    const raw = hot && hot.state ? hot.state : JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && raw.v === 1) S = Object.assign(fresh(), raw);
  } catch (e) { /* хранилище недоступно — работаем в памяти */ }
  TR.S = () => S;
  let saveT = 0;
  TR.save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }, 250); };
  TR.reset = () => { S = fresh(); try { localStorage.removeItem(KEY); } catch (e) { } TR.emit('reset'); TR.emit('hud'); };
  try { window.claude && window.claude.hot && window.claude.hot.snapshot && window.claude.hot.snapshot(() => ({ state: S })); } catch (e) { }

  TR.stageState = id => (S.stages[id] = S.stages[id] || { tasks: {}, visited: null, done: null });
  TR.taskState = (sid, tid) => { const st = TR.stageState(sid); return (st.tasks[tid] = st.tasks[tid] || { ans: null, attempts: 0, ok: false, best: 0, revealed: false, done: false }); };
  TR.teacher = () => !!S.teacher;
  TR.setTeacher = on => { S.teacher = !!on; TR.save(); TR.emit('teacher', S.teacher); };

  // ---------- персонажи ----------
  TR.PEOPLE = {
    olga: { name: 'Ольга Викторовна', role: 'директор по развитию «Пульса»', ini: 'ОВ' },
    timur: { name: 'Тимур', role: 'руководитель ИТ «Пульса»', ini: 'Т' },
    denis: { name: 'Денис', role: 'лид мобильной студии', ini: 'Д' },
    kirill: { name: 'Кирилл', role: 'интеграции агрегатора ФитПасс', ini: 'К' },
    ira: { name: 'Ирина', role: 'главный бухгалтер (аутсорс)', ini: 'И' },
    vera: { name: 'Вера', role: 'ведущий аналитик, ваш наставник', ini: 'В' },
    me: { name: 'Вы', role: 'системный аналитик', ini: 'Я' }
  };

  // ---------- факты блокнота ----------
  TR.FACTS = {};
  TR.TOPICS = [];
  TR.fact = (id, def) => { TR.FACTS[id] = Object.assign({ id }, def); if (def.topic && !TR.TOPICS.includes(def.topic)) TR.TOPICS.push(def.topic); return TR.FACTS[id]; };
  TR.facts = {
    get: id => TR.FACTS[id],
    has: id => !!S.facts[id],
    unlock(id, how) {
      if (!TR.FACTS[id] || S.facts[id]) return false;
      S.facts[id] = { at: Date.now(), how: how || 'ask' };
      TR.save(); TR.emit('fact', id); TR.emit('hud');
      return true;
    },
    lock(id) { delete S.facts[id]; TR.save(); TR.emit('fact', id); TR.emit('hud'); },
    count: () => Object.keys(S.facts).filter(id => TR.FACTS[id]).length,
    all: () => Object.values(TR.FACTS)
  };

  // ---------- этапы ----------
  TR.ACTS = [
    { n: 1, title: 'Неделя 1 · Разминка', sub: 'Понять задачу: вопросы бизнесу и ИТ' },
    { n: 2, title: 'Неделя 2 · Силовая', sub: 'Данные: три модели, нормализация, ограничения, репликация' },
    { n: 3, title: 'Неделя 3 · Выносливость', sub: 'Интеграции: REST, узкие места, безопасность, GraphQL, gRPC' },
    { n: 4, title: 'Неделя 4 · Старты', sub: 'Сквозные сценарии, инциденты, защита решения' }
  ];
  const STAGES = [];
  TR.stage = def => {
    if (!def || !def.id) throw new Error('TR.stage: нужен id');
    if (STAGES.some(s => s.id === def.id)) throw new Error('TR.stage: повтор id ' + def.id);
    def.tasks = def.tasks || [];
    def.tasks.forEach((t, i) => { if (!t.id) t.id = 't' + (i + 1); });
    STAGES.push(def);
    STAGES.sort((a, b) => (a.order || 0) - (b.order || 0));
    if (def.glossary) TR.glossary(def.glossary, def.id);
    TR.emit('stages');
    return def;
  };
  TR.stages = () => STAGES.slice();
  TR.stageById = id => STAGES.find(s => s.id === id) || null;
  // теория — вводные разделы «Как это работает» (id how-*) или подходы с theory: true; в прогресс и зачёт не входят
  TR.isTheory = t => !!(t && (t.theory || /^how-/.test(t.id)));
  TR.practiceTasks = def => def.tasks.filter(t => !TR.isTheory(t));
  TR.stageProgress = id => {
    const def = TR.stageById(id); if (!def) return { done: 0, total: 0, ratio: 0 };
    const st = TR.stageState(id), list = TR.practiceTasks(def);
    const total = list.length, done = list.filter(t => (st.tasks[t.id] || {}).done).length;
    return { done, total, ratio: total ? done / total : 0, score: total ? list.reduce((s, t) => s + ((st.tasks[t.id] || {}).best || 0), 0) / total : 0 };
  };

  // ---------- очки ----------
  TR.score = (dTrust, dXp, reason) => {
    S.trust = Math.max(0, Math.min(100, S.trust + (dTrust || 0)));
    S.xp = Math.max(0, S.xp + (dXp || 0));
    if (reason) S.log.push({ at: Date.now(), t: reason, d: dTrust || 0, x: dXp || 0 });
    if (S.log.length > 400) S.log = S.log.slice(-400);
    TR.save(); TR.emit('hud', { dTrust, dXp, reason });
  };
  TR.decide = (stageId, label, value) => {
    S.decisions = S.decisions.filter(d => !(d.stage === stageId && d.label === label));
    S.decisions.push({ stage: stageId, label, value: String(value), at: Date.now() });
    TR.save();
  };

  // ---------- словарь ----------
  TR.GLOSSARY = [];
  TR.glossary = (list, stageId) => (list || []).forEach(g => {
    if (!g || !g.term) return;
    const ex = TR.GLOSSARY.find(x => TR.norm(x.term) === TR.norm(g.term));
    if (ex) return;
    TR.GLOSSARY.push(Object.assign({ stage: stageId || null }, g));
  });

  // ---------- Claude (возможность sample) ----------
  let sampleP = null;
  TR.sample = () => {
    if (!sampleP) sampleP = (async () => {
      try { return window.claude && window.claude.use ? (await window.claude.use('sample')) || null : null; } catch (e) { return null; }
    })();
    return sampleP;
  };
  TR.sampleDead = false;
  TR.sampleErr = e => {
    const c = e && e.code;
    if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(c)) { TR.sampleDead = true; return 'Claude недоступен в этом окне — работаем без него.'; }
    if (c === 'rate_limited') return 'Слишком много вопросов подряд. Подождите минуту.';
    if (c === 'cancelled') return '';
    if (c === 'session_expired') return 'Сессия истекла — войдите в claude.ai заново.';
    return 'Не получилось получить ответ. Попробуйте ещё раз.';
  };
  let dlP = null;
  TR.downloads = () => {
    if (!dlP) dlP = (async () => { try { return window.claude && window.claude.use ? (await window.claude.use('downloads')) || null : null; } catch (e) { return null; } })();
    return dlP;
  };

  TR.go = id => TR.emit('go', id);
})();
