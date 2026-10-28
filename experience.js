/* Personal appearance and public-code loading. No finance records are stored here. */
(function(){
 'use strict';
 const designs={classic:'Classic',midnight:'Midnight Premium',bright:'Clean & Bright'};
 const keyFor=id=>'finance_appearance_'+id;
 let owner='',prefs=null,pending=false,saving=false,saveTimer=0;
 const read=key=>{try{return JSON.parse(window.localStorage.getItem(key)||'null');}catch(_){return null;}};
 function normalize(value){
  const p=value||{};
  return {design:Object.hasOwn(designs,p.design)?p.design:'classic',theme:['dark','light','system'].includes(p.theme)?p.theme:'dark',compactNav:!!p.compactNav};
 }
 function store(){if(!owner)return;try{window.localStorage.setItem(keyFor(owner),JSON.stringify({preferences:prefs,pending}));}catch(_){}}
 function status(message){
  document.querySelectorAll('[data-appearance-status]').forEach(el=>el.textContent=message);
  document.querySelectorAll('[data-appearance-retry]').forEach(el=>el.hidden=!pending||saving);
 }
 window.financeInitAppearance=function(user){
  owner=user?.id||'';
  const cached=owner?read(keyFor(owner)):null,remote=user?.user_metadata?.finance_preferences;
  // A failed save on this device remains available to retry; cloud wins otherwise.
  prefs=normalize(cached?.pending?cached.preferences:remote||cached?.preferences||{});
  pending=!!cached?.pending;window.financeAppearanceReady=!!(remote||cached);
  apply();
 };
 window.financeGetAppearance=function(legacy){
  if(!prefs)window.financeInitAppearance({id:window.financeActiveUserId});
  if(!window.financeAppearanceReady&&legacy){prefs=normalize(legacy);window.financeAppearanceReady=true;store();}
  return {...prefs};
 };
 function apply(){
  if(!prefs)return;
  const theme=prefs.design==='bright'?'light':prefs.design==='midnight'?'dark':prefs.theme==='system'?(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):prefs.theme;
  document.documentElement.dataset.financeDesign=prefs.design;
  document.documentElement.dataset.financeTheme=theme;
  document.documentElement.dataset.themePreference=prefs.theme;
  document.documentElement.style.colorScheme=theme;
  document.body?.classList.toggle('compactFinanceNav',prefs.compactNav);
  document.querySelectorAll('[data-design-choice]').forEach(button=>{
   const on=button.dataset.designChoice===prefs.design;button.classList.toggle('selected',on);button.setAttribute('aria-pressed',String(on));
  });
  const classic=document.getElementById('classicColorMode');if(classic){classic.value=prefs.theme;classic.closest('label').hidden=prefs.design!=='classic';}
  const compact=document.getElementById('prefCompactNav');if(compact)compact.checked=prefs.compactNav;
  const name=document.getElementById('prefThemeStatus');if(name)name.textContent=designs[prefs.design];
  const themeMeta=document.querySelector('meta[name="theme-color"]');if(themeMeta)themeMeta.content=prefs.design==='bright'?'#f6f7f9':prefs.design==='midnight'?'#101921':'#0c3b4a';
  window.financeSyncExperienceNav?.();
 }
 window.financeApplyAppearance=apply;
 window.financeSaveAppearance=async function(){
  if(!owner||!pending||saving)return;
  const actor=owner,client=window.financeSupabaseClient;
  if(!client?.auth){status('Saved on this device. Sign in to sync your appearance.');return;}
  saving=true;status('Saving appearance…');
  try{
   const sessionResult=await client.auth.getSession();
   if(sessionResult.error)throw sessionResult.error;
   if(sessionResult.data?.session?.user?.id!==actor)throw Error('Sign in again to save your appearance.');
   while(pending&&owner===actor){
    const snapshot={...prefs};
    const result=await client.auth.updateUser({data:{finance_preferences:snapshot}});
    if(result.error)throw result.error;
    if(owner!==actor)return;
    pending=JSON.stringify(snapshot)!==JSON.stringify(prefs);store();
   }
   status('Saved to your profile · available on your other devices.');
  }catch(_){status('Saved on this device. Profile sync failed; retry when connected.');}
  finally{saving=false;document.querySelectorAll('[data-appearance-retry]').forEach(el=>el.hidden=!pending);}
 };
 window.financeSetAppearance=function(patch){
  prefs=normalize({...window.financeGetAppearance(),...patch});pending=true;store();apply();
  window.financeCloseMore?.();
  clearTimeout(saveTimer);saveTimer=setTimeout(window.financeSaveAppearance,300);
 };
 const primary=[['executive','dashboard','Home'],['incomeplan','installments','Monthly plan'],['accounts','cash','Cards & cash'],['transactions','transactions','Transactions'],['importstatements','import','Import statement']];
 const extra=[['outgoings','outgoings','Scheduled payments'],['installments','installments','Installments'],['reports','reports','Reports'],['financialposition','position','Financial position'],['strategy','strategy','Financial strategy'],['investments','investments','Investments'],['assets','assets','Personal assets'],['rental','rental','Rental'],['financeSettings','settings','Finance settings'],['cloudSync','cash','Cloud & sync'],['accountprofile','settings','Profile settings'],['preferences','settings','Appearance']];
 let moreReturn=null;
 window.financeCloseMore=function(){const dialog=document.getElementById('financeMoreDialog');if(dialog?.open)dialog.close();};
 function openMore(button){
  let dialog=document.getElementById('financeMoreDialog');
  if(!dialog){dialog=document.createElement('dialog');dialog.id='financeMoreDialog';dialog.className='financeMoreDialog';dialog.setAttribute('aria-labelledby','financeMoreTitle');document.body.append(dialog);dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});dialog.addEventListener('close',()=>moreReturn?.focus());}
  const allowed=[...primary,...extra].filter(item=>!window.financeCanViewPage||window.financeCanViewPage(item[0]));
  dialog.innerHTML='<div class="financeMoreContent"><div class="financeMoreHead"><h2 id="financeMoreTitle">Browse your workspace</h2><button type="button" data-more-close aria-label="Close menu">×</button></div><div class="financeMoreLinks">'+allowed.map(([page,icon,label])=>'<button type="button" data-experience-page="'+page+'">'+window.navIcon(icon)+'<span>'+label+'</span></button>').join('')+'</div></div>';
  dialog.querySelector('[data-more-close]').onclick=()=>dialog.close();moreReturn=button;dialog.showModal();
 }
 window.financeSyncExperienceNav=function(page){
  if(!document.body||typeof window.navIcon!=='function')return;
  let bar=document.getElementById('financeExperienceNav');
  if(!bar){bar=document.createElement('nav');bar.id='financeExperienceNav';bar.className='financeExperienceNav';bar.setAttribute('aria-label','Main navigation');document.body.append(bar);}
  const modern=prefs&&prefs.design!=='classic';bar.hidden=!modern;
  if(!modern){window.financeCloseMore();return;}
  const active=page||document.querySelector('.view.active')?.id||'executive';
  const allowed=primary.filter(item=>!window.financeCanViewPage||window.financeCanViewPage(item[0]));
  const markup='<a class="experienceBrand" href="#" aria-label="My Finance home">'+window.navIcon('investments')+'<b>My Finance</b></a><span class="experienceNavCaption">YOUR WORKSPACE</span>'+allowed.map(([id,icon,label])=>'<button type="button" class="experienceNavItem" data-experience-page="'+id+'">'+window.navIcon(icon)+'<span>'+label+'</span></button>').join('')+'<button type="button" class="experienceNavItem" data-experience-more>'+window.navIcon('more')+'<span>More</span></button><div class="experienceNavFoot">Control today.<br>Plan tomorrow.</div>';
  if(bar.financeMarkup!==markup){bar.innerHTML=markup;bar.financeMarkup=markup;bar.querySelector('a').onclick=e=>{e.preventDefault();window.nav(allowed[0]?.[0]||'accountprofile');};}
  bar.querySelectorAll('[data-experience-page]').forEach(button=>{const on=button.dataset.experiencePage===active;button.classList.toggle('active',on);if(on)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
  const more=bar.querySelector('[data-experience-more]');more.classList.toggle('active',!allowed.some(item=>item[0]===active));
  bar.style.setProperty('--nav-items',String(allowed.filter(item=>!['accounts','importstatements'].includes(item[0])).length+1));
  const locked=document.body.classList.contains('financeAccessLocked');bar.querySelectorAll('button').forEach(button=>button.disabled=locked);
 };
 document.addEventListener('click',event=>{
  const target=event.target.closest?.('[data-experience-page]');
  if(target){window.financeCloseMore();window.nav?.(target.dataset.experiencePage);}
  const more=event.target.closest?.('[data-experience-more]');if(more)openMore(more);
 },true);
 window.financeAppearanceStatus=function(){status(pending?'Saved on this device · profile sync pending.':owner?'Appearance saved for your profile.':'Choose your appearance.');};
 window.addEventListener('online',()=>window.financeSaveAppearance());
 window.matchMedia('(prefers-color-scheme: light)').addEventListener?.('change',()=>{if(prefs?.design==='classic'&&prefs.theme==='system')apply();});
 document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-design-choice]');
  if(button&&Object.hasOwn(designs,button.dataset.designChoice))window.financeSetAppearance({design:button.dataset.designChoice});
  if(event.target.closest?.('[data-appearance-retry]'))window.financeSaveAppearance();
 },true);
 document.addEventListener('change',event=>{if(event.target.id==='classicColorMode')window.financeSetAppearance({theme:event.target.value});});

 window.financeBootProgress=function(message){
  const progress=document.getElementById('financeBootProgress');if(!progress)return;
  progress.hidden=false;progress.querySelector('[data-boot-message]').textContent=message;
 };
 window.financeBootFailure=function(error){
  const progress=document.getElementById('financeBootProgress');if(!progress)return;
  progress.hidden=false;progress.classList.add('failed');
  progress.querySelector('[data-boot-message]').textContent='Could not finish loading. Check your connection and try again.';
  const button=progress.querySelector('button');button.hidden=false;button.onclick=()=>location.reload();
  progress.setAttribute('role','alert');console.error('Finance startup',error);
 };
 window.financeBootReady=function(){const progress=document.getElementById('financeBootProgress');if(progress)progress.hidden=true;};
 window.financeLoadDeadline=function(promise,label,ms=25000){
  let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' timed out')),ms);})]).finally(()=>clearTimeout(timer));
 };
 window.financeLoadAppParts=async function(files,version){
  const cacheName='finance-public-code-v1',cacheURL=new URL('/__finance_code__/'+encodeURIComponent(version),location.href).href;
  let cache=null;
  try{
   if(window.caches){cache=await window.financeLoadDeadline(caches.open(cacheName),'Code cache',1200);const hit=await window.financeLoadDeadline(cache.match(cacheURL),'Code cache',1200);if(hit){const parts=await hit.json();if(Array.isArray(parts)&&parts.length===files.length&&parts.every(p=>typeof p==='string'&&p.trim()))return parts;}}
  }catch(_){cache=null;}
  const parts=await Promise.all(files.map(async file=>{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
   try{const response=await fetch(file,{signal:controller.signal});if(!response.ok)throw Error('Could not load '+file);const source=await response.text();if(!source.trim())throw Error('Empty application file');return source;}finally{clearTimeout(timer);}
  }));
  if(cache){
   // Cache code only. A new release has a different key; incomplete loads are never cached.
   cache.put(cacheURL,new Response(JSON.stringify(parts),{headers:{'Content-Type':'application/json'}})).then(async()=>{
    const keys=await cache.keys();await Promise.all(keys.filter(key=>key.url!==cacheURL).map(key=>cache.delete(key)));
   }).catch(()=>{});
  }
  return parts;
 };
})();
