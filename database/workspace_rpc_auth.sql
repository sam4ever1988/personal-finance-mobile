revoke execute on function public.finance_create_workspace(text) from public, anon;
revoke execute on function public.finance_ensure_primary_workspace() from public, anon;
grant execute on function public.finance_create_workspace(text) to authenticated;
grant execute on function public.finance_ensure_primary_workspace() to authenticated;
