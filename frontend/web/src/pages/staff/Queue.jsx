import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ClipboardList, PackageOpen, RefreshCw, Shirt, Truck } from "lucide-react";
import { Button, Card, ErrorBanner, SectionHeader, Spinner, StatCard, StatusPill, Table, toast } from "../../components/ui.jsx";
import { get, patch } from "../../lib/api.js";
import { useLoad } from "../../lib/useLoad.js";
import { STATUS_LABEL, fmtDate, fmtDateTime } from "../../lib/util.js";
import { clothSummary } from "../../lib/laundry.js";
import { useAuth } from "../../auth/AuthContext.jsx";

const COLUMNS = [
  { key: "student", label: "Student" },
  { key: "room", label: "Room" },
  { key: "items", label: "Items" },
  { key: "submitted", label: "Submitted" },
  { key: "status", label: "Status" },
  { key: "action", label: "", align: "right" },
];

export default function Queue() {
  const { user } = useAuth();
  const base = `/${user.role}`;
  const { data, error, loading, retry, reload } = useLoad(() => get("/laundry/today/queue"), [], { pollMs: 8000 });
  const [busyId, setBusyId] = useState(null);

  if (loading) return <Spinner />;
  if (error) return <ErrorBanner error={error} onRetry={retry} />;

  const { schedule, statistics: st, queue } = data;

  const markReady = async (rec) => {
    setBusyId(rec.id);
    try {
      await patch(`/laundry/${rec.id}/status`, { status: "ready_for_pickup" });
      toast(`${rec.student?.name || "Student"}'s laundry is ready for pickup. They have been notified.`);
      await reload();
    } catch (e) {
      toast(e.message, "danger");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5" data-testid="today-banner">
        {schedule ? (
          <div>
            <p className="text-sm text-slate-500">Today · {fmtDate(schedule.scheduleDate)}</p>
            <p className="text-lg font-semibold text-slate-900">
              {schedule.group?.name} <span className="text-sm font-normal text-slate-500">· rooms {schedule.group?.roomRangeStart}–{schedule.group?.roomRangeEnd} · {schedule.startTime}–{schedule.endTime}</span>
            </p>
          </div>
        ) : (
          <div>
            <p className="text-lg font-semibold text-slate-900">No laundry scheduled today</p>
            <p className="text-sm text-slate-500">Ask an administrator to generate the schedule.</p>
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={reload}><RefreshCw size={14} /> Refresh</Button>
          {user.role === "staff" && schedule && <Link to={`${base}/scan`}><Button size="sm"><Shirt size={14} /> Open scanner</Button></Link>}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Submitted today" value={st.submitted} sub={`~${st.expectedStudents} expected`} icon={ClipboardList} />
        <StatCard label="Received (washing)" value={st.received} icon={Shirt} tint="amber" />
        <StatCard label="Ready for pickup" value={st.readyForPickup} icon={PackageOpen} tint="emerald" />
        <StatCard label="Delivered" value={st.delivered} icon={Truck} tint="slate" />
      </div>

      <Card className="p-6">
        <SectionHeader title="Today's submissions" subtitle="Move bags along as they are ready; hand over from the Smart Scanner" />
        <Table
          columns={COLUMNS}
          rows={queue}
          empty={schedule ? "No laundry submitted yet today." : "Nothing to show — no schedule today."}
          render={(r, key) => {
            switch (key) {
              case "student": return (<div><p className="font-medium text-slate-900">{r.student?.name}</p><p className="text-xs text-slate-400">{r.student?.studentId}</p></div>);
              case "room": return r.student?.room?.roomNumber || "—";
              case "items": return clothSummary(r.clothDetails);
              case "submitted": return fmtDateTime(r.submittedAt);
              case "status": return <StatusPill status={STATUS_LABEL[r.status]} />;
              case "action":
                if (r.status === "received") {
                  return (
                    <Button size="sm" loading={busyId === r.id} onClick={() => markReady(r)}>
                      <CheckCircle2 size={14} /> Mark ready
                    </Button>
                  );
                }
                if (r.status === "ready_for_pickup" && user.role === "staff") {
                  return <Link to={`${base}/scan`} className="text-sm font-medium text-indigo-600 hover:text-indigo-700">Hand over →</Link>;
                }
                return null;
              default: return null;
            }
          }}
        />
      </Card>
    </div>
  );
}
