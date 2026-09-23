-- Lookahead appends private days and enables public review only at 14 days.

begin;
select no_plan();

delete from public.review_submissions;
delete from public.review_window_items;
delete from public.review_windows;
delete from private.review_source_items where origin = 'test:c3-look';

insert into private.review_source_items (
  content_hash, origin, direction, source_text, proposed_target,
  source_char_length, pii_flag, public_review_eligible,
  rights_status, origin_class, anonymization_status
)
select
  'c3-look-' || i::text,
  'test:c3-look',
  'en-ne',
  'planned sentence ' || i::text,
  'योजना ' || i::text,
  20,
  false,
  true,
  'cleared_public_display',
  'training_source',
  'not_required'
from generate_series(1, 140) as g(i);

update public.app_config set public_review_enabled = false where id = 1;

select is(
  (public.service_plan_review_lookahead(
    '2026-09-23 16:00:00+00'::timestamptz,
    28,
    14
  ) ->> 'public_review_enabled')::boolean,
  true,
  '14 planned days enable public review'
);

select is(
  (select count(*)::int from public.review_windows
    where state = 'planned'),
  14,
  'lookahead created 14 private days'
);

select is(
  (select count(*)::int from public.review_windows where state = 'open'),
  0,
  'lookahead does not open a public window'
);

insert into private.review_source_items (
  content_hash, origin, direction, source_text, proposed_target,
  source_char_length, pii_flag, public_review_eligible,
  rights_status, origin_class, anonymization_status
) values (
  'c3-look-new',
  'test:c3-look',
  'en-ne',
  'a newly imported sentence behind the cohort',
  'नयाँ',
  40,
  false,
  true,
  'cleared_public_display',
  'training_source',
  'not_required'
);

do $$
declare
  v_before uuid;
  v_after uuid;
begin
  select i.source_item_id into v_before
    from public.review_window_items i
    join public.review_windows w on w.id = i.window_id
   where w.state = 'planned'
   order by w.ny_close_at, i.slot
   limit 1;

  perform public.service_plan_review_lookahead(
    '2026-09-23 16:05:00+00'::timestamptz,
    28,
    14
  );

  select i.source_item_id into v_after
    from public.review_window_items i
    join public.review_windows w on w.id = i.window_id
   where w.state = 'planned'
   order by w.ny_close_at, i.slot
   limit 1;

  if v_before is distinct from v_after then
    raise exception 'lookahead reshuffled the first planned day';
  end if;
end $$;

select ok(true, 'a later import does not reshuffle planned days');

select * from finish();
rollback;
