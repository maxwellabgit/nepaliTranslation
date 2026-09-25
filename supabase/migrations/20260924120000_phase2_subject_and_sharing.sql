-- Phase 2: restore startup-consent subject binding and enforce per-account sharing.
-- Forward-only. C6 kept Terms/Privacy without 18+ and dropped the auth.uid() check.
-- Service-role callers (auth.uid() is null) may still write for cron and admin.

alter table public.profiles
  add column if not exists speech_sharing boolean not null default false,
  add column if not exists photo_sharing boolean not null default false,
  add column if not exists media_cancel_generation bigint not null default 0;

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
  if v_uid is not null and v_uid <> p_user_id then
    raise exception 'forbidden' using errcode = '42501';
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

create or replace function public.service_set_sharing_toggles(
  p_user_id uuid,
  p_speech boolean,
  p_photos boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_generation bigint;
begin
  if p_user_id is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if v_uid is not null and v_uid <> p_user_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.profiles (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.profiles
     set speech_sharing = coalesce(p_speech, false),
         photo_sharing = coalesce(p_photos, false),
         media_cancel_generation = media_cancel_generation
           + case
               when speech_sharing is true and coalesce(p_speech, false) is not true then 1
               when photo_sharing is true and coalesce(p_photos, false) is not true then 1
               else 0
             end,
         updated_at = now()
   where user_id = p_user_id
  returning media_cancel_generation into v_generation;

  return jsonb_build_object(
    'speech_sharing', coalesce(p_speech, false),
    'photo_sharing', coalesce(p_photos, false),
    'media_cancel_generation', coalesce(v_generation, 0)
  );
end;
$$;

revoke all on function public.service_set_sharing_toggles(uuid, boolean, boolean)
  from public, anon;
grant execute on function public.service_set_sharing_toggles(uuid, boolean, boolean)
  to authenticated, service_role;

create or replace function private.assert_contribution_media_gate(
  p_user_id uuid,
  p_kind text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_speech boolean;
  v_photos boolean;
  v_share_speech boolean;
  v_share_photos boolean;
begin
  if p_user_id is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if p_kind is distinct from 'speech' and p_kind is distinct from 'photo' then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  perform private.assert_contribution_consent_core(p_user_id);

  select
    contribution_speech_enabled,
    contribution_photos_enabled
  into v_speech, v_photos
  from public.app_config
  where id = 1;

  if p_kind = 'speech' and coalesce(v_speech, false) is not true then
    raise exception 'flag_disabled' using errcode = 'P0001';
  end if;
  if p_kind = 'photo' and coalesce(v_photos, false) is not true then
    raise exception 'flag_disabled' using errcode = 'P0001';
  end if;

  select speech_sharing, photo_sharing
    into v_share_speech, v_share_photos
  from public.profiles
  where user_id = p_user_id;

  if p_kind = 'speech' and coalesce(v_share_speech, false) is not true then
    raise exception 'sharing_disabled' using errcode = 'P0001';
  end if;
  if p_kind = 'photo' and coalesce(v_share_photos, false) is not true then
    raise exception 'sharing_disabled' using errcode = 'P0001';
  end if;
end;
$$;
