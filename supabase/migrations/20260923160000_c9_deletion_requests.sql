-- C9: durable deletion request that is not a child of the user's profile row.
-- Withdrawal still updates profiles. This table is the retry record the
-- due executor must keep until storage, database, and auth stages finish.

create table if not exists private.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  request_kind text not null check (request_kind in ('consent_withdrawal', 'account_deletion')),
  user_id uuid not null,
  requested_at timestamptz not null default now(),
  due_at timestamptz not null,
  stage text not null default 'scheduled',
  attempt_count integer not null default 0,
  last_error text,
  next_retry_at timestamptz,
  storage_completed boolean not null default false,
  database_completed boolean not null default false,
  auth_completion text not null default 'not_applicable'
    check (auth_completion in ('not_applicable', 'pending', 'completed', 'failed')),
  completed_at timestamptz
);

create unique index if not exists deletion_requests_open_user_kind
  on private.deletion_requests (user_id, request_kind)
  where completed_at is null;

alter table private.deletion_requests enable row level security;
revoke all on table private.deletion_requests from public, anon, authenticated;
grant all on table private.deletion_requests to service_role;

create or replace function public.service_record_deletion_request(
  p_user_id uuid,
  p_kind text,
  p_requested_at timestamptz
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_due timestamptz;
begin
  if p_user_id is null or p_kind not in ('consent_withdrawal', 'account_deletion') then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  v_due := coalesce(p_requested_at, now()) + interval '30 days';
  select id into v_id
    from private.deletion_requests
   where user_id = p_user_id
     and request_kind = p_kind
     and completed_at is null
   limit 1;
  if v_id is not null then
    return v_id;
  end if;
  insert into private.deletion_requests (
    request_kind, user_id, requested_at, due_at, auth_completion
  ) values (
    p_kind,
    p_user_id,
    coalesce(p_requested_at, now()),
    v_due,
    case when p_kind = 'account_deletion' then 'pending' else 'not_applicable' end
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.service_record_deletion_request(uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.service_record_deletion_request(uuid, text, timestamptz)
  to service_role;
