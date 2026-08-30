import { sb, SUPABASE_CONFIGURED, AVATAR_BUCKET, AVATAR_EXTS, AVATAR_MAX_MB, mapError } from "./supabase";

export type Role = "client" | "consultant" | "admin" | "super_admin";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  avatar_url: string | null;
  role: Role;
  preferred_language: "sq" | "en";
  status: "active" | "deactivated";
  created_at: string;
}

export type PersonalPatch = Partial<Pick<Profile, "full_name" | "phone" | "preferred_language">>;

export type AccountErrorCode =
  | "ERR_INVALID_CREDENTIALS" | "ERR_EXISTS" | "ERR_CONFIRM_EMAIL" | "ERR_RATE"
  | "ERR_NO_PERM" | "ERR_NETWORK" | "ERR_BUCKET" | "ERR_WRONG_CURRENT"
  | "ERR_PW_WEAK" | "ERR_FILE_TYPE" | "ERR_FILE_SIZE" | "ERR_STORAGE" | "ERR_GENERIC";

export class AccountError extends Error {
  code: AccountErrorCode;
  constructor(code: AccountErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

export interface AccountStore {
  mode: "supabase" | "demo";
  getSession(): Promise<Profile | null>;
  onAuthChange(cb: (p: Profile | null) => void): () => void;
  signIn(email: string, password: string): Promise<Profile>;
  signUp(email: string, password: string, fullName: string): Promise<{ profile: Profile | null; needsConfirmation: boolean }>;
  signOut(): Promise<void>;
  updatePersonal(patch: PersonalPatch): Promise<Profile>;
  uploadAvatar(file: File): Promise<Profile>;
  removeAvatar(): Promise<Profile>;
  changePassword(current: string, next: string): Promise<void>;
  getPlatformSettings(): Promise<Record<string, number> | null>;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function validateAvatar(file: File): string {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!(AVATAR_EXTS as readonly string[]).includes(ext) && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new AccountError("ERR_FILE_TYPE");
  }
  if (file.size > AVATAR_MAX_MB * 1024 * 1024) throw new AccountError("ERR_FILE_SIZE");
  return ["image/jpeg", "image/jpeg", "image/png", "image/webp"].includes(file.type)
    ? ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as Record<string, string>)[file.type]
    : ext;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REAL SUPABASE — auth + profiles + Storage "avatars" bucket
// Ownership is enforced by RLS / Storage policies (auth.uid()); the client only
// ever touches its own row via .eq("id", uid).
// ═══════════════════════════════════════════════════════════════════════════════

class SupabaseAccount implements AccountStore {
  mode = "supabase" as const;
  private client = sb!;

  private async authUser(): Promise<{ id: string; email: string } | null> {
    const { data } = await this.client.auth.getSession();
    const u = data.session?.user;
    return u ? { id: u.id, email: u.email ?? "" } : null;
  }

  private mapRow(r: Record<string, unknown>, fallbackEmail = ""): Profile {
    return {
      id: String(r.id ?? ""),
      email: String(r.email ?? fallbackEmail),
      full_name: String(r.full_name ?? ""),
      phone: String(r.phone ?? ""),
      avatar_url: (r.avatar_url as string | null) ?? null,
      role: (["client", "consultant", "admin", "super_admin"].includes(String(r.role)) ? r.role : "client") as Role,
      preferred_language: String(r.preferred_language) === "en" ? "en" : "sq",
      status: String(r.status) === "deactivated" ? "deactivated" : "active",
      created_at: String(r.created_at ?? new Date().toISOString()),
    };
  }

  private async ensureProfile(uid: string, email: string, fullName: string): Promise<Profile> {
    const { data } = await this.client.from("profiles").select("*").eq("id", uid).maybeSingle();
    if (data) return this.mapRow(data as Record<string, unknown>, email);
    // Provisioning trigger normally creates the row; this is a safe fallback.
    await this.client.from("profiles").upsert(
      { id: uid, user_id: uid, email, full_name: fullName || email.split("@")[0], role: "client", preferred_language: "sq", status: "active" },
      { onConflict: "id" },
    );
    const { data: again } = await this.client.from("profiles").select("*").eq("id", uid).maybeSingle();
    if (again) return this.mapRow(again as Record<string, unknown>, email);
    // Table/RLS unavailable — synthesize from the auth user so the UI still works.
    return {
      id: uid, email, full_name: fullName || email.split("@")[0], phone: "", avatar_url: null,
      role: "client", preferred_language: "sq", status: "active", created_at: new Date().toISOString(),
    };
  }

  async getSession(): Promise<Profile | null> {
    const { data } = await this.client.auth.getSession();
    const u = data.session?.user;
    if (!u) return null;
    try {
      return await this.ensureProfile(u.id, u.email ?? "", String(u.user_metadata?.full_name ?? ""));
    } catch (e) {
      console.error("profile load failed", e);
      return {
        id: u.id, email: u.email ?? "", full_name: String(u.user_metadata?.full_name ?? u.email?.split("@")[0] ?? ""),
        phone: "", avatar_url: null, role: "client", preferred_language: "sq", status: "active",
        created_at: u.created_at ?? new Date().toISOString(),
      };
    }
  }

  onAuthChange(cb: (p: Profile | null) => void): () => void {
    const { data } = this.client.auth.onAuthStateChange((event, sess) => {
      if (event === "SIGNED_OUT") { cb(null); return; }
      if (!sess?.user) { cb(null); return; }
      this.ensureProfile(sess.user.id, sess.user.email ?? "", String(sess.user.user_metadata?.full_name ?? ""))
        .then(cb)
        .catch(() => cb(null));
    });
    return () => data.subscription.unsubscribe();
  }

  async signIn(email: string, password: string): Promise<Profile> {
    const { data, error } = await this.client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new AccountError(mapError(error.message, "ERR_GENERIC") as AccountErrorCode);
    return this.ensureProfile(data.user.id, data.user.email ?? "", String(data.user.user_metadata?.full_name ?? ""));
  }

  async signUp(email: string, password: string, fullName: string): Promise<{ profile: Profile | null; needsConfirmation: boolean }> {
    const { data, error } = await this.client.auth.signUp({
      email: email.trim(), password,
      options: { data: { full_name: fullName } }, // role is NEVER sent — the DB trigger provisions 'client'
    });
    if (error) {
      const code = mapError(error.message, "ERR_GENERIC");
      throw new AccountError(code === "ERR_EXISTS" ? "ERR_EXISTS" : (code as AccountErrorCode));
    }
    const u = data.session?.user;
    if (!u) return { profile: null, needsConfirmation: true };
    const profile = await this.ensureProfile(u.id, u.email ?? "", fullName);
    if (fullName && profile.full_name !== fullName) {
      await this.client.from("profiles").update({ full_name: fullName }).eq("id", u.id);
      profile.full_name = fullName;
    }
    return { profile, needsConfirmation: false };
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
  }

  async updatePersonal(patch: PersonalPatch): Promise<Profile> {
    const uid = (await this.authUser())?.id;
    if (!uid) throw new AccountError("ERR_GENERIC");
    const clean: Record<string, unknown> = {};
    if (patch.full_name !== undefined) clean.full_name = patch.full_name;
    if (patch.phone !== undefined) clean.phone = patch.phone;
    if (patch.preferred_language !== undefined) clean.preferred_language = patch.preferred_language;
    const { error } = await this.client.from("profiles").update(clean).eq("id", uid);
    if (error) throw new AccountError(mapError(error.message, "ERR_GENERIC") as AccountErrorCode);
    const profile = await this.ensureProfile(uid, "", "");
    return { ...profile, ...patch } as Profile;
  }

  private avatarPath(uid: string, ext: string) {
    return `${uid}/profile.${ext}`;
  }

  async uploadAvatar(file: File): Promise<Profile> {
    const uid = (await this.authUser())?.id;
    if (!uid) throw new AccountError("ERR_GENERIC");
    const ext = validateAvatar(file);
    // best-effort cleanup of other extensions so one canonical object remains
    await this.client.storage.from(AVATAR_BUCKET)
      .remove(AVATAR_EXTS.filter((e) => e !== ext).map((e) => this.avatarPath(uid, e)))
      .catch(() => undefined);
    const { error: upErr } = await this.client.storage.from(AVATAR_BUCKET)
      .upload(this.avatarPath(uid, ext), file, { upsert: true, contentType: file.type });
    if (upErr) throw new AccountError(mapError(upErr.message, "ERR_STORAGE") as AccountErrorCode);
    const { data: pub } = this.client.storage.from(AVATAR_BUCKET).getPublicUrl(this.avatarPath(uid, ext));
    const url = `${pub.publicUrl}?t=${Date.now()}`;
    const { error: profErr } = await this.client.from("profiles").update({ avatar_url: url }).eq("id", uid);
    if (profErr) throw new AccountError(mapError(profErr.message, "ERR_GENERIC") as AccountErrorCode);
    const profile = await this.ensureProfile(uid, "", "");
    return { ...profile, avatar_url: url };
  }

  async removeAvatar(): Promise<Profile> {
    const uid = (await this.authUser())?.id;
    if (!uid) throw new AccountError("ERR_GENERIC");
    await this.client.storage.from(AVATAR_BUCKET)
      .remove(AVATAR_EXTS.map((e) => this.avatarPath(uid, e)))
      .catch(() => undefined);
    const { error } = await this.client.from("profiles").update({ avatar_url: null }).eq("id", uid);
    if (error) throw new AccountError(mapError(error.message, "ERR_GENERIC") as AccountErrorCode);
    const profile = await this.ensureProfile(uid, "", "");
    return { ...profile, avatar_url: null };
  }

  async changePassword(current: string, next: string): Promise<void> {
    const email = (await this.authUser())?.email;
    if (!email) throw new AccountError("ERR_GENERIC");
    // re-authenticate so the session is fresh for a sensitive update
    const { error: reAuth } = await this.client.auth.signInWithPassword({ email, password: current });
    if (reAuth) throw new AccountError("ERR_WRONG_CURRENT");
    const { error } = await this.client.auth.updateUser({ password: next });
    if (error) {
      const m = error.message.toLowerCase();
      throw new AccountError(m.includes("weak") || m.includes("short") ? "ERR_PW_WEAK" : (mapError(error.message, "ERR_GENERIC") as AccountErrorCode));
    }
  }

  async getPlatformSettings(): Promise<Record<string, number> | null> {
    try {
      const { data, error } = await this.client.from("settings").select("*").limit(1).maybeSingle();
      if (error || !data) return null;
      const r = data as Record<string, unknown>;
      return {
        min_cancel_hours: Number(r.min_cancel_hours ?? 24),
        min_reschedule_hours: Number(r.min_reschedule_hours ?? 12),
        buffer_minutes: Number(r.buffer_minutes ?? 15),
        max_booking_days: Number(r.max_booking_days ?? 60),
        tax_rate: Number(r.tax_rate ?? 18),
        default_commission: Number(r.default_commission ?? 20),
      };
    } catch {
      return null;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEMO WORKSPACE — only used when no Supabase env is configured. Clearly labelled
// in the UI; everything stays in this browser's localStorage.
// ═══════════════════════════════════════════════════════════════════════════════

interface DemoUser { id: string; email: string; pw: string; profile: Profile; }

const DEMO_USERS_KEY = "statlab_demo_users_v1";
const DEMO_SESSION_KEY = "statlab_demo_session_v1";

function seedDemoUsers(): DemoUser[] {
  const now = new Date().toISOString();
  return [
    {
      id: "demo-client-0001", email: "klient@demo.statlab", pw: "demo1234",
      profile: {
        id: "demo-client-0001", email: "klient@demo.statlab", full_name: "Arta Gashi", phone: "+383 44 000 111",
        avatar_url: null, role: "client", preferred_language: "sq", status: "active", created_at: now,
      },
    },
    {
      id: "demo-admin-0001", email: "admin@demo.statlab", pw: "demo1234",
      profile: {
        id: "demo-admin-0001", email: "admin@demo.statlab", full_name: "Driton Hoxha", phone: "",
        avatar_url: null, role: "admin", preferred_language: "en", status: "active", created_at: now,
      },
    },
  ];
}

class DemoAccount implements AccountStore {
  mode = "demo" as const;
  private listeners = new Set<(p: Profile | null) => void>();

  private readUsers(): DemoUser[] {
    try {
      const raw = localStorage.getItem(DEMO_USERS_KEY);
      if (raw) return JSON.parse(raw) as DemoUser[];
    } catch { /* fall through */ }
    const seeded = seedDemoUsers();
    this.writeUsers(seeded);
    return seeded;
  }
  private writeUsers(users: DemoUser[]) {
    localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(users));
  }
  private sessionId(): string | null {
    return localStorage.getItem(DEMO_SESSION_KEY);
  }
  private emit() {
    const p = this.currentProfile();
    this.listeners.forEach((cb) => cb(p));
  }
  private currentProfile(): Profile | null {
    const id = this.sessionId();
    if (!id) return null;
    return this.readUsers().find((u) => u.id === id)?.profile ?? null;
  }

  async getSession(): Promise<Profile | null> {
    await wait(250);
    return this.currentProfile();
  }
  onAuthChange(cb: (p: Profile | null) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
  async signIn(email: string, password: string): Promise<Profile> {
    await wait(450);
    const user = this.readUsers().find((u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.pw === password);
    if (!user) throw new AccountError("ERR_INVALID_CREDENTIALS");
    localStorage.setItem(DEMO_SESSION_KEY, user.id);
    this.emit();
    return user.profile;
  }
  async signUp(email: string, password: string, fullName: string): Promise<{ profile: Profile | null; needsConfirmation: boolean }> {
    await wait(500);
    const users = this.readUsers();
    if (users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) throw new AccountError("ERR_EXISTS");
    const id = `demo-${Date.now().toString(36)}`;
    const profile: Profile = {
      id, email: email.trim(), full_name: fullName, phone: "", avatar_url: null,
      role: "client", preferred_language: "sq", status: "active", created_at: new Date().toISOString(),
    };
    this.writeUsers([...users, { id, email: email.trim(), pw: password, profile }]);
    localStorage.setItem(DEMO_SESSION_KEY, id);
    this.emit();
    return { profile, needsConfirmation: false };
  }
  async signOut(): Promise<void> {
    localStorage.removeItem(DEMO_SESSION_KEY);
    this.emit();
  }
  private requireUser(): DemoUser {
    const id = this.sessionId();
    const user = this.readUsers().find((u) => u.id === id);
    if (!user) throw new AccountError("ERR_GENERIC");
    return user;
  }
  private persistProfile(profile: Profile): Profile {
    const users = this.readUsers().map((u) => (u.id === profile.id ? { ...u, profile } : u));
    this.writeUsers(users);
    this.emit();
    return profile;
  }
  async updatePersonal(patch: PersonalPatch): Promise<Profile> {
    await wait(400);
    const user = this.requireUser();
    return this.persistProfile({ ...user.profile, ...patch } as Profile);
  }
  async uploadAvatar(file: File): Promise<Profile> {
    validateAvatar(file);
    await wait(600);
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new AccountError("ERR_STORAGE"));
      fr.readAsDataURL(file);
    });
    if (dataUrl.length > 2_500_000) throw new AccountError("ERR_STORAGE");
    const user = this.requireUser();
    try {
      return this.persistProfile({ ...user.profile, avatar_url: dataUrl });
    } catch {
      throw new AccountError("ERR_STORAGE");
    }
  }
  async removeAvatar(): Promise<Profile> {
    await wait(350);
    const user = this.requireUser();
    return this.persistProfile({ ...user.profile, avatar_url: null });
  }
  async changePassword(current: string, next: string): Promise<void> {
    await wait(500);
    const user = this.requireUser();
    if (user.pw !== current) throw new AccountError("ERR_WRONG_CURRENT");
    if (next.length < 8) throw new AccountError("ERR_PW_WEAK");
    this.writeUsers(this.readUsers().map((u) => (u.id === user.id ? { ...u, pw: next } : u)));
  }
  async getPlatformSettings(): Promise<Record<string, number> | null> {
    await wait(200);
    return { min_cancel_hours: 24, min_reschedule_hours: 12, buffer_minutes: 15, max_booking_days: 60, tax_rate: 18, default_commission: 20 };
  }
}

export function createAccountStore(): AccountStore {
  return SUPABASE_CONFIGURED ? new SupabaseAccount() : new DemoAccount();
}
