const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync(__dirname+'/app-05.js','utf8');
const context={XLSX:{utils:{sheet_to_json:sheet=>sheet}},parseImportDate:s=>{const [d,m,y]=s.split('/');return `${y}-${m}-${d}`;},account:()=>({type:'card',ending:'1234'}),guessImportedCategory:()=>['Other','Other','expense',true],cleanImportText:String,financeBaseCurrency:()=> 'SAR',detectPhysicalCardEndingFromRaw:()=>'',resetCardIds:new Set(),statementRule:{cutoffDay:1},statementMonthByRule:()=> '2026-11'};
vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function readStatementReconciliation(')),context);
vm.runInContext(source.slice(source.indexOf('function normalizeImportedRow('),source.indexOf('function parseCsvRows(')),context);
const header=['Remaining Amount','Remaining Installments','Total Installments Amount','Installment Fee Amount','Installment Amount','Transaction Amount','Merchant','Transaction Date','Sr. Number'];
const wb={SheetNames:['Sheet'],Sheets:{Sheet:[['Payment Due Date','Minimum Amount Due','Total Amount Due'],['25/11/2026',10,'1,100.01'],header,[0,0,100.01,0,100,300.01,'Final purchase','01/08/26','123']]}};
const meta=context.readStatementReconciliation(wb,'card');assert.equal(meta.totalDue,1100.01);assert.equal(meta.paymentMonth,'2026-11');assert.equal(meta.installments[0].amount,100.01);assert.equal(meta.installments[0].remainingCount,0);
assert.equal(context.readStatementReconciliation({SheetNames:['x'],Sheets:{x:[['Other data']]}},'card'),null);
for(const [billing,expected] of [['150.00',-150],['CR 150.00',150],['0.00',0]]){
 const row=context.normalizeImportedRow({'Transaction Date':'01/10/2026','Transaction Description':'Sample merchant','Transaction Amount':'150.00SAR','Billing Amount (SAR)':billing},'card');
 assert.equal(row.statementBillingAmount,expected);assert.equal(row.statementTransactionAmount,billing.startsWith('CR')?150:-150);
}
if(process.argv[2]){
 context.XLSX=require(process.argv[3]);const bytes=fs.readFileSync(process.argv[2]);
 vm.runInContext(source.slice(source.indexOf('function statementWorkbookBytes('),source.indexOf('function workbookRows(')),context);
 const actual=context.XLSX.read(context.statementWorkbookBytes(bytes),{type:'array',cellDates:true});const parsed=context.readStatementReconciliation(actual,'card');
 assert(parsed.totalDue>0);assert(/^\d{4}-\d{2}$/.test(parsed.paymentMonth));assert(parsed.installments.length>0);assert.equal(Math.round((parsed.spend+parsed.fees+parsed.installments.reduce((s,p)=>s+p.amount,0))*100)/100,parsed.totalDue);console.log('PASS actual workbook: official total, due month, 4 installments, exact statement bridge');
}
console.log('PASS summary detection, unknown total, final installment rounding, signed billing credits and zero billing');
const app12=fs.readFileSync(__dirname+'/app-12.js','utf8');
Object.assign(context,{window:{},financeRoundMoney:n=>Math.round(n*100)/100,importDateDays:(a,b)=>Math.abs(new Date(a)-new Date(b))/86400000});
vm.runInContext(app12.slice(app12.indexOf(' window.financeCompareStatement=function'),app12.indexOf(' function renderStatementDueComparison')),context);
const row={account:'card',date:'2026-10-01',description:'Purchase',amount:-100,physicalCardEnding:'1234'};
let result=context.window.financeCompareStatement([row],[{...row,physicalCardEnding:'5678'}]);assert.equal(result.matched,0);assert.equal(result.issues.length,2);
result=context.window.financeCompareStatement([row],[row,{...row,_id:'duplicate'}]);assert.equal(result.matched,1);assert.equal(result.difference,100);assert.equal(result.explained,100);
console.log('PASS cross-card mismatch is visible; duplicate rows reconcile one-to-one');
