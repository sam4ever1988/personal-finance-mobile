import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed.' });
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !serviceKey || !anonKey) return reply(503, { error: 'Invitations are unavailable.' });
  const authorization = req.headers.get('Authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return reply(401, { error: 'Sign in first.' });
  try {
    const caller = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: identity, error: identityError } = await caller.auth.getUser(token);
    if (identityError || !identity.user) return reply(401, { error: 'Your session has expired.' });
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: owner, error: ownerError } = await admin.from('finance_owner').select('owner_user_id').eq('id', 1).single();
    if (ownerError || owner?.owner_user_id !== identity.user.id) return reply(403, { error: 'Administrator access is required.' });
    const body = await req.json().catch(() => null);
    const email = String(body?.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
      return reply(400, { error: 'Enter a valid email address.' });
    const { error } = await admin.auth.admin.inviteUserByEmail(email);
    if (error) return reply(409, { error: error.message });
    return reply(200, { invited: true, email });
  } catch (error) {
    console.error('User invitation failed', error);
    return reply(500, { error: 'Invitation could not be sent.' });
  }
});
