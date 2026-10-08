import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Shirt } from "lucide-react";
import { useAuth } from "../auth/AuthContext.jsx";
import { Button, Card, ErrorBanner, Field, Input, Spinner } from "../components/ui.jsx";
import { ROLE_HOME } from "../lib/util.js";

const DEMO = [
  { label: "Student (G1)", email: "student@vwash.com", password: "student123" },
  { label: "Student (G2)", email: "arun@vwash.com", password: "student123" },
  { label: "Staff", email: "staff@vwash.com", password: "staff123" },
  { label: "Admin", email: "admin@vwash.com", password: "admin123" },
];

export default function Login() {
  const { user, booting, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (booting) return <Spinner label="Restoring your session…" />;
  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const u = await login(email.trim(), password);
      const from = location.state?.from;
      navigate(from && from.startsWith(ROLE_HOME[u.role]) ? from : ROLE_HOME[u.role], { replace: true });
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white"><Shirt size={22} /></div>
          <h1 className="text-xl font-semibold text-slate-900">Sign in to SHLMS</h1>
          <p className="mt-1 text-sm text-slate-500">Smart Hostel Laundry Management System</p>
        </div>
        <Card className="p-6">
          <form onSubmit={submit} className="space-y-4">
            <Field label="Email">
              <Input type="email" required autoFocus autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@vwash.com" />
            </Field>
            <Field label="Password">
              <Input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </Field>
            <ErrorBanner error={error} />
            <Button type="submit" loading={busy} className="w-full">Sign in</Button>
          </form>
        </Card>
        <div className="mt-5 text-center">
          <p className="mb-2 text-xs text-slate-400">Demo accounts (seeded data)</p>
          <div className="flex justify-center gap-2">
            {DEMO.map((d) => (
              <button
                key={d.label}
                type="button"
                onClick={() => { setEmail(d.email); setPassword(d.password); setError(null); }}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
