import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApp, useAsync } from "../lib/store";
import {
  listAppointments, listProjects, getProjectDetail, listFiles, uploadFile, downloadFile,
  createSignedUrl, deleteFile, listPayments, verifyAndCompletePayment, listInvoices, getInvoice,
  myReviewableAppointments, submitReview, updateProfile, exportMyData, deleteMyAccount,
  myConsents, giveConsent,
  type AppointmentRow, type ProjectRow,
} from "../lib/services";
import {
  APPT_STATUS, PROJECT_STATUS, FILE_CATEGORY, TASK_STATUS, PAYMENT_STATUS, INVOICE_STATUS,
  STUDY_LEVEL, LANGUAGES,
} from "../lib/i18n";
import { fmtEuro, fmtDate, fmtDateLong, fmtDuration, fmtBytes, fmtDateTime, relativeTime, downloadBlob, cls, todayISO } from "../lib/utils";
import {
  Avatar, Badge, Button, Card, Drawer, EmptyState, ErrorState, Field, KV, Modal, Pagination,
  Progress, SearchInput, Select, Skeleton, Stars, TableSkeleton, Td, TextArea, TextInput, Th, Toggle,
} from "../components/ui";
import { PortalShell, type NavItem } from "../components/layout";
import { MiniAgenda } from "../components/calendar";
import { IGrid, ICal, IFolder, IFile, IEuro, IInvoice, IUser, IArrowR, IUpload, IDownload, ILink, IVideo, IStar, ICheck, IShield, ITrash, IEye, ISpark, IWarn } from "../components/icons";

const NAV: NavItem[] = [
  { to: "/client", label: "Paneli", icon: <IGrid size={16} />, end: true },
  { to: "/client/terminet", label: "Terminet", icon: <ICal size={16} /> },
  { to: "/client/projektet", label: "Projektet", icon: <IFolder size={16} /> },
  { to: "/client/dokumentet", label: "Dokumentet", icon: <IFile size={16} /> },
  { to: "/client/pagesat", label: "Pagesat", icon: <IEuro size={16} /> },
  { to: "/client/faturat", label: "Faturat", icon: <IInvoice size={16} /> },
  { to: "/client/profili", label: "Profili", icon: <IUser size={16} /> },
];

export function ClientShell({ children }: { children: React.ReactNode }) {
  return <PortalShell nav={NAV} title="Portali i klientit">{children}</PortalShell>;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export function ClientDashboard() {
  const { session } = useApp();
  const appts = useAsync(() => listAppointments(session, { upcoming: true }), [session?.user_id]);
  const projects = useAsync(() => listProjects(session), [session?.user_id]);
  const files = useAsync(() => listFiles(session), [session?.user_id]);
  const payments = useAsync(() => listPayments(session), [session?.user_id]);
  const reviewable = useAsync(() => myReviewableAppointments(session), [session?.user_id]);

  const today = todayISO();
  const next = (appts.data ?? []).find((a) => a.date >= today && a.status === "confirmed") ?? (appts.data ?? [])[0];
  const activeProject = (projects.data ?? []).find((p) => !["completed", "cancelled"].includes(p.status));
  const pendingPay = (payments.data ?? []).find((p) => p.status === "pending");
  const recentFiles = (files.data ?? []).slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Mirë se erdhët, {session?.user.full_name.split(" ")[0]} 👋</h1>
          <p className="text-mute text-sm mt-1">Përmbledhja e hulumtimit tuaj në një vend.</p>
        </div>
        <Link to="/rezervo"><Button>Rezervo konsultën <IArrowR size={14} /></Button></Link>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 stagger">
        <Card className="p-5">
          <p className="text-[11px] font-mono uppercase tracking-wider text-mute">Termini tjetër</p>
          {appts.loading ? <Skeleton className="h-10 mt-2" /> : next ? (
            <>
              <p className="font-display font-bold text-lg text-ink mt-1.5">{fmtDate(next.date)} · {next.start_time}</p>
              <p className="text-[12.5px] text-mute">{next.service_name} — {next.consultant_name}</p>
              {next.meeting_url && <a href={next.meeting_url} target="_blank" rel="noreferrer" className="text-[12.5px] font-bold text-primary-700 flex items-center gap-1.5 mt-1.5"><IVideo size={13} /> Linku i takimit</a>}
            </>
          ) : <p className="text-[13px] text-mute mt-2">Asnjë termin i ardhshëm.</p>}
        </Card>
        <Card className="p-5">
          <p className="text-[11px] font-mono uppercase tracking-wider text-mute">Projekti aktiv</p>
          {projects.loading ? <Skeleton className="h-10 mt-2" /> : activeProject ? (
            <>
              <p className="font-display font-bold text-[14.5px] text-ink mt-1.5 line-clamp-1">{activeProject.title}</p>
              <Progress value={activeProject.progress} className="mt-2.5" />
              <p className="text-[12px] font-mono text-mute mt-1.5">{activeProject.progress}% e përfunduar</p>
            </>
          ) : <p className="text-[13px] text-mute mt-2">Asnjë projekt aktiv.</p>}
        </Card>
        <Card className="p-5">
          <p className="text-[11px] font-mono uppercase tracking-wider text-mute">Pagesa në pritje</p>
          {payments.loading ? <Skeleton className="h-10 mt-2" /> : pendingPay ? (
            <>
              <p className="font-display font-bold text-lg text-ink mt-1.5">{fmtEuro(pendingPay.amount_gross)}</p>
              <p className="text-[12.5px] text-mute">{pendingPay.type === "deposit" ? "Depozitë" : pendingPay.type === "balance" ? "Balanca" : "Pagesë e plotë"}</p>
              <Link to="/client/pagesat" className="text-[12.5px] font-bold text-primary-700 mt-1.5 inline-block">Paguaj tani →</Link>
            </>
          ) : <p className="text-[13px] text-mute mt-2">S'ka pagesa të papaguara.</p>}
        </Card>
        <Card className="p-5">
          <p className="text-[11px] font-mono uppercase tracking-wider text-mute">Skedarët e fundit</p>
          {files.loading ? <Skeleton className="h-10 mt-2" /> : recentFiles.length > 0 ? (
            <div className="mt-2 space-y-1.5">
              {recentFiles.slice(0, 2).map((f) => (
                <p key={f.id} className="text-[12.5px] font-semibold text-ink truncate flex items-center gap-1.5"><IFile size={12} className="text-primary-500" /> {f.file_name}</p>
              ))}
              <Link to="/client/dokumentet" className="text-[12.5px] font-bold text-primary-700">Shiko të gjithë →</Link>
            </div>
          ) : <p className="text-[13px] text-mute mt-2">Ende pa skedarë.</p>}
        </Card>
      </div>

      {(reviewable.data ?? []).length > 0 && (
        <div className="bg-primary-600 rounded-xl p-5 text-primary-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 anim-fade-up">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-lg bg-primary-50/15 flex items-center justify-center"><IStar size={18} /></span>
            <div>
              <p className="font-display font-bold">Konsulta e fundit përfundoi — si ishte?</p>
              <p className="text-[13px] text-primary-100">Vlerësimi juaj ndihmon klientët e tjerë të zgjedhin.</p>
            </div>
          </div>
          <Link to="/client/terminet?tab=completed"><Button variant="dark" className="!bg-ink">Lër vlerësimin</Button></Link>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <SectionHead title="Terminet e ardhshme" to="/client/terminet" />
          {appts.loading ? <TableSkeleton rows={3} /> : (
            <MiniAgenda list={(appts.data ?? []).slice(0, 3)} onEventClick={() => {}} empty="Asnjë termin i ardhshëm." />
          )}
        </Card>
        <Card className="p-5">
          <SectionHead title="Projektet" to="/client/projektet" />
          {projects.loading ? <TableSkeleton rows={3} /> : (projects.data ?? []).length === 0
            ? <EmptyState title="Asnjë projekt" hint="Projektet krijohen nga platforma kur fillon një bashkëpunim i vazhdueshëm." icon={<IFolder size={20} />} />
            : (
              <div className="space-y-3">
                {(projects.data ?? []).slice(0, 3).map((p) => (
                  <Link key={p.id} to={`/client/projektet/${p.id}`} className="block p-3.5 rounded-xl border border-line hover:border-primary-300 hover:shadow-soft transition-all">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[13.5px] font-bold text-ink truncate">{p.title}</p>
                      <Badge tone={["completed"].includes(p.status) ? "ok" : ["cancelled"].includes(p.status) ? "bad" : "info"}>{PROJECT_STATUS[p.status]}</Badge>
                    </div>
                    <Progress value={p.progress} className="mt-2.5" />
                    <p className="text-[11.5px] text-mute mt-1.5 font-mono">{p.progress}% · {p.consultant_name}</p>
                  </Link>
                ))}
              </div>
            )}
        </Card>
      </div>
    </div>
  );
}

function SectionHead({ title, to }: { title: string; to: string }) {
  return (
    <div className="flex items-center justify-between mb-3.5">
      <h2 className="font-display font-bold text-ink">{title}</h2>
      <Link to={to} className="text-[12.5px] font-bold text-primary-700 hover:underline">Shiko të gjitha</Link>
    </div>
  );
}

// ─── Appointments ─────────────────────────────────────────────────────────────
export function ClientAppointments() {
  const { session, toast } = useApp();
  const [sp] = useSearchParams();
  const initialTab = sp.get("tab") === "completed" ? "completed" : sp.get("tab") === "cancelled" ? "cancelled" : "upcoming";
  const [tab, setTab] = useState<"upcoming" | "completed" | "cancelled">(initialTab);
  const appts = useAsync(() => listAppointments(session), [session?.user_id]);
  const reviewable = useAsync(() => myReviewableAppointments(session), [session?.user_id]);
  const [sel, setSel] = useState<AppointmentRow | null>(null);
  const [reviewFor, setReviewFor] = useState<AppointmentRow | null>(null);

  const list = useMemo(() => {
    const all = appts.data ?? [];
    if (tab === "upcoming") return all.filter((a) => ["pending", "confirmed"].includes(a.status));
    if (tab === "completed") return all.filter((a) => a.status === "completed");
    return all.filter((a) => ["cancelled", "no_show", "rescheduled"].includes(a.status));
  }, [appts.data, tab]);

  const canReview = (a: AppointmentRow) => (reviewable.data ?? []).some((r) => r.id === a.id);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Terminet</h1>
        <Link to="/rezervo"><Button size="sm">Rezervo të ri <IArrowR size={13} /></Button></Link>
      </div>
      <div className="flex gap-1.5 mb-5">
        {([["upcoming", "Të ardhshme"], ["completed", "Të përfunduara"], ["cancelled", "Anuluar"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={cls("px-3.5 h-9 rounded-lg text-[13px] font-bold transition-all", tab === k ? "bg-ink text-paper" : "bg-card border border-line text-mute hover:text-ink")}>
            {l}
          </button>
        ))}
      </div>
      {appts.error && <ErrorState message={appts.error} onRetry={appts.retry} />}
      {appts.loading && <Card className="p-5"><TableSkeleton rows={5} /></Card>}
      {!appts.loading && list.length === 0 && !appts.error && (
        <Card><EmptyState icon={<ICal size={22} />} title={tab === "upcoming" ? "Nuk keni termine të ardhshme" : "Asgjë këtu"} hint="Rezervoni një konsultë dhe do të shfaqet këtu." action={<Link to="/rezervo"><Button>Rezervo konsultën</Button></Link>} /></Card>
      )}
      <div className="space-y-2.5 stagger">
        {list.map((a) => (
          <Card key={a.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:shadow-soft transition-all">
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <div className="w-14 text-center bg-paper border border-line rounded-lg py-2 shrink-0">
                <p className="font-display font-bold text-[15px] text-ink leading-none">{a.date.slice(8)}</p>
                <p className="text-[10px] font-mono text-mute mt-0.5">{fmtDate(a.date).split(" ")[1]}</p>
              </div>
              <div className="min-w-0">
                <p className="font-bold text-ink text-[14.5px] truncate">{a.service_name}</p>
                <p className="text-[12.5px] text-mute truncate">{a.consultant_name} · {a.start_time}–{a.end_time} · {fmtDuration(a.duration_minutes)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge tone={APPT_STATUS[a.status].tone}>{APPT_STATUS[a.status].label}</Badge>
              {a.payment_status !== "paid" && a.payment_status !== "refunded" && <Badge tone="warn">{a.payment_status === "deposit_paid" ? "Depozitë e paguar" : "E papaguar"}</Badge>}
              <Button variant="outline" size="sm" onClick={() => setSel(a)}>Detajet</Button>
              {tab === "completed" && canReview(a) && (
                <Button size="sm" onClick={() => setReviewFor(a)}><IStar size={13} /> Vlerëso</Button>
              )}
              {tab === "completed" && (
                <Link to="/rezervo"><Button variant="ghost" size="sm">Rezervo tjetër</Button></Link>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel ? `Termini ${sel.reference}` : ""}>
        {sel && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar name={sel.consultant_name} size={46} />
              <div>
                <p className="font-display font-bold text-ink">{sel.consultant_name}</p>
                <p className="text-[12.5px] text-mute">{sel.service_name}</p>
              </div>
              <Badge tone={APPT_STATUS[sel.status].tone} className="ml-auto">{APPT_STATUS[sel.status].label}</Badge>
            </div>
            <Card className="p-4">
              <KV k="Data" v={`${fmtDateLong(sel.date)} · ${sel.start_time}–${sel.end_time}`} />
              <KV k="Zgjatja" v={fmtDuration(sel.duration_minutes)} />
              <KV k="Çmimi" v={fmtEuro(sel.price)} />
              <KV k="Gjuha" v={LANGUAGES[sel.language] ?? sel.language} />
              <KV k="Referenca" v={sel.reference} mono />
              {sel.research_topic && <KV k="Tema" v={sel.research_topic} />}
              {sel.required_analysis && <KV k="Analiza" v={sel.required_analysis} />}
            </Card>
            {sel.meeting_url && (
              <a href={sel.meeting_url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 h-11 rounded-lg bg-primary-600 text-primary-50 font-bold text-sm hover:bg-primary-700 transition-colors">
                <IVideo size={16} /> Hap Google Meet
              </a>
            )}
            <Link to={`/menaxho/${sel.manage_token}`} className="block">
              <Button variant="outline" className="w-full"><ILink size={14} /> Rizhvendos ose anulo</Button>
            </Link>
            {sel.completion && (
              <div>
                <p className="font-mono text-[11px] uppercase tracking-wider text-mute mb-2">Përmbledhja e konsulencës</p>
                <Card className="p-4 space-y-3">
                  <KV k="Përmbledhja" v={sel.completion.summary} />
                  <KV k="Analizat" v={sel.completion.analyses_performed} />
                  <KV k="Gjetjet" v={sel.completion.findings} />
                  <KV k="Rekomandimet" v={sel.completion.recommendations} />
                  <KV k="Hapat e tjerë" v={sel.completion.next_steps} />
                  {sel.completion.follow_up !== "none" && (
                    <KV k="Ndjekja" v={`${sel.completion.follow_up === "required" ? "E domosdoshme" : "E rekomanduar"}${sel.completion.follow_up_timeframe ? ` — ${sel.completion.follow_up_timeframe}` : ""}`} />
                  )}
                </Card>
              </div>
            )}
          </div>
        )}
      </Drawer>

      <ReviewModal appt={reviewFor} onClose={() => { setReviewFor(null); reviewable.retry(); appts.retry(); }} />
    </div>
  );
}

function ReviewModal({ appt, onClose }: { appt: AppointmentRow | null; onClose: () => void }) {
  const { session, toast } = useApp();
  const [rating, setRating] = useState(5);
  const [clarity, setClarity] = useState(5);
  const [usefulness, setUsefulness] = useState(5);
  const [recommendation, setRecommendation] = useState(5);
  const [comment, setComment] = useState("");
  const [publish, setPublish] = useState(true);
  const [showName, setShowName] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!appt) return;
    setBusy(true);
    try {
      await submitReview(session, appt.id, { rating, clarity, usefulness, recommendation, comment, consent_to_publish: publish, show_name: showName });
      toast("Faleminderit! Vlerësimi u dërgua për moderim.");
      setComment(""); setRating(5); setClarity(5); setUsefulness(5); setRecommendation(5);
      onClose();
    } catch (e) { toast(e instanceof Error ? e.message : "Gabim.", "bad"); } finally { setBusy(false); }
  };

  return (
    <Modal open={!!appt} onClose={onClose} title="Vlerësoni konsulencën">
      {appt && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-paper rounded-xl p-3.5 border border-line">
            <Avatar name={appt.consultant_name} size={40} />
            <div>
              <p className="font-bold text-ink text-[14px]">{appt.consultant_name}</p>
              <p className="text-[12px] text-mute">{appt.service_name} · {fmtDate(appt.date)}</p>
            </div>
          </div>
          {([["Vlerësimi i përgjithshëm", rating, setRating], ["Qartësia e shpjegimit", clarity, setClarity], ["Dobishmëria", usefulness, setUsefulness], ["Do ta rekomandonit", recommendation, setRecommendation]] as [string, number, (v: number) => void][]).map(([label, val, set]) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-[13.5px] font-semibold text-ink-2">{label}</span>
              <Stars value={val} onChange={set} size={18} />
            </div>
          ))}
          <Field label="Komenti (opsionale)"><TextArea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Si ishte përvoja juaj?" /></Field>
          <div className="space-y-2.5">
            <Toggle checked={publish} onChange={setPublish} label="Pranoj publikimin e vlerësimit (pas moderimit)" />
            <Toggle checked={showName} onChange={setShowName} label="Shfaq emrin tim publikisht" />
          </div>
          <Button className="w-full" loading={busy} onClick={submit}>Dërgo vlerësimin</Button>
        </div>
      )}
    </Modal>
  );
}

// ─── Projects ─────────────────────────────────────────────────────────────────
export function ClientProjects() {
  const { session } = useApp();
  const [q, setQ] = useState("");
  const projects = useAsync(() => listProjects(session, { search: q }), [session?.user_id, q]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Projektet</h1>
        <div className="w-64"><SearchInput value={q} onChange={setQ} placeholder="Kërko projekt…" /></div>
      </div>
      {projects.loading && <div className="grid md:grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}</div>}
      {projects.error && <ErrorState message={projects.error} onRetry={projects.retry} />}
      {!projects.loading && (projects.data ?? []).length === 0 && !projects.error && (
        <Card><EmptyState icon={<IFolder size={22} />} title="Asnjë projekt" hint="Kur bashkëpunimi juaj kalon në një punim të vazhdueshëm, platforma krijon një projekt me të gjitha fazat." /></Card>
      )}
      <div className="grid md:grid-cols-2 gap-4 stagger">
        {(projects.data ?? []).map((p) => (
          <Link key={p.id} to={`/client/projektet/${p.id}`} className="card p-5 hover:shadow-lift hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-between gap-3">
              <Badge tone={p.status === "completed" ? "ok" : p.status === "cancelled" ? "bad" : "info"}>{PROJECT_STATUS[p.status]}</Badge>
              <span className="text-[11.5px] text-mute font-mono">{p.task_stats.completed}/{p.task_stats.total} faza</span>
            </div>
            <h2 className="font-display font-bold text-ink mt-3">{p.title}</h2>
            <p className="text-[13px] text-mute mt-1 line-clamp-2">{p.research_topic || p.description}</p>
            <Progress value={p.progress} className="mt-4" />
            <div className="flex items-center justify-between mt-3">
              <span className="text-[12.5px] text-mute flex items-center gap-1.5"><Avatar name={p.consultant_name} size={20} /> {p.consultant_name}</span>
              <span className="font-mono text-[13px] font-bold text-primary-700">{p.progress}%</span>
            </div>
            {p.next_appointment && (
              <p className="text-[12px] font-semibold text-ok mt-3 pt-3 border-t border-line">Konsulta tjetër: {fmtDate(p.next_appointment.date)} në {p.next_appointment.start_time}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ClientProjectDetail({ id }: { id: string }) {
  const { session } = useApp();
  const detail = useAsync(() => getProjectDetail(session, id), [session?.user_id, id]);
  const [tab, setTab] = useState("overview");
  const d = detail.data;

  if (detail.loading) return <div className="space-y-4"><Skeleton className="h-28 rounded-xl" /><Skeleton className="h-72 rounded-xl" /></div>;
  if (detail.error || !d) return <ErrorState message={detail.error ?? "Projekti nuk u gjet."} onRetry={detail.retry} />;
  const p = d.project;

  return (
    <div>
      <Link to="/client/projektet" className="text-[13px] font-semibold text-mute hover:text-primary-700">← Projektet</Link>
      <div className="card p-6 mt-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display text-xl font-bold tracking-tight text-ink">{p.title}</h1>
              <Badge tone={p.status === "completed" ? "ok" : "info"}>{PROJECT_STATUS[p.status]}</Badge>
            </div>
            <p className="text-[13.5px] text-mute mt-1.5 max-w-2xl">{p.research_topic}</p>
            <p className="text-[12.5px] text-mute mt-2 flex items-center gap-2">
              <Avatar name={p.consultant_name} size={22} /> {p.consultant_name}
              {p.collaborators.length > 1 && ` +${p.collaborators.length - 1} bashkëpunëtorë`}
              {p.deadline && <span className="ml-2">· Afati: {fmtDate(p.deadline)}</span>}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display font-bold text-3xl text-primary-700">{p.progress}%</p>
            <p className="text-[11.5px] text-mute">përfunduar</p>
          </div>
        </div>
        <Progress value={p.progress} className="mt-4" />
      </div>

      <div className="mt-5 flex gap-1.5 overflow-x-auto no-scrollbar">
        {[["overview", "Përmbledhje"], ["analysis", "Analiza"], ["files", `Dokumentet (${d.files.length})`], ["deliverables", "Dorëzimet"], ["appointments", "Terminet"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={cls("px-3.5 h-9 rounded-lg text-[13px] font-bold whitespace-nowrap transition-all", tab === k ? "bg-ink text-paper" : "bg-card border border-line text-mute hover:text-ink")}>{l}</button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "overview" && (
          <div className="grid md:grid-cols-2 gap-4 anim-fade-in">
            <Card className="p-5">
              <p className="font-mono text-[11px] uppercase tracking-wider text-mute mb-3">Detajet e hulumtimit</p>
              <KV k="Universiteti" v={p.university || "—"} />
              <KV k="Niveli" v={STUDY_LEVEL[p.study_level]} />
              <KV k="Tema" v={p.research_topic || "—"} />
              <KV k="Pyetjet hulumtuese" v={p.research_questions || "—"} />
              <KV k="Hipotezat" v={p.hypotheses || "—"} />
              <KV k="Afati" v={p.deadline ? fmtDate(p.deadline) : "—"} />
            </Card>
            <Card className="p-5">
              <p className="font-mono text-[11px] uppercase tracking-wider text-mute mb-3">Ekipi</p>
              <div className="space-y-3">
                {p.collaborators.map((c) => (
                  <div key={c.consultant_id} className="flex items-center gap-3">
                    <Avatar name={c.name} size={38} />
                    <div className="flex-1">
                      <p className="text-[13.5px] font-bold text-ink">{c.name}</p>
                      <p className="text-[11.5px] text-mute capitalize">{{ lead: "Konsulent kryesor", statistics: "Konsulent statistike", methodology: "Konsulent metodologjie", data_analyst: "Analist i të dhënave" }[c.role]}</p>
                    </div>
                    {c.consultant_id === p.primary_consultant_id && <Badge tone="info">Kryesor</Badge>}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
        {tab === "analysis" && (
          <Card className="p-5 anim-fade-in">
            <p className="font-mono text-[11px] uppercase tracking-wider text-mute mb-4">Workflow i analizës — {p.task_stats.completed}/{p.task_stats.total} faza të përfunduara</p>
            {d.tasks.length === 0 && <EmptyState title="Ende pa faza analize" hint="Konsulenti do të përcaktojë hapat e analizës për projektin tuaj." icon={<ISpark size={20} />} />}
            <div className="space-y-2.5">
              {d.tasks.map((t) => (
                <div key={t.id} className={cls("p-3.5 rounded-xl border", t.status === "not_required" ? "border-line opacity-50" : "border-line bg-card")}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[13.5px] font-bold text-ink">{t.name}</p>
                    <Badge tone={TASK_STATUS[t.status].tone as never}>{TASK_STATUS[t.status].label}</Badge>
                  </div>
                  {t.status !== "not_required" && (
                    <div className="flex items-center gap-3 mt-2.5">
                      <Progress value={t.progress} tone={t.status === "completed" ? "ok" : "primary"} className="flex-1" />
                      <span className="font-mono text-[11.5px] text-mute w-9 text-right">{t.progress}%</span>
                    </div>
                  )}
                  {t.notes && <p className="text-[12.5px] text-mute mt-2">{t.notes}</p>}
                </div>
              ))}
            </div>
          </Card>
        )}
        {(tab === "files" || tab === "deliverables") && (
          <Card className="p-5 anim-fade-in">
            <FileList files={tab === "deliverables" ? d.files.filter((f) => ["deliverable", "report", "spss_output"].includes(f.category)) : d.files} empty={tab === "deliverables" ? "Dorëzimet do të shfaqen këtu sapo konsulenti t'i përfundojë." : "Ende pa skedarë në këtë projekt."} />
          </Card>
        )}
        {tab === "appointments" && (
          <Card className="p-5 anim-fade-in">
            <MiniAgenda list={d.appointments} onEventClick={() => {}} empty="Asnjë termin i lidhur me këtë projekt." />
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── Files (shared list component) ───────────────────────────────────────────
export function FileList({ files, empty }: { files: (import("../types").ProjectFile & { uploader_name: string })[]; empty: string }) {
  const { session, toast } = useApp();
  const [signing, setSigning] = useState<string | null>(null);

  const sign = async (id: string) => {
    setSigning(id);
    try {
      const { url, expiresInMin } = await createSignedUrl(session, id);
      toast(`Link i nënshkruar (${expiresInMin} min): ${url}`);
    } catch (e) { toast(e instanceof Error ? e.message : "Gabim.", "bad"); } finally { setSigning(null); }
  };

  if (files.length === 0) return <EmptyState icon={<IFile size={20} />} title="Asnjë skedar" hint={empty} />;
  return (
    <div className="space-y-2">
      {files.map((f) => (
        <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl border border-line hover:border-primary-300 transition-colors group">
          <span className="w-10 h-10 rounded-lg bg-primary-50 text-primary-700 flex items-center justify-center font-mono text-[10px] font-bold uppercase shrink-0">{f.file_type.replace(".", "")}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-bold text-ink truncate">{f.file_name}</p>
            <p className="text-[11.5px] text-mute">{FILE_CATEGORY[f.category]} · {fmtBytes(f.file_size)} · {fmtDateTime(f.created_at)} · {f.uploader_name}</p>
          </div>
          <div className="flex items-center gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="sm" loading={signing === f.id} onClick={() => sign(f.id)} title="Link i nënshkruar"><ILink size={13} /></Button>
            <Button variant="outline" size="sm" onClick={async () => { try { await downloadFile(session, f.id); toast("Shkarkimi filloi."); } catch (e) { toast(e instanceof Error ? e.message : "Gabim.", "bad"); } }}>
              <IDownload size={13} /> Shkarko
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ClientFiles() {
  const { session, toast } = useApp();
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const files = useAsync(() => listFiles(session, { category: cat, search: q }), [session?.user_id, cat, q]);
  const projects = useAsync(() => listProjects(session), [session?.user_id]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uf, setUf] = useState<{ name: string; size: number; ext: string } | null>(null);
  const [uCat, setUCat] = useState("dataset");
  const [uProj, setUProj] = useState("");
  const [busy, setBusy] = useState(false);
  const ALLOWED = [".sav", ".spv", ".xlsx", ".csv", ".docx", ".pdf"];

  const doUpload = async () => {
    if (!uf) { toast("Zgjidhni një skedar.", "bad"); return; }
    setBusy(true);
    try {
      await uploadFile(session, { name: uf.name, size: uf.size, ext: uf.ext, category: uCat as never, project_id: uProj || null });
      toast("Skedari u ngarkua me sukses.");
      setUploadOpen(false); setUf(null);
    } catch (e) { toast(e instanceof Error ? e.message : "Gabim.", "bad"); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Dokumentet</h1>
        <Button size="sm" onClick={() => setUploadOpen(true)}><IUpload size={14} /> Ngarko skedar</Button>
      </div>
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="w-64"><SearchInput value={q} onChange={setQ} placeholder="Kërko skedar…" /></div>
        <Select value={cat} onChange={(e) => setCat(e.target.value)} className="!w-52">
          <option value="all">Të gjitha kategoritë</option>
          {Object.entries(FILE_CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </div>
      {files.error && <ErrorState message={files.error} onRetry={files.retry} />}
      <Card className="p-4">
        {files.loading ? <TableSkeleton rows={5} /> : <FileList files={files.data ?? []} empty="Skedarët që ngarkoni dhe dorëzimet e konsulentëve shfaqen këtu." />}
      </Card>

      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Ngarko skedar">
        <div className="space-y-4">
          <label className={cls("border-2 border-dashed rounded-xl p-6 flex flex-col items-center cursor-pointer transition-colors", uf ? "border-ok bg-ok-soft/40" : "border-line-2 hover:border-primary-300")}>
            <IUpload size={22} className={uf ? "text-ok" : "text-mute"} />
            <input type="file" accept={ALLOWED.join(",")} className="hidden" onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const ext = "." + (f.name.split(".").pop() ?? "").toLowerCase();
              if (!ALLOWED.includes(ext)) { toast(`Format i palejuar: ${ext}. Lejohen ${ALLOWED.join(", ")}.`, "bad"); return; }
              if (f.size > 25 * 1024 * 1024) { toast("Maksimumi 25 MB.", "bad"); return; }
              setUf({ name: f.name, size: f.size, ext });
            }} />
            <p className="text-[13px] font-semibold text-ink-2 mt-2">{uf ? uf.name : "Klikoni për të zgjedhur skedarin"}</p>
            <p className="text-[11.5px] text-mute mt-1">{ALLOWED.join(" ")} · deri 25 MB</p>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kategoria">
              <Select value={uCat} onChange={(e) => setUCat(e.target.value)}>
                {Object.entries(FILE_CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Projekti (opsionale)">
              <Select value={uProj} onChange={(e) => setUProj(e.target.value)}>
                <option value="">Pa projekt</option>
                {(projects.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.title.slice(0, 32)}</option>)}
              </Select>
            </Field>
          </div>
          <Button className="w-full" loading={busy} onClick={doUpload}>Ngarko</Button>
          <p className="text-[11.5px] text-mute text-center flex items-center justify-center gap-1.5"><IShield size={12} /> Storage privat — akses vetëm ju dhe konsulenti i caktuar.</p>
        </div>
      </Modal>
    </div>
  );
}

// ─── Payments ─────────────────────────────────────────────────────────────────
export function ClientPayments() {
  const { session, toast } = useApp();
  const payments = useAsync(() => listPayments(session), [session?.user_id]);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<{ id: string; amount: number } | null>(null);
  const [processing, setProcessing] = useState(false);

  const pay = async (outcome: "succeeded" | "failed") => {
    if (!checkout) return;
    setProcessing(true);
    try {
      await verifyAndCompletePayment(session, checkout.id, outcome);
      toast(outcome === "succeeded" ? "Pagesa u verifikua dhe u pranua!" : "Pagesa dështoi.", outcome === "succeeded" ? "ok" : "bad");
      setCheckout(null);
    } catch (e) { toast(e instanceof Error ? e.message : "Gabim.", "bad"); } finally { setProcessing(false); setPayingId(null); }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink mb-5">Pagesat</h1>
      {payments.error && <ErrorState message={payments.error} onRetry={payments.retry} />}
      <Card className="overflow-hidden">
        {payments.loading ? <div className="p-5"><TableSkeleton rows={5} /></div> : (payments.data ?? []).length === 0
          ? <EmptyState icon={<IEuro size={20} />} title="Asnjë pagesë" hint="Pagesat tuaja do të shfaqen këtu." />
          : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead className="bg-paper/70"><tr><Th>Data</Th><Th>Përshkrimi</Th><Th>Referenca</Th><Th>Lloji</Th><Th>Shuma</Th><Th>Statusi</Th><Th /></tr></thead>
                <tbody>
                  {(payments.data ?? []).map((p) => (
                    <tr key={p.id} className="hover:bg-paper/50 transition-colors">
                      <Td className="font-mono text-[12.5px]">{fmtDate(p.created_at.slice(0, 10))}</Td>
                      <Td><p className="font-bold text-ink">{p.service_name}</p><p className="text-[11.5px] text-mute">{p.consultant_name}</p></Td>
                      <Td className="font-mono text-[12px]">{p.reference}</Td>
                      <Td><Badge tone="mute">{{ full: "E plotë", deposit: "Depozitë", balance: "Balancë" }[p.type]}</Badge></Td>
                      <Td className="font-display font-bold text-ink">{fmtEuro(p.amount_gross)}</Td>
                      <Td><Badge tone={PAYMENT_STATUS[p.status].tone as never}>{PAYMENT_STATUS[p.status].label}</Badge></Td>
                      <Td>
                        {p.status === "pending" && (
                          <Button size="sm" onClick={() => { setCheckout({ id: p.id, amount: p.amount_gross }); }}>Paguaj</Button>
                        )}
                        {p.status === "failed" && (
                          <Button size="sm" variant="outline" onClick={() => setCheckout({ id: p.id, amount: p.amount_gross })}>Provo sërish</Button>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Card>

      <Modal open={!!checkout} onClose={() => !processing && setCheckout(null)} title="Stripe · Pagesë e sigurt">
        {checkout && (
          <div className="space-y-4">
            <div className="bg-paper border border-line rounded-xl p-4 flex items-center justify-between">
              <span className="text-[13.5px] text-mute">StatLab — pagesë</span>
              <span className="font-display font-bold text-xl text-ink">{fmtEuro(checkout.amount)}</span>
            </div>
            {processing ? (
              <div className="py-8 text-center"><span className="inline-block w-6 h-6 rounded-full border-2 border-primary-200 border-t-primary-600 animate-spin" /><p className="text-sm font-bold text-ink mt-3">Duke verifikuar pagesën në server…</p></div>
            ) : (
              <>
                <Field label="Karta (demo)"><TextInput defaultValue="4242 4242 4242 4242" className="font-mono" /></Field>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => pay("failed")} disabled={processing}>Simulo dështim</Button>
                  <Button className="flex-1" onClick={() => pay("succeeded")}>Paguaj {fmtEuro(checkout.amount)}</Button>
                </div>
                <p className="text-[11.5px] text-mute text-center">Shuma verifikohet server-side kundër terminit — nuk besohet frontend-i.</p>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Invoices ─────────────────────────────────────────────────────────────────
export function ClientInvoices() {
  const { session, toast } = useApp();
  const invoices = useAsync(() => listInvoices(session), [session?.user_id]);
  const [viewId, setViewId] = useState<string | null>(null);
  const view = useAsync(async () => (viewId ? getInvoice(session, viewId) : null), [viewId]);
  const inv = view.data;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink mb-5">Faturat</h1>
      {invoices.error && <ErrorState message={invoices.error} onRetry={invoices.retry} />}
      <Card className="overflow-hidden">
        {invoices.loading ? <div className="p-5"><TableSkeleton rows={4} /></div> : (invoices.data ?? []).length === 0
          ? <EmptyState icon={<IInvoice size={20} />} title="Asnjë faturë" hint="Faturat lëshohen automatikisht pas çdo pagese." />
          : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px]">
                <thead className="bg-paper/70"><tr><Th>Numri</Th><Th>Data</Th><Th>Afati</Th><Th>Totali</Th><Th>Statusi</Th><Th /></tr></thead>
                <tbody>
                  {(invoices.data ?? []).map((i) => (
                    <tr key={i.id} className="hover:bg-paper/50 transition-colors">
                      <Td className="font-mono font-bold text-primary-700 text-[12.5px]">{i.invoice_number}</Td>
                      <Td className="font-mono text-[12.5px]">{fmtDate(i.issue_date)}</Td>
                      <Td className="font-mono text-[12.5px]">{fmtDate(i.due_date)}</Td>
                      <Td className="font-display font-bold text-ink">{fmtEuro(i.amount_total)}</Td>
                      <Td><Badge tone={INVOICE_STATUS[i.status].tone as never}>{INVOICE_STATUS[i.status].label}</Badge></Td>
                      <Td><Button variant="outline" size="sm" onClick={() => setViewId(i.id)}><IEye size={13} /> Shiko</Button></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Card>

      <Modal open={!!viewId} onClose={() => setViewId(null)} title="Fatura" wide>
        {view.loading && <div className="py-10 text-center"><span className="inline-block w-6 h-6 rounded-full border-2 border-primary-200 border-t-primary-600 animate-spin" /></div>}
        {inv && <InvoiceView inv={inv} />}
      </Modal>
    </div>
  );
}

export function InvoiceView({ inv }: { inv: Awaited<ReturnType<typeof getInvoice>> }) {
  return (
    <div id="invoice-print" className="bg-card border border-line rounded-xl p-6 sm:p-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-lg bg-primary-600 text-primary-50 flex items-center justify-center font-display font-bold">SL</span>
          <div>
            <p className="font-display font-bold text-ink">StatLab</p>
            <p className="text-[11px] text-mute">SPSS Consulting Platform</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-[11px] uppercase tracking-wider text-mute">Faturë</p>
          <p className="font-display font-bold text-xl text-primary-700">{inv.invoice_number}</p>
          <Badge tone={INVOICE_STATUS[inv.status].tone as never} className="mt-1.5">{INVOICE_STATUS[inv.status].label}</Badge>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6 mt-8">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-mute mb-1.5">Faturuar për</p>
          <p className="font-bold text-ink text-[14px]">{inv.client_name}</p>
          <p className="text-[12.5px] text-mute">{inv.client_email}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-mono uppercase tracking-wider text-mute mb-1.5">Detajet</p>
          <p className="text-[12.5px] text-ink-2">Lëshuar: <b>{fmtDate(inv.issue_date)}</b></p>
          <p className="text-[12.5px] text-ink-2">Afati: <b>{fmtDate(inv.due_date)}</b></p>
          {inv.reference !== "—" && <p className="text-[12.5px] text-ink-2 font-mono">{inv.reference}</p>}
        </div>
      </div>
      <table className="w-full mt-8 text-[13px]">
        <thead><tr className="border-b-2 border-ink/20 text-left"><th className="py-2 font-bold">Përshkrimi</th><th className="py-2 font-bold text-right">Shuma</th></tr></thead>
        <tbody>
          <tr className="border-b border-line"><td className="py-3">{inv.service_name || "Konsulencë statistikore"} <span className="text-mute text-[11.5px]">· {inv.consultant_name}</span></td><td className="py-3 text-right font-mono">{fmtEuro(inv.amount_net)}</td></tr>
          <tr className="border-b border-line"><td className="py-2.5 text-mute">TVSH (e përfshirë)</td><td className="py-2.5 text-right font-mono">{fmtEuro(inv.tax_amount)}</td></tr>
          <tr><td className="py-3 font-display font-bold text-ink text-[15px]">Totali</td><td className="py-3 text-right font-display font-bold text-xl text-primary-700">{fmtEuro(inv.amount_total)}</td></tr>
        </tbody>
      </table>
      <p className="text-[11px] text-mute mt-8 border-t border-line pt-4">StatLab · kontakt@statlab.al · Fatura u lëshua automatikisht nga platforma. TVSH sipas konfigurimit të administratorit.</p>
      <Button className="w-full mt-5" variant="outline" onClick={() => window.print()}><IDownload size={14} /> Shkarko / Printo (PDF)</Button>
    </div>
  );
}

// ─── Profile ──────────────────────────────────────────────────────────────────
export function ClientProfile() {
  const { session, toast } = useApp();
  const [name, setName] = useState(session?.user.full_name ?? "");
  const [phone, setPhone] = useState(session?.user.phone ?? "");
  const [lang, setLang] = useState(session?.user.preferred_language ?? "sq");
  const [busy, setBusy] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const consents = useAsync(() => myConsents(session), [session?.user_id]);

  const save = async () => {
    setBusy(true);
    try {
      await updateProfile(session, { full_name: name, phone, preferred_language: lang as never });
      toast("Profili u përditësua.");
    } catch (e) { toast(e instanceof Error ? e.message : "Gabim.", "bad"); } finally { setBusy(false); }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink mb-5">Profili</h1>
      <div className="grid md:grid-cols-2 gap-5">
        <Card className="p-6">
          <div className="flex items-center gap-4 mb-5">
            <Avatar name={name || "?"} size={56} />
            <div>
              <p className="font-display font-bold text-ink">{session?.user.full_name}</p>
              <p className="text-[12.5px] text-mute">{session?.user.email}</p>
              <Badge tone="info" className="mt-1.5">Klient</Badge>
            </div>
          </div>
          <div className="space-y-4">
            <Field label="Emri i plotë"><TextInput value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Telefoni"><TextInput value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
            <Field label="Gjuha e preferuar">
              <Select value={lang} onChange={(e) => setLang(e.target.value as never)}>
                {Object.entries(LANGUAGES).filter(([k]) => ["sq", "de", "en"].includes(k)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Button loading={busy} onClick={save}>Ruaj ndryshimet</Button>
          </div>
        </Card>
        <div className="space-y-5">
          <Card className="p-6">
            <p className="font-display font-bold text-ink mb-3 flex items-center gap-2"><IShield size={16} className="text-primary-600" /> Pëlqimet (GDPR)</p>
            {consents.loading ? <TableSkeleton rows={3} /> : (
              <div className="space-y-2">
                {(consents.data ?? []).map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-[13px] py-2 border-b border-line last:border-0">
                    <span className="font-semibold text-ink-2 capitalize">{{ privacy: "Privatësia", terms: "Kushtet", data_processing: "Përpunimi i të dhënave", confidentiality: "Konfidencialiteti" }[c.consent_type]}</span>
                    <span className="text-[11.5px] text-mute font-mono">v{c.consent_version} · {fmtDate(c.accepted_at.slice(0, 10))}</span>
                  </div>
                ))}
                {(consents.data ?? []).length === 0 && <p className="text-[13px] text-mute">Asnjë pëlqim i regjistruar.</p>}
              </div>
            )}
          </Card>
          <Card className="p-6">
            <p className="font-display font-bold text-ink mb-3">Të drejtat e të dhënave</p>
            <div className="space-y-2.5">
              <Button variant="outline" className="w-full" onClick={async () => { await exportMyData(session); toast("Eksporti JSON u shkarkua."); }}>
                <IDownload size={14} /> Eksporto të dhënat e mia
              </Button>
              <Button variant="danger" className="w-full" onClick={() => setDelOpen(true)}><ITrash size={14} /> Fshi llogarinë (anonimizo)</Button>
              <p className="text-[11.5px] text-mute">Fshirja anonimizon të dhënat personale sipas GDPR; regjistrimet financiare mbahen sipas ligjit.</p>
            </div>
          </Card>
        </div>
      </div>

      <Modal open={delOpen} onClose={() => setDelOpen(false)} title="Fshi llogarinë">
        <p className="text-[13.5px] text-mute">Ky veprim është i pakthyeshëm. Emri, email dhe telefoni juaj do të anonimizohen. Terminet dhe pagesat mbeten në regjistra në formë të anonimizuar.</p>
        <div className="flex gap-3 mt-5">
          <Button variant="ghost" onClick={() => setDelOpen(false)}>Kthehu</Button>
          <Button variant="danger" className="flex-1" onClick={async () => { await deleteMyAccount(session); toast("Llogaria u anonimizua."); }}>
            Po, fshi përfundimisht
          </Button>
        </div>
      </Modal>
    </div>
  );
}
