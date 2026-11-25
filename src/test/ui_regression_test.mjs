import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<div id="app"></div>', { url: 'https://test.invalid/#/', runScripts: 'outside-only' });
const w = dom.window;
w.scrollTo = () => {};
for (const f of ['calc', 'api', 'i18n', 'core', 'views_team', 'views_screen', 'views_host', 'fx']) w.eval(fs.readFileSync('app/' + f + '.js', 'utf8'));
const FL = w.FL, C = w.FLCalc;
FL.lang = 'zh'; FL.store.refresh = async () => {};
const team = { id: 'a', name: '甲工廠', table_no: 20, present: 4 };
let snap = { session: { code: 'TEST', phase: 'ledger2', params: { p: 2, w: 6, F: 12, secs: 20, featured: 'a' }, rev: 1, shift: {} }, teams: [team], runs: [], decisions: [], locked: [] };
FL.store.snap = snap; FL.me = { team_id: 'a', token: 'token', code: 'TEST' }; FL.host = { code: 'TEST', key: 'key' };
function render(role) { w.history.replaceState({}, '', '#/' + role + '/TEST'); FL.render(true); return w.document.getElementById('app').textContent; }
let text = render('screen');
assert.match(text, /未交/); assert.match(text, /−12/); assert.doesNotMatch(text, /−0/);
snap.session.phase = 'debrief'; text = render('screen');
assert.match(text, /資料未齊/); assert.match(text, /尚無有效預測/); assert.doesNotMatch(text, /▲/);
snap.session.phase = 'run1'; text = render('host');
assert.match(text, /未交/); assert.doesNotMatch(text, /全部到齊/); assert.ok(w.document.querySelector('[data-act=hdecide]'));
snap.session.phase = 'trial'; text = render('screen');
assert.match(text, /合格環數／20秒/); assert.match(text, /等待已確認試產資料/);
assert.ok(![...w.document.querySelectorAll('.card')].some(el => !el.textContent.trim() && !el.querySelector('svg')));
// Large rosters are paginated rather than silently dropping factories.
snap.teams = Array.from({length: 13}, (_, i) => ({...team,id:'t'+i,table_no:i+1,name:'工廠'+i}));
render('screen'); assert.equal(w.document.querySelectorAll('.tile').length, 12);
FL.acts.tilepage({dataset:{d:'1'}}); assert.equal(w.document.querySelectorAll('.tile').length, 1);
snap.teams = [team]; snap.session.phase = 'debrief'; render('team');
const a = w.document.getElementById('slip1'), b = w.document.getElementById('slip2');
a.value = '租金已付，今天比較營收與工資'; b.value = '下期租金可避免'; a.dispatchEvent(new w.Event('input'));
FL.U.slipKey = null; FL.U.slip1 = ''; FL.U.slip2 = ''; render('team');
assert.equal(w.document.getElementById('slip1').value, a.value); assert.match(w.document.getElementById('app').textContent, /不會送給老師/);
// Failed writes must not trigger success feedback or refresh own decision as if saved.
let celebrations = 0, reads = 0;
FL.fx.confetti = () => celebrations++;
FL.api.report = async () => { throw new Error('Could not find function public.fl_report'); };
const result = await FL.acts.report({dataset:{target:'b',kind:'trial',lv:'1'}}, {clientX:1,clientY:1});
assert.equal(result.ok, false); assert.equal(celebrations, 0);
assert.match(w.document.querySelector('.action-error').textContent, /未能儲存/);
assert.match(w.document.querySelector('.action-error details pre').textContent, /fl_report/);
FL.api.submit = async () => { throw new Error('offline'); }; FL.api.myDecisions = async () => { reads++; return []; };
FL.U.sel1 = 2; await FL.acts.lock1({}, {clientX:1,clientY:1}); assert.equal(reads, 0); assert.equal(celebrations, 0);
// Counterfactuals and no-data states stay exact in both languages.
snap.runs = [1,2,3,4].map((L,i)=>({team_id:'a',kind:'trial',L,q:[5,9,11,12][i],status:'confirmed'}));
snap.runs.push({team_id:'a',kind:'p1',L:2,q:9,status:'confirmed'});
snap.decisions = [{team_id:'a',period:1,renew:true,L:2},{team_id:'a',period:2,renew:false,L:0,predict:1}];
snap.session.phase = 'ledger2'; text = render('screen'); assert.match(text, /−6/); assert.match(text, /−12/); assert.doesNotMatch(text, /−0/);
snap.session.phase = 'debrief'; snap.session.params.show_lesson = true; text = render('screen'); assert.match(text, /短期與長期/); assert.match(text, /0 < G < F/);
text = render('team'); assert.match(text, /−6\*/); assert.doesNotMatch(text, /−12\*/);
// A teacher may feature any factory, including one that stayed shut or made a
// profitable exit choice. The explanation must describe that actual choice.
snap.session.phase = 'ledger2'; snap.decisions[0].L = 0;
text = render('screen'); assert.match(text, /下期退出，利潤 0/); assert.doesNotMatch(text, /今天開工/);
snap.decisions[0].L = 2; snap.session.params.F = 1;
text = render('screen'); assert.match(text, /估計利潤 \+5/); assert.doesNotMatch(text, /低於租金/);
snap.session.params.F = 12; snap.session.phase = 'debrief';
FL.lang = 'en'; text = render('screen'); assert.match(text, /Short run vs long run/); assert.doesNotMatch(text, /⟦/);
assert.equal(C.classAggregates(snap).decided2, 1);
dom.window.close();
console.log('PASS: no-data ledgers, missing-decision recovery, chart labels, pagination, persistent drafts, honest action feedback and bilingual lesson');
