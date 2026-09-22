-- G1: global daily public-review pool.
--
-- Contract (see .governance/V1_G0_DECISIONS.md):
--   D1 one global window per NY day; rotation at 5:00 PM America/New_York
--       closes the prior window, grants credits, and opens a new 10-item
--       window at random from the eligible pool.
--   D2 all datasets + training + benchmarks are eligible after PII/dedup.
--       Submissions never re-enter training/benchmarks automatically.
--   D6 1 credit = 15 minutes; top-50%-longest at assignment = 2 credits.
--       No clawback; late reject creates an alert only.

begin;
select no_plan();

-- Seed 20 synthetic review source items with a spread of lengths so
-- percent_rank halves the pool exactly.
delete from private.review_source_items where origin like 'test:g1%';

insert into private.review_source_items (
  content_hash, origin, direction, register, script,
  source_text, proposed_target, license_note, metadata,
  source_char_length, pii_flag, public_review_eligible
)
select
  'g1-hash-' || i::text,
  'test:g1',
  case when i % 2 = 0 then 'en-ne' else 'ne-en' end,
  'unspecified',
  'unspecified',
  repeat('x', i * 10),
  repeat('y', i * 8),
  null,
  '{}'::jsonb,
  i * 10,
  false,
  true
from generate_series(1, 20) as g(i);

-- Refresh length tiers: top 50% should be tier 2, else tier 1.
select is(private.refresh_review_length_tiers(), 20, 'tier refresh updates 20 items');

select is(
  (select count(*)::int from private.review_source_items where origin = 'test:g1' and length_tier = 2),
  10,
  'top-50%-longest -> tier 2 for 10 items'
);

select is(
  (select count(*)::int from private.review_source_items where origin = 'test:g1' and length_tier = 1),
  10,
  'bottom half -> tier 1 for 10 items'
);

-- Rotation opens a new window with exactly 10 items.
-- Clear any prior windows so the test is deterministic.
delete from public.review_submissions;
delete from public.review_window_items;
delete from public.review_windows;

-- R1 rotation is guarded by ny_close_at > p_as_of (not_due). Tests must
-- pass a p_as_of far in the future to force each rotation to close its
-- open window. Two calendar days is enough to pass any DST boundary.
select ok(
  ((public.service_rotate_review_window(
      10::smallint,
      (now() + interval '2 day')::timestamptz
    ))->>'new_window_size')::int = 10,
  'rotation opens a new window with 10 items'
);

select is(
  (select count(*)::int from public.review_windows where state = 'open'),
  1,
  'exactly one open window after rotation'
);

select is(
  (select count(*)::int from public.review_window_items
    where window_id = (select id from public.review_windows where state = 'open')),
  10,
  '10 slot rows in the open window'
);

-- Every scheduled credit is 1 or 2, matching the item's length tier at pick time.
select is(
  (select bool_and(scheduled_credits in (1, 2)) from public.review_window_items),
  true,
  'all scheduled credits are 1 or 2'
);

-- Submit a review for one item.
insert into public.review_submissions (
  window_id, slot, source_item_id, user_id, action, corrected_text,
  original_source_snapshot, original_proposed_snapshot,
  length_tier_snapshot, scheduled_credits
)
select
  i.window_id, i.slot, i.source_item_id, '11111111-1111-4111-8111-111111111111', 'confirm', null,
  s.source_text, s.proposed_target, i.length_tier_snapshot, i.scheduled_credits
from public.review_window_items i
join private.review_source_items s on s.id = i.source_item_id
where i.window_id = (select id from public.review_windows where state = 'open')
order by i.slot
limit 1;

-- Duplicate submission should be blocked by the unique constraint.
select throws_ok(
  $$insert into public.review_submissions (
      window_id, slot, source_item_id, user_id, action, corrected_text,
      original_source_snapshot, original_proposed_snapshot,
      length_tier_snapshot, scheduled_credits
    )
    select
      i.window_id, i.slot, i.source_item_id, '11111111-1111-4111-8111-111111111111', 'confirm', null,
      s.source_text, s.proposed_target, i.length_tier_snapshot, i.scheduled_credits
    from public.review_window_items i
    join private.review_source_items s on s.id = i.source_item_id
    where i.window_id = (select id from public.review_windows where state = 'open')
    order by i.slot
    limit 1
  $$,
  '23505',
  null,
  'duplicate submission for same (window, item, user) blocked'
);

-- Admin marks a *second* item's submission unsatisfactory before close.
insert into public.review_submissions (
  window_id, slot, source_item_id, user_id, action, corrected_text,
  original_source_snapshot, original_proposed_snapshot,
  length_tier_snapshot, scheduled_credits
)
select
  i.window_id, i.slot, i.source_item_id, '22222222-2222-4222-8222-222222222222', 'confirm', null,
  s.source_text, s.proposed_target, i.length_tier_snapshot, i.scheduled_credits
from public.review_window_items i
join private.review_source_items s on s.id = i.source_item_id
where i.window_id = (select id from public.review_windows where state = 'open')
order by i.slot
offset 1 limit 1;

select ok(
  public.service_mark_review_unsatisfactory(
    (select id from public.review_submissions
      where user_id = '22222222-2222-4222-8222-222222222222'
      limit 1),
    '11111111-1111-4111-8111-111111111111',
    'test unsatisfactory'
  ) is not null,
  'admin marks submission unsatisfactory before close'
);

-- Rotate again -> close current, grant credits for satisfactory submissions,
-- open a fresh window. Move p_as_of another day forward so the first
-- rotation's window is now due.
select ok(
  ((public.service_rotate_review_window(
      10::smallint,
      (now() + interval '3 day')::timestamptz
    ))->>'new_window_size')::int = 10,
  'second rotation opens a fresh 10-item window'
);

-- Prior window is now granted.
select is(
  (select count(*)::int from public.review_windows where state = 'granted'),
  1,
  'exactly one granted (prior) window'
);

-- The satisfactory submission granted credits, the unsatisfactory one did not.
select is(
  (select reward_granted from public.review_submissions
    where user_id = '11111111-1111-4111-8111-111111111111'
    limit 1),
  true,
  'satisfactory submission received credits'
);

select is(
  (select reward_granted from public.review_submissions
    where user_id = '22222222-2222-4222-8222-222222222222'
    limit 1),
  false,
  'unsatisfactory submission did not receive credits'
);

-- Ledger recorded 15 minutes per credit for the public_review grant.
select ok(
  (select minutes >= credits * 15 from public.reward_ledger
    where source_type = 'public_review'
      and user_id = '11111111-1111-4111-8111-111111111111'
    order by created_at desc limit 1),
  '1 credit = 15 minutes in public_review ledger row'
);

-- Late reject creates an alert but does not remove the ledger row.
select public.service_late_reject_review(
  (select id from public.review_submissions
    where user_id = '11111111-1111-4111-8111-111111111111'
    limit 1),
  '11111111-1111-4111-8111-111111111111',
  'test late reject'
);

select ok(
  (select count(*)::int from private.contributor_alerts
    where alert_type = 'review_late_reject') >= 1,
  'late reject inserts a contributor alert'
);

select ok(
  (select count(*)::int from public.reward_ledger
    where source_type = 'public_review'
      and user_id = '11111111-1111-4111-8111-111111111111') >= 1,
  'late reject does not claw back the ledger row'
);

-- Sign-in requirement: rpc_submit_review must reject anonymous callers.
-- (auth.uid() is null in this direct SQL context.)
select throws_ok(
  $$select public.rpc_submit_review(
      (select id from public.review_windows where state = 'open'),
      (select source_item_id from public.review_window_items
        where window_id = (select id from public.review_windows where state = 'open')
        limit 1),
      'confirm',
      null
    )$$,
  '42501',
  'sign_in_required',
  'rpc_submit_review requires an authenticated user'
);

select * from finish();
rollback;
