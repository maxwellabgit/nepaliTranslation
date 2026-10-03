begin;
select no_plan();
insert into private.admin_users(user_id, role) values('11111111-1111-4111-8111-111111111111','ops')
on conflict(user_id) do update set revoked_at=null;
update public.profiles set consent_version=(select contribution_consent_version from public.app_config where id=1),
  consented_at=now(), age_confirmed_at=now(), speech_sharing=true,
  consent_withdrawn_at=null, deletion_requested_at=null, deletion_due_at=null
where user_id='22222222-2222-4222-8222-222222222222';
insert into private.translation_reports(id,reporter_id,raw_source,model_output,raw_correction,idempotency_key,consent_version,metadata,created_at)
values
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','22222222-2222-4222-8222-222222222222',E'  synthetic\n source  ','shown','original answer','c5-original-answer',(select contribution_consent_version from public.app_config where id=1),'{"method":"todays_10","revision":1,"answer":"original answer"}', '2099-01-01T00:00:00Z'),
('ffffffff-ffff-4fff-8fff-ffffffffffff','22222222-2222-4222-8222-222222222222','synthetic source','shown','revised answer','c5-revised-answer',(select contribution_consent_version from public.app_config where id=1),'{"method":"todays_10","revision":2,"answer":"revised answer"}', '2099-01-01T00:00:00Z');
insert into public.contribution_media(id,user_id,kind,bucket_id,object_path,content_type,byte_size,idempotency_key,consent_version,status,metadata,created_at)
values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','22222222-2222-4222-8222-222222222222','speech','contribution-speech','22222222-2222-4222-8222-222222222222/c5.wav','audio/wav',64,'c5-synthetic-audio',(select contribution_consent_version from public.app_config where id=1),'uploaded','{"utteranceId":"synthetic","feedback":"down","durationMs":1000}','2099-01-01T00:00:00Z');

select is((public.service_admin_contributions('11111111-1111-4111-8111-111111111111',1)->'records'->0->>'correction'),'revised answer','revision preserved, stable descending tie order');
select is((public.service_admin_contributions('11111111-1111-4111-8111-111111111111',1)->'next_cursor'->>'key'),'report:ffffffff-ffff-4fff-8fff-ffffffffffff','cursor points to last delivered record');
select is((public.service_admin_contributions('11111111-1111-4111-8111-111111111111',1,'2099-01-01T00:00:00Z','report:ffffffff-ffff-4fff-8fff-ffffffffffff')->'records'->0->>'correction'),'original answer','next page retains original independently');
select is((public.service_admin_contributions('11111111-1111-4111-8111-111111111111',1,'2099-01-01T00:00:00Z','report:ffffffff-ffff-4fff-8fff-ffffffffffff')->'records'->0->>'source'),E'  synthetic\n source  ','original bytes preserved');
select is((public.service_admin_contributions('11111111-1111-4111-8111-111111111111',1,'2099-01-01T00:00:00Z','report:ffffffff-ffff-4fff-8fff-ffffffffffff')->'records'->0->>'normalized_source'),'synthetic source','normalized export separate from original');
select is((public.service_admin_contributions('11111111-1111-4111-8111-111111111111',1,'2099-01-01T00:00:00Z','report:eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')->'records'->0->'metadata'->>'utteranceId'),'synthetic','speech linkage retained');
select is((public.service_admin_contributions('11111111-1111-4111-8111-111111111111',1,null,null,true)->'records'->0->>'training_eligible'),'false','export never authorizes training');
select ok(exists(select 1 from private.audit_log where action='admin_contribution_export' and actor_id='11111111-1111-4111-8111-111111111111'),'export audited');
select throws_ok($$select public.service_admin_contributions('33333333-3333-4333-8333-333333333333')$$,'42501','forbidden','non-admin denied');
select throws_ok($$select public.service_admin_contributions('11111111-1111-4111-8111-111111111111',201)$$,'22023','invalid_payload','unbounded export denied');
select throws_ok($$select public.service_admin_contributions('11111111-1111-4111-8111-111111111111',1,null,'orphan')$$,'22023','invalid_payload','half cursor rejected');
update public.profiles set speech_sharing=false where user_id='22222222-2222-4222-8222-222222222222';
select throws_ok($$select public.service_admin_media_preview('11111111-1111-4111-8111-111111111111','dddddddd-dddd-4ddd-8ddd-dddddddddddd')$$,'P0002','not_found','speech opt-out denies new signed preview');
select is((select count(*)::integer from jsonb_array_elements(public.service_admin_contributions('11111111-1111-4111-8111-111111111111')->'records') r where r->>'record_type'='speech'),0,'speech opt-out removes export record');
update public.profiles set consent_withdrawn_at=now() where user_id='22222222-2222-4222-8222-222222222222';
select is((select count(*)::integer from jsonb_array_elements(public.service_admin_contributions('11111111-1111-4111-8111-111111111111')->'records') r where r->>'owner_id'='22222222-2222-4222-8222-222222222222'),0,'withdrawn marker excludes otherwise current profile');
update public.profiles set consent_withdrawn_at=null where user_id='22222222-2222-4222-8222-222222222222';
select private.ensure_deletion_request('22222222-2222-4222-8222-222222222222','consent_withdrawal');
select is((select count(*)::integer from jsonb_array_elements(public.service_admin_contributions('11111111-1111-4111-8111-111111111111')->'records') r where r->>'owner_id'='22222222-2222-4222-8222-222222222222'),0,'durable pending request excludes otherwise current profile');
select public.service_withdraw_contribution_consent('22222222-2222-4222-8222-222222222222');
select is((select count(*)::integer from jsonb_array_elements(public.service_admin_contributions('11111111-1111-4111-8111-111111111111')->'records') r where r->>'owner_id'='22222222-2222-4222-8222-222222222222'),0,'withdrawal excludes retained raw rows before purge');
set local role authenticated;
select throws_ok($$select public.service_admin_contributions('11111111-1111-4111-8111-111111111111')$$,'42501','permission denied for function service_admin_contributions','guest cannot impersonate admin RPC');
reset role;
update private.admin_users set revoked_at=now() where user_id='11111111-1111-4111-8111-111111111111';
select throws_ok($$select public.service_admin_contributions('11111111-1111-4111-8111-111111111111')$$,'42501','forbidden','revoked admin denied on next export');
select * from finish();
rollback;
