-- Phase 3: deletion status comes from the durable request row.
-- A passed due date is not completion. Authenticated callers can read only their own row.

create or replace function public.service_deletion_request_status(p_user_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row private.deletion_requests%rowtype;
begin
  if p_user_id is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if v_uid is not null and v_uid <> p_user_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_row
  from private.deletion_requests
  where user_id = p_user_id
  order by requested_at desc
  limit 1;

  if not found then
    return jsonb_build_object(
      'request_kind', null,
      'stage', null,
      'requested_at', null,
      'due_at', null,
      'completed_at', null
    );
  end if;

  return jsonb_build_object(
    'request_kind', v_row.request_kind,
    'stage', v_row.stage,
    'requested_at', v_row.requested_at,
    'due_at', v_row.due_at,
    'completed_at', v_row.completed_at
  );
end;
$$;

revoke all on function public.service_deletion_request_status(uuid)
  from public, anon;
grant execute on function public.service_deletion_request_status(uuid)
  to authenticated, service_role;
