-- ═══════════════════════════════════════════════════════════════════════════
-- StatLab · Row Level Security — authorization lives at the database level
-- ═══════════════════════════════════════════════════════════════════════════

-- ── role helpers (SECURITY DEFINER to avoid recursive RLS) ─────────────────
create or replace function public.is_staff()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'super_admin')
  );
$$;

create or replace function public.my_role()
returns text language sql security definer stable as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    'anon'
  );
$$;

create or replace function public.my_consultant_id()
returns uuid language sql security definer stable as $$
  select id from public.consultants where user_id = auth.uid() limit 1;
$$;

create or replace function public.can_access_project(p uuid)
returns boolean language sql security definer stable as $$
  select public.is_staff()
    or exists (select 1 from public.projects where id = p and client_id = auth.uid())
    or (public.my_consultant_id() is not null and (
         exists (select 1 from public.projects where id = p and primary_consultant_id = public.my_consultant_id())
      or exists (select 1 from public.project_consultants where project_id = p and consultant_id = public.my_consultant_id())
    ));
$$;

grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.my_role() to anon, authenticated;
grant execute on function public.my_consultant_id() to anon, authenticated;
grant execute on function public.can_access_project(uuid) to anon, authenticated;

-- ── profile provisioning: auth user → profile row ──────────────────────────
create or replace function public.tg_auth_user_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, user_id, email, full_name, role, preferred_language)
  values (
    new.id,
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when new.raw_user_meta_data ->> 'role' in ('admin','super_admin','consultant','client')
         then new.raw_user_meta_data ->> 'role' else 'client' end,
    'sq'
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger auth_user_created after insert on auth.users
  for each row execute function public.tg_auth_user_created();

-- ── review rating recalculation ────────────────────────────────────────────
create or replace function public.tg_review_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  cid := coalesce(new.consultant_id, old.consultant_id);
  update public.consultants c set
    rating = coalesce((select round(avg(rating)::numeric, 2) from public.reviews
                       where consultant_id = cid and status = 'published' and consent_to_publish), 0),
    review_count = (select count(*) from public.reviews
                    where consultant_id = cid and status = 'published' and consent_to_publish)
  where c.id = cid;
  return null;
end $$;

create trigger review_rating after insert or update or delete on public.reviews
  for each row execute function public.tg_review_rating();

-- ═══ enable RLS everywhere ══════════════════════════════════════════════════
alter table public.profiles enable row level security;
alter table public.consultants enable row level security;
alter table public.consultant_terms enable row level security;
alter table public.services enable row level security;
alter table public.consultant_services enable row level security;
alter table public.weekly_availability enable row level security;
alter table public.blocked_periods enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_history enable row level security;
alter table public.projects enable row level security;
alter table public.project_consultants enable row level security;
alter table public.analysis_tasks enable row level security;
alter table public.project_notes enable row level security;
alter table public.project_files enable row level security;
alter table public.payments enable row level security;
alter table public.invoices enable row level security;
alter table public.reviews enable row level security;
alter table public.waitlist enable row level security;
alter table public.consultant_applications enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_log enable row level security;
alter table public.consents enable row level security;
alter table public.intake_templates enable row level security;
alter table public.settings enable row level security;

-- ── profiles ────────────────────────────────────────────────────────────────
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid()
  or public.is_staff()
  -- a consultant may see clients they actually work with
  or (public.my_consultant_id() is not null and (
       exists (select 1 from public.appointments a where a.client_id = profiles.id and a.consultant_id = public.my_consultant_id())
    or exists (select 1 from public.projects p where p.client_id = profiles.id and p.primary_consultant_id = public.my_consultant_id())
  ))
);
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid() or public.is_staff());

-- ── consultants (no sensitive columns; commission lives in consultant_terms) ─
create policy consultants_select on public.consultants for select to anon, authenticated using (true);
create policy consultants_insert on public.consultants for insert to authenticated with check (public.is_staff());
create policy consultants_update on public.consultants for update to authenticated
  using (public.is_staff() or user_id = auth.uid());

create policy terms_select on public.consultant_terms for select to authenticated
  using (public.is_staff() or consultant_id = public.my_consultant_id());
create policy terms_write on public.consultant_terms for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ── services & offers (public catalogue) ───────────────────────────────────
create policy services_select on public.services for select to anon, authenticated using (true);
create policy services_write on public.services for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy cs_select on public.consultant_services for select to anon, authenticated using (true);
create policy cs_write on public.consultant_services for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ── availability (working hours are public; blocked periods are private) ───
create policy avail_select on public.weekly_availability for select to anon, authenticated using (true);
create policy avail_write on public.weekly_availability for all to authenticated
  using (public.is_staff() or consultant_id = public.my_consultant_id())
  with check (public.is_staff() or consultant_id = public.my_consultant_id());
create policy blocks_select on public.blocked_periods for select to authenticated
  using (public.is_staff() or consultant_id = public.my_consultant_id());
create policy blocks_write on public.blocked_periods for all to authenticated
  using (public.is_staff() or consultant_id = public.my_consultant_id())
  with check (public.is_staff() or consultant_id = public.my_consultant_id());

-- ── appointments: never insertable directly (only via book_appointment RPC) ─
create policy appt_select on public.appointments for select to authenticated using (
  public.is_staff()
  or client_id = auth.uid()
  or consultant_id = public.my_consultant_id()
);
create policy appt_update on public.appointments for update to authenticated using (public.is_staff());
-- no insert / delete policies: booking mutations go through SECURITY DEFINER functions

create policy appt_history_select on public.appointment_history for select to authenticated using (
  public.is_staff()
  or exists (select 1 from public.appointments a where a.id = appointment_id
             and (a.client_id = auth.uid() or a.consultant_id = public.my_consultant_id()))
);

-- ── projects ────────────────────────────────────────────────────────────────
create policy projects_select on public.projects for select to authenticated using (public.can_access_project(id));
create policy projects_insert on public.projects for insert to authenticated with check (public.is_staff());
create policy projects_update on public.projects for update to authenticated
  using (public.is_staff() or primary_consultant_id = public.my_consultant_id());

create policy pc_select on public.project_consultants for select to authenticated using (public.can_access_project(project_id));
create policy pc_write on public.project_consultants for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy tasks_select on public.analysis_tasks for select to authenticated using (public.can_access_project(project_id));
create policy tasks_write on public.analysis_tasks for all to authenticated
  using (public.can_access_project(project_id)) with check (public.can_access_project(project_id));

create policy notes_select on public.project_notes for select to authenticated using (public.can_access_project(project_id));
create policy notes_insert on public.project_notes for insert to authenticated
  with check (public.can_access_project(project_id));

-- ── files ───────────────────────────────────────────────────────────────────
create policy files_select on public.project_files for select to authenticated using (
  public.is_staff()
  or client_id = auth.uid()
  or uploaded_by = auth.uid()
  or (project_id is not null and public.can_access_project(project_id))
);
create policy files_insert on public.project_files for insert to authenticated with check (
  uploaded_by = auth.uid()
  and (client_id = auth.uid() or (project_id is not null and public.can_access_project(project_id)))
);
create policy files_delete on public.project_files for delete to authenticated
  using (public.is_staff() or uploaded_by = auth.uid() or client_id = auth.uid());

-- ── payments & invoices ─────────────────────────────────────────────────────
create policy payments_select on public.payments for select to authenticated using (
  public.is_staff() or client_id = auth.uid() or consultant_id = public.my_consultant_id()
);
create policy payments_write on public.payments for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy invoices_select on public.invoices for select to authenticated using (
  public.is_staff() or client_id = auth.uid()
);
create policy invoices_write on public.invoices for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ── reviews ─────────────────────────────────────────────────────────────────
create policy reviews_select on public.reviews for select to anon, authenticated using (
  (status = 'published' and consent_to_publish)
  or (auth.uid() is not null and (
       public.is_staff()
    or client_id = auth.uid()
    or consultant_id = public.my_consultant_id()
  ))
);
-- only a client with a completed appointment may review (verified reviews)
create policy reviews_insert on public.reviews for insert to authenticated with check (
  client_id = auth.uid()
  and exists (select 1 from public.appointments a
              where a.id = appointment_id and a.client_id = auth.uid() and a.status = 'completed')
);
create policy reviews_update on public.reviews for update to authenticated using (public.is_staff());

-- ── waitlist & applications ─────────────────────────────────────────────────
create policy waitlist_select on public.waitlist for select to anon, authenticated using (
  public.is_staff() or profile_id = auth.uid() or (auth.uid() is null and false)
);
create policy waitlist_insert on public.waitlist for insert to anon, authenticated with check (true);
create policy waitlist_update on public.waitlist for update to authenticated using (public.is_staff());

create policy applications_insert on public.consultant_applications for insert to anon, authenticated with check (true);
create policy applications_select on public.consultant_applications for select to authenticated using (public.is_staff());
create policy applications_update on public.consultant_applications for update to authenticated using (public.is_staff());

-- ── notifications, activity, consents ──────────────────────────────────────
create policy notif_select on public.notifications for select to authenticated using (
  public.is_staff() or recipient_id = auth.uid()
);
create policy notif_update on public.notifications for update to authenticated using (
  public.is_staff() or recipient_id = auth.uid()
);
-- inserts happen inside SECURITY DEFINER functions only

create policy activity_select on public.activity_log for select to authenticated using (public.is_staff());
-- no insert/update/delete policies — written via log_activity()

create policy consents_select on public.consents for select to authenticated using (user_id = auth.uid() or public.is_staff());
create policy consents_insert on public.consents for insert to authenticated with check (user_id = auth.uid());

-- ── intake templates & settings (public read, staff write) ─────────────────
create policy intake_select on public.intake_templates for select to anon, authenticated using (true);
create policy intake_write on public.intake_templates for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy settings_select on public.settings for select to anon, authenticated using (true);
create policy settings_update on public.settings for update to authenticated using (public.is_staff());

-- ── storage policies (private bucket, project-scoped) ──────────────────────
create policy files_storage_read on storage.objects for select to authenticated using (
  bucket_id = 'project-files'
  and (public.is_staff()
    or public.can_access_project(((storage.foldername(name))[1])::uuid)
    or (storage.foldername(name))[1] = auth.uid()::text)
);
create policy files_storage_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'project-files'
  and ((storage.foldername(name))[1] = auth.uid()::text
    or public.can_access_project(((storage.foldername(name))[1])::uuid))
);
create policy files_storage_delete on storage.objects for delete to authenticated using (
  bucket_id = 'project-files'
  and (public.is_staff()
    or public.can_access_project(((storage.foldername(name))[1])::uuid)
    or (storage.foldername(name))[1] = auth.uid()::text)
);
