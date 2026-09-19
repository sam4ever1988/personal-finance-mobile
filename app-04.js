function payGoldZakat(id){const a=goldAssets.find(x=>x.id===id);if(!a||!goldZakatDue(a))return;const w=activeGoldWeight(a),value=goldAssetValue(a),amount=Math.round(value*.025*100)/100,due=goldNextDue(a);const sources=[{id:'cash-source',name:'Monthly Planned Income'},...accounts.filter(x=>x.type==='bank').map(x=>({id:x.id,name:accountName(x.id)}))];const ch=Number(prompt(`Zakat due ${money(amount)}\nPay from:\n`+sources.map((x,i)=>`${i+1}. ${x.name}`).join('\n'),'1'))||1;const src=sources[Math.max(0,Math.min(sources.length-1,ch-1))];if(!confirm(`Record Zakat payment of ${money(amount)} from ${src.name}?`))return;const date=new Date().toISOString().slice(0,10),h=hijriParts(new Date(due+'T12:00:00'));goldZakatHistory.push({id:'ZAK-'+Date.now(),assetId:a.id,assetName:a.name,hijriCycle:String(h.year),weight:w,valueUsed:value,amount,paidDate:date,sourceId:src.id,sourceName:src.name});cashFlowLedger.push({id:'cfl-zakat-'+Date.now(),type:'zakat-payment',date,month:date.slice(0,7),amount,direction:'out',description:`Gold Zakat • ${a.name}`,sourceId:src.id,targetId:a.id,status:'active'});if(src.id!=='cash-source'){const ba=account(src.id);if(ba?.type==='bank')setTrackedBankBalance(ba.id,adjustedBankBalance(ba)-amount);}saveV194Data();localStorage.setItem('pf_cash_flow_ledger',JSON.stringify(cashFlowLedger));saveLocal();renderGoldAssets();renderDashboard();renderIncomePlan();renderAccounts();}
async function refreshGoldMarketPrice(){renderGoldAssets();try{if($('goldPriceMeta'))$('goldPriceMeta').textContent='Refreshing live gold price…';const r=await fetch('https://api.gold-api.com/price/XAU',{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const j=await r.json();const usdOz=Number(j.price||j.ask||0);if(!usdOz)throw Error('No price returned');goldMarket={price24k:usdOz*3.75/31.1034768,updatedAt:new Date().toISOString(),source:'Gold-API XAU/USD × 3.75 SAR/USD',manual:false};saveV194Data();renderGoldAssets();}catch(e){renderGoldAssets();if($('goldPriceMeta'))$('goldPriceMeta').textContent='Live price unavailable • '+e.message+' • use Manual Price';}}
function manualGoldMarketPrice(){const v=Number(prompt('24K gold price per gram in SAR:',Number(goldMarket.price24k||0).toFixed(2)));if(!Number.isFinite(v)||v<=0)return;goldMarket={price24k:v,updatedAt:new Date().toISOString(),source:'Manual Saudi market price',manual:true};saveV194Data();renderGoldAssets();}
function addCustomCreditCard(){const bank=prompt('Bank name:');if(!bank)return;const name=prompt('Card name (example: Visa Signature):');if(!name)return;const ending=(prompt('Last 4 digits:')||'').replace(/\D/g,'').slice(-4);if(ending.length!==4)return alert('Enter 4 digits.');const limit=Number(prompt('Credit limit (SAR):','0'));if(!Number.isFinite(limit)||limit<0)return;const statementDay=Math.max(1,Math.min(31,Number(prompt('Statement closing day (1-31):','25'))||25));const dueDay=Math.max(1,Math.min(31,Number(prompt('Payment due day (1-31):','15'))||15));const id='custom-card-'+ending+'-'+Date.now();const c={id,bank,name,ending,type:'card',extra:{'Credit Limit':limit},custom:true,physicalCards:[ending]};customCreditCards.push(c);accounts.push(c);financeSettings.cardCycles[id]={statementDay,dueDay};localStorage.setItem('pf_finance_settings',JSON.stringify(financeSettings));saveV194Data();saveLocal();renderCustomCreditCards();renderCustomBanks();renderFinanceSettings();renderDashboard();renderAccounts();alert('Credit card created. It now uses the standard card transaction, planner and installment logic.');}
function renderCustomCreditCards(){const el=$('customCreditCardsList');if(!el)return;el.innerHTML=customCreditCards.length?customCreditCards.map(c=>`<div class="notice" style="margin-bottom:7px"><b>${escapeHtml(c.bank)} • ${escapeHtml(c.name)} •${c.ending}</b> • Limit ${money(Number(c.extra?.['Credit Limit']||0))}</div>`).join(''):'<div class="meta">No manually added cards yet.</div>';}



function execCanvas(id,draw){
 const cv=$(id);if(!cv)return;
 const r=cv.getBoundingClientRect(),p=cv.parentElement?.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
 const hidden=!r.width||!r.height;if(hidden){setTimeout(()=>{const el=$(id);if(el&&el.getBoundingClientRect().width)execCanvas(id,draw)},180);return;}
 const w=Math.max(120,Math.round(r.width||p?.width||cv.clientWidth||220));
 const h=Math.max(100,Math.round(r.height||p?.height||cv.clientHeight||140));
 cv.style.width=w+'px';cv.style.height=h+'px';cv.width=Math.floor(w*dpr);cv.height=Math.floor(h*dpr);
 const x=cv.getContext('2d');if(!x)return;x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,w,h);draw(x,w,h);
}
function execDonut(id,vals,labels,center,colors){
 const palette=Array.isArray(colors)&&colors.length?colors:['#31d7a1','#7657ff','#ff6577','#ffc44d','#3d9cff'];
 execCanvas(id,(x,w,h)=>{const total=vals.reduce((a,b)=>a+Math.max(0,b),0),cx=w/2,cy=h/2,r=Math.min(w,h)*.38,inner=r*.62;
  if(!total){x.strokeStyle='#173a50';x.lineWidth=r-inner;x.beginPath();x.arc(cx,cy,(r+inner)/2,0,Math.PI*2);x.stroke();}
  else{let a=-Math.PI/2;vals.forEach((v,i)=>{const n=Math.max(0,v),b=a+Math.PI*2*n/total;x.beginPath();x.strokeStyle=palette[i%palette.length];x.lineWidth=r-inner;x.arc(cx,cy,(r+inner)/2,a,b);x.stroke();a=b;});}
  x.fillStyle='#eaf4ff';x.textAlign='center';x.font='800 18px system-ui';x.fillText(center,cx,cy+5);
 });
}
function execGoldTrend(id,current){
 const vals=[];for(let i=5;i>=0;i--){const d=new Date();d.setMonth(d.getMonth()-i);const factor=1-(i*.012);vals.push({label:d.toLocaleString('en',{month:'short'}),value:Math.max(0,current*factor)});}
 execCanvas(id,(x,w,h)=>{const pad=24,max=Math.max(1,...vals.map(v=>v.value));x.strokeStyle='#173a50';x.lineWidth=1;[0,.5,1].forEach(q=>{const y=pad+(h-pad*2)*q;x.beginPath();x.moveTo(pad,y);x.lineTo(w-pad,y);x.stroke();});
  x.strokeStyle='#31d7a1';x.lineWidth=2;x.beginPath();vals.forEach((v,i)=>{const px=pad+i*(w-pad*2)/(vals.length-1),py=h-pad-(v.value/max)*(h-pad*2);i?x.lineTo(px,py):x.moveTo(px,py);});x.stroke();
  x.fillStyle='#91aabd';x.font='10px system-ui';x.textAlign='center';vals.forEach((v,i)=>x.fillText(v.label,pad+i*(w-pad*2)/(vals.length-1),h-5));
 });
}
function executiveUpcomingPayments(){
 const today=new Date(),items=[],ym=currentPlanMonth();
 const nextDate=(day=1)=>{const d=new Date(today.getFullYear(),today.getMonth(),Math.max(1,Math.min(28,Number(day)||1)));if(d<today)d.setMonth(d.getMonth()+1);return d;};
 // Use the application's EXISTING planner functions only. Do not manufacture planner rows here.
 (cardPaymentPlan||[]).filter(p=>p && p.accountId && String(p.month||'')>=String(ym||'')).forEach(p=>{
  let amt=0;try{amt=Math.max(0,Number(paymentRemainingAmount(p)||0));}catch(_){amt=Math.max(0,Number(p.amount||0)-Number(p.paidAmount||0));}
  if(amt>.005){
   const a=account(p.accountId);let dueDay=25;try{dueDay=Number(cardCycleSetting(p.accountId)?.dueDay||25);}catch(_){}
   const parts=String(p.month||ym).split('-').map(Number),d=new Date(parts[0]||today.getFullYear(),Math.max(0,(parts[1]||today.getMonth()+1)-1),Math.max(1,Math.min(28,dueDay)));
   if(!isNaN(d))items.push({date:d,kind:'Credit Card',label:a?((a.bank||'Card')+' •'+(a.ending||'')):(p.label||'Credit Card'),amount:amt});
  }
 });
 (financeSettings.loans||[]).filter(l=>String(l.status||'').toLowerCase()!=='closed').forEach(l=>{
  const amt=Math.max(0,Number(l.monthly||l.monthlyPayment||l.monthlyInstallment||l.installmentAmount||l.paymentAmount||l.emi||0));
  if(amt>.005)items.push({date:nextDate(l.dueDay||l.paymentDay||1),kind:'Personal Loan',label:l.name||l.bank||l.lender||'Personal Loan',amount:amt});
 });
 (installments||[]).filter(p=>!p.completedConfirmed&&String(p.status||'').toLowerCase()!=='completed').forEach(p=>{
  let amt=0;try{amt=Math.max(0,Number(planCalc(p).monthly||0));}catch(_){}
  if(amt>.005)items.push({date:nextDate(p.dueDay||1),kind:'Installment',label:p.merchant||p.description||'Installment',amount:amt});
 });
 (goldAssets||[]).filter(a=>activeGoldWeight(a)>0.0001&&goldZakatDue(a)).forEach(a=>{const ds=goldNextDue(a),d=ds?new Date(ds+'T12:00:00'):null;if(d&&!isNaN(d))items.push({date:d,kind:'Zakat',label:a.name||'Gold Zakat',amount:goldAssetValue(a)*.025});});
 return items.filter(x=>x.amount>.005&&x.date instanceof Date&&!isNaN(x.date)).sort((a,b)=>a.date-b.date).slice(0,6);
}
function renderExecutiveDashboard(){
 if(!$('executive'))return;
 const safe=(id,html)=>{const el=$(id);if(el)el.innerHTML=html};
 const income=totalIncomePlan(),loans=totalFixedLoans(),other=outgoingThisMonthTotal(),paid=remainingIncomePaymentsTotal(),remaining=remainingIncomeAvailable();
 const cards=accounts.filter(a=>a.type==='card'),banks=accounts.filter(a=>a.type==='bank'),cm=cards.map(a=>({a,m:cardMetrics(a)}));
 const cardUsed=cm.reduce((s,x)=>s+Number(x.m.total||0),0),cardAvail=cm.reduce((s,x)=>s+Math.max(0,Number(x.m.available||0)),0),cardLimit=cardUsed+cardAvail;
 const bank= banks.reduce((s,a)=>s+adjustedBankBalance(a),0);
 const activeGold=goldAssets.filter(a=>activeGoldWeight(a)>0.0001),goldWeight=activeGold.reduce((s,a)=>s+activeGoldWeight(a),0),goldValue=activeGold.reduce((s,a)=>s+goldAssetValue(a),0),zakat=activeGold.filter(goldZakatDue).reduce((s,a)=>s+goldAssetValue(a)*.025,0);
 const installmentLiability=installments.filter(p=>p.status!=='completed').reduce((s,p)=>s+Math.max(0,Number(p.remainingPrincipal||p.remainingAmount||0)),0);
 const loanLiability=(financeSettings.loans||[]).filter(l=>l.status!=='closed').reduce((s,l)=>s+Math.max(0,Number(l.remainingAmount||0)),0);
 const otherAssets=Math.max(0,Number(financeSettings.otherAssetsValue||financeSettings.otherAssets||0)),totalAssets=bank+goldValue+otherAssets,totalLiabilities=loanLiability+cardUsed+installmentLiability,net=totalAssets-totalLiabilities;
 if($('execUpdated'))$('execUpdated').textContent='Updated '+new Date().toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
 const remainingPct=(income?remaining/income*100:0).toFixed(1);
 const ks=[
  ['Monthly Income',income,'<span class="kpiUp">↑</span> vs last month <strong>+0%</strong>'],
  ['Remaining Monthly Cash',remaining,remainingPct+'% of income <svg class="kpiSpark" viewBox="0 0 42 14" aria-hidden="true"><polyline points="1,11 7,8 12,10 19,4 25,7 33,2 41,6"/></svg>'],
  ['Bank Balance',bank,banks.length+' account'+(banks.length===1?'':'s')],
  ['Total Credit Available',cardAvail,cards.length+' credit card'+(cards.length===1?'':'s')],
  ['Gold Assets Value',goldValue,goldWeight.toFixed(2)+' g'],
  ['Total Assets (Net)',net,'Assets '+money(totalAssets)+' | Liabilities '+money(totalLiabilities)]
 ];
 {const icons=[
'<svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="15" rx="3"/><path d="M9 5V3h6v2M9 10h6M12 8v9M9.5 15.5c1.5 1 3.8.7 4.5-.4.8-1.3-.3-2.2-2-2.5-1.8-.3-2.8-1.1-2.1-2.3.6-1.1 2.7-1.3 4.1-.4"/></svg>',
'<svg viewBox="0 0 24 24"><path d="M4 8h13a3 3 0 0 1 3 3v7H5a3 3 0 0 1-3-3V8.8C2 6.7 3.4 5 5.5 4.5L16 2v4"/><path d="M15 11h5v4h-5a2 2 0 1 1 0-4Z"/></svg>',
'<svg viewBox="0 0 24 24"><path d="m3 9 9-6 9 6H3Z"/><path d="M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18"/></svg>',
'<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></svg>',
'<svg viewBox="0 0 24 24"><path d="m7 5 2-3h6l2 3-2 6H9L7 5Z"/><path d="m3 14 2-3h6l2 3-2 6H5l-2-6ZM11 14l2-3h6l2 3-2 6h-6l-2-6Z"/></svg>',
'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3v9h9"/></svg>'
];$('execKpis').innerHTML=ks.map((x,i)=>'<div class="execKpi"><span class="execKpiIcon">'+icons[i]+'</span><div class="execKpiText"><small>'+x[0]+'</small><b class="'+(i===5?(x[1]>=0?'execGood':'execBad'):'')+'">'+money(x[1])+'</b><em>'+x[2]+'</em></div></div>').join('');}
 {const base=Math.max(1,income), p=[100,loans/base*100,other/base*100,paid/base*100,remaining/base*100], monthLabel=new Date().toLocaleDateString('en-US',{month:'short',year:'numeric'});$('execCashFlow').innerHTML='<div class="execFlowMonth">'+monthLabel+'</div><div class="execFlow">'+[['Income',income],['Bank Loans',loans],['Cash / Other',other],['Card Payments',paid],['Remaining',remaining]].map(x=>'<div><small>'+x[0]+'</small><b>'+Number(x[1]||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</b></div>').join('')+'<div class="execFlowPct">'+p.map(v=>'<span>'+v.toFixed(1)+'%</span>').join('')+'</div><div class="execFlowLegend">'+[['Income',income],['Loans',loans],['Other',other],['Card Payments',paid],['Remaining',remaining]].map(x=>'<span>'+x[0]+'<br><b>'+money(x[1])+'</b></span>').join('')+'</div></div>';}
 $('execCredit').innerHTML=cm.map(x=>{const usedPct=(x.m.total+x.m.available)>0?Math.min(100,Math.max(0,x.m.total/(x.m.total+x.m.available)*100)):0,availPct=100-usedPct;return '<div class="execRow"><div><div class="execCreditName">'+bankLogoHTML(x.a).replace('bankLogoBox','bankLogoBox execLogoSmall')+'<b>'+escapeHtml(x.a.bank)+' •'+escapeHtml(x.a.ending)+'</b></div><div class="execBar"><i style="width:'+availPct.toFixed(1)+'%"></i></div></div><div style="text-align:right"><b>'+money(x.m.available)+' / '+money(x.m.total+x.m.available)+'</b><br><span class="execCreditPct">'+availPct.toFixed(0)+'%</span></div></div>'}).join('');
 const util=cardLimit?cardUsed/cardLimit*100:0;$('execUtil').innerHTML='<small><span style="color:#8a52ff">●</span> Used <b>'+money(cardUsed)+'</b><br><span style="color:#35e59b">●</span> Available <b>'+money(cardAvail)+'</b></small>';
 $('execBanks').innerHTML=banks.map(a=>'<div class="execRow"><span class="execCreditName">'+bankLogoHTML(a).replace('bankLogoBox','bankLogoBox execLogoSmall')+escapeHtml(a.bank)+' •'+escapeHtml(a.ending||'')+'</span><b class="execGood">'+money(adjustedBankBalance(a))+'</b></div>').join('')||'<small>No bank accounts</small>';
 $('execGold').innerHTML='<div class="execRow"><span>Total Weight</span><b>'+goldWeight.toFixed(2)+' g</b></div><div class="execRow"><span>Current Value</span><b>'+money(goldValue)+'</b></div><div class="execRow"><span>Next Zakat Due</span><b>'+(activeGold.length?activeGold.map(a=>goldNextDue(a)).filter(Boolean).sort()[0]||'—':'—')+'</b></div>';
 $('execZakat').innerHTML='<div class="execRow"><span>Total Zakat Due</span><b>'+money(zakat)+'</b></div><div class="execRow"><span>🔴 Due Now</span><b>'+money(zakat)+'</b></div><div class="execRow"><span>🟡 Upcoming</span><b>'+money(0)+'</b></div><div class="execRow"><span>🟢 Paid This Year</span><b>'+money(0)+'</b></div><div class="execRow"><span>▣ Next Due Date</span><b>'+(activeGold.length?activeGold.map(a=>goldNextDue(a)).filter(Boolean).sort()[0]||'—':'—')+'</b></div>';
 $('execPosition').innerHTML='<div class="execPositionCards"><div class="execPosCard"><small>↗ Total Asset</small><b class="execGood">'+money(totalAssets)+'</b></div><div class="execPosCard"><small>↘ Total Liabilities</small><b class="execBad">'+money(totalLiabilities)+'</b></div><div class="execPosCard"><small>↗ Net Position</small><b>'+money(net)+'</b></div></div>';
 $('execAssets').innerHTML='<div class="execRow"><span>🟢 Bank Accounts</span><b>'+money(bank)+'</b></div><div class="execRow"><span>🟡 Gold</span><b>'+money(goldValue)+'</b></div><div class="execRow"><span>🔵 Other Assets</span><b>'+money(otherAssets)+'</b></div>';
 $('execLiabilities').innerHTML='<div class="execRow"><span>🔴 Personal Loans</span><b>'+money(loanLiability)+'</b></div><div class="execRow"><span>🔴 Credit Cards</span><b>'+money(cardUsed)+'</b></div><div class="execRow"><span>🟢 Installments</span><b>'+money(installmentLiability)+'</b></div>';
 const future=executiveUpcomingPayments();
 $('execUpcoming').innerHTML=future.length?future.map(p=>{const days=Math.ceil((p.date-new Date())/86400000);return '<div class="execRow"><div><b>'+p.date.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})+'</b> • '+escapeHtml(p.kind)+'<br><small>'+escapeHtml(p.label)+'</small></div><div style="text-align:right"><b>'+money(p.amount)+'</b><br><span class="execDueBadge '+(days<=7?'soon':'')+'">'+Math.max(0,days)+' days</span></div></div>'}).join(''):'<div class="execEmpty">No upcoming payable obligations recorded.</div>';
 const drawExecCharts=()=>{if(!$('executive'))return;
  const fallback=(id,label)=>{const cv=$(id);if(!cv)return;const box=cv.parentElement;if(box&&!box.querySelector('.execChartFallback')){const d=document.createElement('div');d.className='execChartFallback';d.textContent=label;box.appendChild(d);}};execDonut('execCreditChart',[cardUsed,cardAvail],['Used','Available'],util.toFixed(0)+'%',['#7657ff','#31d7a1']);execDonut('execAssetsChart',[bank,goldValue,otherAssets],['Bank','Gold','Other'],'100%',['#31d7a1','#ffc44d','#3d9cff']);execDonut('execLiabilitiesChart',[loanLiability,cardUsed,installmentLiability],['Loans','Cards','Installments'],'100%',['#ff4d5f','#d91f32','#31d45b']);execGoldTrend('execGoldChart',goldValue);};
 // V261: draw once after layout settles. Repeated 120/350/800/1500ms redraws
 // made the Executive Overview feel slow and recreated canvases unnecessarily.
 requestAnimationFrame(()=>requestAnimationFrame(drawExecCharts));
}


function renderFinancialPosition(){
 const el=$('financialposition');if(!el)return;
 const cards=accounts.filter(a=>a.type==='card'),banks=accounts.filter(a=>a.type==='bank');
 const cm=cards.map(a=>cardMetrics(a));
 const cardUsed=cm.reduce((s,x)=>s+Math.max(0,Number(x.total||0)),0);
 const bank=banks.reduce((s,a)=>s+Number(adjustedBankBalance(a)||0),0);
 const activeGold=goldAssets.filter(a=>activeGoldWeight(a)>0.0001),goldValue=activeGold.reduce((s,a)=>s+Number(goldAssetValue(a)||0),0);
 const otherAssets=Math.max(0,Number(financeSettings.otherAssetsValue||financeSettings.otherAssets||0));
 const loans=(financeSettings.loans||[]).filter(l=>l.status!=='closed').reduce((s,l)=>s+Math.max(0,Number(l.remainingAmount||0)),0);
 const installmentLiability=installments.filter(p=>p.status!=='completed').reduce((s,p)=>s+Math.max(0,Number(p.remainingPrincipal||p.remainingAmount||0)),0);
 const totalAssets=bank+goldValue+otherAssets,totalLiabilities=loans+cardUsed+installmentLiability,net=totalAssets-totalLiabilities;
 const metrics=[['Total Assets',totalAssets,'Bank + gold + other assets'],['Bank / Cash',bank,banks.length+' accounts'],['Gold & Other',goldValue+otherAssets,'Investable / owned assets'],['Total Liabilities',totalLiabilities,'Cards + loans + installments'],['Credit Cards',cardUsed,cards.length+' cards'],['Net Position',net,'Assets less liabilities']];
 $('fpKpis').innerHTML=metrics.map((x,i)=>`<div class="modernMetric"><small>${x[0]}</small><b class="${i===3||i===4?'red':i===5&&x[1]<0?'red':'green'}">${money(x[1])}</b><em>${x[2]}</em></div>`).join('');
 $('fpAssets').innerHTML=`<div class="fpRow"><span>Bank Accounts</span><b>${money(bank)}</b></div><div class="fpRow"><span>Gold Assets</span><b>${money(goldValue)}</b></div><div class="fpRow"><span>Other Assets</span><b>${money(otherAssets)}</b></div><div class="fpRow"><span>Total Assets</span><b class="green">${money(totalAssets)}</b></div>`;
 $('fpLiabilities').innerHTML=`<div class="fpRow"><span>Personal Loans</span><b class="red">${money(loans)}</b></div><div class="fpRow"><span>Credit Cards</span><b class="red">${money(cardUsed)}</b></div><div class="fpRow"><span>Installment Liabilities</span><b class="red">${money(installmentLiability)}</b></div><div class="fpRow"><span>Total Liabilities</span><b class="red">${money(totalLiabilities)}</b></div>`;
 $('fpSummary').innerHTML=`<div class="fpSummaryCards"><div class="fpSummaryCard"><small>Total Assets</small><b class="green">${money(totalAssets)}</b></div><div class="fpSummaryCard"><small>Total Liabilities</small><b class="red">${money(totalLiabilities)}</b></div><div class="fpSummaryCard"><small>Net Position</small><b class="${net>=0?'green':'red'}">${money(net)}</b></div></div>`;
}

function renderDashboard(){
 const s=summaryData();
 const cardMetricsAll=accounts.filter(a=>a.type==='card').map(a=>cardMetrics(a));
 const obligations=cardMetricsAll.reduce((sum,m)=>sum+m.total,0);
 const currentCardBalance=cardMetricsAll.reduce((sum,m)=>sum+m.current,0);
 const reservedInstallments=cardMetricsAll.reduce((sum,m)=>sum+m.inst,0);
 const monthlyPlannedIncome=totalIncomePlan(), monthlyCardPayments=remainingIncomePaymentsTotal(), remainingMonthlyIncome=remainingIncomeAvailable();
 if($('dashKpis'))$('dashKpis').innerHTML=[
  kpiHTML('Monthly Planned Income',money(monthlyPlannedIncome),`Paid from Monthly Planned Income: ${money(monthlyCardPayments)}`,'green'),
  kpiHTML('Remaining for Card Payments',money(remainingMonthlyIncome),'After loans, outgoings and card payments already recorded',remainingMonthlyIncome>=0?'green':'red'),
  kpiHTML('Current Card Balance',money(currentCardBalance),`Excludes ${money(reservedInstallments)} reserved in installment plans`,'red'),
  kpiHTML('Total Card Bank Utilization',money(obligations),'Current balance + reserved installment principal','amber')
 ].join('');
 if($('sideBalance'))$('sideBalance').textContent=money(currentBankBalance());
 if($('sideUpdatedDate'))$('sideUpdatedDate').textContent='Updated '+new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
 renderDashboardRemainingBalances();
 if($('dashAccounts'))$('dashAccounts').innerHTML=accounts.map(accountCardHTML).join('');
 bindAccountCards();
 const rows=normalizedTx().slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10);
 if($('recentBody'))$('recentBody').innerHTML=rows.map(txRow5).join('');
 renderReviewAlerts();renderPaymentPlanner();
 if(document.getElementById('executive')?.classList.contains('active'))renderExecutiveDashboard();
}
function accountCardHTML(a){
 if(a.type==='card'){
  const m=cardMetrics(a),meta=`Ending •${a.ending} • Available ${money(m.available)}`,sub=a.id==='ar-0955'?`<div class="subcardTags"><span class="subcardTag">Primary •0955</span><span class="subcardTag">Supplementary •9345</span><span class="subcardTag">Supplementary •9634</span></div>`:'';
  return `<div class="accountCard" data-account="${a.id}">${bankLogoHTML(a)}<div class="grow"><div class="name">${a.bank} • ${a.name}</div><div class="meta">${meta}${a.id==='sab-440880'?'':''}${resetCardIds.has(a.id)?' • RESET / DATE-DRIVEN':''}</div>${sub}</div><div style="text-align:right"><div class="amount red">${money(m.currentCycleUsage||0)}</div><div class="meta">Current cycle amount</div><div class="meta">${money(m.currentCycleTransactions||0)} transactions${Number(m.currentCycleInstallment||0)>0?` + ${money(m.currentCycleInstallment)} installment`:''}</div>${Number(m.releasedStatementBalance||0)>0?`<div class="meta blue" style="margin-top:3px">Released / amount to pay ${money(m.releasedStatementBalance)}${cardReleasedStatementBreakdown(a.id).length>1?` • ${cardReleasedStatementBreakdown(a.id).length} cycles`:''}</div>`:''}${m.inst>0?`<div class="meta amber" style="margin-top:3px">Future installment reserve ${money(m.inst)}</div>`:''}${m.creditBalance>0?`<div class="meta green" style="margin-top:3px">Card credit / payments received ${money(m.creditBalance)}</div>`:''}<div class="meta"><b>Total utilized ${money(m.total)}</b> • Bank/card position</div><button class="btn small danger" type="button" data-reset-card="${a.id}" style="margin-top:8px">Reset Card</button></div></div>`;
 }
 return `<div class="accountCard" data-account="${a.id}">${bankLogoHTML(a)}<div class="grow"><div class="name">${a.bank} • ${a.name}</div><div class="meta">${a.ending?`Ending •${a.ending}`:'Cash account'}</div></div><div><div class="amount green">${money(adjustedBankBalance(a))}</div><div class="meta" style="text-align:right">${a.balanceLabel||'Balance'}</div></div></div>`;
}
function bindAccountCards(){
 document.querySelectorAll('[data-account]').forEach(el=>el.addEventListener('click',e=>{
  if(e.target.closest('[data-reset-card]'))return;
  openAccount(el.dataset.account);
 }));
 document.querySelectorAll('[data-reset-card]').forEach(btn=>btn.addEventListener('click',e=>{
  e.stopPropagation();resetCardData(btn.dataset.resetCard);
 }));
}
function txRow5(t){const ip=linkedActiveInstallment(t._id);return `<tr class="clickable" data-tx="${t._id}"><td>${t.date}</td><td><b>${t.description}</b>${ip?'<span class="badge active" style="margin-left:6px">Installment</span>':''}<div class="meta">${accountName(t.account)}${ip?` • ${money(planCalc(ip).remaining)} reserved`:''}</div></td><td>${t.category}</td><td>${account(t.account)?.ending||''}</td><td class="${t.amount<0?'red':'green'}"><b>${signed(t.amount)}</b></td></tr>`}
var selectedTxIds=new Set();
let bulkUpdateDraftActive=false;
let bulkUpdateDraftState=null;

function txBalanceStatusBadge(t){
 if(isLegacySeedTransaction(t))return '<span class="badge" style="margin-left:6px">Historical only</span>';
 return '';
}
function transactionImportedAt(t){
 if(!t?.imported)return '';
 if(t.importedAt)return t.importedAt;
 const batch=t.importBatchId?(importHistory||[]).find(h=>h.batchId===t.importBatchId):null;
 if(batch?.importedAt)return batch.importedAt;
 const stamp=String(t._id||'').match(/^import(\d{13})_/);
 if(stamp)return new Date(Number(stamp[1])).toISOString();
 return '';
}
function transactionImportedDateCell(t){
 if(t?.manual)return '<span class="meta">Manual entry</span>';
 if(!t?.imported)return '<span class="meta">Historical</span>';
 const iso=transactionImportedAt(t);
 if(!iso)return '<span class="meta">Import date unavailable</span>';
 const d=new Date(iso);
 if(Number.isNaN(d.getTime()))return '<span class="meta">Import date unavailable</span>';
 return `<span data-sort-value="${d.toISOString()}">${escapeHtml(d.toLocaleDateString())}<div class="meta">${escapeHtml(d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}))}</div></span>`;
}
function txRow6(t){
 const group=possibleDuplicateGroups(false).find(g=>g.a._id===t._id||g.b._id===t._id);
 const other=group?(group.a._id===t._id?group.b:group.a):null;
 const dup=!!group;
 const thisLabel=t.manual?'Keep Manual':'Keep This Transaction';
 const otherLabel=other?(other.manual?'Keep Manual':'Keep Imported / Statement'):'';
 const reviewBadge=group?.similarAmountReview?'<span class="similarBadge">Similar amount review</span>':(dup?'<span class="dupBadge">Possible duplicate</span>':'');
 const linkedPlan=linkedActiveInstallment(t._id);
 const installmentBadge=(linkedPlan?`<span class="badge active" style="margin-left:6px">Installment • ${money(planCalc(linkedPlan).monthly)}/mo</span>`:'')+txBalanceStatusBadge(t);
 const diffText=group?.similarAmountReview?`<div class="meta" style="margin-top:4px">Manual vs statement • same account/card • amount difference ${money(group.amountDifference)} • review tolerance ${money(group.tolerance)}</div>`:'';
 const decisionUI=dup&&other?`<div class="dupResolveBox"><div class="meta"><b>${group.similarAmountReview?'Similar transaction review':'Possible duplicate'}:</b> compare both transactions and decide which one to keep, or mark them as Not a Duplicate.</div>${diffText}<div class="dupDecision"><button class="btn small primary" type="button" data-dup-keep="${t._id}" data-a="${t._id}" data-b="${other._id}">${thisLabel}</button><button class="btn small" type="button" data-dup-keep="${other._id}" data-a="${t._id}" data-b="${other._id}">${otherLabel}</button><button class="btn small" type="button" data-dup-action="not-duplicate" data-a="${t._id}" data-b="${other._id}">Not a Duplicate</button></div></div>`:'';
 return `<tr class="clickable ${selectedTxIds.has(t._id)?'txRowSelected':''}" data-tx="${t._id}"><td class="txSelectCell" data-select-cell="${t._id}" tabindex="0" role="checkbox" aria-checked="${selectedTxIds.has(t._id)?'true':'false'}" title="Select transaction"><div class="txSelectHit"><input type="checkbox" class="txSelectBox" data-select-tx="${t._id}" ${selectedTxIds.has(t._id)?'checked':''} aria-label="Select transaction"></div></td><td>${t.date}</td><td>${transactionImportedDateCell(t)}</td><td><b>${t.description}</b>${t.manual?'<span class="manualBadge">Manual</span>':''}${reviewBadge}${installmentBadge}<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px"><span class="statementBadge">Statement ${t.statementMonth||'Unassigned'}</span>${account(t.account)?.type==='card'?`<span class="statementBadge">${physicalCardLabelFor(t.account,transactionPhysicalCardEnding(t))}</span>`:''}</div>${decisionUI}<div style="margin-top:7px"><button class="btn small danger" type="button" data-delete-tx="${t._id}">Delete Transaction</button></div></td><td>${t.category}</td><td>${t.subcategory||'—'}</td><td>${accountName(t.account)}</td><td class="${t.amount<0?'red':'green'}"><b>${signed(t.amount)}</b></td></tr>`;
}
function updateTxBulkUI(){
 const n=selectedTxIds.size;

 if($('txSelectedCount'))$('txSelectedCount').textContent=`${n} selected`;
 if($('txDeleteSelected'))$('txDeleteSelected').disabled=n===0;
 if($('txUpdateSelected'))$('txUpdateSelected').disabled=n===0;

 if($('detailTxSelectedCount'))$('detailTxSelectedCount').textContent=`${n} selected`;
 if($('detailTxDeleteSelected'))$('detailTxDeleteSelected').disabled=n===0;
 if($('detailTxUpdateSelected'))$('detailTxUpdateSelected').disabled=n===0;

 const mainVisible=[...document.querySelectorAll('#transactions [data-select-tx]')];
 if($('txMasterCheck')){
  $('txMasterCheck').checked=mainVisible.length>0&&mainVisible.every(x=>x.checked);
  $('txMasterCheck').indeterminate=mainVisible.some(x=>x.checked)&&!$('txMasterCheck').checked;
 }

 const detailVisible=[...document.querySelectorAll('#accountDetailContent [data-select-tx]')];
 if($('detailTxMasterCheck')){
  $('detailTxMasterCheck').checked=detailVisible.length>0&&detailVisible.every(x=>x.checked);
  $('detailTxMasterCheck').indeterminate=detailVisible.some(x=>x.checked)&&!$('detailTxMasterCheck').checked;
 }
}

function openBulkUpdateSelected(){
 const ids=[...selectedTxIds];
 if(!ids.length)return;

 bulkUpdateDraftActive=true;
 bulkUpdateDraftState={
  category:'',
  subcategory:'',
  accountId:'',
  physicalCardEnding:'',
  month:'',
  description:''
 };

 $('txBulkUpdateCount').textContent=`${ids.length} transaction${ids.length===1?'':'s'} selected`;

 const cat=$('bulkUpdateCategory');
 cat.innerHTML='<option value="">— Keep Existing —</option>'+Object.keys(categories).map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

 const sub=$('bulkUpdateSubcategory');
 sub.innerHTML='<option value="">— Keep Existing —</option>';

 const acct=$('bulkUpdateAccount');
 acct.innerHTML='<option value="">— Keep Existing —</option>'+accounts.map(a=>`<option value="${a.id}">${escapeHtml(accountName(a.id))}</option>`).join('');
 const physical=$('bulkUpdatePhysicalCard');
 physical.innerHTML='<option value="">— Keep Existing —</option>'+allPhysicalCardOptions().map(o=>`<option value="${o.ending}">${escapeHtml(o.label)}</option>`).join('');

 $('bulkUpdateMonth').value='';
 $('bulkUpdateDescription').value='';
 openModal('txBulkUpdateModal');
}

function fillBulkUpdateSubcategories(){
 if(!bulkUpdateDraftActive)return;

 const cat=$('bulkUpdateCategory').value;
 if(bulkUpdateDraftState)bulkUpdateDraftState.category=cat;

 const sub=$('bulkUpdateSubcategory');
 const previous=(bulkUpdateDraftState?.subcategory)||sub.value||'';
 const vals=cat?(categories[cat]||[]):[...new Set(Object.values(categories).flat())];

 sub.innerHTML='<option value="">— Keep Existing —</option>'+vals.sort().map(s=>`<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');

 if(previous && vals.includes(previous))sub.value=previous;
 if(bulkUpdateDraftState)bulkUpdateDraftState.subcategory=sub.value||'';
}


function captureBulkUpdateDraft(){
 if(!bulkUpdateDraftActive)return;
 bulkUpdateDraftState={
  category:$('bulkUpdateCategory')?.value||'',
  subcategory:$('bulkUpdateSubcategory')?.value||'',
  accountId:$('bulkUpdateAccount')?.value||'',
  physicalCardEnding:$('bulkUpdatePhysicalCard')?.value||'',
  month:$('bulkUpdateMonth')?.value||'',
  description:$('bulkUpdateDescription')?.value||''
 };
}

function restoreBulkUpdateDraft(){
 if(!bulkUpdateDraftActive || !bulkUpdateDraftState)return;

 const cat=$('bulkUpdateCategory');
 const sub=$('bulkUpdateSubcategory');
 const acct=$('bulkUpdateAccount');
 const month=$('bulkUpdateMonth');
 const desc=$('bulkUpdateDescription');

 if(cat && [...cat.options].some(o=>o.value===bulkUpdateDraftState.category)){
  cat.value=bulkUpdateDraftState.category;
 }
 fillBulkUpdateSubcategories();

 if(sub && [...sub.options].some(o=>o.value===bulkUpdateDraftState.subcategory)){
  sub.value=bulkUpdateDraftState.subcategory;
 }
 if(acct && [...acct.options].some(o=>o.value===bulkUpdateDraftState.accountId)){acct.value=bulkUpdateDraftState.accountId;}
 const physical=$('bulkUpdatePhysicalCard');
 if(physical && [...physical.options].some(o=>o.value===bulkUpdateDraftState.physicalCardEnding)){physical.value=bulkUpdateDraftState.physicalCardEnding;}
 if(month)month.value=bulkUpdateDraftState.month||'';
 if(desc)desc.value=bulkUpdateDraftState.description||'';
}

function closeBulkUpdateDraft(){
 captureBulkUpdateDraft();
 bulkUpdateDraftActive=false;
 bulkUpdateDraftState=null;
 closeModal('txBulkUpdateModal');
}

function applyBulkUpdateSelected(){
 const ids=[...selectedTxIds];
 if(!ids.length)return;

 captureBulkUpdateDraft();

 const category=bulkUpdateDraftState?.category||'';
 const subcategory=bulkUpdateDraftState?.subcategory||'';
 const accountId=bulkUpdateDraftState?.accountId||'';
 const physicalCardEnding=bulkUpdateDraftState?.physicalCardEnding||'';
 const month=bulkUpdateDraftState?.month||'';
 const description=(bulkUpdateDraftState?.description||'').trim();

 if(!category && !subcategory && !accountId && !physicalCardEnding && !month && !description){
  alert('Choose at least one field to update.');
  return;
 }

 const rows=normalizedTx(true);
 const affectedAccounts=new Set();

 ids.forEach(id=>{
  const current=rows.find(t=>t._id===id);
  if(!current)return;

  txOverrides[id]=txOverrides[id]||{};

  if(category)txOverrides[id].category=category;
  if(subcategory)txOverrides[id].subcategory=subcategory;
  if(accountId){
   affectedAccounts.add(current.account);
   affectedAccounts.add(accountId);
   txOverrides[id].account=accountId;
  }else{affectedAccounts.add(current.account);}
  if(physicalCardEnding)txOverrides[id].physicalCardEnding=physicalCardEnding;
  if(month){
   txOverrides[id].statementMonth=month;
   txOverrides[id].paymentMonth=month;
   txOverrides[id].statementMonthManual=true;
  }
  if(description)txOverrides[id].description=description;
 });

 saveLocal();
 syncTransactionOverridesImmediate();

 bulkUpdateDraftActive=false;
 bulkUpdateDraftState=null;
 closeModal('txBulkUpdateModal');
 selectedTxIds.clear();

 refreshAfterTransactionChange([...affectedAccounts][0]||'');
 renderTransactions();
 renderDashboard();
 renderAccounts();

 setTimeout(()=>alert(`${ids.length} transaction${ids.length===1?'':'s'} updated.`),20);
}

function bulkDeleteSelected(){
 const ids=[...selectedTxIds].filter(id=>transactionActions[id]?.status!=='deleted');
 if(!ids.length)return;
 if(!confirm(`Delete ${ids.length} selected transaction(s)?\n\nThis is one bulk action. They will be excluded from calculations but kept in Transaction History so you can restore them later.`))return;
 const rows=normalizedTx(true);
 const affected=new Set(ids.map(id=>rows.find(t=>t._id===id)?.account).filter(Boolean));
 const now=new Date().toISOString();
 ids.forEach(id=>transactionActions[id]={status:'deleted',reason:'Bulk deleted by user',pairedWith:'',updatedAt:now});
 selectedTxIds.clear();
 saveLocal();
 syncTransactionActionsImmediate();
 refreshAfterTransactionChange([...affected][0]||'');
}


let txSelectionScrollLock=null;
let txSelectionScrollTimer=null;

function beginTxSelectionScrollLock(){
 txSelectionScrollLock={x:window.scrollX,y:window.scrollY,at:Date.now()};
 clearTimeout(txSelectionScrollTimer);
}
function enforceTxSelectionScrollLock(){
 if(!txSelectionScrollLock)return;
 const {x,y}=txSelectionScrollLock;

 // Restore now, next paint, and after any short realtime/render activity.
 window.scrollTo(x,y);
 requestAnimationFrame(()=>window.scrollTo(x,y));
 setTimeout(()=>window.scrollTo(x,y),0);
 setTimeout(()=>window.scrollTo(x,y),40);
 setTimeout(()=>{
  window.scrollTo(x,y);
  txSelectionScrollLock=null;
 },140);
}

function setTransactionSelected(id,selected,checkbox=null){
 if(!id)return;
 if(selected)selectedTxIds.add(id);else selectedTxIds.delete(id);

 const row=checkbox?.closest('tr[data-tx]')||document.querySelector(`tr[data-tx="${CSS.escape(id)}"]`);
 if(row)row.classList.toggle('txRowSelected',selected);

 const box=checkbox||row?.querySelector('[data-select-tx]');
 if(box)box.checked=selected;

 const cell=row?.querySelector('[data-select-cell]')||box?.closest('[data-select-cell]');
 if(cell)cell.setAttribute('aria-checked',selected?'true':'false');

 updateTxBulkUI();
}
function toggleTransactionSelectionFromCell(cell){
 const checkbox=cell?.querySelector('[data-select-tx]');
 if(!checkbox)return;
 setTransactionSelected(checkbox.dataset.selectTx,!checkbox.checked,checkbox);
}

function bindTxRows(){
 document.querySelectorAll('[data-select-tx]').forEach(c=>{
  c.tabIndex=0;
  c.onclick=e=>e.stopPropagation();
  c.onchange=e=>{
   e.stopPropagation();
   beginTxSelectionScrollLock();
   setTransactionSelected(c.dataset.selectTx,c.checked,c);
   enforceTxSelectionScrollLock();
  };
  c.onpointerdown=e=>{e.stopPropagation();beginTxSelectionScrollLock();};
  c.onmousedown=e=>e.stopPropagation();
 });

 document.querySelectorAll('[data-select-cell]').forEach(cell=>{
  const checkbox=cell.querySelector('[data-select-tx]');
  if(!checkbox)return;

  cell.onpointerdown=e=>{
   beginTxSelectionScrollLock();
   e.stopPropagation();
  };
  cell.onmousedown=e=>{
   e.stopPropagation();
  };
  cell.onclick=e=>{
   e.stopPropagation();
   if(e.target.closest('[data-select-tx]'))return;
   e.preventDefault();
   checkbox.click();
  };
  cell.onkeydown=e=>{
   if(e.key==='Enter'||e.key===' '){
    e.preventDefault();
    e.stopPropagation();
    checkbox.click();
   }
  };
 });

 document.querySelectorAll('[data-dup-keep]').forEach(b=>b.onclick=e=>{e.stopPropagation();resolveDuplicate(b.dataset.a,b.dataset.b,b.dataset.dupKeep)});
 document.querySelectorAll('[data-dup-action]').forEach(b=>b.onclick=e=>{e.stopPropagation();setDuplicateDecision(b.dataset.a,b.dataset.b,b.dataset.dupAction)});
 document.querySelectorAll('[data-delete-tx]').forEach(b=>b.onclick=e=>{
  e.preventDefault();e.stopPropagation();deleteTransactionRecord(b.dataset.deleteTx);
 });

 document.querySelectorAll('[data-tx]').forEach(row=>{
  row.onclick=e=>{
   if(e.target.closest('button,.btn,.closeBtn,input,select,textarea,label,[data-select-cell],[data-select-tx]'))return;
   openTxEdit(row.dataset.tx);
  };
 });

 updateTxBulkUI();
}

// V234: permanent delegated fallback survives every filter, account-detail and cloud rerender.
if(!window.__transactionSelectionDelegated){
 window.__transactionSelectionDelegated=true;
 document.addEventListener('change',e=>{
  const c=e.target?.closest?.('[data-select-tx]');
  if(!c)return;
  e.stopPropagation();
  beginTxSelectionScrollLock();
  setTransactionSelected(c.dataset.selectTx,c.checked,c);
  enforceTxSelectionScrollLock();
 },true);
}

function renderAccounts(){
 const grid=$('accountsGrid');if(grid){grid.innerHTML=accounts.map(accountCardHTML).join('');bindAccountCards();}
 const cards=accounts.filter(a=>a.type==='card'),banks=accounts.filter(a=>a.type==='bank');
 const metrics=cards.map(a=>({a,m:cardMetrics(a)}));
 const bankBalance=banks.reduce((z,a)=>z+Number(adjustedBankBalance(a)||0),0);
 const totalLimit=metrics.reduce((z,x)=>z+Number(x.m.limit||0),0);
 const available=metrics.reduce((z,x)=>z+Number(x.m.available||0),0);
 const utilized=metrics.reduce((z,x)=>z+Number(x.m.total||0),0);
 const util=totalLimit>0?Math.max(0,Math.min(100,utilized/totalLimit*100)):0;
 const month=(document.getElementById('cashPaymentMonth')?.value)||plannerDefaultMonth();
 ensureMonthlyPlannerRows(month);ensurePartialPaymentFields();
 const payRows=cardPaymentPlan.filter(p=>p.month===month&&isCreditCardAccountId(p.accountId)&&!p.upcomingOnly);
 const currentDue=payRows.reduce((z,p)=>{const r=paymentRemainingAmount(p);return z+(Number.isFinite(r)?r:0)},0);
 const paidThisMonth=payRows.reduce((z,p)=>z+Number(paymentPaidAmount(p)||0),0);
 if($('cashKpis'))$('cashKpis').innerHTML=[
  ['Bank Balance',money(bankBalance),'Across '+banks.length+' bank account'+(banks.length===1?'':'s'),'▥','green'],
  ['Total Credit Limit',money(totalLimit),'Combined card facilities','▤',''],
  ['Available Credit',money(available),'Live remaining credit','↔','purple'],
  ['Current Card Due',money(currentDue),'Remaining for '+month,'↑','red'],
  ['Payments This Month',money(paidThisMonth),'Recorded against selected month','✓','green'],
  ['Credit Utilization',util.toFixed(1)+'%','SAR '+Math.round(utilized).toLocaleString('en-US')+' utilized','◔','gold']
 ].map(x=>`<div class="cashKpi ${x[4]}" data-icon="${x[3]}"><small>${x[0]}</small><b>${x[1]}</b><em>${x[2]}</em></div>`).join('');
 if($('cashDate'))$('cashDate').textContent=new Date().toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});
 if($('cashBankCount'))$('cashBankCount').textContent=banks.length+' accounts';
 if($('cashBankGrid'))$('cashBankGrid').innerHTML=banks.length?banks.map(a=>`<div class="cashBankCard" data-cash-account="${a.id}">${bankLogoHTML(a)}<div><div class="cbName">${escapeHtml(a.bank+' • '+a.name)}</div><div class="cbMeta">${a.ending?'Ending •'+escapeHtml(String(a.ending)):(a.balanceLabel||'Bank account')}</div></div><div class="cbAmount">${money(adjustedBankBalance(a))}</div></div>`).join(''):'<div class="cashEmpty">No bank accounts saved.</div>';
 if($('cashUtilPct'))$('cashUtilPct').textContent=util.toFixed(1)+'%';
 if($('cashUtilDonut'))$('cashUtilDonut').style.background=`conic-gradient(#8153e8 0deg ${util*3.6}deg,#173b50 ${util*3.6}deg 360deg)`;
 if($('cashUtilLegend'))$('cashUtilLegend').innerHTML=`<div class="cashLegendRow"><span>Credit limit</span><b>${money(totalLimit)}</b></div><div class="cashLegendRow"><span>Utilized / reserved</span><b>${money(utilized)}</b></div><div class="cashLegendRow"><span>Available</span><b style="color:#38e0a4">${money(available)}</b></div>`;
 if($('cashCards'))$('cashCards').innerHTML=metrics.length?metrics.map(({a,m})=>`<div class="cashCard" data-cash-account="${a.id}"><div class="cashCardTop">${bankLogoHTML(a)}<div><div class="cashCardName">${escapeHtml(a.bank+' • '+a.name)}</div><div class="cashCardMeta">Ending •${escapeHtml(String(a.ending||''))}</div></div></div><div class="cashCardValue" style="color:#38e0a4">${money(m.available)}</div><div class="cashCardMeta">Available credit</div><div class="cashProgress"><i style="width:${Math.min(100,Math.max(0,Number(m.util||0)))}%"></i></div><div class="cashCardStats"><div class="cashCardStat"><span>Current usage</span><b>${money(m.current||0)}</b></div><div class="cashCardStat"><span>Installment reserve</span><b>${money(m.inst||0)}</b></div><div class="cashCardStat"><span>Total utilized</span><b>${money(m.total||0)}</b></div><div class="cashCardStat"><span>Utilization</span><b>${Number(m.util||0).toFixed(1)}%</b></div></div></div>`).join(''):'<div class="cashEmpty">No credit cards saved.</div>';
 if($('cashPaymentMonth'))$('cashPaymentMonth').value=month;
 if($('cashPaymentBody'))$('cashPaymentBody').innerHTML=payRows.length?payRows.map(p=>{const a=account(p.accountId),eff=plannerAmountForRow(p),paid=paymentPaidAmount(p),rem=paymentRemainingAmount(p);return `<tr><td><b>${escapeHtml(a?`${a.bank} •${a.ending}`:p.accountId)}</b></td><td>${eff===null?'Awaiting statement':money(Number(eff||0))}</td><td style="color:#38e0a4">${money(paid)}</td><td style="color:${Number(rem||0)>0?'#ff6f7d':'#38e0a4'}"><b>${Number.isFinite(rem)?money(rem):'—'}</b></td><td>${p.due?paymentFormatDate(p.due):'Pending'}</td><td><span class="cashPayStatus ${p.paid?'paid':Number(rem||0)>0?'due':''}">${p.paid?'PAID':paid>0?'PARTIAL':plannerAmountSource(p)}</span></td></tr>`}).join(''):'<tr><td colspan="6" class="cashEmpty">No card payment obligations for this month.</td></tr>';
 const upcoming=cardPaymentPlan.filter(p=>isCreditCardAccountId(p.accountId)&&!p.paid&&p.due&&p.due>=new Date().toISOString().slice(0,10)).map(p=>({p,rem:paymentRemainingAmount(p)})).filter(x=>Number.isFinite(x.rem)&&x.rem>0).sort((a,b)=>a.p.due.localeCompare(b.p.due)).slice(0,6);
 if($('cashUpcomingCount'))$('cashUpcomingCount').textContent=upcoming.length+' upcoming';
 if($('cashUpcoming'))$('cashUpcoming').innerHTML=upcoming.length?upcoming.map(({p,rem})=>{const a=account(p.accountId);return `<div class="cashUpcomingItem"><div><b>${escapeHtml(a?`${a.bank} • ${a.name} •${a.ending}`:p.accountId)}</b><small>Due ${paymentFormatDate(p.due)} • ${escapeHtml(plannerAmountSource(p))}</small></div><div class="cashUpcomingAmt">${money(rem)}</div></div>`}).join(''):'<div class="cashEmpty">No upcoming card payments found.</div>';
 if($('cardSummaryBody'))$('cardSummaryBody').innerHTML=metrics.map(({a,m})=>`<tr><td><b>${escapeHtml(a.bank+' • '+a.name+' •'+a.ending)}</b></td><td style="color:#ff6f7d">${money(m.current)}</td><td style="color:#ffc34d">${money(m.inst)}</td><td style="color:#ff6f7d"><b>${money(m.total)}</b></td><td>${money(m.limit)}</td><td style="color:#38e0a4"><b>${money(m.available)}</b></td><td><div>${Number(m.util||0).toFixed(1)}%</div><div class="progress"><div class="progressFill" style="width:${Math.min(Number(m.util||0),100)}%"></div></div></td></tr>`).join('');
 document.querySelectorAll('[data-cash-account]').forEach(el=>el.onclick=()=>openAccount(el.dataset.cashAccount,'accounts'));
 if($('cashPaymentMonth')&&!$('cashPaymentMonth').dataset.bound){$('cashPaymentMonth').dataset.bound='1';$('cashPaymentMonth').addEventListener('change',()=>renderAccounts());}
}

function fillAccountSelect(sel,includeAll=true){sel.innerHTML=(includeAll?'<option value="">All Accounts</option>':'')+accounts.map(a=>`<option value="${a.id}">${accountName(a.id)}</option>`).join('')}
function fillCategorySelect(sel,includeAll=true){sel.innerHTML=(includeAll?'<option value="">All Categories</option>':'')+Object.keys(categories).map(c=>`<option>${c}</option>`).join('')}
function fillSubcategorySelect(sel,cat,selected=''){const arr=categories[cat]||[];sel.innerHTML=arr.map(s=>`<option ${s===selected?'selected':''}>${s}</option>`).join('')}
function fillReportSubcategories(){
 const cat=$('reportCategory').value, current=$('reportSubcategory').value;
 const vals=cat?(categories[cat]||[]):[...new Set(Object.values(categories).flat())];
 $('reportSubcategory').innerHTML='<option value="">All Subcategories</option>'+vals.sort().map(s=>`<option ${s===current?'selected':''}>${s}</option>`).join('');
}
function transactionFilters(rows,source){
 const q=(source.search||'').toLowerCase(), ac=source.account||'', cat=source.category||'', typ=source.type||'', from=source.from||'', to=source.to||'';
 return rows.filter(t=>{
   if(q&&!`${t.description} ${t.category} ${t.subcategory} ${accountName(t.account)}`.toLowerCase().includes(q))return false;
   if(ac&&t.account!==ac)return false;if(cat&&t.category!==cat)return false;if(typ&&txType(t)!==typ)return false;
   if(from&&t.date<from)return false;if(to&&t.date>to)return false;return true;
 });
}


function nextMonth(ym){
 const [y,m]=ym.split('-').map(Number);
 const d=new Date(Date.UTC(y,m,1));
 return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
}
function statementMonthByRule(date,cutoff=24){
 const ym=String(date||'').slice(0,7),day=Number(String(date||'').slice(8,10)||1);
 if(!ym)return '';
 return day<=Number(cutoff||24)?ym:nextMonth(ym);
}
function applyStatementRuleToTransactions(){
 const cutoff=Math.max(1,Math.min(31,Number($('statementCutoffDay').value||24)));
 statementRule.cutoffDay=cutoff;
 normalizedTx().forEach(t=>{
   if(txOverrides[t._id]?.statementMonthManual===true)return;
   txOverrides[t._id]=txOverrides[t._id]||{};
   txOverrides[t._id].statementMonth=statementMonthByRule(t.date,cutoff);
   txOverrides[t._id].statementMonthManual=false;
 });
 saveLocal();renderTransactions();renderReports();renderDashboard();
 alert(`Rule applied: days 1–${cutoff} stay in the same month statement; day ${cutoff+1} onward move to the next statement month. Manual overrides were kept.`);
}
function fillStatementMonthFilter(){
 const sel=$('txStatementMonth');if(!sel)return;
 const keep=sel.value;
 const vals=[...new Set(normalizedTx().map(t=>t.statementMonth).filter(Boolean))].sort().reverse();
 sel.innerHTML='<option value="">All Statement Months</option>'+vals.map(v=>`<option value="${v}">${v}</option>`).join('');
 if(vals.includes(keep))sel.value=keep;
}



function cleanupSabLegacyBalanceState(){
 // Do not allow old SAB baseline/anchor data to become live balance again.
 const a=account('sab-440880');
 if(a?.extra){
  delete a.extra['Current Non-Installment Usage'];
  delete a.extra['Bank Utilized'];
  delete a.extra['Outstanding'];
  delete a.extra['Manual Outstanding'];
  delete a.extra['Tracked Outstanding'];
 }
}


function rebuildCardAfterStatementMonthMove(cardId,oldMonth,newMonth){
 const months=[oldMonth,newMonth].filter(Boolean);

 // A date-driven planner row must never keep a stale manual amount after
 // the transaction was explicitly moved to another statement/payment month.
 cardPaymentPlan.forEach(p=>{
  if(p.accountId!==cardId || !months.includes(p.month))return;
  if(p.statementOfficial===true && officialStatementImportMatches(p))return;
  if(p.source==='confirmed')return;

  delete p.manualOverrideAmount;
  p.source='calculated';
  p.label=`Calculated ${cardMonthLabel(p.month)} payment cycle`;
 });

 rebuildTransactions();

 // Rebuild both the old and new cycle from the edited transaction assignment.
 const rows=liveCardTransactions().filter(t=>t.account===cardId);
 ensureImportedTransactionPlannerRows(cardId,rows);
 months.forEach(m=>ensureMonthlyPlannerRows(m));
 ensureReleasedCyclePlannerRows();
 normalizeReleasedPaymentAliases();

 // Recover any payments that were recorded before this planner row was rebuilt.
 ensurePartialPaymentFields();

 // Keep recorded payments attached, but their remaining/extra-credit result
 // is now calculated against the rebuilt cycle amount.
 saveCardPaymentPlan();
}


function repairStatementMonthOverrides(){
 let changed=false;
 Object.entries(txOverrides||{}).forEach(([id,ov])=>{
  // Older versions could save a visible statementMonth while leaving
  // statementMonthManual=false and paymentMonth unchanged. Repair all of them.
  if(ov?.statementMonth){
   if(ov.paymentMonth!==ov.statementMonth){ov.paymentMonth=ov.statementMonth;changed=true;}
   if(ov.statementMonthManual!==true){ov.statementMonthManual=true;changed=true;}
  }
 });
 if(changed){
  try{localStorage.setItem('pf_tx_overrides',JSON.stringify(txOverrides));}catch(e){}
 }
 return changed;
}

function refreshAfterTransactionChange(accountId=''){
 repairStatementMonthOverrides();
 purgeAr0955JulyTestStatement();
 purgeLegacySabAnchorRows();
 if(accountId==='sab-440880'||!accountId)cleanupSabLegacyBalanceState();
 rebuildTransactions();
 if(accountId){
  const rows=liveCardTransactions().filter(t=>t.account===accountId);
  ensureImportedTransactionPlannerRows(accountId,rows);
 }
 ensureReleasedCyclePlannerRows();
 normalizeReleasedPaymentAliases();
 ensurePartialPaymentFields();
 renderTransactions();
 renderReports();
 renderDashboard();
 renderAccounts();
 renderPaymentPlanner();
 renderIncomePlan();
 renderInstallments();
 renderReviewAlerts();
 renderTxHistory();
 if(document.getElementById('accountDetail')?.classList.contains('active') && currentAccountDetailId){
  openAccount(currentAccountDetailId,accountDetailReturnPage);
 }
}

function setTxAction(id,status,reason='',pairedWith=''){
 const t=normalizedTx(true).find(x=>x._id===id);
 transactionActions[id]={status,reason,pairedWith,updatedAt:new Date().toISOString()};
 saveLocal();
 syncTransactionActionsImmediate();
 refreshAfterTransactionChange(t?.account||'');
}
function restoreTx(id){
 const t=normalizedTx(true).find(x=>x._id===id);
 delete transactionActions[id];
 saveLocal();
 refreshAfterTransactionChange(t?.account||'');
}
function deleteTransactionRecord(id){
 const t=normalizedTx(true).find(x=>x._id===id);if(!t)return;
 if(transactionActions[id]?.status==='deleted')return;
 if(!confirm(`Delete "${t.description}" (${money(Math.abs(t.amount))})?\n\nIt will be excluded from calculations but kept in Transaction History so you can restore it later.`))return;
 transactionActions[id]={status:'deleted',reason:'Deleted by user',pairedWith:'',updatedAt:new Date().toISOString()};
 selectedTxIds.delete(id);
 saveLocal();
 syncTransactionActionsImmediate();
 refreshAfterTransactionChange(t.account||'');
}
function resolveDuplicate(aId,bId,keepId){
 const rows=normalizedTx(true),a=rows.find(x=>x._id===aId),b=rows.find(x=>x._id===bId);if(!a||!b)return;
 const removeId=keepId===aId?bId:aId;
 const keep=keepId===aId?a:b;
 const remove=removeId===aId?a:b;
 duplicateDecisions[duplicatePairKey(a,b)]='duplicate';
 transactionActions[removeId]={status:'excluded-duplicate',reason:`Duplicate of ${keep.description}`,pairedWith:keepId,updatedAt:new Date().toISOString()};
 if(transactionActions[keepId]?.status==='excluded-duplicate')delete transactionActions[keepId];
 saveLocal();refreshAfterTransactionChange(remove.account);
 alert(`Duplicate resolved.\n\nKept: ${keep.description}\nExcluded: ${remove.description}\n\nThe excluded item will no longer count in totals, reports or cash flow, but remains available in history.`);
}

function normDupText(v){return String(v||'').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim()}
function dupDays(a,b){return Math.abs((new Date(a+'T00:00:00Z')-new Date(b+'T00:00:00Z'))/86400000)}
function duplicatePairKey(a,b){return [a._id,b._id].sort().join('::')}
function duplicateDecision(a,b){return duplicateDecisions[duplicatePairKey(a,b)]||''}
function setDuplicateDecision(aId,bId,decision){
 const rows=normalizedTx(true),a=rows.find(x=>x._id===aId),b=rows.find(x=>x._id===bId);if(!a||!b)return;
 if(decision==='not-duplicate'){
   duplicateDecisions[duplicatePairKey(a,b)]='not-duplicate';
   saveLocal();renderTransactions();renderReviewAlerts();
 }
}
function possibleDuplicateGroups(includeDecided=false){
 const rows=normalizedTx(),out=[];
 for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
  const a=rows[i],b=rows[j];

  // Duplicate review is ONLY for a manual transaction compared with
  // an imported bank/card statement transaction.
  // Imported statement vs imported statement is never flagged.
  // Manual vs manual is also not flagged by this review.
  const oneManual=!!a.manual!==!!b.manual;
  if(!oneManual)continue;

  // They must belong to the same account/card.
  if(a.account!==b.account)continue;

  const aa=Math.abs(Number(a.amount||0)),bb=Math.abs(Number(b.amount||0));
  const diff=Math.abs(aa-bb);

  // "Almost same" amount = within whichever is larger:
  // SAR 5.00 or 2% of the larger transaction.
  const nearTolerance=Math.max(5,Math.max(aa,bb)*0.02);
  const exactAmount=diff<=0.01;
  const nearAmount=diff<=nearTolerance;
  if(!nearAmount)continue;

  // Allow nearby posting dates because manual entry and bank posting
  // can differ by several days.
  if(dupDays(a.date,b.date)>7)continue;

  const ad=normDupText(a.description),bd=normDupText(b.description);
  const descMatch=ad===bd||(ad.length>6&&bd.length>6&&(ad.includes(bd)||bd.includes(ad)));
  const exact=a.date===b.date&&descMatch&&exactAmount;
  const similarAmountReview=nearAmount&&!exactAmount;

  // Since exactly one transaction is manual, amount/date similarity is
  // sufficient to send the pair for user review. Nothing is auto-excluded.
  const decision=duplicateDecision(a,b);
  if(!includeDecided&&decision)continue;

  out.push({
    a,b,
    manualPair:true,
    exact,
    decision,
    similarAmountReview,
    amountDifference:diff,
    tolerance:nearTolerance
  });
 }
 return out;
}
function duplicateTxIds(){return new Set(possibleDuplicateGroups(false).flatMap(g=>[g.a._id,g.b._id]))}
function showDuplicateReview(){
 nav('transactions');const ids=duplicateTxIds();
 $('txSearch').value='';$('txAccount').value='';$('txPhysicalCard').value='';$('txCategory').value='';$('txType').value='';$('txStatementMonth').value='';
 renderTransactions();
 setTimeout(()=>document.querySelectorAll('#txBody tr[data-tx]').forEach(r=>{if(!ids.has(r.dataset.tx))r.style.display='none'}),0);
}

let eligiblePurchasesOnly=false;

function v237Money(v){return money(Number(v||0));}
function transactionWorkMetrics(){
 const rows=transactionFilters(normalizedTx(),{search:$('txSearch')?.value||'',account:$('txAccount')?.value||'',category:$('txCategory')?.value||'',type:$('txType')?.value||''});
 const physical=$('txPhysicalCard')?.value||'',sm=$('txStatementMonth')?.value||'';
 const filtered=rows.filter(t=>(!physical||txMatchesPhysicalCardFilter(t,physical))&&(!sm||t.statementMonth===sm));
 const income=filtered.filter(t=>txType(t)==='income').reduce((s,t)=>s+Math.abs(Number(t.amount||0)),0);
 const spend=filtered.filter(t=>['spend','fee'].includes(txType(t))).reduce((s,t)=>s+Math.abs(Number(t.amount||0)),0);
 const transfers=filtered.filter(t=>txType(t)==='transfer').reduce((s,t)=>s+Math.abs(Number(t.amount||0)),0);
 const unclassified=filtered.filter(t=>!t.category||String(t.category).toLowerCase().includes('unclass')).length;
 return {count:filtered.length,income,spend,transfers,net:income-spend,unclassified};
}
function renderTransactionWorkKpis(){
 const box=$('txWorkKpis');if(!box)return;const m=transactionWorkMetrics();
 box.innerHTML=`<div class="workMetric good"><span>Total Inflow</span><b class="green">${v237Money(m.income)}</b><small>Current transaction filters</small></div><div class="workMetric debt"><span>Total Spending & Fees</span><b class="red">${v237Money(m.spend)}</b><small>Transfers excluded from spending</small></div><div class="workMetric"><span>Net Cash Flow</span><b class="${m.net>=0?'green':'red'}">${v237Money(m.net)}</b><small>Inflow less spending & fees</small></div><div class="workMetric"><span>Transfers / Card Payments</span><b>${v237Money(m.transfers)}</b><small>Tracked separately from spending</small></div><div class="workMetric ${m.unclassified?'attn':''}"><span>Transactions</span><b>${m.count}</b><small>${m.unclassified} need classification</small></div>`;
}
function strategySpendingRows(){
 const ym=currentIncomeMonth();return normalizedTx().filter(t=>String(t.date||'').slice(0,7)===ym&&['spend','fee'].includes(txType(t)));
}
function renderFinancialStrategy(){
 // V247: render the Strategy page defensively so one unavailable metric can never blank the whole page.
 const safeCall=(fn,fallback=0)=>{try{const v=fn();return Number.isFinite(Number(v))?Number(v):fallback}catch(err){console.error('Financial Strategy metric error:',err);return fallback}};
 const planMonths=(incomePlan&&Array.isArray(incomePlan.monthlyPlans)?incomePlan.monthlyPlans:[]).map(p=>p&&p.month).filter(Boolean).sort();
 const txMonths=normalizedTx().map(t=>String(t.date||'').slice(0,7)).filter(m=>/^\d{4}-\d{2}$/.test(m)).sort();
 const current=currentIncomeMonth();
 const planMonth=incomePlanForMonth(current)?current:(planMonths[planMonths.length-1]||txMonths[txMonths.length-1]||current);
 const plan=incomePlanForMonth(planMonth);
 const income=plan?safeCall(()=>monthlyPlanTotal(plan)+accumulatedExtraIncome(planMonth),0):safeCall(()=>totalIncomePlan(),0);
 const loans=safeCall(()=>totalFixedLoans(),0),other=safeCall(()=>outgoingThisMonthTotal(),0),cardPay=safeCall(()=>remainingIncomePaymentsTotal(),0);
 const spending=normalizedTx().filter(t=>String(t.date||'').slice(0,7)===planMonth&&['spend','fee'].includes(txType(t)));
 const actualSpend=spending.reduce((sum,t)=>sum+Math.abs(Number(t.amount||0)),0);
 const bankCash=(Array.isArray(accounts)?accounts:[]).filter(a=>a.type==='bank').reduce((sum,a)=>sum+Math.max(0,Number(a.balance||0)),0);
 const required=Math.max(0,loans)+Math.max(0,other)+Math.max(0,cardPay),safe=Math.max(0,income-required-actualSpend),weekly=safe/4.345;
 const now=new Date(), daysLeft=planMonth===current?Math.max(1,new Date(now.getFullYear(),now.getMonth()+1,0).getDate()-now.getDate()+1):30, daily=safe/daysLeft;
 let cards=[];try{cards=(Array.isArray(accounts)?accounts:[]).filter(a=>a.type==='card').map(a=>{try{return {a,m:cardMetrics(a)}}catch(_){return {a,m:{total:Math.max(0,Number(a.balance||0)),available:Math.max(0,Number(a.limit||0)-Math.max(0,Number(a.balance||0))),utilization:0}}}})}catch(_){}
 const cardDebt=cards.reduce((sum,x)=>sum+Math.max(0,Number(x.m.total||0)),0);
 const activeLoans=((financeSettings&&Array.isArray(financeSettings.loans))?financeSettings.loans:[]).filter(l=>l.status!=='closed');
 const loanDebt=activeLoans.reduce((sum,l)=>sum+Math.max(0,Number(l.remainingAmount||0)),0),totalDebt=cardDebt+loanDebt;
 const sd=$('strategyTopDate');if(sd)sd.textContent=`Plan Month • ${planMonth}`;
 const k=$('strategyKpis');if(k)k.innerHTML=`<div class="workMetric good"><span>Monthly Income</span><b>${v237Money(income)}</b><small>${plan?'Saved income plan':'Current income data'}</small></div><div class="workMetric debt"><span>Required Commitments</span><b>${v237Money(required)}</b><small>Loans + outgoings + planned card payments</small></div><div class="workMetric"><span>Actual Spending</span><b>${v237Money(actualSpend)}</b><small>${spending.length} spending/fee transactions • ${planMonth}</small></div><div class="workMetric good"><span>Safe-to-Spend</span><b>${v237Money(safe)}</b><small>After commitments and recorded spending</small></div><div class="workMetric debt"><span>Total Debt Exposure</span><b>${v237Money(totalDebt)}</b><small>Cards + active loan balances</small></div><div class="workMetric"><span>Cash Reserve</span><b>${v237Money(bankCash)}</b><small>Positive bank-account balances</small></div>`;
 const sb=$('safeSpendBox');if(sb){const pct=income?Math.max(0,Math.min(100,safe/income*100)):0;sb.innerHTML=`<div class="safeSpendBig">${v237Money(safe)}</div><div class="meta">Estimated remaining spending capacity for ${planMonth}</div><div class="safeSpendBar"><i style="width:${pct}%"></i></div><div class="grid2"><div class="miniMetric"><span>Weekly guide</span><b>${v237Money(weekly)}</b></div><div class="miniMetric"><span>Daily guide</span><b>${v237Money(daily)}</b></div></div>`;}
 const acts=$('strategyActions');if(acts)acts.innerHTML=`<div class="strategyAction"><i>1</i><div><b>Protect required payments</b><small>Loans, planned card payments and recurring outgoings</small></div><strong>${v237Money(required)}</strong></div><div class="strategyAction"><i>2</i><div><b>Control recorded spending</b><small>${spending.length} spending/fee transactions in ${planMonth}</small></div><strong>${v237Money(actualSpend)}</strong></div><div class="strategyAction"><i>3</i><div><b>Preserve liquidity</b><small>Current positive bank-account balances</small></div><strong>${v237Money(bankCash)}</strong></div><div class="strategyAction"><i>4</i><div><b>Review extra debt capacity</b><small>After commitments and recorded spending</small></div><strong>${v237Money(safe)}</strong></div>`;
 const sc=$('debtScenarios');if(sc){const a=safe*.25,b=safe*.5,c=safe*.8;sc.innerHTML=`<div class="scenarioCard"><b>Liquidity First</b><div class="scenarioAmt">${v237Money(a)}</div><small>25% of available capacity toward extra debt reduction.</small></div><div class="scenarioCard recommended"><b>Balanced</b><div class="scenarioAmt">${v237Money(b)}</div><small>50% toward debt while retaining half as liquidity.</small></div><div class="scenarioCard"><b>Debt Focus</b><div class="scenarioAmt">${v237Money(c)}</div><small>80% toward debt, leaving a smaller liquidity buffer.</small></div>`;}
 const byCat={};spending.forEach(t=>{const c=t.category||'Unclassified';byCat[c]=(byCat[c]||0)+Math.abs(Number(t.amount||0))});const cats=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,6);
 const coach=$('spendingCoach');if(coach)coach.innerHTML=cats.length?cats.map(([c,v],i)=>`<div class="coachRow"><b>${escapeHtml(c)}</b><small>${v237Money(v)} • ${actualSpend?Math.round(v/actualSpend*100):0}%${i===0?' • largest spending category':''}</small></div>`).join(''):`<div class="notice">No spending/fee transactions found for ${planMonth}.</div>`;
 const dt=$('strategyDebtTable');if(dt){const cardRows=cards.map(x=>`<tr><td>${escapeHtml((x.a.bank||x.a.name||'Card')+' •'+(x.a.ending||''))}</td><td>Credit Card</td><td>${v237Money(x.m.total)}</td><td>${v237Money(x.m.available)}</td><td>${Math.round(Number(x.m.utilization||0))}%</td></tr>`);const loanRows=activeLoans.map(l=>`<tr><td>${escapeHtml(l.name||'Loan')}</td><td>Loan</td><td>${v237Money(l.remainingAmount)}</td><td>${v237Money(l.monthly)}</td><td>${Number(l.remainingMonths||0)} mo.</td></tr>`);dt.innerHTML=`<table class="strategyTable"><thead><tr><th>Account / Loan</th><th>Type</th><th>Balance / Usage</th><th>Available / Monthly</th><th>Utilization / Remaining</th></tr></thead><tbody>${[...cardRows,...loanRows].join('')||'<tr><td colspan="5">No active debt records found.</td></tr>'}</tbody></table>`;}
}


function renderTxExecutiveInsights(filtered){
 const all=Array.isArray(filtered)?filtered:transactions;
 if($('txExecDate'))$('txExecDate').textContent=new Date().toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});
 if($('txTableCount'))$('txTableCount').textContent=all.length;
 if($('txShowingText'))$('txShowingText').textContent=`Showing ${all.length} matching transactions`;
 if($('txCutoffText'))$('txCutoffText').textContent=$('statementCutoffDay')?.value||24;
 const spend=all.filter(t=>['spend','fee'].includes(txType(t)));
 const cat=new Map();spend.forEach(t=>{const k=t.category||'Unclassified';cat.set(k,(cat.get(k)||0)+Math.abs(Number(t.amount)||0))});
 const cats=[...cat.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6),total=cats.reduce((a,x)=>a+x[1],0)||1;
 const colors=['#13bd8b','#4d91ee','#ef5967','#f1b51e','#8257df','#748bd8'];
 const c=$('txSpendChart');if(c){const x=c.getContext('2d'),W=c.width,H=c.height,cx=82,cy=75,r=52;x.clearRect(0,0,W,H);let a=-Math.PI/2;cats.forEach((it,i)=>{const da=(it[1]/total)*Math.PI*2;x.beginPath();x.arc(cx,cy,r,a,a+da);x.arc(cx,cy,31,a+da,a,true);x.closePath();x.fillStyle=colors[i%colors.length];x.fill();a+=da});x.fillStyle='#eaf5ff';x.font='bold 12px Arial';x.textAlign='center';x.fillText('SAR',cx,cy-3);x.fillText(Math.round(total).toLocaleString(),cx,cy+13)}
 if($('txSpendLegend'))$('txSpendLegend').innerHTML=cats.map((x,i)=>`<div><i style="background:${colors[i]}"></i><span>${escapeHtml(x[0])}</span><b>${Math.round(x[1]/total*100)}%</b></div>`).join('')||'<div>No spending in current filters</div>';
 const months=new Map();transactions.forEach(t=>{const d=new Date(t.date);if(isNaN(d))return;const k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');if(!months.has(k))months.set(k,{inc:0,sp:0});const o=months.get(k),ty=txType(t),v=Math.abs(Number(t.amount)||0);if(ty==='income')o.inc+=v;if(ty==='spend'||ty==='fee')o.sp+=v});const series=[...months.entries()].sort().slice(-6);
 const fc=$('txFlowChart');if(fc){const x=fc.getContext('2d'),W=fc.width,H=fc.height;x.clearRect(0,0,W,H);const max=Math.max(1,...series.flatMap(z=>[z[1].inc,z[1].sp]));x.strokeStyle='#174b63';x.lineWidth=1;for(let i=0;i<4;i++){let y=18+i*32;x.beginPath();x.moveTo(38,y);x.lineTo(W-10,y);x.stroke()}series.forEach((z,i)=>{const px=55+i*((W-80)/Math.max(1,series.length-1)),bh=82;x.fillStyle='#10bd8c';x.fillRect(px-13,112-z[1].inc/max*bh,11,z[1].inc/max*bh);x.fillStyle='#ef5665';x.fillRect(px+2,112-z[1].sp/max*bh,11,z[1].sp/max*bh);x.fillStyle='#9eb7c8';x.font='10px Arial';x.textAlign='center';x.fillText(new Date(z[0]+'-01').toLocaleDateString('en',{month:'short'}),px,135)});x.strokeStyle='#9ed8ff';x.lineWidth=2;x.beginPath();series.forEach((z,i)=>{const px=55+i*((W-80)/Math.max(1,series.length-1)),net=z[1].inc-z[1].sp,py=112-(Math.max(0,net)/max*82);i?x.lineTo(px,py):x.moveTo(px,py)});x.stroke()}
 const un=all.filter(t=>!t.category||String(t.category).toLowerCase().includes('unclass')).length,manual=all.filter(t=>t.manual||t.isManual||String(t.importedAt||'').toLowerCase().includes('manual')).length,stmt=all.filter(t=>!t.statementMonth).length;
 if($('txAttention'))$('txAttention').innerHTML=`<div class="txAttentionRow"><span class="txAttentionIcon" style="background:#b52f43">!</span><b>${un}</b><span>Unclassified transactions</span></div><div class="txAttentionRow"><span class="txAttentionIcon" style="background:#9b7411">△</span><b>0</b><span>Possible duplicates</span></div><div class="txAttentionRow"><span class="txAttentionIcon" style="background:#315fba">i</span><b>${manual}</b><span>Manual entries to review</span></div><div class="txAttentionRow"><span class="txAttentionIcon" style="background:#6945c5">◷</span><b>${stmt}</b><span>Statement assignment needed</span></div>`;
}
function renderTransactions(){
 const __scrollX=txSelectionScrollLock?.x??window.scrollX,__scrollY=txSelectionScrollLock?.y??window.scrollY;
 const __bulkDraftWasActive=bulkUpdateDraftActive;
 if(__bulkDraftWasActive)captureBulkUpdateDraft();
 fillStatementMonthFilter(); fillGlobalPhysicalCardFilter($('txPhysicalCard'),true);
 renderTransactionWorkKpis();
 const source={search:$('txSearch').value,account:$('txAccount').value,category:$('txCategory').value,type:$('txType').value};
 let rows=transactionFilters(normalizedTx(),source).sort((a,b)=>b.date.localeCompare(a.date));
 const physical=$('txPhysicalCard')?.value||''; if(physical)rows=rows.filter(t=>txMatchesPhysicalCardFilter(t,physical));
 const sm=$('txStatementMonth').value;if(sm)rows=rows.filter(t=>t.statementMonth===sm);
 if(eligiblePurchasesOnly)rows=rows.filter(t=>isEligibleInstallmentTx(t)&&!isTxLinkedToInstallment(t));
 $('eligibleOnlyBanner').style.display=eligiblePurchasesOnly?'block':'none';
 $('txBody').innerHTML=rows.map(txRow6).join('')||'<tr><td colspan="8">No matching transactions.</td></tr>'; bindTxRows();
 renderTxExecutiveInsights(rows);
 if(__bulkDraftWasActive)setTimeout(restoreBulkUpdateDraft,0);
 requestAnimationFrame(()=>window.scrollTo(__scrollX,__scrollY));
}
fillGlobalPhysicalCardFilter($('txPhysicalCard'),true);fillGlobalPhysicalCardFilter($('reportPhysicalCard'),true);
$('statementCutoffDay').value=String(statementRule.cutoffDay||24);
$('applyStatementRule').addEventListener('click',applyStatementRuleToTransactions);
['txSearch','txAccount','txPhysicalCard','txCategory','txType','txStatementMonth'].forEach(id=>$(id).addEventListener(id==='txSearch'?'input':'change',renderTransactions));
$('txReset').addEventListener('click',()=>{eligiblePurchasesOnly=false;$('txSearch').value='';$('txAccount').value='';$('txCategory').value='';$('txType').value='';$('txStatementMonth').value='';renderTransactions()});
$('clearEligibleOnly').addEventListener('click',()=>{eligiblePurchasesOnly=false;renderTransactions();});

$('txSelectAllVisible').onclick=()=>{beginTxSelectionScrollLock();document.querySelectorAll('#transactions [data-select-tx]').forEach(c=>setTransactionSelected(c.dataset.selectTx,true,c));enforceTxSelectionScrollLock();};
$('txClearSelection').onclick=()=>{beginTxSelectionScrollLock();document.querySelectorAll('#transactions [data-select-tx]').forEach(c=>setTransactionSelected(c.dataset.selectTx,false,c));enforceTxSelectionScrollLock();};
$('txDeleteSelected').onclick=bulkDeleteSelected;
$('txUpdateSelected').onclick=openBulkUpdateSelected;
$('txMasterCheck').onchange=e=>{const selected=e.target.checked;beginTxSelectionScrollLock();document.querySelectorAll('#transactions [data-select-tx]').forEach(c=>setTransactionSelected(c.dataset.selectTx,selected,c));enforceTxSelectionScrollLock();};



function setReportDrill(type,value){
 if(!type||!value)return;
 if(reportDrill.type===type&&reportDrill.value===value)reportDrill={type:'',value:''};
 else reportDrill={type,value};
 renderReports();
 setTimeout(()=>{const el=$('reportTxBody');if(el)el.closest('.panel')?.scrollIntoView({behavior:'smooth',block:'start'})},50);
}
function bindReportDrill(){
 document.querySelectorAll('[data-drill-type][data-drill-value]').forEach(el=>{
  const type=el.dataset.drillType,value=el.dataset.drillValue;
  if(!type||!value)return;
  el.onclick=()=>setReportDrill(type,value);
 });
}

function reportRows(){
 const outgoingRows=allOutgoingOccurrences().map(x=>({_id:`out-${x.id}`,account:'cash-outgoing',date:x.date,posting:x.date,description:x.description,amount:-Math.abs(x.amount),category:x.category,subcategory:x.subcategory,kind:'expense',currency:'SAR',original:null,manual:true,outgoing:true}));
 const rows=transactionFilters([...normalizedTx(),...outgoingRows],{account:$('reportAccount').value,category:$('reportCategory').value,type:$('reportType').value,from:$('reportFrom').value,to:$('reportTo').value});
 const sub=$('reportSubcategory').value;
 let out=sub?rows.filter(t=>(t.subcategory||'Uncategorized')===sub):rows;
 const physical=$('reportPhysicalCard')?.value||'';if(physical)out=out.filter(t=>txMatchesPhysicalCardFilter(t,physical));
 if(reportDrill.type==='category')out=out.filter(t=>t.category===reportDrill.value);
 if(reportDrill.type==='subcategory')out=out.filter(t=>(t.subcategory||'Uncategorized')===reportDrill.value);
 return out;
}
function groupSpend(rows,keyfn){const m={};rows.filter(isSpend).forEach(t=>{const k=keyfn(t);m[k]=(m[k]||0)+Math.abs(t.amount)});return Object.entries(m).sort((a,b)=>b[1]-a[1])}
function renderReports(){
 fillGlobalPhysicalCardFilter($('reportPhysicalCard'),true);
 const rows=reportRows(),s=summaryData(rows);
 $('reportKpis').innerHTML=[kpiHTML('Total Spending',money(s.spend),'Filtered period','red'),kpiHTML('Total Income',money(s.income),'Filtered period','green'),kpiHTML('Net Flow',signed(s.net),'Income less spending',s.net>=0?'green':'red'),kpiHTML('Transactions',String(rows.length),'Filtered rows','blue')].join('');
 const dm=$('donutMode').value;
 const group=dm==='account'?groupSpend(rows,t=>accountName(t.account)):dm==='subcategory'?groupSpend(rows,t=>t.subcategory||'Uncategorized'):groupSpend(rows,t=>t.category);
 const total=group.reduce((s,x)=>s+x[1],0);
 let cursor=0,stops=[];
 group.forEach((g,i)=>{const pct=total?g[1]/total*100:0;stops.push(`${colors[i%colors.length]} ${cursor}% ${cursor+pct}%`);cursor+=pct});
 $('donut').style.background=group.length?`conic-gradient(${stops.join(',')})`:'#eef1f4';
 $('donutCenter').innerHTML=`<div><span class="meta">Total</span><br><b>${money(total)}</b></div>`;
 $('donutLegend').innerHTML=group.map((g,i)=>`<div class="legendRow"><span class="legendDot" style="background:${colors[i%colors.length]}"></span><span>${g[0]}</span><b>${money(g[1])}</b><span>${total?(g[1]/total*100).toFixed(1):0}%</span></div>`).join('');
 const cats=groupSpend(rows,t=>t.category).slice(0,12);
 const subs=groupSpend(rows,t=>t.subcategory||'Uncategorized').slice(0,15);
 const bg=$('barGroup').value;
 const bars=(bg==='subcategory'?subs:cats).slice(0,12),max=Math.max(...bars.map(x=>x[1]),1);
 $('barTitle').textContent=bg==='subcategory'?'Spending by Subcategory':'Spending by Category';
 $('barChart').innerHTML=bars.map((g,i)=>{const value=$('barMode').value==='percentage'?(s.spend?g[1]/s.spend*100:0):g[1];const h=$('barMode').value==='percentage'?(value/Math.max(...bars.map(x=>s.spend?x[1]/s.spend*100:0),1)*100):(g[1]/max*100);const label=$('barMode').value==='percentage'?value.toFixed(1)+'%':(g[1]>=1000?(g[1]/1000).toFixed(1)+'K':MONEY.format(g[1]));return `<div class="barCol"><div class="bar reportClickableBar" data-drill-type="${bg}" data-drill-value="${String(g[0]).replace(/"/g,'&quot;')}" style="height:${h}%;background:${colors[i%colors.length]}"><span class="barVal">${label}</span><span class="barLab">${g[0]}</span></div></div>`}).join('');
 $('topCategoriesBody').innerHTML=cats.slice(0,7).map(g=>`<tr class="reportClickable ${reportDrill.type==='category'&&reportDrill.value===g[0]?'active':''}" data-drill-type="category" data-drill-value="${String(g[0]).replace(/"/g,'&quot;')}"><td><b>${g[0]}</b></td><td>${money(g[1])}</td><td>${s.spend?(g[1]/s.spend*100).toFixed(1):0}%</td></tr>`).join('');
 const subParent={}; rows.filter(isSpend).forEach(t=>{const k=t.subcategory||'Uncategorized';if(!subParent[k])subParent[k]=t.category});
 $('topSubcategoriesBody').innerHTML=subs.slice(0,10).map(g=>`<tr class="reportClickable ${reportDrill.type==='subcategory'&&reportDrill.value===g[0]?'active':''}" data-drill-type="subcategory" data-drill-value="${String(g[0]).replace(/"/g,'&quot;')}"><td><b>${g[0]}</b></td><td>${subParent[g[0]]||'—'}</td><td>${money(g[1])}</td><td>${s.spend?(g[1]/s.spend*100).toFixed(1):0}%</td></tr>`).join('');
 const drillRows=rows.filter(isSpend).slice().sort((a,b)=>new Date(b.date)-new Date(a.date));
 $('reportTxBody').innerHTML=drillRows.map(txRow6).join('')||'<tr><td colspan="8">No spending transactions for this selection.</td></tr>';
 const sel=$('reportSelection'),clr=$('clearReportSelection');
 if(reportDrill.type){
   sel.innerHTML=`<span class="selectionChip">${reportDrill.type==='category'?'Category':'Subcategory'}: ${reportDrill.value}</span><span class="meta">${drillRows.length} transaction${drillRows.length===1?'':'s'} • ${money(drillRows.reduce((sum,t)=>sum+Math.abs(t.amount),0))}</span>`;
   clr.style.display='';
 }else{
   sel.innerHTML=`<span class="meta">Showing all transactions for the current report filters.</span>`;
   clr.style.display='none';
 }
 bindTxRows();
 bindReportDrill();
 $('reportAccountsBody').innerHTML=accounts.map(a=>{if(a.type==='card'){const m=cardMetrics(a);return `<tr><td><b>${a.bank} • ${a.name} •${a.ending}</b><br><span class="badge card">Credit Card</span></td><td class="red">${money(m.total)}</td><td>${money(m.limit)}</td><td class="amber">${money(m.inst)}</td><td class="green">${money(m.available)}</td><td>${m.util.toFixed(1)}%</td></tr>`}return `<tr><td><b>${a.bank} • ${a.name}</b><br><span class="badge bank">Bank Account</span></td><td class="green">${money(a.balance)}</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>`}).join('');
}
['reportFrom','reportTo','reportAccount','reportType','reportSubcategory'].forEach(id=>$(id).addEventListener('change',()=>{reportDrill={type:'',value:''};renderReports()}));
['donutMode','barMode','barGroup'].forEach(id=>$(id).addEventListener('change',renderReports));
$('reportCategory').addEventListener('change',()=>{reportDrill={type:'',value:''};fillReportSubcategories();renderReports()});
$('reportReset').addEventListener('click',()=>{reportDrill={type:'',value:''};$('reportFrom').value='2026-07-31';$('reportTo').value='2026-08-28';$('reportAccount').value='';$('reportPhysicalCard').value='';$('reportCategory').value='';$('reportSubcategory').value='';$('reportType').value='';fillReportSubcategories();renderReports()});
if($('clearReportSelection'))$('clearReportSelection').addEventListener('click',()=>{reportDrill={type:'',value:''};renderReports()});


function renderAfterInstallmentMutation(cardId=''){
 // V263: update only the page the user can currently see.
 // Hidden pages calculate from the same live state when the user navigates to them.
 const page=activeViewId();
 if(page==='installments')renderInstallments();
 else if(page==='executive')renderExecutiveDashboard();
 else if(page==='strategy')renderFinancialStrategy();
 else if(page==='financialposition')renderFinancialPosition();
 else if(page==='incomeplan')renderIncomePlan();
 else if(page==='accounts')renderAccounts();
 else if(page==='reports')renderReports();
 else if(page==='transactions')renderTransactions();
 else if(page==='accountDetail'&&currentAccountDetailId)openAccount(currentAccountDetailId,accountDetailReturnPage||'accounts');
 // Payment planner can be an active legacy/detail view.
 else if(page==='dashboard')renderPaymentPlanner();
 requestAnimationFrame(()=>captureReviewState());
}

function deleteInstallmentPlan(id){
 const p=installments.find(x=>x.id===id);if(!p)return;
 const c=planCalc(p),a=account(p.cardId);
 const msg=`Delete "${p.description}" from ${a?.name||'this card'}?\n\nRemaining amount: ${money(c.remaining)}\n\nUse this when the installment has been fully paid/settled and should no longer be included in future installment commitments.`;
 if(!confirm(msg))return;
 const seedIds=new Set([...MEEM_SEEDED_PLANS,...REQUIRED_0955_INSTALLMENTS,...BASE.initialInstallments].map(x=>x.id));
 if(seedIds.has(id)){
  const retired=new Set(JSON.parse(localStorage.getItem('pf_retired_installment_seed_ids')||'[]'));
  retired.add(id);localStorage.setItem('pf_retired_installment_seed_ids',JSON.stringify([...retired]));
 }
 deletedInstallmentIds.add(id);
 localStorage.setItem('pf_deleted_installment_ids',JSON.stringify([...deletedInstallmentIds]));
 installments=installments.filter(x=>x.id!==id);
 localStorage.setItem('pf_installments',JSON.stringify(installments));
 saveLocal();
 // Reflect the deduction immediately in the visible page; cloud persistence continues in background.
 renderAfterInstallmentMutation(a?.id||p.cardId||'');
}



function deleteCompletedInstallmentRecord(id){
 const p=installments.find(x=>x.id===id);
 if(!p)return;

 const a=account(p.cardId);
 if(!confirm(
  `Permanently delete this completed installment record?\n\n`+
  `${a?.bank||''} •${a?.ending||''}\n${p.description}\n${money(Number(p.fullAmount||0))}\n\n`+
  `It is already excluded from calculations. This action only removes its completed-history record and synchronizes the deletion to your other devices.`
 ))return;

 try{saveRecoverySnapshot('before-delete-completed-installment');}catch(_){}

 deletedInstallmentIds.add(id);
 localStorage.setItem('pf_deleted_installment_ids',JSON.stringify([...deletedInstallmentIds]));

 installments=installments.filter(x=>x.id!==id);
 localStorage.setItem('pf_installments',JSON.stringify(installments));
 saveLocal();

 // Full record push remains asynchronous; the visible deduction does not wait for cloud I/O.
 scheduleRecordPush('delete-completed-installment');
 renderAfterInstallmentMutation(a?.id||p.cardId||'');
}

function confirmInstallmentCompleted(id){
 const p=installments.find(x=>x.id===id);if(!p)return;
 const a=account(p.cardId);
 if(!confirm(`Confirm this installment plan is fully completed?\n\n${a?.bank||''} •${a?.ending||''}\n${p.description}\n\nAfter confirmation it will be removed from all card reserve, monthly commitment, payment planner, and income-plan calculations.`))return;
 p.completedConfirmed=true;
 p.completedAt=new Date().toISOString().slice(0,10);
 localStorage.setItem('pf_installments',JSON.stringify(installments));
 saveLocal();
 renderAfterInstallmentMutation(p.cardId||'');
}
function keepInstallmentActive(id){
 const p=installments.find(x=>x.id===id);if(!p)return;
 // Move the plan's reference month to the current month so it remains active
 // until the next monthly review rather than repeatedly appearing as due.
 p.referenceMonth=currentYearMonth();
 p.paidInstallments=Math.max(0,Number(p.months||1)-1);
 p.completedConfirmed=false;
 localStorage.setItem('pf_installments',JSON.stringify(installments));
 saveLocal();
 renderAfterInstallmentMutation(p.cardId||'');
}

function migrateSabAwayFromLegacySeed(){
 // V155: legacy SAB installment restoration disabled.
 return false;
}

function ensureRequiredInstallmentSeeds(){
 // V155: Supabase/user/import data is authoritative. Never recreate deleted installment plans.
 return false;
}