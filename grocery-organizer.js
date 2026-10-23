'use strict';
/* Private saved grocery workspace. No finance ledger/table writes. */
(function(){
 const G=window.GroceryPlanner,TABLE='finance_grocery_state';
 let userId='',workspace='personal',revision=0,ready=false,loading=false,saving=false,changed=false,timer,epoch=0;
 let saved={aliases:{},history:[],excluded:[],checks:{},cost:0},draft=[],ignored=[],batch='',ocrBusy=false,committed='';
 const originalRender=render,originalValidOffers=validOffers;
 validOffers=function(item){return originalValidOffers(item).filter(o=>!saved.excluded.includes(o.key));};
 const key=()=>`grocery-draft-v1:${userId}:${workspace}`;
 const payload=()=>({...saved,items,version:1,cost:Number(el('storeCost').value)||0});
 const status=message=>el('grocerySaveStatus').textContent=message;
 const lock=flag=>{document.querySelectorAll('main>.grid,#receiptImport,#shopPlan,#usualGroceries,#matchMemory').forEach(n=>n.classList.toggle('groceryLocked',flag));el('groceryWorkspace').disabled=flag;};
 function localDraft(){try{localStorage.setItem(key(),JSON.stringify({revision,payload:payload(),pending:changed}));}catch(_){status('Browser storage full. Keep this page open and save to cloud.');}}
 function markChanged(){if(!ready||JSON.stringify(payload())===committed)return;changed=true;localDraft();status('Changes pending…');clearTimeout(timer);timer=setTimeout(save,700);}
 function normalizeState(value){return {aliases:value?.aliases&&typeof value.aliases==='object'?value.aliases:{},history:Array.isArray(value?.history)?value.history:[],excluded:Array.isArray(value?.excluded)?value.excluded:[],checks:value?.checks&&typeof value.checks==='object'?value.checks:{},cost:Math.max(0,Number(value?.cost)||0)};}
 async function save(){
  if(!ready||saving||!changed)return;
  saving=true;clearTimeout(timer);const currentEpoch=epoch,snapshot=JSON.stringify(payload());changed=false;status('Saving groceries…');
  try{
   const row={user_id:userId,workspace_id:workspace,payload:JSON.parse(snapshot),revision:revision+1,updated_at:new Date().toISOString()};
   const q=revision===0?client.from(TABLE).insert(row):client.from(TABLE).update(row).eq('user_id',userId).eq('workspace_id',workspace).eq('revision',revision);
   const {data,error}=await q.select('revision');if(error)throw error;
   if(!data?.length)throw Error('This list changed on another device. Reload before editing further; your draft is kept on this device.');
   if(currentEpoch!==epoch)return;revision=data[0].revision;committed=snapshot;changed=JSON.stringify(payload())!==snapshot;localDraft();status(changed?'More changes pending…':'Saved privately · '+new Date().toLocaleTimeString('en-GB'));
  }catch(error){changed=true;localDraft();status('Not saved: '+error.message);}
  finally{saving=false;if(changed&&currentEpoch===epoch&&el('grocerySaveStatus').textContent.startsWith('More changes'))timer=setTimeout(save,700);}
 }
 async function loadWorkspace(next){
  if(loading)return;
  if(ocrBusy)return status('Finish receipt reading before switching workspace.');
  if(changed){await save();if(changed){el('groceryWorkspace').value=workspace;return;}}
  loading=true;ready=false;lock(true);epoch++;requestVersion++;workspace=next;selected=null;status('Loading private grocery list…');
  try{
   const {data,error}=await client.from(TABLE).select('payload,revision').eq('user_id',userId).eq('workspace_id',workspace).maybeSingle();if(error)throw error;
   let value=data?.payload||{};revision=data?.revision||0;let recovery;
   try{recovery=JSON.parse(localStorage.getItem(key())||'null');}catch(_){}
   if(recovery?.pending&&recovery.revision===revision){value=recovery.payload;changed=true;}
   else {changed=false;if(recovery?.pending){try{localStorage.setItem(key()+':recovery:'+Date.now(),JSON.stringify(recovery));}catch(_){}status('A newer cloud list exists. Your older pending draft is retained on this device.');}}
   saved=normalizeState(value);items=Array.isArray(value.items)?value.items.map(i=>({...i,offers:Array.isArray(i.offers)?i.offers:[]})):[];
   el('storeCost').value=saved.cost;draft=[];ignored=[];el('receiptText').value='';el('receiptShop').value='';el('receiptReview').innerHTML='';el('receiptFile').value='';el('receiptPreview').hidden=true;if(receiptUrl){URL.revokeObjectURL(receiptUrl);receiptUrl='';}
   committed=changed?'':JSON.stringify(payload());ready=true;choose(items[0]?.id||null);if(changed)markChanged();else status('Private list loaded · '+items.length+' items');
  }catch(error){status('Could not load saved groceries: '+error.message+'. Use Save / retry.');}
  finally{loading=false;lock(!ready);}
 }
 function remember(item){
  if(!item.product)return;
  const aliasKey=G.alias(item.receiptShop||'',item.receiptName||item.name,item.basis);
  const previous=saved.aliases[aliasKey];
  if(previous?.product?.id===item.product.id)return;
  saved.aliases[aliasKey]={shop:item.receiptShop||'',name:item.receiptName||item.name,basis:item.basis,product:item.product,confirmedAt:new Date().toISOString()};
 }
 function draw(){
  const shops=new Map();items.forEach(i=>(i.offers||[]).forEach(o=>shops.set(o.key,o.store)));
  const currentFilter=el('shopFilter').value,plan=G.plan(items,saved.excluded,el('storeCost').value);
  el('shopFilter').innerHTML='<option value="">All recommended shops</option>'+plan.groups.map(g=>'<option value="'+esc(g.key)+'">'+esc(g.name)+' · '+g.rows.length+' items</option>').join('');el('shopFilter').value=plan.groups.some(g=>g.key===currentFilter)?currentFilter:'';
  el('shopChoices').innerHTML=shops.size?[...shops].map(([key,name])=>'<label><input type="checkbox" data-shop-enable="'+esc(key)+'" '+(!saved.excluded.includes(key)?'checked':'')+'> '+esc(name)+'</label>').join(''):'<p class="muted">Shops appear after prices are fetched or a verified price is added.</p>';
  el('shopChoices').querySelectorAll('[data-shop-enable]').forEach(input=>input.onchange=()=>{saved.excluded=saved.excluded.filter(x=>x!==input.dataset.shopEnable);if(!input.checked)saved.excluded.push(input.dataset.shopEnable);draw();markChanged();});
  const groups=plan.groups.filter(g=>!el('shopFilter').value||g.key===el('shopFilter').value);
  el('shopPlan').innerHTML=groups.length?groups.map(g=>'<section class="shopGroup"><h3>'+esc(g.name)+' · '+g.rows.length+' items · '+sar(g.total)+'</h3>'+g.rows.map(({item,offer,total,saving})=>{const checkKey=item.id+'|'+offer.key;return '<div class="shopLine '+(saved.checks[checkKey]?'done':'')+'"><input type="checkbox" aria-label="Bought '+esc(item.name)+'" data-bought="'+esc(checkKey)+'" '+(saved.checks[checkKey]?'checked':'')+'><span><b>'+esc(item.product?.name||item.name)+'</b><small>'+item.qty+(item.basis==='kg'?' kg':' packs/items')+' × '+sar(offer.price)+' · '+(offer.manual?'Manual':'Muwazin')+' · checked '+esc(new Date(offer.checkedAt||offer.updatedAt).toLocaleDateString('en-GB'))+'</small></span><b>'+sar(total)+'</b><small class="'+(saving<0?'red':'green')+'">'+savingLabel(saving)+'</small><button data-unavailable="'+esc(item.id)+'" data-branch="'+esc(offer.key)+'">Unavailable here</button></div>';}).join('')+'</section>').join(''):'<p class="muted">Match your products and fetch current prices to build your shop checklists.</p>';
  el('shopPlan').querySelectorAll('[data-bought]').forEach(input=>input.onchange=()=>{saved.checks[input.dataset.bought]=input.checked;markChanged();draw();});
  el('shopPlan').querySelectorAll('[data-unavailable]').forEach(button=>button.onclick=()=>{const item=items.find(i=>i.id===button.dataset.unavailable);if(item)item.offers=item.offers.map(o=>o.key===button.dataset.branch?{...o,inStock:false}:o);render();});
  const wanted=items.filter(i=>i.wanted!==false).length,matched=plan.groups.reduce((n,g)=>n+g.rows.length,0);
  el('planCoverage').textContent=matched+' of '+wanted+' items priced · products '+sar(plan.productsTotal)+' · including shop costs '+sar(plan.total)+' · '+savingLabel(plan.saving)+' versus recorded paid prices (matched items only).'+(plan.missing.length?' Needs matching or fresh prices: '+plan.missing.map(i=>i.name).join(', '):'')+(items.some(i=>i.priceCheck?.partial)?' Some provider results are incomplete.':'')+' Prices are the lowest fetched eligible offers; travel costs are added afterwards.';
  const usual=new Map();saved.history.flatMap(h=>h.items||[]).forEach(i=>{const k=G.alias(i.receiptShop||'',i.receiptName||i.name,i.basis);if(!usual.has(k))usual.set(k,{item:i,count:0});usual.get(k).count++;usual.get(k).item={...i,product:i.product||saved.aliases[k]?.product||null};});items.forEach(i=>{const k=G.alias(i.receiptShop||'',i.receiptName||i.name,i.basis);const entry=usual.get(k)||{count:1};entry.item=i;usual.set(k,entry);});
  el('usualGroceries').innerHTML=[...usual.values()].map(({item,count},n)=>'<div class="offer"><b>'+esc(item.product?.name||item.name)+'</b> · '+count+' recorded entries <button data-usual="'+n+'">Add to current list</button></div>').join('')||'<p class="muted">Your approved receipt items will appear here.</p>';
  el('usualGroceries').querySelectorAll('[data-usual]').forEach(b=>b.onclick=()=>{const source=[...usual.values()][Number(b.dataset.usual)].item;if(items.some(i=>G.alias(i.receiptShop||'',i.receiptName||i.name,i.basis)===G.alias(source.receiptShop||'',source.receiptName||source.name,source.basis)))return notify('This item is already in your current list. Use Edit to change its quantity.');const item={...source,id:crypto.randomUUID(),offers:[],priceCheck:null};items.push(item);choose(item.id);});
  el('receiptHistory').innerHTML=saved.history.map(h=>'<div class="offer"><b>'+esc(h.shop)+'</b> · '+esc(h.date)+' · '+h.items.length+' approved items · '+sar(h.items.reduce((n,i)=>n+i.paid*i.qty,0))+'</div>').join('')||'<p class="muted">No receipts saved yet.</p>';
  const aliases=Object.entries(saved.aliases);el('matchMemory').innerHTML='<h3>Approved product matches</h3>'+aliases.map(([key,a],n)=>'<div class="offer">'+esc(a.shop||'Manual list')+' · '+esc(a.name)+' → '+esc(a.product.name)+' <button data-forget="'+n+'">Forget match</button></div>').join('');
  el('matchMemory').querySelectorAll('[data-forget]').forEach(b=>b.onclick=()=>{delete saved.aliases[aliases[Number(b.dataset.forget)][0]];draw();markChanged();});
 }
 render=function(){originalRender();if(ready){draw();markChanged();}};
 const baseLoadProduct=loadProduct;loadProduct=async function(item,product){await baseLoadProduct(item,product);if(ready&&item.product===product){remember(item);draw();markChanged();}};
 // Restore and informational navigation should not cause an unnecessary cloud save.
 const chooseBase=choose;choose=function(id){const before=JSON.stringify(payload());chooseBase(id);if(ready&&before===JSON.stringify(payload())){clearTimeout(timer);/* Existing pending changes are saved explicitly or by the next edit. */if(changed)timer=setTimeout(save,700);}};
 const baseItemSubmit=el('itemForm').onsubmit;el('itemForm').onsubmit=event=>{if(!ready){event.preventDefault();return;}const oldSize=items.length;baseItemSubmit(event);if(items.length>oldSize){const item=items[items.length-1],a=saved.aliases[G.alias('',item.name,item.basis)];if(a){item.product=a.product;render();notify('Remembered product match loaded. Refresh prices before using it.');}}};
 function review(){
  el('receiptReview').innerHTML=draft.map((r,n)=>'<div class="reviewLine"><input type="checkbox" aria-label="Approve item '+(n+1)+'" data-review="'+n+'" data-field="reviewed" '+(r.reviewed?'checked':'')+'><input aria-label="Product" class="reviewName" data-review="'+n+'" data-field="name" value="'+esc(r.name)+'"><input aria-label="Quantity" class="reviewNumber" type="number" min="0.001" step="0.001" data-review="'+n+'" data-field="qty" value="'+r.qty+'"><select aria-label="Price basis" data-review="'+n+'" data-field="basis"><option value="item" '+(r.basis==='item'?'selected':'')+'>Pack/item</option><option value="kg" '+(r.basis==='kg'?'selected':'')+'>Per kg</option></select><input aria-label="Paid each SAR" class="reviewNumber" type="number" min="0" step="0.01" data-review="'+n+'" data-field="paid" value="'+r.paid+'"></div>').join('');
  el('receiptReview').querySelectorAll('[data-review]').forEach(input=>input.onchange=()=>{const r=draft[Number(input.dataset.review)],field=input.dataset.field;r[field]=field==='reviewed'?input.checked:['qty','paid'].includes(field)?Number(input.value):input.value;});
  if(ignored.length){const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Unrecognized / summary lines · '+ignored.length+' (check for missed items)';const pre=document.createElement('pre');pre.style.whiteSpace='pre-wrap';pre.textContent=ignored.join('\n');details.append(summary,pre);el('receiptReview').append(details);}
 }
 el('parseReceipt').onclick=()=>{const result=G.parseReceipt(el('receiptText').value);draft=result.rows;ignored=result.ignored;batch=G.normalize(el('receiptShop').value)+'|'+el('receiptDate').value+'|'+G.normalize(el('receiptText').value);review();el('receiptStatus').textContent=draft.length+' possible items. Correct and check each item you approve; totals/discounts and uncertain lines are listed separately.';};
 el('addReceiptRow').onclick=()=>{draft.push({name:'',qty:1,paid:0,basis:'item',reviewed:false});review();};
 el('confirmReceipt').onclick=()=>{
  if(!ready)return;const shop=el('receiptShop').value.trim(),date=el('receiptDate').value,approved=draft.filter(r=>r.reviewed);
  if(!shop||!date||!approved.length)return notify('Enter the receipt shop and date, then approve at least one reviewed item.');
  if(approved.some(r=>!r.name.trim()||!Number.isFinite(r.qty)||r.qty<=0||!Number.isFinite(r.paid)||r.paid<0||(r.basis==='item'&&!Number.isInteger(r.qty))))return notify('Check approved item names, quantities, units and prices.');
  const fingerprint=G.normalize(el('receiptText').value)?JSON.stringify([G.normalize(shop),date,G.normalize(el('receiptText').value)]):JSON.stringify([shop,date,approved]);if(saved.history.some(h=>h.fingerprint===fingerprint))return notify('This receipt was already saved. It has not been added again.');
  const added=approved.map(r=>{const aliasKey=G.alias(shop,r.name,r.basis),memory=saved.aliases[aliasKey];return {id:crypto.randomUUID(),name:r.name.trim(),receiptName:r.name.trim(),receiptShop:shop,qty:r.qty,paid:r.paid,basis:r.basis,offers:[],product:memory?.product||null,receiptDate:date};});
  saved.history.push({id:crypto.randomUUID(),shop,date,fingerprint,items:added.map(i=>({...i,offers:[]})),savedAt:new Date().toISOString()});for(const item of added){const existing=items.find(i=>(item.product?.id&&i.product?.id===item.product.id&&i.basis===item.basis)||G.alias(i.receiptShop||'',i.receiptName||i.name,i.basis)===G.alias(item.receiptShop,item.receiptName,item.basis));if(existing){const offers=existing.product?.id===item.product?.id?existing.offers:[];Object.assign(existing,{...item,id:existing.id,offers});}else items.push(item);}draft=[];ignored=[];batch='';review();render();notify('Saved '+added.length+' approved items. Confirm product matches, then refresh prices.');
 };
 async function loadOcr(){if(window.Tesseract)return;await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';script.onload=resolve;script.onerror=()=>reject(Error('Receipt reader could not download. You can paste the text instead.'));document.head.append(script);});}
 el('readReceipt').onclick=async()=>{const file=el('receiptFile').files?.[0];if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>15*1024*1024)return notify('Choose a JPG, PNG or WebP receipt image up to 15 MB.');if(ocrBusy)return;ocrBusy=true;el('readReceipt').disabled=true;let worker;
  try{el('receiptStatus').textContent='Loading receipt reader. First use downloads language data…';await loadOcr();worker=await window.Tesseract.createWorker(el('receiptLanguage').value,1,{logger:m=>{if(m.status)el('receiptStatus').textContent=m.status+' '+Math.round((m.progress||0)*100)+'%';}});const result=await worker.recognize(file);el('receiptText').value=result.data.text;el('parseReceipt').click();}
  catch(error){el('receiptStatus').textContent=error.message+' Paste receipt text or add items manually.';}finally{if(worker)await worker.terminate();ocrBusy=false;el('readReceipt').disabled=false;}
 };
 el('shopFilter').onchange=draw;el('storeCost').oninput=()=>{render();};
 el('refreshUsualPrices').onclick=async()=>{
  if(!ready||!items.length)return notify('Add receipt items or usual groceries first.');
  if(!confirm('Compare '+items.length+' items? Confirmed matches fetch prices; unmatched items search for suggestions. This uses your Muwazin evaluation allowance.'))return;
  const currentEpoch=epoch;el('refreshUsualPrices').disabled=true;el('batchMatches').innerHTML='';let failures=0;
  try{for(const item of [...items]){
   if(epoch!==currentEpoch)break;
   if(item.product){choose(item.id);await loadProduct(item,item.product);continue;}
   try{const result=await api({action:'search',q:item.name.slice(0,120)});if(epoch!==currentEpoch)break;
    const products=result.products.sort((a,b)=>searchScore(b,item.name)-searchScore(a,item.name));
    const box=document.createElement('div');box.className='product';const title=document.createElement('b');title.textContent=item.name+' — review product match';box.append(title);
    if(!products.length){const text=document.createElement('p');text.textContent='No match found. Edit the search name or add a verified manual price.';box.append(text);}
    products.slice(0,5).forEach(product=>{const button=document.createElement('button');button.type='button';button.textContent=product.name+' · '+(product.size||'check size');button.onclick=async()=>{choose(item.id);await loadProduct(item,product);if(item.product?.id===product.id){box.remove();render();}};box.append(button);});el('batchMatches').append(box);
   }catch(error){failures++;notify(error.message);}
  }notify('Comparison finished. '+(failures?failures+' searches failed; retry them. ':'')+'Review suggestions below; no uncertain product has been chosen automatically.');}
  finally{el('refreshUsualPrices').disabled=false;draw();}
 };
 // Correct a saved line without losing approved matching/history.
 const originalDraw=draw;draw=function(){originalDraw();el('basket').querySelectorAll('[data-choose]').forEach(button=>{const edit=document.createElement('button');edit.textContent='Edit';edit.onclick=()=>{const item=items.find(i=>i.id===button.dataset.choose);if(!item)return;const quantity=prompt('Quantity for '+item.name,item.qty);if(quantity===null)return;const n=Number(quantity);if(!(n>0)||!Number.isFinite(n)||(item.basis==='item'&&!Number.isInteger(n)))return notify('Enter a valid quantity.');item.qty=n;render();};button.after(edit);});};
 el('grocerySave').onclick=()=>ready?(changed?save():status('All grocery changes are saved.')):loadWorkspace(el('groceryWorkspace').value);
 el('groceryWorkspace').onchange=()=>loadWorkspace(el('groceryWorkspace').value);
 window.addEventListener('beforeunload',event=>{if(changed){localDraft();event.preventDefault();event.returnValue='';}});
 el('receiptDate').value=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Riyadh'});
 (async()=>{lock(true);try{const {data,error}=await client.auth.getUser();if(error||!data?.user)throw Error('Sign in again to load your private list.');userId=data.user.id;const result=await client.from('finance_workspaces').select('id,display_name').eq('owner_user_id',userId);if(result.error)throw result.error;el('groceryWorkspace').innerHTML='<option value="personal">Personal</option>'+(result.data||[]).map(w=>'<option value="'+esc(w.id)+'">'+esc(w.display_name)+'</option>').join('');await loadWorkspace('personal');}catch(error){status(error.message);}})();
})();
