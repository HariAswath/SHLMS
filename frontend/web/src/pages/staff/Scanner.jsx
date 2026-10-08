import { useState } from "react";
import { CheckCircle2, Info, Minus, PackageCheck, Plus, UserCheck, XCircle } from "lucide-react";
import { BarcodeScanner } from "../../components/BarcodeScanner.jsx";
import { Button, Card, SectionHeader, StatusPill, toast } from "../../components/ui.jsx";
import { post } from "../../lib/api.js";
import { STATUS_LABEL } from "../../lib/util.js";
import { clothSummary, clothTotal } from "../../lib/laundry.js";

const CATEGORIES = ["shirts", "tshirts", "pants", "shorts", "towels", "bedsheets", "others"];
const LABELS = { shirts: "Shirts", tshirts: "T-shirts", pants: "Pants", shorts: "Shorts", towels: "Towels", bedsheets: "Bedsheets", others: "Others" };
const emptyCounts = () => Object.fromEntries(CATEGORIES.map((c) => [c, 0]));

function StudentLine({ s }) {
  return (
    <p className="text-sm text-slate-600">
      <span className="font-semibold text-slate-900">{s.name}</span> · {s.studentId} · {s.hostel} Room {s.room}
    </p>
  );
}

/**
 * One scanner for the whole counter. A single scan is resolved by the backend (/laundry/lookup):
 *   ready laundry  -> hand-over confirmation
 *   scheduled today -> cloth intake form
 *   anything else   -> clear reason why not
 */
export default function Scanner() {
  const [looking, setLooking] = useState(false);
  const [barcode, setBarcode] = useState(null);
  const [res, setRes] = useState(null); // lookup data
  const [problem, setProblem] = useState(null);
  const [counts, setCounts] = useState(emptyCounts());
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState(null); // { kind: 'delivered'|'received', record }

  const reset = () => {
    setBarcode(null); setRes(null); setProblem(null); setCounts(emptyCounts()); setOutcome(null);
  };

  const onScan = async (value) => {
    reset();
    setLooking(true);
    setBarcode(value);
    try {
      setRes(await post("/laundry/lookup", { barcodeValue: value }));
    } catch (e) {
      setProblem(e.message);
    } finally {
      setLooking(false);
    }
  };

  const deliver = async () => {
    setBusy(true);
    try {
      const data = await post(`/laundry/${res.pickup.id}/verify-pickup`, { barcodeValue: barcode });
      setOutcome({ kind: "delivered", record: data.record });
      setRes(null);
      toast("Pickup verified. Laundry marked as delivered.");
    } catch (e) {
      toast(e.message, "danger");
    } finally {
      setBusy(false);
    }
  };

  const submitIntake = async () => {
    setBusy(true);
    try {
      const clothDetails = Object.fromEntries(Object.entries(counts).filter(([, n]) => n > 0));
      const data = await post("/laundry/submit", { barcodeValue: barcode, clothDetails });
      setOutcome({ kind: "received", record: data.laundryRecord });
      setRes(null);
      toast("Laundry recorded. The student has been notified.");
    } catch (e) {
      toast(e.message, "danger");
    } finally {
      setBusy(false);
    }
  };

  const bump = (cat, d) => setCounts((c) => ({ ...c, [cat]: Math.max(0, (c[cat] || 0) + d) }));
  const total = clothTotal(counts);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-6">
        <SectionHeader title="Scan student QR" subtitle="Works for both drop-off and pickup. Use the camera or type the barcode under the QR." />
        <BarcodeScanner onScan={onScan} busy={looking} submitLabel="Scan" />
      </Card>

      <Card className="p-6" data-testid="scanner-result">
        <SectionHeader title="Counter action" subtitle="Decided automatically from the scan" />

        {!barcode && !outcome && <p className="py-10 text-center text-sm text-slate-400">Waiting for a scan…</p>}
        {looking && <p className="py-10 text-center text-sm text-slate-400" role="status">Checking student…</p>}

        {problem && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4" role="alert" data-testid="scan-problem">
            <div className="flex items-start gap-3">
              <XCircle size={18} className="mt-0.5 shrink-0 text-rose-600" />
              <div>
                <p className="text-sm font-semibold text-rose-700">Scan rejected</p>
                <p className="mt-1 text-sm text-rose-700">{problem}</p>
                <p className="mt-1 font-mono text-xs text-rose-400">{barcode}</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" className="mt-3" onClick={reset}>Scan another</Button>
          </div>
        )}

        {/* Branch 1: laundry waiting at the counter */}
        {res?.pickup && (
          <div className="space-y-4" data-testid="pickup-card">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <PackageCheck size={18} className="mt-0.5 shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">Laundry ready for hand-over</p>
                <StudentLine s={res.student} />
                <p className="mt-1 text-sm text-slate-600">Laundry #{res.pickup.id} · {clothSummary(res.pickup.clothDetails)}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500">The scan confirms this student owns the bag. Hand it over, then confirm.</p>
            <div className="flex gap-2">
              <Button variant="success" loading={busy} onClick={deliver}><CheckCircle2 size={15} /> Verify & deliver</Button>
              <Button variant="ghost" onClick={reset}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Branch 2: intake */}
        {res && !res.pickup && res.intake.eligible && (
          <div className="space-y-5" data-testid="intake-card">
            <div className="flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
              <UserCheck size={18} className="mt-0.5 shrink-0 text-indigo-600" />
              <div>
                <p className="text-sm font-semibold text-indigo-800">Eligible for drop-off today</p>
                <StudentLine s={res.student} />
                <p className="text-sm text-slate-600">{res.intake.group.name} · {res.intake.schedule.startTime}–{res.intake.schedule.endTime}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {CATEGORIES.map((cat) => (
                <div key={cat} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                  <span className="text-sm text-slate-700">{LABELS[cat]}</span>
                  <div className="flex items-center gap-2">
                    <button type="button" aria-label={`Less ${LABELS[cat]}`} onClick={() => bump(cat, -1)} className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"><Minus size={13} /></button>
                    <span className="w-6 text-center text-sm font-semibold tabular-nums" data-testid={`count-${cat}`}>{counts[cat]}</span>
                    <button type="button" aria-label={`More ${LABELS[cat]}`} onClick={() => bump(cat, 1)} className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"><Plus size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">Total items: <span className="font-semibold text-slate-900">{total}</span></p>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={reset}>Cancel</Button>
                <Button loading={busy} disabled={total === 0} onClick={submitIntake}>Submit laundry</Button>
              </div>
            </div>
          </div>
        )}

        {/* Branch 3: nothing to do */}
        {res && !res.pickup && !res.intake.eligible && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4" role="alert" data-testid="ineligible-card">
            <div className="flex items-start gap-3">
              <Info size={18} className="mt-0.5 shrink-0 text-amber-600" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-amber-800">Nothing to do for this student</p>
                <StudentLine s={res.student} />
                <p className="text-sm text-amber-800">{res.intake.reason}</p>
                {res.processing && (
                  <p className="flex items-center gap-2 text-sm text-slate-600">
                    Their earlier laundry #{res.processing.id} is still <StatusPill status={STATUS_LABEL[res.processing.status]} /> — not ready yet.
                  </p>
                )}
              </div>
            </div>
            <Button variant="secondary" size="sm" className="mt-3" onClick={reset}>Scan another</Button>
          </div>
        )}

        {outcome && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4" role="status" data-testid={outcome.kind === "delivered" ? "deliver-success" : "submit-success"}>
            <div className="flex items-start gap-3">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />
              <div className="text-sm text-emerald-800">
                {outcome.kind === "delivered"
                  ? <><p className="font-semibold">Delivered · Laundry #{outcome.record.id}</p><p>Handed over and the student has been notified.</p></>
                  : <><p className="font-semibold">Laundry #{outcome.record.id} recorded as Received</p><p>When it is washed, mark it ready from Today's Queue.</p></>}
              </div>
            </div>
            <Button variant="secondary" size="sm" className="mt-3" onClick={reset}>Scan next student</Button>
          </div>
        )}
      </Card>
    </div>
  );
}
