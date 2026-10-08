import { useState } from "react";
import { Package, Plus, Tag } from "lucide-react";
import { Button, Card, EmptyState, ErrorBanner, Field, Input, SectionHeader, Spinner, StatusPill, Table, toast } from "../../components/ui.jsx";
import { CloudinaryUpload } from "../../components/CloudinaryUpload.jsx";
import { get, post } from "../../lib/api.js";
import { useLoad } from "../../lib/useLoad.js";
import { fmtDate, todayUtc } from "../../lib/util.js";

const CATEGORIES = ["shirt", "tshirt", "pants", "shorts", "jacket", "towel", "bedsheet", "socks", "other"];

export default function StaffLostFound() {
  const today = todayUtc();
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    category: "tshirt",
    color: "",
    description: "",
    imageUrl: "",
    foundDate: today,
  });
  const [saving, setSaving] = useState(false);

  const { data, error, loading, retry, reload } = useLoad(async () => {
    const res = await get("/lost-found", { limit: 50 });
    return res.items || [];
  }, [], { pollMs: 15000 });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await post("/lost-found", {
        title: formData.title.trim(),
        category: formData.category,
        color: formData.color.trim() || undefined,
        description: formData.description.trim() || undefined,
        imageUrl: formData.imageUrl.trim() || undefined,
        foundDate: formData.foundDate,
      });
      toast("Unclaimed item recorded in Lost & Found catalog.");
      setFormData({
        title: "",
        category: "tshirt",
        color: "",
        description: "",
        imageUrl: "",
        foundDate: today,
      });
      setFormOpen(false);
      await reload();
    } catch (err) {
      toast(err.message, "danger");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner label="Loading items…" />;
  if (error) return <ErrorBanner error={error} onRetry={retry} />;

  const items = data || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Lost & Found Logger</h2>
          <p className="text-sm text-slate-500">Log orphaned or forgotten clothing items found in washers/dryers</p>
        </div>
        <Button onClick={() => setFormOpen((o) => !o)}>
          <Plus size={16} /> {formOpen ? "Close Logger" : "Log New Item"}
        </Button>
      </div>

      {formOpen && (
        <Card className="p-6 border-indigo-100 bg-indigo-50/20">
          <SectionHeader title="Log Unclaimed Laundry Item" subtitle="Item will immediately appear in the student catalog for claims" />
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Item Title">
                <Input
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Navy Blue Hoodie"
                />
              </Field>
              <Field label="Category">
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 capitalize"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Color">
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="e.g. Dark Grey, Red"
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <CloudinaryUpload
                value={formData.imageUrl}
                onChange={(url) => setFormData({ ...formData, imageUrl: url })}
                folder="shlms/lost-found"
                label="Photo of Item (Optional)"
              />
              <Field label="Date Found">
                <Input
                  type="date"
                  required
                  value={formData.foundDate}
                  onChange={(e) => setFormData({ ...formData, foundDate: e.target.value })}
                />
              </Field>
            </div>

            <Field label="Description & Distinctive Marks">
              <textarea
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Found in dryer #2; small white logo on chest, size L..."
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Save & Post Item
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="p-6">
        <SectionHeader title="Recorded Lost & Found Items" subtitle="All orphaned clothes logged by counter staff" />
        <Table
          columns={[
            { key: "id", label: "ID" },
            { key: "title", label: "Item" },
            { key: "category", label: "Category" },
            { key: "color", label: "Color" },
            { key: "date", label: "Found Date" },
            { key: "status", label: "Status" },
          ]}
          rows={items}
          empty="No lost & found items recorded."
          render={(item, key) => {
            switch (key) {
              case "id": return <span className="font-mono text-xs text-slate-500">#{item.id}</span>;
              case "title":
                return (
                  <div>
                    <p className="font-medium text-slate-900">{item.title}</p>
                    {item.description && <p className="text-xs text-slate-400 line-clamp-1">{item.description}</p>}
                  </div>
                );
              case "category": return <span className="capitalize">{item.category}</span>;
              case "color": return item.color || "—";
              case "date": return item.foundDate ? fmtDate(item.foundDate) : "—";
              case "status":
                return <StatusPill status={item.status === "available" ? "Active" : item.status === "claimed" ? "Completed" : item.status} />;
              default: return null;
            }
          }}
        />
      </Card>
    </div>
  );
}
