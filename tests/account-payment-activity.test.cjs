const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../app-05.js'),'utf8');
const start=source.indexOf('function accountPaymentActivityRows(');
const end=source.indexOf('function importedOfficialStatementMonths(',start);
assert.ok(start>=0&&end>start);
const accounts=[{id:'bank-a',type:'bank'},{id:'bank-b',type:'bank'},{id:'card-a',type:'card'}];
const context={
 account:id=>accounts.find(a=>a.id===id),accountName:id=>id,
 accountDetailTxFilter:{month:'',fromDate:'',toDate:'',physicalCard:''},
 cardMonthLabel:month=>month,
 paymentMonthForTransaction:()=> '2026-10',
 cardPaymentPlan:[{id:'old-plan',accountId:'card-a',month:'2026-08',paymentHistory:[{date:'2026-08-01',amount:12,sourceId:'bank-a'}]},
  {id:'modern-plan',accountId:'card-a',month:'2026-10',paymentHistory:[{date:'2026-09-24',amount:100,sourceId:'bank-a'}]}],
 cashFlowLedger:[
  {id:'payment',type:'card-payment',date:'2026-09-24',amount:100,sourceId:'bank-a',targetId:'card-a',targetPaymentMonth:'2026-10',status:'active'},
  {id:'transfer',type:'bank-transfer',date:'2026-09-25',amount:50,sourceId:'bank-a',targetId:'bank-b',status:'active'},
  {id:'outgoing',type:'outgoing-payment',date:'2026-09-26',amount:30,sourceId:'bank-a',targetId:'bill-a',description:'Father Car',status:'active'},
  {id:'undone',type:'card-payment',date:'2026-09-27',amount:15,sourceId:'bank-a',targetId:'card-a',status:'reversed'}
 ],
 escapeHtml:String,money:n=>'SAR '+Number(n).toFixed(2)
};
vm.createContext(context);vm.runInContext(source.slice(start,end),context);
assert.equal(context.accountPaymentActivityRows('bank-a').length,4);
assert.equal(context.accountPaymentActivityRows('bank-b').length,1);
assert.equal(context.accountPaymentActivityRows('card-a').length,2);
assert.match(context.accountPaymentActivityHTML('bank-a'),/Paid.*bank-b/s);
assert.match(context.accountPaymentActivityHTML('bank-b'),/Received.*bank-a/s);
assert.doesNotMatch(context.accountPaymentActivityHTML('bank-a'),/undone/);
assert.match(context.accountPaymentActivityHTML('bank-a'),/<option value="">All months<\/option>/);
context.accountPaymentActivitySelection.month='2026-09';
assert.doesNotMatch(context.accountPaymentActivityHTML('bank-a'),/Historical card payment/);
context.accountPaymentActivitySelection.month='2026-08';
assert.match(context.accountPaymentActivityHTML('bank-a'),/Historical card payment/);
assert.doesNotMatch(context.accountPaymentActivityHTML('bank-a'),/Father Car/);
context.accountPaymentActivitySelection.month='';
context.accountDetailTxFilter.month='2026-09';
assert.equal(context.accountPaymentActivityRows('card-a').length,0);
context.accountDetailTxFilter.month='2026-10';
assert.equal(context.accountPaymentActivityRows('card-a').length,1);
console.log('Payments and transfers show on both involved accounts; reversed rows and card filters work.');
