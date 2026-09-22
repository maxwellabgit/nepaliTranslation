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
-- Consent current but photos flag off → flag_disabled
-- ---------------------------------------------------------------------------

update public.profiles
set
  consent_version = (select contribution_consent_version from public.app_config where id = 1),
  age_confirmed_at = now(),
  consented_at = now()
where user_id = '11111111-1111-4111-8111-111111111111';

select throws_ok(
  $$select public.service_assert_contribution_media_gate(
    '11111111-1111-4111-8111-111111111111',
    'photo'
  )$$,
  'P0001',
  'flag_disabled',
  'photos flag-off blocks media gate'
);

select throws_ok(
  $$select public.service_assert_contribution_media_gate(
    '11111111-1111-4111-8111-111111111111',
    'speech'
  )$$,
  'P0001',
  'flag_disabled',
  'speech flag-off blocks media gate'
);

-- Under-18 / no age → age_required even when flag on
update public.app_config
set contribution_photos_enabled = true
where id = 1;

update public.profiles
set age_confirmed_at = null
where user_id = '11111111-1111-4111-8111-111111111111';

select throws_ok(
  $$select public.service_assert_contribution_media_gate(
    '11111111-1111-4111-8111-111111111111',
    'photo'
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
    'photo'
  )$$,
  'P0001',
  'consent_required',
  'declined consent cannot upload media'
);

-- Happy path register + complete (idempotent)
update public.profiles
set
  consent_version = (select contribution_consent_version from public.app_config where id = 1),
  age_confirmed_at = now(),
  consented_at = now()
where user_id = '11111111-1111-4111-8111-111111111111';

select lives_ok(
  $$select * from public.service_register_media_upload(
    '11111111-1111-4111-8111-111111111111',
    'photo',
    'media-idemp-photo-1',
    'image/jpeg',
    4096,
    '{}'::jsonb
  )$$,
  'consented adult can register photo upload when flag on'
);

select is(
  (
    select inserted from public.service_register_media_upload(
      '11111111-1111-4111-8111-111111111111',
      'photo',
      'media-idemp-photo-1',
      'image/jpeg',
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
        and idempotency_key = 'media-idemp-photo-1'),
    'deadbeefcafebabe'
  )$$,
  'complete marks uploaded'
);

-- ---------------------------------------------------------------------------
-- RLS: user A cannot read user B media rows
-- ---------------------------------------------------------------------------

-- Seed a row for user B via service path
update public.app_config set contribution_photos_enabled = true where id = 1;
update public.profiles
set
  consent_version = (select contribution_consent_version from public.app_config where id = 1),
  age_confirmed_at = now(),
  consented_at = now()
where user_id = '22222222-2222-4222-8222-222222222222';

select lives_ok(
  $$select * from public.service_register_media_upload(
    '22222222-2222-4222-8222-222222222222',
    'photo',
    'media-idemp-photo-b',
    'image/jpeg',
    2048,
    '{}'::jsonb
  )$$,
  'user B can register their own media'
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
