import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp, useAsync } from "../lib/store";
import {
  listAppointments, getSettings, updateSettings, listActivity,
  type AppointmentRow,
} from "../lib/services";
import { resetDB as doReset } from "../lib/db";
import { APPT_STATUS } from "../lib/i18n";
import { fmtDate, fmtDateTime, fmtEuro, relativeTime, todayISO, addDaysISO, cls } from "../lib/utils";
import {
  Avatar, Badge, Button, Card, EmptyState, ErrorState, Field, Modal, Pagination,
  SearchInput, Select, Skeleton, TableSkeleton, Td, TextInput, Th,
} from "../components/ui";
import { PortalShell, type NavItem } from "../components/layout";
import { PlannerCalendar, StatusLegend, type PlannerView } from "../components/calendar";
import { AppointmentDrawer } from "./ConsultantPortal";
import { IGrid, ICal, IClock, IFolder, IUsers, IFile, IEuro, IInvoice, IScatter, IStar, IQueue, IActivity, ISettings, IUser, ISpark, ITrend, IBell2, IWarn, IRefresh, IBriefcase } from "../components/icons";

const NAV: NavItem[] = [
  { to: "/admin", label: "Paneli", icon: <IGrid size={16} />, end: true },
  { to: "/admin/kalendari", label: "Kalendari", icon: <ICal size={16} /> },
  { to: "/admin/terminet", label: "Terminet", icon: <IClock size={16} /> },
  { to: "/admin/projektet", label: "Projektet", icon: <IFolder size={16} /> },
  { to: "/admin/klientet", label: "Klientët", icon: <IUsers size={16} /> },
  { to: "/admin/konsulentet", label: "Konsulentët", icon: <IUser size={16} /> },
  { to: "/admin/aplikimet", label: "Aplikimet", icon: <IBriefcase size={16} /> },
  { to: "/admin/sherbimet", label: "Shërbimet", icon: <ISpark size={16} /> },
  { to: "/admin/dokumentet", label: "Dokumentet", icon: <IFile size={16} /> },
  { to: "/admin/pagesat", label: "Pagesat", icon: <IEuro size={16} /> },
  { to: "/admin/faturat", label: "Faturat", icon: <IInvoice size={16} /> },
  { to: "/admin/analitika", label: "Analitika", icon: <ITrend size={16} /> },
  { to: "/admin/vleresimet", label: "Vlerësimet", icon: <IStar size={16} /> },
  { to: "/admin/lista-pritjes", label: "Lista e pritjes", icon: <IQueue size={16} /> },
  { to: "/admin/aktiviteti", label: "Activity Log", icon: <IActivity size={16} /> },
  { to: "/admin/cilesimet", label: "Cilësimet", icon: <ISettings size={16} /> },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  return <PortalShell nav={NAV} title="Administrimi">{children}</PortalShell>;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export function AdminDashboard() {
  const { session } = useApp();
  const appts = useAsync(() => listAppointments(session), [session?.user_id]);
  const [sel, setSel] = useState<AppointmentRow | null>(null);

  const stats = useMemo(() => {
    const all = (appts.data ?? []).filter((a) => a.status !== "rescheduled");
    const t = todayISO();
    const weekEnd = addDaysISO(t, 7);
    const monthStart = t.slice(0, 8) + "01";
    const monthEnd = t.slice(0, 8) + "31";
    return {
      today: all.filter((a) => a.date === t && ["confirmed", "pending"].includes(a.status)).length,
      week: all.filter((a) => a.date >= t && a.date <= weekEnd && ["confirmed", "pending"].includes(a.status)).length,
      month: all.filter((a) => a.date >= monthStart && a.date <= monthEnd).length,
      pending: all.filter((a) => a.status === "pending").length,
      confirmed: all.filter((a) => a.status === "confirmed").length,
      completed: all.filter((a) => a.status === "completed").length,
    };
  }, [appts.data]);

  const upcoming = (appts.data ?? []).filter((a) => ["confirmed", "pending"].includes(a.status) && a.date >= todayISO()).slice(0, 6);

  const cards: [string, string | number, string][] = appts.loading ? [] : [
    ["Sot", stats.today, "termine"],
    ["Këtë javë", stats.week, "termine"],
    ["Këtë muaj", stats.month, "termine"],
    ["Në pritje", stats.pending, "kërkojnë konfirmim"],
    ["Të konfirmuar", stats.confirmed, "aktivë"],
    ["Të përfunduar", stats.completed, "gjithsej"],
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Paneli administrativ</h1>
          <p className="text-mute text-sm mt-1">Pasqyra operative e platformës në kohë reale.</p>
        </div>
        <Link to="/admin/analitika"><Button variant="outline" size="sm"><ITrend size={14} /> Analitika</Button></Link>
      </div>

      {appts.loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 stagger">
          {cards.map(([l, v, s]) => (
            <Card key={l} className="p-4">
              <p className="text-[10.5px] font-mono uppercase tracking-wider text-mute">{l}</p>
              <p className={cls("font-display font-bold text-2xl mt-1.5", l === "Në pritje" && Number(v) > 0 ? "text-warn" : "text-ink")}>{v}</p>
              <p className="text-[10.5px] text-mute">{s}</p>
            </Card>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-ink">Terminet e ardhshme</h2>
            <Link to="/admin/kalendari" className="text-[12.5px] font-bold text-primary-700">Kalendari →</Link>
          </div>
          {appts.error ? <ErrorState message={appts.error} onRetry={appts.retry} /> : appts.loading ? <TableSkeleton rows={5} /> : (
            <div className="space-y-2">
              {upcoming.map((a) => (
                <button key={a.id} onClick={() => setSel(a)} className="w-full flex items-center gap-3 p-3 rounded-xl border border-line hover:border-primary-300 hover:shadow-soft transition-all text-left">
                  <div className="w-12 text-center shrink-0">
                    <p className="font-mono text-[13px] font-bold text-primary-700">{a.start_time}</p>
                    <p className="text-[10.5px] text-mute">{fmtDate(a.date)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-bold text-ink truncate">{a.service_name} — {a.client_name}</p>
                    <p className="text-xs text-mute truncate">{a.consultant_name} · {a.reference}</p>
                  </div>
                  <Badge tone={APPT_STATUS[a.status].tone}>{APPT_STATUS[a.status].label}</Badge>
                </button>
              ))}
              {upcoming.length === 0 && <EmptyState icon={<ICal size={20} />} title="Asnjë termin i ardhshëm" />}
            </div>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="font-display font-bold text-ink mb-4">Statuset</h2>
          {appts.loading ? <TableSkeleton rows={4} /> : (
            <div className="space-y-3">
              {Object.entries(APPT_STATUS).map(([k, v]) => {
                const count = (appts.data ?? []).filter((a) => a.status === k).length;
                const max = Math.max(1, ...(appts.data ?? []).length ? Object.values(APPT_STATUS).map((_, i) => i) : [1]);
                return (
                  <div key={k}>
                    <div className="flex items-center justify-between mb-1">
                      <Badge tone={v.tone}>{v.label}</Badge>
                      <span className="font-mono text-[12px] font-bold text-ink">{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#e7ebf3]">
                      <div className={cls("h-full rounded-full transition-all duration-700",
                        v.tone === "ok" ? "bg-ok" : v.tone === "warn" ? "bg-amber" : v.tone === "bad" ? "bg-bad" : v.tone === "teal" ? "bg-teal" : v.tone === "info" ? "bg-primary-500" : "bg-[#9aa7bf]")}
                        style={{ width: `${(count / Math.max(1, (appts.data ?? []).length)) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
      <AppointmentDrawer appt={sel} onClose={() => setSel(null)} onChanged={appts.retry} />
    </div>
  );
}

// ─── Calendar page ────────────────────────────────────────────────────────────
export function AdminCalendar() {
  const { session } = useApp();
  const [view, setView] = useState<PlannerView>("week");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<AppointmentRow | null>(null);
  const appts = useAsync(() => listAppointments(session, { status, search: q }), [session?.user_id, status, q]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Kalendari</h1>
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="w-56"><SearchInput value={q} onChange={setQ} placeholder="Kërko termin…" /></div>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="!w-44">
            <option value="all">Të gjitha statuset</option>
            {Object.entries(APPT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
        </div>
      </div>
      {appts.error ? <ErrorState message={appts.error} onRetry={appts.retry} /> : (
        <>
          <PlannerCalendar appointments={appts.data ?? []} view={view} onViewChange={setView} onEventClick={setSel} />
          <div className="mt-4"><StatusLegend /></div>
        </>
      )}
      <AppointmentDrawer appt={sel} onClose={() => setSel(null)} onChanged={appts.retry} />
    </div>
  );
}

// ─── Appointments table ───────────────────────────────────────────────────────
export function AdminAppointments() {
  const { session } = useApp();
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const PER = 10;
  const appts = useAsync(() => listAppointments(session, { status, search: q }), [session?.user_id, status, q]);
  const [sel, setSel] = useState<AppointmentRow | null>(null);

  const rows = appts.data ?? [];
  const pages = Math.ceil(rows.length / PER);
  const slice = rows.slice((page - 1) * PER, page * PER);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Terminet <span className="text-mute text-base font-sans font-medium">({rows.length})</span></h1>
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="w-60"><SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Klient, referencë, shërbim…" /></div>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="!w-44">
            <option value="all">Të gjitha</option>
            {Object.entries(APPT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
        </div>
      </div>
      {appts.error && <ErrorState message={appts.error} onRetry={appts.retry} />}
      <Card className="overflow-hidden">
        {appts.loading ? <div className="p-5"><TableSkeleton rows={8} /></div> : slice.length === 0
          ? <EmptyState icon={<ICal size={22} />} title="Asnjë termin" hint="Ndryshoni filtrat ose prisni rezervime të reja." />
          : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px]">
                <thead className="bg-paper/70"><tr><Th>Referenca</Th><Th>Klienti</Th><Th>Konsulenti</Th><Th>Shërbimi</Th><Th>Data</Th><Th>Çmimi</Th><Th>Statusi</Th><Th /></tr></thead>
                <tbody>
                  {slice.map((a) => (
                    <tr key={a.id} className="hover:bg-paper/50 transition-colors">
                      <Td className="font-mono text-[12px] text-primary-700 font-bold">{a.reference}</Td>
                      <Td><p className="font-bold text-ink">{a.client_name}</p><p className="text-[11px] text-mute">{a.client_email}</p></Td>
                      <Td className="text-[13px] font-semibold">{a.consultant_name}</Td>
                      <Td className="text-[13px]">{a.service_name}</Td>
                      <Td className="font-mono text-[12.5px]">{fmtDate(a.date)} {a.start_time}</Td>
                      <Td className="font-mono font-bold">{fmtEuro(a.price)}</Td>
                      <Td><Badge tone={APPT_STATUS[a.status].tone}>{APPT_STATUS[a.status].label}</Badge></Td>
                      <Td><Button variant="outline" size="sm" onClick={() => setSel(a)}>Hap</Button></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Card>
      <Pagination page={page} pages={pages} onPage={setPage} />
      <AppointmentDrawer appt={sel} onClose={() => setSel(null)} onChanged={appts.retry} />
    </div>
  );
}

// ─── Activity log ─────────────────────────────────────────────────────────────
export function AdminActivity() {
  const { session } = useApp();
  const [role, setRole] = useState("all");
  const [action, setAction] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const PER = 18;
  const data = useAsync(() => listActivity(session, { role, action, search: q, page, perPage: PER }), [session?.user_id, role, action, q, page]);
  const pages = Math.ceil((data.data?.total ?? 0) / PER);

  const ACTIONS = ["appointment.created", "appointment.confirmed", "appointment.rescheduled", "appointment.cancelled", "appointment.completed", "payment.received", "invoice.generated", "project.created", "project.status_changed", "consultant.assigned", "consultant.approved", "file.uploaded", "review.submitted", "service.updated", "settings.updated"];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Activity Log</h1>
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="w-52"><SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Kërko aktor/metadata…" /></div>
          <Select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className="!w-36">
            <option value="all">Çdo rol</option>
            {["admin", "consultant", "client", "system"].map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
          <Select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="!w-52">
            <option value="all">Çdo veprim</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </Select>
        </div>
      </div>
      {data.error && <ErrorState message={data.error} onRetry={data.retry} />}
      <Card className="overflow-hidden">
        {data.loading ? <div className="p-5"><TableSkeleton rows={10} /></div> : (data.data?.rows ?? []).length === 0
          ? <EmptyState icon={<IActivity size={22} />} title="Asnjë veprim" hint="Veprimet kryesore të platformës regjistrohen automatikisht." />
          : (
            <div className="divide-y divide-line">
              {(data.data?.rows ?? []).map((a) => (
                <div key={a.id} className="flex items-start gap-3.5 px-5 py-3.5 hover:bg-paper/50 transition-colors">
                  <Avatar name={a.actor_name} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px]"><b className="text-ink">{a.actor_name}</b> <span className="font-mono text-[11.5px] text-primary-700 bg-primary-50 px-1.5 py-0.5 rounded">{a.action}</span></p>
                    {a.metadata && <p className="text-[12.5px] text-mute mt-0.5 truncate">{a.metadata}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <Badge tone="mute">{a.entity_type}</Badge>
                    <p className="text-[11px] text-mute mt-1 font-mono">{relativeTime(a.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
      </Card>
      <Pagination page={page} pages={pages} onPage={setPage} />
    </div>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export function AdminSettings() {
  const { session, toast } = useApp();
  const settings = useAsync(() => getSettings(session), [session?.user_id]);
  const [f, setF] = useState<Record<string, number> | null>(null);
  const [busy, setBusy] = useState(false);
  React.useEffect(() => {
    if (settings.data) setF({
      min_cancel_hours: settings.data.min_cancel_hours,
      min_reschedule_hours: settings.data.min_reschedule_hours,
      buffer_minutes: settings.data.buffer_minutes,
      min_notice_hours: settings.data.min_notice_hours,
      booking_horizon_days: settings.data.booking_horizon_days,
      default_commission: settings.data.default_commission,
      tax_rate: settings.data.tax_rate,
      reminder_24: settings.data.reminder_hours.includes(24) ? 1 : 0,
      reminder_1: settings.data.reminder_hours.includes(1) ? 1 : 0,
    });
  }, [settings.data]);

  const save = async () => {
    if (!f) return;
    setBusy(true);
    try {
      const reminders: number[] = [];
      if (f.reminder_24) reminders.push(24);
      if (f.reminder_1) reminders.push(1);
      await updateSettings(session, {
        min_cancel_hours: f.min_cancel_hours, min_reschedule_hours: f.min_reschedule_hours,
        buffer_minutes: f.buffer_minutes, min_notice_hours: f.min_notice_hours,
        booking_horizon_days: f.booking_horizon_days, default_commission: f.default_commission,
        tax_rate: f.tax_rate, reminder_hours: reminders,
      });
      toast("Cilësimet u ruajtën.");
    } catch (e) { toast(e instanceof Error ? e.message : "Gabim.", "bad"); } finally { setBusy(false); }
  };

  const num = (key: string, label: string, hint: string, suffix?: string) => (
    <Field label={label} hint={hint}>
      <div className="relative">
        <TextInput type="number" value={f?.[key] ?? 0} onChange={(e) => setF({ ...(f ?? {}), [key]: +e.target.value })} />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono text-mute">{suffix}</span>}
      </div>
    </Field>
  );

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink mb-5">Cilësimet</h1>
      {settings.error && <ErrorState message={settings.error} onRetry={settings.retry} />}
      {settings.loading && <Skeleton className="h-96 rounded-xl" />}
      {f && (
        <div className="space-y-5">
          <Card className="p-6">
            <h2 className="font-display font-bold text-ink mb-4">Rregullat e rezervimit</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {num("min_cancel_hours", "Anulimi minimal", "Klienti mund të anulojë vetëm më herët se kaq", "orë")}
              {num("min_reschedule_hours", "Rizhvendosja minimale", "Klienti mund të rizhvendosë vetëm më herët se kaq", "orë")}
              {num("buffer_minutes", "Buffer midis termineve", "Koha mbrojtëse rreth çdo takimi", "min")}
              {num("min_notice_hours", "Njoftimi minimal", "Sa kohë përpara mund të rezervohet sot", "orë")}
              {num("booking_horizon_days", "Horizonti i rezervimit", "Sa ditë përpara mund të rezervohet", "ditë")}
            </div>
          </Card>
          <Card className="p-6">
            <h2 className="font-display font-bold text-ink mb-4">Financat</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {num("default_commission", "Komisioni standard i platformës", "Përdoret kur konsulenti s'ka komision të përcaktuar", "%")}
              {num("tax_rate", "TVSH", "Konfigurim fleksibël — sipas juridiksionit", "%")}
            </div>
          </Card>
          <Card className="p-6">
            <h2 className="font-display font-bold text-ink mb-4 flex items-center gap-2"><IBell2 size={16} className="text-primary-600" /> Kujtesat automatike</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="flex items-center gap-3 p-3.5 rounded-xl border border-line cursor-pointer hover:border-primary-300 transition-colors">
                <input type="checkbox" checked={!!f.reminder_24} onChange={(e) => setF({ ...f, reminder_24: e.target.checked ? 1 : 0 })} className="w-4 h-4 accent-[#1b44cc]" />
                <div><p className="text-[13.5px] font-bold text-ink">Kujtesë 24 orë para</p><p className="text-[11.5px] text-mute">Email klientit dhe konsulentit</p></div>
              </label>
              <label className="flex items-center gap-3 p-3.5 rounded-xl border border-line cursor-pointer hover:border-primary-300 transition-colors">
                <input type="checkbox" checked={!!f.reminder_1} onChange={(e) => setF({ ...f, reminder_1: e.target.checked ? 1 : 0 })} className="w-4 h-4 accent-[#1b44cc]" />
                <div><p className="text-[13.5px] font-bold text-ink">Kujtesë 1 orë para</p><p className="text-[11.5px] text-mute">Me linkun e takimit</p></div>
              </label>
            </div>
            <p className="text-[11.5px] text-mute mt-3">Kujtesat nuk dërgohen për termine të anuluara dhe nuk përsëriten (deduplikim në log-un e njoftimeve).</p>
          </Card>
          <div className="flex items-center gap-3">
            <Button size="lg" loading={busy} onClick={save}>Ruaj cilësimet</Button>
            <Button variant="danger" onClick={() => { if (confirm("Rivendos të gjitha të dhënat demo?")) { doReset(); toast("Të dhënat u rivendosën."); } }}><IRefresh size={14} /> Rivendos të dhënat demo</Button>
          </div>
        </div>
      )}
    </div>
  );
}
