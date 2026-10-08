import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  History,
  LayoutDashboard,
  PackageCheck,
  PackageSearch,
  ScanLine,
  ShieldAlert,
  Users,
} from "lucide-react";
import { useAuth } from "./auth/AuthContext.jsx";
import { Shell } from "./components/Shell.jsx";
import { Spinner } from "./components/ui.jsx";
import { ROLE_HOME } from "./lib/util.js";
import Login from "./pages/Login.jsx";
import StudentOverview from "./pages/student/Overview.jsx";
import StudentTrack from "./pages/student/Track.jsx";
import StudentHistory from "./pages/student/History.jsx";
import StudentLostFound from "./pages/student/LostFound.jsx";
import StudentComplaints from "./pages/student/Complaints.jsx";
import StaffQueue from "./pages/staff/Queue.jsx";
import StaffScanner from "./pages/staff/Scanner.jsx";
import StaffLostFound from "./pages/staff/LostFound.jsx";
import AdminSchedule from "./pages/admin/Schedule.jsx";
import AdminDisputes from "./pages/admin/Disputes.jsx";
import AdminUsers from "./pages/admin/Users.jsx";
import AdminAnalytics from "./pages/admin/Analytics.jsx";

const NAV = {
  student: [
    { to: "/student", label: "Schedule & QR", icon: LayoutDashboard, end: true },
    { to: "/student/track", label: "Active Tracker", icon: PackageCheck },
    { to: "/student/history", label: "Wash History", icon: History },
    { to: "/student/lost-found", label: "Lost & Found", icon: PackageSearch },
    { to: "/student/complaints", label: "Complaints & Support", icon: ShieldAlert },
  ],
  staff: [
    { to: "/staff", label: "Today's Queue", icon: ClipboardList, end: true },
    { to: "/staff/scan", label: "Smart Scanner", icon: ScanLine },
    { to: "/staff/lost-found", label: "Lost & Found Logger", icon: PackageSearch },
  ],
  admin: [
    { to: "/admin", label: "Schedule", icon: CalendarDays, end: true },
    { to: "/admin/queue", label: "Today's Queue", icon: ClipboardList },
    { to: "/admin/disputes", label: "Dispute Hub", icon: ShieldAlert },
    { to: "/admin/users", label: "User Provisioning", icon: Users },
    { to: "/admin/analytics", label: "Analytics & KPIs", icon: BarChart3 },
  ],
};

function RequireRole({ role, children }) {
  const { user, booting } = useAuth();
  const location = useLocation();
  if (booting) return <Spinner label="Restoring your session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.role !== role) return <Navigate to={ROLE_HOME[user.role]} replace />;
  return children;
}

function Home() {
  const { user, booting } = useAuth();
  if (booting) return <Spinner label="Restoring your session…" />;
  return <Navigate to={user ? ROLE_HOME[user.role] : "/login"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />

      {/* Student Portal (5-Tab Modular Architecture) */}
      <Route path="/student" element={<RequireRole role="student"><Shell navItems={NAV.student} /></RequireRole>}>
        <Route index element={<StudentOverview />} />
        <Route path="track" element={<StudentTrack />} />
        <Route path="history" element={<StudentHistory />} />
        <Route path="lost-found" element={<StudentLostFound />} />
        <Route path="complaints" element={<StudentComplaints />} />
      </Route>

      {/* Staff Operational Portal */}
      <Route path="/staff" element={<RequireRole role="staff"><Shell navItems={NAV.staff} /></RequireRole>}>
        <Route index element={<StaffQueue />} />
        <Route path="scan" element={<StaffScanner />} />
        <Route path="lost-found" element={<StaffLostFound />} />
      </Route>

      {/* Admin Governance Portal */}
      <Route path="/admin" element={<RequireRole role="admin"><Shell navItems={NAV.admin} /></RequireRole>}>
        <Route index element={<AdminSchedule />} />
        <Route path="queue" element={<StaffQueue />} />
        <Route path="disputes" element={<AdminDisputes />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="analytics" element={<AdminAnalytics />} />
      </Route>

      <Route path="*" element={<Home />} />
    </Routes>
  );
}
