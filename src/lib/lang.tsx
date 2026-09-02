import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Self-contained SQ/EN language layer for the account-settings stack.
 * The platform-wide dictionary lives in ./i18n (untouched).
 */
export type Lang = "sq" | "en";

const dict = {
  sq: {
    "brand.name": "StatLab",
    "brand.tag": "Konsulencë SPSS",

    // ── auth ──
    "auth.kicker": "Portali i platformës",
    "auth.title": "Cilësimet e llogarisë, në një vend.",
    "auth.sub": "Profili, fotografia, gjuha dhe siguria — të mbrojtura me autorizim në nivel baze të dhënash.",
    "auth.trust1": "RLS në çdo tabelë",
    "auth.trust2": "Storage privat",
    "auth.trust3": "Vetëm të dhënat e tua",
    "auth.signIn": "Kyçu",
    "auth.signUp": "Regjistrohu",
    "auth.loginTitle": "Kyçu në StatLab",
    "auth.loginSub": "Vazhdo te cilësimet e llogarisë suaj.",
    "auth.registerTitle": "Krijoni llogarinë",
    "auth.registerSub": "Çdo llogari e re fillon si klient.",
    "auth.fullName": "Emri i plotë",
    "auth.email": "Email",
    "auth.password": "Fjalëkalimi",
    "auth.confirm": "Konfirmo fjalëkalimin",
    "auth.login": "Kyçu",
    "auth.create": "Krijo llogarinë",
    "auth.noAccount": "Nuk keni llogari? Regjistrohuni",
    "auth.haveAccount": "Keni tashmë llogari? Kyçuni",
    "auth.demo": "Hap hapësirën demo",
    "auth.demoHint": "Pa Supabase të konfiguruar — të dhënat mbeten vetëm në këtë shfletues.",
    "auth.err.invalid": "Email ose fjalëkalim i pasaktë.",
    "auth.err.confirmEmail": "Llogaria u krijua — verifikoni email-in para se të kyçeni.",
    "auth.err.mismatch": "Fjalëkalimet nuk përputhen.",
    "auth.err.name": "Emri i plotë është i detyrueshëm.",
    "auth.err.email": "Email-i nuk është i vlefshëm.",
    "auth.err.pwShort": "Fjalëkalimi duhet të ketë të paktën 8 karaktere.",
    "auth.loggingIn": "Duke u kyçur…",
    "auth.creating": "Duke krijuar…",
    "auth.confirmTitle": "Verifikoni email-in",
    "auth.confirmBody": "Llogaria u krijua. Hapni linkun e verifikimit në email dhe pastaj kyçuni.",
    "auth.backToLogin": "Kthehu te kyçja",

    // ── shell ──
    "shell.settings": "Cilësimet",
    "shell.signOut": "Dil",
    "shell.demoMode": "Demo",
    "shell.home": "Faqja kryesore",

    // ── settings nav ──
    "set.title": "Cilësimet e llogarisë",
    "set.sub": "Menaxhoni profilin, gjuhën dhe sigurinë e llogarisë suaj.",
    "set.nav.profile": "Profili",
    "set.nav.account": "Llogaria",
    "set.nav.language": "Gjuha",
    "set.nav.security": "Siguria",
    "set.nav.platform": "Platforma",

    // ── profile ──
    "prof.title": "Profili",
    "prof.sub": "Si dukeni për ekipin dhe konsulentët e platformës.",
    "prof.photo": "Fotografia e profilit",
    "prof.photoHint": "JPG, PNG ose WEBP. Maksimumi 5 MB.",
    "prof.changePhoto": "Ndrysho fotografinë",
    "prof.removePhoto": "Hiq fotografinë",
    "prof.uploading": "Duke ngarkuar…",
    "prof.removing": "Duke hequr…",
    "prof.photoOk": "Fotografia u përditësua.",
    "prof.photoRemoved": "Fotografia u hoq.",
    "prof.photoErrType": "Format i palejuar. Përdorni JPG, PNG ose WEBP.",
    "prof.photoErrSize": "Skedari tejkalon 5 MB.",
    "prof.removeTitle": "Hiq fotografinë?",
    "prof.removeBody": "Fotografia do të fshihet nga storage dhe profili do të kthehet te inicialet. Ky veprim nuk mund të zhbëhet.",
    "prof.cancel": "Anulo",
    "prof.remove": "Po, hiqe",
    "prof.personal": "Të dhënat personale",
    "prof.fullName": "Emri i plotë",
    "prof.phone": "Telefoni",
    "prof.phoneHint": "Opsionale — përdoret për njoftimet e terminit.",
    "prof.save": "Ruaj ndryshimet",
    "prof.saving": "Duke ruajtur…",
    "prof.saved": "Profili u ruajt.",
    "prof.errName": "Emri nuk mund të jetë bosh.",

    // ── account ──
    "acc.title": "Llogaria",
    "acc.sub": "Informacioni i llogarisë suaj. Disa fusha menaxhohen nga platforma.",
    "acc.email": "Email",
    "acc.emailHint": "Adresa e lidhur me llogarinë tuaj.",
    "acc.role": "Roli",
    "acc.roleHint": "Roli caktohet nga ekipi i platformës dhe nuk mund të ndryshohet nga cilësimet.",
    "acc.type": "Lloji i llogarisë",
    "acc.memberSince": "Anëtar prej",
    "acc.status": "Statusi i llogarisë",
    "acc.active": "Aktive",
    "acc.uid": "ID e brendshme",
    "acc.uidHint": "E fshehur nga ndërfaqja — përdoret vetëm për autorizim.",
    "role.client": "Klient",
    "role.consultant": "Konsulent",
    "role.admin": "Administrator",
    "role.super_admin": "Super Administrator",

    // ── language ──
    "lang.title": "Gjuha",
    "lang.sub": "Gjuha e ndërfaqes ruhet në llogarinë tuaj.",
    "lang.label": "Gjuha e preferuar",
    "lang.hint": "Ndërrimi zbatohet menjëherë në të gjithë ndërfaqen.",
    "lang.saved": "Gjuha u ruajt.",

    // ── security ──
    "sec.title": "Siguria",
    "sec.sub": "Mbroni llogarinë tuaj me një fjalëkalim të fortë.",
    "sec.changePw": "Ndrysho fjalëkalimin",
    "sec.current": "Fjalëkalimi aktual",
    "sec.new": "Fjalëkalimi i ri",
    "sec.newHint": "Të paktën 8 karaktere.",
    "sec.confirmNew": "Konfirmo fjalëkalimin e ri",
    "sec.submit": "Përditëso fjalëkalimin",
    "sec.submitting": "Duke përditësuar…",
    "sec.ok": "Fjalëkalimi u ndryshua me sukses.",
    "sec.errCurrent": "Fjalëkalimi aktual është i detyrueshëm.",
    "sec.errShort": "Fjalëkalimi i ri duhet të ketë të paktën 8 karaktere.",
    "sec.errMismatch": "Fjalëkalimet e reja nuk përputhen.",
    "sec.errWrongCurrent": "Fjalëkalimi aktual është i pasaktë.",
    "sec.strength": "Fuqia",
    "sec.strength.0": "Shumë i dobët",
    "sec.strength.1": "I dobët",
    "sec.strength.2": "Mesatar",
    "sec.strength.3": "I fortë",
    "sec.strength.4": "Shumë i fortë",

    // ── platform (admin-only, read-only) ──
    "plat.title": "Cilësimet e platformës",
    "plat.sub": "Rregullat globale të platformës — vetëm për lexim këtu.",
    "plat.lock": "Këto vlera menaxhohen nga Administratorët në konsolën admin. Cilësimet e llogarisë nuk e prekjnë kurrë platformën.",
    "plat.booking": "Rregullat e rezervimit",
    "plat.minCancel": "Anulimi minimal (orë)",
    "plat.minReschedule": "Rizhvendosja minimale (orë)",
    "plat.buffer": "Buffer mes termineve (min)",
    "plat.horizon": "Horizonti i rezervimit (ditë)",
    "plat.finance": "Financat",
    "plat.tax": "Norma e taksës (%)",
    "plat.commission": "Komisioni standard (%)",
    "plat.unavailable": "Cilësimet globale nuk janë të disponueshme tani.",

    "common.error": "Diçka shkoi keq. Provoni përsëri.",
    "common.noPerm": "Nuk keni të drejtë për këtë veprim.",
    "common.retry": "Provo përsëri",
    "common.loading": "Duke u ngarkuar…",
  },
  en: {
    "brand.name": "StatLab",
    "brand.tag": "SPSS Consulting",

    "auth.kicker": "Platform portal",
    "auth.title": "Account settings, in one place.",
    "auth.sub": "Profile, photo, language and security — protected by database-level authorization.",
    "auth.trust1": "RLS on every table",
    "auth.trust2": "Private storage",
    "auth.trust3": "Only your data",
    "auth.signIn": "Sign in",
    "auth.signUp": "Sign up",
    "auth.loginTitle": "Sign in to StatLab",
    "auth.loginSub": "Continue to your account settings.",
    "auth.registerTitle": "Create your account",
    "auth.registerSub": "Every new account starts as a client.",
    "auth.fullName": "Full name",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.confirm": "Confirm password",
    "auth.login": "Sign in",
    "auth.create": "Create account",
    "auth.noAccount": "No account? Sign up",
    "auth.haveAccount": "Already have an account? Sign in",
    "auth.demo": "Open demo workspace",
    "auth.demoHint": "No Supabase configured — data stays in this browser only.",
    "auth.err.invalid": "Incorrect email or password.",
    "auth.err.confirmEmail": "Account created — please verify your email before signing in.",
    "auth.err.mismatch": "Passwords do not match.",
    "auth.err.name": "Full name is required.",
    "auth.err.email": "Email is not valid.",
    "auth.err.pwShort": "Password must be at least 8 characters.",
    "auth.loggingIn": "Signing in…",
    "auth.creating": "Creating…",
    "auth.confirmTitle": "Verify your email",
    "auth.confirmBody": "Your account was created. Open the verification link in your email, then sign in.",
    "auth.backToLogin": "Back to sign in",

    "shell.settings": "Settings",
    "shell.signOut": "Sign out",
    "shell.demoMode": "Demo",
    "shell.home": "Home",

    "set.title": "Account Settings",
    "set.sub": "Manage your profile, language and account security.",
    "set.nav.profile": "Profile",
    "set.nav.account": "Account",
    "set.nav.language": "Language",
    "set.nav.security": "Security",
    "set.nav.platform": "Platform",

    "prof.title": "Profile",
    "prof.sub": "How you appear to the team and platform consultants.",
    "prof.photo": "Profile photo",
    "prof.photoHint": "JPG, PNG or WEBP. Maximum 5 MB.",
    "prof.changePhoto": "Change Photo",
    "prof.removePhoto": "Remove Photo",
    "prof.uploading": "Uploading…",
    "prof.removing": "Removing…",
    "prof.photoOk": "Photo updated.",
    "prof.photoRemoved": "Photo removed.",
    "prof.photoErrType": "Unsupported format. Use JPG, PNG or WEBP.",
    "prof.photoErrSize": "File exceeds 5 MB.",
    "prof.removeTitle": "Remove photo?",
    "prof.removeBody": "The photo will be deleted from storage and your profile will fall back to initials. This cannot be undone.",
    "prof.cancel": "Cancel",
    "prof.remove": "Yes, remove",
    "prof.personal": "Personal Information",
    "prof.fullName": "Full name",
    "prof.phone": "Phone",
    "prof.phoneHint": "Optional — used for appointment notifications.",
    "prof.save": "Save Changes",
    "prof.saving": "Saving…",
    "prof.saved": "Profile saved.",
    "prof.errName": "Name cannot be empty.",

    "acc.title": "Account",
    "acc.sub": "Your account information. Some fields are managed by the platform.",
    "acc.email": "Email",
    "acc.emailHint": "The email address associated with your account.",
    "acc.role": "Role",
    "acc.roleHint": "Your role is assigned by the platform team and cannot be changed from settings.",
    "acc.type": "Account type",
    "acc.memberSince": "Member since",
    "acc.status": "Account status",
    "acc.active": "Active",
    "acc.uid": "Internal ID",
    "acc.uidHint": "Hidden from the interface — used for authorization only.",
    "role.client": "Client",
    "role.consultant": "Consultant",
    "role.admin": "Administrator",
    "role.super_admin": "Super Administrator",

    "lang.title": "Language",
    "lang.sub": "Your interface language is stored on your account.",
    "lang.label": "Preferred language",
    "lang.hint": "The switch applies immediately across the interface.",
    "lang.saved": "Language saved.",

    "sec.title": "Security",
    "sec.sub": "Protect your account with a strong password.",
    "sec.changePw": "Change password",
    "sec.current": "Current password",
    "sec.new": "New password",
    "sec.newHint": "At least 8 characters.",
    "sec.confirmNew": "Confirm new password",
    "sec.submit": "Update password",
    "sec.submitting": "Updating…",
    "sec.ok": "Password changed successfully.",
    "sec.errCurrent": "Current password is required.",
    "sec.errShort": "The new password must be at least 8 characters.",
    "sec.errMismatch": "The new passwords do not match.",
    "sec.errWrongCurrent": "The current password is incorrect.",
    "sec.strength": "Strength",
    "sec.strength.0": "Very weak",
    "sec.strength.1": "Weak",
    "sec.strength.2": "Fair",
    "sec.strength.3": "Strong",
    "sec.strength.4": "Very strong",

    "plat.title": "Platform settings",
    "plat.sub": "Global platform rules — read-only here.",
    "plat.lock": "These values are managed by Administrators in the admin console. Account settings never affect the platform.",
    "plat.booking": "Booking rules",
    "plat.minCancel": "Minimum cancellation (hours)",
    "plat.minReschedule": "Minimum reschedule (hours)",
    "plat.buffer": "Buffer between slots (min)",
    "plat.horizon": "Booking horizon (days)",
    "plat.finance": "Finance",
    "plat.tax": "Tax rate (%)",
    "plat.commission": "Default commission (%)",
    "plat.unavailable": "Global settings are unavailable right now.",

    "common.error": "Something went wrong. Please try again.",
    "common.noPerm": "You are not allowed to perform this action.",
    "common.retry": "Try again",
    "common.loading": "Loading…",
  },
} as const;

export type DictKey = keyof (typeof dict)["sq"];

const LangCtx = createContext<{ lang: Lang; t: (k: DictKey) => string; setLang: (l: Lang) => void }>({
  lang: "sq",
  t: (k) => dict.sq[k] ?? k,
  setLang: () => undefined,
});

export function LangProvider({ initial, children, onPersist }: {
  initial: Lang;
  children: React.ReactNode;
  onPersist?: (l: Lang) => void;
}) {
  const [lang, setLangState] = useState<Lang>(initial);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("statlab_lang", l); } catch { /* non-fatal */ }
    onPersist?.(l);
  }, [onPersist]);
  const t = useCallback((k: DictKey) => dict[lang][k] ?? dict.sq[k] ?? k, [lang]);
  const value = useMemo(() => ({ lang, t, setLang }), [lang, t, setLang]);
  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
}

export function useLang() {
  return useContext(LangCtx);
}

// compatibility aliases for the settings stack modules
export { LangProvider as I18nProvider, useLang as useI18n };

export function readStoredLang(): Lang {
  try {
    const v = localStorage.getItem("statlab_lang");
    return v === "en" || v === "sq" ? v : "sq";
  } catch {
    return "sq";
  }
}
