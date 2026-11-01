import type { ReactNode } from "react";

export function StoreDetailGrid({
  rows,
}: {
  rows: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <dl className="grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="min-w-0">
          <dt className="text-xs font-medium text-slate-500">{row.label}</dt>
          <dd className="mt-0.5 break-words text-sm text-ink">{row.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
