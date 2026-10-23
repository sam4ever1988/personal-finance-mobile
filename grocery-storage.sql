create table if not exists public.finance_grocery_state (
 user_id uuid not null references auth.users(id) on delete cascade,
 workspace_id text not null,
 payload jsonb not null default '{}'::jsonb check (octet_length(payload::text)<=4000000),
 revision integer not null default 1,
 updated_at timestamptz not null default now(),
 primary key(user_id,workspace_id)
);
alter table public.finance_grocery_state enable row level security;
revoke all on public.finance_grocery_state from anon;
grant select,insert,update,delete on public.finance_grocery_state to authenticated;
create policy grocery_private_owner on public.finance_grocery_state for all to authenticated
 using ((select auth.uid())=user_id and user_id='a8b3c116-be0f-4e2c-9d9a-04643c18b689'::uuid)
 with check ((select auth.uid())=user_id and user_id='a8b3c116-be0f-4e2c-9d9a-04643c18b689'::uuid and
 (workspace_id='personal' or workspace_id in (select id::text from public.finance_workspaces where owner_user_id=(select auth.uid()))));
