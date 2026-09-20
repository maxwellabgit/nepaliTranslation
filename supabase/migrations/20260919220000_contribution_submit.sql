-- Slice 05: contribution submit helpers (service_role only).

create or replace function public.service_get_assignment_bundle(
  p_user_id uuid,
  p_assignment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  row jsonb;
begin
  if p_user_id is null or p_assignment_id is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  select jsonb_build_object(
    'assignment_id', a.id,
    'user_id', a.user_id,
    'leased_until', a.leased_until,
    'completed_at', a.completed_at,
    'task_id', t.id,
    'task_type', t.task_type,
    'source_text', t.source_text,
    'model_output', t.model_output,
    'direction', t.direction,
    'formality', t.formality,
    'script', t.script,
    'state', t.state,
    'reference_set_id', t.reference_set_id,
    'references', coalesce((
      select jsonb_agg(kr.normalized_text order by kr.id)
      from private.known_references kr
      where kr.reference_set_id = t.reference_set_id
    ), '[]'::jsonb),
    'contributor_state', coalesce(cs.state, 'normal'),
    'reliability', coalesce(cs.reliability, 0.67)
  )
  into row
  from private.task_assignments a
  join private.contribution_tasks t on t.id = a.task_id
  left join private.contributor_stats cs on cs.user_id = a.user_id
  where a.id = p_assignment_id
    and a.user_id = p_user_id;

  return row;
end;
$$;

revoke all on function public.service_get_assignment_bundle(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.service_get_assignment_bundle(uuid, uuid)
  to service_role;

create or replace function public.service_record_submission(
  p_user_id uuid,
  p_assignment_id uuid,
  p_action text,
  p_raw_response text,
  p_normalized_response text,
  p_model_similarity numeric,
  p_decision_status text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  task uuid;
begin
  if p_user_id is null or p_assignment_id is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  select s.id into new_id
  from private.task_assignments a
  join private.submissions s on s.assignment_id = a.id
  where a.id = p_assignment_id
    and a.user_id = p_user_id
    and a.client_nonce = p_idempotency_key
  order by s.created_at desc
  limit 1;
  if new_id is not null then
    return new_id;
  end if;

  select task_id into task
  from private.task_assignments
  where id = p_assignment_id and user_id = p_user_id
    and completed_at is null
    and leased_until >= now();

  if task is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  insert into private.submissions (
    assignment_id, user_id, action, raw_response, normalized_response,
    model_similarity, decision_status
  ) values (
    p_assignment_id, p_user_id, p_action, p_raw_response, p_normalized_response,
    p_model_similarity, p_decision_status
  )
  returning id into new_id;

  update private.task_assignments
  set completed_at = now(), client_nonce = p_idempotency_key
  where id = p_assignment_id;

  return new_id;
end;
$$;

revoke all on function public.service_record_submission(
  uuid, uuid, text, text, text, numeric, text, text
) from public, anon, authenticated;
grant execute on function public.service_record_submission(
  uuid, uuid, text, text, text, numeric, text, text
) to service_role;

create or replace function public.service_list_task_votes(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_task_id is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', s.user_id,
      'band', case when coalesce(cs.state, 'normal') = 'probation' then 'probation' else 'normal' end,
      'normalized_response', coalesce(s.normalized_response, ''),
      'model_similarity', s.model_similarity
    ) order by s.created_at)
    from private.submissions s
    join private.task_assignments a on a.id = s.assignment_id
    left join private.contributor_stats cs on cs.user_id = s.user_id
    where a.task_id = p_task_id
      and s.action in ('looks_correct', 'edit')
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.service_list_task_votes(uuid)
  from public, anon, authenticated;
grant execute on function public.service_list_task_votes(uuid) to service_role;

create or replace function public.service_apply_contribution_reward(
  p_user_id uuid,
  p_source_id text,
  p_credits integer,
  p_minutes integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  return private.apply_reward(p_user_id, 'contribution', p_source_id, p_credits, p_minutes);
end;
$$;

revoke all on function public.service_apply_contribution_reward(uuid, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.service_apply_contribution_reward(uuid, text, integer, integer)
  to service_role;

create or replace function public.service_bump_known_stats(
  p_user_id uuid,
  p_passed boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.contributor_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update private.contributor_stats
  set
    known_attempts = known_attempts + 1,
    known_passes = known_passes + case when p_passed then 1 else 0 end,
    reliability = least(
      0.95,
      greatest(
        0.2,
        (known_passes + case when p_passed then 1 else 0 end)::numeric
        / nullif(known_attempts + 1, 0)
      )
    ),
    state = case
      when (known_passes + case when p_passed then 1 else 0 end)::numeric
           / nullif(known_attempts + 1, 0) < 0.4
      then 'probation'
      else state
    end
  where user_id = p_user_id;
end;
$$;

revoke all on function public.service_bump_known_stats(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.service_bump_known_stats(uuid, boolean)
  to service_role;
