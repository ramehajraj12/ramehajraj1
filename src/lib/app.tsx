import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  createAccountStore, AccountError,
  type AccountStore, type Profile, type PersonalPatch, type AccountErrorCode,
} from "./account";
import { useI18n, readStoredLang, I18nProvider, type Lang, type DictKey } from "./lang";

export type ToastTone = "ok" | "bad" | "info";
export interface Toast { id: number; tone: ToastTone; message: string; }

interface AppCtx {
  store: AccountStore;
  profile: Profile | null;
  ready: boolean;
  signIn: (email: string, pw: string) => Promise<Profile>;
  signUp: (email: string, pw: string, name: string) => Promise<{ profile: Profile | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  updatePersonal: (patch: PersonalPatch) => Promise<Profile>;
  uploadAvatar: (file: File) => Promise<Profile>;
  removeAvatar: () => Promise<Profile>;
  changePassword: (current: string, next: string) => Promise<void>;
  toasts: Toast[];
  toast: (message: string, tone?: ToastTone) => void;
  dismissToast: (id: number) => void;
  errText: (e: unknown, fallback?: DictKey) => string;
}

const Ctx = createContext<AppCtx | null>(null);

const ERR_KEYS: Record<AccountErrorCode, DictKey> = {
  ERR_INVALID_CREDENTIALS: "auth.err.invalid",
  ERR_EXISTS: "common.error",
  ERR_CONFIRM_EMAIL: "auth.err.confirmEmail",
  ERR_RATE: "common.error",
  ERR_NO_PERM: "common.noPerm",
  ERR_NETWORK: "common.error",
  ERR_BUCKET: "common.error",
  ERR_WRONG_CURRENT: "sec.errWrongCurrent",
  ERR_PW_WEAK: "sec.errShort",
  ERR_FILE_TYPE: "prof.photoErrType",
  ERR_FILE_SIZE: "prof.photoErrSize",
  ERR_STORAGE: "common.error",
  ERR_GENERIC: "common.error",
};

function InnerProvider({ children }: { children: React.ReactNode }) {
  const { t, setLang } = useI18n();
  const [store] = useState<AccountStore>(() => createAccountStore());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);

  useEffect(() => {
    let alive = true;
    let settled = false;
    const finish = () => { if (alive && !settled) { settled = true; setReady(true); } };
    // Guarantees a first paint even if Supabase is slow, paused, or a stale
    // token refresh hangs — the auth screen must never be blocked by network.
    const guard = window.setTimeout(finish, 3500);
    store.getSession()
      .then((p) => {
        if (!alive) return;
        setProfile(p);
        if (p) setLang(p.preferred_language === "en" ? "en" : "sq");
      })
      .catch((e) => console.error("session restore failed", e))
      .finally(() => { window.clearTimeout(guard); finish(); });
    const off = store.onAuthChange((p) => {
      if (!alive) return;
      setProfile(p);
      if (p) setLang(p.preferred_language === "en" ? "en" : "sq");
    });
    return () => { alive = false; window.clearTimeout(guard); off(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  const dismissToast = useCallback((id: number) => setToasts((ts) => ts.filter((x) => x.id !== id)), []);
  const toast = useCallback((message: string, tone: ToastTone = "ok") => {
    const id = idRef.current++;
    setToasts((ts) => [...ts.slice(-2), { id, tone, message }]);
    window.setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 4200);
  }, []);

  const errText = useCallback((e: unknown, fallback: DictKey = "common.error"): string => {
    if (e instanceof AccountError) return t(ERR_KEYS[e.code] ?? fallback);
    if (e instanceof Error && e.message) return e.message;
    return t(fallback);
  }, [t]);

  const value = useMemo<AppCtx>(() => ({
    store,
    profile,
    ready,
    signIn: (email, pw) => store.signIn(email, pw).then((p) => { setProfile(p); return p; }),
    signUp: (email, pw, name) => store.signUp(email, pw, name).then((r) => { setProfile(r.profile); return r; }),
    signOut: () => store.signOut().then(() => setProfile(null)),
    updatePersonal: (patch) => store.updatePersonal(patch).then((p) => {
      setProfile(p);
      if (patch.preferred_language) setLang(patch.preferred_language as Lang);
      return p;
    }),
    uploadAvatar: (file) => store.uploadAvatar(file).then((p) => { setProfile(p); return p; }),
    removeAvatar: () => store.removeAvatar().then((p) => { setProfile(p); return p; }),
    changePassword: (current, next) => store.changePassword(current, next),
    toasts, toast, dismissToast, errText,
  }), [store, profile, ready, toasts, toast, dismissToast, errText, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const persistLangToProfile = useCallback((l: Lang) => {
    // persisted properly by the Settings page; the provider hook is immediate-UI only
    void l;
  }, []);
  return (
    <I18nProvider initial={readStoredLang()} onPersist={persistLangToProfile}>
      <InnerProvider>{children}</InnerProvider>
    </I18nProvider>
  );
}

export function useApp(): AppCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppProvider");
  return v;
}
