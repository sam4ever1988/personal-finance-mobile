var recordPendingDeletes=(()=>{try{const x=JSON.parse(localStorage.getItem('pf_record_delete_queue')||'[]');return Array.isArray(x)?x:[]}catch(_){return []}})();
function saveRecordDeleteQueue(){localStorage.setItem('pf_record_delete_queue',JSON.stringify(recordPendingDeletes))}
function queueRecordDelete(section,recordId){
 const key=String(section)+'|'+String(recordId);
 recordPendingDeletes=recordPendingDeletes.filter(x=>String(x.section)+'|'+String(x.record_id)!==key);
 recordPendingDeletes.push({section,record_id:String(recordId),queuedAt:new Date().toISOString()});
 saveRecordDeleteQueue();setCloudMeta({pending:true});
}

function applyRecordSyncRows(rows){
 if(!Array.isArray(rows))return false;
 recordSyncApplying=true;
 try{
  const active=rows.filter(r=>!r.deleted_at);
  const singleton=(section,fallback)=>{
   const r=active.find(x=>x.section===section&&x.record_id===RECORD_SYNC_SINGLETON);
   return r?r.data:fallback;
  };
  const list=section=>active.filter(x=>x.section===section).map(x=>x.data);

  const cloudFinanceSettings=singleton('finance_settings',financeSettings);
  if(!financeSettingsDirty){financeSettings=cloudFinanceSettings||financeSettings;if(!Array.isArray(financeSettings.loans))financeSettings.loans=[];if(!financeSettings.cardCycles||typeof financeSettings.cardCycles!=='object')financeSettings.cardCycles={};Object.entries(DEFAULT_CARD_CYCLE_SETTINGS).forEach(([id,cfg])=>{if(!financeSettings.cardCycles[id])financeSettings.cardCycles[id]={...cfg};});}
  categories=singleton('categories',categories);
  merchantRules=singleton('merchant_rules',merchantRules);
  txOverrides=singleton('tx_overrides',txOverrides);
  incomePlan=singleton('income_plan',incomePlan);
  duplicateDecisions=singleton('duplicate_decisions',duplicateDecisions);
  statementRule=singleton('statement_rule',statementRule);
  transactionActions=singleton('transaction_actions',transactionActions);
  bankBalanceOverrides=singleton('bank_balance_overrides',bankBalanceOverrides);
  customBanks=singleton('custom_banks',Array.isArray(customBanks)?customBanks:[]);if(!Array.isArray(customBanks))customBanks=[];
  customCreditCards=singleton('custom_credit_cards',Array.isArray(customCreditCards)?customCreditCards:[]);if(!Array.isArray(customCreditCards))customCreditCards=[];
  if(typeof syncCustomAccountsIntoAccounts==='function')syncCustomAccountsIntoAccounts();

  const resetIds=singleton('reset_card_ids',[...resetCardIds]);
  resetCardIds=new Set(Array.isArray(resetIds)?resetIds:[]);
  cardResetHistory=singleton('card_reset_history',cardResetHistory);
  const deletedIds=singleton('deleted_installment_ids',[...deletedInstallmentIds]);
  deletedInstallmentIds=new Set(Array.isArray(deletedIds)?deletedIds:[]);

  manualTransactions=list('manual_transactions');
  importedTransactions=list('imported_transactions');
  importHistory=list('import_history');
  cashFlowLedger=list('cash_flow_ledger');
  outgoings=list('outgoings');
  installments=list('installments').filter(p=>!deletedInstallmentIds.has(p.id));
  cardPaymentPlan=list('card_payment_plan');
  if(typeof rentalBookings!=='undefined')rentalBookings=list('rental_bookings');
  if(typeof rentalExpenses!=='undefined')rentalExpenses=list('rental_expenses');
  if(typeof rentalBlocks!=='undefined')rentalBlocks=active.filter(r=>r.section==='rental_blocks'&&String(r.record_id).startsWith('rental-block:')).map(r=>r.data);
  if(typeof goldAssets!=='undefined')goldAssets=list('personal_assets_gold');
  if(typeof goldZakatHistory!=='undefined')goldZakatHistory=list('personal_assets_zakat');
  if(typeof goldSaleHistory!=='undefined')goldSaleHistory=list('personal_assets_sales');
  if(typeof goldMarket!=='undefined')goldMarket=singleton('personal_assets_market',goldMarket);
  if(rows.some(r=>r.section==='investments_holdings')&&typeof invHoldings!=='undefined'){
   invHoldings=list('investments_holdings');localStorage.setItem('pf_investments_holdings',JSON.stringify(invHoldings));
  }
  if(rows.some(r=>r.section==='investments_trades')&&typeof invTrades!=='undefined'){
   invTrades=active.filter(r=>r.section==='investments_trades').map(r=>({...r.data,_cloudRecordId:r.data?._cloudRecordId??String(r.record_id)}));localStorage.setItem('pf_investments_trades',JSON.stringify(invTrades));
   if(typeof invEnsureLedgerV296==='function')invEnsureLedgerV296();
  }
  purgeLegacyAr0955StatementRows();
  purgeLegacySeedPaymentPlans();

  purgeLegacyAr5867SeedRows();
  purgeLegacySabAnchorRows();
  normalizeCardPaymentPlan();
  rebuildTransactions();
  normalizeBalanceOffers();
  ensurePartialPaymentFields();
  ensureLedgerBackedPlannerRows();
  rebuildAllPlannerPaymentsFromLedger();

  persistRecoveredState();
  financeDB.save();
  rows.forEach(r=>noteCloudUpdatedAt(r.updated_at));
  return true;
 }finally{
  recordSyncApplying=false;
 }
}

async function recordFetchAll(){
 if(!cloudClient)return [];
 const {data:{session}}=await cloudClient.auth.getSession();
 if(!session)return [];
 const {data,error}=await cloudClient.from(RECORD_SYNC_TABLE)
   .select('section,record_id,data,updated_at,deleted_at')
   .order('updated_at',{ascending:true});
 if(error)throw error;
 return data||[];
}

async function recordFetchLatestUpdatedAt(){
 if(!cloudClient)return 0;
 const {data:{session}}=await cloudClient.auth.getSession();
 if(!session)return 0;
 const {data,error}=await cloudClient.from(RECORD_SYNC_TABLE)
  .select('updated_at')
  .order('updated_at',{ascending:false})
  .limit(1);
 if(error)throw error;
 const t=new Date(data?.[0]?.updated_at||0).getTime();
 return Number.isFinite(t)?t:0;
}
async function recordFetchChangedSince(iso){
 if(!cloudClient)return [];
 const {data:{session}}=await cloudClient.auth.getSession();
 if(!session)return [];
 const {data,error}=await cloudClient.from(RECORD_SYNC_TABLE)
  .select('section,record_id,data,updated_at,deleted_at')
  .gt('updated_at',iso)
  .order('updated_at',{ascending:true});
 if(error)throw error;
 return data||[];
}


async function recordSeedFromLegacyCloudIfNeeded(){
 const existing=await recordFetchAll();
 if(existing.length)return existing;

 // One-time migration: use the existing Supabase app_state snapshot as the
 // canonical starting point, NOT whichever device happens to open V145 first.
 const legacy=await cloudInspectState();
 const seedRows=(legacy.initialized&&legacy.value)
   ? recordRowsFromSnapshot(legacy.value)
   : buildRecordSyncRowsFromState();

 if(!seedRows.length)return [];

 const payload=seedRows.map(r=>({...r,deleted_at:null}));
 const {error}=await cloudClient.from(RECORD_SYNC_TABLE)
   .upsert(payload,{onConflict:'section,record_id'});
 if(error)throw error;

 return await recordFetchAll();
}

async function recordPullAll(reason='manual-full-pull'){
 if(recordSyncPullBusy||recordSyncPushBusy||recordSyncApplying||!cloudClient)return false;
 recordSyncPullBusy=true;
 try{
  const {data:{session}}=await cloudClient.auth.getSession();
  if(!session)return false;

  const rowCloud=await recordFetchAll();
  const legacy=await cloudInspectState();

  // Compare both cloud stores before choosing a source.
  // The legacy app_state snapshot is still authoritative when it contains substantially
  // more finance data than the row-level store. Never seed from an empty local device.
  const legacySummary=(legacy.initialized&&legacy.value)
    ? (legacy.value.syncSummary||syncSummaryFromSnapshot(legacy.value))
    : null;

  const rowActive=rowCloud.filter(r=>!r.deleted_at);
  const rowSummary={
    transactions:rowActive.filter(r=>r.section==='manual_transactions'||r.section==='imported_transactions').length,
    installments:rowActive.filter(r=>r.section==='installments').length,
    paymentRows:rowActive.filter(r=>r.section==='card_payment_plan').length,
    cashFlowRows:rowActive.filter(r=>r.section==='cash_flow_ledger').length
  };

  const legacyScore=legacySummary
    ? Number(legacySummary.transactions||0)+Number(legacySummary.installments||0)+Number(legacySummary.paymentRows||0)+Number(legacySummary.cashFlowRows||0)
    : 0;
  const rowScore=Number(rowSummary.transactions||0)+Number(rowSummary.installments||0)+Number(rowSummary.paymentRows||0)+Number(rowSummary.cashFlowRows||0);

  try{saveRecoverySnapshot(`before-${reason}`);}catch(_){}

  if(false && legacy.initialized&&legacy.value&&legacyScore>rowScore){
    applyCloudSnapshot(legacy.value);
    persistRecoveredState();
    financeDB.save();

    // Repair/migrate the row-level cloud from the known-good cloud snapshot, not local emptiness.
    const seedRows=recordRowsFromSnapshot(legacy.value).map(r=>({...r,deleted_at:null}));
    if(seedRows.length){
      const {error}=await cloudClient.from(RECORD_SYNC_TABLE)
        .upsert(seedRows,{onConflict:'section,record_id'});
      if(error)console.warn('Row-cloud repair from app_state failed',error);
    }

    setCloudMeta({
      initialized:true,
      deviceTrusted:true,
      pending:false,
      lastSyncedAt:legacy.updatedAt||legacy.value.savedAt||new Date().toISOString(),
      lastAutoSyncAt:new Date().toISOString(),
      lastAutoSyncReason:`legacy-cloud-${reason}`
    });
    renderCurrentPageForSections(['manual_transactions','imported_transactions','installments','card_payment_plan','cash_flow_ledger','outgoings','categories']);
    cloudSetStatus(`Cloud snapshot loaded • ${new Date().toLocaleTimeString()}`);
    updateCloudSyncPanel(true);
    return true;
  }

  let rows=rowCloud;
  if(!rows.length){
    // V180: during recovery, an empty cloud MUST remain empty. Never auto-seed it
    // from this device after purge/restore; only Step 4 may publish the backup.
    if(recoveryCloudLockActive()){
      recordSyncReady=false;
      cloudSetStatus('Recovery lock active • cloud intentionally empty');
      updateCloudSyncPanel(true);
      return false;
    }
    // Only seed from local when NO valid cloud snapshot exists.
    if(!(legacy.initialized&&legacy.value)){
      rows=buildRecordSyncRowsFromState();
      if(rows.length){
        const payload=rows.map(r=>({...r,deleted_at:null}));
        const {error}=await cloudClient.from(RECORD_SYNC_TABLE)
          .upsert(payload,{onConflict:'section,record_id'});
        if(error)throw error;
        rows=await recordFetchAll();
      }
    }
  }
  if(!rows.length)return false;

  applyRecordSyncRows(rows);
  rememberRecordSyncBaseline(buildRecordSyncRowsFromState());
  rows.forEach(r=>noteCloudUpdatedAt(r.updated_at));
  const sections=[...new Set(rows.map(r=>r.section))];
  renderCurrentPageForSections(sections);

  setCloudMeta({
   initialized:true,
   deviceTrusted:true,
   pending:false,
   lastSyncedAt:new Date(recordSyncLastCloudUpdatedAt||Date.now()).toISOString(),
   lastAutoSyncAt:new Date().toISOString(),
   lastAutoSyncReason:`full-${reason}`
  });
  cloudSetStatus(`Cloud loaded • ${new Date().toLocaleTimeString()}`);
  updateCloudSyncPanel(true);
  return true;
 }catch(e){
  console.warn('Full cloud pull failed',e);
  cloudSetStatus('Cloud load retry pending • '+e.message);
  return false;
 }finally{
  recordSyncPullBusy=false;
 }
}

async function recordPushAll(reason='edit'){
 if(recordSyncApplying)return false;
 if(!recordSyncReady||!cloudClient){
  setCloudMeta({pending:true});
  clearTimeout(recordSyncPushTimer);
  recordSyncPushTimer=setTimeout(()=>recordPushAll(reason+'-readiness'),1500);
  return false;
 }
 // If an edit arrives while a push is already running, queue one guaranteed retry.
 // Previously the scheduled call could return here and leave Local Changes stuck Pending.
 if(recordSyncPushBusy){
  clearTimeout(recordSyncPushTimer);
  recordSyncPushTimer=setTimeout(()=>recordPushAll(reason+'-queued'),400);
  return false;
 }
 recordSyncPushBusy=true;
 try{
  const {data:{session}}=await cloudClient.auth.getSession();
  if(!session){
   setCloudMeta({pending:true});
   cloudSetStatus('Publish waiting for cloud sign-in');
   clearTimeout(recordSyncPushTimer);
   recordSyncPushTimer=setTimeout(()=>recordPushAll(reason+'-auth'),2000);
   return false;
  }

  const before=await recordFetchAll();
  const cloudMap=new Map(before.map(r=>[`${r.section}|${r.record_id}`,r]));
  const baseline=recordSyncBaseline();
  let current=buildRecordSyncRowsFromState();
  if(!Object.keys(baseline).length){
   // Upgrading an existing device must not treat all cached rows as new edits.
   rememberRecordSyncBaseline(current);
  }
  // Pull cloud edits only where this browser has not changed that record since
  // its baseline. This includes cloud-side reconciliation and other devices.
  const safeRemote=before.filter(r=>{
   const key=`${r.section}|${r.record_id}`;
   const local=current.find(x=>`${x.section}|${x.record_id}`===key);
   if(!local||baseline[key]===undefined)return false;
   const old=syncRecordValue(JSON.parse(baseline[key]));
   return old===syncRecordValue(local.data)&&(!!r.deleted_at||old!==syncRecordValue(r.data));
  });
  if(safeRemote.length){
   applyRecordSyncDeltaRows(safeRemote,{render:true});
   current=buildRecordSyncRowsFromState();
   rememberRemoteRecordBaseline(safeRemote.filter(r=>{
    const local=current.find(x=>x.section===r.section&&x.record_id===r.record_id);
    return r.deleted_at?!local:local&&syncRecordValue(local.data)===syncRecordValue(r.data);
   }));
  }
  const currentKeys=new Set(current.map(r=>`${r.section}|${r.record_id}`));
  if(recordPendingDeletes.length){
   const deletedAt=new Date().toISOString();
   const tombstones=recordPendingDeletes.map(x=>({section:x.section,record_id:String(x.record_id),data:{},deleted_at:deletedAt}));
   tombstones.forEach(r=>markLocalRecordWrite(r.section,r.record_id));
   const {error:deleteError}=await cloudClient.from(RECORD_SYNC_TABLE).upsert(tombstones,{onConflict:'section,record_id'});
   if(deleteError)throw deleteError;
   // Keep the durable queue until a subsequent read confirms the tombstones.
  }

  const conflicts=[];
  const upserts=current.filter(r=>{
   const key=`${r.section}|${r.record_id}`,cloud=cloudMap.get(key);
   if(!cloud)return true;
   // Deletion is authoritative until the user explicitly creates a new ID.
   // A stale device must never resurrect a tombstoned record through a bulk push.
   if(cloud.deleted_at)return false;
   // Another device may have already published this exact edit while this
   // browser still holds an older baseline. Matching values are reconciled.
   if(syncRecordValue(cloud.data)===syncRecordValue(r.data))return false;
   const old=baseline[key]===undefined?undefined:syncRecordValue(JSON.parse(baseline[key]));
   if(old===undefined || old===syncRecordValue(r.data)){conflicts.push(key);return false;}
   if(syncRecordValue(cloud.data)!==old){conflicts.push(key);return false;}
   return true;
  }).map(r=>({...r,deleted_at:null}));
  if(conflicts.length){
   setCloudMeta({pending:true,reconciliationMismatch:true});
   cloudSetStatus(`Sync conflict • ${conflicts.length} record(s) changed on two devices. Review differences.`);
   if(activeViewId()==='cloudSync')renderCloudReconciliation();
   return false;
  }
  upserts.forEach(r=>markLocalRecordWrite(r.section,r.record_id));
  if(upserts.length){
   const {error}=await cloudClient.from(RECORD_SYNC_TABLE)
    .upsert(upserts,{onConflict:'section,record_id'});
   if(error)throw error;
  }

  const verified=await recordFetchAll();
  if(recordPendingDeletes.length){
   const verifiedMap=new Map(verified.map(r=>[`${r.section}|${r.record_id}`,r]));
   recordPendingDeletes=recordPendingDeletes.filter(x=>!verifiedMap.get(`${x.section}|${x.record_id}`)?.deleted_at);
   saveRecordDeleteQueue();
   if(recordPendingDeletes.length){
    setCloudMeta({pending:true});
    cloudSetStatus(`Deletion pending • ${recordPendingDeletes.length} record(s) still unconfirmed`);
    return false;
   }
  }
  const activeKeys=new Set(verified.filter(r=>!r.deleted_at).map(r=>`${r.section}|${r.record_id}`));
  const missing=[...currentKeys].filter(k=>!activeKeys.has(k));
  let unexpected=[...activeKeys].filter(k=>!currentKeys.has(k));
  if(!missing.length && unexpected.length){
   await recoverCloudOnlyRecords();
   const recoveredKeys=new Set(buildRecordSyncRowsFromState().map(r=>`${r.section}|${r.record_id}`));
   unexpected=[...activeKeys].filter(k=>!recoveredKeys.has(k));
  }
  if(missing.length||unexpected.length){
   setCloudMeta({pending:missing.length>0,reconciliationMismatch:true});
   cloudSetStatus(`Cloud reconciliation needed • ${missing.length} missing • ${unexpected.length} cloud-only records`);
   if(activeViewId()==='cloudSync')renderCloudReconciliation();
   return false;
  }
  const localVerified=new Map(buildRecordSyncRowsFromState().map(r=>[`${r.section}|${r.record_id}`,r]));
  const differing=verified.filter(r=>!r.deleted_at&&localVerified.has(`${r.section}|${r.record_id}`)
   &&syncRecordValue(r.data)!==syncRecordValue(localVerified.get(`${r.section}|${r.record_id}`).data));
  if(differing.length){
   setCloudMeta({pending:true,reconciliationMismatch:true});
   cloudSetStatus(`Sync reconciliation needed • ${differing.length} records have different values`);
   if(activeViewId()==='cloudSync')renderCloudReconciliation();
   return false;
  }
  rememberRecordSyncBaseline(buildRecordSyncRowsFromState());

  // V186 PROTECTION: a normal full-device save is additive/update-only.
  // Never infer cloud deletions merely because a row is missing from this device.
  // This prevents an older/stale second machine from tombstoning valid canonical rows.
  // Explicit user delete actions must use recordImmediateDelete / their dedicated delete path.

  setCloudMeta({
   initialized:true,
   deviceTrusted:true,
   pending:false,
   reconciliationMismatch:false,
   lastSyncedAt:new Date().toISOString(),
   lastAutoSyncAt:new Date().toISOString(),
   lastAutoSyncReason:`record-${reason}`
  });
  financeSettingsDirty=false;
  cloudSetStatus(`Change published and reconciled • ${new Date().toLocaleTimeString()}`);

  // No post-push full pull. Realtime echo is muted for this local write.
  return true;
 }catch(e){
  console.warn('Record push failed',e);
  setCloudMeta({pending:true});
  cloudSetStatus('Publish retry pending • '+e.message);
  return false;
 }finally{
  recordSyncPushBusy=false;
 }
}

const RECORD_SYNC_BASELINE_KEY='pf_record_sync_baseline_v313';
function recordSyncBaseline(){
 try{return JSON.parse(localStorage.getItem(RECORD_SYNC_BASELINE_KEY)||'{}')||{}}catch(_){return {}}
}
function rememberRecordSyncBaseline(rows){
 const baseline={};(rows||[]).forEach(r=>{baseline[`${r.section}|${r.record_id}`]=syncRecordValue(r.data)});
 localStorage.setItem(RECORD_SYNC_BASELINE_KEY,JSON.stringify(baseline));
}
function rememberRemoteRecordBaseline(rows){
 const baseline=recordSyncBaseline();
 (rows||[]).forEach(r=>{
  const key=`${r.section}|${r.record_id}`;
  if(r.deleted_at)delete baseline[key];else baseline[key]=syncRecordValue(r.data);
 });
 localStorage.setItem(RECORD_SYNC_BASELINE_KEY,JSON.stringify(baseline));
}


async function recordImmediateUpsert(section,recordId,data,reason='direct-write'){
 if(!cloudClient){
  scheduleRecordPush(reason);return false;
 }
 try{
  const {data:{session}}=await cloudClient.auth.getSession();
  if(!session||!recordSyncReady){
   scheduleRecordPush(reason);return false;
  }

  const row={section,record_id:String(recordId),data,deleted_at:null};
  markLocalRecordWrite(section,recordId);

  const {error}=await cloudClient.from(RECORD_SYNC_TABLE)
   .upsert(row,{onConflict:'section,record_id'});
  if(error)throw error;

  setCloudMeta({
   initialized:true,deviceTrusted:true,pending:getCloudMeta().pending,
   lastSyncedAt:new Date().toISOString(),
   lastAutoSyncAt:new Date().toISOString(),
   lastAutoSyncReason:`immediate-${reason}`
  });
  cloudSetStatus(`${getCloudMeta().reconciliationMismatch?'Record saved • cloud reconciliation needed':'Record saved • full sync pending verification'} • ${new Date().toLocaleTimeString()}`);
  return true;
 }catch(e){
  console.warn('Immediate record sync failed',section,recordId,e);
  setCloudMeta({pending:true});
  cloudSetStatus('Sync pending • '+e.message);
  scheduleRecordPush(reason);
  return false;
 }
}

async function recordImmediateDelete(section,recordId,reason='direct-delete'){
 queueRecordDelete(section,recordId);
 if(!cloudClient||!recordSyncReady){scheduleRecordPush(reason);return false}
 try{
  const {data:{session}}=await cloudClient.auth.getSession();
  if(!session){scheduleRecordPush(reason);return false}
  const row={section,record_id:String(recordId),data:{},deleted_at:new Date().toISOString()};
  markLocalRecordWrite(section,recordId);
  const {error}=await cloudClient.from(RECORD_SYNC_TABLE).upsert(row,{onConflict:'section,record_id'});
  if(error)throw error;
  recordPendingDeletes=recordPendingDeletes.filter(x=>!(x.section===section&&String(x.record_id)===String(recordId)));saveRecordDeleteQueue();
  setCloudMeta({initialized:true,deviceTrusted:true,pending:getCloudMeta().pending,lastSyncedAt:new Date().toISOString(),lastAutoSyncAt:new Date().toISOString(),lastAutoSyncReason:`immediate-${reason}`});
  cloudSetStatus(`${getCloudMeta().reconciliationMismatch?'Deletion saved • cloud reconciliation needed':'Deletion saved • full sync pending verification'} • ${new Date().toLocaleTimeString()}`);return true;
 }catch(e){
  console.warn('Immediate record delete failed',section,recordId,e);setCloudMeta({pending:true});cloudSetStatus('Deletion sync pending • '+e.message);scheduleRecordPush(reason);return false;
 }
}

async function recordImmediateBatch(section,records,reason='batch-write'){
 if(!Array.isArray(records)||!records.length)return true;
 if(!cloudClient){
  scheduleRecordPush(reason);return false;
 }
 try{
  const {data:{session}}=await cloudClient.auth.getSession();
  if(!session||!recordSyncReady){
   scheduleRecordPush(reason);return false;
  }

  const rows=records.map((x,i)=>({
   section,
   record_id:syncStableId(section,x,i),
   data:x,
   deleted_at:null
  }));
  rows.forEach(r=>markLocalRecordWrite(r.section,r.record_id));

  const {error}=await cloudClient.from(RECORD_SYNC_TABLE)
   .upsert(rows,{onConflict:'section,record_id'});
  if(error)throw error;

  setCloudMeta({
   initialized:true,deviceTrusted:true,pending:getCloudMeta().pending,
   lastSyncedAt:new Date().toISOString(),
   lastAutoSyncAt:new Date().toISOString(),
   lastAutoSyncReason:`immediate-${reason}`
  });
  cloudSetStatus(`${getCloudMeta().reconciliationMismatch?'Records saved • cloud reconciliation needed':'Records saved • full sync pending verification'} • ${new Date().toLocaleTimeString()}`);
  return true;
 }catch(e){
  console.warn('Immediate batch sync failed',section,e);
  setCloudMeta({pending:true});
  cloudSetStatus('Sync pending • '+e.message);
  scheduleRecordPush(reason);
  return false;
 }
}

function syncManualTransactionImmediate(tx){
 if(!tx)return;
 recordImmediateUpsert('manual_transactions',syncStableId('manual_transactions',tx,0),tx,'manual-transaction');
}
function syncImportedTransactionsImmediate(rows){
 if(!rows?.length)return;
 recordImmediateBatch('imported_transactions',rows,'imported-transactions');
}
function syncTransactionActionsImmediate(){
 recordImmediateUpsert('transaction_actions',RECORD_SYNC_SINGLETON,transactionActions||{},'transaction-actions');
}
function syncTransactionOverridesImmediate(){
 recordImmediateUpsert('tx_overrides',RECORD_SYNC_SINGLETON,txOverrides||{},'transaction-overrides');
}
function syncCardPaymentPlanImmediate(){
 recordImmediateBatch('card_payment_plan',cardPaymentPlan,'card-payment-plan');
}
function syncCashFlowLedgerImmediate(){
 recordImmediateBatch('cash_flow_ledger',cashFlowLedger,'cash-flow-ledger');
}



function scheduleRecordPush(reason='edit'){
 setCloudMeta({pending:true});
 clearTimeout(recordSyncPushTimer);
 const delay=window.__financeStateInitialized===true?250:900;
 recordSyncPushTimer=setTimeout(()=>{
  if(window.__financeStateInitialized!==true){scheduleRecordPush(reason+'-startup');return;}
  // A local save may occur while a realtime row is being applied. Keep the
  // pending write queued until that short critical section completes.
  if(recordSyncApplying){scheduleRecordPush(reason+'-after-apply');return;}
  recordPushAll(reason);
 },delay);
}


async function handleRealtimeRecordPayload(payload){
 try{
  const row=payload?.new&&Object.keys(payload.new).length?payload.new:payload?.old;
  if(!row?.section||row.record_id==null)return;

  noteCloudUpdatedAt(row.updated_at);

  // Ignore the realtime echo of this device's own very recent write.
  if(isMutedRealtimeRecord(row.section,row.record_id))return;

  const result=applyRecordSyncDeltaRows([row],{render:true});
  if(result.changed){
   setCloudMeta({
    initialized:true,
    deviceTrusted:true,
    pending:false,
    lastSyncedAt:new Date(recordSyncLastCloudUpdatedAt||Date.now()).toISOString(),
    lastAutoSyncAt:new Date().toISOString(),
    lastAutoSyncReason:'realtime-delta'
   });
   cloudSetStatus(`Realtime update • ${new Date().toLocaleTimeString()}`);
   updateCloudSyncPanel(true);
  }
 }catch(e){
  console.warn('Realtime delta apply failed',e);
  cloudSetStatus('Realtime delta retry pending • '+e.message);
 }
}

async function startRealtimeRecordSync(){
 if(!cloudClient)return false;
 const {data:{session}}=await cloudClient.auth.getSession();
 if(!session){
  recordSyncReady=false;
  return false;
 }

 if(!financeProtectedAccountCatalogReady()){
  recordSyncReady=false;
  cloudSetStatus('Protected • load the account catalogue from cloud before synchronization');
  setFinanceAccessGate(session);
  return false;
 }

 // V187: NEVER download/apply cloud records automatically on startup or page refresh.
 // Local screen state remains untouched until the user explicitly presses Load Latest Cloud Data.
 // This prevents a stale/partial cloud dataset from clearing newly entered transactions.
 const meta=getCloudMeta();
 const verifiedCloudLoad=localStorage.getItem('pf_v185_authoritative_cloud_loaded')==='1';
 // V225: an already-initialized trusted source device must keep publishing after an
 // upgrade. New/untrusted devices still require one verified manual cloud load.
 recordSyncReady=!recoveryCloudLockActive() && (verifiedCloudLoad || (meta.initialized&&meta.deviceTrusted));
 if(recordSyncReady && !Object.keys(recordSyncBaseline()).length)rememberRecordSyncBaseline(buildRecordSyncRowsFromState());
 cloudSetStatus(recordSyncReady?'Protected sync ready • local edits publish automatically':'Protected • use Load Latest Cloud Data once on this device');

 if(legacyPlannerCleanupPending){
  // Do not publish cleanup from an unverified device. It can be handled after manual load.
  legacyPlannerCleanupPending=false;
 }

 // V284 protected two-way mode: local edits publish immediately. Remote changes are
 // received through guarded realtime deltas, while the existing 30-second verifier
 // remains as a fallback. The delta handler never replaces the full local database.
 if(recordSyncChannel){try{await cloudClient.removeChannel(recordSyncChannel);}catch(_){} recordSyncChannel=null;}
 if(recordSyncReady){
  recordSyncChannel=cloudClient.channel('finance-sync-records-v284')
   .on('postgres_changes',{event:'*',schema:'public',table:RECORD_SYNC_TABLE},handleRealtimeRecordPayload)
   .subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')cloudSetStatus('Realtime reconnect pending • protected polling remains active');});
 }

 schedulePeriodicCloudAutoSync();
 if(recordSyncReady&&getCloudMeta().pending)setTimeout(()=>recordPushAll('resume-pending'),120);
 cloudSetStatus(`${verifiedCloudLoad?'Protected two-way sync':'Upload sync'} ready • ${new Date().toLocaleTimeString()}`);
 return true;
}
// ===================================================================

function financeProtectedAccountCatalogReady(){
 return typeof customBanks!=='undefined'&&Array.isArray(customBanks)&&customBanks.length>0&&
        typeof customCreditCards!=='undefined'&&Array.isArray(customCreditCards)&&customCreditCards.length>0;
}
function financeDeviceCloudVerified(){
 return localStorage.getItem('pf_v185_authoritative_cloud_loaded')==='1'&&financeProtectedAccountCatalogReady();
}
function setFinanceAccessGate(session){
 const gate=$('financeAccessGate');if(!gate)return;
 const signedIn=!!session,ready=signedIn&&financeDeviceCloudVerified();
 gate.classList.toggle('financeGateHidden',ready);
 gate.setAttribute('aria-hidden',ready?'true':'false');
 document.body.classList.toggle('financeAccessLocked',!ready);
 const main=document.querySelector('body>.app>.main');
 if(main){main.toggleAttribute('inert',!ready);main.setAttribute('aria-hidden',ready?'false':'true');}
 const avatar=document.querySelector('#canonicalAppTop .canonicalAvatar');
 const profile=document.querySelector('#canonicalAppTop [data-profile-menu]');
 if(avatar){
  avatar.disabled=!ready;
  avatar.setAttribute('aria-disabled',ready?'false':'true');
  avatar.title=ready?'Open profile menu':'Profile is available after sign in';
 }
 if(profile&&!ready){
  profile.classList.remove('open');
  avatar?.setAttribute('aria-expanded','false');
 }
 const out=$('financeGateSignedOut'),inside=$('financeGateSignedIn');
 if(out)out.style.display=signedIn?'none':'block';
 if(inside)inside.style.display=signedIn?'block':'none';
 const user=$('financeGateUser');if(user&&signedIn)user.textContent=session.user?.email||'Authenticated owner';
}
async function financeSignOutCurrentDevice(){
 const status=$('financeGateStatus');
 try{
  if(!cloudClient)throw new Error('Cloud connection is unavailable.');
  if(recordSyncChannel){try{await cloudClient.removeChannel(recordSyncChannel);}catch(_){} recordSyncChannel=null;}
  recordSyncReady=false;
  const {error}=await cloudClient.auth.signOut({scope:'local'});
  if(error)throw error;
  await cloudRefreshAuth();
  updateCloudSyncPanel(false);
  if(typeof nav==='function')nav('executive');
  if(status)status.textContent='Signed out on this device. Navigation remains available; finance data and actions are hidden.';
 }catch(e){
  if(status)status.textContent='Sign out error: '+e.message;
  cloudSetStatus('Sign out error: '+e.message);
 }
}
function bindFinanceAccessGate(){
 const send=$('financeGateSendLink'),load=$('financeGateLoadCloud'),wipe=$('financeGateWipeDevice'),email=$('financeGateEmail'),status=$('financeGateStatus');
 if(send&&!send.dataset.bound){send.dataset.bound='1';send.onclick=async()=>{
  const address=String(email?.value||'').trim();if(!address){if(status)status.textContent='Enter your email first.';return;}
  send.disabled=true;if(status)status.textContent='Sending secure login link…';
  try{
   if(!cloudClient)throw new Error('Cloud connection is unavailable.');
   const {error}=await cloudClient.auth.signInWithOtp({email:address,options:{emailRedirectTo:window.location.origin+window.location.pathname}});
   if(error)throw error;
   if(status)status.textContent='Secure login link sent. Check your email.';
  }catch(e){if(status)status.textContent='Login error: '+e.message;}
  finally{send.disabled=false;}
 };}
 if(load&&!load.dataset.bound){load.dataset.bound='1';load.onclick=async()=>{
  load.disabled=true;if(status)status.textContent='Loading your protected account catalogue and finance records…';
  try{
   await cloudDownloadAll();
   const {data:{session}}=await cloudClient.auth.getSession();
   if(financeDeviceCloudVerified()){if(status)status.textContent='Protected cloud data loaded and verified.';setFinanceAccessGate(session);}
   else if(status)status.textContent='Cloud load did not complete. Your local data was not published.';
  }catch(e){if(status)status.textContent='Cloud load failed: '+e.message;}
  finally{load.disabled=false;}
 };}
 if(wipe&&!wipe.dataset.bound){wipe.dataset.bound='1';wipe.onclick=async()=>{
  if(!confirm('Wipe finance data stored only on this device? Protected cloud data will not be deleted.'))return;
  wipe.disabled=true;if(status)status.textContent='Wiping this device only…';
  Object.keys(localStorage).filter(k=>k.startsWith('pf_')).forEach(k=>localStorage.removeItem(k));
  try{await new Promise(resolve=>{const req=indexedDB.deleteDatabase('PersonalFinanceDB');req.onsuccess=req.onerror=req.onblocked=()=>resolve();});}catch(_){}
  location.reload();
 };}
}
bindFinanceAccessGate();

async function cloudRefreshAuth(){
 if(!cloudClient){
  if($('cloudLoggedOut'))$('cloudLoggedOut').style.display='block';
  if($('cloudLoggedIn'))$('cloudLoggedIn').style.display='none';
  cloudSetStatus('Local cache mode • Realtime cloud library unavailable.');
  return null;
 }
 const {data:{session}}=await cloudClient.auth.getSession(),on=!!session;
 setFinanceAccessGate(session);
 $('cloudLoggedOut').style.display=on?'none':'block';
 $('cloudLoggedIn').style.display=on?'block':'none';
 if(on){
  $('cloudUser').textContent='Signed in as '+(session.user.email||session.user.id);
  cloudSetStatus('Authenticated • loading canonical realtime cloud data…');
  if(window.__financeInitComplete===true)setTimeout(()=>startRealtimeRecordSync(),50);
 }else{
  recordSyncReady=false;
  cloudSetStatus('Connected to Supabase • sign in to access your finance database');
 }
 return session;
}
async function cloudClaim(){
 const {error}=await cloudClient.rpc('claim_finance_database');
 $('cloudResult').textContent=error?'Claim failed: '+error.message:'Finance database ownership verified.';
}
function cloudAccountRows(){return accounts.map(a=>({
 id:a.id,bank:a.bank,name:a.name,ending:a.ending||null,type:a.type,balance:Number(a.balance||0),
 balance_label:a.balanceLabel||null,credit_limit:Number(a.extra?.['Credit Limit']||0)||null,
 bank_available:a.extra?.['Bank Available']!=null?Number(a.extra['Bank Available']):null,
 current_outstanding:a.extra?.['Current Outstanding']!=null?Number(a.extra['Current Outstanding']):null,
 extra:a.extra||{}
}));}
function cloudTxRows(){return normalizedTx(true).map(t=>({id:t._id,account_id:t.account,physical_card_ending:t.physicalCardEnding||null,transaction_date:t.date,posting_date:t.posting||null,description:t.description,amount:Number(t.amount||0),currency:t.currency||'SAR',category:t.category||null,subcategory:t.subcategory||null,kind:t.kind||null,source:t.source||null,note:t.note||null,statement_month:t.statementMonth||null,is_manual:!!t.manual,is_imported:!!t.imported,status:transactionActions[t._id]?.status||'active'}));}
function cloudInstRows(){return installments.map(p=>({id:p.id,card_id:p.cardId,linked_transaction_id:p.linkedTransactionId||null,description:p.description,category:p.category||null,subcategory:p.subcategory||null,original_amount:Number(p.fullAmount||0),months:Number(p.months||1),start_month:p.startMonth||null,paid_installments:Number(p.paidInstallments||0),manual_remaining:p.manualRemaining!=null?Number(p.manualRemaining):null,monthly_fee:Number(p.monthlyFee||0),source:p.source||null,plan_type:p.planType||'purchase',status:'active'}));}
function cloudPayRows(){return cardPaymentPlan.map(p=>({id:p.id,account_id:p.accountId,payment_month:p.month,amount:p.amount==null?null:Number(p.amount),due_date:p.due||null,label:p.label||null,source:p.source||null,note:JSON.stringify({note:p.note||'',paidAmount:Number(p.paidAmount||0),paymentHistory:p.paymentHistory||[],upcomingOnly:!!p.upcomingOnly}),paid:!!p.paid}));}
async function cloudUpsert(table,rows){for(let i=0;i<rows.length;i+=100){const {error}=await cloudClient.from(table).upsert(rows.slice(i,i+100));if(error)throw new Error(table+': '+error.message);}}






function getCloudMeta(){
 try{return {...{initialized:false,deviceTrusted:false,lastSyncedAt:'',pending:false},...(JSON.parse(localStorage.getItem(CLOUD_META_KEY)||'{}')||{})};}
 catch(_){return {initialized:false,deviceTrusted:false,lastSyncedAt:'',pending:false};}
}
function setCloudMeta(patch){
 const next={...getCloudMeta(),...patch};
 localStorage.setItem(CLOUD_META_KEY,JSON.stringify(next));
 updateCloudSyncPanel();
 return next;
}
function localSyncSummary(){
 const tx=normalizedTx(true);
 const deleted=tx.filter(t=>transactionActions[t._id]?.status==='deleted');
 const excluded=tx.filter(t=>transactionActions[t._id]?.status==='excluded-duplicate');
 const activeTx=tx.filter(t=>transactionActions[t._id]?.status!=='deleted');

 return {
  accounts:accounts.length,
  transactions:activeTx.length,
  transportRows:tx.length,
  deletedAuditRows:deleted.length,
  excludedDuplicateRows:excluded.length,
  manual:manualTransactions.length,
  imported:importedTransactions.length,
  installments:installments.length,
  paymentRows:cardPaymentPlan.length,
  outgoings:outgoings.length,
  categories:Object.keys(categories||{}).length,
  cashFlowRows:(cashFlowLedger||[]).filter(x=>x.status!=='reversed').length
 };
}

function syncSummaryFromSnapshot(s){
 if(!s||typeof s!=='object')return null;
 const actions=s.transactionActions||{};
 const resetIds=new Set(Array.isArray(s.resetCardIds)?s.resetCardIds:[]);
 const baseRows=BASE.transactions
  .map((t,i)=>({...t,_id:'tx'+i}))
  .filter(t=>!resetIds.has(t.account));
 const imported=(s.importedTransactions||[]).map((t,i)=>({...t,_id:t._id||('import'+i)}));
 const manual=(s.manualTransactions||[]).map((t,i)=>({...t,_id:t._id||('manual'+i)}));
 const rows=[...baseRows,...imported,...manual];
 const deleted=rows.filter(t=>actions[t._id]?.status==='deleted');
 const excluded=rows.filter(t=>actions[t._id]?.status==='excluded-duplicate');
 const active=rows.filter(t=>actions[t._id]?.status!=='deleted');

 return {
  accounts:accounts.length,
  transactions:active.length,
  transportRows:rows.length,
  deletedAuditRows:deleted.length,
  excludedDuplicateRows:excluded.length,
  manual:manual.length,
  imported:imported.length,
  installments:(s.installments||[]).length,
  paymentRows:(s.cardPaymentPlan||[]).length,
  outgoings:(s.outgoings||[]).length,
  categories:Object.keys(s.categories||{}).length,
  cashFlowRows:(s.cashFlowLedger||[]).filter(x=>x.status!=='reversed').length
 };
}

function compareSyncSummaries(local,cloud){
 if(!local||!cloud)return {match:false,differences:['Cloud summary unavailable']};
 const fields=['accounts','transactions','manual','imported','installments','paymentRows','outgoings','categories','cashFlowRows','deletedAuditRows','excludedDuplicateRows'];
 const differences=fields
  .filter(k=>Number(local[k]||0)!==Number(cloud[k]||0))
  .map(k=>`${k}: local ${Number(local[k]||0)} / cloud ${Number(cloud[k]||0)}`);
 return {match:differences.length===0,differences};
}
function renderLocalSyncSummary(){
 const el=$('cloudLocalSummary'); if(!el)return;
 const x=localSyncSummary();
 el.innerHTML=`<b>Local data on this device:</b> ${x.accounts} accounts • <b>${x.transactions} active transactions</b> (${x.manual} manual / ${x.imported} imported) • ${x.deletedAuditRows} deleted audit row${x.deletedAuditRows===1?'':'s'} • ${x.excludedDuplicateRows} duplicate-excluded row${x.excludedDuplicateRows===1?'':'s'} • ${x.installments} installments • ${x.paymentRows} payment-plan rows • ${x.cashFlowRows} cash-flow rows • ${x.outgoings} outgoings • ${x.categories} category groups.<div class="meta" style="margin-top:5px">Cloud transport may contain ${x.transportRows} transaction rows because deleted/audit records are preserved for history. Only ${x.transactions} are active.</div>`;
}

async function renderCloudReconciliation(){
 const el=$('cloudReconciliation');
 if(!el||!cloudClient)return;
 const {data:{session}}=await cloudClient.auth.getSession();
 if(!session){el.innerHTML='<b>Local vs Cloud:</b> Sign in to compare.';return;}
 try{
  const cloudRows=await recordFetchAll();
  const active=cloudRows.filter(r=>!r.deleted_at);
  if(!active.length){el.className='notice danger';el.innerHTML='<b>Local vs Cloud:</b> No active cloud records found.';return;}
  const localRows=buildRecordSyncRowsFromState();
  const key=r=>`${r.section}|${r.record_id}`;
  const localMap=new Map(localRows.map(r=>[key(r),r]));
  const cloudMap=new Map(active.map(r=>[key(r),r]));
  const missing=[...localMap.keys()].filter(k=>!cloudMap.has(k));
  const unexpected=[...cloudMap.keys()].filter(k=>!localMap.has(k));
  const stable=v=>{
   if(Array.isArray(v))return v.map(stable);
   if(v&&typeof v==='object'){
    const o={}; Object.keys(v).sort().forEach(k=>{o[k]=stable(v[k])}); return o;
   }
   return v;
  };
  const same=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
  const fieldDiffs=(a,b,path='')=>{
   const out=[],aa=(a&&typeof a==='object')?a:{},bb=(b&&typeof b==='object')?b:{};
   [...new Set([...Object.keys(aa),...Object.keys(bb)])].sort().forEach(k=>{
    const p=path?path+'.'+k:k, av=aa[k], bv=bb[k];
    if(same(av,bv))return;
    if(av&&bv&&!Array.isArray(av)&&!Array.isArray(bv)&&typeof av==='object'&&typeof bv==='object')out.push(...fieldDiffs(av,bv,p));
    else out.push({field:p,local:av,cloud:bv});
   }); return out;
  };
  const different=[...localMap.keys()].filter(k=>cloudMap.has(k)&&!same(localMap.get(k).data,cloudMap.get(k).data));
  const detail=different.map(k=>({key:k,section:localMap.get(k).section,recordId:localMap.get(k).record_id,diffs:fieldDiffs(localMap.get(k).data,cloudMap.get(k).data)}));
  const local=localSyncSummary();
  const mismatch=!!(missing.length||unexpected.length||different.length);
  localStorage.setItem(CLOUD_META_KEY,JSON.stringify({...getCloudMeta(),reconciliationMismatch:mismatch}));
  if($('cloudPendingState'))$('cloudPendingState').textContent=mismatch?'Reconciliation needed':getCloudMeta().pending?'Pending':'Protected Auto Sync • Up to Date';
  if(!missing.length&&!unexpected.length&&!different.length){
   el.className='notice success';
   el.innerHTML=`<b>Local vs Cloud: EXACT MATCH</b> • ${active.length} canonical records • ${local.transactions} active transactions • ${local.installments} installments • ${local.paymentRows} payment-plan rows • ${local.cashFlowRows} active cash-flow rows.<div class="meta" style="margin-top:5px">Every local record key and value matches the live cloud database.</div>`;
  }else{
   const esc=v=>String(v==null?'':(typeof v==='object'?JSON.stringify(v):v)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
   const rows=detail.flatMap(x=>x.diffs.map(d=>`<tr><td>${esc(x.section)}</td><td>${esc(x.recordId)}</td><td>${esc(d.field)}</td><td><code>${esc(d.local)}</code></td><td><code>${esc(d.cloud)}</code></td></tr>`)).slice(0,500).join('');
   const missingRows=missing.slice(0,50).map(k=>`<li>Missing in cloud: <code>${esc(k)}</code></li>`).join('');
   const unexpectedRows=unexpected.slice(0,100).map(k=>`<li>Cloud only: <code>${esc(k)}</code></li>`).join('');
   const cloudActions=cloudMap.get(`transaction_actions|${RECORD_SYNC_SINGLETON}`)?.data||{};
   const cloudOnlyRows=unexpected.map(k=>{
    const r=cloudMap.get(k),d=r?.data||{},action=cloudActions[r?.record_id]?.status||'';
    const date=d.date||d.transactionDate||d.importedAt||d.createdAt||'';
    const accountId=d.account||d.accountId||d.sourceId||d.cardId||'';
    const description=d.description||d.label||d.fileName||d.name||'';
    const amount=d.amount??d.fullAmount??'';
    return `<tr><td>${esc(r.section)}</td><td><code>${esc(r.record_id)}</code></td><td>${esc(date)}</td><td>${esc(accountId)}</td><td>${esc(description)}</td><td>${esc(amount)}</td><td>${esc(action||'—')}</td></tr>`;
   }).join('');
   const bySection={};unexpected.forEach(k=>{const section=k.split('|')[0];bySection[section]=(bySection[section]||0)+1});
   const sectionSummary=Object.entries(bySection).sort((a,b)=>b[1]-a[1]).map(([section,count])=>`${esc(section)}: ${count}`).join(' • ');
   el.className='notice danger';
   el.innerHTML=`<b>⚠ Local vs Cloud: DATA MISMATCH</b><div class="meta" style="margin-top:5px">${missing.length} missing • ${unexpected.length} unexpected • ${different.length} records with value differences.</div><div class="meta" style="margin-top:5px">Cloud-only records by dataset: ${sectionSummary||'none'}.</div><button type="button" class="btn" id="cloudDiffToggle" style="margin-top:10px">View Differences</button><div id="cloudDiffDetails" style="display:none;margin-top:10px;max-height:420px;overflow:auto"><div class="meta">Cloud-only records are shown for review. A deleted audit status means the transaction should not be restored as active.</div><div class="tableWrap"><table class="rentalTable"><thead><tr><th>Dataset</th><th>Record</th><th>Date</th><th>Account</th><th>Description</th><th>Amount</th><th>Action status</th></tr></thead><tbody>${cloudOnlyRows||'<tr><td colspan="7">No cloud-only records.</td></tr>'}</tbody></table></div><ul style="margin:10px 0 10px 18px">${missingRows}${unexpectedRows}</ul><div class="tableWrap"><table class="rentalTable"><thead><tr><th>Dataset</th><th>Record</th><th>Field</th><th>MacBook / Local</th><th>Cloud</th></tr></thead><tbody>${rows||'<tr><td colspan="5">No field-level value differences.</td></tr>'}</tbody></table></div><div class="meta" style="margin-top:8px">Read-only diagnostic. No local or cloud records are changed. Showing up to 500 field differences.</div></div>`;
   const b=$('cloudDiffToggle'),d=$('cloudDiffDetails');if(b&&d)b.onclick=()=>{const open=d.style.display!=='none';d.style.display=open?'none':'block';b.textContent=open?'View Differences':'Hide Differences';};
  }
 }catch(e){
  el.className='notice danger';
  el.innerHTML=`<b>Local vs Cloud:</b> Check failed • ${String(e.message||e)}`;
 }
}
function updateCloudSyncPanel(remoteInitialized=null){
 const m=getCloudMeta();
 if($('cloudInitialState'))$('cloudInitialState').textContent=(remoteInitialized===true||m.initialized)?'Completed':'Not Completed';
 if($('cloudLastSynced'))$('cloudLastSynced').textContent=m.lastSyncedAt?new Date(m.lastSyncedAt).toLocaleString():'Never';
 if($('cloudPendingState'))$('cloudPendingState').textContent=m.reconciliationMismatch?'Reconciliation needed':m.pending?'Pending':'Protected Auto Sync • Up to Date';
 if($('cloudDeviceState'))$('cloudDeviceState').textContent=m.deviceTrusted?'Verified Device • Auto Two-Way':'Protected';
 const initBtn=$('cloudInitialUpload'), syncBtn=$('cloudUpload'), loadBtn=$('cloudDownload');
 if(initBtn){initBtn.style.display=(m.initialized&&m.deviceTrusted)?'none':'inline-flex';}
 if(syncBtn){syncBtn.disabled=!(m.initialized&&m.deviceTrusted);}
 if(loadBtn){loadBtn.disabled=remoteInitialized===false;}
 renderLocalSyncSummary();
 setTimeout(()=>renderCloudReconciliation(),0);
}
async function cloudInspectState(){
 if(!cloudClient)return {initialized:false,value:null,updatedAt:''};
 const {data:{session}}=await cloudClient.auth.getSession();
 if(!session)return {initialized:false,value:null,updatedAt:''};
 const {data,error}=await cloudClient.from('settings').select('value,updated_at').eq('key','app_state').maybeSingle();
 if(error){console.warn('Cloud state check failed',error);return {initialized:false,value:null,updatedAt:''};}
 const value=data?.value||null;
 return {initialized:!!(value?.syncInitialized),value,updatedAt:data?.updated_at||value?.savedAt||''};
}


const RECOVERY_KEY='pf_recovery_snapshots_v138';
const RECOVERY_LIMIT=8;

function rawLocalRecoveryState(reason='manual'){
 return {
  version:320,
  createdAt:new Date().toISOString(),
  reason,
  financeSettings:JSON.parse(JSON.stringify(financeSettings||{})),
  categories:JSON.parse(JSON.stringify(categories||{})),
  installments:JSON.parse(JSON.stringify(installments||[])),
  deletedInstallmentIds:[...deletedInstallmentIds],
  merchantRules:JSON.parse(JSON.stringify(merchantRules||{})),
  txOverrides:JSON.parse(JSON.stringify(txOverrides||{})),
  incomePlan:JSON.parse(JSON.stringify(incomePlan||{})),
  manualTransactions:JSON.parse(JSON.stringify(manualTransactions||[])),
  importedTransactions:JSON.parse(JSON.stringify(importedTransactions||[])),
  importHistory:JSON.parse(JSON.stringify(importHistory||[])),
  cashFlowLedger:JSON.parse(JSON.stringify(cashFlowLedger||[])),
  outgoings:JSON.parse(JSON.stringify(outgoings||[])),
  duplicateDecisions:JSON.parse(JSON.stringify(duplicateDecisions||{})),
  statementRule:JSON.parse(JSON.stringify(statementRule||{})),
  transactionActions:JSON.parse(JSON.stringify(transactionActions||{})),
  bankBalanceOverrides:JSON.parse(JSON.stringify(bankBalanceOverrides||{})),
  customBanks:JSON.parse(JSON.stringify(customBanks||[])),
  customCreditCards:JSON.parse(JSON.stringify(customCreditCards||[])),
  investmentsHoldings:JSON.parse(JSON.stringify(typeof invHoldings!=='undefined'?invHoldings:[])),
  investmentsTrades:JSON.parse(JSON.stringify(typeof invTrades!=='undefined'?invTrades:[])),
  rentalBookings:JSON.parse(JSON.stringify(typeof rentalBookings!=='undefined'?rentalBookings:[])),
  rentalExpenses:JSON.parse(JSON.stringify(typeof rentalExpenses!=='undefined'?rentalExpenses:[])),
  rentalBlocks:JSON.parse(JSON.stringify(typeof rentalBlocks!=='undefined'?rentalBlocks:[])),
  goldAssets:JSON.parse(JSON.stringify(typeof goldAssets!=='undefined'?goldAssets:[])),
  goldZakatHistory:JSON.parse(JSON.stringify(typeof goldZakatHistory!=='undefined'?goldZakatHistory:[])),
  goldSaleHistory:JSON.parse(JSON.stringify(typeof goldSaleHistory!=='undefined'?goldSaleHistory:[])),
  goldMarket:JSON.parse(JSON.stringify(typeof goldMarket!=='undefined'?goldMarket:{})),
  statementFormats:JSON.parse(JSON.stringify(typeof statementFormats!=='undefined'?statementFormats:[])),
  resetCardIds:[...resetCardIds],
  cardResetHistory:JSON.parse(JSON.stringify(cardResetHistory||[])),
  cardPaymentPlan:JSON.parse(JSON.stringify(cardPaymentPlan||[])),
  localSummary:localSyncSummary()
 };
}

function getRecoverySnapshots(){
 try{
  const x=JSON.parse(localStorage.getItem(RECOVERY_KEY)||'[]');
  return Array.isArray(x)?x:[];
 }catch(_){return []}
}

function saveRecoverySnapshot(reason='manual'){
 const snap=rawLocalRecoveryState(reason);
 const arr=getRecoverySnapshots();
 arr.unshift(snap);
 localStorage.setItem(RECOVERY_KEY,JSON.stringify(arr.slice(0,RECOVERY_LIMIT)));
 renderRecoveryStatus();
 return snap;
}

function renderRecoveryStatus(msg=''){
 const count=getRecoverySnapshots().length;
 if($('recoverySnapshotCount'))$('recoverySnapshotCount').textContent=`${count} local backup${count===1?'':'s'}`;
 if(msg&&$('recoveryStatus'))$('recoveryStatus').textContent=msg;
}

function persistRecoveredState(){
 localStorage.setItem('pf_finance_settings',JSON.stringify(financeSettings));
 localStorage.setItem('pf_categories',JSON.stringify(categories));
 localStorage.setItem('pf_installments',JSON.stringify(installments));
 localStorage.setItem('pf_deleted_installment_ids',JSON.stringify([...deletedInstallmentIds]));
 localStorage.setItem('pf_merchant_rules',JSON.stringify(merchantRules));
 localStorage.setItem('pf_tx_overrides',JSON.stringify(txOverrides));
 localStorage.setItem('pf_income_plan',JSON.stringify(incomePlan));
 localStorage.setItem('pf_manual_transactions',JSON.stringify(manualTransactions));
 localStorage.setItem('pf_imported_transactions',JSON.stringify(importedTransactions));
 localStorage.setItem('pf_import_history',JSON.stringify(importHistory));
 localStorage.setItem('pf_cash_flow_ledger',JSON.stringify(cashFlowLedger));
 localStorage.setItem('pf_outgoings',JSON.stringify(outgoings));
 localStorage.setItem('pf_duplicate_decisions',JSON.stringify(duplicateDecisions));
 localStorage.setItem('pf_statement_rule',JSON.stringify(statementRule));
 localStorage.setItem('pf_transaction_actions',JSON.stringify(transactionActions));
 localStorage.setItem('pf_bank_balance_overrides',JSON.stringify(bankBalanceOverrides));
 localStorage.setItem('pf_reset_card_ids',JSON.stringify([...resetCardIds]));
 localStorage.setItem('pf_card_reset_history',JSON.stringify(cardResetHistory));
 localStorage.setItem('pf_card_payment_plan',JSON.stringify(cardPaymentPlan));
 localStorage.setItem('pf_custom_banks',JSON.stringify(Array.isArray(customBanks)?customBanks:[]));
 localStorage.setItem('pf_custom_credit_cards',JSON.stringify(Array.isArray(customCreditCards)?customCreditCards:[]));
 localStorage.setItem('pf_investments_holdings',JSON.stringify(invHoldings||[]));
 localStorage.setItem('pf_investments_trades',JSON.stringify(invTrades||[]));
 localStorage.setItem('pf_rental_bookings',JSON.stringify(rentalBookings||[]));
 localStorage.setItem('pf_rental_expenses',JSON.stringify(rentalExpenses||[]));
 localStorage.setItem('pf_rental_blocks',JSON.stringify(rentalBlocks||[]));
 localStorage.setItem('pf_gold_assets',JSON.stringify(goldAssets||[]));
 localStorage.setItem('pf_gold_zakat_history',JSON.stringify(goldZakatHistory||[]));
 localStorage.setItem('pf_gold_sale_history',JSON.stringify(goldSaleHistory||[]));
 localStorage.setItem('pf_gold_market',JSON.stringify(goldMarket||{}));
 localStorage.setItem('pf_statement_formats',JSON.stringify(statementFormats||[]));
}

function applyRecoverySnapshot(snap){
 if(!snap||typeof snap!=='object')return false;
 // STRICT REPLACE: never fall back to stale in-memory values during a restore.
 financeSettings=(snap.financeSettings&&typeof snap.financeSettings==='object')?JSON.parse(JSON.stringify(snap.financeSettings)):{loans:[],cardCycles:{}};
 categories=(snap.categories&&typeof snap.categories==='object')?JSON.parse(JSON.stringify(snap.categories)):JSON.parse(JSON.stringify(BASE.categoryTree));
 installments=Array.isArray(snap.installments)?JSON.parse(JSON.stringify(snap.installments)):[];
 deletedInstallmentIds=new Set(Array.isArray(snap.deletedInstallmentIds)?snap.deletedInstallmentIds:[]);
 merchantRules=(snap.merchantRules&&typeof snap.merchantRules==='object')?JSON.parse(JSON.stringify(snap.merchantRules)):{};
 txOverrides=(snap.txOverrides&&typeof snap.txOverrides==='object')?JSON.parse(JSON.stringify(snap.txOverrides)):{};
 incomePlan=(snap.incomePlan&&typeof snap.incomePlan==='object')?JSON.parse(JSON.stringify(snap.incomePlan)):{};
 manualTransactions=Array.isArray(snap.manualTransactions)?JSON.parse(JSON.stringify(snap.manualTransactions)):[];
 importedTransactions=Array.isArray(snap.importedTransactions)?JSON.parse(JSON.stringify(snap.importedTransactions)):[];
 importHistory=Array.isArray(snap.importHistory)?JSON.parse(JSON.stringify(snap.importHistory)):[];
 cashFlowLedger=Array.isArray(snap.cashFlowLedger)?JSON.parse(JSON.stringify(snap.cashFlowLedger)):[];
 outgoings=Array.isArray(snap.outgoings)?JSON.parse(JSON.stringify(snap.outgoings)):[];
 duplicateDecisions=(snap.duplicateDecisions&&typeof snap.duplicateDecisions==='object')?JSON.parse(JSON.stringify(snap.duplicateDecisions)):{};
 statementRule=(snap.statementRule&&typeof snap.statementRule==='object')?JSON.parse(JSON.stringify(snap.statementRule)):{cutoffDay:24};
 transactionActions=(snap.transactionActions&&typeof snap.transactionActions==='object')?JSON.parse(JSON.stringify(snap.transactionActions)):{};
 bankBalanceOverrides=(snap.bankBalanceOverrides&&typeof snap.bankBalanceOverrides==='object')?JSON.parse(JSON.stringify(snap.bankBalanceOverrides)):{};
 customBanks=Array.isArray(snap.customBanks)?JSON.parse(JSON.stringify(snap.customBanks)):customBanks;
 customCreditCards=Array.isArray(snap.customCreditCards)?JSON.parse(JSON.stringify(snap.customCreditCards)):customCreditCards;
 if(Array.isArray(snap.investmentsHoldings))invHoldings=JSON.parse(JSON.stringify(snap.investmentsHoldings));
 if(Array.isArray(snap.investmentsTrades))invTrades=JSON.parse(JSON.stringify(snap.investmentsTrades));
 if(Array.isArray(snap.rentalBookings))rentalBookings=JSON.parse(JSON.stringify(snap.rentalBookings));
 if(Array.isArray(snap.rentalExpenses))rentalExpenses=JSON.parse(JSON.stringify(snap.rentalExpenses));
 if(Array.isArray(snap.rentalBlocks))rentalBlocks=JSON.parse(JSON.stringify(snap.rentalBlocks));
 if(Array.isArray(snap.goldAssets))goldAssets=JSON.parse(JSON.stringify(snap.goldAssets));
 if(Array.isArray(snap.goldZakatHistory))goldZakatHistory=JSON.parse(JSON.stringify(snap.goldZakatHistory));
 if(Array.isArray(snap.goldSaleHistory))goldSaleHistory=JSON.parse(JSON.stringify(snap.goldSaleHistory));
 if(snap.goldMarket&&typeof snap.goldMarket==='object')goldMarket=JSON.parse(JSON.stringify(snap.goldMarket));
 if(Array.isArray(snap.statementFormats))statementFormats=JSON.parse(JSON.stringify(snap.statementFormats));
 if(typeof syncCustomAccountsIntoAccounts==='function')syncCustomAccountsIntoAccounts();
 resetCardIds=new Set(Array.isArray(snap.resetCardIds)?snap.resetCardIds:[]);
 cardResetHistory=Array.isArray(snap.cardResetHistory)?JSON.parse(JSON.stringify(snap.cardResetHistory)):[];
 cardPaymentPlan=Array.isArray(snap.cardPaymentPlan)?JSON.parse(JSON.stringify(snap.cardPaymentPlan)):[];

 normalizeCardPaymentPlan();
 rebuildTransactions();
 // Do NOT seed old/built-in installments during a strict backup restore.
 ensureLedgerBackedPlannerRows();
 rebuildAllPlannerPaymentsFromLedger();
 normalizeBalanceOffers();
 ensurePartialPaymentFields();
 persistRecoveredState();
 financeDB.save();
 return true;
}

function mergeArrayById(localArr,incomingArr,keyFn){
 const map=new Map();
 (localArr||[]).forEach(x=>map.set(keyFn(x),x));
 (incomingArr||[]).forEach(x=>{
  const k=keyFn(x);
  if(!map.has(k))map.set(k,x);
  else map.set(k,{...map.get(k),...x});
 });
 return [...map.values()];
}

function mergeRecoverySnapshot(snap){
 if(!snap||typeof snap!=='object')return false;

 // Categories: union. Incoming values restore missing user-added categories/subcategories.
 categories={...(snap.categories||{}),...(categories||{})};
 Object.entries(snap.categories||{}).forEach(([cat,subs])=>{
  const curr=Array.isArray(categories[cat])?categories[cat]:[];
  const inc=Array.isArray(subs)?subs:[];
  categories[cat]=[...new Set([...inc,...curr])];
 });

 // Income Plan: preserve current scalar settings but restore missing history entries.
 const incomingIncome=snap.incomePlan||{};
 const currentIncome=incomePlan||{};
 incomePlan={...incomingIncome,...currentIncome};
 const historyKey=x=>`${x.id||''}|${x.date||''}|${x.month||''}|${Number(x.amount||0).toFixed(2)}`;
 if(Array.isArray(incomingIncome.extraIncomeHistory)||Array.isArray(currentIncome.extraIncomeHistory)){
  incomePlan.extraIncomeHistory=mergeArrayById(
   incomingIncome.extraIncomeHistory||[],
   currentIncome.extraIncomeHistory||[],
   historyKey
  );
 }

 // Transactions/import history/payment plans/ledger: merge by stable ids/keys.
 manualTransactions=mergeArrayById(snap.manualTransactions||[],manualTransactions||[],x=>x._id||`${x.date}|${x.description}|${x.amount}`);
 importedTransactions=mergeArrayById(snap.importedTransactions||[],importedTransactions||[],x=>x._id||`${x.date}|${x.description}|${x.amount}`);
 importHistory=mergeArrayById(snap.importHistory||[],importHistory||[],x=>x.id||`${x.fileName}|${x.importedAt}`);
 cashFlowLedger=mergeArrayById(snap.cashFlowLedger||[],cashFlowLedger||[],x=>x.id||cashFlowLedgerKey(x));
 installments=mergeArrayById(snap.installments||[],installments||[],x=>x.id);
 cardPaymentPlan=mergeArrayById(snap.cardPaymentPlan||[],cardPaymentPlan||[],x=>x.id);

 merchantRules={...(snap.merchantRules||{}),...(merchantRules||{})};
 txOverrides={...(snap.txOverrides||{}),...(txOverrides||{})};
 duplicateDecisions={...(snap.duplicateDecisions||{}),...(duplicateDecisions||{})};
 transactionActions={...(snap.transactionActions||{}),...(transactionActions||{})};
 bankBalanceOverrides={...(snap.bankBalanceOverrides||{}),...(bankBalanceOverrides||{})};

 normalizeCardPaymentPlan();
 rebuildTransactions();
 ensureRequiredInstallmentSeeds();
 ensureLedgerBackedPlannerRows();
 rebuildAllPlannerPaymentsFromLedger();
 normalizeBalanceOffers();
 ensurePartialPaymentFields();
 persistRecoveredState();
 financeDB.save();
 return true;
}

function refreshAllFinanceScreens(){
 // V173: retained only for explicit/manual recovery operations.
 // Normal realtime synchronization never calls this.
 const sections=[
  'finance_settings','categories','merchant_rules','tx_overrides','income_plan',
  'duplicate_decisions','statement_rule','transaction_actions','bank_balance_overrides',
  'reset_card_ids','card_reset_history','deleted_installment_ids',
  'manual_transactions','imported_transactions','import_history','cash_flow_ledger',
  'outgoings','installments','card_payment_plan'
 ];
 return renderCurrentPageForSections(sections);
}

function exportRecoverySnapshot(){
 const snap=saveRecoverySnapshot('manual-export');
 const blob=new Blob([JSON.stringify(snap,null,2)],{type:'application/json'});
 const a=document.createElement('a');
 a.href=URL.createObjectURL(blob);
 a.download=`personal-finance-recovery-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(a.href),500);
 renderRecoveryStatus('Local recovery backup exported. Keep this file until all devices are confirmed.');
}

let cloudEmptyVerifiedAt=0;
let cloudEmptyVerifiedState=null;
const CLOUD_EMPTY_VERIFY_TTL_MS=10*60*1000;
// V180 recovery lock: prevents an intentionally empty cloud from being auto-seeded
// by restored/local data between Purge/Verify and the explicit Step 4 publish.
const RECOVERY_CLOUD_LOCK_KEY='recovery_cloud_lock_v180';
function recoveryCloudLockActive(){return localStorage.getItem(RECOVERY_CLOUD_LOCK_KEY)==='1';}
function setRecoveryCloudLock(active){
 if(active)localStorage.setItem(RECOVERY_CLOUD_LOCK_KEY,'1');
 else localStorage.removeItem(RECOVERY_CLOUD_LOCK_KEY);
}

async function verifyCloudCompletelyEmpty(){
 if(!cloudClient)throw new Error('Cloud connection is unavailable.');
 const {data:{session}}=await cloudClient.auth.getSession();
 if(!session)throw new Error('Sign in to Supabase first.');
 const rows=await recordFetchAll();
 const legacy=await cloudInspectState();
 const result={
  empty:rows.length===0&&!legacy.value,
  rowCount:rows.length,
  legacyExists:!!legacy.value,
  activeRowCount:rows.filter(r=>!r.deleted_at).length,
  tombstoneRowCount:rows.filter(r=>!!r.deleted_at).length
 };
 if(result.empty){
  cloudEmptyVerifiedAt=Date.now();
  cloudEmptyVerifiedState=result;
 }else{
  cloudEmptyVerifiedAt=0;
  cloudEmptyVerifiedState=null;
 }
 return result;
}

async function deleteAllCloudFinanceData(){
 if(!cloudClient)throw new Error('Cloud connection is unavailable.');
 const {data:{session}}=await cloudClient.auth.getSession();
 if(!session)throw new Error('Sign in to Supabase first.');

 // V184 HARD RECOVERY RESET.
 // Freeze this device BEFORE the first DELETE so no local/realtime path can republish rows.
 setRecoveryCloudLock(true);
 recordSyncReady=false;
 recordSyncPushBusy=true;
 try{
  const beforeRows=await recordFetchAll();
  const beforeLegacy=await cloudInspectState();

  // Physical DELETE, not tombstoning. Every finance row is removed from Supabase.
  // Run a second pass after a short delay to catch any write that was already in flight.
  for(let pass=1;pass<=2;pass++){
   const {error:rowErr}=await cloudClient.from(RECORD_SYNC_TABLE)
     .delete().not('record_id','is',null);
   if(rowErr)throw new Error('Could not physically clear finance_sync_records (pass '+pass+'): '+rowErr.message);

   const {error:stateErr}=await cloudClient.from('settings').delete().eq('key','app_state');
   if(stateErr)throw new Error('Could not clear legacy settings/app_state (pass '+pass+'): '+stateErr.message);
   await new Promise(resolve=>setTimeout(resolve,350));
  }

  // Three independent read-backs. CLEAN is accepted only when every read is physically zero.
  let verification=null;
  for(let check=1;check<=3;check++){
   verification=await verifyCloudCompletelyEmpty();
   if(!verification.empty){
    throw new Error(`Hard purge read-back ${check}/3 FAILED: ${verification.rowCount} total row(s), ${verification.activeRowCount} active, ${verification.tombstoneRowCount} tombstone, legacy app_state=${verification.legacyExists?'YES':'NO'}.`);
   }
   if(check<3)await new Promise(resolve=>setTimeout(resolve,400));
  }

  recordSyncLastCloudUpdatedAt=0;
  recordSyncReady=false;
  setCloudMeta({initialized:false,pending:false,lastSyncedAt:'',lastAutoSyncAt:new Date().toISOString(),lastAutoSyncReason:'v184-hard-cloud-purge'});
  return {beforeRowCount:beforeRows.length,beforeLegacyExists:!!beforeLegacy.value,...verification};
 }finally{
  // Keep normal sync disabled while recovery lock is active; only Step 4 may publish.
  recordSyncPushBusy=false;
  recordSyncReady=false;
 }
}
function clearAllLocalFinanceStorage(){
 const keepKeys=new Set([RECOVERY_KEY]); // keep recovery snapshots until clean restore succeeds
 Object.keys(localStorage).filter(k=>k.startsWith('pf_')&&!keepKeys.has(k)).forEach(k=>localStorage.removeItem(k));
}

async function restoreBackupToLocalOnly(file){
 if(!file)throw new Error('Choose yesterday’s JSON recovery backup first.');
 // Step 3 deliberately trusts a RECENT successful Step 2/Purge verification.
 // Do not immediately run a second cloud read here: realtime/cached reads were producing
 // contradictory results (UI said CLEAN while restore said NOT empty). Step 4 performs
 // a fresh live verification again before anything can be published.
 const verifiedRecently=cloudEmptyVerifiedState?.empty && (Date.now()-cloudEmptyVerifiedAt)<=CLOUD_EMPTY_VERIFY_TTL_MS;
 if(!verifiedRecently){
  throw new Error('Cloud-empty verification is missing or older than 10 minutes. Click 2. Verify Cloud Empty, then restore the backup.');
 }

 const snap=JSON.parse(await file.text());
 if(!snap||typeof snap!=='object'||(!Array.isArray(snap.manualTransactions)&&!Array.isArray(snap.importedTransactions)&&!snap.incomePlan)){
  throw new Error('This does not look like a Personal Finance recovery backup.');
 }

 saveRecoverySnapshot('before-local-backup-restore');
 clearAllLocalFinanceStorage();
 if(!applyRecoverySnapshot(snap))throw new Error('Backup restore failed.');
 persistRecoveredState();
 await financeDB.save();

 // IMPORTANT: restored local data stays LOCAL ONLY until user presses Publish Restored Backup.
 recordSyncReady=false;
 setCloudMeta({initialized:false,deviceTrusted:true,pending:true,lastSyncedAt:'',lastLocalSavedAt:new Date().toISOString()});
 refreshAllFinanceScreens();
 return localSyncSummary();
}

async function publishRestoredBackupToCloud(){
 // Step 4 is the ONLY operation allowed to publish while recovery lock is active.
 // Perform a fresh Supabase-only read immediately before upload.
 const emptyCheck=await verifyCloudCompletelyEmpty();
 if(!emptyCheck.empty)throw new Error(`Cloud is not empty (${emptyCheck.rowCount} finance row(s), legacy app_state=${emptyCheck.legacyExists?'YES':'NO'}). Publishing is blocked. Run Step 1 Purge Cloud Only, then Step 2 Verify Cloud Empty. Do NOT restore the backup again.`);

 const local=localSyncSummary();
 const rows=buildRecordSyncRowsFromState().map(r=>({...r,deleted_at:null}));
 if(!rows.length)throw new Error('There is no restored local finance data to publish.');

 // V182: exact canonical publish. Write in small chunks, then independently read back
 // every expected key. Counts alone are NOT accepted as verification.
 const expectedKeys=new Set(rows.map(r=>`${r.section}|${r.record_id}`));
 const chunkSize=50;
 for(let i=0;i<rows.length;i+=chunkSize){
  const chunk=rows.slice(i,i+chunkSize);
  const {data,error}=await cloudClient.from(RECORD_SYNC_TABLE)
    .upsert(chunk,{onConflict:'section,record_id'})
    .select('section,record_id,deleted_at');
  if(error)throw new Error(`Cloud write failed at rows ${i+1}-${i+chunk.length}: ${error.message}`);
  const returned=new Set((data||[]).map(r=>`${r.section}|${r.record_id}`));
  const missing=chunk.filter(r=>!returned.has(`${r.section}|${r.record_id}`));
  if(missing.length)throw new Error(`Cloud write acknowledgement incomplete: ${missing.length} row(s) were not returned by Supabase.`);
 }

 // V186: verify repeatedly from Supabase. A publish is not accepted after one immediate read.
 // This catches a stale/older device or delayed writer that tries to remove restored rows.
 let verifyRows=[], active=[], actual={};
 for(const delay of [500,2000,5000]){
  await new Promise(resolve=>setTimeout(resolve,delay));
  verifyRows=await recordFetchAll();
  active=verifyRows.filter(r=>!r.deleted_at);
  const actualKeys=new Set(active.map(r=>`${r.section}|${r.record_id}`));
  const missingKeys=[...expectedKeys].filter(k=>!actualKeys.has(k));
  const unexpectedKeys=[...actualKeys].filter(k=>!expectedKeys.has(k));
  if(missingKeys.length||unexpectedKeys.length){
   throw new Error(`Protected cloud read-back FAILED: ${missingKeys.length} expected row(s) missing, ${unexpectedKeys.length} unexpected active row(s). Another writer may be changing Supabase.`);
  }
  actual={
   transactions:active.filter(r=>r.section==='manual_transactions'||r.section==='imported_transactions').length,
   installments:active.filter(r=>r.section==='installments').length,
   paymentRows:active.filter(r=>r.section==='card_payment_plan').length,
   cashFlowRows:active.filter(r=>r.section==='cash_flow_ledger').length
  };
  // V284: transaction record rows include deleted/audit transactions so cloud transport
  // count must be compared with local transportRows, not the active transaction count.
  // Exact key verification above plus the transaction_actions singleton preserves and
  // verifies the deleted/audit state without treating those history rows as active.
  const expectedCounts={
   transactions:Number(local.transportRows||local.transactions||0),
   installments:Number(local.installments||0),
   paymentRows:Number(local.paymentRows||0),
   // cash_flow_ledger intentionally transports reversed audit/history rows too.
   // Active finance calculations use local.cashFlowRows, while exact key verification
   // above guarantees that the full ledger (active + reversed) matches the restored device.
   cashFlowRows:Number((cashFlowLedger||[]).length)
  };
  for(const k of ['transactions','installments','paymentRows','cashFlowRows']){
   if(Number(actual[k]||0)!==expectedCounts[k])throw new Error(`Protected cloud read-back failed for ${k}: expected transport ${expectedCounts[k]}, cloud ${actual[k]||0}.`);
  }
 }
 const legacy=await cloudInspectState();
 if(legacy.value)throw new Error('Publish verification failed: legacy app_state exists unexpectedly.');

 // Publish and verification succeeded: recovery is complete.
 setRecoveryCloudLock(false);
 recordSyncReady=true;
 setCloudMeta({initialized:true,deviceTrusted:true,pending:false,lastSyncedAt:new Date().toISOString(),lastAutoSyncReason:'verified-restored-backup-publish'});
 return {local,actual,rowCount:verifyRows.length};
}

function bindRecoveryCenter(){
 if($('recoveryCreateBtn'))$('recoveryCreateBtn').onclick=()=>{
  const s=saveRecoverySnapshot('manual');
  renderRecoveryStatus(`Local backup created • ${new Date(s.createdAt).toLocaleString()}`);
 };
 if($('recoveryExportBtn'))$('recoveryExportBtn').onclick=exportRecoverySnapshot;
 if($('recoveryImportBtn'))$('recoveryImportBtn').onclick=()=>$('recoveryImportFile')?.click();
 if($('recoveryRestoreBtn'))$('recoveryRestoreBtn').onclick=()=>{
  const arr=getRecoverySnapshots();
  if(!arr.length){renderRecoveryStatus('No previous local recovery snapshot is available on this device.');return;}
  const s=arr[0];
  if(!confirm(`Restore local snapshot from ${new Date(s.createdAt).toLocaleString()}?\n\nCurrent state will first be backed up.`))return;
  saveRecoverySnapshot('before-local-restore');
  if(applyRecoverySnapshot(s)){
   setCloudMeta({pending:true});
   refreshAllFinanceScreens();
   renderRecoveryStatus(`Restored local snapshot from ${new Date(s.createdAt).toLocaleString()}. Review the data before syncing it to cloud.`);
  }
 };

 if($('purgeCloudBtn'))$('purgeCloudBtn').onclick=async()=>{
  try{
   const ok=confirm('V184 HARD CLOUD PURGE\n\nThis PHYSICALLY DELETES every finance_sync_records row (active + tombstones) and legacy settings/app_state from Supabase.\n\nIt does NOT restore or publish your backup.\n\nClose the finance page on other devices first, then continue. Continue?');
   if(!ok)return;
   renderRecoveryStatus('HARD PURGE RUNNING… physically deleting active rows + tombstones. No backup will be restored or published.');
   const r=await deleteAllCloudFinanceData();
   renderRecoveryStatus(`V184 HARD PURGE VERIFIED • 0 total rows • 0 active • 0 tombstones • legacy app_state absent. Physically deleted ${r.beforeRowCount} prior row(s).`);
   if($('cloudResult'))$('cloudResult').textContent='V184 HARD PURGE VERIFIED — 0 total rows • 0 active • 0 tombstones • legacy app_state absent. Nothing has been restored or published.';
  }catch(err){
   renderRecoveryStatus('CLOUD PURGE FAILED: '+err.message);
  }
 };

 if($('verifyCloudEmptyBtn'))$('verifyCloudEmptyBtn').onclick=async()=>{
  try{
   const r=await verifyCloudCompletelyEmpty();
   const msg=r.empty
    ? 'CLOUD CLEAN — SAFE TO RESTORE • 0 finance rows • no legacy app_state.'
    : `CLOUD NOT EMPTY • ${r.rowCount} finance row(s) (${r.activeRowCount} active, ${r.tombstoneRowCount} tombstone) • legacy app_state ${r.legacyExists?'EXISTS':'absent'}.`;
   renderRecoveryStatus(msg);
   if($('cloudResult'))$('cloudResult').textContent=msg;
  }catch(err){renderRecoveryStatus('Cloud verification failed: '+err.message);}
 };

 let lastCloudAuditRows=[];
 function auditEsc(v){return String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]||c));}
 function auditSummary(r){
  const d=(r&&typeof r.data==='object'&&r.data)||{};
  const pick=(...ks)=>{for(const k of ks){if(d[k]!==undefined&&d[k]!==null&&d[k]!=='')return d[k];}return '';};
  return {section:r.section||'',id:r.record_id||'',deleted:!!r.deleted_at,updated:r.updated_at||'',card:pick('account','card','cardName','creditCard','accountName'),description:pick('description','transaction','name','title'),date:pick('date','transactionDate','paymentDate','createdAt'),amount:pick('amount','remainingAmount','originalAmount','monthlyAmount'),data:d};
 }
 async function runCloudAudit(){
  if(!cloudClient)throw new Error('Cloud connection is unavailable.');
  const {data:{session}}=await cloudClient.auth.getSession(); if(!session)throw new Error('Sign in to Supabase first.');
  const rows=await recordFetchAll(); lastCloudAuditRows=rows.map(auditSummary);
  const active=lastCloudAuditRows.filter(r=>!r.deleted), tomb=lastCloudAuditRows.filter(r=>r.deleted);
  const bySection={}; active.forEach(r=>bySection[r.section]=(bySection[r.section]||0)+1);
  const panel=$('cloudAuditPanel'); panel.style.display='block';
  panel.innerHTML=`<div style="font-weight:800;font-size:16px;margin-bottom:6px">READ-ONLY CLOUD AUDIT</div><div style="margin-bottom:10px">${rows.length} total rows • ${active.length} active • ${tomb.length} tombstones. Active by section: ${auditEsc(Object.entries(bySection).map(([k,v])=>k+': '+v).join(' • ')||'none')}</div><div style="overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th style="text-align:left;padding:7px">State</th><th style="text-align:left;padding:7px">Section</th><th style="text-align:left;padding:7px">Record ID</th><th style="text-align:left;padding:7px">Card/Account</th><th style="text-align:left;padding:7px">Description</th><th style="text-align:left;padding:7px">Date</th><th style="text-align:right;padding:7px">Amount</th><th style="text-align:left;padding:7px">Updated</th></tr></thead><tbody>${lastCloudAuditRows.map(r=>`<tr style="border-top:1px solid #e7edf4;opacity:${r.deleted?'.55':'1'}"><td style="padding:7px">${r.deleted?'TOMBSTONE':'ACTIVE'}</td><td style="padding:7px">${auditEsc(r.section)}</td><td style="padding:7px">${auditEsc(r.id)}</td><td style="padding:7px">${auditEsc(r.card)}</td><td style="padding:7px">${auditEsc(r.description)}</td><td style="padding:7px">${auditEsc(r.date)}</td><td style="padding:7px;text-align:right">${auditEsc(r.amount)}</td><td style="padding:7px">${auditEsc(r.updated)}</td></tr>`).join('')}</tbody></table></div>`;
  $('cloudAuditExportBtn').style.display='inline-flex';
  return {total:rows.length,active:active.length,tombstones:tomb.length,bySection};
 }
 if($('cloudAuditBtn'))$('cloudAuditBtn').onclick=async()=>{try{const r=await runCloudAudit();renderRecoveryStatus(`READ-ONLY AUDIT COMPLETE • ${r.total} total • ${r.active} active • ${r.tombstones} tombstones. No cloud or local data was changed.`);}catch(err){renderRecoveryStatus('Cloud audit failed: '+err.message);}};
 if($('cloudAuditExportBtn'))$('cloudAuditExportBtn').onclick=()=>{if(!lastCloudAuditRows.length)return;const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),rows:lastCloudAuditRows},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='cloud-audit-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);};

 if($('restoreBackupLocalBtn'))$('restoreBackupLocalBtn').onclick=()=>$('restoreBackupLocalFile')?.click();
 if($('restoreBackupLocalFile'))$('restoreBackupLocalFile').onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{
   const sum=await restoreBackupToLocalOnly(file);
   renderRecoveryStatus(`BACKUP RESTORED TO THIS DEVICE ONLY • ${sum.transactions} transactions • ${sum.installments} installments • ${sum.paymentRows} payment rows. Cloud remains empty until Step 4.`);
   if($('cloudResult'))$('cloudResult').textContent='Backup restored locally only. Review it before publishing to cloud.';
  }catch(err){renderRecoveryStatus('Local backup restore FAILED: '+err.message);}
  finally{e.target.value='';}
 };

 if($('publishRestoredBackupBtn'))$('publishRestoredBackupBtn').onclick=async()=>{
  try{
   const ok=confirm('PUBLISH RESTORED BACKUP\n\nThis will upload the currently restored local database into the verified-empty Supabase cloud. Continue?');
   if(!ok)return;
   const r=await publishRestoredBackupToCloud();
   renderRecoveryStatus(`PUBLISH VERIFIED • ${r.actual.transactions} transactions • ${r.actual.installments} installments • ${r.actual.paymentRows} payment rows • ${r.actual.cashFlowRows} cash-flow rows.`);
   if($('cloudResult'))$('cloudResult').textContent='Restored backup published and verified. This is now the canonical cloud dataset.';
   await renderCloudReconciliation();
  }catch(err){renderRecoveryStatus('Publish FAILED: '+err.message);}
 };

 if($('recoveryImportFile'))$('recoveryImportFile').onchange=async e=>{
  const file=e.target.files?.[0]; if(!file)return;
  try{
   const snap=JSON.parse(await file.text());
   saveRecoverySnapshot('before-import-merge');
   if(!mergeRecoverySnapshot(snap))throw new Error('Invalid recovery file');
   setCloudMeta({pending:true});
   refreshAllFinanceScreens();
   renderRecoveryStatus(`Backup merged successfully from ${file.name}. Review restored categories/history/cards before syncing.`);
  }catch(err){renderRecoveryStatus('Recovery import failed: '+err.message);}
  finally{e.target.value='';}
 };
 renderRecoveryStatus();
}

function initializeRecoveryCenterSafely(){
 try{
  bindRecoveryCenter();
  if(!getRecoverySnapshots().length){
   saveRecoverySnapshot('v139-first-open');
  }
 }catch(e){
  console.warn('Recovery Center initialization delayed',e);
  const el=$('recoveryStatus');
  if(el)el.textContent='Recovery Center will initialize after the app finishes loading.';
 }
}


initializeRecoveryCenterSafely();

function fullCloudSnapshot(extra={}){
 return {
  version:74,
  syncInitialized:!!extra.syncInitialized,
  syncSource:extra.syncSource||'',
  financeSettings,
  categories,
  installments,
  deletedInstallmentIds:[...deletedInstallmentIds],
  merchantRules,
  txOverrides,
  incomePlan,
  manualTransactions,
  importedTransactions,
  importHistory,
  cashFlowLedger,
  outgoings,
  duplicateDecisions,
  statementRule,
  transactionActions,
  bankBalanceOverrides,
  resetCardIds:[...resetCardIds],
  cardResetHistory,
  cardPaymentPlan,
  syncSummary:localSyncSummary(),
  savedAt:new Date().toISOString()
 };
}
function applyCloudSnapshot(d){
 if(!d||typeof d!=='object')return false;
 if(d.financeSettings&&typeof d.financeSettings==='object'&&!financeSettingsDirty)financeSettings=d.financeSettings;
 categories=d.categories||categories;
 installments=d.installments||installments;
 if(Array.isArray(d.deletedInstallmentIds)){
  deletedInstallmentIds=new Set(d.deletedInstallmentIds);
  localStorage.setItem('pf_deleted_installment_ids',JSON.stringify([...deletedInstallmentIds]));
  installments=installments.filter(p=>!deletedInstallmentIds.has(p.id));
 }
 merchantRules=d.merchantRules||merchantRules;
 txOverrides=d.txOverrides||txOverrides;
 incomePlan=d.incomePlan||incomePlan;
 manualTransactions=d.manualTransactions||manualTransactions;
 importedTransactions=d.importedTransactions||importedTransactions;
 importHistory=d.importHistory||importHistory;
 outgoings=d.outgoings||outgoings;
 duplicateDecisions=d.duplicateDecisions||duplicateDecisions;
 statementRule=d.statementRule||statementRule;
 transactionActions=d.transactionActions||transactionActions;
 bankBalanceOverrides=d.bankBalanceOverrides||bankBalanceOverrides;
 localStorage.setItem('pf_bank_balance_overrides',JSON.stringify(bankBalanceOverrides));
 if(Array.isArray(d.resetCardIds)){resetCardIds=new Set(d.resetCardIds);localStorage.setItem('pf_reset_card_ids',JSON.stringify([...resetCardIds]));}
 cardResetHistory=d.cardResetHistory||cardResetHistory;
 localStorage.setItem('pf_card_reset_history',JSON.stringify(cardResetHistory));
 cardPaymentPlan=d.cardPaymentPlan||cardPaymentPlan;cashFlowLedger=d.cashFlowLedger||cashFlowLedger;
 purgeLegacyAr5867SeedRows();
 normalizeCardPaymentPlan();
 purgeLegacySabAnchorRows();
 rebuildTransactions();
 ensureRequiredInstallmentSeeds();
 normalizeBalanceOffers();
 ensurePartialPaymentFields();

 // V141: payment ledger and planner/card state are one connected financial record.
 // Reconstruct missing planner rows/payment histories after every cloud restore.
 ensureLedgerBackedPlannerRows();
 rebuildAllPlannerPaymentsFromLedger();

 return true;
}
async function cloudSaveSnapshot(silent=true,forceInitial=false){
 if(!cloudClient)return false;
 const {data:{session}}=await cloudClient.auth.getSession();
 if(!session)return false;
 const meta=getCloudMeta();
 if(!forceInitial && !(meta.initialized&&meta.deviceTrusted))return false;
 if(cloudAutoSaveBusy){cloudAutoSaveQueued=true;return false;}
 cloudAutoSaveBusy=true;
 try{
  const snap=fullCloudSnapshot({syncInitialized:true,syncSource:forceInitial?'first-device':'trusted-device'});
  const {error}=await cloudClient.from('settings').upsert({key:'app_state',value:snap,updated_at:snap.savedAt});
  if(error)throw error;
  setCloudMeta({
   initialized:true,
   deviceTrusted:true,
   lastSyncedAt:snap.savedAt,
   lastLocalSavedAt:snap.savedAt,
   pending:false,
   lastAutoSyncAt:new Date().toISOString()
  });
  cloudSetStatus(`Cloud synced • ${new Date(snap.savedAt).toLocaleTimeString()}`);
  if($('dbStatus'))$('dbStatus').innerHTML=`<span class="dbDot"></span>Local + Cloud synced • ${new Date(snap.savedAt).toLocaleTimeString()}`;
  setTimeout(()=>renderCloudReconciliation(),0);
  return true;
 }catch(e){
  console.warn('Cloud save failed',e);
  setCloudMeta({pending:true});
  if(!silent&&$('cloudResult'))$('cloudResult').textContent='Cloud save failed: '+e.message;
  return false;
 }finally{
  cloudAutoSaveBusy=false;
  if(cloudAutoSaveQueued){cloudAutoSaveQueued=false;setTimeout(()=>cloudSaveSnapshot(true),150);}
 }
}
function scheduleCloudAutoSave(){
 // V145: all normal edits publish as row-based records.
 scheduleRecordPush('local-edit');
}

function cloudLocalLastSavedAt(){
 const meta=getCloudMeta();
 return meta.lastLocalSavedAt||meta.lastSyncedAt||'';
}

async function cloudAutoReconcile(reason='fallback'){
 if(!cloudClient||window.__financeStateInitialized!==true)return false;
 try{
  const {data:{session}}=await cloudClient.auth.getSession();
  if(!session)return false;
  // V225: background downloads are allowed only after this device has completed a
  // verified authoritative load. Never interrupt an active edit or overwrite pending work.
  const verified=localStorage.getItem('pf_v185_authoritative_cloud_loaded')==='1';
  const meta=getCloudMeta();
  const activeEl=document.activeElement;
  const editing=!!(activeEl&&activeEl.matches?.('input,select,textarea,[contenteditable="true"]'));
  const modalOpen=!!document.querySelector('.modal.open,.modal[style*="display: block"],dialog[open]');
  const transactionSelectionActive=selectedTxIds.size>0||!!activeEl?.matches?.('[data-select-tx],#txMasterCheck,#detailTxMasterCheck');
  if(!verified||!recordSyncReady||meta.pending||recordSyncPushBusy||recordSyncApplying||editing||modalOpen||transactionSelectionActive)return false;
  const changed=await recordFetchChangedSince(currentCloudCursorIso());
  let recovered=[];
  if(changed.length){
   const result=applyRecordSyncDeltaRows(changed,{render:true});
   rememberRemoteRecordBaseline(changed);
   changed.forEach(r=>noteCloudUpdatedAt(r.updated_at));
   recovered=await recoverCloudOnlyRecords();
   setCloudMeta({initialized:true,deviceTrusted:true,pending:false,lastSyncedAt:new Date(recordSyncLastCloudUpdatedAt||Date.now()).toISOString(),lastAutoSyncAt:new Date().toISOString(),lastAutoSyncReason:`protected-delta-${reason}`});
   if(activeViewId()==='cloudSync')await renderCloudReconciliation();
   cloudSetStatus(`${getCloudMeta().reconciliationMismatch?'Cloud reconciliation needed':recovered.length?`${recovered.length} cloud records recovered`:result.changed?'Cloud changes received':'Cloud verified'} • ${new Date().toLocaleTimeString()}`);
   return result.changed||recovered.length>0;
  }
  recovered=await recoverCloudOnlyRecords();
  cloudLastAutoCheckAt=Date.now();
  if(activeViewId()==='cloudSync')await renderCloudReconciliation();
  cloudSetStatus(`${getCloudMeta().reconciliationMismatch?'Cloud reconciliation needed':recovered.length?`${recovered.length} cloud records recovered`:'Cloud verified'} • ${new Date().toLocaleTimeString()}`);
  return recovered.length>0;
 }catch(e){
  console.warn('Protected cloud refresh failed',e);
  cloudSetStatus('Cloud check retry pending • '+e.message);
  return false;
 }
}

async function recoverCloudOnlyRecords(){
 // Delta timestamps cannot find rows written before this device's cursor.
 // A full key comparison adds missing cloud records without replacing local edits.
 const remote=(await recordFetchAll()).filter(r=>!r.deleted_at);
 const local=new Map(buildRecordSyncRowsFromState().map(r=>[`${r.section}|${r.record_id}`,r]));
 const baseline=recordSyncBaseline();
 const queued=new Set(recordPendingDeletes.map(x=>`${x.section}|${x.record_id}`));
 const missing=remote.filter(r=>{
  if(r.section==='rental_blocks'&&/^\d+$/.test(String(r.record_id)))return false;
  const key=`${r.section}|${r.record_id}`,current=local.get(key);
  const old=baseline[key]===undefined?undefined:syncRecordValue(JSON.parse(baseline[key]));
  return !queued.has(key) && Array.isArray(syncArrayForSection(r.section)) && (!current || (old===syncRecordValue(current.data) && old!==syncRecordValue(r.data)));
 });
 if(!missing.length)return [];
 try{saveRecoverySnapshot('before-cloud-only-record-recovery');}catch(_){}
 const result=applyRecordSyncDeltaRows(missing,{render:true});
 if(result.changed){
  rememberRemoteRecordBaseline(missing);
  missing.forEach(r=>noteCloudUpdatedAt(r.updated_at));
  return missing;
 }
 return [];
}

function schedulePeriodicCloudAutoSync(){
 clearInterval(cloudAutoSyncTimer);
 clearInterval(recordSyncFallbackTimer);

 // V225: frequent but edit-safe delta checks provide cross-device synchronization
 // without replacing the full local database or rebuilding the page during input.
 recordSyncFallbackTimer=setInterval(()=>{
  if(document.visibilityState==='visible' && navigator.onLine!==false){
   cloudAutoReconcile('30sec-refresh');
  }
 },30000);
}

function startCloudAutoSyncWatchers(){
 schedulePeriodicCloudAutoSync();

 // Local changes are still pushed immediately by the existing save/update/delete logic.
 // We intentionally do NOT pull on focus, tab visibility, or ordinary online events,
 // because those were causing unexpected page rebuilds while reviewing the system.

 window.addEventListener('online',()=>{
  cloudSetStatus('Online • checking protected cloud changes');
  cloudAutoReconcile('online');
 });

 document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&navigator.onLine!==false)cloudAutoReconcile('visible');
 });

 window.addEventListener('pagehide',()=>{
  const meta=getCloudMeta();
  if(meta.pending===true && recordSyncReady){
   recordPushAll('pagehide');
  }
 });
}

async function cloudLoadSnapshotIfNewer(localSavedAt='',force=false){
 if(!cloudClient)return false;
 const {data:{session}}=await cloudClient.auth.getSession();
 if(!session)return false;
 const state=await cloudInspectState();
 if(!state.initialized||!state.value)return false;
 const cloudAt=new Date(state.value.savedAt||state.updatedAt||0).getTime();
 const localAt=new Date(localSavedAt||0).getTime();
 if(!force && localAt && cloudAt<=localAt)return false;

 // V138 recovery guard: never replace local finance state without a rollback copy.
 const prePull=saveRecoverySnapshot(force?'before-manual-cloud-load':'before-auto-cloud-pull');

 if(!applyCloudSnapshot(state.value))return false;

 // Preserve local-only user-created metadata/history that may be absent in an
 // older cloud snapshot. This specifically protects custom Categories and
 // Extra Income History while still letting the newer cloud state load.
 categories={...(prePull.categories||{}),...(categories||{})};
 Object.entries(prePull.categories||{}).forEach(([cat,subs])=>{
  const cloudSubs=Array.isArray(categories[cat])?categories[cat]:[];
  const localSubs=Array.isArray(subs)?subs:[];
  categories[cat]=[...new Set([...localSubs,...cloudSubs])];
 });

 if(Array.isArray(prePull.incomePlan?.extraIncomeHistory)){
  incomePlan=incomePlan||{};
  incomePlan.extraIncomeHistory=mergeArrayById(
   prePull.incomePlan.extraIncomeHistory||[],
   incomePlan.extraIncomeHistory||[],
   x=>`${x.id||''}|${x.date||''}|${x.month||''}|${Number(x.amount||0).toFixed(2)}`
  );
 }
 persistRecoveredState();
 localStorage.setItem('pf_categories',JSON.stringify(categories));
 localStorage.setItem('pf_installments',JSON.stringify(installments));
 localStorage.setItem('pf_merchant_rules',JSON.stringify(merchantRules));
 localStorage.setItem('pf_tx_overrides',JSON.stringify(txOverrides));
 localStorage.setItem('pf_income_plan',JSON.stringify(incomePlan));
 localStorage.setItem('pf_manual_transactions',JSON.stringify(manualTransactions));
 localStorage.setItem('pf_imported_transactions',JSON.stringify(importedTransactions));
 localStorage.setItem('pf_import_history',JSON.stringify(importHistory));
 localStorage.setItem('pf_cash_flow_ledger',JSON.stringify(cashFlowLedger));
 localStorage.setItem('pf_card_payment_plan',JSON.stringify(cardPaymentPlan));
 localStorage.setItem('pf_outgoings',JSON.stringify(outgoings));
 localStorage.setItem('pf_duplicate_decisions',JSON.stringify(duplicateDecisions));
 localStorage.setItem('pf_statement_rule',JSON.stringify(statementRule));
 localStorage.setItem('pf_transaction_actions',JSON.stringify(transactionActions));
 const loadedAt=state.value.savedAt||state.updatedAt||new Date().toISOString();
 setCloudMeta({
  initialized:true,
  deviceTrusted:true,
  lastSyncedAt:loadedAt,
  lastLocalSavedAt:loadedAt,
  pending:false,
  lastAutoSyncAt:new Date().toISOString()
 });
 await financeDB.save();
 setTimeout(()=>renderCloudReconciliation(),0);
 return true;
}

async function cloudInitialUpload(){
 try{
  if(recoveryCloudLockActive())throw new Error('Recovery lock is active. Finish the Recovery Center workflow first.');
  $('cloudResult').textContent='Initializing realtime cloud records…';
  await cloudClaim();
  const existing=await recordFetchAll();
  if(existing.some(r=>!r.deleted_at))throw new Error('Cloud already contains finance data. Use Load Latest Cloud Data first; this device was not uploaded.');
  recordSyncReady=true;
  localStorage.setItem('pf_v185_authoritative_cloud_loaded','1');
  setCloudMeta({initialized:true,deviceTrusted:true,pending:true});
  const published=await recordPushAll('first-device');
  if(!published)throw new Error('The first cloud upload did not complete. Local data remains unchanged.');
  const cloudRows=await recordFetchAll();
  const expected=new Set(buildRecordSyncRowsFromState().map(r=>`${r.section}|${r.record_id}`));
  const actual=new Set(cloudRows.filter(r=>!r.deleted_at).map(r=>`${r.section}|${r.record_id}`));
  const missing=[...expected].filter(k=>!actual.has(k));
  if(missing.length)throw new Error(`First upload verification failed: ${missing.length} record(s) missing in cloud.`);
  const s=localSyncSummary();
  $('cloudResult').textContent=`FIRST CLOUD SOURCE VERIFIED • ${s.transactions} active transactions • ${s.installments} installments • ${s.paymentRows} payment rows.`;
  updateCloudSyncPanel(true);
 }catch(e){
  recordSyncReady=false;
  $('cloudResult').textContent='Realtime initialization failed. Local data was kept unchanged. '+e.message;
 }
}
async function cloudUploadAll(){
 try{
  if(recoveryCloudLockActive())throw new Error('Recovery lock is active. Use Step 4 Publish Restored Backup to Cloud; normal Sync Now is blocked during recovery.');
  $('cloudResult').textContent='Publishing current records to realtime cloud…';
  if(!recordSyncReady)await startRealtimeRecordSync();
  if(!recordSyncReady)throw new Error('This device is not verified. Use Load Latest Cloud Data once before Sync Now.');
  const published=await recordPushAll('manual-sync');
  if(!published)throw new Error(getCloudMeta().reconciliationMismatch?'Cloud contains records absent from this device. Review Data Reconciliation before resolving them; no cloud-only records were deleted.':'Cloud publish or verification did not complete. Local data remains pending.');
  const cloudRows=await recordFetchAll();
  const cc=v185ActiveCloudCounts(cloudRows);
  const s=localSyncSummary();
  const expected=new Set(buildRecordSyncRowsFromState().map(r=>`${r.section}|${r.record_id}`));
  const actual=new Set(cloudRows.filter(r=>!r.deleted_at).map(r=>`${r.section}|${r.record_id}`));
  const missing=[...expected].filter(k=>!actual.has(k));
  if(missing.length)throw new Error(`Cloud verification failed: ${missing.length} local record(s) missing after upload.`);
  $('cloudResult').textContent=`SYNC PUBLISHED AND VERIFIED • Device kept unchanged: ${s.transactions} transactions, ${s.installments} installments. Cloud: ${cc.manual+cc.imported} transaction rows, ${cc.installments} installments, ${cc.paymentRows} payment rows, ${cc.cashFlowRows} cash-flow rows.`;
  await renderCloudReconciliation();
 }catch(e){
  setCloudMeta({pending:true});
  $('cloudResult').textContent='Realtime sync failed: '+e.message;
 }
}
function v185ActiveCloudCounts(rows){
 const active=(rows||[]).filter(r=>!r.deleted_at);
 const count=s=>active.filter(r=>r.section===s).length;
 return {
  totalRows:(rows||[]).length, activeRows:active.length,
  manual:count('manual_transactions'), imported:count('imported_transactions'),
  installments:count('installments'), paymentRows:count('card_payment_plan'),
  cashFlowRows:count('cash_flow_ledger'), outgoings:count('outgoings')
 };
}
async function cloudDownloadAll(){
 const btn=$('cloudDownload');
 const result=$('cloudResult');
 const originalLabel=btn?btn.textContent:'Load Latest Cloud Data';
 let rollback=null;
 try{
  if(!cloudClient)throw new Error('Supabase client is unavailable.');
  const {data:{session}}=await cloudClient.auth.getSession();
  if(!session)throw new Error('You are not signed in.');
  if(btn){btn.disabled=true;btn.textContent='Loading Complete Cloud…';}
  if(result){result.className='notice';result.textContent='Reading the complete canonical finance database. No upload will occur during this operation…';}
  const waitStarted=Date.now();
  while((recordSyncPullBusy||recordSyncPushBusy||recordSyncApplying) && Date.now()-waitStarted<10000){await new Promise(resolve=>setTimeout(resolve,150));}
  if(recordSyncPushBusy||recordSyncApplying)throw new Error('A local save is still finishing. Try again in a few seconds.');

  // Full authoritative read. Never use app_state, a delta cursor, or a local snapshot here.
  const rows=await recordFetchAll();
  if(!rows.length)throw new Error('Supabase finance_sync_records is empty. Local data was not changed.');
  const cloud=v185ActiveCloudCounts(rows);
  if(!cloud.activeRows)throw new Error(`Supabase returned ${cloud.totalRows} row(s), but none are active. Local data was not changed.`);

  rollback=saveRecoverySnapshot('before-manual-cloud-load-v185');
  recordSyncPullBusy=true;
  recordSyncReady=false; // block local upload until verification finishes
  applyRecordSyncRows(rows);
  await financeDB.save();

  // Verify the raw record sections became the same local arrays.
  const mismatches=[];
  if((manualTransactions||[]).length!==cloud.manual)mismatches.push(`manual ${manualTransactions.length}/${cloud.manual}`);
  if((importedTransactions||[]).length!==cloud.imported)mismatches.push(`imported ${importedTransactions.length}/${cloud.imported}`);
  if((installments||[]).length!==cloud.installments)mismatches.push(`installments ${installments.length}/${cloud.installments}`);
  if((cardPaymentPlan||[]).length!==cloud.paymentRows)mismatches.push(`payment rows ${cardPaymentPlan.length}/${cloud.paymentRows}`);
  if((cashFlowLedger||[]).length!==cloud.cashFlowRows)mismatches.push(`cash-flow ${cashFlowLedger.length}/${cloud.cashFlowRows}`);
  if((outgoings||[]).length!==cloud.outgoings)mismatches.push(`outgoings ${outgoings.length}/${cloud.outgoings}`);
  if(mismatches.length)throw new Error('Cloud-to-device verification mismatch: '+mismatches.join(' • '));
  rememberRecordSyncBaseline(buildRecordSyncRowsFromState());

  rows.forEach(r=>noteCloudUpdatedAt(r.updated_at));
  const sections=[...new Set(rows.map(r=>r.section))];
  renderCurrentPageForSections(sections);
  recordSyncReady=true;
  localStorage.setItem('pf_v185_authoritative_cloud_loaded','1');
  setCloudMeta({initialized:true,deviceTrusted:true,pending:false,lastSyncedAt:new Date(recordSyncLastCloudUpdatedAt||Date.now()).toISOString(),lastAutoSyncAt:new Date().toISOString(),lastAutoSyncReason:'manual-authoritative-full-load-v185'});
  const summary=localSyncSummary();
  if(result){result.className='notice success';result.textContent=`CLOUD LOAD VERIFIED • Cloud: ${cloud.activeRows} active rows • ${cloud.manual+cloud.imported} stored transaction rows • ${cloud.installments} installments • ${cloud.paymentRows} payment rows • ${cloud.cashFlowRows} cash-flow rows. Device: ${summary.transactions} active transactions • ${summary.installments} installments • ${summary.paymentRows} payment rows • ${summary.cashFlowRows} cash-flow rows.`;}
  cloudSetStatus(`Authoritative cloud load verified • ${new Date().toLocaleTimeString()}`);
  await renderCloudReconciliation();
 }catch(e){
  recordSyncReady=false;
  console.error('Manual cloud load failed',e);
  if(result){result.className='notice danger';result.textContent='CLOUD LOAD BLOCKED/FAILED • '+e.message+' • Automatic upload remains disabled on this device.';}
 }finally{
  recordSyncPullBusy=false;
  if(btn){btn.disabled=false;btn.textContent=originalLabel;}
 }
}
async function refreshCloudSafetyState(){
 const session=await cloudRefreshAuth();
 if(!session){updateCloudSyncPanel(false);return;}
 // V226: finance_sync_records is the canonical cloud database. The legacy
 // settings/app_state snapshot may be absent even when all finance rows exist.
 // Never disable Load Latest Cloud Data based only on that retired snapshot.
 let cloudRows=[];
 try{cloudRows=await recordFetchAll();}catch(e){console.warn('Canonical cloud check failed',e);}
 const activeCloudRows=cloudRows.filter(r=>!r.deleted_at).length;
 const remote=await cloudInspectState();
 const canonicalCloudExists=activeCloudRows>0;
 const anyCloudExists=canonicalCloudExists||remote.initialized;
 updateCloudSyncPanel(anyCloudExists);
 const meta=getCloudMeta();
 if(!meta.deviceTrusted){
  if(anyCloudExists){
   cloudSetStatus(`Signed in • protected device • ${activeCloudRows||'legacy'} cloud record${activeCloudRows===1?'':'s'} found`);
   if($('cloudResult'))$('cloudResult').textContent=`Cloud data exists${canonicalCloudExists?' ('+activeCloudRows+' active records)':''}. Choose “Load Latest Cloud Data” to make this device a verified synced copy.`;
  }else{
   cloudSetStatus('Signed in • first sync not completed • local data protected');
   if($('cloudResult'))$('cloudResult').textContent='No active finance records exist in the cloud. On your MacBook/source device, restore the backup first, then use the protected publish workflow.';
  }
 }else{
  cloudSetStatus(meta.pending?'Signed in • local changes pending sync':'Signed in • Auto Sync ON');
 }
}

if(cloudClient){
 $('cloudSendLink').addEventListener('click',async()=>{const email=$('cloudEmail').value.trim();if(!email)return cloudSetStatus('Enter your email first.');const {error}=await cloudClient.auth.signInWithOtp({email,options:{emailRedirectTo:window.location.origin+window.location.pathname}});cloudSetStatus(error?'Login error: '+error.message:'Login link sent. Check your email.');});
 if($('cloudInitialUpload'))$('cloudInitialUpload').addEventListener('click',cloudInitialUpload);
 $('cloudUpload').addEventListener('click',cloudUploadAll);
 $('cloudDownload').addEventListener('click',cloudDownloadAll);
 $('cloudSignOut').addEventListener('click',financeSignOutCurrentDevice);
 cloudClient.auth.onAuthStateChange(()=>setTimeout(async()=>{await refreshCloudSafetyState();},0));
}else{
 $('cloudSendLink').addEventListener('click',()=>cloudSetStatus('Cloud sync is unavailable right now. The dashboard is running normally in local mode.'));
}


$('closePaymentSource').addEventListener('click',closePaymentSourceModal);
$('cancelPaymentSource').addEventListener('click',closePaymentSourceModal);
$('paymentSourceSelect').addEventListener('change',()=>{syncPaymentIncomeChoiceToSource();updatePaymentSourcePreview();});
$('paymentAmountInput').addEventListener('input',updatePaymentSourcePreview);
$('paymentDateInput').addEventListener('change',updatePaymentSourcePreview);
$('paymentUseMonthlyIncome').addEventListener('change',updatePaymentSourcePreview);
$('paymentSourceForm').addEventListener('submit',e=>{
 e.preventDefault();
 const id=$('paymentPlanId').value,p=cardPaymentPlan.find(x=>x.id===id);if(!p)return;
 const remaining=paymentRemainingAmount(p),amount=Number($('paymentAmountInput').value||0),sourceId=$('paymentSourceSelect').value,date=$('paymentDateInput').value;
 const deductFromIncome=sourceId==='cash-source'||$('paymentUseMonthlyIncome')?.checked===true;
 const budgetMonth=incomeMonthKey(date);
 if(!Number.isFinite(amount)||amount<=0){alert('Enter a valid payment amount.');return;}
 const duePortion=Math.min(amount,Math.max(0,Number(remaining||0)));
 const extraCredit=Math.max(0,amount-duePortion);
 if(!sourceId){alert('Select where the payment came from.');return;}
 if(deductFromIncome&&amount>remainingIncomeAvailable(budgetMonth)+0.005){
  if(!confirm(`This payment is greater than the remaining Monthly Planned Income for ${extraIncomeMonthTitle(budgetMonth)} of ${money(remainingIncomeAvailable(budgetMonth))}. Record it anyway?`))return;
 }
 const source=sourceId==='cash-source'?null:account(sourceId);
 const sourceBankBalanceBefore=source?.type==='bank'?adjustedBankBalance(source):null;
 if(source?.type==='bank'&&amount>adjustedBankBalance(source)+0.005){
  if(!confirm(`This payment is greater than the current tracked balance of ${money(adjustedBankBalance(source))} in ${source.bank} • ${source.name}. Record it anyway?`))return;
 }
 // V131: payment updates ledger only; statement base stays unchanged.
 p.paidAmount=paymentPaidAmount(p)+duePortion;
 p.paymentHistory=Array.isArray(p.paymentHistory)?p.paymentHistory:[];
 const hist={amount,duePortion,extraCredit,date,sourceId,sourceName:sourceId==='cash-source'?'Monthly Planned Income':accountName(sourceId),deductFromIncome,budgetMonth,incomeDecisionVersion:'V161',recordedAt:new Date().toISOString()};
 const ledgerRef=`payment:${p.id}:${hist.recordedAt}:${Number(amount).toFixed(2)}`;
 hist.ledgerReferenceId=ledgerRef;
 p.paymentHistory.push(hist);
 addCashFlowLedgerEntry({
  type:'card-payment',
  date,
  month:budgetMonth,
  description:`Card payment • ${accountName(p.accountId)}`,
  amount,
  sourceId,
  sourceName:hist.sourceName,
  targetId:p.accountId,
  targetName:accountName(p.accountId),
  targetPaymentMonth:p.month,
  deductFromIncome,
  referenceId:ledgerRef,
  referenceType:'card-payment-history',
  createdAt:hist.recordedAt
 });
 if(source?.type==='bank' && Number.isFinite(sourceBankBalanceBefore)){
  setTrackedBankBalance(source.id,sourceBankBalanceBefore-amount);
 }
 p.paid=paymentRemainingAmount(p)<=0.005;
 const incomeCardId=$('paymentSourceModal').dataset.incomeCardId||'';
 if(incomeCardId){
  incomePlan.allocations=incomePlan.allocations||{};
  incomePlan.allocations[incomeCardId]=0;
  const allocEl=$('alloc_'+incomeCardId);
  if(allocEl)allocEl.value='';
  delete $('paymentSourceModal').dataset.incomeCardId;
 }
 if(p.id==='p-nbdmazeed-sep-upcoming'){
  const real=cardPaymentPlan.find(x=>x.id==='p-nbdmazeed-oct');
  if(real){
   real.paymentHistory=Array.isArray(real.paymentHistory)?real.paymentHistory:[];
   real.paymentHistory.push({...hist,mirrored:true});
   real.paidAmount=paymentPaidAmount(real)+duePortion;
   real.paid=paymentRemainingAmount(real)<=0.005;
  }
 }
 saveCardPaymentPlan();closePaymentSourceModal();
 saveLocal();

 // V127: recalculate the target card immediately so recorded payments
 // restore its available credit without requiring a browser refresh.
 refreshAfterTransactionChange(p.accountId);

 // If another credit card funded this payment, update that source card too.
 if(source?.type==='card')refreshAfterTransactionChange(source.id);

 if(extraCredit>0)setTimeout(()=>alert(`Payment recorded.\n\nAmount due applied: ${money(duePortion)}\nExtra paid to card: ${money(extraCredit)}\nDashboard remaining for this payment: ${money(paymentRemainingAmount(p)||0)}\n\nThe extra amount is stored as card credit and will reduce future card usage/transactions.`),40);
 if(document.querySelector('#incomeplan.active'))renderIncomePlan();
});

function reconcileExistingImportedStatements(){
 // V159: retired. Historical import filenames must never manufacture a statement amount.
 return false;
}


const TABLE_SORT_STATE=new Map();
let tableSortRefreshTimer=null;

function tableSortCellText(td){
 if(!td)return '';
 const explicit=td.getAttribute('data-sort-value');
 if(explicit!==null)return explicit;

 const control=td.querySelector('input,select,textarea');
 if(control){
  if(control.type==='checkbox')return control.checked?'1':'0';
  return String(control.value??'').trim();
 }
 return String(td.innerText||td.textContent||'').replace(/\s+/g,' ').trim();
}

function tableSortValue(raw){
 const s=String(raw??'').trim();
 if(!s)return {type:'empty',value:''};

 // ISO date / datetime.
 let m=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s|T|$)/);
 if(m){
  return {type:'date',value:Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]))};
 }

 // Display dates such as 09/14/2026 or 14/09/2026 are left as text unless unambiguous.
 m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
 if(m){
  const a=Number(m[1]),b=Number(m[2]),y=Number(m[3]);
  if(a>12)return {type:'date',value:Date.UTC(y,b-1,a)};
  return {type:'date',value:Date.UTC(y,a-1,b)};
 }

 // YYYY-MM month.
 m=s.match(/^(\d{4})-(\d{2})$/);
 if(m)return {type:'date',value:Date.UTC(Number(m[1]),Number(m[2])-1,1)};

 // Finance / percentage / integer values.
 const cleaned=s
  .replace(/\bSAR\b/gi,'')
  .replace(/,/g,'')
  .replace(/%/g,'')
  .replace(/\s+/g,'')
  .replace(/[()]/g,m=>m==='('?'-':'');
 if(/^[-+]?\d*\.?\d+$/.test(cleaned)){
  return {type:'number',value:Number(cleaned)};
 }

 return {type:'text',value:s.toLocaleLowerCase()};
}

function compareTableSortValues(a,b){
 if(a.type==='empty' && b.type==='empty')return 0;
 if(a.type==='empty')return 1;
 if(b.type==='empty')return -1;

 if(a.type===b.type){
  if(a.type==='text')return a.value.localeCompare(b.value,undefined,{numeric:true,sensitivity:'base'});
  return a.value-b.value;
 }

 // If either parses as text, compare the visible values naturally.
 return String(a.value).localeCompare(String(b.value),undefined,{numeric:true,sensitivity:'base'});
}

function tableSortKey(table,index){
 if(!table.dataset.sortKey){
  const page=table.closest('.page,[id]')?.id||'global';
  const title=table.closest('.panel')?.previousElementSibling?.textContent?.trim()||
   table.closest('.panel')?.querySelector('.panelTitle,.sectionTitle')?.textContent?.trim()||'table';
  table.dataset.sortKey=`${page}:${title}:${index}`;
 }
 return table.dataset.sortKey;
}
