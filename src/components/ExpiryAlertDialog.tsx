"use client";

import Link from "next/link";
import { useEffect } from "react";
import { X } from "lucide-react";
import { fmtDateOnly } from "@/components/StlFeatureUi";
import { expiryUrgencyLabel, type ExpiryAlertRow } from "@/lib/expiry-window";

export function ExpiryAlertDialog({
  title,
  subtitle,
  empty,
  rows,
  open,
  onClose,
}: {
  title: string;
  subtitle: string;
  empty: string;
  rows: ExpiryAlertRow[];
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="expiry-alert-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-lg">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2
              id="expiry-alert-title"
              className="text-lg font-semibold text-ink"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>
        <div className="overflow-y-auto">
          {rows.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              {empty}
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((row) => (
                <li key={`${row.href}-${row.id}`}>
                  <Link
                    href={row.href}
                    className="flex items-start justify-between gap-3 px-5 py-3.5 transition hover:bg-[#faf8f3]"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{row.title}</p>
                      {row.detail ? (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {row.detail}
                        </p>
                      ) : null}
                      <p className="mt-1 text-sm text-slate-600">
                        {fmtDateOnly(row.expiryDate)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.daysRemaining <= 0
                          ? "bg-red-50 text-red-800"
                          : "bg-amber-50 text-amber-900"
                      }`}
                    >
                      {expiryUrgencyLabel(row.daysRemaining)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
