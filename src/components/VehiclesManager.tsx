"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  addVehicle,
  deleteVehicle,
  getVehicleExtrasMap,
  getVehicles,
} from "@/lib/api";
import type { Vehicle, VehicleExtras } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { fmtDateOnly } from "@/components/StlFeatureUi";
import { salesMoney } from "@/lib/sales";
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from "@/components/ui";

function vehicleLabel(v: Vehicle) {
  return v.value == null || v.value === "" ? "Vehicle" : `#${v.value}`;
}

function extraLine(extras?: VehicleExtras) {
  if (!extras) return null;
  const bits: string[] = [];
  if (extras.purchaseYear) bits.push(`Purchased ${extras.purchaseYear}`);
  if (extras.purchaseFrom) bits.push(`from ${extras.purchaseFrom}`);
  if (extras.price != null) bits.push(salesMoney(Number(extras.price)));
  if (extras.mulkyaExpiry) {
    bits.push(`Mulkya ${fmtDateOnly(extras.mulkyaExpiry)}`);
  }
  if (extras.insurancePremium != null) {
    bits.push(`Insurance ${salesMoney(Number(extras.insurancePremium))}`);
  }
  return bits.length ? bits.join(" · ") : null;
}

export function VehiclesManager({
  driversHref,
  vehicleHref,
}: {
  driversHref: string;
  vehicleHref: (id: string) => string;
}) {
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [extras, setExtras] = useState<Record<string, VehicleExtras>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [number, setNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getVehicles();
      const list = Array.isArray(data) ? data : [];
      setVehicles(list);
      try {
        const extraData = await getVehicleExtrasMap(list.map((v) => v._id));
        setExtras(extraData.extras || {});
      } catch {
        setExtras({});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load vehicles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const n = Number(number);
    if (!Number.isFinite(n)) {
      toast("Enter a valid vehicle number", "error");
      return;
    }
    setSaving(true);
    try {
      await addVehicle(n);
      toast("Vehicle added", "success");
      setNumber("");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this vehicle?")) return;
    setDeletingId(id);
    try {
      await deleteVehicle(id);
      toast("Vehicle deleted", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Delete failed", "error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Vehicles"
        subtitle="Shared vehicle records used by both STL and SHMP. Open a vehicle to edit details and add maintenance."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={driversHref}
              className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#f7f5f0]"
            >
              Drivers
            </Link>
            <SecondaryButton type="button" onClick={() => void load()}>
              Refresh
            </SecondaryButton>
          </div>
        }
      />

      <Card className="mb-5">
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 w-full flex-1 sm:min-w-[200px]">
            <TextField
              label="Vehicle number"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              required
              placeholder="e.g. 1234"
            />
          </div>
          <PrimaryButton type="submit" disabled={saving}>
            Add vehicle
          </PrimaryButton>
        </form>
      </Card>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : vehicles.length === 0 ? (
        <EmptyState
          title="No vehicles yet"
          description="Add a vehicle number above."
        />
      ) : (
        <div className="space-y-3">
          {vehicles.map((v) => {
            const summary = extraLine(extras[v._id]);
            return (
              <Card
                key={v._id}
                className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <Link href={vehicleHref(v._id)} className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">
                    {vehicleLabel(v)}
                  </p>
                  {summary ? (
                    <p className="mt-0.5 text-sm text-slate-500">{summary}</p>
                  ) : (
                    <p className="mt-0.5 text-sm text-slate-400">
                      Open to add purchase details and maintenance
                    </p>
                  )}
                </Link>
                <div className="flex gap-2">
                  <Link
                    href={vehicleHref(v._id)}
                    className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#f7f5f0]"
                  >
                    Open
                  </Link>
                  <SecondaryButton
                    type="button"
                    className="border-red-200 text-red-700"
                    disabled={deletingId === v._id}
                    onClick={() => void onDelete(v._id)}
                  >
                    {deletingId === v._id ? "Deleting…" : "Delete"}
                  </SecondaryButton>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
