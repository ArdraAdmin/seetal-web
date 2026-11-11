/** Year-month for the current Asia/Dubai calendar day, `YYYY-MM`. */
export function currentPayrollMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month)) return "";
  return `${year}-${month}`;
}

export function roundPayrollMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/** Monthly food rate that produces this charge after leave days are removed. */
export function foodRateFromCharge(charge: number, calendarDays: number, leaveDays: number) {
  if (!(charge > 0) || calendarDays <= 0) return null;
  const chargeable = calendarDays - leaveDays;
  if (chargeable <= 0) return roundPayrollMoney(charge);
  return roundPayrollMoney((charge * calendarDays) / chargeable);
}

export function standardFoodCharge(rate: number, calendarDays: number, leaveDays: number) {
  if (calendarDays <= 0) return 0;
  const chargeable = Math.max(0, calendarDays - leaveDays);
  return roundPayrollMoney((rate * chargeable) / calendarDays);
}

function payrollNameKey(value?: string | null) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Drop the factory row when the same person is already on the register as staff. */
export function onePayrollRowPerPerson<T extends { name?: string | null; kind?: string | null }>(
  rows: T[],
) {
  const staffNames = new Set(
    rows
      .filter((row) => row.kind === "staff")
      .map((row) => payrollNameKey(row.name))
      .filter(Boolean),
  );
  return rows.filter((row) => {
    if (row.kind === "staff") return true;
    const name = payrollNameKey(row.name);
    return !name || !staffNames.has(name);
  });
}

export function linkedAttendanceDays(present: number, calendarDays: number) {
  const presentDays = roundPayrollMoney(Math.max(0, present));
  return {
    presentDays,
    absentDays: roundPayrollMoney(Math.max(0, calendarDays - presentDays)),
  };
}
