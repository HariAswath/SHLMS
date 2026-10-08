import { useState } from "react";
import { Plus, ShieldCheck, UserCheck, UserX, Users } from "lucide-react";
import { Button, Card, EmptyState, ErrorBanner, Field, Input, SectionHeader, Spinner, StatusPill, Table, toast } from "../../components/ui.jsx";
import { get, patch, post } from "../../lib/api.js";
import { useLoad } from "../../lib/useLoad.js";

function NewUserModal({ isOpen, onClose, onSuccess }) {
  const [role, setRole] = useState("student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("student123");
  const [studentId, setStudentId] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        ...(role === "student" ? {
          studentId: studentId.trim(),
          roomNumber: roomNumber.trim() ? Number(roomNumber) : undefined,
        } : {
          employeeId: employeeId.trim() || undefined,
        }),
      };
      await post("/users", payload);
      toast(`User ${name} created successfully.`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast(err.message, "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <Card className="w-full max-w-md p-6 animate-[modalIn_150ms_ease-out]">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Provision New User</h3>
            <p className="text-xs text-slate-500">Add student or laundry staff member</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <Field label="Role">
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setPassword(e.target.value === "student" ? "student123" : "staff123");
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              <option value="student">Student</option>
              <option value="staff">Laundry Staff</option>
            </select>
          </Field>

          <Field label="Full Name">
            <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ramesh V" />
          </Field>

          <Field label="Email Address">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ramesh@vwash.com" />
          </Field>

          <Field label="Initial Password">
            <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>

          {role === "student" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Student ID / Reg No">
                <Input required value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="23BCE1050" />
              </Field>
              <Field label="Room Number">
                <Input type="number" value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} placeholder="105" />
              </Field>
            </div>
          ) : (
            <Field label="Employee ID">
              <Input required value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="EMP-005" />
            </Field>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" loading={busy}>Provision User</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function EditUserModal({ user, isOpen, onClose, onSuccess }) {
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [roomNumber, setRoomNumber] = useState(user?.room?.roomNumber || "");
  const [studentId, setStudentId] = useState(user?.studentId || "");
  const [employeeId, setEmployeeId] = useState(user?.employeeId || "");
  const [busy, setBusy] = useState(false);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        email: email.trim(),
        ...(user.role === "student"
          ? {
              studentId: studentId.trim(),
              roomNumber: roomNumber.trim() ? roomNumber.trim() : undefined,
            }
          : {
              employeeId: employeeId.trim() || undefined,
            }),
      };
      await patch(`/users/${user.id}`, payload);
      toast(`User ${name} updated successfully.`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast(err.message, "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <Card className="w-full max-w-md p-6 animate-[modalIn_150ms_ease-out]">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Edit User & Room</h3>
            <p className="text-xs text-slate-500">Update credentials and hostel assignment</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <Field label="Full Name">
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>

          <Field label="Email Address">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>

          {user.role === "student" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Student ID">
                <Input required value={studentId} onChange={(e) => setStudentId(e.target.value)} />
              </Field>
              <Field label="Room Number">
                <Input value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} placeholder="e.g. 102" />
              </Field>
            </div>
          ) : (
            <Field label="Employee ID">
              <Input required value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
            </Field>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" loading={busy}>Save Changes</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default function AdminUsers() {
  const [roleFilter, setRoleFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const { data, error, loading, retry, reload } = useLoad(async () => {
    const res = await get("/users", {
      role: roleFilter === "all" ? undefined : roleFilter,
      limit: 100,
    });
    return res.users || [];
  }, [roleFilter], { pollMs: 20000 });

  const toggleStatus = async (u) => {
    setBusyId(u.id);
    try {
      const nextStatus = u.status === "active" ? "inactive" : "active";
      await patch(`/users/${u.id}/status`, { status: nextStatus });
      toast(`User ${u.name} set to ${nextStatus}.`);
      await reload();
    } catch (err) {
      toast(err.message, "danger");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <Spinner label="Loading user registry…" />;
  if (error) return <ErrorBanner error={error} onRetry={retry} />;

  const users = data || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">User Registry & Provisioning</h2>
          <p className="text-sm text-slate-500">Manage hostel students, staff credentials, and barcode access keys</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {["all", "student", "staff", "admin"].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setRoleFilter(tab)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize ${
                  roleFilter === tab ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={16} /> New User
          </Button>
        </div>
      </div>

      <Card className="p-6">
        <SectionHeader title="Active User Accounts" subtitle={`${users.length} accounts loaded`} />
        <Table
          columns={[
            { key: "id", label: "ID" },
            { key: "user", label: "User Name" },
            { key: "role", label: "Role" },
            { key: "details", label: "Hostel / Barcode" },
            { key: "status", label: "Status" },
            { key: "action", label: "", align: "right" },
          ]}
          rows={users}
          empty="No users found for this filter."
          render={(u, key) => {
            switch (key) {
              case "id": return <span className="font-mono text-xs text-slate-500">#{u.id}</span>;
              case "user":
                return (
                  <div>
                    <p className="font-medium text-slate-900">{u.name}</p>
                    <p className="text-xs text-slate-400">{u.email}</p>
                  </div>
                );
              case "role":
                return (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                    u.role === "admin" ? "bg-purple-50 text-purple-700" : u.role === "staff" ? "bg-indigo-50 text-indigo-700" : "bg-emerald-50 text-emerald-700"
                  }`}>
                    {u.role}
                  </span>
                );
              case "details":
                return (
                  <div className="text-xs text-slate-600">
                    {u.role === "student" ? (
                      <>
                        <p className="font-medium text-slate-800">
                          {u.studentId} · Room {u.room?.roomNumber || "Unassigned"}
                          {u.hostel?.name ? ` (${u.hostel.name})` : ""}
                        </p>
                        <p className="font-mono text-[10px] text-slate-400">{u.barcodeValue}</p>
                      </>
                    ) : u.role === "staff" ? (
                      <p>Staff ID: {u.employeeId || "—"}</p>
                    ) : "Master Administrator"}
                  </div>
                );
              case "status":
                return <StatusPill status={u.status === "active" ? "Active" : "Cancelled"} />;
              case "action":
                if (u.role === "admin") return null;
                return (
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setEditTarget(u)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant={u.status === "active" ? "ghost" : "secondary"}
                      loading={busyId === u.id}
                      onClick={() => toggleStatus(u)}
                    >
                      {u.status === "active" ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                );
              default: return null;
            }
          }}
        />
      </Card>

      <NewUserModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={reload}
      />

      <EditUserModal
        user={editTarget}
        isOpen={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        onSuccess={reload}
      />
    </div>
  );
}
