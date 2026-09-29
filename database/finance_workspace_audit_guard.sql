begin;

-- A deletion cascaded from auth.users should not recreate an audit row that
-- references the account being deleted. Ordinary record deletes stay audited.
create or replace function finance_private.audit_finance_record()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,auth
as $$
declare
 before_value jsonb;
 after_value jsonb;
 action text;
 subject_user uuid;
 subject_section text;
 subject_record text;
begin
 if tg_op='INSERT' then
  subject_user:=new.user_id; subject_section:=new.section; subject_record:=new.record_id;
  before_value:=null;
  after_value:=case when new.deleted_at is null then new.data else null end;
  action:='create';
 elsif tg_op='UPDATE' then
  subject_user:=new.user_id; subject_section:=new.section; subject_record:=new.record_id;
  if old.data is not distinct from new.data and old.deleted_at is not distinct from new.deleted_at then
   return new;
  end if;
  before_value:=case when old.deleted_at is null then old.data else null end;
  after_value:=case when new.deleted_at is null then new.data else null end;
  action:=case when new.deleted_at is not null then 'delete' else 'update' end;
 else
  subject_user:=old.user_id; subject_section:=old.section; subject_record:=old.record_id;
  if not exists(select 1 from public.finance_workspaces where id=subject_user) then return old; end if;
  before_value:=case when old.deleted_at is null then old.data else null end;
  after_value:=null;
  action:='delete';
 end if;
 insert into public.finance_record_audit
  (workspace_user_id,actor_user_id,section,record_id,operation,before_data,after_data)
 values (subject_user,auth.uid(),subject_section,subject_record,action,before_value,after_value);
 if tg_op='DELETE' then return old; end if;
 return new;
end;
$$;
revoke all on function finance_private.audit_finance_record() from public,anon,authenticated;

commit;
