// The test lab shares the finance auth session, but also supports direct links
// opened on another browser/origin. All access is verified again by the API.
(async()=>{
 const gate=document.getElementById('testingGate'),content=document.getElementById('testingContent');
 let client,loaded=false,busy=false;
 function message(value){document.getElementById('testingLoginStatus').textContent=value;}
 function showGate(value){
  gate.hidden=false;content.hidden=true;
  gate.innerHTML='<section class="testingLogin"><h1>Grocery test · Admin sign-in</h1><p>Use your finance account. This test page is restricted to the administrator.</p><form id="testingLoginForm"><label>Email<input id="testingEmail" type="email" autocomplete="username" required></label><label>Password<input id="testingPassword" type="password" autocomplete="current-password" required></label><button id="testingSignIn" type="submit">Sign in</button></form><p id="testingLoginStatus" role="status" aria-live="polite"></p><button id="testingRetry" type="button">Check existing sign-in again</button><p><a href="/">Return to My Finance</a></p></section>';
  message(value);document.getElementById('testingRetry').onclick=verify;
  document.getElementById('testingLoginForm').onsubmit=async event=>{
   event.preventDefault();if(busy||!client)return;busy=true;setDisabled(true);message('Signing in…');
   try{
    const {error}=await client.auth.signInWithPassword({email:document.getElementById('testingEmail').value.trim(),password:document.getElementById('testingPassword').value});
    document.getElementById('testingPassword').value='';
    if(error)throw error;
    busy=false;await verify();
   }catch(error){message(error.message||'Sign-in failed. Please try again.');}
   finally{busy=false;setDisabled(false);}
  };
 }
 function setDisabled(disabled){gate.querySelectorAll('button').forEach(el=>el.disabled=disabled);}
 async function verify(){
  if(busy)return;busy=true;setDisabled(true);
  try{
   if(!client)throw Error('The sign-in service could not load. Reload the page or check whether your browser blocked it.');
   const {data,error}=await client.auth.getUser();
   if(error||!data?.user){showGate('Sign in here, or sign in to My Finance on this same website address and click “Check existing sign-in again”.');return;}
   if(data.user.id!=='a8b3c116-be0f-4e2c-9d9a-04643c18b689'||data.user.email?.toLowerCase()!=='sam4ever@windowslive.com'){showGate('This account does not have access to the grocery test. Use your administrator account.');return;}
   window.financeGroceryClient=client;
   window.financeGrocerySignIn=()=>showGate('Your session is missing or expired. Sign in again to reconnect. Your shopping list stays on this page.');
   gate.hidden=true;content.hidden=false;
   if(!loaded){
    await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='grocery-test.js?v=427';script.onload=resolve;script.onerror=()=>{script.remove();reject(Error('The grocery tools could not load. Check your connection and try again.'));};document.body.append(script);});
    loaded=true;
   }
   else window.dispatchEvent(new Event('finance-grocery-authenticated'));
  }catch(error){showGate(error.message||'Could not verify access. Please try again.');}
  finally{busy=false;setDisabled(false);}
 }
 showGate('Checking existing sign-in…');
 try{client=window.supabase?.createClient('https://qxayaygycgqwrerhrrlq.supabase.co','sb_publishable_2RIeDYaMuiPFyVs1TEG9wA_wqc8oNx2');}catch(_){}
 await verify();
})();
