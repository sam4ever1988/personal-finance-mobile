-- Grants identify a workspace, including additional workspaces, rather than an Auth user.
alter table public.finance_workspace_grants drop constraint finance_workspace_grants_owner_user_id_fkey;
alter table public.finance_workspace_grants add constraint finance_workspace_grants_owner_user_id_fkey foreign key(owner_user_id) references public.finance_workspaces(id) on delete cascade;

-- Permissions are server-held invitation data, never authorization metadata.
alter table public.finance_user_invitations
 add column if not exists invitation_type text not null default 'system' check (invitation_type in ('system','shared')),
 add column if not exists workspace_id uuid references public.finance_workspaces(id) on delete cascade,
 add column if not exists workspace_name text,
 add column if not exists page_permissions jsonb not null default '{}'::jsonb,
 add column if not exists inviter_name text,
 add column if not exists access_applied_at timestamptz;

create or replace function finance_private.apply_accepted_invitation_access()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare administrator uuid; grant_page text; grant_permission text; own_permission text;
begin
 if new.status<>'accepted' or new.invitation_type<>'shared' or new.access_applied_at is not null then return new; end if;
 if new.invited_user_id is null or new.invited_user_id=new.sender_user_id then raise exception 'Invalid invitation recipient'; end if;
 if not exists(select 1 from auth.users u where u.id=new.invited_user_id and lower(u.email)=lower(new.email) and (u.email_confirmed_at is not null or u.last_sign_in_at is not null)) then raise exception 'Invitation must be accepted by its recipient'; end if;
 if not exists(select 1 from public.finance_workspaces w where w.id=new.workspace_id and w.owner_user_id=new.sender_user_id) then raise exception 'Only the workspace owner may share access'; end if;
 select owner_user_id into administrator from public.finance_owner where id=1;
 if new.invited_user_id=administrator then raise exception 'Administrator cannot access a private workspace'; end if;
 if jsonb_typeof(new.page_permissions)<>'object' or new.page_permissions='{}'::jsonb then raise exception 'Choose page access'; end if;
 for grant_page,grant_permission in select key,value from jsonb_each_text(new.page_permissions) loop
  if grant_page not in ('executive','accounts','financialposition','strategy','transactions','incomeplan','outgoings','installments','importstatements','investments','assets','rental','reports','financeSettings') or grant_permission not in ('view','edit') then raise exception 'Invalid page access'; end if;
  select permission into own_permission from public.finance_page_access where user_id=new.sender_user_id and page=grant_page;
  if new.sender_user_id<>administrator and not (coalesce(own_permission,'off')='edit' or (coalesce(own_permission,'off')='view' and grant_permission='view')) then new.error_message='Shared access was not applied because the sender no longer has permission.'; return new; end if;
 end loop;
 for grant_page,grant_permission in select key,value from jsonb_each_text(new.page_permissions) loop
  insert into public.finance_workspace_grants(owner_user_id,member_user_id,page,permission,granted_by)
   values(new.workspace_id,new.invited_user_id,grant_page,grant_permission,new.sender_user_id)
   on conflict(owner_user_id,member_user_id,page) do update set permission=excluded.permission,granted_by=excluded.granted_by,granted_at=now();
 end loop;
 new.access_applied_at=now();
 return new;
end;$$;
revoke all on function finance_private.apply_accepted_invitation_access() from public,anon,authenticated;
create trigger finance_invitation_apply_access before insert or update on public.finance_user_invitations
 for each row execute function finance_private.apply_accepted_invitation_access();
