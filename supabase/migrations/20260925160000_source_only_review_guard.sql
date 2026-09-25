-- Source-only review items have no machine suggestion to confirm.
-- Enforce this on the table so a client cannot bypass the app's disabled button.
create or replace function private.guard_review_submission_text()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if NEW.action = 'edit' and nullif(btrim(NEW.corrected_text), '') is null then
    raise exception 'edit_requires_text' using errcode = '22023';
  end if;

  if NEW.action = 'confirm' and not exists (
    select 1
      from private.review_source_items s
     where s.id = NEW.source_item_id
       and nullif(btrim(s.proposed_target), '') is not null
  ) then
    raise exception 'confirm_requires_suggestion' using errcode = '22023';
  end if;
  return NEW;
end;
$$;

drop trigger if exists review_submission_text_guard on public.review_submissions;
create trigger review_submission_text_guard
  before insert or update of action, corrected_text, source_item_id
  on public.review_submissions
  for each row
  execute function private.guard_review_submission_text();

-- Only the owner-authenticated RPC may create review submissions. The old
-- owner INSERT policy allowed an arbitrary source, slot, and credit snapshot.
drop policy if exists review_submissions_owner_insert on public.review_submissions;
revoke insert on public.review_submissions from authenticated;

-- The read gate checks the public-release flag and contributor eligibility.
-- Repeat it on submit so an old open window cannot be used after withdrawal.
create or replace function public.rpc_submit_review(
  p_window_id uuid,
  p_source_item_id uuid,
  p_action text,
  p_corrected_text text default null
)
returns public.review_submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_window public.review_windows;
  v_item public.review_window_items;
  v_source private.review_source_items;
  v_row public.review_submissions;
begin
  if v_uid is null then
    raise exception 'sign_in_required' using errcode = '42501';
  end if;
  perform public.service_assert_public_review_read(v_uid);

  select * into v_window from public.review_windows where id = p_window_id for share;
  if not found then
    raise exception 'window_not_found' using errcode = 'P0002';
  end if;
  if v_window.state <> 'open' or v_window.ny_close_at <= now() then
    raise exception 'window_closed' using errcode = 'P0001';
  end if;

  select * into v_item from public.review_window_items
   where window_id = p_window_id and source_item_id = p_source_item_id for share;
  if not found then
    raise exception 'item_not_in_window' using errcode = 'P0002';
  end if;
  select * into v_source from private.review_source_items where id = p_source_item_id;

  if p_action not in ('confirm', 'edit', 'skip', 'report') then
    raise exception 'invalid_action' using errcode = '22023';
  end if;
  if p_action = 'edit' and coalesce(btrim(p_corrected_text), '') = '' then
    raise exception 'edit_requires_text' using errcode = '22023';
  end if;

  insert into public.review_submissions (
    window_id, slot, source_item_id, user_id, action, corrected_text,
    original_source_snapshot, original_proposed_snapshot,
    length_tier_snapshot, scheduled_credits
  ) values (
    p_window_id, v_item.slot, p_source_item_id, v_uid, p_action,
    case when p_action = 'edit' then btrim(p_corrected_text) else null end,
    v_source.source_text, v_source.proposed_target,
    v_item.length_tier_snapshot, v_item.scheduled_credits
  ) returning * into v_row;
  return v_row;
exception
  when unique_violation then
    raise exception 'already_submitted' using errcode = '23505';
end;
$$;
