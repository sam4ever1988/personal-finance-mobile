import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};
const response = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), { status, headers: cors });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return response(405, { error: 'Method not allowed.' });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !serviceKey || !publishableKey) return response(503, { error: 'Account administration is unavailable.' });

  const bearer = req.headers.get('Authorization') || '';
  const token = bearer.startsWith('Bearer ') ? bearer.slice(7) : '';
  if (!token) return response(401, { error: 'Sign in first.' });

  try {
    const callerClient = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: caller, error: callerError } = await callerClient.auth.getUser(token);
    if (callerError || !caller.user) return response(401, { error: 'Your session is no longer valid.' });

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: owner, error: ownerError } = await admin.from('finance_owner').select('owner_user_id').eq('id', 1).single();
    if (ownerError || caller.user.id !== owner?.owner_user_id) return response(403, { error: 'Administrator access is required.' });

    const body = await req.json().catch(() => null);
    const targetId = body?.userId;
    const confirmation = String(body?.confirmEmail || '').trim().toLowerCase();
    if (typeof targetId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(targetId) || !confirmation)
      return response(400, { error: 'Choose a user and type their email to confirm.' });
    if (targetId === caller.user.id) return response(403, { error: 'The administrator account cannot be deleted here.' });

    const { data: target, error: targetError } = await admin.auth.admin.getUserById(targetId);
    if (targetError || !target.user) return response(404, { error: 'User not found.' });
    if (String(target.user.email || '').toLowerCase() !== confirmation)
      return response(400, { error: 'The confirmation email does not match this user.' });

    // The user's finance records and audit history have cascading foreign keys.
    // Supabase Auth also removes refresh sessions; existing access JWTs expire normally.
    const { error: deleteError } = await admin.auth.admin.deleteUser(targetId);
    if (deleteError) return response(409, { error: 'Could not delete the account. Check linked records or owned storage objects.' });
    return response(200, { deleted: true });
  } catch (error) {
    console.error('Account deletion failed', error);
    return response(500, { error: 'Account deletion failed. No confirmation was returned.' });
  }
});
