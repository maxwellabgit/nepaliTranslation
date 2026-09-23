-- A new import after the C2 rights migration must not enter the pool
-- on the PII flag alone.

begin;
select no_plan();

do $$
declare
  v_run uuid;
begin
  v_run := public.service_start_review_import_run(
    'test:c2-after', 'c2-sha', 'c2-registry', 'c2-checksum', 'gold-en-ne-formal', false
  );
  perform public.service_import_review_batch(
    v_run,
    jsonb_build_array(
      jsonb_build_object(
        'content_hash', 'c2-unresolved-hash',
        'origin', 'test:c2-after',
        'direction', 'en-ne',
        'source_text', 'unresolved rights must stay private',
        'proposed_target', 'अनिर्णित',
        'pii_flag', false
      ),
      jsonb_build_object(
        'content_hash', 'c2-cleared-hash',
        'origin', 'test:c2-after',
        'direction', 'en-ne',
        'source_text', 'cleared rights may enter',
        'proposed_target', 'खुला',
        'pii_flag', false,
        'rights_status', 'cleared_public_display'
      )
    ),
    'gold-en-ne-formal'
  );
end $$;

select is(
  (select public_review_eligible from private.review_source_items
    where content_hash = 'c2-unresolved-hash'),
  false,
  'new import with unresolved rights is not eligible'
);

select is(
  (select public_review_eligible from private.review_source_items
    where content_hash = 'c2-cleared-hash'),
  true,
  'new import with cleared rights is eligible'
);

select is(
  (select count(*)::int from private.select_review_window_items(10)
    where source_item_id = (
      select id from private.review_source_items
       where content_hash = 'c2-unresolved-hash'
    )),
  0,
  'selector does not return an unresolved import'
);

select ok(
  (select count(*)::int from private.select_review_window_items(10)
    where source_item_id = (
      select id from private.review_source_items
       where content_hash = 'c2-cleared-hash'
    )) >= 1,
  'selector can return a cleared import'
);

select * from finish();
rollback;
