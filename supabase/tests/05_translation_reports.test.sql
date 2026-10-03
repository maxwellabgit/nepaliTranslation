begin;
select no_plan();

-- Explicit current consent fixture for fresh and forward-upgraded test schemas.
update public.profiles set consent_version = (select contribution_consent_version from public.app_config where id = 1)
where user_id = '11111111-1111-4111-8111-111111111111';

select lives_ok(
  $$select * from public.service_insert_translation_report(
    '11111111-1111-4111-8111-111111111111',
    'hello',
    'नमस्ते',
    null,
    'en-ne',
    'formal',
    'deva',
    'live_translate',
    'idem-hello-1',
    (select contribution_consent_version from public.app_config where id = 1),
    '{}'::jsonb
  )$$,
  'service role can insert a translation report'
);

select is(
  (select count(*)::int from private.translation_reports
    where idempotency_key = 'idem-hello-1'),
  1,
  'one row for the first insert'
);

select is(
  (select inserted from public.service_insert_translation_report(
    '11111111-1111-4111-8111-111111111111',
    'hello',
    'नमस्ते',
    null,
    'en-ne',
    'formal',
    'deva',
    'live_translate',
    'idem-hello-1',
    (select contribution_consent_version from public.app_config where id = 1),
    '{}'::jsonb
  )),
  false,
  'duplicate idempotency key does not insert again'
);

select is(
  (select count(*)::int from private.translation_reports
    where idempotency_key = 'idem-hello-1'),
  1,
  'still one row after duplicate'
);

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select * from public.service_insert_translation_report(
    '11111111-1111-4111-8111-111111111111',
    'x',
    'y',
    null,
    'en-ne',
    'formal',
    'deva',
    'live_translate',
    'idem-auth-blocked',
    (select contribution_consent_version from public.app_config where id = 1),
    '{}'::jsonb
  )$$,
  '42501'
);

select * from finish();
rollback;
