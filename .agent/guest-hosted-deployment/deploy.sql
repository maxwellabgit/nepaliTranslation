begin;

select pg_advisory_xact_lock(hashtext('guest-hosted-deployment-20261003'));

do $baseline$ begin if not exists (select 1 from supabase_migrations.schema_migrations where version='20260925160000') then raise exception 'Unexpected hosted baseline'; end if; end $baseline$;

do $apply_20260928180000$ begin
if not exists (select 1 from supabase_migrations.schema_migrations where version='20260928180000') then
execute $guest_source_20260928180000$-- 1 credit = 10 ad-free minutes. Caller-supplied p_minutes is ignored.
-- Historical ledger rows stay as written. Forward-only replacement of
-- private.apply_reward and private.reward_schedule.

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
  v_day date := (timezone('utc', v_now))::date;
  v_today integer;
  v_cap integer;
  v_is_video boolean;
  v_minutes integer;
  v_until timestamptz;
begin
  if p_credits < 0 or p_minutes < 0 then
    raise exception 'invalid_reward' using errcode = '22023';
  end if;

  v_minutes := p_credits * 10;

  insert into public.earned_entitlements (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  insert into private.contributor_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  perform 1
  from public.earned_entitlements
  where user_id = p_user_id
  for update;

  perform 1
  from private.contributor_stats
  where user_id = p_user_id
  for update;

  v_is_video := p_source_type in ('rewarded_video', 'admob_ssv');
  v_cap := case when v_is_video then 12 else 60 end;

  select id into v_ledger_id
  from public.reward_ledger
  where user_id = p_user_id
    and source_type = p_source_type
    and source_id = p_source_id;
  if v_ledger_id is not null then
    return jsonb_build_object(
      'applied', false,
      'ledger_id', v_ledger_id,
      'reason', 'duplicate'
    );
  end if;

  if v_is_video then
    select case
      when video_credits_utc_day is distinct from v_day then 0
      else video_credits_today
    end
    into v_today
    from private.contributor_stats
    where user_id = p_user_id;
  else
    select case
      when credits_utc_day is distinct from v_day then 0
      else credits_today
    end
    into v_today
    from private.contributor_stats
    where user_id = p_user_id;
  end if;

  if coalesce(v_today, 0) + p_credits > v_cap then
    return jsonb_build_object(
      'applied', false,
      'reason', 'daily_cap',
      'cap', v_cap,
      'credits_today', coalesce(v_today, 0)
    );
  end if;

  insert into public.reward_ledger (user_id, source_type, source_id, credits, minutes)
  values (p_user_id, p_source_type, p_source_id, p_credits, v_minutes)
  on conflict (user_id, source_type, source_id) do nothing
  returning id into v_inserted;

  if v_inserted is null then
    select id into v_ledger_id
    from public.reward_ledger
    where user_id = p_user_id
      and source_type = p_source_type
      and source_id = p_source_id;
    return jsonb_build_object(
      'applied', false,
      'ledger_id', v_ledger_id,
      'reason', 'duplicate'
    );
  end if;

  update public.earned_entitlements
  set
    earned_ad_free_until =
      greatest(v_now, coalesce(earned_ad_free_until, v_now))
      + make_interval(mins => v_minutes),
    lifetime_credits = lifetime_credits + p_credits,
    version = version + 1,
    updated_at = v_now
  where user_id = p_user_id
  returning earned_ad_free_until into v_until;

  if v_is_video then
    update private.contributor_stats
    set
      video_credits_utc_day = v_day,
      video_credits_today = coalesce(v_today, 0) + p_credits
    where user_id = p_user_id;
  else
    update private.contributor_stats
    set
      credits_utc_day = v_day,
      credits_today = coalesce(v_today, 0) + p_credits
    where user_id = p_user_id;
  end if;

  return jsonb_build_object(
    'applied', true,
    'ledger_id', v_inserted,
    'minutes_granted', v_minutes,
    'earned_ad_free_until', v_until
  );
end;
$$;

revoke all on function private.apply_reward(uuid, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function private.apply_reward(uuid, text, text, integer, integer)
  to service_role;

create or replace function private.reward_schedule(p_kind text)
returns table (credits integer, minutes integer)
language sql
immutable
set search_path = ''
as $$
  select s.credits, s.minutes
  from (
    values
      ('known_check'::text, 1::integer, 10::integer),
      ('unknown_confirm'::text, 1::integer, 10::integer),
      ('unknown_correction'::text, 1::integer, 10::integer),
      ('admin_difficult'::text, 2::integer, 20::integer),
      ('rewarded_video'::text, 2::integer, 20::integer),
      ('public_review'::text, 2::integer, 20::integer),
      ('public_review_long'::text, 4::integer, 40::integer)
  ) as s(kind, credits, minutes)
  where s.kind = p_kind;
$$;

comment on function private.reward_schedule(text) is
  '1 credit = 10 minutes. Rewarded video and a short public review are 2 credits; a long public review is 4.';
$guest_source_20260928180000$;
insert into supabase_migrations.schema_migrations(version,name,statements) values ('20260928180000','credit_minutes_10',array[$guest_source_20260928180000$-- 1 credit = 10 ad-free minutes. Caller-supplied p_minutes is ignored.
-- Historical ledger rows stay as written. Forward-only replacement of
-- private.apply_reward and private.reward_schedule.

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
  v_day date := (timezone('utc', v_now))::date;
  v_today integer;
  v_cap integer;
  v_is_video boolean;
  v_minutes integer;
  v_until timestamptz;
begin
  if p_credits < 0 or p_minutes < 0 then
    raise exception 'invalid_reward' using errcode = '22023';
  end if;

  v_minutes := p_credits * 10;

  insert into public.earned_entitlements (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  insert into private.contributor_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  perform 1
  from public.earned_entitlements
  where user_id = p_user_id
  for update;

  perform 1
  from private.contributor_stats
  where user_id = p_user_id
  for update;

  v_is_video := p_source_type in ('rewarded_video', 'admob_ssv');
  v_cap := case when v_is_video then 12 else 60 end;

  select id into v_ledger_id
  from public.reward_ledger
  where user_id = p_user_id
    and source_type = p_source_type
    and source_id = p_source_id;
  if v_ledger_id is not null then
    return jsonb_build_object(
      'applied', false,
      'ledger_id', v_ledger_id,
      'reason', 'duplicate'
    );
  end if;

  if v_is_video then
    select case
      when video_credits_utc_day is distinct from v_day then 0
      else video_credits_today
    end
    into v_today
    from private.contributor_stats
    where user_id = p_user_id;
  else
    select case
      when credits_utc_day is distinct from v_day then 0
      else credits_today
    end
    into v_today
    from private.contributor_stats
    where user_id = p_user_id;
  end if;

  if coalesce(v_today, 0) + p_credits > v_cap then
    return jsonb_build_object(
      'applied', false,
      'reason', 'daily_cap',
      'cap', v_cap,
      'credits_today', coalesce(v_today, 0)
    );
  end if;

  insert into public.reward_ledger (user_id, source_type, source_id, credits, minutes)
  values (p_user_id, p_source_type, p_source_id, p_credits, v_minutes)
  on conflict (user_id, source_type, source_id) do nothing
  returning id into v_inserted;

  if v_inserted is null then
    select id into v_ledger_id
    from public.reward_ledger
    where user_id = p_user_id
      and source_type = p_source_type
      and source_id = p_source_id;
    return jsonb_build_object(
      'applied', false,
      'ledger_id', v_ledger_id,
      'reason', 'duplicate'
    );
  end if;

  update public.earned_entitlements
  set
    earned_ad_free_until =
      greatest(v_now, coalesce(earned_ad_free_until, v_now))
      + make_interval(mins => v_minutes),
    lifetime_credits = lifetime_credits + p_credits,
    version = version + 1,
    updated_at = v_now
  where user_id = p_user_id
  returning earned_ad_free_until into v_until;

  if v_is_video then
    update private.contributor_stats
    set
      video_credits_utc_day = v_day,
      video_credits_today = coalesce(v_today, 0) + p_credits
    where user_id = p_user_id;
  else
    update private.contributor_stats
    set
      credits_utc_day = v_day,
      credits_today = coalesce(v_today, 0) + p_credits
    where user_id = p_user_id;
  end if;

  return jsonb_build_object(
    'applied', true,
    'ledger_id', v_inserted,
    'minutes_granted', v_minutes,
    'earned_ad_free_until', v_until
  );
end;
$$;

revoke all on function private.apply_reward(uuid, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function private.apply_reward(uuid, text, text, integer, integer)
  to service_role;

create or replace function private.reward_schedule(p_kind text)
returns table (credits integer, minutes integer)
language sql
immutable
set search_path = ''
as $$
  select s.credits, s.minutes
  from (
    values
      ('known_check'::text, 1::integer, 10::integer),
      ('unknown_confirm'::text, 1::integer, 10::integer),
      ('unknown_correction'::text, 1::integer, 10::integer),
      ('admin_difficult'::text, 2::integer, 20::integer),
      ('rewarded_video'::text, 2::integer, 20::integer),
      ('public_review'::text, 2::integer, 20::integer),
      ('public_review_long'::text, 4::integer, 40::integer)
  ) as s(kind, credits, minutes)
  where s.kind = p_kind;
$$;

comment on function private.reward_schedule(text) is
  '1 credit = 10 minutes. Rewarded video and a short public review are 2 credits; a long public review is 4.';
$guest_source_20260928180000$]);
end if; end $apply_20260928180000$;

do $apply_20260929140000$ begin
if not exists (select 1 from supabase_migrations.schema_migrations where version='20260929140000') then
execute $guest_source_20260929140000$-- Word-count review credits, login delivery, and a 12-hour timer cap.
-- 4 words or fewer = 1 credit, 5 or 6 = 2, 7 or more = 3.
-- 1 credit = 10 minutes. Caller-supplied p_minutes is still ignored.
-- A public_review ledger row is written at the 5:00 PM America/New_York close.
-- The ad-free clock does not move until the reviewer next signs in and
-- claims the row. Time still left is kept, and the clock stops at 12 hours.
-- Historical ledger rows and older 4-credit snapshots stay as written.
-- The visual 50-credit gauge mark is a client concern and is not enforced here.

create table if not exists public.pending_reward_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_type text not null,
  source_id text not null,
  credits integer not null check (credits > 0),
  minutes integer not null check (minutes >= 0),
  awarded_at timestamptz not null default now(),
  claimed_at timestamptz,
  constraint pending_reward_grants_source_unique unique (user_id, source_type, source_id)
);

comment on table public.pending_reward_grants is
  'Review credits decided at the 5 PM New York close. Claimed on the next signed-in session, including a later day.';

create index if not exists pending_reward_grants_unclaimed_idx
  on public.pending_reward_grants (user_id)
  where claimed_at is null;

alter table public.pending_reward_grants enable row level security;

revoke all on table public.pending_reward_grants from public, anon, authenticated;

create or replace function private.count_source_words(p_text text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(cardinality(array_remove(
    regexp_split_to_array(
      regexp_replace(coalesce(p_text, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g'),
      '[[:space:]]+'
    ),
    ''
  )), 0);
$$;

comment on function private.count_source_words(text) is
  'Unicode whitespace word count. Matches scripts/sourceWordCount.mjs. Whitespace-only text is 0 and is not planned.';

create or replace function private.scheduled_credits_for_words(p_word_count integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_word_count is null or p_word_count <= 0 then 0
    when p_word_count <= 4 then 1
    when p_word_count <= 6 then 2
    else 3
  end;
$$;

comment on function private.scheduled_credits_for_words(integer) is
  '4 words or fewer -> 1 credit; 5 or 6 -> 2; 7 or more -> 3. Empty text is 0 and is not planned. 1 credit = 10 minutes.';

do $$
declare
  r record;
begin
  for r in
    select conrelid::regclass as rel, conname
      from pg_constraint
     where contype = 'c'
       and conrelid in (
         'public.review_window_items'::regclass,
         'public.review_submissions'::regclass
       )
       and pg_get_constraintdef(oid) ilike '%scheduled_credits%'
  loop
    execute format('alter table %s drop constraint %I', r.rel, r.conname);
  end loop;
end $$;

alter table public.review_window_items
  add constraint review_window_items_scheduled_credits_check
  check (scheduled_credits between 0 and 4);

alter table public.review_submissions
  add constraint review_submissions_scheduled_credits_check
  check (scheduled_credits between 0 and 4);

comment on column public.review_window_items.length_tier_snapshot is
  'Deprecated percentile rank. New assignments snapshot original_source_word_count and scheduled_credits (1, 2, or 3). Historical rows may still store 4.';

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
  v_day date := (timezone('utc', v_now))::date;
  v_today integer;
  v_cap integer;
  v_is_video boolean;
  v_defer boolean;
  v_minutes integer;
  v_existing timestamptz;
  v_base timestamptz;
  v_cap_until timestamptz;
  v_room integer;
  v_applied integer;
  v_until timestamptz;
begin
  if p_credits < 0 or p_minutes < 0 then
    raise exception 'invalid_reward' using errcode = '22023';
  end if;

  v_minutes := p_credits * 10;
  v_defer := p_source_type = 'public_review';

  insert into public.earned_entitlements (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  insert into private.contributor_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  perform 1
  from public.earned_entitlements
  where user_id = p_user_id
  for update;

  perform 1
  from private.contributor_stats
  where user_id = p_user_id
  for update;

  v_is_video := p_source_type in ('rewarded_video', 'admob_ssv');
  v_cap := case when v_is_video then 12 else 60 end;

  select id into v_ledger_id
  from public.reward_ledger
  where user_id = p_user_id
    and source_type = p_source_type
    and source_id = p_source_id;
  if v_ledger_id is not null then
    return jsonb_build_object(
      'applied', false,
      'ledger_id', v_ledger_id,
      'reason', 'duplicate'
    );
  end if;

  if v_is_video then
    select case
      when video_credits_utc_day is distinct from v_day then 0
      else video_credits_today
    end
    into v_today
    from private.contributor_stats
    where user_id = p_user_id;
  else
    select case
      when credits_utc_day is distinct from v_day then 0
      else credits_today
    end
    into v_today
    from private.contributor_stats
    where user_id = p_user_id;
  end if;

  if coalesce(v_today, 0) + p_credits > v_cap then
    return jsonb_build_object(
      'applied', false,
      'reason', 'daily_cap',
      'cap', v_cap,
      'credits_today', coalesce(v_today, 0)
    );
  end if;

  insert into public.reward_ledger (user_id, source_type, source_id, credits, minutes)
  values (p_user_id, p_source_type, p_source_id, p_credits, v_minutes)
  on conflict (user_id, source_type, source_id) do nothing
  returning id into v_inserted;

  if v_inserted is null then
    select id into v_ledger_id
    from public.reward_ledger
    where user_id = p_user_id
      and source_type = p_source_type
      and source_id = p_source_id;
    return jsonb_build_object(
      'applied', false,
      'ledger_id', v_ledger_id,
      'reason', 'duplicate'
    );
  end if;

  if v_is_video then
    update private.contributor_stats
    set
      video_credits_utc_day = v_day,
      video_credits_today = coalesce(v_today, 0) + p_credits
    where user_id = p_user_id;
  else
    update private.contributor_stats
    set
      credits_utc_day = v_day,
      credits_today = coalesce(v_today, 0) + p_credits
    where user_id = p_user_id;
  end if;

  if v_defer then
    if p_credits > 0 then
      insert into public.pending_reward_grants (
        user_id, source_type, source_id, credits, minutes, awarded_at
      ) values (
        p_user_id, p_source_type, p_source_id, p_credits, v_minutes, v_now
      )
      on conflict (user_id, source_type, source_id) do nothing;
    end if;

    return jsonb_build_object(
      'applied', true,
      'deferred', true,
      'ledger_id', v_inserted,
      'minutes_granted', v_minutes,
      'earned_ad_free_until', null
    );
  end if;

  select earned_ad_free_until into v_existing
  from public.earned_entitlements
  where user_id = p_user_id;

  v_cap_until := v_now + interval '12 hours';
  v_base := greatest(v_now, coalesce(v_existing, v_now));
  if v_base > v_cap_until then
    v_base := v_cap_until;
  end if;
  v_room := floor(extract(epoch from (v_cap_until - v_base)) / 60)::integer;
  if v_room < 0 then
    v_room := 0;
  end if;
  v_applied := least(v_minutes, v_room);
  v_until := v_base + make_interval(mins => v_applied);

  update public.earned_entitlements
  set
    earned_ad_free_until = v_until,
    lifetime_credits = lifetime_credits + p_credits,
    version = version + 1,
    updated_at = v_now
  where user_id = p_user_id;

  return jsonb_build_object(
    'applied', true,
    'deferred', false,
    'ledger_id', v_inserted,
    'minutes_granted', v_minutes,
    'minutes_applied', v_applied,
    'capped', v_applied < v_minutes,
    'earned_ad_free_until', v_until
  );
end;
$$;

revoke all on function private.apply_reward(uuid, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function private.apply_reward(uuid, text, text, integer, integer)
  to service_role;

create or replace function private.claim_pending_rewards(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_credits integer := 0;
  v_minutes integer := 0;
  v_existing timestamptz;
  v_base timestamptz;
  v_cap_until timestamptz;
  v_room integer;
  v_applied integer;
  v_until timestamptz;
begin
  insert into public.earned_entitlements (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  perform 1
  from public.earned_entitlements
  where user_id = p_user_id
  for update;

  -- Mark only the rows locked in this statement. A grant inserted
  -- after this snapshot stays unclaimed for the next sign-in.
  with locked as (
    select id
    from public.pending_reward_grants
    where user_id = p_user_id
      and claimed_at is null
    for update
  ),
  marked as (
    update public.pending_reward_grants g
    set claimed_at = v_now
    from locked
    where g.id = locked.id
    returning g.credits, g.minutes
  )
  select coalesce(sum(credits), 0), coalesce(sum(minutes), 0)
    into v_credits, v_minutes
  from marked;

  if v_credits = 0 then
    return jsonb_build_object(
      'credits', 0,
      'minutes_recorded', 0,
      'minutes_applied', 0,
      'capped', false,
      'earned_ad_free_until', null
    );
  end if;

  select earned_ad_free_until into v_existing
  from public.earned_entitlements
  where user_id = p_user_id;

  v_cap_until := v_now + interval '12 hours';
  v_base := greatest(v_now, coalesce(v_existing, v_now));
  if v_base > v_cap_until then
    v_base := v_cap_until;
  end if;
  v_room := floor(extract(epoch from (v_cap_until - v_base)) / 60)::integer;
  if v_room < 0 then
    v_room := 0;
  end if;
  v_applied := least(v_minutes, v_room);
  v_until := v_base + make_interval(mins => v_applied);

  update public.earned_entitlements
  set
    earned_ad_free_until = v_until,
    lifetime_credits = lifetime_credits + v_credits,
    version = version + 1,
    updated_at = v_now
  where user_id = p_user_id;

  return jsonb_build_object(
    'credits', v_credits,
    'minutes_recorded', v_minutes,
    'minutes_applied', v_applied,
    'capped', v_applied < v_minutes,
    'earned_ad_free_until', v_until
  );
end;
$$;

revoke all on function private.claim_pending_rewards(uuid)
  from public, anon, authenticated;
grant execute on function private.claim_pending_rewards(uuid) to service_role;

create or replace function public.claim_pending_rewards()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  return private.claim_pending_rewards(v_uid);
end;
$$;

revoke all on function public.claim_pending_rewards() from public, anon;
grant execute on function public.claim_pending_rewards() to authenticated, service_role;

comment on function public.claim_pending_rewards() is
  'Move review credits decided at 5 PM New York onto the ad-free timer. Safe to call on every sign-in. Stacks on time still left and stops at 12 hours.';

create or replace function private.reward_schedule(p_kind text)
returns table (credits integer, minutes integer)
language sql
immutable
set search_path = ''
as $$
  select s.credits, s.minutes
  from (
    values
      ('known_check'::text, 1::integer, 10::integer),
      ('unknown_confirm'::text, 1::integer, 10::integer),
      ('unknown_correction'::text, 1::integer, 10::integer),
      ('admin_difficult'::text, 2::integer, 20::integer),
      ('rewarded_video'::text, 2::integer, 20::integer),
      ('public_review'::text, 1::integer, 10::integer),
      ('public_review_mid'::text, 2::integer, 20::integer),
      ('public_review_long'::text, 3::integer, 30::integer)
  ) as s(kind, credits, minutes)
  where s.kind = p_kind;
$$;

comment on function private.reward_schedule(text) is
  '1 credit = 10 minutes. Assignment uses scheduled_credits_for_words (1, 2, or 3). Rewarded video is 2 credits. The timer hard-stops at 12 hours when the grant is applied.';
$guest_source_20260929140000$;
insert into supabase_migrations.schema_migrations(version,name,statements) values ('20260929140000','word_credit_tiers',array[$guest_source_20260929140000$-- Word-count review credits, login delivery, and a 12-hour timer cap.
-- 4 words or fewer = 1 credit, 5 or 6 = 2, 7 or more = 3.
-- 1 credit = 10 minutes. Caller-supplied p_minutes is still ignored.
-- A public_review ledger row is written at the 5:00 PM America/New_York close.
-- The ad-free clock does not move until the reviewer next signs in and
-- claims the row. Time still left is kept, and the clock stops at 12 hours.
-- Historical ledger rows and older 4-credit snapshots stay as written.
-- The visual 50-credit gauge mark is a client concern and is not enforced here.

create table if not exists public.pending_reward_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_type text not null,
  source_id text not null,
  credits integer not null check (credits > 0),
  minutes integer not null check (minutes >= 0),
  awarded_at timestamptz not null default now(),
  claimed_at timestamptz,
  constraint pending_reward_grants_source_unique unique (user_id, source_type, source_id)
);

comment on table public.pending_reward_grants is
  'Review credits decided at the 5 PM New York close. Claimed on the next signed-in session, including a later day.';

create index if not exists pending_reward_grants_unclaimed_idx
  on public.pending_reward_grants (user_id)
  where claimed_at is null;

alter table public.pending_reward_grants enable row level security;

revoke all on table public.pending_reward_grants from public, anon, authenticated;

create or replace function private.count_source_words(p_text text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(cardinality(array_remove(
    regexp_split_to_array(
      regexp_replace(coalesce(p_text, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g'),
      '[[:space:]]+'
    ),
    ''
  )), 0);
$$;

comment on function private.count_source_words(text) is
  'Unicode whitespace word count. Matches scripts/sourceWordCount.mjs. Whitespace-only text is 0 and is not planned.';

create or replace function private.scheduled_credits_for_words(p_word_count integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_word_count is null or p_word_count <= 0 then 0
    when p_word_count <= 4 then 1
    when p_word_count <= 6 then 2
    else 3
  end;
$$;

comment on function private.scheduled_credits_for_words(integer) is
  '4 words or fewer -> 1 credit; 5 or 6 -> 2; 7 or more -> 3. Empty text is 0 and is not planned. 1 credit = 10 minutes.';

do $$
declare
  r record;
begin
  for r in
    select conrelid::regclass as rel, conname
      from pg_constraint
     where contype = 'c'
       and conrelid in (
         'public.review_window_items'::regclass,
         'public.review_submissions'::regclass
       )
       and pg_get_constraintdef(oid) ilike '%scheduled_credits%'
  loop
    execute format('alter table %s drop constraint %I', r.rel, r.conname);
  end loop;
end $$;

alter table public.review_window_items
  add constraint review_window_items_scheduled_credits_check
  check (scheduled_credits between 0 and 4);

alter table public.review_submissions
  add constraint review_submissions_scheduled_credits_check
  check (scheduled_credits between 0 and 4);

comment on column public.review_window_items.length_tier_snapshot is
  'Deprecated percentile rank. New assignments snapshot original_source_word_count and scheduled_credits (1, 2, or 3). Historical rows may still store 4.';

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
  v_day date := (timezone('utc', v_now))::date;
  v_today integer;
  v_cap integer;
  v_is_video boolean;
  v_defer boolean;
  v_minutes integer;
  v_existing timestamptz;
  v_base timestamptz;
  v_cap_until timestamptz;
  v_room integer;
  v_applied integer;
  v_until timestamptz;
begin
  if p_credits < 0 or p_minutes < 0 then
    raise exception 'invalid_reward' using errcode = '22023';
  end if;

  v_minutes := p_credits * 10;
  v_defer := p_source_type = 'public_review';

  insert into public.earned_entitlements (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  insert into private.contributor_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  perform 1
  from public.earned_entitlements
  where user_id = p_user_id
  for update;

  perform 1
  from private.contributor_stats
  where user_id = p_user_id
  for update;

  v_is_video := p_source_type in ('rewarded_video', 'admob_ssv');
  v_cap := case when v_is_video then 12 else 60 end;

  select id into v_ledger_id
  from public.reward_ledger
  where user_id = p_user_id
    and source_type = p_source_type
    and source_id = p_source_id;
  if v_ledger_id is not null then
    return jsonb_build_object(
      'applied', false,
      'ledger_id', v_ledger_id,
      'reason', 'duplicate'
    );
  end if;

  if v_is_video then
    select case
      when video_credits_utc_day is distinct from v_day then 0
      else video_credits_today
    end
    into v_today
    from private.contributor_stats
    where user_id = p_user_id;
  else
    select case
      when credits_utc_day is distinct from v_day then 0
      else credits_today
    end
    into v_today
    from private.contributor_stats
    where user_id = p_user_id;
  end if;

  if coalesce(v_today, 0) + p_credits > v_cap then
    return jsonb_build_object(
      'applied', false,
      'reason', 'daily_cap',
      'cap', v_cap,
      'credits_today', coalesce(v_today, 0)
    );
  end if;

  insert into public.reward_ledger (user_id, source_type, source_id, credits, minutes)
  values (p_user_id, p_source_type, p_source_id, p_credits, v_minutes)
  on conflict (user_id, source_type, source_id) do nothing
  returning id into v_inserted;

  if v_inserted is null then
    select id into v_ledger_id
    from public.reward_ledger
    where user_id = p_user_id
      and source_type = p_source_type
      and source_id = p_source_id;
    return jsonb_build_object(
      'applied', false,
      'ledger_id', v_ledger_id,
      'reason', 'duplicate'
    );
  end if;

  if v_is_video then
    update private.contributor_stats
    set
      video_credits_utc_day = v_day,
      video_credits_today = coalesce(v_today, 0) + p_credits
    where user_id = p_user_id;
  else
    update private.contributor_stats
    set
      credits_utc_day = v_day,
      credits_today = coalesce(v_today, 0) + p_credits
    where user_id = p_user_id;
  end if;

  if v_defer then
    if p_credits > 0 then
      insert into public.pending_reward_grants (
        user_id, source_type, source_id, credits, minutes, awarded_at
      ) values (
        p_user_id, p_source_type, p_source_id, p_credits, v_minutes, v_now
      )
      on conflict (user_id, source_type, source_id) do nothing;
    end if;

    return jsonb_build_object(
      'applied', true,
      'deferred', true,
      'ledger_id', v_inserted,
      'minutes_granted', v_minutes,
      'earned_ad_free_until', null
    );
  end if;

  select earned_ad_free_until into v_existing
  from public.earned_entitlements
  where user_id = p_user_id;

  v_cap_until := v_now + interval '12 hours';
  v_base := greatest(v_now, coalesce(v_existing, v_now));
  if v_base > v_cap_until then
    v_base := v_cap_until;
  end if;
  v_room := floor(extract(epoch from (v_cap_until - v_base)) / 60)::integer;
  if v_room < 0 then
    v_room := 0;
  end if;
  v_applied := least(v_minutes, v_room);
  v_until := v_base + make_interval(mins => v_applied);

  update public.earned_entitlements
  set
    earned_ad_free_until = v_until,
    lifetime_credits = lifetime_credits + p_credits,
    version = version + 1,
    updated_at = v_now
  where user_id = p_user_id;

  return jsonb_build_object(
    'applied', true,
    'deferred', false,
    'ledger_id', v_inserted,
    'minutes_granted', v_minutes,
    'minutes_applied', v_applied,
    'capped', v_applied < v_minutes,
    'earned_ad_free_until', v_until
  );
end;
$$;

revoke all on function private.apply_reward(uuid, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function private.apply_reward(uuid, text, text, integer, integer)
  to service_role;

create or replace function private.claim_pending_rewards(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_credits integer := 0;
  v_minutes integer := 0;
  v_existing timestamptz;
  v_base timestamptz;
  v_cap_until timestamptz;
  v_room integer;
  v_applied integer;
  v_until timestamptz;
begin
  insert into public.earned_entitlements (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  perform 1
  from public.earned_entitlements
  where user_id = p_user_id
  for update;

  -- Mark only the rows locked in this statement. A grant inserted
  -- after this snapshot stays unclaimed for the next sign-in.
  with locked as (
    select id
    from public.pending_reward_grants
    where user_id = p_user_id
      and claimed_at is null
    for update
  ),
  marked as (
    update public.pending_reward_grants g
    set claimed_at = v_now
    from locked
    where g.id = locked.id
    returning g.credits, g.minutes
  )
  select coalesce(sum(credits), 0), coalesce(sum(minutes), 0)
    into v_credits, v_minutes
  from marked;

  if v_credits = 0 then
    return jsonb_build_object(
      'credits', 0,
      'minutes_recorded', 0,
      'minutes_applied', 0,
      'capped', false,
      'earned_ad_free_until', null
    );
  end if;

  select earned_ad_free_until into v_existing
  from public.earned_entitlements
  where user_id = p_user_id;

  v_cap_until := v_now + interval '12 hours';
  v_base := greatest(v_now, coalesce(v_existing, v_now));
  if v_base > v_cap_until then
    v_base := v_cap_until;
  end if;
  v_room := floor(extract(epoch from (v_cap_until - v_base)) / 60)::integer;
  if v_room < 0 then
    v_room := 0;
  end if;
  v_applied := least(v_minutes, v_room);
  v_until := v_base + make_interval(mins => v_applied);

  update public.earned_entitlements
  set
    earned_ad_free_until = v_until,
    lifetime_credits = lifetime_credits + v_credits,
    version = version + 1,
    updated_at = v_now
  where user_id = p_user_id;

  return jsonb_build_object(
    'credits', v_credits,
    'minutes_recorded', v_minutes,
    'minutes_applied', v_applied,
    'capped', v_applied < v_minutes,
    'earned_ad_free_until', v_until
  );
end;
$$;

revoke all on function private.claim_pending_rewards(uuid)
  from public, anon, authenticated;
grant execute on function private.claim_pending_rewards(uuid) to service_role;

create or replace function public.claim_pending_rewards()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  return private.claim_pending_rewards(v_uid);
end;
$$;

revoke all on function public.claim_pending_rewards() from public, anon;
grant execute on function public.claim_pending_rewards() to authenticated, service_role;

comment on function public.claim_pending_rewards() is
  'Move review credits decided at 5 PM New York onto the ad-free timer. Safe to call on every sign-in. Stacks on time still left and stops at 12 hours.';

create or replace function private.reward_schedule(p_kind text)
returns table (credits integer, minutes integer)
language sql
immutable
set search_path = ''
as $$
  select s.credits, s.minutes
  from (
    values
      ('known_check'::text, 1::integer, 10::integer),
      ('unknown_confirm'::text, 1::integer, 10::integer),
      ('unknown_correction'::text, 1::integer, 10::integer),
      ('admin_difficult'::text, 2::integer, 20::integer),
      ('rewarded_video'::text, 2::integer, 20::integer),
      ('public_review'::text, 1::integer, 10::integer),
      ('public_review_mid'::text, 2::integer, 20::integer),
      ('public_review_long'::text, 3::integer, 30::integer)
  ) as s(kind, credits, minutes)
  where s.kind = p_kind;
$$;

comment on function private.reward_schedule(text) is
  '1 credit = 10 minutes. Assignment uses scheduled_credits_for_words (1, 2, or 3). Rewarded video is 2 credits. The timer hard-stops at 12 hours when the grant is applied.';
$guest_source_20260929140000$]);
end if; end $apply_20260929140000$;

do $apply_20260929140100$ begin
if not exists (select 1 from supabase_migrations.schema_migrations where version='20260929140100') then
execute $guest_source_20260929140100$-- A refused review grant stays unclaimed.
-- service_rotate_review_window sets reward_granted only when apply_reward
-- applies or reports a duplicate. A daily-cap refusal is retried on a later
-- close. Successful grants still retire the source item.

create or replace function public.service_rotate_review_window(
  p_size smallint default 10,
  p_as_of timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prior public.review_windows;
  v_next_close timestamptz;
  v_new_id uuid;
  v_inserted integer := 0;
  v_short boolean := false;
  v_granted_applied integer := 0;
  v_granted_dup integer := 0;
  v_report_quarantined integer := 0;
  v_retired integer := 0;
  rec record;
  v_apply jsonb;
  v_enabled boolean;
begin
  if p_size is null or p_size <= 0 then
    raise exception 'invalid_size' using errcode = '22023';
  end if;

  if not pg_try_advisory_xact_lock(hashtext('r1_review_rotation')) then
    return jsonb_build_object('status', 'busy');
  end if;

  select * into v_prior
    from public.review_windows
   where state = 'open'
   order by ny_close_at
   for update
   limit 1;

  if found and v_prior.ny_close_at > p_as_of then
    return jsonb_build_object(
      'status', 'not_due',
      'window_id', v_prior.id,
      'ny_close_at', v_prior.ny_close_at,
      'as_of', p_as_of
    );
  end if;

  if found then
    update public.review_windows
       set state = 'closed'
     where id = v_prior.id;

    with reported as (
      select distinct s.source_item_id, si.content_hash
        from public.review_submissions s
        join private.review_source_items si on si.id = s.source_item_id
       where s.window_id = v_prior.id
         and s.action = 'report'
         and s.admin_status <> 'unsatisfactory'
    ),
    upd as (
      update private.review_source_items s
         set public_review_eligible = false,
             quarantined = true,
             metadata = coalesce(s.metadata, '{}'::jsonb)
                        || jsonb_build_object(
                             'quarantined_at', p_as_of,
                             'quarantined_from_window', v_prior.id,
                             'excluded_reason', 'reported_quarantine'
                           )
        from reported r
       where s.id = r.source_item_id
       returning s.id
    ),
    excl as (
      insert into public.review_exclusions
        (content_hash, reason, source_lineage, window_id, notes)
      select r.content_hash, 'reported_quarantine', 'public_review:report',
             v_prior.id, 'pending admin resolution'
        from reported r
      on conflict (content_hash, reason) do nothing
      returning 1
    )
    select count(*)::int into v_report_quarantined from upd;

    for rec in
      select s.id as submission_id,
             s.user_id as user_id,
             s.scheduled_credits as scheduled_credits,
             s.source_item_id as source_item_id,
             si.content_hash as content_hash
        from public.review_submissions s
        join private.review_source_items si on si.id = s.source_item_id
       where s.reward_granted = false
         and s.admin_status <> 'unsatisfactory'
         and s.action in ('confirm', 'edit')
         and (
           s.window_id = v_prior.id
           or exists (
             select 1
               from public.review_windows w
              where w.id = s.window_id
                and w.ny_close_at <= p_as_of
                and w.state in ('closed', 'granted')
           )
         )
       order by s.submitted_at, s.id
    loop
      -- apply_reward stores credits * 10 and ignores this minutes argument.
      -- Pass the same number so a negative check cannot reject a real grant.
      v_apply := private.apply_reward(
        rec.user_id,
        'public_review',
        'review_submission:' || rec.submission_id::text || ':window_close',
        rec.scheduled_credits,
        rec.scheduled_credits * 10
      );

      if coalesce((v_apply ->> 'applied')::boolean, false)
         or (v_apply ->> 'reason') = 'duplicate' then
        update public.review_submissions
           set reward_granted = true,
               reward_granted_at = p_as_of
         where id = rec.submission_id;
        if coalesce((v_apply ->> 'applied')::boolean, false) then
          v_granted_applied := v_granted_applied + 1;
        else
          v_granted_dup := v_granted_dup + 1;
        end if;
      end if;
      -- A daily-cap refusal leaves reward_granted false. The source item
      -- is still retired below so it is not planned again. A later close
      -- retries the same submission.

      insert into public.review_exclusions
        (content_hash, reason, source_lineage, window_id, notes)
      values (
        rec.content_hash,
        'public_reviewed',
        'public_review:granted',
        v_prior.id,
        'retired after confirm/edit reward'
      )
      on conflict (content_hash, reason) do nothing;

      update private.review_source_items
         set public_review_eligible = false,
             substantively_reviewed = true,
             metadata = coalesce(metadata, '{}'::jsonb) ||
                        jsonb_build_object(
                          'retired_at', p_as_of,
                          'retired_from_window', v_prior.id,
                          'excluded_reason', 'public_reviewed'
                        )
       where id = rec.source_item_id;

      v_retired := v_retired + 1;
    end loop;

    update public.review_windows
       set state = 'granted', granted_at = p_as_of
     where id = v_prior.id;
  end if;

  perform public.service_plan_review_lookahead(p_as_of, 28, 14);

  select public_review_enabled into v_enabled
    from public.app_config
   where id = 1;

  if not coalesce(v_enabled, false) then
    return jsonb_build_object(
      'status', 'lookahead_private',
      'closed_window_id', v_prior.id,
      'granted_applied', v_granted_applied,
      'granted_duplicate', v_granted_dup,
      'granted_count', v_granted_applied + v_granted_dup,
      'reported_quarantined', v_report_quarantined,
      'retired_from_pool', v_retired,
      'public_review_enabled', false
    );
  end if;

  v_next_close := private.next_review_close(p_as_of);
  select id into v_new_id
    from public.review_windows
   where ny_close_at = v_next_close
     and state = 'planned'
   for update;

  if v_new_id is not null then
    update public.review_windows
       set state = 'open',
           opened_at = p_as_of
     where id = v_new_id;
    select count(*)::int into v_inserted
      from public.review_window_items
     where window_id = v_new_id;
  else
    insert into public.review_windows (ny_close_at, state, size, opened_at)
      values (v_next_close, 'open', p_size, p_as_of)
      returning id into v_new_id;

    insert into public.review_window_items (
      window_id, slot, source_item_id, length_tier_snapshot,
      scheduled_credits, original_source_word_count
    )
    select
      v_new_id,
      (row_number() over ())::smallint,
      sel.source_item_id,
      1::smallint,
      private.scheduled_credits_for_words(private.count_source_words(src.source_text)),
      private.count_source_words(src.source_text)
    from private.select_review_window_items(p_size) sel
    join private.review_source_items src on src.id = sel.source_item_id;

    get diagnostics v_inserted = row_count;

    update private.review_source_items s
       set times_assigned = times_assigned + 1,
           last_assigned_at = p_as_of
      from public.review_window_items i
     where i.window_id = v_new_id
       and i.source_item_id = s.id;
  end if;

  v_short := v_inserted < p_size;

  return jsonb_build_object(
    'status', case when v_short then 'ok_pool_short' else 'ok' end,
    'closed_window_id', v_prior.id,
    'granted_applied', v_granted_applied,
    'granted_duplicate', v_granted_dup,
    'granted_count', v_granted_applied + v_granted_dup,
    'reported_quarantined', v_report_quarantined,
    'retired_from_pool', v_retired,
    'new_window_id', v_new_id,
    'new_window_ny_close_at', v_next_close,
    'new_window_size', v_inserted,
    'requested_size', p_size,
    'warning', case when v_short then 'pool_short' else null end,
    'public_review_enabled', true
  );
end;
$$;


revoke all on function public.service_rotate_review_window(smallint, timestamptz)
  from public, anon, authenticated;
grant execute on function public.service_rotate_review_window(smallint, timestamptz)
  to service_role;
$guest_source_20260929140100$;
insert into supabase_migrations.schema_migrations(version,name,statements) values ('20260929140100','review_grant_retry',array[$guest_source_20260929140100$-- A refused review grant stays unclaimed.
-- service_rotate_review_window sets reward_granted only when apply_reward
-- applies or reports a duplicate. A daily-cap refusal is retried on a later
-- close. Successful grants still retire the source item.

create or replace function public.service_rotate_review_window(
  p_size smallint default 10,
  p_as_of timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prior public.review_windows;
  v_next_close timestamptz;
  v_new_id uuid;
  v_inserted integer := 0;
  v_short boolean := false;
  v_granted_applied integer := 0;
  v_granted_dup integer := 0;
  v_report_quarantined integer := 0;
  v_retired integer := 0;
  rec record;
  v_apply jsonb;
  v_enabled boolean;
begin
  if p_size is null or p_size <= 0 then
    raise exception 'invalid_size' using errcode = '22023';
  end if;

  if not pg_try_advisory_xact_lock(hashtext('r1_review_rotation')) then
    return jsonb_build_object('status', 'busy');
  end if;

  select * into v_prior
    from public.review_windows
   where state = 'open'
   order by ny_close_at
   for update
   limit 1;

  if found and v_prior.ny_close_at > p_as_of then
    return jsonb_build_object(
      'status', 'not_due',
      'window_id', v_prior.id,
      'ny_close_at', v_prior.ny_close_at,
      'as_of', p_as_of
    );
  end if;

  if found then
    update public.review_windows
       set state = 'closed'
     where id = v_prior.id;

    with reported as (
      select distinct s.source_item_id, si.content_hash
        from public.review_submissions s
        join private.review_source_items si on si.id = s.source_item_id
       where s.window_id = v_prior.id
         and s.action = 'report'
         and s.admin_status <> 'unsatisfactory'
    ),
    upd as (
      update private.review_source_items s
         set public_review_eligible = false,
             quarantined = true,
             metadata = coalesce(s.metadata, '{}'::jsonb)
                        || jsonb_build_object(
                             'quarantined_at', p_as_of,
                             'quarantined_from_window', v_prior.id,
                             'excluded_reason', 'reported_quarantine'
                           )
        from reported r
       where s.id = r.source_item_id
       returning s.id
    ),
    excl as (
      insert into public.review_exclusions
        (content_hash, reason, source_lineage, window_id, notes)
      select r.content_hash, 'reported_quarantine', 'public_review:report',
             v_prior.id, 'pending admin resolution'
        from reported r
      on conflict (content_hash, reason) do nothing
      returning 1
    )
    select count(*)::int into v_report_quarantined from upd;

    for rec in
      select s.id as submission_id,
             s.user_id as user_id,
             s.scheduled_credits as scheduled_credits,
             s.source_item_id as source_item_id,
             si.content_hash as content_hash
        from public.review_submissions s
        join private.review_source_items si on si.id = s.source_item_id
       where s.reward_granted = false
         and s.admin_status <> 'unsatisfactory'
         and s.action in ('confirm', 'edit')
         and (
           s.window_id = v_prior.id
           or exists (
             select 1
               from public.review_windows w
              where w.id = s.window_id
                and w.ny_close_at <= p_as_of
                and w.state in ('closed', 'granted')
           )
         )
       order by s.submitted_at, s.id
    loop
      -- apply_reward stores credits * 10 and ignores this minutes argument.
      -- Pass the same number so a negative check cannot reject a real grant.
      v_apply := private.apply_reward(
        rec.user_id,
        'public_review',
        'review_submission:' || rec.submission_id::text || ':window_close',
        rec.scheduled_credits,
        rec.scheduled_credits * 10
      );

      if coalesce((v_apply ->> 'applied')::boolean, false)
         or (v_apply ->> 'reason') = 'duplicate' then
        update public.review_submissions
           set reward_granted = true,
               reward_granted_at = p_as_of
         where id = rec.submission_id;
        if coalesce((v_apply ->> 'applied')::boolean, false) then
          v_granted_applied := v_granted_applied + 1;
        else
          v_granted_dup := v_granted_dup + 1;
        end if;
      end if;
      -- A daily-cap refusal leaves reward_granted false. The source item
      -- is still retired below so it is not planned again. A later close
      -- retries the same submission.

      insert into public.review_exclusions
        (content_hash, reason, source_lineage, window_id, notes)
      values (
        rec.content_hash,
        'public_reviewed',
        'public_review:granted',
        v_prior.id,
        'retired after confirm/edit reward'
      )
      on conflict (content_hash, reason) do nothing;

      update private.review_source_items
         set public_review_eligible = false,
             substantively_reviewed = true,
             metadata = coalesce(metadata, '{}'::jsonb) ||
                        jsonb_build_object(
                          'retired_at', p_as_of,
                          'retired_from_window', v_prior.id,
                          'excluded_reason', 'public_reviewed'
                        )
       where id = rec.source_item_id;

      v_retired := v_retired + 1;
    end loop;

    update public.review_windows
       set state = 'granted', granted_at = p_as_of
     where id = v_prior.id;
  end if;

  perform public.service_plan_review_lookahead(p_as_of, 28, 14);

  select public_review_enabled into v_enabled
    from public.app_config
   where id = 1;

  if not coalesce(v_enabled, false) then
    return jsonb_build_object(
      'status', 'lookahead_private',
      'closed_window_id', v_prior.id,
      'granted_applied', v_granted_applied,
      'granted_duplicate', v_granted_dup,
      'granted_count', v_granted_applied + v_granted_dup,
      'reported_quarantined', v_report_quarantined,
      'retired_from_pool', v_retired,
      'public_review_enabled', false
    );
  end if;

  v_next_close := private.next_review_close(p_as_of);
  select id into v_new_id
    from public.review_windows
   where ny_close_at = v_next_close
     and state = 'planned'
   for update;

  if v_new_id is not null then
    update public.review_windows
       set state = 'open',
           opened_at = p_as_of
     where id = v_new_id;
    select count(*)::int into v_inserted
      from public.review_window_items
     where window_id = v_new_id;
  else
    insert into public.review_windows (ny_close_at, state, size, opened_at)
      values (v_next_close, 'open', p_size, p_as_of)
      returning id into v_new_id;

    insert into public.review_window_items (
      window_id, slot, source_item_id, length_tier_snapshot,
      scheduled_credits, original_source_word_count
    )
    select
      v_new_id,
      (row_number() over ())::smallint,
      sel.source_item_id,
      1::smallint,
      private.scheduled_credits_for_words(private.count_source_words(src.source_text)),
      private.count_source_words(src.source_text)
    from private.select_review_window_items(p_size) sel
    join private.review_source_items src on src.id = sel.source_item_id;

    get diagnostics v_inserted = row_count;

    update private.review_source_items s
       set times_assigned = times_assigned + 1,
           last_assigned_at = p_as_of
      from public.review_window_items i
     where i.window_id = v_new_id
       and i.source_item_id = s.id;
  end if;

  v_short := v_inserted < p_size;

  return jsonb_build_object(
    'status', case when v_short then 'ok_pool_short' else 'ok' end,
    'closed_window_id', v_prior.id,
    'granted_applied', v_granted_applied,
    'granted_duplicate', v_granted_dup,
    'granted_count', v_granted_applied + v_granted_dup,
    'reported_quarantined', v_report_quarantined,
    'retired_from_pool', v_retired,
    'new_window_id', v_new_id,
    'new_window_ny_close_at', v_next_close,
    'new_window_size', v_inserted,
    'requested_size', p_size,
    'warning', case when v_short then 'pool_short' else null end,
    'public_review_enabled', true
  );
end;
$$;


revoke all on function public.service_rotate_review_window(smallint, timestamptz)
  from public, anon, authenticated;
grant execute on function public.service_rotate_review_window(smallint, timestamptz)
  to service_role;
$guest_source_20260929140100$]);
end if; end $apply_20260929140100$;

do $apply_20261001150000$ begin
if not exists (select 1 from supabase_migrations.schema_migrations where version='20261001150000') then
execute $guest_source_20261001150000$-- Forward migration. Historical contribution_media rows, reward_ledger
-- balances, and review tables stay. New Camera photos cannot register or
-- complete. Sample progress is a count, not a credit grant.

create table if not exists public.sample_allotment_events (
  user_id uuid not null references auth.users (id) on delete cascade,
  corpus_version text not null,
  allotted integer not null,
  completed integer not null,
  crossed_at timestamptz not null,
  received_at timestamptz not null default now(),
  primary key (user_id, corpus_version),
  constraint sample_allotment_events_ratio check (
    allotted > 0 and completed::numeric / allotted > 0.9
  )
);

alter table public.sample_allotment_events enable row level security;

drop policy if exists sample_allotment_select_own on public.sample_allotment_events;
create policy sample_allotment_select_own
  on public.sample_allotment_events
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.record_sample_progress(
  p_corpus_version text,
  p_allotted integer,
  p_completed integer,
  p_crossed_at timestamptz
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if p_corpus_version is null
     or btrim(p_corpus_version) = ''
     or p_allotted is null
     or p_allotted <= 0
     or p_completed is null
     or p_crossed_at is null
     or p_completed::numeric / p_allotted <= 0.9 then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  insert into public.sample_allotment_events (
    user_id,
    corpus_version,
    allotted,
    completed,
    crossed_at
  ) values (
    auth.uid(),
    btrim(p_corpus_version),
    p_allotted,
    p_completed,
    p_crossed_at
  )
  on conflict (user_id, corpus_version) do nothing;

  return true;
end;
$$;

revoke all on function public.record_sample_progress(text, integer, integer, timestamptz)
  from public, anon;
grant execute on function public.record_sample_progress(text, integer, integer, timestamptz)
  to authenticated;

create or replace function public.service_register_media_upload(
  p_user_id uuid,
  p_kind text,
  p_idempotency_key text,
  p_content_type text,
  p_byte_size integer,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  media_id uuid,
  bucket_id text,
  object_path text,
  status text,
  inserted boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bucket text;
  v_path text;
  v_consent text;
  v_existing public.contribution_media%rowtype;
  v_id uuid;
begin
  if p_kind = 'photo' then
    raise exception 'photo_collection_retired' using errcode = '42501';
  end if;

  if p_user_id is null
     or p_idempotency_key is null
     or btrim(p_idempotency_key) = ''
     or p_content_type is null
     or btrim(p_content_type) = ''
     or p_byte_size is null
     or p_byte_size <= 0 then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  perform private.assert_contribution_media_gate(p_user_id, p_kind);

  select consent_version into v_consent
  from public.profiles
  where user_id = p_user_id;

  v_bucket := 'contribution-speech';

  select * into v_existing
  from public.contribution_media m
  where m.user_id = p_user_id
    and m.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.kind = 'photo' then
      raise exception 'photo_collection_retired' using errcode = '42501';
    end if;
    return query
      select
        v_existing.id,
        v_existing.bucket_id,
        v_existing.object_path,
        v_existing.status,
        false;
    return;
  end if;

  v_id := gen_random_uuid();
  v_path := p_user_id::text || '/' || v_id::text;

  insert into public.contribution_media (
    id,
    user_id,
    kind,
    bucket_id,
    object_path,
    content_type,
    byte_size,
    idempotency_key,
    consent_version,
    status,
    metadata
  ) values (
    v_id,
    p_user_id,
    p_kind,
    v_bucket,
    v_path,
    lower(btrim(p_content_type)),
    p_byte_size,
    p_idempotency_key,
    v_consent,
    'pending_upload',
    coalesce(p_metadata, '{}'::jsonb)
  );

  return query
    select v_id, v_bucket, v_path, 'pending_upload'::text, true;
end;
$$;

create or replace function public.service_complete_media_upload(
  p_user_id uuid,
  p_media_id uuid,
  p_sha256 text default null
)
returns table (
  media_id uuid,
  status text,
  object_path text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.contribution_media%rowtype;
begin
  if p_user_id is null or p_media_id is null then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  select * into v_row
  from public.contribution_media m
  where m.id = p_media_id
    and m.user_id = p_user_id;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if v_row.kind = 'photo' then
    raise exception 'photo_collection_retired' using errcode = '42501';
  end if;

  perform private.assert_contribution_media_gate(p_user_id, v_row.kind);

  if v_row.status = 'uploaded' then
    return query select v_row.id, v_row.status, v_row.object_path;
    return;
  end if;

  update public.contribution_media
  set
    status = 'uploaded',
    sha256 = coalesce(nullif(btrim(p_sha256), ''), sha256),
    uploaded_at = now()
  where id = p_media_id
    and user_id = p_user_id
  returning * into v_row;

  return query select v_row.id, v_row.status, v_row.object_path;
end;
$$;

-- Hosted review rotation is not a database cron in this repo. If a later
-- environment created cron jobs with these names, drop those schedules.
-- Historical functions and tables remain.
do $$
begin
  if to_regnamespace('cron') is not null and to_regclass('cron.job') is not null then
    execute $unschedule$
      select cron.unschedule(jobid)
      from cron.job
      where jobname in (
        'service_rotate_review_window',
        'review-lookahead',
        'review-validation'
      )
    $unschedule$;
  end if;
exception
  when undefined_table or undefined_function then
    null;
end $$;
$guest_source_20261001150000$;
insert into supabase_migrations.schema_migrations(version,name,statements) values ('20261001150000','retire_photo_review_sample_progress',array[$guest_source_20261001150000$-- Forward migration. Historical contribution_media rows, reward_ledger
-- balances, and review tables stay. New Camera photos cannot register or
-- complete. Sample progress is a count, not a credit grant.

create table if not exists public.sample_allotment_events (
  user_id uuid not null references auth.users (id) on delete cascade,
  corpus_version text not null,
  allotted integer not null,
  completed integer not null,
  crossed_at timestamptz not null,
  received_at timestamptz not null default now(),
  primary key (user_id, corpus_version),
  constraint sample_allotment_events_ratio check (
    allotted > 0 and completed::numeric / allotted > 0.9
  )
);

alter table public.sample_allotment_events enable row level security;

drop policy if exists sample_allotment_select_own on public.sample_allotment_events;
create policy sample_allotment_select_own
  on public.sample_allotment_events
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.record_sample_progress(
  p_corpus_version text,
  p_allotted integer,
  p_completed integer,
  p_crossed_at timestamptz
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if p_corpus_version is null
     or btrim(p_corpus_version) = ''
     or p_allotted is null
     or p_allotted <= 0
     or p_completed is null
     or p_crossed_at is null
     or p_completed::numeric / p_allotted <= 0.9 then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  insert into public.sample_allotment_events (
    user_id,
    corpus_version,
    allotted,
    completed,
    crossed_at
  ) values (
    auth.uid(),
    btrim(p_corpus_version),
    p_allotted,
    p_completed,
    p_crossed_at
  )
  on conflict (user_id, corpus_version) do nothing;

  return true;
end;
$$;

revoke all on function public.record_sample_progress(text, integer, integer, timestamptz)
  from public, anon;
grant execute on function public.record_sample_progress(text, integer, integer, timestamptz)
  to authenticated;

create or replace function public.service_register_media_upload(
  p_user_id uuid,
  p_kind text,
  p_idempotency_key text,
  p_content_type text,
  p_byte_size integer,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  media_id uuid,
  bucket_id text,
  object_path text,
  status text,
  inserted boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bucket text;
  v_path text;
  v_consent text;
  v_existing public.contribution_media%rowtype;
  v_id uuid;
begin
  if p_kind = 'photo' then
    raise exception 'photo_collection_retired' using errcode = '42501';
  end if;

  if p_user_id is null
     or p_idempotency_key is null
     or btrim(p_idempotency_key) = ''
     or p_content_type is null
     or btrim(p_content_type) = ''
     or p_byte_size is null
     or p_byte_size <= 0 then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  perform private.assert_contribution_media_gate(p_user_id, p_kind);

  select consent_version into v_consent
  from public.profiles
  where user_id = p_user_id;

  v_bucket := 'contribution-speech';

  select * into v_existing
  from public.contribution_media m
  where m.user_id = p_user_id
    and m.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.kind = 'photo' then
      raise exception 'photo_collection_retired' using errcode = '42501';
    end if;
    return query
      select
        v_existing.id,
        v_existing.bucket_id,
        v_existing.object_path,
        v_existing.status,
        false;
    return;
  end if;

  v_id := gen_random_uuid();
  v_path := p_user_id::text || '/' || v_id::text;

  insert into public.contribution_media (
    id,
    user_id,
    kind,
    bucket_id,
    object_path,
    content_type,
    byte_size,
    idempotency_key,
    consent_version,
    status,
    metadata
  ) values (
    v_id,
    p_user_id,
    p_kind,
    v_bucket,
    v_path,
    lower(btrim(p_content_type)),
    p_byte_size,
    p_idempotency_key,
    v_consent,
    'pending_upload',
    coalesce(p_metadata, '{}'::jsonb)
  );

  return query
    select v_id, v_bucket, v_path, 'pending_upload'::text, true;
end;
$$;

create or replace function public.service_complete_media_upload(
  p_user_id uuid,
  p_media_id uuid,
  p_sha256 text default null
)
returns table (
  media_id uuid,
  status text,
  object_path text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.contribution_media%rowtype;
begin
  if p_user_id is null or p_media_id is null then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  select * into v_row
  from public.contribution_media m
  where m.id = p_media_id
    and m.user_id = p_user_id;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if v_row.kind = 'photo' then
    raise exception 'photo_collection_retired' using errcode = '42501';
  end if;

  perform private.assert_contribution_media_gate(p_user_id, v_row.kind);

  if v_row.status = 'uploaded' then
    return query select v_row.id, v_row.status, v_row.object_path;
    return;
  end if;

  update public.contribution_media
  set
    status = 'uploaded',
    sha256 = coalesce(nullif(btrim(p_sha256), ''), sha256),
    uploaded_at = now()
  where id = p_media_id
    and user_id = p_user_id
  returning * into v_row;

  return query select v_row.id, v_row.status, v_row.object_path;
end;
$$;

-- Hosted review rotation is not a database cron in this repo. If a later
-- environment created cron jobs with these names, drop those schedules.
-- Historical functions and tables remain.
do $$
begin
  if to_regnamespace('cron') is not null and to_regclass('cron.job') is not null then
    execute $unschedule$
      select cron.unschedule(jobid)
      from cron.job
      where jobname in (
        'service_rotate_review_window',
        'review-lookahead',
        'review-validation'
      )
    $unschedule$;
  end if;
exception
  when undefined_table or undefined_function then
    null;
end $$;
$guest_source_20261001150000$]);
end if; end $apply_20261001150000$;

do $apply_20261001160000$ begin
if not exists (select 1 from supabase_migrations.schema_migrations where version='20261001160000') then
execute $guest_source_20261001160000$-- Forward migration. Sample progress can be inserted by the signed-in user.
-- A later speech rating updates the existing media row and does not add a file.

create or replace function private.merge_speech_feedback(
  p_current jsonb,
  p_incoming jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_incoming integer := 0;
  v_current integer := 0;
  v_feedback text;
  v_base jsonb := coalesce(p_current, '{}'::jsonb);
begin
  if p_incoming is null then
    return v_base;
  end if;
  if (p_incoming->>'feedbackRevision') ~ '^[0-9]+$' then
    v_incoming := (p_incoming->>'feedbackRevision')::integer;
  end if;
  if (v_base->>'feedbackRevision') ~ '^[0-9]+$' then
    v_current := (v_base->>'feedbackRevision')::integer;
  end if;
  if v_incoming < v_current then
    return v_base;
  end if;
  v_feedback := p_incoming->>'feedback';
  if v_feedback is null or v_feedback not in ('unrated', 'up', 'down') then
    v_feedback := coalesce(v_base->>'feedback', 'unrated');
  end if;
  return v_base || jsonb_build_object(
    'feedback', v_feedback,
    'feedbackRevision', v_incoming,
    'transcript', coalesce(p_incoming->>'transcript', v_base->>'transcript'),
    'utteranceId', coalesce(p_incoming->>'utteranceId', v_base->>'utteranceId'),
    'language', coalesce(p_incoming->>'language', v_base->>'language'),
    'capturedAt', coalesce(p_incoming->>'capturedAt', v_base->>'capturedAt'),
    'surface', coalesce(p_incoming->>'surface', v_base->>'surface'),
    'durationMs', coalesce(p_incoming->'durationMs', v_base->'durationMs'),
    'schemaVersion', coalesce(p_incoming->'schemaVersion', v_base->'schemaVersion')
  );
end;
$$;

revoke all on function private.merge_speech_feedback(jsonb, jsonb)
  from public, anon, authenticated;

alter table public.sample_allotment_events
  drop constraint if exists sample_allotment_events_bounds;
alter table public.sample_allotment_events
  add constraint sample_allotment_events_bounds
  check (completed >= 0 and completed <= allotted);

alter table public.sample_allotment_events
  drop constraint if exists sample_allotment_events_manifest;
alter table public.sample_allotment_events
  add constraint sample_allotment_events_manifest
  check (corpus_version = 'review-roster-370');

revoke all on table public.sample_allotment_events from public, anon;
grant select, insert on table public.sample_allotment_events to authenticated;

drop policy if exists sample_allotment_insert_own on public.sample_allotment_events;
create policy sample_allotment_insert_own
  on public.sample_allotment_events
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create or replace function public.record_sample_progress(
  p_corpus_version text,
  p_allotted integer,
  p_completed integer,
  p_crossed_at timestamptz
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if p_corpus_version is null
     or btrim(p_corpus_version) is distinct from 'review-roster-370'
     or p_allotted is null
     or p_allotted <= 0
     or p_completed is null
     or p_completed < 0
     or p_completed > p_allotted
     or p_crossed_at is null
     or p_completed::numeric / p_allotted <= 0.9 then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  insert into public.sample_allotment_events (
    user_id,
    corpus_version,
    allotted,
    completed,
    crossed_at
  ) values (
    auth.uid(),
    btrim(p_corpus_version),
    p_allotted,
    p_completed,
    p_crossed_at
  )
  on conflict (user_id, corpus_version) do nothing;

  return true;
end;
$$;

revoke all on function public.record_sample_progress(text, integer, integer, timestamptz)
  from public, anon;
grant execute on function public.record_sample_progress(text, integer, integer, timestamptz)
  to authenticated;

create or replace function public.revise_media_feedback(
  p_idempotency_key text,
  p_metadata jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.contribution_media%rowtype;
begin
  if v_uid is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if p_idempotency_key is null
     or btrim(p_idempotency_key) = ''
     or p_metadata is null
     or jsonb_typeof(p_metadata) is distinct from 'object' then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  select * into v_row
  from public.contribution_media m
  where m.user_id = v_uid
    and m.idempotency_key = btrim(p_idempotency_key)
    and m.kind = 'speech';

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  update public.contribution_media
  set metadata = private.merge_speech_feedback(v_row.metadata, p_metadata)
  where id = v_row.id
    and user_id = v_uid;

  return true;
end;
$$;

revoke all on function public.revise_media_feedback(text, jsonb)
  from public, anon;
grant execute on function public.revise_media_feedback(text, jsonb)
  to authenticated;

create or replace function public.service_register_media_upload(
  p_user_id uuid,
  p_kind text,
  p_idempotency_key text,
  p_content_type text,
  p_byte_size integer,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  media_id uuid,
  bucket_id text,
  object_path text,
  status text,
  inserted boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bucket text;
  v_path text;
  v_consent text;
  v_existing public.contribution_media%rowtype;
  v_id uuid;
begin
  if p_kind = 'photo' then
    raise exception 'photo_collection_retired' using errcode = '42501';
  end if;

  if p_user_id is null
     or p_idempotency_key is null
     or btrim(p_idempotency_key) = ''
     or p_content_type is null
     or btrim(p_content_type) = ''
     or p_byte_size is null
     or p_byte_size <= 0 then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  perform private.assert_contribution_media_gate(p_user_id, p_kind);

  select consent_version into v_consent
  from public.profiles
  where user_id = p_user_id;

  v_bucket := 'contribution-speech';

  select * into v_existing
  from public.contribution_media m
  where m.user_id = p_user_id
    and m.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.kind = 'photo' then
      raise exception 'photo_collection_retired' using errcode = '42501';
    end if;
    update public.contribution_media
    set metadata = private.merge_speech_feedback(
      v_existing.metadata,
      coalesce(p_metadata, '{}'::jsonb)
    )
    where id = v_existing.id;
    return query
      select
        v_existing.id,
        v_existing.bucket_id,
        v_existing.object_path,
        v_existing.status,
        false;
    return;
  end if;

  v_id := gen_random_uuid();
  v_path := p_user_id::text || '/' || v_id::text;

  insert into public.contribution_media (
    id,
    user_id,
    kind,
    bucket_id,
    object_path,
    content_type,
    byte_size,
    idempotency_key,
    consent_version,
    status,
    metadata
  ) values (
    v_id,
    p_user_id,
    p_kind,
    v_bucket,
    v_path,
    lower(btrim(p_content_type)),
    p_byte_size,
    p_idempotency_key,
    v_consent,
    'pending_upload',
    coalesce(p_metadata, '{}'::jsonb)
  );

  return query
    select v_id, v_bucket, v_path, 'pending_upload'::text, true;
end;
$$;

revoke all on function public.service_register_media_upload(
  uuid, text, text, text, integer, jsonb
) from public, anon, authenticated;
grant execute on function public.service_register_media_upload(
  uuid, text, text, text, integer, jsonb
) to service_role;
$guest_source_20261001160000$;
insert into supabase_migrations.schema_migrations(version,name,statements) values ('20261001160000','sample_progress_insert_and_speech_feedback',array[$guest_source_20261001160000$-- Forward migration. Sample progress can be inserted by the signed-in user.
-- A later speech rating updates the existing media row and does not add a file.

create or replace function private.merge_speech_feedback(
  p_current jsonb,
  p_incoming jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_incoming integer := 0;
  v_current integer := 0;
  v_feedback text;
  v_base jsonb := coalesce(p_current, '{}'::jsonb);
begin
  if p_incoming is null then
    return v_base;
  end if;
  if (p_incoming->>'feedbackRevision') ~ '^[0-9]+$' then
    v_incoming := (p_incoming->>'feedbackRevision')::integer;
  end if;
  if (v_base->>'feedbackRevision') ~ '^[0-9]+$' then
    v_current := (v_base->>'feedbackRevision')::integer;
  end if;
  if v_incoming < v_current then
    return v_base;
  end if;
  v_feedback := p_incoming->>'feedback';
  if v_feedback is null or v_feedback not in ('unrated', 'up', 'down') then
    v_feedback := coalesce(v_base->>'feedback', 'unrated');
  end if;
  return v_base || jsonb_build_object(
    'feedback', v_feedback,
    'feedbackRevision', v_incoming,
    'transcript', coalesce(p_incoming->>'transcript', v_base->>'transcript'),
    'utteranceId', coalesce(p_incoming->>'utteranceId', v_base->>'utteranceId'),
    'language', coalesce(p_incoming->>'language', v_base->>'language'),
    'capturedAt', coalesce(p_incoming->>'capturedAt', v_base->>'capturedAt'),
    'surface', coalesce(p_incoming->>'surface', v_base->>'surface'),
    'durationMs', coalesce(p_incoming->'durationMs', v_base->'durationMs'),
    'schemaVersion', coalesce(p_incoming->'schemaVersion', v_base->'schemaVersion')
  );
end;
$$;

revoke all on function private.merge_speech_feedback(jsonb, jsonb)
  from public, anon, authenticated;

alter table public.sample_allotment_events
  drop constraint if exists sample_allotment_events_bounds;
alter table public.sample_allotment_events
  add constraint sample_allotment_events_bounds
  check (completed >= 0 and completed <= allotted);

alter table public.sample_allotment_events
  drop constraint if exists sample_allotment_events_manifest;
alter table public.sample_allotment_events
  add constraint sample_allotment_events_manifest
  check (corpus_version = 'review-roster-370');

revoke all on table public.sample_allotment_events from public, anon;
grant select, insert on table public.sample_allotment_events to authenticated;

drop policy if exists sample_allotment_insert_own on public.sample_allotment_events;
create policy sample_allotment_insert_own
  on public.sample_allotment_events
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create or replace function public.record_sample_progress(
  p_corpus_version text,
  p_allotted integer,
  p_completed integer,
  p_crossed_at timestamptz
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if p_corpus_version is null
     or btrim(p_corpus_version) is distinct from 'review-roster-370'
     or p_allotted is null
     or p_allotted <= 0
     or p_completed is null
     or p_completed < 0
     or p_completed > p_allotted
     or p_crossed_at is null
     or p_completed::numeric / p_allotted <= 0.9 then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  insert into public.sample_allotment_events (
    user_id,
    corpus_version,
    allotted,
    completed,
    crossed_at
  ) values (
    auth.uid(),
    btrim(p_corpus_version),
    p_allotted,
    p_completed,
    p_crossed_at
  )
  on conflict (user_id, corpus_version) do nothing;

  return true;
end;
$$;

revoke all on function public.record_sample_progress(text, integer, integer, timestamptz)
  from public, anon;
grant execute on function public.record_sample_progress(text, integer, integer, timestamptz)
  to authenticated;

create or replace function public.revise_media_feedback(
  p_idempotency_key text,
  p_metadata jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.contribution_media%rowtype;
begin
  if v_uid is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if p_idempotency_key is null
     or btrim(p_idempotency_key) = ''
     or p_metadata is null
     or jsonb_typeof(p_metadata) is distinct from 'object' then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  select * into v_row
  from public.contribution_media m
  where m.user_id = v_uid
    and m.idempotency_key = btrim(p_idempotency_key)
    and m.kind = 'speech';

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  update public.contribution_media
  set metadata = private.merge_speech_feedback(v_row.metadata, p_metadata)
  where id = v_row.id
    and user_id = v_uid;

  return true;
end;
$$;

revoke all on function public.revise_media_feedback(text, jsonb)
  from public, anon;
grant execute on function public.revise_media_feedback(text, jsonb)
  to authenticated;

create or replace function public.service_register_media_upload(
  p_user_id uuid,
  p_kind text,
  p_idempotency_key text,
  p_content_type text,
  p_byte_size integer,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  media_id uuid,
  bucket_id text,
  object_path text,
  status text,
  inserted boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bucket text;
  v_path text;
  v_consent text;
  v_existing public.contribution_media%rowtype;
  v_id uuid;
begin
  if p_kind = 'photo' then
    raise exception 'photo_collection_retired' using errcode = '42501';
  end if;

  if p_user_id is null
     or p_idempotency_key is null
     or btrim(p_idempotency_key) = ''
     or p_content_type is null
     or btrim(p_content_type) = ''
     or p_byte_size is null
     or p_byte_size <= 0 then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  perform private.assert_contribution_media_gate(p_user_id, p_kind);

  select consent_version into v_consent
  from public.profiles
  where user_id = p_user_id;

  v_bucket := 'contribution-speech';

  select * into v_existing
  from public.contribution_media m
  where m.user_id = p_user_id
    and m.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.kind = 'photo' then
      raise exception 'photo_collection_retired' using errcode = '42501';
    end if;
    update public.contribution_media
    set metadata = private.merge_speech_feedback(
      v_existing.metadata,
      coalesce(p_metadata, '{}'::jsonb)
    )
    where id = v_existing.id;
    return query
      select
        v_existing.id,
        v_existing.bucket_id,
        v_existing.object_path,
        v_existing.status,
        false;
    return;
  end if;

  v_id := gen_random_uuid();
  v_path := p_user_id::text || '/' || v_id::text;

  insert into public.contribution_media (
    id,
    user_id,
    kind,
    bucket_id,
    object_path,
    content_type,
    byte_size,
    idempotency_key,
    consent_version,
    status,
    metadata
  ) values (
    v_id,
    p_user_id,
    p_kind,
    v_bucket,
    v_path,
    lower(btrim(p_content_type)),
    p_byte_size,
    p_idempotency_key,
    v_consent,
    'pending_upload',
    coalesce(p_metadata, '{}'::jsonb)
  );

  return query
    select v_id, v_bucket, v_path, 'pending_upload'::text, true;
end;
$$;

revoke all on function public.service_register_media_upload(
  uuid, text, text, text, integer, jsonb
) from public, anon, authenticated;
grant execute on function public.service_register_media_upload(
  uuid, text, text, text, integer, jsonb
) to service_role;
$guest_source_20261001160000$]);
end if; end $apply_20261001160000$;

do $apply_20261002230000$ begin
if not exists (select 1 from supabase_migrations.schema_migrations where version='20261002230000') then
execute $guest_source_20261002230000$-- Read-only, subject-scoped SSV receipt. Aggregate time is not session verification.
create or replace function public.rewarded_session_verified(p_session_token text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.rewarded_ad_sessions
    where user_id = auth.uid() and session_token = p_session_token
      and consumed_at is not null and transaction_id is not null
  );
$$;
revoke all on function public.rewarded_session_verified(text) from public, anon;
grant execute on function public.rewarded_session_verified(text) to authenticated;
$guest_source_20261002230000$;
insert into supabase_migrations.schema_migrations(version,name,statements) values ('20261002230000','rewarded_session_receipt',array[$guest_source_20261002230000$-- Read-only, subject-scoped SSV receipt. Aggregate time is not session verification.
create or replace function public.rewarded_session_verified(p_session_token text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.rewarded_ad_sessions
    where user_id = auth.uid() and session_token = p_session_token
      and consumed_at is not null and transaction_id is not null
  );
$$;
revoke all on function public.rewarded_session_verified(text) from public, anon;
grant execute on function public.rewarded_session_verified(text) to authenticated;
$guest_source_20261002230000$]);
end if; end $apply_20261002230000$;

do $apply_20261003000000$ begin
if not exists (select 1 from supabase_migrations.schema_migrations where version='20261003000000') then
execute $guest_source_20261003000000$-- C6 owner amendment: private guest authentication is not contribution consent.
-- Changed disclosures require fresh separate acceptance. No live flags enabled.
update public.app_config
set contribution_consent_version = '2026-10-02.guest',
    startup_consent_version = '2026-10-02.guest.startup',
    version = version + 1,
    updated_at = now()
where id = 1;

-- Renewed opt-in cannot cancel pending deletion or revive the old speech toggle.
create or replace function public.service_record_consent(
  p_user_id uuid,
  p_version text,
  p_age_confirmed boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current text;
  v_uid uuid := auth.uid();
begin
  if p_user_id is null or p_age_confirmed is not true or p_version is null then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  if v_uid is not null and v_uid <> p_user_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select contribution_consent_version into v_current
  from public.app_config where id = 1;
  if p_version is distinct from v_current then
    raise exception 'consent_outdated' using errcode = 'P0001';
  end if;
  if exists (select 1 from private.deletion_requests where user_id = p_user_id and completed_at is null) then
    raise exception 'deletion_pending' using errcode = 'P0001';
  end if;
  update public.profiles
  set
    consent_version = p_version,
    consent_withdrawn_at = null,
    speech_sharing = false, photo_sharing = false,
    consented_at = now(),
    age_confirmed_at = now(),
    updated_at = now()
  where user_id = p_user_id;
end;
$$;

revoke all on function public.service_record_consent(uuid, text, boolean)
  from public, anon;
grant execute on function public.service_record_consent(uuid, text, boolean)
  to authenticated, service_role;

$guest_source_20261003000000$;
insert into supabase_migrations.schema_migrations(version,name,statements) values ('20261003000000','guest_consent_version',array[$guest_source_20261003000000$-- C6 owner amendment: private guest authentication is not contribution consent.
-- Changed disclosures require fresh separate acceptance. No live flags enabled.
update public.app_config
set contribution_consent_version = '2026-10-02.guest',
    startup_consent_version = '2026-10-02.guest.startup',
    version = version + 1,
    updated_at = now()
where id = 1;

-- Renewed opt-in cannot cancel pending deletion or revive the old speech toggle.
create or replace function public.service_record_consent(
  p_user_id uuid,
  p_version text,
  p_age_confirmed boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current text;
  v_uid uuid := auth.uid();
begin
  if p_user_id is null or p_age_confirmed is not true or p_version is null then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  if v_uid is not null and v_uid <> p_user_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select contribution_consent_version into v_current
  from public.app_config where id = 1;
  if p_version is distinct from v_current then
    raise exception 'consent_outdated' using errcode = 'P0001';
  end if;
  if exists (select 1 from private.deletion_requests where user_id = p_user_id and completed_at is null) then
    raise exception 'deletion_pending' using errcode = 'P0001';
  end if;
  update public.profiles
  set
    consent_version = p_version,
    consent_withdrawn_at = null,
    speech_sharing = false, photo_sharing = false,
    consented_at = now(),
    age_confirmed_at = now(),
    updated_at = now()
  where user_id = p_user_id;
end;
$$;

revoke all on function public.service_record_consent(uuid, text, boolean)
  from public, anon;
grant execute on function public.service_record_consent(uuid, text, boolean)
  to authenticated, service_role;

$guest_source_20261003000000$]);
end if; end $apply_20261003000000$;

do $apply_20261003001000$ begin
if not exists (select 1 from supabase_migrations.schema_migrations where version='20261003001000') then
execute $guest_source_20261003001000$-- C9: shared-data deletion uses the current private identity and preserves credits.
-- Historical full identity deletion remains separate; no Apple challenge for shared data.
create or replace function private.purge_shared_contributions(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_hash text;
begin
  for v_hash in
    select distinct si.content_hash from public.review_submissions s
      join private.review_source_items si on si.id = s.source_item_id
      where s.user_id = p_user_id
  loop
    insert into public.review_exclusions (content_hash, reason, source_lineage, actor_user_id, notes)
      values (v_hash, 'consent_withdrawn', 'guest:consent_withdrawn', p_user_id, 'shared-data purge')
      on conflict (content_hash, reason) do nothing;
  end loop;
  delete from public.review_submissions where user_id = p_user_id;
  delete from private.contributor_alerts where user_id = p_user_id;
  delete from public.contribution_media where user_id = p_user_id;
  delete from private.submissions where user_id = p_user_id;
  delete from private.task_assignments where user_id = p_user_id;
  -- Accepted reports still contain raw text: erase, rather than just unlink them.
  delete from private.contribution_tasks where reporter_id = p_user_id;
  delete from private.translation_reports where reporter_id = p_user_id;
  delete from public.contribution_receipts where user_id = p_user_id;
  delete from public.sample_allotment_events where user_id = p_user_id;
  delete from private.contributor_stats where user_id = p_user_id;
  update public.profiles set consent_version = null, consented_at = null,
    age_confirmed_at = null, speech_sharing = false, photo_sharing = false,
    deletion_due_at = null, deletion_purged_at = now(), updated_at = now()
    where user_id = p_user_id;
  -- Reward ledger, entitlements, startup acceptance and private auth identity survive.
  insert into private.audit_log (actor_id, action, target, reason)
    values (p_user_id, 'shared_data_deleted', p_user_id::text, 'contributed text/audio removed; credits preserved');
end;
$$;
revoke all on function private.purge_shared_contributions(uuid) from public, anon, authenticated;
grant execute on function private.purge_shared_contributions(uuid) to service_role;

create or replace function public.service_withdraw_contribution_consent(
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_due timestamptz;
  v_uid uuid := auth.uid();
begin
  if p_user_id is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if v_uid is not null and v_uid <> p_user_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.profiles (user_id) values (p_user_id) on conflict (user_id) do nothing;
  v_due := now() + interval '30 days';

  update public.profiles
     set consent_withdrawn_at = coalesce(consent_withdrawn_at, now()),
         deletion_due_at = coalesce(deletion_due_at, v_due),
         consent_version = null, consented_at = null, age_confirmed_at = null,
         speech_sharing = false, photo_sharing = false,
         media_cancel_generation = media_cancel_generation + 1,
         updated_at = now()
   where user_id = p_user_id;

  update public.contribution_media
     set status = 'pending_delete'
   where user_id = p_user_id
     and status in ('uploaded', 'pending_upload');

  insert into private.contributor_alerts (user_id, receipt_id, alert_type, message)
  values (
    p_user_id,
    null,
    'contribution_consent_withdrawn',
    '30-day purge deadline set'
  );

  insert into private.audit_log (actor_id, action, target, reason)
  values (
    p_user_id,
    'contribution_consent_withdrawn',
    p_user_id::text,
    'user withdrew contribution consent'
  );

  select deletion_due_at into v_due from public.profiles where user_id = p_user_id;
  perform private.ensure_deletion_request(p_user_id, 'consent_withdrawal');

  return jsonb_build_object(
    'consent_withdrawn_at', now(),
    'deletion_due_at', v_due
  );
end;
$$;

create or replace function public.request_shared_data_deletion()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_result jsonb;
begin
  if v_uid is null then raise exception 'unauthorized' using errcode = '28000'; end if;
  v_result := public.service_withdraw_contribution_consent(v_uid);
  return jsonb_build_object('scheduled', true, 'deletion_due_at', v_result ->> 'deletion_due_at', 'scope', 'contributions');
end;
$$;
revoke all on function public.request_shared_data_deletion() from public, anon;
grant execute on function public.request_shared_data_deletion() to authenticated;

create or replace function public.service_complete_deletion_database(
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row private.deletion_requests;
begin
  select * into v_row
    from private.deletion_requests
   where id = p_request_id
     and completed_at is null
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_open');
  end if;
  if not v_row.storage_completed then
    return jsonb_build_object('ok', false, 'reason', 'storage_incomplete');
  end if;
  if v_row.database_completed then
    return jsonb_build_object('ok', true, 'stage', 'database', 'idempotent', true);
  end if;

  if v_row.request_kind = 'consent_withdrawal' then
    perform private.purge_shared_contributions(v_row.user_id);
  else
    perform private.purge_user_data(v_row.user_id);
  end if;

  update private.deletion_requests
     set database_completed = true,
         stage = case
           when request_kind = 'consent_withdrawal' then 'complete'
           else 'auth'
         end,
         completed_at = case
           when request_kind = 'consent_withdrawal' then now()
           else null
         end,
         last_error = null
   where id = p_request_id;

  return jsonb_build_object(
    'ok', true,
    'stage', case when v_row.request_kind = 'consent_withdrawal' then 'complete' else 'auth' end
  );
end;
$$;

revoke all on function public.service_complete_deletion_database(uuid)
  from public, anon, authenticated;
grant execute on function public.service_complete_deletion_database(uuid)
  to service_role;

$guest_source_20261003001000$;
insert into supabase_migrations.schema_migrations(version,name,statements) values ('20261003001000','guest_shared_data_deletion',array[$guest_source_20261003001000$-- C9: shared-data deletion uses the current private identity and preserves credits.
-- Historical full identity deletion remains separate; no Apple challenge for shared data.
create or replace function private.purge_shared_contributions(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_hash text;
begin
  for v_hash in
    select distinct si.content_hash from public.review_submissions s
      join private.review_source_items si on si.id = s.source_item_id
      where s.user_id = p_user_id
  loop
    insert into public.review_exclusions (content_hash, reason, source_lineage, actor_user_id, notes)
      values (v_hash, 'consent_withdrawn', 'guest:consent_withdrawn', p_user_id, 'shared-data purge')
      on conflict (content_hash, reason) do nothing;
  end loop;
  delete from public.review_submissions where user_id = p_user_id;
  delete from private.contributor_alerts where user_id = p_user_id;
  delete from public.contribution_media where user_id = p_user_id;
  delete from private.submissions where user_id = p_user_id;
  delete from private.task_assignments where user_id = p_user_id;
  -- Accepted reports still contain raw text: erase, rather than just unlink them.
  delete from private.contribution_tasks where reporter_id = p_user_id;
  delete from private.translation_reports where reporter_id = p_user_id;
  delete from public.contribution_receipts where user_id = p_user_id;
  delete from public.sample_allotment_events where user_id = p_user_id;
  delete from private.contributor_stats where user_id = p_user_id;
  update public.profiles set consent_version = null, consented_at = null,
    age_confirmed_at = null, speech_sharing = false, photo_sharing = false,
    deletion_due_at = null, deletion_purged_at = now(), updated_at = now()
    where user_id = p_user_id;
  -- Reward ledger, entitlements, startup acceptance and private auth identity survive.
  insert into private.audit_log (actor_id, action, target, reason)
    values (p_user_id, 'shared_data_deleted', p_user_id::text, 'contributed text/audio removed; credits preserved');
end;
$$;
revoke all on function private.purge_shared_contributions(uuid) from public, anon, authenticated;
grant execute on function private.purge_shared_contributions(uuid) to service_role;

create or replace function public.service_withdraw_contribution_consent(
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_due timestamptz;
  v_uid uuid := auth.uid();
begin
  if p_user_id is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if v_uid is not null and v_uid <> p_user_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.profiles (user_id) values (p_user_id) on conflict (user_id) do nothing;
  v_due := now() + interval '30 days';

  update public.profiles
     set consent_withdrawn_at = coalesce(consent_withdrawn_at, now()),
         deletion_due_at = coalesce(deletion_due_at, v_due),
         consent_version = null, consented_at = null, age_confirmed_at = null,
         speech_sharing = false, photo_sharing = false,
         media_cancel_generation = media_cancel_generation + 1,
         updated_at = now()
   where user_id = p_user_id;

  update public.contribution_media
     set status = 'pending_delete'
   where user_id = p_user_id
     and status in ('uploaded', 'pending_upload');

  insert into private.contributor_alerts (user_id, receipt_id, alert_type, message)
  values (
    p_user_id,
    null,
    'contribution_consent_withdrawn',
    '30-day purge deadline set'
  );

  insert into private.audit_log (actor_id, action, target, reason)
  values (
    p_user_id,
    'contribution_consent_withdrawn',
    p_user_id::text,
    'user withdrew contribution consent'
  );

  select deletion_due_at into v_due from public.profiles where user_id = p_user_id;
  perform private.ensure_deletion_request(p_user_id, 'consent_withdrawal');

  return jsonb_build_object(
    'consent_withdrawn_at', now(),
    'deletion_due_at', v_due
  );
end;
$$;

create or replace function public.request_shared_data_deletion()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_result jsonb;
begin
  if v_uid is null then raise exception 'unauthorized' using errcode = '28000'; end if;
  v_result := public.service_withdraw_contribution_consent(v_uid);
  return jsonb_build_object('scheduled', true, 'deletion_due_at', v_result ->> 'deletion_due_at', 'scope', 'contributions');
end;
$$;
revoke all on function public.request_shared_data_deletion() from public, anon;
grant execute on function public.request_shared_data_deletion() to authenticated;

create or replace function public.service_complete_deletion_database(
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row private.deletion_requests;
begin
  select * into v_row
    from private.deletion_requests
   where id = p_request_id
     and completed_at is null
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_open');
  end if;
  if not v_row.storage_completed then
    return jsonb_build_object('ok', false, 'reason', 'storage_incomplete');
  end if;
  if v_row.database_completed then
    return jsonb_build_object('ok', true, 'stage', 'database', 'idempotent', true);
  end if;

  if v_row.request_kind = 'consent_withdrawal' then
    perform private.purge_shared_contributions(v_row.user_id);
  else
    perform private.purge_user_data(v_row.user_id);
  end if;

  update private.deletion_requests
     set database_completed = true,
         stage = case
           when request_kind = 'consent_withdrawal' then 'complete'
           else 'auth'
         end,
         completed_at = case
           when request_kind = 'consent_withdrawal' then now()
           else null
         end,
         last_error = null
   where id = p_request_id;

  return jsonb_build_object(
    'ok', true,
    'stage', case when v_row.request_kind = 'consent_withdrawal' then 'complete' else 'auth' end
  );
end;
$$;

revoke all on function public.service_complete_deletion_database(uuid)
  from public, anon, authenticated;
grant execute on function public.service_complete_deletion_database(uuid)
  to service_role;

$guest_source_20261003001000$]);
end if; end $apply_20261003001000$;

do $apply_20261003002000$ begin
if not exists (select 1 from supabase_migrations.schema_migrations where version='20261003002000') then
execute $guest_source_20261003002000$-- C9: withdrawal is reported before stale consent, which withdrawal clears.
-- Preserve every authorization requirement; no permission is broadened.
create or replace function private.assert_review_eligibility(p_user_id uuid)
returns void
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_config public.app_config;
begin
  if p_user_id is null then
    raise exception 'sign_in_required' using errcode = '42501';
  end if;

  select * into v_profile from public.profiles where user_id = p_user_id;
  if not found then
    raise exception 'consent_required' using errcode = '42501';
  end if;

  select * into v_config from public.app_config where id = 1;

  if v_profile.startup_consent_version is distinct from v_config.startup_consent_version
     or v_profile.startup_terms_accepted_at is null
     or v_profile.startup_privacy_accepted_at is null then
    raise exception 'startup_consent_required' using errcode = '42501';
  end if;

  if v_profile.consent_withdrawn_at is not null
     or v_profile.deletion_requested_at is not null
     or v_profile.deletion_due_at is not null then
    raise exception 'deletion_pending' using errcode = '42501';
  end if;

  if exists (
    select 1 from private.deletion_requests d
     where d.user_id = p_user_id
       and d.completed_at is null
  ) then
    raise exception 'deletion_pending' using errcode = '42501';
  end if;

  if v_profile.consent_version is distinct from v_config.contribution_consent_version
     or v_profile.consented_at is null
     or v_profile.age_confirmed_at is null then
    raise exception 'consent_outdated' using errcode = '42501';
  end if;

  if not v_config.contribution_text_enabled then
    raise exception 'flag_disabled' using errcode = '42501';
  end if;
end;
$$;
$guest_source_20261003002000$;
insert into supabase_migrations.schema_migrations(version,name,statements) values ('20261003002000','guest_withdrawal_eligibility',array[$guest_source_20261003002000$-- C9: withdrawal is reported before stale consent, which withdrawal clears.
-- Preserve every authorization requirement; no permission is broadened.
create or replace function private.assert_review_eligibility(p_user_id uuid)
returns void
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_config public.app_config;
begin
  if p_user_id is null then
    raise exception 'sign_in_required' using errcode = '42501';
  end if;

  select * into v_profile from public.profiles where user_id = p_user_id;
  if not found then
    raise exception 'consent_required' using errcode = '42501';
  end if;

  select * into v_config from public.app_config where id = 1;

  if v_profile.startup_consent_version is distinct from v_config.startup_consent_version
     or v_profile.startup_terms_accepted_at is null
     or v_profile.startup_privacy_accepted_at is null then
    raise exception 'startup_consent_required' using errcode = '42501';
  end if;

  if v_profile.consent_withdrawn_at is not null
     or v_profile.deletion_requested_at is not null
     or v_profile.deletion_due_at is not null then
    raise exception 'deletion_pending' using errcode = '42501';
  end if;

  if exists (
    select 1 from private.deletion_requests d
     where d.user_id = p_user_id
       and d.completed_at is null
  ) then
    raise exception 'deletion_pending' using errcode = '42501';
  end if;

  if v_profile.consent_version is distinct from v_config.contribution_consent_version
     or v_profile.consented_at is null
     or v_profile.age_confirmed_at is null then
    raise exception 'consent_outdated' using errcode = '42501';
  end if;

  if not v_config.contribution_text_enabled then
    raise exception 'flag_disabled' using errcode = '42501';
  end if;
end;
$$;
$guest_source_20261003002000$]);
end if; end $apply_20261003002000$;

select jsonb_build_object('sharing',(select contribution_consent_version from public.app_config where id=1),'startup',(select startup_consent_version from public.app_config where id=1),'guest_deletion',to_regprocedure('public.request_shared_data_deletion()')::text,'ssv_receipt',to_regprocedure('public.rewarded_session_verified(text)')::text,'sample_progress',to_regclass('public.sample_allotment_events')::text,'applied_guest_versions',(select count(*) from supabase_migrations.schema_migrations where version>='20261003000000')) as deployment_result;
commit;
