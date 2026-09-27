export default async function handler(req,res){
  const from=String(req.query?.from||'').toUpperCase();
  if(!['USD','PHP','SAR'].includes(from))return res.status(400).json({error:'Unsupported currency'});
  if(from==='SAR')return res.status(200).json({from,to:'SAR',rate:1,source:'identity',date:new Date().toISOString().slice(0,10)});
  try{
    const response=await fetch(`https://api.frankfurter.dev/v2/rate/${from.toLowerCase()}/sar`,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw new Error('Rate provider unavailable');
    const data=await response.json(),rate=Number(data.rate);
    if(!Number.isFinite(rate)||rate<=0)throw new Error('Invalid rate');
    res.setHeader('Cache-Control','s-maxage=3600, stale-while-revalidate=3600');
    return res.status(200).json({from,to:'SAR',rate,date:data.date||null,source:'Frankfurter reference rate'});
  }catch(_){return res.status(503).json({error:'Current reference rate unavailable; enter a manual rate'});}
}
