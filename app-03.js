
/* V283 single-source application shell */
function navIcon(name){
 var paths={
  dashboard:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  transactions:'<path d="M7 7h11l-3-3"/><path d="M17 17H6l3 3"/><path d="M18 7l-3 3"/><path d="M6 17l3-3"/>',
  outgoings:'<path d="M5 19L19 5"/><path d="M10 5h9v9"/>',
  installments:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><circle cx="12" cy="15" r="2"/><path d="M12 13v2l1 1"/>',
  import:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 11v7M9 15l3 3 3-3"/>',
  investments:'<path d="M3 20h18"/><path d="M5 16l5-5 4 3 6-8"/><path d="M15 6h5v5"/>',
  assets:'<path d="M12 3l8 6-8 12L4 9z"/><path d="M4 9h16M9 9l3 12 3-12"/>',
  rental:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/><circle cx="17" cy="14" r="1"/>',
  reports:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V3h4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1H21v4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  more:'<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  cash:'<rect x="2" y="6" width="20" height="14" rx="2"/><path d="M16 12h6"/><circle cx="16" cy="13" r="1"/><path d="M5 6V4h13v2"/>',
  position:'<path d="M12 3v18M5 7h14"/><path d="M5 7l-3 6h6zM19 7l-3 6h6z"/><path d="M7 21h10"/>',
  strategy:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/><path d="M15 9l6-6M17 3h4v4"/>'
 };
 return '<svg class="navSvg" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+paths[name]+'</svg>';
}
function shellButton(page,icon,label){return '<button data-page-jump="'+page+'">'+navIcon(icon)+'<span>'+label+'</span></button>'}
function canonicalTopHTML(){
 function menu(label,icon,mainPage,items){return '<div class="canonicalMenu" data-nav-menu><button class="canonicalMenuTrigger" type="button" data-main-page="'+mainPage+'" aria-expanded="false">'+navIcon(icon)+'<span>'+label+'</span><span class="navChevron">⌄</span></button><div class="canonicalDropdown">'+items.map(x=>shellButton(x[0],x[1],x[2])).join('')+'</div></div>'}
 return '<div class="canonicalBrand"><span class="canonicalMark">'+navIcon('investments')+'</span><div><b>My Finance</b><small>Control Today • Plan Tomorrow</small></div></div><nav class="canonicalTopNav">'
 +menu('Dashboard','dashboard','executive',[['executive','dashboard','Executive Overview'],['accounts','cash','Cash & Credit'],['financialposition','position','Financial Position'],['strategy','strategy','Financial Strategy']])
 +menu('Transactions','transactions','transactions',[['transactions','transactions','Transactions'],['incomeplan','cash','Monthly Income & Payment Plan'],['outgoings','outgoings','Cash & Other Outgoings'],['installments','installments','Installments']])
 +shellButton('investments','investments','Investments')
 +shellButton('assets','assets','Personal Assets')
 +shellButton('rental','rental','Airbnb / Rental')
 +shellButton('reports','reports','Reports')
 +menu('Settings','settings','financeSettings',[['financeSettings','settings','Settings'],['bankconnections','cash','Bank Connections'],['importstatements','import','Import Statements'],['more','more','More']])
 +'</nav><div class="canonicalDate" id="canonicalDate"></div><div class="canonicalProfile" data-profile-menu><button class="canonicalAvatar" type="button" aria-label="Open profile menu" aria-expanded="false"><span>HA</span><span class="profileChevron">⌄</span></button><div class="canonicalProfileMenu"><div class="profileIdentity"><b>HA</b><span>My Finance profile</span></div><button type="button" data-profile-action="account"><span>Account</span></button><button type="button" data-profile-action="preferences"><span>Preferences</span></button><button type="button" data-profile-action="signout"><span>Sign out</span></button></div></div>';
}
function closeCanonicalMobileSheet(top){
 var sheet=document.getElementById('canonicalMobileNavSheet');if(sheet)sheet.remove();
 (top||document).querySelectorAll('[data-nav-menu]').forEach(m=>{
  m.classList.remove('open','mobile-sheet-open');
  var trigger=m.querySelector('.canonicalMenuTrigger');if(trigger)trigger.setAttribute('aria-expanded','false');
 });
}
function openCanonicalMobileSheet(top,m,b){
 var key=b.dataset.mainPage||'menu',existing=document.getElementById('canonicalMobileNavSheet');
 if(existing&&existing.dataset.owner===key){closeCanonicalMobileSheet(top);return;}
 closeCanonicalMobileSheet(top);
 m.classList.add('mobile-sheet-open');b.setAttribute('aria-expanded','true');
 var source=m.querySelector('.canonicalDropdown'),label=b.querySelector('span:not(.navChevron)')?.textContent||'Menu';
 var sheet=document.createElement('section');
 sheet.id='canonicalMobileNavSheet';sheet.className='canonicalMobileNavSheet';sheet.dataset.owner=key;
 sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','false');sheet.setAttribute('aria-label',label+' navigation');
 sheet.innerHTML='<div class="canonicalMobileSheetHead"><b>'+label+'</b><button type="button" aria-label="Close menu">×</button></div><div class="canonicalMobileSheetList"></div>';
 var list=sheet.querySelector('.canonicalMobileSheetList');
 source.querySelectorAll('[data-page-jump]').forEach(item=>{
  var copy=item.cloneNode(true);
  copy.onclick=(e)=>{e.preventDefault();e.stopPropagation();var page=copy.dataset.pageJump;closeCanonicalMobileSheet(top);if(page)nav(page);};
  list.appendChild(copy);
 });
 sheet.querySelector('.canonicalMobileSheetHead button').onclick=(e)=>{e.preventDefault();e.stopPropagation();closeCanonicalMobileSheet(top);};
 sheet.onclick=e=>e.stopPropagation();
 document.body.appendChild(sheet);
 requestAnimationFrame(()=>sheet.classList.add('visible'));
}
function ensureCanonicalShell(){
 var app=document.querySelector('body>.app'),main=app?.querySelector(':scope>.main');if(!app||!main)return;
 closeCanonicalMobileSheet();
 app.querySelectorAll('.sidebar,.unifiedSide,#canonicalAppSide').forEach(x=>x.remove());
 main.querySelectorAll('.topbar').forEach(x=>x.remove());
 var content=main.querySelector(':scope>.content');if(!content)return;
 content.querySelectorAll('.modernModuleTop').forEach(x=>x.remove());
 var top=document.getElementById('canonicalAppTop');
 if(!top){top=document.createElement('header');top.id='canonicalAppTop';top.className='canonicalAppTop';app.insertBefore(top,main);}
 top.innerHTML=canonicalTopHTML();
 top.querySelectorAll('[data-page-jump]').forEach(b=>b.onclick=(e)=>{e.stopPropagation();closeCanonicalMobileSheet(top);top.querySelectorAll('[data-nav-menu]').forEach(m=>m.classList.remove('open'));nav(b.dataset.pageJump)});
 top.querySelectorAll('.canonicalMenuTrigger').forEach(b=>{
  var m=b.closest('[data-nav-menu]');
  b.onmouseenter=()=>{if(window.matchMedia('(max-width:900px)').matches)return;top.querySelectorAll('[data-nav-menu]').forEach(x=>{if(x!==m)x.classList.remove('open')});m.classList.add('open');b.setAttribute('aria-expanded','true')};
  b.onclick=(e)=>{
   e.preventDefault();e.stopPropagation();
   if(window.matchMedia('(max-width:900px)').matches){openCanonicalMobileSheet(top,m,b);return;}
   var target=b.dataset.mainPage;if(target)nav(target);
  };
 });
 top.querySelectorAll('[data-nav-menu]').forEach(m=>{m.onmouseleave=()=>{if(window.matchMedia('(max-width:900px)').matches)return;m.classList.remove('open');var b=m.querySelector('.canonicalMenuTrigger');if(b)b.setAttribute('aria-expanded','false')}});
 var profile=top.querySelector('[data-profile-menu]'),avatar=profile?.querySelector('.canonicalAvatar');
 if(avatar)avatar.onclick=(e)=>{e.preventDefault();e.stopPropagation();closeCanonicalMobileSheet(top);var open=profile.classList.toggle('open');avatar.setAttribute('aria-expanded',open?'true':'false')};
 top.querySelectorAll('[data-profile-action]').forEach(b=>b.onclick=(e)=>{e.stopPropagation();var a=b.dataset.profileAction;if(a==='preferences')nav('preferences');else if(a==='account')nav('accountprofile');else if(a==='signout'){profile.classList.remove('open');avatar?.setAttribute('aria-expanded','false');if(typeof financeSignOutCurrentDevice==='function')financeSignOutCurrentDevice();else alert('Secure sign out is still loading. Please try again in a moment.')}});
 if(!window.__canonicalMenuOutside){window.__canonicalMenuOutside=true;document.addEventListener('click',(e)=>{if(e.target.closest('#canonicalMobileNavSheet,.canonicalMenuTrigger'))return;closeCanonicalMobileSheet(document.getElementById('canonicalAppTop'));document.querySelectorAll('[data-nav-menu]').forEach(m=>m.classList.remove('open'))});window.addEventListener('resize',()=>closeCanonicalMobileSheet(document.getElementById('canonicalAppTop')));}
}
function syncCanonicalShell(page){
 ensureCanonicalShell();
 var locked=document.body.classList.contains('financeAccessLocked');
 var shellAvatar=document.querySelector('#canonicalAppTop .canonicalAvatar');
 var shellProfile=document.querySelector('#canonicalAppTop [data-profile-menu]');
 if(shellAvatar){
  shellAvatar.disabled=locked;
  shellAvatar.setAttribute('aria-disabled',locked?'true':'false');
  shellAvatar.title=locked?'Profile is available after sign in':'Open profile menu';
 }
 if(shellProfile&&locked){shellProfile.classList.remove('open');shellAvatar?.setAttribute('aria-expanded','false');}
 var date=document.getElementById('canonicalDate');if(date){date.innerHTML='<span>'+new Date().toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short',year:'numeric'})+'</span><small class="canonicalVersion">v3.02</small>';}
 document.querySelectorAll('.execVer,.cashVer,.txExecVer,.strategySideVer').forEach(el=>el.textContent='v3.02');
 document.querySelectorAll('#canonicalAppTop [data-page-jump]').forEach(b=>b.classList.toggle('active',b.dataset.pageJump===page));
 var groups={Dashboard:['executive','accounts','financialposition','strategy'],Transactions:['transactions','incomeplan','outgoings','installments'],Settings:['financeSettings','bankconnections','importstatements','more']};
 document.querySelectorAll('#canonicalAppTop [data-nav-menu]').forEach(m=>{var label=m.querySelector('.canonicalMenuTrigger span')?.textContent||'';m.classList.toggle('active',groups[label]?.includes(page)||false)});
}

function rebuildTransactions(){
 // V155: embedded BASE transactions never enter the live finance database.
 transactions=[
  ...importedTransactions.map((t,i)=>({...t,manual:false,imported:true,_id:t._id||('import'+i)})),
  ...manualTransactions.map((t,i)=>({...t,manual:true,_id:t._id||('manual'+i)}))
 ];
}
let transactions=[];let resetCardIds=new Set(JSON.parse(localStorage.getItem('pf_reset_card_ids')||'[]'));
let cardResetHistory=JSON.parse(localStorage.getItem('pf_card_reset_history')||'[]')||[];

rebuildTransactions();
const accounts=BASE.accounts;
let customCreditCards=JSON.parse(localStorage.getItem('pf_custom_credit_cards')||'[]');
if(!Array.isArray(customCreditCards))customCreditCards=[];
customCreditCards.forEach(c=>{if(!c?.id)return;const i=accounts.findIndex(a=>a.id===c.id);if(i>=0)accounts[i]=c;else accounts.push(c)});
normalizeCardPaymentPlan();
removeUnbackedOfficialStatementRows();
if(resetCardIds.has('meem-7102')){
 cardPaymentPlan=cardPaymentPlan.filter(p=>p.id!=='p-meem-sep');
 // Startup-safe persistence only. Do NOT call saveCardPaymentPlan()/saveLocal here:
 // later state variables (duplicateDecisions, statementRule, transactionActions, etc.)
 // have not been initialized yet.
 localStorage.setItem('pf_card_payment_plan',JSON.stringify(cardPaymentPlan));
}

if(!accounts.some(a=>a.id==='cash-wallet')){
 accounts.push({
  id:'cash-wallet',
  bank:'Cash',
  name:'Cash / Wallet',
  ending:'',
  type:'bank',
  balance:0,
  balanceLabel:'Cash Balance',
  extra:{},
  logo:null
 });
}
window.__financeAccountsReady=true;
let transactionActions=JSON.parse(localStorage.getItem('pf_transaction_actions')||'{}');
let bankBalanceOverrides=JSON.parse(localStorage.getItem('pf_bank_balance_overrides')||'{}')||{};

let duplicateDecisions=JSON.parse(localStorage.getItem('pf_duplicate_decisions')||'{}');
let statementRule=JSON.parse(localStorage.getItem('pf_statement_rule')||'{"cutoffDay":24}');
let reportDrill={type:'',value:''};
let selectedCategory=Object.keys(categories)[0]||'';
let editingTxId=null, simpleMode=null;
window.__financeStateInitialized=true;
repairStatementMonthOverrides();
purgeAr0955JulyTestStatement();
startCloudAutoSyncWatchers();

// V103 startup-order fix:
// normalizedTx() needs statementRule + transactionActions, so the date-driven
// meem planner rebuild must happen only after the complete finance state exists.
rebuildResetCardPlannerRows('meem-7102');
ensureLedgerBackedPlannerRows();
rebuildAllPlannerPaymentsFromLedger();



function updateDbStatus(ok,savedAt=''){
 const el=$('dbStatus');if(!el)return;
 el.innerHTML=`<span class="dbDot" style="${ok?'':'background:#d43b4f'}"></span>${ok?'Database active':'Database unavailable'}${savedAt?` • Last saved ${new Date(savedAt).toLocaleString()}`:''}`;
}

function saveLocal(){
 if(window.__financeStateInitialized!==true){
  try{
   localStorage.setItem('pf_finance_settings',JSON.stringify(financeSettings));
 localStorage.setItem('pf_categories',JSON.stringify(categories));
   localStorage.setItem('pf_installments',JSON.stringify(installments));
   localStorage.setItem('pf_merchant_rules',JSON.stringify(merchantRules));
   localStorage.setItem('pf_tx_overrides',JSON.stringify(txOverrides));
   localStorage.setItem('pf_income_plan',JSON.stringify(incomePlan));
   localStorage.setItem('pf_manual_transactions',JSON.stringify(manualTransactions));
   localStorage.setItem('pf_imported_transactions',JSON.stringify(importedTransactions));
   localStorage.setItem('pf_import_history',JSON.stringify(importHistory));
   localStorage.setItem('pf_card_payment_plan',JSON.stringify(cardPaymentPlan));
   localStorage.setItem('pf_cash_flow_ledger',JSON.stringify(cashFlowLedger));
   localStorage.setItem('pf_outgoings',JSON.stringify(outgoings));
   localStorage.setItem('pf_duplicate_decisions',JSON.stringify(duplicateDecisions));
   localStorage.setItem('pf_statement_rule',JSON.stringify(statementRule));
   localStorage.setItem('pf_transaction_actions',JSON.stringify(transactionActions));
   localStorage.setItem('pf_bank_balance_overrides',JSON.stringify(bankBalanceOverrides));
  }catch(_){}
  return;
 }
 localStorage.setItem('pf_finance_settings',JSON.stringify(financeSettings));
 localStorage.setItem('pf_categories',JSON.stringify(categories));
 localStorage.setItem('pf_installments',JSON.stringify(installments));
 localStorage.setItem('pf_merchant_rules',JSON.stringify(merchantRules));
 localStorage.setItem('pf_tx_overrides',JSON.stringify(txOverrides));
 localStorage.setItem('pf_income_plan',JSON.stringify(incomePlan));
 localStorage.setItem('pf_manual_transactions',JSON.stringify(manualTransactions));
 localStorage.setItem('pf_imported_transactions',JSON.stringify(importedTransactions));
 localStorage.setItem('pf_import_history',JSON.stringify(importHistory));localStorage.setItem('pf_card_payment_plan',JSON.stringify(cardPaymentPlan));
 localStorage.setItem('pf_cash_flow_ledger',JSON.stringify(cashFlowLedger));
 localStorage.setItem('pf_outgoings',JSON.stringify(outgoings));
 localStorage.setItem('pf_duplicate_decisions',JSON.stringify(duplicateDecisions));
 localStorage.setItem('pf_statement_rule',JSON.stringify(statementRule));
 localStorage.setItem('pf_transaction_actions',JSON.stringify(transactionActions));
 localStorage.setItem('pf_bank_balance_overrides',JSON.stringify(bankBalanceOverrides));
 const localSavedAt=new Date().toISOString();
 setCloudMeta({pending:true,lastLocalSavedAt:localSavedAt});
 financeDB.save();
 scheduleCloudAutoSave();
}
function money(n){return 'SAR '+MONEY.format(Math.abs(Number(n||0)));}
function signed(n){return (n<0?'-':n>0?'+':'')+money(n);}
function account(id){return accounts.find(a=>a.id===id)}
function isCreditCardAccountId(id){
 const a=account(id);
 return !!(a && a.type==='card');
}
function purgeNonCardPaymentPlannerRows(){
 const before=cardPaymentPlan.length;
 cardPaymentPlan=cardPaymentPlan.filter(p=>isCreditCardAccountId(p.accountId));
 if(cardPaymentPlan.length!==before){
  try{localStorage.setItem('pf_card_payment_plan',JSON.stringify(cardPaymentPlan));}catch(e){}
 }
 return before-cardPaymentPlan.length;
}

function accountPhysicalCards(accountId){
 const a=account(accountId); if(!a||a.type!=='card')return [];
 const configured=Array.isArray(a.extra?.['Physical Cards'])?a.extra['Physical Cards'].map(x=>String(x).replace(/\D/g,'')).filter(Boolean):[];
 const primary=String(a.ending||'').replace(/\D/g,'');
 return [...new Set([primary,...configured].filter(Boolean))];
}
function physicalCardRole(accountId,ending){
 const a=account(accountId); return a&&String(ending||'')===String(a.ending||'')?'Primary':'Supplementary';
}
function transactionPhysicalCardEnding(t){
 if(!t)return '';
 const explicit=String(t.physicalCardEnding||'').replace(/\D/g,'');
 if(explicit)return explicit;
 const a=account(t.account); return a?.type==='card'?String(a.ending||''):'';
}
function physicalCardLabelFor(accountId,ending){
 const e=String(ending||'').replace(/\D/g,''); if(!e)return 'Unassigned';
 return `${physicalCardRole(accountId,e)} •${e}`;
}
function allPhysicalCardOptions(){
 const out=[];
 accounts.filter(a=>a.type==='card').forEach(a=>accountPhysicalCards(a.id).forEach(ending=>out.push({accountId:a.id,ending,label:`${a.bank} • ${physicalCardLabelFor(a.id,ending)}`})));
 return out;
}
function fillPhysicalCardSelect(sel,accountId,includeAll=false,keepValue=''){
 if(!sel)return; const cards=accountPhysicalCards(accountId);
 sel.innerHTML=(includeAll?'<option value="">All Physical Cards</option>':'')+cards.map(e=>`<option value="${e}">${physicalCardLabelFor(accountId,e)}</option>`).join('');
 const wanted=String(keepValue||'').replace(/\D/g,'');
 if(wanted&&cards.includes(wanted))sel.value=wanted; else if(!includeAll&&cards.length)sel.value=cards[0];
}
function fillGlobalPhysicalCardFilter(sel,includeAll=true){
 if(!sel)return; const keep=sel.value,options=allPhysicalCardOptions();
 sel.innerHTML=(includeAll?'<option value="">All Physical Cards</option>':'')+options.map(o=>`<option value="${o.accountId}|${o.ending}">${escapeHtml(o.label)}</option>`).join('');
 if(options.some(o=>`${o.accountId}|${o.ending}`===keep))sel.value=keep;
}
function txMatchesPhysicalCardFilter(t,filterValue){
 if(!filterValue)return true; const [accountId,ending]=String(filterValue).split('|');
 return t.account===accountId&&transactionPhysicalCardEnding(t)===ending;
}
function detectPhysicalCardEndingFromRaw(raw,accountId){
 if(!raw||!accountId)return ''; const low={};Object.keys(raw||{}).forEach(k=>low[String(k).toLowerCase().trim()]=raw[k]);
 const keys=['physical card','physical card ending','card number','card no','card no.','masked card number','supplementary card','supplementary card number','card ending','card last 4','last 4'];
 let text=''; for(const k of keys){if(k in low&&low[k]!=null&&low[k]!==''){text=String(low[k]);break;}}
 const digits=text.replace(/\D/g,''); if(digits.length<4)return ''; const ending=digits.slice(-4);
 return accountPhysicalCards(accountId).includes(ending)?ending:'';
}

function accountName(id){
 if(id==='cash-outgoing')return 'Cash / Other Outgoing';
 const a=account(id);
 if(!a)return 'Unknown';
 return `${a.bank} • ${a.name}${a.ending?` •${a.ending}`:''}`;
}

function liveCardTransactions(includeInactive=false){
 const rows=[
  ...importedTransactions.map((t,i)=>({...t,manual:false,imported:true,_id:t._id||('import'+i)})),
  ...manualTransactions.map((t,i)=>({...t,manual:true,_id:t._id||('manual'+i)}))
 ];
 return rows.map(t=>{
  let out={...t};
  // A stored paymentMonth from statement import is authoritative for the imported row.
  out.paymentMonth=out.paymentMonth||paymentMonthForTransaction(out.account,out.date);
  out.statementMonth=out.statementMonth||out.paymentMonth||statementMonthByRule(out.date,statementRule.cutoffDay);
  if(txOverrides[t._id])Object.assign(out,txOverrides[t._id]);
  const ruleKeys=Object.keys(merchantRules).sort((a,b)=>b.length-a.length);
  const rk=ruleKeys.find(k=>String(out.description||'').toLowerCase().includes(k.toLowerCase()));
  if(rk && !txOverrides[t._id])Object.assign(out,merchantRules[rk]);
  out.txAction=transactionActions[t._id]||null;
  return out;
 }).filter(t=>includeInactive||!t.txAction||!['excluded-duplicate','deleted'].includes(t.txAction.status));
}

function normalizedTx(includeInactive=false){
 return transactions.map(t=>{
   let out={...t};
   out.statementMonth=out.statementMonth||statementMonthByRule(out.date,statementRule.cutoffDay);
   if(txOverrides[t._id]) Object.assign(out,txOverrides[t._id]);
   out.statementMonth=out.statementMonth||statementMonthByRule(out.date,statementRule.cutoffDay);
   const ruleKeys=Object.keys(merchantRules).sort((a,b)=>b.length-a.length);
   const rk=ruleKeys.find(k=>out.description.toLowerCase().includes(k.toLowerCase()));
   if(rk && !txOverrides[t._id]) Object.assign(out,merchantRules[rk]);
   out.txAction=transactionActions[t._id]||null;
   return out;
 }).filter(t=>includeInactive||!t.txAction||!['excluded-duplicate','deleted'].includes(t.txAction.status));
}
function isTransfer(t){
 // Explicit transaction type always wins.
 // A manual Expense / Purchase must remain spending even if the user categorizes it
 // under Financial Obligations → Credit Card Payments.
 if(t?.kind)return t.kind==='transfer';

 // Legacy/imported rows without an explicit kind may still be recognized by category.
 return t?.category==='Financial Obligations'&&t?.subcategory==='Credit Card Payments';
}
function isSpend(t){
 return Number(t?.amount||0)<0 &&
  !['transfer','fee','obligation','income'].includes(String(t?.kind||'')) &&
  !isTransfer(t);
}
function txType(t){
 if(isTransfer(t))return'transfer';
 if(t?.kind==='income'||Number(t?.amount||0)>0&&!isTransfer(t))return'income';
 if(t?.kind==='fee')return'fee';
 if(t?.kind==='obligation')return'obligation';
 return'spend';
}
function cardCurrentBalance(a){
 if(a.type==='card' && a.balance!==null && a.balance!==undefined)return Number(a.balance||0);
 if(a.type==='card')return Number(a.periodEstimatedBalance||0);
 return Number(a.balance||0);
}
function planMonthly(p){
 // Use normal currency rounding for the recurring amount and place only the
 // unavoidable rounding remainder in the final installment.
 const base=Math.round((p.fullAmount/p.months)*100)/100;
 const arr=Array(p.months).fill(base);
 arr[arr.length-1]=Math.round((p.fullAmount-base*(p.months-1))*100)/100;
 return arr;
}
function monthIndex(ym){
 const [y,m]=String(ym||'').split('-').map(Number);
 return Number.isFinite(y)&&Number.isFinite(m)?y*12+(m-1):null;
}
function currentYearMonth(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}
function elapsedMonths(fromMonth,toMonth=currentYearMonth()){
 const a=monthIndex(fromMonth),b=monthIndex(toMonth);return a===null||b===null?0:Math.max(0,b-a);
}
function installmentReferenceMonth(p){return p.referenceMonth||'2026-08';}
function installmentPaidThroughReleasedStatement(p){
 if(!p||p.completedConfirmed)return 0;
 const ref=installmentReferenceMonth(p);
 const start=monthIndex(ref);
 if(start===null)return 0;
 let paidThrough=0;
 for(let i=0;i<Math.max(0,Number(p.months||0));i++){
  const idx=start+i, y=Math.floor(idx/12), m=(idx%12)+1;
  const ym=`${y}-${String(m).padStart(2,'0')}`;
  // An installment leaves the future reserve as soon as its card statement is
  // genuinely released. Paying that statement is a separate event which later
  // restores available credit; it must not control the installment schedule.
  if(cardCycleHasStatement(p.cardId,ym)) paidThrough=i+1;
  else break;
 }
 return paidThrough;
}
function reduceRemainingPrincipalByReleasedStatements(remaining,remainingCount,releasedCount){
 let rem=Math.max(0,Math.round(Number(remaining||0)*100)/100);
 let count=Math.max(0,Number(remainingCount||0));
 const billed=Math.min(count,Math.max(0,Number(releasedCount||0)));
 for(let i=0;i<billed&&count>0;i++){
  const installment=count===1?rem:Math.round((rem/count)*100)/100;
  rem=Math.max(0,Math.round((rem-installment)*100)/100);
  count=Math.max(0,count-1);
 }
 return {remaining:rem,remainingCount:count,billed};
}
function planCalc(p){
 if(p.scheduleMode==='remaining-principal-review'){
  return {schedule:[],paid:Number(p.paidInstallments||0),scheduledPaid:Number(p.paidInstallments||0),basePaid:Number(p.paidInstallments||0),autoElapsed:0,remaining:0,scheduledRemaining:0,monthly:0,remainingCount:0,scheduledRemainingCount:0,status:p.completedConfirmed?'Completed':'Review',completionCandidate:true};
 }
 if(p.scheduleMode==='remaining-principal' || p.remainingMonthsOverride!=null){
  const savedRemaining=Math.max(0,Math.round(Number(p.manualRemaining||0)*100)/100);
  const savedRemainingCount=Math.max(0,Number(p.remainingMonthsOverride||0));
  const releasedStatementPaid=installmentPaidThroughReleasedStatement(p);
  const advanced=reduceRemainingPrincipalByReleasedStatements(savedRemaining,savedRemainingCount,releasedStatementPaid);
  const remaining=advanced.remaining;
  const remainingCount=advanced.remainingCount;
  const paid=Math.max(0,Number(p.paidInstallments||0))+advanced.billed;
  const completed=p.completedConfirmed===true || remaining<=0.005 || remainingCount<=0;
  const status=completed?'Completed':'Active';
  const monthly=completed?0:Math.round((remaining/remainingCount)*100)/100;
  const schedule=remainingCount>0?Array(remainingCount).fill(monthly):[];
  if(schedule.length)schedule[schedule.length-1]=Math.round((remaining-monthly*(remainingCount-1))*100)/100;
  return {schedule,paid,scheduledPaid:paid,basePaid:Number(p.paidInstallments||0),autoElapsed:0,releasedStatementPaid:advanced.billed,remaining:completed?0:remaining,scheduledRemaining:completed?0:remaining,monthly,remainingCount:completed?0:remainingCount,scheduledRemainingCount:completed?0:remainingCount,status,completionCandidate:completed,completionReason:completed?(p.completedConfirmed?'confirmed':'fully-billed'):''};
 }
 const schedule=planMonthly(p);
 const basePaid=Math.min(Math.max(Number(p.paidInstallments||0),0),p.months);
 const autoElapsed=elapsedMonths(installmentReferenceMonth(p));
 const releasedStatementPaid=installmentPaidThroughReleasedStatement(p);
 // Calendar passage alone does NOT advance an installment. A released statement
 // does: that month's installment has moved from future reserve into the released
 // statement balance. Statement payment remains tracked independently.
 const scheduledPaid=Math.min(p.months,Math.max(basePaid,releasedStatementPaid));
 const scheduledRemainingCount=Math.max(p.months-scheduledPaid,0);
 let scheduledRemaining=schedule.slice(scheduledPaid).reduce((sum,v)=>sum+v,0);
 if(p.manualRemaining!==undefined&&p.manualRemaining!==null&&autoElapsed===0)scheduledRemaining=Number(p.manualRemaining);
 scheduledRemaining=Math.max(0,Math.round(scheduledRemaining*100)/100);
 const completionCandidate=(scheduledRemainingCount===0||scheduledRemaining<=0.005);
 const confirmedCompleted=!!p.completedConfirmed;
 const status=(confirmedCompleted||completionCandidate)?'Completed':'Active';
 let calcPaid=scheduledPaid,remaining=scheduledRemaining,remainingCount=scheduledRemainingCount;
 let monthly=status==='Active'?(schedule[Math.min(scheduledPaid,p.months-1)]||0):0;
 if(status==='Completed'){calcPaid=p.months;remainingCount=0;remaining=0;monthly=0;}
 return {schedule,paid:calcPaid,scheduledPaid,basePaid,autoElapsed,releasedStatementPaid,remaining,scheduledRemaining,monthly,remainingCount,scheduledRemainingCount,status,completionCandidate,completionReason:status==='Completed'?(confirmedCompleted?'confirmed':'fully-billed'):''};
}
function reconcileRemainingPrincipalPlans(){
 let changed=false;
 installments.forEach(p=>{
  if(p.scheduleMode!=='remaining-principal' || p.completedConfirmed)return;
  const ref=p.referenceMonth||p.startMonth||currentYearMonth();
  const released=installmentPaidThroughReleasedStatement(p);
  if(released<=0)return;
  const advanced=reduceRemainingPrincipalByReleasedStatements(p.manualRemaining,p.remainingMonthsOverride,released);
  p.manualRemaining=advanced.remaining;
  p.remainingMonthsOverride=advanced.remainingCount;
  p.paidInstallments=Math.max(0,Number(p.paidInstallments||0))+advanced.billed;
  p.referenceMonth=addMonthsToYM(ref,advanced.billed);
  p.statementBilledInstallments=Math.max(0,Number(p.statementBilledInstallments||0))+advanced.billed;
  p.lastStatementBilledAt=new Date().toISOString();
  changed=true;
 });
 if(changed){
  localStorage.setItem('pf_installments',JSON.stringify(installments));
  if(window.__financeStateInitialized===true&&typeof scheduleRecordPush==='function')scheduleRecordPush('installment-statement-release');
 }
}

function activeInstallmentPlans(cardId=null){return installments.filter(p=>(!cardId||p.cardId===cardId)&&['Active','Review'].includes(planCalc(p).status));}
function completedInstallmentPlans(cardId=null){return installments.filter(p=>(!cardId||p.cardId===cardId)&&planCalc(p).status==='Completed');}
function cardInstallmentRemaining(cardId){return activeInstallmentPlans(cardId).reduce((sum,p)=>sum+planCalc(p).remaining,0)}
function linkedActiveInstallment(txId){
 return installments.find(p=>p.linkedTransactionId===txId && !p.completedConfirmed && ['Active','Review'].includes(planCalc(p).status))||null;
}
function isTransactionMovedToInstallment(txId){return !!linkedActiveInstallment(txId)}

function linkedInstallmentPrincipalForCard(cardId){
 return activeInstallmentPlans(cardId)
  .filter(p=>p.linkedTransactionId)
  .reduce((sum,p)=>sum+Math.max(0,Number(planCalc(p).remaining||0)),0);
}
function cardMonthlyCommitment(cardId){return activeInstallmentPlans(cardId).reduce((sum,p)=>sum+planCalc(p).monthly,0)}



function normalizeSabInstallmentPlan(){return false;}
function sabInstallmentPosition(){
 const plans=installments.filter(p=>p.cardId==='sab-440880'&&!p.completedConfirmed);
 let monthly=0,totalPrincipal=0,remainingPrincipal=0,paidPrincipal=0,remainingMonths=0;
 plans.forEach(p=>{const c=planCalc(p);totalPrincipal+=Number(p.fullAmount||0);remainingPrincipal+=Math.max(0,Number(c.remaining||0));remainingMonths+=Math.max(0,Number(c.remainingCount||0));monthly+=Number(c.monthly||0);paidPrincipal+=Math.max(0,Number(p.fullAmount||0)-Number(c.remaining||0));});
 return {monthly:Math.round(monthly*100)/100,totalPrincipal:Math.round(totalPrincipal*100)/100,remainingPrincipal:Math.round(remainingPrincipal*100)/100,paidPrincipal:Math.round(paidPrincipal*100)/100,remainingMonths};
}

function sabManualBalanceAdjustment(){
 // V117: legacy SAB static/manual anchor is retired.
 // Live SAB balance is calculated only from transactions, released statements,
 // active installment commitments/reserves, and credits/payments.
 return 0;
}


function installmentPaidPrincipal(p){
 const schedule=planMonthly(p);
 const c=planCalc(p);
 if(p.completedConfirmed)return Math.round(schedule.reduce((sum,v)=>sum+Number(v||0),0)*100)/100;
 const paidCount=Math.min(Math.max(Number(c.paid||0),0),schedule.length);
 return Math.round(schedule.slice(0,paidCount).reduce((sum,v)=>sum+Number(v||0),0)*100)/100;
}
function cardInstallmentPaidPrincipal(cardId){
 return installments
  .filter(p=>p.cardId===cardId)
  .reduce((sum,p)=>sum+installmentPaidPrincipal(p),0);
}
function cardOriginalActiveInstallmentPrincipal(cardId){
 return installments
  .filter(p=>p.cardId===cardId && !p.completedConfirmed && ['Active','Review'].includes(planCalc(p).status))
  .reduce((sum,p)=>sum+Number(p.fullAmount||0),0);
}
function installmentOriginalPrincipalForCard(cardId){
 // Original principal is the amount that was moved out of normal card usage into installment tracking.
 // Keep completed plans in this baseline until the user deletes them; their current reserve becomes zero.
 return installments.filter(p=>p.cardId===cardId)
  .reduce((sum,p)=>sum+Math.max(0,Number(p.fullAmount||0)),0);
}

function activeManualCardBalanceDelta(cardId){
 // User-entered card transactions after the baseline statement/bank position:
 // negative amount = purchase/fee -> increases utilization
 // positive amount = payment/credit -> decreases utilization / increases available credit
 // Transactions moved into active installments are excluded to avoid double counting.
 return normalizedTx()
  .filter(t=>t.account===cardId && t.manual && !linkedActiveInstallment(t._id))
  .reduce((sum,t)=>sum-Number(t.amount||0),0);
}

function recordedCardPaymentCredit(cardId){
 let credit=0;

 // V228: a payment against an unreleased/current calculated card cycle must
 // immediately restore available credit. Once a genuine statement already nets
 // the payment, or the transaction cycle is no longer live, it is not credited
 // again. Explicit overpayments continue to carry forward separately.
 const liveUsageByMonth={};
 liveUnreleasedTransactionRows(cardId).forEach(t=>{
  const month=assignedTransactionPaymentMonth(cardId,t);
  liveUsageByMonth[month]=Math.round(((liveUsageByMonth[month]||0)+Math.abs(Number(t.amount||0)))*100)/100;
 });
 cardPaymentPlan
  .filter(p=>p.accountId===cardId)
  .forEach(p=>{
   const released=isGenuineReleasedStatementRow(p)||importedOfficialPlannerRow(p.accountId,p.month);
   if(!released){
    const liveUsage=Math.max(0,Number(liveUsageByMonth[p.month]||0));
    // A live cycle can include transaction usage plus installment principal.
    // The full recorded payment restores card limit; do not cap it to only the
    // transaction slice. If the cycle has no live usage, it has already closed
    // and its historical payment must not become a permanent future credit.
    if(liveUsage>0)credit+=Math.max(0,Number(paymentPaidAmount(p)||0));
   }
   (p.paymentHistory||[]).filter(h=>!h.mirrored).forEach(h=>{
    credit+=Math.max(0,Number(h.extraCredit??h.extraPortion??0));
   });
  });

 return Math.round(credit*100)/100;
}

function cardFundedPaymentBreakdown(cardId){
 const activeCycle=cardActiveCycleMonth(cardId);
 const liveRows=liveCardTransactions();

 return allPaymentHistory()
  .filter(h=>h.sourceId===cardId && h.targetCardId!==cardId)
  .map(h=>{
   const amount=Math.max(0,Number(h.amount||0));
   const date=String(h.date||'').slice(0,10);
   const month=paymentMonthForTransaction(cardId,date);
   const isCurrentOrFuture=!!month && month>=activeCycle;
   // V229: a card-funded payment remains utilization on the source card while
   // that source cycle is still open, even when it is a prior unreleased month.
   // A confirmed/released or fully paid source cycle already contains/settles it.
   const sourceCycleStillOpen=!!month && !cardCycleHasStatement(cardId,month) && !cardCycleFullyPaid(cardId,month);

   // If the bank/import/manual feed already contains this outgoing card-funded
   // payment, that transaction already consumes the source card limit.
   const matchedTransaction=liveRows.find(t=>{
    if(t.account!==cardId)return false;
    if(Number(t.amount||0)>=0)return false;
    if(Math.abs(Math.abs(Number(t.amount||0))-amount)>0.01)return false;
    if(String(t.date||'').slice(0,10)!==date)return false;
    const desc=String(t.description||'').toLowerCase();
    return /card payment|credit card payment|payment|transfer/.test(desc);
   })||null;

   return {
    ...h,
    amount,
    effectivePaymentMonth:month,
    currentOrFuture:isCurrentOrFuture,
    matchedTransactionId:matchedTransaction?matchedTransaction._id:'',
    matchedInTransactionFeed:!!matchedTransaction,
    sourceCycleStillOpen,
    countsSeparately:sourceCycleStillOpen && !matchedTransaction
   };
  });
}

function cardFundedPaymentUsage(cardId){
 return Math.round(
  cardFundedPaymentBreakdown(cardId)
   .filter(x=>x.countsSeparately)
   .reduce((sum,h)=>sum+h.amount,0)*100
 )/100;
}

function cardCreditBreakdown(cardId){
 return {
  manualCredits:Math.max(0,activeManualCardCredits(cardId)),
  recordedPaymentCredits:Math.max(0,recordedCardPaymentCredit(cardId)),
  cardFundedPayments:Math.max(0,cardFundedPaymentUsage(cardId))
 };
}

function activeManualCardCredits(cardId){
 return normalizedTx()
  .filter(t=>t.account===cardId && t.manual && Number(t.amount||0)>0)
  .reduce((sum,t)=>sum+Number(t.amount||0),0);
}



function cardCycleHasStatement(cardId,month){
 return cardPaymentPlan.some(p=>
  p.accountId===cardId &&
  p.month===month &&
  (
   (p.statementOfficial===true && officialStatementImportMatches(p)) ||
   p.source==='confirmed' ||
   (p.source==='manual' && p.autoGenerated!==true && p.autoReleasedCycle!==true) ||
   p.userConfirmedStatement===true ||
   p.statementConfirmedByUser===true
  )
 );
}


function isLegacySeedTransaction(t){
 if(!t)return false;
 // Built-in BASE rows have IDs like tx123 and no manual/imported flag.
 // They are retained for historical reference but must not drive a live card
 // balance unless the user explicitly restored/confirmed them through a real
 // manual/imported transaction record.
 return /^tx\d+$/.test(String(t._id||'')) && !t.manual && !t.imported;
}

function isUserLiveTransaction(t){
 if(!t)return false;
 // Only real user-entered or statement-imported activity drives live utilization.
 return t.manual===true || t.imported===true;
}


function isCreditCardPaymentTx(t){
 if(!t)return false;
 const cat=String(t.category||'').toLowerCase();
 const sub=String(t.subcategory||'').toLowerCase();
 const desc=String(t.description||'').toLowerCase();
 return (
  sub.includes('credit card payment') ||
  (cat.includes('financial obligations') && /card payment|credit card|visa|master|sadad bill payment/.test(desc))
 );
}

function matchedCardPaymentLedgerRowForTx(t){
 if(!t || !isCreditCardPaymentTx(t) || Number(t.amount||0)>=0)return null;
 const amt=Math.abs(Number(t.amount||0));
 const date=String(t.date||'').slice(0,10);
 return (cashFlowLedger||[]).find(x=>{
  if(x.type!=='card-payment' || x.status==='reversed')return false;
  if(x.sourceId!==t.account)return false;
  if(Math.abs(Number(x.amount||0)-amt)>0.01)return false;
  if(String(x.date||'').slice(0,10)!==date)return false;
  return true;
 })||null;
}

function linkedPaymentCycleClosedForTx(t){
 const ledger=matchedCardPaymentLedgerRowForTx(t);
 if(!ledger)return false;

 const targetPlan=cardPaymentPlan.find(p=>
  p.accountId===ledger.targetId &&
  (
   (ledger.targetPaymentMonth && p.month===ledger.targetPaymentMonth) ||
   String(ledger.referenceId||'').startsWith(`payment:${p.id}:`)
  )
 );

 if(!targetPlan)return true;
 return paymentRemainingAmount(targetPlan)<=0.005 || targetPlan.paid===true;
}

function cardCycleFullyPaid(cardId,month){
 if(!cardId || !month)return false;

 // V193 PAID-CYCLE CREDIT RELEASE:
 // A planner cycle that has been fully settled must stop consuming card credit
 // even when its historical transaction rows remain visible for audit/history.
 // This is intentionally separate from cardCycleHasStatement(): a user can pay
 // a calculated cycle before an official imported statement exists.
 const rows=cardPaymentPlan
  .filter(p=>p.accountId===cardId && p.month===month && p.upcomingOnly!==true)
  .filter(p=>{
   const due=Number(plannerAmountForRow(p));
   return Number.isFinite(due) && due>0.005;
  })
  .sort((a,b)=>releasedPaymentRowPriority(b)-releasedPaymentRowPriority(a));

 if(!rows.length)return false;
 const canonical=rows[0];
 return paymentRemainingAmount(canonical)<=0.005 || canonical.paid===true;
}

function liveUnreleasedTransactionRows(cardId){
 const activeCycle=cardActiveCycleMonth(cardId);

 return liveCardTransactions().filter(t=>{
  if(t.account!==cardId)return false;

  // V143: all cards use the same rule. Historical built-in BASE rows are
  // reference/history only and cannot consume today's available credit.
  if(isLegacySeedTransaction(t))return false;
  if(!isUserLiveTransaction(t))return false;

  const month=assignedTransactionPaymentMonth(cardId,t);
  if(!month)return false;

  // V193:
  // A cycle leaves live utilization when either:
  //   1) a genuine released/confirmed statement replaces its transaction rows, or
  //   2) the cycle's planner obligation has been fully paid.
  // The second rule is critical when payment happens before an official statement
  // import: history stays visible, but a SAR 0.00 remaining cycle cannot continue
  // reducing Available Credit.
  if(cardCycleHasStatement(cardId,month))return false;
  if(month<activeCycle && cardCycleFullyPaid(cardId,month))return false;

  if(Number(t.amount||0)>=0)return false;
  if(['transfer','income'].includes(txType(t)))return false;
  if(linkedActiveInstallment(t._id))return false;

  const d=String(t.description||'').toLowerCase();
  if(/payment received|advance payment|top[- ]?up|credit card payment|card payment/.test(d))return false;

  return true;
 });
}

function liveUnreleasedTransactionUsage(cardId){
 return Math.round(
  liveUnreleasedTransactionRows(cardId)
   .reduce((sum,t)=>sum+Math.abs(Number(t.amount||0)),0)*100
 )/100;
}

function liveTransactionUsageByMonth(cardId){
 const out={};
 liveUnreleasedTransactionRows(cardId).forEach(t=>{
  const month=assignedTransactionPaymentMonth(cardId,t);
  out[month]=Math.round(((out[month]||0)+Math.abs(Number(t.amount||0)))*100)/100;
 });
 return out;
}

function excelCardAccounting(a){
 const limit=Math.max(0,Number(a.extra?.['Credit Limit']||0));
 if(!limit)return null;

 const activeCycle=cardActiveCycleMonth(a.id);

 // Released/confirmed statement balances remaining to be paid.
 let released=Math.max(0,cardReleasedStatementBalance(a.id));
 if(a.id==='sab-440880'){
  const legacyOnly=canonicalReleasedPaymentRows(a.id).some(p=>
   Math.abs(Number(p.amount||0)-28627.50)<0.01 &&
   p.statementOfficial!==true &&
   p.source==='manual'
  );
  if(legacyOnly)released=0;
 }

 // Current open-cycle breakdown (display / monthly logic).
 const currentTransactions=Math.max(0,
  liveUnreleasedTransactionRows(a.id)
   .filter(t=>assignedTransactionPaymentMonth(a.id,t)===activeCycle)
   .reduce((sum,t)=>sum+Math.abs(Number(t.amount||0)),0)
 );
 const currentInstallment=Math.max(0,installmentAmountForPaymentMonth(a.id,activeCycle));

 // V191: keep prior unreleased cycles visible instead of making the card totals
 // look inconsistent with the selected payment-planner month. Example: if the
 // September cycle is still unreleased and October is already accumulating,
 // Outstanding legitimately contains both. Expose that split explicitly.
 const liveByMonth=liveTransactionUsageByMonth(a.id);
 const priorOpenCycleTransactions=Math.max(0,Object.entries(liveByMonth)
  .filter(([month])=>month && month<activeCycle)
  .reduce((sum,[,amount])=>sum+Number(amount||0),0));
 const futureOpenCycleTransactions=Math.max(0,Object.entries(liveByMonth)
  .filter(([month])=>month && month>activeCycle)
  .reduce((sum,[,amount])=>sum+Number(amount||0),0));

 // All active transaction usage that has NOT yet been replaced by a confirmed
 // statement. This is the key V125 link between Import Statements / manual entry
 // and live card available credit.
 const liveTransactions=Math.max(0,liveUnreleasedTransactionUsage(a.id));

 // Entire remaining installment principal continues to occupy card limit.
 const remainingPrincipal=Math.max(0,activeInstallmentPlans(a.id)
  .reduce((sum,p)=>sum+Math.max(0,Number(planCalc(p).remaining||0)),0));

 // Display-only split: this month's installment vs future reserve.
 const futureReserve=Math.max(0,Math.round((remainingPrincipal-currentInstallment)*100)/100);
 const currentCycle=Math.max(0,Math.round((currentTransactions+currentInstallment)*100)/100);

 // Recorded payments must restore available credit on the target card.
 // Do not double-count payments already reflected in a confirmed statement's
 // remaining balance; recordedCardPaymentCredit() handles that distinction.
 const creditBreakdown=cardCreditBreakdown(a.id);
 const manualCredits=creditBreakdown.manualCredits;
 const recordedPaymentCredits=creditBreakdown.recordedPaymentCredits; // explicit extra/overpayment only
 const totalCredits=Math.max(0,manualCredits+recordedPaymentCredits);

 // If this card funded another card payment, that is utilization on this card
 // only when the source-card transaction feed does not already contain it.
 const fundedOtherCards=Math.max(0,creditBreakdown.cardFundedPayments);

 // V155 AGREED INSTALLMENT ACCOUNTING:
 // Remaining principal is split into Current Cycle Installment + Future Installment Reserve.
 // Outstanding / Utilized includes the FUTURE reserve only.
 // Available Credit deducts the current installment separately.
 const grossOccupied=Math.max(0,released+liveTransactions+futureReserve+fundedOtherCards);
 const occupied=Math.max(0,grossOccupied-totalCredits);
 const overCredit=Math.max(0,totalCredits-grossOccupied);
 const total=occupied;
 const available=Math.max(0,limit-total-currentInstallment)+overCredit;
 const utilization=limit?total/limit*100:0;

 return {
  limit,
  currentBalance:currentCycle,
  remainingInstallments:futureReserve,
  totalObligation:total,
  available,
  bankAvailable:available,
  futureReserved:futureReserve,
  fullRemainingInstallmentPrincipal:remainingPrincipal,
  availableBeforeInstallments:available,
  bankUtilized:total,
  utilization,
  current:currentCycle,
  inst:futureReserve,
  total,
  util:utilization,
  creditBalance:totalCredits+overCredit,
  manualCardCredits:manualCredits,
  recordedPaymentCredits,
  fundedOtherCards,
  totalCardCredits:totalCredits,
  netPosition:total-overCredit,
  anchorCurrent:currentCycle,
  currentCycleTransactions:currentTransactions,
  currentCycleInstallment:currentInstallment,
  currentCycleUsage:currentCycle,
  liveTransactionUsage:liveTransactions,
  liveTransactionUsageByMonth:liveByMonth,
  priorOpenCycleTransactions,
  futureOpenCycleTransactions,
  releasedStatementBalance:released,
  activeCycleMonth:activeCycle,
  currentMonthlyInstallments:currentInstallment,
  nextInstallmentScheduled:currentInstallment,
  excelAccountingModel:true,
  grossOccupied,
  normalNonInstallmentUtilized:Math.max(0,Math.round((total-Math.min(total,remainingPrincipal))*100)/100),
  installmentIncludedInUtilized:Math.min(total,futureReserve),
  releasedIncludedInLiveUtilization:true,
  creditLimitInvariant:Math.abs((available+total+currentInstallment-overCredit)-limit)<0.02
 };
}
function cardMetrics(a){
 const excel=excelCardAccounting(a);
 if(excel)return excel;
 const limit=Number(a.extra?.['Credit Limit']||0);
 return {
  limit,currentBalance:0,remainingInstallments:0,totalObligation:0,
  available:limit,bankAvailable:limit,futureReserved:0,availableBeforeInstallments:limit,
  bankUtilized:0,utilization:0,current:0,inst:0,total:0,util:0,
  creditBalance:0,manualCardCredits:0,recordedPaymentCredits:0,fundedOtherCards:0,totalCardCredits:0,netPosition:0,anchorCurrent:0,currentCycleUsage:0,
  releasedStatementBalance:0,activeCycleMonth:cardActiveCycleMonth(a.id),
  currentMonthlyInstallments:0,nextInstallmentScheduled:0,excelAccountingModel:true
 };
}


function ar5867LegacyAudit(){
 return {
  plannerRows:cardPaymentPlan.filter(p=>p.accountId==='ar-5867').map(p=>({
   id:p.id,month:p.month,amount:Number(p.amount||0),label:p.label||'',
   source:p.source||'',official:p.statementOfficial===true
  })),
  visibleTransactions:normalizedTx().filter(t=>t.account==='ar-5867').map(t=>({
   id:t._id,date:t.date,description:t.description,amount:Number(t.amount||0)
  }))
 };
}

function releasedStatementRowAudit(cardId){
 const activeMonth=cardActiveCycleMonth(cardId);
 return cardPaymentPlan
  .filter(p=>p.accountId===cardId && p.month<activeMonth)
  .map(p=>({
   id:p.id,
   month:p.month,
   due:p.due||'',
   amount:Number(paymentRemainingAmount(p)||0),
   source:p.source||'',
   official:p.statementOfficial===true,
   autoGenerated:p.autoGenerated===true,
   autoReleasedCycle:p.autoReleasedCycle===true,
   genuineReleased:isGenuineReleasedStatementRow(p)
  }));
}


function liveCardBalanceAudit(cardId){
 const a=account(cardId);
 if(!a||a.type!=='card')return null;
 const m=cardMetrics(a);
 return {
  card:accountName(cardId),
  limit:m.limit,
  releasedStatementBalance:m.releasedStatementBalance,
  liveTransactionUsage:m.liveTransactionUsage,
  transactionUsageByMonth:m.liveTransactionUsageByMonth,
  remainingInstallmentPrincipal:m.fullRemainingInstallmentPrincipal,
  cardCredits:m.creditBalance,
  manualCardCredits:m.manualCardCredits,
  recordedPaymentCredits:m.recordedPaymentCredits,
  fundedOtherCards:m.fundedOtherCards,
  utilized:m.total,
  available:m.available,
  activeTransactionCount:liveCardTransactions().filter(t=>t.account===cardId).length
 };
}

function releasedBalanceAudit(){
 return accounts.filter(a=>a.type==='card').map(a=>{
  const m=cardMetrics(a);
  return {
   accountId:a.id,
   account:accountName(a.id),
   activeCycle:m.activeCycleMonth,
   releasedAmount:m.releasedStatementBalance,
   currentCycleTransactions:m.currentCycleTransactions,
   currentCycleInstallment:m.currentCycleInstallment,
   currentCycleAmount:m.currentCycleUsage,
   installmentReserve:m.inst,
   fullRemainingInstallmentPrincipal:m.fullRemainingInstallmentPrincipal,
   cardCredits:m.creditBalance,
   manualCardCredits:m.manualCardCredits,
   recordedPaymentCredits:m.recordedPaymentCredits,
   fundedOtherCards:m.fundedOtherCards,
   totalUtilized:m.total,
   available:m.available,
   rows:cardReleasedStatementBreakdown(a.id)
  };
 });
}

function currentBankBalance(){const a=accounts.find(a=>a.id==='ar-current');return a?adjustedBankBalance(a):0}
function summaryData(rows=normalizedTx()){
 const spend=rows.filter(isSpend).reduce((s,t)=>s+Math.abs(t.amount),0);
 const income=rows.filter(t=>txType(t)==='income').reduce((s,t)=>s+Math.abs(t.amount),0);
 const transfers=rows.filter(t=>txType(t)==='transfer').reduce((s,t)=>s+Math.abs(t.amount),0);
 return {spend,income,net:income-spend,count:rows.length,transfers}
}

const UI_REVIEW_STATE_KEY='pf_ui_review_state_v172';

function activeViewId(){
 const active=document.querySelector('.view.active');
 return active?.id||'dashboard';
}

function captureReviewState(){
 const page=activeViewId();
 const state={
  page,
  x:window.scrollX,
  y:window.scrollY,
  accountDetailId:currentAccountDetailId||'',
  accountDetailReturnPage:accountDetailReturnPage||'accounts',
  accountDetailTxFilter:{...((accountDetailTxFilter&&typeof accountDetailTxFilter==='object')?accountDetailTxFilter:{})},
  selectedTxIds:(typeof selectedTxIds!=='undefined'&&selectedTxIds instanceof Set)?[...selectedTxIds]:[],
  txFilters:{
   search:$('txSearch')?.value||'',
   account:$('txAccount')?.value||'',
   physicalCard:$('txPhysicalCard')?.value||'',
   category:$('txCategory')?.value||'',
   type:$('txType')?.value||'',
   statementMonth:$('txStatementMonth')?.value||''
  },
  reportFilters:{
   from:$('reportFrom')?.value||'',
   to:$('reportTo')?.value||'',
   account:$('reportAccount')?.value||'',
   physicalCard:$('reportPhysicalCard')?.value||'',
   category:$('reportCategory')?.value||'',
   subcategory:$('reportSubcategory')?.value||'',
   type:$('reportType')?.value||''
  },
  capturedAt:Date.now()
 };
 try{sessionStorage.setItem(UI_REVIEW_STATE_KEY,JSON.stringify(state));}catch(_){}
 return state;
}

function restoreReviewControls(state){
 if(!state)return;

 if(state.txFilters){
  if($('txSearch'))$('txSearch').value=state.txFilters.search||'';
  if($('txAccount'))$('txAccount').value=state.txFilters.account||'';
  if($('txPhysicalCard'))$('txPhysicalCard').value=state.txFilters.physicalCard||'';
  if($('txCategory'))$('txCategory').value=state.txFilters.category||'';
  if($('txType'))$('txType').value=state.txFilters.type||'';
  if($('txStatementMonth'))$('txStatementMonth').value=state.txFilters.statementMonth||'';
 }

 if(state.reportFilters){
  if($('reportFrom'))$('reportFrom').value=state.reportFilters.from||'';
  if($('reportTo'))$('reportTo').value=state.reportFilters.to||'';
  if($('reportAccount'))$('reportAccount').value=state.reportFilters.account||'';
  if($('reportPhysicalCard'))$('reportPhysicalCard').value=state.reportFilters.physicalCard||'';
  if($('reportCategory'))$('reportCategory').value=state.reportFilters.category||'';
  if($('reportSubcategory'))$('reportSubcategory').value=state.reportFilters.subcategory||'';
  if($('reportType'))$('reportType').value=state.reportFilters.type||'';
 }

 if(!(selectedTxIds instanceof Set))selectedTxIds=new Set();
 selectedTxIds.clear();
 (state.selectedTxIds||[]).forEach(id=>selectedTxIds.add(id));

 if(state.accountDetailTxFilter){
  accountDetailTxFilter={...accountDetailTxFilter,...state.accountDetailTxFilter};
 }
 if(state.accountDetailId)currentAccountDetailId=state.accountDetailId;
 if(state.accountDetailReturnPage)accountDetailReturnPage=state.accountDetailReturnPage;
}

function restoreReviewPage(state,{restoreScroll=true}={}){
 ensureCanonicalShell();
 if(!state)return;

 restoreReviewControls(state);

 const page=state.page||'dashboard';

 // Restore the view WITHOUT the normal nav() scroll-to-top side effect.
 document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===page));
 document.body.classList.toggle('execMode',page==='executive');
 document.body.classList.toggle('strategyMode',page==='strategy');
 document.body.classList.toggle('txMode',page==='transactions');
 document.body.classList.toggle('accountMode',page==='accounts');
 document.body.classList.toggle('assetsModernMode',page==='assets');
 document.body.classList.toggle('investmentsMode',page==='investments');
 document.body.classList.toggle('cloudMode',page==='cloudSync');
 document.body.classList.toggle('modernMode',['financialposition','reports','installments','importstatements','assets','investments','rental','financeSettings','bankconnections','more','accountDetail','incomeplan','outgoings','categories','paymentDetails','cloudSync'].includes(page));
 if(page==='executive'&&$('execTopDate'))$('execTopDate').textContent=new Date().toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});
 document.querySelectorAll('.navBtn').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
 document.querySelectorAll('[data-modern-page]').forEach(b=>b.classList.toggle('active',b.dataset.modernPage===page));
 if($('modernModuleDate'))$('modernModuleDate').textContent=new Date().toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});

 const titles={
  financialposition:'Financial Position',
  executive:'Executive Dashboard',
  accounts:'Accounts & Cards',
  transactions:'Transactions',
  reports:'Reports',
  installments:'Installment Plans',
  categories:'Categories',
  incomeplan:'Income & Payment Plan',
  outgoings:'Outgoings',
  importstatements:'Import Statements',assets:'Personal Assets',investments:'Investments',rental:'Airbnb / Rental',
  financeSettings:'Finance Settings',
  more:'More',
  accountDetail:'Account Details'
 };
 if($('pageTitle'))$('pageTitle').textContent=titles[page]||'Personal Finance';
 if($('pageSub'))$('pageSub').textContent=page==='reports'?'Interactive filters • Current data':'Current data • '+new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});

 // Re-render only what the active page needs after controls were restored.
 if(page==='transactions')renderTransactions();
 else if(page==='executive')renderExecutiveDashboard();
 else if(page==='strategy')renderFinancialStrategy();
 else if(page==='assets')renderGoldAssets();
 else if(page==='investments')renderInvestments();
 else if(page==='rental')renderRental();else if(page==='accountprofile'){window.renderAccountProfile?.();}else if(page==='preferences'){window.applyFinancePreferences?.();}
 if(page==='financialposition')renderFinancialPosition();
 if(page==='reports')renderReports();
 else if(page==='installments')renderInstallments();
 else if(page==='categories')renderCategories();
 else if(page==='incomeplan')renderIncomePlan();
 else if(page==='outgoings')renderOutgoings();
 else if(page==='importstatements')renderImportPage();
 else if(page==='financeSettings'){financeSettingsEditing=true;renderFinanceSettings(true);}
 if(page==='bankconnections'&&typeof renderBankConnections==='function')renderBankConnections();
 else if(page==='accounts')renderAccounts();
 else if(page==='accountDetail' && state.accountDetailId){
  currentAccountDetailId=state.accountDetailId;
  openAccount(state.accountDetailId,state.accountDetailReturnPage||'accounts');
 }

 if(restoreScroll){
  const x=Number(state.x||0),y=Number(state.y||0);
  requestAnimationFrame(()=>{
   window.scrollTo(x,y);
   setTimeout(()=>window.scrollTo(x,y),25);
  });
 }
}

function loadSavedReviewState(){
 try{
  const raw=sessionStorage.getItem(UI_REVIEW_STATE_KEY);
  return raw?JSON.parse(raw):null;
 }catch(_){return null;}
}

function nav(page){
 syncCanonicalShell(page);
 const previousPage=activeViewId();
 if(previousPage)captureReviewState();

 const wasFinance=document.getElementById('financeSettings')?.classList.contains('active');
 if(wasFinance && page!=='financeSettings'){
  financeSettingsEditing=false;
  if(financeSettingsDirty)scheduleRecordPush('finance-settings-leave');
 }

 document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===page));
 document.body.classList.toggle('execMode',page==='executive');
 document.body.classList.toggle('strategyMode',page==='strategy');
 document.body.classList.toggle('txMode',page==='transactions');
 document.body.classList.toggle('accountMode',page==='accounts');
 document.body.classList.toggle('assetsModernMode',page==='assets');
 document.body.classList.toggle('investmentsMode',page==='investments');
 document.body.classList.toggle('cloudMode',page==='cloudSync');
 document.body.classList.toggle('modernMode',['financialposition','reports','installments','importstatements','assets','investments','rental','financeSettings','more','accountDetail','incomeplan','outgoings','categories','paymentDetails','cloudSync'].includes(page));
 if(page==='executive'&&$('execTopDate'))$('execTopDate').textContent=new Date().toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});
 document.querySelectorAll('.navBtn').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
 document.querySelectorAll('[data-modern-page]').forEach(b=>b.classList.toggle('active',b.dataset.modernPage===page));
 if($('modernModuleDate'))$('modernModuleDate').textContent=new Date().toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});

 const titles={financialposition:'Financial Position',executive:'Executive Dashboard',strategy:'Financial Strategy',accounts:'Accounts & Cards',transactions:'Transactions',reports:'Reports',installments:'Installment Plans',categories:'Categories',incomeplan:'Income & Payment Plan',outgoings:'Outgoings',importstatements:'Import Statements',assets:'Personal Assets',investments:'Investments',rental:'Airbnb / Rental',financeSettings:'Finance Settings',bankconnections:'Bank Connections',more:'More',accountDetail:'Account Details'};
 if($('pageTitle'))$('pageTitle').textContent=titles[page]||'Personal Finance';
 if($('pageSub'))$('pageSub').textContent=page==='reports'?'Interactive filters • Real statement data':'Real statement data • Jul–Aug 2026';

 // Intentional user navigation starts at the top. Realtime restore does NOT use nav().
 window.scrollTo({top:0,behavior:'auto'});

 // Executive preview must render only after the view is active and all saved finance data is loaded.
 if(page==='executive')renderExecutiveDashboard();
 if(page==='strategy')renderFinancialStrategy();
 if(page==='financialposition')renderFinancialPosition();
 if(page==='reports')renderReports();
 if(page==='installments')renderInstallments();
 if(page==='categories')renderCategories();
 if(page==='incomeplan')renderIncomePlan();
 if(page==='outgoings')renderOutgoings();
 if(page==='importstatements')renderImportPage();
 if(page==='assets')renderGoldAssets();
 else if(page==='investments')renderInvestments();
 else if(page==='rental')renderRental();
 if(page==='financeSettings'){financeSettingsEditing=true;renderFinanceSettings(true);}
 if(page==='bankconnections'&&typeof renderBankConnections==='function')renderBankConnections();
 if(page==='accounts')renderAccounts();
 // V263: Transactions must render on every intentional navigation.
 // It was missing from nav(), leaving the old/empty table in the DOM until another action rebuilt it.
 if(page==='transactions')renderTransactions();

 // Persist the destination as soon as the user moves there.
 requestAnimationFrame(()=>captureReviewState());
}



// V96 startup-order fix: this must run only after statementRule, transactionActions,
// accounts, reset-card state, and mobile navigation state have all been initialized.
rebuildResetCardPlannerRows('meem-7102');
ensureReleasedCyclePlannerRows();
purgeLegacySabAnchorRows();
 normalizeReleasedPaymentAliases();

function mobileNavigate(event,page){
 if(event){
  event.preventDefault();
  event.stopPropagation();
 }
 const now=Date.now();
 if(now-lastMobileNavAt<180)return false;
 lastMobileNavAt=now;

 const target=document.getElementById(page);
 if(!target)return false;

 nav(page);

 // Keep the selected bottom-tab visible on narrow screens.
 const btn=document.querySelector(`.navBtn[data-page="${page}"]`);
 if(btn && window.matchMedia('(max-width:760px)').matches){
  try{btn.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'})}catch(_){}
 }
 return false;
}

/* V258: sidebar buttons already call mobileNavigate(). A second desktop
   listener caused two nav()/render passes for every desktop click. */
document.querySelectorAll('[data-page-jump]').forEach(b=>b.addEventListener('click',()=>nav(b.dataset.pageJump==='dashboard'?'executive':b.dataset.pageJump)));
if($('txHeroAdd'))$('txHeroAdd').addEventListener('click',()=>$('addTransaction')?.click());

const mobileNavBar=document.querySelector('.sidebar');
if(mobileNavBar){
 let touchStartX=0,touchStartY=0;
 mobileNavBar.addEventListener('touchstart',e=>{
  const t=e.touches?.[0];
  if(t){touchStartX=t.clientX;touchStartY=t.clientY;}
 },{passive:true});
 mobileNavBar.addEventListener('touchend',e=>{
  if(!window.matchMedia('(max-width:760px)').matches)return;
  const btn=e.target.closest?.('.navBtn');
  if(!btn)return;
  const t=e.changedTouches?.[0];
  if(t && (Math.abs(t.clientX-touchStartX)>12 || Math.abs(t.clientY-touchStartY)>12))return; // actual swipe
  mobileNavigate(e,btn.dataset.page);
 },{passive:false});
}


function kpiHTML(label,value,sub='',cls=''){return `<div class="kpi"><div class="kpiLabel">${label}</div><div class="kpiValue ${cls}">${value}</div><div class="kpiSub">${sub}</div></div>`}

function isEligibleInstallmentTx(t){
 return !!t && ['ar-0955','ar-5867','sab-440880'].includes(t.account) && isSpend(t) && Math.abs(Number(t.amount||0))>1000;
}
function isTxLinkedToInstallment(t){
 return installments.some(p=>p.linkedTransactionId===t._id);
}
function unclearTransactions(){
 return normalizedTx().filter(t=>isSpend(t) && (t.category==='Miscellaneous'||t.subcategory==='Unexpected Expenses'));
}
function eligibleUnplannedInstallments(){
 return normalizedTx().filter(t=>isEligibleInstallmentTx(t)&&!isTxLinkedToInstallment(t));
}
function renderReviewAlerts(){
 const box=$('reviewAlerts'); if(!box)return;
 const unclear=unclearTransactions();
 const eligible=eligibleUnplannedInstallments();
 const dupGroups=possibleDuplicateGroups();
 const known=account('ar-0955');
 let parts=[];
 parts.push(`<div class="reviewAlert good"><div class="alertTitle">✓ Al Rajhi •0955 reconciled</div><div class="alertText">Bank available balance: <b>${money(6807.25)}</b>. Reserved installment balance: <b>${money(8852.17)}</b>. Available Credit: <b>${money(15659.42)}</b>.</div></div>`);
 parts.push(`<div class="reviewAlert info"><div class="alertTitle">Balance reconciliation note</div><div class="alertText">The imported •0955 activity runs from 31 Jul to 27 Aug and contains both purchases and large card payments. By itself, that activity does not establish the opening balance or any bank-side installment principal, so it cannot independently reconcile to ${money(6807.25)}. If a transaction is missing, use <b>Add Transaction</b>; if a purchase was converted by the bank, use <b>Convert to Installment Plan</b>.</div><div class="alertActions"><button class="btn" data-alert-action="addtx">+ Add Transaction</button></div></div>`);
 if(unclear.length){
  const total=unclear.reduce((sum,t)=>sum+Math.abs(t.amount),0);
  parts.push(`<div class="reviewAlert"><div class="alertTitle">⚠ ${unclear.length} transaction${unclear.length===1?'':'s'} need category review</div><div class="alertText">${money(total)} is currently under Miscellaneous / Unexpected Expenses. Review these so future reports are accurate.</div><div class="alertActions"><button class="btn" data-alert-action="unclear">Review Transactions</button></div></div>`);
 }
 if(eligible.length){
  const total=eligible.reduce((sum,t)=>sum+Math.abs(t.amount),0);
  parts.push(`<div class="reviewAlert"><div class="alertTitle">⚠ ${eligible.length} purchase${eligible.length===1?'':'s'} above SAR 1,000 can be reviewed for installments</div><div class="alertText">${money(total)} across Al Rajhi/SAB cards. Nothing is converted automatically—you choose the transaction and number of months.</div><div class="alertActions"><button class="btn primary" data-alert-action="eligible">Review Eligible Purchases</button></div></div>`);
 }
  if(dupGroups.length){
  const manualPairs=dupGroups.filter(g=>g.manualPair).length;
  parts.push(`<div class="reviewAlert danger"><div class="alertTitle">⚠ ${dupGroups.length} possible duplicate pair${dupGroups.length===1?'':'s'}</div><div class="alertText">${manualPairs} pair${manualPairs===1?'':'s'} include a manually entered transaction that may now also exist in an imported statement. Choose which copy to keep, or mark the pair as Not a Duplicate. The excluded copy stays in history and does not count in calculations.</div><div class="alertActions"><button class="btn primary" data-alert-action="duplicates">Review Possible Duplicates</button></div></div>`);
 }
 box.innerHTML=parts.join('');
 box.querySelectorAll('[data-alert-action]').forEach(b=>b.addEventListener('click',()=>{
  const a=b.dataset.alertAction;
  if(a==='addtx')openManualTransaction();
  if(a==='duplicates')showDuplicateReview();
  if(a==='unclear'){nav('transactions');$('txCategory').value='Miscellaneous';renderTransactions();}
  if(a==='eligible'){eligiblePurchasesOnly=true;nav('transactions');$('txSearch').value='';$('txAccount').value='';$('txPhysicalCard').value='';$('txCategory').value='';$('txType').value='';$('txStatementMonth').value='';renderTransactions();window.scrollTo({top:0,behavior:'smooth'});}
 }));
}
function openManualTransaction(prefill={}){
 fillAccountSelect($('manualTxAccount'),true);if(prefill.account)$('manualTxAccount').value=prefill.account;fillPhysicalCardSelect($('manualTxPhysicalCard'),$('manualTxAccount').value,false,prefill.physicalCardEnding||'');
 $('manualTxDate').value=prefill.date||'2026-08-28';
 $('manualTxDesc').value=prefill.description||'';
 $('manualTxType').value=prefill.kind||'expense';
 $('manualTxAmount').value=prefill.amount?Math.abs(prefill.amount):'';
 fillCategorySelect($('manualTxCategory'),false);
 $('manualTxCategory').value=prefill.category||'Miscellaneous';
 if(!$('manualTxCategory').value)$('manualTxCategory').selectedIndex=0;
 fillSubcategorySelect($('manualTxSubcategory'),$('manualTxCategory').value,prefill.subcategory||'Unexpected Expenses');
 $('manualTxInstallment').checked=false;
 updateManualInstallmentEligibility();
 openModal('manualTxModal');
}
function updateManualInstallmentEligibility(){
 const accountId=$('manualTxAccount').value,type=$('manualTxType').value,amount=Number($('manualTxAmount').value||0);
 const ok=['ar-0955','ar-5867','sab-440880','meem-7102'].includes(accountId)&&type==='expense'&&amount>1000;
 $('manualTxInstallment').disabled=!ok;
 if(!ok)$('manualTxInstallment').checked=false;
 $('manualInstallHint').textContent=ok?'Eligible: you can immediately create an installment plan after saving.':'Available for Al Rajhi, SAB and meem credit-card purchases above SAR 1,000.';
}


function monthAdd(ym,offset){
 const [y,m]=String(ym).split('-').map(Number);
 const d=new Date(Date.UTC(y,m-1+offset,1));
 return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
}

function outgoingPaymentRecord(outgoingId,month){
 const o=outgoings.find(x=>x.id===outgoingId);
 return o?.payments?.[month]||null;
}
function outgoingOccurrencePaid(x){
 return !!outgoingPaymentRecord(x.outgoingId,x.month);
}
function outgoingPaymentSourceLabel(p){
 if(!p)return 'Unpaid';
 if(p.sourceId==='cash-source')return 'Monthly Planned Income';
 return accountName(p.sourceId);
}
function outgoingBudgetUsesMonthlyIncome(x){
 const p=outgoingPaymentRecord(x.outgoingId,x.month);
 // Before payment, reserve it from Monthly Planned Income.
 // After payment, only keep that deduction if the chosen source is Monthly Planned Income.
 return !p || p.sourceId==='cash-source';
}

function outgoingPaymentsForMonth(month=currentIncomeMonth()){
 const rows=[];
 outgoings.forEach(o=>{
  const p=o.payments?.[month];
  if(!p)return;
  rows.push({
   outgoingId:o.id,
   description:o.description,
   category:o.category,
   subcategory:o.subcategory,
   amount:Number(p.amount||0),
   sourceId:p.sourceId,
   date:p.date||`${month}-01`,
   month,
   paymentId:p.id,
   generatedTransactionId:p.generatedTransactionId||''
  });
 });
 return rows.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
}
function outgoingPaidFromMonthlyIncomeTotal(month=currentIncomeMonth()){
 return outgoingPaymentsForMonth(month)
  .filter(x=>x.sourceId==='cash-source')
  .reduce((s,x)=>s+Number(x.amount||0),0);
}

function outgoingPaidTotalForMonth(month){
 return allOutgoingOccurrences(36)
  .filter(x=>x.month===month && outgoingOccurrencePaid(x))
  .reduce((s,x)=>s+Number(outgoingPaymentRecord(x.outgoingId,x.month)?.amount||0),0);
}
function outgoingUnpaidTotalForMonth(month){
 return allOutgoingOccurrences(36)
  .filter(x=>x.month===month && !outgoingOccurrencePaid(x))
  .reduce((s,x)=>s+Number(x.amount||0),0);
}

function outgoingOccurrences(o,horizon=120){
 const n=o.forever?Math.max(1,horizon):Math.max(1,Math.min(60,Number(o.months||1)));
 return Array.from({length:n},(_,i)=>{
  const month=monthAdd(o.startMonth,i);
  const payment=o.payments?.[month]||null;
  return {id:`${o.id}-${i+1}`,outgoingId:o.id,month,date:`${month}-01`,description:o.description,amount:Number(o.amount||0),category:o.category,subcategory:o.subcategory,method:o.method||'Cash',occurrence:i+1,total:o.forever?null:n,forever:!!o.forever,notes:o.notes||'',payment,paid:!!payment};
 });
}
function allOutgoingOccurrences(horizon=120){return outgoings.flatMap(o=>outgoingOccurrences(o,horizon))}
function currentPlanMonth(){return currentIncomeMonth()}
function outgoingForMonth(month){
 // Planned/unpaid outgoings reserve Monthly Planned Income.
 // Once paid from a bank/card, that month is funded from that source instead.
 return allOutgoingOccurrences(36)
  .filter(x=>x.month===month && outgoingBudgetUsesMonthlyIncome(x))
  .reduce((s,x)=>s+Number(x.amount||0),0);
}
function outgoingThisMonthTotal(){const ym=currentPlanMonth();return outgoingForMonth(ym)}
function foreverOutgoingMonthlyTotal(){return outgoings.filter(o=>o.forever).reduce((a,o)=>a+Number(o.amount||0),0)}
function openOutgoing(o=null){
 const firstCat=Object.keys(categories)[0]||'Miscellaneous';
 const p=o||{description:'',amount:'',method:'Cash',category:firstCat,subcategory:(categories[firstCat]||[])[0]||'',startMonth:'2026-08',months:1,forever:false,notes:''};
 $('outgoingEditId').value=o?.id||'';$('outgoingModalTitle').textContent=o?'Edit Outgoing':'Add Outgoing';
 $('outgoingDesc').value=p.description||'';$('outgoingAmount').value=p.amount||'';$('outgoingMethod').value=p.method||'Cash';
 fillCategorySelect($('outgoingCategory'),false);$('outgoingCategory').value=p.category||firstCat;
 fillSubcategorySelect($('outgoingSubcategory'),$('outgoingCategory').value,p.subcategory||'');
 $('outgoingStart').value=p.startMonth||'2026-08';
 $('outgoingMonths').innerHTML=Array.from({length:60},(_,i)=>`<option value="${i+1}">${i+1} month${i?'s':''}</option>`).join('');
 $('outgoingMonths').value=String(p.months||1);
 $('outgoingForever').checked=!!p.forever;
 $('outgoingMonths').disabled=!!p.forever;
 $('outgoingNotes').value=p.notes||'';
 openModal('outgoingModal');
}

function outgoingPaymentSourceOptions(){
 return [
  ...accounts.map(a=>({
   id:a.id,
   label:`${a.bank} • ${a.name}${a.ending?` •${a.ending}`:''}${a.type==='card'?' (Credit Card)':' (Bank/Cash Account)'}`
  })),
  {id:'cash-source',label:'Monthly Planned Income / Cash Available'}
 ];
}
function openOutgoingPayment(outgoingId,month){
 const o=outgoings.find(x=>x.id===outgoingId);if(!o)return;
 const existing=outgoingPaymentRecord(outgoingId,month);
 $('outgoingPaymentOutgoingId').value=outgoingId;
 $('outgoingPaymentMonth').value=month;
 $('outgoingPaymentLabel').value=o.description;
 $('outgoingPaymentMonthLabel').value=cardMonthLabel(month);
 $('outgoingPaymentAmount').value=Number(existing?.amount||o.amount||0).toFixed(2);
 $('outgoingPaymentSource').innerHTML=outgoingPaymentSourceOptions().map(x=>`<option value="${x.id}">${x.label}</option>`).join('');
 $('outgoingPaymentSource').value=existing?.sourceId||'cash-source';
 $('outgoingPaymentDate').value=existing?.date||`${month}-01`;
 updateOutgoingPaymentPreview();
 openModal('outgoingPaymentModal');
}
function updateOutgoingPaymentPreview(){
 const sourceId=$('outgoingPaymentSource')?.value||'cash-source';
 const amount=Number($('outgoingPaymentAmount')?.value||0);
 const month=$('outgoingPaymentMonth')?.value||currentIncomeMonth();
 let text='';
 if(sourceId==='cash-source'){
  text=`Paid from Monthly Planned Income. ${money(amount)} remains part of ${cardMonthLabel(month)} Cash / Other Outgoings and is not deducted twice.`;
 }else{
  const a=account(sourceId);
  if(a?.type==='bank'){
   text=`Paid from ${accountName(sourceId)}. Estimated bank balance after payment: ${money(adjustedBankBalance(a)-amount)}. This outgoing will no longer reduce Monthly Planned Income for ${cardMonthLabel(month)}.`;
  }else if(a?.type==='card'){
   const m=cardMetrics(a);
   text=`Paid using ${accountName(sourceId)}. Estimated available credit after payment: ${money(Math.max(0,m.available-amount))}. The card purchase will be added to that card's transactions.`;
  }else{
   text=`Paid from ${accountName(sourceId)}.`;
  }
 }
 $('outgoingPaymentPreview').textContent=text;
}
function refreshAfterOutgoingPayment(){
 rebuildTransactions();
 ensureImportedTransactionPlannerRows(importedAccountId,importedFresh);
 ensureReleasedCyclePlannerRows();
 normalizeReleasedPaymentAliases();
 ensureMonthlyPlannerRows(currentIncomeMonth());
 renderOutgoings();
 renderDashboard();
 renderIncomePlan();
 renderReports();
 renderAccounts();
 renderTransactions();
 renderPaymentPlanner();
 renderInstallments();
 if(document.getElementById('accountDetail')?.classList.contains('active') && currentAccountDetailId){
  openAccount(currentAccountDetailId,accountDetailReturnPage);
 }
}
function recordOutgoingPayment(outgoingId,month,amount,sourceId,date){
 const o=outgoings.find(x=>x.id===outgoingId);if(!o)return false;
 o.payments=o.payments||{};

 // If replacing an existing payment, undo its source effect first.
 if(o.payments[month])undoOutgoingPayment(outgoingId,month,false);

 const paymentId=`outpay-${outgoingId}-${month}-${Date.now()}`;
 const p={id:paymentId,amount:Number(amount),sourceId,date,month,recordedAt:new Date().toISOString()};
 o.payments[month]=p;
 addCashFlowLedgerEntry({
  type:'outgoing-payment',
  date,
  month,
  description:o.description,
  amount:Number(amount),
  sourceId,
  sourceName:sourceId==='cash-source'?'Monthly Planned Income':accountName(sourceId),
  targetId:o.id,
  targetName:o.description,
  deductFromIncome:sourceId==='cash-source',
  referenceId:`outgoing:${o.id}:${month}`,
  referenceType:'outgoing-payment',
  createdAt:p.recordedAt
 });

 const src=sourceId==='cash-source'?null:account(sourceId);
 if(src?.type==='bank'){
  setTrackedBankBalance(src.id,adjustedBankBalance(src)-Number(amount));
 }else if(src?.type==='card'){
  const txId=`outgoing-${paymentId}`;
  const tx={
   _id:txId,
   account:src.id,
   date,
   posting:date,
   description:`Outgoing: ${o.description}`,
   amount:-Math.abs(Number(amount)),
   category:o.category,
   subcategory:o.subcategory,
   kind:'expense',
   currency:'SAR',
   original:null,
   manual:true,
   outgoingPaymentId:paymentId,
   outgoingId,
   outgoingMonth:month,
   notes:`Paid outgoing "${o.description}" from ${accountName(src.id)}`
  };
  manualTransactions.push(tx);
  p.generatedTransactionId=txId;
 }

 saveLocal();
 refreshAfterOutgoingPayment();
 return true;
}
function undoOutgoingPayment(outgoingId,month,refresh=true){
 const o=outgoings.find(x=>x.id===outgoingId);if(!o?.payments?.[month])return false;
 const p=o.payments[month];
 reverseCashFlowLedgerByReference(`outgoing:${outgoingId}:${month}`);
 const src=p.sourceId==='cash-source'?null:account(p.sourceId);

 if(src?.type==='bank'){
  setTrackedBankBalance(src.id,adjustedBankBalance(src)+Number(p.amount||0));
 }
 if(p.generatedTransactionId){
  manualTransactions=manualTransactions.filter(t=>t._id!==p.generatedTransactionId);
  delete transactionActions[p.generatedTransactionId];
 }

 delete o.payments[month];
 saveLocal();
 if(refresh)refreshAfterOutgoingPayment();
 return true;
}

function renderOutgoings(){
 const grid=$('outgoingGrid'),body=$('outgoingScheduleBody'),k=$('outgoingKpis');if(!grid||!body||!k)return;
 const occ=allOutgoingOccurrences(24),current=outgoingThisMonthTotal(),foreverMonthly=foreverOutgoingMonthlyTotal();
 const activeMonth=currentIncomeMonth();
 const paidMonth=outgoingPaidTotalForMonth(activeMonth),unpaidMonth=outgoingUnpaidTotalForMonth(activeMonth);

 k.innerHTML=[
  kpiHTML('Planned Outgoings',String(outgoings.length),'One-time + recurring','blue'),
  kpiHTML(`${cardMonthLabel(activeMonth)} Cash Impact`,money(outgoingForMonth(activeMonth)),'Reserved/deducted from Monthly Planned Income','red'),
  kpiHTML('Paid This Month',money(paidMonth),`${money(unpaidMonth)} still unpaid`,'green'),
  kpiHTML('Forever Monthly',money(foreverMonthly),'Repeats every month until deleted','amber')
 ].join('');

 grid.innerHTML=outgoings.map(o=>{
  const thisPay=o.payments?.[activeMonth];
  return `<div class="outgoingCard">
   <div class="meta">${o.method||'Cash'}</div>
   <div style="font-weight:900">${o.description}</div>
   <div class="outAmount">${money(o.amount)}</div>
   <span class="outgoingBadge">${o.forever?'Forever • Monthly':`${o.months} month${Number(o.months)===1?'':'s'}`}</span>
   <div class="outMeta" style="margin-top:8px">${o.category} → ${o.subcategory}<br>Starts ${o.startMonth}${o.forever?'<br>Continues until you edit or delete it':''}</div>
   ${thisPay?`<div class="meta green" style="margin-top:8px"><b>${cardMonthLabel(activeMonth)} paid</b> • ${outgoingPaymentSourceLabel(thisPay)}</div>`:''}
   <div class="outActions">
    <button class="btn small" data-edit-outgoing="${o.id}">Edit</button>
    <button type="button" class="btn small danger" data-del-outgoing="${o.id}">Delete</button>
   </div>
  </div>`;
 }).join('')||'<div class="panel"><div class="meta">No cash or recurring outgoings yet.</div></div>';

 body.innerHTML=occ.slice().sort((a,b)=>a.month.localeCompare(b.month)).map(x=>{
  const p=outgoingPaymentRecord(x.outgoingId,x.month);
  return `<tr>
   <td>${x.month}</td>
   <td><b>${x.description}</b><div class="meta">${x.method}</div></td>
   <td>${x.category}</td>
   <td>${x.subcategory}</td>
   <td class="red">${money(x.amount)}</td>
   <td>${x.forever?'Monthly • Forever':`#${x.occurrence} of #${x.total}`}</td>
   <td>${p?`<span class="badge active">Paid</span><div class="meta">${outgoingPaymentSourceLabel(p)}<br>${paymentFormatDate(p.date)}</div>`:`<span class="badge pending">Unpaid</span>`}</td>
   <td>${p
    ?`<button class="btn small" data-undo-outgoing-pay="${x.outgoingId}" data-pay-month="${x.month}">Undo Payment</button>`
    :`<button class="btn small primary" data-pay-outgoing="${x.outgoingId}" data-pay-month="${x.month}">Pay</button>`}
   </td>
  </tr>`;
 }).join('')||'<tr><td colspan="8">No scheduled outgoings.</td></tr>';

 document.querySelectorAll('[data-edit-outgoing]').forEach(b=>b.addEventListener('click',()=>openOutgoing(outgoings.find(x=>x.id===b.dataset.editOutgoing))));
 document.querySelectorAll('[data-del-outgoing]').forEach(b=>b.addEventListener('click',()=>{
  const o=outgoings.find(x=>x.id===b.dataset.delOutgoing);
  if(o&&confirm(`Delete "${o.description}" and its whole schedule? Existing payment history for this outgoing will also be removed.`)){
   // Reverse paid source effects before deleting the schedule.
   Object.keys(o.payments||{}).forEach(month=>undoOutgoingPayment(o.id,month,false));
   outgoings=outgoings.filter(x=>x.id!==o.id);
   saveLocal();refreshAfterOutgoingPayment();renderImportPage();
  }
 }));
 document.querySelectorAll('[data-pay-outgoing]').forEach(b=>b.addEventListener('click',()=>openOutgoingPayment(b.dataset.payOutgoing,b.dataset.payMonth)));
 document.querySelectorAll('[data-undo-outgoing-pay]').forEach(b=>b.addEventListener('click',()=>{
  const o=outgoings.find(x=>x.id===b.dataset.undoOutgoingPay);
  if(o&&confirm(`Undo ${cardMonthLabel(b.dataset.payMonth)} payment for "${o.description}"?`)){
   undoOutgoingPayment(o.id,b.dataset.payMonth,true);
  }
 }));
}
function dedupeDashboardErrorAlerts(){
 const seen=new Set();
 document.querySelectorAll('#reviewAlerts .alert, #reviewAlerts .reviewAlert, [data-dashboard-error]').forEach(el=>{
  const key=(el.textContent||'').trim();
  if(key&&seen.has(key))el.remove();
  else if(key)seen.add(key);
 });
}

// V194 FEATURE UPGRADE — dashboard balances, early settlement, statement format library,
// personal gold assets and data-driven custom credit cards.
let statementFormats=JSON.parse(localStorage.getItem('pf_statement_formats')||'null')||[
 {id:'fmt-ar-current',name:'Al Rajhi Current Account',accountId:'ar-current-2989',fileType:'PDF / Excel',mapping:'Built-in parser',builtIn:true,active:true},
 {id:'fmt-ar-0955',name:'Al Rajhi Visa Infinite •0955',accountId:'ar-0955',fileType:'PDF / Excel',mapping:'Built-in parser',builtIn:true,active:true},
 {id:'fmt-ar-5867',name:'Al Rajhi Visa Platinum •5867',accountId:'ar-5867',fileType:'PDF / Excel',mapping:'Built-in parser',builtIn:true,active:true},
 {id:'fmt-sab-440880',name:'SAB Cashback •440880',accountId:'sab-440880',fileType:'PDF / Excel',mapping:'Built-in parser',builtIn:true,active:true}
];
let goldAssets=JSON.parse(localStorage.getItem('pf_gold_assets')||'[]'); if(!Array.isArray(goldAssets))goldAssets=[];
let goldZakatHistory=JSON.parse(localStorage.getItem('pf_gold_zakat_history')||'[]'); if(!Array.isArray(goldZakatHistory))goldZakatHistory=[];
let goldSaleHistory=JSON.parse(localStorage.getItem('pf_gold_sale_history')||'[]'); if(!Array.isArray(goldSaleHistory))goldSaleHistory=[];
let goldMarket=JSON.parse(localStorage.getItem('pf_gold_market')||'null')||{price24k:0,updatedAt:'',source:'Gold-API',manual:false};
function saveV194Data(){
 localStorage.setItem('pf_statement_formats',JSON.stringify(statementFormats));
 localStorage.setItem('pf_gold_assets',JSON.stringify(goldAssets));
 localStorage.setItem('pf_gold_zakat_history',JSON.stringify(goldZakatHistory));
 localStorage.setItem('pf_gold_sale_history',JSON.stringify(goldSaleHistory));
 localStorage.setItem('pf_gold_market',JSON.stringify(goldMarket));
 localStorage.setItem('pf_custom_credit_cards',JSON.stringify(customCreditCards));
 if(typeof scheduleCloudAutoSave==='function')scheduleCloudAutoSave();
}
function remainingMonthlyCashFlow(){return remainingIncomeAvailable();}
function renderDashboardRemainingBalances(){
 const box=$('dashRemainingBalances'); if(!box)return;
 const cards=accounts.filter(a=>a.type==='card');
 box.innerHTML='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px">'+cards.map(a=>{const m=cardMetrics(a);return '<div class="miniMetric" style="padding:10px 12px"><span>Card •'+escapeHtml(String(a.ending||''))+'</span><b style="font-size:16px">'+money(m.available)+'</b><small>Remaining</small></div>'}).join('')+'</div>';
}
function completeInstallmentEarly(id){
 const p=installments.find(x=>x.id===id); if(!p)return;
 const c=planCalc(p),a=account(p.cardId); const defaultAmt=Math.max(0,Number(c.remaining||0));
 const raw=prompt(`EARLY INSTALLMENT SETTLEMENT\n\n${a?.bank||''} •${a?.ending||''}\n${p.description}\nRemaining principal: ${money(defaultAmt)}\n\nEnter final settlement amount (SAR):`,defaultAmt.toFixed(2)); if(raw===null)return;
 const amt=Number(raw); if(!Number.isFinite(amt)||amt<0){alert('Enter a valid settlement amount.');return;}
 const sources=[{id:'cash-source',name:'Monthly Planned Income'},...accounts.filter(x=>x.type==='bank').map(x=>({id:x.id,name:accountName(x.id)}))];
 const choice=prompt('Paid from:\n'+sources.map((x,i)=>`${i+1}. ${x.name}`).join('\n'),'1'); if(choice===null)return;
 const src=sources[Math.max(0,Math.min(sources.length-1,Number(choice||1)-1))];
 if(!confirm(`Complete this installment early?\n\nSettlement: ${money(amt)}\nPaid from: ${src.name}\n\nFuture installment commitments will stop and history will be retained.`))return;
 p.completedConfirmed=true;p.completedAt=new Date().toISOString().slice(0,10);p.completionType='early-settlement';p.earlySettlementAmount=amt;p.earlySettlementSourceId=src.id;p.earlySettlementSourceName=src.name;
 if(amt>0){
  cashFlowLedger.push({id:`cfl-gold-${Date.now()}`,type:'installment-early-settlement',date:p.completedAt,month:currentIncomeMonth(),amount:amt,direction:'out',description:`Early installment settlement • ${a?.bank||''} •${a?.ending||''} • ${p.description}`,sourceId:src.id,targetId:p.cardId,status:'active'});
  if(src.id!=='cash-source'){const ba=account(src.id);if(ba?.type==='bank')setTrackedBankBalance(ba.id,adjustedBankBalance(ba)-amt);}
 }
 localStorage.setItem('pf_installments',JSON.stringify(installments));localStorage.setItem('pf_cash_flow_ledger',JSON.stringify(cashFlowLedger));saveLocal();
 renderInstallments();renderDashboard();renderPaymentPlanner();renderIncomePlan();renderAccounts();
}
function renderStatementFormats(){
 const b=$('statementFormatsBody');if(!b)return;
 b.innerHTML=statementFormats.map(f=>`<tr><td><b>${escapeHtml(f.name)}</b></td><td>${escapeHtml(accountName(f.accountId)||f.accountId||'Any')}</td><td>${escapeHtml(f.fileType||'')}</td><td>${escapeHtml(f.mapping||'')}</td><td><span class="badge ${f.active!==false?'active':''}">${f.active!==false?'Active':'Inactive'}</span></td><td>${f.builtIn?'<span class="meta">Built-in</span>':`<button class="btn small danger" data-delete-format="${f.id}">Delete</button>`}</td></tr>`).join('');
 document.querySelectorAll('[data-delete-format]').forEach(x=>x.onclick=()=>{statementFormats=statementFormats.filter(f=>f.id!==x.dataset.deleteFormat);saveV194Data();renderStatementFormats();});
}
function addStatementFormat(){
 const name=prompt('Statement format name:');if(!name)return;const acct=prompt('Account/Card ID (leave blank for any account):','')||'';const type=prompt('File type (PDF / XLSX / CSV):','XLSX / CSV')||'XLSX / CSV';const mapping=prompt('Mapping description (example: Date=A, Description=B, Amount=E):','Date / Description / Amount')||'';
 statementFormats.push({id:'fmt-'+Date.now(),name,accountId:acct,fileType:type,mapping,active:true,builtIn:false});saveV194Data();renderStatementFormats();
}
function exportStatementFormats(){const blob=new Blob([JSON.stringify({type:'personal-finance-statement-formats',version:1,formats:statementFormats},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='statement-formats.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);}
function importStatementFormatsFile(file){const r=new FileReader();r.onload=()=>{try{const j=JSON.parse(r.result);const arr=Array.isArray(j)?j:j.formats;if(!Array.isArray(arr))throw Error('No formats found');arr.forEach(f=>{if(!f.id)f.id='fmt-'+Date.now()+'-'+Math.random().toString(36).slice(2,6);const i=statementFormats.findIndex(x=>x.id===f.id);if(i>=0)statementFormats[i]=f;else statementFormats.push(f)});saveV194Data();renderStatementFormats();alert(`${arr.length} statement format(s) imported.`)}catch(e){alert('Could not import format file: '+e.message)}};r.readAsText(file);}
function hijriParts(date){const parts=new Intl.DateTimeFormat('en-u-ca-islamic-umalqura',{day:'numeric',month:'numeric',year:'numeric'}).formatToParts(date);const o={};parts.forEach(p=>{if(['day','month','year'].includes(p.type))o[p.type]=Number(p.value)});return o;}
function nextHijriAnniversary(purchaseDate,lastPaidDate=''){
 const base=new Date((lastPaidDate||purchaseDate)+'T12:00:00');const hp=hijriParts(base);const targetY=hp.year+1;let d=new Date(base);d.setDate(d.getDate()+340);
 for(let i=0;i<40;i++){const h=hijriParts(d);if(h.year===targetY&&h.month===hp.month&&h.day===hp.day)return d.toISOString().slice(0,10);d.setDate(d.getDate()+1)}
 d=new Date(base);d.setDate(d.getDate()+354);return d.toISOString().slice(0,10);
}
function goldPricePerGram(purity){const k=Number(String(purity||'24').replace(/[^0-9.]/g,''))||24;return Number(goldMarket.price24k||0)*(k/24);}
function normalizedGoldAssetName(v){return String(v||'').trim().replace(/\s+/g,' ').toLocaleLowerCase();}
function goldExactDuplicateKey(a){return [normalizedGoldAssetName(a?.name),String(a?.goldType||'Gold').toLocaleLowerCase(),String(a?.purity||'24K').toLocaleUpperCase(),Number(a?.weight||0).toFixed(3),Number(a?.purchasePrice||0).toFixed(2)].join('|');}
function cleanupExactGoldDuplicatesV227(){
 if(localStorage.getItem('pf_gold_duplicate_cleanup_v227')==='1')return 0;
 const historyIds=new Set([...(goldSaleHistory||[]).map(x=>x.assetId),...(goldZakatHistory||[]).map(x=>x.assetId)]);
 const groups=new Map();
 (goldAssets||[]).forEach((a,i)=>{const k=goldExactDuplicateKey(a);if(!groups.has(k))groups.set(k,[]);groups.get(k).push({a,i});});
 const remove=new Set(),recovered=[];
 groups.forEach(items=>{
  if(items.length<2||items.some(x=>historyIds.has(x.a.id)))return;
  items.sort((x,y)=>String(y.a.createdAt||'').localeCompare(String(x.a.createdAt||''))||y.i-x.i);
  items.slice(1).forEach(x=>{remove.add(x.a.id);recovered.push(x.a);});
 });
 if(recovered.length){
  localStorage.setItem('pf_gold_duplicate_recovery_v227',JSON.stringify({createdAt:new Date().toISOString(),removed:recovered}));
  goldAssets=goldAssets.filter(a=>!remove.has(a.id));
  saveV194Data();
 }
 localStorage.setItem('pf_gold_duplicate_cleanup_v227','1');
 return recovered.length;
}
cleanupExactGoldDuplicatesV227();
function activeGoldWeight(a){return Math.max(0,Number(a.weight||0)-goldSaleHistory.filter(s=>s.assetId===a.id).reduce((z,x)=>z+Number(x.weight||0),0));}
function goldAssetValue(a){return activeGoldWeight(a)*goldPricePerGram(a.purity);}
function goldLastZakat(a){return goldZakatHistory.filter(z=>z.assetId===a.id).sort((x,y)=>String(y.paidDate).localeCompare(String(x.paidDate)))[0]||null;}
function goldNextDue(a){const last=goldLastZakat(a);return nextHijriAnniversary(a.purchaseDate,last?.paidDate||'');}
function goldZakatDue(a){return new Date(goldNextDue(a)+'T00:00:00')<=new Date(new Date().toISOString().slice(0,10)+'T23:59:59');}
function renderGoldAssets(){
 const active=goldAssets.filter(a=>activeGoldWeight(a)>0.0001),totalWeight=active.reduce((z,a)=>z+activeGoldWeight(a),0),value=active.reduce((z,a)=>z+goldAssetValue(a),0),due=active.filter(goldZakatDue).reduce((z,a)=>z+goldAssetValue(a)*.025,0);
 if($('goldKpis'))$('goldKpis').innerHTML=[kpiHTML('Total Gold Weight',`${MONEY.format(totalWeight)} g`,'Active physical gold only'),kpiHTML('Current Market Value',money(value),'Spot-value estimate','green'),kpiHTML('Zakat Due Now',money(due),`${active.filter(goldZakatDue).length} asset(s) due`,due>0?'amber':'green'),kpiHTML('Active Assets',String(active.length),'Each purchase has a unique Asset ID')].join('');
 if($('goldPriceGrid'))$('goldPriceGrid').innerHTML=['24','22','21','18'].map(k=>kpiHTML(`${k}K / gram`,money(goldPricePerGram(k)),k==='24'?'Live base price':'Derived by purity')).join('');
 if($('goldPriceMeta'))$('goldPriceMeta').textContent=`${goldMarket.manual?'Manual override':'Live spot reference'} • ${goldMarket.updatedAt?new Date(goldMarket.updatedAt).toLocaleString():'Not refreshed yet'} • Source: ${goldMarket.source||'Gold-API'}`;
 const b=$('goldAssetsBody');if(b)b.innerHTML=active.length?active.map(a=>{const w=activeGoldWeight(a),v=goldAssetValue(a),cost=Number(a.purchasePrice||0)*(w/Math.max(.0001,Number(a.weight||0))),gain=v-cost,dueDate=goldNextDue(a),dueNow=goldZakatDue(a),zak=v*.025;return `<tr><td><b>${escapeHtml(a.name)}</b><div class="meta">${a.id}</div></td><td>${escapeHtml(a.goldType||'Gold')} • ${escapeHtml(a.purity||'24K')}</td><td><b>${MONEY.format(w)} g</b></td><td>${a.purchaseDate}</td><td>${money(cost)}</td><td><b>${money(v)}</b></td><td class="${gain>=0?'green':'red'}">${money(gain)}</td><td>${dueDate}<div class="meta">${new Intl.DateTimeFormat('en-u-ca-islamic-umalqura',{day:'numeric',month:'short',year:'numeric'}).format(new Date(dueDate+'T12:00:00'))}</div></td><td class="${dueNow?'amber':''}"><b>${money(zak)}</b><div class="meta">${dueNow?'DUE':'Not due'}</div></td><td><div style="display:flex;gap:5px;flex-wrap:wrap"><button class="btn small" data-edit-gold="${a.id}">Edit</button><button class="btn small" data-sell-gold="${a.id}">Sell</button>${dueNow?`<button class="btn small primary" data-pay-zakat="${a.id}">Pay Zakat</button>`:''}<button class="btn small danger" data-delete-gold="${a.id}">Delete</button></div></td></tr>`}).join(''):'<tr><td colspan="10">No active gold assets yet.</td></tr>';
 const zh=$('goldZakatHistoryBody');if(zh)zh.innerHTML=goldZakatHistory.length?goldZakatHistory.slice().reverse().map(z=>`<tr><td>${escapeHtml(z.assetName)}<div class="meta">${z.assetId}</div></td><td>${escapeHtml(z.hijriCycle||'')}</td><td>${MONEY.format(z.weight)} g</td><td>${money(z.valueUsed)}</td><td><b>${money(z.amount)}</b></td><td>${z.paidDate}</td><td>${escapeHtml(z.sourceName||'')}</td><td><div style="display:flex;gap:5px;flex-wrap:wrap"><button class="btn small" data-edit-zakat="${z.id}">Edit</button><button class="btn small danger" data-delete-zakat="${z.id}">Undo</button></div></td></tr>`).join(''):'<tr><td colspan="8">No Zakat payments recorded yet.</td></tr>';
 const sh=$('goldSaleHistoryBody');if(sh)sh.innerHTML=goldSaleHistory.length?goldSaleHistory.slice().reverse().map(x=>`<tr><td>${escapeHtml(x.assetName)}<div class="meta">${x.assetId}</div></td><td>${x.date}</td><td>${MONEY.format(x.weight)} g</td><td>${money(x.proceeds)}</td><td>${escapeHtml(x.receivedToName||'Monthly Cash')}</td><td class="${x.gainLoss>=0?'green':'red'}">${money(x.gainLoss)}</td></tr>`).join(''):'<tr><td colspan="6">No gold sales recorded yet.</td></tr>';
 document.querySelectorAll('[data-edit-gold]').forEach(x=>x.onclick=()=>editGoldAsset(x.dataset.editGold));document.querySelectorAll('[data-sell-gold]').forEach(x=>x.onclick=()=>sellGoldAsset(x.dataset.sellGold));document.querySelectorAll('[data-delete-gold]').forEach(x=>x.onclick=()=>deleteGoldAsset(x.dataset.deleteGold));document.querySelectorAll('[data-pay-zakat]').forEach(x=>x.onclick=()=>payGoldZakat(x.dataset.payZakat));document.querySelectorAll('[data-edit-zakat]').forEach(x=>x.onclick=()=>editGoldZakatPayment(x.dataset.editZakat));document.querySelectorAll('[data-delete-zakat]').forEach(x=>x.onclick=()=>deleteGoldZakatPayment(x.dataset.deleteZakat));
}
function addGoldAsset(){const name=prompt('Asset name (example: Gold Bar 1):');if(!name)return;const type=prompt('Gold type (Bar / Coin / Jewelry / Other):','Bar')||'Gold';const purity=prompt('Purity (24K / 22K / 21K / 18K):','24K')||'24K';const w=Number(prompt('Weight in grams:',''));if(!Number.isFinite(w)||w<=0)return alert('Invalid weight.');const price=Number(prompt('Total bought price (SAR):',''));if(!Number.isFinite(price)||price<0)return alert('Invalid purchase price.');const date=prompt('Bought date (YYYY-MM-DD):',new Date().toISOString().slice(0,10));if(!date)return;const seq=String((Math.max(0,...goldAssets.map(a=>Number(String(a.id||'').replace(/\D/g,''))||0))+1)).padStart(4,'0');goldAssets.push({id:`GLD-${seq}`,name,goldType:type,purity,weight:w,purchasePrice:price,purchaseDate:date,notes:'',createdAt:new Date().toISOString()});saveV194Data();renderGoldAssets();renderDashboard();}
function editGoldAsset(id){const a=goldAssets.find(x=>x.id===id);if(!a)return;const name=prompt('Asset name:',a.name);if(name===null)return;const w=Number(prompt('Original weight (g):',a.weight));if(!Number.isFinite(w)||w<=0)return;const price=Number(prompt('Bought price (SAR):',a.purchasePrice));if(!Number.isFinite(price)||price<0)return;a.name=name||a.name;a.weight=w;a.purchasePrice=price;saveV194Data();renderGoldAssets();}
function deleteGoldAsset(id){
 const a=goldAssets.find(x=>x.id===id);if(!a)return;
 const sales=goldSaleHistory.filter(x=>x.assetId===id),zakat=goldZakatHistory.filter(x=>x.assetId===id);
 if(sales.length||zakat.length){alert(`This asset has ${sales.length} sale record(s) and ${zakat.length} Zakat payment(s). Undo those linked records before deleting the asset so bank balances and history remain correct.`);return;}
 if(!confirm(`Delete this gold asset?\n\n${a.name} • ${a.id}\n${Number(a.weight||0).toFixed(3)} g • ${money(a.purchasePrice)}\n\nThis removes it from totals and all synced devices.`))return;
 goldAssets=goldAssets.filter(x=>x.id!==id);
 saveV194Data();
 if(typeof recordImmediateDelete==='function')recordImmediateDelete('personal_assets_gold',a._cloudRecordId||a.id,'gold-asset-delete');
 renderGoldAssets();renderDashboard();
 if(typeof renderFinancialPosition==='function')renderFinancialPosition();
}
function sellGoldAsset(id){const a=goldAssets.find(x=>x.id===id);if(!a)return;const avail=activeGoldWeight(a);const w=Number(prompt(`Weight to sell (g) — available ${avail.toFixed(3)} g:`,avail.toFixed(3)));if(!Number.isFinite(w)||w<=0||w>avail+.0001)return alert('Invalid sale weight.');const proceeds=Number(prompt('Total sale proceeds (SAR):',''));if(!Number.isFinite(proceeds)||proceeds<0)return;const date=prompt('Sale date (YYYY-MM-DD):',new Date().toISOString().slice(0,10));if(!date)return;const sources=[{id:'cash-source',name:'Monthly Cash Flow'},...accounts.filter(x=>x.type==='bank').map(x=>({id:x.id,name:accountName(x.id)}))];const ch=Number(prompt('Receive proceeds to:\n'+sources.map((x,i)=>`${i+1}. ${x.name}`).join('\n'),'1'))||1;const src=sources[Math.max(0,Math.min(sources.length-1,ch-1))];const allocatedCost=Number(a.purchasePrice||0)*(w/Number(a.weight||1));const gain=proceeds-allocatedCost;goldSaleHistory.push({id:'GSALE-'+Date.now(),assetId:a.id,assetName:a.name,date,weight:w,proceeds,receivedToId:src.id,receivedToName:src.name,gainLoss:gain});incomePlan.extraIncomeHistory=incomePlan.extraIncomeHistory||[];incomePlan.extraIncomeHistory.push({id:'gold-sale-'+Date.now(),date,month:date.slice(0,7),amount:proceeds,note:`Gold sale • ${a.name} • ${w} g`});if(src.id!=='cash-source'){const ba=account(src.id);if(ba?.type==='bank')setTrackedBankBalance(ba.id,adjustedBankBalance(ba)+proceeds);}localStorage.setItem('pf_income_plan',JSON.stringify(incomePlan));saveV194Data();saveLocal();renderGoldAssets();renderIncomePlan();renderDashboard();renderAccounts();}
