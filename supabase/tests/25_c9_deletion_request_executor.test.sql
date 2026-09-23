-- Deletion executor reads private.deletion_requests.
-- Withdrawal, storage failure, and auth failure are separate.

begin;
select no_plan();

insert into public.profiles (user_id)
values ('22222222-2222-4222-8222-222222222222')
on conflict (user_id) do nothing;

select public.service_withdraw_contribution_consent(
  '22222222-2222-4222-8222-222222222222'
);

update private.deletion_requests
   set due_at = now() - interval '1 minute',
       next_retry_at = null
 where user_id = '22222222-2222-4222-8222-222222222222'
   and request_kind = 'consent_withdrawal'
   and completed_at is null;

select is(
  (select deletion_requested_at is null from public.profiles
    where user_id = '22222222-2222-4222-8222-222222222222'),
  true,
  'withdrawal does not set account deletion_requested_at'
);

select is(
  (select count(*)::int from public.service_list_due_deletion_requests(20)
    where user_id = '22222222-2222-4222-8222-222222222222'
      and request_kind = 'consent_withdrawal'),
  1,
  'due query returns the withdrawal request'
);

select ok(
  (public.service_record_deletion_storage(
    (select id from private.deletion_requests
      where user_id = '22222222-2222-4222-8222-222222222222'
        and request_kind = 'consent_withdrawal'
        and completed_at is null),
    false,
    'partial_delete'
  ) ->> 'stage') = 'storage',
  'partial storage failure stays on the storage stage'
);

select is(
  (select database_completed from private.deletion_requests
    where user_id = '22222222-2222-4222-8222-222222222222'
      and request_kind = 'consent_withdrawal'
      and completed_at is null),
  false,
  'storage failure does not complete the database purge'
);

update private.deletion_requests
   set storage_completed = true,
       next_retry_at = null,
       last_error = null
 where user_id = '22222222-2222-4222-8222-222222222222'
   and request_kind = 'consent_withdrawal'
   and completed_at is null;

select is(
  (public.service_complete_deletion_database(
    (select id from private.deletion_requests
      where user_id = '22222222-2222-4222-8222-222222222222'
        and request_kind = 'consent_withdrawal')
  ) ->> 'stage'),
  'complete',
  'withdrawal completes without auth deletion'
);

insert into public.profiles (user_id)
values ('11111111-1111-4111-8111-111111111111')
on conflict (user_id) do nothing;

select public.service_request_account_deletion(
  '11111111-1111-4111-8111-111111111111'
);

update private.deletion_requests
   set due_at = now() - interval '1 minute',
       storage_completed = true,
       database_completed = true,
       stage = 'auth',
       auth_completion = 'pending',
       next_retry_at = null
 where user_id = '11111111-1111-4111-8111-111111111111'
   and request_kind = 'account_deletion'
   and completed_at is null;

select ok(
  (public.service_record_deletion_auth(
    (select id from private.deletion_requests
      where user_id = '11111111-1111-4111-8111-111111111111'
        and request_kind = 'account_deletion'
        and completed_at is null),
    false,
    'auth admin down'
  ) ->> 'stage') = 'auth',
  'failed auth deletion stays retryable'
);

select is(
  (select completed_at is null and auth_completion = 'failed'
     from private.deletion_requests
    where user_id = '11111111-1111-4111-8111-111111111111'
      and request_kind = 'account_deletion'),
  true,
  'auth failure keeps the request row'
);

update private.deletion_requests
   set next_retry_at = now() - interval '1 minute'
 where user_id = '11111111-1111-4111-8111-111111111111'
   and request_kind = 'account_deletion'
   and completed_at is null;

select is(
  (select count(*)::int from public.service_list_due_deletion_requests(20)
    where request_kind = 'account_deletion'
      and user_id = '11111111-1111-4111-8111-111111111111'),
  1,
  'auth failure is due again after next_retry_at'
);

select is(
  (public.service_record_deletion_auth(
    (select id from private.deletion_requests
      where user_id = '11111111-1111-4111-8111-111111111111'
        and request_kind = 'account_deletion'
        and completed_at is null),
    true,
    null
  ) ->> 'stage'),
  'complete',
  'auth retry can complete the same request'
);

select * from finish();
rollback;
