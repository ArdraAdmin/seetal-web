"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  isFreshShmpInventory,
  shmpDashboard,
  shmpInventory,
  type ShmpDashboardSummary,
  type ShmpStaffCounts,
} from "@/lib/shmp-api";
import {
  attendanceFilterHref,
  shmpSalesCategoryRows,
  shmpSalesTotal,
} from "@/lib/shmp-dashboard";

const emptyStaff: ShmpStaffCounts = {
  present: 0,
  absent: 0,
  leave: 0,
  holiday: 0,
  half_day: 0,
};

const PIE_COLORS = [
  "#0e3a32",
  "#f7a51c",
  "#2a6f62",
  "#c9840f",
  "#6b8f88",
  "#d4a24a",
  "#1a4d44",
  "#e8c27a",
];

type CategorySlice = {
  key: string;
  label: string;
  value: number;
  color: string;
};

export default function ShmpDashboardPage() {
  const [data, setData] = useState<ShmpDashboardSummary | null>(null);
  const [hasOwnInventory, setHasOwnInventory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 20000);

    (async () => {
      try {
        const [summary, products] = await Promise.all([
          shmpDashboard({
            signal: controller.signal,
          }),
          shmpInventory({ ownOnly: "1", excludeStl: "1" }).catch(() => []),
        ]);
        const own = (Array.isArray(products) ? products : []).filter((product) =>
          isFreshShmpInventory(product),
        );
        setHasOwnInventory(own.length > 0);
        setData(summary);
        setError(null);
      } catch (e) {
        const aborted = e instanceof DOMException && e.name === "AbortError";
        setError(
          aborted
            ? "Dashboard request timed out"
            : e instanceof Error
              ? e.message
              : "Failed to load",
        );
      } finally {
        window.clearTimeout(timer);
        setLoading(false);
      }
    })();

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, []);

  const staffToday = data?.staffToday || emptyStaff;
  const byCat = useMemo(() => {
    const rows = shmpSalesCategoryRows(
      data?.salesValueByCategory,
      hasOwnInventory,
    );
    return rows.map((row, i) => ({
      ...row,
      color: PIE_COLORS[i % PIE_COLORS.length],
    }));
  }, [data, hasOwnInventory]);
  const totalSales = shmpSalesTotal(byCat);
  const onHoliday = (staffToday.leave || 0) + (staffToday.holiday || 0);
  const rangeLabel =
    data?.from && data?.to
      ? `${formatDate(data.from)} – ${formatDate(data.to)}`
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">SHMP Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manufacturing overview — staff today, sales by category, cartons ready
          for delivery.
          {rangeLabel ? (
            <span className="text-slate-500"> Period: {rangeLabel}.</span>
          ) : null}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : error ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}. Ensure the API is running and your user has{" "}
          <code>environments</code> including <code>shmp</code>.
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Present today"
              value={String(staffToday.present || 0)}
              href={attendanceFilterHref("present")}
            />
            <Metric
              label="Absent today"
              value={String(staffToday.absent || 0)}
              href={attendanceFilterHref("absent")}
            />
            <Metric
              label="On holiday today"
              value={String(onHoliday)}
              href={attendanceFilterHref("leave")}
            />
            <Metric
              label="Cartons ready for delivery"
              value={String(Number(data?.totalReadyQty) || 0)}
              href="/shmp/production"
            />
          </div>

          <section className="rounded-2xl border border-line bg-white p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Sales value by category
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Confirmed SHMP production sales only. Existing SHMP-labelled
                  catalogue stock is Sarvah inventory and is not counted.
                </p>
              </div>
              <p className="text-lg font-semibold text-ink">
                {formatMoney(totalSales)}
              </p>
            </div>
            {byCat.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                {hasOwnInventory
                  ? "No confirmed SHMP production sales in this range."
                  : "No SHMP production inventory yet, so there are no SHMP sales to show."}
              </p>
            ) : (
              <div className="mt-5 grid gap-6 md:grid-cols-[220px_1fr] md:items-center">
                <CategoryPie slices={byCat} />
                <ul className="space-y-2">
                  {byCat.map((row) => (
                    <li
                      key={row.key}
                      className="flex items-center justify-between gap-4 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: row.color }}
                        />
                        <span className="truncate">{row.label}</span>
                      </span>
                      <span className="shrink-0 font-medium text-ink">
                        {formatMoney(row.value)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function CategoryPie({ slices }: { slices: CategorySlice[] }) {
  const total = slices.reduce((sum, row) => sum + row.value, 0);
  if (total <= 0) return null;

  const cx = 110;
  const cy = 110;
  const r = 96;
  const paths = slices.reduce<
    Array<CategorySlice & { start: number; end: number; sweep: number }>
  >((acc, slice) => {
    const start = acc.length ? acc[acc.length - 1].end : 0;
    const sweep = (slice.value / total) * 360;
    acc.push({ ...slice, start, end: start + sweep, sweep });
    return acc;
  }, []);

  return (
    <svg
      viewBox="0 0 220 220"
      className="mx-auto h-52 w-52"
      role="img"
      aria-label="Sales value by category"
    >
      {paths.length === 1 ? (
        <circle cx={cx} cy={cy} r={r} fill={paths[0].color} />
      ) : (
        paths.map((slice) => (
          <path
            key={slice.key}
            d={describeSlice(cx, cy, r, slice.start, slice.end)}
            fill={slice.color}
          />
        ))
      )}
      <circle cx={cx} cy={cy} r={52} fill="white" />
      <text
        x={cx}
        y={cy - 2}
        textAnchor="middle"
        className="fill-ink"
        fontSize="12"
        fontWeight="700"
      >
        {slices.length}
      </text>
      <text
        x={cx}
        y={cy + 16}
        textAnchor="middle"
        className="fill-slate-500"
        fontSize="10"
      >
        categories
      </text>
    </svg>
  );
}

function describeSlice(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polar(cx, cy, r, endAngle);
  const end = polar(cx, cy, r, startAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start[0]} ${start[1]} A ${r} ${r} 0 ${large} 0 ${end[0]} ${end[1]} Z`;
}

function polar(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function Metric({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-line bg-white p-4 transition hover:bg-[#f7f5f0]"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
    </Link>
  );
}

function formatMoney(n: number) {
  return `AED ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatDate(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
