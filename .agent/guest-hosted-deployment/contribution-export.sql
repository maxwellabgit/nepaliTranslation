begin;
do $c5_apply$ begin
if not exists (select 1 from supabase_migrations.schema_migrations where version='20261003180000') then
execute $c5_source$-- C5: private review retrieval/export, never a training/public-display grant.
create or replace function public.service_admin_contributions(
  p_actor_id uuid,
  p_limit integer default 50,
  p_before timestamptz default null,
  p_before_key text default null,
  p_export boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_records jsonb;
  v_cursor jsonb;
  v_rows integer;
begin
  perform public.service_assert_admin(p_actor_id);
  if p_limit is null or p_limit < 1 or p_limit > 200
    or (p_before is null) <> (p_before_key is null)
    or (p_before_key is not null and length(p_before_key) > 80)
    or p_export is null then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  with eligible as (
    select p.user_id
    from public.profiles p cross join public.app_config c
    where c.id = 1 and p.consent_version = c.contribution_consent_version
      and p.consented_at is not null and p.age_confirmed_at is not null
      and p.consent_withdrawn_at is null
      and p.deletion_requested_at is null and p.deletion_due_at is null
      and not exists (select 1 from private.deletion_requests d where d.user_id = p.user_id and d.completed_at is null)
  ), records as (
    select r.created_at, 'report:' || r.id::text as record_key,
      jsonb_build_object(
        'record_type', 'text', 'id', r.id, 'owner_id', r.reporter_id,
        'created_at', r.created_at, 'source', r.raw_source,
        'result', r.model_output, 'correction', r.raw_correction,
        'normalized_source', regexp_replace(btrim(r.raw_source), '\s+', ' ', 'g'),
        'direction', r.direction, 'formality', r.formality, 'script', r.script,
        'surface', r.surface, 'consent_version', r.consent_version,
        'metadata', r.metadata, 'status', r.status,
        'classification', 'private_review_only',
        'training_eligible', false, 'public_display_eligible', false
      ) as record
    from private.translation_reports r join eligible e on e.user_id = r.reporter_id
      cross join public.app_config c
    where c.id = 1 and r.consent_version = c.contribution_consent_version
      and r.status in ('triage', 'approved')
    union all
    select m.created_at, 'media:' || m.id::text,
      jsonb_build_object(
        'record_type', 'speech', 'id', m.id, 'owner_id', m.user_id,
        'created_at', m.created_at, 'content_type', m.content_type,
        'byte_size', m.byte_size, 'sha256', m.sha256,
        'consent_version', m.consent_version, 'metadata', m.metadata,
        'status', m.status, 'classification', 'private_review_only',
        'training_eligible', false, 'public_display_eligible', false
      )
    from public.contribution_media m join eligible e on e.user_id = m.user_id
      join public.profiles p on p.user_id = m.user_id cross join public.app_config c
    where c.id = 1 and m.kind = 'speech' and m.status = 'uploaded'
      and p.speech_sharing and m.consent_version = c.contribution_consent_version
  ), page as (
    select * from records
    where p_before is null or (created_at, record_key) < (p_before, p_before_key)
    order by created_at desc, record_key desc limit p_limit + 1
  ), delivered as (
    select * from page order by created_at desc, record_key desc limit p_limit
  )
  select coalesce(jsonb_agg(record order by created_at desc, record_key desc), '[]'::jsonb),
    count(*)::integer,
    case when (select count(*) from page) > p_limit then (
      select jsonb_build_object('created_at', created_at, 'key', record_key)
      from delivered order by created_at asc, record_key asc limit 1
    ) else null end
  into v_records, v_rows, v_cursor from delivered;

  insert into private.audit_log(actor_id, action, target, after_summary)
  values (p_actor_id, case when p_export then 'admin_contribution_export' else 'admin_contribution_read' end,
    'private_contributions', jsonb_build_object('rows', v_rows, 'before', p_before, 'before_key', p_before_key)::text);
  return jsonb_build_object('schema_version', 1, 'classification', 'private_review_only',
    'generated_at', now(), 'records', v_records, 'next_cursor', v_cursor);
end;
$$;
revoke all on function public.service_admin_contributions(uuid, integer, timestamptz, text, boolean)
  from public, anon, authenticated;
grant execute on function public.service_admin_contributions(uuid, integer, timestamptz, text, boolean) to service_role;

-- Signed previews recheck current consent/deletion on every request.
create or replace function public.service_admin_media_preview(p_actor_id uuid, p_media_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare m public.contribution_media%rowtype;
begin
  perform public.service_assert_admin(p_actor_id);
  select cm.* into m from public.contribution_media cm
    join public.profiles p on p.user_id = cm.user_id cross join public.app_config c
  where cm.id = p_media_id and cm.kind = 'speech' and cm.status = 'uploaded'
    and c.id = 1 and cm.consent_version = c.contribution_consent_version
    and p.consent_version = c.contribution_consent_version
    and p.consented_at is not null and p.age_confirmed_at is not null and p.speech_sharing
    and p.consent_withdrawn_at is null and p.deletion_requested_at is null and p.deletion_due_at is null
    and not exists (select 1 from private.deletion_requests d where d.user_id = p.user_id and d.completed_at is null);
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  insert into private.audit_log(actor_id, action, target, after_summary, reason)
  values(p_actor_id, 'admin_media_preview', m.id::text, 'private_speech_preview', 'speech');
  return jsonb_build_object('media_id', m.id, 'bucket_id', m.bucket_id,
    'object_path', m.object_path, 'content_type', m.content_type, 'kind', m.kind,
    'status', m.status, 'byte_size', m.byte_size);
end;
$$;
$c5_source$;
insert into supabase_migrations.schema_migrations(version,name,statements) values ('20261003180000','admin_contribution_export',array[$c5_source$-- C5: private review retrieval/export, never a training/public-display grant.
create or replace function public.service_admin_contributions(
  p_actor_id uuid,
  p_limit integer default 50,
  p_before timestamptz default null,
  p_before_key text default null,
  p_export boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_records jsonb;
  v_cursor jsonb;
  v_rows integer;
begin
  perform public.service_assert_admin(p_actor_id);
  if p_limit is null or p_limit < 1 or p_limit > 200
    or (p_before is null) <> (p_before_key is null)
    or (p_before_key is not null and length(p_before_key) > 80)
    or p_export is null then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  with eligible as (
    select p.user_id
    from public.profiles p cross join public.app_config c
    where c.id = 1 and p.consent_version = c.contribution_consent_version
      and p.consented_at is not null and p.age_confirmed_at is not null
      and p.consent_withdrawn_at is null
      and p.deletion_requested_at is null and p.deletion_due_at is null
      and not exists (select 1 from private.deletion_requests d where d.user_id = p.user_id and d.completed_at is null)
  ), records as (
    select r.created_at, 'report:' || r.id::text as record_key,
      jsonb_build_object(
        'record_type', 'text', 'id', r.id, 'owner_id', r.reporter_id,
        'created_at', r.created_at, 'source', r.raw_source,
        'result', r.model_output, 'correction', r.raw_correction,
        'normalized_source', regexp_replace(btrim(r.raw_source), '\s+', ' ', 'g'),
        'direction', r.direction, 'formality', r.formality, 'script', r.script,
        'surface', r.surface, 'consent_version', r.consent_version,
        'metadata', r.metadata, 'status', r.status,
        'classification', 'private_review_only',
        'training_eligible', false, 'public_display_eligible', false
      ) as record
    from private.translation_reports r join eligible e on e.user_id = r.reporter_id
      cross join public.app_config c
    where c.id = 1 and r.consent_version = c.contribution_consent_version
      and r.status in ('triage', 'approved')
    union all
    select m.created_at, 'media:' || m.id::text,
      jsonb_build_object(
        'record_type', 'speech', 'id', m.id, 'owner_id', m.user_id,
        'created_at', m.created_at, 'content_type', m.content_type,
        'byte_size', m.byte_size, 'sha256', m.sha256,
        'consent_version', m.consent_version, 'metadata', m.metadata,
        'status', m.status, 'classification', 'private_review_only',
        'training_eligible', false, 'public_display_eligible', false
      )
    from public.contribution_media m join eligible e on e.user_id = m.user_id
      join public.profiles p on p.user_id = m.user_id cross join public.app_config c
    where c.id = 1 and m.kind = 'speech' and m.status = 'uploaded'
      and p.speech_sharing and m.consent_version = c.contribution_consent_version
  ), page as (
    select * from records
    where p_before is null or (created_at, record_key) < (p_before, p_before_key)
    order by created_at desc, record_key desc limit p_limit + 1
  ), delivered as (
    select * from page order by created_at desc, record_key desc limit p_limit
  )
  select coalesce(jsonb_agg(record order by created_at desc, record_key desc), '[]'::jsonb),
    count(*)::integer,
    case when (select count(*) from page) > p_limit then (
      select jsonb_build_object('created_at', created_at, 'key', record_key)
      from delivered order by created_at asc, record_key asc limit 1
    ) else null end
  into v_records, v_rows, v_cursor from delivered;

  insert into private.audit_log(actor_id, action, target, after_summary)
  values (p_actor_id, case when p_export then 'admin_contribution_export' else 'admin_contribution_read' end,
    'private_contributions', jsonb_build_object('rows', v_rows, 'before', p_before, 'before_key', p_before_key)::text);
  return jsonb_build_object('schema_version', 1, 'classification', 'private_review_only',
    'generated_at', now(), 'records', v_records, 'next_cursor', v_cursor);
end;
$$;
revoke all on function public.service_admin_contributions(uuid, integer, timestamptz, text, boolean)
  from public, anon, authenticated;
grant execute on function public.service_admin_contributions(uuid, integer, timestamptz, text, boolean) to service_role;

-- Signed previews recheck current consent/deletion on every request.
create or replace function public.service_admin_media_preview(p_actor_id uuid, p_media_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare m public.contribution_media%rowtype;
begin
  perform public.service_assert_admin(p_actor_id);
  select cm.* into m from public.contribution_media cm
    join public.profiles p on p.user_id = cm.user_id cross join public.app_config c
  where cm.id = p_media_id and cm.kind = 'speech' and cm.status = 'uploaded'
    and c.id = 1 and cm.consent_version = c.contribution_consent_version
    and p.consent_version = c.contribution_consent_version
    and p.consented_at is not null and p.age_confirmed_at is not null and p.speech_sharing
    and p.consent_withdrawn_at is null and p.deletion_requested_at is null and p.deletion_due_at is null
    and not exists (select 1 from private.deletion_requests d where d.user_id = p.user_id and d.completed_at is null);
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  insert into private.audit_log(actor_id, action, target, after_summary, reason)
  values(p_actor_id, 'admin_media_preview', m.id::text, 'private_speech_preview', 'speech');
  return jsonb_build_object('media_id', m.id, 'bucket_id', m.bucket_id,
    'object_path', m.object_path, 'content_type', m.content_type, 'kind', m.kind,
    'status', m.status, 'byte_size', m.byte_size);
end;
$$;
$c5_source$]);
end if; end $c5_apply$;
select version,name from supabase_migrations.schema_migrations where version='20261003180000';
commit;
