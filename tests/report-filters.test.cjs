const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../app-04.js'),'utf8');
const ids=['reportFrom','reportTo','reportAccount','reportPhysicalCard','reportCategory','reportSubcategory','reportType','reportReset','clearReportSelection'];
const elements=Object.fromEntries(ids.map(id=>[id,{value:'',dataset:{},listeners:{},addEventListener(type,fn){this.listeners[type]=fn}}]));
let rendered=0,categoryOptions=0;
const ctx={
 $:id=>elements[id],reportDrill:{type:'',value:''},renderReports:()=>{rendered++},
 fillReportSubcategories:()=>{categoryOptions++},setReportCurrentMonthDates:()=>{elements.reportFrom.value='2026-09-01';elements.reportTo.value='2026-09-27'}
};
vm.createContext(ctx);
vm.runInContext(source.slice(source.indexOf('function bindReportFilters(){'),source.indexOf('function deleteInstallmentPlan(id){')),ctx);
for(const id of ids.slice(0,7)){
 ctx.reportDrill={type:'category',value:'Old'};
 elements[id].value=id==='reportSubcategory'?'Supermarket Purchases':'selected';
 elements[id].listeners.change();
 assert.equal(ctx.reportDrill.type,'',`${id} clears a stale chart drill`);
}
assert.equal(rendered,7,'every report filter renders after change');
assert.equal(categoryOptions,1,'category refreshes subcategory choices');
elements.reportReset.listeners.click();
assert.equal(elements.reportSubcategory.value,'');
assert.equal(elements.reportFrom.value,'2026-09-01');
assert.equal(rendered,8);
ctx.reportDrill={type:'subcategory',value:'Supermarket Purchases'};
elements.clearReportSelection.listeners.click();
assert.equal(ctx.reportDrill.type,'');
assert.equal(rendered,9);
ctx.bindReportFilters();
assert.equal(Object.keys(elements.reportSubcategory.listeners).length,1,'binding is idempotent');
console.log('Reports date, account, card, category, subcategory, type, reset and drill controls rerender.');
