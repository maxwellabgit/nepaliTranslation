-- R3: server-side review eligibility guard.

begin;
select no_plan();

-- Simulate an authenticated session for user A.
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

-- User A is seeded with current consent and age from seed.sql, and the
-- default contribution_text_enabled is true. Startup consent is NOT set by
-- seed, so the initial check should fail with startup_consent_required.
select is(
  (public.service_check_review_eligibility() ->> 'ok')::boolean,
  false,
  'signed-in user without startup consent is ineligible'
);

select is(
  (public.service_check_review_eligibility() ->> 'code'),
  'startup_consent_required',
  'ineligibility reason surfaces to the client'
);

reset role;

-- Grant startup consent as service_role. Clear JWT first so auth.uid()
-- is null inside the service session (otherwise the R4 authorization
-- check would still see user A's claim from the authenticated block
-- above and refuse a service_role write on behalf of another user).
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);
set local role service_role;
select public.service_record_startup_consent(
  '11111111-1111-4111-8111-111111111111',
  public.service_current_startup_consent_version(),
  true, true, true
);
reset role;

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (public.service_check_review_eligibility() ->> 'ok')::boolean,
  true,
  'signed-in user with current consent + startup + flag is eligible'
);

reset role;

-- rpc_submit_review must reject an anonymous caller with sign_in_required.
select throws_ok(
  $$select public.rpc_submit_review(
      '00000000-0000-4000-b000-000000000000'::uuid,
      '00000000-0000-4000-b000-000000000001'::uuid,
      'confirm',
      null
    )$$,
  '42501',
  'sign_in_required',
  'rpc_submit_review rejects anonymous'
);

-- If contribution_text_enabled is off, the guard fires.
update public.app_config set contribution_text_enabled = false where id = 1;

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (public.service_check_review_eligibility() ->> 'code'),
  'flag_disabled',
  'text-contribution flag off blocks review'
);

reset role;

-- Restore the flag.
update public.app_config set contribution_text_enabled = true where id = 1;

-- Deletion / withdrawal pending blocks review.
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);
set local role service_role;
select public.service_withdraw_contribution_consent(
  '11111111-1111-4111-8111-111111111111'
);
reset role;

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (public.service_check_review_eligibility() ->> 'code'),
  'deletion_pending',
  'pending withdrawal blocks review'
);

reset role;

select * from finish();
rollback;
