-- Add the first scored round without renumbering existing two-period data.
-- Internal 0/1/2 are displayed as rounds 1/2/3 in extended rooms.
alter table public.fl_runs drop constraint fl_runs_kind_check;
alter table public.fl_runs add constraint fl_runs_kind_check check (kind in ('trial','p0','p1','p2'));
alter table public.fl_decisions drop constraint fl_decisions_period_check;
alter table public.fl_decisions add constraint fl_decisions_period_check check (period in (0,1,2));


create or replace function fl_update_team(p_team uuid, p_token text, p_present int)
returns void language plpgsql security definer set search_path = public as $$
declare v_code text; v_phase text;
begin
  v_code := fl_chk_team(p_team, p_token);
  select phase into v_phase from fl_sessions where code = v_code;
  if v_phase not in ('lobby','practice','trial','market') then raise exception 'locked_phase'; end if;
  if p_present < 0 or p_present > 4 then raise exception 'bad_present'; end if;
  update fl_teams set present = p_present where id = p_team;
  perform fl_bump(v_code);
end $$;

create or replace function fl_snapshot(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_code text := upper(trim(p_code));
  s fl_sessions%rowtype;
begin
  select * into s from fl_sessions where code = v_code;
  if not found then return null; end if;
  return jsonb_build_object(
    'now', fl_now(),
    'session', jsonb_build_object('code', s.code, 'phase', s.phase, 'params', s.params,
                                  'shift', s.shift, 'reveal', s.reveal, 'rev', s.rev),
    'teams', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name,
                         'table_no', t.table_no, 'present', t.present) order by t.table_no)
                         from fl_teams t where t.code = v_code), '[]'::jsonb),
    'runs', coalesce((select jsonb_agg(jsonb_build_object('team_id', r.team_id, 'kind', r.kind,
                         'L', r.L, 'q', r.q, 'status', r.status, 'reporter', r.reporter))
                         from fl_runs r join fl_teams t on t.id = r.team_id where t.code = v_code), '[]'::jsonb),
    'locked', coalesce((select jsonb_agg(jsonb_build_object('team_id', d.team_id, 'period', d.period))
                         from fl_decisions d join fl_teams t on t.id = d.team_id where t.code = v_code), '[]'::jsonb),
    'decisions', coalesce((select jsonb_agg(jsonb_build_object('team_id', d.team_id, 'period', d.period,
                         'renew', d.renew, 'L', d.L, 'predict', d.predict))
                         from fl_decisions d join fl_teams t on t.id = d.team_id
                         where t.code = v_code and ((d.period > 0 and d.period <= s.reveal) or (d.period = 0 and s.phase in ('run0','ledger0','decide1','run1','ledger1','decide2','run2','ledger2','debrief')))), '[]'::jsonb)
  );
end $$;

create or replace function fl_submit(p_team uuid, p_token text, p_period int, p_renew boolean, p_L int, p_predict int)
returns void language plpgsql security definer set search_path = public as $$
declare v_code text; v_phase text; v_present int;
begin
  v_code := fl_chk_team(p_team, p_token);
  select phase into v_phase from fl_sessions where code = v_code;
  if v_phase <> 'decide' || p_period::text then raise exception 'not_deciding'; end if;
  select present into v_present from fl_teams where id = p_team;
  if p_period not in (0,1,2) or (p_period=0 and not coalesce((select (params->>'extended_rounds')::boolean from fl_sessions where code=v_code),false)) then raise exception 'bad_period'; end if;
  if p_period < 2 then p_renew := true; end if;
  if not p_renew then p_L := 0; end if;
  if p_L < 0 or p_L > v_present then raise exception 'bad_L'; end if;
  if p_predict is not null and (p_predict < 0 or p_predict > 60) then raise exception 'bad_predict'; end if;
  insert into fl_decisions(team_id, period, renew, L, predict)
       values (p_team, p_period, p_renew, p_L, case when p_period = 2 then p_predict end)
  on conflict (team_id, period)
  do update set renew = excluded.renew, L = excluded.L, predict = excluded.predict, updated_at = now();
  perform fl_bump(v_code);
end $$;

create or replace function fl_report(p_team uuid, p_token text, p_target uuid, p_kind text, p_L int, p_q int)
returns void language plpgsql security definer set search_path = public as $$
declare v_code text; v_phase text; v_tcode text; v_present int; v_dL int; v_renew boolean; v_period int;
begin
  v_code := fl_chk_team(p_team, p_token);
  select code, present into v_tcode, v_present from fl_teams where id = p_target;
  if v_tcode is distinct from v_code then raise exception 'wrong_session'; end if;
  if p_target = p_team then raise exception 'self_report'; end if;
  select phase into v_phase from fl_sessions where code = v_code;
  if p_q < 0 or p_q > 300 then raise exception 'bad_q'; end if;

  if p_kind = 'trial' then
    if v_phase <> 'trial' then raise exception 'not_in_phase'; end if;
    if p_L < 1 or p_L > v_present then raise exception 'bad_L'; end if;
  elsif p_kind in ('p0','p1','p2') then
    if p_kind='p0' and not coalesce((select (params->>'extended_rounds')::boolean from fl_sessions where code=v_code),false) then raise exception 'bad_kind'; end if;
    v_period := substr(p_kind, 2)::int;
    if v_phase <> 'run' || v_period::text then raise exception 'not_in_phase'; end if;
    select L, renew into v_dL, v_renew from fl_decisions where team_id = p_target and period = v_period;
    if not found or v_renew is not true then raise exception 'not_producing'; end if;
    p_L := v_dL;
  else
    raise exception 'bad_kind';
  end if;

  insert into fl_runs(team_id, kind, L, q, status, reporter)
       values (p_target, p_kind, p_L, p_q, 'reported', p_team)
  on conflict (team_id, kind, L)
  do update set q = excluded.q, status = 'reported', reporter = excluded.reporter, updated_at = now();
  perform fl_bump(v_code);
end $$;

create or replace function fl_host_decide(p_code text, p_key text, p_team uuid, p_period int, p_renew boolean, p_L int, p_predict int)
returns void language plpgsql security definer set search_path = public as $$
declare v_present int;
begin
  perform fl_chk_host(p_code, p_key);
  select present into v_present from fl_teams where id = p_team and code = p_code;
  if not found then raise exception 'wrong_session'; end if;
  if p_period not in (0,1,2) or (p_period=0 and not coalesce((select (params->>'extended_rounds')::boolean from fl_sessions where code=p_code),false)) then raise exception 'bad_period'; end if;
  if p_period < 2 then p_renew := true; end if;
  if not p_renew then p_L := 0; end if;
  if p_L < 0 or p_L > v_present then raise exception 'bad_L'; end if;
  insert into fl_decisions(team_id, period, renew, L, predict)
       values (p_team, p_period, p_renew, p_L, case when p_period = 2 then p_predict end)
  on conflict (team_id, period)
  do update set renew = excluded.renew, L = excluded.L, predict = excluded.predict, updated_at = now();
  perform fl_bump(p_code);
end $$;

create or replace function fl_host_set(p_code text, p_key text, p_patch jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_rev bigint; v_params jsonb;
begin
  perform fl_chk_host(p_code, p_key);
  select params into v_params from fl_sessions where code=p_code for update;
  if coalesce((v_params->>'extended_rounds')::boolean,false) then
    if coalesce((v_params->>'timing_locked')::boolean,false) and exists (
      select 1 from jsonb_each(coalesce(p_patch->'params','{}'::jsonb)) e
      where e.key in ('secs','trial_secs','practice_secs','extended_rounds') and e.value is distinct from v_params->e.key
    ) then raise exception 'timing_locked'; end if;
    if p_patch ? 'params' and exists (
      select 1 from jsonb_each(p_patch->'params') e where e.key in ('secs','trial_secs','practice_secs')
      and (jsonb_typeof(e.value) <> 'number' or (e.value::text)::numeric not between 1 and 120 or (e.value::text)::numeric <> trunc((e.value::text)::numeric))
    ) then raise exception 'bad_duration'; end if;
  end if;
  update fl_sessions s set
      phase  = coalesce(p_patch->>'phase', s.phase),
      params = case when p_patch ? 'params' then s.params || (p_patch->'params') else s.params end,
      shift  = case when p_patch ? 'shift'  then (p_patch->'shift') else s.shift end,
      reveal = coalesce((p_patch->>'reveal')::int, s.reveal),
      rev    = s.rev + 1
   where s.code = p_code
  returning rev into v_rev;
  return v_rev;
end $$;

create or replace function fl_host_reset(p_code text, p_key text, p_scope text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform fl_chk_host(p_code, p_key);
  if p_scope = 'trial' then
    delete from fl_runs where kind = 'trial' and team_id in (select id from fl_teams where code = p_code);
  elsif p_scope in ('runs','all') then
    delete from fl_runs      where team_id in (select id from fl_teams where code = p_code);
    delete from fl_decisions where team_id in (select id from fl_teams where code = p_code);
    update fl_sessions set phase = 'lobby', reveal = 0, shift = '{}'::jsonb, params = params - 'timing_locked' where code = p_code;
    if p_scope = 'all' then delete from fl_teams where code = p_code; end if;
  else
    raise exception 'bad_scope';
  end if;
  perform fl_bump(p_code);
end $$;

create or replace function fl_host_run(p_code text, p_key text, p_team uuid, p_kind text, p_L int, p_q int)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform fl_chk_host(p_code, p_key);
  if not exists (select 1 from fl_teams where id = p_team and code = p_code) then raise exception 'wrong_session'; end if;
  if p_q is null then
    delete from fl_runs where team_id = p_team and kind = p_kind and L = p_L;
  else
    insert into fl_runs(team_id, kind, L, q, status) values (p_team, p_kind, p_L, p_q, 'host')
    on conflict (team_id, kind, L) do update set q = excluded.q, status = 'host', updated_at = now();
  end if;
  perform fl_bump(p_code);
end $$;
