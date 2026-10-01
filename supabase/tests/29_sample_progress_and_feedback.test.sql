begin;
select no_plan();

set local role anon;

select throws_ok(
  $$select public.record_sample_progress('review-roster-370', 370, 334, now())$$,
  '42501'
);

select throws_ok(
  $$insert into public.sample_allotment_events (
      user_id, corpus_version, allotted, completed, crossed_at
    ) values (
      '11111111-1111-4111-8111-111111111111',
      'review-roster-370', 370, 334, now()
    )$$,
  '42501'
);

reset role;

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.record_sample_progress('review-roster-370', 370, 334, now())$$,
  '334 of 370 records one crossing'
);

select lives_ok(
  $$select public.record_sample_progress('review-roster-370', 370, 334, now())$$,
  'a second acknowledgement does not fail'
);

select is(
  (select count(*)::int from public.sample_allotment_events
    where user_id = '11111111-1111-4111-8111-111111111111'),
  1,
  'one durable sample event'
);

select throws_ok(
  $$select public.record_sample_progress('review-roster-370', 370, 333, now())$$,
  '22023'
);

select throws_ok(
  $$select public.record_sample_progress('other-manifest', 370, 334, now())$$,
  '22023'
);

select throws_ok(
  $$select public.record_sample_progress('review-roster-370', 370, 400, now())$$,
  '22023'
);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);

select is_empty(
  $$select user_id from public.sample_allotment_events
    where user_id = '11111111-1111-4111-8111-111111111111'$$,
  'account B cannot read account A progress'
);

select throws_ok(
  $$insert into public.sample_allotment_events (
      user_id, corpus_version, allotted, completed, crossed_at
    ) values (
      '11111111-1111-4111-8111-111111111111',
      'review-roster-370', 370, 334, now()
    )$$,
  '42501'
);

reset role;

insert into public.contribution_media (
  user_id, kind, bucket_id, object_path, content_type, byte_size,
  idempotency_key, consent_version, status, metadata
) values (
  '11111111-1111-4111-8111-111111111111',
  'speech',
  'contribution-speech',
  '11111111-1111-4111-8111-111111111111/feedback.m4a',
  'audio/mp4',
  2048,
  'utt:user-a:1',
  '2026-09-21.media',
  'uploaded',
  '{"feedback":"unrated","feedbackRevision":1,"transcript":"hello"}'::jsonb
);

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select ok(
  public.revise_media_feedback(
    'utt:user-a:1',
    '{"feedback":"down","feedbackRevision":2,"transcript":"hello"}'::jsonb
  ),
  'the owner can revise speech feedback'
);

select is(
  (select metadata->>'feedback' from public.contribution_media
    where idempotency_key = 'utt:user-a:1'),
  'down',
  'server feedback matches the later rating'
);

select is(
  (select count(*)::int from public.contribution_media
    where idempotency_key = 'utt:user-a:1'),
  1,
  'a rating does not create a second media row'
);

select ok(
  public.revise_media_feedback(
    'utt:user-a:1',
    '{"feedback":"up","feedbackRevision":1}'::jsonb
  ),
  'a stale rating is acknowledged without overwriting'
);

select is(
  (select metadata->>'feedback' from public.contribution_media
    where idempotency_key = 'utt:user-a:1'),
  'down',
  'an older revision does not replace the latest rating'
);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.revise_media_feedback(
      'utt:user-a:1',
      '{"feedback":"up","feedbackRevision":3}'::jsonb
    )$$,
  'P0002'
);

reset role;

update public.app_config
set contribution_speech_enabled = true
where id = 1;

update public.profiles
set
  consent_version = (select contribution_consent_version from public.app_config where id = 1),
  age_confirmed_at = now(),
  consented_at = now(),
  speech_sharing = true
where user_id = '11111111-1111-4111-8111-111111111111';

set local role service_role;

select lives_ok(
  $$select * from public.service_register_media_upload(
    '11111111-1111-4111-8111-111111111111',
    'speech',
    'utt:register:1',
    'audio/mp4',
    4096,
    '{"feedback":"unrated","feedbackRevision":1,"transcript":"namaste"}'::jsonb
  )$$,
  'speech registration still creates one object'
);

select lives_ok(
  $$select * from public.service_register_media_upload(
    '11111111-1111-4111-8111-111111111111',
    'speech',
    'utt:register:1',
    'audio/mp4',
    4096,
    '{"feedback":"up","feedbackRevision":2,"transcript":"namaste"}'::jsonb
  )$$,
  'a repeated registration accepts a newer rating'
);

select is(
  (select count(*)::int from public.contribution_media
    where idempotency_key = 'utt:register:1'),
  1,
  'repeated registration keeps one media object'
);

select is(
  (select metadata->>'feedback' from public.contribution_media
    where idempotency_key = 'utt:register:1'),
  'up',
  'registration merges the newer rating into the same row'
);

select * from finish();
rollback;
