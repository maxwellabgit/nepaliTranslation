-- Word-count tiers, deferred sign-in delivery, and the 12-hour timer cap.

begin;
select no_plan();

select is(private.count_source_words(E'one two three four\n'), 4, 'trailing newline is not an extra word');
select is(private.count_source_words(E'\n\n'), 0, 'newline-only source is empty');
select is(private.scheduled_credits_for_words(4), 1, '4 words -> 1 credit');
select is(private.scheduled_credits_for_words(5), 2, '5 words -> 2 credits');
select is(private.scheduled_credits_for_words(6), 2, '6 words -> 2 credits');
select is(private.scheduled_credits_for_words(7), 3, '7 or more words -> 3 credits');

select is(
  (select credits from private.reward_schedule('public_review_long')),
  3,
  'long review schedule is 3 credits'
);

select is(
  (select minutes from private.reward_schedule('public_review_long')),
  30,
  'long review schedule is 30 minutes'
);

-- A public review is recorded now and starts the clock only at claim.
select is(
  (private.apply_reward(
    '11111111-1111-4111-8111-111111111111',
    'public_review',
    'tier-defer-1',
    3,
    999
  ) ->> 'deferred')::boolean,
  true,
  'public review grant is deferred to sign-in'
);

select is(
  (select coalesce(lifetime_credits, 0) from public.earned_entitlements
    where user_id = '11111111-1111-4111-8111-111111111111'),
  0,
  'deferred grant does not move lifetime credits yet'
);

create temp table claim_once as
select private.claim_pending_rewards('11111111-1111-4111-8111-111111111111') as result;

select is(
  (select (result ->> 'credits')::int from claim_once),
  3,
  'next sign-in claims the 3 credits'
);

select is(
  (select (result ->> 'minutes_applied')::int from claim_once),
  30,
  'claim adds 30 minutes'
);

select is(
  (select lifetime_credits from public.earned_entitlements
    where user_id = '11111111-1111-4111-8111-111111111111'),
  3,
  'lifetime credits increase at claim'
);

select is(
  (private.claim_pending_rewards('11111111-1111-4111-8111-111111111111') ->> 'credits')::int,
  0,
  'a second sign-in does not grant the same review again'
);

-- Time still left is kept. The clock stops at 12 hours.
select private.apply_reward(
  '22222222-2222-4222-8222-222222222222',
  'known_check',
  'tier-cap-seed',
  1,
  10
);

update public.earned_entitlements
set earned_ad_free_until = now() + interval '11 hours'
where user_id = '22222222-2222-4222-8222-222222222222';

create temp table cap_grant as
select private.apply_reward(
  '22222222-2222-4222-8222-222222222222',
  'known_check',
  'tier-cap-stack',
  30,
  300
) as result;

select ok(
  (select earned_ad_free_until
     between now() + interval '12 hours' - interval '5 seconds'
         and now() + interval '12 hours' + interval '5 seconds'
   from public.earned_entitlements
   where user_id = '22222222-2222-4222-8222-222222222222'),
  'stacking stops at 12 hours'
);

select is(
  (select (result ->> 'capped')::boolean from cap_grant),
  true,
  'the stacked grant reports that the 12-hour cap bound it'
);

select * from finish();
rollback;
