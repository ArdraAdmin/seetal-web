export const DUBAI_TZ = "Asia/Dubai";

export type ShiftWindow = {
  _id?: string;
  name?: string;
  code?: string;
  startTime: string;
  endTime: string;
  endsNextDay?: boolean;
};

/** Factory defaults when no shift records exist yet. */
export const DEFAULT_FACTORY_SHIFTS: ShiftWindow[] = [
  {
    name: "Morning",
    code: "MORNING",
    startTime: "06:00",
    endTime: "18:00",
    endsNextDay: false,
  },
  {
    name: "Night",
    code: "NIGHT",
    startTime: "18:00",
    endTime: "06:00",
    endsNextDay: true,
  },
];

export function parseHhmm(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || "").trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

export function clockMinutesInZone(
  date: Date,
  timeZone = DUBAI_TZ,
): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value || 0,
  );
  return hour * 60 + minute;
}

export function shiftContainsMinutes(
  shift: ShiftWindow,
  minutes: number,
): boolean {
  const start = parseHhmm(shift.startTime);
  const end = parseHhmm(shift.endTime);
  if (start == null || end == null) return false;
  const overnight = Boolean(shift.endsNextDay) || start > end;
  if (overnight) return minutes >= start || minutes < end;
  return minutes >= start && minutes < end;
}

export function currentShift<T extends ShiftWindow>(
  shifts: T[],
  now = new Date(),
  timeZone = DUBAI_TZ,
): T | null {
  if (!Array.isArray(shifts) || shifts.length === 0) return null;
  const minutes = clockMinutesInZone(now, timeZone);
  return shifts.find((shift) => shiftContainsMinutes(shift, minutes)) || null;
}

export function shiftLabel(shift: ShiftWindow | null): string {
  if (!shift) return "";
  const name = String(shift.name || shift.code || "Shift").trim();
  return `${name} (${shift.startTime}–${shift.endTime})`;
}
