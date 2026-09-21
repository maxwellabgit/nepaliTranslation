begin;
select no_plan();

-- Ensure consent
update public.profiles
set consent_version = '2026-09-19.draft', age_confirmed_at = now(), consented_at = now()
where user_id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222'
);

-- Deterministic unknown-task assignments for consensus
delete from private.task_assignments
where user_id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222'
)
and task_id = 'd0d0d0d0-d0d0-40d0-80d0-d0d0d0d0d0d0';

update private.contribution_tasks
set state = 'open'
where id = 'd0d0d0d0-d0d0-40d0-80d0-d0d0d0d0d0d0';

insert into private.task_assignments (id, task_id, user_id, leased_until)
values
(
  'a1111111-1111-4111-8111-111111111111',
  'd0d0d0d0-d0d0-40d0-80d0-d0d0d0d0d0d0',
  '11111111-1111-4111-8111-111111111111',
  now() + interval '15 minutes'
),
(
  'a2222222-2222-4222-8222-222222222222',
  'd0d0d0d0-d0d0-40d0-80d0-d0d0d0d0d0d0',
  '22222222-2222-4222-8222-222222222222',
  now() + interval '15 minutes'
);

-- First contributor submits looks_correct → pending (one vote)
select is(
  (public.service_submit_contribution_atomic(
    '11111111-1111-4111-8111-111111111111',
    'a1111111-1111-4111-8111-111111111111',
    'looks_correct',
    null,
    'idem-user-a-submit-01'
  ) ->> 'status'),
  'received',
  'first submit returns opaque received'
);

select is(
  (select status from public.contribution_receipts
    where idempotency_key = 'idem-user-a-submit-01'),
  'pending',
  'single vote stays pending (model similarity alone does not resolve)'
);

-- Replay same user: same receipt, zero ledger/stats change
select is(
  (select count(*)::int from public.reward_ledger
    where user_id = '11111111-1111-4111-8111-111111111111'
      and source_id like 'submission:%'),
  0,
  'no reward yet for pending consensus'
);

select is(
  (public.service_submit_contribution_atomic(
    '11111111-1111-4111-8111-111111111111',
    'a1111111-1111-4111-8111-111111111111',
    'looks_correct',
    null,
    'idem-user-a-submit-01'
  ) ->> 'replay')::boolean,
  true,
  'replay returns prior receipt'
);

select is(
  (select count(*)::int from private.submissions
    where user_id = '11111111-1111-4111-8111-111111111111'
      and assignment_id = 'a1111111-1111-4111-8111-111111111111'),
  1,
  'replay does not create a second submission'
);

-- Second normal contributor agrees → resolve + reward both
select is(
  (public.service_submit_contribution_atomic(
    '22222222-2222-4222-8222-222222222222',
    'a2222222-2222-4222-8222-222222222222',
    'looks_correct',
    null,
    'idem-user-b-submit-01'
  ) ->> 'status'),
  'received',
  'second submit returns opaque received'
);

select is(
  (select state from private.contribution_tasks
    where id = 'd0d0d0d0-d0d0-40d0-80d0-d0d0d0d0d0d0'),
  'resolved',
  'two agreeing normals resolve the unknown task'
);

select is(
  (select count(*)::int from public.reward_ledger
    where source_type = 'contribution'
      and source_id like 'submission:%'
      and user_id in (
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222'
      )),
  2,
  'both eligible contributors are rewarded once'
);

select is(
  (select count(*)::int from public.contribution_receipts
    where public_task_id = 'd0d0d0d0-d0d0-40d0-80d0-d0d0d0d0d0d0'
      and status = 'validated'),
  2,
  'earlier contributor receipt is validated when later vote creates consensus'
);

-- Opaque envelope never includes known fields
select is(
  (public.service_submit_contribution_atomic(
    '11111111-1111-4111-8111-111111111111',
    'a1111111-1111-4111-8111-111111111111',
    'looks_correct',
    null,
    'idem-user-a-submit-01'
  )::text like '%known%'),
  false,
  'submit JSON does not mention known'
);

select * from finish();
rollback;
