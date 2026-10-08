import { useState } from "react";
import { AlertCircle, CheckCircle2, Clock, MessageSquare, Plus, ShieldAlert, X } from "lucide-react";
import { Button, Card, EmptyState, ErrorBanner, Field, Input, SectionHeader, Spinner, StatusPill, toast } from "../../components/ui.jsx";
import { CloudinaryUpload } from "../../components/CloudinaryUpload.jsx";
import { get, post } from "../../lib/api.js";
import { useLoad } from "../../lib/useLoad.js";
import { fmtDate, fmtDateTime } from "../../lib/util.js";

const CATEGORIES = [
  { value: "missing_clothes", label: "Missing Clothes" },
  { value: "damaged_clothes", label: "Damaged Clothes" },
  { value: "wrong_item", label: "Wrong Item Received" },
  { value: "delay", label: "Delivery Delay" },
  { value: "other", label: "Other Inquiry / Support" },
];

const COMPLAINT_STATUS_STYLES = {
  open: "bg-amber-50 text-amber-700",
  under_review: "bg-indigo-50 text-indigo-700",
  resolved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-rose-50 text-rose-700",
  closed: "bg-slate-100 text-slate-600",
};

function NewComplaintModal({ laundryRecords, isOpen, onClose, onSuccess }) {
  const [category, setCategory] = useState("missing_clothes");
  const [laundryId, setLaundryId] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await post("/complaints", {
        category,
        laundryId: laundryId ? Number(laundryId) : undefined,
        description: description.trim(),
        imageUrl: imageUrl.trim() || undefined,
      });
      toast("Complaint submitted. Our team will review and resolve it promptly.");
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
      <Card className="w-full max-w-lg p-6 animate-[modalIn_150ms_ease-out]">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">File a Support Complaint</h3>
            <p className="text-xs text-slate-500">Report missing clothes, damage, or wash issues</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <Field label="Complaint Category">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Associated Laundry Order (Optional)">
            <select
              value={laundryId}
              onChange={(e) => setLaundryId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">None / General Issue</option>
              {laundryRecords.map((r) => (
                <option key={r.id} value={r.id}>
                  Laundry #{r.id} ({fmtDate(r.schedule?.scheduleDate)} - {r.status})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Description" hint="Describe the missing or damaged items, clothing colors, and brands">
            <textarea
              required
              minLength={5}
              maxLength={1000}
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. 1 black Nike dry-fit t-shirt missing from wash cycle #23..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </Field>

          <CloudinaryUpload
            value={imageUrl}
            onChange={setImageUrl}
            folder="shlms/complaints"
            label="Photo Evidence (Optional)"
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={description.trim().length < 5}>
              Submit Complaint
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default function StudentComplaints() {
  const [modalOpen, setModalOpen] = useState(false);

  const { data, error, loading, retry, reload } = useLoad(async () => {
    const [complaintsRes, laundryRes] = await Promise.all([
      get("/complaints", { limit: 50 }),
      get("/laundry/my"),
    ]);
    return {
      complaints: complaintsRes.complaints || [],
      laundryRecords: laundryRes.records || [],
    };
  }, [], { pollMs: 15000 });

  if (loading) return <Spinner label="Loading support complaints…" />;
  if (error) return <ErrorBanner error={error} onRetry={retry} />;

  const { complaints, laundryRecords } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Complaints & Support Hub</h2>
          <p className="text-sm text-slate-500">Track and resolve issues regarding damaged, delayed, or missing laundry</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={16} /> File New Complaint
        </Button>
      </div>

      {complaints.length === 0 ? (
        <Card>
          <EmptyState
            icon={ShieldAlert}
            title="No complaints filed"
            hint="If you ever have missing or damaged items, click 'File New Complaint' above to get prompt assistance."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {complaints.map((c) => (
            <Card key={c.id} className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-slate-500">#{c.id}</span>
                  <span className="text-sm font-semibold text-slate-900 capitalize">
                    {c.category?.replace("_", " ")}
                  </span>
                  {c.laundryId && (
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                      Laundry #{c.laundryId}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                    COMPLAINT_STATUS_STYLES[c.status] || "bg-slate-100 text-slate-600"
                  }`}>
                    {c.status?.replace("_", " ")}
                  </span>
                  <span className="text-xs text-slate-400">{fmtDateTime(c.createdAt)}</span>
                </div>
              </div>

              <div className="mt-3 text-sm text-slate-700 whitespace-pre-wrap">
                {c.description}
              </div>

              {c.imageUrl && (
                <div className="mt-3">
                  <img
                    src={c.imageUrl}
                    alt="Complaint Evidence"
                    className="h-28 rounded-lg border border-slate-200 object-cover"
                  />
                </div>
              )}

              {c.adminRemarks && (
                <div className="mt-3.5 rounded-lg bg-indigo-50/70 border border-indigo-100 p-3 text-xs text-indigo-900">
                  <p className="font-semibold text-indigo-950 mb-0.5">Admin Resolution Remarks:</p>
                  <p className="text-indigo-800">{c.adminRemarks}</p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <NewComplaintModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        laundryRecords={laundryRecords}
        onSuccess={reload}
      />
    </div>
  );
}
