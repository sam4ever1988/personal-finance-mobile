const fs=require('fs'),assert=require('assert/strict'),{chromium}=require(process.env.FINANCE_TEST_PLAYWRIGHT||'playwright');
const code=Array.from({length:12},(_,i)=>fs.readFileSync(__dirname+'/app-'+String(i+1).padStart(2,'0')+'.js','utf8')).join('\n'),css=['styles.css','layouts.css'].map(n=>fs.readFileSync(__dirname+'/'+n,'utf8')).join('\n');
const html=fs.readFileSync(__dirname+'/index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*>/g,'');
const setup=`window.financeActiveUserId='test';window.financeWorkspaceUserId='test';window.financeAdditionalWorkspace=true;window.financeIsOwner=true;window.financeWorkspaceCurrency='SAR';window.financeCanViewPage=()=>true;window.fetch=async()=>{throw Error('Offline fixture')};`;
fs.writeFileSync('/tmp/finance-payment-installment-test.html',html.replace('</head>','<style>'+css+'</style></head>').replace('</body>','<script>'+setup+'</script><script>'+code.replace(/<\/script/gi,'<\\/script')+'</script></body>'));
(async()=>{const browser=await chromium.launch({executablePath:process.env.FINANCE_TEST_CHROMIUM,args:['--no-sandbox']});try{const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('file:///tmp/finance-payment-installment-test.html');await page.waitForTimeout(200);
await page.evaluate(()=>{document.body.classList.remove('financeAccessLocked');document.getElementById('financeAccessGate')?.remove();document.head.insertAdjacentHTML('beforeend','<style>.app{filter:none!important;pointer-events:auto!important}</style>');window.alert=()=>{};saveLocal=()=>{};scheduleRecordPush=()=>{};accounts.splice(0,accounts.length,...Array.from({length:5},(_,i)=>({id:'card'+i,type:'card',bank:'Test',name:'Card',ending:String(1000+i),extra:{'Credit Limit':10000}})));importedTransactions=Array.from({length:500},(_,i)=>({_id:'import'+i,account:'card'+i%5,date:'2026-10-02',amount:-10,description:'Merchant '+i,category:'Miscellaneous',subcategory:'Unexpected Expenses',statementMonth:'2026-10'}));manualTransactions=[];installments=[];cardPaymentPlan=[];cashFlowLedger=[];txOverrides={};transactionActions={};merchantRules={};rebuildTransactions();nav('executive');});



await page.evaluate(()=>{
 window.confirm=()=>true;window.alert=msg=>{window.lastAlert=msg};
 financeSettings.cardCycles={funding:{statementDay:28,dueDay:5},target:{statementDay:28,dueDay:5}};
 accounts.splice(0,accounts.length,{id:'funding',type:'card',bank:'Demo',name:'Funding',ending:'1111',extra:{'Credit Limit':10000}},{id:'target',type:'card',bank:'Demo',name:'Target',ending:'2222',extra:{'Credit Limit':10000}});
 importedTransactions=[];manualTransactions=[];installments=[];
 cashFlowLedger=[{id:'paid-ledger',referenceId:'payment:target-plan:2026-10-03T12:00:00Z:3000.00',type:'card-payment',status:'active',sourceId:'funding',targetId:'target',amount:3000,date:'2026-10-03',month:'2026-10',sourcePaymentMonth:'2026-11',paymentMonth:'2026-10'}];
 cardPaymentPlan=[{id:'target-plan',accountId:'target',month:'2026-10',amount:3000,statementOriginalAmount:3000,userConfirmedStatement:true,source:'manual',paidAmount:3000,paid:true,paymentHistory:[{ledgerReferenceId:'payment:target-plan:2026-10-03T12:00:00Z:3000.00',amount:3000,duePortion:3000,recordedAt:'2026-10-03T12:00:00Z',sourceId:'funding',date:'2026-10-03'}]}];
 rebuildTransactions();openAccount('funding');
});
const sourceAvailable=await page.evaluate(()=>cardMetrics(account('funding')).available);
const before=await page.evaluate(()=>JSON.stringify({ledger:cashFlowLedger,target:cardPaymentPlan.find(p=>p.id==='target-plan')}));
await page.locator('[data-transfer-installment]').click();
assert.equal(await page.locator('#instAmount').inputValue(),'3000');
assert.equal(await page.locator('#instStart').inputValue(),'2026-12');
await page.locator('#instStart').fill('2026-12');await page.locator('#instMonths').fill('3');
await page.locator('#instFees').fill('30');
assert.equal(await page.locator('#instRemainingAmount').inputValue(),'3030');
await page.locator('#installForm button[type=submit]').click();
assert.equal(await page.evaluate(()=>installments.length),1);
assert.equal(await page.evaluate(()=>planCalc(installments[0]).monthly),1010);
assert.equal(await page.evaluate(()=>cardMetrics(account('funding')).available),sourceAvailable-30);
assert.equal(await page.evaluate(()=>cardLedgerSourceTransfersForMonth('funding','2026-11')),0);
assert.equal(await page.evaluate(()=>installmentAmountForPaymentMonth('funding','2026-12')),1010);
assert.equal(await page.evaluate(()=>JSON.stringify({ledger:cashFlowLedger,target:cardPaymentPlan.find(p=>p.id==='target-plan')})),before);
assert.equal(await page.evaluate(()=>paymentRemainingAmount(cardPaymentPlan.find(p=>p.id==='target-plan'))),0);
await page.evaluate(()=>{deleteMonthlyIncomeCardPayment('paid-ledger');undoLastPartialPayment('target-plan','payment:target-plan:2026-10-03T12:00:00Z:3000.00');editAccountPaymentActivity('paid-ledger');deleteAccountPaymentActivity('paid-ledger');});
assert.equal(await page.evaluate(()=>cashFlowLedger[0].status),'active');
assert.equal(await page.evaluate(()=>cardPaymentPlan.find(p=>p.id==='target-plan').paymentHistory.length),1);
await page.evaluate(()=>openTransferInstallment('paid-ledger'));await page.locator('#instMonths').fill('6');await page.locator('#installForm button[type=submit]').click();
assert.equal(await page.evaluate(()=>installments.length),1);assert.equal(await page.evaluate(()=>planCalc(installments[0]).monthly),505);
assert.equal(await page.evaluate(()=>installments[0].fullAmount),3030);
await page.evaluate(()=>{installments=JSON.parse(JSON.stringify(installments));cashFlowLedger=JSON.parse(JSON.stringify(cashFlowLedger));});
assert.equal(await page.evaluate(()=>transferInstallmentPlan('paid-ledger').bankFees),30);
await page.evaluate(()=>{window.financeSectionPermission=()=> 'view';openAccount('funding');openTransferInstallment('paid-ledger');});
assert.equal(await page.locator('#accountDetailContent [data-transfer-installment]').count(),0);assert.equal(await page.locator('#installModal.open').count(),0);
await page.evaluate(()=>{delete window.financeSectionPermission;deleteInstallmentPlan(installments[0].id);});
assert.equal(await page.evaluate(()=>installments.length),0);assert.equal(await page.evaluate(()=>paymentRemainingAmount(cardPaymentPlan.find(p=>p.id==='target-plan'))),0);
assert.equal(await page.evaluate(()=>eligiblePaymentInstallment({type:'card-payment',sourceId:'target',targetId:'target',amount:3000})),false);
assert.equal(await page.evaluate(()=>eligiblePaymentInstallment({...cashFlowLedger[0],status:'reversed'})),false);
// Released funding statements lose only the converted charge, using their explicit statement month.
await page.evaluate(()=>{cardPaymentPlan.push({id:'funding-statement',accountId:'funding',month:'2026-11',amount:3500,statementOriginalAmount:3500,userConfirmedStatement:true,source:'confirmed',paidAmount:0,paymentHistory:[]});openTransferInstallment('paid-ledger');});
await page.locator('#installForm button[type=submit]').click();
assert.equal(await page.evaluate(()=>cardPaymentPlan.find(p=>p.id==='funding-statement').amount),500);
assert.equal(await page.evaluate(()=>paymentRemainingAmount(cardPaymentPlan.find(p=>p.id==='target-plan'))),0);
await page.evaluate(()=>deleteInstallmentPlan(installments[0].id));
assert.equal(await page.evaluate(()=>cardPaymentPlan.find(p=>p.id==='funding-statement').amount),3500);

assert.deepEqual(errors,[]);
console.log('PASS existing credit-card payment conversion; target stays paid; no new ledger; fees; monthly schedule; edit; permission; undo protection; removal; reload');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
