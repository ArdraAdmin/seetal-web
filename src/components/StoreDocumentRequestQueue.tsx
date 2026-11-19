"use client";

import { useCallback, useEffect, useState } from "react";
import {
  approveStoreDocumentRequest,
  listStoreDocumentRequests,
  rejectStoreDocumentRequest,
  type StoreDocumentRequestRow,
} from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { Card, PrimaryButton, SecondaryButton } from "@/components/ui";
import { formatTradeLicenseDate } from "@/lib/store-documents";

function changeSummary(row: StoreDocumentRequestRow) {
  const parts: string[] = [];
  if (row.updateTradeLicenseExpiry) {
    parts.push(
      `License expiry → ${formatTradeLicenseDate(row.tradeLicenseExpiry) || "—"}`,
    );
  }
  if (row.updateTradeLicenseDocument) parts.push("New trade license document");
  if (row.updateEidNumber) parts.push(`EID → ${row.eidNumber || "—"}`);
  if (row.updateEidDocument) {
    parts.push(
      row.eidDocumentFileName
        ? `New EID document (${row.eidDocumentFileName})`
        : "New EID document",
    );
  }
  return parts;
}

export function StoreDocumentRequestQueue({
  environment,
}: {
  environment?: "stl" | "shmp";
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<StoreDocumentRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    if (!user?.id || user.role !== "Admin") {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await listStoreDocumentRequests(user.id, environment);
      setRows(data.requests || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [environment, user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (user?.role !== "Admin") return null;
  if (!loading && rows.length === 0) return null;

  async function onApprove(row: StoreDocumentRequestRow) {
    if (!user?.id) return;
    setBusyId(row.id);
    try {
      await approveStoreDocumentRequest(user.id, row.id);
      toast(`${row.storeName} document update approved`, "success");
      await load();
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Could not approve the update",
        "error",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function onReject(row: StoreDocumentRequestRow) {
    if (!user?.id) return;
    setBusyId(row.id);
    try {
      await rejectStoreDocumentRequest(user.id, row.id, note.trim());
      toast(`${row.storeName} document update rejected`, "success");
      setRejecting(null);
      setNote("");
      await load();
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Could not reject the update",
        "error",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card className="mb-5">
      <h2 className="font-semibold text-ink">Store document updates waiting</h2>
      <p className="mt-1 text-xs text-slate-500">
        Salesmen submitted trade license and/or EID changes. Approving updates the
        live store.
      </p>
      {loading ? (
        <p className="mt-3 text-sm text-slate-500">Loading document requests…</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {rows.map((row) => {
            const changes = changeSummary(row);
            return (
              <li key={row.id} className="rounded-xl border border-line p-3">
                <p className="font-medium text-ink">{row.storeName}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {row.environment === "shmp" ? "SHMP" : "STL"}
                  {row.requestedByName ? ` · ${row.requestedByName}` : ""}
                </p>
                {row.currentEidNumber || row.currentTradeLicenseExpiry ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Current:{" "}
                    {formatTradeLicenseDate(row.currentTradeLicenseExpiry) || "No expiry"}
                    {row.currentEidNumber ? ` · EID ${row.currentEidNumber}` : ""}
                  </p>
                ) : null}
                {changes.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-0.5 pl-4 text-sm text-slate-700">
                    {changes.map((change) => (
                      <li key={change}>{change}</li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {row.tradeLicenseDocumentUrl ? (
                    <a
                      href={row.tradeLicenseDocumentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-brand-dark underline"
                    >
                      View license document
                    </a>
                  ) : null}
                  {row.eidDocumentUrl ? (
                    <a
                      href={row.eidDocumentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-brand-dark underline"
                    >
                      View EID document
                    </a>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <PrimaryButton
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void onApprove(row)}
                  >
                    Approve
                  </PrimaryButton>
                  <SecondaryButton
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => {
                      setRejecting(row.id);
                      setNote("");
                    }}
                  >
                    Reject
                  </SecondaryButton>
                </div>
                {rejecting === row.id ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Note for the salesman"
                      aria-label="Rejection note"
                      className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2 text-sm"
                    />
                    <SecondaryButton
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => void onReject(row)}
                    >
                      Confirm reject
                    </SecondaryButton>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
