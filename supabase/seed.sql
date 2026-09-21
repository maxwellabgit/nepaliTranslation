-- Synthetic local seed only. Do not copy benchmarks/gold or private eval answers.
-- User inserts fire public.handle_new_user.

create extension if not exists pgcrypto with schema extensions;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  is_sso_user,
  is_anonymous
) values
(
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-4111-8111-111111111111',
  'authenticated',
  'authenticated',
  'user-a@synthetic.test',
  extensions.crypt('synthetic-password', extensions.gen_salt('bf')),
  now(),
  '',
  '',
  '',
  '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  false,
  false
),
(
  '00000000-0000-0000-0000-000000000000',
  '22222222-2222-4222-8222-222222222222',
  'authenticated',
  'authenticated',
  'user-b@synthetic.test',
  extensions.crypt('synthetic-password', extensions.gen_salt('bf')),
  now(),
  '',
  '',
  '',
  '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  false,
  false
);

insert into public.contribution_receipts (
  id, user_id, public_task_id, status, credits_awarded, reason_code
) values
(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c0c0',
  'pending',
  0,
  null
),
(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '22222222-2222-4222-8222-222222222222',
  'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c0c0',
  'pending',
  0,
  null
);

insert into private.known_references (id, reference_set_id, raw_text, normalized_text)
values (
  'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1',
  'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1',
  'निलो केतली छानामा छ',
  'निलो केतली छानामा छ'
);

insert into private.contribution_tasks (
  id, source_text, model_output, direction, formality, script,
  task_type, reference_set_id, state, reward_class, provenance, model_version
) values (
  'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c0c0',
  'SYNQC01 the blue kettle sits on the roof',
  'निलो केतली छानामा छ',
  'en-ne',
  'formal',
  'deva',
  'known_check',
  'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1',
  'open',
  'known',
  'synthetic-seed',
  'it2-dist-200m'
),
(
  'd0d0d0d0-d0d0-40d0-80d0-d0d0d0d0d0d0',
  'SYNUNK01 please pass the salt',
  'कृपया नून दिनुहोस्',
  'en-ne',
  'formal',
  'deva',
  'unknown',
  null,
  'open',
  'standard',
  'synthetic-seed',
  'it2-dist-200m'
);

-- H3: seeded users have current consent + age for contribution RPC tests.
update public.profiles
set
  consent_version = '2026-09-19.draft',
  consented_at = now(),
  age_confirmed_at = now(),
  updated_at = now()
where user_id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222'
);

update public.app_config
set contribution_consent_version = '2026-09-19.draft'
where id = 1;
