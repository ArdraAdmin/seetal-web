"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Landmark } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { useAuth } from "@/components/AuthProvider";
import { selectSalesCompany } from "@/lib/api";
import {
  hasSelectedSalesCompany,
  type SalesCompanyKey,
} from "@/lib/sales-selected-company";

export default function SalesCompanySelectionPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loadingKey, setLoadingKey] = useState<SalesCompanyKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loadingKey && hasSelectedSalesCompany()) {
      router.replace("/sales");
    }
  }, [loadingKey, router]);

  async function onSelect(key: SalesCompanyKey, label: string) {
    if (!user?.id || loadingKey) return;
    setLoadingKey(key);
    setError(null);
    try {
      await selectSalesCompany(user.id, key);
      router.replace("/sales");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : `Could not open ${label}. Try again.`,
      );
      setLoadingKey(null);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col px-1 py-2 sm:py-6">
      <div className="mb-8 flex items-center gap-3">
        <BrandLogo size="sm" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-dark">
            Sales
          </p>
          <h1 className="text-2xl font-bold text-ink">Select company</h1>
        </div>
      </div>

      <p className="max-w-xl text-sm text-slate-600">
        Orders and inventory will use the company you choose.
      </p>

      {error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="mt-10 grid flex-1 content-center gap-4 sm:grid-cols-2">
        <CompanyCard
          title="STL"
          icon={Building2}
          loading={loadingKey === "stl"}
          disabled={loadingKey !== null}
          onClick={() => void onSelect("stl", "STL")}
        />
        <CompanyCard
          title="SHMP"
          icon={Landmark}
          loading={loadingKey === "shmp"}
          disabled={loadingKey !== null}
          onClick={() => void onSelect("shmp", "SHMP")}
        />
      </div>
    </div>
  );
}

function CompanyCard({
  title,
  icon: Icon,
  loading,
  disabled,
  onClick,
}: {
  title: string;
  icon: typeof Building2;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[160px] flex-col items-start rounded-2xl border border-line bg-white p-5 text-left shadow-[0_10px_30px_-18px_rgba(14,58,50,0.35)] transition hover:border-brand/50 hover:bg-[#fffaf2] disabled:cursor-wait disabled:opacity-70"
    >
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/15 text-brand-dark">
        {loading ? (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        ) : (
          <Icon className="h-6 w-6" strokeWidth={1.75} />
        )}
      </span>
      <span className="mt-auto pt-8 text-lg font-semibold text-ink">{title}</span>
      <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-dark">
        Open
        <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
      </span>
    </button>
  );
}
