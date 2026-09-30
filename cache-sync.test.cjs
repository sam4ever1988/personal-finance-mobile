const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=n=>fs.readFileSync(`${__dirname}/app-${n}.js`,'utf8');
function fn(n,name){const s=source(n),start=s.indexOf(`function ${name}(`);assert(start>=0,name);const end=s.slice(start+1).search(/\n(?:async )?function |\n(?:const|var) /);return s.slice(s.slice(0,start).endsWith('async ')?start-6:start,end<0?s.length:start+1+end);}
function fixture(){
 const storage=new Map(),meta={pending:true},ctx={console,Date,Map,Set,JSON,Math,setTimeout:()=>0,clearTimeout:()=>{},window:{financeActiveUserId:'owner',__financeStateInitialized:true},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},cashFlowLedger:[],recordPendingDeletes:[],recordSyncApplying:false,recordSyncReady:true,recordSyncPushBusy:false,recordSyncPushTimer:0,recentOwnBankBalanceWrites:new Map(),RECORD_SYNC_BASELINE_KEY:'baseline',RECORD_SYNC_TABLE:'records',financeSettingsDirty:false,selectedTxIds:new Set(),recordSyncLastCloudUpdatedAt:0,
 syncRecordValue:v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x),getCloudMeta:()=>meta,setCloudMeta:x=>Object.assign(meta,x),cloudSetStatus:x=>ctx.status=x,activeViewId:()=>'',saveRecordDeleteQueue:()=>{},markLocalRecordWrite:()=>{},rememberOwnBankBalanceWrite:()=>{},noteCloudUpdatedAt:()=>{},incomeMonthKey:d=>String(d).slice(0,7)};
 ctx.other=[];ctx.remote=[];ctx.writes=[];
 ctx.buildRecordSyncRowsFromState=()=>[...ctx.other,...ctx.cashFlowLedger.map(data=>({section:'cash_flow_ledger',record_id:data.id,data}))];
 ctx.recordFetchAll=async()=>ctx.remote;
 ctx.applyRecordSyncDeltaRows=rows=>{for(const r of rows){if(r.section==='cash_flow_ledger'){ctx.cashFlowLedger=ctx.cashFlowLedger.filter(x=>x.id!==r.record_id);if(!r.deleted_at)ctx.cashFlowLedger.push(r.data);}else{ctx.other=ctx.other.filter(x=>x.section!==r.section||x.record_id!==r.record_id);if(!r.deleted_at)ctx.other.push(r);}}return {changed:!!rows.length,appliedRows:rows};};
 ctx.cloudClient={auth:{getSession:async()=>({data:{session:{user:{id:'owner'}}}})},from:()=>({upsert:async rows=>{ctx.writes.push(...rows);for(const r of rows){ctx.remote=ctx.remote.filter(x=>x.section!==r.section||x.record_id!==r.record_id);ctx.remote.push(r);}return {error:null};}})};
 vm.createContext(ctx);
 for(const name of ['cashFlowLedgerKey','addCashFlowLedgerEntry'])vm.runInContext(fn('02',name),ctx);
 for(const name of ['alignOutgoingLedgerIdsWithCloud','recordSyncBaseline','rememberRecordSyncBaseline','rememberRemoteRecordBaseline','safeIncomingRecordRows','mergeBankBalanceFields','recordPushAll','cloudAutoReconcile','useCloudBankBalanceValue'])vm.runInContext(fn('07',name),ctx);
 ctx.cloudProtectedRefreshBusy=false;
 return ctx;
}
const payment={type:'outgoing-payment',referenceId:'outgoing:outpay-school-one',date:'2026-09-29',month:'2026-09',amount:862.5,sourceId:'bank',createdAt:'2026-09-29T17:54:00Z'};
(async()=>{
 const a=fixture(),b=fixture();const first=a.addCashFlowLedgerEntry(payment),second=b.addCashFlowLedgerEntry(payment);
 assert.equal(first.id,second.id);assert.equal(a.addCashFlowLedgerEntry(payment),first);assert.equal(a.cashFlowLedger.length,1);
 first.status='reversed';assert.equal(a.addCashFlowLedgerEntry(payment).status,'reversed');
 const c=fixture(),original={...payment,id:'original'};
 c.remote=[{section:'cash_flow_ledger',record_id:'original',data:original}];
 c.cashFlowLedger=[{...original,id:'copy1'},{...original,id:'copy2'},{...original,id:'edited',amount:900},{...original,id:'another',referenceId:'outgoing:outpay-school-two'}];
 c.alignOutgoingLedgerIdsWithCloud(c.remote);assert.equal(c.cashFlowLedger.length,3);assert.equal(c.cashFlowLedger[0].id,'original');assert.equal(c.cashFlowLedger[1].amount,900);
 const d=fixture();d.other=[{section:'bank_balance_overrides',record_id:'state',data:{bank:100}}];d.rememberRecordSyncBaseline(d.buildRecordSyncRowsFromState());
 d.remote=[{section:'bank_balance_overrides',record_id:'state',data:{bank:80}},...c.remote];
 assert.equal(await d.recordPushAll(),true);assert.equal(d.other[0].data.bank,80);assert.equal(d.cashFlowLedger.length,1);assert.equal(d.writes.length,0);
 const e=fixture();e.other=[{section:'bank_balance_overrides',record_id:'state',data:{bank:100}}];e.rememberRecordSyncBaseline(e.buildRecordSyncRowsFromState());e.other[0].data={bank:90};e.remote=d.remote;
 assert.equal(await e.recordPushAll(),false);assert.equal(e.other[0].data.bank,90);assert.equal(e.cashFlowLedger.length,1);assert.equal(e.writes.length,0);assert.equal(e.getCloudMeta().pending,true);assert.match(e.status,/conflict/);
 const f=fixture();f.cashFlowLedger=[{...original,id:'edited',amount:900}];f.rememberRecordSyncBaseline(f.buildRecordSyncRowsFromState());f.remote=c.remote;
 assert.equal(await f.recordPushAll(),false);assert.equal(f.writes.length,0);assert.equal(f.cashFlowLedger.find(x=>x.id==='edited').amount,900);
 const g=fixture();g.getCloudMeta().pending=false;g.localStorage.setItem('pf_v185_authoritative_cloud_loaded','1');g.document={activeElement:null,querySelector:()=>null};g.currentCloudCursorIso=()=>'';let reads=0,release;
 g.recordFetchAll=()=>{reads++;return new Promise(resolve=>release=()=>resolve(c.remote));};
 const inFlight=g.cloudAutoReconcile('startup');await new Promise(r=>setImmediate(r));assert.equal(await g.cloudAutoReconcile('visible'),false);release();assert.equal(await inFlight,true);assert.equal(reads,1);assert.equal(g.cashFlowLedger.length,1);
 const h=fixture();h.cashFlowLedger=[{...original}];h.remote=[];h.cloudClient.from=()=>({upsert:async()=>({error:new Error('Offline test')})});
 assert.equal(await h.recordPushAll(),false);assert.equal(h.cashFlowLedger.length,1);assert.equal(h.getCloudMeta().pending,true);
 const i=fixture();i.getCloudMeta().pending=false;i.localStorage.setItem('pf_v185_authoritative_cloud_loaded','1');i.document={activeElement:null,querySelector:()=>null};i.recordFetchAll=async()=>{i.getCloudMeta().pending=true;return c.remote;};
 await i.cloudAutoReconcile('startup');assert.equal(i.getCloudMeta().pending,true);
 const j=fixture();j.cashFlowLedger=[{...original,id:'retired-copy'},{...original}];
 j.alignOutgoingLedgerIdsWithCloud([{section:'cash_flow_ledger',record_id:'retired-copy',data:{...original,id:'retired-copy'},deleted_at:'2026-09-30'}, {section:'cash_flow_ledger',record_id:'original',data:{...original,status:'reversed'}}]);
 assert.equal(j.cashFlowLedger.length,1);assert.equal(j.cashFlowLedger[0].id,'original');
 const k=fixture();k.other=[{section:'bank_balance_overrides',record_id:'state',data:{bank:100}},{section:'outgoings',record_id:'school',data:{payments:['paid']}}];k.cashFlowLedger=[{...original}];k.rememberRecordSyncBaseline(k.buildRecordSyncRowsFromState());k.remote=k.buildRecordSyncRowsFromState().map(r=>({...r,data:JSON.parse(JSON.stringify(r.data))}));
 k.other[0].data={bank:90};k.other[1].data={payments:[]};k.cashFlowLedger[0].status='reversed';k.remote[0].data={bank:80};
 assert.equal(await k.recordPushAll(),false);assert.equal(k.writes.length,0);assert.equal(k.remote.find(r=>r.section==='cash_flow_ledger').data.status,undefined);
 const l=fixture();l.RECORD_SYNC_SINGLETON='singleton';l.bankBalanceOverrides={bank:90,other:25};l.remote=[{section:'bank_balance_overrides',record_id:'singleton',data:{bank:80,other:20}}];l.localStorage.setItem('baseline',JSON.stringify({'bank_balance_overrides|singleton':l.syncRecordValue({bank:100,other:20})}));let backedUp=false;
 l.saveRecoverySnapshot=()=>backedUp=true;l.scheduleRecordPush=()=>{};l.renderCloudReconciliation=async()=>{};
 assert.equal(await l.useCloudBankBalanceValue('bank',90,80),true);assert.equal(l.bankBalanceOverrides.bank,80);assert.equal(l.bankBalanceOverrides.other,25);assert.equal(JSON.parse(l.recordSyncBaseline()['bank_balance_overrides|singleton']).other,20);assert(backedUp);
 await assert.rejects(()=>l.useCloudBankBalanceValue('bank',80,70),/changed/);assert.equal(l.bankBalanceOverrides.bank,80);
 console.log('PASS: stable payment identity, reversal preserved, exact-copy alignment, cloud balance refresh, conflict isolation, changed-payment protection, one-read startup and concurrent refresh coalescing');
})().catch(e=>{console.error(e);process.exitCode=1;});
