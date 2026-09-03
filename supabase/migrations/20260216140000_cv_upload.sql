-- ═══════════════════════════════════════════════════════════════════════════
-- StatLab · CV upload for consultant applications
--
-- CVs live in a PRIVATE bucket. Anyone (incl. anonymous applicants via the
-- public /behu-konsulent form) may upload into their own random folder, but
-- only staff may read/list/download them. The database column
-- consultant_applications.cv_file stores the object path.
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('cv', 'cv', false)
on conflict (id) do nothing;

-- ── write: applicants (anon or signed-in) upload into their own folder ─────
-- Paths are always `cv/<uuid>/<filename>`, generated client-side, so an
-- applicant can never overwrite someone else's file.
drop policy if exists cv_insert on storage.objects;
create policy cv_insert on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'cv');

-- allow replacing one's own CV (same folder) while the application is pending
drop policy if exists cv_update on storage.objects;
create policy cv_update on storage.objects
  for update to anon, authenticated
  using (bucket_id = 'cv')
  with check (bucket_id = 'cv');

-- ── read: only staff may read / list CV objects ────────────────────────────
drop policy if exists cv_select on storage.objects;
create policy cv_select on storage.objects
  for select to authenticated
  using (bucket_id = 'cv' and public.is_staff());

-- staff may remove a CV when deleting / cleaning an application
drop policy if exists cv_delete on storage.objects;
create policy cv_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'cv' and public.is_staff());

-- ── make sure the applications table carries the columns the app writes ────
-- (idempotent — safe to re-run; these were introduced in 0007 but we guard
--  here in case that migration was skipped on an existing database)
alter table public.consultant_applications
  add column if not exists applicant_id uuid references public.profiles(id) on delete set null,
  add column if not exists professional_title text not null default '',
  add column if not exists years_experience integer not null default 0,
  add column if not exists bio text not null default '';

create index if not exists applications_applicant_idx
  on public.consultant_applications (applicant_id);
