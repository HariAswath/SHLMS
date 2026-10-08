import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Inbox, Loader2, X, XCircle } from "lucide-react";
import { classNames } from "../lib/util.js";

export function Card({ children, className = "", ...rest }) {
  return (
    <div
      className={classNames("rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]", className)}
      {...rest}
    >
      {children}
    </div>
  );
}

const BUTTON_STYLES = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm disabled:bg-indigo-300",
  secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 disabled:text-slate-300",
  ghost: "text-slate-600 hover:bg-slate-100 disabled:text-slate-300",
  danger: "bg-white text-rose-600 border border-rose-200 hover:bg-rose-50",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm disabled:bg-emerald-300",
};

export function Button({ children, variant = "primary", size = "md", loading = false, className = "", disabled, ...props }) {
  const sizes = { sm: "px-2.5 py-1.5 text-xs gap-1.5", md: "px-4 py-2 text-sm gap-2" };
  return (
    <button
      disabled={disabled || loading}
      className={classNames(
        "inline-flex items-center justify-center rounded-lg font-medium transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-not-allowed",
        sizes[size], BUTTON_STYLES[variant], className,
      )}
      {...props}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

const PILL_STYLES = {
  Scheduled: "bg-slate-100 text-slate-600",
  Received: "bg-indigo-50 text-indigo-700",
  "Ready for Pickup": "bg-emerald-50 text-emerald-700",
  Delivered: "bg-emerald-100 text-emerald-700",
  Active: "bg-emerald-50 text-emerald-700",
  Completed: "bg-emerald-50 text-emerald-700",
  Cancelled: "bg-rose-50 text-rose-700",
};

export function StatusPill({ status, className = "" }) {
  return (
    <span
      className={classNames(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
        PILL_STYLES[status] || "bg-slate-100 text-slate-600", className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}

const TINTS = {
  indigo: "bg-indigo-50 text-indigo-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  rose: "bg-rose-50 text-rose-600",
  slate: "bg-slate-100 text-slate-500",
};

export function StatCard({ label, value, sub, icon: Icon, tint = "indigo" }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-slate-500">{label}</p>
          <p className="mt-1.5 text-xl font-semibold leading-snug text-slate-900">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
        </div>
        <div className={classNames("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", TINTS[tint])}>
          <Icon size={18} />
        </div>
      </div>
    </Card>
  );
}

export function SectionHeader({ title, subtitle, action, className = "" }) {
  return (
    <div className={classNames("mb-5 flex flex-wrap items-start justify-between gap-3", className)}>
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, hint }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon size={18} />
      </div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function Spinner({ label = "Loading…" }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400" role="status">
      <Loader2 size={16} className="animate-spin" /> {label}
    </div>
  );
}

export function ErrorBanner({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <p className="flex-1">{error.message || String(error)}</p>
      {onRetry && (
        <button onClick={onRetry} className="font-medium underline underline-offset-2">Retry</button>
      )}
    </div>
  );
}

export function Table({ columns, rows, render, empty = "Nothing here yet.", rowKey = (r, i) => r.id ?? i }) {
  if (!rows.length) return <EmptyState title={empty} />;
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={classNames("px-4 py-3 font-medium", c.align === "right" && "text-right")}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={rowKey(row, i)} className="transition-colors hover:bg-slate-50/70">
              {columns.map((c) => (
                <td key={c.key} className={classNames("px-4 py-3 align-middle text-slate-700", c.align === "right" && "text-right")}>
                  {render(row, c.key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const FIELD_CLASS =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 " +
  "focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";

export function Field({ label, hint, error, children, className = "" }) {
  return (
    <label className={classNames("block", className)}>
      <span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span>
      {children}
      {error
        ? <span className="mt-1 block text-xs text-rose-600">{error}</span>
        : hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export const Input = (props) => <input {...props} className={classNames(FIELD_CLASS, props.className)} />;

// Minimal toast system (module-level store so any component can call toast()).
let toastId = 0;
let listeners = [];
let toasts = [];
const emit = () => listeners.forEach((l) => l(toasts));
export function toast(text, tone = "success") {
  const id = ++toastId;
  toasts = [...toasts, { id, text, tone }];
  emit();
  setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); emit(); }, 5000);
}

const TOAST_TONES = {
  success: { icon: CheckCircle2, cls: "text-emerald-600" },
  danger: { icon: XCircle, cls: "text-rose-600" },
};

export function ToastHost() {
  const [items, setItems] = useState(toasts);
  useEffect(() => {
    listeners.push(setItems);
    return () => { listeners = listeners.filter((l) => l !== setItems); };
  }, []);
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[min(360px,calc(100vw-2.5rem))] flex-col gap-2" aria-live="polite">
      {items.map((t) => {
        const tone = TOAST_TONES[t.tone] || TOAST_TONES.success;
        const Icon = tone.icon;
        return (
          <div key={t.id} className="pointer-events-auto flex animate-[toastIn_180ms_ease-out] items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
            <Icon size={17} className={classNames("mt-0.5 shrink-0", tone.cls)} />
            <p className="flex-1 text-sm text-slate-700">{t.text}</p>
            <button onClick={() => { toasts = toasts.filter((x) => x.id !== t.id); emit(); }} className="text-slate-300 hover:text-slate-500" aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
