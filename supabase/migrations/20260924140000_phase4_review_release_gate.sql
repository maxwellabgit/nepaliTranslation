-- Phase 4/5: fourteen planned days do not launch public review.
-- A read of Today's 10 requires the caller's own consent and the release flag.

alter table public.app_config
  add column if not exists public_review_release_approved boolean not null default false;

create or replace function private.guard_public_review_enable()
returns trigger
language plpgsql
as $$
begin
  if NEW.public_review_enabled is true
     and coalesce(NEW.public_review_release_approved, false) is not true then
    NEW.public_review_enabled := false;
  end if;
  return NEW;
end;
$$;

drop trigger if exists app_config_public_review_enable on public.app_config;
create trigger app_config_public_review_enable
  before update on public.app_config
  for each row
  execute function private.guard_public_review_enable();

create or replace function public.service_assert_public_review_read(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_enabled boolean;
begin
  if p_user_id is null or v_uid is null or v_uid <> p_user_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select public_review_enabled into v_enabled
  from public.app_config
  where id = 1;
  if coalesce(v_enabled, false) is not true then
    raise exception 'flag_disabled' using errcode = 'P0001';
  end if;

  perform private.assert_review_eligibility(p_user_id);
end;
$$;

revoke all on function public.service_assert_public_review_read(uuid)
  from public, anon, service_role;
grant execute on function public.service_assert_public_review_read(uuid)
  to authenticated;
