import React from "react";
import { CalendarDays, CheckCircle2, PackageCheck, PackageOpen, Shirt } from "lucide-react";
import { classNames } from "../lib/util.js";

// Backend statuses: received → ready_for_pickup → delivered. "Scheduled" is the step before submission.
const STEPS = [
  { key: "scheduled", label: "Scheduled", icon: CalendarDays },
  { key: "received", label: "Received", icon: Shirt },
  { key: "ready_for_pickup", label: "Ready for Pickup", icon: PackageOpen },
  { key: "delivered", label: "Delivered", icon: PackageCheck },
];

export function LaundryStepper({ current = "scheduled", timeline = {} }) {
  const idx = Math.max(0, STEPS.findIndex((s) => s.key === current));
  const allDone = current === "delivered";
  return (
    <div className="overflow-x-auto pb-1" data-testid="stepper" data-current={current}>
      <div className="flex min-w-[480px] items-start">
        {STEPS.map((step, i) => {
          const done = i < idx || (allDone && i === idx);
          const active = i === idx && !allDone;
          const Icon = step.icon;
          return (
            <React.Fragment key={step.key}>
              <div className="flex flex-col items-center text-center" style={{ width: 96 }}>
                <div
                  className={classNames(
                    "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors",
                    done && "border-indigo-600 bg-indigo-600 text-white",
                    active && "border-indigo-600 bg-white text-indigo-600 ring-4 ring-indigo-100",
                    !done && !active && "border-slate-200 bg-white text-slate-300",
                  )}
                >
                  {done ? <CheckCircle2 size={17} /> : <Icon size={16} />}
                </div>
                <span className={classNames("mt-2 text-[11px] leading-tight", active ? "font-semibold text-slate-900" : "text-slate-500")}>
                  {step.label}
                </span>
                <span className="mt-0.5 text-[10px] text-slate-400">{timeline[step.key] || ""}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={classNames("mt-[17px] h-0.5 flex-1 rounded", i < idx ? "bg-indigo-600" : "bg-slate-200")} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
