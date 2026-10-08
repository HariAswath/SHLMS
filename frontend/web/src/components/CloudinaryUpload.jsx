import { useRef, useState } from "react";
import { Camera, Image, Loader2, Trash2, Upload } from "lucide-react";
import { post } from "../lib/api.js";
import { toast } from "./ui.jsx";
import { classNames } from "../lib/util.js";

/**
 * CloudinaryUpload — drag-and-drop / click-to-select file upload widget.
 * Requests a signed upload from the backend, then POSTs directly to Cloudinary.
 *
 * Props:
 *   value       — current image URL (or "")
 *   onChange    — (url: string) => void
 *   folder     — Cloudinary folder (default "shlms")
 *   label      — Optional label text
 */
export function CloudinaryUpload({ value, onChange, folder = "shlms", label }) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) {
      toast("Please select an image file (JPEG, PNG, WebP).", "danger");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast("Image must be under 10 MB.", "danger");
      return;
    }

    setUploading(true);
    try {
      // 1. Get signed upload params from our backend
      const sigData = await post("/upload/cloudinary-signature", { folder });

      // 2. Upload directly to Cloudinary (no round trip through our server)
      const form = new FormData();
      form.append("file", file);
      form.append("api_key", sigData.apiKey);
      form.append("timestamp", sigData.timestamp);
      form.append("signature", sigData.signature);
      form.append("folder", sigData.folder);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${sigData.cloudName}/image/upload`,
        { method: "POST", body: form }
      );

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Upload failed: ${err}`);
      }

      const result = await res.json();
      onChange(result.secure_url);
      toast("Photo uploaded successfully.");
    } catch (err) {
      toast(err.message || "Upload failed", "danger");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  };

  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so re-selecting the same file triggers onChange again
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = () => {
    onChange("");
  };

  // If we already have an uploaded image, show preview
  if (value) {
    return (
      <div className="space-y-1.5">
        {label && <span className="block text-xs font-medium text-slate-600">{label}</span>}
        <div className="relative group w-full rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
          <img
            src={value}
            alt="Uploaded evidence"
            className="w-full h-36 object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow hover:bg-slate-50"
            >
              <Camera size={13} /> Replace
            </button>
            <button
              type="button"
              onClick={remove}
              className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-rose-600 shadow hover:bg-rose-50"
            >
              <Trash2 size={13} /> Remove
            </button>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleInputChange}
        />
      </div>
    );
  }

  // Empty state — upload zone
  return (
    <div className="space-y-1.5">
      {label && <span className="block text-xs font-medium text-slate-600">{label}</span>}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={classNames(
          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center cursor-pointer transition-colors",
          dragOver
            ? "border-indigo-400 bg-indigo-50/50"
            : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50",
          uploading && "pointer-events-none opacity-60",
        )}
      >
        {uploading ? (
          <>
            <Loader2 size={22} className="animate-spin text-indigo-500" />
            <p className="text-xs text-slate-500">Uploading to Cloudinary…</p>
          </>
        ) : (
          <>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Upload size={16} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">
                {dragOver ? "Drop image here" : "Click or drag to upload"}
              </p>
              <p className="text-[11px] text-slate-400">JPEG, PNG, WebP · Max 10 MB</p>
            </div>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInputChange}
      />
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => {
            const url = window.prompt("Enter or paste image URL:");
            if (url && url.trim()) onChange(url.trim());
          }}
          className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800"
        >
          Or paste image URL directly
        </button>
      </div>
    </div>
  );
}
