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

Admin runs on port **5174**. `admin-api` soft-allows localhost/127.0.0.1 on 5174 (and historical5173) when `ADMIN_ORIGIN` is unset.

For a deployed admin host, set the Edge Function secret to the exact SPA origin (comma-separated if multiple):

```text
ADMIN_ORIGIN=https://admin.example.com
```

Without a matching origin, browsers block cross-origin calls even though curl/Deno can still hit the API.

## Tests

```bash
npm test
```

The Contributions page retrieves original/revised typed and Today's10 answers plus private speech metadata. Cursor pagination includes all records without truncating originals. Download reauthorizes and refetches the current page, audits export and contains no signed audio URLs/service keys. Every record is private-review-only, never a training/public-display grant. Speech previews use audited120second signed links; a previously issued link can remain usable until expiry or object deletion. Withdrawal/open deletion excludes new retrieval/export/preview immediately.

`node scripts/prove_contribution_export.mjs` (from repo root, disposable local Supabase running, admin/testing-ground dependencies and Playwright installed) proves real guest capture, independent answer revisions, nonempty synthetic audio upload, authenticated operator browser JSON download, non-admin denial and storage-first purge. It refuses non-local API hosts and captures no media evidence. Hosted deployment/operator login/native microphone/legal approval remain separate owner proof. No account UI is added to the mobile product; this is an operator console.
