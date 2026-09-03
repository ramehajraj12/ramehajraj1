// ═══════════════════════════════════════════════════════════════════════════
// StatLab · Google Calendar + Meet integration (Deno Edge Function)
//
// Deploy:   supabase functions deploy google
// Secrets:  supabase secrets set GOOGLE_CLIENT_ID=... \
//             GOOGLE_CLIENT_SECRET=... GOOGLE_STATE_SECRET=... FRONTEND_URL=...
//
// Actions:
//   auth_url   (JWT)   → OAuth consent URL for the calling consultant
//   callback   (GET)   → Google redirect; exchanges code, stores tokens
//   disconnect (JWT)   → revoke + remove stored tokens
//   freebusy   (JWT)   → busy periods from the consultant's Google Calendar
//   sync_event (JWT)   → create/update/delete a calendar event (+ Meet link)
// ═══════════════════════════════════════════════════════════════════════════
import { createClient } from "npm:@supabase/supabase-js@2";

const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
const STATE_SECRET = Deno.env.get("GOOGLE_STATE_SECRET") ?? "change-me";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") ?? "";

const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google/callback`;
const SCOPES = "https://www.googleapis.com/auth/calendar";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL_API = "https://www.googleapis.com/calendar/v3";

const cors = {
  "Access-Control-Allow-Origin": FRONTEND_URL || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// ── state signing (CSRF protection) ─────────────────────────────────────────
async function signState(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(STATE_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=+$/, "")}`;
}
async function verifyState(state: string): Promise<string | null> {
  const i = state.lastIndexOf(".");
  if (i < 0) return null;
  const expected = await signState(state.slice(0, i));
  return expected === state ? state.slice(0, i) : null;
}

// ── Supabase clients ────────────────────────────────────────────────────────
const admin = () => createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
async function asUser(req: Request) {
  const header = req.headers.get("Authorization") ?? "";
  const jwt = header.replace("Bearer ", "");
  if (!jwt) return null;
  const c = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data } = await c.auth.getUser();
  return data?.user ?? null;
}
async function consultantIdFor(userId: string): Promise<string | null> {
  const { data } = await admin()
    .from("consultants").select("id").eq("user_id", userId).maybeSingle();
  return data?.id ?? null;
}

// ── token helpers ───────────────────────────────────────────────────────────
interface TokenRow {
  consultant_id: string; access_token: string; refresh_token: string;
  token_expiry: string | null; google_email: string;
}
async function getTokens(consultantId: string): Promise<TokenRow | null> {
  const { data } = await admin()
    .from("google_connections").select("*").eq("consultant_id", consultantId).maybeSingle();
  return (data as TokenRow) ?? null;
}
async function refreshIfNeeded(row: TokenRow): Promise<string> {
  const expiry = row.token_expiry ? new Date(row.token_expiry).getTime() : 0;
  if (row.access_token && Date.now() < expiry - 60_000) return row.access_token;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      grant_type: "refresh_token", refresh_token: row.refresh_token,
    }),
  });
  if (!res.ok) throw new Error(`token refresh failed: ${res.status}`);
  const t = await res.json();
  await admin().from("google_connections").update({
    access_token: t.access_token,
    token_expiry: new Date(Date.now() + t.expires_in * 1000).toISOString(),
  }).eq("consultant_id", row.consultant_id);
  return t.access_token;
}
async function googleFetch(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`${CAL_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`google api ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : await res.json();
}

// ── actions ─────────────────────────────────────────────────────────────────
async function authUrl(req: Request) {
  const user = await asUser(req);
  if (!user) return json({ error: "unauthorized" }, 401);
  const cid = await consultantIdFor(user.id);
  if (!cid) return json({ error: "no consultant profile" }, 403);

  const payload = btoa(JSON.stringify({ cid, ret: `${FRONTEND_URL}/#/consultant/disponueshmeria` }));
  const state = await signState(payload);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return json({ url: url.toString() });
}

async function callback(req: Request) {
  const u = new URL(req.url);
  const code = u.searchParams.get("code");
  const state = u.searchParams.get("state") ?? "";
  const payload = await verifyState(state);
  if (!code || !payload) {
    return new Response("Invalid OAuth state.", { status: 400, headers: cors });
  }
  const { cid, ret } = JSON.parse(atob(payload)) as { cid: string; ret: string };

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI,
    }),
  });
  if (!res.ok) return new Response("Token exchange failed.", { status: 502, headers: cors });
  const t = await res.json();

  const email = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${t.access_token}` },
  }).then((r) => r.json()).then((j) => j.email ?? "").catch(() => "");

  const db = admin();
  await db.from("google_connections").upsert({
    consultant_id: cid,
    google_email: email,
    access_token: t.access_token,
    refresh_token: t.refresh_token ?? "",
    token_expiry: new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString(),
    scope: t.scope ?? SCOPES,
  }, { onConflict: "consultant_id" });
  await db.from("consultants").update({ google_calendar_connected: true }).eq("id", cid);

  return new Response(null, { status: 302, headers: { ...cors, Location: ret } });
}

async function disconnect(req: Request) {
  const user = await asUser(req);
  if (!user) return json({ error: "unauthorized" }, 401);
  const cid = await consultantIdFor(user.id);
  if (!cid) return json({ error: "no consultant profile" }, 403);
  const db = admin();
  await db.from("google_connections").delete().eq("consultant_id", cid);
  await db.from("consultants").update({ google_calendar_connected: false }).eq("id", cid);
  return json({ ok: true });
}

async function freebusy(req: Request) {
  const user = await asUser(req);
  if (!user) return json({ error: "unauthorized" }, 401);
  const cid = await consultantIdFor(user.id);
  if (!cid) return json({ error: "no consultant profile" }, 403);
  const row = await getTokens(cid);
  if (!row) return json({ busy: [] });
  const token = await refreshIfNeeded(row);
  const { start, end } = await req.json().catch(() => ({}));
  const body = await googleFetch(token, "/freeBusy", {
    method: "POST",
    body: JSON.stringify({
      timeMin: start, timeMax: end, timeZone: "UTC",
      items: [{ id: "primary" }],
    }),
  });
  const busy = body?.calendars?.primary?.busy ?? [];
  return json({ busy });
}

// Create / update / delete a calendar event for an appointment, with Meet link.
async function syncEvent(req: Request) {
  const user = await asUser(req);
  if (!user) return json({ error: "unauthorized" }, 401);
  const { appointment_id: apptId, action: evAction } = await req.json().catch(() => ({}));
  const db = admin();
  const { data: appt } = await db.from("appointments").select(
    "id, consultant_id, date, start_time, duration_minutes, service_name, client_name, external_event_id",
  ).eq("id", apptId).maybeSingle();
  if (!appt) return json({ error: "appointment not found" }, 404);

  // Only the owning consultant (or staff) may sync their events.
  const cid = await consultantIdFor(user.id);
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const isStaff = profile?.role === "admin" || profile?.role === "super_admin";
  if (appt.consultant_id !== cid && !isStaff) return json({ error: "forbidden" }, 403);

  const row = await getTokens(appt.consultant_id);
  if (!row) return json({ error: "google not connected" }, 400);
  const token = await refreshIfNeeded(row);

  const start = `${appt.date}T${appt.start_time}:00Z`;
  const endDt = new Date(new Date(start).getTime() + appt.duration_minutes * 60_000);

  if (evAction === "delete") {
    if (appt.external_event_id) {
      await googleFetch(token, `/calendars/primary/events/${appt.external_event_id}`, { method: "DELETE" }).catch(() => null);
      await db.from("appointments").update({ external_event_id: null }).eq("id", appt.id);
    }
    return json({ ok: true, deleted: true });
  }

  const event = {
    summary: `StatLab · ${appt.service_name} — ${appt.client_name}`,
    description: "Konsultë StatLab (SPSS Consulting).",
    start: { dateTime: start, timeZone: "UTC" },
    end: { dateTime: endDt.toISOString(), timeZone: "UTC" },
    // Ask Google to attach a Meet link to the event.
    conferenceData: {
      createRequest: { requestId: `statlab-${appt.id}`, conferenceSolutionKey: { type: "hangoutsMeet" } },
    },
  };

  if (evAction === "update" && appt.external_event_id) {
    const updated = await googleFetch(token,
      `/calendars/primary/events/${appt.external_event_id}?conferenceDataVersion=1`,
      { method: "PATCH", body: JSON.stringify(event) });
    const meet = updated?.conferenceData?.entryPoints?.find((e: { entryPointType: string }) => e.entryPointType === "video")?.uri ?? null;
    await db.from("appointments").update({ meeting_url: meet, meeting_provider: meet ? "google_meet" : "none" }).eq("id", appt.id);
    return json({ ok: true, meeting_url: meet });
  }

  const created = await googleFetch(token,
    "/calendars/primary/events?conferenceDataVersion=1",
    { method: "POST", body: JSON.stringify(event) });
  const meet = created?.conferenceData?.entryPoints?.find((e: { entryPointType: string }) => e.entryPointType === "video")?.uri ?? null;
  await db.from("appointments").update({
    external_event_id: created?.id ?? null,
    meeting_url: meet,
    meeting_provider: meet ? "google_meet" : "none",
  }).eq("id", appt.id);
  return json({ ok: true, event_id: created?.id, meeting_url: meet });
}

// ── router ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const path = new URL(req.url).pathname;

  try {
    if (path.endsWith("/callback")) return await callback(req);
    const { action } = await req.json().catch(() => ({}));
    if (action === "auth_url") return await authUrl(req);
    if (action === "disconnect") return await disconnect(req);
    if (action === "freebusy") return await freebusy(req);
    if (action === "sync_event") return await syncEvent(req);
    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
