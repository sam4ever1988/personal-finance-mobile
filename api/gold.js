// Public market data only. No account information or credentials leave this route.
const FACTOR = 3.75 / 31.1034768;
const RANGES = new Set(['24h', '7d', '1m', '1y']);
async function json(url) {
  const r = await fetch(url, {signal: AbortSignal.timeout(7000), headers: {Accept: 'application/json'}});
  if (!r.ok) throw new Error('Market provider unavailable');
  return r.json();
}
function stamp(value) {
  const n = typeof value === 'number' ? (value < 1e12 ? value * 1000 : value) : value;
  const d = new Date(n);
  if (!Number.isFinite(d.getTime()) || d.getTime() > Date.now() + 300000) throw new Error('Invalid quote date');
  return d.toISOString();
}
function quote(price, updatedAt, source, attribution) {
  const usdOz = Number(price);
  if (!Number.isFinite(usdOz) || usdOz <= 0) throw new Error('Invalid quote');
  return {usdOz, price24k: usdOz * FACTOR, updatedAt: stamp(updatedAt), fetchedAt: new Date().toISOString(), source, attribution};
}
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {res.setHeader('Allow', 'GET');return res.status(405).json({error: 'Method not allowed'});}
  const range = String(req.query?.range || '');
  try {
    if (range) {
      if (!RANGES.has(range)) return res.status(400).json({error: 'Invalid range'});
      const d = await json('https://standardbullion.com/api/v1/market/history?metal=XAU&range=' + range);
      const points = (Array.isArray(d.points) ? d.points : []).flatMap(p => {
        try {const price = Number(p.price);return price > 0 && Number.isFinite(price) ? [{t: stamp(p.t), usdOz: price, price24k: price * FACTOR}] : [];} catch (_) {return [];}
      }).sort((a,b) => a.t.localeCompare(b.t));
      if (!points.length) throw new Error('History unavailable');
      return res.status(200).json({points, source: 'Standard Bullion', attribution: d.attribution || 'Data by Standard Bullion — https://standardbullion.com', fetchedAt: new Date().toISOString()});
    }
    try {
      const d = await json('https://api.gold-api.com/price/XAU');
      return res.status(200).json(quote(d.price, d.updatedAt || d.updated_at || d.timestamp, 'Gold-API', 'Gold-API XAU/USD'));
    } catch (_) {
      const d = await json('https://standardbullion.com/spot-prices.json');
      const g = (d.metals || []).find(m => m.symbol === 'XAU');
      return res.status(200).json(quote(g?.ask, d.updated, 'Standard Bullion (ask)', d.attribution || 'Data by Standard Bullion — https://standardbullion.com'));
    }
  } catch (_) {return res.status(503).json({error: 'Gold market data is temporarily unavailable. Please retry.'});}
};
