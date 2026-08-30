-- ═══════════════════════════════════════════════════════════════════════════
-- StatLab · CRUD hardening — narrowly-scoped DELETE policies
--
-- Adds the only two DELETE policies that were missing. Everything else already
-- had appropriate delete coverage (tasks_write / files_delete / blocks_write /
-- avail_write / cs_write / services_write / pc_write are all "for all").
--
-- Deliberately NOT added (financial / audit records stay immutable from UI):
--   appointments, payments, invoices, activity_log, reviews (soft-delete only).
-- ═══════════════════════════════════════════════════════════════════════════

-- Project notes: the author who wrote a note, or staff, may remove it.
drop policy if exists notes_delete on public.project_notes;
create policy notes_delete on public.project_notes for delete to authenticated
  using (public.is_staff() or author_id = auth.uid());

-- Waitlist rows are operational (non-financial); only staff may remove them.
drop policy if exists waitlist_delete on public.waitlist;
create policy waitlist_delete on public.waitlist for delete to authenticated
  using (public.is_staff());
