import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useApp, useAsync } from "../lib/store";
import {
  listActiveServices, listPublicConsultants, previewMatch, previewFirstAvailable,
  bookingSlots, bookingMonthCapacity, getIntakeForService, createBooking,
  getManageView, rescheduleByToken, cancelByToken, addToWaitlist,
  type PublicConsultant, type BookingResult, type ManageView,
} from "../lib/services";
import { SPECIALIZATIONS, LANGUAGES, SERVICE_CATEGORY, STUDY_LEVEL, SPSS_LEVEL, APPT_STATUS } from "../lib/i18n";
import { fmtEuro, fmtDate, fmtDateLong, fmtDuration, daysUntil, cls, parseISO } from "../lib/utils";
import type { IntakeTemplate, Session } from "../types";
import { Avatar, Badge, Button, Card, Field, Modal, Select, Skeleton, Spinner, Stars, TextArea, TextInput, Toggle } from "../components/ui";
import { BookingCalendar } from "../components/calendar";
import { ICheck, IClock, ISpark, IUser, IArrowR, IChevL, IWarn, IShield, ILink, IVideo, ICal, IDoc } from "../components/icons";

const STEPS = ["Shërbimi", "Konsulenti", "Termini", "Të dhënat", "Pagesa", "Konfirmimi"];
const ALLOWED = [".sav", ".spv", ".xlsx", ".csv", ".docx", ".pdf"];

type Mode = "specific" | "first_available" | "best_match";

export default function Booking() {
  const { session, toast } = useApp();
  const [params] = useSearchParams();
  const services = useAsync(() => listActiveServices(), []);
  const consultants = useAsync(() => listPublicConsultants(), []);

  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("specific");
  const [consultantId, setConsultantId] = useState<string | null>(null);
  const [resolved, setResolved] = useState<{ consultant: PublicConsultant; reasons: string[]; autoDate?: string; autoTime?: string } | null>(null);
  const [resolving, setResolving] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [monthCap, setMonthCap] = useState<Record<string, string>>({});
  const [slots, setSlots] = useState<string[] | null>(null);
  const [capLoading, setCapLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [intake, setIntake] = useState<IntakeTemplate | null>(null);
  const [intakeVals, setIntakeVals] = useState<Record<string, string>>({});
  const [paying, setPaying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BookingResult | null>(null);
  const [err, setErr] = useState("");
  const [stripeOpen, setStripeOpen] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", phone: "", university: "",
    study_level: "master", language: "sq", research_topic: "", problem_description: "",
    spss_experience: "basic", required_analysis: "",
  });
  const [consents, setConsents] = useState({ privacy: false, terms: false, data: false });
  const [file, setFile] = useState<{ name: string; size: number; ext: string } | null>(null);
  const [fileErr, setFileErr] = useState("");

  // preselect from query params
  useEffect(() => {
    const sSlug = params.get("service");
    const cSlug = params.get("consultant");
    if (sSlug && services.data) {
      const s = services.data.find((x) => x.slug === sSlug || x.id === sSlug);
      if (s) setServiceId(s.id);
    }
    if (cSlug && consultants.data) {
      const c = consultants.data.find((x) => x.slug === cSlug);
      if (c) { setMode("specific"); setConsultantId(c.id); if (serviceId) setStep(2); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services.data, consultants.data]);

  useEffect(() => {
    if (session?.user.role === "client") {
      const parts = session.user.full_name.split(" ");
      setForm((f) => ({
        ...f,
        first_name: f.first_name || (parts.length > 1 ? parts.slice(0, -1).join(" ") : session.user.full_name),
        last_name: f.last_name || (parts.length > 1 ? parts[parts.length - 1] : ""),
        email: f.email || session.user.email,
        phone: f.phone || session.user.phone,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user_id]);

  const service = useMemo(() => (services.data ?? []).find((s) => s.id === serviceId) ?? null, [services.data, serviceId]);
  const offeringConsultants = useMemo(
    () => (consultants.data ?? []).filter((c) => c.services.some((s) => s.service_id === serviceId)),
    [consultants.data, serviceId],
  );
  const consultant = useMemo(() => {
    if (resolved) return resolved.consultant;
    return (consultants.data ?? []).find((c) => c.id === consultantId) ?? null;
  }, [resolved, consultants.data, consultantId]);

  const offer = useMemo(() => consultant?.services.find((s) => s.service_id === serviceId) ?? null, [consultant, serviceId]);
  const duration = offer?.duration_minutes ?? service?.default_duration_minutes ?? 60;
  const price = offer?.price ?? service?.default_price ?? 0;

  // load intake template when service chosen
  useEffect(() => {
    if (!serviceId) return;
    getIntakeForService(serviceId).then((t) => { setIntake(t); setIntakeVals({}); });
  }, [serviceId]);

  // resolve auto consultant when entering step 2 (Termini)
  useEffect(() => {
    if (step !== 2 || !serviceId) return;
    if (mode === "specific") { setResolved(null); return; }
    let alive = true;
    setResolving(true);
    const run: Promise<{ consultant: PublicConsultant; reasons: string[]; autoDate?: string; autoTime?: string } | null> =
      mode === "best_match"
        ? previewMatch(serviceId, form.language).then((m) => (m ? { consultant: m.consultant, reasons: m.reasons } : null))
        : previewFirstAvailable(serviceId).then((f) => (f ? { consultant: f.consultant, reasons: ["Konsulenti i parë i lirë që ofron shërbimin"], autoDate: f.date, autoTime: f.time } : null));
    run.then((r) => {
      if (!alive) return;
      if (!r) { setErr("Nuk ka asnjë konsulent të disponueshëm për këtë shërbim. Provoni një shërbim tjetër."); setStep(1); }
      else { setResolved(r); setDate(r.autoDate ?? null); if (r.autoDate) setDate(r.autoDate); }
    }).finally(() => alive && setResolving(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, mode, serviceId]);

  // month capacity for calendar (reloads when the user flips months)
  const [calYM, setCalYM] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }));
  useEffect(() => {
    if (step !== 2 || !consultant || !serviceId) return;
    let alive = true;
    setCapLoading(true);
    bookingMonthCapacity(consultant.id, calYM.y, calYM.m, duration)
      .then((c) => alive && setMonthCap(c))
      .finally(() => alive && setCapLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, consultant?.id, duration, calYM]);

  // slots for chosen date
  useEffect(() => {
    if (step !== 2 || !consultant || !date) { setSlots(null); return; }
    let alive = true;
    setSlotsLoading(true);
    bookingSlots(consultant.id, date, duration)
      .then((s) => alive && setSlots(s))
      .finally(() => alive && setSlotsLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, consultant?.id, date, duration]);

  const capacityMap = useMemo(() => new Map(Object.entries(monthCap)) as Map<string, import("../lib/availability").DayCapacity>, [monthCap]);

  const next = async () => {
    setErr("");
    if (step === 0 && !serviceId) { setErr("Zgjidhni një shërbim për të vazhduar."); return; }
    if (step === 1 && mode === "specific" && !consultantId) { setErr("Zgjidhni një konsulent ose një nga opsionet automatike."); return; }
    if (step === 2 && (!date || !time)) { setErr("Zgjidhni datën dhe orën."); return; }
    if (step === 3) {
      if (!form.first_name.trim() || !form.last_name.trim()) { setErr("Emri dhe mbiemri janë të detyrueshëm."); return; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) { setErr("Email-i nuk është i vlefshëm."); return; }
      const missing = (intake?.fields ?? []).filter((f) => f.required && !intakeVals[f.key]?.trim());
      if (missing.length) { setErr(`Plotësoni fushat: ${missing.map((m) => m.label).join(", ")}`); return; }
      if (!consents.privacy || !consents.terms) { setErr("Duhet të pranoni kushtet dhe politikën e privatësisë."); return; }
    }
    if (step === 4) { setStep(5); return; }
    setStep(step + 1);
  };

  const doPayAndBook = async () => {
    if (!service || !date || !time) return;
    setSubmitting(true);
    setErr("");
    try {
      const res = await createBooking(session as Session | null, {
        service_id: service.id,
        consultant_mode: mode,
        consultant_id: mode === "specific" ? consultantId ?? undefined : consultant?.id,
        date, start_time: time,
        client: { ...form, study_level: form.study_level as never, spss_experience: form.spss_experience as never },
        intake: intakeVals,
        file: file ? { name: file.name, size: file.size, type: file.ext, category: "dataset" } : null,
        payment_choice: payChoice,
        consents,
      });
      setResult(res);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gabim gjatë rezervimit.");
      setStep(2);
    } finally { setSubmitting(false); setStripeOpen(false); }
  };

  const policy = service?.payment_policy ?? "full";
  const deposit = service?.deposit_amount ?? Math.round(price * 0.3);
  const [payChoice, setPayChoice] = useState<"pay_now_full" | "pay_now_deposit" | "pay_later">("pay_now_full");
  useEffect(() => {
    if (policy === "deposit") setPayChoice("pay_now_deposit");
    else if (policy === "free_booking") setPayChoice("pay_later");
    else setPayChoice("pay_now_full");
  }, [policy, serviceId]);

  const payAmount = payChoice === "pay_now_deposit" ? deposit : price;

  // ── confirmation screen ──
  if (result) {
    const a = result.appointment;
    return (
      <div className="min-h-screen bg-graph">
        <div className="max-w-2xl mx-auto px-4 py-16">
          <div className="card p-8 anim-scale-in text-center">
            <div className="w-16 h-16 rounded-full bg-ok-soft text-ok flex items-center justify-center mx-auto"><ICheck size={30} /></div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink mt-5">Rezervimi u pranua!</h1>
            <p className="text-mute mt-2">
              {a.status === "confirmed" ? "Pagesa u verifikua dhe termini u konfirmua menjëherë." : "Rezervimi po pret konfirmimin nga platforma — do të njoftoheni me email."}
            </p>
            <div className="bg-paper border border-line rounded-xl p-5 mt-6 text-left">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-mute">Numri i referencës</span>
                <span className="font-mono font-bold text-primary-700 text-lg">{a.reference}</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mt-4 text-[13.5px]">
                <p><span className="text-mute">Konsulenti:</span> <b>{a.consultant_id && consultant?.display_name}</b></p>
                <p><span className="text-mute">Shërbimi:</span> <b>{service?.name}</b></p>
                <p><span className="text-mute">Data:</span> <b>{fmtDateLong(a.date)} · {a.start_time}–{a.end_time}</b></p>
                <p><span className="text-mute">Zgjatja:</span> <b>{fmtDuration(a.duration_minutes)}</b></p>
                <p><span className="text-mute">Çmimi:</span> <b>{fmtEuro(a.price)}</b></p>
                <p><span className="text-mute">Statusi:</span> <Badge tone={APPT_STATUS[a.status].tone}>{APPT_STATUS[a.status].label}</Badge></p>
              </div>
              {a.meeting_url && (
                <a href={a.meeting_url} target="_blank" rel="noreferrer" className="mt-4 flex items-center gap-2 bg-primary-600 text-primary-50 rounded-lg px-4 h-11 font-semibold text-sm justify-center hover:bg-primary-700 transition-colors">
                  <IVideo size={16} /> Hap linkun e takimit (Google Meet)
                </a>
              )}
            </div>
            {result.created_account && (
              <div className="bg-warn-soft border border-[#eadfc0] rounded-xl p-4 mt-4 text-left text-[13px] text-warn font-medium">
                U krijua llogaria juaj e klientit me email <b>{form.email}</b>. Fjalëkalimi i përkohshëm: <b className="font-mono">{result.temp_password}</b> — ndryshojeni në portal.
              </div>
            )}
            <div className="bg-paper border border-line rounded-xl p-4 mt-4 text-left">
              <p className="text-[12px] text-mute flex items-center gap-1.5"><ILink size={13} /> Link i sigurt menaxhimi (rizhvendosje/anulim):</p>
              <Link to={`/menaxho/${a.manage_token}`} className="font-mono text-[12.5px] text-primary-700 underline break-all">/menaxho/{a.manage_token.slice(0, 18)}…</Link>
            </div>
            {result.match_reasons.length > 0 && (
              <div className="text-left mt-4">
                <p className="text-[12px] font-bold text-mute uppercase tracking-wider mb-2">Pse ky konsulent</p>
                <div className="flex flex-wrap gap-1.5">{result.match_reasons.map((r) => <Badge key={r} tone="teal">{r}</Badge>)}</div>
              </div>
            )}
            <div className="flex flex-wrap justify-center gap-3 mt-7">
              <Link to="/client"><Button variant="outline">Shko te portali i klientit</Button></Link>
              <Button variant="ghost" onClick={() => { setResult(null); setStep(0); setServiceId(null); setConsultantId(null); setDate(null); setTime(null); setResolved(null); }}>Rezervo një tjetër</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-graph">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary-600">Rezervim online</div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink mt-1">Rezervo konsultën</h1>
          </div>
          {step > 0 && !submitting && (
            <Button variant="ghost" size="sm" onClick={() => setStep(Math.max(0, step - 1))}><IChevL size={14} /> Kthehu</Button>
          )}
        </div>

        <div className="grid lg:grid-cols-[210px_1fr_280px] gap-6 items-start">
          {/* LEFT: progress */}
          <div className="card p-4 lg:sticky lg:top-24 hidden sm:block">
            {STEPS.map((s, i) => (
              <button key={s} onClick={() => i < step && setStep(i)}
                className={cls("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                  i === step ? "bg-primary-600 text-primary-50" : i < step ? "text-primary-700 hover:bg-primary-50 cursor-pointer" : "text-mute cursor-default")}>
                <span className={cls("w-6 h-6 rounded-full flex items-center justify-center text-[11.5px] font-bold shrink-0 border",
                  i === step ? "bg-primary-50/20 border-primary-50/40" : i < step ? "bg-ok-soft border-transparent text-ok" : "border-line-2")}>
                  {i < step ? <ICheck size={12} /> : i + 1}
                </span>
                <span className="text-[13.5px] font-semibold">{s}</span>
              </button>
            ))}
            <div className="mt-3 pt-3 border-t border-line px-3">
              <p className="text-[11px] text-mute flex items-center gap-1.5"><IShield size={12} /> Disponueshmëria verifikohet në server para çdo rezervimi.</p>
            </div>
          </div>

          {/* CENTER */}
          <div className="min-w-0">
            {err && <div className="mb-4 bg-bad-soft border border-[#ecc9c9] text-bad rounded-xl px-4 py-3 text-[13.5px] font-semibold flex items-center gap-2.5 anim-fade-in"><IWarn size={16} /> {err}</div>}

            {step === 0 && (
              <div className="anim-fade-in">
                <h2 className="font-display text-lg font-bold text-ink mb-4">Çfarë ju nevojitet?</h2>
                {services.loading && <div className="grid sm:grid-cols-2 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>}
                <div className="grid sm:grid-cols-2 gap-3 stagger">
                  {(services.data ?? []).map((s) => (
                    <button key={s.id} onClick={() => { setServiceId(s.id); setTime(null); setDate(null); }}
                      className={cls("text-left card p-4.5 p-5 transition-all",
                        serviceId === s.id ? "!border-primary-500 ring-2 ring-primary-100 shadow-soft" : "hover:border-primary-300 hover:-translate-y-0.5")}>
                      <div className="flex items-center justify-between">
                        <Badge tone="info">{SERVICE_CATEGORY[s.category]}</Badge>
                        {serviceId === s.id && <span className="w-5 h-5 rounded-full bg-primary-600 text-primary-50 flex items-center justify-center"><ICheck size={11} /></span>}
                      </div>
                      <p className="font-display font-bold text-ink mt-2.5">{s.name}</p>
                      <p className="text-[12.5px] text-mute mt-1 line-clamp-2">{s.short_description}</p>
                      <div className="flex items-center justify-between mt-3 text-[12.5px]">
                        <span className="font-mono text-mute">{fmtDuration(s.default_duration_minutes)}</span>
                        <span className="font-bold text-primary-700">{s.payment_policy === "deposit" ? `depozitë ${fmtEuro(s.deposit_amount)}` : fmtEuro(s.default_price)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 1 && service && (
              <div className="anim-fade-in">
                <h2 className="font-display text-lg font-bold text-ink mb-1">Kush do t'ju ndihmojë?</h2>
                <p className="text-[13.5px] text-mute mb-4">Zgjidhni një konsulent që ofron <b className="text-ink-2">{service.name}</b>, ose lëreni platformën të zgjedhë.</p>

                <div className="grid sm:grid-cols-2 gap-3 mb-4">
                  <button onClick={() => { setMode("best_match"); setConsultantId(null); setResolved(null); setDate(null); setTime(null); }}
                    className={cls("text-left card p-4 transition-all relative overflow-hidden",
                      mode === "best_match" ? "!border-primary-500 ring-2 ring-primary-100" : "hover:border-primary-300")}>
                    <span className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-primary-50" />
                    <ISpark size={18} className="text-primary-600" />
                    <p className="font-display font-bold text-ink mt-2">Le të zgjedhë platforma</p>
                    <p className="text-[12.5px] text-mute mt-1">Konsulenti më i përshtatshëm sipas specializimit, gjuhës, vlerësimit dhe ngarkesës — jo rastësisht.</p>
                    {mode === "best_match" && <Badge tone="info" className="mt-2.5">Zgjedhja aktive</Badge>}
                  </button>
                  <button onClick={() => { setMode("first_available"); setConsultantId(null); setResolved(null); setDate(null); setTime(null); }}
                    className={cls("text-left card p-4 transition-all relative overflow-hidden",
                      mode === "first_available" ? "!border-primary-500 ring-2 ring-primary-100" : "hover:border-primary-300")}>
                    <span className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-ok-soft" />
                    <IClock size={18} className="text-ok" />
                    <p className="font-display font-bold text-ink mt-2">Konsulenti i parë i lirë</p>
                    <p className="text-[12.5px] text-mute mt-1">Termini më i afërt i mundshëm te çdokush që ofron këtë shërbim.</p>
                    {mode === "first_available" && <Badge tone="ok" className="mt-2.5">Zgjedhja aktive</Badge>}
                  </button>
                </div>

                <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-mute mb-2.5">— ose zgjidhni vetë —</p>
                {consultants.loading && <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>}
                {offeringConsultants.length === 0 && !consultants.loading && (
                  <Card className="p-6 text-center">
                    <p className="font-bold text-ink">Nuk ka konsulentë që e ofrojnë këtë shërbim.</p>
                    <Button size="sm" className="mt-3" onClick={() => setWaitlistOpen(true)}>Regjistrohu në listën e pritjes</Button>
                  </Card>
                )}
                <div className="space-y-2.5 stagger">
                  {offeringConsultants.map((c) => {
                    const of = c.services.find((s) => s.service_id === serviceId)!;
                    return (
                      <button key={c.id} onClick={() => { setMode("specific"); setConsultantId(c.id); setResolved(null); setTime(null); }}
                        className={cls("w-full text-left card p-4 flex items-center gap-4 transition-all",
                          mode === "specific" && consultantId === c.id ? "!border-primary-500 ring-2 ring-primary-100" : "hover:border-primary-300")}>
                        <Avatar name={c.display_name} size={48} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-display font-bold text-ink">{c.display_name}</p>
                            {c.is_featured && <ISpark size={13} className="text-amber" />}
                          </div>
                          <p className="text-[12px] text-mute truncate">{c.professional_title}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Stars value={c.rating} size={11} />
                            <span className="text-[11.5px] text-mute font-semibold">{c.rating.toFixed(1)} ({c.review_count})</span>
                            {c.next && <span className="text-[11px] font-semibold text-ok ml-1">{daysUntil(c.next.date) <= 1 ? (daysUntil(c.next.date) === 0 ? "Sot" : "Nesër") + " " + c.next.time : fmtDate(c.next.date)}</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-display font-bold text-primary-700">{fmtEuro(of.price)}</p>
                          <p className="text-[11px] text-mute font-mono">{fmtDuration(of.duration_minutes)}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 2 && service && (
              <div className="anim-fade-in">
                <h2 className="font-display text-lg font-bold text-ink mb-4">Kur ju përshtatet?</h2>
                {resolving && (
                  <div className="card p-8 flex flex-col items-center justify-center">
                    <Spinner />
                    <p className="text-sm font-semibold text-ink mt-3">Platforma po zgjedh konsulentin më të përshtatshëm…</p>
                    <p className="text-[12.5px] text-mute mt-1">Krahasohen specializimet, gjuha, vlerësimet dhe ngarkesa javore.</p>
                  </div>
                )}
                {!resolving && consultant && (
                  <>
                    {mode !== "specific" && resolved && (
                      <div className="card p-4 mb-4 border-primary-200 bg-primary-50/50 anim-fade-in">
                        <p className="text-[11px] font-mono uppercase tracking-wider text-primary-700 mb-2">Platforma zgjodhi</p>
                        <div className="flex items-center gap-3">
                          <Avatar name={consultant.display_name} size={42} />
                          <div className="flex-1">
                            <p className="font-display font-bold text-ink">{consultant.display_name}</p>
                            <p className="text-[12px] text-mute">{consultant.professional_title}</p>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => setStep(1)}>Ndrysho</Button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-3">{resolved.reasons.slice(0, 4).map((r) => <Badge key={r} tone="teal">{r}</Badge>)}</div>
                      </div>
                    )}
                    <div className="grid md:grid-cols-2 gap-4 items-start">
                      <div className="relative">
                        {capLoading && <div className="absolute inset-0 bg-card/60 backdrop-blur-[1px] z-10 rounded-xl flex items-center justify-center"><Spinner /></div>}
                        <BookingCalendar capacity={capacityMap} selected={date} onSelect={(d) => { setDate(d); setTime(null); }} onMonthChange={(y, m) => setCalYM({ y, m })} />
                      </div>
                      <div className="card p-5">
                        <p className="font-display font-bold text-ink mb-1">{date ? fmtDateLong(date) : "Zgjidhni një datë"}</p>
                        <p className="text-[12.5px] text-mute mb-4">{date ? `Oraret e lira për ${fmtDuration(duration)} konsultë:` : "Oraret do të shfaqen këtu."}</p>
                        {date && slotsLoading && <div className="grid grid-cols-3 gap-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>}
                        {date && !slotsLoading && slots && slots.length === 0 && (
                          <div className="text-center py-8">
                            <p className="font-bold text-ink">Nuk ka termin të lirë.</p>
                            <p className="text-[12.5px] text-mute mt-1">Kjo ditë është e plotësuar ose e bllokuar.</p>
                            <Button size="sm" variant="outline" className="mt-3" onClick={() => setWaitlistOpen(true)}>Regjistrohu në listën e pritjes</Button>
                          </div>
                        )}
                        {date && !slotsLoading && slots && slots.length > 0 && (
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 stagger">
                            {slots.map((s) => (
                              <button key={s} onClick={() => setTime(s)}
                                className={cls("h-10 rounded-lg border text-[13.5px] font-bold font-mono transition-all",
                                  time === s ? "bg-primary-600 border-primary-600 text-primary-50 shadow-soft scale-[1.04]" : "border-line-2 text-ink-2 hover:border-primary-400 hover:text-primary-700")}>
                                {s}
                              </button>
                            ))}
                          </div>
                        )}
                        {date && !slotsLoading && slots && slots.length > 0 && (
                          <p className="text-[11.5px] text-mute mt-4 flex items-center gap-1.5"><ICheck size={12} className="text-ok" /> Orari verifikohet sërish në server në momentin e rezervimit.</p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="anim-fade-in space-y-5">
                <div>
                  <h2 className="font-display text-lg font-bold text-ink mb-4">Të dhënat tuaja</h2>
                  <div className="card p-5 grid sm:grid-cols-2 gap-4">
                    <Field label="Emri" required><TextInput value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></Field>
                    <Field label="Mbiemri" required><TextInput value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></Field>
                    <Field label="Email" required><TextInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                    <Field label="Telefoni"><TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
                    <Field label="Universiteti / Institucioni"><TextInput value={form.university} onChange={(e) => setForm({ ...form, university: e.target.value })} /></Field>
                    <Field label="Niveli i studimeve">
                      <Select value={form.study_level} onChange={(e) => setForm({ ...form, study_level: e.target.value })}>
                        {Object.entries(STUDY_LEVEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </Select>
                    </Field>
                    <Field label="Gjuha e konsulencës">
                      <Select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
                        {Object.entries(LANGUAGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </Select>
                    </Field>
                    <Field label="Përvoja me SPSS">
                      <Select value={form.spss_experience} onChange={(e) => setForm({ ...form, spss_experience: e.target.value })}>
                        {Object.entries(SPSS_LEVEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </Select>
                    </Field>
                    <Field label="Tema e hulumtimit" className="sm:col-span-2"><TextInput value={form.research_topic} onChange={(e) => setForm({ ...form, research_topic: e.target.value })} placeholder="p.sh. Motivimi dhe performanca në sektorin publik" /></Field>
                    <Field label="Përshkrimi i problemit" className="sm:col-span-2"><TextArea value={form.problem_description} onChange={(e) => setForm({ ...form, problem_description: e.target.value })} placeholder="Çfarë ju nevojitet konkretisht nga kjo konsultë?" /></Field>
                    <Field label="Analiza e nevojshme" className="sm:col-span-2"><TextInput value={form.required_analysis} onChange={(e) => setForm({ ...form, required_analysis: e.target.value })} placeholder="p.sh. Cronbach's Alpha, korelacion, regresion i shumëfishtë…" /></Field>
                  </div>
                </div>

                {intake && (
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-primary-600 mb-2">Pyetësor i shpejtë për {service?.name}</p>
                    <div className="card p-5 grid sm:grid-cols-2 gap-4">
                      {intake.fields.map((f) => (
                        <Field key={f.key} label={f.label} required={f.required} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                          {f.type === "textarea" ? (
                            <TextArea value={intakeVals[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => setIntakeVals({ ...intakeVals, [f.key]: e.target.value })} />
                          ) : f.type === "select" ? (
                            <Select value={intakeVals[f.key] ?? ""} onChange={(e) => setIntakeVals({ ...intakeVals, [f.key]: e.target.value })}>
                              <option value="">Zgjidhni…</option>
                              {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                            </Select>
                          ) : f.type === "radio" ? (
                            <div className="flex flex-wrap gap-2">
                              {(f.options ?? []).map((o) => (
                                <button type="button" key={o} onClick={() => setIntakeVals({ ...intakeVals, [f.key]: o })}
                                  className={cls("px-3 h-9 rounded-lg border text-[13px] font-semibold transition-all",
                                    intakeVals[f.key] === o ? "bg-primary-600 border-primary-600 text-primary-50" : "border-line-2 text-ink-2 hover:border-primary-300")}>
                                  {o}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <TextInput type={f.type === "number" ? "number" : "text"} value={intakeVals[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => setIntakeVals({ ...intakeVals, [f.key]: e.target.value })} />
                          )}
                        </Field>
                      ))}
                    </div>
                  </div>
                )}

                <div className="card p-5">
                  <p className="font-display font-bold text-ink mb-1">Skedari i të dhënave <span className="text-mute font-sans font-normal text-[12.5px]">(opsionale)</span></p>
                  <p className="text-[12.5px] text-mute mb-3">Lejohen: {ALLOWED.join(" ")} · deri 25 MB · ruhet në storage privat</p>
                  <label className={cls("border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors text-center",
                    file ? "border-ok bg-ok-soft/40" : "border-line-2 hover:border-primary-300 hover:bg-primary-50/40")}>
                    <IDoc size={22} className={file ? "text-ok" : "text-mute"} />
                    <input type="file" className="hidden" accept={ALLOWED.join(",")} onChange={(e) => {
                      const f = e.target.files?.[0];
                      setFileErr("");
                      if (!f) return;
                      const ext = "." + (f.name.split(".").pop() ?? "").toLowerCase();
                      if (!ALLOWED.includes(ext)) { setFileErr(`Format i palejuar: ${ext}`); return; }
                      if (f.size > 25 * 1024 * 1024) { setFileErr("Skedari tejkalon 25 MB."); return; }
                      setFile({ name: f.name, size: f.size, ext });
                    }} />
                    {file ? (
                      <p className="text-[13px] font-bold text-ink mt-2">{file.name} <span className="text-mute font-normal">({Math.round(file.size / 1024)} KB)</span></p>
                    ) : (
                      <p className="text-[13px] font-semibold text-ink-2 mt-2">Klikoni për të ngarkuar setin e të dhënave</p>
                    )}
                  </label>
                  {fileErr && <p className="text-xs text-bad font-semibold mt-2">{fileErr}</p>}
                </div>

                <div className="card p-5 space-y-3">
                  <p className="font-display font-bold text-ink">Pëlqimet</p>
                  {([
                    ["privacy", "Pranoj Politikën e Privatësisë", true],
                    ["terms", "Pranoj Kushtet e Shërbimit", true],
                    ["data", "Pajtohem me përpunimin e të dhënave të hulumtimit për qëllime të konsulencës", false],
                  ] as [keyof typeof consents, string, boolean][]).map(([key, label, req]) => (
                    <label key={key} className="flex items-start gap-3 cursor-pointer group">
                      <input type="checkbox" checked={consents[key]} onChange={(e) => setConsents({ ...consents, [key]: e.target.checked })}
                        className="mt-0.5 w-4 h-4 accent-[#1b44cc]" />
                      <span className="text-[13.5px] text-ink-2 group-hover:text-ink transition-colors">
                        {label} {req && <span className="text-bad">*</span>}
                        {key === "privacy" && <Link to="/privatesia" className="text-primary-600 underline ml-1">Lexo</Link>}
                        {key === "terms" && <Link to="/kushtet" className="text-primary-600 underline ml-1">Lexo</Link>}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {step === 4 && service && (
              <div className="anim-fade-in">
                <h2 className="font-display text-lg font-bold text-ink mb-4">Si dëshironi të paguani?</h2>
                <div className="space-y-3 max-w-xl">
                  {policy !== "deposit" && (
                    <button onClick={() => setPayChoice("pay_now_full")}
                      className={cls("w-full text-left card p-5 flex items-center justify-between transition-all", payChoice === "pay_now_full" ? "!border-primary-500 ring-2 ring-primary-100" : "hover:border-primary-300")}>
                      <div>
                        <p className="font-display font-bold text-ink">Pagesa e plotë tani</p>
                        <p className="text-[12.5px] text-mute mt-0.5">Rezervimi konfirmohet menjëherë + linku i takimit.</p>
                      </div>
                      <span className="font-display font-bold text-primary-700 text-lg">{fmtEuro(price)}</span>
                    </button>
                  )}
                  {policy === "deposit" && (
                    <button onClick={() => setPayChoice("pay_now_deposit")}
                      className={cls("w-full text-left card p-5 flex items-center justify-between transition-all", payChoice === "pay_now_deposit" ? "!border-primary-500 ring-2 ring-primary-100" : "hover:border-primary-300")}>
                      <div>
                        <p className="font-display font-bold text-ink">Parapagimi (depozita)</p>
                        <p className="text-[12.5px] text-mute mt-0.5">Balanca prej {fmtEuro(price - deposit)} paguhet pas konsulencës.</p>
                      </div>
                      <span className="font-display font-bold text-primary-700 text-lg">{fmtEuro(deposit)}</span>
                    </button>
                  )}
                  <button onClick={() => setPayChoice("pay_later")}
                    className={cls("w-full text-left card p-5 flex items-center justify-between transition-all", payChoice === "pay_later" ? "!border-primary-500 ring-2 ring-primary-100" : "hover:border-primary-300")}>
                    <div>
                      <p className="font-display font-bold text-ink">Paguan më vonë</p>
                      <p className="text-[12.5px] text-mute mt-0.5">Rezervimi mbetet në pritje konfirmimi nga platforma.</p>
                    </div>
                    <Badge tone="warn">Në pritje</Badge>
                  </button>
                </div>
                <div className="card p-5 mt-4 max-w-xl">
                  <p className="text-[13px] text-mute flex items-center gap-2"><IShield size={15} className="text-primary-600" /> Pagesat procesohen nga <b className="text-ink">Stripe</b>. StatLab nuk ruan kurrë të dhënat e kartës suaj. Pagesa verifikohet në server para konfirmimit.</p>
                </div>
              </div>
            )}

            {step === 5 && service && (
              <div className="anim-fade-in">
                <h2 className="font-display text-lg font-bold text-ink mb-4">Konfirmoni rezervimin</h2>
                <div className="card p-6 max-w-xl">
                  <div className="flex items-center gap-4 pb-4 border-b border-line">
                    <Avatar name={consultant?.display_name ?? "?"} size={52} />
                    <div>
                      <p className="font-display font-bold text-ink">{consultant?.display_name}</p>
                      <p className="text-[12.5px] text-mute">{consultant?.professional_title}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 py-4 text-[13.5px] border-b border-line">
                    <p className="text-mute">Shërbimi</p><p className="font-bold text-ink text-right">{service.name}</p>
                    <p className="text-mute">Data</p><p className="font-bold text-ink text-right">{fmtDateLong(date!)} · {time}</p>
                    <p className="text-mute">Zgjatja</p><p className="font-bold text-ink text-right">{fmtDuration(duration)}</p>
                    <p className="text-mute">Klienti</p><p className="font-bold text-ink text-right">{form.first_name} {form.last_name}</p>
                    <p className="text-mute">Gjuha</p><p className="font-bold text-ink text-right">{LANGUAGES[form.language] ?? form.language}</p>
                    <p className="text-mute">Pagesa</p>
                    <p className="font-bold text-ink text-right">
                      {payChoice === "pay_later" ? "Më vonë" : payChoice === "pay_now_deposit" ? `Depozitë ${fmtEuro(deposit)}` : fmtEuro(price)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between py-4">
                    <span className="text-mute text-[13.5px]">Totali</span>
                    <span className="font-display font-bold text-2xl text-primary-700">{fmtEuro(payChoice === "pay_now_deposit" ? deposit : price)}</span>
                  </div>
                  {payChoice === "pay_later" ? (
                    <Button size="lg" className="w-full" loading={submitting} onClick={doPayAndBook}>Konfirmo rezervimin</Button>
                  ) : (
                    <Button size="lg" className="w-full" loading={submitting} onClick={() => { setPaying(true); setStripeOpen(true); }}>
                      Paguaj {fmtEuro(payAmount)} me Stripe
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* nav buttons */}
            {step < 5 && (
              <div className="flex items-center justify-between mt-6">
                <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}><IChevL size={14} /> Prapa</Button>
                <Button onClick={next} size="lg">Vazhdo <IArrowR size={15} /></Button>
              </div>
            )}
          </div>

          {/* RIGHT: live summary */}
          <div className="card p-5 lg:sticky lg:top-24 anim-fade-up order-first lg:order-none">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute mb-3.5">Përmbledhja</p>
            <div className="space-y-3.5">
              <SummaryRow done={!!service} label="Shërbimi" value={service?.name} />
              <SummaryRow done={!!consultant} label="Konsulenti" value={consultant ? `${consultant.display_name}` : mode !== "specific" ? "Automatik" : undefined}
                sub={consultant ? `${fmtEuro(offer?.price ?? 0)} · ${fmtDuration(duration)}` : undefined} />
              <SummaryRow done={!!date && !!time} label="Termini" value={date ? `${fmtDate(date)} · ${time ?? "—"}` : undefined} />
              <SummaryRow done={!!form.first_name && !!form.email} label="Klienti" value={form.first_name ? `${form.first_name} ${form.last_name}`.trim() : undefined} />
              <SummaryRow done={false} label="Pagesa" value={payChoice === "pay_now_deposit" ? `Depozitë ${fmtEuro(deposit)}` : payChoice === "pay_later" ? "Më vonë" : price ? fmtEuro(price) : undefined} />
            </div>
            <div className="border-t border-line mt-4 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-ink">Totali</span>
                <span className="font-display font-bold text-xl text-primary-700">{fmtEuro(payChoice === "pay_now_deposit" ? deposit : price)}</span>
              </div>
              {policy === "deposit" && payChoice !== "pay_later" && (
                <p className="text-[11.5px] text-mute mt-1">+ {fmtEuro(price - deposit)} balanca pas konsulencës</p>
              )}
            </div>
            {file && <p className="text-[11.5px] text-mute mt-3 flex items-center gap-1.5"><IDoc size={12} /> {file.name}</p>}
          </div>
        </div>
      </div>

      <StripeModal open={stripeOpen} onClose={() => setStripeOpen(false)} amount={payAmount}
        onSuccess={doPayAndBook} processing={paying && submitting} />
      <WaitlistModal open={waitlistOpen} onClose={() => setWaitlistOpen(false)} serviceId={serviceId} consultantId={mode === "specific" ? consultantId : null} />
    </div>
  );
}

function SummaryRow({ done, label, value, sub }: { done: boolean; label: string; value?: string; sub?: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className={cls("w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 border transition-colors",
        done ? "bg-ok-soft border-transparent text-ok" : "border-line-2 text-line-2")}>
        {done ? <ICheck size={11} /> : <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-mute uppercase tracking-wider">{label}</p>
        <p className={cls("text-[13.5px] font-bold truncate", done ? "text-ink" : "text-mute/60")}>{value ?? "—"}</p>
        {sub && <p className="text-[11.5px] text-mute">{sub}</p>}
      </div>
    </div>
  );
}

function StripeModal({ open, onClose, amount, onSuccess, processing }: {
  open: boolean; onClose: () => void; amount: number; onSuccess: () => void; processing: boolean;
}) {
  const [card, setCard] = useState({ number: "4242 4242 4242 4242", exp: "12/27", cvc: "123", name: "" });
  const [step, setStep] = useState<"form" | "processing" | "done">("form");
  useEffect(() => { if (open) setStep("form"); }, [open]);
  const pay = () => {
    setStep("processing");
    setTimeout(() => { setStep("done"); setTimeout(onSuccess, 700); }, 1400);
  };
  return (
    <Modal open={open} onClose={onClose} title={
      <span className="flex items-center gap-2">Stripe · Pagesë e sigurt <IShield size={15} className="text-primary-600" /></span>
    }>
      {step === "form" && (
        <div className="space-y-4">
          <div className="bg-paper border border-line rounded-xl p-4 flex items-center justify-between">
            <span className="text-[13.5px] text-mute">StatLab — Konsulencë</span>
            <span className="font-display font-bold text-xl text-ink">{fmtEuro(amount)}</span>
          </div>
          <Field label="Numri i kartës"><TextInput value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} className="font-mono" /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Skadenca" className="col-span-1"><TextInput value={card.exp} onChange={(e) => setCard({ ...card, exp: e.target.value })} className="font-mono" /></Field>
            <Field label="CVC"><TextInput value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value })} className="font-mono" /></Field>
            <Field label="Emri"><TextInput value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} /></Field>
          </div>
          <Button className="w-full" size="lg" onClick={pay}>Paguaj {fmtEuro(amount)}</Button>
          <p className="text-[11.5px] text-mute text-center">Demo — kartat 4242… funksionojnë. Suksesi verifikohet nga serveri (webhook simulim).</p>
        </div>
      )}
      {step === "processing" && (
        <div className="py-10 flex flex-col items-center">
          <Spinner />
          <p className="font-bold text-ink mt-4">Duke procesuar pagesën…</p>
          <p className="text-[12.5px] text-mute mt-1">Mos e mbyllni dritaren.</p>
        </div>
      )}
      {step === "done" && (
        <div className="py-10 flex flex-col items-center">
          <div className="w-14 h-14 rounded-full bg-ok-soft text-ok flex items-center justify-center anim-scale-in"><ICheck size={26} /></div>
          <p className="font-bold text-ink mt-4">Pagesa u autorizua</p>
          <p className="text-[12.5px] text-mute mt-1">Duke verifikuar në server dhe duke konfirmuar terminin…</p>
        </div>
      )}
    </Modal>
  );
}

function WaitlistModal({ open, onClose, serviceId, consultantId }: {
  open: boolean; onClose: () => void; serviceId: string | null; consultantId: string | null;
}) {
  const { toast } = useApp();
  const services = useAsync(() => listActiveServices(), []);
  const [f, setF] = useState({ name: "", email: "", phone: "", preferred_dates: "", preferred_time: "Paradite" });
  const [sending, setSending] = useState(false);
  const submit = async () => {
    if (!f.name || !f.email) { toast("Plotësoni emrin dhe email-in.", "bad"); return; }
    setSending(true);
    try {
      await addToWaitlist({ ...f, service_id: serviceId, consultant_id: consultantId });
      toast("U regjistruat në listën e pritjes. Do t'ju njoftojmë sapo të hapet një termin.");
      setF({ name: "", email: "", phone: "", preferred_dates: "", preferred_time: "Paradite" });
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gabim.", "bad");
    } finally { setSending(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Lista e pritjes">
      <div className="space-y-4">
        <p className="text-[13.5px] text-mute">Nuk ka termin të lirë tani? Regjistrohuni dhe do t'ju njoftojmë menjëherë sapo të hapet një vend që përputhet me preferencat tuaja.</p>
        <Field label="Emri i plotë" required><TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Email" required><TextInput type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Telefoni"><TextInput value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Datat e preferuara"><TextInput value={f.preferred_dates} onChange={(e) => setF({ ...f, preferred_dates: e.target.value })} placeholder="p.sh. java tjetër" /></Field>
          <Field label="Ora e preferuar">
            <Select value={f.preferred_time} onChange={(e) => setF({ ...f, preferred_time: e.target.value })}>
              {["Paradite", "Pasdite", "Mbrëmje", "Çfarëdo"].map((o) => <option key={o}>{o}</option>)}
            </Select>
          </Field>
        </div>
        <Button className="w-full" loading={sending} onClick={submit}>Regjistrohu në listën e pritjes</Button>
      </div>
    </Modal>
  );
}

// ─── Secure manage page (reschedule / cancel by token) ───────────────────────
export function ManageBooking() {
  const { token } = useParams();
  const { toast } = useApp();
  const view = useAsync(() => getManageView(token ?? ""), [token]);
  const [action, setAction] = useState<"none" | "reschedule" | "cancel">("none");
  const [newDate, setNewDate] = useState<string | null>(null);
  const [newTime, setNewTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);

  const mv = view.data as ManageView | null;

  useEffect(() => {
    if (action !== "reschedule" || !mv || !newDate) { setSlots(null); return; }
    let alive = true;
    setSlots(null);
    bookingSlots(mv.appointment.consultant_id, newDate, mv.appointment.duration_minutes)
      .then((s) => alive && setSlots(s));
    return () => { alive = false; };
  }, [action, newDate, mv?.appointment.consultant_id, mv?.appointment.duration_minutes]);

  if (view.loading) return <div className="max-w-2xl mx-auto px-4 py-20"><Skeleton className="h-72 rounded-xl" /></div>;
  if (view.error || !mv) return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center">
      <div className="card p-8 anim-fade-up">
        <IWarn size={28} className="text-warn mx-auto" />
        <h1 className="font-display text-xl font-bold text-ink mt-3">Link i pavlefshëm</h1>
        <p className="text-[13.5px] text-mute mt-2">{view.error ?? "Ky link menaxhimi nuk ekziston ose ka skaduar."}</p>
        <Link to="/"><Button variant="outline" className="mt-5">Kthehu në faqen kryesore</Button></Link>
      </div>
    </div>
  );

  const a = mv.appointment;
  const days14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + 1 + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  const doReschedule = async () => {
    if (!newDate || !newTime) { toast("Zgjidhni datën dhe orën e re.", "bad"); return; }
    setBusy(true);
    try {
      const fresh = await rescheduleByToken(token!, newDate, newTime);
      toast("Termini u rizhvendos me sukses!");
      view.retry();
      setAction("none"); setNewDate(null); setNewTime(null);
      void fresh;
    } catch (e) { toast(e instanceof Error ? e.message : "Gabim.", "bad"); } finally { setBusy(false); }
  };

  const doCancel = async () => {
    setBusy(true);
    try {
      await cancelByToken(token!, reason);
      toast("Rezervimi u anulua.");
      view.retry();
      setConfirmCancel(false);
    } catch (e) { toast(e instanceof Error ? e.message : "Gabim.", "bad"); } finally { setBusy(false); }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary-600 mb-2">Menaxhimi i rezervimit</div>
      <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">Rezervimi {a.reference}</h1>
      <div className="card p-6 mt-6 anim-fade-up">
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5 text-[13.5px]">
          <p className="text-mute">Shërbimi</p><p className="font-bold text-ink text-right">{a.service_name}</p>
          <p className="text-mute">Konsulenti</p><p className="font-bold text-ink text-right">{a.consultant_name}</p>
          <p className="text-mute">Data</p><p className="font-bold text-ink text-right">{fmtDateLong(a.date)} · {a.start_time}–{a.end_time}</p>
          <p className="text-mute">Çmimi</p><p className="font-bold text-ink text-right">{fmtEuro(a.price)}</p>
          <p className="text-mute">Statusi</p><p className="text-right"><Badge tone={APPT_STATUS[a.status].tone}>{APPT_STATUS[a.status].label}</Badge></p>
        </div>
        {a.history.length > 0 && (
          <div className="mt-4 pt-4 border-t border-line">
            <p className="text-[11px] font-mono uppercase tracking-wider text-mute mb-2">Historia e ndryshimeve</p>
            {a.history.map((h, i) => (
              <p key={i} className="text-[12.5px] text-ink-2">
                {fmtDate(h.old_date)} {h.old_start} → <b>{fmtDate(h.new_date)} {h.new_start}</b>
                <span className="text-mute"> · {h.changed_by} ({h.changed_by_role}) · {fmtDate(h.changed_at.slice(0, 10))}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      {["pending", "confirmed"].includes(a.status) && action === "none" && (
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <button onClick={() => mv.can_reschedule ? setAction("reschedule") : toast(mv.reschedule_reason, "bad")}
            className={cls("card p-5 text-left transition-all", mv.can_reschedule ? "hover:border-primary-400 hover:shadow-soft" : "opacity-55 cursor-not-allowed")}>
            <p className="font-display font-bold text-ink flex items-center gap-2"><ICal size={16} className="text-primary-600" /> Rizhvendos terminin</p>
            <p className="text-[12.5px] text-mute mt-1">{mv.can_reschedule ? `Lejohet deri ${mv.min_reschedule_hours} orë para terminit.` : mv.reschedule_reason}</p>
          </button>
          <button onClick={() => mv.can_cancel ? setConfirmCancel(true) : toast(mv.cancel_reason, "bad")}
            className={cls("card p-5 text-left transition-all", mv.can_cancel ? "hover:border-bad hover:shadow-soft" : "opacity-55 cursor-not-allowed")}>
            <p className="font-display font-bold text-ink flex items-center gap-2"><IWarn size={16} className="text-bad" /> Anulo rezervimin</p>
            <p className="text-[12.5px] text-mute mt-1">{mv.can_cancel ? `Lejohet deri ${mv.min_cancel_hours} orë para terminit.` : mv.cancel_reason}</p>
          </button>
        </div>
      )}

      {action === "reschedule" && (
        <div className="card p-6 mt-4 anim-fade-up">
          <p className="font-display font-bold text-ink mb-4">Zgjidhni terminin e ri</p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            {days14.map((d) => (
              <button key={d} onClick={() => { setNewDate(d); setNewTime(null); }}
                className={cls("shrink-0 w-[74px] rounded-xl border py-2.5 text-center transition-all",
                  newDate === d ? "bg-primary-600 border-primary-600 text-primary-50 shadow-soft" : "border-line-2 hover:border-primary-300")}>
                <span className={cls("block text-[10.5px] font-bold uppercase", newDate === d ? "text-primary-100" : "text-mute")}>
                  {["Die", "Hën", "Mar", "Mër", "Enj", "Pre", "Sob"][parseISO(d).getDay()]}
                </span>
                <span className="block font-display font-bold text-[15px]">{parseISO(d).getDate()}/{parseISO(d).getMonth() + 1}</span>
              </button>
            ))}
          </div>
          {newDate && (
            <div className="mt-4">
              {!slots && <div className="grid grid-cols-4 gap-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>}
              {slots && slots.length === 0 && <p className="text-[13.5px] font-semibold text-bad bg-bad-soft rounded-lg px-4 py-3">Nuk ka orare të lira më {fmtDateLong(newDate)}. Provoni një ditë tjetër.</p>}
              {slots && slots.length > 0 && (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 stagger">
                  {slots.map((s) => (
                    <button key={s} onClick={() => setNewTime(s)}
                      className={cls("h-10 rounded-lg border font-mono text-[13px] font-bold transition-all",
                        newTime === s ? "bg-primary-600 border-primary-600 text-primary-50" : "border-line-2 text-ink-2 hover:border-primary-400")}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex gap-3 mt-5">
            <Button variant="ghost" onClick={() => setAction("none")}>Kthehu</Button>
            <Button loading={busy} disabled={!newDate || !newTime} onClick={doReschedule} className="flex-1">Konfirmo rizhvendosjen</Button>
          </div>
        </div>
      )}

      <Modal open={confirmCancel} onClose={() => setConfirmCancel(false)} title="Anulo rezervimin">
        <p className="text-[13.5px] text-mute">Jeni të sigurt që dëshironi të anuloni terminin <b className="text-ink">{fmtDateLong(a.date)} në {a.start_time}</b> me {a.consultant_name}?</p>
        <Field label="Arsyeja (opsionale)" className="mt-4">
          <TextArea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Na ndihmoni të përmirësohemi…" />
        </Field>
        <div className="flex gap-3 mt-5">
          <Button variant="ghost" onClick={() => setConfirmCancel(false)}>Kthehu</Button>
          <Button variant="danger" loading={busy} onClick={doCancel} className="flex-1">Po, anulo</Button>
        </div>
      </Modal>
    </div>
  );
}
