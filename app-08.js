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
 if(tableSortRefreshTimer)return;
 // MutationObserver already runs in the browser's microtask checkpoint. Keep the
 // refresh in that same checkpoint so saved row order is restored before paint.
 tableSortRefreshTimer=true;
 queueMicrotask(()=>{
  tableSortRefreshTimer=null;
  initializeSortableTables(document);
 });
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
  version:window.APP_BUILD_VERSION||'3.37',
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
function syncCustomAccountsIntoAccounts(){
 const customIds=new Set([...(customBanks||[]),...(customCreditCards||[])].map(x=>x?.id).filter(Boolean));
 for(let i=accounts.length-1;i>=0;i--)if(accounts[i]?.custom===true&&customIds.has(accounts[i].id)===false)accounts.splice(i,1);
 [...(customBanks||[]),...(customCreditCards||[])].forEach(a=>{
  if(!a?.id)return;
  const i=accounts.findIndex(x=>x.id===a.id);
  if(i>=0)accounts[i]=a; else accounts.push(a);
 });
}
function refreshAccountDependentUI(){
 syncCustomAccountsIntoAccounts();
 ['txAccount','reportAccount','importAccount'].forEach(id=>{const el=$(id);if(el)fillAccountSelect(el);});
 try{renderCustomBanks();renderCustomCreditCards();renderCreditCardCalendar();renderAccounts();renderDashboard();}catch(e){console.warn('Account UI refresh',e);}
 if(document.querySelector('#financeSettings.active'))renderFinanceSettings(true);
 if(document.querySelector('#incomeplan.active'))renderIncomePlan();
 if(document.querySelector('#installments.active'))renderInstallments();
}
syncCustomAccountsIntoAccounts();
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
function renderCustomBanks(){const el=$('customBanksList');if(!el)return;el.innerHTML=customBanks.length?customBanks.map(b=>'<div class="notice customAccountEditRow" style="margin-bottom:7px"><div><b>'+escapeHtml(b.bank)+' • '+escapeHtml(b.name)+' •'+escapeHtml(b.ending)+'</b> • '+money(adjustedBankBalance(b))+'</div><button type="button" class="btn small" data-edit-bank="'+escapeHtml(b.id)+'">Edit</button></div>').join(''):'<div class="meta">No manually added bank accounts yet.</div>';el.querySelectorAll('[data-edit-bank]').forEach(btn=>btn.addEventListener('click',()=>editCustomBank(btn.dataset.editBank)))}
function editCustomBank(id){
 const current=customBanks.find(b=>b.id===id);if(!current)return;
 openUnifiedAction({title:'Edit Bank Account',subtitle:'Update account details and the current tracked bank balance.',save:'Save Changes',fields:[{name:'bank',label:'Bank Name',value:current.bank,required:true,full:false},{name:'name',label:'Account Name',value:current.name,required:true,full:false},{name:'ending',label:'Last 4 Digits',value:current.ending,required:true,full:false},{name:'balance',label:'Live Bank Balance (SAR)',type:'number',step:'0.01',min:'0',value:adjustedBankBalance(current),required:true,full:false}],submit:v=>{
  const ending=String(v.ending||'').replace(/\D/g,'').slice(-4),balance=Number(v.balance);
  if(ending.length!==4||!Number.isFinite(balance)||balance<0)return goldActionError('Enter exactly four digits and a valid bank balance.');
  Object.assign(current,{bank:String(v.bank||'').trim(),name:String(v.name||'').trim(),ending,updatedAt:new Date().toISOString()});
  localStorage.setItem('pf_custom_banks',JSON.stringify(customBanks));
  syncCustomAccountsIntoAccounts();setTrackedBankBalance(current.id,balance);saveLocal();scheduleRecordPush('custom-bank-edit');refreshAccountDependentUI();return true;
 }});
}
function addCustomBank(){openUnifiedAction({title:'Add Bank Account',subtitle:'This account will be available across transactions, imports, payment sources, reports and dashboards.',save:'Add Bank',fields:[{name:'bank',label:'Bank Name',required:true,full:false},{name:'name',label:'Account Name',required:true,full:false},{name:'ending',label:'Last 4 Digits',required:true,full:false},{name:'balance',label:'Live Bank Balance (SAR)',type:'number',step:'0.01',min:'0',value:'0',required:true,full:false}],submit:v=>{const e=String(v.ending||'').replace(/\D/g,'').slice(-4),bal=Number(v.balance);if(e.length!==4||!Number.isFinite(bal)||bal<0)return goldActionError('Enter exactly 4 digits and a valid bank balance.');const b={id:'custom-bank-'+e+'-'+Date.now(),bank:String(v.bank||'').trim(),name:String(v.name||'').trim(),ending:e,type:'bank',custom:true,balance:bal,balanceLabel:'Live Balance',extra:{}};customBanks.push(b);localStorage.setItem('pf_custom_banks',JSON.stringify(customBanks));syncCustomAccountsIntoAccounts();setTrackedBankBalance(b.id,bal);saveLocal();scheduleRecordPush('custom-bank-add');refreshAccountDependentUI();return true}})}
function openBankTransfer(){
 const banks=accounts.filter(a=>a.type==='bank');
 const destinations=accounts.filter(a=>a.type==='bank'||a.type==='card');
 if(!banks.length||destinations.length<2){alert('Add a bank account and another account or credit card to make a transfer.');return;}
 const sourceOptions=banks.map(a=>({value:a.id,label:accountName(a.id)}));
 const targetOptions=destinations.map(a=>({value:a.id,label:accountName(a.id)+(a.type==='card'?' (Credit Card)':' (Bank Account)')}));
 openUnifiedAction({title:'Transfer From Bank Account',subtitle:'Send money to another bank account or pay a credit card to restore its available credit.',save:'Continue',fields:[
  {name:'sourceId',label:'From Bank Account',type:'select',value:banks[0].id,options:sourceOptions,required:true,full:false},
  {name:'targetId',label:'To Bank Account / Credit Card',type:'select',value:destinations.find(a=>a.id!==banks[0].id)?.id,options:targetOptions,required:true,full:false},
  {name:'amount',label:'Amount (SAR)',type:'number',step:'0.01',min:'0.01',required:true,full:false},
  {name:'date',label:'Transfer Date',type:'date',value:new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10),required:true,full:false},
  {name:'note',label:'Note',placeholder:'Optional transfer reference',full:true}
 ],submit:v=>{
  const source=account(v.sourceId),target=account(v.targetId),amount=Number(v.amount);
  if(!source||!target||source.type!=='bank'||!['bank','card'].includes(target.type)||source.id===target.id)return goldActionError('Select a bank source and a different bank account or credit card.');
  if(!Number.isFinite(amount)||amount<=0||Math.round(amount*100)!==amount*100)return goldActionError('Enter an amount greater than zero with no more than two decimals.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(v.date)||!Number.isFinite(Date.parse(v.date+'T12:00:00')))return goldActionError('Enter a valid transfer date.');
  if(amount>adjustedBankBalance(source)+0.001)return goldActionError('Transfer amount exceeds the source account balance.');
  if(target.type==='card'){
   const month=paymentMonthForTransaction(target.id,v.date);
   ensureMonthlyPlannerRows(month);
   const plan=cardPaymentPlan.filter(p=>p.accountId===target.id&&p.month===month&&!p.upcomingOnly)
    .sort((a,b)=>releasedPaymentRowPriority(b)-releasedPaymentRowPriority(a))[0];
   if(!plan)return goldActionError('Could not create the card payment cycle.');
   $('paymentPlanId').value=plan.id;
   $('paymentTargetCard').value=accountName(target.id);
   $('paymentAmountInput').value=amount.toFixed(2);
   $('paymentAmountInput').removeAttribute('max');
   $('paymentAmountInput').dataset.currentDue=Math.max(0,Number(paymentRemainingAmount(plan)||0)).toFixed(2);
   $('paymentDateInput').value=v.date;
   $('paymentSourceSelect').innerHTML=paymentSourceOptions(target.id).map(o=>`<option value="${escapeHtml(o.id)}">${escapeHtml(o.label)}</option>`).join('');
   $('paymentSourceSelect').value=source.id;
   $('paymentUseMonthlyIncome').checked=false;
   syncPaymentIncomeChoiceToSource();updatePaymentSourcePreview();
   $('paymentSourceModal').classList.add('open');
   return true;
  }
  const id='bank-transfer-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
  addCashFlowLedgerEntry({id,type:'bank-transfer',date:v.date,amount,sourceId:source.id,sourceName:accountName(source.id),targetId:target.id,targetName:accountName(target.id),description:String(v.note||'').trim()||'Bank account transfer',referenceId:id});
  saveLocal();syncCashFlowLedgerImmediate();refreshAccountDependentUI();renderIncomePlan();return true;
 }});
}
function bindCustomAccountButtons(){
 const bank=$('addCustomBank'),card=$('addCustomCreditCard');
 if(bank){bank.type='button';bank.onclick=e=>{e.preventDefault();addCustomBank();};bank.dataset.accountActionBound='1';}
 if(card){card.type='button';card.onclick=e=>{e.preventDefault();addCustomCreditCard();};card.dataset.accountActionBound='1';}
 const transfer=$('openBankTransfer');if(transfer){transfer.type='button';transfer.onclick=e=>{e.preventDefault();openBankTransfer();};}
}
function goldActionError(message){$('unifiedActionSub').textContent=message;$('unifiedActionSub').style.color='var(--red)';return false;}
function goldActionSources(label='Monthly Planned Income'){return [{value:'cash-source',label},...accounts.filter(x=>x.type==='bank').map(x=>({value:x.id,label:accountName(x.id)}))];}
addGoldAsset=function(){openUnifiedAction({title:'Add Gold Asset',subtitle:'Use a unique asset name. Reusing an existing name updates that asset instead of counting it twice.',save:'Save Gold',fields:[{name:'name',label:'Asset Name',placeholder:'Gold Bar 1',required:true,full:false},{name:'goldType',label:'Gold Type',type:'select',value:'Bar',options:['Bar','Coin','Jewelry','Other'].map(x=>({value:x,label:x})),full:false},{name:'purity',label:'Purity',type:'select',value:'24K',options:['24K','22K','21K','18K'].map(x=>({value:x,label:x})),full:false},{name:'weight',label:'Weight (grams)',type:'number',step:'0.001',min:'0.001',required:true,full:false},{name:'purchasePrice',label:'Total Bought Price (SAR)',type:'number',step:'0.01',min:'0',required:true,full:false},{name:'purchaseDate',label:'Bought Date',type:'date',value:new Date().toISOString().slice(0,10),required:true,full:false}],submit:v=>{const name=String(v.name||'').trim(),w=Number(v.weight),p=Number(v.purchasePrice);if(!name||!(w>0)||!(p>=0)||!v.purchaseDate)return goldActionError('Complete all fields with valid values.');const existing=goldAssets.find(a=>normalizedGoldAssetName(a.name)===normalizedGoldAssetName(name));if(existing){existing.name=name;existing.goldType=v.goldType;existing.purity=v.purity;existing.weight=w;existing.purchasePrice=p;existing.purchaseDate=v.purchaseDate;existing.updatedAt=new Date().toISOString();}else{const seq=String((Math.max(0,...goldAssets.map(a=>Number(String(a.id||'').replace(/\D/g,''))||0))+1)).padStart(4,'0');goldAssets.push({id:'GLD-'+seq,name,goldType:v.goldType,purity:v.purity,weight:w,purchasePrice:p,purchaseDate:v.purchaseDate,notes:'',createdAt:new Date().toISOString()});}saveV194Data();renderGoldAssets();renderDashboard();return true}})}
editGoldAsset=function(id){const a=goldAssets.find(x=>x.id===id);if(!a)return;openUnifiedAction({title:'Edit Gold Asset',subtitle:`${a.name} • ${a.id}`,save:'Save Changes',fields:[{name:'name',label:'Asset Name',value:a.name,required:true,full:false},{name:'goldType',label:'Gold Type',type:'select',value:a.goldType||'Bar',options:['Bar','Coin','Jewelry','Other'].map(x=>({value:x,label:x})),full:false},{name:'purity',label:'Purity',type:'select',value:a.purity||'24K',options:['24K','22K','21K','18K'].map(x=>({value:x,label:x})),full:false},{name:'weight',label:'Original Weight (grams)',type:'number',step:'0.001',min:'0.001',value:a.weight,required:true,full:false},{name:'purchasePrice',label:'Purchase Price (SAR)',type:'number',step:'0.01',min:'0',value:a.purchasePrice,required:true,full:false},{name:'purchaseDate',label:'Bought Date',type:'date',value:a.purchaseDate,required:true,full:false}],submit:v=>{const name=String(v.name||'').trim(),w=Number(v.weight),p=Number(v.purchasePrice),sameName=goldAssets.find(x=>x.id!==id&&normalizedGoldAssetName(x.name)===normalizedGoldAssetName(name));if(sameName)return goldActionError(`Asset name already belongs to ${sameName.id}. Use a unique name.`);if(!name||!(w>0)||!(p>=0)||!v.purchaseDate)return goldActionError('Complete all fields with valid values.');Object.assign(a,{name,goldType:v.goldType,purity:v.purity,weight:w,purchasePrice:p,purchaseDate:v.purchaseDate,updatedAt:new Date().toISOString()});saveV194Data();renderGoldAssets();renderDashboard();return true}})};
sellGoldAsset=function(id){const a=goldAssets.find(x=>x.id===id);if(!a)return;const avail=activeGoldWeight(a);openUnifiedAction({title:'Sell Gold Asset',subtitle:`${a.name} • Available ${avail.toFixed(3)} g`,save:'Record Sale',fields:[{name:'weight',label:'Weight to Sell (grams)',type:'number',step:'0.001',min:'0.001',max:avail,value:avail.toFixed(3),required:true,full:false},{name:'proceeds',label:'Sale Proceeds (SAR)',type:'number',step:'0.01',min:'0',required:true,full:false},{name:'date',label:'Sale Date',type:'date',value:new Date().toISOString().slice(0,10),required:true,full:false},{name:'sourceId',label:'Receive Proceeds To',type:'select',value:'cash-source',options:goldActionSources('Monthly Cash Flow'),full:false}],submit:v=>{const w=Number(v.weight),proceeds=Number(v.proceeds);if(!(w>0)||w>avail+.0001||!(proceeds>=0)||!v.date)return goldActionError('Check the sale weight, proceeds and date.');const src=v.sourceId==='cash-source'?{id:'cash-source',name:'Monthly Cash Flow'}:{id:v.sourceId,name:accountName(v.sourceId)};const allocatedCost=Number(a.purchasePrice||0)*(w/Number(a.weight||1));goldSaleHistory.push({id:'GSALE-'+Date.now(),assetId:a.id,assetName:a.name,date:v.date,weight:w,proceeds,receivedToId:src.id,receivedToName:src.name,gainLoss:proceeds-allocatedCost});incomePlan.extraIncomeHistory=incomePlan.extraIncomeHistory||[];incomePlan.extraIncomeHistory.push({id:'gold-sale-'+Date.now(),date:v.date,month:v.date.slice(0,7),amount:proceeds,note:`Gold sale • ${a.name} • ${w} g`});if(src.id!=='cash-source'){const ba=account(src.id);if(ba?.type==='bank')setTrackedBankBalance(ba.id,adjustedBankBalance(ba)+proceeds);}localStorage.setItem('pf_income_plan',JSON.stringify(incomePlan));saveV194Data();saveLocal();renderGoldAssets();renderIncomePlan();renderDashboard();renderAccounts();return true}})};
payGoldZakat=function(id){const a=goldAssets.find(x=>x.id===id);if(!a||!goldZakatDue(a))return;const w=activeGoldWeight(a),value=goldAssetValue(a),amount=Math.round(value*.025*100)/100,due=goldNextDue(a);openUnifiedAction({title:'Pay Gold Zakat',subtitle:`${a.name} • Zakat due ${money(amount)}`,save:'Record Zakat Payment',fields:[{name:'sourceId',label:'Pay From',type:'select',value:'cash-source',options:goldActionSources(),full:false},{name:'date',label:'Payment Date',type:'date',value:new Date().toISOString().slice(0,10),required:true,full:false}],submit:v=>{if(!v.sourceId||!v.date)return goldActionError('Select the payment source and date.');const src=v.sourceId==='cash-source'?{id:'cash-source',name:'Monthly Planned Income'}:{id:v.sourceId,name:accountName(v.sourceId)},h=hijriParts(new Date(due+'T12:00:00'));goldZakatHistory.push({id:'ZAK-'+Date.now(),assetId:a.id,assetName:a.name,hijriCycle:String(h.year),weight:w,valueUsed:value,amount,paidDate:v.date,sourceId:src.id,sourceName:src.name});cashFlowLedger.push({id:'cfl-zakat-'+Date.now(),type:'zakat-payment',date:v.date,month:v.date.slice(0,7),amount,direction:'out',description:`Gold Zakat • ${a.name}`,sourceId:src.id,targetId:a.id,status:'active'});if(src.id!=='cash-source'){const ba=account(src.id);if(ba?.type==='bank')setTrackedBankBalance(ba.id,adjustedBankBalance(ba)-amount);}saveV194Data();localStorage.setItem('pf_cash_flow_ledger',JSON.stringify(cashFlowLedger));saveLocal();renderGoldAssets();renderDashboard();renderIncomePlan();renderAccounts();return true}})};

function goldZakatLedgerRow(z){
 return (cashFlowLedger||[]).find(r=>(z.ledgerId&&r.id===z.ledgerId)||(!z.ledgerId&&r.type==='zakat-payment'&&r.targetId===z.assetId&&r.date===z.paidDate&&Math.abs(Number(r.amount||0)-Number(z.amount||0))<0.01&&r.status!=='reversed'))||null;
}
function adjustZakatBankBalance(sourceId,delta){
 if(!sourceId||sourceId==='cash-source')return;
 const bank=account(sourceId);
 if(bank?.type==='bank')setTrackedBankBalance(bank.id,adjustedBankBalance(bank)+Number(delta||0));
}
function refreshAfterGoldZakatChange(){
 localStorage.setItem('pf_gold_zakat_history',JSON.stringify(goldZakatHistory));
 localStorage.setItem('pf_cash_flow_ledger',JSON.stringify(cashFlowLedger));
 saveV194Data();saveLocal();renderGoldAssets();renderDashboard();renderIncomePlan();renderAccounts();
}
payGoldZakat=function(id){
 const a=goldAssets.find(x=>x.id===id);if(!a||!goldZakatDue(a))return;
 const w=activeGoldWeight(a),value=goldAssetValue(a),amount=Math.round(value*.025*100)/100,due=goldNextDue(a);
 openUnifiedAction({title:'Pay Gold Zakat',subtitle:`${a.name} • Zakat due ${money(amount)}`,save:'Record Zakat Payment',
  fields:[{name:'sourceId',label:'Pay From',type:'select',value:'cash-source',options:goldActionSources(),full:false},{name:'date',label:'Payment Date',type:'date',value:new Date().toISOString().slice(0,10),required:true,full:false}],
  submit:v=>{
   if(!v.sourceId||!v.date)return goldActionError('Select the payment source and date.');
   const src=v.sourceId==='cash-source'?{id:'cash-source',name:'Monthly Planned Income'}:{id:v.sourceId,name:accountName(v.sourceId)};
   const h=hijriParts(new Date(due+'T12:00:00')),stamp=Date.now(),zakatId='ZAK-'+stamp,ledgerId='cfl-zakat-'+stamp;
   goldZakatHistory.push({id:zakatId,assetId:a.id,assetName:a.name,hijriCycle:String(h.year),weight:w,valueUsed:value,amount,paidDate:v.date,sourceId:src.id,sourceName:src.name,ledgerId});
   cashFlowLedger.push({id:ledgerId,type:'zakat-payment',date:v.date,month:v.date.slice(0,7),amount,direction:'out',description:`Gold Zakat • ${a.name}`,sourceId:src.id,targetId:a.id,status:'active',referenceId:zakatId});
   adjustZakatBankBalance(src.id,-amount);
   refreshAfterGoldZakatChange();
   return true;
  }
 });
};
function editGoldZakatPayment(id){
 const z=goldZakatHistory.find(x=>x.id===id);if(!z)return;
 openUnifiedAction({title:'Edit Zakat Payment',subtitle:`${z.assetName} • ${z.id}`,save:'Save Changes',
  fields:[
   {name:'amount',label:'Zakat Paid (SAR)',type:'number',step:'0.01',min:'0.01',value:Number(z.amount||0).toFixed(2),required:true,full:false},
   {name:'date',label:'Paid Date',type:'date',value:z.paidDate,required:true,full:false},
   {name:'sourceId',label:'Paid From',type:'select',value:z.sourceId||'cash-source',options:goldActionSources(),full:false}
  ],
  submit:v=>{
   const amount=Number(v.amount);if(!(amount>0)||!v.date||!v.sourceId)return goldActionError('Enter a valid amount, payment date and source.');
   const ledger=goldZakatLedgerRow(z);
   adjustZakatBankBalance(z.sourceId,Number(z.amount||0));
   const src=v.sourceId==='cash-source'?{id:'cash-source',name:'Monthly Planned Income'}:{id:v.sourceId,name:accountName(v.sourceId)};
   adjustZakatBankBalance(src.id,-amount);
   Object.assign(z,{amount,paidDate:v.date,sourceId:src.id,sourceName:src.name,updatedAt:new Date().toISOString()});
   if(ledger){
    Object.assign(ledger,{date:v.date,month:v.date.slice(0,7),amount,sourceId:src.id,status:'active',updatedAt:new Date().toISOString()});
    z.ledgerId=ledger.id;
   }else{
    const ledgerId='cfl-zakat-'+Date.now();
    cashFlowLedger.push({id:ledgerId,type:'zakat-payment',date:v.date,month:v.date.slice(0,7),amount,direction:'out',description:`Gold Zakat • ${z.assetName}`,sourceId:src.id,targetId:z.assetId,status:'active',referenceId:z.id});
    z.ledgerId=ledgerId;
   }
   refreshAfterGoldZakatChange();
   return true;
  }
 });
}
function deleteGoldZakatPayment(id){
 const i=goldZakatHistory.findIndex(x=>x.id===id);if(i<0)return;
 const z=goldZakatHistory[i];
 if(!confirm(`Delete this Zakat payment?\n\n${z.assetName} • ${money(z.amount)} • ${z.paidDate}\n\nThis restores any bank deduction, reverses the cash-flow entry, and removes the payment from Zakat history.`))return;
 adjustZakatBankBalance(z.sourceId,Number(z.amount||0));
 const ledger=goldZakatLedgerRow(z);
 if(ledger)Object.assign(ledger,{status:'reversed',reversedAt:new Date().toISOString(),reversalReason:'Zakat payment deleted'});
 goldZakatHistory.splice(i,1);
 refreshAfterGoldZakatChange();
 if(typeof recordImmediateDelete==='function')recordImmediateDelete('personal_assets_zakat',z.id,'zakat-payment-delete');
}

manualGoldMarketPrice=function(){openUnifiedAction({title:'Manual Gold Market Price',subtitle:'Set the current 24K gold price per gram in SAR.',save:'Update Price',fields:[{name:'price',label:'24K Price / Gram (SAR)',type:'number',step:'0.01',min:'0.01',value:Number(goldMarket.price24k||0).toFixed(2),required:true,full:false}],submit:v=>{const price=Number(v.price);if(!(price>0))return goldActionError('Enter a valid gold price greater than zero.');goldMarket={price24k:price,updatedAt:new Date().toISOString(),source:'Manual Saudi market price',manual:true};saveV194Data();renderGoldAssets();renderDashboard();return true}})};
addCustomCreditCard=function(){openUnifiedAction({title:'Add Credit Card',subtitle:'The new card will use the same statement-cycle, payment-plan, installment, transaction, import and available-credit logic as existing cards.',save:'Add Credit Card',fields:[{name:'bank',label:'Bank Name',required:true,full:false},{name:'name',label:'Card Name',placeholder:'Visa Signature',required:true,full:false},{name:'ending',label:'Last 4 Digits',required:true,full:false},{name:'limit',label:'Credit Limit (SAR)',type:'number',step:'0.01',min:'0',value:'0',required:true,full:false},{name:'statementDay',label:'Statement Closing Day',type:'number',min:'1',max:'31',value:'25',required:true,full:false},{name:'dueDay',label:'Payment Due Day',type:'number',min:'1',max:'31',value:'15',required:true,full:false}],submit:v=>{const e=String(v.ending||'').replace(/\D/g,'').slice(-4),limit=Number(v.limit);if(e.length!==4||!Number.isFinite(limit)||limit<0)return goldActionError('Enter exactly 4 digits and a valid credit limit.');const id='custom-card-'+e+'-'+Date.now(),cc={id,bank:String(v.bank||'').trim(),name:String(v.name||'').trim(),ending:e,type:'card',extra:{'Credit Limit':limit,'Physical Cards':[e]},custom:true};customCreditCards.push(cc);financeSettings.cardCycles[id]={statementDay:Math.max(1,Math.min(31,Number(v.statementDay)||25)),dueDay:Math.max(1,Math.min(31,Number(v.dueDay)||15))};localStorage.setItem('pf_custom_credit_cards',JSON.stringify(customCreditCards));localStorage.setItem('pf_finance_settings',JSON.stringify(financeSettings));syncCustomAccountsIntoAccounts();saveV194Data();saveLocal();financeSettingsDirty=true;scheduleRecordPush('custom-credit-card-add');refreshAccountDependentUI();return true}})}

function editableFinanceCards(){
 const seen=new Set();
 return accounts.filter(a=>a?.type==='card'&&!seen.has(a.id)&&seen.add(a.id));
}
function editFinanceCreditCard(id){
 const current=account(id);if(!current||current.type!=='card')return;
 const cycle=cardCycleSetting(id),oldEnding=String(current.ending||'');
 openUnifiedAction({
  title:'Edit Credit Card',subtitle:`${current.bank||'Credit Card'} •${oldEnding}`,save:'Save Card Changes',
  fields:[
   {name:'bank',label:'Bank Name',value:current.bank||'',required:true,full:false},
   {name:'name',label:'Card Name',value:current.name||'',required:true,full:false},
   {name:'ending',label:'Last 4 Digits',value:oldEnding,required:true,full:false},
   {name:'limit',label:'Credit Limit (SAR)',type:'number',step:'0.01',min:'0',value:Number(current.extra?.['Credit Limit']||0),required:true,full:false},
   {name:'statementDay',label:'Statement Closing Day',type:'number',min:'1',max:'31',value:Number(cycle.statementDay||25),required:true,full:false},
   {name:'dueDay',label:'Payment Due Day',type:'number',min:'1',max:'31',value:Number(cycle.dueDay||15),required:true,full:false}
  ],
  submit:v=>{
   const ending=String(v.ending||'').replace(/\D/g,'').slice(-4),limit=Number(v.limit);
   if(ending.length!==4||!Number.isFinite(limit)||limit<0)return goldActionError('Enter exactly 4 digits and a valid credit limit.');
   const existingPhysical=[...(current.extra?.['Physical Cards']||current.physicalCards||[oldEnding])].map(x=>String(x||'')).filter(Boolean);
   const physical=[...new Set([ending,...existingPhysical.filter(x=>x!==oldEnding)])];
   const edited={...current,bank:String(v.bank||'').trim(),name:String(v.name||'').trim(),ending,type:'card',custom:true,extra:{...(current.extra||{}),'Credit Limit':limit,'Physical Cards':physical},physicalCards:physical,updatedAt:new Date().toISOString()};
   const i=customCreditCards.findIndex(c=>c.id===id);if(i>=0)customCreditCards[i]=edited;else customCreditCards.push(edited);
   financeSettings.cardCycles[id]={statementDay:Math.max(1,Math.min(31,Number(v.statementDay)||25)),dueDay:Math.max(1,Math.min(31,Number(v.dueDay)||15))};
   localStorage.setItem('pf_custom_credit_cards',JSON.stringify(customCreditCards));
   localStorage.setItem('pf_finance_settings',JSON.stringify(financeSettings));
   syncCustomAccountsIntoAccounts();saveV194Data();saveLocal();financeSettingsDirty=true;scheduleRecordPush('credit-card-edit');refreshAccountDependentUI();
   return true;
  }
 });
}
renderCustomCreditCards=function(){
 const el=$('customCreditCardsList');if(!el)return;
 const cards=editableFinanceCards();
 el.innerHTML=cards.length?cards.map(c=>`<div class="notice customAccountEditRow"><div><b>${escapeHtml(c.bank)} • ${escapeHtml(c.name)} •${escapeHtml(c.ending)}</b><span> • Limit ${money(Number(c.extra?.['Credit Limit']||0))}</span></div><button type="button" class="btn small" data-edit-credit-card="${escapeHtml(c.id)}">Edit</button></div>`).join(''):'<div class="meta">No credit cards saved yet.</div>';
 el.querySelectorAll('[data-edit-credit-card]').forEach(btn=>btn.onclick=()=>editFinanceCreditCard(btn.dataset.editCreditCard));
}

$('execAddTx')?.addEventListener('click',()=>openManualTransaction());$('execImport')?.addEventListener('click',()=>nav('importstatements'));$('execAddInst')?.addEventListener('click',()=>openInstallment());$('execAddGold')?.addEventListener('click',()=>{nav('assets');setTimeout(()=>addGoldAsset(),0)});
async function init(){
 // V261: show the Executive shell immediately while local finance state restores.
 // This removes the blank/legacy first-run wait without changing financial data.
 document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='executive'));
 document.body.classList.add('execMode');
 document.body.classList.remove('strategyMode','txMode','accountMode','modernMode','cloudMode');
 if($('execTopDate'))$('execTopDate').textContent=new Date().toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});
 const shellUpdated=$('execUpdated');if(shellUpdated)shellUpdated.textContent='Loading saved finance data…';

 // V275: critical controls are live BEFORE any IndexedDB/cloud wait.
 // A slow/blocked restore must never make Settings action buttons appear dead.
 bindCustomAccountButtons();

 // V275: paint Executive immediately from the already-loaded localStorage state.
 // Then IndexedDB may enrich/replace that state and we repaint. This removes the
 // first-load dependency that previously left the dashboard empty until navigation.
 const startupUi=loadSavedReviewState();
 if(!startupUi || !startupUi.page || startupUi.page==='executive'){
  try{
   rebuildTransactions();
   normalizeCardPaymentPlan();
   ensureLedgerBackedPlannerRows();
   rebuildAllPlannerPaymentsFromLedger();
   reconcileRemainingPrincipalPlans();
   ensurePartialPaymentFields();
   renderExecutiveDashboard();
   window.__financeFirstDataPaint=true;
  }catch(e){console.error('V275 immediate Executive paint failed',e);}
 }
 await new Promise(resolve=>requestAnimationFrame(()=>resolve()));

 // Restore IndexedDB, but never let a blocked database hold the whole application.
 let localSavedAt='';
 try{const localState=await Promise.race([financeDB.get('finance_state'),new Promise(resolve=>setTimeout(()=>resolve(null),900))]);localSavedAt=localState?.savedAt||'';}catch(_){}
 const restorePromise=Promise.resolve().then(()=>financeDB.restore()).catch(e=>{console.warn('Deferred IndexedDB restore failed',e);return false;});
 const restored=await Promise.race([restorePromise,new Promise(resolve=>setTimeout(()=>resolve(false),1200))]);
 if(restored){
  rebuildTransactions();normalizeCardPaymentPlan();ensureLedgerBackedPlannerRows();rebuildAllPlannerPaymentsFromLedger();reconcileRemainingPrincipalPlans();ensurePartialPaymentFields();
  if(!startupUi || !startupUi.page || startupUi.page==='executive')renderExecutiveDashboard();
 }else{
  // If IndexedDB finishes later, repaint the active Executive page with restored data.
  restorePromise.then(ok=>{
   if(!ok)return;
   try{
    rebuildTransactions();normalizeCardPaymentPlan();ensureLedgerBackedPlannerRows();rebuildAllPlannerPaymentsFromLedger();reconcileRemainingPrincipalPlans();ensurePartialPaymentFields();
    if(document.getElementById('executive')?.classList.contains('active'))renderExecutiveDashboard();
   }catch(e){console.warn('Late IndexedDB repaint failed',e);}
  });
 }
 bindCustomAccountButtons();

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
 const pm=plannerDefaultMonth(), paymentMonthEl=$('paymentMonth');if(paymentMonthEl){paymentMonthEl.value=/^\d{4}-\d{2}$/.test(pm)?pm:'2026-09';ensureMonthlyPlannerRows(paymentMonthEl.value);paymentMonthEl.addEventListener('change',renderPaymentPlanner);}

// V194 bindings
// V265: assign gold controls directly after all legacy/modern function overrides are loaded.
// onclick avoids duplicate listeners and guarantees the current unified-action implementation is called.
if($('addGoldAsset'))$('addGoldAsset').onclick=e=>{e.preventDefault();addGoldAsset();};
if($('refreshGoldPrice'))$('refreshGoldPrice').onclick=async e=>{
 e.preventDefault();
 const btn=e.currentTarget,old=btn.textContent;
 btn.disabled=true;btn.textContent='Refreshing…';
 try{await refreshGoldMarketPrice();}
 finally{btn.disabled=false;btn.textContent=old;}
};
if($('manualGoldPrice'))$('manualGoldPrice').onclick=e=>{e.preventDefault();manualGoldMarketPrice();};
$('addStatementFormat')?.addEventListener('click',addStatementFormat);
$('exportStatementFormats')?.addEventListener('click',exportStatementFormats);
$('statementFormatFile')?.addEventListener('change',e=>{const f=e.target.files?.[0];if(f)importStatementFormatsFile(f);e.target.value='';});
bindCustomAccountButtons();

renderCustomCreditCards();

$('paymentDetailsBack').addEventListener('click',()=>{nav('dashboard');renderPaymentPlanner();});fillCategorySelect($('reportCategory'));
 setReportCurrentMonthDates();fillReportSubcategories();

 if($('addLoanSetting'))$('addLoanSetting').onclick=addLoanSetting;
 if($('saveFinanceSettingsBtn'))$('saveFinanceSettingsBtn').onclick=()=>saveFinanceSettings(true);
 // V262: do not render a hidden Outgoings page during first load.
 const selfTestIssues=runtimeSelfTest();
 if(selfTestIssues.length)console.error('Runtime self-test issues:',selfTestIssues);
 // V259: first-load performance. Do not render every hidden page here.
 // The active page renderer is selected below after local finance state is ready.
 updateDbStatus(true);
 window.__financeStateInitialized=true;
 window.__financeInitComplete=true;

 // Restore only the page the user was reviewing. A clean session renders
 // Executive Overview once. Other modules are rendered lazily by nav().
 const savedUi=startupUi||loadSavedReviewState();
 if(savedUi && savedUi.page && document.getElementById(savedUi.page)){
  if(savedUi.page==='executive' && window.__financeFirstDataPaint){
   restoreReviewControls(savedUi);
   requestAnimationFrame(()=>captureReviewState());
  }else{
   restoreReviewPage(savedUi,{restoreScroll:true});
  }
 }else{
  if(!window.__financeFirstDataPaint)nav('executive');
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
// V279: final browser-load hydration. The Executive page is rendered again only
// after the complete DOM, split scripts and local persistence layer are available.
// This makes a direct cold load follow the same render path as navigating away/back.
function v279HydrateActivePage(){
 try{
  if(typeof syncCustomAccountsIntoAccounts==='function')syncCustomAccountsIntoAccounts();
  if(document.getElementById('executive')?.classList.contains('active')){
   rebuildTransactions();
   normalizeCardPaymentPlan();
   ensureLedgerBackedPlannerRows();
   rebuildAllPlannerPaymentsFromLedger();
   reconcileRemainingPrincipalPlans();
   ensurePartialPaymentFields();
   renderExecutiveDashboard();
  }
  if(document.getElementById('financeSettings')?.classList.contains('active'))renderFinanceSettings(true);
 }catch(e){console.error('V279 final hydration failed',e);}
}
window.addEventListener('load',()=>{
 v279HydrateActivePage();
 setTimeout(v279HydrateActivePage,250);
 setTimeout(v279HydrateActivePage,1000);
},{once:true});

init().catch(err=>{
 console.error('V275 initialization failed',err);
 const u=$('execUpdated');if(u)u.textContent='Local data loaded • startup maintenance warning';
 try{if(document.getElementById('executive')?.classList.contains('active'))renderExecutiveDashboard();}catch(_){}
});

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

// V266: gold controls use one delegated action route.
document.addEventListener('click',async e=>{
 const btn=e.target.closest?.('#addGoldAsset,#manualGoldPrice,#refreshGoldPrice');
 if(!btn)return;
 e.preventDefault();
 e.stopPropagation();
 if(btn.id==='addGoldAsset'){ addGoldAsset(); return; }
 if(btn.id==='manualGoldPrice'){ manualGoldMarketPrice(); return; }
 if(btn.id==='refreshGoldPrice'){
  if(btn.dataset.goldRefreshing==='1')return;
  btn.dataset.goldRefreshing='1';
  const old=btn.textContent;
  btn.disabled=true;
  btn.textContent='Refreshing…';
  try{ await refreshGoldMarketPrice(); }
  catch(err){
   console.error('Gold price refresh failed',err);
   const meta=$('goldPriceMeta');
   if(meta)meta.textContent='Live price unavailable • '+(err?.message||'Refresh failed')+' • use Manual Price';
  }finally{
   btn.disabled=false;
   btn.textContent=old;
   delete btn.dataset.goldRefreshing;
  }
 }
},true);

// V267: statement format library uses Excel mapping templates and delegated actions.
function statementFormatExcelTemplate(){
 const rows=[
  ['Statement Format Template','','','','','','','',''],
  ['Format Name','Example Bank / Card','','','','','','',''],
  ['Account/Card ID','Use account/card ID from My Finance or leave blank for any account','','','','','','',''],
  ['Header Row','1','','','','','','',''],
  ['Data Starts Row','2','','','','','','',''],
  ['','','','','','','','',''],
  ['FIELD','COLUMN LETTER','REQUIRED','EXAMPLE','NOTES','','','',''],
  ['Date','A','YES','2026-09-19','Transaction date','','','',''],
  ['Description','B','YES','Merchant / transaction description','Main transaction text','','','',''],
  ['Debit','C','NO','125.50','Use when debit and credit are separate columns','','','',''],
  ['Credit','D','NO','500.00','Use when debit and credit are separate columns','','','',''],
  ['Amount','E','NO','-125.50','Use instead of Debit/Credit when statement has one signed amount column','','','',''],
  ['Balance','F','NO','8425.35','Optional running/available balance','','','',''],
  ['Reference','G','NO','REF12345','Optional transaction reference','','','',''],
  ['Card Last 4','H','NO','0955','Optional physical-card identifier','','','',''],
  ['Type','I','NO','Purchase','Optional bank transaction type','','','','']
 ];
 const esc=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
 return rows.map(r=>r.map(esc).join(',')).join('\r\n');
}
function downloadStatementFormatExcelTemplate(){
 const csv='\ufeff'+statementFormatExcelTemplate();
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);
 a.download='statement-format-mapping-template.csv';
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(a.href),500);
}
function openStatementFormatBuilder(){
 openUnifiedAction({
  title:'Add Statement Format',
  subtitle:'Create an Excel/CSV column map. Use column letters from the bank statement.',
  save:'Save Format',
  fields:[
   {name:'name',label:'Format Name',required:true,placeholder:'Example: Al Rajhi Current Account Excel'},
   {name:'accountId',label:'Account / Card ID',placeholder:'Optional — blank means any account'},
   {name:'fileType',label:'Statement File Type',type:'select',value:'XLSX',options:[
    {value:'XLSX',label:'Excel (.xlsx)'},{value:'CSV',label:'CSV (.csv)'}
   ]},
   {name:'headerRow',label:'Header Row',type:'number',value:'1',min:1,required:true},
   {name:'dataStartRow',label:'Data Starts Row',type:'number',value:'2',min:1,required:true},
   {name:'dateColumn',label:'Date Column',value:'A',required:true,placeholder:'A'},
   {name:'descriptionColumn',label:'Description Column',value:'B',required:true,placeholder:'B'},
   {name:'amountColumn',label:'Amount Column',placeholder:'E — use this OR Debit/Credit'},
   {name:'debitColumn',label:'Debit Column',placeholder:'C — optional'},
   {name:'creditColumn',label:'Credit Column',placeholder:'D — optional'},
   {name:'balanceColumn',label:'Balance Column',placeholder:'F — optional'},
   {name:'referenceColumn',label:'Reference Column',placeholder:'G — optional'},
   {name:'cardLast4Column',label:'Card Last 4 Column',placeholder:'H — optional'}
  ],
  submit:v=>{
   const clean=x=>String(x||'').trim().toUpperCase();
   if(!clean(v.amountColumn)&&!clean(v.debitColumn)&&!clean(v.creditColumn)){
    $('unifiedActionSub').textContent='Map Amount, or map Debit/Credit columns.';
    $('unifiedActionSub').style.color='#ff6474';return false;
   }
   const mappingObj={
    headerRow:Number(v.headerRow||1),dataStartRow:Number(v.dataStartRow||2),
    date:clean(v.dateColumn),description:clean(v.descriptionColumn),
    amount:clean(v.amountColumn),debit:clean(v.debitColumn),credit:clean(v.creditColumn),
    balance:clean(v.balanceColumn),reference:clean(v.referenceColumn),cardLast4:clean(v.cardLast4Column)
   };
   statementFormats.push({
    id:'fmt-'+Date.now(),name:String(v.name).trim(),accountId:String(v.accountId||'').trim(),
    fileType:v.fileType||'XLSX',mapping:'Excel column mapping',mappingConfig:mappingObj,
    active:true,builtIn:false
   });
   saveV194Data();renderStatementFormats();return true;
  }
 });
}
function exportStatementFormatsV267(){
 const payload={type:'personal-finance-statement-formats',version:2,exportedAt:new Date().toISOString(),formats:statementFormats};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='my-finance-statement-formats.json';
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),500);
}
document.addEventListener('click',e=>{
 const btn=e.target.closest?.('#addStatementFormat,#exportStatementFormats,#downloadStatementFormatTemplate');
 if(!btn)return;
 e.preventDefault();e.stopPropagation();
 if(btn.id==='addStatementFormat')openStatementFormatBuilder();
 else if(btn.id==='exportStatementFormats')exportStatementFormatsV267();
 else downloadStatementFormatExcelTemplate();
},true);

// V268: editable/remappable statement format library.
function statementFormatMappingSummary(f){
 const m=f?.mappingConfig;
 if(!m)return f?.mapping||'Built-in parser';
 const bits=[m.date&&('Date='+m.date),m.description&&('Description='+m.description),m.amount&&('Amount='+m.amount),m.debit&&('Debit='+m.debit),m.credit&&('Credit='+m.credit),m.balance&&('Balance='+m.balance)].filter(Boolean);
 return bits.join(' · ')||'Excel column mapping';
}
function openStatementFormatBuilderV268(existing=null){
 const m=existing?.mappingConfig||{};
 openUnifiedAction({
  title:existing?'Edit / Remap Statement Format':'Add Statement Format',
  subtitle:'Map the exact Excel/CSV columns. Changing a mapping affects future imports only.',
  save:existing?'Save Remapping':'Save Format',
  fields:[
   {name:'name',label:'Format Name',required:true,value:existing?.name||'',placeholder:'Example: Al Rajhi Current Account Excel'},
   {name:'accountId',label:'Account / Card ID',value:existing?.accountId||'',placeholder:'Optional — blank means any account'},
   {name:'fileType',label:'Statement File Type',type:'select',value:(existing?.fileType||'XLSX').includes('CSV')?'CSV':'XLSX',options:[
    {value:'XLSX',label:'Excel (.xlsx)'},{value:'CSV',label:'CSV (.csv)'}
   ]},
   {name:'headerRow',label:'Header Row',type:'number',value:String(m.headerRow||1),min:1,required:true},
   {name:'dataStartRow',label:'Data Starts Row',type:'number',value:String(m.dataStartRow||2),min:1,required:true},
   {name:'dateColumn',label:'Date Column',value:m.date||'A',required:true,placeholder:'A'},
   {name:'descriptionColumn',label:'Description Column',value:m.description||'B',required:true,placeholder:'B'},
   {name:'amountColumn',label:'Amount Column',value:m.amount||'',placeholder:'E — use this OR Debit/Credit'},
   {name:'debitColumn',label:'Debit Column',value:m.debit||'',placeholder:'C — optional'},
   {name:'creditColumn',label:'Credit Column',value:m.credit||'',placeholder:'D — optional'},
   {name:'balanceColumn',label:'Balance Column',value:m.balance||'',placeholder:'F — optional'},
   {name:'referenceColumn',label:'Reference Column',value:m.reference||'',placeholder:'G — optional'},
   {name:'cardLast4Column',label:'Card Last 4 Column',value:m.cardLast4||'',placeholder:'H — optional'}
  ],
  submit:v=>{
   const clean=x=>String(x||'').trim().toUpperCase();
   if(!clean(v.amountColumn)&&!clean(v.debitColumn)&&!clean(v.creditColumn)){
    $('unifiedActionSub').textContent='Map Amount, or map Debit/Credit columns.';
    $('unifiedActionSub').style.color='#ff6474';return false;
   }
   const obj={
    headerRow:Number(v.headerRow||1),dataStartRow:Number(v.dataStartRow||2),
    date:clean(v.dateColumn),description:clean(v.descriptionColumn),amount:clean(v.amountColumn),
    debit:clean(v.debitColumn),credit:clean(v.creditColumn),balance:clean(v.balanceColumn),
    reference:clean(v.referenceColumn),cardLast4:clean(v.cardLast4Column)
   };
   const target=existing||{id:'fmt-'+Date.now(),active:true,builtIn:false};
   target.name=String(v.name).trim();target.accountId=String(v.accountId||'').trim();
   target.fileType=v.fileType||'XLSX';target.mapping='Excel column mapping';target.mappingConfig=obj;
   target.builtIn=false;target.active=target.active!==false;
   if(!existing)statementFormats.push(target);
   saveV194Data();renderStatementFormatsV268();return true;
  }
 });
}
function renderStatementFormatsV268(){
 const b=$('statementFormatsBody');if(!b)return;
 b.innerHTML=statementFormats.map(f=>`<tr>
  <td><b>${escapeHtml(f.name)}</b></td>
  <td>${escapeHtml(accountName(f.accountId)||f.accountId||'Any')}</td>
  <td>${escapeHtml(f.fileType||'')}</td>
  <td>${escapeHtml(statementFormatMappingSummary(f))}</td>
  <td><span class="badge ${f.active!==false?'active':''}">${f.active!==false?'Active':'Inactive'}</span></td>
  <td><div style="display:flex;gap:6px;flex-wrap:wrap">
   <button class="btn small" type="button" data-edit-format="${f.id}">${f.mappingConfig?'Edit / Remap':'Remap'}</button>
   <button class="btn small danger" type="button" data-delete-format-v268="${f.id}">Delete</button>
  </div></td></tr>`).join('');
}
const _renderStatementFormatsV268Legacy=renderStatementFormats;
renderStatementFormats=renderStatementFormatsV268;
document.addEventListener('click',e=>{
 const edit=e.target.closest?.('[data-edit-format]');
 const del=e.target.closest?.('[data-delete-format-v268]');
 if(!edit&&!del)return;
 e.preventDefault();e.stopPropagation();
 if(edit){
  const f=statementFormats.find(x=>x.id===edit.dataset.editFormat);
  if(f)openStatementFormatBuilderV268(f);
  return;
 }
 const f=statementFormats.find(x=>x.id===del.dataset.deleteFormatV268);
 if(!f)return;
 if(confirm(`Delete statement format "${f.name}"? This removes the format definition only; imported transactions are not deleted.`)){
  statementFormats=statementFormats.filter(x=>x.id!==f.id);
  saveV194Data();renderStatementFormatsV268();
 }
},true);
openStatementFormatBuilder=openStatementFormatBuilderV268;
setTimeout(()=>{try{renderStatementFormatsV268();}catch(e){console.warn('V268 statement format render',e)}},0);
