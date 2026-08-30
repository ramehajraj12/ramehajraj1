import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client — frontend-only configuration.
 * Security is enforced by Supabase Auth + PostgreSQL Row Level Security,
 * never by client-side checks. The service-role key is NEVER used here.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const SUPABASE_CONFIGURED = Boolean(url && anonKey);

export const sb = createClient(
  url ?? "https://placeholder.supabase.co",
  anonKey ?? "placeholder-anon-key",
  { auth: { persistSession: true, autoRefreshToken: true } },
);

/** Translate common PostgREST/GoTrue errors into clear Albanian messages. */
export function mapError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email ose fjalëkalim i pasaktë.";
  if (m.includes("already registered") || m.includes("already been registered")) return "Ekziston një llogari me këtë email. Kyçuni.";
  if (m.includes("rate limit")) return "Shumë kërkesa — provoni për pak sekonda.";
  if (m.includes("jwt") || m.includes("token")) return "Sesioni ka skaduar. Kyçuni përsëri.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Nuk u arrit lidhja me serverin. Kontrolloni rrjetin dhe provoni përsëri.";
  if (m.includes("duplicate key")) return "Ky rekord ekziston tashmë.";
  if (m.includes("violates row-level security") || m.includes("row-level security")) return "Nuk keni të drejta për këtë veprim.";
  if (m.includes("exclusion") || m.includes("appointments_no_overlap")) return "Ky orar sapo u plotësua nga një rezervim tjetër. Zgjidhni një orar tjetër.";
  if (m.includes("slot")) return message;
  return message;
}
