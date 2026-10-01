const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync(__dirname+'/app-02.js','utf8');
function fn(name){const start=source.indexOf('function '+name+'('),end=source.slice(start+1).search(/\nfunction /);assert(start>=0);return source.slice(start,start+1+end);}
const saved=new Map(),bank={id:'bdo',type:'bank',balance:0},other={id:'other',type:'bank',balance:0};
const c={financeRoundMoney:n=>Math.round(n*100)/100,window:{financeAdditionalWorkspace:true},bankBalanceOverrides:{bdo:0},importedTransactions:[],transactionActions:{},txOverrides:{},cashFlowLedger:[],manualTransactions:[],paymentSourceImpact:()=>0,account:id=>id==='bdo'?bank:other,resetCardIds:new Set(),cardResetHistory:[],localStorage:{setItem:(k,v)=>saved.set(k,v)}};
vm.createContext(c);for(const n of ['manualAccountMovement','legacyAdjustedBankBalance','bankTransferImpact','bankStatementBalanceEnabled','bankStatementMovement','adjustedBankBalance','setTrackedBankBalance'])vm.runInContext(fn(n),c);
const balance=()=>c.adjustedBankBalance(bank);
c.importedTransactions=[{_id:'credit',account:'bdo',amount:120},{_id:'debit',account:'bdo',amount:-30}];assert.equal(balance(),90);
c.transactionActions.credit={status:'deleted'};assert.equal(balance(),-30);delete c.transactionActions.credit;assert.equal(balance(),90);
c.txOverrides.credit={amount:140};assert.equal(balance(),110);c.txOverrides.credit.account='other';assert.equal(balance(),-30);assert.equal(c.adjustedBankBalance(other),140);c.txOverrides={};
c.cashFlowLedger=[{type:'bank-transfer',sourceId:'other',targetId:'bdo',amount:20}];assert.equal(balance(),110);
c.setTrackedBankBalance('bdo',1000);assert.equal(balance(),1000);assert.equal(c.bankBalanceOverrides.bdo.statementAnchor,90);
c.importedTransactions.push({_id:'later',account:'bdo',amount:-10});assert.equal(balance(),990);
// A manual debit uses the existing save path and must not absorb or repeat imports.
c.setTrackedBankBalance('bdo',balance()-50);assert.equal(balance(),940);
c.transactionActions.later={status:'deleted'};assert.equal(balance(),950);delete c.transactionActions.later;assert.equal(balance(),940);
// Permanent batch removal, then re-import: each reverses/applies the net exactly once.
c.importedTransactions=[];assert.equal(balance(),860);c.importedTransactions=[{_id:'new-credit',account:'bdo',amount:120},{_id:'new-debit',account:'bdo',amount:-30},{_id:'new-later',account:'bdo',amount:-10}];assert.equal(balance(),940);
// Reload/cloud pull preserves the atomic balance+anchor, including shared readers.
c.bankBalanceOverrides=JSON.parse(saved.get('pf_bank_balance_overrides'));c.window.financeAdditionalWorkspace=false;assert.equal(balance(),940);
// Existing original workspace numeric balances retain their established semantics.
c.bankBalanceOverrides={bdo:500};assert.equal(balance(),520);assert.equal(c.setTrackedBankBalance('bdo',700),true);assert.equal(balance(),700);assert.equal(typeof c.bankBalanceOverrides.bdo,'number');
console.log('PASS: additional workspace import/delete/restore/edit/move/batch/re-import, transfer and manual deltas once, actual-balance anchor, reload/shared cloud reads, original workspace unchanged');
