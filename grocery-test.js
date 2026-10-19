'use strict';
const el=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sar=v=>'SAR '+Number(v).toFixed(2),round=v=>Math.round((v+Number.EPSILON)*100)/100;
let items=[],selected=null,receiptUrl='',requestVersion=0;
const client=window.financeGroceryClient||window.supabase?.createClient('https://qxayaygycgqwrerhrrlq.supabase.co','sb_publishable_2RIeDYaMuiPFyVs1TEG9wA_wqc8oNx2');
function savingLabel(value){return value>0?'+'+sar(value):value<0?sar(-value)+' more':sar(0);}
function packCount(value){const match=String(value).match(/(?:^|[^0-9])(\d+)\s*[x×*]\s*\d/i);return match?Number(match[1]):1;}
function notify(message){el('feedback').textContent=message;}
function activeItem(){return items.find(i=>i.id===selected);}
function freshOffer(o,item){const age=Date.now()-Date.parse(o.checkedAt||o.updatedAt);return o.inStock===true&&!o.stale&&o.currency==='SAR'&&o.priceBasis===item.basis&&typeof o.price==='number'&&Number.isFinite(o.price)&&o.price>0&&Number.isFinite(age)&&age>=-300000&&age<=48*3600000&&o.city==='Riyadh';}
function priceStatus(item){
 if(!item.product)return 'Choose the matching product to fetch prices';
 if(!item.priceCheck)return 'Awaiting reviewed prices';
 if(!item.priceCheck.total)return 'No Riyadh branch prices returned for this product';
 const counts={old:0,stock:0,unit:0,invalid:0};
 item.offers.filter(o=>!o.manual).forEach(o=>{if(o.stale||!Number.isFinite(Date.parse(o.checkedAt||o.updatedAt))||Date.now()-Date.parse(o.checkedAt||o.updatedAt)>48*3600000)counts.old++;else if(!o.inStock)counts.stock++;else if(o.priceBasis!==item.basis)counts.unit++;else counts.invalid++;});
 return 'No eligible current prices: '+Object.entries({old:'older than 48 hours or unconfirmed',stock:'out of stock',unit:'different price unit',invalid:'unusable price data'}).filter(([key])=>counts[key]).map(([key,label])=>counts[key]+' '+label).join('; ');
}
function searchScore(product,query){const words=query.toLowerCase().match(/[a-z\u0600-\u06ff]+/g)||[];const name=(product.name+' '+product.brand).toLowerCase();return words.filter(w=>w.length>1&&new RegExp('(?:^|[^a-z\u0600-\u06ff])'+w+'(?:$|[^a-z\u0600-\u06ff])','i').test(name)).length;}
function validOffers(item){return item.offers.filter(o=>freshOffer(o,item));}
function best(item){return validOffers(item).sort((a,b)=>a.price-b.price)[0]||null;}
function setBusy(flag){el('searchForm').querySelector('button').disabled=flag;el('products').querySelectorAll('button').forEach(b=>b.disabled=flag);}
async function api(params){
 async function sessionToken(refresh=false){
  if(!client)return null;
  const {data,error}=await (refresh?client.auth.refreshSession():client.auth.getSession());
  return !error?data?.session?.access_token:null;
 }
 function signIn(){window.financeGrocerySignIn?.();return Error('Your session needs renewing. Sign in above to reconnect. Your shopping list is kept.');}
 let token=await sessionToken();
 if(!token)token=await sessionToken(true);
 if(!token)throw signIn();
 const send=()=>fetch('/api/grocery?'+new URLSearchParams(params),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accessToken:token}),cache:'no-store',signal:AbortSignal.timeout(15000)});
 let response=await send();
 if(response.status===401){
  const renewed=await sessionToken(true);
  if(renewed){token=renewed;response=await send();}
  if(response.status===401){
   const result=await client.auth.getUser();
   if(result.error||!result.data?.user)throw signIn();
   const detail=await response.json().catch(()=>({}));
   throw Error('You are signed in, but the server could not verify the connection. Reference: '+(detail.authCode||detail.code||'server_session_rejected')+'. Please retry; another sign-in is not needed.');
  }
 }
 const data=await response.json();if(!response.ok)throw Error(data.error||'Price comparison unavailable');return data;
}
async function checkConnection(){el('checkConnection').disabled=true;el('connection').textContent='Checking connection…';el('connectionDetail').textContent='Verifying your session and API configuration…';try{const d=await api({action:'status'});el('connection').textContent=d.configured?'API configured for testing':'Price API not connected';el('connectionDetail').textContent=d.message||d.error||'Run a product search to verify access.';}catch(e){el('connection').textContent='Connection needs attention';el('connectionDetail').textContent=e.message;}finally{el('checkConnection').disabled=false;}}
function choose(id){requestVersion++;selected=id;const i=activeItem();el('searchArea').hidden=!i;el('manualArea').hidden=!i;el('noSelection').hidden=!!i;el('products').innerHTML='';el('searchQuery').value=i?.name||'';el('quoteForm').reset();el('quoteDate').value=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Riyadh'});notify(i?'Comparing: '+i.name:'');setBusy(false);render();}
function render(){
 el('basket').innerHTML=items.length?items.map(i=>{const b=best(i),paid=round(i.paid*i.qty),saving=b?round((i.paid-b.price)*i.qty):null;return `<tr class="${i.id===selected?'selected':''}"><td><b>${esc(i.name)}</b><div class="muted">${i.basis==='kg'?'Price per kg':'Price per pack'}${i.product?' · Reviewed: '+esc(i.product.name):''}</div></td><td>${i.qty}${i.basis==='kg'?' kg':''}</td><td>${sar(paid)}</td><td>${b?`${sar(b.price)} each<div class="muted">${i.priceCheck?.partial?'Lowest among fetched offers · partial coverage<br>':''}${esc(b.store)} · ${b.manual?'Manual entry':'Provider price'}<br>Checked ${esc(new Date(b.checkedAt||b.updatedAt).toLocaleString('en-GB',{timeZone:'Asia/Riyadh'}))}${b.url?'<br><a href="'+esc(b.url)+'" target="_blank" rel="noopener">View price source</a>':''}</div>`:esc(priceStatus(i))}</td><td class="${saving!==null&&saving<0?'red':'green'}">${saving===null?'—':savingLabel(saving)}</td><td><button data-choose="${i.id}">Compare</button><button data-remove="${i.id}">Remove</button></td></tr>`;}).join(''):'<tr><td colspan="6" class="empty">Your list is empty. Add a receipt item above.</td></tr>';
 el('basket').querySelectorAll('[data-choose]').forEach(b=>b.onclick=()=>choose(b.dataset.choose));el('basket').querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{items=items.filter(i=>i.id!==b.dataset.remove);if(selected===b.dataset.remove)choose(items[0]?.id||null);else render();});
 const matched=items.filter(i=>best(i)),paid=round(matched.reduce((s,i)=>s+i.paid*i.qty,0)),cheap=round(matched.reduce((s,i)=>s+best(i).price*i.qty,0)),extra=Math.max(0,Number(el('storeCost').value)||0),stores=new Set(matched.map(i=>best(i).key)),split=round(cheap+extra*stores.size);
 el('summary').innerHTML=`<div class="card"><div class="muted">ITEMS WITH REVIEWED PRICES</div><div class="value">${matched.length} / ${items.length}</div></div><div class="card"><div class="muted">YOU PAID · MATCHED ITEMS ONLY</div><div class="value">${matched.length?sar(paid):'—'}</div></div><div class="card"><div class="muted">${paid>=split?'SPLIT BASKET SAVING':'EXTRA COST VS WHAT YOU PAID'} · MATCHED ITEMS ONLY</div><div class="value ${paid<split?'red':'green'}">${matched.length?savingLabel(round(paid-split)):'—'}</div></div>`;
 const keys=new Map();items.forEach(i=>validOffers(i).forEach(o=>keys.set(o.key,o.store)));
 const complete=[...keys].map(([key,name])=>{const offers=items.map(i=>validOffers(i).filter(o=>o.key===key).sort((a,b)=>a.price-b.price)[0]);return offers.every(Boolean)&&items.length?{name,total:round(offers.reduce((s,o,n)=>s+o.price*items[n].qty,0)+extra)}:null;}).filter(Boolean).sort((a,b)=>a.total-b.total);
 el('storeComparison').innerHTML=complete.length?complete.map((s,n)=>`<div class="offer"><b>${n===0?'Best complete basket · ':''}${esc(s.name)}</b> — ${sar(s.total)}</div>`).join(''):'<p class="muted">No complete single-store basket yet. Add matching prices for every item at the same Riyadh branch.</p>';
 if(matched.length){el('storeComparison').insertAdjacentHTML('beforeend',`<div class="offer"><b>Split basket · ${matched.length===items.length?'complete':'partial, '+matched.length+' of '+items.length+' items'}</b> — ${sar(split)} across ${stores.size} store(s)<div class="muted">${matched.map(i=>esc(i.name)+' → '+esc(best(i).store)).join('<br>')}</div></div>`);}
}
el('itemForm').onsubmit=e=>{e.preventDefault();const name=el('itemName').value.trim(),qty=Number(el('itemQty').value),paid=Number(el('itemPaid').value),basis=el('itemBasis').value;if(!name||!Number.isFinite(qty)||qty<=0||!Number.isFinite(paid)||paid<0||basis==='item'&&!Number.isInteger(qty))return notify('Enter a product, a valid price, and a whole number of packs (or a weight in kg).');const i={id:crypto.randomUUID(),name,qty,paid,basis,offers:[]};items.push(i);el('itemForm').reset();el('itemQty').value='1';choose(i.id);};
el('searchForm').onsubmit=async e=>{e.preventDefault();const i=activeItem();if(!i)return;const version=++requestVersion,q=el('searchQuery').value.trim();setBusy(true);notify('Searching products…');try{const d=await api(/^\d{8,14}$/.test(q)?{action:'search',barcode:q}:{action:'search',q});if(version!==requestVersion||activeItem()!==i)return;d.products.sort((a,b)=>searchScore(b,q)-searchScore(a,q));el('products').innerHTML=d.products.length?d.products.map((p,n)=>`<div class="product"><b>${esc(p.name)}</b><div class="muted">${esc(p.brand)} · ${esc(p.size||'Size not supplied')} · ${esc(p.priceBasis||'Unknown price basis')}${p.branches?' · '+p.branches.inStock+' in-stock branches across all cities':''}</div>${searchScore(p,q)===0&&!/^\d+$/.test(q)?'<p class=muted>Product name differs from your search. Check carefully before choosing.</p>':''}<button data-confirm="${n}">Confirm this product &amp; compare Riyadh prices</button></div>`).join(''):'<p>No matching products found. Try a barcode or add a verified price manually.</p>';el('products').querySelectorAll('[data-confirm]').forEach(b=>b.onclick=()=>loadProduct(i,d.products[Number(b.dataset.confirm)]));notify('Choose the exact product: check the name, brand and pack size. A matching size alone is not enough.');}catch(e){if(version===requestVersion)notify(e.message);}finally{if(version===requestVersion)setBusy(false);}};
async function loadProduct(i,p){if(activeItem()!==i)return;
 const count=packCount(p.name+' '+(p.size||''));
 if(i.basis==='item'&&count!==packCount(i.name)&&i.confirmedPack!==p.id){
  notify('Pack size differs: your item is '+i.name+', but this product contains '+count+' units. Choose the matching pack, or confirm your paid price was for this whole pack.');
  document.getElementById('packConfirmation')?.remove();el('products').insertAdjacentHTML('afterbegin','<div class="notice" id="packConfirmation"><b>'+esc(p.name)+'</b><p>Your entered price must cover this whole pack.</p><button id="confirmWholePack">My paid price is for this whole pack</button></div>');
  document.getElementById('packConfirmation').scrollIntoView({block:'nearest'});
  el('confirmWholePack').onclick=()=>{i.confirmedPack=p.id;document.getElementById('packConfirmation')?.remove();loadProduct(i,p);};return;
 }
if(p.priceBasis!==i.basis)return notify('This product uses a different price basis. Choose a matching product or correct your shopping-list item.');const version=++requestVersion;setBusy(true);notify('Checking Riyadh branch availability…');try{let d,offers=[],cursor='',partial=false;const cursors=new Set();
 for(let page=0;page<20;page++){
  d=await api({action:'branches',id:p.id,...(cursor?{cursor}:{})});
  if(version!==requestVersion||activeItem()!==i)return;
  offers.push(...d.offers);partial=!!d.moreAvailable;cursor=d.nextCursor||'';
  if(!cursor)break;
  if(cursors.has(cursor))break;cursors.add(cursor);
  notify('Comparing Riyadh prices by lowest price… '+offers.length+' branch offers checked.');
 }
 d={...d,offers,moreAvailable:partial};
 if(version!==requestVersion||activeItem()!==i)return;const quotes=d.offers.map(o=>({key:'provider:'+o.retailer+':'+o.store.code,store:o.store.name||o.retailerName||o.retailer,city:o.store.city,price:o.price,priceBasis:o.priceBasis,currency:o.currency,inStock:o.inStock,stale:o.stale,updatedAt:o.updatedAt,checkedAt:o.checkedAt,url:o.url,manual:false}));i.product=p;i.priceCheck={total:quotes.length,partial:!!d.moreAvailable};i.offers=i.offers.filter(o=>o.manual).concat(quotes);render();notify((validOffers(i).length?validOffers(i).length+' usable reviewed prices found.':priceStatus(i)+'. Try the exact brand or barcode, or choose another matching result.')+(d.moreAvailable?' Comparison is incomplete; the lowest price shown covers only the fetched branches.':''));el('connection').textContent='Provider responded · Riyadh prices';el('connectionDetail').textContent=d.moreAvailable?'Partial price coverage. The displayed minimum covers fetched offers only.':'Compared all returned Riyadh pages by price. The cheapest eligible offer is shown with its branch and check date.';}catch(e){if(version===requestVersion)notify(e.message);}finally{if(version===requestVersion)setBusy(false);}}
el('quoteForm').onsubmit=e=>{e.preventDefault();const i=activeItem();if(!i)return;const store=el('quoteStore').value.trim(),price=Number(el('quotePrice').value),updatedAt=el('quoteDate').value+'T00:00:00+03:00',url=el('quoteUrl').value.trim();if(!store||!(price>0)||!Number.isFinite(price))return notify('Enter a store and a valid price.');if(url&&!/^https:\/\//i.test(url))return notify('Use an HTTPS source link.');const o={key:'manual:'+store.toLowerCase().replace(/\s+/g,' '),store,price,priceBasis:i.basis,currency:'SAR',city:'Riyadh',inStock:true,stale:false,updatedAt,url,manual:true};if(!freshOffer(o,i))return notify('Use a price checked within the last 48 hours. Future prices are not accepted.');i.offers=i.offers.filter(x=>x.key!==o.key).concat(o);render();notify('Reviewed manual price added.');};
el('receiptFile').onchange=()=>{if(receiptUrl)URL.revokeObjectURL(receiptUrl);const f=el('receiptFile').files[0];el('receiptPreview').hidden=true;if(!f)return;if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>15*1024*1024)return notify('Choose a PNG, JPG or WebP receipt up to 15 MB.');receiptUrl=URL.createObjectURL(f);el('receiptPreview').src=receiptUrl;el('receiptPreview').hidden=false;};
window.addEventListener('finance-grocery-authenticated',checkConnection);
el('clearList').onclick=()=>{if(items.length&&!confirm('Clear this testing list?'))return;items=[];choose(null);};el('storeCost').oninput=render;el('checkConnection').onclick=checkConnection;render();checkConnection();
