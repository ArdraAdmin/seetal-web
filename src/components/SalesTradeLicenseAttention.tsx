"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, X } from "lucide-react";
import { fmtDateOnly } from "@/components/StlFeatureUi";
import { SecondaryButton } from "@/components/ui";
import {
  EXPIRY_ALERT_DAYS,
  expiryUrgencyLabel,
} from "@/lib/expiry-window";
import {
  storeTradeLicenseDue,
  tradeLicenseAlertRows,
} from "@/lib/sales-store-documents";
import { storeTitle } from "@/lib/sales";
import type { StoreProfile } from "@/lib/types";

export function SalesTradeLicenseAttention({
  stores,
  pendingStoreIds,
  onUpdateStore,
}: {
  stores: StoreProfile[];
  pendingStoreIds: Set<string>;
  onUpdateStore: (store: StoreProfile) => void;
}) {
  const [open, setOpen] = useState(false);
  const dueStores = useMemo(
    () => stores.filter((store) => storeTradeLicenseDue(store)),
    [stores],
  );
  const rows = useMemo(() => tradeLicenseAlertRows(dueStores), [dueStores]);
  const count = dueStores.length;

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (count === 0) return null;

  const alert = count > 0;
  const className = `mb-5 flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left shadow-[0_1px_2px_rgba(14,58,50,0.04)] transition hover:border-brand/40 ${
    alert
      ? "border-amber-200 bg-amber-50/80"
      : "border-line bg-white hover:bg-[#faf8f3]"
  }`;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase">
            Trade license expiring
          </p>
          <p
            className={`mt-1 text-xl font-semibold tabular-nums tracking-tight ${
              alert ? "text-amber-900" : "text-ink"
            }`}
          >
            {count}
          </p>
        </div>
        <span
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            alert ? "bg-amber-100 text-amber-800" : "bg-[#f7f5f0] text-slate-500"
          }`}
        >
          <FileText className="h-4 w-4" strokeWidth={1.75} />
        </span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sales-license-alert-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-lg">
            <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div className="min-w-0">
                <h2
                  id="sales-license-alert-title"
                  className="text-lg font-semibold text-ink"
                >
                  Trade licenses due
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Assigned stores whose trade license expires in{" "}
                  {EXPIRY_ALERT_DAYS} days or less, including already expired.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </div>
            <div className="overflow-y-auto">
              {rows.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-slate-500">
                  No trade licenses are due right now.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {rows.map((row) => {
                    const store = dueStores.find((item) => item._id === row.id);
                    const pending = pendingStoreIds.has(row.id);
                    return (
                      <li
                        key={row.id}
                        className="flex items-start justify-between gap-3 px-5 py-3.5"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-ink">
                            {store ? storeTitle(store) : row.title}
                          </p>
                          {row.detail ? (
                            <p className="mt-0.5 text-xs text-slate-500">
                              {row.detail}
                            </p>
                          ) : null}
                          <p className="mt-1 text-sm text-slate-600">
                            {fmtDateOnly(row.expiryDate)}
                          </p>
                          {pending ? (
                            <p className="mt-1 text-xs font-medium text-amber-800">
                              Already under approval
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              row.daysRemaining <= 0
                                ? "bg-red-50 text-red-800"
                                : "bg-amber-50 text-amber-900"
                            }`}
                          >
                            {expiryUrgencyLabel(row.daysRemaining)}
                          </span>
                          {store ? (
                            <SecondaryButton
                              type="button"
                              onClick={() => {
                                setOpen(false);
                                onUpdateStore(store);
                              }}
                            >
                              {pending ? "View" : "Update"}
                            </SecondaryButton>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
