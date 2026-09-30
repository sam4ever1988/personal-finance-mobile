-- Invitation audit and owner-only unit removal. Financial records are unchanged.
create table if not exists public.finance_user_invitations (
 id uuid primary key default gen_random_uuid(),
 sender_user_id uuid not null references auth.users(id) on delete cascade,
 email text not null check (char_length(email) <= 254),
 invited_user_id uuid references auth.users(id) on delete set null,
 status text not null default 'sending' check (status in ('sending','sent','accepted','failed')),
 created_at timestamptz not null default now(),
 sent_at timestamptz, accepted_at timestamptz, error_message text
);
create index if not exists finance_invitations_sender_date on public.finance_user_invitations(sender_user_id,created_at desc);
create index if not exists finance_invitations_recipient on public.finance_user_invitations(invited_user_id);
create unique index if not exists finance_invitation_pending_unique on public.finance_user_invitations(sender_user_id,email) where status in ('sending','sent');
alter table public.finance_user_invitations enable row level security;
revoke all on public.finance_user_invitations from anon,authenticated;
grant select on public.finance_user_invitations to authenticated;
grant all on public.finance_user_invitations to service_role;
create policy finance_invitation_history_read on public.finance_user_invitations for select to authenticated
 using (sender_user_id=(select auth.uid()) or public.is_finance_owner());

create or replace function finance_private.track_invitation_acceptance()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,auth as $$
begin
 if new.email_confirmed_at is not null or new.last_sign_in_at is not null then
  update public.finance_user_invitations set status='accepted',accepted_at=coalesce(accepted_at,new.email_confirmed_at,new.last_sign_in_at)
  where invited_user_id=new.id and status in ('sending','sent');
 end if;
 return new;
end;$$;
revoke all on function finance_private.track_invitation_acceptance() from public,anon,authenticated;
create trigger finance_invitation_accepted after update of email_confirmed_at,last_sign_in_at on auth.users
 for each row execute function finance_private.track_invitation_acceptance();
-- Retain invitations sent before tracking was introduced; use actual Auth dates.
insert into public.finance_user_invitations(sender_user_id,email,invited_user_id,status,created_at,sent_at,accepted_at)
 select o.owner_user_id,lower(u.email),u.id,
 case when u.email_confirmed_at is not null or u.last_sign_in_at is not null then 'accepted' else 'sent' end,
 u.invited_at,u.invited_at,coalesce(u.email_confirmed_at,u.last_sign_in_at)
 from auth.users u cross join public.finance_owner o
 where o.id=1 and u.invited_at is not null and u.email is not null
 and not exists (select 1 from public.finance_user_invitations i where i.invited_user_id=u.id);

create or replace function finance_private.guard_rental_unit_removal()
returns trigger language plpgsql security invoker set search_path=pg_catalog,public,auth as $$
declare actor uuid:=auth.uid(); workspace uuid; unit text; removal boolean; archive boolean;
begin
 if tg_op='DELETE' then workspace:=old.user_id;unit:=old.record_id;
  if old.section<>'rental_units' then return old;end if;
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
end;$$;
revoke all on function finance_private.guard_rental_unit_removal() from public,anon,authenticated;
create trigger finance_guard_rental_unit_removal before insert or update or delete on public.finance_user_records
 for each row execute function finance_private.guard_rental_unit_removal();
