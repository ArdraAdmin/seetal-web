"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getAdminTrackingLocations,
  type TrackingLocation,
} from "@/lib/api";
import { isTrackingAdmin } from "@/lib/auth";
import {
  isTrackingUnlocked,
  onTrackingUnlockChange,
} from "@/lib/tracking-unlock";
import {
  SALES_MAP_REFRESH_MS,
  createPinState,
  locationKey,
  withStablePins,
} from "@/lib/sales-map";
import { useAuth } from "@/components/AuthProvider";
import { TrackingMap, type MapFocus } from "@/components/TrackingMap";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SecondaryButton,
} from "@/components/ui";

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

type MapPoint = TrackingLocation & { pin: number };

function fmtTime(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleTimeString();
}

export default function SalesMapPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<MapPoint[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [unlocked, setUnlocked] = useState(() => isTrackingUnlocked());
  const pinsRef = useRef(createPinState());
  const mapAnchorRef = useRef<HTMLDivElement>(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    return onTrackingUnlockChange(() => setUnlocked(isTrackingUnlocked()));
  }, []);

  const canAccess = isTrackingAdmin(user) && unlocked;

  useEffect(() => {
    if (authLoading) return;
    if (!isTrackingAdmin(user) || !isTrackingUnlocked()) {
      router.replace("/admin");
    }
  }, [authLoading, user, unlocked, router]);

  const load = useCallback(
    async (silent = false) => {
      if (!user?.id || !isTrackingAdmin(user) || !isTrackingUnlocked()) return;
      const firstLoad = !hasLoadedRef.current;
      if (!silent && firstLoad) {
        setLoading(true);
        setError(null);
      }
      try {
        const data = await getAdminTrackingLocations(user.id);
        setLocations(withStablePins(data.locations || [], pinsRef.current));
        hasLoadedRef.current = true;
        setError(null);
      } catch (e) {
        if (!hasLoadedRef.current) {
          setError(e instanceof Error ? e.message : "Failed to load locations");
        }
      } finally {
        if (!silent && firstLoad) setLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    if (!canAccess) return;
    void load();
    const id = setInterval(() => void load(true), SALES_MAP_REFRESH_MS);
    return () => clearInterval(id);
  }, [load, canAccess]);

  function openPerson(loc: MapPoint) {
    const key = locationKey(loc);
    setSelectedKey(key);
    if (typeof loc.lat === "number" && typeof loc.lng === "number") {
      const lat = loc.lat;
      const lng = loc.lng;
      setFocus((current) => ({
        token: (current?.token ?? 0) + 1,
        lat,
        lng,
      }));
    }
    mapAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (authLoading || !canAccess) {
    return <LoadingState label="Checking access…" />;
  }

  return (
    <div>
      <PageHeader
        title="Sales map"
        subtitle="Checked-in salesmen and where they are."
        actions={
          <SecondaryButton type="button" disabled={loading} onClick={() => void load()}>
            Refresh
          </SecondaryButton>
        }
      />

      {loading ? (
        <LoadingState label="Loading locations…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <>
          <p className="mb-3 text-sm font-medium text-slate-700">
            {locations.length === 0
              ? "No checked-in salesmen with a location"
              : `${locations.length} salesman${locations.length === 1 ? "" : "men"} live`}
          </p>
          <div ref={mapAnchorRef}>
            <TrackingMap
              locations={locations}
              apiKey={MAPS_KEY}
              selectedKey={selectedKey}
              focus={focus}
            />
          </div>
          {locations.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="Waiting for check-ins" />
            </div>
          ) : (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {locations.map((loc) => {
                const key = locationKey(loc);
                const selected = key === selectedKey;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => openPerson(loc)}
                    aria-pressed={selected}
                    className={`flex w-full gap-3 rounded-xl border bg-white p-3 text-left ${
                      selected
                        ? "border-brand ring-2 ring-brand"
                        : "border-line hover:border-slate-300"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
                        selected ? "bg-blue-700" : "bg-red-600"
                      }`}
                    >
                      {loc.pin}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-slate-900">
                        {loc.name || "Salesman"}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {loc.email}
                      </span>
                      <span className="mt-2 block text-xs text-slate-600">
                        Updated: {fmtTime(loc.updatedAt)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
