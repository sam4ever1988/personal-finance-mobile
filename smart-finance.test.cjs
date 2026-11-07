const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const code=fs.readFileSync('app-13.js','utf8'),ctx={importDateDays:(a,b)=>Math.abs(new Date(a)-new Date(b))/86400000};vm.createContext(ctx);vm.runInContext(code.slice(0,code.indexOf('(function(){')),ctx);
const base={account:'a',physicalCardEnding:'1234',currency:'SAR',category:'Utilities',description:'STC internet',amount:-300,kind:'expense'};
const history=['08','09','10'].map((m,i)=>({...base,date:`2026-${m}-05`,_id:'t'+i}));
const suggest=(r=history,k=[],ig=[])=>ctx.financeRecurringCandidates(r,k,ig,'2026-11');assert.equal(suggest().length,1);assert.equal(suggest()[0].dueDay,5);assert.equal(suggest()[0].amount,300);
assert.equal(suggest(history.slice(1)).length,0);assert.equal(suggest([...history,{...history[2],_id:'duplicate'}]).length,0);assert.equal(suggest(history.map(r=>({...r,description:'Supermarket',category:'Groceries'}))).length,0);assert.equal(suggest(history.map(r=>({...r,kind:'transfer'}))).length,0);assert.equal(suggest(history,[{description:'STC internet'}]).length,0);assert.equal(suggest(history,[],[suggest()[0].key]).length,0);
assert(suggest(history.map((r,i)=>({...r,amount:-300-i*20})))[0].variable);
const old={...base,_id:'manual1',date:'2026-11-05',month:'2026-11',notes:'keep'},incoming={...base,date:'2026-11-05',month:'2026-11'};const match=(up=[incoming],ex=[old])=>ctx.financeStrongStatementMatches(up,ex,r=>r.month);
assert.equal(match().pairs.length,1);assert.equal(match([{...incoming,description:'Different merchant'}]).pairs.length,0);assert.equal(match([{...incoming,physicalCardEnding:'5678'}]).pairs.length,0);assert.equal(match([{...incoming,amount:-301}]).pairs.length,0);assert.equal(match([{...incoming,month:'2026-12'}]).pairs.length,0);assert.equal(match([incoming,incoming]).pairs.length,0);assert.equal(match([incoming],[old,{...old,_id:'other'}]).pairs.length,0);
assert.equal(match([{...incoming,description:'STC POSTPAID'}],[old,{...old,_id:'historical',date:'2026-09-05',month:'2026-09',statementEvidence:[{description:'STC POSTPAID'}]}]).pairs.length,1);
const o={smartRecurring:{account:'a',card:'1234',merchant:'stc internet',dueDay:5}};assert.equal(ctx.financeRecurringPaymentCandidates(o,[old],'2026-11').length,1);assert.equal(ctx.financeRecurringPaymentCandidates(o,[{...old,amount:300}],'2026-11').length,0);
console.log('PASS monthly evidence thresholds, ambiguity, existing plans, ignore, variable bills, merchant learning, account/card/month guards, one-to-one matches and payment evidence');
// Integration: link and unlink evidence without creating/deleting transactions or moving cash.
const app3=fs.readFileSync('app-03.js','utf8');
const body=(name,next)=>app3.slice(app3.indexOf('function '+name+'('),app3.indexOf('function '+next+'('));
const payment={...base,_id:'paid',account:'a',date:'2026-11-05'};
Object.assign(ctx,{window:{__financeStateInitialized:true,financeWorkspaceUserId:'test'},document:{getElementById:()=>null},escapeHtml:x=>x,liveCardTransactions:()=>[payment],installments:[],outgoings:[{id:'due',amount:300,payments:{},smartRecurring:{account:'a',card:'1234',currency:'SAR',merchant:'stc internet',dueDay:5}}],currentIncomeMonth:()=>'2026-11',saveLocal:()=>{},renderIncomePlan:()=>{},renderImportPreview:()=>{},splitFreshStatementRows:()=>({fresh:[],duplicates:[]}),financeRoundMoney:n=>Math.round(n*100)/100,account:()=>({type:'bank'}),refreshAfterOutgoingPayment:()=>{}});
vm.runInContext(body('outgoingPaymentEntries','outgoingRemaining'),ctx);
vm.runInContext(code.slice(code.indexOf('(function(){'),code.indexOf('/* The premium overview')),ctx);
ctx.window.financeAutoLinkMonthlyDues();assert.equal(ctx.outgoingPaidAmount(ctx.outgoings[0],'2026-11'),300);assert.equal(ctx.outgoings[0].payments['2026-11'].length,1);
ctx.window.financeAutoLinkMonthlyDues();assert.equal(ctx.outgoings[0].payments['2026-11'].length,1);
vm.runInContext(body('undoOutgoingPayment','renderOutgoings'),ctx);
ctx.undoOutgoingPayment('due','2026-11',false,'linked:paid');assert.equal(ctx.outgoingPaidAmount(ctx.outgoings[0],'2026-11'),0);assert.equal(payment.amount,-300);ctx.window.financeAutoLinkMonthlyDues();assert.equal(ctx.outgoingPaidAmount(ctx.outgoings[0],'2026-11'),0);
ctx.outgoings[0].smartUnlinked=[];ctx.window.financeAutoLinkMonthlyDues();payment.amount=-320;assert.equal(ctx.outgoingPaidAmount(ctx.outgoings[0],'2026-11'),0);
console.log('PASS repeated payment linking, unlink preserves original transaction and cash, removed/edited evidence invalidates paid state');

// Different transaction dates must never be skipped or linked as duplicates.
for(const date of ['2026-11-06','2026-10-05','2025-11-05','']){
 assert.equal(match([{...incoming,date}]).pairs.length,0);
}
const source6=fs.readFileSync('app-06.js','utf8');
Object.assign(ctx,{cleanImportText:s=>String(s).trim(),account:()=>({type:'card'}),importedTransactions:[old],transactionActions:{},txOverrides:{},financeRoundMoney:n=>Math.round(n*100)/100});
vm.runInContext(source6.slice(source6.indexOf('function importDateDays('),source6.indexOf('function selectedStatementCardUpdates(')),ctx);
assert.equal(ctx.isStatementDuplicate(incoming,old),true);
for(const date of ['2026-11-06','2026-10-05','2025-11-05','']){
 const row={...incoming,date,reference:'same',physicalCardDetected:true};
 const prior={...old,reference:'same'};
 assert.equal(ctx.isStatementDuplicate(row,prior),false);
 assert.equal(ctx.statementCardMatch(row,prior),false);
 assert.equal(ctx.splitFreshStatementRows([row],[prior]).fresh.length,1);
}
Object.assign(ctx,{normalizedTx:()=>[{...old,manual:true},{...incoming,_id:'new',manual:false,date:'2026-11-06'}],normDupText:s=>s,duplicateDecision:()=>''});
const source4=fs.readFileSync('app-04.js','utf8');
vm.runInContext(source4.slice(source4.indexOf('function possibleDuplicateGroups('),source4.indexOf('function duplicateTxIds(')),ctx);
assert.equal(ctx.possibleDuplicateGroups().length,0);
ctx.normalizedTx=()=>[{...old,manual:true},{...incoming,_id:'new',manual:false}];
assert.equal(ctx.possibleDuplicateGroups().length,1);
console.log('PASS strict transaction dates for import, auto-link, card assignment and duplicate review');
