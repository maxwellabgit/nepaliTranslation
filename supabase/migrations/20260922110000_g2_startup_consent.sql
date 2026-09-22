-- G2: startup consent gate (T&C + Privacy Policy + 18+).
--
-- Boundary (see .governance/V1_G0_DECISIONS.md D4):
--   Every user must acknowledge Terms & Conditions, Privacy Policy, and
--   "I am 18 or older" before reaching any product surface. This is a
--   separate acknowledgement from the media-contribution consent used for
--   optional uploads (photos, speech, corrections).
--
--   Startup consent is stored client-side for guests and mirrored to
--   public.profiles for signed-in users.
--
--   All optional-service collection remains tied to user_id. Withdrawal /
--   account deletion enqueues a purge job that removes every linked row
--   and storage object within 30 days.
--
-- Startup consent version bump requires re-acknowledgement.

alter table public.profiles
  add column if not exists startup_consent_version text,
  add column if not exists startup_terms_accepted_at timestamptz,
  add column if not exists startup_privacy_accepted_at timestamptz,
  add column if not exists startup_age_confirmed_at timestamptz;

alter table public.app_config
  add column if not exists startup_consent_version text not null default '2026-09-22.startup';

update public.app_config
set
  startup_consent_version = '2026-09-22.startup',
  version = version + 1,
  updated_at = now()
where id = 1;

-- ---------------------------------------------------------------------------
-- Service RPC: record the startup gate acknowledgement.
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
begin
  if p_user_id is null then
    raise exception 'unauthorized' using errcode = '28000';
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

-- Public view for the mobile client to know the current gate version.
create or replace function public.service_current_startup_consent_version()
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select startup_consent_version from public.app_config where id = 1;
$$;

revoke all on function public.service_current_startup_consent_version() from public, anon;
grant execute on function public.service_current_startup_consent_version() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Extend the account-deletion purge to remove G1 public-review submissions
-- and contributor_alerts alongside media, ledger, and entitlements.
-- ---------------------------------------------------------------------------

create or replace function private.purge_user_data(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
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
