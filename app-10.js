/* V283 Airbnb / Rental Management */
var rentalBookings=JSON.parse(localStorage.getItem("pf_rental_bookings")||"[]");
var rentalExpenses=JSON.parse(localStorage.getItem("pf_rental_expenses")||"[]");
var rentalBlocks=JSON.parse(localStorage.getItem("pf_rental_blocks")||"[]");
window.rentalView=new Date();rentalView.setDate(1);
function rentalSave(){localStorage.setItem("pf_rental_bookings",JSON.stringify(rentalBookings));localStorage.setItem("pf_rental_expenses",JSON.stringify(rentalExpenses));localStorage.setItem("pf_rental_blocks",JSON.stringify(rentalBlocks));if(typeof scheduleCloudAutoSave==="function")scheduleCloudAutoSave()}
function rDate(s){return new Date(s+"T12:00:00")}
window.rIso=function(d){return d.toISOString().slice(0,10)}
function rMoney(n){return "SAR "+Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}
function rNights(a,b){return Math.max(1,Math.round((rDate(b)-rDate(a))/86400000))}
function rentalMonthData(){
 var y=rentalView.getFullYear(),m=rentalView.getMonth(),start=new Date(y,m,1),end=new Date(y,m+1,1),days=new Date(y,m+1,0).getDate(),revenue=0,booked=0;
 rentalBookings.forEach(b=>{var a=rDate(b.checkin),z=rDate(b.checkout),over=Math.max(0,(Math.min(z,end)-Math.max(a,start))/86400000);if(over>0){booked+=over;revenue+=Number(b.dailyRate??(Number(b.total||0)/rNights(b.checkin,b.checkout)))*over}});
 var expenses=rentalExpenses.filter(e=>{var d=rDate(e.date);return d>=start&&d<end}).reduce((s,e)=>s+Number(e.amount||0),0);
 return{revenue,expenses,net:revenue-expenses,booked,days,occupancy:days?booked/days*100:0,adr:booked?revenue/booked:0}
}
window.renderRental=function(){
 var cal=document.getElementById("rentalCalendar");if(!cal)return;var y=rentalView.getFullYear(),m=rentalView.getMonth(),md=rentalMonthData();
 document.getElementById("rentalMonthTitle").textContent=rentalView.toLocaleDateString("en-US",{month:"long",year:"numeric"});
 document.getElementById("rentalKpis").innerHTML=[["Monthly Revenue",rMoney(md.revenue),"income"],["Monthly Expenses",rMoney(md.expenses),"expense"],["Net Rental Income",rMoney(md.net),md.net>=0?"income":"expense"],["Occupancy",md.occupancy.toFixed(0)+"%","occupancy"],["Booked Nights",md.booked.toFixed(0)+" / "+md.days,"nights"],["Avg. Nightly Rate",rMoney(md.adr),"rate"]].map(x=>'<div class="rentalKpi '+x[2]+'"><span>'+x[0]+'</span><b>'+x[1]+'</b></div>').join("");
 var first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate(),html="";
 for(var p=0;p<first;p++)html+='<div class="rentalDay empty"></div>';
 for(var d=1;d<=days;d++){var dt=new Date(y,m,d),iso=rIso(dt),booking=rentalBookings.find(b=>iso>=b.checkin&&iso<b.checkout),block=rentalBlocks.find(b=>b.date===iso),cls=booking?"booked":block?.status||"available",label=booking?(booking.ref||"Booked"):(block?.status==="maintenance"?"Maintenance":block?.status==="blocked"?"Blocked":"Available");
  html+='<button class="rentalDay '+cls+'" data-date="'+iso+'"><span class="rentalDayNo">'+d+'</span><span class="rentalDayState">'+label+'</span>'+(booking?'<small>'+rMoney(Number(booking.dailyRate??(Number(booking.total||0)/rNights(booking.checkin,booking.checkout))))+'</small>':'')+'</button>'}
 cal.innerHTML=html;cal.querySelectorAll(".rentalDay:not(.empty)").forEach(b=>b.onclick=()=>rentalOpenDay(b.dataset.date));
 document.getElementById("rentalMonthFinance").innerHTML='<div class="rentalFinanceRow"><span>Gross booking revenue</span><b>'+rMoney(md.revenue)+'</b></div><div class="rentalFinanceRow"><span>Operating expenses</span><b class="red">− '+rMoney(md.expenses)+'</b></div><div class="rentalFinanceRow total"><span>Net rental income</span><b class="'+(md.net>=0?"green":"red")+'">'+rMoney(md.net)+'</b></div><div class="rentalOcc"><div><span>Occupancy</span><b>'+md.occupancy.toFixed(0)+'%</b></div><div class="rentalOccBar"><i style="width:'+Math.min(100,md.occupancy)+'%"></i></div></div>';
 var now=rIso(new Date()),up=rentalBookings.filter(b=>b.checkout>=now).sort((a,b)=>a.checkin.localeCompare(b.checkin)).slice(0,5);
 document.getElementById("rentalUpcoming").innerHTML=up.length?up.map(b=>'<div class="rentalUpcoming"><div><b>'+b.checkin+' → '+b.checkout+'</b><span>'+(b.ref||"Booking")+' • '+rNights(b.checkin,b.checkout)+' nights</span></div><b>'+rMoney(b.total)+'</b></div>').join(""):'<div class="meta rentalEmpty">No upcoming bookings yet.</div>';
 document.getElementById("rentalBookingBody").innerHTML=rentalBookings.slice().sort((a,b)=>b.checkin.localeCompare(a.checkin)).map((b,i)=>'<tr><td><b>'+b.checkin+'</b><small>to '+b.checkout+'</small></td><td>'+(b.ref||"—")+'</td><td>'+rNights(b.checkin,b.checkout)+'</td><td><b>'+rMoney(Number(b.dailyRate??(Number(b.total||0)/rNights(b.checkin,b.checkout))))+'</b><small>/ night</small></td><td><button type="button" class="rentalBadge rentalPaymentToggle '+(b.paid?"paid":"pending")+'" data-id="'+b.id+'" title="Click to change payment status">'+(b.paid?("Received ✓<small>"+rMoney(Number(b.paidAmount||Number(b.dailyRate??(Number(b.total||0)/rNights(b.checkin,b.checkout)))*rNights(b.checkin,b.checkout)))+(b.paymentDate?" • "+b.paymentDate:"")+"</small>"):"Pending • Mark Paid")+'</button></td><td>'+((b.checkout<now)?"Completed":b.checkin<=now?"Occupied":"Booked")+'</td><td><button class="btn rentalDeleteBooking" data-i="'+i+'">Delete</button></td></tr>').join("")||'<tr><td colspan="7" class="meta">No bookings recorded.</td></tr>';
 document.querySelectorAll(".rentalPaymentToggle").forEach(b=>b.onclick=()=>{var x=rentalBookings.find(v=>String(v.id)===String(b.dataset.id));if(!x)return;var newPaid=!x.paid;x.paid=newPaid;x.paidAmount=newPaid?Number(x.dailyRate??(Number(x.total||0)/rNights(x.checkin,x.checkout)))*rNights(x.checkin,x.checkout):0;x.paymentDate=newPaid?rIso(new Date()):"";if(newPaid){var related=rentalBookings.filter(v=>v!==x&&!v.paid&&v.ref&&x.ref&&v.ref.trim().toLowerCase()===x.ref.trim().toLowerCase());if(related.length&&confirm("Mark all "+(related.length+1)+" bookings in this sequence/reference as paid?"))related.forEach(v=>{v.paid=true;v.paidAmount=Number(v.dailyRate??(Number(v.total||0)/rNights(v.checkin,v.checkout)))*rNights(v.checkin,v.checkout);v.paymentDate=rIso(new Date())})}rentalSave();renderRental()});
 document.querySelectorAll(".rentalDeleteBooking").forEach(b=>b.onclick=()=>{if(confirm("Delete this booking?")){var sorted=rentalBookings.slice().sort((a,b)=>b.checkin.localeCompare(a.checkin)),target=sorted[Number(b.dataset.i)];rentalBookings=rentalBookings.filter(x=>x!==target);rentalSave();renderRental()}});
 var exp=rentalExpenses.filter(e=>rDate(e.date).getFullYear()===y&&rDate(e.date).getMonth()===m).sort((a,b)=>b.date.localeCompare(a.date));
 document.getElementById("rentalExpenses").innerHTML=exp.length?exp.map(e=>'<div class="rentalExpenseLine"><div><b>'+e.category+'</b><span>'+e.date+(e.note?" • "+e.note:"")+'</span></div><div class="rentalExpenseRight"><b>− '+rMoney(e.amount)+'</b><div class="rentalExpenseActions"><button type="button" class="btn rentalEditExpense" data-id="'+e.id+'">Edit</button><button type="button" class="btn danger rentalDeleteExpense" data-id="'+e.id+'">Delete</button></div></div></div>').join(""):'<div class="meta rentalEmpty">No expenses recorded for this month.</div>';
 document.querySelectorAll(".rentalEditExpense").forEach(b=>b.onclick=()=>rentalOpenExpense(b.dataset.id));
 document.querySelectorAll(".rentalDeleteExpense").forEach(b=>b.onclick=()=>{var x=rentalExpenses.find(e=>String(e.id)===String(b.dataset.id));if(!x)return;if(confirm("Delete "+x.category+" expense of "+rMoney(x.amount)+"?")){rentalExpenses=rentalExpenses.filter(e=>String(e.id)!==String(b.dataset.id));rentalSave();renderRental()}});

}
window.rentalOpenDay=function(date){
 var booking=rentalBookings.find(b=>date>=b.checkin&&date<b.checkout);
 if(booking){rentalOpenBooking(date);return}
 var block=rentalBlocks.find(b=>b.date===date);
 rentalModal("Manage "+date,'<div class="field full"><label>Day Status</label><select name="status"><option value="available"'+(!block?' selected':'')+'>Available / Create Booking</option><option value="blocked"'+(block?.status==="blocked"?' selected':'')+'>Blocked</option><option value="maintenance"'+(block?.status==="maintenance"?' selected':'')+'>Maintenance</option></select></div><div class="field full"><label>Reason / Note</label><input name="note" value="'+(block?.note||'')+'" placeholder="Optional reason"></div>',fd=>{
  var status=fd.get("status"),note=fd.get("note");rentalBlocks=rentalBlocks.filter(b=>b.date!==date);
  if(status==="available"){if(block){/* restore this date to available only */}else setTimeout(()=>rentalOpenBooking(date),0)}else rentalBlocks.push({date,status,note})
 });
}
function rentalModal(title,fields,onSave){
 var old=document.getElementById("rentalModal");if(old)old.remove();var d=document.createElement("div");d.className="modalBack open";d.id="rentalModal";d.innerHTML='<div class="modal"><div class="modalHead"><div class="modalTitle">'+title+'</div><button class="closeBtn" type="button">✕</button></div><form class="formGrid" id="rentalForm">'+fields+'<div class="field full" style="display:flex;justify-content:flex-end;gap:8px"><button type="button" class="btn rentalCancel">Cancel</button><button class="btn primary" type="submit">Save</button></div></form></div>';document.body.appendChild(d);d.querySelector(".closeBtn").onclick=d.querySelector(".rentalCancel").onclick=()=>d.remove();d.querySelector("form").onsubmit=e=>{e.preventDefault();onSave(new FormData(e.target));d.remove();rentalSave();renderRental()}
}
window.rentalOpenBooking=function(date){
 rentalModal("Add Booking",'<div class="field"><label>Check-in</label><input name="checkin" type="date" required value="'+(date||rIso(new Date()))+'"></div><div class="field"><label>Check-out</label><input name="checkout" type="date" required value="'+rIso(new Date(rDate(date||rIso(new Date())).getTime()+86400000))+'"></div><div class="field"><label>Booking Reference</label><input name="ref" placeholder="Airbnb reference or guest initials"></div><div class="field"><label>Daily Rate (SAR / night)</label><input name="dailyRate" type="number" min="0" step="0.01" required></div><div class="field"><label>Payment</label><select name="paid"><option value="1">Received</option><option value="0">Pending</option></select></div><div class="field"><label>Notes</label><input name="note"></div>',fd=>{var a=fd.get("checkin"),z=fd.get("checkout");if(z<=a){alert("Check-out must be after check-in.");return}rentalBookings.push({id:Date.now(),checkin:a,checkout:z,ref:fd.get("ref"),dailyRate:Number(fd.get("dailyRate")),paid:fd.get("paid")==="1",paidAmount:fd.get("paid")==="1"?Number(fd.get("dailyRate"))*rNights(a,z):0,paymentDate:fd.get("paid")==="1"?rIso(new Date()):"",note:fd.get("note")})});
}
window.rentalOpenExpense=function(id){
 var existing=id!=null?rentalExpenses.find(e=>String(e.id)===String(id)):null;
 var categories=["Cleaning","Laundry","Utilities","Internet","Maintenance","Supplies","Platform Fee","Furniture","Other"];
 var categoryOptions=categories.map(c=>'<option'+(existing&&existing.category===c?' selected':'')+'>'+c+'</option>').join("");
 rentalModal(existing?"Edit Rental Expense":"Add Rental Expense",'<div class="field"><label>Date</label><input name="date" type="date" required value="'+(existing?.date||rIso(new Date()))+'"></div><div class="field"><label>Category</label><select name="category">'+categoryOptions+'</select></div><div class="field"><label>Amount (SAR)</label><input name="amount" type="number" min="0" step="0.01" required value="'+(existing?.amount??"")+'"></div><div class="field"><label>Note</label><input name="note" value="'+String(existing?.note||"").replace(/"/g,"&quot;")+'"></div>',fd=>{
  var data={id:existing?.id||Date.now(),date:fd.get("date"),category:fd.get("category"),amount:Number(fd.get("amount")),note:fd.get("note")};
  if(existing){Object.assign(existing,data)}else rentalExpenses.push(data)
 })
}
/* Rental controls use direct inline handlers from index.html. */

/* V283 initialize the single-source top shell after the combined bundle is ready */
setTimeout(function(){try{syncCanonicalShell(typeof activeViewId==='function'?(activeViewId()||'executive'):'executive');}catch(e){console.error('Canonical shell init',e)}},0);

/* V283 account + preferences */
(function(){
 const PROFILE_KEY='pf_profile_v283',PREF_KEY='pf_preferences_v283';
 const getProfile=()=>{try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||'{}')}catch(e){return {}}};
 const getPrefs=()=>{try{return JSON.parse(localStorage.getItem(PREF_KEY)||'{}')}catch(e){return {}}};
 function effectiveTheme(t){return t==='system'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):(t||'dark')}
 window.applyFinancePreferences=function(){
  const p=getPrefs(),theme=p.theme||'dark',resolved=effectiveTheme(theme);
  document.documentElement.dataset.financeTheme=resolved;
  document.documentElement.dataset.themePreference=theme;
  document.documentElement.style.colorScheme=resolved;
  if(document.body)document.body.classList.toggle('compactFinanceNav',!!p.compactNav);
  const st=document.getElementById('prefThemeStatus');if(st)st.textContent=theme[0].toUpperCase()+theme.slice(1);
  const ck=document.getElementById('prefCompactNav');if(ck)ck.checked=!!p.compactNav;
  document.querySelectorAll('[data-theme-choice]').forEach(b=>{const on=b.dataset.themeChoice===theme;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',on?'true':'false')});
  try{if(typeof syncCanonicalShell==='function')syncCanonicalShell(typeof activeViewId==='function'?(activeViewId()||'preferences'):'preferences')}catch(e){}
 };
 window.renderAccountProfile=function(){
  const p=getProfile(),name=p.name||'Hussam Ahmad',email=p.email||'',initials=(p.initials||'HA').toUpperCase().slice(0,3);
  ['accountAvatarPreview'].forEach(id=>{const e=document.getElementById(id);if(e)e.textContent=initials});
  const n=document.getElementById('accountNamePreview');if(n)n.textContent=name;
  const em=document.getElementById('accountEmailPreview');if(em)em.textContent=email||'Local profile • Login not connected yet';
  const dn=document.getElementById('accountDisplayName');if(dn)dn.value=name;const ei=document.getElementById('accountEmail');if(ei)ei.value=email;const ii=document.getElementById('accountInitials');if(ii)ii.value=initials;
  document.querySelectorAll('.canonicalAvatar>span:first-child,.profileIdentity>b').forEach(e=>e.textContent=initials);
  const pi=document.querySelector('.profileIdentity span');if(pi)pi.textContent=email||name;
 };
 document.addEventListener('click',e=>{const b=e.target.closest('[data-theme-choice]');if(!b)return;const theme=b.dataset.themeChoice;if(!['dark','light','system'].includes(theme))return;const p=getPrefs();p.theme=theme;localStorage.setItem(PREF_KEY,JSON.stringify(p));applyFinancePreferences()});
 document.addEventListener('change',e=>{if(e.target.id!=='prefCompactNav')return;const p=getPrefs();p.compactNav=!!e.target.checked;localStorage.setItem(PREF_KEY,JSON.stringify(p));applyFinancePreferences()});
 document.addEventListener('submit',e=>{if(e.target.id!=='accountProfileForm')return;e.preventDefault();const name=document.getElementById('accountDisplayName').value.trim()||'My Finance User',email=document.getElementById('accountEmail').value.trim(),initials=(document.getElementById('accountInitials').value.trim()||name.split(/\s+/).map(x=>x[0]).join('').slice(0,2)||'HA').toUpperCase().slice(0,3);localStorage.setItem(PROFILE_KEY,JSON.stringify({name,email,initials}));renderAccountProfile();});
 if(matchMedia)matchMedia('(prefers-color-scheme: light)').addEventListener?.('change',()=>{if((getPrefs().theme||'dark')==='system')applyFinancePreferences()});
 applyFinancePreferences();setTimeout(renderAccountProfile,0);
})();


/* V293 — isolated Neotek-style Open Banking sandbox */
const BANK_SANDBOX_KEY_V293='pf_bank_sandbox_v293';
const BANK_SANDBOX_BANKS_V293=[
 {id:'RJHISARI',name:'Al Rajhi Bank'},{id:'SABBSARI',name:'Saudi Awwal Bank (SAB)'},
 {id:'GULFSARI',name:'Gulf International Bank (GIB)'},{id:'MEEMSARI',name:'meem'},
 {id:'NCBKSAJE',name:'Saudi National Bank'},{id:'RIBLSARI',name:'Riyad Bank'},
 {id:'BSFRSARI',name:'Banque Saudi Fransi'},{id:'ARNBSARI',name:'Arab National Bank'},
 {id:'ALBISARI',name:'Bank Albilad'},{id:'INMASARI',name:'Alinma Bank'},
 {id:'BJAZSAJE',name:'Bank AlJazira'},{id:'SAIBSARI',name:'The Saudi Investment Bank'}
];
function bankSandboxReadV293(){
 try{const x=JSON.parse(localStorage.getItem(BANK_SANDBOX_KEY_V293)||'{"links":[]}');return x&&Array.isArray(x.links)?x:{links:[]}}catch(_){return {links:[]}}
}
function bankSandboxWriteV293(state){localStorage.setItem(BANK_SANDBOX_KEY_V293,JSON.stringify(state))}
function bankSandboxMoneyV293(v){return new Intl.NumberFormat('en-SA',{style:'currency',currency:'SAR',minimumFractionDigits:2}).format(Number(v||0))}
function bankSandboxFixtureV293(bank){
 const index=Math.max(0,BANK_SANDBOX_BANKS_V293.findIndex(x=>x.id===bank.id));
 const available=12500+(index*731.25),limit=20000+(index*1000),cardAvailable=limit-(2850+(index*97.5));
 const now=new Date(),day=86400000;
 const iso=n=>new Date(now.getTime()-(n*day)).toISOString();
 return {
  id:'sandbox-'+bank.id,bankId:bank.id,bankName:bank.name,status:'Active',source:'Neotek Sandbox Fixture',
  connectedAt:now.toISOString(),syncedAt:now.toISOString(),
  accounts:[
   {id:'ACC-'+bank.id+'-001',name:'Sandbox Current Account',type:'CurrentAccount',ending:String(2100+index).slice(-4),currency:'SAR',balanceType:'KSAOB.InterimAvailable',available},
   {id:'CARD-'+bank.id+'-001',name:'Optional Credit Card Feed',type:'CreditCard',ending:String(7100+index).slice(-4),currency:'SAR',creditLimit:limit,available:cardAvailable,optional:true}
  ],
  transactions:[
   {id:bank.id+'-T1',date:iso(0),description:'SANDBOX • Grocery Purchase',amount:-186.40,runningBalance:available},
   {id:bank.id+'-T2',date:iso(1),description:'SANDBOX • Salary Credit',amount:8500.00,runningBalance:available+186.40},
   {id:bank.id+'-T3',date:iso(2),description:'SANDBOX • Utility Payment',amount:-342.75,runningBalance:available-8313.60},
   {id:bank.id+'-T4',date:iso(4),description:'SANDBOX • Card Purchase',amount:-129.50,runningBalance:cardAvailable}
  ]
 };
}
window.renderBankConnections=function(){
 const root=document.getElementById('bankconnections');if(!root)return;
 const select=document.getElementById('bankSandboxBank');
 if(select&&!select.dataset.ready){
  select.innerHTML=BANK_SANDBOX_BANKS_V293.map(b=>'<option value="'+b.id+'">'+b.name+'</option>').join('');
  select.dataset.ready='1';
 }
 const state=bankSandboxReadV293(),links=state.links;
 const accounts=links.flatMap(x=>x.accounts||[]),transactions=links.flatMap(x=>(x.transactions||[]).map(t=>({...t,bankName:x.bankName})));
 const accountAvailable=accounts.filter(a=>a.type==='CurrentAccount').reduce((s,a)=>s+Number(a.available||0),0);
 const cardAvailable=accounts.filter(a=>a.type==='CreditCard').reduce((s,a)=>s+Number(a.available||0),0);
 const status=document.getElementById('bankSandboxStatus');
 if(status)status.textContent=links.length?links.length+' sandbox bank connection'+(links.length===1?'':'s')+' active. Mock data never changes dashboard totals.':'No sandbox bank connected yet.';
 const metrics=document.getElementById('bankSandboxMetrics');
 if(metrics)metrics.innerHTML=
  '<div class="bankSandboxMetric"><span>Account available</span><b>'+bankSandboxMoneyV293(accountAvailable)+'</b><small>Interim available balance</small></div>'+
  '<div class="bankSandboxMetric"><span>Card available</span><b>'+bankSandboxMoneyV293(cardAvailable)+'</b><small>Optional provider field</small></div>'+
  '<div class="bankSandboxMetric"><span>Feed transactions</span><b>'+transactions.length+'</b><small>Normalized mock records</small></div>';
 const cards=document.getElementById('bankSandboxAccounts');
 if(cards)cards.innerHTML=links.length?links.map(link=>
  '<article class="bankSandboxConnection"><div class="bankSandboxConnectionHead"><div><span class="bankSandboxLiveDot"></span><b>'+link.bankName+'</b><small>'+link.source+' • '+link.status+'</small></div><button type="button" class="btn danger" data-bank-sandbox-disconnect="'+link.id+'">Disconnect</button></div>'+
  '<div class="bankSandboxAccountGrid">'+(link.accounts||[]).map(a=>
   '<div class="bankSandboxAccount"><span>'+a.name+' •'+a.ending+'</span><b>'+bankSandboxMoneyV293(a.available)+'</b><small>'+(a.type==='CreditCard'?'Available credit'+(a.optional?' • optional API coverage':''):'Available balance • '+a.balanceType)+'</small></div>'
  ).join('')+'</div><small class="bankSandboxSynced">Last sandbox sync: '+new Date(link.syncedAt).toLocaleString()+'</small></article>'
 ).join(''):'<div class="bankSandboxEmpty">Choose a bank and connect the sandbox to preview mapped balances and transactions.</div>';
 const rows=document.getElementById('bankSandboxTransactions');
 transactions.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 if(rows)rows.innerHTML=transactions.length?transactions.map(t=>
  '<tr><td>'+new Date(t.date).toLocaleDateString('en-GB')+'</td><td><b>'+t.description+'</b><small>'+t.bankName+'</small></td><td class="'+(t.amount<0?'bankSandboxDebit':'bankSandboxCredit')+'">'+bankSandboxMoneyV293(t.amount)+'</td><td>'+bankSandboxMoneyV293(t.runningBalance)+'</td></tr>'
 ).join(''):'<tr><td colspan="4" class="bankSandboxEmptyCell">No sandbox transactions yet.</td></tr>';
 bindBankSandboxControlsV294();
};
function bankSandboxConnectV293(){
 const id=document.getElementById('bankSandboxBank')?.value,bank=BANK_SANDBOX_BANKS_V293.find(x=>x.id===id);if(!bank)return;
 const state=bankSandboxReadV293();
 if(state.links.some(x=>x.bankId===id)){const s=document.getElementById('bankSandboxStatus');if(s)s.textContent=bank.name+' is already connected in the sandbox.';return}
 state.links.push(bankSandboxFixtureV293(bank));bankSandboxWriteV293(state);renderBankConnections();
 const status=document.getElementById('bankSandboxStatus');
 if(status)status.textContent=bank.name+' connected successfully in the sandbox. Mock data never changes dashboard totals.';
}
function bankSandboxSyncV293(){
 const state=bankSandboxReadV293();const now=new Date().toISOString();
 const status=document.getElementById('bankSandboxStatus');
 if(!state.links.length){if(status)status.textContent='Connect a sandbox bank before syncing.';return}
 state.links.forEach(x=>x.syncedAt=now);bankSandboxWriteV293(state);renderBankConnections();
 if(status)status.textContent='Sandbox data synced successfully at '+new Date(now).toLocaleTimeString()+'.';
}
function bankSandboxActionV294(action){
 const status=document.getElementById('bankSandboxStatus');
 try{return action()}catch(e){
  console.error('Bank sandbox action failed',e);
  if(status)status.textContent='Sandbox action failed: '+(e?.message||String(e));
 }
}
function bindBankSandboxControlsV294(){
 const connect=document.getElementById('bankSandboxConnect');
 const sync=document.getElementById('bankSandboxSync');
 if(connect&&!connect.dataset.boundV294){
  connect.dataset.boundV294='1';
  connect.onclick=e=>{e.preventDefault();e.stopPropagation();bankSandboxActionV294(bankSandboxConnectV293)};
 }
 if(sync&&!sync.dataset.boundV294){
  sync.dataset.boundV294='1';
  sync.onclick=e=>{e.preventDefault();e.stopPropagation();bankSandboxActionV294(bankSandboxSyncV293)};
 }
 document.querySelectorAll('[data-bank-sandbox-disconnect]').forEach(remove=>{
  if(remove.dataset.boundV294)return;
  remove.dataset.boundV294='1';
  remove.onclick=e=>{e.preventDefault();e.stopPropagation();bankSandboxActionV294(()=>{
   const state=bankSandboxReadV293();
   const link=state.links.find(x=>x.id===remove.dataset.bankSandboxDisconnect);
   state.links=state.links.filter(x=>x.id!==remove.dataset.bankSandboxDisconnect);
   bankSandboxWriteV293(state);renderBankConnections();
   const status=document.getElementById('bankSandboxStatus');
   if(status)status.textContent=(link?.bankName||'Sandbox bank')+' disconnected.';
  })};
 });
}
setTimeout(()=>{try{renderBankConnections();bindBankSandboxControlsV294()}catch(e){console.error('Bank sandbox init',e)}},0);
