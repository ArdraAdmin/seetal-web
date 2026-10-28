"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  CompanySwitcher,
  StatCard,
  fmtDateOnly,
} from "@/components/StlFeatureUi";
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SecondaryButton,
} from "@/components/ui";
import { salesMoney } from "@/lib/sales";
import {
  getAdminSalesmanBreakdown,
  type AdminSalesmanBreakdown,
  type CompanyKey,
} from "@/lib/stl-features-api";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function AdminSalesmanBreakdownPage() {
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const salesId = decodeURIComponent(String(params.id || ""));
  const initialCompany = searchParams.get("company") === "shmp" ? "shmp" : "stl";
  const [companyKey, setCompanyKey] = useState<CompanyKey>(initialCompany);
  const [data, setData] = useState<AdminSalesmanBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id || !salesId) return;
    setLoading(true);
    setError(null);
    try {
      setData(
        await getAdminSalesmanBreakdown(user.id, salesId, { companyKey }),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to load salesman sales",
      );
    } finally {
      setLoading(false);
    }
  }, [user?.id, salesId, companyKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const period =
    data != null
      ? `${MONTHS[data.month - 1] ?? data.month} ${data.year}`
      : "This month";

  return (
    <div>
      <PageHeader
        title={data?.salesman.name || "Salesman"}
        subtitle={
          data?.salesman.email
            ? `${data.salesman.email} · delivered value for ${period}`
            : `Delivered value for ${period}`
        }
        actions={
          <>
            <Link
              href="/admin"
              className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm hover:bg-[#f7f5f0]"
            >
              Back to KPIs
            </Link>
            <SecondaryButton type="button" disabled={loading} onClick={() => void load()}>
              Refresh
            </SecondaryButton>
          </>
        }
      />

      <div className="mb-4">
        <CompanySwitcher
          value={companyKey}
          onChange={(key) => key !== "all" && setCompanyKey(key)}
        />
      </div>

      {loading && !data ? (
        <LoadingState label="Loading salesman sales…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : data ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label={`${companyKey.toUpperCase()} delivered`}
              value={salesMoney(data.delivered)}
              hint={
                data.target != null
                  ? `Target ${salesMoney(data.target)}${
                      data.progress != null ? ` · ${data.progress}%` : ""
                    }`
                  : "No target set"
              }
            />
            <StatCard
              label="STL"
              value={salesMoney(data.performance.stl.delivered)}
            />
            <StatCard
              label="SHMP"
              value={salesMoney(data.performance.shmp.delivered)}
            />
          </div>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-ink">By product</h2>
            {data.products.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                No product sales this month.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line text-xs text-slate-500 uppercase">
                    <tr>
                      <th className="py-2 pr-3">Product</th>
                      <th className="py-2 pr-3">Item code</th>
                      <th className="py-2 pr-3 text-right">Qty</th>
                      <th className="py-2 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.products.map((product) => (
                      <tr key={product.productId}>
                        <td className="py-2 pr-3 font-medium">{product.name}</td>
                        <td className="py-2 pr-3">{product.itemCode || "-"}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {product.qty}
                        </td>
                        <td className="py-2 text-right font-medium tabular-nums">
                          {salesMoney(product.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-ink">By store</h2>
            {data.stores.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                No store sales this month.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line text-xs text-slate-500 uppercase">
                    <tr>
                      <th className="py-2 pr-3">Store</th>
                      <th className="py-2 pr-3 text-right">Orders</th>
                      <th className="py-2 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.stores.map((store) => (
                      <tr key={store.storeId}>
                        <td className="py-2 pr-3">
                          <p className="font-medium">{store.name}</p>
                          {store.address ? (
                            <p className="text-[11px] text-slate-500">
                              {store.address}
                            </p>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {store.orders}
                        </td>
                        <td className="py-2 text-right font-medium tabular-nums">
                          {salesMoney(store.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-ink">Orders</h2>
            {data.orders.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                No confirmed orders this month.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line text-xs text-slate-500 uppercase">
                    <tr>
                      <th className="py-2 pr-3">Invoice</th>
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Store</th>
                      <th className="py-2 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.orders.map((order) => (
                      <tr key={String(order.orderId)}>
                        <td className="py-2 pr-3 font-medium">
                          {order.invoiceNumber || String(order.orderId)}
                        </td>
                        <td className="py-2 pr-3">
                          {fmtDateOnly(order.date) || "-"}
                        </td>
                        <td className="py-2 pr-3">{order.storeName || "-"}</td>
                        <td className="py-2 text-right font-medium tabular-nums">
                          {salesMoney(order.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      ) : (
        <EmptyState title="Salesman not found" />
      )}
    </div>
  );
}
