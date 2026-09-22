-- R4: consent authorization + withdrawal + 30-day deletion.
--
-- Forward-only. Repairs the audit's rule 1 for R4:
--
--   "Repair `service_record_startup_consent`. Do not accept an arbitrary
--    writable user ID from an authenticated caller. Derive the subject
--    from `auth.uid()` or reject when `p_user_id <> auth.uid()`."
--
-- The same defect exists in the two other consent-write RPCs deployed
-- before R4:
--   * public.service_record_consent (contribution consent) — 20260919200000
--     re-declared in 20260920200000_h3_atomic_consensus.sql
--   * public.service_record_startup_consent (startup gate) — 20260922110000
-- and in the deletion RPC:
--   * public.service_request_account_deletion (30-day purge) — 20260921210000
--
-- All four are `security definer` with grants that reach `authenticated`,
-- so any signed-in caller can invoke them with another user's uuid and
-- mutate that user's consent state or schedule their deletion. R4
-- re-declares each RPC so:
--
--   * an authenticated caller can only act on their own auth.uid();
--   * a service-role caller (auth.uid() is null) may still act on any
--     user for cron/admin workflows.
--
-- Additional R4 deliverables:
--   * Withdraw contribution consent as a distinct RPC that leaves the
--     account signed-in but disables new uploads, cancels queued media,
--     and schedules the 30-day purge.
--   * A machine-readable deletion manifest RPC that returns the exact
--     set of tables/objects a purge covers, so admin tooling can prove
--     the deletion promise on any specific user.

-- ---------------------------------------------------------------------------
-- 1. Startup consent (G2 → R4): derive subject from auth.uid()
-- ---------------------------------------------------------------------------

create or replace function public.service_record_startup_consent(
  p_user_id uuid,
  p_version text,
  p_terms_accepted boolean,
  p_privacy_accepted boolean,
  p_age_confirmed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_version text;
  v_now timestamptz := now();
  v_uid uuid := auth.uid();
begin
  if p_user_id is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  -- R4 authorization rule: an authenticated caller may only write consent
  -- for their own uid. Service-role callers (no auth.uid) may still write
  -- on behalf of a user.
  if v_uid is not null and v_uid <> p_user_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(p_terms_accepted, false) is not true
     or coalesce(p_privacy_accepted, false) is not true
     or coalesce(p_age_confirmed, false) is not true then
    raise exception 'startup_consent_incomplete' using errcode = 'P0001';
  end if;

  select startup_consent_version into v_current_version
  from public.app_config
  where id = 1;
  if v_current_version is null then
    v_current_version := p_version;
  end if;
  if coalesce(p_version, '') <> v_current_version then
    raise exception 'startup_consent_outdated' using errcode = 'P0001';
  end if;

  insert into public.profiles (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.profiles
     set startup_consent_version = v_current_version,
         startup_terms_accepted_at = v_now,
         startup_privacy_accepted_at = v_now,
         startup_age_confirmed_at = v_now,
         updated_at = v_now
   where user_id = p_user_id;

  return jsonb_build_object(
    'startup_consent_version', v_current_version,
    'accepted_at', v_now
  );
end;
$$;

revoke all on function public.service_record_startup_consent(
  uuid, text, boolean, boolean, boolean
) from public, anon;
grant execute on function public.service_record_startup_consent(
  uuid, text, boolean, boolean, boolean
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Contribution consent: same authorization rule
-- ---------------------------------------------------------------------------

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
  update public.profiles
  set
    consent_version = p_version,
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

-- ---------------------------------------------------------------------------
-- 3. Deletion request: same authorization rule + withdrawal-only variant
-- ---------------------------------------------------------------------------

create or replace function public.service_request_account_deletion(p_user_id uuid)
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
  from public, anon;
grant execute on function public.service_request_account_deletion(uuid)
  to authenticated, service_role;

-- Withdraw contribution consent without deleting the account.
-- Stops new uploads, marks any queued media for deletion, schedules a
-- 30-day linked-data purge deadline, and adds an audit log entry. Retry
-- is idempotent: existing deletion_due_at wins.
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

  v_due := now() + interval '30 days';

  update public.profiles
     set consent_withdrawn_at = coalesce(consent_withdrawn_at, now()),
         deletion_due_at = coalesce(deletion_due_at, v_due),
         updated_at = now()
   where user_id = p_user_id;

  update public.contribution_media
     set status = 'pending_delete'
   where user_id = p_user_id
     and status in ('uploaded', 'pending_upload');

  -- Adds a contributor alert so admin tooling notices the withdrawal.
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

  return jsonb_build_object(
    'consent_withdrawn_at', now(),
    'deletion_due_at', v_due
  );
end;
$$;

revoke all on function public.service_withdraw_contribution_consent(uuid)
  from public, anon;
grant execute on function public.service_withdraw_contribution_consent(uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Extend private.purge_user_data with R2 review_exclusions bookkeeping
--
-- Consent withdrawal / account deletion must also record content-hash
-- exclusions so any prior contribution stays out of future training/eval.
-- The purge itself already deletes review_submissions; we tag each
-- reviewed source_item's content_hash with reason='consent_withdrawn' or
-- 'account_deleted' so the guard in scripts/check_review_exclusions.mjs
-- also blocks re-use.
-- ---------------------------------------------------------------------------

create or replace function private.purge_user_data(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := 'account_deleted';
  v_deletion_due timestamptz;
  v_hash text;
begin
  -- Which reason should we tag exclusions with?
  select deletion_due_at
    into v_deletion_due
    from public.profiles
   where user_id = p_user_id;
  if exists (
    select 1 from public.profiles
     where user_id = p_user_id
       and consent_withdrawn_at is not null
       and deletion_due_at is not null
       and coalesce(deletion_purged_at, deletion_requested_at) is not null
  ) then
    -- withdrawal-first flow: consent was pulled before the account was
    -- deleted (or the purge is running from withdrawal).
    v_reason := 'consent_withdrawn';
  end if;

  -- Freeze each reviewed source hash the user touched.
  for v_hash in
    select distinct si.content_hash
      from public.review_submissions s
      join private.review_source_items si on si.id = s.source_item_id
     where s.user_id = p_user_id
  loop
    insert into public.review_exclusions
      (content_hash, reason, source_lineage, actor_user_id, notes)
    values (
      v_hash,
      v_reason,
      'r4:' || v_reason,
      p_user_id,
      'linked-data purge'
    )
    on conflict (content_hash, reason) do nothing;
  end loop;

  -- G1 review artifacts
  delete from public.review_submissions where user_id = p_user_id;

  -- F4 alerts
  delete from private.contributor_alerts where user_id = p_user_id;

  -- F3 media rows (storage objects removed by process-scheduled-jobs)
  delete from public.contribution_media where user_id = p_user_id;

  -- H3 consensus artifacts
  delete from private.translation_reports
   where reporter_id = p_user_id
     and status is distinct from 'accepted';

  update private.translation_reports
     set reporter_id = null
   where reporter_id = p_user_id;

  update private.contribution_tasks
     set reporter_id = null
   where reporter_id = p_user_id;

  delete from private.submissions where user_id = p_user_id;
  delete from private.task_assignments where user_id = p_user_id;

  delete from public.contribution_receipts where user_id = p_user_id;
  delete from public.reward_ledger where user_id = p_user_id;
  delete from public.earned_entitlements where user_id = p_user_id;
  delete from private.contributor_stats where user_id = p_user_id;

  -- Deletion progress bookkeeping
  delete from private.account_deletion_progress where user_id = p_user_id;

  -- Profile (last, so foreign keys stay intact until other deletions run)
  delete from public.profiles where user_id = p_user_id;

  insert into private.audit_log (actor_id, action, target, reason)
    values (p_user_id, 'delete_account', p_user_id::text, 'user requested deletion');
end;
$$;

revoke all on function private.purge_user_data(uuid) from public, anon, authenticated;
grant execute on function private.purge_user_data(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Machine-readable deletion coverage manifest
--
-- Returns the full set of database targets that `purge_user_data` covers
-- so an admin can prove the deletion promise for any specific user. The
-- manifest is derived from a static list here (kept in sync manually) and
-- annotated with the current row counts for that user.
-- ---------------------------------------------------------------------------

create or replace function public.service_user_deletion_manifest(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_targets jsonb := '[]'::jsonb;
  v_review_submissions integer;
  v_receipts integer;
  v_ledger integer;
  v_entitlements integer;
  v_media integer;
  v_alerts integer;
  v_stats integer;
  v_submissions integer;
  v_assignments integer;
  v_reports_reporter integer;
  v_deletion_progress integer;
  v_profile integer;
  v_review_exclusions integer;
begin
  if p_user_id is null then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  if v_uid is not null and v_uid <> p_user_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select count(*) into v_review_submissions from public.review_submissions where user_id = p_user_id;
  select count(*) into v_receipts from public.contribution_receipts where user_id = p_user_id;
  select count(*) into v_ledger from public.reward_ledger where user_id = p_user_id;
  select count(*) into v_entitlements from public.earned_entitlements where user_id = p_user_id;
  select count(*) into v_media from public.contribution_media where user_id = p_user_id;
  select count(*) into v_alerts from private.contributor_alerts where user_id = p_user_id;
  select count(*) into v_stats from private.contributor_stats where user_id = p_user_id;
  select count(*) into v_submissions from private.submissions where user_id = p_user_id;
  select count(*) into v_assignments from private.task_assignments where user_id = p_user_id;
  select count(*) into v_reports_reporter from private.translation_reports where reporter_id = p_user_id;
  select count(*) into v_deletion_progress from private.account_deletion_progress where user_id = p_user_id;
  select count(*) into v_profile from public.profiles where user_id = p_user_id;
  select count(distinct si.content_hash) into v_review_exclusions
    from public.review_submissions s
    join private.review_source_items si on si.id = s.source_item_id
   where s.user_id = p_user_id;

  return jsonb_build_object(
    'user_id', p_user_id,
    'generated_at', now(),
    'targets', jsonb_build_array(
      jsonb_build_object('table', 'public.review_submissions',      'action', 'delete', 'count', v_review_submissions),
      jsonb_build_object('table', 'public.contribution_receipts',   'action', 'delete', 'count', v_receipts),
      jsonb_build_object('table', 'public.reward_ledger',           'action', 'delete', 'count', v_ledger),
      jsonb_build_object('table', 'public.earned_entitlements',     'action', 'delete', 'count', v_entitlements),
      jsonb_build_object('table', 'public.contribution_media',      'action', 'delete', 'count', v_media),
      jsonb_build_object('table', 'private.contributor_alerts',     'action', 'delete', 'count', v_alerts),
      jsonb_build_object('table', 'private.contributor_stats',      'action', 'delete', 'count', v_stats),
      jsonb_build_object('table', 'private.submissions',            'action', 'delete', 'count', v_submissions),
      jsonb_build_object('table', 'private.task_assignments',       'action', 'delete', 'count', v_assignments),
      jsonb_build_object('table', 'private.translation_reports',    'action', 'unlink_reporter (accepted rows retain content, reporter_id nulled)', 'count', v_reports_reporter),
      jsonb_build_object('table', 'private.account_deletion_progress', 'action', 'delete', 'count', v_deletion_progress),
      jsonb_build_object('table', 'public.profiles',                'action', 'delete', 'count', v_profile),
      jsonb_build_object('table', 'public.review_exclusions',       'action', 'insert (content_hash, consent_withdrawn|account_deleted)', 'count', v_review_exclusions),
      jsonb_build_object('table', 'storage:private buckets',        'action', 'delete via process-scheduled-jobs (out-of-transaction)', 'count', null)
    )
  );
end;
$$;

revoke all on function public.service_user_deletion_manifest(uuid) from public, anon;
grant execute on function public.service_user_deletion_manifest(uuid)
  to authenticated, service_role;
