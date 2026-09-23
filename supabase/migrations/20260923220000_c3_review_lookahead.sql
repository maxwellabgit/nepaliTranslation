-- C3: private 14/28-day lookahead is the review queue.
-- Public review stays off until 14 future planned or open New York days exist.
-- Opening a public window promotes the planned day when one exists.
-- Credits are snapshotted from the original word count (2 if <=20, 4 if >=21).
-- Forward-only. Does not rewrite historical windows.

alter table public.app_config
  add column if not exists public_review_enabled boolean not null default false;

do $$
declare
  r record;
begin
  for r in
    select conname
      from pg_constraint
     where contype = 'c'
       and conrelid = 'public.review_windows'::regclass
       and pg_get_constraintdef(oid) ilike '%state%'
  loop
    execute format(
      'alter table public.review_windows drop constraint %I',
      r.conname
    );
  end loop;
end $$;

alter table public.review_windows
  add constraint review_windows_state_check
  check (state in ('planned', 'open', 'closed', 'granted'));

create table if not exists private.review_selection_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  as_of timestamptz not null,
  seed text not null,
  horizon_days integer not null,
  planned_days integer not null,
  public_review_enabled boolean not null,
  note text
);

create table if not exists private.review_queue_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references private.review_selection_runs (id),
  window_id uuid,
  event_type text not null,
  created_at timestamptz not null default now()
);

revoke all on table private.review_selection_runs from public, anon, authenticated;
revoke all on table private.review_queue_events from public, anon, authenticated;
grant all on table private.review_selection_runs to service_role;
grant all on table private.review_queue_events to service_role;

create or replace function public.service_plan_review_lookahead(
  p_as_of timestamptz default now(),
  p_horizon integer default 28,
  p_min_enable integer default 14
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run uuid;
  v_seed text;
  v_cursor timestamptz;
  v_close timestamptz;
  v_days integer := 0;
  v_appended integer := 0;
  v_window uuid;
  v_inserted integer;
  v_future integer;
  v_enabled boolean;
begin
  if p_horizon is null or p_horizon < 1 or p_min_enable is null or p_min_enable < 1 then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  if not pg_try_advisory_xact_lock(hashtext('c3_review_lookahead')) then
    return jsonb_build_object('status', 'busy');
  end if;

  v_seed := 'lookahead:' || to_char(p_as_of at time zone 'UTC', 'YYYYMMDDHH24MISS');
  v_cursor := p_as_of;

  while v_days < p_horizon loop
    v_close := private.next_review_close(v_cursor);
    if exists (
      select 1 from public.review_windows where ny_close_at = v_close
    ) then
      v_days := v_days + 1;
      v_cursor := v_close;
      continue;
    end if;

    insert into public.review_windows (ny_close_at, state, size, opened_at)
    values (v_close, 'planned', 10, p_as_of)
    returning id into v_window;

    insert into public.review_window_items (
      window_id, slot, source_item_id, length_tier_snapshot,
      scheduled_credits, original_source_word_count
    )
    select
      v_window,
      (row_number() over ())::smallint,
      picked.id,
      1::smallint,
      private.scheduled_credits_for_words(private.count_source_words(picked.source_text)),
      private.count_source_words(picked.source_text)
    from (
      select s.id, s.source_text
        from private.review_source_items s
       where private.count_source_words(s.source_text) > 0
         and private.review_public_eligible(
           s.public_review_eligible,
           s.rights_status,
           s.origin_class,
           s.anonymization_status,
           s.substantively_reviewed,
           s.quarantined,
           exists (
             select 1
               from public.review_window_items i
               join public.review_windows w on w.id = i.window_id
              where i.source_item_id = s.id
                and w.state in ('planned', 'open')
           ),
           exists (
             select 1 from public.review_exclusions e
              where e.content_hash = s.content_hash
           )
         )
       order by s.imported_at asc, md5(v_seed || s.id::text)
       limit 10
    ) picked;

    get diagnostics v_inserted = row_count;
    if v_inserted = 0 then
      delete from public.review_windows where id = v_window;
      exit;
    end if;

    update public.review_windows
       set size = v_inserted
     where id = v_window;

    update private.review_source_items s
       set times_assigned = times_assigned + 1,
           last_assigned_at = p_as_of
      from public.review_window_items i
     where i.window_id = v_window
       and i.source_item_id = s.id;

    v_appended := v_appended + 1;
    v_days := v_days + 1;
    v_cursor := v_close;
  end loop;

  select count(*)::int into v_future
    from public.review_windows
   where state in ('planned', 'open')
     and ny_close_at > p_as_of;

  v_enabled := v_future >= p_min_enable;
  if v_enabled then
    update public.app_config
       set public_review_enabled = true,
           updated_at = now()
     where id = 1
       and public_review_enabled is distinct from true;
  end if;

  select public_review_enabled into v_enabled
    from public.app_config
   where id = 1;

  insert into private.review_selection_runs (
    as_of, seed, horizon_days, planned_days, public_review_enabled, note
  ) values (
    p_as_of, v_seed, v_future, v_appended, coalesce(v_enabled, false),
    'append-only lookahead'
  )
  returning id into v_run;

  insert into private.review_queue_events (run_id, event_type)
  values (v_run, 'lookahead_planned');

  return jsonb_build_object(
    'status', 'ok',
    'run_id', v_run,
    'appended_days', v_appended,
    'future_days', v_future,
    'public_review_enabled', coalesce(v_enabled, false)
  );
end;
$$;

revoke all on function public.service_plan_review_lookahead(timestamptz, integer, integer)
  from public, anon, authenticated;
grant execute on function public.service_plan_review_lookahead(timestamptz, integer, integer)
  to service_role;

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
      select distinct source_item_id
        from public.review_submissions
       where window_id = v_prior.id
         and action = 'report'
         and admin_status <> 'unsatisfactory'
    ),
    upd as (
      update private.review_source_items s
         set public_review_eligible = false,
             quarantined = true,
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

    for rec in
      select s.id as submission_id,
             s.user_id as user_id,
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
        'review_submission:' || rec.submission_id::text || ':window_close',
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
