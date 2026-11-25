/* Factory LIVE — home, boot, event delegation. */
(function () {
  'use strict';
  var FL = window.FL, t = FL.t;
  FL.views = FL.views || {};
  FL.changes = FL.changes || {};

  FL.views.home = function () {
    return '<div class="app home-app"><div class="topbar"><div class="brand"><i></i>' + t('home_kicker') + '</div><div class="grow"></div><button class="btn sm ghost" data-act="lang">' + (FL.lang === 'zh' ? 'EN' : '中') + '</button></div>' +
      '<div class="stack"><div class="card home-hero stack"><div class="home-factory">' + FL.factory('open', 3, { label: t('app_title') }) + '</div><h1>' + t('app_title') + '</h1><h2>' + t('home_question') + '</h2><div class="muted">' + t('home_intro') + '</div><div class="home-steps">' + t('home_steps') + '</div>' +
      (FL.useLocal ? '<div class="banner warn small">' + t('local_banner') + '</div>' : '') + '</div>' +
      '<a class="btn primary block role-link" href="#/team"><span>' + t('home_team') + '<small>' + t('home_team_hint') + '</small></span><b aria-hidden="true">→</b></a>' +
      '<a class="btn block role-link" href="#/screen"><span>' + t('home_screen') + '<small>' + t('home_screen_hint') + '</small></span><b aria-hidden="true">→</b></a>' +
      '<a class="btn block role-link" href="#/host"><span>' + t('home_host') + '<small>' + t('home_host_hint') + '</small></span><b aria-hidden="true">→</b></a></div></div>';
  };

  FL.boot = function () {
    var r = FL.route();
    FL.store.stop(); FL.store.snap = null; FL.store.code = null;
    if (r.role === 'team') {
      if (FL.me && r.code && FL.me.code !== r.code) { FL.me = null; FL.ls.del('fl_me'); }
      if (FL.me) FL.store.start(FL.me.code, 2000);
    } else if (r.role === 'screen') {
      if (r.code) FL.store.start(r.code, 1500);
    } else if (r.role === 'host') {
      if (FL.guardHostRoute(r)) { FL.store.start(FL.host.code, 1500); FL.bots.reload(); }
    }
    if (FL.store.code && !FL.useLocal && !FL._rt) { FL._rt = true; FL.store.enableRealtime(FL.cfg); }
    FL.render(true);
  };

  FL.onShiftState = function () { FL.render(false); };

  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!b || b.disabled) return;
    var f = FL.acts[b.dataset.act];
    if (f) {
      var result = f(b, e);
      if (result && typeof result.then === 'function') {
        b.disabled = true; b.setAttribute('aria-busy', 'true');
        result.finally(function () { b.disabled = false; b.removeAttribute('aria-busy'); });
      }
    }
  });
  document.addEventListener('change', function (e) {
    var el = e.target, name = el && el.dataset && el.dataset.change;
    if (name && FL.changes[name]) FL.changes[name](el, e);
  });

  document.documentElement.lang = FL.lang === 'zh' ? 'zh-Hant' : 'en';
  FL.boot();
})();
