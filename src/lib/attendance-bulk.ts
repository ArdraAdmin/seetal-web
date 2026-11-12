export type AttendancePersonChoice = {
  id: string;
  label: string;
};

export function filterAttendancePeople(
  people: AttendancePersonChoice[],
  query: string,
) {
  const needle = query.trim().toLowerCase();
  if (!needle) return people;
  return people.filter((person) => person.label.toLowerCase().includes(needle));
}

export function toggleSelectedId(selected: string[], id: string) {
  return selected.includes(id)
    ? selected.filter((item) => item !== id)
    : [...selected, id];
}

/** Add or remove the visible ids without changing people hidden by the filter. */
export function setVisibleSelection(
  selected: string[],
  visibleIds: string[],
  selectAll: boolean,
) {
  if (selectAll) {
    const next = new Set(selected);
    for (const id of visibleIds) next.add(id);
    return [...next];
  }
  const hide = new Set(visibleIds);
  return selected.filter((id) => !hide.has(id));
}

/** Holiday can be marked for any selected person. */
export function holidayStatusAvailable(selectedIds: string[]) {
  return selectedIds.length > 0;
}

/** Annual leave, sick leave, and holiday can cover more than one day. */
export function attendanceMarkSpan(status: string) {
  return status === "holiday" || status === "leave" || status === "sick";
}

/** Sick leave is stored as leave with a sick type. Annual leave stays annual. */
export function attendanceSaveStatus(value: string): {
  status: "present" | "absent" | "leave" | "holiday";
  leaveType?: "annual" | "sick";
} {
  if (value === "sick") return { status: "leave", leaveType: "sick" };
  if (value === "leave") return { status: "leave", leaveType: "annual" };
  if (value === "absent") return { status: "absent" };
  if (value === "holiday") return { status: "holiday" };
  return { status: "present" };
}

export type AwayKind = "holiday" | "annual" | "sick";

export function attendanceDayKey(value?: string | null) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(date);
}

export function personAwayKind(
  status?: string | null,
  leaveType?: string | null,
): AwayKind | null {
  if (status === "holiday") return "holiday";
  if (status === "sick") return "sick";
  if (status === "leave") return leaveType === "sick" ? "sick" : "annual";
  return null;
}

export function awayLabel(kind: AwayKind) {
  if (kind === "holiday") return "Holiday";
  if (kind === "sick") return "Sick leave";
  return "Annual leave";
}

function shiftDayKey(value: string, days: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Contiguous mark span that includes `today`, or null when today is not covered. */
export function awayDateSpan(dates: string[], today: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return null;
  const keys = [...new Set(dates.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort();
  if (!keys.includes(today)) return null;
  let from = today;
  let to = today;
  const set = new Set(keys);
  for (;;) {
    const earlier = shiftDayKey(from, -1);
    if (!earlier || !set.has(earlier)) break;
    from = earlier;
  }
  for (;;) {
    const later = shiftDayKey(to, 1);
    if (!later || !set.has(later)) break;
    to = later;
  }
  return { from, to };
}

function shortAwayDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const label = new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  return label;
}

/** Short label for a holiday/leave span, e.g. `1 Oct – 15 Nov`. */
export function formatAwayDateSpan(from: string, to: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return "";
  if (from === to) {
    const [year] = from.split("-");
    return `${shortAwayDay(from)} ${year}`;
  }
  const [fromYear] = from.split("-");
  const [toYear] = to.split("-");
  if (fromYear === toYear) return `${shortAwayDay(from)} – ${shortAwayDay(to)} ${toYear}`;
  return `${shortAwayDay(from)} ${fromYear} – ${shortAwayDay(to)} ${toYear}`;
}

export function awayMeta(kind: AwayKind, span: { from: string; to: string } | null) {
  const label = awayLabel(kind);
  if (!span) return label;
  const range = formatAwayDateSpan(span.from, span.to);
  return range ? `${label} · ${range}` : label;
}

/** Inclusive calendar dates from `from` through `to`. */
export function attendanceDatesInRange(from: string, to: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  if (to < from) return null;
  const [year, month, day] = from.split("-").map(Number);
  const cursor = new Date(Date.UTC(year, month - 1, day));
  const dates: string[] = [];
  for (let guard = 0; guard < 366; guard += 1) {
    const key = cursor.toISOString().slice(0, 10);
    dates.push(key);
    if (key === to) return dates;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return null;
}

export async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<Array<PromiseSettledResult<R>>> {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  const size = Math.max(0, Math.min(limit, items.length));
  let cursor = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        try {
          results[index] = {
            status: "fulfilled",
            value: await fn(items[index], index),
          };
        } catch (reason) {
          results[index] = { status: "rejected", reason };
        }
      }
    }),
  );
  return results;
}
