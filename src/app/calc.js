/* Factory LIVE — pure game maths. No DOM, no network. */
(function (root) {
  'use strict';

  var PHASES = ['lobby', 'trial', 'market', 'decide1', 'run1', 'ledger1', 'decide2', 'run2', 'ledger2', 'debrief'];

  // Decisions are revealed from the moment production starts.
  function revealFor(phase) {
    var i = PHASES.indexOf(phase);
    if (i >= PHASES.indexOf('run2')) return 2;
    if (i >= PHASES.indexOf('run1')) return 1;
    return 0;
  }

  // Trial points {L: q} for one team (all statuses except nothing yet)
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
    return { mean: mean, marginal: marginal, counts: counts, pairedCounts: pairedCounts };
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
    var pts = trialPoints(snap.runs, team.id);
    var plan = bestPlan(pts, p, w);
    var operating = plan.rows.filter(function (r) { return r.L > 0; }).sort(function (a, b) { return b.net - a.net || a.L - b.L; })[0];
    var out = { team: team, params: { p: p, w: w, F: F }, points: pts, plan: plan, periods: {} };

    [1, 2].forEach(function (k) {
      var d = decisionOf(snap.decisions, team.id, k);
      var P = { period: k, decided: !!d, renew: d ? d.renew : null, L: d ? d.L : null, predict: d ? d.predict : null,
        rent: k === 1 ? F : (d ? (d.renew ? F : 0) : null), complete: false };
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
          var r = runOf(snap.runs, team.id, k === 1 ? 'p1' : 'p2', d.L);
          if (r && (r.status === 'confirmed' || r.status === 'host')) {
            P.q = r.q; P.rev = p * r.q; P.wage = w * d.L; P.rent = F; P.profit = p * r.q - w * d.L - F;
            P.counterfactual = k === 1 ? -F : 0;       // stop today / exit next period
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
    out.openThenExit = !!(p1.decided && p1.L > 0 && p2.decided && !p2.renew);
    return out;
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

  var api = {
    PHASES: PHASES, revealFor: revealFor, trialPoints: trialPoints, net: net, profit: profit,
    planRows: planRows, bestPlan: bestPlan, trialSummary: trialSummary, decisionOf: decisionOf, runOf: runOf, ledger: ledger,
    classAggregates: classAggregates, verifierOf: verifierOf, verifies: verifies, recommend: recommend
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FLCalc = api;
})(typeof window !== 'undefined' ? window : this);
