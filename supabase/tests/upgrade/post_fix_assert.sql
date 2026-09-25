-- Assert pre-fix rows survived migrations after 20260923220000.
-- A successful apply on an empty schema is not this proof.
-- One unchanged deletion row does not prove retry or the 30-day executor.

do $$
declare
  v_profile public.profiles;
  v_media_a public.contribution_media;
  v_media_b public.contribution_media;
  v_deletion private.deletion_requests;
  v_submission_user uuid;
  v_source uuid;
begin
  select * into v_profile from public.profiles
  where user_id = '11111111-1111-4111-8111-111111111111';
  if v_profile.startup_consent_version is distinct from 'pre-fix-consent' then
    raise exception 'profile consent was not preserved';
  end if;
  if v_profile.speech_sharing is distinct from false
     or v_profile.photo_sharing is distinct from false
     or v_profile.media_cancel_generation is distinct from 0 then
    raise exception 'new sharing columns did not default off for the old account';
  end if;

  select * into v_media_a from public.contribution_media
  where id = '00000000-0000-4000-8000-0000000000a1';
  if v_media_a.user_id is distinct from '11111111-1111-4111-8111-111111111111'
     or v_media_a.status is distinct from 'pending_upload' then
    raise exception 'user A queued photo changed owner or status';
  end if;

  select * into v_media_b from public.contribution_media
  where id = '00000000-0000-4000-8000-0000000000b1';
  if v_media_b.user_id is distinct from '22222222-2222-4222-8222-222222222222'
     or v_media_b.status is distinct from 'uploaded' then
    raise exception 'user B speech file changed owner or status';
  end if;

  select * into v_deletion from private.deletion_requests
  where id = '00000000-0000-4000-8000-0000000000d1';
  if v_deletion.due_at is distinct from '2026-08-01 15:00:00+00'::timestamptz
     or v_deletion.requested_at is distinct from '2026-07-02 15:00:00+00'::timestamptz
     or v_deletion.attempt_count is distinct from 2
     or v_deletion.last_error is distinct from 'storage_list_failed'
     or v_deletion.stage is distinct from 'storage'
     or v_deletion.completed_at is not null
     or v_deletion.storage_completed is distinct from false then
    raise exception 'deletion request deadline or failure state was rewritten';
  end if;

  select s.user_id, s.source_item_id into v_submission_user, v_source
  from public.review_submissions s
  where s.window_id = '00000000-0000-4000-8000-0000000000e1';
  if v_submission_user is distinct from '11111111-1111-4111-8111-111111111111'
     or v_source is distinct from '00000000-0000-4000-8000-0000000000c1' then
    raise exception 'review submission ownership changed';
  end if;

  if (select public_review_enabled from public.app_config where id = 1) is true then
    raise exception 'upgrade turned public review on';
  end if;
end $$;
