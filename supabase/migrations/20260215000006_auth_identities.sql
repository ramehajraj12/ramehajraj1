-- ═══════════════════════════════════════════════════════════════════════════
-- StatLab · auth identities for directly-inserted auth.users rows
--
-- GoTrue creates an auth.identities row for normal sign-ups, but accounts
-- provisioned inside SECURITY DEFINER functions (book_appointment guest
-- clients, admin_create_consultant) bypass GoTrue. Without an identity row
-- those users cannot sign in with their generated password.
-- This trigger provisions the email identity idempotently for every new
-- auth user (no-op for GoTrue-managed sign-ups, which already have one).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.tg_auth_identity_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  select gen_random_uuid(), new.id,
         jsonb_build_object('sub', new.id::text, 'email', new.email),
         'email', new.id::text, now(), now(), now()
  where coalesce(new.raw_app_meta_data ->> 'provider', 'email') = 'email'
    and not exists (
      select 1 from auth.identities i where i.user_id = new.id and i.provider = 'email'
    );
  return new;
end $$;

drop trigger if exists auth_identity_created on auth.users;
create trigger auth_identity_created after insert on auth.users
  for each row execute function public.tg_auth_identity_created();

-- backfill for any rows already created before this migration
insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email),
       'email', u.id::text, now(), now(), now()
from auth.users u
where not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');
