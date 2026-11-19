"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  completeDriverDelivery,
  driverPodPath,
  getMyDriverDeliveries,
  type DriverDeliveriesPayload,
  type DriverDeliveryStop,
} from "@/lib/stl-features-api";
import { getStoredAuth } from "@/lib/auth";

export default function DriverDeliveriesPage() {
  const dubai = useDubaiNow();
  const { toast } = useToast();
  const [date, setDate] = useState("");
  const [result, setResult] = useState<DriverDeliveriesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<Record<string, File | null>>(
    {},
  );
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await getMyDriverDeliveries({ date: date || undefined }));
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Failed to load deliveries");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onComplete(stop: DriverDeliveryStop) {
    const photo = selectedFile[stop.orderId];
    if (!photo) {
      toast("Choose a proof of delivery photo first", "error");
      return;
    }
    setCompletingId(stop.orderId);
    try {
      await completeDriverDelivery(stop.orderId, photo);
      toast("Delivery marked as completed", "success");
      setSelectedFile((current) => ({ ...current, [stop.orderId]: null }));
      const input = fileRefs.current[stop.orderId];
      if (input) input.value = "";
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not complete delivery", "error");
    } finally {
      setCompletingId(null);
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
        const body = await res.json().catch(() => null);
        throw new Error(
          (body && typeof body === "object" && "error" in body
            ? String((body as { error: unknown }).error)
            : null) || `Unable to open proof (${res.status})`,
        );
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Unable to open proof", "error");
    }
  }

  const pending = result?.deliveries.filter((d) => !d.completed) ?? [];
  const done = result?.deliveries.filter((d) => d.completed) ?? [];

  return (
    <div>
      <PageHeader
        title="My deliveries"
        subtitle={`Stops for your vehicle in sequence (Dubai: ${dubai.date}). You can complete them in any order.`}
        actions={
          <SecondaryButton type="button" onClick={() => void load()}>
            Refresh
          </SecondaryButton>
        }
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44">
            <TextField
              label="Date"
              type="date"
              optional
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          {result?.driver ? (
            <p className="pb-2 text-sm text-slate-600">
              <strong>{result.driver.name}</strong>
              {result.driver.vehicleNumber
                ? ` · Vehicle ${result.driver.vehicleNumber}`
                : ""}
              {result.driver.phoneNo ? ` · ${result.driver.phoneNo}` : ""}
            </p>
          ) : null}
        </div>
      </Card>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : !result || result.deliveries.length === 0 ? (
        <EmptyState
          title="No deliveries scheduled"
          description="When warehouse assigns your vehicle on a load list (or SHMP dispatch), stops appear here."
        />
      ) : (
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold tracking-wide text-slate-700 uppercase">
              To deliver ({pending.length})
            </h2>
            {pending.length === 0 ? (
              <EmptyState title="All caught up for this day" />
            ) : (
              pending.map((stop) => (
                <DeliveryCard
                  key={stop.orderId}
                  stop={stop}
                  completing={completingId === stop.orderId}
                  file={selectedFile[stop.orderId] || null}
                  fileRef={(el) => {
                    fileRefs.current[stop.orderId] = el;
                  }}
                  onFileChange={(file) =>
                    setSelectedFile((current) => ({
                      ...current,
                      [stop.orderId]: file,
                    }))
                  }
                  onComplete={() => void onComplete(stop)}
                />
              ))
            )}
          </section>

          {done.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold tracking-wide text-slate-700 uppercase">
                Completed ({done.length})
              </h2>
              {done.map((stop) => (
                <Card key={stop.orderId} className="space-y-2">
                  <StopHeader stop={stop} />
                  <div className="flex flex-wrap gap-2">
                    {stop.proofOfDelivery?.hasFile ? (
                      <SecondaryButton
                        type="button"
                        onClick={() => void openPod(stop.orderId)}
                      >
                        View proof
                      </SecondaryButton>
                    ) : null}
                  </div>
                </Card>
              ))}
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function StopHeader({ stop }: { stop: DriverDeliveryStop }) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="rounded-md bg-[#f7f5f0] px-2 py-0.5 text-xs font-semibold text-slate-700">
          #{stop.sequence}
        </span>
        <p className="font-semibold text-slate-900">{stop.storeName}</p>
        {stop.invoiceNo ? (
          <span className="text-xs text-slate-500">{stop.invoiceNo}</span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-slate-600">{stop.address || "No address"}</p>
      <p className="mt-1 text-xs text-slate-500">
        {stop.cartons} carton{stop.cartons === 1 ? "" : "s"}
        {stop.vehicle ? ` · Vehicle ${stop.vehicle}` : ""}
        {stop.scheduledAt ? ` · ${fmtDubai(stop.scheduledAt)}` : ""}
        {stop.completedAt ? ` · Done ${fmtDubai(stop.completedAt)}` : ""}
      </p>
    </div>
  );
}

function DeliveryCard({
  stop,
  completing,
  file,
  fileRef,
  onFileChange,
  onComplete,
}: {
  stop: DriverDeliveryStop;
  completing: boolean;
  file: File | null;
  fileRef: (el: HTMLInputElement | null) => void;
  onFileChange: (file: File | null) => void;
  onComplete: () => void;
}) {
  const mapHref =
    stop.mapsUrl ||
    (stop.location
      ? `https://www.google.com/maps?q=${stop.location.lat},${stop.location.lng}`
      : null);

  return (
    <Card className="space-y-3">
      <StopHeader stop={stop} />
      <div className="flex flex-wrap gap-2">
        {mapHref ? (
          <a
            href={mapHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#f7f5f0]"
          >
            Open map
          </a>
        ) : null}
      </div>
      <div className="space-y-2 rounded-lg border border-dashed border-line bg-[#fbfaf7] p-3">
        <label className="block text-sm font-medium text-slate-800">
          Proof of delivery photo
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/*"
            capture="environment"
            className="mt-1.5 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-800"
            disabled={completing}
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />
        </label>
        {file ? (
          <p className="text-xs text-slate-500">Selected: {file.name}</p>
        ) : null}
        <PrimaryButton
          type="button"
          disabled={completing || !file}
          onClick={onComplete}
        >
          {completing ? "Uploading…" : "Mark completed"}
        </PrimaryButton>
      </div>
    </Card>
  );
}
