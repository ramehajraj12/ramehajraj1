-- ═══════════════════════════════════════════════════════════════════════════
-- StatLab · Google Calendar + Google Meet integration (per-consultant OAuth)
--
-- Token storage is deliberately kept out of reach of the browser:
--   · google_connections has RLS enabled with NO user-facing policies, so only
--     the service role (used by the `google` Edge Function) can read/write it.
--   · The frontend only ever sees { connected, email } via google_connection_status().
--
-- PRODUCTION HARDENING: move access_token/refresh_token into Supabase Vault
-- (pgsodium) and store only the vault key id here once the project enables it.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.google_connections (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null unique references public.consultants(id) on delete cascade,
  google_email text not null default '',
  access_token text not null default '',
  refresh_token text not null default '',
  token_expiry timestamptz,
  scope text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Lock the table down: with RLS on and no policies, ONLY the service role
-- (the Edge Function) can touch raw tokens. Anon/authenticated get zero rows.
alter table public.google_connections enable row level security;

create index if not exists google_connections_consultant_idx
  on public.google_connections (consultant_id);

-- ── read-only status for the owning consultant ─────────────────────────────
-- Exposes connected + email only. Never returns tokens.
create or replace function public.google_connection_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
begin
  cid := public.my_consultant_id();
  if cid is null then
    return jsonb_build_object('connected', false, 'email', null);
  end if;

  return coalesce(
    (select jsonb_build_object('connected', true, 'email', gc.google_email)
       from public.google_connections gc
      where gc.consultant_id = cid),
    jsonb_build_object('connected', false, 'email', null)
  );
end $$;

grant execute on function public.google_connection_status() to authenticated;

-- Keep updated_at fresh.
create or replace function public.tg_google_connections_updated()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists google_connections_updated on public.google_connections;
create trigger google_connections_updated
  before update on public.google_connections
  for each row execute function public.tg_google_connections_updated();

-- ── convenience view of the boolean already on consultants ─────────────────
-- consultants.google_calendar_connected stays the canonical flag the booking
-- engine and availability checks read. The Edge Function flips it in sync
-- with the token row.
comment on column public.consultants.google_calendar_connected is
  'Mirrored from google_connections by the google Edge Function.';
