"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Card, PageHeader } from "@/components/ui";

function PaymentsInner() {
  const params = useSearchParams();
  const tab = params.get("tab") || "payments";

  return (
    <div>
      <PageHeader
        title={tab === "pdc" ? "Post-dated cheques" : "Payments"}
        subtitle="Payment registers will be completed in a later release."
      />
      <Card>
        <p className="text-sm text-slate-600">
          This section is reserved for payment entry and PDC management. The
          registers will appear here once the finance module is published.
        </p>
      </Card>
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense>
      <PaymentsInner />
    </Suspense>
  );
}
