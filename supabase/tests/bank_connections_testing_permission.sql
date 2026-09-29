begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','a8b3c116-be0f-4e2c-9d9a-04643c18b689',true);
insert into public.finance_page_access(user_id,page,permission) values ('dbb5bff2-05ee-4a6f-849d-ecffebefd20d','bankconnections','edit')
on conflict(user_id,page) do update set permission='edit';
select set_config('request.jwt.claim.sub','dbb5bff2-05ee-4a6f-849d-ecffebefd20d',true);
do $$ declare affected integer; begin
 if not exists(select 1 from public.finance_page_access where user_id=auth.uid() and page='bankconnections' and permission='edit') then raise exception 'Tester cannot read admin grant'; end if;
 update public.finance_page_access set permission='view' where user_id=auth.uid() and page='bankconnections';
 get diagnostics affected=row_count; if affected<>0 then raise exception 'Tester changed admin grant'; end if;
 begin
 insert into public.finance_page_access(user_id,page,permission) values(auth.uid(),'bankconnections','edit') on conflict(user_id,page) do update set permission='edit';
 raise exception 'Tester self granted access';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','a8b3c116-be0f-4e2c-9d9a-04643c18b689',true);
update public.finance_page_access set permission='off' where user_id='dbb5bff2-05ee-4a6f-849d-ecffebefd20d' and page='bankconnections';
select set_config('request.jwt.claim.sub','dbb5bff2-05ee-4a6f-849d-ecffebefd20d',true);
do $$ begin
 if not exists(select 1 from public.finance_page_access where user_id=auth.uid() and page='bankconnections' and permission='off') then raise exception 'Admin revoke failed'; end if;
end $$;
rollback;
select 'PASS: admin grant/revoke, tester read, self-grant blocked' as result;