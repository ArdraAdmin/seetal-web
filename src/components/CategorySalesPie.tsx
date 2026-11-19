"use client";

import { useMemo, useState } from "react";
import { salesMoney } from "@/lib/sales";
import {
  aggregateCategoryParents,
  pieSlicePath,
  type CategorySalesRow,
} from "@/lib/category-sales-pie";

export function CategorySalesPie({ rows }: { rows: CategorySalesRow[] }) {
  const slices = useMemo(() => aggregateCategoryParents(rows), [rows]);
  const [active, setActive] = useState<string | null>(null);

  if (slices.length === 0) {
    return <p className="mt-3 text-sm text-slate-500">No category data</p>;
  }

  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 96;
  let angle = 0;
  const paths = slices.map((slice) => {
    const sweep =
      slice.pct >= 99.999 ? 359.999 : Math.max((slice.pct / 100) * 360, 0.01);
    const start = angle;
    const end = angle + sweep;
    angle = end;
    return { ...slice, start, end };
  });

  const highlighted =
    slices.find((s) => s.key === active) || slices[0] || null;

  return (
    <div className="mt-4 grid gap-6 md:grid-cols-[auto_1fr] md:items-center">
      <div className="relative mx-auto">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label="Category-wise sales pie chart"
        >
          {paths.map((slice) => {
            const isActive = active == null || active === slice.key;
            return (
              <path
                key={slice.key}
                d={pieSlicePath(cx, cy, radius, slice.start, slice.end)}
                fill={slice.color}
                opacity={isActive ? 1 : 0.35}
                stroke="#fff"
                strokeWidth={2}
                className="cursor-pointer transition-opacity"
                onMouseEnter={() => setActive(slice.key)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(slice.key)}
                onBlur={() => setActive(null)}
              >
                <title>
                  {slice.name}: {salesMoney(slice.revenue)} (
                  {slice.pct.toFixed(1)}%)
                </title>
              </path>
            );
          })}
          <circle cx={cx} cy={cy} r={58} fill="#fff" />
          {highlighted ? (
            <text
              x={cx}
              y={cy - 6}
              textAnchor="middle"
              className="fill-ink"
              style={{ fontSize: 12, fontWeight: 600 }}
            >
              {highlighted.pct.toFixed(0)}%
            </text>
          ) : null}
          {highlighted ? (
            <text
              x={cx}
              y={cy + 14}
              textAnchor="middle"
              className="fill-slate-500"
              style={{ fontSize: 10 }}
            >
              {salesMoney(highlighted.revenue)}
            </text>
          ) : null}
        </svg>
      </div>

      <ul className="space-y-2">
        {slices.map((slice) => {
          const isActive = active === slice.key;
          return (
            <li key={slice.key}>
              <button
                type="button"
                className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition ${
                  isActive ? "bg-[#f7f5f0]" : "hover:bg-[#faf8f3]"
                }`}
                onMouseEnter={() => setActive(slice.key)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(slice.key)}
                onBlur={() => setActive(null)}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: slice.color }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                  {slice.name}
                </span>
                <span className="shrink-0 text-sm font-medium tabular-nums text-ink">
                  {salesMoney(slice.revenue)}
                </span>
                <span className="w-12 shrink-0 text-right text-xs tabular-nums text-slate-500">
                  {slice.pct.toFixed(0)}%
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
