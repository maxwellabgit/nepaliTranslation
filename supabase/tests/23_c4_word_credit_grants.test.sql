-- Assignment and close use 2 credits at 20 words and 4 credits at 21 words.

begin;
select no_plan();

delete from public.review_submissions;
delete from public.review_window_items;
delete from public.review_windows;
delete from private.review_source_items where origin = 'test:c4-words';

insert into private.review_source_items (
  content_hash, origin, direction, source_text, proposed_target,
  source_char_length, pii_flag, public_review_eligible,
  rights_status, origin_class, anonymization_status
) values
(
  'c4-words-20',
  'test:c4-words',
  'en-ne',
  'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty',
  'बीस',
  100,
  false,
  true,
  'cleared_public_display',
  'training_source',
  'not_required'
),
(
  'c4-words-21',
  'test:c4-words',
  'en-ne',
  'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty extra',
  'एक्काइस',
  110,
  false,
  true,
  'cleared_public_display',
  'training_source',
  'not_required'
),
(
  'c4-words-empty',
  'test:c4-words',
  'en-ne',
  '   ',
  'खाली',
  3,
  false,
  true,
  'cleared_public_display',
  'training_source',
  'not_required'
);

select is(private.count_source_words(
  (select source_text from private.review_source_items where content_hash = 'c4-words-20')
), 20, '20 source words');

select is(private.count_source_words(
  (select source_text from private.review_source_items where content_hash = 'c4-words-21')
), 21, '21 source words');

select is(private.count_source_words('   '), 0, 'blank source is empty');

update public.app_config
set public_review_enabled = true, public_review_release_approved = true
where id = 1;

select public.service_rotate_review_window(
  10::smallint,
  '2026-09-23 16:00:00+00'::timestamptz
);

select is(
  (select scheduled_credits from public.review_window_items i
    join private.review_source_items s on s.id = i.source_item_id
   where s.content_hash = 'c4-words-20'),
  2::smallint,
  '20 words snapshot 2 credits'
);

select is(
  (select original_source_word_count from public.review_window_items i
    join private.review_source_items s on s.id = i.source_item_id
   where s.content_hash = 'c4-words-20'),
  20,
  '20 words are snapshotted'
);

select is(
  (select scheduled_credits from public.review_window_items i
    join private.review_source_items s on s.id = i.source_item_id
   where s.content_hash = 'c4-words-21'),
  4::smallint,
  '21 words snapshot 4 credits'
);

select is(
  (select count(*)::int from public.review_window_items i
    join private.review_source_items s on s.id = i.source_item_id
   where s.content_hash = 'c4-words-empty'),
  0,
  'empty source is not planned'
);

insert into public.review_submissions (
  window_id, slot, source_item_id, user_id, action,
  original_source_snapshot, original_proposed_snapshot,
  length_tier_snapshot, scheduled_credits, original_source_word_count
)
select
  i.window_id, i.slot, i.source_item_id,
  '11111111-1111-4111-8111-111111111111',
  'confirm',
  s.source_text, s.proposed_target,
  i.length_tier_snapshot, i.scheduled_credits, i.original_source_word_count
from public.review_window_items i
join private.review_source_items s on s.id = i.source_item_id
where s.origin = 'test:c4-words';

select public.service_rotate_review_window(
  10::smallint,
  (select ny_close_at from public.review_windows where state = 'open' order by ny_close_at limit 1)
);

select is(
  (select minutes from public.reward_ledger
    where user_id = '11111111-1111-4111-8111-111111111111'
      and source_id like 'review_submission:%:window_close'
      and credits = 2
    order by created_at desc
    limit 1),
  30,
  'close grants 30 minutes for the 20-word item'
);

select is(
  (select minutes from public.reward_ledger
    where user_id = '11111111-1111-4111-8111-111111111111'
      and source_id like 'review_submission:%:window_close'
      and credits = 4
    order by created_at desc
    limit 1),
  60,
  'close grants 60 minutes for the 21-word item'
);

select * from finish();
rollback;
