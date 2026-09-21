begin;
select no_plan();

-- SQL ↔ TS fixture parity (shared scoring decisions)
select is(
  public.service_normalize_for_score('  Hello!!!  '),
  'hello!',
  'roman case and terminal punctuation normalize'
);

select is(
  public.service_similarity('का', 'क' || U&'\093E'),
  1::numeric,
  'NFC Devanagari similarity is 1'
);

select is(
  public.service_known_check_passes('तपाईं जानुहोस्', array['तिमी जाऊ']),
  false,
  'formal vs informal does not pass known check'
);

select ok(
  public.service_similarity('तपाईं जानुहोस्', 'तिमी जाऊ') < 0.72,
  'formal/informal similarity below known threshold'
);

select is(
  public.service_known_check_passes('म आज जान्छु', array['म आज जाँदिन']),
  false,
  'negation does not pass known check'
);

select is(
  public.service_similarity('', ''),
  null,
  'empty pair is invalid'
);

select is(
  public.service_similarity(
    repeat('अ', 600),
    repeat('अ', 600)
  ),
  null,
  'oversized inputs return null similarity (admin pending)'
);

-- Model-only: one high-similarity vote does not resolve
delete from private.task_assignments
where task_id = 'd0d0d0d0-d0d0-40d0-80d0-d0d0d0d0d0d0';

update private.contribution_tasks
set state = 'open'
where id = 'd0d0d0d0-d0d0-40d0-80d0-d0d0d0d0d0d0';

insert into private.task_assignments (id, task_id, user_id, leased_until)
values (
  'b1111111-1111-4111-8111-111111111111',
  'd0d0d0d0-d0d0-40d0-80d0-d0d0d0d0d0d0',
  '11111111-1111-4111-8111-111111111111',
  now() + interval '15 minutes'
);

update public.profiles
set consent_version = '2026-09-19.draft', age_confirmed_at = now(), consented_at = now()
where user_id = '11111111-1111-4111-8111-111111111111';

select public.service_submit_contribution_atomic(
  '11111111-1111-4111-8111-111111111111',
  'b1111111-1111-4111-8111-111111111111',
  'looks_correct',
  null,
  'idem-model-only-01'
);

select is(
  (select state from private.contribution_tasks
    where id = 'd0d0d0d0-d0d0-40d0-80d0-d0d0d0d0d0d0'),
  'open',
  'similarity without human agreement remains pending/open'
);

select is(
  (private.resolve_task_consensus('d0d0d0d0-d0d0-40d0-80d0-d0d0d0d0d0d0')
    ->> 'status'),
  'pending',
  'consensus status pending with one vote'
);

select * from finish();
rollback;
