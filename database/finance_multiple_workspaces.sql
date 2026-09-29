-- Existing personal workspaces keep their user ID as their workspace ID.
-- Additional workspaces receive independent IDs and remain owned by one user.
create table if not exists public.finance_workspaces (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 display_name text not null check (char_length(trim(display_name)) between 1 and 80),
 created_at timestamptz not null default now(),
 unique (id, owner_user_id)
);

insert into public.finance_workspaces (id,owner_user_id,display_name)
select u.id,u.id,coalesce(nullif(trim(p.display_name),''),'My Workspace')
from auth.users u left join public.finance_workspace_profiles p on p.owner_user_id=u.id
on conflict (id) do nothing;

alter table public.finance_workspaces enable row level security;
create policy finance_workspaces_read on public.finance_workspaces
 for select to authenticated using (owner_user_id=(select auth.uid()));
create policy finance_workspaces_insert on public.finance_workspaces
 for insert to authenticated with check (owner_user_id=(select auth.uid()) and id<>(select auth.uid()));
create policy finance_workspaces_update on public.finance_workspaces
 for update to authenticated using (owner_user_id=(select auth.uid()))
 with check (owner_user_id=(select auth.uid()));
create policy finance_workspaces_delete on public.finance_workspaces
 for delete to authenticated using (owner_user_id=(select auth.uid()) and id<>(select auth.uid()));
grant select,insert,update,delete on public.finance_workspaces to authenticated;

alter table public.finance_user_records drop constraint finance_user_records_user_id_fkey;
alter table public.finance_user_records add constraint finance_user_records_workspace_fkey
 foreign key (user_id) references public.finance_workspaces(id) on delete cascade;
alter table public.finance_record_audit drop constraint finance_record_audit_workspace_user_id_fkey;
alter table public.finance_record_audit add constraint finance_record_audit_workspace_fkey
 foreign key (workspace_user_id) references public.finance_workspaces(id) on delete cascade;

-- The existing policies continue to serve each user's original workspace.
-- Additional workspaces are accessible only to their owner, subject to the
-- same page permission checks. Administrators receive no implicit access.
create policy finance_user_records_extra_read on public.finance_user_records
 for select to authenticated using (
 user_id<>(select auth.uid()) and exists(select 1 from public.finance_workspaces w where w.id=user_id and w.owner_user_id=(select auth.uid()))
 and finance_own_section_permission(section) in ('view','edit'));
create policy finance_user_records_extra_insert on public.finance_user_records
 for insert to authenticated with check (
 user_id<>(select auth.uid()) and exists(select 1 from public.finance_workspaces w where w.id=user_id and w.owner_user_id=(select auth.uid()))
 and finance_own_section_permission(section)='edit');
create policy finance_user_records_extra_update on public.finance_user_records
 for update to authenticated using (
 user_id<>(select auth.uid()) and exists(select 1 from public.finance_workspaces w where w.id=user_id and w.owner_user_id=(select auth.uid()))
 and finance_own_section_permission(section)='edit') with check (
 user_id<>(select auth.uid()) and exists(select 1 from public.finance_workspaces w where w.id=user_id and w.owner_user_id=(select auth.uid()))
 and finance_own_section_permission(section)='edit');
create policy finance_user_records_extra_delete on public.finance_user_records
 for delete to authenticated using (
 user_id<>(select auth.uid()) and exists(select 1 from public.finance_workspaces w where w.id=user_id and w.owner_user_id=(select auth.uid()))
 and finance_own_section_permission(section)='edit');
create policy finance_record_audit_extra_read on public.finance_record_audit
 for select to authenticated using (
 workspace_user_id<>(select auth.uid()) and exists(select 1 from public.finance_workspaces w where w.id=workspace_user_id and w.owner_user_id=(select auth.uid()))
 and finance_own_section_permission(section) in ('view','edit'));

create or replace function public.finance_create_workspace(workspace_name text)
returns uuid language plpgsql security definer set search_path=public,auth as $$
declare actor uuid:=auth.uid(); created uuid; clean_name text:=trim(coalesce(workspace_name,''));
begin
 if actor is null then raise exception 'Sign in first' using errcode='28000'; end if;
 if char_length(clean_name)<1 or char_length(clean_name)>80 then raise exception 'Use a name between 1 and 80 characters'; end if;
 insert into public.finance_workspaces(id,owner_user_id,display_name)
 values(actor,actor,'My Workspace') on conflict (id) do nothing;
 if (select count(*) from public.finance_workspaces where owner_user_id=actor)>=20 then
  raise exception 'Maximum of 20 workspaces reached';
 end if;
 insert into public.finance_workspaces(owner_user_id,display_name) values(actor,clean_name) returning id into created;
 return created;
end $$;
revoke all on function public.finance_create_workspace(text) from public;
grant execute on function public.finance_create_workspace(text) to authenticated;

create or replace function public.finance_ensure_primary_workspace()
returns void language plpgsql security definer set search_path=public,auth as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Sign in first' using errcode='28000'; end if;
 insert into public.finance_workspaces(id,owner_user_id,display_name)
 values(actor,actor,'My Workspace') on conflict (id) do nothing;
end $$;
revoke all on function public.finance_ensure_primary_workspace() from public;
grant execute on function public.finance_ensure_primary_workspace() to authenticated;
