const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=name=>fs.readFileSync(require('node:path').join(__dirname,'..',name),'utf8');

async function testCacheSwitch(){
 const source='window.financeScopeSwitch='+read('index.html').split('window.financeScopeSwitch=')[1].split('window.financeScopeWipe=')[0];
 const actor='owner',other='member',mem=new Map([['pf_secret','own-data']]),sessionMem=new Map(),slots=new Map();
 const storage=new Proxy({getItem:k=>mem.get(k)||null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k)},
  {ownKeys:()=>[...mem.keys()],getOwnPropertyDescriptor:()=>({enumerable:true,configurable:true})});
 const tabStorage=new Proxy({getItem:k=>sessionMem.get(k)||null,setItem:(k,v)=>sessionMem.set(k,String(v)),removeItem:k=>sessionMem.delete(k)},
  {ownKeys:()=>[...sessionMem.keys()],getOwnPropertyDescriptor:()=>({enumerable:true,configurable:true})});
 const c={window:{financeWorkspaceUserId:actor},localStorage:storage,sessionStorage:tabStorage,
  indexedDB:{databases:async()=>[]},
  scoped:{from:()=>({select:()=>({limit:async()=>({data:[{id:1}]})})})},
  cacheSlot:async(k,v)=>{if(v===undefined)return slots.get(k);slots.set(k,v)}};
 vm.createContext(c);vm.runInContext(source,c);
 await c.window.financeScopeSwitch({user:{id:actor}});
 slots.set(actor+'|'+other,{pf_secret:'old-shared-disk-copy'});
 c.window.financeWorkspaceUserId=other;
 await c.window.financeScopeSwitch({user:{id:actor}});
 assert.equal(storage.getItem('pf_secret'),null);
 assert.equal(storage.getItem('pf_active_user_id'),actor+'|'+other);
 assert.equal(slots.get(actor+'|'+other).pf_secret,undefined);
 tabStorage.setItem('pf_secret','shared-data');
 await c.window.financeScopeSwitch({user:{id:actor}});
 assert.equal(tabStorage.getItem('pf_secret'),'shared-data');
 c.window.financeWorkspaceUserId=actor;
 await c.window.financeScopeSwitch({user:{id:actor}});
 assert.equal(storage.getItem('pf_secret'),'own-data');
 assert.equal(tabStorage.getItem('pf_secret'),null);
 assert.equal(slots.get(actor+'|'+other).pf_secret,undefined);
}
function testNavigation(){
 const source=read('app-03.js').split('function closeCanonicalMobileSheet')[0];
 const c={window:{financeWorkspaceChoices:[{id:'owner',name:'Mine',own:true},{id:'member',name:'Sam',own:false}],
  financeWorkspaceUserId:'member',financeCanViewPage:page=>page==='rental'}};
 vm.createContext(c);vm.runInContext(source,c);
 const html=c.canonicalTopHTML();
 assert.match(html,/Airbnb \/ Rental/);assert.match(html,/Sam/);
 assert.doesNotMatch(html,/>Investments<|>Reports<|>Dashboard</);
}
function testRentalReport(){
 const source=read('app-10.js').split('/* V283 initialize')[0];
 const nodes={rentalReport:{innerHTML:''},rentalReportPeriod:{value:'daily'}};
 const c={console,Date,Number,Math,String,Array,Map,Set,JSON,
  localStorage:{getItem:()=>null,setItem(){}},document:{getElementById:id=>nodes[id]||null},setTimeout(){}};
 c.window=c;vm.createContext(c);vm.runInContext(source,c);
 c.rentalBookings=[{id:1,checkin:'2026-09-29',checkout:'2026-10-04',dailyRate:200,organiserFee:30,paid:true,paymentDate:'2026-09-30',paidAmount:1000}];
 c.rentalView=new Date(2026,9,1);
 assert.equal(c.rentalMonthDataFor(new Date(2026,8,1)).booked,2);
 assert.equal(c.rentalMonthDataFor(new Date(2026,9,1)).booked,3);
 c.rentalUnits.push({id:'other',name:'Other Unit',organiserFee:20});
 for(const period of ['daily','weekly','monthly','yearly']){
  nodes.rentalReportPeriod.value=period;c.renderRentalReport();
  assert.match(nodes.rentalReport.innerHTML,/Revenue \/ Available Night/);
  assert.match(nodes.rentalReport.innerHTML,/Other Unit/);
 }
 c.rentalUnitId='other';assert.equal(c.rentalMonthDataFor(new Date(2026,9,1)).revenue,0);
}
(async()=>{await testCacheSwitch();testNavigation();testRentalReport();console.log('Shared tab cache switch, restricted navigation and rental reports passed.');})().catch(e=>{console.error(e);process.exitCode=1});
