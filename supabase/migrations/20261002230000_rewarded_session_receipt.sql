-- Read-only, subject-scoped SSV receipt. Aggregate time is not session verification.
create or replace function public.rewarded_session_verified(p_session_token text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.rewarded_ad_sessions
    where user_id = auth.uid() and session_token = p_session_token
      and consumed_at is not null and transaction_id is not null
  );
$$;
revoke all on function public.rewarded_session_verified(text) from public, anon;
grant execute on function public.rewarded_session_verified(text) to authenticated;
