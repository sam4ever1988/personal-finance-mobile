const CURRENCIES=['SAR','PHP','USD','EUR','GBP','AED','AUD','CAD','CHF','CNY','HKD','SGD','JPY','INR','KRW','IDR','MYR','THB','NZD','BHD','KWD','QAR','OMR','EGP','PKR','BDT','ZAR','TRY','BRL','MXN'];
export default async function handler(req,res){
 const from=String(req.query?.from||'').toUpperCase(),to=String(req.query?.to||'SAR').toUpperCase();
 if(!CURRENCIES.includes(from)||!CURRENCIES.includes(to))return res.status(400).json({error:'Unsupported currency'});
 if(from===to)return res.status(200).json({from,to,rate:1,source:'Same currency',date:new Date().toISOString().slice(0,10)});
 try{
  const response=await fetch(`https://api.frankfurter.dev/v2/rate/${from.toLowerCase()}/${to.toLowerCase()}`,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw Error('Provider unavailable');
  const data=await response.json(),rate=Number(data.rate),stamp=Date.parse(data.date);
  if(!(rate>0)||!Number.isFinite(rate)||!Number.isFinite(stamp)||Date.now()-stamp>7*86400000)throw Error('Invalid or outdated quote');
  res.setHeader('Cache-Control','s-maxage=1800, stale-while-revalidate=300');
  return res.status(200).json({from,to,rate,date:data.date,fetchedAt:new Date().toISOString(),source:'Frankfurter reference rate'});
 }catch(_){
  try{const r=await fetch('https://open.er-api.com/v6/latest/USD',{signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('Provider unavailable');const d=await r.json(),a=Number(d.rates?.[from]),b=Number(d.rates?.[to]),stamp=Number(d.time_last_update_unix)*1000,rate=b/a;if(!(a>0&&b>0&&rate>0)||!Number.isFinite(rate)||!Number.isFinite(stamp)||Date.now()-stamp>3*86400000)throw Error('Invalid quote');res.setHeader('Cache-Control','s-maxage=1800, stale-while-revalidate=300');return res.status(200).json({from,to,rate,date:new Date(stamp).toISOString().slice(0,10),fetchedAt:new Date().toISOString(),source:'ExchangeRate-API reference rate',attribution:'https://www.exchangerate-api.com'});}catch(_){return res.status(503).json({error:'Online reference rate unavailable. Enter the actual rate used.'});}
 }
}
