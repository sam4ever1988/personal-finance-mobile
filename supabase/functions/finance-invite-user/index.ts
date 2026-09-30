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
  const {data:workspace,error:workspaceError}=await admin.from('finance_workspaces').select('id').eq('owner_user_id',actor).limit(1);
  if(workspaceError||!workspace?.length)return reply(403,{error:'Create your own workspace before inviting users.'});
  const body=await req.json().catch(()=>null),email=String(body?.email||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return reply(400,{error:'Enter a valid email address.'});
  if(email===identity.user.email?.toLowerCase())return reply(400,{error:'Choose another email address.'});
  // Sender-scoped audit reserves a slot before asking Auth to send an email.
  const {data:recent,error:rateError}=await admin.from('finance_user_invitations').select('email,status,created_at').eq('sender_user_id',actor).gte('created_at',new Date(Date.now()-3600000).toISOString());
  if(rateError)return reply(503,{error:'Invitation history is unavailable. No email was sent.'});
  if((recent?.length||0)>=10)return reply(429,{error:'Invitation limit reached. Please try again later.'});
  if(recent?.some(i=>i.email===email&&['sending','sent'].includes(i.status)))return reply(409,{error:'An invitation to this email is already pending. Check invitation history.'});
  const {data:entry,error:auditError}=await admin.from('finance_user_invitations').insert({sender_user_id:actor,email,status:'sending'}).select('id').single();
  if(auditError||!entry)return reply(503,{error:'Invitation could not be recorded. No email was sent.'});
  const {data:invite,error}=await admin.auth.admin.inviteUserByEmail(email,{redirectTo:'https://personal-finance-mobile-two.vercel.app/'});
  if(error){await admin.from('finance_user_invitations').update({status:'failed',error_message:error.message}).eq('id',entry.id);return reply(409,{error:error.message});}
  const user=invite.user,acceptedAt=user?.email_confirmed_at||user?.last_sign_in_at||null;
  const {error:finishError}=await admin.from('finance_user_invitations').update({invited_user_id:user?.id,status:acceptedAt?'accepted':'sent',sent_at:new Date().toISOString(),accepted_at:acceptedAt}).eq('id',entry.id);
  if(finishError){console.error('Invitation audit completion failed',entry.id);return reply(200,{invited:true,email,historyPending:true});}
  return reply(200,{invited:true,email,id:entry.id});
 }catch(error){console.error('User invitation failed',error);return reply(500,{error:'Invitation could not be sent.'});}
});
