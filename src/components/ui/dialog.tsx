"use client";

/**
 * Minimal Dialog component — no extra Radix dependency needed.
 *
 * Renders into document.body via createPortal (avoids sidebar z-index stacking).
 * Handles Escape key, backdrop click, and body scroll-lock.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DialogProps {
  open:         boolean;
  onClose:      () => void;
  title:        string;
  description?: string;
  children:     React.ReactNode;
  /** Extra classes for the panel wrapper (e.g. max-w override) */
  className?:   string;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: DialogProps) {
  const [mounted, setMounted] = useState(false);

  // Ensure we never attempt createPortal during SSR
  useEffect(() => {
    setMounted(true);
  }, []);

  // Escape key + scroll-lock
  useEffect(() => {
    if (!open) return;

    document.body.style.overflow = "hidden";

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={cn(
          "relative z-10 w-full max-w-lg rounded-xl border border-white/10 bg-slate-900/90 shadow-2xl backdrop-blur-xl",
          className,
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h2
              id="dialog-title"
              className="text-base font-semibold text-white"
            >
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-xs text-slate-400">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-4 shrink-0 rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
