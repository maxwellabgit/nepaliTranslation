-- Seed representative rows on a database reset to 20260923220000.
-- Fail if a later column already exists. Do not run this on the final schema.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'speech_sharing'
  ) then
    raise exception 'pre_fix_seed: speech_sharing already exists; reset to 20260923220000 first';
  end if;
end $$;

update public.profiles
set startup_consent_version = 'pre-fix-consent',
    consent_version = 'pre-fix-contribution',
    consented_at = '2026-07-01 12:00:00+00',
    age_confirmed_at = '2026-07-01 12:00:00+00',
    deletion_due_at = '2026-08-01 15:00:00+00'
where user_id = '11111111-1111-4111-8111-111111111111';

insert into public.contribution_media (
  id, user_id, kind, bucket_id, object_path, content_type, byte_size,
  idempotency_key, consent_version, status
) values (
  '00000000-0000-4000-8000-0000000000a1',
  '11111111-1111-4111-8111-111111111111',
  'photo', 'contribution-photos',
  '11111111-1111-4111-8111-111111111111/pre-fix-photo',
  'image/jpeg', 1024,
  'upgrade-pre-fix-photo-a', 'pre-fix-contribution', 'pending_upload'
), (
  '00000000-0000-4000-8000-0000000000b1',
  '22222222-2222-4222-8222-222222222222',
  'speech', 'contribution-speech',
  '22222222-2222-4222-8222-222222222222/pre-fix-speech',
  'audio/mp4', 2048,
  'upgrade-pre-fix-speech-b', 'pre-fix-contribution', 'uploaded'
);

insert into private.deletion_requests (
  id, request_kind, user_id, requested_at, due_at, stage,
  attempt_count, last_error, next_retry_at,
  storage_completed, database_completed, auth_completion
) values (
  '00000000-0000-4000-8000-0000000000d1',
  'account_deletion',
  '11111111-1111-4111-8111-111111111111',
  '2026-07-02 15:00:00+00',
  '2026-08-01 15:00:00+00',
  'storage',
  2,
  'storage_list_failed',
  '2026-07-03 15:00:00+00',
  false, false, 'pending'
);

insert into private.review_source_items (
  id, content_hash, origin, direction, source_text, proposed_target,
  source_char_length, pii_flag, public_review_eligible,
  rights_status, origin_class, anonymization_status
) values (
  '00000000-0000-4000-8000-0000000000c1',
  'upgrade-pre-fix-hash', 'test:upgrade-pre-fix', 'en-ne',
  'pre-fix source', 'पूर्व लक्ष्य',
  14, false, true,
  'cleared_public_display', 'training_source', 'not_required'
);

insert into public.review_windows (id, ny_close_at, state, size)
values (
  '00000000-0000-4000-8000-0000000000e1',
  '2026-07-15 21:00:00+00', 'open', 1
);

insert into public.review_window_items (
  window_id, slot, source_item_id, length_tier_snapshot, scheduled_credits
) values (
  '00000000-0000-4000-8000-0000000000e1', 1,
  '00000000-0000-4000-8000-0000000000c1', 1, 2
);

insert into public.review_submissions (
  window_id, slot, source_item_id, user_id, action,
  original_source_snapshot, length_tier_snapshot, scheduled_credits
) values (
  '00000000-0000-4000-8000-0000000000e1', 1,
  '00000000-0000-4000-8000-0000000000c1',
  '11111111-1111-4111-8111-111111111111', 'confirm',
  'pre-fix source', 1, 2
);
