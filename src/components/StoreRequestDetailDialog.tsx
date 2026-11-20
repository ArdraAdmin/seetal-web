"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import type { StoreRequestRow } from "@/lib/api";
import { formatTradeLicenseDate } from "@/lib/store-documents";
import { PrimaryButton, SecondaryButton } from "@/components/ui";

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  if (!value.trim()) return null;
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-2 text-sm">
      <p className="text-slate-500">{label}</p>
      <p className="whitespace-pre-wrap text-ink">{value}</p>
    </div>
  );
}

function addressBlock(row: StoreRequestRow) {
  return [row.addressLine1, row.addressLine2, row.addressLine3]
    .map((line) => String(line || "").trim())
    .filter(Boolean)
    .join("\n");
}

export function StoreRequestDetailDialog({
  row,
  busy,
  rejecting,
  note,
  onNoteChange,
  onClose,
  onApprove,
  onStartReject,
  onConfirmReject,
}: {
  row: StoreRequestRow;
  busy: boolean;
  rejecting: boolean;
  note: string;
  onNoteChange: (value: string) => void;
  onClose: () => void;
  onApprove: () => void;
  onStartReject: () => void;
  onConfirmReject: () => void;
}) {
  const location = [row.city, row.country].filter(Boolean).join(", ");
  const expiry = formatTradeLicenseDate(row.tradeLicenseExpiry) || "—";

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="store-request-detail-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-lg">
        <div className="flex items-start justify-between gap-2 border-b border-line px-5 py-4">
          <div>
            <h2
              id="store-request-detail-title"
              className="text-lg font-semibold text-ink"
            >
              Store request
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Review every submitted detail before approving or rejecting.
            </p>
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

        <div className="space-y-3 overflow-y-auto px-5 py-4">
          <DetailRow label="Store name" value={row.storeName} />
          <DetailRow
            label="Environment"
            value={row.environment === "shmp" ? "SHMP" : "STL"}
          />
          <DetailRow label="Submitted by" value={row.requestedByName || ""} />
          <DetailRow label="Alias" value={row.alias || ""} />
          <DetailRow label="Marks" value={row.marks || ""} />
          <DetailRow label="Phone" value={row.contactNumber || ""} />
          <DetailRow label="Address" value={addressBlock(row)} />
          <DetailRow label="City / country" value={location} />
          <DetailRow label="Trade license expiry" value={expiry} />
          <DetailRow label="EID number" value={row.eidNumber || ""} />

          <div className="space-y-2 border-t border-line pt-3">
            <p className="text-sm font-medium text-ink">Documents</p>
            <div className="flex flex-wrap gap-3 text-sm">
              {row.trnDocumentUrl ? (
                <a
                  href={row.trnDocumentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-brand-dark underline"
                >
                  View TRN document
                </a>
              ) : (
                <span className="text-slate-500">No TRN document</span>
              )}
              {row.tradeLicenseDocumentUrl ? (
                <a
                  href={row.tradeLicenseDocumentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-brand-dark underline"
                >
                  View trade license
                </a>
              ) : (
                <span className="text-slate-500">No trade license document</span>
              )}
              {row.eidDocumentUrl ? (
                <a
                  href={row.eidDocumentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-brand-dark underline"
                >
                  {row.eidDocumentFileName
                    ? `View EID (${row.eidDocumentFileName})`
                    : "View EID document"}
                </a>
              ) : (
                <span className="text-slate-500">No EID document</span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t border-line px-5 py-4">
          <div className="flex flex-wrap justify-end gap-2">
            <SecondaryButton type="button" onClick={onClose} disabled={busy}>
              Close
            </SecondaryButton>
            <SecondaryButton
              type="button"
              disabled={busy}
              onClick={onStartReject}
            >
              Reject
            </SecondaryButton>
            <PrimaryButton type="button" disabled={busy} onClick={onApprove}>
              {busy ? "Working…" : "Approve"}
            </PrimaryButton>
          </div>
          {rejecting ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={note}
                onChange={(event) => onNoteChange(event.target.value)}
                placeholder="Note for the salesman"
                aria-label="Rejection note"
                className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2 text-sm"
              />
              <SecondaryButton
                type="button"
                disabled={busy}
                onClick={onConfirmReject}
              >
                Confirm reject
              </SecondaryButton>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
