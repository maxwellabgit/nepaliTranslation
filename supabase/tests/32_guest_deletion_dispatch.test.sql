begin;
select no_plan();
select public.service_withdraw_contribution_consent('11111111-1111-4111-8111-111111111111');
select ok((select due_at > now() from private.deletion_requests
  where user_id='11111111-1111-4111-8111-111111111111' and request_kind='consent_withdrawal' and completed_at is null),
  'original withdrawal deadline remains in the future');
select is((select count(*)::integer from public.service_list_due_deletion_requests(50)
  where user_id='11111111-1111-4111-8111-111111111111'),1,
  'worker dispatches shared-data withdrawal before its upper-bound deadline');
update private.deletion_requests set next_retry_at=now()+interval '1 hour'
where user_id='11111111-1111-4111-8111-111111111111' and completed_at is null;
select is((select count(*)::integer from public.service_list_due_deletion_requests(50)
  where user_id='11111111-1111-4111-8111-111111111111'),0,
  'storage failure backoff still prevents immediate retry');
update private.deletion_requests set next_retry_at=null,request_kind='account_deletion'
where user_id='11111111-1111-4111-8111-111111111111' and completed_at is null;
select is((select count(*)::integer from public.service_list_due_deletion_requests(50)
  where user_id='11111111-1111-4111-8111-111111111111'),0,
  'historical full-identity deletion retains its original scheduling');
select throws_ok('select public.service_list_due_deletion_requests(0)', '22023','invalid_payload','invalid worker limit rejected');
set local role authenticated;
select throws_ok('select public.service_list_due_deletion_requests(50)', '42501',
  'permission denied for function service_list_due_deletion_requests','guest cannot run privileged dispatcher');
reset role;
select * from finish();
rollback;
