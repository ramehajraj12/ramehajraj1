import React, { useMemo, useState } from "react";
import { MONTHS_SQ, DAYS_SQ_SHORT, APPT_STATUS } from "../lib/i18n";
import { monthMatrix, weekDays, todayISO, cls, parseISO, timeToMin, minToTime, fmtDate } from "../lib/utils";
import type { DayCapacity } from "../lib/availability";
import type { AppointmentRow } from "../lib/services";
import { IChevL, IChevR, ICal } from "./icons";
import { Badge, Segmented } from "./ui";

// ─── Booking month calendar ──────────────────────────────────────────────────
export function BookingCalendar({
  capacity, selected, onSelect, onMonthChange,
}: {
  capacity: Map<string, DayCapacity>; selected: string | null; onSelect: (iso: string) => void;
  onMonthChange?: (y: number, m: number) => void;
}) {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const weeks = useMemo(() => monthMatrix(ym.y, ym.m), [ym]);
  const today = todayISO();
  const nextMonth = () => {
    setYm(({ y, m }) => {
      const ny = m === 11 ? y + 1 : y, nm = m === 11 ? 0 : m + 1;
      onMonthChange?.(ny, nm);
      return { y: ny, m: nm };
    });
  };
  const prevMonth = () => {
    setYm(({ y, m }) => {
      const ny = m === 0 ? y - 1 : y, nm = m === 0 ? 11 : m - 1;
      onMonthChange?.(ny, nm);
      return { y: ny, m: nm };
    });
  };
  const isCurrentMonth = ym.y === now.getFullYear() && ym.m === now.getMonth();

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} disabled={isCurrentMonth}
          className="w-8 h-8 rounded-lg border border-line hover:border-primary-400 hover:text-primary-600 flex items-center justify-center text-mute disabled:opacity-30 transition-colors">
          <IChevL size={15} />
        </button>
        <p className="font-display font-bold text-ink">{MONTHS_SQ[ym.m]} {ym.y}</p>
        <button onClick={nextMonth}
          className="w-8 h-8 rounded-lg border border-line hover:border-primary-400 hover:text-primary-600 flex items-center justify-center text-mute transition-colors">
          <IChevR size={15} />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1.5">
        {DAYS_SQ_SHORT.map((d) => <div key={d} className="text-center text-[11px] font-bold text-mute uppercase tracking-wide py-1">{d}</div>)}
      </div>
      <div className="space-y-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((iso) => {
              const inMonth = parseISO(iso).getMonth() === ym.m;
              const cap = capacity.get(iso);
              const disabled = !inMonth || !cap || cap === "past" || cap === "blocked" || cap === "none";
              const sel = selected === iso;
              return (
                <button key={iso} disabled={disabled} onClick={() => onSelect(iso)}
                  className={cls(
                    "relative h-10 sm:h-11 rounded-lg text-sm font-semibold transition-all duration-150 focus-ring",
                    !inMonth && "text-line-2",
                    inMonth && disabled && "text-mute/40 line-through decoration-mute/30",
                    inMonth && !disabled && !sel && "text-ink hover:bg-primary-50 hover:text-primary-700 border border-transparent hover:border-primary-200",
                    sel && "bg-primary-600 text-primary-50 shadow-soft scale-[1.02]",
                  )}>
                  {parseISO(iso).getDate()}
                  {inMonth && !disabled && !sel && (
                    <span className={cls("absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full",
                      cap === "open" ? "bg-ok" : cap === "limited" ? "bg-amber" : "bg-bad")} />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-line text-[11px] text-mute">
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-ok inline-block" /> Hapur</span>
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber inline-block" /> Pak vende</span>
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-bad inline-block" /> Po mbushet</span>
      </div>
    </div>
  );
}

// ─── Planner (admin / consultant) ────────────────────────────────────────────
export type PlannerView = "day" | "week" | "month";

const STATUS_COLOR: Record<string, string> = {
  confirmed: "bg-primary-600 text-primary-50 border-primary-700",
  pending: "bg-warn-soft text-warn border-[#e5d3a3]",
  completed: "bg-teal-soft text-teal border-[#b8dde0]",
  cancelled: "bg-bad-soft text-bad border-[#ecc9c9] line-through",
  rescheduled: "bg-[#eceff6] text-mute border-line-2",
  no_show: "bg-[#eceff6] text-mute border-line-2",
};

const HOUR_START = 8, HOUR_END = 20;

function EventChip({ a, onClick, compact }: { a: AppointmentRow; onClick: () => void; compact?: boolean }) {
  return (
    <button onClick={onClick}
      className={cls("w-full text-left rounded-md border px-1.5 py-1 text-[10.5px] font-semibold leading-tight transition-transform hover:scale-[1.03] hover:shadow-soft overflow-hidden",
        STATUS_COLOR[a.status] ?? STATUS_COLOR.confirmed)}
      title={`${a.reference} — ${a.client_name}`}>
      <span className="font-mono">{a.start_time}</span>{" "}
      <span className="opacity-90">{a.client_name.split(" ")[0]}</span>
      {!compact && <span className="block opacity-75 truncate font-medium">{a.service_name}</span>}
    </button>
  );
}

export function PlannerCalendar({
  appointments, view, onViewChange, onEventClick,
}: {
  appointments: AppointmentRow[];
  view: PlannerView;
  onViewChange: (v: PlannerView) => void;
  onEventClick: (a: AppointmentRow) => void;
}) {
  const today = todayISO();
  const [anchor, setAnchor] = useState(today);
  const anchorDate = parseISO(anchor);

  const shift = (days: number) => {
    const d = parseISO(anchor);
    d.setDate(d.getDate() + days);
    setAnchor(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  };
  const shiftMonth = (dir: number) => {
    const d = parseISO(anchor);
    d.setMonth(d.getMonth() + dir);
    setAnchor(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
  };

  const byDay = useMemo(() => {
    const map = new Map<string, AppointmentRow[]>();
    for (const a of appointments) {
      if (!map.has(a.date)) map.set(a.date, []);
      map.get(a.date)!.push(a);
    }
    for (const list of map.values()) list.sort((x, y) => x.start_time.localeCompare(y.start_time));
    return map;
  }, [appointments]);

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-2">
        <button onClick={() => (view === "month" ? shiftMonth(-1) : shift(view === "week" ? -7 : -1))}
          className="w-8 h-8 rounded-lg border border-line hover:border-primary-400 hover:text-primary-600 flex items-center justify-center text-mute transition-colors"><IChevL size={15} /></button>
        <button onClick={() => setAnchor(today)} className="h-8 px-3 rounded-lg border border-line text-[12.5px] font-semibold text-ink-2 hover:border-primary-400 hover:text-primary-700 transition-colors">Sot</button>
        <button onClick={() => (view === "month" ? shiftMonth(1) : shift(view === "week" ? 7 : 1))}
          className="w-8 h-8 rounded-lg border border-line hover:border-primary-400 hover:text-primary-600 flex items-center justify-center text-mute transition-colors"><IChevR size={15} /></button>
        <p className="font-display font-bold text-ink ml-2">
          {view === "month"
            ? `${MONTHS_SQ[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`
            : fmtDate(anchor)}
        </p>
      </div>
      <Segmented
        options={[{ value: "day", label: "Dita" }, { value: "week", label: "Java" }, { value: "month", label: "Muaji" }]}
        value={view} onChange={onViewChange}
      />
    </div>
  );

  if (view === "month") {
    const weeks = monthMatrix(anchorDate.getFullYear(), anchorDate.getMonth());
    return (
      <div>
        {header}
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-line">
            {DAYS_SQ_SHORT.map((d) => <div key={d} className="px-2 py-2 text-[11px] font-bold text-mute uppercase tracking-wide text-center">{d}</div>)}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-line last:border-0">
              {week.map((iso) => {
                const inMonth = parseISO(iso).getMonth() === anchorDate.getMonth();
                const list = byDay.get(iso) ?? [];
                return (
                  <div key={iso} className={cls("min-h-[92px] border-r border-line last:border-r-0 p-1", !inMonth && "bg-paper/60", iso === today && "bg-primary-50/50")}>
                    <button onClick={() => { setAnchor(iso); onViewChange("day"); }}
                      className={cls("text-[12px] font-bold w-6 h-6 rounded-md flex items-center justify-center transition-colors",
                        iso === today ? "bg-primary-600 text-primary-50" : inMonth ? "text-ink hover:bg-primary-100" : "text-mute/50")}>
                      {parseISO(iso).getDate()}
                    </button>
                    <div className="space-y-0.5 mt-0.5">
                      {list.slice(0, 3).map((a) => <EventChip key={a.id} a={a} onClick={() => onEventClick(a)} compact />)}
                      {list.length > 3 && <p className="text-[10px] font-mono text-mute pl-1">+{list.length - 3} të tjera</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const days = view === "week" ? weekDays(anchor) : [anchor];
  const hourHeight = 48;
  const totalMin = (HOUR_END - HOUR_START) * 60;

  return (
    <div>
      {header}
      <div className="card overflow-hidden">
        <div className="grid border-b border-line" style={{ gridTemplateColumns: `52px repeat(${days.length}, 1fr)` }}>
          <div />
          {days.map((d) => (
            <button key={d} onClick={() => { setAnchor(d); onViewChange("day"); }}
              className={cls("py-2.5 text-center border-l border-line transition-colors hover:bg-paper", d === today && "bg-primary-50")}>
              <span className="block text-[10.5px] font-bold text-mute uppercase">{DAYS_SQ_SHORT[(parseISO(d).getDay() + 6) % 7]}</span>
              <span className={cls("font-display font-bold text-[15px]", d === today ? "text-primary-700" : "text-ink")}>{parseISO(d).getDate()}</span>
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <div className="grid min-w-[640px]" style={{ gridTemplateColumns: `52px repeat(${days.length}, 1fr)` }}>
            <div className="relative" style={{ height: (totalMin / 60) * hourHeight }}>
              {Array.from({ length: HOUR_END - HOUR_START + 1 }).map((_, i) => (
                <span key={i} className="absolute right-2 text-[10px] font-mono text-mute -translate-y-1/2"
                  style={{ top: i * hourHeight }}>
                  {String(HOUR_START + i).padStart(2, "0")}:00
                </span>
              ))}
            </div>
            {days.map((d) => (
              <div key={d} className={cls("relative border-l border-line", d === today && "bg-primary-50/40")} style={{ height: (totalMin / 60) * hourHeight }}>
                {Array.from({ length: HOUR_END - HOUR_START }).map((_, i) => (
                  <div key={i} className="absolute left-0 right-0 border-t border-line/70" style={{ top: i * hourHeight }} />
                ))}
                {(byDay.get(d) ?? []).map((a) => {
                  const start = timeToMin(a.start_time) - HOUR_START * 60;
                  const h = (a.duration_minutes / 60) * hourHeight;
                  const top = Math.max(0, (start / 60) * hourHeight);
                  return (
                    <div key={a.id} className="absolute left-1 right-1" style={{ top: top + 1, height: Math.max(h - 2, 20) }}>
                      <EventChip a={a} onClick={() => onEventClick(a)} />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Status legend ────────────────────────────────────────────────────────────
export function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {Object.entries(APPT_STATUS).map(([k, v]) => (
        <Badge key={k} tone={v.tone}>{v.label}</Badge>
      ))}
    </div>
  );
}

export function MiniAgenda({ list, onEventClick, empty }: { list: AppointmentRow[]; onEventClick: (a: AppointmentRow) => void; empty: string }) {
  if (list.length === 0)
    return (
      <div className="py-10 text-center">
        <ICal size={22} className="mx-auto text-mute mb-2" />
        <p className="text-sm text-mute">{empty}</p>
      </div>
    );
  return (
    <div className="space-y-2">
      {list.map((a) => (
        <button key={a.id} onClick={() => onEventClick(a)}
          className="w-full flex items-center gap-3 p-3 rounded-xl border border-line bg-card hover:border-primary-300 hover:shadow-soft transition-all text-left group">
          <div className="w-12 text-center shrink-0">
            <p className="font-mono text-[13px] font-bold text-primary-700">{a.start_time}</p>
            <p className="text-[10.5px] text-mute">{fmtDate(a.date)}</p>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-bold text-ink truncate group-hover:text-primary-700 transition-colors">{a.service_name}</p>
            <p className="text-xs text-mute truncate">{a.client_name} · {a.consultant_name}</p>
          </div>
          <Badge tone={APPT_STATUS[a.status].tone}>{APPT_STATUS[a.status].label}</Badge>
        </button>
      ))}
    </div>
  );
}
