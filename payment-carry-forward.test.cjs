const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('app-02.js','utf8');
function fn(s,name){const start=s.indexOf('function '+name+'('),end=s.indexOf('\nfunction ',start+1);assert(start>=0);return s.slice(start,end<0?undefined:end);}
const c={cardPaymentPlan:[],cashFlowLedger:[],financeRoundMoney:n=>Math.round(n*100)/100,plannerAmountForRow:p=>p.amount??0,releasedPaymentRowPriority:p=>p.official?10:0,isGenuineReleasedStatementRow:p=>!!p.official,importedOfficialPlannerRow:()=>null,paymentPaidAmount:p=>p.paidAmount||0,addMonthsToYM:(m,n)=>{const d=new Date(m+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+n);return d.toISOString().slice(0,7)}};
vm.createContext(c);for(const name of ['ledgerRowsForCardCycle','paymentActualAmount','cardPaymentCarryForward','paymentRemainingAmount'])vm.runInContext(fn(source,name),c);
const row=(month,amount,paid=0)=>({id:month,accountId:'meem',month,amount,paidAmount:paid,paymentHistory:paid?[{amount:paid,duePortion:paid,extraCredit:0}]:[]});
const oct=row('2026-10',2115.30,4960.30),nov=row('2026-11',4046.92),dec=row('2026-12',3976.92);
c.cardPaymentPlan=[oct,nov,dec];
assert.equal(c.cardPaymentCarryForward(oct).carriedForward,2845);assert.equal(c.paymentRemainingAmount(nov),1201.92);assert.equal(c.cardPaymentCarryForward(nov).applied,2845);assert.equal(c.paymentRemainingAmount(dec),3976.92);
// Paying the reduced November due consumes the credit once and leaves December intact.
nov.paymentHistory=[{amount:1201.92,duePortion:1201.92}];nov.paidAmount=1201.92;assert.equal(c.paymentRemainingAmount(nov),0);assert.equal(c.paymentRemainingAmount(dec),3976.92);
for(let i=0;i<5;i++){c.cardPaymentPlan=JSON.parse(JSON.stringify([oct,nov,dec]));assert.equal(c.paymentRemainingAmount(nov),0);assert.equal(c.paymentRemainingAmount(dec),3976.92);}
// A bank-confirmed November amount already includes the prior credit.
nov.official=true;nov.amount=1201.92;nov.paymentHistory=[];nov.paidAmount=0;c.cardPaymentPlan=[oct,nov,dec];assert.equal(c.paymentRemainingAmount(nov),1201.92);assert.equal(c.cardPaymentCarryForward(nov).balanceCredit,0);
// Excess spanning multiple months, ledger/history mirror, account isolation, duplicates.
const a=row('2026-01',100,500),b=row('2026-02',150),d=row('2026-03',300);c.cardPaymentPlan=[a,b,d,{...a,id:'duplicate'},{...row('2026-01',1,9999),accountId:'other'}];
c.cashFlowLedger=[{id:'payment',type:'card-payment',targetId:'meem',targetPaymentMonth:'2026-01',amount:500,status:'active'}];assert.equal(c.paymentRemainingAmount(b),0);assert.equal(c.paymentRemainingAmount(d),50);
// An edit/converted purchase re-evaluates surplus, without changing payment history.
a.amount=200;assert.equal(c.paymentRemainingAmount(d),150);
// Reversed payments do not continue as carried credit.
a.paymentHistory=[{amount:500,ledgerId:'payment'}];c.cashFlowLedger[0].status='reversed';assert.equal(c.paymentRemainingAmount(b),150);
// Unknown/reset history must not manufacture an overpayment.
c.cashFlowLedger=[];c.cardPaymentPlan=[row('2026-01',0,500),b];assert.equal(c.paymentRemainingAmount(b),150);
console.log('PASS carry-forward: SAR 2845 -> November SAR 1201.92, payment, reload, future months, official statement, multi-month surplus, mirror deduplication, account isolation, edits, reversal, reset history');
// Exercise utilization accounting with the same carried credit: current paid
// amounts and surplus must not both release the same debt.
const s3=fs.readFileSync('app-03.js','utf8');
Object.assign(c,{cardFundedPaymentBreakdown:()=>[],liveUnreleasedTransactionRows:()=>[],assignedTransactionPaymentMonth:(_,t)=>t.month,installmentAmountForPaymentMonth:()=>0});
vm.runInContext(fn(s3,'recordedCardPaymentCredit'),c);
c.cardPaymentPlan=[oct,row('2026-11',4046.92),dec];c.cashFlowLedger=[];
assert.equal(c.recordedCardPaymentCredit('meem'),2845);
// Simulate payment of November's net due; gross billed principal remains until
// actual payment plus carried credit settle it, then December owes its own dues.
const netPaid=row('2026-11',4046.92,1201.92);c.cardPaymentPlan=[oct,netPaid,dec];
c.installmentAmountForPaymentMonth=(_,month)=>month==='2026-11'?3976.92:0;
c.liveUnreleasedTransactionRows=()=>[{month:'2026-11',amount:-70}];
assert.equal(c.recordedCardPaymentCredit('meem'),4046.92);
const official=row('2026-11',1201.92);official.official=true;c.cardPaymentPlan=[oct,official,dec];
assert.equal(c.recordedCardPaymentCredit('meem'),0);
console.log('PASS utilization credits: October surplus and November cash counted once; official net statement absorbs old credit');
