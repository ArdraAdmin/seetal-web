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

function toGeoPosition(pos: GeolocationPosition): GeoPosition {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
  };
}

function readPosition(options: PositionOptions): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(toGeoPosition(pos)),
      (err) => reject(err),
      options,
    );
  });
}

function watchOnce(timeoutMs: number): Promise<GeoPosition | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: GeoPosition | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      navigator.geolocation.clearWatch(id);
      resolve(value);
    };
    const timer = window.setTimeout(() => finish(null), timeoutMs);
    const id = navigator.geolocation.watchPosition(
      (pos) => finish(toGeoPosition(pos)),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) finish(null);
      },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 5 * 60_000 },
    );
  });
}

async function queryGeoPermission(): Promise<PermissionState | "unknown"> {
  try {
    if (!navigator.permissions?.query) return "unknown";
    const status = await navigator.permissions.query({ name: "geolocation" });
    return status.state;
  } catch {
    return "unknown";
  }
}

let inflight: Promise<GeoPosition | null> | null = null;
let positionReadyUntil = 0;
let orderAccessReadyUntil = 0;

function markPositionReady() {
  const until = Date.now() + 2 * 60_000;
  positionReadyUntil = until;
  orderAccessReadyUntil = until;
}

function markOrderAccessReady() {
  orderAccessReadyUntil = Date.now() + 2 * 60_000;
}

async function acquirePosition(timeoutMs: number): Promise<GeoPosition | null> {
  const attempts: PositionOptions[] = [
    {
      enableHighAccuracy: false,
      timeout: Math.min(8_000, timeoutMs),
      maximumAge: 5 * 60_000,
    },
    {
      enableHighAccuracy: true,
      timeout: timeoutMs,
      maximumAge: 60_000,
    },
  ];
  for (const options of attempts) {
    try {
      return await readPosition(options);
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? Number((err as GeolocationPositionError).code)
          : 0;
      if (code === 1) return null;
    }
  }
  return watchOnce(Math.min(8_000, timeoutMs));
}

export function getCurrentPosition(
  timeoutMs = 12000,
): Promise<GeoPosition | null> {
  if (!isGeolocationSupported()) return Promise.resolve(null);
  if (inflight) return inflight;
  inflight = acquirePosition(timeoutMs).finally(() => {
    inflight = null;
  });
  return inflight;
}

/** Returns true when a position can actually be read. */
export async function ensureLocationEnabled(): Promise<boolean> {
  if (!isGeolocationSupported()) return false;
  if (Date.now() < positionReadyUntil) return true;
  const permission = await queryGeoPermission();
  if (permission === "denied") return false;
  const pos = await getCurrentPosition();
  if (!pos) return false;
  markPositionReady();
  return true;
}

/**
 * Orders only need location access, not a fresh high-accuracy GPS lock.
 * Desktop browsers often have location services on and still fail a precise fix.
 */
export async function ensureLocationForOrders(): Promise<boolean> {
  if (!isGeolocationSupported()) return false;
  if (Date.now() < orderAccessReadyUntil) return true;
  const before = await queryGeoPermission();
  if (before === "denied") return false;
  if (before === "granted") {
    try {
      await readPosition({
        enableHighAccuracy: false,
        timeout: 4_000,
        maximumAge: 5 * 60_000,
      });
      markPositionReady();
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? Number((err as GeolocationPositionError).code)
          : 0;
      if (code === 1) return false;
      markOrderAccessReady();
    }
    return true;
  }
  const pos = await getCurrentPosition();
  if (pos) {
    markPositionReady();
    return true;
  }
  const after = await queryGeoPermission();
  if (after === "granted") {
    markOrderAccessReady();
    return true;
  }
  return false;
}

export async function locationOrderBlockMessage(): Promise<string> {
  const permission = await queryGeoPermission();
  if (permission === "denied") {
    return "Location is blocked for this site. Allow it in the address bar, then open the cart again.";
  }
  return "Turn on location for this browser to open the cart and place orders.";
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
  const ok = await ensureLocationForOrders();
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
