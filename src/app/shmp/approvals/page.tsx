"use client";

import { useEffect, useState } from "react";
import { ApprovalsBoard } from "@/components/ApprovalsBoard";
import { ErrorState, LoadingState } from "@/components/ui";
import { getCompanies } from "@/lib/api";
import { resolveSalesCompanyByKey } from "@/lib/sales-selected-company";

export default function ShmpApprovalsPage() {
  const [companyId, setCompanyId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getCompanies()
      .then((companies) => {
        if (cancelled) return;
        const id = resolveSalesCompanyByKey("shmp", companies)?.id || "";
        if (!id) setError("SHMP company was not found");
        else setCompanyId(id);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load company");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!companyId) return <LoadingState label="Loading approvals…" />;
  return <ApprovalsBoard companyId={companyId} />;
}
