"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
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
import { shmpActionOn, shmpFieldOn, shmpModuleAllowed, shmpRecordAllowed } from "@/lib/shmp-permissions";
import {
  hrProfilePayload,
  hrProfileToForm,
  stlTotalSalary,
} from "@/lib/hr-profile";
import { salesMoney } from "@/lib/sales";
import {
  applyPayrollFoodSplit,
  currentPayrollMonth,
  foodRateFromCharge,
  formatPayrollAbsentDate,
  linkedAttendanceDays,
  onePayrollRowPerPerson,
  payrollAbsentOrSickEntries,
  payrollFoodPeople,
  payrollFoodSplit,
  payrollGrandTotal,
  payrollMoneySum,
  roundPayrollMoney,
  payrollFoodFreeDays,
  standardFoodCharge,
  type PayrollAbsentOrSickEntry,
  type PayrollFoodSplit,
} from "@/lib/payroll-edit";
import { attendanceSaveStatus } from "@/lib/attendance-bulk";
import { shmpOverrideAttendance } from "@/lib/shmp-api";
import {
  getEmployeeHr,
  getHrStaffRecord,
  getPayrollRegister,
  markHrStaffAttendance,
  overrideSalesAttendance,
  savePayrollFood,
  savePayrollRow,
  updateEmployeeHr,
  updateHrStaffRecord,
  type PayrollRegister as PayrollRegisterData,
  type PayrollRegisterRow,
} from "@/lib/stl-features-api";

function monthHeading(value: string) {
  const parsed = parseMonth(value);
  if (!parsed) return "";
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(parsed.year, parsed.monthNumber - 1, 1)));
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

function sumMoney(rows: PayrollRegisterRow[], key: "basicSalary" | "otherBenefits" | "otSundays" | "totalSalary" | "food" | "fines" | "loanBalance" | "finalPay") {
  return Math.round(rows.reduce((total, row) => total + (Number(row[key]) || 0), 0) * 100) / 100;
}

function FoodAmountCard({
  label,
  display,
  editing,
  value,
  tone,
  disabled,
  onChange,
}: {
  label: string;
  display: string;
  editing: boolean;
  value: string;
  tone: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      {editing ? (
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className={`text-sm font-semibold ${tone}`}>AED</span>
          <input
            aria-label={label}
            inputMode="decimal"
            type="number"
            min={0}
            step="0.01"
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            className={`w-full min-w-0 bg-transparent text-2xl font-semibold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${tone}`}
          />
        </div>
      ) : (
        <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{display}</p>
      )}
    </div>
  );
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
  const salaryVisible =
    scope === "shmp"
      ? shmpModuleAllowed(user?.customAccess, "payroll")
      : portalFieldVisible(user?.customAccess, "selling", "hr", "salary");
  const canEditPayroll = scope !== "shmp" || shmpActionOn(user?.customAccess, "payroll", "edit");
  const payField = (fieldId: string) =>
    scope !== "shmp" || shmpFieldOn(user?.customAccess, "payroll", fieldId);
  const [month, setMonth] = useState(currentPayrollMonth);
  const [rows, setRows] = useState<PayrollRegisterRow[]>([]);
  const [label, setLabel] = useState("");
  const [foodPerMonth, setFoodPerMonth] = useState(230);
  const [foodSplit, setFoodSplit] = useState<PayrollFoodSplit | null>(null);
  const [foodDraft, setFoodDraft] = useState<{ mode: "total" | "share"; total: string; share: string } | null>(null);
  const [foodSaving, setFoodSaving] = useState(false);
  const [calendarDays, setCalendarDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState<PayrollRegisterRow | null>(null);
  const [editBasic, setEditBasic] = useState("");
  const [editOther, setEditOther] = useState("");
  const [editSunday, setEditSunday] = useState("");
  const [editFood, setEditFood] = useState(false);
  const [editPresent, setEditPresent] = useState("");
  const [editAbsent, setEditAbsent] = useState("");
  const [editOt, setEditOt] = useState("");
  const [editTotal, setEditTotal] = useState("");
  const [editFoodAmount, setEditFoodAmount] = useState("");
  const [editFines, setEditFines] = useState("");
  const [editLoan, setEditLoan] = useState("");
  const [dayDate, setDayDate] = useState("");
  const [dayStatus, setDayStatus] = useState("present");
  const [dayReason, setDayReason] = useState("");
  const [daySaving, setDaySaving] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [absentDatesFor, setAbsentDatesFor] = useState<{
    name: string;
    entries: PayrollAbsentOrSickEntry[];
  } | null>(null);
  const editRequest = useRef(0);
  const applyRegister = useCallback((data: PayrollRegisterData) => {
    setRows(onePayrollRowPerPerson(data.rows || []));
    setLabel(data.label || "");
    setFoodPerMonth(data.foodPerMonth || 230);
    setCalendarDays(data.calendarDays || 30);
    setFoodSplit(payrollFoodSplit(data.foodSplit));
    setFoodDraft(null);
  }, []);

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
          applyRegister(data);
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
  }, [user?.id, salaryVisible, scope, year, monthNumber, reloadKey, applyRegister]);

  function closeEdit() {
    if (editSaving) return;
    setEditing(null);
    setEditLoading(false);
  }

  function openAbsentDates(row: PayrollRegisterRow) {
    setAbsentDatesFor({
      name: row.name,
      entries: payrollAbsentOrSickEntries(row.absentOrSickDates),
    });
  }

  function closeAbsentDates() {
    setAbsentDatesFor(null);
  }

  useEffect(() => {
    if (!absentDatesFor) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeAbsentDates();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [absentDatesFor]);

  function openEdit(row: PayrollRegisterRow) {
    const source = rows.find((item) => item.id === row.id && item.kind === row.kind) || row;
    const request = editRequest.current + 1;
    editRequest.current = request;
    setEditing(source);
    setEditBasic(String(source.basicSalary));
    setEditOther(String(source.otherBenefits));
    setEditSunday("");
    setEditFood(source.food > 0);
    setEditPresent(String(source.presentDays));
    setEditAbsent(String(source.absentDays));
    setEditOt(String(source.otSundays));
    setEditTotal(String(source.totalSalary));
    setEditFoodAmount(String(source.food));
    setEditFines(String(row.fines || 0));
    setEditLoan("");
    setDayDate(`${month}-01`);
    setDayStatus("present");
    setDayReason("");
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

  function applyPresent(value: string) {
    const days = linkedAttendanceDays(Number(value), calendarDays);
    setEditPresent(String(days.presentDays));
    setEditAbsent(String(days.absentDays));
  }

  function applyAbsent(value: string) {
    const absent = Number(value);
    if (!Number.isFinite(absent)) {
      setEditAbsent(value);
      return;
    }
    applyPresent(String(calendarDays - absent));
  }

  async function onSaveDay() {
    if (!user?.id || !editing) return;
    if (!dayDate) {
      toast("Choose a date", "info");
      return;
    }
    const saved = attendanceSaveStatus(dayStatus);
    const status = saved.status;
    setDaySaving(true);
    try {
      if (editing.attendanceType === "employee") {
        if (!editing.companyId) throw new Error("Selected worker has no company");
        await shmpOverrideAttendance({
          companyId: editing.companyId,
          employeeId: editing.attendanceId,
          date: new Date(dayDate).toISOString(),
          newStatus: status,
          ...(saved.leaveType ? { leaveType: saved.leaveType } : {}),
          reason: dayReason.trim(),
        });
      } else if (editing.attendanceType === "user") {
        await overrideSalesAttendance({
          userId: user.id,
          salesId: editing.attendanceId || editing.id,
          date: dayDate,
          status,
          ...(saved.leaveType ? { leaveType: saved.leaveType } : {}),
          reason: dayReason.trim() || undefined,
        });
      } else {
        await markHrStaffAttendance(user.id, editing.attendanceId || editing.id, {
          date: dayDate,
          status,
          ...(saved.leaveType ? { leaveType: saved.leaveType } : {}),
          reason: dayReason.trim(),
        });
      }
      const data = await getPayrollRegister(user.id, scope, year || 0, monthNumber || 0);
      applyRegister(data);
      const rows = onePayrollRowPerPerson(data.rows || []);
      const fresh = rows.find((row) => row.id === editing.id && row.kind === editing.kind);
      if (fresh) {
        setEditing(fresh);
        setEditPresent(String(fresh.presentDays));
        setEditAbsent(String(fresh.absentDays));
        setEditOt(String(fresh.otSundays));
        setEditFoodAmount(String(fresh.food));
        setEditFood(fresh.food > 0);
        setEditFines(String(fresh.fines || 0));
      }
      setDayReason("");
      toast("Attendance saved", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Attendance update failed", "error");
    } finally {
      setDaySaving(false);
    }
  }

  async function onSaveEdit(event: FormEvent) {
    event.preventDefault();
    if (!user?.id || !editing || year == null || monthNumber == null) return;
    const problem =
      moneyProblem("Basic salary", editBasic, true) ||
      moneyProblem("Other benefits", editOther, true) ||
      moneyProblem("Sunday allowance", editSunday, false) ||
      (scope === "shmp"
        ? moneyProblem("Present days", editPresent, true) ||
          moneyProblem("OT Sundays", editOt, true) ||
          moneyProblem("Food", editFoodAmount, true) ||
          moneyProblem("Fines", editFines, true) ||
          moneyProblem("Loan deduction", editLoan, false)
        : null);
    if (problem) {
      toast(problem, "info");
      return;
    }
    if (scope === "shmp") {
      const basic = Number(editBasic);
      const other = Number(editOther);
      const ot = Number(editOt);
      const sundayDays = editing.sundayDays || 0;
      const foodFree = payrollFoodFreeDays(editing.leaveDays, editing.holidayDays);
      const standard = standardFoodCharge(foodPerMonth, calendarDays, foodFree);
      const typedFood = editFood ? Number(editFoodAmount) : 0;
      const personalRate = editFood && Math.abs(typedFood - standard) > 0.009
        ? foodRateFromCharge(typedFood, calendarDays, foodFree)
        : null;
      setEditSaving(true);
      try {
        const data = await savePayrollRow(user.id, {
          scope: "shmp",
          year,
          month: monthNumber,
          id: editing.id,
          kind: editing.kind,
          presentDays: Number(editPresent),
          basicSalary: basic,
          otherBenefits: other,
          totalSalary: roundPayrollMoney(basic + other + ot),
          sundayAllowance: sundayDays > 0
            ? roundPayrollMoney(ot / sundayDays)
            : editSunday.trim() === "" ? "" : Number(editSunday),
          otAmount: sundayDays > 0 ? "" : ot,
          foodServed: editFood,
          foodPerMonth: personalRate == null ? "" : personalRate,
          fines: Number(editFines),
          loanDeduction: editLoan.trim() === "" ? 0 : Number(editLoan),
        });
        applyRegister(data);
        toast("Payroll record saved", "success");
        setEditing(null);
      } catch (err) {
        toast(err instanceof Error ? err.message : "Save failed", "error");
      } finally {
        setEditSaving(false);
      }
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

  function onFoodTotalChange(value: string) {
    const people = payrollFoodPeople(rows);
    const amount = Number(value);
    const share = Number.isFinite(amount) && amount >= 0 && people > 0
      ? String(roundPayrollMoney(amount / people))
      : "";
    setFoodDraft({ mode: "total", total: value, share });
  }

  function onFoodShareChange(value: string) {
    const people = payrollFoodPeople(rows);
    const amount = Number(value);
    const total = Number.isFinite(amount) && amount >= 0
      ? String(roundPayrollMoney(amount * people))
      : "";
    setFoodDraft({ mode: "share", total, share: value });
  }

  async function onSaveFood(event: FormEvent) {
    event.preventDefault();
    if (!user?.id || year == null || monthNumber == null || !foodDraft || foodSaving) return;
    const people = payrollFoodPeople(rows);
    if (people <= 0) {
      toast("Nobody has food served this month", "info");
      return;
    }
    const raw = foodDraft.mode === "total" ? foodDraft.total : foodDraft.share;
    const problem = moneyProblem(foodDraft.mode === "total" ? "Food total" : "Share this month", raw, true);
    if (problem) {
      toast(problem, "info");
      return;
    }
    setFoodSaving(true);
    try {
      const data = await savePayrollFood(user.id, {
        scope: "shmp",
        year,
        month: monthNumber,
        mode: foodDraft.mode,
        amount: Number(raw),
      });
      applyRegister(data);
      toast("Food split saved", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Food split failed", "error");
    } finally {
      setFoodSaving(false);
    }
  }

  async function onResetFood() {
    if (!user?.id || year == null || monthNumber == null || foodSaving) return;
    setFoodSaving(true);
    try {
      const data = await savePayrollFood(user.id, {
        scope: "shmp",
        year,
        month: monthNumber,
        mode: "standard",
      });
      applyRegister(data);
      toast("Food is back to the standard rate", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Food split failed", "error");
    } finally {
      setFoodSaving(false);
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
  const draftAmount = foodDraft
    ? Number(foodDraft.mode === "total" ? foodDraft.total : foodDraft.share)
    : Number.NaN;
  const draftSplit = foodDraft && Number.isFinite(draftAmount) && draftAmount >= 0
    ? { mode: foodDraft.mode, amount: draftAmount }
    : null;
  const displayRows = draftSplit ? applyPayrollFoodSplit(rows, draftSplit) : rows;
  const permitted =
    scope === "shmp"
      ? displayRows.filter((row) => shmpRecordAllowed(user?.customAccess, "payroll", "users", row.id))
      : displayRows;
  const visible = term ? permitted.filter((row) => row.name.toLowerCase().includes(term)) : permitted;
  const moneyKeys = (scope === "shmp"
    ? ["basicSalary", "otherBenefits", "otSundays", "totalSalary", "food", "loanBalance", "fines", "finalPay"]
    : ["basicSalary", "otherBenefits", "otSundays", "totalSalary", "food", "finalPay"]) as Array<
    "basicSalary" | "otherBenefits" | "otSundays" | "totalSalary" | "food" | "fines" | "loanBalance" | "finalPay"
  >;
  const foodTotal = payrollMoneySum(displayRows, "food");
  const foodPeople = displayRows.filter((row) => row.food > 0).length;
  const foodShare = foodPeople > 0 ? roundPayrollMoney(foodTotal / foodPeople) : 0;
  const foodTotalValue = foodDraft ? foodDraft.total : String(foodTotal);
  const foodShareValue = foodDraft ? foodDraft.share : String(foodShare);
  const canEditFood = canEditPayroll && (payField("food-total") || payField("share-this-month"));
  const grand = payrollGrandTotal(permitted);

  return (
    <div>
      <PageHeader
        title="Payroll"
        subtitle={
          monthHeading(month)
            ? `${monthHeading(month)}. Salary is the monthly amount for days marked present. A fully absent month pays nothing. Food is AED ${foodPerMonth} when food served is on. Holiday and annual leave days are left out. Absence and sick leave are still charged.${scope === "shmp" ? " Fines dated in this month are taken off the final pay." : ""}`
            : "Salary is the monthly amount for days marked present."
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
      {scope === "shmp" && !loading && !error && parsedMonth && permitted.length > 0 ? (
        <form className="mb-4" onSubmit={(event) => void onSaveFood(event)}>
          <div className="grid gap-3 sm:grid-cols-4">
            {payField("food-total") ? (
              <FoodAmountCard
                label="Food total"
                display={salesMoney(foodTotal)}
                editing={canEditPayroll}
                value={foodTotalValue}
                tone="text-red-700"
                disabled={foodSaving}
                onChange={onFoodTotalChange}
              />
            ) : null}
            {payField("people-charged") ? (
              <div className="rounded-2xl border border-line bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">People charged</p>
                <p className="mt-1 text-2xl font-semibold text-ink">{foodPeople}</p>
              </div>
            ) : null}
            {payField("share-this-month") ? (
              <FoodAmountCard
                label="Share this month"
                display={salesMoney(foodShare)}
                editing={canEditPayroll}
                value={foodShareValue}
                tone="text-ink"
                disabled={foodSaving}
                onChange={onFoodShareChange}
              />
            ) : null}
            {payField("headcount") ? (
              <div className="rounded-2xl border border-line bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Headcount</p>
                <p className="mt-1 text-2xl font-semibold text-ink">{permitted.length}</p>
                <p className="mt-1 text-xs text-slate-500">AED {foodPerMonth} per person before leave</p>
              </div>
            ) : null}
          </div>
          {canEditFood ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <PrimaryButton type="submit" disabled={!foodDraft || foodSaving}>
                {foodSaving ? "Saving…" : "Save food"}
              </PrimaryButton>
              {foodDraft ? (
                <SecondaryButton type="button" disabled={foodSaving} onClick={() => setFoodDraft(null)}>
                  Cancel
                </SecondaryButton>
              ) : null}
              {foodSplit ? (
                <SecondaryButton type="button" disabled={foodSaving} onClick={() => void onResetFood()}>
                  Standard rate
                </SecondaryButton>
              ) : null}
              <p className="text-xs text-slate-500">
                {payrollFoodPeople(rows) > 0
                  ? "Saving charges this share to each person on food. It applies to this month only."
                  : "Nobody has food served this month."}
              </p>
            </div>
          ) : null}
        </form>
      ) : null}
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
        <div>
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
                {scope === "shmp" ? (
                  <th scope="col" className="px-4 py-2 text-right font-medium text-red-700">Loans</th>
                ) : null}
                {scope === "shmp" ? (
                  <th scope="col" className="px-4 py-2 text-right font-medium text-red-700">Fines</th>
                ) : null}
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
                  <td className="px-4 py-2 text-right tabular-nums">
                    {row.absentDays > 0 ? (
                      <button
                        type="button"
                        className="font-medium text-brand-dark underline tabular-nums"
                        onClick={() => openAbsentDates(row)}
                      >
                        {formatDays(row.absentDays)}
                      </button>
                    ) : (
                      formatDays(row.absentDays)
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatDays(row.presentDays)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{salesMoney(row.basicSalary)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{salesMoney(row.otherBenefits)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{salesMoney(row.otSundays)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{salesMoney(row.totalSalary)}</td>
                  <td className={`px-4 py-2 text-right tabular-nums ${row.food > 0 ? "font-medium text-red-700" : ""}`}>
                    {salesMoney(row.food)}
                  </td>
                  {scope === "shmp" ? (
                    <td className={`px-4 py-2 text-right tabular-nums ${(row.loanBalance || 0) > 0 ? "font-medium text-red-700" : ""}`}>
                      {salesMoney(row.loanBalance || 0)}
                      {(row.loanDeduction || 0) > 0 ? (
                        <span className="block text-xs font-normal">Deducted {salesMoney(row.loanDeduction || 0)}</span>
                      ) : null}
                    </td>
                  ) : null}
                  {scope === "shmp" ? (
                    <td className={`px-4 py-2 text-right tabular-nums ${(row.fines || 0) > 0 ? "font-medium text-red-700" : ""}`}>
                      {salesMoney(row.fines || 0)}
                    </td>
                  ) : null}
                  <td className="px-4 py-2 text-right font-semibold tabular-nums text-ink">{salesMoney(row.finalPay)}</td>
                  <td className="px-4 py-2 text-right">
                    {canEditPayroll ? (
                    <button
                      type="button"
                      className="font-medium text-brand-dark underline"
                      onClick={() => openEdit(row)}
                    >
                      Edit
                    </button>
                    ) : null}
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
                    className={`px-4 py-2 text-right tabular-nums ${key === "food" || key === "fines" || key === "loanBalance" ? "text-red-700" : ""}`}
                  >
                    {salesMoney(sumMoney(visible, key))}
                  </td>
                ))}
                <td className="px-4 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Grand total</p>
            {term ? <p className="text-xs text-slate-500">All people this month</p> : null}
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${grand.finalPay < 0 ? "text-red-700" : "text-ink"}`}>
              {salesMoney(grand.finalPay)}
            </p>
          </div>
          <p className="max-w-xl text-sm text-slate-600">
            {scope === "shmp"
              ? `Salary ${salesMoney(grand.salary)}, minus food ${salesMoney(grand.food)}, loan deductions ${salesMoney(grand.loans)}, and fines ${salesMoney(grand.fines)}.`
              : `Salary ${salesMoney(grand.salary)}, minus food ${salesMoney(grand.food)}.`}
          </p>
        </div>
        </div>
      )}
      {absentDatesFor ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="absent-dates-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeAbsentDates();
          }}
        >
          <div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-lg">
            <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div className="min-w-0">
                <h2 id="absent-dates-title" className="text-lg font-semibold text-ink">
                  Absent days
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {absentDatesFor.name}. Dates marked absent or sick leave in {monthHeading(month) || "this month"}.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={closeAbsentDates}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </div>
            <div className="overflow-y-auto">
              {absentDatesFor.entries.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-slate-500">
                  No absent or sick leave dates found for this month.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {absentDatesFor.entries.map((entry) => (
                    <li
                      key={`${entry.date}-${entry.kind}`}
                      className="flex items-center justify-between gap-3 px-5 py-3.5"
                    >
                      <p className="font-medium text-ink">{formatPayrollAbsentDate(entry.date)}</p>
                      <span
                        className={`shrink-0 text-xs font-medium ${
                          entry.kind === "sick" ? "text-amber-800" : "text-slate-600"
                        }`}
                      >
                        {entry.label}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
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
            className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-2xl border border-line bg-white p-5 shadow-lg"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 id="edit-payroll-title" className="text-lg font-semibold text-ink">
                  Edit payroll
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {editing.name}. {scope === "shmp"
                    ? "Changes are saved on this person's salary and attendance."
                    : "Present and absent days come from attendance. Sunday allowance updates OT Sundays. Leave it blank to use the company default."}
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
            {scope === "shmp" ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField
                    label="Present days"
                    type="number"
                    min={0}
                    step="0.5"
                    required
                    value={editPresent}
                    disabled={editLoading || editSaving}
                    onChange={(event) => applyPresent(event.target.value)}
                  />
                  <TextField
                    label="Absent days"
                    type="number"
                    min={0}
                    step="0.5"
                    required
                    value={editAbsent}
                    disabled={editLoading || editSaving}
                    onChange={(event) => applyAbsent(event.target.value)}
                  />
                </div>
                <div className="rounded-xl border border-line p-3">
                  <p className="text-sm font-medium text-ink">Edit attendance</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Mark one day. Leave and holidays stay as they are when you change the day counts above.
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <TextField
                      label="Date"
                      type="date"
                      value={dayDate}
                      disabled={daySaving}
                      onChange={(event) => setDayDate(event.target.value)}
                    />
                    <label className="block space-y-1.5">
                      <span className="text-[13px] font-medium text-slate-700">Status</span>
                      <select
                        value={dayStatus}
                        disabled={daySaving}
                        onChange={(event) => setDayStatus(event.target.value)}
                        className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
                      >
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                        <option value="leave">Annual leave</option>
                        <option value="sick">Sick leave</option>
                        <option value="holiday">Holiday</option>
                      </select>
                    </label>
                  </div>
                  <TextField
                    label="Reason"
                    value={dayReason}
                    disabled={daySaving}
                    onChange={(event) => setDayReason(event.target.value)}
                  />
                  <SecondaryButton type="button" className="mt-3" disabled={daySaving} onClick={() => void onSaveDay()}>
                    {daySaving ? "Saving…" : "Save this day"}
                  </SecondaryButton>
                </div>
              </>
            ) : null}
            <TextField
              label="Basic salary (AED)"
              type="number"
              min={0}
              step="0.01"
              required
              value={editBasic}
              disabled={editLoading || editSaving}
              onChange={(event) => {
                setEditBasic(event.target.value);
                if (scope === "shmp") {
                  setEditTotal(String(roundPayrollMoney(Number(event.target.value) + Number(editOther) + Number(editOt))));
                }
              }}
            />
            <TextField
              label="Other benefits (AED)"
              type="number"
              min={0}
              step="0.01"
              required
              value={editOther}
              disabled={editLoading || editSaving}
              onChange={(event) => {
                setEditOther(event.target.value);
                if (scope === "shmp") {
                  setEditTotal(String(roundPayrollMoney(Number(editBasic) + Number(event.target.value) + Number(editOt))));
                }
              }}
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
            {scope === "shmp" ? (
              <>
                <TextField
                  label="OT Sundays (AED)"
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={editOt}
                  disabled={editLoading || editSaving}
                  onChange={(event) => {
                    setEditOt(event.target.value);
                    setEditTotal(String(roundPayrollMoney(Number(editBasic) + Number(editOther) + Number(event.target.value))));
                  }}
                />
                <TextField
                  label="Total salary (AED)"
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={editTotal}
                  disabled={editLoading || editSaving}
                  onChange={(event) => {
                    setEditTotal(event.target.value);
                    const other = roundPayrollMoney(Number(event.target.value) - Number(editBasic) - Number(editOt));
                    setEditOther(String(Math.max(0, other)));
                  }}
                />
              </>
            ) : (
            <p className="text-xs text-slate-500">
              OT Sundays this month: {salesMoney(editing.otSundays)}
            </p>
            )}
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
            {scope === "shmp" ? (
              <>
                <TextField
                  label="Food charge (AED)"
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={editFood ? editFoodAmount : "0"}
                  disabled={editLoading || editSaving || !editFood}
                  onChange={(event) => setEditFoodAmount(event.target.value)}
                />
                <TextField
                  label="Fines this month (AED)"
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={editFines}
                  disabled={editLoading || editSaving}
                  onChange={(event) => setEditFines(event.target.value)}
                />
                <TextField
                  label="Deduct from loan this month (AED)"
                  type="number"
                  min={0}
                  step="0.01"
                  optional
                  value={editLoan}
                  disabled={editLoading || editSaving}
                  onChange={(event) => setEditLoan(event.target.value)}
                />
                <p className="text-xs text-slate-500">
                  Outstanding loan {salesMoney(editing.loanBalance || 0)}
                  {(editing.loanDeduction || 0) > 0
                    ? `. Already deducted this month ${salesMoney(editing.loanDeduction || 0)}`
                    : ""}. A deduction is recorded as a loan repayment and comes off final pay.
                </p>
              </>
            ) : null}
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
