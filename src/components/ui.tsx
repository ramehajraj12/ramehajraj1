import React, { useEffect, useRef, useState } from "react";
import { cls, initials, colorFor } from "../lib/utils";
import { IX, IChevL, IChevR, IWarn, IStar, ISearch } from "./icons";

// ─── Button ───────────────────────────────────────────────────────────────────
type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "dark";
export function Button({
  variant = "primary", size = "md", loading, className, children, disabled, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" | "lg"; loading?: boolean }) {
  const v: Record<BtnVariant, string> = {
    primary: "bg-primary-600 text-primary-50 hover:bg-primary-700 active:bg-primary-800 shadow-xs shadow-[inset_0_1px_0_rgb(255_255_255/0.14)]",
    secondary: "bg-primary-50 text-primary-800 hover:bg-primary-100 border border-primary-200/70",
    ghost: "text-ink-2 hover:bg-ink/[0.045] hover:text-ink",
    danger: "bg-bad-soft text-bad hover:bg-[#f2d9d9] border border-[#e9c5c5]",
    outline: "border border-line-2 text-ink-2 hover:border-primary-400 hover:text-primary-700 hover:bg-primary-50/40 bg-card",
    dark: "bg-ink text-paper hover:bg-primary-900 shadow-xs",
  };
  const s = { sm: "h-8 px-3 text-[12.5px] rounded-[9px] gap-1.5", md: "h-10 px-4 text-[13.5px] rounded-[10px]", lg: "h-12 px-6 text-[14.5px] rounded-[11px]" }[size];
  return (
    <button
      className={cls(
        "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 focus-ring select-none",
        "disabled:opacity-45 disabled:pointer-events-none active:scale-[0.985]",
        v[variant], s, className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner className="!w-4 !h-4 border-black/15 border-t-current" />}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cls("inline-block w-5 h-5 rounded-full border-2 border-primary-200 border-t-primary-600 animate-spin", className)} />;
}

// ─── Badge / status ──────────────────────────────────────────────────────────
export function Badge({ tone = "mute", children, className }: { tone?: string; children: React.ReactNode; className?: string }) {
  const tones: Record<string, string> = {
    ok: "bg-ok-soft text-ok",
    warn: "bg-warn-soft text-warn",
    bad: "bg-bad-soft text-bad",
    info: "bg-primary-50 text-primary-700",
    teal: "bg-teal-soft text-teal",
    mute: "bg-ink/[0.05] text-mute",
    dark: "bg-ink text-paper",
  };
  return (
    <span className={cls(
      "inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-full text-[11px] font-bold tracking-[0.01em] whitespace-nowrap ring-1 ring-inset ring-black/[0.04]",
      tones[tone] ?? tones.mute, className,
    )}>
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
        <span className="block text-[12.5px] font-semibold text-ink-2 mb-1.5">
          {label} {required && <span className="text-bad">*</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="block text-[11.5px] text-mute mt-1.5">{hint}</span>}
      {error && <span className="block text-[11.5px] text-bad font-semibold mt-1.5">{error}</span>}
    </label>
  );
}

export const inputCls = "w-full h-10 px-3.5 rounded-[10px] border border-line-2/80 bg-card text-sm text-ink placeholder:text-mute/60 transition-all duration-150 hover:border-line-2 focus:outline-none focus:border-primary-400 focus:ring-[3px] focus:ring-primary-100";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cls(inputCls, props.className)} />;
}
export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cls(inputCls, "h-auto min-h-[88px] py-2.5 resize-y leading-relaxed", props.className)} />;
}
export function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cls(inputCls, "appearance-none pr-8 bg-no-repeat bg-[right_10px_center] cursor-pointer", props.className)}
    style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2361708c' stroke-width='2'%3E%3Cpath d='M6 9.5l6 6 6-6'/%3E%3C/svg%3E\")", ...props.style }}>
    {children}
  </select>;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="inline-flex items-center gap-2.5 focus-ring rounded-md" role="switch" aria-checked={checked}>
      <span className={cls("w-9 h-5 rounded-full p-0.5 transition-colors duration-150", checked ? "bg-primary-600" : "bg-line-2")}>
        <span className={cls("block w-4 h-4 rounded-full bg-white shadow-xs transition-transform duration-150", checked && "translate-x-4")} />
      </span>
      {label && <span className="text-[13.5px] text-ink-2 font-medium">{label}</span>}
    </button>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <ISearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mute/80 pointer-events-none" size={15} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? "Kërko…"} aria-label={placeholder ?? "Kërko"}
        className={cls(inputCls, "pl-9.5 pl-10")} />
    </div>
  );
}

// ─── Cards / layout ───────────────────────────────────────────────────────────
export function Card({ className, children, onClick }: { className?: string; children: React.ReactNode; onClick?: () => void }) {
  return <div onClick={onClick} className={cls("card", onClick && "cursor-pointer card-hover hover:-translate-y-0.5", className)}>{children}</div>;
}

export function SectionTitle({ kicker, title, action }: { kicker?: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6">
      <div>
        {kicker && <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-primary-600 mb-2">{kicker}</div>}
        <h2 className="font-display text-xl md:text-[22px] font-bold text-ink tracking-tight">{title}</h2>
      </div>
      {action}
    </div>
  );
}

/** Consistent dashboard page header: title + short description + primary action. */
export function PageHead({ title, desc, action, kicker }: { title: string; desc?: string; action?: React.ReactNode; kicker?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 mb-6">
      <div className="min-w-0">
        {kicker && <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-primary-600 mb-1.5">{kicker}</div>}
        <h1 className="font-display text-[22px] font-bold tracking-tight text-ink">{title}</h1>
        {desc && <p className="text-[13.5px] text-mute mt-1 max-w-xl leading-relaxed">{desc}</p>}
      </div>
      {action && <div className="flex items-center gap-2.5 flex-wrap">{action}</div>}
    </div>
  );
}

/** Compact KPI card for dashboards — informative, restrained. */
export function Kpi({ label, value, sub, icon, tone = "primary" }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; icon?: React.ReactNode; tone?: "primary" | "ok" | "warn" | "bad" | "teal";
}) {
  const tile: Record<string, string> = {
    primary: "bg-primary-50 text-primary-700",
    ok: "bg-ok-soft text-ok",
    warn: "bg-warn-soft text-warn",
    bad: "bg-bad-soft text-bad",
    teal: "bg-teal-soft text-teal",
  };
  return (
    <div className="card p-4 card-hover">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">{label}</p>
        {icon && <span className={cls("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", tile[tone])}>{icon}</span>}
      </div>
      <p className="font-display text-[22px] font-bold text-ink tracking-tight mt-1.5 tabular-nums leading-none">{value}</p>
      {sub && <p className="text-[11.5px] text-mute mt-2 leading-snug">{sub}</p>}
    </div>
  );
}

export function KV({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-line/80 last:border-0">
      <span className="text-[12.5px] text-mute">{k}</span>
      <span className={cls("text-[12.5px] font-semibold text-ink text-right min-w-0", mono && "font-mono text-xs")}>{v}</span>
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
export function Avatar({ name, size = 38, className }: { name: string; size?: number; className?: string }) {
  const bg = colorFor(name);
  return (
    <span className={cls("inline-flex items-center justify-center rounded-full font-display font-semibold text-white shrink-0 ring-1 ring-black/[0.08] select-none", className)}
      style={{ width: size, height: size, background: `linear-gradient(140deg, ${bg}, ${bg}d0)`, fontSize: size * 0.34 }}
      aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function Stars({ value, size = 14, onChange }: { value: number; size?: number; onChange?: (v: number) => void }) {
  return (
    <span className="inline-flex items-center gap-0.5" role={onChange ? "radiogroup" : undefined} aria-label="Vlerësimi">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" disabled={!onChange} onClick={() => onChange?.(i)} aria-label={`${i} yje`}
          className={cls(onChange && "hover:scale-115 transition-transform cursor-pointer", "disabled:cursor-default")}>
          <IStar size={size} filled={value >= i - 0.25} className={value >= i - 0.25 ? "text-amber" : "text-line-2"} />
        </button>
      ))}
    </span>
  );
}

export function Progress({ value, tone = "primary", className }: { value: number; tone?: "primary" | "ok" | "warn"; className?: string }) {
  const c = { primary: "bg-primary-500", ok: "bg-ok", warn: "bg-amber" }[tone];
  return (
    <div className={cls("h-1.5 rounded-full bg-ink/[0.07] overflow-hidden", className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cls("h-full rounded-full transition-all duration-500", c)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
export function Tabs({ tabs, active, onChange, className }: {
  tabs: { key: string; label: string; count?: number }[]; active: string; onChange: (k: string) => void; className?: string;
}) {
  return (
    <div className={cls("flex items-center gap-1 border-b border-line overflow-x-auto no-scrollbar", className)} role="tablist">
      {tabs.map((t) => (
        <button key={t.key} onClick={() => onChange(t.key)} role="tab" aria-selected={active === t.key}
          className={cls(
            "px-3.5 py-2.5 text-[13px] font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors duration-150",
            active === t.key ? "border-primary-600 text-primary-700" : "border-transparent text-mute hover:text-ink",
          )}>
          {t.label}
          {t.count !== undefined && <span className={cls("ml-1.5 text-[10.5px] font-mono px-1.5 py-0.5 rounded-full", active === t.key ? "bg-primary-50 text-primary-700" : "bg-ink/[0.05] text-mute")}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: React.ReactNode }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex p-1 rounded-[10px] bg-ink/[0.05] border border-line gap-0.5" role="tablist">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} role="tab" aria-selected={value === o.value}
          className={cls("px-3.5 h-8 rounded-lg text-[12.5px] font-semibold transition-all duration-150",
            value === o.value ? "bg-card text-primary-700 shadow-xs" : "text-mute hover:text-ink")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Menu (popover) ──────────────────────────────────────────────────────────
export type MenuItem =
  | { label: string; icon?: React.ReactNode; danger?: boolean; onClick: () => void }
  | { sep: true };

export function Menu({ trigger, items, align = "right", width = 224 }: {
  trigger: React.ReactNode; items: MenuItem[]; align?: "left" | "right"; width?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("mousedown", onClick); };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>{trigger}</div>
      {open && (
        <div role="menu" className={cls("absolute mt-2 bg-card border border-line rounded-xl shadow-pop p-1.5 z-50 anim-scale-in", align === "right" ? "right-0" : "left-0")} style={{ width }}>
          {items.map((it, i) =>
            "sep" in it
              ? <div key={i} className="h-px bg-line my-1.5 mx-1" />
              : (
                <button key={i} role="menuitem" onClick={() => { setOpen(false); it.onClick(); }}
                  className={cls("w-full flex items-center gap-2.5 px-2.5 h-9 rounded-lg text-[13px] font-semibold transition-colors",
                    it.danger ? "text-bad hover:bg-bad-soft" : "text-ink-2 hover:bg-paper hover:text-ink")}>
                  {it.icon}
                  {it.label}
                </button>
              ),
          )}
        </div>
      )}
    </div>
  );
}

// ─── Modal / Drawer ───────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title?: React.ReactNode; children: React.ReactNode; wide?: boolean;
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
      <div className="absolute inset-0 bg-ink/50 anim-fade-in" onClick={onClose} />
      <div className={cls("relative bg-card border border-line rounded-t-xl sm:rounded-xl shadow-pop w-full anim-scale-in max-h-[92vh] overflow-y-auto", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}>
        <div className="sticky top-0 bg-card/95 backdrop-blur border-b border-line px-5 py-3.5 flex items-center justify-between z-10">
          <h3 className="font-display font-bold text-ink text-[15px]">{title}</h3>
          <button onClick={onClose} aria-label="Mbyll" className="w-8 h-8 rounded-lg hover:bg-paper flex items-center justify-center text-mute hover:text-ink transition-colors"><IX size={15} /></button>
        </div>
        <div className="p-5">{children}</div>
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
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/45 anim-fade-in" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full bg-card border-l border-line shadow-pop anim-slide-right overflow-y-auto w-full" style={{ maxWidth: width }}>
        <div className="sticky top-0 bg-card/95 backdrop-blur border-b border-line px-5 py-3.5 flex items-center justify-between z-10">
          <h3 className="font-display font-bold text-ink text-[15px]">{title}</h3>
          <button onClick={onClose} aria-label="Mbyll" className="w-8 h-8 rounded-lg hover:bg-paper flex items-center justify-center text-mute hover:text-ink transition-colors"><IX size={15} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
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
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon?: React.ReactNode; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 anim-fade-in">
      <div className="w-12 h-12 rounded-xl bg-paper border border-line text-mute flex items-center justify-center mb-4">
        {icon ?? <ISearch size={20} />}
      </div>
      <p className="font-display font-bold text-ink text-[15px]">{title}</p>
      {hint && <p className="text-[13px] text-mute mt-1.5 max-w-sm leading-relaxed">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 anim-fade-in">
      <div className="w-12 h-12 rounded-xl bg-bad-soft text-bad flex items-center justify-center mb-4"><IWarn size={20} /></div>
      <p className="font-display font-bold text-ink text-[15px]">Diçka shkoi keq</p>
      <p className="text-[13px] text-mute mt-1.5 max-w-sm leading-relaxed">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>Provo përsëri</Button>
      )}
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────
export function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-4">
      <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}><IChevL size={14} /> Para</Button>
      <span className="text-[12.5px] text-mute font-mono">{page} / {pages}</span>
      <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Tjetra <IChevR size={14} /></Button>
    </div>
  );
}

// ─── Table helpers ────────────────────────────────────────────────────────────
export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cls("text-left text-[10.5px] uppercase tracking-[0.12em] font-bold text-mute px-4 py-2.5 whitespace-nowrap", className)}>{children}</th>;
}
export function Td({ children, className, colSpan }: { children?: React.ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={cls("px-4 py-3 text-[13.5px] border-t border-line/80 align-middle", className)}>{children}</td>;
}
