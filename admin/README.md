# NepTranslate Admin (F7)

Protected operational console for review, alerts, deletion queue, dataset staging, and feature flags.

## Security

- Uses **only** `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` + the signed-in user JWT.
- Every `admin-api` fetch sends `Authorization: Bearer <user JWT>` **and** `apikey: <anon key>` (gateway requirement). Never put `SUPABASE_SERVICE_ROLE_KEY` in this app.
- Server allowlist: `private.admin_users` where `revoked_at` is null. Revoked admins lose access on the next API request.
- Non-admins receive **403** from every `admin-api` route.
- Media preview writes `private.audit_log` before returning a short-lived signed URL.

## Local setup

```bash
cp .env.example .env
# fill anon URL/key from `npx supabase status`
npm ci
npm run dev
```

Insert an allowlisted operator (local only):

```sql
insert into private.admin_users (user_id, role)
values ('<auth.users.id>', 'ops');
```

### Edge Function CORS (`ADMIN_ORIGIN`)

`admin-api` soft-allows `http://localhost:5173` and `http://127.0.0.1:5173` when `ADMIN_ORIGIN` is unset.

For a deployed admin host, set the Edge Function secret to the exact SPA origin (comma-separated if multiple):

```text
ADMIN_ORIGIN=https://admin.example.com
```

Without a matching origin, browsers block cross-origin calls even though curl/Deno can still hit the API.

## Tests

```bash
npm test
```

Playwright end-to-end for triage/export/deletion is **not** automated in F7 (blocker: needs live allowlisted session). Source Vitest covers 403 client handling + `apikey` header.
