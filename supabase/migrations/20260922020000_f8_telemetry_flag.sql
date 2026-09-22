-- F8: remote telemetry gate (default off). Crash/perf/usage only; no raw content.
alter table public.app_config
  add column if not exists telemetry_enabled boolean not null default false;

update public.app_config
set telemetry_enabled = false
where id = 1;

-- Extend admin flag get/patch to include telemetry_enabled.
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
    'telemetry_enabled', coalesce(r.telemetry_enabled, false),
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
    'deletion_processing_enabled',
    'telemetry_enabled'
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
    telemetry_enabled = coalesce(
      (p_patch ->> 'telemetry_enabled')::boolean,
      telemetry_enabled
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
