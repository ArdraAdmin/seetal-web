"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  addVehicle,
  deleteVehicle,
  editVehicle,
  getVehicles,
} from "@/lib/api";
import type { Vehicle } from "@/lib/types";
import { useToast } from "@/components/Toast";
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

export default function VehiclesPage() {
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [number, setNumber] = useState("");
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getVehicles();
      setVehicles(Array.isArray(data) ? data : []);
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
      if (editing) {
        await editVehicle(editing._id, n);
        toast("Vehicle updated", "success");
      } else {
        await addVehicle(n);
        toast("Vehicle added", "success");
      }
      setNumber("");
      setEditing(null);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this vehicle?")) return;
    try {
      await deleteVehicle(id);
      toast("Vehicle deleted", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Delete failed", "error");
    }
  }

  function startEdit(v: Vehicle) {
    setEditing(v);
    setNumber(String(v.value ?? ""));
  }

  return (
    <div>
      <PageHeader
        title="Vehicles"
        subtitle="Maintain vehicle numbers used for dispatch."
        actions={
          <SecondaryButton type="button" onClick={() => void load()}>
            Refresh
          </SecondaryButton>
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
            {editing ? "Update" : "Add vehicle"}
          </PrimaryButton>
          {editing ? (
            <SecondaryButton
              type="button"
              onClick={() => {
                setEditing(null);
                setNumber("");
              }}
            >
              Cancel
            </SecondaryButton>
          ) : null}
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
          {vehicles.map((v) => (
            <Card
              key={v._id}
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="font-semibold text-slate-900">#{v.value}</p>
              <div className="flex gap-2">
                <SecondaryButton type="button" onClick={() => startEdit(v)}>
                  Edit
                </SecondaryButton>
                <SecondaryButton
                  type="button"
                  className="border-red-200 text-red-700"
                  onClick={() => void onDelete(v._id)}
                >
                  Delete
                </SecondaryButton>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
