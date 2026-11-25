/* Factory LIVE — home, boot, event delegation. */
(function () {
  'use strict';
  var FL = window.FL, t = FL.t;
  FL.views = FL.views || {};
  FL.changes = FL.changes || {};

  FL.views.home = function () {
    return '<div class="app"><div class="topbar"><div class="brand"><i></i>' + t('app_title') + '</div><div class="grow"></div><button class="btn sm ghost" data-act="lang">' + (FL.lang === 'zh' ? 'EN' : '中') + '</button></div>' +
      '<div class="stack"><div class="card stack"><h1>' + t('app_title') + '</h1><div class="muted">' + t('tagline') + '</div>' +
      (FL.useLocal ? '<div class="banner warn small">' + t('local_banner') + '</div>' : '') + '</div>' +
      '<a class="btn primary block" href="#/team">' + t('home_team') + '</a>' +
      '<a class="btn block" href="#/screen">' + t('home_screen') + '</a>' +
      '<a class="btn block" href="#/host">' + t('home_host') + '</a></div></div>';
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
      if (FL.host) { FL.store.start(FL.host.code, 1500); FL.bots.reload(); }
    }
    if (FL.store.code && !FL.useLocal && !FL._rt) { FL._rt = true; FL.store.enableRealtime(FL.cfg); }
    FL.render(true);
  };

  FL.onShiftState = function () { FL.render(false); };

  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!b || b.disabled) return;
    var f = FL.acts[b.dataset.act];
    if (f) { f(b, e); }
  });
  document.addEventListener('change', function (e) {
    var el = e.target, name = el && el.dataset && el.dataset.change;
    if (name && FL.changes[name]) FL.changes[name](el, e);
  });

  document.documentElement.lang = FL.lang === 'zh' ? 'zh-Hant' : 'en';
  FL.boot();
})();
