function installmentLastPaymentDate(p,c){
 if(p.completedConfirmed&&p.completedAt)return p.completedAt;
 const ref=installmentReferenceMonth(p);
 if(!ref)return '—';
 const parts=String(ref).slice(0,7).split('-').map(Number);
 if(parts.length<2||!parts[0]||!parts[1])return '—';
 const total=Math.max(1,Number(p.months||0));
 const paid=Math.max(0,Number(c?.paid||0));
 const targetIndex=Math.max(0,total-1);
 const d=new Date(parts[0],parts[1]-1+targetIndex,1);
 return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
}
function renderInstallments(){
 ensureRequiredInstallmentSeeds();
 const filter=$('installmentBankFilter');
 if(filter){
  const selected=filter.value;
  const banks=[...new Set(installments.map(p=>account(p.cardId)?.bank).filter(Boolean))].sort();
  filter.innerHTML='<option value="">All Banks</option>'+banks.map(b=>`<option value="${b}">${b}</option>`).join('');
  if(banks.includes(selected))filter.value=selected;
 }
 const bank=$('installmentBankFilter')?.value||'';
 const plans=installments.filter(p=>{if(!bank)return true;const a=account(p.cardId);return a&&a.bank===bank});
 const active=plans.filter(p=>planCalc(p).status==='Active');
 const review=plans.filter(p=>planCalc(p).status==='Review');
 const completed=plans.filter(p=>planCalc(p).status==='Completed');
 const activeForCalc=[...active,...review];
 const remaining=activeForCalc.reduce((sum,p)=>sum+planCalc(p).remaining,0);
 const monthly=activeForCalc.reduce((sum,p)=>sum+planCalc(p).monthly,0);

 $('installKpis').innerHTML=[
  kpiHTML('Active Plans',String(active.length),'Normal active plans'),
  kpiHTML('Legacy Completion Review',String(review.length),'Older manually tracked plans','amber'),
  kpiHTML('Remaining Amount',money(remaining),'Active + review plans','amber'),
  kpiHTML('Monthly Commitment',money(monthly),'Future installments only','red')
 ].join('');

 $('installBody').innerHTML=active.map(p=>{
  const c=planCalc(p),a=account(p.cardId);
  return `<tr><td><b>${a?.bank||''} •${a?.ending||''}</b></td><td>${p.description}<div class="meta">${p.source||'Manual'}${p.linkedTransactionId?' • linked purchase':''}</div></td><td>${p.category}<div class="meta">${p.subcategory}</div></td><td>${money(p.fullAmount)}</td><td>${p.months} months</td><td>${money(c.monthly)}</td><td>${c.paid} of ${p.months}</td><td>${c.remainingCount}</td><td class="amber"><b>${money(c.remaining)}</b></td><td>${installmentLastPaymentDate(p,c)}</td><td><span class="badge active">Active</span></td><td><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn small" data-plan="${p.id}">Edit</button><button class="btn small primary" data-early-settle="${p.id}">Complete Early</button><button type="button" class="btn small danger" data-delete-plan="${p.id}">Delete</button></div></td></tr>`;
 }).join('')||'<tr><td colspan="12">No active installment plans for this bank.</td></tr>';

 $('installReviewBody').innerHTML=review.map(p=>{
  const c=planCalc(p),a=account(p.cardId);
  return `<tr><td><b>${a?.bank||''} •${a?.ending||''}</b></td><td>${p.description}<div class="meta">${p.source||'Manual'}</div></td><td><b>${money(Number(p.fullAmount||0))}</b></td><td>${money(c.schedule[Math.max(0,p.months-1)]||c.monthly||0)}</td><td class="amber"><b>${money(c.remaining)}</b><div class="meta">Held in calculation until you confirm</div></td><td>${p.months} months • scheduled ${c.scheduledPaid} of ${p.months}</td><td><span class="badge amber">Review Completion</span><div class="meta">Calendar says this should be completed. Waiting for your confirmation.</div></td><td><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn primary small" data-confirm-completed="${p.id}">Confirm Completed</button><button class="btn small" data-keep-active="${p.id}">Keep Active</button><button class="btn small" data-plan="${p.id}">Edit</button></div></td></tr>`;
 }).join('')||'<tr><td colspan="8">No installment plans waiting for completion review.</td></tr>';

 $('completedInstallBody').innerHTML=completed.map(p=>{
  const a=account(p.cardId),c=planCalc(p),autoBilled=c.completionReason==='fully-billed'&&!p.completedConfirmed;
  return `<tr><td><b>${a?.bank||''} •${a?.ending||''}</b></td><td>${p.description}<div class="meta">${p.source||'Manual'}</div></td><td>${p.category}<div class="meta">${p.subcategory}</div></td><td>${money(p.fullAmount)}</td><td>${p.months} months</td><td>${installmentLastPaymentDate(p,c)}</td><td>${p.completedAt||(autoBilled?'Statement released':'Confirmed')}</td><td><span class="badge completed">Completed</span>${autoBilled?'<div class="meta">Fully billed; statement payment is tracked separately.</div>':''}</td><td><button class="btn small danger" type="button" data-delete-completed-plan="${p.id}">Delete</button></td></tr>`;
 }).join('')||'<tr><td colspan="9">No completed installment plans yet.</td></tr>';

 document.querySelectorAll('[data-plan]').forEach(b=>b.addEventListener('click',()=>editPlan(b.dataset.plan)));
 document.querySelectorAll('[data-delete-plan]').forEach(b=>b.addEventListener('click',()=>deleteInstallmentPlan(b.dataset.deletePlan)));
 document.querySelectorAll('[data-early-settle]').forEach(b=>b.addEventListener('click',()=>completeInstallmentEarly(b.dataset.earlySettle)));
 document.querySelectorAll('[data-confirm-completed]').forEach(b=>b.addEventListener('click',()=>confirmInstallmentCompleted(b.dataset.confirmCompleted)));
 document.querySelectorAll('[data-keep-active]').forEach(b=>b.addEventListener('click',()=>keepInstallmentActive(b.dataset.keepActive)));
 document.querySelectorAll('[data-delete-completed-plan]').forEach(b=>b.onclick=()=>deleteCompletedInstallmentRecord(b.dataset.deleteCompletedPlan));
 if(typeof initializeSortableTables==='function')initializeSortableTables($('installments'));
 // V263: rendering the Installments page must not synchronously rebuild hidden
 // Accounts + legacy Dashboard pages. Those pages render fresh when navigated to.
}

function renderCategories(){
 const names=Object.keys(categories);if(!categories[selectedCategory])selectedCategory=names[0]||'';
 const subCount=names.reduce((sum,name)=>sum+(categories[name]||[]).length,0);
 const ruleCount=Object.keys(merchantRules||{}).length;
 if($('categoryCountMetric'))$('categoryCountMetric').textContent=names.length;
 if($('subcategoryCountMetric'))$('subcategoryCountMetric').textContent=subCount;
 if($('merchantRuleCountMetric'))$('merchantRuleCountMetric').textContent=ruleCount;
 $('categoryList').innerHTML=names.map(c=>`<div class="catEditRow"><button class="${c===selectedCategory?'selected':''}" data-cat="${c}" style="flex:1;text-align:left">${c}<span style="float:right;color:#98a2b3">${(categories[c]||[]).length}</span></button><div class="catEditActions"><button class="catEditBtn" data-edit-cat="${c}">Edit</button><button type="button" class="catEditBtn danger" data-del-cat="${c}">Delete</button></div></div>`).join('');
 document.querySelectorAll('[data-cat]').forEach(b=>b.addEventListener('click',()=>{selectedCategory=b.dataset.cat;renderCategories()}));
 document.querySelectorAll('[data-edit-cat]').forEach(b=>b.addEventListener('click',()=>openSimple('edit-category',b.dataset.editCat)));
 document.querySelectorAll('[data-del-cat]').forEach(b=>b.addEventListener('click',()=>deleteCategoryName(b.dataset.delCat)));
 $('selectedCatTitle').textContent=selectedCategory||'Subcategories';
 $('subcategoryList').innerHTML=(categories[selectedCategory]||[]).map(x=>`<div class="subItem catEditRow"><span>${x}</span><div class="catEditActions"><button class="catEditBtn" data-edit-sub="${x}">Edit</button><button type="button" class="catEditBtn danger" data-del-sub="${x}">Delete</button></div></div>`).join('');
 document.querySelectorAll('[data-edit-sub]').forEach(b=>b.addEventListener('click',()=>openSimple('edit-subcategory',b.dataset.editSub)));
 document.querySelectorAll('[data-del-sub]').forEach(b=>b.addEventListener('click',()=>deleteSubcategoryName(selectedCategory,b.dataset.delSub)));
 const rules=Object.entries(merchantRules);
 $('merchantRulesBody').innerHTML=rules.map(([k,v])=>`<tr><td>${k}</td><td>${v.category}</td><td>${v.subcategory||'—'}</td><td><button type="button" class="btn small danger" data-rule="${encodeURIComponent(k)}">Delete</button></td></tr>`).join('')||'<tr><td colspan="4">No remembered merchant rules yet.</td></tr>';
 document.querySelectorAll('[data-rule]').forEach(b=>b.addEventListener('click',()=>{delete merchantRules[decodeURIComponent(b.dataset.rule)];saveLocal();renderCategories();renderTransactions();renderReports()}));
 refreshCategoryDropdowns();
}
function refreshCategoryDropdowns(){
 fillCategorySelect($('txCategory'),true);fillCategorySelect($('reportCategory'),true);fillCategorySelect($('instCategory'),false);fillCategorySelect($('editCategory'),false);
 if(!$('instCategory').value)$('instCategory').value=Object.keys(categories)[0]||'';fillSubcategorySelect($('instSubcategory'),$('instCategory').value);fillReportSubcategories();
}
$('addCategory').addEventListener('click',()=>openSimple('category'));
$('addSubcategory').addEventListener('click',()=>openSimple('subcategory'));

let simpleOriginal='';
let simpleOriginalParent='';
function normalizeName(v){return String(v||'').trim().replace(/\s+/g,' ').toLowerCase()}
function categoryExists(name,exclude=''){
 const n=normalizeName(name),ex=normalizeName(exclude);
 return Object.keys(categories).some(c=>normalizeName(c)===n&&normalizeName(c)!==ex);
}
function subcategoryExistsAnywhere(name,excludeName='',excludeParent=''){
 const n=normalizeName(name),ex=normalizeName(excludeName),ep=normalizeName(excludeParent);
 for(const [cat,subs] of Object.entries(categories)){
  for(const sub of (subs||[])){
   if(normalizeName(sub)===n && !(normalizeName(sub)===ex && normalizeName(cat)===ep)){
    return {category:cat,subcategory:sub};
   }
  }
 }
 return null;
}
function fillSimpleParentCategories(selected=''){
 const sel=$('simpleParentCategory');
 sel.innerHTML=Object.keys(categories).map(c=>`<option value="${c}">${c}</option>`).join('');
 sel.value=(selected&&categories[selected])?selected:(selectedCategory||Object.keys(categories)[0]||'');
}
function openSimple(mode,original=''){
 simpleMode=mode;simpleOriginal=original||'';
 const isCat=mode==='category'||mode==='edit-category';
 const isEdit=mode.startsWith('edit-');
 simpleOriginalParent=isCat?'':selectedCategory;
 $('simpleTitle').textContent=(isEdit?'Edit ':'Add New ')+(isCat?'Category':'Subcategory');
 $('simpleLabel').textContent=isCat?'Category name':'Subcategory name';
 $('simpleInput').value=isEdit?original:'';
 $('simpleParentField').style.display=isCat?'none':'block';
 if(!isCat)fillSimpleParentCategories(selectedCategory);
 $('simpleForm').querySelector('button[type="submit"]').textContent=isEdit?'Save':'Add';
 openModal('simpleModal')
}
function renameCategoryRefs(oldName,newName){
 transactions.forEach(t=>{if(t.category===oldName)t.category=newName});
 Object.values(txOverrides).forEach(v=>{if(v.category===oldName)v.category=newName});
 Object.values(merchantRules).forEach(v=>{if(v.category===oldName)v.category=newName});
 installments.forEach(p=>{if(p.category===oldName)p.category=newName});
}
function renameSubcategoryRefs(cat,oldName,newName){
 transactions.forEach(t=>{if(t.category===cat&&t.subcategory===oldName)t.subcategory=newName});
 Object.values(txOverrides).forEach(v=>{if(v.category===cat&&v.subcategory===oldName)v.subcategory=newName});
 Object.values(merchantRules).forEach(v=>{if(v.category===cat&&v.subcategory===oldName)v.subcategory=newName});
 installments.forEach(p=>{if(p.category===cat&&p.subcategory===oldName)p.subcategory=newName});
}
function deleteCategoryName(name){
 if(name==='Miscellaneous'){alert('Miscellaneous is used as the fallback category and cannot be deleted.');return}
 if(!confirm(`Delete category "${name}"? Existing matching records will move to Miscellaneous / Unexpected Expenses.`))return;
 transactions.forEach(t=>{if(t.category===name){t.category='Miscellaneous';t.subcategory='Unexpected Expenses'}});
 Object.values(txOverrides).forEach(v=>{if(v.category===name){v.category='Miscellaneous';v.subcategory='Unexpected Expenses'}});
 Object.values(merchantRules).forEach(v=>{if(v.category===name){v.category='Miscellaneous';v.subcategory='Unexpected Expenses'}});
 installments.forEach(p=>{if(p.category===name){p.category='Miscellaneous';p.subcategory='Unexpected Expenses'}});
 delete categories[name];selectedCategory=Object.keys(categories)[0]||'';
 saveLocal();renderCategories();renderTransactions();renderReports();renderInstallments();
}
function deleteSubcategoryName(cat,name){
 if(!confirm(`Delete subcategory "${name}" from "${cat}"? Existing matching records will become Uncategorized.`))return;
 transactions.forEach(t=>{if(t.category===cat&&t.subcategory===name)t.subcategory='Uncategorized'});
 Object.values(txOverrides).forEach(v=>{if(v.category===cat&&v.subcategory===name)v.subcategory='Uncategorized'});
 Object.values(merchantRules).forEach(v=>{if(v.category===cat&&v.subcategory===name)v.subcategory='Uncategorized'});
 installments.forEach(p=>{if(p.category===cat&&p.subcategory===name)p.subcategory='Uncategorized'});
 categories[cat]=(categories[cat]||[]).filter(x=>x!==name);
 saveLocal();renderCategories();renderTransactions();renderReports();renderInstallments();
}
$('simpleForm').addEventListener('submit',e=>{
 e.preventDefault();
 const name=$('simpleInput').value.trim();
 if(!name)return;

 if(simpleMode==='category'){
   if(categoryExists(name)){
     alert(`Duplicate category: "${name}" already exists. Please use a different name.`);
     return;
   }
   categories[name]=[];
   selectedCategory=name;

 }else if(simpleMode==='subcategory'){
   const parent=$('simpleParentCategory').value;
   const dup=subcategoryExistsAnywhere(name);
   if(dup){
     alert(`Duplicate subcategory: "${name}" already exists under "${dup.category}". Subcategory names must be unique across all categories.`);
     return;
   }
   if(!categories[parent])categories[parent]=[];
   categories[parent].push(name);
   selectedCategory=parent;

 }else if(simpleMode==='edit-category'){
   if(categoryExists(name,simpleOriginal)){
     alert(`Duplicate category: "${name}" already exists. Please use a different name.`);
     return;
   }
   if(normalizeName(name)!==normalizeName(simpleOriginal)){
     categories[name]=categories[simpleOriginal]||[];
     delete categories[simpleOriginal];
     renameCategoryRefs(simpleOriginal,name);
     selectedCategory=name;
   }

 }else if(simpleMode==='edit-subcategory'){
   const oldParent=simpleOriginalParent;
   const newParent=$('simpleParentCategory').value;
   const dup=subcategoryExistsAnywhere(name,simpleOriginal,oldParent);
   if(dup){
     alert(`Duplicate subcategory: "${name}" already exists under "${dup.category}". Subcategory names must be unique across all categories.`);
     return;
   }

   if(oldParent===newParent){
     categories[oldParent]=categories[oldParent].map(x=>x===simpleOriginal?name:x);
     renameSubcategoryRefs(oldParent,simpleOriginal,name);
   }else{
     categories[oldParent]=(categories[oldParent]||[]).filter(x=>x!==simpleOriginal);
     if(!categories[newParent])categories[newParent]=[];
     categories[newParent].push(name);

     transactions.forEach(t=>{if(t.category===oldParent&&t.subcategory===simpleOriginal){t.category=newParent;t.subcategory=name}});
     Object.values(txOverrides).forEach(v=>{if(v.category===oldParent&&v.subcategory===simpleOriginal){v.category=newParent;v.subcategory=name}});
     Object.values(merchantRules).forEach(v=>{if(v.category===oldParent&&v.subcategory===simpleOriginal){v.category=newParent;v.subcategory=name}});
     installments.forEach(p=>{if(p.category===oldParent&&p.subcategory===simpleOriginal){p.category=newParent;p.subcategory=name}});
   }
   selectedCategory=newParent;
 }

 saveLocal();
 closeModal('simpleModal');
 renderCategories();
 renderTransactions();
 renderReports();
 renderInstallments();
});


function openInstallment(plan=null){
 $('installForm').dataset.editId=plan?.id||'';
 fillAccountSelect($('instCard'),false);$('instCard').innerHTML=accounts.filter(a=>a.type==='card').map(a=>`<option value="${a.id}">${accountName(a.id)}</option>`).join('');
 fillCategorySelect($('instCategory'),false);
 const p=plan||{cardId:'ar-0955',description:'',category:'Housing & Utilities',subcategory:'Furniture',fullAmount:'',months:3,startMonth:'2026-08',paidInstallments:0,linkedTransactionId:''};
 $('installForm').dataset.linkedTransactionId=p.linkedTransactionId||'';
 $('instCard').value=p.cardId;$('instDesc').value=p.description;$('instCategory').value=p.category;if(!$('instCategory').value)$('instCategory').selectedIndex=0;fillSubcategorySelect($('instSubcategory'),$('instCategory').value,p.subcategory);
 const existingCalc=plan?planCalc(p):null;
 $('instAmount').value=p.fullAmount;
 $('instRemainingAmount').value=plan?Number(p.manualRemaining!=null?p.manualRemaining:(existingCalc?.remaining??p.fullAmount)).toFixed(2):Number(p.fullAmount||0).toFixed(2);
 $('instMonths').value=plan?Number(p.remainingMonthsOverride!=null?p.remainingMonthsOverride:(existingCalc?.remainingCount??p.months)):p.months;
 $('instStart').value=p.referenceMonth||p.startMonth||currentMonthInput();
 $('instPaid').value=p.paidInstallments||0;
 updateInstallPreview();openModal('installModal')
}

$('addTransaction').addEventListener('click',()=>{setTimeout(()=>{
 if($('bankSmsPaste'))$('bankSmsPaste').value='';
 if($('bankSmsStatus'))$('bankSmsStatus').textContent='Detect bank/card, transaction amount, remaining balance, date and merchant; review before saving.';
 const f=$('manualTxForm');if(f){delete f.dataset.smsRaw;delete f.dataset.smsRemaining;delete f.dataset.smsTime;delete f.dataset.smsAccountId;}
},0)});
$('addTransaction').addEventListener('click',()=>openManualTransaction());
if($('moreAddTransaction'))$('moreAddTransaction').addEventListener('click',()=>openManualTransaction());
$('quickAddTransaction')?.addEventListener('click',()=>openManualTransaction());
$('manualTxCategory').addEventListener('change',()=>fillSubcategorySelect($('manualTxSubcategory'),$('manualTxCategory').value));
$('manualTxAccount').addEventListener('change',()=>{fillPhysicalCardSelect($('manualTxPhysicalCard'),$('manualTxAccount').value,false,'');updateManualInstallmentEligibility();});
['manualTxType','manualTxAmount'].forEach(id=>$(id).addEventListener('input',updateManualInstallmentEligibility));

function smsNormalizeDigits(v){
 return String(v||'')
  .replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d))
  .replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
}
function detectSmsAccount(text){
 const t=smsNormalizeDigits(text).toLowerCase();
 for(const [ending,id] of [
  ['440880','sab-440880'],['0955','ar-0955'],['5867','ar-5867'],
  ['4411','nbd-infinite-4411'],['8652','nbd-mazeed-8652'],
  ['7102','meem-7102'],['2989','ar-current']
 ])if(t.includes(ending))return id;
 if(/\bsab\b|sabb|saudi awal|البنك السعودي الأول|السعودي الأول/.test(t))return 'sab-440880';
 if(/meem|gib|ميم/.test(t))return 'meem-7102';
 return '';
}
function smsLabeledNumber(text,labels){
 const t=smsNormalizeDigits(text).replace(/,/g,'');
 for(const label of labels){
  const re=new RegExp(`(?:${label})\\s*[:：]?\\s*(?:(?:SAR|SR)\\s*)?(-?\\d+(?:\\.\\d{1,2})?)\\s*(?:SAR|SR|ر\\.?س\\.?|ريال)?`,'i');
  const m=t.match(re);
  if(m)return Math.abs(Number(m[1]));
 }
 return null;
}
function parseSmsAmount(text){
 // Arabic/English transaction labels always win over generic currency matching.
 const labeled=smsLabeledNumber(text,['مبلغ','المبلغ','amount','purchase amount','transaction amount','بقيمة','قيمة العملية']);
 if(labeled!=null)return labeled;
 const t=smsNormalizeDigits(text).replace(/,/g,'');
 // Fallback only when no explicit transaction-amount label exists.
 for(const p of [
  // Check currency-before-amount first. In Saudi SMS messages the later
  // remaining balance is commonly written as number-before-currency.
  /(?:SAR|SR|ر\.?س\.?|ريال)\s*(-?\d+(?:\.\d{1,2})?)/i,
  /(-?\d+(?:\.\d{1,2})?)\s*(?:SAR|SR|ر\.?س\.?|ريال)/i
 ]){
  const m=t.match(p);if(m)return Math.abs(Number(m[1]));
 }
 return null;
}
function parseSmsRemainingBalance(text){
 // User rule: "رصيد" / "available balance" is the REMAINING AVAILABLE amount after the transaction.
 return smsLabeledNumber(text,['رصيد','الرصيد','الرصيد المتاح','available balance','available','remaining balance','remaining']);
}
function parseSmsDateTime(text){
 const t=smsNormalizeDigits(text);
 let date='',time='';
 let m=t.match(/\b(20\d{2})[-\/](\d{1,2})[-\/](\d{1,2})\b/);
 if(m)date=`${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
 if(!date){
  m=t.match(/\b(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})\b/);
  if(m){
   let y=Number(m[3]); if(y<100)y+=2000;
   // Saudi bank SMS format: day/month/year.
   date=`${y}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
  }
 }
 const tm=t.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
 if(tm)time=`${String(tm[1]).padStart(2,'0')}:${tm[2]}`;
 return {date:date||new Date().toISOString().slice(0,10),time};
}
function parseSmsDate(text){return parseSmsDateTime(text).date}
function parseSmsMerchant(text){
 const t=String(text||'').replace(/\u061C/g,'').replace(/\s+/g,' ').trim();
 for(const p of [
  /(?:لـ|ل)\s*([A-Za-z0-9&._' -]+?)(?=\s+(?:رصيد|الرصيد|مبلغ|المبلغ|في|بتاريخ)|$)/i,
  /(?:لدى|عند)\s*[:：]?\s*([A-Za-z0-9&._' -]+?)(?=\s+(?:مبلغ|المبلغ|رصيد|الرصيد|في|بتاريخ)\s*[:：]?|$)/i,
  /(?:at|merchant)\s*[:\-]?\s*([^،,.;]+?)(?=\s+(?:amount|balance|on|date)\b|$)/i
 ]){
  const m=t.match(p);if(m?.[1])return m[1].trim().slice(0,90);
 }
 if(/سداد\s+فاتورة/i.test(t))return 'Bill Payment';
 return 'Bank SMS Transaction';
}
function smsLooksLikeCredit(text){
 return /refund|reversal|credit|credited|deposit|received|استرداد|إيداع|ايداع|حوالة واردة|تم ايداع|تم إضافة|تم اضافة/i.test(String(text||''));
}
function parseSmsPaymentChannel(text){
 const t=String(text||'');
 if(/apple\s*pay|[اأإآ]بل\s*باي/i.test(t))return 'Apple Pay';
 if(/mada\s*pay|مدى\s*باي/i.test(t))return 'Mada Pay';
 if(/فيزا|visa/i.test(t))return 'Visa';
 if(/mastercard|ماستر\s*كارد/i.test(t))return 'Mastercard';
 return '';
}
function classifyBankSms(text,merchant){
 const t=String(text||'');
 if(/شراء\s*(?:إنترنت|انترنت)|mobily|موبايلي|stc|زين|internet/i.test(t))return {
  category:'Housing & Utilities',subcategory:'Internet & Phone',
  description:(merchant&&merchant!=='Bank SMS Transaction'?merchant:'Mobile')+' Internet Purchase',needsReview:false
 };
 if(/سداد\s+فاتورة|bill\s*payment/i.test(t))return {
  category:'Miscellaneous',subcategory:'Unexpected Expenses',description:'Bill Payment',needsReview:true
 };
 return {category:'Miscellaneous',subcategory:'Unexpected Expenses',description:merchant||'Bank SMS Transaction',needsReview:true};
}
function applyBankSms(){
 const raw=$('bankSmsPaste')?.value.trim();if(!raw)return;
 const accountId=detectSmsAccount(raw);
 const amount=parseSmsAmount(raw);
 const remaining=parseSmsRemainingBalance(raw);
 const dt=parseSmsDateTime(raw);
 const merchant=parseSmsMerchant(raw);
 const credit=smsLooksLikeCredit(raw);
 const channel=parseSmsPaymentChannel(raw);
 const classification=classifyBankSms(raw,merchant);

 if(accountId){$('manualTxAccount').value=accountId;const detectedEnding=accountPhysicalCards(accountId).find(e=>smsNormalizeDigits(raw).includes(e))||'';fillPhysicalCardSelect($('manualTxPhysicalCard'),accountId,false,detectedEnding);}
 $('manualTxDate').value=dt.date;
 if(amount!=null)$('manualTxAmount').value=amount;
 $('manualTxDesc').value=classification.description;
 $('manualTxType').value=credit?'income':'expense';
 fillCategorySelect($('manualTxCategory'),false);
 $('manualTxCategory').value=classification.category;
 fillSubcategorySelect($('manualTxSubcategory'),classification.category,classification.subcategory);
 $('manualTxSubcategory').value=classification.subcategory;

 // Keep parsed SMS metadata on the form. It is applied only after Save Transaction.
 const f=$('manualTxForm');
 f.dataset.smsRaw=raw;
 f.dataset.smsRemaining=remaining!=null?String(remaining):'';
 f.dataset.smsTime=dt.time||'';
 f.dataset.smsAccountId=accountId||'';
 f.dataset.smsPaymentChannel=channel;
 f.dataset.smsNeedsReview=classification.needsReview?'1':'';

 const parts=[
  accountId?`<b>${accountName(accountId)}</b>`:'<b>Select the correct account/card</b>',
  amount!=null?`Purchase/transaction: <b>${money(amount)}</b>`:'',
  `Date: <b>${dt.date}${dt.time?' '+dt.time:''}</b>`,
  classification.description?`Description: <b>${classification.description}</b>`:'',
  channel?`Channel: <b>${channel}</b>`:'',
  `Category: <b>${classification.category} → ${classification.subcategory}</b>`,
  remaining!=null?`Remaining available balance: <b>${money(remaining)}</b>`:''
 ].filter(Boolean);
 $('bankSmsStatus').innerHTML=parts.join(' • ')+'<br><span class="meta">'+(classification.needsReview?'Category review required before saving. ':'')+'The remaining balance will update the card only when you save the transaction.</span>';
}
if($('parseBankSms'))$('parseBankSms').addEventListener('click',applyBankSms);
if($('clearBankSms'))$('clearBankSms').addEventListener('click',()=>{
 const f=$('manualTxForm');
 $('bankSmsPaste').value='';
 $('bankSmsStatus').textContent='Detect bank/card, transaction amount, remaining balance, date and merchant; review before saving.';
 if(f){delete f.dataset.smsRaw;delete f.dataset.smsRemaining;delete f.dataset.smsTime;delete f.dataset.smsAccountId;delete f.dataset.smsPaymentChannel;delete f.dataset.smsNeedsReview;}
 $('bankSmsPaste').focus();
});

$('manualTxForm').addEventListener('submit',e=>{
 e.preventDefault();
 const type=$('manualTxType').value,raw=Number($('manualTxAmount').value||0);
 const sign=(type==='income'||type==='transfer'&&$('manualTxDesc').value.toLowerCase().includes('received'))?1:-1;
 const form=$('manualTxForm');
 const selectedManualAccount=account($('manualTxAccount').value);
 const bankBalanceBeforeManual=selectedManualAccount?.type==='bank'?adjustedBankBalance(selectedManualAccount):null;
 const smsRemaining=form.dataset.smsRemaining!==''?Number(form.dataset.smsRemaining):null;
 const tx={
  _id:'manual-'+Date.now(),account:$('manualTxAccount').value,physicalCardEnding:$('manualTxPhysicalCard').value||String(account($('manualTxAccount').value)?.ending||''),date:$('manualTxDate').value,posting:$('manualTxDate').value,
  description:$('manualTxDesc').value.trim(),amount:sign*raw,category:$('manualTxCategory').value,
  subcategory:$('manualTxSubcategory').value,kind:type,currency:'SAR',original:null,manual:true,
  smsImported:!!form.dataset.smsRaw,smsTime:form.dataset.smsTime||'',smsRemainingBalance:Number.isFinite(smsRemaining)?smsRemaining:null,
  smsRaw:form.dataset.smsRaw||'',smsPaymentChannel:form.dataset.smsPaymentChannel||'',needsCategoryReview:form.dataset.smsNeedsReview==='1',trackedBankApplied:selectedManualAccount?.type==='bank'
 };
 manualTransactions.push(tx);transactions.push({...tx});

 // Bank SMS "رصيد" is the available/remaining balance AFTER this transaction.
 // Make it authoritative for the selected card and reconcile utilized = limit - available.
 if(Number.isFinite(smsRemaining)){
  const a=account(tx.account);
  if(a?.type==='card'){
   const limit=Number(a.extra?.['Credit Limit']||0);
   a.extra=a.extra||{};
   a.extra['Bank Available']=smsRemaining;
   if(limit>0)a.extra['Current Outstanding']=Math.max(0,Math.min(limit,limit-smsRemaining));
   a.balance=limit>0?Math.max(0,limit-smsRemaining):a.balance;
   a.balanceAsOf=tx.date+(tx.smsTime?' '+tx.smsTime:'');
   a.extra['SMS Balance As Of']=a.balanceAsOf;
   a.extra['SMS Remaining Balance']=smsRemaining;
  }else if(a?.type==='bank'){
   a.balance=smsRemaining;
   a.balanceAsOf=tx.date+(tx.smsTime?' '+tx.smsTime:'');
   setTrackedBankBalance(a.id,smsRemaining);
  }
 }else if(selectedManualAccount?.type==='bank' && Number.isFinite(bankBalanceBeforeManual)){
  setTrackedBankBalance(selectedManualAccount.id,bankBalanceBeforeManual+Number(tx.amount||0));
 }
 // Clear the SMS form metadata after committing.
 delete form.dataset.smsRaw;delete form.dataset.smsRemaining;delete form.dataset.smsTime;delete form.dataset.smsAccountId;delete form.dataset.smsPaymentChannel;delete form.dataset.smsNeedsReview;
 saveLocal();
 syncManualTransactionImmediate(tx);
 closeModal('manualTxModal');
 const makePlan=$('manualTxInstallment').checked&&isEligibleInstallmentTx(tx);
 ensureMonthlyPlannerRows(paymentMonthForTransaction(tx.account,tx.date));
 refreshAfterTransactionChange(tx.account);
 if(makePlan)openInstallment({cardId:tx.account,description:tx.description,category:tx.category,subcategory:tx.subcategory,fullAmount:Math.abs(tx.amount),months:3,startMonth:tx.date.slice(0,7),paidInstallments:0,linkedTransactionId:tx._id,source:'Converted from manual transaction'});
});


$('addOutgoing').addEventListener('click',()=>openOutgoing());
$('outgoingCategory').addEventListener('change',()=>fillSubcategorySelect($('outgoingSubcategory'),$('outgoingCategory').value));
$('outgoingForever').addEventListener('change',()=>{$('outgoingMonths').disabled=$('outgoingForever').checked;});
$('outgoingForm').addEventListener('submit',e=>{
 e.preventDefault();
 const id=$('outgoingEditId').value||`out-${Date.now()}`;
 const existingOutgoing=outgoings.find(x=>x.id===id);
 const o={id,description:$('outgoingDesc').value.trim(),amount:Number($('outgoingAmount').value||0),method:$('outgoingMethod').value,category:$('outgoingCategory').value,subcategory:$('outgoingSubcategory').value,startMonth:$('outgoingStart').value,months:Math.max(1,Math.min(60,Number($('outgoingMonths').value||1))),forever:$('outgoingForever').checked,notes:$('outgoingNotes').value.trim(),payments:{...(existingOutgoing?.payments||{})}};
 if(!o.description||o.amount<=0||!o.startMonth)return;
 const i=outgoings.findIndex(x=>x.id===id);if(i>=0)outgoings[i]=o;else outgoings.push(o);
 saveLocal();closeModal('outgoingModal');renderOutgoings();renderDashboard();renderIncomePlan();renderReports();
});

$('outgoingPaymentSource').addEventListener('change',updateOutgoingPaymentPreview);
$('outgoingPaymentAmount').addEventListener('input',updateOutgoingPaymentPreview);
$('outgoingPaymentForm').addEventListener('submit',e=>{
 e.preventDefault();
 const outgoingId=$('outgoingPaymentOutgoingId').value;
 const month=$('outgoingPaymentMonth').value;
 const amount=Math.max(0,Number($('outgoingPaymentAmount').value||0));
 const sourceId=$('outgoingPaymentSource').value;
 const date=$('outgoingPaymentDate').value;
 const editId=$('outgoingPaymentEditId').value;
 if(!outgoingId||!month||amount<=0||!sourceId||!date)return;
 if(recordOutgoingPayment(outgoingId,month,amount,sourceId,date,editId)){
  closeModal('outgoingPaymentModal');
 }
});


$('installmentBankFilter').addEventListener('change',renderInstallments);
$('addInstallment').addEventListener('click',()=>openInstallment());$('quickInstallment')?.addEventListener('click',()=>openInstallment());
$('instCategory').addEventListener('change',()=>fillSubcategorySelect($('instSubcategory'),$('instCategory').value));
['instAmount','instRemainingAmount','instMonths','instPaid','instStart'].forEach(id=>$(id).addEventListener('input',updateInstallPreview));
function updateInstallPreview(){
 const full=Number($('instAmount').value||0),remaining=Math.max(0,Number($('instRemainingAmount').value||0)),remainingMonths=Math.max(1,Number($('instMonths').value||1));
 if(!full){$('instPreview').textContent='Enter the original amount, remaining amount, and remaining months.';return}
 const monthly=Math.round((remaining/remainingMonths)*100)/100;
 $('instPreview').innerHTML=`Remaining principal: <b>${money(remaining)}</b> • Remaining months: <b>${remainingMonths}</b> • Recalculated monthly installment: <b>${money(monthly)}</b>. Changing the months changes the monthly payment, not the remaining principal.`;
}
$('installForm').addEventListener('submit',e=>{
 e.preventDefault();
 const id=e.currentTarget.dataset.editId||'plan-'+Date.now(),linkedTransactionId=e.currentTarget.dataset.linkedTransactionId||'';
 const oldPlan=installments.find(x=>x.id===id);
 const remainingAmount=Math.max(0,Number($('instRemainingAmount').value||0));
 const remainingMonths=Math.max(1,Number($('instMonths').value||1));
 const paid=Math.max(0,Number($('instPaid').value||0));
 const p={...(oldPlan||{}),id,cardId:$('instCard').value,description:$('instDesc').value.trim(),category:$('instCategory').value,subcategory:$('instSubcategory').value,fullAmount:Number($('instAmount').value),months:paid+remainingMonths,remainingMonthsOverride:remainingMonths,manualRemaining:remainingAmount,startMonth:oldPlan?.startMonth||$('instStart').value,referenceMonth:$('instStart').value,paidInstallments:paid,linkedTransactionId,source:e.currentTarget.dataset.editId?(oldPlan?.source||'Manual'):(linkedTransactionId?'Converted from transaction':'Manual'),scheduleMode:'remaining-principal'};
 const ix=installments.findIndex(x=>x.id===id);if(ix>=0)installments[ix]=p;else installments.push(p);
 normalizeSabInstallmentPlan();
 cleanupSabLegacyBalanceState();
 const linkedTx=linkedTransactionId?normalizedTx(true).find(t=>t._id===linkedTransactionId):null;
 if(linkedTx){adjustCurrentStatementForInstallment(linkedTx,p);ensureMonthlyPlannerRows(p.startMonth);}
 saveLocal();closeModal('installModal');
 // V91: one installment edit recalculates every dependent card balance and monthly plan immediately.
 renderInstallments();renderTransactions();renderReports();renderAccounts();renderDashboard();renderPaymentPlanner();renderIncomePlan();renderImportPage();
 ensureMonthlyPlannerRows(currentYearMonth());
 ensureMonthlyPlannerRows(addMonthsToYM(currentYearMonth(),1));
 if(document.getElementById('accountDetail')?.classList.contains('active') && currentAccountDetailId){
  openAccount(currentAccountDetailId,accountDetailReturnPage);
 }
 if(linkedTx){
  const c=planCalc(p);
  setTimeout(()=>alert(`Installment plan activated.

Purchase removed from current statement: ${money(Math.abs(Number(linkedTx.amount||0)))}
Current statement/payment amount reduced immediately.
First installment month: ${extraIncomeMonthTitle(p.startMonth)}
Monthly installment: ${money(c.monthly)}
Remaining installment principal: ${money(c.remaining)}

The original purchase and installment are not double-counted.`),50);
 }
});
function editPlan(id){openInstallment(installments.find(p=>p.id===id))}

function openTxEdit(id){
 editingTxId=id;const t=normalizedTx().find(x=>x._id===id);if(!t)return;
 const eligible=isEligibleInstallmentTx(t),linked=isTxLinkedToInstallment(t);
 $('txEditInfo').innerHTML=`<b>${t.description}</b>${eligible?'<span class="eligibleTag">> SAR 1,000</span>':''}<div class="meta">${t.date} • ${accountName(t.account)} • ${signed(t.amount)}${linked?' • Installment plan linked':''}</div>`;
 fillCategorySelect($('editCategory'),false);$('editCategory').value=t.category;if(!$('editCategory').value)$('editCategory').selectedIndex=0;fillSubcategorySelect($('editSubcategory'),$('editCategory').value,t.subcategory);$('rememberMerchant').checked=false;
 $('editDescription').value=t.description||''; $('editDate').value=t.date||''; $('editAmount').value=Number(t.amount||0);
 $('editStatementMonth').value=t.statementMonth||statementMonthByRule(t.date,statementRule.cutoffDay);$('editStatementManual').checked=txOverrides[id]?.statementMonthManual===true;fillPhysicalCardSelect($('editPhysicalCard'),t.account,false,transactionPhysicalCardEnding(t));
 $('installmentEligibilityBox').style.display=eligible&&!linked?'block':'none';
 $('convertToInstallment').disabled=!eligible||linked;
 openModal('txEditModal');
}
$('editCategory').addEventListener('change',()=>fillSubcategorySelect($('editSubcategory'),$('editCategory').value));
$('bulkUpdateCategory').onchange=()=>{captureBulkUpdateDraft();fillBulkUpdateSubcategories();captureBulkUpdateDraft();};
$('bulkUpdateSubcategory').onchange=captureBulkUpdateDraft;
$('bulkUpdateAccount').onchange=captureBulkUpdateDraft;
$('bulkUpdatePhysicalCard').onchange=captureBulkUpdateDraft;
$('bulkUpdateMonth').onchange=captureBulkUpdateDraft;
$('bulkUpdateDescription').oninput=captureBulkUpdateDraft;
$('closeBulkUpdateTop').onclick=closeBulkUpdateDraft;
$('closeBulkUpdateCancel').onclick=closeBulkUpdateDraft;
$('txBulkUpdateForm').onsubmit=e=>{e.preventDefault();applyBulkUpdateSelected();};

$('convertToInstallment').addEventListener('click',()=>{
 const t=normalizedTx().find(x=>x._id===editingTxId);if(!t||!isEligibleInstallmentTx(t)||isTxLinkedToInstallment(t))return;
 closeModal('txEditModal');
 openInstallment({
  cardId:t.account,description:t.description,category:t.category,subcategory:t.subcategory,
  fullAmount:Math.abs(t.amount),months:3,startMonth:(t.date||'2026-08-01').slice(0,7),paidInstallments:0,
  linkedTransactionId:t._id,source:'Converted from transaction'
 });
});


$('editStatementMonth').addEventListener('change',()=>{
 $('editStatementManual').checked=!!$('editStatementMonth').value;
});

$('txEditForm').addEventListener('submit',e=>{
 e.preventDefault();

 const original=normalizedTx(true).find(t=>t._id===editingTxId) || transactions.find(t=>t._id===editingTxId);
 if(!original)return;

 const oldMonth=assignedTransactionPaymentMonth(original.account,original);
 const editedDescription=$('editDescription').value.trim();
 const editedDate=$('editDate').value;
 const editedAmount=Number($('editAmount').value);
 if(!editedDescription){alert('Transaction description is required.');return;}
 if(!editedDate){alert('Transaction date is required.');return;}
 if(!Number.isFinite(editedAmount)||editedAmount===0){alert('Enter a valid non-zero transaction amount.');return;}
 const selectedMonth=$('editStatementMonth').value;
 const autoMonth=paymentMonthForTransaction(original.account,editedDate);
 const hasManualMonth=!!selectedMonth;
 const newMonth=hasManualMonth?selectedMonth:autoMonth;
 const val={
  description:editedDescription,
  date:editedDate,
  amount:editedAmount,
  category:$('editCategory').value,
  subcategory:$('editSubcategory').value,
  physicalCardEnding:$('editPhysicalCard').value||transactionPhysicalCardEnding(original),
  statementMonth:hasManualMonth?newMonth:'',
  paymentMonth:hasManualMonth?newMonth:'',
  statementMonthManual:hasManualMonth
 };

 if(!hasManualMonth){
  delete val.statementMonth;
  delete val.paymentMonth;
 }
 // A manual bank transaction already changed the live balance when created.
 // Replace that old effect with the edited amount before saving the override.
 adjustTrackedBankForTransaction(original,-1);
 txOverrides[editingTxId]=val;
 adjustTrackedBankForTransaction({...original,...val},1);
 if($('rememberMerchant').checked&&original){
  // Merchant rules remember categorization only. A statement-month move is
  // transaction-specific and must not silently move every matching merchant.
  merchantRules[editedDescription]={
   category:val.category,
   subcategory:val.subcategory
  };
 }

 saveLocal();
 syncTransactionOverridesImmediate();
 closeModal('txEditModal');

 if(oldMonth!==newMonth){
  rebuildCardAfterStatementMonthMove(original.account,oldMonth,newMonth);
 }

 // Full refresh is required even if only category changed because the card
 // detail, planner, dashboard, reports and current-cycle metrics share state.
 refreshAfterTransactionChange(original.account);
 renderCategories();
});


function cardPositionHero(a,m){
 const plans=installments.filter(p=>p.cardId===a.id&&planCalc(p).remaining>0);
 const is0955=a.id==='ar-0955';
 const title=`${a.bank} • ${a.name} •${a.ending}`;

 const planCards=plans.length?plans.map(p=>{
  const c=planCalc(p);
  return `<div class="installmentCard">
   <div class="small">${p.description||'Installment Plan'}</div>
   <div class="meta">${p.source||'Manual'}${p.id==='sab-user-full-9172'?' • Current SAB plan':''}</div>
   <div class="amt">${money(c.remaining)}</div>
   <div class="months">${c.remainingCount} month${c.remainingCount===1?'':'s'} remaining</div>
   <div class="next">Next installment ≈ ${money(c.monthly)}</div>
  </div>`;
 }).join(''):'<div class="meta">No active installment reservations.</div>';

 const heroValue=is0955?m.availableBeforeInstallments:m.available;
 const heroLabel=is0955?'Available Credit':'Available credit';

 return `<div class="cardDetailHero">
  <div class="cardDetailMain">
   <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
    <div>
     <div class="cardDetailTitle">${title}</div>
     <div class="cardDetailSub">${a.balanceLabel||'Current card position'}${a.balanceAsOf?' • '+a.balanceAsOf:''}</div>
    </div>
   </div>
   <div class="cardDetailSub" style="margin-top:15px">${heroLabel}</div>
   <div class="cardDetailBig">${money(heroValue)}</div>
   ${is0955?`<div class="cardDetailSub">Actual available credit after released balance, unreleased transactions, and remaining installment principal.</div>`:''}
   <div class="cardMetricGrid">
    <div class="cardMetricBox"><span>Credit Limit</span><b>${money(m.limit)}</b></div>
    <div class="cardMetricBox"><span>Available Credit</span><b class="green">${money(m.available)}</b></div>
    <div class="cardMetricBox"><span>Future Reserved Installments</span><b class="amber">${money(m.inst)}</b></div>
    <div class="cardMetricBox"><span>Outstanding / Utilized</span><b class="red">${money(m.total)}</b></div>
   </div>
   
   
   ${is0955?`<div class="physicalCardsBox">
    <div class="cardDetailSub">Physical cards under this account</div>
    <div class="subcardTags">
     <span class="subcardTag">Primary •0955</span>
     <span class="subcardTag">Supplementary •9345</span>
     <span class="subcardTag">Supplementary •9634</span>
    </div>
   </div>`:''}
  </div>
  <div class="installmentPanel">
   <div class="panelTitle" style="margin-bottom:10px">Installment Reservation Breakdown</div>
   <div class="installmentGrid">${planCards}</div>
  </div>
 </div>`;
}


function currentMonthInput(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}
function openBalanceOffer(cardId){
 const a=account(cardId);if(!a)return;const m=cardMetrics(a);
 $('balanceOfferCardId').value=cardId;$('balanceOfferCardName').value=`${a.bank} • ${a.name} •${a.ending}`;
 $('balanceOfferScope').value='current';$('balanceOfferAmount').value=Number(m.current||0).toFixed(2);
 $('balanceOfferMonths').value=12;$('balanceOfferStartMonth').value=currentMonthInput();$('balanceOfferFee').value=0;
 $('balanceOfferDescription').value='Card Balance Installment Offer';updateBalanceOfferPreview();$('balanceOfferModal').classList.add('open');
}
function closeBalanceOffer(){$('balanceOfferModal').classList.remove('open');}
function updateBalanceOfferPreview(){
 const a=account($('balanceOfferCardId').value);if(!a)return;const m=cardMetrics(a),scope=$('balanceOfferScope').value;
 const amount=Math.max(0,Number($('balanceOfferAmount').value||0)),months=Math.max(1,Number($('balanceOfferMonths').value||1)),fee=Math.max(0,Number($('balanceOfferFee').value||0)),monthly=(amount/months)+fee;
 $('balanceOfferPreview').innerHTML=`<b>Preview</b><div class="meta" style="margin-top:4px">Amount ${money(amount)} • ${months} months • Approx. monthly ${money(monthly)}</div><div class="meta" style="margin-top:4px">${scope==='current'?`Recommended maximum: ${money(m.current)} current non-installment balance.`:`Full utilized balance: ${money(m.total)}. Existing installment plans will be replaced.`}</div>`;
}
['balanceOfferAmount','balanceOfferMonths','balanceOfferFee'].forEach(id=>$(id).addEventListener('input',updateBalanceOfferPreview));
$('balanceOfferScope').addEventListener('change',()=>{const a=account($('balanceOfferCardId').value);if(!a)return;const m=cardMetrics(a);$('balanceOfferAmount').value=($('balanceOfferScope').value==='full'?m.total:m.current).toFixed(2);updateBalanceOfferPreview();});
$('closeBalanceOffer').addEventListener('click',closeBalanceOffer);$('cancelBalanceOffer').addEventListener('click',closeBalanceOffer);
$('balanceOfferForm').addEventListener('submit',e=>{
 e.preventDefault();const cardId=$('balanceOfferCardId').value,a=account(cardId);if(!a)return;const m=cardMetrics(a),scope=$('balanceOfferScope').value;
 const amount=Number($('balanceOfferAmount').value||0),months=Math.max(1,Math.floor(Number($('balanceOfferMonths').value||1))),fee=Math.max(0,Number($('balanceOfferFee').value||0));
 if(!Number.isFinite(amount)||amount<=0){alert('Enter a valid offer amount.');return;}
 if(scope==='current'&&amount>m.current+0.01&&!confirm(`This amount is above the current non-installment balance ${money(m.current)} and may double-count existing installment reserves. Continue?`))return;
 if(scope==='full'){const active=installments.filter(p=>p.cardId===cardId&&planCalc(p).remaining>0);if(active.length&&!confirm(`Replace ${active.length} existing active installment plan(s) with this full-balance offer?`))return;installments=installments.filter(p=>!(p.cardId===cardId&&planCalc(p).remaining>0));}
 installments.push({id:'balance-offer-'+Date.now(),cardId,description:$('balanceOfferDescription').value.trim()||'Card Balance Installment Offer',category:'Financial Obligations',subcategory:'Credit Card Payments',fullAmount:Math.round(amount*100)/100,months,startMonth:$('balanceOfferStartMonth').value||currentMonthInput(),referenceMonth:$('balanceOfferStartMonth').value||currentMonthInput(),paidInstallments:0,monthlyFee:fee,source:'Bank Balance Installment Offer',planType:'balance-offer',offerScope:scope,createdAt:new Date().toISOString().slice(0,10)});
 if(a.extra&&a.extra['Future Installment Reserve']!==undefined)delete a.extra['Future Installment Reserve'];
 localStorage.setItem('pf_installments',JSON.stringify(installments));saveLocal();closeBalanceOffer();renderInstallments();renderAccounts();renderDashboard();openAccount(cardId);
});



function assignedTransactionPaymentMonth(cardId,t){
 if(!t)return '';

 const ov=t._id ? txOverrides?.[t._id] : null;

 // V130: a selected Statement Month is itself the override.
 // The user must never see "Statement 2026-10" while calculations still use 2026-09.
 if(ov?.statementMonth)return ov.statementMonth;
 if(t.statementMonth && t.statementMonthManual===true)return t.statementMonth;

 // Imported rows may already carry a paymentMonth.
 if(t.paymentMonth)return t.paymentMonth;

 return paymentMonthForTransaction(cardId,t.date);
}

function cardTransactionStatementMonth(cardId,t){
 return assignedTransactionPaymentMonth(cardId,t);
}
function cardTransactionMonths(cardId){
 const months=new Set();
 // Only active/non-deleted transactions belong in live month selectors.
 liveCardTransactions().filter(t=>t.account===cardId).forEach(t=>{
  const m=cardTransactionStatementMonth(cardId,t);
  if(m)months.add(m);
 });
 return [...months].sort().reverse();
}
function cardMonthLabel(ym){
 if(!ym)return 'All Statements';
 const [y,m]=String(ym).split('-').map(Number);
 if(!Number.isFinite(y)||!Number.isFinite(m))return ym;
 return new Date(y,m-1,1).toLocaleDateString(undefined,{month:'long',year:'numeric'});
}
function cardTransactionsForDetail(cardId){
 let rows=liveCardTransactions().filter(t=>t.account===cardId);
 if(accountDetailTxFilter.month)rows=rows.filter(t=>cardTransactionStatementMonth(cardId,t)===accountDetailTxFilter.month);
 if(accountDetailTxFilter.physicalCard)rows=rows.filter(t=>transactionPhysicalCardEnding(t)===accountDetailTxFilter.physicalCard);
 if(accountDetailTxFilter.fromDate)rows=rows.filter(t=>String(t.date||'').slice(0,10)>=accountDetailTxFilter.fromDate);
 if(accountDetailTxFilter.toDate)rows=rows.filter(t=>String(t.date||'').slice(0,10)<=accountDetailTxFilter.toDate);
 return rows.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
}

function cardPaymentLedgerForDetail(cardId){
 return (cashFlowLedger||[]).filter(x=>x.type==='card-payment' && x.status!=='reversed' && x.targetId===cardId)
  .filter(x=>!accountDetailTxFilter.month || (x.targetPaymentMonth||x.month)===accountDetailTxFilter.month)
  .filter(x=>!accountDetailTxFilter.fromDate || String(x.date||'').slice(0,10)>=accountDetailTxFilter.fromDate)
  .filter(x=>!accountDetailTxFilter.toDate || String(x.date||'').slice(0,10)<=accountDetailTxFilter.toDate)
  .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
}
function cardPaymentsMadeForDetail(cardId){
 return (cashFlowLedger||[]).filter(x=>x.type==='card-payment' && x.status!=='reversed' && x.sourceId===cardId && x.targetId!==cardId)
  .filter(x=>!accountDetailTxFilter.month || paymentMonthForTransaction(cardId,x.date)===accountDetailTxFilter.month)
  .filter(x=>!accountDetailTxFilter.fromDate || String(x.date||'').slice(0,10)>=accountDetailTxFilter.fromDate)
  .filter(x=>!accountDetailTxFilter.toDate || String(x.date||'').slice(0,10)<=accountDetailTxFilter.toDate)
  .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
}
function cardPaymentSourceRowsForDetail(cardId,visibleRows){
 if(accountDetailTxFilter.physicalCard)return [];
 return cardPaymentsMadeForDetail(cardId).filter(x=>!visibleRows.some(t=>
  Number(t.amount||0)<0 && Math.abs(Math.abs(Number(t.amount||0))-Number(x.amount||0))<0.01 &&
  String(t.date||'').slice(0,10)===String(x.date||'').slice(0,10) &&
  /payment|transfer|nbd|emirates|4411/i.test(String(t.description||''))
 ));
}


function importedOfficialStatementMonths(cardId){
 const months=new Set();

 // 1) Payment-plan rows that are genuinely backed by an imported statement.
 cardPaymentPlan.filter(p=>
  p.accountId===cardId &&
  p.statementOfficial===true &&
  officialStatementImportMatches(p)
 ).forEach(p=>{ if(p.month)months.add(p.month); });

 // 2) Import-history confirmations themselves, as a fallback for older versions.
 (importHistory||[]).forEach(h=>{
  if(h.accountId!==cardId && h.account!==cardId)return;
  if(h.officialStatementConfirmed!==true)return;
  const month=
    h.officialStatementMonth ||
    (h.statementMonth ? String(h.statementMonth).slice(0,7) : '') ||
    (h.dueDate ? String(h.dueDate).slice(0,7) : '') ||
    (h.statementEnd ? String(h.statementEnd).slice(0,7) : '');
  if(month)months.add(month);
 });

 return [...months].sort().reverse();
}

function resettableCardMonths(cardId){
 const months=new Set();

 // Real statements confirmed from Import Statements are always valid reset targets.
 importedOfficialStatementMonths(cardId).forEach(m=>months.add(m));

 // Also allow active transaction cycles where no official statement exists yet.
 // This lets the user clear manually/imported transactions before a statement is available.
 cardTransactionMonths(cardId).forEach(m=>months.add(m));

 return [...months].sort().reverse();
}

function resetCardData(cardId){
 const a=account(cardId);if(!a||a.type!=='card')return;
 const label=`${a.bank} • ${a.name} •${a.ending}`;
 const months=resettableCardMonths(cardId);

 if(!months.length){
  alert(`No transaction statements are available to reset for ${label}.`);
  return;
 }

 // If the user is currently filtering the card by a statement month, reset that month.
 // Otherwise ask which statement month should be reset.
 let selectedMonth=accountDetailTxFilter.month;
 if(!selectedMonth || !months.includes(selectedMonth)){
  const answer=prompt(
   `Choose the statement/payment month to reset for ${label}.\n\n`+
   months.map(m=>`${m} — ${cardMonthLabel(m)}${importedOfficialStatementMonths(cardId).includes(m)?' • Official imported statement':' • Active transactions'}`).join('\n')+
   `\n\nEnter YYYY-MM:`,
   months[0]
  );
  if(answer===null)return;
  selectedMonth=String(answer||'').trim();
 }

 if(!months.includes(selectedMonth)){
  alert('Please choose one of the available statement months.');
  return;
 }

 const baseRows=BASE.transactions.map((t,i)=>({...t,_id:'tx'+i}))
  .filter(t=>t.account===cardId && cardTransactionStatementMonth(cardId,t)===selectedMonth);
 const manualRows=manualTransactions
  .filter(t=>t.account===cardId && cardTransactionStatementMonth(cardId,t)===selectedMonth);
 const importedRows=importedTransactions
  .filter(t=>t.account===cardId && cardTransactionStatementMonth(cardId,t)===selectedMonth);

 const allResetRows=[...baseRows,...manualRows,...importedRows];
 const ids=new Set(allResetRows.map(t=>t._id).filter(Boolean));

 const linkedPlans=installments.filter(p=>
  p.cardId===cardId && p.linkedTransactionId && ids.has(p.linkedTransactionId)
 );
 const plannerRows=cardPaymentPlan.filter(p=>p.accountId===cardId && p.month===selectedMonth);

 const ok=confirm(
  `Reset ${label} — ${cardMonthLabel(selectedMonth)}?\n\n`+
  `This will delete ONLY this statement month's:\n`+
  `• ${allResetRows.length} transaction(s)\n`+
  `• ${linkedPlans.length} installment plan(s) created from those transactions\n`+
  `• ${plannerRows.length} payment-plan row(s)\n\n`+
  `Other months/statements on this card will remain unchanged.`
 );
 if(!ok)return;

 // Built-in/base transactions are suppressed with a delete action.
 baseRows.forEach(t=>{
  transactionActions[t._id]={
   status:'deleted',
   reason:`Reset ${label} — ${selectedMonth}`,
   updatedAt:new Date().toISOString()
  };
 });

 // User/import transactions are physically removed only for the selected statement month.
 manualTransactions=manualTransactions.filter(t=>!(
  t.account===cardId && cardTransactionStatementMonth(cardId,t)===selectedMonth
 ));
 importedTransactions=importedTransactions.filter(t=>!(
  t.account===cardId && cardTransactionStatementMonth(cardId,t)===selectedMonth
 ));

 // Remove only installment plans linked to transactions from this reset month.
 installments=installments.filter(p=>!(
  p.cardId===cardId && p.linkedTransactionId && ids.has(p.linkedTransactionId)
 ));

 // Remove only this card's planner/official-statement row for this month.
 cardPaymentPlan=cardPaymentPlan.filter(p=>!(p.accountId===cardId && p.month===selectedMonth));

 // If the reset month was the last uploaded meem official statement, remove its metadata too.
 if(cardId==='meem-7102'){
  const card=account(cardId);
  if(card?.extra?.['Last Official Meem Statement Month']===selectedMonth){
   delete card.extra['Last Official Meem Statement Month'];
   delete card.extra['Last Statement Total Due'];
   delete card.extra['Last Statement Minimum Due'];
   delete card.extra['Last Statement Due Date'];
   delete card.extra['Last Statement Start'];
   delete card.extra['Last Statement End'];
   delete card.extra['Last Statement Closing Balance'];
   localStorage.setItem('pf_accounts',JSON.stringify(accounts));
  }
 }

 // Remove only payment history in this month where this card was target/source.
 cardPaymentPlan.forEach(p=>{
  p.paymentHistory=(p.paymentHistory||[]).filter(h=>{
   const historyMonth=paymentBudgetMonth(h);
   const related=(p.accountId===cardId || h.sourceId===cardId || h.targetCardId===cardId);
   return !(related && historyMonth===selectedMonth);
  });
  p.paidAmount=(p.paymentHistory||[]).filter(h=>!h.mirrored)
   .reduce((s,h)=>s+Number(h.duePortion!=null?h.duePortion:h.amount||0),0);
  p.paid=paymentRemainingAmount(p)<=0.005;
 });

 cardResetHistory.unshift({
  cardId,label,month:selectedMonth,
  resetAt:new Date().toISOString(),
  removedTransactions:allResetRows.length,
  removedInstallments:linkedPlans.length,
  removedPlannerRows:plannerRows.length
 });
 cardResetHistory=cardResetHistory.slice(0,100);

 localStorage.setItem('pf_card_reset_history',JSON.stringify(cardResetHistory));
 localStorage.setItem('pf_manual_transactions',JSON.stringify(manualTransactions));
 localStorage.setItem('pf_imported_transactions',JSON.stringify(importedTransactions));
 localStorage.setItem('pf_installments',JSON.stringify(installments));
 localStorage.setItem('pf_card_payment_plan',JSON.stringify(cardPaymentPlan));
 localStorage.setItem('pf_transaction_actions',JSON.stringify(transactionActions));

 // V118: never allow the retired SAB SAR 28,627.50 seed to return after reset.
 normalizeCardPaymentPlan();
 purgeLegacySabAnchorRows();
 purgeLegacyAr5867SeedRows();
 rebuildTransactions();
 ensureMonthlyPlannerRows(selectedMonth);
 // Persist the cleaned planner before cloud auto-sync snapshots the state.
 localStorage.setItem('pf_card_payment_plan',JSON.stringify(cardPaymentPlan));
 saveLocal();

 renderDashboard();
 renderAccounts();
 renderTransactions();
 renderInstallments();
 renderReports();
 renderPaymentPlanner();
 renderIncomePlan();
 renderImportHistory();

 accountDetailTxFilter={...accountDetailTxFilter,month:selectedMonth};
 if(document.getElementById('accountDetail')?.classList.contains('active')){
  openAccount(cardId,accountDetailReturnPage);
 }

 alert(`${label} — ${cardMonthLabel(selectedMonth)} was reset. Other statement months were not changed.`);
}

var accountDetailReturnPage='accounts';
var currentAccountDetailId=null;
var accountDetailTxFilter={month:'',fromDate:'',toDate:'',physicalCard:''};

function bindDetailTransactionBulkActions(){
 const root=$('accountDetailContent');
 if(!root)return;

 const visible=()=>[...root.querySelectorAll('[data-select-tx]')];

 if($('detailTxSelectAllVisible'))$('detailTxSelectAllVisible').onclick=()=>{
  visible().forEach(c=>setTransactionSelected(c.dataset.selectTx,true,c));
  updateTxBulkUI();
 };
 if($('detailTxClearSelection'))$('detailTxClearSelection').onclick=()=>{
  visible().forEach(c=>setTransactionSelected(c.dataset.selectTx,false,c));
  updateTxBulkUI();
 };
 if($('detailTxUpdateSelected'))$('detailTxUpdateSelected').onclick=openBulkUpdateSelected;
 if($('detailTxDeleteSelected'))$('detailTxDeleteSelected').onclick=bulkDeleteSelected;
 if($('detailTxMasterCheck'))$('detailTxMasterCheck').onchange=e=>{
  const selected=e.target.checked;
  visible().forEach(c=>setTransactionSelected(c.dataset.selectTx,selected,c));
  updateTxBulkUI();
 };
 updateTxBulkUI();
}

function openAccount(id,returnPage){
 const __detailScrollX=txSelectionScrollLock?.x??window.scrollX,__detailScrollY=txSelectionScrollLock?.y??window.scrollY;
 currentAccountDetailId=id;
 if(returnPage)accountDetailReturnPage=returnPage;
 else if(document.getElementById('incomeplan')?.classList.contains('active'))accountDetailReturnPage='incomeplan';
 else if(document.getElementById('dashboard')?.classList.contains('active'))accountDetailReturnPage='dashboard';
 else if(document.getElementById('accounts')?.classList.contains('active'))accountDetailReturnPage='accounts';
 const a=account(id);
 const txMonths=cardTransactionMonths(id);
 if(accountDetailTxFilter.month && !txMonths.includes(accountDetailTxFilter.month))accountDetailTxFilter.month='';
 if(accountDetailTxFilter.fromDate && accountDetailTxFilter.toDate && accountDetailTxFilter.fromDate>accountDetailTxFilter.toDate){
  const tmp=accountDetailTxFilter.fromDate;
  accountDetailTxFilter.fromDate=accountDetailTxFilter.toDate;
  accountDetailTxFilter.toDate=tmp;
 }
 const rows=cardTransactionsForDetail(id);
 const sourcePaymentRows=cardPaymentSourceRowsForDetail(id,rows);
 if(a.type==='card'){const m=cardMetrics(a),plans=installments.filter(p=>p.cardId===id&&planCalc(p).remaining>0),hero=cardPositionHero(a,m);$('accountDetailContent').innerHTML=`${hero}<div class="panel"><div class="splitHead"><div><div class="sectionTitle" style="margin:0">${a.bank} • ${a.name} •${a.ending}</div><div class="meta">${resetCardIds.has(a.id)?'RESET MODE • transactions and active installments drive the live card balance':a.id==='ar-0955'?'Verified current balance as of 28 Aug 2026':a.id==='sab-440880'?'Transaction / installment driven balance':'Estimated from uploaded period transactions'}</div></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="detailAddTransaction">+ Add Transaction</button><button class="btn" id="detailBalanceOffer">Balance Installment Offer</button><button class="btn primary" id="detailAddPlan">+ Installment Plan</button><button type="button" class="btn danger" id="detailResetCard">Reset Card Month</button></div></div><div class="cardMetricGrid" style="margin-top:14px">
 <div class="miniMetric"><span>Current Open Cycle (${cardMonthLabel(m.activeCycleMonth)})</span><b class="red">${money(m.currentCycleTransactions||0)}</b></div>
 <div class="miniMetric"><span>Prior Unreleased Cycle(s)</span><b class="amber">${money(m.priorOpenCycleTransactions||0)}</b></div>
 <div class="miniMetric"><span>Current Cycle Installment</span><b class="red">${money(m.currentCycleInstallment||0)}</b></div>
 <div class="miniMetric"><span>Released / Official Amount to Pay</span><b class="blue">${money(m.releasedStatementBalance||0)}</b></div>
 <div class="miniMetric"><span>Future Installment Reserve</span><b class="amber">${money(m.inst||0)}</b></div>
 <div class="miniMetric"><span>Outstanding / Utilized</span><b class="red">${money(m.total)}</b></div>
 <div class="miniMetric"><span>Available Credit</span><b class="green">${money(m.available)}</b></div>
 <div class="miniMetric"><span>Utilization</span><b>${m.util.toFixed(1)}%</b></div>
</div></div>
<div class="sectionTitle">Active Installments</div><div class="meta" style="margin:-6px 0 9px">Installment payments already completed reduce the adjusted card balance automatically. Remaining principal stays reserved. If you settle a plan early, confirm/delete it so future commitments stop.</div><div class="panel">${(()=>{
 const activePlans=plans.filter(p=>planCalc(p).status==='Active');
 const totalRemaining=activePlans.reduce((z,p)=>z+planCalc(p).remaining,0);
 const monthlyCommitment=activePlans.reduce((z,p)=>z+planCalc(p).monthly,0);
 return `<div class="detailInstallTop">
  <div class="detailInstallStats">
   <div class="detailInstallStat"><span>Active Plans</span><b>${activePlans.length}</b></div>
   <div class="detailInstallStat"><span>Remaining Amount</span><b class="amber">${money(totalRemaining)}</b></div>
   <div class="detailInstallStat"><span>Monthly Commitment</span><b class="red">${money(monthlyCommitment)}</b></div>
  </div>
  <button class="btn" data-open-installments-page="1">Open Installments Page</button>
 </div>
 ${activePlans.length?`<div class="detailInstallWrap"><table class="detailInstallTable"><thead><tr>
  <th>Card</th><th>Description</th><th>Category</th><th>Original Amount</th><th>Plan</th><th>Monthly</th><th>Paid</th><th>Remaining Inst.</th><th>Remaining Amount</th><th>Status</th><th></th>
 </tr></thead><tbody>${activePlans.map(p=>{const c=planCalc(p);return `<tr>
  <td><b>${a.bank} •${a.ending}</b></td>
  <td><b>${p.description}</b><div class="meta">${p.source||'Manual'}${p.linkedTransactionId?' • linked purchase':''}</div></td>
  <td>${p.category}<div class="meta">${p.subcategory}</div></td>
  <td>${money(p.fullAmount)}</td>
  <td>${p.months} months</td>
  <td>${money(c.monthly)}</td>
  <td>${c.paid} of ${p.months}</td>
  <td>${c.remainingCount}</td>
  <td class="amber"><b>${money(c.remaining)}</b></td>
  <td><span class="badge ${c.status.toLowerCase()}">${c.status}</span></td>
  <td><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn small" data-detail-plan="${p.id}">Edit</button><button type="button" class="btn small danger" data-detail-delete-plan="${p.id}">Delete</button></div></td>
 </tr>`}).join('')}</tbody></table></div>`:'<div class="meta">No installment plans for this card.</div>'}`;
})()}</div>
<div class="notice" style="margin:12px 0"><b>Card balance:</b> Outstanding / Utilized includes all still-live transaction cycles, not only the current open cycle. Prior calculated cycles remain utilized until replaced by an official/released statement or otherwise closed. Available Credit = Credit Limit − Outstanding / Utilized − current-cycle installment commitment. Historical built-in rows remain reference-only.</div>
<div class="splitHead" style="margin-top:18px">
 <div>
  <div class="sectionTitle" style="margin:0">Transactions</div>
  <div class="meta">${[
   accountDetailTxFilter.month?`Statement: ${cardMonthLabel(accountDetailTxFilter.month)}`:'All statements',
   accountDetailTxFilter.physicalCard?`Card: ${physicalCardLabelFor(id,accountDetailTxFilter.physicalCard)}`:'All physical cards',
   accountDetailTxFilter.fromDate?`From ${accountDetailTxFilter.fromDate}`:'',
   accountDetailTxFilter.toDate?`To ${accountDetailTxFilter.toDate}`:''
  ].filter(Boolean).join(' • ')}</div>
 </div>
</div>
<div class="panel" style="margin-top:8px">
 <div style="display:grid;grid-template-columns:minmax(220px,1fr) minmax(190px,.8fr) minmax(180px,.7fr) minmax(180px,.7fr) auto;gap:10px;align-items:end">
  <div class="field" style="margin:0">
   <label>Statement / Payment Month</label>
   <select id="cardTxStatementFilter" class="input">
    <option value="">All Statements</option>
    ${txMonths.map(m=>`<option value="${m}" ${accountDetailTxFilter.month===m?'selected':''}>${cardMonthLabel(m)}</option>`).join('')}
   </select>
  </div>
  <div class="field" style="margin:0">
   <label>Physical Card</label>
   <select id="cardTxPhysicalFilter" class="input"><option value="">All Physical Cards</option>${accountPhysicalCards(id).map(e=>`<option value="${e}" ${accountDetailTxFilter.physicalCard===e?'selected':''}>${physicalCardLabelFor(id,e)}</option>`).join('')}</select>
  </div>
  <div class="field" style="margin:0">
   <label>From Date</label>
   <input id="cardTxFromDate" type="date" class="input" value="${accountDetailTxFilter.fromDate||''}">
  </div>
  <div class="field" style="margin:0">
   <label>To Date</label>
   <input id="cardTxToDate" type="date" class="input" value="${accountDetailTxFilter.toDate||''}">
  </div>
  <button class="btn" id="clearCardTxFilters" type="button">Clear Filters</button>
 </div>
 <div class="meta" style="margin-top:8px">Statement and date filters work together. Reset Card Month still uses only the selected statement/payment month.</div>
</div>
${cardPaymentLedgerForDetail(id).length?`<div class="panel"><div class="sectionTitle">Payments received by this card</div><div class="meta">Recorded card payments are shown separately from purchases. They are already applied to the card balance.</div><div style="overflow-x:auto"><table class="txTable"><thead><tr><th>Date</th><th>From</th><th>Payment month</th><th>Amount received</th></tr></thead><tbody>${cardPaymentLedgerForDetail(id).map(x=>`<tr><td>${escapeHtml(String(x.date||''))}</td><td>${escapeHtml(x.sourceName||accountName(x.sourceId))}</td><td>${escapeHtml(x.targetPaymentMonth||x.month||'')}</td><td class="green">${money(x.amount)}</td></tr>`).join('')}</tbody></table></div></div>`:''}
<div class="panel">
 <div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:12px">
  <button class="btn" type="button" id="detailTxSelectAllVisible">Select All Visible</button>
  <button class="btn" type="button" id="detailTxClearSelection">Clear Selection</button>
  <button class="btn primary" type="button" id="detailTxUpdateSelected" disabled>Update Selected</button>
  <button class="btn danger" type="button" id="detailTxDeleteSelected" disabled>Delete Selected</button>
  <span class="meta" id="detailTxSelectedCount">0 selected</span>
 </div>
 <div style="overflow-x:auto"><table class="txTable">
  <thead><tr><th style="width:42px"><input type="checkbox" id="detailTxMasterCheck" title="Select all visible"></th><th>Date</th><th>Imported Date</th><th>Transaction</th><th>Category</th><th>Subcategory</th><th>Account</th><th>Amount</th></tr></thead>
  <tbody>${rows.map(txRow6).join('')}${sourcePaymentRows.map(x=>`<tr><td></td><td>${escapeHtml(String(x.date||''))}</td><td>—</td><td><b>Payment to ${escapeHtml(x.targetName||accountName(x.targetId))}</b><div class="meta">Recorded card transfer • source statement ${escapeHtml(paymentMonthForTransaction(id,x.date))} • target statement ${escapeHtml(x.targetPaymentMonth||'not recorded')} • edit or undo from the target card payment planner</div></td><td>Financial Obligations</td><td>Credit Card Payments</td><td>${escapeHtml(accountName(id))}</td><td class="red"><b>-${money(x.amount)}</b></td></tr>`).join('')}${!rows.length&&!sourcePaymentRows.length?'<tr><td colspan="8">No transactions match the selected filters.</td></tr>':''}</tbody>
 </table></div>
 ${(()=>{
   const cards=accountPhysicalCards(id);
   const grouped=cards.map(ending=>{
    const cardRows=rows.filter(t=>transactionPhysicalCardEnding(t)===ending);
    return {ending,count:cardRows.length,total:cardRows.reduce((sum,t)=>sum+Number(t.amount||0),0)};
   }).filter(x=>x.count>0);
   const unassignedRows=rows.filter(t=>!cards.includes(transactionPhysicalCardEnding(t)));
   if(unassignedRows.length)grouped.push({ending:'',count:unassignedRows.length,total:unassignedRows.reduce((sum,t)=>sum+Number(t.amount||0),0)});
   if(sourcePaymentRows.length)grouped.push({ending:'',label:'Recorded card transfers',count:sourcePaymentRows.length,total:-sourcePaymentRows.reduce((sum,x)=>sum+Number(x.amount||0),0)});
   const total=rows.reduce((sum,t)=>sum+Number(t.amount||0),0)-sourcePaymentRows.reduce((sum,x)=>sum+Number(x.amount||0),0);
   return `<div style="margin-top:14px;border-top:1px solid var(--line);padding-top:14px">
    <div class="splitHead"><div><div class="panelTitle" style="margin:0">Filtered Transaction Totals</div><div class="meta" style="margin-top:4px">Totals follow the selected statement month, physical card and From/To date filters.</div></div><div style="text-align:right"><div class="meta">All visible transactions • ${rows.length+sourcePaymentRows.length}</div><div style="font-size:20px;font-weight:950;margin-top:3px" class="${total<0?'red':total>0?'green':''}">${signed(total)}</div></div></div>
    <div class="cardMetricGrid" style="margin-top:12px">${grouped.length?grouped.map(g=>`<div class="miniMetric"><span>${g.label|| (g.ending?physicalCardLabelFor(id,g.ending):'Unassigned physical card')} • ${g.count} ${g.label?'payment':'transaction'}${g.count===1?'':'s'}</span><b class="${g.total<0?'red':g.total>0?'green':''}">${signed(g.total)}</b></div>`).join(''):'<div class="meta">No transactions in the selected period.</div>'}</div>
   </div>`;
  })()}
</div>`;$('detailAddPlan').addEventListener('click',()=>openInstallment({cardId:id,description:'',category:'Financial Obligations',subcategory:'Credit Card Payments',fullAmount:'',months:3,startMonth:'2026-08',paidInstallments:0}));
 if($('detailResetCard'))$('detailResetCard').addEventListener('click',()=>resetCardData(id));
 const statementFilter=$('cardTxStatementFilter');
 if(statementFilter)statementFilter.addEventListener('change',()=>{
  accountDetailTxFilter.month=statementFilter.value||'';
  openAccount(id,accountDetailReturnPage);
 });

 const physicalCardFilter=$('cardTxPhysicalFilter');if(physicalCardFilter)physicalCardFilter.addEventListener('change',()=>{accountDetailTxFilter.physicalCard=physicalCardFilter.value||'';openAccount(id,accountDetailReturnPage);});

 const fromDateFilter=$('cardTxFromDate');
 if(fromDateFilter)fromDateFilter.addEventListener('change',()=>{
  accountDetailTxFilter.fromDate=fromDateFilter.value||'';
  if(accountDetailTxFilter.toDate && accountDetailTxFilter.fromDate>accountDetailTxFilter.toDate){
   accountDetailTxFilter.toDate=accountDetailTxFilter.fromDate;
  }
  openAccount(id,accountDetailReturnPage);
 });

 const toDateFilter=$('cardTxToDate');
 if(toDateFilter)toDateFilter.addEventListener('change',()=>{
  accountDetailTxFilter.toDate=toDateFilter.value||'';
  if(accountDetailTxFilter.fromDate && accountDetailTxFilter.toDate<accountDetailTxFilter.fromDate){
   accountDetailTxFilter.fromDate=accountDetailTxFilter.toDate;
  }
  openAccount(id,accountDetailReturnPage);
 });

 const clearTxFilters=$('clearCardTxFilters');
 if(clearTxFilters)clearTxFilters.addEventListener('click',()=>{
  accountDetailTxFilter={month:'',fromDate:'',toDate:'',physicalCard:''};
  openAccount(id,accountDetailReturnPage);
 });
 document.querySelectorAll('[data-detail-plan]').forEach(b=>b.addEventListener('click',()=>editPlan(b.dataset.detailPlan)));
 document.querySelectorAll('[data-detail-delete-plan]').forEach(b=>b.addEventListener('click',()=>deleteInstallmentPlan(b.dataset.detailDeletePlan)));
 document.querySelectorAll('[data-open-installments-page]').forEach(b=>b.addEventListener('click',()=>{renderInstallments();nav('installments');window.scrollTo({top:0,behavior:'smooth'});}));}
 else{$('accountDetailContent').innerHTML=`<div class="panel"><div class="splitHead"><div><div class="sectionTitle" style="margin:0">${a.bank} • ${a.name}</div><div class="kpiValue green">${money(adjustedBankBalance(a))}</div><div class="meta">Live tracked balance • payments and manual transactions included</div></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" id="detailAddTransaction">+ Add Transaction</button><button class="btn" id="setActualBankBalance">Set Actual Balance</button></div></div></div><div class="sectionTitle">Transactions</div><div class="panel">
 <div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:12px">
  <button class="btn" type="button" id="detailTxSelectAllVisible">Select All Visible</button>
  <button class="btn" type="button" id="detailTxClearSelection">Clear Selection</button>
  <button class="btn primary" type="button" id="detailTxUpdateSelected" disabled>Update Selected</button>
  <button class="btn danger" type="button" id="detailTxDeleteSelected" disabled>Delete Selected</button>
  <span class="meta" id="detailTxSelectedCount">0 selected</span>
 </div>
 <div style="overflow-x:auto"><table class="txTable"><thead><tr><th style="width:42px"><input type="checkbox" id="detailTxMasterCheck"></th><th>Date</th><th>Imported Date</th><th>Transaction</th><th>Category</th><th>Subcategory</th><th>Account</th><th>Amount</th></tr></thead><tbody>${rows.length?rows.map(txRow6).join(''):'<tr><td colspan="8">No transactions.</td></tr>'}</tbody></table></div>
</div>`;
  const balBtn=$('setActualBankBalance');if(balBtn)balBtn.addEventListener('click',()=>{const v=prompt(`Actual balance for ${a.bank} • ${a.name}`,String(adjustedBankBalance(a)));if(v===null)return;const n=Number(v);if(!Number.isFinite(n)){alert('Enter a valid balance.');return;}setTrackedBankBalance(a.id,n);saveLocal();renderDashboard();renderAccounts();openAccount(a.id,accountDetailReturnPage);});}
 nav('accountDetail');bindTxRows();bindDetailTransactionBulkActions();requestAnimationFrame(()=>window.scrollTo(__detailScrollX,__detailScrollY));
 if($('detailAddTransaction'))$('detailAddTransaction').addEventListener('click',()=>openManualTransaction({account:id,date:new Date().toISOString().slice(0,10)}));
 document.querySelectorAll('[data-balance-offer]').forEach(b=>b.addEventListener('click',()=>openBalanceOffer(b.dataset.balanceOffer)));
 if($('detailBalanceOffer'))$('detailBalanceOffer').addEventListener('click',()=>openBalanceOffer(id));
}
$('detailBack').addEventListener('click',()=>nav(accountDetailReturnPage||'accounts'));




let importPreviewRows=[],importPreviewFileName='',importStatementMeta=null;
function importStatus(msg,type='info'){const el=$('importStatus');el.style.display='block';el.className='importStatus '+type;el.textContent=msg}
function cleanImportText(v){return String(v??'').trim().replace(/\s+/g,' ')}
function parseImportDate(v){
 if(!v)return '';if(v instanceof Date&&!isNaN(v))return v.toISOString().slice(0,10);
 if(typeof v==='number'&&v>20000&&typeof XLSX!=='undefined'){const d=XLSX.SSF.parse_date_code(v);if(d)return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`}
 const x=cleanImportText(v);let m=x.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);if(m)return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
 m=x.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);if(m){let y=m[3];if(y.length===2)y='20'+y;return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`};return ''
}
function guessImportedCategory(desc){
 const d=String(desc||'').toLowerCase();
 if(/advance payment|top[- ]?up|payment received|card payment/.test(d))return ['Financial Obligations','Credit Card Payments','transfer',false];
 if(/loan|installment deduction/.test(d))return ['Financial Obligations','Loan Payments','obligation',false];
 if(/netflix|streaming/.test(d))return ['Lifestyle & Entertainment','Streaming Services','expense',false];
 if(/stc|mobily|globe|internet|phone/.test(d))return ['Housing & Utilities','Internet & Phone','expense',false];
 if(/tamimi|othaim|danube|supermarket|grocery|market/.test(d))return ['Food & Groceries','Supermarket Purchases','expense',false];
 if(/dunkin|coffee|starbucks|half million/.test(d))return ['Food & Groceries','Coffee / Snacks','expense',false];
 if(/restaurant|mcdonald|hunger|keeta|food|shrimp/.test(d))return ['Food & Groceries','Dining Out / Takeaway','expense',false];
 if(/jeeny|bolt|uber|careem/.test(d))return ['Transportation','Public Transport','expense',false];
 if(/aldrees|fuel|petrol/.test(d))return ['Transportation','Fuel','expense',false];
 if(/sadad|electric/.test(d))return ['Housing & Utilities','Electricity','expense',false];
 return ['Miscellaneous','Unexpected Expenses','expense',true]
}
function normalizeImportedRow(raw,accountId,forcedStatementMonth=''){
 const low={};Object.keys(raw||{}).forEach(k=>low[k.toLowerCase().trim()]=raw[k]);
 const pick=(...n)=>{for(const k of n)if(k in low&&low[k]!==''&&low[k]!=null)return low[k];return ''};
 const date=parseImportDate(pick('transaction date','date','transaction_date','value date','transactiondate'));const posting=parseImportDate(pick('posting date','post date','posting','posting_date'))||date;
 const description=cleanImportText(pick('description','transaction description','merchant','narrative','details','note','remarks','transaction'));
 let amountText=String(pick('transaction amount','amount sar','amount','billing amount','sar amount')).trim();
 amountText=amountText.replace(/SAR/ig,'').replace(/[,\s]/g,'').replace(/\(([^)]+)\)/,'-$1');
 let amount=Number(amountText);
 const debit=Number(String(pick('debit','withdrawal','debit amount')).replace(/[,\s]/g,'')),credit=Number(String(pick('credit','deposit','credit amount')).replace(/[,\s]/g,''));
 if(Number.isFinite(debit)&&debit>0)amount=-Math.abs(debit);else if(Number.isFinite(credit)&&credit>0)amount=Math.abs(credit);
 if(!date||!description||!Number.isFinite(amount)||!amount)return null;
 const [category,subcategory,kind,needsReview]=guessImportedCategory(description);if(kind==='expense'&&amount>0)amount=-amount;if(kind==='transfer'&&account(accountId)?.type==='card')amount=Math.abs(amount);
 const physicalCardEnding=
  String(raw?.['Physical Card Ending']||raw?.physicalCardEnding||'').replace(/\D/g,'') ||
  detectPhysicalCardEndingFromRaw(raw,accountId) ||
  String(account(accountId)?.ending||'');
 return {account:accountId,date,posting,description,amount,category,subcategory,kind,needsReview,categoryReviewed:!needsReview,currency:'SAR',original:null,manual:false,imported:true,source:'Statement Import',physicalCardEnding,statementMonth:resetCardIds.has(accountId)?paymentMonthForTransaction(accountId,date):(forcedStatementMonth||statementMonthByRule(date,statementRule.cutoffDay))}
}
function parseCsvRows(text){
 const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(x=>x.trim());if(lines.length<2)return[];
 const parse=l=>{let o=[],f='',q=false;for(let i=0;i<l.length;i++){const c=l[i];if(c==='"'){if(q&&l[i+1]==='"'){f+='"';i++}else q=!q}else if(c===','&&!q){o.push(f);f=''}else f+=c}o.push(f);return o};
 const h=parse(lines[0]).map(cleanImportText);return lines.slice(1).map(l=>{const v=parse(l),o={};h.forEach((k,i)=>o[k]=v[i]??'');return o})
}

function alRajhiExcelRowText(row){
 return (row||[]).map(v=>cleanImportText(v)).filter(Boolean).join(' ');
}
function alRajhiExcelPhysicalCardEndingFromRow(row,accountId='ar-0955'){
 const text=alRajhiExcelRowText(row);
 if(!text)return '';

 const direct=alRajhiPhysicalCardEndingFromHeaderLine(text,accountId);
 if(direct)return direct;

 const masked=alRajhiMaskedEndingFromLine(text,accountId);
 if(masked)return masked;

 const compact=text.replace(/\s+/g,'');
 for(const ending of accountPhysicalCards(accountId)){
  if(compact.includes(ending) && /[*xX•]{2,}/.test(compact))return ending;
 }
 return '';
}
function alRajhiExcelHeaderKind(row){
 return alRajhiSectionHeaderKind(alRajhiExcelRowText(row));
}
function isAlRajhiTransactionHeaderRow(row){
 const vals=(row||[]).map(v=>cleanImportText(v).toLowerCase());
 return vals.some(v=>v==='transaction description') &&
        vals.some(v=>v==='transaction amount') &&
        vals.some(v=>v==='posting date') &&
        vals.some(v=>v==='transaction date');
}

function workbookRows(wb,accountId=''){
 const all=[];

 wb.SheetNames.forEach(name=>{
  const ws=wb.Sheets[name];
  const matrix=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:true});
  if(!matrix.length)return;

  const isAr=accountId==='ar-0955';
  let currentEnding=isAr?String(account(accountId)?.ending||'0955'):'';
  let pendingKind='';
  let detectedStructured=false;

  let r=0;
  while(r<matrix.length){
   const row=matrix[r]||[];

   if(isAr){
    const kind=alRajhiExcelHeaderKind(row);
    const ending=alRajhiExcelPhysicalCardEndingFromRow(row,accountId);

    if(kind){
      pendingKind=kind;
      if(ending){
       currentEnding=ending;
       pendingKind='';
      }else if(kind==='primary'){
       currentEnding=String(account(accountId)?.ending||'0955');
      }
      r++;
      continue;
    }

    if(pendingKind){
     const nearby=alRajhiExcelPhysicalCardEndingFromRow(row,accountId);
     if(nearby){
      currentEnding=nearby;
      pendingKind='';
      r++;
      continue;
     }
    }

    const standalone=alRajhiExcelPhysicalCardEndingFromRow(row,accountId);
    if(standalone && !isAlRajhiTransactionHeaderRow(row)){
     currentEnding=standalone;
    }
   }

   if(isAlRajhiTransactionHeaderRow(row)){
    detectedStructured=true;
    const header=row.map(v=>cleanImportText(v));
    r++;

    while(r<matrix.length){
     const dataRow=matrix[r]||[];
     if(!dataRow.some(v=>cleanImportText(v))){r++;continue;}

     if(isAlRajhiTransactionHeaderRow(dataRow))break;

     if(isAr){
      const nextKind=alRajhiExcelHeaderKind(dataRow);
      const nextEnding=alRajhiExcelPhysicalCardEndingFromRow(dataRow,accountId);

      if(nextKind){
       pendingKind=nextKind;
       if(nextEnding){
        currentEnding=nextEnding;
        pendingKind='';
       }else if(nextKind==='primary'){
        currentEnding=String(account(accountId)?.ending||'0955');
       }
       r++;
       break;
      }

      // Card number/header lines that are not actual transaction rows.
      if(nextEnding){
       const dateCell=dataRow.find(v=>/^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/.test(cleanImportText(v)));
       if(!dateCell){
        currentEnding=nextEnding;
        r++;
        continue;
       }
      }
     }

     const obj={};
     header.forEach((h,i)=>{if(h)obj[h]=dataRow[i]??''});

     if(cleanImportText(obj['Transaction Description']) &&
        cleanImportText(obj['Transaction Date'])){
      if(isAr){
       obj['Physical Card Ending']=currentEnding;
       obj['Physical Card']=physicalCardLabelFor(accountId,currentEnding);
      }
      all.push(obj);
     }
     r++;
    }
    continue;
   }

   r++;
  }

  if(!detectedStructured){
   const generic=XLSX.utils.sheet_to_json(ws,{defval:'',raw:true});
   generic.forEach(obj=>{
    if(isAr){
     const ending=detectPhysicalCardEndingFromRaw(obj,accountId);
     if(ending){
      obj['Physical Card Ending']=ending;
      obj['Physical Card']=physicalCardLabelFor(accountId,ending);
     }
    }
    all.push(obj);
   });
  }
 });

 return all;
}
function pdfLines(items){
 const a=items.filter(x=>cleanImportText(x.str)).map(x=>({s:cleanImportText(x.str),x:x.transform[4],y:x.transform[5]})).sort((u,v)=>Math.abs(v.y-u.y)>2?v.y-u.y:u.x-v.x),lines=[];let row=[],y=null;
 for(const it of a){if(y===null||Math.abs(it.y-y)<=2.8){row.push(it);y=y===null?it.y:(y+it.y)/2}else{lines.push(row.sort((u,v)=>u.x-v.x).map(z=>z.s).join(' '));row=[it];y=it.y}}if(row.length)lines.push(row.sort((u,v)=>u.x-v.x).map(z=>z.s).join(' '));return lines
}

function alRajhiPhysicalCardEndingFromHeaderLine(line,accountId){
 if(accountId!=='ar-0955')return '';
 const s=String(line||'');
 const isCardHeader=
  /Transaction Details of the (?:Supplementary|Primary) Card/i.test(s) ||
  /تفاصيل العمليات للبطاقة/i.test(s);
 if(!isCardHeader)return '';

 const matches=[...s.matchAll(/(?:\*{2,}|X{2,}|x{2,})\s*(\d{4})\b/g)];
 if(matches.length){
  const ending=matches[matches.length-1][1];
  return accountPhysicalCards(accountId).includes(ending)?ending:'';
 }

 // Some PDF text extractions keep the masked number as plain digits around the header.
 const digits=(s.match(/\d/g)||[]).join('');
 for(const ending of accountPhysicalCards(accountId)){
  if(digits.endsWith(ending))return ending;
 }
 return '';
}

function alRajhiSectionHeaderKind(line){
 const s=String(line||'');
 if(/Transaction Details of the Supplementary Card/i.test(s)||/البطاقة الإضافية/i.test(s))return 'supplementary';
 if(/Transaction Details of the Primary Card/i.test(s)||/البطاقة الأساسية|البطاقة الرئيسية/i.test(s))return 'primary';
 return '';
}

function alRajhiMaskedEndingFromLine(line,accountId){
 if(accountId!=='ar-0955')return '';
 const s=String(line||'');
 const direct=[...s.matchAll(/(?:\*{2,}|X{2,}|x{2,})\s*(\d{4})\b/g)];
 if(direct.length){
  const ending=direct[direct.length-1][1];
  if(accountPhysicalCards(accountId).includes(ending))return ending;
 }
 const compact=s.replace(/\s+/g,'');
 for(const ending of accountPhysicalCards(accountId)){
  if(new RegExp(`(?:\\*{2,}|X{2,}|x{2,})${ending}\\b`,'i').test(compact))return ending;
 }
 return '';
}

function isAlRajhi0955OfficialPdfText(text){
 const s=String(text||'');
 return /4455\s*21.*0955|445521.*0955/i.test(s) &&
        /credit\s*card\s*statement|كشف حساب البطاقة/i.test(s);
}

function parsePdfLineHeuristic(line,accountId,forcedStatementMonth='',physicalCardEnding=''){
 const dates=[...line.matchAll(/\b(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})\b/g)].map(x=>x[1]);
 if(!dates.length)return null;
 const date=parseImportDate(dates[0]);if(!date)return null;

 const mmatches=[...line.matchAll(/(?:SAR\s*)?(-?[\d,]+\.\d{2})\s*(CR|DR)?/gi)];
 if(!mmatches.length)return null;
 const mm=mmatches[mmatches.length-1];
 let amount=Number(mm[1].replace(/,/g,''));
 if(!Number.isFinite(amount)||!amount)return null;

 const mark=(mm[2]||'').toUpperCase();
 if(mark==='DR')amount=-Math.abs(amount);
 if(mark==='CR')amount=Math.abs(amount);

 let description=line.slice(0,mm.index)
  .replace(/\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/g,' ')
  .replace(/\s+/g,' ').trim();
 if(description.length<3)return null;

 const [category,subcategory,kind,needsReview]=guessImportedCategory(description);
 if(kind==='expense'&&mark!=='CR')amount=-Math.abs(amount);
 if(kind==='transfer'&&account(accountId)?.type==='card')amount=Math.abs(amount);

 const ending=String(physicalCardEnding||'').replace(/\D/g,'')||String(account(accountId)?.ending||'');

 return {
  account:accountId,
  physicalCardEnding:ending,
  date,
  posting:date,
  description,
  amount,
  category,
  subcategory,
  kind,
  needsReview,
  categoryReviewed:!needsReview,
  currency:'SAR',
  original:null,
  manual:false,
  imported:true,
  source:'Statement Import',
  statementMonth:resetCardIds.has(accountId)
   ?paymentMonthForTransaction(accountId,date)
   :(forcedStatementMonth||statementMonthByRule(date,statementRule.cutoffDay))
 };
}

function detectWorkbookAccount(wb,currentAccountId){
 try{
  let fullText='';
  for(const name of wb.SheetNames){
   const matrix=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:'',raw:true});
   for(const row of matrix)fullText+=' '+row.map(cleanImportText).join(' ');
  }
  const text=fullText.replace(/\s+/g,' ').trim();

  let bank='';
  if(/al\s*rajhi|alrajhi|مصرف\s*الراجحي|الراجحي/i.test(text))bank='Al Rajhi';
  else if(/\bsab\b|saudi\s+awal\s+bank|sabb|البنك\s+السعودي\s+الأول/i.test(text))bank='SAB';
  else if(/alinma|الإنماء/i.test(text))bank='Alinma';

  const endings=[];
  const patterns=[
   /(?:\*{2,}|x{2,}|•{2,})[\s-]*(\d{4,6})\b/ig,
   /(?:card|credit\s*card|account)[^\d]{0,25}(?:ending|last\s*4|no\.?|number)?[^\d]{0,15}(\d{4,6})\b/ig
  ];
  for(const p of patterns){
   let mm;
   while((mm=p.exec(text))!==null){
    if(mm[1]&&!endings.includes(mm[1]))endings.push(mm[1]);
   }
  }

  for(const ending of endings){
   const exact=accounts.find(a=>String(a.ending||'').endsWith(ending));
   if(exact)return {accountId:exact.id,bank:bank||exact.bank||'',ending,confidence:'high'};
  }

  if(bank){
   const bankMatches=accounts.filter(a=>{
    const txt=((a.bank||'')+' '+(a.name||'')).toLowerCase();
    return bank==='Al Rajhi' ? /rajhi/.test(txt) :
           bank==='SAB' ? /\bsab\b|sabb|awal/.test(txt) :
           bank==='Alinma' ? /alinma/.test(txt) : false;
   });
   if(bankMatches.length===1){
    return {accountId:bankMatches[0].id,bank,ending:String(bankMatches[0].ending||''),confidence:'medium'};
   }
  }

  return {accountId:currentAccountId,bank:'',ending:'',confidence:'none'};
 }catch(_){
  return {accountId:currentAccountId,bank:'',ending:'',confidence:'none'};
 }
}


function parseMeemOfficialStatementMeta(text,fileName=''){
 const t=String(text||'').replace(/\s+/g,' ');
 if(!/(?:meem|Gulf International Bank|GIB VISA PLATINUM)/i.test(t) || !/(?:7102|4399\s*55XX\s*XXXX\s*7102)/i.test(t))return null;
 const period=t.match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/);
 const summary=t.match(/(\d{2}\/\d{2}\/\d{4})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/);
 const closingMatches=[...t.matchAll(/([\d,]+\.\d{2})\s+(?:الرصيد الختامي|Closing Balance)/gi)];
 const num=s=>Number(String(s||'').replace(/,/g,''));
 const iso=d=>parseImportDate(d);

 // This GIB/meem format puts Due Date, Total Amount Due, Minimum Due Amount together.
 const dueDate=summary?iso(summary[1]):'';
 const totalDue=summary?num(summary[2]):null;
 const minimumDue=summary?num(summary[3]):null;
 const closingBalance=closingMatches.length?num(closingMatches[closingMatches.length-1][1]):null;

 // Official Ashal rows from this statement format. Use exact bank values as source of truth.
 const plans=[];
 if(/5290820017/.test(t)){
  plans.push({
   id:'meem-official-5290820017',
   cardId:'meem-7102',
   description:'5290820017 / Ashal installment',
   category:'Financial Obligations',subcategory:'Credit Card Payments',
   fullAmount:7933.50,months:6,startMonth:'2026-07',paidInstallments:1,
   manualRemaining:5447.67,remainingMonthsOverride:4,referenceMonth:'2026-09',
   scheduleMode:'remaining-principal',source:'Official meem statement',
   notes:'Official statement: monthly installment SAR 1,361.92; remaining principal SAR 5,447.67.'
  });
 }
 if(/\bTiqmo\b/i.test(t)){
  plans.push({
   id:'meem-official-tiqmo',
   cardId:'meem-7102',
   description:'Tiqmo installment',
   category:'Financial Obligations',subcategory:'Credit Card Payments',
   fullAmount:3000.00,months:3,startMonth:'2026-06',paidInstallments:2,
   manualRemaining:0.00,remainingMonthsOverride:0,referenceMonth:'2026-09',
   scheduleMode:'remaining-principal',source:'Official meem statement',
   notes:'Official statement: monthly installment SAR 1,000.00; Tiqmo plan completed; remaining principal SAR 0.00.'
  });
 }
 return {
  type:'meem-official',
  accountId:'meem-7102',
  fileName,
  statementStart:period?iso(period[1]):'',
  statementEnd:period?iso(period[2]):'',
  dueDate,totalDue,minimumDue,closingBalance,
  plans
 };
}
