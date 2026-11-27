import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';
import {PGlite} from '@electric-sql/pglite';
const require=createRequire(import.meta.url), C=require('../app/calc.js');
const params={p:2,w:6,F:12,extended_rounds:true,practice_secs:30,trial_secs:30,secs:60,market_published:true};
const tm={id:'a',name:'Apple',present:4,table_no:1};
const runs=[1,2,3,4].map((L,i)=>({team_id:'a',kind:'trial',L,q:[4,7,8,9][i],status:'confirmed'}));
assert.deepEqual(C.productionPoints(runs,'a',params),{1:8,2:14,3:16,4:18});
assert.deepEqual(C.trialPoints(runs,'a'),{1:4,2:7,3:8,4:9});
const snap={session:{code:'TEST',phase:'ledger2',params,shift:{},rev:1,reveal:2},teams:[tm],runs,decisions:[{team_id:'a',period:0,L:1,renew:true},{team_id:'a',period:1,L:2,renew:true},{team_id:'a',period:2,L:0,renew:false}],locked:[0,1,2].map(period=>({team_id:'a',period}))};
runs.push({team_id:'a',kind:'p0',L:1,q:6,status:'confirmed'},{team_id:'a',kind:'p1',L:2,q:11,status:'confirmed'});
assert.equal(C.productionPoints(runs,'a',params)[1],6);
assert.equal(C.productionPoints(runs,'a',params)[2],11);
let led=C.ledger(tm,snap);
assert.deepEqual([0,1,2].map(i=>led.periods[i].profit),[-6,-2,0]);
assert.equal(led.total,-8); // rent 24, wages 18, revenue 34; renewal exit is 0
snap.decisions[2]={team_id:'a',period:2,L:1,renew:true};
runs.push({team_id:'a',kind:'p2',L:1,q:10,status:'reported'});
assert.equal(C.ledger(tm,snap).total,null);
runs.at(-1).status='confirmed';
assert.equal(C.ledger(tm,snap).total,-6); // final rent charged once, never twice
const dom=new JSDOM('<div id="app"></div>',{url:'https://test.invalid/#/',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window; w.scrollTo=()=>{};w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
for(const f of ['qrlib','calc','api','i18n','core','views_team','views_screen','views_host','fx','juice'])w.eval(fs.readFileSync('app/'+f+'.js','utf8'));
const FL=w.FL;FL.store.snap=JSON.parse(JSON.stringify(snap));FL.store.refresh=async()=>{};FL.me={team_id:'a',token:'token',code:'TEST'};FL.host={code:'TEST',key:'key'};
for(const lang of ['zh','en']){
 FL.lang=lang;
 for(const phase of C.phasesFor(params)){
  FL.store.snap.session.phase=phase;
  FL.store.snap.locked = /^decide/.test(phase) ? [] : snap.locked;
  for(const role of ['host','team','screen']){
   w.history.replaceState({},'','#/'+role+'/TEST');FL.render(true);
   const txt=w.document.querySelector('#app').textContent;
   assert.ok(!txt.includes('⟦'),phase+' '+role+' missing translation');
   assert.ok(!txt.includes('undefined'),phase+' '+role+' undefined');
   if(lang==='en')assert.ok(!/[\u3400-\u9fff]/.test(txt),phase+' '+role+' Chinese leak');
   if(phase==='decide0'&&role==='host')assert.equal(w.document.querySelector('[data-act=hdecide]')?.dataset.per,'0');
   if(phase==='decide1'&&role==='host')assert.equal(w.document.querySelector('[data-act=hdecide]')?.dataset.per,'1');
   if(phase==='ledger0'&&role==='screen') assert.equal(w.document.querySelectorAll('.profit-plot-row').length,1,'first-round comparison includes its factory');
  }
 }
}
// Initial and adjusted choices submit into independent slots.
FL.api.submit=async(...args)=>{FL.submitted=args;};FL.api.myDecisions=async()=>[];
for(const [phase,per] of [['decide0',0],['decide1',1]]){
 FL.store.snap.session.phase=phase;FL.U.sel1=3;await FL.acts.lock1();assert.equal(FL.submitted[2],per);
}
dom.window.close();
const db=new PGlite();await db.exec('create role anon nologin; create role authenticated nologin;');
await db.exec(fs.readFileSync('sql/001_factory_live.sql','utf8'));await db.exec(fs.readFileSync('sql/003_extended_rounds.sql','utf8'));
const q=async(sql,p=[])=> (await db.query(sql,p)).rows;
const code=(await q("select fl_create('rounds-test') c"))[0].c;
await q("select fl_host_set($1,'rounds-test',$2)",[code,JSON.stringify({params})]);
const a=(await q("select fl_join($1,'Apple',1,4) j",[code]))[0].j;
const b=(await q("select fl_join($1,'Panda',2,3) j",[code]))[0].j;
await q("select fl_host_set($1,'rounds-test','{\"phase\":\"practice\"}')",[code]);
await assert.rejects(()=>q("select fl_report($1,$2,$3,'trial',1,5)",[b.team_id,b.token,a.team_id]),/not_in_phase/);
await q("select fl_host_set($1,'rounds-test','{\"phase\":\"trial\",\"params\":{\"timing_locked\":true}}')",[code]);
await assert.rejects(()=>q("select fl_host_set($1,'rounds-test','{\"params\":{\"secs\":90}}')",[code]),/timing_locked/);
for(const per of [0,1,2]){
 await q("select fl_host_set($1,'rounds-test',$2)",[code,JSON.stringify({phase:'decide'+per,reveal:per===2?1:0})]);
 await q('select fl_submit($1,$2,$3,true,2,null)',[a.team_id,a.token,per]);
 let s=(await q('select fl_snapshot($1) s',[code]))[0].s;
 assert.ok(!s.decisions.some(d=>d.period===per),'current decision must stay secret');
 await q("select fl_host_set($1,'rounds-test',$2)",[code,JSON.stringify({phase:'run'+per,reveal:per})]);
 s=(await q('select fl_snapshot($1) s',[code]))[0].s;
 assert.ok(s.decisions.some(d=>d.period===per));
 await q('select fl_report($1,$2,$3,$4,2,$5)',[b.team_id,b.token,a.team_id,'p'+per,10+per]);
 await q('select fl_confirm($1,$2,$3,2,true)',[a.team_id,a.token,'p'+per]);
}
const final=(await q('select fl_snapshot($1) s',[code]))[0].s;
assert.equal(final.runs.length,3);assert.equal(final.decisions.length,3);
assert.equal(C.ledger(final.teams[0],final).total,-6);
// Legacy rooms do not acquire an invisible extra round or allow period 0.
const old=(await q("select fl_create('legacy-test') c"))[0].c;
const oldTeam=(await q("select fl_join($1,'Tiger',1,3) j",[old]))[0].j;
await q("select fl_host_set($1,'legacy-test','{\"phase\":\"decide0\"}')",[old]);
await assert.rejects(()=>q('select fl_submit($1,$2,0,true,1,null)',[oldTeam.team_id,oldTeam.token]),/bad_period/);
assert.equal(C.phasesFor({}).length,10);assert.equal(C.phasesFor(params).length,14);
await db.close();
console.log('PASS: three-round rent, actual-only scoring, scaled plans, independent decisions, all 84 bilingual role/phase screens, hidden decisions, unscored practice and locked timings');
