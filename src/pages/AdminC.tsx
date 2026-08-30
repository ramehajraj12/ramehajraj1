import React, { useMemo, useState } from "react";
import { useApp, useAsync } from "../lib/store";
import {
  listPayments, refundPayment, setPayoutStatus, listInvoices, setInvoiceStatus, getInvoice,
  getAnalytics, listReviews, moderateReview, listFiles, deleteFile,
} from "../lib/services";
import { APPT_STATUS, INVOICE_STATUS, PAYMENT_STATUS, REVIEW_STATUS } from "../lib/i18n";
import { fmtEuro, fmtDate, addDaysISO, todayISO, cls } from "../lib/utils";
import {
  Avatar, Badge, Button, Card, EmptyState, ErrorState, Modal, SearchInput, Select,
  Skeleton, Stars, TableSkeleton, Td, Th,
} from "../components/ui";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import { InvoiceView } from "./ClientPortal";
import { FileList } from "./ClientPortal";
import { IEuro, IInvoice, ITrend, IStar, IFile, ICheck, IX, IWarn } from "../components/icons";

// ─── Payments ─────────────────────────────────────────────────────────────────
export function AdminPayments() {
  const { session, toast } = useApp();
  const [status, setStatus] = useState("all");
  const payments = useAsync(() => listPayments(session), [session?.user_id]);
  const list = (payments.data ?? []).filter((p) => status === "all" || p.status === status);

  const totals = useMemo(() => {
    const paid = (payments.data ?? []).filter((p) => p.status === "paid");
    return {
      gross: paid.reduce((a, p) => a + p.amount_gross, 0),
      fee: paid.reduce((a, p) => a + p.platform_fee, 0),
      net: paid.reduce((a, p) => a + p.consultant_net, 0),
      pending: (payments.data ?? []).filter((p) => p.status === "pending").reduce((a, p) => a + p.amount_gross, 0),
      payoutPending: paid.filter((p) => p.payout_status !== "paid").reduce((a, p) => a + p.consultant_net, 0),
    };
  }, [payments.data]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Pagesat & Komisionet</h1>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="!w-48">
          <option value="all">Të gjitha statuset</option>
          {Object.entries(PAYMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 stagger">
        {([["Bruto (e paguar)", fmtEuro(totals.gross), "text-ink"], ["Komisioni platformës", fmtEuro(totals.fee), "text-primary-700"], ["Neto konsulentëve", fmtEuro(totals.net), "text-ok"], ["Në pritje", fmtEuro(totals.pending), "text-warn"], ["Payout në pritje", fmtEuro(totals.payoutPending), "text-warn"]] as [string, string, string][]).map(([l, v, c]) => (
          <Card key={l} className="p-4">
            <p className="text-[10.5px] font-mono uppercase tracking-wider text-mute">{l}</p>
            <p className={cls("font-display font-bold text-lg mt-1.5", c)}>{v}</p>
          </Card>
        ))}
      </div>

      {payments.error && <ErrorState message={payments.error} onRetry={payments.retry} />}
      <Card className="overflow-hidden mt-5">
        {payments.loading ? <div className="p-5"><TableSkeleton rows={8} /></div> : list.length === 0
          ? <EmptyState icon={<IEuro size={22} />} title="Asnjë pagesë" />
          : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px]">
                <thead className="bg-paper/70"><tr><Th>Data</Th><Th>Klienti</Th><Th>Konsulenti</Th><Th>Lloji</Th><Th>Bruto</Th><Th>Komisioni</Th><Th>Neto</Th><Th>Statusi</Th><Th>Payout</Th><Th /></tr></thead>
                <tbody>
                  {list.map((p) => (
                    <tr key={p.id} className="hover:bg-paper/50 transition-colors">
                      <Td className="font-mono text-[12px]">{fmtDate(p.created_at.slice(0, 10))}</Td>
                      <Td className="font-semibold text-ink">{p.client_name}</Td>
                      <Td>{p.consultant_name}</Td>
                      <Td><Badge tone="mute">{{ full: "E plotë", deposit: "Depozitë", balance: "Balancë" }[p.type]}</Badge></Td>
                      <Td className="font-mono font-bold">{fmtEuro(p.amount_gross)}</Td>
                      <Td className="font-mono text-primary-700">{fmtEuro(p.platform_fee)}</Td>
                      <Td className="font-mono text-ok">{fmtEuro(p.consultant_net)}</Td>
                      <Td><Badge tone={PAYMENT_STATUS[p.status].tone as never}>{PAYMENT_STATUS[p.status].label}</Badge></Td>
                      <Td><Badge tone={p.payout_status === "paid" ? "ok" : p.payout_status === "approved" ? "teal" : "mute"}>{{ pending: "Pritje", approved: "Aprovuar", paid: "Paguar" }[p.payout_status]}</Badge></Td>
                      <Td>
                        <div className="flex gap-1.5">
                          {p.status === "paid" && p.payout_status === "pending" && (
                            <Button size="sm" variant="outline" onClick={async () => { await setPayoutStatus(session, p.id, "approved"); toast("Payout u aprovua."); }}>Aprovo</Button>
                          )}
                          {p.payout_status === "approved" && (
                            <Button size="sm" onClick={async () => { await setPayoutStatus(session, p.id, "paid"); toast("Payout u shënua i paguar."); }}>Paguaj</Button>
                          )}
                          {p.status === "paid" && (
                            <Button size="sm" variant="danger" onClick={async () => { if (confirm("Rikthej pagesën?")) { await refundPayment(session, p.id); toast("Pagesa u rikthye."); } }}>Rikthe</Button>
                          )}
                        </div>
                      </Td>
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

// ─── Invoices ─────────────────────────────────────────────────────────────────
export function AdminInvoices() {
  const { session, toast } = useApp();
  const invoices = useAsync(() => listInvoices(session), [session?.user_id]);
  const [viewId, setViewId] = useState<string | null>(null);
  const view = useAsync(async () => (viewId ? getInvoice(session, viewId) : null), [viewId]);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink mb-5">Faturat</h1>
      {invoices.error && <ErrorState message={invoices.error} onRetry={invoices.retry} />}
      <Card className="overflow-hidden">
        {invoices.loading ? <div className="p-5"><TableSkeleton rows={7} /></div> : (invoices.data ?? []).length === 0
          ? <EmptyState icon={<IInvoice size={22} />} title="Asnjë faturë" />
          : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px]">
                <thead className="bg-paper/70"><tr><Th>Numri</Th><Th>Klienti</Th><Th>Referenca</Th><Th>Neto</Th><Th>TVSH</Th><Th>Totali</Th><Th>Afati</Th><Th>Statusi</Th><Th /></tr></thead>
                <tbody>
                  {(invoices.data ?? []).map((i) => (
                    <tr key={i.id} className="hover:bg-paper/50 transition-colors">
                      <Td className="font-mono font-bold text-primary-700 text-[12.5px]">{i.invoice_number}</Td>
                      <Td className="font-semibold text-ink">{i.client_name}</Td>
                      <Td className="font-mono text-[12px]">{i.reference}</Td>
                      <Td className="font-mono">{fmtEuro(i.amount_net)}</Td>
                      <Td className="font-mono text-mute">{fmtEuro(i.tax_amount)}</Td>
                      <Td className="font-mono font-bold">{fmtEuro(i.amount_total)}</Td>
                      <Td className={cls("font-mono text-[12px]", i.status === "issued" && i.due_date < todayISO() && "text-bad font-bold")}>{fmtDate(i.due_date)}</Td>
                      <Td><Badge tone={INVOICE_STATUS[i.status].tone as never}>{INVOICE_STATUS[i.status].label}</Badge></Td>
                      <Td>
                        <div className="flex gap-1.5">
                          <Button variant="outline" size="sm" onClick={() => setViewId(i.id)}>Shiko</Button>
                          {i.status === "issued" && <Button size="sm" variant="ghost" onClick={async () => { await setInvoiceStatus(session, i.id, "paid"); toast("U shënua e paguar."); }}><ICheck size={13} /></Button>}
                          {(i.status === "issued" || i.status === "draft") && <Button size="sm" variant="danger" onClick={async () => { await setInvoiceStatus(session, i.id, "cancelled"); toast("Fatura u anulua."); }}><IX size={13} /></Button>}
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Card>
      <Modal open={!!viewId} onClose={() => setViewId(null)} title="Fatura" wide>
        {view.loading && <div className="py-10 text-center"><span className="inline-block w-6 h-6 rounded-full border-2 border-primary-200 border-t-primary-600 animate-spin" /></div>}
        {view.data && <InvoiceView inv={view.data} />}
      </Modal>
    </div>
  );
}

// ─── Analytics ────────────────────────────────────────────────────────────────
const RANGES = [
  { key: "7", label: "7 ditë" }, { key: "30", label: "30 ditë" },
  { key: "month", label: "Ky muaj" }, { key: "year", label: "Ky vit" }, { key: "all", label: "Gjithçka" },
];

const PIE_COLORS = ["#c98d08", "#177a48", "#2f57e4", "#bc4242", "#0e8f96", "#9aa7bf"];

export function AdminAnalytics() {
  const { session } = useApp();
  const [range, setRange] = useState("30");
  const { from, to } = useMemo(() => {
    const t = todayISO();
    if (range === "7") return { from: addDaysISO(t, -7), to: t };
    if (range === "30") return { from: addDaysISO(t, -30), to: t };
    if (range === "month") return { from: t.slice(0, 8) + "01", to: t };
    if (range === "year") return { from: t.slice(0, 4) + "-01-01", to: t };
    return { from: addDaysISO(t, -365), to: t };
  }, [range]);
  const data = useAsync(() => getAnalytics(session, from, to), [session?.user_id, from, to]);
  const a = data.data;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Analitika</h1>
        <div className="flex gap-1.5 flex-wrap">
          {RANGES.map((r) => (
            <button key={r.key} onClick={() => setRange(r.key)}
              className={cls("px-3 h-9 rounded-lg text-[13px] font-bold transition-all", range === r.key ? "bg-ink text-paper" : "bg-card border border-line text-mute hover:text-ink")}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {data.error && <ErrorState message={data.error} onRetry={data.retry} />}
      {data.loading && <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>}

      {a && (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 stagger">
            {([
              ["Rezervime", String(a.kpi.bookings), ""],
              ["Të konfirmuara", String(a.kpi.confirmed), ""],
              ["Të përfunduara", String(a.kpi.completed), ""],
              ["Norma e anulimit", a.kpi.cancelRate + "%", a.kpi.cancelRate > 25 ? "text-bad" : ""],
              ["Të ardhurat", fmtEuro(a.kpi.revenue), "text-primary-700"],
              ["Në pritje", fmtEuro(a.kpi.pendingRevenue), "text-warn"],
              ["Komisioni platformës", fmtEuro(a.kpi.platformRevenue), "text-primary-700"],
              ["Fitimet e konsulentëve", fmtEuro(a.kpi.consultantEarnings), "text-ok"],
              ["Vlera mesatare", fmtEuro(a.kpi.avgBookingValue), ""],
              ["Klientë të rinj", String(a.kpi.newClients), ""],
              ["Projekte aktive", String(a.kpi.activeProjects), ""],
              ["Konsulentë aktivë", String(a.kpi.activeConsultants), ""],
            ] as [string, string, string][]).map(([l, v, c]) => (
              <Card key={l} className="p-4">
                <p className="text-[10.5px] font-mono uppercase tracking-wider text-mute">{l}</p>
                <p className={cls("font-display font-bold text-xl mt-1.5", c || "text-ink")}>{v}</p>
              </Card>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-5 mt-5">
            <Card className="p-5">
              <h2 className="font-display font-bold text-ink mb-4">Trendi i të ardhurave (€)</h2>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={a.series} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2f57e4" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#2f57e4" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e7f1" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#5b6883" }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: "#5b6883" }} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e7f1", fontSize: 12 }} />
                  <Area type="monotone" dataKey="revenue" name="Të ardhurat" stroke="#1b44cc" strokeWidth={2.4} fill="url(#rev)" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
            <Card className="p-5">
              <h2 className="font-display font-bold text-ink mb-4">Rezervimet sipas ditës</h2>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={a.series} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e7f1" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#5b6883" }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: "#5b6883" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e7f1", fontSize: 12 }} />
                  <Bar dataKey="bookings" name="Rezervime" fill="#2f57e4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card className="p-5">
              <h2 className="font-display font-bold text-ink mb-4">Shpërndarja e shërbimeve</h2>
              {a.byService.length === 0 ? <EmptyState title="Asnjë të dhënë" /> : (
                <div className="space-y-2.5">
                  {a.byService.map((s) => {
                    const max = Math.max(1, ...a.byService.map((x) => x.revenue));
                    return (
                      <div key={s.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[13px] font-semibold text-ink-2">{s.name}</span>
                          <span className="font-mono text-[12px] text-mute">{s.bookings} rez. · <b className="text-ink">{fmtEuro(s.revenue)}</b></span>
                        </div>
                        <div className="h-2 rounded-full bg-[#e7ebf3] overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-300 transition-all duration-700" style={{ width: `${(s.revenue / max) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
            <Card className="p-5">
              <h2 className="font-display font-bold text-ink mb-4">Statuset e termineve</h2>
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie data={a.byStatus} dataKey="count" nameKey="status" innerRadius={48} outerRadius={78} paddingAngle={3} strokeWidth={0}>
                      {a.byStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e7f1", fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {a.byStatus.map((s, i) => (
                    <div key={s.status} className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-[12.5px] font-semibold text-ink-2 flex-1">{APPT_STATUS[s.status]?.label ?? s.status}</span>
                      <span className="font-mono text-[12px] font-bold text-ink">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          <Card className="overflow-hidden mt-5">
            <div className="px-5 py-4 border-b border-line"><h2 className="font-display font-bold text-ink">Performanca e konsulentëve</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="bg-paper/70"><tr><Th>Konsulenti</Th><Th>Rezervime</Th><Th>Neto</Th><Th>Vlerësimi</Th><Th>Norma e përfundimit</Th><Th>Projekte aktive</Th></tr></thead>
                <tbody>
                  {a.byConsultant.map((c) => (
                    <tr key={c.name} className="hover:bg-paper/50">
                      <Td><div className="flex items-center gap-2.5"><Avatar name={c.name} size={32} /><span className="font-bold text-ink">{c.name}</span></div></Td>
                      <Td className="font-mono">{c.bookings}</Td>
                      <Td className="font-mono font-bold text-ok">{fmtEuro(c.revenue)}</Td>
                      <Td><span className="flex items-center gap-1.5"><Stars value={c.rating} size={12} /><span className="font-mono text-[12px]">{c.rating.toFixed(1)}</span></span></Td>
                      <Td>
                        <div className="flex items-center gap-2.5 w-40">
                          <div className="h-1.5 flex-1 rounded-full bg-[#e7ebf3]"><div className="h-full rounded-full bg-teal" style={{ width: `${c.completionRate}%` }} /></div>
                          <span className="font-mono text-[11.5px] text-mute">{c.completionRate}%</span>
                        </div>
                      </Td>
                      <Td className="font-mono">{c.activeProjects}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Reviews moderation ───────────────────────────────────────────────────────
export function AdminReviews() {
  const { session, toast } = useApp();
  const [status, setStatus] = useState("all");
  const reviews = useAsync(() => listReviews(session, { status }), [session?.user_id, status]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Vlerësimet</h1>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="!w-44">
          <option value="all">Të gjitha</option>
          {Object.entries(REVIEW_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
      </div>
      {reviews.error && <ErrorState message={reviews.error} onRetry={reviews.retry} />}
      {!reviews.loading && (reviews.data ?? []).length === 0 && <Card><EmptyState icon={<IStar size={22} />} title="Asnjë vlerësim" hint="Vlerësimet nga klientët shfaqen këtu për moderim." /></Card>}
      <div className="grid md:grid-cols-2 gap-4 stagger">
        {(reviews.data ?? []).map((r) => (
          <Card key={r.id} className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar name={r.client_name} size={38} />
                <div>
                  <p className="font-bold text-ink text-[13.5px]">{r.client_name} → <span className="text-primary-700">{r.consultant_name}</span></p>
                  <p className="text-[11px] text-mute font-mono">{r.reference} · {fmtDate(r.created_at.slice(0, 10))}</p>
                </div>
              </div>
              <Badge tone={REVIEW_STATUS[r.status].tone as never}>{REVIEW_STATUS[r.status].label}</Badge>
            </div>
            <div className="flex items-center gap-4 mt-3.5">
              <Stars value={r.rating} size={15} />
              <span className="text-[11.5px] text-mute">Qartësia {r.clarity} · Dobishmëria {r.usefulness} · Rekomandim {r.recommendation}</span>
            </div>
            {r.comment && <p className="text-[13.5px] text-ink-2 mt-3 leading-relaxed">“{r.comment}”</p>}
            <div className="flex items-center gap-2 mt-4 pt-3.5 border-t border-line">
              {!r.consent_to_publish && <Badge tone="warn"><IWarn size={11} /> Pa pëlqim publikimi</Badge>}
              <div className="flex-1" />
              {r.status !== "published" && (
                <Button size="sm" className="!bg-ok hover:!bg-[#126b3d]" onClick={async () => { await moderateReview(session, r.id, "published"); toast("U publikua. Vlerësimi i konsulentit u rikalkulua."); }}><ICheck size={13} /> Publiko</Button>
              )}
              {r.status !== "rejected" && (
                <Button size="sm" variant="danger" onClick={async () => { await moderateReview(session, r.id, "rejected"); toast("U refuzua."); }}><IX size={13} /> Refuzo</Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Files (admin) ────────────────────────────────────────────────────────────
export function AdminFiles() {
  const { session, toast } = useApp();
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const files = useAsync(() => listFiles(session, { category: cat, search: q }), [session?.user_id, cat, q]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Dokumentet</h1>
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="w-60"><SearchInput value={q} onChange={setQ} placeholder="Kërko skedar…" /></div>
          <Select value={cat} onChange={(e) => setCat(e.target.value)} className="!w-52">
            <option value="all">Të gjitha kategoritë</option>
            {Object.entries({ dataset: "Set i të dhënave", questionnaire: "Pyetësor", thesis: "Punim", spss_output: "SPSS Output", report: "Raport", deliverable: "Dorëzim", other: "Tjetër" }).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
      </div>
      {files.error && <ErrorState message={files.error} onRetry={files.retry} />}
      <Card className="p-4">
        {files.loading ? <TableSkeleton rows={8} /> : <FileList files={files.data ?? []} empty="Të gjithë skedarët e platformës me akses të autorizuar." />}
      </Card>
    </div>
  );
}
