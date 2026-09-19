/* V283 Investments — integrated stock portfolio */
var INV_USD_SAR=3.75;
var INV_SEED=[
 {ticker:"7202",company:"Solutions by stc",market:"SA",qty:200,avg:271.95,price:216.90},
 {ticker:"2010",company:"SABIC",market:"SA",qty:125,avg:65.73,price:50.10},
 {ticker:"1180",company:"Saudi National Bank",market:"SA",qty:150,avg:38.93,price:43.40},
 {ticker:"4012",company:"Thob Al Aseel",market:"SA",qty:1200,avg:4.02,price:3.49},
 {ticker:"1010",company:"Riyad Bank",market:"SA",qty:200,avg:20.88,price:20.85},
 {ticker:"4001",company:"Abdullah Al Othaim Markets",market:"SA",qty:700,avg:11.00,price:4.98},
 {ticker:"4164",company:"Nahdi Medical",market:"SA",qty:25,avg:122.39,price:93.90},
 {ticker:"4003",company:"United Electronics (eXtra)",market:"SA",qty:35,avg:99.39,price:66.70},
 {ticker:"2020",company:"SABIC Agri-Nutrients",market:"SA",qty:20,avg:116.73,price:130.50},
 {ticker:"4190",company:"Jarir Marketing",market:"SA",qty:100,avg:13.86,price:17.10},
 {ticker:"4163",company:"Al-Dawaa Medical Services",market:"SA",qty:40,avg:74.71,price:39.00},
 {ticker:"1831",company:"Maharah Human Resources",market:"SA",qty:350,avg:5.39,price:4.65},
 {ticker:"4084",company:"Derayah Financial",market:"SA",qty:100,avg:30.00,price:22.18},
 {ticker:"LCID",company:"Lucid Group",market:"US",qty:15,avg:34.66,price:5.09},
 {ticker:"RIO",company:"Rio Tinto",market:"US",qty:8,avg:69.39,price:104.78}
];
var invHoldings=JSON.parse(localStorage.getItem("pf_investments_holdings")||"null")||JSON.parse(JSON.stringify(INV_SEED));
var invTrades=JSON.parse(localStorage.getItem("pf_investments_trades")||"[]");
var invLastPriceUpdate=localStorage.getItem("pf_investments_price_time")||"";
function invSave(){localStorage.setItem("pf_investments_holdings",JSON.stringify(invHoldings));localStorage.setItem("pf_investments_trades",JSON.stringify(invTrades));}
function invFactor(h){return h.market==="US"?INV_USD_SAR:1}
function invMoney(n){return "SAR "+Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}
function invTotals(){var value=0,cost=0;invHoldings.forEach(h=>{var f=invFactor(h);value+=h.qty*h.price*f;cost+=h.qty*h.avg*f});return{value,cost,pl:value-cost,pct:cost?(value-cost)/cost*100:0}}
function renderInvestments(){
 var body=document.getElementById("invBody");if(!body)return;
 var q=(document.getElementById("invSearch")?.value||"").toLowerCase(),market=document.getElementById("invMarket")?.value||"ALL",sort=document.getElementById("invSort")?.value||"value",t=invTotals();
 document.getElementById("invKpis").innerHTML=[
  ["Portfolio Value",invMoney(t.value),"invNeutral"],["Total Cost",invMoney(t.cost),"invNeutral"],["Unrealized Gain / Loss",(t.pl>=0?"+":"-")+invMoney(Math.abs(t.pl)),t.pl>=0?"invGood":"invBad"],["Portfolio Return",(t.pct>=0?"+":"")+t.pct.toFixed(2)+"%",t.pct>=0?"invGood":"invBad"],["Holdings",String(invHoldings.filter(h=>h.qty>0).length),"invNeutral"]
 ].map(x=>'<div class="invKpi"><span>'+x[0]+'</span><b class="'+x[2]+'">'+x[1]+'</b></div>').join("");
 var rows=invHoldings.filter(h=>(market==="ALL"||h.market===market)&&(!q||h.ticker.toLowerCase().includes(q)||h.company.toLowerCase().includes(q)));
 rows.sort((a,b)=>{var av=sort==="ticker"?a.ticker:(sort==="pl"?(a.qty*(a.price-a.avg)*invFactor(a)):(sort==="pct"?(a.avg?(a.price-a.avg)/a.avg:0):a.qty*a.price*invFactor(a)));var bv=sort==="ticker"?b.ticker:(sort==="pl"?(b.qty*(b.price-b.avg)*invFactor(b)):(sort==="pct"?(b.avg?(b.price-b.avg)/b.avg:0):b.qty*b.price*invFactor(b)));return sort==="ticker"?String(av).localeCompare(String(bv)):bv-av});
 body.innerHTML=rows.map(h=>{var f=invFactor(h),value=h.qty*h.price*f,cost=h.qty*h.avg*f,pl=value-cost,pct=cost?pl/cost*100:0,w=t.value?value/t.value*100:0,curr=h.market==="US"?"USD":"SAR";
 return '<tr><td><div class="invTicker">'+h.ticker+'</div><div class="meta">'+h.company+'</div></td><td><span class="invMarket '+h.market.toLowerCase()+'">'+(h.market==="SA"?"Saudi":"U.S.")+'</span></td><td><input class="invEdit" data-t="'+h.ticker+'" data-f="qty" type="number" min="0" step="any" value="'+h.qty+'"></td><td><input class="invEdit" data-t="'+h.ticker+'" data-f="avg" type="number" min="0" step="any" value="'+h.avg+'"><small>'+curr+'</small></td><td><b>'+Number(h.price).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})+'</b><small>'+curr+'</small></td><td><b>'+invMoney(value)+'</b></td><td class="'+(pl>=0?"invGood":"invBad")+'"><b>'+(pl>=0?"+":"-")+invMoney(Math.abs(pl))+'</b></td><td class="'+(pct>=0?"invGood":"invBad")+'"><b>'+(pct>=0?"+":"")+pct.toFixed(2)+'%</b></td><td>'+w.toFixed(1)+'%</td><td><div class="invRowActions"><button class="btn invTradeBtn" data-t="'+h.ticker+'" data-type="BUY">Buy</button><button class="btn invTradeBtn" data-t="'+h.ticker+'" data-type="SELL">Sell</button></div></td></tr>'}).join("");
 body.querySelectorAll(".invEdit").forEach(el=>el.onchange=()=>{var h=invHoldings.find(x=>x.ticker===el.dataset.t);h[el.dataset.f]=Math.max(0,Number(el.value)||0);invSave();renderInvestments()});
 body.querySelectorAll(".invTradeBtn").forEach(b=>b.onclick=()=>invOpenTrade(b.dataset.t,b.dataset.type));
 document.getElementById("invAllocation").innerHTML=invHoldings.filter(h=>h.qty>0).sort((a,b)=>b.qty*b.price*invFactor(b)-a.qty*a.price*invFactor(a)).slice(0,8).map(h=>{var v=h.qty*h.price*invFactor(h),p=t.value?v/t.value*100:0;return '<div class="invAlloc"><div><b>'+h.ticker+'</b><span>'+p.toFixed(1)+'%</span></div><div class="invBar"><i style="width:'+Math.max(1,p)+'%"></i></div></div>'}).join("");
 document.getElementById("invTrades").innerHTML=invTrades.length?invTrades.slice().reverse().slice(0,8).map(x=>'<div class="invTradeLine"><span><b>'+x.type+'</b> '+x.ticker+' • '+x.qty+' @ '+x.price+'</span><span>'+x.date+'</span></div>').join(""):'<div class="meta">No stock activity recorded yet.</div>';
 var st=document.getElementById("invStatus");if(st)st.innerHTML=invLastPriceUpdate?'Live prices last refreshed <b>'+new Date(invLastPriceUpdate).toLocaleString()+'</b>. U.S. holdings are converted at 3.75 SAR/USD.':'Saved prices are shown. Select <b>Refresh Live Prices</b> to update the market values.';
}
async function invRefreshPrices(){
 var btn=document.getElementById("invRefresh"),st=document.getElementById("invStatus");if(!btn)return;btn.disabled=true;st.textContent="Refreshing market prices…";
 try{var symbols=invHoldings.map(h=>h.market==="SA"?h.ticker+".SR":h.ticker);var r=await fetch("/api/stock-prices?symbols="+encodeURIComponent(symbols.join(",")),{cache:"no-store"});if(!r.ok)throw new Error("Price service unavailable");var j=await r.json(),ok=0;invHoldings.forEach(h=>{var s=h.market==="SA"?h.ticker+".SR":h.ticker,p=Number(j.prices?.[s]?.price);if(p>0){h.price=p;ok++}});invLastPriceUpdate=new Date().toISOString();localStorage.setItem("pf_investments_price_time",invLastPriceUpdate);invSave();renderInvestments();st.innerHTML="Updated <b>"+ok+"</b> of "+invHoldings.length+" holdings with current market data."}catch(e){st.textContent="Live price refresh could not complete. Saved prices were kept; no portfolio values were overwritten."}finally{btn.disabled=false}
}
function invEnsureModal(){
 if(document.getElementById("invModal"))return;
 var d=document.createElement("div");d.className="modalBack";d.id="invModal";d.innerHTML='<div class="modal"><div class="modalHead"><div><div class="modalTitle" id="invModalTitle">Stock Holding</div><div class="meta" id="invModalSub"></div></div><button class="closeBtn" type="button" id="invModalClose">✕</button></div><form id="invForm" class="formGrid"><input type="hidden" id="invMode"><input type="hidden" id="invTickerHidden"><div class="field"><label>Ticker</label><input id="invTickerInput" required></div><div class="field"><label>Company</label><input id="invCompany"></div><div class="field"><label>Market</label><select id="invMarketInput"><option value="SA">Saudi Arabia</option><option value="US">United States</option></select></div><div class="field"><label>Shares</label><input id="invQtyInput" type="number" min="0" step="any" required></div><div class="field"><label>Price</label><input id="invPriceInput" type="number" min="0" step="any" required></div><div class="field"><label>Date</label><input id="invDateInput" type="date" required></div><div class="field full" style="display:flex;justify-content:flex-end;gap:8px"><button type="button" class="btn" id="invCancel">Cancel</button><button class="btn primary" type="submit">Save</button></div></form></div>';document.body.appendChild(d);
 document.getElementById("invModalClose").onclick=document.getElementById("invCancel").onclick=()=>d.classList.remove("show");
 document.getElementById("invForm").onsubmit=e=>{e.preventDefault();var mode=document.getElementById("invMode").value,ticker=(document.getElementById("invTickerHidden").value||document.getElementById("invTickerInput").value).trim().toUpperCase(),qty=Number(document.getElementById("invQtyInput").value)||0,price=Number(document.getElementById("invPriceInput").value)||0,date=document.getElementById("invDateInput").value;
  if(mode==="ADD"){if(invHoldings.some(h=>h.ticker===ticker)){alert("Ticker already exists.");return}invHoldings.push({ticker,company:document.getElementById("invCompany").value.trim()||ticker,market:document.getElementById("invMarketInput").value,qty,avg:price,price});}
  else{var h=invHoldings.find(x=>x.ticker===ticker);if(!h)return;if(mode==="BUY"){var nq=h.qty+qty;h.avg=nq?((h.qty*h.avg)+(qty*price))/nq:h.avg;h.qty=nq}else{if(qty>h.qty){alert("Sell quantity cannot exceed current shares.");return}h.qty-=qty}h.price=price;invTrades.push({ticker,type:mode,qty,price,date});}
  invSave();d.classList.remove("show");renderInvestments();
 };
}
function invOpenTrade(ticker,type){invEnsureModal();var h=invHoldings.find(x=>x.ticker===ticker),d=document.getElementById("invModal");document.getElementById("invMode").value=type;document.getElementById("invTickerHidden").value=ticker;document.getElementById("invTickerInput").value=ticker;document.getElementById("invTickerInput").disabled=true;document.getElementById("invCompany").value=h.company;document.getElementById("invCompany").disabled=true;document.getElementById("invMarketInput").value=h.market;document.getElementById("invMarketInput").disabled=true;document.getElementById("invQtyInput").value="";document.getElementById("invPriceInput").value=h.price;document.getElementById("invDateInput").value=new Date().toISOString().slice(0,10);document.getElementById("invModalTitle").textContent=(type==="BUY"?"Buy ":"Sell ")+ticker;document.getElementById("invModalSub").textContent="Updates your portfolio record only; it does not place a broker order.";d.classList.add("show")}
function invOpenAdd(){invEnsureModal();var d=document.getElementById("invModal");document.getElementById("invMode").value="ADD";document.getElementById("invTickerHidden").value="";document.getElementById("invTickerInput").disabled=false;document.getElementById("invTickerInput").value="";document.getElementById("invCompany").disabled=false;document.getElementById("invCompany").value="";document.getElementById("invMarketInput").disabled=false;document.getElementById("invMarketInput").value="SA";document.getElementById("invQtyInput").value="";document.getElementById("invPriceInput").value="";document.getElementById("invDateInput").value=new Date().toISOString().slice(0,10);document.getElementById("invModalTitle").textContent="Add Stock Holding";document.getElementById("invModalSub").textContent="Add a Saudi or U.S. stock to your portfolio.";d.classList.add("show")}
document.getElementById("invRefresh")?.addEventListener("click",invRefreshPrices);
document.getElementById("invAddHolding")?.addEventListener("click",invOpenAdd);
["invSearch","invMarket","invSort"].forEach(id=>document.getElementById(id)?.addEventListener(id==="invSearch"?"input":"change",renderInvestments));
