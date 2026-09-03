import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../lib/app";
import { useI18n, type Lang, type DictKey } from "../lib/lang";
import { AccountError } from "../lib/account";
import { AvatarUploader } from "../components/AvatarUploader";
import {
  Avatar, Badge, Button, Field, KV, LogoMark, PasswordInput, Reveal, Segmented, TextInput, cls,
  IUserIc, IIdCardIc, IGlobeIc, IKeyIc, ISlidersIc, ILockIc, ILogoutIc, ICheckIc, IAlertIc, IInfoIc, IEyeIc, IEyeOffIc, Spinner,
} from "../components/ui";

// ─── toast host ─────────────────────────────────────────────────────────────
function ToastHost() {
  const { toasts, dismissToast } = useApp();
  const icon = { ok: <ICheckIc size={15} />, bad: <IAlertIc size={15} />, info: <IInfoIc size={15} /> };
  const tone = {
    ok: "border-[#bfe3cf] bg-ok-soft text-ok",
    bad: "border-[#ecc9c9] bg-bad-soft text-bad",
    info: "border-primary-200 bg-primary-50 text-primary-700",
  };
  return (
    <div className="fixed bottom-5 right-5 z-[100] space-y-2.5 w-[min(92vw,360px)]">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismissToast(t.id)}
          className={cls("anim-toast w-full flex items-start gap-2.5 rounded-[10px] border px-4 py-3 shadow-lift text-left", tone[t.tone])}
        >
          <span className="mt-0.5 shrink-0">{icon[t.tone]}</span>
          <span className="text-[13px] font-semibold text-ink leading-snug">{t.message}</span>
        </button>
      ))}
    </div>
  );
}

// ─── top bar ────────────────────────────────────────────────────────────────
function TopBar() {
  const { profile, signOut, store } = useApp();
  const { t, lang, setLang } = useI18n();
  const nav = useNavigate();

  const onSignOut = async () => {
    await signOut();
    nav("/auth", { replace: true });
  };

  return (
    <header className="sticky top-0 z-40 bg-card/90 backdrop-blur border-b border-line">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-15 flex items-center justify-between gap-3" style={{ height: 60 }}>
        <div className="flex items-center gap-3">
          <LogoMark size={30} />
          <div className="leading-none">
            <p className="font-display font-bold text-[16px] text-ink">Stat<span className="text-primary-600">Lab</span></p>
            <p className="font-mono text-[8.5px] tracking-[0.22em] uppercase text-mute mt-1">{t("brand.tag")}</p>
          </div>
          {store.mode === "demo" && (
            <span className="ml-1 font-mono text-[9.5px] font-bold uppercase tracking-wider bg-warn-soft text-warn border border-[#e5d3a3] rounded px-1.5 py-0.5">
              {t("shell.demoMode")}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* quick language switch */}
          <div className="hidden sm:flex items-center rounded-lg border border-line bg-paper p-0.5">
            {(["sq", "en"] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                className={cls(
                  "px-2.5 h-7 rounded-md font-mono text-[10.5px] font-bold uppercase tracking-wider transition-all",
                  lang === l ? "bg-card text-primary-700 shadow-xs" : "text-mute hover:text-ink",
                )}
              >
                {l}
              </button>
            ))}
          </div>

          {profile && (
            <div className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-line">
              <Avatar name={profile.full_name || profile.email} url={profile.avatar_url} size={32} />
              <div className="hidden md:block leading-tight">
                <p className="text-[12.5px] font-bold text-ink max-w-[140px] truncate">{profile.full_name || "—"}</p>
                <p className="text-[10.5px] text-mute truncate max-w-[140px]">{profile.email}</p>
              </div>
              <button
                onClick={() => void onSignOut()}
                title={t("shell.signOut")}
                aria-label={t("shell.signOut")}
                className="w-8.5 h-8.5 rounded-lg flex items-center justify-center text-mute hover:text-bad hover:bg-bad-soft transition-colors"
                style={{ width: 34, height: 34 }}
              >
                <ILogoutIc size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ─── section shell ──────────────────────────────────────────────────────────
function Section({ id, icon, title, sub, children, delay = 0 }: {
  id: string; icon: React.ReactNode; title: string; sub: string; children: React.ReactNode; delay?: number;
}) {
  return (
    <Reveal delay={delay}>
      <section id={id} className="scroll-mt-24">
        <div className="flex items-center gap-2.5 mb-3.5">
          <span className="w-8 h-8 rounded-[9px] bg-primary-600 text-primary-50 flex items-center justify-center shadow-soft">{icon}</span>
          <div>
            <h2 className="font-display font-bold text-[17px] text-ink leading-tight">{title}</h2>
            <p className="text-[12px] text-mute">{sub}</p>
          </div>
        </div>
        {children}
      </section>
    </Reveal>
  );
}

// ─── password strength ──────────────────────────────────────────────────────
function strengthOf(pw: string): number {
  if (!pw) return -1;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}
const STRENGTH_COLORS = ["#bc4242", "#bc4242", "#c98d08", "#177a48", "#177a48"];

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function SettingsPage() {
  const { profile, updatePersonal, changePassword, toast, errText } = useApp();
  const { t, lang, setLang } = useI18n();

  // profile form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [profDirty, setProfDirty] = useState(false);
  const [profBusy, setProfBusy] = useState(false);
  const [nameErr, setNameErr] = useState("");

  // password form
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confPw, setConfPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwErr, setPwErr] = useState<{ field?: "cur" | "new" | "conf" | "form"; text: string } | null>(null);
  const [pwOk, setPwOk] = useState(false);

  // platform settings (admin-only, read-only)
  const [platform, setPlatform] = useState<Record<string, number> | null>(null);
  const [platformLoaded, setPlatformLoaded] = useState(false);

  // language persistence
  const [langBusy, setLangBusy] = useState(false);

  // scroll-spy nav
  const [active, setActive] = useState("profile");
  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
  const sectionIds = isAdmin ? ["profile", "account", "language", "security", "platform"] : ["profile", "account", "language", "security"];

  useEffect(() => {
    if (profile) {
      setName(profile.full_name);
      setPhone(profile.phone);
      setProfDirty(false);
    }
  }, [profile?.id, profile?.full_name, profile?.phone]);

  useEffect(() => {
    const els = sectionIds.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-30% 0px -55% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [isAdmin, profile?.id]);

  const { store } = useApp();
  useEffect(() => {
    if (isAdmin) {
      void store.getPlatformSettings().then((s) => { setPlatform(s); setPlatformLoaded(true); });
    }
  }, [isAdmin, store]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setNameErr(t("prof.errName")); return; }
    setNameErr("");
    setProfBusy(true);
    try {
      await updatePersonal({ full_name: name.trim(), phone: phone.trim() });
      setProfDirty(false);
      toast(t("prof.saved"), "ok");
    } catch (err) {
      toast(err instanceof AccountError ? errText(err) : t("common.error"), "bad");
    } finally {
      setProfBusy(false);
    }
  };

  const onLang = async (l: Lang) => {
    setLang(l); // instant UI
    setLangBusy(true);
    try {
      await updatePersonal({ preferred_language: l });
      toast(t("lang.saved"), "ok");
    } catch (err) {
      console.error("language persist failed", err);
      toast(err instanceof AccountError ? errText(err) : t("common.error"), "bad");
    } finally {
      setLangBusy(false);
    }
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwErr(null);
    setPwOk(false);
    if (!curPw) { setPwErr({ field: "cur", text: t("sec.errCurrent") }); return; }
    if (newPw.length < 8) { setPwErr({ field: "new", text: t("sec.errShort") }); return; }
    if (newPw !== confPw) { setPwErr({ field: "conf", text: t("sec.errMismatch") }); return; }
    setPwBusy(true);
    try {
      await changePassword(curPw, newPw);
      setPwOk(true);
      setCurPw(""); setNewPw(""); setConfPw("");
      toast(t("sec.ok"), "ok");
    } catch (err) {
      const code = err instanceof AccountError ? err.code : "ERR_GENERIC";
      if (code === "ERR_WRONG_CURRENT") setPwErr({ field: "cur", text: t("sec.errWrongCurrent") });
      else if (code === "ERR_PW_WEAK") setPwErr({ field: "new", text: t("sec.errShort") });
      else setPwErr({ field: "form", text: errText(err) });
    } finally {
      setPwBusy(false);
    }
  };

  const [uidShown, setUidShown] = useState(false);

  if (!profile) return null;

  const strength = strengthOf(newPw);
  const memberSince = (() => {
    try {
      return new Intl.DateTimeFormat(lang === "sq" ? "sq-AL" : "en-GB", { dateStyle: "medium" }).format(new Date(profile.created_at));
    } catch {
      return profile.created_at.slice(0, 10);
    }
  })();

  const navItems: { id: string; label: DictKey; icon: React.ReactNode }[] = [
    { id: "profile", label: "set.nav.profile", icon: <IUserIc size={15} /> },
    { id: "account", label: "set.nav.account", icon: <IIdCardIc size={15} /> },
    { id: "language", label: "set.nav.language", icon: <IGlobeIc size={15} /> },
    { id: "security", label: "set.nav.security", icon: <IKeyIc size={15} /> },
    ...(isAdmin ? [{ id: "platform", label: "set.nav.platform" as DictKey, icon: <ISlidersIc size={15} /> }] : []),
  ];

  const roleTone = { client: "info", consultant: "teal", admin: "warn", super_admin: "dark" } as const;

  return (
    <div className="min-h-screen bg-paper bg-ambient">
      <div className="min-h-screen bg-graph">
        <TopBar />

        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          {/* page header */}
          <div className="anim-fade-up mb-8">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-primary-600 mb-2">StatLab · {t("shell.settings")}</p>
            <h1 className="font-display text-[28px] sm:text-[32px] font-bold tracking-tight text-ink">{t("set.title")}</h1>
            <p className="text-[13.5px] text-mute mt-1.5 max-w-xl">{t("set.sub")}</p>
          </div>

          <div className="grid lg:grid-cols-[218px_1fr] gap-8 items-start">
            {/* ── left rail / mobile tabs ── */}
            <nav className="lg:sticky lg:top-[84px] anim-fade-up" aria-label={t("set.title")}>
              <div className="flex lg:flex-col gap-1 overflow-x-auto no-scrollbar pb-1 lg:pb-0">
                {navItems.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className={cls(
                      "relative flex items-center gap-2.5 px-3.5 h-10 rounded-[9px] text-[13px] font-bold whitespace-nowrap transition-all duration-150",
                      active === item.id
                        ? "bg-card text-primary-700 shadow-soft border border-line"
                        : "text-mute hover:text-ink hover:bg-card/70 border border-transparent",
                    )}
                  >
                    <span
                      className={cls(
                        "absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-full bg-primary-600 transition-all duration-200",
                        active === item.id ? "opacity-100 scale-y-100" : "opacity-0 scale-y-50",
                      )}
                    />
                    <span className={cls("transition-colors", active === item.id ? "text-primary-600" : "text-mute")}>{item.icon}</span>
                    {t(item.label)}
                    {item.id === "platform" && <ILockIc size={12} className="text-mute ml-auto" />}
                  </a>
                ))}
              </div>

              {/* identity mini-card */}
              <div className="hidden lg:block card p-4 mt-5">
                <div className="flex items-center gap-3">
                  <Avatar name={profile.full_name || profile.email} url={profile.avatar_url} size={40} />
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-ink truncate">{profile.full_name || "—"}</p>
                    <Badge tone={roleTone[profile.role]} className="mt-1">{t(`role.${profile.role}` as DictKey)}</Badge>
                  </div>
                </div>
              </div>
            </nav>

            {/* ── content ── */}
            <div className="space-y-10 min-w-0">
              {/* PROFILE */}
              <Section id="profile" icon={<IUserIc size={15} />} title={t("prof.title")} sub={t("prof.sub")}>
                <div className="card p-5 sm:p-6 mb-4">
                  <AvatarUploader />
                  <div className="mt-5 pt-5 border-t border-line flex flex-wrap items-center gap-x-6 gap-y-2">
                    <div>
                      <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-mute">{t("prof.fullName")}</p>
                      <p className="text-[14.5px] font-bold text-ink mt-0.5">{profile.full_name || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-mute">{t("acc.role")}</p>
                      <div className="mt-1"><Badge tone={roleTone[profile.role]}>{t(`role.${profile.role}` as DictKey)}</Badge></div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-mute">{t("acc.email")}</p>
                      <p className="text-[13px] font-semibold text-ink-2 mt-0.5 truncate max-w-[260px]">{profile.email}</p>
                    </div>
                  </div>
                </div>
                <form onSubmit={saveProfile} className="card p-5 sm:p-6">
                  <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-mute mb-4">{t("prof.personal")}</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label={t("prof.fullName")} required error={nameErr || undefined}>
                      <TextInput value={name} onChange={(e) => { setName(e.target.value); setProfDirty(true); setNameErr(""); }} placeholder={t("prof.fullName")} />
                    </Field>
                    <Field label={t("prof.phone")} hint={t("prof.phoneHint")}>
                      <TextInput value={phone} onChange={(e) => { setPhone(e.target.value); setProfDirty(true); }} placeholder="+383…" inputMode="tel" />
                    </Field>
                  </div>
                  <div className="flex items-center gap-3 mt-5">
                    <Button type="submit" loading={profBusy} disabled={!profDirty && !nameErr}>
                      <ICheckIc size={14} /> {profBusy ? t("prof.saving") : t("prof.save")}
                    </Button>
                    {profDirty && !profBusy && (
                      <span className="text-[12px] font-semibold text-warn flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-warn pulse-dot" />
                        {lang === "sq" ? "Ndryshime të paruajtura" : "Unsaved changes"}
                      </span>
                    )}
                  </div>
                </form>
              </Section>

              {/* ACCOUNT */}
              <Section id="account" icon={<IIdCardIc size={15} />} title={t("acc.title")} sub={t("acc.sub")} delay={60}>
                <div className="card p-5 sm:p-6">
                  <Field label={t("acc.email")} hint={t("acc.emailHint")}>
                    <div className="flex items-center gap-2.5">
                      <TextInput value={profile.email} readOnly className="!bg-paper !text-mute cursor-not-allowed" />
                      <span className="shrink-0"><Badge tone="mute"><ILockIc size={11} /> Auth</Badge></span>
                    </div>
                  </Field>
                  <div className="mt-4">
                    <Field label={t("acc.role")} hint={t("acc.roleHint")}>
                      <div>
                        <Badge tone={roleTone[profile.role]} className="!text-[12px] !px-3 !py-1.5">
                          {t(`role.${profile.role}` as DictKey)}
                        </Badge>
                      </div>
                    </Field>
                  </div>

                  <div className="mt-5 pt-5 border-t border-line grid sm:grid-cols-2 gap-x-8">
                    <KV k={t("acc.type")} v={t(`role.${profile.role}` as DictKey)} />
                    <KV k={t("acc.memberSince")} v={memberSince} />
                    <KV k={t("acc.status")} v={<Badge tone={profile.status === "active" ? "ok" : "bad"}>{t("acc.active")}</Badge>} />
                    <KV
                      k={t("acc.uid")}
                      v={
                        <span className="inline-flex items-center gap-1.5">
                          <span className="font-mono text-[11.5px]">{uidShown ? profile.id : `•••• •••• ${profile.id.slice(-4)}`}</span>
                          <button
                            onClick={() => setUidShown(!uidShown)}
                            aria-label={t("acc.uidHint")}
                            className="text-mute hover:text-ink transition-colors"
                          >
                            {uidShown ? <IEyeOffIc size={13} /> : <IEyeIc size={13} />}
                          </button>
                        </span>
                      }
                    />
                  </div>
                  <p className="text-[11.5px] text-mute mt-3">{t("acc.uidHint")}</p>
                </div>
              </Section>

              {/* LANGUAGE */}
              <Section id="language" icon={<IGlobeIc size={15} />} title={t("lang.title")} sub={t("lang.sub")} delay={60}>
                <div className="card p-5 sm:p-6">
                  <Field label={t("lang.label")} hint={t("lang.hint")}>
                    <div className="flex items-center gap-3">
                      <Segmented
                        options={[
                          { value: "sq" as Lang, label: "Shqip" },
                          { value: "en" as Lang, label: "English" },
                        ]}
                        value={lang}
                        onChange={(l) => void onLang(l)}
                        className="w-full sm:w-auto sm:min-w-[260px]"
                      />
                      {langBusy && <Spinner size={15} className="text-primary-600" />}
                    </div>
                  </Field>
                </div>
              </Section>

              {/* SECURITY */}
              <Section id="security" icon={<IKeyIc size={15} />} title={t("sec.title")} sub={t("sec.sub")} delay={60}>
                <form onSubmit={submitPassword} className="card p-5 sm:p-6">
                  <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-mute mb-4">{t("sec.changePw")}</p>
                  <div className="space-y-4 max-w-md">
                    <Field label={t("sec.current")} required error={pwErr?.field === "cur" ? pwErr.text : undefined}>
                      <PasswordInput value={curPw} onChange={(v) => { setCurPw(v); setPwErr(null); setPwOk(false); }} placeholder="••••••••" autoComplete="current-password" invalid={pwErr?.field === "cur"} />
                    </Field>
                    <Field label={t("sec.new")} required hint={t("sec.newHint")} error={pwErr?.field === "new" ? pwErr.text : undefined}>
                      <PasswordInput value={newPw} onChange={(v) => { setNewPw(v); setPwErr(null); setPwOk(false); }} placeholder="••••••••" autoComplete="new-password" invalid={pwErr?.field === "new"} />
                      {strength >= 0 && (
                        <div className="mt-2">
                          <div className="flex gap-1">
                            {[0, 1, 2, 3].map((i) => (
                              <span
                                key={i}
                                className="h-1 flex-1 rounded-full transition-all duration-300"
                                style={{ background: i <= strength ? STRENGTH_COLORS[strength] : "#e4e9f2" }}
                              />
                            ))}
                          </div>
                          <p className="text-[11px] font-semibold mt-1" style={{ color: STRENGTH_COLORS[strength] }}>
                            {t("sec.strength")}: {t(`sec.strength.${strength}` as DictKey)}
                          </p>
                        </div>
                      )}
                    </Field>
                    <Field label={t("sec.confirmNew")} required error={pwErr?.field === "conf" ? pwErr.text : undefined}>
                      <PasswordInput value={confPw} onChange={(v) => { setConfPw(v); setPwErr(null); setPwOk(false); }} placeholder="••••••••" autoComplete="new-password" invalid={pwErr?.field === "conf"} />
                    </Field>

                    {pwErr?.field === "form" && (
                      <p className="text-[12.5px] font-semibold text-bad bg-bad-soft border border-[#ecc9c9] rounded-[9px] px-3.5 py-2.5 anim-shake">{pwErr.text}</p>
                    )}
                    {pwOk && (
                      <p className="text-[12.5px] font-semibold text-ok bg-ok-soft border border-[#bfe3cf] rounded-[9px] px-3.5 py-2.5 flex items-center gap-2 anim-fade-in">
                        <ICheckIc size={14} /> {t("sec.ok")}
                      </p>
                    )}

                    <Button type="submit" loading={pwBusy} disabled={!curPw && !newPw && !confPw}>
                      <IKeyIc size={14} /> {pwBusy ? t("sec.submitting") : t("sec.submit")}
                    </Button>
                  </div>
                </form>
              </Section>

              {/* PLATFORM — admin / super_admin only, read-only */}
              {isAdmin && (
                <Section id="platform" icon={<ISlidersIc size={15} />} title={t("plat.title")} sub={t("plat.sub")} delay={60}>
                  <div className="card p-5 sm:p-6">
                    <div className="flex items-start gap-3 rounded-[10px] border border-[#e5d3a3] bg-warn-soft px-4 py-3 mb-5">
                      <ILockIc size={16} className="text-warn shrink-0 mt-0.5" />
                      <p className="text-[12.5px] font-semibold text-warn leading-relaxed">{t("plat.lock")}</p>
                    </div>

                    {!platformLoaded ? (
                      <div className="flex items-center gap-2.5 text-mute text-[13px] py-6 justify-center">
                        <Spinner size={16} /> {t("common.loading")}
                      </div>
                    ) : !platform ? (
                      <p className="text-[13px] text-mute py-4 text-center">{t("plat.unavailable")}</p>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-6">
                        <div>
                          <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-mute mb-3">{t("plat.booking")}</p>
                          <KV k={t("plat.minCancel")} v={<span className="font-mono">{platform.min_cancel_hours}h</span>} />
                          <KV k={t("plat.minReschedule")} v={<span className="font-mono">{platform.min_reschedule_hours}h</span>} />
                          <KV k={t("plat.buffer")} v={<span className="font-mono">{platform.buffer_minutes} min</span>} />
                          <KV k={t("plat.horizon")} v={<span className="font-mono">{platform.max_booking_days} {lang === "sq" ? "ditë" : "days"}</span>} />
                        </div>
                        <div>
                          <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-mute mb-3">{t("plat.finance")}</p>
                          <KV k={t("plat.tax")} v={<span className="font-mono">{platform.tax_rate}%</span>} />
                          <KV k={t("plat.commission")} v={<span className="font-mono">{platform.default_commission}%</span>} />
                        </div>
                      </div>
                    )}
                  </div>
                </Section>
              )}
            </div>
          </div>
        </main>

        <footer className="border-t border-line mt-14">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11.5px] text-mute">
            <span>© {new Date().getFullYear()} StatLab</span>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em]">RLS · {t("auth.trust2")} · GDPR</span>
          </div>
        </footer>

        <ToastHost />
      </div>
    </div>
  );
}
