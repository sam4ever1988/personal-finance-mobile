const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../app-07.js'),'utf8');
const code=source.slice(source.indexOf("async function recordPushAll(reason='edit'){"),source.indexOf('const RECORD_SYNC_BASELINE_KEY='));
const bank={section:'custom_banks',record_id:'singleton',data:[{id:'old'},{id:'tiqmo'}]};
const settings={section:'finance_settings',record_id:'singleton',data:{title:'Office edit'}};
const cloud=[{...bank,data:[{id:'old'}]},{...settings,data:{title:'Mac edit'}}];
const baseline={'custom_banks|singleton':JSON.stringify(cloud[0].data),'finance_settings|singleton':JSON.stringify({title:'Original'})};
let saved=[];
const context={
 recordSyncApplying:false,recordSyncReady:true,recordSyncPushBusy:false,RECORD_SYNC_TABLE:'finance_user_records',
 cloudClient:{auth:{getSession:async()=>({data:{session:{user:{id:'owner'}}}})},from:()=>({upsert:async rows=>{saved.push(...rows);return {error:null}}})},
 window:{financeActiveUserId:'owner',financeWorkspaceUserId:'owner',financeSectionPermission:()=> 'edit'},
 recordFetchAll:async()=>cloud,recordSyncBaseline:()=>baseline,
 buildRecordSyncRowsFromState:()=>[bank,settings],syncRecordValue:JSON.stringify,
 getCloudMeta:()=>({}),setCloudMeta:()=>{},cloudSetStatus:()=>{},
 markLocalRecordWrite:()=>{},rememberRemoteRecordBaseline:()=>{},
 recordPendingDeletes:[],saveRecordDeleteQueue:()=>{},activeViewId:()=>'',console
};
vm.createContext(context);vm.runInContext(code,context);
context.recordPushAll('test').then(result=>{
 assert.equal(result,false,'the conflicting settings still need review');
 assert.deepEqual(saved.map(r=>r.section),['custom_banks'],'the independent bank addition is published');
 assert.equal(saved[0].data[1].id,'tiqmo');
 console.log('A settings conflict does not block a new bank account from syncing.');
}).catch(e=>{console.error(e);process.exitCode=1});
