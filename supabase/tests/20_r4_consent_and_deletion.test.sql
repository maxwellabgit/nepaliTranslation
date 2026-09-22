-- R4: consent write authorization + withdrawal + deletion coverage manifest.
--
-- Requires the two auth.users seeded by seed.sql:
--   11111111-1111-4111-8111-111111111111 (user A)
--   22222222-2222-4222-8222-222222222222 (user B)

begin;
select no_plan();

-- ---------------------------------------------------------------------------
-- Cross-user consent write must be rejected.
-- ---------------------------------------------------------------------------

-- Simulate an authenticated session for user A.
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

-- User A writing their own startup consent → allowed.
select ok(
  (public.service_record_startup_consent(
    '11111111-1111-4111-8111-111111111111',
    public.service_current_startup_consent_version(),
    true, true, true
  )) is not null,
  'user A can write their own startup consent'
);

-- User A trying to write user B's startup consent → forbidden.
select throws_ok(
  $$select public.service_record_startup_consent(
      '22222222-2222-4222-8222-222222222222',
      public.service_current_startup_consent_version(),
      true, true, true
    )$$,
  '42501',
  'forbidden',
  'user A cannot write user B startup consent (42501)'
);

-- Same for contribution consent.
select throws_ok(
  $$select public.service_record_consent(
      '22222222-2222-4222-8222-222222222222',
      (select contribution_consent_version from public.app_config where id = 1),
      true
    )$$,
  '42501',
  'forbidden',
  'user A cannot write user B contribution consent (42501)'
);

-- Deletion request must also be gated.
select throws_ok(
  $$select public.service_request_account_deletion(
      '22222222-2222-4222-8222-222222222222'
    )$$,
  '42501',
  'forbidden',
  'user A cannot request deletion of user B (42501)'
);

-- Withdrawal must also be gated.
select throws_ok(
  $$select public.service_withdraw_contribution_consent(
      '22222222-2222-4222-8222-222222222222'
    )$$,
  '42501',
  'forbidden',
  'user A cannot withdraw user B contribution consent (42501)'
);

reset role;

-- ---------------------------------------------------------------------------
-- Service role can still act on any user (cron / edge functions).
-- ---------------------------------------------------------------------------

set local role service_role;

select ok(
  (public.service_record_startup_consent(
    '22222222-2222-4222-8222-222222222222',
    public.service_current_startup_consent_version(),
    true, true, true
  )) is not null,
  'service_role can write startup consent for any user'
);

-- ---------------------------------------------------------------------------
-- Withdrawal flow: stops uploads, enqueues 30-day purge, adds an alert.
-- ---------------------------------------------------------------------------

-- Seed a media row + a review submission for user B.
insert into public.contribution_media (
  user_id, storage_path, kind, status
) values (
  '22222222-2222-4222-8222-222222222222',
  'media/22222222/test.m4a',
  'speech',
  'uploaded'
)
on conflict do nothing;

-- Withdraw as service_role (already set).
select ok(
  (public.service_withdraw_contribution_consent(
    '22222222-2222-4222-8222-222222222222'
  ) ->> 'deletion_due_at') is not null,
  'withdrawal returns a 30-day deletion_due_at'
);

-- Media row is now pending_delete.
select is(
  (select status from public.contribution_media
    where user_id = '22222222-2222-4222-8222-222222222222'
    order by uploaded_at desc nulls last, id desc
    limit 1),
  'pending_delete',
  'withdrawal marks queued media pending_delete'
);

-- Withdrawal contributor alert exists.
select ok(
  (select count(*)::int from private.contributor_alerts
    where user_id = '22222222-2222-4222-8222-222222222222'
      and alert_type = 'contribution_consent_withdrawn') >= 1,
  'withdrawal inserts a contributor_alerts row'
);

-- ---------------------------------------------------------------------------
-- Deletion manifest lists every target with a count for that user.
-- ---------------------------------------------------------------------------

select ok(
  jsonb_array_length(
    public.service_user_deletion_manifest(
      '22222222-2222-4222-8222-222222222222'
    ) -> 'targets'
  ) >= 12,
  'deletion manifest lists at least 12 linked targets'
);

-- Manifest lists review_exclusions as an INSERT target.
select ok(
  exists (
    select 1 from jsonb_array_elements(
      public.service_user_deletion_manifest(
        '22222222-2222-4222-8222-222222222222'
      ) -> 'targets'
    ) as t
    where t ->> 'table' = 'public.review_exclusions'
  ),
  'manifest includes review_exclusions insertion target'
);

reset role;

-- ---------------------------------------------------------------------------
-- purge_user_data tags review_exclusions with the appropriate reason.
-- ---------------------------------------------------------------------------

-- Seed a review submission for user A tied to a fresh review source hash.
insert into private.review_source_items (
  id, content_hash, origin, direction, register, script,
  source_text, proposed_target, license_note, metadata,
  source_char_length, pii_flag, public_review_eligible
) values (
  '01234567-89ab-4def-a000-000000000001',
  'r4-purge-hash-1',
  'test:r4',
  'en-ne',
  'unspecified',
  'unspecified',
  'r4 purge test source',
  'r4 purge test target',
  null,
  '{}'::jsonb,
  22,
  false,
  true
);

insert into public.review_windows (id, ny_close_at, state, size, opened_at)
values (
  '00000000-0000-4000-a000-000000000001',
  '2027-02-01 22:00:00+00'::timestamptz,
  'open',
  1,
  '2027-02-01 22:00:00+00'::timestamptz
);

insert into public.review_window_items (window_id, slot, source_item_id, length_tier_snapshot, scheduled_credits)
values (
  '00000000-0000-4000-a000-000000000001', 1,
  '01234567-89ab-4def-a000-000000000001',
  1, 1
);

insert into public.review_submissions (
  window_id, slot, source_item_id, user_id, action, corrected_text,
  original_source_snapshot, original_proposed_snapshot,
  length_tier_snapshot, scheduled_credits
) values (
  '00000000-0000-4000-a000-000000000001', 1,
  '01234567-89ab-4def-a000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'confirm', null,
  'r4 purge test source',
  'r4 purge test target',
  1, 1
);

-- Purge user A. Expect a 'account_deleted' exclusion for the seeded hash.
select private.purge_user_data(
  '11111111-1111-4111-8111-111111111111'
);

select is(
  (select count(*)::int from public.review_exclusions
    where content_hash = 'r4-purge-hash-1'
      and reason in ('consent_withdrawn', 'account_deleted')),
  1,
  'purge tags reviewed content_hash with a deletion reason'
);

-- Review submissions are gone.
select is(
  (select count(*)::int from public.review_submissions
    where user_id = '11111111-1111-4111-8111-111111111111'),
  0,
  'purge removes user submissions'
);

select * from finish();
rollback;
