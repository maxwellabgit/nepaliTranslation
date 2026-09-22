-- R2: corpus registry + reviewed-item retirement + training/eval exclusions.
--
-- Forward-only. Extends R1 in-place. Does not edit any earlier migration.
--
-- Deliverables from the runbook §R2:
--   * `public.review_exclusions` — canonical, forward-only list of content
--     hashes that must never re-enter public review, training, or private
--     evaluation. Reasons: 'public_reviewed', 'public_exposed_benchmark',
--     'reported_quarantine', 'consent_withdrawn', 'account_deleted'.
--   * `service_rotate_review_window` re-declared so that at close it also
--     inserts a reviewed source item's content_hash into review_exclusions
--     with reason 'public_reviewed' when any confirm/edit submission was
--     granted, and with 'reported_quarantine' for reports. Retired items
--     become `public_review_eligible = false`, so they cannot re-enter a
--     future window either.
--   * `review_import_runs` gains git_sha / registry_version / manifest_checksum
--     / status columns so every import run is auditable.
--   * `service_import_review_batch` — new transactional batch importer.
--   * `service_add_review_exclusion` — admin-visible RPC for consent
--     withdrawal / account deletion / manual quarantine (called from R4).

-- ---------------------------------------------------------------------------
-- 1. Canonical exclusion registry
-- ---------------------------------------------------------------------------

create table if not exists public.review_exclusions (
  content_hash text not null,
  reason text not null check (reason in (
    'public_reviewed',
    'public_exposed_benchmark',
    'reported_quarantine',
    'consent_withdrawn',
    'account_deleted',
    'admin_quarantine'
  )),
  source_lineage text,
  window_id uuid references public.review_windows (id) on delete set null,
  actor_user_id uuid references auth.users (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  primary key (content_hash, reason)
);

create index if not exists review_exclusions_reason_idx
  on public.review_exclusions (reason);

alter table public.review_exclusions enable row level security;

revoke all on table public.review_exclusions from public, anon;
-- authenticated users can see if a hash is excluded but cannot modify.
grant select on table public.review_exclusions to authenticated;
grant all on table public.review_exclusions to service_role;

drop policy if exists review_exclusions_read on public.review_exclusions;
create policy review_exclusions_read
  on public.review_exclusions
  for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- 2. Review import run auditing columns
-- ---------------------------------------------------------------------------

alter table private.review_import_runs
  add column if not exists git_sha text,
  add column if not exists registry_version text,
  add column if not exists manifest_checksum text,
  add column if not exists status text not null default 'in_progress'
    check (status in ('in_progress', 'ok', 'failed', 'dry_run')),
  add column if not exists corpus_id text,
  add column if not exists rejected integer not null default 0,
  add column if not exists error_message text;

-- ---------------------------------------------------------------------------
-- 3. Transactional batch importer
--
-- Callers assemble a jsonb array of import rows and this RPC upserts them
-- atomically. On any per-row failure the entire batch rolls back and the
-- RPC raises. This replaces the per-row loop with `__probe__` write in
-- supabase/scripts/import_review_pool.ts.
-- ---------------------------------------------------------------------------

create or replace function public.service_import_review_batch(
  p_run_id uuid,
  p_rows jsonb,
  p_corpus_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer := 0;
  v_updated integer := 0;
  v_skipped_excluded integer := 0;
  v_skipped_pii integer := 0;
  v_row jsonb;
  v_id uuid;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    if (v_row ->> 'content_hash') is null or (v_row ->> 'source_text') is null then
      raise exception 'invalid_row_shape' using errcode = '22023';
    end if;

    -- Excluded content is never reinserted (except re-tagged).
    if exists (
      select 1 from public.review_exclusions
       where content_hash = v_row ->> 'content_hash'
    ) then
      v_skipped_excluded := v_skipped_excluded + 1;
      continue;
    end if;

    if coalesce((v_row ->> 'pii_flag')::boolean, false) then
      v_skipped_pii := v_skipped_pii + 1;
    end if;

    insert into private.review_source_items (
      content_hash, origin, direction, register, script,
      source_text, proposed_target, license_note, metadata,
      source_char_length, pii_flag, public_review_eligible
    ) values (
      v_row ->> 'content_hash',
      v_row ->> 'origin',
      v_row ->> 'direction',
      coalesce(v_row ->> 'register', 'unspecified'),
      coalesce(v_row ->> 'script', 'unspecified'),
      v_row ->> 'source_text',
      v_row ->> 'proposed_target',
      v_row ->> 'license_note',
      coalesce(v_row -> 'metadata', '{}'::jsonb),
      length(coalesce(v_row ->> 'source_text', '')),
      coalesce((v_row ->> 'pii_flag')::boolean, false),
      not coalesce((v_row ->> 'pii_flag')::boolean, false)
    )
    on conflict (content_hash) do update
      set origin = excluded.origin,
          metadata = private.review_source_items.metadata || excluded.metadata,
          pii_flag = private.review_source_items.pii_flag or excluded.pii_flag,
          public_review_eligible = not (
            private.review_source_items.pii_flag or excluded.pii_flag
          )
    returning id into v_id;

    if v_id is not null then
      v_inserted := v_inserted + 1;
    else
      v_updated := v_updated + 1;
    end if;
  end loop;

  -- Refresh row counters on the run.
  update private.review_import_runs
     set imported = coalesce(imported, 0) + v_inserted,
         skipped_duplicate = coalesce(skipped_duplicate, 0) + v_updated,
         skipped_pii = coalesce(skipped_pii, 0) + v_skipped_pii,
         skipped_other = coalesce(skipped_other, 0) + v_skipped_excluded
   where id = p_run_id;

  return jsonb_build_object(
    'inserted', v_inserted,
    'updated', v_updated,
    'skipped_excluded', v_skipped_excluded,
    'skipped_pii', v_skipped_pii,
    'corpus_id', p_corpus_id
  );
end;
$$;

revoke all on function public.service_import_review_batch(uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.service_import_review_batch(uuid, jsonb, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 4. Start / finish an import run
-- ---------------------------------------------------------------------------

create or replace function public.service_start_review_import_run(
  p_origin text,
  p_git_sha text,
  p_registry_version text,
  p_manifest_checksum text,
  p_corpus_id text default null,
  p_dry_run boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into private.review_import_runs (
    origin, git_sha, registry_version, manifest_checksum,
    corpus_id, status
  ) values (
    p_origin, p_git_sha, p_registry_version, p_manifest_checksum,
    p_corpus_id, case when p_dry_run then 'dry_run' else 'in_progress' end
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.service_start_review_import_run(text, text, text, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.service_start_review_import_run(text, text, text, text, text, boolean)
  to service_role;

create or replace function public.service_finish_review_import_run(
  p_run_id uuid,
  p_status text,
  p_error_message text default null,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('ok', 'failed', 'dry_run') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  update private.review_import_runs
     set status = p_status,
         finished_at = now(),
         error_message = p_error_message,
         notes = coalesce(p_notes, notes)
   where id = p_run_id;
end;
$$;

revoke all on function public.service_finish_review_import_run(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.service_finish_review_import_run(uuid, text, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 5. Admin-facing exclusion insert
-- ---------------------------------------------------------------------------

create or replace function public.service_add_review_exclusion(
  p_content_hash text,
  p_reason text,
  p_source_lineage text default null,
  p_actor_user_id uuid default null,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_content_hash is null or btrim(p_content_hash) = '' then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  insert into public.review_exclusions (
    content_hash, reason, source_lineage, actor_user_id, notes
  ) values (p_content_hash, p_reason, p_source_lineage, p_actor_user_id, p_notes)
  on conflict (content_hash, reason) do update
    set source_lineage = coalesce(excluded.source_lineage, public.review_exclusions.source_lineage),
        notes = coalesce(excluded.notes, public.review_exclusions.notes);

  -- Flip the source item ineligible if it still exists in the local pool.
  update private.review_source_items
     set public_review_eligible = false,
         metadata = coalesce(metadata, '{}'::jsonb) ||
                    jsonb_build_object(
                      'excluded_reason', p_reason,
                      'excluded_at', now()
                    )
   where content_hash = p_content_hash;
end;
$$;

revoke all on function public.service_add_review_exclusion(text, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.service_add_review_exclusion(text, text, text, uuid, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 6. Rotation re-declared: retire confirm/edit'd sources at close.
--
-- Same signature and behavior as the R1 rotation, plus:
--   * every reviewed source item with at least one confirm/edit is written
--     into review_exclusions with reason 'public_reviewed' and its
--     content_hash flagged excluded_reason in the source-items metadata;
--   * every reported source item picks up reason 'reported_quarantine' in
--     addition to its previous R1 quarantine flip.
-- ---------------------------------------------------------------------------

create or replace function public.service_rotate_review_window(
  p_size smallint default 10,
  p_as_of timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prior public.review_windows;
  v_next_close timestamptz;
  v_new_id uuid;
  v_inserted integer := 0;
  v_short boolean := false;
  v_granted_applied integer := 0;
  v_granted_dup integer := 0;
  v_report_quarantined integer := 0;
  v_retired integer := 0;
  rec record;
  v_apply jsonb;
begin
  if p_size is null or p_size <= 0 then
    raise exception 'invalid_size' using errcode = '22023';
  end if;

  if not pg_try_advisory_xact_lock(hashtext('r1_review_rotation')) then
    return jsonb_build_object('status', 'busy');
  end if;

  select * into v_prior
    from public.review_windows
   where state = 'open'
   order by ny_close_at
   for update
   limit 1;

  if found and v_prior.ny_close_at > p_as_of then
    return jsonb_build_object(
      'status', 'not_due',
      'window_id', v_prior.id,
      'ny_close_at', v_prior.ny_close_at,
      'as_of', p_as_of
    );
  end if;

  if found then
    update public.review_windows
       set state = 'closed'
     where id = v_prior.id;

    -- Report actions quarantine + exclusion.
    with reported as (
      select distinct s.source_item_id, si.content_hash
        from public.review_submissions s
        join private.review_source_items si on si.id = s.source_item_id
       where s.window_id = v_prior.id
         and s.action = 'report'
         and s.admin_status <> 'unsatisfactory'
    ),
    quarantine_source as (
      update private.review_source_items s
         set public_review_eligible = false,
             metadata = coalesce(s.metadata, '{}'::jsonb)
                        || jsonb_build_object(
                             'quarantined_at', p_as_of,
                             'quarantined_from_window', v_prior.id,
                             'excluded_reason', 'reported_quarantine'
                           )
        from reported r
       where s.id = r.source_item_id
       returning s.id
    ),
    quarantine_excl as (
      insert into public.review_exclusions
        (content_hash, reason, source_lineage, window_id, notes)
      select r.content_hash,
             'reported_quarantine',
             'public_review:report',
             v_prior.id,
             'pending admin resolution'
        from reported r
      on conflict (content_hash, reason) do nothing
      returning 1
    )
    select count(*)::int
      into v_report_quarantined
      from quarantine_source;

    -- Grant credits for confirm/edit only, then retire the reviewed source.
    for rec in
      select s.id           as submission_id,
             s.user_id      as user_id,
             s.scheduled_credits as scheduled_credits,
             s.source_item_id    as source_item_id,
             si.content_hash     as content_hash
        from public.review_submissions s
        join private.review_source_items si on si.id = s.source_item_id
       where s.window_id = v_prior.id
         and s.reward_granted = false
         and s.admin_status <> 'unsatisfactory'
         and s.action in ('confirm', 'edit')
       order by s.submitted_at, s.id
    loop
      v_apply := private.apply_reward(
        rec.user_id,
        'public_review',
        rec.submission_id::text,
        rec.scheduled_credits,
        rec.scheduled_credits * 15
      );

      update public.review_submissions
         set reward_granted = true,
             reward_granted_at = p_as_of
       where id = rec.submission_id;

      if coalesce((v_apply ->> 'applied')::boolean, false) then
        v_granted_applied := v_granted_applied + 1;
      elsif (v_apply ->> 'reason') = 'duplicate' then
        v_granted_dup := v_granted_dup + 1;
      end if;

      -- R2 retire-on-close: reviewed sources are permanently ineligible.
      insert into public.review_exclusions
        (content_hash, reason, source_lineage, window_id, notes)
      values (
        rec.content_hash,
        'public_reviewed',
        'public_review:granted',
        v_prior.id,
        'retired after confirm/edit reward'
      )
      on conflict (content_hash, reason) do nothing;

      update private.review_source_items
         set public_review_eligible = false,
             metadata = coalesce(metadata, '{}'::jsonb) ||
                        jsonb_build_object(
                          'retired_at', p_as_of,
                          'retired_from_window', v_prior.id,
                          'excluded_reason', 'public_reviewed'
                        )
       where id = rec.source_item_id;

      v_retired := v_retired + 1;
    end loop;

    update public.review_windows
       set state = 'granted', granted_at = p_as_of
     where id = v_prior.id;
  end if;

  -- Open the next window against the (now-shrunk) eligible pool.
  v_next_close := private.next_review_close(p_as_of);
  insert into public.review_windows (ny_close_at, state, size, opened_at)
    values (v_next_close, 'open', p_size, p_as_of)
    returning id into v_new_id;

  insert into public.review_window_items (window_id, slot, source_item_id, length_tier_snapshot, scheduled_credits)
  select
    v_new_id,
    (row_number() over ())::smallint,
    sel.source_item_id,
    sel.length_tier_snapshot,
    case when sel.length_tier_snapshot = 2 then 2 else 1 end
  from private.select_review_window_items(p_size) sel;

  get diagnostics v_inserted = row_count;
  v_short := v_inserted < p_size;

  update private.review_source_items s
     set times_assigned = times_assigned + 1,
         last_assigned_at = p_as_of
    from public.review_window_items i
   where i.window_id = v_new_id
     and i.source_item_id = s.id;

  return jsonb_build_object(
    'status', case when v_short then 'ok_pool_short' else 'ok' end,
    'closed_window_id', v_prior.id,
    'granted_applied', v_granted_applied,
    'granted_duplicate', v_granted_dup,
    'granted_count', v_granted_applied + v_granted_dup,
    'reported_quarantined', v_report_quarantined,
    'retired_from_pool', v_retired,
    'new_window_id', v_new_id,
    'new_window_ny_close_at', v_next_close,
    'new_window_size', v_inserted,
    'requested_size', p_size,
    'warning', case when v_short then 'pool_short' else null end
  );
end;
$$;

revoke all on function public.service_rotate_review_window(smallint, timestamptz)
  from public, anon, authenticated;
grant execute on function public.service_rotate_review_window(smallint, timestamptz)
  to service_role;
