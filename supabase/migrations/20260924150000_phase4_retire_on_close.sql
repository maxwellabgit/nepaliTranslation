-- Phase 4: closing a window still retires confirm, edit, and report.
-- A private lookahead does not open a public window.

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
