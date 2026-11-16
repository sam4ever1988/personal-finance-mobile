const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const s2=fs.readFileSync('app-02.js','utf8'),s8=fs.readFileSync('app-08.js','utf8');
function fn(s,name){const start=s.indexOf('function '+name+'('),end=s.indexOf('\nfunction ',start+1);assert(start>=0,name);return s.slice(start,end);}
let balance=1000,form;
const c={cardPaymentPlan:[],cashFlowLedger:[],outgoings:[],localStorage:{setItem(){}},
 financeRoundMoney:n=>Math.round(n*100)/100,accountName:x=>x,account:id=>({id,type:id==='bank'?'bank':'card'}),
 adjustedBankBalance:()=>balance,setTrackedBankBalance:(_,v)=>{balance=v;},paymentBudgetMonth:h=>h.budgetMonth||h.date.slice(0,7),
 incomeMonthKey:d=>String(d).slice(0,7),releasedPaymentRowPriority:p=>p.official?10:0,paymentPaidAmount:p=>p.paidAmount||0,
 transferInstallmentPlan:()=>null,openUnifiedAction:f=>{form=f;},financeBaseCurrency:()=> 'SAR',money:String,
 alert:m=>{throw Error(m);},confirm:()=>true,goldActionError:m=>{throw Error(m);},
 saveCardPaymentPlan(){},saveLocal(){},syncCardPaymentPlanImmediate(){},syncCashFlowLedgerImmediate(){},refreshPaymentActivityAccount(){}};
vm.createContext(c);
for(const name of ['cardPaymentHistoryMatchesLedger','cashFlowLedgerKey','addCashFlowLedgerEntry','migrateCashFlowLedger','ledgerRowsForCardCycle','paymentActualAmount'])vm.runInContext(fn(s2,name),c);
c.paymentRemainingAmount=p=>Math.max(0,p.amount-c.paymentActualAmount(p));
for(const name of ['paymentActivityLedgerRow','paymentActivityCardHistory','syncEditedCardPaymentActivity','reverseCardPaymentActivity','editAccountPaymentActivity','deleteAccountPaymentActivity'])vm.runInContext(fn(s8,name),c);
const first={id:'original',type:'card-payment',targetId:'card',sourceId:'bank',date:'2026-11-11',month:'2026-11',targetPaymentMonth:'2026-11',amount:100,status:'active',referenceId:'payment:old-plan:timestamp:100.00'};
const history={ledgerId:'original',referenceId:first.referenceId,amount:100,date:first.date,sourceId:'bank',duePortion:100,restoredFromLedger:true};
c.cashFlowLedger=[{...first},{...first,id:'duplicate',referenceId:'payment:new-plan:timestamp:100.00'}];
c.cardPaymentPlan=[{id:'official',official:true,accountId:'card',month:'2026-11',amount:100,paidAmount:200,paymentHistory:[{...history}]},{id:'old-plan',accountId:'card',month:'2026-11',amount:100,paidAmount:100,paymentHistory:[{...history}]}];
// Both linked restored history and an orphan duplicate are editable directly.
c.editAccountPaymentActivity('original');form.submit({amount:'90',date:'2026-11-12'});
assert.equal(c.cashFlowLedger[0].amount,90);assert.equal(balance,1010);assert.equal(c.cardPaymentPlan[0].paymentHistory[0].amount,90);assert.equal(c.cardPaymentPlan[1].paymentHistory[0].date,'2026-11-12');
assert.equal(c.migrateCashFlowLedger(),0);assert.equal(c.cashFlowLedger.length,2);
c.editAccountPaymentActivity('duplicate');form.submit({amount:'80',date:'2026-11-11'});assert.equal(balance,1030);assert.equal(c.cashFlowLedger[1].amount,80);
// Delete exactly the selected orphan, retaining the real same-date payment.
c.deleteAccountPaymentActivity('duplicate');assert.equal(c.cashFlowLedger[1].status,'reversed');assert.equal(c.cashFlowLedger[0].status,'active');assert.equal(balance,1110);assert.equal(c.cardPaymentPlan[0].paidAmount,90);assert.equal(c.migrateCashFlowLedger(),0);
assert.equal(c.reverseCardPaymentActivity(c.cashFlowLedger[1]),false);assert.equal(balance,1110);
c.deleteAccountPaymentActivity('original');assert.equal(balance,1200);assert.equal(c.cardPaymentPlan[0].paidAmount,0);assert.equal(c.cardPaymentPlan[1].paymentHistory.length,0);assert.equal(c.migrateCashFlowLedger(),0);
// Stale history of a reversed payment cannot recreate it on reload/migration.
c.cardPaymentPlan[0].paymentHistory=[{...history}];assert.equal(c.migrateCashFlowLedger(),0);assert.equal(c.cashFlowLedger.length,2);
// Legacy referenceId and ledgerReferenceId aliases both retain their identity.
for(const field of ['referenceId','ledgerReferenceId']){
 c.cardPaymentPlan[0].paymentHistory=[{amount:100,date:first.date,sourceId:'bank',[field]:first.referenceId}];
 assert.equal(c.paymentActivityCardHistory(c.cashFlowLedger[0]).plan.id,'official');assert.equal(c.migrateCashFlowLedger(),0);
}
console.log('PASS payment activity: restored reference aliases, orphan edit/delete, precise duplicate selection, linked histories, bank delta once, reversal and migration without resurrection');
