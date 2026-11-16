const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('app-03.js','utf8');
function fn(name){const start=source.indexOf('function '+name+'('),end=source.indexOf('\nfunction ',start+1);return source.slice(start,end);}
const a={id:'card',extra:{'Credit Limit':10000}};
const statement={id:'official',accountId:'card',statementBalanceVerified:true,statementOfficial:true,
 statementEnd:'2026-11-02',statementClosingBalance:9076.42,amount:1201.92,paidAmount:1201.92,
 bankAvailabilityObservation:{date:'2026-11-16',outstanding:7874.50,available:2115.50,knownHolds:0}};
let tx=[],holds=0;
const c={importHistory:[],cardPaymentPlan:[statement],cashFlowLedger:[{id:'paid',type:'card-payment',targetId:'card',sourceId:'bank',date:'2026-11-11',amount:1201.92,status:'active'}],
 financeRoundMoney:n=>Math.round((n+Number.EPSILON)*100)/100,officialStatementImportMatches:p=>p.statementOfficial===true,
 liveCardTransactions:()=>tx,txType:t=>t.kind||'spend',cardBankReserve:()=>holds,
 excelCardAccounting:()=>({limit:10000,total:5898.49,available:4101.51,inst:6057.16,availableBeforeInstallments:4101.51})};
vm.createContext(c);for(const name of ['verifiedStatementCardPosition','cardMetricsBeforeBankHolds','cardMetrics'])vm.runInContext(fn(name),c);
const position=()=>c.verifiedStatementCardPosition(a,'2026-11-16');
assert.equal(position().total,7874.50);assert.equal(position().available,2125.50);assert.equal(position().bankAvailabilityDifference,10);
// Historical corrections/credits and scheduled principal must not alter the
// full bank closing balance; changing the monthly due is not a money movement.
tx=[{account:'card',date:'2026-10-13',amount:1896.67},{account:'card',date:'2026-11-01',amount:-1896.67},{account:'card',date:'2026-08-17',amount:158.67}];
statement.amount=9999;assert.equal(position().total,7874.50);statement.amount=1201.92;
c.cashFlowLedger.push({id:'old',type:'card-payment',targetId:'card',date:'2026-10-11',amount:4960.30},{id:'reversed',type:'card-payment',targetId:'card',date:'2026-11-11',amount:1201.92,status:'reversed'});
assert.equal(position().total,7874.50);
// Subsequent charge, payment, refund and card-funded transfers affect debt once.
tx.push({account:'card',date:'2026-11-12',amount:-100});assert.equal(position().total,7974.50);
tx.push({account:'card',date:'2026-11-13',amount:20});assert.equal(position().total,7954.50);
c.cashFlowLedger.push({id:'transfer',type:'card-bank-transfer',sourceId:'card',targetId:'bank',date:'2026-11-14',amount:200});assert.equal(position().total,8154.50);
tx.push({account:'card',date:'2026-11-14',amount:-200,kind:'transfer',linkedLedgerId:'transfer'});assert.equal(position().total,8154.50);
tx.push({account:'card',date:'2026-11-11',amount:1201.92,description:'Sadad Bill Payment'});assert.equal(position().total,8154.50);
// Same-amount real purchases are not deduplicated against each other.
tx.push({account:'card',date:'2026-11-14',amount:-200,description:'Shop'});assert.equal(position().total,8354.50);
tx.push({account:'card',date:'2026-12-01',amount:-500});assert.equal(position().total,8354.50);
// Existing cards without explicit balance verification use the existing model.
statement.statementBalanceVerified=false;assert.equal(position(),null);assert.equal(c.cardMetricsBeforeBankHolds(a).total,5898.49);statement.statementBalanceVerified=true;
tx=[];c.cashFlowLedger=c.cashFlowLedger.filter(h=>h.id==='paid');
// Pin the date only for integration assertions, without changing production time.
const real=c.verifiedStatementCardPosition;c.verifiedStatementCardPosition=a=>real(a,'2026-11-16');
let m=c.cardMetrics(a);assert.equal(m.total,7874.50);assert.equal(m.available,2115.50);assert.equal(m.bankReserve,0);assert.equal(m.creditLimitInvariant,true);
holds=50;m=c.cardMetrics(a);assert.equal(m.available,2065.50);assert.equal(m.total,7874.50);
// A newer verified closing balance absorbs old movements, not a second credit.
c.cardPaymentPlan.push({...statement,id:'next',statementEnd:'2026-11-15',statementClosingBalance:7874.50,bankAvailabilityObservation:null});
assert.equal(position().total,7874.50);assert.equal(position().ledgerDelta,0);
// Persist balance evidence independently of planner rebuilds / old device rows.
c.importHistory=[{...statement,id:'evidence',officialStatementConfirmed:true,officialStatementMonth:'2026-11',fileName:'statement.pdf'}];
c.cardPaymentPlan=[];assert.equal(position().total,7874.50);
console.log('PASS verified closing balance: separate due, historic credits, payments once, refunds, transfers, future dates, holds, availability discrepancy and next statement');
