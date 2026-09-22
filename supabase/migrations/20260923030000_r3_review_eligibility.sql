-- R3: server-side review eligibility guard + admin adjudication scaffolding.
--
-- Audit R3 rule 7:
--   "Enforce eligibility on the server, not only the client. Add
--    private.assert_review_eligibility(auth.uid()) and require current
--    startup consent version, T&C, privacy, 18+ stamp, contribution
--    consent, no pending deletion/withdrawal, and enabled text-contribution
--    flag."
--
-- Rule 10:
--   "Admin mutations require server-side role checks, a reason, actor,
--    timestamp, before/after state, and an append-only audit entry."

-- ---------------------------------------------------------------------------
-- 1. Server-side eligibility assertion
-- ---------------------------------------------------------------------------

create or replace function private.assert_review_eligibility(p_user_id uuid)
returns void
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_config public.app_config;
begin
  if p_user_id is null then
    raise exception 'sign_in_required' using errcode = '42501';
  end if;

  select * into v_profile from public.profiles where user_id = p_user_id;
  if not found then
    raise exception 'consent_required' using errcode = '42501';
  end if;

  select * into v_config from public.app_config where id = 1;

  -- Startup consent (T&C + Privacy + 18+) must be current.
  if v_profile.startup_consent_version is distinct from v_config.startup_consent_version
     or v_profile.startup_terms_accepted_at is null
     or v_profile.startup_privacy_accepted_at is null
     or v_profile.startup_age_confirmed_at is null then
    raise exception 'startup_consent_required' using errcode = '42501';
  end if;

  -- Contribution consent must be current + age confirmed.
  if v_profile.consent_version is distinct from v_config.contribution_consent_version
     or v_profile.consented_at is null
     or v_profile.age_confirmed_at is null then
    raise exception 'consent_outdated' using errcode = '42501';
  end if;

  -- No pending withdrawal or deletion.
  if v_profile.consent_withdrawn_at is not null
     or v_profile.deletion_requested_at is not null
     or v_profile.deletion_due_at is not null then
    raise exception 'deletion_pending' using errcode = '42501';
  end if;

  -- Text-contribution flag must be enabled (the review workflow lives
  -- under text contribution — speech/photo have their own flags).
  if not v_config.contribution_text_enabled then
    raise exception 'flag_disabled' using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.assert_review_eligibility(uuid) from public, anon, authenticated;
grant execute on function private.assert_review_eligibility(uuid) to service_role;

-- Public helper mirrors the assertion for anonymous / signed-in checks.
create or replace function public.service_check_review_eligibility()
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'sign_in_required');
  end if;
  begin
    perform private.assert_review_eligibility(v_uid);
    return jsonb_build_object('ok', true);
  exception when others then
    return jsonb_build_object('ok', false, 'code', SQLERRM);
  end;
end;
$$;

revoke all on function public.service_check_review_eligibility() from public, anon;
grant execute on function public.service_check_review_eligibility()
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. rpc_submit_review now calls the eligibility guard
-- ---------------------------------------------------------------------------

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
  perform private.assert_review_eligibility(v_uid);

  select * into v_window from public.review_windows where id = p_window_id for share;
  if not found then
    raise exception 'window_not_found' using errcode = 'P0002';
  end if;

  if v_window.state <> 'open' or v_window.ny_close_at <= now() then
    raise exception 'window_closed' using errcode = 'P0001';
  end if;

  select * into v_item
    from public.review_window_items
   where window_id = p_window_id
     and source_item_id = p_source_item_id
   for share;

  if not found then
    raise exception 'item_not_in_window' using errcode = 'P0002';
  end if;

  select * into v_source
    from private.review_source_items
   where id = p_source_item_id;

  if p_action not in ('confirm', 'edit', 'skip', 'report') then
    raise exception 'invalid_action' using errcode = '22023';
  end if;

  if p_action = 'edit' and coalesce(btrim(p_corrected_text), '') = '' then
    raise exception 'edit_requires_text' using errcode = '22023';
  end if;

  insert into public.review_submissions (
    window_id, slot, source_item_id, user_id,
    action, corrected_text,
    original_source_snapshot, original_proposed_snapshot,
    length_tier_snapshot, scheduled_credits
  ) values (
    p_window_id,
    v_item.slot,
    p_source_item_id,
    v_uid,
    p_action,
    case when p_action = 'edit' then btrim(p_corrected_text) else null end,
    v_source.source_text,
    v_source.proposed_target,
    v_item.length_tier_snapshot,
    v_item.scheduled_credits
  )
  returning * into v_row;

  return v_row;
exception
  when unique_violation then
    raise exception 'already_submitted' using errcode = '23505';
end;
$$;

revoke all on function public.rpc_submit_review(uuid, uuid, text, text) from public, anon;
grant execute on function public.rpc_submit_review(uuid, uuid, text, text) to authenticated, service_role;
