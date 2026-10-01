-- Forward migration. Historical contribution_media rows, reward_ledger
-- balances, and review tables stay. New Camera photos cannot register or
-- complete. Sample progress is a count, not a credit grant.

create table if not exists public.sample_allotment_events (
  user_id uuid not null references auth.users (id) on delete cascade,
  corpus_version text not null,
  allotted integer not null,
  completed integer not null,
  crossed_at timestamptz not null,
  received_at timestamptz not null default now(),
  primary key (user_id, corpus_version),
  constraint sample_allotment_events_ratio check (
    allotted > 0 and completed::numeric / allotted > 0.9
  )
);

alter table public.sample_allotment_events enable row level security;

drop policy if exists sample_allotment_select_own on public.sample_allotment_events;
create policy sample_allotment_select_own
  on public.sample_allotment_events
  for select
  to authenticated
  using (user_id = (select auth.uid()));

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
     or btrim(p_corpus_version) = ''
     or p_allotted is null
     or p_allotted <= 0
     or p_completed is null
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

  if v_row.kind = 'photo' then
    raise exception 'photo_collection_retired' using errcode = '42501';
  end if;

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

-- Hosted review rotation is not a database cron in this repo. If a later
-- environment created cron jobs with these names, drop those schedules.
-- Historical functions and tables remain.
do $$
begin
  if to_regnamespace('cron') is not null and to_regclass('cron.job') is not null then
    execute $unschedule$
      select cron.unschedule(jobid)
      from cron.job
      where jobname in (
        'service_rotate_review_window',
        'review-lookahead',
        'review-validation'
      )
    $unschedule$;
  end if;
exception
  when undefined_table or undefined_function then
    null;
end $$;
