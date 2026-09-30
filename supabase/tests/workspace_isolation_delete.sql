begin;
select set_config('finance.test_owner',(select owner_user_id::text from finance_owner where id=1),true);
select set_config('finance.test_other',(select id::text from auth.users where id<>(select owner_user_id from finance_owner where id=1) limit 1),true);
select set_config('finance.test_workspace',gen_random_uuid()::text,true);
insert into finance_workspaces(id,owner_user_id,display_name) values(current_setting('finance.test_workspace')::uuid,current_setting('finance.test_owner')::uuid,'Isolation test rollback');
insert into finance_user_records(user_id,section,record_id,data) values
(current_setting('finance.test_workspace')::uuid,'investments_holdings','isolation-test','{"ticker":"TEST","qty":1}'),
(current_setting('finance.test_workspace')::uuid,'rental_units','default','{"id":"default","name":"Test unit"}');
select set_config('request.jwt.claim.sub',current_setting('finance.test_other'),true);
set local role authenticated;
do $test$ begin
 if exists(select 1 from finance_user_records where user_id=current_setting('finance.test_workspace')::uuid) then raise exception 'Other user can read private workspace';end if;
 update finance_user_records set data='{}' where user_id=current_setting('finance.test_workspace')::uuid;if found then raise exception 'Other user can update';end if;
 delete from finance_workspaces where id=current_setting('finance.test_workspace')::uuid;if found then raise exception 'Other user can delete';end if;
end $test$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('finance.test_owner'),true);
set local role authenticated;
do $test$ begin
 if (select count(*) from finance_user_records where user_id=current_setting('finance.test_workspace')::uuid)<>2 then raise exception 'Owner cannot read';end if;
 delete from finance_workspaces where id=current_setting('finance.test_owner')::uuid;if found then raise exception 'Primary workspace deletion allowed';end if;
 delete from finance_workspaces where id=current_setting('finance.test_workspace')::uuid;if not found then raise exception 'Owner deletion failed';end if;
end $test$;
reset role;
do $test$ begin
 if exists(select 1 from finance_user_records where user_id=current_setting('finance.test_workspace')::uuid) then raise exception 'Workspace records not cascaded';end if;
 if exists(select 1 from finance_record_audit where workspace_user_id=current_setting('finance.test_workspace')::uuid) then raise exception 'Audit rows not cascaded';end if;
 if public.finance_template_mapping_valid('{"date":"H","description":"O","headerRow":1,"dataStartRow":2,"amount":"F","direction":"G","currency":"E","sourceCurrency":"PHP"}') is distinct from true then raise exception 'BDO mapping rejected';end if;
 if public.finance_template_mapping_valid('{"date":"H","description":"O","headerRow":1,"dataStartRow":2,"amount":"F","accountNumber":"private"}') is distinct from false then raise exception 'Private mapping accepted';end if;
end $test$;
select 'PASS: private read/update/delete denied; owner cascade including rental unit; primary protected; template currency safe' as result;
rollback;