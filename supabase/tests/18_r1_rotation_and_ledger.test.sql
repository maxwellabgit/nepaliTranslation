-- R1: reward-ledger idempotency + 5 PM NY rotation + DST + exactly-once.
--
-- Covers the required cases from
-- docs/NepTranslate_V1_Finalization_and_TestFlight_Runbook_71c85df.md R1.
--
-- Uses only the two auth.users seeded by supabase/seed.sql
-- (11111111... and 22222222...) so this test does not need to build a full
-- auth.users record.

begin;
select no_plan();

-- ---------------------------------------------------------------------------
-- Fixture: 12 synthetic review-source rows.
-- ---------------------------------------------------------------------------

delete from public.review_submissions;
delete from public.review_window_items;
delete from public.review_windows;
delete from private.review_source_items where origin like 'test:r1%';

insert into private.review_source_items (
  id, content_hash, origin, direction, register, script,
  source_text, proposed_target, license_note, metadata,
  source_char_length, pii_flag, public_review_eligible
)
select
  ('01234567-89ab-4def-8000-' || lpad(i::text, 12, '0'))::uuid,
  'r1-hash-' || i::text,
  'test:r1',
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
from generate_series(1, 12) as g(i);

select is(private.refresh_review_length_tiers(), 12, 'seed: 12 rows refreshed');

-- ---------------------------------------------------------------------------
-- apply_reward: two users can earn against the same source item; retry is
-- idempotent per (user_id, source_type, source_id).
-- ---------------------------------------------------------------------------

select is(
  (private.apply_reward(
    '11111111-1111-4111-8111-111111111111',
    'public_review', 'r1-shared-src', 1, 15
  ) ->> 'applied')::boolean,
  true,
  'user A first grant applied'
);

select is(
  (private.apply_reward(
    '22222222-2222-4222-8222-222222222222',
    'public_review', 'r1-shared-src', 1, 15
  ) ->> 'applied')::boolean,
  true,
  'user B: different user, same source_id -> also applied (R1 idempotency uses 3-tuple)'
);

select is(
  (private.apply_reward(
    '11111111-1111-4111-8111-111111111111',
    'public_review', 'r1-shared-src', 1, 15
  ) ->> 'applied')::boolean,
  false,
  'user A retry same (user, type, id) -> not applied (duplicate)'
);

select is(
  (select count(*)::int from public.reward_ledger
    where source_type = 'public_review' and source_id = 'r1-shared-src'),
  2,
  'exactly two ledger rows for the same source item (one per user)'
);

-- One-credit apply_reward stores minutes = credits * 15 regardless of the
-- caller-supplied p_minutes; two-credit apply_reward stores minutes = 30.
select is(
  (select minutes from public.reward_ledger
    where user_id = '11111111-1111-4111-8111-111111111111'
      and source_id = 'r1-shared-src'),
  15,
  '1 credit -> 15 minutes recorded on ledger row'
);

select is(
  (private.apply_reward(
    '11111111-1111-4111-8111-111111111111',
    'public_review', 'r1-two-credit-src', 2, 999
  ) ->> 'applied')::boolean,
  true,
  '2-credit grant applied'
);

select is(
  (select minutes from public.reward_ledger
    where user_id = '11111111-1111-4111-8111-111111111111'
      and source_id = 'r1-two-credit-src'),
  30,
  '2 credits -> 30 minutes recorded (caller-supplied 999 ignored)'
);

-- ---------------------------------------------------------------------------
-- DST-aware next_review_close boundary
-- ---------------------------------------------------------------------------

-- 2026-03-08 is spring-forward Sunday in the US. 5 PM NY that day is EDT
-- (UTC-4) → 21:00 UTC.
select is(
  private.next_review_close('2026-03-08 15:00:00+00'::timestamptz),
  '2026-03-08 21:00:00+00'::timestamptz,
  'spring-forward Sunday: 5 PM NY = 21:00 UTC (EDT)'
);

-- 2026-11-01 is fall-back Sunday. Before 2 AM local the clock is still EDT
-- (UTC-4), so 5 PM NY that afternoon (after the 2 AM cutover to EST) is
-- 22:00 UTC. Compute strictly-after 15:00 UTC on that day → the next 5 PM
-- (already past cutover) → 22:00 UTC.
select is(
  private.next_review_close('2026-11-01 15:00:00+00'::timestamptz),
  '2026-11-01 22:00:00+00'::timestamptz,
  'fall-back Sunday: 5 PM NY after 2 AM cutover = 22:00 UTC (EST)'
);

-- ---------------------------------------------------------------------------
-- 4:59:59 PM NY = not_due; 5:00:00 PM NY = closes exactly once
-- ---------------------------------------------------------------------------

-- Reset windows and seed a fresh open window closing at 2026-11-04 22:00 UTC.
delete from public.review_submissions;
delete from public.review_window_items;
delete from public.review_windows;

insert into public.review_windows (id, ny_close_at, state, size, opened_at)
values (
  '00000000-0000-4000-8000-000000000001',
  '2026-11-04 22:00:00+00'::timestamptz,
  'open',
  10,
  '2026-11-03 22:00:00+00'::timestamptz
);

insert into public.review_window_items (window_id, slot, source_item_id, length_tier_snapshot, scheduled_credits)
select
  '00000000-0000-4000-8000-000000000001',
  (row_number() over ())::smallint,
  id,
  case when i <= 6 then 2::smallint else 1::smallint end,
  case when i <= 6 then 2 else 1 end
from (
  select id, row_number() over (order by source_char_length desc, id asc) as i
    from private.review_source_items
   where origin = 'test:r1'
   order by source_char_length desc, id asc
   limit 12
) t;

select is(
  (public.service_rotate_review_window(
     10::smallint,
     '2026-11-04 21:59:59+00'::timestamptz
   ))->>'status',
  'not_due',
  '4:59:59 PM NY returns not_due without mutation'
);

select is(
  (select state from public.review_windows
    where id = '00000000-0000-4000-8000-000000000001'),
  'open',
  'not_due left the window open'
);

-- ---------------------------------------------------------------------------
-- Skip/report zero-grant + report quarantines the source item
-- ---------------------------------------------------------------------------

-- Insert four submissions on four different items — one action each — from
-- the two seeded users.
--   confirm  (11...) → granted
--   edit     (22...) → granted
--   skip     (11...) → zero
--   report   (22...) → zero + quarantine
insert into public.review_submissions (
  window_id, slot, source_item_id, user_id, action, corrected_text,
  original_source_snapshot, original_proposed_snapshot,
  length_tier_snapshot, scheduled_credits
)
select
  i.window_id, i.slot, i.source_item_id, u.user_id::uuid, u.action, u.corrected,
  s.source_text, s.proposed_target,
  i.length_tier_snapshot, i.scheduled_credits
from public.review_window_items i
join private.review_source_items s on s.id = i.source_item_id
join (values
  (1, '11111111-1111-4111-8111-111111111111', 'confirm', null),
  (2, '22222222-2222-4222-8222-222222222222', 'edit',    'edited target text'),
  (3, '11111111-1111-4111-8111-111111111111', 'skip',    null),
  (4, '22222222-2222-4222-8222-222222222222', 'report',  null)
) as u(slot, user_id, action, corrected) on u.slot = i.slot
where i.window_id = '00000000-0000-4000-8000-000000000001';

-- Baseline before window rotation grants: this transaction has already
-- created 3 public_review ledger rows via direct apply_reward
-- (r1-shared-src for both users, r1-two-credit-src for user A).
select is(
  (select count(*)::int from public.reward_ledger
    where user_id in (
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222'
    ) and source_type = 'public_review'
      and source_id like 'r1-%'),
  3,
  'baseline public_review ledger rows from earlier direct apply_reward = 3'
);

-- Close exactly at 5:00 PM NY.
select ok(
  ((public.service_rotate_review_window(
     10::smallint,
     '2026-11-04 22:00:00+00'::timestamptz
   ))->>'granted_count')::int = 2,
  'rotation grants exactly 2 rewards (confirm + edit); skip and report grant 0'
);

select is(
  (select state from public.review_windows
    where id = '00000000-0000-4000-8000-000000000001'),
  'granted',
  'prior window is now granted'
);

-- Confirm/edit submissions are marked granted; skip/report are also marked
-- granted so we do not retry them, but with no ledger row.
select is(
  (select reward_granted from public.review_submissions
    where window_id = '00000000-0000-4000-8000-000000000001'
      and slot = 1),
  true,
  'confirm was reward_granted'
);

select is(
  (select reward_granted from public.review_submissions
    where window_id = '00000000-0000-4000-8000-000000000001'
      and slot = 2),
  true,
  'edit was reward_granted'
);

-- skip and report never enter the ledger for their submission ids.
select is(
  (select count(*)::int from public.reward_ledger l
    join public.review_submissions s on s.id::text = l.source_id
   where s.window_id = '00000000-0000-4000-8000-000000000001'
     and s.action in ('skip', 'report')),
  0,
  'skip and report create zero ledger rows'
);

-- Reported source item is quarantined.
select is(
  (select public_review_eligible from private.review_source_items
    where id = (select source_item_id from public.review_submissions
                 where window_id = '00000000-0000-4000-8000-000000000001'
                   and action = 'report' limit 1)),
  false,
  'report action quarantines the source item'
);

-- ---------------------------------------------------------------------------
-- Retry is exactly-once
-- ---------------------------------------------------------------------------

do $$
declare
  v_before jsonb;
  v_after jsonb;
begin
  -- The next open window created by the 22:00 rotation is at 2026-11-05 22:00.
  -- Rotate again at that exact time on 2026-11-04 (before the next window's
  -- due time) and confirm we get 'not_due' back with no state change.
  select jsonb_build_object(
    'entitlements', array_agg(
      jsonb_build_object(
        'uid', user_id,
        'until', earned_ad_free_until,
        'lifetime', lifetime_credits
      )
    )
  ) into v_before
    from public.earned_entitlements
   where user_id in (
     '11111111-1111-4111-8111-111111111111',
     '22222222-2222-4222-8222-222222222222'
   );

  perform public.service_rotate_review_window(
    10::smallint,
    '2026-11-04 22:00:05+00'::timestamptz
  );

  select jsonb_build_object(
    'entitlements', array_agg(
      jsonb_build_object(
        'uid', user_id,
        'until', earned_ad_free_until,
        'lifetime', lifetime_credits
      )
    )
  ) into v_after
    from public.earned_entitlements
   where user_id in (
     '11111111-1111-4111-8111-111111111111',
     '22222222-2222-4222-8222-222222222222'
   );

  if v_before is distinct from v_after then
    raise exception 'idempotent retry advanced entitlements (before=% after=%)',
      v_before, v_after;
  end if;
end $$;

select ok(true, 'immediate rotation retry does not extend entitlements');

-- ---------------------------------------------------------------------------
-- Empty / under-N pool: rotation opens with actual count and flags pool_short
-- ---------------------------------------------------------------------------

-- Public review must be enabled before a short pool opens a window.
update public.app_config set public_review_enabled = true where id = 1;

-- Mark all but 2 rows ineligible so the next rotation is under-N.
update private.review_source_items
   set public_review_eligible = false
 where origin = 'test:r1'
   and id not in (
     select id from private.review_source_items
      where origin = 'test:r1' and public_review_eligible
      order by id
      limit 2
   );

-- The rotation just performed opened a new window at 2026-11-05 22:00. It
-- is not_due at 22:00:05 the day before. Move to 2026-11-05 22:00:00 UTC to
-- trigger the next close.
select is(
  ((public.service_rotate_review_window(
      10::smallint,
      '2026-11-05 22:00:00+00'::timestamptz
    ))->>'warning'),
  'pool_short',
  'under-N rotation emits warning: pool_short'
);

select ok(
  ((select new_window_size::int
      from (select (public.service_rotate_review_window(
                     10::smallint,
                     '2026-11-06 22:00:00+00'::timestamptz
                   ) ->> 'new_window_size')::int as new_window_size) t)
   ) <= 2,
  'under-N rotation opens a window with at most 2 items'
);

select * from finish();
rollback;
