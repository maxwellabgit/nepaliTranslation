-- F6: purchased subscription state for RevenueCat webhook + client read.
create table if not exists public.purchased_subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null default 'none'
    check (status in ('none', 'active', 'expired', 'billing_retry', 'cancelled')),
  product_id text,
  expires_at timestamptz,
  rc_app_user_id text,
  last_event_id text,
  updated_at timestamptz not null default now()
);

revoke all on table public.purchased_subscriptions from public, anon, authenticated;
grant select on table public.purchased_subscriptions to authenticated;
grant all on table public.purchased_subscriptions to service_role;

alter table public.purchased_subscriptions enable row level security;

drop policy if exists purchased_subscriptions_select_own on public.purchased_subscriptions;
create policy purchased_subscriptions_select_own
  on public.purchased_subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.service_apply_revenuecat_event(
  p_provider_event_id text,
  p_payload_hash text,
  p_app_user_id text,
  p_event_type text,
  p_product_id text default null,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_user uuid;
  v_status text;
  v_existing private.webhook_events%rowtype;
begin
  if p_provider_event_id is null or length(trim(p_provider_event_id)) = 0 then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  if p_app_user_id is null or length(trim(p_app_user_id)) = 0 then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  select * into v_existing
  from private.webhook_events
  where provider = 'revenuecat' and provider_event_id = p_provider_event_id;

  if found and v_existing.processing_status = 'processed' then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  if not found then
    insert into private.webhook_events (provider, provider_event_id, payload_hash, processing_status)
    values ('revenuecat', p_provider_event_id, coalesce(p_payload_hash, ''), 'received');
  end if;

  begin
    v_user := p_app_user_id::uuid;
  exception when others then
    raise exception 'invalid_payload' using errcode = '22023';
  end;

  if not exists (select 1 from auth.users where id = v_user) then
    update private.webhook_events
    set processing_status = 'ignored_unknown_user'
    where provider = 'revenuecat' and provider_event_id = p_provider_event_id;
    return jsonb_build_object('ok', true, 'ignored', true);
  end if;

  v_status := case upper(coalesce(p_event_type, ''))
    when 'INITIAL_PURCHASE' then 'active'
    when 'RENEWAL' then 'active'
    when 'UNCANCELLATION' then 'active'
    when 'PRODUCT_CHANGE' then 'active'
    when 'NON_RENEWING_PURCHASE' then 'active'
    when 'BILLING_ISSUE' then 'billing_retry'
    when 'CANCELLATION' then 'cancelled'
    when 'EXPIRATION' then 'expired'
    when 'SUBSCRIBER_ALIAS' then null
    else null
  end;

  if v_status is null then
    update private.webhook_events
    set processing_status = 'processed'
    where provider = 'revenuecat' and provider_event_id = p_provider_event_id;
    return jsonb_build_object('ok', true, 'ignored_event', true);
  end if;

  insert into public.purchased_subscriptions as ps (
    user_id, status, product_id, expires_at, rc_app_user_id, last_event_id, updated_at
  ) values (
    v_user, v_status, p_product_id, p_expires_at, p_app_user_id, p_provider_event_id, now()
  )
  on conflict (user_id) do update set
    status = excluded.status,
    product_id = coalesce(excluded.product_id, ps.product_id),
    expires_at = coalesce(excluded.expires_at, ps.expires_at),
    rc_app_user_id = excluded.rc_app_user_id,
    last_event_id = excluded.last_event_id,
    updated_at = now();

  update private.webhook_events
  set processing_status = 'processed'
  where provider = 'revenuecat' and provider_event_id = p_provider_event_id;

  return jsonb_build_object('ok', true, 'status', v_status);
end;
$$;

revoke all on function public.service_apply_revenuecat_event(text, text, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.service_apply_revenuecat_event(text, text, text, text, text, timestamptz) to service_role;
