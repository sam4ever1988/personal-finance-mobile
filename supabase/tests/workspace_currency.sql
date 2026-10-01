begin;
select set_config('request.jwt.claim.sub','a8b3c116-be0f-4e2c-9d9a-04643c18b689',true);
set local role authenticated;
do $$ declare created uuid;blocked boolean:=false;begin
 created:=public.finance_create_workspace('Currency verification (rolled back)','PHP');
 if public.finance_workspace_currency(created)<>'PHP' then raise exception 'Currency not saved';end if;
 if (select count(*) from public.finance_user_records where user_id=created)<>0 then raise exception 'New workspace inherited data';end if;
 begin update public.finance_workspaces set base_currency='USD' where id=created;exception when raise_exception then blocked:=true;end;
 if not blocked then raise exception 'Currency change was allowed';end if;
 blocked:=false;begin perform public.finance_create_workspace('Invalid currency','ZZZ');exception when raise_exception then blocked:=true;end;
 if not blocked then raise exception 'Invalid currency was accepted';end if;
 perform set_config('request.jwt.claim.sub','dbb5bff2-05ee-4a6f-849d-ecffebefd20d',true);
 blocked:=false;begin perform public.finance_workspace_currency(created);exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Unrelated user read workspace metadata';end if;
end $$;
reset role;
select not has_function_privilege('anon','public.finance_create_workspace(text,text)','execute') as anon_create_blocked,not has_function_privilege('anon','public.finance_workspace_currency(uuid)','execute') as anon_read_blocked;
rollback;
