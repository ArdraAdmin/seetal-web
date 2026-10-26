"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { FieldLabel, SecondaryButton } from "@/components/ui";
import type { CompanyKey } from "@/lib/stl-features-api";

export const DUBAI_TZ = "Asia/Dubai";

/** Live Dubai date/time, ticking every 30s. */
export function useDubaiNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return {
    date: new Intl.DateTimeFormat("en-GB", {
      timeZone: DUBAI_TZ,
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(now),
    time: new Intl.DateTimeFormat("en-GB", {
      timeZone: DUBAI_TZ,
      hour: "2-digit",
      minute: "2-digit",
    }).format(now),
    isoDate: new Intl.DateTimeFormat("en-CA", {
      timeZone: DUBAI_TZ,
    }).format(now),
  };
}

/** Format an ISO timestamp as Dubai local date + time. */
export function fmtDubai(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: DUBAI_TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function fmtDateOnly(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", { timeZone: DUBAI_TZ }).format(d);
}

export function CompanySwitcher({
  value,
  onChange,
  allowAll = false,
}: {
  value: CompanyKey | "all";
  onChange: (key: CompanyKey | "all") => void;
  allowAll?: boolean;
}) {
  const keys: Array<CompanyKey | "all"> = allowAll
    ? ["all", "stl", "shmp"]
    : ["stl", "shmp"];
  return (
    <div className="flex gap-2">
      {keys.map((key) => (
        <SecondaryButton
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={value === key ? "!bg-brand !text-ink !border-brand" : ""}
        >
          {key === "all" ? "All" : key.toUpperCase()}
        </SecondaryButton>
      ))}
    </div>
  );
}

export function SelectField({
  label,
  optional,
  className = "",
  children,
  ...props
}: {
  label: string;
  optional?: boolean;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block space-y-1.5">
      <FieldLabel
        label={label}
        required={Boolean(props.required)}
        optional={optional}
      />
      <select
        {...props}
        className={`w-full rounded-lg border border-line bg-white px-3 py-2 text-base text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand sm:text-sm ${className}`}
      >
        {children}
      </select>
    </label>
  );
}

const SALES_TABS = [
  { href: "/sales/account", label: "Overview" },
  { href: "/sales/attendance", label: "Attendance" },
  { href: "/sales/leave", label: "Leave" },
];

/** Tab strip that makes account / attendance / leave feel like one section. */
export function SalesAccountTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-5 flex gap-1 rounded-xl border border-line bg-white p-1 text-sm">
      {SALES_TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 rounded-lg px-3 py-2 text-center font-medium ${
              active ? "bg-brand text-ink" : "text-slate-600 hover:bg-[#f7f5f0]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  href,
  alert,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
  alert?: boolean;
}) {
  const body = (
    <>
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </>
  );
  const cls = `rounded-xl border bg-white p-4 ${
    alert ? "border-brand" : "border-line"
  }`;
  return href ? (
    <Link href={href} className={`block ${cls} hover:bg-[#f7f5f0]`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
