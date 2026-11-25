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
  FL.lang = FL.ls.get('fl_lang') || ((navigator.language || '').toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en');
  FL.t = function (key) {
    var d = FL.dict[key];
    if (!d) { return '⟦' + key + '⟧'; }
    var s = d[FL.lang] != null ? d[FL.lang] : d.zh;
    for (var i = 1; i < arguments.length; i++) s = s.split('{' + (i - 1) + '}').join(arguments[i]);
    return s;
  };
  FL.setLang = function (l) { FL.lang = l; FL.ls.set('fl_lang', l); document.documentElement.lang = l === 'zh' ? 'zh-Hant' : 'en'; FL.render(true); };

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
  // state: open | stop | exit | unk ; L = lit windows (0–4)
  FL.factory = function (state, L, opts) {
    opts = opts || {};
    var lit = state === 'open' ? L : 0, wins = '';
    for (var i = 0; i < 4; i++) {
      var x = 18 + i * 22, on = i < lit;
      wins += '<rect x="' + x + '" y="62" width="16" height="18" rx="3" fill="' + (on ? 'var(--accent)' : '#fff') + '" stroke="var(--ink)" stroke-width="3"/>';
    }
    var cross = state === 'exit' ? '<path d="M14 54 L106 98 M106 54 L14 98" stroke="var(--ink)" stroke-width="5" stroke-linecap="round"/>' : '';
    var q = state === 'unk' ? '<text x="60" y="93" text-anchor="middle" font-size="38" font-weight="900" fill="var(--muted)">?</text>' : '';
    var door = state === 'stop' ? '<rect x="48" y="84" width="24" height="16" fill="var(--ink)"/>' : '';
    var fill = state === 'exit' ? 'var(--soft)' : '#fff';
    var dash = state === 'exit' ? ' stroke-dasharray="7 5"' : '';
    return '<svg class="fac ' + state + '" viewBox="0 0 120 108" role="img" aria-label="' + FL.esc(opts.label || '') + '">' +
      '<g class="smoke"><circle cx="30" cy="22" r="6"/><circle cx="30" cy="22" r="6"/><circle cx="30" cy="22" r="6"/></g>' +
      '<rect x="24" y="24" width="12" height="30" fill="' + fill + '" stroke="var(--ink)" stroke-width="3"' + dash + '/>' +
      '<path d="M10 54 L10 100 L110 100 L110 54 L82 40 L82 54 L60 40 L60 54 L38 40 L38 54 Z" fill="' + fill + '" stroke="var(--ink)" stroke-width="3.5" stroke-linejoin="round"' + dash + '/>' +
      (state === 'exit' || state === 'unk' ? '' : wins) + door + cross + q + '</svg>';
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
      var txt = st.st === 'idle' ? FL.t('cd_idle') : st.st === 'pre' ? String(st.n) : st.st === 'run' ? String(st.n) : FL.t('cd_done');
      var lab = st.st === 'pre' ? FL.t('cd_pre') : st.st === 'run' ? FL.t('cd_run') : st.st === 'done' ? FL.t('cd_done_l') : '';
      if (n.textContent !== txt) n.textContent = txt;
      if (l.textContent !== lab) l.textContent = lab;
    });
    // audio cues on the projector only
    if (FL.soundOn && s) {
      var key = s.id + ':' + st.st + ':' + st.n;
      if (key !== lastBeep) {
        lastBeep = key;
        if (st.st === 'pre') FL.beep(660, 0.12);
        else if (st.st === 'run' && st.n === s.secs) FL.beep(990, 0.45);
        else if (st.st === 'run' && st.n <= 3) FL.beep(660, 0.1);
        else if (st.st === 'done') FL.beep(440, 0.7);
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
    if (typing && !force) { clearTimeout(pending); pending = setTimeout(function () { FL.render(false); }, 900); return; }
    var r = FL.route();
    var view = FL.views && FL.views[r.role] || FL.views.home;
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
