/* Factory LIVE — "juice": synthesized sound, rubber stamps, split-flap reveal, sequential result reveals.
   Pure presentation. Nothing here reads or writes game state beyond the snapshot, and every effect
   degrades to nothing when audio is unavailable or the viewer prefers reduced motion. */
(function () {
  'use strict';
  var FL = window.FL;
  var reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* ignore */ }

  /* ------------------------------------------------------------------ audio engine */
  var ac = null, master = null, noiseBuf = null;
  function role() { try { return FL.route().role; } catch (e) { return ''; } }
  function muted() { try { return FL.ls.get('fl_sfx_mute') === '1'; } catch (e) { return false; } }
  function ctx() {
    if (ac) return ac;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = role() === 'screen' ? 0.7 : 0.32; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 1.2, ac.sampleRate);
      var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null; }
    return ac;
  }
  function live() { return ac && master && FL.soundOn && !muted(); }
  function env(g, t, a, peak, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
  function tone(type, f0, f1, dur, peak, delay, a) {
    if (!live()) return;
    var t = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, a || 0.008, peak, dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, peak, filt, f0, f1, delay, q) {
    if (!live()) return;
    var t = ac.currentTime + (delay || 0), s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = filt; f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q || 1;
    env(g, t, 0.004, peak, dur); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.05);
  }

  var sfx = FL.sfx = {
    click: function () { noise(0.035, 0.25, 'highpass', 2400, 0, 0, 0.7); },
    flap: function (d) { noise(0.03, 0.35, 'bandpass', 3200, 1800, d, 2); tone('square', 180, 120, 0.03, 0.05, d); },
    tick: function (hot) { tone('sine', hot ? 1560 : 1180, 0, 0.05, hot ? 0.5 : 0.3); },
    bell: function () { // factory shift bell
      [1, 2.76, 5.4].forEach(function (m, i) { tone('sine', 520 * m, 0, 1.4 - i * 0.3, 0.35 / (i + 1)); });
      for (var k = 0; k < 4; k++) tone('triangle', 1040, 0, 0.08, 0.12, k * 0.09);
    },
    horn: function () { // end-of-shift whistle
      tone('sawtooth', 233, 226, 0.9, 0.16, 0, 0.06); tone('sawtooth', 294, 286, 0.9, 0.12, 0, 0.06); noise(0.9, 0.05, 'lowpass', 900, 600);
    },
    stamp: function () { tone('sine', 150, 48, 0.18, 0.9); noise(0.07, 0.6, 'lowpass', 1400, 300); noise(0.02, 0.4, 'highpass', 3000, 0, 0.005); },
    coin: function () { tone('square', 988, 0, 0.09, 0.18); tone('square', 1319, 0, 0.45, 0.16, 0.08); tone('sine', 2637, 0, 0.5, 0.06, 0.08); },
    thud: function () { tone('sine', 110, 70, 0.22, 0.5); },
    chime: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone('triangle', f, 0, 0.5, 0.22, i * 0.09); }); },
    whoosh: function () { noise(0.32, 0.18, 'bandpass', 400, 2600, 0, 1.4); },
    shutter: function () { for (var i = 0; i < 9; i++) noise(0.05, 0.22, 'bandpass', 900 - i * 60, 0, i * 0.055, 3); tone('sine', 90, 60, 0.2, 0.4, 0.5); },
    pop: function (d) { tone('sine', 420, 760, 0.07, 0.18, d); },
    shift: function (st, s) {
      if (st.st === 'pre') sfx.tick(false);
      else if (st.st === 'run' && st.n === s.secs) sfx.bell();
      else if (st.st === 'run' && st.n <= 3) sfx.tick(true);
      else if (st.st === 'done') sfx.horn();
    },
    toggleHTML: function () {
      var on = !muted();
      return '<button class="btn sm ghost sfx-toggle" data-act="sfxtoggle" aria-pressed="' + on + '" aria-label="' + FL.t(on ? 'sound_mute' : 'sound_unmute') + '" title="' + FL.t(on ? 'sound_mute' : 'sound_unmute') + '">' +
        '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>' + (on ? '<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' : '<path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>') + '</svg></button>';
    }
  };

  // Projector: reuse the existing "enable sound" button, but route it through this engine.
  FL.enableSound = function () {
    if (!ctx()) { FL.soundOn = false; return; }
    if (ac.state === 'suspended') ac.resume();
    FL.soundOn = true; FL.ls.del && FL.ls.del('fl_sfx_mute'); sfx.chime(); FL.render(true);
  };
  FL.beep = function (f, d) { tone('sine', f, 0, d || 0.15, 0.25); };
  FL.acts.sfxtoggle = function () {
    if (muted()) { FL.ls.del('fl_sfx_mute'); if (ctx()) { if (ac.state === 'suspended') ac.resume(); FL.soundOn = true; sfx.pop(); } }
    else FL.ls.set('fl_sfx_mute', '1');
    FL.render(true);
  };
  // Phones: audio unlocks on the first tap (browsers require a gesture); every button press gets a soft click.
  document.addEventListener('pointerdown', function (e) {
    if (role() === 'screen' || muted()) return;
    if (!ctx()) return;
    if (ac.state === 'suspended') ac.resume();
    FL.soundOn = true;
    var b = e.target && e.target.closest && e.target.closest('button,.btn');
    if (b && !b.disabled && b.dataset.act !== 'sfxtoggle') sfx.click();
  }, true);

  function buzz(p) { try { if (!reduced && navigator.vibrate) navigator.vibrate(p); } catch (e) { /* ignore */ } }

  /* ------------------------------------------------------------------ stamps */
  var seen = {}, booted = false;
  function slamStamps() {
    var list = FL.$$('[data-sk]'), fresh = [];
    list.forEach(function (el) {
      var k = role() + ':' + el.getAttribute('data-sk');
      if (!seen[k]) { seen[k] = 1; if (booted) fresh.push(el); }
    });
    fresh.forEach(function (el, i) {
      var delay = (el.closest('.chart-comparison') ? revealSpan() : 0) + i * 120;
      if (reduced) return;
      el.classList.add('slam-wait');
      setTimeout(function () {
        el.classList.remove('slam-wait'); el.classList.add('slam');
        var r = role(), isLedger = /^led/.test(el.getAttribute('data-sk'));
        if (r === 'team') {
          if (isLedger) { if (el.closest('.receipt.good')) { sfx.stamp(); setTimeout(sfx.coin, 160); buzz([30, 40, 70]); } else { sfx.stamp(); buzz(60); } }
          else { sfx.stamp(); buzz(35); }
        } else sfx.stamp();
      }, delay);
    });
  }

  /* ------------------------------------------------------------------ split-flap numbers */
  function flap(el, delay) {
    var final = el.textContent.trim();
    if (!/^\d+$/.test(final) || reduced) return;
    var width = final.length, steps = 8 + Math.round(Math.random() * 3), n = 0;
    el.classList.add('flapping'); el.textContent = '';
    setTimeout(function () {
      var timer = setInterval(function () {
        n++;
        var v = n >= steps ? final : String(Math.floor(Math.random() * Math.pow(10, width))).padStart(width, '0');
        el.textContent = v; el.classList.remove('flip-tick'); void el.offsetWidth; el.classList.add('flip-tick');
        if (role() === 'screen') sfx.flap();
        if (n >= steps) { clearInterval(timer); el.classList.remove('flapping'); el.classList.add('landed'); if (role() === 'screen') sfx.pop(); }
      }, 70);
    }, delay);
  }
  function flapMarket() {
    var els = FL.$$('.q-cards .v').length && FL.route().role === 'screen' ? FL.$$('.q-cards .v') : FL.$$('.market-params .huge.num, .seg.c3 .huge.num');
    els.forEach(function (el, i) { flap(el, i * 380); });
    if (role() === 'screen') setTimeout(sfx.chime, els.length * 380 + 800);
    else buzz([20, 60, 20, 60, 20]);
  }

  /* ------------------------------------------------------------------ sequential reveal (projector) */
  function revealSpan() { var n = FL.$$('.chart-comparison .profit-plot-row').length; return Math.min(2600, 500 + n * 110); }
  function revealComparison() {
    var rows = FL.$$('.chart-comparison .profit-plot-row');
    if (!rows.length || reduced) return;
    var card = FL.$('.chart-comparison'); card.classList.add('revealing');
    rows.forEach(function (row, i) {
      row.style.setProperty('--ri', i);
      if (role() === 'screen') setTimeout(function () { sfx.pop(0); }, 450 + i * 110);
    });
    setTimeout(function () { card.classList.remove('revealing'); card.classList.add('revealed'); }, revealSpan() + 400);
  }
  function revealDebrief() {
    var h = FL.$('.histogram'); if (!h || reduced) return;
    h.classList.add('revealing');
    var line = FL.$('.actual-exit-line');
    if (line && role() === 'screen') setTimeout(function () { sfx.thud(); }, 1300);
    setTimeout(function () { h.classList.remove('revealing'); }, 2400);
  }

  /* ------------------------------------------------------------------ hooks */
  var last = { key: null, pub: null, shiftSt: null };
  var baseRender = FL.render;
  FL.render = function (force) {
    baseRender(force);
    try { after(); } catch (e) { /* decoration must never break the app */ }
  };
  function after() {
    var snap = FL.snap(), r = role();
    document.body.classList.toggle('reduced', reduced);
    if (!snap) { booted = true; slamStamps(); return; }
    var ph = snap.session.phase, key = r + ':' + snap.session.code + ':' + ph, pub = FL.marketPublished ? !!FL.marketPublished(snap) : true;
    var first = last.key === null, changed = key !== last.key;
    document.body.setAttribute('data-phase', ph);
    if (!first && changed) {
      if (r === 'screen') {
        if (/^ledger/.test(ph)) revealComparison();
        else if (ph === 'debrief') revealDebrief();
        else if (ph === 'run2') { if (FL.$$('.tile.exit').length) setTimeout(sfx.shutter, 300); else sfx.whoosh(); }
        else sfx.whoosh();
      }
    }
    if (!first && ph === 'market' && pub && last.pub === false) flapMarket();
    last.key = key; last.pub = ph === 'market' ? pub : null;
    slamStamps();
    booted = true;
  }

  // Shift stage: drive a progress bar + "machine running" state through CSS variables.
  var baseTick = FL.tick;
  FL.tick = function () {
    baseTick();
    try {
      var snap = FL.snap(); if (!snap) return;
      var s = FL.shiftOf(snap), st = FL.shiftState(s), b = document.body;
      if (b.getAttribute('data-shift') !== st.st) b.setAttribute('data-shift', st.st);
      var frac = 0;
      if (s && st.st === 'run') frac = Math.max(0, Math.min(1, (FL.store.serverNow() - s.starts_at) / (s.ends_at - s.starts_at)));
      else if (st.st === 'done') frac = 1;
      document.documentElement.style.setProperty('--shift-prog', frac.toFixed(3));
      if (st.st !== last.shiftSt) {
        if (last.shiftSt && st.st === 'run' && role() === 'team') buzz([80]);
        if (last.shiftSt === 'run' && st.st === 'done' && role() === 'team') buzz([60, 50, 60]);
        last.shiftSt = st.st;
      }
    } catch (e) { /* ignore */ }
  };
})();
