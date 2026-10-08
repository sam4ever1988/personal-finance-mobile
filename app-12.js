/* 3.73: visible sync, private invitation history and owner unit controls. */
(function(){
 const byId=id=>document.getElementById(id);
 const linkError=new URLSearchParams(location.hash.slice(1));if(linkError.get('error_code')==='otp_expired'){const notice=document.createElement('p');notice.id='financeInvalidInvitation';notice.setAttribute('role','alert');notice.textContent='This invitation or sign-in link is no longer valid. It may have been cancelled or expired. Please request a new link.';notice.style.cssText='padding:14px;border:1px solid currentColor;border-radius:8px';document.querySelector('.financeAccessCard')?.prepend(notice);}
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function shellSize(){const header=document.querySelector('header');const bar=byId('financeDataFreshness');const h=header?.getBoundingClientRect().height||64;document.documentElement.style.setProperty('--finance-nav-height',h+'px');document.documentElement.style.setProperty('--finance-shell-height',(h+(bar?.getBoundingClientRect().height||0)+18)+'px');}
 const oldStatus=cloudSetStatus;
 cloudSetStatus=function(message){oldStatus(message);const bar=byId('financeDataFreshness');if(!bar)return;const needs=/conflict|needs review/i.test(message);bar.dataset.state=needs?'review':'normal';const label=document.createElement('span');label.textContent=bar.textContent;bar.replaceChildren(label);if(needs){const button=document.createElement('button');button.className='btn';button.textContent='Review sync';button.onclick=()=>nav('cloudSync');bar.append(button);}shellSize();};
 const oldVisible=financePageVisible;financePageVisible=function(page){return page==='invitations'?!window.financeSharedWorkspace:oldVisible(page);};
 const oldNav=nav;nav=function(page){oldNav(page);if(page==='invitations'){document.body.classList.add('modernMode');renderInvitations();}requestAnimationFrame(shellSize);};
 const invitationPages={executive:'Executive Overview',accounts:'Cash & Credit',financialposition:'Financial Position',strategy:'Financial Strategy',transactions:'Transactions',incomeplan:'Income & Payment Plan',outgoings:'Outgoings',installments:'Installments',importstatements:'Import Statements',investments:'Investments',assets:'Personal Assets',rental:'Airbnb / Rental',reports:'Reports',financeSettings:'Financial Settings'};
 let invitationLoading=false;
 function invitationTypeChanged(){const shared=byId('invitationType').value==='shared';byId('invitationSharedOptions').hidden=!shared;byId('invitationHelp').textContent=shared?'They can access only the workspace pages you select, and can also create their own private workspace.':'They can create their own private workspace. Your data will not be shared.';}
 async function loadInvitationWorkspaces(){
  const {data:{user},error:authError}=await cloudClient.auth.getUser();if(authError||!user)throw Error('Sign in first.');
  const {data,error}=await cloudClient.from('finance_workspaces').select('id,display_name').eq('owner_user_id',user.id).order('created_at');if(error)throw error;
  const select=byId('invitationWorkspace'),chosen=select.value;select.innerHTML=(data||[]).map(w=>'<option value="'+escape(w.id)+'">'+escape(w.display_name||'My Workspace')+'</option>').join('');if(data?.some(w=>w.id===chosen))select.value=chosen;
  if(!byId('invitationPermissions').children.length)byId('invitationPermissions').innerHTML='<table><thead><tr><th>Page</th><th>Access after acceptance</th></tr></thead><tbody>'+Object.entries(invitationPages).filter(([page])=>window.financeIsOwner||['view','edit'].includes(window.financePagePermissions?.[page])).map(([page,label])=>'<tr><td>'+escape(label)+'</td><td><select class="control" data-invitation-page="'+page+'" aria-label="'+escape(label)+' access"><option value="off">Hidden</option><option value="view">View only</option>'+(window.financeIsOwner||window.financePagePermissions?.[page]==='edit'?'<option value="edit">View and edit</option>':'')+'</select></td></tr>').join('')+'</tbody></table>';
 }
 window.renderInvitations=async function(){const content=byId('invitationHistory');if(!content||invitationLoading)return;invitationLoading=true;content.textContent='Loading invitation history…';try{
  if(!cloudClient)throw Error('Sign in and connect to the cloud to view invitations.');await loadInvitationWorkspaces();
  const {data,error}=await cloudClient.from('finance_user_invitations').select('id,email,status,created_at,sent_at,accepted_at,error_message,invitation_type,workspace_name,page_permissions').eq('sender_user_id',window.financeActiveUserId).order('created_at',{ascending:false}).limit(200);if(error)throw error;
  content.innerHTML=data?.length?'<div class="invitationTableScroll"><table><thead><tr><th>Email</th><th>Invitation / Access</th><th>Status</th><th>Sent</th><th>Accepted</th><th>Action</th></tr></thead><tbody>'+data.map(row=>'<tr><td>'+escape(row.email)+'</td><td>'+escape(row.invitation_type==='shared'?'Shared workspace: '+row.workspace_name:'Join the system — own private workspace')+(row.invitation_type==='shared'?'<div class="meta">'+Object.entries(row.page_permissions||{}).map(([page,level])=>escape((invitationPages[page]||page)+': '+(level==='edit'?'View and edit':'View only'))).join('<br>')+'</div>':'')+'</td><td>'+escape({sending:'Sending',sent:'Awaiting acceptance',accepted:'Accepted',failed:'Failed',cancelled:'Cancelled'}[row.status]||row.status)+(row.error_message?'<div class="meta">'+escape(row.error_message)+'</div>':'')+'</td><td>'+escape(row.sent_at?new Date(row.sent_at).toLocaleString():'—')+'</td><td>'+escape(row.accepted_at?new Date(row.accepted_at).toLocaleString():'—')+'</td><td>'+(row.status==='sent'?'<button type="button" class="btn" data-cancel-invitation="'+escape(row.id)+'">Cancel invitation</button>':'—')+'</td></tr>').join('')+'</tbody></table></div>':'<p class="meta">No invitations yet.</p>';
  content.querySelectorAll('[data-cancel-invitation]').forEach(button=>button.onclick=()=>cancelFinanceInvitation(button.dataset.cancelInvitation,button));
 }catch(error){content.textContent=error.message||'Unable to load invitations. Please try again.';}finally{invitationLoading=false;}};
 window.cancelFinanceInvitation=async function(id,button){if(!confirm('Cancel this invitation? Its acceptance link will no longer be valid.'))return;button.disabled=true;const status=byId('invitationMessage');status.textContent='Cancelling invitation…';try{const {data,error}=await cloudClient.rpc('finance_cancel_invitation',{invitation_id:id});if(error)throw error;if(!data?.cancelled)throw Error('Cancellation was not confirmed.');status.textContent='Invitation cancelled. Its acceptance link is no longer valid.';await renderInvitations();}catch(error){status.textContent=error.message||'Unable to cancel invitation. Please try again.';}finally{button.disabled=false;}};
 window.sendFinanceInvitation=async function(event){event.preventDefault();const button=byId('invitationSend'),status=byId('invitationMessage'),email=byId('invitationEmail').value.trim();button.disabled=true;status.textContent='Sending invitation…';try{
  if(window.financeSharedWorkspace||!cloudClient)throw Error('Switch to your own workspace and connect to send an invitation.');
  const invitationType=byId('invitationType').value,body={email,invitationType};
  if(invitationType==='shared'){body.workspaceId=byId('invitationWorkspace').value;body.permissions={};document.querySelectorAll('[data-invitation-page]').forEach(select=>{if(select.value!=='off')body.permissions[select.dataset.invitationPage]=select.value;});if(!Object.keys(body.permissions).length)throw Error('Select at least one page to share.');}
  const {data,error}=await cloudClient.functions.invoke('finance-invite-user',{body});if(error){let message=error.message;try{const detail=await error.context?.json();message=detail?.error||message;}catch(_){}throw Error(message);}if(!data?.invited)throw Error(data?.error||'Invitation could not be sent.');
  status.textContent=data.historyPending?'Invitation sent. History is still being updated.':invitationType==='shared'?'Invitation sent. Selected access will apply after acceptance.':'Invitation sent. They can create their own private workspace. Your data was not shared.';
  byId('invitationEmail').value='';byId('invitationType').value='system';document.querySelectorAll('[data-invitation-page]').forEach(select=>select.value='off');invitationTypeChanged();await renderInvitations();
 }catch(error){status.textContent=error.message;}finally{button.disabled=false;}};
 if(byId('invitationType'))byId('invitationType').onchange=invitationTypeChanged;
 const unitOwner=()=>!window.financeSharedWorkspace&&!!window.financeActiveUserId;
 function requireOwner(){if(!unitOwner())throw Error('Only the workspace owner can manage units.');}
 const previousRender=renderRental;renderRental=function(){previousRender();const controls=document.querySelector('#rental .rentalControls');if(!controls)return;let manage=byId('rentalUnitManagement');if(!manage){manage=document.createElement('span');manage.id='rentalUnitManagement';manage.innerHTML='<button class="btn" type="button" id="rentalEditUnit">Edit Unit</button> <button class="btn" type="button" id="rentalArchiveUnit">Archive Unit</button> <button class="btn" type="button" id="rentalDeleteUnit">Delete Unit</button>';controls.append(manage);byId('rentalEditUnit').onclick=editRentalUnit;byId('rentalArchiveUnit').onclick=()=>removeRentalUnit(true);byId('rentalDeleteUnit').onclick=()=>removeRentalUnit(false);}manage.hidden=!unitOwner();document.querySelectorAll('#rentalUnitSelect option').forEach(option=>{const unit=rentalUnits.find(u=>u.id===option.value);if(unit?.archived)option.textContent=unit.name+' (Archived)';});byId('rentalArchiveUnit').disabled=!!rentalUnit()?.archived;};
 window.editRentalUnit=function(){try{requireOwner();const unit=rentalUnit();const name=prompt('Unit name',unit.name);if(name===null)return;if(!name.trim())throw Error('Enter a unit name.');if(rentalUnits.some(u=>u.id!==unit.id&&u.name.toLowerCase()===name.trim().toLowerCase()))throw Error('A unit already has this name.');unit.name=name.trim();rentalSave();renderRental();}catch(error){alert(error.message);}};
 window.removeRentalUnit=async function(archive){try{requireOwner();const unit=rentalUnit();if(rentalUnits.filter(u=>!u.archived&&u.id!==unit.id).length<1)throw Error('Keep at least one active unit.');const linked=[...rentalBookings,...rentalExpenses,...rentalBlocks].some(x=>(x.unitId||x.unit_id||'default')===unit.id);if(linked&&!archive)throw Error('This unit has history. Archive it to preserve its bookings and expenses.');if(!confirm((archive?'Archive ':'Delete ')+unit.name+'?'))return;if(!cloudClient)throw Error('Connect to the cloud before removing a unit.');const data=archive?{...unit,archived:true}:{};const {error}=await cloudClient.from(typeof RECORD_SYNC_TABLE==='string'?RECORD_SYNC_TABLE:'finance_user_records').upsert({user_id:window.financeWorkspaceUserId||window.financeActiveUserId,section:'rental_units',record_id:String(unit.id),data,deleted_at:archive?null:new Date().toISOString()},{onConflict:'user_id,section,record_id'});if(error)throw error;if(archive)unit.archived=true;else rentalUnits=rentalUnits.filter(u=>u.id!==unit.id);rentalUnitId=rentalUnits.find(u=>!u.archived)?.id||rentalUnits[0].id;rentalSave();renderRental();}catch(error){alert(error.message);}};
 const oldBooking=rentalOpenBooking;rentalOpenBooking=function(date,id,checkout){if(!id&&rentalUnit()?.archived){alert('Choose an active unit to add a booking.');return;}return oldBooking(date,id,checkout);};
 if(byId('invitationForm'))byId('invitationForm').onsubmit=sendFinanceInvitation;
 if(byId('invitationReload'))byId('invitationReload').onclick=renderInvitations;
 const observer=new ResizeObserver(shellSize);const header=document.querySelector('header');if(header)observer.observe(header);if(byId('financeDataFreshness'))observer.observe(byId('financeDataFreshness'));window.addEventListener('resize',shellSize);shellSize();
})();

/* 3.76: date-based outlook and payment planner. Forecasts never write transactions. */
(function(){
 const el=id=>document.getElementById(id),esc=s=>escapeHtml(String(s??''));
 function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
 function addDays(date,n){return new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);}
 function monthDate(month,day){const [y,m]=month.split('-').map(Number);return month+'-'+String(Math.min(new Date(Date.UTC(y,m,0)).getUTCDate(),Math.max(1,Number(day)||1))).padStart(2,'0');}
 const state={date:addDays(today(),90),incomeDay:'',includeIncome:false};
 function buildForecast(target,options={}){
  const start=options.today||today(),end=/^\d{4}-\d{2}-\d{2}$/.test(target)&&target>=start?target:start;
  const cash=accounts.filter(a=>a.type==='bank').reduce((s,a)=>s+Number(adjustedBankBalance(a)||0),0),events=[],seen=new Set();
  const push=(x)=>{if(!(x.amount>.005)||x.date>end||x.date<start.slice(0,7)+'-01'||seen.has(x.id))return;seen.add(x.id);events.push({...x,effectiveDate:x.date<start?start:x.date,overdue:x.date<start});};
  const months=[];for(let m=start.slice(0,7);m<=end.slice(0,7)&&months.length<25;m=monthAdd(m,1))months.push(m);
  (cardPaymentPlan||[]).forEach(p=>{if(!months.includes(p.month)||!p.accountId)return;const amount=Number(paymentRemainingAmount(p)||0);push({id:'card:'+p.id,date:p.due||monthDate(p.month,cardCycleSetting(p.accountId).dueDay),amount,label:accountName(p.accountId),kind:'Card payment',page:'incomeplan',accountId:'',certainty:'Scheduled'});});
  (financeSettings.loans||[]).filter(l=>l.status!=='closed').forEach(l=>{let remaining=Math.max(0,Number(l.remainingAmount||0));for(const month of months){if(l.referenceMonth&&month<l.referenceMonth)continue;const amount=Math.min(remaining,Math.max(0,Number(loanInstallmentDue(l,month).remaining||0)));const date=monthDate(month,l.dueDay||l.paymentDay||1);if(date<=end&&amount>.005){push({id:'loan:'+l.id+':'+month,date,amount,label:l.name||'Loan',kind:'Loan payment',page:'incomeplan',accountId:l.defaultPaymentAccountId||'',certainty:'Scheduled'});remaining-=amount;}}});
  (outgoings||[]).forEach(o=>{for(const month of months){const offset=loanMonthDiff(o.startMonth,month);if(month<o.startMonth||(!o.forever&&offset>=Number(o.months||1)))continue;const date=monthDate(month,o.dueDay||1);push({id:'outgoing:'+o.id+':'+month,date,amount:outgoingRemaining(o,month),label:o.description||'Outgoing',kind:'Recurring expense',page:'outgoings',accountId:o.defaultPaymentAccountId||'',certainty:o.dueDay?'Scheduled':'Assumed month start'});}});
  // Card-linked installments are already included in the card planner.
  (installments||[]).filter(p=>!p.cardId&&!p.completedConfirmed&&p.status!=='completed').forEach(p=>{let remaining=Number(p.remainingPrincipal??p.remainingAmount??0);for(const month of months){if(p.startMonth&&month<p.startMonth)continue;const c=planCalc(p),amount=Math.min(remaining,Math.max(0,Number(c.monthly||0)));push({id:'installment:'+p.id+':'+month,date:monthDate(month,p.dueDay||1),amount,label:p.description||p.merchant||'Installment',kind:'Standalone installment',page:'installments',accountId:'',certainty:'Scheduled'});remaining-=amount;}});
  if(options.includeIncome&&Number(options.incomeDay)>0){for(const p of incomePlan.monthlyPlans||[]){if(!months.includes(p.month))continue;const date=monthDate(p.month,options.incomeDay);if(date<=start)continue;push({id:'income:'+p.month,date,amount:monthlyPlanTotal(p),label:'Saved income plan',kind:'Planned income',page:'incomeplan',accountId:'',certainty:'Unconfirmed',incoming:true});}}
  events.sort((a,b)=>a.effectiveDate.localeCompare(b.effectiveDate)||Number(!!a.incoming)-Number(!!b.incoming)||a.id.localeCompare(b.id));
  let balance=cash,lowest=cash,shortfallDate=cash<0?start:null;const points=[{date:start,balance:cash}];
  for(const e of events){balance+=(e.incoming?1:-1)*e.amount;e.balance=balance;lowest=Math.min(lowest,balance);if(balance<0&&!shortfallDate)shortfallDate=e.effectiveDate;points.push({date:e.effectiveDate,balance});}points.push({date:end,balance});
  return {start,end,cash,balance,lowest,shortfallDate,events,points,required:events.filter(e=>!e.incoming).reduce((s,e)=>s+e.amount,0),plannedIncome:events.filter(e=>e.incoming).reduce((s,e)=>s+e.amount,0)};
 }
 window.financePlanning={buildForecast,today,monthDate,state};
 function controls(prefix){return '<div class="planningControls"><div class="planningPresets">'+[['Today',0],['30 days',30],['90 days',90]].map(([name,n])=>'<button class="btn" type="button" data-plan-days="'+n+'">'+name+'</button>').join('')+'</div><label>Plan to<input class="control" type="date" id="'+prefix+'TargetDate" min="'+today()+'" max="'+addDays(today(),730)+'" value="'+state.date+'"></label><label class="planningIncomeToggle"><input type="checkbox" id="'+prefix+'IncludeIncome"'+(state.includeIncome?' checked':'')+'> Include saved planned income</label><label>Expected income day<input class="control" id="'+prefix+'IncomeDay" type="number" min="1" max="31" placeholder="1–31" value="'+state.incomeDay+'"></label></div>';}
 function chart(f){const width=800,height=220,left=85,right=18,top=18,bottom=40;const lo=Math.min(0,...f.points.map(p=>p.balance)),hi=Math.max(1,...f.points.map(p=>p.balance)),span=Math.max(1,Date.parse(f.end)-Date.parse(f.start)),x=d=>left+(Date.parse(d)-Date.parse(f.start))/span*(width-left-right),y=v=>top+(hi-v)/(hi-lo||1)*(height-top-bottom);const pts=f.points.map(p=>x(p.date)+','+y(p.balance)).join(' ');return '<svg class="planningChart" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="Projected available cash from '+f.start+' to '+f.end+'"><line x1="'+left+'" y1="'+y(0)+'" x2="'+(width-right)+'" y2="'+y(0)+'" stroke="#487087"/><text x="5" y="'+(top+12)+'">'+esc(money(hi))+'</text><text x="5" y="'+(height-bottom)+'">'+esc(money(lo))+'</text><polyline points="'+pts+'" fill="none" stroke="#20c9c3" stroke-width="3" stroke-dasharray="6 4"/>'+f.points.map(p=>'<circle cx="'+x(p.date)+'" cy="'+y(p.balance)+'" r="5" fill="'+(p.balance<0?'#ff617d':'#20c9c3')+'"><title>'+p.date+' · '+esc(money(p.balance))+' projected cash</title></circle>').join('')+'<text x="'+left+'" y="210">'+f.start+'</text><text x="'+(width-right)+'" y="210" text-anchor="end">'+f.end+'</text></svg>';}
 function metrics(f,strategy){const rows=strategy?[['Lowest projected cash',f.lowest,f.shortfallDate?'Cash gap begins '+f.shortfallDate:'Within the recorded plan'],['Upcoming payments',f.required,'Unpaid amounts through '+f.end],['Cash at target date',f.balance,'Forecast, not a confirmed bank balance']]:[['Current available cash',f.cash,'Tracked bank balances today'],['Upcoming payments',f.required,'Unpaid amounts through '+f.end],['Cash at target date',f.balance,'Forecast with market prices held constant'],['Planned income included',f.plannedIncome,'Unconfirmed • only saved months with a receipt day']];return rows.map(([label,value,note])=>'<div class="modernMetric"><small>'+label+'</small><b class="'+(value<0?'red':'green')+'">'+money(value)+'</b><em>'+esc(note)+'</em></div>').join('');}
 function rows(f,funding){return f.events.length?'<div class="planningTableScroll"><table class="strategyTable"><thead><tr><th>Payment / income</th><th>Due date</th><th>Status</th>'+(funding?'<th>Funding account · preview</th>':'')+'<th>Amount</th><th></th></tr></thead><tbody>'+f.events.map(e=>'<tr><td><b>'+esc(e.label)+'</b><div class="meta">'+e.kind+'</div></td><td>'+e.date+(e.overdue?'<div class="red">Overdue · reserved today</div>':'')+'</td><td>'+e.certainty+'</td>'+(funding?'<td>'+(e.incoming?'Planned receipt':'<select class="control" aria-label="Funding account for '+esc(e.label)+'"><option value="">Choose account</option>'+accounts.filter(a=>a.type==='bank').map(a=>'<option value="'+esc(a.id)+'"'+(a.id===e.accountId?' selected':'')+'>'+esc(accountName(a.id))+'</option>').join('')+'</select>')+'</td>':'')+'<td class="'+(e.incoming?'green':'')+'">'+(e.incoming?'+':'−')+money(e.amount)+'</td><td><button class="btn small" type="button" data-page-jump="'+e.page+'">Manage</button></td></tr>').join('')+'</tbody></table></div>':'<div class="planningEmpty">No unpaid payments recorded for this period. Add income and commitments in your Payment Plan.</div>';}
 function calendar(f){const month=f.end.slice(0,7),[yr,mo]=month.split('-').map(Number),count=new Date(Date.UTC(yr,mo,0)).getUTCDate(),offset=new Date(Date.UTC(yr,mo-1,1)).getUTCDay();return '<div class="planningCalendarTitle">'+new Date(month+'-01T12:00:00Z').toLocaleDateString('en-GB',{month:'long',year:'numeric'})+' <span class="meta">Selected target month</span></div><div class="planningCalendar">'+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>'<div class="calendarWeekday">'+d+'</div>').join('')+Array.from({length:offset},()=>'<div class="calendarBlank"></div>').join('')+Array.from({length:count},(_,i)=>{const date=monthDate(month,i+1),events=f.events.filter(e=>e.date===date);return '<div class="calendarDay'+(date===today()?' calendarToday':'')+'"><b>'+String(i+1)+'</b>'+events.slice(0,3).map(e=>'<div class="calendarEvent '+(e.incoming?'income':'payment')+'" title="'+esc(e.label)+' · '+esc(money(e.amount))+'">'+esc(e.label)+'</div>').join('')+(events.length>3?'<small>+'+(events.length-3)+' more</small>':'')+'</div>';}).join('')+'</div>';}
 function wire(root,prefix,render){root.querySelectorAll('[data-plan-days]').forEach(b=>b.onclick=()=>{state.date=addDays(today(),Number(b.dataset.planDays));render();});el(prefix+'TargetDate').onchange=e=>{const value=e.target.value;if(value>=today()&&value<=addDays(today(),730)){state.date=value;render();}};el(prefix+'IncludeIncome').onchange=e=>{state.includeIncome=e.target.checked;render();};el(prefix+'IncomeDay').onchange=e=>{state.incomeDay=Math.max(0,Math.min(31,Number(e.target.value)||0))||'';render();};root.querySelectorAll('[data-page-jump]').forEach(b=>b.onclick=()=>nav(b.dataset.pageJump));}
 const oldPosition=renderFinancialPosition;
 renderFinancialPosition=function(){oldPosition();const root=el('financialposition');if(!root)return;let plan=el('positionOutlook');if(!plan){plan=document.createElement('div');plan.id='positionOutlook';plan.className='planningWorkspace';root.querySelector('.modernHero').after(plan);const title=root.querySelector('.modernHero p');if(title)title.textContent='Know your position today and preview cash available on a future date.';}const f=buildForecast(state.date,state);plan.innerHTML=controls('position')+'<div class="modernKpis planningKpis">'+metrics(f,false)+'</div><div class="planningGrid"><div class="panel"><div class="panelTitle">Available Cash Outlook</div><p class="meta">Dashed line: forecast from recorded commitments. Hover a point for its date and projected balance.</p>'+chart(f)+'</div><div class="panel"><div class="panelTitle">Before '+f.end+'</div><div class="planningNotice '+(f.shortfallDate?'warning':'')+'">'+(f.shortfallDate?'Projected cash gap on '+f.shortfallDate+'. Review funding before this date.':'No cash gap in the recorded plan.')+'</div><p class="meta">Future spending, interest and market movements are excluded. Expenses without a due day are assumed at month start. Unsaved future income months are excluded.</p><button class="btn primary" data-page-jump="strategy">Review payment strategy</button></div></div><div class="panel"><div class="panelTitle">Upcoming Commitments & Planned Income</div>'+rows(f,false)+'</div>';wire(plan,'position',renderFinancialPosition);const k=el('fpKpis');if(k)k.dataset.currentPosition='true';const summary=el('fpSummary');if(summary&&!el('fpCurrentNote'))summary.insertAdjacentHTML('beforebegin','<p class="meta" id="fpCurrentNote">Assets, liabilities and net position below are current recorded values. Card-linked installments are included in credit-card liabilities.</p>');};
 const oldStrategy=renderFinancialStrategy;
 renderFinancialStrategy=function(){oldStrategy();const root=document.querySelector('#strategy .strategyMain');if(!root)return;let plan=el('strategyPlanner');if(!plan){plan=document.createElement('div');plan.id='strategyPlanner';plan.className='planningWorkspace';root.querySelector('.strategyPageHero').after(plan);root.querySelector('.strategyPageHero p').textContent='Plan upcoming payments and choose funding before their due dates.';const legacy=document.createElement('details');legacy.className='planningLegacy';legacy.innerHTML='<summary>Monthly budget, spending coach & debt scenarios</summary>';const original=[...root.children].filter(n=>n!==plan&&!n.classList.contains('strategyPageHero'));original.forEach(n=>legacy.append(n));root.append(legacy);}const f=buildForecast(state.date,state);plan.innerHTML=controls('strategy')+'<div class="modernKpis planningKpis">'+metrics(f,true)+'</div><div class="planningGrid"><div class="panel"><div class="panelTitle">Payment Calendar</div>'+calendar(f)+'</div><div class="panel"><div class="panelTitle">Actions Before Due Dates</div><div class="planningAction"><b>1 · Protect required payments</b><span>Reserve '+money(f.required)+' through '+f.end+'.</span></div><div class="planningAction"><b>2 · Review your lowest cash point</b><span>'+money(f.lowest)+(f.shortfallDate?' · cash gap starts '+f.shortfallDate:' · based on recorded commitments')+'</span></div><div class="planningAction"><b>3 · Choose a funding account</b><span>Use the preview below, then Manage to save the payment account or confirm payment.</span></div><button class="btn" data-page-jump="incomeplan">Open Payment Plan</button><p class="meta">Planning only. Preview account choices do not move money or mark payments paid. Confirmed and early payments are excluded from remaining obligations.</p></div></div><div class="panel"><div class="panelTitle">Funding Plan</div>'+rows(f,true)+'</div><div class="panel"><div class="panelTitle">Projected Cash Through '+f.end+'</div>'+chart(f)+'<p class="meta">Unconfirmed income is included only when enabled with an expected receipt day. No future market growth or spending is assumed.</p></div>';wire(plan,'strategy',renderFinancialStrategy);};
})();

/* BDO CSV: explicit debit/credit direction and native PHP retained with confirmed SAR conversion. */
(function(){
 const bdoMap={headerRow:1,dataStartRow:2,date:'H',description:'O',amount:'F',direction:'G',currency:'E',reference:'K',counterparty:'D',sourceCurrency:'PHP'};
 window.financeBDOMapping=bdoMap;
 function column(letter){return String(letter||'').toUpperCase().split('').reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1;}
 function mappedCsvRows(text,map,accountId,statementMonth,rate){
  if(!accountId||account(accountId)?.type!=='bank')throw Error('Select your bank account before importing this statement.');
  const raw=parseCsvRows(text),headers=Object.keys(raw[0]||{}),get=(r,c)=>c?r[headers[column(c)]]:'',rows=[];
  for(const r of raw.slice(Math.max(0,Number(map.dataStartRow||2)-2))){
   const ds=String(get(r,map.date)||'').trim();let date=parseImportDate(ds);
   if(!date){const m=ds.match(/^([A-Za-z]{3})\s+(\d{1,2}),\s*(\d{4})$/),months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];if(m&&months.includes(m[1]))date=m[3]+'-'+String(months.indexOf(m[1])+1).padStart(2,'0')+'-'+m[2].padStart(2,'0');}
   const currency=String(get(r,map.currency)||map.sourceCurrency||financeBaseCurrency()).trim().toUpperCase();
   const direction=String(get(r,map.direction)||'').trim().toLowerCase();
   let amount=Number(String(get(r,map.amount)||0).replace(/[,\s]/g,''));
   if(map.debit||map.credit){const debit=Number(get(r,map.debit)||0),credit=Number(get(r,map.credit)||0);amount=credit>0?credit:-Math.abs(debit);}
   if(map.direction){if(!['credit','debit','cr','dr'].includes(direction))throw Error('Unknown credit/debit indicator. Review the CSV before importing.');amount=(['debit','dr'].includes(direction)?-1:1)*Math.abs(amount);}
   const description=cleanImportText(get(r,map.description)),counterparty=cleanImportText(get(r,map.counterparty));
   if(!date||!description||!Number.isFinite(amount)||!amount)throw Error('A CSV row has an invalid date, description or amount. Nothing was imported.');
   if(!FINANCE_CURRENCIES.includes(currency))throw Error('Unsupported statement currency.');
   if(currency!==financeBaseCurrency()&&document.getElementById('importSourceCurrency')?.value&&document.getElementById('importSourceCurrency').value!==currency)throw Error('Select '+currency+' as the statement currency before using its conversion rate.');
   if(currency!==financeBaseCurrency()&&!(Number.isFinite(rate)&&rate>0))throw Error('This statement is in '+currency+'. Enter the '+financeBaseCurrency()+' value of 1 '+currency+' before previewing.');const fx=currency===financeBaseCurrency()?1:rate;
   const guessed=guessImportedCategory(description+' '+counterparty),transfer=/^(sent to|received from)\b/i.test(counterparty)||/\b(DBFT|FT SA-SA|IBFT|fund transfer)\b/i.test(description),kind=transfer?'transfer':amount>0?'income':guessed[2];
   const transaction={account:accountId,date,posting:date,description,amount:financeRoundMoney(amount*fx),category:transfer?'Financial Obligations':amount>0?'Miscellaneous':guessed[0],subcategory:transfer?'Savings / Investments':amount>0?'Unexpected Expenses':guessed[1],kind,needsReview:amount>0&&!transfer||guessed[3]||transfer,categoryReviewed:false,currency:financeBaseCurrency(),original:{currency,amount,exchangeRate:fx,exchangeRateTo:financeBaseCurrency(),rateSource:document.getElementById('importFxStatus')?.dataset.source||'User-confirmed statement conversion',rateDate:document.getElementById('importFxStatus')?.dataset.date||''},reference:cleanImportText(get(r,map.reference)),counterparty,manual:false,imported:true,source:'BDO CSV Statement',physicalCardEnding:'',physicalCardDetected:false,statementMonth:statementMonth||statementMonthByRule(date,statementRule.cutoffDay)};
   rows.push(transaction);
  }return rows;
 }
 window.financeMappedCsvRows=mappedCsvRows;
 const originalParse=parseStatementFile;
 parseStatementFile=async function(file,accountId,statementMonth){
  const csv=file.name.toLowerCase().endsWith('.csv');let text,map,isBDO=false;
  if(csv){text=await file.text();const raw=parseCsvRows(text),headers=Object.keys(raw[0]||{}),selected=document.getElementById('importFormatSelect')?.value,format=allStatementFormats().find(f=>f.id===selected);isBDO=headers.includes('Credit/debit indicator')&&headers.includes('Book date')&&headers.includes('Account number(BBAN)');map=format?.mappingConfig||(isBDO?bdoMap:null);}
  const input=document.getElementById('importPhpRate'),sourceEl=document.getElementById('importSourceCurrency');
  if(isBDO&&sourceEl)sourceEl.value='PHP';
  const rate=Number(input?.value||0);
  if(map){if(Number(map.headerRow||1)!==1)throw Error('CSV mappings require the first row to contain column headers.');return mappedCsvRows(text,map,accountId,statementMonth,rate);}
  const source=csv?(sourceEl?.value||financeBaseCurrency()):'SAR',target=financeBaseCurrency();
  if(source!==target&&!(rate>0))throw Error('This statement is in '+source+'. Enter the '+target+' value of 1 '+source+' before previewing.');
  if(source!==target&&sourceEl&&sourceEl.value!==source)throw Error('Select '+source+' as the statement currency, then fetch or enter its conversion rate.');
  const rows=await originalParse(csv?{name:file.name,text:async()=>text}:file,accountId,statementMonth);
  return rows.map(t=>source===target?{...t,currency:target}:{...t,amount:financeRoundMoney(Number(t.amount)*rate),currency:target,original:{currency:source,amount:t.amount,exchangeRate:rate,exchangeRateTo:target,sourceOriginal:t.original||null,rateSource:document.getElementById('importFxStatus')?.dataset.source||'User-confirmed statement conversion',rateDate:document.getElementById('importFxStatus')?.dataset.date||''}});
 };

 function importControls(){
  const field=document.getElementById('importAccount')?.closest('.formGrid');if(!field)return;
  let controls=document.getElementById('importTemplateControls');if(!controls){controls=document.createElement('div');controls.id='importTemplateControls';controls.className='field full';controls.innerHTML='<label>Statement template<select class="control" id="importFormatSelect"><option value="">Auto-detect format</option></select></label><div class="formGrid"><label>Statement currency<select id="importSourceCurrency" class="control">'+financeCurrencyOptions(financeBaseCurrency())+'</select></label><label>1 statement currency = '+financeBaseCurrency()+'<input class="control" id="importPhpRate" type="number" min="0.000001" step="any" placeholder="Rate used for this statement"></label></div><button class="btn small" type="button" id="importFetchRate">Get online reference rate</button><div id="importFxStatus" class="meta" role="status"></div><div class="hint">Same-currency imports use 1. BDO CSV currency is detected from the file. Saudi bank PDF formats use SAR. Review the dated online reference or enter the actual historical bank rate; original values are retained.</div>';field.insertBefore(controls,document.getElementById('importStatementMonth').closest('.field').nextSibling);
   const source=document.getElementById('importSourceCurrency'),input=document.getElementById('importPhpRate'),status=document.getElementById('importFxStatus'),button=document.getElementById('importFetchRate');
   input.addEventListener('input',()=>{input.dataset.manual='1';status.dataset.source='User-confirmed statement conversion';status.dataset.date='';status.textContent='Custom rate • 1 '+source.value+' = '+input.value+' '+financeBaseCurrency();});
   source.addEventListener('change',()=>{input.value=source.value===financeBaseCurrency()?1:'';input.dataset.manual='';status.dataset.date='';status.dataset.source='';status.textContent='';});
   button.addEventListener('click',async()=>{const from=source.value;input.dataset.manual='';button.disabled=true;status.textContent='Fetching '+from+' → '+financeBaseCurrency()+'…';try{const d=await financeFetchRate(from);if(source.value!==from||input.dataset.manual)return;input.value=d.rate;status.dataset.date=d.date||'';status.dataset.source=d.source;status.textContent=d.source+' · '+d.date+' · 1 '+from+' = '+d.rate+' '+financeBaseCurrency()+'. Review before import.';if(d.attribution){const a=document.createElement('a');a.href='https://www.exchangerate-api.com';a.target='_blank';a.rel='noopener';a.textContent=' ExchangeRate-API';status.append(a);}}catch(_){if(source.value===from&&!input.dataset.manual)status.textContent='Online rate unavailable. Enter the actual statement rate.';}finally{button.disabled=false;}});
  }
  const select=document.getElementById('importFormatSelect'),value=select.value;select.innerHTML='<option value="">Auto-detect format</option>'+allStatementFormats().filter(f=>f.active!==false&&(f.parser==='snb-current-pdf'||f.mappingConfig&&String(f.fileType).includes('CSV'))).map(f=>'<option value="'+escapeHtml(f.id)+'">'+escapeHtml(f.name)+(statementTemplateIsNew(f)?' • New':'')+'</option>').join('');select.value=value;
 }

 const oldPage=renderImportPage;renderImportPage=function(){oldPage();importControls();};
 const oldFormats=renderStatementFormatsV268;renderStatementFormatsV268=function(){oldFormats();importControls();};renderStatementFormats=renderStatementFormatsV268;
 const oldPreview=renderImportPreview;renderImportPreview=function(){oldPreview();document.querySelectorAll('#importPreviewBody tr').forEach((tr,i)=>{const t=importPreviewRows[i];if(t?.original?.currency&&tr.cells[4]){const label=document.createElement('div');label.className='meta';label.textContent=t.original.currency+' '+Number(t.original.amount).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+' × '+t.original.exchangeRate;tr.cells[4].append(label);}});};
})();
(function(){
 const previous=isStatementDuplicate;
 isStatementDuplicate=function(candidate,existing){
  if(candidate?.source==='BDO CSV Statement'&&existing?.source==='BDO CSV Statement'){
   if(candidate.account!==existing.account)return false;
   if(candidate.reference&&existing.reference)return candidate.reference===existing.reference&&candidate.date===existing.date&&candidate.original?.currency===existing.original?.currency&&Math.abs(Number(candidate.original?.amount??candidate.amount)-Number(existing.original?.amount??existing.amount))<.005;
   return candidate.date===existing.date&&cleanImportText(candidate.description).toLowerCase()===cleanImportText(existing.description).toLowerCase()&&candidate.original?.currency===existing.original?.currency&&Math.abs(Number(candidate.original?.amount??candidate.amount)-Number(existing.original?.amount??existing.amount))<.005;
  }
  return previous(candidate,existing);
 };
})();

/* User profile appearance: initials by default; photo is user metadata, not workspace data. */
(function(){
 window.financeApplyAvatar=function(){
  const p=window.financeUserProfile||JSON.parse(localStorage.getItem('pf_profile_v283')||'{}'),initials=(p.initials||'MF').toUpperCase().slice(0,3),draft=window.financeAvatarDraft;
  const mode=document.getElementById('accountAvatarMode');if(mode&&!draft)mode.value=p.avatarMode||'initials';
  const selected=mode?.value||p.avatarMode||'initials',photo=draft||p.photo,valid=selected==='picture'&&typeof photo==='string'&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photo)&&photo.length<60000;
  document.querySelectorAll('.canonicalAvatar,.execAvatar,.cashAvatar,.txExecAvatar,.strategyAvatar,#accountAvatarPreview').forEach(e=>{e.classList.toggle('financePhotoAvatar',!!valid);if(valid)e.style.setProperty('background-image','url("'+photo+'")','important');else e.style.removeProperty('background-image');e.setAttribute('aria-label',valid?'Profile picture':initials+' profile');const text=e.querySelector('span:first-child')||e;text.textContent=valid?'':initials;});
  const upload=document.getElementById('accountAvatarUploadField');if(upload)upload.hidden=selected!=='picture';
 };
 const mode=document.getElementById('accountAvatarMode'),file=document.getElementById('accountAvatarUpload'),status=document.getElementById('accountProfileStatus');
 mode?.addEventListener('change',()=>{const p=window.financeUserProfile||{};const chosen=mode.value;window.financeAvatarDraft=chosen==='picture'?(p.photo||''):null;document.getElementById('accountAvatarUploadField').hidden=chosen!=='picture';document.querySelectorAll('.financePhotoAvatar').forEach(e=>{if(chosen==='initials'){e.classList.remove('financePhotoAvatar');e.style.removeProperty('background-image');const text=e.querySelector('span:first-child')||e;text.textContent=document.getElementById('accountInitials').value||p.initials||'MF';}});});
 file?.addEventListener('change',async()=>{const selected=file.files[0];if(!selected)return;if(!['image/jpeg','image/png','image/webp'].includes(selected.type)||selected.size>2*1024*1024){status.textContent='Choose a JPEG, PNG or WebP picture up to 2 MB.';file.value='';return;}
  try{const url=URL.createObjectURL(selected),img=new Image();try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d'),size=Math.min(img.naturalWidth,img.naturalHeight);ctx.drawImage(img,(img.naturalWidth-size)/2,(img.naturalHeight-size)/2,size,size,0,0,128,128);window.financeAvatarDraft=canvas.toDataURL('image/jpeg',.82);mode.value='picture';window.financeApplyAvatar();status.textContent='Picture ready. Save Profile to apply it across your workspaces.';}finally{URL.revokeObjectURL(url);}}catch(_){status.textContent='Could not read this picture. Choose another image.';}
 });
 window.financeApplyAvatar();
 // Native stock prices stay in USD/SAR; base-denominated totals refresh after dated FX.
 if(financeBaseCurrency()!=='SAR'){const refreshFx=()=>Promise.allSettled(['SAR','USD'].map(c=>financeFetchRate(c))).then(()=>{renderInvestments();renderFinancialPosition();renderDashboard();});refreshFx();setInterval(()=>{if(document.visibilityState==='visible')refreshFx();},1800000);}
})();

/* Dedicated update-only statement card review. New imports use the import page. */
(function(){
 const el=id=>document.getElementById(id),esc=escapeHtml;
 let review=null,entries=[],selected=new Set(),targets=new Map(),busy=false;
 function matches(entry){
  const row={...entry.row,physicalCardDetected:true,physicalCardEnding:String(entry.row.physicalCardEnding||account(entry.row.account)?.ending||'').slice(-4)};
  return importedTransactions.filter(old=>statementCardMatch(row,old));
 }
 window.financeStatementHasCardMatches=data=>!!data?.duplicates?.some(entry=>!entry.cardReviewUpdated&&matches(entry).length);
 function canEdit(){return (!window.financePagePermissions||window.financePagePermissions.importstatements==='edit')&&(!window.financeSectionPermission||['imported_transactions','tx_overrides'].every(section=>window.financeSectionPermission(section)==='edit'));}
 function current(){return entries.filter(entry=>entry.row.account===el('statementCardAccount').value&&!entry.cardReviewUpdated);}
 function cardFor(entry){return el('statementCardEnding').value|| (entry.row.physicalCardDetected===true?String(entry.row.physicalCardEnding||''):'');}
 function updateCounts(){
  const list=current(),chosen=list.filter(entry=>selected.has(entry.index));
  el('statementCardSummary').textContent=list.length+' matching transaction(s) · '+chosen.length+' selected · '+(review?.fresh?.length||0)+' new rows stay on Import Statements';
  el('statementCardApply').disabled=busy||!canEdit()||!chosen.length||chosen.some(entry=>!/^\d{4}$/.test(cardFor(entry)));
  el('statementCardSelectAll').disabled=!list.some(entry=>targets.get(entry.index));
 }
 function renderRows(){
  const list=current();
  el('statementCardRows').innerHTML=list.map(entry=>{
   const id=targets.get(entry.index),old=entry.candidates.find(t=>t._id===id),card=old?(txOverrides[old._id]?.physicalCardEnding||old.physicalCardEnding||''):'',manual=old&&txOverrides[old._id]?.physicalCardEnding;
   return '<tr class="'+(selected.has(entry.index)?'isSelected':'')+'"><td><input type="checkbox" aria-label="Select '+esc(entry.row.description)+'" data-card-review-select="'+entry.index+'" '+(selected.has(entry.index)?'checked ':'')+(!id?'disabled':'')+'></td><td>'+esc(entry.row.date)+'</td><td>'+esc(entry.row.description)+'</td><td>'+signed(entry.row.amount)+'</td><td>'+esc(card?physicalCardLabelFor(entry.row.account,card):'Choose existing match')+(manual?'<small>Manually edited card. Applying updates replaces this card assignment.</small>':'')+'</td><td>'+esc(/^\d{4}$/.test(cardFor(entry))?physicalCardLabelFor(entry.row.account,cardFor(entry)):'Card not identified — choose a bulk correction')+'</td><td>'+(entry.candidates.length===1?esc(entry.candidates[0].date+' · '+entry.candidates[0].description)+'<small>Existing record; no new transaction</small>':'<select aria-label="Choose existing transaction" data-card-review-target="'+entry.index+'"><option value="">Choose existing match</option>'+entry.candidates.map(t=>'<option value="'+esc(t._id)+'" '+(id===t._id?'selected':'')+'>'+esc(t.date+' · '+t.description+' · '+physicalCardLabelFor(t.account,txOverrides[t._id]?.physicalCardEnding||t.physicalCardEnding)+' · ID '+t._id)+'</option>').join('')+'</select><small>Possible matches: verify date, amount and merchant.</small>')+'</td></tr>';
  }).join('')||'<tr><td colspan="7">No matching card transactions waiting for updates. New rows are on Import Statements.</td></tr>';
  el('statementCardRows').querySelectorAll('[data-card-review-select]').forEach(box=>box.onchange=()=>{const index=Number(box.dataset.cardReviewSelect);if(box.checked)selected.add(index);else selected.delete(index);box.closest('tr').classList.toggle('isSelected',box.checked);updateCounts();});
  el('statementCardRows').querySelectorAll('[data-card-review-target]').forEach(select=>select.onchange=()=>{const index=Number(select.dataset.cardReviewTarget);targets.set(index,select.value);if(select.value&&/^\d{4}$/.test(cardFor(entries.find(e=>e.index===index))))selected.add(index);else selected.delete(index);renderRows();});
  updateCounts();
 }
 function renderAccount(){
  const id=el('statementCardAccount').value,list=current(),cards=[...new Set([...accountPhysicalCards(id),...list.map(entry=>entry.row.physicalCardEnding).filter(x=>/^\d{4}$/.test(String(x)))])];
  el('statementCardEnding').innerHTML='<option value="">Use cards detected in statement</option>'+cards.map(ending=>'<option value="'+esc(ending)+'">'+esc(physicalCardLabelFor(id,ending))+'</option>').join('');
  selected.clear();const used=new Set();list.forEach(entry=>{const target=targets.get(entry.index);if(target&&!used.has(target)&&/^\d{4}$/.test(cardFor(entry))){selected.add(entry.index);used.add(target);}});renderRows();
 }
 window.openStatementCardReview=function(){
  review=importDuplicateDecision;entries=[];selected.clear();targets.clear();
  (review?.duplicates||[]).forEach((entry,index)=>{if(entry.cardReviewUpdated)return;const candidates=matches(entry);if(!candidates.length)return;const snapshots=Object.fromEntries(candidates.map(old=>[old._id,entry.cardSnapshots?.[old._id]||statementCardSnapshot(old)]));entries.push({...entry,index,candidates,snapshots,original:entry});if(candidates.length===1)targets.set(index,candidates[0]._id);});
  const ids=[...new Set([...entries.map(entry=>entry.row.account),...(window.financeStatementComparison?.rows||[]).map(row=>row.account)])];
  el('statementCardAccount').innerHTML=ids.map(id=>'<option value="'+esc(id)+'">'+esc(accountName(id))+'</option>').join('');
  el('statementCardStatus').textContent='Detected cards are prefilled and clear matches are selected. Review and click Apply Updates. Ambiguous matches require confirmation; use the bulk correction only if needed. A file with only an account-level card header cannot distinguish supplementary purchases.';
  closeModal('importDuplicateReviewModal');nav('statementCardReview');renderAccount();window.financeRenderStatementComparison?.();
 };
 el('openStatementCardReview').onclick=window.openStatementCardReview;
 el('statementCardAccount').onchange=renderAccount;
 el('statementCardEnding').onchange=()=>{renderRows();el('statementCardStatus').textContent='Selected transactions will be assigned to '+el('statementCardEnding').selectedOptions[0].textContent+'. Other edits are preserved.';};
 el('statementCardSelectAll').onclick=()=>{current().forEach(entry=>{if(targets.get(entry.index))selected.add(entry.index);});renderRows();};
 el('statementCardClear').onclick=()=>{selected.clear();renderRows();};
 el('statementCardBack').onclick=()=>{if(review){review.decided=true;review.skipped=review.duplicates.filter(entry=>!entry.cardReviewUpdated&&!entry.row.importAnyway).length;}nav('importstatements');};
 el('statementCardApply').onclick=()=>{
  if(busy)return;
  const status=el('statementCardStatus'),ending=el('statementCardEnding').value,list=current().filter(entry=>selected.has(entry.index));
  try{
   if(!canEdit())throw Error('Edit permission is required to update card assignments.');
   if(review!==importDuplicateDecision||!list.length||list.some(entry=>!/^\d{4}$/.test(cardFor(entry))))throw Error('Choose the card and select the transactions to update.');
   const updates=list.map(entry=>({id:targets.get(entry.index),row:{...entry.row,physicalCardEnding:cardFor(entry),physicalCardDetected:true},snapshot:entry.snapshots[targets.get(entry.index)]}));
   validateStatementCardUpdates(updates);busy=true;updateCounts();
   const stamp=Date.now(),saved=applyStatementCardUpdates(updates,stamp),history={batchId:'card-review-'+stamp,fileName:importPreviewFileName,accountId:el('statementCardAccount').value,count:0,totalAmount:0,updatedCardCount:saved.length,updatedTransactionIds:saved.map(t=>t._id),importedAt:new Date(stamp).toISOString(),cardReviewOnly:true};
   importHistory.push(history);list.forEach(entry=>{entry.original.cardReviewUpdated=true;entry.cardReviewUpdated=true;});review.decided=true;review.cardUpdates=[];review.skipped=review.duplicates.filter(entry=>!entry.cardReviewUpdated&&!entry.row.importAnyway).length;
   rebuildTransactions();saveLocal();recordImmediateUpsert('import_history',syncStableId('import_history',history,importHistory.length-1),history,'statement-card-review');
   renderTransactions();renderAccounts();renderDashboard();renderReports();renderImportHistory();renderImportPreview();window.financeRenderStatementComparison?.();
   selected.clear();renderRows();status.textContent='Updated '+saved.length+' existing transaction(s) using the reviewed card assignments. No transactions added; amounts and balances unchanged. You can update another group or return to import the new rows.';
  }catch(error){status.textContent=error.message;}finally{busy=false;updateCounts();}
 };
})();

/* Read-only, one-to-one comparison of the complete upload against a statement tag. */
(function(){
 const el=id=>document.getElementById(id),esc=escapeHtml;
 window.financeCompareStatement=function(uploaded,existing){
  const remaining=new Set(existing.map((_,i)=>i)),pairs=[],missing=[];
  const sameCurrency=(a,b)=>String(a.currency||financeBaseCurrency())===String(b.currency||financeBaseCurrency());
  const text=v=>String(v||'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  const identity=(a,b)=>{const ar=String(a.reference||'').trim(),br=String(b.reference||'').trim();return sameCurrency(a,b)&&importDateDays(a.date,b.date)<=3&&(ar&&br?ar===br:!!text(a.description)&&text(a.description)===text(b.description));};
  // Reserve equal-amount matches before considering possible amount discrepancies.
  uploaded.forEach(row=>{const candidates=[...remaining].filter(i=>identity(row,existing[i])&&financeRoundMoney(Number(row.amount))===financeRoundMoney(Number(existing[i].amount)));candidates.sort((a,b)=>importDateDays(row.date,existing[a].date)-importDateDays(row.date,existing[b].date));if(candidates.length){const i=candidates[0];remaining.delete(i);pairs.push({row,old:existing[i],type:'Matched',delta:0});}else missing.push(row);});
  const unmatched=[];
  missing.forEach(row=>{const candidates=[...remaining].filter(i=>identity(row,existing[i]));if(candidates.length===1&&missing.filter(other=>identity(other,existing[candidates[0]])).length===1){const i=candidates[0];remaining.delete(i);pairs.push({row,old:existing[i],type:row.statementBillingAmount===0&&row.comparisonUsesBilling?'Not billed in uploaded statement':'Possible amount difference',delta:financeRoundMoney(Number(row.amount)-Number(existing[i].amount))});}else unmatched.push({row,type:'Only in uploaded statement',delta:financeRoundMoney(Number(row.amount))});});
  const extras=[...remaining].map(i=>{const old=existing[i],possibleDuplicate=pairs.some(p=>identity(p.row,old)&&financeRoundMoney(Number(p.row.amount))===financeRoundMoney(Number(old.amount)));return {old,type:possibleDuplicate?'Only in system — possible duplicate':'Only in system',delta:financeRoundMoney(-Number(old.amount))};});
  const totals=rows=>({count:rows.length,charges:financeRoundMoney(rows.reduce((s,r)=>s+Math.max(0,-Number(r.amount)),0)),credits:financeRoundMoney(rows.reduce((s,r)=>s+Math.max(0,Number(r.amount)),0)),net:financeRoundMoney(-rows.reduce((s,r)=>s+Number(r.amount),0))});
  const statement=totals(uploaded),system=totals(existing),difference=financeRoundMoney(system.net-statement.net),issues=[...extras,...unmatched,...pairs.filter(p=>p.type!=='Matched')];
  return {statement,system,difference,issues,matched:pairs.filter(p=>p.type==='Matched').length,explained:financeRoundMoney(issues.reduce((s,r)=>s+r.delta,0))};
 };
 window.financeSetStatementComparison=function(rows,fileName,month){
  window.financeStatementComparison={rows:rows.map(r=>({...r})),fileName,workspace:window.financeWorkspaceUserId,month:month||rows[0]?.statementMonth||''};
  const ids=[...new Set(rows.map(r=>r.account))];el('statementCompareAccount').innerHTML=ids.map(id=>'<option value="'+esc(id)+'">'+esc(accountName(id))+'</option>').join('');
  el('statementCompareMonth').value=window.financeStatementComparison.month;el('statementCompareBasis').value=rows.some(r=>r.statementBillingAmount!=null)?'billing':'transaction';
  window.financeRenderStatementComparison();
 };
 window.financeRenderStatementComparison=function(){
  const data=window.financeStatementComparison,panel=el('statementComparison');if(!panel)return;
  panel.hidden=!data||data.workspace!==window.financeWorkspaceUserId;if(panel.hidden)return;
  const id=el('statementCompareAccount').value,month=el('statementCompareMonth').value;
  if(!/^\d{4}-\d{2}$/.test(month)){el('statementCompareSummary').textContent='Choose the statement month to compare.';el('statementCompareTotals').innerHTML='';el('statementCompareRows').innerHTML='';return;}
  rebuildTransactions();
  const useBilling=el('statementCompareBasis').value==='billing';const uploaded=data.rows.filter(r=>r.account===id).map(r=>({...r,amount:useBilling&&r.statementBillingAmount!=null?r.statementBillingAmount:(r.statementTransactionAmount??r.amount),comparisonUsesBilling:useBilling&&r.statementBillingAmount!=null})),existing=normalizedTx().filter(r=>r.account===id&&r.statementMonth===month);
  const currency=financeBaseCurrency(),invalid=[...uploaded,...existing].some(r=>!Number.isFinite(Number(r.amount))||(r.currency&&r.currency!==currency));
  if(invalid){el('statementCompareSummary').textContent='Comparison paused: amounts must be valid and in the workspace currency.';el('statementCompareTotals').innerHTML='';el('statementCompareRows').innerHTML='';return;}
  const result=window.financeCompareStatement(uploaded,existing);
  const metrics=[['Uploaded statement',result.statement],['System · '+month,result.system]];
  el('statementCompareTotals').innerHTML=metrics.map(([label,t])=>'<div class="panel"><b>'+esc(label)+'</b><div>'+t.count+' transactions</div><div>Charges: '+money(t.charges)+'</div><div>Payments / credits: '+money(t.credits)+'</div><div><b>Net charges: '+money(t.net)+'</b></div></div>').join('')+'<div class="panel"><b>System minus statement</b><div class="statementDifference">'+signed(result.difference)+'</div><div>'+ (result.difference>0?'System is higher':result.difference<0?'System is lower':'Totals agree')+'</div><div>Explained by listed rows: '+signed(result.explained)+'</div></div>';
  el('statementCompareSummary').textContent=data.fileName+' · All uploaded rows for this account compared with Statement '+month+' tags, regardless of transaction date. '+(useBilling?'Bank billing amounts used where supplied; zero billing rows are not billed. ':'Transaction amounts used. ')+result.matched+' matched · '+result.issues.length+' differences. This compares transactions, not opening or closing bank balances.';
  el('statementCompareRows').innerHTML=result.issues.map(item=>{const row=item.row||item.old;return '<tr><td>'+esc(item.type)+'</td><td>'+esc(row.date)+'</td><td>'+esc(row.description)+'</td><td>'+ (item.row?signed(item.row.amount):'—')+'</td><td>'+(item.old?signed(item.old.amount):'—')+'</td><td>'+signed(item.delta)+'</td><td>'+esc(item.old?physicalCardLabelFor(id,item.old.physicalCardEnding||account(id)?.ending)+' · '+item.old._id:'Not matched to this statement tag')+'</td></tr>';}).join('')||'<tr><td colspan="7">No differences found. Uploaded transactions match this statement tag.</td></tr>';
 };
 el('statementCompareMonth').onchange=window.financeRenderStatementComparison;
 el('statementCompareAccount').onchange=window.financeRenderStatementComparison;el('statementCompareBasis').onchange=window.financeRenderStatementComparison;
 el('statementCompareRefresh').onclick=window.financeRenderStatementComparison;
})();

/* 3.98 / 4.13: share transaction normalization within one synchronous render
   or payment-normalization pass. Payment-field updates do not alter transaction
   sources; each pass clears its snapshot before the next edit or cloud update.
   No calculated data survives navigation, edits, cloud updates or the render. */
(function(){
 let renderData=null;
 for(const name of ['liveCardTransactions','normalizedTx','possibleDuplicateGroups']){
  const original=window[name];
  window[name]=function(includeInactive=false){
   if(!renderData)return original(includeInactive);
   const key=name+'|'+!!includeInactive;
   if(!renderData.has(key))renderData.set(key,original(includeInactive));
   // Each consumer keeps its own rows, as with the original normalization.
   return renderData.get(key).map(row=>({...row}));
  };
 }
 // Existing writes and rebuilds invalidate data even if invoked during a render.
 for(const name of ['saveLocal','rebuildTransactions']){
  const original=window[name];
  window[name]=function(...args){if(renderData)renderData.clear();return original.apply(this,args);};
 }
 for(const name of ['renderExecutiveDashboard','renderAccounts','renderReports','renderFinancialPosition','renderFinancialStrategy','renderTransactions','ensurePartialPaymentFields']){
  const original=window[name];
  window[name]=function(...args){
   if(renderData)return original.apply(this,args);
   renderData=new Map();
   const previousIndex=financeCycleTransactionIndex;
   try{
    if(name==='ensurePartialPaymentFields'){
     financeCycleTransactionIndex=new Map();
     for(const tx of liveCardTransactions()){
      const key=JSON.stringify([tx.account,assignedTransactionPaymentMonth(tx.account,tx)]);
      if(!financeCycleTransactionIndex.has(key))financeCycleTransactionIndex.set(key,[]);
      financeCycleTransactionIndex.get(key).push(tx);
     }
    }
    return original.apply(this,args);
   }finally{financeCycleTransactionIndex=previousIndex;renderData=null;}
  };
 }
})();
