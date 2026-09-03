-- ═══════════════════════════════════════════════════════════════════════════
-- StatLab · Account Settings — profiles.avatar_url + avatars Storage bucket
--
-- Safe & idempotent:
--   · creates nothing that already exists (IF NOT EXISTS everywhere)
--   · never touches real users, services, settings or business data
--   · ownership enforced by auth.uid() in RLS + Storage policies
--   · role/status/user_id are write-locked for non-staff via trigger
-- ═══════════════════════════════════════════════════════════════════════════

-- ── profiles: ensure table + avatar_url column ─────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  user_id uuid,
  email text not null default '',
  full_name text not null default '',
  phone text not null default '',
  avatar_url text,
  role text not null default 'client' check (role in ('super_admin','admin','consultant','client')),
  preferred_language text not null default 'sq' check (preferred_language in ('sq','en','de')),
  status text not null default 'active' check (status in ('active','deactivated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists preferred_language text not null default 'sq';
alter table public.profiles add column if not exists phone text not null default '';

create index if not exists profiles_email_idx on public.profiles (lower(email));

-- ── guard: the real owner account must exist and stay super_admin ──────────
-- Runs before any policy/trigger work so an unexpected database state aborts
-- the whole migration (executed atomically by the Supabase CLI).
do $$
begin
  if not exists (
    select 1 from public.profiles p
    where lower(p.email) = 'rame.hajraj@unhz.eu'
      and p.role = 'super_admin'
  ) then
    raise exception
      'ABORT: super admin account rame.hajraj@unhz.eu not found with role=super_admin. '
      'Account-settings migration refuses to run until the real owner account exists.';
  end if;
end $$;

-- ── protect role/status/user_id from self-modification ─────────────────────
-- Non-staff users can update full_name / phone / avatar_url / preferred_language
-- ONLY. Any attempt to change role, status, user_id or id is rejected.
create or replace function public.tg_profile_protect()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_is_staff boolean;
begin
  select exists (
    select 1 from public.profiles where id = auth.uid() and role in ('admin','super_admin')
  ) into v_is_staff;

  if not coalesce(v_is_staff, false) then
    if new.role is distinct from old.role then
      raise exception 'Ndryshimi i rolit nuk lejohet nga cilësimet e llogarisë.';
    end if;
    if new.status is distinct from old.status then
      raise exception 'Ndryshimi i statusit nuk lejohet nga cilësimet e llogarisë.';
    end if;
    if new.user_id is distinct from old.user_id then
      raise exception 'user_id nuk mund të ndryshohet.';
    end if;
    if new.id is distinct from old.id then
      raise exception 'id nuk mund të ndryshohet.';
    end if;
    if new.email is distinct from old.email then
      raise exception 'Email ndryshohet vetëm përmes Supabase Auth.';
    end if;
  end if;

  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profile_protect on public.profiles;
create trigger profile_protect
  before update on public.profiles
  for each row execute function public.tg_profile_protect();

-- ── RLS: users manage ONLY their own profile ───────────────────────────────
-- ADDITIVE policies with unique names: Postgres OR-combines policies per
-- command, so these never narrow the existing consultant/staff visibility
-- defined by earlier migrations — they only guarantee self-access.
alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update_own_settings on public.profiles;
create policy profiles_update_own_settings on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ── Storage: private-ish "avatars" bucket, owner-scoped writes ─────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- read: avatars are public profile imagery
drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'avatars');

-- write: ONLY into your own folder  avatars/{auth.uid()}/…
drop policy if exists avatars_insert on storage.objects;
create policy avatars_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── verify the owner account is untouched after all DDL ────────────────────
do $$
begin
  if not exists (
    select 1 from public.profiles p
    where lower(p.email) = 'rame.hajraj@unhz.eu'
      and p.role = 'super_admin'
      and p.status = 'active'
  ) then
    raise exception
      'ABORT: post-check failed — rame.hajraj@unhz.eu must remain role=super_admin, status=active.';
  end if;
end $$;
