"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { SelectField, fmtDateOnly } from "@/components/StlFeatureUi";
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
import { getAdminPerformance } from "@/lib/api";
import { salesMoney } from "@/lib/sales";
import {
  addFleetExpense,
  getFleetExpenses,
  getFleetReminders,
  getFleetVehicles,
  saveFleetVehicle,
  updateFleetVehicleAccess,
  type FleetVehicle,
} from "@/lib/stl-features-api";

type Person = { id: string; name: string };
type ExpenseCategory = "tyre" | "repair" | "fuel" | "other";

function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  return "";
}

const EMPTY_VEHICLE = {
  plateNumber: "",
  make: "",
  model: "",
  ownershipCompany: "",
  ownershipType: "",
  purchaseDate: "",
  purchasePrice: "",
  mulkiyaExpiry: "",
  insuranceExpiry: "",
};

function VehicleDetail({
  vehicle,
  people,
  onChanged,
}: {
  vehicle: FleetVehicle;
  people: Person[];
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<unknown[]>([]);
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState<ExpenseCategory>("fuel");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [odometer, setOdometer] = useState("");
  const [allowed, setAllowed] = useState<string[]>(
    (vehicle.allowedUsers || []).map((u) => u._id),
  );

  const loadExpenses = useCallback(async () => {
    try {
      setExpenses((await getFleetExpenses(vehicle._id)).expenses || []);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load expenses", "error");
    }
  }, [vehicle._id, toast]);

  useEffect(() => {
    void loadExpenses();
  }, [loadExpenses]);

  async function onAddExpense(e: FormEvent) {
    e.preventDefault();
    if (!user?.id) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast("Enter an amount", "info");
      return;
    }
    setBusy(true);
    try {
      await addFleetExpense(user.id, vehicle._id, {
        category,
        amount: value,
        description: description.trim() || undefined,
        expenseDate: expenseDate || undefined,
        odometer: odometer ? Number(odometer) : undefined,
      });
      toast("Expense added", "success");
      setAmount("");
      setDescription("");
      setOdometer("");
      await loadExpenses();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to add expense", "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveAccess() {
    if (!user?.id) return;
    setBusy(true);
    try {
      await updateFleetVehicleAccess(user.id, vehicle._id, allowed);
      toast("Vehicle access updated", "success");
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update access", "error");
    } finally {
      setBusy(false);
    }
  }

  const total = expenses.reduce<number>(
    (sum, x) => sum + (Number((x as Record<string, unknown>).amount) || 0),
    0,
  );
  const knownIds = new Set(people.map((p) => p.id));
  const extra = (vehicle.allowedUsers || []).filter((u) => !knownIds.has(u._id));

  return (
    <div className="mt-4 grid gap-4 border-t border-line pt-4 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-sm font-semibold">Expenses ({salesMoney(total)})</h3>
        <form className="grid gap-2 sm:grid-cols-2" onSubmit={onAddExpense}>
          <SelectField label="Category" value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
            <option value="fuel">Fuel</option>
            <option value="tyre">Tyre</option>
            <option value="repair">Repair</option>
            <option value="other">Other</option>
          </SelectField>
          <TextField label="Amount (AED)" type="number" min={0} step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
          <TextField label="Date" type="date" optional value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
          <TextField label="Odometer" type="number" min={0} optional value={odometer} onChange={(e) => setOdometer(e.target.value)} />
          <div className="sm:col-span-2">
            <TextField label="Description" optional value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <PrimaryButton type="submit" disabled={busy}>Add expense</PrimaryButton>
          </div>
        </form>
        {expenses.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No expenses recorded.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line text-sm">
            {expenses.map((raw, i) => {
              const x = raw as Record<string, unknown>;
              return (
                <li key={str(x._id) || i} className="flex justify-between gap-2 py-2">
                  <div>
                    <p className="font-medium capitalize">{str(x.category)}</p>
                    <p className="text-xs text-slate-500">
                      {fmtDateOnly(str(x.expenseDate) || str(x.createdAt))}
                      {x.description ? ` · ${str(x.description)}` : ""}
                      {x.odometer ? ` · ${str(x.odometer)} km` : ""}
                    </p>
                  </div>
                  <span className="font-medium">{salesMoney(Number(x.amount) || 0)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Who can use this vehicle</h3>
        <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
          {[...people, ...extra.map((u) => ({ id: u._id, name: u.name || u.email || u._id }))].map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowed.includes(p.id)}
                onChange={() =>
                  setAllowed((a) => (a.includes(p.id) ? a.filter((x) => x !== p.id) : [...a, p.id]))
                }
              />
              {p.name}
            </label>
          ))}
          {people.length + extra.length === 0 ? (
            <p className="text-sm text-slate-500">No users available.</p>
          ) : null}
        </div>
        <SecondaryButton className="mt-3" type="button" disabled={busy} onClick={() => void saveAccess()}>
          Save access
        </SecondaryButton>
      </div>
    </div>
  );
}

export default function AdminFleetPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [reminders, setReminders] = useState<unknown[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_VEHICLE);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [v, r, perf] = await Promise.all([
        getFleetVehicles(user.id),
        getFleetReminders(user.id).catch(() => ({ reminders: [] as unknown[] })),
        getAdminPerformance().catch(() => null),
      ]);
      setVehicles(v.vehicles || []);
      setReminders(r.reminders || []);
      setPeople(
        (perf?.salesmen || []).map((s) => ({
          id: s.sales._id,
          name: s.sales.name || s.sales.email || s.sales._id,
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load fleet");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  function set<K extends keyof typeof EMPTY_VEHICLE>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!user?.id) return;
    if (!form.plateNumber.trim()) {
      toast("Plate number is required", "info");
      return;
    }
    setBusy(true);
    try {
      await saveFleetVehicle(user.id, {
        plateNumber: form.plateNumber.trim(),
        make: form.make || undefined,
        model: form.model || undefined,
        ownershipCompany: form.ownershipCompany || undefined,
        ownershipType: form.ownershipType || undefined,
        purchaseDate: form.purchaseDate || undefined,
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : undefined,
        mulkiya: form.mulkiyaExpiry ? { expiryDate: form.mulkiyaExpiry } : undefined,
        insurance: form.insuranceExpiry ? { expiryDate: form.insuranceExpiry } : undefined,
      });
      toast("Vehicle saved", "success");
      setForm(EMPTY_VEHICLE);
      setShowForm(false);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Fleet"
        subtitle="Vehicles, access, expenses (tyre, repair, fuel) and expiry reminders."
        actions={
          <>
            <SecondaryButton type="button" disabled={loading} onClick={() => void load()}>
              Refresh
            </SecondaryButton>
            <PrimaryButton type="button" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Close" : "Add vehicle"}
            </PrimaryButton>
          </>
        }
      />

      {showForm ? (
        <Card className="mb-4">
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={onCreate}>
            <TextField label="Plate number" required value={form.plateNumber} onChange={(e) => set("plateNumber", e.target.value)} />
            <TextField label="Make" optional value={form.make} onChange={(e) => set("make", e.target.value)} />
            <TextField label="Model" optional value={form.model} onChange={(e) => set("model", e.target.value)} />
            <TextField label="Ownership company" optional value={form.ownershipCompany} onChange={(e) => set("ownershipCompany", e.target.value)} />
            <TextField label="Ownership type" optional value={form.ownershipType} onChange={(e) => set("ownershipType", e.target.value)} />
            <TextField label="Purchase date" type="date" optional value={form.purchaseDate} onChange={(e) => set("purchaseDate", e.target.value)} />
            <TextField label="Purchase price (AED)" type="number" min={0} step="0.01" optional value={form.purchasePrice} onChange={(e) => set("purchasePrice", e.target.value)} />
            <TextField label="Mulkiya expiry" type="date" optional value={form.mulkiyaExpiry} onChange={(e) => set("mulkiyaExpiry", e.target.value)} />
            <TextField label="Insurance expiry" type="date" optional value={form.insuranceExpiry} onChange={(e) => set("insuranceExpiry", e.target.value)} />
            <div className="sm:col-span-2 lg:col-span-3">
              <PrimaryButton type="submit" disabled={busy}>Save vehicle</PrimaryButton>
            </div>
          </form>
        </Card>
      ) : null}

      {loading && vehicles.length === 0 ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <div className="space-y-4">
          {reminders.length > 0 ? (
            <Card className="!border-brand">
              <h2 className="text-sm font-semibold text-ink">
                Reminders ({reminders.length})
              </h2>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {reminders.map((raw, i) => {
                  const r = raw as Record<string, unknown>;
                  return (
                    <li key={i}>
                      {str(r.plateNumber) || str(r.vehicle) || "Vehicle"} —{" "}
                      {str(r.type) || str(r.message) || "expiring soon"}
                      {r.expiryDate ? ` (${fmtDateOnly(str(r.expiryDate))})` : ""}
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : null}

          {vehicles.length === 0 ? (
            <EmptyState title="No vehicles yet" />
          ) : (
            vehicles.map((v) => (
              <Card key={v._id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">
                      {v.plateNumber}
                      {v.make || v.model ? ` · ${[v.make, v.model].filter(Boolean).join(" ")}` : ""}
                    </p>
                    <p className="text-sm text-slate-500">
                      {[v.ownershipCompany, v.ownershipType].filter(Boolean).join(" · ") || "—"}
                      {v.purchasePrice != null ? ` · ${salesMoney(v.purchasePrice)}` : ""}
                    </p>
                    <p className="mt-1 text-sm">
                      <span className={v.reminders?.mulkiyaExpiringSoon ? "font-medium text-red-700" : ""}>
                        Mulkiya: {fmtDateOnly(v.mulkiya?.expiryDate)}
                      </span>{" "}
                      ·{" "}
                      <span className={v.reminders?.insuranceExpiringSoon ? "font-medium text-red-700" : ""}>
                        Insurance: {fmtDateOnly(v.insurance?.expiryDate)}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500">
                      Allowed users: {(v.allowedUsers || []).map((u) => u.name || u.email).join(", ") || "none"}
                    </p>
                  </div>
                  <SecondaryButton type="button" onClick={() => setOpenId((id) => (id === v._id ? null : v._id))}>
                    {openId === v._id ? "Hide" : "Expenses & access"}
                  </SecondaryButton>
                </div>
                {openId === v._id ? (
                  <VehicleDetail vehicle={v} people={people} onChanged={() => void load()} />
                ) : null}
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
