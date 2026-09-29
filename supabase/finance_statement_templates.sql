create table public.finance_statement_templates (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(trim(name)) between 1 and 120 and name !~ '[0-9]{4,}'),
 file_type text not null check(file_type in ('XLSX','CSV')),
 mapping_config jsonb not null,
 created_at timestamptz not null default now(),
 new_until timestamptz not null default (now()+interval '2 months')
);
alter table public.finance_statement_templates enable row level security;
revoke all on public.finance_statement_templates from anon, authenticated;
grant select, delete on public.finance_statement_templates to authenticated;
grant insert(name,file_type,mapping_config), update(name,file_type,mapping_config) on public.finance_statement_templates to authenticated;
create policy templates_read on public.finance_statement_templates for select to authenticated using (true);
create policy templates_admin_insert on public.finance_statement_templates for insert to authenticated with check ((select public.is_finance_owner()));
create policy templates_admin_update on public.finance_statement_templates for update to authenticated using ((select public.is_finance_owner())) with check ((select public.is_finance_owner()));
create policy templates_admin_delete on public.finance_statement_templates for delete to authenticated using ((select public.is_finance_owner()));
create function public.finance_template_mapping_valid(config jsonb) returns boolean language sql immutable set search_path='' as $$
 select jsonb_typeof(config)='object'
 and config ?& array['date','description','headerRow','dataStartRow']
 and (config->>'date') ~ '^[A-Z]{1,3}$' and (config->>'description') ~ '^[A-Z]{1,3}$'
 and ((config->>'amount') ~ '^[A-Z]{1,3}$' or (config->>'debit') ~ '^[A-Z]{1,3}$' or (config->>'credit') ~ '^[A-Z]{1,3}$')
 and not exists (
 select 1 from jsonb_each(config) p
 where case
 when p.key in ('headerRow','dataStartRow') then not (jsonb_typeof(p.value)='number' and p.value::text ~ '^[1-9][0-9]{0,5}$')
 when p.key in ('date','description','amount','debit','credit','balance','reference','cardLast4') then not (jsonb_typeof(p.value)='string' and (p.value #>> '{}') ~ '^([A-Z]{1,3})?$')
 else true end
 );
$$;
alter table public.finance_statement_templates add constraint templates_safe_mapping check(public.finance_template_mapping_valid(mapping_config) is true);