-- F7: protected operational admin console RPCs (service_role only).
-- Browser clients never call these directly; admin-api asserts JWT admin then uses service role.

-- ---------------------------------------------------------------------------
-- Assert allowlisted admin (revoked_at null)
-- ---------------------------------------------------------------------------

create or replace function public.service_assert_admin(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_revoked timestamptz;
begin
  if p_user_id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select role, revoked_at
    into v_role, v_revoked
  from private.admin_users
  where user_id = p_user_id;

  if not found or v_revoked is not null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return jsonb_build_object('ok', true, 'role', v_role);
end;
$$;

revoke all on function public.service_assert_admin(uuid)
  from public, anon, authenticated;
grant execute on function public.service_assert_admin(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Dashboard summary counts
-- ---------------------------------------------------------------------------

create or replace function public.service_admin_dashboard_summary()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_triage integer;
  v_media integer;
  v_alerts integer;
  v_deletions integer;
  v_exports integer;
begin
  select count(*)::integer into v_triage
  from private.translation_reports
  where status = 'triage';

  select count(*)::integer into v_media
  from public.contribution_media
  where status = 'uploaded';

  select count(*)::integer into v_alerts
  from private.contributor_alerts
  where acknowledged_at is null;

  select count(*)::integer into v_deletions
  from public.profiles
  where deletion_requested_at is not null
    and deletion_purged_at is null;

  select count(*)::integer into v_exports
  from private.dataset_exports;

  return jsonb_build_object(
    'triage_reports', v_triage,
    'uploaded_media', v_media,
    'open_alerts', v_alerts,
    'pending_deletions', v_deletions,
    'dataset_exports', v_exports
  );
end;
$$;

revoke all on function public.service_admin_dashboard_summary()
  from public, anon, authenticated;
grant execute on function public.service_admin_dashboard_summary() to service_role;

-- ---------------------------------------------------------------------------
-- Review queue (translation reports + uploaded media metadata)
-- ---------------------------------------------------------------------------

create or replace function public.service_admin_list_review_queue(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
  v_reports jsonb;
  v_media jsonb;
begin
  select coalesce(jsonb_agg(row_to_json(r)::jsonb order by r.created_at desc), '[]'::jsonb)
    into v_reports
  from (
    select
      id,
      'translation_report'::text as item_type,
      status,
      direction,
      formality,
      script,
      surface,
      left(coalesce(raw_source, ''), 200) as source_preview,
      left(coalesce(model_output, ''), 200) as model_preview,
      left(coalesce(raw_correction, ''), 200) as correction_preview,
      reporter_id,
      created_at
    from private.translation_reports
    where status = 'triage'
    order by created_at desc
    limit v_limit
  ) r;

  select coalesce(jsonb_agg(row_to_json(m)::jsonb order by m.created_at desc), '[]'::jsonb)
    into v_media
  from (
    select
      id,
      'contribution_media'::text as item_type,
      kind,
      bucket_id,
      object_path,
      content_type,
      byte_size,
      status,
      user_id,
      consent_version,
      created_at,
      uploaded_at
    from public.contribution_media
    where status = 'uploaded'
    order by created_at desc
    limit v_limit
  ) m;

  return jsonb_build_object('reports', v_reports, 'media', v_media);
end;
$$;

revoke all on function public.service_admin_list_review_queue(integer)
  from public, anon, authenticated;
grant execute on function public.service_admin_list_review_queue(integer) to service_role;

create or replace function public.service_admin_review_decide(
  p_actor_id uuid,
  p_item_type text,
  p_item_id uuid,
  p_decision text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_before text;
begin
  if p_actor_id is null or p_item_id is null then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  if p_item_type not in ('translation_report', 'contribution_media') then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  if p_decision not in ('approve', 'reject') then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  if p_item_type = 'translation_report' then
    select status into v_before
    from private.translation_reports
    where id = p_item_id
    for update;
    if not found then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    v_status := case when p_decision = 'approve' then 'approved' else 'rejected' end;
    update private.translation_reports
    set status = v_status
    where id = p_item_id;
  else
    select status into v_before
    from public.contribution_media
    where id = p_item_id
    for update;
    if not found then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    -- Approve keeps uploaded; reject marks rejected (no automatic purge here).
    if p_decision = 'reject' then
      v_status := 'rejected';
      update public.contribution_media
      set status = 'rejected'
      where id = p_item_id;
    else
      v_status := 'uploaded';
    end if;
  end if;

  insert into private.audit_log (actor_id, action, target, before_summary, after_summary, reason)
  values (
    p_actor_id,
    'admin_review_' || p_decision,
    p_item_type || ':' || p_item_id::text,
    v_before,
    v_status,
    nullif(btrim(coalesce(p_reason, '')), '')
  );

  return jsonb_build_object(
    'ok', true,
    'item_type', p_item_type,
    'item_id', p_item_id,
    'decision', p_decision,
    'status', v_status
  );
end;
$$;

revoke all on function public.service_admin_review_decide(uuid, text, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.service_admin_review_decide(uuid, text, uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Alerts
-- ---------------------------------------------------------------------------

create or replace function public.service_admin_list_alerts(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
  v_rows jsonb;
begin
  select coalesce(jsonb_agg(row_to_json(a)::jsonb order by a.created_at desc), '[]'::jsonb)
    into v_rows
  from (
    select
      id,
      user_id,
      receipt_id,
      alert_type,
      message,
      created_at,
      acknowledged_at
    from private.contributor_alerts
    order by created_at desc
    limit v_limit
  ) a;

  return jsonb_build_object('alerts', v_rows);
end;
$$;

revoke all on function public.service_admin_list_alerts(integer)
  from public, anon, authenticated;
grant execute on function public.service_admin_list_alerts(integer) to service_role;

-- ---------------------------------------------------------------------------
-- Deletion queue
-- ---------------------------------------------------------------------------

create or replace function public.service_admin_list_deletions(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
  v_rows jsonb;
begin
  select coalesce(jsonb_agg(row_to_json(d)::jsonb order by d.deletion_due_at nulls last), '[]'::jsonb)
    into v_rows
  from (
    select
      user_id,
      deletion_requested_at,
      deletion_due_at,
      deletion_purged_at,
      consent_withdrawn_at
    from public.profiles
    where deletion_requested_at is not null
      and deletion_purged_at is null
    order by deletion_due_at nulls last, deletion_requested_at
    limit v_limit
  ) d;

  return jsonb_build_object('deletions', v_rows);
end;
$$;

revoke all on function public.service_admin_list_deletions(integer)
  from public, anon, authenticated;
grant execute on function public.service_admin_list_deletions(integer) to service_role;

-- ---------------------------------------------------------------------------
-- Feature flags get / patch
-- ---------------------------------------------------------------------------

create or replace function public.service_admin_get_flags()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.app_config%rowtype;
begin
  select * into r from public.app_config where id = 1;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'version', r.version,
    'contribution_text_enabled', r.contribution_text_enabled,
    'contribution_speech_enabled', r.contribution_speech_enabled,
    'contribution_photos_enabled', r.contribution_photos_enabled,
    'rewards_enabled', r.rewards_enabled,
    'network_ads_enabled', r.network_ads_enabled,
    'rewarded_ads_enabled', r.rewarded_ads_enabled,
    'automatic_interstitial_enabled', r.automatic_interstitial_enabled,
    'paywall_enabled', r.paywall_enabled,
    'learn_enabled', r.learn_enabled,
    'deletion_processing_enabled', coalesce(r.deletion_processing_enabled, false),
    'updated_at', r.updated_at
  );
end;
$$;

revoke all on function public.service_admin_get_flags()
  from public, anon, authenticated;
grant execute on function public.service_admin_get_flags() to service_role;

create or replace function public.service_admin_patch_flags(
  p_actor_id uuid,
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.app_config%rowtype;
  v_before jsonb;
  v_after jsonb;
  k text;
  allowed text[] := array[
    'contribution_text_enabled',
    'contribution_speech_enabled',
    'contribution_photos_enabled',
    'rewards_enabled',
    'network_ads_enabled',
    'rewarded_ads_enabled',
    'automatic_interstitial_enabled',
    'paywall_enabled',
    'learn_enabled',
    'deletion_processing_enabled'
  ];
begin
  if p_actor_id is null or p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  for k in select jsonb_object_keys(p_patch)
  loop
    if not (k = any (allowed)) then
      raise exception 'invalid_payload' using errcode = '22023';
    end if;
    if jsonb_typeof(p_patch -> k) <> 'boolean' then
      raise exception 'invalid_payload' using errcode = '22023';
    end if;
  end loop;

  select * into r from public.app_config where id = 1 for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  v_before := public.service_admin_get_flags();

  update public.app_config
  set
    contribution_text_enabled = coalesce((p_patch ->> 'contribution_text_enabled')::boolean, contribution_text_enabled),
    contribution_speech_enabled = coalesce((p_patch ->> 'contribution_speech_enabled')::boolean, contribution_speech_enabled),
    contribution_photos_enabled = coalesce((p_patch ->> 'contribution_photos_enabled')::boolean, contribution_photos_enabled),
    rewards_enabled = coalesce((p_patch ->> 'rewards_enabled')::boolean, rewards_enabled),
    network_ads_enabled = coalesce((p_patch ->> 'network_ads_enabled')::boolean, network_ads_enabled),
    rewarded_ads_enabled = coalesce((p_patch ->> 'rewarded_ads_enabled')::boolean, rewarded_ads_enabled),
    automatic_interstitial_enabled = coalesce(
      (p_patch ->> 'automatic_interstitial_enabled')::boolean,
      automatic_interstitial_enabled
    ),
    paywall_enabled = coalesce((p_patch ->> 'paywall_enabled')::boolean, paywall_enabled),
    learn_enabled = coalesce((p_patch ->> 'learn_enabled')::boolean, learn_enabled),
    deletion_processing_enabled = coalesce(
      (p_patch ->> 'deletion_processing_enabled')::boolean,
      deletion_processing_enabled
    ),
    version = version + 1,
    updated_at = now()
  where id = 1;

  v_after := public.service_admin_get_flags();

  insert into private.audit_log (actor_id, action, target, before_summary, after_summary, reason)
  values (
    p_actor_id,
    'admin_patch_flags',
    'app_config',
    left(v_before::text, 500),
    left(v_after::text, 500),
    left(p_patch::text, 500)
  );

  return v_after;
end;
$$;

revoke all on function public.service_admin_patch_flags(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.service_admin_patch_flags(uuid, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Dataset staging (manual export metadata only — no automatic training)
-- ---------------------------------------------------------------------------

create or replace function public.service_admin_stage_dataset_export(
  p_actor_id uuid,
  p_version text,
  p_filter_manifest jsonb,
  p_object_path text,
  p_row_count integer default 0,
  p_content_hash text default 'pending'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_actor_id is null then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  if p_version is null or length(btrim(p_version)) = 0 then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  if p_object_path is null or length(btrim(p_object_path)) = 0 then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  if p_row_count is null or p_row_count < 0 then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  insert into private.dataset_exports (
    version,
    filter_manifest,
    object_path,
    row_count,
    content_hash,
    creator_id
  ) values (
    btrim(p_version),
    coalesce(p_filter_manifest, '{}'::jsonb),
    btrim(p_object_path),
    p_row_count,
    coalesce(nullif(btrim(p_content_hash), ''), 'pending'),
    p_actor_id
  )
  returning id into v_id;

  insert into private.audit_log (actor_id, action, target, after_summary, reason)
  values (
    p_actor_id,
    'admin_stage_dataset_export',
    v_id::text,
    p_object_path,
    p_version
  );

  return jsonb_build_object(
    'id', v_id,
    'version', btrim(p_version),
    'object_path', btrim(p_object_path),
    'row_count', p_row_count,
    'staged', true,
    'note', 'Manual export only; no automatic training or benchmark modification.'
  );
end;
$$;

revoke all on function public.service_admin_stage_dataset_export(uuid, text, jsonb, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.service_admin_stage_dataset_export(uuid, text, jsonb, text, integer, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Media preview: resolve object + write audit (signed URL created in edge fn)
-- ---------------------------------------------------------------------------

create or replace function public.service_admin_media_preview(
  p_actor_id uuid,
  p_media_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.contribution_media%rowtype;
begin
  if p_actor_id is null or p_media_id is null then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  select * into m
  from public.contribution_media
  where id = p_media_id;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  insert into private.audit_log (actor_id, action, target, after_summary, reason)
  values (
    p_actor_id,
    'admin_media_preview',
    p_media_id::text,
    m.bucket_id || '/' || m.object_path,
    m.kind
  );

  return jsonb_build_object(
    'media_id', m.id,
    'bucket_id', m.bucket_id,
    'object_path', m.object_path,
    'content_type', m.content_type,
    'kind', m.kind,
    'status', m.status,
    'byte_size', m.byte_size
  );
end;
$$;

revoke all on function public.service_admin_media_preview(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.service_admin_media_preview(uuid, uuid) to service_role;
