-- F4 follow-up: list due deletions for Edge cron; audit purge completion.

create or replace function public.service_list_deletion_due_users(p_limit integer default 50)
returns table (user_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  return query
    select p.user_id
    from public.profiles p
    where p.deletion_requested_at is not null
      and p.deletion_due_at is not null
      and p.deletion_due_at <= now()
      and p.deletion_purged_at is null
    order by p.deletion_due_at
    limit p_limit;
end;
$$;

revoke all on function public.service_list_deletion_due_users(integer)
  from public, anon, authenticated;
grant execute on function public.service_list_deletion_due_users(integer) to service_role;

-- Mark purge intent before rows disappear (completion audit for admin + jobs).
create or replace function public.service_process_deletion_jobs(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec record;
  v_processed integer := 0;
begin
  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  for rec in
    select p.user_id
    from public.profiles p
    where p.deletion_requested_at is not null
      and p.deletion_due_at is not null
      and p.deletion_due_at <= now()
      and p.deletion_purged_at is null
    order by p.deletion_due_at
    limit p_limit
    for update of p
  loop
    update public.profiles
    set deletion_purged_at = now(), updated_at = now()
    where user_id = rec.user_id;

    insert into private.audit_log (actor_id, action, target, reason)
    values (
      rec.user_id,
      'deletion_purge_complete',
      rec.user_id::text,
      '30-day deletion job purged personal data'
    );

    perform private.purge_user_data(rec.user_id);
    v_processed := v_processed + 1;
  end loop;

  return jsonb_build_object('processed', v_processed);
end;
$$;

create or replace function public.service_purge_scheduled_deletion(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_due timestamptz;
begin
  if p_user_id is null then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  select deletion_due_at into v_due
  from public.profiles
  where user_id = p_user_id
    and deletion_requested_at is not null
    and deletion_purged_at is null
  for update;

  if v_due is null or v_due > now() then
    return jsonb_build_object('purged', false, 'reason', 'not_due');
  end if;

  update public.profiles
  set deletion_purged_at = now(), updated_at = now()
  where user_id = p_user_id;

  insert into private.audit_log (actor_id, action, target, reason)
  values (
    p_user_id,
    'deletion_purge_complete',
    p_user_id::text,
    '30-day deletion job purged personal data'
  );

  perform private.purge_user_data(p_user_id);
  return jsonb_build_object('purged', true, 'user_id', p_user_id);
end;
$$;

revoke all on function public.service_purge_scheduled_deletion(uuid)
  from public, anon, authenticated;
grant execute on function public.service_purge_scheduled_deletion(uuid) to service_role;
