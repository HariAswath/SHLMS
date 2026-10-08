import { useState } from "react";
import { CalendarClock, CalendarDays, CalendarOff, Layers, Plus, Trash2 } from "lucide-react";
import { Button, Card, ErrorBanner, Field, Input, SectionHeader, Spinner, StatCard, StatusPill, Table, toast } from "../../components/ui.jsx";
import { ScheduleCalendar } from "../../components/ScheduleCalendar.jsx";
import { del, get, patch, post } from "../../lib/api.js";
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

function GroupModal({ group, hostelId, isOpen, onClose, onSuccess }) {
  const isEdit = Boolean(group);
  const isExistingSpecific = Boolean(group?.roomRangeStart && group.roomRangeStart.includes(","));

  const [name, setName] = useState(group?.name || "");
  const [groupOrder, setGroupOrder] = useState(group?.groupOrder || 1);
  const [mode, setMode] = useState(isExistingSpecific ? "specific" : "range");
  const [roomRangeStart, setRoomRangeStart] = useState(group?.roomRangeStart || "");
  const [roomRangeEnd, setRoomRangeEnd] = useState(group?.roomRangeEnd || "");
  const [specificRooms, setSpecificRooms] = useState(
    isExistingSpecific ? group?.roomRangeStart : (group?.roomRangeStart || "")
  );
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);

    const startVal = mode === "specific" ? specificRooms.trim() : roomRangeStart.trim();
    const endVal =
      mode === "specific"
        ? specificRooms.trim()
        : (roomRangeEnd.trim() || roomRangeStart.trim());

    if (!startVal) {
      toast("Please specify room numbers for this group", "danger");
      setBusy(false);
      return;
    }

    try {
      if (isEdit) {
        await patch(`/laundry-groups/${group.id}`, {
          name: name.trim(),
          groupOrder: Number(groupOrder),
          roomRangeStart: startVal,
          roomRangeEnd: endVal,
        });
        toast(`Laundry group '${name}' updated successfully.`);
      } else {
        await post("/laundry-groups", {
          hostelId: hostelId || 1,
          name: name.trim(),
          groupOrder: Number(groupOrder),
          roomRangeStart: startVal,
          roomRangeEnd: endVal,
        });
        toast(`Laundry group '${name}' created successfully.`);
      }
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast(err.message, "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <Card className="w-full max-w-md p-6 animate-[modalIn_150ms_ease-out]">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {isEdit ? "Edit Laundry Group & Rooms" : "Create New Laundry Group"}
            </h3>
            <p className="text-xs text-slate-500">Define group rotation and assigned room number(s)</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Group Name">
              <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Group 1" />
            </Field>
            <Field label="Rotation Order #">
              <Input type="number" required min={1} value={groupOrder} onChange={(e) => setGroupOrder(e.target.value)} />
            </Field>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Room Numbers Assignment</label>
            <div className="mt-1.5 flex gap-2">
              <button
                type="button"
                onClick={() => setMode("range")}
                className={`flex-1 rounded-lg border py-2 text-xs font-medium transition ${
                  mode === "range"
                    ? "border-indigo-600 bg-indigo-50/50 text-indigo-700 font-semibold"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Room Range (e.g. 101–150)
              </button>
              <button
                type="button"
                onClick={() => setMode("specific")}
                className={`flex-1 rounded-lg border py-2 text-xs font-medium transition ${
                  mode === "specific"
                    ? "border-indigo-600 bg-indigo-50/50 text-indigo-700 font-semibold"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Specific Rooms (e.g. 101, 102)
              </button>
            </div>
          </div>

          {mode === "range" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Starting Room">
                <Input required value={roomRangeStart} onChange={(e) => setRoomRangeStart(e.target.value)} placeholder="e.g. 101" />
              </Field>
              <Field label="Ending Room">
                <Input required value={roomRangeEnd} onChange={(e) => setRoomRangeEnd(e.target.value)} placeholder="e.g. 150" />
              </Field>
            </div>
          ) : (
            <Field label="Room Number(s)">
              <Input
                required
                value={specificRooms}
                onChange={(e) => setSpecificRooms(e.target.value)}
                placeholder="e.g. 101, 102, 103 (or single room: 101)"
              />
              <p className="mt-1 text-[11px] text-slate-400">Separate multiple room numbers with commas.</p>
            </Field>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" loading={busy}>{isEdit ? "Save Changes" : "Create Group"}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default function AdminSchedule() {
  const today = todayUtc();
  const { data, error, loading, retry, reload } = useLoad(async () => {
    const [sched, todayRes, hol, groupsRes, hostelsRes] = await Promise.all([
      get("/schedules", { startDate: addDaysUtc(today, -30), endDate: addDaysUtc(today, 60), limit: 200 }),
      get("/schedules/today"),
      get("/schedules/holidays"),
      get("/laundry-groups"),
      get("/hostels").catch(() => ({ hostels: [] })),
    ]);
    return {
      schedules: sched.schedules,
      today: todayRes,
      holidays: hol.holidays,
      groups: groupsRes.groups || [],
      hostels: hostelsRes.hostels || [],
    };
  }, []);

  const [range, setRange] = useState({ startDate: today, endDate: addDaysUtc(today, 13) });
  const [generating, setGenerating] = useState(false);
  const [holiday, setHoliday] = useState({ date: "", reason: "" });
  const [addingHoliday, setAddingHoliday] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);

  const handleCalendarClick = (dateStr, sched, hol) => {
    setSelectedDay({ dateStr, sched, hol });
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorBanner error={error} onRetry={retry} />;

  const generate = async (e) => {
    e.preventDefault();
    if (!data.groups || data.groups.length === 0) {
      toast("Please create at least one laundry group before generating schedules.", "danger");
      return;
    }
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

  const handleDeleteGroup = async (g) => {
    if (!window.confirm(`Are you sure you want to delete '${g.name}'? All schedules associated with this group will also be removed.`)) {
      return;
    }
    try {
      await del(`/laundry-groups/${g.id}`);
      toast(`Laundry group '${g.name}' deleted.`);
      await reload();
    } catch (err) {
      toast(err.message, "danger");
    }
  };

  const handleClearAllGroups = async () => {
    if (!window.confirm("Are you sure you want to delete ALL laundry groups? This will remove all group configurations and schedules.")) {
      return;
    }
    try {
      await del("/laundry-groups/all");
      toast("All laundry groups removed successfully.");
      await reload();
    } catch (err) {
      toast(err.message, "danger");
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

  const handleDeleteHoliday = async (h) => {
    if (!window.confirm(`Delete holiday on ${fmtDate(h.date)} (${h.reason})?`)) return;
    try {
      await del(`/schedules/holidays/${h.id}`);
      toast("Holiday removed.");
      await reload();
    } catch (err) {
      toast(err.message, "danger");
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
        <StatCard label="Configured Laundry Groups" value={data.groups.length} icon={Layers} />
        <StatCard label="Upcoming holidays" value={upcomingHolidays.length} icon={CalendarOff} tint="amber" />
      </div>

      {/* Admin Laundry Groups Management */}
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Laundry Groups & Assigned Rooms</h3>
            <p className="text-xs text-slate-500">
              Admin creates groups and assigns room numbers to each group. Groups are not predefined.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {data.groups.length > 0 && (
              <Button size="sm" variant="danger" onClick={handleClearAllGroups}>
                <Trash2 size={14} /> Clear All Groups
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => {
                setEditingGroup(null);
                setGroupModalOpen(true);
              }}
            >
              <Plus size={15} /> New Group
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <Table
            columns={[
              { key: "order", label: "Rotation #" },
              { key: "name", label: "Group Name" },
              { key: "rooms", label: "Assigned Room(s)" },
              { key: "hostel", label: "Hostel Block" },
              { key: "status", label: "Status" },
              { key: "action", label: "Actions", align: "right" },
            ]}
            rows={data.groups}
            empty="No laundry groups configured yet. Groups are not predefined—click '+ New Group' to create one."
            render={(g, key) => {
              switch (key) {
                case "order":
                  return <span className="font-semibold text-indigo-700">#{g.groupOrder}</span>;
                case "name":
                  return <span className="font-medium text-slate-900">{g.name}</span>;
                case "rooms": {
                  const isComma = g.roomRangeStart?.includes(",");
                  const isSingle = g.roomRangeStart === g.roomRangeEnd;
                  const text = isComma
                    ? `Rooms: ${g.roomRangeStart}`
                    : isSingle
                    ? `Room ${g.roomRangeStart}`
                    : `Rooms ${g.roomRangeStart} – ${g.roomRangeEnd}`;
                  return (
                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800">
                      {text}
                    </span>
                  );
                }
                case "hostel":
                  return <span className="text-xs text-slate-600">{g.hostel?.name || "D Block"}</span>;
                case "status":
                  return <StatusPill status={g.status === "active" ? "Active" : "Cancelled"} />;
                case "action":
                  return (
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditingGroup(g);
                          setGroupModalOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <button
                        type="button"
                        title="Delete Group"
                        onClick={() => handleDeleteGroup(g)}
                        className="rounded-md p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                default:
                  return null;
              }
            }}
          />
        </div>
      </Card>

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
                  <div>
                    <span className="font-medium text-slate-800">{fmtDate(h.date)}</span>
                    <span className="ml-2 text-slate-500">{h.reason}</span>
                  </div>
                  <button
                    type="button"
                    title="Delete holiday"
                    onClick={() => handleDeleteHoliday(h)}
                    className="rounded p-1 text-slate-400 hover:text-rose-600 transition"
                  >
                    <Trash2 size={14} />
                  </button>
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

      <GroupModal
        group={editingGroup}
        hostelId={data.hostels?.[0]?.id || 1}
        isOpen={groupModalOpen}
        onClose={() => {
          setGroupModalOpen(false);
          setEditingGroup(null);
        }}
        onSuccess={reload}
      />
    </div>
  );
}
