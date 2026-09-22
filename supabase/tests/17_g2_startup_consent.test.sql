-- G2: startup consent gate + account-linked purge.
--
-- Contract (see .governance/V1_G0_DECISIONS.md D4):
--   * Every user must acknowledge Terms & Conditions, Privacy Policy, and
--     "I am 18+" before reaching any product surface.
--   * When a signed-in user consents, `service_record_startup_consent`
--     stamps `startup_terms_accepted_at`, `startup_privacy_accepted_at`,
--     `startup_age_confirmed_at`, and the version.
--   * All collected data is tied to `user_id`; account deletion purges
--     review submissions alongside media, receipts, and the ledger.

begin;
select no_plan();

-- Startup consent version exists and matches app_config.
select ok(
  (select startup_consent_version from public.app_config where id = 1) is not null,
  'app_config exposes a startup_consent_version'
);

-- Rejects incomplete acknowledgements.
select throws_ok(
  $$select public.service_record_startup_consent(
      '11111111-1111-4111-8111-111111111111',
      (select startup_consent_version from public.app_config where id = 1),
      true, false, true
    )$$,
  'P0001',
  'startup_consent_incomplete',
  'Privacy unchecked -> startup_consent_incomplete'
);

select throws_ok(
  $$select public.service_record_startup_consent(
      '11111111-1111-4111-8111-111111111111',
      (select startup_consent_version from public.app_config where id = 1),
      false, true, true
    )$$,
  'P0001',
  'startup_consent_incomplete',
  'Terms unchecked -> startup_consent_incomplete'
);

select throws_ok(
  $$select public.service_record_startup_consent(
      '11111111-1111-4111-8111-111111111111',
      (select startup_consent_version from public.app_config where id = 1),
      true, true, false
    )$$,
  'P0001',
  'startup_consent_incomplete',
  '18+ unchecked -> startup_consent_incomplete'
);

-- Rejects outdated versions.
select throws_ok(
  $$select public.service_record_startup_consent(
      '11111111-1111-4111-8111-111111111111',
      'legacy-version',
      true, true, true
    )$$,
  'P0001',
  'startup_consent_outdated',
  'Older version -> startup_consent_outdated'
);

-- Accepts a complete acknowledgement.
select ok(
  (public.service_record_startup_consent(
      '11111111-1111-4111-8111-111111111111',
      (select startup_consent_version from public.app_config where id = 1),
      true, true, true
    ) ->> 'accepted_at') is not null,
  'Complete acknowledgement stamps accepted_at'
);

select is(
  (select startup_consent_version from public.profiles
    where user_id = '11111111-1111-4111-8111-111111111111'),
  (select startup_consent_version from public.app_config where id = 1),
  'Profile mirror carries the current startup consent version'
);

-- Account deletion purges all G1 review submissions for the user.
insert into private.review_source_items (
  content_hash, origin, direction, source_text, source_char_length,
  public_review_eligible
) values ('g2-purge-hash-1', 'test:g2', 'en-ne', 'Hello G2', 8, true)
on conflict (content_hash) do nothing;

insert into public.review_windows (id, ny_close_at, state, size)
values ('11111111-1111-4111-8111-fffff2666666', now() + interval '1 hour', 'open', 1);

insert into public.review_window_items (window_id, slot, source_item_id, length_tier_snapshot, scheduled_credits)
select '11111111-1111-4111-8111-fffff2666666'::uuid, 1, id, 1, 1
from private.review_source_items where content_hash = 'g2-purge-hash-1';

insert into public.review_submissions (
  window_id, slot, source_item_id, user_id, action, corrected_text,
  original_source_snapshot, length_tier_snapshot, scheduled_credits
)
select '11111111-1111-4111-8111-fffff2666666'::uuid, 1, id,
       '11111111-1111-4111-8111-111111111111', 'confirm', null,
       source_text, 1, 1
from private.review_source_items where content_hash = 'g2-purge-hash-1';

select public.service_purge_user_data('11111111-1111-4111-8111-111111111111');

select is(
  (select count(*)::int from public.review_submissions
    where user_id = '11111111-1111-4111-8111-111111111111'),
  0,
  'account deletion purges review_submissions for the user'
);

select is(
  (select count(*)::int from public.profiles
    where user_id = '11111111-1111-4111-8111-111111111111'),
  0,
  'account deletion removes the profile row'
);

select * from finish();
rollback;
