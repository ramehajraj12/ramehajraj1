import React, { useEffect, useRef, useState } from "react";

export function cls(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// ─── icons (single hand-drawn stroke family, 24px grid) ─────────────────────
interface IP { size?: number; className?: string; strokeWidth?: number; }
const base = ({ size = 18, className, strokeWidth = 1.8 }: IP, children: React.ReactNode, fill = "none") => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    {children}
  </svg>
);

export const ISigma = (p: IP) => base(p, <><path d="M17 6H7.5L13 12l-5.5 6H17" /><path d="M17 6h.01M17 18h.01" strokeWidth={2.4} /></>);
export const IUserIc = (p: IP) => base(p, <><circle cx="12" cy="8" r="3.6" /><path d="M5 20c1.3-3.4 3.9-5 7-5s5.7 1.6 7 5" /></>);
export const IShieldIc = (p: IP) => base(p, <><path d="M12 3.5l7 2.6v5.2c0 4.6-3 7.7-7 9.2-4-1.5-7-4.6-7-9.2V6.1z" /><path d="M9 12l2 2 4-4.5" /></>);
export const IGlobeIc = (p: IP) => base(p, <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c-2.5 2.6-3.8 5.4-3.8 8.5s1.3 5.9 3.8 8.5c2.5-2.6 3.8-5.4 3.8-8.5S14.5 6.1 12 3.5z" /></>);
export const IKeyIc = (p: IP) => base(p, <><circle cx="8" cy="15" r="4.5" /><path d="M11.5 11.5L20 3M17 6l2.5 2.5M14.5 8.5L17 11" /></>);
export const ICameraIc = (p: IP) => base(p, <><path d="M4 8.5A1.5 1.5 0 015.5 7h2l1.6-2h5.8L16.5 7h2A1.5 1.5 0 0120 8.5v9A1.5 1.5 0 0118.5 19h-13A1.5 1.5 0 014 17.5z" /><circle cx="12" cy="13" r="3.4" /></>);
export const ITrashIc = (p: IP) => base(p, <><path d="M4.5 6.5h15M9.5 6V4.5h5V6M6.5 6.5l1 13h9l1-13" /><path d="M10 10.5v5.5M14 10.5v5.5" /></>);
export const ICheckIc = (p: IP) => base(p, <path d="M4.5 12.5l5 5L19.5 7" />);
export const IXIc = (p: IP) => base(p, <path d="M6 6l12 12M18 6L6 18" />);
export const ILogoutIc = (p: IP) => base(p, <><path d="M14.5 8V5.5A1.5 1.5 0 0013 4H6a1.5 1.5 0 00-1.5 1.5v13A1.5 1.5 0 006 20h7a1.5 1.5 0 001.5-1.5V16" /><path d="M9.5 12H21M17.5 8.5L21 12l-3.5 3.5" /></>);
export const ISlidersIc = (p: IP) => base(p, <><path d="M4 7h16M4 12h16M4 17h16" /><circle cx="9" cy="7" r="2" fill="var(--color-card)" /><circle cx="15" cy="12" r="2" fill="var(--color-card)" /><circle cx="7" cy="17" r="2" fill="var(--color-card)" /></>);
export const ILockIc = (p: IP) => base(p, <><rect x="5" y="11" width="14" height="9.5" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /><path d="M12 15v2" /></>);
export const IAlertIc = (p: IP) => base(p, <><path d="M12 4L2.8 19.5h18.4z" /><path d="M12 10v4M12 16.8v.01" strokeWidth={2.2} /></>);
export const IInfoIc = (p: IP) => base(p, <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 7.8v.01" strokeWidth={2.2} /></>);
export const IEyeIc = (p: IP) => base(p, <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></>);
export const IEyeOffIc = (p: IP) => base(p, <><path d="M4 4l16 16" /><path d="M9.9 5.9A9.6 9.6 0 0112 5.5c6 0 9.5 6.5 9.5 6.5a17.6 17.6 0 01-3.3 3.9M6 8A17 17 0 002.5 12S6 18.5 12 18.5a9.3 9.3 0 003.5-.7" /><path d="M9.5 9.8a2.8 2.8 0 003.9 3.9" /></>);
export const IIdCardIc = (p: IP) => base(p, <><rect x="3" y="5.5" width="18" height="13" rx="2" /><circle cx="8.5" cy="11" r="1.8" /><path d="M6 15.5c.5-1.4 1.4-2 2.5-2s2 .6 2.5 2M14 9.5h5M14 12.5h5M14 15.5h3" /></>);

export function Spinner({ className, size = 16 }: { className?: string; size?: number }) {
  return (
    <span
      className={cls("inline-block rounded-full border-2 border-current/25 border-t-current animate-spin", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center justify-center rounded-[9px] bg-primary-600 text-primary-50 shadow-soft" style={{ width: size, height: size }}>
      <ISigma size={size * 0.62} strokeWidth={2.2} />
    </span>
  );
}

// ─── Button ─────────────────────────────────────────────────────────────────
type BtnVariant = "primary" | "outline" | "ghost" | "danger" | "dark";
export function Button({
  variant = "primary", size = "md", loading, className, children, disabled, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" | "lg"; loading?: boolean }) {
  const v: Record<BtnVariant, string> = {
    primary: "bg-primary-600 text-primary-50 hover:bg-primary-700 active:bg-primary-800 shadow-soft",
    outline: "border border-line-2 bg-card text-ink-2 hover:border-primary-400 hover:text-primary-700",
    ghost: "text-ink-2 hover:bg-primary-50 hover:text-primary-800",
    danger: "bg-bad text-white hover:bg-[#a83a3a] active:bg-[#963333]",
    dark: "bg-ink text-paper hover:bg-primary-900",
  };
  const s = { sm: "h-8 px-3 text-[12.5px]", md: "h-10 px-4 text-[13.5px]", lg: "h-12 px-6 text-[15px]" }[size];
  return (
    <button
      className={cls(
        "inline-flex items-center justify-center gap-2 rounded-[9px] font-semibold transition-all duration-150",
        "disabled:opacity-45 disabled:pointer-events-none active:scale-[0.98]",
        v[variant], s, className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner size={15} />}
      {children}
    </button>
  );
}

// ─── Badge ──────────────────────────────────────────────────────────────────
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
    <span className={cls("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-[0.02em] whitespace-nowrap", tones[tone] ?? tones.mute, className)}>
      {children}
    </span>
  );
}

// ─── Form fields ────────────────────────────────────────────────────────────
export function Field({ label, error, hint, required, children, className }: {
  label?: string; error?: string; hint?: string; required?: boolean; children: React.ReactNode; className?: string;
}) {
  return (
    <label className={cls("block", className)}>
      {label && (
        <span className="block text-[12px] font-bold uppercase tracking-[0.08em] text-mute mb-1.5">
          {label} {required && <span className="text-bad">*</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="block text-[12px] text-mute mt-1.5">{hint}</span>}
      {error && <span className="block text-[12px] text-bad font-semibold mt-1.5">{error}</span>}
    </label>
  );
}

export const inputCls =
  "w-full h-10.5 px-3.5 rounded-[9px] border border-line-2 bg-card text-[14px] text-ink placeholder:text-mute/60 " +
  "transition-all duration-150 focus:outline-none focus:border-primary-400 focus:ring-3 focus:ring-primary-100";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cls(inputCls, props.className)} />;
}

export function PasswordInput({ value, onChange, placeholder, autoComplete, invalid }: {
  value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string; invalid?: boolean;
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
        className={cls(inputCls, "pr-11", invalid && "border-bad/60 focus:border-bad focus:ring-bad-soft")}
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

// ─── Segmented control (language switcher) ──────────────────────────────────
export function Segmented<T extends string>({ options, value, onChange, className }: {
  options: { value: T; label: React.ReactNode }[]; value: T; onChange: (v: T) => void; className?: string;
}) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div className={cls("relative inline-flex p-1 rounded-[10px] bg-[#e9edf5] border border-line", className)} role="tablist">
      <span
        className="absolute top-1 bottom-1 rounded-lg bg-card shadow-soft transition-all duration-200 ease-out"
        style={{ width: `calc((100% - 8px) / ${options.length})`, left: `calc(4px + ${idx} * ((100% - 8px) / ${options.length}))` }}
        aria-hidden="true"
      />
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cls(
            "relative z-10 flex-1 px-4 h-8.5 rounded-lg text-[13px] font-bold transition-colors duration-150",
            value === o.value ? "text-primary-700" : "text-mute hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Modal ──────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode;
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
      <div className="absolute inset-0 bg-ink/45 anim-fade-in" onClick={onClose} />
      <div className="relative bg-card border border-line rounded-t-2xl sm:rounded-xl shadow-pop w-full sm:max-w-md anim-scale-in max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h3 className="font-display font-bold text-ink text-[15.5px]">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg hover:bg-paper flex items-center justify-center text-mute hover:text-ink transition-colors">
            <IXIc size={16} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-line bg-paper/50 rounded-b-xl">{footer}</div>}
      </div>
    </div>
  );
}

// ─── Avatar (image with initials fallback) ──────────────────────────────────
const AV_COLORS = ["#1b44cc", "#0e8f96", "#177a48", "#96690a", "#8a3ffc", "#bc4242", "#1738a0", "#0b6e74"];
export function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return AV_COLORS[Math.abs(h) % AV_COLORS.length];
}
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, url, size = 38, className }: { name: string; url?: string | null; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);
  const showImg = url && !broken;
  if (showImg) {
    return (
      <img
        src={url!}
        alt={name}
        onError={() => setBroken(true)}
        className={cls("rounded-full object-cover shrink-0 bg-[#e9edf5]", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  const bg = colorFor(name || "?");
  return (
    <span
      className={cls("inline-flex items-center justify-center rounded-full font-display font-bold text-white shrink-0 select-none", className)}
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${bg}, ${bg}c8)`, fontSize: Math.max(10, size * 0.34) }}
      aria-hidden="true"
    >
      {initialsOf(name || "?")}
    </span>
  );
}

// ─── Scroll reveal ──────────────────────────────────────────────────────────
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

// ─── KV row ─────────────────────────────────────────────────────────────────
export function KV({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-line last:border-0">
      <span className="text-[13px] text-mute">{k}</span>
      <span className={cls("text-[13px] font-semibold text-ink text-right break-all", mono && "font-mono text-[12px]")}>{v}</span>
    </div>
  );
}
