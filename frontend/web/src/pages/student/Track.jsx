import { PackageOpen } from "lucide-react";
import { Card, EmptyState, ErrorBanner, SectionHeader, Spinner, StatusPill } from "../../components/ui.jsx";
import { LaundryStepper } from "../../components/LaundryStepper.jsx";
import { get } from "../../lib/api.js";
import { useLoad } from "../../lib/useLoad.js";
import { STATUS_LABEL, fmtDate } from "../../lib/util.js";
import { clothSummary, clothTotal, pickCurrent, timelineOf } from "../../lib/laundry.js";

export default function StudentTrack() {
  const { data, error, loading, retry } = useLoad(() => get("/laundry/my"), [], { pollMs: 10000 });
  if (loading) return <Spinner />;
  if (error) return <ErrorBanner error={error} onRetry={retry} />;

  const current = pickCurrent(data.records);
  if (!current) {
    return (
      <Card>
        <EmptyState icon={PackageOpen} title="No laundry submitted yet" hint="When staff record your bag on your group's laundry day, you can follow it here." />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <SectionHeader
          title={`Laundry #${current.id}`}
          subtitle={`Submitted on ${fmtDate(current.schedule?.scheduleDate)} · ${current.schedule?.group?.name || ""}`}
          action={<StatusPill status={STATUS_LABEL[current.status]} />}
        />
        <LaundryStepper current={current.status} timeline={timelineOf(current)} />
        {current.status === "ready_for_pickup" && (
          <p className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">
            Your laundry is ready. Show your QR code at the counter to collect it.
          </p>
        )}
        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-3">
          <div><dt className="text-slate-500">Items</dt><dd className="mt-0.5 font-medium text-slate-900">{clothTotal(current.clothDetails)} ({clothSummary(current.clothDetails)})</dd></div>
          <div><dt className="text-slate-500">Received by</dt><dd className="mt-0.5 font-medium text-slate-900">{current.staff?.name || "—"}</dd></div>
          <div><dt className="text-slate-500">Laundry group</dt><dd className="mt-0.5 font-medium text-slate-900">{current.schedule?.group?.name || "—"}</dd></div>
        </dl>
      </Card>
    </div>
  );
}
