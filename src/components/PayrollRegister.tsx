"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from "@/components/ui";
import { portalFieldVisible } from "@/lib/custom-users";
import {
  hrProfilePayload,
  hrProfileToForm,
  stlTotalSalary,
} from "@/lib/hr-profile";
import { salesMoney } from "@/lib/sales";
import {
  getEmployeeHr,
  getHrStaffRecord,
  getPayrollRegister,
  updateEmployeeHr,
  updateHrStaffRecord,
  type PayrollRegisterRow,
} from "@/lib/stl-features-api";

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

function moneyProblem(label: string, value: string, required: boolean) {
  const trimmed = value.trim();
  if (!trimmed) return required ? `${label} is required` : null;
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount < 0) return `${label} must be a non-negative number`;
  return null;
}

export function PayrollRegister() {
  const { user } = useAuth();
  const { toast } = useToast();
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
  const [editing, setEditing] = useState<PayrollRegisterRow | null>(null);
  const [editBasic, setEditBasic] = useState("");
  const [editOther, setEditOther] = useState("");
  const [editSunday, setEditSunday] = useState("");
  const [editFood, setEditFood] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const editRequest = useRef(0);
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

  function closeEdit() {
    if (editSaving) return;
    setEditing(null);
    setEditLoading(false);
  }

  function openEdit(row: PayrollRegisterRow) {
    const request = editRequest.current + 1;
    editRequest.current = request;
    setEditing(row);
    setEditBasic(String(row.basicSalary));
    setEditOther(String(row.otherBenefits));
    setEditSunday("");
    setEditFood(row.food > 0);
    if (!user?.id) return;
    setEditLoading(true);
    const load = row.kind === "employee"
      ? getEmployeeHr(user.id, row.id)
      : getHrStaffRecord(user.id, row.id);
    void load
      .then((record) => {
        if (editRequest.current !== request) return;
        const form = hrProfileToForm(record.hrProfile, record.name, scope);
        setEditBasic(form.basicSalary);
        setEditOther(form.otherBenefits !== "" ? form.otherBenefits : String(row.otherBenefits));
        setEditSunday(form.sundayAllowance);
        setEditFood(form.foodServed);
      })
      .catch((err: unknown) => {
        if (editRequest.current !== request) return;
        toast(err instanceof Error ? err.message : "Failed to load this salary", "error");
        setEditing(null);
      })
      .finally(() => {
        if (editRequest.current === request) setEditLoading(false);
      });
  }

  async function onSaveEdit(event: FormEvent) {
    event.preventDefault();
    if (!user?.id || !editing) return;
    const problem =
      moneyProblem("Basic salary", editBasic, true) ||
      moneyProblem("Other benefits", editOther, true) ||
      moneyProblem("Sunday allowance", editSunday, false);
    if (problem) {
      toast(problem, "info");
      return;
    }
    setEditSaving(true);
    try {
      const record = editing.kind === "employee"
        ? await getEmployeeHr(user.id, editing.id)
        : await getHrStaffRecord(user.id, editing.id);
      const form = hrProfileToForm(record.hrProfile, record.name, scope);
      form.basicSalary = editBasic.trim();
      form.otherBenefits = editOther.trim();
      form.sundayAllowance = editSunday.trim();
      form.foodServed = editFood;
      if (scope === "stl" || !form.totalSalary.trim()) {
        form.totalSalary = stlTotalSalary(form);
      }
      const hrProfile = hrProfilePayload(form, scope);
      if (editing.kind === "employee") {
        await updateEmployeeHr(user.id, editing.id, hrProfile);
      } else {
        await updateHrStaffRecord(user.id, editing.id, {
          hrProfile,
          enforceDocuments: false,
        });
      }
      toast("Payroll record saved", "success");
      setEditing(null);
      setReloadKey((value) => value + 1);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setEditSaving(false);
    }
  }

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
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
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
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      className="font-medium text-brand-dark underline"
                      onClick={() => openEdit(row)}
                    >
                      Edit
                    </button>
                  </td>
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
                <td className="px-4 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {editing ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-payroll-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeEdit();
          }}
        >
          <form
            onSubmit={onSaveEdit}
            className="w-full max-w-md space-y-3 rounded-2xl border border-line bg-white p-5 shadow-lg"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 id="edit-payroll-title" className="text-lg font-semibold text-ink">
                  Edit payroll
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {editing.name}. Present and absent days come from attendance. Sunday allowance updates OT Sundays. Leave it blank to use the company default.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={closeEdit}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </div>
            <TextField
              label="Basic salary (AED)"
              type="number"
              min={0}
              step="0.01"
              required
              value={editBasic}
              disabled={editLoading || editSaving}
              onChange={(event) => setEditBasic(event.target.value)}
            />
            <TextField
              label="Other benefits (AED)"
              type="number"
              min={0}
              step="0.01"
              required
              value={editOther}
              disabled={editLoading || editSaving}
              onChange={(event) => setEditOther(event.target.value)}
            />
            <TextField
              label="Sunday allowance (AED per Sunday)"
              type="number"
              min={0}
              step="0.01"
              optional
              value={editSunday}
              disabled={editLoading || editSaving}
              onChange={(event) => setEditSunday(event.target.value)}
            />
            <p className="text-xs text-slate-500">
              OT Sundays this month: {salesMoney(editing.otSundays)}
            </p>
            <button
              type="button"
              role="switch"
              aria-checked={editFood}
              disabled={editLoading || editSaving}
              onClick={() => setEditFood((value) => !value)}
              className="inline-flex items-center gap-2 text-sm font-medium text-ink disabled:opacity-60"
            >
              <span
                className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 ${
                  editFood ? "bg-brand" : "bg-slate-300"
                }`}
              >
                <span
                  className={`h-5 w-5 rounded-full bg-white shadow ${
                    editFood ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </span>
              Food served
              <span className="text-xs font-normal text-slate-500">{editFood ? "On" : "Off"}</span>
            </button>
            <div className="flex justify-end gap-2 pt-1">
              <SecondaryButton type="button" onClick={closeEdit} disabled={editSaving}>
                Cancel
              </SecondaryButton>
              <PrimaryButton type="submit" disabled={editLoading || editSaving}>
                {editSaving ? "Saving…" : "Save"}
              </PrimaryButton>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
