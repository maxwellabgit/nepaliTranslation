-- C2 follow-up: the one-time eligibility update does not govern later imports.
-- The batch importer and the daily selector both recompute
-- private.review_public_eligible. Unresolved display rights stay out of
-- the pool. Forward-only. Earlier migrations are unchanged.

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
  v_rights text;
  v_origin_class text;
  v_anonymization text;
  v_explicit boolean;
  v_excluded boolean;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    if (v_row ->> 'content_hash') is null or (v_row ->> 'source_text') is null then
      raise exception 'invalid_row_shape' using errcode = '22023';
    end if;

    v_excluded := exists (
      select 1 from public.review_exclusions
       where content_hash = v_row ->> 'content_hash'
    );
    if v_excluded then
      v_skipped_excluded := v_skipped_excluded + 1;
      continue;
    end if;

    if coalesce((v_row ->> 'pii_flag')::boolean, false) then
      v_skipped_pii := v_skipped_pii + 1;
    end if;

    v_rights := coalesce(v_row ->> 'rights_status', 'unresolved');
    v_origin_class := coalesce(v_row ->> 'origin_class', 'training_source');
    v_anonymization := coalesce(v_row ->> 'anonymization_status', 'not_required');
    v_explicit := not coalesce((v_row ->> 'pii_flag')::boolean, false);

    insert into private.review_source_items (
      content_hash, origin, direction, register, script,
      source_text, proposed_target, license_note, metadata,
      source_char_length, pii_flag,
      rights_status, origin_class, anonymization_status,
      public_review_eligible
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
      v_rights,
      v_origin_class,
      v_anonymization,
      private.review_public_eligible(
        v_explicit,
        v_rights,
        v_origin_class,
        v_anonymization,
        false,
        false,
        false,
        false
      )
    )
    on conflict (content_hash) do update
      set origin = excluded.origin,
          metadata = private.review_source_items.metadata || excluded.metadata,
          pii_flag = private.review_source_items.pii_flag or excluded.pii_flag,
          rights_status = case
            when v_row ? 'rights_status' then excluded.rights_status
            else private.review_source_items.rights_status
          end,
          origin_class = case
            when v_row ? 'origin_class' then excluded.origin_class
            else private.review_source_items.origin_class
          end,
          anonymization_status = case
            when v_row ? 'anonymization_status' then excluded.anonymization_status
            else private.review_source_items.anonymization_status
          end,
          public_review_eligible = private.review_public_eligible(
            not (private.review_source_items.pii_flag or excluded.pii_flag),
            case
              when v_row ? 'rights_status' then excluded.rights_status
              else private.review_source_items.rights_status
            end,
            case
              when v_row ? 'origin_class' then excluded.origin_class
              else private.review_source_items.origin_class
            end,
            case
              when v_row ? 'anonymization_status' then excluded.anonymization_status
              else private.review_source_items.anonymization_status
            end,
            private.review_source_items.substantively_reviewed,
            private.review_source_items.quarantined,
            false,
            exists (
              select 1 from public.review_exclusions e
               where e.content_hash = private.review_source_items.content_hash
            )
          )
    returning id into v_id;

    if v_id is not null then
      v_inserted := v_inserted + 1;
    else
      v_updated := v_updated + 1;
    end if;
  end loop;

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

-- Selector must not trust a stale public_review_eligible flag.
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
     where private.review_public_eligible(
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

comment on function private.select_review_window_items(smallint) is
  'C2: selection recomputes review_public_eligible. Length-tier ranking is deprecated and is not the credit rule.';
