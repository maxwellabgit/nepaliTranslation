const fs = require('fs');
const crypto = require('crypto');
const version = '20261003003000';
const name = 'guest_deletion_dispatch';
const path = `supabase/migrations/${version}_${name}.sql`;
const raw = fs.readFileSync(path);
const source = raw.toString('utf8').replaceAll('\r\n', '\n');
const sql = `begin;
do $dispatch_apply$ begin
if not exists (select 1 from supabase_migrations.schema_migrations where version='${version}') then
execute $dispatch_source$${source}$dispatch_source$;
insert into supabase_migrations.schema_migrations(version,name,statements) values ('${version}','${name}',array[$dispatch_source$${source}$dispatch_source$]);
end if; end $dispatch_apply$;
select version,name from supabase_migrations.schema_migrations where version='${version}';
commit;
`;
fs.writeFileSync('.agent/guest-hosted-deployment/dispatch.sql', sql);
fs.writeFileSync('.agent/guest-hosted-deployment/dispatch-manifest.json', JSON.stringify({ version, path, sourceSha: '9504fcddd6de2b56405913b5afbb65a979eddfaa', sha256: crypto.createHash('sha256').update(raw).digest('hex') }, null, 2) + '\n');
const htmlPath = 'testing-ground/public/guest-deployment-review.html';
if (fs.existsSync(htmlPath)) {
  let html = fs.readFileSync(htmlPath, 'utf8');
  html += '<h2>Immediate deletion dispatch</h2><textarea id=dispatch>' + sql.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;') + '</textarea>';
  fs.writeFileSync(htmlPath, html);
}
