const get = id => document.getElementById(id);
let verifiedPacket = null;
function canonical(value) {
  if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(typeof value==='object'&&value!==null)return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  throw Error('Unsupported JSON content');
}
function clear(){verifiedPacket=null;get('packet').hidden=true;get('download').disabled=true;get('documents').replaceChildren();}
function status(text,error=false){get('status').textContent=text;get('status').classList.toggle('error',error);}
function text(id,value){get(id).textContent=String(value);}
function sourceLink(url,domain,label){
  const parsed=new URL(url);
  if(parsed.protocol!=='https:'||parsed.username||parsed.password||!(parsed.hostname===domain||parsed.hostname.endsWith('.'+domain)))throw Error('Unexpected source link');
  const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=label;return a;
}
async function inspect(raw){
  clear();
  try{
    if(raw.length>1024*1024)throw Error('Packet exceeds 1 MiB');
    const bundle=JSON.parse(raw), p=bundle.payload;
    if(!p||p.schema!=='regledger-dossier/1'||!Array.isArray(p.register?.documents)||p.register.documents.length>3)throw Error('Unknown or malformed packet');
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(p)))),x=>x.toString(16).padStart(2,'0')).join('');
    if(hash!==bundle.payloadSha256)throw Error('Packet hash mismatch: content changed or export is damaged');
    if(p.chain?.chainId!=='1'||p.chain.contractAddress?.toLowerCase()!=='0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'||typeof p.chain.paused!=='boolean')throw Error('Unexpected chain or token state');
    const fragment=document.createDocumentFragment();
    for(const doc of p.register.documents){
      const row=document.createElement('article');row.className='document';
      const meta=document.createElement('div');meta.textContent=doc.document_number;
      const type=document.createElement('span');type.className='type';type.textContent=doc.type;meta.append(type);
      const content=document.createElement('div'), title=document.createElement('div');title.className='title';title.textContent=doc.title;
      const date=document.createElement('p');date.textContent='Published '+doc.publication_date+' · Applicability review required';
      content.append(title,date,sourceLink(doc.html_url,'federalregister.gov','Publication metadata ↗'),sourceLink(doc.pdf_url,'govinfo.gov','Official PDF ↗'));
      row.append(meta,content);fragment.append(row);
    }
    get('documents').append(fragment);
    text('observed',new Date(p.observedAtUtc).toISOString().slice(0,19).replace('T',' ')+' UTC');text('paused',p.chain.paused?'Paused at recorded block':'Not paused at recorded block');
    text('priority',p.chain.paused?'Urgent operational review':'Regulatory source review remains open');
    text('block',Number(p.chain.blockNumber).toLocaleString('en-US'));text('block-time',p.chain.blockTimeUtc);
    text('contract',p.chain.contractAddress);text('block-hash',p.chain.blockHash);text('packet-hash',hash);text('response-hash',p.register.responseSha256);
    text('source-scope',p.sourceScope);text('connection',p.review.connection);text('assurance',p.assurance);
    verifiedPacket=bundle;get('packet').hidden=false;get('download').disabled=false;
    status('Packet content verified. '+p.register.documents.length+' publication records and one finalized-block observation are ready for review. This hash does not authenticate the author or prove how the data was collected.');
  }catch(error){clear();status(error.message,true);}
}
get('load-example').addEventListener('click',async()=>{
  clear();status('Loading captured public evidence…');
  try{const response=await fetch('dossier-example.json',{cache:'no-store'});if(!response.ok)throw Error('Example unavailable');await inspect(await response.text());}catch(error){clear();status(error.message,true);}
});
get('packet-file').addEventListener('change',async event=>{const file=event.target.files[0];if(file?.size>1024*1024){clear();status('Packet exceeds 1 MiB',true);}else if(file)await inspect(await file.text());});
get('download').addEventListener('click',()=>{
  if(!verifiedPacket)return;
  const url=URL.createObjectURL(new Blob([canonical(verifiedPacket)+'\n'],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='regledger-'+verifiedPacket.payloadSha256.slice(0,12)+'.json';a.click();URL.revokeObjectURL(url);
});
