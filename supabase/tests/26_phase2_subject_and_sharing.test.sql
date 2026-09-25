-- Phase 2: startup consent and sharing toggles are bound to auth.uid().

begin;
select no_plan();

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.service_record_startup_consent(
      '22222222-2222-4222-8222-222222222222',
      (select startup_consent_version from public.app_config where id = 1),
      true, true, false
    )$$,
  '42501',
  'forbidden',
  'user A cannot record user B startup consent'
);

select throws_ok(
  $$select public.service_set_sharing_toggles(
      '22222222-2222-4222-8222-222222222222',
      true,
      true
    )$$,
  '42501',
  'forbidden',
  'user A cannot change user B sharing toggles'
);

select ok(
  (public.service_set_sharing_toggles(
    '11111111-1111-4111-8111-111111111111',
    false,
    true
  ) ->> 'photo_sharing')::boolean,
  'user A can set their own photo sharing'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);

update public.app_config
set contribution_photos_enabled = true
where id = 1;

update public.profiles
set
  consent_version = (select contribution_consent_version from public.app_config where id = 1),
  age_confirmed_at = now(),
  consented_at = now(),
  photo_sharing = false
where user_id = '11111111-1111-4111-8111-111111111111';

select throws_ok(
  $$select public.service_assert_contribution_media_gate(
      '11111111-1111-4111-8111-111111111111',
      'photo'
    )$$,
  'P0001',
  'sharing_disabled',
  'photo sharing off blocks upload after consent and flag'
);

update public.profiles
set photo_sharing = true
where user_id = '11111111-1111-4111-8111-111111111111';

select lives_ok(
  $$select public.service_assert_contribution_media_gate(
      '11111111-1111-4111-8111-111111111111',
      'photo'
    )$$,
  'photo sharing on passes the media gate'
);

select * from finish();
rollback;
