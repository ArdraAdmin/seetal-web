"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  shmpAddVehicleExpense,
  shmpAddVehicleService,
  shmpCreateFleetVehicle,
  shmpFleetVehicles,
} from "@/lib/shmp-api";

type Fleet = {
  _id: string;
  plateNumber: string;
  ownershipCompany: string;
  currentOdometer?: number;
  mulkiya?: { expiryDate?: string };
  insurance?: { expiryDate?: string };
};

export default function ShmpVehiclesPage() {
  const [ownership, setOwnership] = useState("SHMP");
  const [list, setList] = useState<Fleet[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [plate, setPlate] = useState("");
  const [selected, setSelected] = useState("");
  const [odometer, setOdometer] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  async function refresh() {
    try {
      setList((await shmpFleetVehicles(ownership)) as Fleet[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownership]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await shmpCreateFleetVehicle({
        ownershipCompany: ownership,
        plateNumber: plate,
        mulkiya: {},
        insurance: {},
      });
      setPlate("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function onExpense(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    try {
      await shmpAddVehicleExpense(selected, {
        odometer: Number(odometer),
        amount: Number(amount),
        description,
        expenseDate: new Date().toISOString(),
      });
      setDescription("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Expense requires odometer");
    }
  }

  async function onService(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    try {
      await shmpAddVehicleService(selected, {
        odometer: Number(odometer),
        description,
        serviceDate: new Date().toISOString(),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Service failed");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Vehicle Maintenance</h1>
        <p className="mt-1 text-sm text-slate-600">
          Fleet registry separate from warehouse dispatch vehicle numbers.
          Ownership: SHMP / Seetal / STL / Personal.
        </p>
      </div>
      <select
        className="rounded-xl border border-line px-3 py-2 text-sm"
        value={ownership}
        onChange={(e) => setOwnership(e.target.value)}
      >
        <option>SHMP</option>
        <option>Seetal</option>
        <option>STL</option>
        <option>Personal</option>
      </select>
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={onCreate} className="space-y-2 rounded-2xl border border-line bg-white p-5">
          <h2 className="font-semibold">Register vehicle</h2>
          <input
            className="w-full rounded-xl border border-line px-3 py-2 text-sm"
            placeholder="Plate / Mulkiya number"
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
          />
          <button type="submit" className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold">
            Create
          </button>
        </form>
        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-semibold">Fleet ({list.length})</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {list.map((v) => (
              <li key={v._id}>
                <button
                  type="button"
                  className={`w-full rounded-xl border px-3 py-2 text-left ${
                    selected === v._id ? "border-brand bg-brand/10" : "border-line"
                  }`}
                  onClick={() => setSelected(v._id)}
                >
                  <span className="font-medium">{v.plateNumber}</span>
                  <span className="ml-2 text-xs text-slate-500">
                    odo {v.currentOdometer || 0}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <form onSubmit={onExpense} className="space-y-2 rounded-2xl border border-line bg-white p-5">
          <h2 className="font-semibold">Expense (odometer required)</h2>
          <input className="w-full rounded-xl border border-line px-3 py-2 text-sm" placeholder="Odometer" value={odometer} onChange={(e) => setOdometer(e.target.value)} />
          <input className="w-full rounded-xl border border-line px-3 py-2 text-sm" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <input className="w-full rounded-xl border border-line px-3 py-2 text-sm" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <button type="submit" className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold" disabled={!selected}>
            Add expense
          </button>
        </form>
        <form onSubmit={onService} className="space-y-2 rounded-2xl border border-line bg-white p-5">
          <h2 className="font-semibold">Servicing</h2>
          <input className="w-full rounded-xl border border-line px-3 py-2 text-sm" placeholder="Odometer" value={odometer} onChange={(e) => setOdometer(e.target.value)} />
          <input className="w-full rounded-xl border border-line px-3 py-2 text-sm" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <button type="submit" className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold" disabled={!selected}>
            Add service
          </button>
        </form>
      </div>
    </div>
  );
}
