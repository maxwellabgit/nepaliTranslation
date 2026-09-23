-- C2 deny-by-default eligibility. Requires the local Supabase stack.

begin;
select plan(4);

select is(
  private.review_public_eligible(true, 'unresolved', 'training_source', 'not_required', false, false, false, false),
  false,
  'unresolved rights are not publicly eligible'
);

select is(
  private.review_public_eligible(true, 'cleared_public_display', 'collected_user', 'pending', false, false, false, false),
  false,
  'collected text without certification cannot enter review'
);

select is(
  private.review_public_eligible(true, 'cleared_public_display', 'training_source', 'not_required', false, false, false, false),
  true,
  'cleared training row can enter'
);

select is(
  private.review_public_eligible(true, 'cleared_public_display', 'collected_user', 'certified', false, false, false, false),
  true,
  'certified collected row can enter'
);

select * from finish();
rollback;
