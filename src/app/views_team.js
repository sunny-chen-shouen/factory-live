/* Factory LIVE — student phone (factory manager) views. */
(function () {
  'use strict';
  var FL = window.FL, C = window.FLCalc, t = FL.t, esc = FL.esc, sg = FL.sg;
  FL.views = FL.views || {};
  FL.acts = FL.acts || {};
  var U = FL.U = FL.U || { present: 4, cnt: {}, sel1: null, renew2: null, sel2: null, pred: null, slip1: '', slip2: '' };
  FL.myDec = [];

  function loadMe() { try { return JSON.parse(FL.ls.get('fl_me') || 'null'); } catch (e) { return null; } }
  FL.me = loadMe();

  /* ------------------------------------------------ join */
  function joinView(r) {
    var code = r.code || FL.ls.get('fl_lastcode') || '';
    var opts = '';
    for (var i = 1; i <= 40; i++) opts += '<option value="' + i + '">' + t('table_n', i) + '</option>';
    return topbar(null) +
      '<div class="stack"><div class="card stack"><h1>' + t('join_title') + '</h1><div class="muted">' + t('tagline') + '</div>' +
      (FL.useLocal ? '<div class="banner warn small">' + t('local_banner') + '</div>' : '') +
      '<label class="field"><span>' + t('room_code') + '</span><input id="j_code" type="text" maxlength="4" autocapitalize="characters" autocomplete="off" value="' + esc(code) + '" style="text-transform:uppercase;font-size:30px;font-weight:800;letter-spacing:.2em"></label>' +
      '<label class="field"><span>' + t('team_name') + '</span><input id="j_name" type="text" maxlength="24" autocomplete="off" placeholder="' + t('team_name_ph') + '"></label>' +
      '<label class="field"><span>' + t('table_no') + '</span><select id="j_table">' + opts + '</select></label>' +
      '<div><div style="font-weight:700;margin-bottom:6px">' + t('present_q') + '</div>' + stepper('present', U.present, 0, 4) + '<div class="tiny muted">' + t('present_hint') + '</div></div>' +
      '<button class="btn primary block" data-act="join">' + t('join_btn') + '</button></div></div>';
  }

  function stepper(key, v, lo, hi, step) {
    return '<div class="stepper"><button class="btn" data-act="step" data-k="' + key + '" data-d="-' + (step || 1) + '" data-lo="' + lo + '" data-hi="' + hi + '" aria-label="−">−</button>' +
      '<div class="v num" id="sv_' + key + '">' + v + '</div>' +
      '<button class="btn" data-act="step" data-k="' + key + '" data-d="' + (step || 1) + '" data-lo="' + lo + '" data-hi="' + hi + '" aria-label="+">+</button></div>';
  }

  FL.acts.step = function (el) {
    var k = el.dataset.k, lo = +el.dataset.lo, hi = +el.dataset.hi, d = +el.dataset.d;
    var cur;
    if (k.indexOf('cnt:') === 0) { var id = k.slice(4); cur = U.cnt[id] == null ? 0 : U.cnt[id]; U.cnt[id] = Math.max(lo, Math.min(hi, cur + d)); cur = U.cnt[id]; }
    else {
      var displayed = document.getElementById('sv_' + k);
      var base = U[k] == null ? (displayed ? Number(displayed.textContent) || 0 : 0) : U[k];
      cur = Math.max(lo, Math.min(hi, base + d)); U[k] = cur;
    }
    var n = document.getElementById('sv_' + k); if (n) n.textContent = cur;
    if (k === 'present' && FL.me) FL.run(FL.api.updateTeam(FL.me.team_id, FL.me.token, cur));
  };
  FL.acts.join = function () {
    var code = FL.$('#j_code').value.toUpperCase().trim(), name = FL.$('#j_name').value.trim(), table = +FL.$('#j_table').value;
    if (code.length !== 4) return FL.toast(t('err_no_session'));
    if (!name) return FL.toast(t('err_bad_name'));
    FL.api.join(code, name, table, U.present).then(function (res) {
      FL.me = res; FL.ls.set('fl_me', JSON.stringify(res)); FL.ls.set('fl_lastcode', code);
      FL.go('#/team/' + code); FL.boot();
    }).catch(function (e) { FL.toast(FL.errText(e)); });
  };
  FL.acts.leave = function () { FL.ls.del('fl_me'); FL.me = null; FL.myDec = []; U.sel1 = U.renew2 = U.sel2 = U.pred = null; FL.store.stop(); FL.go('#/'); FL.render(true); };

  function topbar(team, snap) {
    var langBtn = '<button class="btn sm ghost" data-act="lang">' + (FL.lang === 'zh' ? 'EN' : '中') + '</button>';
    var ph = snap ? '<span class="pill solid">' + t('ph_' + snap.session.phase) + '</span>' : '';
    return '<div class="topbar"><a class="btn sm ghost" href="#/" aria-label="' + t('back_home') + '">←</a><div class="brand"><i></i>' + t('app_title') + '</div><div class="grow"></div>' + ph + (FL.sfx ? FL.sfx.toggleHTML() : '') + langBtn + '</div>' +
      (FL.store.online ? '' : '<div class="banner warn small" role="alert">' + t('offline') + '</div>') +
      (team ? '<div class="card row" style="margin:10px 0"><div class="grow"><div class="big" style="font-weight:800">' + esc(team.name) + '</div><div class="muted small">' + t('table_n', team.table_no) + ' · ' + t('k_people', team.present) + '</div></div></div>' : '');
  }
  FL.acts.lang = function () { FL.setLang(FL.lang === 'zh' ? 'en' : 'zh'); };

  /* ------------------------------------------------ main team view */
  FL.views.team = function (r) {
    var snap = FL.snap();
    if (!FL.me) return joinView(r);
    if (!snap) return topbar(null) + '<div class="card center">' + t('loading') + '</div><div class="center" style="margin-top:14px"><button class="btn ghost" data-act="leave">' + t('leave') + '</button></div>';
    var me = FL.team(snap, FL.me.team_id);
    if (!me) return topbar(null) + '<div class="card stack"><div>' + t('team_gone') + '</div><button class="btn block" data-act="leave">' + t('rejoin') + '</button></div>';
    var live = snap.session.phase;
    if (U.peekFor !== live) { U.peek = false; U.peekFor = live; }
    var peeking = !!(U.peek && PREV[live]), ph = peeking ? PREV[live] : live;
    var body = ({ lobby: lobby, trial: trial, trialpeek: function (s, m) { return '<div class="card"><h3>' + t('my_trial') + '</h3>' + trialTable(s, m) + '</div>'; },
      market: market, decide1: function (s, m) { return decide(s, m, 1); }, run1: function (s, m) { return run(s, m, 1); },
      ledger1: function (s, m) { return ledgerView(s, m, 1); }, decide2: function (s, m) { return decide(s, m, 2); }, run2: function (s, m) { return run(s, m, 2); },
      ledger2: function (s, m) { return ledgerView(s, m, 2); }, debrief: debrief })[ph](snap, me);
    var nav = '';
    if (PREV[live]) {
      nav = '<div class="peekbar">' + (peeking
        ? '<div class="banner warn grow">' + t('peek_note', t('ph_' + (PREV[live] === 'trialpeek' ? 'trial' : PREV[live]))) + '</div><button class="btn primary block" data-act="peek">' + t('peek_back') + '</button>'
        : '<button class="btn block secondary-nav" data-act="peek">← ' + t('peek_prev', t('ph_' + (PREV[live] === 'trialpeek' ? 'trial' : PREV[live]))) + '</button>') + '</div>';
    }
    return '<div class="app-inner">' + topbar(me, snap) + '<div class="stack">' + (peeking ? nav : '') + body + (peeking ? '' : nav) + '</div>' +
      '<div class="center" style="margin-top:24px"><button class="btn sm ghost" data-act="leave">' + t('leave') + '</button></div></div>';
  };
  var PREV = { market: 'trialpeek', decide1: 'market', run1: 'market', ledger1: 'market', decide2: 'ledger1', run2: 'ledger1', ledger2: 'ledger1', debrief: 'ledger2' };
  FL.acts.peek = function () { U.peek = !U.peek; FL.render(true); window.scrollTo(0, 0); };
  FL.acts.home = function () { FL.go('#/'); };

  function rulesCard() {
    return '<details class="card"><summary style="font-weight:800;cursor:pointer">' + t('rules_title') + '</summary><ol class="small" style="padding-left:20px;margin:10px 0 0">' +
      '<li>' + t('rule1') + '</li><li>' + t('rule2') + '</li><li>' + t('rule3') + '</li><li>' + t('rule4') + '</li><li>' + t('rule5') + '</li></ol></details>';
  }

  function lobby(snap, me) {
    U.present = me.present;
    return '<div class="card accent stack"><h2>' + t('lobby_h') + '</h2><div>' + t('lobby_p') + '</div></div>' +
      '<div class="card stack"><div style="font-weight:800">' + t('present_q') + '</div>' + stepper('present', me.present, 0, 4) + '<div class="tiny muted">' + t('present_hint') + '</div></div>' + rulesCard();
  }

  /* ------------------------------------------------ trial */
  function trial(snap, me) {
    var sh = FL.shiftOf(snap), pts = C.trialPoints(snap.runs, me.id);
    var out = '';
    if (!sh) {
      out += '<div class="card accent"><h2>' + t('trial_h') + '</h2><div>' + t('trial_wait') + '</div></div>';
    } else {
      var L = sh.L, canWork = me.present >= L;
      out += '<div class="card stack"><h2>' + t('trial_shift', L) + '</h2>' +
        '<div class="big" style="font-weight:800">' + (canWork ? t('you_work', L) : t('you_verify_only', me.present, L)) + '</div>' + FL.cdHTML(snap) + '</div>';
      out += verifyBlock(snap, me, 'trial', L);
    }
    out += '<div class="card"><h3>' + t('my_trial') + '</h3>' + trialTable(snap, me) + '</div>' + rulesCard();
    return out;
  }

  function trialTable(snap, me) {
    var runs = snap.runs.filter(function (r) { return r.team_id === me.id && r.kind === 'trial'; }).sort(function (a, b) { return a.L - b.L; });
    if (!runs.length) return '<div class="muted small">' + t('no_trial_yet') + '</div>';
    return '<table class="t plan"><tr><th>' + t('c_workers') + '</th><th>' + t('c_rings') + '</th><th>' + t('c_status') + '</th></tr>' +
      runs.map(function (r) { return '<tr><td>' + r.L + '</td><td class="sign">' + r.q + '</td><td>' + statusChip(r.status) + '</td></tr>'; }).join('') + '</table>';
  }

  function statusChip(s) {
    return '<span class="chip ' + (s === 'confirmed' || s === 'host' ? 'ok' : s === 'disputed' ? 'bad' : '') + '">' + t('st_' + s) + '</span>';
  }

  // Neighbour verification (I count them) + my own confirmation (they counted me)
  function verifyBlock(snap, me, kind, L) {
    var teams = snap.teams, out = '';
    var assigned = C.verifierOf(me, teams), shift = FL.shiftOf(snap), context = shift ? shift.id : kind + ':' + L;
    var ownDecision = kind === 'trial' ? null : C.decisionOf(snap.decisions, me.id, kind === 'p1' ? 1 : 2);
    var needsOwn = kind === 'trial' ? me.present >= L : !!(ownDecision && ownDecision.renew && ownDecision.L > 0);
    if (U.countContext !== context) { U.cnt = {}; U.countContext = context; }
    out += '<div class="card small">' + (needsOwn ? (assigned ? t('your_verifier', esc(assigned.name), assigned.table_no) : t('need_teacher_verifier')) : t('verify_others_only')) + '</div>';
    var targets = C.verifies(me, teams).filter(function (tg) {
      if (kind === 'trial') return tg.present >= L;
      var per = kind === 'p1' ? 1 : 2, d = C.decisionOf(snap.decisions, tg.id, per);
      return d && d.renew && d.L > 0;
    });
    var st = FL.shiftState(FL.shiftOf(snap));
    var counting = st.st === 'done' || st.st === 'idle';

    // mine to confirm
    var mine = needsOwn ? snap.runs.filter(function (r) { return r.team_id === me.id && r.kind === kind && (kind !== 'trial' || r.L === L); }) : [];
    mine.forEach(function (r) {
      if (r.status === 'reported' || r.status === 'disputed') {
        out += '<div class="card accent stack"><h3>' + t('confirm_h') + '</h3><div class="big">' + t('confirm_p', '<b class="num">' + r.q + '</b>') + '</div>' +
          (r.status === 'disputed' ? '<div class="chip bad">' + t('st_disputed') + '</div>' : '') +
          '<div class="seg c2"><button class="btn primary" data-act="confirm" data-kind="' + kind + '" data-lv="' + r.L + '" data-ok="1">' + t('confirm_ok') + '</button>' +
          '<button class="btn" data-act="confirm" data-kind="' + kind + '" data-lv="' + r.L + '" data-ok="0">' + t('confirm_no') + '</button></div></div>';
      } else if (r.status === 'confirmed' || r.status === 'host') {
        out += '<div class="card row confirmed-card"><span class="stamp sm" data-sk="conf' + kind + ':' + r.L + ':' + r.q + '">' + t('stamp_confirmed') + '</span><span>' + t('confirmed_p', '<b class="num">' + r.q + '</b>') + '</span></div>';
      }
    });
    if (needsOwn && !mine.length && counting && st.st === 'done') out += '<div class="card muted">' + t('wait_neighbour') + '</div>';

    // theirs to count
    if (!targets.length) {
      if (counting) out += '<div class="card muted small">' + t('no_verify') + '</div>';
      return out;
    }
    targets.forEach(function (tg) {
      var run = snap.runs.filter(function (r) { return r.team_id === tg.id && r.kind === kind && (kind === 'trial' ? r.L === L : true); })[0];
      var cur = U.cnt[tg.id] != null ? U.cnt[tg.id] : (run ? run.q : 0);
      var useL = kind === 'trial' ? L : C.decisionOf(snap.decisions, tg.id, kind === 'p1' ? 1 : 2).L;
      out += '<div class="card stack"><h3>' + t('verify_h', esc(tg.name), tg.table_no) + '</h3><div class="muted small">' + t('verify_p', useL) + '</div>' +
        (counting ? '' : '<div class="banner small">' + t('verify_after') + '</div>') +
        stepperCnt(tg.id, cur) +
        '<button class="btn primary block" data-act="report" data-target="' + tg.id + '" data-kind="' + kind + '" data-lv="' + useL + '"' + (counting ? '' : ' disabled') + '>' + (run ? t('report_again') : t('report_btn')) + '</button>' +
        (run ? '<div class="row">' + statusChip(run.status) + '<span class="muted small">' + t('reported_n', run.q) + '</span></div>' : '') + '</div>';
    });
    return out;
  }
  function stepperCnt(id, v) {
    var key = 'cnt:' + id;
    return '<div class="row" style="justify-content:center;gap:8px"><button class="btn" data-act="step" data-k="' + key + '" data-d="-5" data-lo="0" data-hi="300">−5</button>' +
      '<button class="btn" data-act="step" data-k="' + key + '" data-d="-1" data-lo="0" data-hi="300">−</button>' +
      '<div class="v num" id="sv_' + key + '" style="min-width:90px;text-align:center;font-size:48px;font-weight:900">' + v + '</div>' +
      '<button class="btn" data-act="step" data-k="' + key + '" data-d="1" data-lo="0" data-hi="300">+</button>' +
      '<button class="btn" data-act="step" data-k="' + key + '" data-d="5" data-lo="0" data-hi="300">+5</button></div>';
  }
  FL.acts.report = function (el) {
    var id = el.dataset.target, cur = U.cnt[id];
    if (cur == null) { var tg = FL.snap().runs.filter(function (r) { return r.team_id === id && r.kind === el.dataset.kind; })[0]; cur = tg ? tg.q : 0; }
    return FL.run(FL.api.report(FL.me.team_id, FL.me.token, id, el.dataset.kind, +el.dataset.lv, cur), t('toast_sent'));
  };
  FL.acts.confirm = function (el) {
    return FL.run(FL.api.confirm(FL.me.team_id, FL.me.token, el.dataset.kind, +el.dataset.lv, el.dataset.ok === '1'), el.dataset.ok === '1' ? t('toast_confirmed') : t('toast_disputed'));
  };

  /* ------------------------------------------------ market */
  function paramCards(par) {
    return '<div class="seg c3" style="gap:8px">' +
      '<div class="card center"><div class="muted small">' + t('p_s') + '</div><div class="huge num">' + par.p + '</div></div>' +
      '<div class="card center"><div class="muted small">' + t('w_s') + '</div><div class="huge num">' + par.w + '</div></div>' +
      '<div class="card center"><div class="muted small">' + t('f_s') + '</div><div class="huge num">' + par.F + '</div></div></div>';
  }
  function planTable(snap, me, highlightL) {
    var par = snap.session.params, pts = C.trialPoints(snap.runs, me.id), rows = C.planRows(pts, par.p, par.w);
    if (rows.length < 2) {
      var ref = C.trialSummary(snap.runs, FL.active(snap));
      var items = [1, 2, 3, 4].filter(function (L) { return L <= me.present && ref.cohortMean[L] != null; }).map(function (L) { return '<span>' + L + ' ' + t(L === 1 ? 'person' : 'people') + '：' + FL.n2(ref.cohortMean[L]) + ' ' + t('rings') + '</span>'; }).join(' · ');
      return '<div class="banner warn">' + t('late_hint') + (items ? '<div class="small" style="margin-top:8px">' + t('late_reference', ref.cohortN) + '<br>' + items + '</div>' : '') + '</div>';
    }
    return '<table class="t plan"><tr><th>' + t('c_workers') + '</th><th>' + t('c_rings') + '</th><th>' + t('c_rev') + '</th><th>' + t('c_wage') + '</th><th>' + t('c_net') + '</th><th>' + t('c_dv1') + '<br><small>' + t('c_dv2') + '</small></th></tr>' +
      rows.map(function (r) {
        return '<tr class="' + (r.L === highlightL ? 'hl' : '') + '"><td>' + r.L + '</td><td>' + r.q + '</td><td>' + r.rev + '</td><td>' + r.wage + '</td><td class="sign">' + sg(r.net) + '</td>' +
          '<td class="small">' + (r.dV == null ? '—' : sg(r.dV) + ' / ' + r.dW) + '</td></tr>';
      }).join('') + '</table>';
  }
  function market(snap, me) {
    var par = snap.session.params;
    if (!FL.marketPublished(snap)) return FL.marketWaiting();
    return '<div class="card accent stack"><h2>' + t('market_h') + '</h2>' + paramCards(par) + '<div>' + t('market_p', par.F) + '</div></div>' +
      '<div class="card stack"><h3>' + t('plan_h') + '</h3>' + planTable(snap, me) + '<div class="tiny muted">' + t('plan_note') + '</div></div>';
  }

  /* ------------------------------------------------ decisions */
  function myDecision(snap, per) {
    var d = C.decisionOf(snap.decisions, FL.me.team_id, per);
    if (d) return d;
    return FL.myDec.filter(function (x) { return x.period === per; }).map(function (x) { return { period: per, renew: x.renew, L: x.L, predict: x.predict, team_id: FL.me.team_id }; })[0] || null;
  }
  function openCount(snap) {
    return FL.active(snap).length;
  }
  function decide(snap, me, per) {
    var par = snap.session.params, K = me.present, mine = myDecision(snap, per), pts = C.trialPoints(snap.runs, me.id);
    var out = '';
    if (per === 1) {
      var sel = U.sel1 != null ? U.sel1 : (mine ? mine.L : null);
      out += '<div class="card accent stack"><h2>' + t('d1_h') + '</h2>' + paramCards(par) + '<div>' + t('d1_p', par.F) + '</div></div>';
      out += '<div class="card stack"><h3>' + t('plan_h') + '</h3>' + planTable(snap, me, sel) + '</div>';
      var btns = ''; for (var L = 0; L <= K; L++) btns += '<button class="btn ' + (sel === L ? 'on acc' : '') + '" data-act="sel1" data-lv="' + L + '">' + (L === 0 ? t('stop') : L) + '<small>' + (L === 0 ? '0 ' + t('people') : t(L === 1 ? 'person' : 'people')) + '</small></button>';
      out += '<div class="card stack"><h3>' + t('d1_q') + '</h3><div class="seg c5" style="grid-template-columns:repeat(' + Math.min(5, K + 1) + ',1fr)">' + btns + '</div>' + previewBlock(par, pts, sel, 1) + lockBtn(mine, sel != null, 'lock1') + '</div>';
    } else {
      var renew = U.renew2 != null ? U.renew2 : (mine ? mine.renew : null);
      var L2 = U.sel2 != null ? U.sel2 : (mine ? mine.L : null);
      var N = openCount(snap), pred = U.pred != null ? U.pred : (mine && mine.predict != null ? mine.predict : 0);
      pred = Math.max(0, Math.min(pred, Math.max(N, 0)));
      out += '<div class="card accent stack"><h2>' + t('d2_h') + '</h2>' + paramCards(par) + '<div>' + t('d2_p', par.F) + '</div></div>';
      var gRows = C.planRows(pts, par.p, par.w), gBest = gRows.length > 1 ? Math.max.apply(null, gRows.map(function (r) { return r.net; })) : null;
      out += '<div class="card stack"><h3>' + t('plan_h') + '</h3>' + planTable(snap, me, renew ? L2 : null) + (gBest != null ? '<div class="g-vs-f">' + t('g_vs_f', '<b>' + sg(gBest) + '</b>', '<b>' + par.F + '</b>') + '</div>' : '') + '</div>';
      out += '<div class="card stack"><h3>' + t('d2_q') + '</h3><div class="seg c2">' +
        '<button class="btn ' + (renew === true ? 'on acc' : '') + '" data-act="renew" data-v="1">' + t('renew') + '<small>' + t('pay_f', par.F) + '</small></button>' +
        '<button class="btn ' + (renew === false ? 'on' : '') + '" data-act="renew" data-v="0">' + t('exit') + '<small>' + t('profit_0') + '</small></button></div>';
      if (renew === true) {
        var b = ''; for (var l = 0; l <= K; l++) b += '<button class="btn ' + (L2 === l ? 'on acc' : '') + '" data-act="sel2" data-lv="' + l + '">' + l + '<small>' + t(l === 1 ? 'person' : 'people') + '</small></button>';
        out += '<div style="font-weight:700">' + t('d2_hire') + '</div><div class="seg c5" style="grid-template-columns:repeat(' + Math.min(5, K + 1) + ',1fr)">' + b + '</div>';
      }
      out += previewBlock(par, pts, renew === true ? L2 : (renew === false ? 'exit' : null), 2) + '</div>';
      out += '<div class="card stack"><h3>' + t('pred_h') + '</h3><div class="small muted">' + t('pred_p', N) + '</div>' + stepper('pred', pred, 0, Math.max(N, 0)) + '</div>';
      var ready = renew === false || (renew === true && L2 != null);
      out += '<div class="card">' + lockBtn(mine, ready, 'lock2') + '</div>';
    }
    return out;
  }
  function previewBlock(par, pts, sel, per) {
    if (sel == null) return '';
    if (sel === 'exit') return '<div class="banner">' + t('prev_exit') + '</div>';
    if (sel === 0) return '<div class="banner">' + (per === 1 ? t('prev_stop', sg(-par.F)) : t('prev_renew0', sg(-par.F))) + '</div>';
    var q = pts[sel];
    if (q == null) return '<div class="banner warn">' + t('prev_untested') + ' ' + t('late_hint') + '</div>';
    var pr = par.p * q - par.w * sel - par.F;
    return '<div class="banner">' + t('prev_work', sel, q, par.p * q, par.w * sel, par.F, sg(pr)) + '</div>' + (per === 1 ? '<div class="tiny muted">' + t('prev_stop_cmp', sg(-par.F)) + '</div>' : '');
  }
  function lockBtn(mine, ready, act) {
    return (mine ? '<div class="row"><span class="stamp sm" data-sk="lock' + mine.period + ':' + mine.L + ':' + mine.renew + '">' + t('stamp_locked') + '</span><span class="small muted">' + t('locked_note') + '</span></div>' : '') +
      '<button class="btn primary block" data-act="' + act + '"' + (ready ? '' : ' disabled') + '>' + (mine ? t('relock') : t('lock')) + '</button>';
  }
  FL.acts.sel1 = function (el) { U.sel1 = +el.dataset.lv; FL.render(true); };
  FL.acts.renew = function (el) { U.renew2 = el.dataset.v === '1'; if (!U.renew2) U.sel2 = 0; FL.render(true); };
  FL.acts.sel2 = function (el) { U.sel2 = +el.dataset.lv; FL.render(true); };
  function afterLock(p) { return FL.run(p, t('toast_locked')).then(function (res) { if (!res.ok) return res; return FL.api.myDecisions(FL.me.team_id, FL.me.token).then(function (d) { FL.myDec = d; FL.render(true); return res; }); }); }
  FL.acts.lock1 = function () {
    var snap = FL.snap(), mine = myDecision(snap, 1), L = U.sel1 != null ? U.sel1 : (mine ? mine.L : null);
    if (L == null) return;
    return afterLock(FL.api.submit(FL.me.team_id, FL.me.token, 1, true, L, null));
  };
  FL.acts.lock2 = function () {
    var snap = FL.snap(), mine = myDecision(snap, 2);
    var renew = U.renew2 != null ? U.renew2 : (mine ? mine.renew : null), L = U.sel2 != null ? U.sel2 : (mine ? mine.L : 0);
    if (renew == null) return;
    var pred = U.pred != null ? U.pred : (mine && mine.predict != null ? mine.predict : 0);
    pred = Math.max(0, Math.min(pred, openCount(snap)));
    return afterLock(FL.api.submit(FL.me.team_id, FL.me.token, 2, renew, renew ? L : 0, pred));
  };

  /* ------------------------------------------------ production */
  function run(snap, me, per) {
    var d = C.decisionOf(snap.decisions, me.id, per), kind = per === 1 ? 'p1' : 'p2', out = '';
    if (!d) return '<div class="card accent stack"><h2>' + t('run_h', per) + '</h2><div>' + t('no_decision') + '</div></div>';
    var producing = d.renew && d.L > 0;
    out += '<div class="card ' + (producing ? 'accent' : '') + ' stack"><h2>' + t('run_h', per) + '</h2>' +
      '<div class="big" style="font-weight:800">' + (per === 2 && !d.renew ? t('you_exited') : d.L === 0 ? t('you_stopped') : t('you_work', d.L)) + '</div>' +
      (producing ? FL.cdHTML(snap) : '') + '</div>';
    out += verifyBlock(snap, me, kind, d.L);
    return out;
  }

  /* ------------------------------------------------ ledger */
  function ledgerRows(P, par) {
    if (P.renew === false) return '<tr><td>' + t('l_exit') + '</td><td class="sign">0</td></tr>';
    return '<tr><td>' + t('l_rings') + '</td><td>' + (P.q == null ? '—' : P.q) + '</td></tr>' +
      '<tr><td>' + t('l_rev', par.p) + '</td><td>' + FL.n2(P.rev) + '</td></tr>' +
      '<tr><td>' + t('l_wage', par.w, P.L) + '</td><td>' + (P.wage ? '−' + FL.n2(P.wage) : '0') + '</td></tr>' +
      '<tr><td>' + t('l_rent') + '</td><td>' + (par.F ? '−' + par.F : '0') + '</td></tr>' +
      '';
  }
  function ledgerView(snap, me, per) {
    var L = C.ledger(me, snap), P = L.periods[per], par = snap.session.params, out = '';
    if (!P.decided) return '<div class="card">' + t('no_decision') + '</div>';
    if (!P.complete) return '<div class="card accent stack"><h2>' + t('ledger_h', per) + '</h2><div>' + t('ledger_pending') + '</div></div>';
    var table = '<table class="t">' + ledgerRows(P, par) + '</table>';
    var cmp;
    if (P.counterfactual == null) cmp = t('comparison_unknown');
    else if (P.counterfactualKind === 'exact') {
      var diff = P.profit - P.counterfactual;
      cmp = per === 1 ? t('cmp1_exact', sg(P.profit), sg(P.counterfactual), '<b>' + sg(diff) + '</b>') : t('cmp2_exact', sg(P.profit), sg(P.counterfactual));
    } else {
      cmp = per === 1 ? t('cmp1_est', sg(P.profit), sg(P.counterfactual)) : t('cmp2_est', sg(P.profit), sg(P.counterfactual));
    }
    var delta = P.counterfactual == null ? null : P.profit - P.counterfactual;
    var compare = delta == null ? '' : t('profit_delta', sg(delta), per === 1 ? t('stop') : P.renew ? t('exit') : t('renew')) + (P.counterfactualKind === 'estimate' ? '*' : '');
    // Name what each side of the comparison actually is: an open factory is compared with stopping,
    // a stopped factory with its best open plan (estimated from confirmed trials); period 2 mirrors renew/exit.
    var opened = per === 1 ? P.L > 0 : P.renew;
    var selfName = per === 1 ? (opened ? t('open_word') : t('stop')) : (opened ? t('renew') : t('exit'));
    var otherName = per === 1 ? (opened ? t('stop') : t('best_open')) : (opened ? t('exit') : t('renew'));
    var est = P.counterfactualKind === 'estimate' ? '*' : '';
    var pairLine = delta == null ? '' : '<div class="receipt-vs">' + t('vs_pair', selfName, sg(P.profit), otherName, sg(P.counterfactual) + est, sg(delta) + est) + '</div>';
    var stampOther = per === 1 && !opened ? t('open_word') : otherName;
    var stampTxt = delta == null ? '' : delta > 0 ? t('stamp_better', stampOther, sg(delta) + est) : delta < 0 ? t('stamp_worse', stampOther, sg(delta) + est) : t('stamp_same', stampOther);
    out += '<div class="receipt' + (delta > 0 ? ' good' : delta < 0 ? ' bad' : '') + '"><div class="receipt-head"><b>' + t('app_title') + '</b><span>' + t('receipt_title', per) + '</span><small>' + t('receipt_meta', me.table_no, esc(snap.session.code)) + '</small></div>' +
      '<table class="t receipt-lines">' + ledgerRows(P, par) + '</table>' +
      '<div class="receipt-total"><span>' + t('l_profit') + '</span><b class="profit-value num">' + sg(P.profit) + '</b></div>' +
      pairLine + (stampTxt ? '<div class="receipt-stamp"><span class="stamp big' + (delta < 0 ? ' ink' : '') + '" data-sk="led' + per + ':' + P.profit + '">' + stampTxt + '</span></div>' : '') +
      (per === 2 || P.counterfactual == null ? '<div class="receipt-note">' + cmp + '</div>' : '') + (est ? '<div class="tiny muted receipt-note">' + t('est_note') + '</div>' : '') + '</div>';
    if (per === 2) {
      out += '<div class="card"><div class="row"><div class="grow muted">' + t('total_h') + '</div><div class="huge num">' + sg(L.total) + '</div></div></div>';
      var agg = C.classAggregates(snap), p2 = P;
      if (p2.predict != null) out += '<div class="card small">' + (agg.decided2 === agg.n ? t('pred_result', p2.predict, agg.exit2) : t('forecast_pending', agg.decided2, agg.n)) + '</div>';
    }
    return out;
  }

  function debrief(snap, me) {
    var L = C.ledger(me, snap), par = snap.session.params, p1 = L.periods[1], p2 = L.periods[2];
    function alternative(P) { return P.complete && P.counterfactual != null ? sg(P.counterfactual) + (P.counterfactualKind === 'estimate' ? '*' : '') : '—'; }
    var key = 'fl_slip_' + snap.session.code + '_' + me.id;
    if (U.slipKey !== key) {
      U.slipKey = key; var saved = {}; try { saved = JSON.parse(FL.ls.get(key) || '{}'); } catch (e) { /* empty draft */ }
      U.slip1 = saved.slip1 || ''; U.slip2 = saved.slip2 || '';
    }
    return '<div class="card accent stack"><h2>' + t('debrief_h') + '</h2><div>' + t('slip_q', par.F) + '</div></div>' +
      '<div class="card stack"><h3>' + t('slip_h') + '</h3><div class="tiny muted">' + t('draft_note') + '</div><label class="field"><span>' + t('slip_1') + '</span><textarea id="slip1">' + esc(U.slip1) + '</textarea></label>' +
      '<label class="field"><span>' + t('slip_2') + '</span><textarea id="slip2">' + esc(U.slip2) + '</textarea></label><div id="draft_status" class="tiny muted" role="status">' + t('draft_ready') + '</div></div>' +
      '<div class="card"><table class="t"><tr><th></th><th>' + t('period1') + '</th><th>' + t('period2') + '</th></tr>' +
      '<tr><td>' + t('l_decision') + '</td><td>' + (p1.decided ? (p1.L === 0 ? t('stop') : t('hire_n', p1.L)) : '—') + '</td><td>' + (p2.decided ? (p2.renew ? t('renew') + ' · ' + t('hire_n', p2.L) : t('exit')) : '—') + '</td></tr>' +
      '<tr><td>' + t('l_profit') + '</td><td class="sign">' + (p1.complete ? sg(p1.profit) : '—') + '</td><td class="sign">' + (p2.complete ? sg(p2.profit) : '—') + '</td></tr>' +
      '<tr><td>' + t('l_alt') + '</td><td>' + alternative(p1) + '</td><td>' + alternative(p2) + '</td></tr></table>' +
      '<div class="tiny muted" style="margin-top:6px">' + t('est_note') + '</div></div>' + (par.show_lesson ? '<div class="card">' + FL.lessonHTML() + '</div>' : '');
  }
  FL.afterTeam = function () {
    var a = FL.$('#slip1'), b = FL.$('#slip2');
    function save() {
      U.slip1 = a.value; U.slip2 = b.value;
      var saved = FL.ls.set(U.slipKey, JSON.stringify({ slip1: U.slip1, slip2: U.slip2 }));
      FL.$('#draft_status').textContent = t(saved ? 'draft_saved' : 'draft_memory');
    }
    if (a && b) { a.oninput = save; b.oninput = save; }
  };
  FL.views.team.after = FL.afterTeam;

  /* keep my own (hidden) decision in sync */
  FL.refreshMine = function () {
    var snap = FL.snap();
    if (!FL.me || !snap || FL.route().role !== 'team') return;
    if (!/^(decide|run|ledger)/.test(snap.session.phase)) return;
    var meId = FL.me.team_id, code = FL.me.code;
    FL.api.myDecisions(meId, FL.me.token).then(function (d) {
      if (!FL.me || FL.me.team_id !== meId || FL.me.code !== code || !FL.snap() || FL.snap().session.code !== code) return;
      if (JSON.stringify(d) !== JSON.stringify(FL.myDec)) { FL.myDec = d; FL.render(false); }
    }).catch(function () { /* ignore */ });
  };
  FL.store.on(function () { FL.refreshMine(); });
})();
