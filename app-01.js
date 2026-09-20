




var financeDB={
 name:'PersonalFinanceDB',version:1,store:'app_state',
 open(){return new Promise((resolve,reject)=>{const r=indexedDB.open(this.name,this.version);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains(this.store))db.createObjectStore(this.store)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})},
 async put(key,value){const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction(this.store,'readwrite');tx.objectStore(this.store).put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})},
 async get(key){const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction(this.store,'readonly');const r=tx.objectStore(this.store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})},
 snapshot(){return {categories,installments,merchantRules,txOverrides,incomePlan,manualTransactions,importedTransactions,importHistory,outgoings,duplicateDecisions,statementRule,transactionActions,cardPaymentPlan,cashFlowLedger,savedAt:new Date().toISOString()}},
 async save(){try{await this.put('finance_state',this.snapshot());updateDbStatus(true)}catch(e){console.warn('IndexedDB save failed',e);updateDbStatus(false)}},
 async restore(){try{const d=await this.get('finance_state');if(!d)return false;
   categories=d.categories||categories;installments=d.installments||installments;merchantRules=d.merchantRules||merchantRules;txOverrides=d.txOverrides||txOverrides;incomePlan=d.incomePlan||incomePlan;manualTransactions=d.manualTransactions||manualTransactions;importedTransactions=d.importedTransactions||importedTransactions;importHistory=d.importHistory||importHistory;outgoings=d.outgoings||outgoings;duplicateDecisions=d.duplicateDecisions||duplicateDecisions;statementRule=d.statementRule||statementRule;transactionActions=d.transactionActions||transactionActions;cardPaymentPlan=d.cardPaymentPlan||cardPaymentPlan;cashFlowLedger=d.cashFlowLedger||cashFlowLedger;cashFlowLedger=d.cashFlowLedger||cashFlowLedger;
 purgeLegacyAr5867SeedRows();
 purgeLegacySabAnchorRows();
   normalizeCardPaymentPlan();
   rebuildTransactions();
   ensureLedgerBackedPlannerRows();
   rebuildAllPlannerPaymentsFromLedger();
   updateDbStatus(true,d.savedAt);return true}catch(e){console.warn('IndexedDB restore failed',e);updateDbStatus(false);return false}}
};
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
