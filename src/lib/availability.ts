/**
 * Availability types shared with the calendar UI.
 *
 * All availability computation now happens SERVER-SIDE in PostgreSQL
 * (functions: slot_free, day_slots, consultant_month_capacity), which reads
 * weekly_availability, blocked_periods and appointments under RLS — and the
 * booking engine re-validates inside a serialized transaction guarded by the
 * appointments_no_overlap exclusion constraint. The client never decides
 * whether a slot is bookable.
 */

export type DayCapacity = "none" | "limited" | "open" | "past" | "blocked";

export interface Interval { start: number; end: number; }

/** Subtract [bs, be) from a list of intervals. */
export function subtractInterval(wins: Interval[], bs: number, be: number): Interval[] {
  const out: Interval[] = [];
  for (const w of wins) {
    if (be <= w.start || bs >= w.end) { out.push(w); continue; }
    if (bs > w.start) out.push({ start: w.start, end: bs });
    if (be < w.end) out.push({ start: be, end: w.end });
  }
  return out;
}

/** Effective working windows for a date from raw weekly windows + blocks (presentation helper). */
export function effectiveWindows(
  windows: { day_of_week: number; start_minutes: number; end_minutes: number }[],
  blocks: { date: string; end_date: string | null; start_minutes: number | null; end_minutes: number | null }[],
  dateISO: string,
  isoDowOf: (iso: string) => number,
  inRange: (iso: string, from: string, to: string | null) => boolean,
): Interval[] {
  let wins: Interval[] = windows
    .filter((w) => w.day_of_week === isoDowOf(dateISO))
    .map((w) => ({ start: w.start_minutes, end: w.end_minutes }))
    .sort((a, b) => a.start - b.start);
  for (const b of blocks) {
    if (!inRange(dateISO, b.date, b.end_date)) continue;
    wins = subtractInterval(wins, b.start_minutes ?? 0, b.end_minutes ?? 1440);
  }
  return wins;
}
