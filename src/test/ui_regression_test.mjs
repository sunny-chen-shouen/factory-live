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
// A normal class needs no page operator: all 20 factories stay visible.
snap.teams = Array.from({length: 13}, (_, i) => ({...team,id:'t'+i,table_no:i+1,name:'工廠'+i}));
render('screen'); assert.equal(w.document.querySelectorAll('.tile').length, 13);
snap.teams = Array.from({length: 21}, (_, i) => ({...team,id:'t'+i,table_no:i+1,name:'工廠'+i}));
render('screen'); assert.equal(w.document.querySelectorAll('.tile').length, 20);
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
snap.session.phase = 'ledger2'; text = render('screen'); assert.match(text, /−6/); assert.doesNotMatch(text, /−0/);
assert.equal(w.document.querySelector('.profit-plot-row').dataset.alternative,'-6'); assert.equal(w.document.querySelector('.profit-plot-row').dataset.delta,'6');
snap.session.phase = 'debrief'; snap.session.params.show_lesson = true; text = render('screen'); assert.match(text, /短期與長期/); assert.match(text, /0 < G < F/);
text = render('team'); assert.match(text, /−6\*/); assert.doesNotMatch(text, /−12\*/);
// A teacher may feature any factory, including one that stayed shut or made a
// profitable exit choice. The explanation must describe that actual choice.
snap.session.phase = 'ledger2'; snap.decisions[0].L = 0;
text = render('screen'); assert.match(w.document.querySelector('.feature-duel').textContent, /退出0vs續租\*−6/); assert.doesNotMatch(text, /今天開工/);
snap.decisions[0].L = 2; snap.session.params.F = 1; snap.session.params.featured_period=2;
text = render('screen'); assert.match(w.document.querySelector('.feature-duel').textContent, /退出0vs續租\*\+5/); assert.equal(w.document.querySelector('.profit-plot-row').dataset.delta,'-5');
delete snap.session.params.featured_period;
snap.session.params.F = 12; snap.session.phase = 'debrief';
FL.lang = 'en'; text = render('screen'); assert.match(text, /Short run vs long run/); assert.doesNotMatch(text, /⟦/);
assert.equal(C.classAggregates(snap).decided2, 1);
// The actual exit line exists even when nobody predicted the actual count.
snap.decisions[1].predict=0; render('screen'); assert.ok(w.document.querySelector('.actual-exit-line')); assert.match(w.document.querySelector('.actual-exit-label').textContent,/1/);
// Unrevealed debrief asks the reflection question once, not in two cards.
snap.session.params.show_lesson=false; FL.lang='zh'; text=render('screen'); assert.equal(text.split(FL.t('slip_q',snap.session.params.F)).length-1,1);
// Editing stays private until explicit announcement; navigation cannot reveal
// draft parameters. Publish carries every field and is serialized after edits.
FL.lang = 'zh'; snap.session.phase = 'market'; snap.session.params.market_published = false;
text = render('screen'); assert.match(text, /正在設定市場/); assert.equal(w.document.querySelectorAll('.q-cards').length, 0);
text = render('team'); assert.match(text, /正在設定市場/); assert.equal(w.document.querySelectorAll('.seg.c3').length, 0);
let writes = []; FL.api.hostSet = async (code,key,p) => { writes.push(p); Object.assign(snap.session.params,p.params||{}); if(p.phase) snap.session.phase=p.phase; };
render('host'); await FL.acts.hnext({dataset:{}}); assert.equal(writes.length,0);
await FL.acts.hrec({dataset:{p:'3',w:'4',f:'10'}}); assert.equal(snap.session.params.market_published,false);
render('host'); await FL.acts.hpublish(); assert.equal(snap.session.params.market_published,true);
text = render('screen'); assert.doesNotMatch(text,/正在設定市場/); assert.equal(w.document.querySelectorAll('.q-cards').length,1);
const lastWrite = writes.at(-1).params; assert.deepEqual([lastWrite.p,lastWrite.w,lastWrite.F],[3,4,10]);
render('host'); await FL.acts.hnext({dataset:{}}); assert.equal(snap.session.phase,'decide1');
// Switching rooms clears the previous room's CSV preview and selected tab.
FL.host = null; FL.H.csv = 'old room export'; FL.H.tab = 'tools'; render('host');
w.document.getElementById('h_code').value = 'NEXT'; w.document.getElementById('h_key2').value = 'test-key';
FL.api.snapshot = async () => snap; FL.api.hostSet = async () => {}; FL.boot = () => {};
await FL.acts.hresume(); assert.equal(FL.H.csv, ''); assert.equal(FL.H.tab, 'control'); assert.equal(FL.host.code, 'NEXT');
// Real boot must fence a conflicting saved host before loading its data or bots.
let starts=0, botLoads=0; FL.store.start=()=>starts++; FL.bots.reload=()=>botLoads++;
FL.host={code:'F2BY',key:'saved-password'}; w.history.replaceState({},'','#/host/ZN8C');
w.eval(fs.readFileSync('app/main.js','utf8'));
assert.equal(starts,0); assert.equal(botLoads,0); assert.equal(FL.host,null); assert.equal(FL.store.code,null);
assert.equal(w.document.getElementById('h_code').value,'ZN8C'); assert.equal(w.document.getElementById('h_key2').value,'');
assert.match(w.document.querySelector('[role=alert]').textContent,/ZN8C.*F2BY/); assert.equal(w.document.querySelectorAll('[data-act=hnext]').length,0);
// Even a click on stale controls during a hash transition cannot dispatch a
// host mutation against the previous saved room.
let staleActions=0; FL.acts.hnext=()=>staleActions++; FL.host={code:'F2BY',key:'saved-password'};
w.document.getElementById('app').innerHTML='<button data-act="hnext">stale next</button>';
w.document.querySelector('[data-act=hnext]').click(); assert.equal(staleActions,0); assert.equal(FL.host,null);
dom.window.close();
console.log('PASS: no-data ledgers, missing-decision recovery, chart labels, pagination, persistent drafts, honest action feedback and bilingual lesson');
