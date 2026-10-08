import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, ScanLine } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { Button, Input } from "./ui.jsx";

const REGION_ID = "shlms-qr-region";

/**
 * Camera scan + manual barcode entry. Calls onScan(value) with the decoded / typed barcode.
 * Manual entry is always available (testing, damaged QR, no camera permission).
 */
export function BarcodeScanner({ onScan, busy = false, submitLabel = "Look up", placeholder = "VW-STU-23BCE1234" }) {
  const [manual, setManual] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const scannerRef = useRef(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!cameraOn) return undefined;
    let cancelled = false;
    const scanner = new Html5Qrcode(REGION_ID);
    scannerRef.current = scanner;
    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (text) => {
          setCameraOn(false);
          onScanRef.current(text.trim());
        },
        () => {},
      )
      .catch((e) => {
        if (cancelled) return;
        setCameraError(
          /permission|denied|NotAllowed/i.test(String(e))
            ? "Camera permission was denied. Type the barcode below instead."
            : "Could not start the camera on this device. Type the barcode below instead.",
        );
        setCameraOn(false);
      });
    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) s.stop().then(() => s.clear()).catch(() => {});
    };
  }, [cameraOn]);

  const submit = (e) => {
    e.preventDefault();
    const v = manual.trim();
    if (v) onScan(v);
  };

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-900/95">
        <div id={REGION_ID} className={cameraOn ? "min-h-[260px]" : "hidden"} />
        {!cameraOn && (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 p-6 text-center text-slate-300">
            <ScanLine size={28} className="text-indigo-300" />
            <p className="text-sm">Point the camera at the student's QR code</p>
            <Button type="button" variant="secondary" size="sm" onClick={() => { setCameraError(""); setCameraOn(true); }}>
              <Camera size={14} /> Start camera
            </Button>
          </div>
        )}
        {cameraOn && (
          <div className="absolute right-2 top-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setCameraOn(false)}>
              <CameraOff size={14} /> Stop
            </Button>
          </div>
        )}
      </div>
      {cameraError && <p className="text-xs text-amber-600" role="alert">{cameraError}</p>}

      <form onSubmit={submit} className="flex gap-2">
        <Input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder={placeholder}
          aria-label="Barcode value"
          autoComplete="off"
        />
        <Button type="submit" loading={busy} disabled={!manual.trim()}>{submitLabel}</Button>
      </form>
    </div>
  );
}
