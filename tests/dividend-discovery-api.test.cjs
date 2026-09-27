const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const src=fs.readFileSync('api/dividend-discovery.js','utf8').replace('export default async function handler','async function handler')+'\nthis.handler=handler';
const calls=[];const ctx={Date,Number,String,Set,Promise,AbortSignal,process:{env:{FMP_API_KEY:'secret'}},fetch:async url=>{calls.push(url);return url.includes('/auth/v1/user')?{ok:true}:{ok:true,json:async()=>[{symbol:'RIO',date:'2026-08-14',paymentDate:'2026-09-24',dividend:2.11}]}}};vm.createContext(ctx);vm.runInContext(src,ctx);
const response=()=>({status(n){this.code=n;return this},json(data){this.body=data;return this},setHeader(){}});
(async()=>{
 const denied=response();await ctx.handler({method:'GET',query:{symbols:'RIO'},headers:{}},denied);assert.equal(denied.code,401);assert.equal(calls.length,0);
 const ok=response();await ctx.handler({method:'GET',query:{symbols:'RIO'},headers:{authorization:'Bearer token'}},ok);assert.equal(ok.code,200);assert.equal(ok.body.items[0].amount,2.11);assert.equal(ok.body.items[0].payDate,'2026-09-24');assert(calls.some(s=>s.includes('apikey=secret')));
 ctx.process.env.FMP_API_KEY='';const missing=response();await ctx.handler({method:'GET',query:{symbols:'RIO'},headers:{authorization:'Bearer token'}},missing);assert.equal(missing.code,503);assert.equal(missing.body.code,'FEED_NOT_CONFIGURED');
 console.log('Discovery API requires session, returns only valid dividend data, and flags missing feed configuration.');
})().catch(e=>{console.error(e);process.exitCode=1});
