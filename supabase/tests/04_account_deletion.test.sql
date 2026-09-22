begin;
select no_plan();

select public.service_record_consent(
  '11111111-1111-4111-8111-111111111111',
  '2026-09-21.media',
  true
);

select is(
  (select consent_version from public.profiles
    where user_id = '11111111-1111-4111-8111-111111111111'),
  '2026-09-21.media',
  'server records the consent version'
);

select private.purge_user_data('11111111-1111-4111-8111-111111111111');

select is_empty(
  $$select user_id from public.profiles
    where user_id = '11111111-1111-4111-8111-111111111111'$$,
  'purged user has no profile'
);

select is_empty(
  $$select id from public.contribution_receipts
    where user_id = '11111111-1111-4111-8111-111111111111'$$,
  'purged user has no receipts'
);

select is_empty(
  $$select id from public.reward_ledger
    where user_id = '11111111-1111-4111-8111-111111111111'$$,
  'purged user has no ledger rows'
);

select public.service_set_deletion_progress(
  '11111111-1111-4111-8111-111111111111',
  array['revoke_apple']
);

select is(
  public.service_get_deletion_progress('11111111-1111-4111-8111-111111111111'),
  array['revoke_apple']::text[],
  'deletion progress is stored for the service role'
);

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select is_empty(
  $$select user_id from public.profiles$$,
  'deleted user cannot read account profile rows'
);

select throws_ok(
  $$select public.service_purge_user_data('22222222-2222-4222-8222-222222222222')$$,
  '42501'
);

select throws_ok(
  $$select public.service_set_deletion_progress(
    '22222222-2222-4222-8222-222222222222',
    array['revoke_apple']
  )$$,
  '42501'
);

select * from finish();
rollback;
