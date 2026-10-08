import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { CalendarCheck, CalendarDays, PackageCheck, Users } from "lucide-react";
import { Card, ErrorBanner, SectionHeader, Spinner, StatCard, StatusPill } from "../../components/ui.jsx";
import { LaundryStepper } from "../../components/LaundryStepper.jsx";
import { FeedbackModal } from "../../components/FeedbackModal.jsx";
import { get } from "../../lib/api.js";
import { useLoad } from "../../lib/useLoad.js";
import { STATUS_LABEL, fmtDate } from "../../lib/util.js";
import { clothSummary, pickCurrent, timelineOf } from "../../lib/laundry.js";

export default function StudentOverview() {
  const [feedbackTarget, setFeedbackTarget] = useState(null);

  const { data, error, loading, retry, reload } = useLoad(async () => {
    const [sched, laundry, today, feedbackRes] = await Promise.all([
      get("/schedules/my"),
      get("/laundry/my"),
      get("/schedules/today"),
      get("/feedback/my-feedback").catch(() => ({ feedbacks: [] })),
    ]);
    return {
      sched,
      records: laundry.records,
      today,
      feedbacks: feedbackRes.feedbacks || feedbackRes || [],
    };
  }, [], { pollMs: 10000 });

  // Auto-prompt feedback for delivered-but-unrated laundry
  useEffect(() => {
    if (!data) return;
    const { records, feedbacks } = data;

    // Set of laundryIds that already have feedback
    const ratedIds = new Set(
      (Array.isArray(feedbacks) ? feedbacks : []).map((f) => f.laundryId)
    );

    // Find delivered records without feedback, newest first
    const unrated = records.find(
      (r) => r.status === "delivered" && !ratedIds.has(r.id)
    );

    if (unrated) {
      // Only auto-prompt once per session per laundry ID
      const dismissKey = `feedback-dismissed-${unrated.id}`;
      if (!sessionStorage.getItem(dismissKey)) {
        setFeedbackTarget(unrated);
      }
    }
  }, [data]);

  const handleFeedbackClose = () => {
    if (feedbackTarget) {
      // Mark as dismissed for this session so we don't re-prompt
      sessionStorage.setItem(`feedback-dismissed-${feedbackTarget.id}`, "1");
    }
    setFeedbackTarget(null);
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorBanner error={error} onRetry={retry} />;

  const { sched, records, today } = data;
  const current = pickCurrent(records);
  const group = sched.assignedGroup;
  const stepperState = current ? current.status : "scheduled";

  let todayText = "No laundry today";
  let todaySub = "Check upcoming dates below";
  if (today.isHoliday) { todayText = "Holiday"; todaySub = today.holiday?.reason; }
  else if (sched.isScheduledToday) { todayText = "Your group is on"; todaySub = "Bring your clothes to the laundry counter"; }
  else if (today.schedule?.group) { todaySub = `Today is ${today.schedule.group.name}`; }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Your laundry group" value={group ? group.name : "Not assigned"} sub={group ? `Rooms ${group.roomRangeStart}–${group.roomRangeEnd}` : "Room assignment pending"} icon={Users} />
        <StatCard label="Today" value={todayText} sub={todaySub} icon={CalendarCheck} tint={sched.isScheduledToday ? "emerald" : "slate"} />
        <StatCard label="Next laundry day" value={sched.nextScheduleDate ? fmtDate(sched.nextScheduleDate) : "—"} sub={sched.nextScheduleDate ? "For your group" : "No upcoming date scheduled"} icon={CalendarDays} tint="amber" />
        <StatCard label="Current status" value={current ? STATUS_LABEL[current.status] : "Nothing submitted"} sub={current ? clothSummary(current.clothDetails) : "Submit at the counter on your day"} icon={PackageCheck} tint="emerald" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <SectionHeader
            title="Laundry progress"
            subtitle={current ? `Submitted ${fmtDate(current.schedule?.scheduleDate)}` : "Your bag will show up here once staff record it"}
            action={current && <StatusPill status={STATUS_LABEL[current.status]} />}
          />
          <LaundryStepper current={stepperState} timeline={timelineOf(current)} />
          <div className="mt-5">
            <Link to="/student/track" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">Open full tracking →</Link>
          </div>
        </Card>

        <Card className="p-6 text-center" data-testid="my-qr">
          <SectionHeader title="My QR code" subtitle="Show this at the laundry counter" className="text-left" />
          {sched.student?.barcodeValue ? (
            <>
              <div className="mx-auto inline-block rounded-xl border border-slate-200 bg-white p-3">
                <QRCodeSVG value={sched.student.barcodeValue} size={168} />
              </div>
              <p className="mt-3 font-mono text-xs text-slate-500" data-testid="my-barcode">{sched.student.barcodeValue}</p>
            </>
          ) : (
            <p className="py-8 text-sm text-slate-400">No QR assigned yet. Contact the hostel office.</p>
          )}
        </Card>
      </div>

      <Card className="p-6">
        <SectionHeader title="Upcoming laundry days" subtitle={group ? `${group.name} schedule` : undefined} />
        {sched.upcomingSchedules?.length ? (
          <ul className="divide-y divide-slate-100">
            {sched.upcomingSchedules.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-3 text-sm">
                <span className="font-medium text-slate-800">{fmtDate(s.scheduleDate)}</span>
                <span className="text-slate-500">{s.startTime}–{s.endTime}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-slate-400">No upcoming laundry days have been scheduled yet.</p>
        )}
      </Card>

      {/* Auto-prompted feedback modal for delivered-but-unrated laundry */}
      <FeedbackModal
        laundry={feedbackTarget}
        isOpen={Boolean(feedbackTarget)}
        onClose={handleFeedbackClose}
        onSuccess={() => { handleFeedbackClose(); reload(); }}
      />
    </div>
  );
}
