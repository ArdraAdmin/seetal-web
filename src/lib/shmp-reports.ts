import type { ShmpAttendanceRow, ShmpProductionLogsResponse } from "./shmp-api";

type ShmpProductionLog = {
  entryId?: string;
  designation?: string;
  worker?: { _id?: string | null; name?: string };
  order?: { _id?: string; invoiceNo?: string } | null;
  store?: { _id?: string; storeName?: string; uid?: string } | null;
  item?: { _id?: string; name?: string; itemRef?: string } | null;
  date?: string | Date;
  cartonQty?: number;
  value?: number;
};

function productionLogStoreName(log: { store?: unknown }) {
  const store = log.store;
  if (!store || typeof store !== "object" || !("storeName" in store)) return "";
  return String((store as { storeName?: string }).storeName || "").trim();
}

function formatPackedCartonsValue(value: number) {
  const amount = Number.isFinite(value) ? value : 0;
  const formatted = new Intl.NumberFormat("en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `AED ${formatted}`;
}

const DUBAI_TZ = "Asia/Dubai";

export type ReportPerson = {
  key: string;
  name: string;
  role: string;
};

export type ProductionReport = {
  title: string;
  periodLabel: string;
  generatedLabel: string;
  cartons: number;
  value?: number;
  leaders: Array<{ name: string; cartons: number }>;
  workers: Array<{ name: string; cartons: number; value?: number }>;
  logs: Array<{
    date: string;
    worker: string;
    store: string;
    invoice: string;
    item: string;
    cartons: string;
    value?: string;
  }>;
};

export type AttendanceReport = {
  title: string;
  periodLabel: string;
  generatedLabel: string;
  staff: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  halfDays: number;
  holidayDays: number;
  people: Array<{
    name: string;
    role: string;
    present: number;
    absent: number;
    leave: number;
    halfDay: number;
    holiday: number;
  }>;
  days: Array<{
    date: string;
    name: string;
    role: string;
    status: string;
    checkIn: string;
    checkOut: string;
    leave: string;
    source: string;
  }>;
};

type AttendanceStatus = "present" | "half_day" | "leave" | "holiday" | "absent";

const STATUS_RANK: Record<AttendanceStatus, number> = {
  present: 5,
  half_day: 4,
  leave: 3,
  holiday: 2,
  absent: 1,
};

function part(date: Date, type: Intl.DateTimeFormatPartTypes, options: Intl.DateTimeFormatOptions) {
  return (
    new Intl.DateTimeFormat("en-GB", { timeZone: DUBAI_TZ, ...options })
      .formatToParts(date)
      .find((item) => item.type === type)?.value || ""
  );
}

export function dubaiToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DUBAI_TZ }).format(now);
}

export function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  return (
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day
  );
}

export function eachIsoDate(from: string, to: string) {
  if (!isCalendarDate(from) || !isCalendarDate(to) || from > to) return [];
  const [year, month, day] = from.split("-").map(Number);
  const cursor = new Date(Date.UTC(year, month - 1, day));
  const dates: string[] = [];
  while (dates.length <= 62) {
    const key = cursor.toISOString().slice(0, 10);
    dates.push(key);
    if (key === to) return dates;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return [];
}

export function monthBoundsIso(monthValue: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthValue);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: `${monthValue}-01`,
    to: `${monthValue}-${String(last).padStart(2, "0")}`,
  };
}

export function formatIsoDateLabel(iso: string) {
  if (!isCalendarDate(iso)) return iso;
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatMonthLabel(monthValue: string) {
  const bounds = monthBoundsIso(monthValue);
  if (!bounds) return monthValue;
  const [year, month] = bounds.from.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function dubaiClock(date: Date) {
  const hour = part(date, "hour", { hour: "2-digit", hourCycle: "h23" }).padStart(2, "0");
  const minute = part(date, "minute", { minute: "2-digit" }).padStart(2, "0");
  return `${hour}:${minute}`;
}

export function formatDubaiStamp(date: Date) {
  const day = part(date, "day", { day: "numeric" });
  const month = part(date, "month", { month: "short" });
  const year = part(date, "year", { year: "numeric" });
  return `${day} ${month} ${year}, ${dubaiClock(date)} Dubai`;
}

export function formatDubaiDateTime(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  const day = part(parsed, "day", { day: "2-digit" });
  const month = part(parsed, "month", { month: "short" });
  return `${day} ${month} ${dubaiClock(parsed)}`;
}

export function dubaiDateKey(value?: string | Date | null) {
  if (!value) return "";
  if (typeof value === "string" && isCalendarDate(value)) return value;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: DUBAI_TZ }).format(parsed);
}

export function dubaiRangeInstants(from: string, to: string) {
  if (!isCalendarDate(from) || !isCalendarDate(to) || from > to) return null;
  const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
  const [toYear, toMonth, toDay] = to.split("-").map(Number);
  const start = new Date(Date.UTC(fromYear, fromMonth - 1, fromDay) - 4 * 60 * 60 * 1000);
  const end = new Date(Date.UTC(toYear, toMonth - 1, toDay + 1) - 4 * 60 * 60 * 1000 - 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

function roundQty(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function formatQty(value: number) {
  const rounded = roundQty(value);
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function workerLabel(log: ShmpProductionLog) {
  const name = log.worker?.name || "Unassigned";
  return log.designation ? `${name} (${log.designation})` : name;
}

function attributeLogs(logs: ShmpProductionLog[]) {
  const groups = new Map<string, ShmpProductionLog[]>();
  logs.forEach((log, index) => {
    const worker = String(log.worker?._id || log.worker?.name || "unassigned");
    const key = log.entryId
      ? String(log.entryId)
      : `row-${index}-${worker}`;
    const group = groups.get(key) || [];
    group.push(log);
    groups.set(key, group);
  });

  const workers = new Map<string, { name: string; cartons: number; value: number; hasValue: boolean }>();
  let cartons = 0;
  let value = 0;
  let hasValue = false;

  for (const group of groups.values()) {
    const qty = Number(group[0]?.cartonQty) || 0;
    const lineValue = Number(group[0]?.value);
    const lineHasValue = Number.isFinite(lineValue);
    cartons += qty;
    if (lineHasValue) {
      hasValue = true;
      value += lineValue;
    }
    const share = group.length ? qty / group.length : 0;
    const valueShare = lineHasValue && group.length ? lineValue / group.length : 0;
    for (const log of group) {
      const id = String(log.worker?._id || log.worker?.name || "unassigned");
      const current = workers.get(id) || {
        name: workerLabel(log),
        cartons: 0,
        value: 0,
        hasValue: false,
      };
      current.cartons += share;
      if (lineHasValue) {
        current.hasValue = true;
        current.value += valueShare;
      }
      workers.set(id, current);
    }
  }

  return {
    cartons: roundQty(cartons),
    value: hasValue ? roundQty(value) : undefined,
    workers: [...workers.values()]
      .map((row) => ({
        name: row.name,
        cartons: roundQty(row.cartons),
        value: row.hasValue ? roundQty(row.value) : undefined,
      }))
      .sort((a, b) => b.cartons - a.cartons || a.name.localeCompare(b.name)),
  };
}

function dedupeLogs(logs: ShmpProductionLog[]) {
  const seen = new Set<string>();
  const unique: ShmpProductionLog[] = [];
  for (const log of logs) {
    const worker = String(log.worker?._id || log.worker?.name || "");
    const key = log.entryId
      ? `${log.entryId}:${worker}`
      : [
          dubaiDateKey(log.date),
          worker,
          log.order?._id,
          log.item?._id,
          log.cartonQty,
          productionLogStoreName(log),
        ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(log);
  }
  return unique.sort((a, b) => {
    const date = dubaiDateKey(a.date).localeCompare(dubaiDateKey(b.date));
    if (date) return date;
    return String(a.worker?.name || "").localeCompare(String(b.worker?.name || ""));
  });
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

export async function loadProductionLogs(
  range: { from: string; to: string },
  companyId: string,
  fetchLogs: (params: Record<string, string>) => Promise<ShmpProductionLogsResponse>,
) {
  const dates = eachIsoDate(range.from, range.to);
  if (!dates.length) throw new Error("Choose a valid period");
  const paramsFor = (extra: Record<string, string>) =>
    companyId ? { ...extra, companyId } : extra;

  if (range.from === range.to) {
    const day = await fetchLogs(paramsFor({ date: range.from }));
    return {
      logs: dedupeLogs(day.logs || []),
      cartons: Number(day.todayCartons) || 0,
      value: typeof day.todayValue === "number" ? day.todayValue : undefined,
    };
  }

  const ranged = await fetchLogs(paramsFor({ from: range.from, to: range.to }));
  if (ranged.periodStart && ranged.periodEnd) {
    return {
      logs: dedupeLogs(ranged.logs || []),
      cartons: Number(ranged.todayCartons) || 0,
      value: typeof ranged.todayValue === "number" ? ranged.todayValue : undefined,
    };
  }

  const days = await mapPool(dates, 6, (date) => fetchLogs(paramsFor({ date })));
  const logs = dedupeLogs(days.flatMap((day) => day.logs || []));
  const hasValue = days.every((day) => typeof day.todayValue === "number");
  return {
    logs,
    cartons: days.reduce((sum, day) => sum + (Number(day.todayCartons) || 0), 0),
    value: hasValue
      ? days.reduce((sum, day) => sum + (Number(day.todayValue) || 0), 0)
      : undefined,
  };
}

export function buildProductionReport(input: {
  title: string;
  periodLabel: string;
  generatedLabel: string;
  logs: ShmpProductionLog[];
  cartons?: number;
  value?: number;
  showValue: boolean;
}): ProductionReport {
  const logs = [...input.logs].sort((a, b) => {
    const date = dubaiDateKey(a.date).localeCompare(dubaiDateKey(b.date));
    if (date) return date;
    return String(a.worker?.name || "").localeCompare(String(b.worker?.name || ""));
  });
  const attributed = attributeLogs(logs);
  const shares = new Map<string, number>();
  logs.forEach((log, index) => {
    const key = log.entryId ? String(log.entryId) : `row-${index}`;
    shares.set(key, (shares.get(key) || 0) + 1);
  });
  const cartons =
    input.cartons && input.cartons > 0 ? roundQty(input.cartons) : attributed.cartons;
  const value = input.showValue
    ? typeof input.value === "number"
      ? roundQty(input.value)
      : attributed.value
    : undefined;
  const top = attributed.workers[0]?.cartons || 0;
  const leaders =
    top > 0
      ? attributed.workers.filter((worker) => worker.cartons === top)
      : [];

  return {
    title: input.title,
    periodLabel: input.periodLabel,
    generatedLabel: input.generatedLabel,
    cartons,
    value,
    leaders: leaders.map((worker) => ({
      name: worker.name,
      cartons: worker.cartons,
    })),
    workers: attributed.workers.map((worker) => ({
      name: worker.name,
      cartons: worker.cartons,
      value: input.showValue ? worker.value : undefined,
    })),
    logs: logs.map((log, index) => {
      const key = log.entryId ? String(log.entryId) : `row-${index}`;
      const share = shares.get(key) || 1;
      return {
        date: formatIsoDateLabel(dubaiDateKey(log.date)) || "-",
        worker: workerLabel(log),
        store: productionLogStoreName(log) || "-",
        invoice: log.order?.invoiceNo || "-",
        item: log.item?.name || log.item?.itemRef || "-",
        cartons: formatQty((Number(log.cartonQty) || 0) / share),
        value:
          input.showValue && typeof log.value === "number"
            ? formatPackedCartonsValue(log.value / share)
            : undefined,
      };
    }),
  };
}

function statusOf(value?: string): AttendanceStatus {
  const status = String(value || "").toLowerCase();
  if (status === "present" || status === "checked_out") return "present";
  if (status === "half_day" || status === "half-day" || status === "half day") {
    return "half_day";
  }
  if (status === "leave") return "leave";
  if (status === "holiday") return "holiday";
  return "absent";
}

function statusLabel(status: AttendanceStatus) {
  if (status === "half_day") return "Half day";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function leaveLabel(value?: string) {
  if (!value) return "-";
  if (value === "annual") return "Annual";
  if (value === "sick") return "Sick";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function sourceLabel(value?: string, remarks?: string) {
  const labels: Record<string, string> = {
    biometric: "Fingerprint",
    override: "Override",
    leave: "Leave",
    system: "System",
    checkin: "Portal",
  };
  const label = value ? labels[value] || value : "-";
  return remarks ? `${label} - ${remarks}` : label;
}

function earlier(a?: string | null, b?: string | null) {
  if (!a) return b || null;
  if (!b) return a;
  return new Date(a).getTime() <= new Date(b).getTime() ? a : b;
}

function later(a?: string | null, b?: string | null) {
  if (!a) return b || null;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

export function attendancePersonFromRow(row: ShmpAttendanceRow) {
  const employee = row.employee;
  if (employee) {
    const id = typeof employee === "object" ? String(employee._id || "") : String(employee);
    if (!id) return null;
    return {
      key: `worker:${id}`,
      name: typeof employee === "object" && employee.name ? employee.name : "Worker",
      role:
        typeof employee === "object" && employee.designation
          ? employee.designation
          : "Worker",
    };
  }
  const user = row.user;
  if (!user) return null;
  const id = typeof user === "object" ? String(user._id || "") : String(user);
  if (!id) return null;
  return {
    key: `portal:${id}`,
    name: typeof user === "object" && user.name ? user.name : "Supervisor",
    role: typeof user === "object" && user.role ? user.role : "Supervisor",
  };
}

function shiftName(row: ShmpAttendanceRow) {
  if (!row.shift || typeof row.shift !== "object") return "";
  return row.shift.name || "";
}

type AttendanceCell = {
  key: string;
  name: string;
  role: string;
  date: string;
  status: AttendanceStatus;
  checkInAt: string | null;
  checkOutAt: string | null;
  leaveType: string;
  source: string;
  remarks: string;
  shift: string;
};

function blankCell(person: ReportPerson, date: string): AttendanceCell {
  return {
    key: person.key,
    name: person.name,
    role: person.role,
    date,
    status: "absent",
    checkInAt: null,
    checkOutAt: null,
    leaveType: "",
    source: "",
    remarks: "",
    shift: "",
  };
}

export function buildAttendanceReport(input: {
  title: string;
  periodLabel: string;
  generatedLabel: string;
  from: string;
  to: string;
  people: ReportPerson[];
  rows: ShmpAttendanceRow[];
}): AttendanceReport {
  const dates = eachIsoDate(input.from, input.to);
  const roster = new Map<string, ReportPerson>();
  for (const person of input.people) {
    if (!person.key || roster.has(person.key)) continue;
    roster.set(person.key, {
      key: person.key,
      name: person.name || "Staff",
      role: person.role || "Staff",
    });
  }

  const cells = new Map<string, AttendanceCell>();
  for (const row of input.rows) {
    const person = attendancePersonFromRow(row);
    const date = dubaiDateKey(row.date || row.checkInAt);
    if (!person || !date || date < input.from || date > input.to) continue;
    const known = roster.get(person.key);
    const incoming: AttendanceCell = {
      key: person.key,
      name: known?.name || person.name,
      role: known?.role || person.role,
      date,
      status: statusOf(row.status),
      checkInAt: row.checkInAt || null,
      checkOutAt: row.checkOutAt || null,
      leaveType: row.leaveType || "",
      source: row.source || "",
      remarks: row.remarks || "",
      shift: shiftName(row),
    };
    const id = `${person.key}|${date}`;
    const existing = cells.get(id);
    if (!existing) {
      cells.set(id, incoming);
      continue;
    }
    const incomingWins = STATUS_RANK[incoming.status] > STATUS_RANK[existing.status];
    const winner = incomingWins ? incoming : existing;
    const other = incomingWins ? existing : incoming;
    cells.set(id, {
      ...winner,
      checkInAt: earlier(existing.checkInAt, incoming.checkInAt),
      checkOutAt: later(existing.checkOutAt, incoming.checkOutAt),
      leaveType: winner.leaveType || other.leaveType,
      remarks: winner.remarks || other.remarks,
      shift: winner.shift || other.shift,
      source: winner.source || other.source,
    });
  }

  for (const person of roster.values()) {
    for (const date of dates) {
      const id = `${person.key}|${date}`;
      if (!cells.has(id)) cells.set(id, blankCell(person, date));
    }
  }

  const list = [...cells.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name),
  );
  const people = new Map<
    string,
    AttendanceReport["people"][number] & { key: string }
  >();
  const summary = {
    presentDays: 0,
    absentDays: 0,
    leaveDays: 0,
    halfDays: 0,
    holidayDays: 0,
  };

  for (const cell of list) {
    const current = people.get(cell.key) || {
      key: cell.key,
      name: cell.name,
      role: cell.role,
      present: 0,
      absent: 0,
      leave: 0,
      halfDay: 0,
      holiday: 0,
    };
    if (cell.status === "present") {
      current.present += 1;
      summary.presentDays += 1;
    } else if (cell.status === "absent") {
      current.absent += 1;
      summary.absentDays += 1;
    } else if (cell.status === "leave") {
      current.leave += 1;
      summary.leaveDays += 1;
    } else if (cell.status === "half_day") {
      current.halfDay += 1;
      summary.halfDays += 1;
    } else if (cell.status === "holiday") {
      current.holiday += 1;
      summary.holidayDays += 1;
    }
    people.set(cell.key, current);
  }

  return {
    title: input.title,
    periodLabel: input.periodLabel,
    generatedLabel: input.generatedLabel,
    staff: people.size,
    ...summary,
    people: [...people.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((person) => ({
        name: person.name,
        role: person.role,
        present: person.present,
        absent: person.absent,
        leave: person.leave,
        halfDay: person.halfDay,
        holiday: person.holiday,
      })),
    days: list.map((cell) => ({
      date: formatIsoDateLabel(cell.date),
      name: cell.name,
      role: cell.shift ? `${cell.role}, ${cell.shift}` : cell.role,
      status: statusLabel(cell.status),
      checkIn: formatDubaiDateTime(cell.checkInAt),
      checkOut: formatDubaiDateTime(cell.checkOutAt),
      leave: leaveLabel(cell.leaveType),
      source: sourceLabel(cell.source, cell.remarks),
    })),
  };
}

function leaderLine(leaders: ProductionReport["leaders"]) {
  if (!leaders.length) return "Highest cartons: no cartons packed";
  const names = leaders.map((leader) => leader.name).join(", ");
  const qty = formatQty(leaders[0].cartons);
  return leaders.length === 1
    ? `Highest cartons: ${names} (${qty})`
    : `Highest cartons: ${names} (${qty} each)`;
}

export function renderProductionReport(report: ProductionReport) {
  const pdf = createPdfDocument();
  const showValue = typeof report.value === "number";
  pdf.text("SHMP", { size: 11, bold: true, gap: 2 });
  pdf.text(report.title, { size: 18, bold: true, gap: 3 });
  pdf.text(report.periodLabel, { size: 12, gap: 2 });
  pdf.text(`Generated ${report.generatedLabel}`, { size: 9, gap: 2 });
  pdf.rule();
  pdf.text(`Total cartons packed: ${formatQty(report.cartons)}`, { size: 12, bold: true });
  if (showValue) {
    pdf.text(`Packed cartons value: ${formatPackedCartonsValue(report.value || 0)}`, {
      size: 12,
      bold: true,
    });
  }
  pdf.text(leaderLine(report.leaders), { size: 12, bold: true });
  pdf.gap(8);
  pdf.text("Cartons by worker", { size: 13, bold: true, gap: 6 });
  const workerColumns: PdfColumn[] = [
    { header: "Worker", width: 320 },
    { header: "Cartons", width: 120 },
  ];
  if (showValue) workerColumns.push({ header: "Value", width: 140 });
  if (!report.workers.length) {
    pdf.text("No packing logs for this period.");
  } else {
    pdf.table(
      workerColumns,
      report.workers.map((worker) => {
        const row = [worker.name, formatQty(worker.cartons)];
        if (showValue) row.push(formatPackedCartonsValue(worker.value || 0));
        return row;
      }),
    );
  }
  pdf.gap(10);
  pdf.text("Packing log", { size: 13, bold: true, gap: 6 });
  const logColumns: PdfColumn[] = [
    { header: "Date", width: 78 },
    { header: "Worker", width: 130 },
    { header: "Store", width: 140 },
    { header: "Invoice", width: 120 },
    { header: "Item", width: showValue ? 162 : 242 },
    { header: "Cartons", width: 60 },
  ];
  if (showValue) logColumns.push({ header: "Value", width: 80 });
  if (!report.logs.length) {
    pdf.text("No packing logs for this period.");
  } else {
    pdf.table(
      logColumns,
      report.logs.map((log) => {
        const row = [log.date, log.worker, log.store, log.invoice, log.item, log.cartons];
        if (showValue) row.push(log.value || formatPackedCartonsValue(0));
        return row;
      }),
    );
  }
  return pdf.bytes();
}

export function renderAttendanceReport(report: AttendanceReport) {
  const pdf = createPdfDocument();
  pdf.text("SHMP", { size: 11, bold: true, gap: 2 });
  pdf.text(report.title, { size: 18, bold: true, gap: 3 });
  pdf.text(report.periodLabel, { size: 12, gap: 2 });
  pdf.text(`Generated ${report.generatedLabel}`, { size: 9, gap: 2 });
  pdf.rule();
  pdf.text(`Staff: ${report.staff}`, { size: 11, bold: true });
  pdf.text(`Present days: ${report.presentDays}`, { size: 11 });
  pdf.text(`Absent days: ${report.absentDays}`, { size: 11 });
  pdf.text(`Leave days: ${report.leaveDays}`, { size: 11 });
  pdf.text(`Half days: ${report.halfDays}`, { size: 11 });
  pdf.text(`Holidays: ${report.holidayDays}`, { size: 11 });
  pdf.gap(8);
  pdf.text("By person", { size: 13, bold: true, gap: 6 });
  if (!report.people.length) {
    pdf.text("No attendance for this period.");
  } else {
    pdf.table(
      [
        { header: "Name", width: 170 },
        { header: "Role", width: 120 },
        { header: "Present", width: 80 },
        { header: "Absent", width: 80 },
        { header: "Leave", width: 70 },
        { header: "Half day", width: 80 },
        { header: "Holiday", width: 80 },
      ],
      report.people.map((person) => [
        person.name,
        person.role,
        String(person.present),
        String(person.absent),
        String(person.leave),
        String(person.halfDay),
        String(person.holiday),
      ]),
    );
  }
  pdf.gap(10);
  pdf.text("Daily log", { size: 13, bold: true, gap: 6 });
  if (!report.days.length) {
    pdf.text("No attendance for this period.");
  } else {
    pdf.table(
      [
        { header: "Date", width: 78 },
        { header: "Name", width: 130 },
        { header: "Role", width: 110 },
        { header: "Status", width: 70 },
        { header: "Check in", width: 100 },
        { header: "Check out", width: 100 },
        { header: "Leave", width: 70 },
        { header: "Source", width: 112 },
      ],
      report.days.map((day) => [
        day.date,
        day.name,
        day.role,
        day.status,
        day.checkIn,
        day.checkOut,
        day.leave,
        day.source,
      ]),
    );
  }
  return pdf.bytes();
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const PAGE_W = 842;
const PAGE_H = 595;
const MARGIN = 36;
const CONTENT_W = PAGE_W - MARGIN * 2;

type DrawOp =
  | { type: "text"; x: number; y: number; size: number; bold: boolean; text: string }
  | { type: "line"; x1: number; y: number; x2: number };

type Page = { ops: DrawOp[] };

type PdfColumn = { header: string; width: number };

const NARROW = new Set("ijlI1|'.,:; ");
const WIDE = new Set("MWmw@#%&");

function unitWidth(char: string) {
  if (char === " ") return 0.28;
  if (NARROW.has(char)) return 0.32;
  if (WIDE.has(char)) return 0.82;
  if (char >= "A" && char <= "Z") return 0.68;
  if (char >= "0" && char <= "9") return 0.56;
  return 0.5;
}

function pdfTextWidth(text: string, size: number) {
  let width = 0;
  for (const char of text) width += unitWidth(char) * size;
  return width;
}

function fitPdfText(text: string, size: number, maxWidth: number) {
  const value = text.replace(/\s+/g, " ").trim();
  if (!value) return "";
  if (pdfTextWidth(value, size) <= maxWidth) return value;
  let out = "";
  for (const char of value) {
    if (pdfTextWidth(`${out}${char}...`, size) > maxWidth) break;
    out += char;
  }
  return out ? `${out}...` : value.slice(0, 1);
}

function wrapPdfText(text: string, size: number, maxWidth: number) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  if (!words[0]) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (pdfTextWidth(next, size) <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = fitPdfText(word, size, maxWidth);
  }
  if (current) lines.push(current);
  return lines;
}

function pdfLiteral(text: string) {
  let out = "";
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code < 32 || code > 126) {
      out += "?";
      continue;
    }
    if (char === "\\" || char === "(" || char === ")") out += "\\";
    out += char;
  }
  return out;
}

function contentStream(page: Page) {
  const lines: string[] = [];
  for (const op of page.ops) {
    if (op.type === "line") {
      lines.push(
        "0.6 0.6 0.6 RG",
        "0.6 w",
        `${op.x1} ${op.y} m`,
        `${op.x2} ${op.y} l`,
        "S",
        "0 0 0 RG",
      );
      continue;
    }
    const font = op.bold ? "/F2" : "/F1";
    lines.push(
      "BT",
      `${font} ${op.size} Tf`,
      `1 0 0 1 ${op.x} ${op.y} Tm`,
      `(${pdfLiteral(op.text)}) Tj`,
      "ET",
    );
  }
  return lines.join("\n");
}

function toBytes(value: string) {
  const bytes = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i += 1) bytes[i] = value.charCodeAt(i);
  return bytes;
}

function serialize(objects: string[]) {
  let out = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(out.length);
    out += object.endsWith("\n") ? object : `${object}\n`;
  }
  const xref = out.length;
  const size = objects.length + 1;
  out += `xref\n0 ${size}\n`;
  out += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i += 1) {
    out += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return toBytes(out);
}

type PdfDocument = {
  text: (value: string, options?: { size?: number; bold?: boolean; gap?: number }) => void;
  gap: (amount?: number) => void;
  rule: () => void;
  table: (columns: PdfColumn[], rows: string[][]) => void;
  bytes: () => Uint8Array;
};

function createPdfDocument(): PdfDocument {
  const pages: Page[] = [];
  let page: Page = { ops: [] };
  pages.push(page);
  let y = PAGE_H - MARGIN;

  function newPage() {
    page = { ops: [] };
    pages.push(page);
    y = PAGE_H - MARGIN;
  }

  function ensure(height: number) {
    if (y - height < MARGIN) newPage();
  }

  function text(
    value: string,
    options?: { size?: number; bold?: boolean; gap?: number },
  ) {
    const size = options?.size ?? 10;
    const gap = options?.gap ?? 4;
    const bold = Boolean(options?.bold);
    for (const line of wrapPdfText(value, size, CONTENT_W)) {
      ensure(size + gap);
      page.ops.push({ type: "text", x: MARGIN, y, size, bold, text: line });
      y -= size + gap;
    }
  }

  function gap(amount = 8) {
    y -= amount;
    if (y < MARGIN) newPage();
  }

  function rule() {
    ensure(10);
    page.ops.push({ type: "line", x1: MARGIN, y, x2: PAGE_W - MARGIN });
    y -= 12;
  }

  function table(columns: PdfColumn[], rows: string[][]) {
    const size = 8;
    const rowH = 14;
    const drawHeader = () => {
      ensure(rowH + 6);
      let x = MARGIN;
      for (const column of columns) {
        page.ops.push({
          type: "text",
          x,
          y,
          size,
          bold: true,
          text: fitPdfText(column.header, size, column.width - 6),
        });
        x += column.width;
      }
      y -= 4;
      const width = columns.reduce((sum, column) => sum + column.width, 0);
      page.ops.push({ type: "line", x1: MARGIN, y, x2: MARGIN + width });
      y -= rowH;
    };

    drawHeader();
    for (const row of rows) {
      if (y - rowH < MARGIN) {
        newPage();
        drawHeader();
      }
      let x = MARGIN;
      row.forEach((cell, index) => {
        const column = columns[index];
        if (!column) return;
        page.ops.push({
          type: "text",
          x,
          y,
          size,
          bold: false,
          text: fitPdfText(cell || "-", size, column.width - 6),
        });
        x += column.width;
      });
      y -= rowH;
    }
  }

  function bytes() {
    pages.forEach((item, index) => {
      item.ops.push({
        type: "text",
        x: MARGIN,
        y: 18,
        size: 8,
        bold: false,
        text: `Page ${index + 1} of ${pages.length}`,
      });
    });

    const objects: string[] = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    ];
    const kids: string[] = [];
    pages.forEach((item, index) => {
      const pageId = 5 + index * 2;
      const streamId = pageId + 1;
      kids.push(`${pageId} 0 R`);
      const stream = contentStream(item);
      objects.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${streamId} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>`,
      );
      objects.push(
        `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
      );
    });
    objects[1] = `<< /Type /Pages /Count ${pages.length} /Kids [${kids.join(" ")}] >>`;

    return serialize(
      objects.map((body, index) => `${index + 1} 0 obj\n${body}\nendobj\n`),
    );
  }

  return { text, gap, rule, table, bytes };
}
