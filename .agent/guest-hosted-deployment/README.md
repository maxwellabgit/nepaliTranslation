# Hosted guest deployment evidence

Reviewed runtime source: `9504fcddd6de2b56405913b5afbb65a979eddfaa`. The nine earlier migration files also match `4bbd3e18149fdf3a3e462e57784b41df95ba3b21`; the dispatcher is from `9504fcd`. See [hosted results](../GUEST_HOSTED_PROOF_2026-10-03.md) for actual deployment, synthetic retrieval/purge and remaining proof limits.

`manifest.json` hashes the original migration bytes. `rehearse.sql` and `deploy.sql` embed those exact sources with normalized line endings; the final transaction ends in rollback or commit respectively. They preserve existing migration registry and consent records. `dispatch.sql` applies the separately reviewed immediate shared-data dispatcher. These are retained evidence, not instructions to rerun against another project without verifying its baseline.

## Endpoint bundle recipe

All four retained endpoint bundles reproduce from the runtime source above with the installed `testing-ground/node_modules/esbuild` version **0.25.12**. From the repository root, use its JavaScript `build` API with:

```js
{
  entryPoints: [`supabase/functions/${name}/index.ts`],
  bundle: true,
  platform: 'neutral',
  format: 'esm',
  tsconfigRaw: {},
  write: false
}
```

Names: `delete-data`, `record-sample-progress`, `process-scheduled-jobs`, `public-review`. Store `result.outputFiles[0].text` as `endpoints/${name}.js`; compare normalized CRLF/LF before comparing to retained bytes. No minification, target override or source map. The endpoint manifest records exact bundle and source-file hashes. Fresh independent review reproduced all four bundles exactly. Generated code has environment variable lookups, never service credentials.

`prepare-dispatch.cjs` regenerates dispatcher SQL/manifest from repository source; it optionally appends to an existing temporary transfer page. That page was removed after deployment. `prepare-consent-review.cjs` extracts exact current bilingual strings into the owner's review package without approving them.

`prove-hosted.mjs` is a controlled synthetic engineering probe using `BOLA_PROOF_PUBLIC_KEY` and real anonymous Auth. It stores temporary JWTs only in an OS temporary private file. Its capture phase requires explicitly enabled collection and specific synthetic consent; final hosted collection flags are now off. Do not enable flags or seed credits merely to rerun it. Temporary credentials/logs/transfer pages were removed; synthetic server identities remain solely as documented identity-preservation evidence.

## C5 continuation — SQL and endpoint deployed 2026-10-03

`prepare-contribution-export.cjs` reproduces `contribution-export.sql`, `endpoints/admin-api.js` and `contribution-export-manifest.json` from candidate1ff2a78 with esbuild0.25.12. The manifest's PREPARED_NOT_DEPLOYED field is generation-time metadata, superseded by the dated deployment evidence. This adds audited, current-consent-only private retrieval/export and filters legacy review and speech previews on withdrawal/deletion. The SQL is transaction wrapped and registry guarded. Review exact source/hash before use; rollback requires restoring the previous function definitions and endpoint, not deleting registry entries or contributor rows.

All candidate CI passed, including actual disposable-local Auth/Storage/browser export and nonempty purge. Owner-approved SQL/admin-api are deployed; registry/live source read-back passed. A separately approved dedicated owner operator was granted access and signed in; hosted empty retrieval works with gatewayON, requiring no gateway change for this session. Nonempty hosted export/download-byte proof remains pending. No service credentials, passwords or signed URLs are in this package; no model-training rights were granted. Collection flags remain off pending activation approval. See [C5 proof](../C5_CONTRIBUTION_EXPORT_2026-10-03.md) and [owner handoff](../../docs/TESTFLIGHT_OWNER_TODOS_2026-10-03.md).
