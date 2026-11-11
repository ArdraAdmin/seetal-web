"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useAuth } from "@/components/AuthProvider";
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
import { getCompanies } from "@/lib/api";
import { isAdmin } from "@/lib/auth";
import { formatRmDate, formatRmQty } from "@/lib/rm-usage";
import { resolveSalesCompanyByKey } from "@/lib/sales-selected-company";
import {
  shmpApproveRm,
  shmpCreateMaterial,
  shmpInventory,
  shmpIssueRm,
  shmpOrders,
  shmpRejectRm,
  shmpRmApprovals,
  shmpRmLedger,
  shmpRmMaterials,
  shmpSaveBom,
  shmpStockIn,
  shmpUpdateMaterial,
  type RmApproval,
  type RmLedgerEntry,
  type RmMaterial,
  type ShmpInventoryProduct,
} from "@/lib/shmp-api";

const KINDS = ["Carton", "Label", "Other"] as const;

type OrderOption = { _id?: string; tempOrderInvoiceNo?: string };

function personName(value: { name?: string } | string | null | undefined) {
  if (!value || typeof value === "string") return "";
  return value.name || "";
}

function orderInvoice(value: RmLedgerEntry["order"]) {
  if (!value) return "";
  if (typeof value === "string") return "Linked order";
  return value.tempOrderInvoiceNo || "Linked order";
}

function productName(
  value: { itemName?: string; itemRef?: string } | string | null | undefined,
) {
  if (!value || typeof value === "string") return "Item";
  return value.itemName || value.itemRef || "Item";
}

function todayInput() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export default function ShmpRmPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [companyId, setCompanyId] = useState("");
  const [materials, setMaterials] = useState<RmMaterial[]>([]);
  const [ledger, setLedger] = useState<RmLedgerEntry[]>([]);
  const [approvals, setApprovals] = useState<RmApproval[]>([]);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [products, setProducts] = useState<ShmpInventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [stockOpen, setStockOpen] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const purchases = useMemo(
    () => ledger.filter((row) => row.type === "in"),
    [ledger],
  );
  const consumed = useMemo(
    () => ledger.filter((row) => row.type === "issue"),
    [ledger],
  );

  async function refresh(cid = companyId) {
    const [nextMaterials, nextLedger, nextApprovals] = await Promise.all([
      shmpRmMaterials(cid || undefined),
      shmpRmLedger(cid || undefined),
      shmpRmApprovals("pending"),
    ]);
    setMaterials(nextMaterials);
    setLedger(nextLedger);
    setApprovals(nextApprovals);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const companies = await getCompanies().catch(() => []);
        const id = resolveSalesCompanyByKey("shmp", companies)?.id || "";
        if (cancelled) return;
        setCompanyId(id);
        await refresh(id);
        if (admin) {
          const [orderRows, productRows] = await Promise.all([
            shmpOrders().catch(() => []),
            shmpInventory().catch(() => []),
          ]);
          if (cancelled) return;
          setOrders(
            (orderRows as OrderOption[]).filter((row) => Boolean(row._id)),
          );
          setProducts(productRows);
        }
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load the RM store");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Company is resolved inside this load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin]);

  async function decide(id: string, action: "approve" | "reject") {
    setBusyId(id);
    setNotice(null);
    try {
      if (action === "approve") await shmpApproveRm(id);
      else await shmpRejectRm(id, reasons[id] || "");
      await refresh();
      setNotice(
        action === "approve"
          ? "Stock deducted and recorded against the order."
          : "Label check rejected. No stock was deducted.",
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the label check");
    } finally {
      setBusyId("");
    }
  }

  async function changeKind(material: RmMaterial, kind: string) {
    setBusyId(material._id);
    try {
      await shmpUpdateMaterial(material._id, { kind });
      await refresh();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the material");
    } finally {
      setBusyId("");
    }
  }

  if (loading) return <LoadingState label="Loading RM store…" />;
  if (error && !materials.length && !ledger.length && !approvals.length) {
    return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="RM Store"
        subtitle="Purchased materials, what has been consumed against orders, and label checks waiting for approval."
        actions={
          admin ? (
            <PrimaryButton type="button" onClick={() => setStockOpen(true)}>
              Add stock
            </PrimaryButton>
          ) : null
        }
      />
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {notice}
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-ink">Waiting for a label checker</h2>
        {approvals.length ? (
          <div className="space-y-3">
            {approvals.map((row) => {
              const requirement = row.requirement;
              const blockers = requirement?.blockers || [];
              return (
                <Card key={row._id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink">
                        {orderInvoice(row.order) || "Order"} · {productName(row.product)}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {formatRmQty(Number(row.cartonQty) || 0)} cartons packed
                        {personName(row.requestedBy)
                          ? ` · requested by ${personName(row.requestedBy)}`
                          : ""}
                        {row.createdAt ? ` · ${formatRmDate(row.createdAt)}` : ""}
                      </p>
                      {(row.workers || []).length ? (
                        <p className="mt-1 text-sm text-slate-600">
                          {(row.workers || [])
                            .map((worker) => {
                              const name = personName(worker.employee) || "Worker";
                              return `${name} · ${formatRmQty(Number(worker.cartonQty) || 0)} cartons`;
                            })
                            .join(", ")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1 text-sm text-slate-700">
                    {(requirement?.lines || []).map((line) => (
                      <li key={`${row._id}-${line.materialId}`}>
                        {line.kind}: {line.name || line.code} · {formatRmQty(line.quantity)}
                        {line.balance == null
                          ? ""
                          : ` · ${formatRmQty(line.balance)} in stock`}
                      </li>
                    ))}
                    {!requirement?.lines.length ? (
                      <li>No carton or label quantity is set up for this item.</li>
                    ) : null}
                  </ul>
                  {blockers.length ? (
                    <ul className="mt-2 space-y-1 text-sm text-red-700">
                      {blockers.map((blocker) => (
                        <li key={blocker}>{blocker}</li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <label className="min-w-[14rem] flex-1 text-sm">
                      <span className="mb-1 block text-xs text-slate-500">
                        Reject reason
                      </span>
                      <input
                        className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                        value={reasons[row._id] || ""}
                        onChange={(event) =>
                          setReasons((current) => ({
                            ...current,
                            [row._id]: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <SecondaryButton
                      type="button"
                      disabled={busyId === row._id}
                      onClick={() => void decide(row._id, "reject")}
                    >
                      Reject
                    </SecondaryButton>
                    <PrimaryButton
                      type="button"
                      disabled={busyId === row._id || blockers.length > 0}
                      onClick={() => void decide(row._id, "approve")}
                    >
                      {busyId === row._id ? "Saving…" : "Approve and deduct"}
                    </PrimaryButton>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No label checks waiting"
            description="When a supervisor allots workers, the cartons and labels show up here for approval."
          />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-ink">Stock on hand</h2>
        {materials.length ? (
          <div className="overflow-x-auto rounded-xl border border-line bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Material</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((material) => (
                  <tr key={material._id} className="border-t border-line">
                    <td className="px-4 py-2">
                      {material.code} — {material.name}
                    </td>
                    <td className="px-4 py-2">
                      {admin ? (
                        <select
                          className="rounded-lg border border-line px-2 py-1"
                          value={material.kind || "Other"}
                          disabled={busyId === material._id}
                          onChange={(event) =>
                            void changeKind(material, event.target.value)
                          }
                        >
                          {KINDS.map((kind) => (
                            <option key={kind} value={kind}>
                              {kind}
                            </option>
                          ))}
                        </select>
                      ) : (
                        material.kind || "Other"
                      )}
                    </td>
                    <td className="px-4 py-2 font-medium">
                      {formatRmQty(Number(material.balance) || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No materials yet"
            description="Add a material, then record purchases with Add stock."
          />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-ink">Purchased</h2>
        {purchases.length ? (
          <LedgerTable
            rows={purchases}
            columns={["Material", "Quantity", "Supplier", "Invoice", "Date"]}
            render={(row) => [
              materialLabel(row),
              formatRmQty(Number(row.quantity) || 0),
              row.supplierName || "—",
              row.invoiceNo || "—",
              formatRmDate(row.receiptDate || row.createdAt) || "—",
            ]}
          />
        ) : (
          <EmptyState
            title="No purchases yet"
            description="Use Add stock when cartons, labels, or other materials arrive."
          />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-ink">Consumed</h2>
        <p className="text-sm text-slate-600">
          Every deduction is linked to an order, with the quantity and the person who approved or issued it.
        </p>
        {consumed.length ? (
          <LedgerTable
            rows={consumed}
            columns={["Material", "Quantity", "Order", "Recorded by", "Date"]}
            render={(row) => {
              const approver = personName(row.approvedBy);
              const issuer = personName(row.createdBy);
              const who = approver
                ? `Approved by ${approver}`
                : issuer
                  ? `Issued by ${issuer}`
                  : "—";
              return [
                materialLabel(row),
                formatRmQty(Number(row.quantity) || 0),
                orderInvoice(row.order) || "Order required",
                who,
                formatRmDate(row.createdAt) || "—",
              ];
            }}
          />
        ) : (
          <EmptyState
            title="Nothing consumed yet"
            description="Approved label checks, and manual issues, show here with their order."
          />
        )}
      </section>

      {admin ? (
        <AdminTools
          companyId={companyId}
          materials={materials}
          orders={orders}
          products={products}
          onSaved={async (message) => {
            await refresh();
            setNotice(message);
            setError(null);
          }}
          onError={(message) => {
            setError(message);
            setNotice(null);
          }}
        />
      ) : null}

      {stockOpen && admin ? (
        <AddStockDialog
          materials={materials}
          onClose={() => setStockOpen(false)}
          onSave={async (input) => {
            if (!companyId) throw new Error("SHMP company was not found");
            await shmpStockIn({
              companyId,
              materialId: input.materialId,
              quantity: input.quantity,
              unitPrice: input.unitPrice,
              supplierName: input.supplier,
              invoiceNo: input.invoiceNo,
              receiptDate: input.receiptDate,
            });
            await refresh();
            setStockOpen(false);
            setNotice("Purchase added to stock.");
            setError(null);
          }}
        />
      ) : null}
    </div>
  );
}

function materialLabel(row: RmLedgerEntry) {
  const material = row.material;
  if (!material || typeof material === "string") return "Material";
  return [material.code, material.name].filter(Boolean).join(" — ") || "Material";
}

function LedgerTable({
  rows,
  columns,
  render,
}: {
  rows: RmLedgerEntry[];
  columns: string[];
  render: (row: RmLedgerEntry) => string[];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-4 py-2 font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row._id} className="border-t border-line">
              {render(row).map((cell, index) => (
                <td key={`${row._id}-${index}`} className="px-4 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AddStockDialog({
  materials,
  onClose,
  onSave,
}: {
  materials: RmMaterial[];
  onClose: () => void;
  onSave: (input: {
    materialId: string;
    quantity: number;
    unitPrice: number;
    supplier: string;
    invoiceNo: string;
    receiptDate: string;
  }) => Promise<void>;
}) {
  const [materialId, setMaterialId] = useState(materials[0]?._id || "");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [supplier, setSupplier] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [receiptDate, setReceiptDate] = useState(todayInput());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const qty = Number(quantity);
    if (!materialId) {
      setError("Choose a material.");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Enter a quantity greater than zero.");
      return;
    }
    const price = unitPrice.trim() === "" ? 0 : Number(unitPrice);
    if (!Number.isFinite(price) || price < 0) {
      setError("Enter a valid unit price.");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        materialId,
        quantity: qty,
        unitPrice: price,
        supplier: supplier.trim(),
        invoiceNo: invoiceNo.trim(),
        receiptDate,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add stock");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={(event) => void onSubmit(event)}
        className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-lg"
      >
        <h2 className="text-lg font-semibold text-ink">Add stock</h2>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Material</span>
          <select
            className="w-full rounded-lg border border-line px-3 py-2"
            value={materialId}
            onChange={(event) => setMaterialId(event.target.value)}
          >
            <option value="">Select material</option>
            {materials.map((material) => (
              <option key={material._id} value={material._id}>
                {material.code} — {material.name}
              </option>
            ))}
          </select>
        </label>
        <TextField
          label="Quantity"
          type="number"
          min={0}
          step="any"
          required
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
        />
        <TextField
          label="Unit price"
          type="number"
          min={0}
          step="any"
          optional
          value={unitPrice}
          onChange={(event) => setUnitPrice(event.target.value)}
        />
        <TextField
          label="Supplier"
          optional
          value={supplier}
          onChange={(event) => setSupplier(event.target.value)}
        />
        <TextField
          label="Invoice"
          optional
          value={invoiceNo}
          onChange={(event) => setInvoiceNo(event.target.value)}
        />
        <TextField
          label="Receipt date"
          type="date"
          required
          value={receiptDate}
          onChange={(event) => setReceiptDate(event.target.value)}
        />
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <SecondaryButton type="button" onClick={onClose} disabled={saving}>
            Cancel
          </SecondaryButton>
          <PrimaryButton type="submit" disabled={saving}>
            {saving ? "Saving…" : "Add stock"}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}

function AdminTools({
  companyId,
  materials,
  orders,
  products,
  onSaved,
  onError,
}: {
  companyId: string;
  materials: RmMaterial[];
  orders: OrderOption[];
  products: ShmpInventoryProduct[];
  onSaved: (message: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("Other");
  const [openingQty, setOpeningQty] = useState("0");
  const [price, setPrice] = useState("0");
  const [issueMaterialId, setIssueMaterialId] = useState("");
  const [issueOrderId, setIssueOrderId] = useState("");
  const [issueProductId, setIssueProductId] = useState("");
  const [issueQty, setIssueQty] = useState("");
  const [bomProductId, setBomProductId] = useState("");
  const [bomMaterialId, setBomMaterialId] = useState("");
  const [bomQty, setBomQty] = useState("1");
  const [saving, setSaving] = useState("");

  const materialOptions = materials.map((material) => ({
    id: material._id,
    label: `${material.code} — ${material.name}`,
    searchText: `${material.code} ${material.name} ${material.kind || ""}`,
  }));
  const orderOptions = orders.map((order) => ({
    id: String(order._id),
    label: order.tempOrderInvoiceNo || String(order._id),
    searchText: `${order.tempOrderInvoiceNo || ""} ${order._id || ""}`,
  }));
  const productOptions = products.map((product) => ({
    id: product._id,
    label: product.itemName || product.itemRef || product._id,
    searchText: `${product.itemName || ""} ${product.itemRef || ""}`,
  }));

  async function createMaterial(event: FormEvent) {
    event.preventDefault();
    if (!companyId) {
      onError("SHMP company was not found");
      return;
    }
    if (!code.trim() || !name.trim()) {
      onError("Enter a code and a name.");
      return;
    }
    setSaving("material");
    try {
      await shmpCreateMaterial({
        company: companyId,
        code: code.trim(),
        name: name.trim(),
        kind,
        currentPrice: Number(price) || 0,
        openingQty: Number(openingQty) || 0,
        unit: "PCS",
      });
      setCode("");
      setName("");
      await onSaved("Material created.");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not create the material");
    } finally {
      setSaving("");
    }
  }

  async function issue(event: FormEvent) {
    event.preventDefault();
    const quantity = Number(issueQty);
    if (!companyId || !issueMaterialId || !issueOrderId) {
      onError("Choose a material and an order.");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      onError("Enter a quantity greater than zero.");
      return;
    }
    setSaving("issue");
    try {
      await shmpIssueRm({
        companyId,
        materialId: issueMaterialId,
        orderId: issueOrderId,
        productId: issueProductId || undefined,
        quantity,
      });
      setIssueQty("");
      await onSaved("Stock issued against the order.");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not issue stock");
    } finally {
      setSaving("");
    }
  }

  async function saveBom(event: FormEvent) {
    event.preventDefault();
    const qty = Number(bomQty);
    if (!companyId || !bomProductId || !bomMaterialId) {
      onError("Choose a product and a material.");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      onError("Enter how many are used per carton.");
      return;
    }
    setSaving("bom");
    try {
      await shmpSaveBom({
        company: companyId,
        product: bomProductId,
        material: bomMaterialId,
        qtyPerCarton: qty,
      });
      await onSaved("Packaging quantity saved.");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not save packaging");
    } finally {
      setSaving("");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <form onSubmit={(event) => void createMaterial(event)} className="space-y-3">
        <Card>
          <h2 className="font-semibold text-ink">New material</h2>
          <div className="mt-3 space-y-3">
            <TextField label="Code" required value={code} onChange={(event) => setCode(event.target.value)} />
            <TextField label="Name" required value={name} onChange={(event) => setName(event.target.value)} />
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Type</span>
              <select
                className="w-full rounded-lg border border-line px-3 py-2"
                value={kind}
                onChange={(event) => setKind(event.target.value as (typeof KINDS)[number])}
              >
                {KINDS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <TextField label="Opening quantity" type="number" min={0} step="any" value={openingQty} onChange={(event) => setOpeningQty(event.target.value)} />
            <TextField label="Unit price" type="number" min={0} step="any" value={price} onChange={(event) => setPrice(event.target.value)} />
            <PrimaryButton type="submit" disabled={saving === "material"}>
              {saving === "material" ? "Saving…" : "Create material"}
            </PrimaryButton>
          </div>
        </Card>
      </form>

      <form onSubmit={(event) => void saveBom(event)}>
        <Card>
          <h2 className="font-semibold text-ink">Packaging per carton</h2>
          <p className="mt-1 text-xs text-slate-500">
            Example: 1 outer carton and 48 labels for each carton packed.
          </p>
          <div className="mt-3 space-y-3">
            <SearchableSelect
              label="Product"
              value={bomProductId}
              options={productOptions}
              onChange={setBomProductId}
              placeholder="Search products"
            />
            <SearchableSelect
              label="Material"
              value={bomMaterialId}
              options={materialOptions}
              onChange={setBomMaterialId}
              placeholder="Search materials"
            />
            <TextField label="Quantity per carton" type="number" min={0} step="any" required value={bomQty} onChange={(event) => setBomQty(event.target.value)} />
            <PrimaryButton type="submit" disabled={saving === "bom"}>
              {saving === "bom" ? "Saving…" : "Save packaging"}
            </PrimaryButton>
          </div>
        </Card>
      </form>

      <form onSubmit={(event) => void issue(event)}>
        <Card>
          <h2 className="font-semibold text-ink">Issue against an order</h2>
          <p className="mt-1 text-xs text-slate-500">
            Manual issues deduct stock immediately and stay linked to the order.
          </p>
          <div className="mt-3 space-y-3">
            <SearchableSelect
              label="Material"
              value={issueMaterialId}
              options={materialOptions}
              onChange={setIssueMaterialId}
              placeholder="Search materials"
            />
            <SearchableSelect
              label="Order"
              value={issueOrderId}
              options={orderOptions}
              onChange={setIssueOrderId}
              placeholder="Search orders"
            />
            <SearchableSelect
              label="Product"
              optional
              value={issueProductId}
              options={productOptions}
              onChange={setIssueProductId}
              placeholder="Search products"
            />
            <TextField label="Quantity" type="number" min={0} step="any" required value={issueQty} onChange={(event) => setIssueQty(event.target.value)} />
            <PrimaryButton type="submit" disabled={saving === "issue"}>
              {saving === "issue" ? "Saving…" : "Issue"}
            </PrimaryButton>
          </div>
        </Card>
      </form>
    </div>
  );
}
