begin;

-- Names belong to the workspace owner. A member sees a name only after an
-- explicit page grant; deleting the final grant removes its visibility.
create table if not exists public.finance_workspace_profiles (
 owner_user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check (length(btrim(display_name)) between 1 and 80),
 updated_at timestamptz not null default now()
);
alter table public.finance_workspace_profiles enable row level security;
create policy finance_workspace_profiles_read on public.finance_workspace_profiles
 for select to authenticated using (
  owner_user_id=(select auth.uid()) or exists(
   select 1 from public.finance_workspace_grants g
   where g.owner_user_id=finance_workspace_profiles.owner_user_id
     and g.member_user_id=(select auth.uid())
  )
 );
create policy finance_workspace_profiles_insert on public.finance_workspace_profiles
 for insert to authenticated with check (owner_user_id=(select auth.uid()));
create policy finance_workspace_profiles_update on public.finance_workspace_profiles
 for update to authenticated using (owner_user_id=(select auth.uid()))
 with check (owner_user_id=(select auth.uid()));
grant select,insert,update on public.finance_workspace_profiles to authenticated;
revoke all on public.finance_workspace_profiles from anon;

create or replace function public.finance_record_page(record_section text)
returns text language sql immutable security invoker
set search_path=pg_catalog,public
as $$
 select case
  when record_section in ('manual_transactions','imported_transactions','tx_overrides',
   'transaction_actions','duplicate_decisions','categories') then 'transactions'
  when record_section in ('import_history','merchant_rules','statement_rule') then 'importstatements'
  when record_section in ('cash_flow_ledger','bank_balance_overrides','reset_card_ids',
   'card_reset_history','custom_banks','custom_credit_cards') then 'accounts'
  when record_section='finance_settings' then 'financeSettings'
  when record_section in ('income_plan','card_payment_plan') then 'incomeplan'
  when record_section='outgoings' then 'outgoings'
  when record_section in ('installments','deleted_installment_ids') then 'installments'
  when record_section in ('investments_holdings','investments_trades') then 'investments'
  when record_section in ('personal_assets_gold','personal_assets_zakat',
   'personal_assets_sales','personal_assets_market') then 'assets'
  when record_section in ('rental_bookings','rental_expenses','rental_blocks','rental_units') then 'rental'
  else null end;
$$;
revoke all on function public.finance_record_page(text) from public,anon;
grant execute on function public.finance_record_page(text) to authenticated;

create or replace function public.finance_shared_section_permission(workspace_id uuid, record_section text)
returns text language sql stable security invoker
set search_path=pg_catalog,public
as $$
 select case when auth.uid() is null or workspace_id=auth.uid() then 'off'
 else coalesce((select g.permission from public.finance_workspace_grants g
  where g.owner_user_id=workspace_id and g.member_user_id=auth.uid()
    and g.page=public.finance_record_page(record_section)), 'off') end;
$$;
revoke all on function public.finance_shared_section_permission(uuid,text) from public,anon;
grant execute on function public.finance_shared_section_permission(uuid,text) to authenticated;

create policy finance_user_records_shared_read on public.finance_user_records
 for select to authenticated using (
  user_id<>(select auth.uid()) and
  public.finance_shared_section_permission(user_id,section) in ('view','edit')
 );
create policy finance_user_records_shared_insert on public.finance_user_records
 for insert to authenticated with check (
  user_id<>(select auth.uid()) and
  public.finance_shared_section_permission(user_id,section)='edit'
 );
create policy finance_user_records_shared_update on public.finance_user_records
 for update to authenticated using (
  user_id<>(select auth.uid()) and
  public.finance_shared_section_permission(user_id,section)='edit'
 ) with check (
  user_id<>(select auth.uid()) and
  public.finance_shared_section_permission(user_id,section)='edit'
 );
create policy finance_user_records_shared_delete on public.finance_user_records
 for delete to authenticated using (
  user_id<>(select auth.uid()) and
  public.finance_shared_section_permission(user_id,section)='edit'
 );

create policy finance_record_audit_shared_read on public.finance_record_audit
 for select to authenticated using (
  workspace_user_id<>(select auth.uid()) and
  public.finance_shared_section_permission(workspace_user_id,section) in ('view','edit')
 );

commit;
