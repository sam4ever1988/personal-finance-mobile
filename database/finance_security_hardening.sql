begin;

-- These RPCs are never needed by anonymous visitors. The existing authenticated
-- owner check remains available to RLS policies and the signed-in application.
revoke all on function public.claim_finance_database() from public, anon;
grant execute on function public.claim_finance_database() to authenticated;
revoke all on function public.is_finance_owner() from public, anon;
grant execute on function public.is_finance_owner() to authenticated;

-- Trigger functions are invoked by their triggers; they need no direct Data API
-- EXECUTE permission for browser clients.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
revoke all on function public.touch_finance_sync_record() from public, anon, authenticated;

commit;
