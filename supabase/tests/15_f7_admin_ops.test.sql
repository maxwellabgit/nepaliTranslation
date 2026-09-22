begin;
select no_plan();

-- Allowlisted admin succeeds
insert into private.admin_users (user_id, role, revoked_at)
values ('11111111-1111-4111-8111-111111111111', 'ops', null)
on conflict (user_id) do update
set role = excluded.role, revoked_at = null;

select is(
  (public.service_assert_admin('11111111-1111-4111-8111-111111111111') ->> 'ok'),
  'true',
  'allowlisted admin asserts ok'
);

-- Unknown user is forbidden
select throws_ok(
  $$select public.service_assert_admin('33333333-3333-4333-8333-333333333333')$$,
  '42501',
  'forbidden',
  'unknown user is forbidden'
);

-- Revoked admin is forbidden on next assert
update private.admin_users
set revoked_at = now()
where user_id = '11111111-1111-4111-8111-111111111111';

select throws_ok(
  $$select public.service_assert_admin('11111111-1111-4111-8111-111111111111')$$,
  '42501',
  'forbidden',
  'revoked admin is forbidden'
);

-- Restore allowlist for remaining checks
update private.admin_users
set revoked_at = null
where user_id = '11111111-1111-4111-8111-111111111111';

select ok(
  (public.service_admin_dashboard_summary() ? 'triage_reports'),
  'dashboard summary includes triage_reports'
);

select ok(
  (public.service_admin_get_flags() ? 'paywall_enabled'),
  'flags include paywall_enabled'
);

-- Patch a flag and audit
select is(
  (public.service_admin_patch_flags(
    '11111111-1111-4111-8111-111111111111',
    '{"learn_enabled": true}'::jsonb
  ) ->> 'learn_enabled'),
  'true',
  'admin can patch learn_enabled'
);

select ok(
  (
    select count(*) > 0
    from private.audit_log
    where action = 'admin_patch_flags'
      and actor_id = '11111111-1111-4111-8111-111111111111'
  ),
  'flag patch writes audit_log'
);

-- Dataset staging (manual only)
select is(
  (public.service_admin_stage_dataset_export(
    '11111111-1111-4111-8111-111111111111',
    'v1-test',
    '{"status":["uploaded"]}'::jsonb,
    'staging/exports/v1-test.jsonl',
    0,
    'pending'
  ) ->> 'staged'),
  'true',
  'dataset export stages without training'
);

-- Media preview requires a row; insert synthetic and audit
insert into public.contribution_media (
  id, user_id, kind, bucket_id, object_path, content_type, byte_size,
  idempotency_key, consent_version, status
) values (
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  '22222222-2222-4222-8222-222222222222',
  'photo',
  'contribution-photos',
  '22222222-2222-4222-8222-222222222222/f7-preview.jpg',
  'image/jpeg',
  1024,
  'f7-admin-media-preview',
  '2026-09-21.media',
  'uploaded'
) on conflict do nothing;

select is(
  (public.service_admin_media_preview(
    '11111111-1111-4111-8111-111111111111',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  ) ->> 'bucket_id'),
  'contribution-photos',
  'media preview returns bucket'
);

select ok(
  (
    select count(*) > 0
    from private.audit_log
    where action = 'admin_media_preview'
      and target = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  ),
  'media preview writes audit_log'
);

select * from finish();
rollback;
