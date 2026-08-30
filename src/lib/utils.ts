import { MONTHS_SQ } from "./i18n";

export function cls(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function uid(prefix = ""): string {
  return prefix + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

export function token(len = 24): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// ─── dates ────────────────────────────────────────────────────────────────────
export function pad(n: number): string { return n < 10 ? "0" + n : String(n); }

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function todayISO(): string { return toISO(new Date()); }
export function nowISO(): string {
  const d = new Date();
  return `${toISO(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function addDaysISO(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}
export function isoDow(iso: string): number {
  // 1 = Monday … 7 = Sunday
  const js = parseISO(iso).getDay();
  return js === 0 ? 7 : js;
}
export function daysUntil(iso: string): number {
  const a = parseISO(todayISO()).getTime();
  const b = parseISO(iso).getTime();
  return Math.round((b - a) / 86400000);
}
export function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = parseISO(iso);
  return `${d.getDate()} ${MONTHS_SQ[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}
export function fmtDateLong(iso: string): string {
  if (!iso) return "—";
  const d = parseISO(iso);
  return `${d.getDate()} ${MONTHS_SQ[d.getMonth()]} ${d.getFullYear()}`;
}
export function fmtDateTime(isoDateTime: string): string {
  if (!isoDateTime) return "—";
  const d = new Date(isoDateTime);
  if (isNaN(d.getTime())) return isoDateTime;
  return `${d.getDate()} ${MONTHS_SQ[d.getMonth()].slice(0, 3)} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function relativeTime(isoDateTime: string): string {
  const then = new Date(isoDateTime).getTime();
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "tani";
  if (min < 60) return `para ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `para ${h} orësh`;
  const d = Math.floor(h / 24);
  if (d < 30) return `para ${d} ditësh`;
  return fmtDate(isoDateTime.slice(0, 10));
}

export function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}
export function minToTime(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}
export function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}
export function overlaps(aS: number, aE: number, bS: number, bE: number): boolean {
  return aS < bE && aE > bS;
}

// month matrix: 6 weeks × 7 days (Monday first), ISO strings
export function monthMatrix(year: number, month: number): string[][] {
  const first = new Date(year, month, 1);
  let startOffset = first.getDay() - 1;
  if (startOffset < 0) startOffset = 6;
  const start = new Date(year, month, 1 - startOffset);
  const weeks: string[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: string[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(start);
      day.setDate(start.getDate() + w * 7 + d);
      row.push(toISO(day));
    }
    weeks.push(row);
  }
  return weeks;
}
export function weekDays(anchorISO: string): string[] {
  const d = parseISO(anchorISO);
  const dow = isoDow(anchorISO);
  const monday = addDaysISO(anchorISO, -(dow - 1));
  void d;
  return Array.from({ length: 7 }, (_, i) => addDaysISO(monday, i));
}

// ─── formatting ───────────────────────────────────────────────────────────────
export function fmtEuro(n: number): string {
  return "€" + n.toLocaleString("de-DE", { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });
}
export function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
export function fmtDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} orë ${m} min` : `${h} orë`;
}
export function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}
const AV_COLORS = ["#1b44cc", "#0e8f96", "#c98d08", "#7a3fb0", "#bc4242", "#177a48", "#2f57e4", "#96690a"];
export function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AV_COLORS[Math.abs(h) % AV_COLORS.length];
}
export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
export function avg(nums: number[]): number {
  const v = nums.filter((n) => !isNaN(n));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}
export function slugify(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
export function refNumber(counter: number): string {
  return `SPSS-${new Date().getFullYear()}-${String(counter).padStart(6, "0")}`;
}
export function invoiceNumber(counter: number): string {
  return `INV-${new Date().getFullYear()}-${String(counter).padStart(4, "0")}`;
}
export function hoursBetween(nowMs: number, isoDate: string, time: string): number {
  const d = parseISO(isoDate);
  const [h, m] = time.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return (d.getTime() - nowMs) / 3600000;
}
export function downloadBlob(name: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
