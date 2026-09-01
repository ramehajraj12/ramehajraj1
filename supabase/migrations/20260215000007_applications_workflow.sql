-- ═══════════════════════════════════════════════════════════════════════════
-- StatLab · Real consultant application + admin approval workflow
--
-- Security model:
--   · A signup can NEVER self-assign role = 'consultant' (trigger hardening).
--   · Applicants stay role = 'client' until an admin approves their application
--     through the SECURITY DEFINER function below.
--   · Approval is a single atomic, staff-only database operation that flips the
--     profile role, creates the public consultants row and logs the activity.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── extend the applications table ──────────────────────────────────────────
alter table public.consultant_applications
  add column if not exists applicant_id uuid references public.profiles(id) on delete set null,
  add column if not exists professional_title text not null default '',
  add column if not exists years_experience integer not null default 0,
  add column if not exists bio text not null default '';

create index if not exists applications_applicant_idx
  on public.consultant_applications (applicant_id);

-- ── RLS: applicants manage their own application, staff manage all ─────────
drop policy if exists applications_insert on public.consultant_applications;
drop policy if exists applications_select on public.consultant_applications;
drop policy if exists applications_update on public.consultant_applications;

-- anonymous submissions (public /behu-konsulent page) keep applicant_id null;
-- authenticated applicants may only link the application to themselves.
create policy applications_insert on public.consultant_applications
  for insert to anon, authenticated
  with check (applicant_id is null or applicant_id = auth.uid());

create policy applications_select on public.consultant_applications
  for select to authenticated
  using (public.is_staff() or applicant_id = auth.uid());

-- applicants may edit content only while the application is still 'submitted';
-- status transitions are performed by staff (or by the approval RPC).
create policy applications_update on public.consultant_applications
  for update to authenticated
  using (public.is_staff() or (applicant_id = auth.uid() and status = 'submitted'))
  with check (public.is_staff() or (applicant_id = auth.uid() and status = 'submitted'));

-- ── hardening: new auth users ALWAYS start as plain clients ────────────────
-- raw_user_meta_data.role is no longer honoured, so no frontend payload can
-- mint an admin / super_admin / consultant account. Role promotion happens
-- exclusively through admin-only SECURITY DEFINER functions.
create or replace function public.tg_auth_user_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, user_id, email, full_name, role, preferred_language)
  values (
    new.id,
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    'client',
    'sq'
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- ── applicant reads their own latest application ───────────────────────────
create or replace function public.my_application()
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare
  me uuid := auth.uid();
  out_ jsonb;
begin
  if me is null then raise exception 'Kërkohet kyçja.'; end if;
  select to_jsonb(a) into out_
  from public.consultant_applications a
  where a.applicant_id = me
     or (a.applicant_id is null
         and lower(a.email) = lower(coalesce((select email from profiles where id = me), '')))
  order by (a.applicant_id is not null) desc, a.created_at desc
  limit 1;
  return out_;
end $$;

grant execute on function public.my_application() to authenticated;

-- ── ADMIN APPROVAL — the only path to role = 'consultant' ──────────────────
create or replace function public.admin_approve_application(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  app public.consultant_applications%rowtype;
  prof public.profiles%rowtype;
  uid_ uuid; cid uuid; slug_ text; comm integer;
begin
  -- 1. explicit admin authorization
  if not public.is_staff() then raise exception 'Pa të drejta për këtë veprim.'; end if;

  select * into app from public.consultant_applications where id = p_id;
  if not found then raise exception 'Aplikimi nuk u gjet.'; end if;
  if app.status = 'approved' then raise exception 'Ky aplikim është aprovuar tashmë.'; end if;

  -- resolve the applicant's account (profile id == auth user id)
  uid_ := app.applicant_id;
  if uid_ is null then
    select id into uid_ from public.profiles
      where user_id is not null and lower(email) = lower(app.email) limit 1;
  end if;
  if uid_ is null then
    raise exception 'Aplikanti nuk ka llogari të lidhur. Kërkojini të regjistrohet para aprovimit.';
  end if;
  select * into prof from public.profiles where id = uid_;
  if not found then raise exception 'Profili i aplikantit nuk u gjet.'; end if;

  -- 4-6. create the public consultant row linked to the auth user (idempotent)
  select id into cid from public.consultants where user_id = prof.user_id limit 1;
  if cid is null then
    slug_ := lower(regexp_replace(app.name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(p_id::text, 1, 4);
    insert into public.consultants (
      user_id, slug, display_name, professional_title, bio, education,
      years_experience, languages, specializations, status, is_active
    ) values (
      prof.user_id, slug_, app.name, app.professional_title, app.bio,
      case when btrim(app.education) <> '' then jsonb_build_array(app.education) else '[]'::jsonb end,
      app.years_experience, app.languages, app.specializations,
      'active', true
    )
    returning id into cid;

    -- 7. default commission terms
    comm := coalesce((select default_commission from public.settings limit 1), 20);
    insert into public.consultant_terms (consultant_id, commission_percentage, payout_email)
    values (cid, comm, prof.email)
    on conflict (consultant_id) do nothing;
  end if;

  -- 2. application status
  update public.consultant_applications set status = 'approved' where id = p_id;

  -- 3. profile role (never downgrades an existing admin)
  update public.profiles set role = 'consultant'
    where id = prof.id and role not in ('admin', 'super_admin');

  perform public.notify(prof.id, prof.email, 'application_approved',
    'Aplikimi juaj u aprovua',
    'Urime! Tani keni akses të plotë në Portalin e Konsulentit dhe jeni i dukshëm në direktorinë publike.');

  -- 8. activity log
  perform public.log_activity('consultant.approved', 'consultant_application', p_id::text,
    app.name || ' (' || app.email || ')');

  return jsonb_build_object('status', 'approved', 'consultant_id', cid);
end $$;

create or replace function public.admin_reject_application(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  app public.consultant_applications%rowtype;
begin
  if not public.is_staff() then raise exception 'Pa të drejta për këtë veprim.'; end if;
  select * into app from public.consultant_applications where id = p_id;
  if not found then raise exception 'Aplikimi nuk u gjet.'; end if;

  update public.consultant_applications set status = 'rejected' where id = p_id;

  perform public.notify(app.applicant_id, app.email, 'application_rejected',
    'Aplikimi juaj u shqyrtua',
    'Fatkeqësisht aplikimi juaj për konsulent nuk u aprovua në këtë rund. Mund të aplikoni përsëri me më shumë detaje.');

  perform public.log_activity('application.rejected', 'consultant_application', p_id::text,
    app.name || ' (' || app.email || ')');

  return jsonb_build_object('status', 'rejected');
end $$;

grant execute on function public.admin_approve_application(uuid) to authenticated;
grant execute on function public.admin_reject_application(uuid) to authenticated;
