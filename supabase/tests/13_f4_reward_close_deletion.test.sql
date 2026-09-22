begin;
select no_plan();

-- Word count scheduling
select is(private.count_source_words('one two three'), 3, 'counts whitespace-separated words');
select is(private.count_source_words(''), 0, 'empty source is zero words');

select is(private.scheduled_credits_for_words(20), 1, '<=20 words schedules 1 credit');
select is(private.scheduled_credits_for_words(21), 2, '>20 words schedules 2 credits');

-- DST-safe NY close: winter (EST) and summer (EDT)
select is(
  public.service_ny_reward_window_close('2026-01-15 14:00:00+00'::timestamptz),
  '2026-01-15 22:00:00+00'::timestamptz,
  '3 PM UTC Jan 15 (10 AM NY) closes same NY day at 5 PM EST (22:00 UTC)'
);

select is(
  public.service_ny_reward_window_close('2026-07-15 14:00:00+00'::timestamptz),
  '2026-07-15 21:00:00+00'::timestamptz,
  '3 PM UTC Jul 15 (10 AM NY EDT) closes same NY day at 5 PM EDT (21:00 UTC)'
);

select is(
  public.service_ny_reward_window_close('2026-07-15 22:30:00+00'::timestamptz),
  '2026-07-16 21:00:00+00'::timestamptz,
  'after 5 PM NY rolls close to next NY day'
);

-- Rewarded video schedule is 15 minutes
select is(
  (select minutes from private.reward_schedule('rewarded_video')),
  15,
  'rewarded_video grants 15 ad-free minutes'
);

select is(
  (select credits from private.reward_schedule('rewarded_video')),
  3,
  'rewarded_video grants 3 credits (5 min each)'
);

-- Close batch: pending at close grants once; pre-close reject grants zero
update public.profiles
set consent_version = '2026-09-21.media', age_confirmed_at = now(), consented_at = now()
where user_id = '11111111-1111-4111-8111-111111111111';

delete from public.contribution_receipts
where user_id = '11111111-1111-4111-8111-111111111111'
  and idempotency_key like 'f4-close-%';

insert into public.contribution_receipts (
  user_id, public_task_id, status, credits_awarded,
  idempotency_key, original_word_count, source_snapshot,
  scheduled_credits, reward_eligible, submitted_at
) values (
  '11111111-1111-4111-8111-111111111111',
  'd0d0d0d0-d0d0-40d0-80d0-d0d0d0d0d0d0',
  'pending',
  0,
  'f4-close-pending-01',
  5,
  'short source text',
  1,
  true,
  '2026-07-15 14:00:00+00'
);

insert into public.contribution_receipts (
  user_id, public_task_id, status, credits_awarded,
  idempotency_key, original_word_count, source_snapshot,
  scheduled_credits, reward_eligible, submitted_at
) values (
  '11111111-1111-4111-8111-111111111111',
  'd0d0d0d0-d0d0-40d0-80d0-d0d0d0d0d0d0',
  'rejected',
  0,
  'f4-close-reject-01',
  25,
  'long rejected source',
  0,
  false,
  '2026-07-15 14:00:00+00'
);

select is(
  (public.service_close_ny_reward_window('2026-07-15 21:30:00+00'::timestamptz) ->> 'applied')::integer,
  1,
  'close grants one eligible pending receipt'
);

select is(
  (select credits_awarded from public.contribution_receipts
    where idempotency_key = 'f4-close-pending-01'),
  1,
  'pending receipt receives scheduled credits at close'
);

select is(
  (select reward_granted_at is not null from public.contribution_receipts
    where idempotency_key = 'f4-close-pending-01'),
  true,
  'pending receipt marked granted at close'
);

select is(
  (select count(*)::int from public.reward_ledger
    where source_id like 'receipt:%'
      and user_id = '11111111-1111-4111-8111-111111111111'),
  1,
  'close writes one ledger row'
);

-- Idempotent close replay
select is(
  (public.service_close_ny_reward_window('2026-07-15 21:30:00+00'::timestamptz) ->> 'applied')::integer,
  0,
  'second close does not double-grant'
);

-- Late reject: alert only, ledger unchanged
select is(
  (public.service_late_reject_receipt(
    (select id from public.contribution_receipts where idempotency_key = 'f4-close-pending-01'),
    'manual_review'
  ) ->> 'alerted')::boolean,
  true,
  'late reject creates alert'
);

select is(
  (select count(*)::int from private.contributor_alerts
    where user_id = '11111111-1111-4111-8111-111111111111'),
  1,
  'contributor alert row exists'
);

select is(
  (select credits from public.reward_ledger
    where source_id = (
      select 'receipt:' || id::text from public.contribution_receipts
        where idempotency_key = 'f4-close-pending-01'
    )),
  1,
  'late reject does not claw back ledger credits'
);

-- Deletion request blocks uploads
select public.service_record_consent(
  '22222222-2222-4222-8222-222222222222',
  '2026-09-21.media',
  true
);

select ok(
  (public.service_request_account_deletion('22222222-2222-4222-8222-222222222222')
    ->> 'deletion_due_at') is not null,
  'deletion request sets due date'
);

select throws_ok(
  $$select public.service_lease_contribution_task('22222222-2222-4222-8222-222222222222')$$,
  'P0001',
  'deletion_pending',
  'deletion pending blocks new contribution leases'
);

-- Purge job processes due profiles
update public.profiles
set
  deletion_requested_at = now() - interval '31 days',
  deletion_due_at = now() - interval '1 day'
where user_id = '22222222-2222-4222-8222-222222222222';

select is(
  (public.service_process_deletion_jobs(10) ->> 'processed')::integer,
  1,
  'deletion job purges overdue profile'
);

select is_empty(
  $$select user_id from public.profiles
    where user_id = '22222222-2222-4222-8222-222222222222'$$,
  'purged user profile removed'
);

select * from finish();
rollback;
