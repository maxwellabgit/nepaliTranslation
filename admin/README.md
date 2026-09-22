# NepTranslate Admin (F7)

Protected operational console for review, alerts, deletion queue, dataset staging, and feature flags.

## Security

- Uses **only** `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` + the signed-in user JWT.
- Never put `SUPABASE_SERVICE_ROLE_KEY` (or any secret) in this app or its env files committed to git.
- Server allowlist: `private.admin_users` where `revoked_at` is null. Revoked admins lose access on the next API request.
- Non-admins receive **403** from every `admin-api` route.

## Local setup

```bash
cp .env.example .env
# fill anon URL/key from local supabase status
npm ci
npm run dev
```

Insert an allowlisted operator (local only):

```sql
insert into private.admin_users (user_id, role)
values ('<auth.users.id>', 'ops');
```

## Tests

```bash
npm test
```

Playwright end-to-end for triage/export/deletion is **not** automated in F7 (blocker: needs live allowlisted session). Source Vitest covers 403 client handling.
