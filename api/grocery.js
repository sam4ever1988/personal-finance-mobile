// Private evaluation adapter. Provider keys remain on the server; no finance data is read.
const AUTH_URL='https://qxayaygycgqwrerhrrlq.supabase.co/auth/v1/user';
const AUTH_KEY='sb_publishable_2RIeDYaMuiPFyVs1TEG9wA_wqc8oNx2';
const BASE='https://api.muwazin.me/v1';
const text=(v,max=160)=>String(v??'').slice(0,max);
const name=v=>typeof v==='object'&&v?(v.en||v.ar||''):text(v);
function safeUrl(v){try{const u=new URL(v);return u.protocol==='https:'?u.href:'';}catch(_){return '';}}
function product(p){return {id:text(p.id,100),barcode:text(p.barcode,20),name:name(p.name),brand:text(p.brand),size:name(p.size?.weight||p.size),priceBasis:p.priceBasis,matchConfidence:Number(p.matchConfidence)||0};}
function branch(p){return {retailer:text(p.retailer,60),retailerName:name(p.retailerName),store:{code:text(p.store?.code,100),name:name(p.store?.name),city:'Riyadh',kind:text(p.store?.kind,30)},price:p.price,priceBasis:p.priceBasis,currency:p.currency,inStock:p.inStock===true,stale:p.stale===true,updatedAt:text(p.updatedAt,40),url:safeUrl(p.url)};}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
 const key=process.env.MUWAZIN_API_KEY,allowed=String(process.env.GROCERY_TEST_USER_IDS||'').split(',').map(s=>s.trim()).filter(Boolean);
 const action=String(req.query?.action||'status');
 if(!['status','search','branches'].includes(action))return res.status(400).json({error:'Unknown action'});
 const token=String(req.headers?.authorization||'');
 if(!/^Bearer [A-Za-z0-9._-]+$/.test(token)||token.length>8192)return res.status(401).json({error:'Sign in to your finance account first.'});
 try{
  const auth=await fetch(AUTH_URL,{headers:{apikey:AUTH_KEY,Authorization:token},signal:AbortSignal.timeout(5000)});
  if(!auth.ok)return res.status(401).json({error:'Your session expired. Sign in again.'});
  const user=await auth.json();if(user.id!=='a8b3c116-be0f-4e2c-9d9a-04643c18b689'||user.email?.toLowerCase()!=='sam4ever@windowslive.com')return res.status(403).json({error:'This price comparison API is available only to approved testers.'});
  if(!key||!allowed.includes(user.id))return res.status(action==='status'?200:503).json({configured:false,error:'Price API is not connected yet. A provider evaluation key and admin access must be configured.'});
  if(action==='status')return res.status(200).json({configured:true,verified:false,city:'Riyadh',message:'Configured for testing. Run a search to verify provider access.'});
  let path;
  if(action==='search'){
   const q=String(req.query.q||'').trim(),barcode=String(req.query.barcode||'').trim();
   if(barcode){if(!/^\d{8,14}$/.test(barcode))return res.status(400).json({error:'Enter an 8–14 digit product barcode.'});path='/barcodes/'+barcode;}
   else{if(q.length<2||q.length>120)return res.status(400).json({error:'Search must contain 2–120 characters.'});path='/products?'+new URLSearchParams({q,limit:'10',inStock:'true'});}
  }else{
   const id=String(req.query.id||'');if(!/^[A-Za-z0-9_-]{1,100}$/.test(id))return res.status(400).json({error:'Invalid product identifier'});
   path='/products/'+encodeURIComponent(id)+'/branches?city=Riyadh&inStock=true';
  }
  const upstream=await fetch(BASE+path,{headers:{Authorization:'Bearer '+key,Accept:'application/json'},signal:AbortSignal.timeout(7000)});
  if(!upstream.ok){const status=upstream.status;return res.status(status===404?404:status===429?429:502).json({error:status===404?'No matching product found.':status===429?'Provider usage limit reached. Please retry later.':'The price provider could not complete this request. Check the evaluation key, terms acceptance and quota in the provider console.'});}
  const data=await upstream.json();
  if(action==='search'){
   const rows=req.query.barcode?[data]:(Array.isArray(data.items)?data.items:[]);
   return res.status(200).json({products:rows.slice(0,10).map(product),source:'Muwazin',city:'Riyadh'});
  }
  const rows=Array.isArray(data.items)?data.items:[];
  return res.status(200).json({offers:rows.filter(p=>/^(riyadh|الرياض)$/i.test(String(p.store?.city||'').trim())).slice(0,200).map(branch),dataAsOf:text(data.dataAsOf,40),source:'Muwazin',city:'Riyadh',moreAvailable:!!data.nextCursor});
 }catch(_){return res.status(503).json({error:'Price comparison is temporarily unavailable. Your shopping list has been kept on this page.'});}
};
