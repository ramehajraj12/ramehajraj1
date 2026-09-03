import { createClient } from "@supabase/supabase-js";

/**
 * Frontend-only Supabase configuration.
 * Security lives in Supabase Auth + PostgreSQL RLS + Storage policies —
 * never in this file. Only VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are used.
 * The service-role key is NEVER used here.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const SUPABASE_CONFIGURED = Boolean(url && anonKey);

export const sb = createClient(
  url ?? "https://placeholder.supabase.co",
  anonKey ?? "placeholder-anon-key",
  { auth: { persistSession: true, autoRefreshToken: true } },
);

/** sessionStorage key marking that the user arrived via a password-recovery link. */
export const RECOVERY_MARKER = "statlab_recovery";

/** Detect a recovery link (implicit-flow hash) and mark the session. */
export function captureRecoveryMarker(): void {
  try {
    const h = window.location.hash || "";
    if (h.includes("type=recovery") && h.includes("access_token")) {
      sessionStorage.setItem(RECOVERY_MARKER, "1");
    }
  } catch { /* storage unavailable — non-fatal */ }
}

// ── avatar storage ────────────────────────────────────────────────────────────
export const AVATAR_BUCKET = "avatars";
export const AVATAR_EXTS = ["jpg", "jpeg", "png", "webp"] as const;
export const AVATAR_MAX_MB = 5;

/** Translate common PostgREST/GoTrue errors into clear Albanian messages. */
export function mapError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email ose fjalëkalim i pasaktë.";
  if (m.includes("already registered") || m.includes("already been registered")) return "Ekziston një llogari me këtë email. Kyçuni.";
  if (m.includes("email not confirmed")) return "Llogaria u krijua — verifikoni email-in para se të kyçeni.";
  if (m.includes("rate limit")) return "Shumë kërkesa — provoni për pak sekonda.";
  if (m.includes("jwt") || m.includes("token")) return "Sesioni ka skaduar. Kyçuni përsëri.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Nuk u arrit lidhja me serverin. Kontrolloni rrjetin dhe provoni përsëri.";
  if (m.includes("duplicate key")) return "Ky rekord ekziston tashmë.";
  if (m.includes("violates row-level security") || m.includes("row-level security")) return "Nuk keni të drejta për këtë veprim.";
  if (m.includes("password") && (m.includes("weak") || m.includes("short"))) return "Fjalëkalimi është shumë i dobët.";
  // double-booking rejected by the engine or by the exclusion constraint
  if (m.includes("exclusion") || m.includes("appointments_no_overlap") || m.includes("sapo u plotësua") || m.includes("nuk është më i disponueshëm"))
    return "Ky termin sapo u rezervua nga një përdorues tjetër. Ju lutem zgjidhni një orar tjetër.";
  return message;
}
