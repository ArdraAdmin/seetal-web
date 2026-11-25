/** Morning check-in is 5:30 AM Dubai. 5:45:00 is still on time. The next second is late. */
const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;
const LATE_AFTER_SECONDS = (5 * 60 + 45) * 60;

export function isMorningShift(shift: unknown): boolean {
  const raw = String(shift || "").trim().toLowerCase();
  return raw === "day" || raw === "morning";
}

/**
 * A morning or day shift is late when the recorded check-in is after 5:45 AM Dubai.
 * Night shift, a missing shift, and a missing check-in are not late.
 */
export function isLateCheckIn(shift: unknown, checkInAt: unknown): boolean {
  if (!isMorningShift(shift) || checkInAt == null || checkInAt === "") return false;
  const date = checkInAt instanceof Date ? checkInAt : new Date(String(checkInAt));
  if (Number.isNaN(date.getTime())) return false;
  const shifted = new Date(date.getTime() + DUBAI_OFFSET_MS);
  const seconds =
    shifted.getUTCHours() * 3600 +
    shifted.getUTCMinutes() * 60 +
    shifted.getUTCSeconds();
  return seconds > LATE_AFTER_SECONDS;
}
