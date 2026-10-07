import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'};
const reply=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{status,headers});
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply(405,{error:'Method not allowed.'});
 const url=Deno.env.get('SUPABASE_URL'),serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),anonKey=Deno.env.get('SUPABASE_ANON_KEY');
 if(!url||!serviceKey||!anonKey)return reply(503,{error:'Invitations are unavailable.'});
 const token=(req.headers.get('Authorization')||'').replace(/^Bearer /,'');
 try{
  const caller=createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:identity,error:identityError}=await caller.auth.getUser(token);
  if(identityError||!identity.user)return reply(401,{error:'Sign in with a valid account first.'});
  const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}}),actor=identity.user.id;
  const {data:workspace,error:workspaceError}=await admin.from('finance_workspaces').select('id,display_name').eq('owner_user_id',actor);
  if(workspaceError||!workspace?.length)return reply(403,{error:'Create your own workspace before inviting users.'});
  const body=await req.json().catch(()=>null),email=String(body?.email||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return reply(400,{error:'Enter a valid email address.'});
  if(email===identity.user.email?.toLowerCase())return reply(400,{error:'Choose another email address.'});
  const invitationType=body?.invitationType??'system';
  if(!['system','shared'].includes(invitationType))return reply(400,{error:'Choose a valid invitation type.'});
  const permissions:Record<string,string>={};
  let selectedWorkspace:{id:string;display_name:string}|null|undefined=null;
  const pageNames:Record<string,string>={executive:'Executive Overview',accounts:'Cash & Credit',financialposition:'Financial Position',strategy:'Financial Strategy',transactions:'Transactions',incomeplan:'Income & Payment Plan',outgoings:'Outgoings',installments:'Installments',importstatements:'Import Statements',investments:'Investments',assets:'Personal Assets',rental:'Airbnb / Rental',reports:'Reports',financeSettings:'Financial Settings'};
  if(invitationType==='shared'){
   selectedWorkspace=workspace.find(w=>w.id===body.workspaceId);
   if(!selectedWorkspace)return reply(403,{error:'Choose a workspace you own.'});
   if(!body.permissions||Array.isArray(body.permissions)||typeof body.permissions!=='object')return reply(400,{error:'Choose page access before sending.'});
   const [{data:owner},{data:ownAccess,error:accessError}]=await Promise.all([admin.from('finance_owner').select('owner_user_id').eq('id',1).single(),admin.from('finance_page_access').select('page,permission').eq('user_id',actor)]);
   if(accessError)return reply(503,{error:'Unable to verify your sharing permissions.'});
   for(const [page,permission] of Object.entries(body.permissions)){
    if(!pageNames[page]||!['view','edit'].includes(String(permission)))return reply(400,{error:'Invalid page access.'});
    const own=ownAccess?.find(p=>p.page===page)?.permission;
    if(owner?.owner_user_id!==actor&&!(own==='edit'||(own==='view'&&permission==='view')))return reply(403,{error:'You cannot share more access than you have.'});
    permissions[page]=String(permission);
   }
   if(!Object.keys(permissions).length)return reply(400,{error:'Select at least one page to share.'});
  }else if(body.workspaceId||Object.keys(body.permissions||{}).length)return reply(400,{error:'System invitations must not share workspace access.'});
  const inviterName=String(identity.user.user_metadata?.display_name||identity.user.user_metadata?.full_name||identity.user.email||'A Personal Finance user').slice(0,120);
  const accessSummary=Object.entries(permissions).map(([page,permission])=>pageNames[page]+': '+(permission==='edit'?'View and edit':'View only')).join('; ');
  // Sender-scoped audit reserves a slot before asking Auth to send an email.
  const {data:recent,error:rateError}=await admin.from('finance_user_invitations').select('email,status,created_at').eq('sender_user_id',actor).gte('created_at',new Date(Date.now()-3600000).toISOString());
  if(rateError)return reply(503,{error:'Invitation history is unavailable. No email was sent.'});
  if((recent?.length||0)>=10)return reply(429,{error:'Invitation limit reached. Please try again later.'});
  if(recent?.some(i=>i.email===email&&['sending','sent'].includes(i.status)))return reply(409,{error:'An invitation to this email is already pending. Check invitation history.'});
  const {data:entry,error:auditError}=await admin.from('finance_user_invitations').insert({sender_user_id:actor,email,status:'sending',invitation_type:invitationType,workspace_id:selectedWorkspace?.id||null,workspace_name:selectedWorkspace?.display_name||null,page_permissions:permissions,inviter_name:inviterName}).select('id').single();
  if(auditError||!entry)return reply(503,{error:'Invitation could not be recorded. No email was sent.'});
  const {data:invite,error}=await admin.auth.admin.inviteUserByEmail(email,{redirectTo:'https://personal-finance-mobile-two.vercel.app/',data:{finance_invitation_type:invitationType,finance_inviter_name:inviterName,finance_workspace_name:selectedWorkspace?.display_name||'',finance_access_summary:accessSummary}});
  if(error){await admin.from('finance_user_invitations').update({status:'failed',error_message:error.message}).eq('id',entry.id);return reply(409,{error:error.message});}
  const user=invite.user,acceptedAt=user?.email_confirmed_at||user?.last_sign_in_at||null;
  const {error:finishError}=await admin.from('finance_user_invitations').update({invited_user_id:user?.id,status:acceptedAt?'accepted':'sent',sent_at:new Date().toISOString(),accepted_at:acceptedAt}).eq('id',entry.id);
  if(finishError){console.error('Invitation audit completion failed',entry.id);return reply(200,{invited:true,email,historyPending:true});}
  return reply(200,{invited:true,email,id:entry.id});
 }catch(error){console.error('User invitation failed',error);return reply(500,{error:'Invitation could not be sent.'});}
});
