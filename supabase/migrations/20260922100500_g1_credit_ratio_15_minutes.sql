-- G1: align credit ratio to the amended G0 contract.
--
-- 1 credit = 15 minutes of ad-free time.
-- Rewarded video = 1 credit / 15 minutes.
-- All credit-granting code paths (F4 close, F3 known-pass, rewarded SSV, new
-- G1 public review) must reflect this ratio.
--
-- Enforcement strategy: normalize `apply_reward` so the ledger always records
-- p_minutes := p_credits * 15 regardless of caller. Existing callers still
-- pass their historical minute count; the ledger now uses the amended ratio.

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

  -- G0 amendment: 1 credit = 15 minutes.
  v_minutes := p_credits * 15;

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

  -- Idempotent replay wins over the daily-cap check.
  select id into v_ledger_id
  from public.reward_ledger
  where source_type = p_source_type and source_id = p_source_id;
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
  on conflict (source_type, source_id) do nothing
  returning id into v_inserted;

  if v_inserted is null then
    select id into v_ledger_id
    from public.reward_ledger
    where source_type = p_source_type and source_id = p_source_id;
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

-- Reward schedule: 1 credit = 15 minutes; rewarded video = 1 credit; contribution
-- kinds still keep 1/2 credit tiers per D6 length-tier rule for public review.
create or replace function private.reward_schedule(p_kind text)
returns table (credits integer, minutes integer)
language sql
immutable
set search_path = ''
as $$
  select s.credits, s.minutes
  from (
    values
      ('known_check'::text, 1::integer, 15::integer),
      ('unknown_confirm'::text, 1::integer, 15::integer),
      ('unknown_correction'::text, 1::integer, 15::integer),
      ('admin_difficult'::text, 2::integer, 30::integer),
      ('rewarded_video'::text, 1::integer, 15::integer),
      ('public_review'::text, 1::integer, 15::integer),
      ('public_review_long'::text, 2::integer, 30::integer)
  ) as s(kind, credits, minutes)
  where s.kind = p_kind;
$$;
