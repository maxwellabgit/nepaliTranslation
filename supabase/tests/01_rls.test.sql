begin;
select no_plan();

-- Anon cannot read private tables or public user rows.
set local role anon;

select throws_ok(
  $$select * from private.contribution_tasks$$,
  '42501'
);

select throws_ok(
  $$select * from private.known_references$$,
  '42501'
);

select throws_ok(
  $$insert into private.contribution_tasks (source_text, model_output, direction, formality, script, task_type, provenance)
    values ('x', 'y', 'en-ne', 'formal', 'deva', 'unknown', 'test')$$,
  '42501'
);

select throws_ok(
  $$select user_id from public.profiles$$,
  '42501'
);

select is(
  (select count(*) from public.app_config),
  1::bigint,
  'anon can read the single app_config row'
);

-- User A cannot see user B.
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq(
  $$select user_id::text from public.contribution_receipts order by user_id$$,
  $$values ('11111111-1111-4111-8111-111111111111')$$,
  'user A sees only their receipts'
);

select is_empty(
  $$select user_id from public.contribution_receipts where user_id = '22222222-2222-4222-8222-222222222222'$$,
  'user A cannot read user B receipts'
);

select throws_ok(
  $$insert into public.reward_ledger (user_id, source_type, source_id, credits, minutes)
    values ('11111111-1111-4111-8111-111111111111', 'admin', 'client-mint', 9, 45)$$,
  '42501'
);

select throws_ok(
  $$insert into public.earned_entitlements (user_id, lifetime_credits)
    values ('11111111-1111-4111-8111-111111111111', 100)$$,
  '42501'
);

select throws_ok(
  $$update public.earned_entitlements set lifetime_credits = 999
    where user_id = '11111111-1111-4111-8111-111111111111'$$,
  '42501'
);

select throws_ok(
  $$select * from private.known_references$$,
  '42501'
);

select * from finish();
rollback;
