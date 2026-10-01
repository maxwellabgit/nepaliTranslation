-- Forward migration. Sample progress can be inserted by the signed-in user.
-- A later speech rating updates the existing media row and does not add a file.

create or replace function private.merge_speech_feedback(
  p_current jsonb,
  p_incoming jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_incoming integer := 0;
  v_current integer := 0;
  v_feedback text;
  v_base jsonb := coalesce(p_current, '{}'::jsonb);
begin
  if p_incoming is null then
    return v_base;
  end if;
  if (p_incoming->>'feedbackRevision') ~ '^[0-9]+$' then
    v_incoming := (p_incoming->>'feedbackRevision')::integer;
  end if;
  if (v_base->>'feedbackRevision') ~ '^[0-9]+$' then
    v_current := (v_base->>'feedbackRevision')::integer;
  end if;
  if v_incoming < v_current then
    return v_base;
  end if;
  v_feedback := p_incoming->>'feedback';
  if v_feedback is null or v_feedback not in ('unrated', 'up', 'down') then
    v_feedback := coalesce(v_base->>'feedback', 'unrated');
  end if;
  return v_base || jsonb_build_object(
    'feedback', v_feedback,
    'feedbackRevision', v_incoming,
    'transcript', coalesce(p_incoming->>'transcript', v_base->>'transcript'),
    'utteranceId', coalesce(p_incoming->>'utteranceId', v_base->>'utteranceId'),
    'language', coalesce(p_incoming->>'language', v_base->>'language'),
    'capturedAt', coalesce(p_incoming->>'capturedAt', v_base->>'capturedAt'),
    'surface', coalesce(p_incoming->>'surface', v_base->>'surface'),
    'durationMs', coalesce(p_incoming->'durationMs', v_base->'durationMs'),
    'schemaVersion', coalesce(p_incoming->'schemaVersion', v_base->'schemaVersion')
  );
end;
$$;

revoke all on function private.merge_speech_feedback(jsonb, jsonb)
  from public, anon, authenticated;

alter table public.sample_allotment_events
  drop constraint if exists sample_allotment_events_bounds;
alter table public.sample_allotment_events
  add constraint sample_allotment_events_bounds
  check (completed >= 0 and completed <= allotted);

alter table public.sample_allotment_events
  drop constraint if exists sample_allotment_events_manifest;
alter table public.sample_allotment_events
  add constraint sample_allotment_events_manifest
  check (corpus_version = 'review-roster-370');

revoke all on table public.sample_allotment_events from public, anon;
grant select, insert on table public.sample_allotment_events to authenticated;

drop policy if exists sample_allotment_insert_own on public.sample_allotment_events;
create policy sample_allotment_insert_own
  on public.sample_allotment_events
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create or replace function public.record_sample_progress(
  p_corpus_version text,
  p_allotted integer,
  p_completed integer,
  p_crossed_at timestamptz
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if p_corpus_version is null
     or btrim(p_corpus_version) is distinct from 'review-roster-370'
     or p_allotted is null
     or p_allotted <= 0
     or p_completed is null
     or p_completed < 0
     or p_completed > p_allotted
     or p_crossed_at is null
     or p_completed::numeric / p_allotted <= 0.9 then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  insert into public.sample_allotment_events (
    user_id,
    corpus_version,
    allotted,
    completed,
    crossed_at
  ) values (
    auth.uid(),
    btrim(p_corpus_version),
    p_allotted,
    p_completed,
    p_crossed_at
  )
  on conflict (user_id, corpus_version) do nothing;

  return true;
end;
$$;

revoke all on function public.record_sample_progress(text, integer, integer, timestamptz)
  from public, anon;
grant execute on function public.record_sample_progress(text, integer, integer, timestamptz)
  to authenticated;

create or replace function public.revise_media_feedback(
  p_idempotency_key text,
  p_metadata jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.contribution_media%rowtype;
begin
  if v_uid is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if p_idempotency_key is null
     or btrim(p_idempotency_key) = ''
     or p_metadata is null
     or jsonb_typeof(p_metadata) is distinct from 'object' then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  select * into v_row
  from public.contribution_media m
  where m.user_id = v_uid
    and m.idempotency_key = btrim(p_idempotency_key)
    and m.kind = 'speech';

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  update public.contribution_media
  set metadata = private.merge_speech_feedback(v_row.metadata, p_metadata)
  where id = v_row.id
    and user_id = v_uid;

  return true;
end;
$$;

revoke all on function public.revise_media_feedback(text, jsonb)
  from public, anon;
grant execute on function public.revise_media_feedback(text, jsonb)
  to authenticated;

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
  if p_kind = 'photo' then
    raise exception 'photo_collection_retired' using errcode = '42501';
  end if;

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

  v_bucket := 'contribution-speech';

  select * into v_existing
  from public.contribution_media m
  where m.user_id = p_user_id
    and m.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.kind = 'photo' then
      raise exception 'photo_collection_retired' using errcode = '42501';
    end if;
    update public.contribution_media
    set metadata = private.merge_speech_feedback(
      v_existing.metadata,
      coalesce(p_metadata, '{}'::jsonb)
    )
    where id = v_existing.id;
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
