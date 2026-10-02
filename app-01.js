/* Workspace amounts are stored in the immutable workspace base currency.
   Market prices retain their native currency; conversion happens at valuation. */
var FINANCE_CURRENCIES=['SAR','PHP','USD','EUR','GBP','AED','AUD','CAD','CHF','CNY','HKD','SGD','JPY','INR','KRW','IDR','MYR','THB','NZD','BHD','KWD','QAR','OMR','EGP','PKR','BDT','ZAR','TRY','BRL','MXN'];
function financeBaseCurrency(){return FINANCE_CURRENCIES.includes(window.financeWorkspaceCurrency)?window.financeWorkspaceCurrency:'SAR';}
function financeCurrencyOptions(selected){var names=new Intl.DisplayNames(['en'],{type:'currency'});return FINANCE_CURRENCIES.map(c=>'<option value="'+c+'"'+(c===selected?' selected':'')+'>'+c+' · '+names.of(c)+'</option>').join('');}
var financeFxQuotes=new Map(),financeFxRequests=new Map();
function financeFxFactor(from){var to=financeBaseCurrency();if(from===to)return 1;if(to==='SAR'&&from==='USD')return 3.75;var q=financeFxQuotes.get(from+'|'+to);return q&&Date.now()-q.loaded<3600000?q.rate:NaN;}
async function financeFetchRate(from,to=financeBaseCurrency()){
 if(!FINANCE_CURRENCIES.includes(from)||!FINANCE_CURRENCIES.includes(to))throw Error('Unsupported currency');
 if(from===to)return {from,to,rate:1,date:new Date().toISOString().slice(0,10),source:'Same currency'};
 var key=from+'|'+to,cached=financeFxQuotes.get(key);if(cached&&Date.now()-cached.loaded<1800000)return cached;
 if(financeFxRequests.has(key))return financeFxRequests.get(key);
 var request=(async()=>{var r=await fetch('/api/exchange-rate?from='+encodeURIComponent(from)+'&to='+encodeURIComponent(to),{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Online reference rate unavailable');var d=await r.json();if(d.from!==from||d.to!==to||!Number.isFinite(Number(d.rate))||!(Number(d.rate)>0))throw Error('Invalid exchange rate');var q={...d,rate:Number(d.rate),loaded:Date.now()};financeFxQuotes.set(key,q);return q;})();
 financeFxRequests.set(key,request);try{return await request;}finally{financeFxRequests.delete(key);}
}
function financeNativeMoney(n,currency=financeBaseCurrency()){return Number.isFinite(Number(n))?currency+' '+financeFormatAmount(n,currency):'— (exchange rate unavailable)';}





window.financeHadPersistedStateAtStart=['pf_installments','pf_imported_transactions','pf_manual_transactions'].every(key=>localStorage.getItem(key)!==null);
var financeDB={
 name:window.financeAdditionalWorkspace
  ?'PersonalFinanceDB-owned-'+window.financeActiveUserId+'-'+window.financeWorkspaceUserId
  :window.financeSharedWorkspace
  ?'PersonalFinanceDB-shared-'+window.financeActiveUserId+'-'+window.financeWorkspaceUserId+'-'+window.financePageFingerprint+'-'+(localStorage.getItem('pf_permission_epoch')||'initial')
  :window.financeRestrictedOwnAccess
   ?'PersonalFinanceDB-restricted-'+window.financeActiveUserId+'-'+window.financePageFingerprint+'-'+(localStorage.getItem('pf_permission_epoch')||'initial')
   :window.financeIsOwner?'PersonalFinanceDB':('PersonalFinanceDB-'+(window.financeActiveUserId||'signed-out')),
 version:1,store:'app_state',
 open(){
  if(this.openPromise)return this.openPromise;
  this.openPromise=new Promise((resolve,reject)=>{
   const r=indexedDB.open(this.name,this.version);
   r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains(this.store))db.createObjectStore(this.store)};
   r.onsuccess=()=>{const db=r.result;db.onversionchange=()=>{db.close();this.openPromise=null;};resolve(db);};
   r.onerror=()=>{this.openPromise=null;reject(r.error)};
  });
  return this.openPromise;
 },
 async put(key,value){const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction(this.store,'readwrite');tx.objectStore(this.store).put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})},
 async get(key){const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction(this.store,'readonly');const r=tx.objectStore(this.store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})},
 snapshot(){return {categories,installments,merchantRules,txOverrides,incomePlan,manualTransactions,importedTransactions,importHistory,outgoings,duplicateDecisions,statementRule,transactionActions,cardPaymentPlan,cashFlowLedger,savedAt:new Date().toISOString()}},
 async save(){if(window.financeSharedWorkspace)return;this.cacheRevision=(this.cacheRevision||0)+1;try{await this.put('finance_state',this.snapshot());updateDbStatus(true)}catch(e){console.warn('IndexedDB save failed',e);updateDbStatus(false)}},
 async restore(){if(window.financeSharedWorkspace||window.financeHadPersistedStateAtStart)return false;const revision=this.cacheRevision||0;try{const d=await this.get('finance_state');if(!d||revision!==(this.cacheRevision||0))return false;
   categories=d.categories||categories;installments=d.installments||installments;merchantRules=d.merchantRules||merchantRules;txOverrides=d.txOverrides||txOverrides;incomePlan=d.incomePlan||incomePlan;manualTransactions=d.manualTransactions||manualTransactions;importedTransactions=d.importedTransactions||importedTransactions;importHistory=d.importHistory||importHistory;outgoings=d.outgoings||outgoings;duplicateDecisions=d.duplicateDecisions||duplicateDecisions;statementRule=d.statementRule||statementRule;transactionActions=d.transactionActions||transactionActions;cardPaymentPlan=d.cardPaymentPlan||cardPaymentPlan;cashFlowLedger=d.cashFlowLedger||cashFlowLedger;cashFlowLedger=d.cashFlowLedger||cashFlowLedger;
 purgeLegacyAr5867SeedRows();
 purgeLegacySabAnchorRows();
   normalizeCardPaymentPlan();
   rebuildTransactions();
   ensureLedgerBackedPlannerRows();
   rebuildAllPlannerPaymentsFromLedger();
   updateDbStatus(true,d.savedAt);return true}catch(e){console.warn('IndexedDB restore failed',e);updateDbStatus(false);return false}}
};
var financeStatementLibraries=new Map();
function financeLoadStatementLibrary(kind){
 const definitions={excel:{global:'XLSX',url:'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'},pdf:{global:'pdfjsLib',url:'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'}};
 const item=definitions[kind];
 if(!item)return Promise.reject(new Error('Unknown statement file type'));
 if(window[item.global])return Promise.resolve(window[item.global]);
 if(financeStatementLibraries.has(kind))return financeStatementLibraries.get(kind);
 const request=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src=item.url;script.async=true;
  const fail=()=>{clearTimeout(timer);script.remove();financeStatementLibraries.delete(kind);reject(new Error('Could not load the '+kind+' importer. Check your connection and try again.'));};
  const timer=setTimeout(fail,20000);
  script.onload=()=>{clearTimeout(timer);if(window[item.global])resolve(window[item.global]);else fail();};script.onerror=fail;document.head.append(script);
 });
 financeStatementLibraries.set(kind,request);return request;
}
function financePopulateMonthSelect(select,blankLabel='Choose month'){
 if(!select)return;
 const value=select.value,now=new Date(),months=new Set(value?[value]:[]);
 for(let i=-60;i<=60;i++){const date=new Date(now.getFullYear(),now.getMonth()+i,1);months.add(date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0'));}
 select.replaceChildren(new Option(blankLabel,''));
 [...months].sort().reverse().forEach(month=>{const [year,m]=month.split('-').map(Number);select.add(new Option(new Date(year,m-1,1).toLocaleDateString('en-GB',{month:'long',year:'numeric'}),month));});
 select.value=value;
}
function financeMonthFallbacks(root=document){
 root.querySelectorAll('input[type="month"]').forEach(input=>{
  if(input.type==='month'||input.dataset.monthFallback)return;
  // Safari versions without a native month picker retain the original input
  // and its listeners, with a visible select that submits the same YYYY-MM.
  input.dataset.monthFallback='true';
  const select=document.createElement('select');select.id=(input.id||'financeMonth')+'Picker';select.className=input.className;
  select.setAttribute('aria-label',input.getAttribute('aria-label')||input.closest('.field')?.querySelector('label')?.textContent||'Month');
  if(input.hasAttribute('data-view-control'))select.setAttribute('data-view-control','');
  select.required=input.required;select.disabled=input.disabled;
  const descriptor=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
  const update=value=>{if(value&&![...select.options].some(option=>option.value===value))select.add(new Option(value,value));select.value=value;};
  input.type='hidden';input.after(select);financePopulateMonthSelect(select,input.required?'Choose month':'All months');update(descriptor.get.call(input));
  Object.defineProperty(input,'value',{configurable:true,get(){return descriptor.get.call(this);},set(value){descriptor.set.call(this,value);update(descriptor.get.call(this));}});
  select.addEventListener('change',()=>{input.value=select.value;input.dispatchEvent(new Event('change',{bubbles:true}));});
  new MutationObserver(()=>{select.disabled=input.disabled;select.required=input.required;}).observe(input,{attributes:true,attributeFilter:['disabled','required']});
 });
}
financeMonthFallbacks();
new MutationObserver(records=>{if(records.some(record=>[...record.addedNodes].some(node=>node.nodeType===1)))financeMonthFallbacks();}).observe(document.body,{childList:true,subtree:true});
var lastMobileNavAt=0;
const CLOUD_META_KEY='pf_cloud_sync_meta';
var cloudAutoSaveTimer=null;
var cloudAutoSaveBusy=false;
var cloudAutoSaveQueued=false;
var cloudAutoSyncTimer=null;
var cloudAutoSyncBusy=false;
var cloudLastAutoCheckAt=0;
window.addEventListener('error',e=>{
 try{
  const box=document.getElementById('reviewAlerts');
  if(box){
   box.innerHTML=`<div class="reviewAlert danger"><div class="alertTitle">Dashboard rendering issue detected</div><div class="alertText">${String(e.message||'Unknown error')}</div></div>`+box.innerHTML;
  }
 }catch(_){}
});


const BASE={"accounts":[{"id":"ar-current","bank":"","name":"","ending":"","type":"bank","balance":0,"balanceLabel":"","extra":{},"logo":null},{"id":"ar-0955","bank":"","name":"","ending":"","type":"card","balance":0,"balanceLabel":"","extra":{},"logo":null},{"id":"ar-5867","bank":"","name":"","ending":"","type":"card","balance":0,"balanceLabel":"","extra":{},"logo":null},{"id":"sab-440880","bank":"","name":"","ending":"","type":"card","balance":0,"balanceLabel":"","extra":{},"logo":null},{"id":"nbd-infinite-4411","bank":"","name":"","ending":"","type":"card","balance":0,"balanceLabel":"","extra":{},"logo":null},{"id":"nbd-mazeed-8652","bank":"","name":"","ending":"","type":"card","balance":0,"balanceLabel":"","extra":{},"logo":null},{"id":"meem-7102","bank":"","name":"","ending":"","type":"card","balance":0,"balanceLabel":"","extra":{},"logo":null}],"transactions":[],"categoryTree":{"Housing & Utilities":["Rent or Mortgage","Electricity","Water & Sewage","Gas","Furniture","Appliances","Internet & Phone","Repair","Home Maintenance"],"Education & Self-Development":["Course Fees / Certifications","Books & Study Materials","Workshops / Seminars"],"Food & Groceries":["Supermarket Purchases","Dining Out / Takeaway","Cigar","Coffee / Snacks"],"Transportation":["Fuel","Public Transport","Car Maintenance & Repairs","Car Insurance","Parking & Tolls"],"Health & Personal Care":["Health Insurance","Doctor Visits & Medicines","Gym / Sports Memberships","Haircuts & Grooming","Personal Hygiene Products"],"Lifestyle & Entertainment":["Movies, Concerts, Events","Streaming Services","Hobbies & Leisure Activities","Gadgets","Books, Games, Apps"],"Clothing & Accessories":["Everyday Clothing","Shoes","Bags & Accessories"],"Financial Obligations":["Loan Payments","Credit Card Payments","Savings / Investments","Gold","Emergency Fund Contributions"],"Family & Social":["Gifts & Celebrations","Childcare / School Fees","Support to Family"],"Miscellaneous":["Donations / Charity","Unexpected Expenses","Travel & Vacations"]},"initialInstallments":[]};

const DEFAULT_CARD_CYCLE_SETTINGS={
 'ar-0955':{statementDay:1,dueDay:25},
 'ar-5867':{statementDay:1,dueDay:26},
 'sab-440880':{statementDay:1,dueDay:25},
 'nbd-infinite-4411':{statementDay:7,dueDay:1},
 'nbd-mazeed-8652':{statementDay:7,dueDay:1},
 'meem-7102':{statementDay:3,dueDay:28}
};
let financeSettings=JSON.parse(localStorage.getItem('pf_finance_settings')||'null')||{loans:[],cardCycles:{}};
if(!Array.isArray(financeSettings.loans))financeSettings.loans=[];
if(!financeSettings.cardCycles||typeof financeSettings.cardCycles!=='object')financeSettings.cardCycles={};
Object.entries(DEFAULT_CARD_CYCLE_SETTINGS).forEach(([id,cfg])=>{if(!financeSettings.cardCycles[id])financeSettings.cardCycles[id]={...cfg};});
let financeSettingsDirty=false;
let financeSettingsEditing=false;

function financeApplyBaseLabels(){if(financeBaseCurrency()==='SAR')return;const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode()){if(!['SCRIPT','STYLE','OPTION'].includes(node.parentElement?.tagName))node.nodeValue=node.nodeValue.replace(/\bSAR\b/g,financeBaseCurrency());}}
financeApplyBaseLabels();
var financeDecimalCache=new Map();
function financeMoneyDecimals(currency=financeBaseCurrency()){if(!financeDecimalCache.has(currency))financeDecimalCache.set(currency,new Intl.NumberFormat('en',{style:'currency',currency}).resolvedOptions().maximumFractionDigits);return financeDecimalCache.get(currency);}
function financeRoundMoney(n){const scale=10**financeMoneyDecimals();return Math.round(Number(n)*scale)/scale;}
function financeMoneyStep(){return String(10**-financeMoneyDecimals());}
function financeFormatAmount(n,currency=financeBaseCurrency()){const digits=financeMoneyDecimals(currency);return Number(n).toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});}
document.addEventListener('focusin',event=>{const input=event.target;if(input?.type!=='number'||input.step!=='0.01')return;const label=input.closest('label')?.textContent||input.closest('.field')?.querySelector('label')?.textContent||'';if(label.includes(financeBaseCurrency())||/amount|balance|salary|income|payment|cost/i.test(input.id)&&!/^inv(?!SettlementAmount|Dividend)/.test(input.id)){input.step=financeMoneyStep();if(input.min==='0.01')input.min=financeMoneyStep();}});
