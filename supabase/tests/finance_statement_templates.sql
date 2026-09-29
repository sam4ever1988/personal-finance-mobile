begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','a8b3c116-be0f-4e2c-9d9a-04643c18b689',true);
insert into public.finance_statement_templates(name,file_type,mapping_config)
values ('Regression Test Template','CSV','{"headerRow":1,"dataStartRow":2,"date":"A","description":"B","amount":"C"}');
do $$ begin
 if not exists(select 1 from public.finance_statement_templates where name='Regression Test Template' and new_until=created_at+interval '2 months') then raise exception 'Admin publish or expiry failed'; end if;
 begin
 insert into public.finance_statement_templates(name,file_type,mapping_config) values ('Private 1234','CSV','{"headerRow":1,"dataStartRow":2,"date":"A","description":"B","amount":"C"}');
 raise exception 'Card number accepted';
 exception when check_violation then null; end;
 begin
 insert into public.finance_statement_templates(name,file_type,mapping_config) values ('Unsafe Mapping','CSV','{"headerRow":1,"dataStartRow":2,"date":"A","description":"B","amount":"C","accountId":"private-id"}');
 raise exception 'Account link accepted';
 exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub','dbb5bff2-05ee-4a6f-849d-ecffebefd20d',true);
do $$ declare affected integer; begin
 if not exists(select 1 from public.finance_statement_templates where name='Regression Test Template') then raise exception 'User cannot see default template'; end if;
 begin
 insert into public.finance_statement_templates(name,file_type,mapping_config) values ('Unauthorized','CSV','{"headerRow":1,"dataStartRow":2,"date":"A","description":"B","amount":"C"}');
 raise exception 'User published shared template';
 exception when insufficient_privilege then null; end;
 update public.finance_statement_templates set name='Tampered' where name='Regression Test Template';
 get diagnostics affected=row_count; if affected<>0 then raise exception 'User edited shared template'; end if;
 delete from public.finance_statement_templates where name='Regression Test Template';
 get diagnostics affected=row_count; if affected<>0 then raise exception 'User deleted shared template'; end if;
end $$;
reset role;
do $$ begin
 if has_table_privilege('anon','public.finance_statement_templates','SELECT') then raise exception 'Anonymous template access'; end if;
end $$;
rollback;
select 'PASS: admin publish, user read-only, safe fields and two-month expiry' as result;