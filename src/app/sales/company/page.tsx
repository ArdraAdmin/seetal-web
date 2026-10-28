"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Factory,
  Landmark,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { useAuth } from "@/components/AuthProvider";
import { selectSalesCompany, warmCompanyDirectory } from "@/lib/api";
import {
  hasSelectedSalesWorkspace,
  SALES_COMPANY_LABELS,
  type SalesCompanyKey,
} from "@/lib/sales-selected-company";

const WORKSPACE_COMPANIES: Array<{
  key: SalesCompanyKey;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  comingSoon?: boolean;
}> = [
  {
    key: "stl",
    title: SALES_COMPANY_LABELS.stl,
    subtitle: "STL stores and inventory",
    icon: Building2,
  },
  {
    key: "sarvah",
    title: SALES_COMPANY_LABELS.sarvah,
    subtitle: "Current stores and Sarvah inventory",
    icon: Landmark,
  },
  {
    key: "shmp",
    title: SALES_COMPANY_LABELS.shmp,
    subtitle: "Assigned stores and SHMP inventory",
    icon: Factory,
  },
  {
    key: "shlaxmi",
    title: SALES_COMPANY_LABELS.shlaxmi,
    subtitle: "Coming soon",
    icon: Sparkles,
    comingSoon: true,
  },
];

function inventoryDestination(raw: string | null) {
  if (
    !raw ||
    !raw.startsWith("/sales") ||
    raw.startsWith("//") ||
    raw.includes("://") ||
    raw.startsWith("/sales/company")
  ) {
    return "/sales";
  }
  return raw;
}

function SalesCompanySelectionPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loadingKey, setLoadingKey] = useState<SalesCompanyKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canGoBack = hasSelectedSalesWorkspace();

  useEffect(() => {
    void warmCompanyDirectory().catch(() => {});
  }, []);

  async function onSelect(key: SalesCompanyKey, comingSoon?: boolean) {
    if (!user?.id || loadingKey || comingSoon) return;
    setLoadingKey(key);
    setError(null);
    try {
      await selectSalesCompany(user.id, key);
      router.replace(inventoryDestination(searchParams.get("next")));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : `Could not open ${SALES_COMPANY_LABELS[key]}. Try again.`,
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
        Choose a company first. Stores and add-to-cart inventory will match that
        company.
      </p>
      {canGoBack ? (
        <button
          type="button"
          onClick={() => router.replace("/sales")}
          className="mt-3 self-start text-sm font-medium text-brand-dark hover:underline"
        >
          Back to stores
        </button>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="mt-10 grid flex-1 content-center gap-4 sm:grid-cols-2">
        {WORKSPACE_COMPANIES.map((company) => (
          <CompanyCard
            key={company.key}
            title={company.title}
            subtitle={company.subtitle}
            icon={company.icon}
            comingSoon={company.comingSoon}
            loading={loadingKey === company.key}
            disabled={loadingKey !== null}
            onClick={() => void onSelect(company.key, company.comingSoon)}
          />
        ))}
      </div>
    </div>
  );
}

function CompanyCard({
  title,
  subtitle,
  icon: Icon,
  comingSoon,
  loading,
  disabled,
  onClick,
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  comingSoon?: boolean;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || comingSoon}
      className="flex min-h-[160px] flex-col items-start rounded-2xl border border-line bg-white p-5 text-left shadow-[0_10px_30px_-18px_rgba(14,58,50,0.35)] transition hover:border-brand/50 hover:bg-[#fffaf2] disabled:cursor-not-allowed disabled:opacity-70"
    >
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/15 text-brand-dark">
        {loading ? (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        ) : (
          <Icon className="h-6 w-6" strokeWidth={1.75} />
        )}
      </span>
      <span className="mt-auto pt-8 text-lg font-semibold text-ink">{title}</span>
      <span className="mt-1 text-sm text-slate-500">{subtitle}</span>
      {comingSoon ? (
        <span className="mt-2 text-sm font-medium text-slate-400">
          Coming soon
        </span>
      ) : (
        <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-dark">
          Open
          <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
        </span>
      )}
    </button>
  );
}

export default function SalesCompanySelectionRoute() {
  return (
    <Suspense fallback={null}>
      <SalesCompanySelectionPage />
    </Suspense>
  );
}
