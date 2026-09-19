-- Account deletion purge and server-only consent updates.
-- Clients still cannot write profiles, receipts, or the ledger.

create or replace function private.purge_user_data(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.translation_reports
  where reporter_id = p_user_id
    and status is distinct from 'accepted';

  update private.translation_reports
  set reporter_id = null
  where reporter_id = p_user_id;

  update private.contribution_tasks
  set reporter_id = null
  where reporter_id = p_user_id;

  delete from private.submissions where user_id = p_user_id;
  delete from private.task_assignments where user_id = p_user_id;

  delete from public.contribution_receipts where user_id = p_user_id;
  delete from public.reward_ledger where user_id = p_user_id;
  delete from public.earned_entitlements where user_id = p_user_id;
  delete from public.profiles where user_id = p_user_id;
  delete from private.contributor_stats where user_id = p_user_id;

  insert into private.audit_log (actor_id, action, target, reason)
  values (p_user_id, 'delete_account', p_user_id::text, 'user requested deletion');
end;
$$;

revoke all on function private.purge_user_data(uuid) from public, anon, authenticated;

create or replace function public.service_purge_user_data(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  perform private.purge_user_data(p_user_id);
end;
$$;

revoke all on function public.service_purge_user_data(uuid) from public, anon, authenticated;
grant execute on function public.service_purge_user_data(uuid) to service_role;

create or replace function public.service_record_consent(
  p_user_id uuid,
  p_version text,
  p_age_confirmed boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null or p_age_confirmed is not true or p_version is null then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  update public.profiles
  set
    consent_version = p_version,
    consented_at = now(),
    age_confirmed_at = now(),
    updated_at = now()
  where user_id = p_user_id;
end;
$$;

revoke all on function public.service_record_consent(uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.service_record_consent(uuid, text, boolean)
  to service_role;

-- Server-owned resume pointer. Clients cannot write or read this table.
create table private.account_deletion_progress (
  user_id uuid primary key,
  completed text[] not null default '{}',
  updated_at timestamptz not null default now()
);

revoke all on table private.account_deletion_progress from public, anon, authenticated;

create or replace function public.service_get_deletion_progress(p_user_id uuid)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  found text[];
begin
  if p_user_id is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  select completed into found
  from private.account_deletion_progress
  where user_id = p_user_id;
  return coalesce(found, '{}'::text[]);
end;
$$;

revoke all on function public.service_get_deletion_progress(uuid)
  from public, anon, authenticated;
grant execute on function public.service_get_deletion_progress(uuid) to service_role;

create or replace function public.service_set_deletion_progress(
  p_user_id uuid,
  p_completed text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  insert into private.account_deletion_progress (user_id, completed, updated_at)
  values (p_user_id, coalesce(p_completed, '{}'::text[]), now())
  on conflict (user_id) do update
  set completed = excluded.completed,
      updated_at = now();
end;
$$;

revoke all on function public.service_set_deletion_progress(uuid, text[])
  from public, anon, authenticated;
grant execute on function public.service_set_deletion_progress(uuid, text[]) to service_role;

create or replace function public.service_record_apple_revoke(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  insert into private.audit_log (actor_id, action, target, reason)
  values (
    p_user_id,
    'apple_authorization_revoked',
    p_user_id::text,
    'authorization revoked before account data purge'
  );
end;
$$;

revoke all on function public.service_record_apple_revoke(uuid)
  from public, anon, authenticated;
grant execute on function public.service_record_apple_revoke(uuid) to service_role;
