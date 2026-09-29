begin;

-- Workspace owners decide who may see their records. The application
-- administrator manages accounts and page access, not private data.
drop policy if exists finance_grants_admin_insert on public.finance_workspace_grants;
drop policy if exists finance_grants_admin_update on public.finance_workspace_grants;
drop policy if exists finance_grants_admin_delete on public.finance_workspace_grants;
drop policy if exists finance_grants_visible on public.finance_workspace_grants;
drop policy if exists finance_grants_owner_insert on public.finance_workspace_grants;
drop policy if exists finance_grants_owner_update on public.finance_workspace_grants;
drop policy if exists finance_grants_owner_delete on public.finance_workspace_grants;

create policy finance_grants_visible on public.finance_workspace_grants
 for select to authenticated using (
  owner_user_id=(select auth.uid()) or member_user_id=(select auth.uid())
 );
create policy finance_grants_owner_insert on public.finance_workspace_grants
 for insert to authenticated with check (
  owner_user_id=(select auth.uid()) and granted_by=(select auth.uid())
 );
create policy finance_grants_owner_update on public.finance_workspace_grants
 for update to authenticated using (owner_user_id=(select auth.uid()))
 with check (
  owner_user_id=(select auth.uid()) and granted_by=(select auth.uid())
 );
create policy finance_grants_owner_delete on public.finance_workspace_grants
 for delete to authenticated using (owner_user_id=(select auth.uid()));

-- Existing administrator-issued grants have no owner consent.
delete from public.finance_workspace_grants where granted_by<>owner_user_id;
delete from public.finance_workspace_grants
 where member_user_id=(select owner_user_id from public.finance_owner where id=1);

create or replace function public.finance_shared_section_permission(workspace_id uuid, record_section text)
returns text language sql stable security invoker
set search_path=pg_catalog,public
as $$
 select case
  when auth.uid() is null or workspace_id=auth.uid() or public.is_finance_owner() then 'off'
  else coalesce((select g.permission from public.finance_workspace_grants g
   where g.owner_user_id=workspace_id and g.member_user_id=auth.uid()
     and g.page=public.finance_record_page(record_section)), 'off') end;
$$;

drop policy if exists finance_workspace_profiles_read on public.finance_workspace_profiles;
create policy finance_workspace_profiles_read on public.finance_workspace_profiles
 for select to authenticated using (
  owner_user_id=(select auth.uid()) or
  (not public.is_finance_owner() and exists(
   select 1 from public.finance_workspace_grants g
   where g.owner_user_id=finance_workspace_profiles.owner_user_id
     and g.member_user_id=(select auth.uid())
  ))
 );

drop policy if exists finance_record_audit_read on public.finance_record_audit;
create policy finance_record_audit_read on public.finance_record_audit
 for select to authenticated using (
  workspace_user_id=(select auth.uid())
  and public.finance_own_section_permission(section) in ('view','edit')
 );

commit;
