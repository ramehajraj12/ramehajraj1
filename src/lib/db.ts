import type { DB, Session, User, Role, NotificationType } from "../types";
import { buildSeed } from "./seed";
import { uid, nowISO } from "./utils";

// ─── Persistence engine ──────────────────────────────────────────────────────
// Mirrors the Supabase integration: the same table shapes, row-level guards and
// "server-side" revalidation semantics (every mutation re-reads fresh state
// before writing, which is where double-booking checks run). When Supabase
// credentials are configured the service layer can be pointed at the real
// client without touching page code.

const DB_KEY = "statlab_db_v3";
const SESSION_KEY = "statlab_session_v1";

const listeners = new Set<() => void>();
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
function emit() { listeners.forEach((f) => f()); }

export function getDB(): DB {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed.version === 3) return parsed;
    }
  } catch { /* fall through to reseed */ }
  const seeded = buildSeed();
  try { localStorage.setItem(DB_KEY, JSON.stringify(seeded)); } catch { /* storage full */ }
  return seeded;
}

function save(db: DB) {
  try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch { /* ignore */ }
}

export function resetDB(): void {
  localStorage.removeItem(DB_KEY);
  getDB();
  emit();
}

const latency = () => new Promise((r) => setTimeout(r, 140 + Math.random() * 200));

/** Transactional write: fresh read → validate+mutate → save → notify. */
export async function mutate<T>(fn: (db: DB) => T): Promise<T> {
  await latency();
  const db = getDB();
  const result = fn(db);
  save(db);
  emit();
  return result;
}

/** Read-only query path. */
export async function read<T>(fn: (db: DB) => T): Promise<T> {
  await new Promise((r) => setTimeout(r, 90 + Math.random() * 160));
  return fn(getDB());
}

// ─── Session ──────────────────────────────────────────────────────────────────
export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as { user_id: string };
    const user = getDB().users.find((u) => u.id === s.user_id);
    if (!user || user.status !== "active") return null;
    return { user_id: user.id, user };
  } catch { return null; }
}

export function setSession(userId: string | null): void {
  if (userId) localStorage.setItem(SESSION_KEY, JSON.stringify({ user_id: userId }));
  else localStorage.removeItem(SESSION_KEY);
  emit();
}

// ─── Authorization guards (RLS simulation) ───────────────────────────────────
export class AccessError extends Error {
  constructor(msg = "Nuk keni autorizim për këtë veprim.") { super(msg); }
}

export function requireSession(s: Session | null): Session {
  if (!s) throw new AccessError("Kërkohet identifikimi.");
  return s;
}

export function requireRole(s: Session | null, roles: Role[]): Session {
  const sess = requireSession(s);
  if (sess.user.role === "super_admin") return sess;
  if (!roles.includes(sess.user.role)) throw new AccessError();
  return sess;
}

export function requireAdmin(s: Session | null): Session { return requireRole(s, ["admin"]); }
export function requireStaff(s: Session | null): Session { return requireRole(s, ["admin", "consultant"]); }

export function isAdmin(u: User | null | undefined): boolean {
  return !!u && (u.role === "admin" || u.role === "super_admin");
}

// ─── Shared write helpers (used inside mutate blocks) ────────────────────────
export function logActivity(
  db: DB, actorId: string | null, actorName: string, actorRole: string,
  action: string, entityType: string, entityId: string, metadata = "",
): void {
  db.activity.unshift({
    id: uid("al-"), actor_id: actorId, actor_name: actorName, actor_role: actorRole,
    action, entity_type: entityType, entity_id: entityId, metadata, created_at: nowISO(),
  });
  if (db.activity.length > 600) db.activity.length = 600;
}

export function addNotification(
  db: DB, recipientId: string | null, recipientEmail: string,
  type: NotificationType, subject: string, body: string,
  appointmentId: string | null = null, dedupe = false,
): void {
  if (dedupe) {
    const day = nowISO().slice(0, 10);
    const dup = db.notifications.find(
      (n) => n.type === type && n.recipient_id === recipientId && n.appointment_id === appointmentId && n.sent_at.slice(0, 10) === day,
    );
    if (dup) return;
  }
  db.notifications.unshift({
    id: uid("n-"), recipient_id: recipientId, recipient_email: recipientEmail,
    appointment_id: appointmentId, type, channel: "email", subject, body,
    status: "sent", sent_at: nowISO(),
  });
}

export function notifyAdmins(db: DB, type: NotificationType, subject: string, body: string, appointmentId: string | null = null): void {
  db.users.filter((u) => (u.role === "admin" || u.role === "super_admin") && u.status === "active")
    .forEach((u) => addNotification(db, u.id, u.email, type, subject, body, appointmentId));
}

// ─── Signed URL registry (private storage simulation) ────────────────────────
interface SignedToken { file_id: string; user_id: string; expires: number; }
const signedTokens = new Map<string, SignedToken>();

export function registerSignedToken(fileId: string, userId: string, minutes = 10): string {
  const tok = uid("sig-") + uid("");
  signedTokens.set(tok, { file_id: fileId, user_id: userId, expires: Date.now() + minutes * 60000 });
  return tok;
}

export function consumeSignedToken(tok: string, userId: string): string | null {
  const entry = signedTokens.get(tok);
  if (!entry) return null;
  if (entry.expires < Date.now()) { signedTokens.delete(tok); return null; }
  if (entry.user_id !== userId) return null;
  return entry.file_id;
}
