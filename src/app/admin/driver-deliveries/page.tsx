"use client";

import { useState, type FormEvent } from "react";
import { fmtDubai, useDubaiNow } from "@/components/StlFeatureUi";
import { useToast } from "@/components/Toast";
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from "@/components/ui";
import { getStoredAuth } from "@/lib/auth";
import {
  driverPodPath,
  getDriverDeliveriesToday,
} from "@/lib/stl-features-api";

type Result = Awaited<ReturnType<typeof getDriverDeliveriesToday>>;

export default function AdminDriverDeliveriesPage() {
  const dubai = useDubaiNow();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(e?: FormEvent) {
    e?.preventDefault();
    const q = query.trim();
    if (!q) {
      setError("Enter a driver name or ID");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const isId = /^[a-f\d]{24}$/i.test(q);
      setResult(
        await getDriverDeliveriesToday({
          driverId: isId ? q : undefined,
          driver: isId ? undefined : q,
          date: date || undefined,
        }),
      );
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Failed to load deliveries");
    } finally {
      setLoading(false);
    }
  }

  async function openPod(orderId: string) {
    const user = getStoredAuth();
    if (!user?.token) {
      toast("Not signed in", "error");
      return;
    }
    try {
      const res = await fetch(`/stl-api${driverPodPath(orderId)}`, {
        headers: {
          Authorization: user.token,
          "auth-token": user.token,
        },
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`Unable to open proof (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Unable to open proof", "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="Driver deliveries"
        subtitle={`Delivery sequence for a driver (defaults to today, Dubai: ${dubai.date}).`}
      />
      <Card className="mb-4">
        <form className="flex flex-wrap items-end gap-3" onSubmit={search}>
          <div className="min-w-56 flex-1">
            <TextField
              label="Driver name or ID"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Ahmed or 64f…"
            />
          </div>
          <div className="w-44">
            <TextField
              label="Date"
              type="date"
              optional
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <PrimaryButton type="submit" disabled={loading}>
            Search
          </PrimaryButton>
        </form>
      </Card>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void search()} />
      ) : result ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            <strong>{result.driver.name}</strong>
            {result.driver.phoneNo ? ` · ${result.driver.phoneNo}` : ""} ·{" "}
            {result.deliveries.length} deliveries ·{" "}
            {result.deliveries.filter((d) => d.completed).length} completed
          </p>
          {result.deliveries.length === 0 ? (
            <EmptyState title="No deliveries for this driver" />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-[#f7f5f0] text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-2">#</th>
                    <th className="px-4 py-2">Store</th>
                    <th className="px-4 py-2">Address</th>
                    <th className="px-4 py-2 text-right">Cartons</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Scheduled</th>
                    <th className="px-4 py-2">Map</th>
                    <th className="px-4 py-2">POD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {result.deliveries.map((d) => {
                    const href =
                      d.mapsUrl ||
                      (d.location
                        ? `https://www.google.com/maps?q=${d.location.lat},${d.location.lng}`
                        : null);
                    return (
                      <tr key={d.orderId}>
                        <td className="px-4 py-2">{d.sequence}</td>
                        <td className="px-4 py-2 font-medium">{d.storeName}</td>
                        <td className="px-4 py-2">{d.address || "-"}</td>
                        <td className="px-4 py-2 text-right">{d.cartons}</td>
                        <td className="px-4 py-2">
                          {d.completed ? (
                            <span className="font-medium text-emerald-700">
                              Delivered
                            </span>
                          ) : (
                            <span className="text-slate-600">
                              {d.status || "Pending"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {d.scheduledAt ? fmtDubai(d.scheduledAt) : "-"}
                        </td>
                        <td className="px-4 py-2">
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-brand-dark underline"
                            >
                              Open map
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {d.proofOfDelivery?.hasFile ? (
                            <SecondaryButton
                              type="button"
                              onClick={() => void openPod(d.orderId)}
                            >
                              View
                            </SecondaryButton>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
