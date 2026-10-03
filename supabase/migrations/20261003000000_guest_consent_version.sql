-- C6 owner amendment: private guest authentication is not contribution consent.
-- Changed disclosures require fresh separate acceptance. No live flags enabled.
update public.app_config
set contribution_consent_version = '2026-10-02.guest',
    startup_consent_version = '2026-10-02.guest.startup',
    version = version + 1,
    updated_at = now()
where id = 1;

-- Renewed opt-in cannot cancel pending deletion or revive the old speech toggle.
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
  if exists (select 1 from private.deletion_requests where user_id = p_user_id and completed_at is null) then
    raise exception 'deletion_pending' using errcode = 'P0001';
  end if;
  update public.profiles
  set
    consent_version = p_version,
    consent_withdrawn_at = null,
    speech_sharing = false, photo_sharing = false,
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

