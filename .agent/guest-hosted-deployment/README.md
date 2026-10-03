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
