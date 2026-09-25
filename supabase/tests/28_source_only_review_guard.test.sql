begin;
select no_plan();

insert into private.review_source_items (
  content_hash, origin, direction, register, script, source_text,
  proposed_target, source_char_length, pii_flag, public_review_eligible,
  rights_status, origin_class, anonymization_status
) values (
  'test-source-only-guard', 'test:source-only', 'en-ne', 'informal',
  'deva', 'Please repeat that.', null, 19, false, true,
  'cleared_public_display', 'training_source', 'not_required'
);

select throws_ok($$
  insert into public.review_submissions (
    window_id, slot, source_item_id, user_id, action,
    original_source_snapshot, original_proposed_snapshot,
    length_tier_snapshot, scheduled_credits
  ) select
    '00000000-0000-4000-b000-000000000000'::uuid,
    1, id, '11111111-1111-4111-8111-111111111111'::uuid,
    'confirm', source_text, proposed_target, 1, 2
  from private.review_source_items where content_hash = 'test-source-only-guard'
$$, '22023', 'confirm_requires_suggestion',
  'source-only item cannot earn confirm credit, even through direct SQL');

select throws_ok($$
  insert into public.review_submissions (
    window_id, slot, source_item_id, user_id, action, corrected_text,
    original_source_snapshot, original_proposed_snapshot,
    length_tier_snapshot, scheduled_credits
  ) select
    '00000000-0000-4000-b000-000000000000'::uuid,
    1, id, '11111111-1111-4111-8111-111111111111'::uuid,
    'edit', '   ', source_text, proposed_target, 1, 2
  from private.review_source_items where content_hash = 'test-source-only-guard'
$$, '22023', 'edit_requires_text',
  'source-only item requires a written translation to earn edit credit');

select is(
  has_table_privilege('authenticated', 'public.review_submissions', 'INSERT'),
  false,
  'signed-in callers cannot forge a review row or credit snapshot via direct INSERT'
);

update public.app_config
set public_review_enabled = false, public_review_release_approved = false
where id = 1;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok($$
  select public.rpc_submit_review(
    '00000000-0000-4000-b000-000000000000'::uuid,
    '00000000-0000-4000-b000-000000000001'::uuid,
    'edit', 'A translation'
  )
$$, 'P0001', 'flag_disabled',
  'an old window cannot accept submissions after public review is disabled');
reset role;

select * from finish();
rollback;
