const {readFileSync}=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=readFileSync('experience.js','utf8');
function fixture(){
 const values=new Map(),cacheRows=new Map(),writes=[];let requests=0,fail=false;
 const ctx={console,URL,Response,AbortController,Promise,JSON,Object,Array,String,Error,setTimeout,clearTimeout,location:{href:'https://fixture.test/'},addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}}),localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},document:{documentElement:{dataset:{},style:{}},body:{classList:{toggle(){}}},querySelectorAll:()=>[],querySelector:()=>null,getElementById:()=>null,addEventListener(){}},caches:{open:async()=>({match:async k=>cacheRows.has(k)?cacheRows.get(k).clone():undefined,put:async(k,v)=>cacheRows.set(k,v),keys:async()=>[...cacheRows.keys()].map(url=>({url})),delete:async k=>cacheRows.delete(k.url)})},fetch:async file=>{requests++;if(fail)throw Error('offline');return new Response('/* '+file+' */');}};
 ctx.window=ctx;ctx.financeSupabaseClient={auth:{getSession:async()=>({data:{session:{user:{id:ctx.actor}}}}),updateUser:async data=>{writes.push(data);if(ctx.authFail)throw Error('offline');return {error:null};}}};vm.createContext(ctx);vm.runInContext(source,ctx);
 return {ctx,values,cacheRows,writes,count:()=>requests,fail:()=>fail=true};
}
(async()=>{
 const f=fixture(),w=f.ctx;w.actor='alice';w.financeInitAppearance({id:'alice'});
 assert.equal(w.document.documentElement.dataset.financeDesign,'classic');
 w.financeGetAppearance({theme:'light'});w.financeApplyAppearance();assert.equal(w.document.documentElement.dataset.financeTheme,'light','legacy light retained in Classic');
 w.financeSetAppearance({design:'midnight'});await w.financeSaveAppearance();assert.equal(w.document.documentElement.dataset.financeTheme,'dark');assert.equal(f.writes[0].data.finance_preferences.design,'midnight');assert.deepEqual(Object.keys(f.writes[0].data),['finance_preferences'],'profile save cannot replace finance records or identity');
 w.financeInitAppearance({id:'alice',user_metadata:{finance_preferences:{design:'bright'}}});assert.equal(w.financeGetAppearance().design,'bright','cloud applies on fresh device session');
 w.authFail=true;w.financeSetAppearance({design:'midnight'});await w.financeSaveAppearance();w.financeInitAppearance({id:'alice',user_metadata:{finance_preferences:{design:'bright'}}});assert.equal(w.financeGetAppearance().design,'midnight','unsynced choice survives reload');assert(JSON.parse(f.values.get('finance_appearance_alice')).pending);
 w.actor='bob';w.financeInitAppearance({id:'bob'});assert.equal(w.financeGetAppearance().design,'classic','another user never inherits Alice');
 w.authFail=false;w.financeSetAppearance({design:'bright'});await w.financeSaveAppearance();assert.equal(JSON.parse(f.values.get('finance_appearance_alice')).preferences.design,'midnight');
 // Rapid choices serialize; the final profile write must be the final selection.
 const r=fixture(),a=r.ctx;a.actor='rapid';a.financeInitAppearance({id:'rapid'});let release;
 a.financeSupabaseClient.auth.updateUser=async data=>{r.writes.push(data);if(r.writes.length===1)await new Promise(resolve=>release=resolve);return {error:null};};
 a.financeSetAppearance({design:'midnight'});const saving=a.financeSaveAppearance();await new Promise(resolve=>setTimeout(resolve,0));a.financeSetAppearance({design:'bright'});release();await saving;assert.equal(r.writes.at(-1).data.finance_preferences.design,'bright');
 // Mismatched auth identity cannot save another user's pending preference.
 a.actor='other';a.financeSetAppearance({design:'classic'});await a.financeSaveAppearance();assert.equal(r.writes.length,2);
 const c=fixture(),files=['app-01.js','app-02.js'];const one=await c.ctx.financeLoadAppParts(files,'4.35');await new Promise(resolve=>setTimeout(resolve,0));const two=await c.ctx.financeLoadAppParts(files,'4.35');assert.equal(JSON.stringify(one),JSON.stringify(two));assert.equal(c.count(),2,'warm startup makes no source requests');await c.ctx.financeLoadAppParts(files,'4.36');assert.equal(c.count(),4,'new release refreshes code');
 const bad=fixture();bad.fail();await assert.rejects(bad.ctx.financeLoadAppParts(files,'bad'));assert.equal(bad.cacheRows.size,0,'partial/error download never cached');
 const unavailable=fixture();unavailable.ctx.caches.open=async()=>{throw Error('blocked')};await unavailable.ctx.financeLoadAppParts(files,'4.35');assert.equal(unavailable.count(),2,'cache unavailable falls back to network');
 await assert.rejects(w.financeLoadDeadline(new Promise(()=>{}),'Workspace',5),/Workspace timed out/);
 const html=readFileSync('index.html','utf8');for(const [i,match]of [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].entries())new vm.Script(match[1],{filename:'index-inline-'+i});
 console.log('PASS: Classic migration; dark/light themes; per-user profile save; pending/offline recovery; rapid selection ordering; identity guard; versioned code cache; cache failure fallback; loading timeout; inline script syntax.');
})().catch(error=>{console.error(error);process.exitCode=1;});
