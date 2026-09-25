begin;

-- Explicit admin decisions. No row means no shared access.
create table if not exists public.finance_workspace_grants (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  member_user_id uuid not null references auth.users(id) on delete cascade,
  page text not null,
  permission text not null check (permission in ('view','edit')),
  granted_at timestamptz not null default now(),
  granted_by uuid not null references auth.users(id),
  primary key (owner_user_id, member_user_id, page),
  check (owner_user_id <> member_user_id),
  check (page in ('executive','accounts','financialposition','strategy','transactions',
                 'incomeplan','outgoings','installments','importstatements','investments',
                 'assets','rental','reports','financeSettings'))
);
alter table public.finance_workspace_grants enable row level security;
create policy finance_grants_visible on public.finance_workspace_grants for select to authenticated
  using (owner_user_id = (select auth.uid()) or member_user_id = (select auth.uid()) or (select public.is_finance_owner()));
create policy finance_grants_admin_insert on public.finance_workspace_grants for insert to authenticated
  with check ((select public.is_finance_owner()) and granted_by = (select auth.uid()));
create policy finance_grants_admin_update on public.finance_workspace_grants for update to authenticated
  using ((select public.is_finance_owner()))
  with check ((select public.is_finance_owner()) and granted_by = (select auth.uid()));
create policy finance_grants_admin_delete on public.finance_workspace_grants for delete to authenticated
  using ((select public.is_finance_owner()));
grant select,insert,update,delete on public.finance_workspace_grants to authenticated;
revoke all on public.finance_workspace_grants from anon;

-- Omitted rows retain full access to a user's OWN workspace. The admin cannot
-- restrict the owner's own account.
create table if not exists public.finance_page_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  page text not null,
  permission text not null check (permission in ('off','view','edit')),
  updated_at timestamptz not null default now(),
  primary key (user_id, page),
  check (page in ('executive','accounts','financialposition','strategy','transactions',
                 'incomeplan','outgoings','installments','importstatements','investments',
                 'assets','rental','reports','financeSettings'))
);
alter table public.finance_page_access enable row level security;
create policy finance_page_access_read on public.finance_page_access for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_finance_owner()));
create policy finance_page_access_admin_insert on public.finance_page_access for insert to authenticated
  with check ((select public.is_finance_owner()) and user_id <> (select auth.uid()));
create policy finance_page_access_admin_update on public.finance_page_access for update to authenticated
  using ((select public.is_finance_owner()) and user_id <> (select auth.uid()))
  with check ((select public.is_finance_owner()) and user_id <> (select auth.uid()));
create policy finance_page_access_admin_delete on public.finance_page_access for delete to authenticated
  using ((select public.is_finance_owner()) and user_id <> (select auth.uid()));
grant select,insert,update,delete on public.finance_page_access to authenticated;
revoke all on public.finance_page_access from anon;

create schema if not exists finance_private;
create table if not exists public.finance_record_audit (
  id bigint generated always as identity primary key,
  workspace_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  section text not null,
  record_id text not null,
  operation text not null check (operation in ('create','update','delete')),
  before_data jsonb,
  after_data jsonb,
  changed_at timestamptz not null default now()
);
create index if not exists finance_record_audit_workspace_time
  on public.finance_record_audit (workspace_user_id,changed_at desc);
alter table public.finance_record_audit enable row level security;
create policy finance_record_audit_read on public.finance_record_audit for select to authenticated
  using (workspace_user_id = (select auth.uid()) or (select public.is_finance_owner()));
grant select on public.finance_record_audit to authenticated;
revoke all on public.finance_record_audit from anon;

create or replace function finance_private.audit_finance_record()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  before_value jsonb;
  after_value jsonb;
  action text;
  subject_user uuid;
  subject_section text;
  subject_record text;
begin
  if tg_op = 'INSERT' then
    subject_user := new.user_id; subject_section := new.section; subject_record := new.record_id;
    before_value := null;
    after_value := case when new.deleted_at is null then new.data else null end;
    action := 'create';
  elsif tg_op = 'UPDATE' then
    subject_user := new.user_id; subject_section := new.section; subject_record := new.record_id;
    if old.data is not distinct from new.data and old.deleted_at is not distinct from new.deleted_at then
      return new;
    end if;
    before_value := case when old.deleted_at is null then old.data else null end;
    after_value := case when new.deleted_at is null then new.data else null end;
    action := case when new.deleted_at is not null then 'delete' else 'update' end;
  else
    subject_user := old.user_id; subject_section := old.section; subject_record := old.record_id;
    before_value := case when old.deleted_at is null then old.data else null end;
    after_value := null;
    action := 'delete';
  end if;
  insert into public.finance_record_audit
    (workspace_user_id,actor_user_id,section,record_id,operation,before_data,after_data)
  values
    (subject_user,auth.uid(),subject_section,subject_record,action,before_value,after_value);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function finance_private.audit_finance_record() from public, anon, authenticated;
drop trigger if exists trg_audit_finance_user_record on public.finance_user_records;
create trigger trg_audit_finance_user_record after insert or update or delete
  on public.finance_user_records for each row execute function finance_private.audit_finance_record();

-- Only the admin receives the full directory. A regular user receives
-- their own identity and names needed to label authorized shared workspaces.
create or replace function public.finance_access_directory()
returns table (user_id uuid, user_email text)
language sql stable security definer
set search_path = pg_catalog, public, auth
as $$
  select u.id,u.email::text
  from auth.users u
  where auth.uid() is not null
    and (
      public.is_finance_owner()
      or u.id=auth.uid()
      or exists (
        select 1 from public.finance_workspace_grants g
        where g.member_user_id=auth.uid() and g.owner_user_id=u.id
      )
      or exists (
        select 1 from public.finance_workspace_grants g
        where g.owner_user_id=auth.uid() and g.member_user_id=u.id
      )
    );
$$;
revoke all on function public.finance_access_directory() from public, anon;
grant execute on function public.finance_access_directory() to authenticated;

commit;
