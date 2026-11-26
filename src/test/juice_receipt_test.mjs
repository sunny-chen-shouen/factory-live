// Receipt comparison names (J01/J03) and split-flap tile scope (J02), with juice.js loaded.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<div id="app"></div>', { url: 'https://test.invalid/#/', runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window;
w.scrollTo = () => {};
for (const f of ['calc', 'api', 'i18n', 'core', 'views_team', 'views_screen', 'views_host', 'fx', 'juice']) w.eval(fs.readFileSync('app/' + f + '.js', 'utf8'));
const FL = w.FL;
FL.store.refresh = async () => {};
const team = { id: 'a', name: '甲工廠', table_no: 20, present: 4 };
const trials = [5, 8, 9, 12].map((q, i) => ({ team_id: 'a', kind: 'trial', L: i + 1, q, status: 'confirmed' }));
function snapWith(L1, q1) {
  const runs = trials.slice();
  if (L1 > 0) runs.push({ team_id: 'a', kind: 'p1', L: L1, q: q1, status: 'confirmed' });
  return { session: { code: 'TEST', phase: 'ledger1', reveal: 1, params: { p: 2, w: 4, F: 9, secs: 20, market_published: true }, rev: 1, shift: {} },
    teams: [team], runs, decisions: [{ team_id: 'a', period: 1, renew: true, L: L1 }], locked: [{ team_id: 'a', period: 1 }] };
}
FL.me = { team_id: 'a', token: 'token', code: 'TEST' };
function render(role) { w.history.replaceState({}, '', '#/' + role + '/TEST'); FL.render(true); return w.document.getElementById('app'); }
function receipt(lang, L1, q1) {
  FL.lang = lang; FL.store.snap = snapWith(L1, q1);
  const app = render('team');
  const r = app.querySelector('.receipt');
  return { stamp: (r.querySelector('.stamp') || {}).textContent || '', vs: (r.querySelector('.receipt-vs') || {}).textContent || '', text: r.textContent };
}

// J01: stopped today → compare with the best open plan (G = 8 at 2 workers → −1 estimated)
let x = receipt('zh', 0);
assert.equal(x.stamp, '比開工差 −8*');
assert.equal(x.vs, '停工 −9；最佳開工估計 −1*；差額 −8*');
assert.doesNotMatch(x.text, /比停工/);
x = receipt('en', 0);
assert.equal(x.stamp, 'Below Open −8*');
assert.equal(x.vs, 'Close −9; best open plan −1*; difference −8*');

// J03: opened today → compare with stopping, and show the stop profit explicitly
x = receipt('zh', 2, 8);
assert.equal(x.stamp, '比停工好 +8');
assert.equal(x.vs, '開工 −1；停工 −9；差額 +8');
x = receipt('en', 2, 8);
assert.equal(x.stamp, 'Beats Close +8');
assert.equal(x.vs, 'Open −1; Close −9; difference +8');

// zero difference: no "−0", and the "same as" stamp
x = receipt('zh', 2, 4);
assert.equal(x.stamp, '與停工相同');
assert.equal(x.vs, '開工 −9；停工 −9；差額 0');
assert.doesNotMatch(x.text, /−0(?!\.)/);

// unknown estimate: stopped with no confirmed trials → no stamp, no comparison line
FL.lang = 'zh'; FL.store.snap = snapWith(0); FL.store.snap.runs = [];
let app = render('team');
assert.equal(app.querySelector('.receipt .stamp'), null);
assert.equal(app.querySelector('.receipt .receipt-vs'), null);

// J02: the flip tile wraps only the digits, never the full-width value element
FL.lang = 'zh';
const s = snapWith(0); s.session.phase = 'market'; s.session.params.market_published = false; s.runs = trials.slice(); s.decisions = []; s.locked = [];
FL.store.snap = s; render('screen');
s.session.params = Object.assign({}, s.session.params, { market_published: true }); s.session.rev = 2;
app = render('screen');
const vals = [...app.querySelectorAll('.q-cards .v')];
assert.equal(vals.length, 3);
for (const v of vals) {
  assert.ok(!v.classList.contains('flapping'), 'value element itself must not get the flip background');
  const tile = v.querySelector('.flapnum');
  assert.ok(tile, 'a digit tile is inserted');
  assert.ok(tile.classList.contains('flapping'));
}
const css = fs.readFileSync('app/style.css', 'utf8');
assert.match(css, /\.flapnum\{display:inline-block/);
assert.doesNotMatch(css, /(^|\})\.flapping\{/);
assert.match(css, /prefers-reduced-motion:reduce\)\{[^}]*\.stamp/);
console.log('PASS: receipt names the right alternative (open/stop/zero/unknown, zh/en) and flip tiles hug the digits');
dom.window.close();
