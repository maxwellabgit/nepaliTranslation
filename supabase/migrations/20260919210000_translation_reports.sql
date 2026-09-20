-- Slice 04: service-only translation report insert (idempotent).

alter table private.translation_reports
  add column if not exists model_output text,
  add column if not exists direction text,
  add column if not exists formality text,
  add column if not exists script text,
  add column if not exists surface text;

create or replace function public.service_insert_translation_report(
  p_reporter_id uuid,
  p_source_text text,
  p_model_output text,
  p_correction_text text,
  p_direction text,
  p_formality text,
  p_script text,
  p_surface text,
  p_idempotency_key text,
  p_consent_version text,
  p_metadata jsonb default '{}'::jsonb
)
returns table (report_id uuid, inserted boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_id uuid;
  new_id uuid;
begin
  if p_reporter_id is null or p_idempotency_key is null or length(p_idempotency_key) < 8 then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  if p_source_text is null or length(btrim(p_source_text)) = 0 then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  select id into existing_id
  from private.translation_reports
  where idempotency_key = p_idempotency_key;

  if existing_id is not null then
    return query select existing_id, false;
    return;
  end if;

  insert into private.translation_reports (
    reporter_id,
    raw_source,
    raw_correction,
    model_output,
    direction,
    formality,
    script,
    surface,
    metadata,
    consent_version,
    status,
    idempotency_key
  ) values (
    p_reporter_id,
    p_source_text,
    nullif(btrim(coalesce(p_correction_text, '')), ''),
    nullif(btrim(coalesce(p_model_output, '')), ''),
    p_direction,
    p_formality,
    p_script,
    p_surface,
    coalesce(p_metadata, '{}'::jsonb),
    p_consent_version,
    'triage',
    p_idempotency_key
  )
  returning id into new_id;

  return query select new_id, true;
end;
$$;

revoke all on function public.service_insert_translation_report(
  uuid, text, text, text, text, text, text, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.service_insert_translation_report(
  uuid, text, text, text, text, text, text, text, text, text, jsonb
) to service_role;
