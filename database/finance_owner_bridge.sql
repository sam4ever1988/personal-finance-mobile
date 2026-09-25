-- Keep the existing owner's older open browser tabs and the per-user table in sync.
-- The bridge applies only to the original owner; other users never enter legacy storage.
begin;
create or replace function public.mirror_legacy_finance_record() returns trigger
language plpgsql security invoker set search_path = public
as $$
declare owner_id uuid;
begin
  if pg_trigger_depth()>1 then return new; end if;
  select owner_user_id into owner_id from public.finance_owner where id=1;
  if owner_id is null or auth.uid() is distinct from owner_id then return new; end if;
  insert into public.finance_user_records(user_id,section,record_id,data,deleted_at)
  values(owner_id,new.section,new.record_id,new.data,new.deleted_at)
  on conflict (user_id,section,record_id) do update
    set data=excluded.data,deleted_at=excluded.deleted_at;
  return new;
end $$;
create or replace function public.mirror_owner_user_record() returns trigger
language plpgsql security invoker set search_path = public
as $$
begin
  if pg_trigger_depth()>1 or new.user_id is distinct from
     (select owner_user_id from public.finance_owner where id=1) then return new; end if;
  insert into public.finance_sync_records(section,record_id,data,deleted_at)
  values(new.section,new.record_id,new.data,new.deleted_at)
  on conflict (section,record_id) do update
    set data=excluded.data,deleted_at=excluded.deleted_at;
  return new;
end $$;
revoke all on function public.mirror_legacy_finance_record() from public,anon,authenticated;
revoke all on function public.mirror_owner_user_record() from public,anon,authenticated;
create trigger mirror_legacy_finance_record after insert or update on public.finance_sync_records
 for each row execute function public.mirror_legacy_finance_record();
create trigger mirror_owner_user_record after insert or update on public.finance_user_records
 for each row execute function public.mirror_owner_user_record();
-- Pick up owner edits since the initial copy. Historical rows are retained in both stores.
insert into public.finance_user_records(user_id,section,record_id,data,updated_at,deleted_at,updated_by)
select owner.owner_user_id,r.section,r.record_id,r.data,r.updated_at,r.deleted_at,r.updated_by
from public.finance_sync_records r cross join public.finance_owner owner
where owner.id=1 and owner.owner_user_id is not null
on conflict (user_id,section,record_id) do update
set data=excluded.data,deleted_at=excluded.deleted_at
where public.finance_user_records.updated_at<excluded.updated_at;
commit;
