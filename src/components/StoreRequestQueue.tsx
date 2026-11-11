"use client";

import { useCallback, useEffect, useState } from "react";
import {
  approveStoreRequest,
  listStoreRequests,
  rejectStoreRequest,
  type StoreRequestRow,
} from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { Card, PrimaryButton, SecondaryButton } from "@/components/ui";

export function StoreRequestQueue({
  environment,
}: {
  environment?: "stl" | "shmp";
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<StoreRequestRow[]>([]);
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
      const data = await listStoreRequests(user.id, environment);
      setRows(data.requests || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [environment, user?.id, user?.role]);

  useEffect(() => {
    void load();
  }, [load]);

  if (user?.role !== "Admin") return null;
  if (!loading && rows.length === 0) return null;

  async function onApprove(row: StoreRequestRow) {
    if (!user?.id) return;
    setBusyId(row.id);
    try {
      const saved = await approveStoreRequest(user.id, row.id);
      toast(
        saved.store?.uid
          ? `${row.storeName} approved as ${saved.store.uid}`
          : `${row.storeName} approved`,
        "success",
      );
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not approve the store", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function onReject(row: StoreRequestRow) {
    if (!user?.id) return;
    setBusyId(row.id);
    try {
      await rejectStoreRequest(user.id, row.id, note.trim());
      toast(`${row.storeName} rejected`, "success");
      setRejecting(null);
      setNote("");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not reject the store", "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card className="mb-5">
      <h2 className="font-semibold text-ink">Stores waiting for approval</h2>
      <p className="mt-1 text-xs text-slate-500">
        A salesman submitted these. Approving creates the store and assigns the next store code.
      </p>
      {loading ? (
        <p className="mt-3 text-sm text-slate-500">Loading store requests…</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-xl border border-line p-3">
              <p className="font-medium text-ink">{row.storeName}</p>
              <p className="mt-1 text-xs text-slate-500">
                {row.environment === "shmp" ? "SHMP" : "STL"}
                {row.requestedByName ? ` · ${row.requestedByName}` : ""}
                {row.city ? ` · ${row.city}` : ""}
                {row.country ? `, ${row.country}` : ""}
              </p>
              {row.addressLine1 ? (
                <p className="mt-1 text-sm text-slate-700">{row.addressLine1}</p>
              ) : null}
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
          ))}
        </ul>
      )}
    </Card>
  );
}
