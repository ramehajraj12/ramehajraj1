import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useApp, useAsync } from "../lib/store";
import { listActiveServices, listPublicConsultants, getPublicReviews } from "../lib/services";
import { SPECIALIZATIONS, SERVICE_CATEGORY } from "../lib/i18n";
import { fmtEuro, fmtDate, fmtDuration, cls, daysUntil } from "../lib/utils";
import { Avatar, Badge, Button, Reveal, Skeleton, Stars } from "../components/ui";
import { ISigma, IArrowR, ICheck, IShield, IVideo, IDoc, IChevD, ISpark, IGraduation, IFlask, ICal, IUser, IScatter } from "../components/icons";

// ─── count-up number (starts when scrolled into view) ────────────────────────
function CountUp({ value, decimals = 0, suffix = "" }: { value: number | null; decimals?: number; suffix?: string }) {
  const [v, setV] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || value === null) return;
    let raf = 0;
    const io = new IntersectionObserver(([en]) => {
      if (!en.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const dur = 950;
      const step = (t: number) => {
        const p = Math.min(1, (t - t0) / dur);
        setV(value * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value]);
  return (
    <span ref={ref} className="tabular-nums">
      {value === null ? "—" : v.toFixed(decimals)}{suffix}
    </span>
  );
}

// ─── marquee of the discipline's vocabulary ──────────────────────────────────
const TERMS = [
  "Regresion linear", "ANOVA", "Cronbach α", "Analizë faktoriale", "Pearson r",
  "Mann-Whitney U", "Kruskal-Wallis", "Chi-katror", "Regresion logjistik",
  "Wilcoxon", "Bonferroni", "Testim normaliteti", "Korelacion", "Madhësia e mostrës",
];
function TermsMarquee() {
  const row = (key: string) => (
    <div key={key} className="flex items-center shrink-0" aria-hidden={key === "b"}>
      {TERMS.map((t) => (
        <span key={`${key}-${t}`} className="flex items-center gap-8 pr-8">
          <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-mute/80 whitespace-nowrap">{t}</span>
          <ISigma size={13} className="text-primary-300 shrink-0" />
        </span>
      ))}
    </div>
  );
  return (
    <div className="marquee border-y border-line bg-card/80 backdrop-blur py-3.5" aria-label="Fushat e analizës">
      <div className="marquee-track">{row("a")}{row("b")}</div>
    </div>
  );
}

// ─── hero: SPSS output panel (alive) + real next slot ────────────────────────
function ScatterHero({ firstFree }: { firstFree?: { display_name: string; next: { date: string; time: string } | null } | null }) {
  const pts = useMemo(() => {
    const raw: [number, number][] = [];
    let s = 7;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 26; i++) {
      const x = 8 + i * 3.4 + rnd() * 10;
      raw.push([x, 12 + x * 0.62 + (rnd() - 0.5) * 22]);
    }
    return raw;
  }, []);
  const W = 300, H = 180;
  const sx = (x: number) => 14 + (x / 110) * (W - 28);
  const sy = (y: number) => H - 14 - (y / 95) * (H - 30);
  const line = { x1: sx(6), y1: sy(12 + 6 * 0.62), x2: sx(104), y2: sy(12 + 104 * 0.62) };

  return (
    <div className="relative">
      {/* output panel */}
      <div className="card overflow-hidden w-full max-w-md ml-auto anim-fade-up shadow-lift" style={{ animationDelay: "0.15s" }}>
        <div className="bg-ink text-paper px-4 py-2.5 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/60">StatLab · Output</span>
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-[#7ee2a8]"><span className="w-1.5 h-1.5 rounded-full bg-[#7ee2a8] pulse-dot inline-block" /> p &lt; .001</span>
        </div>
        <div className="p-4 sm:p-5">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-mute mb-2.5">Regresioni — koeficientët</p>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-mute border-b border-line">
                <th className="text-left py-1.5 font-semibold">Parashikuesi</th>
                <th className="text-right py-1.5 font-semibold font-mono">B</th>
                <th className="text-right py-1.5 font-semibold font-mono">β</th>
                <th className="text-right py-1.5 font-semibold font-mono">p</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {[["Stresi akademik", "0.41", "0.38", "<.001"], ["Mbështetja sociale", "-0.26", "-0.22", ".002"], ["Vetë-efikasiteti", "-0.33", "-0.29", "<.001"]].map((r) => (
                <tr key={r[0]} className="border-b border-line/70 last:border-0 hover:bg-paper/70 transition-colors">
                  <td className="py-1.5 font-sans font-semibold text-ink">{r[0]}</td>
                  <td className="py-1.5 text-right text-ink-2">{r[1]}</td>
                  <td className="py-1.5 text-right text-ink-2">{r[2]}</td>
                  <td className="py-1.5 text-right text-primary-700 font-semibold">{r[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-line bg-paper/70 px-4 sm:px-5 py-4">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
            {Array.from({ length: 4 }).map((_, i) => (
              <line key={i} x1={14} x2={W - 14} y1={18 + i * ((H - 36) / 3)} y2={18 + i * ((H - 36) / 3)} stroke="#dde3ee" strokeWidth="1" />
            ))}
            {pts.map(([x, y], i) => (
              <circle key={i} cx={sx(x)} cy={sy(y)} r="3" fill="#2b55e0" opacity="0.55">
                <animate attributeName="opacity" values="0.25;0.75;0.25" dur={`${2.4 + (i % 5) * 0.4}s`} repeatCount="indefinite" />
              </circle>
            ))}
            <line {...line} stroke="#c98d08" strokeWidth="2.4" strokeLinecap="round" className="regression-line" />
          </svg>
          <p className="font-mono text-[10.5px] text-mute mt-1.5">R² = 0.42 · F(3, 336) = 81.2 · n = 340</p>
        </div>
      </div>

      {/* floating slot card — real next availability from the directory */}
      <div className="card absolute -bottom-9 left-0 sm:-left-8 p-3.5 shadow-lift anim-floaty hidden sm:block" style={{ animationDelay: "0.5s", width: 236 }}>
        <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-mute mb-2 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-ok pulse-dot inline-block" /> Termini më i afërt
        </p>
        {firstFree?.next ? (
          <div className="flex items-center gap-2.5">
            <Avatar name={firstFree.display_name} size={34} />
            <div className="min-w-0">
              <p className="text-[12.5px] font-bold text-ink leading-tight truncate">{firstFree.display_name}</p>
              <p className="text-[11.5px] text-mute font-mono">
                {daysUntil(firstFree.next.date) === 0 ? "Sot" : daysUntil(firstFree.next.date) === 1 ? "Nesër" : fmtDate(firstFree.next.date)} · {firstFree.next.time}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-[12.5px] font-semibold text-ink-2">Zgjidhni shërbimin dhe gjeni termin tuaj.</p>
        )}
        <Link to="/rezervo" className="mt-2.5 h-8 rounded-[9px] bg-primary-50 text-primary-700 text-[12px] font-bold flex items-center justify-center gap-1.5 hover:bg-primary-100 transition-colors">
          {firstFree?.next ? "Rezervo" : "Gjej termin të lirë"} <IArrowR size={13} />
        </Link>
      </div>
    </div>
  );
}

const FAQS = [
  { q: "Si zhvillohet konsulta online?", a: "Pasi konfirmoni terminin, merrni një link Google Meet. Konsulenti ndan ekranin, punon direkt me skedarin tuaj (.sav, .xlsx, .csv) dhe ju udhëzon hap pas hapi. Çdo sesion regjistrohet në portalin tuaj me përmbledhje dhe materiale." },
  { q: "Çfarë ndodh nëse nuk kam ende të dhëna?", a: "Shumë klientë fillojnë para mbledhjes së të dhënave — në fazën e metodologjisë. Ju ndihmojmë të dizajnoni pyetësorin, të përcaktoni mostrën dhe hipotezat, që analiza të jetë e saktë që në fillim." },
  { q: "A janë të sigurta skedarët e mi?", a: "Po. Skedarët ruhen në storage privat me URL të nënshkruara me afat, akses vetëm nga ju dhe konsulenti i caktuar, dhe kontrolle autorizimi në nivel rreshti (RLS). Mund të kërkoni eksportimin ose fshirjen e të dhënave në çdo moment (GDPR)." },
  { q: "Si funksionon pagesa?", a: "Zgjidhni mes pagesës së plotë, parapagimit (depozitë) ose pagesës më vonë. Pagesat procesohen me Stripe — ne nuk shohim kurrë të dhënat e kartës suaj. Fatura lëshohet automatikisht." },
  { q: "Çfarë nëse duhet ta ndryshoj terminin?", a: "Çdo rezervim ka një link të sigurt menaxhimi. Mund të rizhvendosni të paktën 12 orë dhe të anuloni të paktën 24 orë para terminit — pa asnjë email apo telefonatë." },
  { q: "A mbështesni edhe shkrimin e kapitullit të rezultateve?", a: "Po — ofrojmë raportim të plotë sipas APA: tabela, figura, interpretim statistikor dhe formulime të gatshme për punimin tuaj, gjithmonë me shpjegim që ta kuptoni dhe ta mbështesni para komisionit." },
];

export default function Home() {
  const { t } = useApp();
  const services = useAsync(() => listActiveServices(), []);
  const consultants = useAsync(() => listPublicConsultants(), []);
  const reviews = useAsync(() => getPublicReviews(), []);
  const [openFaq, setOpenFaq] = useState(0);

  // real, live figures — computed from the public directory
  const firstFree = useMemo(() => (consultants.data ?? []).find((c) => c.next) ?? null, [consultants.data]);
  const avgRating = useMemo(() => {
    const rated = (consultants.data ?? []).filter((c) => c.review_count > 0);
    if (!rated.length) return null;
    return rated.reduce((a, c) => a + Number(c.rating), 0) / rated.length;
  }, [consultants.data]);

  return (
    <div className="bg-graph">
      {/* ── HERO — asymmetric: copy left, live output right ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-ambient pointer-events-none" aria-hidden="true" />
        <div className="absolute inset-0 bg-noise opacity-[0.05] pointer-events-none" aria-hidden="true" />
        <div className="max-w-6xl mx-auto px-4 pt-14 lg:pt-20 pb-28 grid lg:grid-cols-[1.05fr_0.95fr] gap-14 items-start relative">
          <div className="anim-fade-up">
            <div className="inline-flex items-center gap-2 bg-card border border-line rounded-full pl-2 pr-3.5 py-1.5 shadow-soft">
              <span className="bg-primary-600 text-primary-50 rounded-full px-2 py-0.5 text-[10.5px] font-bold font-mono tracking-wide">SPSS 29</span>
              <span className="text-[12.5px] font-semibold text-ink-2">Konsulentë të verifikuar · Rezervim në kohë reale</span>
            </div>
            <h1 className="font-display text-[44px] leading-[1.02] sm:text-[64px] font-bold tracking-tight text-ink mt-6">
              Analiza statistikore,
              <br />
              <span className="relative inline-block text-primary-600">
                më e qartë.
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 230 12" fill="none" aria-hidden="true">
                  <path d="M4 9 C 60 3, 170 3, 226 8" stroke="#c98d08" strokeWidth="3.5" strokeLinecap="round" className="regression-line" />
                </svg>
              </span>
            </h1>
            <p className="text-[17px] text-mute mt-6 max-w-lg leading-relaxed">
              Konsulencë profesionale për SPSS, metodologji të hulumtimit dhe analizë të të dhënave — nga pyetësori i parë deri te publikimi.
            </p>
            <div className="flex flex-wrap items-center gap-3.5 mt-8">
              <Link to="/rezervo">
                <Button size="lg" className="min-w-[190px]">{t("nav.book")} <IArrowR size={16} /></Button>
              </Link>
              <Link to="/konsulentet">
                <Button size="lg" variant="outline">{t("nav.consultants")}</Button>
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-6 mt-14 max-w-md">
              {[
                { v: consultants.data ? consultants.data.length : null, d: 0, s: "", l: "konsulentë aktivë" },
                { v: avgRating, d: 1, s: "★", l: "vlerësimi mesatar" },
                { v: services.data ? services.data.length : null, d: 0, s: "", l: "shërbime aktive" },
              ].map((st) => (
                <div key={st.l} className="border-l-2 border-primary-200 pl-3.5">
                  <p className="font-display text-[26px] font-bold text-ink tracking-tight leading-none">
                    <CountUp value={st.v} decimals={st.d} suffix={st.s} />
                  </p>
                  <p className="text-[11.5px] text-mute mt-1.5">{st.l}</p>
                </div>
              ))}
            </div>
          </div>
          <ScatterHero firstFree={firstFree} />
        </div>
        <TermsMarquee />
      </section>

      {/* ── SERVICES — bento grid ── */}
      <section id="sherbimet" className="max-w-6xl mx-auto px-4 py-20">
        <Reveal>
          <div className="flex items-end justify-between gap-4 mb-9">
            <div>
              <div className="kicker text-primary-600 mb-2.5">01 — Shërbimet</div>
              <h2 className="font-display text-3xl sm:text-[40px] font-bold tracking-tight text-ink leading-[1.06]">Çdo analizë ka<br className="hidden sm:block" /> specialistin e vet</h2>
            </div>
            <Link to="/rezervo" className="hidden sm:inline-flex items-center gap-2 text-sm font-bold text-primary-700 hover:gap-3 transition-all shrink-0">Rezervo tani <IArrowR size={15} /></Link>
          </div>
        </Reveal>
        {services.loading && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-[14px]" />)}</div>
        )}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(services.data ?? []).map((s, i) => (
            <Reveal key={s.id} delay={Math.min(i, 6) * 60} className={cls(i === 0 && "sm:col-span-2")}>
              <Link to={`/rezervo?service=${s.slug}`}
                className={cls("card hcard p-5 group flex flex-col h-full", i === 0 && "sm:flex-row sm:items-center sm:gap-8 bg-ink-panel border-ink text-paper")}>
                <div className={cls("flex-1", i === 0 && "sm:flex-none")}>
                  <div className="flex items-center justify-between">
                    <span className={cls("font-mono text-[11px] font-semibold tracking-[0.14em]", i === 0 ? "text-primary-300" : "text-mute/70")}>{String(i + 1).padStart(2, "0")}</span>
                    <Badge tone={i === 0 ? "dark" : "info"} className={cls(i === 0 && "!bg-primary-500/20 !text-primary-200")}>{SERVICE_CATEGORY[s.category] ?? s.category}</Badge>
                  </div>
                  <h3 className={cls("font-display font-bold text-lg mt-3 leading-snug transition-colors", i === 0 ? "text-paper text-[22px] sm:text-[26px]" : "text-ink group-hover:text-primary-700")}>{s.name}</h3>
                  <p className={cls("text-[13.5px] mt-1.5 leading-relaxed", i === 0 ? "text-paper/60 max-w-sm" : "text-mute")}>{s.short_description}</p>
                </div>
                <div className={cls("mt-4 pt-3.5 border-t flex items-center justify-between", i === 0 ? "border-paper/15 sm:mt-0 sm:pt-0 sm:border-0 sm:flex-col sm:items-end sm:gap-3" : "border-line")}>
                  <span className={cls("font-mono text-[12px]", i === 0 ? "text-paper/50" : "text-mute")}>{fmtDuration(s.default_duration_minutes)}</span>
                  <span className={cls("font-display font-bold text-[17px]", i === 0 ? "text-paper" : "text-ink")}>
                    {s.payment_policy === "deposit" ? <>nga <span className="text-primary-500">{fmtEuro(s.deposit_amount)}</span></> : <span className={i === 0 ? "text-primary-300" : "text-primary-600"}>{fmtEuro(s.default_price)}</span>}
                  </span>
                  <span className={cls("w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200",
                    i === 0 ? "bg-primary-500 text-paper group-hover:bg-primary-400" : "bg-primary-50 text-primary-600 group-hover:bg-primary-600 group-hover:text-primary-50 group-hover:translate-x-0.5")}>
                    <IArrowR size={14} />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── PROCESS — sticky intro + timeline ── */}
      <section id="si-funksionon" className="bg-ink-panel text-paper py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-graph-dark opacity-50 pointer-events-none" aria-hidden="true" />
        <div className="absolute inset-0 bg-noise opacity-[0.05] pointer-events-none" aria-hidden="true" />
        <div className="max-w-6xl mx-auto px-4 relative grid lg:grid-cols-[0.85fr_1.15fr] gap-14">
          <div className="lg:sticky lg:top-28 self-start">
            <Reveal>
              <div className="kicker text-primary-300 mb-2.5">02 — Procesi</div>
              <h2 className="font-display text-3xl sm:text-[40px] font-bold tracking-tight leading-[1.06]">Nga pyetja te përgjigja, në pesë hapa.</h2>
              <p className="text-paper/55 mt-5 leading-relaxed max-w-sm">
                Pa shkëmbim emailesh, pa pritje. Zgjidhni, rezervoni dhe punoni online me specialistin — gjithçka mbetet e dokumentuar në portal.
              </p>
              <Link to="/rezervo" className="inline-flex items-center gap-2 mt-7 text-[14px] font-bold text-primary-300 hover:text-primary-200 hover:gap-3 transition-all">
                Fillo tani <IArrowR size={15} />
              </Link>
            </Reveal>
          </div>
          <div className="relative">
            <span className="absolute left-[27px] top-3 bottom-3 w-px bg-paper/12" aria-hidden="true" />
            <div className="space-y-3.5">
              {[
                { n: "01", title: "Zgjidh shërbimin", desc: "Nga konsulta e shpejtë te mbështetja e doktoraturës.", icon: <ISigma size={17} /> },
                { n: "02", title: "Zgjidh konsulentin", desc: "Ose lër platformën të gjejë më të përshtatshmin sipas specializimit dhe gjuhës.", icon: <IUser size={17} /> },
                { n: "03", title: "Zgjidh datën dhe orën", desc: "Kalendar në kohë reale me disponueshmëri të vërtetë.", icon: <ICal size={17} /> },
                { n: "04", title: "Dërgo materialet", desc: "Seti i të dhënave dhe pyetja hulumtuese, në mënyrë të sigurt.", icon: <IDoc size={17} /> },
                { n: "05", title: "Merr konsultën online", desc: "Google Meet, ndarje ekrani, raportim APA.", icon: <IVideo size={17} /> },
              ].map((step, i) => (
                <Reveal key={step.n} delay={i * 70}>
                  <div className="relative flex items-start gap-5 bg-paper/[0.04] border border-paper/10 rounded-[14px] p-5 hover:bg-paper/[0.07] hover:border-primary-400/40 hover:translate-x-1 transition-all duration-200 group">
                    <span className="relative z-10 w-[38px] h-[38px] rounded-full bg-ink border border-primary-400/40 text-primary-300 font-mono text-[12px] font-bold flex items-center justify-center shrink-0 group-hover:bg-primary-600 group-hover:text-paper group-hover:border-primary-500 transition-colors">
                      {step.n}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <h3 className="font-display font-bold text-[16.5px]">{step.title}</h3>
                        <span className="text-primary-300/70 group-hover:text-primary-200 transition-colors">{step.icon}</span>
                      </div>
                      <p className="text-[13px] text-paper/50 mt-1 leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CONSULTANTS — snap scroller ── */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <Reveal>
          <div className="flex items-end justify-between gap-4 mb-8">
            <div>
              <div className="kicker text-primary-600 mb-2.5">03 — Konsulentët</div>
              <h2 className="font-display text-3xl sm:text-[40px] font-bold tracking-tight text-ink leading-[1.06]">Ekspertë me përvojë reale hulumtimi</h2>
            </div>
            <Link to="/konsulentet" className="hidden sm:inline-flex items-center gap-2 text-sm font-bold text-primary-700 hover:gap-3 transition-all shrink-0">Të gjithë <IArrowR size={15} /></Link>
          </div>
        </Reveal>
        {consultants.loading && <div className="grid md:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-[14px]" />)}</div>}
        {!consultants.loading && (consultants.data ?? []).length === 0 && (
          <div className="card p-10 text-center">
            <p className="font-display font-bold text-ink text-lg">Ende nuk ka konsulentë aktivë.</p>
            <p className="text-mute text-sm mt-1.5">Bëhuni i pari — aplikoni dhe filloni të konsultoni.</p>
            <Link to="/behu-konsulent" className="inline-block mt-5"><Button>Apliko si konsulent</Button></Link>
          </div>
        )}
        <div className="relative">
          <div className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            {(consultants.data ?? []).slice(0, 8).map((c, i) => (
              <Reveal key={c.id} delay={Math.min(i, 4) * 70} className="snap-start shrink-0 w-[290px] sm:w-[320px]">
                <Link to={`/konsulentet/${c.slug}`} className="card hcard p-6 group flex flex-col h-full">
                  <div className="flex items-center gap-4">
                    <Avatar name={c.display_name} size={56} />
                    <div className="min-w-0">
                      <h3 className="font-display font-bold text-ink group-hover:text-primary-700 transition-colors truncate text-[16px]">{c.display_name}</h3>
                      <p className="text-[12.5px] text-mute truncate">{c.professional_title}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Stars value={c.rating} size={12} />
                        <span className="text-[11.5px] font-semibold text-mute">{c.rating.toFixed(1)} ({c.review_count})</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {c.specializations.slice(0, 3).map((sp) => (
                      <span key={sp} className="text-[11px] font-semibold bg-paper border border-line rounded-md px-2 py-1 text-ink-2">{SPECIALIZATIONS[sp] ?? sp}</span>
                    ))}
                    {c.specializations.length > 3 && <span className="text-[11px] font-semibold text-mute px-1 py-1">+{c.specializations.length - 3}</span>}
                  </div>
                  <div className="flex items-center justify-between mt-5 pt-4 border-t border-line">
                    <span className="text-[13px] text-mute">nga <span className="font-display font-bold text-ink">{fmtEuro(c.starting_price)}</span></span>
                    {c.next ? (
                      <span className="text-[12px] font-semibold text-ok bg-ok-soft px-2 py-1 rounded-md">
                        {daysUntil(c.next.date) === 0 ? "Sot" : daysUntil(c.next.date) === 1 ? "Nesër" : fmtDate(c.next.date)} · {c.next.time}
                      </span>
                    ) : <span className="text-[12px] text-mute">Lista e pritjes</span>}
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY / RESEARCH SUPPORT — sticky two-column ── */}
      <section className="max-w-6xl mx-auto px-4 pb-20 grid lg:grid-cols-[0.9fr_1.1fr] gap-10 items-start">
        <div className="lg:sticky lg:top-28 self-start">
          <Reveal>
            <div className="kicker text-primary-600 mb-2.5">04 — Pse StatLab</div>
            <h2 className="font-display text-3xl sm:text-[40px] font-bold tracking-tight text-ink leading-[1.06]">Jo thjesht booking.<br />Një platformë e plotë hulumtimi.</h2>
            <p className="text-mute mt-5 leading-relaxed max-w-md">
              Çdo projekt ka hapësirën e vet: skedarë privatë, workflow analize me faza, pagesa me komision transparent dhe raportim të verifikuar.
            </p>
            <div className="mt-8 space-y-3.5">
              {[
                { icon: <IShield size={17} />, title: "Të dhëna të mbrojtura", desc: "Storage privat, URL të nënshkruara, RLS dhe konsente GDPR." },
                { icon: <ISpark size={17} />, title: "Përputhje inteligjente", desc: "Platforma zgjedh konsulentin sipas specializimit, gjuhës dhe ngarkesës." },
                { icon: <IScatter size={17} />, title: "Workflow SPSS i plotë", desc: "Nga pastrimi i të dhënave deri te tabela APA — me progres të dukshëm." },
              ].map((f, i) => (
                <Reveal key={f.title} delay={i * 70}>
                  <div className="flex gap-3.5 items-start card hcard p-4">
                    <span className="w-9 h-9 rounded-[10px] bg-primary-600 text-primary-50 flex items-center justify-center shrink-0">{f.icon}</span>
                    <div>
                      <p className="font-bold text-ink text-[14.5px]">{f.title}</p>
                      <p className="text-[13px] text-mute mt-0.5 leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </Reveal>
        </div>
        <div className="space-y-4">
          {[
            { icon: <IGraduation size={20} />, level: "Diplomë (Bachelor)", desc: "Udhëheqje nga tema te mbrojtja — metodologjia, analizat bazë (t-test, ANOVA, korelacion) dhe përgatitja për pyetjet e komisionit.", price: "nga €50" },
            { icon: <IFlask size={20} />, level: "Master", desc: "Bashkëpunim i vazhdueshëm: dizajni hulumtues, besueshmëria e shkallëve, regresioni dhe raportimi i plotë APA për tezën.", price: "nga €100" },
            { icon: <ISigma size={20} />, level: "Doktoraturë & Publikime", desc: "Analiza multivariate, madhësia e mostrës, modelet e avancuara dhe përgatitja e rezultateve për revista ndërkombëtare.", price: "nga €120" },
          ].map((r, i) => (
            <Reveal key={r.level} delay={i * 70}>
              <div className="card hcard p-6 group">
                <div className="flex items-start gap-4">
                  <span className="w-11 h-11 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0 group-hover:bg-primary-600 group-hover:text-primary-50 transition-colors duration-200">{r.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-display font-bold text-ink text-lg">{r.level}</h3>
                      <span className="font-mono text-[13px] font-bold text-primary-600">{r.price}</span>
                    </div>
                    <p className="text-[13.5px] text-mute mt-1.5 leading-relaxed">{r.desc}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
          <Reveal delay={220}>
            <div className="bg-primary-600 rounded-[14px] p-6 text-primary-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_18px_44px_-16px_rgb(21_52_158/0.55)]">
              <div>
                <p className="font-display font-bold text-lg">Keni një rast specifik?</p>
                <p className="text-primary-100 text-[13.5px] mt-0.5">Konsulencë sipas porosisë — formati dhe përmbajtja përcaktohen bashkë.</p>
              </div>
              <Link to="/rezervo?service=konsulence-porosi">
                <Button variant="dark" className="!bg-ink hover:!bg-primary-900">Fillo rezervimin</Button>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── REVIEWS ── */}
      <section className="bg-card border-y border-line py-20">
        <div className="max-w-6xl mx-auto px-4">
          <Reveal>
            <div className="kicker text-primary-600 mb-2.5">05 — Vlerësimet</div>
            <h2 className="font-display text-3xl sm:text-[40px] font-bold tracking-tight text-ink mb-9 leading-[1.06]">Vetëm nga konsulta të verifikuara</h2>
          </Reveal>
          {reviews.loading && <div className="grid md:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-[14px]" />)}</div>}
          {!reviews.loading && (reviews.data ?? []).length === 0 && (
            <p className="text-mute text-sm">Ende nuk ka vlerësime të publikuara.</p>
          )}
          <div className="grid md:grid-cols-3 gap-4">
            {(reviews.data ?? []).slice(0, 6).map((r, i) => (
              <Reveal key={r.id} delay={Math.min(i, 4) * 70} className={cls(i === 0 && "md:col-span-2")}>
                <div className="border border-line rounded-[14px] p-6 bg-paper/50 hover:bg-card hover:shadow-soft hover:-translate-y-0.5 transition-all duration-200 h-full">
                  <div className="flex items-center justify-between">
                    <Stars value={r.rating} size={14} />
                    <Badge tone="ok"><ICheck size={11} /> Konsultë e verifikuar</Badge>
                  </div>
                  <p className={cls("text-ink-2 mt-4 leading-relaxed", i === 0 ? "text-[16px] font-medium" : "text-[13.5px]")}>“{r.comment}”</p>
                  <div className="flex items-center gap-2.5 mt-5 pt-4 border-t border-line">
                    <Avatar name={r.client_name} size={32} />
                    <div>
                      <p className="text-[12.5px] font-bold text-ink">{r.client_name}</p>
                      <p className="text-[11.5px] text-mute">{r.service_name} · {r.consultant_name}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="max-w-3xl mx-auto px-4 py-20">
        <Reveal>
          <div className="kicker text-primary-600 mb-2.5 text-center">06 — Pyetjet e shpeshta</div>
          <h2 className="font-display text-3xl sm:text-[40px] font-bold tracking-tight text-ink text-center mb-10 leading-[1.06]">Gjithçka që duhet të dini</h2>
        </Reveal>
        <div className="space-y-2.5">
          {FAQS.map((f, i) => (
            <Reveal key={f.q} delay={Math.min(i, 5) * 50}>
              <div className={cls("card overflow-hidden transition-all duration-200", openFaq === i && "border-primary-300 shadow-soft")}>
                <button onClick={() => setOpenFaq(openFaq === i ? -1 : i)} className="w-full flex items-center justify-between gap-4 p-5 text-left" aria-expanded={openFaq === i}>
                  <span className="font-display font-bold text-ink text-[15px]">{f.q}</span>
                  <span className={cls("w-7 h-7 rounded-full border border-line flex items-center justify-center shrink-0 transition-all duration-200", openFaq === i ? "rotate-180 bg-primary-600 border-primary-600 text-paper" : "text-mute")}>
                    <IChevD size={14} />
                  </span>
                </button>
                {openFaq === i && <p className="px-5 pb-5 text-[14px] text-mute leading-relaxed anim-fade-in">{f.a}</p>}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-6xl mx-auto px-4 pb-4">
        <Reveal>
          <div className="bg-ink-panel rounded-[18px] overflow-hidden relative border border-ink">
            <div className="absolute inset-0 bg-graph-dark opacity-50 pointer-events-none" aria-hidden="true" />
            <svg className="absolute right-0 bottom-0 opacity-25 pointer-events-none" width="420" height="220" viewBox="0 0 420 220" fill="none" aria-hidden="true">
              <path d="M0 200 Q 105 40 210 110 T 420 60" stroke="#93adf4" strokeWidth="2.5" strokeLinecap="round" className="regression-line" />
              <path d="M0 180 Q 105 90 210 140 T 420 100" stroke="#c98d08" strokeWidth="2" strokeDasharray="4 7" strokeLinecap="round" />
            </svg>
            <div className="relative px-6 sm:px-12 py-14 grid sm:grid-cols-[1fr_auto] gap-8 items-center">
              <div>
                <h2 className="font-display text-3xl sm:text-[40px] font-bold tracking-tight text-paper leading-[1.05]">Gati të qartësoni analizën tuaj?</h2>
                <p className="text-paper/55 mt-3 max-w-xl leading-relaxed">Rezervoni në më pak se dy minuta. Pa shkëmbim emailesh, pa pritje — vetëm një termin me specialistin e duhur.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link to="/rezervo"><Button size="lg" className="!bg-primary-500 hover:!bg-primary-400">{t("nav.book")}</Button></Link>
                <Link to="/konsulentet"><Button size="lg" variant="outline" className="!border-paper/25 !text-paper hover:!border-primary-300 !bg-transparent">Shiko konsulentët</Button></Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
