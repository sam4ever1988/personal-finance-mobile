alter table public.finance_user_invitations drop constraint finance_user_invitations_status_check;
alter table public.finance_user_invitations add constraint finance_user_invitations_status_check check(status in ('sending','sent','accepted','failed','cancelled'));
alter table public.finance_user_invitations add column cancelled_at timestamptz;

create or replace function public.finance_cancel_invitation(invitation_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare invitation public.finance_user_invitations; recipient auth.users;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 select * into invitation from public.finance_user_invitations where id=invitation_id and sender_user_id=auth.uid();
 if not found then raise exception 'Invitation not found'; end if;
 if invitation.status='cancelled' then return jsonb_build_object('cancelled',true); end if;
 if invitation.status<>'sent' or invitation.invited_user_id is null then raise exception 'Only invitations awaiting acceptance can be cancelled'; end if;
 -- Auth acceptance locks the user before its invitation tracking trigger. Match that order.
 select * into recipient from auth.users where id=invitation.invited_user_id for update;
 select * into invitation from public.finance_user_invitations where id=invitation_id and sender_user_id=auth.uid() for update;
 if invitation.status='cancelled' then return jsonb_build_object('cancelled',true); end if;
 if invitation.status<>'sent' or recipient.email_confirmed_at is not null or recipient.last_sign_in_at is not null then raise exception 'This invitation has already been accepted'; end if;
 if lower(recipient.email)<>lower(invitation.email) or recipient.invited_at is null then raise exception 'Cannot revoke this invitation'; end if;
 if exists(select 1 from public.finance_user_invitations where invited_user_id=recipient.id and id<>invitation_id and status in ('sending','sent')) then raise exception 'Another invitation for this recipient is pending; cancellation cannot safely revoke its link'; end if;
 -- Invalidate both legacy and indexed confirmation-token lookup paths, never delete the account.
 update auth.users set confirmation_token='',confirmation_sent_at=null,updated_at=now() where id=recipient.id;
 delete from auth.one_time_tokens where user_id=recipient.id and token_type='confirmation_token';
 update public.finance_user_invitations set status='cancelled',cancelled_at=now() where id=invitation_id;
 return jsonb_build_object('cancelled',true);
end;$$;
revoke all on function public.finance_cancel_invitation(uuid) from public,anon;
grant execute on function public.finance_cancel_invitation(uuid) to authenticated;

-- Reject an acceptance that had read the token immediately before cancellation acquired its lock.
create or replace function finance_private.reject_cancelled_invitation_acceptance()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,auth as $$
begin
 if old.email_confirmed_at is null and new.email_confirmed_at is not null
 and coalesce(old.confirmation_token,'')=''
 and exists(select 1 from public.finance_user_invitations where invited_user_id=old.id and status='cancelled')
 and not exists(select 1 from public.finance_user_invitations where invited_user_id=old.id and status in ('sending','sent'))
 then raise exception 'Invitation is no longer valid'; end if;
 return new;
end;$$;
revoke all on function finance_private.reject_cancelled_invitation_acceptance() from public,anon,authenticated;
create trigger finance_reject_cancelled_invitation before update of email_confirmed_at on auth.users for each row execute function finance_private.reject_cancelled_invitation_acceptance();
