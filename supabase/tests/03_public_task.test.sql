begin;
select no_plan();

create temp table leased as
select private.lease_safe_task('11111111-1111-4111-8111-111111111111') as payload;

select ok(
  (select payload ? 'public_task_id' from leased),
  'leased known check returns a public task id'
);

select is(
  (select payload ->> 'reward_label' from leased),
  'Earn 1–2 credits after daily close (5 PM New York)',
  'leased task returns the generic reward label'
);

select ok(
  not (select payload ? 'task_type' from leased),
  'leased payload omits task_type'
);

select ok(
  not (select payload ? 'reference_set_id' from leased),
  'leased payload omits reference_set_id'
);

select ok(
  (select payload::text from leased) !~* 'known_check|reference_set|is_known|normalized_text',
  'leased known-check JSON has no known/reference field names'
);

select is(
  (select count(*)::int from private.task_assignments
    where user_id = '11111111-1111-4111-8111-111111111111'),
  1,
  'lease creates one assignment row'
);

select * from finish();
rollback;
