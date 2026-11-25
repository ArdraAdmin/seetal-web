export const HR_SHIFTS = [
  { id: "day", label: "Day", hours: "5:30 AM – 5:30 PM" },
  { id: "night", label: "Night", hours: "5:30 PM – 5:30 AM" },
] as const;

export type HrShiftId = (typeof HR_SHIFTS)[number]["id"];

/** Stored morning shifts are the previous name for the day window. */
export function normalizeHrShift(value: unknown): HrShiftId | "" {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "day" || raw === "morning") return "day";
  if (raw === "night") return "night";
  return "";
}

export function hrShiftName(value: unknown): string {
  const id = normalizeHrShift(value);
  return HR_SHIFTS.find((shift) => shift.id === id)?.label || "";
}

export function hrShiftOptionLabel(id: HrShiftId): string {
  const shift = HR_SHIFTS.find((row) => row.id === id);
  return shift ? `${shift.label} (${shift.hours})` : "";
}
