/* V283 Airbnb / Rental Management */
var rentalBookings=JSON.parse(localStorage.getItem("pf_rental_bookings")||"[]");
var rentalExpenses=JSON.parse(localStorage.getItem("pf_rental_expenses")||"[]");
var rentalBlocks=JSON.parse(localStorage.getItem("pf_rental_blocks")||"[]");
window.rentalView=new Date();rentalView.setDate(1);
function rentalSave(){localStorage.setItem("pf_rental_bookings",JSON.stringify(rentalBookings));localStorage.setItem("pf_rental_expenses",JSON.stringify(rentalExpenses));localStorage.setItem("pf_rental_blocks",JSON.stringify(rentalBlocks));if(typeof scheduleCloudAutoSave==="function")scheduleCloudAutoSave()}
function rDate(s){return new Date(s+"T12:00:00")}
window.rIso=function(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function rNextDate(s){var d=rDate(s);d.setDate(d.getDate()+1);return rIso(d)}
function rMoney(n){return "SAR "+Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}
function rNights(a,b){return Math.max(1,Math.round((rDate(b)-rDate(a))/86400000))}
function rentalMonthDataFor(viewDate){
 var view=viewDate instanceof Date?viewDate:rentalView,y=view.getFullYear(),m=view.getMonth(),start=new Date(y,m,1),end=new Date(y,m+1,1),days=new Date(y,m+1,0).getDate(),revenue=0,booked=0;
 var bookings=Array.isArray(rentalBookings)?rentalBookings:[],expenseRows=Array.isArray(rentalExpenses)?rentalExpenses:[];
 bookings.forEach(b=>{var a=rDate(b.checkin),z=rDate(b.checkout),over=Math.max(0,(Math.min(z,end)-Math.max(a,start))/86400000);if(over>0){booked+=over;revenue+=Number(b.dailyRate??(Number(b.total||0)/rNights(b.checkin,b.checkout)))*over}});
 var expenses=expenseRows.filter(e=>{var d=rDate(e.date);return d>=start&&d<end}).reduce((s,e)=>s+Number(e.amount||0),0);
 return{revenue,expenses,net:revenue-expenses,booked,days,occupancy:days?booked/days*100:0,adr:booked?revenue/booked:0}
}
function rentalMonthData(){return rentalMonthDataFor(rentalView)}
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
 document.querySelectorAll(".rentalDeleteBooking").forEach(b=>b.onclick=()=>{if(confirm("Delete this booking?")){var sorted=rentalBookings.slice().sort((a,b)=>b.checkin.localeCompare(a.checkin)),target=sorted[Number(b.dataset.i)];if(!target)return;if(typeof recordImmediateDelete==='function')recordImmediateDelete('rental_bookings',target.id,'rental-booking-delete');rentalBookings=rentalBookings.filter(x=>String(x.id)!==String(target.id));rentalSave();renderRental()}});
 var exp=rentalExpenses.filter(e=>rDate(e.date).getFullYear()===y&&rDate(e.date).getMonth()===m).sort((a,b)=>b.date.localeCompare(a.date));
 document.getElementById("rentalExpenses").innerHTML=exp.length?exp.map(e=>'<div class="rentalExpenseLine"><div><b>'+e.category+'</b><span>'+e.date+(e.note?" • "+e.note:"")+'</span></div><div class="rentalExpenseRight"><b>− '+rMoney(e.amount)+'</b><div class="rentalExpenseActions"><button type="button" class="btn rentalEditExpense" data-id="'+e.id+'">Edit</button><button type="button" class="btn danger rentalDeleteExpense" data-id="'+e.id+'">Delete</button></div></div></div>').join(""):'<div class="meta rentalEmpty">No expenses recorded for this month.</div>';
 document.querySelectorAll(".rentalEditExpense").forEach(b=>b.onclick=()=>rentalOpenExpense(b.dataset.id));
 document.querySelectorAll(".rentalDeleteExpense").forEach(b=>b.onclick=()=>{var x=rentalExpenses.find(e=>String(e.id)===String(b.dataset.id));if(!x)return;if(confirm("Delete "+x.category+" expense of "+rMoney(x.amount)+"?")){if(typeof recordImmediateDelete==='function')recordImmediateDelete('rental_expenses',x.id,'rental-expense-delete');rentalExpenses=rentalExpenses.filter(e=>String(e.id)!==String(b.dataset.id));rentalSave();renderRental()}});

}
function rentalDatesInRange(start,end){
 var dates=[],cursor=rDate(start),last=rDate(end);
 while(cursor<=last){dates.push(rIso(cursor));cursor.setDate(cursor.getDate()+1)}
 return dates;
}
window.rentalOpenDay=function(date){
 var booking=rentalBookings.find(b=>date>=b.checkin&&date<b.checkout);
 if(booking){rentalOpenBooking(date);return}
 var block=rentalBlocks.find(b=>b.date===date);
 rentalModal("Manage availability",'<div class="field"><label>Start Date</label><input name="startDate" type="date" required value="'+date+'"></div><div class="field"><label>End Date</label><input name="endDate" type="date" required value="'+date+'"></div><div class="field full"><label>Day Status</label><select name="status"><option value="available"'+(!block?' selected':'')+'>Available / Create Booking</option><option value="blocked"'+(block?.status==="blocked"?' selected':'')+'>Blocked</option><option value="maintenance"'+(block?.status==="maintenance"?' selected':'')+'>Maintenance</option></select></div><div class="field full"><label>Reason / Note</label><input name="note" value="'+String(block?.note||'').replace(/"/g,"&quot;")+'" placeholder="Optional reason for the selected date range"></div>',fd=>{
  var start=String(fd.get("startDate")||date),end=String(fd.get("endDate")||start),status=fd.get("status"),note=fd.get("note");
  if(end<start){alert("End Date must be the same as or after Start Date.");return false}
  var dates=rentalDatesInRange(start,end);
  var conflicts=rentalBookings.filter(b=>dates.some(x=>x>=b.checkin&&x<b.checkout));
  if(status!=="available"&&conflicts.length){alert("This range overlaps an existing booking. Change the dates or edit the booking first.");return false}
  var selected=new Set(dates);if(status==='available'&&typeof recordImmediateDelete==='function')rentalBlocks.filter(b=>selected.has(b.date)).forEach(b=>recordImmediateDelete('rental_blocks',syncStableId('rental_blocks',b),'rental-block-delete'));rentalBlocks=rentalBlocks.filter(b=>!selected.has(b.date));
  if(status!=="available")dates.forEach(x=>{var row={date:x,status,note,rangeStart:start,rangeEnd:end};rentalBlocks.push(row);if(typeof recordImmediateUpsert==='function')recordImmediateUpsert('rental_blocks',syncStableId('rental_blocks',row),row,'rental-block-edit')});
  else if(start===end&&!block)setTimeout(()=>rentalOpenBooking(start),0);
 });
}
function rentalModal(title,fields,onSave){
 var old=document.getElementById("rentalModal");if(old)old.remove();var d=document.createElement("div");d.className="modalBack open";d.id="rentalModal";d.innerHTML='<div class="modal"><div class="modalHead"><div class="modalTitle">'+title+'</div><button class="closeBtn" type="button">✕</button></div><form class="formGrid" id="rentalForm">'+fields+'<div class="field full" style="display:flex;justify-content:flex-end;gap:8px"><button type="button" class="btn rentalCancel">Cancel</button><button class="btn primary" type="submit">Save</button></div></form></div>';document.body.appendChild(d);d.querySelector(".closeBtn").onclick=d.querySelector(".rentalCancel").onclick=()=>d.remove();d.querySelector("form").onsubmit=e=>{e.preventDefault();if(onSave(new FormData(e.target))===false)return;d.remove();rentalSave();renderRental()}
}
window.rentalOpenBooking=function(date){
 rentalModal("Add Booking",'<div class="field"><label>Check-in</label><input name="checkin" type="date" required value="'+(date||rIso(new Date()))+'"></div><div class="field"><label>Check-out</label><input name="checkout" type="date" required value="'+rNextDate(date||rIso(new Date()))+'"></div><div class="field"><label>Booking Reference</label><input name="ref" placeholder="Airbnb reference or guest initials"></div><div class="field"><label>Daily Rate (SAR / night)</label><input name="dailyRate" type="number" min="0" step="0.01" required></div><div class="field"><label>Payment</label><select name="paid"><option value="1">Received</option><option value="0">Pending</option></select></div><div class="field"><label>Notes</label><input name="note"></div>',fd=>{var a=fd.get("checkin"),z=fd.get("checkout");if(z<=a){alert("Check-out must be after check-in.");return false}rentalBookings.push({id:Date.now(),checkin:a,checkout:z,ref:fd.get("ref"),dailyRate:Number(fd.get("dailyRate")),paid:fd.get("paid")==="1",paidAmount:fd.get("paid")==="1"?Number(fd.get("dailyRate"))*rNights(a,z):0,paymentDate:fd.get("paid")==="1"?rIso(new Date()):"",note:fd.get("note")})});
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
  const p=getProfile(),name=p.name||(window.financeIsOwner?'Hussam Ahmad':'My Finance User'),email=window.financeUserEmail||p.email||'',initials=(p.initials||(window.financeIsOwner?'HA':'MF')).toUpperCase().slice(0,3);
  ['accountAvatarPreview'].forEach(id=>{const e=document.getElementById(id);if(e)e.textContent=initials});
  const n=document.getElementById('accountNamePreview');if(n)n.textContent=name;
  const em=document.getElementById('accountEmailPreview');if(em)em.textContent=email||'Local profile • Login not connected yet';
  const dn=document.getElementById('accountDisplayName');if(dn)dn.value=name;const ei=document.getElementById('accountEmail');if(ei){ei.value=email;ei.readOnly=true;}const ii=document.getElementById('accountInitials');if(ii)ii.value=initials;
  document.querySelectorAll('.canonicalAvatar>span:first-child,.profileIdentity>b,.execAvatar,.cashAvatar,.txExecAvatar,.strategyAvatar').forEach(e=>e.textContent=initials);
  const pi=document.querySelector('.profileIdentity span');if(pi)pi.textContent=email||name;
  const adminCard=document.getElementById('adminAccessCard');if(adminCard)adminCard.hidden=!window.financeIsOwner;
 };
 document.addEventListener('click',e=>{const b=e.target.closest('[data-theme-choice]');if(!b)return;const theme=b.dataset.themeChoice;if(!['dark','light','system'].includes(theme))return;const p=getPrefs();p.theme=theme;localStorage.setItem(PREF_KEY,JSON.stringify(p));applyFinancePreferences()});
 document.addEventListener('change',e=>{if(e.target.id!=='prefCompactNav')return;const p=getPrefs();p.compactNav=!!e.target.checked;localStorage.setItem(PREF_KEY,JSON.stringify(p));applyFinancePreferences()});
 document.addEventListener('submit',e=>{if(e.target.id!=='accountProfileForm')return;e.preventDefault();const name=document.getElementById('accountDisplayName').value.trim()||'My Finance User',email=window.financeUserEmail||'',initials=(document.getElementById('accountInitials').value.trim()||name.split(/\s+/).map(x=>x[0]).join('').slice(0,2)||'MF').toUpperCase().slice(0,3);localStorage.setItem(PROFILE_KEY,JSON.stringify({name,email,initials}));renderAccountProfile();});
 if(matchMedia)matchMedia('(prefers-color-scheme: light)').addEventListener?.('change',()=>{if((getPrefs().theme||'dark')==='system')applyFinancePreferences()});
 applyFinancePreferences();setTimeout(renderAccountProfile,0);
})();

/* Cloud audit and per-account sharing summary. Database RLS remains authoritative. */
(function(){
 const client=window.financeSupabaseClient;
 const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=String(text);return node};
 async function identity(){
  if(!client)throw new Error('Cloud connection is unavailable.');
  const {data:{session},error}=await client.auth.getSession();
  if(error)throw error;
  if(!session)throw new Error('Sign in to view account activity.');
  return session.user.id;
 }
 async function directory(){
  const {data,error}=await client.rpc('finance_access_directory');
  if(error)throw error;
  return data||[];
 }
 window.renderFinanceAdminAccess=async function(){
  const status=document.getElementById('adminAccessStatus'),box=document.getElementById('adminAccessUsers');
  if(!status||!box)return;
  status.textContent='Loading access directory…';box.replaceChildren();
  try{
   const userId=await identity();
   const {data:ownerRows,error:ownerError}=await client.from('finance_owner').select('owner_user_id').limit(1);
   if(ownerError)throw ownerError;
   if(!ownerRows?.length||ownerRows[0].owner_user_id!==userId){
    status.textContent='Administrator access is required.';return;
   }
   const [users,grantResult,pageResult]=await Promise.all([
    directory(),
    client.from('finance_workspace_grants').select('owner_user_id,member_user_id,page,permission'),
    client.from('finance_page_access').select('user_id,page,permission')
   ]);
   if(grantResult.error)throw grantResult.error;
   if(pageResult.error)throw pageResult.error;
   const {data:labGrants,error:labError}=await client.from('finance_access_lab_grants')
    .select('owner_user_id,member_user_id,page,permission');
   if(labError)throw labError;
   const ownerSelect=document.getElementById('labGrantOwner'),memberSelect=document.getElementById('labGrantMember'),
    grantList=document.getElementById('labGrantList');
   if(ownerSelect&&memberSelect&&grantList){
    const priorOwner=ownerSelect.value,priorMember=memberSelect.value;
    ownerSelect.replaceChildren();memberSelect.replaceChildren();grantList.replaceChildren();
    users.forEach(u=>{
     const ownerOption=el('option','',u.user_email||u.user_id);ownerOption.value=u.user_id;ownerSelect.append(ownerOption);
     const memberOption=el('option','',u.user_email||u.user_id);memberOption.value=u.user_id;memberSelect.append(memberOption);
    });
    ownerSelect.value=users.some(u=>u.user_id===priorOwner)?priorOwner:userId;
    memberSelect.value=users.some(u=>u.user_id===priorMember)?priorMember:(users.find(u=>u.user_id!==userId)?.user_id||userId);
    const labels=new Map(users.map(u=>[u.user_id,u.user_email||u.user_id]));
    grantList.textContent=labGrants.length?'':'No test access assigned.';
    labGrants.forEach(g=>grantList.append(el('div','prefsStatus',
     (labels.get(g.owner_user_id)||g.owner_user_id)+' → '+(labels.get(g.member_user_id)||g.member_user_id)+
     ' · '+g.page+' · '+g.permission)));
   }
   const grants=grantResult.data||[],pages=pageResult.data||[];
   status.textContent=users.length+' registered account'+(users.length===1?'':'s')+' · '+grants.length+' explicit sharing grant'+(grants.length===1?'':'s')+'.';
   for(const user of users){
    const card=el('div','prefsStatus');
    const name=el('b','',user.user_email||user.user_id);
    const detail=el('span','',user.user_id===userId?'Administrator · own workspace':
      'Private workspace · '+pages.filter(p=>p.user_id===user.user_id).length+' page setting(s)');
    card.append(name,detail);
    const ownGrants=grants.filter(g=>g.owner_user_id===user.user_id);
    if(ownGrants.length)card.append(el('small','',ownGrants.length+' page grant(s) to other users'));
    box.append(card);
   }
 }catch(e){status.textContent='Access directory unavailable: '+e.message;}
 };
 const labPages=[['transactions','Transactions'],['investments','Investments'],['assets','Personal Assets'],['rental','Airbnb / Rental']];
 document.getElementById('labSaveGrant')?.addEventListener('click',async()=>{
  const status=document.getElementById('labGrantStatus');
  const owner=document.getElementById('labGrantOwner').value,member=document.getElementById('labGrantMember').value,
   page=document.getElementById('labGrantPage').value,permission=document.getElementById('labGrantPermission').value;
  if(owner===member){status.textContent='Choose two different users.';return;}
  status.textContent='Saving test access…';
  try{
   const actor=await identity();
   const {data:ownerRows,error:ownerError}=await client.from('finance_owner').select('owner_user_id').limit(1);
   if(ownerError||ownerRows?.[0]?.owner_user_id!==actor)throw new Error('Administrator access is required.');
   const result=permission==='off'
    ?await client.from('finance_access_lab_grants').delete().eq('owner_user_id',owner).eq('member_user_id',member).eq('page',page)
    :await client.from('finance_access_lab_grants').upsert({
      owner_user_id:owner,member_user_id:member,page,permission,granted_by:actor
     },{onConflict:'owner_user_id,member_user_id,page'});
   if(result.error)throw result.error;
   status.textContent=permission==='off'?'Test access removed.':'Test access saved.';
   await window.renderFinanceAdminAccess();
  }catch(e){status.textContent='Could not save test access: '+e.message;}
 });
 window.renderFinanceAccessLab=async function(){
  const status=document.getElementById('labStatus'),workspace=document.getElementById('labWorkspace'),
   page=document.getElementById('labPage'),items=document.getElementById('labItems'),form=document.getElementById('labAddForm');
  if(!status||!workspace||!page||!items||!form)return;
  status.textContent='Checking access…';items.replaceChildren();form.hidden=true;
  try{
   const actor=await identity();
   const [directoryResult,grantResult]=await Promise.all([
    client.rpc('finance_access_lab_directory'),
    client.from('finance_access_lab_grants').select('owner_user_id,member_user_id,page,permission').eq('member_user_id',actor)
   ]);
   if(directoryResult.error)throw directoryResult.error;
   if(grantResult.error)throw grantResult.error;
   const grants=grantResult.data||[],users=directoryResult.data||[];
   const allowedOwners=new Set([actor,...grants.map(g=>g.owner_user_id)]);
   const priorWorkspace=workspace.value,priorPage=page.value;
   workspace.replaceChildren();
   users.filter(u=>allowedOwners.has(u.user_id)).forEach(u=>{
    const o=el('option','',(u.user_id===actor?'Own data · ':'Shared data · ')+(u.user_email||u.user_id));
    o.value=u.user_id;workspace.append(o);
   });
   workspace.value=allowedOwners.has(priorWorkspace)?priorWorkspace:actor;
   const owner=workspace.value;
   const visiblePages=owner===actor?labPages:labPages.filter(([id])=>grants.some(g=>g.owner_user_id===owner&&g.page===id));
   page.replaceChildren();
   visiblePages.forEach(([id,label])=>{const o=el('option','',label);o.value=id;page.append(o)});
   if(visiblePages.some(([id])=>id===priorPage))page.value=priorPage;
   if(!page.value){status.textContent='No pages are shared with you in this test.';return;}
   const permission=owner===actor?'edit':grants.find(g=>g.owner_user_id===owner&&g.page===page.value)?.permission;
   const {data,error}=await client.from('finance_access_lab_items')
    .select('id,title,note,updated_at,updated_by').eq('owner_user_id',owner).eq('page',page.value)
    .order('updated_at',{ascending:false});
   if(error)throw error;
   status.textContent=(owner===actor?'Own':'Shared')+' sample data · '+(permission==='edit'?'View and edit':'View only')+
    ' · '+(data?.length||0)+' item(s).';
   form.hidden=permission!=='edit';
   if(!data?.length)items.textContent='No sample records on this page yet.';
   for(const row of data||[]){
    const item=el('div','prefsStatus');
    item.append(el('b','',row.title),el('span','',row.note||'No note'));
    if(permission==='edit'){
     const edit=el('button','btn','Edit'),remove=el('button','btn danger','Delete');
     edit.type=remove.type='button';
     edit.onclick=async()=>{
      const title=prompt('Sample title',row.title);if(title===null)return;
      if(!title.trim()||title.length>150)return;
      const {error}=await client.from('finance_access_lab_items').update({
       title:title.trim(),updated_at:new Date().toISOString(),updated_by:actor
      }).eq('id',row.id).eq('owner_user_id',owner).select('id').single();
      status.textContent=error?'Edit blocked: '+error.message:'Sample updated.';
      await window.renderFinanceAccessLab();
     };
     remove.onclick=async()=>{
      if(!confirm('Delete this sample record?'))return;
      const {error}=await client.from('finance_access_lab_items').delete().eq('id',row.id)
       .eq('owner_user_id',owner).select('id').single();
      status.textContent=error?'Delete blocked: '+error.message:'Sample deleted.';
      await window.renderFinanceAccessLab();
     };
     item.append(edit,remove);
    }
    items.append(item);
   }
  }catch(e){status.textContent='Access test unavailable: '+e.message;}
 };
 document.getElementById('labWorkspace')?.addEventListener('change',()=>{
  document.getElementById('labPage').value='';window.renderFinanceAccessLab();
 });
 document.getElementById('labPage')?.addEventListener('change',()=>window.renderFinanceAccessLab());
 document.getElementById('labRefresh')?.addEventListener('click',()=>window.renderFinanceAccessLab());
 document.getElementById('labAddForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const status=document.getElementById('labStatus'),owner=document.getElementById('labWorkspace').value,
   page=document.getElementById('labPage').value,title=document.getElementById('labTitle').value.trim(),
   note=document.getElementById('labNote').value.trim();
  if(!title||!owner||!page)return;
  try{
   const actor=await identity();
   const {error}=await client.from('finance_access_lab_items').insert({
    owner_user_id:owner,page,title,note,updated_by:actor
   });
   if(error)throw error;
   e.target.reset();await window.renderFinanceAccessLab();
  }catch(err){status.textContent='Add blocked: '+err.message;}
 });
 setInterval(()=>{
  if(document.getElementById('accessLab')?.classList.contains('active'))window.renderFinanceAccessLab();
 },15000);
 window.renderFinanceSharedWith=async function(){
  const box=document.getElementById('accountSharedWith');if(!box)return;
  box.textContent='Checking sharing permissions…';
  try{
   const userId=await identity();
   const [{data:grants,error},users]=await Promise.all([
    client.from('finance_workspace_grants').select('member_user_id,page,permission').eq('owner_user_id',userId).order('member_user_id'),
    directory()
   ]);
   if(error)throw error;
   box.replaceChildren();
   if(!grants?.length){box.textContent='No one has access to your workspace.';return}
   const emails=new Map(users.map(u=>[u.user_id,u.user_email]));
   const groups=new Map();
   grants.forEach(g=>{if(!groups.has(g.member_user_id))groups.set(g.member_user_id,[]);groups.get(g.member_user_id).push(g)});
   for(const [member,pages] of groups){
    const item=el('div','prefsStatus');
    item.append(el('b','',emails.get(member)||'User '+member.slice(0,8)),
      el('span','',pages.map(p=>p.page+' ('+p.permission+')').join(' · ')));
    box.append(item);
   }
  }catch(e){box.textContent='Sharing list unavailable: '+e.message}
 };
 const sectionPage={
  investments_holdings:'Investments',investments_trades:'Investments',
  personal_assets_gold:'Personal Assets',personal_assets_market:'Personal Assets',
  personal_assets_zakat:'Personal Assets',personal_assets_sales:'Personal Assets',
  rental_bookings:'Airbnb / Rental',rental_expenses:'Airbnb / Rental',rental_blocks:'Airbnb / Rental',
  imported_transactions:'Transactions',manual_transactions:'Transactions',import_history:'Import Statements',
  outgoings:'Outgoings',cash_flow_ledger:'Cash & Credit',installments:'Installments',
  card_payment_plan:'Income & Payment Plan',income_plan:'Income & Payment Plan',
  custom_banks:'Cash & Credit',custom_credit_cards:'Cash & Credit'
 };
 let cachedDirectory=[];
 window.renderFinanceAuditTrail=async function(){
  const status=document.getElementById('auditStatus'),rows=document.getElementById('auditRows'),select=document.getElementById('auditWorkspace');
  if(!status||!rows||!select)return;
  status.textContent='Loading audit trail…';rows.replaceChildren();
  try{
   const userId=await identity();
   cachedDirectory=await directory();
   const admin=!!window.financeIsOwner;
   const selected=select.value||userId;
   select.replaceChildren();
   (admin?cachedDirectory:cachedDirectory.filter(u=>u.user_id===userId)).forEach(u=>{
    const option=el('option','',u.user_email||u.user_id);option.value=u.user_id;select.append(option);
   });
   select.value=Array.from(select.options).some(o=>o.value===selected)?selected:userId;
   let query=client.from('finance_record_audit')
    .select('id,workspace_user_id,actor_user_id,section,record_id,operation,before_data,after_data,changed_at')
    .eq('workspace_user_id',select.value).order('changed_at',{ascending:false}).limit(150);
   const action=document.getElementById('auditAction')?.value;
   const from=document.getElementById('auditFrom')?.value,to=document.getElementById('auditTo')?.value;
   if(action)query=query.eq('operation',action);
   if(from)query=query.gte('changed_at',from+'T00:00:00');
   if(to)query=query.lte('changed_at',to+'T23:59:59.999');
   const {data,error}=await query;
   if(error)throw error;
   status.textContent=(data?.length||0)+' cloud change'+(data?.length===1?'':'s')+' shown (latest 150).';
   if(!data?.length){rows.textContent='No recorded changes for these filters.';return}
   const emails=new Map(cachedDirectory.map(u=>[u.user_id,u.user_email]));
   for(const row of data){
    const details=el('details','auditEntry');
    const title=el('summary','');
    title.append(el('b','',row.operation.toUpperCase()+' · '+(sectionPage[row.section]||row.section.replaceAll('_',' '))),
      el('span','',new Date(row.changed_at).toLocaleString()),
      el('span','',row.actor_user_id?(emails.get(row.actor_user_id)||'User '+row.actor_user_id.slice(0,8)):'System / legacy sync'));
    details.append(title,el('div','meta','Record: '+row.record_id));
    const pre=el('pre','auditDiff',JSON.stringify({before:row.before_data,after:row.after_data},null,2));
    details.append(pre);rows.append(details);
   }
  }catch(e){status.textContent='Audit trail unavailable: '+e.message}
 };
 document.getElementById('auditRefresh')?.addEventListener('click',()=>window.renderFinanceAuditTrail());
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
function bankSandboxEscapeV295(value){return String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function bankSandboxFixtureV293(bank){
 const index=Math.max(0,BANK_SANDBOX_BANKS_V293.findIndex(x=>x.id===bank.id));
 const available=12500+(index*731.25),savingsAvailable=4800+(index*525.40);
 const limit=20000+(index*1000),cardAvailable=limit-(2850+(index*97.5));
 const secondLimit=12000+(index*750),secondCardAvailable=secondLimit-(1425+(index*63.25));
 const now=new Date(),day=86400000;
 const iso=n=>new Date(now.getTime()-(n*day)).toISOString();
 return {
  id:'sandbox-'+bank.id,bankId:bank.id,bankName:bank.name,status:'Active',source:'Neotek Sandbox Fixture',mode:'sandbox',schemaVersion:295,
  connectedAt:now.toISOString(),syncedAt:now.toISOString(),
  accounts:[
   {id:'ACC-'+bank.id+'-001',name:'Primary Current Account',type:'CurrentAccount',ending:String(2100+index).slice(-4),currency:'SAR',balanceType:'KSAOB.InterimAvailable',available},
   {id:'ACC-'+bank.id+'-002',name:'Secondary Current Account',type:'CurrentAccount',ending:String(4100+index).slice(-4),currency:'SAR',balanceType:'KSAOB.InterimAvailable',available:savingsAvailable},
   {id:'CARD-'+bank.id+'-001',name:'Visa Credit Card',type:'CreditCard',ending:String(7100+index).slice(-4),currency:'SAR',creditLimit:limit,available:cardAvailable,optional:true},
   {id:'CARD-'+bank.id+'-002',name:'Mastercard Credit Card',type:'CreditCard',ending:String(9100+index).slice(-4),currency:'SAR',creditLimit:secondLimit,available:secondCardAvailable,optional:true}
  ],
  transactions:[
   {id:bank.id+'-T1',accountId:'ACC-'+bank.id+'-001',date:iso(0),description:'SANDBOX • Grocery Purchase',amount:-186.40,runningBalance:available},
   {id:bank.id+'-T2',accountId:'ACC-'+bank.id+'-001',date:iso(1),description:'SANDBOX • Salary Credit',amount:8500.00,runningBalance:available+186.40},
   {id:bank.id+'-T3',accountId:'ACC-'+bank.id+'-002',date:iso(2),description:'SANDBOX • Utility Payment',amount:-342.75,runningBalance:savingsAvailable},
   {id:bank.id+'-T4',accountId:'ACC-'+bank.id+'-002',date:iso(3),description:'SANDBOX • Internal Transfer',amount:1200.00,runningBalance:savingsAvailable+342.75},
   {id:bank.id+'-T5',accountId:'CARD-'+bank.id+'-001',date:iso(1),description:'SANDBOX • Card Purchase',amount:-129.50,runningBalance:cardAvailable},
   {id:bank.id+'-T6',accountId:'CARD-'+bank.id+'-001',date:iso(4),description:'SANDBOX • Online Subscription',amount:-64.99,runningBalance:cardAvailable+129.50},
   {id:bank.id+'-T7',accountId:'CARD-'+bank.id+'-002',date:iso(0),description:'SANDBOX • Fuel Purchase',amount:-175.00,runningBalance:secondCardAvailable},
   {id:bank.id+'-T8',accountId:'CARD-'+bank.id+'-002',date:iso(5),description:'SANDBOX • Restaurant',amount:-238.75,runningBalance:secondCardAvailable+175.00}
  ]
 };
}
function bankSandboxUpgradeV295(link){
 if(link?.schemaVersion===295)return link;
 const bank=BANK_SANDBOX_BANKS_V293.find(x=>x.id===link?.bankId);if(!bank)return link;
 const upgraded=bankSandboxFixtureV293(bank);
 upgraded.connectedAt=link.connectedAt||upgraded.connectedAt;
 upgraded.syncedAt=link.syncedAt||upgraded.syncedAt;
 return upgraded;
}
function bankProviderFinanceMatchV295(providerAccount,bankName){
 const financeAccounts=typeof accounts!=='undefined'&&Array.isArray(accounts)?accounts:[];
 return financeAccounts.find(a=>a.openBankingAccountId===providerAccount.id)||financeAccounts.find(a=>
  String(a.ending||'')===String(providerAccount.ending||'')&&
  String(a.bank||'').trim().toLowerCase()===String(bankName||'').trim().toLowerCase()&&
  ((providerAccount.type==='CreditCard'&&a.type==='card')||(providerAccount.type!=='CreditCard'&&a.type==='bank'))
 );
}
function bankProviderAddToFinanceV295(linkId,providerAccountId){
 const state=bankSandboxReadV293(),link=state.links.find(x=>x.id===linkId),providerAccount=link?.accounts?.find(x=>x.id===providerAccountId);
 if(!link||!providerAccount||link.mode!=='real')return;
 const existing=bankProviderFinanceMatchV295(providerAccount,link.bankName);
 if(existing){const status=document.getElementById('bankProviderStatus');if(status)status.textContent='Already mapped to '+accountName(existing.id)+'.';return}
 if(!confirm('Add '+link.bankName+' • '+providerAccount.name+' •'+providerAccount.ending+' to My Finance?'))return;
 const safeId=String(providerAccount.id).replace(/[^a-z0-9-]/gi,'-').toLowerCase();
 if(providerAccount.type==='CreditCard'){
  const id='openbank-card-'+safeId,limit=Number(providerAccount.creditLimit||0),available=Number(providerAccount.available||0);
  const card={id,bank:link.bankName,name:providerAccount.name,ending:providerAccount.ending,type:'card',custom:true,openBankingAccountId:providerAccount.id,openBankingConnectionId:link.id,extra:{'Credit Limit':limit,'Bank Available':available,'Current Outstanding':Math.max(0,limit-available),'Physical Cards':[providerAccount.ending]}};
  customCreditCards.push(card);financeSettings.cardCycles[id]=financeSettings.cardCycles[id]||{statementDay:25,dueDay:15};
  localStorage.setItem('pf_custom_credit_cards',JSON.stringify(customCreditCards));localStorage.setItem('pf_finance_settings',JSON.stringify(financeSettings));
 }else{
  const id='openbank-account-'+safeId,balance=Number(providerAccount.available||0);
  const bank={id,bank:link.bankName,name:providerAccount.name,ending:providerAccount.ending,type:'bank',custom:true,balance,balanceLabel:'Open Banking Available',openBankingAccountId:providerAccount.id,openBankingConnectionId:link.id,extra:{}};
  customBanks.push(bank);localStorage.setItem('pf_custom_banks',JSON.stringify(customBanks));setTrackedBankBalance(id,balance);
 }
 syncCustomAccountsIntoAccounts();saveV194Data();saveLocal();financeSettingsDirty=true;scheduleRecordPush('open-banking-account-add');refreshAccountDependentUI();renderBankConnections();
}
window.renderBankConnections=function(){
 const root=document.getElementById('bankconnections');if(!root)return;
 const select=document.getElementById('bankSandboxBank');
 if(select&&!select.dataset.ready){
  select.innerHTML=BANK_SANDBOX_BANKS_V293.map(b=>'<option value="'+b.id+'">'+b.name+'</option>').join('');
  select.dataset.ready='1';
 }
 const state=bankSandboxReadV293();
 const upgradedLinks=state.links.map(bankSandboxUpgradeV295);if(upgradedLinks.some((x,i)=>x!==state.links[i])){state.links=upgradedLinks;bankSandboxWriteV293(state)}
 const links=state.links,discoveredAccounts=links.flatMap(x=>x.accounts||[]);
 const transactions=links.flatMap(link=>(link.transactions||[]).map(t=>{const source=(link.accounts||[]).find(a=>a.id===t.accountId);return {...t,bankName:link.bankName,accountName:source?.name||'Unknown account',accountType:source?.type||'Unknown',accountEnding:source?.ending||'—'}}));
 const accountAvailable=discoveredAccounts.filter(a=>a.type==='CurrentAccount').reduce((s,a)=>s+Number(a.available||0),0);
 const cardAvailable=discoveredAccounts.filter(a=>a.type==='CreditCard').reduce((s,a)=>s+Number(a.available||0),0);
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
   {const match=bankProviderFinanceMatchV295(a,link.bankName),typeLabel=a.type==='CreditCard'?'Credit card':'Current account';return '<div class="bankSandboxAccount"><span class="bankSandboxAccountType">'+typeLabel+'</span><span>'+bankSandboxEscapeV295(a.name)+' •'+bankSandboxEscapeV295(a.ending)+'</span><b>'+bankSandboxMoneyV293(a.available)+'</b><small>'+(a.type==='CreditCard'?'Available credit'+(a.optional?' • optional API coverage':''):'Available balance • '+bankSandboxEscapeV295(a.balanceType))+'</small><small class="bankSandboxMapping">'+(link.mode==='real'?(match?'Mapped to '+bankSandboxEscapeV295(accountName(match.id)):'<button type="button" class="btn small primary" data-bank-add-finance="'+bankSandboxEscapeV295(link.id)+'" data-provider-account="'+bankSandboxEscapeV295(a.id)+'">Add to My Finance</button>'):'Sandbox only • account creation stays disabled')+'</small></div>'}
  ).join('')+'</div><small class="bankSandboxSynced">Last sandbox sync: '+new Date(link.syncedAt).toLocaleString()+'</small></article>'
 ).join(''):'<div class="bankSandboxEmpty">Choose a bank and connect the sandbox to preview mapped balances and transactions.</div>';
 const rows=document.getElementById('bankSandboxTransactions');
 transactions.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 if(rows)rows.innerHTML=transactions.length?transactions.map(t=>
  '<tr><td>'+new Date(t.date).toLocaleDateString('en-GB')+'</td><td><b>'+bankSandboxEscapeV295(t.bankName)+' • '+bankSandboxEscapeV295(t.accountName)+' •'+bankSandboxEscapeV295(t.accountEnding)+'</b><small>'+(t.accountType==='CreditCard'?'Credit card':'Current account')+'</small></td><td><b>'+bankSandboxEscapeV295(t.description)+'</b></td><td class="'+(t.amount<0?'bankSandboxDebit':'bankSandboxCredit')+'">'+bankSandboxMoneyV293(t.amount)+'</td><td>'+bankSandboxMoneyV293(t.runningBalance)+'</td></tr>'
 ).join(''):'<tr><td colspan="5" class="bankSandboxEmptyCell">No sandbox transactions yet.</td></tr>';
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
async function bankProviderCheckV295(startRequested=false){
 const status=document.getElementById('bankProviderStatus');
 if(status)status.textContent='Checking protected provider configuration…';
 try{
  const response=await fetch('/api/open-banking-status',{method:'GET',headers:{Accept:'application/json'},cache:'no-store'});
  const result=await response.json();
  if(status)status.textContent=result.message||'Provider status received.';
  if(startRequested&&result.consentReady!==true&&status)status.textContent+=' No bank consent redirect was opened because the approved endpoint is not enabled.';
  return result;
 }catch(error){
  if(status)status.textContent='Could not check the provider setup. '+(error?.message||String(error));
  return null;
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
 document.querySelectorAll('[data-bank-add-finance]').forEach(add=>{
  if(add.dataset.boundV295)return;
  add.dataset.boundV295='1';
  add.onclick=e=>{e.preventDefault();e.stopPropagation();bankSandboxActionV294(()=>bankProviderAddToFinanceV295(add.dataset.bankAddFinance,add.dataset.providerAccount))};
 });
 const providerCheck=document.getElementById('bankProviderCheck');
 if(providerCheck&&!providerCheck.dataset.boundV295){providerCheck.dataset.boundV295='1';providerCheck.onclick=e=>{e.preventDefault();bankProviderCheckV295(false)}}
 const providerStart=document.getElementById('bankProviderStart');
 if(providerStart&&!providerStart.dataset.boundV295){providerStart.dataset.boundV295='1';providerStart.onclick=e=>{e.preventDefault();bankProviderCheckV295(true)}}
}
setTimeout(()=>{try{renderBankConnections();bindBankSandboxControlsV294()}catch(e){console.error('Bank sandbox init',e)}},0);
