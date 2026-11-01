"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { fmtDateOnly } from "@/components/StlFeatureUi";
import { Card, ErrorState, LoadingState, TextField } from "@/components/ui";
import { salesMoney } from "@/lib/sales";
import { getSalarySlip, type SalarySlip } from "@/lib/stl-features-api";

function dubaiMonthValue(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
  })
    .format(date)
    .slice(0, 7);
}

function parseMonth(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

function MoneyRow({
  label,
  amount,
  strong = false,
}: {
  label: string;
  amount: number;
  strong?: boolean;
}) {
  return (
    <tr className={strong ? "border-t border-line font-semibold" : undefined}>
      <th scope="row" className="px-3 py-2 text-left font-medium text-ink">
        {label}
      </th>
      <td className="px-3 py-2 text-right tabular-nums">{salesMoney(amount)}</td>
    </tr>
  );
}

export function SalarySlipCard({
  kind,
  personId,
}: {
  kind: "user" | "staff" | "employee";
  personId: string;
}) {
  const { user } = useAuth();
  const [month, setMonth] = useState(() => dubaiMonthValue());
  const [slip, setSlip] = useState<SalarySlip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
  }, [month, personId, kind]);

  const load = useCallback(async () => {
    if (!user?.id || !personId) return;
    const period = parseMonth(month);
    if (!period) {
      setError("Choose a valid salary month");
      setSlip(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setSlip(await getSalarySlip(user.id, kind, personId, period.year, period.month));
    } catch (err) {
      setSlip(null);
      setError(err instanceof Error ? err.message : "Failed to calculate salary");
    } finally {
      setLoading(false);
    }
  }, [user, personId, kind, month]);

  useEffect(() => {
    let cancelled = false;
    const period = parseMonth(month);
    if (!user?.id || !personId) return undefined;
    if (!period) {
      setError("Choose a valid salary month");
      setSlip(null);
      setLoading(false);
      return undefined;
    }
    void getSalarySlip(user.id, kind, personId, period.year, period.month)
      .then((next) => {
        if (!cancelled) {
          setSlip(next);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setSlip(null);
          setError(err instanceof Error ? err.message : "Failed to calculate salary");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, personId, kind, month]);

  const rates = slip?.rates;
  const showAllowanceDays =
    slip != null && slip.attendance.sundayAllowanceDays !== slip.attendance.sundaysWorked;

  return (
    <Card className="mt-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Salary slip</h2>
          <p className="mt-1 text-xs text-slate-500">
            Statutory overtime uses basic salary. The Sunday allowance is a separate company payment.
          </p>
        </div>
        <div className="w-44">
          <TextField
            label="Salary month"
            type="month"
            required
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </div>
      </div>
      {loading ? (
        <LoadingState label="Calculating salary…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : slip && rates ? (
        <div className="space-y-5">
          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink">
              Attendance information · {slip.period.label}
            </h3>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Total attendance</dt>
                <dd className="mt-1 font-medium text-ink">{slip.attendance.totalLabel}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Weekdays worked</dt>
                <dd className="mt-1 font-medium text-ink">{slip.attendance.weekdaysWorked}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Sundays worked</dt>
                <dd className="mt-1 font-medium text-ink">{slip.attendance.sundaysWorked}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Public holidays worked</dt>
                <dd className="mt-1 font-medium text-ink">{slip.attendance.publicHolidaysWorked}</dd>
              </div>
              {showAllowanceDays ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">
                    Sundays for company allowance
                  </dt>
                  <dd className="mt-1 font-medium text-ink">{slip.attendance.sundayAllowanceDays}</dd>
                </div>
              ) : null}
            </dl>
          </section>
          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink">Salary breakdown</h3>
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-sm">
                <caption className="sr-only">Salary breakdown for {slip.period.label}</caption>
                <thead className="border-b border-line bg-[#f7f5f0] text-xs uppercase text-slate-500">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left font-medium">Salary component</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  <MoneyRow label="Basic salary" amount={slip.amounts.basicSalary} />
                  <MoneyRow label="Weekday OT" amount={slip.amounts.weekdayOt} />
                  <MoneyRow label="OT / Sunday (statutory)" amount={slip.amounts.sundayOt} />
                  <MoneyRow label="Public holiday OT" amount={slip.amounts.publicHolidayOt} />
                  <MoneyRow label="Other benefits" amount={slip.amounts.otherBenefits} />
                  <MoneyRow label="Additional Sunday allowance" amount={slip.amounts.sundayAllowance} />
                  <MoneyRow label="Total salary payable" amount={slip.amounts.totalPayable} strong />
                </tbody>
              </table>
            </div>
          </section>
          <p className="text-xs leading-5 text-slate-500">
            A shift is {rates.shiftHours} hours with a {rates.breakHours}-hour break, so {rates.actualHours} hours
            are worked. Weekday overtime is the extra {rates.extraHours} hours at {rates.weekdayMultiplier}× the
            hourly basic wage. Sunday statutory overtime is the full working day at {rates.sundayMultiplier}×.
            Public holiday overtime is the full working day at {rates.publicHolidayMultiplier}×
            {slip.holidayLines.length
              ? `, except ${slip.holidayLines
                  .map((line) => `${line.name} on ${fmtDateOnly(line.date)} at ${line.multiplier}×`)
                  .join(", ")}`
              : ""}
            . Other benefits is the predefined total monthly salary minus basic salary and statutory overtime.
            The additional Sunday allowance of {salesMoney(rates.sundayAllowancePerDay)} per Sunday worked
            {rates.sundayAllowanceSource === "employee" ? " for this person" : " from payroll settings"} is
            added on top and is not included in other benefits. A half day counts as half a shift.
          </p>
        </div>
      ) : null}
    </Card>
  );
}
