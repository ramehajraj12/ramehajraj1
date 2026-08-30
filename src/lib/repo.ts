import { sb, mapError } from "./supabase";
import type {
  User, Role, Lang, Appointment, AppointmentRow, AppointmentHistoryEntry, Session,
} from "../types";
import { timeToMin, minToTime } from "./utils";

/**
 * Repository layer — the ONLY module that talks to Supabase tables/RPCs.
 * Authorization is enforced by PostgreSQL Row Level Security; the checks in
 * services.ts are UX conveniences, never the security boundary.
 */

// ── change emitter (views refetch after any mutation) ────────────────────────
const listeners = new Set<() => void>();
export function onChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
export function emit(): void {
  listeners.forEach((cb) => cb());
}

// ── query helpers ────────────────────────────────────────────────────────────
export class QueryError extends Error {}

export async function rpc<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await sb.rpc(name, args);
  if (error) throw new QueryError(mapError(error.message));
  return data as T;
}

/**
 * select * with an optional filter callback applied to the query builder.
 * RLS on the table is the actual authorization layer — results are already
 * scoped to the caller before they reach this function.
 */
export async function selectAll<T = Record<string, unknown>>(
  table: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apply?: (q: any) => unknown,
): Promise<T[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = sb.from(table as never).select("*");
  if (apply) apply(q);
  const res = await q;
  if (res.error) throw new QueryError(mapError(res.error.message));
  return (res.data ?? []) as T[];
}

// ── row shapes (as returned by PostgREST) ────────────────────────────────────
export interface ProfileRow {
  id: string; user_id: string | null; email: string; full_name: string; phone: string;
  role: Role; preferred_language: Lang; status: "active" | "deactivated";
  created_at: string; updated_at: string;
}

export interface ApptRow {
  id: string; reference: string; manage_token: string;
  client_id: string | null; client_name: string; client_email: string; client_phone: string;
  consultant_id: string; consultant_name: string; service_id: string; service_name: string;
  project_id: string | null; date: string; start_time: string; duration_minutes: number;
  price: number; currency: string; status: Appointment["status"]; language: string;
  university: string; study_level: Appointment["study_level"]; research_topic: string;
  problem_description: string; spss_experience: Appointment["spss_experience"];
  required_analysis: string; intake: Record<string, string>;
  payment_status: Appointment["payment_status"]; payment_policy: Appointment["payment_policy"];
  meeting_provider: Appointment["meeting_provider"]; meeting_url: string | null;
  external_event_id: string | null; internal_notes: string;
  completion: Appointment["completion"]; rescheduled_from: string | null; created_at: string;
}

export interface HistoryRow {
  appointment_id: string; old_date: string; old_start: string; new_date: string;
  new_start: string; changed_by: string; changed_by_role: string; changed_at: string;
}

// ── mappers ──────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ["#1b44cc", "#0e8f96", "#96690a", "#177a48", "#7a3fb8", "#bc4242"];

export function hhmm(t: string | null | undefined): string {
  return t ? String(t).slice(0, 5) : "";
}

export function endOf(startHHMM: string, durationMin: number): string {
  return minToTime(timeToMin(startHHMM) + durationMin);
}

export function mapUser(p: ProfileRow): User {
  let h = 0;
  for (let i = 0; i < p.id.length; i++) h = (h * 31 + p.id.charCodeAt(i)) | 0;
  return {
    id: p.id,
    email: p.email,
    full_name: p.full_name || p.email.split("@")[0],
    phone: p.phone ?? "",
    avatar_color: AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length],
    role: p.role,
    preferred_language: p.preferred_language ?? "sq",
    status: p.status ?? "active",
    created_at: p.created_at,
    updated_at: p.updated_at,
  };
}

export function toApptRow(r: ApptRow, consultantSlug: string, history: AppointmentHistoryEntry[] = []): AppointmentRow {
  const start = hhmm(r.start_time);
  return {
    ...r,
    client_id: r.client_id ?? "",
    start_time: start,
    end_time: endOf(start, r.duration_minutes),
    date: String(r.date).slice(0, 10),
    price: Number(r.price),
    consultant_slug: consultantSlug,
    history,
  } as AppointmentRow;
}

export async function slugMapFor(consultantIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(consultantIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (!ids.length) return map;
  const { data } = await sb.from("consultants").select("id, slug").in("id", ids);
  (data ?? []).forEach((c) => map.set(c.id as string, c.slug as string));
  return map;
}

export async function historyFor(appointmentIds: string[]): Promise<Map<string, AppointmentHistoryEntry[]>> {
  const ids = [...new Set(appointmentIds.filter(Boolean))];
  const map = new Map<string, AppointmentHistoryEntry[]>();
  if (!ids.length) return map;
  const { data } = await sb.from("appointment_history").select("*").in("appointment_id", ids).order("changed_at");
  for (const h of (data ?? []) as unknown as HistoryRow[]) {
    const list = map.get(h.appointment_id) ?? [];
    list.push({
      old_date: String(h.old_date).slice(0, 10), old_start: hhmm(h.old_start),
      new_date: String(h.new_date).slice(0, 10), new_start: hhmm(h.new_start),
      changed_by: h.changed_by, changed_by_role: h.changed_by_role, changed_at: h.changed_at,
    });
    map.set(h.appointment_id, list);
  }
  return map;
}

export async function hydrateAppointments(rows: ApptRow[]): Promise<AppointmentRow[]> {
  const [slugs, hist] = await Promise.all([slugMapFor(rows.map((r) => r.consultant_id)), historyFor(rows.map((r) => r.id))]);
  return rows.map((r) => toApptRow(r, slugs.get(r.consultant_id) ?? "", hist.get(r.id) ?? []));
}

export async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const { data } = await sb.from("profiles").select("*").eq("id", userId).maybeSingle();
  return (data as ProfileRow | null) ?? null;
}

export function requireSession(s: Session | null): Session {
  if (!s) throw new QueryError("Kërkohet kyçja.");
  return s;
}
export function requireStaff(s: Session | null): Session {
  const sess = requireSession(s);
  if (!["admin", "super_admin"].includes(sess.user.role) && sess.user.role !== "consultant")
    throw new QueryError("Pa të drejta për këtë veprim.");
  return sess;
}
export function requireAdmin(s: Session | null): Session {
  const sess = requireSession(s);
  if (!["admin", "super_admin"].includes(sess.user.role)) throw new QueryError("Pa të drejta për këtë veprim.");
  return sess;
}
