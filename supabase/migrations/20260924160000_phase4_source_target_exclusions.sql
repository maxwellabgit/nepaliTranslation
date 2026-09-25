-- Phase 4: a public exposure excludes the source text and the target text,
-- not only the composite content hash. Forward-only.

create extension if not exists pgcrypto with schema extensions;

alter table public.review_exclusions
  add column if not exists source_hash text,
  add column if not exists target_hash text;

create or replace function private.review_text_hash(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(
    extensions.digest(
      convert_to(
        btrim(regexp_replace(coalesce(p_text, ''), '[[:space:]]+', ' ', 'g')),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;

revoke all on function private.review_text_hash(text) from public, anon, authenticated;
grant execute on function private.review_text_hash(text) to service_role;

create or replace function private.fill_exclusion_text_hashes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source text;
  v_target text;
begin
  select s.source_text, s.proposed_target
    into v_source, v_target
  from private.review_source_items s
  where s.content_hash = NEW.content_hash
  order by s.imported_at
  limit 1;

  if v_source is not null then
    NEW.source_hash := private.review_text_hash(v_source);
  end if;
  if v_target is not null then
    NEW.target_hash := private.review_text_hash(v_target);
  end if;
  return NEW;
end;
$$;

drop trigger if exists review_exclusions_text_hashes on public.review_exclusions;
create trigger review_exclusions_text_hashes
  before insert or update of content_hash on public.review_exclusions
  for each row
  execute function private.fill_exclusion_text_hashes();

update public.review_exclusions e
set content_hash = e.content_hash
where e.source_hash is null
  and exists (
    select 1 from private.review_source_items s
    where s.content_hash = e.content_hash
  );
