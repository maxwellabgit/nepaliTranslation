-- C4: review rewards are 2 credits for 0-20 original source words and 4
-- credits for 21 or more. Rewarded video is 2 credits / 30 minutes.
-- One credit remains 15 minutes. Forward-only replacement of the functions
-- created in earlier migrations. Historical ledger rows are not rewritten.

create or replace function private.scheduled_credits_for_words(p_word_count integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_word_count is null or p_word_count < 0 then 0
    when p_word_count <= 20 then 2
    else 4
  end;
$$;

comment on function private.scheduled_credits_for_words(integer) is
  'C4 rule v1: <=20 words -> 2 credits; >=21 -> 4 credits. Empty text must be rejected before planning.';

create or replace function private.reward_schedule(p_kind text)
returns table (credits integer, minutes integer)
language sql
immutable
set search_path = ''
as $$
  select s.credits, s.minutes
  from (
    values
      ('known_check'::text, 1::integer, 15::integer),
      ('unknown_confirm'::text, 1::integer, 15::integer),
      ('unknown_correction'::text, 1::integer, 15::integer),
      ('admin_difficult'::text, 2::integer, 30::integer),
      ('rewarded_video'::text, 2::integer, 30::integer),
      ('public_review'::text, 2::integer, 30::integer),
      ('public_review_long'::text, 4::integer, 60::integer)
  ) as s(kind, credits, minutes)
  where s.kind = p_kind;
$$;

comment on function private.reward_schedule(text) is
  'C4: rewarded video and a short public review are 2 credits; a long public review is 4. 1 credit = 15 minutes.';
