// Read-only dividend discovery. No finance rows are written by this endpoint.
const SUPABASE_URL='https://qxayaygycgqwrerhrrlq.supabase.co';
const SUPABASE_KEY='sb_publishable_2RIeDYaMuiPFyVs1TEG9wA_wqc8oNx2';
const validSymbol=s=>/^[A-Z0-9.]{1,16}$/.test(s);
export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'GET only'});
 const token=String(req.headers.authorization||'').match(/^Bearer ([A-Za-z0-9._-]+)$/)?.[1];
 if(!token)return res.status(401).json({error:'Sign in required'});
 try{
  const auth=await fetch(SUPABASE_URL+'/auth/v1/user',{headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+token},signal:AbortSignal.timeout(7000)});
  if(!auth.ok)return res.status(401).json({error:'Session expired'});
 }catch(_){return res.status(503).json({error:'Authentication unavailable'});}
 const symbols=[...new Set(String(req.query?.symbols||'').split(',').map(s=>s.trim().toUpperCase()).filter(Boolean))];
 if(!symbols.length||symbols.length>30||symbols.some(s=>!validSymbol(s)))return res.status(400).json({error:'Choose up to 30 valid holding symbols'});
 const key=process.env.FMP_API_KEY;
 if(!key)return res.status(503).json({error:'Dividend feed is not connected',code:'FEED_NOT_CONFIGURED'});
 const start=new Date();start.setUTCDate(start.getUTCDate()-90);const end=new Date();end.setUTCFullYear(end.getUTCFullYear()+1);
 const items=[],failures=[];
 for(let i=0;i<symbols.length;i+=4){await Promise.all(symbols.slice(i,i+4).map(async symbol=>{
  try{
   const url='https://financialmodelingprep.com/stable/dividends?symbol='+encodeURIComponent(symbol)+'&apikey='+encodeURIComponent(key);
   const response=await fetch(url,{signal:AbortSignal.timeout(9000)});
   if(!response.ok)throw new Error('Provider '+response.status);
   const data=await response.json();if(!Array.isArray(data))throw new Error('Unexpected provider response');
   for(const row of data){
    const exDate=String(row.date||row.exDividendDate||'').slice(0,10),payDate=String(row.paymentDate||'').slice(0,10),amount=Number(row.dividend??row.adjDividend),day=payDate||exDate;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(exDate)||!Number.isFinite(amount)||amount<=0||day<start.toISOString().slice(0,10)||exDate>end.toISOString().slice(0,10))continue;
    items.push({symbol,exDate,payDate:/^\d{4}-\d{2}-\d{2}$/.test(payDate)?payDate:'',recordDate:String(row.recordDate||'').slice(0,10),declarationDate:String(row.declarationDate||'').slice(0,10),amount,currency:symbol.endsWith('.SR')?'SAR':'USD',source:'FMP'});
   }
  }catch(_){failures.push(symbol)}
 }))}
 res.setHeader('Cache-Control','private, max-age=0');
 return res.status(failures.length===symbols.length?502:200).json({items,checked:symbols.length-failures.length,failures,source:'Financial Modeling Prep',asOf:new Date().toISOString()});
}
