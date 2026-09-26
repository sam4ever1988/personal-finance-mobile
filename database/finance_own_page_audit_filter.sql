begin;

drop policy if exists finance_record_audit_read on public.finance_record_audit;
create policy finance_record_audit_read on public.finance_record_audit
  for select to authenticated using (
    (select public.is_finance_owner())
    or (
      workspace_user_id=(select auth.uid())
      and public.finance_own_section_permission(section) in ('view','edit')
    )
  );

commit;
