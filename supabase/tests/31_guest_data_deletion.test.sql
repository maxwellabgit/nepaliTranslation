begin;
select no_plan();

-- Existing synthetic users only; anonymous JWT uses authenticated role, not anon key.
update public.earned_entitlements set lifetime_credits = 17, earned_ad_free_until = now() + interval '1 hour'
where user_id = '11111111-1111-4111-8111-111111111111';
insert into private.translation_reports (reporter_id, raw_source, raw_correction, status, idempotency_key)
values ('11111111-1111-4111-8111-111111111111', 'private guest source', 'private correction', 'accepted', 'guest-delete-accepted');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":true}', true);
select lives_ok('select public.request_shared_data_deletion()', 'authenticated guest can request shared-data deletion');
select throws_ok($$select public.service_withdraw_contribution_consent('22222222-2222-4222-8222-222222222222')$$,
  '42501', 'forbidden', 'guest cannot withdraw another identity');
select is((select lifetime_credits from public.earned_entitlements where user_id = auth.uid()), 17,
  'request retains guest credits');
select is((select count(*)::int from public.profiles where user_id = '22222222-2222-4222-8222-222222222222'), 0,
  'anonymous JWT cannot read another identity');
reset role;

create temporary table guest_due as select deletion_due_at from public.profiles
where user_id = '11111111-1111-4111-8111-111111111111';
update public.profiles set deletion_due_at = deletion_due_at - interval '1 day'
where user_id = '11111111-1111-4111-8111-111111111111';
update guest_due set deletion_due_at = deletion_due_at - interval '1 day';
select is((public.service_withdraw_contribution_consent('11111111-1111-4111-8111-111111111111')->>'deletion_due_at')::timestamptz,
  (select deletion_due_at from guest_due), 'retry returns the original deadline, never extends it');
select is((select consent_version from public.profiles where user_id = '11111111-1111-4111-8111-111111111111'),
  null::text, 'withdrawal clears current contribution consent');
select is((select speech_sharing from public.profiles where user_id = '11111111-1111-4111-8111-111111111111'),
  false, 'withdrawal turns speech upload off');
select throws_ok($$select public.service_record_consent('11111111-1111-4111-8111-111111111111',
  (select contribution_consent_version from public.app_config where id = 1), true)$$,
  'P0001', 'deletion_pending', 'fresh opt-in cannot cancel an unfinished purge');

select is((public.service_complete_deletion_database((select id from private.deletion_requests
where user_id = '11111111-1111-4111-8111-111111111111' and request_kind = 'consent_withdrawal' and completed_at is null))->>'reason'),
  'storage_incomplete', 'shared-data database deletion waits for storage proof');
update private.deletion_requests set storage_completed = true
where user_id = '11111111-1111-4111-8111-111111111111' and request_kind = 'consent_withdrawal' and completed_at is null;
select is((public.service_complete_deletion_database((select id from private.deletion_requests
where user_id = '11111111-1111-4111-8111-111111111111' and request_kind = 'consent_withdrawal' and completed_at is null))->>'stage'),
  'complete', 'guest shared-data purge completes without deleting identity');
select is((select count(*)::int from private.translation_reports where reporter_id = '11111111-1111-4111-8111-111111111111'),
  0, 'accepted raw corrections are actually removed');
select is((select lifetime_credits from public.earned_entitlements where user_id = '11111111-1111-4111-8111-111111111111'),
  17, 'completed withdrawal does not claw back credits');
select is((select count(*)::int from auth.users where id = '11111111-1111-4111-8111-111111111111'),
  1, 'private identity survives shared-data deletion');
select is((select count(*)::int from public.profiles where user_id = '11111111-1111-4111-8111-111111111111'),
  1, 'private profile survives for status and future consent');
select lives_ok($$select public.service_record_consent('11111111-1111-4111-8111-111111111111',
  (select contribution_consent_version from public.app_config where id = 1), true)$$,
  'fresh explicit consent can resume after the purge completed');
select is((select consent_withdrawn_at from public.profiles where user_id = '11111111-1111-4111-8111-111111111111'),
  null::timestamptz, 'renewed consent clears the completed withdrawal marker');
select is((select speech_sharing from public.profiles where user_id = '11111111-1111-4111-8111-111111111111'),
  false, 'renewed opt-in does not automatically enable raw audio');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok('select public.request_shared_data_deletion()', '42501', null,
  'public anon key cannot request private deletion');
reset role;
select * from finish();
rollback;
