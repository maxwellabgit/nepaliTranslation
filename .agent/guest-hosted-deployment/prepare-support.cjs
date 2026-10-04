const fs = require('node:fs');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const esbuild = require('../../testing-ground/node_modules/esbuild');
const sourceSha = '6f30ccfcab48c7ce62ff2127c2819de2f0a8cfed';
const version = '20261004020000'; const name = 'private_support';
const paths = [`supabase/migrations/${version}_${name}.sql`, 'supabase/functions/admin-api/index.ts','supabase/functions/admin-api/router.ts','supabase/functions/_shared/http.ts'];
const hash = input => crypto.createHash('sha256').update(input).digest('hex');
for (const path of paths) { const committed = spawnSync('git',['show',`${sourceSha}:${path}`],{encoding:'utf8'});
  if(committed.status !== 0 || committed.stdout.replaceAll('\r\n','\n') !== fs.readFileSync(path,'utf8').replaceAll('\r\n','\n'))throw Error(`Source changed: ${path}`);
}
const source=fs.readFileSync(paths[0],'utf8').replaceAll('\r\n','\n');
const sql=`begin;
do $support_apply$ begin
if not exists(select 1 from supabase_migrations.schema_migrations where version='${version}') then
execute $support_source$${source}$support_source$;
insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array[$support_source$${source}$support_source$]);
end if; end $support_apply$;
select version,name from supabase_migrations.schema_migrations where version='${version}';
commit;\n`;
const bundle=esbuild.buildSync({entryPoints:['supabase/functions/admin-api/index.ts'],bundle:true,platform:'neutral',format:'esm',tsconfigRaw:{},write:false}).outputFiles[0].text;
fs.writeFileSync('.agent/guest-hosted-deployment/support.sql',sql);
fs.writeFileSync('.agent/guest-hosted-deployment/endpoints/admin-api-support.js',bundle);
fs.writeFileSync('.agent/guest-hosted-deployment/support-manifest.json',JSON.stringify({sourceSha,version,esbuild:esbuild.version,sqlSha256:hash(sql),endpointSha256:hash(bundle),status:'PREPARED_NOT_DEPLOYED'},null,2)+'\n');
console.log('Prepared reviewed support SQL/admin-api package and hashes. Not deployed.');
