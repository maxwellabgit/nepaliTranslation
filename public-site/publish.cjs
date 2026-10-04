// Run only after owner approval of the public copy and this exact destination.
// GitHub CLI supplies its existing authentication; credentials are never read or printed.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const os = require('node:os');
const destination = 'maxwellabgit/maxwellabgit.github.io';
if (process.argv[2] !== '--owner-approved') throw Error('Owner approval required before publication');
const files = ['.nojekyll','app-ads.txt','deletion.html','index.html','privacy.html','robots.txt','style.css','support.html','support.js','terms.html'];
const root = path.join(__dirname,'site');
const actual = fs.readdirSync(root).sort();
if (JSON.stringify(actual)!==JSON.stringify([...files].sort())) throw Error('Public file allowlist mismatch');
const entries = files.map(name=>({path:name,mode:'100644',type:'blob',content:fs.readFileSync(path.join(root,name),'utf8')}));
if(entries.some(file=>/sb_secret_[A-Za-z0-9]{8,}|service_role["']\s*[:=]\s*["'][^"']+/.test(file.content))) throw Error('Secret marker in public asset');
if(entries.find(file=>file.path==='app-ads.txt').content!=='google.com, pub-4740685179017246, DIRECT, f08c47fec0942fa0\n') throw Error('Publisher mismatch');
function api(route,method='GET',body) {
  const args=['api',route,'--method',method];
  let temporary;
  try {
    if(body!==undefined){temporary=path.join(os.tmpdir(),`bola-public-${crypto.randomUUID()}.json`);fs.writeFileSync(temporary,JSON.stringify(body));args.push('--input',temporary);}
    const value=execFileSync('gh',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});return value.trim()?JSON.parse(value):null;
  }finally{if(temporary)fs.unlinkSync(temporary);}
}
if(api('user').login!=='maxwellabgit')throw Error('Unexpected GitHub publisher');
let repository;
try{repository=api(`repos/${destination}`);}catch(error){
  if(!String(error.stderr).includes('HTTP 404'))throw error;
  repository=api('user/repos','POST',{name:'maxwellabgit.github.io',description:'Bola public policies and private support entry',private:false,auto_init:true});
}
if(repository.private || repository.default_branch!=='main')throw Error('Unexpected destination settings');
let pages;
try{pages=api(`repos/${destination}/pages`);}catch(error){if(!String(error.stderr).includes('HTTP 404'))throw error;}
if(pages && (pages.build_type!=='legacy' || pages.source?.branch!=='main' || pages.source?.path!=='/'))throw Error('Unexpected Pages source; inspect before publication');
const ref=api(`repos/${destination}/git/ref/heads/main`);
const previous=api(`repos/${destination}/git/commits/${ref.object.sha}`);
const tree=api(`repos/${destination}/git/trees/${previous.tree.sha}?recursive=1`);
if(tree.truncated || tree.tree.some(item=>item.type==='blob' && !files.includes(item.path) && item.path!=='README.md'))throw Error('Destination contains unrelated content; inspect before updating');
const nextTree=api(`repos/${destination}/git/trees`,'POST',{base_tree:previous.tree.sha,tree:entries});
const commit=api(`repos/${destination}/git/commits`,'POST',{message:'Publish reviewed Bola policy and support pages',tree:nextTree.sha,parents:[ref.object.sha]});
api(`repos/${destination}/git/refs/heads/main`,'PATCH',{sha:commit.sha,force:false});
if(!pages){
  api(`repos/${destination}/pages`,'POST',{build_type:'legacy',source:{branch:'main',path:'/'}});
}
const manifest={destination,commit:commit.sha,baseUrl:'https://maxwellabgit.github.io',status:'PUBLISHED_AWAITING_HTTP_VERIFICATION',files:entries.map(file=>({path:file.path,sha256:crypto.createHash('sha256').update(file.content).digest('hex')}))};
fs.writeFileSync(path.join(__dirname,'publication.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({destination,commit:commit.sha,status:manifest.status}));
