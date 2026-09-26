begin;

-- Isolated permission trial: these tables contain sample text only and never
-- authorize reads or writes to finance_user_records.
create table if not exists public.finance_access_lab_grants (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  member_user_id uuid not null references auth.users(id) on delete cascade,
  page text not null check (page in ('transactions','investments','assets','rental')),
  permission text not null check (permission in ('view','edit')),
  granted_by uuid not null references auth.users(id),
  primary key (owner_user_id,member_user_id,page),
  check (owner_user_id <> member_user_id)
);
alter table public.finance_access_lab_grants enable row level security;
create policy finance_lab_grants_read on public.finance_access_lab_grants
  for select to authenticated using (
    owner_user_id=(select auth.uid()) or member_user_id=(select auth.uid())
    or (select public.is_finance_owner())
  );
create policy finance_lab_grants_insert on public.finance_access_lab_grants
  for insert to authenticated with check (
    (select public.is_finance_owner()) and granted_by=(select auth.uid())
  );
create policy finance_lab_grants_update on public.finance_access_lab_grants
  for update to authenticated using ((select public.is_finance_owner()))
  with check ((select public.is_finance_owner()) and granted_by=(select auth.uid()));
create policy finance_lab_grants_delete on public.finance_access_lab_grants
  for delete to authenticated using ((select public.is_finance_owner()));
grant select,insert,update,delete on public.finance_access_lab_grants to authenticated;
revoke all on public.finance_access_lab_grants from anon;

create table if not exists public.finance_access_lab_items (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  page text not null check (page in ('transactions','investments','assets','rental')),
  title text not null check (length(title) between 1 and 150),
  note text not null default '' check (length(note) <= 1000),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id)
);
alter table public.finance_access_lab_items enable row level security;
create policy finance_lab_items_read on public.finance_access_lab_items
  for select to authenticated using (
    owner_user_id=(select auth.uid()) or exists (
      select 1 from public.finance_access_lab_grants g
      where g.owner_user_id=finance_access_lab_items.owner_user_id
        and g.member_user_id=(select auth.uid()) and g.page=finance_access_lab_items.page
    )
  );
create policy finance_lab_items_insert on public.finance_access_lab_items
  for insert to authenticated with check (
    updated_by=(select auth.uid()) and (
      owner_user_id=(select auth.uid()) or exists (
        select 1 from public.finance_access_lab_grants g
        where g.owner_user_id=finance_access_lab_items.owner_user_id
          and g.member_user_id=(select auth.uid()) and g.page=finance_access_lab_items.page
          and g.permission='edit'
      )
    )
  );
create policy finance_lab_items_update on public.finance_access_lab_items
  for update to authenticated using (
    owner_user_id=(select auth.uid()) or exists (
      select 1 from public.finance_access_lab_grants g
      where g.owner_user_id=finance_access_lab_items.owner_user_id
        and g.member_user_id=(select auth.uid()) and g.page=finance_access_lab_items.page
        and g.permission='edit'
    )
  ) with check (
    updated_by=(select auth.uid()) and (
      owner_user_id=(select auth.uid()) or exists (
        select 1 from public.finance_access_lab_grants g
        where g.owner_user_id=finance_access_lab_items.owner_user_id
          and g.member_user_id=(select auth.uid()) and g.page=finance_access_lab_items.page
          and g.permission='edit'
      )
    )
  );
create policy finance_lab_items_delete on public.finance_access_lab_items
  for delete to authenticated using (
    owner_user_id=(select auth.uid()) or exists (
      select 1 from public.finance_access_lab_grants g
      where g.owner_user_id=finance_access_lab_items.owner_user_id
        and g.member_user_id=(select auth.uid()) and g.page=finance_access_lab_items.page
        and g.permission='edit'
    )
  );
grant select,insert,update,delete on public.finance_access_lab_items to authenticated;
revoke all on public.finance_access_lab_items from anon;
create index if not exists finance_lab_items_owner_page on public.finance_access_lab_items(owner_user_id,page);
create index if not exists finance_lab_grants_member on public.finance_access_lab_grants(member_user_id);

create or replace function public.finance_access_lab_directory()
returns table (user_id uuid,user_email text)
language sql stable security definer
set search_path=pg_catalog,public,auth
as $$
  select u.id,u.email::text from auth.users u
  where auth.uid() is not null and (
    u.id=auth.uid() or public.is_finance_owner()
    or exists(select 1 from public.finance_access_lab_grants g
      where g.owner_user_id=u.id and g.member_user_id=auth.uid())
  );
$$;
revoke all on function public.finance_access_lab_directory() from public,anon;
grant execute on function public.finance_access_lab_directory() to authenticated;

commit;
