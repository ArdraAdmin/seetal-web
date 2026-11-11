"use client";

import { useEffect, useState } from "react";
import { shmpOrderItemRmUsage, type RmUsage } from "@/lib/shmp-api";
import {
  formatRmQty,
  packagingSummary,
  usageShortage,
} from "@/lib/rm-usage";

export function PackagingUsage({
  orderId,
  productId,
  cartonQty,
}: {
  orderId: string;
  productId: string;
  cartonQty: number;
}) {
  const [usage, setUsage] = useState<RmUsage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId || !productId || cartonQty <= 0) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void shmpOrderItemRmUsage(orderId, productId, cartonQty)
        .then((next) => {
          if (cancelled) return;
          setUsage(next);
          setError(null);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setUsage(null);
          setError(err instanceof Error ? err.message : "Could not calculate packaging");
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [orderId, productId, cartonQty]);

  if (cartonQty <= 0) {
    return (
      <p className="text-xs text-slate-500">
        Enter carton quantities to see how many cartons and labels this allotment will use.
      </p>
    );
  }
  if (error) return <p className="text-xs text-red-700">{error}</p>;
  if (!usage) return <p className="text-xs text-slate-500">Calculating packaging…</p>;

  const summary = packagingSummary(usage.lines);
  const hasCartons = usage.lines.some((line) => line.kind === "Carton");
  const hasLabels = usage.lines.some((line) => line.kind === "Label");

  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
      <p className="font-medium text-ink">
        This allotment uses {formatRmQty(summary.cartons)} cartons and{" "}
        {formatRmQty(summary.labels)} labels.
      </p>
      {usage.missingSetup ? (
        <p className="mt-1">
          No carton or label materials are set up for this item. Packing can still be saved.
          A label checker cannot approve the stock deduction until they are set up.
        </p>
      ) : (
        <ul className="mt-1 space-y-1">
          {usage.lines.map((line) => {
            const short = usageShortage(line);
            return (
              <li key={`${line.kind}-${line.materialId}`}>
                {line.kind}: {line.name || line.code} · {formatRmQty(line.quantity)}
                {line.balance == null ? "" : ` · ${formatRmQty(line.balance)} in stock`}
                {short > 0 ? ` · short by ${formatRmQty(short)}` : ""}
              </li>
            );
          })}
          {!hasCartons ? <li>No carton material is set up for this item.</li> : null}
          {!hasLabels ? <li>No label material is set up for this item.</li> : null}
        </ul>
      )}
    </div>
  );
}
