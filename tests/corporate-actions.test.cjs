const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const store=new Map([
 ['pf_investments_holdings',JSON.stringify([{ticker:'RIO',company:'Rio Tinto',market:'US',qty:8,avg:69.39,price:94.56,ledgerBaseQty:8,ledgerBaseAvg:69.39}])],
 ['pf_investments_trades','[]']
]);
const document={head:{appendChild(){}},getElementById(){return null},createElement(){return {style:{}}}};
const context={document,window:{financeActiveUserId:'user',financeIsOwner:true},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},Intl,Date,Math,JSON,Number,String,Array,Object,confirm:()=>true,scheduleRecordPush(){},console};
vm.createContext(context);vm.runInContext(fs.readFileSync('app-09.js','utf8'),context);
const base=8*69.39;
context.invTrades.push({id:'bonus',_cloudRecordId:'bonus',type:'BONUS',ticker:'RIO',qty:2,price:0,date:'2026-09-24',payDate:'2026-09-24',actionStatus:'pending',createdAt:'2026-09-24T12:00:00Z'});
assert.equal(context.invCalculatedHolding('RIO').qty,8,'pending allocation does not change shares');
context.renderInvestments=()=>{};
context.invConfirmAction('bonus');
assert.equal(context.invHoldings[0].qty,10);
assert.equal(Math.round(context.invHoldings[0].qty*context.invHoldings[0].avg*100)/100,base,'bonus preserves total cost');
assert.equal(context.invHoldings[0].price,94.56,'bonus does not rewrite market price');
context.invConfirmAction('bonus');assert.equal(context.invHoldings[0].qty,10,'repeat confirmation is idempotent');
context.invTrades.push({id:'div',_cloudRecordId:'div',type:'DIVIDEND',ticker:'RIO',qty:8,price:2.11,date:'2026-09-24',payDate:'2026-09-24',actionStatus:'pending'});
assert.equal(context.invCalculatedHolding('RIO').qty,10,'dividend does not alter shares');
context.invConfirmAction('div');assert.equal(context.invTrades.at(-1).actionStatus,'received');
assert.equal(context.invCalculatedHolding('RIO').qty,10);
context.invTrades=context.invTrades.filter(x=>x.id!=='bonus');context.invRebuildHolding('RIO');
assert.equal(context.invHoldings[0].qty,8);
assert.equal(Math.round(context.invHoldings[0].avg*100)/100,69.39,'reversing bonus restores average cost');
console.log('Corporate actions: due confirmation, idempotency, zero-cost shares, dividend isolation and reversal passed.');
