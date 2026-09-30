CREATE OR REPLACE FUNCTION finance_private.guard_rental_unit_removal()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare actor uuid:=auth.uid(); workspace uuid; unit text; removal boolean; archive boolean;
begin
 if tg_op='DELETE' then workspace:=old.user_id;unit:=old.record_id;
  if old.section<>'rental_units' then return old;end if;
  -- A workspace cascade has already removed its parent. Individual unit guards still apply.
  if not exists(select 1 from public.finance_workspaces where id=workspace) then return old;end if;
  removal:=true;archive:=false;
 else
  if new.section<>'rental_units' then return new;end if;
  workspace:=new.user_id;unit:=new.record_id;
  archive:=coalesce((new.data->>'archived')::boolean,false);
  removal:=new.deleted_at is not null or archive;
 end if;
 if not removal then return new;end if;
 if actor is null and current_user in ('postgres','supabase_admin','service_role') then
  if tg_op='DELETE' then return old;else return new;end if;
 end if;
 if actor is null or (actor<>workspace and not exists(select 1 from public.finance_workspaces w where w.id=workspace and w.owner_user_id=actor)) then
  raise exception 'Only the workspace owner can delete or archive a rental unit' using errcode='42501';
 end if;
 if not archive and exists(select 1 from public.finance_user_records r where r.user_id=workspace and r.section in ('rental_bookings','rental_expenses','rental_blocks') and r.deleted_at is null and coalesce(r.data->>'unitId','default')=unit) then
  raise exception 'This unit has history. Archive it to preserve bookings, expenses and calendar records';
 end if;
 if not exists(select 1 from public.finance_user_records r where r.user_id=workspace and r.section='rental_units' and r.record_id<>unit and r.deleted_at is null and coalesce(r.data->>'archived','false')<>'true') then
  raise exception 'Keep at least one active unit. Create another unit first';
 end if;
 if tg_op='DELETE' then return old;else return new;end if;
end;$function$
