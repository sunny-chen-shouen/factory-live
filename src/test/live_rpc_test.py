"""Explicit live integration test. Creates only a dedicated three-factory QA room.
No schema changes; no existing classroom rooms are touched. Run from src/.
"""
import json, pathlib, re, urllib.request

root = pathlib.Path(__file__).resolve().parents[1]
deployed = (root.parent / 'index.html').read_text()
url, key = re.search(r'window.FL_CONFIG = \{ url: "([^"]+)", key: "([^"]+)"', deployed).groups()
host_key = 'qa-test-1125'
def rpc(name, **args):
    request = urllib.request.Request(url + '/rest/v1/rpc/' + name, data=json.dumps(args).encode(), headers={
        'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            text = response.read().decode()
            return json.loads(text) if text else None
    except urllib.error.HTTPError as e:
        raise RuntimeError(name + ': ' + e.read().decode()) from e

code = rpc('fl_create', p_key=host_key)
teams = [rpc('fl_join', p_code=code, p_name=name, p_table=table, p_present=4)
         for name, table in [('QA短期開工',1),('QA持續生產',2),('QA停工退出',20)]]
def stage(phase, reveal):
    rpc('fl_host_set', p_code=code, p_key=host_key, p_patch={'phase':phase,'reveal':reveal,'shift':{}})
def snap(): return rpc('fl_snapshot', p_code=code)
stage('trial', 0)
curves = [[5,9,11,12],[12,18,21,22],[1,2,2,2]]
for i, (team, values) in enumerate(zip(teams, curves)):
    verifier = teams[(i+1)%3]
    for L, q in enumerate(values, 1):
        rpc('fl_report', p_team=verifier['team_id'], p_token=verifier['token'], p_target=team['team_id'], p_kind='trial', p_l=L, p_q=q)
        rpc('fl_confirm', p_team=team['team_id'], p_token=team['token'], p_kind='trial', p_l=L, p_ok=True)
assert len(snap()['runs']) == 12
# Check the teacher edit endpoint as well as student reporting/confirmation.
rpc('fl_host_run',p_code=code,p_key=host_key,p_team=teams[0]['team_id'],p_kind='trial',p_l=2,p_q=9)
stage('decide1',0)
for i,L in enumerate([2,2,0]):
    team=teams[i]
    if i==2:
        rpc('fl_host_decide',p_code=code,p_key=host_key,p_team=team['team_id'],p_period=1,p_renew=True,p_l=L,p_predict=None)
    else:
        rpc('fl_submit',p_team=team['team_id'],p_token=team['token'],p_period=1,p_renew=True,p_l=L,p_predict=None)
assert len(snap()['locked'])==3 and len(snap()['decisions'])==0
stage('run1',1)
for i,q in enumerate([9,18]):
    team,verifier=teams[i],teams[(i+1)%3]
    rpc('fl_report',p_team=verifier['team_id'],p_token=verifier['token'],p_target=team['team_id'],p_kind='p1',p_l=2,p_q=q)
    rpc('fl_confirm',p_team=team['team_id'],p_token=team['token'],p_kind='p1',p_l=2,p_ok=True)
stage('ledger1',1)
stage('decide2',1)
for i,renew in enumerate([False,True,False]):
    team=teams[i]
    rpc('fl_submit',p_team=team['team_id'],p_token=team['token'],p_period=2,p_renew=renew,p_l=2 if renew else 0,p_predict=2)
assert len(snap()['decisions'])==3 # second period stays private
stage('run2',2)
rpc('fl_report',p_team=teams[0]['team_id'],p_token=teams[0]['token'],p_target=teams[1]['team_id'],p_kind='p2',p_l=2,p_q=19)
rpc('fl_confirm',p_team=teams[1]['team_id'],p_token=teams[1]['token'],p_kind='p2',p_l=2,p_ok=True)
stage('ledger2',2)
rpc('fl_host_set',p_code=code,p_key=host_key,p_patch={'params':{'featured':teams[0]['team_id']}})
snapshot=snap()
assert len(snapshot['decisions'])==6
assert all(r['status'] in ('confirmed','host') for r in snapshot['runs'])
out={'code':code,'snapshot':snapshot,'expected':[[-6,-12,0,-6],[12,-12,14,0],[-12,-16,0,-12]]}
(root/'test/.live_qa.json').write_text(json.dumps(out,ensure_ascii=False))
print('PASS live production RPCs: report, confirm, submit, hostRun, hostDecide; decision privacy and persisted counts')
print('QA room:',code)
