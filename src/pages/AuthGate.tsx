import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../lib/app";
import { useI18n } from "../lib/lang";
import { SUPABASE_CONFIGURED } from "../lib/supabase";
import { AccountError } from "../lib/account";
import { Button, Field, TextInput, PasswordInput, LogoMark, IShieldIc, Spinner, cls } from "../components/ui";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function BrandPanel() {
  // deterministic scatter + OLS line — the subject's signature, not decoration
  const pts = useMemo(() => {
    const raw: [number, number][] = [];
    let s = 11;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 22; i++) {
      const x = 8 + i * 4.2 + rnd() * 10;
      raw.push([x, 14 + x * 0.6 + (rnd() - 0.5) * 20]);
    }
    return raw;
  }, []);
  const W = 340, H = 170;
  const sx = (x: number) => 16 + (x / 120) * (W - 32);
  const sy = (y: number) => H - 16 - (y / 95) * (H - 32);

  return (
    <div className="relative hidden lg:flex flex-col justify-between bg-ink text-paper p-10 overflow-hidden">
      <div className="absolute inset-0 bg-graph-dark opacity-70" />
      <div className="absolute inset-0" style={{ background: "radial-gradient(700px 420px at 20% 0%, rgb(47 87 228 / 0.22), transparent 60%)" }} />

      <div className="relative flex items-center gap-3">
        <LogoMark size={34} />
        <div>
          <p className="font-display font-bold text-xl leading-none">Stat<span className="text-primary-300">Lab</span></p>
          <p className="font-mono text-[9.5px] tracking-[0.24em] uppercase text-paper/45 mt-1">SPSS Consulting</p>
        </div>
      </div>

      <div className="relative">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary-300 mb-4">— {"StatLab"}</p>
        <BrandHeading />
        <BrandSub />

        <div className="mt-8 card !bg-paper/[0.05] !border-paper/12 !rounded-xl p-4 max-w-sm backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-paper/50">n = 22 · OLS</span>
            <span className="flex items-center gap-1.5 text-[10.5px] font-bold text-[#7ee2a8]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#7ee2a8] pulse-dot" /> p &lt; .001
            </span>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
            {Array.from({ length: 4 }).map((_, i) => (
              <line key={i} x1={16} x2={W - 16} y1={18 + i * ((H - 36) / 3)} y2={18 + i * ((H - 36) / 3)} stroke="rgb(255 255 255 / 0.08)" strokeWidth="1" />
            ))}
            {pts.map(([x, y], i) => (
              <circle key={i} cx={sx(x)} cy={sy(y)} r="3" fill="#8fabf7" className="drift-dot" style={{ animationDelay: `${(i % 6) * 0.35}s` }} />
            ))}
            <line x1={sx(6)} y1={sy(14 + 6 * 0.6)} x2={sx(114)} y2={sy(14 + 114 * 0.6)} stroke="#e5b452" strokeWidth="2.4" strokeLinecap="round" className="regression-line" />
          </svg>
        </div>
      </div>

      <BrandTrust />
    </div>
  );
}
function BrandHeading() {
  const { t } = useI18n();
  return <h1 className="relative font-display text-[34px] leading-[1.08] font-bold tracking-tight max-w-md">{t("auth.title")}</h1>;
}
function BrandSub() {
  const { t } = useI18n();
  return <p className="relative text-paper/60 mt-3 max-w-sm text-[14px] leading-relaxed">{t("auth.sub")}</p>;
}
function BrandTrust() {
  const { t } = useI18n();
  return (
    <div className="relative flex flex-wrap gap-2">
      {(["auth.trust1", "auth.trust2", "auth.trust3"] as const).map((k) => (
        <span key={k} className="text-[11.5px] font-semibold bg-paper/8 border border-paper/15 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
          <IShieldIc size={12} className="text-primary-300" /> {t(k)}
        </span>
      ))}
    </div>
  );
}

export default function AuthGate() {
  const { signIn, signUp, store, toast, errText } = useApp();
  const { t } = useI18n();
  const nav = useNavigate();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ field?: "name" | "email" | "pw" | "pw2" | "form"; text: string } | null>(null);

  const validate = (): boolean => {
    if (mode === "register" && !name.trim()) { setErr({ field: "name", text: t("auth.err.name") }); return false; }
    if (!EMAIL_RE.test(email.trim())) { setErr({ field: "email", text: t("auth.err.email") }); return false; }
    if (pw.length < 8) { setErr({ field: "pw", text: t("auth.err.pwShort") }); return false; }
    if (mode === "register" && pw !== pw2) { setErr({ field: "pw2", text: t("auth.err.mismatch") }); return false; }
    return true;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!validate()) return;
    setBusy(true);
    try {
      if (mode === "login") {
        const p = await signIn(email, pw);
        toast(`${p.full_name || p.email} ✓`, "ok");
        nav("/settings", { replace: true });
      } else {
        const res = await signUp(email, pw, name.trim());
        if (res.needsConfirmation) {
          setErr({ field: "form", text: t("auth.err.confirmEmail") });
        } else {
          nav("/settings", { replace: true });
        }
      }
    } catch (ex) {
      console.error("auth failed", ex);
      const code = ex instanceof AccountError ? ex.code : "ERR_GENERIC";
      if (code === "ERR_INVALID_CREDENTIALS") setErr({ field: "form", text: t("auth.err.invalid") });
      else if (code === "ERR_EXISTS") setErr({ field: "email", text: t("auth.err.email") + " — " + t("auth.haveAccount") });
      else setErr({ field: "form", text: errText(ex) });
    } finally {
      setBusy(false);
    }
  };

  const enterDemo = async () => {
    setBusy(true);
    try {
      await signIn("klient@demo.statlab", "demo1234");
      nav("/settings", { replace: true });
    } catch {
      toast(t("common.error"), "bad");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1fr_1fr] bg-paper">
      <BrandPanel />

      <div className="flex items-center justify-center p-6 sm:p-10 bg-ambient bg-graph">
        <div className="w-full max-w-[400px] anim-fade-up">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <LogoMark size={32} />
            <div>
              <p className="font-display font-bold text-lg leading-none text-ink">Stat<span className="text-primary-600">Lab</span></p>
              <p className="font-mono text-[9px] tracking-[0.22em] uppercase text-mute mt-0.5">{t("brand.tag")}</p>
            </div>
          </div>

          <h2 className="font-display text-[26px] font-bold tracking-tight text-ink">
            {mode === "login" ? t("auth.loginTitle") : t("auth.registerTitle")}
          </h2>
          <p className="text-[13.5px] text-mute mt-1.5">
            {mode === "login" ? t("auth.loginSub") : t("auth.registerSub")}
          </p>

          {/* mode switch */}
          <div className="mt-6 grid grid-cols-2 p-1 rounded-[10px] bg-[#e9edf5] border border-line gap-1">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setErr(null); }}
                className={cls(
                  "h-9 rounded-lg text-[13px] font-bold transition-all duration-150",
                  mode === m ? "bg-card text-primary-700 shadow-soft" : "text-mute hover:text-ink",
                )}
              >
                {m === "login" ? t("auth.signIn") : t("auth.signUp")}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            {mode === "register" && (
              <Field label={t("auth.fullName")} required error={err?.field === "name" ? err.text : undefined}>
                <TextInput
                  value={name}
                  onChange={(e) => { setName(e.target.value); setErr(null); }}
                  placeholder="Rame Hajraj"
                  autoComplete="name"
                />
              </Field>
            )}
            <Field label={t("auth.email")} required error={err?.field === "email" ? err.text : undefined}>
              <TextInput
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErr(null); }}
                placeholder="ju@email.com"
                autoComplete="email"
              />
            </Field>
            <Field label={t("auth.password")} required error={err?.field === "pw" ? err.text : undefined} hint={mode === "register" ? t("sec.newHint") : undefined}>
              <PasswordInput value={pw} onChange={(v) => { setPw(v); setErr(null); }} placeholder="••••••••" autoComplete={mode === "login" ? "current-password" : "new-password"} invalid={err?.field === "pw"} />
            </Field>
            {mode === "register" && (
              <Field label={t("auth.confirm")} required error={err?.field === "pw2" ? err.text : undefined}>
                <PasswordInput value={pw2} onChange={(v) => { setPw2(v); setErr(null); }} placeholder="••••••••" autoComplete="new-password" invalid={err?.field === "pw2"} />
              </Field>
            )}

            {err?.field === "form" && (
              <p className="text-[12.5px] font-semibold text-bad bg-bad-soft border border-[#ecc9c9] rounded-[9px] px-3.5 py-2.5 anim-shake">
                {err.text}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full" loading={busy}>
              {mode === "login" ? t("auth.login") : t("auth.create")}
            </Button>
          </form>

          <p className="text-center text-[12.5px] text-mute mt-5">
            {mode === "login" ? (
              <button onClick={() => { setMode("register"); setErr(null); }} className="font-bold text-primary-700 hover:text-primary-800 transition-colors">
                {t("auth.noAccount")}
              </button>
            ) : (
              <button onClick={() => { setMode("login"); setErr(null); }} className="font-bold text-primary-700 hover:text-primary-800 transition-colors">
                {t("auth.haveAccount")}
              </button>
            )}
          </p>

          {/* demo workspace — clearly labelled, only a fallback path */}
          <div className="mt-8 pt-6 border-t border-line">
            <button
              onClick={() => void enterDemo()}
              disabled={busy}
              className="w-full flex items-center justify-between gap-3 rounded-[10px] border border-dashed border-line-2 bg-card/60 px-4 py-3 hover:border-primary-300 hover:bg-primary-50/40 transition-all group disabled:opacity-50"
            >
              <span className="text-left">
                <span className="flex items-center gap-2 text-[13px] font-bold text-ink group-hover:text-primary-700 transition-colors">
                  {t("auth.demo")}
                  <span className="font-mono text-[9.5px] font-bold uppercase tracking-wider bg-warn-soft text-warn rounded px-1.5 py-0.5">{t("shell.demoMode")}</span>
                </span>
                <span className="block text-[11.5px] text-mute mt-0.5">{t("auth.demoHint")}</span>
              </span>
              {busy ? <Spinner size={15} className="text-mute" /> : <span className="text-primary-600 font-bold text-lg leading-none transition-transform group-hover:translate-x-0.5">→</span>}
            </button>
            {!SUPABASE_CONFIGURED && store.mode === "demo" && (
              <p className="text-center font-mono text-[10px] uppercase tracking-[0.18em] text-warn mt-3">
                Supabase env not set — demo workspace active
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
