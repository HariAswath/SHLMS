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

import { useAuth } from "../../auth/AuthContext.jsx";

export default function StudentOverview() {
  const { user } = useAuth();
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

  const studentRoom = sched.student?.room || user?.room?.roomNumber;
  const studentHostel = sched.student?.hostel || user?.hostel?.name;
  const studentFloor = sched.student?.floor || user?.floor?.name;

  const isHolidayToday = Boolean(today.isHoliday || sched.todayHoliday);
  const holidayReason = today.holiday?.reason || sched.todayHoliday?.reason;

  let todayText = "No laundry today";
  let todaySub = "Check upcoming dates below";
  if (isHolidayToday) {
    todayText = "Holiday";
    todaySub = `${holidayReason || "Announced Holiday"} — No collection today`;
  } else if (sched.isScheduledToday) {
    todayText = "Your group is on";
    todaySub = "Bring your clothes to the laundry counter";
  } else if (today.schedule?.group) {
    todaySub = `Today is ${today.schedule.group.name}`;
  }

  return (
    <div className="space-y-6">
      {/* Holiday Announcement Alert Banner */}
      {isHolidayToday && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-900">
          <span className="text-2xl">🏖️</span>
          <div>
            <p className="font-semibold text-rose-950">
              Today is an Announced Holiday ({holidayReason || "Hostel Holiday"})
            </p>
            <p className="text-xs text-rose-800">
              Laundry collection is paused today. Your next laundry day has been automatically removed from today and shifted to{" "}
              <strong>{sched.nextScheduleDate ? fmtDate(sched.nextScheduleDate) : "the next working day"}</strong>.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Your laundry group"
          value={group ? group.name : (studentRoom ? "Group Pending" : "Not assigned")}
          sub={
            studentRoom
              ? `Room ${studentRoom} • ${studentHostel || "Hostel"}`
              : "Room assignment pending"
          }
          icon={Users}
        />
        <StatCard
          label="Today"
          value={todayText}
          sub={todaySub}
          icon={CalendarCheck}
          tint={isHolidayToday ? "rose" : sched.isScheduledToday ? "emerald" : "slate"}
        />
        <StatCard
          label="Next laundry day"
          value={sched.nextScheduleDate ? fmtDate(sched.nextScheduleDate) : "—"}
          sub={
            sched.nextScheduleDate
              ? isHolidayToday
                ? "Shifted after holiday"
                : group
                ? `For ${group.name}`
                : "For your group"
              : group
              ? "No upcoming date scheduled"
              : "Awaiting admin group creation"
          }
          icon={CalendarDays}
          tint="amber"
        />
        <StatCard
          label="Current status"
          value={current ? STATUS_LABEL[current.status] : "Nothing submitted"}
          sub={current ? clothSummary(current.clothDetails) : "Submit at the counter on your day"}
          icon={PackageCheck}
          tint="emerald"
        />
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
          {sched.student?.barcodeValue || user?.barcodeValue ? (
            <>
              <div className="mx-auto inline-block rounded-xl border border-slate-200 bg-white p-3">
                <QRCodeSVG value={sched.student?.barcodeValue || user?.barcodeValue} size={168} />
              </div>
              <p className="mt-3 font-mono text-xs text-slate-500" data-testid="my-barcode">
                {sched.student?.barcodeValue || user?.barcodeValue}
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-xs">
                <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700">
                  Room {studentRoom || "Unassigned"}
                </span>
                {studentHostel && (
                  <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">
                    {studentHostel} {studentFloor ? `(${studentFloor})` : ""}
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="py-8 text-sm text-slate-400">No QR assigned yet. Contact the hostel office.</p>
          )}
        </Card>
      </div>

      <Card className="p-6">
        <SectionHeader
          title="Upcoming laundry days"
          subtitle={group ? `${group.name} schedule (holidays excluded & shifted)` : undefined}
        />
        {sched.upcomingSchedules?.length ? (
          <ul className="divide-y divide-slate-100">
            {sched.upcomingSchedules.map((s, idx) => (
              <li key={s.id} className="flex items-center justify-between py-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${idx === 0 ? "font-semibold text-indigo-700" : "text-slate-800"}`}>
                    {fmtDate(s.scheduleDate)}
                  </span>
                  {idx === 0 && (
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                      Next up
                    </span>
                  )}
                </div>
                <span className="text-slate-500">{s.startTime}–{s.endTime}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-slate-400">
            {group ? "No upcoming laundry days have been scheduled yet." : "Laundry group has not been configured by administration yet."}
          </p>
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
