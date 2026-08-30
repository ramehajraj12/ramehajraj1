import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Frontend-only Supabase configuration.
 * Security lives in Supabase Auth + PostgreSQL RLS + Storage policies —
 * never in this file. Only VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are used.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const SUPABASE_CONFIGURED = Boolean(url && anonKey);

export const sb: SupabaseClient | null = SUPABASE_CONFIGURED
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;

export const AVATAR_BUCKET = "avatars";
export const AVATAR_EXTS = ["jpg", "jpeg", "png", "webp"] as const;
export const AVATAR_MAX_MB = 5;

/** Safe, user-facing mapping of auth/storage errors (no raw SQL leaks). */
export function mapError(message: string, fallback: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "ERR_INVALID_CREDENTIALS";
  if (m.includes("already registered") || m.includes("already been registered")) return "ERR_EXISTS";
  if (m.includes("email not confirmed")) return "ERR_CONFIRM_EMAIL";
  if (m.includes("rate limit")) return "ERR_RATE";
  if (m.includes("row-level security") || m.includes("violates row-level")) return "ERR_NO_PERM";
  if (m.includes("failed to fetch") || m.includes("network")) return "ERR_NETWORK";
  if (m.includes("bucket not found")) return "ERR_BUCKET";
  return fallback;
}
