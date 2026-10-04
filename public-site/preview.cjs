// Loopback-only preview of public files and reviewed deployment source.
const http=require('node:http'); const fs=require('node:fs'); const path=require('node:path');
const root=path.join(__dirname,'site');
const escaped=input=>input.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
http.createServer((req,res)=>{
  const target=new URL(req.url,'http://127.0.0.1:5180').pathname;
  if(target==='/deployment.html') {
    res.setHeader('content-type','text/html; charset=utf-8');
    res.end('<label>SQL source<textarea aria-label="SQL source" readonly>'+escaped(fs.readFileSync('.agent/guest-hosted-deployment/support.sql','utf8'))+'</textarea></label><label>Endpoint source<textarea aria-label="Endpoint source" readonly>'+escaped(fs.readFileSync('.agent/guest-hosted-deployment/endpoints/admin-api-support.js','utf8'))+'</textarea></label>');return;
  }
  const name=target==='/'?'index.html':target.slice(1);
  if(!/^[a-z.-]+$/.test(name)||!fs.existsSync(path.join(root,name))){res.writeHead(404);res.end('Not found');return;}
  res.setHeader('content-type',name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.js')?'text/javascript; charset=utf-8':name.endsWith('.css')?'text/css':'text/plain');
  res.end(fs.readFileSync(path.join(root,name)));
}).listen(5180,'127.0.0.1',()=>console.log('Public page preview http://127.0.0.1:5180'));
