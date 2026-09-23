/* V296 Investments — editable activity, settlement workflow and daily movement */
var INV_USD_SAR=3.75;
var INV_SEED=[
 {ticker:"7202",company:"Solutions by stc",market:"SA",qty:200,avg:271.95,price:216.90},
 {ticker:"2010",company:"SABIC",market:"SA",qty:130,avg:65.733,price:50.10},
 {ticker:"1180",company:"Saudi National Bank",market:"SA",qty:124,avg:38.9265,price:43.40},
 {ticker:"4012",company:"Thob Al Aseel",market:"SA",qty:1850,avg:4.0191,price:3.49},
 {ticker:"1010",company:"Riyad Bank",market:"SA",qty:300,avg:20.8765,price:20.85},
 {ticker:"4001",company:"Abdullah Al Othaim Markets",market:"SA",qty:900,avg:11.0046,price:4.98},
 {ticker:"4164",company:"Nahdi Medical",market:"SA",qty:40,avg:122.3886,price:93.90},
 {ticker:"4003",company:"United Electronics (eXtra)",market:"SA",qty:50,avg:99.393,price:66.70},
 {ticker:"2020",company:"SABIC Agri-Nutrients",market:"SA",qty:21,avg:116.7322,price:130.50},
 {ticker:"4190",company:"Jarir Marketing",market:"SA",qty:120,avg:13.8622,price:17.10},
 {ticker:"4163",company:"Al-Dawaa Medical Services",market:"SA",qty:37,avg:74.7068,price:39.00},
 {ticker:"1831",company:"Maharah Human Resources",market:"SA",qty:305,avg:5.39,price:4.65},
 {ticker:"4084",company:"Derayah Financial",market:"SA",qty:8,avg:30.00,price:22.18},
 {ticker:"LCID",company:"Lucid Group",market:"US",qty:51,avg:34.66,price:5.09},
 {ticker:"RIO",company:"Rio Tinto",market:"US",qty:11,avg:69.39,price:104.78}
];
var invHoldings=JSON.parse(localStorage.getItem("pf_investments_holdings")||"null")||JSON.parse(JSON.stringify(INV_SEED));
var invTrades=JSON.parse(localStorage.getItem("pf_investments_trades")||"[]");
var invLastPriceUpdate=localStorage.getItem("pf_investments_price_time")||"";

var INV_ANALYSIS_ASOF="2026-09-22";
var INV_ANALYSIS={
 "7202":{financial:"Strong",valuation:"Fair",risk:"Medium",outlook:"Positive",action:"Add carefully",reason:"Strong operating performance, but portfolio concentration is already high."},
 "2010":{financial:"Weak / cyclical",valuation:"Fair",risk:"Medium-High",outlook:"Cautious",action:"Wait",reason:"Large cyclical exposure; wait for clearer earnings recovery before averaging."},
 "1180":{financial:"Strong",valuation:"Fair",risk:"Medium",outlook:"Positive",action:"Gradual add",reason:"Healthy banking profitability; use pullbacks rather than chasing price."},
 "4012":{financial:"Stable",valuation:"Fair",risk:"Medium",outlook:"Neutral",action:"Small only",reason:"Reasonable operating trend, but not strong enough for aggressive averaging."},
 "1010":{financial:"Strong",valuation:"Fair",risk:"Medium",outlook:"Positive",action:"Gradual add",reason:"Solid bank fundamentals with a balanced risk/reward profile."},
 "4001":{financial:"Weak",valuation:"Unclear",risk:"High",outlook:"Negative",action:"Avoid averaging",reason:"Recent earnings deterioration makes a lower price alone insufficient reason to add."},
 "4164":{financial:"Stable",valuation:"Fair",risk:"Medium",outlook:"Neutral",action:"Wait",reason:"Defensive business, but profit momentum and price trend need confirmation."},
 "4003":{financial:"Stable",valuation:"Fair",risk:"Medium",outlook:"Neutral / Positive",action:"Selective add",reason:"Core retail remains resilient; consumer-finance profitability needs monitoring."},
 "2020":{financial:"Cyclical",valuation:"Fair",risk:"Medium-High",outlook:"Neutral / Positive",action:"Add on weakness",reason:"Cash generation can be strong, but fertilizer pricing remains cyclical."},
 "4190":{financial:"Strong",valuation:"Full",risk:"Medium",outlook:"Neutral / Positive",action:"Wait for price",reason:"Quality business, but recent strength reduces the margin of safety for new money."},
 "4163":{financial:"Mixed",valuation:"Unclear",risk:"High",outlook:"Cautious",action:"Wait",reason:"Do not average solely to lower cost; require clearer earnings and price stabilization."},
 "1831":{financial:"Improving",valuation:"Attractive / watch",risk:"Medium-High",outlook:"Positive",action:"Potential add",reason:"Fundamentals improved materially while the share price remains weak; monitor execution."},
 "4084":{financial:"Stable",valuation:"Fair",risk:"Medium-High",outlook:"Neutral",action:"Wait",reason:"Strategic growth potential remains, but earnings and execution need confirmation."},
 "LCID":{financial:"Weak",valuation:"Speculative",risk:"Very High",outlook:"Negative",action:"Avoid averaging",reason:"High cash-burn and execution risk; treat as speculative rather than a recovery-average position."},
 "RIO":{financial:"Strong",valuation:"Fair",risk:"Medium",outlook:"Neutral / Positive",action:"Add on weakness",reason:"Strong diversified mining cash flows, offset by commodity and operational risk."}
};
function invAnalysis(h){
 var a=INV_ANALYSIS[h.ticker]||{financial:"Not rated",valuation:"—",risk:"—",outlook:"Neutral",action:"Review",reason:"No saved research view yet."};
 var day=Number(h.dayChangePct||0),ret=h.avg?((Number(h.price)-Number(h.avg))/Number(h.avg))*100:0;
 var technical=day>=3?"Bullish day":day<=-3?"Bearish day":ret>=10?"Positive trend":ret<=-20?"Weak trend":"Neutral";
 return {...a,technical};
}
function invBadge(text,kind){
 var k=kind||String(text).toLowerCase().replace(/[^a-z]+/g,"-");
 return '<span class="invAnalysisBadge '+k+'">'+invEsc(text)+'</span>';
}
function invEnsureAnalysisStyles(){
 if(document.getElementById("invAnalysisStyles"))return;
 var s=document.createElement("style");s.id="invAnalysisStyles";s.textContent=
 '.invAnalysisBadge{display:inline-flex;padding:5px 8px;border-radius:999px;border:1px solid var(--line);font-size:11px;font-weight:800;white-space:nowrap}.invAnalysisBadge.positive,.invAnalysisBadge.strong,.invAnalysisBadge.gradual-add,.invAnalysisBadge.potential-add,.invAnalysisBadge.add-on-weakness{background:rgba(34,197,94,.10);color:#65d98a}.invAnalysisBadge.negative,.invAnalysisBadge.weak,.invAnalysisBadge.avoid-averaging,.invAnalysisBadge.very-high{background:rgba(239,68,68,.10);color:#ff7c8b}.invAnalysisBadge.cautious,.invAnalysisBadge.wait,.invAnalysisBadge.high{background:rgba(245,158,11,.10);color:#f5bd55}.invPlanGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.invPlanMetric{padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--soft)}.invPlanMetric span{display:block;font-size:11px;color:var(--muted);margin-bottom:5px}.invPlanMetric b{font-size:16px}.invPlanWarning{margin-top:12px;padding:12px;border-radius:12px;background:rgba(245,158,11,.10);border:1px solid rgba(245,158,11,.25)}@media(max-width:760px){.invPlanGrid{grid-template-columns:1fr}}';
 document.head.appendChild(s);
}
function invOpenPlan(ticker){
 invEnsureAnalysisStyles();var h=invHoldings.find(x=>x.ticker===ticker);if(!h)return;var a=invAnalysis(h),currency=invCurrency(h),f=invFactor(h),t=invTotals(),currentValue=h.qty*h.price*f,currentWeight=t.value?currentValue/t.value*100:0;
 var old=document.getElementById("invPlanModal");if(old)old.remove();
 var d=document.createElement("div");d.className="modalBack open";d.id="invPlanModal";
 d.innerHTML='<div class="modal" style="max-width:760px"><div class="modalHead"><div><div class="modalTitle">Plan More • '+invEsc(h.ticker)+'</div><div class="meta">'+invEsc(h.company)+' • research view '+INV_ANALYSIS_ASOF+'</div></div><button class="closeBtn" type="button">✕</button></div><div class="formGrid"><div class="field"><label>Buy Price ('+currency+')</label><input id="invPlanPrice" type="number" min="0.0001" step="any" value="'+Number(h.price).toFixed(2)+'"></div><div class="field"><label>Additional Budget ('+currency+')</label><input id="invPlanBudget" type="number" min="0" step="any" placeholder="e.g. 5000"></div><div class="field"><label>Additional Shares</label><input id="invPlanShares" type="number" min="0" step="any" placeholder="Calculated from budget"></div><div class="field"><label>Optional Target Average ('+currency+')</label><input id="invPlanTarget" type="number" min="0" step="any" placeholder="Optional"></div></div><div id="invPlanResult" style="margin-top:14px"></div><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px"><button class="btn" id="invPlanClose">Close</button><button class="btn primary" id="invPlanBuy">Use in Buy</button></div></div>';
 document.body.appendChild(d);
 var calc=()=>{var p=Math.max(0,Number(document.getElementById("invPlanPrice").value)||0),budget=Math.max(0,Number(document.getElementById("invPlanBudget").value)||0),shares=Math.max(0,Number(document.getElementById("invPlanShares").value)||0),target=Math.max(0,Number(document.getElementById("invPlanTarget").value)||0);if(budget>0&&!shares)shares=budget/p;if(shares>0&&!budget)budget=shares*p;var nq=Number(h.qty)+shares,navg=nq?((Number(h.qty)*Number(h.avg))+(shares*p))/nq:Number(h.avg),recovery=p>0?(navg/p-1)*100:0,newPortfolio=t.value+(budget*f),newWeight=newPortfolio?((currentValue+budget*f)/newPortfolio*100):0,targetShares=0;if(target>p&&target<Number(h.avg))targetShares=Math.max(0,(Number(h.qty)*(Number(h.avg)-target))/(target-p));var warn=(newWeight>25?'Concentration would be '+newWeight.toFixed(1)+'% of the portfolio. ':'')+(['Avoid averaging','Wait'].includes(a.action)?a.action+': '+a.reason:'');document.getElementById("invPlanResult").innerHTML='<div class="invPlanGrid"><div class="invPlanMetric"><span>Current average</span><b>'+invNativeMoney(h.avg,currency)+'</b></div><div class="invPlanMetric"><span>New average</span><b>'+invNativeMoney(navg,currency)+'</b></div><div class="invPlanMetric"><span>Additional investment</span><b>'+invNativeMoney(budget,currency)+'</b></div><div class="invPlanMetric"><span>New quantity</span><b>'+nq.toFixed(2)+'</b></div><div class="invPlanMetric"><span>Recovery needed from buy price</span><b>'+(recovery>0?recovery.toFixed(1)+'%':'Already above break-even')+'</b></div><div class="invPlanMetric"><span>Portfolio weight after purchase</span><b>'+newWeight.toFixed(1)+'%</b></div>'+(target?'<div class="invPlanMetric"><span>Shares needed for target average</span><b>'+(targetShares?targetShares.toFixed(2):'Target not reachable at this buy price')+'</b></div>':'')+'</div><div class="invPlanWarning"><b>'+invEsc(a.action)+'</b><div class="meta" style="margin-top:5px">'+invEsc(a.reason)+'</div>'+(warn?'<div style="margin-top:7px">'+invEsc(warn)+'</div>':'')+'</div>';return{p,shares,budget}};
 ["invPlanPrice","invPlanBudget","invPlanShares","invPlanTarget"].forEach(id=>document.getElementById(id).addEventListener("input",calc));calc();
 d.querySelector(".closeBtn").onclick=document.getElementById("invPlanClose").onclick=()=>d.remove();
 document.getElementById("invPlanBuy").onclick=()=>{var x=calc();if(!(x.p>0)||!(x.shares>0))return alert("Enter a budget or additional shares first.");d.remove();invOpenTrade(ticker,"BUY");document.getElementById("invQtyInput").value=x.shares.toFixed(6).replace(/0+$/,"").replace(/\.$/,"");document.getElementById("invPriceInput").value=x.p;invUpdateTradePreview()};
}


function invEsc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function invRound(n){return Math.round((Number(n)||0)*100)/100}
function invFactor(h){return h?.market==="US"?INV_USD_SAR:1}
function invCurrency(h){return h?.market==="US"?"USD":"SAR"}
function invMoney(n){return "SAR "+Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}
function invNativeMoney(n,currency){return String(currency||"SAR")+" "+Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}
function invTradeSort(a,b){return String(a.date||'').localeCompare(String(b.date||''))||String(a.createdAt||a.id||'').localeCompare(String(b.createdAt||b.id||''))}
function invTradeHolding(t){return invHoldings.find(h=>h.ticker===t.ticker)}
function invTradeAmounts(t){var h=invTradeHolding(t),currency=t.currency||invCurrency(h),gross=Number(t.qty||0)*Number(t.price||0),fee=Math.max(0,Number(t.fee||0));return{currency,gross,fee,net:t.type==="SELL"?Math.max(0,gross-fee):gross+fee,factor:invFactor(h)}}

function invEnsureLedgerV296(){
 var changed=false;
 invTrades=Array.isArray(invTrades)?invTrades:[];
 invTrades.forEach((t,i)=>{
  if(!t.id){t.id='INV-LEGACY-'+i+'-'+String(t.ticker||'STOCK')+'-'+String(t.date||'DATE');changed=true}
  if(t._cloudRecordId==null){t._cloudRecordId=String(i);changed=true}
  if(t.fee==null){t.fee=0;changed=true}
  if(!t.createdAt){t.createdAt=(t.date||new Date().toISOString().slice(0,10))+'T12:00:00.000Z';changed=true}
  if(!t.currency){t.currency=invCurrency(invTradeHolding(t));changed=true}
  if(t.type==="SELL"&&!t.settlementStatus){t.settlementStatus='pending';changed=true}
 });
 invHoldings.forEach(h=>{
  if(Number.isFinite(Number(h.ledgerBaseQty))&&Number.isFinite(Number(h.ledgerBaseAvg)))return;
  var state={qty:Number(h.qty||0),avg:Number(h.avg||0)};
  invTrades.filter(t=>t.ticker===h.ticker).sort(invTradeSort).reverse().forEach(t=>{
   var q=Math.max(0,Number(t.qty||0)),p=Math.max(0,Number(t.price||0));
   if(t.type==="SELL")state.qty+=q;
   else if(t.type==="BUY"){var priorQty=state.qty-q;if(priorQty>0)state.avg=Math.max(0,((state.qty*state.avg)-(q*p))/priorQty);state.qty=Math.max(0,priorQty)}
  });
  h.ledgerBaseQty=state.qty;h.ledgerBaseAvg=state.avg;changed=true;
 });
 if(changed){localStorage.setItem("pf_investments_holdings",JSON.stringify(invHoldings));localStorage.setItem("pf_investments_trades",JSON.stringify(invTrades))}
}
function invCalculatedHolding(ticker,trades=invTrades){
 var h=invHoldings.find(x=>x.ticker===ticker);if(!h)return null;
 var qty=Math.max(0,Number(h.ledgerBaseQty??h.qty??0)),avg=Math.max(0,Number(h.ledgerBaseAvg??h.avg??0));
 for(const t of trades.filter(x=>x.ticker===ticker).sort(invTradeSort)){
  var q=Math.max(0,Number(t.qty||0)),p=Math.max(0,Number(t.price||0));
  if(t.type==="BUY"){var next=qty+q;avg=next?((qty*avg)+(q*p))/next:avg;qty=next}
  else if(t.type==="SELL"){if(q>qty+.0000001)return null;qty-=q}
 }
 return{qty,avg};
}
function invRebuildHolding(ticker){var h=invHoldings.find(x=>x.ticker===ticker),state=invCalculatedHolding(ticker);if(!h||!state)return false;h.qty=state.qty;h.avg=state.avg;return true}
function invRebaseFromCurrent(ticker){
 var h=invHoldings.find(x=>x.ticker===ticker);if(!h)return;
 var state={qty:Number(h.qty||0),avg:Number(h.avg||0)};
 invTrades.filter(t=>t.ticker===ticker).sort(invTradeSort).reverse().forEach(t=>{
  var q=Math.max(0,Number(t.qty||0)),p=Math.max(0,Number(t.price||0));
  if(t.type==="SELL")state.qty+=q;
  else if(t.type==="BUY"){var prior=state.qty-q;if(prior>0)state.avg=Math.max(0,((state.qty*state.avg)-(q*p))/prior);state.qty=Math.max(0,prior)}
 });
 h.ledgerBaseQty=state.qty;h.ledgerBaseAvg=state.avg;
}
function invSave(reason='investment-edit'){localStorage.setItem("pf_investments_holdings",JSON.stringify(invHoldings));localStorage.setItem("pf_investments_trades",JSON.stringify(invTrades));if(typeof scheduleRecordPush==='function')scheduleRecordPush(reason);else if(typeof scheduleCloudAutoSave==="function")scheduleCloudAutoSave()}
function invTotals(){
 var value=0,cost=0,usValue=0,usCost=0,saValue=0,saCost=0;
 var holdings=Array.isArray(invHoldings)?invHoldings:[];
 holdings.forEach(h=>{
  var nativeValue=Number(h.qty||0)*Number(h.price||0),nativeCost=Number(h.qty||0)*Number(h.avg||0),f=invFactor(h);
  value+=nativeValue*f;cost+=nativeCost*f;
  if(h.market==='US'){usValue+=nativeValue;usCost+=nativeCost}else{saValue+=nativeValue;saCost+=nativeCost}
 });
 return{value,cost,pl:value-cost,pct:cost?(value-cost)/cost*100:0,usValue,usCost,saValue,saCost,usdSar:INV_USD_SAR}
}

function renderInvestments(){
 var body=document.getElementById("invBody");if(!body)return;invEnsureLedgerV296();
 var q=(document.getElementById("invSearch")?.value||"").toLowerCase(),market=document.getElementById("invMarket")?.value||"ALL",sort=document.getElementById("invSort")?.value||"value",t=invTotals();
 document.getElementById("invKpis").innerHTML=[["Portfolio Value",invMoney(t.value),"invNeutral","U.S. holdings "+invNativeMoney(t.usValue,"USD")+" ≈ "+invMoney(t.usValue*INV_USD_SAR)],["Total Cost",invMoney(t.cost),"invNeutral","U.S. cost "+invNativeMoney(t.usCost,"USD")+" ≈ "+invMoney(t.usCost*INV_USD_SAR)],["Unrealized Gain / Loss",(t.pl>=0?"+":"-")+invMoney(Math.abs(t.pl)),t.pl>=0?"invGood":"invBad","Combined Saudi and U.S. positions"],["Portfolio Return",(t.pct>=0?"+":"")+t.pct.toFixed(2)+"%",t.pct>=0?"invGood":"invBad","Based on converted SAR total"],["Holdings",String(invHoldings.filter(h=>h.qty>0).length),"invNeutral","Saudi + U.S. markets"]].map(x=>'<div class="invKpi"><span>'+x[0]+'</span><b class="'+x[2]+'">'+x[1]+'</b><small>'+x[3]+'</small></div>').join("");
 var rows=invHoldings.filter(h=>(market==="ALL"||h.market===market)&&(!q||h.ticker.toLowerCase().includes(q)||h.company.toLowerCase().includes(q)));
 rows.sort((a,b)=>{var val=h=>sort==="ticker"?h.ticker:sort==="pl"?h.qty*(h.price-h.avg)*invFactor(h):sort==="pct"?(h.avg?(h.price-h.avg)/h.avg:0):sort==="day"?Number(h.dayChangePct||0):h.qty*h.price*invFactor(h);var av=val(a),bv=val(b);return sort==="ticker"?String(av).localeCompare(String(bv)):bv-av});
 body.innerHTML=rows.map(h=>{
  var f=invFactor(h),nativeValue=h.qty*h.price,nativeCost=h.qty*h.avg,nativePl=nativeValue-nativeCost,value=nativeValue*f,cost=nativeCost*f,pl=value-cost,pct=cost?pl/cost*100:0,w=t.value?value/t.value*100:0,curr=invCurrency(h),day=Number(h.dayChange),dayPct=Number(h.dayChangePct),hasDay=h.dayChange!=null&&h.dayChangePct!=null&&Number.isFinite(day)&&Number.isFinite(dayPct),positionDayNative=day*h.qty,positionDaySar=positionDayNative*f,isUS=h.market==='US';
  var marketValueHtml=isUS?'<b>'+invNativeMoney(nativeValue,'USD')+'</b><small>≈ '+invMoney(value)+'</small>':'<b>'+invMoney(value)+'</b>';
  var plHtml=isUS?'<b>'+(nativePl>=0?'+':'-')+invNativeMoney(Math.abs(nativePl),'USD')+'</b><small>≈ '+(pl>=0?'+':'-')+invMoney(Math.abs(pl))+'</small>':'<b>'+(pl>=0?'+':'-')+invMoney(Math.abs(pl))+'</b>';
  var dayHtml=hasDay?'<b>'+(day>=0?'+':'-')+invNativeMoney(Math.abs(day),curr)+'</b><small>'+(dayPct>=0?'+':'')+dayPct.toFixed(2)+'% • Today’s P/L: '+(positionDayNative>=0?'+':'-')+invNativeMoney(Math.abs(positionDayNative),curr)+(isUS?' • ≈ '+(positionDaySar>=0?'+':'-')+invMoney(Math.abs(positionDaySar)):'')+'</small>':'<span class="meta">Refresh prices</span>';
  return '<tr><td><div class="invTicker">'+invEsc(h.ticker)+'</div><div class="meta">'+invEsc(h.company)+'</div></td><td><span class="invMarket '+h.market.toLowerCase()+'">'+(h.market==="SA"?"Saudi":"U.S.")+'</span></td><td><input class="invEdit" data-t="'+invEsc(h.ticker)+'" data-f="qty" type="number" min="0" step="any" value="'+h.qty+'"></td><td><input class="invEdit" data-t="'+invEsc(h.ticker)+'" data-f="avg" type="number" min="0" step="any" value="'+h.avg+'"><small>'+curr+'</small></td><td><b>'+Number(h.price).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})+'</b><small>'+curr+'</small></td><td class="'+(hasDay?(day>=0?'invGood':'invBad'):'')+'">'+dayHtml+'</td><td>'+marketValueHtml+'</td><td class="'+(pl>=0?"invGood":"invBad")+'">'+plHtml+'</td><td class="'+(pct>=0?"invGood":"invBad")+'"><b>'+(pct>=0?"+":"")+pct.toFixed(2)+'%</b></td><td>'+w.toFixed(1)+'%</td><td><small>Financial</small>'+invBadge(invAnalysis(h).financial)+'</td><td><small>Technical</small>'+invBadge(invAnalysis(h).technical)+'</td><td><small>Outlook</small>'+invBadge(invAnalysis(h).outlook)+'</td><td><small>Risk</small>'+invBadge(invAnalysis(h).risk)+'</td><td><b>'+invEsc(invAnalysis(h).action)+'</b><small>'+invEsc(invAnalysis(h).reason)+'</small></td><td><div class="invRowActions"><button class="btn invPlanBtn" data-t="'+invEsc(h.ticker)+'">Plan More</button><button class="btn invTradeBtn" data-t="'+invEsc(h.ticker)+'" data-type="BUY">Buy</button><button class="btn invTradeBtn" data-t="'+invEsc(h.ticker)+'" data-type="SELL">Sell</button></div></td></tr>';
 }).join("");
 body.querySelectorAll(".invEdit").forEach(el=>el.onchange=()=>{var h=invHoldings.find(x=>x.ticker===el.dataset.t);if(!h)return;h[el.dataset.f]=Math.max(0,Number(el.value)||0);invRebaseFromCurrent(h.ticker);invSave('investment-holding-edit');renderInvestments()});
 body.querySelectorAll(".invTradeBtn").forEach(b=>b.onclick=()=>invOpenTrade(b.dataset.t,b.dataset.type));
 body.querySelectorAll(".invPlanBtn").forEach(b=>b.onclick=()=>invOpenPlan(b.dataset.t));
 document.getElementById("invAllocation").innerHTML=invHoldings.filter(h=>h.qty>0).sort((a,b)=>b.qty*b.price*invFactor(b)-a.qty*a.price*invFactor(a)).slice(0,8).map(h=>{var v=h.qty*h.price*invFactor(h),p=t.value?v/t.value*100:0;return '<div class="invAlloc"><div><b>'+invEsc(h.ticker)+'</b><span>'+p.toFixed(1)+'%</span></div><div class="invBar"><i style="width:'+Math.max(1,p)+'%"></i></div></div>'}).join("");
 renderInvTrades();
 var st=document.getElementById("invStatus");if(st)st.innerHTML=invLastPriceUpdate?'Live prices last refreshed <b>'+new Date(invLastPriceUpdate).toLocaleString()+'</b>. Daily change compares the live price with the previous market close. U.S. holdings are converted at 3.75 SAR/USD.':'Saved prices are shown. Select <b>Refresh Live Prices</b> to update prices and daily changes.';
}
function renderInvTrades(){
 var el=document.getElementById('invTrades');if(!el)return;
 var rows=invTrades.slice().sort(invTradeSort).reverse().slice(0,20);
 el.innerHTML=rows.length?rows.map(x=>{
  var a=invTradeAmounts(x),sell=x.type==='SELL',pending=sell&&x.settlementStatus!=='settled';
  return '<div class="invTradeCard"><div class="invTradeMain"><div><span class="invTradeType '+x.type.toLowerCase()+'">'+invEsc(x.type)+'</span><b>'+invEsc(x.ticker)+'</b><span>'+Number(x.qty||0).toLocaleString('en-US')+' shares @ '+invNativeMoney(x.price,a.currency)+'</span></div><time>'+invEsc(x.date)+'</time></div><div class="invTradeTotals"><span>Gross<b>'+invNativeMoney(a.gross,a.currency)+'</b></span><span>Fee<b>'+invNativeMoney(a.fee,a.currency)+'</b></span><span>'+(sell?'Net proceeds':'Total cost')+'<b>'+invNativeMoney(a.net,a.currency)+'</b></span></div><div class="invTradeFoot">'+(sell?'<span class="invSettlementBadge '+(pending?'pending':'settled')+'">'+(pending?'Pending bank settlement':'Transferred to '+invEsc(x.bankAccountName||'bank'))+'</span>':'<span class="meta">Purchase recorded</span>')+'<div class="invTradeActions"><button type="button" class="btn small" data-inv-edit="'+invEsc(x.id)+'">Edit</button><button type="button" class="btn small danger" data-inv-delete="'+invEsc(x.id)+'">Delete</button>'+(pending?'<button type="button" class="btn small primary" data-inv-settle="'+invEsc(x.id)+'">Transfer to Bank</button>':'')+'</div></div></div>';
 }).join(''):'<div class="meta">No stock activity recorded yet.</div>';
 el.querySelectorAll('[data-inv-edit]').forEach(b=>b.onclick=()=>invEditTrade(b.dataset.invEdit));
 el.querySelectorAll('[data-inv-delete]').forEach(b=>b.onclick=()=>invDeleteTrade(b.dataset.invDelete));
 el.querySelectorAll('[data-inv-settle]').forEach(b=>b.onclick=()=>invOpenSettlement(b.dataset.invSettle));
}

async function invRefreshPrices(){
 var btn=document.getElementById("invRefresh"),st=document.getElementById("invStatus");if(!btn)return;btn.disabled=true;st.textContent="Refreshing market prices…";
  try{var symbols=invHoldings.map(h=>h.market==="SA"?h.ticker+".SR":h.ticker),r=await fetch("/api/stock-prices?symbols="+encodeURIComponent(symbols.join(",")),{cache:"no-store"});if(!r.ok)throw new Error("Price service unavailable");var j=await r.json(),ok=0;invHoldings.forEach(h=>{var s=h.market==="SA"?h.ticker+".SR":h.ticker,p=j.prices?.[s],price=Number(p?.price);if(price>0){h.price=price;h.previousClose=p.previousClose==null?null:Number(p.previousClose);h.dayChange=p.change==null?null:Number(p.change);h.dayChangePct=p.changePercent==null?null:Number(p.changePercent);h.priceAsOf=j.updatedAt||new Date().toISOString();ok++}});invLastPriceUpdate=new Date().toISOString();localStorage.setItem("pf_investments_price_time",invLastPriceUpdate);invSave('investment-price-refresh');renderInvestments();st.innerHTML="Updated <b>"+ok+"</b> of "+invHoldings.length+" holdings with live price and daily movement."}catch(e){st.textContent="Live price refresh could not complete. Saved prices were kept; no portfolio values were overwritten."}finally{btn.disabled=false}
}

function invEnsureModal(){
 if(document.getElementById("invModal"))return;
 var d=document.createElement("div");d.className="modalBack";d.id="invModal";d.innerHTML='<div class="modal"><div class="modalHead"><div><div class="modalTitle" id="invModalTitle">Stock Holding</div><div class="meta" id="invModalSub"></div></div><button class="closeBtn" type="button" id="invModalClose">✕</button></div><form id="invForm" class="formGrid"><input type="hidden" id="invMode"><input type="hidden" id="invTickerHidden"><input type="hidden" id="invTradeId"><div class="field"><label>Ticker</label><input id="invTickerInput" required></div><div class="field"><label>Company</label><input id="invCompany"></div><div class="field"><label>Market</label><select id="invMarketInput"><option value="SA">Saudi Arabia</option><option value="US">United States</option></select></div><div class="field"><label>Shares</label><input id="invQtyInput" type="number" min="0.000001" step="any" required></div><div class="field"><label>Price per Share</label><input id="invPriceInput" type="number" min="0.000001" step="any" required></div><div class="field" id="invFeeField"><label>Transaction Fee</label><input id="invFeeInput" type="number" min="0" step="0.01" value="0"></div><div class="field"><label>Date</label><input id="invDateInput" type="date" required></div><div class="field full invTradePreview" id="invTradePreview"></div><div class="field full" style="display:flex;justify-content:flex-end;gap:8px"><button type="button" class="btn" id="invCancel">Cancel</button><button class="btn primary" type="submit">Save</button></div></form></div>';document.body.appendChild(d);
 document.getElementById("invModalClose").onclick=document.getElementById("invCancel").onclick=()=>d.classList.remove("open");
 ['invQtyInput','invPriceInput','invFeeInput','invMarketInput'].forEach(id=>document.getElementById(id).addEventListener('input',invUpdateTradePreview));
 document.getElementById("invForm").onsubmit=invSubmitForm;
}
function invUpdateTradePreview(){var mode=document.getElementById('invMode')?.value,market=document.getElementById('invMarketInput')?.value||'SA',currency=market==='US'?'USD':'SAR',q=Number(document.getElementById('invQtyInput')?.value||0),p=Number(document.getElementById('invPriceInput')?.value||0),fee=Number(document.getElementById('invFeeInput')?.value||0),gross=q*p,total=mode==='SELL'?Math.max(0,gross-fee):gross+fee,el=document.getElementById('invTradePreview');if(!el)return;el.innerHTML=mode==='ADD'?'Initial holding value: <b>'+invNativeMoney(gross,currency)+'</b>':'Gross: <b>'+invNativeMoney(gross,currency)+'</b> • Fee: <b>'+invNativeMoney(fee,currency)+'</b> • '+(mode==='SELL'?'Net proceeds':'Total cost')+': <b>'+invNativeMoney(total,currency)+'</b>'}
function invSubmitForm(e){
 e.preventDefault();
 var mode=document.getElementById("invMode").value,ticker=(document.getElementById("invTickerHidden").value||document.getElementById("invTickerInput").value).trim().toUpperCase(),qty=Number(document.getElementById("invQtyInput").value)||0,price=Number(document.getElementById("invPriceInput").value)||0,fee=Math.max(0,Number(document.getElementById('invFeeInput').value)||0),date=document.getElementById("invDateInput").value,editId=document.getElementById('invTradeId').value;
 if(!(qty>0)||!(price>0)||!date)return alert('Enter valid shares, price and date.');
 if(mode==='SELL'&&fee>qty*price)return alert('Transaction fee cannot exceed the gross sale amount.');
 if(mode==="ADD"){
  if(invHoldings.some(h=>h.ticker===ticker))return alert("Ticker already exists.");
  invHoldings.push({ticker,company:document.getElementById("invCompany").value.trim()||ticker,market:document.getElementById("invMarketInput").value,qty,avg:price,price,ledgerBaseQty:qty,ledgerBaseAvg:price});
 }else{
  var h=invHoldings.find(x=>x.ticker===ticker);if(!h)return;
  var old=editId?invTrades.find(x=>x.id===editId):null,now=new Date().toISOString(),newId='INV-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),trade=old?{...old}:{id:newId,_cloudRecordId:newId,createdAt:now};
  trade.ticker=ticker;trade.type=mode;trade.qty=qty;trade.price=price;trade.fee=fee;trade.date=date;trade.currency=invCurrency(h);trade.updatedAt=now;
  if(mode==='SELL'){trade.settlementStatus='pending';delete trade.bankAccountId;delete trade.bankAccountName;delete trade.settledDate;delete trade.bankAmountSAR;delete trade.generatedTransactionId}
  var candidate=old?invTrades.map(x=>x.id===old.id?trade:x):[...invTrades,trade];
  if(!invCalculatedHolding(ticker,candidate))return alert('This sale exceeds the available shares for that date.');
  if(old?.settlementStatus==='settled')invUndoSettlement(old,true);
  invTrades=candidate;invRebuildHolding(ticker);
 }
 invSave(editId?'investment-trade-edit':'investment-trade-add');document.getElementById("invModal").classList.remove("open");renderInvestments();
}
function invOpenTrade(ticker,type){invEnsureModal();var h=invHoldings.find(x=>x.ticker===ticker),d=document.getElementById("invModal");document.getElementById("invMode").value=type;document.getElementById("invTradeId").value="";document.getElementById("invTickerHidden").value=ticker;document.getElementById("invTickerInput").value=ticker;document.getElementById("invTickerInput").disabled=true;document.getElementById("invCompany").value=h.company;document.getElementById("invCompany").disabled=true;document.getElementById("invMarketInput").value=h.market;document.getElementById("invMarketInput").disabled=true;document.getElementById("invQtyInput").value="";document.getElementById("invPriceInput").value=h.price;document.getElementById("invFeeInput").value="0";document.getElementById("invFeeField").style.display='';document.getElementById("invDateInput").value=new Date().toISOString().slice(0,10);document.getElementById("invModalTitle").textContent=(type==="BUY"?"Buy ":"Sell ")+ticker;document.getElementById("invModalSub").textContent=type==='SELL'?'Enter the broker fee. Proceeds remain pending until you transfer them to a bank account.':'Updates your portfolio record only; it does not place a broker order.';invUpdateTradePreview();d.classList.add("open")}
function invEditTrade(id){invEnsureModal();var x=invTrades.find(t=>t.id===id);if(!x)return;if(x.settlementStatus==='settled'&&!confirm('Editing this settled sale will reverse its bank deposit and return it to Pending. Continue?'))return;var h=invTradeHolding(x),d=document.getElementById('invModal');document.getElementById('invMode').value=x.type;document.getElementById('invTradeId').value=x.id;document.getElementById('invTickerHidden').value=x.ticker;document.getElementById('invTickerInput').value=x.ticker;document.getElementById('invTickerInput').disabled=true;document.getElementById('invCompany').value=h?.company||x.ticker;document.getElementById('invCompany').disabled=true;document.getElementById('invMarketInput').value=h?.market||'SA';document.getElementById('invMarketInput').disabled=true;document.getElementById('invQtyInput').value=x.qty;document.getElementById('invPriceInput').value=x.price;document.getElementById('invFeeInput').value=Number(x.fee||0);document.getElementById('invFeeField').style.display='';document.getElementById('invDateInput').value=x.date;document.getElementById('invModalTitle').textContent='Edit '+x.type+' '+x.ticker;document.getElementById('invModalSub').textContent='Changes rebuild the real holding quantity and average cost.';invUpdateTradePreview();d.classList.add('open')}
function invDeleteTrade(id){var x=invTrades.find(t=>t.id===id);if(!x)return;var warning=x.settlementStatus==='settled'?' This will also reverse the bank deposit and remove its generated transaction.':'';if(!confirm('Delete '+x.type+' '+x.ticker+' • '+x.qty+' shares?'+warning))return;if(x.settlementStatus==='settled')invUndoSettlement(x,true);if(typeof recordImmediateDelete==='function')recordImmediateDelete('investments_trades',x._cloudRecordId||x.id,'investment-trade-delete');invTrades=invTrades.filter(t=>t.id!==id);invRebuildHolding(x.ticker);invSave('investment-trade-delete');renderInvestments()}

function invEnsureSettlementModal(){
 if(document.getElementById('invSettlementModal'))return;
 var d=document.createElement('div');d.className='modalBack';d.id='invSettlementModal';d.innerHTML='<div class="modal"><div class="modalHead"><div><div class="modalTitle">Transfer Sale to Bank</div><div class="meta" id="invSettlementSub"></div></div><button class="closeBtn" type="button" id="invSettlementClose">✕</button></div><form id="invSettlementForm" class="formGrid"><input type="hidden" id="invSettlementTradeId"><div class="field full"><label>Receive Into Bank Account</label><select id="invSettlementBank" required></select></div><div class="field"><label>Amount Received (SAR)</label><input id="invSettlementAmount" type="number" min="0" step="0.01" required></div><div class="field"><label>Received Date</label><input id="invSettlementDate" type="date" required></div><div class="field full invTradePreview" id="invSettlementPreview"></div><div class="field full" style="display:flex;justify-content:flex-end;gap:8px"><button type="button" class="btn" id="invSettlementCancel">Cancel</button><button type="submit" class="btn primary">Confirm Bank Transfer</button></div></form></div>';document.body.appendChild(d);
 document.getElementById('invSettlementClose').onclick=document.getElementById('invSettlementCancel').onclick=()=>d.classList.remove('open');document.getElementById('invSettlementForm').onsubmit=invSettleTrade;
}
function invOpenSettlement(id){var x=invTrades.find(t=>t.id===id);if(!x||x.type!=='SELL'||x.settlementStatus==='settled')return;invEnsureSettlementModal();var banks=(typeof accounts!=='undefined'?accounts:[]).filter(a=>a.type==='bank');if(!banks.length)return alert('Add a bank account in My Finance before transferring the sale proceeds.');var a=invTradeAmounts(x),sar=invRound(a.net*a.factor);document.getElementById('invSettlementTradeId').value=x.id;document.getElementById('invSettlementBank').innerHTML=banks.map(b=>'<option value="'+invEsc(b.id)+'">'+invEsc(accountName(b.id))+'</option>').join('');document.getElementById('invSettlementAmount').value=sar.toFixed(2);document.getElementById('invSettlementDate').value=new Date().toISOString().slice(0,10);document.getElementById('invSettlementSub').textContent=x.ticker+' net proceeds '+invNativeMoney(a.net,a.currency);document.getElementById('invSettlementPreview').innerHTML='This creates a real transfer transaction and increases the selected bank balance by <b>'+invMoney(sar)+'</b>.';document.getElementById('invSettlementModal').classList.add('open')}
function invSettleTrade(e){
 e.preventDefault();var id=document.getElementById('invSettlementTradeId').value,x=invTrades.find(t=>t.id===id),bankId=document.getElementById('invSettlementBank').value,amount=Number(document.getElementById('invSettlementAmount').value),date=document.getElementById('invSettlementDate').value,bank=account(bankId);if(!x||x.type!=='SELL'||!bank||bank.type!=='bank'||!(amount>0)||!date)return alert('Check the bank account, amount and date.');
 var txId='investment-settlement-'+x.id;if(manualTransactions.some(t=>t._id===txId))return alert('This sale has already been transferred.');var tx={_id:txId,account:bank.id,date,posting:date,description:'Investment settlement received • '+x.ticker,amount:Math.abs(amount),category:'Financial Obligations',subcategory:'Savings / Investments',kind:'transfer',currency:'SAR',original:null,manual:true,investmentTradeId:x.id,notes:'Net stock sale proceeds transferred after broker settlement; recorded as a transfer, not income'};
 manualTransactions.push(tx);setTrackedBankBalance(bank.id,adjustedBankBalance(bank)+amount);x.settlementStatus='settled';x.bankAccountId=bank.id;x.bankAccountName=accountName(bank.id);x.bankAmountSAR=amount;x.settledDate=date;x.generatedTransactionId=txId;x.updatedAt=new Date().toISOString();localStorage.setItem('pf_manual_transactions',JSON.stringify(manualTransactions));invSave('investment-sale-settlement');if(typeof syncManualTransactionImmediate==='function')syncManualTransactionImmediate(tx);if(typeof recordImmediateUpsert==='function')recordImmediateUpsert('investments_trades',x._cloudRecordId||x.id,x,'investment-sale-settlement');document.getElementById('invSettlementModal').classList.remove('open');if(typeof rebuildTransactions==='function')rebuildTransactions();renderInvestments();try{if(typeof refreshAccountDependentUI==='function')refreshAccountDependentUI();else{renderDashboard();renderAccounts();}renderTransactions();if(typeof currentAccountDetailId!=='undefined'&&currentAccountDetailId===bank.id&&document.getElementById('accountDetail')?.classList.contains('active'))openAccount(bank.id,accountDetailReturnPage)}catch(_){ }
}
function invUndoSettlement(x,cloudDelete=false){if(!x||x.settlementStatus!=='settled')return;var bank=account(x.bankAccountId),amount=Number(x.bankAmountSAR||0),txId=x.generatedTransactionId;if(bank?.type==='bank')setTrackedBankBalance(bank.id,adjustedBankBalance(bank)-amount);if(txId){manualTransactions=manualTransactions.filter(t=>t._id!==txId);if(typeof transactionActions!=='undefined')delete transactionActions[txId];if(cloudDelete&&typeof recordImmediateDelete==='function')recordImmediateDelete('manual_transactions',txId,'investment-settlement-reverse')}x.settlementStatus='pending';delete x.bankAccountId;delete x.bankAccountName;delete x.bankAmountSAR;delete x.settledDate;delete x.generatedTransactionId;localStorage.setItem('pf_manual_transactions',JSON.stringify(manualTransactions));if(typeof rebuildTransactions==='function')rebuildTransactions()}
function invOpenAdd(){invEnsureModal();var d=document.getElementById("invModal");document.getElementById("invMode").value="ADD";document.getElementById("invTradeId").value="";document.getElementById("invTickerHidden").value="";document.getElementById("invTickerInput").disabled=false;document.getElementById("invTickerInput").value="";document.getElementById("invCompany").disabled=false;document.getElementById("invCompany").value="";document.getElementById("invMarketInput").disabled=false;document.getElementById("invMarketInput").value="SA";document.getElementById("invQtyInput").value="";document.getElementById("invPriceInput").value="";document.getElementById("invFeeInput").value="0";document.getElementById("invFeeField").style.display='none';document.getElementById("invDateInput").value=new Date().toISOString().slice(0,10);document.getElementById("invModalTitle").textContent="Add Stock Holding";document.getElementById("invModalSub").textContent="Add a Saudi or U.S. stock to your portfolio.";invUpdateTradePreview();d.classList.add("open")}

invEnsureAnalysisStyles();
invEnsureLedgerV296();
document.getElementById("invRefresh")?.addEventListener("click",invRefreshPrices);
document.getElementById("invAddHolding")?.addEventListener("click",invOpenAdd);
["invSearch","invMarket","invSort"].forEach(id=>document.getElementById(id)?.addEventListener(id==="invSearch"?"input":"change",renderInvestments));
