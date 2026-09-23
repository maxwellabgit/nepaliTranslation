-- C9 follow-up: private.deletion_requests is the executor's source of truth.
-- Withdrawal is visible even when profiles.deletion_requested_at is null.
-- Storage failure does not purge the database. Auth failure stays retryable.
-- Forward-only.

create or replace function public.service_list_due_deletion_requests(
  p_limit integer default 50
)
returns table (
  id uuid,
  user_id uuid,
  request_kind text,
  storage_completed boolean,
  database_completed boolean,
  auth_completion text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  return query
    select
      d.id,
      d.user_id,
      d.request_kind,
      d.storage_completed,
      d.database_completed,
      d.auth_completion
    from private.deletion_requests d
   where d.completed_at is null
     and d.due_at <= now()
     and (d.next_retry_at is null or d.next_retry_at <= now())
   order by d.due_at, d.requested_at
   limit p_limit;
end;
$$;

revoke all on function public.service_list_due_deletion_requests(integer)
  from public, anon, authenticated;
grant execute on function public.service_list_due_deletion_requests(integer)
  to service_role;

create or replace function public.service_record_deletion_storage(
  p_request_id uuid,
  p_ok boolean,
  p_error text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row private.deletion_requests;
begin
  select * into v_row
    from private.deletion_requests
   where id = p_request_id
     and completed_at is null
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_open');
  end if;

  if coalesce(p_ok, false) then
    update private.deletion_requests
       set storage_completed = true,
           stage = 'database',
           last_error = null
     where id = p_request_id;
    return jsonb_build_object('ok', true, 'stage', 'database');
  end if;

  update private.deletion_requests
     set storage_completed = false,
         stage = 'storage',
         attempt_count = attempt_count + 1,
         last_error = left(coalesce(p_error, 'storage_failed'), 500),
         next_retry_at = now() + interval '1 hour'
   where id = p_request_id;
  return jsonb_build_object('ok', false, 'stage', 'storage');
end;
$$;

revoke all on function public.service_record_deletion_storage(uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function public.service_record_deletion_storage(uuid, boolean, text)
  to service_role;

create or replace function public.service_complete_deletion_database(
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row private.deletion_requests;
begin
  select * into v_row
    from private.deletion_requests
   where id = p_request_id
     and completed_at is null
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_open');
  end if;
  if not v_row.storage_completed then
    return jsonb_build_object('ok', false, 'reason', 'storage_incomplete');
  end if;
  if v_row.database_completed then
    return jsonb_build_object('ok', true, 'stage', 'database', 'idempotent', true);
  end if;

  perform private.purge_user_data(v_row.user_id);

  update private.deletion_requests
     set database_completed = true,
         stage = case
           when request_kind = 'consent_withdrawal' then 'complete'
           else 'auth'
         end,
         completed_at = case
           when request_kind = 'consent_withdrawal' then now()
           else null
         end,
         last_error = null
   where id = p_request_id;

  return jsonb_build_object(
    'ok', true,
    'stage', case when v_row.request_kind = 'consent_withdrawal' then 'complete' else 'auth' end
  );
end;
$$;

revoke all on function public.service_complete_deletion_database(uuid)
  from public, anon, authenticated;
grant execute on function public.service_complete_deletion_database(uuid)
  to service_role;

create or replace function public.service_record_deletion_auth(
  p_request_id uuid,
  p_ok boolean,
  p_error text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row private.deletion_requests;
begin
  select * into v_row
    from private.deletion_requests
   where id = p_request_id
     and completed_at is null
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_open');
  end if;
  if v_row.request_kind <> 'account_deletion' then
    return jsonb_build_object('ok', false, 'reason', 'auth_not_applicable');
  end if;
  if not v_row.database_completed then
    return jsonb_build_object('ok', false, 'reason', 'database_incomplete');
  end if;

  if coalesce(p_ok, false) then
    update private.deletion_requests
       set auth_completion = 'completed',
           stage = 'complete',
           completed_at = now(),
           last_error = null
     where id = p_request_id;
    return jsonb_build_object('ok', true, 'stage', 'complete');
  end if;

  update private.deletion_requests
     set auth_completion = 'failed',
         stage = 'auth',
         attempt_count = attempt_count + 1,
         last_error = left(coalesce(p_error, 'auth_delete_failed'), 500),
         next_retry_at = now() + interval '1 hour',
         completed_at = null
   where id = p_request_id;
  return jsonb_build_object('ok', false, 'stage', 'auth');
end;
$$;

revoke all on function public.service_record_deletion_auth(uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function public.service_record_deletion_auth(uuid, boolean, text)
  to service_role;
