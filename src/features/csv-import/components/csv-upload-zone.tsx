"use client";

/**
 * CsvUploadZone — drag-and-drop file upload with progress and result display.
 *
 * States:
 *   idle       → Drop zone with file input
 *   preview    → File selected, showing name/size/row count, ready to import
 *   uploading  → Spinner + "Importing…" text
 *   success    → Green result banner with counts
 *   error      → Red error banner
 */

import { useState, useRef, useCallback } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { importTaboolaCsv } from "@/features/csv-import/actions";
import type { ImportResult } from "@/features/csv-import/actions";

type Step = "idle" | "preview" | "uploading" | "success" | "error";

interface FilePreview {
  file:     File;
  rowCount: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CsvUploadZone() {
  const [step, setStep]       = useState<Step>("idle");
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [result, setResult]   = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── File selection ──────────────────────────────────────────────────────

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv")) {
      setResult({ success: false, error: "Only .csv files are accepted" });
      setStep("error");
      return;
    }

    // Quick row count: count newlines in the text
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const lines = text.split("\n").filter((l) => l.trim().length > 0);
      const rowCount = Math.max(0, lines.length - 1); // minus header
      setPreview({ file, rowCount });
      setStep("preview");
      setResult(null);
    };
    reader.readAsText(file);
  }, []);

  // ── Drag & drop handlers ──────────────────────────────────────────────

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset input so the same file can be re-selected
      if (inputRef.current) inputRef.current.value = "";
    },
    [handleFile],
  );

  // ── Import handler ────────────────────────────────────────────────────

  async function handleImport() {
    if (!preview) return;

    setStep("uploading");

    const formData = new FormData();
    formData.set("file", preview.file);

    const res = await importTaboolaCsv(formData);
    setResult(res);
    setStep(res.success ? "success" : "error");
  }

  function reset() {
    setStep("idle");
    setPreview(null);
    setResult(null);
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* Drop zone */}
      {(step === "idle" || step === "preview") && (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`
            relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed
            px-6 py-10 transition-colors
            ${
              dragOver
                ? "border-blue-500/50 bg-blue-500/5"
                : "border-white/10 bg-white/[0.02] hover:border-white/20"
            }
          `}
        >
          <Upload className="mb-3 h-8 w-8 text-slate-500" />
          <p className="text-sm font-medium text-slate-300">
            Drag & drop a Taboola CSV here
          </p>
          <p className="mt-1 text-xs text-slate-500">
            or click to browse
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            onChange={onFileChange}
            className="absolute inset-0 cursor-pointer opacity-0"
            style={{ position: "absolute", inset: 0 }}
          />
          {/* Make the whole zone clickable */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="relative mt-4"
            onClick={() => inputRef.current?.click()}
          >
            Choose file
          </Button>
        </div>
      )}

      {/* File preview */}
      {step === "preview" && preview && (
        <div className="glass flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-blue-400" />
            <div>
              <p className="text-sm font-medium text-white">{preview.file.name}</p>
              <p className="text-xs text-slate-400">
                {formatBytes(preview.file.size)} · {preview.rowCount.toLocaleString()} rows
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={reset}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleImport}>
              Import
            </Button>
          </div>
        </div>
      )}

      {/* Uploading */}
      {step === "uploading" && (
        <div className="glass flex items-center gap-3 px-4 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
          <div>
            <p className="text-sm font-medium text-white">Importing…</p>
            <p className="text-xs text-slate-400">
              Processing {preview?.rowCount?.toLocaleString() ?? "—"} rows
            </p>
          </div>
        </div>
      )}

      {/* Success */}
      {step === "success" && result?.success && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-emerald-300">
                Import complete
              </p>
              <p className="mt-1 text-xs text-emerald-400/80">
                {result.totalRows.toLocaleString()} rows processed ·{" "}
                {result.upserted.toLocaleString()} upserted
              </p>
              {result.parseErrors.length > 0 && (
                <p className="mt-1 text-xs text-amber-400/80">
                  {result.parseErrors.length} parse warning(s)
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={reset}>
              Upload another
            </Button>
          </div>
        </div>
      )}

      {/* Error */}
      {step === "error" && result && !result.success && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-red-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-300">
                Import failed
              </p>
              <p className="mt-1 text-xs text-red-400/80">{result.error}</p>
              {result.parseErrors && result.parseErrors.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-red-400/60 hover:text-red-400">
                    {result.parseErrors.length} parse error(s)
                  </summary>
                  <ul className="mt-1 max-h-32 overflow-y-auto text-xs text-red-400/60">
                    {result.parseErrors.slice(0, 20).map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                    {result.parseErrors.length > 20 && (
                      <li>…and {result.parseErrors.length - 20} more</li>
                    )}
                  </ul>
                </details>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={reset}>
              Try again
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
