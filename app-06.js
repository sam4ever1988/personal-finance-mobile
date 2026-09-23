function applyMeemOfficialStatement(meta){
 if(!meta||meta.type!=='meem-official')return {updated:false};
 const card=account('meem-7102');if(!card)return {updated:false};

 // Link this uploaded statement only to its own payment/statement month.
 const payMonth=meta.dueDate
  ? String(meta.dueDate).slice(0,7)
  : (meta.statementEnd?String(meta.statementEnd).slice(0,7):currentYearMonth());

 // Replace only meem rows for THIS cycle. Other statement months stay untouched.
 cardPaymentPlan=cardPaymentPlan.filter(p=>!(p.accountId==='meem-7102' && p.month===payMonth));

 // Official bank statement is the source of truth for its cycle.
 if(Number.isFinite(Number(meta.totalDue))){
  cardPaymentPlan.push({
   id:`meem-official-${payMonth}`,
   accountId:'meem-7102',
   month:payMonth,
   amount:Number(meta.totalDue),
   due:meta.dueDate||'',
   label:'Official meem statement',
   source:'confirmed',
   note:`Official GIB/meem statement${meta.statementStart&&meta.statementEnd?` ${meta.statementStart} to ${meta.statementEnd}`:''}. Total amount due ${money(Number(meta.totalDue))}.`,
   statementOfficial:true,
   statementOriginalAmount:Number(meta.totalDue),
   statementFileName:meta.fileName||'',
   statementStart:meta.statementStart||'',
   statementEnd:meta.statementEnd||'',
   importedAt:new Date().toISOString(),
   paid:false,paidAmount:0,paymentHistory:[]
  });
 }

 // Replace old meem seeded/legacy installment definitions with the exact official statement plans.
 installments=installments.filter(p=>p.cardId!=='meem-7102' || !(
  String(p.id||'').startsWith('meem-') ||
  /Ashal|Tiqmo|5290820017/i.test(String(p.description||'')) ||
  /Bank\/User confirmed|Official meem statement/i.test(String(p.source||''))
 ));
 (meta.plans||[]).forEach(p=>installments.push({...p}));

 card.extra=card.extra||{};
 card.extra['Last Official Meem Statement Month']=payMonth;
 if(Number.isFinite(Number(meta.closingBalance)))card.extra['Last Statement Closing Balance']=Number(meta.closingBalance);
 if(Number.isFinite(Number(meta.totalDue)))card.extra['Last Statement Total Due']=Number(meta.totalDue);
 if(Number.isFinite(Number(meta.minimumDue)))card.extra['Last Statement Minimum Due']=Number(meta.minimumDue);
 if(meta.dueDate)card.extra['Last Statement Due Date']=meta.dueDate;
 if(meta.statementStart)card.extra['Last Statement Start']=meta.statementStart;
 if(meta.statementEnd)card.extra['Last Statement End']=meta.statementEnd;

 // The reset card remains date-driven for all new activity after this official statement.
 resetCardIds.add('meem-7102');

 // Remove imported lines that are actually Ashal setup/reversal metadata, not normal spending.
 importedTransactions.forEach(t=>{
  if(t.account!=='meem-7102')return;
  if(/5290820017|Ashal/i.test(String(t.description||''))){
   transactionActions[t._id]={
    status:'excluded-duplicate',
    reason:'Official meem statement installment metadata — excluded from normal transaction spending',
    updatedAt:new Date().toISOString()
   };
  }
 });

 rebuildTransactions();
 rebuildResetCardPlannerRows('meem-7102');
 saveCardPaymentPlan();
 localStorage.setItem('pf_installments',JSON.stringify(installments));
 localStorage.setItem('pf_accounts',JSON.stringify(accounts));
 localStorage.setItem('pf_reset_card_ids',JSON.stringify([...resetCardIds]));
 localStorage.setItem('pf_transaction_actions',JSON.stringify(transactionActions));
 saveLocal();

 return {updated:true,amount:Number(meta.totalDue||0),due:meta.dueDate||'',paymentMonth:payMonth};
}

async function parseStatementFile(file,accountId,statementMonth=''){
 const name=file.name.toLowerCase();

 if(name.endsWith('.csv')){
  return parseCsvRows(await file.text())
   .map(r=>normalizeImportedRow(r,accountId,statementMonth))
   .filter(Boolean);
 }

 if(name.endsWith('.xlsx')||name.endsWith('.xls')){
  if(typeof XLSX==='undefined')throw new Error('Excel import library is unavailable. Reload while connected to the internet.');
  const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});
  const detected=detectWorkbookAccount(wb,accountId);
  accountId=detected.accountId||accountId;
  if($('importAccount'))$('importAccount').value=accountId;

  if($('importAccountHint')){
   if(detected.confidence==='high'){
    $('importAccountHint').innerHTML=`Auto-detected: <b>${detected.bank||'Bank'} •${detected.ending}</b> → <b>${accountName(accountId)}</b>`;
   }else if(detected.confidence==='medium'){
    $('importAccountHint').innerHTML=`Bank detected as <b>${detected.bank}</b>. Assigned to <b>${accountName(accountId)}</b>. Please verify before importing.`;
   }else{
    $('importAccountHint').textContent='Bank/card could not be detected automatically. Please select the correct account/card before importing.';
   }
  }

  const rows=workbookRows(wb,accountId);
  const normalized=rows
   .map(r=>normalizeImportedRow(r,accountId,statementMonth))
   .filter(Boolean);

  if(accountId==='ar-0955' && $('importAccountHint')){
   const counts={};
   normalized.forEach(t=>counts[t.physicalCardEnding]=(counts[t.physicalCardEnding]||0)+1);
   const summary=Object.entries(counts)
    .map(([ending,count])=>`${physicalCardLabelFor(accountId,ending)}: ${count}`)
    .join(' • ');
   if(summary){
    $('importAccountHint').innerHTML=`Al Rajhi Excel auto-assigned by physical card: <b>${summary}</b>. Review the preview before importing.`;
   }
  }
  return normalized;
 }

 if(name.endsWith('.pdf')){
  if(typeof pdfjsLib==='undefined')throw new Error('PDF import library is unavailable. Reload while connected to the internet.');
  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
  const out=[];
  let firstText='';

  // Read the first pages for statement/account detection.
  for(let pp=1;pp<=Math.min(pdf.numPages,2);pp++){
   const pg0=await pdf.getPage(pp),tc0=await pg0.getTextContent();
   firstText+=' '+tc0.items.map(x=>x.str).join(' ');
  }

  // Al Rajhi •0955 official PDF:
  // transaction sections are assigned to Primary •0955 / Supplementary •9345 / •9634.
  if(isAlRajhi0955OfficialPdfText(firstText)){
   accountId='ar-0955';
   if($('importAccount'))$('importAccount').value=accountId;
   if($('importAccountHint')){
    $('importAccountHint').innerHTML='Al Rajhi •0955 official PDF detected. Primary and supplementary card sections will be assigned automatically.';
   }

   importStatementMeta=null;
   let currentEnding=String(account(accountId)?.ending||'0955');
   let pendingHeaderKind='';

   for(let p=1;p<=pdf.numPages;p++){
    importStatus(`Reading Al Rajhi statement page ${p} of ${pdf.numPages}…`);
    const pg=await pdf.getPage(p),tc=await pg.getTextContent();
    const lines=pdfLines(tc.items);

    for(let i=0;i<lines.length;i++){
     const line=lines[i];

     const headerKind=alRajhiSectionHeaderKind(line);
     const headerEnding=alRajhiPhysicalCardEndingFromHeaderLine(line,accountId);

     if(headerKind){
      pendingHeaderKind=headerKind;
      if(headerEnding){
       currentEnding=headerEnding;
       pendingHeaderKind='';
      }else if(headerKind==='primary'){
       currentEnding=String(account(accountId)?.ending||'0955');
      }
      continue;
     }

     // Often the masked card number is extracted on the line immediately after the heading.
     if(pendingHeaderKind){
      const nearbyEnding=alRajhiMaskedEndingFromLine(line,accountId);
      if(nearbyEnding){
       currentEnding=nearbyEnding;
       pendingHeaderKind='';
       continue;
      }
      // Do not let a stale pending heading linger into transaction rows.
      if(/\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/.test(line))pendingHeaderKind='';
     }

     // A masked card number may also appear on a standalone line inside the section.
     const inlineEnding=alRajhiMaskedEndingFromLine(line,accountId);
     if(inlineEnding && !/\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/.test(line)){
      currentEnding=inlineEnding;
      continue;
     }

     const r=parsePdfLineHeuristic(line,accountId,statementMonth,currentEnding);
     if(r)out.push(r);
    }
   }

   if(!out.length){
    throw new Error('Al Rajhi PDF was detected, but no transaction rows could be read. Please use the Excel transaction export for this statement.');
   }

   // Show what was assigned before the user confirms import.
   const counts={};
   out.forEach(t=>counts[t.physicalCardEnding]=(counts[t.physicalCardEnding]||0)+1);
   if($('importAccountHint')){
    const summary=Object.entries(counts)
     .map(([ending,count])=>`${physicalCardLabelFor(accountId,ending)}: ${count}`)
     .join(' • ');
    $('importAccountHint').innerHTML=`Al Rajhi •0955 PDF auto-assigned by physical card: <b>${summary}</b>. Review the preview before importing.`;
   }
   return out;
  }

  // Official meem/GIB •7102 parser.
  const meemMeta=parseMeemOfficialStatementMeta(firstText,file.name);
  if(meemMeta){
   accountId='meem-7102';
   if($('importAccount'))$('importAccount').value=accountId;
   importStatementMeta=meemMeta;

   for(let p=1;p<=Math.min(pdf.numPages,2);p++){
    importStatus(`Reading official meem statement page ${p} of ${pdf.numPages}…`);
    const pg=await pdf.getPage(p),tc=await pg.getTextContent();
    pdfLines(tc.items).forEach(line=>{
     if(/5290820017|Ashal Instalments Program|برنامج أسهل/i.test(line))return;
     const r=parsePdfLineHeuristic(line,accountId,'',String(account(accountId)?.ending||''));
     if(r)out.push(r);
    });
   }
   return out;
  }

  importStatementMeta=null;
  for(let p=1;p<=pdf.numPages;p++){
   importStatus(`Reading PDF page ${p} of ${pdf.numPages}…`);
   const pg=await pdf.getPage(p),tc=await pg.getTextContent();
   pdfLines(tc.items).forEach(line=>{
    const r=parsePdfLineHeuristic(line,accountId,statementMonth,String(account(accountId)?.ending||''));
    if(r)out.push(r);
   });
  }
  return out;
 }

 throw new Error('Unsupported file type.');
}
function importFingerprint(t){return [t.account,t.date,Number(t.amount).toFixed(2),cleanImportText(t.description).toLowerCase()].join('|')}

function importDateDays(a,b){
 const da=new Date(String(a||'')+'T00:00:00'),db=new Date(String(b||'')+'T00:00:00');
 if(Number.isNaN(da.getTime())||Number.isNaN(db.getTime()))return 9999;
 return Math.abs(Math.round((da-db)/86400000));
}
function duplicateTextKey(v){
 return cleanImportText(v||'').toLowerCase()
  .replace(/\b(saudi arabia|riyadh|ksa|sar|visa|card|payment|purchase|pos)\b/g,' ')
  .replace(/[^a-z0-9\u0600-\u06ff]+/g,' ')
  .replace(/\s+/g,' ').trim();
}
function duplicateTextSimilar(a,b){
 const x=duplicateTextKey(a),y=duplicateTextKey(b);
 if(!x||!y)return false;
 if(x===y||x.includes(y)||y.includes(x))return true;
 const xs=new Set(x.split(' ').filter(w=>w.length>2)),ys=new Set(y.split(' ').filter(w=>w.length>2));
 if(!xs.size||!ys.size)return false;
 let common=0;xs.forEach(w=>{if(ys.has(w))common++});
 return common/Math.min(xs.size,ys.size)>=0.6;
}
function isStatementDuplicate(candidate,existing){
 if(!candidate||!existing)return false;
 if(candidate.account!==existing.account)return false;
 if(Math.abs(Number(candidate.amount||0)-Number(existing.amount||0))>0.005)return false;
 const days=importDateDays(candidate.date,existing.date);
 if(days===0)return true; // same card + same amount + same transaction date
 if(days<=3 && duplicateTextSimilar(candidate.description,existing.description))return true;
 return false;
}
function splitFreshStatementRows(previewRows,existingRows){
 const used=new Set(),fresh=[],duplicates=[];
 previewRows.forEach((t,idx)=>{
  let matchIndex=-1;
  for(let i=0;i<existingRows.length;i++){
   if(used.has(i))continue;
   if(isStatementDuplicate(t,existingRows[i])){matchIndex=i;break;}
  }
  if(matchIndex>=0){
   used.add(matchIndex);
   duplicates.push({row:t,match:existingRows[matchIndex]});
  }else fresh.push(t);
 });
 return {fresh,duplicates};
}
function cleanupExistingImportedStatementDuplicates(){
 // BASE is the trusted original set embedded in the dashboard.
 // Imported rows that are one-to-one duplicates of BASE are soft-excluded,
 // so they stay in import history but cannot inflate reports.
 const usedBase=new Set();
 let changed=0;
 importedTransactions.forEach(t=>{
  if(transactionActions[t._id]?.status)return;
  let match=-1;
  for(let i=0;i<BASE.transactions.length;i++){
   if(usedBase.has(i))continue;
   if(isStatementDuplicate(t,BASE.transactions[i])){match=i;break;}
  }
  if(match>=0){
   usedBase.add(match);
   transactionActions[t._id]={
    status:'excluded-duplicate',
    reason:'Auto-excluded: imported statement row duplicates an existing transaction',
    pairedWith:'tx'+match,
    updatedAt:new Date().toISOString()
   };
   changed++;
  }
 });
 if(changed){
  localStorage.setItem('pf_transaction_actions',JSON.stringify(transactionActions));
  rebuildTransactions();
 }
 return changed;
}


function importPreviewTypeFromRow(row){
 const kind=String(row?.kind||txType(row)||'expense').toLowerCase();
 if(['expense','transfer','income','fee','obligation'].includes(kind))return kind;
 return Number(row?.amount||0)>=0?'income':'expense';
}

function importPreviewNeedsReview(row){
 if(!row)return true;
 if(row.needsReview===true && row.categoryReviewed!==true)return true;
 const category=String(row.category||'').trim();
 const subcategory=String(row.subcategory||'').trim();
 if(!category||!categories[category]||!subcategory)return true;
 return !categories[category].includes(subcategory);
}

function importPreviewReviewRows(){
 return importPreviewRows.map((row,index)=>({row,index})).filter(x=>importPreviewNeedsReview(x.row));
}

function importReviewCategoryOptions(selected=''){
 return '<option value="">Choose Category</option>'+Object.keys(categories).map(category=>
  `<option value="${escapeHtml(category)}" ${category===selected?'selected':''}>${escapeHtml(category)}</option>`
 ).join('');
}
function importReviewSubcategoryOptions(category,selected=''){
 return '<option value="">Choose Subcategory</option>'+(categories[category]||[]).map(subcategory=>
  `<option value="${escapeHtml(subcategory)}" ${subcategory===selected?'selected':''}>${escapeHtml(subcategory)}</option>`
 ).join('');
}
function openImportBulkReview(focusIndex=null){
 const rows=importPreviewReviewRows();
 if(!rows.length){alert('All statement transactions are already classified.');return;}
 $('importBulkReviewMeta').textContent=`${rows.length} transaction(s) need Category/Subcategory review.`;
 $('importBulkReviewStatus').textContent='Review every row, then save all changes together.';
 $('importBulkReviewBody').innerHTML=rows.map(({row,index},position)=>{
  const category=categories[row.category]?row.category:'';
  const subcategory=(categories[category]||[]).includes(row.subcategory)?row.subcategory:'';
  return `<tr data-import-review-row="${index}" class="${index===focusIndex?'importBulkFocus':''}">
   <td><b>${position+1}</b></td>
   <td>${escapeHtml(row.date||'—')}</td>
   <td><b>${escapeHtml(row.description||'—')}</b><div class="meta">${escapeHtml(accountName(row.account))}</div></td>
   <td class="${Number(row.amount||0)<0?'red':'green'}"><b>${signed(Number(row.amount||0))}</b></td>
   <td><select data-import-review-category="${index}">${importReviewCategoryOptions(category)}</select></td>
   <td><select data-import-review-subcategory="${index}">${importReviewSubcategoryOptions(category,subcategory)}</select></td>
  </tr>`;
 }).join('');
 $('importBulkReviewBody').querySelectorAll('[data-import-review-category]').forEach(select=>{
  select.addEventListener('change',()=>{
   const index=select.dataset.importReviewCategory;
   const sub=$('importBulkReviewBody').querySelector(`[data-import-review-subcategory="${index}"]`);
   if(sub)sub.innerHTML=importReviewSubcategoryOptions(select.value,'');
  });
 });
 openModal('importBulkReviewModal');
 if(focusIndex!==null)requestAnimationFrame(()=>$('importBulkReviewBody').querySelector(`[data-import-review-row="${focusIndex}"]`)?.scrollIntoView({block:'center'}));
}
function saveImportBulkReview(){
 const rows=[...$('importBulkReviewBody').querySelectorAll('[data-import-review-row]')];
 if(!rows.length)return;
 const updates=[];
 for(const tr of rows){
  const index=Number(tr.dataset.importReviewRow);
  const category=tr.querySelector('[data-import-review-category]')?.value||'';
  const subcategory=tr.querySelector('[data-import-review-subcategory]')?.value||'';
  if(!category||!categories[category]||!subcategory||!categories[category].includes(subcategory)){
   tr.classList.add('importBulkInvalid');
   $('importBulkReviewStatus').textContent='Choose a valid Category and Subcategory for every row.';
   tr.scrollIntoView({block:'center'});
   return;
  }
  tr.classList.remove('importBulkInvalid');
  updates.push({index,category,subcategory});
 }
 updates.forEach(({index,category,subcategory})=>{
  const row=importPreviewRows[index];
  if(!row)return;
  Object.assign(row,{category,subcategory,needsReview:false,categoryReviewed:true,previewEdited:true});
 });
 closeModal('importBulkReviewModal');
 renderImportPreview();
 importStatus(`${updates.length} transaction(s) reviewed. All classifications are ready for import.`,'success');
}

function updateImportPreviewEditCycle(){
 const accountId=$('importPreviewEditAccount')?.value||'';
 const date=$('importPreviewEditDate')?.value||'';
 const box=$('importPreviewEditCycle');
 if(!box)return;
 if(!accountId||!date){
  box.textContent='Choose an account/card and date to calculate the payment/statement cycle.';
  return;
 }
 const month=paymentMonthForTransaction(accountId,date);
 box.innerHTML=`This transaction will be assigned to <b>${cardMonthLabel(month)}</b> payment/statement cycle.`;
}

function editImportPreviewRow(index){
 const row=importPreviewRows[index];
 if(!row)return;

 $('importPreviewEditIndex').value=String(index);
 $('importPreviewEditAccount').innerHTML=accounts.map(a=>
  `<option value="${a.id}">${a.bank} • ${a.name}${a.ending?` •${a.ending}`:''}</option>`
 ).join('');
 $('importPreviewEditAccount').value=row.account||$('importAccount')?.value||'';

 $('importPreviewEditDate').value=row.date||'';
 $('importPreviewEditDescription').value=row.description||'';

 const typ=importPreviewTypeFromRow(row);
 $('importPreviewEditType').value=typ;
 $('importPreviewEditAmount').value=Math.abs(Number(row.amount||0)).toFixed(2);

 fillCategorySelect($('importPreviewEditCategory'),false);
 const category=(categories[row.category] ? row.category : (Object.keys(categories)[0]||'Miscellaneous'));
 $('importPreviewEditCategory').value=category;
 fillSubcategorySelect($('importPreviewEditSubcategory'),category,row.subcategory||'');

 updateImportPreviewEditCycle();
 openModal('importPreviewEditModal');
}
function deleteImportPreviewRow(index){
 const row=importPreviewRows[index];
 if(!row)return;
 if(!confirm(`Remove this transaction from the import preview?\n\n${row.date} • ${row.description} • ${signed(Number(row.amount||0))}\n\nIt will NOT be imported.`))return;
 importPreviewRows.splice(index,1);
 renderImportPreview();
}
function bindImportPreviewActions(){
 document.querySelectorAll('[data-review-import-preview]').forEach(b=>
  b.addEventListener('click',()=>openImportBulkReview(Number(b.dataset.reviewImportPreview)))
 );
 document.querySelectorAll('[data-edit-import-preview]').forEach(b=>
  b.addEventListener('click',()=>editImportPreviewRow(Number(b.dataset.editImportPreview)))
 );
 document.querySelectorAll('[data-delete-import-preview]').forEach(b=>
  b.addEventListener('click',()=>deleteImportPreviewRow(Number(b.dataset.deleteImportPreview)))
 );
}

$('importPreviewEditCategory').addEventListener('change',()=>{
 const cat=$('importPreviewEditCategory').value;
 fillSubcategorySelect($('importPreviewEditSubcategory'),cat,'');
});

$('importPreviewEditAccount').addEventListener('change',updateImportPreviewEditCycle);
$('importPreviewEditDate').addEventListener('change',updateImportPreviewEditCycle);

$('importPreviewEditForm').addEventListener('submit',e=>{
 e.preventDefault();

 const index=Number($('importPreviewEditIndex').value);
 const row=importPreviewRows[index];
 if(!row)return;

 const accountId=$('importPreviewEditAccount').value;
 const date=$('importPreviewEditDate').value;
 const description=$('importPreviewEditDescription').value.trim();
 const type=$('importPreviewEditType').value;
 const absAmount=Math.abs(Number($('importPreviewEditAmount').value||0));
 const category=$('importPreviewEditCategory').value;
 const subcategory=$('importPreviewEditSubcategory').value;

 if(!accountId||!date||!description||!Number.isFinite(absAmount)||absAmount<=0||!category||!subcategory){
  alert('Please complete all required transaction fields.');
  return;
 }

 let amount=absAmount;
 if(['expense','fee','obligation'].includes(type))amount=-absAmount;
 else if(['income','transfer'].includes(type))amount=absAmount;

 const paymentMonth=paymentMonthForTransaction(accountId,date);

 Object.assign(row,{
  account:accountId,
  date,
  posting:row.posting||date,
  description,
  amount,
  category,
  subcategory,
  kind:type,
  paymentMonth,
  statementMonth:paymentMonth,
  previewEdited:true,
  needsReview:false,
  categoryReviewed:true
 });

 // Keep the selected card in the main import selector aligned when the user
 // intentionally corrects the account/card in the edit modal.
 if($('importAccount') && importPreviewRows.every(r=>r===row || r.account===accountId)){
  $('importAccount').value=accountId;
 }

 closeModal('importPreviewEditModal');
 renderImportPreview();
});


function renderImportPreview(){
 const reviewRows=importPreviewReviewRows();
 const reviewIndexes=new Set(reviewRows.map(x=>x.index));
 const total=importPreviewRows.length;
 const ready=total-reviewRows.length;
 $('importPreviewTotal').textContent=String(total);
 $('importPreviewReady').textContent=String(ready);
 $('importPreviewReview').textContent=String(reviewRows.length);
 const reviewButton=$('reviewImportTransactions');
 reviewButton.hidden=!reviewRows.length;
 reviewButton.textContent=reviewRows.length?`Review Transactions (${reviewRows.length})`:'Review Transactions';
 $('importPreviewMeta').textContent=total
  ?`${total} transaction(s) found in ${importPreviewFileName}. ${reviewRows.length?`${reviewRows.length} must be reviewed because Category or Subcategory was not recognized.`:'All transactions are classified and ready to import.'}`
  :'Choose a statement to begin.';

 $('importPreviewBody').innerHTML=total
  ?importPreviewRows.slice(0,300).map((t,index)=>`<tr class="${reviewIndexes.has(index)?'importNeedsReview':''}">
    <td>${t.date}${t.previewEdited?'<div class="meta green">Edited</div>':''}</td>
    <td><b>${t.description}</b><div class="meta">${accountName(t.account)} • ${cardMonthLabel(assignedTransactionPaymentMonth(t.account,t))}${account(t.account)?.type==='card'?` • ${physicalCardLabelFor(t.account,transactionPhysicalCardEnding(t))}`:''}</div></td>
    <td>${t.category||'—'}<div class="meta">${t.subcategory||'—'}</div>${reviewIndexes.has(index)?'<span class="importReviewBadge">Needs Review</span>':'<span class="importReadyBadge">Ready</span>'}</td>
    <td>${txType(t)}</td>
    <td class="${t.amount<0?'red':'green'}"><b>${signed(t.amount)}</b></td>
    <td><div style="display:flex;gap:6px;flex-wrap:wrap">
      ${reviewIndexes.has(index)
       ?`<button class="btn small primary" type="button" data-review-import-preview="${index}">Review</button>`
       :`<button class="btn small" type="button" data-edit-import-preview="${index}">Edit</button>`}
      <button class="btn small danger" type="button" data-delete-import-preview="${index}">Delete</button>
    </div></td>
   </tr>`).join('')
  :'<tr><td colspan="6">No statement loaded.</td></tr>';

 $('confirmStatementImport').disabled=!total||reviewRows.length>0;
 $('confirmStatementImport').title=reviewRows.length?'Review all unknown categories and subcategories before importing.':'';
 $('clearImportPreview').disabled=!total;
 bindImportPreviewActions();
}
function importBatchReconciliation(index){
 const h=importHistory[index];
 if(!h)return null;
 const rows=importBatchRows(h);
 const months=[...new Set(rows.map(t=>assignedTransactionPaymentMonth(t.account,t)).filter(Boolean))];
 return {
  file:h.fileName,
  accountId:h.accountId,
  importedRows:rows.length,
  activeRows:rows.filter(t=>!transactionActions[t._id]?.status).length,
  paymentMonths:months,
  amountsByMonth:Object.fromEntries(months.map(m=>[
   m,
   rows.filter(t=>(assignedTransactionPaymentMonth(t.account,t))===m)
       .filter(t=>Number(t.amount||0)<0 && !['transfer','income'].includes(txType(t)))
       .reduce((s,t)=>s+Math.abs(Number(t.amount||0)),0)
  ])),
  dashboardByMonth:Object.fromEntries(months.map(m=>[m,calculatedPaymentCycleAmount(h.accountId,m)]))
 };
}

function importBatchRows(h){
 if(h.batchId)return importedTransactions.filter(t=>t.importBatchId===h.batchId);
 // Backward-compatible recovery for imports made before batch IDs existed.
 const ts=new Date(h.importedAt).getTime();
 return importedTransactions.filter(t=>{
  const m=String(t._id||'').match(/^import(\d+)_/);
  if(!m)return false;
  return Math.abs(Number(m[1])-ts)<5000;
 });
}
function viewImportBatch(index){
 const h=importHistory[index];if(!h)return;
 const rows=importBatchRows(h);
 const win=window.open('','_blank','width=1050,height=720');
 if(!win){alert('Your browser blocked the preview window. Allow pop-ups for this page and try again.');return;}
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(h.fileName)}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#10233d}h2{margin:0 0 6px}.meta{color:#66758a;margin-bottom:18px}table{border-collapse:collapse;width:100%}th,td{padding:9px;border-bottom:1px solid #dce3eb;text-align:left;font-size:13px}th{background:#f5f7fa}.num{text-align:right;font-weight:700}
</style></head><body><h2>${esc(h.fileName)}</h2><div class="meta">${esc(new Date(h.importedAt).toLocaleString())} • ${rows.length} transaction(s)</div><table><thead><tr><th>Date</th><th>Description</th><th>Account</th><th>Category</th><th class="num">Amount</th></tr></thead><tbody>${rows.map(t=>`<tr><td>${esc(t.date)}</td><td>${esc(t.description)}</td><td>${esc(accountName(t.account))}${account(t.account)?.type==='card'?` • ${esc(physicalCardLabelFor(t.account,transactionPhysicalCardEnding(t)))}`:''}</td><td>${esc(t.category||'')}</td><td class="num">${esc(signed(Number(t.amount||0)))}</td></tr>`).join('')}</tbody></table></body></html>`);
 win.document.close();
}
function deleteImportBatch(index){
 const h=importHistory[index];if(!h)return;
 const rows=importBatchRows(h),ids=new Set(rows.map(t=>t._id));
 if(!confirm(`Delete this entire import?\n\nFile: ${h.fileName}\nTransactions to remove: ${rows.length}\n\nThis removes only transactions created by this import batch. Your manual transactions and other statement imports will not be touched.`))return;
 importedTransactions=importedTransactions.filter(t=>!ids.has(t._id));
 importHistory.splice(index,1);
 rebuildTransactions();saveLocal();renderDashboard();renderAccounts();renderTransactions();renderReports();renderReviewAlerts();renderImportHistory();renderTxHistory();
}


function detectOfficialStatementCandidate(accountId,fileName,rows,meta){
 // Only use statement totals that were actually parsed from the imported file.
 if(meta?.type==='meem-official' && accountId==='meem-7102' && Number.isFinite(Number(meta.totalDue))){
  const month=meta.dueDate
   ?String(meta.dueDate).slice(0,7)
   :(meta.statementEnd?String(meta.statementEnd).slice(0,7):currentYearMonth());
  return {
   accountId,
   month,
   amount:Number(meta.totalDue),
   due:meta.dueDate||'',
   label:'Official meem statement',
   meta
  };
 }

 // V159: no filename/date-based Al Rajhi amount is manufactured here.
 // Until an Al Rajhi parser detects the statement summary, importing transactions
 // alone does not create Released / Amount to Pay.
 return null;
}

function confirmOfficialStatementCandidate(candidate,fileName){
 if(!candidate)return false;
 return confirm(
  `OFFICIAL STATEMENT CONFIRMATION\n\n`+
  `File: ${fileName}\n`+
  `Card: ${accountName(candidate.accountId)}\n`+
  `Statement / payment month: ${cardMonthLabel(candidate.month)}\n`+
  `Detected statement amount: ${money(candidate.amount)}\n`+
  `${candidate.due?`Due: ${paymentFormatDate(candidate.due)}\n`:''}\n`+
  `Do you confirm that this is the OFFICIAL statement amount?\n\n`+
  `OK = Yes, use this amount as the official statement.\n`+
  `Cancel = No, import the transactions only. The official statement amount will remain SAR 0.00 until you confirm an official statement.`
 );
}

function applyImportedStatementToPaymentPlanner(accountId,fileName,rows){
 // V159: no hard-coded bank/card statement values.
 // Official statement rows are created only by a parser that supplies a real
 // statement amount, or by an explicit user-confirmed manual statement.
 return {updated:false};
}

function renderImportHistory(){
 const body=$('importHistoryBody');
 if(!body)return;
 body.innerHTML=importHistory.length?importHistory.map((h,index)=>({h,index})).reverse().map(({h,index})=>{
  const n=importBatchRows(h).length;
  return `<tr><td>${new Date(h.importedAt).toLocaleString()}</td><td><b>${h.fileName}</b></td><td>${accountName(h.accountId)}</td><td>${h.count}${h.officialStatementConfirmed===true?`<div class="meta green"><b>Official statement confirmed</b> • ${money(Number(h.officialStatementAmount||0))}${h.officialStatementMonth?` • ${cardMonthLabel(h.officialStatementMonth)}`:''}</div>`:`<div class="meta">Transactions only • Official statement not confirmed</div>`}${Number(h.skipped||h.duplicateSkipped||0)>0?`<div class="meta">${Number(h.skipped||h.duplicateSkipped||0)} duplicates skipped</div>`:''}${n!==Number(h.count)?`<div class="meta">${n} currently linked</div>`:''}</td><td><div style="display:flex;gap:7px;flex-wrap:wrap"><button class="btn small" data-view-import="${index}">View</button><button type="button" class="btn small danger" data-delete-import="${index}">Delete All</button></div></td></tr>`;
 }).join(''):'<tr><td colspan="5">No statements imported yet.</td></tr>';
 document.querySelectorAll('[data-view-import]').forEach(b=>b.addEventListener('click',()=>viewImportBatch(Number(b.dataset.viewImport))));
 document.querySelectorAll('[data-delete-import]').forEach(b=>b.addEventListener('click',()=>deleteImportBatch(Number(b.dataset.deleteImport))));
}
function renderImportPage(){fillAccountSelect($('importAccount'));renderImportPreview();renderImportHistory();renderStatementFormats()}
async function handleStatementFile(file){
 if(!file)return;const accountId=$('importAccount').value||accounts[0]?.id||'';importPreviewRows=[];importStatementMeta=null;renderImportPreview();importPreviewFileName=file.name;importStatus('Reading '+file.name+' and detecting bank/card…');
 try{const rows=await parseStatementFile(file,accountId,$('importStatementMonth').value);if(!rows.length)throw new Error('No transaction rows were recognized. Try Excel/CSV, or send me this statement format so I can add its PDF parser.');importPreviewRows=rows;renderImportPreview();importStatus(`Found ${rows.length} transaction(s) in ${file.name}. Assigned to ${accountName($('importAccount').value)}. Review the preview, then click Import Transactions.`,'success')}catch(e){importStatus(e.message||String(e),'error')}
}
$('statementFile').addEventListener('change',e=>{handleStatementFile(e.target.files?.[0]);e.target.value=''});
$('clearImportPreview').addEventListener('click',()=>{importPreviewRows=[];importPreviewFileName='';importStatementMeta=null;renderImportPreview();$('importStatus').style.display='none'});
$('reviewImportTransactions').addEventListener('click',()=>openImportBulkReview());
$('saveImportBulkReview').addEventListener('click',saveImportBulkReview);
$('confirmStatementImport').addEventListener('click',()=>{
 if(!importPreviewRows.length)return;
 const reviewRows=importPreviewReviewRows();
 if(reviewRows.length){
  alert(`${reviewRows.length} transaction(s) still need Category/Subcategory review before import.`);
  openImportBulkReview(reviewRows[0].index);
  return;
 }
 const activeImported=importedTransactions.filter(t=>!transactionActions[t._id]?.status);
 const existing=[...activeImported,...manualTransactions];
 const result=splitFreshStatementRows(importPreviewRows,existing);
 const fresh=result.fresh,skipped=result.duplicates.length,stamp=Date.now(),batchId=`batch_${stamp}`;
 const importedAccountId=$('importAccount').value;
 const officialCandidate=detectOfficialStatementCandidate(importedAccountId,importPreviewFileName,importPreviewRows,importStatementMeta);
 const officialConfirmed=confirmOfficialStatementCandidate(officialCandidate,importPreviewFileName);

 const importedFresh=fresh.map((t,i)=>{
  const accountId=importedAccountId||t.account;
  const paymentMonth=paymentMonthForTransaction(accountId,t.date);
  return {
   ...t,
   account:accountId,
   paymentMonth:t.paymentMonth||paymentMonth,
   statementMonth:t.paymentMonth||paymentMonth,
   previewEdited:!!t.previewEdited,
   _id:`import${stamp}_${i}`,
   importBatchId:batchId,
   importedAt:new Date(stamp).toISOString()
  };
 });
 importedFresh.forEach(t=>{
  // A new import id must never inherit a deleted/excluded action.
  if(transactionActions[t._id])delete transactionActions[t._id];
  importedTransactions.push(t);
 });
 syncImportedTransactionsImmediate(importedFresh);
 importHistory.push({
  batchId,
  fileName:importPreviewFileName,
  accountId:importedAccountId,
  count:importedFresh.length,
  skipped,
  duplicateSkipped:skipped,
  importedAt:new Date(stamp).toISOString(),
  officialStatementConfirmed:!!officialConfirmed,
  officialStatementAmount:officialConfirmed&&officialCandidate?Number(officialCandidate.amount):0,
  officialStatementMonth:officialConfirmed&&officialCandidate?officialCandidate.month:'',
  officialStatementDue:officialConfirmed&&officialCandidate?officialCandidate.due:''
 });

 rebuildTransactions();
 ensureReleasedCyclePlannerRows();
 normalizeReleasedPaymentAliases();
 let plannerUpdate;
 if(officialConfirmed && officialCandidate?.meta?.type==='meem-official' && importedAccountId==='meem-7102'){
  plannerUpdate=applyMeemOfficialStatement(importStatementMeta);
 }else if(officialConfirmed && officialCandidate && importedAccountId==='ar-0955'){
  plannerUpdate=applyImportedStatementToPaymentPlanner(importedAccountId,importPreviewFileName,importPreviewRows);
 }else{
  // Transactions were imported, but no official statement was confirmed.
  // Rebuild a date-driven/manual row only. Official statement remains SAR 0.00.
  rebuildResetCardPlannerRows(importedAccountId);
  plannerUpdate={
   updated:true,
   amount:[...new Set(importedFresh.map(t=>t.paymentMonth||paymentMonthForTransaction(importedAccountId,t.date)))].reduce((s,m)=>s+calculatedPaymentCycleAmount(importedAccountId,m),0),
   due:'',
   official:false
  };
 }
 saveLocal();
 const latestImportHistory=importHistory[importHistory.length-1];
 if(latestImportHistory){
  recordImmediateUpsert('import_history',syncStableId('import_history',latestImportHistory,importHistory.length-1),latestImportHistory,'import-history');
 }
 renderDashboard();renderAccounts();renderTransactions();renderReports();renderReviewAlerts();renderImportHistory();renderPaymentPlanner();renderInstallments();renderIncomePlan();
 if(currentAccountDetailId===importedAccountId && document.getElementById('accountDetail')?.classList.contains('active')){
  accountDetailTxFilter.month='';
  openAccount(importedAccountId,accountDetailReturnPage);
 }
 importStatus(`Imported ${importedFresh.length} transaction(s)${skipped?`; skipped ${skipped} duplicate transaction(s) already in the database.`:'.'}${officialConfirmed&&officialCandidate?` Official statement CONFIRMED: ${money(officialCandidate.amount)}${officialCandidate.due?` due ${paymentFormatDate(officialCandidate.due)}`:''}.`:officialCandidate?` Transactions imported only. Official statement was NOT confirmed and remains ${money(0)}.`:plannerUpdate.updated?' Transactions imported and the payment estimate was recalculated from transaction dates.':''}`,'success');
 importPreviewRows=[];importStatementMeta=null;renderImportPreview()
});
const importDrop=$('importDrop');['dragenter','dragover'].forEach(ev=>importDrop.addEventListener(ev,e=>{e.preventDefault();importDrop.classList.add('drag')}));['dragleave','drop'].forEach(ev=>importDrop.addEventListener(ev,e=>{e.preventDefault();importDrop.classList.remove('drag')}));importDrop.addEventListener('drop',e=>handleStatementFile(e.dataTransfer.files?.[0]));


function permanentlyDeleteTransactionRecord(id){
 const t=normalizedTx(true).find(x=>x._id===id);
 if(!t)return;

 if(!confirm(
  `Permanently delete this transaction record?\n\n`+
  `${t.description}\n${t.date} • ${signed(t.amount)}\n${accountName(t.account)}\n\n`+
  `This cannot be restored from Transaction History. A recovery snapshot is created first.`
 ))return;

 try{saveRecoverySnapshot('before-permanent-delete-transaction');}catch(_){}

 manualTransactions=manualTransactions.filter(x=>(x._id||'')!==id);
 importedTransactions=importedTransactions.filter(x=>(x._id||'')!==id);

 delete transactionActions[id];
 delete txOverrides[id];

 // Remove any duplicate-decision references containing this exact transaction id.
 Object.keys(duplicateDecisions||{}).forEach(k=>{
  if(String(k).includes(id))delete duplicateDecisions[k];
 });

 localStorage.setItem('pf_manual_transactions',JSON.stringify(manualTransactions));
 localStorage.setItem('pf_imported_transactions',JSON.stringify(importedTransactions));
 localStorage.setItem('pf_transaction_actions',JSON.stringify(transactionActions));
 localStorage.setItem('pf_tx_overrides',JSON.stringify(txOverrides));
 saveLocal();

 // Missing record becomes a Supabase tombstone on push.
 scheduleRecordPush('permanent-delete-transaction');

 renderTxHistory();
 renderTransactions();
 renderDashboard();
 renderAccounts();
 renderReports();

 if(document.getElementById('accountDetail')?.classList.contains('active')&&currentAccountDetailId){
  openAccount(currentAccountDetailId,accountDetailReturnPage);
 }
}

function renderTxHistory(){
 const box=$('txHistoryBox');if(!box)return;
 const rows=normalizedTx(true).filter(t=>t.txAction&&['excluded-duplicate','deleted'].includes(t.txAction.status));
 box.innerHTML=rows.length?`<table class="historyTable"><thead><tr><th>Date</th><th>Transaction</th><th>Status</th><th>Amount</th><th>Actions</th></tr></thead><tbody>${rows.map(t=>`<tr><td>${t.date}</td><td><b>${t.description}</b><div class="meta">${accountName(t.account)}</div></td><td><span class="excludedBadge">${t.txAction.status==='deleted'?'Deleted':'Excluded Duplicate'}</span><div class="meta">${t.txAction.reason||''}</div></td><td>${signed(t.amount)}</td><td><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn small" data-restore-tx="${t._id}">Restore</button><button type="button" class="btn small danger" data-permanent-delete-tx="${t._id}">Delete Permanently</button></div></td></tr>`).join('')}</tbody></table>`:'<div class="meta">No excluded or deleted transactions.</div>';
 document.querySelectorAll('[data-restore-tx]').forEach(b=>b.onclick=()=>restoreTx(b.dataset.restoreTx));
 document.querySelectorAll('[data-permanent-delete-tx]').forEach(b=>b.onclick=()=>permanentlyDeleteTransactionRecord(b.dataset.permanentDeleteTx));
}


function incomePlanForMonth(month=currentIncomeMonth()){
 incomePlan.monthlyPlans=Array.isArray(incomePlan.monthlyPlans)?incomePlan.monthlyPlans:[];
 return incomePlan.monthlyPlans.find(p=>p.month===month)||null;
}
function monthlyPlanTotal(p){
 if(!p)return 0;
 return Number(p.mySalary||0)+Number(p.wifeSalary||0)+Number(p.extraIncome||0)+Number(p.otherIncome||0);
}
function applySavedIncomePlanForCurrentMonth(){
 const month=currentIncomeMonth();
 const p=incomePlanForMonth(month);
 if(p){
  incomePlan.mySalary=Number(p.mySalary||0);
  incomePlan.wifeSalary=Number(p.wifeSalary||0);
  incomePlan.otherIncome=Number(p.otherIncome||0);
  incomePlan.allocations={...(p.allocations||{})};
 }else{
  incomePlan.mySalary=0;
  incomePlan.wifeSalary=0;
  incomePlan.otherIncome=0;
  incomePlan.allocations={};
 }
 incomePlan.extraIncome=accumulatedExtraIncome(month);
 return p;
}
function saveMonthlyIncomePlan(month=currentIncomeMonth()){
 incomePlan.monthlyPlans=Array.isArray(incomePlan.monthlyPlans)?incomePlan.monthlyPlans:[];
 const snap={
  month,
  mySalary:Number(incomePlan.mySalary||0),
  wifeSalary:Number(incomePlan.wifeSalary||0),
  extraIncome:Number(accumulatedExtraIncome(month)||0),
  otherIncome:Number(incomePlan.otherIncome||0),
  allocations:{...(incomePlan.allocations||{})},
  savedAt:new Date().toISOString()
 };
 const idx=incomePlan.monthlyPlans.findIndex(p=>p.month===month);
 if(idx>=0)incomePlan.monthlyPlans[idx]={...incomePlan.monthlyPlans[idx],...snap};
 else incomePlan.monthlyPlans.push(snap);
 return snap;
}
function renderMonthlyIncomePlans(){
 const body=$('monthlyIncomePlansBody');if(!body)return;
 const current=currentIncomeMonth();
 if($('currentIncomePlanMonth'))$('currentIncomePlanMonth').textContent=extraIncomeMonthTitle(current);
 const plans=(incomePlan.monthlyPlans||[]).slice().sort((a,b)=>String(b.month).localeCompare(String(a.month)));
 body.innerHTML=plans.length?plans.map(p=>`<tr>
  <td><b>${extraIncomeMonthTitle(p.month)}</b>${p.month===current?'<div class="meta">Current month</div>':''}</td>
  <td>${money(Number(p.mySalary||0))}</td>
  <td>${money(Number(p.wifeSalary||0))}</td>
  <td>${money(Number(p.extraIncome||0))}</td>
  <td>${money(Number(p.otherIncome||0))}</td>
  <td><b>${money(monthlyPlanTotal(p))}</b></td>
  <td>${p.savedAt?new Date(p.savedAt).toLocaleString():'—'}</td>
  <td><div style="display:flex;gap:7px;flex-wrap:wrap">
   <button class="btn small" type="button" data-edit-income-month="${p.month}">Edit</button>
   <button class="btn small danger" type="button" data-delete-income-month="${p.month}">Delete</button>
  </div></td>
 </tr>`).join(''):'<tr><td colspan="8">No monthly income plans saved yet.</td></tr>';

 document.querySelectorAll('[data-edit-income-month]').forEach(b=>b.addEventListener('click',()=>{
  const p=incomePlanForMonth(b.dataset.editIncomeMonth);if(!p)return;
  const mine=prompt(`My Salary for ${extraIncomeMonthTitle(p.month)} (SAR)`,String(Number(p.mySalary||0)));if(mine===null)return;
  const wife=prompt(`Wife Salary for ${extraIncomeMonthTitle(p.month)} (SAR)`,String(Number(p.wifeSalary||0)));if(wife===null)return;
  const other=prompt(`Other Income for ${extraIncomeMonthTitle(p.month)} (SAR)`,String(Number(p.otherIncome||0)));if(other===null)return;
  const vals=[Number(mine),Number(wife),Number(other)];
  if(vals.some(v=>!Number.isFinite(v)||v<0)){alert('Please enter valid non-negative amounts.');return;}
  p.mySalary=vals[0];p.wifeSalary=vals[1];p.otherIncome=vals[2];
  p.extraIncome=accumulatedExtraIncome(p.month);
  p.savedAt=new Date().toISOString();
  if(p.month===currentIncomeMonth()){
   incomePlan.mySalary=p.mySalary;incomePlan.wifeSalary=p.wifeSalary;incomePlan.otherIncome=p.otherIncome;
  }
  localStorage.setItem('pf_income_plan',JSON.stringify(incomePlan));saveLocal();renderIncomePlan();
 }));

 document.querySelectorAll('[data-delete-income-month]').forEach(b=>b.addEventListener('click',()=>{
  const month=b.dataset.deleteIncomeMonth;
  if(!confirm(`Delete the saved income plan for ${extraIncomeMonthTitle(month)}?\n\nExtra Income History entries are kept separately and will not be deleted.`))return;
  incomePlan.monthlyPlans=(incomePlan.monthlyPlans||[]).filter(p=>p.month!==month);
  if(month===currentIncomeMonth()){
   incomePlan.mySalary=0;incomePlan.wifeSalary=0;incomePlan.otherIncome=0;incomePlan.allocations={};
  }
  localStorage.setItem('pf_income_plan',JSON.stringify(incomePlan));saveLocal();renderIncomePlan();
 }));
}


function totalIncomePlan(){return Number(incomePlan.mySalary||0)+Number(incomePlan.wifeSalary||0)+Number(accumulatedExtraIncome()||0)+Number(incomePlan.otherIncome||0)}
function afterLoansAmount(){return totalIncomePlan()-totalFixedLoans()-outgoingThisMonthTotal()}
function nextDueLabel(day=25){
 const now=new Date();
 let y=now.getFullYear(),m=now.getMonth();
 if(now.getDate()>day){m++;if(m>11){m=0;y++}}
 const d=new Date(y,m,day);
 return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'});
}

function cardNextDueInfo(a){
 ensurePartialPaymentFields();
 const today=new Date();today.setHours(0,0,0,0);
 const future=cardPaymentPlan
   .filter(p=>p.accountId===a.id&&p.due&&!p.paid)
   .map(p=>{const linkedDue=p.month?dueDateForPaymentMonth(a.id,p.month):p.due;return {...p,linkedDue,dObj:new Date(linkedDue+'T00:00:00')}})
   .filter(p=>!Number.isNaN(p.dObj.getTime())&&p.dObj>=today)
   .sort((x,y)=>x.dObj-y.dObj)[0];
 if(future){
  return {
   label:future.dObj.toLocaleDateString('en-GB',{day:'2-digit',month:'short'}),
   detail:`Current payment plan • ${future.label||future.source||'Card payment'}`,
   fullDate:future.linkedDue
  };
 }
 const cyc=cardCycleSetting(a.id);
 return {
  label:nextDueLabel(cyc.dueDay),
  detail:`Statement issued every month on the ${ordinal(cyc.statementDay)} • Payment due every month on the ${ordinal(cyc.dueDay)}`,
  fullDate:''
 };
}
function ordinal(n){
 const v=n%100;return n+(['th','st','nd','rd'][(v-20)%10]||['th','st','nd','rd'][v]||'th');
}
function renderCreditCardCalendar(){
 const box=$('creditCardCalendar');if(!box)return;
 box.innerHTML=accounts.filter(a=>a.type==='card').map(a=>{
  const due=cardNextDueInfo(a),cyc=cardCycleSetting(a.id);
  const detail=due.fullDate?`${cyc.statementDay?`Statement usually issued around the ${ordinal(cyc.statementDay)} • `:''}${due.detail}`:due.detail;
  return `<button type="button" class="dueCard dueCardLinked" data-edit-due-card="${escapeHtml(a.id)}" title="Edit this card's statement and due-date settings"><span style="display:flex;align-items:center;gap:10px">${bankLogoHTML(a)}<span><b>${escapeHtml(a.bank)} ${escapeHtml(a.name)} •${escapeHtml(a.ending)}</b><span class="meta">${detail}</span></span></span><span style="text-align:right"><span class="meta">Next Due</span><span class="dueDate">${due.label}</span><span class="dueEditHint">Edit card dates ›</span></span></button>`;
 }).join('');
 box.querySelectorAll('[data-edit-due-card]').forEach(btn=>btn.onclick=()=>{
  if(typeof editFinanceCreditCard==='function')editFinanceCreditCard(btn.dataset.editDueCard);
  else nav('financeSettings');
 });
}

function findBestPaymentPlanForCard(cardId){
 const month=currentIncomeMonth();
 ensureMonthlyPlannerRows(month);
 const rows=cardPaymentPlan
  .filter(p=>p.accountId===cardId&&!p.upcomingOnly&&(p.month===month||String(p.due||'').slice(0,7)===month))
  .sort((a,b)=>releasedPaymentRowPriority(b)-releasedPaymentRowPriority(a));
 return rows[0]||null;
}
function openIncomePlanPayment(cardId){
 const p=findBestPaymentPlanForCard(cardId);
 if(!p){
  alert('No current-month payment was found for this card. Add or release the current statement first.');
  return;
 }
 const remaining=paymentRemainingAmount(p);
 if(remaining===null){
  alert('Set the card payment amount first in Card Payment Planner.');
  return;
 }
 if(remaining<=0.005){alert('This month\'s card payment is already fully paid.');return;}
 openRecordPayment(p.id);
 $('paymentAmountInput').value=remaining.toFixed(2);
 updatePaymentSourcePreview();
 $('paymentSourceModal').dataset.incomeCardId=cardId;
}
function renderCreditCardAllocations(){
 const box=$('creditCardAllocations');if(!box)return;
 box.innerHTML=accounts.filter(a=>a.type==='card').map(a=>{
  const p=findBestPaymentPlanForCard(a.id),remaining=p?paymentRemainingAmount(p):null;
  const paidAmount=p?paymentPaidAmount(p):0;
  const amount=Number.isFinite(remaining)?money(remaining):'Awaiting statement';
  const paid=Number.isFinite(remaining)&&remaining<=0.005;
  return `<div class="allocationRow"><div style="display:flex;align-items:center;gap:10px">${bankLogoHTML(a)}<div><b>${a.bank} ${a.name} •${a.ending}</b><div class="meta">${p?.due?`Current payment due ${paymentFormatDate(p.due)}`:'Current-month statement not released'}</div></div></div><div class="currentCardPayment"><span>Remaining payment</span><b>${amount}</b><div id="obligation_${a.id}" class="meta"></div></div><div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap"><button class="btn primary" type="button" data-income-pay="${a.id}" ${!p||paid?'disabled':''}>${paid?'Paid':'Pay Now'}</button>${p&&paidAmount>0.005?`<button class="btn danger" type="button" data-income-undo="${p.id}">Undo Payment</button>`:''}</div></div>`;
 }).join('');
 document.querySelectorAll('[data-income-pay]').forEach(b=>b.addEventListener('click',()=>openIncomePlanPayment(b.dataset.incomePay)));
 document.querySelectorAll('[data-income-undo]').forEach(b=>b.addEventListener('click',()=>undoLastPartialPayment(b.dataset.incomeUndo)));
}

function incomeMonthKey(dateValue=new Date()){
 const d=dateValue instanceof Date?dateValue:new Date(String(dateValue||'')+'T00:00:00');
 if(Number.isNaN(d.getTime()))return currentYearMonth();
 return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function addMonths(month,delta){
 const [y,m]=String(month).split('-').map(Number),d=new Date(y,m-1+Number(delta||0),1);
 return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function currentIncomeMonth(){return incomeMonthKey(new Date())}
function accumulatedExtraIncome(month=currentIncomeMonth()){
 return (incomePlan.extraIncomeHistory||[])
  .filter(x=>(x.month||incomeMonthKey(x.date))===month)
  .reduce((sum,x)=>sum+Number(x.amount||0),0);
}
function extraIncomeMonthTitle(month=currentIncomeMonth()){
 const [y,m]=month.split('-').map(Number);
 return new Date(y,m-1,1).toLocaleDateString('en-US',{month:'long',year:'numeric'});
}
function renderExtraIncomeHistory(){
 const month=currentIncomeMonth();
 incomePlan.extraIncome=accumulatedExtraIncome(month);
 if($('extraIncomeAccumulated'))$('extraIncomeAccumulated').textContent=money(incomePlan.extraIncome);
 if($('extraIncomeMonthLabel'))$('extraIncomeMonthLabel').textContent=extraIncomeMonthTitle(month);

 const body=$('extraIncomeHistoryBody');if(!body)return;
 const rows=(incomePlan.extraIncomeHistory||[]).slice().sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
 const runningByMonth={};
 body.innerHTML=rows.length?rows.map(x=>{
  const mk=x.month||incomeMonthKey(x.date);
  runningByMonth[mk]=(runningByMonth[mk]||0)+Number(x.amount||0);
  return `<tr><td>${x.date||''}<div class="meta">${extraIncomeMonthTitle(mk)}</div></td><td class="green"><b>${money(Number(x.amount||0))}</b></td><td>${money(runningByMonth[mk])}</td><td><button class="btn small danger" type="button" data-delete-extra-income="${x.id}">Delete</button></td></tr>`;
 }).join(''):'<tr><td colspan="4">No extra income saved yet.</td></tr>';

 document.querySelectorAll('[data-delete-extra-income]').forEach(b=>b.addEventListener('click',()=>{
  const row=(incomePlan.extraIncomeHistory||[]).find(x=>x.id===b.dataset.deleteExtraIncome);if(!row)return;
  if(!confirm(`Delete extra income ${money(Number(row.amount||0))}?`))return;
  incomePlan.extraIncomeHistory=incomePlan.extraIncomeHistory.filter(x=>x.id!==row.id);
  incomePlan.extraIncome=accumulatedExtraIncome();
  localStorage.setItem('pf_income_plan',JSON.stringify(incomePlan));
  saveLocal();renderIncomePlan();
 }));
}
function addExtraIncomeFromInput(){
 const el=$('incomeExtra');
 const amount=Number(el.value||0);
 if(!Number.isFinite(amount)||amount<=0)return false;
 incomePlan.extraIncomeHistory=incomePlan.extraIncomeHistory||[];
 const today=new Date();
 incomePlan.extraIncomeHistory.push({
  id:'extra-'+Date.now(),
  date:today.toISOString().slice(0,10),
  month:currentIncomeMonth(),
  amount:Math.round(amount*100)/100
 });
 incomePlan.extraIncome=accumulatedExtraIncome();
 el.value='';
 return true;
}

function financeSettingCards(){
 const labels={'ar-0955':{bank:'Al Rajhi Bank',name:'Visa Infinite',ending:'0955'},'ar-5867':{bank:'Al Rajhi Bank',name:'Visa Platinum',ending:'5867'},'sab-440880':{bank:'SAB',name:'Cashback Credit Card',ending:'440880'},'nbd-infinite-4411':{bank:'Emirates NBD',name:'Infinite Visa',ending:'4411'},'nbd-mazeed-8652':{bank:'Emirates NBD',name:'Mazeed Platinum Visa',ending:'8652'},'meem-7102':{bank:'meem / GIB Saudi',name:'Visa Platinum',ending:'7102'}};
 const liveCards=(Array.isArray(accounts)?accounts:[]).filter(a=>a?.type==='card');
 const byId=new Map(liveCards.map(a=>[a.id,a]));
 Object.keys(DEFAULT_CARD_CYCLE_SETTINGS).forEach(id=>{if(!byId.has(id))byId.set(id,{id,type:'card',...(labels[id]||{bank:'Credit Card',name:id,ending:''})});});
 return [...byId.values()];
}
function loanMonthIndex(ym){
 const m=String(ym||'').match(/^(\d{4})-(\d{2})$/);
 if(!m)return null;
 return Number(m[1])*12+(Number(m[2])-1);
}
function loanMonthDiff(fromYm,toYm){
 const a=loanMonthIndex(fromYm),b=loanMonthIndex(toYm);
 if(a===null||b===null)return 0;
 return Math.max(0,b-a);
}
function rollLoanToMonth(loan,targetMonth){
 if(!loan||loan.status==='closed')return false;
 targetMonth=targetMonth||currentYearMonth();
 if(!loan.referenceMonth){loan.referenceMonth=targetMonth;return true;}
 const diff=loanMonthDiff(loan.referenceMonth,targetMonth);
 if(diff<=0)return false;
 const monthly=Math.max(0,Number(loan.monthly||0));
 const oldMonths=Math.max(0,Number(loan.remainingMonths||0));
 const oldAmount=Math.max(0,Number(loan.remainingAmount||0));
 const payableSteps=Math.min(diff,oldMonths||diff);
 loan.remainingMonths=Math.max(0,oldMonths-diff);
 loan.remainingAmount=Math.max(0,Math.round((oldAmount-(monthly*payableSteps))*100)/100);
 loan.referenceMonth=targetMonth;
 loan.updatedAt=new Date().toISOString();
 if(loan.remainingMonths<=0||loan.remainingAmount<=0.005){
  loan.remainingMonths=0;
  loan.remainingAmount=0;
  loan.status='closed';
 }
 return true;
}
function rollAllLoansToMonth(targetMonth=currentYearMonth()){
 let changed=false;
 (financeSettings.loans||[]).forEach(l=>{if(rollLoanToMonth(l,targetMonth))changed=true;});
 if(changed){
  localStorage.setItem('pf_finance_settings',JSON.stringify(financeSettings));
  financeSettingsDirty=true;
  scheduleRecordPush('loan-month-rollover');
 }
 return changed;
}
function renderSavedLoanSummary(){
 const box=$('savedLoanSummary');
 if(!box)return;
 const rows=financeSettings.loans||[];
 box.innerHTML=rows.length?rows.map(l=>`<div class="panel" style="padding:12px;margin:8px 0"><div class="splitHead"><div><b>${escapeHtml(l.name||'Loan')}</b><div class="meta">Balance as of ${escapeHtml(l.referenceMonth||currentYearMonth())}</div></div><span class="badge ${l.status==='closed'?'completed':'active'}">${l.status==='closed'?'Closed':'Active'}</span></div><div class="cardMetricGrid" style="grid-template-columns:repeat(3,1fr);margin-top:10px"><div class="miniMetric"><span>Monthly Payment</span><b class="red">${money(Number(l.monthly||0))}</b></div><div class="miniMetric"><span>Remaining Months</span><b>${Number(l.remainingMonths||0)}</b></div><div class="miniMetric"><span>Remaining Amount</span><b>${money(Number(l.remainingAmount||0))}</b></div></div></div>`).join(''):'<div class="notice">No saved loans yet.</div>';
}
function loanCalc(loan){if(!loan||loan.status==='closed')return {remainingMonths:0,remainingAmount:0,status:'Completed'};const remainingMonths=Math.max(0,Number(loan.remainingMonths||0));const remainingAmount=Math.max(0,Number(loan.remainingAmount||0));return {remainingMonths,remainingAmount,status:(remainingMonths>0||remainingAmount>0)?'Active':'Completed'};}
function totalFixedLoans(){rollAllLoansToMonth(currentYearMonth());return (financeSettings.loans||[]).reduce((sum,l)=>sum+(l.status!=='closed'&&loanCalc(l).status==='Active'?Math.max(0,Number(l.monthly||0)):0),0);}
function renderFinanceSettings(force=false){
 rollAllLoansToMonth(currentYearMonth());
 if(!force && financeSettingsEditing && document.getElementById('financeSettings')?.classList.contains('active'))return;
 const loansBox=$('loanSettingsRows');
 if(loansBox){
  const rows=financeSettings.loans||[];
  loansBox.innerHTML=rows.length?rows.map((l,i)=>`<div class="panel" style="margin:8px 0;padding:12px" data-loan-setting="${i}"><div class="formGrid"><div class="field full"><label>Loan Name</label><input data-loan-field="name" value="${escapeHtml(l.name||'')}"></div><div class="field"><label>Monthly Payment (SAR)</label><input type="number" min="0" step="0.01" data-loan-field="monthly" value="${Number(l.monthly||0)}"></div><div class="field"><label>Remaining Amount (SAR)</label><input type="number" min="0" step="0.01" data-loan-field="remainingAmount" value="${Number(l.remainingAmount||0)}"></div><div class="field"><label>Remaining Months</label><input type="number" min="0" max="600" data-loan-field="remainingMonths" value="${Number(l.remainingMonths||0)}"></div><div class="field"><label>Status</label><select data-loan-field="status"><option value="active" ${l.status!=='closed'?'selected':''}>Active</option><option value="closed" ${l.status==='closed'?'selected':''}>Closed</option></select></div><div class="field"><label>Balance As Of Month</label><input type="month" data-loan-field="referenceMonth" value="${escapeHtml(l.referenceMonth||currentYearMonth())}"></div><div class="field full" style="display:flex;justify-content:flex-end"><button class="btn danger" type="button" data-delete-loan="${i}">Delete Loan</button></div></div></div>`).join(''):'<div class="notice">No loans configured.</div>';
  loansBox.querySelectorAll('[data-loan-setting]').forEach(row=>{
   const idx=Number(row.dataset.loanSetting);
   row.querySelectorAll('[data-loan-field]').forEach(el=>{
    el.onfocus=()=>{financeSettingsEditing=true};
    const commit=()=>{
     financeSettingsEditing=true;
     const f=el.dataset.loanField;
     const loan=financeSettings.loans[idx];
     if(f==='referenceMonth'){
      const target=el.value||currentYearMonth();
      if(loanMonthDiff(loan.referenceMonth||target,target)>0)rollLoanToMonth(loan,target);
      else loan.referenceMonth=target;
     }else{
      loan[f]=['monthly','remainingAmount','remainingMonths'].includes(f)?Number(el.value||0):el.value;
      if(['monthly','remainingAmount','remainingMonths','status'].includes(f))loan.referenceMonth=loan.referenceMonth||currentYearMonth();
     }
     loan.updatedAt=new Date().toISOString();
     localStorage.setItem('pf_finance_settings',JSON.stringify(financeSettings));
     financeSettingsDirty=true;
     scheduleRecordPush('finance-settings-edit');
     renderSavedLoanSummary();
     if(document.querySelector('#incomeplan.active'))renderIncomePlan();
    };
    el.oninput=commit;el.onchange=commit;
   });
  });
  loansBox.querySelectorAll('[data-delete-loan]').forEach(b=>b.onclick=()=>{
   const i=Number(b.dataset.deleteLoan),l=financeSettings.loans[i];
   if(!confirm(`Delete loan "${l?.name||'Loan'}"?`))return;
   financeSettings.loans.splice(i,1);
   localStorage.setItem('pf_finance_settings',JSON.stringify(financeSettings));
   financeSettingsDirty=true;financeSettingsEditing=true;
   scheduleRecordPush('finance-settings-delete-loan');
   renderFinanceSettings(true);renderSavedLoanSummary();renderIncomePlan();renderDashboard();
  });
 }
 renderSavedLoanSummary();
 const cycleBox=$('cardCycleSettingsRows');
 if(cycleBox){
  const cards=financeSettingCards();
  if($('cardCycleSettingsStatus'))$('cardCycleSettingsStatus').textContent=`${cards.length} credit cards configured`;
  cycleBox.innerHTML=cards.map(a=>{const c=cardCycleSetting(a.id);return `<div class="panel" style="padding:12px"><div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">${bankLogoHTML(a)}<div><b>${escapeHtml(`${a.bank||'Credit Card'} • ${a.name||a.id}${a.ending?` •${a.ending}`:''}`)}</b><div class="meta">Statement and payment cycle</div></div></div><div class="formGrid" style="margin-top:10px"><div class="field"><label>Statement Cutoff Day</label><input type="number" min="1" max="31" data-cycle-card="${a.id}" data-cycle-field="statementDay" value="${Number(c.statementDay||1)}"></div><div class="field"><label>Payment Due Day</label><input type="number" min="1" max="31" data-cycle-card="${a.id}" data-cycle-field="dueDay" value="${Number(c.dueDay||25)}"></div></div></div>`;}).join('');
  cycleBox.querySelectorAll('[data-cycle-card]').forEach(el=>{
   el.onfocus=()=>{financeSettingsEditing=true};
   const commit=()=>{
    financeSettingsEditing=true;
    const card=el.dataset.cycleCard,field=el.dataset.cycleField;
    financeSettings.cardCycles[card]=financeSettings.cardCycles[card]||{};
    financeSettings.cardCycles[card][field]=Math.max(1,Math.min(31,Number(el.value||1)));
    localStorage.setItem('pf_finance_settings',JSON.stringify(financeSettings));
    financeSettingsDirty=true;
    scheduleRecordPush('finance-settings-card-cycle');
    renderCreditCardCalendar();
   };
   el.oninput=commit;el.onchange=commit;
  });
 }
}
function addLoanSetting(){
 const loan={id:'loan-'+Date.now(),name:'New Loan',monthly:0,remainingAmount:0,remainingMonths:0,status:'active',referenceMonth:currentYearMonth(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
 financeSettings.loans.push(loan);
 localStorage.setItem('pf_finance_settings',JSON.stringify(financeSettings));
 financeSettingsDirty=true;financeSettingsEditing=true;
 scheduleRecordPush('finance-settings-add-loan');
 renderFinanceSettings(true);
 setTimeout(()=>{const rows=document.querySelectorAll('[data-loan-setting]');const last=rows[rows.length-1];const input=last?.querySelector('[data-loan-field="name"]');if(input){input.focus();input.select();}},0);
}
function renderIncomeLoanGrid(){const box=$('incomeLoanGrid');if(!box)return;const rows=financeSettings.loans||[];box.innerHTML=rows.length?rows.map(l=>{const c=loanCalc(l);return `<div class="loanCard"><div class="splitHead"><div><b>${escapeHtml(l.name||'Loan')}</b><div class="meta">${l.status==='closed'?'Closed':'Monthly deduction'}</div></div><span class="badge ${c.status==='Active'?'active':'completed'}">${c.status==='Active'?`${c.remainingMonths} months remaining`:'Closed / Completed'}</span></div><div class="cardMetricGrid" style="grid-template-columns:repeat(3,1fr);margin-top:12px"><div class="miniMetric"><span>Monthly Payment</span><b class="red">${money(l.status==='closed'?0:Number(l.monthly||0))}</b></div><div class="miniMetric"><span>Remaining Months</span><b>${c.remainingMonths}</b></div><div class="miniMetric"><span>Remaining Amount</span><b>${money(c.remainingAmount)}</b></div></div></div>`;}).join(''):'<div class="notice">No bank loans configured. Add them under More → Finance Settings.</div>';}

function renderIncomePlan(){
 applySavedIncomePlanForCurrentMonth();
 $('incomeMySalary').value=incomePlan.mySalary||'';
 $('incomeWifeSalary').value=incomePlan.wifeSalary||'';
 $('incomeExtra').value='';
 renderExtraIncomeHistory();
 renderMonthlyIncomePlans();
 $('incomeOther').value=incomePlan.otherIncome||'';
 incomePlan.allocations=incomePlan.allocations||{};
 renderCreditCardCalendar();
 renderCreditCardAllocations();
 accounts.filter(a=>a.type==='card').forEach(a=>{
  const el=$('alloc_'+a.id);
  if(el)el.value=incomePlan.allocations[a.id]||'';
 });
 renderIncomeLoanGrid();
 updateIncomePlanPreview();
}
function readIncomePlanInputs(){
 incomePlan.mySalary=Number($('incomeMySalary').value||0);
 incomePlan.wifeSalary=Number($('incomeWifeSalary').value||0);
 incomePlan.extraIncome=accumulatedExtraIncome();
 incomePlan.otherIncome=Number($('incomeOther').value||0);
 incomePlan.allocations=incomePlan.allocations||{};
 accounts.filter(a=>a.type==='card').forEach(a=>{
  const el=$('alloc_'+a.id);
  if(el)incomePlan.allocations[a.id]=Number(el.value||0);
 });
}

function deleteCashFlowLedgerEntry(ledgerId){
 const row=(cashFlowLedger||[]).find(x=>x.id===ledgerId && x.status!=='reversed');
 if(!row)return;

 if(row.type==='card-payment'){
  // Use the connected card-payment deletion so planner paid amount,
  // monthly income, card available credit and cloud state all remain consistent.
  deleteMonthlyIncomeCardPayment(row.id);
  return;
 }

 if(row.type==='outgoing-payment'){
  const outgoingId=row.targetId;
  const month=row.month||incomeMonthKey(row.date);
  if(!confirm(
   `Delete this outgoing payment record?\n\n${row.targetName||row.description||'Outgoing'}\n${money(Number(row.amount||0))} • ${row.date||''}\n\n`+
   `The payment source effect will be reversed automatically.`
  ))return;

  try{saveRecoverySnapshot('before-delete-cash-flow-outgoing');}catch(_){}
  undoOutgoingPayment(outgoingId,month,true);
  scheduleRecordPush('delete-cash-flow-outgoing');
  return;
 }

 // Generic ledger entry: reverse rather than silently dropping financial audit data.
 if(!confirm(`Delete this cash-flow entry?\n\n${row.targetName||row.description||row.type}\n${money(Number(row.amount||0))}\n\nIt will be reversed and removed from active cash-flow calculations.`))return;

 row.status='reversed';
 row.reversedAt=new Date().toISOString();
 row.reversalReason='Deleted from Monthly Cash Flow Usage Ledger';
 localStorage.setItem('pf_cash_flow_ledger',JSON.stringify(cashFlowLedger));
 saveLocal();
 syncCashFlowLedgerImmediate();
 renderIncomePlan();
 renderDashboard();
}

function updateIncomePlanPreview(){
 readIncomePlanInputs();
 const pendingExtra=Number($('incomeExtra')?.value||0);
 const savedExtra=accumulatedExtraIncome();
 const originalExtra=incomePlan.extraIncome;
 incomePlan.extraIncome=savedExtra+(Number.isFinite(pendingExtra)?pendingExtra:0);
 const income=totalIncomePlan(),loans=totalFixedLoans(),paidFromIncome=remainingIncomePaymentsTotal();
 const planMonth=currentIncomeMonth();
 const outgoingIncomeImpact=outgoingForMonth(planMonth);
 const outgoingPayments=outgoingPaymentsForMonth(planMonth);
 const outgoingPaidFromIncome=outgoingPaidFromMonthlyIncomeTotal(planMonth);
 incomePlan.extraIncome=originalExtra;

 $('planTotalIncome').textContent=money(income);
 $('planLoans').textContent=money(loans);
 $('planOutgoings').textContent=money(outgoingIncomeImpact);
 if($('planCardPayments'))$('planCardPayments').textContent=money(paidFromIncome);

 // Outgoing income impact already includes an unpaid planned outgoing OR a paid-from-income
 // outgoing exactly once. Card/bank-funded outgoings do not reduce Monthly Planned Income.
 const afterPreview=income-loans-outgoingIncomeImpact-paidFromIncome;
 $('planAfterLoans').textContent=(afterPreview<0?'-':'')+money(Math.abs(afterPreview));
 $('planAfterLoans').className='big '+(afterPreview>=0?'green':'red');
 const paymentRows=plannedIncomePaymentHistory();
 if($('incomePaymentCount'))$('incomePaymentCount').textContent=`${paymentRows.length} payment${paymentRows.length===1?'':'s'} • ${money(paidFromIncome)}`;
 if($('incomePaymentBreakdownBody')){
  $('incomePaymentBreakdownBody').innerHTML=paymentRows.length
   ? paymentRows.map(h=>`<tr>
      <td>${h._budgetLegacy?'Reconciled':(h.date||'—')}</td>
      <td>${accountName(h.targetCardId)}</td>
      <td>${h.sourceName||accountName(h.sourceId)||'—'}</td>
      <td class="red"><b>${money(Number(h.amount||0))}</b></td>
      <td>${h.ledgerId?`<button class="btn danger" type="button" data-delete-income-card-payment="${h.ledgerId}">Delete</button>`:'<span class="meta">Historical</span>'}</td>
     </tr>`).join('')
   : '<tr><td colspan="5">No card payments deducted from this month yet.</td></tr>';

  document.querySelectorAll('[data-delete-income-card-payment]').forEach(btn=>{
   btn.addEventListener('click',()=>deleteMonthlyIncomeCardPayment(btn.dataset.deleteIncomeCardPayment));
  });
}

 if($('incomeOutgoingPaymentCount')){
  $('incomeOutgoingPaymentCount').textContent=`${outgoingPayments.length} payment${outgoingPayments.length===1?'':'s'} • ${money(outgoingPayments.reduce((s,x)=>s+Number(x.amount||0),0))}`;
 }
 if($('incomeOutgoingPaymentBody')){
  $('incomeOutgoingPaymentBody').innerHTML=outgoingPayments.length
   ? outgoingPayments.map(x=>{
      const fromIncome=x.sourceId==='cash-source';
      const sourceLabel=fromIncome?'Monthly Planned Income':accountName(x.sourceId);
      const impact=fromIncome?`<span class="red"><b>Deducted</b></span>`:`<span class="green"><b>Not deducted</b></span>`;
      const note=!fromIncome&&account(x.sourceId)?.type==='card'
       ? `<div class="meta">Recorded as a transaction on this card</div>`
       : (!fromIncome&&account(x.sourceId)?.type==='bank'
          ? `<div class="meta">Deducted from bank balance</div>`
          : '');
      return `<tr><td>${x.date||'—'}</td><td><b>${x.description}</b></td><td>${sourceLabel}${note}</td><td>${impact}</td><td class="red"><b>${money(x.amount)}</b></td></tr>`;
     }).join('')
   : '<tr><td colspan="5">No outgoing payments recorded for this month yet.</td></tr>';
 }

 const ledgerRows=cashFlowLedgerRows(planMonth);
 if($('cashFlowLedgerCount'))$('cashFlowLedgerCount').textContent=`${ledgerRows.length} entr${ledgerRows.length===1?'y':'ies'} • ${money(ledgerRows.reduce((s,x)=>s+Number(x.amount||0),0))}`;
 if($('cashFlowLedgerBody'))$('cashFlowLedgerBody').innerHTML=ledgerRows.length
  ? ledgerRows.map(x=>{
     const type=x.type==='card-payment'?'Card Payment':x.type==='outgoing-payment'?'Outgoing Payment':x.type;
     const source=x.sourceName||(x.sourceId==='cash-source'?'Monthly Planned Income':accountName(x.sourceId));
     const impact=x.deductFromIncome
       ? '<span class="red"><b>Deducted</b></span>'
       : '<span class="green"><b>Not deducted</b></span>';
     return `<tr><td>${x.date||'—'}</td><td>${type}</td><td><b>${x.targetName||x.description||'—'}</b></td><td>${source||'—'}</td><td>${impact}</td><td class="${x.deductFromIncome?'red':''}"><b>${money(x.amount)}</b></td><td><button class="btn small danger" type="button" data-delete-cash-ledger="${x.id}">Delete</button></td></tr>`;
    }).join('')
  : '<tr><td colspan="7">No cash-flow usage recorded for this month.</td></tr>';

 document.querySelectorAll('[data-delete-cash-ledger]').forEach(b=>b.onclick=()=>deleteCashFlowLedgerEntry(b.dataset.deleteCashLedger));

 accounts.filter(a=>a.type==='card').forEach(a=>{
  const el=$('obligation_'+a.id);
  if(!el)return;
  const current=findBestPaymentPlanForCard(a.id),remaining=current?paymentRemainingAmount(current):null;
  el.textContent=Number.isFinite(remaining)
   ? `Current-month payment only • ${money(remaining)} remaining`
   : 'No released current-month payment yet';
 });
 const allocated=0;
 // afterPreview already subtracts all card payments funded from Monthly Planned Income.
 // Do not subtract them a second time here.
 const unallocated=afterPreview-allocated;
 $('unallocatedAmount').textContent=(unallocated<0?'-':'')+money(unallocated);
 $('unallocatedAmount').className=unallocated>=0?'green':'red';
 const warn=$('allocationWarning');
 if(afterPreview<0){warn.style.display='block';warn.textContent='Your fixed monthly bank-loan deductions are greater than the income entered by '+money(Math.abs(afterPreview))+'.'}
 else if(unallocated<0){warn.style.display='block';warn.textContent='Credit-card allocation is '+money(Math.abs(unallocated))+' higher than the amount available after bank loans.'}
 else{warn.style.display='none';warn.textContent=''}
}

['incomeMySalary','incomeWifeSalary','incomeExtra','incomeOther'].forEach(id=>{
 const el=$(id);if(el)el.addEventListener('input',updateIncomePlanPreview);
});
$('showTxHistory').addEventListener('click',()=>{const box=$('txHistoryBox');box.style.display=box.style.display==='none'?'block':'none';renderTxHistory()});


if($('resetCurrentMonthExtraIncome'))$('resetCurrentMonthExtraIncome').addEventListener('click',()=>{
 const month=currentIncomeMonth(),current=accumulatedExtraIncome(month);
 if(current<=0)return;
 if(!confirm(`Reset ${extraIncomeMonthTitle(month)} Extra Income?\n\nCurrent accumulated amount: ${money(current)}\n\nThis removes only this month's extra-income entries. Previous months remain in history.`))return;
 incomePlan.extraIncomeHistory=(incomePlan.extraIncomeHistory||[]).filter(x=>(x.month||incomeMonthKey(x.date))!==month);
 incomePlan.extraIncome=0;
 localStorage.setItem('pf_income_plan',JSON.stringify(incomePlan));
 saveLocal();renderIncomePlan();
});
if($('clearExtraIncomeHistory'))$('clearExtraIncomeHistory').addEventListener('click',()=>{
 if(!(incomePlan.extraIncomeHistory||[]).length)return;
 if(!confirm('Clear ALL saved extra-income history for every month?'))return;
 incomePlan.extraIncomeHistory=[];
 incomePlan.extraIncome=0;
 localStorage.setItem('pf_income_plan',JSON.stringify(incomePlan));
 saveLocal();renderIncomePlan();
});
if($('saveIncomePlan'))$('saveIncomePlan').addEventListener('click',()=>{
 const month=currentIncomeMonth();
 const added=addExtraIncomeFromInput();
 readIncomePlanInputs();
 incomePlan.extraIncome=accumulatedExtraIncome(month);
 const saved=saveMonthlyIncomePlan(month);
 localStorage.setItem('pf_income_plan',JSON.stringify(incomePlan));
 saveLocal();
 renderIncomePlan();
 alert(`${extraIncomeMonthTitle(month)} income plan saved.${added?` Extra income added; this month's extra income is ${money(saved.extraIncome)}.`:''}`);
});

function openModal(id){$(id).classList.add('open')}function closeModal(id){$(id).classList.remove('open')}
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.close)));
document.querySelectorAll('.modalBack').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeModal(m.id)}));
document.addEventListener('click',e=>{
 const close=e.target.closest?.('[data-close]');
 if(close){e.preventDefault();e.stopPropagation();closeModal(close.dataset.close);return;}
 const back=e.target.classList?.contains('modalBack')?e.target:null;
 if(back)closeModal(back.id);
});

$('resetLocal').addEventListener('click',()=>{if(confirm('Reset custom categories, merchant rules and manual installment plans?')){localStorage.removeItem('pf_finance_settings');localStorage.removeItem('pf_categories');localStorage.removeItem('pf_installments');localStorage.removeItem('pf_merchant_rules');localStorage.removeItem('pf_tx_overrides');localStorage.removeItem('pf_income_plan');localStorage.removeItem('pf_manual_transactions');localStorage.removeItem('pf_imported_transactions');localStorage.removeItem('pf_import_history');localStorage.removeItem('pf_card_payment_plan');localStorage.removeItem('pf_duplicate_decisions');localStorage.removeItem('pf_statement_rule');localStorage.removeItem('pf_transaction_actions');location.reload()}});

$('detailBack').addEventListener('click',()=>{
 renderAccounts();
 nav('accounts');
 window.scrollTo({top:0,behavior:'smooth'});
});

function runtimeSelfTest(){
 const issues=[];
 try{
  if(!Array.isArray(accounts)||!accounts.length)issues.push('accounts failed to initialize');
  accounts.filter(a=>a.type==='card').forEach(a=>{
   const m=cardMetrics(a);
   ['limit','available','inst','total','current'].forEach(k=>{
    if(!Number.isFinite(Number(m[k])))issues.push(`${a.id}: invalid ${k}`);
   });
  });
 }catch(e){issues.push('cardMetrics: '+e.message);}
 try{
  installments.forEach(p=>{const c=planCalc(p);if(!Number.isFinite(c.remaining))issues.push(`${p.id}: invalid remaining`);});
  completedInstallmentPlans().forEach(p=>{if(planCalc(p).monthly!==0||planCalc(p).remaining>0.005)issues.push(`${p.id}: completed plan still affects calculations`);});
  installments.filter(p=>planCalc(p).status==='Review').forEach(p=>{if(planCalc(p).monthly<=0||planCalc(p).remaining<=0)issues.push(`${p.id}: review plan was excluded before confirmation`);});
 }catch(e){issues.push('planCalc: '+e.message);}
 return issues;
}


const SUPABASE_URL='https://qxayaygycgqwrerhrrlq.supabase.co', SUPABASE_PUBLISHABLE_KEY='sb_publishable_2RIeDYaMuiPFyVs1TEG9wA_wqc8oNx2';
const cloudClient=window.supabase?.createClient?window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY):null;
function cloudSetStatus(x){if($('cloudStatus'))$('cloudStatus').textContent=x;}

// ===================== V145 REALTIME RECORD SYNC =====================
// Supabase is the canonical database. Browser storage is a cache/recovery layer.
const RECORD_SYNC_TABLE='finance_sync_records';
const RECORD_SYNC_SINGLETON='singleton';
var recordSyncReady=false;
var recordSyncApplying=false;
var recordSyncPushTimer=null;
var recordSyncPushBusy=false;
var recordSyncPullBusy=false;
var recordSyncChannel=null;
var recordSyncLastEventAt=0;
var recordRealtimePullTimer=null;
var recordSyncLastCloudUpdatedAt=0;
var recordSyncLocalMute=new Map();
var recordSyncFallbackTimer=null;
var recordSyncDeltaBusy=false;


function recordSyncKey(section,recordId){
 return `${section}|${String(recordId)}`;
}
function markLocalRecordWrite(section,recordId,ttl=2500){
 recordSyncLocalMute.set(recordSyncKey(section,recordId),Date.now()+ttl);
}
function isMutedRealtimeRecord(section,recordId){
 const key=recordSyncKey(section,recordId);
 const until=recordSyncLocalMute.get(key)||0;
 if(until>Date.now())return true;
 if(until)recordSyncLocalMute.delete(key);
 return false;
}
function noteCloudUpdatedAt(value){
 const t=new Date(value||0).getTime();
 if(Number.isFinite(t)&&t>recordSyncLastCloudUpdatedAt)recordSyncLastCloudUpdatedAt=t;
}
function currentCloudCursorIso(){
 return recordSyncLastCloudUpdatedAt?new Date(recordSyncLastCloudUpdatedAt).toISOString():'1970-01-01T00:00:00.000Z';
}
function syncArrayForSection(section){
 switch(section){
  case 'manual_transactions': return manualTransactions;
  case 'imported_transactions': return importedTransactions;
  case 'import_history': return importHistory;
  case 'cash_flow_ledger': return cashFlowLedger;
  case 'outgoings': return outgoings;
  case 'installments': return installments;
  case 'card_payment_plan': return cardPaymentPlan;
  case 'investments_holdings': return (typeof invHoldings!=='undefined'?invHoldings:[]);
  case 'investments_trades': return (typeof invTrades!=='undefined'?invTrades:[]);
  case 'rental_bookings': return (typeof rentalBookings!=='undefined'?rentalBookings:[]);
  case 'rental_expenses': return (typeof rentalExpenses!=='undefined'?rentalExpenses:[]);
  case 'rental_blocks': return (typeof rentalBlocks!=='undefined'?rentalBlocks:[]);
  case 'personal_assets_gold': return (typeof goldAssets!=='undefined'?goldAssets:[]);
  case 'personal_assets_zakat': return (typeof goldZakatHistory!=='undefined'?goldZakatHistory:[]);
  case 'personal_assets_sales': return (typeof goldSaleHistory!=='undefined'?goldSaleHistory:[]);
  default:return null;
 }
}
function setSyncArrayForSection(section,value){
 switch(section){
  case 'manual_transactions': manualTransactions=value;break;
  case 'imported_transactions': importedTransactions=value;break;
  case 'import_history': importHistory=value;break;
  case 'cash_flow_ledger': cashFlowLedger=value;break;
  case 'outgoings': outgoings=value;break;
  case 'installments': installments=value;break;
  case 'card_payment_plan': cardPaymentPlan=value;break;
  case 'investments_holdings': invHoldings=value;localStorage.setItem('pf_investments_holdings',JSON.stringify(value));break;
  case 'investments_trades': invTrades=value;localStorage.setItem('pf_investments_trades',JSON.stringify(value));break;
  case 'rental_bookings': rentalBookings=value;localStorage.setItem('pf_rental_bookings',JSON.stringify(value));break;
  case 'rental_expenses': rentalExpenses=value;localStorage.setItem('pf_rental_expenses',JSON.stringify(value));break;
  case 'rental_blocks': rentalBlocks=value;localStorage.setItem('pf_rental_blocks',JSON.stringify(value));break;
  case 'personal_assets_gold': goldAssets=value;localStorage.setItem('pf_gold_assets',JSON.stringify(value));break;
  case 'personal_assets_zakat': goldZakatHistory=value;localStorage.setItem('pf_gold_zakat_history',JSON.stringify(value));break;
  case 'personal_assets_sales': goldSaleHistory=value;localStorage.setItem('pf_gold_sale_history',JSON.stringify(value));break;
 }
}
function mergeOneRecordIntoSection(row){
 const section=row.section,recordId=String(row.record_id);
 const deleted=!!row.deleted_at;

 const singletonSections=new Set([
  'finance_settings','categories','merchant_rules','tx_overrides','income_plan',
  'duplicate_decisions','statement_rule','transaction_actions','bank_balance_overrides',
  'reset_card_ids','card_reset_history','deleted_installment_ids','personal_assets_market'
 ]);

 if(singletonSections.has(section)){
  if(deleted)return false;
  const data=row.data;
  const currentSingleton={
   finance_settings:financeSettings,categories,merchant_rules:merchantRules,
   tx_overrides:txOverrides,income_plan:incomePlan,duplicate_decisions:duplicateDecisions,
   statement_rule:statementRule,transaction_actions:transactionActions,
   bank_balance_overrides:bankBalanceOverrides,reset_card_ids:[...resetCardIds],
   card_reset_history:cardResetHistory,deleted_installment_ids:[...deletedInstallmentIds],
   personal_assets_market:goldMarket
  }[section];
  // A full record push can echo an unchanged singleton back to this browser.
  // Treating that echo as a real change rebuilt the visible table and made rows
  // appear to move away and return. Only render when the data actually differs.
  try{if(JSON.stringify(currentSingleton)===JSON.stringify(data))return false;}catch(_){}
  switch(section){
   case 'finance_settings':
    if(financeSettingsEditing||financeSettingsDirty)return false;
    {
     financeSettings=data||financeSettings;
     if(!Array.isArray(financeSettings.loans))financeSettings.loans=[];
     if(!financeSettings.cardCycles||typeof financeSettings.cardCycles!=='object')financeSettings.cardCycles={};
     Object.entries(DEFAULT_CARD_CYCLE_SETTINGS).forEach(([id,cfg])=>{
      if(!financeSettings.cardCycles[id])financeSettings.cardCycles[id]={...cfg};
     });
    }
    break;
   case 'categories': categories=data||categories;break;
   case 'merchant_rules': merchantRules=data||merchantRules;break;
   case 'tx_overrides': txOverrides=data||txOverrides;break;
   case 'income_plan': incomePlan=data||incomePlan;break;
   case 'duplicate_decisions': duplicateDecisions=data||duplicateDecisions;break;
   case 'statement_rule': statementRule=data||statementRule;break;
   case 'transaction_actions': transactionActions=data||transactionActions;break;
   case 'bank_balance_overrides': bankBalanceOverrides=data||bankBalanceOverrides;break;
   case 'reset_card_ids': resetCardIds=new Set(Array.isArray(data)?data:[]);break;
   case 'card_reset_history': cardResetHistory=Array.isArray(data)?data:[];break;
   case 'deleted_installment_ids': deletedInstallmentIds=new Set(Array.isArray(data)?data:[]);break;
   case 'personal_assets_market': goldMarket=data||goldMarket;localStorage.setItem('pf_gold_market',JSON.stringify(goldMarket));break;
  }
  return true;
 }

 const arr=syncArrayForSection(section);
 if(!arr)return false;
 const idx=arr.findIndex((x,i)=>syncStableId(section,x,i)===recordId);
 const rowData=section==='investments_trades'?{...(row.data||{}),_cloudRecordId:row.data?._cloudRecordId??recordId}:row.data;

 if(deleted){
  if(idx<0)return false;
  const copy=arr.slice();copy.splice(idx,1);setSyncArrayForSection(section,copy);return true;
 }

 if(idx>=0){
  // Skip if data is structurally unchanged.
  try{
   if(JSON.stringify(arr[idx])===JSON.stringify(rowData))return false;
  }catch(_){}
  const copy=arr.slice();copy[idx]=rowData;setSyncArrayForSection(section,copy);return true;
 }

 setSyncArrayForSection(section,[...arr,rowData]);
 return true;
}
function normalizeAfterRecordSections(sections){
 const s=new Set(sections);

 if(s.has('deleted_installment_ids')){
  installments=(installments||[]).filter(p=>!deletedInstallmentIds.has(p.id));
 }

 const transactionRelated=[
  'manual_transactions','imported_transactions','tx_overrides','transaction_actions',
  'duplicate_decisions','merchant_rules','categories','statement_rule','reset_card_ids',
  'card_reset_history'
 ].some(x=>s.has(x));

 const plannerRelated=[
  'cash_flow_ledger','installments','card_payment_plan','deleted_installment_ids',
  'bank_balance_overrides','finance_settings'
 ].some(x=>s.has(x));

 if(transactionRelated){
  purgeLegacyAr0955StatementRows();
  purgeLegacyAr5867SeedRows();
  purgeLegacySabAnchorRows();
  rebuildTransactions();
 }

 if(plannerRelated){
  purgeLegacySeedPaymentPlans();
  normalizeCardPaymentPlan();
  normalizeBalanceOffers();
  ensurePartialPaymentFields();
  ensureLedgerBackedPlannerRows();
  rebuildAllPlannerPaymentsFromLedger();
 }

 persistRecoveredState();
 try{financeDB.save();}catch(_){}
}
function sectionAffectsPage(section,page){
 const map={
  transactions:new Set(['manual_transactions','imported_transactions','tx_overrides','transaction_actions','duplicate_decisions','merchant_rules','categories','statement_rule','reset_card_ids','card_reset_history']),
  accountDetail:new Set(['manual_transactions','imported_transactions','tx_overrides','transaction_actions','installments','card_payment_plan','cash_flow_ledger','bank_balance_overrides','reset_card_ids','card_reset_history']),
  accounts:new Set(['manual_transactions','imported_transactions','installments','card_payment_plan','cash_flow_ledger','bank_balance_overrides','finance_settings']),
  dashboard:new Set(['manual_transactions','imported_transactions','installments','card_payment_plan','cash_flow_ledger','bank_balance_overrides','finance_settings','income_plan','outgoings']),
  reports:new Set(['manual_transactions','imported_transactions','tx_overrides','transaction_actions','categories']),
  installments:new Set(['installments','deleted_installment_ids','card_payment_plan']),
  incomeplan:new Set(['income_plan','finance_settings','outgoings','card_payment_plan','cash_flow_ledger','manual_transactions','imported_transactions']),
  outgoings:new Set(['outgoings','cash_flow_ledger']),
  categories:new Set(['categories','merchant_rules']),
  importstatements:new Set(['import_history','manual_transactions','imported_transactions']),
  financeSettings:new Set(['finance_settings']),
  investments:new Set(['investments_holdings','investments_trades']),
  rental:new Set(['rental_bookings','rental_expenses','rental_blocks']),
  personalassets:new Set(['personal_assets_gold','personal_assets_zakat','personal_assets_sales','personal_assets_market'])
 };
 return map[page]?.has(section)??false;
}
function renderCurrentPageForSections(sections){
 const page=activeViewId();
 if(!sections.some(s=>sectionAffectsPage(s,page)))return false;

 const state=captureReviewState();
 if(page==='transactions')renderTransactions();
 else if(page==='reports')renderReports();
 else if(page==='installments')renderInstallments();
 else if(page==='categories')renderCategories();
 else if(page==='incomeplan')renderIncomePlan();
 else if(page==='outgoings')renderOutgoings();
 else if(page==='importstatements')renderImportPage();
 else if(page==='accounts')renderAccounts();
 else if(page==='dashboard')renderDashboard();
 else if(page==='investments'&&typeof renderInvestments==='function')renderInvestments();
 else if(page==='rental'&&typeof renderRental==='function')renderRental();
 else if(page==='personalassets'&&typeof renderPersonalAssets==='function')renderPersonalAssets();
 else if(page==='financeSettings'){
  if(!financeSettingsEditing)renderFinanceSettings();
  else return false;
 }
 else if(page==='accountDetail'&&currentAccountDetailId){
  openAccount(currentAccountDetailId,accountDetailReturnPage||'accounts');
 }

 // Restore UI state once, after the single targeted render.
 restoreReviewControls(state);
 requestAnimationFrame(()=>window.scrollTo(Number(state.x||0),Number(state.y||0)));
 return true;
}
function applyRecordSyncDeltaRows(rows,{render=true}={}){
 if(!Array.isArray(rows)||!rows.length)return {changed:false,sections:[]};
 recordSyncApplying=true;
 try{
  const changedSections=[];
  rows.forEach(row=>{
   noteCloudUpdatedAt(row.updated_at);
   if(mergeOneRecordIntoSection(row))changedSections.push(row.section);
  });
  const sections=[...new Set(changedSections)];
  if(!sections.length)return {changed:false,sections:[]};
  normalizeAfterRecordSections(sections);
  if(render)renderCurrentPageForSections(sections);
  return {changed:true,sections};
 }finally{
  recordSyncApplying=false;
 }
}

function syncStableId(section,x,i=0){
 if(section==='investments_trades'&&x?._cloudRecordId!=null)return String(x._cloudRecordId);
 if(x && (x._id!=null || x.id!=null))return String(x._id??x.id);
 if(section==='import_history')return String(x?.id ?? `${x?.fileName||x?.file_name||'file'}|${x?.importedAt||x?.imported_at||i}`);
 if(section==='cash_flow_ledger')return String(x?.id ?? cashFlowLedgerKey(x||{}));
 if(section==='outgoings')return String(x?.id ?? `${x?.description||'out'}|${x?.startMonth||x?.start_month||''}|${i}`);
 return String(i);
}

function buildRecordSyncRowsFromState(){
 const rows=[];
 const add=(section,record_id,data)=>rows.push({section,record_id:String(record_id),data});

 // Singleton/object sections.
 add('finance_settings',RECORD_SYNC_SINGLETON,financeSettings||{});
 add('categories',RECORD_SYNC_SINGLETON,categories||{});
 add('merchant_rules',RECORD_SYNC_SINGLETON,merchantRules||{});
 add('tx_overrides',RECORD_SYNC_SINGLETON,txOverrides||{});
 add('income_plan',RECORD_SYNC_SINGLETON,incomePlan||{});
 add('duplicate_decisions',RECORD_SYNC_SINGLETON,duplicateDecisions||{});
 add('statement_rule',RECORD_SYNC_SINGLETON,statementRule||{});
 add('transaction_actions',RECORD_SYNC_SINGLETON,transactionActions||{});
 add('bank_balance_overrides',RECORD_SYNC_SINGLETON,bankBalanceOverrides||{});
 add('reset_card_ids',RECORD_SYNC_SINGLETON,[...resetCardIds]);
 add('card_reset_history',RECORD_SYNC_SINGLETON,cardResetHistory||[]);
 add('deleted_installment_ids',RECORD_SYNC_SINGLETON,[...deletedInstallmentIds]);
 add('custom_banks',RECORD_SYNC_SINGLETON,Array.isArray(customBanks)?customBanks:[]);
 add('custom_credit_cards',RECORD_SYNC_SINGLETON,Array.isArray(customCreditCards)?customCreditCards:[]);
 add('personal_assets_market',RECORD_SYNC_SINGLETON,(typeof goldMarket!=='undefined'?goldMarket:{}));

 // Record sections.
 (manualTransactions||[]).forEach((x,i)=>add('manual_transactions',syncStableId('manual_transactions',x,i),x));
 (importedTransactions||[]).forEach((x,i)=>add('imported_transactions',syncStableId('imported_transactions',x,i),x));
 (importHistory||[]).forEach((x,i)=>add('import_history',syncStableId('import_history',x,i),x));
 (cashFlowLedger||[]).forEach((x,i)=>add('cash_flow_ledger',syncStableId('cash_flow_ledger',x,i),x));
 (outgoings||[]).forEach((x,i)=>add('outgoings',syncStableId('outgoings',x,i),x));
 (installments||[]).forEach((x,i)=>add('installments',syncStableId('installments',x,i),x));
 (cardPaymentPlan||[]).forEach((x,i)=>add('card_payment_plan',syncStableId('card_payment_plan',x,i),x));
 (typeof invHoldings!=='undefined'?invHoldings:[]).forEach((x,i)=>add('investments_holdings',syncStableId('investments_holdings',x,i),x));
 (typeof invTrades!=='undefined'?invTrades:[]).forEach((x,i)=>add('investments_trades',syncStableId('investments_trades',x,i),x));
 (typeof rentalBookings!=='undefined'?rentalBookings:[]).forEach((x,i)=>add('rental_bookings',syncStableId('rental_bookings',x,i),x));
 (typeof rentalExpenses!=='undefined'?rentalExpenses:[]).forEach((x,i)=>add('rental_expenses',syncStableId('rental_expenses',x,i),x));
 (typeof rentalBlocks!=='undefined'?rentalBlocks:[]).forEach((x,i)=>add('rental_blocks',syncStableId('rental_blocks',x,i),x));
 (typeof goldAssets!=='undefined'?goldAssets:[]).forEach((x,i)=>add('personal_assets_gold',syncStableId('personal_assets_gold',x,i),x));
 (typeof goldZakatHistory!=='undefined'?goldZakatHistory:[]).forEach((x,i)=>add('personal_assets_zakat',syncStableId('personal_assets_zakat',x,i),x));
 (typeof goldSaleHistory!=='undefined'?goldSaleHistory:[]).forEach((x,i)=>add('personal_assets_sales',syncStableId('personal_assets_sales',x,i),x));

 return rows;
}

function recordRowsFromSnapshot(s){
 if(!s||typeof s!=='object')return [];
 const rows=[];
 const add=(section,record_id,data)=>rows.push({section,record_id:String(record_id),data});

 add('finance_settings',RECORD_SYNC_SINGLETON,s.financeSettings||financeSettings||{});
 add('categories',RECORD_SYNC_SINGLETON,s.categories||{});
 add('merchant_rules',RECORD_SYNC_SINGLETON,s.merchantRules||{});
 add('tx_overrides',RECORD_SYNC_SINGLETON,s.txOverrides||{});
 add('income_plan',RECORD_SYNC_SINGLETON,s.incomePlan||{});
 add('duplicate_decisions',RECORD_SYNC_SINGLETON,s.duplicateDecisions||{});
 add('statement_rule',RECORD_SYNC_SINGLETON,s.statementRule||{});
 add('transaction_actions',RECORD_SYNC_SINGLETON,s.transactionActions||{});
 add('bank_balance_overrides',RECORD_SYNC_SINGLETON,s.bankBalanceOverrides||{});
 add('reset_card_ids',RECORD_SYNC_SINGLETON,Array.isArray(s.resetCardIds)?s.resetCardIds:[]);
 add('card_reset_history',RECORD_SYNC_SINGLETON,s.cardResetHistory||[]);
 add('deleted_installment_ids',RECORD_SYNC_SINGLETON,Array.isArray(s.deletedInstallmentIds)?s.deletedInstallmentIds:[]);
 add('custom_banks',RECORD_SYNC_SINGLETON,Array.isArray(s.customBanks)?s.customBanks:[]);
 add('custom_credit_cards',RECORD_SYNC_SINGLETON,Array.isArray(s.customCreditCards)?s.customCreditCards:[]);

 (s.manualTransactions||[]).forEach((x,i)=>add('manual_transactions',syncStableId('manual_transactions',x,i),x));
 (s.importedTransactions||[]).forEach((x,i)=>add('imported_transactions',syncStableId('imported_transactions',x,i),x));
 (s.importHistory||[]).forEach((x,i)=>add('import_history',syncStableId('import_history',x,i),x));
 (s.cashFlowLedger||[]).forEach((x,i)=>add('cash_flow_ledger',syncStableId('cash_flow_ledger',x,i),x));
 (s.outgoings||[]).forEach((x,i)=>add('outgoings',syncStableId('outgoings',x,i),x));
 (s.installments||[]).forEach((x,i)=>add('installments',syncStableId('installments',x,i),x));
 (s.cardPaymentPlan||[]).forEach((x,i)=>add('card_payment_plan',syncStableId('card_payment_plan',x,i),x));

 return rows;
}
