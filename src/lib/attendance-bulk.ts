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

/** Holiday applies to factory workers only, and only when every selection is one. */
export function holidayStatusAvailable(selectedIds: string[]) {
  return (
    selectedIds.length > 0 &&
    selectedIds.every((id) => id.startsWith("worker:"))
  );
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
