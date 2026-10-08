import { useState } from "react";
import { Package, Search, Tag, X } from "lucide-react";
import { Button, Card, EmptyState, ErrorBanner, Field, Spinner, StatusPill, toast } from "../../components/ui.jsx";
import { get, post } from "../../lib/api.js";
import { useLoad } from "../../lib/useLoad.js";
import { fmtDate } from "../../lib/util.js";

function ClaimModal({ item, isOpen, onClose, onSuccess }) {
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isOpen || !item) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await post(`/lost-found/${item.id}/claim`, { description: description.trim() });
      toast("Claim request submitted! Hostel administration will review it.");
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
            <h3 className="text-lg font-semibold text-slate-900">Claim Item #{item.id}</h3>
            <p className="text-xs text-slate-500">{item.title}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
            Please provide specific details to prove ownership (e.g., brand name, distinctive marks, size, or tags).
          </div>

          <Field label="Proof of Ownership / Claim Details" error={description && description.length < 5 ? "Must be at least 5 characters" : null}>
            <textarea
              required
              minLength={5}
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Blue Levi's denim shirt size M, small tear on left sleeve cuff..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={description.trim().length < 5}>
              Submit Claim
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default function StudentLostFound() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [claimingItem, setClaimingItem] = useState(null);

  const { data, error, loading, retry, reload } = useLoad(async () => {
    const res = await get("/lost-found", {
      status: filter === "all" ? undefined : filter,
      limit: 50,
    });
    return res?.items || [];
  }, [filter], { pollMs: 15000 });

  const items = (data || []).filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      (item.category && item.category.toLowerCase().includes(q)) ||
      (item.color && item.color.toLowerCase().includes(q)) ||
      (item.description && item.description.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Lost & Found Catalog</h2>
          <p className="text-sm text-slate-500">Unclaimed clothes and items found at the laundry facility</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items..."
              className="pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-indigo-400 w-48 sm:w-60"
            />
          </div>
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {["all", "available", "claimed"].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize ${
                  filter === tab ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && <Spinner label="Loading items catalog…" />}
      {error && <ErrorBanner error={error} onRetry={retry} />}

      {!loading && !error && items.length === 0 && (
        <Card>
          <EmptyState
            icon={Package}
            title="No lost & found items found"
            hint={search ? "Try adjusting your search query." : "Currently there are no unclaimed items in this category."}
          />
        </Card>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <Card key={item.id} className="overflow-hidden flex flex-col group hover:shadow-md transition-shadow">
              <div className="h-44 bg-slate-100 flex items-center justify-center relative overflow-hidden">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400">
                    <Package size={36} className="mb-1 opacity-60" />
                    <span className="text-[11px]">No photo attached</span>
                  </div>
                )}
                <div className="absolute top-2.5 right-2.5">
                  <StatusPill status={item.status === "available" ? "Active" : item.status === "claimed" ? "Completed" : item.status} />
                </div>
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900 text-base">{item.title}</h3>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md">
                      <Tag size={11} /> {item.category}
                    </span>
                    {item.color && (
                      <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md">
                        {item.color}
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="mt-2 text-xs text-slate-600 line-clamp-2">{item.description}</p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Found {item.foundDate ? fmtDate(item.foundDate) : "Recently"}
                  </span>
                  {item.status === "available" ? (
                    <Button size="sm" onClick={() => setClaimingItem(item)}>
                      Claim Item
                    </Button>
                  ) : (
                    <span className="text-xs font-medium text-slate-400 capitalize">{item.status}</span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ClaimModal
        item={claimingItem}
        isOpen={Boolean(claimingItem)}
        onClose={() => setClaimingItem(null)}
        onSuccess={reload}
      />
    </div>
  );
}
