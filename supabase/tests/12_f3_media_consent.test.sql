begin;
select no_plan();

-- ---------------------------------------------------------------------------
-- Flag defaults stay off until gates pass
-- ---------------------------------------------------------------------------

select is(
  (select contribution_speech_enabled from public.app_config where id = 1),
  false,
  'speech flag defaults off'
);

select is(
  (select contribution_photos_enabled from public.app_config where id = 1),
  false,
  'photos flag defaults off'
);

-- ---------------------------------------------------------------------------
-- Current consent and speech flag off → flag_disabled
-- ---------------------------------------------------------------------------

update public.profiles
set
  consent_version = (select contribution_consent_version from public.app_config where id = 1),
  age_confirmed_at = now(),
  consented_at = now()
where user_id = '11111111-1111-4111-8111-111111111111';

-- Photo registration is retired even while its historical flag is off.
select throws_ok(
  $$select * from public.service_register_media_upload(
    '11111111-1111-4111-8111-111111111111',
    'photo', 'retired-photo-flag-off', 'image/jpeg', 4096, '{}'::jsonb
  )$$,
  '42501', 'photo_collection_retired',
  'photo registration is denied with the historical flag off'
);

select throws_ok(
  $$select public.service_assert_contribution_media_gate(
    '11111111-1111-4111-8111-111111111111', 'speech'
  )$$,
  'P0001', 'flag_disabled',
  'speech flag-off blocks media gate'
);

-- Under-18 / no age → age_required even when flag on
update public.app_config
set contribution_speech_enabled = true, contribution_photos_enabled = true
where id = 1;

update public.profiles
set age_confirmed_at = null
where user_id = '11111111-1111-4111-8111-111111111111';

select throws_ok(
  $$select public.service_assert_contribution_media_gate(
    '11111111-1111-4111-8111-111111111111',
    'speech'
  )$$,
  'P0001',
  'age_required',
  'under-18 / missing age cannot upload media'
);

-- Declined / missing consent
update public.profiles
set consent_version = null, age_confirmed_at = now()
where user_id = '11111111-1111-4111-8111-111111111111';

select throws_ok(
  $$select public.service_assert_contribution_media_gate(
    '11111111-1111-4111-8111-111111111111',
    'speech'
  )$$,
  'P0001',
  'consent_required',
  'declined consent cannot upload media'
);

-- Current adult consent and the historical photo toggle cannot reopen photos
update public.profiles
set
  consent_version = (select contribution_consent_version from public.app_config where id = 1),
  age_confirmed_at = now(),
  consented_at = now(),
  photo_sharing = true
where user_id = '11111111-1111-4111-8111-111111111111';

select throws_ok(
  $$select * from public.service_register_media_upload(
    '11111111-1111-4111-8111-111111111111',
    'photo', 'retired-photo-consented', 'image/jpeg', 4096, '{}'::jsonb
  )$$,
  '42501', 'photo_collection_retired',
  'current adult consent and enabled photo flag cannot authorize photo upload'
);

select is(
  (select count(*)::int from public.contribution_media where kind = 'photo'),
  0,
  'rejected photo registrations create no media rows'
);

-- Supported speech register + complete remains idempotent.
update public.profiles set speech_sharing = true
where user_id = '11111111-1111-4111-8111-111111111111';

select lives_ok(
  $$select * from public.service_register_media_upload(
    '11111111-1111-4111-8111-111111111111',
    'speech',
    'media-idemp-speech-1',
    'audio/mp4',
    4096,
    '{}'::jsonb
  )$$,
  'consented adult can register speech upload when flag on'
);

select is(
  (
    select inserted from public.service_register_media_upload(
      '11111111-1111-4111-8111-111111111111',
      'speech',
      'media-idemp-speech-1',
      'audio/mp4',
      4096,
      '{}'::jsonb
    )
  ),
  false,
  'register is idempotent for same user+key'
);

select lives_ok(
  $$select * from public.service_complete_media_upload(
    '11111111-1111-4111-8111-111111111111',
    (select id from public.contribution_media
      where user_id = '11111111-1111-4111-8111-111111111111'
        and idempotency_key = 'media-idemp-speech-1'),
    'deadbeefcafebabe'
  )$$,
  'complete marks uploaded'
);

-- ---------------------------------------------------------------------------
-- RLS: user A cannot read user B media rows
-- ---------------------------------------------------------------------------

-- Seed a row for user B via service path
update public.app_config set contribution_speech_enabled = true where id = 1;
update public.profiles
set
  consent_version = (select contribution_consent_version from public.app_config where id = 1),
  age_confirmed_at = now(),
  consented_at = now(),
  speech_sharing = true
where user_id = '22222222-2222-4222-8222-222222222222';

select lives_ok(
  $$select * from public.service_register_media_upload(
    '22222222-2222-4222-8222-222222222222',
    'speech',
    'media-idemp-speech-b',
    'audio/mp4',
    2048,
    '{}'::jsonb
  )$$,
  'user B can register their own media'
);

-- Simulate a pre-retirement row without reopening the upload route.
-- Historical photos still require isolation and linked-account deletion.
insert into public.contribution_media (
  user_id, kind, bucket_id, object_path, content_type, byte_size,
  idempotency_key, consent_version
) values (
  '22222222-2222-4222-8222-222222222222', 'photo',
  'contribution-photos', '22222222-2222-4222-8222-222222222222/historical',
  'image/jpeg', 2048, 'historical-photo-b',
  (select contribution_consent_version from public.app_config where id = 1)
);

select throws_ok(
  $$select * from public.service_complete_media_upload(
    '22222222-2222-4222-8222-222222222222',
    (select id from public.contribution_media where idempotency_key = 'historical-photo-b'),
    'deadbeefcafebabe'
  )$$,
  '42501', 'photo_collection_retired',
  'historical photo rows cannot complete an upload after retirement'
);

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select is_empty(
  $$select id from public.contribution_media
    where user_id = '22222222-2222-4222-8222-222222222222'$$,
  'user A cannot read user B media rows'
);

select results_eq(
  $$select user_id::text from public.contribution_media
    where user_id = '11111111-1111-4111-8111-111111111111'
    order by created_at$$,
  $$values ('11111111-1111-4111-8111-111111111111')$$,
  'user A can read own media metadata'
);

select throws_ok(
  $$insert into public.contribution_media (
    user_id, kind, bucket_id, object_path, content_type, byte_size,
    idempotency_key, consent_version
  ) values (
    '11111111-1111-4111-8111-111111111111',
    'photo',
    'contribution-photos',
    '11111111-1111-4111-8111-111111111111/client-forged',
    'image/jpeg',
    100,
    'forged-key',
    'x'
  )$$,
  '42501',
  'new row violates row-level security policy for table "contribution_media"',
  'authenticated cannot insert media rows'
);

-- ---------------------------------------------------------------------------
-- Deletion stubs exist; purge removes media rows
-- ---------------------------------------------------------------------------

reset role;

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'deletion_due_at'
  ),
  'profiles.deletion_due_at stub exists'
);

select lives_ok(
  $$select public.service_purge_user_data('22222222-2222-4222-8222-222222222222')$$,
  'purge removes user including media'
);

select is(
  (
    select count(*)::int from public.contribution_media
    where user_id = '22222222-2222-4222-8222-222222222222'
  ),
  0,
  'media rows purged with account'
);

select * from finish();
rollback;
