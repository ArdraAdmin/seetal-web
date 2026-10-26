"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  addVehicleMaintenance,
  editVehicle,
  getVehicleDetails,
  getVehicles,
} from "@/lib/api";
import type { Vehicle, VehicleExtras, VehicleMaintenance } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { fmtDateOnly } from "@/components/StlFeatureUi";
import { salesMoney } from "@/lib/sales";
import {
  Card,
  EmptyState,
  ErrorState,
  FieldLabel,
  LoadingState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from "@/components/ui";

type FormState = {
  number: string;
  purchaseYear: string;
  price: string;
  purchaseFrom: string;
  mulkyaExpiry: string;
  insurancePremium: string;
};

const EMPTY_FORM: FormState = {
  number: "",
  purchaseYear: "",
  price: "",
  purchaseFrom: "",
  mulkyaExpiry: "",
  insurancePremium: "",
};

function asForm(vehicle: Vehicle, extras: VehicleExtras): FormState {
  return {
    number: vehicle.value == null ? "" : String(vehicle.value),
    purchaseYear:
      extras.purchaseYear == null ? "" : String(extras.purchaseYear),
    price: extras.price == null ? "" : String(extras.price),
    purchaseFrom: extras.purchaseFrom ?? "",
    mulkyaExpiry: extras.mulkyaExpiry
      ? String(extras.mulkyaExpiry).slice(0, 10)
      : "",
    insurancePremium:
      extras.insurancePremium == null ? "" : String(extras.insurancePremium),
  };
}

function extrasFromForm(form: FormState): VehicleExtras {
  return {
    purchaseYear: form.purchaseYear === "" ? null : Number(form.purchaseYear),
    price: form.price === "" ? null : Number(form.price),
    purchaseFrom: form.purchaseFrom.trim() || null,
    mulkyaExpiry: form.mulkyaExpiry || null,
    insurancePremium:
      form.insurancePremium === "" ? null : Number(form.insurancePremium),
  };
}

export function VehicleDetailView({ listHref }: { listHref: string }) {
  const params = useParams<{ id: string }>();
  const id = String(params?.id || "");
  const { toast } = useToast();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [maintenance, setMaintenance] = useState<VehicleMaintenance[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [list, details] = await Promise.all([
        getVehicles(),
        getVehicleDetails(id),
      ]);
      const found = (Array.isArray(list) ? list : []).find((v) => v._id === id);
      if (!found) {
        setVehicle(null);
        setError("Vehicle not found");
        return;
      }
      setVehicle(found);
      setForm(asForm(found, details.extras || {}));
      setMaintenance(details.maintenance || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load vehicle");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  function setField<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!vehicle) return;
    const n = Number(form.number);
    if (!Number.isFinite(n)) {
      toast("Enter a valid vehicle number", "error");
      return;
    }
    setSaving(true);
    try {
      await editVehicle(vehicle._id, n, extrasFromForm(form));
      toast("Vehicle updated", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function onAddMaintenance(e: FormEvent) {
    e.preventDefault();
    if (!vehicle) return;
    const value = Number(amount);
    if (!title.trim()) {
      toast("Enter a maintenance title", "error");
      return;
    }
    if (!Number.isFinite(value) || value < 0) {
      toast("Enter a valid amount", "error");
      return;
    }
    if (!date) {
      toast("Enter a maintenance date", "error");
      return;
    }
    setAdding(true);
    try {
      await addVehicleMaintenance(vehicle._id, {
        title: title.trim(),
        amount: value,
        description: description.trim(),
        date,
      });
      toast("Maintenance added", "success");
      setTitle("");
      setAmount("");
      setDescription("");
      setDate("");
      setShowAdd(false);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Add failed", "error");
    } finally {
      setAdding(false);
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Vehicle" subtitle="Loading vehicle details…" />
        <LoadingState />
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div>
        <PageHeader
          title="Vehicle"
          actions={
            <Link
              href={listHref}
              className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#f7f5f0]"
            >
              Back to vehicles
            </Link>
          }
        />
        <ErrorState
          message={error || "Vehicle not found"}
          onRetry={() => void load()}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Vehicle #${vehicle.value}`}
        subtitle="Edit purchase details and keep a maintenance history for this vehicle."
        actions={
          <Link
            href={listHref}
            className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#f7f5f0]"
          >
            Back to vehicles
          </Link>
        }
      />

      <Card className="mb-6">
        <form onSubmit={onSave} className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Vehicle number"
            value={form.number}
            onChange={(e) => setField("number", e.target.value)}
            required
          />
          <TextField
            label="Purchase year"
            type="number"
            optional
            value={form.purchaseYear}
            onChange={(e) => setField("purchaseYear", e.target.value)}
            placeholder="e.g. 2022"
          />
          <TextField
            label="Price"
            type="number"
            optional
            min="0"
            step="0.01"
            value={form.price}
            onChange={(e) => setField("price", e.target.value)}
            placeholder="0.00"
          />
          <TextField
            label="Purchase from"
            optional
            value={form.purchaseFrom}
            onChange={(e) => setField("purchaseFrom", e.target.value)}
            placeholder="Dealer or seller"
          />
          <TextField
            label="Mulkya expiry"
            type="date"
            optional
            value={form.mulkyaExpiry}
            onChange={(e) => setField("mulkyaExpiry", e.target.value)}
          />
          <TextField
            label="Insurance premium"
            type="number"
            optional
            min="0"
            step="0.01"
            value={form.insurancePremium}
            onChange={(e) => setField("insurancePremium", e.target.value)}
            placeholder="0.00"
          />
          <div className="sm:col-span-2">
            <PrimaryButton type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save vehicle"}
            </PrimaryButton>
          </div>
        </form>
      </Card>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink">Maintenance</h2>
          <p className="text-sm text-slate-500">
            Records attached to this vehicle only.
          </p>
        </div>
        <PrimaryButton
          type="button"
          onClick={() => setShowAdd((open) => !open)}
        >
          {showAdd ? "Cancel" : "Add maintenance"}
        </PrimaryButton>
      </div>

      {showAdd ? (
        <Card className="mb-5">
          <form onSubmit={onAddMaintenance} className="grid gap-3 sm:grid-cols-2">
            <TextField
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. Oil change"
            />
            <TextField
              label="Amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="0.00"
            />
            <TextField
              label="Date of maintenance"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            <label className="block space-y-1.5 sm:col-span-2">
              <FieldLabel label="Description" optional />
              <textarea
                className="min-h-24 w-full rounded-lg border border-line bg-white px-3 py-2 text-base text-ink outline-none placeholder:text-slate-400 focus:border-brand focus:ring-1 focus:ring-brand sm:text-sm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What was done"
              />
            </label>
            <div>
              <PrimaryButton type="submit" disabled={adding}>
                {adding ? "Adding…" : "Save maintenance"}
              </PrimaryButton>
            </div>
          </form>
        </Card>
      ) : null}

      {maintenance.length === 0 ? (
        <EmptyState
          title="No maintenance yet"
          description="Use Add maintenance to attach the first record."
        />
      ) : (
        <div className="space-y-3">
          {maintenance.map((item) => (
            <Card key={item._id}>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{item.title}</p>
                  {item.description ? (
                    <p className="mt-1 text-sm text-slate-600">
                      {item.description}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-sm text-slate-500 sm:text-right">
                  <p className="font-medium text-ink">
                    {salesMoney(Number(item.amount) || 0)}
                  </p>
                  <p>{fmtDateOnly(item.date)}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
