-- C9: withdrawal and account deletion also write private.deletion_requests.
-- due_at is taken from the profile row so a retry cannot move the deadline later.
-- Forward-only. The previous function bodies stay in the earlier migration files.

create or replace function private.ensure_deletion_request(
  p_user_id uuid,
  p_kind text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_requested timestamptz;
  v_due timestamptz;
begin
  if p_kind not in ('consent_withdrawal', 'account_deletion') then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  select id into v_id
    from private.deletion_requests
   where user_id = p_user_id
     and request_kind = p_kind
     and completed_at is null
   limit 1;
  if v_id is not null then
    return v_id;
  end if;

  select
    coalesce(
      case when p_kind = 'account_deletion' then deletion_requested_at else consent_withdrawn_at end,
      now()
    ),
    deletion_due_at
  into v_requested, v_due
  from public.profiles
  where user_id = p_user_id;

  if v_due is null then
    v_due := coalesce(v_requested, now()) + interval '30 days';
  end if;

  insert into private.deletion_requests (
    request_kind,
    user_id,
    requested_at,
    due_at,
    auth_completion
  ) values (
    p_kind,
    p_user_id,
    coalesce(v_requested, now()),
    v_due,
    case when p_kind = 'account_deletion' then 'pending' else 'not_applicable' end
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function private.ensure_deletion_request(uuid, text)
  from public, anon, authenticated;
grant execute on function private.ensure_deletion_request(uuid, text) to service_role;

create or replace function public.service_request_account_deletion(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_due timestamptz;
  v_uid uuid := auth.uid();
begin
  if p_user_id is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if v_uid is not null and v_uid <> p_user_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_due := now() + interval '30 days';

  update public.profiles
  set
    deletion_requested_at = coalesce(deletion_requested_at, now()),
    deletion_due_at = coalesce(deletion_due_at, v_due),
    consent_withdrawn_at = coalesce(consent_withdrawn_at, now()),
    updated_at = now()
  where user_id = p_user_id;

  update public.contribution_media
  set status = 'pending_delete'
  where user_id = p_user_id
    and status in ('uploaded', 'pending_upload');

  insert into private.audit_log (actor_id, action, target, reason)
  values (
    p_user_id,
    'deletion_requested_admin',
    p_user_id::text,
    '30-day deletion scheduled; uploads disabled'
  );

  perform private.ensure_deletion_request(p_user_id, 'account_deletion');

  return jsonb_build_object(
    'deletion_requested_at', now(),
    'deletion_due_at', v_due
  );
end;
$$;

create or replace function public.service_withdraw_contribution_consent(
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_due timestamptz;
  v_uid uuid := auth.uid();
begin
  if p_user_id is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if v_uid is not null and v_uid <> p_user_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_due := now() + interval '30 days';

  update public.profiles
     set consent_withdrawn_at = coalesce(consent_withdrawn_at, now()),
         deletion_due_at = coalesce(deletion_due_at, v_due),
         updated_at = now()
   where user_id = p_user_id;

  update public.contribution_media
     set status = 'pending_delete'
   where user_id = p_user_id
     and status in ('uploaded', 'pending_upload');

  insert into private.contributor_alerts (user_id, receipt_id, alert_type, message)
  values (
    p_user_id,
    null,
    'contribution_consent_withdrawn',
    '30-day purge deadline set'
  );

  insert into private.audit_log (actor_id, action, target, reason)
  values (
    p_user_id,
    'contribution_consent_withdrawn',
    p_user_id::text,
    'user withdrew contribution consent'
  );

  perform private.ensure_deletion_request(p_user_id, 'consent_withdrawal');

  return jsonb_build_object(
    'consent_withdrawn_at', now(),
    'deletion_due_at', v_due
  );
end;
$$;
