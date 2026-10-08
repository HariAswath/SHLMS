import { useState } from "react";
import { Star, X } from "lucide-react";
import { Button, Card, Field, toast } from "./ui.jsx";
import { post } from "../lib/api.js";

const METRICS = [
  { key: "cleanlinessRating", label: "Cleanliness", desc: "How clean and fresh were the clothes?" },
  { key: "timelinessRating", label: "Timeliness", desc: "Was the laundry ready on time?" },
  { key: "staffServiceRating", label: "Staff Service", desc: "Helpful and courteous counter service?" },
  { key: "overallRating", label: "Overall Experience", desc: "General satisfaction with this wash cycle" },
];

function StarRating({ value, onChange, label }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`p-1 transition-colors hover:scale-110 ${
            star <= value ? "text-amber-400" : "text-slate-200 hover:text-amber-200"
          }`}
          aria-label={`${star} of 5 stars`}
        >
          <Star size={20} className={star <= value ? "fill-amber-400" : ""} />
        </button>
      ))}
    </div>
  );
}

export function FeedbackModal({ laundry, isOpen, onClose, onSuccess }) {
  const [ratings, setRatings] = useState({
    cleanlinessRating: 5,
    timelinessRating: 5,
    staffServiceRating: 5,
    overallRating: 5,
  });
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !laundry) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await post("/feedback", {
        laundryId: laundry.id,
        ...ratings,
        comment: comment.trim() || undefined,
      });
      toast("Thank you! Your feedback has been submitted.");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast(err.message, "danger");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <Card className="w-full max-w-lg p-6 animate-[modalIn_150ms_ease-out]">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Rate Laundry #{laundry.id}</h3>
            <p className="text-xs text-slate-500">Delivered wash cycle satisfaction</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-3">
            {METRICS.map((m) => (
              <div key={m.key} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 bg-slate-50/50">
                <div>
                  <p className="text-sm font-medium text-slate-800">{m.label}</p>
                  <p className="text-xs text-slate-400">{m.desc}</p>
                </div>
                <StarRating
                  label={m.label}
                  value={ratings[m.key]}
                  onChange={(val) => setRatings((prev) => ({ ...prev, [m.key]: val }))}
                />
              </div>
            ))}
          </div>

          <Field label="Comments (Optional)">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Any details on clothes condition, counter experience, etc..."
              rows={3}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Skip
            </Button>
            <Button type="submit" loading={submitting}>
              Submit Feedback
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
