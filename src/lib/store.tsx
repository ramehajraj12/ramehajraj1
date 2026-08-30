import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { Session, User, Role, Lang } from "../types";
import { getSession as readSession, subscribe } from "./db";
import { translate } from "./i18n";

interface Toast { id: number; message: string; tone: "ok" | "bad" | "info"; }

interface AppCtx {
  session: Session | null;
  user: User | null;
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  tick: number; // bumps on every db mutation → re-render data views
  toast: (message: string, tone?: Toast["tone"]) => void;
  toasts: Toast[];
  dismissToast: (id: number) => void;
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(() => readSession());
  const [tick, setTick] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = localStorage.getItem("statlab_lang") as Lang | null;
    return stored && ["sq", "de", "en"].includes(stored) ? stored : (readSession()?.user.preferred_language ?? "sq");
  });

  useEffect(() => subscribe(() => {
    setSessionState(readSession());
    setTick((t) => t + 1);
  }), []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem("statlab_lang", l);
  }, []);

  const t = useCallback((key: string) => translate(lang, key), [lang]);

  const dismissToast = useCallback((id: number) => setToasts((ts) => ts.filter((x) => x.id !== id)), []);
  const toast = useCallback((message: string, tone: Toast["tone"] = "ok") => {
    const id = idRef.current++;
    setToasts((ts) => [...ts.slice(-3), { id, message, tone }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 4200);
  }, []);

  return (
    <Ctx.Provider value={{ session, user: session?.user ?? null, lang, setLang, t, tick, toast, toasts, dismissToast }}>
      {children}
    </Ctx.Provider>
  );
}

export function useApp(): AppCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppProvider");
  return v;
}

/** Data-loading hook with loading / error / retry — every list view uses it. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): {
  data: T | null; loading: boolean; error: string | null; retry: () => void;
} {
  const { tick } = useApp();
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null }>({ data: null, loading: true, error: null });
  const [nonce, setNonce] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fnRef.current()
      .then((data) => { if (alive) setState({ data, loading: false, error: null }); })
      .catch((e: unknown) => { if (alive) setState({ data: null, loading: false, error: e instanceof Error ? e.message : "Gabim i panjohur." }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, nonce]);
  const retry = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, retry };
}

export function RequireRole({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user } = useApp();
  const loc = useLocation();
  if (!user) return <Navigate to="/auth" state={{ from: loc.pathname }} replace />;
  if (user.role !== "super_admin" && !roles.includes(user.role)) return <Navigate to={homeForRole(user.role)} replace />;
  return <>{children}</>;
}

export function homeForRole(role: Role | undefined): string {
  switch (role) {
    case "admin":
    case "super_admin": return "/admin";
    case "consultant": return "/consultant";
    case "client": return "/client";
    default: return "/";
  }
}
