-- F5: remote emergency disable for automatic interstitial (default off).
alter table public.app_config
  add column if not exists automatic_interstitial_enabled boolean not null default false;

update public.app_config
set automatic_interstitial_enabled = false
where id = 1;
