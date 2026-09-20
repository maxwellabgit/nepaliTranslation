-- Slice 06: daily UTC caps on reward grants (60 contribution, 12 video).

alter table private.contributor_stats
  add column if not exists video_credits_utc_day date;

alter table private.contributor_stats
  add column if not exists video_credits_today integer not null default 0;

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
  v_day date := (timezone('utc', v_now))::date;
  v_today integer;
  v_cap integer;
  v_is_video boolean;
begin
  if p_credits < 0 or p_minutes < 0 then
    raise exception 'invalid_reward' using errcode = '22023';
  end if;

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

  -- Idempotent replay must win over the daily-cap check.
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
  values (p_user_id, p_source_type, p_source_id, p_credits, p_minutes)
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
      + make_interval(mins => p_minutes),
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
    'earned_ad_free_until', v_until
  );
end;
$$;

-- Canonical schedule (Slice 06). Client never sees these amounts on submit.
create or replace function private.reward_schedule(p_kind text)
returns table (credits integer, minutes integer)
language sql
immutable
as $$
  select * from (
    values
      ('known_check', 1, 5),
      ('unknown_confirm', 3, 15),
      ('unknown_correction', 6, 30),
      ('admin_difficult', 8, 40),
      ('rewarded_video', 2, 10)
  ) as s(kind, credits, minutes)
  where kind = p_kind;
$$;

create or replace function public.service_apply_scheduled_reward(
  p_user_id uuid,
  p_kind text,
  p_source_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_credits integer;
  v_minutes integer;
  v_source_type text;
begin
  if p_user_id is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  select credits, minutes into v_credits, v_minutes
  from private.reward_schedule(p_kind);
  if v_credits is null then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  v_source_type := case
    when p_kind = 'rewarded_video' then 'rewarded_video'
    else 'contribution'
  end;
  return private.apply_reward(p_user_id, v_source_type, p_source_id, v_credits, v_minutes);
end;
$$;

revoke all on function public.service_apply_scheduled_reward(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.service_apply_scheduled_reward(uuid, text, text)
  to service_role;

-- Authenticated clients may read server time for entitlement clock sync.
create or replace function public.server_time()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select now();
$$;

revoke all on function public.server_time() from public;
grant execute on function public.server_time() to anon, authenticated, service_role;
