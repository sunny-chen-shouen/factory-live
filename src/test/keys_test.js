const fs=require('fs');
global.window={}; eval(fs.readFileSync('app/i18n.js','utf8'));
const D=window.FL.dict; const keys=new Set(Object.keys(D));
let used=new Set();
for(const f of ['core','views_team','views_screen','views_host','main']){
  const s=fs.readFileSync('app/'+f+'.js','utf8');
  for(const m of s.matchAll(/\bt\('([a-z_0-9A-Z]+)'/g)) used.add(m[1]);
  for(const m of s.matchAll(/FL\.t\('([a-z_0-9A-Z]+)'/g)) used.add(m[1]);
}
const phases=['lobby','trial','market','decide1','run1','ledger1','decide2','run2','ledger2','debrief'];
phases.forEach(p=>{used.add('ph_'+p);used.add('tip_'+p);});
['control','teams','params','tools'].forEach(k=>used.add('tab_'+k));
['reported','confirmed','disputed','host'].forEach(k=>used.add('st_'+k));
['period1','period2'].forEach(k=>used.add(k));
['err_bad_host_key','err_bad_team_token','err_no_session','err_table_taken','err_bad_name','err_locked_phase','err_not_deciding','err_not_in_phase','err_bad_l','err_bad_q','err_self_report','err_not_producing','err_key_too_short','err_wrong_session','err_bad_present','err_bad_predict'].forEach(k=>used.add(k));
const skip=new Set(['ph_','tip_','tab_','st_','period','ph_run']);
let bad=0;
for(const k of used){ if(skip.has(k)) continue; if(!keys.has(k)){console.log('MISSING',k);bad=1;} }
// param count sanity: every {n} used must be consecutive from 0 in both languages
for(const [k,v] of Object.entries(D)){
  for(const l of ['zh','en']){ const ps=[...v[l].matchAll(/\{(\d)\}/g)].map(m=>+m[1]); const mx=ps.length?Math.max(...ps):-1; for(let i=0;i<=mx;i++) if(!ps.includes(i)){console.log('PARAM GAP',k,l);bad=1;} }
  const pz=new Set([...v.zh.matchAll(/\{(\d)\}/g)].map(m=>m[1])), pe=new Set([...v.en.matchAll(/\{(\d)\}/g)].map(m=>m[1]));
  if([...pz].sort().join()!==[...pe].sort().join()){console.log('PARAM MISMATCH zh/en',k);bad=1;}
}
const unused=[...keys].filter(k=>!used.has(k)); console.log('unused keys:',unused.join(' ')||'none');
console.log(bad?'FAILED':'keys ok', keys.size,'keys');
process.exit(bad);
