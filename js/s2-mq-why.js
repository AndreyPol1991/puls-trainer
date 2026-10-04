/* Неделя 5, понедельник 10:00: зачем брокер сообщений.
   Теория: «звезда» синхронных вызовов против публикации события (живая шкала времени с ползунком задержки
   и падением потребителя), модель «издатель → брокер → подписчики», очередь задач против журнала,
   когда брокер не нужен. Практика: лаборатория «воскресенье 20:00 и шесть потребителей», раскладка
   взаимодействий «Пульса» по способам, что писать аналитику, объяснение Ольге. */
'use strict';
(function () {
  const TR = window.TR, ui = TR.ui, esc = TR.esc;
  const ID = 'mq-why';

  if (!document.getElementById('mqw-css')) document.head.insertAdjacentHTML('beforeend', `<style id="mqw-css">
    .mqw-root, .mqw-root .stack { min-width: 0; }
    .mqw-root .stack > * { min-width: 0; }
    .mqw-root :not(pre) > code { white-space: normal; overflow-wrap: anywhere; }
    .mqw-root .seg button { white-space: normal; text-align: left; }
    .mqw-box { display: grid; gap: 12px; padding: 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); min-width: 0; }
    .mqw-box > * { min-width: 0; }
    .mqw-set { display: grid; grid-template-columns: minmax(0, 220px) minmax(0, 1fr); gap: 8px 14px; align-items: center; }
    .mqw-set > .lbl { font-size: 13.5px; color: var(--text-2); min-width: 0; }
    .mqw-set > .seg { justify-self: start; max-width: 100%; }
    .mqw-set .seg button:disabled { opacity: .45; cursor: not-allowed; }
    .mqw-gantt { display: grid; gap: 5px; }
    .mqw-row { display: grid; grid-template-columns: 158px minmax(0, 1fr) 92px; gap: 8px; align-items: center; font-size: 13px; }
    .mqw-row > * { min-width: 0; }
    .mqw-row .nm { overflow-wrap: anywhere; }
    .mqw-row .ms { font: 12px/1.25 var(--f-mono); text-align: right; color: var(--text-2); overflow-wrap: anywhere; }
    .mqw-row .ms.bad { color: var(--bad); } .mqw-row .ms.ok { color: var(--ok); } .mqw-row .ms.warn { color: var(--warn); }
    .mqw-track { position: relative; height: 20px; background: var(--surface-2); border-radius: 6px; overflow: hidden; }
    .mqw-bar { position: absolute; top: 4px; height: 12px; border-radius: 4px; background: var(--info); min-width: 3px; }
    .mqw-bar.own { background: var(--accent); }
    .mqw-bar.bad { background: var(--bad); }
    .mqw-bar.warn { background: var(--warn); }
    .mqw-bar.async { background: color-mix(in srgb, var(--ok) 22%, transparent); border: 1.5px dashed var(--ok); top: 3px; height: 14px; }
    .mqw-bar.async.bad { background: color-mix(in srgb, var(--bad) 18%, transparent); border-color: var(--bad); }
    .mqw-bar.skip { background: transparent; border: 1.5px dashed var(--border-strong); }
    .mqw-resp { position: absolute; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: var(--text); }
    .mqw-axis { display: flex; justify-content: space-between; font: 11px/1.2 var(--f-mono); color: var(--text-muted); }
    .mqw-legend { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 12px; color: var(--text-2); }
    .mqw-legend i { display: inline-block; width: 18px; height: 10px; border-radius: 3px; margin-right: 5px; vertical-align: -1px; }
    .mqw-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .mqw-stats .v { font-size: 17px; overflow-wrap: anywhere; }
    .mqw-sc { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .mqw-sc .stat.cur { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
    .mqw-sc .v { font-size: 16px; }
    .mqw-range { width: 100%; margin: 4px 0; accent-color: var(--accent); }
    .mqw-log { display: flex; flex-wrap: wrap; gap: 4px; }
    .mqw-log .c { min-width: 34px; padding: 3px 6px; border-radius: 6px; text-align: center; font: 12px/1.3 var(--f-mono); background: var(--surface-3); color: var(--text-2); }
    .mqw-log .c.new { background: color-mix(in srgb, var(--accent) 22%, var(--surface)); color: var(--text); }
    .mqw-sub { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 10px; align-items: center; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); }
    .mqw-sub .pos { font: 12px/1.3 var(--f-mono); color: var(--text-2); }
    .mqw-case { display: grid; gap: 8px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); }
    .mqw-case .row { flex-wrap: wrap; }
    @media (max-width: 640px) {
      .mqw-set { grid-template-columns: minmax(0, 1fr); gap: 4px; }
      .mqw-set > .lbl { margin-top: 8px; }
      .mqw-row { grid-template-columns: 92px minmax(0, 1fr) 62px; gap: 6px; font-size: 12px; }
      .mqw-row .ms { font-size: 11px; }
      .mqw-stats, .mqw-sc { grid-template-columns: minmax(0, 1fr); }
    }
  </style>`);

  // ---------- общие помощники ----------
  const L = (id, t, sub) => ({ id, t, sub });
  const lock = (el, ro) => { if (ro) TR.$$('[data-seg] button', el).forEach(b => { b.disabled = true; }); };
  const fmtMs = ms => ms === Infinity ? '∞' : ms >= 1000 ? (ms / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' с' : Math.round(ms) + ' мс';
  const quizRef = QS => QS.map(cfg => cfg.options.map((o, i) => o.ok ? i : -1).filter(i => i >= 0));
  const fresh = pane => { const d = document.createElement('div'); pane.appendChild(d); return d; };
  const plainT = s => String(s || '').replace(/<[^>]+>/g, '');

  // пошаговые сценарии на ui.seq с переключателем вариантов
  function walk(el, cfg) {
    let cur = cfg.scenarios[0].id;
    el.innerHTML = `<div class="stack">${cfg.scenarios.length > 1 ? `<div class="row"><span class="small dim">Вариант:</span>${ui.seg('wk', cfg.scenarios.map(s => ({ v: s.id, t: s.t })), cur, 'accent')}</div>` : ''}<div data-w></div><div data-sum></div></div>`;
    const box = TR.$('[data-w]', el), sum = TR.$('[data-sum]', el);
    function show(id) {
      cur = id; const sc = cfg.scenarios.find(s => s.id === id);
      box.innerHTML = ''; sum.innerHTML = '';
      const d = document.createElement('div'); box.appendChild(d);
      ui.seq(d, { lanes: sc.lanes, steps: sc.steps, title: sc.t, laneW: cfg.laneW || 170, hint: 'Нажимайте «Шаг →» и читайте пояснение под схемой.', onEnd() { sum.innerHTML = sc.sum ? ui.note(sc.sumKind || '', 'Итог', sc.sum) : ''; } });
    }
    ui.onSeg(el, (n, v) => { if (n === 'wk') show(v); });
    show(cur);
  }

  // Шкала времени одной операции: rows [{t, s, e, kind, ms, msKind}], resp — момент ответа клиенту
  function gantt(rows, resp, domainHint) {
    const fin = rows.map(r => r.e).filter(x => isFinite(x));
    const dom = Math.max(domainHint || 0, resp, ...fin, 100) * 1.06;
    const pct = t => (Math.min(t, dom) / dom * 100).toFixed(2) + '%';
    const w = (s, e) => ((Math.min(e, dom) - Math.min(s, dom)) / dom * 100).toFixed(2) + '%';
    return `<div class="mqw-gantt">
      ${rows.map(r => `<div class="mqw-row"><span class="nm">${r.t}</span><div class="mqw-track">${r.s != null ? `<span class="mqw-bar ${r.kind || ''}" style="left:${pct(r.s)};width:${w(r.s, r.e === Infinity ? dom : r.e)}"></span>` : ''}<span class="mqw-resp" style="left:${pct(resp)}"></span></div><span class="ms ${r.msKind || ''}">${r.ms}</span></div>`).join('')}
      <div class="mqw-row"><span></span><div class="mqw-axis"><span>0</span><span>${fmtMs(dom / 2)}</span><span>${fmtMs(dom)}</span></div><span></span></div>
      <div class="mqw-legend"><span><i style="background:var(--accent)"></i>работа самой операции</span><span><i style="background:var(--info)"></i>вызов, клиент ждёт</span><span><i style="border:1.5px dashed var(--ok)"></i>после ответа клиенту, в фоне</span><span><i style="background:var(--bad)"></i>ошибка или зависание</span><span><i style="background:var(--text);width:3px"></i>клиент получил ответ</span></div>
    </div>`;
  }

  // =====================================================================
  // Теория 1. Звезда вызовов против события (соседний пример: покупка абонемента)
  // =====================================================================
  const T_OWN = 50;
  const T_CONS = [
    { id: 'notif', t: 'Уведомления', ms: 120 },
    { id: 'allow', t: 'Список пропусков', ms: 60 },
    { id: 'analytics', t: 'Аналитика', ms: 80 },
    { id: 'onec', t: 'Выгрузка в 1С', ms: 200 }
  ];
  const ONEC_STEPS = [200, 1000, 5000, 30000];
  const T_RATE = 20, T_POOL = 300;
  function theorySim(mode, onecMs, down) {
    const rows = [{ t: 'Абонементы: сохранить', s: 0, e: T_OWN, kind: 'own', ms: fmtMs(T_OWN) }];
    let t = T_OWN, failed = null; const missed = [];
    if (mode === 'star') {
      for (const c of T_CONS) {
        if (failed) { rows.push({ t: c.t, s: null, e: null, ms: 'не вызвали', msKind: 'bad' }); missed.push(c.t); continue; }
        if (down === c.id) { rows.push({ t: c.t, s: t, e: t + 30, kind: 'bad', ms: 'ошибка 503', msKind: 'bad' }); t += 30; failed = c; missed.push(c.t); continue; }
        const ms = c.id === 'onec' ? onecMs : c.ms;
        rows.push({ t: c.t, s: t, e: t + ms, kind: ms >= 1000 ? 'warn' : '', ms: fmtMs(ms), msKind: ms >= 5000 ? 'bad' : ms >= 1000 ? 'warn' : '' });
        t += ms;
      }
      const resp = t, threads = Math.round(T_RATE * resp / 1000);
      return { rows, resp, threads, failed, missed, client: failed ? 'bad' : 'ok' };
    }
    rows.push({ t: 'Брокер: принять событие', s: t, e: t + 5, kind: 'own', ms: '5 мс' });
    const resp = t + 5;
    T_CONS.forEach((c, i) => {
      const s = resp + 15 + i * 10;
      if (down === c.id) { rows.push({ t: c.t, s, e: Infinity, kind: 'async bad', ms: 'лежит, догонит', msKind: 'warn' }); return; }
      const ms = c.id === 'onec' ? onecMs : c.ms;
      rows.push({ t: c.t, s, e: s + ms, kind: 'async', ms: fmtMs(ms), msKind: 'ok' });
    });
    return { rows, resp, threads: Math.max(1, Math.round(T_RATE * resp / 1000)), failed: null, missed: [], client: 'ok' };
  }

  const howStar = {
    id: 'how-star', covers: ['sunday-lab', 'why-olga'], title: 'Как это работает: звезда вызовов и событие', free: true, noReset: true,
    simple: {
      icon: '📣',
      plain: 'Можно самому сообщить новость каждому, кому она нужна, и ждать, пока все дослушают. А можно один раз повесить объявление — и пусть каждый прочитает, когда сможет.',
      analogy: 'Администратор продал абонемент и сам обзванивает четверых: бухгалтерию, охрану, маркетолога, тренера. Клиент стоит у стойки, пока не ответит последний. Бухгалтерия не берёт трубку — клиент ждёт, очередь за ним растёт. Вместо этого можно записать новость в журнал смены — каждый прочтёт сам, а клиент уходит сразу.',
      tech: '<b>Синхронный вызов</b> — вызывающий ждёт ответа. «Звезда» — модуль после своей операции синхронно зовёт всех заинтересованных: время ответа = сумма задержек, а ломается всё от отказа любого. <b>Событие</b> — сообщение «это случилось» (<code>MembershipActivated</code>), которое издатель кладёт в <b>брокер</b> и сразу отвечает клиенту; подписчики читают его независимо.'
    },
    lead: ui.brief({
      situation: 'Соседний пример — покупка абонемента. После оплаты модуль «Абонементы» сохраняет абонемент и должен сообщить четырём системам: уведомлениям (пуш «абонемент активирован»), списку пропусков турникетов, аналитике и выгрузке в 1С. В пятницу вечером 1С, бывает, отвечает по 5–30 секунд.',
      todo: [
        'Режим «Вызываем всех по очереди»: двигайте ползунок «1С отвечает за» от 0,2 до 30 секунд. Смотрите на чёрную черту — когда Анна получила ответ.',
        'Выберите «Упал потребитель: Уведомления». Что увидела Анна — и что стало с остальными тремя?',
        'Переключитесь на «Публикуем событие» и повторите то же самое. Сравните четыре счётчика.'
      ],
      look: 'Каждая строка — участник. Полоска — сколько он работал. Синяя — Анна ждёт этот вызов. Пунктирная зелёная — работа в фоне, уже после ответа Анне. Чёрная вертикальная черта — момент, когда Анна получила ответ. «Потоки» — сколько рабочих потоков сервера занято, если таких покупок 20 в секунду: поток держится всё время, пока операция не ответила.'
    }),
    render(el) {
      el.classList.add('mqw-root');
      const st = { mode: 'star', k: 0, down: 'none' };
      el.innerHTML = `<div class="stack">
        <div class="mqw-box">
          <div class="mqw-set">
            <div class="lbl">Как сообщаем четырём</div>${ui.seg('mode', [{ v: 'star', t: 'Вызываем всех по очереди' }, { v: 'event', t: 'Публикуем событие' }], st.mode, 'accent')}
            <div class="lbl">Упал потребитель</div>${ui.seg('down', [{ v: 'none', t: 'никто' }, { v: 'notif', t: 'Уведомления' }, { v: 'allow', t: 'Список пропусков' }], st.down)}
          </div>
          <label class="field"><span>1С отвечает за: <b data-k></b></span><input type="range" class="mqw-range" min="0" max="${ONEC_STEPS.length - 1}" step="1" value="0" data-r aria-label="Сколько отвечает 1С"></label>
        </div>
        <div data-g></div>
        <div class="mqw-stats" data-st></div>
        <div data-n></div>
      </div>`;
      function draw() {
        const onec = ONEC_STEPS[st.k], r = theorySim(st.mode, onec, st.down);
        TR.$('[data-k]', el).textContent = fmtMs(onec) + (onec >= 30000 ? ' — по сути зависла' : '');
        TR.$('[data-g]', el).innerHTML = gantt(r.rows, r.resp, st.mode === 'event' ? 0 : 0);
        const thrKind = r.threads > T_POOL ? 'bad' : r.threads > T_POOL / 2 ? 'warn' : 'ok';
        TR.$('[data-st]', el).innerHTML = `
          <div class="stat"><span class="k">Анна ждёт ответа</span><span class="v ${r.resp > 1000 ? 'bad' : r.resp > 300 ? 'warn' : 'ok'}">${fmtMs(r.resp)}</span><span class="s">с момента «Оплатить»</span></div>
          <div class="stat"><span class="k">Анна видит</span><span class="v ${r.client === 'ok' ? 'ok' : 'bad'}">${r.client === 'ok' ? 'Абонемент активен' : 'Ошибка 500'}</span><span class="s">${r.client === 'ok' ? 'всё честно' : 'а деньги списаны и абонемент сохранён'}</span></div>
          <div class="stat"><span class="k">Не узнали о покупке</span><span class="v ${r.missed.length ? 'bad' : 'ok'}">${r.missed.length ? r.missed.length + ' из 4' : '0'}</span><span class="s">${r.missed.length ? esc(r.missed.join(', ')) : st.mode === 'event' && st.down !== 'none' ? 'упавший дочитает позже' : 'все получили'}</span></div>
          <div class="stat"><span class="k">Потоков сервера занято</span><span class="v ${thrKind}">${r.threads} из ${T_POOL}</span><span class="s">${r.threads > T_POOL ? 'потоки кончились — встали все запросы' : 'при 20 покупках в секунду'}</span></div>`;
        let n;
        if (st.mode === 'star') {
          if (st.down !== 'none') {
            const dn = T_CONS.find(c => c.id === st.down).t, rest = r.missed.filter(x => x !== dn);
            n = ui.note('bad', 'Упал один — пострадали все', `«${esc(dn)}» ответили ошибкой — код «Абонементов» не знает, что с ней делать, и отдаёт Анне 500. Хотя деньги списаны и абонемент сохранён. ${rest.length ? `Дальше по списку (${esc(rest.join(', '))}) даже не вызвали: ${rest.includes('Список пропусков') ? 'турникет не пустит Анну, ' : ''}директор не увидит выручку.` : ''} Покупка зависит от <b>каждого</b> из четырёх.`);
          }
          else if (onec >= 5000) n = ui.note('bad', 'Медленный один — медленные все', `1С думает ${fmtMs(onec)} — и ровно столько ждёт Анна. Хуже другое: всё это время запрос держит поток сервера. При 20 покупках в секунду занято ${Math.round(T_RATE * (T_OWN + 260 + onec) / 1000)} потоков${T_RATE * (T_OWN + 260 + onec) / 1000 > T_POOL ? ' — больше, чем есть. Потоки общие, поэтому встают и запись, и расписание, и вход. Так «Пульс» и лёг в прошлое воскресенье на 40 минут' : ''}. Это называется <b>каскадный отказ</b>.`);
          else if (onec >= 1000) n = ui.note('warn', 'Время складывается', `Время ответа — сумма всех вызовов: ${T_OWN} + 120 + 60 + 80 + ${onec} = ${T_OWN + 260 + onec} мс. Анна ждёт аналитику и 1С, хотя ей от них ничего не нужно.`);
          else n = ui.note('', 'Пока все здоровы — работает', `${fmtMs(T_OWN + 460)} — терпимо. Но каждый новый потребитель (бонусы, партнёры, рекомендации) — это ещё один вызов в коде «Абонементов», ещё задержка и ещё одна причина упасть. Подвигайте ползунок.`);
        } else {
          n = ui.note('ok', 'Сообщили один раз — и свободны', `«Абонементы» сохранили абонемент, отдали событие <code>MembershipActivated</code> брокеру (5 мс, брокер ответил «принял и сохранил») и сразу ответили Анне — ${fmtMs(T_OWN + 5)}. Подписчики читают событие сами, в фоне. ${st.down !== 'none' ? 'Упавший подписчик ничего не сломал: событие ждёт его в брокере, поднимется — дочитает.' : ''} ${onec >= 5000 ? 'Медленная 1С тормозит только саму выгрузку, а не Анну и не другие запросы.' : ''} Цена: подписчики узнают о покупке не мгновенно, а через доли секунды или позже.`);
        }
        TR.$('[data-n]', el).innerHTML = n;
      }
      ui.onSeg(el, (n, v) => { st[n] = v; draw(); });
      TR.$('[data-r]', el).addEventListener('input', e => { st.k = +e.target.value; draw(); });
      draw();
    }
  };

  // =====================================================================
  // Теория 2. Брокер, очередь и журнал, когда брокер не нужен
  // =====================================================================
  const BR_LANES = [L('pub', 'Абонементы', 'издатель'), L('br', 'Брокер', 'хранит сообщения'), L('s1', 'Уведомления', 'подписчик'), L('s2', 'Аналитика', 'подписчик')];
  const Q_LANES = [L('pub', 'Уведомления', 'кладут задачи'), L('br', 'Брокер', 'очередь «push»'), L('w1', 'Отправщик 1', 'рабочий'), L('w2', 'Отправщик 2', 'рабочий')];
  const LOG_LANES = [L('pub', 'Абонементы', 'издатель'), L('br', 'Брокер', 'журнал, 7 дней'), L('g1', 'Группа «бонусы»', 'читатель'), L('g2', 'Группа «аналитика»', 'читатель')];
  const CASES = [
    { id: 'c1', t: 'ПэйПоинт сообщает «Пульсу», что оплата прошла', need: false, use: 'Входящий вебхук', why: 'Это чужая система: к нашему брокеру её не подключишь. ПэйПоинт сам вызывает наш адрес <code>/webhooks/paypoint</code>, мы быстро отвечаем 200 и обрабатываем дальше. Внутри «Пульса» после этого уже можно опубликовать событие <code>PaymentSucceeded</code>.' },
    { id: 'c2', t: 'Год назад: 12 клубов, 4 разработчика, SMS отправляет один фоновый процесс с лимитом 30 в секунду', need: false, use: 'Таблица-очередь в PostgreSQL', why: 'Один отправитель, один исполнитель, небольшой поток. Строка в таблице со статусом и временем следующей попытки — и фоновая задача, которая их разбирает. Брокер здесь — ещё одна система, которую надо держать и мониторить, а выигрыша нет. Так и сделали в сезоне 1.' },
    { id: 'c3', t: 'Зритель нажал «Смотреть эфир» и ждёт, пустят ли его на онлайн-тренировку', need: false, use: 'Синхронный запрос', why: 'Человеку нужен ответ сейчас: «вы в эфире» или «мест нет». Ответ, который придёт «когда-нибудь», ему бесполезен. Синхронный запрос — правильный выбор.' },
    { id: 'c4', t: 'Раз в месяц сверить визиты клиентов ФитПасса', need: false, use: 'Пакетная выгрузка', why: 'Раз в месяц, большой объём, никто не ждёт ответа в ту же секунду. Выгрузка страницами по курсору (<code>GET /partner/v1/visits?month=…</code>) проще и честнее брокера.' },
    { id: 'c5', t: 'Абонемент активирован — это должны узнать уведомления, список пропусков, аналитика, выгрузка в 1С, а скоро ещё бонусы', need: true, use: 'Событие в брокер', why: 'Один факт — много независимых получателей, и их число растёт. Издатель не должен знать о каждом и ждать каждого. Это ровно та задача, ради которой брокер существует.' }
  ];
  const howBroker = {
    id: 'how-broker', covers: ['ways', 'analyst'], title: 'Как это работает: брокер, очередь и журнал', free: true, noReset: true,
    simple: {
      icon: '📮',
      plain: 'Брокер — посредник между системами. Отправитель отдаёт ему сообщение и уходит заниматься своим. Получатели забирают сообщения сами, когда готовы. Если получатель лежит — сообщение его дождётся.',
      analogy: 'Почтовое отделение с абонентскими ящиками. Отправитель не стоит у двери адресата — он сдал письмо и свободен. Адресат в отпуске — письма копятся в ящике и ждут. Бывает два вида почты: <b>заказ на кухню</b> (каждый заказ готовит один повар, готовый убирают) и <b>журнал смены</b> (записи не вычёркивают, каждый читает со своей закладки).',
      tech: '<b>Издатель</b> (producer) пишет в брокер, <b>подписчики</b> (consumers) читают. <b>Очередь задач</b> — сообщение получает один исполнитель, после подтверждения (ack) оно удаляется (у «Пульса» — RabbitMQ). <b>Журнал событий</b> — сообщения хранятся срок (7 дней), каждая группа читателей помнит свою позицию (у «Пульса» — Kafka). Подробно — завтра.'
    },
    lead: ui.brief({
      situation: 'Три вкладки. Первая — как событие проходит через брокер и что бывает, когда подписчик лежит. Вторая — два вида брокеров: очередь задач и журнал событий. Третья — пять ситуаций из жизни «Пульса»: где брокер нужен, а где лишний.',
      todo: [
        'Вкладка «Издатель → брокер → подписчики»: пройдите схему по шагам. Потом в песочнице «положите» Аналитику, опубликуйте 3 события и поднимите её обратно.',
        'Вкладка «Очередь или журнал»: пройдите оба варианта и найдите главное отличие — сколько читателей получает одно сообщение.',
        'Вкладка «Когда брокер не нужен»: в каждой ситуации сначала решите сами, потом откройте ответ.'
      ],
      look: 'На схемах: колонки — участники, стрелка — сообщение, пунктир — ответ. В песочнице: клетки #1, #2… — сообщения, которые хранит брокер; «прочитано до» — закладка подписчика; «отстаёт» — сколько сообщений он ещё не прочёл.'
    }),
    render(el) {
      el.classList.add('mqw-root');
      const tabsEl = document.createElement('div'); el.appendChild(tabsEl);
      ui.tabs(tabsEl, [
        { id: 'pub', t: 'Издатель → брокер → подписчики', render: pane => drawPub(fresh(pane)) },
        { id: 'ql', t: 'Очередь или журнал', render: pane => drawQL(fresh(pane)) },
        { id: 'no', t: 'Когда брокер не нужен', render: pane => drawNo(fresh(pane)) }
      ], 'pub');
    }
  };
  function drawPub(pane) {
    pane.innerHTML = '<div class="stack"><div data-seq></div><div class="eyebrow">Песочница: подписчик лежит</div><div data-sand></div></div>';
    walk(TR.$('[data-seq]', pane), {
      laneW: 168,
      scenarios: [{
        id: 'flow', t: 'Как событие проходит через брокер', lanes: BR_LANES, sumKind: 'ok',
        sum: 'Издатель не знает, сколько у него подписчиков, и никого не ждёт. Новый подписчик (например, бонусы) подключается к брокеру — код «Абонементов» не меняется.',
        steps: [
          { from: 'pub', to: 'pub', t: 'сохранить абонемент', note: 'Модуль «Абонементы» сохраняет абонемент Анны в своей базе. Это его работа, её он делает сам.' },
          { from: 'pub', to: 'br', t: 'MembershipActivated', note: 'Издатель публикует <b>событие</b> — короткое сообщение «абонемент такой-то активирован». Имя в прошедшем времени: это факт, а не просьба. Кто его прочтёт, издатель не знает.' },
          { from: 'br', to: 'br', t: 'записать на диск', note: 'Брокер надёжно сохраняет сообщение (у «Пульса» — на нескольких серверах сразу), чтобы оно пережило перезапуск.' },
          { from: 'br', to: 'pub', t: 'принято', reply: true, kind: 'ok', note: 'Брокер подтверждает: «принял и сохранил». С этой секунды за доставку отвечает брокер, а не «Абонементы».' },
          { from: 'pub', to: 'pub', t: 'ответ Анне: 201', kind: 'ok', note: 'Анна получает ответ сразу — никто из подписчиков её не задерживает.' },
          { from: 's1', to: 'br', t: 'есть новое?', note: 'Подписчик «Уведомления» сам забирает новые сообщения, когда готов.' },
          { from: 'br', to: 's1', t: 'MembershipActivated', reply: true, kind: 'accent', note: 'Получил событие — отправит пуш «Абонемент активирован».' },
          { from: 's2', to: 's2', t: 'лежит (релиз)', kind: 'bad', note: 'Аналитика сейчас выкатывает новую версию и ничего не читает. Раньше это сломало бы покупку. Теперь — нет.' },
          { from: 's2', to: 'br', t: 'через 10 мин:\nчто я пропустила?', kind: 'warn', note: 'Аналитика поднялась и спрашивает всё, что накопилось с её закладки.' },
          { from: 'br', to: 's2', t: 'всё накопленное', reply: true, kind: 'ok', note: 'Брокер отдаёт всё, что Аналитика пропустила. Ничего не потеряно, просто позже. Это и есть <b>согласованность в конечном счёте</b>: какое-то время системы видят разное, потом догоняют.' }
        ]
      }]
    });
    const st = { n: 3, subs: [{ id: 'notif', t: 'Уведомления', up: true, pos: 3 }, { id: 'analytics', t: 'Аналитика', up: true, pos: 3 }, { id: 'allow', t: 'Список пропусков', up: true, pos: 3 }], msg: '' };
    const sand = TR.$('[data-sand]', pane);
    function draw() {
      const from = Math.max(1, st.n - 11);
      sand.innerHTML = `<div class="stack tight">
        <div class="row"><button type="button" class="btn sm primary" data-pb>Опубликовать «абонемент активирован»</button><span class="small dim">В брокере: ${st.n} ${TR.plural(st.n, 'сообщение', 'сообщения', 'сообщений')}</span></div>
        <div class="mqw-log">${Array.from({ length: st.n - from + 1 }, (_, i) => from + i).map(k => `<span class="c ${k > st.n - 1 ? 'new' : ''}">#${k}</span>`).join('')}</div>
        ${st.subs.map(s => `<div class="mqw-sub"><div><b>${esc(s.t)}</b> ${s.up ? ui.status('работает', 'ok') : ui.status('лежит', 'bad')}<div class="pos">прочитано до #${s.pos} · отстаёт на ${st.n - s.pos}</div></div><button type="button" class="btn xs ${s.up ? 'ghost' : ''}" data-tg="${s.id}">${s.up ? 'Уронить' : 'Поднять'}</button></div>`).join('')}
        ${st.msg ? ui.note(st.msg.k, '', st.msg.h) : ''}
      </div>`;
    }
    TR.on(sand, 'click', '[data-pb]', () => {
      st.n++; st.subs.forEach(s => { if (s.up) s.pos = st.n; });
      const lag = st.subs.filter(s => !s.up);
      st.msg = { k: lag.length ? 'warn' : 'ok', h: lag.length ? `Издатель ответил клиенту сразу. ${esc(lag.map(s => s.t).join(', '))} ничего не получили — но сообщение ждёт в брокере.` : 'Все работающие подписчики прочитали новое сообщение. Издатель ни одного из них не ждал.' };
      draw();
    });
    TR.on(sand, 'click', '[data-tg]', (e, b) => {
      const s = st.subs.find(x => x.id === b.dataset.tg);
      s.up = !s.up;
      if (s.up) { const caught = st.n - s.pos; s.pos = st.n; st.msg = { k: 'ok', h: caught ? `${esc(s.t)}: поднялись и дочитали ${caught} ${TR.plural(caught, 'пропущенное сообщение', 'пропущенных сообщения', 'пропущенных сообщений')} со своей закладки. Ничего не потеряно.` : `${esc(s.t)}: поднялись, пропущенного нет.` }; }
      else st.msg = { k: 'warn', h: `${esc(s.t)} лежат. Теперь опубликуйте пару событий — издатель этого даже не заметит.` };
      draw();
    });
    draw();
  }
  function drawQL(pane) {
    pane.innerHTML = '<div class="stack"><div data-w></div></div>';
    walk(TR.$('[data-w]', pane), {
      laneW: 168,
      scenarios: [
        {
          id: 'queue', t: 'Очередь задач', lanes: Q_LANES, sumKind: 'info',
          sum: 'Каждое сообщение — поручение, его выполняет <b>один</b> из исполнителей. Добавили отправщиков — работа делится между ними быстрее. После подтверждения сообщение исчезает: перечитать его нельзя. Так устроен RabbitMQ.',
          steps: [
            { from: 'pub', to: 'br', t: 'задача: пуш Анне', note: 'Сервис уведомлений кладёт в очередь поручение «отправь пуш Анне».' },
            { from: 'pub', to: 'br', t: 'задача: пуш Петру', note: 'И второе — «отправь пуш Петру».' },
            { from: 'br', to: 'w1', t: 'пуш Анне', kind: 'accent', note: 'Брокер отдаёт первую задачу Отправщику 1. Второму её не дадут — иначе Анна получит два пуша.' },
            { from: 'br', to: 'w2', t: 'пуш Петру', kind: 'accent', note: 'Вторую задачу — Отправщику 2. Работа делится: два отправщика — вдвое быстрее.' },
            { from: 'w1', to: 'br', t: 'готово (ack)', reply: true, kind: 'ok', note: 'Отправщик 1 отправил пуш и подтвердил: «готово». Подтверждение называют <b>ack</b>.' },
            { from: 'br', to: 'br', t: 'удалить задачу', note: 'Задача выполнена — брокер её удаляет. Перечитать её потом нельзя: её больше нет.' },
            { from: 'w2', to: 'w2', t: 'упал, не успел', kind: 'bad', note: 'Отправщик 2 упал, не отправив пуш и не прислав ack.' },
            { from: 'br', to: 'w1', t: 'пуш Петру (снова)', kind: 'warn', note: 'Подтверждения нет — брокер отдаёт задачу другому исполнителю. Задача не потерялась.' }
          ]
        },
        {
          id: 'log', t: 'Журнал событий', lanes: LOG_LANES, sumKind: 'info',
          sum: 'Каждое сообщение — факт, его читают <b>все</b> группы, каждая со своей закладкой. Прочитанное не удаляется: хранится срок (у «Пульса» 7 дней), и его можно перечитать. Новая группа может начать с начала журнала. Так устроена Kafka.',
          steps: [
            { from: 'pub', to: 'br', t: '#41 абонемент Анны', note: 'Издатель дописывает событие в конец журнала. У каждого сообщения номер — #41.' },
            { from: 'pub', to: 'br', t: '#42 абонемент Петра', note: 'Следующее — #42.' },
            { from: 'br', to: 'g1', t: '#41, #42', kind: 'accent', note: 'Группа «бонусы» читает оба события и сдвигает свою закладку на #42.' },
            { from: 'br', to: 'g2', t: '#41, #42', kind: 'accent', note: 'Группа «аналитика» читает <b>те же самые</b> события — независимо, со своей закладкой.' },
            { from: 'br', to: 'br', t: 'хранить 7 дней', note: 'Прочитанные события не удаляются. Их удалит только срок хранения.' },
            { from: 'g2', to: 'br', t: 'нашли ошибку:\nперечитать с #1', kind: 'warn', note: 'В аналитике нашли ошибку в подсчёте. Исправили — и перечитали журнал за неделю, передвинув закладку назад. С очередью задач так не выйдет.' },
            { from: 'br', to: 'g2', t: 'всё с #1', reply: true, kind: 'ok', note: 'Брокер отдаёт всё заново. Группа «бонусы» при этом ничего не заметила.' }
          ]
        }
      ]
    });
  }
  function drawNo(pane) {
    const open = {};
    function draw() {
      pane.innerHTML = `<div class="stack">
        <p class="small muted">Брокер — не «правильный способ интеграции», а инструмент для конкретной беды: <b>один факт — много независимых получателей</b> или <b>много поручений, которые надо надёжно разобрать</b>. Решите сами, потом откройте ответ.</p>
        ${CASES.map(c => {
          const g = open[c.id];
          return `<div class="mqw-case"><div><b>${c.t}</b></div>
            <div class="row"><span class="small dim">Брокер нужен?</span><button type="button" class="btn xs" data-cs="${c.id}|1" aria-pressed="${g === '1'}">Да</button><button type="button" class="btn xs" data-cs="${c.id}|0" aria-pressed="${g === '0'}">Нет</button></div>
            ${g ? ui.note((g === '1') === c.need ? 'ok' : 'warn', ((g === '1') === c.need ? 'Верно' : 'Не совсем') + ' · ' + c.use, c.why) : ''}</div>`;
        }).join('')}
        ${ui.note('info', 'Позиция аналитика', 'Решение «брокер или нет» принимают вместе с архитектором и записывают в ADR. От аналитика — факты для решения: сколько получателей у события и будут ли новые, кто ждёт ответа сразу, какой поток в пик, что будет, если получатель лежит час.')}
      </div>`;
    }
    TR.on(pane, 'click', '[data-cs]', (e, b) => { const [id, v] = b.dataset.cs.split('|'); open[id] = v; draw(); });
    draw();
  }

  // =====================================================================
  // Практика 1. Лаборатория «Воскресенье 20:00: запись и шесть потребителей»
  // =====================================================================
  const PEAK = 400, POOL = 300, SLO = 300, OWN = 40, PUB = 5;
  const CONS = [
    { id: 'notif', t: 'Уведомления', ms: 120 },
    { id: 'bonus', t: 'Бонусы', ms: 80 },
    { id: 'recs', t: 'Рекомендации', ms: 300 },
    { id: 'analytics', t: 'Аналитика', ms: 60 },
    { id: 'partner', t: 'Партнёрский шлюз', ms: 250 },
    { id: 'waitlist', t: 'Лист ожидания', ms: 50 }
  ];
  const HOW = [{ v: 'seq', t: 'вызываем по очереди' }, { v: 'par', t: 'вызываем одновременно, ждём всех' }, { v: 'event', t: 'публикуем событие в брокер' }];
  const TO = [{ v: '30', t: '30 с (по умолчанию)' }, { v: '1', t: '1 с' }];
  const ERR = [{ v: 'fail', t: 'отменить запись, клиенту ошибка' }, { v: 'skip', t: 'записать, потребителя пропустить' }];
  const SCN = [
    { v: 'calm', t: 'Все здоровы', k: 'обычный пик' },
    { v: 'slow', t: 'Рекомендации тормозят', k: 'отвечают 2 с' },
    { v: 'down', t: 'Бонусы зависли', k: '40 минут без ответа' }
  ];
  const tOf = (L, v) => (L.find(x => x.v === v) || { t: '?' }).t;
  const sigOf = a => a.how === 'event' ? 'event' : `${a.how}|${a.to}|${a.err}`;
  const lat = (sc, id, base) => (sc === 'slow' && id === 'recs') ? 2000 : (sc === 'down' && id === 'bonus') ? Infinity : base;

  function simLab(a, sc) {
    const rows = [{ t: 'Запись: сохранить', s: 0, e: OWN, kind: 'own', ms: fmtMs(OWN) }];
    if (a.how === 'event') {
      rows.push({ t: 'Брокер: принять', s: OWN, e: OWN + PUB, kind: 'own', ms: fmtMs(PUB) });
      const resp = OWN + PUB, late = [];
      CONS.forEach((c, i) => {
        const L0 = lat(sc, c.id, c.ms), s = resp + 12 + i * 8;
        if (L0 === Infinity) { late.push(c.t); rows.push({ t: c.t, s, e: Infinity, kind: 'async bad', ms: 'лежит, догонит', msKind: 'warn' }); }
        else { if (L0 >= 1000) late.push(c.t); rows.push({ t: c.t, s, e: s + L0, kind: 'async', ms: fmtMs(L0), msKind: L0 >= 1000 ? 'warn' : 'ok' }); }
      });
      const threads = Math.ceil(PEAK * resp / 1000);
      return { rows, resp, threads, over: false, booking: 'ok', lost: [], late, green: true };
    }
    const tmo = a.to === '1' ? 1000 : 30000, failed = [];
    let resp;
    if (a.how === 'seq') {
      let t = OWN, stop = false;
      CONS.forEach(c => {
        if (stop) { rows.push({ t: c.t, s: null, e: null, ms: 'не вызвали', msKind: 'bad' }); return; }
        const L0 = lat(sc, c.id, c.ms), e = Math.min(L0, tmo), f = L0 > tmo;
        rows.push({ t: c.t, s: t, e: t + e, kind: f ? 'bad' : (e >= 1000 ? 'warn' : ''), ms: f ? `таймаут ${fmtMs(tmo)}` : fmtMs(e), msKind: f ? 'bad' : e >= 1000 ? 'warn' : '' });
        t += e;
        if (f) { failed.push(c.t); if (a.err === 'fail') stop = true; }
      });
      resp = t;
    } else {
      let mx = 0;
      CONS.forEach(c => {
        const L0 = lat(sc, c.id, c.ms), e = Math.min(L0, tmo), f = L0 > tmo;
        rows.push({ t: c.t, s: OWN, e: OWN + e, kind: f ? 'bad' : (e >= 1000 ? 'warn' : ''), ms: f ? `таймаут ${fmtMs(tmo)}` : fmtMs(e), msKind: f ? 'bad' : e >= 1000 ? 'warn' : '' });
        mx = Math.max(mx, e); if (f) failed.push(c.t);
      });
      resp = OWN + mx;
    }
    const threads = Math.ceil(PEAK * resp / 1000), over = threads > POOL;
    let booking = failed.length && a.err === 'fail' ? 'error' : 'ok';
    if (over) booking = 'down';
    const lost = booking === 'ok' && a.err === 'skip' ? failed : [];
    const green = resp <= SLO && !over && booking === 'ok' && lost.length === 0;
    return { rows, resp, threads, over, booking, lost, late: [], green };
  }

  const LAB_Q = {
    q: 'В устойчивом варианте сервис бонусов завис на 40 минут. Что стало с бонусами за записи, сделанные за это время?', seed: 'mqw-lab-q',
    options: [
      { t: 'События ждут в брокере. Бонусы поднялись — дочитали со своей закладки и начислили с опозданием', ok: 1, why: 'Верно. Брокер хранит события (у «Пульса» 7 дней), а у подписчика своя закладка. Опоздание есть, потерь нет.' },
      { t: 'Потеряны: сервис бонусов их не получил, пока лежал', why: 'Так было бы при «записать, потребителя пропустить» в синхронной схеме. Брокер для того и нужен, чтобы сообщение дождалось получателя.' },
      { t: 'Запись ждала, пока бонусы поднимутся, поэтому ничего не потеряно', why: 'Тогда запись лежала бы 40 минут — это и есть прошлое воскресенье. Издатель никого не ждёт.' },
      { t: 'Брокер сам начисляет бонусы, пока сервис лежит', why: 'Брокер не знает бизнес-логики — он только хранит и доставляет сообщения.' }
    ]
  };
  function labStats(a, cur) {
    const sig = sigOf(a);
    return `<div class="mqw-sc">${SCN.map(s => {
      const seen = (a.seen || []).includes(sig + '|' + s.v), r = simLab(a, s.v);
      const txt = !seen ? '—' : r.green ? 'держит' : r.booking === 'down' ? 'запись легла' : r.booking === 'error' ? 'отказы клиентам' : r.lost.length ? 'теряем события' : 'медленно';
      return `<div class="stat ${s.v === cur ? 'cur' : ''}"><div class="k">${esc(s.t)}</div><div class="v ${seen ? (r.green ? 'ok' : 'bad') : ''}">${txt}</div><div class="s small dim">${seen ? `ответ ${fmtMs(r.resp)} · потоков ${r.threads} из ${POOL}` : 'ещё не прогнан с этими настройками'}</div></div>`;
    }).join('')}</div>`;
  }
  function labDetail(r) {
    const thrK = r.over ? 'bad' : r.threads > POOL * 0.6 ? 'warn' : 'ok';
    const bk = { ok: ['ok', 'проходят'], error: ['bad', 'отказ клиенту'], down: ['bad', 'легла'] }[r.booking];
    const cons = r.lost.length ? ['bad', `теряем: ${r.lost.join(', ')}`] : r.late.length ? ['warn', `догонят: ${r.late.join(', ')}`] : r.booking === 'ok' ? ['ok', 'все получили'] : ['bad', 'записи нет — нечего сообщать'];
    return `<div class="mqw-stats">
      <div class="stat"><span class="k">Клиент ждёт</span><span class="v ${r.resp > SLO ? 'bad' : 'ok'}">${fmtMs(r.resp)}</span><span class="s">цель — не больше ${SLO} мс</span></div>
      <div class="stat"><span class="k">Потоков нужно</span><span class="v ${thrK}">${r.threads} из ${POOL}</span><span class="s">${PEAK} записей/с × время ответа</span></div>
      <div class="stat"><span class="k">Записи</span><span class="v ${bk[0]}">${bk[1]}</span><span class="s">${r.booking === 'down' ? 'потоков не хватает — очередь растёт' : r.booking === 'error' ? 'из-за чужого сбоя' : 'клиент записан'}</span></div>
      <div class="stat"><span class="k">Потребители</span><span class="v ${cons[0]}" style="font-size:14px">${esc(cons[1])}</span><span class="s">${r.lost.length ? 'никто не перешлёт' : r.late.length ? 'события ждут в брокере' : ''}</span></div>
    </div>`;
  }
  function labNote(a, sc, r) {
    if (a.how === 'event') return ui.note('ok', 'Запись свободна от потребителей', `Запись сохранила бронь, отдала брокеру <code>BookingCreated</code> и ответила за ${fmtMs(r.resp)}. ${sc === 'down' ? 'Бонусы лежат — их события копятся в брокере и дождутся подъёма.' : sc === 'slow' ? 'Рекомендации тормозят — они отстают и догонят, запись этого не чувствует.' : 'Все шесть читают событие сами, в фоне.'}`);
    if (r.booking === 'down') return ui.note('bad', 'Запись легла', `Каждая запись держит поток ${fmtMs(r.resp)}. При ${PEAK} записях в секунду нужно ${r.threads} потоков, а их ${POOL}. Новые запросы встают в очередь, ответы уходят в таймаут — и не только у записи, но и у расписания, входа, оплаты: потоки общие. ${a.to === '30' && sc === 'down' ? 'Ровно так «Пульс» лежал 40 минут.' : ''}`);
    if (r.booking === 'error') return ui.note('bad', 'Чужой сбой отменяет запись', `Потребитель не ответил за ${a.to === '1' ? '1 с' : '30 с'} — и запись отменилась. Клиент не может записаться из-за того, что лежат ${esc(r.rows.filter(x => x.kind === 'bad').map(x => x.t).join(', ').toLowerCase())}. Ему эти системы вообще не нужны.`);
    if (r.lost.length) return ui.note('bad', 'Тихие потери', `Записи проходят, но ${esc(r.lost.join(', ').toLowerCase())} о них не узнали. За 5 минут пика это ${(PEAK * 300).toLocaleString('ru-RU')} записей — и никто эти сообщения не перешлёт: их нигде нет.`);
    if (r.resp > SLO) return ui.note('warn', 'Работает, но медленно', `Ответ ${fmtMs(r.resp)} — дольше цели ${SLO} мс. Клиент ждёт ${a.how === 'par' ? 'самого медленного из шести' : 'всех шестерых по очереди'}, хотя ему от них ничего не нужно.`);
    return ui.note('ok', 'Держит', 'Этот сценарий проходит.');
  }

  const labTask = {
    id: 'sunday-lab', title: 'Воскресенье 20:00: запись и шесть потребителей',
    simple: howStar.simple,
    lead: ui.brief({
      situation: `Через два года в воскресенье в 20:00 приходят 20 000 человек за 5 минут — это ~400 записей в секунду. На событие «клиент записался» теперь реагируют шестеро: уведомления, бонусы, рекомендации, аналитика, партнёрский шлюз, лист ожидания. Сейчас модуль «Запись» после сохранения брони вызывает их сам. У сервера записи ${POOL} рабочих потоков (6 экземпляров по 50). Цель из требований: ответ на запись не дольше ${SLO} мс, запись работает, даже когда лежит кто-то из шестерых, и никто из шестерых не теряет события.`,
      todo: [
        'В блоке «Как запись сообщает шестерым» выберите способ. Для синхронных способов — ещё таймаут вызова и что делать, если потребитель не ответил.',
        'Под настройками нажмите по очереди все три сценария: «Все здоровы», «Рекомендации тормозят», «Бонусы зависли».',
        'Найдите настройки, при которых все три карточки сценариев зелёные — «держит». Попробуйте сначала спасти синхронную схему: таймаутом, параллельными вызовами, пропуском.',
        'Ответьте на вопрос внизу и нажмите «Проверить».'
      ],
      look: `<p>Шкала — одна запись клиента. Строки — участники, полоски — сколько они работали. Синяя полоска — клиент ждёт этот вызов, пунктирная — работа в фоне после ответа клиенту, красная — ошибка или таймаут. Чёрная черта — момент ответа клиенту.</p><p>«Потоков нужно» = записей в секунду × время ответа: пока запись не ответила, её поток ничего другого не делает. Больше ${POOL} — запросы встают в очередь, и ложится всё.</p>`
    }),
    blank: () => ({ how: 'seq', to: '30', err: 'fail', sc: 'calm', seen: [], q: [] }),
    reference: () => ({ how: 'event', to: '30', err: 'fail', sc: 'calm', seen: SCN.map(s => 'event|' + s.v), q: quizRef([LAB_Q]) }),
    render(el, ctx) {
      el.classList.add('mqw-root');
      const a = ctx.ans; a.seen = a.seen || []; a.q = a.q || [];
      const mark = () => { const k = sigOf(a) + '|' + a.sc; if (!ctx.readonly && !a.seen.includes(k)) { a.seen.push(k); ctx.save(); } };
      mark();
      el.innerHTML = `<div class="stack">
        <div class="mqw-box">
          <div class="eyebrow">Как запись сообщает шестерым</div>
          <div class="mqw-set">
            <div class="lbl">Способ</div>${ui.seg('how', HOW, a.how, 'accent')}
            <div class="lbl">Таймаут вызова потребителя</div><div data-to></div>
            <div class="lbl">Потребитель не ответил</div><div data-err></div>
          </div>
        </div>
        <div class="stack tight"><div class="eyebrow">Сценарий</div>${ui.seg('sc', SCN.map(s => ({ v: s.v, t: `${s.t} · ${s.k}` })), a.sc)}</div>
        <div data-cards></div>
        <div data-g></div>
        <div data-d></div>
        <div data-n></div>
        <div class="card flat" data-q></div>
      </div>`;
      function drawSet() {
        const dis = a.how === 'event';
        TR.$('[data-to]', el).innerHTML = ui.seg('to', TO, a.to, 'accent') + (dis ? '<div class="small dim">При событии запись никого не вызывает — не важно.</div>' : '');
        TR.$('[data-err]', el).innerHTML = ui.seg('err', ERR, a.err, 'accent') + (dis ? '<div class="small dim">Не важно: событие ждёт потребителя в брокере.</div>' : '');
        if (dis) TR.$$('[data-seg="to"] button, [data-seg="err"] button', el).forEach(b => { b.disabled = true; });
        lock(TR.$('.mqw-box', el), ctx.readonly);
      }
      function draw() {
        const r = simLab(a, a.sc);
        TR.$('[data-cards]', el).innerHTML = labStats(a, a.sc);
        TR.$('[data-g]', el).innerHTML = gantt(r.rows, r.resp);
        TR.$('[data-d]', el).innerHTML = labDetail(r);
        TR.$('[data-n]', el).innerHTML = labNote(a, a.sc, r);
      }
      drawSet(); draw();
      ui.quiz(TR.$('[data-q]', el), Object.assign({}, LAB_Q, {
        value: a.q[0] || [], readonly: ctx.readonly, reveal: ctx.result,
        onChange: v => { a.q = [v]; ctx.save(); }
      }));
      ui.onSeg(el, (name, v) => {
        if (!['how', 'to', 'err', 'sc'].includes(name)) return;
        if (ctx.readonly && name !== 'sc') return;
        a[name] = v;
        if (name === 'how') drawSet();
        mark();
        if (!ctx.readonly) {
          ctx.save();
          if (name !== 'sc') ctx.decide('Как запись сообщает шестерым', a.how === 'event' ? 'событие в брокер' : `${tOf(HOW, a.how)}; таймаут ${tOf(TO, a.to)}; при ошибке — ${tOf(ERR, a.err)}`);
        }
        draw();
      });
    },
    check(ans) {
      const sig = sigOf(ans), seen = ans.seen || [];
      const res = SCN.map(s => ({ s, r: simLab(ans, s.v), seen: seen.includes(sig + '|' + s.v) }));
      const greens = res.filter(x => x.r.green).length, seenAll = res.every(x => x.seen);
      const q = ui.quizScore(LAB_Q, (ans.q || [])[0] || []);
      const notes = [];
      res.forEach(({ s, r, seen: sn }) => {
        if (!sn) notes.push({ ok: 'warn', html: `Сценарий «${esc(s.t)}» с этими настройками ещё не прогнан — нажмите его под настройками.` });
        else if (r.green) notes.push({ ok: true, html: `«${esc(s.t)}»: держит, ответ ${fmtMs(r.resp)}.` });
        else if (r.booking === 'down') notes.push({ ok: false, html: `«${esc(s.t)}»: нужно ${r.threads} потоков из ${POOL}. Пока запись ждёт чужие ответы, поток занят. Как сделать, чтобы запись вообще не ждала потребителей?` });
        else if (r.booking === 'error') notes.push({ ok: false, html: `«${esc(s.t)}»: клиент не записан из-за чужого сбоя. Должна ли запись зависеть от бонусов и рекомендаций?` });
        else if (r.lost.length) notes.push({ ok: false, html: `«${esc(s.t)}»: запись прошла, но ${esc(r.lost.join(', ').toLowerCase())} событие потеряли. Где сообщение могло бы подождать, пока получатель лежит?` });
        else notes.push({ ok: false, html: `«${esc(s.t)}»: ответ ${fmtMs(r.resp)} — дольше ${SLO} мс. Клиент ждёт тех, кто ему не нужен.` });
      });
      if (!q.ok) notes.push({ ok: false, html: 'Вопрос внизу: подумайте, где лежат события, пока бонусы не работают, и кто их потом дочитывает.' });
      else notes.push({ ok: true, html: 'Вопрос: верно — события дождутся бонусов в брокере.' });
      const score = greens / 3 * 0.6 + (seenAll ? 0.1 : 0) + q.score * 0.3;
      return {
        ok: greens === 3 && seenAll && q.ok, score, notes,
        summary: `Сценариев держит: ${greens} из 3 (способ — ${esc(tOf(HOW, ans.how))}).`,
        vera: greens === 3 ? null : 'Синхронную схему можно ускорить и сделать терпимее, но она всё равно зависит от каждого из шести. Попробуйте способ, при котором запись не ждёт никого из них.'
      };
    },
    explain: `<p>Устойчив только вариант <b>«публикуем событие»</b>: запись сохраняет бронь, отдаёт <code>BookingCreated</code> брокеру и отвечает за ~45 мс. Потоков в пик нужно ~18 из 300. Упавшие и медленные потребители отстают, но ничего не теряют.</p>
      <ul class="checks">
        <li><b>По очереди</b> — время ответа = сумма шести вызовов (~0,9 с). Даже когда все здоровы, 400 записей/с × 0,9 с = 360 потоков из 300: запись ложится просто от роста. В сезоне 1 при 60 записях/с та же схема занимала ~54 потока и жила.</li>
        <li><b>Одновременно</b> — время = самый медленный (~340 мс), но зависимость от каждого осталась: тормозят рекомендации — тормозит запись; бонусы висят — висит запись.</li>
        <li><b>Таймаут 1 с</b> ограничивает худший случай, но 400 записей/с × ~1 с = 400 потоков из 300 — запись всё равно ложится. А даже с запасом потоков остался бы выбор из двух бед: отменять запись из-за чужого сбоя или молча терять события.</li>
      </ul>
      <p>Брокер развязывает систему <b>во времени</b> (потребителю не нужно работать в ту же секунду) и <b>в знании</b> (запись не знает, сколько у неё потребителей). Цена: данные у потребителей обновляются не мгновенно, нужны мониторинг отставания и защита от дублей. Об этом — в среду и четверг.</p>`,
    report: ans => {
      const sig = sigOf(ans);
      return `Способ: ${tOf(HOW, ans.how)}${ans.how === 'event' ? '' : `; таймаут ${tOf(TO, ans.to)}; при ошибке — ${tOf(ERR, ans.err)}`}.\n` +
        SCN.map(s => { const r = simLab(ans, s.v); return `- ${s.t}: ответ ${fmtMs(r.resp)}, потоков ${r.threads}/${POOL}, ${r.green ? 'держит' : 'не держит'}${(ans.seen || []).includes(sig + '|' + s.v) ? '' : ' (не прогнан)'}`; }).join('\n') +
        `\nВопрос о бонусах: ${ui.quizScore(LAB_Q, (ans.q || [])[0] || []).ok ? 'верно' : 'неверно'}.`;
    }
  };

  // =====================================================================
  // Практика 2. Разложить взаимодействия «Пульса» по способам
  // =====================================================================
  const WB = [
    { id: 'sync', t: 'Синхронный запрос', sub: 'ждём ответ сразу' },
    { id: 'event', t: 'Событие в брокер', sub: 'факт для многих' },
    { id: 'queue', t: 'Задача в очередь', sub: 'поручение исполнителю' },
    { id: 'hook', t: 'Вебхук наружу', sub: 'внешнему партнёру' },
    { id: 'batch', t: 'Пакетная выгрузка', sub: 'пачкой по расписанию' }
  ];
  const WAYS = [
    { id: 'w-book', t: 'Анна записывается на сайкл и ждёт: «записаны» или «мест нет»', ok: 'sync', crit: true, hint: 'Анне нужен ответ сейчас — от него зависит, придёт ли она на занятие.', why: 'Человек ждёт результат на экране — синхронный <code>POST /classes/{id}/bookings</code>.' },
    { id: 'w-turn', t: 'Турникет спрашивает, пускать ли клиента (решение за 300 мс)', ok: 'sync', hint: 'Человек стоит у турникета. Можно ли ответить «когда-нибудь потом»?', why: 'Ответ нужен немедленно — синхронный gRPC к сервису «Доступ», а без связи — офлайн-список.' },
    { id: 'w-fan', t: 'Бонусы, рекомендации и аналитика должны узнать, что Анна записалась', ok: 'event', crit: true, hint: 'Один факт — несколько независимых получателей. Должна ли запись знать каждого из них?', why: 'Один факт — много получателей: <code>BookingCreated</code> в Kafka, каждый читает своей группой.' },
    { id: 'w-push', t: 'Отправить Анне пуш «Вы записаны на сайкл в пн 19:00»', ok: 'queue', alt: { event: 'Событие сообщает факт, а «отправь пуш» — поручение одному исполнителю: ему нужны подтверждение, повтор и приоритет. Сервис уведомлений читает событие и кладёт задачу в очередь RabbitMQ.' }, hint: 'Это факт для многих или поручение, которое должен выполнить кто-то один — и надёжно?', why: 'Поручение «отправь» — задача в очередь RabbitMQ: подтверждение, повтор, приоритеты.' },
    { id: 'w-code', t: 'Отправить SMS с кодом входа (шлюз держит 30 запросов/с и иногда думает 10 с)', ok: 'queue', hint: 'Шлюз медленный и с лимитом. Можно ли держать запрос клиента и поток сервера, пока он думает?', why: 'Задача в очередь с высоким приоритетом: отправщик соблюдает лимит 30/с и повторяет при сбое.' },
    { id: 'w-fit', t: 'Сообщить ФитПассу, что его клиент прошёл в клуб', ok: 'hook', alt: { event: 'Внутри — да: партнёрский шлюз читает визиты из Kafka. Но сам ФитПасс к нашему брокеру не подключён: до него доходит вебхук <code>visit.completed</code>.' }, hint: 'ФитПасс — внешняя компания. Может ли она читать наш внутренний брокер?', why: 'Внешнему партнёру — вебхук <code>visit.completed</code> с подписью и повторами. Брокер остаётся внутри.' },
    { id: 'w-1c', t: 'Передать в 1С оплаты и возвраты (1С принимает по SOAP в будни с 9 до 19)', ok: 'batch', alt: { event: 'Допустимо как источник: группа <code>onec-export</code> читает события оплат из Kafka. Но в саму 1С всё равно уходит пачкой в окно 9–19 — 1С брокер не читает.' }, hint: 'Когда 1С вообще готова принимать данные и каким способом?', why: 'Пачками по 100 в рабочее окно 9–19, номер документа = <code>public_id</code>.' },
    { id: 'w-sched', t: 'Сайт показывает расписание клуба на завтра', ok: 'sync', hint: 'Посетитель открыл страницу и ждёт таблицу.', why: 'Синхронный <code>GET</code> через кэш и CDN.' },
    { id: 'w-recs', t: 'Пересчитать «Вам подойдёт» для 300 тыс. клиентов раз в сутки', ok: 'batch', alt: { event: 'Данные о посещениях действительно приходят в аналитику событиями. Но сам пересчёт раз в сутки — пакетная задача по накопленным данным.' }, hint: 'Как часто это нужно и ждёт ли кто-то ответа в ту же секунду?', why: 'Ночной пакетный пересчёт по накопленным данным.' },
    { id: 'w-pay', t: 'Платёж прошёл: абонементы, выгрузка в 1С и аналитика должны узнать', ok: 'event', hint: 'Сколько получателей у этого факта? Должны ли «Платежи» ждать каждого?', why: '<code>PaymentSucceeded</code> в Kafka: группы <code>memberships</code>, <code>onec-export</code>, <code>analytics</code>.' }
  ];
  function waysEval(v) {
    v = v || {};
    return WAYS.map(w => {
      const got = v[w.id];
      if (got === w.ok) return { w, s: 'ok', pts: 1 };
      if (w.alt && w.alt[got]) return { w, s: 'warn', pts: 0.5 };
      return { w, s: 'bad', pts: 0, empty: !got };
    });
  }
  const waysTask = {
    id: 'ways', title: 'Пять способов: разложить взаимодействия',
    simple: howBroker.simple,
    lead: ui.brief({
      situation: 'Антон просит карту: как «Пульс» общается внутри и снаружи после роста. Брокер появился, но не всё теперь «через брокер». У каждого способа своя задача: синхронный запрос — когда человек ждёт ответа сейчас; событие — один факт для многих; задача в очередь — поручение, которое надо надёжно выполнить; вебхук — внешнему партнёру; пакетная выгрузка — пачкой по расписанию.',
      todo: [
        'Разложите 10 карточек по пяти корзинам: нажмите карточку, потом корзину (на компьютере можно перетаскивать).',
        'Для каждой спросите себя: кто ждёт ответа? сколько получателей? это факт или поручение? внутри мы или снаружи?',
        'Нажмите «Проверить». Засчитывается от 80 %. Некоторые карточки допускают второй ответ — он засчитывается наполовину, с пояснением.'
      ],
      lookTitle: 'Подсказка',
      look: 'Факт («записался», «оплатил») — событие, его читают многие. Поручение («отправь», «пересчитай») — задача, её выполняет один. Человек у экрана или турникета — синхронно. Чужая компания — только то, что она умеет принимать.'
    }),
    blank: () => ({ v: {} }),
    reference: () => ({ v: Object.fromEntries(WAYS.map(w => [w.id, w.ok])) }),
    render(el, ctx) {
      el.classList.add('mqw-root');
      let reveal = null;
      if (ctx.result) { reveal = {}; waysEval(ctx.ans.v).forEach(x => { reveal[x.w.id] = x.s; }); }
      const box = document.createElement('div'); el.appendChild(box);
      ui.sort(box, {
        items: WAYS.map(w => ({ id: w.id, t: w.t })), buckets: WB, value: ctx.ans.v || {}, reveal, readonly: ctx.readonly, seed: 'mqw-ways',
        onChange: v => { ctx.ans.v = v; ctx.save(); }
      });
      if (ctx.readonly) {
        const d = document.createElement('div'); d.style.marginTop = '12px';
        d.innerHTML = ui.table(['Взаимодействие', 'Способ', 'Почему'], WAYS.map(w => [esc(w.t), esc(WB.find(b => b.id === w.ok).t), w.why + (w.alt ? `<div class="small dim">Допустимо: ${Object.keys(w.alt).map(k => esc(WB.find(b => b.id === k).t)).join(', ')} — засчитывается наполовину.</div>` : '')]));
        el.appendChild(d);
      }
    },
    check(ans) {
      const ev = waysEval(ans && ans.v), pts = ev.reduce((s, x) => s + x.pts, 0), score = pts / WAYS.length;
      const critBad = ev.filter(x => x.w.crit && x.s !== 'ok');
      const notes = [];
      ev.forEach(x => {
        if (x.s === 'ok') return;
        if (x.s === 'warn') notes.push({ ok: 'warn', html: `«${esc(x.w.t)}» — ${x.w.alt[(ans.v || {})[x.w.id]]}` });
        else notes.push({ ok: false, html: `«${esc(x.w.t)}» — ${x.empty ? 'не разложено. ' : ''}${x.w.hint}` });
      });
      const good = ev.filter(x => x.s === 'ok').length;
      if (!notes.length) notes.push({ ok: true, html: 'Все десять — по своим способам.' });
      return { ok: score >= 0.8 && !critBad.length, score, notes, summary: `Точно: ${good} из ${WAYS.length}, допустимо: ${ev.filter(x => x.s === 'warn').length}.`, vera: critBad.length ? 'Начните с двух опорных: запись на занятие (клиент ждёт ответ) и «узнать, что записалась» (факт для многих). Это главное различие недели.' : null };
    },
    explain: `<p>Брокер не заменил остальные способы — он занял свою нишу. Карта «Пульса» после роста:</p>
      <ul class="checks">
        <li><b>Синхронно</b> — где человек ждёт: запись, оплата, турникет, расписание.</li>
        <li><b>Событие в Kafka</b> — факты для многих: записался, оплатил, прошёл, активировал абонемент.</li>
        <li><b>Задача в RabbitMQ</b> — поручения с подтверждением, повтором и приоритетом: пуши, SMS.</li>
        <li><b>Вебхук</b> — внешним партнёрам: они не читают наш брокер.</li>
        <li><b>Пакет</b> — 1С (окно 9–19, SOAP), ночные пересчёты, ежемесячные сверки.</li>
      </ul>
      <p>Частая ошибка после появления брокера — «теперь всё через события», включая запись на занятие. Тогда клиенту нечего показать на экране: «ваш запрос принят, ждите». Для действия, результат которого человек ждёт, событие — не замена ответу.</p>`,
    report: ans => waysEval(ans && ans.v).map(x => `- ${x.w.t} → ${(WB.find(b => b.id === (ans.v || {})[x.w.id]) || { t: '—' }).t} ${x.s === 'ok' ? '✓' : x.s === 'warn' ? '≈' : '✗'}`).join('\n')
  };

  // =====================================================================
  // Практика 3. Что теперь писать аналитику
  // =====================================================================
  const AN_Q = {
    q: 'Решили: «Запись» публикует <code>BookingCreated</code>, шестеро читают сами. Что вы как аналитик добавите в требования и контракты? Отметьте всё нужное.', multi: true, seed: 'mqw-an',
    options: [
      { t: 'Контракт события: имя, поля, ключ, версия, пример — в описании каналов (AsyncAPI)', ok: 1, why: 'Да. Событие — такой же контракт, как REST: потребители пишут код по нему, ломать его нельзя.' },
      { t: 'Кто читает событие и что каждый с ним делает', ok: 1, why: 'Да. Без этого списка никто не знает, кого заденет изменение события.' },
      { t: 'Допустимое отставание каждого потребителя и что видит клиент, пока событие не обработано («бонусы появятся в течение минуты»)', ok: 1, why: 'Да. Это новое требование качества: «мгновенно» больше не бывает, надо договориться, сколько можно.' },
      { t: 'Сценарий отказа: потребитель лежит час — что копится, сколько хранится, кто получает сигнал тревоги', ok: 1, why: 'Да. Брокер хранит события 7 дней, но кто-то должен заметить отставание раньше.' },
      { t: 'Что делать с повтором: одно и то же событие может прийти дважды, потребитель обрабатывает его один раз по <code>eventId</code>', ok: 1, why: 'Да. Брокеры доставляют «хотя бы один раз», дубли бывают. Подробно — в среду.' },
      { t: 'Порядок, в котором «Запись» вызывает шестерых, и таймаут каждого вызова', why: 'Запись больше никого не вызывает — это и было целью. Порядок важен внутри событий одного занятия, а не между потребителями.' },
      { t: 'Телефон и ФИО клиента внутри события — чтобы уведомлениям не ходить за ними', why: 'Персональные данные в события «Пульса» не кладут: событие читают многие и хранят 7 дней. Только <code>clientId</code>.' },
      { t: 'Ответ клиенту отдаём только после того, как все шестеро обработали событие', why: 'Тогда это снова синхронная звезда, только через брокер. Запись ждёт лишь подтверждения брокера «принял и сохранил».' }
    ]
  };
  const analystTask = {
    id: 'analyst', title: 'Что меняется в требованиях',
    simple: {
      icon: '📝',
      plain: 'Когда системы общаются событиями, у аналитика появляются новые вопросы: что именно в событии, кто его читает, сколько можно опаздывать и что будет, если кто-то лежит.',
      analogy: 'Объявление на доске в раздевалке. Надо договориться, что в нём пишут, кто его читает, как долго оно висит и что делать, если кто-то был в отпуске. А «позвонить каждому по очереди» больше не нужно.',
      tech: 'Контракт события (AsyncAPI, реестр схем), список потребителей, требования к задержке и согласованности в конечном счёте, сценарии отказов, идемпотентность потребителей, запрет ПДн в событиях.'
    },
    lead: ui.brief({
      situation: 'Антон и Лена договорились: модуль «Запись» публикует событие <code>BookingCreated</code>, шесть потребителей читают его из брокера сами. Лена спрашивает вас: «Что из этого мне ждать в постановке? Раньше в требованиях было: “после записи вызвать уведомления, бонусы…”».',
      todo: [
        'Прочитайте восемь пунктов: какие из них теперь должны появиться в требованиях и контрактах, а какие остались от старой схемы или вредны.',
        'Отметьте все нужные и нажмите «Проверить». Засчитывается от 80 %: лишний пункт отнимает столько же, сколько даёт верный.'
      ],
      lookTitle: 'Подсказка',
      look: 'Представьте, что вы — разработчик сервиса бонусов. Чего вам не хватит, чтобы написать код? И представьте Ольгу: что ей важно знать о том, когда клиент увидит бонусы?'
    }),
    blank: () => ({ q: [] }),
    reference: () => ({ q: quizRef([AN_Q])[0] }),
    render(el, ctx) {
      el.classList.add('mqw-root');
      const d = document.createElement('div'); d.className = 'card flat'; el.appendChild(d);
      ui.quiz(d, Object.assign({}, AN_Q, { value: ctx.ans.q || [], readonly: ctx.readonly, reveal: ctx.result, onChange: v => { ctx.ans.q = v; ctx.save(); } }));
    },
    check(ans) {
      const r = ui.quizScore(AN_Q, ans.q || []), sel = new Set(ans.q || []);
      const okN = AN_Q.options.filter(o => o.ok).length, good = AN_Q.options.filter((o, i) => o.ok && sel.has(i)).length, bad = AN_Q.options.filter((o, i) => !o.ok && sel.has(i)).length;
      const notes = [];
      if (good < okN) notes.push({ ok: false, html: `Нужных пунктов отмечено ${good} из ${okN}. Подумайте, что нужно разработчику потребителя и что — Ольге про сроки появления бонусов.` });
      if (bad) notes.push({ ok: false, html: `Лишних пунктов: ${bad}. Проверьте, нет ли среди отмеченных остатков старой схемы «запись всех вызывает» и персональных данных.` });
      if (!notes.length) notes.push({ ok: true, html: 'Все пять нужных пунктов и ни одного лишнего.' });
      return { ok: r.score >= 0.8, score: r.score, notes, summary: `Верных: ${good} из ${okN}, лишних: ${bad}.` };
    },
    explain: `<p>С событиями аналитик описывает не «кого вызвать», а <b>контракт факта</b> и <b>ожидания от получателей</b>:</p>
      <ul class="checks">
        <li>Контракт события — в AsyncAPI и реестре схем (в пятницу будем проектировать события подробно).</li>
        <li>Таблица потребителей: группа, что делает, допустимое отставание. Например: уведомления — секунды; бонусы — до минуты; аналитика — до часа.</li>
        <li>Тексты на экранах под согласованность в конечном счёте: «Бонусы начислятся в течение минуты».</li>
        <li>Сценарии отказов: потребитель лежит, брокер недоступен, пришёл дубль.</li>
      </ul>
      <p>Персональные данные в события «Пульса» не кладут: только <code>clientId</code>. Кому нужен телефон — спросит у владельца данных.</p>`,
    report: ans => (ans.q || []).map(i => '- ' + plainT(AN_Q.options[i] && AN_Q.options[i].t) + (AN_Q.options[i] && AN_Q.options[i].ok ? ' ✓' : ' ✗')).join('\n') || '—'
  };

  // =====================================================================
  // Практика 4. Объяснить Ольге
  // =====================================================================
  const OLGA_RUBRIC = [
    'Раньше потребителей было мало, нагрузка в 7 раз меньше — хватало вебхуков, таблицы-очереди и прямых вызовов',
    'Теперь на одну запись реагируют шесть систем, и их будет больше; запись вызывает каждую и ждёт всех',
    'Медленный или упавший потребитель тормозит или роняет запись; в пик заканчиваются ресурсы сервера — так и легли в воскресенье',
    'С брокером запись отвечает сразу, остальные читают сами; упавший потом дочитает — события не теряются',
    'Честно про цену: новая система в эксплуатации, бонусы и пуши приходят с небольшой задержкой, нужен присмотр за отставанием'
  ];
  const OLGA_REF = 'Год назад запись сообщала о себе двум-трём системам, а в пике было 60 записей в секунду — прямых вызовов, вебхуков и таблицы-очереди хватало. Теперь на каждую запись реагируют шесть систем: пуши, бонусы, рекомендации, аналитика, партнёры, лист ожидания, — а в воскресенье 20:00 будет 400 записей в секунду. Если запись сама вызывает всех шестерых и ждёт каждого, клиент ждёт их всех, а любой зависший сервис занимает ресурсы сервера — в пик их не хватает, и падает всё, как в прошлое воскресенье. Брокер — как почтовое отделение: запись отдаёт ему новость «клиент записался» и сразу отвечает клиенту, а остальные забирают новость сами. Упал сервис бонусов — новости ждут его в брокере неделю, поднимется и начислит. Цена: ещё одна система (берём управляемый сервис в Yandex Cloud), бонусы и пуши приходят через секунду-другую, а не мгновенно, и надо следить, чтобы никто не отставал надолго.';
  const olgaTask = {
    id: 'why-olga', title: 'Объясните Ольге',
    simple: {
      icon: '🗣️',
      plain: 'Директору не нужны слова «брокер» и «пул потоков». Ей нужно: что ломалось, почему сейчас, что изменится для клиентов и сколько это стоит.',
      analogy: 'Объяснить, зачем клубу журнал смены, если раньше администратор всех обзванивал сам. Пока сотрудников было трое — хватало звонков. Теперь их тридцать — и клиент у стойки ждёт, пока дозвонятся до последнего.',
      tech: 'Аргументы для бизнеса: рост числа потребителей и нагрузки, каскадный отказ синхронной схемы (авария воскресенья), развязка во времени, цена — эксплуатация, согласованность в конечном счёте, мониторинг отставания.'
    },
    lead: ui.brief({
      situation: 'Ольга после встречи: «Антон говорит — нужен брокер. Год назад вы всё сделали без него, и работало. Зачем ещё одна система, которую надо поддерживать? Объясните так, чтобы я могла пересказать инвестору».',
      todo: [
        'Напишите Ольге 5–8 предложений без технического жаргона (от 200 символов).',
        'Ответьте на три её вопроса: почему без брокера раньше было можно, а теперь нельзя; что изменится для клиентов; какая цена.',
        'Нажмите «Проверить с Верой (Claude)» или «Сверить с эталоном самому» и отметьте раскрытые пункты. Засчитывается от 60 %.'
      ],
      lookTitle: 'На что опереться',
      look: 'Цифры: было 60 записей в секунду в пике, будет 400; потребителей события «записался» — шесть. Прошлое воскресенье: всё легло на 40 минут, потому что один медленный вызов занял ресурсы сервера. Аналогии: почтовое отделение, журнал смены, обзвон.'
    }),
    blank: () => ({ j: {} }),
    reference: () => ({ j: { text: OLGA_REF, self: OLGA_RUBRIC.map(() => true) } }),
    render(el, ctx) {
      el.classList.add('mqw-root');
      el.insertAdjacentHTML('beforeend', ui.say('olga', 'Год назад вы всё сделали без брокера — и работало. Зачем теперь ещё одна система? Мне это инвестору объяснять.'));
      const j = document.createElement('div'); j.style.marginTop = '12px'; el.appendChild(j);
      ui.justify(j, {
        id: 'mqw-olga', q: 'Зачем «Пульсу» брокер, если раньше обходились без него?', qPlain: 'Объясните директору без жаргона: зачем «Пульсу» брокер сообщений, если год назад обходились без него, что изменится для клиентов и какая цена.',
        rubric: OLGA_RUBRIC, reference: OLGA_REF, value: ctx.ans.j, readonly: ctx.readonly, minLen: 200,
        onChange: v => { ctx.ans.j = v; ctx.save(); ctx.decide('Зачем брокер (для Ольги)', v.text || ''); }
      });
    },
    check(ans) {
      const s = ui.justifyScore(ans && ans.j);
      return {
        ok: s >= 0.6, score: s,
        summary: s ? `Оценка объяснения: ${Math.round(s * 100)} %.` : 'Напишите ответ (от 200 символов) и проверьте его с Верой или сверьте с эталоном сами.',
        notes: s && s < 0.6 ? [{ ok: false, html: 'Ольге важно три вещи: что изменилось с прошлого года (цифры), что случилось в воскресенье и почему брокер это лечит, и честная цена.' }] : []
      };
    },
    explain: '<p>Хорошее объяснение для директора — не про технологию, а про <b>причину, следствие и цену</b>. Рост (6 потребителей, 400 записей в секунду) сделал старую схему опасной; авария воскресенья — живое доказательство; брокер убирает зависимость записи от всех остальных; цена — эксплуатация и небольшая задержка у бонусов и пушей.</p><p>Обратите внимание: «раньше было можно» — это не ошибка прошлого года. Брокер на 12 клубах и 4 разработчиках был бы лишней сложностью. Архитектура меняется, когда меняются требования, — и это стоит сказать вслух.</p>',
    report: ans => (ans.j && ans.j.text) ? ans.j.text : '—'
  };

  // =====================================================================
  TR.stage({
    id: ID, act: 5, order: 210, slot: 'Пн 10:00', title: 'Зачем брокер',
    when: 'понедельник, 10:00 · переговорная «Сайкл» · Ольга, Антон, Лена',
    intro: [
      { who: 'olga', html: 'Нас купил инвестор: через два года — 60 клубов в 8 городах и 300 тысяч клиентов. Бонусы, онлайн-тренировки, рекомендации, ещё три партнёра. А в прошлое воскресенье всё легло на 40 минут — люди не могли записаться. Больше такого быть не должно.' },
      { who: 'anton', html: 'Разбор аварии: зависла выгрузка в 1С, её вызывали синхронно — и у ядра кончились рабочие потоки. Но я посмотрел код записи: после сохранения она по очереди зовёт шестерых — пуши, бонусы, рекомендации, аналитику, партнёров, лист ожидания. Это та же мина. Предлагаю брокер сообщений: запись публикует событие и сразу отвечает клиенту, остальные читают сами.' },
      { who: 'vera', html: 'Прежде чем соглашаться, проверим руками. Сначала посмотрим, как ломается «звезда» вызовов и чем её заменяет брокер. Потом — лаборатория на воскресном пике, карта способов общения и объяснение для Ольги.' }
    ],
    facts: ['F-week-open', 'F-availability', 'F-push', 'F-sms', 'F-1c-soap', 'F-fitpass-tech', 'F-partners-more'],
    glossary: [
      { term: 'Брокер сообщений', simple: 'Почтовое отделение между системами: отправитель сдал письмо и свободен, получатели забирают почту, когда могут.', tech: 'Отдельная система, которая принимает сообщения от издателей, надёжно хранит и отдаёт потребителям. У «Пульса» — Kafka для доменных событий и RabbitMQ для задач уведомлений.' },
      { term: 'Доменное событие', simple: 'Запись в журнале смены о том, что уже случилось: «Анна записалась на сайкл в пн 19:00».', tech: 'Сообщение о свершившемся факте предметной области, имя в прошедшем времени (BookingCreated, PaymentSucceeded). Издатель не знает, кто его прочтёт, и никого не ждёт.' },
      { term: 'Издатель и подписчик (pub/sub)', simple: 'Объявление на доске в раздевалке: повесил — и каждый, кому интересно, прочитал сам.', tech: 'Издатель (producer) публикует сообщение в брокер, подписчики (consumers) получают его независимо друг от друга. Новый подписчик не требует правки издателя.' },
      { term: 'Звезда синхронных вызовов', simple: 'Администратор после каждой продажи сам обзванивает всех — клиент стоит у стойки, пока не ответит последний.', tech: 'Модуль после своей операции синхронно вызывает каждого заинтересованного. Время ответа — сумма задержек (или максимум при параллельных вызовах), а отказ любого получателя становится отказом операции.' },
      { term: 'Каскадный отказ', simple: 'Упала одна костяшка домино — упал весь ряд: зависла 1С, а встала запись на занятия.', tech: 'Отказ одного компонента через синхронные зависимости и общие ресурсы (пул потоков, соединения) выводит из строя остальные. Авария «Пульса» в воскресенье — классический пример.' },
      { term: 'Пул потоков', simple: 'Ресепшен с 300 окошками: пока окошко ждёт ответа по телефону, оно никого не обслуживает.', tech: 'Ограниченный набор рабочих потоков сервера. Сколько нужно ≈ запросов в секунду × время ответа (закон Литтла): 400/с × 0,9 с = 360 потоков.' },
      { term: 'Очередь задач', simple: 'Заказы на кухне: каждый заказ готовит один повар, готовый убирают со стойки.', tech: 'Сообщение-поручение получает один исполнитель из нескольких; после подтверждения (ack) оно удаляется. Так работает RabbitMQ.' },
      { term: 'Журнал событий', simple: 'Журнал посещений на ресепшене: записи не вычёркивают, каждый читает со своей закладки.', tech: 'Сообщения хранятся заданный срок (у «Пульса» 7 дней) независимо от прочтения; каждая группа читателей помнит свою позицию и может перечитать. Так работает Kafka.' },
      { term: 'Согласованность в конечном счёте', simple: 'Бонусы за запись появятся не в ту же секунду, а через пару секунд — но обязательно появятся.', tech: 'Eventual consistency: подписчики обновляют свои данные с задержкой; какое-то время системы видят разное, а без новых изменений приходят к одному состоянию. Допустимую задержку фиксируют в требованиях.' },
      { term: 'Таблица-очередь', simple: 'Список дел на доске у администратора: дописал строчку — фоновая задача потом вычеркнет.', tech: 'Очередь в обычной таблице PostgreSQL (статус, next_attempt_at, выборка FOR UPDATE SKIP LOCKED). Хватает при одном исполнителе и небольшом потоке — так было в сезоне 1.' }
    ],
    outro: 'Брокер не «правильнее» прямых вызовов — он решает конкретную беду: один факт, много получателей, и запись не должна от них зависеть. Синхронно остаётся всё, где человек ждёт ответа; наружу — вебхуки; в 1С — пачки. Завтра разберём, какие бывают брокеры: Kafka — журнал с партициями, RabbitMQ — почтовое отделение с очередями, — и почему «Пульсу» нужны оба.',
    tasks: [howStar, howBroker, labTask, waysTask, analystTask, olgaTask]
  });
})();
