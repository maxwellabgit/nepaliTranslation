-- H6: server-owned rewarded ad sessions + SSV transaction uniqueness

create table if not exists private.rewarded_ad_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_token text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  transaction_id text unique
);

create index if not exists rewarded_ad_sessions_user_idx
  on private.rewarded_ad_sessions (user_id, created_at desc);

revoke all on table private.rewarded_ad_sessions from public, anon, authenticated;
grant all on table private.rewarded_ad_sessions to service_role;

-- Create a one-time opaque session token (service role only).
create or replace function public.service_create_rewarded_session(
  p_user_id uuid,
  p_ttl_seconds integer default 600
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
  v_expires timestamptz;
begin
  if p_user_id is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if p_ttl_seconds is null or p_ttl_seconds < 60 or p_ttl_seconds > 3600 then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  v_token := encode(gen_random_bytes(24), 'hex');
  v_expires := now() + make_interval(secs => p_ttl_seconds);
  insert into private.rewarded_ad_sessions (user_id, session_token, expires_at)
  values (p_user_id, v_token, v_expires);
  return jsonb_build_object(
    'session_token', v_token,
    'expires_at', v_expires
  );
end;
$$;

revoke all on function public.service_create_rewarded_session(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.service_create_rewarded_session(uuid, integer)
  to service_role;

-- Consume session + apply scheduled rewarded_video grant idempotently by transaction_id.
create or replace function public.service_consume_rewarded_ssv(
  p_user_id uuid,
  p_session_token text,
  p_transaction_id text,
  p_reward_amount integer,
  p_reward_item text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session private.rewarded_ad_sessions%rowtype;
  v_expected_minutes integer;
  v_result jsonb;
begin
  if p_user_id is null or p_session_token is null or p_transaction_id is null then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  select * into v_session
  from private.rewarded_ad_sessions
  where session_token = p_session_token
  for update;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_session.user_id <> p_user_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_session.expires_at < now() then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  if v_session.consumed_at is not null then
    -- Idempotent replay: same transaction already consumed.
    if v_session.transaction_id = p_transaction_id then
      return jsonb_build_object('ok', true, 'duplicate', true);
    end if;
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  select minutes into v_expected_minutes
  from private.reward_schedule('rewarded_video');
  if v_expected_minutes is null then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  -- Ad unit reward_amount must match scheduled minutes (10).
  if p_reward_amount is distinct from v_expected_minutes then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  if p_reward_item is distinct from 'ad_free_minutes' then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  update private.rewarded_ad_sessions
  set consumed_at = now(), transaction_id = p_transaction_id
  where id = v_session.id;

  v_result := public.service_apply_scheduled_reward(
    p_user_id,
    'rewarded_video',
    p_transaction_id
  );
  return jsonb_build_object('ok', true, 'reward', v_result);
end;
$$;

revoke all on function public.service_consume_rewarded_ssv(uuid, text, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.service_consume_rewarded_ssv(uuid, text, text, integer, text)
  to service_role;
