// Reproducible, credential-free C5 deployment package. Does not deploy.
const fs = require('fs');
const crypto = require('crypto');
const esbuild = require('../../testing-ground/node_modules/esbuild');
const { spawnSync } = require('child_process');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sourceSha = '1ff2a780233516950e52aa82708886c96f94bc81';
const version = '20261003180000';
const name = 'admin_contribution_export';
const path = `supabase/migrations/${version}_${name}.sql`;
const raw = fs.readFileSync(path);
const source = raw.toString('utf8').replaceAll('\r\n', '\n');
const root = '.agent/guest-hosted-deployment';
const files = [path, 'supabase/functions/admin-api/index.ts', 'supabase/functions/admin-api/router.ts',
  'supabase/functions/_shared/http.ts'];
for (const path of files) {
  const committed = spawnSync('git', ['show', `${sourceSha}:${path}`], { encoding: 'utf8' });
  if (committed.status !== 0 || committed.stdout.replaceAll('\r\n', '\n') !== fs.readFileSync(path, 'utf8').replaceAll('\r\n', '\n')) {
    throw Error(`Source no longer matches reviewed candidate: ${path}`);
  }
}
const apply = `begin;
do $c5_apply$ begin
if not exists (select 1 from supabase_migrations.schema_migrations where version='${version}') then
execute $c5_source$${source}$c5_source$;
insert into supabase_migrations.schema_migrations(version,name,statements) values ('${version}','${name}',array[$c5_source$${source}$c5_source$]);
end if; end $c5_apply$;
select version,name from supabase_migrations.schema_migrations where version='${version}';
commit;
`;
fs.writeFileSync(`${root}/contribution-export.sql`, apply);
const bundle = esbuild.buildSync({ entryPoints: ['supabase/functions/admin-api/index.ts'], bundle: true,
  platform: 'neutral', format: 'esm', tsconfigRaw: {}, write: false }).outputFiles[0].text;
fs.writeFileSync(`${root}/endpoints/admin-api.js`, bundle);
fs.writeFileSync(`${root}/contribution-export-manifest.json`, JSON.stringify({
  sourceSha, version, esbuild: esbuild.version,
  files: files.map(path => ({ path, sha256: sha(fs.readFileSync(path)) })),
  sql: { path: `${root}/contribution-export.sql`, sha256: sha(apply) },
  endpoint: { name: 'admin-api', path: `${root}/endpoints/admin-api.js`, sha256: sha(bundle) },
  hostedStatus: 'PREPARED_NOT_DEPLOYED',
}, null, 2) + '\n');
console.log('Prepared credential-free C5 SQL, admin-api bundle and hashes; no hosted mutation.');
