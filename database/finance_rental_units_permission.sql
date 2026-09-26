-- Keep per-user rental permissions authoritative for unit settings.
create or replace function public.finance_own_section_permission(record_section text)
returns text language sql stable security invoker
set search_path=pg_catalog,public
as $$
  select case
    when auth.uid() is null then 'off'
    when public.is_finance_owner() then 'edit'
    else coalesce((
      select a.permission from public.finance_page_access a
      where a.user_id=auth.uid() and a.page=case
        when record_section in ('manual_transactions','imported_transactions','tx_overrides',
          'transaction_actions','duplicate_decisions','categories') then 'transactions'
        when record_section in ('import_history','merchant_rules','statement_rule') then 'importstatements'
        when record_section in ('cash_flow_ledger','bank_balance_overrides','reset_card_ids',
          'card_reset_history','custom_banks','custom_credit_cards') then 'accounts'
        when record_section in ('finance_settings') then 'financeSettings'
        when record_section in ('income_plan','card_payment_plan') then 'incomeplan'
        when record_section in ('outgoings') then 'outgoings'
        when record_section in ('installments','deleted_installment_ids') then 'installments'
        when record_section in ('investments_holdings','investments_trades') then 'investments'
        when record_section in ('personal_assets_gold','personal_assets_zakat',
          'personal_assets_sales','personal_assets_market') then 'assets'
        when record_section in ('rental_bookings','rental_expenses','rental_blocks','rental_units') then 'rental'
        else null
      end
    ),'off')
  end;
$$;

