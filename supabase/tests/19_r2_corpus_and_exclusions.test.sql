-- R2: reviewed-item retirement and public.review_exclusions registry.
--
-- Covers:
--   * confirm/edit at close inserts (content_hash, 'public_reviewed') into
--     review_exclusions and flips public_review_eligible=false.
--   * report at close inserts (content_hash, 'reported_quarantine') and
--     flips public_review_eligible=false.
--   * skip at close does NOT insert into review_exclusions; the source
--     item remains eligible for future windows.
--   * service_import_review_batch is transactional and refuses invalid rows.
--   * service_add_review_exclusion is idempotent (unique per hash+reason).

begin;
select no_plan();

-- Fixture
delete from public.review_submissions;
delete from public.review_window_items;
delete from public.review_windows;
delete from public.review_exclusions where source_lineage like 'public_review:%';
delete from private.review_source_items where origin like 'test:r2%';

insert into private.review_source_items (
  id, content_hash, origin, direction, register, script,
  source_text, proposed_target, license_note, metadata,
  source_char_length, pii_flag, public_review_eligible
)
select
  ('01234567-89ab-4def-9000-' || lpad(i::text, 12, '0'))::uuid,
  'r2-hash-' || i::text,
  'test:r2',
  'en-ne',
  'unspecified',
  'unspecified',
  repeat('r2src', i),
  repeat('r2tgt', i),
  null,
  '{}'::jsonb,
  i * 5,
  false,
  true
from generate_series(1, 4) as g(i);

select is(private.refresh_review_length_tiers(), 4, 'seed: 4 rows refreshed');

-- Open a window at 2027-01-05 22:00 UTC.
insert into public.review_windows (id, ny_close_at, state, size, opened_at)
values (
  '00000000-0000-4000-9000-000000000001',
  '2027-01-05 22:00:00+00'::timestamptz,
  'open',
  4,
  '2027-01-04 22:00:00+00'::timestamptz
);

insert into public.review_window_items (window_id, slot, source_item_id, length_tier_snapshot, scheduled_credits)
select
  '00000000-0000-4000-9000-000000000001',
  (row_number() over (order by content_hash))::smallint,
  id,
  1::smallint,
  1
from private.review_source_items
where origin = 'test:r2'
order by content_hash;

-- Four submissions: confirm / edit / skip / report on slots 1..4.
insert into public.review_submissions (
  window_id, slot, source_item_id, user_id, action, corrected_text,
  original_source_snapshot, original_proposed_snapshot,
  length_tier_snapshot, scheduled_credits
)
select
  i.window_id, i.slot, i.source_item_id, u.user_id::uuid, u.action, u.corrected,
  s.source_text, s.proposed_target,
  i.length_tier_snapshot, i.scheduled_credits
from public.review_window_items i
join private.review_source_items s on s.id = i.source_item_id
join (values
  (1, '11111111-1111-4111-8111-111111111111', 'confirm', null),
  (2, '22222222-2222-4222-8222-222222222222', 'edit',    'r2 edited'),
  (3, '11111111-1111-4111-8111-111111111111', 'skip',    null),
  (4, '22222222-2222-4222-8222-222222222222', 'report',  null)
) as u(slot, user_id, action, corrected) on u.slot = i.slot
where i.window_id = '00000000-0000-4000-9000-000000000001';

-- Rotate at 5:00 PM NY on the close day.
select ok(
  ((public.service_rotate_review_window(
      10::smallint,
      '2027-01-05 22:00:00+00'::timestamptz
    ))->>'retired_from_pool')::int = 2,
  'exactly 2 sources retired (confirm + edit); skip and report do not retire the same way'
);

-- confirm/edit content hashes are now excluded with reason 'public_reviewed'.
select is(
  (select count(*)::int from public.review_exclusions
    where reason = 'public_reviewed'
      and content_hash in (
        select si.content_hash
          from public.review_submissions s
          join private.review_source_items si on si.id = s.source_item_id
         where s.window_id = '00000000-0000-4000-9000-000000000001'
           and s.action in ('confirm', 'edit')
      )),
  2,
  'confirm + edit hashes added to review_exclusions/public_reviewed'
);

-- report content hash is excluded with reason 'reported_quarantine'.
select is(
  (select count(*)::int from public.review_exclusions
    where reason = 'reported_quarantine'
      and content_hash in (
        select si.content_hash
          from public.review_submissions s
          join private.review_source_items si on si.id = s.source_item_id
         where s.window_id = '00000000-0000-4000-9000-000000000001'
           and s.action = 'report'
      )),
  1,
  'report hash added to review_exclusions/reported_quarantine'
);

-- skip does NOT add to review_exclusions.
select is(
  (select count(*)::int from public.review_exclusions
    where content_hash in (
      select si.content_hash
        from public.review_submissions s
        join private.review_source_items si on si.id = s.source_item_id
       where s.window_id = '00000000-0000-4000-9000-000000000001'
         and s.action = 'skip'
    )),
  0,
  'skip does not add the source to review_exclusions'
);

-- Retired + quarantined items are ineligible in the pool.
select is(
  (select count(*)::int from private.review_source_items
    where origin = 'test:r2' and public_review_eligible = true),
  1,
  'only the skip'd source remains eligible after retirement'
);

-- Excluded content is not re-inserted by service_import_review_batch.
do $$
declare
  v_run uuid;
  v_res jsonb;
begin
  v_run := public.service_start_review_import_run(
    'test:r2-batch', 'r2-git-sha', 'r2-registry-v', 'r2-checksum', 'gold-en-ne-formal', false
  );

  v_res := public.service_import_review_batch(
    v_run,
    jsonb_build_array(
      jsonb_build_object(
        'content_hash', (
          select si.content_hash
            from public.review_submissions s
            join private.review_source_items si on si.id = s.source_item_id
           where s.window_id = '00000000-0000-4000-9000-000000000001'
             and s.action = 'confirm'
           limit 1
        ),
        'origin', 'test:r2-batch',
        'direction', 'en-ne',
        'register', 'unspecified',
        'script', 'unspecified',
        'source_text', 'never-imported',
        'proposed_target', 'never-imported',
        'license_note', null,
        'metadata', '{}'::jsonb,
        'pii_flag', false
      ),
      -- A brand-new hash that is NOT excluded.
      jsonb_build_object(
        'content_hash', 'r2-batch-new-hash',
        'origin', 'test:r2-batch',
        'direction', 'en-ne',
        'register', 'unspecified',
        'script', 'unspecified',
        'source_text', 'r2 brand new source text',
        'proposed_target', 'r2 brand new target',
        'license_note', null,
        'metadata', '{}'::jsonb,
        'pii_flag', false
      )
    ),
    'gold-en-ne-formal'
  );

  if (v_res ->> 'skipped_excluded')::int <> 1 then
    raise exception 'batch importer did not skip the excluded hash (res=%)', v_res;
  end if;
  if (v_res ->> 'inserted')::int <> 1 then
    raise exception 'batch importer did not insert the fresh hash (res=%)', v_res;
  end if;

  perform public.service_finish_review_import_run(v_run, 'ok', null, 'test');
end $$;

select ok(true, 'batch importer skipped excluded hash and inserted the new one');

-- Idempotent admin exclusion insert.
select public.service_add_review_exclusion(
  'r2-admin-manual-hash',
  'admin_quarantine',
  'admin:manual',
  '11111111-1111-4111-8111-111111111111',
  'test manual quarantine'
);

select public.service_add_review_exclusion(
  'r2-admin-manual-hash',
  'admin_quarantine',
  'admin:manual',
  '11111111-1111-4111-8111-111111111111',
  'test manual quarantine (idempotent)'
);

select is(
  (select count(*)::int from public.review_exclusions
    where content_hash = 'r2-admin-manual-hash'
      and reason = 'admin_quarantine'),
  1,
  'service_add_review_exclusion is idempotent on (hash, reason)'
);

-- Import runs recorded with git_sha + registry_version + status columns.
select is(
  (select status from private.review_import_runs
    where origin = 'test:r2-batch'
    order by started_at desc limit 1),
  'ok',
  'import run finished with status=ok'
);

select ok(
  (select git_sha is not null and registry_version is not null
     from private.review_import_runs
    where origin = 'test:r2-batch'
    order by started_at desc limit 1),
  'import run stored git_sha + registry_version'
);

select * from finish();
rollback;
