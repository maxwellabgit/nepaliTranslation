begin;
select no_plan();
create temporary table receipt_sessions as
select public.service_create_rewarded_session(
  '11111111-1111-4111-8111-111111111111', 600
) ->> 'session_token' as token;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select is(public.rewarded_session_verified((select token from receipt_sessions)), false,
  'own unconsumed session is not verified');
select public.service_consume_rewarded_ssv('11111111-1111-4111-8111-111111111111',
  (select token from receipt_sessions), 'receipt-test-transaction', 20, 'ad_free_minutes');
select is(public.rewarded_session_verified((select token from receipt_sessions)), true,
  'own consumed SSV session is verified');
select is(public.rewarded_session_verified('unrelated-session'), false,
  'aggregate entitlement cannot verify a different session');
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select is(public.rewarded_session_verified((select token from receipt_sessions)), false,
  'another account cannot read session verification');
select is(has_function_privilege('anon', 'public.rewarded_session_verified(text)', 'execute'), false,
  'guests cannot query receipts');
select * from finish();
rollback;
