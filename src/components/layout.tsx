import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useApp, useAsync } from "../lib/store";
import { listNotifications, logout } from "../lib/services";
import { NOTIF_LABEL } from "../lib/i18n";
import { relativeTime, cls, fmtDateTime } from "../lib/utils";
import { Avatar, Badge, Menu } from "./ui";
import { LogoMark, IBell2, IMenu, IX, ILogout, IChevD, IGlobe, IMail, IGrid, IUser, ISettings, ICheck } from "./icons";
import type { Lang } from "../types";

// ─── Language switch ──────────────────────────────────────────────────────────
export function LangSwitch({ compact }: { compact?: boolean }) {
  const { lang, setLang } = useApp();
  const [open, setOpen] = useState(false);
  const langs: { code: Lang; label: string; flag: string }[] = [
    { code: "sq", label: "Shqip", flag: "SQ" },
    { code: "de", label: "Deutsch", flag: "DE" },
    { code: "en", label: "English", flag: "EN" },
  ];
  const cur = langs.find((l) => l.code === lang)!;
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} aria-label="Ndrysho gjuhën"
        className={cls("flex items-center gap-1.5 text-[13px] font-semibold text-ink-2 hover:text-primary-700 rounded-lg px-2 py-1.5 hover:bg-primary-50 transition-colors", compact && "px-1.5")}>
        <IGlobe size={15} />
        <span className="font-mono text-[10.5px] tracking-wider">{cur.flag}</span>
        {!compact && <IChevD size={12} />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1.5 bg-card border border-line rounded-xl shadow-pop py-1.5 w-40 z-50 anim-scale-in">
            {langs.map((l) => (
              <button key={l.code} onClick={() => { setLang(l.code); setOpen(false); }}
                className={cls("w-full text-left px-3.5 h-9 text-[13px] font-semibold hover:bg-paper flex items-center justify-between transition-colors",
                  lang === l.code ? "text-primary-700" : "text-ink-2")}>
                {l.label}
                {lang === l.code ? <ICheck size={13} /> : <span className="font-mono text-[10px] text-mute">{l.flag}</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function Logo({ dark }: { dark?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 group" aria-label="StatLab — faqja kryesore">
      <span className="transition-transform duration-200 group-hover:scale-105 group-hover:-rotate-3">
        <LogoMark />
      </span>
      <span className={cls("font-display font-bold text-[18px] tracking-tight leading-none", dark ? "text-paper" : "text-ink")}>
        Stat<span className="text-primary-500">Lab</span>
        <span className={cls("block text-[8.5px] font-mono tracking-[0.24em] uppercase mt-[3px] font-medium", dark ? "text-paper/45" : "text-mute/80")}>SPSS Consulting</span>
      </span>
    </Link>
  );
}

// ─── Public header ────────────────────────────────────────────────────────────
const ROLE_LABEL: Record<string, string> = {
  client: "Klient", consultant: "Konsulent", admin: "Administrator", super_admin: "Super Administrator",
};

function UserMenu() {
  const { user, t } = useApp();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  if (!user) {
    return (
      <div className="flex items-center gap-2.5">
        <Link to="/auth" className="h-9 px-3.5 inline-flex items-center rounded-[10px] text-[13.5px] font-semibold text-ink-2 hover:text-primary-700 hover:bg-primary-50 transition-colors">{t("nav.login")}</Link>
        <Link to="/rezervo" className="h-9 px-4 inline-flex items-center rounded-[10px] bg-primary-600 text-primary-50 text-[13.5px] font-semibold hover:bg-primary-700 hover:-translate-y-px transition-all shadow-[0_8px_20px_-8px_rgb(21_52_158/0.5)]">{t("nav.book")}</Link>
      </div>
    );
  }
  const portal = user.role === "admin" || user.role === "super_admin" ? "/admin" : user.role === "consultant" ? "/consultant" : "/client";
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} aria-label="Menuja e llogarisë" className="flex items-center gap-2 rounded-full p-0.5 pr-1 hover:bg-ink/[0.04] transition-colors">
        <Avatar name={user.full_name} size={30} />
        <IChevD size={12} className={cls("text-mute transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 bg-card border border-line rounded-xl shadow-pop py-1.5 w-60 z-50 anim-scale-in">
            <div className="px-3.5 py-2.5 border-b border-line">
              <p className="text-[13px] font-bold text-ink truncate">{user.full_name}</p>
              <p className="text-[11px] text-mute truncate">{user.email}</p>
              <Badge tone="info" className="mt-1.5">{ROLE_LABEL[user.role] ?? user.role}</Badge>
            </div>
            <button onClick={() => { setOpen(false); nav(portal); }} className="w-full text-left px-3.5 h-9 text-[13px] font-semibold text-ink-2 hover:bg-paper hover:text-ink transition-colors">{t("nav.portal")}</button>
            <button onClick={() => { setOpen(false); nav("/settings"); }} className="w-full text-left px-3.5 h-9 text-[13px] font-semibold text-ink-2 hover:bg-paper hover:text-ink transition-colors flex items-center gap-2"><ISettings size={14} /> Cilësimet</button>
            <button onClick={() => { logout(); nav("/"); }} className="w-full text-left px-3.5 h-9 text-[13px] font-semibold text-bad hover:bg-bad-soft flex items-center gap-2 transition-colors"><ILogout size={14} /> {t("portal.logout")}</button>
          </div>
        </>
      )}
    </div>
  );
}

export function PublicHeader() {
  const { t, user } = useApp();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8);
    fn();
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  useEffect(() => setMobileOpen(false), [loc.pathname]);

  const portal = user ? (user.role === "admin" || user.role === "super_admin" ? "/admin" : user.role === "consultant" ? "/consultant" : "/client") : null;
  const links = [
    { to: "/#sherbimet", label: t("nav.services") },
    { to: "/konsulentet", label: t("nav.consultants") },
    { to: "/#si-funksionon", label: t("nav.how") },
    { to: "/#faq", label: t("nav.faq") },
    { to: "/behu-konsulent", label: t("nav.become") },
  ];
  return (
    <header className={cls("sticky top-0 z-40 transition-all duration-300 border-b",
      scrolled ? "bg-card/90 backdrop-blur-md border-line shadow-xs" : "bg-transparent border-transparent")}>
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Logo />
        <nav className="hidden lg:flex items-center gap-0.5" aria-label="Navigimi kryesor">
          {links.map((l) => (
            <Link key={l.to} to={l.to}
              className="navlink px-3 py-2 rounded-lg text-[13.5px] font-semibold text-ink-2 hover:text-ink transition-colors">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-3">
          <LangSwitch />
          <span className="w-px h-5 bg-line" aria-hidden="true" />
          {portal ? (
            <div className="flex items-center gap-2.5">
              <Link to={portal} className="h-9 px-4 inline-flex items-center rounded-[10px] bg-ink text-paper text-[13.5px] font-semibold hover:bg-primary-900 hover:-translate-y-px transition-all">{t("nav.portal")}</Link>
              <UserMenu />
            </div>
          ) : (
            <>
              <Link to="/auth" className="h-9 px-3.5 inline-flex items-center rounded-[10px] text-[13.5px] font-semibold text-ink-2 hover:bg-primary-50 hover:text-primary-700 transition-colors">{t("nav.login")}</Link>
              <Link to="/rezervo" className="h-9 px-4 inline-flex items-center rounded-[10px] bg-primary-600 text-primary-50 text-[13.5px] font-semibold hover:bg-primary-700 hover:-translate-y-px transition-all shadow-[0_8px_20px_-8px_rgb(21_52_158/0.5)]">{t("nav.book")}</Link>
            </>
          )}
        </div>
        <button className="md:hidden w-10 h-10 rounded-lg hover:bg-ink/[0.04] flex items-center justify-center text-ink transition-colors" onClick={() => setMobileOpen(!mobileOpen)} aria-label={mobileOpen ? "Mbyll menunë" : "Hap menunë"}>
          {mobileOpen ? <IX size={20} /> : <IMenu size={20} />}
        </button>
      </div>
      {mobileOpen && (
        <div className="md:hidden border-t border-line bg-card px-4 pt-3 pb-5 anim-fade-in shadow-lift">
          <nav className="space-y-0.5" aria-label="Navigimi mobil">
            {links.map((l) => (
              <Link key={l.to} to={l.to} className="block px-3 py-2.5 rounded-[10px] text-[14.5px] font-semibold text-ink-2 hover:bg-paper transition-colors">{l.label}</Link>
            ))}
          </nav>
          <div className="pt-4 mt-2 border-t border-line flex items-center justify-between gap-3">
            <LangSwitch />
            {portal
              ? <Link to={portal} className="h-10 px-4 inline-flex items-center rounded-[10px] bg-ink text-paper text-[13.5px] font-semibold">{t("nav.portal")}</Link>
              : (
                <div className="flex items-center gap-2">
                  <Link to="/auth" className="h-10 px-3.5 inline-flex items-center rounded-[10px] border border-line-2 text-[13.5px] font-semibold text-ink-2">{t("nav.login")}</Link>
                  <Link to="/rezervo" className="h-10 px-4 inline-flex items-center rounded-[10px] bg-primary-600 text-primary-50 text-[13.5px] font-semibold">{t("nav.book")}</Link>
                </div>
              )}
          </div>
        </div>
      )}
    </header>
  );
}

// ─── Public footer ────────────────────────────────────────────────────────────
export function PublicFooter() {
  const { t } = useApp();
  const col = "font-mono text-[10px] uppercase tracking-[0.2em] text-paper/40 mb-4";
  const lnk = "block text-[13.5px] text-paper/65 hover:text-paper py-1.5 transition-colors hover:translate-x-0.5 duration-150";
  return (
    <footer className="bg-ink-panel text-paper/80 mt-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-graph-dark opacity-40 pointer-events-none" aria-hidden="true" />
      <div className="relative max-w-6xl mx-auto px-4 py-14 grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <Logo dark />
          <p className="text-[13.5px] text-paper/55 mt-5 max-w-xs leading-relaxed">
            Platformë profesionale për konsulencë SPSS, analizë statistikore dhe metodologji të hulumtimit — nga pyetësori deri te publikimi.
          </p>
          <div className="flex items-center gap-2 mt-6 text-[11px] font-mono text-paper/45">
            <span className="w-1.5 h-1.5 rounded-full bg-ok pulse-dot inline-block" />
            RLS · Storage privat · URL të nënshkruara
          </div>
        </div>
        <div>
          <p className={col}>Platforma</p>
          {[["/konsulentet", t("nav.consultants")], ["/rezervo", t("nav.book")], ["/behu-konsulent", t("nav.become")], ["/auth", t("nav.login")]].map(([to, label]) => (
            <Link key={to} to={to} className={lnk}>{label}</Link>
          ))}
        </div>
        <div>
          <p className={col}>Shërbimet</p>
          {["Konsulencë SPSS", "Analiza e regresionit", "Dizajni i pyetësorit", "Mbështetje për master", "Mbështetje për doktoraturë"].map((s) => (
            <Link key={s} to="/rezervo" className={lnk}>{s}</Link>
          ))}
        </div>
        <div>
          <p className={col}>Ligjore</p>
          <Link to="/privatesia" className={lnk}>Politika e privatësisë</Link>
          <Link to="/kushtet" className={lnk}>Kushtet e shërbimit</Link>
          <p className="text-[13.5px] text-paper/65 py-1.5 flex items-center gap-2"><IMail size={13} /> kontakt@statlab.al</p>
        </div>
      </div>
      <div className="relative border-t border-paper/[0.08]">
        <div className="max-w-6xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11.5px] text-paper/40">
          <span>© {new Date().getFullYear()} StatLab. Të gjitha të drejtat e rezervuara.</span>
          <span className="font-mono tracking-wide">v2.4 · SPSS Consulting Platform</span>
        </div>
      </div>
    </footer>
  );
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  useEffect(() => {
    if (loc.hash) {
      const el = document.getElementById(loc.hash.slice(1));
      if (el) { setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 60); return; }
    }
    window.scrollTo({ top: 0 });
  }, [loc.pathname, loc.hash]);
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}

// ─── Portal shell ─────────────────────────────────────────────────────────────

export interface NavItem { to: string; label: string; icon: React.ReactNode; end?: boolean; }

function NotificationBell() {
  const { session } = useApp();
  const [open, setOpen] = useState(false);
  const { data } = useAsync(() => listNotifications(session), [session?.user_id]);
  const recent = (data ?? []).slice(0, 8);
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} aria-label="Njoftimet" className="relative w-9 h-9 rounded-[10px] hover:bg-ink/[0.045] flex items-center justify-center text-ink-2 transition-colors">
        <IBell2 size={17} />
        {recent.length > 0 && <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-bad pulse-dot" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 bg-card border border-line rounded-xl shadow-pop w-[min(92vw,360px)] z-50 anim-scale-in overflow-hidden">
            <div className="px-4 py-3 border-b border-line flex items-center justify-between">
              <p className="font-display font-bold text-[13.5px] text-ink">Njoftimet</p>
              <span className="font-mono text-[10.5px] text-mute">{recent.length} të fundit</span>
            </div>
            <div className="max-h-[380px] overflow-y-auto">
              {recent.length === 0 && <p className="text-[13px] text-mute px-4 py-8 text-center">Nuk ka njoftime të reja.</p>}
              {recent.map((n) => (
                <div key={n.id} className="px-4 py-3 border-b border-line/70 last:border-0 hover:bg-paper/60 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone={n.type.startsWith("reminder") ? "warn" : n.type === "payment_received" ? "ok" : "info"}>{NOTIF_LABEL[n.type] ?? n.type}</Badge>
                    <span className="text-[10.5px] text-mute whitespace-nowrap font-mono">{relativeTime(n.sent_at)}</span>
                  </div>
                  <p className="text-[13px] font-bold text-ink mt-1.5 leading-snug">{n.subject}</p>
                  <p className="text-[12px] text-mute mt-0.5 line-clamp-2 leading-relaxed">{n.body}</p>
                  <p className="text-[10px] font-mono text-mute/70 mt-1.5">✉ {n.recipient_email} · {fmtDateTime(n.sent_at)}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SidebarContent({ nav, title, onNavigate }: { nav: NavItem[]; title: string; onNavigate?: () => void }) {
  const { user } = useApp();
  const nav2 = useNavigate();
  const ROLE_SHORT: Record<string, string> = { client: "Klient", consultant: "Konsulent", admin: "Admin", super_admin: "Super Admin" };
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 h-16 flex items-center border-b border-paper/[0.07] shrink-0">
        <Logo dark />
      </div>
      <div className="px-3 flex-1 overflow-y-auto no-scrollbar">
        <p className="px-3 pt-4 pb-2 font-mono text-[9.5px] uppercase tracking-[0.22em] text-paper/35">{title}</p>
        <nav className="space-y-1 pb-4" aria-label={title}>
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              onClick={onNavigate}
              className={({ isActive }) => cls(
                "relative flex items-center gap-3 px-3 h-10 rounded-[10px] text-[13.5px] font-semibold transition-all duration-150 group",
                isActive
                  ? "bg-primary-500/[0.18] text-paper shadow-[inset_0_0_0_1px_rgb(95_130_236/0.28)]"
                  : "text-paper/55 hover:text-paper hover:bg-paper/[0.05]",
              )}
            >
              {({ isActive }) => (
                <>
                  <span className={cls(
                    "absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-full bg-primary-400 transition-all duration-200",
                    isActive ? "opacity-100 scale-y-100" : "opacity-0 scale-y-50",
                  )} />
                  <span className={cls("transition-colors", isActive ? "text-primary-300" : "text-paper/40 group-hover:text-paper/75")}>{n.icon}</span>
                  {n.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
      {user && (
        <div className="p-3 border-t border-paper/[0.07] shrink-0">
          <button
            onClick={() => { nav2("/settings"); onNavigate?.(); }}
            className="w-full flex items-center gap-2.5 rounded-xl p-2 hover:bg-paper/[0.06] transition-colors text-left group"
            title="Cilësimet e llogarisë"
          >
            <Avatar name={user.full_name} size={34} />
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-bold text-paper truncate">{user.full_name}</span>
              <span className="block font-mono text-[9.5px] uppercase tracking-[0.14em] text-paper/40">{ROLE_SHORT[user.role] ?? user.role}</span>
            </span>
            <ISettings size={15} className="text-paper/35 group-hover:text-paper/80 transition-colors" />
          </button>
          <button
            onClick={() => { logout(); nav2("/"); }}
            className="mt-1 w-full flex items-center gap-2.5 rounded-[10px] px-3 h-9 text-[12.5px] font-semibold text-paper/50 hover:text-bad hover:bg-bad/[0.12] transition-colors"
          >
            <ILogout size={14} /> Dil nga llogaria
          </button>
        </div>
      )}
    </div>
  );
}

export function PortalShell({ nav, title, children }: { nav: NavItem[]; title: string; children: React.ReactNode }) {
  const { user, t } = useApp();
  const nav2 = useNavigate();
  const [mobileNav, setMobileNav] = useState(false);
  const loc = useLocation();
  useEffect(() => setMobileNav(false), [loc.pathname]);
  if (!user) return null;
  const portalHome = user.role === "admin" || user.role === "super_admin" ? "/admin" : user.role === "consultant" ? "/consultant" : "/client";
  const current = [...nav].sort((a, b) => b.to.length - a.to.length).find((n) => loc.pathname === n.to || loc.pathname.startsWith(n.to + "/"))?.label;
  return (
    <div className="min-h-screen flex bg-paper">
      <aside className="hidden lg:block w-[236px] shrink-0 sticky top-0 h-screen bg-ink-panel text-paper border-r border-ink">
        <SidebarContent nav={nav} title={title} />
      </aside>
      {mobileNav && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/55 anim-fade-in" onClick={() => setMobileNav(false)} />
          <aside className="absolute left-0 top-0 h-full w-[270px] bg-ink-panel text-paper anim-fade-in shadow-pop">
            <SidebarContent nav={nav} title={title} onNavigate={() => setMobileNav(false)} />
          </aside>
        </div>
      )}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-14 bg-card/88 backdrop-blur-md border-b border-line flex items-center justify-between px-4 lg:px-7">
          <div className="flex items-center gap-3 min-w-0">
            <button className="lg:hidden w-9 h-9 rounded-[10px] hover:bg-ink/[0.045] flex items-center justify-center text-ink transition-colors" onClick={() => setMobileNav(true)} aria-label="Hap navigimin"><IMenu size={18} /></button>
            <nav className="flex items-center gap-2 text-[13px] min-w-0" aria-label="Breadcrumb">
              <span className="font-semibold text-mute truncate hidden sm:block">{title}</span>
              {current && (
                <>
                  <span className="text-line-2" aria-hidden="true">/</span>
                  <span className="font-bold text-ink truncate">{current}</span>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-1">
            <LangSwitch compact />
            <NotificationBell />
            <span className="w-px h-5 bg-line mx-1 hidden sm:block" aria-hidden="true" />
            <Menu
              align="right"
              width={232}
              trigger={
                <button className="flex items-center gap-2 rounded-full p-1 pr-1.5 hover:bg-ink/[0.045] transition-colors" aria-label="Menuja e profilit">
                  <Avatar name={user.full_name} size={28} />
                  <span className="hidden sm:block text-[12.5px] font-bold text-ink max-w-[110px] truncate">{user.full_name.split(" ")[0]}</span>
                  <IChevD size={11} className="text-mute hidden sm:block" />
                </button>
              }
              items={[
                { label: "Faqja kryesore", icon: <IGrid size={15} />, onClick: () => nav2("/") },
                { label: t("nav.portal"), icon: <IUser size={15} />, onClick: () => nav2(portalHome) },
                { label: "Cilësimet", icon: <ISettings size={15} />, onClick: () => nav2("/settings") },
                { sep: true },
                { label: t("portal.logout"), icon: <ILogout size={15} />, danger: true, onClick: () => { logout(); nav2("/"); } },
              ]}
            />
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-7 max-w-[1240px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
