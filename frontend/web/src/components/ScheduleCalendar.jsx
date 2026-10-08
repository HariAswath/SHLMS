import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Sun } from "lucide-react";
import { classNames, todayUtc } from "../lib/util.js";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Predefined color palette for laundry groups (max 8 groups)
const GROUP_COLORS = [
  { bg: "bg-indigo-100", text: "text-indigo-700", dot: "bg-indigo-500" },
  { bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500" },
  { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
  { bg: "bg-rose-100", text: "text-rose-700", dot: "bg-rose-500" },
  { bg: "bg-violet-100", text: "text-violet-700", dot: "bg-violet-500" },
  { bg: "bg-cyan-100", text: "text-cyan-700", dot: "bg-cyan-500" },
  { bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-500" },
  { bg: "bg-pink-100", text: "text-pink-700", dot: "bg-pink-500" },
];

/**
 * ScheduleCalendar — Interactive monthly calendar view for laundry schedules.
 *
 * Props:
 *   schedules   — Array of schedule objects with { scheduleDate, group: { id, name, ... }, startTime, endTime, status }
 *   holidays    — Array of holiday objects with { date, reason }
 *   onDateClick — (dateStr: string, schedule?: object, holiday?: object) => void
 */
export function ScheduleCalendar({ schedules = [], holidays = [], onDateClick }) {
  const today = todayUtc();
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date(`${today}T00:00:00Z`);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
  });

  // Build lookup maps
  const scheduleMap = useMemo(() => {
    const m = {};
    schedules.forEach((s) => { m[s.scheduleDate] = s; });
    return m;
  }, [schedules]);

  const holidayMap = useMemo(() => {
    const m = {};
    holidays.forEach((h) => { m[h.date] = h; });
    return m;
  }, [holidays]);

  // Assign colors to groups
  const groupColorMap = useMemo(() => {
    const m = {};
    let idx = 0;
    schedules.forEach((s) => {
      const gid = s.group?.id;
      if (gid && !(gid in m)) {
        m[gid] = GROUP_COLORS[idx % GROUP_COLORS.length];
        idx++;
      }
    });
    return m;
  }, [schedules]);

  // Generate calendar grid for current month
  const { cells, monthLabel } = useMemo(() => {
    const { year, month } = viewDate;
    const firstDay = new Date(Date.UTC(year, month, 1));
    const lastDay = new Date(Date.UTC(year, month + 1, 0));
    const daysInMonth = lastDay.getUTCDate();

    // Monday = 0 ... Sunday = 6  (ISO weekday)
    let startWeekday = firstDay.getUTCDay() - 1;
    if (startWeekday < 0) startWeekday = 6; // Sunday wraps

    const rows = [];
    let current = [];

    // Leading blanks
    for (let i = 0; i < startWeekday; i++) current.push(null);

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      current.push(dateStr);
      if (current.length === 7) {
        rows.push(current);
        current = [];
      }
    }

    // Trailing blanks
    if (current.length > 0) {
      while (current.length < 7) current.push(null);
      rows.push(current);
    }

    const label = firstDay.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
    return { cells: rows, monthLabel: label };
  }, [viewDate]);

  const prevMonth = () => setViewDate((v) => {
    const d = new Date(Date.UTC(v.year, v.month - 1, 1));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
  });

  const nextMonth = () => setViewDate((v) => {
    const d = new Date(Date.UTC(v.year, v.month + 1, 1));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
  });

  const goToday = () => {
    const d = new Date(`${today}T00:00:00Z`);
    setViewDate({ year: d.getUTCFullYear(), month: d.getUTCMonth() });
  };

  // Unique groups for the legend
  const legendGroups = useMemo(() => {
    const seen = {};
    return schedules
      .filter((s) => {
        if (!s.group?.id || seen[s.group.id]) return false;
        seen[s.group.id] = true;
        return true;
      })
      .map((s) => ({ id: s.group.id, name: s.group.name, color: groupColorMap[s.group.id] }));
  }, [schedules, groupColorMap]);

  return (
    <div className="space-y-4">
      {/* Header with navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
          <h3 className="text-base font-semibold text-slate-900 ml-1">{monthLabel}</h3>
        </div>
        <button
          type="button"
          onClick={goToday}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Today
        </button>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        {cells.map((row, ri) => (
          <div key={ri} className="grid grid-cols-7 divide-x divide-slate-100 border-b border-slate-100 last:border-b-0">
            {row.map((dateStr, ci) => {
              if (!dateStr) {
                return <div key={ci} className="min-h-[72px] bg-slate-50/30" />;
              }

              const dayNum = parseInt(dateStr.split("-")[2], 10);
              const isToday = dateStr === today;
              const sched = scheduleMap[dateStr];
              const hol = holidayMap[dateStr];
              const groupColor = sched?.group?.id ? groupColorMap[sched.group.id] : null;
              const isPast = dateStr < today;

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => onDateClick?.(dateStr, sched, hol)}
                  className={classNames(
                    "relative min-h-[72px] p-1.5 text-left transition-colors hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-indigo-300",
                    isPast && !isToday && "opacity-50",
                  )}
                >
                  {/* Day number */}
                  <span
                    className={classNames(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                      isToday
                        ? "bg-indigo-600 text-white font-bold"
                        : "text-slate-700",
                    )}
                  >
                    {dayNum}
                  </span>

                  {/* Holiday indicator */}
                  {hol && (
                    <div className="mt-0.5 flex items-center gap-1 rounded bg-rose-50 border border-rose-100 px-1 py-0.5">
                      <Sun size={9} className="text-rose-500 shrink-0" />
                      <span className="text-[9px] font-medium text-rose-600 truncate leading-tight">
                        {hol.reason}
                      </span>
                    </div>
                  )}

                  {/* Schedule indicator */}
                  {sched && !hol && groupColor && (
                    <div className={classNames("mt-0.5 rounded px-1 py-0.5", groupColor.bg)}>
                      <div className="flex items-center gap-1">
                        <span className={classNames("h-1.5 w-1.5 rounded-full shrink-0", groupColor.dot)} />
                        <span className={classNames("text-[9px] font-semibold truncate leading-tight", groupColor.text)}>
                          {sched.group.name}
                        </span>
                      </div>
                      <span className={classNames("text-[8px] leading-tight", groupColor.text, "opacity-70")}>
                        {sched.startTime}–{sched.endTime}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      {legendGroups.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-500">
          <span className="font-medium">Legend:</span>
          {legendGroups.map((g) => (
            <span key={g.id} className="inline-flex items-center gap-1.5">
              <span className={classNames("h-2 w-2 rounded-full", g.color.dot)} />
              <span className={classNames("font-medium", g.color.text)}>{g.name}</span>
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <Sun size={10} className="text-rose-500" />
            <span className="font-medium text-rose-600">Holiday</span>
          </span>
        </div>
      )}
    </div>
  );
}
