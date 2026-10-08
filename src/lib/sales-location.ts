import {
  getSalesAttendanceToday,
  updateSalesLocation,
} from "@/lib/api";

const HEARTBEAT_MS = 30_000;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let trackingUserId: string | null = null;
let prompted = false;

export type GeoPosition = {
  lat: number;
  lng: number;
  accuracy?: number;
};

export function isGeolocationSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.geolocation;
}

export function getCurrentPosition(
  timeoutMs = 15000,
): Promise<GeoPosition | null> {
  if (!isGeolocationSupported()) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 10_000 },
    );
  });
}

/** Returns true if the browser can provide a position (services + permission). */
export async function ensureLocationEnabled(): Promise<boolean> {
  if (!isGeolocationSupported()) return false;
  const pos = await getCurrentPosition();
  return !!pos;
}

export async function promptEnableLocationOnce(
  alertFn: (message: string) => void = (m) => window.alert(m),
): Promise<void> {
  if (prompted) return;
  prompted = true;
  if (!isGeolocationSupported()) {
    alertFn(
      "Location is not supported in this browser. Enable location to place orders.",
    );
    return;
  }
  const ok = await ensureLocationEnabled();
  if (!ok) {
    alertFn(
      "Please turn on location for this site to place orders and allow tracking after check-in.",
    );
  }
}

export async function startLocationHeartbeat(userId: string): Promise<void> {
  trackingUserId = userId;
  stopLocationHeartbeat();
  const push = async () => {
    if (!trackingUserId) return;
    const pos = await getCurrentPosition();
    if (!pos) return;
    try {
      await updateSalesLocation({
        userId: trackingUserId,
        lat: pos.lat,
        lng: pos.lng,
        accuracy: pos.accuracy,
      });
    } catch {
      // Not checked in / network — ignore
    }
  };
  await push();
  heartbeatTimer = setInterval(() => {
    void push();
  }, HEARTBEAT_MS);
}

export function stopLocationHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

export async function resumeTrackingIfCheckedIn(userId: string): Promise<void> {
  try {
    const data = await getSalesAttendanceToday(userId);
    if (data.checkedIn) {
      await startLocationHeartbeat(userId);
    } else {
      stopLocationHeartbeat();
    }
  } catch {
    // ignore
  }
}
