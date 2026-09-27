const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');
const holdings=[{ticker:'RIO',market:'US',company:'Rio Tinto',qty:8,avg:69,price:95,ledgerBaseQty:8,ledgerBaseAvg:69},{ticker:'LCID',market:'US',company:'Lucid',qty:0,avg:5,price:5,ledgerBaseQty:0,ledgerBaseAvg:5}];
const store=new Map([['pf_investments_holdings',JSON.stringify(holdings)],['pf_investments_trades','[]']]);
const status={textContent:''};const document={head:{appendChild(){}},getElementById:id=>id==='invDiscoveryStatus'?status:null,createElement:()=>({style:{}})};
const requests=[];const ctx={document,window:{financeActiveUserId:'user',financeIsOwner:true},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},cloudClient:{auth:{getSession:async()=>({data:{session:{access_token:'test'}}})}},fetch:async(url)=>{requests.push(url);return{ok:true,json:async()=>({items:[{symbol:'RIO',exDate:'2026-08-14',payDate:'2026-09-24',amount:2.11},{symbol:'LCID',exDate:'2026-08-14',payDate:'2026-09-24',amount:1}],checked:1,source:'test',failures:[]})}},Intl,Date,Math,JSON,Number,String,Array,Object,console,scheduleRecordPush(){}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('app-09.js','utf8'),ctx);
(async()=>{
 await ctx.invScanAnnouncements(false);assert.equal(ctx.invTrades.length,1);assert.equal(ctx.invTrades[0].ticker,'RIO');assert.equal(ctx.invTrades[0].qty,0);assert.equal(ctx.invTrades[0].actionStatus,'discovered');assert.match(requests[0],/symbols=RIO/);assert.doesNotMatch(requests[0],/LCID/);
 await ctx.invScanAnnouncements(false);assert.equal(requests.length,1,'daily scan does not repeat');
 await ctx.invScanAnnouncements(true);assert.equal(ctx.invTrades.length,1,'repeat scan deduplicates');
 ctx.invHoldings.push({ticker:'7202',market:'SA',qty:10,company:'Solutions',avg:10,price:10,ledgerBaseQty:10,ledgerBaseAvg:10});await ctx.invScanAnnouncements(false);assert.match(requests.at(-1),/7202.SR/,'newly owned symbol joins next scan');
 const before=requests.length,records=ctx.invTrades.length;
 ctx.window.financeSharedWorkspace=true;await ctx.invScanAnnouncements(true);assert.equal(requests.length,before);assert.equal(ctx.invTrades.length,records,'shared workspace cannot discover into another owner’s data');
 ctx.window.financeSharedWorkspace=false;ctx.window.financePagePermissions={investments:'view'};await ctx.invScanAnnouncements(true);assert.equal(requests.length,before,'view-only workspace cannot scan or write');
 console.log('Discovery scans only positive holdings, follows additions, and deduplicates review records.');
})().catch(e=>{console.error(e);process.exitCode=1});
