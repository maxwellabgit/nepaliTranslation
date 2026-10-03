begin;
do $dispatch_apply$ begin
if not exists (select 1 from supabase_migrations.schema_migrations where version='20261003003000') then
execute $dispatch_source$-- A thirty-day deletion deadline is an upper bound, not a waiting period.
-- Dispatch consent withdrawals immediately, retaining the original deadline,
-- backoff, storage-before-database stages and historical identity scheduling.
create or replace function public.service_list_due_deletion_requests(p_limit integer default 50)
returns table (id uuid, user_id uuid, request_kind text, storage_completed boolean,
  database_completed boolean, auth_completion text)
language plpgsql security definer set search_path = '' as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  return query select d.id, d.user_id, d.request_kind, d.storage_completed,
    d.database_completed, d.auth_completion
  from private.deletion_requests d
  where d.completed_at is null
    and (d.request_kind = 'consent_withdrawal' or d.due_at <= now())
    and (d.next_retry_at is null or d.next_retry_at <= now())
  order by d.due_at, d.requested_at
  limit p_limit;
end;
$$;
revoke all on function public.service_list_due_deletion_requests(integer) from public, anon, authenticated;
grant execute on function public.service_list_due_deletion_requests(integer) to service_role;
$dispatch_source$;
insert into supabase_migrations.schema_migrations(version,name,statements) values ('20261003003000','guest_deletion_dispatch',array[$dispatch_source$-- A thirty-day deletion deadline is an upper bound, not a waiting period.
-- Dispatch consent withdrawals immediately, retaining the original deadline,
-- backoff, storage-before-database stages and historical identity scheduling.
create or replace function public.service_list_due_deletion_requests(p_limit integer default 50)
returns table (id uuid, user_id uuid, request_kind text, storage_completed boolean,
  database_completed boolean, auth_completion text)
language plpgsql security definer set search_path = '' as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  return query select d.id, d.user_id, d.request_kind, d.storage_completed,
    d.database_completed, d.auth_completion
  from private.deletion_requests d
  where d.completed_at is null
    and (d.request_kind = 'consent_withdrawal' or d.due_at <= now())
    and (d.next_retry_at is null or d.next_retry_at <= now())
  order by d.due_at, d.requested_at
  limit p_limit;
end;
$$;
revoke all on function public.service_list_due_deletion_requests(integer) from public, anon, authenticated;
grant execute on function public.service_list_due_deletion_requests(integer) to service_role;
$dispatch_source$]);
end if; end $dispatch_apply$;
select version,name from supabase_migrations.schema_migrations where version='20261003003000';
commit;
