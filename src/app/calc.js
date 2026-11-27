/* Factory LIVE — pure game maths. No DOM, no network. */
(function (root) {
  'use strict';

  var PHASES = ['lobby', 'trial', 'market', 'decide1', 'run1', 'ledger1', 'decide2', 'run2', 'ledger2', 'debrief'];
  var EXTENDED_PHASES = ['lobby', 'practice', 'trial', 'market', 'decide0', 'run0', 'ledger0', 'decide1', 'run1', 'ledger1', 'decide2', 'run2', 'ledger2', 'debrief'];
  function phasesFor(params) { return params && params.extended_rounds ? EXTENDED_PHASES : PHASES; }
  function phasePeriod(phase) { return /^(decide|run|ledger)[012]$/.test(phase) ? Number(phase.slice(-1)) : null; }
  function roundNumber(period, params) { return params && params.extended_rounds ? period + 1 : period; }
  function shiftSeconds(params, phase) {
    return phase === 'practice' ? (params.practice_secs || 30) : phase === 'trial' ? (params.trial_secs || params.secs || 20) : (params.secs || 20);
  }
  // Scaling is a planning estimate, never an observed production result.
  function productionPoints(runs, teamId, params) {
    var pts = trialPoints(runs, teamId), out = {}, ratio = shiftSeconds(params, 'run1') / shiftSeconds(params, 'trial');
    Object.keys(pts).forEach(function (L) { out[L] = pts[L] * ratio; });
    if (params.extended_rounds) ['p0','p1'].forEach(function (kind) {
      runs.forEach(function (r) { if (r.team_id === teamId && r.kind === kind && (r.status === 'confirmed' || r.status === 'host')) out[r.L] = r.q; });
    });
    return out;
  }

  // Decisions are revealed from the moment production starts.
  function revealFor(phase) {
    var i = PHASES.indexOf(phase);
    if (i >= PHASES.indexOf('run2')) return 2;
    if (i >= PHASES.indexOf('run1')) return 1;
    return 0;
  }

  // Trial points {L: q} for one team, verified or entered by the teacher.
  function trialPoints(runs, teamId) {
    var pts = {};
    runs.forEach(function (r) {
      if (r.team_id === teamId && r.kind === 'trial' && (r.status === 'confirmed' || r.status === 'host')) pts[r.L] = r.q;
    });
    return pts;
  }

  function net(p, w, L, q) { return p * q - w * L; }            // 營收扣工資
  function profit(p, w, F, L, q) { return p * q - w * L - F; }  // rent already counted once

  // Adjacent headcounts must be compared within the same factory: class
  // membership changes when smaller teams cannot run the higher headcount.
  function trialSummary(runs, teams) {
    var mean = [], marginal = [], counts = [], pairedCounts = [];
    var series = teams.filter(function (tm) { return tm.present > 0; }).map(function (tm) { return trialPoints(runs, tm.id); });
    for (var L = 1; L <= 4; L++) {
      var qs = [], deltas = [];
      series.forEach(function (pts) {
        if (pts[L] == null) return;
        qs.push(pts[L]);
        if (L === 1 || pts[L - 1] != null) deltas.push(pts[L] - (L === 1 ? 0 : pts[L - 1]));
      });
      counts[L] = qs.length; pairedCounts[L] = deltas.length;
      if (qs.length) mean[L] = qs.reduce(function (a, b) { return a + b; }, 0) / qs.length;
      if (deltas.length) marginal[L] = deltas.reduce(function (a, b) { return a + b; }, 0) / deltas.length;
    }
    var maxL = 0; series.forEach(function (pts) { Object.keys(pts).forEach(function (k) { maxL = Math.max(maxL, +k); }); });
    var cohort = series.filter(function (pts) { for (var k = 1; k <= maxL; k++) if (pts[k] == null) return false; return maxL > 0; });
    var cohortMean = [];
    for (var k = 1; k <= maxL; k++) if (cohort.length) cohortMean[k] = cohort.reduce(function (sum, pts) { return sum + pts[k]; }, 0) / cohort.length;
    return { mean: mean, marginal: marginal, counts: counts, pairedCounts: pairedCounts, cohortMean: cohortMean, cohortN: cohort.length, maxL: maxL };
  }

  // Rows for the decision table: every tested L plus L=0.
  function planRows(points, p, w) {
    var Ls = Object.keys(points).map(Number).sort(function (a, b) { return a - b; });
    var rows = [{ L: 0, q: 0, rev: 0, wage: 0, net: 0, dV: null, tested: true }];
    var prevQ = 0, prevL = 0;
    Ls.forEach(function (L) {
      var q = points[L];
      // value of the extra workers relative to the previous tested headcount
      var dq = q - prevQ, dL = L - prevL;
      rows.push({
        L: L, q: q, rev: p * q, wage: w * L, net: net(p, w, L, q),
        dV: p * dq, dW: w * dL, dq: dq, dL: dL, tested: true,
        mc: dq > 0 ? (w * dL) / dq : null
      });
      prevQ = q; prevL = L;
    });
    return rows;
  }

  // Best feasible plan; ties go to fewer workers.
  function bestPlan(points, p, w) {
    var rows = planRows(points, p, w);
    var best = rows[0];
    rows.forEach(function (r) { if (r.net > best.net) best = r; });
    return { L: best.L, G: best.net, rows: rows };
  }

  function decisionOf(decisions, teamId, period) {
    for (var i = 0; i < decisions.length; i++) {
      var d = decisions[i];
      if (d.team_id === teamId && d.period === period) return d;
    }
    return null;
  }

  function runOf(runs, teamId, kind, L) {
    for (var i = 0; i < runs.length; i++) {
      var r = runs[i];
      if (r.team_id === teamId && r.kind === kind && (L == null || r.L === L)) return r;
    }
    return null;
  }

  // Full two-period ledger for one team. Missing data stays null rather than guessed.
  function ledger(team, snap) {
    var par = snap.session.params, p = par.p, w = par.w, F = par.F;
    var pts = productionPoints(snap.runs, team.id, par);
    var plan = bestPlan(pts, p, w);
    var operating = plan.rows.filter(function (r) { return r.L > 0; }).sort(function (a, b) { return b.net - a.net || a.L - b.L; })[0];
    var out = { team: team, params: { p: p, w: w, F: F }, points: pts, plan: plan, periods: {} };

    (par.extended_rounds ? [0, 1, 2] : [1, 2]).forEach(function (k) {
      var d = decisionOf(snap.decisions, team.id, k);
      var P = { period: k, decided: !!d, renew: d ? d.renew : null, L: d ? d.L : null, predict: d ? d.predict : null,
        rent: k < 2 ? F : (d ? (d.renew ? F : 0) : null), complete: false };
      if (d) {
        if (k === 2 && !d.renew) {
          P.q = null; P.rev = 0; P.wage = 0; P.rent = 0; P.profit = 0;
          P.counterfactual = Object.keys(pts).length ? plan.G - F : null;
          P.counterfactualKind = 'estimate';
          P.complete = true;
        } else if (d.L === 0) {
          P.q = 0; P.rev = 0; P.wage = 0; P.rent = F; P.profit = -F;
          P.counterfactual = k === 2 ? 0 : (operating ? operating.net - F : null);
          P.counterfactualKind = k === 2 ? 'exact' : 'estimate';
          P.complete = true;
        } else {
          var r = runOf(snap.runs, team.id, 'p' + k, d.L);
          if (r && (r.status === 'confirmed' || r.status === 'host')) {
            P.q = r.q; P.rev = p * r.q; P.wage = w * d.L; P.rent = F; P.profit = p * r.q - w * d.L - F;
            P.counterfactual = k < 2 ? -F : 0;       // stop within lease / exit at renewal
            P.counterfactualKind = 'exact';
            P.complete = true;
          } else {
            P.q = r ? r.q : null; P.pending = true; P.complete = false;
          }
        }
      }
      out.periods[k] = P;
    });

    var p1 = out.periods[1], p2 = out.periods[2];
    out.total = p1.complete && p2.complete ? p1.profit + p2.profit : null;
    if (par.extended_rounds) out.total = out.total != null && out.periods[0].complete ? out.total + out.periods[0].profit : null;
    out.openThenExit = !!(p1.decided && p1.L > 0 && p2.decided && !p2.renew);
    return out;
  }

  function isExitExample(l) {
    var a = l.periods[1], b = l.periods[2];
    return !!(l.openThenExit && a.complete && b.complete && l.plan.G > 0 && b.counterfactual != null && b.profit > b.counterfactual);
  }
  function featuredTeam(snap, period) {
    var par = snap.session.params, teams = snap.teams.filter(function (tm) { return tm.present > 0; });
    var explicit = par.featured_period === period || (period === 1 && par.featured_period == null);
    if (explicit && par.featured) {
      var selected = teams.filter(function (tm) { return tm.id === par.featured; })[0];
      if (selected) return selected;
    }
    var scored = teams.map(function (tm) {
      var l = ledger(tm, snap), p = l.periods[period], rank = 99;
      if (period < 2 && p.complete) rank = p.L > 0 && p.profit < 0 && p.profit > -par.F ? 0 : 2;
      if (period === 2 && p.complete && p.counterfactual != null && p.profit >= p.counterfactual) rank = isExitExample(l) ? 0 : 1;
      return { team: tm, rank: rank };
    }).filter(function (x) { return x.rank < 99; }).sort(function (a, b) { return a.rank - b.rank || a.team.table_no - b.team.table_no; });
    return scored.length ? scored[0].team : null;
  }
  function comparisonRows(snap, period) {
    return snap.teams.filter(function (tm) { return tm.present > 0; }).map(function (tm) {
      var p = ledger(tm, snap).periods[period], base = period < 2 ? -snap.session.params.F : p.counterfactual;
      var actual = p.complete ? p.profit : null, comparable = p.complete && base != null;
      return { team: tm, actual: actual, alternative: base == null ? null : base, delta: comparable ? actual - base : null,
        estimated: period === 2 && p.counterfactualKind === 'estimate', comparable: comparable,
        choice: !p.decided ? 'missing' : period < 2 ? (p.L > 0 ? 'work' : 'stop') : (p.renew ? 'renew' : 'exit') };
    });
  }

  // Aggregates for the projector and debrief
  function classAggregates(snap) {
    var teams = snap.teams.filter(function (t) { return t.present > 0; });
    var res = { n: teams.length, decided1: 0, decided2: 0, paired: 0, opened1: 0, stopped1: 0, renew2: 0, exit2: 0, openThenExit: [], predicts: [], exitsAmongOpened: 0 };
    teams.forEach(function (t) {
      var d1 = decisionOf(snap.decisions, t.id, 1), d2 = decisionOf(snap.decisions, t.id, 2);
      if (d1) { res.decided1++; if (d1.L > 0) res.opened1++; else res.stopped1++; }
      if (d1 && d2) res.paired++;
      if (d2) {
        res.decided2++;
        if (d2.renew) res.renew2++; else res.exit2++;
        if (d2.predict != null) res.predicts.push(d2.predict);
        if (d1 && d1.L > 0 && !d2.renew) { res.exitsAmongOpened++; res.openThenExit.push(t.id); }
      }
    });
    return res;
  }

  // Pair the actual roster, not table-number parity. Last three form a cycle
  // when the roster is odd, so every table counts and is counted exactly once.
  function verifierOf(team, teams) {
    var roster = teams.filter(function (t) { return t.present > 0; }).slice().sort(function (a, b) { return a.table_no - b.table_no; });
    var i = roster.findIndex(function (t) { return t.id === team.id; }), n = roster.length;
    if (i < 0 || n < 2) return null;
    if (n % 2 && i >= n - 3) return roster[n - 3 + (i - (n - 3) + 1) % 3];
    return roster[i % 2 ? i - 1 : i + 1];
  }

  // Which table does `team` verify? (inverse of verifierOf; may be several for an odd class)
  function verifies(team, teams) {
    return teams.filter(function (t) {
      if (t.id === team.id || t.present <= 0) return false;
      var v = verifierOf(t, teams);
      return v && v.id === team.id;
    });
  }

  // Suggest (p, w, F) so that as many teams as possible have 0 < G < F.
  // `teamPoints`: array of {L:q} objects (one per team with data).
  function recommend(teamPoints, opts) {
    opts = opts || {};
    var pMax = opts.pMax || 8, wMax = opts.wMax || 14;
    var usable = teamPoints.filter(function (pts) { return Object.keys(pts).length >= 2; });
    if (usable.length < 2) return [];
    var cands = [];
    for (var p = 1; p <= pMax; p++) {
      for (var w = 1; w <= wMax; w++) {
        var Gs = usable.map(function (pts) { return bestPlan(pts, p, w).G; }).sort(function (a, b) { return a - b; });
        var pos = Gs.filter(function (g) { return g > 0; });
        if (pos.length < 2) continue;
        // try each integer F in (min positive G, max G+2]; count teams in the "aha" band 0<G<F
        var lo = pos[0] + 1, hi = Gs[Gs.length - 1] + 2;
        for (var F = lo; F <= hi; F++) {
          var aha = Gs.filter(function (g) { return g > 0 && g < F; }).length;
          var above = Gs.filter(function (g) { return g >= F; }).length;
          var zero = Gs.filter(function (g) { return g <= 0; }).length;
          // we want most teams in the band, a few above (renew is sensible for them), few at zero
          var nn = usable.length, score = 10 * Math.min(aha, Math.ceil(0.75 * nn)) + 8 * Math.min(above, Math.ceil(0.25 * nn)) - 6 * zero - Math.abs(p - 2) * 0.1 - Math.abs(w - 2 * p) * 0.05;
          cands.push({ p: p, w: w, F: F, aha: aha, above: above, zero: zero, n: usable.length, score: score });
        }
      }
    }
    cands.sort(function (a, b) { return b.score - a.score; });
    // keep the best per (p,w) pair, then the top few distinct ones
    var seen = {}, out = [];
    cands.forEach(function (c) {
      var k = c.p + '/' + c.w;
      if (!seen[k] && out.length < 6) { seen[k] = 1; out.push(c); }
    });
    return out;
  }

  /* Factory names: simple, common English words, shown identically in both languages. */
  var NAME_POOL = ['Apple', 'Panda', 'Tiger', 'Sunny', 'River', 'Star', 'Maple', 'Ocean', 'Rocket', 'Lemon', 'Cloud', 'Berry',
    'Mango', 'Comet', 'Falcon', 'Ginger', 'Harbor', 'Jade', 'Kiwi', 'Lotus', 'Moon', 'Olive', 'Pepper', 'Robin', 'Tulip',
    'Willow', 'Zebra', 'Amber', 'Bamboo', 'Cedar', 'Dolphin', 'Forest', 'Honey', 'Island', 'Koala', 'Lion', 'Meadow', 'Peach',
    'Rain', 'Snow', 'Wave', 'Coral', 'Daisy', 'Eagle', 'Fox', 'Grape', 'Hill', 'Ivy', 'Jelly', 'Lake', 'Mint', 'Nut', 'Owl',
    'Pine', 'Rose', 'Sky', 'Tea', 'Violet', 'Wolf', 'Bear', 'Cherry', 'Dune', 'Fern', 'Gold'];
  var NAME_MAX = 16, NAME_RE = /^[A-Za-z][A-Za-z0-9 .'&-]{0,15}$/; // short names stay readable on a 20-tile projector
  function cleanName(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function validName(s) { return NAME_RE.test(cleanName(s)); }
  // Older rooms may hold non-English names. Show a stable English stand-in keyed by table number;
  // the stored name, team id, table and records are never changed.
  function displayName(team) {
    var n = cleanName(team && team.name);
    if (validName(n)) return n;
    var tbl = team && team.table_no ? team.table_no : 1;
    return NAME_POOL[(tbl - 1) % NAME_POOL.length] + (tbl > NAME_POOL.length ? ' ' + Math.ceil(tbl / NAME_POOL.length) : '');
  }

  /* Assigned class list (session.params.roster = { names: [...] }): table i+1 gets names[i]. */
  function rosterOf(params) {
    var r = params && params.roster;
    return r && Object.prototype.toString.call(r.names) === '[object Array]' && r.names.length ? r.names.slice() : null;
  }
  function defaultRoster(n, keep) {
    var out = (keep || []).slice(0, n), used = {};
    out.forEach(function (x) { used[String(x).toLowerCase()] = 1; });
    for (var i = 0; out.length < n && i < NAME_POOL.length * 3; i++) {
      var cand = NAME_POOL[i % NAME_POOL.length] + (i >= NAME_POOL.length ? ' ' + (Math.floor(i / NAME_POOL.length) + 1) : '');
      if (!used[cand.toLowerCase()]) { used[cand.toLowerCase()] = 1; out.push(cand); }
    }
    return out;
  }
  // Check a check-in against the list. Case and surrounding/double spaces are ignored; the canonical name is returned.
  function rosterCheck(names, table, typed) {
    var want = cleanName(typed).toLowerCase();
    if (!(table >= 1 && table <= names.length)) return { ok: false, err: 'roster_table', n: names.length };
    if (cleanName(names[table - 1]).toLowerCase() === want) return { ok: true, name: names[table - 1] };
    for (var i = 0; i < names.length; i++) if (cleanName(names[i]).toLowerCase() === want) return { ok: false, err: 'roster_other', other: i + 1, name: names[i] };
    return { ok: false, err: 'roster_name' };
  }

  var api = {
    PHASES: PHASES, phasesFor: phasesFor, phasePeriod: phasePeriod, roundNumber: roundNumber, shiftSeconds: shiftSeconds, productionPoints: productionPoints, revealFor: revealFor, trialPoints: trialPoints, net: net, profit: profit,
    planRows: planRows, bestPlan: bestPlan, trialSummary: trialSummary, decisionOf: decisionOf, runOf: runOf, ledger: ledger,
    isExitExample: isExitExample, featuredTeam: featuredTeam, comparisonRows: comparisonRows,
    classAggregates: classAggregates, verifierOf: verifierOf, verifies: verifies, recommend: recommend,
    NAME_POOL: NAME_POOL, rosterOf: rosterOf, defaultRoster: defaultRoster, rosterCheck: rosterCheck, validName: validName, cleanName: cleanName, displayName: displayName
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FLCalc = api;
})(typeof window !== 'undefined' ? window : this);
