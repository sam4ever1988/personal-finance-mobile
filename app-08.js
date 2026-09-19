function applyTableSort(table,colIndex,direction,remember=true){
 const tbody=table.tBodies?.[0];
 if(!tbody)return;

 const allRows=[...tbody.rows];
 const sortableRows=allRows.filter(r=>r.cells.length>colIndex && !r.cells[0]?.hasAttribute('colspan') && !r.querySelector('td[colspan]'));
 const fixedRows=allRows.filter(r=>!sortableRows.includes(r));
 if(sortableRows.length<2)return;

 const decorated=sortableRows.map((row,originalIndex)=>({
  row,
  originalIndex,
  key:tableSortValue(tableSortCellText(row.cells[colIndex]))
 }));

 decorated.sort((x,y)=>{
  const cmp=compareTableSortValues(x.key,y.key);
  return (direction==='desc'?-cmp:cmp)||x.originalIndex-y.originalIndex;
 });

 // V236: only touch the DOM when the requested sort actually changes row order.
 // appendChild() on rows that are already in the correct order still produces
 // childList mutations. The sortable-table MutationObserver then re-applies the
 // saved sort, which used to create a continuous refresh/re-sort loop and made
 // transaction checkboxes appear unclickable after sorting/filtering.
 const desiredRows=[...decorated.map(x=>x.row),...fixedRows];
 const currentRows=[...tbody.rows];
 const orderChanged=desiredRows.length!==currentRows.length || desiredRows.some((row,i)=>currentRows[i]!==row);
 if(orderChanged){
  const frag=document.createDocumentFragment();
  desiredRows.forEach(row=>frag.appendChild(row));
  tbody.appendChild(frag);
 }

 [...table.tHead?.rows?.[0]?.cells||[]].forEach(th=>{
  th.classList.remove('sortAsc','sortDesc');
  th.removeAttribute('aria-sort');
 });
 const active=table.tHead?.rows?.[0]?.cells?.[colIndex];
 if(active){
  active.classList.add(direction==='desc'?'sortDesc':'sortAsc');
  active.setAttribute('aria-sort',direction==='desc'?'descending':'ascending');
 }

 if(remember){
  TABLE_SORT_STATE.set(table.dataset.sortKey,{colIndex,direction});
 }
}

function initializeSortableTables(root=document){
 const tables=[...root.querySelectorAll('table')];
 tables.forEach((table,index)=>{
  const headerRow=table.tHead?.rows?.[0];
  if(!headerRow)return;

  tableSortKey(table,index);

  [...headerRow.cells].forEach((th,colIndex)=>{
   const label=String(th.textContent||'').trim().toLowerCase();
   const hasCheckbox=!!th.querySelector('input[type="checkbox"]');
   const actionColumn=['action','actions',''].includes(label) || hasCheckbox;

   if(actionColumn){
    th.classList.add('noTableSort');
    th.classList.remove('sortableHeader');
    th.onclick=null;
    return;
   }

   th.classList.add('sortableHeader');
   th.title=`Sort by ${String(th.textContent||'').trim()}`;
   th.tabIndex=0;

   const doSort=()=>{
    const current=TABLE_SORT_STATE.get(table.dataset.sortKey);
    const nextDirection=(current && current.colIndex===colIndex && current.direction==='asc')?'desc':'asc';
    applyTableSort(table,colIndex,nextDirection,true);
   };
   th.onclick=doSort;
   th.onkeydown=e=>{
    if(e.key==='Enter'||e.key===' '){
     e.preventDefault();
     doSort();
    }
   };
  });

  const saved=TABLE_SORT_STATE.get(table.dataset.sortKey);
  if(saved && saved.colIndex<headerRow.cells.length){
   applyTableSort(table,saved.colIndex,saved.direction,false);
  }
 });
}

function scheduleSortableTableRefresh(){
 clearTimeout(tableSortRefreshTimer);
 tableSortRefreshTimer=setTimeout(()=>initializeSortableTables(document),30);
}

// Tables are rebuilt by many render functions and by realtime sync.
// Re-attach sorting automatically whenever table markup changes.
const sortableTableObserver=new MutationObserver(mutations=>{
 if(mutations.some(m=>m.addedNodes?.length || m.removedNodes?.length)){
  scheduleSortableTableRefresh();
 }
});


let GLOBAL_INTERACTION_SCROLL_LOCK=null;

function beginGlobalInteractionLock(){
  GLOBAL_INTERACTION_SCROLL_LOCK={x:window.scrollX,y:window.scrollY,time:Date.now()};
}
function restoreGlobalInteractionLock(){
  if(!GLOBAL_INTERACTION_SCROLL_LOCK)return;
  const {x,y}=GLOBAL_INTERACTION_SCROLL_LOCK;

  // Restore only through the immediate click/render cycle.
  window.scrollTo(x,y);
  requestAnimationFrame(()=>window.scrollTo(x,y));
  setTimeout(()=>{
    window.scrollTo(x,y);
    GLOBAL_INTERACTION_SCROLL_LOCK=null;
  },45);
}

function isProtectedActionTarget(el){
  return !!el?.closest?.(
    'button,.btn,.closeBtn,input[type="checkbox"],[data-select-cell],' +
    '[data-delete-tx],[data-delete-completed-plan],[data-permanent-delete-tx],' +
    '[data-delete-cash-ledger],[data-delete-installment],[data-delete-plan],[data-delete-loan]'
  );
}

/* One capture-layer guard for every button/checkbox in the app.
   This stops parent rows/cards from stealing the click. */
/* Checkboxes: keep scroll position and prevent surrounding row navigation.
   Native checkbox behavior is preserved. */
function hardenAllActionControls(root=document){
  root.querySelectorAll('button,.btn,.closeBtn').forEach(btn=>{
    if(btn.dataset.interactionHardened==='1')return;
    btn.dataset.interactionHardened='1';

    // IMPORTANT: listeners are attached to the button itself, not document capture.
    // This lets the button's real click handler execute, while still stopping the row above it.
    btn.addEventListener('pointerdown',e=>{
      beginGlobalInteractionLock();
      e.stopPropagation();
    });

    btn.addEventListener('mousedown',e=>{
      e.stopPropagation();
    });

    btn.addEventListener('click',e=>{
      e.stopPropagation();
      restoreGlobalInteractionLock();
    });
  });

  root.querySelectorAll('input[type="checkbox"]').forEach(box=>{
    // Transaction selection has its own refresh-safe binding/delegation.
    // Do not add a second interaction layer after a table/cloud rerender.
    if(box.matches('[data-select-tx],#txMasterCheck,#detailTxMasterCheck'))return;
    if(box.dataset.interactionHardened==='1')return;
    box.dataset.interactionHardened='1';

    box.addEventListener('pointerdown',e=>{
      beginGlobalInteractionLock();
      e.stopPropagation();
    });

    box.addEventListener('mousedown',e=>{
      e.stopPropagation();
    });

    box.addEventListener('click',e=>{
      // Do NOT preventDefault: the native checkbox must be allowed to toggle.
      e.stopPropagation();
    });

    box.addEventListener('change',e=>{
      e.stopPropagation();
      restoreGlobalInteractionLock();
    });
  });

  // [data-select-cell] is deliberately excluded here. bindTxRows() owns those
  // cells so a refresh/re-render cannot stack a second click/pointer handler.
}

let ACTION_HARDEN_TIMER=null;
const ACTION_HARDEN_OBSERVER=new MutationObserver(mutations=>{
  const added=[];
  mutations.forEach(m=>m.addedNodes&&m.addedNodes.forEach(n=>{
    if(n.nodeType===1)added.push(n);
  }));
  if(!added.length)return;

  clearTimeout(ACTION_HARDEN_TIMER);
  ACTION_HARDEN_TIMER=setTimeout(()=>{
    added.forEach(node=>{
      if(node.matches?.('button,.btn,.closeBtn,input[type="checkbox"]')){
        hardenAllActionControls(node.parentElement||document);
      }else{
        hardenAllActionControls(node);
      }
    });
  },10);
});



let UI_REVIEW_SAVE_TIMER=null;
function scheduleReviewStateSave(){
 clearTimeout(UI_REVIEW_SAVE_TIMER);
 UI_REVIEW_SAVE_TIMER=setTimeout(()=>captureReviewState(),60);
}
window.addEventListener('scroll',scheduleReviewStateSave,{passive:true});
window.addEventListener('beforeunload',()=>captureReviewState());
document.addEventListener('change',e=>{
 if(e.target.closest?.('#transactions,#reports,#accountDetailContent'))scheduleReviewStateSave();
});
document.addEventListener('input',e=>{
 if(e.target.closest?.('#transactions,#reports'))scheduleReviewStateSave();
});


function V173SyncArchitectureAudit(){
 return {
  version:'V234',
  realtimePrimary:false,
  startupFullPull:false,
  periodicFallbackMs:30000,
  realtimeSubscriptionDisabled:true,
  focusPullDisabled:true,
  visibilityPullDisabled:false,
  localWritesImmediate:true,
  lastCloudUpdatedAt:recordSyncLastCloudUpdatedAt,
  activePage:activeViewId(),
  pending:getCloudMeta().pending===true,
  dangerousThreeSecondPolling:false,
  postPushFullPull:false
 };
}


var customBanks=JSON.parse(localStorage.getItem('pf_custom_banks')||'[]');if(!Array.isArray(customBanks))customBanks=[];
customBanks.forEach(b=>{if(b?.id&&!accounts.some(a=>a.id===b.id))accounts.push(b)});
function uaField(f){const full=f.full===false?'':'full',req=f.required?'required':'';if(f.type==='select')return '<div class="field '+full+'"><label>'+escapeHtml(f.label)+'</label><select name="'+f.name+'" '+req+'>'+f.options.map(o=>'<option value="'+escapeHtml(String(o.value))+'" '+(String(o.value)===String(f.value??'')?'selected':'')+'>'+escapeHtml(o.label)+'</option>').join('')+'</select></div>';return '<div class="field '+full+'"><label>'+escapeHtml(f.label)+'</label><input name="'+f.name+'" type="'+(f.type||'text')+'" value="'+escapeHtml(String(f.value??''))+'" '+(f.min!=null?'min="'+f.min+'" ':'')+(f.max!=null?'max="'+f.max+'" ':'')+(f.step!=null?'step="'+f.step+'" ':'')+(f.placeholder?'placeholder="'+escapeHtml(f.placeholder)+'" ':'')+req+'></div>'}
function openUnifiedAction(cfg){
 const modal=$('unifiedActionModal');
 $('unifiedActionTitle').textContent=cfg.title;
 $('unifiedActionSub').textContent=cfg.subtitle||'';
 $('unifiedActionSub').style.color='';
 $('unifiedActionSave').textContent=cfg.save||'Save';
 $('unifiedActionFields').innerHTML=cfg.fields.map(uaField).join('');
 $('unifiedActionForm').onsubmit=e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.currentTarget).entries());if(cfg.submit(v)!==false){modal.classList.remove('open');modal.style.display='';}};
 modal.querySelectorAll('[data-close="unifiedActionModal"]').forEach(btn=>{btn.onclick=e=>{e.preventDefault();e.stopPropagation();modal.classList.remove('open');modal.style.display='';};});
 modal.onclick=e=>{if(e.target===modal){modal.classList.remove('open');modal.style.display='';}};
 modal.classList.add('open');
}
function renderCustomBanks(){const el=$('customBanksList');if(!el)return;el.innerHTML=customBanks.length?customBanks.map(b=>'<div class="notice" style="margin-bottom:7px"><b>'+escapeHtml(b.bank)+' • '+escapeHtml(b.name)+' •'+escapeHtml(b.ending)+'</b> • '+money(adjustedBankBalance(b))+'</div>').join(''):'<div class="meta">No manually added bank accounts yet.</div>'}
function addCustomBank(){openUnifiedAction({title:'Add Bank Account',subtitle:'Structured entry form — same experience as Add Transaction.',save:'Add Bank',fields:[{name:'bank',label:'Bank Name',required:true,full:false},{name:'name',label:'Account Name',required:true,full:false},{name:'ending',label:'Last 4 Digits',required:true,full:false},{name:'balance',label:'Live Bank Balance (SAR)',type:'number',step:'0.01',min:'0',value:'0',required:true,full:false}],submit:v=>{const e=String(v.ending||'').replace(/\D/g,'').slice(-4),bal=Number(v.balance);if(e.length!==4||!Number.isFinite(bal)||bal<0){alert('Check last 4 digits and balance.');return false}const b={id:'custom-bank-'+e+'-'+Date.now(),bank:v.bank.trim(),name:v.name.trim(),ending:e,type:'bank',custom:true,extra:{}};customBanks.push(b);accounts.push(b);localStorage.setItem('pf_custom_banks',JSON.stringify(customBanks));setTrackedBankBalance(b.id,bal);saveLocal();renderCustomBanks();renderAccounts();renderDashboard();return true}})}
function goldActionError(message){$('unifiedActionSub').textContent=message;$('unifiedActionSub').style.color='var(--red)';return false;}
function goldActionSources(label='Monthly Planned Income'){return [{value:'cash-source',label},...accounts.filter(x=>x.type==='bank').map(x=>({value:x.id,label:accountName(x.id)}))];}
addGoldAsset=function(){openUnifiedAction({title:'Add Gold Asset',subtitle:'Use a unique asset name. Reusing an existing name updates that asset instead of counting it twice.',save:'Save Gold',fields:[{name:'name',label:'Asset Name',placeholder:'Gold Bar 1',required:true,full:false},{name:'goldType',label:'Gold Type',type:'select',value:'Bar',options:['Bar','Coin','Jewelry','Other'].map(x=>({value:x,label:x})),full:false},{name:'purity',label:'Purity',type:'select',value:'24K',options:['24K','22K','21K','18K'].map(x=>({value:x,label:x})),full:false},{name:'weight',label:'Weight (grams)',type:'number',step:'0.001',min:'0.001',required:true,full:false},{name:'purchasePrice',label:'Total Bought Price (SAR)',type:'number',step:'0.01',min:'0',required:true,full:false},{name:'purchaseDate',label:'Bought Date',type:'date',value:new Date().toISOString().slice(0,10),required:true,full:false}],submit:v=>{const name=String(v.name||'').trim(),w=Number(v.weight),p=Number(v.purchasePrice);if(!name||!(w>0)||!(p>=0)||!v.purchaseDate)return goldActionError('Complete all fields with valid values.');const existing=goldAssets.find(a=>normalizedGoldAssetName(a.name)===normalizedGoldAssetName(name));if(existing){existing.name=name;existing.goldType=v.goldType;existing.purity=v.purity;existing.weight=w;existing.purchasePrice=p;existing.purchaseDate=v.purchaseDate;existing.updatedAt=new Date().toISOString();}else{const seq=String((Math.max(0,...goldAssets.map(a=>Number(String(a.id||'').replace(/\D/g,''))||0))+1)).padStart(4,'0');goldAssets.push({id:'GLD-'+seq,name,goldType:v.goldType,purity:v.purity,weight:w,purchasePrice:p,purchaseDate:v.purchaseDate,notes:'',createdAt:new Date().toISOString()});}saveV194Data();renderGoldAssets();renderDashboard();return true}})}
editGoldAsset=function(id){const a=goldAssets.find(x=>x.id===id);if(!a)return;openUnifiedAction({title:'Edit Gold Asset',subtitle:`${a.name} • ${a.id}`,save:'Save Changes',fields:[{name:'name',label:'Asset Name',value:a.name,required:true,full:false},{name:'goldType',label:'Gold Type',type:'select',value:a.goldType||'Bar',options:['Bar','Coin','Jewelry','Other'].map(x=>({value:x,label:x})),full:false},{name:'purity',label:'Purity',type:'select',value:a.purity||'24K',options:['24K','22K','21K','18K'].map(x=>({value:x,label:x})),full:false},{name:'weight',label:'Original Weight (grams)',type:'number',step:'0.001',min:'0.001',value:a.weight,required:true,full:false},{name:'purchasePrice',label:'Purchase Price (SAR)',type:'number',step:'0.01',min:'0',value:a.purchasePrice,required:true,full:false},{name:'purchaseDate',label:'Bought Date',type:'date',value:a.purchaseDate,required:true,full:false}],submit:v=>{const name=String(v.name||'').trim(),w=Number(v.weight),p=Number(v.purchasePrice),sameName=goldAssets.find(x=>x.id!==id&&normalizedGoldAssetName(x.name)===normalizedGoldAssetName(name));if(sameName)return goldActionError(`Asset name already belongs to ${sameName.id}. Use a unique name.`);if(!name||!(w>0)||!(p>=0)||!v.purchaseDate)return goldActionError('Complete all fields with valid values.');Object.assign(a,{name,goldType:v.goldType,purity:v.purity,weight:w,purchasePrice:p,purchaseDate:v.purchaseDate,updatedAt:new Date().toISOString()});saveV194Data();renderGoldAssets();renderDashboard();return true}})};
sellGoldAsset=function(id){const a=goldAssets.find(x=>x.id===id);if(!a)return;const avail=activeGoldWeight(a);openUnifiedAction({title:'Sell Gold Asset',subtitle:`${a.name} • Available ${avail.toFixed(3)} g`,save:'Record Sale',fields:[{name:'weight',label:'Weight to Sell (grams)',type:'number',step:'0.001',min:'0.001',max:avail,value:avail.toFixed(3),required:true,full:false},{name:'proceeds',label:'Sale Proceeds (SAR)',type:'number',step:'0.01',min:'0',required:true,full:false},{name:'date',label:'Sale Date',type:'date',value:new Date().toISOString().slice(0,10),required:true,full:false},{name:'sourceId',label:'Receive Proceeds To',type:'select',value:'cash-source',options:goldActionSources('Monthly Cash Flow'),full:false}],submit:v=>{const w=Number(v.weight),proceeds=Number(v.proceeds);if(!(w>0)||w>avail+.0001||!(proceeds>=0)||!v.date)return goldActionError('Check the sale weight, proceeds and date.');const src=v.sourceId==='cash-source'?{id:'cash-source',name:'Monthly Cash Flow'}:{id:v.sourceId,name:accountName(v.sourceId)};const allocatedCost=Number(a.purchasePrice||0)*(w/Number(a.weight||1));goldSaleHistory.push({id:'GSALE-'+Date.now(),assetId:a.id,assetName:a.name,date:v.date,weight:w,proceeds,receivedToId:src.id,receivedToName:src.name,gainLoss:proceeds-allocatedCost});incomePlan.extraIncomeHistory=incomePlan.extraIncomeHistory||[];incomePlan.extraIncomeHistory.push({id:'gold-sale-'+Date.now(),date:v.date,month:v.date.slice(0,7),amount:proceeds,note:`Gold sale • ${a.name} • ${w} g`});if(src.id!=='cash-source'){const ba=account(src.id);if(ba?.type==='bank')setTrackedBankBalance(ba.id,adjustedBankBalance(ba)+proceeds);}localStorage.setItem('pf_income_plan',JSON.stringify(incomePlan));saveV194Data();saveLocal();renderGoldAssets();renderIncomePlan();renderDashboard();renderAccounts();return true}})};
payGoldZakat=function(id){const a=goldAssets.find(x=>x.id===id);if(!a||!goldZakatDue(a))return;const w=activeGoldWeight(a),value=goldAssetValue(a),amount=Math.round(value*.025*100)/100,due=goldNextDue(a);openUnifiedAction({title:'Pay Gold Zakat',subtitle:`${a.name} • Zakat due ${money(amount)}`,save:'Record Zakat Payment',fields:[{name:'sourceId',label:'Pay From',type:'select',value:'cash-source',options:goldActionSources(),full:false},{name:'date',label:'Payment Date',type:'date',value:new Date().toISOString().slice(0,10),required:true,full:false}],submit:v=>{if(!v.sourceId||!v.date)return goldActionError('Select the payment source and date.');const src=v.sourceId==='cash-source'?{id:'cash-source',name:'Monthly Planned Income'}:{id:v.sourceId,name:accountName(v.sourceId)},h=hijriParts(new Date(due+'T12:00:00'));goldZakatHistory.push({id:'ZAK-'+Date.now(),assetId:a.id,assetName:a.name,hijriCycle:String(h.year),weight:w,valueUsed:value,amount,paidDate:v.date,sourceId:src.id,sourceName:src.name});cashFlowLedger.push({id:'cfl-zakat-'+Date.now(),type:'zakat-payment',date:v.date,month:v.date.slice(0,7),amount,direction:'out',description:`Gold Zakat • ${a.name}`,sourceId:src.id,targetId:a.id,status:'active'});if(src.id!=='cash-source'){const ba=account(src.id);if(ba?.type==='bank')setTrackedBankBalance(ba.id,adjustedBankBalance(ba)-amount);}saveV194Data();localStorage.setItem('pf_cash_flow_ledger',JSON.stringify(cashFlowLedger));saveLocal();renderGoldAssets();renderDashboard();renderIncomePlan();renderAccounts();return true}})};
manualGoldMarketPrice=function(){openUnifiedAction({title:'Manual Gold Market Price',subtitle:'Set the current 24K gold price per gram in SAR.',save:'Update Price',fields:[{name:'price',label:'24K Price / Gram (SAR)',type:'number',step:'0.01',min:'0.01',value:Number(goldMarket.price24k||0).toFixed(2),required:true,full:false}],submit:v=>{const price=Number(v.price);if(!(price>0))return goldActionError('Enter a valid gold price greater than zero.');goldMarket={price24k:price,updatedAt:new Date().toISOString(),source:'Manual Saudi market price',manual:true};saveV194Data();renderGoldAssets();renderDashboard();return true}})};
addCustomCreditCard=function(){openUnifiedAction({title:'Add Credit Card',subtitle:'Structured entry form — same experience as Add Transaction.',save:'Add Credit Card',fields:[{name:'bank',label:'Bank Name',required:true,full:false},{name:'name',label:'Card Name',placeholder:'Visa Signature',required:true,full:false},{name:'ending',label:'Last 4 Digits',required:true,full:false},{name:'limit',label:'Credit Limit (SAR)',type:'number',step:'0.01',min:'0',value:'0',required:true,full:false},{name:'statementDay',label:'Statement Closing Day',type:'number',min:'1',max:'31',value:'25',required:true,full:false},{name:'dueDay',label:'Payment Due Day',type:'number',min:'1',max:'31',value:'15',required:true,full:false}],submit:v=>{const e=String(v.ending||'').replace(/\D/g,'').slice(-4),limit=Number(v.limit);if(e.length!==4||!Number.isFinite(limit)||limit<0)return false;const id='custom-card-'+e+'-'+Date.now(),cc={id,bank:v.bank,name:v.name,ending:e,type:'card',extra:{'Credit Limit':limit},custom:true,physicalCards:[e]};customCreditCards.push(cc);accounts.push(cc);financeSettings.cardCycles[id]={statementDay:Math.max(1,Math.min(31,Number(v.statementDay)||25)),dueDay:Math.max(1,Math.min(31,Number(v.dueDay)||15))};localStorage.setItem('pf_finance_settings',JSON.stringify(financeSettings));saveV194Data();saveLocal();renderCustomCreditCards();renderFinanceSettings();renderDashboard();renderAccounts();return true}})}

$('execAddTx')?.addEventListener('click',()=>$('quickAddTransaction')?.click());$('execImport')?.addEventListener('click',()=>nav('importstatements'));$('execAddInst')?.addEventListener('click',()=>$('quickInstallment')?.click());$('execAddGold')?.addEventListener('click',()=>{nav('assets');setTimeout(()=>addGoldAsset(),0)});
async function init(){
 // V261: show the Executive shell immediately while local finance state restores.
 // This removes the blank/legacy first-run wait without changing financial data.
 document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='executive'));
 document.body.classList.add('execMode');
 document.body.classList.remove('strategyMode','txMode','accountMode','modernMode');
 if($('execTopDate'))$('execTopDate').textContent=new Date().toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});
 const shellUpdated=$('execUpdated');if(shellUpdated)shellUpdated.textContent='Loading saved finance data…';
 await new Promise(resolve=>requestAnimationFrame(()=>resolve()));

 // Restore local finance state before calculating any financial values.
 let localSavedAt='';
 try{const localState=await financeDB.get('finance_state');localSavedAt=localState?.savedAt||'';}catch(_){}
 await financeDB.restore();
 // V260: transactions[] is a derived runtime array. financeDB.restore() replaces
 // importedTransactions/manualTransactions, so rebuild it before any lazy page render.
 // Without this, Transactions can show 0 rows until another action happens to rebuild it.
 rebuildTransactions();
 // Auth is intentionally started in parallel after local restore; the UI does
 // not await Supabase before becoming usable.
 const sessionPromise=Promise.resolve().then(()=>cloudRefreshAuth()).catch(e=>{console.warn('Cloud auth deferred',e);return null;});
 let session=null;
 // Cloud startup is deferred until after the local UI is painted below.
 // Run each startup migration once only.
 migrateSabAwayFromLegacySeed();
 normalizeSabInstallmentPlan();
 reconcileRemainingPrincipalPlans();
 const autoExcludedDuplicates=cleanupExistingImportedStatementDuplicates();
 if(autoExcludedDuplicates)console.info(`Auto-excluded ${autoExcludedDuplicates} imported duplicate transaction(s).`);
 ensureRequiredInstallmentSeeds();
 normalizeBalanceOffers();
 reconcileExistingImportedStatements();
 installments.forEach(p=>{if(p.cardId==='sab-440880'&&p.planType==='balance-offer')p.offerScope='full';});
 localStorage.setItem('pf_installments',JSON.stringify(installments));
 normalizeCardPaymentPlan();
 migrateCashFlowLedger();
 let incomeBudgetMigrationChanged=false;
 cardPaymentPlan.forEach(p=>(p.paymentHistory||[]).forEach(h=>{
  if(h.mirrored)return;
  const mk=paymentBudgetMonth(h);
  // V91 repairs the earlier automatic behavior. Historical payments from a bank/card
  // do not touch Monthly Planned Income unless they were explicitly created under V91+.
  if(!String(h.incomeDecisionVersion||'').startsWith('V91')){
   h.deductFromIncome=(h.sourceId==='cash-source');
   h.budgetMonth=mk;
   h.incomeDecisionVersion='V91-migrated';
   incomeBudgetMigrationChanged=true;
  }
 }));
 if(incomeBudgetMigrationChanged)saveCardPaymentPlan();
 const reconciledInstallmentStatements=reconcileExistingInstallmentStatementTransfers();
 // V155: no fixed statement amount is re-applied at startup.
 if(reconciledInstallmentStatements)console.info(`Reconciled ${reconciledInstallmentStatements} existing installment transaction(s) against their original statement.`);
 ensurePartialPaymentFields();
 financeDB.save();
 fillAccountSelect($('txAccount'));fillAccountSelect($('reportAccount'));fillAccountSelect($('importAccount'));fillCategorySelect($('txCategory'));
 const pm=plannerDefaultMonth();$('paymentMonth').value=/^\d{4}-\d{2}$/.test(pm)?pm:'2026-09';ensureMonthlyPlannerRows($('paymentMonth').value);$('paymentMonth').addEventListener('change',renderPaymentPlanner);

// V194 bindings
$('addGoldAsset')?.addEventListener('click',addGoldAsset);
$('refreshGoldPrice')?.addEventListener('click',refreshGoldMarketPrice);
$('manualGoldPrice')?.addEventListener('click',manualGoldMarketPrice);
$('addStatementFormat')?.addEventListener('click',addStatementFormat);
$('exportStatementFormats')?.addEventListener('click',exportStatementFormats);
$('statementFormatFile')?.addEventListener('change',e=>{const f=e.target.files?.[0];if(f)importStatementFormatsFile(f);e.target.value='';});
$('addCustomCreditCard')?.addEventListener('click',addCustomCreditCard);$('addCustomBank')?.addEventListener('click',addCustomBank);
renderCustomCreditCards();

$('paymentDetailsBack').addEventListener('click',()=>{nav('dashboard');renderPaymentPlanner();});fillCategorySelect($('reportCategory'));
 $('reportFrom').value='2026-07-31';$('reportTo').value='2026-08-28';fillReportSubcategories();

 if($('addLoanSetting'))$('addLoanSetting').onclick=addLoanSetting;
 if($('saveFinanceSettingsBtn'))$('saveFinanceSettingsBtn').onclick=()=>saveFinanceSettings(true);
 renderOutgoings();
 const selfTestIssues=runtimeSelfTest();
 if(selfTestIssues.length)console.error('Runtime self-test issues:',selfTestIssues);
 // V259: first-load performance. Do not render every hidden page here.
 // The active page renderer is selected below after local finance state is ready.
 updateDbStatus(true);
 window.__financeStateInitialized=true;
 window.__financeInitComplete=true;

 // Restore only the page the user was reviewing. A clean session renders
 // Executive Overview once. Other modules are rendered lazily by nav().
 const savedUi=loadSavedReviewState();
 if(savedUi && savedUi.page && document.getElementById(savedUi.page)){
  restoreReviewPage(savedUi,{restoreScroll:true});
 }else{
  nav('executive');
  captureReviewState();
 }

 // Finish cloud authentication/sync in the background. Never block the page.
 sessionPromise.then(s=>{
  session=s;
  if(!s)return;
  setTimeout(async()=>{
   try{
    const ok=await startRealtimeRecordSync();
    updateCloudSyncPanel(ok);
    if(!ok)cloudSetStatus('Signed in • protected sync pending');
   }catch(e){console.warn('Deferred cloud sync warning',e);}
  },250);
 });
}

try{
 sortableTableObserver.observe(document.body,{childList:true,subtree:true});
 initializeSortableTables(document);
}catch(e){
 console.warn('Table sorting initialization warning',e);
}
try{
  hardenAllActionControls(document);
  ACTION_HARDEN_OBSERVER.observe(document.body,{childList:true,subtree:true});
}catch(e){
  console.warn('Action hardening warning',e);
}
init();

function updateV91CloudStatus(){
 const el=document.getElementById('v74CloudStatus'); if(!el)return;
 const cs=document.getElementById('cloudStatus');
 const txt=(cs?.textContent||'').toLowerCase();
 if(/signed in|connected|synced/.test(txt) && !/not connected|signed out/.test(txt)){
  el.textContent='Connected';el.style.color='var(--green)';
 }else if(/checking/.test(txt)){
  el.textContent='Checking…';el.style.color='';
 }else{
  el.textContent='Not Connected / Sign In';el.style.color='var(--orange)';
 }
}
setInterval(updateV91CloudStatus,1200);
setTimeout(updateV91CloudStatus,300);