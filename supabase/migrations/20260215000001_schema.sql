-- ═══════════════════════════════════════════════════════════════════════════
-- StatLab — SPSS Consulting Platform · Schema
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- ── helpers ─────────────────────────────────────────────────────────────────
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ── profiles (1:1 with auth.users; guest clients created by booking have user_id null) ──
create table public.profiles (
  id uuid primary key,                        -- = auth.users.id for real accounts
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  phone text not null default '',
  avatar_url text,
  role text not null default 'client' check (role in ('super_admin','admin','consultant','client')),
  preferred_language text not null default 'sq' check (preferred_language in ('sq','de','en')),
  status text not null default 'active' check (status in ('active','deactivated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_email_idx on public.profiles (lower(email));
create index profiles_role_idx on public.profiles (role);
create index profiles_created_idx on public.profiles (created_at desc);
create unique index profiles_one_per_auth_user on public.profiles (user_id) where user_id is not null;
create trigger profiles_updated before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- ── consultants ─────────────────────────────────────────────────────────────
create table public.consultants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  slug text not null unique,
  display_name text not null,
  professional_title text not null default '',
  bio text not null default '',
  profile_photo text,
  education jsonb not null default '[]',
  certifications jsonb not null default '[]',
  years_experience integer not null default 0,
  languages jsonb not null default '["sq"]',
  specializations jsonb not null default '[]',
  rating numeric(3,2) not null default 0,
  review_count integer not null default 0,
  status text not null default 'pending' check (status in ('pending','active','suspended','inactive')),
  is_active boolean not null default true,      -- visible in directory
  is_featured boolean not null default false,
  google_calendar_connected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index consultants_user_idx on public.consultants (user_id);
create index consultants_status_idx on public.consultants (status, is_active);

-- commission & payout terms — staff/owner only (never public)
create table public.consultant_terms (
  consultant_id uuid primary key references public.consultants(id) on delete cascade,
  commission_percentage integer not null default 20 check (commission_percentage between 0 and 100),
  payout_email text,
  notes text,
  updated_at timestamptz not null default now()
);
create trigger consultant_terms_updated before update on public.consultant_terms
  for each row execute function public.tg_set_updated_at();

-- ── services ────────────────────────────────────────────────────────────────
create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  short_description text not null default '',
  description text not null default '',
  category text not null default 'consultation',
  default_duration_minutes integer not null default 60,
  default_price numeric(10,2) not null default 0,
  currency text not null default 'EUR',
  is_active boolean not null default true,
  payment_policy text not null default 'full' check (payment_policy in ('full','deposit','free_booking')),
  deposit_amount numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index services_active_idx on public.services (is_active);
create trigger services_updated before update on public.services
  for each row execute function public.tg_set_updated_at();

create table public.consultant_services (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references public.consultants(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  price numeric(10,2) not null,
  duration_minutes integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (consultant_id, service_id)
);
create index consultant_services_consultant_idx on public.consultant_services (consultant_id, is_active);
create index consultant_services_service_idx on public.consultant_services (service_id);
create trigger consultant_services_updated before update on public.consultant_services
  for each row execute function public.tg_set_updated_at();

-- ── availability ────────────────────────────────────────────────────────────
create table public.weekly_availability (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references public.consultants(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 1 and 7),  -- 1 = Mon … 7 = Sun
  start_time time not null,
  end_time time not null,
  is_available boolean not null default true,
  check (end_time > start_time)
);
create index weekly_availability_consultant_idx on public.weekly_availability (consultant_id, day_of_week);

create table public.blocked_periods (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references public.consultants(id) on delete cascade,
  block_date date not null,
  end_date date,                       -- range support (vacations)
  start_time time,                     -- null = whole day
  end_time time,
  reason text not null default '',
  block_type text not null default 'personal' check (block_type in ('vacation','meeting','holiday','personal')),
  created_at timestamptz not null default now()
);
create index blocked_periods_consultant_idx on public.blocked_periods (consultant_id, block_date);

-- ── appointments ────────────────────────────────────────────────────────────
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  manage_token uuid not null unique default gen_random_uuid(),
  client_id uuid references public.profiles(id) on delete set null,
  client_name text not null,
  client_email text not null,
  client_phone text not null default '',
  consultant_id uuid not null references public.consultants(id) on delete restrict,
  consultant_name text not null default '',        -- denormalized (safe embed for clients)
  service_id uuid not null references public.services(id) on delete restrict,
  service_name text not null default '',           -- denormalized
  project_id uuid,                                 -- fk added after projects table
  date date not null,
  start_time time not null,
  duration_minutes integer not null,
  price numeric(10,2) not null,
  currency text not null default 'EUR',
  status text not null default 'pending'
    check (status in ('pending','confirmed','completed','cancelled','rescheduled','no_show')),
  language text not null default 'sq',
  university text not null default '',
  study_level text not null default 'master',
  research_topic text not null default '',
  problem_description text not null default '',
  spss_experience text not null default 'basic',
  required_analysis text not null default '',
  intake jsonb not null default '{}',
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid','deposit_paid','paid','refunded')),
  payment_policy text not null default 'full',
  meeting_provider text not null default 'none',
  meeting_url text,
  external_event_id text,                          -- Google Calendar event (deferred integration)
  internal_notes text not null default '',
  completion jsonb,                                -- post-consultation workflow
  rescheduled_from uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index appointments_date_idx on public.appointments (date);
create index appointments_consultant_date_idx on public.appointments (consultant_id, date);
create index appointments_client_idx on public.appointments (client_id);
create index appointments_status_idx on public.appointments (status);
create index appointments_project_idx on public.appointments (project_id);
create index appointments_created_idx on public.appointments (created_at desc);
create trigger appointments_updated before update on public.appointments
  for each row execute function public.tg_set_updated_at();

-- ★ DATABASE-LEVEL DOUBLE BOOKING PROTECTION ★
-- No two active appointments of the same consultant may overlap in time,
-- even if two concurrent transactions both pass application-level checks.
alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (
    consultant_id with =,
    tstzrange(
      (date + start_time) at time zone 'UTC',
      (date + start_time + make_interval(mins => duration_minutes)) at time zone 'UTC'
    ) with &&
  ) where (status in ('pending', 'confirmed', 'rescheduled'));

create table public.appointment_history (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  old_date date not null,
  old_start time not null,
  new_date date not null,
  new_start time not null,
  changed_by text not null,
  changed_by_role text not null default 'client',
  changed_at timestamptz not null default now()
);
create index appointment_history_appt_idx on public.appointment_history (appointment_id);

-- ── projects ────────────────────────────────────────────────────────────────
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  primary_consultant_id uuid not null references public.consultants(id) on delete restrict,
  title text not null,
  description text not null default '',
  research_topic text not null default '',
  research_questions text not null default '',
  hypotheses text not null default '',
  study_level text not null default 'master',
  university text not null default '',
  deadline date,
  status text not null default 'new'
    check (status in ('new','waiting_for_files','data_review','analysis_in_progress',
                      'interpretation','waiting_for_client','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.appointments
  add constraint appointments_project_fk foreign key (project_id) references public.projects(id) on delete set null;
create index projects_client_idx on public.projects (client_id);
create index projects_consultant_idx on public.projects (primary_consultant_id);
create index projects_status_idx on public.projects (status);
create trigger projects_updated before update on public.projects
  for each row execute function public.tg_set_updated_at();

create table public.project_consultants (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  consultant_id uuid not null references public.consultants(id) on delete cascade,
  role text not null default 'statistics' check (role in ('lead','statistics','methodology','data_analyst')),
  assigned_at timestamptz not null default now(),
  unique (project_id, consultant_id)
);
create index project_consultants_consultant_idx on public.project_consultants (consultant_id);

create table public.analysis_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  task_order integer not null default 0,
  status text not null default 'not_started'
    check (status in ('not_started','in_progress','waiting','completed','not_required')),
  progress integer not null default 0 check (progress between 0 and 100),
  notes text not null default '',
  assigned_consultant_id uuid references public.consultants(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index analysis_tasks_project_idx on public.analysis_tasks (project_id, task_order);

create table public.project_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  author_name text not null default '',
  note text not null,
  created_at timestamptz not null default now()
);
create index project_notes_project_idx on public.project_notes (project_id, created_at desc);

-- ── files (metadata; binaries live in private storage bucket) ───────────────
create table public.project_files (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  file_name text not null,
  file_path text not null,
  file_type text not null default '',
  file_size bigint not null default 0,
  category text not null default 'other'
    check (category in ('dataset','questionnaire','thesis','spss_output','report','deliverable','other')),
  created_at timestamptz not null default now()
);
create index project_files_project_idx on public.project_files (project_id);
create index project_files_client_idx on public.project_files (client_id);
create index project_files_category_idx on public.project_files (category);

-- ── payments & invoices ─────────────────────────────────────────────────────
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  client_id uuid references public.profiles(id) on delete set null,
  consultant_id uuid references public.consultants(id) on delete set null,
  type text not null default 'full' check (type in ('full','deposit','balance')),
  amount_gross numeric(10,2) not null,
  platform_fee numeric(10,2) not null default 0,
  consultant_net numeric(10,2) not null default 0,
  currency text not null default 'EUR',
  status text not null default 'pending'
    check (status in ('pending','paid','failed','refunded','partially_refunded')),
  payout_status text not null default 'pending' check (payout_status in ('pending','approved','paid')),
  method text not null default 'stripe_demo',
  stripe_reference text,                            -- set after webhook verification (deferred)
  invoice_id uuid,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index payments_client_idx on public.payments (client_id);
create index payments_consultant_idx on public.payments (consultant_id);
create index payments_status_idx on public.payments (status);
create index payments_paid_at_idx on public.payments (paid_at);
create index payments_appointment_idx on public.payments (appointment_id);

create sequence public.invoice_number_seq start 1024;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  client_id uuid references public.profiles(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  amount_net numeric(10,2) not null default 0,
  tax_amount numeric(10,2) not null default 0,
  amount_total numeric(10,2) not null default 0,
  currency text not null default 'EUR',
  status text not null default 'draft'
    check (status in ('draft','issued','paid','overdue','cancelled')),
  issue_date date not null default current_date,
  due_date date not null default (current_date + 14),
  pdf_path text,
  created_at timestamptz not null default now()
);
alter table public.payments
  add constraint payments_invoice_fk foreign key (invoice_id) references public.invoices(id) on delete set null;
create index invoices_client_idx on public.invoices (client_id);
create index invoices_status_idx on public.invoices (status);

-- ── reviews ─────────────────────────────────────────────────────────────────
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  client_id uuid references public.profiles(id) on delete set null,
  consultant_id uuid not null references public.consultants(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  clarity integer not null default 5 check (clarity between 1 and 5),
  usefulness integer not null default 5 check (usefulness between 1 and 5),
  recommendation integer not null default 5 check (recommendation between 1 and 5),
  comment text not null default '',
  show_name boolean not null default false,
  consent_to_publish boolean not null default true,
  status text not null default 'pending' check (status in ('pending','published','rejected')),
  created_at timestamptz not null default now(),
  unique (appointment_id)
);
create index reviews_consultant_idx on public.reviews (consultant_id, status);

-- ── waitlist, applications, notifications, activity, consents ──────────────
create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null default '',
  service_id uuid references public.services(id) on delete set null,
  consultant_id uuid references public.consultants(id) on delete set null,
  preferred_dates text not null default '',
  preferred_time text not null default 'morning',
  status text not null default 'waiting' check (status in ('waiting','notified','booked','expired')),
  has_match boolean not null default false,
  profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index waitlist_status_idx on public.waitlist (status);

create table public.consultant_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null default '',
  country text not null default '',
  education text not null default '',
  experience text not null default '',
  spss_experience text not null default '',
  methodology_experience text not null default '',
  specializations jsonb not null default '[]',
  languages jsonb not null default '["sq"]',
  cv_file text,
  certificates text,
  linkedin text,
  motivation text not null default '',
  status text not null default 'submitted' check (status in ('submitted','under_review','approved','rejected')),
  created_at timestamptz not null default now()
);
create index applications_status_idx on public.consultant_applications (status);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.profiles(id) on delete cascade,
  recipient_email text not null default '',
  appointment_id uuid references public.appointments(id) on delete cascade,
  type text not null,
  channel text not null default 'email' check (channel in ('email','sms','whatsapp','in_app')),
  status text not null default 'sent',
  subject text not null default '',
  body text not null default '',
  dedupe_key text,
  sent_at timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications (recipient_id, sent_at desc);
create index notifications_dedupe_idx on public.notifications (dedupe_key);
create unique index notifications_dedupe_unique on public.notifications (dedupe_key) where dedupe_key is not null;

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_name text not null default 'Sistemi',
  actor_role text not null default 'system',
  action text not null,
  entity_type text not null default '',
  entity_id text not null default '',
  metadata text not null default '',
  created_at timestamptz not null default now()
);
create index activity_created_idx on public.activity_log (created_at desc);
create index activity_action_idx on public.activity_log (action);
create index activity_entity_idx on public.activity_log (entity_type, entity_id);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  consent_type text not null check (consent_type in ('privacy','terms','data_processing','confidentiality')),
  consent_version text not null default '1.2',
  accepted_at timestamptz not null default now()
);
create index consents_user_idx on public.consents (user_id, consent_type);

create table public.intake_templates (
  id uuid primary key default gen_random_uuid(),
  category text not null unique,
  title text not null,
  description text not null default '',
  fields jsonb not null default '[]'
);

create table public.settings (
  id integer primary key default 1 check (id = 1),
  min_cancel_hours integer not null default 24,
  min_reschedule_hours integer not null default 12,
  buffer_minutes integer not null default 15,
  min_notice_hours integer not null default 2,
  max_booking_days integer not null default 60,
  reminder_hours jsonb not null default '[24, 1]',
  tax_rate numeric(5,2) not null default 18,
  default_commission integer not null default 20,
  currency text not null default 'EUR',
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1);

-- ── sequences for human references ─────────────────────────────────────────
create sequence public.appointment_ref_seq start 124;

-- ── private storage bucket for research files ──────────────────────────────
insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', false)
on conflict (id) do nothing;
