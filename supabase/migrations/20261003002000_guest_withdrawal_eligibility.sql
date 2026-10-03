-- C9: withdrawal is reported before stale consent, which withdrawal clears.
-- Preserve every authorization requirement; no permission is broadened.
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

  if v_profile.consent_version is distinct from v_config.contribution_consent_version
     or v_profile.consented_at is null
     or v_profile.age_confirmed_at is null then
    raise exception 'consent_outdated' using errcode = '42501';
  end if;

  if not v_config.contribution_text_enabled then
    raise exception 'flag_disabled' using errcode = '42501';
  end if;
end;
$$;
