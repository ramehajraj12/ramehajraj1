import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp, useAsync } from "../lib/store";
import {
  consultantDashboard, listAppointments, confirmAppointment, completeAppointment, markNoShow,
  cancelAppointmentByStaff, rescheduleByStaff, rescheduleByConsultant, cancelByConsultant,
  listProjects, getProjectDetail, saveTask,
  updateProjectStatus,
  consultantClients, listFiles, uploadFile, downloadFile, deleteFile,
  listPayments, listReviews, getConsultantById, saveConsultantSelf, saveWeeklyAvailability,
  addBlock, removeBlock, toggleGoogleCalendar, listActiveServices,
  getMyAvailability, myConsultantId,
  type AppointmentRow,
} from "../lib/services";
import {
  APPT_STATUS, PROJECT_STATUS, TASK_STATUS, PAYMENT_STATUS, DAYS_SQ, DAYS_SQ_SHORT,
  SPECIALIZATIONS, LANGUAGES, ANALYSIS_TASK_NAMES,
} from "../lib/i18n";
import { fmtEuro, fmtDate, fmtDateLong, fmtDuration, fmtDateTime, todayISO, addDaysISO, cls, weekDays, minToTime, timeToMin } from "../lib/utils";
import {
  Avatar, Badge, Button, Card, Drawer, EmptyState, ErrorState, Field, KV, Modal, Progress,
  SearchInput, Select, Skeleton, Stars, TableSkeleton, Td, TextArea, TextInput, Th, Toggle,
} from "../components/ui";
import { PortalShell, type NavItem } from "../components/layout";
import { PlannerCalendar, MiniAgenda, type PlannerView } from "../components/calendar";
import { IGrid, ICal, IFolder, IUsers, IFile, IScatter, IEuro, IStar, IClock, IUser, ICheck, IWarn, IX, IPlus, IVideo, IGoogle, IUpload, IDownload, ITrash, IArrowR, ILock } from "../components/icons";
import { FileList } from "./ClientPortal";

const NAV: NavItem[] = [
  { to: "/consultant", label: "Paneli", icon: <IGrid size={16} />, end: true },
  { to: "/consultant/kalendari", label: "Kalendari", icon: <ICal size={16} /> },
  { to: "/consultant/terminet", label: "Terminet", icon: <IClock size={16} /> },
  { to: "/consultant/projektet", label: "Projektet", icon: <IFolder size={16} /> },
  { to: "/consultant/klientet", label: "Klientët", icon: <IUsers size={16} /> },
  { to: "/consultant/dokumentet", label: "Dokumentet", icon: <IFile size={16} /> },
  { to: "/consultant/analizat", label: "Analizat", icon: <IScatter size={16} /> },
  { to: "/consultant/te-ardhurat", label: "Të ardhurat", icon: <IEuro size={16} /> },
  { to: "/consultant/vleresimet", label: "Vlerësimet", icon: <IStar size={16} /> },
  { to: "/consultant/disponueshmeria", label: "Disponueshmëria", icon: <IClock size={16} /> },
  { to: "/consultant/profili", label: "Profili", icon: <IUser size={16} /> },
];

export function ConsultantShell({ children }: { children: React.ReactNode }) {
  return <PortalShell nav={NAV} title="Portali i konsulentit">{children}</PortalShell>;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export function ConsultantDashboard() {
  const { session } = useApp();
  const dash = useAsync(() => consultantDashboard(session), [session?.user_id]);
  const [sel, setSel] = useState<AppointmentRow | null>(null);
  const d = dash.data;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Përshëndetje, {session?.user.full_name.split(" ").slice(-1)[0]} 📊</h1>
          <p className="text-mute text-sm mt-1">Pasqyra e punës suaj sot.</p>
        </div>
        {d && <div className="flex items-center gap-2"><Stars value={d.kpi.rating} size={14} /><span className="text-[13px] font-bold text-ink">{d.kpi.rating.toFixed(1)}</span><span className="text-[12px] text-mute">({d.kpi.reviewCount})</span></div>}
      </div>

      {dash.error && <ErrorState message={dash.error} onRetry={dash.retry} />}
      {dash.loading ? (
        <div className="grid grid-cols-2 xl:grid-cols-6 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : d && (
        <div className="grid grid-cols-2 xl:grid-cols-6 gap-3 stagger">
          {[
            ["Sot", String(d.kpi.today), "termine"],
            ["Këtë javë", String(d.kpi.week), "termine"],
            ["Projekte aktive", String(d.kpi.activeProjects), ""],
            ["Klientë aktivë", String(d.kpi.activeClients), ""],
            ["Të ardhurat (muaji)", fmtEuro(d.kpi.monthEarnings), "neto"],
            ["Në pritje pagese", fmtEuro(d.kpi.pendingPayout), "neto"],
          ].map(([l, v, s]) => (
            <Card key={l} className="p-4">
              <p className="text-[10.5px] font-mono uppercase tracking-wider text-mute">{l}</p>
              <p className="font-display font-bold text-xl text-ink mt-1.5">{v}</p>
              {s && <p className="text-[10.5px] text-mute">{s}</p>}
            </Card>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-ink">Terminet e ardhshme</h2>
            <Link to="/consultant/kalendari" className="text-[12.5px] font-bold text-primary-700">Kalendari →</Link>
          </div>
          {dash.loading ? <TableSkeleton rows={4} /> : (
            <MiniAgenda list={d?.upcoming ?? []} onEventClick={setSel} empty="Asnjë termin i ardhshëm." />
          )}
        </Card>
        <Card className="p-5">
          <h2 className="font-display font-bold text-ink mb-4">Aktiviteti i fundit</h2>
          {dash.loading ? <TableSkeleton rows={4} /> : (
            <div className="space-y-2.5">
              {(d?.recentActivity ?? []).slice(0, 6).map((a) => (
                <div key={a.id} className="flex items-start gap-2.5 text-[12.5px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-400 mt-1.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-ink-2">{a.metadata || a.action}</p>
                    <p className="text-[11px] text-mute font-mono">{a.action} · {fmtDateTime(a.created_at)}</p>
                  </div>
                </div>
              ))}
              {(d?.recentActivity ?? []).length === 0 && <p className="text-[13px] text-mute">Ende pa aktivitet.</p>}
            </div>
          )}
        </Card>
      </div>
      <AppointmentDrawer appt={sel} onClose={() => setSel(null)} onChanged={() => { dash.retry(); setSel(null); }} />
    </div>
  );
}

// ─── Appointment drawer with actions (shared) ────────────────────────────────
export function AppointmentDrawer({ appt, onClose, onChanged, showClientInfo = true }: {
  appt: AppointmentRow | null; onClose: () => void; onChanged?: () => void; showClientInfo?: boolean;
}) {
  const { session, toast } = useApp();
  const [confirming, setConfirming] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [reschedOpen, setReschedOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  if (!appt) return null;
  const isStaff = session?.user.role === "admin" || session?.user.role === "super_admin" || session?.user.role === "consultant";
  // consultants operate on their own appointments through ownership-scoped RPCs
  const isConsultant = session?.user.role === "consultant";
  const doCancel = () => isConsultant
    ? cancelByConsultant(session, appt.id, "Anuluar nga konsulenti")
    : cancelAppointmentByStaff(session, appt.id, "Anuluar nga stafi");

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    setConfirming(true);
    try { await fn(); toast(msg); onChanged?.(); onClose(); } catch (e) { toast(e instanceof Error ? e.message : "Gabim.", "bad"); } finally { setConfirming(false); }
  };

  return (
    <>
      <Drawer open onClose={onClose} title={`Termini ${appt.reference}`} width={500}>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar name={appt.client_name} size={44} />
            <div className="flex-1">
              <p className="font-display font-bold text-ink">{appt.client_name}</p>
              <p className="text-[12.5px] text-mute">{appt.client_email} · {appt.client_phone}</p>
            </div>
            <Badge tone={APPT_STATUS[appt.status].tone}>{APPT_STATUS[appt.status].label}</Badge>
          </div>
          <Card className="p-4">
            <KV k="Shërbimi" v={appt.service_name} />
            <KV k="Konsulenti" v={appt.consultant_name} />
            <KV k="Data" v={`${fmtDateLong(appt.date)} · ${appt.start_time}–${appt.end_time}`} />
            <KV k="Zgjatja" v={fmtDuration(appt.duration_minutes)} />
            <KV k="Çmimi" v={`${fmtEuro(appt.price)} · ${appt.payment_status === "paid" ? "paguar" : appt.payment_status === "deposit_paid" ? "depozitë" : "papaguar"}`} />
            <KV k="Gjuha" v={LANGUAGES[appt.language] ?? appt.language} />
            {appt.university && <KV k="Universiteti" v={appt.university} />}
            {appt.study_level && <KV k="Niveli" v={{ bachelor: "Diplomë", master: "Master", phd: "Doktoraturë", professional: "Profesional", other: "Tjetër" }[appt.study_level]} />}
            {appt.research_topic && <KV k="Tema" v={appt.research_topic} />}
            {appt.required_analysis && <KV k="Analiza e kërkuar" v={appt.required_analysis} />}
            {appt.problem_description && <KV k="Problemi" v={appt.problem_description} />}
          </Card>
          {Object.keys(appt.intake).length > 0 && (
            <Card className="p-4">
              <p className="font-mono text-[11px] uppercase tracking-wider text-mute mb-2">Intake dinamike</p>
              {Object.entries(appt.intake).filter(([, v]) => v).map(([k, v]) => <KV key={k} k={k.replace(/_/g, " ")} v={v} />)}
            </Card>
          )}
          {appt.meeting_url && (
            <a href={appt.meeting_url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 h-11 rounded-lg bg-primary-600 text-primary-50 font-bold text-sm hover:bg-primary-700 transition-colors">
              <IVideo size={16} /> Google Meet
            </a>
          )}
          {appt.history.length > 0 && (
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-mute mb-2">Historia e rizhvendosjeve</p>
              {appt.history.map((h, i) => (
                <p key={i} className="text-[12.5px] text-ink-2">{fmtDate(h.old_date)} {h.old_start} → <b>{fmtDate(h.new_date)} {h.new_start}</b> <span className="text-mute">· {h.changed_by}</span></p>
              ))}
            </div>
          )}
          {appt.internal_notes && (
            <Card className="p-4 !bg-warn-soft/50"><p className="text-[12.5px] text-warn font-semibold">Shënime interne</p><p className="text-[13px] text-ink-2 mt-1 whitespace-pre-line">{appt.internal_notes}</p></Card>
          )}
          {appt.completion && (
            <Card className="p-4">
              <p className="font-mono text-[11px] uppercase tracking-wider text-mute mb-2">Përmbledhja</p>
              <KV k="Analizat" v={appt.completion.analyses_performed} />
              <KV k="Gjetjet" v={appt.completion.findings} />
              <KV k="Rekomandimet" v={appt.completion.recommendations} />
            </Card>
          )}

          {isStaff && ["pending", "confirmed"].includes(appt.status) && (
            <div className="grid grid-cols-2 gap-2.5">
              {appt.status === "pending" && (
                <Button loading={confirming} onClick={() => act(() => confirmAppointment(session, appt.id), "Termini u konfirmua. Linku Meet u dërgua.")}><ICheck size={14} /> Konfirmo</Button>
              )}
              <Button variant="outline" onClick={() => setReschedOpen(true)}><ICal size={14} /> Rizhvendos</Button>
              <Button variant="outline" onClick={() => act(() => markNoShow(session, appt.id), "U shënua mungesa.")}>Nuk u paraqit</Button>
              <Button variant="danger" onClick={() => setCancelOpen(true)}><IX size={14} /> Anulo</Button>
              <Button className="col-span-2 !bg-ok hover:!bg-[#126b3d]" onClick={() => setCompleteOpen(true)}><ICheck size={14} /> Përfundo konsultën</Button>
            </div>
          )}
        </div>
      </Drawer>

      <CompletionModal appt={completeOpen ? appt : null} onClose={() => setCompleteOpen(false)} onDone={() => { setCompleteOpen(false); onChanged?.(); onClose(); }} />
      <RescheduleModal appt={reschedOpen ? appt : null} onClose={() => setReschedOpen(false)} onDone={() => { setReschedOpen(false); onChanged?.(); onClose(); }} />
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Anulo terminin">
        <p className="text-[13.5px] text-mute">Anulo <b className="text-ink">{appt.reference}</b> — {fmtDateLong(appt.date)} në {appt.start_time}?</p>
        <div className="flex gap-3 mt-5">
          <Button variant="ghost" onClick={() => setCancelOpen(false)}>Kthehu</Button>
          <Button variant="danger" className="flex-1" loading={confirming} onClick={() => act(() => doCancel(), "Termini u anulua.")}>Po, anulo</Button>
        </div>
      </Modal>
    </>
  );
}

function CompletionModal({ appt, onClose, onDone }: { appt: AppointmentRow | null; onClose: () => void; onDone: () => void }) {
  const { session, toast } = useApp();
  const [f, setF] = useState({ summary: "", analyses_performed: "", findings: "", recommendations: "", next_steps: "", follow_up: "recommended", follow_up_timeframe: "" });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!appt) return;
    if (!f.summary || !f.findings) { toast("Përmbledhja dhe gjetjet janë të detyrueshme.", "bad"); return; }
    setBusy(true);
    try {
      await completeAppointment(session, appt.id, f as never);
      toast("Konsulta u përfundua. Klienti u njoftua.");
      onDone();
    } catch (e) { toast(e instanceof Error ? e.message : "Gabim.", "bad"); } finally { setBusy(false); }
  };
  return (
    <Modal open={!!appt} onClose={onClose} title="Përfundo konsultën" wide>
      <div className="space-y-4">
        <Field label="Përmbledhja e diskutimit" required><TextArea value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} /></Field>
        <Field label="Analizat e kryera"><TextInput value={f.analyses_performed} onChange={(e) => setF({ ...f, analyses_performed: e.target.value })} placeholder="p.sh. Cronbach's Alpha, Pearson, Regresion…" /></Field>
        <Field label="Gjetjet" required><TextArea value={f.findings} onChange={(e) => setF({ ...f, findings: e.target.value })} /></Field>
        <Field label="Rekomandimet"><TextArea value={f.recommendations} onChange={(e) => setF({ ...f, recommendations: e.target.value })} /></Field>
        <Field label="Hapat e tjerë"><TextInput value={f.next_steps} onChange={(e) => setF({ ...f, next_steps: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ndjekja">
            <Select value={f.follow_up} onChange={(e) => setF({ ...f, follow_up: e.target.value })}>
              <option value="none">Pa ndjekje</option>
              <option value="recommended">E rekomanduar</option>
              <option value="required">E domosdoshme</option>
            </Select>
          </Field>
          <Field label="Afati i ndjekjes"><TextInput value={f.follow_up_timeframe} onChange={(e) => setF({ ...f, follow_up_timeframe: e.target.value })} placeholder="p.sh. 2 javë" /></Field>
        </div>
        <Button className="w-full" loading={busy} onClick={submit}>Ruaj dhe përfundo</Button>
      </div>
    </Modal>
  );
}

function RescheduleModal({ appt, onClose, onDone }: { appt: AppointmentRow | null; onClose: () => void; onDone: () => void }) {
  const { session, toast } = useApp();
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const days14 = useMemo(() => Array.from({ length: 14 }, (_, i) => addDaysISO(todayISO(), i + 1)), []);

  React.useEffect(() => {
    if (!appt || !date) { setSlots(null); return; }
    let alive = true;
    import("../lib/services").then(({ bookingSlots }) => bookingSlots(appt.consultant_id, date, appt.duration_minutes).then((s) => alive && setSlots(s)));
    return () => { alive = false; };
  }, [date, appt]);

  const isConsultant = session?.user.role === "consultant";
  const submit = async () => {
    if (!appt || !date || !time) { toast("Zgjidhni datën dhe orën.", "bad"); return; }
    setBusy(true);
    try {
      // consultants use the ownership-scoped RPC; staff keep the staff RPC
      if (isConsultant) await rescheduleByConsultant(session, appt.id, date, time);
      else await rescheduleByStaff(session, appt.id, date, time);
      toast("Termini u rizhvendos.");
      onDone();
    } catch (e) { toast(e instanceof Error ? e.message : "Gabim.", "bad"); } finally { setBusy(false); }
  };

  return (
    <Modal open={!!appt} onClose={onClose} title="Rizhvendos terminin" wide>
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
        {days14.map((d) => (
          <button key={d} onClick={() => { setDate(d); setTime(null); }}
            className={cls("shrink-0 w-[70px] rounded-xl border py-2 text-center transition-all", date === d ? "bg-primary-600 border-primary-600 text-primary-50" : "border-line-2 hover:border-primary-300")}>
            <span className={cls("block text-[10px] font-bold uppercase", date === d ? "text-primary-100" : "text-mute")}>{DAYS_SQ_SHORT[(new Date(d + "T12:00:00").getDay() + 6) % 7]}</span>
            <span className="block font-display font-bold text-[14px]">{d.slice(8)}/{d.slice(5, 7)}</span>
          </button>
        ))}
      </div>
      {date && (
        <div className="mt-3">
          {!slots && <div className="grid grid-cols-5 gap-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>}
          {slots && slots.length === 0 && <p className="text-[13px] font-semibold text-bad bg-bad-soft rounded-lg px-4 py-3">Asnjë orar i lirë më {fmtDateLong(date)}.</p>}
          {slots && slots.length > 0 && (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {slots.map((s) => (
                <button key={s} onClick={() => setTime(s)} className={cls("h-10 rounded-lg border font-mono text-[13px] font-bold transition-all", time === s ? "bg-primary-600 border-primary-600 text-primary-50" : "border-line-2 text-ink-2 hover:border-primary-400")}>{s}</button>
              ))}
            </div>
          )}
        </div>
      )}
      <Button className="w-full mt-5" disabled={!date || !time} loading={busy} onClick={submit}>Konfirmo rizhvendosjen</Button>
    </Modal>
  );
}

// ─── Calendar page ────────────────────────────────────────────────────────────
export function ConsultantCalendar() {
  const { session } = useApp();
  const [view, setView] = useState<PlannerView>("week");
  const [sel, setSel] = useState<AppointmentRow | null>(null);
  const appts = useAsync(() => listAppointments(session), [session?.user_id]);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink mb-5">Kalendari</h1>
      {appts.error ? <ErrorState message={appts.error} onRetry={appts.retry} /> : (
        <PlannerCalendar appointments={appts.data ?? []} view={view} onViewChange={setView} onEventClick={setSel} />
      )}
      <AppointmentDrawer appt={sel} onClose={() => setSel(null)} onChanged={appts.retry} />
    </div>
  );
}

// ─── Appointments page ────────────────────────────────────────────────────────
export function ConsultantAppointments() {
  const { session } = useApp();
  const [tab, setTab] = useState("upcoming");
  const [q, setQ] = useState("");
  const appts = useAsync(() => listAppointments(session, { search: q }), [session?.user_id, q]);
  const [sel, setSel] = useState<AppointmentRow | null>(null);

  const list = useMemo(() => {
    const all = (appts.data ?? []).filter((a) => a.status !== "rescheduled");
    if (tab === "upcoming") return all.filter((a) => ["pending", "confirmed"].includes(a.status) && a.date >= todayISO());
    if (tab === "past") return all.filter((a) => ["completed", "no_show"].includes(a.status)).reverse();
    return all.filter((a) => ["cancelled", "no_show"].includes(a.status)).reverse();
  }, [appts.data, tab]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Terminet</h1>
        <div className="w-64"><SearchInput value={q} onChange={setQ} placeholder="Klient, referencë, temë…" /></div>
      </div>
      <div className="flex gap-1.5 mb-5">
        {([["upcoming", "Të ardhshme"], ["past", "Të përfunduara"], ["cancelled", "Anuluar"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={cls("px-3.5 h-9 rounded-lg text-[13px] font-bold transition-all", tab === k ? "bg-ink text-paper" : "bg-card border border-line text-mute hover:text-ink")}>{l}</button>
        ))}
      </div>
      {appts.error && <ErrorState message={appts.error} onRetry={appts.retry} />}
      <div className="space-y-2.5 stagger">
        {list.map((a) => (
          <Card key={a.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:shadow-soft transition-all cursor-pointer" onClick={() => setSel(a)}>
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <div className="w-14 text-center bg-paper border border-line rounded-lg py-2 shrink-0">
                <p className="font-display font-bold text-[15px] text-ink leading-none">{a.date.slice(8)}</p>
                <p className="text-[10px] font-mono text-mute mt-0.5">{a.start_time}</p>
              </div>
              <div className="min-w-0">
                <p className="font-bold text-ink text-[14px] truncate">{a.service_name} — {a.client_name}</p>
                <p className="text-[12px] text-mute truncate">{a.research_topic || a.problem_description || fmtDate(a.date)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={APPT_STATUS[a.status].tone}>{APPT_STATUS[a.status].label}</Badge>
              {a.status === "pending" && <Badge tone="warn">Pritet konfirmimi</Badge>}
            </div>
          </Card>
        ))}
      </div>
      {!appts.loading && list.length === 0 && !appts.error && <Card><EmptyState icon={<ICal size={22} />} title="Asnjë termin" hint="Terminet e reja do të shfaqen këtu sapo të rezervohen." /></Card>}
      <AppointmentDrawer appt={sel} onClose={() => setSel(null)} onChanged={appts.retry} />
    </div>
  );
}

// ─── Projects (consultant view) ──────────────────────────────────────────────
export function ConsultantProjects() {
  const { session } = useApp();
  const projects = useAsync(() => listProjects(session), [session?.user_id]);
  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink mb-5">Projektet</h1>
      {projects.loading && <div className="grid md:grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>}
      {projects.error && <ErrorState message={projects.error} onRetry={projects.retry} />}
      {!projects.loading && (projects.data ?? []).length === 0 && <Card><EmptyState icon={<IFolder size={22} />} title="Asnjë projekt i caktuar" hint="Projektet ku jeni caktuar do të shfaqen këtu." /></Card>}
      <div className="grid md:grid-cols-2 gap-4 stagger">
        {(projects.data ?? []).map((p) => (
          <Link key={p.id} to={`/consultant/projektet/${p.id}`} className="card p-5 hover:shadow-lift hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-between gap-3">
              <Badge tone={p.status === "completed" ? "ok" : "info"}>{PROJECT_STATUS[p.status]}</Badge>
              <span className="font-mono text-[12px] font-bold text-primary-700">{p.progress}%</span>
            </div>
            <h2 className="font-display font-bold text-ink mt-3">{p.title}</h2>
            <p className="text-[12.5px] text-mute mt-1">{p.client_name} · {p.university || "—"}</p>
            <Progress value={p.progress} className="mt-3.5" />
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ConsultantProjectDetail({ id }: { id: string }) {
  const { session, toast } = useApp();
  const detail = useAsync(() => getProjectDetail(session, id), [session?.user_id, id]);
  const [taskModal, setTaskModal] = useState<null | { id?: string; name: string; status: string; progress: number; notes: string; assigned_consultant_id: string | null }>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [selAppt, setSelAppt] = useState<AppointmentRow | null>(null);
  const d = detail.data;

  // The signed-in consultant's own consultants row ("" if staff-only / not linked).
  const me = useAsync(async () => (session?.user.role === "consultant" ? myConsultantId(session) : ""), [session?.user_id]);

  const changeStatus = async (status: string) => {
    if (!d || statusSaving) return;
    setStatusSaving(true);
    try {
      await updateProjectStatus(session, d.project.id, status as never);
      toast("Statusi u përditësua.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gabim gjatë ndryshimit të statusit.", "bad");
    } finally {
      setStatusSaving(false);
    }
  };

  const saveT = async () => {
    if (!taskModal || !d) return;
    setStatusBusy(true);
    try {
      await saveTask(session, d.project.id, taskModal as never);
      toast("Faza u ruajt.");
      setTaskModal(null);
      detail.retry();
    } catch (e) { toast(e instanceof Error ? e.message : "Gabim.", "bad"); } finally { setStatusBusy(false); }
  };

  if (detail.loading) return <div className="space-y-4"><Skeleton className="h-28 rounded-xl" /><Skeleton className="h-72 rounded-xl" /></div>;
  if (detail.error || !d) return <ErrorState message={detail.error ?? "Projekti nuk u gjet."} onRetry={detail.retry} />;
  const p = d.project;

  // Status edits are allowed at the database only for staff or the PRIMARY consultant.
  // A collaborator (non-primary) sees the status read-only but can still edit analysis tasks.
  const isStaff = session?.user.role === "admin" || session?.user.role === "super_admin";
  const isPrimary = !!me.data && me.data === p.primary_consultant_id;
  const canChangeStatus = isStaff || isPrimary;
  const primaryName = p.collaborators.find((c) => c.consultant_id === p.primary_consultant_id)?.name ?? "";

  return (
    <div>
      <Link to="/consultant/projektet" className="text-[13px] font-semibold text-mute hover:text-primary-700">← Projektet</Link>
      <div className="card p-6 mt-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display text-xl font-bold tracking-tight text-ink">{p.title}</h1>
              {canChangeStatus ? (
                <Select
                  value={p.status}
                  disabled={statusSaving}
                  onChange={(e) => void changeStatus(e.target.value)}
                  className="!w-48 !h-8 !text-[12.5px] !font-sans !font-bold"
                  title="Ndrysho statusin e projektit"
                >
                  {Object.entries(PROJECT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Badge tone="info">{PROJECT_STATUS[p.status]}</Badge>
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-mute bg-paper border border-line rounded-md px-2 py-1"
                    title={`Statusin e ndryshon konsulent kryesor${primaryName ? ` (${primaryName})` : ""} ose stafi.`}
                  >
                    <ILock size={11} /> Vetëm lexim
                  </span>
                </span>
              )}
              {isPrimary && <Badge tone="ok">Konsulent kryesor</Badge>}
            </div>
            <p className="text-[13px] text-mute mt-1.5">{p.client_name} · {p.university || "—"} {p.deadline && `· Afati ${fmtDate(p.deadline)}`}</p>
          </div>
          <p className="font-display font-bold text-3xl text-primary-700">{p.progress}%</p>
        </div>
        <Progress value={p.progress} className="mt-4" />
        {p.research_questions && <p className="text-[13px] text-ink-2 mt-4"><b>Pyetjet:</b> {p.research_questions}</p>}
        {p.hypotheses && p.hypotheses !== "—" && <p className="text-[13px] text-ink-2 mt-1"><b>Hipotezat:</b> {p.hypotheses}</p>}
      </div>

      <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-5 mt-5">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-ink">Workflow i analizës</h2>
            <Button size="sm" variant="outline" onClick={() => setTaskModal({ name: "", status: "not_started", progress: 0, notes: "", assigned_consultant_id: null })}><IPlus size={13} /> Shto fazë</Button>
          </div>
          <div className="space-y-2">
            {d.tasks.map((t) => (
              <button key={t.id} onClick={() => setTaskModal({ id: t.id, name: t.name, status: t.status, progress: t.progress, notes: t.notes, assigned_consultant_id: t.assigned_consultant_id })}
                className={cls("w-full text-left p-3.5 rounded-xl border transition-all hover:border-primary-300", t.status === "not_required" ? "border-line opacity-50" : "border-line bg-card")}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13.5px] font-bold text-ink">{t.name}</p>
                  <Badge tone={TASK_STATUS[t.status].tone as never}>{TASK_STATUS[t.status].label}</Badge>
                </div>
                {t.status !== "not_required" && (
                  <div className="flex items-center gap-3 mt-2">
                    <Progress value={t.progress} tone={t.status === "completed" ? "ok" : "primary"} className="flex-1" />
                    <span className="font-mono text-[11px] text-mute">{t.progress}%</span>
                  </div>
                )}
                {t.notes && <p className="text-[12px] text-mute mt-1.5 truncate">{t.notes}</p>}
              </button>
            ))}
          </div>
        </Card>
        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="font-display font-bold text-ink mb-3.5">Skedarët e projektit</h2>
            <FileList files={d.files} empty="Ngarkoni SPSS output, raporte ose setin e të dhënave." />
          </Card>
          <Card className="p-5">
            <h2 className="font-display font-bold text-ink mb-3.5">Terminet e lidhura</h2>
            <MiniAgenda list={d.appointments} onEventClick={setSelAppt} empty="Asnjë termin." />
          </Card>
        </div>
      </div>

      <Modal open={!!taskModal} onClose={() => setTaskModal(null)} title={taskModal?.id ? "Redakto fazën" : "Shto fazë analize"}>
        {taskModal && (
          <div className="space-y-4">
            {!taskModal.id && (
              <Field label="Faza">
                <Select value={taskModal.name} onChange={(e) => setTaskModal({ ...taskModal, name: e.target.value })}>
                  <option value="">Zgjidhni fazën…</option>
                  {ANALYSIS_TASK_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
                </Select>
              </Field>
            )}
            <Field label="Statusi">
              <Select value={taskModal.status} onChange={(e) => setTaskModal({ ...taskModal, status: e.target.value })}>
                {Object.entries(TASK_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </Select>
            </Field>
            {taskModal.status !== "not_required" && taskModal.status !== "completed" && (
              <Field label={`Progresi: ${taskModal.status === "in_progress" || taskModal.status === "waiting" ? taskModal.progress + "%" : "0%"}`}>
                <input type="range" min={0} max={100} step={5} value={taskModal.progress} onChange={(e) => setTaskModal({ ...taskModal, progress: +e.target.value })} className="w-full accent-[#1b44cc]" />
              </Field>
            )}
            <Field label="Shënime"><TextArea value={taskModal.notes} onChange={(e) => setTaskModal({ ...taskModal, notes: e.target.value })} /></Field>
            <Button className="w-full" loading={statusBusy} disabled={!taskModal.id && !taskModal.name} onClick={saveT}>Ruaj fazën</Button>
          </div>
        )}
      </Modal>

      {/* linked appointment detail — same drawer used across the consultant portal;
          actions inside it are ownership-scoped server-side */}
      <AppointmentDrawer appt={selAppt} onClose={() => setSelAppt(null)} onChanged={detail.retry} />
    </div>
  );
}

// ─── Clients / Files / Analyses / Earnings / Reviews / Availability / Profile ─
export function ConsultantClientsPage() {
  const { session } = useApp();
  const clients = useAsync(() => consultantClients(session), [session?.user_id]);
  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink mb-5">Klientët</h1>
      {clients.loading && <Card className="p-5"><TableSkeleton rows={5} /></Card>}
      {clients.error && <ErrorState message={clients.error} onRetry={clients.retry} />}
      {!clients.loading && (clients.data ?? []).length === 0 && <Card><EmptyState icon={<IUsers size={22} />} title="Asnjë klient" hint="Klientët e termineve dhe projekteve tuaja shfaqen këtu." /></Card>}
      <Card className="overflow-hidden">
        {!clients.loading && (clients.data ?? []).length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead className="bg-paper/70"><tr><Th>Klienti</Th><Th>Konsulta</Th><Th>E përfunduar</Th><Th>Termini tjetër</Th><Th>E fundit</Th></tr></thead>
              <tbody>
                {(clients.data ?? []).map((c) => (
                  <tr key={c.id} className="hover:bg-paper/50">
                    <Td><div className="flex items-center gap-2.5"><Avatar name={c.full_name} size={32} /><div><p className="font-bold text-ink">{c.full_name}</p><p className="text-[11.5px] text-mute">{c.email}</p></div></div></Td>
                    <Td className="font-mono">{c.total}</Td>
                    <Td className="font-mono">{c.completed}</Td>
                    <Td>{c.next ? <span className="font-semibold text-ok">{fmtDate(c.next.date)} {c.next.start_time}</span> : <span className="text-mute">—</span>}</Td>
                    <Td className="font-mono text-[12.5px]">{c.last ? fmtDate(c.last) : "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export function ConsultantFiles() {
  const { session } = useApp();
  const files = useAsync(() => listFiles(session), [session?.user_id]);
  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink mb-5">Dokumentet</h1>
      {files.error && <ErrorState message={files.error} onRetry={files.retry} />}
      <Card className="p-4">
        {files.loading ? <TableSkeleton rows={5} /> : <FileList files={files.data ?? []} empty="Vetëm skedarët e projekteve dhe termineve ku jeni caktuar." />}
      </Card>
    </div>
  );
}

export function ConsultantAnalyses() {
  const { session } = useApp();
  const tasks = useAsync(async () => {
    const { consultantAnalyses } = await import("../lib/services");
    return consultantAnalyses(session);
  }, [session?.user_id]);
  const byProject = useMemo(() => {
    const map = new Map<string, typeof tasks.data extends (infer T)[] | null ? T[] : never>();
    for (const t of tasks.data ?? []) {
      if (!map.has(t.project_title)) map.set(t.project_title, []);
      map.get(t.project_title)!.push(t);
    }
    return [...map.entries()];
  }, [tasks.data]);
  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink mb-5">Analizat</h1>
      {tasks.loading && <div className="space-y-4">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}</div>}
      {tasks.error && <ErrorState message={tasks.error} onRetry={tasks.retry} />}
      {!tasks.loading && byProject.length === 0 && <Card><EmptyState icon={<IScatter size={22} />} title="Asnjë analizë aktive" hint="Fazat e analizës nga projektet tuaja shfaqen këtu." /></Card>}
      <div className="grid lg:grid-cols-2 gap-4 stagger">
        {byProject.map(([title, list]) => (
          <Card key={title} className="p-5">
            <h2 className="font-display font-bold text-ink mb-3">{title}</h2>
            <div className="space-y-2">
              {list.map((t) => (
                <div key={t.id} className="flex items-center gap-3">
                  <span className={cls("w-2 h-2 rounded-full shrink-0", t.status === "completed" ? "bg-ok" : t.status === "in_progress" ? "bg-amber" : t.status === "waiting" ? "bg-teal" : "bg-line-2")} />
                  <p className={cls("text-[13px] flex-1", t.status === "not_required" ? "text-mute line-through" : "font-semibold text-ink-2")}>{t.name}</p>
                  {t.status !== "not_required" && <span className="font-mono text-[11px] text-mute">{t.progress}%</span>}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function ConsultantEarnings() {
  const { session } = useApp();
  const payments = useAsync(() => listPayments(session), [session?.user_id]);
  const paid = (payments.data ?? []).filter((p) => p.status === "paid");
  const total = paid.reduce((a, p) => a + p.consultant_net, 0);
  const pendingPayout = paid.filter((p) => p.payout_status !== "paid").reduce((a, p) => a + p.consultant_net, 0);
  const monthStart = todayISO().slice(0, 8) + "01";
  const month = paid.filter((p) => (p.paid_at ?? "").slice(0, 10) >= monthStart).reduce((a, p) => a + p.consultant_net, 0);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink mb-5">Të ardhurat</h1>
      <div className="grid sm:grid-cols-3 gap-4 stagger">
        <Card className="p-5"><p className="text-[11px] font-mono uppercase tracking-wider text-mute">Totali neto</p><p className="font-display font-bold text-2xl text-ink mt-1.5">{fmtEuro(total)}</p></Card>
        <Card className="p-5"><p className="text-[11px] font-mono uppercase tracking-wider text-mute">Këtë muaj</p><p className="font-display font-bold text-2xl text-primary-700 mt-1.5">{fmtEuro(month)}</p></Card>
        <Card className="p-5"><p className="text-[11px] font-mono uppercase tracking-wider text-mute">Në pritje të pagesës</p><p className="font-display font-bold text-2xl text-warn mt-1.5">{fmtEuro(pendingPayout)}</p></Card>
      </div>
      <Card className="overflow-hidden mt-5">
        {payments.loading ? <div className="p-5"><TableSkeleton rows={6} /></div> : (payments.data ?? []).length === 0
          ? <EmptyState icon={<IEuro size={20} />} title="Asnjë pagesë" hint="Fitimet tuaja do të shfaqen këtu." />
          : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="bg-paper/70"><tr><Th>Data</Th><Th>Klienti</Th><Th>Shërbimi</Th><Th>Bruto</Th><Th>Komisioni</Th><Th>Neto</Th><Th>Statusi</Th></tr></thead>
                <tbody>
                  {(payments.data ?? []).filter((p) => p.status === "paid").map((p) => (
                    <tr key={p.id} className="hover:bg-paper/50">
                      <Td className="font-mono text-[12.5px]">{fmtDate((p.paid_at ?? p.created_at).slice(0, 10))}</Td>
                      <Td className="font-semibold text-ink">{p.client_name}</Td>
                      <Td>{p.service_name}</Td>
                      <Td className="font-mono">{fmtEuro(p.amount_gross)}</Td>
                      <Td className="font-mono text-bad">−{fmtEuro(p.platform_fee)}</Td>
                      <Td className="font-mono font-bold text-ok">{fmtEuro(p.consultant_net)}</Td>
                      <Td><Badge tone={p.payout_status === "paid" ? "ok" : p.payout_status === "approved" ? "teal" : "warn"}>{{ pending: "Në pritje", approved: "Aprovuar", paid: "Paguar" }[p.payout_status]}</Badge></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Card>
    </div>
  );
}

export function ConsultantReviews() {
  const { session } = useApp();
  const reviews = useAsync(() => listReviews(session), [session?.user_id]);
  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink mb-5">Vlerësimet</h1>
      {reviews.loading && <div className="grid md:grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}</div>}
      {!reviews.loading && (reviews.data ?? []).length === 0 && <Card><EmptyState icon={<IStar size={22} />} title="Ende pa vlerësime" hint="Vetëm klientët me konsulta të përfunduara mund t'ju vlerësojnë." /></Card>}
      <div className="grid md:grid-cols-2 gap-4 stagger">
        {(reviews.data ?? []).map((r) => (
          <Card key={r.id} className="p-5">
            <div className="flex items-center justify-between">
              <Stars value={r.rating} size={15} />
              <Badge tone={r.status === "published" ? "ok" : r.status === "pending" ? "warn" : "bad"}>{{ pending: "Në moderim", published: "Publikuar", rejected: "Refuzuar" }[r.status]}</Badge>
            </div>
            <p className="text-[13.5px] text-ink-2 mt-3 leading-relaxed">{r.comment || "—"}</p>
            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              {([["Qartësia", r.clarity], ["Dobishmëria", r.usefulness], ["Rekomandim", r.recommendation]] as const).map(([l, v]) => (
                <div key={l} className="bg-paper rounded-lg py-2"><p className="font-display font-bold text-ink">{v}.0</p><p className="text-[10.5px] text-mute">{l}</p></div>
              ))}
            </div>
            <p className="text-[11.5px] text-mute mt-3 font-mono">{r.client_name} · {r.reference} · {fmtDate(r.created_at.slice(0, 10))}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function ConsultantAvailability() {
  const { session, toast } = useApp();
  const [windows, setWindows] = useState<{ day: number; start: string; end: string }[] | null>(null);
  const [blocks, setBlocks] = useState<{ id: string; date: string; end_date: string | null; start_time: string | null; end_time: string | null; reason: string; type: string }[] | null>(null);
  const [google, setGoogle] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [nb, setNb] = useState({ date: todayISO(), end_date: "", start_time: "", end_time: "", reason: "", type: "meeting" });

  useAsync(async () => {
    const data = await getMyAvailability(session);
    if (!data) return null;
    setWindows(data.windows.sort((a, b) => a.day - b.day));
    setBlocks(data.blocks);
    setGoogle(data.google);
    return data;
  }, [session?.user_id]);

  const myId = async () => myConsultantId(session);

  const saveWindows = async () => {
    setBusy(true);
    try {
      await saveWeeklyAvailability(session, await myId(), windows ?? []);
      toast("Disponueshmëria javore u ruajt.");
    } catch (e) { toast(e instanceof Error ? e.message : "Gabim.", "bad"); } finally { setBusy(false); }
  };

  const addB = async () => {
    if (!nb.date || !nb.reason) { toast("Data dhe arsyeja janë të detyrueshme.", "bad"); return; }
    setBusy(true);
    try {
      await addBlock(session, { consultant_id: await myId(), date: nb.date, end_date: nb.end_date || null, start_time: nb.start_time || null, end_time: nb.end_time || null, reason: nb.reason, type: nb.type as never });
      toast("Periudha u bllokua.");
      setBlockOpen(false);
      setNb({ date: todayISO(), end_date: "", start_time: "", end_time: "", reason: "", type: "meeting" });
    } catch (e) { toast(e instanceof Error ? e.message : "Gabim.", "bad"); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Disponueshmëria</h1>
        <Button size="sm" variant="outline" onClick={() => setBlockOpen(true)}><IPlus size={13} /> Blloko periudhë</Button>
      </div>

      <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-5">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-ink">Orari javor</h2>
            <Button size="sm" loading={busy} onClick={saveWindows}>Ruaj</Button>
          </div>
          {!windows ? <TableSkeleton rows={4} /> : (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                const rows = windows.filter((w) => w.day === day);
                return (
                  <div key={day} className="border border-line rounded-xl p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[13px] font-bold text-ink">{DAYS_SQ[day - 1]}</p>
                      <button onClick={() => setWindows([...windows, { day, start: "09:00", end: "12:00" }])}
                        className="text-[11.5px] font-bold text-primary-700 hover:underline">+ Shto orar</button>
                    </div>
                    {rows.length === 0 && <p className="text-[12px] text-mute">Pushim</p>}
                    {rows.map((w, i) => (
                      <div key={i} className="flex items-center gap-2 mb-1.5">
                        <input type="time" value={w.start} onChange={(e) => setWindows(windows.map((x) => x === w ? { ...x, start: e.target.value } : x))} className="h-8 px-2 rounded-lg border border-line-2 text-[12.5px] font-mono" />
                        <span className="text-mute text-[12px]">–</span>
                        <input type="time" value={w.end} onChange={(e) => setWindows(windows.map((x) => x === w ? { ...x, end: e.target.value } : x))} className="h-8 px-2 rounded-lg border border-line-2 text-[12.5px] font-mono" />
                        <button onClick={() => setWindows(windows.filter((x) => x !== w))} className="text-mute hover:text-bad transition-colors"><IX size={14} /></button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-lg bg-paper border border-line flex items-center justify-center"><IGoogle size={18} /></span>
                <div>
                  <p className="font-display font-bold text-ink text-[14.5px]">Google Calendar</p>
                  <p className="text-[12px] text-mute">{google ? "I lidhur — ngjarjet busy bllokojnë terminet automatikisht." : "Lidhni kalendarin tuaj personal."}</p>
                </div>
              </div>
              <Toggle checked={google} onChange={async () => { const v = await toggleGoogleCalendar(session); setGoogle(v); toast(v ? "Google Calendar u lidh." : "Google Calendar u shkëput."); }} />
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="font-display font-bold text-ink mb-3.5">Periudhat e bllokuara</h2>
            {!blocks ? <TableSkeleton rows={3} /> : blocks.length === 0 ? <p className="text-[13px] text-mute">Asnjë bllokim. Shtoni pushime, takime ose festa.</p> : (
              <div className="space-y-2">
                {blocks.map((b) => (
                  <div key={b.id} className="flex items-center gap-3 p-3 rounded-xl border border-line">
                    <Badge tone={b.type === "vacation" ? "teal" : b.type === "holiday" ? "warn" : "mute"}>{{ vacation: "Pushim", meeting: "Takim", holiday: "Festë", personal: "Personale" }[b.type]}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-ink truncate">{b.reason}</p>
                      <p className="text-[11.5px] text-mute font-mono">{fmtDate(b.date)}{b.end_date ? ` → ${fmtDate(b.end_date)}` : ""}{b.start_time ? ` · ${b.start_time}–${b.end_time}` : " · gjithë dita"}</p>
                    </div>
                    <button onClick={async () => { await removeBlock(session, b.id); setBlocks(blocks.filter((x) => x.id !== b.id)); toast("Bllokimi u hoq."); }} className="text-mute hover:text-bad transition-colors"><ITrash size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <Modal open={blockOpen} onClose={() => setBlockOpen(false)} title="Blloko periudhë">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nga data" required><TextInput type="date" value={nb.date} onChange={(e) => setNb({ ...nb, date: e.target.value })} /></Field>
            <Field label="Deri më (opsionale)"><TextInput type="date" value={nb.end_date} onChange={(e) => setNb({ ...nb, end_date: e.target.value })} /></Field>
            <Field label="Nga ora (opsionale)"><TextInput type="time" value={nb.start_time} onChange={(e) => setNb({ ...nb, start_time: e.target.value })} /></Field>
            <Field label="Deri në orën"><TextInput type="time" value={nb.end_time} onChange={(e) => setNb({ ...nb, end_time: e.target.value })} /></Field>
          </div>
          <Field label="Lloji">
            <Select value={nb.type} onChange={(e) => setNb({ ...nb, type: e.target.value })}>
              <option value="meeting">Takim</option><option value="vacation">Pushim</option><option value="holiday">Festë</option><option value="personal">Personale</option>
            </Select>
          </Field>
          <Field label="Arsyeja" required><TextInput value={nb.reason} onChange={(e) => setNb({ ...nb, reason: e.target.value })} placeholder="p.sh. Konferencë shkencore" /></Field>
          <p className="text-[11.5px] text-mute">Orët e lënë bosh = gjithë dita bllokohet. Terminet e konfirmuara nuk preken.</p>
          <Button className="w-full" loading={busy} onClick={addB}>Blloko</Button>
        </div>
      </Modal>
    </div>
  );
}

export function ConsultantProfile() {
  const { session, toast } = useApp();
  const me = useAsync(async () => {
    const cId = await myConsultantId(session);
    return cId ? getConsultantById(cId) : null;
  }, [session?.user_id]);
  const [f, setF] = useState<{ title: string; bio: string } | null>(null);
  const [busy, setBusy] = useState(false);
  React.useEffect(() => {
    if (me.data) setF({ title: me.data.professional_title, bio: me.data.bio });
  }, [me.data]);

  const save = async () => {
    if (!me.data || !f) return;
    setBusy(true);
    try {
      await saveConsultantSelf(session, { professional_title: f.title, bio: f.bio });
      toast("Profili publik u përditësua.");
    } catch (e) { toast(e instanceof Error ? e.message : "Gabim.", "bad"); } finally { setBusy(false); }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink mb-5">Profili</h1>
      {me.loading && <Skeleton className="h-80 rounded-xl" />}
      {me.error && <ErrorState message={me.error} onRetry={me.retry} />}
      {me.data && f && (
        <div className="grid md:grid-cols-[0.9fr_1.1fr] gap-5">
          <Card className="p-6">
            <div className="flex flex-col items-center text-center">
              <Avatar name={me.data.display_name} size={72} />
              <p className="font-display font-bold text-ink text-lg mt-3">{me.data.display_name}</p>
              <p className="text-[12.5px] text-mute">{me.data.professional_title}</p>
              <div className="flex items-center gap-1.5 mt-2"><Stars value={me.data.rating} size={13} /><span className="text-[12px] font-bold text-mute">{me.data.rating.toFixed(1)} ({me.data.review_count})</span></div>
              <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                {me.data.specializations.slice(0, 4).map((s) => <span key={s} className="text-[11px] font-semibold bg-paper border border-line rounded-md px-2 py-1">{SPECIALIZATIONS[s] ?? s}</span>)}
              </div>
            </div>
            <div className="mt-5 pt-5 border-t border-line">
              <KV k="Çmimi fillestar" v={fmtEuro(me.data.starting_price)} />
              <KV k="Shërbime aktive" v={me.data.services.length} />
              <KV k="Termini tjetër" v={me.data.next ? `${fmtDate(me.data.next.date)} ${me.data.next.time}` : "—"} />
            </div>
            <Link to={`/konsulentet/${me.data.slug}`} className="block mt-4">
              <Button variant="outline" className="w-full" size="sm">Shiko profilin publik <IArrowR size={13} /></Button>
            </Link>
          </Card>
          <Card className="p-6">
            <p className="font-display font-bold text-ink mb-4">Profili publik</p>
            <div className="space-y-4">
              <Field label="Titulli profesional"><TextInput value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
              <Field label="Biografia"><TextArea value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} className="min-h-[160px]" /></Field>
              <Button loading={busy} onClick={save}>Ruaj ndryshimet</Button>
              <p className="text-[11.5px] text-mute">Specializimet, shërbimet dhe çmimet menaxhohen nga administratori i platformës.</p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
