alter table public.finance_page_access drop constraint finance_page_access_page_check;
alter table public.finance_page_access add constraint finance_page_access_page_check check (
 page=any(array['executive','accounts','financialposition','strategy','transactions','incomeplan','outgoings','installments','importstatements','investments','assets','rental','reports','financeSettings','bankconnections'])
);