begin;

create or replace function public.finance_share_my_workspace(
 target_email text, target_page text, access_level text
)
returns boolean language plpgsql security definer
set search_path=pg_catalog,public,auth
as $$
declare
 actor uuid := auth.uid();
 recipient uuid;
 administrator uuid;
 own_permission text;
begin
 if actor is null then raise exception 'Sign in first'; end if;
 if target_page not in ('accounts','transactions','incomeplan','outgoings','installments',
  'importstatements','investments','assets','rental','financeSettings')
  or access_level not in ('view','edit','off') then
  raise exception 'Invalid page or permission';
 end if;
 select id into recipient from auth.users where lower(email)=lower(btrim(target_email)) limit 1;
 select owner_user_id into administrator from public.finance_owner where id=1;
 if recipient is null then raise exception 'Registered user not found'; end if;
 if recipient=actor then raise exception 'Choose another user'; end if;
 if recipient=administrator then raise exception 'Administrator cannot access a private workspace'; end if;
 select permission into own_permission from public.finance_page_access
  where user_id=actor and page=target_page;
 if actor<>administrator and coalesce(own_permission,'off')='off' then
  raise exception 'Your account cannot share this page';
 end if;
 if access_level='off' then
  delete from public.finance_workspace_grants
   where owner_user_id=actor and member_user_id=recipient and page=target_page;
 else
  insert into public.finance_workspace_grants
   (owner_user_id,member_user_id,page,permission,granted_by)
  values (actor,recipient,target_page,access_level,actor)
  on conflict (owner_user_id,member_user_id,page) do update
   set permission=excluded.permission,granted_by=excluded.granted_by,granted_at=now();
 end if;
 return true;
end;
$$;
revoke all on function public.finance_share_my_workspace(text,text,text) from public,anon;
grant execute on function public.finance_share_my_workspace(text,text,text) to authenticated;

commit;
