// English-first UI, simple English factory names, stable stand-ins for legacy non-English names.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const CJK = /[一-鿿　-〿＀-￯]/;
const files = ['qrlib', 'calc', 'api', 'i18n', 'core', 'views_team', 'views_screen', 'views_host', 'fx', 'juice', 'main'];
function boot(storedLang) {
  const dom = new JSDOM('<div id="app"></div>', { url: 'https://test.invalid/#/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  Object.defineProperty(w.navigator, 'language', { value: 'zh-TW', configurable: true }); // a Chinese browser
  w.scrollTo = () => {};
  if (storedLang) w.localStorage.setItem('fl_lang', storedLang);
  for (const f of files) w.eval(fs.readFileSync('app/' + f + '.js', 'utf8'));
  return { dom, w, FL: w.FL, C: w.FLCalc };
}

// 1) first open is English even on a Chinese browser; an explicit choice is remembered
let { dom, w, FL, C } = boot(null);
assert.equal(FL.lang, 'en');
assert.equal(w.localStorage.getItem('fl_lang'), null, 'no preference is written until the user switches');
FL.setLang('zh'); assert.equal(w.localStorage.getItem('fl_lang'), 'zh');
dom.window.close();
({ dom, w, FL, C } = boot('zh')); assert.equal(FL.lang, 'zh'); dom.window.close();
({ dom, w, FL, C } = boot('en')); assert.equal(FL.lang, 'en');

// 2) names: simple English words, validation, stable stand-ins for legacy names
for (const n of C.NAME_POOL) { assert.match(n, /^[A-Z][a-z]+$/); assert.ok(n.length <= 8, n); }
assert.equal(new Set(C.NAME_POOL).size, C.NAME_POOL.length);
for (const bad of ['', '   ', '白頭翁', '9Lives', 'Panda!!', 'A'.repeat(17), 'Strawberry Rocket', 'Café']) assert.equal(C.validName(bad), false, bad);
for (const ok of ['Panda', 'Strawberry Moon', "O'Neil", 'Team 7', 'R&D', 'Sky-High']) assert.equal(C.validName(ok), true, ok);
assert.equal(C.cleanName('  Strawberry   Moon '), 'Strawberry Moon');
assert.equal(C.displayName({ name: 'Panda', table_no: 3 }), 'Panda');
assert.equal(C.displayName({ name: '白頭翁', table_no: 1 }), C.NAME_POOL[0]);
assert.equal(C.displayName({ name: '白頭翁', table_no: 1 }), C.displayName({ name: '白頭翁', table_no: 1 }), 'stable');
assert.notEqual(C.displayName({ name: '赤燕', table_no: 2 }), C.displayName({ name: '白鷺', table_no: 3 }));
assert.match(C.displayName({ name: '墨水', table_no: 70 }), /^[A-Za-z]+ 2$/);
const src = fs.readFileSync('app/views_host.js', 'utf8');
assert.doesNotMatch(src.match(/var NAMES = [^;]*;/)[0], CJK, 'bot names are English');
const i18n = fs.readFileSync('app/i18n.js', 'utf8');
assert.doesNotMatch(i18n, /Bulbul|Egret|Works'/);
assert.match(i18n, /'e\.g\. Panda'/); assert.match(i18n, /'例如：Panda'/);

// 3) snapshots: legacy names normalized once, raw name kept, team ids/tables untouched
const store = new w.FLApi.Store({ snapshot: async () => ({ now: Date.now(), session: { code: 'TEST', phase: 'lobby', params: {}, rev: 1, shift: {} },
  teams: [{ id: 't1', name: '白頭翁', table_no: 1, present: 3 }, { id: 't2', name: 'Panda', table_no: 2, present: 2 }], runs: [], decisions: [], locked: [] }) });
store.code = 'TEST'; store.generation = 1;
await store.refresh();
assert.deepEqual(store.snap.teams.map(t => [t.id, t.table_no, t.name, t.raw_name]), [['t1', 1, C.NAME_POOL[0], '白頭翁'], ['t2', 2, 'Panda', 'Panda']]);

// 4) every phase renders with no Chinese in English mode, and names are identical in both languages
const team = { id: 'a', name: 'Strawberry Moon', table_no: 20, present: 4 };
const others = C.NAME_POOL.slice(0, 19).map((n, i) => ({ id: 'b' + i, name: n, table_no: i + 1, present: 2 + (i % 3) }));
const trials = [5, 8, 9, 12].map((q, i) => ({ team_id: 'a', kind: 'trial', L: i + 1, q, status: 'confirmed' }));
const base = { teams: [team, ...others], runs: trials.concat([{ team_id: 'a', kind: 'p1', L: 2, q: 8, status: 'confirmed' }]),
  decisions: [{ team_id: 'a', period: 1, renew: true, L: 2 }, { team_id: 'a', period: 2, renew: false, L: 0, predict: 3 }], locked: [{ team_id: 'a', period: 1 }, { team_id: 'a', period: 2 }] };
FL.store.refresh = async () => {}; FL.me = { team_id: 'a', token: 't', code: 'TEST' }; FL.host = { code: 'TEST', key: 'k' };
function render(role, phase, lang) {
  FL.lang = lang; w.document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en';
  FL.store.snap = Object.assign({ session: { code: 'TEST', phase, reveal: 2, params: { p: 2, w: 4, F: 9, secs: 20, market_published: true, lesson: true }, rev: 1, shift: {} } }, JSON.parse(JSON.stringify(base)));
  w.history.replaceState({}, '', (role === 'home' ? '#/' : '#/' + role + '/TEST')); FL.render(true);
  return w.document.getElementById('app');
}
function cjkIn(app) {
  const bad = [];
  const tw = w.document.createTreeWalker(app, w.NodeFilter.SHOW_TEXT);
  let n; while ((n = tw.nextNode())) if (CJK.test(n.nodeValue) && !n.parentElement.closest('textarea')) bad.push(n.nodeValue.trim().slice(0, 30));
  app.querySelectorAll('*').forEach(e => ['title', 'aria-label', 'placeholder', 'alt'].forEach(a => { const v = e.getAttribute(a); if (v && CJK.test(v)) bad.push(a + ':' + v.slice(0, 30)); }));
  return bad;
}
const phases = ['lobby', 'trial', 'market', 'decide1', 'run1', 'ledger1', 'decide2', 'run2', 'ledger2', 'debrief'];
for (const role of ['team', 'screen', 'host']) for (const ph of phases) {
  const app = render(role, ph, 'en');
  assert.deepEqual(cjkIn(app), [], role + '/' + ph);
  const langBtn = app.querySelector('[data-act=lang]'); if (langBtn) { assert.equal(langBtn.textContent, 'ZH'); assert.doesNotMatch(langBtn.getAttribute('aria-label') || '', CJK); }
}
assert.deepEqual(cjkIn(render('home', 'lobby', 'en')), []);
for (const ph of ['lobby', 'decide1', 'run2', 'ledger1']) {
  const names = l => [...render('screen', ph, l).querySelectorAll('.nm,.plot-name,.feature-identity h2,.feature-identity b')].map(e => e.textContent.replace(/^\d+\s*·\s*/, '').trim()).filter(Boolean);
  const en = names('en'), zh = names('zh');
  assert.ok(en.length > 0, 'names rendered on ' + ph);
  assert.deepEqual(zh, en, 'same names in both languages on ' + ph);
  for (const n of en) assert.doesNotMatch(n, CJK);
}
// join form: English placeholder in both languages, no "Factory/Works" suffix
FL.me = null; FL.store.snap = null; w.history.replaceState({}, '', '#/team/TEST');
for (const l of ['en', 'zh']) { FL.lang = l; FL.render(true); const ph = w.document.querySelector('#j_name').getAttribute('placeholder'); assert.match(ph, /Panda$/); assert.doesNotMatch(ph, /Factory|Works|工廠$/); }
dom.window.close();
console.log('PASS: English by default, remembered language, English names (validated, stable for legacy rooms, identical across languages), no Chinese in English UI across 3 roles × 10 phases');

// 5) assigned class list: shown before check-in, case/space-insensitive matching, clear rejections
{
  const { dom: d2, w: w2, FL: F2, C: C2 } = boot(null);
  const J = x => JSON.parse(JSON.stringify(x));
  const names = J(C2.defaultRoster(15));
  assert.equal(names.length, 15); assert.deepEqual(names.slice(0, 3), ['Apple', 'Panda', 'Tiger']);
  assert.equal(new Set(names.map(n => n.toLowerCase())).size, 15);
  assert.deepEqual(J(C2.rosterCheck(names, 2, '  pAnDa ')), { ok: true, name: 'Panda' });
  assert.deepEqual(J(C2.rosterCheck(names, 3, 'Panda')), { ok: false, err: 'roster_other', other: 2, name: 'Panda' });
  assert.deepEqual(J(C2.rosterCheck(names, 3, 'Tigre')), { ok: false, err: 'roster_name' });
  assert.equal(C2.rosterCheck(names, 16, 'Apple').err, 'roster_table');
  assert.deepEqual(J(C2.defaultRoster(4, ['Kiwi', 'Apple'])), ['Kiwi', 'Apple', 'Panda', 'Tiger'], 'keeps edited names, fills without duplicates');
  assert.equal(C2.rosterOf({}), null); assert.equal(C2.rosterOf({ roster: { names: [] } }), null);
  F2.store.refresh = async () => {};
  const joined = [{ id: 'x', name: 'Panda', table_no: 2, present: 4 }];
  for (const [lang, teams, want] of [['en', [], /0 of 15 groups checked in · 0 people/], ['zh', [], /已報到 0 \/ 15 組/], ['en', joined, /1 of 15 groups checked in · 4 people/]]) {
    F2.lang = lang;
    F2.store.snap = { session: { code: 'ROST', phase: 'lobby', reveal: 0, params: { p: 2, w: 4, F: 9, roster: { names } }, rev: 1, shift: {} }, teams, runs: [], decisions: [], locked: [] };
    w2.history.replaceState({}, '', '#/screen/ROST'); F2.render(true);
    const app = w2.document.getElementById('app');
    assert.match(app.textContent, want);
    const cells = [...app.querySelectorAll('.roster-cell')];
    assert.equal(cells.length, 15, 'all 15 reserved names are on the projector before check-in');
    assert.deepEqual(J(cells.slice(0, 3).map(c => c.querySelector('.rc-n').textContent)), ['Apple', 'Panda', 'Tiger']);
    assert.equal(cells.filter(c => c.classList.contains('in')).length, teams.length, 'only real check-ins are marked as in');
    if (lang === 'en') assert.deepEqual(cjkIn(app).filter(Boolean), []);
  }
  // reserved seats are not active factories: later phases count only checked-in teams
  F2.lang = 'en'; F2.store.snap.session.phase = 'trial'; F2.render(true);
  assert.equal(w2.document.querySelectorAll('.tile').length, 1);
  d2.window.close();
}
console.log('PASS: assigned class list — 15 names on screen before check-in, matching ignores case/spaces, wrong table/name rejected, only real check-ins count');
