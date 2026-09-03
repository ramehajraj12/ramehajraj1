import React, { useEffect, useRef, useState } from "react";
import { cls, initials, colorFor } from "../lib/utils";
import { IX, IChevL, IChevR, IWarn, IStar, ISearch, LogoMark as LogoMarkBase } from "./icons";

export { cls };
export const LogoMark = LogoMarkBase;

// ─── Button ───────────────────────────────────────────────────────────────────
type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "dark";
export function Button({
  variant = "primary", size = "md", loading, className, children, disabled, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" | "lg"; loading?: boolean }) {
  const v: Record<BtnVariant, string> = {
    primary:
      "bg-primary-600 text-primary-50 hover:bg-primary-700 active:bg-primary-800 " +
      "shadow-[0_1px_0_rgb(255_255_255/0.18)_inset,0_10px_24px_-10px_rgb(21_52_158/0.55)] hover:shadow-[0_1px_0_rgb(255_255_255/0.18)_inset,0_14px_30px_-10px_rgb(21_52_158/0.65)] hover:-translate-y-px",
    secondary: "bg-primary-50 text-primary-800 hover:bg-primary-100 border border-primary-200/80 hover:border-primary-300",
    ghost: "text-ink-2 hover:bg-primary-50 hover:text-primary-800",
    danger: "bg-bad-soft text-bad hover:bg-[#f3d8d8] border border-[#ecc9c9]",
    outline: "border border-line-2 bg-card text-ink-2 hover:border-primary-400 hover:text-primary-700 hover:-translate-y-px hover:shadow-soft",
    dark: "bg-ink text-paper hover:bg-primary-900 shadow-soft",
  };
  const s = { sm: "h-8 px-3 text-[12.5px]", md: "h-10 px-4 text-[13.5px]", lg: "h-12 px-6 text-[15px]" }[size];
  return (
    <button
      className={cls(
        "inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold transition-all duration-150 focus-ring",
        "disabled:opacity-45 disabled:pointer-events-none active:scale-[0.985] active:translate-y-0",
        v[variant], s, className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner className="!w-4 !h-4 border-current/40 border-t-current" />}
      {children}
    </button>
  );
}

export function Spinner({ className, size }: { className?: string; size?: number }) {
  return (
    <span
      className={cls("inline-block w-5 h-5 rounded-full border-2 border-primary-200 border-t-primary-600 animate-spin", className)}
      style={size ? { width: size, height: size } : undefined}
    />
  );
}

// ─── Badge / status ──────────────────────────────────────────────────────────
export function Badge({ tone = "mute", children, className }: { tone?: string; children: React.ReactNode; className?: string }) {
  const tones: Record<string, string> = {
    ok: "bg-ok-soft text-ok",
    warn: "bg-warn-soft text-warn",
    bad: "bg-bad-soft text-bad",
    info: "bg-primary-50 text-primary-700",
    teal: "bg-teal-soft text-teal",
    mute: "bg-[#eceff6] text-mute",
    dark: "bg-ink text-paper",
  };
  return (
    <span className={cls("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[7px] text-[10.5px] font-bold uppercase tracking-[0.06em] whitespace-nowrap", tones[tone] ?? tones.mute, className)}>
      {children}
    </span>
  );
}

export function Dot({ tone = "mute" }: { tone?: string }) {
  const c: Record<string, string> = { ok: "bg-ok", warn: "bg-amber", bad: "bg-bad", info: "bg-primary-500", teal: "bg-teal", mute: "bg-[#9aa7bf]" };
  return <span className={cls("w-1.5 h-1.5 rounded-full inline-block shrink-0", c[tone] ?? c.mute)} />;
}

// ─── Form fields ──────────────────────────────────────────────────────────────
export function Field({ label, error, hint, required, children, className }: {
  label?: string; error?: string; hint?: string; required?: boolean; children: React.ReactNode; className?: string;
}) {
  return (
    <label className={cls("block", className)}>
      {label && (
        <span className="block text-[12px] font-bold uppercase tracking-[0.07em] text-mute mb-1.5">
          {label} {required && <span className="text-bad">*</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="block text-xs text-mute mt-1.5">{hint}</span>}
      {error && <span className="block text-xs text-bad font-semibold mt-1.5 anim-fade-in">{error}</span>}
    </label>
  );
}

export const inputCls =
  "w-full h-[42px] px-3.5 rounded-[10px] border border-line-2 bg-card text-sm text-ink placeholder:text-mute/60 " +
  "transition-all duration-150 focus:outline-none focus:border-primary-400 focus:ring-[3px] focus:ring-primary-100";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cls(inputCls, props.className)} />;
}
export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cls(inputCls, "h-auto min-h-[92px] py-2.5 resize-y leading-relaxed", props.className)} />;
}
export function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cls(inputCls, "appearance-none pr-9 bg-no-repeat bg-[right_12px_center] cursor-pointer", props.className)}
      style={{
        backgroundImage:
          "url(\"image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235d6b87' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9.5l6 6 6-6'/%3E%3C/svg%3E\")",
        ...props.style,
      }}
    >
      {children}
    </select>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="inline-flex items-center gap-2.5 focus-ring rounded-md" role="switch" aria-checked={checked}>
      <span className={cls("w-9 h-5 rounded-full p-0.5 transition-colors duration-200", checked ? "bg-primary-600" : "bg-line-2")}>
        <span className={cls("block w-4 h-4 rounded-full bg-white shadow transition-transform duration-200", checked && "translate-x-4")} />
      </span>
      {label && <span className="text-sm text-ink-2 font-medium">{label}</span>}
    </button>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <ISearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mute" size={15} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? "Kërko…"} className={cls(inputCls, "pl-10")} />
    </div>
  );
}

export function PasswordInput({ value, onChange, placeholder, autoComplete, invalid, className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string; invalid?: boolean; className?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={cls(inputCls, "pr-11", invalid && "border-bad/60 focus:border-bad focus:ring-bad-soft", className)}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center text-mute hover:text-ink hover:bg-paper transition-colors"
        aria-label={show ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        {show ? <IEyeOffIc size={16} /> : <IEyeIc size={16} />}
      </button>
    </div>
  );
}

// ─── Cards / layout ───────────────────────────────────────────────────────────
export function Card({ className, children, onClick }: { className?: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={cls("card", onClick && "cursor-pointer hcard", className)}>
      {children}
    </div>
  );
}

export function SectionTitle({ kicker, title, action }: { kicker?: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6">
      <div>
        {kicker && <div className="kicker text-primary-600 mb-2">{kicker}</div>}
        <h2 className="font-display text-2xl md:text-[28px] font-bold text-ink tracking-tight">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function KV({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-line last:border-0">
      <span className="text-[13px] text-mute">{k}</span>
      <span className={cls("text-[13px] font-semibold text-ink text-right break-all", mono && "font-mono text-xs")}>{v}</span>
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
export function Avatar({ name, url, size = 38, className }: { name: string; url?: string | null; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);
  if (url && !broken) {
    return (
      <img
        src={url}
        alt={name}
        onError={() => setBroken(true)}
        className={cls("rounded-full object-cover shrink-0 bg-[#e9edf5] ring-1 ring-line", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  const bg = colorFor(name || "?");
  return (
    <span
      className={cls("inline-flex items-center justify-center rounded-full font-display font-bold text-white shrink-0 select-none", className)}
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${bg}, ${bg}c4)`, fontSize: Math.max(10, size * 0.34) }}
      aria-hidden="true"
    >
      {initials(name || "?")}
    </span>
  );
}

export function Stars({ value, size = 14, onChange }: { value: number; size?: number; onChange?: (v: number) => void }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" disabled={!onChange} onClick={() => onChange?.(i)}
          className={cls(onChange && "hover:scale-125 transition-transform cursor-pointer", "disabled:cursor-default")}>
          <IStar size={size} filled={value >= i - 0.25} className={value >= i - 0.25 ? "text-amber" : "text-line-2"} />
        </button>
      ))}
    </span>
  );
}

export function Progress({ value, tone = "primary", className }: { value: number; tone?: "primary" | "ok" | "warn"; className?: string }) {
  const c = { primary: "bg-primary-500", ok: "bg-ok", warn: "bg-amber" }[tone];
  return (
    <div className={cls("h-1.5 rounded-full bg-[#e6ebf3] overflow-hidden", className)}>
      <div className={cls("h-full rounded-full transition-[width] duration-700 ease-out", c)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
export function Tabs({ tabs, active, onChange, className }: {
  tabs: { key: string; label: string; count?: number }[]; active: string; onChange: (k: string) => void; className?: string;
}) {
  return (
    <div className={cls("flex items-center gap-1 border-b border-line overflow-x-auto no-scrollbar", className)}>
      {tabs.map((t) => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={cls(
            "relative px-3.5 py-2.5 text-[13.5px] font-semibold whitespace-nowrap transition-colors",
            active === t.key ? "text-primary-700" : "text-mute hover:text-ink",
          )}>
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 text-[11px] font-mono bg-[#eceff6] text-mute px-1.5 py-0.5 rounded">{t.count}</span>}
          <span
            className={cls(
              "absolute left-2 right-2 -bottom-px h-[2.5px] rounded-full bg-primary-600 transition-transform duration-200 origin-left",
              active === t.key ? "scale-x-100" : "scale-x-0",
            )}
          />
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange, className }: {
  options: { value: T; label: React.ReactNode }[]; value: T; onChange: (v: T) => void; className?: string;
}) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div className={cls("relative inline-flex p-1 rounded-[10px] bg-[#e9edf5] border border-line gap-0.5", className)} role="tablist">
      <span
        className="absolute top-1 bottom-1 rounded-lg bg-card shadow-soft transition-all duration-200 ease-out"
        style={{ width: `calc((100% - 8px) / ${options.length})`, left: `calc(4px + ${idx} * ((100% - 8px) / ${options.length}))` }}
        aria-hidden="true"
      />
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={cls("relative z-10 flex-1 px-3 h-8 rounded-lg text-[13px] font-bold transition-colors",
            value === o.value ? "text-primary-700" : "text-mute hover:text-ink")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Modal / Drawer / Menu ────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, wide, footer }: {
  open: boolean; onClose: () => void; title?: React.ReactNode; children: React.ReactNode; wide?: boolean; footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/55 anim-fade-in" onClick={onClose} />
      <div className={cls("relative bg-card border border-line rounded-t-2xl sm:rounded-2xl shadow-pop w-full anim-scale-in max-h-[92vh] flex flex-col", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0">
          <h3 className="font-display font-bold text-ink text-[16px]">{title}</h3>
          <button onClick={onClose} aria-label="Mbyll" className="w-8 h-8 rounded-lg hover:bg-paper flex items-center justify-center text-mute hover:text-ink transition-colors"><IX size={16} /></button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-line bg-paper/60 rounded-b-2xl shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, children, width = 480 }: {
  open: boolean; onClose: () => void; title?: React.ReactNode; children: React.ReactNode; width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink/50 anim-fade-in" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full bg-card border-l border-line shadow-pop anim-slide-right overflow-y-auto w-full" style={{ maxWidth: width }}>
        <div className="sticky top-0 bg-card/95 backdrop-blur border-b border-line px-5 py-4 flex items-center justify-between z-10">
          <h3 className="font-display font-bold text-ink text-[16px]">{title}</h3>
          <button onClick={onClose} aria-label="Mbyll" className="w-8 h-8 rounded-lg hover:bg-paper flex items-center justify-center text-mute hover:text-ink transition-colors"><IX size={16} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export type MenuItem =
  | { label: string; icon?: React.ReactNode; onClick: () => void; danger?: boolean }
  | { sep: true };

export function Menu({ trigger, items, align = "right", width = 224 }: {
  trigger: React.ReactNode; items: MenuItem[]; align?: "left" | "right"; width?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={cls("absolute mt-2 bg-card border border-line rounded-xl shadow-pop py-1.5 z-50 anim-scale-in", align === "right" ? "right-0" : "left-0")}
            style={{ width }}
            role="menu"
          >
            {items.map((it, i) =>
              "sep" in it ? (
                <div key={i} className="my-1.5 border-t border-line" />
              ) : (
                <button
                  key={i}
                  role="menuitem"
                  onClick={() => { setOpen(false); it.onClick(); }}
                  className={cls(
                    "w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] font-semibold text-left transition-colors",
                    it.danger ? "text-bad hover:bg-bad-soft" : "text-ink-2 hover:bg-paper hover:text-ink",
                  )}
                >
                  {it.icon} {it.label}
                </button>
              ),
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── States ───────────────────────────────────────────────────────────────────
export function Skeleton({ className }: { className?: string }) {
  return <div className={cls("skeleton", className)} />;
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3.5">
          <Skeleton className="w-9 h-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-6 w-20 rounded-md" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon?: React.ReactNode; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 anim-fade-in">
      <div className="relative w-14 h-14 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center mb-4">
        <span className="absolute inset-0 rounded-xl border border-dashed border-primary-200 scale-110 opacity-60" aria-hidden="true" />
        {icon ?? <ISearch size={22} />}
      </div>
      <p className="font-display font-bold text-ink text-[15.5px]">{title}</p>
      {hint && <p className="text-sm text-mute mt-1.5 max-w-sm leading-relaxed">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 anim-fade-in">
      <div className="w-14 h-14 rounded-xl bg-bad-soft text-bad flex items-center justify-center mb-4"><IWarn size={22} /></div>
      <p className="font-display font-bold text-ink text-[15.5px]">Diçka shkoi keq</p>
      <p className="text-sm text-mute mt-1.5 max-w-sm leading-relaxed">{message}</p>
      {onRetry && <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>Provo përsëri</Button>}
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────
export function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-4">
      <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}><IChevL size={14} /> Para</Button>
      <span className="text-[12.5px] text-mute font-mono tabular-nums">{page} / {pages}</span>
      <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Tjetra <IChevR size={14} /></Button>
    </div>
  );
}

// ─── Table helpers ────────────────────────────────────────────────────────────
export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cls("text-left font-mono text-[10.5px] uppercase tracking-[0.12em] font-semibold text-mute px-4 py-3 whitespace-nowrap", className)}>{children}</th>;
}
export function Td({ children, className, colSpan }: { children?: React.ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={cls("px-4 py-3.5 text-sm border-t border-line align-middle", className)}>{children}</td>;
}

// ─── Scroll reveal ────────────────────────────────────────────────────────────
export function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            el.classList.add("is-visible");
            io.disconnect();
          }
        });
      },
      { threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={cls("reveal", className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

// ─── settings-stack icons (self-contained stroke family) ─────────────────────
interface SIP { size?: number; className?: string; strokeWidth?: number; }
const sib = ({ size = 18, className, strokeWidth = 1.8 }: SIP, children: React.ReactNode) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    {children}
  </svg>
);
export const IUserIc = (p: SIP) => sib(p, <><circle cx="12" cy="8" r="3.6" /><path d="M5 20c1.3-3.4 3.9-5 7-5s5.7 1.6 7 5" /></>);
export const IShieldIc = (p: SIP) => sib(p, <><path d="M12 3.5l7 2.6v5.2c0 4.6-3 7.7-7 9.2-4-1.5-7-4.6-7-9.2V6.1z" /><path d="M9 12l2 2 4-4.5" /></>);
export const IGlobeIc = (p: SIP) => sib(p, <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c-2.5 2.6-3.8 5.4-3.8 8.5s1.3 5.9 3.8 8.5c2.5-2.6 3.8-5.4 3.8-8.5S14.5 6.1 12 3.5z" /></>);
export const IKeyIc = (p: SIP) => sib(p, <><circle cx="8" cy="15" r="4.5" /><path d="M11.5 11.5L20 3M17 6l2.5 2.5M14.5 8.5L17 11" /></>);
export const ICameraIc = (p: SIP) => sib(p, <><path d="M4 8.5A1.5 1.5 0 015.5 7h2l1.6-2h5.8L16.5 7h2A1.5 1.5 0 0120 8.5v9A1.5 1.5 0 0118.5 19h-13A1.5 1.5 0 014 17.5z" /><circle cx="12" cy="13" r="3.4" /></>);
export const ITrashIc = (p: SIP) => sib(p, <><path d="M4.5 6.5h15M9.5 6V4.5h5V6M6.5 6.5l1 13h9l1-13" /><path d="M10 10.5v5.5M14 10.5v5.5" /></>);
export const ICheckIc = (p: SIP) => sib(p, <path d="M4.5 12.5l5 5L19.5 7" />);
export const IXIc = (p: SIP) => sib(p, <path d="M6 6l12 12M18 6L6 18" />);
export const ILogoutIc = (p: SIP) => sib(p, <><path d="M14.5 8V5.5A1.5 1.5 0 0013 4H6a1.5 1.5 0 00-1.5 1.5v13A1.5 1.5 0 006 20h7a1.5 1.5 0 001.5-1.5V16" /><path d="M9.5 12H21M17.5 8.5L21 12l-3.5 3.5" /></>);
export const ISlidersIc = (p: SIP) => sib(p, <><path d="M4 7h16M4 12h16M4 17h16" /><circle cx="9" cy="7" r="2" fill="var(--color-card)" /><circle cx="15" cy="12" r="2" fill="var(--color-card)" /><circle cx="7" cy="17" r="2" fill="var(--color-card)" /></>);
export const ILockIc = (p: SIP) => sib(p, <><rect x="5" y="11" width="14" height="9.5" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /><path d="M12 15v2" /></>);
export const IAlertIc = (p: SIP) => sib(p, <><path d="M12 4L2.8 19.5h18.4z" /><path d="M12 10v4M12 16.8v.01" strokeWidth={2.2} /></>);
export const IInfoIc = (p: SIP) => sib(p, <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 7.8v.01" strokeWidth={2.2} /></>);
export const IEyeIc = (p: SIP) => sib(p, <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></>);
export const IEyeOffIc = (p: SIP) => sib(p, <><path d="M4 4l16 16" /><path d="M9.9 5.9A9.6 9.6 0 0112 5.5c6 0 9.5 6.5 9.5 6.5a17.6 17.6 0 01-3.3 3.9M6 8A17 17 0 002.5 12S6 18.5 12 18.5a9.3 9.3 0 003.5-.7" /><path d="M9.5 9.8a2.8 2.8 0 003.9 3.9" /></>);
export const IIdCardIc = (p: SIP) => sib(p, <><rect x="3" y="5.5" width="18" height="13" rx="2" /><circle cx="8.5" cy="11" r="1.8" /><path d="M6 15.5c.5-1.4 1.4-2 2.5-2s2 .6 2.5 2M14 9.5h5M14 12.5h5M14 15.5h3" /></>);
