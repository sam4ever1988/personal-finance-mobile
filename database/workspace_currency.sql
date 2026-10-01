alter table public.finance_workspaces add column base_currency text not null default 'SAR';
alter table public.finance_workspaces add constraint finance_workspace_currency_supported check(base_currency=any(array['SAR','PHP','USD','EUR','GBP','AED','AUD','CAD','CHF','CNY','HKD','SGD','JPY','INR','KRW','IDR','MYR','THB','NZD','BHD','KWD','QAR','OMR','EGP','PKR','BDT','ZAR','TRY','BRL','MXN']));
create or replace function public.finance_lock_workspace_currency() returns trigger language plpgsql set search_path=public as $$ begin
 if new.base_currency is distinct from old.base_currency then raise exception 'Workspace currency is fixed at creation. Create a new workspace for a different currency.';end if;return new;end $$;
create trigger finance_workspace_currency_immutable before update of base_currency on public.finance_workspaces for each row execute function public.finance_lock_workspace_currency();
create or replace function public.finance_create_workspace(workspace_name text,workspace_currency text) returns uuid language plpgsql security definer set search_path=public,auth as $$
declare actor uuid:=auth.uid();created uuid;clean_name text:=trim(coalesce(workspace_name,''));chosen text:=upper(trim(coalesce(workspace_currency,'')));
begin
 if actor is null then raise exception 'Sign in first' using errcode='28000';end if;
 if char_length(clean_name)<1 or char_length(clean_name)>80 then raise exception 'Use a name between 1 and 80 characters';end if;
 if not chosen=any(array['SAR','PHP','USD','EUR','GBP','AED','AUD','CAD','CHF','CNY','HKD','SGD','JPY','INR','KRW','IDR','MYR','THB','NZD','BHD','KWD','QAR','OMR','EGP','PKR','BDT','ZAR','TRY','BRL','MXN']) then raise exception 'Unsupported workspace currency';end if;
 insert into public.finance_workspaces(id,owner_user_id,display_name) values(actor,actor,'My Workspace') on conflict(id) do nothing;
 if (select count(*) from public.finance_workspaces where owner_user_id=actor)>=20 then raise exception 'Maximum of 20 workspaces reached';end if;
 insert into public.finance_workspaces(owner_user_id,display_name,base_currency) values(actor,clean_name,chosen) returning id into created;return created;
end $$;
create or replace function public.finance_workspace_currency(workspace_id uuid) returns text language plpgsql stable security definer set search_path=public,auth as $$
declare currency text;
begin
 if auth.uid() is null then raise exception 'Sign in first' using errcode='28000';end if;
 select base_currency into currency from public.finance_workspaces w where w.id=workspace_id and(w.owner_user_id=auth.uid() or exists(select 1 from public.finance_workspace_grants g where g.owner_user_id=w.id and g.member_user_id=auth.uid() and g.permission in('view','edit')));
 if currency is null then raise exception 'Workspace access denied' using errcode='42501';end if;return currency;
end $$;
revoke execute on function public.finance_create_workspace(text,text) from public,anon;
revoke execute on function public.finance_workspace_currency(uuid) from public,anon;
grant execute on function public.finance_create_workspace(text,text) to authenticated;
grant execute on function public.finance_workspace_currency(uuid) to authenticated;
