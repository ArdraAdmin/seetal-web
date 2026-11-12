"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { Card, ErrorState, LoadingState, SecondaryButton, TextField } from "@/components/ui";
import { formatHrDate } from "@/lib/hr-profile";
import { salesMoney } from "@/lib/sales";
import {
  downloadGeneratedSalarySlips,
  skippedSalarySlipMessage,
} from "@/lib/salary-slip-generate";
import {
  deleteStoredSalarySlip,
  getSalarySlip,
  getStoredSalarySlips,
  saveStoredSalarySlip,
  uploadHrFile,
  type SalarySlip,
  type StoredSalarySlip,
} from "@/lib/stl-features-api";

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
  const { toast } = useToast();
  const pathname = usePathname();
  const scope = pathname.startsWith("/shmp") ? "shmp" : "stl";
  const [month, setMonth] = useState(() => dubaiMonthValue());
  const [slip, setSlip] = useState<SalarySlip | null>(null);
  const [stored, setStored] = useState<StoredSalarySlip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storedError, setStoredError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [generating, setGenerating] = useState(false);

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
    void Promise.resolve().then(() => {
      if (cancelled) return;
      if (!period) {
        setError("Choose a valid salary month");
        setSlip(null);
        setLoading(false);
        return;
      }
      setLoading(true);
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
    });
    return () => {
      cancelled = true;
    };
  }, [user, personId, kind, month]);

  const loadStored = useCallback(async () => {
    if (!user?.id || !personId) return;
    try {
      const result = await getStoredSalarySlips(user.id, kind, personId);
      setStored(result.slips || []);
      setStoredError(null);
    } catch (err) {
      setStoredError(err instanceof Error ? err.message : "Failed to load uploaded slips");
    }
  }, [user, personId, kind]);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id || !personId) return undefined;
    void getStoredSalarySlips(user.id, kind, personId)
      .then((result) => {
        if (!cancelled) {
          setStored(result.slips || []);
          setStoredError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setStoredError(err instanceof Error ? err.message : "Failed to load uploaded slips");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user, personId, kind]);

  const period = parseMonth(month);
  const uploaded = period
    ? stored.find((item) => item.year === period.year && item.month === period.month)
    : undefined;

  async function onUploadSlip(file: File) {
    if (!user?.id || !period) return;
    setUploading(true);
    try {
      const saved = await uploadHrFile(user.id, file);
      const result = await saveStoredSalarySlip(
        user.id,
        kind,
        personId,
        period.year,
        period.month,
        saved,
      );
      setStored(result.slips || []);
      setStoredError(null);
      toast("Salary slip uploaded", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  }

  async function onRemoveSlip() {
    if (!user?.id || !period || !uploaded) return;
    if (!confirm(`Remove the salary slip for ${String(period.month).padStart(2, "0")}/${period.year}?`)) return;
    setRemoving(true);
    try {
      const result = await deleteStoredSalarySlip(user.id, kind, personId, period.year, period.month);
      setStored(result.slips || []);
      toast("Salary slip removed", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to remove salary slip", "error");
    } finally {
      setRemoving(false);
    }
  }

  async function onGeneratePdf() {
    if (!user?.id || !period || !slip || generating) return;
    setGenerating(true);
    try {
      const result = await downloadGeneratedSalarySlips({
        userId: user.id,
        year: period.year,
        month: period.month,
        scope: kind === "user" ? undefined : scope,
        people: [
          {
            kind,
            id: personId,
            name: slip.name,
          },
        ],
      });
      const skipped = skippedSalarySlipMessage(result.skipped);
      toast(
        skipped || "Salary slip PDF downloaded",
        skipped ? "info" : "success",
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to generate salary slip", "error");
    } finally {
      setGenerating(false);
    }
  }

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
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44">
            <TextField
              label="Salary month"
              type="month"
              required
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </div>
          <SecondaryButton
            type="button"
            disabled={loading || !slip || !period || generating}
            onClick={() => void onGeneratePdf()}
          >
            {generating ? "Generating…" : "Generate PDF"}
          </SecondaryButton>
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
                  .map((line) => `${line.name} on ${formatHrDate(line.date)} at ${line.multiplier}×`)
                  .join(", ")}`
              : ""}
            . Other benefits is the predefined total monthly salary minus basic salary and statutory overtime.
            The additional Sunday allowance of {salesMoney(rates.sundayAllowancePerDay)} per Sunday worked
            {rates.sundayAllowanceSource === "employee" ? " for this person" : " from payroll settings"} is
            added on top and is not included in other benefits. A half day counts as half a shift.
          </p>
        </div>
      ) : null}
      <section className="mt-5 border-t border-line pt-4">
        <h3 className="text-sm font-semibold text-ink">Previous salary slip</h3>
        <p className="mt-1 text-xs text-slate-500">
          Upload a slip for this month. The file is stored privately.
        </p>
        {storedError ? <p className="mt-2 text-xs text-red-700">{storedError}</p> : null}
        {uploaded ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            {uploaded.file.url ? (
              <a
                href={uploaded.file.url}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-brand-dark underline"
              >
                {uploaded.file.fileName}
              </a>
            ) : (
              <span className="font-medium text-ink">{uploaded.file.fileName}</span>
            )}
            <button
              type="button"
              className="text-xs text-red-700 underline disabled:opacity-50"
              disabled={removing || uploading}
              onClick={() => void onRemoveSlip()}
            >
              {removing ? "Removing…" : "Remove"}
            </button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No slip uploaded for this month.</p>
        )}
        <label className="mt-3 block">
          <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
            {uploaded ? "Replace slip" : "Upload slip"}
          </span>
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
            disabled={!period || uploading || removing}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium"
            onChange={(event) => {
              const selected = event.target.files?.[0];
              event.target.value = "";
              if (selected) void onUploadSlip(selected);
            }}
          />
        </label>
        {uploading ? <p className="mt-1 text-xs text-slate-500">Uploading…</p> : null}
        {storedError ? (
          <button type="button" className="mt-2 text-xs underline" onClick={() => void loadStored()}>
            Retry
          </button>
        ) : null}
      </section>
    </Card>
  );
}
