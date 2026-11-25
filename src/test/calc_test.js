const C = require('../app/calc.js');
let bad=0; const ok=(l,c)=>{console.log(c?'ok  ':'FAIL',l); if(!c) bad=1;};
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

const pts={1:5,2:9,3:11,4:12};
const rows=C.planRows(pts,2,6);
ok('draft 01 net column 0,4,6,4,0', eq(rows.map(r=>r.net),[0,4,6,4,0]));
ok('marginal value 10,8,4,2', eq(rows.slice(1).map(r=>r.dV),[10,8,4,2]));
ok('MC per ring 1.2,1.5,3,6', eq(rows.slice(1).map(r=>+r.mc.toFixed(2)),[1.2,1.5,3,6]));
const bp=C.bestPlan(pts,2,6); ok('best L=2, G=6', bp.L===2&&bp.G===6);
ok('p=4 profits after rent 2,12,14,12', eq(C.planRows(pts,4,6).slice(1).map(r=>r.net-12),[2,12,14,12]));
ok('positive tie → fewer workers', C.bestPlan({1:5,2:8},2,6).L===1);
ok('tie rule concrete', C.bestPlan({1:6,2:12},1,6).L===0);

// 02 bead numbers p=3,w=7,F=10
const b={1:4,2:7,3:9,4:10}; const bb=C.bestPlan(b,3,7);
ok('bead: best 2 workers, G=7', bb.L===2&&bb.G===7);

// ledger scenario
const T={id:'A',table_no:1,present:4,name:'白頭翁'};
const snap={session:{params:{p:2,w:6,F:12}},teams:[T],
  runs:[1,2,3,4].map(L=>({team_id:'A',kind:'trial',L,q:pts[L],status:'confirmed'})).concat([{team_id:'A',kind:'p1',L:2,q:9,status:'confirmed'}]),
  decisions:[{team_id:'A',period:1,renew:true,L:2,predict:null},{team_id:'A',period:2,renew:false,L:0,predict:1}]};
const led=C.ledger(T,snap);
ok('period1 profit −6, counterfactual −12', led.periods[1].profit===-6 && led.periods[1].counterfactual===-12);
ok('period2 exit 0, estimate renew −6', led.periods[2].profit===0 && led.periods[2].counterfactual===-6 && led.periods[2].counterfactualKind==='estimate');
ok('total −6, openThenExit', led.total===-6 && led.openThenExit);
const agg=C.classAggregates(snap); ok('aggregates', agg.opened1===1&&agg.exit2===1&&agg.exitsAmongOpened===1);

// unconfirmed run is pending, not counted
const s2=JSON.parse(JSON.stringify(snap)); s2.runs.find(r=>r.kind==='p1').status='reported';
const l2=C.ledger(T,s2); ok('reported run stays pending; total is unknown', l2.periods[1].pending===true && l2.periods[1].complete===false && l2.total===null);
// stopped team
const s3=JSON.parse(JSON.stringify(snap)); s3.decisions[0].L=0; const l3=C.ledger(T,s3);
ok('stop: −F, counterfactual best-plan estimate G−F', l3.periods[1].profit===-12 && l3.periods[1].counterfactual===-6);

// verifier mapping
const mk=n=>({id:'t'+n,table_no:n,present:3});
const ts=[1,2,3,4,5].map(mk);
const vf=n=>C.verifierOf(ts[n-1],ts).table_no;
ok('verifier pair 1↔2, final three cycle 3→4→5→3', vf(1)===2&&vf(2)===1&&vf(3)===4&&vf(4)===5&&vf(5)===3);
ok('table 4 verifies exactly table 3', eq(C.verifies(ts[3],ts).map(t=>t.table_no),[3]));
const gap=[1,3].map(mk); ok('gap tables still paired', C.verifierOf(gap[0],gap).table_no===3);
ok('single table has no verifier', C.verifierOf(mk(1),[mk(1)])===null);
ok('empty tables ignored', C.verifierOf(ts[0],[ts[0],{id:'x',table_no:2,present:0},ts[2]]).table_no===3);
for(let n=2;n<=40;n++){
 const roster=Array.from({length:n},(_,i)=>mk(i*3+1));
 ok('gapped roster '+n+': everyone counts and is counted exactly once',roster.every(tm=>C.verifierOf(tm,roster).id!==tm.id&&C.verifies(tm,roster).length===1));
}
const none=JSON.parse(JSON.stringify(snap));none.decisions=[];none.runs=[];
const nl=C.ledger(T,none);ok('missing first decision still has prepaid rent; next rent unknown',nl.periods[1].rent===12&&nl.periods[2].rent===null&&nl.total===null);
const low=JSON.parse(JSON.stringify(snap));low.decisions[0].L=0;low.runs=[{team_id:'A',kind:'trial',L:1,q:1,status:'host'}];
ok('shutdown alternative is a positive-worker plan, even if it loses more',C.ledger(T,low).periods[1].counterfactual===-16);
const renewedZero=JSON.parse(JSON.stringify(snap));renewedZero.decisions[1]={team_id:'A',period:2,renew:true,L:0};
ok('renew but hire zero: rent lost; exact exit alternative is zero',C.ledger(T,renewedZero).periods[2].profit===-12&&C.ledger(T,renewedZero).periods[2].counterfactual===0);
ok('unverified trial data excluded from plans',!Object.keys(C.trialPoints([{team_id:'A',kind:'trial',L:1,q:99,status:'disputed'}],'A')).length);

// recommender
const tp=[{1:5,2:9,3:11,4:12},{1:4,2:7,3:9,4:10},{1:6,2:10,3:12,4:13},{1:5,2:8,3:10,4:11},{1:3,2:6,3:8,4:9}];
const rec=C.recommend(tp); ok('recommender returns suggestions', rec.length>0);
console.log(rec.slice(0,3));
ok('revealFor', C.revealFor('decide1')===0&&C.revealFor('run1')===1&&C.revealFor('ledger1')===1&&C.revealFor('decide2')===1&&C.revealFor('run2')===2&&C.revealFor('debrief')===2);
process.exit(bad);
