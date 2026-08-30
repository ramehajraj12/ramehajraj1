import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp, useAsync } from "../lib/store";
import {
  listProjects, getProjectDetail, createProject, updateProjectStatus, assignProjectConsultant,
  saveTask, addProjectNote, listClientsAdmin, listConsultantsAdmin, saveConsultantAdmin,
  saveConsultantServicesAdmin, saveWeeklyAvailability, addBlock, removeBlock,
  listAllServicesAdmin, saveServiceAdmin, listApplications, setApplicationStatus,
  listWaitlist, setWaitlistStatus, listAppointments, listActiveServices,
  getConsultantServiceRows,
  type AppointmentRow, type ProjectRow,
} from "../lib/services";

import {
  PROJECT_STATUS, TASK_STATUS, SERVICE_CATEGORY, SPECIALIZATIONS, LANGUAGES,
  APPT_STATUS, DAYS_SQ, REVIEW_STATUS, APPLICATION_STATUS, SPEC_LABEL,
} from "../lib/i18n";
import { fmtEuro, fmtDate, fmtDateLong, fmtDateTime, fmtDuration, relativeTime, cls, uid, todayISO } from "../lib/utils";
import {
  Avatar, Badge, Button, Card, Drawer, EmptyState, ErrorState, Field, KV, Modal, Progress,
  SearchInput, Select, Skeleton, Stars, TableSkeleton, Td, TextArea, TextInput, Th, Toggle,
} from "../components/ui";
import { MiniAgenda } from "../components/calendar";
import { AppointmentDrawer } from "./ConsultantPortal";
import { FileList } from "./ClientPortal";
import { IFolder, IPlus, IUsers, IUser, ISpark, IBriefcase, IQueue, ICheck, IX, IChevR, IStar, IWarn, IArrowR, ICal } from "../components/icons";

// ─── Projects list ────────────────────────────────────────────────────────────
export function AdminProjects() {
  const { session } = useApp();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const projects = useAsync(() => listProjects(session, { search: q, status }), [session?.user_id, q, status]);
  const [createOpen, setCreateOpen] = useState(false);
  const clients = useAsync(() => listClientsAdmin(session), [session?.user_id]);
  const consultants = useAsync(() => listConsultantsAdmin(session), [session?.user_id]);
  const [nf, setNf] = useState({ client_id: "", primary_consultant_id: "", title: "", research_topic: "", university: "", study_level: "master", deadline: "" });
  const [busy, setBusy] = useState(false);
  const { toast } = useApp();

  const create = async () => {
    if (!nf.client_id || !nf.primary_consultant_id || !nf.title) { toast("Klienti, konsulenti dhe titulli janë të detyrueshëm.", "bad"); return; }
    setBusy(true);
    try {
      await createProject(session, { ...nf, study_level: nf.study_level as never, deadline: nf.deadline || null });
      toast("Projekti u krijua. Konsulenti kryesor u njoftua.");
      setCreateOpen(false);
      setNf({ client_id: "", primary_consultant_id: "", title: "", research_topic: "", university: "", study_level: "master", deadline: "" });
    } catch (e) { toast(e instanceof Error ? e.message : "Gabim.", "bad"); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Projektet <span className="text-mute text-base font-sans font-medium">({(projects.data ?? []).length})</span></h1>
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="w-56"><SearchInput value={q} onChange={setQ} placeholder="Titull ose klient…" /></div>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="!w-52">
            <option value="all">Të gjitha statuset</option>
            {Object.entries(PROJECT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Button size="sm" onClick={() => setCreateOpen(true)}><IPlus size={14} /> Projekt i ri</Button>
        </div>
      </div>
      {projects.error && <ErrorState message={projects.error} onRetry={projects.retry} />}
      {!projects.loading && (projects.data ?? []).length === 0 && !projects.error && (
        <Card><EmptyState icon={<IFolder size={22} />} title="Asnjë projekt" hint="Krijoni projektin e parë për një klient." action={<Button onClick={() => setCreateOpen(true)}><IPlus size={14} /> Projekt i ri</Button>} /></Card>
      )}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
        {(projects.data ?? []).map((p) => (
          <Link key={p.id} to={`/admin/projektet/${p.id}`} className="card p-5 hover:shadow-lift hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-between gap-2">
              <Badge tone={p.status === "completed" ? "ok" : p.status === "cancelled" ? "bad" : "info"}>{PROJECT_STATUS[p.status]}</Badge>
              <span className="font-mono text-[12px] font-bold text-primary-700">{p.progress}%</span>
            </div>
            <h2 className="font-display font-bold text-ink mt-3 line-clamp-1">{p.title}</h2>
            <p className="text-[12.5px] text-mute mt-1">{p.client_name} · {p.consultant_name}</p>
            <Progress value={p.progress} className="mt-3.5" />
            <div className="flex items-center justify-between mt-3 text-[11.5px] text-mute">
              <span>{p.task_stats.completed}/{p.task_stats.total} faza</span>
              <span>{p.files_count} skedarë</span>
              {p.deadline && <span className={cls(p.deadline < todayISO() && "text-bad font-bold")}>{fmtDate(p.deadline)}</span>}
            </div>
          </Link>
        ))}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Projekt i ri" wide>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Klienti" required>
            <Select value={nf.client_id} onChange={(e) => setNf({ ...nf, client_id: e.target.value })}>
              <option value="">Zgjidhni…</option>
              {(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </Select>
          </Field>
          <Field label="Konsulenti kryesor" required>
            <Select value={nf.primary_consultant_id} onChange={(e) => setNf({ ...nf, primary_consultant_id: e.target.value })}>
              <option value="">Zgjidhni…</option>
              {(consultants.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.display_name}</option>)}
            </Select>
          </Field>
          <Field label="Titulli" required className="sm:col-span-2"><TextInput value={nf.title} onChange={(e) => setNf({ ...nf, title: e.target.value })} placeholder="p.sh. Teza master — …" /></Field>
          <Field label="Tema e hulumtimit" className="sm:col-span-2"><TextArea value={nf.research_topic} onChange={(e) => setNf({ ...nf, research_topic: e.target.value })} /></Field>
          <Field label="Universiteti"><TextInput value={nf.university} onChange={(e) => setNf({ ...nf, university: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Niveli">
              <Select value={nf.study_level} onChange={(e) => setNf({ ...nf, study_level: e.target.value })}>
                <option value="bachelor">Diplomë</option><option value="master">Master</option><option value="phd">Doktoraturë</option><option value="professional">Profesional</option>
              </Select>
            </Field>
            <Field label="Afati"><TextInput type="date" value={nf.deadline} onChange={(e) => setNf({ ...nf, deadline: e.target.value })} /></Field>
          </div>
        </div>
        <Button className="w-full mt-5" loading={busy} onClick={create}>Krijo projektin</Button>
      </Modal>
    </div>
  );
}

// ─── Project detail (full tabs) ──────────────────────────────────────────────
export function AdminProjectDetail({ id }: { id: string }) {
  const { session, toast } = useApp();
  const detail = useAsync(() => getProjectDetail(session, id), [session?.user_id, id]);
  const [tab, setTab] = useState("overview");
  const [sel, setSel] = useState<AppointmentRow | null>(null);
  const [note, setNote] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const consultants = useAsync(() => listConsultantsAdmin(session), [session?.user_id]);
  const [assignSel, setAssignSel] = useState({ consultant_id: "", role: "statistics" });
  const [taskModal, setTaskModal] = useState<null | { id?: string; name: string; status: string; progress: number; notes: string; assigned_consultant_id: string | null }>(null);
  const [tBusy, setTBusy] = useState(false);
  const d = detail.data;

  if (detail.loading) return <div className="space-y-4"><Skeleton className="h-28 rounded-xl" /><Skeleton className="h-80 rounded-xl" /></div>;
  if (detail.error || !d) return <ErrorState message={detail.error ?? "Projekti nuk u gjet."} onRetry={detail.retry} />;
  const p = d.project;

  const tabs: [string, string][] = [
    ["overview", "Përmbledhje"], ["appointments", `Terminet (${d.appointments.length})`],
    ["files", `Skedarët (${d.files.length})`], ["analysis", `Analiza (${d.tasks.length})`],
    ["notes", "Shënime"], ["payments", `Pagesat (${d.payments.length})`],
    ["deliverables", "Dorëzimet"], ["activity", "Aktiviteti"],
  ];

  const saveT = async () => {
    if (!taskModal) return;
    setTBusy(true);
    try {
      await saveTask(session, id, taskModal as never);
      toast("Faza u ruajt."); setTaskModal(null); detail.retry();
    } catch (e) { toast(e instanceof Error ? e.message : "Gabim.", "bad"); } finally { setTBusy(false); }
  };

  const assign = async () => {
    if (!assignSel.consultant_id) return;
    try {
      await assignProjectConsultant(session, id, assignSel.consultant_id, assignSel.role as never);
      toast("Konsulenti u caktua dhe u njoftua."); setAssignOpen(false); detail.retry();
    } catch (e) { toast(e instanceof Error ? e.message : "Gabim.", "bad"); }
  };

  return (
    <div>
      <Link to="/admin/projektet" className="text-[13px] font-semibold text-mute hover:text-primary-700">← Projektet</Link>
      <div className="card p-6 mt-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display text-xl font-bold tracking-tight text-ink">{p.title}</h1>
              <Badge tone={p.status === "completed" ? "ok" : "info"}>{PROJECT_STATUS[p.status]}</Badge>
            </div>
            <p className="text-[13px] text-mute mt-1.5">{p.client_name} · {p.consultant_name} {p.collaborators.length > 1 && `(+${p.collaborators.length - 1})`} · {p.university || "—"}</p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <Select value={p.status} onChange={async (e) => { await updateProjectStatus(session, id, e.target.value as never); toast("Statusi u përditësua."); }} className="!w-52 !h-9">
              {Object.entries(PROJECT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}><IPlus size={13} /> Cakto konsulent</Button>
          </div>
        </div>
        <Progress value={p.progress} className="mt-4" />
      </div>

      <div className="mt-5 flex gap-1.5 overflow-x-auto no-scrollbar">
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={cls("px-3.5 h-9 rounded-lg text-[13px] font-bold whitespace-nowrap transition-all", tab === k ? "bg-ink text-paper" : "bg-card border border-line text-mute hover:text-ink")}>{l}</button>
        ))}
      </div>

      <div className="mt-5 anim-fade-in">
        {tab === "overview" && (
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-5">
              <p className="font-mono text-[11px] uppercase tracking-wider text-mute mb-3">Hulumtimi</p>
              <KV k="Tema" v={p.research_topic || "—"} />
              <KV k="Pyetjet" v={p.research_questions || "—"} />
              <KV k="Hipotezat" v={p.hypotheses || "—"} />
              <KV k="Niveli" v={p.study_level} />
              <KV k="Afati" v={p.deadline ? fmtDate(p.deadline) : "—"} />
              <KV k="Përditësuar" v={fmtDateTime(p.updated_at)} />
            </Card>
            <Card className="p-5">
              <p className="font-mono text-[11px] uppercase tracking-wider text-mute mb-3">Ekipi</p>
              <div className="space-y-3">
                {p.collaborators.map((c) => (
                  <div key={c.consultant_id} className="flex items-center gap-3">
                    <Avatar name={c.name} size={38} />
                    <div className="flex-1">
                      <p className="text-[13.5px] font-bold text-ink">{c.name}</p>
                      <p className="text-[11.5px] text-mute capitalize">{{ lead: "Kryesor", statistics: "Statistikë", methodology: "Metodologji", data_analyst: "Analist" }[c.role]}</p>
                    </div>
                    {c.consultant_id === p.primary_consultant_id && <Badge tone="info">Kryesor</Badge>}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
        {tab === "appointments" && (
          <Card className="p-5"><MiniAgenda list={d.appointments} onEventClick={setSel} empty="Asnjë termin i lidhur — lidhni terminet gjatë krijimit të rezervimit." /></Card>
        )}
        {tab === "files" && <Card className="p-5"><FileList files={d.files} empty="Skedarët e projektit nga klienti dhe konsulentët." /></Card>}
        {tab === "deliverables" && (
          <Card className="p-5"><FileList files={d.files.filter((f) => ["deliverable", "report", "spss_output"].includes(f.category))} empty="Dorëzimet (output SPSS, raporte) shfaqen këtu." /></Card>
        )}
        {tab === "analysis" && (
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="font-display font-bold text-ink">Fazat e analizës</p>
              <Button size="sm" variant="outline" onClick={() => setTaskModal({ name: "", status: "not_started", progress: 0, notes: "", assigned_consultant_id: null })}><IPlus size={13} /> Shto fazë</Button>
            </div>
            <div className="space-y-2">
              {d.tasks.map((t) => (
                <button key={t.id} onClick={() => setTaskModal({ id: t.id, name: t.name, status: t.status, progress: t.progress, notes: t.notes, assigned_consultant_id: t.assigned_consultant_id })}
                  className={cls("w-full text-left p-3.5 rounded-xl border transition-all hover:border-primary-300", t.status === "not_required" ? "border-line opacity-50" : "border-line bg-card")}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[13.5px] font-bold text-ink">{t.name}</p>
                    <div className="flex items-center gap-2">
                      {t.assigned_consultant_id && <span className="text-[11px] text-mute">{(consultants.data ?? []).find((c) => c.id === t.assigned_consultant_id)?.display_name ?? ""}</span>}
                      <Badge tone={TASK_STATUS[t.status].tone as never}>{TASK_STATUS[t.status].label}</Badge>
                    </div>
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
        )}
        {tab === "notes" && (
          <Card className="p-5">
            <p className="font-display font-bold text-ink mb-3.5">Shënimet interne</p>
            <div className="flex gap-2.5 mb-5">
              <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="Shtoni shënim për ekipin…" className="flex-1" />
              <Button loading={noteBusy} onClick={async () => { setNoteBusy(true); try { await addProjectNote(session, id, note); setNote(""); detail.retry(); toast("Shënimi u shtua."); } catch (e) { toast(e instanceof Error ? e.message : "Gabim.", "bad"); } finally { setNoteBusy(false); } }}>Shto</Button>
            </div>
            <div className="space-y-2.5">
              {d.activity.filter((a) => a.action === "project.note").map((n) => (
                <div key={n.id} className="flex items-start gap-3 p-3.5 rounded-xl bg-paper border border-line">
                  <Avatar name={n.actor_name} size={30} />
                  <div>
                    <p className="text-[13px] text-ink-2">{n.metadata}</p>
                    <p className="text-[11px] text-mute font-mono mt-1">{n.actor_name} · {relativeTime(n.created_at)}</p>
                  </div>
                </div>
              ))}
              {d.activity.filter((a) => a.action === "project.note").length === 0 && <p className="text-[13px] text-mute">Ende pa shënime.</p>}
            </div>
          </Card>
        )}
        {tab === "payments" && (
          <Card className="overflow-hidden">
            {d.payments.length === 0 ? <EmptyState title="Asnjë pagesë" hint="Pagesat e lidhura me këtë projekt." /> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px]">
                  <thead className="bg-paper/70"><tr><Th>Lloji</Th><Th>Shuma</Th><Th>Komisioni</Th><Th>Neto konsulentit</Th><Th>Statusi</Th><Th>Data</Th></tr></thead>
                  <tbody>
                    {d.payments.map((pay) => (
                      <tr key={pay.id}>
                        <Td><Badge tone="mute">{{ full: "E plotë", deposit: "Depozitë", balance: "Balancë" }[pay.type]}</Badge></Td>
                        <Td className="font-mono font-bold">{fmtEuro(pay.amount_gross)}</Td>
                        <Td className="font-mono text-bad">−{fmtEuro(pay.platform_fee)}</Td>
                        <Td className="font-mono text-ok">{fmtEuro(pay.consultant_net)}</Td>
                        <Td><Badge tone={pay.status === "paid" ? "ok" : pay.status === "pending" ? "warn" : "bad"}>{pay.status}</Badge></Td>
                        <Td className="font-mono text-[12px]">{fmtDate(pay.created_at.slice(0, 10))}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
        {tab === "activity" && (
          <Card className="p-5">
            <div className="space-y-2.5">
              {d.activity.map((a) => (
                <div key={a.id} className="flex items-start gap-3 text-[13px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-400 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-ink-2"><b>{a.actor_name}</b> <span className="font-mono text-[11px] text-primary-700 bg-primary-50 px-1.5 py-0.5 rounded">{a.action}</span></p>
                    {a.metadata && <p className="text-[12px] text-mute">{a.metadata}</p>}
                    <p className="text-[10.5px] text-mute font-mono">{relativeTime(a.created_at)}</p>
                  </div>
                </div>
              ))}
              {d.activity.length === 0 && <p className="text-[13px] text-mute">Ende pa aktivitet.</p>}
            </div>
          </Card>
        )}
      </div>

      <AppointmentDrawer appt={sel} onClose={() => setSel(null)} onChanged={detail.retry} />

      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Cakto konsulent në projekt">
        <div className="space-y-4">
          <Field label="Konsulenti">
            <Select value={assignSel.consultant_id} onChange={(e) => setAssignSel({ ...assignSel, consultant_id: e.target.value })}>
              <option value="">Zgjidhni…</option>
              {(consultants.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.display_name}</option>)}
            </Select>
          </Field>
          <Field label="Roli në projekt">
            <Select value={assignSel.role} onChange={(e) => setAssignSel({ ...assignSel, role: e.target.value })}>
              <option value="statistics">Konsulent statistike</option>
              <option value="methodology">Konsulent metodologjie</option>
              <option value="data_analyst">Analist i të dhënave</option>
              <option value="lead">Konsulent kryesor</option>
            </Select>
          </Field>
          {assignSel.role === "lead" && <p className="text-[12px] text-warn font-semibold bg-warn-soft rounded-lg px-3 py-2">Roli "Kryesor" ndryshon konsulentin primar të projektit.</p>}
          <Button className="w-full" onClick={assign}>Cakto</Button>
        </div>
      </Modal>

      <Modal open={!!taskModal} onClose={() => setTaskModal(null)} title={taskModal?.id ? "Redakto fazën" : "Shto fazë analize"}>
        {taskModal && (
          <div className="space-y-4">
            {!taskModal.id && (
              <Field label="Faza"><TextInput value={taskModal.name} onChange={(e) => setTaskModal({ ...taskModal, name: e.target.value })} placeholder="p.sh. Regression" /></Field>
            )}
            <Field label="Statusi">
              <Select value={taskModal.status} onChange={(e) => setTaskModal({ ...taskModal, status: e.target.value })}>
                {Object.entries(TASK_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </Select>
            </Field>
            {taskModal.status === "in_progress" || taskModal.status === "waiting" ? (
              <Field label={`Progresi: ${taskModal.progress}%`}>
                <input type="range" min={0} max={100} step={5} value={taskModal.progress} onChange={(e) => setTaskModal({ ...taskModal, progress: +e.target.value })} className="w-full accent-[#1b44cc]" />
              </Field>
            ) : null}
            <Field label="Caktuar te">
              <Select value={taskModal.assigned_consultant_id ?? ""} onChange={(e) => setTaskModal({ ...taskModal, assigned_consultant_id: e.target.value || null })}>
                <option value="">Pa caktim</option>
                {p.collaborators.map((c) => <option key={c.consultant_id} value={c.consultant_id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Shënime"><TextArea value={taskModal.notes} onChange={(e) => setTaskModal({ ...taskModal, notes: e.target.value })} /></Field>
            <Button className="w-full" loading={tBusy} disabled={!taskModal.id && !taskModal.name} onClick={saveT}>Ruaj</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Clients ──────────────────────────────────────────────────────────────────
export function AdminClients() {
  const { session } = useApp();
  const [q, setQ] = useState("");
  const clients = useAsync(() => listClientsAdmin(session), [session?.user_id]);
  const list = (clients.data ?? []).filter((c) => !q || c.full_name.toLowerCase().includes(q.toLowerCase()) || c.email.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Klientët <span className="text-mute text-base font-sans font-medium">({list.length})</span></h1>
        <div className="w-64"><SearchInput value={q} onChange={setQ} placeholder="Emër ose email…" /></div>
      </div>
      {clients.error && <ErrorState message={clients.error} onRetry={clients.retry} />}
      <Card className="overflow-hidden">
        {clients.loading ? <div className="p-5"><TableSkeleton rows={7} /></div> : list.length === 0
          ? <EmptyState icon={<IUsers size={22} />} title="Asnjë klient" />
          : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="bg-paper/70"><tr><Th>Klienti</Th><Th>Rezervime</Th><Th>Shpenzuar</Th><Th>Projekte aktive</Th><Th>Rezervimi i fundit</Th><Th>Regjistruar</Th></tr></thead>
                <tbody>
                  {list.map((c) => (
                    <tr key={c.id} className="hover:bg-paper/50 transition-colors">
                      <Td><div className="flex items-center gap-2.5"><Avatar name={c.full_name} size={34} /><div><p className="font-bold text-ink">{c.full_name}</p><p className="text-[11.5px] text-mute">{c.email}</p></div></div></Td>
                      <Td className="font-mono">{c.bookings}</Td>
                      <Td className="font-mono font-bold text-primary-700">{fmtEuro(c.spent)}</Td>
                      <Td className="font-mono">{c.active_projects}</Td>
                      <Td className="font-mono text-[12.5px]">{c.last_booking ? fmtDate(c.last_booking) : "—"}</Td>
                      <Td className="font-mono text-[12.5px]">{fmtDate(c.created_at.slice(0, 10))}</Td>
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

// ─── Consultants management ──────────────────────────────────────────────────
export function AdminConsultants() {
  const { session, toast } = useApp();
  const consultants = useAsync(() => listConsultantsAdmin(session), [session?.user_id]);
  const services = useAsync(() => listAllServicesAdmin(session), [session?.user_id]);
  const [edit, setEdit] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [f, setF] = useState<Record<string, unknown>>({});
  const [svcRows, setSvcRows] = useState<{ service_id: string; price: number; duration_minutes: number; is_active: boolean }[]>([]);
  const [busy, setBusy] = useState(false);
  const [newC, setNewC] = useState({ display_name: "", professional_title: "", email: "", commission_percentage: 20 });

  const current = (consultants.data ?? []).find((c) => c.id === edit);

  const openEdit = (c: (typeof consultants.data extends (infer T)[] | null ? T : never)) => {
    setEdit(c.id);
    setF({
      display_name: c.display_name, professional_title: c.professional_title, bio: c.bio,
      years_experience: c.years_experience, commission_percentage: c.commission_percentage,
      status: c.status, is_active: c.is_active, is_featured: c.is_featured,
      specializations: c.specializations.join(", "),
      languages: c.languages.join(", "),
    });
    setSvcRows([]);
    // load the consultant's actual offer rows, merged with the full service catalogue
    getConsultantServiceRows(session, c.id).then((rows) => {
      const merged = (services.data ?? []).map((s) => {
        const r = rows.find((x) => x.service_id === s.id);
        return { service_id: s.id, price: Number(r?.price ?? s.default_price), duration_minutes: Number(r?.duration_minutes ?? s.default_duration_minutes), is_active: r?.is_active ?? false };
      });
      setSvcRows(merged);
    });
  };

  const save = async () => {
    if (!edit) return;
    setBusy(true);
    try {
      await saveConsultantAdmin(session, {
        id: edit,
        display_name: f.display_name as string,
        professional_title: f.professional_title as string,
        bio: f.bio as string,
        years_experience: +(f.years_experience as number),
        commission_percentage: +(f.commission_percentage as number),
        status: f.status as never,
        is_active: f.is_active as boolean,
        is_featured: f.is_featured as boolean,
        specializations: (f.specializations as string).split(",").map((s) => s.trim()).filter(Boolean),
        languages: (f.languages as string).split(",").map((s) => s.trim()).filter(Boolean),
      });
      await saveConsultantServicesAdmin(session, edit, svcRows.filter((r) => r.is_active || r.price > 0));
      toast("Konsulenti u ruajt.");
      setEdit(null);
    } catch (e) { toast(e instanceof Error ? e.message : "Gabim.", "bad"); } finally { setBusy(false); }
  };

  const create = async () => {
    if (!newC.display_name || !newC.email) { toast("Emri dhe email janë të detyrueshëm.", "bad"); return; }
    setBusy(true);
    try {
      await saveConsultantAdmin(session, {
        display_name: newC.display_name, professional_title: newC.professional_title,
        email: newC.email, commission_percentage: newC.commission_percentage,
        status: "active", is_active: true, bio: "", education: [], certifications: [],
        years_experience: 0, languages: ["sq"], specializations: [],
      } as never);
      toast("Konsulenti u krijua me llogari hyrjeje (demo123).");
      setCreateOpen(false);
      setNewC({ display_name: "", professional_title: "", email: "", commission_percentage: 20 });
    } catch (e) { toast(e instanceof Error ? e.message : "Gabim.", "bad"); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Konsulentët</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}><IPlus size={14} /> Konsulent i ri</Button>
      </div>
      {consultants.error && <ErrorState message={consultants.error} onRetry={consultants.retry} />}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
        {(consultants.data ?? []).map((c) => (
          <Card key={c.id} className="p-5 hover:shadow-soft transition-all">
            <div className="flex items-start gap-3.5">
              <Avatar name={c.display_name} size={52} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-display font-bold text-ink truncate">{c.display_name}</p>
                  {c.is_featured && <Badge tone="warn">I veçuar</Badge>}
                </div>
                <p className="text-[12px] text-mute truncate">{c.professional_title}</p>
                <div className="flex items-center gap-1.5 mt-1"><Stars value={c.rating} size={11} /><span className="text-[11px] text-mute font-semibold">{c.rating.toFixed(1)} ({c.review_count})</span></div>
              </div>
              <Badge tone={c.status === "active" ? (c.is_active ? "ok" : "warn") : c.status === "pending" ? "warn" : "bad"}>
                {c.status === "active" ? (c.is_active ? "Aktiv" : "Fshehur") : { pending: "Në pritje", suspended: "Pezulluar", inactive: "Joaktiv" }[c.status]}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              <div className="bg-paper rounded-lg py-2"><p className="font-display font-bold text-ink text-[15px]">{c.bookings_total}</p><p className="text-[10px] text-mute">konsulta</p></div>
              <div className="bg-paper rounded-lg py-2"><p className="font-display font-bold text-ink text-[15px]">{fmtEuro(c.revenue)}</p><p className="text-[10px] text-mute">neto</p></div>
              <div className="bg-paper rounded-lg py-2"><p className="font-display font-bold text-ink text-[15px]">{c.commission_percentage}%</p><p className="text-[10px] text-mute">komision</p></div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => openEdit(c)}>Redakto</Button>
              <Button variant={c.is_active ? "ghost" : "secondary"} size="sm" onClick={async () => {
                await saveConsultantAdmin(session, { id: c.id, display_name: c.display_name, professional_title: c.professional_title, is_active: !c.is_active });
                toast(c.is_active ? "U fsheh nga drejtoria." : "U aktivizua në direktori.");
              }}>{c.is_active ? "Fshih" : "Aktivizo"}</Button>
            </div>
          </Card>
        ))}
      </div>

      <Drawer open={!!edit && !!current} onClose={() => setEdit(null)} title={current ? `Redakto: ${current.display_name}` : ""} width={560}>
        {current && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3.5">
              <Field label="Emri"><TextInput value={(f.display_name as string) ?? ""} onChange={(e) => setF({ ...f, display_name: e.target.value })} /></Field>
              <Field label="Titulli"><TextInput value={(f.professional_title as string) ?? ""} onChange={(e) => setF({ ...f, professional_title: e.target.value })} /></Field>
            </div>
            <Field label="Biografia"><TextArea value={(f.bio as string) ?? ""} onChange={(e) => setF({ ...f, bio: e.target.value })} className="min-h-[110px]" /></Field>
            <div className="grid grid-cols-3 gap-3.5">
              <Field label="Përvoja (vite)"><TextInput type="number" value={String(f.years_experience ?? 0)} onChange={(e) => setF({ ...f, years_experience: +e.target.value })} /></Field>
              <Field label="Komisioni %"><TextInput type="number" value={String(f.commission_percentage ?? 20)} onChange={(e) => setF({ ...f, commission_percentage: +e.target.value })} /></Field>
              <Field label="Statusi">
                <Select value={(f.status as string) ?? "active"} onChange={(e) => setF({ ...f, status: e.target.value })}>
                  <option value="active">Aktiv</option><option value="pending">Në pritje</option><option value="suspended">Pezulluar</option><option value="inactive">Joaktiv</option>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <Field label="Specializimet (me presje)" hint={Object.keys(SPECIALIZATIONS).join(", ")}><TextArea value={(f.specializations as string) ?? ""} onChange={(e) => setF({ ...f, specializations: e.target.value })} className="min-h-[64px] font-mono !text-[12px]" /></Field>
              <Field label="Gjuhët (kodes)"><TextInput value={(f.languages as string) ?? ""} onChange={(e) => setF({ ...f, languages: e.target.value })} className="font-mono" /></Field>
            </div>
            <Toggle checked={!!f.is_featured} onChange={(v) => setF({ ...f, is_featured: v })} label="Konsulent i veçuar (shfaqet i pari)" />

            <div>
              <p className="font-display font-bold text-ink mb-2.5">Shërbimet & çmimet</p>
              <div className="space-y-2">
                {svcRows.map((r, i) => {
                  const svc = (services.data ?? []).find((s) => s.id === r.service_id);
                  return (
                    <div key={r.service_id} className={cls("flex items-center gap-2.5 p-2.5 rounded-xl border transition-all", r.is_active ? "border-primary-200 bg-primary-50/40" : "border-line")}>
                      <input type="checkbox" checked={r.is_active} onChange={(e) => setSvcRows(svcRows.map((x, xi) => xi === i ? { ...x, is_active: e.target.checked } : x))} className="w-4 h-4 accent-[#1b44cc]" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-bold text-ink truncate">{svc?.name}</p>
                        <p className="text-[10.5px] text-mute">{SERVICE_CATEGORY[svc?.category ?? ""]}</p>
                      </div>
                      <input type="number" value={r.price} onChange={(e) => setSvcRows(svcRows.map((x, xi) => xi === i ? { ...x, price: +e.target.value } : x))} className="w-16 h-8 px-2 rounded-lg border border-line-2 text-[12px] font-mono" title="Çmimi €" />
                      <input type="number" value={r.duration_minutes} onChange={(e) => setSvcRows(svcRows.map((x, xi) => xi === i ? { ...x, duration_minutes: +e.target.value } : x))} className="w-16 h-8 px-2 rounded-lg border border-line-2 text-[12px] font-mono" title="Minuta" />
                    </div>
                  );
                })}
              </div>
            </div>
            <Button className="w-full" size="lg" loading={busy} onClick={save}>Ruaj ndryshimet</Button>
          </div>
        )}
      </Drawer>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Konsulent i ri">
        <div className="space-y-4">
          <Field label="Emri i plotë" required><TextInput value={newC.display_name} onChange={(e) => setNewC({ ...newC, display_name: e.target.value })} /></Field>
          <Field label="Titulli profesional"><TextInput value={newC.professional_title} onChange={(e) => setNewC({ ...newC, professional_title: e.target.value })} /></Field>
          <Field label="Email" required hint="Krijohet llogari me fjalëkalim demo123."><TextInput type="email" value={newC.email} onChange={(e) => setNewC({ ...newC, email: e.target.value })} /></Field>
          <Field label="Komisioni %"><TextInput type="number" value={newC.commission_percentage} onChange={(e) => setNewC({ ...newC, commission_percentage: +e.target.value })} /></Field>
          <Button className="w-full" loading={busy} onClick={create}>Krijo konsulentin</Button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Services management ─────────────────────────────────────────────────────
export function AdminServices() {
  const { session, toast } = useApp();
  const services = useAsync(() => listAllServicesAdmin(session), [session?.user_id]);
  const [modal, setModal] = useState<null | { id?: string }>({});
  const [f, setF] = useState({ name: "", short_description: "", description: "", category: "consultation", default_duration_minutes: 60, default_price: 50, payment_policy: "full", deposit_amount: 0, is_active: true });
  const [busy, setBusy] = useState(false);

  const openEdit = (s: { id: string; name: string; short_description: string; description: string; category: string; default_duration_minutes: number; default_price: number; payment_policy: string; deposit_amount: number; is_active: boolean }) => {
    setModal({ id: s.id });
    setF({ name: s.name, short_description: s.short_description, description: s.description, category: s.category, default_duration_minutes: s.default_duration_minutes, default_price: s.default_price, payment_policy: s.payment_policy, deposit_amount: s.deposit_amount, is_active: s.is_active });
  };

  const save = async () => {
    if (!f.name) { toast("Emri është i detyrueshëm.", "bad"); return; }
    setBusy(true);
    try {
      await saveServiceAdmin(session, { id: modal?.id, ...f, payment_policy: f.payment_policy as never });
      toast(modal?.id ? "Shërbimi u përditësua." : "Shërbimi u krijua.");
      setModal(null);
    } catch (e) { toast(e instanceof Error ? e.message : "Gabim.", "bad"); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Shërbimet</h1>
        <Button size="sm" onClick={() => { setModal({}); setF({ name: "", short_description: "", description: "", category: "consultation", default_duration_minutes: 60, default_price: 50, payment_policy: "full", deposit_amount: 0, is_active: true }); }}><IPlus size={14} /> Shërbim i ri</Button>
      </div>
      {services.error && <ErrorState message={services.error} onRetry={services.retry} />}
      <Card className="overflow-hidden">
        {services.loading ? <div className="p-5"><TableSkeleton rows={7} /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead className="bg-paper/70"><tr><Th>Shërbimi</Th><Th>Kategoria</Th><Th>Zgjatja</Th><Th>Çmimi</Th><Th>Politika</Th><Th>Statusi</Th><Th /></tr></thead>
              <tbody>
                {(services.data ?? []).map((s) => (
                  <tr key={s.id} className={cls("hover:bg-paper/50 transition-colors", !s.is_active && "opacity-55")}>
                    <Td><p className="font-bold text-ink">{s.name}</p><p className="text-[11px] text-mute max-w-[260px] truncate">{s.short_description}</p></Td>
                    <Td><Badge tone="info">{SERVICE_CATEGORY[s.category] ?? s.category}</Badge></Td>
                    <Td className="font-mono">{fmtDuration(s.default_duration_minutes)}</Td>
                    <Td className="font-mono font-bold">{fmtEuro(s.default_price)}</Td>
                    <Td><Badge tone={s.payment_policy === "deposit" ? "teal" : s.payment_policy === "free_booking" ? "warn" : "mute"}>{s.payment_policy === "deposit" ? `Depozitë ${fmtEuro(s.deposit_amount)}` : s.payment_policy === "free_booking" ? "Më vonë" : "E plotë"}</Badge></Td>
                    <Td><Toggle checked={s.is_active} onChange={async () => { await saveServiceAdmin(session, { id: s.id, name: s.name, is_active: !s.is_active }); toast(s.is_active ? "U çaktivizua." : "U aktivizua."); }} /></Td>
                    <Td><Button variant="outline" size="sm" onClick={() => openEdit(s)}>Redakto</Button></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? "Redakto shërbimin" : "Shërbim i ri"} wide>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Emri" required className="sm:col-span-2"><TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Përshkrim i shkurtër" className="sm:col-span-2"><TextInput value={f.short_description} onChange={(e) => setF({ ...f, short_description: e.target.value })} /></Field>
          <Field label="Përshkrimi i plotë" className="sm:col-span-2"><TextArea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Field label="Kategoria">
            <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              {Object.entries(SERVICE_CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="Zgjatja (minuta)"><TextInput type="number" value={f.default_duration_minutes} onChange={(e) => setF({ ...f, default_duration_minutes: +e.target.value })} /></Field>
          <Field label="Çmimi (€)"><TextInput type="number" value={f.default_price} onChange={(e) => setF({ ...f, default_price: +e.target.value })} /></Field>
          <Field label="Politika e pagesës">
            <Select value={f.payment_policy} onChange={(e) => setF({ ...f, payment_policy: e.target.value })}>
              <option value="full">Pagesë e plotë</option>
              <option value="deposit">Me depozitë</option>
              <option value="free_booking">Rezervim pa pagesë</option>
            </Select>
          </Field>
          {f.payment_policy === "deposit" && (
            <Field label="Depozita (€)"><TextInput type="number" value={f.deposit_amount} onChange={(e) => setF({ ...f, deposit_amount: +e.target.value })} /></Field>
          )}
          <div className="flex items-end pb-1"><Toggle checked={f.is_active} onChange={(v) => setF({ ...f, is_active: v })} label="Aktiv në platformë" /></div>
        </div>
        <Button className="w-full mt-5" loading={busy} onClick={save}>Ruaj shërbimin</Button>
      </Modal>
    </div>
  );
}

// ─── Applications ─────────────────────────────────────────────────────────────
export function AdminApplications() {
  const { session, toast } = useApp();
  const apps = useAsync(() => listApplications(session), [session?.user_id]);
  const [view, setView] = useState<(typeof apps.data extends (infer T)[] | null ? T : never) | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const setStatus = async (id: string, status: "under_review" | "approved" | "rejected") => {
    setBusyId(id);
    try {
      await setApplicationStatus(session, id, status);
      if (status === "approved") toast("Aplikimi u aprovua — konsulenti u aktivizua dhe u shfaq në direktori.");
      else if (status === "rejected") toast("Aplikimi u refuzua dhe aplikanti u njoftua.");
      else toast("Statusi u përditësua.");
      setView(null);
    } catch (e) { toast(e instanceof Error ? e.message : "Gabim.", "bad"); } finally { setBusyId(null); }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink mb-5">Aplikimet e konsulentëve</h1>
      {apps.error && <ErrorState message={apps.error} onRetry={apps.retry} />}
      {!apps.loading && (apps.data ?? []).length === 0 && <Card><EmptyState icon={<IBriefcase size={22} />} title="Asnjë aplikim" hint="Aplikimet e reja nga faqja e regjistrimit dhe /behu-konsulent shfaqen këtu." /></Card>}
      <div className="space-y-4 stagger">
        {(apps.data ?? []).map((a) => (
          <Card key={a.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3.5 min-w-0">
                <Avatar name={a.name} size={46} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-display font-bold text-ink">{a.name}</p>
                    <Badge tone={APPLICATION_STATUS[a.status].tone as never}>{APPLICATION_STATUS[a.status].label}</Badge>
                    {a.applicant_id
                      ? <Badge tone="teal">Ka llogari</Badge>
                      : <Badge tone="mute">Pa llogari</Badge>}
                  </div>
                  <p className="text-[12.5px] text-mute mt-0.5">{a.email} · {a.country || "—"} · {fmtDate(a.created_at.slice(0, 10))}</p>
                  <p className="text-[12.5px] text-ink-2 mt-1.5 max-w-2xl">{a.professional_title || a.education}</p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => setView(a)}>Shiko aplikimin</Button>
                {(a.status === "submitted" || a.status === "under_review") && (
                  <>
                    {a.status === "submitted" && <Button variant="ghost" size="sm" loading={busyId === a.id} onClick={() => setStatus(a.id, "under_review")}>Në shqyrtim</Button>}
                    <Button size="sm" className="!bg-ok hover:!bg-[#126b3d]" loading={busyId === a.id} onClick={() => setStatus(a.id, "approved")}><ICheck size={13} /> Aprovo</Button>
                    <Button variant="danger" size="sm" loading={busyId === a.id} onClick={() => setStatus(a.id, "rejected")}><IX size={13} /> Refuzo</Button>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3.5">
              {a.specializations.slice(0, 6).map((s) => <span key={s} className="text-[11px] font-semibold bg-primary-50 text-primary-800 rounded-md px-2 py-1">{SPEC_LABEL[s] ?? s}</span>)}
              {a.specializations.length > 6 && <span className="text-[11px] font-semibold text-mute px-1 py-1">+{a.specializations.length - 6}</span>}
              {a.languages.map((l) => <span key={l} className="text-[11px] font-semibold bg-paper border border-line rounded-md px-2 py-1">{LANGUAGES[l] ?? l}</span>)}
            </div>
          </Card>
        ))}
      </div>

      <Drawer open={!!view} onClose={() => setView(null)} title={view ? `Aplikimi — ${view.name}` : ""} width={600}>
        {view && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge tone={APPLICATION_STATUS[view.status].tone as never}>{APPLICATION_STATUS[view.status].label}</Badge>
              {view.applicant_id ? <Badge tone="teal">Llogari e lidhur</Badge> : <Badge tone="warn">Pa llogari — aprovimi kërkon regjistrim</Badge>}
              <span className="text-[12px] text-mute font-mono">{fmtDateTime(view.created_at)}</span>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-mute mb-2">Personale</p>
              <KV k="Email" v={view.email} />
              <KV k="Telefoni" v={view.phone || "—"} />
              <KV k="Shteti" v={view.country || "—"} />
              {view.linkedin && <KV k="LinkedIn" v={view.linkedin} />}
              <KV k="CV" v={view.cv_file || "—"} />
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-mute mb-2">Profesionale</p>
              <KV k="Titulli" v={view.professional_title || "—"} />
              <KV k="Edukimi" v={view.education || "—"} />
              <KV k="Vitet e përvojës" v={String(view.years_experience || 0)} />
              <KV k="Përvoja me SPSS" v={view.spss_experience || "—"} />
              <KV k="Përvoja në metodologji" v={view.methodology_experience || "—"} />
            </div>
            {view.bio && (
              <div>
                <p className="font-mono text-[11px] uppercase tracking-wider text-mute mb-2">Biografia</p>
                <p className="text-[13.5px] text-ink-2 leading-relaxed">{view.bio}</p>
              </div>
            )}
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-mute mb-2">Specializimet</p>
              <div className="flex flex-wrap gap-1.5">
                {view.specializations.map((s) => <span key={s} className="text-[11.5px] font-semibold bg-primary-50 text-primary-800 rounded-md px-2 py-1">{SPEC_LABEL[s] ?? s}</span>)}
              </div>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-mute mb-2">Gjuhët</p>
              <div className="flex flex-wrap gap-1.5">
                {view.languages.map((l) => <span key={l} className="text-[11.5px] font-semibold bg-paper border border-line rounded-md px-2 py-1">{LANGUAGES[l] ?? l}</span>)}
              </div>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-mute mb-2">Motivimi</p>
              <p className="text-[13.5px] text-ink-2 italic leading-relaxed">“{view.motivation || "—"}”</p>
            </div>
            {(view.status === "submitted" || view.status === "under_review") && (
              <div className="border-t border-line pt-4 space-y-3">
                <p className="text-[12.5px] text-mute">Aprovimi aktivizon profilin e konsulentit, krijon faqen publike në direktori dhe i jep akses në Portalin e Konsulentit — gjithçka përmes një operacioni të vetëm të sigurt në bazën e të dhënave.</p>
                <div className="flex gap-2">
                  {view.status === "submitted" && <Button variant="outline" className="flex-1" loading={busyId === view.id} onClick={() => setStatus(view.id, "under_review")}>Në shqyrtim</Button>}
                  <Button className="flex-1 !bg-ok hover:!bg-[#126b3d]" loading={busyId === view.id} onClick={() => setStatus(view.id, "approved")}><ICheck size={14} /> Aprovo</Button>
                  <Button variant="danger" className="flex-1" loading={busyId === view.id} onClick={() => setStatus(view.id, "rejected")}><IX size={14} /> Refuzo</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}

// ─── Waitlist ─────────────────────────────────────────────────────────────────
export function AdminWaitlist() {
  const { session, toast } = useApp();
  const wl = useAsync(() => listWaitlist(session), [session?.user_id]);
  const label = { waiting: "Në pritje", notified: "I njoftuar", booked: "Rezervoi", expired: "Skadoi" };
  const tone = { waiting: "warn", notified: "teal", booked: "ok", expired: "mute" } as const;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink mb-5">Lista e pritjes</h1>
      {wl.error && <ErrorState message={wl.error} onRetry={wl.retry} />}
      {!wl.loading && (wl.data ?? []).length === 0 && <Card><EmptyState icon={<IQueue size={22} />} title="Lista bosh" hint="Kur nuk ka termine të lira, klientët mund të regjistrohen këtu." /></Card>}
      <div className="space-y-3 stagger">
        {(wl.data ?? []).map((w) => (
          <Card key={w.id} className={cls("p-4 flex flex-col sm:flex-row sm:items-center gap-3", w.has_match && "!border-[#e5d3a3] !bg-warn-soft/40")}>
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <Avatar name={w.name} size={42} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-ink">{w.name}</p>
                  <Badge tone={tone[w.status]}>{label[w.status]}</Badge>
                  {w.has_match && <Badge tone="warn"><IWarn size={11} /> Ka përputhje me anulim të fundit</Badge>}
                </div>
                <p className="text-[12.5px] text-mute truncate">{w.email} · {w.phone}</p>
                <p className="text-[12.5px] text-ink-2 mt-0.5">
                  <b>{w.service_name}</b> · {w.consultant_name} · preferon: {w.preferred_dates || "—"} ({w.preferred_time}) · {relativeTime(w.created_at)}
                </p>
              </div>
            </div>
            {w.status === "waiting" && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={async () => { await setWaitlistStatus(session, w.id, "notified"); toast("U shënua si i njoftuar (email u dërgua)."); }}>Njofto</Button>
                <Button size="sm" onClick={async () => { await setWaitlistStatus(session, w.id, "booked"); toast("U shënua si i rezervuar."); }}>Rezervoi</Button>
                <Button size="sm" variant="ghost" onClick={async () => { await setWaitlistStatus(session, w.id, "expired"); }}>Skado</Button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
