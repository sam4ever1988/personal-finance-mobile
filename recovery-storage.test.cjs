const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync(__dirname+'/app-07.js','utf8');
const constants=source.slice(source.indexOf("const RECOVERY_KEY="),source.indexOf('function rawLocalRecoveryState('));
function fn(name){const start=source.indexOf('function '+name+'('),end=source.indexOf('\nfunction ',start+1);return source.slice(start,end);}
const key='pf_recovery_snapshots_v138';
function fixture(quota=Infinity){
 const old=Array.from({length:8},(_,i)=>({reason:'old-'+i,data:'x'.repeat(1000)}));
 const values=new Map([[key,JSON.stringify(old)],['pf_finance_settings','live records']]);
 const attempts=[];const c={JSON,Error,localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>{attempts.push(v.length);if(v.length>quota){const e=new Error('quota');e.name='QuotaExceededError';throw e;}values.set(k,v);}},rawLocalRecoveryState:reason=>({reason,data:'new'.repeat(400)}),renderRecoveryStatus:()=>{}};
 vm.createContext(c);vm.runInContext(constants+fn('getRecoverySnapshots')+fn('saveRecoverySnapshot'),c);
 return {c,values,attempts,setQuota:n=>quota=n};
}
const a=fixture(2500);a.c.saveRecoverySnapshot('payment');
assert(a.attempts.length>1);assert(a.c.getRecoverySnapshots().length===2);
assert.equal(a.c.getRecoverySnapshots()[0].reason,'payment');assert.equal(a.c.getRecoverySnapshots()[1].reason,'old-0');assert.equal(a.values.get('pf_finance_settings'),'live records');
const b=fixture();b.c.rawLocalRecoveryState=()=>({data:'x'.repeat(300000)});b.c.saveRecoverySnapshot();b.c.saveRecoverySnapshot();assert.equal(b.c.getRecoverySnapshots().length,1);assert(b.values.get(key).length<512*1024);
const d=fixture(100);const prior=d.values.get(key);assert.throws(()=>d.c.saveRecoverySnapshot(),/Device storage is full/);assert.equal(d.values.get(key),prior);
const e=fixture();e.c.localStorage.setItem=()=>{throw new Error('Access denied');};assert.throws(()=>e.c.saveRecoverySnapshot(),/Access denied/);
const f=fixture();for(let i=0;i<10;i++)f.c.saveRecoverySnapshot('new-'+i);assert.equal(f.c.getRecoverySnapshots().length,8);assert.equal(f.c.getRecoverySnapshots()[0].reason,'new-9');
console.log('PASS: size/count limits, quota retry, newest complete backup retained, older backups preserved on total failure, unrelated data untouched, non-quota errors surfaced');
