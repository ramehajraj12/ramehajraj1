import React, { useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useApp, useAsync } from "../lib/store";
import { listPublicConsultants, getConsultantBySlug, listActiveServices, submitApplication, listReviews } from "../lib/services";
import { SPECIALIZATIONS, LANGUAGES, SERVICE_CATEGORY, DAYS_SQ } from "../lib/i18n";
import { fmtEuro, fmtDate, fmtDuration, daysUntil, cls } from "../lib/utils";
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Field, Select, SearchInput, Skeleton, Stars, TableSkeleton, TextArea, TextInput, Toggle } from "../components/ui";
import { IArrowR, ICheck, IClock, IGraduation, ISpark, IUser, ICal, IShield, ISigma } from "../components/icons";

// ─── Directory ────────────────────────────────────────────────────────────────
export function Directory() {
  const consultants = useAsync(() => listPublicConsultants(), []);
  const services = useAsync(() => listActiveServices(), []);
  const [q, setQ] = useState("");
  const [spec, setSpec] = useState("all");
  const [lang, setLang] = useState("all");
  const [service, setService] = useState("all");
  const [sort, setSort] = useState<"rating" | "price" | "reviews">("rating");

  const filtered = useMemo(() => {
    let list = consultants.data ?? [];
    if (q) {
      const s = q.toLowerCase();
      list = list.filter((c) => c.display_name.toLowerCase().includes(s) || c.professional_title.toLowerCase().includes(s) || c.bio.toLowerCase().includes(s));
    }
    if (spec !== "all") list = list.filter((c) => c.specializations.includes(spec));
    if (lang !== "all") list = list.filter((c) => c.languages.includes(lang));
    if (service !== "all") list = list.filter((c) => c.services.some((s) => s.service_id === service));
    return [...list].sort((a, b) =>
      sort === "rating" ? b.rating - a.rating : sort === "price" ? a.starting_price - b.starting_price : b.review_count - a.review_count);
  }, [consultants.data, q, spec, lang, service, sort]);

  return (
    <div className="bg-graph min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary-600 mb-2">Drejtoria e konsulentëve</div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink">Zgjidhni specialistin e duhur</h1>
        <p className="text-mute mt-2 max-w-xl">Të gjithë konsulentët janë të verifikuar — çmimet, specializimet dhe disponueshmëria janë të plota dhe në kohë reale.</p>

        <div className="card p-4 mt-8 grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <SearchInput value={q} onChange={setQ} placeholder="Emri, titulli, tema…" />
          <Select value={service} onChange={(e) => setService(e.target.value)}>
            <option value="all">Çdo shërbim</option>
            {(services.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Select value={spec} onChange={(e) => setSpec(e.target.value)}>
            <option value="all">Çdo specializim</option>
            {Object.entries(SPECIALIZATIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Select value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="all">Çdo gjuhë</option>
            {Object.entries(LANGUAGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="rating">Vlerësimi më i lartë</option>
            <option value="price">Çmimi më i ulët</option>
            <option value="reviews">Më shumë vlerësime</option>
          </Select>
        </div>

        {consultants.loading && <div className="grid md:grid-cols-2 gap-4 mt-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}</div>}
        {consultants.error && <ErrorState message={consultants.error} onRetry={consultants.retry} />}
        {!consultants.loading && filtered.length === 0 && (
          <Card className="mt-6"><EmptyState title="Asnjë konsulent nuk u gjet" hint="Provoni të ndryshoni filtrat ose regjistrohuni në listën e pritjes." action={<Link to="/rezervo"><Button>Zgjidh për mua platforma</Button></Link>} /></Card>
        )}
        <div className="grid md:grid-cols-2 gap-4 mt-6 stagger">
          {filtered.map((c) => (
            <div key={c.id} className="card p-6 hover:shadow-lift transition-all duration-200 flex flex-col">
              <div className="flex items-start gap-4">
                <Avatar name={c.display_name} size={60} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-display font-bold text-ink text-lg truncate">{c.display_name}</h2>
                    {c.is_featured && <Badge tone="warn"><ISpark size={11} /> I veçuar</Badge>}
                  </div>
                  <p className="text-[13px] text-mute truncate">{c.professional_title}</p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Stars value={c.rating} size={12} />
                    <span className="text-[12px] font-semibold text-mute">{c.rating.toFixed(1)} · {c.review_count} vlerësime të verifikuara</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-4">
                {c.specializations.slice(0, 4).map((sp) => (
                  <span key={sp} className="text-[11px] font-semibold bg-paper border border-line rounded-md px-2 py-1 text-ink-2">{SPECIALIZATIONS[sp] ?? sp}</span>
                ))}
                {c.specializations.length > 4 && <span className="text-[11px] text-mute font-semibold py-1">+{c.specializations.length - 4}</span>}
              </div>
              <div className="flex items-center gap-3 text-[12.5px] text-mute mt-3.5">
                <span>{c.languages.map((l) => LANGUAGES[l] ?? l).join(" · ")}</span>
                <span>·</span>
                <span>{c.years_experience} vite përvojë</span>
              </div>
              <div className="flex items-center justify-between mt-5 pt-4 border-t border-line">
                <div>
                  <p className="text-[11px] text-mute">Nis nga</p>
                  <p className="font-display font-bold text-ink text-lg leading-tight">{fmtEuro(c.starting_price)}</p>
                </div>
                {c.next && (
                  <p className="text-[12px] font-semibold text-ok bg-ok-soft px-2.5 py-1.5 rounded-lg">
                    <IClock size={12} className="inline mr-1.5 -mt-0.5" />
                    {daysUntil(c.next.date) === 0 ? "Sot" : daysUntil(c.next.date) === 1 ? "Nesër" : fmtDate(c.next.date)} · {c.next.time}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2.5 mt-5">
                <Link to={`/konsulentet/${c.slug}`}>
                  <Button variant="outline" className="w-full">Shiko profilin</Button>
                </Link>
                <Link to={`/rezervo?consultant=${c.slug}`}>
                  <Button className="w-full">Rezervo termin</Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Consultant profile ───────────────────────────────────────────────────────
export function ConsultantProfile() {
  const { slug } = useParams();
  const nav = useNavigate();
  const data = useAsync(() => getConsultantBySlug(slug ?? ""), [slug]);

  if (data.loading) return <div className="max-w-6xl mx-auto px-4 py-12"><Skeleton className="h-64 rounded-xl" /><div className="grid md:grid-cols-3 gap-4 mt-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div></div>;
  if (data.error || !data.data) return <div className="max-w-3xl mx-auto px-4 py-20"><ErrorState message={data.error ?? "Profili nuk u gjet."} onRetry={data.retry} /></div>;
  const { consultant: c, reviews } = data.data;

  return (
    <div className="bg-graph min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <button onClick={() => nav(-1)} className="text-[13px] font-semibold text-mute hover:text-primary-700 transition-colors mb-6">← Kthehu te drejtoria</button>
        <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6 items-start">
          <div className="card p-6 sm:p-8 anim-fade-up">
            <div className="flex flex-col sm:flex-row items-start gap-5">
              <Avatar name={c.display_name} size={84} />
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">{c.display_name}</h1>
                  {c.is_featured && <Badge tone="warn"><ISpark size={11} /> I veçuar</Badge>}
                </div>
                <p className="text-mute mt-1">{c.professional_title}</p>
                <div className="flex flex-wrap items-center gap-3 mt-2.5">
                  <span className="flex items-center gap-1.5"><Stars value={c.rating} size={14} /><span className="text-[13px] font-bold text-ink">{c.rating.toFixed(1)}</span><span className="text-[12.5px] text-mute">({c.review_count} vlerësime të verifikuara)</span></span>
                  <span className="text-[12.5px] text-mute">{c.years_experience} vite përvojë</span>
                  <span className="text-[12.5px] text-mute">{c.languages.map((l) => LANGUAGES[l] ?? l).join(", ")}</span>
                </div>
              </div>
            </div>
            <p className="text-[14.5px] text-ink-2 leading-relaxed mt-6">{c.bio}</p>
            <div className="grid sm:grid-cols-2 gap-5 mt-7">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute mb-2.5">Edukimi</p>
                {c.education.map((e) => (
                  <p key={e} className="flex items-start gap-2 text-[13.5px] text-ink-2 py-1"><IGraduation size={15} className="text-primary-500 shrink-0 mt-0.5" /> {e}</p>
                ))}
              </div>
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute mb-2.5">Certifikimet</p>
                {c.certifications.length === 0 && <p className="text-[13px] text-mute">—</p>}
                {c.certifications.map((x) => (
                  <p key={x} className="flex items-start gap-2 text-[13.5px] text-ink-2 py-1"><ICheck size={15} className="text-ok shrink-0 mt-0.5" /> {x}</p>
                ))}
              </div>
            </div>
            <div className="mt-7">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute mb-2.5">Specializimet</p>
              <div className="flex flex-wrap gap-1.5">
                {c.specializations.map((sp) => (
                  <span key={sp} className="text-[12px] font-semibold bg-primary-50 text-primary-800 rounded-md px-2.5 py-1.5">{SPECIALIZATIONS[sp] ?? sp}</span>
                ))}
              </div>
            </div>
            <div className="mt-7">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute mb-2.5">Disponueshmëria javore</p>
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1.5">
                {c.weekly.map((w) => (
                  <div key={w.day} className="flex items-center justify-between text-[13px] py-1 border-b border-line/70">
                    <span className="font-semibold text-ink-2">{DAYS_SQ[w.day - 1]}</span>
                    <span className="font-mono text-[12px] text-mute">{w.windows.join(" · ")}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4 lg:sticky lg:top-24">
            <div className="card p-5 anim-fade-up" style={{ animationDelay: "0.1s" }}>
              <div className="flex items-center justify-between mb-3">
                <p className="font-display font-bold text-ink">Shërbimet & çmimet</p>
                {c.next && (
                  <Badge tone="ok"><IClock size={11} /> {daysUntil(c.next.date) === 0 ? "Sot" : daysUntil(c.next.date) === 1 ? "Nesër" : fmtDate(c.next.date)} {c.next.time}</Badge>
                )}
              </div>
              <div className="space-y-2">
                {c.services.map((s) => (
                  <Link key={s.service_id} to={`/rezervo?consultant=${c.slug}&service=${s.service_id}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-line hover:border-primary-300 hover:bg-primary-50/50 transition-all group">
                    <div>
                      <p className="text-[13.5px] font-bold text-ink group-hover:text-primary-700">{s.name}</p>
                      <p className="text-[11.5px] text-mute">{SERVICE_CATEGORY[s.category]} · {fmtDuration(s.duration_minutes)}</p>
                    </div>
                    <span className="font-display font-bold text-primary-700">{fmtEuro(s.price)}</span>
                  </Link>
                ))}
              </div>
              <Link to={`/rezervo?consultant=${c.slug}`} className="block mt-4">
                <Button className="w-full" size="lg">Rezervo termin <IArrowR size={15} /></Button>
              </Link>
              <p className="text-[11.5px] text-mute text-center mt-2.5 flex items-center justify-center gap-1.5"><IShield size={12} /> Pagesë e sigurt · Rizhvendosje falas deri 12 orë para</p>
            </div>

            <div className="card p-5">
              <p className="font-display font-bold text-ink mb-3">Vlerësimet e verifikuara</p>
              {reviews.length === 0 && <p className="text-sm text-mute">Ende pa vlerësime të publikuara.</p>}
              <div className="space-y-4">
                {reviews.slice(0, 4).map((r) => (
                  <div key={r.id} className="border-b border-line last:border-0 pb-4 last:pb-0">
                    <div className="flex items-center justify-between">
                      <Stars value={r.rating} size={12} />
                      <Badge tone="ok"><ICheck size={10} /> E verifikuar</Badge>
                    </div>
                    <p className="text-[13px] text-ink-2 mt-2 leading-relaxed">“{r.comment}”</p>
                    <p className="text-[11.5px] text-mute mt-1.5 font-semibold">Klient i verifikuar · {fmtDate(r.created_at.slice(0, 10))}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Become a consultant ─────────────────────────────────────────────────────
export function BecomeConsultant() {
  const { toast } = useApp();
  const [f, setF] = useState({
    name: "", email: "", phone: "", country: "", education: "", experience: "",
    spss_experience: "", methodology_experience: "", linkedin: "", motivation: "", cv_file: "",
  });
  const [specs, setSpecs] = useState<string[]>([]);
  const [langs, setLangs] = useState<string[]>(["sq"]);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!f.name || !f.email || !f.education || !f.motivation) { setErr("Plotësoni fushat e detyrueshme: emri, email, edukimi dhe motivimi."); return; }
    if (specs.length === 0) { setErr("Zgjidhni të paktën një specializim."); return; }
    setSending(true);
    try {
      await submitApplication({ ...f, specializations: specs, languages: langs });
      toast("Aplikimi u dërgua me sukses. Ekipi do t'ju kontaktojë brenda 3 ditësh.");
      setF({ name: "", email: "", phone: "", country: "", education: "", experience: "", spss_experience: "", methodology_experience: "", linkedin: "", motivation: "", cv_file: "" });
      setSpecs([]); setLangs(["sq"]);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Gabim gjatë dërgimit.");
    } finally { setSending(false); }
  };

  const chip = (list: string[], set: (v: string[]) => void, key: string, label: string) => {
    const active = list.includes(key);
    return (
      <button type="button" key={key} onClick={() => set(active ? list.filter((x) => x !== key) : [...list, key])}
        className={cls("px-3 py-1.5 rounded-lg border text-[12.5px] font-semibold transition-all",
          active ? "bg-primary-600 border-primary-600 text-primary-50 shadow-soft" : "border-line-2 text-ink-2 hover:border-primary-300")}>
        {label}
      </button>
    );
  };

  return (
    <div className="bg-graph min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-12 grid lg:grid-cols-[0.8fr_1.2fr] gap-10">
        <div className="lg:sticky lg:top-24 self-start">
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary-600 mb-2">Bëhu konsulent</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink">Ndani ekspertizën tuaj statistikore</h1>
          <p className="text-mute mt-3 leading-relaxed">Bashkohuni me një platformë që ju sjell klientë, menaxhon pagesat dhe mbron kohën tuaj. Komisioni standard: 20%.</p>
          <div className="mt-7 space-y-3">
            {[
              { t: "Kalendar i mençur", d: "Disponueshmëria javore, bllokimet dhe pushimet respektohen automatikisht." },
              { t: "Pagesa të sigurta", d: "Stripe, komision transparent dhe raport i qartë i të ardhurave." },
              { t: "Klientë të verifikuar", d: "Çdo rezervim vjen me kontekst të plotë hulumtimi para sesionit." },
            ].map((x) => (
              <div key={x.t} className="card p-4 flex gap-3.5">
                <span className="w-8 h-8 rounded-lg bg-ok-soft text-ok flex items-center justify-center shrink-0"><ICheck size={15} /></span>
                <div>
                  <p className="font-bold text-ink text-[14px]">{x.t}</p>
                  <p className="text-[12.5px] text-mute mt-0.5">{x.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <form onSubmit={submit} className="card p-6 sm:p-8 space-y-5 anim-fade-up">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Emri i plotë" required><TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Dr. Filan Fisteku" /></Field>
            <Field label="Email" required><TextInput type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="ju@universitet.edu" /></Field>
            <Field label="Telefoni"><TextInput value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+383…" /></Field>
            <Field label="Shteti"><TextInput value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} placeholder="Kosovë" /></Field>
          </div>
          <Field label="Edukimi" required><TextInput value={f.education} onChange={(e) => setF({ ...f, education: e.target.value })} placeholder="Master në Statistika të Aplikuara — Universiteti…" /></Field>
          <Field label="Përvoja profesionale"><TextArea value={f.experience} onChange={(e) => setF({ ...f, experience: e.target.value })} placeholder="Vitet, rolet, projektet hulumtuese…" /></Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Përvoja me SPSS"><TextArea value={f.spss_experience} onChange={(e) => setF({ ...f, spss_experience: e.target.value })} /></Field>
            <Field label="Përvoja në metodologji"><TextArea value={f.methodology_experience} onChange={(e) => setF({ ...f, methodology_experience: e.target.value })} /></Field>
          </div>
          <Field label="Specializimet" required>
            <div className="flex flex-wrap gap-2">{Object.entries(SPECIALIZATIONS).map(([k, v]) => chip(specs, setSpecs, k, v))}</div>
          </Field>
          <Field label="Gjuhët">
            <div className="flex flex-wrap gap-2">{Object.entries(LANGUAGES).map(([k, v]) => chip(langs, setLangs, k, v))}</div>
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="CV (emri i skedarit)"><TextInput value={f.cv_file} onChange={(e) => setF({ ...f, cv_file: e.target.value })} placeholder="cv_emri.pdf" /></Field>
            <Field label="LinkedIn"><TextInput value={f.linkedin} onChange={(e) => setF({ ...f, linkedin: e.target.value })} placeholder="linkedin.com/in/…" /></Field>
          </div>
          <Field label="Motivim i shkurtër" required><TextArea value={f.motivation} onChange={(e) => setF({ ...f, motivation: e.target.value })} placeholder="Pse dëshironi të bashkoheni me StatLab?" /></Field>
          {err && <p className="text-[13px] text-bad font-semibold bg-bad-soft rounded-lg px-3.5 py-2.5">{err}</p>}
          <Button type="submit" size="lg" loading={sending} className="w-full">Dërgo aplikimin</Button>
          <p className="text-[12px] text-mute text-center">Aplikimet shqyrtohen manualisht nga ekipi. Aprovimi nuk jep akses automatik — llogaria krijohet me ftesë të sigurt.</p>
        </form>
      </div>
    </div>
  );
}

// ─── Legal pages ──────────────────────────────────────────────────────────────
export function LegalPage({ kind }: { kind: "privacy" | "terms" }) {
  const content = kind === "privacy"
    ? {
      title: "Politika e Privatësisë", version: "v1.2",
      sections: [
        ["1. Të dhënat që mbledhim", "Emri, email, telefoni, institucioni, tema e hulumtimit dhe skedarët që ngarkoni (sete të dhënash, pyetësorë, punime). Nuk mbledhim kurrë të dhëna kartash — pagesat procesohen nga Stripe."],
        ["2. Si i mbrojmë skedarët e hulumtimit", "Skedarët ruhen në storage privat me qasje vetëm përmes URL-ve të nënshkruara me afat 10 minutash. Autorizimi zbatohet në nivel baze të dhënash (Row Level Security): asnjë klient nuk sheh skedarët e klientit tjetër, dhe konsulentët shohin vetëm skedarët e projekteve ku janë caktuar."],
        ["3. Konfidencialiteti i hulumtimit", "Konsulentët nënshkruajnë detyrim konfidencialiteti. Të dhënat e papërpunuara nuk përdoren kurrë për qëllime të tjera pa pëlqimin tuaj të shprehur."],
        ["4. Të drejtat tuaja (GDPR)", "Mund të kërkoni në çdo moment: eksportimin e plotë të të dhënave (portali → Profili → Eksporto), fshirjen e llogarisë me anonimzim, fshirjen e skedarëve të projektit dhe korrigjimin e të dhënave."],
        ["5. Pëlqimet", "Çdo pëlqim (privatësia, kushtet, përpunimi, konfidencialiteti) regjistrohet me version dhe kohë, dhe mund të tërhiqet duke na kontaktuar."],
      ],
    }
    : {
      title: "Kushtet e Shërbimit", version: "v1.2",
      sections: [
        ["1. Shërbimi", "StatLab lidh klientët me konsulentë të pavarur për konsulencë SPSS, analizë statistikore dhe metodologji hulumtimi. Platforma menaxhon rezervimet, pagesat dhe dorëzimet."],
        ["2. Rezervimet dhe anulimet", "Rizhvendosja lejohet deri në 12 orë dhe anulimi deri në 24 orë para terminit përmes linkut të sigurt të menaxhimit. Pas këtyre afateve, pagesa nuk rikthehet automatikisht."],
        ["3. Pagesat", "Çmimet përfshijnë TVSH-në sipas konfigurimit të platformës. Pagesat procesohen me Stripe; StatLab nuk ruan të dhëna kartash. Fatura lëshohet automatikisht."],
        ["4. Integriteti akademik", "Shërbimet janë konsulencë dhe mbështetje metodologjike. StatLab nuk shkruan punime në emër të studentëve dhe nuk toleron plagjiaturë; përgjegjësia për integritetin akademik mbetet te klienti."],
        ["5. Vlerësimet", "Vetëm klientët me konsulta të përfunduara mund të vlerësojnë. Vlerësimet publikohen pas moderimit nga ekipi."],
      ],
    };
  return (
    <div className="max-w-3xl mx-auto px-4 py-14">
      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary-600 mb-2">{content.version} · Përditësuar {fmtDate("2026-01-10")}</div>
      <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink">{content.title}</h1>
      <div className="mt-8 space-y-6">
        {content.sections.map(([t, b]) => (
          <div key={t} className="card p-6">
            <h2 className="font-display font-bold text-ink text-lg">{t}</h2>
            <p className="text-[14px] text-ink-2 leading-relaxed mt-2">{b}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
