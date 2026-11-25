/* Factory LIVE — teacher / TA console + rehearsal bots. */
(function () {
  'use strict';
  var FL = window.FL, C = window.FLCalc, t = FL.t, esc = FL.esc, sg = FL.sg;
  var PH = C.PHASES;
  var H = FL.H = { tab: 'control', trialL: 1, armed: null, csv: '' };

  function loadHost() { try { return JSON.parse(FL.ls.get('fl_host') || 'null'); } catch (e) { return null; } }
  FL.host = loadHost();

  /* ------------------------------------------------ login / create */
  function login() {
    return '<div class="app"><div class="topbar"><a class="btn sm ghost" href="#/" aria-label="' + t('back_home') + '">←</a><div class="brand"><i></i>' + t('app_title') + '</div><div class="grow"></div><button class="btn sm ghost" data-act="lang">' + (FL.lang === 'zh' ? 'EN' : '中') + '</button></div>' +
      (FL.useLocal ? '<div class="banner warn small" style="margin-bottom:12px">' + t('local_banner') + '</div>' : '') +
      '<div class="stack"><div class="card stack"><h2>' + t('h_create') + '</h2><div class="muted small">' + t('h_create_p') + '</div>' +
      '<label class="field"><span>' + t('h_key') + '</span><input id="h_key" type="password" autocomplete="new-password" placeholder="' + t('h_key_ph') + '"></label>' +
      '<button class="btn primary block" data-act="hcreate">' + t('h_create_btn') + '</button></div>' +
      '<div class="card stack"><h2>' + t('h_resume') + '</h2>' +
      '<label class="field"><span>' + t('room_code') + '</span><input id="h_code" type="text" maxlength="4" style="text-transform:uppercase"></label>' +
      '<label class="field"><span>' + t('h_key') + '</span><input id="h_key2" type="password" autocomplete="current-password"></label>' +
      '<button class="btn block" data-act="hresume">' + t('h_resume_btn') + '</button></div></div></div>';
  }
  FL.acts.hcreate = function () {
    var key = FL.$('#h_key').value;
    return FL.api.create(key).then(function (code) { setHost(code, key); }).catch(function (e) { FL.showError(e); });
  };
  FL.acts.hresume = function () {
    var code = FL.$('#h_code').value.toUpperCase().trim(), key = FL.$('#h_key2').value;
    return FL.api.snapshot(code).then(function (s) {
      if (!s) return FL.toast(t('err_no_session'));
      return FL.api.hostSet(code, key, {}).then(function () { setHost(code, key); });
    }).catch(function (e) { FL.showError(e); });
  };
  function setHost(code, key) { H.csv = ''; H.tab = 'control'; H.armed = null; FL.host = { code: code, key: key }; FL.ls.set('fl_host', JSON.stringify(FL.host)); FL.go('#/host/' + code); FL.boot(); }
  FL.acts.hlogout = function () { FL.ls.del('fl_host'); FL.host = null; FL.store.stop(); FL.go('#/host'); FL.render(true); };

  /* ------------------------------------------------ helpers */
  var hc = function () { return FL.host.code; }, hk = function () { return FL.host.key; };
  var hostQueue = Promise.resolve();
  function patch(p) { var code = hc(), key = hk(); hostQueue = hostQueue.catch(function () {}).then(function () { return FL.api.hostSet(code, key, p); }); return FL.run(hostQueue); }
  function twice(el, msg) { // two-step confirmation without browser dialogs
    if (el.dataset.armed) { return true; }
    el.dataset.armed = '1'; var old = el.innerHTML; el.innerHTML = msg; el.classList.add('dark');
    setTimeout(function () { if (el.isConnected) { el.innerHTML = old; el.classList.remove('dark'); delete el.dataset.armed; } }, 3500);
    return false;
  }
  function pending(snap) { // who has not locked / reported
    var ph = snap.session.phase, act = FL.active(snap), out = [];
    if (ph === 'decide1' || ph === 'decide2') {
      var per = ph === 'decide1' ? 1 : 2;
      act.forEach(function (tm) { if (!snap.locked.some(function (x) { return x.team_id === tm.id && x.period === per; })) out.push(tm); });
    } else if (ph === 'trial') {
      var sh = FL.shiftOf(snap);
      if (sh) act.forEach(function (tm) { if (tm.present >= sh.L && !snap.runs.some(function (r) { return r.team_id === tm.id && r.kind === 'trial' && r.L === sh.L && r.status !== 'disputed' && r.status !== 'reported'; })) out.push(tm); });
    } else if (ph === 'run1' || ph === 'run2') {
      var per2 = ph === 'run1' ? 1 : 2, kind = ph === 'run1' ? 'p1' : 'p2';
      act.forEach(function (tm) {
        var d = C.decisionOf(snap.decisions, tm.id, per2);
        if (!d || (d.renew && d.L > 0 && !snap.runs.some(function (r) { return r.team_id === tm.id && r.kind === kind && r.L === d.L && (r.status === 'confirmed' || r.status === 'host'); }))) out.push(tm);
      });
    }
    return out;
  }

  /* ------------------------------------------------ main */
  FL.views.host = function (r) {
    if (!FL.host) return login();
    var snap = FL.snap();
    if (!snap) return '<div class="app"><div class="card center">' + t('loading') + '</div><div class="center" style="margin-top:14px"><button class="btn ghost" data-act="hlogout">' + t('leave') + '</button></div></div>';
    var ph = snap.session.phase, i = PH.indexOf(ph);
    var phasebar = '<div class="phasebar">' + PH.map(function (p, k) { return '<span class="ph ' + (k === i ? 'on' : '') + '">' + t('ph_' + p) + '</span>'; }).join('') + '</div>';
    var nav = '<div class="row wrap"><button class="btn" data-act="hprev"' + (i === 0 ? ' disabled' : '') + '>← ' + t('prev') + '</button>' +
      '<button class="btn primary" data-act="hnext"' + (i === PH.length - 1 ? ' disabled' : '') + '>' + (i < PH.length - 1 ? t('next_to', t('ph_' + PH[i + 1])) : t('end')) + ' →</button></div>';
    var tabs = ['control', 'teams', 'params', 'tools'].map(function (k) { return '<button class="btn ' + (H.tab === k ? 'on' : '') + '" data-act="htab" data-tab="' + k + '">' + t('tab_' + k) + '</button>'; }).join('');
    var body = H.tab === 'teams' ? teamsTab(snap) : H.tab === 'params' ? paramsTab(snap) : H.tab === 'tools' ? toolsTab(snap) : controlTab(snap);
    var joinURL = FL.baseURL() + '#/team/' + hc(), screenURL = FL.baseURL() + '#/screen/' + hc();
    return '<div class="app wide"><div class="topbar"><a class="btn sm ghost" href="#/" aria-label="' + t('back_home') + '">←</a><div class="brand"><i></i>' + t('app_title') + ' · ' + t('h_console') + '</div><div class="grow"></div>' +
      (FL.useLocal ? '<span class="pill">' + t('demo_mode') + '</span>' : '') + '<span class="pill solid">' + t('room_code') + ' ' + esc(hc()) + '</span>' +
      '<button class="btn sm ghost" data-act="lang">' + (FL.lang === 'zh' ? 'EN' : '中') + '</button><button class="btn sm ghost" data-act="hlogout">' + t('leave') + '</button></div>' +
      (FL.store.online ? '' : '<div class="banner warn" role="alert" style="margin-bottom:10px">' + t('offline') + '</div>') +
      '<div class="stack">' + phasebar + nav + '<div class="hostgrid"><div class="stack" style="min-width:0"><div class="tabs">' + tabs + '</div>' + body + '</div>' +
      '<div class="stack"><div class="card stack"><h3>' + t('links_h') + '</h3>' +
      '<div class="small"><b>' + t('link_join') + '</b><br><span style="word-break:break-all">' + esc(joinURL) + '</span></div>' +
      '<div class="small"><b>' + t('link_screen') + '</b><br><a href="' + esc(screenURL) + '" target="_blank" rel="noopener" style="word-break:break-all">' + esc(screenURL) + '</a></div>' +
      '<div class="row wrap"><button class="btn sm" data-act="copy" data-text="' + esc(joinURL) + '">' + t('copy_join') + '</button><a class="btn sm" href="' + esc(screenURL) + '" target="_blank" rel="noopener">' + t('open_screen') + '</a></div></div>' +
      '<div class="card"><h3>' + t('class_h') + '</h3>' + classStats(snap) + '</div></div></div></div></div>';
  };
  function classStats(snap) {
    var act = FL.active(snap), people = act.reduce(function (s, x) { return s + x.present; }, 0), p = pending(snap);
    return '<div class="small">' + t('stats_teams', act.length, people) + '</div>' + (p.length ? '<div class="small" style="margin-top:6px"><b>' + t('waiting_for') + '</b> ' + p.map(function (x) { return esc(x.name); }).join('、') + '</div>' : '');
  }
  FL.acts.htab = function (el) { H.tab = el.dataset.tab; FL.render(true); };
  FL.acts.copy = function (el) { try { navigator.clipboard.writeText(el.dataset.text).then(function () { FL.toast(t('copied')); }, function () { FL.toast(el.dataset.text); }); } catch (e) { FL.toast(el.dataset.text); } };

  /* ------------------------------------------------ phase navigation */
  function go(i, el) {
    var snap = FL.snap(), ph = snap.session.phase, cur = PH.indexOf(ph), nxt = PH[i];
    var p = pending(snap);
    if (i > cur && p.length && /^(decide|run|trial)/.test(ph) && el && !twice(el, t('confirm_skip', p.length))) return;
    if (ph === 'market' && nxt === 'decide1' && !FL.marketPublished(snap)) return FL.toast(t('publish_first'));
    return patch({ phase: nxt, reveal: C.revealFor(nxt), shift: {} });
  }
  FL.acts.hnext = function (el) { return go(PH.indexOf(FL.snap().session.phase) + 1, el); };
  FL.acts.hprev = function () { return go(PH.indexOf(FL.snap().session.phase) - 1, null); };

  /* ------------------------------------------------ control tab */
  function startShiftBtn(snap, L) {
    var sh = FL.shiftOf(snap), st = FL.shiftState(sh), secs = snap.session.params.secs;
    return '<div class="row wrap"><button class="btn primary" data-act="hshift" data-lv="' + (L || 0) + '">' + (st.st === 'idle' || st.st === 'done' ? t('start_shift', secs) : t('restart_shift')) + '</button>' +
      (sh ? '<button class="btn" data-act="hclear">' + t('clear_shift') + '</button>' : '') + '</div>' + FL.cdHTML(snap);
  }
  FL.acts.hshift = function (el) {
    var snap = FL.snap(), secs = snap.session.params.secs, now = FL.store.serverNow();
    var shift = { phase: snap.session.phase, id: now, starts_at: now + 4000, ends_at: now + 4000 + secs * 1000, secs: secs };
    if (snap.session.phase === 'trial') shift.L = H.trialL;
    patch({ shift: shift });
  };
  FL.acts.hclear = function () { patch({ shift: {} }); };
  FL.acts.htrialL = function (el) { H.trialL = +el.dataset.lv; FL.render(true); };

  function controlTab(snap) {
    var ph = snap.session.phase, par = snap.session.params, out = '';
    var tip = '<div class="card accent"><div style="font-weight:800">' + t('tip_' + ph) + '</div></div>';
    if (ph === 'lobby') {
      out = tip + '<div class="card stack"><h3>' + t('teams_in') + '</h3>' + teamList(snap) + '</div>';
    } else if (ph === 'trial') {
      var done = {}; for (var L = 1; L <= 4; L++) done[L] = snap.runs.filter(function (r) { return r.kind === 'trial' && r.L === L && (r.status === 'confirmed' || r.status === 'host'); }).length;
      var seg = [1, 2, 3, 4].map(function (l) { return '<button class="btn ' + (H.trialL === l ? 'on acc' : '') + '" data-act="htrialL" data-lv="' + l + '">' + l + '<small>' + t('done_n', done[l]) + '</small></button>'; }).join('');
      out = tip + '<div class="card stack"><h3>' + t('trial_pick') + '</h3><div class="seg" style="grid-template-columns:repeat(4,1fr)">' + seg + '</div>' + startShiftBtn(snap, H.trialL) + '</div>' + pendingCard(snap);
    } else if (ph === 'market') {
      out = tip + '<div class="card stack"><h3>' + t('tab_params') + '</h3>' + paramForm(snap) + '<div class="banner">' + t(par.market_published ? 'market_live' : 'market_private') + '</div><button class="btn primary block" data-act="hpublish">' + t(par.market_published ? 'market_republish' : 'market_publish') + '</button></div>' + recommendCard(snap);
    } else if (ph === 'decide1' || ph === 'decide2') {
      out = tip + pendingCard(snap, true);
    } else if (ph === 'run1' || ph === 'run2') {
      out = tip + '<div class="card stack"><h3>' + t('run_shift') + '</h3>' + startShiftBtn(snap) + '</div>' + pendingCard(snap) + disputeCard(snap);
    } else if (ph === 'ledger1' || ph === 'ledger2') {
      var per = ph === 'ledger1' ? 1 : 2, opts = '<option value="">' + t('auto_pick') + '</option>' + FL.active(snap).map(function (tm) {
        var l = C.ledger(tm, snap), P = l.periods[per], mark = per === 1 ? (P.complete ? sg(P.profit) : '') : (l.openThenExit ? '★ ' : '') + (P.complete ? sg(P.profit) : '');
        return '<option value="' + tm.id + '"' + (par.featured === tm.id ? ' selected' : '') + '>' + esc(tm.name) + ' ' + mark + '</option>';
      }).join('');
      out = tip + '<div class="card stack"><h3>' + t('feat_h') + '</h3><select data-change="hfeat">' + opts + '</select><div class="tiny muted">' + t('feat_note') + '</div></div>' + disputeCard(snap);
    } else {
      out = tip + '<div class="card stack"><button class="btn" data-act="hlesson">' + t(par.show_lesson ? 'lesson_hide' : 'lesson_show') + '</button><button class="btn primary" data-act="hexport">' + t('export_csv') + '</button></div>';
    }
    return out;
  }
  function teamList(snap) {
    var l = FL.active(snap); if (!l.length) return '<div class="muted">' + t('none_yet') + '</div>';
    return '<div class="row wrap">' + l.map(function (tm) { return '<span class="chip">' + tm.table_no + ' · ' + esc(tm.name) + ' · ' + tm.present + '</span>'; }).join('') + '</div>';
  }
  function pendingCard(snap, canDecide) {
    var p = pending(snap), ph = snap.session.phase;
    if (ph === 'trial' && !FL.shiftOf(snap)) return '<div class="card muted">' + t('trial_wait_s') + '</div>';
    if (!p.length) {
      var count = FL.active(snap).filter(function (tm) { var d = C.decisionOf(snap.decisions, tm.id, ph === 'run1' ? 1 : 2); return d && d.renew && d.L > 0; }).length;
      return '<div class="card"><span class="chip ok">✓</span> ' + t(/^run/.test(ph) ? (count ? 'all_verified' : 'no_producing') : 'all_in') + '</div>';
    }
    var rows = p.map(function (tm) {
      var extra = '';
      if (canDecide || (/^run/.test(ph) && !C.decisionOf(snap.decisions, tm.id, ph === 'run1' ? 1 : 2))) {
        var per = ph === 'decide1' || ph === 'run1' ? 1 : 2, Lopts = ''; for (var l = 0; l <= tm.present; l++) Lopts += '<option value="' + l + '">' + l + '</option>';
        extra = '<select class="inl" id="hd_L_' + tm.id + '">' + Lopts + '</select>' + (per === 2 ? '<select class="inl" style="width:110px" id="hd_R_' + tm.id + '"><option value="1">' + t('renew') + '</option><option value="0">' + t('exit') + '</option></select>' : '') +
          '<button class="btn sm" data-act="hdecide" data-team="' + tm.id + '" data-per="' + per + '">' + t('enter_for') + '</button>';
        if (!canDecide) extra = '<span class="chip bad">' + t('no_dec_short') + '</span>' + extra;
      } else if (/^run/.test(ph)) {
        var per2 = ph === 'run1' ? 1 : 2, d = C.decisionOf(snap.decisions, tm.id, per2);
        extra = '<input class="inl" type="number" min="0" max="300" id="hq_' + tm.id + '" placeholder="q"><button class="btn sm" data-act="hq" data-team="' + tm.id + '" data-kind="' + (per2 === 1 ? 'p1' : 'p2') + '" data-lv="' + d.L + '">' + t('enter_for') + '</button>';
      } else if (ph === 'trial') {
        var sh = FL.shiftOf(snap);
        extra = '<input class="inl" type="number" min="0" max="300" id="hq_' + tm.id + '" placeholder="q"><button class="btn sm" data-act="hq" data-team="' + tm.id + '" data-kind="trial" data-lv="' + sh.L + '">' + t('enter_for') + '</button>';
      }
      return '<div class="row wrap"><div class="grow"><b>' + esc(tm.name) + '</b> <span class="muted small">' + t('table_n', tm.table_no) + '</span></div>' + extra + '</div>';
    }).join('');
    return '<div class="card stack"><h3>' + t('waiting_for') + ' (' + p.length + ')</h3>' + rows + '</div>';
  }
  FL.acts.hdecide = function (el) {
    var id = el.dataset.team, per = +el.dataset.per, L = +FL.$('#hd_L_' + id).value, rn = per === 1 ? true : FL.$('#hd_R_' + id).value === '1';
    return FL.run(FL.api.hostDecide(hc(), hk(), id, per, rn, L, null), t('toast_saved'));
  };
  FL.acts.hq = function (el) {
    var v = FL.$('#hq_' + el.dataset.team).value; if (v === '') return;
    return FL.run(FL.api.hostRun(hc(), hk(), el.dataset.team, el.dataset.kind, +el.dataset.lv, +v), t('toast_saved'));
  };
  FL.acts.hfeat = function (el) { patch({ params: { featured: el.value || null } }); };
  FL.acts.hlesson = function () { return patch({ params: { show_lesson: !FL.snap().session.params.show_lesson } }); };
  FL.changes = FL.changes || {};
  FL.changes.hfeat = FL.acts.hfeat;

  function disputeCard(snap) {
    var d = snap.runs.filter(function (r) { return r.status === 'disputed'; });
    if (!d.length) return '';
    return '<div class="card stack"><h3>' + t('disputes_h') + '</h3>' + d.map(function (r) {
      var tm = FL.team(snap, r.team_id); if (!tm) return '';
      return '<div class="row wrap"><div class="grow"><b>' + esc(tm.name) + '</b> · ' + r.kind + ' L=' + r.L + ' · ' + t('reported_n', r.q) + '</div>' +
        '<input class="inl" type="number" min="0" max="300" id="hq_' + r.team_id + '_' + r.kind + '" value="' + r.q + '"><button class="btn sm primary" data-act="hq2" data-team="' + r.team_id + '" data-kind="' + r.kind + '" data-lv="' + r.L + '">' + t('set_final') + '</button></div>';
    }).join('') + '</div>';
  }
  FL.acts.hq2 = function (el) { var v = FL.$('#hq_' + el.dataset.team + '_' + el.dataset.kind).value; FL.run(FL.api.hostRun(hc(), hk(), el.dataset.team, el.dataset.kind, +el.dataset.lv, +v), t('toast_saved')); };

  /* ------------------------------------------------ params + recommender */
  function paramForm(snap) {
    var par = snap.session.params, locked = /^(decide|run|ledger|debrief)/.test(snap.session.phase);
    var f = function (k, lab, v, hi) { return '<label class="field"><span>' + lab + '</span><input class="" type="number" min="1" max="' + hi + '" value="' + v + '" data-change="hparam" data-k="' + k + '"' + (locked ? ' disabled' : '') + '></label>'; };
    return '<div class="row wrap" style="align-items:flex-end">' + f('p', t('p_name'), par.p, 50) + f('w', t('w_name'), par.w, 100) + f('F', t('f_name'), par.F, 300) + f('secs', t('secs_name'), par.secs, 90) + '</div>' + (locked ? '<div class="tiny muted">' + t('params_locked') + '</div>' : '');
  }
  FL.acts.hparam = function (el) { var v = Math.max(1, Math.round(+el.value || 1)); var o = { market_published: false }; o[el.dataset.k] = v; return patch({ params: o }); };
  FL.changes.hparam = FL.acts.hparam;

  function allPoints(snap) { return FL.active(snap).map(function (tm) { return C.trialPoints(snap.runs, tm.id); }); }
  function recommendCard(snap) {
    var recs = C.recommend(allPoints(snap)), par = snap.session.params;
    var rows = recs.length ? recs.map(function (r) {
      return '<div class="row wrap"><div class="grow"><b>p=' + r.p + ' · w=' + r.w + ' · F=' + r.F + '</b><div class="tiny muted">' + t('rec_line', r.aha, r.n, r.above, r.zero) + '</div></div>' +
        '<button class="btn sm primary" data-act="hrec" data-p="' + r.p + '" data-w="' + r.w + '" data-f="' + r.F + '"' + (/^(decide|run|ledger|debrief)/.test(snap.session.phase) ? ' disabled' : '') + '>' + t('apply') + '</button></div>';
    }).join('') : '<div class="muted small">' + t('rec_need') + '</div>';
    return '<div class="card stack"><h3>' + t('rec_h') + '</h3><div class="tiny muted">' + t('rec_note') + '</div>' + rows + '</div>' + gTable(snap, par);
  }
  FL.acts.hrec = function (el) { return patch({ params: { p: +el.dataset.p, w: +el.dataset.w, F: +el.dataset.f, market_published: false } }); };
  FL.acts.hpublish = function () {
    var par = {}, fields = FL.$$('[data-change="hparam"]');
    fields.forEach(function (el) { par[el.dataset.k] = Math.max(1, Math.round(+el.value || 1)); });
    par.market_published = true;
    return patch({ params: par });
  };
  function gTable(snap, par) {
    var act = FL.active(snap), aha = 0, ren = 0, zero = 0, rows = act.map(function (tm) {
      var pts = C.trialPoints(snap.runs, tm.id); if (Object.keys(pts).length < 1) return '';
      var bp = C.bestPlan(pts, par.p, par.w), cls;
      if (bp.G <= 0) { cls = t('cls_stop'); zero++; } else if (bp.G < par.F) { cls = t('cls_aha'); aha++; } else { cls = t('cls_renew'); ren++; }
      return '<tr><td>' + esc(tm.name) + '</td><td>' + bp.L + '</td><td class="sign">' + sg(bp.G) + '</td><td>' + sg(bp.G - par.F) + '</td><td>' + cls + '</td></tr>';
    }).join('');
    if (!rows) return '';
    return '<div class="card stack"><h3>' + t('g_h', par.p, par.w, par.F) + '</h3><div class="small">' + t('g_summary', aha, ren, zero) + '</div><table class="t compact"><tr><th></th><th>L*</th><th>G</th><th>G−F</th><th></th></tr>' + rows + '</table></div>';
  }
  function paramsTab(snap) { return '<div class="card stack"><h3>' + t('tab_params') + '</h3>' + paramForm(snap) + '</div>' + recommendCard(snap); }

  /* ------------------------------------------------ teams tab */
  function numInput(snap, tm, kind, L, run) {
    return '<input class="inl" type="number" min="0" max="300" value="' + (run ? run.q : '') + '" data-change="hnum" data-team="' + tm.id + '" data-kind="' + kind + '" data-lv="' + L + '" aria-label="' + kind + ' ' + L + '">' +
      (run ? (run.status === 'disputed' ? ' <span class="chip bad">!</span>' : run.status === 'reported' ? ' <span class="chip">?</span>' : '') : '');
  }
  FL.acts.hnum = function (el) {
    var v = el.value === '' ? null : Math.max(0, Math.round(+el.value));
    return FL.saveField(el, FL.api.hostRun(hc(), hk(), el.dataset.team, el.dataset.kind, +el.dataset.lv, v));
  };
  FL.changes.hnum = FL.acts.hnum;
  FL.acts.hk = function (el) { return FL.saveField(el, FL.api.hostTeam(hc(), hk(), el.dataset.team, { present: Math.max(0, Math.min(4, Math.round(+el.value || 0))) })); };
  FL.changes.hk = FL.acts.hk;
  FL.acts.hdel = function (el) { if (!twice(el, t('sure'))) return; FL.run(FL.api.hostTeam(hc(), hk(), el.dataset.team, {}, true)); };

  function teamsTab(snap) {
    var rows = snap.teams.map(function (tm) {
      var cells = '';
      for (var L = 1; L <= 4; L++) cells += '<td>' + (L <= tm.present ? numInput(snap, tm, 'trial', L, snap.runs.filter(function (r) { return r.team_id === tm.id && r.kind === 'trial' && r.L === L; })[0]) : '') + '</td>';
      var prod = function (per) {
        var d = C.decisionOf(snap.decisions, tm.id, per); if (!d) return '<td>—</td>';
        if (!d.renew || d.L === 0) return '<td class="muted">' + (d.renew ? t('stop') : t('exit')) + '</td>';
        var kind = per === 1 ? 'p1' : 'p2';
        return '<td>' + d.L + '→ ' + numInput(snap, tm, kind, d.L, snap.runs.filter(function (r) { return r.team_id === tm.id && r.kind === kind; })[0]) + '</td>';
      };
      return '<tr><td>' + tm.table_no + '</td><td><b>' + esc(tm.name) + '</b></td><td><input class="inl" type="number" min="0" max="4" value="' + tm.present + '" data-change="hk" data-team="' + tm.id + '" style="width:60px"></td>' + cells + prod(1) + prod(2) +
        '<td><button class="btn sm ghost" data-act="hdel" data-team="' + tm.id + '">' + t('del') + '</button></td></tr>';
    }).join('');
    var summary = C.trialSummary(snap.runs, FL.active(snap)), stats = '';
    for (var k = 1; k <= 4; k++) if (summary.mean[k] != null) stats += '<tr><td>' + k + '</td><td>' + FL.n2(summary.mean[k]) + '</td><td>' + summary.counts[k] + '</td><td>' + sg(summary.marginal[k]) + '</td><td>' + summary.pairedCounts[k] + '</td></tr>';
    return '<div class="card" style="overflow-x:auto"><table class="t compact"><tr><th>#</th><th>' + t('team_name') + '</th><th>' + t('capacity') + '</th><th>L=1</th><th>L=2</th><th>L=3</th><th>L=4</th><th>' + t('period1') + '</th><th>' + t('period2') + '</th><th></th></tr>' + (rows || '<tr><td colspan="10" class="muted">' + t('none_yet') + '</td></tr>') + '</table><div class="tiny muted" style="margin-top:8px">' + t('teams_note') + '</div></div>' + (stats ? '<div class="card stack"><h3>' + t('teacher_trial_stats') + '</h3><table class="t compact"><tr><th>' + t('c_workers') + '</th><th>' + t('mean_q') + '</th><th>n</th><th>' + t('c_mp') + '</th><th>' + t('paired_n') + '</th></tr>' + stats + '</table><div class="small muted">' + t('paired_marginal_note') + '</div></div>' : '');
  }

  /* ------------------------------------------------ tools */
  function toolsTab(snap) {
    var bots = FL.bots.list().length;
    return '<div class="card stack"><h3>' + t('bots_h') + '</h3><div class="small muted">' + t('bots_p') + '</div><div class="row wrap">' +
      [4, 8, 12].map(function (n) { return '<button class="btn" data-act="hbots" data-n="' + n + '">+' + n + '</button>'; }).join('') +
      '<button class="btn ghost" data-act="hbotsclear"' + (bots ? '' : ' disabled') + '>' + t('bots_clear', bots) + '</button></div></div>' +
      '<div class="card stack"><h3>' + t('export_h') + '</h3><button class="btn" data-act="hexport">' + t('export_csv') + '</button>' + (H.csv ? '<textarea readonly rows="6" onclick="this.select()">' + esc(H.csv) + '</textarea>' : '') + '</div>' +
      '<div class="card stack"><h3>' + t('reset_h') + '</h3><div class="small muted">' + t('reset_p') + '</div><div class="row wrap">' +
      '<button class="btn" data-act="hreset" data-scope="trial">' + t('reset_trial') + '</button><button class="btn" data-act="hreset" data-scope="runs">' + t('reset_runs') + '</button><button class="btn" data-act="hreset" data-scope="all">' + t('reset_all') + '</button></div></div>';
  }
  FL.acts.hreset = function (el) { if (!twice(el, t('sure'))) return; FL.run(FL.api.hostReset(hc(), hk(), el.dataset.scope), t('toast_saved')); };
  FL.acts.hexport = function () {
    var snap = FL.snap(), par = snap.session.params, head = ['table', 'team', 'K', 'trial1', 'trial2', 'trial3', 'trial4', 'p', 'w', 'F', 'L1', 'q1', 'profit1', 'renew2', 'L2', 'q2', 'profit2', 'total', 'predict2'];
    var rows = snap.teams.map(function (tm) {
      var l = C.ledger(tm, snap), pts = l.points, P1 = l.periods[1], P2 = l.periods[2];
      return [tm.table_no, '"' + String(tm.name).replace(/"/g, '""') + '"', tm.present, pts[1] != null ? pts[1] : '', pts[2] != null ? pts[2] : '', pts[3] != null ? pts[3] : '', pts[4] != null ? pts[4] : '', par.p, par.w, par.F,
        P1.decided ? P1.L : '', P1.q != null ? P1.q : '', P1.complete ? P1.profit : '', P2.decided ? (P2.renew ? 1 : 0) : '', P2.decided ? P2.L : '', P2.q != null ? P2.q : '', P2.complete ? P2.profit : '', l.total == null ? '' : l.total, P2.predict != null ? P2.predict : ''].join(',');
    });
    H.csv = '﻿' + head.join(',') + '\n' + rows.join('\n');
    try {
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([H.csv], { type: 'text/csv;charset=utf-8' })); a.download = 'factory-live-' + hc() + '.csv'; document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { /* download blocked: textarea fallback below */ }
    H.tab = 'tools'; FL.render(true);
  };

  /* ================================================ rehearsal bots */
  var NAMES = ['白頭翁', '赤燕', '白鷺', '藍鵲', '黃鸝', '紫鳩', '灰鶯', '橘雀', '翠鳥', '鐵匠', '鉛筆', '墨水', '星火', '浪花', '山茶', '木棉'];
  var bots = [], doneKeys = {};
  function loadBots() { try { bots = JSON.parse(FL.ls.get('fl_bots_' + (FL.host ? FL.host.code : '')) || '[]'); } catch (e) { bots = []; } }
  function saveBots() { FL.ls.set('fl_bots_' + FL.host.code, JSON.stringify(bots)); }
  FL.bots = { list: function () { return bots; } };
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function qEst(id, L) {
    var h = hash(id), a = 4 + (h % 30) / 10, b = 0.45 + ((h >> 5) % 36) / 100, n = (((h >> 9) + L * 7) % 3) - 1;
    return Math.max(1, Math.round(a * Math.pow(L, b) + n * 0.6));
  }
  FL.acts.hbots = function (el) {
    var snap = FL.snap(), n = +el.dataset.n, used = {}; snap.teams.forEach(function (x) { used[x.table_no] = 1; });
    var nameUsed = {}; snap.teams.forEach(function (x) { nameUsed[x.name] = 1; });
    var made = 0, tbl = 1, ni = 0, chain = Promise.resolve();
    for (var i = 0; i < n; i++) {
      (function () {
        while (used[tbl]) tbl++;
        var table = tbl; used[table] = 1;
        var name; do { name = NAMES[ni % NAMES.length] + (ni >= NAMES.length ? Math.floor(ni / NAMES.length) + 1 : ''); ni++; } while (nameUsed[name]); nameUsed[name] = 1;
        var present = 2 + (hash(name) % 3);
        chain = chain.then(function () { return FL.api.join(hc(), name, table, present).then(function (r) { bots.push({ team_id: r.team_id, token: r.token }); made++; }); });
      })();
    }
    chain.then(function () { saveBots(); FL.toast(t('bots_added', made)); return FL.store.refresh(); }).catch(function (e) { FL.toast(FL.errText(e)); });
  };
  FL.acts.hbotsclear = function () {
    var chain = Promise.resolve(); bots.forEach(function (b) { chain = chain.then(function () { return FL.api.hostTeam(hc(), hk(), b.team_id, {}, true).catch(function () {}); }); });
    chain.then(function () { bots = []; saveBots(); return FL.store.refresh(); });
  };
  function isBot(id) { return bots.some(function (b) { return b.team_id === id; }); }
  function botOf(id) { return bots.filter(function (b) { return b.team_id === id; })[0]; }
  function later(key, fn) {
    if (doneKeys[key]) return; doneKeys[key] = 1;
    setTimeout(function () { fn().catch(function () { delete doneKeys[key]; }); }, 700 + Math.random() * 3800);
  }
  function botPoints(snap, tm) {
    var pts = C.trialPoints(snap.runs, tm.id), out = {};
    for (var L = 1; L <= tm.present; L++) out[L] = pts[L] != null ? pts[L] : qEst(tm.id, L);
    return out;
  }
  function botTick() {
    var snap = FL.snap(); if (!snap || !FL.host || !bots.length || FL.route().role !== 'host') return;
    var ph = snap.session.phase, par = snap.session.params, act = FL.active(snap);
    var live = bots.filter(function (b) { return FL.team(snap, b.team_id); });
    if (!live.length) return;
    var sh = FL.shiftOf(snap), st = FL.shiftState(sh);

    // 1. bots verify their neighbours once the shift is over
    if (sh && st.st === 'done' && (ph === 'trial' || ph === 'run1' || ph === 'run2')) {
      act.forEach(function (tg) {
        var v = C.verifierOf(tg, snap.teams); if (!v || !isBot(v.id)) return;
        var kind, L;
        if (ph === 'trial') { kind = 'trial'; L = sh.L; if (tg.present < L) return; }
        else { var per = ph === 'run1' ? 1 : 2, d = C.decisionOf(snap.decisions, tg.id, per); if (!d || !d.renew || d.L < 1) return; kind = 'p' + per; L = d.L; }
        if (snap.runs.some(function (r) { return r.team_id === tg.id && r.kind === kind && r.L === L; })) return;
        var b = botOf(v.id);
        later('rep:' + sh.id + ':' + tg.id, function () { return FL.api.report(b.team_id, b.token, tg.id, kind, L, qEst(tg.id, L)).then(function () { return FL.store.refresh(); }); });
      });
    }
    // 2. bots confirm what neighbours reported about them
    live.forEach(function (b) {
      snap.runs.forEach(function (r) {
        if (r.team_id === b.team_id && r.status === 'reported') later('cf:' + b.team_id + ':' + r.kind + r.L + ':' + r.q, function () { return FL.api.confirm(b.team_id, b.token, r.kind, r.L, true).then(function () { return FL.store.refresh(); }); });
      });
    });
    // 3. bots decide
    if (ph === 'decide1' || ph === 'decide2') {
      var per2 = ph === 'decide1' ? 1 : 2;
      live.forEach(function (b) {
        var tm = FL.team(snap, b.team_id); if (!tm || tm.present < 1) return;
        if (snap.locked.some(function (x) { return x.team_id === tm.id && x.period === per2; })) return;
        later('dec:' + ph + ':' + tm.id, function () {
          var bp = C.bestPlan(botPoints(snap, tm), par.p, par.w), h = hash(tm.id + ph), L = bp.L;
          if (h % 7 === 0) L = Math.max(0, Math.min(tm.present, L + (h % 2 ? 1 : -1)));
          if (per2 === 1) return FL.api.submit(tm.id === b.team_id ? b.team_id : tm.id, b.token, 1, true, L, null).then(function () { return FL.store.refresh(); });
          var renew = bp.G > par.F ? (h % 10 !== 0) : (h % 10 === 0), nOpen = snap.teams.filter(function (x) { var d = C.decisionOf(snap.decisions, x.id, 1); return d && d.L > 0; }).length;
          var pred = Math.max(0, Math.min(nOpen, Math.round(nOpen * 0.4) + (h % 3) - 1));
          return FL.api.submit(b.team_id, b.token, 2, renew, renew ? Math.max(L, 1) : 0, pred).then(function () { return FL.store.refresh(); });
        });
      });
    }
  }
  setInterval(botTick, 1200);
  FL.store.on(function () { botTick(); });
  FL.bots.reload = loadBots; FL.bots.tick = botTick;
  loadBots();
})();
