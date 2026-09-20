begin;
select no_plan();

-- User A leases a task and receives an assignment_id.
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"service_role"}',
  true
);
set local role service_role;

select ok(
  (select (public.service_lease_contribution_task(
    '11111111-1111-4111-8111-111111111111'
  ) ->> 'assignment_id') is not null),
  'lease payload includes assignment_id'
);

select ok(
  (select (public.service_lease_contribution_task(
    '11111111-1111-4111-8111-111111111111'
  ) ? 'task_type') = false),
  'lease payload still hides task_type'
);

-- Authenticated user B cannot record a submission for user A's assignment.
reset role;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.service_record_submission(
    '11111111-1111-4111-8111-111111111111',
    (select id from private.task_assignments
      where user_id = '11111111-1111-4111-8111-111111111111'
      order by created_at desc limit 1),
    'looks_correct',
    'x',
    'x',
    0.5,
    'pending',
    'idem-owner-check-1'
  )$$,
  '42501'
);

select * from finish();
rollback;
