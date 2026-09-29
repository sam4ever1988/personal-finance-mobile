begin;
alter table public.finance_access_lab_items alter column updated_by drop not null;
alter table public.finance_access_lab_items drop constraint finance_access_lab_items_updated_by_fkey;
alter table public.finance_access_lab_items add constraint finance_access_lab_items_updated_by_fkey foreign key (updated_by) references auth.users(id) on delete set null;
commit;
