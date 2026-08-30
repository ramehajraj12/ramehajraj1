import type { DB } from "../types";
import { timeToMin, minToTime, nowMinutes, todayISO, addDaysISO, isoDow, parseISO, overlaps, avg } from "./utils";

export interface Interval { start: number; end: number; }

function subtractInterval(wins: Interval[], bs: number, be: number): Interval[] {
  const out: Interval[] = [];
  for (const w of wins) {
    if (be <= w.start || bs >= w.end) { out.push(w); continue; }
    if (bs > w.start) out.push({ start: w.start, end: bs });
    if (be < w.end) out.push({ start: be, end: w.end });
  }
  return out;
}

function dateInRange(dateISO: string, from: string, to: string | null): boolean {
  return dateISO >= from && (!to || dateISO <= to);
}

/** Effective working windows for a consultant on a date (availability − blocks). */
export function dayWindows(db: DB, consultantId: string, dateISO: string): Interval[] {
  const dow = isoDow(dateISO);
  let wins: Interval[] = db.availability
    .filter((a) => a.consultant_id === consultantId && a.day_of_week === dow && a.is_available)
    .map((a) => ({ start: timeToMin(a.start_time), end: timeToMin(a.end_time) }))
    .sort((a, b) => a.start - b.start);
  for (const b of db.blocks) {
    if (b.consultant_id !== consultantId) continue;
    if (!dateInRange(dateISO, b.date, b.end_date)) continue;
    const bs = b.start_time ? timeToMin(b.start_time) : 0;
    const be = b.end_time ? timeToMin(b.end_time) : 1440;
    wins = subtractInterval(wins, bs, be);
  }
  // Google Calendar busy events are modeled as "meeting" blocks when connected.
  return wins;
}

/** Busy intervals from existing appointments (± buffer). */
export function busyIntervals(db: DB, consultantId: string, dateISO: string, withBuffer = true): Interval[] {
  const buffer = withBuffer ? db.settings.buffer_minutes : 0;
  return db.appointments
    .filter((a) => a.consultant_id === consultantId && a.date === dateISO &&
      a.status !== "cancelled" && a.status !== "rescheduled" && a.status !== "no_show")
    .map((a) => ({ start: timeToMin(a.start_time) - buffer, end: timeToMin(a.end_time) + buffer }));
}

/**
 * Core double-booking predicate — strict overlap on the same date.
 * This is re-checked inside the booking transaction, never trusted from the UI.
 */
export function hasOverlap(db: DB, consultantId: string, dateISO: string, startMin: number, endMin: number, excludeAppointmentId?: string): boolean {
  return db.appointments.some((a) =>
    a.consultant_id === consultantId && a.date === dateISO && a.id !== excludeAppointmentId &&
    (a.status === "pending" || a.status === "confirmed") &&
    overlaps(startMin, endMin, timeToMin(a.start_time), timeToMin(a.end_time)),
  );
}

/** Generate bookable start times for a duration, honoring every constraint. */
export function computeSlots(db: DB, consultantId: string, dateISO: string, durationMin: number): string[] {
  const s = db.settings;
  const today = todayISO();
  if (dateISO < today) return [];
  if (dateISO > addDaysISO(today, s.booking_horizon_days)) return [];
  const wins = dayWindows(db, consultantId, dateISO);
  if (wins.length === 0) return [];
  const busy = busyIntervals(db, consultantId, dateISO);
  const minStart = dateISO === today ? nowMinutes() + s.min_notice_hours * 60 : 0;
  const slots: string[] = [];
  for (const w of wins) {
    let t = Math.ceil(w.start / 30) * 30;
    while (t + durationMin <= w.end) {
      if (t >= minStart) {
        const end = t + durationMin;
        const clash = busy.some((b) => overlaps(t, end, b.start, b.end));
        if (!clash) slots.push(minToTime(t));
      }
      t += 30;
    }
  }
  return slots;
}

export type DayCapacity = "none" | "limited" | "open" | "past" | "blocked";

/** Slot-count map for a whole month (used by the booking calendar). */
export function monthCapacity(db: DB, consultantId: string, year: number, month: number, durationMin: number): Map<string, DayCapacity> {
  const map = new Map<string, DayCapacity>();
  const today = todayISO();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (iso < today) { map.set(iso, "past"); continue; }
    const wins = dayWindows(db, consultantId, iso);
    if (wins.length === 0) { map.set(iso, "blocked"); continue; }
    const n = computeSlots(db, consultantId, iso, durationMin).length;
    map.set(iso, n === 0 ? "none" : n <= 3 ? "limited" : "open");
  }
  return map;
}

/** First available slot scanning forward (directory cards / "next availability"). */
export function nextAvailable(db: DB, consultantId: string, durationMin: number): { date: string; time: string } | null {
  const today = todayISO();
  for (let i = 0; i < Math.min(db.settings.booking_horizon_days, 45); i++) {
    const date = addDaysISO(today, i);
    const slots = computeSlots(db, consultantId, date, durationMin);
    if (slots.length > 0) return { date, time: slots[0] };
  }
  return null;
}

export function nextAvailableForService(db: DB, consultantId: string, serviceId: string): { date: string; time: string } | null {
  const cs = db.consultant_services.find((x) => x.consultant_id === consultantId && x.service_id === serviceId && x.is_active);
  return nextAvailable(db, consultantId, cs?.duration_minutes ?? 60);
}

/**
 * Smart consultant matching — deterministic scoring, never random:
 * service fit (offers it), specialization overlap with the service category,
 * language match, rating, review volume, current workload, featured status.
 */
export function autoMatch(db: DB, serviceId: string, language?: string, clientPreference?: string): { consultantId: string; score: number; reasons: string[] } | null {
  const service = db.services.find((s) => s.id === serviceId);
  if (!service) return null;
  const weekAgo = addDaysISO(todayISO(), -7);
  const today = todayISO();
  let best: { consultantId: string; score: number; reasons: string[] } | null = null;

  for (const c of db.consultants) {
    if (!c.is_active || c.status !== "active") continue;
    const offer = db.consultant_services.find((x) => x.consultant_id === c.id && x.service_id === serviceId && x.is_active);
    if (!offer) continue;
    let score = 0;
    const reasons: string[] = [];

    score += 20; reasons.push("Oferton shërbimin");
    const specOverlap = c.specializations.filter((sp) => serviceCategoryMatches(service.category, sp)).length;
    if (specOverlap > 0) { score += specOverlap * 12; reasons.push("Specializim i përputhur"); }
    if (language && c.languages.includes(language)) { score += 15; reasons.push(`Flamuri gjuhësor (${language.toUpperCase()})`); }
    if (c.rating > 0) { score += c.rating * 6; reasons.push(`Vlerësimi ${c.rating.toFixed(1)}★`); }
    score += Math.min(c.review_count / 10, 8);

    const weekLoad = db.appointments.filter((a) => a.consultant_id === c.id && a.date >= weekAgo && a.date <= today && a.status !== "cancelled").length;
    score -= weekLoad * 4;
    const next = db.appointments.filter((a) => a.consultant_id === c.id && a.date >= today && (a.status === "confirmed" || a.status === "pending")).length;
    score -= next * 2;
    if (weekLoad <= 2) reasons.push("Ngarkesë e ulët këtë javë");

    if (clientPreference === c.id) { score += 25; reasons.push("Preferenca e klientit"); }
    if (c.is_featured) score += 4;

    const soon = nextAvailable(db, c.id, offer.duration_minutes);
    if (!soon) continue;
    const days = Math.round((parseISO(soon.date).getTime() - parseISO(today).getTime()) / 86400000);
    score -= days * 1.5;
    if (days <= 1) reasons.push("Termin brenda 24 orëve");

    if (!best || score > best.score) best = { consultantId: c.id, score: Math.round(score), reasons };
  }
  return best;
}

function serviceCategoryMatches(category: string, spec: string): boolean {
  const map: Record<string, string[]> = {
    consultation: ["spss", "descriptive", "interpretation"],
    analysis: ["regression", "factor", "logistic", "anova", "correlation", "ttest", "nonparametric", "reliability", "descriptive"],
    methodology: ["methodology", "survey", "questionnaire"],
    thesis: ["bachelor", "master", "phd", "apa", "methodology"],
    survey: ["questionnaire", "survey", "reliability"],
    custom: [],
  };
  return (map[category] ?? []).includes(spec);
}

/** Earliest slot across all consultants offering a service ("first available"). */
export function firstAvailableOffering(db: DB, serviceId: string, durationMin: number): { consultantId: string; date: string; time: string } | null {
  let best: { consultantId: string; date: string; time: string } | null = null;
  for (const c of db.consultants) {
    if (!c.is_active || c.status !== "active") continue;
    const offers = db.consultant_services.some((x) => x.consultant_id === c.id && x.service_id === serviceId && x.is_active);
    if (!offers) continue;
    const next = nextAvailable(db, c.id, durationMin);
    if (!next) continue;
    const cand = { consultantId: c.id, ...next };
    if (!best || cand.date < best.date || (cand.date === best.date && cand.time < best.time)) best = cand;
  }
  return best;
}

export function avgRating(db: DB, consultantId: string): { rating: number; count: number } {
  const rs = db.reviews.filter((r) => r.consultant_id === consultantId && r.status === "published");
  return { rating: rs.length ? +avg(rs.map((r) => r.rating)).toFixed(1) : 0, count: rs.length };
}
