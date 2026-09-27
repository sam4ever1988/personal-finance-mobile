const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const slice=(source,from,to)=>source.slice(source.indexOf(from),source.indexOf(to,source.indexOf(from)));
const accounts=[{id:'bank',type:'bank'},{id:'card',type:'card'}],cashFlowLedger=[];
let form,updates=0;
const context={accounts,cashFlowLedger,Date,Math,Number,String,
 account:id=>accounts.find(a=>a.id===id),accountName:id=>id,
 openUnifiedAction:cfg=>{form=cfg},goldActionError:message=>{throw Error(message)},
 adjustedBankBalance:()=>50,cardMetrics:()=>({available:500}),
 addCashFlowLedgerEntry:entry=>cashFlowLedger.push({...entry,status:'active',month:entry.date.slice(0,7)}),
 saveLocal:()=>{},syncCashFlowLedgerImmediate:()=>{updates++},refreshAccountDependentUI:()=>{},renderIncomePlan:()=>{},
 cardActiveCycleMonth:()=> '2026-09',liveCardTransactions:()=>[],
 paymentMonthForTransaction:()=> '2026-09',cardCycleHasStatement:()=>false,
 cardPaymentPlan:[],transactionAmountForPaymentMonthAll:()=>0,installmentAmountForPaymentMonth:()=>0,
 liveUnreleasedTransactionRows:()=>[]
};
vm.createContext(context);
vm.runInContext(slice(read('app-08.js'),'function openBankTransfer(){','function bindCustomAccountButtons(){'),context);
vm.runInContext(slice(read('app-02.js'),'function bankTransferImpact(accountId){','function adjustedBankBalance(a){'),context);
vm.runInContext(slice(read('app-03.js'),'function cardFundedPaymentBreakdown(cardId){','function cardCreditBreakdown(cardId){'),context);
context.openBankTransfer();
assert.ok(form.fields.find(f=>f.name==='sourceId').options.some(o=>o.value==='card'));
assert.equal(form.submit({sourceId:'card',targetId:'bank',amount:'100',date:'2026-09-27',note:'Cash transfer'}),true);
assert.equal(cashFlowLedger[0].type,'card-bank-transfer');
assert.equal(context.bankTransferImpact('bank'),100);
assert.equal(context.cardFundedPaymentUsage('card'),100);
assert.equal(updates,1);
cashFlowLedger[0].status='reversed';
assert.equal(context.bankTransferImpact('bank'),0);
assert.equal(context.cardFundedPaymentUsage('card'),0);
assert.throws(()=>form.submit({sourceId:'card',targetId:'bank',amount:'501',date:'2026-09-27'}),/available credit/);
console.log('Card-to-bank transfer increases bank balance, uses card credit, syncs once and reverses cleanly.');
