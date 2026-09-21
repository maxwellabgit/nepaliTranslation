-- H3: server-authoritative consent, receipts, rate limits, SQL scoring,
-- per-user idempotency, and atomic contribution submit.

-- ---------------------------------------------------------------------------
-- 1. app_config: contribution_consent_version
-- ---------------------------------------------------------------------------

alter table public.app_config
  add column if not exists contribution_consent_version text not null
    default '2026-09-19.draft';

update public.app_config
set contribution_consent_version = '2026-09-19.draft'
where id = 1 and contribution_consent_version is null;

-- ---------------------------------------------------------------------------
-- 2. Translation-report idempotency: (reporter_id, idempotency_key)
-- ---------------------------------------------------------------------------

alter table private.translation_reports
  drop constraint if exists translation_reports_idempotency_unique;

-- reporter_id may be nulled on account deletion; scope active idempotency per reporter.
create unique index if not exists translation_reports_reporter_idempotency_uidx
  on private.translation_reports (reporter_id, idempotency_key)
  where reporter_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Reward ledger idempotency: (user_id, source_type, source_id)
-- ---------------------------------------------------------------------------

alter table public.reward_ledger
  drop constraint if exists reward_ledger_source_unique;

alter table public.reward_ledger
  add constraint reward_ledger_user_source_unique
  unique (user_id, source_type, source_id);

-- ---------------------------------------------------------------------------
-- 4. Receipts connected to submission + ledger
-- ---------------------------------------------------------------------------

alter table public.contribution_receipts
  add column if not exists assignment_id uuid,
  add column if not exists submission_id uuid,
  add column if not exists ledger_id uuid,
  add column if not exists idempotency_key text;

create unique index if not exists contribution_receipts_user_idempotency_uidx
  on public.contribution_receipts (user_id, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists contribution_receipts_submission_uidx
  on public.contribution_receipts (submission_id)
  where submission_id is not null;

-- ---------------------------------------------------------------------------
-- 5. Server-side rate limits (authoritative; not Edge in-memory maps)
-- ---------------------------------------------------------------------------

create table if not exists private.rate_limit_buckets (
  bucket_key text primary key,
  tokens integer not null,
  reset_at timestamptz not null
);

revoke all on table private.rate_limit_buckets from public, anon, authenticated;
grant all on table private.rate_limit_buckets to service_role;

create or replace function private.check_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_tokens integer;
  v_reset timestamptz;
begin
  if p_bucket_key is null or p_limit < 1 or p_window_seconds < 1 then
    return false;
  end if;

  insert into private.rate_limit_buckets (bucket_key, tokens, reset_at)
  values (p_bucket_key, p_limit - 1, v_now + make_interval(secs => p_window_seconds))
  on conflict (bucket_key) do nothing;

  select tokens, reset_at into v_tokens, v_reset
  from private.rate_limit_buckets
  where bucket_key = p_bucket_key
  for update;

  if v_reset <= v_now then
    update private.rate_limit_buckets
    set tokens = p_limit - 1,
        reset_at = v_now + make_interval(secs => p_window_seconds)
    where bucket_key = p_bucket_key;
    return true;
  end if;

  if v_tokens <= 0 then
    return false;
  end if;

  update private.rate_limit_buckets
  set tokens = tokens - 1
  where bucket_key = p_bucket_key;
  return true;
end;
$$;

revoke all on function private.check_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function private.check_rate_limit(text, integer, integer)
  to service_role;

create or replace function public.service_check_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.check_rate_limit(p_bucket_key, p_limit, p_window_seconds);
end;
$$;

revoke all on function public.service_check_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.service_check_rate_limit(text, integer, integer)
  to service_role;

-- ---------------------------------------------------------------------------
-- 6. Private SQL normalization / similarity (matches shared TS fixtures)
-- Oversized inputs return NULL similarity → stay pending for admin.
-- ---------------------------------------------------------------------------

create or replace function private.normalize_for_score(p_input text)
returns text
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  s text;
begin
  s := btrim(normalize(p_input, nfc));
  s := regexp_replace(s, '\s+', ' ', 'g');
  -- lower() only affects Latin letters; Devanagari is unchanged.
  s := lower(s);
  s := regexp_replace(s, '[。．.]+$', '.', 'g');
  s := regexp_replace(s, '[！!]+$', '!', 'g');
  s := regexp_replace(s, '[？?]+$', '?', 'g');
  s := regexp_replace(s, '([.!?])\1+$', '\1', 'g');
  return s;
end;
$$;

create or replace function private.levenshtein_chars(a text, b text)
returns integer
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  la integer := char_length(a);
  lb integer := char_length(b);
  i integer;
  j integer;
  prev integer[];
  curr integer[];
  cost integer;
begin
  if la = 0 then return lb; end if;
  if lb = 0 then return la; end if;
  -- Cap work: callers must reject oversized strings first.
  if la > 500 or lb > 500 then
    return null;
  end if;

  for j in 0..lb loop
    prev[j] := j;
  end loop;

  for i in 1..la loop
    curr[0] := i;
    for j in 1..lb loop
      cost := case when substr(a, i, 1) = substr(b, j, 1) then 0 else 1 end;
      curr[j] := least(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    end loop;
    prev := curr;
  end loop;
  return prev[lb];
end;
$$;

create or replace function private.token_dice(a text, b text)
returns numeric
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  ta text[];
  tb text[];
  counts jsonb := '{}'::jsonb;
  inter integer := 0;
  tok text;
  n integer;
  i integer;
begin
  ta := string_to_array(a, ' ');
  tb := string_to_array(b, ' ');
  ta := array_remove(ta, '');
  tb := array_remove(tb, '');
  if coalesce(array_length(ta, 1), 0) + coalesce(array_length(tb, 1), 0) = 0 then
    return 0;
  end if;
  foreach tok in array tb loop
    n := coalesce((counts ->> tok)::integer, 0);
    counts := counts || jsonb_build_object(tok, n + 1);
  end loop;
  foreach tok in array ta loop
    n := coalesce((counts ->> tok)::integer, 0);
    if n > 0 then
      inter := inter + 1;
      counts := counts || jsonb_build_object(tok, n - 1);
    end if;
  end loop;
  return (2.0 * inter) / (coalesce(array_length(ta, 1), 0) + coalesce(array_length(tb, 1), 0));
end;
$$;

create or replace function private.similarity(a text, b text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  na text;
  nb text;
  edit numeric;
  dist integer;
  maxlen integer;
begin
  na := private.normalize_for_score(coalesce(a, ''));
  nb := private.normalize_for_score(coalesce(b, ''));
  if na = '' and nb = '' then
    return null;
  end if;
  if na = '' or nb = '' then
    return 0;
  end if;
  -- Automatic scoring limit: leave oversized pairs for admin (NULL).
  if char_length(na) > 500 or char_length(nb) > 500 then
    return null;
  end if;
  dist := private.levenshtein_chars(na, nb);
  if dist is null then
    return null;
  end if;
  maxlen := greatest(char_length(na), char_length(nb));
  edit := 1.0 - (dist::numeric / maxlen);
  return 0.75 * edit + 0.25 * private.token_dice(na, nb);
end;
$$;

create or replace function private.known_check_passes(p_answer text, p_references text[])
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  normalized text;
  answer_len integer;
  ref text;
  ref_norm text;
  ref_len integer;
  score numeric;
  short_max integer := 4;
  known_pass numeric := 0.72;
begin
  normalized := private.normalize_for_score(coalesce(p_answer, ''));
  if normalized = '' then
    return false;
  end if;
  answer_len := char_length(normalized);
  if p_references is null then
    return false;
  end if;
  foreach ref in array p_references loop
    ref_norm := private.normalize_for_score(coalesce(ref, ''));
    if ref_norm = '' then
      continue;
    end if;
    if normalized = ref_norm then
      return true;
    end if;
    ref_len := char_length(ref_norm);
    if answer_len <= short_max or ref_len <= short_max then
      continue;
    end if;
    score := private.similarity(p_answer, ref);
    if score is not null and score >= known_pass then
      return true;
    end if;
  end loop;
  return false;
end;
$$;

create or replace function private.responses_agree(a text, b text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  score numeric;
begin
  if private.normalize_for_score(coalesce(a, '')) = private.normalize_for_score(coalesce(b, '')) then
    return true;
  end if;
  score := private.similarity(a, b);
  return score is not null and score >= 0.8;
end;
$$;

revoke all on function private.normalize_for_score(text) from public, anon, authenticated;
revoke all on function private.levenshtein_chars(text, text) from public, anon, authenticated;
revoke all on function private.token_dice(text, text) from public, anon, authenticated;
revoke all on function private.similarity(text, text) from public, anon, authenticated;
revoke all on function private.known_check_passes(text, text[]) from public, anon, authenticated;
revoke all on function private.responses_agree(text, text) from public, anon, authenticated;
grant execute on function private.normalize_for_score(text) to service_role;
grant execute on function private.similarity(text, text) to service_role;
grant execute on function private.known_check_passes(text, text[]) to service_role;

-- Expose score helpers for pgTAP / Deno fixture parity checks (service_role only).
create or replace function public.service_normalize_for_score(p_input text)
returns text
language sql
security definer
set search_path = ''
as $$ select private.normalize_for_score(p_input); $$;

create or replace function public.service_similarity(a text, b text)
returns numeric
language sql
security definer
set search_path = ''
as $$ select private.similarity(a, b); $$;

create or replace function public.service_known_check_passes(p_answer text, p_references text[])
returns boolean
language sql
security definer
set search_path = ''
as $$ select private.known_check_passes(p_answer, p_references); $$;

revoke all on function public.service_normalize_for_score(text) from public, anon, authenticated;
revoke all on function public.service_similarity(text, text) from public, anon, authenticated;
revoke all on function public.service_known_check_passes(text, text[]) from public, anon, authenticated;
grant execute on function public.service_normalize_for_score(text) to service_role;
grant execute on function public.service_similarity(text, text) to service_role;
grant execute on function public.service_known_check_passes(text, text[]) to service_role;

-- ---------------------------------------------------------------------------
-- Consent: server current version only
-- ---------------------------------------------------------------------------

create or replace function private.assert_contribution_consent(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version text;
  v_consented text;
  v_age timestamptz;
begin
  select contribution_consent_version into v_version
  from public.app_config
  where id = 1;

  select consent_version, age_confirmed_at
  into v_consented, v_age
  from public.profiles
  where user_id = p_user_id;

  if v_consented is null or btrim(v_consented) = '' then
    raise exception 'consent_required' using errcode = 'P0001';
  end if;
  if v_age is null then
    raise exception 'age_required' using errcode = 'P0001';
  end if;
  if v_consented is distinct from v_version then
    raise exception 'consent_outdated' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function private.assert_contribution_consent(uuid)
  from public, anon, authenticated;
grant execute on function private.assert_contribution_consent(uuid) to service_role;

create or replace function public.service_assert_contribution_consent(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  perform private.assert_contribution_consent(p_user_id);
end;
$$;

revoke all on function public.service_assert_contribution_consent(uuid)
  from public, anon, authenticated;
grant execute on function public.service_assert_contribution_consent(uuid)
  to service_role;

create or replace function public.service_current_consent_version()
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select contribution_consent_version from public.app_config where id = 1;
$$;

revoke all on function public.service_current_consent_version()
  from public, anon, authenticated;
grant execute on function public.service_current_consent_version() to service_role;

-- record-consent accepts only the server's current version
create or replace function public.service_record_consent(
  p_user_id uuid,
  p_version text,
  p_age_confirmed boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current text;
begin
  if p_user_id is null or p_age_confirmed is not true or p_version is null then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  select contribution_consent_version into v_current
  from public.app_config where id = 1;
  if p_version is distinct from v_current then
    raise exception 'consent_outdated' using errcode = 'P0001';
  end if;
  update public.profiles
  set
    consent_version = p_version,
    consented_at = now(),
    age_confirmed_at = now(),
    updated_at = now()
  where user_id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- apply_reward: per-user source uniqueness
-- ---------------------------------------------------------------------------

create or replace function private.apply_reward(
  p_user_id uuid,
  p_source_type text,
  p_source_id text,
  p_credits integer,
  p_minutes integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ledger_id uuid;
  v_inserted uuid;
  v_now timestamptz := now();
  v_until timestamptz;
  v_day date := (timezone('utc', v_now))::date;
  v_today integer;
  v_cap integer;
  v_is_video boolean;
begin
  if p_credits < 0 or p_minutes < 0 then
    raise exception 'invalid_reward' using errcode = '22023';
  end if;

  insert into public.earned_entitlements (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  insert into private.contributor_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  perform 1
  from public.earned_entitlements
  where user_id = p_user_id
  for update;

  perform 1
  from private.contributor_stats
  where user_id = p_user_id
  for update;

  v_is_video := p_source_type in ('rewarded_video', 'admob_ssv');
  v_cap := case when v_is_video then 12 else 60 end;

  select id into v_ledger_id
  from public.reward_ledger
  where user_id = p_user_id
    and source_type = p_source_type
    and source_id = p_source_id;
  if v_ledger_id is not null then
    return jsonb_build_object(
      'applied', false,
      'ledger_id', v_ledger_id,
      'reason', 'duplicate'
    );
  end if;

  if v_is_video then
    select case
      when video_credits_utc_day is distinct from v_day then 0
      else video_credits_today
    end
    into v_today
    from private.contributor_stats
    where user_id = p_user_id;
  else
    select case
      when credits_utc_day is distinct from v_day then 0
      else credits_today
    end
    into v_today
    from private.contributor_stats
    where user_id = p_user_id;
  end if;

  if coalesce(v_today, 0) + p_credits > v_cap then
    return jsonb_build_object(
      'applied', false,
      'reason', 'daily_cap',
      'cap', v_cap,
      'credits_today', coalesce(v_today, 0)
    );
  end if;

  insert into public.reward_ledger (user_id, source_type, source_id, credits, minutes)
  values (p_user_id, p_source_type, p_source_id, p_credits, p_minutes)
  on conflict (user_id, source_type, source_id) do nothing
  returning id into v_inserted;

  if v_inserted is null then
    select id into v_ledger_id
    from public.reward_ledger
    where user_id = p_user_id
      and source_type = p_source_type
      and source_id = p_source_id;
    return jsonb_build_object(
      'applied', false,
      'ledger_id', v_ledger_id,
      'reason', 'duplicate'
    );
  end if;

  update public.earned_entitlements
  set
    earned_ad_free_until =
      greatest(v_now, coalesce(earned_ad_free_until, v_now))
      + make_interval(mins => p_minutes),
    lifetime_credits = lifetime_credits + p_credits,
    version = version + 1,
    updated_at = v_now
  where user_id = p_user_id
  returning earned_ad_free_until into v_until;

  if v_is_video then
    update private.contributor_stats
    set
      video_credits_utc_day = v_day,
      video_credits_today = coalesce(v_today, 0) + p_credits
    where user_id = p_user_id;
  else
    update private.contributor_stats
    set
      credits_utc_day = v_day,
      credits_today = coalesce(v_today, 0) + p_credits
    where user_id = p_user_id;
  end if;

  return jsonb_build_object(
    'applied', true,
    'ledger_id', v_inserted,
    'earned_ad_free_until', v_until
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Translation report insert: consent + per-reporter idempotency
-- ---------------------------------------------------------------------------

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
  v_server_version text;
begin
  if p_reporter_id is null or p_idempotency_key is null or length(p_idempotency_key) < 8 then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  if p_source_text is null or length(btrim(p_source_text)) = 0 then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  if not private.check_rate_limit('report:' || p_reporter_id::text, 30, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  perform private.assert_contribution_consent(p_reporter_id);

  select contribution_consent_version into v_server_version
  from public.app_config where id = 1;

  select id into existing_id
  from private.translation_reports
  where reporter_id = p_reporter_id
    and idempotency_key = p_idempotency_key;

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
    v_server_version,
    'triage',
    p_idempotency_key
  )
  returning id into new_id;

  return query select new_id, true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Lease: consent + rate limit
-- ---------------------------------------------------------------------------

create or replace function public.service_lease_contribution_task(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if not private.check_rate_limit('lease:' || p_user_id::text, 30, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  perform private.assert_contribution_consent(p_user_id);
  return private.lease_safe_task(p_user_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Consensus resolution (SQL; model similarity never resolves alone)
-- ---------------------------------------------------------------------------

create or replace function private.resolve_task_consensus(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec record;
  votes jsonb := '[]'::jsonb;
  normals jsonb := '[]'::jsonb;
  i integer;
  j integer;
  n integer;
  vi jsonb;
  vj jsonb;
  winner text;
  answers text[];
begin
  for rec in
    select
      s.id as submission_id,
      s.user_id,
      case when coalesce(cs.state, 'normal') = 'probation' then 'probation' else 'normal' end as band,
      coalesce(s.normalized_response, '') as normalized_response,
      s.model_similarity,
      s.action
    from private.submissions s
    join private.task_assignments a on a.id = s.assignment_id
    left join private.contributor_stats cs on cs.user_id = s.user_id
    where a.task_id = p_task_id
      and s.action in ('looks_correct', 'edit')
    order by s.created_at
  loop
    votes := votes || jsonb_build_array(jsonb_build_object(
      'submission_id', rec.submission_id,
      'user_id', rec.user_id,
      'band', rec.band,
      'normalized_response', rec.normalized_response,
      'model_similarity', rec.model_similarity,
      'action', rec.action
    ));
    if rec.band = 'normal' then
      normals := normals || jsonb_build_array(jsonb_build_object(
        'submission_id', rec.submission_id,
        'user_id', rec.user_id,
        'normalized_response', rec.normalized_response,
        'model_similarity', rec.model_similarity,
        'action', rec.action
      ));
    end if;
  end loop;

  -- Duplicate users → reject path (should not happen with assignment uniqueness).
  if (
    select count(*) from jsonb_array_elements(votes) e
  ) <> (
    select count(distinct e ->> 'user_id') from jsonb_array_elements(votes) e
  ) then
    return jsonb_build_object('status', 'rejected', 'reward_eligible', false);
  end if;

  n := coalesce(jsonb_array_length(votes), 0);
  if n < 2 then
    return jsonb_build_object('status', 'pending', 'reward_eligible', false);
  end if;

  for i in 0..greatest(jsonb_array_length(normals) - 1, -1) loop
    for j in (i + 1)..greatest(jsonb_array_length(normals) - 1, -1) loop
      vi := normals -> i;
      vj := normals -> j;
      if private.responses_agree(vi ->> 'normalized_response', vj ->> 'normalized_response') then
        winner := vi ->> 'normalized_response';
        return jsonb_build_object(
          'status', 'resolved',
          'winner', winner,
          'reward_eligible', true,
          'votes', votes
        );
      end if;
    end loop;
  end loop;

  if n >= 3 then
    select array_agg(e ->> 'normalized_response' order by ord)
    into answers
    from jsonb_array_elements(votes) with ordinality as t(e, ord);
    if answers is not null
      and array_length(answers, 1) >= 3
      and not private.responses_agree(answers[1], answers[2])
      and not private.responses_agree(answers[1], answers[3])
      and not private.responses_agree(answers[2], answers[3])
    then
      return jsonb_build_object(
        'status', 'disputed',
        'reward_eligible', false,
        'votes', votes
      );
    end if;
  end if;

  return jsonb_build_object('status', 'pending', 'reward_eligible', false, 'votes', votes);
end;
$$;

revoke all on function private.resolve_task_consensus(uuid)
  from public, anon, authenticated;
grant execute on function private.resolve_task_consensus(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Atomic contribution submit (service_role only)
-- ---------------------------------------------------------------------------

create or replace function public.service_submit_contribution_atomic(
  p_user_id uuid,
  p_assignment_id uuid,
  p_action text,
  p_response_text text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment private.task_assignments%rowtype;
  v_task private.contribution_tasks%rowtype;
  v_band text;
  v_refs text[];
  v_raw text;
  v_normalized text;
  v_model_sim numeric;
  v_decision text := 'pending';
  v_known_pass boolean := false;
  v_submission_id uuid;
  v_receipt_id uuid;
  v_existing_receipt public.contribution_receipts%rowtype;
  v_consensus jsonb;
  v_status text;
  v_winner text;
  v_vote jsonb;
  v_kind text;
  v_reward jsonb;
  v_credits integer;
  v_ledger_id uuid;
  v_eligible_sim numeric;
  REWARD_LABEL constant text := 'Earn 1–6 credits after validation';
begin
  if p_user_id is null or p_assignment_id is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if p_action is null or p_action not in ('looks_correct', 'edit', 'skip', 'report_task') then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  if not private.check_rate_limit('submit:' || p_user_id::text, 60, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  perform private.assert_contribution_consent(p_user_id);

  -- Replay: same user + idempotency key → prior opaque receipt, no mutations.
  select * into v_existing_receipt
  from public.contribution_receipts
  where user_id = p_user_id
    and idempotency_key = p_idempotency_key
  limit 1;
  if found then
    return jsonb_build_object(
      'receipt_id', v_existing_receipt.id,
      'status', 'received',
      'reward_label', REWARD_LABEL,
      'reward', null,
      'replay', true
    );
  end if;

  -- 1. Lock assignment and task
  select * into v_assignment
  from private.task_assignments
  where id = p_assignment_id
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select * into v_task
  from private.contribution_tasks
  where id = v_assignment.task_id
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  -- 2. Verify owner, lease, action
  if v_assignment.user_id is distinct from p_user_id then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_assignment.completed_at is not null then
    select * into v_existing_receipt
    from public.contribution_receipts
    where assignment_id = p_assignment_id
      and user_id = p_user_id
    order by submitted_at desc
    limit 1;
    if found then
      return jsonb_build_object(
        'receipt_id', v_existing_receipt.id,
        'status', 'received',
        'reward_label', REWARD_LABEL,
        'reward', null,
        'replay', true
      );
    end if;
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_assignment.leased_until < now() then
    raise exception 'lease_expired' using errcode = 'P0001';
  end if;

  -- 4. Normalize and record response
  v_raw := btrim(coalesce(p_response_text, ''));
  if p_action = 'looks_correct' then
    v_normalized := private.normalize_for_score(v_task.model_output);
    v_raw := coalesce(nullif(v_raw, ''), v_task.model_output);
  elsif p_action in ('skip', 'report_task') then
    v_normalized := '';
  else
    if v_raw = '' then
      raise exception 'invalid_payload' using errcode = '22023';
    end if;
    v_normalized := private.normalize_for_score(v_raw);
  end if;

  v_model_sim := private.similarity(v_normalized, v_task.model_output);

  select coalesce(cs.state, 'normal') into v_band
  from private.contributor_stats cs
  where cs.user_id = p_user_id;
  if v_band is null then
    v_band := 'normal';
  end if;

  -- 5. Known check path
  if v_task.task_type = 'known_check'
     and p_action in ('looks_correct', 'edit') then
    select coalesce(array_agg(kr.normalized_text order by kr.id), '{}')
    into v_refs
    from private.known_references kr
    where kr.reference_set_id = v_task.reference_set_id;

    if v_model_sim is null
       or char_length(v_normalized) > 500 then
      v_decision := 'pending';
      v_known_pass := false;
    else
      v_known_pass := private.known_check_passes(v_normalized, v_refs);
      v_decision := case when v_known_pass then 'known_pass' else 'known_fail' end;
    end if;
  end if;

  insert into private.submissions (
    assignment_id, user_id, action, raw_response, normalized_response,
    model_similarity, decision_status
  ) values (
    p_assignment_id, p_user_id, p_action,
    case when p_action in ('skip', 'report_task') then null else v_raw end,
    case when p_action in ('skip', 'report_task') then null else v_normalized end,
    v_model_sim, v_decision
  )
  returning id into v_submission_id;

  update private.task_assignments
  set completed_at = now(), client_nonce = p_idempotency_key
  where id = p_assignment_id;

  insert into public.contribution_receipts (
    user_id, public_task_id, status, credits_awarded,
    assignment_id, submission_id, idempotency_key, reason_code
  ) values (
    p_user_id, v_task.id, 'pending', 0,
    p_assignment_id, v_submission_id, p_idempotency_key, null
  )
  returning id into v_receipt_id;

  if v_task.task_type = 'known_check'
     and p_action in ('looks_correct', 'edit')
     and v_decision in ('known_pass', 'known_fail') then
    -- Bump reliability exactly once (new submission path only).
    insert into private.contributor_stats (user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;

    update private.contributor_stats
    set
      known_attempts = known_attempts + 1,
      known_passes = known_passes + case when v_known_pass then 1 else 0 end,
      reliability = least(
        0.95,
        greatest(
          0.2,
          (known_passes + case when v_known_pass then 1 else 0 end)::numeric
          / nullif(known_attempts + 1, 0)
        )
      ),
      state = case
        when (known_passes + case when v_known_pass then 1 else 0 end)::numeric
             / nullif(known_attempts + 1, 0) < 0.4
        then 'probation'
        else state
      end
    where user_id = p_user_id;

    if v_known_pass then
      v_reward := private.apply_reward(
        p_user_id, 'contribution', 'submission:' || v_submission_id::text, 1, 5
      );
      v_ledger_id := (v_reward ->> 'ledger_id')::uuid;
      v_credits := case when (v_reward ->> 'applied')::boolean then 1 else 0 end;
      update public.contribution_receipts
      set
        status = 'validated',
        credits_awarded = v_credits,
        ledger_id = v_ledger_id,
        resolved_at = now(),
        reason_code = 'known_pass'
      where id = v_receipt_id;
    else
      update public.contribution_receipts
      set
        status = 'rejected',
        resolved_at = now(),
        reason_code = 'known_fail'
      where id = v_receipt_id;
    end if;

  elsif v_task.task_type = 'unknown'
        and p_action in ('looks_correct', 'edit') then
    -- 6–9. Consensus; model similarity never resolves alone.
    v_consensus := private.resolve_task_consensus(v_task.id);
    v_status := v_consensus ->> 'status';

    if v_status = 'disputed' then
      update private.contribution_tasks
      set state = 'disputed'
      where id = v_task.id;
      update public.contribution_receipts r
      set
        status = 'disputed',
        resolved_at = now(),
        reason_code = 'disputed'
      from private.submissions s
      join private.task_assignments a on a.id = s.assignment_id
      where r.submission_id = s.id
        and a.task_id = v_task.id
        and r.status = 'pending';

    elsif v_status = 'resolved' and (v_consensus ->> 'reward_eligible')::boolean then
      v_winner := v_consensus ->> 'winner';
      update private.contribution_tasks
      set state = 'resolved'
      where id = v_task.id;

      -- Reward each eligible contributor once via submission:<id>
      for v_vote in
        select e
        from jsonb_array_elements(coalesce(v_consensus -> 'votes', '[]'::jsonb)) e
      loop
        if (v_vote ->> 'band') is distinct from 'normal' then
          continue;
        end if;
        if not private.responses_agree(v_vote ->> 'normalized_response', v_winner) then
          continue;
        end if;

        v_eligible_sim := nullif(v_vote ->> 'model_similarity', '')::numeric;
        if (v_vote ->> 'action') = 'edit'
           and v_eligible_sim is not null
           and v_eligible_sim < 0.92 then
          v_kind := 'unknown_correction';
        else
          v_kind := 'unknown_confirm';
        end if;

        v_reward := public.service_apply_scheduled_reward(
          (v_vote ->> 'user_id')::uuid,
          v_kind,
          'submission:' || (v_vote ->> 'submission_id')
        );
        v_ledger_id := nullif(v_reward ->> 'ledger_id', '')::uuid;
        select credits into v_credits from private.reward_schedule(v_kind);
        if not coalesce((v_reward ->> 'applied')::boolean, false) then
          v_credits := 0;
        end if;

        update public.contribution_receipts
        set
          status = 'validated',
          credits_awarded = greatest(credits_awarded, coalesce(v_credits, 0)),
          ledger_id = coalesce(v_ledger_id, ledger_id),
          resolved_at = coalesce(resolved_at, now()),
          reason_code = v_kind
        where submission_id = (v_vote ->> 'submission_id')::uuid;
      end loop;

      -- Mark non-matching pending receipts as rejected for this task.
      update public.contribution_receipts r
      set
        status = 'rejected',
        resolved_at = now(),
        reason_code = 'consensus_mismatch'
      from private.submissions s
      join private.task_assignments a on a.id = s.assignment_id
      where r.submission_id = s.id
        and a.task_id = v_task.id
        and r.status = 'pending';
    end if;
    -- pending: leave receipts pending; model-only never resolves.
  elsif p_action in ('skip', 'report_task') then
    update public.contribution_receipts
    set
      status = 'dismissed',
      resolved_at = now(),
      reason_code = p_action
    where id = v_receipt_id;
  end if;

  -- 11. Opaque public envelope (known == unknown)
  return jsonb_build_object(
    'receipt_id', v_receipt_id,
    'status', 'received',
    'reward_label', REWARD_LABEL,
    'reward', null
  );
end;
$$;

revoke all on function public.service_submit_contribution_atomic(
  uuid, uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.service_submit_contribution_atomic(
  uuid, uuid, text, text, text
) to service_role;
