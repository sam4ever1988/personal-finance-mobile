begin;

create table if not exists public.finance_user_records (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  section text not null,
  record_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  updated_by uuid,
  constraint finance_user_records_pkey primary key (user_id, section, record_id)
);

-- Preserve the existing owner's 503 records, including tombstones and audit timestamps.
insert into public.finance_user_records
  (user_id,section,record_id,data,updated_at,deleted_at,updated_by)
select owner.owner_user_id,r.section,r.record_id,r.data,r.updated_at,r.deleted_at,r.updated_by
from public.finance_sync_records r
cross join public.finance_owner owner
where owner.id=1 and owner.owner_user_id is not null
on conflict (user_id,section,record_id) do nothing;

alter table public.finance_user_records enable row level security;
drop policy if exists finance_user_records_own on public.finance_user_records;
create policy finance_user_records_own on public.finance_user_records
  for all to authenticated
  using (user_id=(select auth.uid()))
  with check (user_id=(select auth.uid()));
grant select,insert,update,delete on public.finance_user_records to authenticated;
revoke all on public.finance_user_records from anon;

create trigger trg_touch_finance_user_record
 before insert or update on public.finance_user_records
 for each row execute function public.touch_finance_sync_record();

alter publication supabase_realtime add table public.finance_user_records;
commit;
