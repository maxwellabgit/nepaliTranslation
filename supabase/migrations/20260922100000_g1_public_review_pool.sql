-- G1: global daily public-review pool.
--
-- Boundary (see .governance/V1_G0_DECISIONS.md D1/D2/D6):
--   * One global window per America/New_York review day.
--   * Rotation at 5:00 PM America/New_York closes the window, grants credits,
--     and pre-selects the next window's 10 random items from
--     review_source_items where public_review_eligible = true.
--   * 1 credit = 15 minutes ad-free. Top-50%-longest at assignment = 2 credits.
--   * All training + benchmark rows are eligible after PII/dedup.
--   * Submissions must not be promoted into training/benchmarks automatically.
--   * Admin marking submission unsatisfactory before close prevents its reward.
--   * No credit clawback. Post-close rejection creates an alert only.
--
-- Runs alongside the existing consensus contribution_tasks (F3/F4). The
-- Review surface in mobile uses these tables; the older per-user consensus
-- lease path is not removed by this gate.

-- ---------------------------------------------------------------------------
-- Source items imported from datasets/, training/, and benchmarks/.
-- ---------------------------------------------------------------------------

create table if not exists private.review_source_items (
  id uuid primary key default gen_random_uuid(),
  content_hash text not null,
  origin text not null,                        -- e.g. 'training:train_clean_en-ne.jsonl', 'benchmarks:gold/formal_en_ne'
  direction text not null check (direction in ('en-ne', 'ne-en')),
  register text not null default 'unspecified',
  script text not null default 'unspecified',
  source_text text not null,
  proposed_target text,
  license_note text,
  metadata jsonb not null default '{}'::jsonb,
  source_char_length integer not null,
  source_char_length_rank_pct numeric,         -- 0.0 to 1.0 (1.0 = longest)
  length_tier smallint not null default 1 check (length_tier in (1, 2)),
  pii_flag boolean not null default false,
  public_review_eligible boolean not null default false,
  imported_at timestamptz not null default now(),
  last_assigned_at timestamptz,
  times_assigned integer not null default 0,
  constraint review_source_items_hash_unique unique (content_hash)
);

create index if not exists review_source_items_eligible_idx
  on private.review_source_items (public_review_eligible)
  where public_review_eligible = true;

create index if not exists review_source_items_direction_idx
  on private.review_source_items (direction, public_review_eligible);

revoke all on table private.review_source_items from public, anon, authenticated;
grant all on table private.review_source_items to service_role;

-- Import manifest reconciling every source row to included or excluded.
create table if not exists private.review_import_runs (
  id uuid primary key default gen_random_uuid(),
  origin text not null,
  imported integer not null default 0,
  skipped_duplicate integer not null default 0,
  skipped_pii integer not null default 0,
  skipped_other integer not null default 0,
  skip_reasons jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  notes text
);

revoke all on table private.review_import_runs from public, anon, authenticated;
grant all on table private.review_import_runs to service_role;

-- ---------------------------------------------------------------------------
-- Review windows (one per NY review day) + the 10 selected items.
-- ---------------------------------------------------------------------------

create table if not exists public.review_windows (
  id uuid primary key default gen_random_uuid(),
  ny_close_at timestamptz not null unique,     -- exact 5:00 PM NY instant when this window closes
  opened_at timestamptz not null default now(),
  state text not null default 'open' check (state in ('open', 'closed', 'granted')),
  granted_at timestamptz,
  size smallint not null default 10 check (size > 0),
  created_by uuid references auth.users (id)
);

revoke all on table public.review_windows from public, anon;
grant select on table public.review_windows to authenticated;
grant all on table public.review_windows to service_role;

alter table public.review_windows enable row level security;

drop policy if exists review_windows_read on public.review_windows;
create policy review_windows_read
  on public.review_windows
  for select
  to authenticated
  using (state in ('open', 'closed', 'granted'));

create table if not exists public.review_window_items (
  window_id uuid not null references public.review_windows (id) on delete cascade,
  slot smallint not null check (slot between 1 and 100),
  source_item_id uuid not null references private.review_source_items (id) on delete restrict,
  length_tier_snapshot smallint not null check (length_tier_snapshot in (1, 2)),
  scheduled_credits smallint not null check (scheduled_credits in (1, 2)),
  primary key (window_id, slot),
  constraint review_window_items_source_unique unique (window_id, source_item_id)
);

revoke all on table public.review_window_items from public, anon;
grant select on table public.review_window_items to authenticated;
grant all on table public.review_window_items to service_role;

alter table public.review_window_items enable row level security;

drop policy if exists review_window_items_read on public.review_window_items;
create policy review_window_items_read
  on public.review_window_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.review_windows w
      where w.id = window_id
        and w.state in ('open', 'closed', 'granted')
    )
  );

-- ---------------------------------------------------------------------------
-- Submissions (one per user per item per window).
-- ---------------------------------------------------------------------------

create table if not exists public.review_submissions (
  id uuid primary key default gen_random_uuid(),
  window_id uuid not null references public.review_windows (id) on delete cascade,
  slot smallint not null,
  source_item_id uuid not null references private.review_source_items (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null check (action in ('confirm', 'edit', 'skip', 'report')),
  corrected_text text,
  original_source_snapshot text not null,
  original_proposed_snapshot text,
  length_tier_snapshot smallint not null check (length_tier_snapshot in (1, 2)),
  scheduled_credits smallint not null check (scheduled_credits in (1, 2)),
  admin_status text not null default 'pending' check (admin_status in ('pending', 'unsatisfactory', 'accepted')),
  admin_reviewer uuid references auth.users (id),
  admin_reviewed_at timestamptz,
  admin_reason text,
  reward_granted boolean not null default false,
  reward_granted_at timestamptz,
  submitted_at timestamptz not null default now(),
  constraint review_submissions_unique_per_window unique (window_id, source_item_id, user_id)
);

create index if not exists review_submissions_user_idx on public.review_submissions (user_id, submitted_at desc);
create index if not exists review_submissions_admin_idx on public.review_submissions (window_id, admin_status);

alter table public.review_submissions enable row level security;

revoke all on table public.review_submissions from public, anon;
grant select, insert on table public.review_submissions to authenticated;
grant all on table public.review_submissions to service_role;

drop policy if exists review_submissions_owner_read on public.review_submissions;
create policy review_submissions_owner_read
  on public.review_submissions
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists review_submissions_owner_insert on public.review_submissions;
create policy review_submissions_owner_insert
  on public.review_submissions
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Admin adjudication log.
-- ---------------------------------------------------------------------------

create table if not exists private.review_admin_actions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.review_submissions (id) on delete cascade,
  admin_user_id uuid not null,
  action text not null check (action in ('unsatisfactory', 'clear', 'late_reject')),
  reason text,
  created_at timestamptz not null default now()
);

revoke all on table private.review_admin_actions from public, anon, authenticated;
grant all on table private.review_admin_actions to service_role;

-- ---------------------------------------------------------------------------
-- Contract functions.
-- ---------------------------------------------------------------------------

-- Compute the next 5:00 PM America/New_York close instant strictly after p_now.
create or replace function private.next_review_close(p_now timestamptz)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  v_local timestamp;
  v_close_date date;
  v_close timestamptz;
begin
  v_local := (p_now at time zone 'America/New_York');
  v_close_date := v_local::date;
  v_close := ((v_close_date + time '17:00') at time zone 'America/New_York');
  if v_close <= p_now then
    v_close := (((v_close_date + interval '1 day')::date + time '17:00') at time zone 'America/New_York');
  end if;
  return v_close;
end;
$$;

revoke all on function private.next_review_close(timestamptz) from public, anon, authenticated;
grant execute on function private.next_review_close(timestamptz) to service_role;

-- Refresh length-tier snapshots on the eligible pool.
-- Top 50% of source_char_length -> tier 2, else tier 1.
create or replace function private.refresh_review_length_tiers()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer := 0;
begin
  with ranked as (
    select
      id,
      percent_rank() over (order by source_char_length) as pct
    from private.review_source_items
    where public_review_eligible = true
  )
  update private.review_source_items s
     set source_char_length_rank_pct = r.pct,
         length_tier = case when r.pct >= 0.5 then 2 else 1 end
    from ranked r
   where s.id = r.id;
  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function private.refresh_review_length_tiers() from public, anon, authenticated;
grant execute on function private.refresh_review_length_tiers() to service_role;

create or replace function public.service_refresh_review_length_tiers()
returns integer
language sql
security definer
set search_path = ''
as $$
  select private.refresh_review_length_tiers();
$$;

revoke all on function public.service_refresh_review_length_tiers() from public, anon, authenticated;
grant execute on function public.service_refresh_review_length_tiers() to service_role;

-- Pick p_size random items from the eligible pool that were not already used
-- in the currently open window and prefer items with the fewest prior
-- assignments (so the whole corpus rotates over time).
create or replace function private.select_review_window_items(p_size smallint)
returns table (source_item_id uuid, length_tier_snapshot smallint) 
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select id,
         length_tier
    from private.review_source_items
   where public_review_eligible = true
   order by times_assigned asc, random()
   limit p_size;
end;
$$;

revoke all on function private.select_review_window_items(smallint) from public, anon, authenticated;
grant execute on function private.select_review_window_items(smallint) to service_role;

-- Full rotation: close prior window, grant credits, open next with 10 random items.
create or replace function public.service_rotate_review_window(p_size smallint default 10)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_prior public.review_windows;
  v_granted integer := 0;
  v_next_close timestamptz;
  v_new_id uuid;
  v_inserted integer := 0;
begin
  -- Close the currently-open window (there should be at most one).
  select * into v_prior
    from public.review_windows
   where state = 'open'
   order by ny_close_at
   for update skip locked
   limit 1;

  if found then
    update public.review_windows
       set state = 'closed'
     where id = v_prior.id;

    -- Grant credits for pending / accepted submissions (not marked unsatisfactory).
    with grantable as (
      update public.review_submissions
         set reward_granted = true,
             reward_granted_at = v_now
       where window_id = v_prior.id
         and admin_status <> 'unsatisfactory'
         and reward_granted = false
      returning id, user_id, source_item_id, scheduled_credits
    ),
    ledger_ins as (
      insert into public.reward_ledger (user_id, source_type, source_id, credits, minutes)
      select
        g.user_id,
        'public_review',
        g.id::text,
        g.scheduled_credits,
        g.scheduled_credits * 15
      from grantable g
      on conflict (source_type, source_id) do nothing
      returning 1
    )
    select count(*) into v_granted from ledger_ins;

    update public.review_windows
       set state = 'granted', granted_at = v_now
     where id = v_prior.id;
  end if;

  -- Open the next window.
  v_next_close := private.next_review_close(v_now);
  insert into public.review_windows (ny_close_at, state, size, opened_at)
    values (v_next_close, 'open', p_size, v_now)
    returning id into v_new_id;

  insert into public.review_window_items (window_id, slot, source_item_id, length_tier_snapshot, scheduled_credits)
  select v_new_id,
         (row_number() over ())::smallint,
         s.source_item_id,
         s.length_tier_snapshot,
         case when s.length_tier_snapshot = 2 then 2 else 1 end
    from private.select_review_window_items(p_size) s;

  get diagnostics v_inserted = row_count;

  update private.review_source_items s
     set times_assigned = times_assigned + 1,
         last_assigned_at = v_now
    from public.review_window_items i
   where i.window_id = v_new_id
     and i.source_item_id = s.id;

  return jsonb_build_object(
    'closed_window_id', v_prior.id,
    'granted_count', v_granted,
    'new_window_id', v_new_id,
    'new_window_ny_close_at', v_next_close,
    'new_window_size', v_inserted
  );
end;
$$;

revoke all on function public.service_rotate_review_window(smallint) from public, anon, authenticated;
grant execute on function public.service_rotate_review_window(smallint) to service_role;

-- Submit a review for the current open window.
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

  select * into v_window
    from public.review_windows
   where id = p_window_id
   for share;

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

-- Admin adjudication: mark a submission unsatisfactory (before close).
create or replace function public.service_mark_review_unsatisfactory(
  p_submission_id uuid,
  p_admin uuid,
  p_reason text default null
)
returns public.review_submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.review_submissions;
  v_window public.review_windows;
begin
  select * into v_row
    from public.review_submissions
   where id = p_submission_id
   for update;
  if not found then
    raise exception 'submission_not_found' using errcode = 'P0002';
  end if;

  select * into v_window
    from public.review_windows
   where id = v_row.window_id;

  if v_window.state <> 'open' then
    raise exception 'window_not_open' using errcode = 'P0001';
  end if;
  if v_row.reward_granted then
    raise exception 'reward_already_granted' using errcode = 'P0001';
  end if;

  update public.review_submissions
     set admin_status = 'unsatisfactory',
         admin_reviewer = p_admin,
         admin_reviewed_at = now(),
         admin_reason = p_reason
   where id = p_submission_id
   returning * into v_row;

  insert into private.review_admin_actions (submission_id, admin_user_id, action, reason)
    values (p_submission_id, p_admin, 'unsatisfactory', p_reason);

  return v_row;
end;
$$;

revoke all on function public.service_mark_review_unsatisfactory(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.service_mark_review_unsatisfactory(uuid, uuid, text) to service_role;

-- Late rejection (post-close): alert only, no clawback.
create or replace function public.service_late_reject_review(
  p_submission_id uuid,
  p_admin uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.review_submissions;
  v_window public.review_windows;
begin
  select * into v_row from public.review_submissions where id = p_submission_id for update;
  if not found then
    raise exception 'submission_not_found' using errcode = 'P0002';
  end if;
  select * into v_window from public.review_windows where id = v_row.window_id;
  if v_window.state = 'open' then
    raise exception 'window_still_open' using errcode = 'P0001';
  end if;

  insert into private.review_admin_actions (submission_id, admin_user_id, action, reason)
    values (p_submission_id, p_admin, 'late_reject', p_reason);

  insert into private.contributor_alerts (user_id, receipt_id, alert_type, message)
    values (v_row.user_id, null, 'review_late_reject', coalesce(p_reason, 'late reject'));
end;
$$;

revoke all on function public.service_late_reject_review(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.service_late_reject_review(uuid, uuid, text) to service_role;

-- Idempotent importer helper. Callers redact PII and dedupe by content hash
-- above this line; this function stores each row once.
create or replace function public.service_import_review_item(
  p_content_hash text,
  p_origin text,
  p_direction text,
  p_register text,
  p_script text,
  p_source_text text,
  p_proposed_target text,
  p_license_note text,
  p_metadata jsonb,
  p_pii_flag boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into private.review_source_items (
    content_hash, origin, direction, register, script,
    source_text, proposed_target, license_note, metadata,
    source_char_length, pii_flag,
    public_review_eligible
  ) values (
    p_content_hash, p_origin, p_direction, p_register, p_script,
    p_source_text, p_proposed_target, p_license_note, coalesce(p_metadata, '{}'::jsonb),
    length(coalesce(p_source_text, '')), coalesce(p_pii_flag, false),
    not coalesce(p_pii_flag, false)
  )
  on conflict (content_hash) do update
    set origin = excluded.origin,
        metadata = private.review_source_items.metadata || excluded.metadata,
        pii_flag = private.review_source_items.pii_flag or excluded.pii_flag,
        public_review_eligible = not (private.review_source_items.pii_flag or excluded.pii_flag)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.service_import_review_item(
  text, text, text, text, text, text, text, text, jsonb, boolean
) from public, anon, authenticated;
grant execute on function public.service_import_review_item(
  text, text, text, text, text, text, text, text, jsonb, boolean
) to service_role;

-- View used by mobile Review: the currently open window and its items.
create or replace view public.review_current_window as
  select
    w.id as window_id,
    w.ny_close_at,
    w.state,
    i.slot,
    i.length_tier_snapshot,
    i.scheduled_credits,
    s.id as source_item_id,
    s.direction,
    s.register,
    s.script,
    s.source_text,
    s.proposed_target
  from public.review_windows w
  join public.review_window_items i on i.window_id = w.id
  join private.review_source_items s on s.id = i.source_item_id
  where w.state = 'open'
    and w.ny_close_at > now()
  order by i.slot;

grant select on public.review_current_window to authenticated;
