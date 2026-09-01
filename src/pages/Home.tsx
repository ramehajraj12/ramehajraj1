import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp, useAsync } from "../lib/store";
import { listActiveServices, listPublicConsultants, getPublicReviews } from "../lib/services";
import { SPECIALIZATIONS, SERVICE_CATEGORY, LANGUAGES } from "../lib/i18n";
import { fmtEuro, fmtDate, fmtDuration, cls, daysUntil } from "../lib/utils";
import { Avatar, Badge, Button, Card, Skeleton, Stars } from "../components/ui";
import { ISigma, IArrowR, ICheck, IShield, IVideo, IDoc, IChevD, ISpark, IGraduation, IFlask, IBell, ICal, IUser, IScatter } from "../components/icons";

function ScatterHero({ firstFree }: { firstFree?: { display_name: string; next: { date: string; time: string } | null } | null }) {
  // deterministic scatter + OLS line
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
  const W = 300, H = 190;
  const sx = (x: number) => 14 + (x / 110) * (W - 28);
  const sy = (y: number) => H - 16 - (y / 95) * (H - 34);
  const line = { x1: sx(6), y1: sy(12 + 6 * 0.62), x2: sx(104), y2: sy(12 + 104 * 0.62) };

  return (
    <div className="relative">
      {/* coefficients card */}
      <div className="card p-4 sm:p-5 w-full max-w-md ml-auto anim-fade-up" style={{ animationDelay: "0.15s" }}>
        <div className="flex items-center justify-between mb-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">SPSS Output — Regresioni</p>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-ok"><span className="w-1.5 h-1.5 rounded-full bg-ok pulse-dot inline-block" /> p &lt; .001</span>
        </div>
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
              <tr key={r[0]} className="border-b border-line/70 last:border-0">
                <td className="py-1.5 font-sans font-semibold text-ink">{r[0]}</td>
                <td className="py-1.5 text-right text-ink-2">{r[1]}</td>
                <td className="py-1.5 text-right text-ink-2">{r[2]}</td>
                <td className="py-1.5 text-right text-primary-700 font-semibold">{r[3]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 pt-3 border-t border-line bg-paper/60 -mx-4 sm:-mx-5 -mb-4 sm:-mb-5 px-4 sm:px-5 pb-4 rounded-b-[13px]">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
            {Array.from({ length: 4 }).map((_, i) => (
              <line key={i} x1={14} x2={W - 14} y1={20 + i * ((H - 40) / 3)} y2={20 + i * ((H - 40) / 3)} stroke="#e2e7f1" strokeWidth="1" />
            ))}
            {pts.map(([x, y], i) => (
              <circle key={i} cx={sx(x)} cy={sy(y)} r="3" fill="#2f57e4" opacity="0.55">
                <animate attributeName="opacity" values="0.25;0.7;0.25" dur={`${2.4 + (i % 5) * 0.4}s`} repeatCount="indefinite" />
              </circle>
            ))}
            <line {...line} stroke="#c98d08" strokeWidth="2.4" strokeLinecap="round" className="regression-line" />
          </svg>
          <p className="font-mono text-[10.5px] text-mute mt-1.5">R² = 0.42 · F(3, 336) = 81.2 · n = 340</p>
        </div>
      </div>

      {/* floating slot card — real next availability from the directory */}
      <div className="card absolute -bottom-8 left-0 sm:-left-6 p-3.5 shadow-lift anim-fade-up hidden sm:block" style={{ animationDelay: "0.45s", width: 236 }}>
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

function LiveSlotStrip() {
  const { data } = useAsync(() => listPublicConsultants(), []);
  const items = (data ?? []).filter((c) => c.next).slice(0, 5);
  return (
    <div className="border-y border-line bg-card/70 backdrop-blur overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center gap-6 overflow-x-auto no-scrollbar">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute whitespace-nowrap flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-ok pulse-dot inline-block" /> Të lira tani
        </span>
        {items.map((c) => (
          <Link key={c.id} to={`/konsulentet/${c.slug}`} className="flex items-center gap-2 whitespace-nowrap group">
            <Avatar name={c.display_name} size={22} />
            <span className="text-[12.5px] font-semibold text-ink-2 group-hover:text-primary-700 transition-colors">{c.display_name}</span>
            <span className="font-mono text-[12px] text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">
              {daysUntil(c.next!.date) === 0 ? "Sot" : daysUntil(c.next!.date) === 1 ? "Nesër" : fmtDate(c.next!.date)} {c.next!.time}
            </span>
          </Link>
        ))}
        {items.length === 0 && <span className="text-[12.5px] text-mute">Duke ngarkuar disponueshmërinë…</span>}
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

  // real, live figures for the hero — computed from the public directory
  const firstFree = useMemo(() => (consultants.data ?? []).find((c) => c.next) ?? null, [consultants.data]);
  const avgRating = useMemo(() => {
    const rated = (consultants.data ?? []).filter((c) => c.review_count > 0);
    if (!rated.length) return null;
    return rated.reduce((a, c) => a + Number(c.rating), 0) / rated.length;
  }, [consultants.data]);
  const heroStats: [string, string][] = [
    [consultants.data ? String(consultants.data.length) : "—", "konsulentë aktivë"],
    [avgRating ? `${avgRating.toFixed(1)}★` : "—", "vlerësimi mesatar"],
    [services.data ? String(services.data.length) : "—", "shërbime aktive"],
  ];

  return (
    <div className="bg-graph">
      {/* ── HERO ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-ambient pointer-events-none" aria-hidden="true" />
        <div className="max-w-6xl mx-auto px-4 pt-14 lg:pt-20 pb-24 grid lg:grid-cols-[1.05fr_0.95fr] gap-14 items-start relative">
          <div className="anim-fade-up">
            <div className="inline-flex items-center gap-2 bg-card border border-line rounded-full pl-2 pr-3.5 py-1.5 shadow-soft">
              <span className="bg-primary-600 text-primary-50 rounded-full px-2 py-0.5 text-[10.5px] font-bold font-mono tracking-wide">SPSS 29</span>
              <span className="text-[12.5px] font-semibold text-ink-2">Konsulentë të verifikuar · Rezervim në kohë reale</span>
            </div>
            <h1 className="font-display text-[42px] leading-[1.04] sm:text-6xl font-bold tracking-tight text-ink mt-6">
              Analiza statistikore,<br />
              <span className="text-primary-600">më e qartë.</span>
            </h1>
            <p className="text-lg text-mute mt-5 max-w-lg leading-relaxed">
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
            <div className="grid grid-cols-3 gap-6 mt-12 max-w-md">
              {heroStats.map(([v, l]) => (
                <div key={l} className="border-l-2 border-line pl-3.5">
                  <p className="font-display text-[22px] font-bold text-ink tracking-tight tabular-nums">{v}</p>
                  <p className="text-[11.5px] text-mute mt-0.5">{l}</p>
                </div>
              ))}
            </div>
          </div>
          <ScatterHero />
        </div>
        <LiveSlotStrip />
      </section>

      {/* ── SERVICES ── */}
      <section id="sherbimet" className="max-w-6xl mx-auto px-4 py-20">
        <div className="flex items-end justify-between gap-4 mb-8">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary-600 mb-2">01 — Shërbimet</div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink">Çdo analizë ka specialistin e vet</h2>
          </div>
          <Link to="/rezervo" className="hidden sm:inline-flex items-center gap-2 text-sm font-bold text-primary-700 hover:gap-3 transition-all">Rezervo tani <IArrowR size={15} /></Link>
        </div>
        {services.loading && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
        )}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
          {(services.data ?? []).map((s) => (
            <Link key={s.id} to={`/rezervo?service=${s.slug}`}
              className="card p-5 group hover:shadow-lift hover:-translate-y-1 transition-all duration-200 flex flex-col">
              <div className="flex items-center justify-between">
                <Badge tone="info">{SERVICE_CATEGORY[s.category] ?? s.category}</Badge>
                <span className="font-mono text-xs text-mute">{fmtDuration(s.default_duration_minutes)}</span>
              </div>
              <h3 className="font-display font-bold text-ink text-lg mt-3.5 group-hover:text-primary-700 transition-colors">{s.name}</h3>
              <p className="text-[13.5px] text-mute mt-1.5 leading-relaxed flex-1">{s.short_description}</p>
              <div className="flex items-center justify-between mt-4 pt-3.5 border-t border-line">
                <span className="font-display font-bold text-ink">{s.payment_policy === "deposit" ? <span>nga <span className="text-primary-600">{fmtEuro(s.deposit_amount)}</span></span> : <span className="text-primary-600">{fmtEuro(s.default_price)}</span>}</span>
                <span className="w-7 h-7 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center group-hover:bg-primary-600 group-hover:text-primary-50 transition-colors"><IArrowR size={14} /></span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="si-funksionon" className="bg-ink text-paper py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-graph-dark opacity-60" />
        <div className="max-w-6xl mx-auto px-4 relative">
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary-300 mb-2">02 — Procesi</div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-12">Nga pyetja te përgjigja, në pesë hapa</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { n: "01", title: "Zgjidh shërbimin", desc: "Nga konsulta e shpejtë te mbështetja e doktoraturës.", icon: <ISigma size={18} /> },
              { n: "02", title: "Zgjidh konsulentin", desc: "Ose lër platformën të gjejë më të përshtatshmin.", icon: <IUser size={18} /> },
              { n: "03", title: "Zgjidh datën dhe orën", desc: "Kalendar në kohë reale, pa shkëmbim emailesh.", icon: <ICal size={18} /> },
              { n: "04", title: "Dërgo materialet", desc: "Seti i të dhënave dhe pyetja hulumtuese, në mënyrë të sigurt.", icon: <IDoc size={18} /> },
              { n: "05", title: "Merr konsultën online", desc: "Google Meet, ndarje ekrani, raportim APA.", icon: <IVideo size={18} /> },
            ].map((step, i) => (
              <div key={step.n} className="relative bg-paper/[0.04] border border-paper/10 rounded-xl p-5 hover:bg-paper/[0.07] hover:border-primary-400/40 transition-all group">
                {i < 4 && <span className="hidden lg:block absolute top-1/2 -right-[13px] text-primary-400/60 z-10"><IArrowR size={14} /></span>}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[12px] text-primary-300">{step.n}</span>
                  <span className="text-primary-300 group-hover:text-primary-200 transition-colors">{step.icon}</span>
                </div>
                <h3 className="font-display font-bold mt-4">{step.title}</h3>
                <p className="text-[13px] text-paper/55 mt-1.5 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONSULTANTS ── */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="flex items-end justify-between gap-4 mb-8">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary-600 mb-2">03 — Konsulentët</div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink">Ekspertë me përvojë reale hulumtimi</h2>
          </div>
          <Link to="/konsulentet" className="hidden sm:inline-flex items-center gap-2 text-sm font-bold text-primary-700 hover:gap-3 transition-all">Të gjithë <IArrowR size={15} /></Link>
        </div>
        {consultants.loading && <div className="grid md:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}</div>}
        <div className="grid md:grid-cols-3 gap-4 stagger">
          {(consultants.data ?? []).filter((c) => c.is_featured || consultants.data!.indexOf(c) < 3).slice(0, 3).map((c) => (
            <Link key={c.id} to={`/konsulentet/${c.slug}`} className="card p-6 group hover:shadow-lift hover:-translate-y-1 transition-all duration-200">
              <div className="flex items-center gap-4">
                <Avatar name={c.display_name} size={56} />
                <div className="min-w-0">
                  <h3 className="font-display font-bold text-ink group-hover:text-primary-700 transition-colors truncate">{c.display_name}</h3>
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
          ))}
        </div>
      </section>

      {/* ── WHY US / RESEARCH SUPPORT ── */}
      <section className="max-w-6xl mx-auto px-4 py-4 pb-20 grid lg:grid-cols-[0.9fr_1.1fr] gap-10 items-start">
        <div className="lg:sticky lg:top-24">
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary-600 mb-2">04 — Pse StatLab</div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink">Jo thjesht booking.<br />Një platformë e plotë hulumtimi.</h2>
          <p className="text-mute mt-4 leading-relaxed max-w-md">
            Çdo projekt ka hapësirën e vet: skedarë privatë, workflow analize me faza, pagesa me komision transparent dhe raportim të verifikuar.
          </p>
          <div className="mt-7 space-y-3.5">
            {[
              { icon: <IShield size={17} />, title: "Të dhëna të mbrojtura", desc: "Storage privat, URL të nënshkruara, RLS dhe konsente GDPR." },
              { icon: <ISpark size={17} />, title: "Përputhje inteligjente", desc: "Platforma zgjedh konsulentin sipas specializimit, gjuhës dhe ngarkesës." },
              { icon: <IScatter size={17} />, title: "Workflow SPSS i plotë", desc: "Nga pastrimi i të dhënave deri te tabela APA — me progres të dukshëm." },
            ].map((f) => (
              <div key={f.title} className="flex gap-3.5 items-start card p-4">
                <span className="w-9 h-9 rounded-lg bg-primary-600 text-primary-50 flex items-center justify-center shrink-0">{f.icon}</span>
                <div>
                  <p className="font-bold text-ink text-[14.5px]">{f.title}</p>
                  <p className="text-[13px] text-mute mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          {[
            { icon: <IGraduation size={20} />, level: "Diplomë (Bachelor)", desc: "Udhëheqje nga tema te mbrojtja — metodologjia, analizat bazë (t-test, ANOVA, korelacion) dhe përgatitja për pyetjet e komisionit.", price: "nga €50" },
            { icon: <IFlask size={20} />, level: "Master", desc: "Bashkëpunim i vazhdueshëm: dizajni hulumtues, besueshmëria e shkallëve, regresioni dhe raportimi i plotë APA për tezën.", price: "nga €100" },
            { icon: <ISigma size={20} />, level: "Doktoraturë & Publikime", desc: "Analiza multivariate, madhësia e mostrës, modelet e avancuara dhe përgatitja e rezultateve për revista ndërkombëtare.", price: "nga €120" },
          ].map((r) => (
            <div key={r.level} className="card p-6 hover:shadow-lift transition-all group">
              <div className="flex items-start gap-4">
                <span className="w-11 h-11 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0 group-hover:bg-primary-600 group-hover:text-primary-50 transition-colors">{r.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-display font-bold text-ink text-lg">{r.level}</h3>
                    <span className="font-mono text-[13px] font-bold text-primary-600">{r.price}</span>
                  </div>
                  <p className="text-[13.5px] text-mute mt-1.5 leading-relaxed">{r.desc}</p>
                </div>
              </div>
            </div>
          ))}
          <div className="bg-primary-600 rounded-xl p-6 text-primary-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="font-display font-bold text-lg">Keni një rast specifik?</p>
              <p className="text-primary-100 text-[13.5px] mt-0.5">Konsulencë sipas porosisë — formati dhe përmbajtja përcaktohen bashkë.</p>
            </div>
            <Link to="/rezervo?service=konsulence-porosi">
              <Button variant="dark" className="!bg-ink hover:!bg-primary-900">Fillo rezervimin</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── REVIEWS ── */}
      <section className="bg-card border-y border-line py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary-600 mb-2">05 — Vlerësimet</div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink mb-8">Vetëm nga konsulta të verifikuara</h2>
          {reviews.loading && <div className="grid md:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}</div>}
          <div className="grid md:grid-cols-3 gap-4 stagger">
            {(reviews.data ?? []).slice(0, 6).map((r) => (
              <div key={r.id} className="border border-line rounded-xl p-5 bg-paper/50 hover:bg-card hover:shadow-soft transition-all">
                <div className="flex items-center justify-between">
                  <Stars value={r.rating} size={13} />
                  <Badge tone="ok"><ICheck size={11} /> Konsultë e verifikuar</Badge>
                </div>
                <p className="text-[13.5px] text-ink-2 mt-3.5 leading-relaxed">“{r.comment}”</p>
                <div className="flex items-center gap-2.5 mt-4 pt-3.5 border-t border-line">
                  <Avatar name={r.client_name} size={30} />
                  <div>
                    <p className="text-[12.5px] font-bold text-ink">{r.client_name}</p>
                    <p className="text-[11.5px] text-mute">{r.service_name} · {r.consultant_name}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="max-w-3xl mx-auto px-4 py-20">
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary-600 mb-2 text-center">06 — Pyetjet e shpeshta</div>
        <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink text-center mb-10">Gjithçka që duhet të dini</h2>
        <div className="space-y-2.5">
          {FAQS.map((f, i) => (
            <div key={f.q} className={cls("card overflow-hidden transition-all", openFaq === i && "border-primary-300")}>
              <button onClick={() => setOpenFaq(openFaq === i ? -1 : i)} className="w-full flex items-center justify-between gap-4 p-5 text-left">
                <span className="font-display font-bold text-ink text-[15px]">{f.q}</span>
                <IChevD size={16} className={cls("text-mute shrink-0 transition-transform duration-200", openFaq === i && "rotate-180 text-primary-600")} />
              </button>
              {openFaq === i && <p className="px-5 pb-5 text-[14px] text-mute leading-relaxed anim-fade-in">{f.a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-6xl mx-auto px-4 pb-4">
        <div className="bg-ink rounded-2xl overflow-hidden relative">
          <div className="absolute inset-0 bg-graph-dark opacity-50" />
          <svg className="absolute right-0 bottom-0 opacity-20" width="420" height="220" viewBox="0 0 420 220" fill="none">
            <path d="M0 200 Q 105 40 210 110 T 420 60" stroke="#8fabf7" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M0 180 Q 105 90 210 140 T 420 100" stroke="#c98d08" strokeWidth="2" strokeDasharray="4 7" strokeLinecap="round" />
          </svg>
          <div className="relative px-6 sm:px-12 py-14 grid sm:grid-cols-[1fr_auto] gap-8 items-center">
            <div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-paper">Gati të qartësoni analizën tuaj?</h2>
              <p className="text-paper/60 mt-2.5 max-w-xl">Rezervoni në më pak se dy minuta. Pa shkëmbim emailesh, pa pritje — vetëm një termin me specialistin e duhur.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/rezervo"><Button size="lg" className="!bg-primary-500 hover:!bg-primary-400">{t("nav.book")}</Button></Link>
              <Link to="/konsulentet"><Button size="lg" variant="outline" className="!border-paper/25 !text-paper hover:!border-primary-300">Shiko konsulentët</Button></Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
