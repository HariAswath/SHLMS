import { useState } from "react";
import { CalendarClock, CalendarDays, CalendarOff, Plus } from "lucide-react";
import { Button, Card, ErrorBanner, Field, Input, SectionHeader, Spinner, StatCard, StatusPill, Table, toast } from "../../components/ui.jsx";
import { ScheduleCalendar } from "../../components/ScheduleCalendar.jsx";
import { get, post } from "../../lib/api.js";
import { useLoad } from "../../lib/useLoad.js";
import { addDaysUtc, fmtDate, todayUtc } from "../../lib/util.js";

const COLUMNS = [
  { key: "date", label: "Date" },
  { key: "group", label: "Laundry group" },
  { key: "rooms", label: "Rooms" },
  { key: "time", label: "Time" },
  { key: "status", label: "Status" },
];

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default function AdminSchedule() {
  const today = todayUtc();
  const { data, error, loading, retry, reload } = useLoad(async () => {
    const [sched, todayRes, hol] = await Promise.all([
      get("/schedules", { startDate: addDaysUtc(today, -30), endDate: addDaysUtc(today, 60), limit: 200 }),
      get("/schedules/today"),
      get("/schedules/holidays"),
    ]);
    return { schedules: sched.schedules, today: todayRes, holidays: hol.holidays };
  }, []);

  const [range, setRange] = useState({ startDate: today, endDate: addDaysUtc(today, 13) });
  const [generating, setGenerating] = useState(false);
  const [holiday, setHoliday] = useState({ date: "", reason: "" });
  const [addingHoliday, setAddingHoliday] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);

  const handleCalendarClick = (dateStr, sched, hol) => {
    setSelectedDay({ dateStr, sched, hol });
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorBanner error={error} onRetry={retry} />;

  const generate = async (e) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const res = await post("/schedules", range);
      toast(`Generated ${res.totalGenerated} laundry days.`);
      await reload();
    } catch (err) {
      toast(err.message, "danger");
    } finally {
      setGenerating(false);
    }
  };

  const addHoliday = async (e) => {
    e.preventDefault();
    setAddingHoliday(true);
    try {
      await post("/schedules/holidays", { ...holiday, shiftFutureSchedules: true });
      toast("Holiday added. Future schedules were shifted.");
      setHoliday({ date: "", reason: "" });
      await reload();
    } catch (err) {
      toast(err.message, "danger");
    } finally {
      setAddingHoliday(false);
    }
  };

  const t = data.today;
  const upcomingHolidays = data.holidays.filter((h) => h.date >= today);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Today"
          value={t.isHoliday ? "Holiday" : t.schedule ? t.schedule.group?.name : "Not scheduled"}
          sub={t.isHoliday ? t.holiday?.reason : t.schedule ? `Rooms ${t.schedule.group?.roomRangeStart}–${t.schedule.group?.roomRangeEnd}` : "Generate a schedule below"}
          icon={CalendarDays}
          tint={t.schedule ? "emerald" : "rose"}
        />
        <StatCard label="Scheduled days (next 30)" value={data.schedules.length} icon={CalendarClock} />
        <StatCard label="Upcoming holidays" value={upcomingHolidays.length} icon={CalendarOff} tint="amber" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <SectionHeader title="Generate schedule" subtitle="Round-robin across laundry groups; holidays freeze the rotation" />
          <form onSubmit={generate} className="space-y-4" data-testid="generate-form">
            <div className="grid grid-cols-2 gap-3">
              <Field label="From"><Input type="date" required value={range.startDate} onChange={(e) => setRange({ ...range, startDate: e.target.value })} /></Field>
              <Field label="To"><Input type="date" required min={range.startDate} value={range.endDate} onChange={(e) => setRange({ ...range, endDate: e.target.value })} /></Field>
            </div>
            <Button type="submit" loading={generating}><CalendarClock size={15} /> Generate</Button>
          </form>
        </Card>

        <Card className="p-6">
          <SectionHeader title="Holidays" subtitle="No laundry collection on these days" />
          <form onSubmit={addHoliday} className="mb-4 flex flex-wrap items-end gap-3" data-testid="holiday-form">
            <Field label="Date"><Input type="date" required value={holiday.date} onChange={(e) => setHoliday({ ...holiday, date: e.target.value })} /></Field>
            <Field label="Reason" className="min-w-[160px] flex-1"><Input required minLength={2} value={holiday.reason} onChange={(e) => setHoliday({ ...holiday, reason: e.target.value })} placeholder="e.g. Maintenance day" /></Field>
            <Button type="submit" variant="secondary" loading={addingHoliday}><Plus size={15} /> Add</Button>
          </form>
          {upcomingHolidays.length ? (
            <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto text-sm">
              {upcomingHolidays.map((h) => (
                <li key={h.id} className="flex items-center justify-between py-2.5">
                  <span className="font-medium text-slate-800">{fmtDate(h.date)}</span>
                  <span className="text-slate-500">{h.reason}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-3 text-sm text-slate-400">No upcoming holidays.</p>
          )}
        </Card>
      </div>

      {/* Interactive Visual Calendar */}
      <Card className="p-6">
        <SectionHeader title="Schedule Calendar" subtitle="Monthly view with color-coded laundry groups and holiday markers" />
        <ScheduleCalendar
          schedules={data.schedules}
          holidays={data.holidays}
          onDateClick={handleCalendarClick}
        />
        {selectedDay && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm animate-[modalIn_150ms_ease-out]">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-900">{fmtDate(selectedDay.dateStr)}</p>
              <button type="button" onClick={() => setSelectedDay(null)} className="text-xs text-slate-400 hover:text-slate-600">✕</button>
            </div>
            {selectedDay.hol ? (
              <p className="mt-1 text-rose-600">🏖️ Holiday — {selectedDay.hol.reason}</p>
            ) : selectedDay.sched ? (
              <div className="mt-1 space-y-0.5 text-slate-600">
                <p><strong>Group:</strong> {selectedDay.sched.group?.name}</p>
                <p><strong>Rooms:</strong> {selectedDay.sched.group?.roomRangeStart}–{selectedDay.sched.group?.roomRangeEnd}</p>
                <p><strong>Time:</strong> {selectedDay.sched.startTime}–{selectedDay.sched.endTime}</p>
                <p><strong>Status:</strong> {cap(selectedDay.sched.status)}</p>
              </div>
            ) : (
              <p className="mt-1 text-slate-400">No schedule or holiday on this date.</p>
            )}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <SectionHeader title="Upcoming laundry days" subtitle="Schedule list view" />
        <Table
          columns={COLUMNS}
          rows={data.schedules.filter((s) => s.scheduleDate >= today)}
          empty="No schedule found. Generate one above."
          render={(s, key) => {
            switch (key) {
              case "date": return <span className={s.scheduleDate === today ? "font-semibold text-indigo-700" : ""}>{fmtDate(s.scheduleDate)}{s.scheduleDate === today ? " · today" : ""}</span>;
              case "group": return s.group?.name;
              case "rooms": return `${s.group?.roomRangeStart}–${s.group?.roomRangeEnd}`;
              case "time": return `${s.startTime}–${s.endTime}`;
              case "status": return <StatusPill status={cap(s.status)} />;
              default: return null;
            }
          }}
        />
      </Card>
    </div>
  );
}
