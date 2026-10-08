import { useState } from "react";
import { CheckCircle2, ChevronRight, Eye, MessageSquare, ShieldAlert, X, XCircle } from "lucide-react";
import { Button, Card, EmptyState, ErrorBanner, Field, SectionHeader, Spinner, StatusPill, toast } from "../../components/ui.jsx";
import { get, patch } from "../../lib/api.js";
import { useLoad } from "../../lib/useLoad.js";
import { fmtDate, fmtDateTime } from "../../lib/util.js";

const COMPLAINT_STATUS_OPTIONS = [
  { value: "under_review", label: "Under Review" },
  { value: "resolved", label: "Resolve" },
  { value: "rejected", label: "Reject" },
  { value: "closed", label: "Close" },
];

function ComplaintResolveModal({ complaint, isOpen, onClose, onSuccess }) {
  const [status, setStatus] = useState("resolved");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  if (!isOpen || !complaint) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await patch(`/complaints/${complaint.id}/status`, {
        status,
        adminRemarks: remarks.trim() || undefined,
      });
      toast(`Complaint #${complaint.id} marked as ${status}.`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast(err.message, "danger");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <Card className="w-full max-w-md p-6 animate-[modalIn_150ms_ease-out]">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Resolve Complaint #{complaint.id}</h3>
            <p className="text-xs text-slate-500">{complaint.student?.name} · {complaint.category?.replace("_", " ")}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <Field label="New Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 capitalize"
            >
              {COMPLAINT_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Resolution Remarks (Visible to Student)">
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Item located in drying chamber #1 and returned to student room..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Update Status
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default function AdminDisputes() {
  const [complaintTab, setComplaintTab] = useState("all");
  const [activeComplaint, setActiveComplaint] = useState(null);
  const [claimActionId, setClaimActionId] = useState(null);
  const [claimRemarks, setClaimRemarks] = useState("");
  const [reviewingClaim, setReviewingClaim] = useState(false);

  const { data, error, loading, retry, reload } = useLoad(async () => {
    const [complaintsRes, lostFoundRes] = await Promise.all([
      get("/complaints", { status: complaintTab === "all" ? undefined : complaintTab, limit: 50 }),
      get("/lost-found", { limit: 50 }),
    ]);
    return {
      complaints: complaintsRes.complaints || [],
      items: lostFoundRes.items || [],
    };
  }, [complaintTab], { pollMs: 15000 });

  if (loading) return <Spinner label="Loading dispute hub…" />;
  if (error) return <ErrorBanner error={error} onRetry={retry} />;

  const { complaints, items } = data;
  const itemsWithClaims = items.filter((it) => it.claims && it.claims.length > 0);

  const handleReviewClaim = async (claimId, status) => {
    setReviewingClaim(true);
    try {
      await patch(`/lost-found/claims/${claimId}`, {
        status,
        remarks: claimRemarks.trim() || undefined,
      });
      toast(`Claim #${claimId} ${status}.`);
      setClaimActionId(null);
      setClaimRemarks("");
      await reload();
    } catch (err) {
      toast(err.message, "danger");
    } finally {
      setReviewingClaim(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Unified Dispute & Resolution Hub</h2>
        <p className="text-sm text-slate-500">Manage student wash complaints and Lost & Found claims in one workspace</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Complaints */}
        <Card className="p-5 flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-semibold text-slate-900 text-base">Student Complaints</h3>
              <p className="text-xs text-slate-500">{complaints.length} tickets</p>
            </div>
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {["all", "open", "resolved"].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setComplaintTab(tab)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors capitalize ${
                    complaintTab === tab ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-3 flex-1 overflow-y-auto max-h-[620px]">
            {complaints.length === 0 ? (
              <EmptyState title="No complaints in this view" />
            ) : (
              complaints.map((c) => (
                <div key={c.id} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-indigo-200 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-xs text-slate-900 capitalize">
                      {c.category?.replace("_", " ")}
                    </span>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full capitalize bg-indigo-50 text-indigo-700">
                      {c.status?.replace("_", " ")}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-slate-500">
                    {c.student?.name} · Room {c.student?.room?.roomNumber || "—"} · #{c.id}
                  </p>

                  <p className="mt-2 text-xs text-slate-700 line-clamp-2">{c.description}</p>

                  {c.imageUrl && (
                    <a
                      href={c.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:underline"
                    >
                      <Eye size={12} /> View Photo Evidence
                    </a>
                  )}

                  {c.adminRemarks && (
                    <div className="mt-2 text-[11px] bg-slate-100 p-2 rounded text-slate-600">
                      <strong>Remarks:</strong> {c.adminRemarks}
                    </div>
                  )}

                  <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">{fmtDateTime(c.createdAt)}</span>
                    <Button size="sm" variant="secondary" onClick={() => setActiveComplaint(c)}>
                      Update Resolution
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Right Column: Lost & Found Claims */}
        <Card className="p-5 flex flex-col">
          <div className="pb-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900 text-base">Lost & Found Claims</h3>
            <p className="text-xs text-slate-500">Review student claims against orphaned clothes</p>
          </div>

          <div className="mt-4 space-y-4 flex-1 overflow-y-auto max-h-[620px]">
            {itemsWithClaims.length === 0 ? (
              <EmptyState title="No active claims awaiting review" hint="Student claims on found items will appear here." />
            ) : (
              itemsWithClaims.map((item) => (
                <div key={item.id} className="p-4 rounded-lg border border-slate-200 bg-white">
                  <div className="flex items-start gap-3">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.title} className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 text-xs shrink-0">
                        No Photo
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-sm text-slate-900">{item.title}</h4>
                      <p className="text-xs text-slate-500">{item.category} · {item.color || "No color"} · Found {item.foundDate ? fmtDate(item.foundDate) : "—"}</p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
                    {item.claims.map((claim) => (
                      <div key={claim.id} className="p-2.5 rounded-md bg-slate-50 border border-slate-100 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-800">Claimant: {claim.student?.name || `Student #${claim.studentId}`}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            claim.status === "approved" ? "bg-emerald-50 text-emerald-700" : claim.status === "rejected" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"
                          }`}>
                            {claim.status}
                          </span>
                        </div>
                        <p className="mt-1.5 text-slate-600"><strong>Proof:</strong> {claim.description}</p>
                        {claim.remarks && <p className="mt-1 text-slate-500"><strong>Notes:</strong> {claim.remarks}</p>}

                        {claim.status === "pending" && (
                          <div className="mt-2.5 pt-2 border-t border-slate-200 flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="danger"
                              loading={reviewingClaim && claimActionId === claim.id}
                              onClick={() => { setClaimActionId(claim.id); handleReviewClaim(claim.id, "rejected"); }}
                            >
                              <XCircle size={13} /> Reject
                            </Button>
                            <Button
                              size="sm"
                              variant="success"
                              loading={reviewingClaim && claimActionId === claim.id}
                              onClick={() => { setClaimActionId(claim.id); handleReviewClaim(claim.id, "approved"); }}
                            >
                              <CheckCircle2 size={13} /> Approve & Return
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <ComplaintResolveModal
        complaint={activeComplaint}
        isOpen={Boolean(activeComplaint)}
        onClose={() => setActiveComplaint(null)}
        onSuccess={reload}
      />
    </div>
  );
}
