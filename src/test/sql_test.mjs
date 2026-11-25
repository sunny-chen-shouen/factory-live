import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
const db = new PGlite();
await db.exec(`create role anon nologin; create role authenticated nologin;`);
await db.exec(fs.readFileSync('../sql/001_factory_live.sql','utf8'));
const q = async (sql, params=[]) => (await db.query(sql, params)).rows;
const fail = async (label, sql, params=[], expect) => {
  try { await db.query(sql, params); console.log('FAIL (no error):', label); process.exitCode=1; }
  catch(e){ const ok = !expect || e.message.includes(expect); console.log(ok?'ok  ':'FAIL', 'rejects:', label, '->', e.message); if(!ok) process.exitCode=1; }
};
const check = (label, cond) => { console.log(cond?'ok  ':'FAIL', label); if(!cond) process.exitCode=1; };

const code = (await q(`select fl_create('secret1') as c`))[0].c;
check('code is 4 chars', code.length===4);
await fail('short host key', `select fl_create('abc')`, [], 'key_too_short');

const j1 = (await q(`select fl_join($1,'青鳥',1,3) as j`,[code]))[0].j;
const j2 = (await q(`select fl_join($1,'紅隊',2,2) as j`,[code]))[0].j;
check('join returns token', j1.token && j1.team_id);
await fail('table taken by other name', `select fl_join($1,'別人',1,3)`,[code],'table_taken');
const again = (await q(`select fl_join($1,'青鳥',1,3) as j`,[code]))[0].j;
check('rejoin returns same token', again.token===j1.token);
await fail('bad code', `select fl_join('ZZZZ','x',1,1)`,[], 'no_session');

// wrong phase for decisions
await fail('submit outside decide', `select fl_submit($1,$2,1,true,2,null)`,[j1.team_id,j1.token],'not_deciding');

// trial phase
await q(`select fl_host_set($1,'secret1','{"phase":"trial"}'::jsonb)`,[code]);
await fail('bad host key', `select fl_host_set($1,'nope','{"phase":"market"}'::jsonb)`,[code],'bad_host_key');
await q(`select fl_report($1,$2,$3,'trial',2,9)`,[j2.team_id,j2.token,j1.team_id]);
await fail('report L above present', `select fl_report($1,$2,$3,'trial',4,9)`,[j2.team_id,j2.token,j1.team_id],'bad_L');
await fail('self report', `select fl_report($1,$2,$1,'trial',1,5)`,[j1.team_id,j1.token],'self_report');
await fail('wrong token', `select fl_report($1,'bad',$2,'trial',1,5)`,[j2.team_id,j1.team_id],'bad_team_token');
await q(`select fl_confirm($1,$2,'trial',2,true)`,[j1.team_id,j1.token]);
let snap = (await q(`select fl_snapshot($1) as s`,[code]))[0].s;
check('trial run confirmed in snapshot', snap.runs.length===1 && snap.runs[0].status==='confirmed' && snap.runs[0].q===9);
await q(`select fl_host_run($1,'secret1',$2,'trial',1,5)`,[code,j1.team_id]);
await q(`select fl_host_run($1,'secret1',$2,'trial',3,11)`,[code,j1.team_id]);
snap = (await q(`select fl_snapshot($1) as s`,[code]))[0].s;
check('host overrides add runs', snap.runs.length===3);

// decide 1
await q(`select fl_host_set($1,'secret1','{"phase":"decide1"}'::jsonb)`,[code]);
await q(`select fl_submit($1,$2,1,true,2,null)`,[j1.team_id,j1.token]);
await q(`select fl_submit($1,$2,1,true,0,null)`,[j2.team_id,j2.token]);
await fail('L above present', `select fl_submit($1,$2,1,true,3,null)`,[j2.team_id,j2.token],'bad_L');
await q(`select fl_submit($1,$2,1,true,1,null)`,[j2.team_id,j2.token]); // change before lock
snap = (await q(`select fl_snapshot($1) as s`,[code]))[0].s;
check('locked list shows 2, decisions hidden', snap.locked.length===2 && snap.decisions.length===0);
check('own decision readable', (await q(`select fl_my_decisions($1,$2) as d`,[j2.team_id,j2.token]))[0].d[0].L===1);
await fail('others cannot read mine', `select fl_my_decisions($1,$2)`,[j2.team_id,j1.token],'bad_team_token');

// reveal + run1
await q(`select fl_host_set($1,'secret1','{"phase":"run1","reveal":1}'::jsonb)`,[code]);
snap = (await q(`select fl_snapshot($1) as s`,[code]))[0].s;
check('period 1 decisions revealed', snap.decisions.length===2);
await q(`select fl_report($1,$2,$3,'p1',99,9)`,[j2.team_id,j2.token,j1.team_id]); // L ignored -> decision L=2
await q(`select fl_report($1,$2,$3,'p1',99,5)`,[j1.team_id,j1.token,j2.team_id]);
snap = (await q(`select fl_snapshot($1) as s`,[code]))[0].s;
const p1 = snap.runs.filter(r=>r.kind==='p1');
check('p1 runs use decided L', p1.length===2 && p1.some(r=>r.L===2&&r.q===9) && p1.some(r=>r.L===1&&r.q===5));
await q(`select fl_confirm($1,$2,'p1',2,false)`,[j1.team_id,j1.token]);
snap = (await q(`select fl_snapshot($1) as s`,[code]))[0].s;
check('dispute flagged', snap.runs.find(r=>r.kind==='p1'&&r.team_id===j1.team_id).status==='disputed');

// period 2
await q(`select fl_host_set($1,'secret1','{"phase":"decide2"}'::jsonb)`,[code]);
await q(`select fl_submit($1,$2,2,false,3,1)`,[j1.team_id,j1.token]); // exit -> L forced 0
await q(`select fl_submit($1,$2,2,true,1,0)`,[j2.team_id,j2.token]);
snap = (await q(`select fl_snapshot($1) as s`,[code]))[0].s;
check('period 2 still hidden', !snap.decisions.some(d=>d.period===2));
await q(`select fl_host_set($1,'secret1','{"phase":"run2","reveal":2}'::jsonb)`,[code]);
snap = (await q(`select fl_snapshot($1) as s`,[code]))[0].s;
const d2 = snap.decisions.filter(d=>d.period===2);
check('p2 revealed; exit forced L=0', d2.length===2 && d2.find(d=>d.team_id===j1.team_id).L===0 && d2.find(d=>d.team_id===j1.team_id).renew===false);
await fail('exited team cannot be reported', `select fl_report($1,$2,$3,'p2',0,4)`,[j2.team_id,j2.token,j1.team_id],'not_producing');
await q(`select fl_report($1,$2,$3,'p2',0,4)`,[j1.team_id,j1.token,j2.team_id]);

// host decide override and params merge
await q(`select fl_host_set($1,'secret1','{"params":{"p":3}}'::jsonb)`,[code]);
snap = (await q(`select fl_snapshot($1) as s`,[code]))[0].s;
check('params merged, others kept', snap.session.params.p===3 && snap.session.params.w===6 && snap.session.params.F===12);
await q(`select fl_host_decide($1,'secret1',$2,2,true,2,1)`,[code,j2.team_id]);
check('host decide override', (await q(`select L from fl_decisions where team_id=$1 and period=2`,[j2.team_id]))[0].l===2);

// RLS: anon cannot read secrets or decisions, can read public tables
await db.exec('set role anon');
await fail('anon cannot read decisions', `select * from fl_decisions`,[], 'permission denied');
await fail('anon cannot read team tokens', `select * from fl_team_secrets`,[], 'permission denied');
await fail('anon cannot read host keys', `select * from fl_secrets`,[], 'permission denied');
await fail('anon cannot insert runs', `insert into fl_runs values (gen_random_uuid(),'trial',1,1,'host',null,now())`,[], 'permission denied');
await fail('anon cannot call helper', `select fl_chk_host('${code}','secret1')`,[], 'permission denied');
check('anon can snapshot', (await q(`select fl_snapshot($1) as s`,[code]))[0].s.teams.length===2);
await db.exec('reset role');

// reset
await q(`select fl_host_reset($1,'secret1','runs')`,[code]);
snap = (await q(`select fl_snapshot($1) as s`,[code]))[0].s;
check('reset runs clears runs, keeps teams, back to lobby', snap.runs.length===0 && snap.teams.length===2 && snap.session.phase==='lobby' && snap.session.reveal===0);
await q(`select fl_host_team($1,'secret1',$2,'{"present":4,"name":"改名"}'::jsonb)`,[code,j1.team_id]);
snap = (await q(`select fl_snapshot($1) as s`,[code]))[0].s;
check('host edits team', snap.teams[0].present===4 && snap.teams[0].name==='改名');
await q(`select fl_host_team($1,'secret1',$2,'{}'::jsonb,true)`,[code,j2.team_id]);
check('host deletes team', (await q(`select fl_snapshot($1) as s`,[code]))[0].s.teams.length===1);
console.log(process.exitCode? 'SOME FAILED':'ALL PASSED');
