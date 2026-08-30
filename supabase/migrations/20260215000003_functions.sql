-- ═══════════════════════════════════════════════════════════════════════════
-- StatLab · Booking engine & privileged operations (SECURITY DEFINER)
-- The frontend NEVER decides availability — these functions re-validate
-- server-side and the EXCLUDE constraint is the final race-condition guard.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── internal: is [day @ start, +dur) bookable for consultant? ──────────────
create or replace function public.slot_free(
  p_cid uuid, p_day date, p_start time, p_dur integer, p_exclude uuid default null
) returns boolean
language plpgsql security definer stable set search_path = public as $$
declare
  s settings%rowtype;
  t0 timestamp; t1 timestamp; buf interval;
begin
  select * into s from settings limit 1;
  t0 := p_day + p_start;
  t1 := t0 + make_interval(mins => p_dur);
  buf := make_interval(mins => s.buffer_minutes);

  -- booking window rules
  if t0 < (now() at time zone 'UTC') + make_interval(hours => s.min_notice_hours) then return false; end if;
  if p_day > (current_date + s.max_booking_days) then return false; end if;

  -- recurring weekly availability must fully contain the slot
  if not exists (
    select 1 from weekly_availability w
    where w.consultant_id = p_cid and w.is_available
      and w.day_of_week = extract(isodow from p_day)
      and w.start_time <= p_start
      and w.end_time >= (p_start + make_interval(mins => p_dur))
  ) then return false; end if;

  -- blocked periods (whole-day or partial, incl. date ranges)
  if exists (
    select 1 from blocked_periods b
    where b.consultant_id = p_cid
      and b.block_date <= p_day and coalesce(b.end_date, b.block_date) >= p_day
      and (b.start_time is null
           or (b.block_date + b.start_time) < t1 and (b.block_date + coalesce(b.end_time, '23:59:59'::time)) > t0)
  ) then return false; end if;

  -- existing appointments (with buffer on both sides)
  if exists (
    select 1 from appointments a
    where a.consultant_id = p_cid and a.id is distinct from p_exclude
      and a.status in ('pending','confirmed','rescheduled')
      and (a.date + a.start_time) < (t1 + buf)
      and (a.date + a.start_time + make_interval(mins => a.duration_minutes)) > (t0 - buf)
  ) then return false; end if;

  return true;
end $$;

-- ── slots for a consultant/day, stepping every 30 min ──────────────────────
create or replace function public.day_slots(p_cid uuid, p_day date, p_dur integer)
returns setof text
language plpgsql security definer stable set search_path = public as $$
declare
  w record; t time;
begin
  for w in
    select start_time, end_time from weekly_availability
    where consultant_id = p_cid and is_available and day_of_week = extract(isodow from p_day)
    order by start_time
  loop
    t := w.start_time;
    while t + make_interval(mins => p_dur) <= w.end_time loop
      if public.slot_free(p_cid, p_day, t, p_dur) then
        return next to_char(t, 'HH24:MI');
      end if;
      t := t + interval '30 minutes';
    end loop;
  end loop;
end $$;

create or replace function public.consultant_day_slots(p_cid uuid, p_day date, p_dur integer)
returns setof text language sql security definer stable set search_path = public as $$
  select public.day_slots(p_cid, p_day, p_dur);
$$;

-- ── month capacity for the booking calendar ────────────────────────────────
create or replace function public.consultant_month_capacity(p_cid uuid, p_year int, p_month int, p_dur int)
returns table(day date, cap text)
language plpgsql security definer stable set search_path = public as $$
declare d date; n int;
begin
  for d in
    select (make_date(p_year, p_month, 1) + gs)::date
    from generate_series(0, (date_trunc('month', make_date(p_year, p_month, 1)) + interval '1 month - 1 day')::date
                         - make_date(p_year, p_month, 1)) gs
  loop
    select count(*) into n from public.day_slots(p_cid, d, p_dur);
    day := d;
    cap := case when n = 0 then 'none' when n <= 2 then 'low' when n <= 5 then 'mid' else 'high' end;
    return next;
  end loop;
end $$;

-- ── first opening in the next 21 days ──────────────────────────────────────
create or replace function public.first_slot_after(p_cid uuid, p_dur integer)
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare d date; s text;
begin
  for i in 0..21 loop
    d := current_date + i;
    select x into s from public.day_slots(p_cid, d, p_dur) x limit 1;
    if s is not null then
      return jsonb_build_object('date', to_char(d, 'YYYY-MM-DD'), 'time', s);
    end if;
  end loop;
  return null;
end $$;

-- ── deterministic consultant matching (never random) ───────────────────────
create or replace function public.match_consultant(p_service uuid, p_lang text default null)
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare
  rec record; best jsonb := null; best_score numeric := -1; cat text;
begin
  select category into cat from services where id = p_service;
  for rec in
    select c.*, cs.price,
      (select count(*) from appointments a where a.consultant_id = c.id
        and a.status in ('pending','confirmed') and a.date between current_date and current_date + 14) as load
    from consultants c
    join consultant_services cs on cs.consultant_id = c.id and cs.is_active
    where cs.service_id = p_service and c.status = 'active' and c.is_active
  loop
    declare
      score numeric := 30; reasons jsonb := '["Ofron shërbimin e kërkuar"]'::jsonb; spec text;
    begin
      -- specialization fit per service category
      foreach spec in array case cat
        when 'survey' then array['Survey Design','Questionnaire Development']
        when 'thesis' then array['Bachelor Thesis Support','Master Thesis Support','PhD Research Support','Research Methodology']
        when 'methodology' then array['Research Methodology']
        when 'analysis' then array['Regression','Factor Analysis','ANOVA','Non-Parametric Statistics','Correlation']
        else array['SPSS','Statistical Interpretation','Descriptive Statistics']
      end loop
        if rec.specializations @> to_jsonb(spec) then
          score := score + 8;
          reasons := reasons || to_jsonb('Specializim: ' || spec);
          exit;
        end if;
      end foreach;
      if p_lang is not null and rec.languages @> to_jsonb(p_lang) then
        score := score + 6;
        reasons := reasons || to_jsonb('Gjuha: ' || p_lang);
      end if;
      score := score + coalesce(rec.rating, 0) * 2;
      if rec.rating >= 4.5 then reasons := reasons || to_jsonb('Vlerësim i lartë (' || rec.rating || ')'); end if;
      score := score - rec.load * 4;
      if rec.load = 0 then reasons := reasons || '["Ngarkesë e ulët javore"]'::jsonb; end if;
      if rec.is_featured then score := score + 4; end if;

      if score > best_score then
        best_score := score;
        best := jsonb_build_object('consultant_id', rec.id, 'score', score, 'reasons', reasons);
      end if;
    end;
  end loop;
  return best;
end $$;

create or replace function public.first_available_offer(p_service uuid)
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare
  rec record; fs jsonb; best jsonb := null; best_key text := '9999-99-99 99:99';
begin
  for rec in
    select distinct c.id, cs.duration_minutes
    from consultants c join consultant_services cs on cs.consultant_id = c.id and cs.is_active
    where cs.service_id = p_service and c.status = 'active' and c.is_active
    order by c.rating desc
  loop
    fs := public.first_slot_after(rec.id, rec.duration_minutes);
    if fs is not null and (fs ->> 'date') || ' ' || (fs ->> 'time') < best_key then
      best_key := (fs ->> 'date') || ' ' || (fs ->> 'time');
      best := jsonb_build_object('consultant_id', rec.id, 'date', fs ->> 'date', 'time', fs ->> 'time');
    end if;
  end loop;
  return best;
end $$;

-- ── logging / notifications helpers (definer context) ──────────────────────
create or replace function public.log_activity(
  p_action text, p_entity_type text default '', p_entity_id text default '', p_metadata text default ''
) returns void language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select id, full_name, role into p from profiles where id = auth.uid();
  insert into activity_log (actor_id, actor_name, actor_role, action, entity_type, entity_id, metadata)
  values (auth.uid(), coalesce(p.full_name, 'Sistemi'), coalesce(p.role, 'system'), p_action, p_entity_type, p_entity_id, p_metadata);
end $$;

create or replace function public.notify(
  p_recipient uuid, p_email text, p_type text, p_subject text, p_body text,
  p_appt uuid default null, p_dedupe text default null
) returns void language sql security definer set search_path = public as $$
  insert into notifications (recipient_id, recipient_email, appointment_id, type, subject, body, dedupe_key)
  values (p_recipient, p_email, p_appt, p_type, p_subject, p_body, p_dedupe)
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
$$;

create or replace function public.next_invoice_number()
returns text language sql security definer set search_path = public as $$
  select 'SPSS-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('invoice_number_seq')::text, 4, '0');
$$;

create or replace function public.gen_meet_url()
returns text language sql security definer as $$
  select 'https://meet.google.com/' || lower(substr(replace(gen_random_uuid()::text,'-',''), 1, 3))
    || '-' || lower(substr(replace(gen_random_uuid()::text,'-',''), 1, 4))
    || '-' || lower(substr(replace(gen_random_uuid()::text,'-',''), 1, 3));
$$;

create or replace function public.commission_of(p_cid uuid)
returns integer language sql security definer stable set search_path = public as $$
  select coalesce((select commission_percentage from consultant_terms where consultant_id = p_cid),
                  (select default_commission from settings limit 1), 20);
$$;

-- ── profile bootstrap for signed-in users (adopts guest profiles by email) ──
create or replace function public.ensure_profile()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me record; guest record; u auth.users%rowtype;
begin
  if auth.uid() is null then raise exception 'Kërkohet kyçja.'; end if;
  select * into me from profiles where id = auth.uid();
  if found then
    return jsonb_build_object('id', me.id, 'role', me.role, 'full_name', me.full_name, 'email', me.email);
  end if;
  select * into u from auth.users where id = auth.uid();
  -- adopt a guest profile created during a past guest booking
  select * into guest from profiles where lower(email) = lower(u.email) and user_id is null limit 1;
  if found then
    update appointments set client_id = auth.uid() where client_id = guest.id;
    update projects set client_id = auth.uid() where client_id = guest.id;
    update payments set client_id = auth.uid() where client_id = guest.id;
    update invoices set client_id = auth.uid() where client_id = guest.id;
    update reviews set client_id = auth.uid() where client_id = guest.id;
    update project_files set client_id = auth.uid() where client_id = guest.id;
    update consents set user_id = auth.uid() where user_id = guest.id;
    update waitlist set profile_id = auth.uid() where profile_id = guest.id;
    insert into profiles (id, user_id, email, full_name, role)
    values (auth.uid(), auth.uid(), guest.email, guest.full_name, 'client');
    delete from profiles where id = guest.id;
    return jsonb_build_object('id', auth.uid(), 'role', 'client', 'full_name', guest.full_name, 'email', guest.email);
  end if;
  insert into profiles (id, user_id, email, full_name, role)
  values (auth.uid(), auth.uid(), u.email, coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)), 'client');
  return jsonb_build_object('id', auth.uid(), 'role', 'client',
    'full_name', coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)), 'email', u.email);
end $$;

-- ═══ BOOKING ════════════════════════════════════════════════════════════════
create or replace function public.book_appointment(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  svc services%rowtype; cons consultants%rowtype; offer consultant_services%rowtype;
  match jsonb; fa jsonb; reasons jsonb := '[]'::jsonb;
  cid uuid; dur int; price numeric;
  d date; st time; t0 timestamp;
  client profiles%rowtype; au record; guest record;
  created_account boolean := false; temp_pw text := null;
  email text; cname text;
  pays boolean; amount numeric; ptype text; fee numeric;
  ref text; appt_id uuid; proj_id uuid; pay_id uuid; inv_id uuid; inv_number text;
  meet text; appt_status text; pay_status text;
  tax numeric; srow settings%rowtype;
  cemail text;
begin
  select * into srow from settings limit 1;

  select * into svc from services where id = (p ->> 'service_id')::uuid and is_active;
  if not found then raise exception 'Shërbimi nuk është më aktiv.'; end if;
  if (p ->> 'date') is null or (p ->> 'start_time') is null then raise exception 'Zgjidhni datën dhe orën.'; end if;
  if (p ->> 'date')::date < current_date then raise exception 'Data nuk mund të jetë në të kaluarën.'; end if;
  if coalesce((p -> 'consents' ->> 'privacy')::boolean, false) = false
     or coalesce((p -> 'consents' ->> 'terms')::boolean, false) = false then
    raise exception 'Duhet të pranoni kushtet dhe politikën e privatësisë.';
  end if;

  -- ── resolve consultant ──
  case p ->> 'consultant_mode'
  when 'specific' then
    cid := (p ->> 'consultant_id')::uuid;
    if cid is null then raise exception 'Zgjidhni konsulentin.'; end if;
  when 'first_available' then
    fa := public.first_available_offer(svc.id);
    if fa is null then raise exception 'Nuk ka termin të lirë për këtë shërbim.'; end if;
    cid := (fa ->> 'consultant_id')::uuid;
    reasons := '["Konsulenti i parë i lirë që ofron shërbimin"]'::jsonb;
  else
    match := public.match_consultant(svc.id, p -> 'client' ->> 'language');
    if match is null then raise exception 'Asnjë konsulent i përshtatshëm nuk u gjet.'; end if;
    cid := (match ->> 'consultant_id')::uuid;
    reasons := coalesce(match -> 'reasons', '[]'::jsonb);
  end case;

  select * into cons from consultants where id = cid and status = 'active' and is_active;
  if not found then raise exception 'Konsulenti nuk është i disponueshëm.'; end if;
  select * into offer from consultant_services
    where consultant_id = cid and service_id = svc.id and is_active;
  if not found then raise exception 'Ky konsulent nuk e ofron shërbimin e zgjedhur.'; end if;
  dur := offer.duration_minutes; price := offer.price;
  d := (p ->> 'date')::date; st := (p ->> 'start_time')::time;

  -- ── serialize concurrent bookings per consultant, then re-validate ──
  perform pg_advisory_xact_lock(hashtext(cid::text));
  if not public.slot_free(cid, d, st, dur) then
    raise exception 'Ky orar sapo u plotësua ose nuk është më i disponueshëm. Zgjidhni një orar tjetër.';
  end if;

  -- ── client profile: signed-in user, existing account, or new guest account ──
  email := lower(trim(p -> 'client' ->> 'email'));
  cname := trim(coalesce(p -> 'client' ->> 'first_name', '') || ' ' || coalesce(p -> 'client' ->> 'last_name', ''));

  if auth.uid() is not null then
    perform public.ensure_profile();
    select * into client from profiles where id = auth.uid();
    update profiles set full_name = case when cname <> '' then cname else full_name end,
      phone = case when coalesce(p -> 'client' ->> 'phone', '') <> '' then p -> 'client' ->> 'phone' else phone end
      where id = client.id;
  else
    select id into au from auth.users where lower(email) = email limit 1;
    if au.id is not null then
      select * into client from profiles where lower(email) = email limit 1;
      if not found then raise exception 'Ky email i përket një llogarie tjetër. Kyçuni.'; end if;
      if client.role <> 'client' then raise exception 'Ky email i përket një roli tjetër. Kyçuni.'; end if;
    else
      select * into guest from profiles where lower(email) = email and user_id is null limit 1;
      temp_pw := 'statlab-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
        is_super_admin, is_sso_user, is_anonymous)
      values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
        email, crypt(temp_pw, gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', cname, 'role', 'client'),
        now(), now(), '', '', false, false, false)
      returning * into au;
      -- profile auto-created by trigger; adopt prior guest records if any
      if guest.id is not null then
        update appointments set client_id = au.id where client_id = guest.id;
        update projects set client_id = au.id where client_id = guest.id;
        update payments set client_id = au.id where client_id = guest.id;
        update invoices set client_id = au.id where client_id = guest.id;
        update reviews set client_id = au.id where client_id = guest.id;
        update project_files set client_id = au.id where client_id = guest.id;
        update consents set user_id = au.id where user_id = guest.id;
        update waitlist set profile_id = au.id where profile_id = guest.id;
        delete from profiles where id = guest.id;
      end if;
      select * into client from profiles where id = au.id;
      created_account := true;
    end if;
  end if;

  -- consents
  insert into consents (user_id, consent_type, consent_version)
  select client.id, v.t, '1.2' from (values ('privacy'), ('terms'), ('data_processing'), ('confidentiality')) v(t)
  where not exists (select 1 from consents c where c.user_id = client.id and c.consent_type = v.t);

  -- ── appointment ──
  pays := (p ->> 'payment_choice') <> 'pay_later';
  ptype := case when p ->> 'payment_choice' = 'pay_now_deposit' then 'deposit' else 'full' end;
  amount := case when p ->> 'payment_choice' = 'pay_now_deposit'
    then coalesce(nullif(svc.deposit_amount, 0), round(price * 0.3)) else price end;
  appt_status := case when pays then 'confirmed' else 'pending' end;
  meet := case when pays then public.gen_meet_url() else null end;
  ref := 'SPSS-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('appointment_ref_seq')::text, 6, '0');

  insert into projects (client_id, primary_consultant_id, title, research_topic, university, study_level, status)
  values (client.id, cid, svc.name || ' — ' || ref,
          coalesce(p -> 'client' ->> 'research_topic', ''),
          coalesce(p -> 'client' ->> 'university', ''),
          coalesce(p -> 'client' ->> 'study_level', 'master'),
          case when (p -> 'file') is not null then 'waiting_for_files' else 'new' end)
  returning id into proj_id;
  insert into project_consultants (project_id, consultant_id, role) values (proj_id, cid, 'lead');

  insert into appointments (
    reference, client_id, client_name, client_email, client_phone,
    consultant_id, consultant_name, service_id, service_name, project_id,
    date, start_time, duration_minutes, price, status,
    language, university, study_level, research_topic, problem_description,
    spss_experience, required_analysis, intake,
    payment_status, payment_policy, meeting_provider, meeting_url
  ) values (
    ref, client.id, cname, email, coalesce(p -> 'client' ->> 'phone', ''),
    cid, cons.display_name, svc.id, svc.name, proj_id,
    d, st, dur, price, appt_status,
    coalesce(p -> 'client' ->> 'language', 'sq'),
    coalesce(p -> 'client' ->> 'university', ''),
    coalesce(p -> 'client' ->> 'study_level', 'master'),
    coalesce(p -> 'client' ->> 'research_topic', ''),
    coalesce(p -> 'client' ->> 'problem_description', ''),
    coalesce(p -> 'client' ->> 'spss_experience', 'basic'),
    coalesce(p -> 'client' ->> 'required_analysis', ''),
    coalesce(p -> 'intake', '{}'::jsonb),
    case when pays then (case when ptype = 'deposit' then 'deposit_paid' else 'paid' end) else 'unpaid' end,
    svc.payment_policy,
    case when pays then 'google_meet' else 'none' end, meet
  ) returning id into appt_id;

  update appointments set project_id = proj_id where id = appt_id;

  -- ── payment + invoice ──
  fee := round(amount * public.commission_of(cid) / 100, 2);
  insert into payments (appointment_id, project_id, client_id, consultant_id, type,
    amount_gross, platform_fee, consultant_net, status, method, paid_at)
  values (appt_id, proj_id, client.id, cid, ptype, amount, fee, amount - fee,
    case when pays then 'paid' else 'pending' end, 'stripe_demo',
    case when pays then now() else null end)
  returning id into pay_id;

  tax := srow.tax_rate / 100;
  inv_number := public.next_invoice_number();
  insert into invoices (invoice_number, client_id, appointment_id, project_id, payment_id,
    amount_net, tax_amount, amount_total, status)
  values (inv_number, client.id, appt_id, proj_id, pay_id,
    round(amount / (1 + tax), 2), round(amount - amount / (1 + tax), 2), amount,
    case when pays then 'paid' else 'issued' end)
  returning id into inv_id;
  update payments set invoice_id = inv_id where id = pay_id;

  -- intake file metadata (binary upload happens in the client portal)
  if (p -> 'file') is not null then
    insert into project_files (client_id, project_id, appointment_id, uploaded_by, file_name, file_path, file_type, file_size, category)
    values (client.id, proj_id, appt_id, client.id,
      p -> 'file' ->> 'name',
      proj_id::text || '/intake/' || substr(gen_random_uuid()::text, 1, 8) || '_' || (p -> 'file' ->> 'name'),
      coalesce(p -> 'file' ->> 'type', ''), coalesce((p -> 'file' ->> 'size')::bigint, 0),
      coalesce(p -> 'file' ->> 'category', 'dataset'));
  end if;

  -- ── notifications + activity + waitlist matching ──
  t0 := d + st;
  cemail := client.email;
  perform public.notify(client.id, cemail,
    case when pays then 'booking_confirmed' else 'booking_received' end,
    case when pays then 'Rezervimi u konfirmua — ' || ref else 'Rezervimi u pranua — ' || ref end,
    svc.name || ' me ' || cons.display_name || ' më ' || to_char(d, 'YYYY-MM-DD') || ' në ' || to_char(st, 'HH24:MI') ||
      case when meet is not null then '. Linku i takimit: ' || meet else '. Referenca: ' || ref || '.' end,
    appt_id, 'bk:' || appt_id::text || ':client');

  select email into cemail from profiles p2
    join auth.users u2 on u2.id = p2.user_id
    where p2.id = (select id from profiles where role in ('admin','super_admin') limit 1) limit 1;
  perform public.notify(
    (select id from profiles where role in ('admin','super_admin') order by (role = 'super_admin') desc limit 1),
    coalesce((select u3.email from auth.users u3 join profiles p3 on p3.user_id = u3.id
              where p3.role in ('admin','super_admin') limit 1), ''),
    'booking_received', 'Rezervim i ri — ' || ref,
    client.full_name || ' rezervoi ' || svc.name || ' me ' || cons.display_name || '.', appt_id);

  perform public.notify(
    (select id from profiles where user_id = cons.user_id),
    coalesce((select u4.email from auth.users u4 where u4.id = cons.user_id), ''),
    'consultant_assigned', 'Termin i ri',
    svc.name || ' me ' || client.full_name || ' më ' || to_char(d, 'YYYY-MM-DD') || ' në ' || to_char(st, 'HH24:MI') || '.', appt_id);

  if pays then
    perform public.notify(client.id, client.email, 'payment_received',
      'Pagesa u pranua — ' || amount || ' €', 'Fatura ' || inv_number || ' u lëshua.', appt_id);
  end if;

  perform public.log_activity('appointment.created', 'appointment', appt_id::text,
    svc.name || ' me ' || cons.display_name || ' — ' || to_char(d, 'YYYY-MM-DD') || ' ' || to_char(st, 'HH24:MI'));

  update waitlist set has_match = true
  where status = 'waiting' and service_id = svc.id and (consultant_id is null or consultant_id = cid);

  return jsonb_build_object(
    'appointment', jsonb_build_object(
      'id', appt_id, 'reference', ref, 'status', appt_status,
      'date', to_char(d, 'YYYY-MM-DD'), 'start_time', to_char(st, 'HH24:MI'),
      'end_time', to_char(t0 + make_interval(mins => dur), 'HH24:MI'),
      'duration_minutes', dur, 'price', price, 'meeting_url', meet,
      'manage_token', (select manage_token from appointments where id = appt_id),
      'consultant_id', cid, 'project_id', proj_id
    ),
    'created_account', created_account,
    'temp_password', temp_pw,
    'invoice', jsonb_build_object('id', inv_id, 'invoice_number', inv_number,
      'amount_total', amount, 'status', case when pays then 'paid' else 'issued' end),
    'match_reasons', reasons
  );
end $$;

-- ═══ SECURE SELF-SERVICE (token scoped, no id exposure) ═════════════════════
create or replace function public.manage_view(p_token uuid)
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare
  a appointments%rowtype; srow settings%rowtype; hrs numeric;
begin
  select * into a from appointments where manage_token = p_token;
  if not found then raise exception 'Linku i menaxhimit është i pavlefshëm ose ka skaduar.'; end if;
  select * into srow from settings limit 1;
  hrs := extract(epoch from ((a.date + a.start_time) at time zone 'UTC') - (now() at time zone 'UTC')) / 3600;
  return jsonb_build_object(
    'appointment', jsonb_build_object(
      'id', a.id, 'reference', a.reference, 'client_name', a.client_name, 'client_email', a.client_email,
      'consultant_id', a.consultant_id, 'consultant_name', a.consultant_name,
      'service_id', a.service_id, 'service_name', a.service_name,
      'date', to_char(a.date, 'YYYY-MM-DD'), 'start_time', to_char(a.start_time, 'HH24:MI'),
      'end_time', to_char((a.date + a.start_time + make_interval(mins => a.duration_minutes)), 'HH24:MI'),
      'duration_minutes', a.duration_minutes, 'price', a.price, 'status', a.status,
      'language', a.language, 'research_topic', a.research_topic, 'meeting_url', a.meeting_url,
      'manage_token', a.manage_token, 'payment_status', a.payment_status,
      'history', coalesce((select jsonb_agg(jsonb_build_object(
          'old_date', to_char(h.old_date, 'YYYY-MM-DD'), 'old_start', to_char(h.old_start, 'HH24:MI'),
          'new_date', to_char(h.new_date, 'YYYY-MM-DD'), 'new_start', to_char(h.new_start, 'HH24:MI'),
          'changed_by', h.changed_by, 'changed_by_role', h.changed_by_role, 'changed_at', h.changed_at))
        from appointment_history h where h.appointment_id = a.id order by h.changed_at), '[]'::jsonb)
    ),
    'can_reschedule', a.status in ('pending','confirmed') and hrs >= srow.min_reschedule_hours,
    'can_cancel', a.status in ('pending','confirmed') and hrs >= srow.min_cancel_hours,
    'reschedule_reason', case
      when a.status not in ('pending','confirmed') then 'Termini nuk është më aktiv.'
      when hrs < srow.min_reschedule_hours then 'Rizhvendosja lejohet të paktën ' || srow.min_reschedule_hours || ' orë para terminit.'
      else '' end,
    'cancel_reason', case
      when a.status not in ('pending','confirmed') then 'Termini nuk është më aktiv.'
      when hrs < srow.min_cancel_hours then 'Anulimi lejohet të paktën ' || srow.min_cancel_hours || ' orë para terminit.'
      else '' end,
    'min_reschedule_hours', srow.min_reschedule_hours,
    'min_cancel_hours', srow.min_cancel_hours
  );
end $$;

create or replace function public.appointment_token_slots(p_token uuid, p_day date)
returns setof text language plpgsql security definer stable set search_path = public as $$
declare a appointments%rowtype;
begin
  select * into a from appointments where manage_token = p_token;
  if not found then raise exception 'Linku i menaxhimit është i pavlefshëm.'; end if;
  return query select public.day_slots(a.consultant_id, p_day, a.duration_minutes);
end $$;

create or replace function public.reschedule_by_token(p_token uuid, p_date date, p_start time)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a appointments%rowtype; srow settings%rowtype; hrs numeric;
begin
  select * into a from appointments where manage_token = p_token for update;
  if not found then raise exception 'Linku i menaxhimit është i pavlefshëm.'; end if;
  if a.status not in ('pending','confirmed') then raise exception 'Ky termin nuk mund të rizhvendoset më.'; end if;
  select * into srow from settings limit 1;
  hrs := extract(epoch from ((a.date + a.start_time) at time zone 'UTC') - (now() at time zone 'UTC')) / 3600;
  if hrs < srow.min_reschedule_hours then
    raise exception 'Rizhvendosja lejohet të paktën % orë para terminit.', srow.min_reschedule_hours;
  end if;
  perform pg_advisory_xact_lock(hashtext(a.consultant_id::text));
  if not public.slot_free(a.consultant_id, p_date, p_start, a.duration_minutes, a.id) then
    raise exception 'Orari i zgjedhur nuk është më i disponueshëm.';
  end if;
  insert into appointment_history (appointment_id, old_date, old_start, new_date, new_start, changed_by, changed_by_role)
  values (a.id, a.date, a.start_time, p_date, p_start, a.client_name, 'client');
  update appointments set date = p_date, start_time = p_start where id = a.id;
  perform public.notify(a.client_id, a.client_email, 'booking_rescheduled', 'Rezervimi u rizhvendos',
    'Termini i ri: ' || to_char(p_date, 'YYYY-MM-DD') || ' në ' || to_char(p_start, 'HH24:MI') || '. Referenca: ' || a.reference || '.', a.id);
  perform public.notify((select id from profiles where user_id = (select user_id from consultants where id = a.consultant_id)),
    (select u.email from auth.users u join consultants c on c.user_id = u.id where c.id = a.consultant_id),
    'booking_rescheduled', 'Rezervimi u rizhvendos',
    'Termini i ri: ' || to_char(p_date, 'YYYY-MM-DD') || ' në ' || to_char(p_start, 'HH24:MI') || '. Referenca: ' || a.reference || '.', a.id);
  perform public.log_activity('appointment.rescheduled', 'appointment', a.id::text,
    'Nga ' || to_char(a.date, 'YYYY-MM-DD') || ' ' || to_char(a.start_time, 'HH24:MI') ||
    ' në ' || to_char(p_date, 'YYYY-MM-DD') || ' ' || to_char(p_start, 'HH24:MI'));
  return jsonb_build_object('date', to_char(p_date, 'YYYY-MM-DD'), 'start_time', to_char(p_start, 'HH24:MI'),
    'end_time', to_char((p_date + p_start + make_interval(mins => a.duration_minutes)), 'HH24:MI'));
end $$;

create or replace function public.cancel_by_token(p_token uuid, p_reason text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare a appointments%rowtype; srow settings%rowtype; hrs numeric;
begin
  select * into a from appointments where manage_token = p_token for update;
  if not found then raise exception 'Linku i menaxhimit është i pavlefshëm.'; end if;
  if a.status not in ('pending','confirmed') then raise exception 'Ky termin nuk mund të anulohet më.'; end if;
  select * into srow from settings limit 1;
  hrs := extract(epoch from ((a.date + a.start_time) at time zone 'UTC') - (now() at time zone 'UTC')) / 3600;
  if hrs < srow.min_cancel_hours then
    raise exception 'Anulimi lejohet të paktën % orë para terminit.', srow.min_cancel_hours;
  end if;
  update appointments set status = 'cancelled',
    internal_notes = internal_notes || case when p_reason <> '' then E'\nAnuluar nga klienti: ' || p_reason else '' end
    where id = a.id;
  perform public.notify(a.client_id, a.client_email, 'booking_cancelled', 'Rezervimi u anulua', 'Referenca: ' || a.reference || '.', a.id);
  perform public.notify((select id from profiles where user_id = (select user_id from consultants where id = a.consultant_id)),
    (select u.email from auth.users u join consultants c on c.user_id = u.id where c.id = a.consultant_id),
    'booking_cancelled', 'Rezervimi u anulua', a.client_name || ' — ' || to_char(a.date, 'YYYY-MM-DD') || ' ' || to_char(a.start_time, 'HH24:MI'), a.id);
  perform public.log_activity('appointment.cancelled', 'appointment', a.id::text, a.reference);
  update waitlist set has_match = true where status = 'waiting' and service_id = a.service_id
    and (consultant_id is null or consultant_id = a.consultant_id);
  return jsonb_build_object('status', 'cancelled');
end $$;

-- ═══ STAFF / CONSULTANT OPERATIONS ══════════════════════════════════════════
create or replace function public.set_appointment_status(p_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a appointments%rowtype; actor text; arole text;
begin
  if not public.is_staff() and public.my_consultant_id() is null then
    raise exception 'Pa të drejta për këtë veprim.';
  end if;
  select * into a from appointments where id = p_id for update;
  if not found then raise exception 'Termini nuk u gjet.'; end if;
  if not public.is_staff() and a.consultant_id <> public.my_consultant_id() then
    raise exception 'Pa të drejta për këtë veprim.';
  end if;
  if p_status not in ('pending','confirmed','completed','cancelled','no_show') then
    raise exception 'Status i pavlefshëm.';
  end if;
  select full_name, role into actor, arole from profiles where id = auth.uid();

  if p_status = 'confirmed' and a.meeting_url is null then
    update appointments set status = 'confirmed', meeting_provider = 'google_meet', meeting_url = public.gen_meet_url() where id = a.id;
  else
    update appointments set status = p_status where id = a.id;
  end if;

  perform public.notify(a.client_id, a.client_email,
    case p_status when 'confirmed' then 'booking_confirmed' when 'cancelled' then 'booking_cancelled'
      when 'no_show' then 'booking_cancelled' else 'consultation_completed' end,
    case p_status when 'confirmed' then 'Rezervimi juaj u konfirmua' when 'cancelled' then 'Rezervimi u anulua'
      when 'no_show' then 'Termini u shënua si mungesë' else 'Konsulta u përfundua' end,
    'Referenca: ' || a.reference || '.', a.id);
  perform public.log_activity('appointment.' || p_status, 'appointment', a.id::text, a.reference || ' → ' || p_status);

  if p_status = 'cancelled' then
    update waitlist set has_match = true where status = 'waiting' and service_id = a.service_id
      and (consultant_id is null or consultant_id = a.consultant_id);
  end if;
  return jsonb_build_object('status', p_status,
    'meeting_url', (select meeting_url from appointments where id = a.id));
end $$;

create or replace function public.complete_appointment(p_id uuid, p_completion jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a appointments%rowtype; fee numeric; bal numeric; dep record;
begin
  if not public.is_staff() and public.my_consultant_id() is null then raise exception 'Pa të drejta.'; end if;
  select * into a from appointments where id = p_id for update;
  if not found then raise exception 'Termini nuk u gjet.'; end if;
  if not public.is_staff() and a.consultant_id <> public.my_consultant_id() then raise exception 'Pa të drejta.'; end if;

  update appointments set status = 'completed', completion = p_completion where id = a.id;

  -- deposit policy → balance becomes due on completion
  if a.payment_policy = 'deposit' and a.payment_status = 'deposit_paid'
     and not exists (select 1 from payments where appointment_id = a.id and type = 'balance') then
    bal := a.price - coalesce((select sum(amount_gross) from payments where appointment_id = a.id and status = 'paid'), 0);
    if bal > 0 then
      fee := round(bal * public.commission_of(a.consultant_id) / 100, 2);
      insert into payments (appointment_id, project_id, client_id, consultant_id, type, amount_gross, platform_fee, consultant_net, status)
      values (a.id, a.project_id, a.client_id, a.consultant_id, 'balance', bal, fee, bal - fee, 'pending');
      perform public.notify(a.client_id, a.client_email, 'payment_received', 'Kujtesë: bilanci i mbetur',
        'Ju lutemi paguani balansin prej ' || bal || ' €.', a.id);
    end if;
  end if;

  perform public.notify(a.client_id, a.client_email, 'consultation_completed',
    'Konsulta u përfundua — rezultatet janë në portal', 'Referenca: ' || a.reference || '.', a.id);
  perform public.log_activity('appointment.completed', 'appointment', a.id::text, a.reference);
  return jsonb_build_object('status', 'completed');
end $$;

create or replace function public.save_appointment_notes(p_id uuid, p_notes text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Pa të drejta.'; end if;
  update appointments set internal_notes = p_notes where id = p_id;
  perform public.log_activity('appointment.notes', 'appointment', p_id::text, 'Shënimet u përditësuan');
end $$;

create or replace function public.reschedule_by_staff(p_id uuid, p_date date, p_start time)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a appointments%rowtype; actor text; arole text;
begin
  if not public.is_staff() then raise exception 'Pa të drejta.'; end if;
  select * into a from appointments where id = p_id for update;
  if not found then raise exception 'Termini nuk u gjet.'; end if;
  perform pg_advisory_xact_lock(hashtext(a.consultant_id::text));
  if not public.slot_free(a.consultant_id, p_date, p_start, a.duration_minutes, a.id) then
    raise exception 'Orari i zgjedhur nuk është i disponueshëm.';
  end if;
  select full_name, role into actor, arole from profiles where id = auth.uid();
  insert into appointment_history (appointment_id, old_date, old_start, new_date, new_start, changed_by, changed_by_role)
  values (a.id, a.date, a.start_time, p_date, p_start, actor, arole);
  update appointments set date = p_date, start_time = p_start where id = a.id;
  perform public.notify(a.client_id, a.client_email, 'booking_rescheduled', 'Rezervimi u rizhvendos',
    'Termini i ri: ' || to_char(p_date, 'YYYY-MM-DD') || ' në ' || to_char(p_start, 'HH24:MI') || '.', a.id);
  perform public.log_activity('appointment.rescheduled', 'appointment', a.id::text,
    to_char(a.date, 'YYYY-MM-DD') || ' → ' || to_char(p_date, 'YYYY-MM-DD'));
  return jsonb_build_object('date', to_char(p_date, 'YYYY-MM-DD'), 'start_time', to_char(p_start, 'HH24:MI'));
end $$;

create or replace function public.cancel_by_staff(p_id uuid, p_reason text default '')
returns void language plpgsql security definer set search_path = public as $$
declare a appointments%rowtype;
begin
  if not public.is_staff() then raise exception 'Pa të drejta.'; end if;
  select * into a from appointments where id = p_id for update;
  if not found then raise exception 'Termini nuk u gjet.'; end if;
  update appointments set status = 'cancelled',
    internal_notes = internal_notes || case when p_reason <> '' then E'\nArsyeja e anulimit: ' || p_reason else '' end
    where id = a.id;
  perform public.notify(a.client_id, a.client_email, 'booking_cancelled', 'Rezervimi u anulua', 'Referenca: ' || a.reference || '.', a.id);
  perform public.log_activity('appointment.cancelled', 'appointment', a.id::text, a.reference);
  update waitlist set has_match = true where status = 'waiting' and service_id = a.service_id
    and (consultant_id is null or consultant_id = a.consultant_id);
end $$;

-- ═══ PAYMENTS (demo Stripe — webhook verification deferred) ═════════════════
create or replace function public.pay_payment(p_id uuid, p_method text default 'stripe_demo')
returns jsonb language plpgsql security definer set search_path = public as $$
declare pay payments%rowtype; a appointments%rowtype;
begin
  select * into pay from payments where id = p_id for update;
  if not found then raise exception 'Pagesa nuk u gjet.'; end if;
  if not public.is_staff() and pay.client_id <> auth.uid() then raise exception 'Pa të drejta.'; end if;
  if pay.status <> 'pending' then raise exception 'Kjo pagesë nuk është më e papaguar.'; end if;

  update payments set status = 'paid', paid_at = now(), method = p_method,
    stripe_reference = 'demo_' || substr(gen_random_uuid()::text, 1, 14)
    where id = p_id;
  update invoices set status = 'paid' where id = pay.invoice_id;

  if pay.appointment_id is not null then
    select * into a from appointments where id = pay.appointment_id;
    update appointments set
      payment_status = case
        when pay.type = 'full' then 'paid'
        when pay.type = 'balance' then 'paid'
        when pay.type = 'deposit' and appointments.payment_status = 'unpaid' then 'deposit_paid'
        else appointments.payment_status end,
      status = case when appointments.status = 'pending' then 'confirmed' else appointments.status end,
      meeting_url = coalesce(appointments.meeting_url, public.gen_meet_url()),
      meeting_provider = case when appointments.meeting_url is null then 'google_meet' else appointments.meeting_provider end
      where id = a.id;
    perform public.notify(a.client_id, a.client_email, 'payment_received',
      'Pagesa u pranua — ' || pay.amount_gross || ' €', 'Fatura u lëshua. Referenca: ' || a.reference || '.', a.id);
    if a.status = 'pending' then
      perform public.notify(a.client_id, a.client_email, 'booking_confirmed',
        'Rezervimi u konfirmua — ' || a.reference, 'Pagesa u verifikua dhe termini u konfirmua.', a.id);
    end if;
  end if;
  perform public.log_activity('payment.received', 'payment', p_id::text, pay.amount_gross || ' €');
  return jsonb_build_object('status', 'paid',
    'appointment_status', (select status from appointments where id = pay.appointment_id));
end $$;

create or replace function public.refund_payment(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare pay payments%rowtype;
begin
  if not public.is_staff() then raise exception 'Pa të drejta.'; end if;
  select * into pay from payments where id = p_id for update;
  if not found then raise exception 'Pagesa nuk u gjet.'; end if;
  update payments set status = 'refunded' where id = p_id;
  update invoices set status = 'cancelled' where id = pay.invoice_id;
  update appointments set payment_status = 'refunded' where id = pay.appointment_id;
  perform public.log_activity('payment.refunded', 'payment', p_id::text, pay.amount_gross || ' €');
end $$;

create or replace function public.set_payout_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Pa të drejta.'; end if;
  if p_status not in ('pending','approved','paid') then raise exception 'Status i pavlefshëm.'; end if;
  update payments set payout_status = p_status where id = p_id;
  perform public.log_activity('payout.' || p_status, 'payment', p_id::text, '');
end $$;

-- ═══ ADMIN: consultant onboarding (creates auth account securely) ═══════════
create or replace function public.admin_create_consultant(
  p_email text, p_name text, p_title text default '', p_commission integer default 20,
  p_specializations jsonb default '[]', p_languages jsonb default '["sq"]'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid_ uuid; temp_pw text; slug_ text; cid uuid;
begin
  if not public.is_staff() then raise exception 'Pa të drejta.'; end if;
  if exists (select 1 from auth.users where lower(email) = lower(p_email)) then
    raise exception 'Ekziston një llogari me këtë email.';
  end if;
  temp_pw := 'statlab-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
    is_super_admin, is_sso_user, is_anonymous)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    lower(p_email), crypt(temp_pw, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_name, 'role', 'consultant'),
    now(), now(), '', '', false, false, false)
  returning id into uid_;

  slug_ := lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(uid_::text, 1, 4);
  insert into consultants (user_id, slug, display_name, professional_title, status, is_active, specializations, languages)
  values (uid_, slug_, p_name, p_title, 'pending', false, p_specializations, p_languages)
  returning id into cid;
  insert into consultant_terms (consultant_id, commission_percentage) values (cid, p_commission);
  update profiles set role = 'consultant' where id = uid_;
  perform public.log_activity('consultant.approved', 'consultant', cid::text, p_name || ' (' || p_email || ')');
  return jsonb_build_object('email', lower(p_email), 'temp_password', temp_pw, 'consultant_id', cid);
end $$;

-- ═══ REMINDERS (idempotent via dedupe keys) ════════════════════════════════
create or replace function public.reminder_sweep()
returns integer language plpgsql security definer set search_path = public as $$
declare a record; n integer := 0; hrs numeric; rh integer; srow settings%rowtype;
begin
  select * into srow from settings limit 1;
  for a in
    select ap.*, c.user_id as cons_user from appointments ap
    left join consultants c on c.id = ap.consultant_id
    where ap.status = 'confirmed'
  loop
    hrs := extract(epoch from ((a.date + a.start_time) at time zone 'UTC') - (now() at time zone 'UTC')) / 3600;
    foreach rh in array array[24, 1] loop
      if hrs <= rh and hrs > 0 then
        insert into notifications (recipient_id, recipient_email, appointment_id, type, subject, body, dedupe_key)
        values (a.client_id, a.client_email, a.id,
          case when rh >= 24 then 'reminder_24h' else 'reminder_1h' end,
          'Kujtesë: konsulta ' || case when rh >= 24 then 'nesër' else 'së shpejti' end,
          a.service_name || ' më ' || to_char(a.date, 'YYYY-MM-DD') || ' në ' || to_char(a.start_time, 'HH24:MI') ||
            coalesce('. Linku: ' || a.meeting_url, '.'),
          'rem:' || a.id::text || ':' || rh)
        on conflict (dedupe_key) where dedupe_key is not null do nothing;
        get diagnostics n = n + row_count;
        if a.cons_user is not null then
          insert into notifications (recipient_id, recipient_email, appointment_id, type, subject, body, dedupe_key)
          values ((select id from profiles where user_id = a.cons_user),
                  (select email from auth.users where id = a.cons_user), a.id,
            case when rh >= 24 then 'reminder_24h' else 'reminder_1h' end,
            'Kujtesë: termin ' || case when rh >= 24 then 'nesër' else 'së shpejti' end,
            a.client_name || ' më ' || to_char(a.date, 'YYYY-MM-DD') || ' në ' || to_char(a.start_time, 'HH24:MI') || '.',
            'remc:' || a.id::text || ':' || rh)
          on conflict (dedupe_key) where dedupe_key is not null do nothing;
          get diagnostics n = n + row_count;
        end if;
      end if;
    end loop;
  end loop;
  return n;
end $$;

-- ═══ PUBLIC DIRECTORY & PROFILE ═════════════════════════════════════════════
create or replace function public.public_directory()
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare c record; out_ jsonb := '[]'::jsonb; svcs jsonb; minp numeric; fs jsonb; weekly jsonb;
begin
  for c in select * from consultants where status = 'active' and is_active order by is_featured desc, rating desc
  loop
    select coalesce(jsonb_agg(jsonb_build_object('service_id', cs.service_id, 'name', s.name, 'slug', s.slug,
        'price', cs.price, 'duration_minutes', cs.duration_minutes, 'category', s.category)), '[]'::jsonb),
      min(cs.price)
    into svcs, minp
    from consultant_services cs join services s on s.id = cs.service_id and s.is_active
    where cs.consultant_id = c.id and cs.is_active;

    fs := public.first_slot_after(c.id,
      coalesce((select min(cs2.duration_minutes) from consultant_services cs2 where cs2.consultant_id = c.id and cs2.is_active), 60));
    select coalesce(jsonb_agg(jsonb_build_object('day', w.day_of_week,
        'windows', (select coalesce(jsonb_agg(to_char(w2.start_time, 'HH24:MI') || '–' || to_char(w2.end_time, 'HH24:MI')), '[]'::jsonb)
                    from weekly_availability w2 where w2.consultant_id = c.id and w2.is_available and w2.day_of_week = w.day_of_week)))
      order by w.day_of_week), '[]'::jsonb)
    into weekly
    from (select distinct day_of_week from weekly_availability where consultant_id = c.id and is_available) w;

    out_ := out_ || jsonb_build_array(jsonb_build_object(
      'id', c.id, 'slug', c.slug, 'display_name', c.display_name,
      'professional_title', c.professional_title, 'bio', c.bio,
      'education', c.education, 'certifications', c.certifications,
      'years_experience', c.years_experience, 'languages', c.languages,
      'specializations', c.specializations, 'rating', c.rating, 'review_count', c.review_count,
      'is_featured', c.is_featured, 'starting_price', coalesce(minp, 0),
      'services', svcs, 'next', fs, 'weekly', weekly
    ));
  end loop;
  return out_;
end $$;

create or replace function public.consultant_profile_public(p_slug text)
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare c consultants%rowtype; dir jsonb; revs jsonb;
begin
  select * into c from consultants where slug = p_slug and status = 'active' and is_active;
  if not found then return null; end if;
  dir := (select jsonb_agg(x) from jsonb_array_elements(public.public_directory()) x where x ->> 'id' = c.id::text);
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'rating', r.rating, 'clarity', r.clarity, 'usefulness', r.usefulness,
      'recommendation', r.recommendation, 'comment', r.comment, 'show_name', r.show_name,
      'client_name', case when r.show_name then coalesce(pf.full_name, 'Klient') else 'Klient i verifikuar' end,
      'service_name', coalesce(a.service_name, 'Konsulencë'), 'created_at', r.created_at)
      order by r.created_at desc), '[]'::jsonb)
  into revs
  from reviews r
  left join profiles pf on pf.id = r.client_id
  left join appointments a on a.id = r.appointment_id
  where r.consultant_id = c.id and r.status = 'published' and r.consent_to_publish;
  return jsonb_build_object('consultant', coalesce(dir -> 0, '{}'::jsonb), 'reviews', revs);
end $$;

-- ═══ DASHBOARDS ═════════════════════════════════════════════════════════════
create or replace function public.client_overview()
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Kërkohet kyçja.'; end if;
  return jsonb_build_object(
    'next_appointment', (select jsonb_build_object('id', a.id, 'reference', a.reference, 'date', to_char(a.date, 'YYYY-MM-DD'),
        'start_time', to_char(a.start_time, 'HH24:MI'), 'status', a.status, 'service_name', a.service_name,
        'consultant_name', a.consultant_name, 'meeting_url', a.meeting_url, 'duration_minutes', a.duration_minutes)
      from appointments a where a.client_id = me and a.status in ('pending','confirmed') and a.date >= current_date
      order by a.date, a.start_time limit 1),
    'active_project', (select jsonb_build_object('id', p.id, 'title', p.title, 'status', p.status,
        'consultant_name', co.display_name,
        'progress', coalesce((select round(avg(t.progress)) from analysis_tasks t
                              where t.project_id = p.id and t.status <> 'not_required'), 0))
      from projects p left join consultants co on co.id = p.primary_consultant_id
      where p.client_id = me and p.status not in ('completed','cancelled')
      order by p.updated_at desc limit 1),
    'pending_amount', coalesce((select sum(amount_gross) from payments where client_id = me and status = 'pending'), 0),
    'recent_files', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'file_name', f.file_name,
        'category', f.category, 'created_at', f.created_at) order by f.created_at desc)
      from (select * from project_files where client_id = me order by created_at desc limit 4) f), '[]'::jsonb),
    'last_consultation', (select jsonb_build_object('date', to_char(a.date, 'YYYY-MM-DD'), 'service_name', a.service_name,
        'consultant_name', a.consultant_name, 'completion', a.completion)
      from appointments a where a.client_id = me and a.status = 'completed' order by a.date desc limit 1),
    'unreviewed', (select count(*) from appointments a where a.client_id = me and a.status = 'completed'
      and not exists (select 1 from reviews r where r.appointment_id = a.id))
  );
end $$;

create or replace function public.consultant_overview()
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare cid uuid; c consultants%rowtype;
begin
  cid := public.my_consultant_id();
  if cid is null then raise exception 'Profili i konsulentit nuk u gjet.'; end if;
  select * into c from consultants where id = cid;
  return jsonb_build_object(
    'consultant', jsonb_build_object('id', c.id, 'slug', c.slug, 'display_name', c.display_name,
      'professional_title', c.professional_title, 'rating', c.rating, 'review_count', c.review_count,
      'google_calendar_connected', c.google_calendar_connected, 'commission_percentage', public.commission_of(cid)),
    'kpi', jsonb_build_object(
      'today', (select count(*) from appointments where consultant_id = cid and date = current_date and status in ('pending','confirmed')),
      'week', (select count(*) from appointments where consultant_id = cid and date between current_date and current_date + 7 and status in ('pending','confirmed')),
      'activeProjects', (select count(*) from projects p where p.status not in ('completed','cancelled')
        and (p.primary_consultant_id = cid or exists (select 1 from project_consultants pc where pc.project_id = p.id and pc.consultant_id = cid))),
      'activeClients', (select count(distinct client_id) from appointments where consultant_id = cid),
      'monthEarnings', coalesce((select sum(consultant_net) from payments where consultant_id = cid and status = 'paid'
        and paid_at >= date_trunc('month', now())), 0),
      'totalEarnings', coalesce((select sum(consultant_net) from payments where consultant_id = cid and status = 'paid'), 0),
      'pendingPayout', coalesce((select sum(consultant_net) from payments where consultant_id = cid and status = 'paid' and payout_status <> 'paid'), 0),
      'rating', c.rating, 'reviewCount', c.review_count),
    'upcoming', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'reference', a.reference,
        'client_name', a.client_name, 'service_name', a.service_name, 'status', a.status,
        'date', to_char(a.date, 'YYYY-MM-DD'), 'start_time', to_char(a.start_time, 'HH24:MI'),
        'duration_minutes', a.duration_minutes, 'meeting_url', a.meeting_url, 'consultant_name', c.display_name,
        'consultant_id', cid, 'consultant_slug', c.slug) order by a.date, a.start_time)
      from (select * from appointments where consultant_id = cid and date >= current_date
            and status in ('pending','confirmed') order by date, start_time limit 6) a), '[]'::jsonb),
    'recentActivity', coalesce((select jsonb_agg(jsonb_build_object('id', al.id, 'action', al.action,
        'metadata', al.metadata, 'created_at', al.created_at) order by al.created_at desc)
      from (select * from activity_log where actor_id = auth.uid() order by created_at desc limit 8) al), '[]'::jsonb)
  );
end $$;

create or replace function public.admin_overview()
returns jsonb language plpgsql security definer stable set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Pa të drejta.'; end if;
  return jsonb_build_object(
    'today', (select count(*) from appointments where date = current_date and status in ('pending','confirmed','completed')),
    'week', (select count(*) from appointments where date between current_date and current_date + 7 and status in ('pending','confirmed')),
    'month', (select count(*) from appointments where date between date_trunc('month', current_date)::date and (date_trunc('month', current_date) + interval '1 month - 1 day')::date),
    'pending', (select count(*) from appointments where status = 'pending'),
    'confirmed', (select count(*) from appointments where status = 'confirmed'),
    'completed', (select count(*) from appointments where status = 'completed'),
    'activeProjects', (select count(*) from projects where status not in ('completed','cancelled')),
    'activeConsultants', (select count(*) from consultants where status = 'active' and is_active),
    'newClients', (select count(*) from profiles where role = 'client' and created_at >= now() - interval '30 days'),
    'monthRevenue', coalesce((select sum(amount_gross) from payments where status = 'paid' and paid_at >= date_trunc('month', now())), 0),
    'pendingRevenue', coalesce((select sum(amount_gross) from payments where status = 'pending'), 0),
    'platformRevenue', coalesce((select sum(platform_fee) from payments where status = 'paid' and paid_at >= date_trunc('month', now())), 0),
    'upcoming', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'reference', a.reference, 'client_name', a.client_name,
        'consultant_name', a.consultant_name, 'service_name', a.service_name, 'status', a.status,
        'date', to_char(a.date, 'YYYY-MM-DD'), 'start_time', to_char(a.start_time, 'HH24:MI'),
        'duration_minutes', a.duration_minutes) order by a.date, a.start_time)
      from (select * from appointments where status in ('pending','confirmed') and date >= current_date
            order by date, start_time limit 6) a), '[]'::jsonb),
    'recentClients', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email,
        'created_at', p.created_at) order by p.created_at desc)
      from (select * from profiles where role = 'client' order by created_at desc limit 5) p), '[]'::jsonb),
    'recentPayments', coalesce((select jsonb_agg(jsonb_build_object('id', pay.id, 'amount_gross', pay.amount_gross,
        'status', pay.status, 'type', pay.type, 'created_at', pay.created_at,
        'client_name', coalesce(pf.full_name, ''), 'reference', coalesce(a.reference, '')) order by pay.created_at desc)
      from (select * from payments order by created_at desc limit 5) pay
      left join profiles pf on pf.id = pay.client_id
      left join appointments a on a.id = pay.appointment_id), '[]'::jsonb)
  );
end $$;

-- ═══ ANALYTICS (computed from source records) ═══════════════════════════════
create or replace function public.admin_analytics(p_from date, p_to date)
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare
  appts jsonb; counted integer; finished integer; cancelled integer; noshow integer;
begin
  if not public.is_staff() then raise exception 'Pa të drejta.'; end if;
  select count(*),
    count(*) filter (where status in ('completed','cancelled','no_show')),
    count(*) filter (where status = 'cancelled'),
    count(*) filter (where status = 'no_show')
  into counted, finished, cancelled, noshow
  from appointments where date between p_from and p_to and status <> 'rescheduled';

  return jsonb_build_object(
    'range', jsonb_build_object('from', to_char(p_from, 'YYYY-MM-DD'), 'to', to_char(p_to, 'YYYY-MM-DD')),
    'kpi', jsonb_build_object(
      'bookings', counted,
      'confirmed', (select count(*) from appointments where date between p_from and p_to and status = 'confirmed'),
      'completed', (select count(*) from appointments where date between p_from and p_to and status = 'completed'),
      'pending', (select count(*) from appointments where date between p_from and p_to and status = 'pending'),
      'cancelRate', case when finished > 0 then round(cancelled::numeric / finished * 100) else 0 end,
      'noShowRate', case when finished > 0 then round(noshow::numeric / finished * 100) else 0 end,
      'revenue', coalesce((select sum(amount_gross) from payments where status = 'paid' and paid_at::date between p_from and p_to), 0),
      'pendingRevenue', coalesce((select sum(amount_gross) from payments where status = 'pending'), 0),
      'platformRevenue', coalesce((select sum(platform_fee) from payments where status = 'paid' and paid_at::date between p_from and p_to), 0),
      'consultantEarnings', coalesce((select sum(consultant_net) from payments where status = 'paid' and paid_at::date between p_from and p_to), 0),
      'avgBookingValue', coalesce((select round(avg(price)) from appointments where date between p_from and p_to), 0),
      'newClients', (select count(*) from profiles where role = 'client' and created_at::date between p_from and p_to),
      'activeProjects', (select count(*) from projects where status not in ('completed','cancelled')),
      'completedProjects', (select count(*) from projects where status = 'completed'),
      'activeConsultants', (select count(*) from consultants where status = 'active' and is_active)
    ),
    'series', coalesce((select jsonb_agg(jsonb_build_object('day', to_char(gs.d, 'YYYY-MM-DD'),
        'bookings', (select count(*) from appointments a where a.date = gs.d and a.status <> 'rescheduled'),
        'revenue', coalesce((select sum(pay.amount_gross) from payments pay where pay.status = 'paid' and pay.paid_at::date = gs.d), 0))
        order by gs.d)
      from (select (p_from + gs)::date as d from generate_series(0, p_to - p_from) gs) gs), '[]'::jsonb),
    'byService', coalesce((select jsonb_agg(jsonb_build_object('name', s.name, 'bookings', n.n, 'revenue', n.rev) order by n.rev desc)
      from services s, lateral (
        select count(*) as n,
          coalesce((select sum(pay.amount_gross) from payments pay join appointments a2 on a2.id = pay.appointment_id
            where a2.service_id = s.id and pay.status = 'paid' and pay.paid_at::date between p_from and p_to), 0) as rev
        from appointments a where a.service_id = s.id and a.date between p_from and p_to and a.status <> 'rescheduled'
      ) n where n.n > 0 or n.rev > 0), '[]'::jsonb),
    'byStatus', coalesce((select jsonb_agg(jsonb_build_object('status', st.status, 'count', st.cnt) order by st.cnt desc)
      from (select status, count(*) as cnt from appointments where date between p_from and p_to group by status) st), '[]'::jsonb),
    'byConsultant', coalesce((select jsonb_agg(jsonb_build_object('name', c.display_name,
        'bookings', (select count(*) from appointments a where a.consultant_id = c.id and a.date between p_from and p_to and a.status <> 'rescheduled'),
        'revenue', coalesce((select sum(pay.consultant_net) from payments pay where pay.consultant_id = c.id and pay.status = 'paid' and pay.paid_at::date between p_from and p_to), 0),
        'rating', c.rating,
        'completionRate', coalesce((select round(100.0 * count(*) filter (where a.status = 'completed') / nullif(count(*), 0))
          from appointments a where a.consultant_id = c.id and a.date between p_from and p_to and a.status <> 'rescheduled'), 0),
        'activeProjects', (select count(*) from projects p where p.primary_consultant_id = c.id and p.status not in ('completed','cancelled')))
        order by 2 desc)
      from consultants c where c.status <> 'inactive'
        and exists (select 1 from appointments a where a.consultant_id = c.id and a.date between p_from and p_to)), '[]'::jsonb)
  );
end $$;

-- ═══ ADMIN LISTS ════════════════════════════════════════════════════════════
create or replace function public.admin_clients()
returns jsonb language plpgsql security definer stable set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Pa të drejta.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'full_name', p.full_name, 'email', p.email, 'phone', p.phone,
      'preferred_language', p.preferred_language, 'status', p.status, 'created_at', p.created_at,
      'bookings', (select count(*) from appointments a where a.client_id = p.id and a.status <> 'rescheduled'),
      'spent', coalesce((select sum(pay.amount_gross) from payments pay where pay.client_id = p.id and pay.status = 'paid'), 0),
      'active_projects', (select count(*) from projects pr where pr.client_id = p.id and pr.status not in ('completed','cancelled')),
      'last_booking', (select max(a2.date) from appointments a2 where a2.client_id = p.id))
    order by p.created_at desc)
  from profiles p where p.role = 'client'), '[]'::jsonb);
end $$;

create or replace function public.admin_consultants()
returns jsonb language plpgsql security definer stable set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Pa të drejta.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', c.id, 'user_id', c.user_id, 'slug', c.slug, 'display_name', c.display_name,
      'professional_title', c.professional_title, 'bio', c.bio, 'education', c.education,
      'certifications', c.certifications, 'years_experience', c.years_experience,
      'languages', c.languages, 'specializations', c.specializations, 'rating', c.rating,
      'review_count', c.review_count, 'status', c.status, 'is_active', c.is_active,
      'is_featured', c.is_featured, 'google_calendar_connected', c.google_calendar_connected,
      'commission_percentage', public.commission_of(c.id),
      'bookings_total', (select count(*) from appointments a where a.consultant_id = c.id and a.status <> 'rescheduled'),
      'revenue', coalesce((select sum(pay.consultant_net) from payments pay where pay.consultant_id = c.id and pay.status = 'paid'), 0))
    order by c.is_featured desc, c.rating desc)
  from consultants c), '[]'::jsonb);
end $$;

create or replace function public.consultant_earnings()
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare cid uuid;
begin
  cid := public.my_consultant_id();
  if cid is null then raise exception 'Profili i konsulentit nuk u gjet.'; end if;
  return jsonb_build_object(
    'gross', coalesce((select sum(amount_gross) from payments where consultant_id = cid and status = 'paid'), 0),
    'net', coalesce((select sum(consultant_net) from payments where consultant_id = cid and status = 'paid'), 0),
    'fees', coalesce((select sum(platform_fee) from payments where consultant_id = cid and status = 'paid'), 0),
    'pendingPayout', coalesce((select sum(consultant_net) from payments where consultant_id = cid and status = 'paid' and payout_status <> 'paid'), 0),
    'commission', public.commission_of(cid),
    'monthly', coalesce((select jsonb_agg(jsonb_build_object('month', m.m, 'net', m.net) order by m.m)
      from (select to_char(date_trunc('month', paid_at), 'YYYY-MM') as m, sum(consultant_net) as net
            from payments where consultant_id = cid and status = 'paid'
            group by 1 order by 1 desc limit 12) m), '[]'::jsonb),
    'payouts', coalesce((select jsonb_agg(jsonb_build_object('id', pay.id, 'amount_gross', pay.amount_gross,
        'consultant_net', pay.consultant_net, 'platform_fee', pay.platform_fee, 'payout_status', pay.payout_status,
        'status', pay.status, 'paid_at', pay.paid_at, 'reference', coalesce(a.reference, '')) order by pay.paid_at desc)
      from payments pay left join appointments a on a.id = pay.appointment_id
      where pay.consultant_id = cid and pay.status = 'paid'), '[]'::jsonb)
  );
end $$;

create or replace function public.consultant_clients()
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare cid uuid;
begin
  cid := public.my_consultant_id();
  if cid is null then raise exception 'Profili i konsulentit nuk u gjet.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'full_name', p.full_name, 'email', p.email, 'phone', p.phone,
      'total', (select count(*) from appointments a where a.client_id = p.id and a.consultant_id = cid and a.status <> 'rescheduled'),
      'completed', (select count(*) from appointments a where a.client_id = p.id and a.consultant_id = cid and a.status = 'completed'),
      'next', (select jsonb_build_object('id', a.id, 'date', to_char(a.date, 'YYYY-MM-DD'), 'start_time', to_char(a.start_time, 'HH24:MI'),
          'service_name', a.service_name, 'status', a.status, 'reference', a.reference, 'client_name', p.full_name,
          'consultant_name', (select display_name from consultants where id = cid), 'consultant_id', cid,
          'duration_minutes', a.duration_minutes)
        from appointments a where a.client_id = p.id and a.consultant_id = cid and a.status in ('pending','confirmed') and a.date >= current_date
        order by a.date limit 1),
      'last', (select max(a.date) from appointments a where a.client_id = p.id and a.consultant_id = cid and a.status = 'completed'))
    order by p.full_name)
  from profiles p where p.id in (
    select client_id from appointments where consultant_id = cid
    union select client_id from projects where primary_consultant_id = cid
  )), '[]'::jsonb);
end $$;

create or replace function public.consultant_analyses()
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare cid uuid;
begin
  cid := public.my_consultant_id();
  if cid is null then raise exception 'Profili i konsulentit nuk u gjet.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'project_id', t.project_id, 'name', t.name,
      'task_order', t.task_order, 'status', t.status, 'progress', t.progress, 'notes', t.notes,
      'assigned_consultant_id', t.assigned_consultant_id, 'completed_at', t.completed_at,
      'project_title', p.title) order by p.title, t.task_order)
  from analysis_tasks t join projects p on p.id = t.project_id
  where p.primary_consultant_id = cid
     or exists (select 1 from project_consultants pc where pc.project_id = p.id and pc.consultant_id = cid)), '[]'::jsonb);
end $$;

-- ═══ GDPR ═══════════════════════════════════════════════════════════════════
create or replace function public.client_export_data()
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Kërkohet kyçja.'; end if;
  return jsonb_build_object(
    'exported_at', now(),
    'profile', (select row_to_json(p) from profiles p where p.id = me),
    'appointments', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from appointments a where a.client_id = me),
    'projects', (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from projects p where p.client_id = me),
    'files', (select coalesce(jsonb_agg(to_jsonb(f) - 'file_path'), '[]'::jsonb) from project_files f where f.client_id = me),
    'payments', (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from payments p where p.client_id = me),
    'invoices', (select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) from invoices i where i.client_id = me),
    'consents', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from consents c where c.user_id = me)
  );
end $$;

create or replace function public.client_delete_account()
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Kërkohet kyçja.'; end if;
  if not exists (select 1 from profiles where id = me and role = 'client') then
    raise exception 'Vetëm llogaritë e klientëve mund të fshihen vetë.';
  end if;
  delete from consents where user_id = me;
  delete from reviews where client_id = me;
  delete from payments where client_id = me;
  delete from invoices where client_id = me;
  delete from project_files where client_id = me;
  delete from appointments where client_id = me;
  delete from projects where client_id = me;
  delete from profiles where id = me;
  delete from auth.users where id = me;
end $$;

-- ═══ grants ═════════════════════════════════════════════════════════════════
grant execute on function public.book_appointment(jsonb) to anon, authenticated;
grant execute on function public.manage_view(uuid) to anon, authenticated;
grant execute on function public.appointment_token_slots(uuid, date) to anon, authenticated;
grant execute on function public.reschedule_by_token(uuid, date, time) to anon, authenticated;
grant execute on function public.cancel_by_token(uuid, text) to anon, authenticated;
grant execute on function public.consultant_day_slots(uuid, date, integer) to anon, authenticated;
grant execute on function public.consultant_month_capacity(uuid, integer, integer, integer) to anon, authenticated;
grant execute on function public.match_consultant(uuid, text) to anon, authenticated;
grant execute on function public.first_available_offer(uuid) to anon, authenticated;
grant execute on function public.public_directory() to anon, authenticated;
grant execute on function public.consultant_profile_public(text) to anon, authenticated;
grant execute on function public.ensure_profile() to authenticated;
grant execute on function public.log_activity(text, text, text, text) to authenticated;
grant execute on function public.client_overview() to authenticated;
grant execute on function public.consultant_overview() to authenticated;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_analytics(date, date) to authenticated;
grant execute on function public.admin_clients() to authenticated;
grant execute on function public.admin_consultants() to authenticated;
grant execute on function public.consultant_earnings() to authenticated;
grant execute on function public.consultant_clients() to authenticated;
grant execute on function public.consultant_analyses() to authenticated;
grant execute on function public.set_appointment_status(uuid, text) to authenticated;
grant execute on function public.complete_appointment(uuid, jsonb) to authenticated;
grant execute on function public.save_appointment_notes(uuid, text) to authenticated;
grant execute on function public.reschedule_by_staff(uuid, date, time) to authenticated;
grant execute on function public.cancel_by_staff(uuid, text) to authenticated;
grant execute on function public.pay_payment(uuid, text) to authenticated;
grant execute on function public.refund_payment(uuid) to authenticated;
grant execute on function public.set_payout_status(uuid, text) to authenticated;
grant execute on function public.admin_create_consultant(text, text, text, integer, jsonb, jsonb) to authenticated;
grant execute on function public.reminder_sweep() to authenticated;
grant execute on function public.client_export_data() to authenticated;
grant execute on function public.client_delete_account() to authenticated;
grant execute on function public.next_invoice_number() to authenticated;
