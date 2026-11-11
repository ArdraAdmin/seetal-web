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

export function linkedAttendanceDays(present: number, calendarDays: number) {
  const presentDays = roundPayrollMoney(Math.max(0, present));
  return {
    presentDays,
    absentDays: roundPayrollMoney(Math.max(0, calendarDays - presentDays)),
  };
}
