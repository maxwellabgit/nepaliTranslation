-- Slice 05 fix: return assignment_id with leased public task payloads.

create or replace function private.lease_safe_task(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task_id uuid;
  v_assignment_id uuid;
begin
  select t.id into v_task_id
  from private.contribution_tasks t
  where t.state = 'open'
    and (t.reporter_id is null or t.reporter_id <> p_user_id)
    and not exists (
      select 1
      from private.task_assignments a
      where a.task_id = t.id
        and a.user_id = p_user_id
        and (a.completed_at is not null or a.leased_until > now())
    )
  order by t.created_at
  limit 1
  for update skip locked;

  if v_task_id is null then
    return jsonb_build_object('assignment', null);
  end if;

  insert into private.task_assignments (task_id, user_id, leased_until)
  values (v_task_id, p_user_id, now() + interval '15 minutes')
  on conflict (task_id, user_id) do update
    set leased_until = excluded.leased_until,
        completed_at = null
  returning id into v_assignment_id;

  return private.public_task_json(v_task_id)
    || jsonb_build_object('assignment_id', v_assignment_id);
end;
$$;

revoke all on function private.lease_safe_task(uuid) from public, anon, authenticated;
grant execute on function private.lease_safe_task(uuid) to service_role;
