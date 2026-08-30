// ─── Domain types (mirror the Supabase PostgreSQL schema) ───────────────────

export type Role = "super_admin" | "admin" | "consultant" | "client";
export type Lang = "sq" | "de" | "en";

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  avatar_color: string;
  role: Role;
  preferred_language: Lang;
  status: "active" | "deactivated";
  created_at: string;
  updated_at: string;
}

export interface Session {
  user_id: string;
  user: User;
}

/** Appointment joined with display data (service/consultant names, history). */
export interface AppointmentRow extends Appointment {
  service_name: string;
  consultant_name: string;
  consultant_slug: string;
  client_user?: User;
}

export type ConsultantStatus = "pending" | "active" | "suspended" | "inactive";

export interface Consultant {
  id: string;
  user_id: string;
  slug: string;
  display_name: string;
  professional_title: string;
  bio: string;
  profile_photo: string | null;
  education: string[];
  certifications: string[];
  years_experience: number;
  languages: string[];
  specializations: string[];
  rating: number;
  review_count: number;
  status: ConsultantStatus;
  commission_percentage: number;
  is_active: boolean;
  is_featured: boolean;
  google_calendar_connected: boolean;
  created_at: string;
  updated_at: string;
}

export type PaymentPolicy = "full" | "deposit" | "free_booking";

export interface Service {
  id: string;
  name: string;
  slug: string;
  short_description: string;
  description: string;
  category: string;
  default_duration_minutes: number;
  default_price: number;
  currency: "EUR";
  is_active: boolean;
  payment_policy: PaymentPolicy;
  deposit_amount: number;
  created_at: string;
  updated_at: string;
}

export interface ConsultantService {
  id: string;
  consultant_id: string;
  service_id: string;
  price: number;
  duration_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AvailabilityWindow {
  id: string;
  consultant_id: string;
  day_of_week: number; // 1 = Mon … 7 = Sun
  start_time: string;
  end_time: string;
  is_available: boolean;
}

export type BlockType = "vacation" | "meeting" | "holiday" | "personal";

export interface ConsultantBlock {
  id: string;
  consultant_id: string;
  date: string; // YYYY-MM-DD
  end_date: string | null; // range support
  start_time: string | null; // null = whole day
  end_time: string | null;
  reason: string;
  type: BlockType;
}

export type AppointmentStatus =
  | "pending" | "confirmed" | "completed" | "cancelled" | "rescheduled" | "no_show";

export type StudyLevel = "bachelor" | "master" | "phd" | "professional" | "other";
export type SpssLevel = "none" | "basic" | "intermediate" | "advanced";

export interface AppointmentHistoryEntry {
  old_date: string;
  old_start: string;
  new_date: string;
  new_start: string;
  changed_by: string;
  changed_by_role: string;
  changed_at: string;
}

export interface ConsultationCompletion {
  summary: string;
  analyses_performed: string;
  findings: string;
  recommendations: string;
  next_steps: string;
  follow_up: "none" | "recommended" | "required";
  follow_up_timeframe: string;
}

export interface Appointment {
  id: string;
  reference: string;
  manage_token: string;
  client_id: string; // user id of client
  client_name: string;
  client_email: string;
  client_phone: string;
  consultant_id: string;
  service_id: string;
  project_id: string | null;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string;
  duration_minutes: number;
  price: number;
  currency: "EUR";
  status: AppointmentStatus;
  language: string;
  university: string;
  study_level: StudyLevel;
  research_topic: string;
  problem_description: string;
  spss_experience: SpssLevel;
  required_analysis: string;
  intake: Record<string, string>;
  payment_status: "unpaid" | "deposit_paid" | "paid" | "refunded";
  payment_policy: PaymentPolicy;
  meeting_provider: "google_meet" | "none";
  meeting_url: string | null;
  external_event_id: string | null;
  internal_notes: string;
  completion: ConsultationCompletion | null;
  history: AppointmentHistoryEntry[];
  rescheduled_from: string | null;
  created_at: string;
}

export type ProjectStatus =
  | "new" | "waiting_for_files" | "data_review" | "analysis_in_progress"
  | "interpretation" | "waiting_for_client" | "completed" | "cancelled";

export interface Project {
  id: string;
  client_id: string;
  primary_consultant_id: string;
  title: string;
  description: string;
  research_topic: string;
  research_questions: string;
  hypotheses: string;
  study_level: StudyLevel;
  university: string;
  deadline: string | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export type ProjectConsultantRole =
  | "lead" | "statistics" | "methodology" | "data_analyst";

export interface ProjectConsultant {
  id: string;
  project_id: string;
  consultant_id: string;
  role: ProjectConsultantRole;
  assigned_at: string;
}

export type TaskStatus = "not_started" | "in_progress" | "waiting" | "completed" | "not_required";

export interface AnalysisTask {
  id: string;
  project_id: string;
  name: string;
  task_order: number;
  status: TaskStatus;
  assigned_consultant_id: string | null;
  notes: string;
  progress: number; // 0-100
  completed_at: string | null;
}

export type FileCategory =
  | "dataset" | "questionnaire" | "thesis" | "spss_output" | "report" | "deliverable" | "other";

export interface ProjectFile {
  id: string;
  client_id: string;
  project_id: string | null;
  appointment_id: string | null;
  uploaded_by: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  category: FileCategory;
  content_note: string;
  created_at: string;
}

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded" | "partially_refunded";
export type PayoutStatus = "pending" | "approved" | "paid";
export type PaymentType = "full" | "deposit" | "balance";

export interface Payment {
  id: string;
  appointment_id: string | null;
  project_id: string | null;
  client_id: string;
  consultant_id: string;
  amount_gross: number;
  platform_fee: number;
  consultant_net: number;
  currency: "EUR";
  status: PaymentStatus;
  payout_status: PayoutStatus;
  type: PaymentType;
  method: "stripe" | "bank_transfer" | "cash";
  invoice_id: string | null;
  created_at: string;
  paid_at: string | null;
}

export type InvoiceStatus = "draft" | "issued" | "paid" | "overdue" | "cancelled";

export interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string;
  appointment_id: string | null;
  project_id: string | null;
  payment_id: string | null;
  amount_net: number;
  tax_amount: number;
  amount_total: number;
  currency: "EUR";
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  pdf_path: string | null;
  created_at: string;
}

export type ReviewStatus = "pending" | "published" | "rejected";

export interface Review {
  id: string;
  appointment_id: string;
  client_id: string;
  consultant_id: string;
  rating: number;
  clarity: number;
  usefulness: number;
  recommendation: number;
  comment: string;
  consent_to_publish: boolean;
  show_name: boolean;
  status: ReviewStatus;
  created_at: string;
}

export type WaitlistStatus = "waiting" | "notified" | "booked" | "expired";

export interface WaitlistEntry {
  id: string;
  name: string;
  email: string;
  phone: string;
  service_id: string | null;
  consultant_id: string | null;
  preferred_dates: string;
  preferred_time: string;
  status: WaitlistStatus;
  matched_appointment_id: string | null;
  created_at: string;
}

export type ApplicationStatus = "submitted" | "under_review" | "approved" | "rejected";

export interface ConsultantApplication {
  id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  education: string;
  experience: string;
  spss_experience: string;
  methodology_experience: string;
  specializations: string[];
  languages: string[];
  cv_file: string;
  linkedin: string;
  motivation: string;
  status: ApplicationStatus;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  actor_id: string | null;
  actor_name: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: string;
  created_at: string;
}

export type NotificationType =
  | "booking_received" | "booking_confirmed" | "booking_rescheduled" | "booking_cancelled"
  | "payment_received" | "invoice_created" | "project_update" | "consultation_completed"
  | "new_file" | "reminder_24h" | "reminder_1h" | "consultant_assigned" | "review_submitted"
  | "application_update" | "account";

export interface NotificationLog {
  id: string;
  recipient_id: string | null;
  recipient_email: string;
  appointment_id: string | null;
  type: NotificationType;
  channel: "email" | "sms" | "whatsapp" | "in_app";
  subject: string;
  body: string;
  status: "sent" | "queued" | "failed";
  sent_at: string;
}

export interface Consent {
  id: string;
  user_id: string;
  consent_type: "privacy" | "terms" | "data_processing" | "confidentiality";
  consent_version: string;
  accepted_at: string;
}

export interface IntakeField {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "number" | "radio";
  options?: string[];
  required?: boolean;
  placeholder?: string;
}

export interface IntakeTemplate {
  id: string;
  category: string;
  fields: IntakeField[];
}

export interface Settings {
  min_cancel_hours: number;
  min_reschedule_hours: number;
  buffer_minutes: number;
  min_notice_hours: number;
  booking_horizon_days: number;
  default_commission: number;
  tax_rate: number;
  reminder_hours: number[];
  counter_appointment: number;
  counter_invoice: number;
  platform_name: string;
}

export interface DB {
  version: number;
  users: User[];
  consultants: Consultant[];
  services: Service[];
  consultant_services: ConsultantService[];
  availability: AvailabilityWindow[];
  blocks: ConsultantBlock[];
  appointments: Appointment[];
  projects: Project[];
  project_consultants: ProjectConsultant[];
  analysis_tasks: AnalysisTask[];
  files: ProjectFile[];
  payments: Payment[];
  invoices: Invoice[];
  reviews: Review[];
  waitlist: WaitlistEntry[];
  applications: ConsultantApplication[];
  activity: ActivityLog[];
  notifications: NotificationLog[];
  consents: Consent[];
  intake_templates: IntakeTemplate[];
  settings: Settings;
}
