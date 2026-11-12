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

/** Monthly food rate that produces this charge after annual leave and holiday days are removed. */
export function foodRateFromCharge(charge: number, calendarDays: number, foodFreeDays: number) {
  if (!(charge > 0) || calendarDays <= 0) return null;
  const chargeable = calendarDays - foodFreeDays;
  if (chargeable <= 0) return roundPayrollMoney(charge);
  return roundPayrollMoney((charge * calendarDays) / chargeable);
}

export function standardFoodCharge(rate: number, calendarDays: number, foodFreeDays: number) {
  if (calendarDays <= 0) return 0;
  const chargeable = Math.max(0, calendarDays - foodFreeDays);
  return roundPayrollMoney((rate * chargeable) / calendarDays);
}

/** Annual leave and holiday days are not charged for food. */
export function payrollFoodFreeDays(leaveDays?: number, holidayDays?: number) {
  return Math.max(0, (Number(leaveDays) || 0) + (Number(holidayDays) || 0));
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

function moneyCents(value: number) {
  return Math.round((roundPayrollMoney(value) + 1e-8) * 100);
}

/** Split a money total into `count` amounts that add back up to the total. */
export function splitPayrollMoney(total: number, count: number) {
  if (count <= 0) return [];
  const cents = moneyCents(total);
  const base = Math.trunc(cents / count);
  let extra = cents - base * count;
  const amounts: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const pennies = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra -= 1;
    amounts.push(pennies / 100);
  }
  return amounts;
}

export function payrollFoodPeople<T extends { food?: number; foodChargeable?: boolean }>(rows: T[]) {
  if (rows.some((row) => typeof row.foodChargeable === "boolean")) {
    return rows.filter((row) => row.foodChargeable === true).length;
  }
  return rows.filter((row) => (Number(row.food) || 0) > 0).length;
}

export function payrollMoneySum<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  return roundPayrollMoney(rows.reduce((total, row) => total + (Number(row[key]) || 0), 0));
}

export function payrollGrandTotal<T extends {
  totalSalary?: number;
  food?: number;
  fines?: number;
  loanDeduction?: number;
  finalPay?: number;
}>(rows: T[]) {
  return {
    salary: payrollMoneySum(rows, "totalSalary"),
    food: payrollMoneySum(rows, "food"),
    fines: payrollMoneySum(rows, "fines"),
    loans: payrollMoneySum(rows, "loanDeduction"),
    finalPay: payrollMoneySum(rows, "finalPay"),
  };
}

export type PayrollFoodSplit = { mode: "total" | "share"; amount: number };

export function payrollFoodSplit(
  value: { mode?: string; amount?: number } | null | undefined,
): PayrollFoodSplit | null {
  if (!value || (value.mode !== "total" && value.mode !== "share")) return null;
  const amount = Number(value.amount);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return { mode: value.mode, amount: roundPayrollMoney(amount) };
}

/**
 * Replace this month's food charges with one typed total or one typed share.
 * Final pay moves by the same amount as the food change.
 */
export function applyPayrollFoodSplit<T extends {
  food: number;
  finalPay: number;
  foodChargeable?: boolean;
}>(rows: T[], foodSplit: PayrollFoodSplit | null) {
  if (!foodSplit) return rows;
  const amount = Number(foodSplit.amount);
  if (!Number.isFinite(amount) || amount < 0) return rows;
  const indexes: number[] = [];
  rows.forEach((row, index) => {
    const chargeable = typeof row.foodChargeable === "boolean" ? row.foodChargeable : row.food > 0;
    if (chargeable) indexes.push(index);
  });
  if (indexes.length === 0) return rows;
  const shares = foodSplit.mode === "share"
    ? indexes.map(() => roundPayrollMoney(amount))
    : splitPayrollMoney(amount, indexes.length);
  return rows.map((row, index) => {
    const shareIndex = indexes.indexOf(index);
    if (shareIndex < 0) return row;
    const food = shares[shareIndex];
    return {
      ...row,
      food,
      finalPay: roundPayrollMoney(row.finalPay + row.food - food),
    };
  });
}
