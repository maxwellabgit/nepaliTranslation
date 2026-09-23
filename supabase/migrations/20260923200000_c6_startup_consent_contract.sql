-- C6: startup consent is Terms and Privacy. 18+ is the contribution gate.
-- The app records age18Plus false and version 2026-09-23.startup.
-- Forward-only. The 2026-09-22.startup row in the earlier migration stays.

update public.app_config
set
  startup_consent_version = '2026-09-23.startup',
  version = version + 1,
  updated_at = now()
where id = 1;

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
     or coalesce(p_privacy_accepted, false) is not true then
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
         startup_age_confirmed_at = case
           when coalesce(p_age_confirmed, false) then v_now
           else startup_age_confirmed_at
         end,
         updated_at = v_now
   where user_id = p_user_id;

  return jsonb_build_object(
    'startup_consent_version', v_current_version,
    'accepted_at', v_now,
    'age_confirmed', coalesce(p_age_confirmed, false)
  );
end;
$$;

revoke all on function public.service_record_startup_consent(
  uuid, text, boolean, boolean, boolean
) from public, anon;
grant execute on function public.service_record_startup_consent(
  uuid, text, boolean, boolean, boolean
) to authenticated, service_role;

-- Review eligibility uses contribution 18+, not the startup age checkbox.
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

  if v_profile.consent_version is distinct from v_config.contribution_consent_version
     or v_profile.consented_at is null
     or v_profile.age_confirmed_at is null then
    raise exception 'consent_outdated' using errcode = '42501';
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

  if not v_config.contribution_text_enabled then
    raise exception 'flag_disabled' using errcode = '42501';
  end if;
end;
$$;
