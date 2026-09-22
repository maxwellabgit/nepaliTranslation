begin;
select no_plan();

-- Server-owned session + SSV consume creates exactly one ledger row; replay is idempotent.
create temporary table tmp_ssv_session as
select (
  public.service_create_rewarded_session(
    '11111111-1111-4111-8111-111111111111',
    600
  ) ->> 'session_token'
) as token;

select ok(
  (select token is not null and length(token) >= 32 from tmp_ssv_session),
  'service_create_rewarded_session returns opaque token'
);

select is(
  (public.service_consume_rewarded_ssv(
    '11111111-1111-4111-8111-111111111111',
    (select token from tmp_ssv_session),
    'ssv-tx-h6-1',
    15,
    'ad_free_minutes'
  ) ->> 'ok')::boolean,
  true,
  'first verified SSV consume applies scheduled reward'
);

select is(
  (select count(*)::int from public.reward_ledger where source_id = 'ssv-tx-h6-1'),
  1,
  'SSV grant writes exactly one ledger row'
);

select is(
  (public.service_consume_rewarded_ssv(
    '11111111-1111-4111-8111-111111111111',
    (select token from tmp_ssv_session),
    'ssv-tx-h6-1',
    10,
    'ad_free_minutes'
  ) ->> 'duplicate')::boolean,
  true,
  'SSV replay with same transaction_id is duplicate'
);

select is(
  (select count(*)::int from public.reward_ledger where source_id = 'ssv-tx-h6-1'),
  1,
  'SSV replay does not add a second ledger row'
);

-- Wrong reward amount must not grant.
create temporary table tmp_ssv_session_bad as
select (
  public.service_create_rewarded_session(
    '22222222-2222-4222-8222-222222222222',
    600
  ) ->> 'session_token'
) as token;

select throws_ok(
  format(
    $fmt$select public.service_consume_rewarded_ssv(
      '22222222-2222-4222-8222-222222222222',
      %L,
      'ssv-tx-bad-amt',
      99,
      'ad_free_minutes'
    )$fmt$,
    (select token from tmp_ssv_session_bad)
  ),
  '22023',
  null,
  'wrong reward_amount is rejected'
);

select is(
  (select count(*)::int from public.reward_ledger where source_id = 'ssv-tx-bad-amt'),
  0,
  'rejected SSV does not create a ledger row'
);

-- Authenticated clients cannot call consume / scheduled reward directly (no permanent
-- ledger path from client reward callback without verified SSV edge function).
select is(
  has_function_privilege(
    'authenticated',
    'public.service_consume_rewarded_ssv(uuid, text, text, integer, text)',
    'execute'
  ),
  false,
  'authenticated cannot execute service_consume_rewarded_ssv'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.service_apply_scheduled_reward(uuid, text, text)',
    'execute'
  ),
  false,
  'authenticated cannot execute service_apply_scheduled_reward'
);

select * from finish();
rollback;
