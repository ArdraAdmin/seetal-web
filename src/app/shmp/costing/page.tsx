"use client";

import { useEffect, useState } from "react";
import {
  shmpComputeCost,
  shmpCostProducts,
  shmpSnapshotCost,
} from "@/lib/shmp-api";

type Prod = {
  _id: string;
  itemRef?: string;
  itemName?: string;
  description?: string;
  dimensions?: string;
  weight?: number;
  ratio?: number;
};

export default function ShmpCostingPage() {
  const [companyId, setCompanyId] = useState("");
  const [products, setProducts] = useState<Prod[]>([]);
  const [selected, setSelected] = useState("");
  const [computed, setComputed] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    shmpCostProducts(companyId || undefined)
      .then((list) => setProducts(list as Prod[]))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [companyId]);

  async function compute() {
    if (!selected) return;
    try {
      setComputed(await shmpComputeCost(selected));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Compute failed");
    }
  }

  async function snapshot() {
    if (!selected) return;
    try {
      await shmpSnapshotCost(selected, companyId || undefined);
      await compute();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Snapshot failed");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Product Costing</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manufacturing cost from RM BOM prices. Historical snapshots are never
          rewritten when prices change. Client-specific formulas can be plugged
          into formula parameters later.
        </p>
      </div>
      <label className="block max-w-md text-sm">
        Company ID filter
        <input
          className="mt-1 w-full rounded-xl border border-line px-3 py-2"
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
        />
      </label>
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-semibold">Product database</h2>
          <ul className="mt-3 max-h-96 space-y-1 overflow-y-auto text-sm">
            {products.map((p) => (
              <li key={p._id}>
                <button
                  type="button"
                  className={`w-full rounded-lg px-2 py-1.5 text-left ${
                    selected === p._id ? "bg-brand/20" : "hover:bg-slate-50"
                  }`}
                  onClick={() => setSelected(p._id)}
                >
                  <span className="font-medium">{p.itemRef}</span>{" "}
                  {p.itemName}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-semibold">Cost working</h2>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void compute()}
              className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold"
              disabled={!selected}
            >
              Compute from BOM
            </button>
            <button
              type="button"
              onClick={() => void snapshot()}
              className="rounded-xl border border-line px-4 py-2 text-sm"
              disabled={!selected}
            >
              Save snapshot
            </button>
          </div>
          <pre className="mt-4 max-h-80 overflow-auto rounded-xl bg-slate-50 p-3 text-xs">
            {computed ? JSON.stringify(computed, null, 2) : "Select a product"}
          </pre>
        </div>
      </div>
    </div>
  );
}
