/* Monthly dues and statement evidence. Forecasts never create transactions. */
function financeMerchantKey(value){
 return String(value||'').toLowerCase().normalize('NFKC').replace(/\b(riyadh|jeddah|saudi arabia|ksa|sar|purchase|pos|online payment)\b/g,' ').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
}
function financeRecurringCandidates(rows,known,ignored,month){
 const groups=new Map(),idx=m=>Number(m.slice(0,4))*12+Number(m.slice(5,7)),now=idx(month);
 rows.forEach(r=>{
  if(!(Number(r.amount)<0)||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||r.kind==='transfer'||r.recurringExcluded)return;
  const label=financeMerchantKey(r.description),all=label+' '+String(r.category||'')+' '+String(r.subcategory||'');
  if(/loan|installment|instalment|tasaheel|murabaha|card payment|transfer|grocery|groceries|supermarket|restaurant/i.test(all))return;
  if(!/stc|mobily|zain|electric|water|internet|telecom|subscription|netflix|spotify|rent|insurance|tuition|school|utility|utilities|اشتراك|كهرباء|مياه|اتصالات|إيجار/i.test(all))return;
  const age=now-idx(r.date.slice(0,7));if(age<1||age>6||!label)return;
  const key=[r.account,r.physicalCardEnding||'',r.currency||'',label].join('|');
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);
 });
 const result=[];
 groups.forEach((items,key)=>{
  if(ignored.includes(key))return;
  const byMonth=new Map();items.forEach(r=>{const m=r.date.slice(0,7);if(!byMonth.has(m))byMonth.set(m,[]);byMonth.get(m).push(r);});
  // Multiple payments in a month are ambiguous, not evidence of one monthly due.
  const months=[...byMonth.keys()].sort();if(months.length<3||months.some(m=>byMonth.get(m).length!==1))return;
  const last=months.slice(-3);if(idx(last[2])!==now-1||idx(last[2])-idx(last[0])!==2)return;
  const evidence=last.map(m=>byMonth.get(m)[0]),days=evidence.map(r=>Number(r.date.slice(8))),amounts=evidence.map(r=>Math.abs(Number(r.amount))).sort((a,b)=>a-b);
  if(Math.max(...days)-Math.min(...days)>7)return;
  const row=evidence[2],merchant=financeMerchantKey(row.description);
  if(known.some(k=>k.smartRecurring?.key===key||financeMerchantKey(k.description||k.name)===merchant))return;
  result.push({key,description:row.description,account:row.account,card:row.physicalCardEnding||'',currency:row.currency,category:row.category,subcategory:row.subcategory,amount:amounts[1],dueDay:days.sort((a,b)=>a-b)[1],variable:amounts[2]-amounts[0]>.01,evidence});
 });
 return result;
}
function financeStrongStatementMatches(upload,existing,monthFor){
 const pairs=[],remaining=[],used=new Set();
 const learned=new Map();existing.forEach(old=>(old.statementEvidence||[]).forEach(e=>{const a=financeMerchantKey(old.description),b=financeMerchantKey(e.description),scope=[old.account,old.physicalCardEnding||'',b].join('|');if(a&&b){if(!learned.has(scope))learned.set(scope,new Set());learned.get(scope).add(a);}}));
 const candidatesFor=row=>existing.filter(old=>{
  if(old.account!==row.account||(old.currency||'SAR')!==(row.currency||'SAR')||!old._id)return false;
  const c=String(row.physicalCardEnding||''),d=String(old.physicalCardEnding||'');if(c!==d)return false;
  if(Math.abs(Number(row.amount)-Number(old.amount))>.005||importDateDays(row.date,old.date)>3||monthFor(row)!==monthFor(old))return false;
  if(row.reference&&old.reference)return row.reference===old.reference;
  const key=financeMerchantKey(row.description),aliases=(old.statementEvidence||[]).map(e=>financeMerchantKey(e.description));
  const remembered=learned.get([row.account,old.physicalCardEnding||'',key].join('|'));
  return key.length>2&&(key===financeMerchantKey(old.description)||aliases.includes(key)||remembered?.size===1&&remembered.has(financeMerchantKey(old.description)));
 });
 const all=upload.map(row=>({row,candidates:candidatesFor(row)}));
 all.forEach(({row,candidates})=>{
  if(candidates.length===1&&!used.has(candidates[0]._id)&&all.filter(x=>x.candidates.some(c=>c._id===candidates[0]._id)).length===1){used.add(candidates[0]._id);pairs.push({row,match:candidates[0]});}else remaining.push(row);
 });
 return {pairs,remaining};
}
function financeRecurringPaymentCandidates(o,rows,month){
 const cfg=o.smartRecurring;if(!cfg)return [];
 return rows.filter(r=>r.account===cfg.account&&(!cfg.currency||(r.currency||'SAR')===cfg.currency)&&!(o.smartUnlinked||[]).includes(r._id)&&(!cfg.card||r.physicalCardEnding===cfg.card)&&r.date?.slice(0,7)===month&&Number(r.amount)<0&&r.kind!=='transfer'&&financeMerchantKey(r.description)===cfg.merchant&&Math.abs(Number(r.date.slice(8))-cfg.dueDay)<=7);
}
(function(){
 const esc=escapeHtml,el=id=>document.getElementById(id),can=section=>!window.financeSectionPermission||window.financeSectionPermission(section)==='edit';
 const currentRows=()=>liveCardTransactions().filter(r=>!installments.some(p=>p.linkedTransactionId===r._id));
 const monthFor=r=>account(r.account)?.type==='card'?assignedTransactionPaymentMonth(r.account,r):(r.statementMonth||r.paymentMonth||r.date?.slice(0,7));
 const snapshot=r=>JSON.stringify(r);
 function suggestions(){return financeRecurringCandidates(currentRows(),[...outgoings,...(financeSettings.loans||[]),...installments],financeSettings.smartDueIgnored||[],currentIncomeMonth());}
 function persistOutgoings(){saveLocal();scheduleRecordPush('monthly-dues-review');renderIncomePlan();renderOutgoings();renderDashboard();window.financeRenderPremium?.();}
 function saveLinkedPayment(o,r,month){
  if(outgoingPaymentEntries(o,month).length||outgoings.some(other=>other!==o&&outgoingPaymentEntries(other,month).some(p=>p.existingTransactionId===r._id)))return false;
  // Link evidence only. No bank debit, card payment or transaction is generated.
  o.payments=o.payments||{};o.payments[month]=[{id:'linked:'+r._id,amount:Math.abs(Number(r.amount)),date:r.date,sourceId:r.account,existingTransactionId:r._id,linkedExisting:true}];
  if(o.smartRecurring.variable){o.amountsByMonth=o.amountsByMonth||{};o.amountsByMonth[month]=Math.abs(Number(r.amount));}
  return true;
 }
 window.financeAutoLinkMonthlyDues=function(){
  if(!can('outgoings')||window.__financeStateInitialized!==true)return;
  const rows=currentRows(),month=currentIncomeMonth();
  outgoings.filter(o=>o.smartRecurring).forEach(o=>{
   const candidates=financeRecurringPaymentCandidates(o,rows,month);
   if(candidates.length===1&&Math.abs(Math.abs(candidates[0].amount)-Number(o.amount))<.005)saveLinkedPayment(o,candidates[0],month);
  });
 };
 const originalSave=saveLocal;saveLocal=function(){window.financeAutoLinkMonthlyDues();return originalSave.apply(this,arguments);};
 window.financeRenderDues=function(){
  const host=el('smartMonthlyDues');if(!host)return;
  const month=currentIncomeMonth(),list=suggestions(),rows=currentRows(),approved=outgoings.filter(o=>o.smartRecurring);
  const edit=can('outgoings');
  host.innerHTML='<div class="smartHeading"><div><span class="smartEyebrow">LESS ADMIN, MORE CLARITY</span><h3>Monthly dues · '+esc(month)+'</h3><p>Suggestions use three consecutive months. Approve a plan once; review changes here.</p></div><span class="smartPill">'+list.length+' suggestions</span></div>'+
   '<div class="smartDuesGrid">'+list.map((s,i)=>'<article class="smartDue"><span class="smartPill">'+(s.variable?'Variable · estimate':'Regular amount')+'</span><h4>'+esc(s.description)+'</h4><b>'+money(s.amount)+'</b><p>Usually around day '+s.dueDay+' · '+esc(accountName(s.account))+'</p><details><summary>Why suggested?</summary>'+s.evidence.map(r=>'<p>'+esc(r.date)+' · '+money(Math.abs(r.amount))+'</p>').join('')+'</details><div class="smartActions"><button class="btn primary" data-due-approve="'+i+'" '+(!edit?'disabled':'')+'>Review & approve</button><button class="btn" data-due-ignore="'+i+'" '+(!can('finance_settings')?'disabled':'')+'>Ignore</button></div></article>').join('')+'</div>'+
   (!list.length?'<p class="meta">No new patterns need review. Keep recording payments; suggestions appear when there is enough consistent history.</p>':'')+
   '<div class="statementCardTableWrap"><table class="txTable"><thead><tr><th>Approved monthly due</th><th>Plan</th><th>This month</th><th>Review</th></tr></thead><tbody>'+approved.map((o,i)=>{
    const candidates=financeRecurringPaymentCandidates(o,rows,month),paid=outgoingPaidAmount(o,month),candidate=candidates.length===1?candidates[0]:null;
    return '<tr><td>'+esc(o.description)+'<br><small>Around day '+o.smartRecurring.dueDay+'</small></td><td>'+money(o.amount)+(o.smartRecurring.variable?' · estimate':'')+'</td><td>'+(paid>0?'Linked payment '+money(paid):candidate?'Recorded payment found '+money(-candidate.amount):candidates.length?'Several possible payments':'Awaiting payment')+'</td><td><button class="btn small" data-due-edit="'+i+'" '+(!edit?'disabled':'')+'>Edit plan</button> '+(!paid&&candidate?'<button class="btn small primary" data-due-link="'+i+'" '+(!edit?'disabled':'')+'>Confirm existing payment</button>':'')+'</td></tr>';
   }).join('')+'</tbody></table></div><p class="meta">Approved dues also appear in Scheduled Payments. Linking an existing transaction never deducts money again. Loans and card installments stay in their existing plans.</p>';
  host.querySelectorAll('[data-due-approve]').forEach(b=>b.onclick=()=>{
   if(!edit)return;const s=list[Number(b.dataset.dueApprove)],workspace=window.financeWorkspaceUserId;
   openUnifiedAction({title:'Review monthly due',subtitle:'Approve a recurring plan. No money will be moved.',save:'Approve monthly plan',fields:[{name:'description',label:'Name',value:s.description,required:true},{name:'amount',label:'Expected amount',type:'number',value:s.amount,required:true},{name:'dueDay',label:'Usual payment day (1–31)',type:'number',value:s.dueDay,required:true}],submit:v=>{
    if(workspace!==window.financeWorkspaceUserId||!can('outgoings'))return false;
    const amount=Number(v.amount),day=Number(v.dueDay);if(!(amount>0)||!Number.isFinite(amount)||!Number.isInteger(day)||day<1||day>31||!String(v.description).trim())return false;
    if(outgoings.some(o=>o.smartRecurring?.key===s.key))return true;
    outgoings.push({id:'due-'+Date.now(),description:String(v.description).trim(),amount,dueDay:day,defaultPaymentAccountId:s.account,method:account(s.account)?.type==='card'?'Credit Card':'Bank Transfer',category:s.category||'Miscellaneous',subcategory:s.subcategory||'Unexpected Expenses',startMonth:month,forever:true,months:1,payments:{},smartRecurring:{key:s.key,account:s.account,card:s.card,currency:s.currency||'SAR',merchant:financeMerchantKey(s.description),dueDay:day,variable:s.variable}});persistOutgoings();return true;
   }});
  });
  host.querySelectorAll('[data-due-ignore]').forEach(b=>b.onclick=()=>{if(!can('finance_settings'))return;financeSettings.smartDueIgnored=[...new Set([...(financeSettings.smartDueIgnored||[]),list[Number(b.dataset.dueIgnore)].key])];financeSettingsDirty=true;saveLocal();window.financeRenderDues();});
  host.querySelectorAll('[data-due-edit]').forEach(b=>b.onclick=()=>{
   if(!can('outgoings'))return;const o=approved[Number(b.dataset.dueEdit)],workspace=window.financeWorkspaceUserId;
   openUnifiedAction({title:'Edit monthly due',subtitle:'Update the forecast for future payments.',save:'Save plan',fields:[{name:'description',label:'Name',value:o.description,required:true},{name:'amount',label:'Expected amount',type:'number',value:o.amount,required:true},{name:'dueDay',label:'Usual payment day (1–31)',type:'number',value:o.smartRecurring.dueDay,required:true}],submit:v=>{const amount=Number(v.amount),day=Number(v.dueDay);if(workspace!==window.financeWorkspaceUserId||!can('outgoings')||!(amount>0)||!Number.isFinite(amount)||!Number.isInteger(day)||day<1||day>31||!String(v.description).trim())return false;o.description=String(v.description).trim();o.amount=amount;o.smartRecurring.dueDay=day;o.dueDay=day;persistOutgoings();return true;}});
  });
  host.querySelectorAll('[data-due-link]').forEach(b=>b.onclick=()=>{if(!can('outgoings'))return;const o=approved[Number(b.dataset.dueLink)],matches=financeRecurringPaymentCandidates(o,currentRows(),month);if(matches.length!==1)return;if(saveLinkedPayment(o,matches[0],month))persistOutgoings();});
  if((financeSettings.smartDueIgnored||[]).length&&can('finance_settings')){const b=document.createElement('button');b.className='btn';b.textContent='Review ignored suggestions';b.onclick=()=>{financeSettings.smartDueIgnored=[];financeSettingsDirty=true;saveLocal();window.financeRenderDues();};host.append(b);}
 };
 const incomeRender=renderIncomePlan;renderIncomePlan=function(){const r=incomeRender.apply(this,arguments);window.financeRenderDues();return r;};
 // High-confidence matches are staged as evidence links, not additional transactions.
 const split=splitFreshStatementRows;
 splitFreshStatementRows=function(rows,existing){
  const effective=existing.map(r=>({...r,...(txOverrides[r._id]||{})})).filter(r=>!['deleted','excluded-duplicate'].includes(transactionActions[r._id]?.status));
  const strong=financeStrongStatementMatches(rows,effective,monthFor),result=split(strong.remaining,effective.filter(r=>!strong.pairs.some(p=>p.match._id===r._id)));
  result.autoLinks=strong.pairs.map(p=>({...p,snapshot:snapshot(p.match),workspace:window.financeWorkspaceUserId}));return result;
 };
 window.financeCommitStatementLinks=function(){
  const links=importDuplicateDecision?.autoLinks||[];if(!links.length)return;
  if(!can('tx_overrides'))throw Error('Editing permission is required to link statement evidence.');
  const current=existingStatementImportRows().map(r=>({...r,...(txOverrides[r._id]||{})}));
  links.forEach(p=>{const old=current.find(r=>r._id===p.match._id);if(p.workspace!==window.financeWorkspaceUserId||!old||snapshot(old)!==p.snapshot||transactionActions[old._id]?.status)throw Error('A matched record changed. Read the statement again before confirming.');});
  links.forEach(p=>{const id=p.match._id,evidence={fileName:importPreviewFileName,date:p.row.date,amount:p.row.amount,description:p.row.description,reference:p.row.reference||'',statementMonth:monthFor(p.row)},previous=txOverrides[id]?.statementEvidence||p.match.statementEvidence||[];
   txOverrides[id]={...(txOverrides[id]||{}),statementEvidence:[...previous.filter(e=>JSON.stringify(e)!==JSON.stringify(evidence)),evidence].slice(-12)};
  });syncTransactionOverridesImmediate();
 };
 const preview=renderImportPreview;renderImportPreview=function(){const r=preview.apply(this,arguments),links=importDuplicateDecision?.autoLinks||[];let box=el('smartImportMatches');if(!box){box=document.createElement('div');box.id='smartImportMatches';el('importPreviewMeta')?.after(box);}
  if(box)box.innerHTML=links.length?'<details class="panel"><summary>'+links.length+' clear matches · count once</summary><p>Confirming links statement evidence to these existing records. Your category, notes, amount and statement month are preserved.</p>'+links.map(p=>'<p>'+esc(p.match.description)+' · '+money(Math.abs(p.match.amount))+' · '+esc(p.match.date)+' → '+esc(p.row.description)+'</p>').join('')+'</details>':'';
  const possible=(importDuplicateDecision?.duplicates||[]).map((entry,index)=>({entry,index})).filter(({entry})=>entry.match?._id&&!entry.cardMatches?.length);
  if(box&&possible.length){box.insertAdjacentHTML('beforeend','<details class="panel"><summary>'+possible.length+' possible matches need your decision</summary><p>Compare both descriptions before linking. Confirming remembers this merchant name for future imports on the same account and card.</p>'+possible.map(({entry,index})=>'<div class="smartMatch"><p><b>Statement:</b> '+esc(entry.row.description)+' · '+money(Math.abs(entry.row.amount))+' · '+esc(entry.row.date)+'<br><b>Existing:</b> '+esc(entry.match.description)+' · '+money(Math.abs(entry.match.amount))+' · '+esc(entry.match.date)+'</p><button class="btn" data-smart-link="'+index+'">Same transaction — link existing</button></div>').join('')+'</details>');
   box.querySelectorAll('[data-smart-link]').forEach(b=>b.onclick=()=>{if(!can('tx_overrides'))return;const decision=importDuplicateDecision,index=Number(b.dataset.smartLink),entry=decision.duplicates[index];if(!entry?.match?._id)return;
    if((decision.autoLinks||[]).some(p=>p.match._id===entry.match._id)){alert('This record is already linked to another row.');return;}
    const match={...entry.match,...(txOverrides[entry.match._id]||{})};decision.autoLinks=decision.autoLinks||[];decision.autoLinks.push({row:entry.row,match,snapshot:snapshot(match),workspace:window.financeWorkspaceUserId});decision.duplicates.splice(index,1);decision.decided=!decision.duplicates.length;importPreviewRows=importPreviewRows.filter(row=>row!==entry.row);renderImportPreview();
   });
  }
  if(links.length){el('confirmStatementImport').disabled=false;el('confirmStatementImport').textContent='Confirm import / link matches';}
  return r;};
})();

/* The premium overview is rendered from existing accounting functions. */
(function(){
 const esc=escapeHtml,allowed=p=>!window.financeCanViewPage||window.financeCanViewPage(p);
 function spark(values,color,fill){
  const max=Math.max(1,...values),points=values.map((v,i)=>[40+i*96,180-v/max*135]);
  const path=points.map((p,i)=>(i?'L':'M')+p.join(',')).join(' ');
  return '<path d="'+path+'" fill="none" stroke="'+color+'" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'+(fill?'<path d="'+path+' L520,195 L40,195 Z" fill="'+color+'" opacity=".09"/>':'');
 }
 window.financeRenderPremium=function(){
  const host=document.getElementById('premiumDashboard'),design=document.documentElement.dataset.financeDesign;
  if(!host||!['premium','royal','executive'].includes(design)||typeof accounts==='undefined'||window.__financeStateInitialized!==true)return;
  const month=currentIncomeMonth(),rows=allowed('transactions')?liveCardTransactions():[],cards=allowed('accounts')?accounts.filter(a=>a.type==='card'):[],banks=allowed('accounts')?accounts.filter(a=>a.type==='bank'):[];
  const cash=banks.reduce((s,a)=>s+adjustedBankBalance(a),0),credit=cards.reduce((s,a)=>s+Math.max(0,Number(cardMetrics(a).available||0)),0);
  const months=Array.from({length:6},(_,i)=>monthAdd(month,i-5)),expenses=months.map(m=>rows.filter(r=>r.date?.startsWith(m)&&Number(r.amount)<0&&r.kind!=='transfer').reduce((s,r)=>s-Number(r.amount),0)),income=months.map(m=>rows.filter(r=>r.date?.startsWith(m)&&Number(r.amount)>0&&r.kind==='income').reduce((s,r)=>s+Number(r.amount),0));
  const spend=expenses[5],categoriesTotal={};rows.filter(r=>r.date?.startsWith(month)&&r.amount<0&&r.kind!=='transfer').forEach(r=>{const k=r.category||'Other';categoriesTotal[k]=(categoriesTotal[k]||0)-Number(r.amount);});
  const cats=Object.entries(categoriesTotal).sort((a,b)=>b[1]-a[1]),top=cats.slice(0,3);if(cats.length>3)top.push(['Other',cats.slice(3).reduce((s,r)=>s+r[1],0)]);
  const colors=['#9e88ff','#70dfe0','#e9a6dc','#6c7ca8'];let start=0;const stops=top.map((r,i)=>{const end=start+(spend?r[1]/spend*100:0),v=colors[i]+' '+start+'% '+end+'%';start=end;return v;}).join(',');
  const dueList=allowed('incomeplan')?[...executiveUpcomingPayments(true),...outgoings.flatMap(o=>outgoingOccurrences(o,Math.max(12,loanMonthDiff(o.startMonth,month)+3))).filter(x=>x.month>=month&&x.month<=monthAdd(month,1)&&!x.paid).map(x=>({date:new Date(x.date+'T12:00:00'),label:x.description,kind:'Monthly due',amount:outgoingRemaining(outgoings.find(o=>o.id===x.outgoingId),x.month)}))].sort((a,b)=>a.date-b.date).slice(0,5):[],dueTotal=dueList.reduce((s,p)=>s+p.amount,0),known=[...outgoings,...(financeSettings.loans||[]),...installments],dues=allowed('incomeplan')?financeRecurringCandidates(rows.filter(r=>!installments.some(p=>p.linkedTransactionId===r._id)),known,financeSettings.smartDueIgnored||[],month):[];
  const action=(page,label,cls='')=>allowed(page)?'<button class="btn '+cls+'" data-premium-go="'+page+'">'+label+'</button>':'';
  host.innerHTML='<header class="premiumHeading"><div><span class="smartEyebrow">YOUR PERSONAL FINANCE STUDIO</span><h1>Make room for what matters.</h1><p>'+new Date().toLocaleDateString('en-GB',{month:'long',year:'numeric'})+' · A clear view of your money</p></div>'+action('importstatements','↥ Import statement','primary')+'</header>'+
   '<div class="premiumGrid"><section class="premiumPanel premiumCash"><span class="premiumIcon">◈</span><small>Bank cash balance</small><h2>'+balanceMoney(cash)+'</h2><span class="smartPill">'+banks.length+' linked accounts</span><div class="premiumCashDetails"><div><small>Available credit</small><b>'+money(credit)+'</b></div><div><small>Recorded spending · this month</small><b>'+money(spend)+'</b></div></div><p class="meta">Credit is borrowing capacity, separate from your cash.</p><div class="smartActions">'+action('accounts','View accounts')+action('transactions','Transactions')+'</div></section>'+
   '<section class="premiumPanel premiumTrend"><div class="smartHeading"><h3>Money in motion</h3><span class="smartPill">6 months</span></div><div class="premiumLegend"><span style="color:#70dfe0">● Recorded income</span><span style="color:#9e88ff">● Spending</span></div><svg class="premiumChart" viewBox="0 0 560 225" role="img" aria-label="Six-month recorded income and spending trend"><path d="M40 45H520 M40 95H520 M40 145H520 M40 195H520" stroke="currentColor" opacity=".1"/>'+(()=>{const scale=Math.max(1,...expenses,...income);const line=(values,color)=>{const points=values.map((v,i)=>[40+i*96,195-v/scale*150]),path=points.map((p,i)=>(i?'L':'M')+p.join(',')).join(' ');return '<path d="'+path+' L520 195 L40 195Z" fill="'+color+'" opacity=".08"/><path d="'+path+'" fill="none" stroke="'+color+'" stroke-width="3"/>'+points.map((p,i)=>'<circle cx="'+p[0]+'" cy="'+p[1]+'" r="4" fill="'+color+'"><title>'+months[i]+': '+money(values[i])+'</title></circle>').join('');};return line(income,'#70dfe0')+line(expenses,'#9e88ff');})()+months.map((m,i)=>'<text x="'+(40+i*96)+'" y="220" text-anchor="middle" fill="currentColor" font-size="11">'+esc(m.slice(5))+'</text>').join('')+'</svg><details><summary>View exact monthly figures</summary><table class="txTable"><thead><tr><th>Month</th><th>Income</th><th>Spending</th></tr></thead><tbody>'+months.map((m,i)=>'<tr><td>'+m+'</td><td>'+money(income[i])+'</td><td>'+money(expenses[i])+'</td></tr>').join('')+'</tbody></table></details><p class="meta">Recorded transactions, excluding transfers. Refunds are not income.</p></section>'+
   '<section class="premiumPanel premiumWallet"><div class="smartHeading"><h3>Your cards</h3>'+action('accounts','View all ↗')+'</div><div class="premiumCards">'+(cards.slice(0,2).map((a,i)=>{const m=cardMetrics(a),limit=Math.max(0,Number(m.total||0)+Number(m.available||0)),pct=limit?Math.min(100,Math.max(0,Number(m.total)/limit*100)):0;return '<article class="realCard cardVariant'+i+'"><div class="cardBrand">'+esc(a.bank)+'<span>◔</span></div><div class="cardChip" aria-hidden="true"></div><div class="cardNumber">••••　••••　••••　'+esc(a.ending||'')+'</div><div class="cardBottom"><span>'+esc(a.name)+'</span><b>'+money(Math.max(0,Number(m.available||0)))+'<small>Available credit</small></b></div><div class="cardMeter"><i style="width:'+pct+'%"></i></div></article>';}).join('')||'<p class="meta">Add a card to see its live balance and available credit here.</p>')+'</div></section>'+
   '<section class="premiumPanel premiumReview"><span class="premiumIcon">✦</span><div><span class="smartEyebrow">YOUR NEXT SMALL STEP</span><h3>'+dues.length+' monthly dues to review</h3><p>Recognise regular bills. Plan the month. Keep control.</p></div>'+action('incomeplan','Review monthly plan →','primary')+'</section>'+
   '<section class="premiumPanel premiumSpending"><div class="smartHeading"><h3>Where it goes</h3><span class="smartPill">'+esc(month)+'</span></div><div class="premiumRing" style="--ring:conic-gradient('+(stops||'#303344 0% 100%')+')"><div><small>Recorded spending</small><b>'+money(spend)+'</b></div></div><div class="premiumCategoryList">'+top.map((r,i)=>'<div><span><i style="background:'+colors[i]+'"></i>'+esc(r[0])+'</span><b>'+money(r[1])+'</b></div>').join('')+'</div></section>'+
   '<section class="premiumPanel premiumDues"><div class="smartHeading"><h3>Coming up</h3>'+action('incomeplan','View plan ↗')+'</div><div class="premiumDueTotal"><small>Next '+dueList.length+' scheduled payments</small><b>'+money(dueTotal)+'</b></div>'+ (dueList.map(p=>'<div class="premiumDueRow"><span class="premiumDate"><b>'+p.date.getDate()+'</b>'+p.date.toLocaleDateString('en-GB',{month:'short'})+'</span><span><b>'+esc(p.label)+'</b><small>'+esc(p.kind)+'</small></span><strong>'+money(p.amount)+'</strong></div>').join('')||'<p class="meta">Your scheduled payments will appear here.</p>')+'</section>'+
   '<section class="premiumPanel premiumActivity"><div class="smartHeading"><h3>Recent activity</h3>'+action('transactions','View all ↗')+'</div>'+rows.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,5).map((r,i)=>'<div class="premiumActivityRow"><span class="premiumActivityIcon">'+(r.amount<0?'↗':'↙')+'</span><span><b>'+esc(r.description)+'</b><small>'+esc(r.date)+' · '+esc(r.category||'Other')+'</small></span><strong>'+signed(r.amount)+'</strong></div>').join('')+'</section></div>';
  host.querySelectorAll('[data-premium-go]').forEach(b=>b.onclick=()=>nav(b.dataset.premiumGo));
 };
 const dashboard=renderDashboard;renderDashboard=function(){const r=dashboard.apply(this,arguments);window.financeRenderPremium();return r;};
 const original=renderExecutiveDashboard;renderExecutiveDashboard=function(){const r=original.apply(this,arguments);window.financeRenderPremium();return r;};
})();
