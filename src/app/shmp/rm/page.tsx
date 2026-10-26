"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  shmpCreateMaterial,
  shmpExpectedRm,
  shmpIssueRm,
  shmpRmMaterials,
  shmpSaveBom,
  shmpStockIn,
} from "@/lib/shmp-api";

type Material = {
  _id: string;
  name: string;
  code: string;
  balance?: number;
  currentPrice?: number;
};

export default function ShmpRmPage() {
  const [companyId, setCompanyId] = useState("");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [openingQty, setOpeningQty] = useState("0");
  const [price, setPrice] = useState("0");
  const [materialId, setMaterialId] = useState("");
  const [stockQty, setStockQty] = useState("");
  const [supplier, setSupplier] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [orderId, setOrderId] = useState("");
  const [issueQty, setIssueQty] = useState("");
  const [productId, setProductId] = useState("");
  const [bomQty, setBomQty] = useState("1");
  const [expected, setExpected] = useState<unknown>(null);

  async function refresh() {
    try {
      const list = (await shmpRmMaterials(companyId || undefined)) as Material[];
      setMaterials(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!companyId) return;
    try {
      await shmpCreateMaterial({
        company: companyId,
        code,
        name,
        currentPrice: Number(price),
        openingQty: Number(openingQty),
        unit: "PCS",
      });
      setCode("");
      setName("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function onStockIn(e: FormEvent) {
    e.preventDefault();
    try {
      await shmpStockIn({
        companyId,
        materialId,
        quantity: Number(stockQty),
        unitPrice: Number(price),
        supplierName: supplier,
        invoiceNo,
        receiptDate: new Date().toISOString(),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stock-in failed");
    }
  }

  async function onIssue(e: FormEvent) {
    e.preventDefault();
    try {
      await shmpIssueRm({
        companyId,
        materialId,
        quantity: Number(issueQty),
        orderId,
        productId: productId || undefined,
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Issue failed — order required");
    }
  }

  async function onBom(e: FormEvent) {
    e.preventDefault();
    try {
      await shmpSaveBom({
        company: companyId,
        product: productId,
        material: materialId,
        qtyPerCarton: Number(bomQty),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "BOM failed");
    }
  }

  async function loadExpected() {
    if (!orderId) return;
    try {
      setExpected(await shmpExpectedRm(orderId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Expected failed");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">RM Store</h1>
        <p className="mt-1 text-sm text-slate-600">
          Raw materials and packaging — issue only against an order. Stock
          deducted on issue.
        </p>
      </div>
      <label className="block max-w-md text-sm">
        Company ID
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
        <form onSubmit={onCreate} className="space-y-2 rounded-2xl border border-line bg-white p-5">
          <h2 className="font-semibold">New material + opening stock</h2>
          <input className="w-full rounded-xl border border-line px-3 py-2 text-sm" placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
          <input className="w-full rounded-xl border border-line px-3 py-2 text-sm" placeholder="Name (e.g. Labels)" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="w-full rounded-xl border border-line px-3 py-2 text-sm" placeholder="Opening qty" value={openingQty} onChange={(e) => setOpeningQty(e.target.value)} />
          <input className="w-full rounded-xl border border-line px-3 py-2 text-sm" placeholder="Unit price" value={price} onChange={(e) => setPrice(e.target.value)} />
          <button type="submit" className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold">Create</button>
        </form>

        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-semibold">Balances</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {materials.map((m) => (
              <li key={m._id} className="flex justify-between border-b border-line/50 py-2">
                <span>{m.code} — {m.name}</span>
                <span className="font-medium">{m.balance ?? 0}</span>
              </li>
            ))}
          </ul>
        </div>

        <form onSubmit={onStockIn} className="space-y-2 rounded-2xl border border-line bg-white p-5">
          <h2 className="font-semibold">Stock in</h2>
          <MaterialSelect materials={materials} value={materialId} onChange={setMaterialId} />
          <input className="w-full rounded-xl border border-line px-3 py-2 text-sm" placeholder="Qty" value={stockQty} onChange={(e) => setStockQty(e.target.value)} />
          <input className="w-full rounded-xl border border-line px-3 py-2 text-sm" placeholder="Supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          <input className="w-full rounded-xl border border-line px-3 py-2 text-sm" placeholder="Invoice / DN" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
          <button type="submit" className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold">Add stock</button>
        </form>

        <form onSubmit={onIssue} className="space-y-2 rounded-2xl border border-line bg-white p-5">
          <h2 className="font-semibold">Issue against order</h2>
          <MaterialSelect materials={materials} value={materialId} onChange={setMaterialId} />
          <input className="w-full rounded-xl border border-line px-3 py-2 text-sm" placeholder="Order (TempOrder) ID" value={orderId} onChange={(e) => setOrderId(e.target.value)} />
          <input className="w-full rounded-xl border border-line px-3 py-2 text-sm" placeholder="Qty" value={issueQty} onChange={(e) => setIssueQty(e.target.value)} />
          <button type="submit" className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold">Issue</button>
          <button type="button" onClick={() => void loadExpected()} className="ml-2 text-sm text-brand-dark">Show expected from BOM</button>
          {expected ? (
            <pre className="max-h-40 overflow-auto rounded-xl bg-slate-50 p-2 text-xs">{JSON.stringify(expected, null, 2)}</pre>
          ) : null}
        </form>

        <form onSubmit={onBom} className="space-y-2 rounded-2xl border border-line bg-white p-5 lg:col-span-2">
          <h2 className="font-semibold">Product BOM (qty per carton)</h2>
          <p className="text-xs text-slate-500">
            Example: PET Jars 300ml 6pcs — 1 carton packaging + 48 labels per carton.
          </p>
          <input className="w-full rounded-xl border border-line px-3 py-2 text-sm" placeholder="Product ID" value={productId} onChange={(e) => setProductId(e.target.value)} />
          <MaterialSelect materials={materials} value={materialId} onChange={setMaterialId} />
          <input className="w-full max-w-xs rounded-xl border border-line px-3 py-2 text-sm" placeholder="Qty per carton" value={bomQty} onChange={(e) => setBomQty(e.target.value)} />
          <button type="submit" className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold">Save BOM line</button>
        </form>
      </div>
    </div>
  );
}

function MaterialSelect({
  materials,
  value,
  onChange,
}: {
  materials: Material[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      className="w-full rounded-xl border border-line px-3 py-2 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Material</option>
      {materials.map((m) => (
        <option key={m._id} value={m._id}>
          {m.code} — {m.name}
        </option>
      ))}
    </select>
  );
}
