/* Factory LIVE — visual / haptic feedback. Pure decoration: nothing here changes game state. */
(function () {
  'use strict';
  var FL = window.FL, fx = FL.fx = {};
  var reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* ignore */ }

  fx.buzz = function (ms) { try { if (!reduced && navigator.vibrate) navigator.vibrate(ms || 30); } catch (e) { /* ignore */ } };

  var COLORS = ['#c2410c', '#1c1917', '#f59e0b', '#ea580c', '#78716c'];
  fx.confetti = function (x, y, n) {
    if (reduced) return;
    n = n || 26;
    var host = document.createElement('div');
    host.className = 'fx-layer';
    for (var i = 0; i < n; i++) {
      var s = document.createElement('i');
      var ang = Math.random() * Math.PI * 2, dist = 70 + Math.random() * 150;
      s.style.cssText = 'left:' + x + 'px;top:' + y + 'px;background:' + COLORS[i % COLORS.length] +
        ';--dx:' + Math.round(Math.cos(ang) * dist) + 'px;--dy:' + Math.round(Math.sin(ang) * dist - 90) + 'px;--rot:' + Math.round(Math.random() * 720 - 360) + 'deg;' +
        'animation-delay:' + Math.round(Math.random() * 90) + 'ms;width:' + (6 + Math.random() * 7) + 'px;height:' + (9 + Math.random() * 8) + 'px';
      host.appendChild(s);
    }
    document.body.appendChild(host);
    setTimeout(function () { if (host.parentNode) host.parentNode.removeChild(host); }, 1700);
  };
  fx.rain = function () { // projector celebration: several bursts across the top
    var w = window.innerWidth;
    [0.2, 0.5, 0.8].forEach(function (f, i) { setTimeout(function () { fx.confetti(w * f, window.innerHeight * 0.25, 30); }, i * 220); });
  };

  function countUp(el) {
    var txt = el.textContent.trim(), m = /^([+−-]?)(\d+)$/.exec(txt);
    if (!m || el.children.length) return;
    var target = +m[2], neg = m[1] === '−' || m[1] === '-', plus = m[1] === '+';
    if (target < 2) return;
    var t0 = null, dur = 650;
    function step(ts) {
      if (t0 == null) t0 = ts;
      var k = Math.min(1, (ts - t0) / dur), v = Math.round(target * (1 - Math.pow(1 - k, 3)));
      el.textContent = (neg ? '−' : plus ? '+' : '') + v;
      if (k < 1) requestAnimationFrame(step);
    }
    el.textContent = (neg ? '−' : plus ? '+' : '') + '0';
    requestAnimationFrame(step);
  }

  var lastKey = null;
  function afterRender() {
    var r = FL.route(), snap = FL.snap();
    if (!snap || (r.role !== 'team' && r.role !== 'screen')) { lastKey = null; return; }
    var ph = snap.session.phase, key = r.role + ':' + ph;
    if (key === lastKey) return;
    var first = lastKey === null;
    lastKey = key;
    var app = FL.$('#app');
    if (!app) return;
    app.classList.remove('phase-in'); void app.offsetWidth; app.classList.add('phase-in'); clearTimeout(fx._pi); fx._pi = setTimeout(function () { app.classList.remove('phase-in'); }, 700);
    if (first || reduced) return;
    FL.$$('#app .huge, #app .num.big, #app .stat .n').forEach(countUp);
    if (ph === 'ledger1' || ph === 'ledger2' || ph === 'debrief') {
      if (r.role === 'screen') { fx.rain(); if (FL.soundOn && FL.beep) { FL.beep(660, 0.12); setTimeout(function () { FL.beep(880, 0.25); }, 140); } }
      else if (FL.me && FL.C) {
        try {
          var me = FL.team(snap, FL.me.team_id), P = window.FLCalc.ledger(me, snap).periods[ph === 'ledger2' ? 2 : 1];
          if (P && P.complete && P.profit > 0) { fx.confetti(window.innerWidth / 2, 160, 34); fx.buzz([40, 40, 80]); }
          else fx.buzz(40);
        } catch (e) { /* ignore */ }
      }
    } else if (r.role === 'team' && (ph === 'trial' || ph === 'decide1' || ph === 'decide2' || ph === 'run1' || ph === 'run2')) {
      fx.buzz(30);
    }
  }
  var baseRender = FL.render;
  FL.render = function (force) { baseRender(force); try { afterRender(); } catch (e) { /* ignore */ } };

  // last-3-seconds pulse on the countdown
  var baseTick = FL.tick;
  FL.tick = function () {
    baseTick();
    try {
      var snap = FL.snap(); if (!snap) return;
      var st = FL.shiftState(FL.shiftOf(snap)), hot = st.st === 'run' && st.n <= 3;
      FL.$$('[data-cd]').forEach(function (b) { b.classList.toggle('hot', hot); });
      if (hot && st.n !== fx._lastHot) { fx._lastHot = st.n; fx.buzz(20); }
    } catch (e) { /* ignore */ }
  };

  // click feedback: confetti when a team locks in / confirms a count
  function wrapAct(name, n, ms) {
    var o = FL.acts[name]; if (!o) return;
    FL.acts[name] = function (el, e) {
      var res = o(el, e);
      if (e && e.clientX != null) fx.confetti(e.clientX, e.clientY, n);
      fx.buzz(ms);
      return res;
    };
  }
  wrapAct('lock1', 22, 50); wrapAct('lock2', 22, 50); wrapAct('confirm', 12, 30); wrapAct('report', 8, 25);
})();
