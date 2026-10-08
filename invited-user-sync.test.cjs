const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const read=n=>fs.readFileSync(__dirname+'/'+n,'utf8'),sync=read('app-07.js'),html=read('index.html');
const fn=(name,next)=>sync.slice(sync.indexOf('function '+name+'('),sync.indexOf(next,sync.indexOf('function '+name+'(')));
assert(html.includes("if(page==='cloudSync')return true;"));
assert(read('app-03.js').includes('data-profile-action="sync"'));
async function verify(shared){
 const elements=new Map(),el=id=>{if(!elements.has(id))elements.set(id,{style:{},textContent:'Load Latest Cloud Data'});return elements.get(id);};
 const rows=[{section:'finance_settings',record_id:'singleton',data:{loans:[]}},{section:'personal_assets_gold',record_id:'hidden',data:{weight:99}}];
 const c={console,Date,window:{financeRestrictedOwnAccess:true,financeSharedWorkspace:shared,financeSectionPermission:s=>s==='finance_settings'?'edit':'off'},$:el,cloudClient:{auth:{getSession:async()=>({data:{session:{user:{id:'invitee'}}}})}},recordFetchAll:async()=>rows,initializeEmptyOwnedWorkspace:async()=>false,recordSyncPullBusy:false,recordSyncPushBusy:false,recordSyncApplying:false,recordSyncLastCloudUpdatedAt:0,manualTransactions:[],importedTransactions:[],installments:[],cardPaymentPlan:[],cashFlowLedger:[],outgoings:[],financeDB:{save:async()=>{}},saveRecoverySnapshot:()=>{c.backup=true;return {};},applyRecordSyncRows:(data,options)=>{c.applied=data;assert(options.authoritative);},buildRecordSyncRowsFromState:()=>rows,rememberRecordSyncBaseline:data=>{c.baseline=data;},noteCloudUpdatedAt:()=>{},renderCurrentPageForSections:()=>{},localStorage:{setItem:()=>{}},setCloudMeta:()=>{},localSyncSummary:()=>({}),cloudSetStatus:()=>{},renderCloudReconciliation:async()=>{},getCloudMeta:()=>({initialized:true,deviceTrusted:true}),confirm:()=>true,activeViewId:()=>'',clearTimeout:()=>{}};
 vm.createContext(c);
 vm.runInContext(fn('syncRowsForAccess','async function renderCloudReconciliationOnce'),c);
 vm.runInContext(fn('v185ActiveCloudCounts','async function initializeEmptyOwnedWorkspace'),c);
 vm.runInContext('async '+fn('cloudDownloadAll','async function refreshCloudSafetyState'),c);
 vm.runInContext(fn('updateCloudSyncPanel','async function cloudInspectState'),c);
 assert.equal(await c.cloudDownloadAll(),true);assert(c.backup);assert.equal(c.applied.length,1);assert.equal(c.baseline.length,1);assert.equal(c.applied[0].section,'finance_settings');assert(c.recordSyncReady);
 c.backup=false;c.applied=null;c.getCloudMeta=()=>({pending:true,initialized:true,deviceTrusted:true});c.confirm=()=>false;assert.equal(await c.cloudDownloadAll(),false);assert.equal(c.backup,false);assert.equal(c.applied,null);
 c.updateCloudSyncPanel(true);assert.equal(el('recoveryCenter').style.display,'none');assert.equal(el('cloudInitialUpload').style.display,'none');assert.equal(el('cloudUpload').disabled,false);
 c.window.financeSectionPermission=s=>s==='finance_settings'?'view':'off';assert.equal(c.syncRowsForAccess(rows,true).length,0);assert.equal(c.syncRowsForAccess(rows).length,1);
}
(async()=>{await verify(false);await verify(true);
 const formats=read('app-08.js');assert(formats.includes('Delete for everyone'));assert(formats.includes('Delete from this workspace'));assert(formats.includes('Hide from this workspace'));assert(formats.includes('hidden:true,active:false'));assert(formats.includes('for ALL users?'));assert(formats.includes('from THIS workspace only?'));
 console.log('PASS: restricted own/shared users access Sync; cloud read keeps recovery backup and filters forbidden data; view-only rows excluded from writes; advanced recovery and initial replacement hidden; deletion scope explicit');
})().catch(e=>{console.error(e);process.exitCode=1;});
