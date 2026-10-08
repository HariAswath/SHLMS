// Thin fetch wrapper. Access token lives in memory only; the refresh token is an httpOnly cookie.
const BASE = "/api/v1";

let accessToken = null;
let onAuthLost = () => {};
let refreshing = null;

export const setAccessToken = (t) => { accessToken = t; };
export const setAuthLostHandler = (fn) => { onAuthLost = fn; };

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function raw(path, { method = "GET", body, query } = {}) {
  const qs = query
    ? "?" + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== "")).toString()
    : "";
  let res;
  try {
    res = await fetch(`${BASE}${path}${qs}`, {
      method,
      credentials: "include",
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Cannot reach the server. Is the backend running?", 0);
  }
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON body */ }
  return { res, json };
}

export async function refreshAccessToken() {
  if (!refreshing) {
    refreshing = raw("/auth/refresh", { method: "POST" })
      .then(({ res, json }) => {
        if (!res.ok) return null;
        accessToken = json.data.accessToken;
        return accessToken;
      })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

export async function api(path, opts = {}) {
  let { res, json } = await raw(path, opts);
  // Expired access token → one silent refresh, then retry.
  if ((res.status === 401 || res.status === 403) && !path.startsWith("/auth/") && accessToken !== null) {
    const fresh = await refreshAccessToken();
    if (fresh) ({ res, json } = await raw(path, opts));
    else { onAuthLost(); throw new ApiError("Your session has expired. Please sign in again.", 401, json); }
  }
  if (!res.ok || json?.success === false) {
    const details = Array.isArray(json?.errors) ? json.errors.map((e) => e.message).join("; ") : "";
    const base = json?.message || `Request failed (${res.status})`;
    throw new ApiError(details ? `${base}: ${details}` : base, res.status, json);
  }
  return json?.data ?? null;
}

export const get = (p, query) => api(p, { query });
export const post = (p, body) => api(p, { method: "POST", body });
export const patch = (p, body) => api(p, { method: "PATCH", body });
export const del = (p, query) => api(p, { method: "DELETE", query });
