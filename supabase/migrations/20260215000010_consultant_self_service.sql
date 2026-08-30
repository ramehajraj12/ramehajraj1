-- ═══════════════════════════════════════════════════════════════════════════
-- StatLab · Consultant self-service (own appointments only)
--
-- The staff RPCs (reschedule_by_staff / cancel_by_staff) remain admin-only.
-- These dedicated functions let an approved consultant modify ONLY the
-- appointments assigned to their own consultants row:
--
--   auth.uid() → consultants.user_id → appointment.consultant_id
--
-- Rescheduling keeps every engine guarantee: advisory lock, slot_free()
-- (weekly availability − blocked periods − existing bookings − buffer −
-- duration − minimum notice), double-booking prevention via the exclusion
-- constraint, and full history/notification/audit rows.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.reschedule_by_consultant(p_id uuid, p_date date, p_start time)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a appointments%rowtype;
  actor text; arole text; cid uuid;
begin
  -- ownership: authenticated user → their consultant row
  select id into cid from public.consultants where user_id = auth.uid() limit 1;
  if cid is null then raise exception 'Pa të drejta për këtë veprim.'; end if;

  select * into a from public.appointments where id = p_id for update;
  if not found then raise exception 'Termini nuk u gjet.'; end if;
  if a.consultant_id <> cid then raise exception 'Pa të drejta për këtë termin.'; end if;
  if a.status not in ('pending', 'confirmed') then
    raise exception 'Ky termin nuk mund të rizhvendoset më.';
  end if;

  -- serialized per-consultant validation (same guarantees as the engine)
  perform pg_advisory_xact_lock(hashtext(a.consultant_id::text));
  if not public.slot_free(a.consultant_id, p_date, p_start, a.duration_minutes, a.id) then
    raise exception 'Ky termin sapo u rezervua nga një përdorues tjetër. Ju lutem zgjidhni një orar tjetër.';
  end if;

  select full_name, role into actor, arole from public.profiles where id = auth.uid();
  insert into public.appointment_history
    (appointment_id, old_date, old_start, new_date, new_start, changed_by, changed_by_role)
  values (a.id, a.date, a.start_time, p_date, p_start, actor, arole);

  update public.appointments set date = p_date, start_time = p_start where id = a.id;

  perform public.notify(a.client_id, a.client_email, 'booking_rescheduled', 'Rezervimi u rizhvendos',
    'Termini i ri: ' || to_char(p_date, 'YYYY-MM-DD') || ' në ' || to_char(p_start, 'HH24:MI') || '.', a.id);
  perform public.log_activity('appointment.rescheduled', 'appointment', a.id::text,
    to_char(a.date, 'YYYY-MM-DD') || ' → ' || to_char(p_date, 'YYYY-MM-DD') || ' (konsulent)');

  return jsonb_build_object('date', to_char(p_date, 'YYYY-MM-DD'), 'start_time', to_char(p_start, 'HH24:MI'));
end $$;

create or replace function public.cancel_by_consultant(p_id uuid, p_reason text default '')
returns void language plpgsql security definer set search_path = public as $$
declare
  a appointments%rowtype;
  cid uuid;
begin
  select id into cid from public.consultants where user_id = auth.uid() limit 1;
  if cid is null then raise exception 'Pa të drejta për këtë veprim.'; end if;

  select * into a from public.appointments where id = p_id for update;
  if not found then raise exception 'Termini nuk u gjet.'; end if;
  if a.consultant_id <> cid then raise exception 'Pa të drejta për këtë termin.'; end if;
  if a.status not in ('pending', 'confirmed') then
    raise exception 'Ky termin nuk mund të anulohet më.';
  end if;

  -- keep the record; only flip status + append the reason
  update public.appointments set status = 'cancelled',
    internal_notes = internal_notes || case when p_reason <> '' then E'\nArsyeja e anulimit: ' || p_reason else '' end
    where id = a.id;

  perform public.notify(a.client_id, a.client_email, 'booking_cancelled', 'Rezervimi u anulua',
    'Referenca: ' || a.reference || '.', a.id);
  perform public.log_activity('appointment.cancelled', 'appointment', a.id::text,
    a.reference || ' (konsulent)');

  update public.waitlist set has_match = true where status = 'waiting' and service_id = a.service_id
    and (consultant_id is null or consultant_id = a.consultant_id);
end $$;

grant execute on function public.reschedule_by_consultant(uuid, date, time) to authenticated;
grant execute on function public.cancel_by_consultant(uuid, text) to authenticated;
