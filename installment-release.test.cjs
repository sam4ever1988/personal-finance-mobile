const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),source=fs.readFileSync(__dirname+'/app-03.js','utf8');
function fn(name,sourceCode=source){const start=sourceCode.indexOf('function '+name+'('),next=sourceCode.slice(start+1).search(/\nfunction /);assert(start>=0);return sourceCode.slice(start,next<0?sourceCode.length:start+1+next);}
class Clock extends Date{constructor(...args){super(...(args.length?args:['2026-10-01T12:00:00Z']));}}
const ctx={Date:Clock,Math,Number,String,Array,Set,console,window:{__financeStateInitialized:true},localStorage:{setItem(){}},scheduleRecordPush(){},financeRoundMoney:n=>Math.round((n+Number.EPSILON)*100)/100,account:id=>['first','seventh','previous','monthend'].includes(id)?{type:'card'}:null,cardCycleSetting:id=>({first:{statementDay:1,dueDay:25},seventh:{statementDay:7,dueDay:25},previous:{statementDay:25,dueDay:5},monthend:{statementDay:31,dueDay:31}}[id]),cardCycleHasStatement:()=>false,cardCycleHasRecordedPayment:()=>false,addMonthsToYM:(m,n)=>{const [y,k]=m.split('-').map(Number),d=new Date(y,k-1+n,1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');},installments:[],currentYearMonth:()=> '2026-10'};vm.createContext(ctx);for(const name of ['monthIndex','elapsedMonths','installmentReferenceMonth','installmentCycleReleasedByDate','installmentPaidThroughReleasedStatement','reduceRemainingPrincipalByReleasedStatements','installmentReleasedSlices','installmentRemainingSchedule','planMonthly','planCalc','reconcileRemainingPrincipalPlans'])vm.runInContext(fn(name),ctx);
vm.runInContext(fn('installmentAmountForPaymentMonth',fs.readFileSync(__dirname+'/app-02.js','utf8')),ctx);
const plan=(remaining,count,paid=0,cardId='first')=>({cardId,scheduleMode:'remaining-principal',referenceMonth:'2026-10',startMonth:'2026-09',manualRemaining:remaining,remainingMonthsOverride:count,months:3,paidInstallments:paid});
for(const [p,paid,count,remaining] of [[{...plan(1563.95,2,1),fullAmount:2345.92},2,1,781.98],[{...plan(1492.83,2,1),fullAmount:2239.25},2,1,746.41],[plan(1863.67,3),1,2,1242.45],[plan(2299.08,3),1,2,1532.72]]){const result=ctx.planCalc(p);assert.equal(result.paid,paid);assert.equal(result.remainingCount,count);assert.equal(result.remaining,remaining);ctx.installments=[p];const principalBefore=p.manualRemaining,billedBefore=ctx.installmentAmountForPaymentMonth('first','2026-10');ctx.reconcileRemainingPrincipalPlans();assert.equal(p.statementBilledHistory.find(row=>row.month==='2026-10').amount,billedBefore);assert.equal(ctx.installmentAmountForPaymentMonth('first','2026-10'),billedBefore);assert.equal(ctx.financeRoundMoney(p.manualRemaining+billedBefore),principalBefore);const state=JSON.stringify(p);ctx.reconcileRemainingPrincipalPlans();assert.equal(JSON.stringify(p),state);assert.equal(ctx.planCalc(p).paid,paid);}
assert.equal(ctx.planCalc(plan(300,3,0,'seventh')).paid,0);assert(ctx.installmentCycleReleasedByDate('seventh','2026-10',new Date('2026-10-07T12:00:00')));assert(ctx.installmentCycleReleasedByDate('previous','2026-10',new Date('2026-09-25T12:00:00')));assert(!ctx.installmentCycleReleasedByDate('previous','2026-10',new Date('2026-09-24T12:00:00')));assert(ctx.installmentCycleReleasedByDate('monthend','2026-02',new Date('2026-02-28T12:00:00')));assert(!ctx.installmentCycleReleasedByDate('unknown','2026-10'));assert.equal(ctx.planCalc({...plan(300,3),referenceMonth:'2026-11'}).paid,0);assert.equal(ctx.planCalc({cardId:'first',fullAmount:300,months:3,paidInstallments:1,startMonth:'2026-09'}).paid,2);console.log('PASS: October release advances 1/3 to 2/3 and 0/3 to 1/3; exact remaining principal and rounding; repeated loads do not advance twice; every card uses its own release date; future starts, previous-month closing and month-end clamping; no bank payment recorded');

// Verify the complete card position, not only the installment table. Billed
// principal must stay occupied through local reconciliation and a fresh load.
Object.assign(ctx,{cardActiveCycleMonth:()=> '2026-11',cardReleasedStatementBalance:()=>0,
 liveUnreleasedTransactionRows:()=>[{amount:-40000}],assignedTransactionPaymentMonth:()=> '2026-11',
 liveUnreleasedTransactionUsage:()=>40000,liveTransactionUsageByMonth:()=>({'2026-11':40000}),
 cardCycleFullyPaid:()=>false,cardCreditBreakdown:()=>({manualCredits:0,recordedPaymentCredits:20000,cardFundedPayments:0})});
for(const name of ['activeInstallmentPlans','cardUnrepresentedBilledInstallments','excelCardAccounting','linkedActiveInstallment'])vm.runInContext(fn(name),ctx);
ctx.installments=[{...plan(1563.95,2,1),fullAmount:2345.92},{...plan(1492.83,2,1),fullAmount:2239.25},{...plan(1863.67,3),fullAmount:1863.67,startMonth:'2026-10'},{...plan(2299.08,3),fullAmount:2299.08,startMonth:'2026-10'}];
const card={id:'first',extra:{'Credit Limit':53500}},before=ctx.excelCardAccounting(card);
assert.equal(before.futureReserved,4303.56);assert.equal(before.unrepresentedBilledInstallments,2915.97);
assert.equal(before.available,26280.47);assert(before.creditLimitInvariant);
ctx.reconcileRemainingPrincipalPlans();assert.equal(ctx.excelCardAccounting(card).available,before.available);
ctx.installments=JSON.parse(JSON.stringify(ctx.installments));
for(let i=0;i<5;i++){ctx.reconcileRemainingPrincipalPlans();const result=ctx.excelCardAccounting(card);assert.equal(result.futureReserved,4303.56);assert.equal(result.available,before.available);assert.equal(result.unrepresentedBilledInstallments,2915.97);}
ctx.cardCycleHasStatement=(id,month)=>month==='2026-10';ctx.cardReleasedStatementBalance=()=>2915.97;
assert.equal(ctx.excelCardAccounting(card).unrepresentedBilledInstallments,0);assert.equal(ctx.excelCardAccounting(card).available,before.available);
ctx.cardCycleHasStatement=()=>false;ctx.cardReleasedStatementBalance=()=>0;
ctx.cardCreditBreakdown=()=>({manualCredits:0,recordedPaymentCredits:20100,cardFundedPayments:0});assert.equal(ctx.excelCardAccounting(card).available,26380.47);
ctx.installments=[{...plan(100,1,2),fullAmount:300,linkedTransactionId:'converted'}];
assert.equal(ctx.planCalc(ctx.installments[0]).remaining,0);assert.equal(ctx.cardUnrepresentedBilledInstallments('first'),100);assert(ctx.linkedActiveInstallment('converted'));
console.log('PASS: whole-card principal conservation, SAR 4303.56 reserve before/after reconciliation and five reloads, billed debt preserved, statement replacement without duplication, payment credited once, final billed installment retains converted purchase exclusion');
// A payment can cover purchases and a card-funded transfer. Transfer coverage
// is already removed from transfer utilization; it cannot be credited twice.
Object.assign(ctx,{cardPaymentPlan:[{accountId:'first',month:'2026-10',paidAmount:20000,paid:false,paymentHistory:[]}],
 cardFundedPaymentBreakdown:()=>[{effectivePaymentMonth:'2026-10',coveredBySourcePayment:1533.73}],
 liveUnreleasedTransactionRows:()=>[{amount:-15550.30}],assignedTransactionPaymentMonth:()=> '2026-10',
 isGenuineReleasedStatementRow:()=>false,importedOfficialPlannerRow:()=>null,paymentPaidAmount:p=>p.paidAmount,
 installmentAmountForPaymentMonth:()=>2915.97});
vm.runInContext(fn('recordedCardPaymentCredit'),ctx);
assert.equal(ctx.recordedCardPaymentCredit('first'),18466.27);
assert.equal(ctx.financeRoundMoney(15550.30+2915.97+20196.25-1533.73-ctx.recordedCardPaymentCredit('first')),18662.52);
ctx.cardPaymentPlan[0].paid=true;assert.equal(ctx.recordedCardPaymentCredit('first'),15550.30);
ctx.cardPaymentPlan[0].paid=false;ctx.cardFundedPaymentBreakdown=()=>[];assert.equal(ctx.recordedCardPaymentCredit('first'),20000);
console.log('PASS: partial source-card payment coverage credited once; October transfer coverage does not create SAR 1533.73 excess credit; fully paid and no-transfer paths preserved');
