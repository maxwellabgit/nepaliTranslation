begin;
do $support_apply$ begin
if not exists(select 1 from supabase_migrations.schema_migrations where version='20261004020000') then
execute $support_source$-- C6: explicit-purpose support is separate from model-improvement consent.
-- No translation history/audio attachments, email collection or training export.
create table private.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null,
  category text not null check (category in ('general', 'ad')),
  message text not null check (length(btrim(message)) between 1 and 2000),
  app_version text not null check (length(app_version) between 1 and 40),
  reply text check (reply is null or length(btrim(reply)) between 1 and 2000),
  created_at timestamptz not null default now(),
  replied_at timestamptz,
  unique(user_id, client_id)
);
alter table private.support_requests enable row level security;
revoke all on private.support_requests from public, anon, authenticated;
grant all on private.support_requests to service_role;

create function public.support_submit(p_client_id uuid, p_message text, p_category text, p_app_version text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_row private.support_requests;
begin
  if v_uid is null then raise exception 'unauthorized' using errcode='28000'; end if;
  if p_client_id is null or p_message is null or length(btrim(p_message)) not between 1 and 2000
    or p_category is null or p_category not in ('general','ad')
    or p_app_version is null or length(p_app_version) not between 1 and 40 then
    raise exception 'invalid_payload' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('support:' || v_uid::text, 0));
  select * into v_row from private.support_requests where user_id=v_uid and client_id=p_client_id;
  if found then
    -- A lost acknowledgement may be retried after an app update. Retain the
    -- original version without rejecting otherwise identical owner-bound text.
    if v_row.message <> btrim(p_message) or v_row.category <> p_category then
      raise exception 'already_submitted' using errcode='23505';
    end if;
    return jsonb_build_object('id',v_row.id);
  end if;
  if (select count(*) from private.support_requests where user_id=v_uid) >= 50
    or not private.check_rate_limit('support:' || v_uid::text, 10, 86400) then
    raise exception 'rate_limited' using errcode='P0001';
  end if;
  insert into private.support_requests(user_id,client_id,category,message,app_version)
    values(v_uid,p_client_id,p_category,btrim(p_message),p_app_version) returning * into v_row;
  return jsonb_build_object('id',v_row.id);
end $$;

create function public.support_list()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_rows jsonb;
begin
  if v_uid is null then raise exception 'unauthorized' using errcode='28000'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'category',category,'message',message,'reply',reply,
    'created_at',created_at,'replied_at',replied_at) order by created_at desc),'[]'::jsonb)
    into v_rows from private.support_requests where user_id=v_uid;
  return v_rows;
end $$;

create function public.support_delete(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'unauthorized' using errcode='28000'; end if;
  delete from private.support_requests where id=p_id and user_id=v_uid;
  return jsonb_build_object('deleted',true);
end $$;
revoke all on function public.support_submit(uuid,text,text,text), public.support_list(), public.support_delete(uuid) from public, anon;
grant execute on function public.support_submit(uuid,text,text,text), public.support_list(), public.support_delete(uuid) to authenticated;

create function public.service_admin_support(p_actor_id uuid, p_id uuid default null, p_reply text default null, p_before timestamptz default null, p_before_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_rows jsonb; v_cursor jsonb;
begin
  perform public.service_assert_admin(p_actor_id);
  if (p_before is null) <> (p_before_id is null) then raise exception 'invalid_payload' using errcode='22023'; end if;
  if p_id is not null then
    if p_reply is null or length(btrim(p_reply)) not between 1 and 2000 then
      raise exception 'invalid_payload' using errcode='22023';
    end if;
    update private.support_requests set reply=btrim(p_reply),replied_at=now() where id=p_id;
    if not found then raise exception 'not_found' using errcode='P0002'; end if;
  elsif p_reply is not null then raise exception 'invalid_payload' using errcode='22023';
  end if;
  insert into private.audit_log(actor_id,action,target)
    values(p_actor_id,case when p_id is null then 'admin_support_read' else 'admin_support_reply' end,coalesce(p_id::text,'support'));
  with page as (
    select * from private.support_requests where p_before is null or (created_at,id) < (p_before,p_before_id)
    order by created_at desc,id desc limit 101
  ), delivered as (select * from page order by created_at desc,id desc limit 100)
  select coalesce(jsonb_agg(to_jsonb(r) - 'client_id' order by r.created_at desc,r.id desc),'[]'::jsonb),
    case when (select count(*) from page)>100 then (select jsonb_build_object('created_at',created_at,'id',id)
      from delivered order by created_at,id limit 1) else null end
    into v_rows,v_cursor from delivered r;
  return jsonb_build_object('requests',v_rows,'next_cursor',v_cursor);
end $$;
revoke all on function public.service_admin_support(uuid,uuid,text,timestamptz,uuid) from public, anon, authenticated;
grant execute on function public.service_admin_support(uuid,uuid,text,timestamptz,uuid) to service_role;
$support_source$;
insert into supabase_migrations.schema_migrations(version,name,statements) values('20261004020000','private_support',array[$support_source$-- C6: explicit-purpose support is separate from model-improvement consent.
-- No translation history/audio attachments, email collection or training export.
create table private.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null,
  category text not null check (category in ('general', 'ad')),
  message text not null check (length(btrim(message)) between 1 and 2000),
  app_version text not null check (length(app_version) between 1 and 40),
  reply text check (reply is null or length(btrim(reply)) between 1 and 2000),
  created_at timestamptz not null default now(),
  replied_at timestamptz,
  unique(user_id, client_id)
);
alter table private.support_requests enable row level security;
revoke all on private.support_requests from public, anon, authenticated;
grant all on private.support_requests to service_role;

create function public.support_submit(p_client_id uuid, p_message text, p_category text, p_app_version text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_row private.support_requests;
begin
  if v_uid is null then raise exception 'unauthorized' using errcode='28000'; end if;
  if p_client_id is null or p_message is null or length(btrim(p_message)) not between 1 and 2000
    or p_category is null or p_category not in ('general','ad')
    or p_app_version is null or length(p_app_version) not between 1 and 40 then
    raise exception 'invalid_payload' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('support:' || v_uid::text, 0));
  select * into v_row from private.support_requests where user_id=v_uid and client_id=p_client_id;
  if found then
    -- A lost acknowledgement may be retried after an app update. Retain the
    -- original version without rejecting otherwise identical owner-bound text.
    if v_row.message <> btrim(p_message) or v_row.category <> p_category then
      raise exception 'already_submitted' using errcode='23505';
    end if;
    return jsonb_build_object('id',v_row.id);
  end if;
  if (select count(*) from private.support_requests where user_id=v_uid) >= 50
    or not private.check_rate_limit('support:' || v_uid::text, 10, 86400) then
    raise exception 'rate_limited' using errcode='P0001';
  end if;
  insert into private.support_requests(user_id,client_id,category,message,app_version)
    values(v_uid,p_client_id,p_category,btrim(p_message),p_app_version) returning * into v_row;
  return jsonb_build_object('id',v_row.id);
end $$;

create function public.support_list()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_rows jsonb;
begin
  if v_uid is null then raise exception 'unauthorized' using errcode='28000'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'category',category,'message',message,'reply',reply,
    'created_at',created_at,'replied_at',replied_at) order by created_at desc),'[]'::jsonb)
    into v_rows from private.support_requests where user_id=v_uid;
  return v_rows;
end $$;

create function public.support_delete(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'unauthorized' using errcode='28000'; end if;
  delete from private.support_requests where id=p_id and user_id=v_uid;
  return jsonb_build_object('deleted',true);
end $$;
revoke all on function public.support_submit(uuid,text,text,text), public.support_list(), public.support_delete(uuid) from public, anon;
grant execute on function public.support_submit(uuid,text,text,text), public.support_list(), public.support_delete(uuid) to authenticated;

create function public.service_admin_support(p_actor_id uuid, p_id uuid default null, p_reply text default null, p_before timestamptz default null, p_before_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_rows jsonb; v_cursor jsonb;
begin
  perform public.service_assert_admin(p_actor_id);
  if (p_before is null) <> (p_before_id is null) then raise exception 'invalid_payload' using errcode='22023'; end if;
  if p_id is not null then
    if p_reply is null or length(btrim(p_reply)) not between 1 and 2000 then
      raise exception 'invalid_payload' using errcode='22023';
    end if;
    update private.support_requests set reply=btrim(p_reply),replied_at=now() where id=p_id;
    if not found then raise exception 'not_found' using errcode='P0002'; end if;
  elsif p_reply is not null then raise exception 'invalid_payload' using errcode='22023';
  end if;
  insert into private.audit_log(actor_id,action,target)
    values(p_actor_id,case when p_id is null then 'admin_support_read' else 'admin_support_reply' end,coalesce(p_id::text,'support'));
  with page as (
    select * from private.support_requests where p_before is null or (created_at,id) < (p_before,p_before_id)
    order by created_at desc,id desc limit 101
  ), delivered as (select * from page order by created_at desc,id desc limit 100)
  select coalesce(jsonb_agg(to_jsonb(r) - 'client_id' order by r.created_at desc,r.id desc),'[]'::jsonb),
    case when (select count(*) from page)>100 then (select jsonb_build_object('created_at',created_at,'id',id)
      from delivered order by created_at,id limit 1) else null end
    into v_rows,v_cursor from delivered r;
  return jsonb_build_object('requests',v_rows,'next_cursor',v_cursor);
end $$;
revoke all on function public.service_admin_support(uuid,uuid,text,timestamptz,uuid) from public, anon, authenticated;
grant execute on function public.service_admin_support(uuid,uuid,text,timestamptz,uuid) to service_role;
$support_source$]);
end if; end $support_apply$;
select version,name from supabase_migrations.schema_migrations where version='20261004020000';
commit;
