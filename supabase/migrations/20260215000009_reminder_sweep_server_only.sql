-- ═══════════════════════════════════════════════════════════════════════════
-- StatLab · reminder_sweep() becomes SERVER-ONLY
--
-- The reminder sweep generates platform-wide notification rows (24h / 1h
-- consultation reminders). It was previously invoked from the frontend on
-- every page load; anonymous visitors have no EXECUTE grant, so each public
-- page load produced a silent permission failure.
--
-- This is not a browser responsibility. This migration:
--   1. revokes EXECUTE from every PostgREST-facing role (anon / authenticated
--      / public), so no client — anonymous or logged-in — can trigger a
--      global reminder generation;
--   2. keeps the function callable by the database owner / superuser roles,
--      which is how pg_cron executes jobs;
--   3. documents the exact cron wiring to enable later.
--
-- The reminder logic itself (dedupe keys in notifications, skip-cancelled
-- appointments, settings.reminder_hours) is unchanged.
--
-- ── REQUIRED CRON SETUP (run once, in the SQL editor, when ready) ─────────
--
--   select cron.schedule(
--     'statlab-reminder-sweep',        -- job name
--     '*/15 * * * *',                  -- every 15 minutes
--     $$ select public.reminder_sweep(); $$
--   );
--
--   pg_cron runs jobs as the postgres role (superuser), which is NOT subject
--   to the revokes below. To remove the job later:
--
--   select cron.unschedule('statlab-reminder-sweep');
--
-- Reminder cadence is configurable in public.settings.reminder_hours and the
-- function stays idempotent via notifications.dedupe_key, so frequent cron
-- runs never produce duplicate reminders.
-- ═══════════════════════════════════════════════════════════════════════════

revoke execute on function public.reminder_sweep() from anon;
revoke execute on function public.reminder_sweep() from authenticated;
revoke execute on function public.reminder_sweep() from public;
