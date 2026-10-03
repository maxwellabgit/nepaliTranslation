-- C9: shared-data deletion uses the current private identity and preserves credits.
-- Historical full identity deletion remains separate; no Apple challenge for shared data.
create or replace function private.purge_shared_contributions(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_hash text;
begin
  for v_hash in
    select distinct si.content_hash from public.review_submissions s
      join private.review_source_items si on si.id = s.source_item_id
      where s.user_id = p_user_id
  loop
    insert into public.review_exclusions (content_hash, reason, source_lineage, actor_user_id, notes)
      values (v_hash, 'consent_withdrawn', 'guest:consent_withdrawn', p_user_id, 'shared-data purge')
      on conflict (content_hash, reason) do nothing;
  end loop;
  delete from public.review_submissions where user_id = p_user_id;
  delete from private.contributor_alerts where user_id = p_user_id;
  delete from public.contribution_media where user_id = p_user_id;
  delete from private.submissions where user_id = p_user_id;
  delete from private.task_assignments where user_id = p_user_id;
  -- Accepted reports still contain raw text: erase, rather than just unlink them.
  delete from private.contribution_tasks where reporter_id = p_user_id;
  delete from private.translation_reports where reporter_id = p_user_id;
  delete from public.contribution_receipts where user_id = p_user_id;
  delete from public.sample_allotment_events where user_id = p_user_id;
  delete from private.contributor_stats where user_id = p_user_id;
  update public.profiles set consent_version = null, consented_at = null,
    age_confirmed_at = null, speech_sharing = false, photo_sharing = false,
    deletion_due_at = null, deletion_purged_at = now(), updated_at = now()
    where user_id = p_user_id;
  -- Reward ledger, entitlements, startup acceptance and private auth identity survive.
  insert into private.audit_log (actor_id, action, target, reason)
    values (p_user_id, 'shared_data_deleted', p_user_id::text, 'contributed text/audio removed; credits preserved');
end;
$$;
revoke all on function private.purge_shared_contributions(uuid) from public, anon, authenticated;
grant execute on function private.purge_shared_contributions(uuid) to service_role;

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

  insert into public.profiles (user_id) values (p_user_id) on conflict (user_id) do nothing;
  v_due := now() + interval '30 days';

  update public.profiles
     set consent_withdrawn_at = coalesce(consent_withdrawn_at, now()),
         deletion_due_at = coalesce(deletion_due_at, v_due),
         consent_version = null, consented_at = null, age_confirmed_at = null,
         speech_sharing = false, photo_sharing = false,
         media_cancel_generation = media_cancel_generation + 1,
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

  select deletion_due_at into v_due from public.profiles where user_id = p_user_id;
  perform private.ensure_deletion_request(p_user_id, 'consent_withdrawal');

  return jsonb_build_object(
    'consent_withdrawn_at', now(),
    'deletion_due_at', v_due
  );
end;
$$;

create or replace function public.request_shared_data_deletion()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_result jsonb;
begin
  if v_uid is null then raise exception 'unauthorized' using errcode = '28000'; end if;
  v_result := public.service_withdraw_contribution_consent(v_uid);
  return jsonb_build_object('scheduled', true, 'deletion_due_at', v_result ->> 'deletion_due_at', 'scope', 'contributions');
end;
$$;
revoke all on function public.request_shared_data_deletion() from public, anon;
grant execute on function public.request_shared_data_deletion() to authenticated;

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

  if v_row.request_kind = 'consent_withdrawal' then
    perform private.purge_shared_contributions(v_row.user_id);
  else
    perform private.purge_user_data(v_row.user_id);
  end if;

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

