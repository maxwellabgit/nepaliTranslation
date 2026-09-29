-- Word-count review credits, login delivery, and a 12-hour timer cap.
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
