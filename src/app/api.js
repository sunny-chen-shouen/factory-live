/* Factory LIVE — data layer.
   Two interchangeable back-ends with the same promise API:
   - SupabaseApi: PostgREST RPC over fetch (needs a host that allows network access)
   - LocalApi: same rules in the browser, shared across tabs of ONE browser (rehearsal / offline demo)
   Server-side rules live in sql/001_factory_live.sql; LocalApi mirrors them. */
(function (root) {
  'use strict';

  function SupabaseApi(cfg) {
    var base = cfg.url.replace(/\/$/, '') + '/rest/v1/rpc/';
    function rpc(name, args) {
      return fetch(base + name, {
        method: 'POST',
        headers: { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key, 'Content-Type': 'application/json' },
        body: JSON.stringify(args || {})
      }).then(function (res) {
        return res.text().then(function (txt) {
          var data = null;
          try { data = txt ? JSON.parse(txt) : null; } catch (e) { /* non-JSON */ }
          if (!res.ok) {
            var msg = (data && (data.message || data.hint)) || ('http_' + res.status);
            var err = new Error(msg); err.status = res.status; throw err;
          }
          return data;
        });
      });
    }
    return {
      kind: 'supabase',
      create: function (key) { return rpc('fl_create', { p_key: key }); },
      join: function (code, name, table, present) { return rpc('fl_join', { p_code: code, p_name: name, p_table: table, p_present: present }); },
      updateTeam: function (team, token, present) { return rpc('fl_update_team', { p_team: team, p_token: token, p_present: present }); },
      snapshot: function (code) { return rpc('fl_snapshot', { p_code: code }); },
      myDecisions: function (team, token) { return rpc('fl_my_decisions', { p_team: team, p_token: token }); },
      submit: function (team, token, period, renew, L, predict) { return rpc('fl_submit', { p_team: team, p_token: token, p_period: period, p_renew: renew, p_l: L, p_predict: predict == null ? null : predict }); },
      report: function (team, token, target, kind, L, q) { return rpc('fl_report', { p_team: team, p_token: token, p_target: target, p_kind: kind, p_l: L, p_q: q }); },
      confirm: function (team, token, kind, L, ok) { return rpc('fl_confirm', { p_team: team, p_token: token, p_kind: kind, p_l: L, p_ok: ok }); },
      hostSet: function (code, key, patch) { return rpc('fl_host_set', { p_code: code, p_key: key, p_patch: patch }); },
      hostRun: function (code, key, team, kind, L, q) { return rpc('fl_host_run', { p_code: code, p_key: key, p_team: team, p_kind: kind, p_l: L, p_q: q == null ? null : q }); },
      hostTeam: function (code, key, team, patch, del) { return rpc('fl_host_team', { p_code: code, p_key: key, p_team: team, p_patch: patch || {}, p_delete: !!del }); },
      hostDecide: function (code, key, team, period, renew, L, predict) { return rpc('fl_host_decide', { p_code: code, p_key: key, p_team: team, p_period: period, p_renew: renew, p_l: L, p_predict: predict == null ? null : predict }); },
      hostReset: function (code, key, scope) { return rpc('fl_host_reset', { p_code: code, p_key: key, p_scope: scope }); }
    };
  }

  function LocalApi() {
    var KEY = 'fl_local_db_v1';
    var mem = null, chan = null;
    try { chan = new BroadcastChannel('fl_local'); } catch (e) { /* ignore */ }
    function load() {
      try { var s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch (e) { if (mem) return mem; }
      return mem || { sessions: {}, secrets: {}, teams: [], tokens: {}, runs: [], decisions: [], seq: 0 };
    }
    function save(db) { mem = db; try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* in-memory only */ } if (chan) chan.postMessage(1); }
    function uuid(db) { db.seq++; return 'id' + db.seq + '-' + Math.random().toString(16).slice(2, 10); }
    function err(m) { return Promise.reject(new Error(m)); }
    function now() { return Date.now(); }
    function sess(db, code) { return db.sessions[String(code || '').toUpperCase().trim()]; }
    function chkHost(db, code, key) { if (!db.secrets[code] || db.secrets[code] !== key) throw new Error('bad_host_key'); }
    function chkTeam(db, id, token) {
      var t = db.teams.filter(function (x) { return x.id === id; })[0];
      if (!t || db.tokens[id] !== token) throw new Error('bad_team_token');
      return t;
    }
    function bump(db, code) { db.sessions[code].rev++; }
    function wrap(fn) { return new Promise(function (res, rej) { try { res(fn()); } catch (e) { rej(e); } }); }
    function upsert(arr, match, row) {
      for (var i = 0; i < arr.length; i++) if (match(arr[i])) { arr[i] = Object.assign(arr[i], row); return arr[i]; }
      arr.push(row); return row;
    }

    return {
      kind: 'local',
      create: function (key) {
        return wrap(function () {
          if (!key || key.length < 6) throw new Error('key_too_short');
          var db = load(), A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', c;
          do { c = ''; for (var i = 0; i < 4; i++) c += A[Math.floor(Math.random() * A.length)]; } while (db.sessions[c]);
          db.sessions[c] = { code: c, phase: 'lobby', params: { p: 2, w: 6, F: 12, secs: 20, kmax: 4 }, shift: {}, reveal: 0, rev: 0 };
          db.secrets[c] = key; save(db); return c;
        });
      },
      join: function (code, name, table, present) {
        return wrap(function () {
          var db = load(), c = String(code).toUpperCase().trim();
          if (!db.sessions[c]) throw new Error('no_session');
          name = String(name || '').trim();
          if (!name || name.length > 24) throw new Error('bad_name');
          if (present < 0 || present > 4) throw new Error('bad_present');
          var ex = db.teams.filter(function (t) { return t.code === c && t.table_no === table; })[0], id, token;
          if (ex) { if (ex.name !== name) throw new Error('table_taken'); id = ex.id; token = db.tokens[id]; }
          else { id = uuid(db); token = uuid(db) + Math.random().toString(16).slice(2); db.teams.push({ id: id, code: c, name: name, table_no: table, present: present }); db.tokens[id] = token; }
          bump(db, c); save(db); return { team_id: id, token: token, code: c };
        });
      },
      updateTeam: function (team, token, present) {
        return wrap(function () {
          var db = load(), t = chkTeam(db, team, token), s = db.sessions[t.code];
          if (['lobby', 'trial', 'market'].indexOf(s.phase) < 0) throw new Error('locked_phase');
          if (present < 0 || present > 4) throw new Error('bad_present');
          t.present = present; bump(db, t.code); save(db);
        });
      },
      snapshot: function (code) {
        return wrap(function () {
          var db = load(), c = String(code).toUpperCase().trim(), s = db.sessions[c];
          if (!s) return null;
          var teams = db.teams.filter(function (t) { return t.code === c; }).sort(function (a, b) { return a.table_no - b.table_no; });
          var ids = teams.map(function (t) { return t.id; });
          return JSON.parse(JSON.stringify({
            now: now(),
            session: { code: c, phase: s.phase, params: s.params, shift: s.shift, reveal: s.reveal, rev: s.rev },
            teams: teams.map(function (t) { return { id: t.id, name: t.name, table_no: t.table_no, present: t.present }; }),
            runs: db.runs.filter(function (r) { return ids.indexOf(r.team_id) >= 0; }),
            locked: db.decisions.filter(function (d) { return ids.indexOf(d.team_id) >= 0; }).map(function (d) { return { team_id: d.team_id, period: d.period }; }),
            decisions: db.decisions.filter(function (d) { return ids.indexOf(d.team_id) >= 0 && d.period <= s.reveal; })
          }));
        });
      },
      myDecisions: function (team, token) {
        return wrap(function () {
          var db = load(); chkTeam(db, team, token);
          return db.decisions.filter(function (d) { return d.team_id === team; });
        });
      },
      submit: function (team, token, period, renew, L, predict) {
        return wrap(function () {
          var db = load(), t = chkTeam(db, team, token), s = db.sessions[t.code];
          if (s.phase !== 'decide' + period) throw new Error('not_deciding');
          if (period === 1) renew = true;
          if (!renew) L = 0;
          if (L < 0 || L > t.present) throw new Error('bad_L');
          if (predict != null && (predict < 0 || predict > 60)) throw new Error('bad_predict');
          upsert(db.decisions, function (d) { return d.team_id === team && d.period === period; },
            { team_id: team, period: period, renew: renew, L: L, predict: period === 2 ? (predict == null ? null : predict) : null });
          bump(db, t.code); save(db);
        });
      },
      report: function (team, token, target, kind, L, q) {
        return wrap(function () {
          var db = load(), me = chkTeam(db, team, token);
          var tg = db.teams.filter(function (x) { return x.id === target; })[0];
          if (!tg || tg.code !== me.code) throw new Error('wrong_session');
          if (target === team) throw new Error('self_report');
          var s = db.sessions[me.code];
          if (q < 0 || q > 300) throw new Error('bad_q');
          if (kind === 'trial') {
            if (s.phase !== 'trial') throw new Error('not_in_phase');
            if (L < 1 || L > tg.present) throw new Error('bad_L');
          } else if (kind === 'p1' || kind === 'p2') {
            var per = Number(kind[1]);
            if (s.phase !== 'run' + per) throw new Error('not_in_phase');
            var d = db.decisions.filter(function (x) { return x.team_id === target && x.period === per; })[0];
            if (!d || d.renew !== true) throw new Error('not_producing');
            L = d.L;
          } else throw new Error('bad_kind');
          upsert(db.runs, function (r) { return r.team_id === target && r.kind === kind && r.L === L; },
            { team_id: target, kind: kind, L: L, q: q, status: 'reported', reporter: team });
          bump(db, me.code); save(db);
        });
      },
      confirm: function (team, token, kind, L, ok) {
        return wrap(function () {
          var db = load(), me = chkTeam(db, team, token);
          db.runs.forEach(function (r) { if (r.team_id === team && r.kind === kind && r.L === L) r.status = ok ? 'confirmed' : 'disputed'; });
          bump(db, me.code); save(db);
        });
      },
      hostSet: function (code, key, patch) {
        return wrap(function () {
          var db = load(); chkHost(db, code, key); var s = db.sessions[code];
          if (patch.phase != null) s.phase = patch.phase;
          if (patch.params) s.params = Object.assign({}, s.params, patch.params);
          if (patch.shift) s.shift = patch.shift;
          if (patch.reveal != null) s.reveal = patch.reveal;
          s.rev++; save(db); return s.rev;
        });
      },
      hostRun: function (code, key, team, kind, L, q) {
        return wrap(function () {
          var db = load(); chkHost(db, code, key);
          if (q == null) db.runs = db.runs.filter(function (r) { return !(r.team_id === team && r.kind === kind && r.L === L); });
          else upsert(db.runs, function (r) { return r.team_id === team && r.kind === kind && r.L === L; }, { team_id: team, kind: kind, L: L, q: q, status: 'host', reporter: null });
          bump(db, code); save(db);
        });
      },
      hostTeam: function (code, key, team, patch, del) {
        return wrap(function () {
          var db = load(); chkHost(db, code, key);
          if (del) { db.teams = db.teams.filter(function (t) { return t.id !== team; }); db.runs = db.runs.filter(function (r) { return r.team_id !== team; }); db.decisions = db.decisions.filter(function (d) { return d.team_id !== team; }); }
          else db.teams.forEach(function (t) {
            if (t.id === team) { if (patch.present != null) t.present = patch.present; if (patch.name) t.name = patch.name; if (patch.table_no != null) t.table_no = patch.table_no; }
          });
          bump(db, code); save(db);
        });
      },
      hostDecide: function (code, key, team, period, renew, L, predict) {
        return wrap(function () {
          var db = load(); chkHost(db, code, key);
          var t = db.teams.filter(function (x) { return x.id === team; })[0];
          if (!t) throw new Error('wrong_session');
          if (period === 1) renew = true;
          if (!renew) L = 0;
          if (L < 0 || L > t.present) throw new Error('bad_L');
          upsert(db.decisions, function (d) { return d.team_id === team && d.period === period; },
            { team_id: team, period: period, renew: renew, L: L, predict: period === 2 ? (predict == null ? null : predict) : null });
          bump(db, code); save(db);
        });
      },
      hostReset: function (code, key, scope) {
        return wrap(function () {
          var db = load(); chkHost(db, code, key);
          var ids = db.teams.filter(function (t) { return t.code === code; }).map(function (t) { return t.id; });
          if (scope === 'trial') db.runs = db.runs.filter(function (r) { return !(ids.indexOf(r.team_id) >= 0 && r.kind === 'trial'); });
          else if (scope === 'runs' || scope === 'all') {
            db.runs = db.runs.filter(function (r) { return ids.indexOf(r.team_id) < 0; });
            db.decisions = db.decisions.filter(function (d) { return ids.indexOf(d.team_id) < 0; });
            var s = db.sessions[code]; s.phase = 'lobby'; s.reveal = 0; s.shift = {};
            if (scope === 'all') db.teams = db.teams.filter(function (t) { return t.code !== code; });
          } else throw new Error('bad_scope');
          bump(db, code); save(db);
        });
      },
      onExternalChange: function (fn) {
        if (chan) chan.onmessage = fn;
        window.addEventListener('storage', function (e) { if (e.key === KEY) fn(); });
      }
    };
  }

  /* ---------------------------------------------------------------- Store: polling + clock offset */
  function Store(api) {
    var self = { api: api, snap: null, code: null, offset: 0, online: true, listeners: [], timer: null, busy: false, interval: 2000, lastRev: -1, errors: 0 };

    self.serverNow = function () { return Date.now() + self.offset; };
    self.on = function (fn) { self.listeners.push(fn); };
    function emit() { self.listeners.forEach(function (fn) { try { fn(self.snap); } catch (e) { console.error(e); } }); }

    self.refresh = function () {
      if (!self.code || self.busy) return Promise.resolve();
      self.busy = true;
      var t0 = Date.now();
      return api.snapshot(self.code).then(function (s) {
        var t1 = Date.now();
        self.busy = false; self.errors = 0;
        var was = self.online; self.online = true;
        if (s && typeof s.now === 'number') self.offset = s.now - (t0 + t1) / 2;
        if (!s) { self.snap = null; emit(); return; }
        // re-render only when something actually changed
        var sig = s.session.rev + ':' + s.runs.length + ':' + s.teams.length;
        if (self.snap == null || sig !== self.sig || JSON.stringify(s.session) !== JSON.stringify(self.snap.session) || !was) {
          self.snap = s; self.sig = sig; emit();
        } else { self.snap = s; self.sig = sig; }
      }).catch(function () {
        self.busy = false; self.errors++;
        if (self.errors >= 2 && self.online) { self.online = false; emit(); }
      });
    };

    self.start = function (code, interval) {
      self.stop();
      self.code = code; self.interval = interval || 2000; self.sig = null;
      self.refresh();
      self.timer = setInterval(self.refresh, self.interval);
      if (api.onExternalChange) api.onExternalChange(function () { self.refresh(); });
    };
    self.stop = function () { if (self.timer) clearInterval(self.timer); self.timer = null; };

    // Optional realtime ping (Supabase only); polling keeps working if this fails.
    self.enableRealtime = function (cfg) {
      if (!cfg || !cfg.url || api.kind !== 'supabase') return;
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      s.onload = function () {
        try {
          var sb = window.supabase.createClient(cfg.url, cfg.key, { realtime: { params: { eventsPerSecond: 10 } } });
          sb.channel('fl-' + self.code).on('postgres_changes', { event: '*', schema: 'public', table: 'fl_sessions', filter: 'code=eq.' + self.code }, function () { self.refresh(); }).subscribe();
        } catch (e) { /* polling only */ }
      };
      document.head.appendChild(s);
    };

    return self;
  }

  root.FLApi = { SupabaseApi: SupabaseApi, LocalApi: LocalApi, Store: Store };
})(typeof window !== 'undefined' ? window : this);
