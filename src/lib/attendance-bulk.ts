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
