const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
function fn(file,name){const s=fs.readFileSync(file,'utf8'),a=s.indexOf('function '+name+'('),b=s.indexOf('\nfunction ',a+1);assert(a>=0);return s.slice(a,b<0?undefined:b);}
let controls=[],saved=0;const elements={importBulkReviewBody:{dataset:{workspace:'owner'},querySelectorAll:()=>controls},importBulkReviewStatus:{}};
const c={window:{financeWorkspaceUserId:'owner'},categories:{Food:['Dining'],Shopping:['General']},merchantRules:{},importPreviewRows:[{description:'Shawarma House',amount:-150,date:'2026-11-12'},{description:'noon.com',amount:-226.75}],$:id=>elements[id],saveLocal:()=>saved++,closeModal(){},renderImportPreview(){},importStatus(){},isTopUpPaymentDescription:()=>false};
vm.createContext(c);
for(const [file,names]of [['app-06.js',['saveImportBulkReview']],['app-03.js',['financeMerchantRuleIndex','rememberedMerchantCategory','applyRememberedTransactionCategory']],['app-05.js',['guessImportedCategory','guessImportedCategoryDefault']]])for(const name of names)vm.runInContext(fn(file,name),c);
const control=(i,category,subcategory,checked)=>({dataset:{importReviewRow:String(i)},classList:{add(){},remove(){}},scrollIntoView(){},querySelector:s=>s.includes('subcategory')?{value:subcategory}:s.includes('category')?{value:category}:{checked}});
controls=[control(0,'Food','Dining',true),control(1,'Shopping','General',false)];
c.saveImportBulkReview();assert.equal(saved,1);assert.equal(c.merchantRules['Shawarma House'].futureOnly,true);assert.equal(c.merchantRules['noon.com'],undefined);
assert.equal(c.importPreviewRows[1].category,'Shopping');assert.equal(c.importPreviewRows[0].amount,-150);
assert.deepEqual(Array.from(c.guessImportedCategory('SHAWARMA HOUSE Riyadh')),['Food','Dining','expense',false]);
const old={description:'Shawarma House',category:'Shopping',subcategory:'General',amount:-20};c.applyRememberedTransactionCategory(old,{});assert.equal(old.category,'Shopping');
// Reloaded rules continue to classify new imports; existing manual overrides win.
c.merchantRules=JSON.parse(JSON.stringify(c.merchantRules));assert.equal(c.guessImportedCategory('Shawarma House')[0],'Food');
c.applyRememberedTransactionCategory(old,{category:'Shopping'});assert.equal(old.category,'Shopping');
// Invalid review is atomic; nothing is saved until every row is valid.
c.merchantRules={};saved=0;controls=[control(0,'Food','Dining',true),control(1,'Shopping','bad',false)];c.saveImportBulkReview();assert.equal(saved,0);assert.equal(Object.keys(c.merchantRules).length,0);
controls=[control(0,'Food','Dining',false),control(1,'Shopping','General',false)];c.saveImportBulkReview();assert.equal(saved,0);
// Conflicting selections for one merchant, view-only access and workspace switch.
c.importPreviewRows[1].description='shawarma house';controls=[control(0,'Food','Dining',true),control(1,'Shopping','General',true)];c.saveImportBulkReview();assert.equal(saved,0);
controls=[control(0,'Food','Dining',true)];c.window.financeSectionPermission=()=> 'view';c.saveImportBulkReview();assert.equal(saved,0);
c.window.financeSectionPermission=()=> 'edit';c.window.financeWorkspaceUserId='other';c.saveImportBulkReview();assert.equal(saved,0);
// UI defaults to opt-out, with no save triggered by merely opening the review.
const ui=fn('app-06.js','openImportBulkReview');assert.match(ui,/type="checkbox" data-import-review-remember/);assert.doesNotMatch(ui,/\bchecked\b|saveLocal\(/);
console.log('PASS optional merchant memory: per-row opt-in, future import/reload, historical categories and amounts unchanged, opt-out, validation, conflicts, permission and workspace guards');
