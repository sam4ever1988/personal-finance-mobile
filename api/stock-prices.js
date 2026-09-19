export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=60, stale-while-revalidate=120');
  const raw=String(req.query?.symbols||'');
  const symbols=[...new Set(raw.split(',').map(s=>s.trim()).filter(Boolean))].slice(0,40);
  if(!symbols.length)return res.status(400).json({error:'No symbols supplied'});
  const prices={};
  await Promise.all(symbols.map(async symbol=>{
    try{
      const url='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+'?interval=1d&range=1d';
      const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0','Accept':'application/json'}});
      if(!r.ok)throw new Error('HTTP '+r.status);
      const j=await r.json();
      const meta=j?.chart?.result?.[0]?.meta||{};
      const price=Number(meta.regularMarketPrice??meta.previousClose);
      if(Number.isFinite(price)&&price>0)prices[symbol]={price,currency:meta.currency||null,exchange:meta.exchangeName||null,marketState:meta.marketState||null};
    }catch(_){}
  }));
  return res.status(200).json({prices,updatedAt:new Date().toISOString()});
}
