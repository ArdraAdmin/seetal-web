"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getAdminTrackingLocations,
  type TrackingLocation,
} from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";
import { TrackingMap } from "@/components/TrackingMap";
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SecondaryButton,
} from "@/components/ui";

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

function fmtTime(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleTimeString();
}

export default function AdminTrackingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<TrackingLocation[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!isSuperAdmin(user)) {
      router.replace("/admin");
    }
  }, [authLoading, user, router]);

  const load = useCallback(
    async (silent = false) => {
      if (!user?.id || !isSuperAdmin(user)) return;
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const data = await getAdminTrackingLocations(user.id);
        setLocations(data.locations || []);
      } catch (e) {
        if (!silent) {
          setError(e instanceof Error ? e.message : "Failed to load locations");
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(true), 20000);
    return () => clearInterval(id);
  }, [load]);

  if (authLoading || !isSuperAdmin(user)) {
    return <LoadingState label="Checking access…" />;
  }

  return (
    <div>
      <PageHeader
        title="Salesman tracking"
        subtitle="Live locations of checked-in salesmen on Google Maps."
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
              ? "No checked-in salesmen with live location"
              : `${locations.length} salesman${locations.length === 1 ? "" : "men"} live`}
          </p>
          <TrackingMap locations={locations} apiKey={MAPS_KEY} />
          {locations.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="Waiting for check-ins" />
            </div>
          ) : (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {locations.map((loc) => (
                <Card key={String(loc.salesId || loc._id)} className="p-3">
                  <p className="font-semibold text-slate-900">
                    {loc.name || "Salesman"}
                  </p>
                  <p className="text-xs text-slate-500">{loc.email}</p>
                  <p className="mt-2 text-xs text-slate-600">
                    Updated: {fmtTime(loc.updatedAt)}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
