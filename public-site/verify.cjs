// Authoritative HTTP verification, independent of a successful GitHub publication.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'publication.json'),'utf8'));
assert.equal(manifest.baseUrl,'https://maxwellabgit.github.io');
(async()=>{
  const results=await Promise.all(manifest.files.filter(file=>file.path!=='.nojekyll').map(async file=>{
    const url=`${manifest.baseUrl}/${file.path}`;
    const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});
    assert.equal(response.status,200,`${url}: HTTP ${response.status}`);
    assert.equal(new URL(response.url).origin,manifest.baseUrl);
    const bytes=Buffer.from(await response.arrayBuffer());
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),file.sha256,`${url}: deployed content mismatch`);
    return {path:file.path,status:200,sha256:file.sha256};
  }));
  const proof={...manifest,status:'HTTPS_CONTENT_VERIFIED',verifiedAt:new Date().toISOString(),results};
  fs.writeFileSync(path.join(__dirname,'publication.json'),JSON.stringify(proof,null,2)+'\n');
  console.log(JSON.stringify({status:proof.status,baseUrl:proof.baseUrl,files:results.length,commit:proof.commit}));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
