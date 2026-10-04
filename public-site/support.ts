import { createClient } from '../mobile/node_modules/@supabase/supabase-js';
const project = 'https://jcrpxoojxixoieqqfgzo.supabase.co';
const publicKey = 'sb_publishable_vbGJyOe6WC1ZdsmvftxLfg_hXHmWdC8';
const client = createClient(project, publicKey);
const form = document.querySelector<HTMLFormElement>('#support-form')!;
const message = document.querySelector<HTMLTextAreaElement>('#message')!;
const category = document.querySelector<HTMLSelectElement>('#category')!;
const allowed = document.querySelector<HTMLInputElement>('#send-consent')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const requests = document.querySelector<HTMLDivElement>('#requests')!;
const refresh = document.querySelector<HTMLButtonElement>('#refresh')!;
const start = document.querySelector<HTMLButtonElement>('#start')!;
type Request = { id: string; message: string; reply: string | null };
let owner: string | null = null;
let epoch = 0;
let pending: { owner: string; id: string; message: string; category: string } | null = null;
let busy = false;
function setBusy(value: boolean) {
  busy=value;
  form.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement | HTMLSelectElement>('input,button,textarea,select').forEach(el=>el.disabled=value || !owner);
  refresh.disabled=value || !owner; start.disabled=value || !!owner;
}
const current = (subject: string, generation: number) => owner===subject && epoch===generation;
client.auth.onAuthStateChange((_event, session)=>{
  if(owner && session?.user.id!==owner) {
    owner=null; epoch++; pending=null; message.value=''; allowed.checked=false; requests.replaceChildren();
    setBusy(false); status.textContent='Connection changed. Open support again before writing. / जडान बदलियो। लेख्नुअघि सहायता फेरि खोल।';
  }
});
async function rpc<T>(subject: string, method: string, body: object = {}): Promise<T> {
  const session = await client.auth.getSession();
  if(session.error || session.data.session?.user.id!==subject) throw Error('identity_changed');
  // Capture the original owner's token; the SDK's mutable session never chooses an upload owner.
  const response=await fetch(`${project}/rest/v1/rpc/${method}`,{method:'POST',headers:{apikey:publicKey,Authorization:`Bearer ${session.data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!response.ok) throw Error('unavailable');
  return response.json();
}
async function list(subject: string, generation: number) {
  const rows=await rpc<Request[]>(subject,'support_list');
  if(!current(subject,generation))return;
  requests.replaceChildren();
  for(const row of rows) {
    const article=document.createElement('article'); const body=document.createElement('p'); body.textContent=row.message;
    const reply=document.createElement('p'); reply.textContent=row.reply ?? 'Awaiting a reply / जवाफको प्रतीक्षामा';
    const remove=document.createElement('button'); remove.type='button'; remove.textContent='Delete / मेटाऊ';
    remove.addEventListener('click',async()=>{
      if(busy || !current(subject,generation) || !confirm('Permanently delete this message and reply? / यो सन्देश र जवाफ सधैँका लागि मेटाउने?'))return;
      setBusy(true); remove.disabled=true;
      try { await rpc(subject,'support_delete',{p_id:row.id}); if(!current(subject,generation))return; article.remove(); status.textContent='Deleted / मेटाइयो'; }
      catch { if(current(subject,generation))status.textContent='Unable to delete. Try again when connected. / मेटाउन सकिएन। जडान भएपछि फेरि प्रयास गर।'; }
      finally { if(current(subject,generation)){setBusy(false);remove.disabled=false;} }
    });
    article.append(body,reply,remove); requests.append(article);
  }
}
start.addEventListener('click',async()=>{
  if(busy || owner)return;setBusy(true);const generation=epoch;
  try {
    const session=await client.auth.getSession();if(session.error)throw session.error;
    let subject=session.data.session?.user.id;
    if(!subject) {
      // Only explicit opening, before any editable draft exists, can create a fresh identity.
      const created=await client.auth.signInAnonymously();if(created.error || !created.data.user)throw Error('unavailable');subject=created.data.user.id;
    }
    if(epoch!==generation)return;owner=subject;
    status.textContent='Support ready / सहायता तयार';
    await list(subject,generation).catch(()=>{if(current(subject,generation))status.textContent='Support ready; replies unavailable. / सहायता तयार; जवाफ अहिले उपलब्ध छैन।';});
  }catch {if(epoch===generation)status.textContent='Unable to open support. Try again when connected. / सहायता खोल्न सकिएन। जडान भएपछि फेरि प्रयास गर।';}
  finally {if(epoch===generation)setBusy(false);}
});
form.addEventListener('submit',async event=>{
  event.preventDefault(); if(busy || !owner || !allowed.checked || !message.value.trim())return;
  const subject=owner,generation=epoch,text=message.value.trim();
  if(!pending || pending.owner!==subject || pending.message!==text || pending.category!==category.value)pending={owner:subject,id:crypto.randomUUID(),message:text,category:category.value};
  const payload={...pending};setBusy(true);status.textContent='Sending… / पठाउँदै…';
  try {
    await rpc(subject,'support_submit',{p_client_id:payload.id,p_message:payload.message,p_category:payload.category,p_app_version:'web-support-v1'});
    if(!current(subject,generation))return;
    message.value='';allowed.checked=false;pending=null;status.textContent='Sent. Check replies here. / पठाइयो। यहाँ जवाफ हेर।';
    await list(subject,generation).catch(()=>undefined);
  }catch {if(current(subject,generation))status.textContent='Not confirmed. Your message is still here; retry when connected. / पुष्टि भएन। सन्देश यहीँ छ; जडान भएपछि फेरि प्रयास गर।';}
  finally {if(current(subject,generation))setBusy(false);}
});
refresh.addEventListener('click',async()=>{
  if(busy || !owner)return;const subject=owner,generation=epoch;setBusy(true);
  try{await list(subject,generation);if(current(subject,generation))status.textContent='Replies updated / जवाफ अद्यावधिक गरियो';}
  catch{if(current(subject,generation))status.textContent='Unable to check replies. Try again when connected. / जवाफ हेर्न सकिएन। जडान भएपछि फेरि प्रयास गर।';}
  finally{if(current(subject,generation))setBusy(false);}
});
setBusy(false);
