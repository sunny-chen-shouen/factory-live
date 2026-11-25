/* Factory LIVE — projector screen. Large text, shape + words (never colour alone). */
(function () {
  'use strict';
  var FL = window.FL, C = window.FLCalc, t = FL.t, esc = FL.esc, sg = FL.sg;
  var PH = C.PHASES;
  var flip = { from: null, armed: false };
  var tilePage = 0, PAGE_SIZE = 20;

  function head(snap) {
    var cur = PH.indexOf(snap.session.phase);
    var steps = PH.map(function (p, i) { return '<span class="ph ' + (i === cur ? 'on' : i < cur ? 'done' : '') + '">' + t('ph_' + p) + '</span>'; }).join('');
    return '<div class="screenhead"><div class="brand big"><i></i>' + t('app_title') + '</div><div class="grow"></div>' +
      '<span class="pill solid" style="font-size:24px">' + t('room_code') + ' ' + esc(snap.session.code) + '</span>' +
      (FL.soundOn ? '' : '<button class="btn sm" data-act="sound">' + t('sound_on') + '</button>') +
      '<button class="btn sm ghost" data-act="lang">' + (FL.lang === 'zh' ? 'EN' : '中') + '</button></div>' +
      '<div class="stepper-phase">' + steps + '</div>' + (FL.store.online ? '' : '<div class="banner warn" role="alert">' + t('offline') + '</div>');
  }

  // tile state for the current phase
  function tileInfo(snap, tm) {
    var ph = snap.session.phase, d1 = C.decisionOf(snap.decisions, tm.id, 1), d2 = C.decisionOf(snap.decisions, tm.id, 2);
    var lockedFor = function (per) { return snap.locked.some(function (x) { return x.team_id === tm.id && x.period === per; }); };
    var led = (/^(ledger|debrief)/.test(ph)) ? C.ledger(tm, snap) : null;
    var o = { state: 'unk', L: 0, tag: '', badge: '', sub: t('table_n', tm.table_no) + ' · ' + t('k_people', tm.present) };
    if (ph === 'lobby') { o.state = 'stop'; o.tag = t('k_people', tm.present); }
    else if (ph === 'trial' || ph === 'market') {
      var pts = C.trialPoints(snap.runs, tm.id), n = Object.keys(pts).length;
      o.state = 'stop'; o.tag = t('tested_n', n);
    }
    else if (ph === 'decide1') { o.state = 'unk'; o.tag = lockedFor(1) ? t('locked') : t('thinking'); o.locked = lockedFor(1); o.tag = o.locked ? '' : t('thinking'); o.badge = lockedFor(1) ? '✓' : '…'; o.off = !lockedFor(1); }
    else if (ph === 'decide2') {
      if (d1) { o.state = d1.L > 0 ? 'open' : 'stop'; o.L = d1.L; }
      o.locked = lockedFor(2); o.tag = o.locked ? '' : t('thinking'); o.badge = lockedFor(2) ? '✓' : '…'; o.off = !lockedFor(2);
    }
    else if (ph === 'run1' || ph === 'ledger1') {
      if (d1) { o.state = d1.L > 0 ? 'open' : 'stop'; o.L = d1.L; o.tag = d1.L > 0 ? t('open_n', d1.L) : t('stop'); }
      else { o.tag = t('no_dec_short'); }
      if (ph === 'ledger1' && led && led.periods[1].complete) o.tag = sg(led.periods[1].profit);
    }
    else { // run2, ledger2, debrief
      if (d2) { o.state = d2.renew ? (d2.L > 0 ? 'open' : 'stop') : 'exit'; o.L = d2.L; o.tag = d2.renew ? t('renew_n', d2.L) : t('exit'); }
      else o.tag = t('no_dec_short');
      if (/^(ledger2|debrief)/.test(ph) && led && led.periods[2].complete) o.tag = sg(led.periods[2].profit);
    }
    // production progress badge
    if (/^run/.test(ph) && o.state === 'open') {
      var kind = ph === 'run1' ? 'p1' : 'p2', r = snap.runs.filter(function (x) { return x.team_id === tm.id && x.kind === kind; })[0];
      o.badge = r ? (r.status === 'confirmed' || r.status === 'host' ? '✓' : '·') : '…'; o.off = !(r && (r.status === 'confirmed' || r.status === 'host'));
    }
    if (ph === 'trial') {
      var sh = FL.shiftOf(snap);
      if (sh) {
        var rr = snap.runs.filter(function (x) { return x.team_id === tm.id && x.kind === 'trial' && x.L === sh.L; })[0];
        if (tm.present < sh.L) { o.badge = '–'; o.off = true; o.tag = t('k_short'); }
        else { o.badge = rr ? (rr.status === 'confirmed' || rr.status === 'host' ? '✓' : '·') : '…'; o.off = !(rr && (rr.status === 'confirmed' || rr.status === 'host')); if (rr) o.tag = rr.q + ' ' + t('rings'); }
      }
    }
    return o;
  }

  function tiles(snap, mini) {
    var list = FL.active(snap);
    var pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE)); tilePage = Math.min(tilePage, pages - 1);
    var visible = list.slice(tilePage * PAGE_SIZE, (tilePage + 1) * PAGE_SIZE);
    var tilesz = list.length > 12 ? 140 : list.length > 6 ? 165 : 220;
    var cols = visible.length > 12 ? 5 : visible.length > 6 ? 4 : visible.length > 3 ? 3 : Math.max(visible.length, 1);
    return '<div class="tile-panel"><div class="tiles' + (list.length > 6 ? ' many' : '') + (visible.length <= 3 ? ' few' : '') + '" style="--tile:' + tilesz + 'px;--cols:' + cols + '">' + visible.map(function (tm) {
      var o = tileInfo(snap, tm), pre = flip.armed && /^run/.test(snap.session.phase);
      return '<div class="tile ' + o.state + ' flip ' + (pre ? 'pre' : '') + (/^decide/.test(snap.session.phase) ? (o.locked ? ' decision-locked' : ' decision-waiting') : '') + '"><div class="in">' +
        (o.badge ? '<div class="badge ' + (o.off ? 'off' : '') + '">' + o.badge + '</div>' : '') +
        FL.factory(o.state, o.L, { label: tm.name }) +
        '<div class="nm" title="' + esc(tm.name) + '">' + esc(tm.name) + '</div><div class="sub">' + o.sub + '</div>' + (o.tag ? '<div class="tag' + (/^−/.test(o.tag) ? ' neg' : '') + '">' + esc(o.tag) + '</div>' : '') + '</div></div>';
    }).join('') + '</div>' + (pages > 1 ? '<div class="tile-pagination"><button class="btn sm" data-act="tilepage" data-d="-1"' + (!tilePage ? ' disabled' : '') + '>←</button><span>' + t('tile_page', tilePage + 1, pages) + '</span><button class="btn sm" data-act="tilepage" data-d="1"' + (tilePage === pages - 1 ? ' disabled' : '') + '>→</button></div>' : '') + '</div>';
  }
  FL.acts.tilepage = function (el) { tilePage = Math.max(0, tilePage + Number(el.dataset.d)); FL.render(true); };

  /* ------------------------------------------------ chart: trial points + class mean */
  function trialChart(snap) {
    var act = FL.active(snap), W = 640, H = 380, m = { l: 56, r: 20, t: 42, b: 48 };
    var byL = { 1: [], 2: [], 3: [], 4: [] }, series = [];
    act.forEach(function (tm) { var pts = C.trialPoints(snap.runs, tm.id); series.push(pts); for (var L = 1; L <= 4; L++) if (pts[L] != null) byL[L].push(pts[L]); });
    var maxQ = 1; for (var L0 = 1; L0 <= 4; L0++) byL[L0].forEach(function (q) { if (q > maxQ) maxQ = q; });
    maxQ = Math.ceil((maxQ + 1) / 2) * 2;
    var x = function (L) { return m.l + (W - m.l - m.r) * (L / 4); }, y = function (q) { return H - m.b - (H - m.t - m.b) * (q / maxQ); };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="' + t('chart_alt') + '">';
    s += '<text x="' + m.l + '" y="22" font-size="18" fill="#5b564e">' + t('chart_y', snap.session.params.secs) + '</text>';
    for (var g = 0; g <= maxQ; g += maxQ <= 10 ? 2 : 4) s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(g) + '" y2="' + y(g) + '" stroke="#e3dccd" stroke-width="2"/><text x="' + (m.l - 10) + '" y="' + (y(g) + 6) + '" text-anchor="end" font-size="18" fill="#5b564e">' + g + '</text>';
    for (var L = 0; L <= 4; L++) s += '<text x="' + x(L) + '" y="' + (H - 18) + '" text-anchor="middle" font-size="20" fill="#1c1b1a" font-weight="700">' + L + '</text>';
    s += '<text x="' + (W / 2) + '" y="' + (H - 0) + '" text-anchor="middle" font-size="16" fill="#5b564e">' + t('c_workers') + '</text>';
    series.forEach(function (pts) {
      var path = 'M' + x(0) + ' ' + y(0), any = false;
      for (var L = 1; L <= 4; L++) if (pts[L] != null) { path += ' L' + x(L) + ' ' + y(pts[L]); any = true; }
      if (any) s += '<path d="' + path + '" fill="none" stroke="#9a9488" stroke-width="2" opacity=".6"/>';
      for (var L2 = 1; L2 <= 4; L2++) if (pts[L2] != null) s += '<circle cx="' + x(L2) + '" cy="' + y(pts[L2]) + '" r="6" fill="#fff" stroke="#1c1b1a" stroke-width="2.5"/>';
    });
    var summary = C.trialSummary(snap.runs, act), mean = summary.cohortMean, mp = 'M' + x(0) + ' ' + y(0);
    for (var L3 = 1; L3 <= 4; L3++) if (mean[L3] != null) mp += ' L' + x(L3) + ' ' + y(mean[L3]);
    if (mean.length) { s += '<path d="' + mp + '" fill="none" stroke="#c2410c" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>'; for (var L4 = 1; L4 <= 4; L4++) if (mean[L4] != null) s += '<circle cx="' + x(L4) + '" cy="' + y(mean[L4]) + '" r="8" fill="#c2410c"/>'; }
    if (!mean.length) s += '<text x="350" y="185" text-anchor="middle" font-size="22" fill="#5b564e">' + t('chart_waiting') + '</text>';
    return { svg: s + '</svg>', mean: mean, n: summary.cohortN };
  }

  function meanTable(mean, n) {
    var rows = '';
    for (var L = 1; L <= 4; L++) if (mean[L] != null) rows += '<tr><td>' + L + '</td><td>' + FL.n2(mean[L]) + '</td><td>' + n + '</td></tr>';
    return rows ? '<table class="t"><tr><th>' + t('c_workers') + '</th><th>' + t('cohort_mean') + '</th><th>' + t('sample_n') + '</th></tr>' + rows + '</table><div class="tiny muted">' + t('cohort_note', n) + '</div>' : '';
  }

  /* ------------------------------------------------ phases */
  function progress(n, total) {
    if (!total) return '<div class="small muted">' + t('no_eligible') + '</div>';
    return '<div class="row" style="gap:16px"><div class="bar grow" style="height:26px"><i style="width:' + (total ? Math.round(100 * n / total) : 0) + '%"></i></div><div class="big num" style="font-weight:800">' + n + ' / ' + total + '</div></div>';
  }

  function lobbyScreen(snap) {
    var url = FL.baseURL() + '#/team/' + snap.session.code, list = FL.active(snap), people = list.reduce(function (s, x) { return s + x.present; }, 0);
    var shown = url.replace(/^https?:\/\//, '').replace(/#.*$/, ''), boxes = esc(snap.session.code).split('').map(function (ch) { return '<b>' + ch + '</b>'; }).join('');
    var right = list.length ? tiles(snap) : '<div class="lobby-empty"><div class="le-fac">' + FL.factory('open', 2) + '</div><div class="muted big">' + t('lobby_wait') + '</div></div>';
    return '<div class="lobby"><div class="lobby-card">' +
      '<div class="lc-kick">' + t('scan_join') + '</div><div class="qrframe">' + FL.qrSVG(url) + '</div>' +
      '<div class="lc-or"><span>' + t('or_type_code') + '</span></div><div class="codeboxes num">' + boxes + '</div>' +
      '<div class="lc-url">' + esc(shown) + '</div></div>' +
      '<div class="grow stack"><div class="row"><h2 class="grow lobby-h">' + t('joined_h', list.length, people) + '</h2></div>' + right + '</div></div>';
  }

  function trialScreen(snap) {
    var sh = FL.shiftOf(snap), L = sh ? sh.L : null, ch = trialChart(snap), act = FL.active(snap);
    var producing = L ? act.filter(function (x) { return x.present >= L; }) : [];
    var done = L ? producing.filter(function (x) { return snap.runs.some(function (r) { return r.team_id === x.id && r.kind === 'trial' && r.L === L && (r.status === 'confirmed' || r.status === 'host'); }); }).length : 0;
    return '<div class="row gap" style="align-items:flex-start"><div class="grow stack" style="min-width:0">' +
      '<div class="card dark row shift-stage"><div class="grow"><div class="huge">' + (L ? t('trial_shift', L) : t('trial_wait_s')) + '</div></div>' +
      '<div style="width:300px">' + FL.cdHTML(snap) + '</div></div>' +
      (L ? '<div class="card stack"><div class="big" style="font-weight:800">' + t('verified_progress') + '</div>' + progress(done, producing.length) + '</div>' : '') +
      tiles(snap) + '</div>' +
      '<div class="stack" style="width:520px;flex:none"><div class="chartbox"><div style="font-weight:800;font-size:20px;margin:0 6px 6px">' + t('chart_h') + '</div>' + ch.svg + '</div>' + (meanTable(ch.mean, ch.n) ? '<div class="card">' + meanTable(ch.mean, ch.n) + '</div>' : '') + '</div></div>';
  }

  function marketScreen(snap) {
    var par = snap.session.params, ch = trialChart(snap);
    if (!FL.marketPublished(snap)) return FL.marketWaiting();
    return '<div class="q-cards"><div class="card"><div class="k">' + t('p_name') + '</div><div class="v">' + par.p + '</div></div>' +
      '<div class="card"><div class="k">' + t('w_name') + '</div><div class="v">' + par.w + '</div></div>' +
      '<div class="card"><div class="k">' + t('f_name') + '</div><div class="v">' + par.F + '</div></div></div>' +
      '<div class="card accent big" style="font-weight:700">' + t('market_screen_p', par.F) + '</div>' +
      '<div class="row gap" style="align-items:flex-start"><div class="chartbox grow mkt"><div style="font-weight:800;font-size:20px;margin:0 6px 6px">' + t('chart_h') + '</div>' + ch.svg + '</div><div class="card stack market-guide" style="width:430px;flex:none"><h2>' + t('market_compare') + '</h2><div class="banner"><b>' + t('period1') + '</b><p>' + t('market_today', par.F) + '</p></div><div class="banner"><b>' + t('period2') + '</b><p>' + t('market_next', par.F) + '</p></div><p>' + t('market_plan_hint') + '</p><div class="small muted">' + t('cohort_note', ch.n) + '</div></div></div>';
  }
  function decideScreen(snap, per) {
    var act = FL.active(snap), n = snap.locked.filter(function (x) { return x.period === per && act.some(function (a) { return a.id === x.team_id; }); }).length;
    return '<div class="card dark"><div class="huge">' + (per === 1 ? t('d1_screen') : t('d2_screen')) + '</div><div style="font-size:26px;margin-top:6px;opacity:.9">' + (per === 1 ? t('d1_screen_p', snap.session.params.F) : t('d2_screen_p', snap.session.params.F)) + '</div></div>' +
      '<div class="card stack"><div class="big" style="font-weight:800">' + t('submitted') + '</div>' + progress(n, act.length) + '</div>' + tiles(snap);
  }

  function summaryCards(snap, per) {
    var a = C.classAggregates(snap);
    var submitted = per === 1 ? a.decided1 : a.decided2;
    var cells = per === 1 ? [[a.opened1, t('s_open')], [a.stopped1, t('s_stop')]] : [[a.renew2, t('s_renew')], [a.exit2, t('s_exit')]];
    return '<div class="q-cards" style="grid-template-columns:repeat(2,1fr)">' + cells.map(function (c) { return '<div class="card"><div class="v">' + (submitted ? c[0] : '—') + '</div><div class="k">' + c[1] + '</div></div>'; }).join('') + '</div>' + (submitted < a.n ? '<div class="banner warn small">' + t('missing_decisions', a.n - submitted) + '</div>' : '');
  }

  function runScreen(snap, per) {
    var act = FL.active(snap), kind = per === 1 ? 'p1' : 'p2';
    var prod = act.filter(function (x) { var d = C.decisionOf(snap.decisions, x.id, per); return d && d.renew && d.L > 0; });
    var done = prod.filter(function (x) { return snap.runs.some(function (r) { return r.team_id === x.id && r.kind === kind && (r.status === 'confirmed' || r.status === 'host'); }); }).length;
    return '<div class="card dark row shift-stage"><div class="grow"><div class="huge">' + t('run_screen', per) + '</div></div><div style="width:300px">' + FL.cdHTML(snap) + '</div></div>' +
      summaryCards(snap, per) + '<div class="card production-progress"><span>' + t('verified_progress') + '</span>' + progress(done, prod.length) + '</div>' + tiles(snap);
  }

  function ledgerScreen(snap, per) {
    var par = snap.session.params, tm = C.featuredTeam(snap, per), body = '';
    if (!tm) body = '<div class="card ledger-feature empty-feature"><h2>' + t('no_featured_valid') + '</h2><p>' + t('first_rent_paid',sg(-par.F)) + '</p></div>';
    else {
      var l = C.ledger(tm, snap), p = l.periods[per], before = l.periods[1];
      var choice = !p.decided ? t('no_dec_short') : per === 2 && !p.renew ? t('exit') : p.L === 0 ? t('stop') : t('hire_n', p.L);
      var other = per === 1 ? (p.L > 0 ? t('stop') : t('open_option')) : p.renew ? t('exit') : t('renew');
      var diff = p.complete && p.counterfactual != null ? p.profit - p.counterfactual : null;
      body = '<div class="card ledger-feature"><div class="feature-identity"><div class="feature-icon">' + FL.factory(p.renew === false ? 'exit' : p.L > 0 ? 'open' : 'stop', p.L || 0, {label:tm.name}) + '</div><div><h2>' + esc(tm.name) + '</h2><div class="muted">' + t('table_n',tm.table_no) + '</div></div></div>' +
        '<div class="feature-duel"><div><span>' + choice + '</span><b>' + (p.complete ? sg(p.profit) : '—') + '</b></div><i>vs</i><div><span>' + other + (p.counterfactualKind === 'estimate' ? '*' : '') + '</span><b>' + (p.complete ? sg(p.counterfactual) : '—') + '</b></div></div>' +
        '<div class="feature-context"><div class="feature-difference">' + (diff == null ? t('comparison_unknown_short') : t('choice_delta',sg(diff)) + (p.counterfactualKind === 'estimate' ? '*' : '')) + '</div><div class="feature-arithmetic">' + (p.complete ? t('profit_arithmetic',FL.n2(p.rev),FL.n2(p.wage),FL.n2(p.rent)) : t('ledger_pending')) + '</div>' +
        (per === 2 ? '<div class="feature-periods">' + t('period_totals',before.complete?sg(before.profit):'—',p.complete?sg(p.profit):'—',sg(l.total)) + '</div>' : '') +
        (p.counterfactualKind === 'estimate' ? '<div class="estimate-note">* ' + t('est_note') + '</div>' : '') + '</div></div>';
    }
    return '<div class="ledger-layout">' + body + classComparison(snap,per) + '</div>';
  }

  function classComparison(snap, per) {
    var rows = C.comparisonRows(snap,per), comparable = rows.filter(function(r){return r.comparable;}), better = comparable.filter(function(r){return r.delta>0;}).length;
    var vals = [0]; rows.forEach(function(r){if(r.actual!=null)vals.push(r.actual);if(r.alternative!=null)vals.push(r.alternative);});
    var lo = Math.min.apply(null,vals), hi = Math.max.apply(null,vals), span = hi-lo || 1;
    lo -= span*.08; hi += span*.08;
    function x(v){return 100*(v-lo)/(hi-lo);}
    var bars = rows.map(function(r){
      var track = '<div class="profit-track"><i class="zero-guide" style="left:'+x(0)+'%"></i>';
      if(r.comparable)track += '<i class="profit-segment '+(r.delta<0?'worse':'better')+'" style="left:'+Math.min(x(r.actual),x(r.alternative))+'%;width:'+Math.abs(x(r.actual)-x(r.alternative))+'%"></i><i class="alternative-marker '+(r.estimated?'estimated':'')+'" style="left:'+x(r.alternative)+'%"></i><i class="actual-dot" style="left:'+x(r.actual)+'%"></i>';
      track += '</div>';
      return '<div class="profit-plot-row" data-team="'+esc(r.team.id)+'" data-actual="'+(r.actual==null?'':r.actual)+'" data-alternative="'+(r.alternative==null?'':r.alternative)+'" data-delta="'+(r.delta==null?'':r.delta)+'"><span class="plot-name" title="'+esc(r.team.name)+'">'+r.team.table_no+' · '+esc(r.team.name)+'</span>'+track+'<span class="plot-values">'+(r.actual==null?'—':sg(r.actual))+' <small>/ '+(r.alternative==null?'—':sg(r.alternative)+(r.estimated?'*':''))+'</small></span></div>';
    }).join('');
    return '<div class="card class-comparison chart-comparison"><div class="comparison-heading"><h2 class="class-aha">'+t('class_comparable_better',better,comparable.length)+'</h2><span>'+t(per===1?'class_vs_stop':'class_vs_alternative')+'</span></div><div class="plot-legend">'+t('profit_plot_legend')+'</div><div class="profit-plot" style="--plot-rows:'+Math.max(1,Math.ceil(rows.length/2))+'">'+bars+'</div><div class="plot-footer">'+t(per===1?'plot_stop_note':'plot_alternative_note')+(comparable.length<rows.length?' '+t('comparison_missing',rows.length-comparable.length):'')+'</div></div>';
  }

  function debriefScreen(snap) {
    var par = snap.session.params, a = C.classAggregates(snap);
    var N = a.n, actualReady = N > 0 && a.decided2 === N, pairedReady = N > 0 && a.paired === N, bins = {}, maxc = 1;
    a.predicts.forEach(function (p) { bins[p] = (bins[p] || 0) + 1; maxc = Math.max(maxc, bins[p]); });
    var bars = '';
    for (var k = 0; k <= N; k++) bars += '<div class="hist-bin' + (actualReady && k === a.exit2 ? ' actual-bin' : '') + '"><div class="hist-track">' + (actualReady && k === a.exit2 ? '<i class="actual-exit-line"></i><span class="actual-exit-label">' + t('actual_exits_n',a.exit2) + '</span>' : '') + '<div class="hist-bar" style="height:' + Math.round(100 * (bins[k] || 0) / maxc) + '%;background:' + (actualReady && k === a.exit2 ? 'var(--accent)' : '#ded8ce') + '">' + (bins[k] ? '<b>' + bins[k] + '</b>' : '') + '</div></div><div class="' + (actualReady && k === a.exit2 ? 'sign' : 'muted') + '">' + '<span class="hist-number">' + k + '</span>' + (actualReady && k === a.exit2 ? '<span class="actual-marker">▲</span>' : '') + '</div></div>';
    var hero = par.show_lesson ? '<div class="lesson-hero"><div class="lesson-formula">0 &lt; G &lt; F</div><div><h2>' + t('s_open_then_exit') + '</h2><p>' + t('lesson_rule') + '</p></div></div>' : '<div class="card accent outcome-banner">' + (pairedReady ? t('observed_open_exit',a.exitsAmongOpened) : t('forecast_pending',a.decided2,N)) + '</div>';
    return '<div class="q-cards summary-compact"><div class="card"><div class="v">' + (pairedReady ? a.exitsAmongOpened : '—') + '</div><div class="k">' + t('s_open_then_exit') + '</div></div>' +
      '<div class="card"><div class="v">' + (a.decided1 ? a.opened1 : '—') + '</div><div class="k">' + t('s_open') + '</div></div>' +
      '<div class="card"><div class="v">' + (actualReady ? a.exit2 : '—') + '</div><div class="k">' + t('s_exit') + '</div></div></div>' + (!actualReady ? '<div class="banner warn small">' + t('forecast_pending', a.decided2, N) + '</div>' : '') + hero +
      '<div class="row gap"><div class="card forecast-card"><h3>' + t('pred_vs_actual') + '</h3>' + (a.predicts.length ? '<div class="histogram">' + bars + '</div><div class="hist-caption">' + t('forecast_axis') + '</div><div class="small muted">' + (actualReady ? t('pred_note') : t('forecast_pending', a.decided2, N)) + '</div>' : '<div class="muted">' + t('no_forecasts') + '</div>') + '</div>' +
      '<div class="card debrief-lesson">' + (par.show_lesson ? FL.lessonHTML() : '<h2>' + t('slip_h') + '</h2><p>' + t('slip_q', par.F) + '</p>') + '</div></div>';
  }

  /* ------------------------------------------------ main */
  FL.views.screen = function (r) {
    var snap = FL.snap();
    if (!r.code) return '<div class="screenwrap"><div class="card stack" style="max-width:520px"><h1>' + t('screen_title') + '</h1><label class="field"><span>' + t('room_code') + '</span><input id="sc_code" type="text" maxlength="4" style="text-transform:uppercase;font-size:34px;font-weight:800;letter-spacing:.2em"></label><button class="btn primary block" data-act="screengo">' + t('enter') + '</button></div></div>';
    if (!snap) return '<div class="screenwrap"><div class="card big center">' + t('loading') + ' ' + esc(r.code) + '</div></div>';
    var ph = snap.session.phase;
    // arm the flip animation once when production starts
    if (flip.from !== ph) { tilePage = 0; flip.armed = (ph === 'run1' && flip.from === 'decide1') || (ph === 'run2' && flip.from === 'decide2'); flip.from = ph; }
    var body = ({ lobby: lobbyScreen, trial: trialScreen, market: marketScreen, decide1: function (s) { return decideScreen(s, 1); }, run1: function (s) { return runScreen(s, 1); },
      ledger1: function (s) { return ledgerScreen(s, 1); }, decide2: function (s) { return decideScreen(s, 2); }, run2: function (s) { return runScreen(s, 2); },
      ledger2: function (s) { return ledgerScreen(s, 2); }, debrief: debriefScreen })[ph](snap);
    return '<div class="screenwrap">' + head(snap) + '<div class="screenbody phase-' + ph + '">' + body + '</div></div>';
  };
  FL.views.screen.after = function () {
    if (flip.armed) { var armed = flip; setTimeout(function () { armed.armed = false; FL.$$('.tile.flip.pre').forEach(function (n, i) { setTimeout(function () { n.classList.remove('pre'); }, 120 * i); }); }, 700); }
  };
  FL.acts.screengo = function () { var c = FL.$('#sc_code').value.toUpperCase().trim(); if (c.length === 4) { FL.go('#/screen/' + c); FL.boot(); } };
  FL.acts.sound = function () { FL.enableSound(); };
})();
