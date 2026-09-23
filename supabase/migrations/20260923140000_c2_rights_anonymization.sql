-- C2: deny-by-default public-review rights and anonymization.
-- Forward-only. Does not rewrite earlier migrations.
-- Unresolved rights are treated as admin_only by private.review_public_eligible.
-- scripts/reviewEligibility.mjs must stay in agreement with that function.

alter table private.review_source_items
  add column if not exists dataset_id text,
  add column if not exists split_name text,
  add column if not exists provenance_uri text,
  add column if not exists license_id text,
  add column if not exists rights_status text not null default 'unresolved',
  add column if not exists anonymization_status text not null default 'not_required',
  add column if not exists anonymization_method text,
  add column if not exists import_batch_id text,
  add column if not exists source_norm_hash text,
  add column if not exists target_norm_hash text,
  add column if not exists origin_class text not null default 'training_source',
  add column if not exists substantively_reviewed boolean not null default false,
  add column if not exists quarantined boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'review_source_items_rights_status_check'
  ) then
    alter table private.review_source_items
      add constraint review_source_items_rights_status_check
      check (rights_status in (
        'cleared_public_display', 'admin_only', 'unresolved', 'prohibited'
      ));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'review_source_items_anonymization_status_check'
  ) then
    alter table private.review_source_items
      add constraint review_source_items_anonymization_status_check
      check (anonymization_status in (
        'not_required', 'pending', 'certified', 'failed'
      ));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'review_source_items_origin_class_check'
  ) then
    alter table private.review_source_items
      add constraint review_source_items_origin_class_check
      check (origin_class in (
        'training_source', 'benchmark_source', 'collected_user', 'raw_media', 'synthetic_qc'
      ));
  end if;
end $$;

create or replace function private.review_public_eligible(
  p_explicit boolean,
  p_rights text,
  p_origin_class text,
  p_anonymization text,
  p_reviewed boolean,
  p_quarantined boolean,
  p_planned boolean,
  p_excluded boolean
) returns boolean
language sql
immutable
as $$
  select
    coalesce(p_explicit, false)
    and (
      case
        when p_rights is null or p_rights = 'unresolved' then 'admin_only'
        else p_rights
      end
    ) = 'cleared_public_display'
    and (
      p_origin_class is distinct from 'collected_user'
      or p_anonymization = 'certified'
    )
    and not coalesce(p_reviewed, false)
    and not coalesce(p_quarantined, false)
    and not coalesce(p_planned, false)
    and not coalesce(p_excluded, false);
$$;

comment on function private.review_public_eligible(boolean, text, text, text, boolean, boolean, boolean, boolean)
  is 'C2 deny-by-default public review eligibility. Unresolved rights count as admin_only.';

-- Existing rows were imported under an older eligibility rule. Recompute the
-- flag from the new columns. Default rights are unresolved, so they leave
-- the public pool until provenance is cleared.
update private.review_source_items
set public_review_eligible = private.review_public_eligible(
  public_review_eligible,
  rights_status,
  origin_class,
  anonymization_status,
  substantively_reviewed,
  quarantined,
  false,
  false
);
