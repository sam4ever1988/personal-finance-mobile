/* V372 approved page layouts. Existing forms, IDs and financial actions are retained. */
(function(){
 'use strict';
 const el=id=>document.getElementById(id), esc=v=>escapeHtml(String(v??''));
 const palette=['#ef5665','#8a58ef','#f8bb35','#34b4df','#25cda0','#6396ee'];
 const iso=d=>d.toISOString().slice(0,10), day=s=>new Date(String(s).slice(0,10)+'T00:00:00Z');
 let reportMode='auto', txMode='weekly', reportExplore='merchant', goldRange='1m', goldPurity=24, goldUnit='gram', goldTab='active';
 let goldBusy=null, goldError='', lastGoldAttempt=0, historyBusy=null;
 const goldHistories=new Map();
 function node(tag,cls,html){const n=document.createElement(tag);n.className=cls||'';if(html)n.innerHTML=html;return n;}
 function move(n,parent){if(n&&parent)parent.append(n);}
 function periods(rows,from,to,mode,classify){
  const dates=rows.map(t=>String(t.date||'').slice(0,10)).filter(s=>/^\d{4}-\d{2}-\d{2}$/.test(s)).sort();
  from=from||dates[0]||iso(new Date());to=to||dates[dates.length-1]||from;
  if(!Number.isFinite(+day(from))||!Number.isFinite(+day(to))||from>to)return [];
  const start=day(from),end=day(to), map=new Map();
  const key=s=>{const d=day(s);if(mode==='monthly')return s.slice(0,7);if(mode==='weekly'){d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return iso(d);}return s;};
  // Limit unbounded history without dropping any transaction: aggregate long ranges monthly.
  if((end-start)/86400000>3660&&mode!=='monthly')return periods(rows,from,to,'monthly',classify);
  for(let d=new Date(start);d<=end;d.setUTCDate(d.getUTCDate()+1)){const s=iso(d),k=key(s);if(!map.has(k))map.set(k,{key:k,from:s,to:s,income:0,spend:0});else map.get(k).to=s;}
  for(const t of rows){const s=String(t.date||'').slice(0,10);if(s<from||s>to)continue;const p=map.get(key(s));if(!p)continue;const kind=classify(t),v=Math.abs(Number(t.amount)||0);if(kind==='income')p.income+=v;if(kind==='spend')p.spend+=v;}
  return [...map.values()];
 }
 function axis(v){return v>=1000?(v/1000).toFixed(v>=10000?0:1)+'K':Math.round(v);}
 function chart(series,paired=false){
  if(!series.length)return '<div class="layoutEmpty">No transactions in this period.</div>';
  const W=820,H=260,L=58,R=paired?20:58,T=18,B=48,plot=W-L-R,high=H-T-B;
  const max=Math.max(1,...series.flatMap(p=>paired?[p.spend,p.income]:[p.spend]));
  let cumulative=0;const sums=series.map(p=>(cumulative+=p.spend)),cm=Math.max(1,cumulative),step=plot/series.length;
  let svg='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+(paired?'Income and spending':'Spending and cumulative spending')+' by selected period">';
  for(let i=0;i<=4;i++){const y=T+i*high/4;svg+='<line x1="'+L+'" y1="'+y+'" x2="'+(W-R)+'" y2="'+y+'" class="chartGrid"/><text x="'+(L-8)+'" y="'+(y+4)+'" text-anchor="end">'+axis(max*(1-i/4))+'</text>';if(!paired)svg+='<text x="'+(W-R+8)+'" y="'+(y+4)+'">'+axis(cm*(1-i/4))+'</text>';}
  const points=[];
  series.forEach((p,i)=>{const x=L+step*(i+.5),bw=Math.max(1,Math.min(36,step*.64));
   const rect=(value,c,offset,width)=>'<rect x="'+(x+offset)+'" y="'+(T+high-value/max*high)+'" width="'+width+'" height="'+(value/max*high)+'" rx="2" fill="'+c+'"><title>'+esc(p.from+(p.to!==p.from?' – '+p.to:''))+': '+money(value)+'</title></rect>';
   svg+=paired?rect(p.income,'#25cda0',-bw*.6,bw*.5)+rect(p.spend,'#ef5665',bw*.1,bw*.5):rect(p.spend,'#ef5665',-bw/2,bw);
   points.push(x+','+(T+high-sums[i]/cm*high));
   const stride=Math.max(1,Math.ceil(series.length/8)),last=series.length-1;
   if(i===last||(i%stride===0&&last-i>=stride)){const date=day(p.from),label=p.key.length===7?date.toLocaleDateString('en-GB',{month:'short',year:'2-digit',timeZone:'UTC'}):date.toLocaleDateString('en-GB',{day:'2-digit',month:'short',timeZone:'UTC'});svg+='<text x="'+(i===last?W-R:x)+'" y="'+(H-18)+'" text-anchor="'+(i===last?'end':i===0?'start':'middle')+'">'+esc(label)+'</text>';}
  });
  if(!paired)svg+='<polyline points="'+points.join(' ')+'" fill="none" stroke="#25cda0" stroke-width="3" stroke-linejoin="round"/>';
  svg+='</svg><div class="chartLegend"><span><i style="background:'+(paired?'#25cda0':'#ef5665')+'"></i>'+(paired?'Money in':'Spending')+'</span><span><i style="background:'+(paired?'#ef5665':'#25cda0')+'"></i>'+(paired?'Spending & fees':'Cumulative spend · right axis')+'</span><small>'+financeBaseCurrency()+' • '+esc(series[0].from)+' → '+esc(series[series.length-1].to)+'</small></div>';
  return svg;
 }
 function modeButtons(id,modes,selected){return '<div class="layoutSegments" id="'+id+'">'+modes.map(([v,l])=>'<button type="button" data-view-control class="'+(v===selected?'selected':'')+'" data-mode="'+v+'">'+l+'</button>').join('')+'</div>';}
 function bindModes(id,select){el(id)?.querySelectorAll('[data-mode]').forEach(button=>{button.onclick=()=>select(button.dataset.mode);});}
 function bars(items,total,drill){const max=Math.max(1,...items.map(x=>x[1]));return items.map((x,i)=>'<button type="button" class="layoutRank" '+(drill?'data-drill-type="'+drill+'" data-drill-value="'+esc(x[0])+'"':'')+'><span>'+esc(x[0])+'</span><span class="layoutTrack"><i style="width:'+x[1]/max*100+'%;background:'+palette[i%palette.length]+'"></i></span><b>'+money(x[1])+'</b><small>'+(total?x[1]/total*100:0).toFixed(1)+'%</small></button>').join('')||'<div class="layoutEmpty">No spending in this period.</div>';}
 function applyReportLayout(){
  const root=el('reports');if(!root||root.dataset.layout372)return;root.dataset.layout372='1';
  const main=root.querySelector('.reportAnalyticsGrid'),second=root.querySelector('.reportAnalyticsSecond'),mix=root.querySelector('.reportMixPanel'),rank=el('barChart')?.closest('.reportPanel');
  move(rank,main);rank?.classList.add('reportRankingPanel');if(el('barTitle'))el('barTitle').textContent='Where Your Money Went';
  // Legacy donut elements remain present for existing renderers; category drilldown uses the ranked bars.
  if(mix){mix.hidden=true;move(mix,root);}
  const head=root.querySelector('.reportTrendPanel .reportPanelHead');head?.insertAdjacentHTML('beforeend',modeButtons('reportPeriodControls',[['daily','Daily'],['weekly','Weekly'],['monthly','Monthly']],'daily'));
  if(second){const compare=node('div','reportPanel','<div class="reportPanelHead"><div><h2>Compare Periods</h2><p>Same filters, previous period of equal length</p></div><label class="layoutCheck"><input type="checkbox" id="reportCompareToggle"> Compare</label></div><div id="reportCompareResult" class="layoutEmpty">Enable comparison to see how your spending changed.</div>');second.prepend(compare);}
  const left=node('div','layoutReportColumn'),right=node('div','layoutReportColumn');move(root.querySelector('.reportTrendPanel'),left);move(second?.firstElementChild,left);move(rank,right);move(second?.firstElementChild,right);main.append(left,right);second?.remove();
  const explore=node('div','reportPanel layoutExplore','<div class="reportPanelHead"><div><h2>Explore Spending</h2><p>Find the merchants and subcategories behind your spending</p></div></div>'+modeButtons('reportExploreControls',[['merchant','By merchant'],['subcategory','By subcategory']],'merchant')+'<div id="reportExploreRows"></div>');main?.after(explore);
  el('reportCompareToggle').onchange=()=>renderReports();
  bindModes('reportPeriodControls',mode=>{reportMode=mode;renderReports();});
  bindModes('reportExploreControls',mode=>{reportExplore=mode;renderReports();});
 }
 const originalReports=renderReports;
 renderReports=function(){originalReports();applyReportLayout();const rows=reportRows(),from=el('reportFrom').value,to=el('reportTo').value,span=(day(to)-day(from))/86400000;
  const mode=reportMode==='auto'?(span>90?'monthly':span>45?'weekly':'daily'):reportMode;
  el('reportPeriodControls').querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('selected',b.dataset.mode===mode));
  const classify=t=>txType(t)==='income'?'income':isSpend(t)?'spend':'';
  el('reportTrendChart').innerHTML=chart(periods(rows,from,to,mode,classify));
  const title=document.querySelector('#reports .reportTrendPanel h2');if(title)title.textContent=mode[0].toUpperCase()+mode.slice(1)+' Spending';
  el('barTitle').textContent='Where Your Money Went';
  if(el('reportCompareToggle').checked&&Number.isFinite(span)&&span>=0){
   const pto=new Date(day(from)-86400000),pfrom=new Date(pto-span*86400000),oldFrom=el('reportFrom').value,oldTo=el('reportTo').value;let previous;
   try{el('reportFrom').value=iso(pfrom);el('reportTo').value=iso(pto);previous=reportRows();}finally{el('reportFrom').value=oldFrom;el('reportTo').value=oldTo;}
   const cur=summaryData(rows).spend,prev=summaryData(previous).spend,diff=cur-prev;
   el('reportCompareResult').innerHTML='<div class="layoutCompare"><div><small>Current period</small><b>'+money(cur)+'</b></div><div><small>'+iso(pfrom)+' → '+iso(pto)+'</small><b>'+money(prev)+'</b></div><div><small>Change in spending</small><b class="'+(diff>0?'red':'green')+'">'+signed(diff)+(prev?' · '+(diff/prev*100).toFixed(1)+'%':' · No prior spending')+'</b></div></div>';
  }else el('reportCompareResult').textContent='Enable comparison to see how your spending changed.';
  const grouped=groupSpend(rows,t=>reportExplore==='subcategory'?(t.subcategory||'Uncategorized'):(t.description||'Unknown merchant'));
  el('reportExploreRows').innerHTML=bars(grouped.slice(0,6),summaryData(rows).spend,reportExplore==='subcategory'?'subcategory':null);
  el('reportExploreControls').querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('selected',b.dataset.mode===reportExplore));
  if(reportExplore==='merchant')el('reportExploreRows').querySelectorAll('button').forEach((b,i)=>b.onclick=()=>{nav('transactions');el('txSearch').value=grouped[i][0];renderTransactions();});
  bindReportDrill();
 };
 function applyTransactionsLayout(){
  const root=el('transactions');if(!root||root.dataset.layout372)return;root.dataset.layout372='1';
  const grid=root.querySelector('.txInsightGrid'),cat=el('txSpendChart')?.closest('.txDarkPanel'),flow=el('txFlowChart')?.closest('.txDarkPanel');
  const details=node('details','layoutDetails');details.innerHTML='<summary>Spending by category</summary>';move(cat,details);root.querySelector('.txTablePanel')?.before(details);
  const cv=el('txFlowChart');if(cv){cv.hidden=true;cv.after(node('div','layoutChart'));cv.nextElementSibling.id='txFlowVisual';}
  const head=flow?.querySelector('.txPanelHead');if(head){head.querySelector('b').textContent='Money In vs Money Out';head.insertAdjacentHTML('beforeend',modeButtons('txPeriodControls',[['daily','Daily'],['weekly','Weekly'],['monthly','Monthly']],txMode));}
  const filters=root.querySelector('.txFilterPanel');grid?.before(filters);
  bindModes('txPeriodControls',mode=>{txMode=mode;renderTransactions();});
 }
 const originalTxInsights=renderTxExecutiveInsights;
 renderTxExecutiveInsights=function(rows){originalTxInsights(rows);applyTransactionsLayout();rows=Array.isArray(rows)?rows:normalizedTx();
  el('txFlowVisual').innerHTML=chart(periods(rows,el('txFrom')?.value,el('txTo')?.value,txMode,t=>txType(t)==='income'?'income':['spend','fee'].includes(txType(t))?'spend':''),true);
  el('txPeriodControls').querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('selected',b.dataset.mode===txMode));
  const spends=rows.filter(t=>['spend','fee'].includes(txType(t))),cats=groupSpend(spends,t=>t.category||'Unclassified');
  el('txSpendChart').hidden=true;el('txSpendLegend').innerHTML=bars(cats.slice(0,8),spends.reduce((s,t)=>s+Math.abs(Number(t.amount)||0),0),'category');
  el('txSpendLegend').querySelectorAll('[data-drill-value]').forEach(b=>b.onclick=()=>{el('txCategory').value=b.dataset.drillValue;renderTransactions();});
  const un=rows.filter(t=>!t.category||/unclass|uncategor/i.test(t.category)).length,manual=rows.filter(t=>t.manual||t.isManual).length,stmt=rows.filter(t=>!t.statementMonth&&account(t.account)?.type==='card').length;
  const ids=new Set(rows.map(t=>String(t._id||t.id))),dups=possibleDuplicateGroups().filter(g=>{const values=Object.values(g).flat();return values.some(t=>typeof t==='object'&&t&&ids.has(String(t._id||t.id)));}).length;
  el('txAttention').innerHTML=[['uncategorized','Uncategorized transactions',un,'Review'],['duplicates','Possible duplicate groups',dups,'Check'],['manual','Manual entries',manual,'Review'],['statement','Statement assignment needed',stmt,'Open']].map(x=>'<div class="layoutReviewRow"><div><b>'+x[2]+' · '+x[1]+'</b></div><button type="button" class="btn small" data-review="'+x[0]+'">'+x[3]+'</button></div>').join('');
  el('txAttention').querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>{const review=b.dataset.review;if(review==='duplicates'){showDuplicateReview();return;}if(review==='statement'){rootScroll('.txRule');return;}window.financeTxReview=review;selectedTxIds.clear();renderTransactions();rootScroll('.txTablePanel');});
  if(window.financeTxReview)el('txShowingText').textContent+=' · '+window.financeTxReview+' review · Reset to clear';

 };
 function rootScroll(selector){document.querySelector('#transactions '+selector)?.scrollIntoView({behavior:'smooth',block:'start'});}
 function renderCashFlow(){
  const box=el('execCashFlow');if(!box)return;
  const income=Number(totalIncomePlan())||0,loans=Number(totalFixedLoans())||0,other=Number(outgoingThisMonthTotal())||0,paid=Number(remainingIncomePaymentsTotal())||0,left=Number(remainingIncomeAvailable())||0;
  const entries=[['Bank Loans',loans,'#ef5665'],['Cash / Other',other,'#f8bb35'],['Card Payments',paid,'#8a58ef']];
  const total=entries.reduce((s,x)=>s+Math.max(0,x[1]),0)+Math.max(0,left);let cursor=0;
  const slices=entries.concat(left>0?[['Remaining',left,'#25cda0']]:[]).filter(x=>x[1]>0).map(x=>{const start=cursor;cursor+=x[1]/Math.max(1,total)*100;return x[2]+' '+start+'% '+cursor+'%';});
  const pct=v=>income>0?(v/income*100<.1&&v>0?'&lt;0.1':(v/income*100).toFixed(1))+'%':'—';
  box.innerHTML='<div class="layoutFlowMonth">'+new Date().toLocaleDateString('en',{month:'short',year:'numeric'})+'</div><div class="layoutCashFlow"><div class="layoutFlowRing" style="background:'+(slices.length?'conic-gradient('+slices.join(',')+')':'#17475e')+'"><div><small>Income</small><b>'+money(income)+'</b></div></div><div class="layoutFlowRows">'+entries.map(x=>'<div class="layoutFlowRow"><span><i style="background:'+x[2]+'"></i>'+x[0]+'<b>'+money(x[1])+'</b></span><div class="layoutTrack"><i style="width:'+Math.min(100,Math.max(0,income>0?x[1]/income*100:0))+'%;background:'+x[2]+'"></i></div><strong style="color:'+x[2]+'">'+pct(x[1])+'</strong></div>').join('')+'<div class="layoutFlowRemaining"><span>Remaining</span><b class="'+(left<0?'red':'green')+'">'+money(left)+'</b></div>'+(left<0?'<small class="red">Commitments exceed income by '+money(-left)+'.</small>':'')+'</div></div>';
 }
 const originalExecutive=renderExecutiveDashboard;
 renderExecutiveDashboard=function(){originalExecutive();renderCashFlow();const box=el('execNext30');if(box){const now=new Date();now.setHours(0,0,0,0);const end=new Date(now);end.setDate(end.getDate()+30);const future=executiveUpcomingPayments(true).filter(p=>p.date>=now&&p.date<=end);box.innerHTML='<div class="layoutCompare"><div><small>Upcoming payments</small><b>'+future.length+'</b></div><div><small>Scheduled amount</small><b>'+money(future.reduce((s,p)=>s+Number(p.amount||0),0))+'</b></div></div><button class="btn primary" type="button" onclick="nav(\'incomeplan\')">Review Payment Plan</button>';}
 };
 function applyExecutiveLayout(){const main=document.querySelector('#executive .execMain');if(!main||main.dataset.layout372)return;main.dataset.layout372='1';
  const grid=main.querySelector('.execGrid'),bottom=main.querySelector('.execBottom'),columns=[...grid.children],left=columns[0],right=columns[1],narrow=columns[2];
  const next=node('div','execPanel','<div class="execTitle">Next 30 Days</div><div id="execNext30"></div>');right.append(next);
  // Existing gold, utilization, bank and Zakat panels remain available below the primary overview.
  const extra=node('div','layoutDashboardDetails');for(const sel of ['.execGoldPanel','.execUtilPanel','.execBankPanel','.execZakatPanel'])move(main.querySelector(sel),extra);
  narrow?.remove();const position=main.querySelector('.execPositionPanel'),quick=main.querySelector('.execQuickPanel'),positionColumn=node('div','layoutDashboardColumn');bottom.prepend(positionColumn);move(position,positionColumn);move(quick,positionColumn);const remaining=[...bottom.children].filter(p=>p!==positionColumn);const assetsColumn=node('div','layoutDashboardColumn'),liabilitiesColumn=node('div','layoutDashboardColumn');bottom.append(assetsColumn,liabilitiesColumn);move(remaining[0],assetsColumn);move(remaining[1],liabilitiesColumn);move(extra.querySelector('.execBankPanel'),positionColumn);move(extra.querySelector('.execGoldPanel'),assetsColumn);move(extra.querySelector('.execUtilPanel'),liabilitiesColumn);move(extra.querySelector('.execZakatPanel'),liabilitiesColumn);const title=main.querySelector('.execHero h2');if(title)title.textContent='Executive Overview';
  main.querySelector('.execPositionPanel [data-page-jump]')?.setAttribute('data-page-jump','financialposition');
 }
 function applyRentalLayout(){const root=el('rental');if(!root||root.dataset.layout372)return;root.dataset.layout372='1';const layout=root.querySelector('.rentalLayout'),bottom=root.querySelector('.rentalBottom'),right=root.querySelector('.rentalRight');
  const left=node('div','layoutRentalLeft');layout.prepend(left);move(root.querySelector('.rentalCalendarPanel'),left);move(bottom?.firstElementChild,left);move(el('rentalExpenses')?.closest('.panel'),right);bottom?.remove();
  const collect=node('div','panel','<div class="panelTitle">Payments to Collect</div><div id="rentalCollections"></div>');right.insertBefore(collect,el('rentalExpenses')?.closest('.panel'));
 }
 const originalRental=window.renderRental;
 window.renderRental=function(){originalRental();applyRentalLayout();const unpaid=rentalBookings.filter(rentalBelongs).filter(b=>!b.paid&&rentalGross(b)>Number(b.paidAmount||0));
  el('rentalCollections').innerHTML=unpaid.length?unpaid.map(b=>'<div class="layoutReviewRow"><div><b>'+esc(b.ref||'Booking')+'</b><small>'+esc(b.checkin)+' → '+esc(b.checkout)+'</small></div><b>'+money(Math.max(0,rentalGross(b)-Number(b.paidAmount||0)))+'</b><button type="button" class="btn small" data-collect="'+esc(b.id)+'">Review</button></div>').join(''):'<div class="layoutEmpty">No unpaid bookings.</div>';
  el('rentalCollections').querySelectorAll('[data-collect]').forEach(b=>b.onclick=()=>rentalOpenBooking(null,b.dataset.collect));
 };
 function applyAccountLayout(){const grid=document.querySelector('#accountprofile .prefsGrid');if(!grid||grid.dataset.layout372)return;grid.dataset.layout372='1';const cards=[...grid.children],left=node('div','layoutAccountColumn'),right=node('div','layoutAccountColumn');grid.append(left,right);
  cards.forEach((c,i)=>move(c,[0,2].includes(i)||['accountWorkspaceCard','adminAccessCard','accountOwnAccessCard'].includes(c.id)?left:right));
  const profile=el('accountProfileForm')?.closest('.panel'),label=el('financeWorkspaceName')?.closest('label'),button=el('financeWorkspaceNameSave'),status=el('financeWorkspaceNameStatus');
  if(profile&&label){const p=node('div','panel prefsCard','<div class="panelTitle">Workspace Settings</div>');right.insertBefore(p,profile.nextSibling);move(label,p);move(button,p);move(status,p);}
  const invitation=node('div','panel prefsCard','<div class="panelTitle">Invite a New User</div><p class="meta">Send a secure invitation email. Your workspace stays private unless you explicitly share it.</p><button class="btn primary" type="button" id="accountInviteOpen">Open Invitations</button>');invitation.hidden=!!window.financeSharedWorkspace;right.append(invitation);el('accountInviteOpen').onclick=()=>nav('invitations');
 }
 function applyGoldLayout(){const root=el('assets');if(!root||root.dataset.layout372)return;root.dataset.layout372='1';
  const pricing=el('goldPriceGrid')?.closest('.panel'),layout=node('div','layoutGoldGrid'),watch=node('div','panel goldMarketWatch','<div class="splitHead"><div><div class="panelTitle">Gold Market Watch</div><small class="meta">Spot price estimate • workspace currency • excludes retail fees</small></div>'+modeButtons('goldRangeControls',[['24h','1D'],['7d','1W'],['1m','1M'],['1y','1Y']],goldRange)+'</div><div class="goldChartControls"><label>Unit <select id="goldChartUnit" data-view-control><option value="gram">'+financeBaseCurrency()+' / gram</option><option value="ounce">USD / troy ounce</option></select></label>'+modeButtons('goldPurityControls',[[24,'24K'],[22,'22K'],[21,'21K'],[18,'18K']],goldPurity)+'</div><div id="goldHistoryChart" class="layoutChart"></div><div class="meta goldAttribution">History: <a href="https://standardbullion.com/spot-gold-price" target="_blank" rel="noopener">Data by Standard Bullion</a> · history converted using the current workspace reference rate</div>');
  pricing.before(layout);const side=node('div','layoutGoldSide');layout.append(watch,side);side.append(pricing);pricing.classList.add('goldSavedPrices');pricing.querySelector('.panelTitle').textContent='Price Source & Controls';watch.insertBefore(el('goldPriceGrid'),el('goldHistoryChart'));
  const tabArea=node('div','layoutGoldHistory');layout.after(tabArea);tabArea.append(node('div','splitHead','<div class="panelTitle">Gold Assets & History</div>'+modeButtons('goldAssetTabs',[['active','Active'],['sales','Sold'],['zakat','Zakat History']],goldTab)));
  ['goldAssetsBody','goldSaleHistoryBody','goldZakatHistoryBody'].forEach((id,i)=>{const table=el(id)?.closest('.panel'),title=table?.previousElementSibling,part=node('div','goldHistoryPart');part.dataset.goldTab=['active','sales','zakat'][i];if(title?.classList.contains('sectionTitle'))move(title,part);move(table,part);tabArea.append(part);});
  const holding=node('div','panel goldHoldings','<div class="panelTitle">Your Holdings</div><div id="goldHoldingsSummary"></div><button type="button" class="btn primary" onclick="addGoldAsset()">+ Add Gold</button>');side.append(holding);
  bindModes('goldRangeControls',mode=>{goldRange=mode;renderGoldHistory();loadGoldHistory();});
  bindModes('goldPurityControls',mode=>{goldPurity=Number(mode);renderGoldHistory();});
  el('goldChartUnit').onchange=e=>{goldUnit=e.target.value;renderGoldHistory();};
  bindModes('goldAssetTabs',mode=>{goldTab=mode;renderGoldTabs();});

  renderGoldTabs();
 }
 function renderGoldTabs(){document.querySelectorAll('[data-gold-tab]').forEach(p=>p.hidden=p.dataset.goldTab!==goldTab);el('goldAssetTabs')?.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('selected',b.dataset.mode===goldTab));}
 function marketStatus(){const age=Date.now()-Date.parse(goldMarket.updatedAt||'');return goldMarket.manual?'Manual override':goldError?'Saved quote • automatic retry pending':Number.isFinite(age)&&age<180000?'Live quote':Number(goldMarket.price24k)>0?'Last market quote • may be delayed':'Waiting for market price';}
 const originalGold=renderGoldAssets;
 renderGoldAssets=function(){originalGold();applyGoldLayout();const active=goldAssets.filter(a=>activeGoldWeight(a)>.0001),value=active.reduce((s,a)=>s+goldAssetValue(a),0),cost=active.reduce((s,a)=>s+Number(a.purchasePrice||0)*activeGoldWeight(a)/Math.max(.0001,Number(a.weight||0)),0),due=active.filter(goldZakatDue).reduce((s,a)=>s+goldAssetValue(a)*.025,0),next=active.map(goldNextDue).filter(Boolean).sort()[0];
  el('goldKpis').innerHTML=[kpiHTML('Total Gold Weight',MONEY.format(active.reduce((s,a)=>s+activeGoldWeight(a),0))+' g',active.length+' active assets'),kpiHTML('Current Market Value',money(value),'Spot-value estimate','green'),kpiHTML('Unrealized Gain / Loss',money(value-cost),'Current value less remaining purchase cost',value-cost>=0?'green':'red'),kpiHTML('Next Zakat Due',next||'—','Due now: '+money(due),due>0?'amber':'green')].join('');
  el('goldPriceGrid').innerHTML=[24,22,21,18].map(k=>kpiHTML(k+'K / gram',Number(goldMarket.price24k)>0?money(goldPricePerGram(k)):'—',goldMarket.manual?'Manual price':k===24?'Spot reference':'Derived by purity')).join('');
  el('refreshGoldPrice').textContent=goldMarket.manual?'Use Live Price':'Refresh Price';
  el('goldPriceMeta').textContent=marketStatus()+' • '+(goldMarket.updatedAt?new Date(goldMarket.updatedAt).toLocaleString():'No quote yet')+' • Source: '+(goldMarket.source||'—');
  el('goldHoldingsSummary').innerHTML=active.length?'<div class="layoutCompare"><div><small>Purchase cost</small><b>'+money(cost)+'</b></div><div><small>Market value</small><b>'+money(value)+'</b></div></div>':'<p class="meta">Add gold to track its value against purchase cost.</p>';
  renderGoldTabs();renderGoldHistory();
 };
 async function fetchJSON(url){const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Market data unavailable');return r.json();}
 refreshGoldMarketPrice=function(options={}){if(goldBusy)return goldBusy;const force=!!options.force||(!options.automatic&&!!goldMarket.manual);lastGoldAttempt=Date.now();goldBusy=(async()=>{try{
   if(financeBaseCurrency()!=='SAR')await financeFetchRate('SAR');const d=await fetchJSON('/api/gold');if(!(Number(d.price24k)>0)||!Number.isFinite(Date.parse(d.updatedAt)))throw Error('Invalid market quote');
   window.financeLiveGoldQuote=d;goldError='';
   // Background updates do not overwrite an explicitly selected manual valuation.
   if(!goldMarket.manual||force){goldMarket={price24k:Number(d.price24k)*financeFxFactor('SAR'),currency:financeBaseCurrency(),updatedAt:d.updatedAt,fetchedAt:d.fetchedAt,source:d.source,attribution:d.attribution,manual:false};localStorage.setItem('pf_gold_market',JSON.stringify(goldMarket));if(force&&typeof scheduleRecordPush==='function')scheduleRecordPush('gold-live-mode');}
   renderGoldAssets();if(el('executive')?.classList.contains('active'))renderExecutiveDashboard();return true;
  }catch(e){goldError=e.message;renderGoldAssets();return false;}finally{goldBusy=null;}})();return goldBusy;};
 async function loadGoldHistory(){const cached=goldHistories.get(goldRange);if(cached&&Date.now()-cached.loaded<300000){renderGoldHistory();return;}const range=goldRange;el('goldHistoryChart').innerHTML='<div class="layoutEmpty">Loading market history…</div>';if(historyBusy?.range===range)return historyBusy.promise;
  const promise=(async()=>{try{const d=await fetchJSON('/api/gold?range='+range);if(!Array.isArray(d.points)||!d.points.length)throw Error('No history');goldHistories.set(range,{...d,loaded:Date.now()});}catch(_){goldHistories.set(range,{points:[],loaded:Date.now(),error:true});}finally{if(historyBusy?.range===range)historyBusy=null;if(goldRange===range)renderGoldHistory();}})();historyBusy={range,promise};return promise;
 }
 function renderGoldHistory(){
  const box=el('goldHistoryChart');if(!box)return;
  el('goldRangeControls').querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('selected',b.dataset.mode===goldRange));
  el('goldPurityControls').querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('selected',Number(b.dataset.mode)===goldPurity);b.disabled=goldUnit==='ounce';});
  const data=goldHistories.get(goldRange);
  if(!data){box.innerHTML='<div class="layoutEmpty">Price history loads when you open Personal Assets.</div>';return;}
  if(data.error){box.innerHTML='<div class="layoutEmpty">Market history is temporarily unavailable.<br><button class="btn" type="button" id="goldHistoryRetry">Retry History</button></div>';el('goldHistoryRetry').onclick=()=>{goldHistories.delete(goldRange);loadGoldHistory();};return;}
  if(goldUnit!=='ounce'&&!Number.isFinite(financeFxFactor('SAR'))){box.innerHTML='<div class="layoutEmpty">Exchange rate unavailable for '+financeBaseCurrency()+'. Refresh the online price.</div>';return;}
  const points=data.points.filter(p=>Number.isFinite(Date.parse(p.t))&&Number(p.price24k)>0&&(goldUnit!=='ounce'||Number(p.usdOz)>0)).sort((a,b)=>Date.parse(a.t)-Date.parse(b.t));
  if(!points.length){box.innerHTML='<div class="layoutEmpty">No valid market history is available for this range.</div>';return;}
  const colors={24:'#f8bb35',22:'#20c9c3',21:'#469aff',18:'#a76cf4'},purities=goldUnit==='ounce'?[24]:[24,22,21,18];
  const value=(p,k)=>goldUnit==='ounce'?Number(p.usdOz):Number(p.price24k)*financeFxFactor('SAR')*k/24;
  const all=points.flatMap(p=>purities.map(k=>value(p,k)));
  const W=850,H=300,L=65,R=44,T=20,B=42,min=Math.min(...all),max=Math.max(...all),margin=Math.max((max-min)*.08,max*.001),low=min-margin,high=max+margin;
  const time0=Date.parse(points[0].t),time1=Date.parse(points.at(-1).t);
  const x=p=>L+(Date.parse(p.t)-time0)/Math.max(1,time1-time0)*(W-L-R),y=v=>T+(high-v)/(high-low)*(H-T-B);
  let svg='<svg class="goldCompareSvg" viewBox="0 0 '+W+' '+H+'" tabindex="0" role="img" aria-label="'+(goldUnit==='ounce'?'Gold price in USD per troy ounce':'Compare 24K, 22K, 21K and 18K gold prices on one '+financeBaseCurrency()+' per gram scale')+'">';
  for(let i=0;i<=4;i++){const py=T+(H-T-B)*i/4;svg+='<line class="chartGrid" x1="'+L+'" y1="'+py+'" x2="'+(W-R)+'" y2="'+py+'"/><text x="'+(L-7)+'" y="'+(py+4)+'" text-anchor="end">'+(high-(high-low)*i/4).toFixed(2)+'</text>';}
  for(const k of purities){const coords=points.map(p=>x(p)+','+y(value(p,k))).join(' ');svg+='<polyline points="'+coords+'" fill="none" stroke="'+colors[k]+'" stroke-width="'+(k===goldPurity?3.5:2.5)+'" data-purity="'+k+'"/><polyline class="goldLineHit" points="'+coords+'" fill="none" stroke="transparent" stroke-width="16" data-purity="'+k+'"/>';const end=points.at(-1);svg+='<text x="'+(W-R+7)+'" y="'+(y(value(end,k))+4)+'" style="fill:'+colors[k]+'">'+(goldUnit==='ounce'?'XAU':k+'K')+'</text>';}
  const stride=Math.max(1,Math.ceil(points.length/6)),last=points.length-1;
  points.forEach((p,i)=>{if(i!==last&&(i%stride!==0||last-i<stride))return;const label=goldRange==='24h'?new Date(p.t).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Riyadh'}):new Date(p.t).toLocaleDateString('en-GB',{month:'short',day:'numeric',timeZone:'Asia/Riyadh'});svg+='<text x="'+(i===last?W-R:x(p))+'" y="'+(H-12)+'" text-anchor="'+(i===last?'end':i===0?'start':'middle')+'">'+esc(label)+'</text>';});
  svg+='<line id="goldHoverLine" x1="0" x2="0" y1="'+T+'" y2="'+(H-B)+'" stroke="#99bfd4" stroke-dasharray="4 4" visibility="hidden"/><g id="goldHoverDots"></g></svg>';
  box.innerHTML='<div class="goldComparePlot">'+svg+'<div class="goldHoverTooltip" id="goldHoverTooltip" hidden role="status"></div></div><div class="chartLegend">'+purities.map(k=>'<span><i style="background:'+colors[k]+'"></i>'+(goldUnit==='ounce'?'Gold / ounce':k+'K')+'</span>').join('')+'<small>'+(goldUnit==='ounce'?'USD / troy ounce':''+financeBaseCurrency()+' / gram • 22K, 21K and 18K estimated from 24K spot price')+' • Riyadh time</small></div>';
  const chart=box.querySelector('svg'),tip=el('goldHoverTooltip'),cross=el('goldHoverLine'),dots=el('goldHoverDots');let focusIndex=points.length-1;
  function show(index,selected=goldPurity){focusIndex=Math.max(0,Math.min(points.length-1,index));const p=points[focusIndex],px=x(p);cross.setAttribute('x1',px);cross.setAttribute('x2',px);cross.setAttribute('visibility','visible');dots.innerHTML=purities.map(k=>'<circle cx="'+px+'" cy="'+y(value(p,k))+'" r="4" fill="'+colors[k]+'"/>').join('');tip.innerHTML='<b>'+esc(new Date(p.t).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Riyadh'}))+' · Riyadh</b>'+purities.map(k=>'<div'+(k===selected?' class="selected"':'')+'><span style="color:'+colors[k]+'">'+(goldUnit==='ounce'?'Gold / ounce':k+'K')+'</span><strong>'+(goldUnit==='ounce'?'USD ':financeBaseCurrency()+' ')+value(p,k).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})+'</strong></div>').join('');tip.hidden=false;const fraction=(px-L)/(W-L-R);tip.style.left=(fraction>.6?'8px':'auto');tip.style.right=(fraction>.6?'auto':'8px');}
  const inspectPoint=event=>{const rect=chart.getBoundingClientRect(),px=(event.clientX-rect.left)/rect.width*W;let index=0;for(let i=1;i<points.length;i++)if(Math.abs(x(points[i])-px)<Math.abs(x(points[index])-px))index=i;show(index,Number(event.target.dataset?.purity)||goldPurity);};chart.addEventListener('pointermove',inspectPoint);chart.addEventListener('pointerdown',inspectPoint);
  chart.addEventListener('pointerleave',event=>{if(event.pointerType==='touch')return;tip.hidden=true;cross.setAttribute('visibility','hidden');dots.innerHTML='';});
  chart.addEventListener('focus',()=>show(focusIndex));
  chart.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();show(event.key==='Home'?0:event.key==='End'?points.length-1:focusIndex+(event.key==='ArrowLeft'?-1:1));}if(event.key==='Escape'){tip.hidden=true;cross.setAttribute('visibility','hidden');dots.innerHTML='';}});
 }
 function startGold(){const assets=el('assets')?.classList.contains('active');if(!assets&&!el('executive')?.classList.contains('active'))return;if(Date.now()-lastGoldAttempt>45000)refreshGoldMarketPrice({automatic:true});if(assets)loadGoldHistory();}
 const originalNav=nav;
 nav=function(page){const result=originalNav(page);if(page==='assets'||page==='executive')startGold();return result;};
 const originalShell=ensureCanonicalShell;
 ensureCanonicalShell=function(){originalShell();const top=el('canonicalAppTop');if(!top)return;top.querySelectorAll('.canonicalMenuTrigger').forEach(b=>{
  b.onclick=e=>{e.preventDefault();e.stopPropagation();const m=b.closest('[data-nav-menu]');if(matchMedia('(max-width:900px)').matches){openCanonicalMobileSheet(top,m,b);return;}const open=true;top.querySelectorAll('[data-nav-menu]').forEach(x=>{x.classList.remove('open');x.querySelector('.canonicalMenuTrigger')?.setAttribute('aria-expanded','false');});m.classList.toggle('open',open);b.setAttribute('aria-expanded',String(open));};
  b.onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();const m=b.closest('[data-nav-menu]');m.classList.add('open');b.setAttribute('aria-expanded','true');m.querySelector('.canonicalDropdown button')?.focus();}if(e.key==='Escape'){b.closest('[data-nav-menu]').classList.remove('open');b.setAttribute('aria-expanded','false');}};
  const m=b.closest('[data-nav-menu]');m.onkeydown=e=>{if(e.key==='Escape'){m.classList.remove('open');b.setAttribute('aria-expanded','false');b.focus();}};m.onmouseleave=()=>{if(!m.contains(document.activeElement)){m.classList.remove('open');b.setAttribute('aria-expanded','false');}};m.onfocusout=e=>{if(!m.contains(e.relatedTarget)){m.classList.remove('open');b.setAttribute('aria-expanded','false');}};
 });};
 applyExecutiveLayout();applyReportLayout();applyTransactionsLayout();applyRentalLayout();applyAccountLayout();applyGoldLayout();
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)startGold();});window.addEventListener('online',startGold);
 setInterval(()=>{if(!document.hidden)startGold();},60000);
 window.financeLayoutData={periods,chart};
 // A fresh click exits manual valuation only when the user explicitly requests it.
 ensureCanonicalShell();
 if(el('executive')?.classList.contains('active'))renderExecutiveDashboard();
 startGold();
})();
