-- F6: RevenueCat subscription apply + idempotency.
begin;
select plan(6);

select ok(
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'purchased_subscriptions'
  ),
  'purchased_subscriptions table exists'
);

select lives_ok(
  $$select public.service_apply_revenuecat_event(
    'rc_evt_1',
    'hash1',
    '11111111-1111-4111-8111-111111111111',
    'INITIAL_PURCHASE',
    'neptranslate_adfree_monthly',
    now() + interval '30 days'
  )$$,
  'initial purchase applies'
);

select results_eq(
  $$select status from public.purchased_subscriptions
    where user_id = '11111111-1111-4111-8111-111111111111'$$,
  $$values ('active'::text)$$,
  'subscription active after purchase'
);

select results_eq(
  $$select (public.service_apply_revenuecat_event(
    'rc_evt_1',
    'hash1',
    '11111111-1111-4111-8111-111111111111',
    'INITIAL_PURCHASE',
    'neptranslate_adfree_monthly',
    now() + interval '30 days'
  )->>'duplicate')::boolean$$,
  $$values (true)$$,
  'duplicate event is idempotent'
);

select lives_ok(
  $$select public.service_apply_revenuecat_event(
    'rc_evt_2',
    'hash2',
    '11111111-1111-4111-8111-111111111111',
    'EXPIRATION',
    'neptranslate_adfree_monthly',
    now() - interval '1 day'
  )$$,
  'expiration applies'
);

select results_eq(
  $$select status from public.purchased_subscriptions
    where user_id = '11111111-1111-4111-8111-111111111111'$$,
  $$values ('expired'::text)$$,
  'subscription expired after EXPIRATION'
);

select * from finish();
rollback;
