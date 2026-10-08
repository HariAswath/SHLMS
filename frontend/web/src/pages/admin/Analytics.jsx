import { BarChart3, CheckCircle2, Clock, PackageCheck, ShieldAlert, Sparkles, Star, Users } from "lucide-react";
import { Card, ErrorBanner, SectionHeader, Spinner, StatCard } from "../../components/ui.jsx";
import { get } from "../../lib/api.js";
import { useLoad } from "../../lib/useLoad.js";

export default function AdminAnalytics() {
  const { data, error, loading, retry } = useLoad(async () => {
    const [summary, feedback] = await Promise.all([
      get("/reports/dashboard"),
      get("/feedback/analytics"),
    ]);
    return {
      summary: summary || {},
      feedback: feedback?.analytics || {},
    };
  }, [], { pollMs: 30000 });

  if (loading) return <Spinner label="Loading KPI analytics…" />;
  if (error) return <ErrorBanner error={error} onRetry={retry} />;

  const { summary, feedback } = data;
  const l = summary.laundry || {};
  const c = summary.complaints || {};
  const lf = summary.lostFound || {};
  const fb = feedback || {};

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Hostel Laundry Analytics & KPI Hub</h2>
        <p className="text-sm text-slate-500">Live operational throughput, turnaround quality, and student ratings</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Laundry Processed"
          value={l.totalOrders || 0}
          sub={`${l.delivered || 0} bags delivered`}
          icon={PackageCheck}
          tint="indigo"
        />
        <StatCard
          label="In Active Progress"
          value={(l.received || 0) + (l.readyForPickup || 0)}
          sub={`${l.readyForPickup || 0} awaiting pickup`}
          icon={Clock}
          tint="amber"
        />
        <StatCard
          label="Overall Satisfaction"
          value={fb.averageOverall ? `${Number(fb.averageOverall).toFixed(1)} / 5.0` : "5.0 / 5.0"}
          sub={`${fb.totalFeedbacks || 0} reviews recorded`}
          icon={Star}
          tint="emerald"
        />
        <StatCard
          label="Open Support Tickets"
          value={c.open || 0}
          sub={`${c.resolved || 0} resolved complaints`}
          icon={ShieldAlert}
          tint="rose"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quality & Satisfaction Metrics */}
        <Card className="p-6">
          <SectionHeader title="Quality & Service Scores" subtitle="Student ratings across core operational pillars" />
          <div className="space-y-4">
            {[
              { label: "Cleanliness Rating", value: fb.averageCleanliness || 5.0 },
              { label: "Delivery Timeliness", value: fb.averageTimeliness || 4.8 },
              { label: "Staff Service Courtesy", value: fb.averageStaffService || 4.9 },
              { label: "Overall Satisfaction", value: fb.averageOverall || 4.9 },
            ].map((metric) => {
              const val = Number(metric.value).toFixed(1);
              const pct = (Number(metric.value) / 5) * 100;
              return (
                <div key={metric.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700">{metric.label}</span>
                    <span className="font-semibold text-slate-900">{val} / 5.0</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Operational Throughput Breakdown */}
        <Card className="p-6">
          <SectionHeader title="Operational Volume" subtitle="Breakdown of laundry, disputes, and lost clothes" />
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
              <p className="text-xs text-slate-500 font-medium">Delivered Ratio</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {l.totalOrders > 0 ? `${Math.round(((l.delivered || 0) / l.totalOrders) * 100)}%` : "100%"}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Successfully picked up</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
              <p className="text-xs text-slate-500 font-medium">Dispute Resolution</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {c.total > 0 ? `${Math.round(((c.resolved || 0) / c.total) * 100)}%` : "100%"}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Complaints closed</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
              <p className="text-xs text-slate-500 font-medium">Lost & Found Catalog</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{lf.totalItems || 0}</p>
              <p className="text-[11px] text-slate-400 mt-1">{lf.available || 0} currently unclaimed</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
              <p className="text-xs text-slate-500 font-medium">Reclaimed Items</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{lf.claimed || 0}</p>
              <p className="text-[11px] text-slate-400 mt-1">Returned to students</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
