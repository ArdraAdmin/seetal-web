export type HrListSort = "name" | "oldest" | "visa";

export type HrSortable = {
  name: string;
  joiningDate?: string | null;
  visaExpiry?: string | null;
};

function time(value?: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

export function sortHrStaff<T extends HrSortable>(rows: T[], sort: HrListSort): T[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    if (sort === "oldest") {
      const byDate = time(a.joiningDate) - time(b.joiningDate);
      if (byDate !== 0) return byDate;
    } else if (sort === "visa") {
      const byVisa = time(a.visaExpiry) - time(b.visaExpiry);
      if (byVisa !== 0) return byVisa;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
  return copy;
}
