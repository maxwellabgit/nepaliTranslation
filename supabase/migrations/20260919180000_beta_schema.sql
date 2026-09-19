-- Slice 02: public read models + private data. Core translate does not use this schema.
-- security definer functions set an empty search_path and fully qualify names.

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;
grant usage on schema private to service_role;

-- ---------------------------------------------------------------------------
-- Public tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  consent_version text,
  consented_at timestamptz,
  age_confirmed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.contribution_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  public_task_id uuid,
  status text not null,
  credits_awarded integer not null default 0 check (credits_awarded >= 0),
  submitted_at timestamptz not null default now(),
  resolved_at timestamptz,
  reason_code text
);

create table public.reward_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_type text not null,
  source_id text not null,
  credits integer not null check (credits >= 0),
  minutes integer not null check (minutes >= 0),
  created_at timestamptz not null default now(),
  constraint reward_ledger_source_unique unique (source_type, source_id)
);

create table public.earned_entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  earned_ad_free_until timestamptz,
  lifetime_credits integer not null default 0 check (lifetime_credits >= 0),
  version integer not null default 0,
  updated_at timestamptz not null default now()
);

create table public.app_config (
  id integer primary key default 1 check (id = 1),
  version integer not null,
  contributions_enabled boolean not null default false,
  rewards_enabled boolean not null default false,
  network_ads_enabled boolean not null default false,
  rewarded_ads_enabled boolean not null default false,
  paywall_enabled boolean not null default false,
  learn_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.app_config (
  id, version,
  contributions_enabled, rewards_enabled,
  network_ads_enabled, rewarded_ads_enabled, paywall_enabled,
  learn_enabled
) values (
  1, 1,
  false, false,
  false, false, false,
  false
);

-- ---------------------------------------------------------------------------
-- Private tables (never exposed through PostgREST)
-- ---------------------------------------------------------------------------

create table private.scoring_config (
  id integer primary key default 1 check (id = 1),
  known_pass_score numeric not null default 0.72,
  strong_agreement numeric not null default 0.80,
  borderline_low numeric not null default 0.72,
  borderline_high numeric not null default 0.79,
  substantive_model_below numeric not null default 0.92,
  short_grapheme_max integer not null default 4
);

insert into private.scoring_config (id) values (1);

create table private.translation_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users (id) on delete set null,
  raw_source text not null,
  raw_correction text,
  metadata jsonb not null default '{}'::jsonb,
  consent_version text,
  pii_flags text[] not null default '{}',
  status text not null default 'triage',
  idempotency_key text not null,
  app_version text,
  model_version text,
  created_at timestamptz not null default now(),
  constraint translation_reports_idempotency_unique unique (idempotency_key)
);

create table private.known_references (
  id uuid primary key default gen_random_uuid(),
  reference_set_id uuid not null,
  raw_text text not null,
  normalized_text text not null,
  created_at timestamptz not null default now()
);

create table private.contribution_tasks (
  id uuid primary key default gen_random_uuid(),
  source_text text not null,
  model_output text not null,
  direction text not null,
  formality text not null,
  script text not null,
  task_type text not null check (task_type in ('known_check', 'unknown')),
  reference_set_id uuid,
  state text not null default 'open',
  reward_class text not null default 'standard',
  provenance text not null,
  model_version text,
  reporter_id uuid,
  created_at timestamptz not null default now()
);

create table private.task_assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references private.contribution_tasks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  leased_until timestamptz not null,
  completed_at timestamptz,
  client_nonce text,
  created_at timestamptz not null default now(),
  constraint task_assignments_task_user_unique unique (task_id, user_id)
);

create table private.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references private.task_assignments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  raw_response text,
  normalized_response text,
  model_similarity numeric,
  decision_status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table private.contributor_stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  known_attempts integer not null default 0,
  known_passes integer not null default 0,
  reliability numeric not null default 0.67,
  state text not null default 'normal',
  credits_utc_day date,
  credits_today integer not null default 0
);

create table private.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table private.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  payload_hash text not null,
  processing_status text not null default 'received',
  created_at timestamptz not null default now(),
  constraint webhook_events_provider_id_unique unique (provider, provider_event_id)
);

create table private.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  target text not null,
  before_summary text,
  after_summary text,
  reason text,
  created_at timestamptz not null default now()
);

create table private.dataset_exports (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  filter_manifest jsonb not null,
  object_path text not null,
  row_count integer not null,
  content_hash text not null,
  creator_id uuid,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Grants: revoke defaults, then allow only the intended operations.
-- ---------------------------------------------------------------------------

revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.contribution_receipts from public, anon, authenticated;
revoke all on table public.reward_ledger from public, anon, authenticated;
revoke all on table public.earned_entitlements from public, anon, authenticated;
revoke all on table public.app_config from public, anon, authenticated;

grant select on table public.profiles to authenticated;
grant select on table public.contribution_receipts to authenticated;
grant select on table public.reward_ledger to authenticated;
grant select on table public.earned_entitlements to authenticated;
grant select on table public.app_config to anon, authenticated;

grant all on table public.profiles to service_role;
grant all on table public.contribution_receipts to service_role;
grant all on table public.reward_ledger to service_role;
grant all on table public.earned_entitlements to service_role;
grant all on table public.app_config to service_role;

revoke all on all tables in schema private from public, anon, authenticated;
grant all on all tables in schema private to service_role;

alter table public.profiles enable row level security;
alter table public.contribution_receipts enable row level security;
alter table public.reward_ledger enable row level security;
alter table public.earned_entitlements enable row level security;
alter table public.app_config enable row level security;

create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy receipts_select_own
  on public.contribution_receipts
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy ledger_select_own
  on public.reward_ledger
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy entitlements_select_own
  on public.earned_entitlements
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy app_config_read
  on public.app_config
  for select
  to anon, authenticated
  using (true);

-- No insert/update/delete policies: clients cannot write these tables.

-- ---------------------------------------------------------------------------
-- New-user profile trigger
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id);
  insert into public.earned_entitlements (user_id) values (new.id);
  insert into private.contributor_stats (user_id) values (new.id);
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Reward grant: unique (source_type, source_id) makes duplicate grants a no-op.
-- Stacks from the later of now() and the current earned expiry.
-- ---------------------------------------------------------------------------

create or replace function private.apply_reward(
  p_user_id uuid,
  p_source_type text,
  p_source_id text,
  p_credits integer,
  p_minutes integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ledger_id uuid;
  v_inserted uuid;
  v_now timestamptz := now();
  v_until timestamptz;
begin
  if p_credits < 0 or p_minutes < 0 then
    raise exception 'invalid_reward' using errcode = '22023';
  end if;

  insert into public.earned_entitlements (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  -- Serialize grants for one user so two concurrent calls cannot both extend time.
  perform 1
  from public.earned_entitlements
  where user_id = p_user_id
  for update;

  insert into public.reward_ledger (user_id, source_type, source_id, credits, minutes)
  values (p_user_id, p_source_type, p_source_id, p_credits, p_minutes)
  on conflict (source_type, source_id) do nothing
  returning id into v_inserted;

  if v_inserted is null then
    select id into v_ledger_id
    from public.reward_ledger
    where source_type = p_source_type and source_id = p_source_id;
    return jsonb_build_object(
      'applied', false,
      'ledger_id', v_ledger_id
    );
  end if;

  update public.earned_entitlements
  set
    earned_ad_free_until =
      greatest(v_now, coalesce(earned_ad_free_until, v_now))
      + make_interval(mins => p_minutes),
    lifetime_credits = lifetime_credits + p_credits,
    version = version + 1,
    updated_at = v_now
  where user_id = p_user_id
  returning earned_ad_free_until into v_until;

  return jsonb_build_object(
    'applied', true,
    'ledger_id', v_inserted,
    'earned_ad_free_until', v_until
  );
end;
$$;

revoke all on function private.apply_reward(uuid, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function private.apply_reward(uuid, text, text, integer, integer)
  to service_role;

-- Safe task payload. Never includes task_type, references, trust, or similarity.
create or replace function private.public_task_json(p_task_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'public_task_id', t.id,
    'source_text', t.source_text,
    'model_output', t.model_output,
    'direction', t.direction,
    'formality', t.formality,
    'script', t.script,
    'reward_label', 'Earn 1–6 credits after validation'
  )
  from private.contribution_tasks t
  where t.id = p_task_id;
$$;

revoke all on function private.public_task_json(uuid) from public, anon, authenticated;
grant execute on function private.public_task_json(uuid) to service_role;

create or replace function private.lease_safe_task(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task_id uuid;
begin
  select t.id into v_task_id
  from private.contribution_tasks t
  where t.state = 'open'
    and (t.reporter_id is null or t.reporter_id <> p_user_id)
    and not exists (
      select 1
      from private.task_assignments a
      where a.task_id = t.id
        and a.user_id = p_user_id
        and (a.completed_at is not null or a.leased_until > now())
    )
  order by t.created_at
  limit 1
  for update skip locked;

  if v_task_id is null then
    return jsonb_build_object('assignment', null);
  end if;

  insert into private.task_assignments (task_id, user_id, leased_until)
  values (v_task_id, p_user_id, now() + interval '15 minutes')
  on conflict (task_id, user_id) do update
    set leased_until = excluded.leased_until,
        completed_at = null;

  return private.public_task_json(v_task_id);
end;
$$;

revoke all on function private.lease_safe_task(uuid) from public, anon, authenticated;
grant execute on function private.lease_safe_task(uuid) to service_role;

-- Called by the Edge Function with the service role after JWT verification.
-- Not granted to authenticated, so the mobile client cannot call it directly.
create or replace function public.service_lease_contribution_task(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  return private.lease_safe_task(p_user_id);
end;
$$;

revoke all on function public.service_lease_contribution_task(uuid)
  from public, anon, authenticated;
grant execute on function public.service_lease_contribution_task(uuid) to service_role;
