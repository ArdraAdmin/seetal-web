"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  getAllWarehouseOrders,
  type WarehouseTabIndex,
} from "@/lib/api";
import type { PendingOrder, WarehouseCounts } from "@/lib/types";
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
import {
  assigneeLabel,
  invoiceLabel,
  storeDescription,
  storeMarks,
  storeTitle,
  warehouseBasePath,
} from "@/lib/warehouse";

const TABS: { id: WarehouseTabIndex; label: string }[] = [
  { id: 0, label: "Today" },
  { id: 1, label: "Upcoming" },
  { id: 2, label: "Confirmed" },
];

function checkStatus(order: PendingOrder) {
  if (order.status === "Order Removed") {
    return { label: "Order removed", className: "bg-brand/15 text-ink" };
  }
  if (order.loadCheck) {
    return { label: "Load check", className: "bg-emerald-100 text-emerald-800" };
  }
  if (order.doubleCheck) {
    return { label: "Double check", className: "bg-sky-100 text-sky-800" };
  }
  if (order.firstCheck) {
    return { label: "First check", className: "bg-brand/20 text-ink" };
  }
  if (String(order.status || "").toLowerCase() === "confirmed") {
    return { label: "Confirmed", className: "bg-emerald-100 text-emerald-800" };
  }
  return { label: "Pending", className: "bg-red-100 text-red-800" };
}

function formatDate(value?: string) {
  if (!value) return "";
  const text = String(value);
  if (text.length >= 10) return text.slice(0, 10);
  return text;
}

export default function WarehousePage() {
  const { user } = useAuth();
  const pathname = usePathname();
  const base = warehouseBasePath(pathname);
  const [tab, setTab] = useState<WarehouseTabIndex>(0);
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [counts, setCounts] = useState<WarehouseCounts | null>(null);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (tabIndex: WarehouseTabIndex, tag = "") => {
      if (!user?.id) return;
      setLoading(true);
      setError(null);
      try {
        const data = await getAllWarehouseOrders(user.id, tabIndex, tag);
        setOrders(data.orders);
        setCounts(data.counts ?? null);
        setTab(tabIndex);
        setAppliedQuery(tag);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load warehouse orders");
      } finally {
        setLoading(false);
      }
    },
    [user?.id],
  );

  useEffect(() => {
    void load(0);
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Warehouse"
        subtitle="Open an order to run first check, double check, and load verification."
        actions={
          <SecondaryButton
            type="button"
            disabled={loading}
            onClick={() => void load(tab, appliedQuery)}
          >
            Refresh
          </SecondaryButton>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => void load(item.id, appliedQuery)}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              tab === item.id
                ? "bg-brand text-black"
                : "border border-line bg-white text-black hover:bg-[#f7f5f0]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <Card className="mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 w-full flex-1 sm:min-w-[220px]">
            <TextField
              label="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Store, invoice, or marks"
              onKeyDown={(e) => {
                if (e.key === "Enter") void load(tab, query.trim());
              }}
            />
          </div>
          <PrimaryButton
            type="button"
            onClick={() => void load(tab, query.trim())}
          >
            Search
          </PrimaryButton>
          {appliedQuery ? (
            <SecondaryButton
              type="button"
              onClick={() => {
                setQuery("");
                void load(tab, "");
              }}
            >
              Clear
            </SecondaryButton>
          ) : null}
        </div>
      </Card>

      {tab === 0 && counts ? (
        <Card className="mb-5">
          <p className="text-center text-base font-semibold text-black">
            Total cartons: {counts.totalPkgCount}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryStat label="Pending" value={counts.pendingCheckCount} />
            <SummaryStat label="First check" value={counts.firstCheckCount} />
            <SummaryStat label="Double check" value={counts.doubleCheckCount} />
            <SummaryStat label="Load check" value={counts.loadCheckCount} />
          </div>
        </Card>
      ) : null}

      {loading ? (
        <LoadingState label="Loading warehouse orders…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load(tab, appliedQuery)} />
      ) : orders.length === 0 ? (
        <EmptyState title="No warehouse orders" />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Showing {orders.length} order{orders.length === 1 ? "" : "s"}
          </p>
          {orders.map((order, index) => {
            const status = checkStatus(order);
            const title = storeTitle(order) || "Store";
            const marks = storeMarks(order);
            const description = storeDescription(order);
            const invoice = invoiceLabel(order);
            const pkg = order.totalPkg;
            const href =
              tab === 2 ? null : `${base}/${order._id}?step=1`;
            const rowKey = order._id || `order-${index}`;
            const body = (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500">
                    {formatDate(order.date)}
                  </p>
                  <p className="mt-1 font-semibold text-black">{title}</p>
                  {marks ? (
                    <p className="mt-0.5 text-sm font-medium text-slate-700">
                      {marks}
                    </p>
                  ) : null}
                  <p className="mt-1 text-sm text-slate-600">
                    {[description, invoice].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Created {formatDate(order.createdAt)} · Assignee{" "}
                    {assigneeLabel(order)}
                    {pkg != null
                      ? ` · ${order.firstCheck ? "" : "Approx: "}${pkg} PKGS`
                      : ""}
                    {order.isGRV ? " · GRV" : ""}
                  </p>
                </div>
                <span
                  className={`inline-flex h-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}
                >
                  {status.label}
                </span>
              </div>
            );
            return href ? (
              <Link
                key={rowKey}
                href={href}
                className="block rounded-xl border border-line bg-white p-4 hover:bg-[#f7f5f0]"
              >
                {body}
              </Link>
            ) : (
              <Card key={rowKey}>{body}</Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line bg-[#f7f5f0] px-3 py-3 text-center">
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <p className="mt-1 text-xl font-semibold text-black">{value}</p>
    </div>
  );
}
