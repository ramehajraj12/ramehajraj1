import type { Lang } from "../types";

// ─── Translation architecture ────────────────────────────────────────────────
// `sq` is the primary language and fully populated. `de` / `en` carry the core
// navigation & action vocabulary to prove the architecture; missing keys fall
// back to Albanian so the UI is never blank.

type Dict = Record<string, string>;

const sq: Dict = {
  // brand
  "brand.name": "StatLab",
  "brand.tag": "Konsulencë SPSS & Analizë Statistikore",
  // nav public
  "nav.services": "Shërbimet",
  "nav.consultants": "Konsulentët",
  "nav.how": "Si funksionon",
  "nav.faq": "Pyetjet",
  "nav.become": "Bëhu konsulent",
  "nav.book": "Rezervo konsultën",
  "nav.login": "Kycu",
  "nav.portal": "Portali im",
  // common actions
  "act.save": "Ruaj",
  "act.cancel": "Anulo",
  "act.confirm": "Konfirmo",
  "act.delete": "Fshi",
  "act.edit": "Redakto",
  "act.search": "Kërko…",
  "act.filter": "Filtro",
  "act.download": "Shkarko",
  "act.upload": "Ngarko skedar",
  "act.view": "Shiko",
  "act.back": "Kthehu",
  "act.next": "Vazhdo",
  "act.retry": "Provo përsëri",
  "act.close": "Mbyll",
  "act.send": "Dërgo",
  "act.loading": "Duke ngarkuar…",
  // booking steps
  "step.service": "Shërbimi",
  "step.consultant": "Konsulenti",
  "step.datetime": "Termini",
  "step.details": "Të dhënat",
  "step.payment": "Pagesa",
  "step.confirmation": "Konfirmimi",
  // portal
  "portal.dashboard": "Paneli",
  "portal.calendar": "Kalendari",
  "portal.appointments": "Terminet",
  "portal.projects": "Projektet",
  "portal.clients": "Klientët",
  "portal.consultants": "Konsulentët",
  "portal.files": "Dokumentet",
  "portal.payments": "Pagesat",
  "portal.invoices": "Faturat",
  "portal.analytics": "Analitika",
  "portal.reviews": "Vlerësimet",
  "portal.availability": "Disponueshmëria",
  "portal.profile": "Profili",
  "portal.earnings": "Të ardhurat",
  "portal.services": "Shërbimet",
  "portal.applications": "Aplikimet",
  "portal.waitlist": "Lista e pritjes",
  "portal.activity": "Activity Log",
  "portal.settings": "Cilësimet",
  "portal.analysis": "Analizat",
  "portal.logout": "Dilni",
  // states
  "state.empty": "Nuk ka të dhëna ende.",
  "state.error": "Diçka shkoi keq. Provoni përsëri.",
  "state.no_results": "Asnjë rezultat për kërkimin tuaj.",
};

const en: Dict = {
  "nav.services": "Services",
  "nav.consultants": "Consultants",
  "nav.how": "How it works",
  "nav.faq": "FAQ",
  "nav.become": "Become a consultant",
  "nav.book": "Book a consultation",
  "nav.login": "Sign in",
  "portal.dashboard": "Dashboard",
  "portal.calendar": "Calendar",
  "portal.appointments": "Appointments",
  "portal.projects": "Projects",
  "portal.clients": "Clients",
  "portal.files": "Files",
  "portal.payments": "Payments",
  "portal.invoices": "Invoices",
  "portal.analytics": "Analytics",
  "portal.reviews": "Reviews",
  "portal.profile": "Profile",
  "portal.settings": "Settings",
  "act.save": "Save",
  "act.cancel": "Cancel",
  "act.confirm": "Confirm",
  "act.next": "Continue",
  "act.back": "Back",
  "act.loading": "Loading…",
};

const de: Dict = {
  "nav.services": "Leistungen",
  "nav.consultants": "Berater:innen",
  "nav.how": "Ablauf",
  "nav.faq": "Fragen",
  "nav.become": "Berater werden",
  "nav.book": "Beratung buchen",
  "nav.login": "Anmelden",
  "portal.dashboard": "Übersicht",
  "portal.calendar": "Kalender",
  "portal.appointments": "Termine",
  "portal.projects": "Projekte",
  "portal.clients": "Kunden",
  "portal.files": "Dateien",
  "portal.payments": "Zahlungen",
  "portal.invoices": "Rechnungen",
  "portal.analytics": "Analytik",
  "portal.reviews": "Bewertungen",
  "portal.profile": "Profil",
  "portal.settings": "Einstellungen",
  "act.save": "Speichern",
  "act.cancel": "Abbrechen",
  "act.confirm": "Bestätigen",
  "act.next": "Weiter",
  "act.back": "Zurück",
  "act.loading": "Lädt…",
};

const dicts: Record<Lang, Dict> = { sq, en, de };

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  let out = dicts[lang]?.[key] ?? sq[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replace(`{${k}}`, String(v));
  return out;
}

// ─── Domain labels (business enums → Albanian display strings) ───────────────

export const SPECIALIZATIONS: Record<string, string> = {
  spss: "SPSS",
  methodology: "Metodologji e hulumtimit",
  descriptive: "Statistikë përshkruese",
  reliability: "Analiza e besueshmërisë",
  correlation: "Korelacioni",
  ttest: "T-Test",
  anova: "ANOVA",
  regression: "Regresioni",
  logistic: "Regresioni logjistik",
  factor: "Analiza faktoriale",
  nonparametric: "Testet joparametrike",
  survey: "Dizajni i anketës",
  questionnaire: "Zhvillimi i pyetësorit",
  bachelor: "Mbështetje për diplomë",
  master: "Mbështetje për master",
  phd: "Mbështetje për doktoraturë",
  apa: "Raportimi APA",
  interpretation: "Interpretimi statistikor",
};

/** Canonical specialization values (stored in DB, matched by the booking engine) + Albanian labels. */
export const SPECIALIZATION_OPTIONS: { key: string; label: string }[] = [
  { key: "SPSS", label: "SPSS" },
  { key: "Descriptive Statistics", label: "Statistikë përshkruese" },
  { key: "Reliability Analysis", label: "Analiza e besueshmërisë" },
  { key: "Correlation", label: "Korelacioni" },
  { key: "ANOVA", label: "ANOVA" },
  { key: "Regression", label: "Regresioni" },
  { key: "Logistic Regression", label: "Regresioni logjistik" },
  { key: "Factor Analysis", label: "Analiza faktoriale" },
  { key: "Non-Parametric Statistics", label: "Testet joparametrike" },
  { key: "Research Methodology", label: "Metodologji e hulumtimit" },
  { key: "Survey Design", label: "Dizajni i anketës" },
  { key: "Questionnaire Development", label: "Zhvillimi i pyetësorit" },
  { key: "Master Thesis Support", label: "Mbështetje për master" },
  { key: "PhD Research Support", label: "Mbështetje për doktoraturë" },
  { key: "APA Reporting", label: "Raportimi APA" },
  { key: "Data Cleaning", label: "Pastrimi i të dhënave" },
];

export const SPEC_LABEL: Record<string, string> = Object.fromEntries(SPECIALIZATION_OPTIONS.map((o) => [o.key, o.label]));

export const APPLICATION_STATUS: Record<string, { label: string; tone: "warn" | "ok" | "mute" | "bad" | "info" | "teal" }> = {
  submitted: { label: "Në pritje të shqyrtimit", tone: "info" },
  under_review: { label: "Në shqyrtim", tone: "warn" },
  approved: { label: "Aprovuar", tone: "ok" },
  rejected: { label: "Refuzuar", tone: "bad" },
};

export const APPT_STATUS: Record<string, { label: string; tone: "warn" | "ok" | "mute" | "bad" | "info" | "teal" }> = {
  pending: { label: "Në pritje", tone: "warn" },
  confirmed: { label: "I konfirmuar", tone: "ok" },
  completed: { label: "I përfunduar", tone: "info" },
  cancelled: { label: "I anuluar", tone: "bad" },
  rescheduled: { label: "I rizhvendosur", tone: "teal" },
  no_show: { label: "Nuk u paraqit", tone: "mute" },
};

export const PROJECT_STATUS: Record<string, string> = {
  new: "I ri",
  waiting_for_files: "Në pritje të skedarëve",
  data_review: "Rishikim i të dhënave",
  analysis_in_progress: "Analiza në zhvillim",
  interpretation: "Interpretimi",
  waiting_for_client: "Në pritje të klientit",
  completed: "I përfunduar",
  cancelled: "I anuluar",
};

export const TASK_STATUS: Record<string, { label: string; tone: string }> = {
  not_started: { label: "Pa filluar", tone: "mute" },
  in_progress: { label: "Në zhvillim", tone: "warn" },
  waiting: { label: "Në pritje", tone: "teal" },
  completed: { label: "I përfunduar", tone: "ok" },
  not_required: { label: "Nuk kërkohet", tone: "mute" },
};

export const PAYMENT_STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: "Në pritje", tone: "warn" },
  paid: { label: "E paguar", tone: "ok" },
  failed: { label: "E dështuar", tone: "bad" },
  refunded: { label: "E rikthyer", tone: "mute" },
  partially_refunded: { label: "Pjesërisht e rikthyer", tone: "teal" },
};

export const INVOICE_STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: "Draft", tone: "mute" },
  issued: { label: "E lëshuar", tone: "warn" },
  paid: { label: "E paguar", tone: "ok" },
  overdue: { label: "E vonuar", tone: "bad" },
  cancelled: { label: "E anuluar", tone: "mute" },
};

export const REVIEW_STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: "Në moderim", tone: "warn" },
  published: { label: "E publikuar", tone: "ok" },
  rejected: { label: "E refuzuar", tone: "bad" },
};

export const FILE_CATEGORY: Record<string, string> = {
  dataset: "Set i të dhënave",
  questionnaire: "Pyetësor",
  thesis: "Punim",
  spss_output: "SPSS Output",
  report: "Raport",
  deliverable: "Material dorëzimi",
  other: "Tjetër",
};

export const STUDY_LEVEL: Record<string, string> = {
  bachelor: "Diplomë (Bachelor)",
  master: "Master",
  phd: "Doktoraturë",
  professional: "Profesional",
  other: "Tjetër",
};

export const SPSS_LEVEL: Record<string, string> = {
  none: "Pa përvojë",
  basic: "Bazë",
  intermediate: "Mesatare",
  advanced: "E avancuar",
};

export const LANGUAGES: Record<string, string> = {
  sq: "Shqip",
  de: "Gjermanisht",
  en: "Anglisht",
  it: "Italisht",
  tr: "Turqisht",
};

export const SERVICE_CATEGORY: Record<string, string> = {
  consultation: "Konsulencë SPSS",
  analysis: "Analizë statistikore",
  methodology: "Metodologji",
  thesis: "Mbështetje akademike",
  survey: "Pyetësorë & Anketa",
  custom: "Porosi speciale",
};

export const DAYS_SQ = ["E hënë", "E martë", "E mërkurë", "E enjte", "E premte", "E sobotë", "E diel"];
export const DAYS_SQ_SHORT = ["Hën", "Mar", "Mër", "Enj", "Pre", "Sob", "Die"];
export const MONTHS_SQ = [
  "Janar", "Shkurt", "Mars", "Prill", "Maj", "Qershor",
  "Korrik", "Gusht", "Shtator", "Tetor", "Nëntor", "Dhjetor",
];

export const ANALYSIS_TASK_NAMES = [
  "Data received", "Data preparation", "Data cleaning", "Missing values",
  "Outlier detection", "Variable coding", "Reverse coding", "Composite variables",
  "Reliability analysis", "Normality testing", "Descriptive statistics",
  "Correlation", "T-Test", "ANOVA", "Regression", "Logistic Regression",
  "Factor Analysis", "Non-parametric tests", "Hypothesis testing",
  "Statistical interpretation", "APA reporting", "Final report",
];

export const NOTIF_LABEL: Record<string, string> = {
  booking_received: "Rezervim i ri",
  booking_confirmed: "Rezervimi u konfirmua",
  booking_rescheduled: "Rezervimi u rizhvendos",
  booking_cancelled: "Rezervimi u anulua",
  payment_received: "Pagesa u pranua",
  invoice_created: "Fatura u krijua",
  project_update: "Përditësim i projektit",
  consultation_completed: "Konsulta u përfundua",
  new_file: "Skedar i ri",
  reminder_24h: "Kujtesë 24 orë",
  reminder_1h: "Kujtesë 1 orë",
  consultant_assigned: "Konsulent i caktuar",
  review_submitted: "Vlerësim i ri",
  application_update: "Përditësim aplikimi",
  account: "Llogaria",
};
