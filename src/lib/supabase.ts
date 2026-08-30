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

// ── password-recovery link detection ────────────────────────────────────────
// GoTrue redirects recovery links back to the app (implicit flow appends
// `#…&type=recovery`, PKCE exchanges a `?code=…`). A sessionStorage marker is
// set exactly once per recovery link so the router can send the user to
// /reset-password; it is cleared when the new password is saved.
export const RECOVERY_MARKER = "statlab_recovery";
if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) {
  sessionStorage.setItem(RECOVERY_MARKER, "1");
}
sb.auth.onAuthStateChange((event) => {
  if (event === "PASSWORD_RECOVERY") sessionStorage.setItem(RECOVERY_MARKER, "1");
});

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
  if (m.includes("at least") || m.includes("too weak") || m.includes("weak password") || m.includes("password should"))
    return "Fjalëkalimi është shumë i dobët — duhet të ketë të paktën 8 karaktere.";
  if (m.includes("recovery") || m.includes("expired") || m.includes("invalid token"))
    return "Linku i rikuperimit është i pavlefshëm ose ka skaduar. Kërkoni një link të ri.";
  if (m.includes("email not confirmed") || m.includes("email is invalid")) return "Email-i nuk është i vlefshëm.";
  // double-booking rejected by the engine or by the exclusion constraint
  if (m.includes("exclusion") || m.includes("appointments_no_overlap") || m.includes("sapo u plotësua") || m.includes("nuk është më i disponueshëm"))
    return "Ky termin sapo u rezervua nga një përdorues tjetër. Ju lutem zgjidhni një orar tjetër.";
  // password reset / recovery
  if (m.includes("password should be at least") || m.includes("short password") || m.includes("weak password"))
    return "Fjalëkalimi është shumë i dobët — duhen të paktën 8 karaktere.";
  if (m.includes("same as the current password") || m.includes("same password"))
    return "Fjalëkalimi i ri duhet të jetë i ndryshëm nga ai aktual.";
  if (m.includes("invalid token") || m.includes("token has expired") || m.includes("expired token") || m.includes("invalid recovery"))
    return "Linku i rikuperimit është i pavlefshëm ose ka skaduar. Kërkoni një të ri.";
  return message;
}
