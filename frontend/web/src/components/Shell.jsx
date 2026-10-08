import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell, LogOut, Menu, ShieldCheck, Shirt } from "lucide-react";
import { useAuth } from "../auth/AuthContext.jsx";
import { get, patch } from "../lib/api.js";
import { useLoad } from "../lib/useLoad.js";
import { classNames, fmtDateTime, initials } from "../lib/util.js";
import { EmptyState } from "./ui.jsx";

function NotificationBell() {
  const { data, reload } = useLoad(() => get("/notifications"), [], { pollMs: 15000 });
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const list = data?.notifications || [];
  const unread = data?.unreadCount || 0;

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const markAll = async () => {
    try { await patch("/notifications/read-all"); } catch { /* ignore */ }
    reload();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen((o) => !o); reload(); }}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span data-testid="unread-count" className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            <button onClick={markAll} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">Mark all read</button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {list.length === 0 && <EmptyState icon={Bell} title="No notifications yet" />}
            {list.map((n) => (
              <div key={n.id} className="flex gap-3 border-b border-slate-50 px-4 py-3 last:border-0">
                <span className={classNames("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", n.isRead ? "bg-slate-300" : "bg-indigo-500")} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{n.title}</p>
                  <p className="text-sm leading-snug text-slate-600">{n.message}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{fmtDateTime(n.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const ROLE_LABEL = { student: "Student", staff: "Laundry Staff", admin: "Administrator" };

export function Shell({ navItems }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = navItems.find((n) => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)));

  const doLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const nav = (
    <>
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white"><Shirt size={16} /></div>
        <div>
          <p className="text-sm font-semibold text-slate-900">SHLMS</p>
          <p className="text-[11px] text-slate-400">Hostel Laundry System</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => classNames(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50",
              )}
            >
              <Icon size={17} />
              <span className="flex-1 text-left">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="border-t border-slate-100 p-3">
        <button onClick={doLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50">
          <LogOut size={17} className="text-slate-400" /> Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">{nav}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex h-full w-64 flex-col border-r border-slate-200 bg-white">{nav}</aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-8 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 lg:hidden" aria-label="Open navigation">
              <Menu size={17} />
            </button>
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-indigo-700">
                <ShieldCheck size={11} /> {ROLE_LABEL[user.role]}
              </span>
              <h1 className="mt-1 truncate text-lg font-semibold text-slate-900 sm:text-xl">{current?.label}</h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <NotificationBell />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-800" data-testid="user-name">{user.name}</p>
              <p className="text-[11px] text-slate-400">
                {user.role === "student" && user.room?.roomNumber
                  ? `Room ${user.room.roomNumber}${user.hostel?.name ? ` • ${user.hostel.name}` : ""}`
                  : ROLE_LABEL[user.role]}
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
              {initials(user.name)}
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-8 sm:py-7"><Outlet /></main>
      </div>
    </div>
  );
}
