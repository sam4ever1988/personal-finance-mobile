/* Pure grocery planning and receipt-review helpers. */
(function(root){
 const money=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
 const normalize=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/\s+/g,' ').trim();
 const alias=(shop,name,basis)=>JSON.stringify([normalize(shop),normalize(name),basis]);
 function plan(items,excluded=[],cost=0,now=Date.now()){
  const banned=new Set(excluded),shops=new Map(),missing=[];let paid=0,total=0;
  for(const item of items){if(item.wanted===false)continue;
   const offers=(item.offers||[]).filter(o=>!banned.has(o.key)&&o.inStock===true&&!o.stale&&o.currency==='SAR'&&o.city==='Riyadh'&&o.priceBasis===item.basis&&Number.isFinite(o.price)&&o.price>0&&Number.isFinite(Date.parse(o.checkedAt||o.updatedAt))&&now-Date.parse(o.checkedAt||o.updatedAt)>=-300000&&now-Date.parse(o.checkedAt||o.updatedAt)<=48*3600000);
   // Price ties prefer a branch already in the plan, then a stable branch key.
   offers.sort((a,b)=>a.price-b.price||Number(shops.has(b.key))-Number(shops.has(a.key))||String(a.key).localeCompare(String(b.key)));
   const offer=offers[0];if(!offer){missing.push(item);continue;}
   if(!shops.has(offer.key))shops.set(offer.key,{key:offer.key,name:offer.store,rows:[],total:0});
   const group=shops.get(offer.key),line=money(offer.price*item.qty);group.rows.push({item,offer,total:line,saving:money((item.paid-offer.price)*item.qty)});group.total=money(group.total+line);total+=line;paid+=item.paid*item.qty;
  }
  const groups=[...shops.values()].sort((a,b)=>b.rows.length-a.rows.length||a.name.localeCompare(b.name));
  return {groups,missing,paid:money(paid),productsTotal:money(total),total:money(total+Math.max(0,Number(cost)||0)*groups.length),saving:money(paid-total-Math.max(0,Number(cost)||0)*groups.length)};
 }
 function parseReceipt(text){
  const rows=[],ignored=[];
  for(const raw of String(text||'').split(/\r?\n/)){
   const line=normalize(raw);if(!line)continue;
   if(/(?:^|\s)(total|subtotal|vat|tax|cash|change|discount|balance|payment|visa|mastercard|إجمالي|اجمالي|ضريبة|المجموع|خصم|الباقي)(?:\s|:|$)/i.test(line)){ignored.push(raw);continue;}
   const m=line.match(/^(.*?)\s+(-?\d+[.,]\d{2})\s*(?:sar|sr|ريال)?$/i);if(!m||!/[a-z\u0600-\u06ff]/i.test(m[1])){ignored.push(raw);continue;}
   let name=m[1].trim(),qty=1;const quantity=name.match(/\s+(\d+(?:\.\d+)?)\s*[x×*]\s*$/);if(quantity){qty=Number(quantity[1]);name=name.slice(0,quantity.index).trim();}
   const total=Number(m[2].replace(',','.'));if(total<0||!name||!(qty>0)){ignored.push(raw);continue;}
   rows.push({raw,name,qty,paid:money(total/qty),basis:Number.isInteger(qty)?'item':'kg',reviewed:false});
  }
  return {rows,ignored};
 }
 const api={money,normalize,alias,plan,parseReceipt};root.GroceryPlanner=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
