import { sb, mapError } from "./supabase";
import {
  rpc, selectAll, emit, QueryError, requireSession, requireStaff, requireAdmin,
  hydrateAppointments, toApptRow, slugMapFor, fetchProfile, mapUser, hhmm,
  type ApptRow, type ProfileRow,
} from "./repo";
import type {
  Session, User, Appointment, AppointmentRow, Payment, Invoice, ProjectFile, Project,
  FileCategory, Settings, IntakeTemplate,
} from "../types";
import { todayISO, downloadBlob, uid } from "./utils";

export type { AppointmentRow } from "../types";

export interface ServiceRow {
  id: string; name: string; slug: string; short_description: string; description: string;
  category: string; default_duration_minutes: number; default_price: number; currency: string;
  is_active: boolean; payment_policy: "full" | "deposit" | "free_booking"; deposit_amount: number;
  created_at: string; updated_at: string;
}

export interface AdminConsultantRow {
  id: string; user_id: string | null; slug: string; display_name: string; professional_title: string;
  bio: string; education: string[]; certifications: string[]; years_experience: number;
  languages: string[]; specializations: string[]; rating: number; review_count: number;
  status: "pending" | "active" | "suspended" | "inactive"; is_active: boolean; is_featured: boolean;
  google_calendar_connected: boolean; commission_percentage: number; bookings_total: number;
  revenue: number; created_at?: string;
}

export interface AdminClientRow {
  id: string; full_name: string; email: string; phone: string; preferred_language: string;
  status: string; created_at: string; bookings: number; spent: number;
  active_projects: number; last_booking: string | null;
}

/**
 * Business/service layer.
 * ─ Persistence: Supabase PostgreSQL (real, durable).
 * ─ Authorization: PostgreSQL Row Level Security (database level) + the
 *   SECURITY DEFINER booking engine, which re-validates availability inside a
 *   serialized transaction. Client-side role checks below are UX only.
 * ─ Stripe / Google Calendar / Meet / real email delivery: DEMO/DEFERRED —
 *   payment rows persist with method = 'stripe_demo'.
 */

const ALLOWED_EXT = [".sav", ".spv", ".xlsx", ".csv", ".docx", ".pdf"];
const MAX_FILE_MB = 25;

// ═════════════════════════════════════════════════════════════════════════════
// AUTH (Supabase Auth — no custom password handling anywhere)
// ═════════════════════════════════════════════════════════════════════════════

async function sessionForAuthUser(userId: string): Promise<Session> {
  let profile = await fetchProfile(userId);
  if (!profile) {
    // provisioning trigger creates the row; ensure_profile also adopts guest profiles
    await rpc("ensure_profile");
    profile = await fetchProfile(userId);
  }
  if (!profile) throw new QueryError("Profili nuk u gjet. Provoni përsëri.");
  if (profile.status === "deactivated") {
    await sb.auth.signOut();
    throw new QueryError("Kjo llogari është çaktivizuar.");
  }
  return { user_id: profile.id, user: mapUser(profile) };
}

export async function login(email: string, password: string): Promise<Session> {
  const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new QueryError(mapError(error.message));
  if (!data.session?.user) throw new QueryError("Ju lutem verifikoni email-in para se të kyçeni.");
  return sessionForAuthUser(data.session.user.id);
}

export async function registerClient(data: { full_name: string; email: string; phone: string; password: string }): Promise<Session> {
  // No role is ever sent in signup metadata — the database trigger always
  // provisions new accounts as 'client'. Roles change only via admin RPCs.
  const { data: up, error } = await sb.auth.signUp({
    email: data.email.trim(),
    password: data.password,
    options: { data: { full_name: data.full_name.trim(), phone: data.phone } },
  });
  if (error) throw new QueryError(mapError(error.message));
  let userId = up.session?.user?.id;
  if (!userId) {
    // project may require email confirmation — try direct sign-in (auto-confirm)
    const { data: si, error: e2 } = await sb.auth.signInWithPassword({ email: data.email.trim(), password: data.password });
    if (e2 || !si.session?.user) throw new QueryError("Llogaria u krijua — kontrolloni email-in për linkun e verifikimit.");
    userId = si.session.user.id;
  }
  const session = await sessionForAuthUser(userId);
  if (data.phone) {
    await sb.from("profiles").update({ phone: data.phone, full_name: data.full_name.trim() || session.user.full_name }).eq("id", userId);
    session.user.phone = data.phone;
    if (data.full_name.trim()) session.user.full_name = data.full_name.trim();
  }
  return session;
}

export function logout(): void {
  void sb.auth.signOut();
}

// ── Password recovery (real Supabase flow) ──────────────────────────────────
/** Redirect target for recovery links — always the current deployed origin
 *  (never a hardcoded host), pointing at the app root where the session is
 *  detected and the user is routed to /reset-password. */
export function passwordResetRedirectUrl(): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  return base.endsWith("/") ? base : base + "/";
}

/** Requests a recovery email. Supabase does not reveal whether the account exists. */
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: passwordResetRedirectUrl(),
  });
  if (error) throw new QueryError(mapError(error.message));
}

/** Sets the new password using the active recovery session. */
export async function setNewPassword(newPassword: string): Promise<Session> {
  const { data } = await sb.auth.getSession();
  if (!data.session?.user) throw new QueryError("Linku i rikuperimit është i pavlefshëm ose ka skaduar. Kërkoni një link të ri.");
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) throw new QueryError(mapError(error.message));
  return sessionForAuthUser(data.session.user.id);
}

/** Raised when a valid auth session exists but the profile cannot be fetched
 *  because of a temporary network/server failure — NOT a logout. */
export class ProfileUnavailableError extends Error {}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Classifies fetch/network failures vs. real authorization errors. */
function isTransientError(e: unknown): boolean {
  const m = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return ["failed to fetch", "network", "load failed", "lidhja me serverin", "timeout", "econn", "aborterror"]
    .some((k) => m.includes(k));
}

export async function restoreSession(): Promise<Session | null> {
  const { data } = await sb.auth.getSession();
  if (!data.session?.user) return null; // (A) genuinely no session → logged out
  try {
    return await sessionForAuthUser(data.session.user.id);
  } catch (firstErr) {
    // (B) a real auth problem (deactivated account, missing profile) → logged out
    if (!isTransientError(firstErr)) {
      console.error("Profile load failed:", firstErr);
      return null;
    }
    // (B) temporary fetch failure → retry exactly once, then surface the error
    await delay(1200);
    try {
      return await sessionForAuthUser(data.session.user.id);
    } catch (secondErr) {
      if (isTransientError(secondErr))
        throw new ProfileUnavailableError("Nuk u arrit lidhja me serverin për të ngarkuar profilin tuaj. Kontrolloni rrjetin dhe provoni përsëri.");
      console.error("Profile load failed:", secondErr);
      return null;
    }
  }
}

export function onAuthChange(cb: (s: Session | null) => void): () => void {
  const { data } = sb.auth.onAuthStateChange((event, sess) => {
    if (event === "SIGNED_OUT") { cb(null); return; }
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
      if (!sess?.user) { cb(null); return; }
      sessionForAuthUser(sess.user.id)
        .then(cb)
        .catch(async (e: unknown) => {
          // never silently log the user out on a flaky fetch — retry once, bounded
          if (isTransientError(e)) {
            console.error("Transient profile fetch failure, retrying once:", e);
            await delay(1500);
            try { cb(await sessionForAuthUser(sess.user.id)); return; }
            catch (e2) { console.error("Profile retry failed:", e2); }
          }
          cb(null);
        });
    }
  });
  return () => data.subscription.unsubscribe();
}

/** Fires when Supabase completes a password-recovery link exchange. */
export function watchPasswordRecovery(cb: () => void): () => void {
  const { data } = sb.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") cb();
  });
  return () => data.subscription.unsubscribe();
}

export async function updateProfile(session: Session | null, patch: Partial<Pick<User, "full_name" | "phone" | "preferred_language">>): Promise<void> {
  const s = requireSession(session);
  const { error } = await sb.from("profiles").update(patch).eq("id", s.user_id);
  if (error) throw new QueryError(mapError(error.message));
  await rpc("log_activity", { p_action: "profile.updated", p_entity_type: "user", p_entity_id: s.user_id, p_metadata: "Profili u përditësua" }).catch(() => undefined);
  emit();
}

export async function exportMyData(session: Session | null): Promise<void> {
  requireSession(session);
  const data = await rpc<Record<string, unknown>>("client_export_data");
  downloadBlob("statlab-te-dhenat-e-mia.json", JSON.stringify(data, null, 2), "application/json");
}

export async function deleteMyAccount(session: Session | null): Promise<void> {
  const s = requireSession(session);
  if (s.user.role !== "client") throw new QueryError("Vetëm llogaritë e klientëve mund të fshihen vetë.");
  await rpc("client_delete_account");
  await sb.auth.signOut();
  emit();
}

// ═════════════════════════════════════════════════════════════════════════════
// PUBLIC DIRECTORY (reads real Supabase data — nothing hardcoded)
// ═════════════════════════════════════════════════════════════════════════════

export interface PublicConsultant {
  id: string; slug: string; display_name: string; professional_title: string; bio: string;
  education: string[]; certifications: string[]; years_experience: number; languages: string[];
  specializations: string[]; rating: number; review_count: number; is_featured: boolean;
  starting_price: number; services: { service_id: string; name: string; price: number; duration_minutes: number; category: string }[];
  next: { date: string; time: string } | null;
  weekly: { day: number; windows: string[] }[];
}

export async function listPublicConsultants(): Promise<PublicConsultant[]> {
  const rows = await rpc<PublicConsultant[]>("public_directory");
  return (rows ?? []).map((c) => ({
    ...c,
    rating: Number(c.rating) || 0,
    starting_price: Number(c.starting_price) || 0,
    services: (c.services ?? []).map((s) => ({ ...s, price: Number(s.price) || 0 })),
  }));
}

export interface PublicReview {
  id: string; rating: number; clarity: number; usefulness: number; recommendation: number;
  comment: string; client_name: string; consultant_name: string; service_name: string;
  created_at: string;
}

export async function getConsultantBySlug(slug: string): Promise<{ consultant: PublicConsultant; reviews: PublicReview[] } | null> {
  const res = await rpc<{ consultant: PublicConsultant; reviews: PublicReview[] } | null>("consultant_profile_public", { p_slug: slug });
  if (!res || !res.consultant || !res.consultant.id) return null;
  return {
    consultant: { ...res.consultant, rating: Number(res.consultant.rating) || 0, starting_price: Number(res.consultant.starting_price) || 0 },
    reviews: res.reviews ?? [],
  };
}

export async function getConsultantById(id: string): Promise<PublicConsultant | null> {
  const rows = await rpc<PublicConsultant[]>("public_directory");
  const found = (rows ?? []).find((c) => c.id === id);
  if (found) return { ...found, rating: Number(found.rating) || 0, starting_price: Number(found.starting_price) || 0 };
  // consultants not visible in the public directory (inactive) — still resolvable for portals
  const { data } = await sb.from("consultants").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const c = data as Record<string, unknown>;
  const offers = await selectAll<{ service_id: string; price: number; duration_minutes: number }>("consultant_services", (q) => q.eq("consultant_id", id).eq("is_active", true));
  const servicesAll = await selectAll<{ id: string; name: string; category: string }>("services");
  return {
    id: String(c.id), slug: String(c.slug), display_name: String(c.display_name),
    professional_title: String(c.professional_title ?? ""), bio: String(c.bio ?? ""),
    education: (c.education as string[]) ?? [], certifications: (c.certifications as string[]) ?? [],
    years_experience: Number(c.years_experience ?? 0), languages: (c.languages as string[]) ?? ["sq"],
    specializations: (c.specializations as string[]) ?? [], rating: Number(c.rating ?? 0),
    review_count: Number(c.review_count ?? 0), is_featured: Boolean(c.is_featured),
    starting_price: offers.length ? Math.min(...offers.map((o) => Number(o.price))) : 0,
    services: offers.map((o) => ({
      service_id: o.service_id, name: servicesAll.find((s) => s.id === o.service_id)?.name ?? "",
      price: Number(o.price), duration_minutes: o.duration_minutes,
      category: servicesAll.find((s) => s.id === o.service_id)?.category ?? "",
    })),
    next: null, weekly: [],
  };
}

export async function listActiveServices(): Promise<ServiceRow[]> {
  const rows = await selectAll<ServiceRow>("services", (q) => q.eq("is_active", true).order("created_at"));
  return rows.map((r) => ({ ...r, default_price: Number(r.default_price), deposit_amount: Number(r.deposit_amount) }));
}

export async function previewMatch(serviceId: string, language?: string) {
  const m = await rpc<{ consultant_id: string; score: number; reasons: string[] } | null>("match_consultant", {
    p_service: serviceId, p_lang: language ?? null,
  });
  if (!m) return null;
  const consultant = await getConsultantById(m.consultant_id);
  if (!consultant) return null;
  return { consultant, reasons: m.reasons ?? [], score: Number(m.score) || 0 };
}

export async function previewFirstAvailable(serviceId: string) {
  const fa = await rpc<{ consultant_id: string; date: string; time: string } | null>("first_available_offer", { p_service: serviceId });
  if (!fa) return null;
  const consultant = await getConsultantById(fa.consultant_id);
  if (!consultant) return null;
  return { consultant, date: fa.date, time: hhmm(fa.time) };
}

/** Available start times — computed SERVER-SIDE from availability, blocks, bookings, buffer & notice rules. */
export async function bookingSlots(consultantId: string, dateISO: string, duration: number): Promise<string[]> {
  const rows = await rpc<string[]>("consultant_day_slots", { p_cid: consultantId, p_day: dateISO, p_dur: duration });
  return (rows ?? []).map((t) => hhmm(t));
}

export async function bookingMonthCapacity(consultantId: string, year: number, month: number, duration: number): Promise<Record<string, string>> {
  const rows = await rpc<{ day: string; cap: string }[]>("consultant_month_capacity", {
    p_cid: consultantId, p_year: year, p_month: month + 1, p_dur: duration,
  });
  const out: Record<string, string> = {};
  const today = todayISO();
  for (const r of rows ?? []) {
    const day = String(r.day).slice(0, 10);
    if (day < today) out[day] = "past";
    else out[day] = r.cap === "low" ? "limited" : r.cap === "none" ? "none" : "open";
  }
  return out;
}

export async function getIntakeForService(serviceId: string): Promise<IntakeTemplate | null> {
  const { data } = await sb.from("services").select("slug, category").eq("id", serviceId).maybeSingle();
  if (!data) return null;
  const slug = String(data.slug ?? ""); const category = String(data.category ?? "");
  let cat = "consultation";
  if (slug.includes("regresion")) cat = "regression";
  else if (category === "thesis") cat = "thesis";
  else if (category === "survey") cat = "questionnaire";
  else if (category === "analysis") cat = "analysis";
  const rows = await selectAll<IntakeTemplate>("intake_templates", (q) => q.eq("category", cat));
  return rows[0] ?? null;
}

export async function listAllServicesAdmin(session: Session | null): Promise<ServiceRow[]> {
  requireAdmin(session);
  const rows = await selectAll<ServiceRow>("services", (q) => q.order("created_at"));
  return rows.map((r) => ({ ...r, default_price: Number(r.default_price), deposit_amount: Number(r.deposit_amount) }));
}

export async function getPublicReviews(): Promise<PublicReview[]> {
  return (await rpc<PublicReview[]>("public_reviews")) ?? [];
}

// ═════════════════════════════════════════════════════════════════════════════
// BOOKING — validated & inserted by the SECURITY DEFINER engine; the EXCLUDE
// constraint rejects any overlapping active appointment even under concurrency.
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

export async function createBooking(session: Session | null, payload: BookingPayload): Promise<BookingResult> {
  void session; // anon allowed; auth.uid() is read inside the RPC
  const res = await rpc<{
    appointment: Partial<Appointment> & { id: string; reference: string };
    created_account: boolean; temp_password: string | null;
    invoice: { id: string; invoice_number: string; amount_total: number; status: string } | null;
    match_reasons: string[];
  }>("book_appointment", {
    p: {
      service_id: payload.service_id,
      consultant_mode: payload.consultant_mode,
      consultant_id: payload.consultant_id ?? null,
      date: payload.date,
      start_time: payload.start_time,
      client: payload.client,
      intake: payload.intake ?? {},
      file: payload.file ?? null,
      payment_choice: payload.payment_choice,
      consents: { privacy: payload.consents.privacy, terms: payload.consents.terms },
    },
  });
  emit();
  return {
    appointment: res.appointment as Appointment,
    created_account: Boolean(res.created_account),
    temp_password: res.temp_password ?? null,
    invoice: (res.invoice as unknown as Invoice | null) ?? null,
    match_reasons: Array.isArray(res.match_reasons) ? res.match_reasons : [],
  };
}

// ── appointment queries (RLS-scoped: client → own, consultant → assigned, staff → all) ──

export async function listAppointments(
  session: Session | null,
  filter: { status?: string; search?: string; consultant_id?: string; from?: string; to?: string; upcoming?: boolean } = {},
): Promise<AppointmentRow[]> {
  requireSession(session);
  let rows = await selectAll<ApptRow>("appointments", (q) => {
    if (filter.from) q = q.gte("date", filter.from);
    if (filter.to) q = q.lte("date", filter.to);
    if (filter.consultant_id) q = q.eq("consultant_id", filter.consultant_id);
    return q.order("date", { ascending: true }).order("start_time", { ascending: true });
  });
  if (filter.status && filter.status !== "all") rows = rows.filter((a) => a.status === filter.status);
  if (filter.upcoming) {
    const t = todayISO();
    rows = rows.filter((a) => a.date >= t && a.status !== "cancelled" && a.status !== "rescheduled");
  }
  if (filter.search) {
    const s = filter.search.toLowerCase();
    rows = rows.filter((a) =>
      a.client_name.toLowerCase().includes(s) || a.reference.toLowerCase().includes(s) ||
      (a.service_name ?? "").toLowerCase().includes(s) || (a.research_topic ?? "").toLowerCase().includes(s));
  }
  return hydrateAppointments(rows);
}

export async function getAppointment(session: Session | null, id: string): Promise<AppointmentRow> {
  requireSession(session);
  const rows = await selectAll<ApptRow>("appointments", (q) => q.eq("id", id));
  if (!rows.length) throw new QueryError("Termini nuk u gjet.");
  return (await hydrateAppointments(rows))[0];
}

export async function confirmAppointment(session: Session | null, id: string): Promise<void> {
  requireStaff(session);
  await rpc("set_appointment_status", { p_id: id, p_status: "confirmed" });
  emit();
}

export async function markNoShow(session: Session | null, id: string): Promise<void> {
  requireStaff(session);
  await rpc("set_appointment_status", { p_id: id, p_status: "no_show" });
  emit();
}

export async function completeAppointment(
  session: Session | null, id: string,
  completion: NonNullable<Appointment["completion"]>,
): Promise<void> {
  requireStaff(session);
  await rpc("complete_appointment", { p_id: id, p_completion: completion });
  emit();
}

export async function cancelAppointmentByStaff(session: Session | null, id: string, reason: string): Promise<void> {
  requireStaff(session);
  await rpc("cancel_by_staff", { p_id: id, p_reason: reason ?? "" });
  emit();
}

export async function saveAppointmentNotes(session: Session | null, id: string, notes: string): Promise<void> {
  requireAdmin(session);
  await rpc("save_appointment_notes", { p_id: id, p_notes: notes });
  emit();
}

// ── secure self-service management (token scoped — no appointment id exposure) ──

export interface ManageView {
  appointment: AppointmentRow;
  can_reschedule: boolean; can_cancel: boolean;
  reschedule_reason: string; cancel_reason: string;
  min_reschedule_hours: number; min_cancel_hours: number;
}

export async function getManageView(manageToken: string): Promise<ManageView> {
  const res = await rpc<ManageView>("manage_view", { p_token: manageToken });
  const a = res.appointment as unknown as ApptRow & { history: AppointmentRow["history"]; end_time: string };
  res.appointment = toApptRow(
    { ...a, start_time: hhmm(a.start_time) } as ApptRow,
    (await slugMapFor([a.consultant_id])).get(a.consultant_id) ?? "",
    a.history ?? [],
  );
  return res;
}

export async function rescheduleByToken(manageToken: string, newDate: string, newStart: string): Promise<Appointment> {
  const res = await rpc<{ date: string; start_time: string; end_time: string }>("reschedule_by_token", {
    p_token: manageToken, p_date: newDate, p_start: newStart,
  });
  emit();
  return { date: res.date, start_time: hhmm(res.start_time), end_time: hhmm(res.end_time) } as unknown as Appointment;
}

export async function rescheduleByStaff(session: Session | null, id: string, newDate: string, newStart: string): Promise<Appointment> {
  requireStaff(session);
  const res = await rpc<{ date: string; start_time: string }>("reschedule_by_staff", {
    p_id: id, p_date: newDate, p_start: newStart,
  });
  emit();
  return { date: res.date, start_time: hhmm(res.start_time) } as unknown as Appointment;
}

/**
 * Consultant self-service: reschedule an OWN appointment.
 * Server-side (reschedule_by_consultant): auth.uid() → consultants.user_id →
 * appointment.consultant_id, slot re-validation (availability, blocks, buffer,
 * notice) and double-booking prevention — identical guarantees to the engine.
 */
export async function rescheduleByConsultant(session: Session | null, id: string, newDate: string, newStart: string): Promise<Appointment> {
  requireSession(session);
  const res = await rpc<{ date: string; start_time: string }>("reschedule_by_consultant", {
    p_id: id, p_date: newDate, p_start: newStart,
  });
  emit();
  return { date: res.date, start_time: hhmm(res.start_time) } as unknown as Appointment;
}

/** Consultant self-service: cancel an OWN appointment (record kept, status flipped). */
export async function cancelByConsultant(session: Session | null, id: string, reason: string): Promise<void> {
  requireSession(session);
  await rpc("cancel_by_consultant", { p_id: id, p_reason: reason ?? "" });
  emit();
}

export async function cancelByToken(manageToken: string, reason: string): Promise<void> {
  await rpc("cancel_by_token", { p_token: manageToken, p_reason: reason ?? "" });
  emit();
}

// ═════════════════════════════════════════════════════════════════════════════
// PAYMENTS & INVOICES (Stripe is DEMO — rows persist with method 'stripe_demo')
// ═════════════════════════════════════════════════════════════════════════════

export async function listPayments(session: Session | null): Promise<(Payment & { client_name: string; consultant_name: string; service_name: string; reference: string })[]> {
  requireSession(session);
  const rows = await selectAll<Payment>("payments", (q) => q.order("created_at", { ascending: false }));
  const apptIds = [...new Set(rows.map((p) => p.appointment_id).filter(Boolean))] as string[];
  const clientIds = [...new Set(rows.map((p) => p.client_id).filter(Boolean))] as string[];
  const consIds = [...new Set(rows.map((p) => p.consultant_id).filter(Boolean))] as string[];
  const [appts, clients, cons] = await Promise.all([
    apptIds.length ? selectAll<{ id: string; reference: string; service_name: string }>("appointments", (q) => q.select("id, reference, service_name").in("id", apptIds)) : Promise.resolve([] as { id: string; reference: string; service_name: string }[]),
    clientIds.length ? selectAll<{ id: string; full_name: string }>("profiles", (q) => q.select("id, full_name").in("id", clientIds)) : Promise.resolve([] as { id: string; full_name: string }[]),
    consIds.length ? selectAll<{ id: string; display_name: string }>("consultants", (q) => q.select("id, display_name").in("id", consIds)) : Promise.resolve([] as { id: string; display_name: string }[]),
  ]);
  return rows.map((p) => ({
    ...p,
    amount_gross: Number(p.amount_gross), platform_fee: Number(p.platform_fee), consultant_net: Number(p.consultant_net),
    client_name: clients.find((c) => c.id === p.client_id)?.full_name ?? "—",
    consultant_name: cons.find((c) => c.id === p.consultant_id)?.display_name ?? "—",
    service_name: appts.find((a) => a.id === p.appointment_id)?.service_name ?? "—",
    reference: appts.find((a) => a.id === p.appointment_id)?.reference ?? "—",
  }));
}

/** Demo checkout verification — persists the payment via the server-side pay_payment flow. */
export async function verifyAndCompletePayment(session: Session | null, paymentId: string, outcome: "succeeded" | "failed"): Promise<void> {
  requireSession(session);
  if (outcome === "failed") throw new QueryError("Pagesa u refuzua nga procesori (demo). Provoni përsëri.");
  await rpc("pay_payment", { p_id: paymentId, p_method: "stripe_demo" });
  emit();
}

export async function refundPayment(session: Session | null, paymentId: string): Promise<void> {
  requireAdmin(session);
  await rpc("refund_payment", { p_id: paymentId });
  emit();
}

export async function setPayoutStatus(session: Session | null, paymentId: string, status: "approved" | "paid"): Promise<void> {
  requireAdmin(session);
  await rpc("set_payout_status", { p_id: paymentId, p_status: status });
  emit();
}

export async function listInvoices(session: Session | null): Promise<(Invoice & { client_name: string; reference: string })[]> {
  requireSession(session);
  const rows = await selectAll<Invoice>("invoices", (q) => q.order("created_at", { ascending: false }));
  const apptIds = [...new Set(rows.map((i) => i.appointment_id).filter(Boolean))] as string[];
  const clientIds = [...new Set(rows.map((i) => i.client_id).filter(Boolean))] as string[];
  const [appts, clients] = await Promise.all([
    apptIds.length ? selectAll<{ id: string; reference: string }>("appointments", (q) => q.select("id, reference").in("id", apptIds)) : Promise.resolve([] as { id: string; reference: string }[]),
    clientIds.length ? selectAll<{ id: string; full_name: string }>("profiles", (q) => q.select("id, full_name").in("id", clientIds)) : Promise.resolve([] as { id: string; full_name: string }[]),
  ]);
  return rows.map((i) => ({
    ...i,
    amount_net: Number(i.amount_net), tax_amount: Number(i.tax_amount), amount_total: Number(i.amount_total),
    client_name: clients.find((c) => c.id === i.client_id)?.full_name ?? "—",
    reference: appts.find((a) => a.id === i.appointment_id)?.reference ?? "—",
  }));
}

export async function getInvoice(session: Session | null, id: string): Promise<Invoice & { client_name: string; client_email: string; service_name: string; reference: string; consultant_name: string }> {
  requireSession(session);
  const rows = await selectAll<Invoice>("invoices", (q) => q.eq("id", id));
  if (!rows.length) throw new QueryError("Fatura nuk u gjet.");
  const inv = rows[0];
  const appt = inv.appointment_id
    ? (await selectAll<{ reference: string; service_name: string; consultant_name: string }>("appointments", (q) => q.select("id, reference, service_name, consultant_name").eq("id", inv.appointment_id)))[0]
    : undefined;
  const profile = inv.client_id ? await fetchProfile(inv.client_id) : null;
  return {
    ...inv,
    amount_net: Number(inv.amount_net), tax_amount: Number(inv.tax_amount), amount_total: Number(inv.amount_total),
    client_name: profile?.full_name ?? "—",
    client_email: profile?.email ?? "—",
    service_name: appt?.service_name ?? "—",
    reference: appt?.reference ?? "—",
    consultant_name: appt?.consultant_name ?? "—",
  };
}

export async function setInvoiceStatus(session: Session | null, id: string, status: Invoice["status"]): Promise<void> {
  requireAdmin(session);
  const { error } = await sb.from("invoices").update({ status }).eq("id", id);
  if (error) throw new QueryError(mapError(error.message));
  await rpc("log_activity", { p_action: `invoice.${status}`, p_entity_type: "invoice", p_entity_id: id, p_metadata: status }).catch(() => undefined);
  emit();
}

// ═════════════════════════════════════════════════════════════════════════════
// FILES — real metadata in PostgreSQL. Binary storage (Supabase Storage bucket
// 'project-files' is provisioned by the migrations) is wired in the next phase.
// ═════════════════════════════════════════════════════════════════════════════

export async function listFiles(session: Session | null, filter: { category?: string; search?: string } = {}): Promise<(ProjectFile & { project_title: string; client_name: string; uploader_name: string })[]> {
  requireSession(session);
  let rows = await selectAll<ProjectFile>("project_files", (q) => q.order("created_at", { ascending: false }));
  if (filter.category && filter.category !== "all") rows = rows.filter((f) => f.category === filter.category);
  if (filter.search) rows = rows.filter((f) => f.file_name.toLowerCase().includes(filter.search!.toLowerCase()));
  const projIds = [...new Set(rows.map((f) => f.project_id).filter(Boolean))] as string[];
  const profileIds = [...new Set(rows.flatMap((f) => [f.client_id, f.uploaded_by]).filter(Boolean))] as string[];
  const [projects, profiles] = await Promise.all([
    projIds.length ? selectAll<{ id: string; title: string }>("projects", (q) => q.select("id, title").in("id", projIds)) : Promise.resolve([] as { id: string; title: string }[]),
    profileIds.length ? selectAll<{ id: string; full_name: string }>("profiles", (q) => q.select("id, full_name").in("id", profileIds)) : Promise.resolve([] as { id: string; full_name: string }[]),
  ]);
  return rows.map((f) => ({
    ...f, file_size: Number(f.file_size),
    project_title: projects.find((p) => p.id === f.project_id)?.title ?? "—",
    client_name: profiles.find((p) => p.id === f.client_id)?.full_name ?? "—",
    uploader_name: profiles.find((p) => p.id === f.uploaded_by)?.full_name ?? "—",
  }));
}

export async function uploadFile(
  session: Session | null,
  meta: { name: string; size: number; ext: string; category: FileCategory; project_id?: string | null; appointment_id?: string | null; note?: string },
): Promise<void> {
  const s = requireSession(session);
  const ext = meta.ext.startsWith(".") ? meta.ext : "." + meta.ext;
  if (!ALLOWED_EXT.includes(ext.toLowerCase()))
    throw new QueryError(`Format i palejuar. Lejohen: ${ALLOWED_EXT.join(", ")}`);
  if (meta.size > MAX_FILE_MB * 1024 * 1024) throw new QueryError(`Skedari tejkalon ${MAX_FILE_MB} MB.`);

  let clientId = s.user_id;
  if (meta.project_id) {
    const projects = await selectAll<{ id: string; client_id: string }>("projects", (q) => q.select("id, client_id").eq("id", meta.project_id!));
    if (!projects.length) throw new QueryError("Projekti nuk u gjet ose nuk keni akses.");
    clientId = projects[0].client_id;
  } else if (meta.appointment_id) {
    const appts = await selectAll<{ id: string; client_id: string }>("appointments", (q) => q.select("id, client_id").eq("id", meta.appointment_id!));
    if (!appts.length) throw new QueryError("Termini nuk u gjet ose nuk keni akses.");
    clientId = appts[0].client_id;
  } else if (s.user.role !== "client") {
    throw new QueryError("Zgjidhni projektin ose terminin.");
  }

  // Metadata persists now; the binary object follows when Supabase Storage upload is enabled.
  const scope = meta.project_id ?? clientId;
  const { error } = await sb.from("project_files").insert({
    client_id: clientId,
    project_id: meta.project_id ?? null,
    appointment_id: meta.appointment_id ?? null,
    uploaded_by: s.user_id,
    file_name: meta.name,
    file_path: `${scope}/deferred/${uid("")}_${meta.name}`,
    file_type: ext.replace(".", ""),
    file_size: meta.size,
    category: meta.category,
    content_note: meta.note || "Metadata e ruajtur në PostgreSQL. Objekti binar (Supabase Storage) aktivizohet në fazën tjetër.",
  });
  if (error) throw new QueryError(mapError(error.message));
  await rpc("log_activity", { p_action: "file.uploaded", p_entity_type: "file", p_entity_id: meta.name, p_metadata: `${meta.name} (${meta.category})` }).catch(() => undefined);
  emit();
}

/** DEFERRED: binary objects live in Supabase Storage once the upload phase ships. */
export async function createSignedUrl(session: Session | null, fileId: string): Promise<{ url: string; expiresInMin: number }> {
  requireSession(session);
  const rows = await selectAll<ProjectFile>("project_files", (q) => q.eq("id", fileId));
  if (!rows.length) throw new QueryError("Skedari nuk u gjet.");
  throw new QueryError("Shkarkimi binar aktivizohet me Supabase Storage në fazën tjetër — metadata është e ruajtur.");
}

export async function downloadFile(session: Session | null, fileId: string): Promise<void> {
  requireSession(session);
  const rows = await selectAll<ProjectFile>("project_files", (q) => q.eq("id", fileId));
  if (!rows.length) throw new QueryError("Skedari nuk u gjet.");
  throw new QueryError("Shkarkimi binar aktivizohet me Supabase Storage në fazën tjetër — metadata është e ruajtur.");
}

export async function deleteFile(session: Session | null, fileId: string): Promise<void> {
  requireSession(session);
  const { error } = await sb.from("project_files").delete().eq("id", fileId);
  if (error) throw new QueryError(mapError(error.message));
  await rpc("log_activity", { p_action: "file.deleted", p_entity_type: "file", p_entity_id: fileId, p_metadata: "" }).catch(() => undefined);
  emit();
}

// ═════════════════════════════════════════════════════════════════════════════
// PROJECTS (Client → Project → Appointments → Consultants → Tasks → Files)
// ═════════════════════════════════════════════════════════════════════════════

export interface ProjectRow extends Project {
  client_name: string; consultant_name: string; progress: number;
  collaborators: { consultant_id: string; name: string; role: string }[];
  task_stats: { total: number; completed: number };
  next_appointment: { date: string; start_time: string } | null;
  files_count: number;
}

interface TaskRow {
  id: string; project_id: string; name: string; task_order: number;
  status: "not_started" | "in_progress" | "waiting" | "completed" | "not_required";
  progress: number; notes: string; assigned_consultant_id: string | null; completed_at: string | null;
}

export async function listProjects(session: Session | null, filter: { status?: string; search?: string } = {}): Promise<ProjectRow[]> {
  requireSession(session);
  let rows = await selectAll<Project>("projects");
  if (filter.status && filter.status !== "all") rows = rows.filter((p) => p.status === filter.status);
  if (filter.search) {
    const q = filter.search.toLowerCase();
    rows = rows.filter((p) => p.title.toLowerCase().includes(q) || (p.research_topic ?? "").toLowerCase().includes(q));
  }
  if (!rows.length) return [];
  const ids = rows.map((p) => p.id);
  const [tasks, pcs, appts, files, clientIds] = await Promise.all([
    selectAll<TaskRow>("analysis_tasks", (q) => q.in("project_id", ids)),
    selectAll<{ project_id: string; consultant_id: string; role: string }>("project_consultants", (q) => q.in("project_id", ids)),
    selectAll<{ project_id: string; date: string; start_time: string; status: string }>("appointments", (q) => q.in("project_id", ids)),
    selectAll<{ project_id: string }>("project_files", (q) => q.select("project_id").in("project_id", ids)),
    Promise.resolve([...new Set(rows.map((p) => p.client_id))]),
  ]);
  const [profiles, consultants] = await Promise.all([
    selectAll<{ id: string; full_name: string }>("profiles", (q) => q.select("id, full_name").in("id", clientIds)),
    selectAll<{ id: string; display_name: string }>("consultants"),
  ]);
  const today = todayISO();
  return rows.map((p) => {
    const ptasks = tasks.filter((t) => t.project_id === p.id && t.status !== "not_required");
    const upcoming = appts
      .filter((a) => a.project_id === p.id && ["confirmed", "pending"].includes(a.status) && a.date >= today)
      .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time))[0];
    return {
      ...p,
      deadline: p.deadline ? String(p.deadline).slice(0, 10) : null,
      client_name: profiles.find((x) => x.id === p.client_id)?.full_name ?? "—",
      consultant_name: consultants.find((c) => c.id === p.primary_consultant_id)?.display_name ?? "—",
      progress: ptasks.length ? Math.round(ptasks.reduce((acc, t) => acc + t.progress, 0) / ptasks.length) : 0,
      collaborators: pcs.filter((pc) => pc.project_id === p.id).map((pc) => ({
        consultant_id: pc.consultant_id,
        name: consultants.find((c) => c.id === pc.consultant_id)?.display_name ?? "—",
        role: pc.role,
      })),
      task_stats: { total: ptasks.length, completed: ptasks.filter((t) => t.status === "completed").length },
      next_appointment: upcoming ? { date: upcoming.date, start_time: hhmm(upcoming.start_time) } : null,
      files_count: files.filter((f) => f.project_id === p.id).length,
    };
  }).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function getProjectDetail(session: Session | null, id: string): Promise<{
  project: ProjectRow;
  appointments: AppointmentRow[];
  files: (ProjectFile & { uploader_name: string })[];
  tasks: TaskRow[];
  payments: Payment[];
  activity: { id: string; actor_id: string | null; actor_name: string; actor_role: string; action: string; entity_type: string; entity_id: string; metadata: string; created_at: string }[];
  client_user?: User;
}> {
  const s = requireSession(session);
  const projects = await selectAll<Project>("projects", (q) => q.eq("id", id));
  if (!projects.length) throw new QueryError("Projekti nuk u gjet ose nuk keni akses.");
  const [list] = await Promise.all([listProjects(session)]);
  void list;
  const rows = await listProjects(session);
  const project = rows.find((p) => p.id === id);
  if (!project) throw new QueryError("Projekti nuk u gjet.");

  const [apptRows, fileRows, taskRows, payRows, noteRows] = await Promise.all([
    selectAll<ApptRow>("appointments", (q) => q.eq("project_id", id).order("date").order("start_time")),
    selectAll<ProjectFile>("project_files", (q) => q.eq("project_id", id).order("created_at", { ascending: false })),
    selectAll<TaskRow>("analysis_tasks", (q) => q.eq("project_id", id).order("task_order")),
    selectAll<Payment>("payments", (q) => q.eq("project_id", id).order("created_at", { ascending: false })),
    selectAll<{ id: string; author_id: string | null; author_name: string; note: string; created_at: string }>("project_notes", (q) => q.eq("project_id", id).order("created_at", { ascending: false })),
  ]);
  const appointments = await hydrateAppointments(apptRows);
  const uploaderIds = [...new Set(fileRows.map((f) => f.uploaded_by).filter(Boolean))] as string[];
  const uploaders = uploaderIds.length ? await selectAll<{ id: string; full_name: string }>("profiles", (q) => q.select("id, full_name").in("id", uploaderIds)) : [];
  const isStaff = ["admin", "super_admin"].includes(s.user.role);
  const staffActivity = isStaff
    ? await selectAll<{ id: string; actor_id: string | null; actor_name: string; actor_role: string; action: string; entity_type: string; entity_id: string; metadata: string; created_at: string }>(
        "activity_log", (q) => q.eq("entity_type", "project").eq("entity_id", id).order("created_at", { ascending: false }))
    : [];
  const activity = [
    ...noteRows.map((n) => ({
      id: n.id, actor_id: n.author_id, actor_name: n.author_name || "—", actor_role: "team",
      action: "project.note", entity_type: "project", entity_id: id, metadata: n.note, created_at: n.created_at,
    })),
    ...staffActivity,
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));

  const clientProfile = await fetchProfile(project.client_id).catch(() => null);
  return {
    project,
    appointments,
    files: fileRows.map((f) => ({
      ...f, file_size: Number(f.file_size),
      uploader_name: uploaders.find((u) => u.id === f.uploaded_by)?.full_name ?? "—",
    })),
    tasks: taskRows,
    payments: payRows.map((p) => ({ ...p, amount_gross: Number(p.amount_gross), platform_fee: Number(p.platform_fee), consultant_net: Number(p.consultant_net) })),
    activity,
    client_user: clientProfile ? mapUser(clientProfile) : undefined,
  };
}

export async function createProject(session: Session | null, data: Partial<Project> & { client_id: string; primary_consultant_id: string; title: string }): Promise<Project> {
  const s = requireAdmin(session);
  const { data: row, error } = await sb.from("projects").insert({
    client_id: data.client_id,
    primary_consultant_id: data.primary_consultant_id,
    title: data.title,
    description: data.description ?? "",
    research_topic: data.research_topic ?? "",
    research_questions: data.research_questions ?? "",
    hypotheses: data.hypotheses ?? "",
    study_level: data.study_level ?? "master",
    university: data.university ?? "",
    deadline: data.deadline || null,
    status: "new",
  }).select().single();
  if (error) throw new QueryError(mapError(error.message));
  const p = row as Project;
  const { error: pcErr } = await sb.from("project_consultants").insert({
    project_id: p.id, consultant_id: p.primary_consultant_id, role: "lead",
  });
  if (pcErr && !pcErr.message.includes("duplicate")) throw new QueryError(mapError(pcErr.message));
  await rpc("log_activity", { p_action: "project.created", p_entity_type: "project", p_entity_id: p.id, p_metadata: p.title }).catch(() => undefined);
  void s;
  emit();
  return p;
}

export async function updateProjectStatus(session: Session | null, id: string, status: Project["status"]): Promise<void> {
  const s = requireStaff(session);
  const before = await selectAll<Project>("projects", (q) => q.select("id, status").eq("id", id));
  const { error } = await sb.from("projects").update({ status }).eq("id", id);
  if (error) throw new QueryError(mapError(error.message));
  await rpc("log_activity", {
    p_action: "project.status_changed", p_entity_type: "project", p_entity_id: id,
    p_metadata: `${before[0]?.status ?? "?"} → ${status}`,
  }).catch(() => undefined);
  void s;
  emit();
}

export async function assignProjectConsultant(session: Session | null, projectId: string, consultantId: string, role: "statistics" | "methodology" | "data_analyst" | "lead"): Promise<void> {
  requireAdmin(session);
  const { error } = await sb.from("project_consultants").upsert(
    { project_id: projectId, consultant_id: consultantId, role },
    { onConflict: "project_id,consultant_id" },
  );
  if (error) throw new QueryError(mapError(error.message));
  if (role === "lead") {
    const { error: e2 } = await sb.from("projects").update({ primary_consultant_id: consultantId }).eq("id", projectId);
    if (e2) throw new QueryError(mapError(e2.message));
  }
  const cons = await selectAll<{ display_name: string }>("consultants", (q) => q.select("display_name").eq("id", consultantId));
  await rpc("log_activity", {
    p_action: "consultant.assigned", p_entity_type: "project", p_entity_id: projectId,
    p_metadata: `${cons[0]?.display_name ?? consultantId} → ${role}`,
  }).catch(() => undefined);
  emit();
}

export async function addProjectNote(session: Session | null, projectId: string, note: string): Promise<void> {
  const s = requireStaff(session);
  if (!note.trim()) throw new QueryError("Shënimi nuk mund të jetë bosh.");
  const { error } = await sb.from("project_notes").insert({
    project_id: projectId, author_id: s.user_id, author_name: s.user.full_name, note: note.trim(),
  });
  if (error) throw new QueryError(mapError(error.message));
  await rpc("log_activity", { p_action: "project.note", p_entity_type: "project", p_entity_id: projectId, p_metadata: note.trim() }).catch(() => undefined);
  emit();
}

export async function saveTask(
  session: Session | null, projectId: string,
  task: { id?: string; name: string; status: string; progress: number; notes: string; assigned_consultant_id: string | null },
): Promise<void> {
  const s = requireStaff(session);
  const progress = task.status === "completed" ? 100 : task.status === "not_started" ? 0 : task.progress;
  if (task.id) {
    const { error } = await sb.from("analysis_tasks").update({
      status: task.status, progress, notes: task.notes,
      assigned_consultant_id: task.assigned_consultant_id,
      completed_at: task.status === "completed" ? new Date().toISOString() : null,
    }).eq("id", task.id).eq("project_id", projectId);
    if (error) throw new QueryError(mapError(error.message));
    await rpc("log_activity", { p_action: "task.updated", p_entity_type: "project", p_entity_id: projectId, p_metadata: `${task.name} → ${task.status}` }).catch(() => undefined);
  } else {
    const existing = await selectAll<TaskRow>("analysis_tasks", (q) => q.select("task_order").eq("project_id", projectId));
    const maxOrder = existing.reduce((m, t) => Math.max(m, t.task_order ?? 0), 0);
    const { error } = await sb.from("analysis_tasks").insert({
      project_id: projectId, name: task.name, task_order: maxOrder + 1,
      status: task.status, progress, notes: task.notes,
      assigned_consultant_id: task.assigned_consultant_id,
    });
    if (error) throw new QueryError(mapError(error.message));
    await rpc("log_activity", { p_action: "task.added", p_entity_type: "project", p_entity_id: projectId, p_metadata: task.name }).catch(() => undefined);
  }
  void s;
  emit();
}

// ═════════════════════════════════════════════════════════════════════════════
// REVIEWS (verified: only clients with completed consultations; moderated)
// ═════════════════════════════════════════════════════════════════════════════

export async function myReviewableAppointments(session: Session | null): Promise<AppointmentRow[]> {
  const s = requireSession(session);
  const [completed, mine] = await Promise.all([
    selectAll<ApptRow>("appointments", (q) => q.eq("client_id", s.user_id).eq("status", "completed")),
    selectAll<{ appointment_id: string }>("reviews", (q) => q.select("appointment_id").eq("client_id", s.user_id)),
  ]);
  const reviewed = new Set(mine.map((r) => r.appointment_id));
  return hydrateAppointments(completed.filter((a) => !reviewed.has(a.id)));
}

export async function submitReview(
  session: Session | null, appointmentId: string,
  review: { rating: number; clarity: number; usefulness: number; recommendation: number; comment: string; consent_to_publish: boolean; show_name: boolean },
): Promise<void> {
  const s = requireSession(session);
  const appts = await selectAll<{ consultant_id: string; status: string }>("appointments", (q) => q.select("consultant_id, status").eq("id", appointmentId));
  if (!appts.length) throw new QueryError("Termini nuk u gjet.");
  if (appts[0].status !== "completed") throw new QueryError("Vetëm konsultat e përfunduara mund të vlerësohen.");
  const { error } = await sb.from("reviews").insert({
    appointment_id: appointmentId,
    client_id: s.user_id,
    consultant_id: appts[0].consultant_id,
    rating: review.rating, clarity: review.clarity, usefulness: review.usefulness,
    recommendation: review.recommendation, comment: review.comment ?? "",
    consent_to_publish: review.consent_to_publish, show_name: review.show_name,
    status: "pending",
  });
  if (error) throw new QueryError(mapError(error.message));
  await rpc("log_activity", { p_action: "review.submitted", p_entity_type: "appointment", p_entity_id: appointmentId, p_metadata: `${review.rating}/5` }).catch(() => undefined);
  emit();
}

export async function listReviews(session: Session | null, filter: { status?: string } = {}): Promise<({ id: string; appointment_id: string; client_id: string; consultant_id: string; rating: number; clarity: number; usefulness: number; recommendation: number; comment: string; show_name: boolean; consent_to_publish: boolean; status: string; created_at: string } & { client_name: string; consultant_name: string; reference: string })[]> {
  requireSession(session);
  let rows = await selectAll<{ id: string; appointment_id: string; client_id: string; consultant_id: string; rating: number; clarity: number; usefulness: number; recommendation: number; comment: string; show_name: boolean; consent_to_publish: boolean; status: string; created_at: string }>("reviews", (q) => q.order("created_at", { ascending: false }));
  if (filter.status && filter.status !== "all") rows = rows.filter((r) => r.status === filter.status);
  const apptIds = [...new Set(rows.map((r) => r.appointment_id).filter(Boolean))];
  const clientIds = [...new Set(rows.map((r) => r.client_id).filter(Boolean))];
  const [appts, clients, cons] = await Promise.all([
    apptIds.length ? selectAll<{ id: string; reference: string }>("appointments", (q) => q.select("id, reference").in("id", apptIds)) : Promise.resolve([] as { id: string; reference: string }[]),
    clientIds.length ? selectAll<{ id: string; full_name: string }>("profiles", (q) => q.select("id, full_name").in("id", clientIds)) : Promise.resolve([] as { id: string; full_name: string }[]),
    selectAll<{ id: string; display_name: string }>("consultants", (q) => q.select("id, display_name")),
  ]);
  return rows.map((r) => ({
    ...r,
    client_name: clients.find((c) => c.id === r.client_id)?.full_name ?? "Klient i verifikuar",
    consultant_name: cons.find((c) => c.id === r.consultant_id)?.display_name ?? "—",
    reference: appts.find((a) => a.id === r.appointment_id)?.reference ?? "—",
  }));
}

export async function moderateReview(session: Session | null, id: string, status: "pending" | "published" | "rejected"): Promise<void> {
  requireAdmin(session);
  const { error } = await sb.from("reviews").update({ status }).eq("id", id);
  if (error) throw new QueryError(mapError(error.message));
  await rpc("log_activity", { p_action: `review.${status}`, p_entity_type: "review", p_entity_id: id, p_metadata: "" }).catch(() => undefined);
  emit();
}

// ═════════════════════════════════════════════════════════════════════════════
// WAITLIST & CONSULTANT APPLICATIONS
// ═════════════════════════════════════════════════════════════════════════════

export async function addToWaitlist(entry: {
  name: string; email: string; phone: string; service_id: string | null;
  consultant_id: string | null; preferred_dates: string; preferred_time: string;
}): Promise<void> {
  const { error } = await sb.from("waitlist").insert({
    name: entry.name, email: entry.email, phone: entry.phone ?? "",
    service_id: entry.service_id || null, consultant_id: entry.consultant_id || null,
    preferred_dates: entry.preferred_dates ?? "", preferred_time: entry.preferred_time ?? "morning",
    status: "waiting",
  });
  if (error) throw new QueryError(mapError(error.message));
  emit();
}

export async function listWaitlist(session: Session | null) {
  requireAdmin(session);
  const rows = await selectAll<{ id: string; name: string; email: string; phone: string; service_id: string | null; consultant_id: string | null; preferred_dates: string; preferred_time: string; status: "waiting" | "notified" | "booked" | "expired"; has_match: boolean; created_at: string }>("waitlist", (q) => q.order("created_at", { ascending: false }));
  const [services, cons] = await Promise.all([
    selectAll<{ id: string; name: string }>("services", (q) => q.select("id, name")),
    selectAll<{ id: string; display_name: string }>("consultants", (q) => q.select("id, display_name")),
  ]);
  return rows.map((w) => ({
    ...w,
    service_name: services.find((s) => s.id === w.service_id)?.name ?? "Çdo shërbim",
    consultant_name: cons.find((c) => c.id === w.consultant_id)?.display_name ?? "Çdo konsulent",
  }));
}

export async function setWaitlistStatus(session: Session | null, id: string, status: "waiting" | "notified" | "booked" | "expired"): Promise<void> {
  requireAdmin(session);
  const { error } = await sb.from("waitlist").update({ status }).eq("id", id);
  if (error) throw new QueryError(mapError(error.message));
  if (status === "notified")
    await rpc("log_activity", { p_action: "waitlist.notified", p_entity_type: "waitlist", p_entity_id: id, p_metadata: "" }).catch(() => undefined);
  emit();
}

/** Remove an obsolete waitlist row (RLS: staff-only delete). */
export async function deleteWaitlist(session: Session | null, id: string): Promise<void> {
  requireAdmin(session);
  const { error } = await sb.from("waitlist").delete().eq("id", id);
  if (error) throw new QueryError(mapError(error.message));
  await rpc("log_activity", { p_action: "waitlist.deleted", p_entity_type: "waitlist", p_entity_id: id, p_metadata: "" }).catch(() => undefined);
  emit();
}

export interface ApplicationPayload {
  name: string; email: string; phone: string; country: string;
  professional_title: string; education: string; years_experience: number;
  spss_experience: string; methodology_experience: string; bio: string;
  specializations: string[]; languages: string[];
  cv_file: string; linkedin: string; motivation: string;
}

export type ApplicationStatus = "submitted" | "under_review" | "approved" | "rejected";

export interface ApplicationRow extends ApplicationPayload {
  id: string;
  applicant_id: string | null;
  status: ApplicationStatus;
  created_at: string;
}

/** Public/anonymous submission (keeps applicant_id null). */
export async function submitApplication(app: ApplicationPayload): Promise<void> {
  const { error } = await sb.from("consultant_applications").insert({ ...app, applicant_id: null, status: "submitted" });
  if (error) throw new QueryError(mapError(error.message));
  emit();
}

/**
 * Consultant registration: real Supabase Auth user + client profile +
 * application linked to the authenticated user. NO consultant role is ever
 * requested — approval is an admin-only database operation.
 */
export async function registerConsultantApplicant(data: ApplicationPayload & { password: string }): Promise<{ needsConfirmation: boolean }> {
  const { data: up, error } = await sb.auth.signUp({
    email: data.email.trim(),
    password: data.password,
    options: { data: { full_name: data.name.trim() } },
  });
  if (error) throw new QueryError(mapError(error.message));
  let userId = up.session?.user?.id ?? null;
  if (!userId) {
    const { data: si, error: e2 } = await sb.auth.signInWithPassword({ email: data.email.trim(), password: data.password });
    if (!e2 && si.session?.user) userId = si.session.user.id;
  }
  if (userId) await rpc("ensure_profile").catch(() => undefined);

  const { error: appErr } = await sb.from("consultant_applications").insert({
    name: data.name.trim(), email: data.email.trim(), phone: data.phone, country: data.country,
    professional_title: data.professional_title, education: data.education,
    years_experience: data.years_experience, spss_experience: data.spss_experience,
    methodology_experience: data.methodology_experience, bio: data.bio,
    specializations: data.specializations, languages: data.languages,
    cv_file: data.cv_file, linkedin: data.linkedin, motivation: data.motivation,
    applicant_id: userId, status: "submitted",
  });
  if (appErr) throw new QueryError(mapError(appErr.message));
  emit();
  return { needsConfirmation: !userId };
}

/** The authenticated user's own latest application (via SECURITY DEFINER RPC). */
export async function getMyApplication(session: Session | null): Promise<ApplicationRow | null> {
  requireSession(session);
  const res = await rpc<ApplicationRow | null>("my_application");
  return res ?? null;
}

export async function listApplications(session: Session | null): Promise<ApplicationRow[]> {
  requireAdmin(session);
  return selectAll<ApplicationRow>("consultant_applications", (q) => q.order("created_at", { ascending: false }));
}

/**
 * Status transitions. 'approved' / 'rejected' run as atomic SECURITY DEFINER
 * RPCs — the frontend can never promote a role or mint a consultant directly.
 */
export async function setApplicationStatus(
  session: Session | null, id: string, status: "under_review" | "approved" | "rejected",
): Promise<void> {
  requireAdmin(session);
  if (status === "approved") {
    await rpc("admin_approve_application", { p_id: id });
  } else if (status === "rejected") {
    await rpc("admin_reject_application", { p_id: id });
  } else {
    const { error } = await sb.from("consultant_applications").update({ status }).eq("id", id);
    if (error) throw new QueryError(mapError(error.message));
    await rpc("log_activity", { p_action: "application.under_review", p_entity_type: "consultant_application", p_entity_id: id, p_metadata: "" }).catch(() => undefined);
  }
  emit();
}

function slugify(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "konsulent";
}

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN: clients, consultants, services, availability, settings
// ═════════════════════════════════════════════════════════════════════════════

export async function listClientsAdmin(session: Session | null): Promise<AdminClientRow[]> {
  requireAdmin(session);
  const rows = await rpc<AdminClientRow[]>("admin_clients");
  return (rows ?? []).map((r) => ({
    ...r, spent: Number(r.spent) || 0,
    last_booking: r.last_booking ? String(r.last_booking).slice(0, 10) : null,
    created_at: String(r.created_at ?? ""),
  }));
}

export async function listConsultantsAdmin(session: Session | null): Promise<AdminConsultantRow[]> {
  requireAdmin(session);
  const rows = await rpc<AdminConsultantRow[]>("admin_consultants");
  return (rows ?? []).map((r) => ({
    ...r, revenue: Number(r.revenue) || 0, rating: Number(r.rating) || 0,
    years_experience: Number(r.years_experience) || 0, commission_percentage: Number(r.commission_percentage) || 20,
  }));
}

export async function getConsultantServiceRows(session: Session | null, consultantId: string) {
  requireAdmin(session);
  return selectAll<{ id: string; consultant_id: string; service_id: string; price: number; duration_minutes: number; is_active: boolean }>(
    "consultant_services", (q) => q.eq("consultant_id", consultantId));
}

export async function saveConsultantAdmin(
  session: Session | null,
  data: Partial<{
    id: string; display_name: string; professional_title: string; bio: string;
    education: string[]; certifications: string[]; years_experience: number;
    languages: string[]; specializations: string[]; status: string; commission_percentage: number;
    is_active: boolean; is_featured: boolean; email: string;
  }>,
): Promise<{ temp_password?: string }> {
  requireAdmin(session);
  if (data.id) {
    const patch: Record<string, unknown> = {};
    for (const k of ["display_name", "professional_title", "bio", "education", "certifications", "years_experience", "languages", "specializations", "status", "is_active", "is_featured"] as const)
      if (data[k] !== undefined) patch[k] = data[k];
    const { error } = await sb.from("consultants").update(patch).eq("id", data.id);
    if (error) throw new QueryError(mapError(error.message));
    if (data.commission_percentage !== undefined)
      await sb.from("consultant_terms").upsert({ consultant_id: data.id, commission_percentage: data.commission_percentage });
    await rpc("log_activity", { p_action: "consultant.updated", p_entity_type: "consultant", p_entity_id: data.id, p_metadata: data.display_name ?? "" }).catch(() => undefined);
    emit();
    return {};
  }
  if (!data.email) throw new QueryError("Email-i është i detyrueshëm.");
  const res = await rpc<{ consultant_id: string; temp_password: string }>("admin_create_consultant", {
    p_email: data.email.trim(), p_name: data.display_name ?? "Konsulent",
    p_title: data.professional_title ?? "", p_commission: data.commission_percentage ?? 20,
    p_specializations: data.specializations ?? [], p_languages: data.languages ?? ["sq"],
  });
  const extra: Record<string, unknown> = { status: data.status ?? "pending", is_active: data.is_active ?? false };
  if (data.bio !== undefined) extra.bio = data.bio;
  if (data.education) extra.education = data.education;
  if (data.certifications) extra.certifications = data.certifications;
  if (data.years_experience !== undefined) extra.years_experience = data.years_experience;
  await sb.from("consultants").update(extra).eq("id", res.consultant_id);
  emit();
  return { temp_password: res.temp_password };
}

export async function saveConsultantServicesAdmin(
  session: Session | null, consultantId: string,
  rows: { service_id: string; price: number; duration_minutes: number; is_active?: boolean }[],
): Promise<void> {
  requireAdmin(session);
  if (!rows.length) { emit(); return; }
  const { error } = await sb.from("consultant_services").upsert(
    rows.map((r) => ({
      consultant_id: consultantId, service_id: r.service_id,
      price: r.price, duration_minutes: r.duration_minutes, is_active: r.is_active ?? true,
    })),
    { onConflict: "consultant_id,service_id" },
  );
  if (error) throw new QueryError(mapError(error.message));
  emit();
}

/**
 * Consultant SELF-SERVICE profile update (fixes the previous admin-gated path).
 * An approved consultant may edit their own public profile fields only.
 * RLS (`consultants_update`) already restricts the row to user_id = auth.uid();
 * here we additionally whitelist the editable columns so protected fields
 * (status, is_active, is_featured, rating, review_count, commission, user_id)
 * can never be touched from this entry point.
 */
export async function saveConsultantSelf(
  session: Session | null,
  patch: Partial<{
    display_name: string; professional_title: string; bio: string;
    education: string[]; certifications: string[]; years_experience: number;
    languages: string[]; specializations: string[];
  }>,
): Promise<void> {
  const s = requireSession(session);
  if (s.user.role !== "consultant") throw new QueryError("Vetëm konsulentët e aprovuar mund të redaktojnë profilin.");
  const cId = await myConsultantId(session);
  if (!cId) throw new QueryError("Profili i konsulentit nuk u gjet.");
  const allowed: Record<string, unknown> = {};
  const keys = ["display_name", "professional_title", "bio", "education", "certifications", "years_experience", "languages", "specializations"] as const;
  for (const k of keys) if (patch[k] !== undefined) allowed[k] = patch[k];
  if (Object.keys(allowed).length === 0) return;
  const { error } = await sb.from("consultants").update(allowed).eq("id", cId);
  if (error) throw new QueryError(mapError(error.message));
  await rpc("log_activity", { p_action: "consultant.self_updated", p_entity_type: "consultant", p_entity_id: cId, p_metadata: Object.keys(allowed).join(", ") }).catch(() => undefined);
  emit();
}

// ── Hardened CRUD: deletes / edits that persist (never UI-only) ──────────────

/** Delete an analysis task (RLS: can_access_project on the parent project). */
export async function deleteAnalysisTask(session: Session | null, taskId: string): Promise<void> {
  requireSession(session);
  const { error } = await sb.from("analysis_tasks").delete().eq("id", taskId);
  if (error) throw new QueryError(mapError(error.message));
  await rpc("log_activity", { p_action: "task.deleted", p_entity_type: "analysis_task", p_entity_id: taskId, p_metadata: "" }).catch(() => undefined);
  emit();
}

/** Delete a project note (RLS: author or staff). */
export async function deleteProjectNote(session: Session | null, noteId: string): Promise<void> {
  requireSession(session);
  const { error } = await sb.from("project_notes").delete().eq("id", noteId);
  if (error) throw new QueryError(mapError(error.message));
  emit();
}

/** Unassign a consultant from a project. The PRIMARY consultant can't be removed
 *  through this path — callers must reassign the lead first (DB consistency). */
export async function removeProjectConsultant(session: Session | null, projectId: string, consultantId: string): Promise<void> {
  requireAdmin(session);
  const [proj] = await selectAll<Project>("projects", (q) => q.select("id, primary_consultant_id").eq("id", projectId));
  if (proj && proj.primary_consultant_id === consultantId)
    throw new QueryError("Konsulenti kryesor nuk mund të hiqet. Caktoni fillimisht një konsulent tjetër kryesor.");
  const { error } = await sb.from("project_consultants").delete().match({ project_id: projectId, consultant_id: consultantId });
  if (error) throw new QueryError(mapError(error.message));
  await rpc("log_activity", { p_action: "consultant.unassigned", p_entity_type: "project", p_entity_id: projectId, p_metadata: consultantId }).catch(() => undefined);
  emit();
}

/** Remove a single service offering from a consultant (does NOT touch the global service). */
export async function removeConsultantService(session: Session | null, consultantId: string, serviceId: string): Promise<void> {
  requireAdmin(session);
  const { error } = await sb.from("consultant_services").delete().match({ consultant_id: consultantId, service_id: serviceId });
  if (error) throw new QueryError(mapError(error.message));
  await rpc("log_activity", { p_action: "consultant_service.removed", p_entity_type: "consultant", p_entity_id: consultantId, p_metadata: serviceId }).catch(() => undefined);
  emit();
}

/**
 * Service lifecycle: deactivate is always safe (soft delete). Hard delete is
 * refused if the service is referenced by any appointment / consultant offer,
 * protecting referential history. The database remains the authority.
 */
export async function deactivateService(session: Session | null, id: string): Promise<void> {
  requireAdmin(session);
  const { error } = await sb.from("services").update({ is_active: false }).eq("id", id);
  if (error) throw new QueryError(mapError(error.message));
  await rpc("log_activity", { p_action: "service.deactivated", p_entity_type: "service", p_entity_id: id, p_metadata: "" }).catch(() => undefined);
  emit();
}

export async function hardDeleteServiceIfUnused(session: Session | null, id: string): Promise<void> {
  requireAdmin(session);
  const appts = await selectAll<{ id: string }>("appointments", (q) => q.select("id").eq("service_id", id).limit(1));
  const offers = await selectAll<{ id: string }>("consultant_services", (q) => q.select("id").eq("service_id", id).limit(1));
  if (appts.length || offers.length)
    throw new QueryError("Ky shërbim është i referencuar nga termine/oferta — çaktivizoheni në vend të fshirjes.");
  const { error } = await sb.from("services").delete().eq("id", id);
  if (error) throw new QueryError(mapError(error.message));
  await rpc("log_activity", { p_action: "service.deleted", p_entity_type: "service", p_entity_id: id, p_metadata: "" }).catch(() => undefined);
  emit();
}

/** Edit mutable project fields (description, deadline, research data, topic). */
export async function updateProjectEdit(
  session: Session | null, id: string,
  patch: Partial<{ description: string; research_topic: string; research_questions: string; hypotheses: string; deadline: string | null; university: string; study_level: string }>,
): Promise<void> {
  requireStaff(session);
  const allowed: Record<string, unknown> = {};
  for (const k of ["description", "research_topic", "research_questions", "hypotheses", "deadline", "university", "study_level"] as const)
    if (patch[k] !== undefined) allowed[k] = patch[k];
  if (Object.keys(allowed).length === 0) return;
  const { error } = await sb.from("projects").update(allowed).eq("id", id);
  if (error) throw new QueryError(mapError(error.message));
  await rpc("log_activity", { p_action: "project.updated", p_entity_type: "project", p_entity_id: id, p_metadata: Object.keys(allowed).join(", ") }).catch(() => undefined);
  emit();
}

export async function saveWeeklyAvailability(
  session: Session | null, consultantId: string,
  windows: { day: number; start: string; end: string }[],
): Promise<void> {
  requireSession(session);
  const { error: delErr } = await sb.from("weekly_availability").delete().eq("consultant_id", consultantId);
  if (delErr) throw new QueryError(mapError(delErr.message));
  if (windows.length) {
    const { error } = await sb.from("weekly_availability").insert(
      windows.map((w) => ({ consultant_id: consultantId, day_of_week: w.day, start_time: w.start, end_time: w.end, is_available: true })),
    );
    if (error) throw new QueryError(mapError(error.message));
  }
  await rpc("log_activity", { p_action: "availability.updated", p_entity_type: "consultant", p_entity_id: consultantId, p_metadata: `${windows.length} dritare` }).catch(() => undefined);
  emit();
}

export async function addBlock(session: Session | null, block: {
  consultant_id: string; date: string; end_date: string | null;
  start_time: string | null; end_time: string | null; reason: string; type: string;
}): Promise<void> {
  requireSession(session);
  const { error } = await sb.from("blocked_periods").insert({
    consultant_id: block.consultant_id,
    block_date: block.date,
    end_date: block.end_date || null,
    start_time: block.start_time || null,
    end_time: block.end_time || null,
    reason: block.reason,
    block_type: block.type ?? "personal",
  });
  if (error) throw new QueryError(mapError(error.message));
  emit();
}

export async function removeBlock(session: Session | null, blockId: string): Promise<void> {
  requireSession(session);
  const { error } = await sb.from("blocked_periods").delete().eq("id", blockId);
  if (error) throw new QueryError(mapError(error.message));
  emit();
}

export async function toggleGoogleCalendar(session: Session | null): Promise<boolean> {
  const s = requireSession(session);
  const rows = await selectAll<{ id: string; google_calendar_connected: boolean }>("consultants", (q) => q.select("id, google_calendar_connected").eq("user_id", s.user_id));
  if (!rows.length) throw new QueryError("Profili i konsulentit nuk u gjet.");
  const next = !rows[0].google_calendar_connected;
  const { error } = await sb.from("consultants").update({ google_calendar_connected: next }).eq("id", rows[0].id);
  if (error) throw new QueryError(mapError(error.message));
  emit();
  return next;
}

export async function saveServiceAdmin(session: Session | null, data: Partial<Record<string, unknown>> & { id?: string; name: string }): Promise<void> {
  requireAdmin(session);
  const { id, name, ...rest } = data as Record<string, unknown> & { id?: string; name: string };
  if (id) {
    const { error } = await sb.from("services").update({ name, ...rest }).eq("id", id);
    if (error) throw new QueryError(mapError(error.message));
  } else {
    const { error } = await sb.from("services").insert({
      name, slug: slugify(name) + "-" + uid("").slice(0, 4),
      short_description: rest.short_description ?? "", description: rest.description ?? "",
      category: rest.category ?? "consultation",
      default_duration_minutes: rest.default_duration_minutes ?? 60,
      default_price: rest.default_price ?? 50,
      payment_policy: rest.payment_policy ?? "full",
      deposit_amount: rest.deposit_amount ?? 0,
      is_active: rest.is_active ?? true,
    });
    if (error) throw new QueryError(mapError(error.message));
  }
  await rpc("log_activity", { p_action: id ? "service.updated" : "service.created", p_entity_type: "service", p_entity_id: id ?? name, p_metadata: name }).catch(() => undefined);
  emit();
}

// ── settings (single row; counters live in sequences server-side) ──

export async function getSettings(session: Session | null): Promise<Settings> {
  requireSession(session);
  const rows = await selectAll<Record<string, unknown>>("settings", (q) => q.limit(1));
  const r = rows[0] ?? {};
  return {
    min_cancel_hours: Number(r.min_cancel_hours ?? 24),
    min_reschedule_hours: Number(r.min_reschedule_hours ?? 12),
    buffer_minutes: Number(r.buffer_minutes ?? 15),
    min_notice_hours: Number(r.min_notice_hours ?? 2),
    booking_horizon_days: Number(r.max_booking_days ?? 60),
    default_commission: Number(r.default_commission ?? 20),
    tax_rate: Number(r.tax_rate ?? 18),
    reminder_hours: Array.isArray(r.reminder_hours) ? (r.reminder_hours as number[]) : [24, 1],
    counter_appointment: 0,
    counter_invoice: 0,
    platform_name: "StatLab",
  };
}

export async function updateSettings(session: Session | null, patch: Partial<Settings>): Promise<void> {
  requireAdmin(session);
  const dbPatch: Record<string, unknown> = {};
  if (patch.min_cancel_hours !== undefined) dbPatch.min_cancel_hours = patch.min_cancel_hours;
  if (patch.min_reschedule_hours !== undefined) dbPatch.min_reschedule_hours = patch.min_reschedule_hours;
  if (patch.buffer_minutes !== undefined) dbPatch.buffer_minutes = patch.buffer_minutes;
  if (patch.min_notice_hours !== undefined) dbPatch.min_notice_hours = patch.min_notice_hours;
  if (patch.booking_horizon_days !== undefined) dbPatch.max_booking_days = patch.booking_horizon_days;
  if (patch.default_commission !== undefined) dbPatch.default_commission = patch.default_commission;
  if (patch.tax_rate !== undefined) dbPatch.tax_rate = patch.tax_rate;
  if (patch.reminder_hours !== undefined) dbPatch.reminder_hours = patch.reminder_hours;
  const { error } = await sb.from("settings").update(dbPatch).eq("id", 1);
  if (error) throw new QueryError(mapError(error.message));
  await rpc("log_activity", { p_action: "settings.updated", p_entity_type: "settings", p_entity_id: "1", p_metadata: Object.keys(dbPatch).join(", ") }).catch(() => undefined);
  emit();
}

export async function listNotifications(session: Session | null) {
  const s = requireSession(session);
  const isStaff = ["admin", "super_admin"].includes(s.user.role);
  const rows = await selectAll<{ id: string; recipient_id: string | null; recipient_email: string; appointment_id: string | null; type: string; subject: string; body: string; sent_at: string; status: string }>(
    "notifications",
    (q) => { if (!isStaff) q = q.eq("recipient_id", s.user_id); return q.order("sent_at", { ascending: false }).limit(30); },
  );
  return rows;
}

export async function listActivity(
  session: Session | null,
  filter: { role?: string; action?: string; entity?: string; search?: string; page?: number; perPage?: number } = {},
): Promise<{ rows: { id: string; actor_id: string | null; actor_name: string; actor_role: string; action: string; entity_type: string; entity_id: string; metadata: string; created_at: string }[]; total: number }> {
  requireAdmin(session);
  let rows = await selectAll<{ id: string; actor_id: string | null; actor_name: string; actor_role: string; action: string; entity_type: string; entity_id: string; metadata: string; created_at: string }>(
    "activity_log", (q) => q.order("created_at", { ascending: false }).limit(600));
  if (filter.role && filter.role !== "all") rows = rows.filter((a) => a.actor_role === filter.role);
  if (filter.action && filter.action !== "all") rows = rows.filter((a) => a.action === filter.action);
  if (filter.entity && filter.entity !== "all") rows = rows.filter((a) => a.entity_type === filter.entity);
  if (filter.search) {
    const s = filter.search.toLowerCase();
    rows = rows.filter((a) => a.actor_name.toLowerCase().includes(s) || a.metadata.toLowerCase().includes(s));
  }
  const total = rows.length;
  const page = filter.page ?? 1;
  const perPage = filter.perPage ?? 20;
  return { rows: rows.slice((page - 1) * perPage, page * perPage), total };
}

/**
 * Reminder generation is SERVER-ONLY. The `reminder_sweep` RPC has its
 * EXECUTE grant revoked from anon/authenticated/public (migration
 * 20260215000009) and is intended to run via pg_cron:
 *
 *   select cron.schedule('statlab-reminder-sweep', '*\/15 * * * *',
 *     $$ select public.reminder_sweep(); $$);
 *
 * The frontend only manages reminder *configuration* (settings.reminder_hours,
 * see AdminSettings); booking/mutation flows write their own notification rows.
 */

export async function giveConsent(session: Session | null, type: "privacy" | "terms" | "data_processing" | "confidentiality"): Promise<void> {
  const s = requireSession(session);
  const existing = await selectAll<{ id: string }>("consents", (q) => q.select("id").eq("user_id", s.user_id).eq("consent_type", type));
  if (existing.length) return;
  const { error } = await sb.from("consents").insert({ user_id: s.user_id, consent_type: type, consent_version: "1.2" });
  if (error) throw new QueryError(mapError(error.message));
  emit();
}

export async function myConsents(session: Session | null) {
  const s = requireSession(session);
  return selectAll<{ id: string; user_id: string; consent_type: string; consent_version: string; accepted_at: string }>(
    "consents", (q) => q.eq("user_id", s.user_id));
}

// ═════════════════════════════════════════════════════════════════════════════
// ANALYTICS (computed in-database from source records — never duplicated)
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
  const res = await rpc<AnalyticsData>("admin_analytics", { p_from: fromISO, p_to: toISO });
  const kpi = res.kpi;
  return {
    ...res,
    kpi: {
      ...kpi,
      revenue: Number(kpi.revenue) || 0, pendingRevenue: Number(kpi.pendingRevenue) || 0,
      platformRevenue: Number(kpi.platformRevenue) || 0, consultantEarnings: Number(kpi.consultantEarnings) || 0,
      avgBookingValue: Number(kpi.avgBookingValue) || 0,
      cancelRate: Number(kpi.cancelRate) || 0, noShowRate: Number(kpi.noShowRate) || 0,
    },
    series: (res.series ?? []).map((s) => ({ day: s.day.slice(5), bookings: s.bookings, revenue: Number(s.revenue) || 0 })),
    byService: (res.byService ?? []).map((s) => ({ ...s, revenue: Number(s.revenue) || 0 })),
    byConsultant: (res.byConsultant ?? []).map((c) => ({ ...c, revenue: Number(c.revenue) || 0, rating: Number(c.rating) || 0, completionRate: Number(c.completionRate) || 0 })),
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// CONSULTANT PORTAL HELPERS
// ═════════════════════════════════════════════════════════════════════════════

export async function myConsultantId(session: Session | null): Promise<string> {
  const s = requireSession(session);
  const rows = await selectAll<{ id: string }>("consultants", (q) => q.select("id").eq("user_id", s.user_id));
  return rows[0]?.id ?? "";
}

export async function getMyAvailability(session: Session | null): Promise<{
  id: string;
  windows: { day: number; start: string; end: string }[];
  blocks: { id: string; consultant_id: string; date: string; end_date: string | null; start_time: string | null; end_time: string | null; reason: string; type: string }[];
  google: boolean;
} | null> {
  const s = requireSession(session);
  const cons = await selectAll<{ id: string; google_calendar_connected: boolean }>("consultants", (q) => q.select("id, google_calendar_connected").eq("user_id", s.user_id));
  if (!cons.length) return null;
  const cid = cons[0].id;
  const [wRows, bRows] = await Promise.all([
    selectAll<{ day_of_week: number; start_time: string; end_time: string }>("weekly_availability", (q) => q.eq("consultant_id", cid).eq("is_available", true).order("day_of_week").order("start_time")),
    selectAll<{ id: string; block_date: string; end_date: string | null; start_time: string | null; end_time: string | null; reason: string; block_type: string }>("blocked_periods", (q) => q.eq("consultant_id", cid).order("block_date")),
  ]);
  return {
    id: cid,
    windows: wRows.map((w) => ({ day: w.day_of_week, start: hhmm(w.start_time), end: hhmm(w.end_time) })),
    blocks: bRows.map((b) => ({
      id: b.id, consultant_id: cid, date: String(b.block_date).slice(0, 10),
      end_date: b.end_date ? String(b.end_date).slice(0, 10) : null,
      start_time: b.start_time ? hhmm(b.start_time) : null,
      end_time: b.end_time ? hhmm(b.end_time) : null,
      reason: b.reason, type: b.block_type,
    })),
    google: Boolean(cons[0].google_calendar_connected),
  };
}

export interface ConsultantDash {
  consultant: {
    id: string; slug: string; display_name: string; professional_title: string;
    rating: number; review_count: number; google_calendar_connected: boolean; commission_percentage: number;
  };
  kpi: {
    today: number; week: number; activeProjects: number; activeClients: number;
    monthEarnings: number; totalEarnings: number; pendingPayout: number; rating: number; reviewCount: number;
  };
  upcoming: AppointmentRow[];
  recentActivity: { id: string; action: string; metadata: string; created_at: string }[];
}

export async function consultantDashboard(session: Session | null): Promise<ConsultantDash> {
  requireSession(session);
  const res = await rpc<ConsultantDash>("consultant_overview");
  const k = res.kpi ?? ({} as ConsultantDash["kpi"]);
  return {
    consultant: res.consultant,
    kpi: {
      today: Number(k.today) || 0, week: Number(k.week) || 0,
      activeProjects: Number(k.activeProjects) || 0, activeClients: Number(k.activeClients) || 0,
      monthEarnings: Number(k.monthEarnings) || 0, totalEarnings: Number(k.totalEarnings) || 0,
      pendingPayout: Number(k.pendingPayout) || 0, rating: Number(k.rating) || 0,
      reviewCount: Number(k.reviewCount) || 0,
    },
    upcoming: await hydrateAppointments(((res.upcoming ?? []) as unknown as ApptRow[]).map((a) => ({ ...a, start_time: hhmm(a.start_time) }))),
    recentActivity: res.recentActivity ?? [],
  };
}

export async function consultantClients(session: Session | null) {
  requireSession(session);
  const rows = await rpc<(Record<string, unknown> & { next: ApptRow | null; last: string | null })[]>("consultant_clients");
  const list = rows ?? [];
  const upcoming = list.map((r) => r.next).filter(Boolean) as ApptRow[];
  const hydrated = await hydrateAppointments(upcoming);
  return list.map((r) => ({
    id: String(r.id), full_name: String(r.full_name), email: String(r.email), phone: String(r.phone ?? ""),
    total: Number(r.total) || 0, completed: Number(r.completed) || 0,
    next: r.next ? (hydrated.find((h) => h.id === (r.next as ApptRow).id) ?? null) : null,
    last: r.last ? String(r.last).slice(0, 10) : null,
  }));
}

export async function consultantAnalyses(session: Session | null) {
  requireSession(session);
  return rpc<(TaskRow & { project_title: string })[]>("consultant_analyses");
}
