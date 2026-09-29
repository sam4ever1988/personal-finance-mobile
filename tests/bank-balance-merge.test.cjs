const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../app-07.js'),'utf8');
const code=source.slice(source.indexOf('function mergeBankBalanceFields('),source.indexOf('function recordSyncBaseline(){'));
const ctx={syncRecordValue:JSON.stringify};vm.createContext(ctx);vm.runInContext(code,ctx);
const result=ctx.mergeBankBalanceFields(
 {alrajhi:100,tiqmo:0},
 {alrajhi:90,tiqmo:0},
 {alrajhi:100,tiqmo:50}
);
assert.deepEqual(JSON.parse(JSON.stringify(result)),{data:{alrajhi:90,tiqmo:50},conflicts:[]});
const overlapping=ctx.mergeBankBalanceFields({alrajhi:100},{alrajhi:90},{alrajhi:95});
assert.deepEqual(Array.from(overlapping.conflicts),['alrajhi']);
const added=ctx.mergeBankBalanceFields({alrajhi:100},{alrajhi:100,tiqmo:-3000},{alrajhi:100,stc:20});
assert.deepEqual(JSON.parse(JSON.stringify(added)),{data:{alrajhi:100,tiqmo:-3000,stc:20},conflicts:[]});
console.log('Independent account balances merge; simultaneous edits to the same account remain flagged.');

const pushCode=source.slice(source.indexOf("async function recordPushAll(reason='edit'){"),source.indexOf('const RECORD_SYNC_BASELINE_KEY='))+source.slice(source.indexOf('const recentOwnBankBalanceWrites='),source.indexOf('function recordSyncBaseline(){'))+code;
let local={alrajhi:90,tiqmo:0},remote={alrajhi:100,tiqmo:50},published=[];
const cloudRow=()=>({section:'bank_balance_overrides',record_id:'singleton',data:remote});
const pushCtx={
 recordSyncApplying:false,recordSyncReady:true,recordSyncPushBusy:false,RECORD_SYNC_TABLE:'finance_user_records',
 cloudClient:{auth:{getSession:async()=>({data:{session:{user:{id:'owner'}}}})},from:()=>({upsert:async rows=>{published.push(...rows);remote=rows[0].data;return {error:null}}})},
 window:{financeActiveUserId:'owner',financeWorkspaceUserId:'owner',financeSectionPermission:()=> 'edit'},
 recordFetchAll:async()=>[cloudRow()],recordSyncBaseline:()=>({'bank_balance_overrides|singleton':JSON.stringify({alrajhi:100,tiqmo:0})}),
 buildRecordSyncRowsFromState:()=>[{section:'bank_balance_overrides',record_id:'singleton',data:local}],
 syncRecordValue:JSON.stringify,recordPendingDeletes:[],saveRecordDeleteQueue:()=>{},
 setCloudMeta:()=>{},getCloudMeta:()=>({}),cloudSetStatus:()=>{},markLocalRecordWrite:()=>{},
 rememberRemoteRecordBaseline:()=>{},rememberRecordSyncBaseline:()=>{},
 applyRecordSyncDeltaRows:rows=>{local=rows[0].data;return {changed:true}},
 activeViewId:()=>'',financeSettingsDirty:false,console
};
vm.createContext(pushCtx);vm.runInContext(pushCode,pushCtx);
pushCtx.recordPushAll('balance-merge-test').then(ok=>{
 assert.equal(ok,true);
 assert.deepEqual(JSON.parse(JSON.stringify(remote)),{alrajhi:90,tiqmo:50});
 assert.deepEqual(JSON.parse(JSON.stringify(local)),{alrajhi:90,tiqmo:50});
 assert.equal(published.length,1);
 console.log('Protected push publishes the merged balances and applies them locally.');
}).catch(e=>{console.error(e);process.exitCode=1});

// The first payment may be on the server while the device baseline still
// predates it. The next payment must not be rejected as a cross-device conflict.
const rapidCtx={...pushCtx};
rapidCtx.recordSyncPushBusy=false;
rapidCtx.clearTimeout=clearTimeout;
rapidCtx.setTimeout=setTimeout;
let rapidLocal={tiqmo:-3805},rapidRemote={tiqmo:-3000},rapidWrites=0;
rapidCtx.cloudClient={auth:{getSession:async()=>({data:{session:{user:{id:'owner'}}}})},from:()=>({upsert:async rows=>{rapidWrites++;rapidRemote=rows[0].data;return {error:null}}})};
rapidCtx.recordFetchAll=async()=>[{section:'bank_balance_overrides',record_id:'singleton',data:rapidRemote}];
rapidCtx.recordSyncBaseline=()=>({'bank_balance_overrides|singleton':JSON.stringify({tiqmo:-3000})});
rapidCtx.buildRecordSyncRowsFromState=()=>[{section:'bank_balance_overrides',record_id:'singleton',data:rapidLocal}];
rapidCtx.applyRecordSyncDeltaRows=rows=>{rapidLocal=rows[0].data;return {changed:true}};
vm.createContext(rapidCtx);vm.runInContext(pushCode,rapidCtx);
(async()=>{
 assert.equal(await rapidCtx.recordPushAll('first-payment'),true);
 rapidLocal={tiqmo:-4667.5};
 assert.equal(await rapidCtx.recordPushAll('second-payment'),true);
 assert.equal(rapidRemote.tiqmo,-4667.5);
 assert.equal(rapidWrites,2);
 console.log('Consecutive payments sync even when the baseline trails this device.');
})().catch(e=>{console.error(e);process.exitCode=1});
