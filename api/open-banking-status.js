export default function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const required=['NEOTEK_API_BASE_URL','NEOTEK_CLIENT_ID','NEOTEK_CLIENT_SECRET','NEOTEK_REDIRECT_URI'];
 const configured=required.every(name=>Boolean(process.env[name]));
 return res.status(configured?200:503).json({
  provider:'Neotek',
  configured,
  consentReady:false,
  onboardingRequired:!configured,
  message:configured
   ?'Provider credentials are present. The approved Neotek consent endpoint and API contract must be validated before a real bank redirect is enabled.'
   :'Provider onboarding is required. Request Neotek sandbox or production access, then configure the credentials only in Vercel environment variables.'
 });
}
