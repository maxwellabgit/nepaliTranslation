// Run only for the owner-approved synthetic support test; no real user data.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const project = 'https://jcrpxoojxixoieqqfgzo.supabase.co';
const key = 'sb_publishable_vbGJyOe6WC1ZdsmvftxLfg_hXHmWdC8';
assert.equal(process.argv[2], '--approved-support-test');
async function call(path, owner, body) {
  const response=await fetch(project+path,{method:body===undefined?'GET':'POST',headers:{apikey:key,'content-type':'application/json',...(owner?{authorization:`Bearer ${owner.token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:response.status,data:await response.json()};
}
function ok(result) {assert.equal(result.status,200,`Expected success, got HTTP ${result.status}`);return result.data;}
const identities=[]; let requestId;
try {
  for(let index=0;index<2;index++) {
    const response=await call('/auth/v1/signup',null,{data:{engineering_proof:'synthetic-support'}});
    assert.ok([200,201].includes(response.status));assert.equal(response.data.user.is_anonymous,true);
    identities.push({id:response.data.user.id,token:response.data.access_token});
  }
  const [owner,other]=identities;
  const payload={p_client_id:randomUUID(),p_message:'[SYNTHETIC] private support ownership and retry proof; no personal data',p_category:'general',p_app_version:'support-proof-v1'};
  requestId=ok(await call('/rest/v1/rpc/support_submit',owner,payload)).id;
  assert.ok(requestId);
  assert.equal(ok(await call('/rest/v1/rpc/support_submit',owner,{...payload,p_app_version:'support-proof-v2'})).id,requestId,'Original owner retry preserves request');
  const own=ok(await call('/rest/v1/rpc/support_list',owner,{}));assert.equal(own.length,1);assert.equal(own[0].id,requestId);
  assert.deepEqual(ok(await call('/rest/v1/rpc/support_list',other,{})),[]);
  ok(await call('/rest/v1/rpc/support_delete',other,{p_id:requestId}));
  assert.equal(ok(await call('/rest/v1/rpc/support_list',owner,{})).length,1,'Cross-owner delete cannot remove original');
  const guestAdmin=await call('/functions/v1/admin-api/support',owner);
  assert.equal(guestAdmin.status,403);assert.equal(guestAdmin.data.error.code,'forbidden');
  const noIdentity=await call('/rest/v1/rpc/support_list',null,{});assert.ok([401,403].includes(noIdentity.status));
  ok(await call('/rest/v1/rpc/support_delete',owner,{p_id:requestId}));
  assert.deepEqual(ok(await call('/rest/v1/rpc/support_list',owner,{})),[],'Owner deletion really removes request');requestId=null;
  const retained=ok(await call('/auth/v1/user',owner));assert.equal(retained.id,owner.id);
  const config=ok(await call('/rest/v1/app_config?select=contribution_text_enabled,contribution_speech_enabled,contribution_photos_enabled,public_review_enabled',owner))[0];
  assert.deepEqual(config,{contribution_text_enabled:false,contribution_speech_enabled:false,contribution_photos_enabled:false,public_review_enabled:false},'All four collection fields are present and off');
  console.log(JSON.stringify({status:'PASS',proof:'owner-bound support retry/list/delete, cross-owner isolation, guest admin403, no-identity denial, guest identity retained, collection flags off',timestamp:new Date().toISOString()}));
} finally {
  if(requestId && identities[0]) {
    const removed=await call('/rest/v1/rpc/support_delete',identities[0],{p_id:requestId});
    assert.equal(removed.status,200,'Synthetic cleanup failed; do not claim deletion');
    assert.deepEqual(ok(await call('/rest/v1/rpc/support_list',identities[0],{})),[],'Synthetic cleanup not proven');
  }
  // No credentials persist. Synthetic identities remain private; this test deletes messages only.
}
