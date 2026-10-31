/** Dubai is UTC+4 with no DST. */
const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const EXPIRY_ALERT_DAYS = 15;
export const VISA_ALERT_DAYS = 60;
export const EID_ALERT_DAYS = 60;
export const INSURANCE_ALERT_DAYS = 60;
export const SHARJAH_ALERT_DAYS = EXPIRY_ALERT_DAYS;
export const PASSPORT_ALERT_MONTHS = 6;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})/;

export type VisaExpiryRecord = {
  id: string;
  name?: string;
  email?: string;
  source?: string;
  role?: string;
  scope?: string;
  expiryDate?: string;
};

export type ExpiryAlertRow = {
  id: string;
  title: string;
  detail?: string;
  expiryDate: string;
  daysRemaining: number;
  href: string;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function dubaiDateOnly(now = Date.now()): string {
  const shifted = new Date(now + DUBAI_OFFSET_MS);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

function asDateOnly(value: string | Date | null | undefined): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return dubaiDateOnly(value.getTime());
  }
  const text = String(value).trim();
  const match = DATE_ONLY.exec(text);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return dubaiDateOnly(parsed.getTime());
}

function utcDayNumber(dateOnly: string): number {
  const [year, month, day] = dateOnly.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

export function calendarDaysUntil(
  expiry: string | Date | null | undefined,
  now = Date.now(),
): number | null {
  const expiryDay = asDateOnly(expiry);
  if (!expiryDay) return null;
  return utcDayNumber(expiryDay) - utcDayNumber(dubaiDateOnly(now));
}

export function isExpiringWithinDays(
  expiry: string | Date | null | undefined,
  days = EXPIRY_ALERT_DAYS,
  now = Date.now(),
): boolean {
  const remaining = calendarDaysUntil(expiry, now);
  return remaining != null && remaining <= days;
}

function addMonthsDateOnly(dateOnly: string, months: number): string {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const index = month - 1 + months;
  const nextYear = year + Math.floor(index / 12);
  const nextMonth = ((index % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(nextYear, nextMonth + 1, 0)).getUTCDate();
  const nextDay = Math.min(day, lastDay);
  return `${nextYear}-${pad(nextMonth + 1)}-${pad(nextDay)}`;
}

/** True when the expiry date is on or before the same calendar day N months ahead, including dates already past. */
export function isExpiringWithinMonths(
  expiry: string | Date | null | undefined,
  months: number,
  now = Date.now(),
): boolean {
  const expiryDay = asDateOnly(expiry);
  if (!expiryDay) return false;
  return expiryDay <= addMonthsDateOnly(dubaiDateOnly(now), months);
}

export function expiryUrgencyLabel(daysRemaining: number): string {
  if (daysRemaining < 0) {
    const ago = Math.abs(daysRemaining);
    return ago === 1 ? "Expired 1 day ago" : `Expired ${ago} days ago`;
  }
  if (daysRemaining === 0) return "Expires today";
  if (daysRemaining === 1) return "Expires tomorrow";
  return `In ${daysRemaining} days`;
}

export function visaAlertHref(person: {
  id: string;
  source?: string;
  role?: string | null;
  scope?: string | null;
}): string {
  if (person.source === "staff") {
    return person.scope === "shmp"
      ? `/shmp/hr/staff/${person.id}`
      : `/admin/hr/staff/${person.id}`;
  }
  if (person.source === "employee") return `/shmp/hr/worker/${person.id}`;
  if (person.role === "Sales" || person.role === "Supervisor") {
    return `/shmp/hr/user/${person.id}`;
  }
  return `/admin/hr/${person.id}`;
}

function compareAlerts(a: ExpiryAlertRow, b: ExpiryAlertRow) {
  if (a.daysRemaining !== b.daysRemaining) {
    return a.daysRemaining - b.daysRemaining;
  }
  return a.title.localeCompare(b.title);
}

export function mulkyaAlertsFromVehicles(
  vehicles: Array<{
    _id?: string;
    id?: string;
    value?: number | string;
    mulkyaExpiry?: string | Date | null;
  }>,
  now = Date.now(),
): ExpiryAlertRow[] {
  const rows: ExpiryAlertRow[] = [];
  for (const vehicle of vehicles) {
    const id = String(vehicle._id || vehicle.id || "").trim();
    const daysRemaining = calendarDaysUntil(vehicle.mulkyaExpiry, now);
    if (!id || daysRemaining == null || daysRemaining > EXPIRY_ALERT_DAYS) {
      continue;
    }
    const number = vehicle.value == null || vehicle.value === "" ? "—" : String(vehicle.value);
    rows.push({
      id,
      title: `Vehicle #${number}`,
      expiryDate: asDateOnly(vehicle.mulkyaExpiry) || "",
      daysRemaining,
      href: `/admin/vehicles/${id}`,
    });
  }
  return rows.sort(compareAlerts);
}

export function documentAlertsFromDashboard(
  input: {
    employees?: VisaExpiryRecord[] | unknown[];
    users?: VisaExpiryRecord[] | unknown[];
    staff?: VisaExpiryRecord[] | unknown[];
  } | null | undefined,
  within: { days?: number; months?: number },
  now = Date.now(),
): ExpiryAlertRow[] {
  const people = [
    ...((input?.employees as VisaExpiryRecord[] | undefined) || []),
    ...((input?.users as VisaExpiryRecord[] | undefined) || []),
    ...((input?.staff as VisaExpiryRecord[] | undefined) || []),
  ];
  const rows: ExpiryAlertRow[] = [];
  for (const person of people) {
    const id = String(person?.id || "").trim();
    const included =
      within.months != null
        ? isExpiringWithinMonths(person?.expiryDate, within.months, now)
        : isExpiringWithinDays(person?.expiryDate, within.days ?? EXPIRY_ALERT_DAYS, now);
    if (!id || !included) continue;
    const daysRemaining = calendarDaysUntil(person?.expiryDate, now);
    if (daysRemaining == null) continue;
    const title = person.name || person.email || "Staff";
    const detail =
      person.source === "employee"
        ? "Factory worker"
        : person.source === "staff"
          ? person.scope === "shmp"
            ? "SHMP staff"
            : "Staff"
          : person.email && person.name
            ? person.email
            : person.role || undefined;
    rows.push({
      id,
      title,
      detail,
      expiryDate: asDateOnly(person.expiryDate) || "",
      daysRemaining,
      href: visaAlertHref(person),
    });
  }
  return rows.sort(compareAlerts);
}

export function visaAlertsFromDashboard(
  input: {
    employees?: VisaExpiryRecord[] | unknown[];
    users?: VisaExpiryRecord[] | unknown[];
    staff?: VisaExpiryRecord[] | unknown[];
  } | null | undefined,
  now = Date.now(),
): ExpiryAlertRow[] {
  return documentAlertsFromDashboard(input, { days: VISA_ALERT_DAYS }, now);
}
