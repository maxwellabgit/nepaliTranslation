begin;
select no_plan();

select is(
  (private.apply_reward(
    '11111111-1111-4111-8111-111111111111',
    'known_check',
    'idem-src-1',
    1,
    5
  ) ->> 'applied')::boolean,
  true,
  'first grant applies'
);

select is(
  (private.apply_reward(
    '11111111-1111-4111-8111-111111111111',
    'known_check',
    'idem-src-1',
    1,
    5
  ) ->> 'applied')::boolean,
  false,
  'duplicate source id does not apply again'
);

select is(
  (select count(*)::int from public.reward_ledger where source_id = 'idem-src-1'),
  1,
  'one ledger row for a duplicate source id'
);

select is(
  (select lifetime_credits from public.earned_entitlements
    where user_id = '11111111-1111-4111-8111-111111111111'),
  1,
  'lifetime credits increase once'
);

select ok(
  (select earned_ad_free_until > now() from public.earned_entitlements
    where user_id = '11111111-1111-4111-8111-111111111111'),
  'earned window is in the future after a grant'
);

-- Second distinct source stacks on the later of now and current expiry.
select private.apply_reward(
  '11111111-1111-4111-8111-111111111111',
  'known_check',
  'idem-src-2',
  3,
  15
);

select is(
  (select lifetime_credits from public.earned_entitlements
    where user_id = '11111111-1111-4111-8111-111111111111'),
  4,
  'second distinct grant stacks credits'
);

select * from finish();
rollback;
