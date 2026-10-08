import { useState } from "react";
import { Star } from "lucide-react";
import { Button, Card, ErrorBanner, SectionHeader, Spinner, StatusPill, Table } from "../../components/ui.jsx";
import { FeedbackModal } from "../../components/FeedbackModal.jsx";
import { get } from "../../lib/api.js";
import { useLoad } from "../../lib/useLoad.js";
import { STATUS_LABEL, fmtDate, fmtDateTime } from "../../lib/util.js";
import { clothSummary } from "../../lib/laundry.js";

const COLUMNS = [
  { key: "id", label: "Ref" },
  { key: "date", label: "Laundry day" },
  { key: "items", label: "Items" },
  { key: "status", label: "Status" },
  { key: "delivered", label: "Delivered" },
  { key: "feedback", label: "Rating & Feedback", align: "right" },
];

export default function StudentHistory() {
  const [ratingLaundry, setRatingLaundry] = useState(null);
  const { data, error, loading, retry, reload } = useLoad(() => get("/laundry/my"), [], { pollMs: 15000 });

  if (loading) return <Spinner />;
  if (error) return <ErrorBanner error={error} onRetry={retry} />;

  return (
    <Card className="p-6">
      <SectionHeader title="Laundry history" subtitle="Every bag you have handed in, newest first" />
      <Table
        columns={COLUMNS}
        rows={data.records}
        empty="No laundry cycles yet."
        render={(r, key) => {
          switch (key) {
            case "id": return <span className="font-mono text-xs text-slate-500">#{r.id}</span>;
            case "date": return fmtDate(r.schedule?.scheduleDate);
            case "items": return clothSummary(r.clothDetails);
            case "status": return <StatusPill status={STATUS_LABEL[r.status]} />;
            case "delivered": return r.deliveredAt ? fmtDateTime(r.deliveredAt) : "—";
            case "feedback":
              if (r.status === "delivered") {
                return (
                  <Button size="sm" variant="secondary" onClick={() => setRatingLaundry(r)}>
                    <Star size={13} className="text-amber-500" /> Rate Cycle
                  </Button>
                );
              }
              return null;
            default: return null;
          }
        }}
      />

      <FeedbackModal
        laundry={ratingLaundry}
        isOpen={Boolean(ratingLaundry)}
        onClose={() => setRatingLaundry(null)}
        onSuccess={reload}
      />
    </Card>
  );
}
