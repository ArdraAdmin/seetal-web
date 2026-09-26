"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  companyLabel,
  getCompanies,
  type CompanyRecord,
} from "@/lib/api";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@/components/ui";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "C";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function StockTransferPage() {
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getCompanies();
      setCompanies(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load companies");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Stock transfer"
        subtitle="See stock by company, then move products from one company to another."
      />

      {loading ? (
        <LoadingState label="Loading companies…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : companies.length === 0 ? (
        <EmptyState title="No companies found" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {companies.map((company) => {
            const name = companyLabel(company);
            const count = company.productCount ?? 0;
            return (
              <Link
                key={company._id}
                href={`/admin/stock-transfer/${company._id}?name=${encodeURIComponent(name)}`}
                className="rounded-xl border border-line bg-white p-5 hover:bg-[#f7f5f0]"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand/15 text-sm font-semibold text-ink">
                  {initials(name)}
                </span>
                <p className="mt-4 font-semibold text-ink">{name}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {count.toLocaleString("en-IN")} product{count === 1 ? "" : "s"}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
