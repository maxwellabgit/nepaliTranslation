-- F3: split contribution flags, deletion stub fields, private media storage.
-- Jobs that process deletion_due_at are F4; schema only here.

-- ---------------------------------------------------------------------------
-- Feature flags: split contributions_enabled → text / speech / photos
-- ---------------------------------------------------------------------------

alter table public.app_config
  add column if not exists contribution_text_enabled boolean not null default false;

alter table public.app_config
  add column if not exists contribution_speech_enabled boolean not null default false;

alter table public.app_config
  add column if not exists contribution_photos_enabled boolean not null default false;

-- One-time: prior master flag becomes the text-upload gate.
update public.app_config
set contribution_text_enabled = contributions_enabled
where id = 1;

-- Keep legacy column mirrored for any dual-read clients.
create or replace function private.sync_legacy_contributions_enabled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.contributions_enabled := new.contribution_text_enabled;
  return new;
end;
$$;

drop trigger if exists trg_sync_legacy_contributions_enabled on public.app_config;
create trigger trg_sync_legacy_contributions_enabled
  before insert or update of contribution_text_enabled on public.app_config
  for each row
  execute function private.sync_legacy_contributions_enabled();

update public.app_config
set contributions_enabled = contribution_text_enabled
where id = 1;

-- Bump consent version for media-capable agreement (must match mobile client).
update public.app_config
set
  contribution_consent_version = '2026-09-21.media',
  version = version + 1,
  updated_at = now()
where id = 1;

-- ---------------------------------------------------------------------------
-- Profile deletion / withdrawal stubs (F4 jobs fill these)
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists deletion_requested_at timestamptz;

alter table public.profiles
  add column if not exists deletion_due_at timestamptz;

alter table public.profiles
  add column if not exists consent_withdrawn_at timestamptz;

-- ---------------------------------------------------------------------------
-- Contribution media metadata (owner-read RLS; writes via service RPCs)
-- ---------------------------------------------------------------------------

create table if not exists public.contribution_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('speech', 'photo')),
  bucket_id text not null check (
    bucket_id in ('contribution-speech', 'contribution-photos')
  ),
  object_path text not null,
  content_type text not null,
  byte_size integer not null check (byte_size > 0 and byte_size <= 26214400),
  sha256 text,
  idempotency_key text not null,
  consent_version text not null,
  status text not null default 'pending_upload'
    check (status in ('pending_upload', 'uploaded', 'rejected', 'pending_delete')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  uploaded_at timestamptz,
  constraint contribution_media_user_idempotency unique (user_id, idempotency_key),
  constraint contribution_media_object_unique unique (bucket_id, object_path)
);

create index if not exists contribution_media_user_created_idx
  on public.contribution_media (user_id, created_at desc);

alter table public.contribution_media enable row level security;

drop policy if exists contribution_media_select_own on public.contribution_media;
create policy contribution_media_select_own
  on public.contribution_media
  for select
  to authenticated
  using (user_id = auth.uid());

-- No insert/update/delete policies for anon/authenticated — service_role only.
revoke all on table public.contribution_media from public, anon;
grant select on table public.contribution_media to authenticated;
grant all on table public.contribution_media to service_role;

-- ---------------------------------------------------------------------------
-- Private storage buckets + path-scoped object policies
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'contribution-speech',
    'contribution-speech',
    false,
    26214400,
    array[
      'audio/mp4',
      'audio/m4a',
      'audio/aac',
      'audio/wav',
      'audio/x-wav',
      'audio/mpeg',
      'audio/webm'
    ]
  ),
  (
    'contribution-photos',
    'contribution-photos',
    false,
    15728640,
    array[
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/heic',
      'image/heif'
    ]
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Drop prior policies if re-running locally, then recreate owner-only select.
drop policy if exists contribution_speech_select_own on storage.objects;
drop policy if exists contribution_photos_select_own on storage.objects;
drop policy if exists contribution_speech_deny_write on storage.objects;
drop policy if exists contribution_photos_deny_write on storage.objects;

create policy contribution_speech_select_own
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'contribution-speech'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy contribution_photos_select_own
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'contribution-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Explicit deny of client writes; signed uploads use service-role tokens.
create policy contribution_speech_no_insert
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'contribution-speech' and false);

create policy contribution_photos_no_insert
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'contribution-photos' and false);

create policy contribution_speech_no_update
  on storage.objects
  for update
  to authenticated
  using (false);

create policy contribution_photos_no_update
  on storage.objects
  for update
  to authenticated
  using (false);

create policy contribution_speech_no_delete
  on storage.objects
  for delete
  to authenticated
  using (false);

create policy contribution_photos_no_delete
  on storage.objects
  for delete
  to authenticated
  using (false);

-- ---------------------------------------------------------------------------
-- Consent core (age + version) vs text gate (core + contribution_text_enabled)
-- Media uses core + per-kind speech/photo flags — never requires the text flag.
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
begin
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

revoke all on function private.assert_contribution_consent_core(uuid)
  from public, anon, authenticated;
grant execute on function private.assert_contribution_consent_core(uuid)
  to service_role;

-- Existing text RPCs call assert_contribution_consent — add text flag here.
create or replace function private.assert_contribution_consent(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enabled boolean;
begin
  perform private.assert_contribution_consent_core(p_user_id);
  select contribution_text_enabled into v_enabled
  from public.app_config
  where id = 1;
  if coalesce(v_enabled, false) is not true then
    raise exception 'flag_disabled' using errcode = 'P0001';
  end if;
end;
$$;

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
end;
$$;

revoke all on function private.assert_contribution_media_gate(uuid, text)
  from public, anon, authenticated;
grant execute on function private.assert_contribution_media_gate(uuid, text)
  to service_role;

create or replace function public.service_assert_contribution_media_gate(
  p_user_id uuid,
  p_kind text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_contribution_media_gate(p_user_id, p_kind);
end;
$$;

revoke all on function public.service_assert_contribution_media_gate(uuid, text)
  from public, anon, authenticated;
grant execute on function public.service_assert_contribution_media_gate(uuid, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Register + complete media upload (idempotent)
-- ---------------------------------------------------------------------------

create or replace function public.service_register_media_upload(
  p_user_id uuid,
  p_kind text,
  p_idempotency_key text,
  p_content_type text,
  p_byte_size integer,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  media_id uuid,
  bucket_id text,
  object_path text,
  status text,
  inserted boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bucket text;
  v_path text;
  v_consent text;
  v_existing public.contribution_media%rowtype;
  v_id uuid;
begin
  if p_user_id is null
     or p_idempotency_key is null
     or btrim(p_idempotency_key) = ''
     or p_content_type is null
     or btrim(p_content_type) = ''
     or p_byte_size is null
     or p_byte_size <= 0 then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  perform private.assert_contribution_media_gate(p_user_id, p_kind);

  select consent_version into v_consent
  from public.profiles
  where user_id = p_user_id;

  v_bucket := case
    when p_kind = 'speech' then 'contribution-speech'
    else 'contribution-photos'
  end;

  select * into v_existing
  from public.contribution_media m
  where m.user_id = p_user_id
    and m.idempotency_key = p_idempotency_key;

  if found then
    return query
      select
        v_existing.id,
        v_existing.bucket_id,
        v_existing.object_path,
        v_existing.status,
        false;
    return;
  end if;

  v_id := gen_random_uuid();
  v_path := p_user_id::text || '/' || v_id::text;

  insert into public.contribution_media (
    id,
    user_id,
    kind,
    bucket_id,
    object_path,
    content_type,
    byte_size,
    idempotency_key,
    consent_version,
    status,
    metadata
  ) values (
    v_id,
    p_user_id,
    p_kind,
    v_bucket,
    v_path,
    lower(btrim(p_content_type)),
    p_byte_size,
    p_idempotency_key,
    v_consent,
    'pending_upload',
    coalesce(p_metadata, '{}'::jsonb)
  );

  return query
    select v_id, v_bucket, v_path, 'pending_upload'::text, true;
end;
$$;

revoke all on function public.service_register_media_upload(
  uuid, text, text, text, integer, jsonb
) from public, anon, authenticated;
grant execute on function public.service_register_media_upload(
  uuid, text, text, text, integer, jsonb
) to service_role;

create or replace function public.service_complete_media_upload(
  p_user_id uuid,
  p_media_id uuid,
  p_sha256 text default null
)
returns table (
  media_id uuid,
  status text,
  object_path text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.contribution_media%rowtype;
begin
  if p_user_id is null or p_media_id is null then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  select * into v_row
  from public.contribution_media m
  where m.id = p_media_id
    and m.user_id = p_user_id;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  -- Re-check gate so flag-off / withdrawn consent cannot finalize.
  perform private.assert_contribution_media_gate(p_user_id, v_row.kind);

  if v_row.status = 'uploaded' then
    return query select v_row.id, v_row.status, v_row.object_path;
    return;
  end if;

  update public.contribution_media
  set
    status = 'uploaded',
    sha256 = coalesce(nullif(btrim(p_sha256), ''), sha256),
    uploaded_at = now()
  where id = p_media_id
    and user_id = p_user_id
  returning * into v_row;

  return query select v_row.id, v_row.status, v_row.object_path;
end;
$$;

revoke all on function public.service_complete_media_upload(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.service_complete_media_upload(uuid, uuid, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Extend purge to remove media rows (storage objects cleaned by Edge/F4)
-- ---------------------------------------------------------------------------

create or replace function private.purge_user_data(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.contribution_media where user_id = p_user_id;

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
  delete from public.profiles where user_id = p_user_id;
  delete from private.contributor_stats where user_id = p_user_id;

  insert into private.audit_log (actor_id, action, target, reason)
  values (p_user_id, 'delete_account', p_user_id::text, 'user requested deletion');
end;
$$;

-- List object paths for Edge delete-account / F4 storage purge hooks.
create or replace function public.service_list_user_media_objects(p_user_id uuid)
returns table (bucket_id text, object_path text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  return query
    select m.bucket_id, m.object_path
    from public.contribution_media m
    where m.user_id = p_user_id;
end;
$$;

revoke all on function public.service_list_user_media_objects(uuid)
  from public, anon, authenticated;
grant execute on function public.service_list_user_media_objects(uuid)
  to service_role;
