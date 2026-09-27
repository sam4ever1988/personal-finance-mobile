const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../app-07.js'),'utf8');
const code=source.slice(source.indexOf('function safeIncomingRecordRows(remote){'),source.indexOf('function schedulePeriodicCloudAutoSync(){'));
const cloud=[
 {section:'custom_banks',record_id:'singleton',data:[{id:'new-bank'}],updated_at:'2026-09-27T09:00:00Z'},
 {section:'rental_units',record_id:'unit-1',data:{id:'unit-1',name:'Office update'},updated_at:'2026-09-27T09:01:00Z'},
 {section:'manual_transactions',record_id:'tx-1',data:{id:'tx-1',amount:50},updated_at:'2026-09-27T09:02:00Z'},
 {section:'rental_bookings',record_id:'booking-1',data:{id:'booking-1'},updated_at:'2026-09-27T09:03:00Z'},
 {section:'rental_blocks',record_id:'1',data:{date:'2026-09-27'},updated_at:'2026-09-27T09:04:00Z'},
 {section:'manual_transactions',record_id:'tx-2',data:{},deleted_at:'2026-09-27T09:05:00Z',updated_at:'2026-09-27T09:05:00Z'}
];
const local=[
 {section:'custom_banks',record_id:'singleton',data:[{id:'old-bank'}]},
 {section:'rental_units',record_id:'unit-1',data:{id:'unit-1',name:'Mac edit'}},
 {section:'manual_transactions',record_id:'tx-2',data:{id:'tx-2',amount:20}}
];
const key=r=>`${r.section}|${r.record_id}`;
const baseline=Object.fromEntries(local.map(r=>[key(r),JSON.stringify(r.data)]));
baseline['rental_units|unit-1']=JSON.stringify({id:'unit-1',name:'Original'});
let applied=[];
const context={
 recordFetchAll:async()=>cloud,buildRecordSyncRowsFromState:()=>local,
 recordSyncBaseline:()=>baseline,recordPendingDeletes:[],
 syncRecordValue:JSON.stringify,saveRecoverySnapshot:()=>{},
 applyRecordSyncDeltaRows:rows=>{applied=rows;return {changed:true,appliedRows:rows}},
 rememberRemoteRecordBaseline:()=>{},noteCloudUpdatedAt:()=>{}
};
vm.createContext(context);
vm.runInContext(code,context);
context.recoverCloudOnlyRecords().then(()=>{
 assert.deepEqual(applied.map(key).sort(),[
  'custom_banks|singleton','manual_transactions|tx-1',
  'manual_transactions|tx-2','rental_bookings|booking-1'
 ].sort());
 console.log('Cloud catch-up restores safe updates, additions and deletions while preserving a Mac edit.');
}).catch(e=>{console.error(e);process.exitCode=1});
