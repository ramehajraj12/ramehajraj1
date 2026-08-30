import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useApp, useAsync } from "../lib/store";
import { listNotifications, logout } from "../lib/services";
import { NOTIF_LABEL } from "../lib/i18n";
import { relativeTime, cls, fmtDateTime } from "../lib/utils";
import { Avatar, Badge } from "./ui";
import { LogoMark, IBell2, IMenu, IX, ILogout, IChevD, IGlobe, ILogout as _, IMail } from "./icons";
import type { Lang } from "../types";

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
      <button onClick={() => setOpen(!open)}
        className={cls("flex items-center gap-1.5 text-[13px] font-semibold text-ink-2 hover:text-primary-700 rounded-md px-2 py-1.5 hover:bg-primary-50 transition-colors", compact && "px-1")}>
        <IGlobe size={15} />
        <span className="font-mono text-[11px] tracking-wider">{cur.flag}</span>
        {!compact && <IChevD size={12} />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1.5 bg-card border border-line rounded-lg shadow-lift py-1.5 w-36 z-50 anim-scale-in">
            {langs.map((l) => (
              <button key={l.code} onClick={() => { setLang(l.code); setOpen(false); }}
                className={cls("w-full text-left px-3.5 py-2 text-[13px] font-medium hover:bg-paper flex items-center justify-between",
                  lang === l.code ? "text-primary-700" : "text-ink-2")}>
                {l.label}
                <span className="font-mono text-[10px] text-mute">{l.flag}</span>
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
    <Link to="/" className="flex items-center gap-2.5 group">
      <LogoMark className="transition-transform group-hover:scale-105" />
      <span className={cls("font-display font-bold text-[19px] tracking-tight leading-none", dark ? "text-paper" : "text-ink")}>
        Stat<span className="text-primary-600">Lab</span>
        <span className={cls("block text-[9.5px] font-mono tracking-[0.22em] uppercase mt-0.5 font-medium", dark ? "text-paper/50" : "text-mute")}>SPSS Consulting</span>
      </span>
    </Link>
  );
}

function UserMenu() {
  const { user, t } = useApp();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link to="/auth" className="h-9 px-3.5 inline-flex items-center rounded-lg text-sm font-semibold text-ink-2 hover:bg-primary-50 hover:text-primary-700 transition-colors">{t("nav.login")}</Link>
        <Link to="/rezervo" className="h-9 px-4 inline-flex items-center rounded-lg bg-primary-600 text-primary-50 text-sm font-semibold hover:bg-primary-700 transition-colors shadow-soft">{t("nav.book")}</Link>
      </div>
    );
  }
  const portal = user.role === "admin" || user.role === "super_admin" ? "/admin" : user.role === "consultant" ? "/consultant" : "/client";
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 hover:opacity-85 transition-opacity">
        <Avatar name={user.full_name} size={32} />
        <IChevD size={13} className="text-mute" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 bg-card border border-line rounded-lg shadow-lift py-1.5 w-52 z-50 anim-scale-in">
            <div className="px-3.5 py-2.5 border-b border-line">
              <p className="text-sm font-bold text-ink truncate">{user.full_name}</p>
              <p className="text-xs text-mute truncate">{user.email}</p>
            </div>
            <button onClick={() => { setOpen(false); nav(portal); }} className="w-full text-left px-3.5 py-2 text-[13px] font-medium text-ink-2 hover:bg-paper">{t("nav.portal")}</button>
            <button onClick={() => { logout(); nav("/"); }} className="w-full text-left px-3.5 py-2 text-[13px] font-medium text-bad hover:bg-bad-soft flex items-center gap-2"><ILogout size={14} /> {t("portal.logout")}</button>
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
    window.addEventListener("scroll", fn);
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
    <header className={cls("sticky top-0 z-40 transition-all duration-200 border-b",
      scrolled ? "bg-card/92 backdrop-blur border-line shadow-soft" : "bg-transparent border-transparent")}>
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Logo />
        <nav className="hidden lg:flex items-center gap-1">
          {links.map((l) => (
            <Link key={l.to} to={l.to}
              className="px-3 py-2 rounded-lg text-[13.5px] font-semibold text-ink-2 hover:text-primary-700 hover:bg-primary-50 transition-colors">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-3">
          <LangSwitch />
          {portal ? (
            <div className="flex items-center gap-2.5">
              <Link to={portal} className="h-9 px-4 inline-flex items-center rounded-lg bg-ink text-paper text-sm font-semibold hover:bg-primary-900 transition-colors">{t("nav.portal")}</Link>
              <UserMenu />
            </div>
          ) : (
            <>
              <Link to="/auth" className="h-9 px-3.5 inline-flex items-center rounded-lg text-sm font-semibold text-ink-2 hover:bg-primary-50 hover:text-primary-700 transition-colors">{t("nav.login")}</Link>
              <Link to="/rezervo" className="h-9 px-4 inline-flex items-center rounded-lg bg-primary-600 text-primary-50 text-sm font-semibold hover:bg-primary-700 transition-colors shadow-soft">{t("nav.book")}</Link>
            </>
          )}
        </div>
        <button className="md:hidden w-10 h-10 flex items-center justify-center text-ink" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <IX size={20} /> : <IMenu size={20} />}
        </button>
      </div>
      {mobileOpen && (
        <div className="md:hidden border-t border-line bg-card px-4 py-4 space-y-1 anim-fade-in">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className="block px-3 py-2.5 rounded-lg text-sm font-semibold text-ink-2 hover:bg-paper">{l.label}</Link>
          ))}
          <div className="pt-3 border-t border-line flex items-center justify-between">
            <LangSwitch />
            {portal
              ? <Link to={portal} className="h-10 px-4 inline-flex items-center rounded-lg bg-ink text-paper text-sm font-semibold">{t("nav.portal")}</Link>
              : <Link to="/rezervo" className="h-10 px-4 inline-flex items-center rounded-lg bg-primary-600 text-primary-50 text-sm font-semibold">{t("nav.book")}</Link>}
          </div>
        </div>
      )}
    </header>
  );
}

export function PublicFooter() {
  const { t } = useApp();
  return (
    <footer className="bg-ink text-paper/80 mt-24">
      <div className="max-w-6xl mx-auto px-4 py-14 grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo dark />
          <p className="text-sm text-paper/60 mt-4 max-w-xs leading-relaxed">
            Platformë profesionale për konsulencë SPSS, analizë statistikore dhe metodologji të hulumtimit — nga pyetësori deri te publikimi.
          </p>
          <div className="flex items-center gap-2 mt-5 text-xs font-mono text-paper/50">
            <span className="w-2 h-2 rounded-full bg-ok pulse-dot inline-block" />
            Të dhënat mbrohen me RLS & storage privat
          </div>
        </div>
        <div>
          <p className="font-display font-bold text-paper text-sm mb-3.5">Platforma</p>
          {[["/konsulentet", t("nav.consultants")], ["/rezervo", t("nav.book")], ["/behu-konsulent", t("nav.become")], ["/auth", t("nav.login")]].map(([to, label]) => (
            <Link key={to} to={to} className="block text-sm text-paper/60 hover:text-paper py-1.5 transition-colors">{label}</Link>
          ))}
        </div>
        <div>
          <p className="font-display font-bold text-paper text-sm mb-3.5">Shërbimet</p>
          {["Konsulencë SPSS", "Analiza e regresionit", "Dizajni i pyetësorit", "Mbështetje për master", "Mbështetje për doktoraturë"].map((s) => (
            <Link key={s} to="/rezervo" className="block text-sm text-paper/60 hover:text-paper py-1.5 transition-colors">{s}</Link>
          ))}
        </div>
        <div>
          <p className="font-display font-bold text-paper text-sm mb-3.5">Ligjore</p>
          <Link to="/privatesia" className="block text-sm text-paper/60 hover:text-paper py-1.5">Politika e privatësisë</Link>
          <Link to="/kushtet" className="block text-sm text-paper/60 hover:text-paper py-1.5">Kushtet e shërbimit</Link>
          <p className="text-sm text-paper/60 py-1.5 flex items-center gap-2"><IMail size={14} /> kontakt@statlab.al</p>
        </div>
      </div>
      <div className="border-t border-paper/10">
        <div className="max-w-6xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-paper/45">
          <span>© {new Date().getFullYear()} StatLab. Të gjitha të drejtat e rezervuara.</span>
          <span className="font-mono">v2.4 · SPSS Consulting Platform</span>
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
      <button onClick={() => setOpen(!open)} className="relative w-9 h-9 rounded-lg hover:bg-primary-50 flex items-center justify-center text-ink-2 transition-colors">
        <IBell2 size={17} />
        {recent.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-bad pulse-dot" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 bg-card border border-line rounded-xl shadow-lift w-[340px] z-50 anim-scale-in overflow-hidden">
            <div className="px-4 py-3 border-b border-line font-display font-bold text-sm">Njoftimet</div>
            <div className="max-h-96 overflow-y-auto">
              {recent.length === 0 && <p className="text-sm text-mute px-4 py-6 text-center">Nuk ka njoftime të reja.</p>}
              {recent.map((n) => (
                <div key={n.id} className="px-4 py-3 border-b border-line last:border-0 hover:bg-paper transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone={n.type.startsWith("reminder") ? "warn" : n.type === "payment_received" ? "ok" : "info"}>{NOTIF_LABEL[n.type] ?? n.type}</Badge>
                    <span className="text-[11px] text-mute whitespace-nowrap">{relativeTime(n.sent_at)}</span>
                  </div>
                  <p className="text-[13px] font-semibold text-ink mt-1.5">{n.subject}</p>
                  <p className="text-xs text-mute mt-0.5 line-clamp-2">{n.body}</p>
                  <p className="text-[10.5px] font-mono text-mute/70 mt-1">✉ {n.recipient_email} · {fmtDateTime(n.sent_at)}</p>
                </div>
              ))}
            </div>
          </div>
        </>
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

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="px-4 h-16 flex items-center border-b border-line/60">
        <Logo />
      </div>
      <div className="px-3 py-3">
        <p className="px-2 text-[10px] font-mono uppercase tracking-[0.18em] text-mute/80">{title}</p>
      </div>
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto pb-4">
        {nav.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}
            className={({ isActive }) => cls(
              "flex items-center gap-2.5 px-3 h-9.5 py-2 rounded-lg text-[13.5px] font-semibold transition-colors",
              isActive ? "bg-primary-600 text-primary-50 shadow-soft" : "text-ink-2 hover:bg-primary-50 hover:text-primary-700",
            )}>
            <span className="opacity-90">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-line/60">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <Avatar name={user.full_name} size={34} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-ink truncate">{user.full_name}</p>
            <p className="text-[11px] text-mute truncate">{user.email}</p>
          </div>
          <button onClick={() => { logout(); nav2("/"); }} className="w-8 h-8 rounded-lg hover:bg-bad-soft text-mute hover:text-bad flex items-center justify-center transition-colors" title={t("portal.logout")}>
            <ILogout size={15} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-paper">
      <aside className="hidden lg:block w-60 shrink-0 bg-card border-r border-line sticky top-0 h-screen">
        {sidebar}
      </aside>
      {mobileNav && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40 anim-fade-in" onClick={() => setMobileNav(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-card border-r border-line anim-fade-in">{sidebar}</aside>
        </div>
      )}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-14 bg-card/90 backdrop-blur border-b border-line flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button className="lg:hidden w-9 h-9 flex items-center justify-center text-ink" onClick={() => setMobileNav(true)}><IMenu size={19} /></button>
            <span className="text-sm font-semibold text-mute hidden sm:block">{title}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <LangSwitch compact />
            <NotificationBell />
            <Link to="/" className="w-9 h-9 rounded-lg hover:bg-primary-50 flex items-center justify-center text-ink-2 text-xs font-bold" title="Faqja kryesore">
              <LogoMark size={20} />
            </Link>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6 max-w-[1200px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
