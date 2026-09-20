begin;
select no_plan();

-- Daily contribution cap is 60 credits.
select is(
  (private.apply_reward(
    '11111111-1111-4111-8111-111111111111',
    'contribution',
    'cap-src-1',
    60,
    5
  ) ->> 'applied')::boolean,
  true,
  'grant up to the daily contribution cap applies'
);

select is(
  (private.apply_reward(
    '11111111-1111-4111-8111-111111111111',
    'contribution',
    'cap-src-2',
    1,
    5
  ) ->> 'reason'),
  'daily_cap',
  'credits beyond the UTC daily cap are rejected'
);

select is(
  (public.service_apply_scheduled_reward(
    '22222222-2222-4222-8222-222222222222',
    'known_check',
    'sched-known-1'
  ) ->> 'applied')::boolean,
  true,
  'scheduled known_check grant applies'
);

select is(
  (private.apply_reward(
    '11111111-1111-4111-8111-111111111111',
    'contribution',
    'cap-src-1',
    1,
    5
  ) ->> 'reason'),
  'duplicate',
  'replay of an applied grant at the daily cap is still duplicate, not daily_cap'
);

select is(
  (select credits from public.reward_ledger where source_id = 'sched-known-1'),
  1,
  'known_check schedule is 1 credit'
);

-- Video cap is independent of contribution credits.
select is(
  (private.apply_reward(
    '11111111-1111-4111-8111-111111111111',
    'rewarded_video',
    'vid-src-1',
    12,
    10
  ) ->> 'applied')::boolean,
  true,
  'video grants apply up to the 12-credit video cap'
);

select is(
  (private.apply_reward(
    '11111111-1111-4111-8111-111111111111',
    'rewarded_video',
    'vid-src-2',
    1,
    10
  ) ->> 'reason'),
  'daily_cap',
  'video credits beyond the UTC daily video cap are rejected'
);

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.service_apply_scheduled_reward(
    '11111111-1111-4111-8111-111111111111',
    'known_check',
    'auth-blocked'
  )$$,
  '42501'
);

select * from finish();
rollback;
