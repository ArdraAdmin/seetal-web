"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  addDriver,
  deleteDriver,
  editDriver,
  getDrivers,
} from "@/lib/api";
import type { Driver } from "@/lib/types";
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

export default function DriversPage() {
  const { toast } = useToast();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [editing, setEditing] = useState<Driver | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDrivers();
      setDrivers(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load drivers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await editDriver(editing._id, name.trim(), phone.trim());
        toast("Driver updated", "success");
      } else {
        await addDriver(name.trim(), phone.trim());
        toast("Driver added", "success");
      }
      setName("");
      setPhone("");
      setEditing(null);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this driver?")) return;
    try {
      await deleteDriver(id);
      toast("Driver deleted", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Delete failed", "error");
    }
  }

  function startEdit(d: Driver) {
    setEditing(d);
    setName(d.name);
    setPhone(d.phoneNo);
  }

  return (
    <div>
      <PageHeader
        title="Drivers"
        subtitle="Maintain driver names and contact numbers."
        actions={
          <SecondaryButton type="button" onClick={() => void load()}>
            Refresh
          </SecondaryButton>
        }
      />

      <Card className="mb-5">
        <form
          onSubmit={onSubmit}
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]"
        >
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Driver name"
          />
          <TextField
            label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            placeholder="Phone number"
          />
          <div className="flex items-end gap-2 sm:col-span-2">
            <PrimaryButton type="submit" disabled={saving}>
              {editing ? "Update" : "Add driver"}
            </PrimaryButton>
            {editing ? (
              <SecondaryButton
                type="button"
                onClick={() => {
                  setEditing(null);
                  setName("");
                  setPhone("");
                }}
              >
                Cancel
              </SecondaryButton>
            ) : null}
          </div>
        </form>
      </Card>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : drivers.length === 0 ? (
        <EmptyState title="No drivers yet" description="Add a driver above." />
      ) : (
        <div className="space-y-3">
          {drivers.map((d) => (
            <Card
              key={d._id}
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{d.name}</p>
                <p className="text-sm text-slate-500">{d.phoneNo}</p>
              </div>
              <div className="flex gap-2">
                <SecondaryButton type="button" onClick={() => startEdit(d)}>
                  Edit
                </SecondaryButton>
                <SecondaryButton
                  type="button"
                  className="border-red-200 text-red-700"
                  onClick={() => void onDelete(d._id)}
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
