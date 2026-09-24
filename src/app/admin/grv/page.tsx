"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getAllConfirmedInvoices,
  searchInvoiceNumbers,
} from "@/lib/api";
import type { GrvOrder } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import {
  formatInvoiceDate,
  invoiceNumberOf,
  invoiceStoreName,
  invoiceTotal,
  orderGrvAmount,
} from "@/lib/invoice";
import { salesMoney } from "@/lib/sales";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from "@/components/ui";

export default function AdminGrvPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<GrvOrder[]>([]);
  const [searchHits, setSearchHits] = useState<GrvOrder[] | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      setOrders(await getAllConfirmedInvoices(user.id));
      setSearchHits(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = searchHits ?? orders;

  const filtered = useMemo(() => {
    const tag = query.trim().toLowerCase();
    if (!tag || searchHits) return visible;
    return visible.filter((order) =>
      invoiceNumberOf(order).toLowerCase().includes(tag),
    );
  }, [query, searchHits, visible]);

  async function onSearch() {
    const tag = query.trim();
    if (!tag) {
      setSearchHits(null);
      return;
    }
    const local = orders.filter((order) =>
      invoiceNumberOf(order).toLowerCase().includes(tag.toLowerCase()),
    );
    if (local.length > 0) {
      setSearchHits(local);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const remote = await searchInvoiceNumbers(tag);
      const byId = new Map(orders.map((order) => [order._id, order]));
      setSearchHits(
        remote.map((item) => byId.get(item._id) || {
          _id: item._id,
          invoiceNumber: item.invoiceNumber,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="GRV management"
        subtitle="Invoices created after warehouse double-check appear here. Search an invoice to mark returned goods."
        actions={
          <SecondaryButton type="button" disabled={loading} onClick={() => void load()}>
            Refresh
          </SecondaryButton>
        }
      />

      <form
        className="mb-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void onSearch();
        }}
      >
        <div className="min-w-0 flex-1">
          <TextField
            label="Invoice number"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search STL/0001/2026"
          />
        </div>
        <div className="flex items-end gap-2">
          <PrimaryButton type="submit">Search</PrimaryButton>
          {searchHits ? (
            <SecondaryButton
              type="button"
              onClick={() => {
                setQuery("");
                setSearchHits(null);
              }}
            >
              Clear
            </SecondaryButton>
          ) : null}
        </div>
      </form>

      {loading ? (
        <LoadingState label="Loading invoices…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No invoices found"
          description="Confirmed invoices show up here after warehouse double-check creates them."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((order, index) => {
            const grv = orderGrvAmount(order);
            return (
              <Link
                key={order._id || `${invoiceNumberOf(order)}-${index}`}
                href={`/admin/grv/${order._id}`}
                className="block rounded-xl border border-line bg-white p-4 hover:border-brand/60"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-black">{invoiceNumberOf(order)}</p>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {invoiceStoreName(order)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatInvoiceDate(order.date || order.createdAt)}
                      {order.isGRV ? " · GRV recorded" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-ink">
                      {salesMoney(invoiceTotal(order))}
                    </p>
                    {grv > 0 ? (
                      <p className="mt-1 text-xs text-slate-500">
                        GRV {salesMoney(grv)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
