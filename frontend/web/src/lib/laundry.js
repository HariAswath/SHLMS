import { fmtDateTime } from "./util.js";

// The record a student cares about right now: newest not-yet-delivered, else the newest delivered.
export function pickCurrent(records = []) {
  return records.find((r) => r.status !== "delivered") || records[0] || null;
}

export function timelineOf(record) {
  if (!record) return {};
  return {
    received: fmtDateTime(record.submittedAt),
    ready_for_pickup: record.readyAt ? fmtDateTime(record.readyAt) : "",
    delivered: record.deliveredAt ? fmtDateTime(record.deliveredAt) : "",
  };
}

export function clothSummary(details) {
  const entries = Object.entries(details || {}).filter(([, n]) => n > 0);
  if (!entries.length) return "—";
  return entries.map(([k, n]) => `${n} ${k}`).join(", ");
}

export const clothTotal = (details) =>
  Object.values(details || {}).reduce((s, n) => s + (Number(n) || 0), 0);
