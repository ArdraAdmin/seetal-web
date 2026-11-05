"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SecondaryButton,
  TextField,
} from "@/components/ui";
import { portalFieldVisible } from "@/lib/custom-users";
import { salesMoney } from "@/lib/sales";
import { getPayrollRegister, type PayrollRegisterRow } from "@/lib/stl-features-api";

function currentMonthValue() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" })
    .format(new Date())
    .slice(0, 7);
}

function parseMonth(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (!Number.isInteger(year) || monthNumber < 1 || monthNumber > 12) return null;
  return { year, monthNumber };
}

function formatDays(value: number) {
  if (!Number.isFinite(value)) return "-";
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2).replace(/0$/, "");
}

function sumMoney(rows: PayrollRegisterRow[], key: "basicSalary" | "otherBenefits" | "otSundays" | "totalSalary" | "food" | "finalPay") {
  return Math.round(rows.reduce((total, row) => total + (Number(row[key]) || 0), 0) * 100) / 100;
}

export function PayrollRegister() {
  const { user } = useAuth();
  const pathname = usePathname();
  const scope = pathname.startsWith("/shmp") ? "shmp" : "stl";
  const salaryVisible = portalFieldVisible(
    user?.customAccess,
    scope === "shmp" ? "shmp" : "selling",
    "hr",
    "salary",
  );
  const [month, setMonth] = useState(currentMonthValue);
  const [rows, setRows] = useState<PayrollRegisterRow[]>([]);
  const [label, setLabel] = useState("");
  const [foodPerMonth, setFoodPerMonth] = useState(230);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const parsedMonth = parseMonth(month);
  const year = parsedMonth?.year;
  const monthNumber = parsedMonth?.monthNumber;

  useEffect(() => {
    if (!user?.id || !salaryVisible || year == null || monthNumber == null) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      void getPayrollRegister(user.id, scope, year, monthNumber)
        .then((data) => {
          if (cancelled) return;
          setRows(data.rows || []);
          setLabel(data.label || "");
          setFoodPerMonth(data.foodPerMonth || 230);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setRows([]);
          setError(err instanceof Error ? err.message : "Failed to load payroll");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, salaryVisible, scope, year, monthNumber, reloadKey]);

  if (!salaryVisible) {
    return (
      <div>
        <PageHeader title="Payroll" subtitle="Salary is not included for this account." />
      </div>
    );
  }

  const term = query.trim().toLowerCase();
  const visible = term ? rows.filter((row) => row.name.toLowerCase().includes(term)) : rows;
  const moneyKeys = ["basicSalary", "otherBenefits", "otSundays", "totalSalary", "food", "finalPay"] as const;

  return (
    <div>
      <PageHeader
        title="Payroll"
        subtitle={
          label
            ? `${label} monthly salary. Food is AED ${foodPerMonth} when food served is on. Leave days are left out of that charge.`
            : "Monthly salary for this side. Leave days are left out of the food charge."
        }
        actions={
          <SecondaryButton type="button" disabled={loading} onClick={() => setReloadKey((value) => value + 1)}>
            Refresh
          </SecondaryButton>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-[12rem_minmax(0,18rem)]">
        <TextField
          label="Month"
          type="month"
          required
          value={month}
          onChange={(event) => setMonth(event.target.value)}
        />
        <TextField
          label="Search"
          placeholder="Name"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {!parsedMonth ? (
        <ErrorState message="Choose a valid month" />
      ) : loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => setReloadKey((value) => value + 1)} />
      ) : visible.length === 0 ? (
        <EmptyState
          title={rows.length === 0 ? "No one on this payroll" : "No matching people"}
          description={
            rows.length === 0
              ? scope === "shmp"
                ? "SHMP staff and factory workers with a salary record show up here."
                : "STL staff added in HR show up here."
              : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[64rem] text-left text-sm">
            <caption className="sr-only">{label || "Monthly"} payroll</caption>
            <thead className="border-b border-line bg-[#f7f5f0] text-xs uppercase text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">Name</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Absent days</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Present days</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Basic salary</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Other benefits</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">OT Sundays</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Total salary</th>
                <th scope="col" className="px-4 py-2 text-right font-medium text-red-700">Food</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Final</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((row) => (
                <tr key={`${row.kind}-${row.id}`}>
                  <th scope="row" className="px-4 py-2 text-left font-medium text-ink">{row.name}</th>
                  <td className="px-4 py-2 text-right tabular-nums">{formatDays(row.absentDays)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatDays(row.presentDays)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{salesMoney(row.basicSalary)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{salesMoney(row.otherBenefits)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{salesMoney(row.otSundays)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{salesMoney(row.totalSalary)}</td>
                  <td className={`px-4 py-2 text-right tabular-nums ${row.food > 0 ? "font-medium text-red-700" : ""}`}>
                    {salesMoney(row.food)}
                  </td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums text-ink">{salesMoney(row.finalPay)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-line bg-[#f7f5f0] text-sm font-semibold text-ink">
              <tr>
                <th scope="row" className="px-4 py-2 text-left">Total</th>
                <td className="px-4 py-2" />
                <td className="px-4 py-2" />
                {moneyKeys.map((key) => (
                  <td
                    key={key}
                    className={`px-4 py-2 text-right tabular-nums ${key === "food" ? "text-red-700" : ""}`}
                  >
                    {salesMoney(sumMoney(visible, key))}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
