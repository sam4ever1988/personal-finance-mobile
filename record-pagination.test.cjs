const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/app-07.js','utf8');
const code=source.slice(source.indexOf('async function recordFetchPages('),source.indexOf('async function recordFetchLatestUpdatedAt'));
async function run(size,{cap=500,failAt=-1,changeCount=false,since=null}={}){
 const records=Array.from({length:size},(_,i)=>({section:'cash_flow_ledger',record_id:String(i),data:{amount:i},updated_at:'2026-11-16',deleted_at:i===4?'2026-11-15':null}));
 const calls=[];
 const context={window:{financeActiveUserId:'owner',financeWorkspaceUserId:'workspace'},RECORD_SYNC_TABLE:'finance_user_records',cloudClient:{auth:{getSession:async()=>({data:{session:{user:{id:'owner'}}}})},from(table){assert.equal(table,'finance_user_records');const q={select(fields,options){assert.equal(options.count,'exact');return q},eq(k,v){assert.equal(k,'user_id');assert.equal(v,'workspace');return q},gt(k,v){assert.equal(k,'updated_at');assert.equal(v,since);return q},order(k){calls.push(k);return q},async range(from,to){calls.push([from,to]);return {data:records.slice(from,Math.min(to+1,from+cap)),error:from===failAt?new Error('network failure'):null,count:size+(changeCount&&from>0?1:0)}}};return q}}};
 vm.createContext(context);vm.runInContext(code,context);
 return {rows:await context.recordFetchPages(since),calls};
}
(async()=>{
 for(const size of [0,1,500,1000,1018,2401]){const {rows}=await run(size);assert.equal(rows.length,size);assert.equal(new Set(rows.map(r=>r.record_id)).size,size);}
 const {rows}=await run(1018,{cap:200,since:'2026-11-15'});assert.equal(rows.length,1018);assert.ok(rows[4].deleted_at);
 await assert.rejects(run(1018,{failAt:500}),/network failure/);
 await assert.rejects(run(1018,{changeCount:true}),/changed during loading/);
 assert.match(source,/async function recordFetchChangedSince\(iso\)\{return recordFetchPages\(iso\);\}/);
 console.log('Record pagination: full/delta, 1018+ rows, server caps, tombstones and failed pages passed');
})().catch(e=>{console.error(e);process.exitCode=1});
