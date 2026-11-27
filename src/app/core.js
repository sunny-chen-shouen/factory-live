/* Factory LIVE — shared app core: config, language, helpers, factory icon, countdown, audio, router. */
(function () {
  'use strict';
  var FL = window.FL = window.FL || {};
  var C = window.FLCalc;

  /* ------------------------------------------------ config (edited at deploy time) */
  FL.cfg = window.FL_CONFIG || {};
  FL.useLocal = !FL.cfg.url || !FL.cfg.key || /[?&]local\b/.test(location.search);
  FL.api = FL.useLocal ? window.FLApi.LocalApi() : window.FLApi.SupabaseApi(FL.cfg);
  FL.store = window.FLApi.Store(FL.api);

  /* ------------------------------------------------ safe storage */
  var memStore = {};
  FL.ls = {
    get: function (k) { try { var v = localStorage.getItem(k); return v == null ? (memStore[k] == null ? null : memStore[k]) : v; } catch (e) { return memStore[k] == null ? null : memStore[k]; } },
    set: function (k, v) { memStore[k] = String(v); try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del: function (k) { delete memStore[k]; try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };

  /* ------------------------------------------------ language */
  // English by default for everyone; only an explicit switch (stored in fl_lang) changes it.
  FL.lang = FL.ls.get('fl_lang') === 'zh' ? 'zh' : 'en';
  FL.t = function (key) {
    var snap = FL.store && FL.store.snap, extended = snap && snap.session.params.extended_rounds;
    if (extended && FL.dict['extended_' + key]) key = 'extended_' + key;
    if (extended && /^(extended_)?d1_(h|screen)$/.test(key) && /0$/.test(snap.session.phase)) key = key.replace('extended_', '') + '_first';
    var d = FL.dict[key];
    if (!d) { return '⟦' + key + '⟧'; }
    var s = d[FL.lang] != null ? d[FL.lang] : d.zh;
    for (var i = 1; i < arguments.length; i++) s = s.split('{' + (i - 1) + '}').join(arguments[i]);
    return s;
  };
  FL.setLang = function (l) { FL.lang = l; FL.ls.set('fl_lang', l); document.documentElement.lang = l === 'zh' ? 'zh-Hant' : 'en'; document.title = FL.t('doc_title'); FL.render(true); };

  /* ------------------------------------------------ helpers */
  FL.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  FL.sg = function (n) { // signed number with a real minus sign
    if (n == null || isNaN(n)) return '—';
    var r = Math.round(n * 100) / 100;
    return r > 0 ? '+' + r : r < 0 ? '−' + Math.abs(r) : '0';
  };
  FL.n2 = function (n) { return n == null || isNaN(n) ? '—' : String(Math.round(n * 100) / 100).replace('-', '−'); };
  FL.$ = function (sel, root) { return (root || document).querySelector(sel); };
  FL.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  FL.snap = function () { return FL.store.snap; };
  FL.practiceHTML = function (snap) {
    return '<div class="card accent stack"><h2>' + FL.t('practice_h') + '</h2><p>' + FL.t('practice_p') + '</p>' + FL.cdHTML(snap) + '</div>';
  };
  FL.leaseHTML = function (snap, per) {
    var F = snap.session.params.F;
    return '<div class="banner lease-note">' + (per < 2 ? FL.t('prepaid_two', F * 2, F) : FL.t('renew_one', F)) + '</div>';
  };
  FL.roundHistoryHTML = function (snap, me) {
    var led = C.ledger(me,snap);
    return '<div class="card stack round-history"><h3>' + FL.t('round_history') + '</h3><table class="t"><tr><th>' + FL.t('round') + '</th><th>' + FL.t('c_workers') + '</th><th>' + FL.t('c_rings') + '</th><th>' + FL.t('l_profit') + '</th></tr>' + [0,1,2].map(function(k) {
      var p = led.periods[k];
      return '<tr><td>' + FL.t('period' + k) + '</td><td>' + (p.decided ? p.renew ? p.L : FL.t('exit') : '—') + '</td><td>' + (p.complete && p.q != null ? FL.n2(p.q) : '—') + '</td><td class="sign">' + (p.complete ? FL.sg(p.profit) : '—') + '</td></tr>';
    }).join('') + '</table><div class="row"><b class="grow">' + FL.t('total_h') + '</b><b>' + FL.sg(led.total) + '</b></div></div>';
  };
  FL.team = function (snap, id) { return snap.teams.filter(function (t) { return t.id === id; })[0]; };
  FL.active = function (snap) { return snap.teams.filter(function (t) { return t.present > 0; }); };
  FL.toast = function (msg) {
    var d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 2600);
  };
  FL.errText = function (e) {
    var m = (e && e.message) || String(e);
    var k = 'err_' + m.replace(/[^a-zA-Z_]/g, '').toLowerCase().slice(0, 24);
    return FL.dict[k] ? FL.t(k) : FL.t('err_retry');
  };
  FL.showError = function (e) {
    var old = FL.$('.action-error'); if (old) old.remove();
    var box = document.createElement('div'); box.className = 'action-error'; box.setAttribute('role', 'alert');
    box.innerHTML = '<button class="btn sm ghost error-close" aria-label="' + FL.t('dismiss') + '">×</button><b>' + FL.esc(FL.errText(e)) + '</b><details><summary>' + FL.t('error_details') + '</summary><pre></pre></details>';
    box.querySelector('pre').textContent = (e && e.message) || String(e);
    box.querySelector('button').onclick = function () { box.remove(); };
    document.body.appendChild(box);
  };
  FL.run = function (promise, okMsg) { // run an action, show friendly errors, then refresh
    return promise.then(function (r) { if (okMsg) FL.toast(okMsg); return FL.store.refresh().then(function () { return { ok: true, value: r }; }); })
      .catch(function (e) { FL.showError(e); return { ok: false, error: e }; });
  };
  FL.saveField = function (el, promise) {
    el.setAttribute('aria-busy', 'true'); el.classList.add('saving');
    var status = document.createElement('span'); status.className = 'save-state tiny'; status.setAttribute('role', 'status');
    status.textContent = FL.t('saving'); el.insertAdjacentElement('afterend', status);
    return FL.run(promise).then(function (res) {
      el.removeAttribute('aria-busy'); el.classList.remove('saving');
      el.setAttribute('aria-invalid', res.ok ? 'false' : 'true');
      status.textContent = FL.t(res.ok ? 'toast_saved' : 'save_failed'); status.classList.toggle('save-failed', !res.ok);
      if (res.ok) FL.toast(FL.t('toast_saved'));
      return res;
    });
  };
  FL.marketPublished = function (snap) { return window.FLCalc.PHASES.indexOf(snap.session.phase) > window.FLCalc.PHASES.indexOf('market') || snap.session.params.market_published === true; };
  FL.marketWaiting = function () { return '<div class="card market-wait stack center">' + FL.factory('unk', 0) + '<h2>' + FL.t('market_wait') + '</h2><p>' + FL.t('market_wait_p') + '</p></div>'; };
  FL.lessonHTML = function () {
    var snap = FL.snap(), par = snap.session.params, sample = null;
    FL.active(snap).some(function (tm) {
      var plan = C.bestPlan(C.trialPoints(snap.runs, tm.id), par.p, par.w);
      if (plan.G > 0 && plan.G < par.F) { sample = { team: tm, plan: plan }; return true; }
      return false;
    });
    return '<div class="lesson stack"><h3>' + FL.t('lesson_title') + '</h3><div class="small">' + FL.t('lesson_rule') + '</div>' +
      '<div class="banner">0 &lt; G &lt; F → ' + FL.t('s_open_then_exit') + '</div>' +
      '<div class="small">' + FL.t('lesson_explain') + '</div>' +
      (sample ? '<div class="small"><b>' + FL.esc(sample.team.name) + '</b> · G=' + FL.n2(sample.plan.G) + ', F=' + par.F + '<br>' + FL.t('lesson_example', FL.sg(sample.plan.G - par.F), FL.sg(-par.F)) + '</div>' : '') +
      '<div class="tiny muted">' + FL.t('lesson_boundary') + '</div></div>';
  };

  /* ------------------------------------------------ factory icon (shape + text carry meaning, not colour) */
  // state: idle | open | stop | exit | unk ; L = lit windows (0–4). Pure SVG, animated by CSS.
  FL.factory = function (state, L, opts) {
    opts = opts || {};
    var lit = state === 'open' ? (L || 0) : 0, wins = '', i;
    var paper = state === 'exit' ? '#ece6da' : '#fffdf8';
    for (i = 0; i < 4; i++) {
      var x = 17 + i * 22, on = i < lit;
      wins += '<rect class="win' + (on ? ' on' : '') + '" x="' + x + '" y="60" width="16" height="17" rx="2.5" stroke="var(--ink)" stroke-width="3" fill="' +
        (on ? 'var(--accent)' : state === 'stop' ? '#d9d2c4' : '#fff') + '" style="--wi:' + i + '"/>' +
        (on ? '<rect class="glint" x="' + (x + 3) + '" y="63" width="4" height="6" rx="1" fill="#fff" opacity=".55"/>' : '');
    }
    var body = '<path d="M10 52 L10 98 L110 98 L110 52 L82 38 L82 52 L60 38 L60 52 L38 38 L38 52 Z" fill="' + paper + '" stroke="var(--ink)" stroke-width="3.5" stroke-linejoin="round"/>';
    var chimney = '<rect x="23" y="20" width="12" height="32" fill="' + paper + '" stroke="var(--ink)" stroke-width="3"/><rect x="23" y="20" width="12" height="5" fill="var(--ink)"/>';
    var smoke = '<g class="smoke"><circle cx="29" cy="14" r="6"/><circle cx="29" cy="14" r="5"/><circle cx="29" cy="14" r="7"/></g>';
    var ground = '<line x1="4" y1="100" x2="116" y2="100" stroke="var(--ink)" stroke-width="3" stroke-linecap="round"/>';
    var belt = state === 'open' ? '<line class="belt" x1="14" y1="104" x2="106" y2="104" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" stroke-dasharray="6 5"/>' : '';
    var door = state === 'stop' ? '<rect x="50" y="82" width="20" height="16" fill="var(--ink)"/><line x1="50" y1="87" x2="70" y2="87" stroke="#fffdf8" stroke-width="1.5"/><line x1="50" y1="92" x2="70" y2="92" stroke="#fffdf8" stroke-width="1.5"/>' :
      state === 'exit' ? '' : '<rect x="50" y="82" width="20" height="16" fill="none" stroke="var(--ink)" stroke-width="3"/>';
    var shutter = '';
    if (state === 'exit') {
      shutter = '<g class="shutter"><rect x="14" y="56" width="92" height="42" fill="#cfc7b8" stroke="var(--ink)" stroke-width="3"/>';
      for (i = 0; i < 6; i++) shutter += '<line x1="14" y1="' + (62 + i * 6) + '" x2="106" y2="' + (62 + i * 6) + '" stroke="var(--ink)" stroke-width="1.6" opacity=".55"/>';
      shutter += '</g><g class="lease-sign"><line x1="48" y1="42" x2="52" y2="54" stroke="var(--ink)" stroke-width="2"/><line x1="72" y1="42" x2="68" y2="54" stroke="var(--ink)" stroke-width="2"/>' +
        '<rect x="40" y="52" width="40" height="16" rx="2" fill="var(--accent)" stroke="var(--ink)" stroke-width="2.5"/><text x="60" y="64" text-anchor="middle" font-size="10.5" font-weight="900" fill="#fff">' + FL.esc(FL.t('exit_sign')) + '</text></g>';
    }
    var q = state === 'unk' ? '<g class="qmark"><circle cx="92" cy="26" r="13" fill="var(--ink)"/><text x="92" y="32" text-anchor="middle" font-size="18" font-weight="900" fill="#fff">?</text></g>' : '';
    return '<svg class="fac ' + state + '" viewBox="0 0 120 110" role="img" aria-label="' + FL.esc(opts.label || '') + '">' +
      (state === 'open' ? smoke : '') + chimney + body + (state === 'exit' ? '' : wins) + door + shutter + q + ground + belt + '</svg>';
  };

  /* ------------------------------------------------ shift / countdown */
  // shift = {phase, id, starts_at, ends_at, secs, L}; valid only for the phase it was started in.
  FL.shiftOf = function (snap) {
    var s = snap.session.shift;
    if (!s || !s.id || s.phase !== snap.session.phase) return null;
    return s;
  };
  FL.shiftState = function (s) {
    if (!s) return { st: 'idle', n: '', left: 0 };
    var now = FL.store.serverNow();
    if (now < s.starts_at) return { st: 'pre', n: Math.ceil((s.starts_at - now) / 1000), left: s.secs };
    if (now < s.ends_at) return { st: 'run', n: Math.ceil((s.ends_at - now) / 1000), left: Math.ceil((s.ends_at - now) / 1000) };
    return { st: 'done', n: 0, left: 0 };
  };
  FL.cdHTML = function (snap, bigClass) {
    var s = FL.shiftOf(snap);
    var st = FL.shiftState(s);
    return '<div class="cd ' + st.st + ' ' + (bigClass || '') + '" data-cd="1"><div class="n"></div><div class="l"></div></div>';
  };
  var lastBeep = '';
  FL.tick = function () {
    var snap = FL.snap(); if (!snap) return;
    var s = FL.shiftOf(snap), st = FL.shiftState(s);
    var stage = FL.$('.shift-stage');
    if (stage) { stage.classList.toggle('is-running', st.st === 'run'); stage.classList.toggle('is-final', st.st === 'run' && st.n <= 3); }
    FL.$$('[data-cd]').forEach(function (box) {
      box.className = box.className.replace(/\b(idle|pre|run|done)\b/, st.st);
      var n = box.firstChild, l = box.lastChild;
      var txt = st.st === 'idle' ? FL.t(box.closest('.shift-stage') ? 'waiting_teacher' : 'cd_idle') : st.st === 'pre' ? String(st.n) : st.st === 'run' ? String(st.n) : FL.t('cd_done');
      var lab = st.st === 'pre' ? FL.t('cd_pre') : st.st === 'run' ? FL.t('cd_run') : st.st === 'done' ? FL.t('cd_done_l') : '';
      if (n.textContent !== txt) n.textContent = txt;
      if (l.textContent !== lab) l.textContent = lab;
    });
    // audio cues on the projector only
    if (FL.soundOn && s && FL.route().role === 'screen') {
      var key = s.id + ':' + st.st + ':' + st.n;
      if (key !== lastBeep) {
        lastBeep = key;
        if (FL.sfx) FL.sfx.shift(st, s);
      }
    }
    // let the view react when a shift changes state (e.g. open verification panel)
    var sig = s ? s.id + ':' + st.st : 'none';
    if (sig !== FL._shiftSig) { FL._shiftSig = sig; if (FL.onShiftState) FL.onShiftState(st); }
  };
  setInterval(function () { FL.tick(); }, 200);

  /* ------------------------------------------------ audio (needs a user gesture to enable) */
  var ac = null;
  FL.enableSound = function () {
    try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); FL.soundOn = true; FL.beep(880, 0.15); } catch (e) { FL.soundOn = false; }
    FL.render(true);
  };
  FL.beep = function (freq, dur) {
    if (!ac) return;
    try {
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = freq; g.gain.value = 0.0001;
      o.connect(g); g.connect(ac.destination);
      var t = ac.currentTime; g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t); o.stop(t + dur + 0.05);
    } catch (e) { /* ignore */ }
  };

  /* ------------------------------------------------ QR (optional, CDN) */
  FL.qrSVG = function (text) {
    try {
      var q = window.qrcode(0, 'M'); q.addData(text); q.make();
      var n = q.getModuleCount(), p = [], r, k;
      for (r = 0; r < n; r++) for (k = 0; k < n; k++) if (q.isDark(r, k)) p.push('M' + k + ' ' + r + 'h1v1h-1z');
      return '<svg viewBox="-2 -2 ' + (n + 4) + ' ' + (n + 4) + '" shape-rendering="crispEdges" role="img" aria-label="QR"><path fill="#1c1917" d="' + p.join('') + '"/></svg>';
    } catch (err) { return ''; }
  };

  /* ------------------------------------------------ routing */
  FL.route = function () {
    var h = (location.hash || '#/').replace(/^#\/?/, '').split('/');
    return { role: h[0] || 'home', code: (h[1] || '').toUpperCase() };
  };
  FL.go = function (hash) { location.hash = hash; };
  FL.baseURL = function () { return location.href.split('#')[0].split('?')[0]; };

  /* ------------------------------------------------ rendering with focus protection */
  var pending = null;
  FL.render = function (force) {
    var ae = document.activeElement;
    var typing = ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && FL.$('#app') && FL.$('#app').contains(ae);
    var r = FL.route();
    var view = FL.views && FL.views[r.role] || FL.views.home;
    if (typing && !force) {
      if (view.update) view.update(r);
      clearTimeout(pending); pending = setTimeout(function () { FL.render(false); }, 900); return;
    }
    document.body.className = r.role === 'screen' ? 'screen' : '';
    var app = FL.$('#app');
    var y = window.scrollY;
    app.innerHTML = view(r);
    if (view.after) view.after(r);
    window.scrollTo(0, y);
    FL.tick();
  };
  FL.store.on(function () { FL.render(false); });
  window.addEventListener('hashchange', function () { FL.boot(); });
})();
