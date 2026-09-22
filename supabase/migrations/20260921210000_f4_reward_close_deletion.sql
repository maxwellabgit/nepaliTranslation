-- F4: 5 PM America/New_York reward close, word-count credits, 30-day deletion jobs.

-- ---------------------------------------------------------------------------
-- Config + receipt / submission columns
-- ---------------------------------------------------------------------------

alter table public.app_config
  add column if not exists deletion_processing_enabled boolean not null default false;

alter table public.profiles
  add column if not exists deletion_purged_at timestamptz;

alter table public.contribution_receipts
  add column if not exists original_word_count integer,
  add column if not exists source_snapshot text,
  add column if not exists scheduled_credits integer not null default 0,
  add column if not exists reward_eligible boolean not null default true,
  add column if not exists reward_granted_at timestamptz;

alter table private.submissions
  add column if not exists original_word_count integer,
  add column if not exists source_snapshot text;

create table if not exists private.contributor_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  receipt_id uuid references public.contribution_receipts (id) on delete set null,
  alert_type text not null,
  message text,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz
);

revoke all on table private.contributor_alerts from public, anon, authenticated;
grant all on table private.contributor_alerts to service_role;

-- ---------------------------------------------------------------------------
-- Word count + NY reward window (DST via IANA zone)
-- ---------------------------------------------------------------------------

create or replace function private.count_source_words(p_text text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (
      select count(*)::integer
      from regexp_split_to_table(coalesce(btrim(p_text), ''), '\s+') as w(word)
      where word <> ''
    ),
    0
  );
$$;

create or replace function private.scheduled_credits_for_words(p_word_count integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when coalesce(p_word_count, 0) > 20 then 2 else 1 end;
$$;

-- Close boundary for the NY reward window containing p_ts (daily close at 17:00).
create or replace function private.ny_reward_window_close(p_ts timestamptz)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  v_local timestamp;
  v_close_date date;
begin
  v_local := (p_ts at time zone 'America/New_York');
  v_close_date := v_local::date;
  if v_local::time >= time '17:00' then
    v_close_date := v_close_date + 1;
  end if;
  return (v_close_date + time '17:00') at time zone 'America/New_York';
end;
$$;

revoke all on function private.count_source_words(text) from public, anon, authenticated;
revoke all on function private.scheduled_credits_for_words(integer) from public, anon, authenticated;
revoke all on function private.ny_reward_window_close(timestamptz) from public, anon, authenticated;
grant execute on function private.count_source_words(text) to service_role;
grant execute on function private.scheduled_credits_for_words(integer) to service_role;
grant execute on function private.ny_reward_window_close(timestamptz) to service_role;

create or replace function public.service_ny_reward_window_close(p_ts timestamptz)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select private.ny_reward_window_close(p_ts);
$$;

revoke all on function public.service_ny_reward_window_close(timestamptz)
  from public, anon;
grant execute on function public.service_ny_reward_window_close(timestamptz)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Reward schedule: rewarded video = 15 ad-free minutes (3 credits @ 5 min each)
-- Contribution kinds defer to word-count scheduling at close.
-- ---------------------------------------------------------------------------

create or replace function private.reward_schedule(p_kind text)
returns table (credits integer, minutes integer)
language sql
immutable
set search_path = ''
as $$
  select s.credits, s.minutes
  from (
    values
      ('known_check'::text, 1::integer, 5::integer),
      ('unknown_confirm'::text, 1::integer, 5::integer),
      ('unknown_correction'::text, 1::integer, 5::integer),
      ('admin_difficult'::text, 2::integer, 10::integer),
      ('rewarded_video'::text, 3::integer, 15::integer)
  ) as s(kind, credits, minutes)
  where s.kind = p_kind;
$$;

-- ---------------------------------------------------------------------------
-- Block contributions while deletion is pending
-- ---------------------------------------------------------------------------

create or replace function private.assert_contribution_consent_core(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version text;
  v_consented text;
  v_age timestamptz;
  v_deletion timestamptz;
begin
  select deletion_requested_at into v_deletion
  from public.profiles
  where user_id = p_user_id;

  if v_deletion is not null then
    raise exception 'deletion_pending' using errcode = 'P0001';
  end if;

  select contribution_consent_version into v_version
  from public.app_config
  where id = 1;

  select consent_version, age_confirmed_at
  into v_consented, v_age
  from public.profiles
  where user_id = p_user_id;

  if v_consented is null or btrim(v_consented) = '' then
    raise exception 'consent_required' using errcode = 'P0001';
  end if;
  if v_age is null then
    raise exception 'age_required' using errcode = 'P0001';
  end if;
  if v_consented is distinct from v_version then
    raise exception 'consent_outdated' using errcode = 'P0001';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Daily NY close batch — pending/validated at close grant once
-- ---------------------------------------------------------------------------

create or replace function public.service_close_ny_reward_window(
  p_as_of timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec record;
  v_reward jsonb;
  v_granted integer := 0;
  v_applied integer := 0;
begin
  for rec in
    select r.*
    from public.contribution_receipts r
    where r.reward_granted_at is null
      and r.reward_eligible = true
      and r.status in ('pending', 'validated')
      and r.scheduled_credits > 0
      and private.ny_reward_window_close(r.submitted_at) <= p_as_of
    order by r.submitted_at
    for update
  loop
    v_granted := v_granted + 1;
    v_reward := private.apply_reward(
      rec.user_id,
      'contribution',
      'receipt:' || rec.id::text,
      rec.scheduled_credits,
      rec.scheduled_credits * 5
    );

    update public.contribution_receipts
    set
      reward_granted_at = p_as_of,
      credits_awarded = case
        when coalesce((v_reward ->> 'applied')::boolean, false) then rec.scheduled_credits
        else credits_awarded
      end,
      ledger_id = coalesce(nullif(v_reward ->> 'ledger_id', '')::uuid, ledger_id),
      status = case when status = 'pending' then 'validated' else status end,
      resolved_at = coalesce(resolved_at, p_as_of)
    where id = rec.id;

    if coalesce((v_reward ->> 'applied')::boolean, false) then
      v_applied := v_applied + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'closed_at', p_as_of,
    'eligible', v_granted,
    'applied', v_applied
  );
end;
$$;

revoke all on function public.service_close_ny_reward_window(timestamptz)
  from public, anon, authenticated;
grant execute on function public.service_close_ny_reward_window(timestamptz) to service_role;

-- Late reject after grant: alert only, no clawback.
create or replace function public.service_late_reject_receipt(
  p_receipt_id uuid,
  p_reason text default 'late_reject'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.contribution_receipts%rowtype;
begin
  if p_receipt_id is null then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  select * into rec
  from public.contribution_receipts
  where id = p_receipt_id
  for update;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if rec.reward_granted_at is null then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  insert into private.contributor_alerts (user_id, receipt_id, alert_type, message)
  values (
    rec.user_id,
    rec.id,
    'late_reject',
    coalesce(nullif(btrim(p_reason), ''), 'late_reject')
  );

  update public.contribution_receipts
  set
    status = 'rejected',
    reason_code = coalesce(nullif(btrim(p_reason), ''), 'late_reject'),
    resolved_at = coalesce(resolved_at, now())
  where id = rec.id;

  insert into private.audit_log (actor_id, action, target, reason)
  values (rec.user_id, 'late_reject_alert', rec.id::text, p_reason);

  return jsonb_build_object('alerted', true, 'receipt_id', rec.id);
end;
$$;

revoke all on function public.service_late_reject_receipt(uuid, text)
  from public, anon, authenticated;
grant execute on function public.service_late_reject_receipt(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 30-day deletion request + purge job
-- ---------------------------------------------------------------------------

create or replace function public.service_request_account_deletion(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_due timestamptz;
begin
  if p_user_id is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  v_due := now() + interval '30 days';

  update public.profiles
  set
    deletion_requested_at = coalesce(deletion_requested_at, now()),
    deletion_due_at = coalesce(deletion_due_at, v_due),
    consent_withdrawn_at = coalesce(consent_withdrawn_at, now()),
    updated_at = now()
  where user_id = p_user_id;

  update public.contribution_media
  set status = 'pending_delete'
  where user_id = p_user_id
    and status in ('uploaded', 'pending_upload');

  insert into private.audit_log (actor_id, action, target, reason)
  values (
    p_user_id,
    'deletion_requested_admin',
    p_user_id::text,
    '30-day deletion scheduled; uploads disabled'
  );

  return jsonb_build_object(
    'deletion_requested_at', now(),
    'deletion_due_at', v_due
  );
end;
$$;

revoke all on function public.service_request_account_deletion(uuid)
  from public, anon, authenticated;
grant execute on function public.service_request_account_deletion(uuid) to service_role;

create or replace function public.service_process_deletion_jobs(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec record;
  v_processed integer := 0;
begin
  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  for rec in
    select p.user_id
    from public.profiles p
    where p.deletion_requested_at is not null
      and p.deletion_due_at is not null
      and p.deletion_due_at <= now()
      and p.deletion_purged_at is null
    order by p.deletion_due_at
    limit p_limit
    for update
  loop
    perform private.purge_user_data(rec.user_id);
    v_processed := v_processed + 1;
  end loop;

  return jsonb_build_object('processed', v_processed);
end;
$$;

revoke all on function public.service_process_deletion_jobs(integer)
  from public, anon, authenticated;
grant execute on function public.service_process_deletion_jobs(integer) to service_role;

create or replace function public.service_deletion_processing_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(deletion_processing_enabled, false)
  from public.app_config
  where id = 1;
$$;

revoke all on function public.service_deletion_processing_enabled()
  from public, anon, authenticated;
grant execute on function public.service_deletion_processing_enabled() to service_role;

-- ---------------------------------------------------------------------------
-- Opaque task label + atomic submit (defer grants to NY close)
-- ---------------------------------------------------------------------------

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
    'reward_label', 'Earn 1–2 credits after daily close (5 PM New York)'
  )
  from private.contribution_tasks t
  where t.id = p_task_id;
$$;

create or replace function public.service_submit_contribution_atomic(
  p_user_id uuid,
  p_assignment_id uuid,
  p_action text,
  p_response_text text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment private.task_assignments%rowtype;
  v_task private.contribution_tasks%rowtype;
  v_band text;
  v_refs text[];
  v_raw text;
  v_normalized text;
  v_model_sim numeric;
  v_decision text := 'pending';
  v_known_pass boolean := false;
  v_submission_id uuid;
  v_receipt_id uuid;
  v_existing_receipt public.contribution_receipts%rowtype;
  v_consensus jsonb;
  v_status text;
  v_winner text;
  v_vote jsonb;
  v_word_count integer;
  v_scheduled_credits integer;
  v_source_snapshot text;
  REWARD_LABEL constant text := 'Earn 1–2 credits after daily close (5 PM New York)';
begin
  if p_user_id is null or p_assignment_id is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if p_action is null or p_action not in ('looks_correct', 'edit', 'skip', 'report_task') then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  if not private.check_rate_limit('submit:' || p_user_id::text, 60, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  perform private.assert_contribution_consent(p_user_id);

  select * into v_existing_receipt
  from public.contribution_receipts
  where user_id = p_user_id
    and idempotency_key = p_idempotency_key
  limit 1;
  if found then
    return jsonb_build_object(
      'receipt_id', v_existing_receipt.id,
      'status', 'received',
      'reward_label', REWARD_LABEL,
      'reward', null,
      'replay', true
    );
  end if;

  select * into v_assignment
  from private.task_assignments
  where id = p_assignment_id
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select * into v_task
  from private.contribution_tasks
  where id = v_assignment.task_id
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if v_assignment.user_id is distinct from p_user_id then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_assignment.completed_at is not null then
    select * into v_existing_receipt
    from public.contribution_receipts
    where assignment_id = p_assignment_id
      and user_id = p_user_id
    order by submitted_at desc
    limit 1;
    if found then
      return jsonb_build_object(
        'receipt_id', v_existing_receipt.id,
        'status', 'received',
        'reward_label', REWARD_LABEL,
        'reward', null,
        'replay', true
      );
    end if;
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_assignment.leased_until < now() then
    raise exception 'lease_expired' using errcode = 'P0001';
  end if;

  v_source_snapshot := v_task.source_text;
  v_word_count := private.count_source_words(v_task.source_text);
  v_scheduled_credits := private.scheduled_credits_for_words(v_word_count);

  v_raw := btrim(coalesce(p_response_text, ''));
  if p_action = 'looks_correct' then
    v_normalized := private.normalize_for_score(v_task.model_output);
    v_raw := coalesce(nullif(v_raw, ''), v_task.model_output);
  elsif p_action in ('skip', 'report_task') then
    v_normalized := '';
  else
    if v_raw = '' then
      raise exception 'invalid_payload' using errcode = '22023';
    end if;
    v_normalized := private.normalize_for_score(v_raw);
  end if;

  v_model_sim := private.similarity(v_normalized, v_task.model_output);

  select coalesce(cs.state, 'normal') into v_band
  from private.contributor_stats cs
  where cs.user_id = p_user_id;
  if v_band is null then
    v_band := 'normal';
  end if;

  if v_task.task_type = 'known_check'
     and p_action in ('looks_correct', 'edit') then
    select coalesce(array_agg(kr.normalized_text order by kr.id), '{}')
    into v_refs
    from private.known_references kr
    where kr.reference_set_id = v_task.reference_set_id;

    if v_model_sim is null
       or char_length(v_normalized) > 500 then
      v_decision := 'pending';
      v_known_pass := false;
    else
      v_known_pass := private.known_check_passes(v_normalized, v_refs);
      v_decision := case when v_known_pass then 'known_pass' else 'known_fail' end;
    end if;
  end if;

  insert into private.submissions (
    assignment_id, user_id, action, raw_response, normalized_response,
    model_similarity, decision_status, original_word_count, source_snapshot
  ) values (
    p_assignment_id, p_user_id, p_action,
    case when p_action in ('skip', 'report_task') then null else v_raw end,
    case when p_action in ('skip', 'report_task') then null else v_normalized end,
    v_model_sim, v_decision, v_word_count, v_source_snapshot
  )
  returning id into v_submission_id;

  update private.task_assignments
  set completed_at = now(), client_nonce = p_idempotency_key
  where id = p_assignment_id;

  insert into public.contribution_receipts (
    user_id, public_task_id, status, credits_awarded,
    assignment_id, submission_id, idempotency_key, reason_code,
    original_word_count, source_snapshot, scheduled_credits, reward_eligible
  ) values (
    p_user_id, v_task.id, 'pending', 0,
    p_assignment_id, v_submission_id, p_idempotency_key, null,
    v_word_count, v_source_snapshot, v_scheduled_credits, true
  )
  returning id into v_receipt_id;

  if v_task.task_type = 'known_check'
     and p_action in ('looks_correct', 'edit')
     and v_decision in ('known_pass', 'known_fail') then
    insert into private.contributor_stats (user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;

    update private.contributor_stats
    set
      known_attempts = known_attempts + 1,
      known_passes = known_passes + case when v_known_pass then 1 else 0 end,
      reliability = least(
        0.95,
        greatest(
          0.2,
          (known_passes + case when v_known_pass then 1 else 0 end)::numeric
          / nullif(known_attempts + 1, 0)
        )
      ),
      state = case
        when (known_passes + case when v_known_pass then 1 else 0 end)::numeric
             / nullif(known_attempts + 1, 0) < 0.4
        then 'probation'
        else state
      end
    where user_id = p_user_id;

    if v_known_pass then
      update public.contribution_receipts
      set
        status = 'validated',
        reward_eligible = true,
        resolved_at = now(),
        reason_code = 'known_pass'
      where id = v_receipt_id;
    else
      update public.contribution_receipts
      set
        status = 'rejected',
        reward_eligible = false,
        scheduled_credits = 0,
        resolved_at = now(),
        reason_code = 'known_fail'
      where id = v_receipt_id;
    end if;

  elsif v_task.task_type = 'unknown'
        and p_action in ('looks_correct', 'edit') then
    v_consensus := private.resolve_task_consensus(v_task.id);
    v_status := v_consensus ->> 'status';

    if v_status = 'disputed' then
      update private.contribution_tasks
      set state = 'disputed'
      where id = v_task.id;
      update public.contribution_receipts r
      set
        status = 'disputed',
        reward_eligible = false,
        scheduled_credits = 0,
        resolved_at = now(),
        reason_code = 'disputed'
      from private.submissions s
      join private.task_assignments a on a.id = s.assignment_id
      where r.submission_id = s.id
        and a.task_id = v_task.id
        and r.status = 'pending';

    elsif v_status = 'resolved' and (v_consensus ->> 'reward_eligible')::boolean then
      v_winner := v_consensus ->> 'winner';
      update private.contribution_tasks
      set state = 'resolved'
      where id = v_task.id;

      for v_vote in
        select e
        from jsonb_array_elements(coalesce(v_consensus -> 'votes', '[]'::jsonb)) e
      loop
        if (v_vote ->> 'band') is distinct from 'normal' then
          continue;
        end if;
        if not private.responses_agree(v_vote ->> 'normalized_response', v_winner) then
          continue;
        end if;

        update public.contribution_receipts
        set
          status = 'validated',
          reward_eligible = true,
          resolved_at = coalesce(resolved_at, now()),
          reason_code = case
            when (v_vote ->> 'action') = 'edit' then 'unknown_correction'
            else 'unknown_confirm'
          end
        where submission_id = (v_vote ->> 'submission_id')::uuid;
      end loop;

      update public.contribution_receipts r
      set
        status = 'rejected',
        reward_eligible = false,
        scheduled_credits = 0,
        resolved_at = now(),
        reason_code = 'consensus_mismatch'
      from private.submissions s
      join private.task_assignments a on a.id = s.assignment_id
      where r.submission_id = s.id
        and a.task_id = v_task.id
        and r.status = 'pending';
    end if;
  elsif p_action in ('skip', 'report_task') then
    update public.contribution_receipts
    set
      status = 'dismissed',
      reward_eligible = false,
      scheduled_credits = 0,
      resolved_at = now(),
      reason_code = p_action
    where id = v_receipt_id;
  end if;

  return jsonb_build_object(
    'receipt_id', v_receipt_id,
    'status', 'received',
    'reward_label', REWARD_LABEL,
    'reward', null
  );
end;
$$;

revoke all on function public.service_submit_contribution_atomic(
  uuid, uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.service_submit_contribution_atomic(
  uuid, uuid, text, text, text
) to service_role;
