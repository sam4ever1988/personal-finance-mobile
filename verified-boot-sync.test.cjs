const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync(__dirname+'/app-07.js','utf8');
function fn(name){const start=source.indexOf('function '+name+'('),end=source.slice(start+1).search(/\n(?:async )?function |\n(?:const|var) /);assert(start>=0,name);return source.slice(start,end<0?source.length:start+1+end);}
const single=['finance_settings','tx_overrides','transaction_actions','duplicate_decisions','merchant_rules','statement_rule','bank_balance_overrides','reset_card_ids','card_reset_history','deleted_installment_ids','custom_banks','custom_credit_cards','income_plan'];
const arrays=['manual_transactions','imported_transactions','cash_flow_ledger','installments','card_payment_plan','outgoings'];
const stable=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
function setup(){
 const storage=new Map(),c={console,window:{financeBootNormalizedRows:[]},financeBootCache:{pf_v185_authoritative_cloud_loaded:'1'},financeSettingsEditing:false,financeSettingsDirty:true,recordPendingDeletes:[],syncRecordValue:stable,cloudRefreshInteractionBlocked:()=>false,RECORD_SYNC_BASELINE_KEY:'baseline',localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},setCloudMeta:x=>c.meta=x,renderCurrentPageForSections:()=>{},saveRecoverySnapshot:()=>c.backup=true,cloudHasLocalEditsSinceBaseline:()=>false};
 c.rows=single.map(section=>({section,record_id:'singleton',data:{}}));
 c.rows.push({section:'manual_transactions',record_id:'salary',data:{id:'salary',amount:-100}});
 c.rows.push({section:'installments',record_id:'plan',data:{id:'plan',remaining:300}});
 for(const section of single)c.financeBootCache['pf_'+section]=JSON.stringify(c.rows.find(r=>r.section===section).data);
 for(const section of arrays)c.financeBootCache['pf_'+section]=JSON.stringify(c.rows.filter(r=>r.section===section).map(r=>r.data));
 c.financeBootCache.pf_record_sync_baseline_v313=JSON.stringify(Object.fromEntries(c.rows.map(r=>[r.section+'|'+r.record_id,stable(r.data)])));
 c.window.financeBootNormalizedRows=JSON.parse(JSON.stringify(c.rows));
 c.buildRecordSyncRowsFromState=()=>c.rows;
 c.applyRecordSyncRows=rows=>{c.rows=rows.filter(r=>!r.deleted_at);return true;};
 c.recordSyncBaseline=()=>JSON.parse(storage.get('baseline')||'{}');
 c.rememberRemoteRecordBaseline=rows=>{const base=c.recordSyncBaseline();for(const r of rows)if(!r.deleted_at)base[r.section+'|'+r.record_id]=stable(r.data);storage.set('baseline',JSON.stringify(base));};
 vm.createContext(c);for(const name of ['verifiedBootFinancialRows','recoverVerifiedBootFinancialCache'])vm.runInContext(fn(name),c);return c;
}
const c=setup(),remote=JSON.parse(JSON.stringify(c.rows));remote.find(r=>r.section==='manual_transactions').data.amount=-125;remote.find(r=>r.section==='installments').data.remaining=200;
// Simulate a pristine cache receiving only startup-generated planner changes.
c.rows.find(r=>r.section==='installments').data.remaining=250;c.window.financeBootNormalizedRows=JSON.parse(JSON.stringify(c.rows));
c.rows.push({section:'personal_assets_gold',record_id:'local-gold',data:{weight:20}});
assert.equal(c.recoverVerifiedBootFinancialCache(remote),true);assert(c.backup);assert.equal(c.rows.find(r=>r.section==='manual_transactions').data.amount,-125);assert.equal(c.rows.find(r=>r.section==='installments').data.remaining,200);assert.equal(c.rows.find(r=>r.section==='personal_assets_gold').data.weight,20);assert.equal(c.meta.pending,false);assert.equal(c.recoverVerifiedBootFinancialCache(remote),false);
for(const mutate of [x=>x.rows[0].data.edited=true,x=>x.window.financeBootUserInteracted=true,x=>delete x.financeBootCache.pf_record_sync_baseline_v313,x=>x.recordPendingDeletes.push({section:'manual_transactions',record_id:'salary'}),x=>x.financeSettingsEditing=true,x=>x.financeBootCache.pf_manual_transactions=JSON.stringify([{id:'salary',amount:-200}]),x=>delete x.financeBootCache.pf_installments]){
 const x=setup();mutate(x);const before=stable(x.rows);assert.equal(x.recoverVerifiedBootFinancialCache(remote),false);assert.equal(stable(x.rows),before);assert(!x.backup);
}
const incomplete=setup();assert.equal(incomplete.recoverVerifiedBootFinancialCache(remote.filter(r=>r.section!=='finance_settings')),false);
// Realtime notifications coalesce a full read; they cannot advance a cursor or
// apply one linked ledger/payment row on its own.
const timers=new Map(),r={window:{financeActiveUserId:'owner',financeWorkspaceUserId:'owner'},recordRealtimePullTimer:0,isMutedRealtimeRecord:()=>false,setTimeout:(cb)=>{const id=timers.size+1;timers.set(id,cb);return id},clearTimeout:id=>timers.delete(id),cloudAutoReconcile:reason=>r.reason=reason};vm.createContext(r);vm.runInContext('async '+fn('handleRealtimeRecordPayload'),r);
(async()=>{await r.handleRealtimeRecordPayload({new:{user_id:'owner',section:'cash_flow_ledger',record_id:'payment'}});await r.handleRealtimeRecordPayload({new:{user_id:'owner',section:'card_payment_plan',record_id:'plan'}});assert.equal(timers.size,1);[...timers.values()][0]();assert.equal(r.reason,'realtime');await r.handleRealtimeRecordPayload({new:{user_id:'other',section:'cash_flow_ledger',record_id:'other'}});assert.equal(timers.size,1);console.log('PASS: verified pristine boot financial refresh, linked records adopted together, unrelated edits retained, recovery backup, unknown baselines/unsaved edits/editor/user actions/deletes/incomplete reads protected; realtime events coalesce without advancing cursors');})().catch(e=>{console.error(e);process.exitCode=1;});
