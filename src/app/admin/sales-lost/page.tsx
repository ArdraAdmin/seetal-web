"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  CompanySwitcher,
  SelectField,
  StatCard,
} from "@/components/StlFeatureUi";
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SecondaryButton,
  TextField,
} from "@/components/ui";
import { salesMoney } from "@/lib/sales";
import { getAdminSalesLost, type CompanyKey } from "@/lib/stl-features-api";

type SalesLost = Awaited<ReturnType<typeof getAdminSalesLost>>;

const MONTHS = [
  "January","February","March","April","May","June","July","August",
  "September","October","November","December",
];

export default function AdminSalesLostPage() {
  const { user } = useAuth();
  const [companyKey, setCompanyKey] = useState<CompanyKey>("stl");
  const [year, setYear] = useState<number | "">("");
  const [month, setMonth] = useState<number | "">("");
  const [data, setData] = useState<SalesLost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      setData(
        await getAdminSalesLost(user.id, {
          companyKey,
          year: year || undefined,
          month: month || undefined,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sales lost");
    } finally {
      setLoading(false);
    }
  }, [user?.id, companyKey, year, month]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Sales lost"
        subtitle="Requested quantity that could not be fulfilled, valued at store price."
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

      <Card className="mb-4 flex flex-wrap items-end gap-3">
        <CompanySwitcher
          value={companyKey}
          onChange={(k) => k !== "all" && setCompanyKey(k)}
        />
        <div className="w-40">
          <SelectField
            label="Month"
            optional
            value={month}
            onChange={(e) => setMonth(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">Current</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="w-32">
          <TextField
            label="Year"
            optional
            type="number"
            min={2000}
            max={2100}
            value={year}
            onChange={(e) => setYear(e.target.value ? Number(e.target.value) : "")}
          />
        </div>
      </Card>

      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : data ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total lost" value={salesMoney(data.totalLost)} alert={data.totalLost > 0} />
            <StatCard label="Lines" value={String(data.lineCount)} />
            <StatCard label="Period" value={`${MONTHS[data.month - 1] ?? data.month} ${data.year}`} />
          </div>
          {data.products.length === 0 ? (
            <EmptyState title="No lost sales for this period" />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-[#f7f5f0] text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-2">Product</th>
                    <th className="px-4 py-2">Item code</th>
                    <th className="px-4 py-2">Category</th>
                    <th className="px-4 py-2 text-right">Qty requested</th>
                    <th className="px-4 py-2 text-right">Orders</th>
                    <th className="px-4 py-2 text-right">Lost value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.products.map((p) => (
                    <tr key={p.productId}>
                      <td className="px-4 py-2 font-medium">{p.productName}</td>
                      <td className="px-4 py-2">{p.itemCode || "-"}</td>
                      <td className="px-4 py-2">{p.categoryName || "-"}</td>
                      <td className="px-4 py-2 text-right">{p.quantityReq}</td>
                      <td className="px-4 py-2 text-right">{p.orderCount}</td>
                      <td className="px-4 py-2 text-right font-medium">
                        {salesMoney(p.lostValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
