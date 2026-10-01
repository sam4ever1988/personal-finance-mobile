const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync(__dirname+'/app-06.js','utf8');
function fn(name){const start=source.indexOf('function '+name+'('),end=source.slice(start+1).search(/\n(?:async )?function /);assert(start>=0);return source.slice(start,end<0?source.length:start+1+end);}
function fixture(){
 const loan={id:'loan-one',name:'Personal Loan',monthly:1000,remainingAmount:3000,remainingMonths:3,status:'active',referenceMonth:'2026-09',defaultPaymentAccountId:'bank-a'},balances={'bank-a':5000,'bank-b':2000},storage=new Map();
 const c={financeRoundMoney:n=>Math.round(n*100)/100,financeMoneyStep:()=>'.01',financeBaseCurrency:()=>'SAR',console,Date,Math,JSON,Number,window:{},financeSettings:{loans:[loan]},cashFlowLedger:[],accounts:[{id:'bank-a',type:'bank'},{id:'bank-b',type:'bank'}],localStorage:{setItem:(k,v)=>storage.set(k,v)},currentIncomeMonth:()=> '2026-09',currentYearMonth:()=> '2026-09',account:id=>c.accounts.find(a=>a.id===id),accountName:id=>id,adjustedBankBalance:a=>balances[a.id],setTrackedBankBalance:(id,v)=>balances[id]=v,saveRecoverySnapshot:()=>{},saveLocal:()=>{},renderIncomePlan:()=>{},renderDashboard:()=>{},renderAccounts:()=>{},scheduleRecordPush:()=>{},addCashFlowLedgerEntry:r=>c.cashFlowLedger.push(r),reverseCashFlowLedgerByReference:ref=>c.cashFlowLedger.filter(r=>r.referenceId===ref).forEach(r=>r.status='reversed'),openUnifiedAction:cfg=>c.modal=cfg,goldActionError:msg=>{throw new Error(msg)},$:()=>null};
 vm.createContext(c);for(const name of ['rollLoanToMonth','rollAllLoansToMonth','loanPaymentsForMonth','loanInstallmentDue','saveConfirmedLoanChanges','confirmLoanPayment','undoConfirmedLoanPayment','openLoanPaymentConfirmation','totalFixedLoans'])vm.runInContext(fn(name),c);
 c.renderSavedLoanSummary=()=>{};c.renderIncomeLoanGrid=()=>{};
 return {c,loan,balances,storage};
}
const pay=(amount=1000,month='2026-10',sourceId='bank-a')=>({amount,installmentMonth:month,date:'2026-09-30',sourceId});
const a=fixture();a.c.rollLoanToMonth(a.loan,'2027-01');assert.equal(a.loan.remainingAmount,3000);assert.equal(a.loan.remainingMonths,3);
a.c.openLoanPaymentConfirmation(a.loan.id);assert.equal(a.c.modal.fields.find(f=>f.name==='sourceId').value,'bank-a');
assert(a.c.confirmLoanPayment(a.loan.id,pay(),'payment-one'));assert.equal(a.loan.remainingAmount,2000);assert.equal(a.loan.remainingMonths,2);assert.equal(a.balances['bank-a'],4000);assert.equal(a.loan.paymentHistory[0].installmentMonth,'2026-10');assert.equal(a.loan.paymentHistory[0].date,'2026-09-30');
assert(a.c.confirmLoanPayment(a.loan.id,pay(),'payment-one'));assert.equal(a.balances['bank-a'],4000);assert.equal(a.loan.paymentHistory.length,1);
assert.throws(()=>a.c.confirmLoanPayment(a.loan.id,pay(),'duplicate-month'),/unpaid/);assert.equal(a.c.cashFlowLedger.length,1);
a.c.undoConfirmedLoanPayment(a.loan.id,'payment-one');assert.equal(a.loan.remainingAmount,3000);assert.equal(a.loan.remainingMonths,3);assert.equal(a.balances['bank-a'],5000);assert.equal(a.c.undoConfirmedLoanPayment(a.loan.id,'payment-one'),false);
const b=fixture();b.c.confirmLoanPayment(b.loan.id,pay(400,'2026-10','bank-b'),'partial-one');assert.equal(b.loan.remainingMonths,3);b.c.confirmLoanPayment(b.loan.id,pay(600,'2026-10','bank-b'),'partial-two');assert.equal(b.loan.remainingMonths,2);assert.equal(b.balances['bank-b'],1000);
b.c.undoConfirmedLoanPayment(b.loan.id,'partial-one');assert.equal(b.loan.remainingMonths,3);assert.equal(b.loan.remainingAmount,2400);b.c.undoConfirmedLoanPayment(b.loan.id,'partial-two');assert.equal(b.loan.remainingMonths,3);assert.equal(b.balances['bank-b'],2000);
const d=fixture();d.loan.remainingAmount=500;d.c.confirmLoanPayment(d.loan.id,pay(500,'2026-09',''),'final');assert.equal(d.loan.status,'closed');assert.equal(d.loan.remainingMonths,0);assert.equal(d.balances['bank-a'],5000);assert.equal(d.c.totalFixedLoans(),500);d.c.undoConfirmedLoanPayment(d.loan.id,'final');assert.equal(d.loan.status,'active');assert.equal(d.loan.remainingMonths,3);
assert.throws(()=>d.c.confirmLoanPayment(d.loan.id,{...pay(),date:'2026-02-30'},'bad-date'),/date/);
const e=fixture();e.c.window.financeSectionPermission=()=> 'view';assert.throws(()=>e.c.confirmLoanPayment(e.loan.id,pay(),'unauthorized'),/permission/);
console.log('PASS: no calendar deductions, early installment assignment, default account and override, idempotent confirmation, duplicate month prevention, partial payments, undo refunds, final payoff, tracking-only, dates and permissions');

