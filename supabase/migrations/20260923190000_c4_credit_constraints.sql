-- C4 follow-up: snapshot 2 or 4 credits from the original source word count.
-- Historical rows may still store 1. The check allows 1, 2, and 4.
-- Empty source text is rejected before planning. Forward-only.

create or replace function private.count_source_words(p_text text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_text is null or btrim(p_text) = '' then 0
    else cardinality(regexp_split_to_array(btrim(p_text), '[[:space:]]+'))
  end;
$$;

comment on function private.count_source_words(text) is
  'Unicode whitespace word count. Must match scripts/sourceWordCount.mjs. Empty text is 0 and is not planned.';

revoke all on function private.count_source_words(text) from public, anon, authenticated;
grant execute on function private.count_source_words(text) to service_role;

alter table public.review_window_items
  add column if not exists original_source_word_count integer;

alter table public.review_submissions
  add column if not exists original_source_word_count integer;

do $$
declare
  r record;
begin
  for r in
    select conrelid::regclass as rel, conname
      from pg_constraint
     where contype = 'c'
       and conrelid in (
         'public.review_window_items'::regclass,
         'public.review_submissions'::regclass
       )
       and pg_get_constraintdef(oid) ilike '%scheduled_credits%'
  loop
    execute format('alter table %s drop constraint %I', r.rel, r.conname);
  end loop;
end $$;

alter table public.review_window_items
  add constraint review_window_items_scheduled_credits_check
  check (scheduled_credits in (1, 2, 4));

alter table public.review_submissions
  add constraint review_submissions_scheduled_credits_check
  check (scheduled_credits in (1, 2, 4));

comment on column public.review_window_items.length_tier_snapshot is
  'Deprecated percentile rank. New assignments snapshot original_source_word_count and scheduled_credits (2 or 4).';

-- Drop empty sources before they can be planned. Eligibility still recomputed.
create or replace function private.select_review_window_items(p_size smallint)
returns table (source_item_id uuid, length_tier_snapshot smallint)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with picked as (
    select s.id, s.source_char_length
      from private.review_source_items s
     where private.count_source_words(s.source_text) > 0
       and private.review_public_eligible(
         s.public_review_eligible,
         s.rights_status,
         s.origin_class,
         s.anonymization_status,
         s.substantively_reviewed,
         s.quarantined,
         exists (
           select 1
             from public.review_window_items i
             join public.review_windows w on w.id = i.window_id
            where i.source_item_id = s.id
              and w.state in ('open', 'planned')
         ),
         exists (
           select 1 from public.review_exclusions e
            where e.content_hash = s.content_hash
         )
       )
     order by s.times_assigned asc, s.imported_at asc, s.id asc
     limit p_size
  ), ranked as (
    select
      id,
      row_number() over (order by source_char_length desc, id asc) as rnk,
      count(*) over () as total
    from picked
  )
  select
    id,
    case
      when rnk <= greatest(1, ceil(total::numeric / 2))::integer then 2::smallint
      else 1::smallint
    end
  from ranked;
end;
$$;
