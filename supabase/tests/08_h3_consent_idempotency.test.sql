begin;
select no_plan();

-- Consent gate: no consent → consent_required
update public.profiles
set consent_version = null, age_confirmed_at = null
where user_id = '11111111-1111-4111-8111-111111111111';

select throws_ok(
  $$select public.service_assert_contribution_consent(
    '11111111-1111-4111-8111-111111111111'
  )$$,
  'P0001',
  'consent_required',
  'absent consent is rejected'
);

update public.profiles
set consent_version = '2026-09-19.draft', age_confirmed_at = null, consented_at = now()
where user_id = '11111111-1111-4111-8111-111111111111';

select throws_ok(
  $$select public.service_assert_contribution_consent(
    '11111111-1111-4111-8111-111111111111'
  )$$,
  'P0001',
  'age_required',
  'missing age confirmation is rejected'
);

update public.profiles
set consent_version = 'old.version', age_confirmed_at = now()
where user_id = '11111111-1111-4111-8111-111111111111';

select throws_ok(
  $$select public.service_assert_contribution_consent(
    '11111111-1111-4111-8111-111111111111'
  )$$,
  'P0001',
  'consent_outdated',
  'mismatched consent is rejected'
);

-- Restore current consent for remaining tests
update public.profiles
set consent_version = '2026-09-19.draft', age_confirmed_at = now(), consented_at = now()
where user_id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222'
);

select lives_ok(
  $$select public.service_assert_contribution_consent(
    '11111111-1111-4111-8111-111111111111'
  )$$,
  'current consent passes'
);

-- record-consent rejects outdated version
select throws_ok(
  $$select public.service_record_consent(
    '11111111-1111-4111-8111-111111111111',
    'wrong.version',
    true
  )$$,
  'P0001',
  'consent_outdated',
  'record-consent accepts only server version'
);

-- Per-reporter report idempotency: same key, two users
select lives_ok(
  $$select * from public.service_insert_translation_report(
    '11111111-1111-4111-8111-111111111111',
    'hello', 'नमस्ते', null, 'en-ne', 'formal', 'deva',
    'live_translate', 'shared-client-key-1', '2026-09-19.draft', '{}'::jsonb
  )$$,
  'user A can report'
);

select lives_ok(
  $$select * from public.service_insert_translation_report(
    '22222222-2222-4222-8222-222222222222',
    'hello', 'नमस्ते', null, 'en-ne', 'formal', 'deva',
    'live_translate', 'shared-client-key-1', '2026-09-19.draft', '{}'::jsonb
  )$$,
  'user B may reuse the same client key'
);

select is(
  (select count(*)::int from private.translation_reports
    where idempotency_key = 'shared-client-key-1'),
  2,
  'two reporters produce two rows for the same client key'
);

select is(
  (select count(distinct reporter_id)::int from private.translation_reports
    where idempotency_key = 'shared-client-key-1'),
  2,
  'reporter ids remain distinct (no cross-user disclosure collision)'
);

-- Per-user reward uniqueness: same source_id, different users both get credits
select is(
  (private.apply_reward(
    '11111111-1111-4111-8111-111111111111',
    'contribution', 'shared-source-xyz', 1, 5
  ) ->> 'applied')::boolean,
  true,
  'user A reward applies'
);

select is(
  (private.apply_reward(
    '22222222-2222-4222-8222-222222222222',
    'contribution', 'shared-source-xyz', 1, 5
  ) ->> 'applied')::boolean,
  true,
  'user B reward applies for the same source_id'
);

select is(
  (select count(*)::int from public.reward_ledger
    where source_id = 'shared-source-xyz'),
  2,
  'global/task source ids do not block other users'
);

select * from finish();
rollback;
