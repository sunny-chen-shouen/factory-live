-- 工廠LIVE (Factory LIVE) — classroom firm-decision game
-- All tables use the fl_ prefix. Clients never write tables directly: every
-- write goes through a SECURITY DEFINER function that checks a team token or
-- the teacher's key. Secret decisions are never readable until revealed.

create table if not exists fl_sessions (
  code        text primary key,
  phase       text   not null default 'lobby',
  params      jsonb  not null default '{"p":2,"w":6,"F":12,"secs":20,"kmax":4}'::jsonb,
  shift       jsonb  not null default '{}'::jsonb,
  reveal      int    not null default 0,
  rev         bigint not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists fl_secrets (
  code      text primary key references fl_sessions(code) on delete cascade,
  host_key  text not null
);

create table if not exists fl_teams (
  id         uuid primary key default gen_random_uuid(),
  code       text not null references fl_sessions(code) on delete cascade,
  name       text not null check (char_length(name) between 1 and 24),
  table_no   int  not null check (table_no between 1 and 60),
  present    int  not null default 0 check (present between 0 and 4),
  created_at timestamptz not null default now(),
  unique (code, table_no)
);

create table if not exists fl_team_secrets (
  team_id uuid primary key references fl_teams(id) on delete cascade,
  token   text not null
);

-- kind: 'trial' (L = tested headcount), 'p1' / 'p2' (L = hired headcount)
create table if not exists fl_runs (
  team_id    uuid not null references fl_teams(id) on delete cascade,
  kind       text not null check (kind in ('trial','p1','p2')),
  L          int  not null check (L between 0 and 4),
  q          int  not null check (q between 0 and 300),
  status     text not null default 'reported' check (status in ('reported','confirmed','disputed','host')),
  reporter   uuid,
  updated_at timestamptz not null default now(),
  primary key (team_id, kind, L)
);

-- Hidden until revealed (no select policy; read only through fl_snapshot)
create table if not exists fl_decisions (
  team_id    uuid not null references fl_teams(id) on delete cascade,
  period     int  not null check (period in (1,2)),
  renew      boolean not null default true,
  L          int  not null check (L between 0 and 4),
  predict    int,
  updated_at timestamptz not null default now(),
  primary key (team_id, period)
);

alter table fl_sessions     enable row level security;
alter table fl_secrets      enable row level security;
alter table fl_teams        enable row level security;
alter table fl_team_secrets enable row level security;
alter table fl_runs         enable row level security;
alter table fl_decisions    enable row level security;

drop policy if exists fl_sessions_read on fl_sessions;
drop policy if exists fl_teams_read    on fl_teams;
drop policy if exists fl_runs_read     on fl_runs;
create policy fl_sessions_read on fl_sessions for select using (true);
create policy fl_teams_read    on fl_teams    for select using (true);
create policy fl_runs_read     on fl_runs     for select using (true);

-- ---------------------------------------------------------------- helpers

create or replace function fl_now() returns bigint
language sql stable as $$ select (extract(epoch from clock_timestamp()) * 1000)::bigint $$;

create or replace function fl_bump(p_code text) returns void
language sql as $$ update fl_sessions set rev = rev + 1 where code = p_code $$;

create or replace function fl_chk_host(p_code text, p_key text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from fl_secrets where code = p_code and host_key = p_key) then
    raise exception 'bad_host_key';
  end if;
end $$;

create or replace function fl_chk_team(p_team uuid, p_token text) returns text
language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  select t.code into v_code
    from fl_teams t join fl_team_secrets s on s.team_id = t.id
   where t.id = p_team and s.token = p_token;
  if v_code is null then raise exception 'bad_team_token'; end if;
  return v_code;
end $$;

-- ---------------------------------------------------------------- session

create or replace function fl_create(p_key text) returns text
language plpgsql security definer set search_path = public as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  i int;
begin
  if p_key is null or char_length(p_key) < 6 then raise exception 'key_too_short'; end if;
  loop
    v_code := '';
    for i in 1..4 loop
      v_code := v_code || substr(alphabet, 1 + floor(random() * char_length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from fl_sessions where code = v_code);
  end loop;
  insert into fl_sessions(code) values (v_code);
  insert into fl_secrets(code, host_key) values (v_code, p_key);
  return v_code;
end $$;

create or replace function fl_join(p_code text, p_name text, p_table int, p_present int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_code text := upper(trim(p_code));
  v_team fl_teams%rowtype;
  v_token text;
begin
  if not exists (select 1 from fl_sessions where code = v_code) then raise exception 'no_session'; end if;
  p_name := trim(p_name);
  if p_name = '' or char_length(p_name) > 24 then raise exception 'bad_name'; end if;
  if p_present < 0 or p_present > 4 then raise exception 'bad_present'; end if;

  select * into v_team from fl_teams where code = v_code and table_no = p_table;
  if found then
    if v_team.name <> p_name then raise exception 'table_taken'; end if;
    select token into v_token from fl_team_secrets where team_id = v_team.id;
  else
    insert into fl_teams(code, name, table_no, present) values (v_code, p_name, p_table, p_present)
      returning * into v_team;
    v_token := gen_random_uuid()::text;
    insert into fl_team_secrets(team_id, token) values (v_team.id, v_token);
  end if;
  perform fl_bump(v_code);
  return jsonb_build_object('team_id', v_team.id, 'token', v_token, 'code', v_code);
end $$;

create or replace function fl_update_team(p_team uuid, p_token text, p_present int)
returns void language plpgsql security definer set search_path = public as $$
declare v_code text; v_phase text;
begin
  v_code := fl_chk_team(p_team, p_token);
  select phase into v_phase from fl_sessions where code = v_code;
  if v_phase not in ('lobby','trial','market') then raise exception 'locked_phase'; end if;
  if p_present < 0 or p_present > 4 then raise exception 'bad_present'; end if;
  update fl_teams set present = p_present where id = p_team;
  perform fl_bump(v_code);
end $$;

-- ---------------------------------------------------------------- public state

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
                         where t.code = v_code and d.period <= s.reveal), '[]'::jsonb)
  );
end $$;

-- A team may read back its own (still hidden) decision
create or replace function fl_my_decisions(p_team uuid, p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform fl_chk_team(p_team, p_token);
  return coalesce((select jsonb_agg(jsonb_build_object('period', period, 'renew', renew, 'L', L, 'predict', predict))
                     from fl_decisions where team_id = p_team), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------- team actions

create or replace function fl_submit(p_team uuid, p_token text, p_period int, p_renew boolean, p_L int, p_predict int)
returns void language plpgsql security definer set search_path = public as $$
declare v_code text; v_phase text; v_present int;
begin
  v_code := fl_chk_team(p_team, p_token);
  select phase into v_phase from fl_sessions where code = v_code;
  if v_phase <> 'decide' || p_period::text then raise exception 'not_deciding'; end if;
  select present into v_present from fl_teams where id = p_team;
  if p_period = 1 then p_renew := true; end if;
  if not p_renew then p_L := 0; end if;
  if p_L < 0 or p_L > v_present then raise exception 'bad_L'; end if;
  if p_predict is not null and (p_predict < 0 or p_predict > 60) then raise exception 'bad_predict'; end if;
  insert into fl_decisions(team_id, period, renew, L, predict)
       values (p_team, p_period, p_renew, p_L, case when p_period = 2 then p_predict end)
  on conflict (team_id, period)
  do update set renew = excluded.renew, L = excluded.L, predict = excluded.predict, updated_at = now();
  perform fl_bump(v_code);
end $$;

-- A neighbour (or any other team) reports the verified ring count for p_target
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
  elsif p_kind in ('p1','p2') then
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

-- The target team agrees or disputes the reported number
create or replace function fl_confirm(p_team uuid, p_token text, p_kind text, p_L int, p_ok boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  v_code := fl_chk_team(p_team, p_token);
  update fl_runs set status = case when p_ok then 'confirmed' else 'disputed' end, updated_at = now()
   where team_id = p_team and kind = p_kind and L = p_L and status in ('reported','disputed','confirmed');
  perform fl_bump(v_code);
end $$;

-- ---------------------------------------------------------------- host actions

create or replace function fl_host_set(p_code text, p_key text, p_patch jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_rev bigint;
begin
  perform fl_chk_host(p_code, p_key);
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

create or replace function fl_host_team(p_code text, p_key text, p_team uuid, p_patch jsonb, p_delete boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform fl_chk_host(p_code, p_key);
  if not exists (select 1 from fl_teams where id = p_team and code = p_code) then raise exception 'wrong_session'; end if;
  if p_delete then
    delete from fl_teams where id = p_team;
  else
    update fl_teams set
        present  = coalesce((p_patch->>'present')::int, present),
        name     = coalesce(nullif(p_patch->>'name',''), name),
        table_no = coalesce((p_patch->>'table_no')::int, table_no)
     where id = p_team;
  end if;
  perform fl_bump(p_code);
end $$;

-- Host-only decision override (e.g. a phone died): writes a team's decision directly
create or replace function fl_host_decide(p_code text, p_key text, p_team uuid, p_period int, p_renew boolean, p_L int, p_predict int)
returns void language plpgsql security definer set search_path = public as $$
declare v_present int;
begin
  perform fl_chk_host(p_code, p_key);
  select present into v_present from fl_teams where id = p_team and code = p_code;
  if not found then raise exception 'wrong_session'; end if;
  if p_period = 1 then p_renew := true; end if;
  if not p_renew then p_L := 0; end if;
  if p_L < 0 or p_L > v_present then raise exception 'bad_L'; end if;
  insert into fl_decisions(team_id, period, renew, L, predict)
       values (p_team, p_period, p_renew, p_L, case when p_period = 2 then p_predict end)
  on conflict (team_id, period)
  do update set renew = excluded.renew, L = excluded.L, predict = excluded.predict, updated_at = now();
  perform fl_bump(p_code);
end $$;

-- scope: 'runs' clears all production and decisions; 'trial' clears trial only; 'all' also removes teams
create or replace function fl_host_reset(p_code text, p_key text, p_scope text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform fl_chk_host(p_code, p_key);
  if p_scope = 'trial' then
    delete from fl_runs where kind = 'trial' and team_id in (select id from fl_teams where code = p_code);
  elsif p_scope in ('runs','all') then
    delete from fl_runs      where team_id in (select id from fl_teams where code = p_code);
    delete from fl_decisions where team_id in (select id from fl_teams where code = p_code);
    update fl_sessions set phase = 'lobby', reveal = 0, shift = '{}'::jsonb where code = p_code;
    if p_scope = 'all' then delete from fl_teams where code = p_code; end if;
  else
    raise exception 'bad_scope';
  end if;
  perform fl_bump(p_code);
end $$;

-- ---------------------------------------------------------------- permissions

revoke execute on function fl_chk_host(text,text), fl_chk_team(uuid,text), fl_bump(text) from public;

do $$
declare r text;
begin
  foreach r in array array['anon','authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on fl_sessions, fl_secrets, fl_teams, fl_team_secrets, fl_runs, fl_decisions from %I', r);
      execute format('grant select on fl_sessions, fl_teams, fl_runs to %I', r);
      execute format('revoke execute on function fl_chk_host(text,text), fl_chk_team(uuid,text), fl_bump(text) from %I', r);
      execute format('grant execute on function fl_now(), fl_create(text), fl_join(text,text,int,int), fl_update_team(uuid,text,int), fl_snapshot(text), fl_my_decisions(uuid,text), fl_submit(uuid,text,int,boolean,int,int), fl_report(uuid,text,uuid,text,int,int), fl_confirm(uuid,text,text,int,boolean), fl_host_set(text,text,jsonb), fl_host_run(text,text,uuid,text,int,int), fl_host_team(text,text,uuid,jsonb,boolean), fl_host_decide(text,text,uuid,int,boolean,int,int), fl_host_reset(text,text,text) to %I', r);
    end if;
  end loop;
end $$;

-- Realtime ping: clients subscribe to fl_sessions (rev bumps) and refetch the snapshot
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table fl_sessions;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
