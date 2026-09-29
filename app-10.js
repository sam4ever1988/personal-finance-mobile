/* V283 Airbnb / Rental Management */
var rentalBookings=JSON.parse(localStorage.getItem("pf_rental_bookings")||"[]");
var rentalExpenses=JSON.parse(localStorage.getItem("pf_rental_expenses")||"[]");
var rentalBlocks=JSON.parse(localStorage.getItem("pf_rental_blocks")||"[]");
var rentalUnits=JSON.parse(localStorage.getItem("pf_rental_units")||"[]");
if(!Array.isArray(rentalUnits)||!rentalUnits.length)rentalUnits=[{id:'default',name:'Main Unit',organiserFee:30}];
var rentalUnitId='default';
function rentalUnit(){return rentalUnits.find(u=>u.id===rentalUnitId)||rentalUnits[0]}
function rentalBelongs(row){return String(row.unitId||'default')===String(rentalUnit().id)}
function rentalFeeRate(booking){return Math.min(100,Math.max(0,Number(booking.organiserFee??rentalUnit().organiserFee??30)))}
function rentalCurrency(booking){return booking.currency||'SAR'}
function rentalNativeRate(booking){return Number(booking.dailyRate??(Number(booking.total||0)/rNights(booking.checkin,booking.checkout)))}
function rentalRate(booking){return rentalNativeRate(booking)*Number(booking.fxRateSAR||1)}
function rentalGross(booking){return rentalRate(booking)*rNights(booking.checkin,booking.checkout)}
function rEsc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
window.rentalView=new Date();rentalView.setDate(1);
function rentalSave(){localStorage.setItem("pf_rental_bookings",JSON.stringify(rentalBookings));localStorage.setItem("pf_rental_expenses",JSON.stringify(rentalExpenses));localStorage.setItem("pf_rental_blocks",JSON.stringify(rentalBlocks));localStorage.setItem("pf_rental_units",JSON.stringify(rentalUnits));if(typeof scheduleCloudAutoSave==="function")scheduleCloudAutoSave()}
function rDate(s){return new Date(s+"T12:00:00")}
window.rIso=function(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function rNextDate(s){var d=rDate(s);d.setDate(d.getDate()+1);return rIso(d)}
function rMoney(n){return "SAR "+Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}
function rNights(a,b){return Math.max(1,Math.round((rDate(b)-rDate(a))/86400000))}
function rentalMonthDataFor(viewDate){
 var view=viewDate instanceof Date?viewDate:rentalView,y=view.getFullYear(),m=view.getMonth(),start=new Date(y,m,1,12),end=new Date(y,m+1,1,12),days=new Date(y,m+1,0).getDate(),revenue=0,booked=0;
 var bookings=(Array.isArray(rentalBookings)?rentalBookings:[]).filter(rentalBelongs),expenseRows=(Array.isArray(rentalExpenses)?rentalExpenses:[]).filter(rentalBelongs),fees=0;
 bookings.forEach(b=>{var a=rDate(b.checkin),z=rDate(b.checkout),over=Math.max(0,(Math.min(z,end)-Math.max(a,start))/86400000);if(over>0){booked+=over;const gross=rentalRate(b)*over;revenue+=gross;fees+=gross*rentalFeeRate(b)/100}});
 var expenses=expenseRows.filter(e=>{var d=rDate(e.date);return d>=start&&d<end}).reduce((s,e)=>s+Number(e.amount||0),0);
 return{revenue,fees,expenses,net:revenue-fees-expenses,booked,days,occupancy:days?booked/days*100:0,adr:booked?revenue/booked:0}
}
function rentalMonthData(){return rentalMonthDataFor(rentalView)}
window.renderRental=function(){
 var cal=document.getElementById("rentalCalendar");if(!cal)return;var y=rentalView.getFullYear(),m=rentalView.getMonth(),md=rentalMonthData();
 var selector=document.getElementById('rentalUnitSelect');if(selector){selector.innerHTML=rentalUnits.map(u=>'<option value="'+rEsc(u.id)+'">'+rEsc(u.name)+'</option>').join('');selector.value=rentalUnit().id}
 var feeInput=document.getElementById('rentalDefaultFee');if(feeInput)feeInput.value=Number(rentalUnit().organiserFee??30);
 document.getElementById("rentalMonthTitle").textContent=rentalView.toLocaleDateString("en-US",{month:"long",year:"numeric"});
 document.getElementById("rentalKpis").innerHTML=[["Gross Booking Revenue",rMoney(md.revenue),"income"],["Organiser Fees",rMoney(md.fees),"expense"],["Monthly Expenses",rMoney(md.expenses),"expense"],["Net Rental Income",rMoney(md.net),md.net>=0?"income":"expense"],["Occupancy",md.occupancy.toFixed(0)+"%","occupancy"],["Booked Nights",md.booked.toFixed(0)+" / "+md.days,"nights"],["Avg. Nightly Rate",rMoney(md.adr),"rate"]].map(x=>'<div class="rentalKpi '+x[2]+'"><span>'+x[0]+'</span><b>'+x[1]+'</b></div>').join("");
 var first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate(),html="";
 for(var p=0;p<first;p++)html+='<div class="rentalDay empty"></div>';
 for(var d=1;d<=days;d++){var dt=new Date(y,m,d),iso=rIso(dt),booking=rentalBookings.find(b=>rentalBelongs(b)&&iso>=b.checkin&&iso<b.checkout),block=rentalBlocks.find(b=>rentalBelongs(b)&&b.date===iso),cls=booking?"booked":block?.status||"available",label=booking?(booking.ref||"Booked"):(block?.status==="maintenance"?"Maintenance":block?.status==="blocked"?"Blocked":"Available");
  html+='<button class="rentalDay '+cls+'" data-date="'+iso+'"><span class="rentalDayNo">'+d+'</span><span class="rentalDayState">'+rEsc(label)+'</span>'+(booking?'<small>'+rMoney(rentalRate(booking))+'</small>':'')+'</button>'}
 cal.innerHTML=html;cal.querySelectorAll(".rentalDay:not(.empty)").forEach(b=>b.onclick=()=>rentalOpenDay(b.dataset.date));
 document.getElementById("rentalMonthFinance").innerHTML='<div class="rentalFinanceRow"><span>Gross booking revenue</span><b>'+rMoney(md.revenue)+'</b></div><div class="rentalFinanceRow"><span>Organiser fees</span><b class="red">− '+rMoney(md.fees)+'</b></div><div class="rentalFinanceRow"><span>Operating expenses</span><b class="red">− '+rMoney(md.expenses)+'</b></div><div class="rentalFinanceRow total"><span>Net rental income</span><b class="'+(md.net>=0?"green":"red")+'">'+rMoney(md.net)+'</b></div><div class="rentalOcc"><div><span>Occupancy</span><b>'+md.occupancy.toFixed(0)+'%</b></div><div class="rentalOccBar"><i style="width:'+Math.min(100,md.occupancy)+'%"></i></div></div>';
 var now=rIso(new Date()),up=rentalBookings.filter(b=>rentalBelongs(b)&&b.checkout>=now).sort((a,b)=>a.checkin.localeCompare(b.checkin)).slice(0,5);
 document.getElementById("rentalUpcoming").innerHTML=up.length?up.map(b=>'<div class="rentalUpcoming"><div><b>'+b.checkin+' → '+b.checkout+'</b><span>'+rEsc(b.ref||"Booking")+' • '+rNights(b.checkin,b.checkout)+' nights</span></div><b>'+rMoney(rentalGross(b))+'</b></div>').join(""):'<div class="meta rentalEmpty">No upcoming bookings yet.</div>';
 document.getElementById("rentalBookingBody").innerHTML=rentalBookings.filter(rentalBelongs).slice().sort((a,b)=>b.checkin.localeCompare(a.checkin)).map(b=>`<tr><td><b>${b.checkin}</b><small>to ${b.checkout}</small></td><td>${rEsc(b.ref||"—")}</td><td>${rNights(b.checkin,b.checkout)}</td><td><b>${rMoney(rentalRate(b))}</b><small>${rentalCurrency(b)==='SAR'?'':' '+rEsc(rentalCurrency(b))+' '+rentalNativeRate(b).toFixed(2)+' × '+Number(b.fxRateSAR).toFixed(6)+' • '}SAR / night</small></td><td>${rMoney(rentalGross(b)*rentalFeeRate(b)/100)} <small>(${rentalFeeRate(b)}%)</small></td><td><button type="button" class="rentalBadge rentalPaymentToggle ${b.paid?"paid":"pending"}" data-id="${rEsc(b.id)}">${b.paid?"Received ✓":"Pending • Mark Paid"}</button></td><td>${b.checkout<now?"Completed":b.checkin<=now?"Occupied":"Booked"}</td><td><button class="btn rentalEditBooking" data-id="${rEsc(b.id)}">Edit</button> <button class="btn rentalDeleteBooking" data-id="${rEsc(b.id)}">Delete</button></td></tr>`).join("")||'<tr><td colspan="8" class="meta">No bookings recorded.</td></tr>';
 document.querySelectorAll('.rentalEditBooking').forEach(b=>b.onclick=()=>rentalOpenBooking(null,b.dataset.id));
 document.querySelectorAll(".rentalPaymentToggle").forEach(b=>b.onclick=()=>{var x=rentalBookings.find(v=>String(v.id)===String(b.dataset.id)&&rentalBelongs(v));if(!x)return;var newPaid=!x.paid;x.paid=newPaid;x.paidAmount=newPaid?rentalGross(x):0;x.paymentDate=newPaid?rIso(new Date()):"";if(newPaid){var related=rentalBookings.filter(v=>v!==x&&rentalBelongs(v)&&!v.paid&&v.ref&&x.ref&&v.ref.trim().toLowerCase()===x.ref.trim().toLowerCase());if(related.length&&confirm("Mark all "+(related.length+1)+" bookings in this sequence/reference as paid?"))related.forEach(v=>{v.paid=true;v.paidAmount=rentalGross(v);v.paymentDate=rIso(new Date())})}rentalSave();renderRental()});
 document.querySelectorAll(".rentalDeleteBooking").forEach(b=>b.onclick=()=>{if(confirm("Delete this booking?")){var target=rentalBookings.find(x=>String(x.id)===String(b.dataset.id));if(!target)return;if(typeof recordImmediateDelete==='function')recordImmediateDelete('rental_bookings',target.id,'rental-booking-delete');rentalBookings=rentalBookings.filter(x=>String(x.id)!==String(target.id));rentalSave();renderRental()}});
 var exp=rentalExpenses.filter(e=>rentalBelongs(e)&&rDate(e.date).getFullYear()===y&&rDate(e.date).getMonth()===m).sort((a,b)=>b.date.localeCompare(a.date));
 document.getElementById("rentalExpenses").innerHTML=exp.length?exp.map(e=>'<div class="rentalExpenseLine"><div><b>'+e.category+'</b><span>'+e.date+(e.note?" • "+e.note:"")+'</span></div><div class="rentalExpenseRight"><b>− '+rMoney(e.amount)+'</b><div class="rentalExpenseActions"><button type="button" class="btn rentalEditExpense" data-id="'+e.id+'">Edit</button><button type="button" class="btn danger rentalDeleteExpense" data-id="'+e.id+'">Delete</button></div></div></div>').join(""):'<div class="meta rentalEmpty">No expenses recorded for this month.</div>';
 document.querySelectorAll(".rentalEditExpense").forEach(b=>b.onclick=()=>rentalOpenExpense(b.dataset.id));
 document.querySelectorAll(".rentalDeleteExpense").forEach(b=>b.onclick=()=>{var x=rentalExpenses.find(e=>String(e.id)===String(b.dataset.id));if(!x)return;if(confirm("Delete "+x.category+" expense of "+rMoney(x.amount)+"?")){if(typeof recordImmediateDelete==='function')recordImmediateDelete('rental_expenses',x.id,'rental-expense-delete');rentalExpenses=rentalExpenses.filter(e=>String(e.id)!==String(b.dataset.id));rentalSave();renderRental()}});
 renderRentalReport();
}
window.rentalAddUnit=function(){
 const name=prompt('Name of the new rental unit');if(!name?.trim())return;
 if(rentalUnits.some(u=>u.name.toLowerCase()===name.trim().toLowerCase())){alert('A unit with this name already exists.');return}
 const unit={id:'unit-'+Date.now(),name:name.trim(),organiserFee:30};rentalUnits.push(unit);rentalUnitId=unit.id;
 if(typeof recordImmediateUpsert==='function')recordImmediateUpsert('rental_units',unit.id,unit,'rental-unit-add');rentalSave();renderRental();
};
window.rentalUpdateFee=function(value){
 const rate=Number(value);if(!Number.isFinite(rate)||rate<0||rate>100){alert('Enter a fee from 0 to 100%.');renderRental();return}
 rentalUnit().organiserFee=rate;
 if(typeof recordImmediateUpsert==='function')recordImmediateUpsert('rental_units',rentalUnit().id,rentalUnit(),'rental-fee-change');
 rentalSave();renderRental();
};
window.renderRentalReport=function(){
 const target=document.getElementById('rentalReport');if(!target)return;
 const period=document.getElementById('rentalReportPeriod')?.value||'monthly',bookings=rentalBookings.filter(rentalBelongs),expenses=rentalExpenses.filter(rentalBelongs),groups=new Map();
 const keyFor=iso=>{const d=rDate(iso);if(period==='yearly')return iso.slice(0,4);if(period==='monthly')return iso.slice(0,7);if(period==='weekly'){const monday=rDate(iso);monday.setDate(monday.getDate()-((monday.getDay()+6)%7));return rIso(monday)}return iso};
 const group=key=>{if(!groups.has(key))groups.set(key,{nights:0,gross:0,fees:0,expenses:0,received:0});return groups.get(key)};
 bookings.forEach(b=>{for(let d=rDate(b.checkin),end=rDate(b.checkout);d<end;d.setDate(d.getDate()+1)){const g=group(keyFor(rIso(d))),gross=rentalRate(b);g.nights++;g.gross+=gross;g.fees+=gross*rentalFeeRate(b)/100}if(b.paid&&b.paymentDate)group(keyFor(b.paymentDate)).received+=Number(b.paidAmount??rentalGross(b))});
 expenses.forEach(e=>{if(e.date)group(keyFor(e.date)).expenses+=Number(e.amount||0)});
 const availability=key=>{
  let start,end;if(period==='daily'){start=rDate(key);end=rDate(rNextDate(key))}
  else if(period==='weekly'){start=rDate(key);end=new Date(start);end.setDate(end.getDate()+7)}
  else if(period==='monthly'){start=rDate(key+'-01');end=new Date(start);end.setMonth(end.getMonth()+1)}
  else{start=rDate(key+'-01-01');end=new Date(start);end.setFullYear(end.getFullYear()+1)}
  let nights=0;for(let d=new Date(start);d<end;d.setDate(d.getDate()+1)){
   const iso=rIso(d);if(!rentalBlocks.some(b=>rentalBelongs(b)&&b.date===iso&&['blocked','maintenance'].includes(b.status)))nights++;
  }return nights;
 };
 const rows=[...groups].sort((a,b)=>b[0].localeCompare(a[0])).map(([key,g])=>{
  const available=availability(key),occupancy=available?100*g.nights/available:0,revpan=available?g.gross/available:0;
  return `<tr><td>${key}</td><td>${g.nights} / ${available}</td><td>${occupancy.toFixed(1)}%</td><td>${rMoney(revpan)}</td><td>${rMoney(g.gross)}</td><td>${rMoney(g.fees)}</td><td>${rMoney(g.expenses)}</td><td>${rMoney(g.gross-g.fees-g.expenses)}</td><td>${rMoney(g.received)}</td></tr>`;
 });
 const viewMonth=rIso(rentalView).slice(0,7),comparison=rentalUnits.map(unit=>{
  const before=rentalUnitId;rentalUnitId=unit.id;const data=rentalMonthDataFor(rentalView);
  const blocked=rentalBlocks.filter(b=>rentalBelongs(b)&&b.date.startsWith(viewMonth)&&['blocked','maintenance'].includes(b.status)).length;
  const available=Math.max(0,data.days-blocked);rentalUnitId=before;
  return `<tr><td>${rEsc(unit.name)}</td><td>${data.booked} / ${available}</td><td>${(available?100*data.booked/available:0).toFixed(1)}%</td><td>${rMoney(available?data.revenue/available:0)}</td><td>${rMoney(data.revenue)}</td><td>${rMoney(data.fees)}</td><td>${rMoney(data.net)}</td></tr>`;
 }).join('');
 target.innerHTML='<div class="tableWrap"><table class="rentalTable"><thead><tr><th>Period</th><th>Booked / Available</th><th>Occupancy</th><th>Revenue / Available Night</th><th>Gross</th><th>Organiser Fees</th><th>Expenses</th><th>Net</th><th>Received</th></tr></thead><tbody>'+(rows.join('')||'<tr><td colspan="9">No rental activity recorded.</td></tr>')+'</tbody></table></div><h3>Unit Comparison · '+viewMonth+'</h3><div class="tableWrap"><table class="rentalTable"><thead><tr><th>Unit</th><th>Booked / Available</th><th>Occupancy</th><th>Revenue / Available Night</th><th>Gross</th><th>Organiser Fees</th><th>Net</th></tr></thead><tbody>'+comparison+'</tbody></table></div>';
};
function rentalDatesInRange(start,end){
 var dates=[],cursor=rDate(start),last=rDate(end);
 while(cursor<=last){dates.push(rIso(cursor));cursor.setDate(cursor.getDate()+1)}
 return dates;
}
window.rentalOpenDay=function(date){
 var booking=rentalBookings.find(b=>rentalBelongs(b)&&date>=b.checkin&&date<b.checkout);
 if(booking){rentalOpenBooking(null,booking.id);return}
 var block=rentalBlocks.find(b=>rentalBelongs(b)&&b.date===date);
 rentalModal("Manage availability",'<div class="field"><label>Start Date</label><input name="startDate" type="date" required value="'+date+'"></div><div class="field"><label>End Date (inclusive)</label><input name="endDate" type="date" required value="'+date+'"></div><div class="field full"><label>Day Status</label><select name="status"><option value="available"'+(!block?' selected':'')+'>Available / Remove Block</option><option value="booking">Create Booking for Range</option><option value="blocked"'+(block?.status==="blocked"?' selected':'')+'>Blocked</option><option value="maintenance"'+(block?.status==="maintenance"?' selected':'')+'>Maintenance</option></select></div><div class="field full"><label>Reason / Note</label><input name="note" value="'+rEsc(block?.note||'')+'" placeholder="Optional reason for the selected date range"></div>',fd=>{
  var start=String(fd.get("startDate")||date),end=String(fd.get("endDate")||start),status=fd.get("status"),note=fd.get("note");
  if(end<start){alert("End Date must be the same as or after Start Date.");return false}
  var dates=rentalDatesInRange(start,end);
  var conflicts=rentalBookings.filter(b=>rentalBelongs(b)&&dates.some(x=>x>=b.checkin&&x<b.checkout));
  if(status!=="available"&&conflicts.length){alert("This range overlaps an existing booking. Change the dates or edit the booking first.");return false}
  if(status==='booking'){
   if(dates.some(x=>rentalBlocks.some(b=>rentalBelongs(b)&&b.date===x&&b.status!=='available'))){alert('The range contains blocked or maintenance days. Make them available first.');return false}
   setTimeout(()=>rentalOpenBooking(start,null,rNextDate(end)),0);return;
  }
  var selected=new Set(dates),removed=rentalBlocks.filter(b=>rentalBelongs(b)&&selected.has(b.date));
  if(status==='available')removed.forEach(b=>{if(typeof recordImmediateDelete==='function')recordImmediateDelete('rental_blocks',syncStableId('rental_blocks',b),'rental-block-delete')});
  rentalBlocks=rentalBlocks.filter(b=>!rentalBelongs(b)||!selected.has(b.date));
  if(status!=="available"){
   const added=dates.map(x=>({date:x,unitId:rentalUnit().id,status,note,rangeStart:start,rangeEnd:end}));
   rentalBlocks.push(...added);
   if(typeof recordImmediateBatch==='function')recordImmediateBatch('rental_blocks',added,'rental-range-save');
  }
 });
}
function rentalModal(title,fields,onSave){
 var old=document.getElementById("rentalModal");if(old)old.remove();var d=document.createElement("div");d.className="modalBack open";d.id="rentalModal";d.innerHTML='<div class="modal"><div class="modalHead"><div class="modalTitle">'+title+'</div><button class="closeBtn" type="button">✕</button></div><form class="formGrid" id="rentalForm">'+fields+'<div class="field full" style="display:flex;justify-content:flex-end;gap:8px"><button type="button" class="btn rentalCancel">Cancel</button><button class="btn primary" type="submit">Save</button></div></form></div>';document.body.appendChild(d);d.querySelector(".closeBtn").onclick=d.querySelector(".rentalCancel").onclick=()=>d.remove();d.querySelector("form").onsubmit=e=>{e.preventDefault();if(onSave(new FormData(e.target))===false)return;d.remove();rentalSave();renderRental()}
}
window.rentalOpenBooking=function(date,id,checkout){
 const existing=id!=null?rentalBookings.find(b=>String(b.id)===String(id)&&rentalBelongs(b)):null;
 const currency=existing?(existing.currency||'SAR'):'PHP',rate=existing?rentalNativeRate(existing):'',fx=existing?.fxRateSAR??(currency==='SAR'?1:'');
 rentalModal(existing?'Edit Booking':'Add Booking','<div class="field"><label>Check-in</label><input name="checkin" type="date" required value="'+(existing?.checkin||date||rIso(new Date()))+'"></div><div class="field"><label>Check-out (not a booked night)</label><input name="checkout" type="date" required value="'+(existing?.checkout||checkout||rNextDate(date||rIso(new Date())))+'"></div><div class="field"><label>Booking Reference</label><input name="ref" value="'+rEsc(existing?.ref||'')+'" placeholder="Airbnb reference or guest initials"></div><div class="field"><label>Customer payment currency</label><select name="currency"><option value="PHP"'+(currency==='PHP'?' selected':'')+'>PHP • Philippine peso</option><option value="USD"'+(currency==='USD'?' selected':'')+'>USD • US dollar</option><option value="SAR"'+(currency==='SAR'?' selected':'')+'>SAR • Saudi riyal</option></select></div><div class="field"><label>Daily rate (customer currency / night)</label><input name="dailyRate" type="number" min="0" step="0.01" required value="'+rate+'"></div><div class="field"><label>1 customer currency = SAR (editable)</label><input name="fxRateSAR" type="number" min="0.000001" step="any" required value="'+fx+'"></div><div class="field full meta" id="rentalFxSource">Loading reference rate…</div><div class="field"><label>Organiser Fee (%)</label><input name="organiserFee" type="number" min="0" max="100" step="0.01" required value="'+(existing?rentalFeeRate(existing):Number(rentalUnit().organiserFee??30))+'"></div><div class="field"><label>Payment</label><select name="paid"><option value="0">Pending</option><option value="1"'+(existing?.paid?' selected':'')+'>Received</option></select></div><div class="field full"><label>Notes</label><input name="note" value="'+rEsc(existing?.note||'')+'"></div>',fd=>{
  const a=String(fd.get('checkin')),z=String(fd.get('checkout')),rate=Number(fd.get('dailyRate')),fee=Number(fd.get('organiserFee')),currency=String(fd.get('currency')),fx=Number(fd.get('fxRateSAR'));
  if(z<=a){alert('Check-out must be after check-in.');return false}
  if(!['PHP','USD','SAR'].includes(currency)||!(fx>0)||!Number.isFinite(rate)||rate<0){alert('Enter a valid currency, daily rate and SAR exchange rate.');return false}
  if(currency==='SAR'&&fx!==1){alert('SAR bookings use a rate of 1.');return false}
  if(!Number.isFinite(fee)||fee<0||fee>100){alert('Fee must be 0–100%.');return false}
  if(rentalBookings.some(b=>b!==existing&&rentalBelongs(b)&&a<b.checkout&&z>b.checkin)){alert('Booking overlaps another reservation for this unit.');return false}
  if(rentalDatesInRange(a,rIso(new Date(rDate(z).getTime()-86400000))).some(day=>rentalBlocks.some(b=>rentalBelongs(b)&&b.date===day&&b.status!=='available'))){alert('Booking overlaps blocked or maintenance dates.');return false}
  const paid=fd.get('paid')==='1',grossSAR=rate*fx*rNights(a,z),row={id:existing?.id||Date.now(),unitId:rentalUnit().id,checkin:a,checkout:z,ref:String(fd.get('ref')||''),dailyRate:rate,currency,fxRateSAR:fx,fxRateDate:document.getElementById('rentalFxSource')?.dataset.rateDate||existing?.fxRateDate||'',organiserFee:fee,paid,paidAmount:paid?grossSAR:0,paymentDate:paid?(existing?.paymentDate||rIso(new Date())):'',note:String(fd.get('note')||'')};
  if(existing)Object.assign(existing,row);else rentalBookings.push(row);
  if(typeof recordImmediateUpsert==='function')recordImmediateUpsert('rental_bookings',row.id,row,'rental-booking-save');
 });
 const modal=document.getElementById('rentalModal'),currencyEl=modal.querySelector('[name="currency"]'),fxEl=modal.querySelector('[name="fxRateSAR"]'),status=modal.querySelector('#rentalFxSource');
 fxEl.addEventListener('input',()=>{fxEl.dataset.manual='1';status.dataset.rateDate='';status.textContent='Custom exchange rate: 1 '+currencyEl.value+' = '+fxEl.value+' SAR.'});
 const loadRate=()=>{const selected=currencyEl.value;fxEl.dataset.manual='';if(selected==='SAR'){fxEl.value=1;status.textContent='SAR booking • no conversion';status.dataset.rateDate=rIso(new Date());return}
  if(existing&&selected===currency){fxEl.value=existing.fxRateSAR;status.textContent='Saved booking rate. Change it or select another currency to fetch a new reference.';status.dataset.rateDate=existing.fxRateDate||'';return}
  fxEl.value='';status.textContent='Loading '+selected+' → SAR reference rate…';financeFetchSarRate(selected).then(data=>{if(!modal.isConnected||currencyEl.value!==selected||fxEl.dataset.manual)return;fxEl.value=data.rate;status.dataset.rateDate=data.date||'';status.textContent='Reference '+(data.date||'latest')+' • 1 '+selected+' = '+data.rate+' SAR. You can override it.'}).catch(()=>{if(modal.isConnected&&currencyEl.value===selected)status.textContent='Reference rate unavailable. Enter the rate used for this booking.'});
 };
 currencyEl.addEventListener('change',loadRate);loadRate();
}
window.rentalOpenExpense=function(id){
 var existing=id!=null?rentalExpenses.find(e=>String(e.id)===String(id)):null;
 var categories=["Cleaning","Laundry","Utilities","Internet","Maintenance","Supplies","Platform Fee","Furniture","Other"];
 var categoryOptions=categories.map(c=>'<option'+(existing&&existing.category===c?' selected':'')+'>'+c+'</option>').join("");
 rentalModal(existing?"Edit Rental Expense":"Add Rental Expense",'<div class="field"><label>Date</label><input name="date" type="date" required value="'+(existing?.date||rIso(new Date()))+'"></div><div class="field"><label>Category</label><select name="category">'+categoryOptions+'</select></div><div class="field"><label>Amount (SAR)</label><input name="amount" type="number" min="0" step="0.01" required value="'+(existing?.amount??"")+'"></div><div class="field"><label>Note</label><input name="note" value="'+String(existing?.note||"").replace(/"/g,"&quot;")+'"></div>',fd=>{
  var data={id:existing?.id||Date.now(),unitId:rentalUnit().id,date:fd.get("date"),category:fd.get("category"),amount:Number(fd.get("amount")),note:fd.get("note")};
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
  const ownWorkspace=window.financeWorkspaceChoices?.find(w=>w.own);
  const workspaceName=document.getElementById('financeWorkspaceName');if(workspaceName)workspaceName.value=ownWorkspace?.name||'My Workspace';
  const switcher=document.getElementById('accountWorkspaceSwitch');if(switcher){
   switcher.replaceChildren();(window.financeWorkspaceChoices||[]).forEach(w=>{
    const option=document.createElement('option');option.value=w.id;option.textContent=w.name+(w.own?' · Mine':' · Shared');switcher.append(option);
   });switcher.value=window.financeWorkspaceUserId||'';
   switcher.onchange=()=>window.financeChooseWorkspace?.(switcher.value);
  }
  const adminCard=document.getElementById('adminAccessCard');if(adminCard)adminCard.hidden=!window.financeIsOwner||!!window.financeSharedWorkspace;
  const ownCard=document.getElementById('accountOwnAccessCard'),summary=document.getElementById('accountOwnAccessSummary');
  if(ownCard&&summary){
   ownCard.hidden=!!window.financeIsOwner;
   const entries=Object.entries(window.financePagePermissions||{}).filter(([,v])=>v==='view'||v==='edit');
   summary.textContent=entries.length
    ?entries.map(([page,permission])=>page.replaceAll('_',' ')+' ('+permission+')').join(' · ')
    :'Waiting for the administrator to enable finance pages for this account.';
   const notice=document.getElementById('accountAccessNotice');
   if(notice)notice.hidden=!!window.financeIsOwner||entries.length>0;
   const share=document.getElementById('accountShareSave');
   if(share)share.disabled=!window.financeIsOwner&&!entries.some(([,permission])=>permission==='edit');
  }
 };
 document.addEventListener('click',e=>{const b=e.target.closest('[data-theme-choice]');if(!b)return;const theme=b.dataset.themeChoice;if(!['dark','light','system'].includes(theme))return;const p=getPrefs();p.theme=theme;localStorage.setItem(PREF_KEY,JSON.stringify(p));applyFinancePreferences()});
 document.addEventListener('change',e=>{
  const key={prefCompactNav:'compactNav'}[e.target.id];
  if(!key)return;
  const p=getPrefs();p[key]=!!e.target.checked;
  localStorage.setItem(PREF_KEY,JSON.stringify(p));
  applyFinancePreferences();
 });
 document.addEventListener('submit',e=>{if(e.target.id!=='accountProfileForm')return;e.preventDefault();const name=document.getElementById('accountDisplayName').value.trim()||'My Finance User',email=window.financeUserEmail||'',initials=(document.getElementById('accountInitials').value.trim()||name.split(/\s+/).map(x=>x[0]).join('').slice(0,2)||'MF').toUpperCase().slice(0,3);localStorage.setItem(PROFILE_KEY,JSON.stringify({name,email,initials}));renderAccountProfile();});
 window.financeChooseWorkspace=async function(workspaceId){
  if(workspaceId===window.financeWorkspaceUserId)return;
  if(!window.financeWorkspaceChoices?.some(w=>w.id===workspaceId))return;
  if(typeof getCloudMeta==='function'&&getCloudMeta().pending){
   const synced=await recordPushAll('before-workspace-switch');
   if(!synced){alert('Sync is still pending. Resolve it before switching workspaces.');renderAccountProfile();return}
  }
  sessionStorage.setItem('finance_workspace_selected_'+window.financeActiveUserId,workspaceId);
  location.reload();
 };
 document.getElementById('accountNewWorkspaceCreate')?.addEventListener('click',async e=>{
  const button=e.currentTarget,input=document.getElementById('accountNewWorkspaceName');
  const status=document.getElementById('accountNewWorkspaceStatus'),name=String(input?.value||'').trim();
  if(!name||name.length>80){status.textContent='Use a name between 1 and 80 characters.';return;}
  button.disabled=true;status.textContent='Creating database…';
  try{
   const {data:id,error}=await window.financeSupabaseClient.rpc('finance_create_workspace',{workspace_name:name});
   if(error||!id)throw error||new Error('Database creation was not confirmed.');
   window.financeWorkspaceChoices.push({id,name,own:true});
   input.value='';status.textContent='Database created. Switching to '+name+'…';
   await window.financeChooseWorkspace(id);
  }catch(error){status.textContent='Could not create database: '+error.message;}
  finally{button.disabled=false;}
 });
 document.getElementById('financeWorkspaceNameSave')?.addEventListener('click',async()=>{
  const status=document.getElementById('financeWorkspaceNameStatus');
  const name=document.getElementById('financeWorkspaceName')?.value.trim();
  if(!name||name.length>80){status.textContent='Use a name between 1 and 80 characters.';return}
  try{
   const client=window.financeSupabaseClient,{data:{session}}=await client.auth.getSession();
   if(!session)throw new Error('Sign in first.');
   const {error}=await client.from('finance_workspace_profiles').upsert({owner_user_id:session.user.id,display_name:name,updated_at:new Date().toISOString()},{onConflict:'owner_user_id'});
   if(error)throw error;
   const own=window.financeWorkspaceChoices?.find(w=>w.own);if(own)own.name=name;
   if(window.financeWorkspaceUserId===session.user.id)window.financeWorkspaceName=name;
   status.textContent='Workspace name saved.';renderAccountProfile();
   if(typeof syncCanonicalShell==='function')syncCanonicalShell(typeof activeViewId==='function'?activeViewId()||'accountprofile':'accountprofile');
  }catch(error){status.textContent='Could not save workspace name: '+error.message}
 });
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
 const inviteButton=document.getElementById('adminInviteSend');
 if(inviteButton)inviteButton.addEventListener('click',async()=>{
  const input=document.getElementById('adminInviteEmail'),status=document.getElementById('adminInviteStatus');
  const email=String(input?.value||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){status.textContent='Enter a valid email address.';return;}
  inviteButton.disabled=true;status.textContent='Sending invitation…';
  try{
   const {data,error}=await client.functions.invoke('finance-invite-user',{body:{email}});
   if(error||!data?.invited)throw new Error(data?.error||error?.message||'Invitation was not confirmed.');
   status.textContent='Invitation sent to '+email+'. They can set their password from the email link.';
   input.value='';
   window.renderFinanceAdminAccess?.();
  }catch(error){status.textContent='Could not send invitation: '+error.message;}
  finally{inviteButton.disabled=false;}
 });
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
   const grantOwner=document.getElementById('liveGrantOwner'),grantMember=document.getElementById('liveGrantMember'),liveList=document.getElementById('liveGrantList');
   if(grantOwner&&grantMember&&liveList){
    const beforeOwner=grantOwner.value,beforeMember=grantMember.value;
    grantOwner.replaceChildren();grantMember.replaceChildren();liveList.replaceChildren();
    const labels=new Map(users.map(u=>[u.user_id,u.user_email||u.user_id]));
    users.forEach(u=>{const a=el('option','',labels.get(u.user_id)),b=el('option','',labels.get(u.user_id));a.value=b.value=u.user_id;grantOwner.append(a);grantMember.append(b)});
    grantOwner.value=labels.has(beforeOwner)?beforeOwner:userId;
    grantMember.value=labels.has(beforeMember)?beforeMember:(users.find(u=>u.user_id!==userId)?.user_id||userId);
    if(!grants.length)liveList.textContent='No live workspaces shared.';
    grants.forEach(g=>liveList.append(el('div','prefsStatus',`${labels.get(g.owner_user_id)||g.owner_user_id} → ${labels.get(g.member_user_id)||g.member_user_id} · ${g.page} · ${g.permission}`)));
   }
   window.financeOwnAccessRows=pages;
   const ownSelect=document.getElementById('ownAccessUser');
   if(ownSelect){
    const selected=ownSelect.value;
    ownSelect.replaceChildren();
    users.filter(u=>u.user_id!==userId).forEach(u=>{
     const option=el('option','',u.user_email||u.user_id);option.value=u.user_id;ownSelect.append(option);
    });
    if(users.some(u=>u.user_id===selected&&u.user_id!==userId))ownSelect.value=selected;
    window.renderOwnAccessMatrix?.();
   }
   status.textContent=users.length+' registered account'+(users.length===1?'':'s')+' · '+grants.length+' explicit sharing grant'+(grants.length===1?'':'s')+'.';
   for(const user of users){
    const card=el('div','prefsStatus');
    const name=el('b','',user.user_email||user.user_id);
    const detail=el('span','',user.user_id===userId?'Administrator · own workspace':
      'Private workspace · '+pages.filter(p=>p.user_id===user.user_id).length+' page setting(s)');
    card.append(name,detail);
    if(user.user_id!==userId){const edit=el('button','btn','Edit own page access');edit.type='button';edit.onclick=()=>{
      const selector=document.getElementById('ownAccessUser');if(!selector)return;
      selector.value=user.user_id;window.renderOwnAccessMatrix?.();
      document.getElementById('ownAccessMatrix')?.scrollIntoView({behavior:'smooth',block:'center'});
     };card.append(edit);
     const remove=el('button','btn danger','Delete user');remove.type='button';
     remove.onclick=async()=>{
      const label=user.user_email||user.user_id;
      const typed=prompt('Permanently delete '+label+' and their private finance records? Type their full email to continue.');
      if(typed===null)return;
      if(typed.trim().toLowerCase()!==String(user.user_email||'').toLowerCase()){
       status.textContent='Email did not match. No account was deleted.';return;
      }
      if(!confirm('Final confirmation: delete '+label+'? This removes their login, private finance data, and audit history. This cannot be undone.'))return;
      remove.disabled=true;status.textContent='Deleting account…';
      try{
       const {data,error}=await client.functions.invoke('finance-delete-user',{
        body:{userId:user.user_id,confirmEmail:typed.trim()}
       });
       if(error||!data?.deleted)throw new Error(data?.error||error?.message||'Deletion was not confirmed.');
       await window.renderFinanceAdminAccess();
       status.textContent=label+' was deleted.';
      }catch(error){status.textContent='Could not delete user: '+error.message;remove.disabled=false;}
     };card.append(remove)}
    const ownGrants=grants.filter(g=>g.owner_user_id===user.user_id);
    if(ownGrants.length)card.append(el('small','',ownGrants.length+' page grant(s) to other users'));
    box.append(card);
   }
 }catch(e){status.textContent='Access directory unavailable: '+e.message;}
 };
 const ownPages=[
  ['executive','Executive Overview'],['accounts','Cash & Credit'],
  ['financialposition','Financial Position'],['strategy','Financial Strategy'],
  ['transactions','Transactions'],['incomeplan','Income & Payment Plan'],
  ['outgoings','Cash & Other Outgoings'],['installments','Installments'],
  ['importstatements','Import Statements'],['investments','Investments'],
  ['assets','Personal Assets'],['rental','Airbnb / Rental'],
  ['reports','Reports'],['financeSettings','Finance Settings'],
  ['bankconnections','Bank Connections (testing — admin approval)']
 ];
 window.renderOwnAccessMatrix=function(){
  const user=document.getElementById('ownAccessUser')?.value,
   matrix=document.getElementById('ownAccessMatrix'),status=document.getElementById('ownAccessStatus');
  if(!matrix||!status)return;
  matrix.replaceChildren();
  if(!user){status.textContent='No other registered users yet. They will appear here after signup.';return;}
  const saved=new Map((window.financeOwnAccessRows||[]).filter(r=>r.user_id===user).map(r=>[r.page,r.permission]));
  status.textContent=saved.size?'Saved page access is shown below.':'New account · no finance pages assigned yet.';
  ownPages.forEach(([id,label])=>{
   const row=el('label','');row.append(el('span','',label));
   const select=el('select','');select.dataset.ownPage=id;
   [['off','Hidden'],['view','View only'],['edit','View and edit']].forEach(([value,textLabel])=>{
    const option=el('option','',textLabel);option.value=value;select.append(option);
   });
   select.value=saved.get(id)||'off';row.append(select);matrix.append(row);
  });
 };
 document.getElementById('ownAccessUser')?.addEventListener('change',()=>window.renderOwnAccessMatrix());
 document.getElementById('ownAccessAirbnbOnly')?.addEventListener('click',()=>{
  document.querySelectorAll('[data-own-page]').forEach(s=>s.value=s.dataset.ownPage==='rental'?'edit':'off');
 });
 document.getElementById('ownAccessAll')?.addEventListener('click',()=>{
  document.querySelectorAll('[data-own-page]').forEach(s=>{if(s.dataset.ownPage!=='bankconnections')s.value='edit';});
 });
 document.getElementById('ownAccessSave')?.addEventListener('click',async()=>{
  const user=document.getElementById('ownAccessUser')?.value,status=document.getElementById('ownAccessStatus');
  if(!user)return;
  status.textContent='Saving page access…';
  try{
   const actor=await identity();
   const {data:ownerRows,error:ownerError}=await client.from('finance_owner').select('owner_user_id').limit(1);
   if(ownerError||ownerRows?.[0]?.owner_user_id!==actor||user===actor)throw new Error('Administrator access is required.');
   const rows=[...document.querySelectorAll('[data-own-page]')].map(s=>({
    user_id:user,page:s.dataset.ownPage,permission:s.value,updated_at:new Date().toISOString()
   }));
   if(rows.length!==ownPages.length)throw new Error('Page list is incomplete. Refresh and try again.');
   const {error}=await client.from('finance_page_access').upsert(rows,{onConflict:'user_id,page'});
   if(error)throw error;
   status.textContent='Saved. The user’s open devices will refresh their permissions shortly.';
   await window.renderFinanceAdminAccess();
  }catch(e){status.textContent='Could not save page access: '+e.message;}
 });
 document.getElementById('liveGrantSave')?.addEventListener('click',async()=>{
  const owner=document.getElementById('liveGrantOwner')?.value,member=document.getElementById('liveGrantMember')?.value,
   page=document.getElementById('liveGrantPage')?.value,permission=document.getElementById('liveGrantPermission')?.value,
   status=document.getElementById('liveGrantStatus');
  if(!owner||!member||owner===member){status.textContent='Choose two different registered users.';return}
  status.textContent='Saving shared access…';
  try{
   const actor=await identity();
   const {data:ownerRows,error:ownerError}=await client.from('finance_owner').select('owner_user_id').limit(1);
   if(ownerError||ownerRows?.[0]?.owner_user_id!==actor)throw new Error('Administrator access is required.');
   const query=client.from('finance_workspace_grants');
   const result=permission==='off'
    ?await query.delete().match({owner_user_id:owner,member_user_id:member,page})
    :await query.upsert({owner_user_id:owner,member_user_id:member,page,permission,granted_by:actor},{onConflict:'owner_user_id,member_user_id,page'});
   if(result.error)throw result.error;
   await window.renderFinanceAdminAccess();
   status.textContent=permission==='off'?'Access removed.':'Shared access saved. The member can choose this workspace after signing in or refreshing.';
  }catch(error){status.textContent='Could not save shared access: '+error.message}
 });
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
    for(const page of pages){
     const revoke=el('button','btn small','Remove '+page.page+' access');revoke.type='button';
     revoke.onclick=async()=>{
      const email=emails.get(member);if(!email){alert('Member email is unavailable. Refresh and try again.');return;}
      if(!confirm('Remove '+email+' from '+page.page+' in your workspace?'))return;
      revoke.disabled=true;
      const {error}=await client.rpc('finance_share_my_workspace',{
       target_email:email,target_page:page.page,access_level:'off'
      });
      if(error){alert('Could not remove access: '+error.message);revoke.disabled=false;return;}
      await window.renderFinanceSharedWith();
     };item.append(revoke);
    }
    box.append(item);
   }
  }catch(e){box.textContent='Sharing list unavailable: '+e.message}
 };
 document.getElementById('accountShareSave')?.addEventListener('click',async()=>{
  const email=document.getElementById('accountShareEmail')?.value.trim(),
   page=document.getElementById('accountSharePage')?.value,
   permission=document.getElementById('accountSharePermission')?.value,
   status=document.getElementById('accountShareStatus');
  if(!email||!page||!permission){status.textContent='Enter the registered user email, page, and permission.';return;}
  if(window.financeSharedWorkspace){status.textContent='Switch to your own workspace before sharing it.';return;}
  status.textContent='Saving your sharing choice…';
  try{
   const {error}=await client.rpc('finance_share_my_workspace',{
    target_email:email,target_page:page,access_level:permission
   });
   if(error)throw error;
   status.textContent='Access saved. The member can choose your workspace after signing in or refreshing.';
   await window.renderFinanceSharedWith();
  }catch(error){status.textContent='Could not share: '+error.message;}
 });
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
 if(window.financeCanViewPage){
  setTimeout(()=>{
   const active=document.querySelector('.view.active')?.id;
   if(!window.financeCanViewPage(active)){
    const first=['executive','rental','investments','transactions','accounts','assets',
     'outgoings','installments','incomeplan','reports','accountprofile']
     .find(p=>window.financeCanViewPage(p))||'accountprofile';
    nav(first);
   }
  },0);
  setInterval(async()=>{
   try{
    const user=await identity();
    if(user!==window.financeActiveUserId)return;
    const shared=!!window.financeSharedWorkspace,workspace=window.financeWorkspaceUserId||user;
    const {data,error}=shared
      ?await client.from('finance_workspace_grants').select('page,permission').eq('owner_user_id',workspace).eq('member_user_id',user)
      :await client.from('finance_page_access').select('page,permission').eq('user_id',user);
    if(error)return;
    let testingPermission=window.financeIsOwner?'edit':'off';
    if(!window.financeIsOwner){
     const testing=shared?await client.from('finance_page_access').select('permission').eq('user_id',user).eq('page','bankconnections'):null;
     if(testing?.error)return;
     testingPermission=shared?(testing.data?.[0]?.permission||'off'):((data||[]).find(r=>r.page==='bankconnections')?.permission||'off');
    }
    const current=new Map((data||[]).map(r=>[r.page,r.permission]));
    const ordered=['executive','accounts','financialposition','strategy','transactions',
     'incomeplan','outgoings','installments','importstatements','investments',
     'assets','rental','reports','financeSettings'];
    if(JSON.stringify([workspace,...ordered.map(p=>current.get(p)||'off'),testingPermission])!==window.financePageFingerprint){
     document.body.classList.add('financeAccessLocked');
     const previousDataFingerprint=JSON.stringify(JSON.parse(window.financePageFingerprint).slice(0,ordered.length+1));
     const dataFingerprint=JSON.stringify([workspace,...ordered.map(p=>current.get(p)||'off')]);
     if(previousDataFingerprint!==dataFingerprint)await window.financeScopeWipe?.();
     location.reload();
    }
   }catch(e){console.warn('Page access refresh pending',e);}
  },5000);
 }
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
