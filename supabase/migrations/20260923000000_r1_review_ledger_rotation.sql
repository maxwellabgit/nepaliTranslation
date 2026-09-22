-- R1: repair reward-ledger idempotency, 5 PM NY rotation ownership, DST, and
--     exactly-once close/grant. Forward-only. Do NOT edit the earlier
--     migrations that produced deployed schema.
--
-- Repairs identified by the 2026-09-22 external audit at 71c85df:
--   1. `private.apply_reward` in 20260922100500_g1_credit_ratio_15_minutes.sql
--      uses `on conflict (source_type, source_id)` and looks up prior
--      grants on the same two-column pair. That unique constraint was
--      dropped in 20260920200000_h3_atomic_consensus.sql and replaced with
--      `(user_id, source_type, source_id)`. Every pgTAP suite that calls
--      apply_reward fails with SQLSTATE 42P10 "no unique or exclusion
--      constraint matching the ON CONFLICT specification". Repair here
--      routes both the lookup and the ON CONFLICT clause through the
--      three-column identity so two different users can be rewarded for
--      the same source item, and the same user cannot be rewarded twice
--      for the same (source_type, source_id).
--   2. `public.service_rotate_review_window` in the G1 pool migration
--      inserts directly into `public.reward_ledger` at close. Rule from
--      the R1 runbook: only `private.apply_reward` mutates both the
--      immutable ledger and `earned_entitlements`. Repair here calls
--      apply_reward once per eligible submission. `earned_ad_free_until`
--      now advances by (credits * 15) minutes at close, previously
--      neglected.
--   3. Rotation was not idempotent-safe. Repairs:
--        * `p_as_of timestamptz default now()` argument so tests can
--          inject boundary times.
--        * `pg_try_advisory_xact_lock('review_rotation')` — one caller
--          owns the transaction; concurrent callers return `{status:
--          'busy'}` without mutation.
--        * `not_due`: if an open window has `ny_close_at > p_as_of`,
--          return `{status: 'not_due', ...}` with no mutation.
--        * Empty/under-N pool: the window still opens with the actual
--          count, marks `warning: 'pool_short'`, and never duplicates.
--   4. `skip` and `report` earn no credit automatically. `report` marks
--      the reviewed item ineligible for future public windows.
--      `confirm` and `edit` are the only reward-eligible actions.
--   5. Deterministic per-window tier snapshot: order the selected items
--      by `source_char_length DESC, source_item_id ASC` and grant 2
--      credits (30 min) to the first ceil(N/2), 1 credit (15 min) to the
--      rest. This replaces the pool-wide percent_rank fallback for
--      snapshot values, so two rotations of the same pool always
--      produce the same per-window credit distribution.
--
-- Behavioural change vs prior deployment
--   * `apply_reward` idempotency key is now (user_id, source_type, source_id).
--     Two users can receive credit for the same public-review source; a
--     replay of the same (user_id, source_type, source_id) is idempotent.
--   * Rotation calls apply_reward per submission, so earned_ad_free_until
--     advances at close by the correct number of minutes.
--   * skip/report earn zero. report quarantines the source item.
--   * Rotation is safe under retry and concurrency.

-- ---------------------------------------------------------------------------
-- 1. apply_reward: correct ON CONFLICT and lookup target
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

  -- G0 amendment: 1 credit = 15 minutes, regardless of caller-supplied p_minutes.
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

  -- Idempotent replay: same (user_id, source_type, source_id) → duplicate.
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

-- ---------------------------------------------------------------------------
-- 2. Per-window deterministic tier snapshot (order by char length DESC, id ASC).
-- ---------------------------------------------------------------------------

create or replace function private.select_review_window_items(p_size smallint)
returns table (source_item_id uuid, length_tier_snapshot smallint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_top_count integer;
begin
  return query
  with picked as (
    select id, source_char_length
      from private.review_source_items
     where public_review_eligible = true
     order by times_assigned asc, random()
     limit p_size
  ), ranked as (
    select
      id,
      row_number() over (order by source_char_length desc, id asc) as rnk,
      count(*) over ()                                              as total
    from picked
  )
  select
    id,
    case
      when rnk <= greatest(1, ceil(total::numeric / 2))::integer then 2::smallint
      else 1::smallint
    end
  from ranked;
end;
$$;

revoke all on function private.select_review_window_items(smallint) from public, anon, authenticated;
grant execute on function private.select_review_window_items(smallint) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Rotation: p_as_of, advisory lock, not_due, exactly-once, apply_reward only.
-- ---------------------------------------------------------------------------

-- The G1 migration created service_rotate_review_window(smallint). R1
-- consolidates to a single (p_size, p_as_of) signature with defaults so
-- existing callers (`service_rotate_review_window(10::smallint)`) keep
-- working without ambiguous-overload resolution errors.
drop function if exists public.service_rotate_review_window(smallint);

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
  rec record;
  v_apply jsonb;
begin
  if p_size is null or p_size <= 0 then
    raise exception 'invalid_size' using errcode = '22023';
  end if;

  -- Single-owner semantics. Concurrent invocations exit cleanly without
  -- mutating state; scheduled_jobs surfaces this as busy, not failure.
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

    -- Report actions quarantine the source item pending admin review.
    with reported as (
      select distinct source_item_id
        from public.review_submissions
       where window_id = v_prior.id
         and action = 'report'
         and admin_status <> 'unsatisfactory'
    ),
    upd as (
      update private.review_source_items s
         set public_review_eligible = false,
             metadata = coalesce(s.metadata, '{}'::jsonb)
                        || jsonb_build_object(
                             'quarantined_at', p_as_of,
                             'quarantined_from_window', v_prior.id
                           )
        from reported r
       where s.id = r.source_item_id
       returning s.id
    )
    select count(*)::int into v_report_quarantined from upd;

    -- Grant credits ONLY for confirm/edit and only when admin has not
    -- pre-marked the submission unsatisfactory. skip and report grant 0.
    -- Route through private.apply_reward so earned_entitlements advances
    -- consistently. Retry is safe: apply_reward is idempotent on
    -- (user_id, source_type, source_id).
    for rec in
      select s.id           as submission_id,
             s.user_id      as user_id,
             s.scheduled_credits as scheduled_credits
        from public.review_submissions s
       where s.window_id = v_prior.id
         and s.reward_granted = false
         and s.admin_status <> 'unsatisfactory'
         and s.action in ('confirm', 'edit')
       order by s.submitted_at, s.id
    loop
      v_apply := private.apply_reward(
        rec.user_id,
        'public_review',
        rec.submission_id::text,
        rec.scheduled_credits,
        rec.scheduled_credits * 15
      );

      update public.review_submissions
         set reward_granted = true,
             reward_granted_at = p_as_of
       where id = rec.submission_id;

      if coalesce((v_apply ->> 'applied')::boolean, false) then
        v_granted_applied := v_granted_applied + 1;
      elsif (v_apply ->> 'reason') = 'duplicate' then
        v_granted_dup := v_granted_dup + 1;
      end if;
    end loop;

    update public.review_windows
       set state = 'granted', granted_at = p_as_of
     where id = v_prior.id;
  end if;

  -- Open the next window. Uses p_as_of so tests can drive rotations near
  -- boundary times without freezing the clock.
  v_next_close := private.next_review_close(p_as_of);
  insert into public.review_windows (ny_close_at, state, size, opened_at)
    values (v_next_close, 'open', p_size, p_as_of)
    returning id into v_new_id;

  insert into public.review_window_items (window_id, slot, source_item_id, length_tier_snapshot, scheduled_credits)
  select
    v_new_id,
    (row_number() over ())::smallint,
    sel.source_item_id,
    sel.length_tier_snapshot,
    case when sel.length_tier_snapshot = 2 then 2 else 1 end
  from private.select_review_window_items(p_size) sel;

  get diagnostics v_inserted = row_count;
  v_short := v_inserted < p_size;

  update private.review_source_items s
     set times_assigned = times_assigned + 1,
         last_assigned_at = p_as_of
    from public.review_window_items i
   where i.window_id = v_new_id
     and i.source_item_id = s.id;

  return jsonb_build_object(
    'status', case when v_short then 'ok_pool_short' else 'ok' end,
    'closed_window_id', v_prior.id,
    'granted_applied', v_granted_applied,
    'granted_duplicate', v_granted_dup,
    'granted_count', v_granted_applied + v_granted_dup,
    'reported_quarantined', v_report_quarantined,
    'new_window_id', v_new_id,
    'new_window_ny_close_at', v_next_close,
    'new_window_size', v_inserted,
    'requested_size', p_size,
    'warning', case when v_short then 'pool_short' else null end
  );
end;
$$;

revoke all on function public.service_rotate_review_window(smallint, timestamptz)
  from public, anon, authenticated;
grant execute on function public.service_rotate_review_window(smallint, timestamptz)
  to service_role;
