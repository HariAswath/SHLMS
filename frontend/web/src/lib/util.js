export const classNames = (...a) => a.filter(Boolean).join(" ");

// The backend computes "today" in UTC, so the UI must use the same day.
export const todayUtc = () => new Date().toISOString().split("T")[0];

export const addDaysUtc = (dateStr, n) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split("T")[0];
};

export const fmtDate = (s) => {
  if (!s) return "—";
  const str = String(s);
  const d = new Date(str.length === 10 ? `${str}T00:00:00Z` : str);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};

export const fmtDateTime = (s) => {
  if (!s) return "—";
  return new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

export const STATUS_LABEL = {
  received: "Received",
  ready_for_pickup: "Ready for Pickup",
  delivered: "Delivered",
};

export const initials = (name = "") =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";

export const ROLE_HOME = { student: "/student", staff: "/staff", admin: "/admin" };
