import type {
  DB, Session, User, Appointment, Payment, Invoice, ProjectFile, Project,
  Review, FileCategory, NotificationType, Lang,
} from "../types";
import {
  getDB, mutate, read, getSession, setSession, requireSession, requireRole,
  requireAdmin, requireStaff, AccessError, logActivity, addNotification,
  notifyAdmins, registerSignedToken, consumeSignedToken,
} from "./db";
import { computeSlots, hasOverlap, autoMatch, firstAvailableOffering, monthCapacity } from "./availability";
import {
  uid, token as genToken, nowISO, todayISO, timeToMin, minToTime, hashPw,
  hoursBetween, refNumber, invoiceNumber, downloadBlob, addDaysISO, fmtEuro,
} from "./utils";

// ═════════════════════════════════════════════════════════════════════════════
// AUTH
// ═════════════════════════════════════════════════════════════════════════════

export async function login(email: string, password: string): Promise<Session> {
  const session = await read((db) => {
    const u = db.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!u || u.password_hash !== hashPw(password)) throw new AccessError("Email ose fjalëkalim i pasaktë.");
    if (u.status !== "active") throw new AccessError("Kjo llogari është çaktivizuar.");
    return { user_id: u.id, user: u };
  });
  setSession(session.user_id);
  return session;
}

export async function registerClient(data: { full_name: string; email: string; phone: string; password: string }): Promise<Session> {
  const session = await mutate((db) => {
    if (db.users.some((u) => u.email.toLowerCase() === data.email.trim().toLowerCase()))
      throw new AccessError("Ekziston një llogari me këtë email. Kycuni.");
    const u: User = {
      id: uid("u-"), email: data.email.trim(), password_hash: hashPw(data.password),
      full_name: data.full_name.trim(), phone: data.phone, avatar_color: "#1b44cc",
      role: "client", preferred_language: "sq", status: "active",
      created_at: nowISO(), updated_at: nowISO(),
    };
    db.users.push(u);
    for (const t of ["privacy", "terms", "data_processing"] as const)
      db.consents.push({ id: uid("cns-"), user_id: u.id, consent_type: t, consent_version: "1.2", accepted_at: nowISO() });
    logActivity(db, u.id, u.full_name, "client", "account.created", "user", u.id, "Regjistrim i ri klienti");
    return { user_id: u.id, user: u };
  });
  setSession(session.user_id);
  return session;
}

export function logout(): void { setSession(null); }

export async function updateProfile(session: Session | null, patch: Partial<Pick<User, "full_name" | "phone" | "preferred_language">>): Promise<void> {
  const s = requireSession(session);
  await mutate((db) => {
    const u = db.users.find((x) => x.id === s.user_id);
    if (!u) throw new AccessError();
    Object.assign(u, patch, { updated_at: nowISO() });
    logActivity(db, u.id, u.full_name, u.role, "profile.updated", "user", u.id, "Profili u përditësua");
  });
}

export async function exportMyData(session: Session | null): Promise<void> {
  const s = requireSession(session);
  await read((db) => {
    const mine = {
      profile: { ...s.user, password_hash: "[redacted]" },
      appointments: db.appointments.filter((a) => a.client_id === s.user_id),
      projects: db.projects.filter((p) => p.client_id === s.user_id),
      files: db.files.filter((f) => f.client_id === s.user_id),
      payments: db.payments.filter((p) => p.client_id === s.user_id),
      invoices: db.invoices.filter((i) => i.client_id === s.user_id),
      consents: db.consents.filter((c) => c.user_id === s.user_id),
    };
    downloadBlob("statlab-te-dhenat-e-mia.json", JSON.stringify(mine, null, 2), "application/json");
  });
}

export async function deleteMyAccount(session: Session | null): Promise<void> {
  const s = requireSession(session);
  if (s.user.role !== "client") throw new AccessError("Vetëm llogaritë e klientëve mund të fshihen vetë.");
  await mutate((db) => {
    const u = db.users.find((x) => x.id === s.user_id);
    if (!u) return;
    const anon = "anon-" + u.id.slice(-6) + "@deleted.statlab";
    u.email = anon; u.full_name = "Llogari e fshirë"; u.phone = ""; u.status = "deactivated";
    for (const a of db.appointments) if (a.client_id === u.id) { a.client_name = "I anonimizuar"; a.client_email = anon; a.client_phone = ""; }
    logActivity(db, null, "Sistemi", "system", "account.anonymized", "user", u.id, "Kërkesë GDPR — anonimzim");
  });
  setSession(null);
}

// ═════════════════════════════════════════════════════════════════════════════
// PUBLIC DIRECTORY
// ═════════════════════════════════════════════════════════════════════════════

export interface PublicConsultant {
  id: string; slug: string; display_name: string; professional_title: string; bio: string;
  education: string[]; certifications: string[]; years_experience: number; languages: string[];
  specializations: string[]; rating: number; review_count: number; is_featured: boolean;
  starting_price: number; services: { service_id: string; name: string; price: number; duration_minutes: number; category: string }[];
  next: { date: string; time: string } | null;
  weekly: { day: number; windows: string[] }[];
}

function toPublic(db: DB, c: DB["consultants"][number]): PublicConsultant {
  const offers = db.consultant_services
    .filter((x) => x.consultant_id === c.id && x.is_active)
    .map((x) => {
      const svc = db.services.find((s) => s.id === x.service_id);
      return { service_id: x.service_id, name: svc?.name ?? "", price: x.price, duration_minutes: x.duration_minutes, category: svc?.category ?? "" };
    })
    .filter((x) => x.name && db.services.find((s) => s.id === x.service_id)?.is_active);
  const starting_price = offers.length ? Math.min(...offers.map((o) => o.price)) : 0;
  const minDur = offers.length ? Math.min(...offers.map((o) => o.duration_minutes)) : 60;
  // inline next-available scan
  let next: { date: string; time: string } | null = null;
  const t = todayISO();
  for (let i = 0; i < 30 && !next; i++) {
    const date = addDaysISO(t, i);
    const slots = computeSlots(db, c.id, date, minDur);
    if (slots.length) next = { date, time: slots[0] };
  }
  const weekly = [1, 2, 3, 4, 5, 6, 7].map((day) => ({
    day,
    windows: db.availability.filter((a) => a.consultant_id === c.id && a.day_of_week === day && a.is_available)
      .map((a) => `${a.start_time}–${a.end_time}`),
  })).filter((d) => d.windows.length > 0);
  return {
    id: c.id, slug: c.slug, display_name: c.display_name, professional_title: c.professional_title,
    bio: c.bio, education: c.education, certifications: c.certifications,
    years_experience: c.years_experience, languages: c.languages, specializations: c.specializations,
    rating: c.rating, review_count: c.review_count, is_featured: c.is_featured,
    starting_price, services: offers, next, weekly,
  };
}

export async function listPublicConsultants(): Promise<PublicConsultant[]> {
  return read((db) => db.consultants.filter((c) => c.is_active && c.status === "active").map((c) => toPublic(db, c)));
}

export async function getConsultantBySlug(slug: string): Promise<{ consultant: PublicConsultant; reviews: Review[] } | null> {
  return read((db) => {
    const c = db.consultants.find((x) => x.slug === slug && x.is_active && x.status === "active");
    if (!c) return null;
    const reviews = db.reviews.filter((r) => r.consultant_id === c.id && r.status === "published");
    return { consultant: toPublic(db, c), reviews };
  });
}

export async function getConsultantById(id: string): Promise<PublicConsultant | null> {
  return read((db) => {
    const c = db.consultants.find((x) => x.id === id);
    return c ? toPublic(db, c) : null;
  });
}

export async function listActiveServices() {
  return read((db) => db.services.filter((s) => s.is_active));
}

export async function previewMatch(serviceId: string, language?: string) {
  return read((db) => {
    const m = autoMatch(db, serviceId, language);
    if (!m) return null;
    const c = db.consultants.find((x) => x.id === m.consultantId);
    return c ? { consultant: toPublic(db, c), reasons: m.reasons, score: m.score } : null;
  });
}

export async function previewFirstAvailable(serviceId: string) {
  return read((db) => {
    const svc = db.services.find((s) => s.id === serviceId);
    const fa = firstAvailableOffering(db, serviceId, svc?.default_duration_minutes ?? 60);
    if (!fa) return null;
    const c = db.consultants.find((x) => x.id === fa.consultantId);
    return c ? { consultant: toPublic(db, c), date: fa.date, time: fa.time } : null;
  });
}

export async function bookingSlots(consultantId: string, dateISO: string, duration: number): Promise<string[]> {
  return read((db) => computeSlots(db, consultantId, dateISO, duration));
}

export async function bookingMonthCapacity(consultantId: string, year: number, month: number, duration: number): Promise<Record<string, string>> {
  return read((db) => Object.fromEntries(monthCapacity(db, consultantId, year, month, duration)));
}

export async function getIntakeForService(serviceId: string) {
  return read((db) => {
    const svc = db.services.find((s) => s.id === serviceId);
    if (!svc) return null;
    let cat = "consultation";
    if (svc.id === "s-reg" || svc.slug.includes("regresion")) cat = "regression";
    else if (["s-bach", "s-master", "s-phd"].includes(svc.id) || svc.category === "thesis") cat = "thesis";
    else if (svc.id === "s-quest" || svc.category === "survey") cat = "questionnaire";
    else if (svc.category === "analysis") cat = "analysis";
    return db.intake_templates.find((t) => t.category === cat) ?? null;
  });
}

export async function listAllServicesAdmin(session: Session | null) {
  requireAdmin(session);
  return read((db) => db.services);
}

export async function getPublicReviews(): Promise<(Review & { client_name: string; consultant_name: string; service_name: string })[]> {
  return read((db) =>
    db.reviews.filter((r) => r.status === "published" && r.consent_to_publish).map((r) => ({
      ...r,
      client_name: r.show_name ? (db.users.find((u) => u.id === r.client_id)?.full_name ?? "Klient") : "Klient i verifikuar",
      consultant_name: db.consultants.find((c) => c.id === r.consultant_id)?.display_name ?? "",
      service_name: db.services.find((s) => s.id === db.appointments.find((a) => a.id === r.appointment_id)?.service_id)?.name ?? "Konsulencë",
    })),
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// BOOKING
// ═════════════════════════════════════════════════════════════════════════════

export interface BookingPayload {
  service_id: string;
  consultant_mode: "specific" | "first_available" | "best_match";
  consultant_id?: string;
  date: string;
  start_time: string;
  client: {
    first_name: string; last_name: string; email: string; phone: string;
    university: string; study_level: Appointment["study_level"]; language: string;
    research_topic: string; problem_description: string;
    spss_experience: Appointment["spss_experience"]; required_analysis: string;
  };
  intake: Record<string, string>;
  file?: { name: string; size: number; type: string; category: FileCategory } | null;
  payment_choice: "pay_now_full" | "pay_now_deposit" | "pay_later";
  consents: { privacy: boolean; terms: boolean; data: boolean };
}

export interface BookingResult {
  appointment: Appointment;
  created_account: boolean;
  temp_password: string | null;
  invoice: Invoice | null;
  match_reasons: string[];
}

function splitFee(db: DB, consultantId: string, gross: number): { fee: number; net: number } {
  const c = db.consultants.find((x) => x.id === consultantId);
  const pct = (c?.commission_percentage ?? db.settings.default_commission) / 100;
  const fee = +(gross * pct).toFixed(2);
  return { fee, net: +(gross - fee).toFixed(2) };
}

function issueInvoice(db: DB, payment: Payment, status: Invoice["status"]): Invoice {
  const taxRate = db.settings.tax_rate / 100;
  const net = +(payment.amount_gross / (1 + taxRate)).toFixed(2);
  const inv: Invoice = {
    id: uid("inv-"), invoice_number: invoiceNumber(db.settings.counter_invoice++),
    client_id: payment.client_id, appointment_id: payment.appointment_id, project_id: payment.project_id,
    payment_id: payment.id, amount_net: net, tax_amount: +(payment.amount_gross - net).toFixed(2),
    amount_total: payment.amount_gross, currency: "EUR", status,
    issue_date: todayISO(), due_date: addDaysISO(todayISO(), 14), pdf_path: null, created_at: nowISO(),
  };
  db.invoices.unshift(inv);
  payment.invoice_id = inv.id;
  return inv;
}

export async function createBooking(session: Session | null, payload: BookingPayload): Promise<BookingResult> {
  return mutate((db) => {
    const service = db.services.find((s) => s.id === payload.service_id && s.is_active);
    if (!service) throw new AccessError("Shërbimi nuk është më aktiv.");
    if (!payload.date || !payload.start_time) throw new AccessError("Zgjidhni datën dhe orën.");
    if (payload.date < todayISO()) throw new AccessError("Data nuk mund të jetë në të kaluarën.");
    if (!payload.consents.privacy || !payload.consents.terms)
      throw new AccessError("Duhet të pranoni kushtet dhe politikën e privatësisë.");

    // ── resolve consultant ──
    let consultantId = payload.consultant_id;
    let matchReasons: string[] = [];
    if (payload.consultant_mode === "specific") {
      if (!consultantId) throw new AccessError("Zgjidhni konsulentin.");
      const c = db.consultants.find((x) => x.id === consultantId && x.is_active && x.status === "active");
      if (!c) throw new AccessError("Konsulenti nuk është i disponueshëm.");
    } else if (payload.consultant_mode === "first_available") {
      const fa = firstAvailableOffering(db, service.id, service.default_duration_minutes);
      if (!fa) throw new AccessError("Nuk ka termin të lirë për këtë shërbim.");
      consultantId = fa.consultantId;
      matchReasons = ["Konsulenti i parë i lirë që ofron shërbimin"];
    } else {
      const m = autoMatch(db, service.id, payload.client.language);
      if (!m) throw new AccessError("Asnjë konsulent i përshtatshëm nuk u gjet.");
      consultantId = m.consultantId;
      matchReasons = m.reasons;
    }
    const consultant = db.consultants.find((x) => x.id === consultantId)!;
    const offer = db.consultant_services.find((x) => x.consultant_id === consultantId && x.service_id === service.id && x.is_active);
    if (!offer) throw new AccessError("Ky konsulent nuk e ofron shërbimin e zgjedhur.");
    const duration = offer.duration_minutes;
    const price = offer.price;

    // ── SERVER-SIDE availability revalidation (anti double-booking) ──
    const slots = computeSlots(db, consultantId, payload.date, duration);
    if (!slots.includes(payload.start_time))
      throw new AccessError("Ky orar sapo u plotësua ose nuk është më i disponueshëm. Zgjidhni një orar tjetër.");
    const startMin = timeToMin(payload.start_time);
    if (hasOverlap(db, consultantId, payload.date, startMin, startMin + duration))
      throw new AccessError("U zbulua konflikt orari — rezervimi u refuzua nga sistemi.");

    // ── client account (find-or-create) ──
    let createdAccount = false;
    let tempPassword: string | null = null;
    let clientId: string;
    const email = payload.client.email.trim().toLowerCase();
    if (session && session.user.role === "client") {
      clientId = session.user_id;
      const u = db.users.find((x) => x.id === clientId)!;
      u.full_name = `${payload.client.first_name} ${payload.client.last_name}`.trim() || u.full_name;
      u.phone = payload.client.phone || u.phone;
    } else {
      const existing = db.users.find((x) => x.email.toLowerCase() === email);
      if (existing && existing.role !== "client") throw new AccessError("Ky email i përket një roli tjetër. Kycuni.");
      if (existing) {
        clientId = existing.id;
        existing.phone = payload.client.phone || existing.phone;
      } else {
        tempPassword = "statlab-" + Math.random().toString(36).slice(2, 8);
        const nu: User = {
          id: uid("u-"), email, password_hash: hashPw(tempPassword),
          full_name: `${payload.client.first_name} ${payload.client.last_name}`.trim(),
          phone: payload.client.phone, avatar_color: "#0e8f96", role: "client",
          preferred_language: "sq", status: "active", created_at: nowISO(), updated_at: nowISO(),
        };
        db.users.push(nu);
        for (const t of ["privacy", "terms", "data_processing"] as const)
          db.consents.push({ id: uid("cns-"), user_id: nu.id, consent_type: t, consent_version: "1.2", accepted_at: nowISO() });
        clientId = nu.id;
        createdAccount = true;
      }
    }
    db.consents.push({ id: uid("cns-"), user_id: clientId, consent_type: "confidentiality", consent_version: "1.0", accepted_at: nowISO() });

    const clientName = `${payload.client.first_name} ${payload.client.last_name}`.trim();
    const apptRef = refNumber(db.settings.counter_appointment++);

    // ── payment ──
    const paysNow = payload.payment_choice !== "pay_later";
    const amount = payload.payment_choice === "pay_now_deposit" ? service.deposit_amount || Math.round(price * 0.3) : price;
    const payType: Payment["type"] = payload.payment_choice === "pay_now_deposit" ? "deposit" : "full";
    const { fee, net } = splitFee(db, consultantId, amount);

    const apptId = uid("a-");
    const confirmed = paysNow; // verified payment auto-confirms the booking
    const meetingUrl = confirmed ? `https://meet.google.com/${genToken(3)}-${genToken(4)}-${genToken(3)}` : null;

    const appointment: Appointment = {
      id: apptId, reference: apptRef, manage_token: genToken(28),
      client_id: clientId, client_name: clientName, client_email: email, client_phone: payload.client.phone,
      consultant_id: consultantId, service_id: service.id, project_id: null,
      date: payload.date, start_time: payload.start_time, end_time: minToTime(startMin + duration),
      duration_minutes: duration, price, currency: "EUR",
      status: confirmed ? "confirmed" : "pending",
      language: payload.client.language, university: payload.client.university,
      study_level: payload.client.study_level, research_topic: payload.client.research_topic,
      problem_description: payload.client.problem_description, spss_experience: payload.client.spss_experience,
      required_analysis: payload.client.required_analysis, intake: payload.intake,
      payment_status: paysNow ? (payType === "deposit" ? "deposit_paid" : "paid") : "unpaid",
      payment_policy: service.payment_policy,
      meeting_provider: confirmed ? "google_meet" : "none", meeting_url: meetingUrl,
      external_event_id: confirmed && consultant.google_calendar_connected ? "gcal-" + genToken(8) : null,
      internal_notes: "", completion: null, history: [], rescheduled_from: null, created_at: nowISO(),
    };
    db.appointments.unshift(appointment);

    let invoice: Invoice | null = null;
    const payment: Payment = {
      id: uid("pay-"), appointment_id: apptId, project_id: null, client_id: clientId,
      consultant_id: consultantId, amount_gross: amount, platform_fee: fee, consultant_net: net,
      currency: "EUR", status: paysNow ? "paid" : "pending", payout_status: "pending",
      type: payType, method: "stripe", invoice_id: null, created_at: nowISO(),
      paid_at: paysNow ? nowISO() : null,
    };
    db.payments.unshift(payment);
    invoice = issueInvoice(db, payment, paysNow ? "paid" : "issued");

    if (payload.file) {
      db.files.unshift({
        id: uid("f-"), client_id: clientId, project_id: null, appointment_id: apptId,
        uploaded_by: clientId, file_name: payload.file.name,
        file_path: "private/files/" + uid("fp-") + "/" + payload.file.name,
        file_type: payload.file.type, file_size: payload.file.size, category: payload.file.category,
        content_note: "Ngarkuar gjatë rezervimit " + apptRef, created_at: nowISO(),
      });
    }

    // ── notifications ──
    const svcName = service.name;
    notifyAdmins(db, "booking_received", `Rezervim i ri — ${apptRef}`, `${clientName} rezervoi ${svcName} me ${consultant.display_name} më ${payload.date} në ${payload.start_time}.`, apptId);
    addNotification(db, consultant.user_id, db.users.find((u) => u.id === consultant.user_id)?.email ?? "", "consultant_assigned", "Termin i ri", `${svcName} me ${clientName} më ${payload.date} në ${payload.start_time}.`, apptId);
    addNotification(db, clientId, email, confirmed ? "booking_confirmed" : "booking_received",
      confirmed ? `Rezervimi u konfirmua — ${apptRef}` : `Rezervimi u pranua — ${apptRef}`,
      confirmed
        ? `${svcName} me ${consultant.display_name} më ${payload.date} në ${payload.start_time}. Linku i takimit: ${meetingUrl}`
        : `Rezervimi juaj po pret konfirmimin nga platforma. Referenca: ${apptRef}.`,
      apptId);
    if (paysNow) addNotification(db, clientId, email, "payment_received", `Pagesa u pranua — ${fmtEuro(amount)}`, `Fatura ${invoice.invoice_number} u lëshua.`, apptId);

    logActivity(db, clientId, clientName, "client", "appointment.created", "appointment", apptId, `${svcName} me ${consultant.display_name} — ${payload.date} ${payload.start_time}`);
    if (paysNow) logActivity(db, null, "Sistemi", "system", "payment.received", "payment", payment.id, `${fmtEuro(amount)} — ${clientName}`);

    return { appointment, created_account: createdAccount, temp_password: tempPassword, invoice, match_reasons: matchReasons };
  });
}

// ── appointment queries ──

export interface AppointmentRow extends Appointment {
  service_name: string; consultant_name: string; consultant_slug: string; client_user?: User;
}

function withJoins(db: DB, a: Appointment): AppointmentRow {
  const c = db.consultants.find((x) => x.id === a.consultant_id);
  return {
    ...a,
    service_name: db.services.find((s) => s.id === a.service_id)?.name ?? "—",
    consultant_name: c?.display_name ?? "—",
    consultant_slug: c?.slug ?? "",
    client_user: db.users.find((u) => u.id === a.client_id),
  };
}

export async function listAppointments(
  session: Session | null,
  filter: { status?: string; search?: string; consultant_id?: string; from?: string; to?: string; upcoming?: boolean } = {},
): Promise<AppointmentRow[]> {
  const s = requireSession(session);
  return read((db) => {
    let rows = db.appointments;
    if (s.user.role === "consultant") {
      const c = db.consultants.find((x) => x.user_id === s.user_id);
      rows = rows.filter((a) => a.consultant_id === c?.id);
    } else if (s.user.role === "client") {
      rows = rows.filter((a) => a.client_id === s.user_id);
    } else if (!["admin", "super_admin"].includes(s.user.role)) throw new AccessError();
    if (filter.consultant_id) rows = rows.filter((a) => a.consultant_id === filter.consultant_id);
    if (filter.status && filter.status !== "all") rows = rows.filter((a) => a.status === filter.status);
    if (filter.from) rows = rows.filter((a) => a.date >= filter.from!);
    if (filter.to) rows = rows.filter((a) => a.date <= filter.to!);
    if (filter.search) {
      const q = filter.search.toLowerCase();
      rows = rows.filter((a) =>
        a.client_name.toLowerCase().includes(q) || a.reference.toLowerCase().includes(q) ||
        (db.services.find((x) => x.id === a.service_id)?.name ?? "").toLowerCase().includes(q) ||
        a.research_topic.toLowerCase().includes(q));
    }
    if (filter.upcoming) {
      const t = todayISO();
      rows = rows.filter((a) => a.date >= t && a.status !== "cancelled" && a.status !== "rescheduled");
    }
    return [...rows]
      .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time))
      .map((a) => withJoins(db, a));
  });
}

export async function getAppointment(session: Session | null, id: string): Promise<AppointmentRow> {
  const s = requireSession(session);
  return read((db) => {
    const a = db.appointments.find((x) => x.id === id);
    if (!a) throw new AccessError("Termini nuk u gjet.");
    if (s.user.role === "client" && a.client_id !== s.user_id) throw new AccessError();
    if (s.user.role === "consultant") {
      const c = db.consultants.find((x) => x.user_id === s.user_id);
      if (a.consultant_id !== c?.id) throw new AccessError();
    }
    return withJoins(db, a);
  });
}

function changeApptStatus(db: DB, s: Session, id: string, status: Appointment["status"], notifyType: NotificationType, subject: string, actorAction: string) {
  const a = db.appointments.find((x) => x.id === id);
  if (!a) throw new AccessError("Termini nuk u gjet.");
  if (s.user.role === "consultant") {
    const c = db.consultants.find((x) => x.user_id === s.user_id);
    if (a.consultant_id !== c?.id) throw new AccessError();
  } else if (s.user.role === "client" && a.client_id !== s.user_id) throw new AccessError();
  a.status = status;
  addNotification(db, a.client_id, a.client_email, notifyType, subject, `Referenca: ${a.reference}.`, a.id);
  const cons = db.consultants.find((c) => c.id === a.consultant_id);
  if (cons && s.user.role !== "consultant")
    addNotification(db, cons.user_id, db.users.find((u) => u.id === cons.user_id)?.email ?? "", notifyType, subject, `Referenca: ${a.reference}.`, a.id);
  logActivity(db, s.user_id, s.user.full_name, s.user.role, actorAction, "appointment", a.id, `${a.reference} → ${status}`);
  return a;
}

export async function confirmAppointment(session: Session | null, id: string): Promise<void> {
  const s = requireStaff(session);
  await mutate((db) => {
    const a = changeApptStatus(db, s, id, "confirmed", "booking_confirmed", "Rezervimi juaj u konfirmua", "appointment.confirmed");
    if (!a.meeting_url) {
      a.meeting_provider = "google_meet";
      a.meeting_url = `https://meet.google.com/${genToken(3)}-${genToken(4)}-${genToken(3)}`;
      const cons = db.consultants.find((c) => c.id === a.consultant_id);
      if (cons?.google_calendar_connected && !a.external_event_id) a.external_event_id = "gcal-" + genToken(8);
      addNotification(db, a.client_id, a.client_email, "booking_confirmed", "Linku i takimit u krijua", `Google Meet: ${a.meeting_url}`, a.id, true);
    }
  });
}

export async function markNoShow(session: Session | null, id: string): Promise<void> {
  const s = requireStaff(session);
  await mutate((db) => { void changeApptStatus(db, s, id, "no_show", "booking_cancelled", "Termini u shënua si mungesë", "appointment.no_show"); });
}

export async function completeAppointment(
  session: Session | null, id: string,
  completion: NonNullable<Appointment["completion"]>,
): Promise<void> {
  const s = requireStaff(session);
  await mutate((db) => {
    const a = changeApptStatus(db, s, id, "completed", "consultation_completed", "Konsulta u përfundua — rezultatet janë në portal", "appointment.completed");
    a.completion = completion;
    const cons = db.consultants.find((c) => c.id === a.consultant_id);
    // if deposit policy → balance becomes due on completion
    if (a.payment_policy === "deposit" && a.payment_status === "deposit_paid") {
      const balance = db.payments.find((p) => p.appointment_id === a.id && p.type === "balance" && p.status === "pending");
      if (balance) addNotification(db, a.client_id, a.client_email, "payment_received", "Kujtesë: bilanci i mbetur", `Ju lutemi paguani balansin prej ${fmtEuro(balance.amount_gross)}.`, a.id, true);
    }
    logActivity(db, s.user_id, s.user.full_name, s.user.role, "consultation.summary", "appointment", a.id, `Përmbledhja u plotësua nga ${cons?.display_name ?? ""}`);
  });
}

export async function cancelAppointmentByStaff(session: Session | null, id: string, reason: string): Promise<void> {
  const s = requireStaff(session);
  await mutate((db) => {
    const a = changeApptStatus(db, s, id, "cancelled", "booking_cancelled", "Rezervimi u anulua", "appointment.cancelled");
    if (reason) a.internal_notes = (a.internal_notes ? a.internal_notes + "\n" : "") + `Arsyeja e anulimit: ${reason}`;
  });
}

// ── secure self-service management (reschedule / cancel by token) ──

export interface ManageView {
  appointment: AppointmentRow;
  can_reschedule: boolean; can_cancel: boolean;
  reschedule_reason: string; cancel_reason: string;
  min_reschedule_hours: number; min_cancel_hours: number;
}

export async function getManageView(manageToken: string): Promise<ManageView> {
  return read((db) => {
    const a = db.appointments.find((x) => x.manage_token === manageToken);
    if (!a) throw new AccessError("Linku i menaxhimit është i pavlefshëm ose ka skaduar.");
    const now = Date.now();
    const hrs = hoursBetween(now, a.date, a.start_time);
    const active = ["pending", "confirmed"].includes(a.status);
    const can_reschedule = active && hrs >= db.settings.min_reschedule_hours;
    const can_cancel = active && hrs >= db.settings.min_cancel_hours;
    return {
      appointment: withJoins(db, a),
      can_reschedule, can_cancel,
      reschedule_reason: !active ? "Termini nuk është më aktiv." : !can_reschedule ? `Rizhvendosja lejohet të paktën ${db.settings.min_reschedule_hours} orë para terminit.` : "",
      cancel_reason: !active ? "Termini nuk është më aktiv." : !can_cancel ? `Anulimi lejohet të paktën ${db.settings.min_cancel_hours} orë para terminit.` : "",
      min_reschedule_hours: db.settings.min_reschedule_hours,
      min_cancel_hours: db.settings.min_cancel_hours,
    };
  });
}

export async function rescheduleByToken(manageToken: string, newDate: string, newStart: string): Promise<Appointment> {
  return mutate((db) => {
    const old = db.appointments.find((x) => x.manage_token === manageToken);
    if (!old) throw new AccessError("Linku i menaxhimit është i pavlefshëm.");
    if (!["pending", "confirmed"].includes(old.status)) throw new AccessError("Ky termin nuk mund të rizhvendoset më.");
    const hrs = hoursBetween(Date.now(), old.date, old.start_time);
    if (hrs < db.settings.min_reschedule_hours)
      throw new AccessError(`Rizhvendosja lejohet të paktën ${db.settings.min_reschedule_hours} orë para terminit.`);
    return doReschedule(db, old, newDate, newStart, old.client_name, "client");
  });
}

export async function rescheduleByStaff(session: Session | null, id: string, newDate: string, newStart: string): Promise<Appointment> {
  const s = requireStaff(session);
  return mutate((db) => {
    const old = db.appointments.find((x) => x.id === id);
    if (!old) throw new AccessError("Termini nuk u gjet.");
    if (s.user.role === "consultant") {
      const c = db.consultants.find((x) => x.user_id === s.user_id);
      if (old.consultant_id !== c?.id) throw new AccessError();
    }
    return doReschedule(db, old, newDate, newStart, s.user.full_name, s.user.role);
  });
}

function doReschedule(db: DB, old: Appointment, newDate: string, newStart: string, changedBy: string, changedByRole: string): Appointment {
  const duration = old.duration_minutes;
  // real-time availability check (never trusts the client calendar)
  const slots = computeSlots(db, old.consultant_id, newDate, duration);
  if (!slots.includes(newStart))
    throw new AccessError("Orari i zgjedhur nuk është më i disponueshëm.");
  const startMin = timeToMin(newStart);
  if (hasOverlap(db, old.consultant_id, newDate, startMin, startMin + duration, old.id))
    throw new AccessError("Konflikt orari u zbulua — provoni një orar tjetër.");

  const fresh: Appointment = {
    ...old,
    id: uid("a-"),
    date: newDate,
    start_time: newStart,
    end_time: minToTime(startMin + duration),
    status: old.status === "pending" ? "pending" : "confirmed",
    history: [...old.history, {
      old_date: old.date, old_start: old.start_time, new_date: newDate, new_start: newStart,
      changed_by: changedBy, changed_by_role: changedByRole, changed_at: nowISO(),
    }],
    rescheduled_from: old.id,
    created_at: nowISO(),
  };
  old.status = "rescheduled";
  db.appointments.unshift(fresh);
  // move linked payments/invoices to the new record
  for (const p of db.payments) if (p.appointment_id === old.id) p.appointment_id = fresh.id;
  for (const i of db.invoices) if (i.appointment_id === old.id) i.appointment_id = fresh.id;

  const subject = "Rezervimi u rizhvendos";
  const body = `Termini i ri: ${newDate} në ${newStart}. Referenca: ${fresh.reference}.`;
  addNotification(db, fresh.client_id, fresh.client_email, "booking_rescheduled", subject, body, fresh.id);
  const cons = db.consultants.find((c) => c.id === fresh.consultant_id);
  if (cons) addNotification(db, cons.user_id, db.users.find((u) => u.id === cons.user_id)?.email ?? "", "booking_rescheduled", subject, body, fresh.id);
  logActivity(db, null, changedBy, changedByRole, "appointment.rescheduled", "appointment", fresh.id, `Nga ${old.date} ${old.start_time} në ${newDate} ${newStart}`);
  return fresh;
}

export async function cancelByToken(manageToken: string, reason: string): Promise<void> {
  await mutate((db) => {
    const a = db.appointments.find((x) => x.manage_token === manageToken);
    if (!a) throw new AccessError("Linku i menaxhimit është i pavlefshëm.");
    if (!["pending", "confirmed"].includes(a.status)) throw new AccessError("Ky termin nuk mund të anulohet më.");
    const hrs = hoursBetween(Date.now(), a.date, a.start_time);
    if (hrs < db.settings.min_cancel_hours)
      throw new AccessError(`Anulimi lejohet të paktën ${db.settings.min_cancel_hours} orë para terminit.`);
    a.status = "cancelled";
    if (reason) a.internal_notes = (a.internal_notes ? a.internal_notes + "\n" : "") + `Anuluar nga klienti: ${reason}`;
    const subject = "Rezervimi u anulua";
    addNotification(db, a.client_id, a.client_email, "booking_cancelled", subject, `Referenca: ${a.reference}.`, a.id);
    const cons = db.consultants.find((c) => c.id === a.consultant_id);
    if (cons) addNotification(db, cons.user_id, db.users.find((u) => u.id === cons.user_id)?.email ?? "", "booking_cancelled", subject, `${a.client_name} — ${a.date} ${a.start_time}`, a.id);
    notifyAdmins(db, "booking_cancelled", `Anulim — ${a.reference}`, `${a.client_name} anuloi terminin e ${a.date} ${a.start_time}.`, a.id);
    logActivity(db, a.client_id, a.client_name, "client", "appointment.cancelled", "appointment", a.id, a.reference);
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// PAYMENTS & INVOICES
// ═════════════════════════════════════════════════════════════════════════════

export async function listPayments(session: Session | null): Promise<(Payment & { client_name: string; consultant_name: string; service_name: string; reference: string })[]> {
  const s = requireSession(session);
  return read((db) => {
    let rows = db.payments;
    if (s.user.role === "client") rows = rows.filter((p) => p.client_id === s.user_id);
    else if (s.user.role === "consultant") {
      const c = db.consultants.find((x) => x.user_id === s.user_id);
      rows = rows.filter((p) => p.consultant_id === c?.id);
    }
    return rows.map((p) => {
      const appt = db.appointments.find((a) => a.id === p.appointment_id);
      return {
        ...p,
        client_name: db.users.find((u) => u.id === p.client_id)?.full_name ?? "—",
        consultant_name: db.consultants.find((c) => c.id === p.consultant_id)?.display_name ?? "—",
        service_name: appt ? db.services.find((x) => x.id === appt.service_id)?.name ?? "—" : "Projekt",
        reference: appt?.reference ?? "—",
      };
    }).sort((a, b) => b.created_at.localeCompare(a.created_at));
  });
}

/** Simulated Stripe checkout → server-side verification (amount recomputed, never trusted from UI). */
export async function verifyAndCompletePayment(session: Session | null, paymentId: string, outcome: "succeeded" | "failed"): Promise<void> {
  const s = requireSession(session);
  await mutate((db) => {
    const p = db.payments.find((x) => x.id === paymentId);
    if (!p) throw new AccessError("Pagesa nuk u gjet.");
    if (s.user.role === "client" && p.client_id !== s.user_id) throw new AccessError();
    if (p.status !== "pending") throw new AccessError("Kjo pagesë nuk është më në pritje.");
    // recompute expected amount from the appointment (server-side truth)
    const appt = db.appointments.find((a) => a.id === p.appointment_id);
    if (appt && p.type === "full" && Math.abs(appt.price - p.amount_gross) > 0.01)
      throw new AccessError("Verifikimi dështoi: shuma nuk përputhet me terminin.");
    if (outcome === "failed") {
      p.status = "failed";
      logActivity(db, s.user_id, s.user.full_name, s.user.role, "payment.failed", "payment", p.id, fmtEuro(p.amount_gross));
      return;
    }
    p.status = "paid";
    p.paid_at = nowISO();
    const inv = issueInvoice(db, p, "paid");
    if (appt) {
      appt.payment_status = p.type === "deposit" ? "deposit_paid" : "paid";
      if (appt.status === "pending" && p.type !== "balance") {
        appt.status = "confirmed";
        appt.meeting_provider = "google_meet";
        appt.meeting_url = appt.meeting_url ?? `https://meet.google.com/${genToken(3)}-${genToken(4)}-${genToken(3)}`;
        addNotification(db, appt.client_id, appt.client_email, "booking_confirmed", "Rezervimi u konfirmua", `Referenca: ${appt.reference}. Linku: ${appt.meeting_url}`, appt.id, true);
      }
      addNotification(db, appt.client_id, appt.client_email, "payment_received", `Pagesa u pranua — ${fmtEuro(p.amount_gross)}`, `Fatura ${inv.invoice_number} u lëshua.`, appt.id, true);
    }
    notifyAdmins(db, "payment_received", `Pagesë e re — ${fmtEuro(p.amount_gross)}`, `${p.client_id === s.user_id ? s.user.full_name : "Klient"} pagoi ${fmtEuro(p.amount_gross)}.`, p.appointment_id);
    logActivity(db, s.user_id, s.user.full_name, s.user.role, "payment.received", "payment", p.id, `${fmtEuro(p.amount_gross)} (${p.type})`);
  });
}

export async function refundPayment(session: Session | null, paymentId: string): Promise<void> {
  const s = requireAdmin(session);
  await mutate((db) => {
    const p = db.payments.find((x) => x.id === paymentId);
    if (!p) throw new AccessError();
    p.status = "refunded";
    const inv = db.invoices.find((i) => i.payment_id === p.id);
    if (inv) inv.status = "cancelled";
    const appt = db.appointments.find((a) => a.id === p.appointment_id);
    if (appt) appt.payment_status = "refunded";
    logActivity(db, s.user_id, s.user.full_name, s.user.role, "payment.refunded", "payment", p.id, fmtEuro(p.amount_gross));
  });
}

export async function setPayoutStatus(session: Session | null, paymentId: string, status: "approved" | "paid"): Promise<void> {
  const s = requireAdmin(session);
  await mutate((db) => {
    const p = db.payments.find((x) => x.id === paymentId);
    if (!p) throw new AccessError();
    p.payout_status = status;
    logActivity(db, s.user_id, s.user.full_name, s.user.role, "payout." + status, "payment", p.id, `${fmtEuro(p.consultant_net)} → ${p.consultant_id}`);
  });
}

export async function listInvoices(session: Session | null): Promise<(Invoice & { client_name: string; reference: string })[]> {
  const s = requireSession(session);
  return read((db) => {
    let rows = db.invoices;
    if (s.user.role === "client") rows = rows.filter((i) => i.client_id === s.user_id);
    else if (s.user.role === "consultant") throw new AccessError("Konsulentët nuk kanë akses në fatura.");
    return rows.map((i) => ({
      ...i,
      client_name: db.users.find((u) => u.id === i.client_id)?.full_name ?? "—",
      reference: db.appointments.find((a) => a.id === i.appointment_id)?.reference ?? "—",
    })).sort((a, b) => b.created_at.localeCompare(a.created_at));
  });
}

export async function getInvoice(session: Session | null, id: string): Promise<Invoice & { client_name: string; client_email: string; service_name: string; reference: string; consultant_name: string }> {
  const s = requireSession(session);
  return read((db) => {
    const inv = db.invoices.find((i) => i.id === id);
    if (!inv) throw new AccessError("Fatura nuk u gjet.");
    if (s.user.role === "client" && inv.client_id !== s.user_id) throw new AccessError();
    const appt = db.appointments.find((a) => a.id === inv.appointment_id);
    const client = db.users.find((u) => u.id === inv.client_id);
    return {
      ...inv,
      client_name: client?.full_name ?? "—", client_email: client?.email ?? "—",
      service_name: appt ? db.services.find((x) => x.id === appt.service_id)?.name ?? "—" : "—",
      reference: appt?.reference ?? "—",
      consultant_name: appt ? db.consultants.find((c) => c.id === appt.consultant_id)?.display_name ?? "—" : "—",
    };
  });
}

export async function setInvoiceStatus(session: Session | null, id: string, status: Invoice["status"]): Promise<void> {
  const s = requireAdmin(session);
  await mutate((db) => {
    const inv = db.invoices.find((i) => i.id === id);
    if (!inv) throw new AccessError();
    inv.status = status;
    if (status === "paid" && inv.payment_id) {
      const p = db.payments.find((x) => x.id === inv.payment_id);
      if (p && p.status === "pending") { p.status = "paid"; p.paid_at = nowISO(); }
    }
    logActivity(db, s.user_id, s.user.full_name, s.user.role, "invoice." + status, "invoice", inv.id, inv.invoice_number);
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// FILES (private storage + signed URLs)
// ═════════════════════════════════════════════════════════════════════════════

const ALLOWED_EXT = [".sav", ".spv", ".xlsx", ".csv", ".docx", ".pdf"];
export const MAX_FILE_MB = 25;

function canAccessFile(db: DB, s: Session, f: ProjectFile): boolean {
  if (["admin", "super_admin"].includes(s.user.role)) return true;
  if (s.user.role === "client") return f.client_id === s.user_id;
  if (s.user.role === "consultant") {
    const c = db.consultants.find((x) => x.user_id === s.user_id);
    if (!c) return false;
    if (f.appointment_id && db.appointments.some((a) => a.id === f.appointment_id && a.consultant_id === c.id)) return true;
    if (f.project_id) {
      const p = db.projects.find((x) => x.id === f.project_id);
      if (p?.primary_consultant_id === c.id) return true;
      if (db.project_consultants.some((pc) => pc.project_id === f.project_id && pc.consultant_id === c.id)) return true;
    }
  }
  return false;
}

export async function listFiles(session: Session | null, filter: { category?: string; search?: string } = {}): Promise<(ProjectFile & { project_title: string; client_name: string; uploader_name: string })[]> {
  const s = requireSession(session);
  return read((db) => {
    let rows = db.files.filter((f) => canAccessFile(db, s, f));
    if (s.user.role === "consultant") {
      const c = db.consultants.find((x) => x.user_id === s.user_id);
      rows = rows.filter((f) => {
        if (f.project_id) return db.projects.some((p) => p.id === f.project_id && p.primary_consultant_id === c?.id) ||
          db.project_consultants.some((pc) => pc.project_id === f.project_id && pc.consultant_id === c?.id);
        if (f.appointment_id) return db.appointments.some((a) => a.id === f.appointment_id && a.consultant_id === c?.id);
        return false;
      });
    }
    if (filter.category && filter.category !== "all") rows = rows.filter((f) => f.category === filter.category);
    if (filter.search) rows = rows.filter((f) => f.file_name.toLowerCase().includes(filter.search!.toLowerCase()));
    return rows.map((f) => ({
      ...f,
      project_title: f.project_id ? db.projects.find((p) => p.id === f.project_id)?.title ?? "—" : "—",
      client_name: db.users.find((u) => u.id === f.client_id)?.full_name ?? "—",
      uploader_name: db.users.find((u) => u.id === f.uploaded_by)?.full_name ?? "—",
    })).sort((a, b) => b.created_at.localeCompare(a.created_at));
  });
}

export async function uploadFile(
  session: Session | null,
  meta: { name: string; size: number; ext: string; category: FileCategory; project_id?: string | null; appointment_id?: string | null; note?: string },
): Promise<void> {
  const s = requireSession(session);
  await mutate((db) => {
    if (!ALLOWED_EXT.includes(meta.ext.toLowerCase()))
      throw new AccessError(`Format i palejuar. Lejohen: ${ALLOWED_EXT.join(", ")}`);
    if (meta.size > MAX_FILE_MB * 1024 * 1024) throw new AccessError(`Skedari tejkalon ${MAX_FILE_MB} MB.`);
    // ownership validation
    let clientId = s.user_id;
    if (s.user.role !== "client") {
      if (meta.project_id) {
        const p = db.projects.find((x) => x.id === meta.project_id);
        if (!p) throw new AccessError("Projekti nuk u gjet.");
        if (s.user.role === "consultant") {
          const c = db.consultants.find((x) => x.user_id === s.user_id);
          if (p.primary_consultant_id !== c?.id && !db.project_consultants.some((pc) => pc.project_id === p.id && pc.consultant_id === c?.id))
            throw new AccessError();
        }
        clientId = p.client_id;
      } else if (meta.appointment_id) {
        const a = db.appointments.find((x) => x.id === meta.appointment_id);
        if (!a) throw new AccessError();
        clientId = a.client_id;
        if (s.user.role === "consultant") {
          const c = db.consultants.find((x) => x.user_id === s.user_id);
          if (a.consultant_id !== c?.id) throw new AccessError();
        }
      } else throw new AccessError("Zgjidhni projektin ose terminin.");
    } else if (meta.project_id) {
      const p = db.projects.find((x) => x.id === meta.project_id);
      if (!p || p.client_id !== s.user_id) throw new AccessError();
    }
    const f: ProjectFile = {
      id: uid("f-"), client_id: clientId, project_id: meta.project_id ?? null,
      appointment_id: meta.appointment_id ?? null, uploaded_by: s.user_id,
      file_name: meta.name, file_path: "private/files/" + uid("fp-") + "/" + meta.name,
      file_type: meta.ext, file_size: meta.size, category: meta.category,
      content_note: meta.note ?? "", created_at: nowISO(),
    };
    db.files.unshift(f);
    // notify the other side
    const p = meta.project_id ? db.projects.find((x) => x.id === meta.project_id) : null;
    const a = meta.appointment_id ? db.appointments.find((x) => x.id === meta.appointment_id) : null;
    const consId = p?.primary_consultant_id ?? a?.consultant_id;
    const cons = db.consultants.find((c) => c.id === consId);
    if (s.user.role === "client" && cons)
      addNotification(db, cons.user_id, db.users.find((u) => u.id === cons.user_id)?.email ?? "", "new_file", "Skedar i ri nga klienti", meta.name, a?.id ?? null);
    if (s.user.role !== "client")
      addNotification(db, clientId, db.users.find((u) => u.id === clientId)?.email ?? "", "new_file", "Skedar i ri nga konsulenti", meta.name, a?.id ?? null);
    logActivity(db, s.user_id, s.user.full_name, s.user.role, "file.uploaded", "file", f.id, `${meta.name} → ${p?.title ?? a?.reference ?? ""}`);
  });
}

/** Signed, expiring download URL — access checked at issue AND consumption. */
export async function createSignedUrl(session: Session | null, fileId: string): Promise<{ url: string; expiresInMin: number }> {
  const s = requireSession(session);
  return read((db) => {
    const f = db.files.find((x) => x.id === fileId);
    if (!f) throw new AccessError("Skedari nuk u gjet.");
    if (!canAccessFile(db, s, f)) throw new AccessError("Nuk keni akses te ky skedar.");
    const tok = registerSignedToken(fileId, s.user_id, 10);
    logActivity(db, s.user_id, s.user.full_name, s.user.role, "file.signed_url", "file", fileId, f.file_name);
    return { url: `${location.origin}/signed/${tok}`, expiresInMin: 10 };
  });
}

export async function downloadFile(session: Session | null, fileId: string): Promise<void> {
  const s = requireSession(session);
  const f = await read((db) => {
    const file = db.files.find((x) => x.id === fileId);
    if (!file) throw new AccessError("Skedari nuk u gjet.");
    if (!canAccessFile(db, s, file)) throw new AccessError("Nuk keni akses te ky skedar.");
    return file;
  });
  const content = [
    "STATLAB — PRIVATE RESEARCH FILE (demo export)",
    "─".repeat(46),
    `File:      ${f.file_name}`,
    `Path:      ${f.file_path}`,
    `Category:  ${f.category}`,
    `Size:      ${f.file_size} bytes`,
    `Note:      ${f.content_note || "—"}`,
    `Accessed:  ${nowISO()} by ${s.user.full_name}`,
    "",
    "This placeholder represents the binary content stored in private Supabase Storage.",
    "Access is granted only through short-lived signed URLs with per-row authorization.",
  ].join("\n");
  downloadBlob(f.file_name + ".txt", content);
}

export async function deleteFile(session: Session | null, fileId: string): Promise<void> {
  const s = requireSession(session);
  await mutate((db) => {
    const f = db.files.find((x) => x.id === fileId);
    if (!f) throw new AccessError();
    const isUploader = f.uploaded_by === s.user_id;
    const isOwner = s.user.role === "client" && f.client_id === s.user_id;
    if (!isUploader && !isOwner && !["admin", "super_admin"].includes(s.user.role)) throw new AccessError();
    db.files = db.files.filter((x) => x.id !== fileId);
    logActivity(db, s.user_id, s.user.full_name, s.user.role, "file.deleted", "file", fileId, f.file_name);
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// PROJECTS
// ═════════════════════════════════════════════════════════════════════════════

export interface ProjectRow extends Project {
  client_name: string; consultant_name: string; progress: number;
  collaborators: { consultant_id: string; name: string; role: string }[];
  task_stats: { total: number; completed: number };
  next_appointment: { date: string; start_time: string } | null;
  files_count: number;
}

export function projectProgress(db: DB, projectId: string): number {
  const tasks = db.analysis_tasks.filter((t) => t.project_id === projectId && t.status !== "not_required");
  if (!tasks.length) return 0;
  return Math.round(tasks.reduce((acc, t) => acc + t.progress, 0) / tasks.length);
}

function toProjectRow(db: DB, p: Project): ProjectRow {
  const tasks = db.analysis_tasks.filter((t) => t.project_id === p.id && t.status !== "not_required");
  const upcoming = db.appointments
    .filter((a) => a.project_id === p.id && ["confirmed", "pending"].includes(a.status) && a.date >= todayISO())
    .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time))[0];
  return {
    ...p,
    client_name: db.users.find((u) => u.id === p.client_id)?.full_name ?? "—",
    consultant_name: db.consultants.find((c) => c.id === p.primary_consultant_id)?.display_name ?? "—",
    progress: projectProgress(db, p.id),
    collaborators: db.project_consultants.filter((pc) => pc.project_id === p.id).map((pc) => ({
      consultant_id: pc.consultant_id,
      name: db.consultants.find((c) => c.id === pc.consultant_id)?.display_name ?? "—",
      role: pc.role,
    })),
    task_stats: { total: tasks.length, completed: tasks.filter((t) => t.status === "completed").length },
    next_appointment: upcoming ? { date: upcoming.date, start_time: upcoming.start_time } : null,
    files_count: db.files.filter((f) => f.project_id === p.id).length,
  };
}

export async function listProjects(session: Session | null, filter: { status?: string; search?: string } = {}): Promise<ProjectRow[]> {
  const s = requireSession(session);
  return read((db) => {
    let rows = db.projects;
    if (s.user.role === "client") rows = rows.filter((p) => p.client_id === s.user_id);
    else if (s.user.role === "consultant") {
      const c = db.consultants.find((x) => x.user_id === s.user_id);
      rows = rows.filter((p) => p.primary_consultant_id === c?.id ||
        db.project_consultants.some((pc) => pc.project_id === p.id && pc.consultant_id === c?.id));
    }
    if (filter.status && filter.status !== "all") rows = rows.filter((p) => p.status === filter.status);
    if (filter.search) {
      const q = filter.search.toLowerCase();
      rows = rows.filter((p) => p.title.toLowerCase().includes(q) ||
        (db.users.find((u) => u.id === p.client_id)?.full_name ?? "").toLowerCase().includes(q));
    }
    return rows.map((p) => toProjectRow(db, p)).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  });
}

export async function getProjectDetail(session: Session | null, id: string): Promise<{
  project: ProjectRow;
  appointments: AppointmentRow[];
  files: (ProjectFile & { uploader_name: string })[];
  tasks: DB["analysis_tasks"];
  payments: Payment[];
  activity: DB["activity"];
  client_user?: User;
}> {
  const s = requireSession(session);
  return read((db) => {
    const p = db.projects.find((x) => x.id === id);
    if (!p) throw new AccessError("Projekti nuk u gjet.");
    if (s.user.role === "client" && p.client_id !== s.user_id) throw new AccessError();
    if (s.user.role === "consultant") {
      const c = db.consultants.find((x) => x.user_id === s.user_id);
      if (p.primary_consultant_id !== c?.id && !db.project_consultants.some((pc) => pc.project_id === id && pc.consultant_id === c?.id))
        throw new AccessError();
    }
    const tasks = db.analysis_tasks.filter((t) => t.project_id === id).sort((a, b) => a.task_order - b.task_order);
    return {
      project: toProjectRow(db, p),
      appointments: db.appointments.filter((a) => a.project_id === id).sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time)).map((a) => withJoins(db, a)),
      files: db.files.filter((f) => f.project_id === id).map((f) => ({ ...f, uploader_name: db.users.find((u) => u.id === f.uploaded_by)?.full_name ?? "—" })).sort((a, b) => b.created_at.localeCompare(a.created_at)),
      tasks,
      payments: db.payments.filter((x) => x.project_id === id || (x.appointment_id && db.appointments.some((a) => a.id === x.appointment_id && a.project_id === id))),
      activity: db.activity.filter((al) => al.entity_type === "project" && al.entity_id === id),
      client_user: db.users.find((u) => u.id === p.client_id),
    };
  });
}

export async function createProject(session: Session | null, data: Partial<Project> & { client_id: string; primary_consultant_id: string; title: string }): Promise<Project> {
  const s = requireAdmin(session);
  return mutate((db) => {
    const p: Project = {
      id: uid("p-"), client_id: data.client_id, primary_consultant_id: data.primary_consultant_id,
      title: data.title, description: data.description ?? "", research_topic: data.research_topic ?? "",
      research_questions: data.research_questions ?? "", hypotheses: data.hypotheses ?? "",
      study_level: (data.study_level ?? "master") as Project["study_level"], university: data.university ?? "",
      deadline: data.deadline ?? null, status: "new", created_at: nowISO(), updated_at: nowISO(),
    };
    db.projects.unshift(p);
    db.project_consultants.push({ id: uid("pc-"), project_id: p.id, consultant_id: p.primary_consultant_id, role: "lead", assigned_at: nowISO() });
    const cons = db.consultants.find((c) => c.id === p.primary_consultant_id);
    addNotification(db, cons?.user_id ?? null, db.users.find((u) => u.id === cons?.user_id)?.email ?? "", "project_update", "Projekt i ri u caktua", p.title);
    logActivity(db, s.user_id, s.user.full_name, s.user.role, "project.created", "project", p.id, p.title);
    return p;
  });
}

export async function updateProjectStatus(session: Session | null, id: string, status: Project["status"]): Promise<void> {
  const s = requireStaff(session);
  await mutate((db) => {
    const p = db.projects.find((x) => x.id === id);
    if (!p) throw new AccessError();
    if (s.user.role === "consultant") {
      const c = db.consultants.find((x) => x.user_id === s.user_id);
      if (p.primary_consultant_id !== c?.id) throw new AccessError();
    }
    const oldS = p.status;
    p.status = status;
    p.updated_at = nowISO();
    addNotification(db, p.client_id, db.users.find((u) => u.id === p.client_id)?.email ?? "", "project_update", "Statusi i projektit u përditësua", `${p.title}: ${status}`);
    logActivity(db, s.user_id, s.user.full_name, s.user.role, "project.status_changed", "project", p.id, `${oldS} → ${status}`);
  });
}

export async function assignProjectConsultant(session: Session | null, projectId: string, consultantId: string, role: "statistics" | "methodology" | "data_analyst" | "lead"): Promise<void> {
  const s = requireAdmin(session);
  await mutate((db) => {
    const p = db.projects.find((x) => x.id === projectId);
    if (!p) throw new AccessError();
    if (!db.project_consultants.some((pc) => pc.project_id === projectId && pc.consultant_id === consultantId)) {
      db.project_consultants.push({ id: uid("pc-"), project_id: projectId, consultant_id: consultantId, role, assigned_at: nowISO() });
    }
    if (role === "lead") p.primary_consultant_id = consultantId;
    p.updated_at = nowISO();
    const cons = db.consultants.find((c) => c.id === consultantId);
    addNotification(db, cons?.user_id ?? null, db.users.find((u) => u.id === cons?.user_id)?.email ?? "", "consultant_assigned", "U caktuat në një projekt", p.title);
    logActivity(db, s.user_id, s.user.full_name, s.user.role, "consultant.assigned", "project", projectId, `${cons?.display_name} → ${role}`);
  });
}

export async function addProjectNote(session: Session | null, projectId: string, note: string): Promise<void> {
  const s = requireStaff(session);
  await mutate((db) => {
    const p = db.projects.find((x) => x.id === projectId);
    if (!p) throw new AccessError();
    if (s.user.role === "consultant") {
      const c = db.consultants.find((x) => x.user_id === s.user_id);
      if (p.primary_consultant_id !== c?.id && !db.project_consultants.some((pc) => pc.project_id === projectId && pc.consultant_id === c?.id))
        throw new AccessError();
    }
    if (!note.trim()) throw new AccessError("Shënimi nuk mund të jetë bosh.");
    logActivity(db, s.user_id, s.user.full_name, s.user.role, "project.note", "project", projectId, note.trim());
    p.updated_at = nowISO();
  });
}

export async function saveTask(
  session: Session | null, projectId: string,
  task: { id?: string; name: string; status: string; progress: number; notes: string; assigned_consultant_id: string | null },
): Promise<void> {
  const s = requireStaff(session);
  await mutate((db) => {
    const p = db.projects.find((x) => x.id === projectId);
    if (!p) throw new AccessError();
    if (s.user.role === "consultant") {
      const c = db.consultants.find((x) => x.user_id === s.user_id);
      if (p.primary_consultant_id !== c?.id && !db.project_consultants.some((pc) => pc.project_id === projectId && pc.consultant_id === c?.id))
        throw new AccessError();
    }
    if (task.id) {
      const t = db.analysis_tasks.find((x) => x.id === task.id);
      if (!t) throw new AccessError();
      t.status = task.status as typeof t.status;
      t.progress = task.status === "completed" ? 100 : task.status === "not_started" ? 0 : task.progress;
      t.notes = task.notes;
      t.assigned_consultant_id = task.assigned_consultant_id;
      if (task.status === "completed") t.completed_at = nowISO();
      logActivity(db, s.user_id, s.user.full_name, s.user.role, "task.updated", "project", projectId, `${t.name} → ${t.status}`);
    } else {
      const maxOrder = Math.max(0, ...db.analysis_tasks.filter((t) => t.project_id === projectId).map((t) => t.task_order));
      db.analysis_tasks.push({
        id: uid("t-"), project_id: projectId, name: task.name, task_order: maxOrder + 1,
        status: task.status as "not_started", assigned_consultant_id: task.assigned_consultant_id,
        notes: task.notes, progress: 0, completed_at: null,
      });
      logActivity(db, s.user_id, s.user.full_name, s.user.role, "task.added", "project", projectId, task.name);
    }
    p.updated_at = nowISO();
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// REVIEWS
// ═════════════════════════════════════════════════════════════════════════════

export async function myReviewableAppointments(session: Session | null): Promise<AppointmentRow[]> {
  const s = requireSession(session);
  return read((db) => {
    if (s.user.role !== "client") return [];
    return db.appointments
      .filter((a) => a.client_id === s.user_id && a.status === "completed" && !db.reviews.some((r) => r.appointment_id === a.id))
      .map((a) => withJoins(db, a));
  });
}

export async function submitReview(
  session: Session | null, appointmentId: string,
  data: { rating: number; clarity: number; usefulness: number; recommendation: number; comment: string; consent_to_publish: boolean; show_name: boolean },
): Promise<void> {
  const s = requireSession(session);
  await mutate((db) => {
    const a = db.appointments.find((x) => x.id === appointmentId);
    if (!a || a.client_id !== s.user_id) throw new AccessError("Vetëm klienti i një konsulte të përfunduar mund të vlerësojë.");
    if (a.status !== "completed") throw new AccessError("Konsulta duhet të jetë e përfunduar.");
    if (db.reviews.some((r) => r.appointment_id === appointmentId)) throw new AccessError("Keni vlerësuar tashmë këtë konsultë.");
    if (data.rating < 1 || data.rating > 5) throw new AccessError("Vlerësim i pavlefshëm.");
    db.reviews.unshift({
      id: uid("r-"), appointment_id: appointmentId, client_id: s.user_id, consultant_id: a.consultant_id,
      rating: data.rating, clarity: data.clarity, usefulness: data.usefulness, recommendation: data.recommendation,
      comment: data.comment, consent_to_publish: data.consent_to_publish, show_name: data.show_name,
      status: "pending", created_at: nowISO(),
    });
    notifyAdmins(db, "review_submitted", "Vlerësim i ri për moderim", `${s.user.full_name} vlerësoi ${db.consultants.find((c) => c.id === a.consultant_id)?.display_name} me ${data.rating}★.`);
    logActivity(db, s.user_id, s.user.full_name, s.user.role, "review.submitted", "review", appointmentId, `${data.rating}★`);
  });
}

export async function listReviews(session: Session | null, filter: { status?: string } = {}): Promise<(Review & { client_name: string; consultant_name: string; reference: string })[]> {
  const s = requireSession(session);
  return read((db) => {
    let rows = db.reviews;
    if (s.user.role === "consultant") {
      const c = db.consultants.find((x) => x.user_id === s.user_id);
      rows = rows.filter((r) => r.consultant_id === c?.id);
    } else if (s.user.role === "client") rows = rows.filter((r) => r.client_id === s.user_id);
    if (filter.status && filter.status !== "all") rows = rows.filter((r) => r.status === filter.status);
    return rows.map((r) => ({
      ...r,
      client_name: db.users.find((u) => u.id === r.client_id)?.full_name ?? "—",
      consultant_name: db.consultants.find((c) => c.id === r.consultant_id)?.display_name ?? "—",
      reference: db.appointments.find((a) => a.id === r.appointment_id)?.reference ?? "—",
    })).sort((a, b) => b.created_at.localeCompare(a.created_at));
  });
}

export async function moderateReview(session: Session | null, id: string, status: Review["status"]): Promise<void> {
  const s = requireAdmin(session);
  await mutate((db) => {
    const r = db.reviews.find((x) => x.id === id);
    if (!r) throw new AccessError();
    r.status = status;
    if (status === "published") {
      const rs = db.reviews.filter((x) => x.consultant_id === r.consultant_id && x.status === "published");
      const c = db.consultants.find((x) => x.id === r.consultant_id);
      if (c && rs.length) {
        c.rating = +(rs.reduce((acc, x) => acc + x.rating, 0) / rs.length).toFixed(1);
        c.review_count = rs.filter((x) => x.consent_to_publish).length || rs.length;
      }
    }
    logActivity(db, s.user_id, s.user.full_name, s.user.role, "review." + status, "review", id, `${status}`);
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// WAITLIST
// ═════════════════════════════════════════════════════════════════════════════

export async function addToWaitlist(entry: {
  name: string; email: string; phone: string; service_id: string | null;
  consultant_id: string | null; preferred_dates: string; preferred_time: string;
}): Promise<void> {
  await mutate((db) => {
    db.waitlist.unshift({
      id: uid("w-"), ...entry, status: "waiting", matched_appointment_id: null, created_at: nowISO(),
    });
    notifyAdmins(db, "booking_received", "Regjistrim i ri në listën e pritjes", `${entry.name} — ${db.services.find((s) => s.id === entry.service_id)?.name ?? "Çdo shërbim"}`);
  });
}

export async function listWaitlist(session: Session | null): Promise<(DB["waitlist"][number] & { service_name: string; consultant_name: string; has_match: boolean })[]> {
  requireAdmin(session);
  return read((db) => {
    const recentCancels = db.appointments.filter((a) => a.status === "cancelled");
    return db.waitlist.map((w) => ({
      ...w,
      service_name: w.service_id ? db.services.find((s) => s.id === w.service_id)?.name ?? "—" : "Çdo shërbim",
      consultant_name: w.consultant_id ? db.consultants.find((c) => c.id === w.consultant_id)?.display_name ?? "—" : "Kushdo",
      has_match: w.status === "waiting" && recentCancels.some((a) =>
        (!w.service_id || a.service_id === w.service_id) && (!w.consultant_id || a.consultant_id === w.consultant_id)),
    })).sort((a, b) => b.created_at.localeCompare(a.created_at));
  });
}

export async function setWaitlistStatus(session: Session | null, id: string, status: DB["waitlist"][number]["status"]): Promise<void> {
  const s = requireAdmin(session);
  await mutate((db) => {
    const w = db.waitlist.find((x) => x.id === id);
    if (!w) throw new AccessError();
    w.status = status;
    if (status === "notified") logActivity(db, s.user_id, s.user.full_name, s.user.role, "waitlist.notified", "waitlist", id, w.email);
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// CONSULTANT APPLICATIONS
// ═════════════════════════════════════════════════════════════════════════════

export async function submitApplication(app: Omit<DB["applications"][number], "id" | "status" | "created_at">): Promise<void> {
  await mutate((db) => {
    db.applications.unshift({ ...app, id: uid("app-"), status: "submitted", created_at: nowISO() });
    notifyAdmins(db, "application_update", "Aplikim i ri konsulentësh", `${app.name} — ${app.country}`);
  });
}

export async function listApplications(session: Session | null): Promise<DB["applications"]> {
  requireAdmin(session);
  return read((db) => [...db.applications].sort((a, b) => b.created_at.localeCompare(a.created_at)));
}

export async function setApplicationStatus(
  session: Session | null, id: string, status: DB["applications"][number]["status"],
): Promise<{ invited_email?: string; temp_password?: string } | null> {
  const s = requireAdmin(session);
  return mutate((db) => {
    const app = db.applications.find((x) => x.id === id);
    if (!app) throw new AccessError();
    app.status = status;
    if (status !== "approved") {
      logActivity(db, s.user_id, s.user.full_name, s.user.role, "application." + status, "application", id, app.name);
      return null;
    }
    // secure invite: create user + consultant record, no automatic unrestricted access
    if (db.users.some((u) => u.email.toLowerCase() === app.email.toLowerCase())) {
      logActivity(db, s.user_id, s.user.full_name, s.user.role, "application.approved", "application", id, `${app.name} — përdorues ekzistues`);
      return { invited_email: app.email };
    }
    const tempPassword = "statlab-" + Math.random().toString(36).slice(2, 10);
    const u: User = {
      id: uid("u-"), email: app.email, password_hash: hashPw(tempPassword), full_name: app.name,
      phone: app.phone, avatar_color: "#c98d08", role: "consultant", preferred_language: "sq",
      status: "active", created_at: nowISO(), updated_at: nowISO(),
    };
    db.users.push(u);
    const slugBase = app.name.toLowerCase().replace(/^msc\.\s*|^dr\.\s*/i, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "konsulent";
    let slug = slugBase, i = 2;
    while (db.consultants.some((c) => c.slug === slug)) slug = slugBase + "-" + i++;
    const c = {
      id: uid("c-"), user_id: u.id, slug, display_name: app.name,
      professional_title: "Konsulent i ri", bio: app.motivation, profile_photo: null,
      education: [app.education], certifications: [], years_experience: 0,
      languages: app.languages.length ? app.languages : ["sq"], specializations: app.specializations,
      rating: 0, review_count: 0, status: "active" as const,
      commission_percentage: db.settings.default_commission, is_active: false, is_featured: false,
      google_calendar_connected: false, created_at: nowISO(), updated_at: nowISO(),
    };
    db.consultants.push(c);
    logActivity(db, s.user_id, s.user.full_name, s.user.role, "consultant.approved", "consultant", c.id, `${app.name} u aprovua (aktivizimi mbetet manual)`);
    return { invited_email: app.email, temp_password: tempPassword };
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN: clients, consultants, services, settings
// ═════════════════════════════════════════════════════════════════════════════

export async function listClientsAdmin(session: Session | null): Promise<(User & { bookings: number; spent: number; active_projects: number; last_booking: string | null })[]> {
  requireAdmin(session);
  return read((db) => db.users.filter((u) => u.role === "client").map((u) => {
    const appts = db.appointments.filter((a) => a.client_id === u.id && a.status !== "cancelled" && a.status !== "rescheduled");
    return {
      ...u,
      bookings: appts.length,
      spent: db.payments.filter((p) => p.client_id === u.id && p.status === "paid").reduce((acc, p) => acc + p.amount_gross, 0),
      active_projects: db.projects.filter((p) => p.client_id === u.id && !["completed", "cancelled"].includes(p.status)).length,
      last_booking: appts.sort((a, b) => b.date.localeCompare(a.date))[0]?.date ?? null,
    };
  }).sort((a, b) => b.created_at.localeCompare(a.created_at)));
}

export async function listConsultantsAdmin(session: Session | null) {
  requireAdmin(session);
  return read((db) => db.consultants.map((c) => {
    const appts = db.appointments.filter((a) => a.consultant_id === c.id);
    return {
      ...c,
      email: db.users.find((u) => u.id === c.user_id)?.email ?? "—",
      bookings_total: appts.filter((a) => a.status !== "cancelled").length,
      revenue: db.payments.filter((p) => p.consultant_id === c.id && p.status === "paid").reduce((acc, p) => acc + p.consultant_net, 0),
      active_projects: db.projects.filter((p) => p.primary_consultant_id === c.id && !["completed", "cancelled"].includes(p.status)).length,
    };
  }));
}

export async function saveConsultantAdmin(session: Session | null, data: Partial<DB["consultants"][number]> & { display_name: string; professional_title: string }): Promise<void> {
  const s = requireAdmin(session);
  await mutate((db) => {
    if (data.id) {
      const c = db.consultants.find((x) => x.id === data.id);
      if (!c) throw new AccessError();
      Object.assign(c, data, { updated_at: nowISO() });
      const u = db.users.find((x) => x.id === c.user_id);
      if (u && data.display_name) u.full_name = data.display_name;
      logActivity(db, s.user_id, s.user.full_name, s.user.role, "consultant.updated", "consultant", c.id, c.display_name);
    } else {
      const email = (data as { email?: string }).email ?? "";
      let userId = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase())?.id;
      if (!userId) {
        const tempPw = "statlab-" + Math.random().toString(36).slice(2, 8);
        const nu: User = {
          id: uid("u-"), email, password_hash: hashPw(tempPw), full_name: data.display_name,
          phone: "", avatar_color: "#7a3fb0", role: "consultant", preferred_language: "sq",
          status: "active", created_at: nowISO(), updated_at: nowISO(),
        };
        db.users.push(nu);
        userId = nu.id;
      }
      let slug = data.display_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "konsulent";
      let i = 2;
      while (db.consultants.some((c) => c.slug === slug)) slug += "-" + i++;
      db.consultants.push({
        id: uid("c-"), user_id: userId, slug, display_name: data.display_name,
        professional_title: data.professional_title, bio: data.bio ?? "", profile_photo: null,
        education: data.education ?? [], certifications: data.certifications ?? [],
        years_experience: data.years_experience ?? 0, languages: data.languages ?? ["sq"],
        specializations: data.specializations ?? [], rating: 0, review_count: 0,
        status: (data.status ?? "pending") as DB["consultants"][number]["status"],
        commission_percentage: data.commission_percentage ?? db.settings.default_commission,
        is_active: data.is_active ?? false, is_featured: data.is_featured ?? false,
        google_calendar_connected: false, created_at: nowISO(), updated_at: nowISO(),
      });
      logActivity(db, s.user_id, s.user.full_name, s.user.role, "consultant.created", "consultant", data.display_name, data.display_name);
    }
  });
}

export async function saveConsultantServicesAdmin(
  session: Session | null, consultantId: string,
  rows: { service_id: string; price: number; duration_minutes: number; is_active: boolean }[],
): Promise<void> {
  const s = requireAdmin(session);
  await mutate((db) => {
    db.consultant_services = db.consultant_services.filter((x) => x.consultant_id !== consultantId);
    for (const r of rows) {
      if (!r.is_active && r.price <= 0 && r.duration_minutes <= 0) continue;
      db.consultant_services.push({
        id: uid("cs-"), consultant_id: consultantId, service_id: r.service_id,
        price: r.price, duration_minutes: r.duration_minutes || 60, is_active: r.is_active,
        created_at: nowISO(), updated_at: nowISO(),
      });
    }
    logActivity(db, s.user_id, s.user.full_name, s.user.role, "consultant.services", "consultant", consultantId, `${rows.filter((r) => r.is_active).length} shërbime aktive`);
  });
}

export async function saveWeeklyAvailability(
  session: Session | null, consultantId: string,
  windows: { day: number; start: string; end: string }[],
): Promise<void> {
  const s = requireAdmin(session);
  await mutate((db) => {
    db.availability = db.availability.filter((a) => a.consultant_id !== consultantId);
    for (const w of windows) {
      if (timeToMin(w.end) <= timeToMin(w.start)) continue;
      db.availability.push({ id: uid("aw-"), consultant_id: consultantId, day_of_week: w.day, start_time: w.start, end_time: w.end, is_available: true });
    }
    logActivity(db, s.user_id, s.user.full_name, s.user.role, "availability.updated", "consultant", consultantId, `${windows.length} dritare javore`);
  });
}

export async function addBlock(session: Session | null, block: Omit<DB["blocks"][number], "id">): Promise<void> {
  const s = requireSession(session);
  await mutate((db) => {
    let consultantId = block.consultant_id;
    if (s.user.role === "consultant") {
      const c = db.consultants.find((x) => x.user_id === s.user_id);
      if (!c) throw new AccessError();
      consultantId = c.id;
    } else requireAdmin(s);
    db.blocks.push({ ...block, consultant_id: consultantId, id: uid("b-") });
    logActivity(db, s.user_id, s.user.full_name, s.user.role, "block.added", "consultant", consultantId, `${block.date} — ${block.reason}`);
  });
}

export async function removeBlock(session: Session | null, blockId: string): Promise<void> {
  const s = requireStaff(session);
  await mutate((db) => {
    const b = db.blocks.find((x) => x.id === blockId);
    if (!b) return;
    if (s.user.role === "consultant") {
      const c = db.consultants.find((x) => x.user_id === s.user_id);
      if (b.consultant_id !== c?.id) throw new AccessError();
    }
    db.blocks = db.blocks.filter((x) => x.id !== blockId);
    logActivity(db, s.user_id, s.user.full_name, s.user.role, "block.removed", "consultant", b.consultant_id, b.reason);
  });
}

export async function toggleGoogleCalendar(session: Session | null): Promise<boolean> {
  const s = requireSession(session);
  if (s.user.role !== "consultant") throw new AccessError("Vetëm konsulentët lidhin kalendarin e tyre.");
  return mutate((db) => {
    const c = db.consultants.find((x) => x.user_id === s.user_id);
    if (!c) throw new AccessError();
    c.google_calendar_connected = !c.google_calendar_connected;
    logActivity(db, s.user_id, s.user.full_name, s.user.role, "google." + (c.google_calendar_connected ? "connected" : "disconnected"), "consultant", c.id);
    return c.google_calendar_connected;
  });
}

export async function saveServiceAdmin(session: Session | null, data: Partial<DB["services"][number]> & { name: string }): Promise<void> {
  const s = requireAdmin(session);
  await mutate((db) => {
    if (data.id) {
      const svc = db.services.find((x) => x.id === data.id);
      if (!svc) throw new AccessError();
      Object.assign(svc, data, { updated_at: nowISO() });
      logActivity(db, s.user_id, s.user.full_name, s.user.role, "service.updated", "service", svc.id, `${svc.name} — €${svc.default_price}`);
    } else {
      let slug = data.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      let i = 2;
      while (db.services.some((x) => x.slug === slug)) slug += "-" + i++;
      db.services.push({
        id: uid("s-"), name: data.name, slug, short_description: data.short_description ?? "",
        description: data.description ?? "", category: data.category ?? "custom",
        default_duration_minutes: data.default_duration_minutes ?? 60,
        default_price: data.default_price ?? 50, currency: "EUR", is_active: data.is_active ?? true,
        payment_policy: data.payment_policy ?? "full", deposit_amount: data.deposit_amount ?? 0,
        created_at: nowISO(), updated_at: nowISO(),
      });
      logActivity(db, s.user_id, s.user.full_name, s.user.role, "service.created", "service", data.name, data.name);
    }
  });
}

export async function getSettings(session: Session | null): Promise<DB["settings"]> {
  requireAdmin(session);
  return read((db) => ({ ...db.settings }));
}

export async function updateSettings(session: Session | null, patch: Partial<DB["settings"]>): Promise<void> {
  const s = requireAdmin(session);
  await mutate((db) => {
    db.settings = { ...db.settings, ...patch };
    logActivity(db, s.user_id, s.user.full_name, s.user.role, "settings.updated", "settings", "platform", Object.keys(patch).join(", "));
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS / ACTIVITY / REMINDERS
// ═════════════════════════════════════════════════════════════════════════════

export async function listNotifications(session: Session | null): Promise<DB["notifications"]> {
  const s = requireSession(session);
  return read((db) => db.notifications.filter((n) => n.recipient_id === s.user_id).slice(0, 40));
}

export async function listActivity(
  session: Session | null,
  filter: { role?: string; action?: string; entity?: string; search?: string; page?: number; perPage?: number } = {},
): Promise<{ rows: DB["activity"]; total: number }> {
  requireAdmin(session);
  return read((db) => {
    let rows = db.activity;
    if (filter.role && filter.role !== "all") rows = rows.filter((a) => a.actor_role === filter.role);
    if (filter.action && filter.action !== "all") rows = rows.filter((a) => a.action === filter.action);
    if (filter.entity && filter.entity !== "all") rows = rows.filter((a) => a.entity_type === filter.entity);
    if (filter.search) {
      const q = filter.search.toLowerCase();
      rows = rows.filter((a) => a.actor_name.toLowerCase().includes(q) || a.metadata.toLowerCase().includes(q));
    }
    const total = rows.length;
    const page = filter.page ?? 1;
    const perPage = filter.perPage ?? 20;
    return { rows: rows.slice((page - 1) * perPage, page * perPage), total };
  });
}

/** Reminder scheduler — idempotent, skips cancelled appointments, uses fresh date after reschedule. */
export async function runReminderCheck(): Promise<number> {
  return mutate((db) => {
    let sent = 0;
    const now = Date.now();
    for (const a of db.appointments) {
      if (a.status !== "confirmed") continue;
      const hrs = hoursBetween(now, a.date, a.start_time);
      for (const rh of db.settings.reminder_hours) {
        if (hrs <= rh && hrs > 0) {
          const type: NotificationType = rh >= 24 ? "reminder_24h" : "reminder_1h";
          const before = db.notifications.length;
          addNotification(db, a.client_id, a.client_email, type,
            `Kujtesë: konsulta ${rh >= 24 ? "nesër" : `pas ${Math.max(1, Math.round(hrs))} orësh`}`,
            `${db.services.find((s) => s.id === a.service_id)?.name} më ${a.date} në ${a.start_time}.${a.meeting_url ? " Linku: " + a.meeting_url : ""}`,
            a.id, true);
          const cons = db.consultants.find((c) => c.id === a.consultant_id);
          if (cons) addNotification(db, cons.user_id, db.users.find((u) => u.id === cons.user_id)?.email ?? "", type,
            `Kujtesë: termin ${rh >= 24 ? "nesër" : "së shpejti"}`,
            `${a.client_name} më ${a.date} në ${a.start_time}.`, a.id, true);
          if (db.notifications.length > before) sent += db.notifications.length - before;
        }
      }
    }
    return sent;
  });
}

export async function giveConsent(session: Session | null, type: "privacy" | "terms" | "data_processing" | "confidentiality"): Promise<void> {
  const s = requireSession(session);
  await mutate((db) => {
    if (!db.consents.some((c) => c.user_id === s.user_id && c.consent_type === type && c.consent_version === "1.2"))
      db.consents.push({ id: uid("cns-"), user_id: s.user_id, consent_type: type, consent_version: "1.2", accepted_at: nowISO() });
  });
}

export async function myConsents(session: Session | null) {
  const s = requireSession(session);
  return read((db) => db.consents.filter((c) => c.user_id === s.user_id));
}

// ═════════════════════════════════════════════════════════════════════════════
// ANALYTICS (computed from source records — never duplicated)
// ═════════════════════════════════════════════════════════════════════════════

export interface AnalyticsData {
  range: { from: string; to: string };
  kpi: {
    bookings: number; confirmed: number; completed: number; pending: number;
    cancelRate: number; noShowRate: number;
    revenue: number; pendingRevenue: number; platformRevenue: number; consultantEarnings: number;
    avgBookingValue: number; newClients: number; activeProjects: number; completedProjects: number;
    activeConsultants: number;
  };
  series: { day: string; bookings: number; revenue: number }[];
  byService: { name: string; bookings: number; revenue: number }[];
  byStatus: { status: string; count: number }[];
  byConsultant: { name: string; bookings: number; revenue: number; rating: number; completionRate: number; activeProjects: number }[];
}

export async function getAnalytics(session: Session | null, fromISO: string, toISO: string): Promise<AnalyticsData> {
  requireAdmin(session);
  return read((db) => {
    const appts = db.appointments.filter((a) => a.date >= fromISO && a.date <= toISO);
    const paid = db.payments.filter((p) => p.status === "paid" && p.paid_at && p.paid_at.slice(0, 10) >= fromISO && p.paid_at.slice(0, 10) <= toISO);
    const pendingPays = db.payments.filter((p) => p.status === "pending");
    const counted = appts.filter((a) => a.status !== "rescheduled");
    const cancelled = counted.filter((a) => a.status === "cancelled").length;
    const noShow = counted.filter((a) => a.status === "no_show").length;
    const finished = counted.filter((a) => ["completed", "cancelled", "no_show"].includes(a.status)).length;

    // day series across range
    const days: string[] = [];
    let d = fromISO;
    for (let i = 0; i < 366 && d <= toISO; i++) { days.push(d); d = addDaysISO(d, 1); }
    const step = days.length > 90 ? 7 : 1;
    const series: { day: string; bookings: number; revenue: number }[] = [];
    for (let i = 0; i < days.length; i += step) {
      const chunk = days.slice(i, i + step);
      const from = chunk[0], to = chunk[chunk.length - 1];
      series.push({
        day: step === 1 ? from.slice(5) : from.slice(5) + "–" + to.slice(5),
        bookings: appts.filter((a) => chunk.includes(a.date) && a.status !== "rescheduled").length,
        revenue: paid.filter((p) => chunk.includes(p.paid_at!.slice(0, 10))).reduce((acc, p) => acc + p.amount_gross, 0),
      });
    }

    const byService = db.services.map((svc) => {
      const sa = appts.filter((a) => a.service_id === svc.id && a.status !== "rescheduled");
      return {
        name: svc.name,
        bookings: sa.length,
        revenue: paid.filter((p) => sa.some((a) => a.id === p.appointment_id)).reduce((acc, p) => acc + p.amount_gross, 0),
      };
    }).filter((x) => x.bookings > 0 || x.revenue > 0).sort((a, b) => b.revenue - a.revenue);

    const statuses = ["pending", "confirmed", "completed", "cancelled", "rescheduled", "no_show"];
    const byStatus = statuses.map((status) => ({ status, count: appts.filter((a) => a.status === status).length })).filter((x) => x.count > 0);

    const byConsultant = db.consultants.filter((c) => c.status !== "inactive").map((c) => {
      const ca = appts.filter((a) => a.consultant_id === c.id && a.status !== "rescheduled");
      const done = ca.filter((a) => a.status === "completed").length;
      return {
        name: c.display_name,
        bookings: ca.length,
        revenue: paid.filter((p) => p.consultant_id === c.id).reduce((acc, p) => acc + p.consultant_net, 0),
        rating: c.rating,
        completionRate: ca.length ? Math.round((done / ca.length) * 100) : 0,
        activeProjects: db.projects.filter((p) => p.primary_consultant_id === c.id && !["completed", "cancelled"].includes(p.status)).length,
      };
    }).filter((x) => x.bookings > 0 || x.activeProjects > 0).sort((a, b) => b.revenue - a.revenue);

    return {
      range: { from: fromISO, to: toISO },
      kpi: {
        bookings: counted.length,
        confirmed: counted.filter((a) => a.status === "confirmed").length,
        completed: counted.filter((a) => a.status === "completed").length,
        pending: counted.filter((a) => a.status === "pending").length,
        cancelRate: finished ? Math.round((cancelled / finished) * 100) : 0,
        noShowRate: finished ? Math.round((noShow / finished) * 100) : 0,
        revenue: paid.reduce((acc, p) => acc + p.amount_gross, 0),
        pendingRevenue: pendingPays.reduce((acc, p) => acc + p.amount_gross, 0),
        platformRevenue: paid.reduce((acc, p) => acc + p.platform_fee, 0),
        consultantEarnings: paid.reduce((acc, p) => acc + p.consultant_net, 0),
        avgBookingValue: appts.length ? Math.round(appts.reduce((acc, a) => acc + a.price, 0) / appts.length) : 0,
        newClients: db.users.filter((u) => u.role === "client" && u.created_at.slice(0, 10) >= fromISO && u.created_at.slice(0, 10) <= toISO).length,
        activeProjects: db.projects.filter((p) => !["completed", "cancelled"].includes(p.status)).length,
        completedProjects: db.projects.filter((p) => p.status === "completed").length,
        activeConsultants: db.consultants.filter((c) => c.is_active && c.status === "active").length,
      },
      series, byService, byStatus, byConsultant,
    };
  });
}

// ── consultant portal helpers ──

export async function consultantDashboard(session: Session | null) {
  const s = requireSession(session);
  return read((db) => {
    const c = db.consultants.find((x) => x.user_id === s.user_id);
    if (!c) throw new AccessError("Profili i konsulentit nuk u gjet.");
    const mine = db.appointments.filter((a) => a.consultant_id === c.id);
    const t = todayISO();
    const weekEnd = addDaysISO(t, 7);
    const paid = db.payments.filter((p) => p.consultant_id === c.id && p.status === "paid");
    const monthStart = t.slice(0, 8) + "01";
    const myProjects = db.projects.filter((p) => p.primary_consultant_id === c.id || db.project_consultants.some((pc) => pc.project_id === p.id && pc.consultant_id === c.id));
    const myClients = new Set(mine.map((a) => a.client_id));
    return {
      consultant: c,
      kpi: {
        today: mine.filter((a) => a.date === t && ["confirmed", "pending"].includes(a.status)).length,
        week: mine.filter((a) => a.date >= t && a.date <= weekEnd && ["confirmed", "pending"].includes(a.status)).length,
        activeProjects: myProjects.filter((p) => !["completed", "cancelled"].includes(p.status)).length,
        activeClients: myClients.size,
        monthEarnings: paid.filter((p) => (p.paid_at ?? "").slice(0, 10) >= monthStart).reduce((acc, p) => acc + p.consultant_net, 0),
        totalEarnings: paid.reduce((acc, p) => acc + p.consultant_net, 0),
        pendingPayout: paid.filter((p) => p.payout_status !== "paid").reduce((acc, p) => acc + p.consultant_net, 0),
        rating: c.rating,
        reviewCount: c.review_count,
      },
      upcoming: mine
        .filter((a) => a.date >= t && ["confirmed", "pending"].includes(a.status))
        .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time))
        .slice(0, 6)
        .map((a) => withJoins(db, a)),
      recentActivity: db.activity.filter((al) => al.actor_id === s.user_id).slice(0, 8),
    };
  });
}

export async function consultantClients(session: Session | null) {
  const s = requireSession(session);
  return read((db) => {
    const c = db.consultants.find((x) => x.user_id === s.user_id);
    if (!c) throw new AccessError();
    const ids = new Set([
      ...db.appointments.filter((a) => a.consultant_id === c.id).map((a) => a.client_id),
      ...db.projects.filter((p) => p.primary_consultant_id === c.id).map((p) => p.client_id),
    ]);
    return [...ids].map((id) => {
      const u = db.users.find((x) => x.id === id);
      if (!u) return null;
      const appts = db.appointments.filter((a) => a.client_id === id && a.consultant_id === c.id && a.status !== "rescheduled");
      return {
        id: u.id, full_name: u.full_name, email: u.email, phone: u.phone,
        total: appts.length,
        completed: appts.filter((a) => a.status === "completed").length,
        next: appts.filter((a) => ["confirmed", "pending"].includes(a.status) && a.date >= todayISO())
          .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null,
        last: appts.filter((a) => a.status === "completed").sort((a, b) => b.date.localeCompare(a.date))[0]?.date ?? null,
      };
    }).filter(Boolean) as { id: string; full_name: string; email: string; phone: string; total: number; completed: number; next: Appointment | null; last: string | null }[];
  });
}

export async function consultantAnalyses(session: Session | null) {
  const s = requireSession(session);
  return read((db) => {
    const c = db.consultants.find((x) => x.user_id === s.user_id);
    if (!c) throw new AccessError();
    const myProjectIds = new Set([
      ...db.projects.filter((p) => p.primary_consultant_id === c.id).map((p) => p.id),
      ...db.project_consultants.filter((pc) => pc.consultant_id === c.id).map((pc) => pc.project_id),
    ]);
    return db.analysis_tasks
      .filter((t) => myProjectIds.has(t.project_id))
      .map((t) => ({ ...t, project_title: db.projects.find((p) => p.id === t.project_id)?.title ?? "—" }))
      .sort((a, b) => a.project_title.localeCompare(b.project_title) || a.task_order - b.task_order);
  });
}

export { getDB, getSession };
