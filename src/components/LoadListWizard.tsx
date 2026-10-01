"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createLoadList,
  getAllWarehouseOrders,
  getDrivers,
  getVehicles,
} from "@/lib/api";
import type { Driver, PendingOrder, Vehicle } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PrimaryButton,
  SecondaryButton,
} from "@/components/ui";
import {
  assigneeLabel,
  invoiceLabel,
  storeMarks,
  storeTitle,
} from "@/lib/warehouse";

function checkLabel(order: PendingOrder) {
  if (order.loadCheck) return "Load check";
  if (order.doubleCheck) return "Double check";
  if (order.firstCheck) return "First check";
  return "Pending";
}

export function LoadListWizard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<0 | 1>(0);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [driverName, setDriverName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const loadMeta = useCallback(async () => {
    setMetaLoading(true);
    setMetaError(null);
    try {
      const [driverList, vehicleList] = await Promise.all([
        getDrivers(),
        getVehicles(),
      ]);
      setDrivers(driverList || []);
      setVehicles(vehicleList || []);
      if (driverList?.[0]?.name) setDriverName(driverList[0].name);
      if (vehicleList?.[0]?.value != null) {
        setVehicleNumber(String(vehicleList[0].value));
      }
    } catch (e) {
      setMetaError(
        e instanceof Error ? e.message : "Failed to load drivers/vehicles",
      );
    } finally {
      setMetaLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  const loadTodayOrders = useCallback(async () => {
    if (!user?.id) return;
    setOrdersLoading(true);
    setOrdersError(null);
    setSelected(new Set());
    try {
      const data = await getAllWarehouseOrders(user.id, 0, "", 80);
      setOrders(data.orders || []);
    } catch (e) {
      setOrdersError(
        e instanceof Error ? e.message : "Failed to load today’s orders",
      );
    } finally {
      setOrdersLoading(false);
    }
  }, [user?.id]);

  async function goToOrders() {
    if (!driverName || !vehicleNumber) {
      toast("Select driver and vehicle", "error");
      return;
    }
    setStep(1);
    await loadTodayOrders();
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(
      new Set(orders.map((o) => o._id).filter((id): id is string => Boolean(id))),
    );
  }

  async function exportList() {
    if (!user?.id) return;
    if (selected.size === 0) {
      toast("Select at least one order", "error");
      return;
    }
    setExporting(true);
    try {
      await createLoadList({
        userId: user.id,
        driverName,
        vehicleNumber,
        orderIds: Array.from(selected),
      });
      toast("Load list PDF emailed to noreply (Ardra in CC)", "success");
      setStep(0);
      setSelected(new Set());
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to export load list", "error");
    } finally {
      setExporting(false);
    }
  }

  if (metaLoading) {
    return <LoadingState label="Loading drivers and vehicles…" />;
  }
  if (metaError) {
    return <ErrorState message={metaError} onRetry={() => void loadMeta()} />;
  }

  if (step === 0) {
    return (
      <Card>
        <h2 className="text-lg font-semibold text-black">Create load list</h2>
        <p className="mt-1 text-sm text-slate-600">
          Select driver and vehicle, then choose today’s orders to include.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-black">
            Driver *
            <select
              className="mt-1.5 w-full rounded-xl border border-line bg-[#f7f5f0] px-3 py-2.5 text-sm"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
            >
              {drivers.length === 0 ? (
                <option value="">No drivers</option>
              ) : (
                drivers.map((d) => (
                  <option key={d._id} value={d.name}>
                    {d.name}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="block text-sm font-medium text-black">
            Vehicle *
            <select
              className="mt-1.5 w-full rounded-xl border border-line bg-[#f7f5f0] px-3 py-2.5 text-sm"
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value)}
            >
              {vehicles.length === 0 ? (
                <option value="">No vehicles</option>
              ) : (
                vehicles.map((v) => (
                  <option key={v._id} value={String(v.value)}>
                    {String(v.value)}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>
        <div className="mt-6">
          <PrimaryButton
            type="button"
            disabled={!driverName || !vehicleNumber}
            onClick={() => void goToOrders()}
          >
            Continue
          </PrimaryButton>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <Card className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-black">Today’s orders</h2>
            <p className="mt-1 text-sm text-slate-600">
              Driver: {driverName} · Vehicle: {vehicleNumber}
            </p>
          </div>
          <SecondaryButton type="button" onClick={() => setStep(0)}>
            Back
          </SecondaryButton>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <SecondaryButton
            type="button"
            disabled={ordersLoading || orders.length === 0}
            onClick={selectAll}
          >
            Select all
          </SecondaryButton>
          <SecondaryButton
            type="button"
            disabled={selected.size === 0}
            onClick={() => setSelected(new Set())}
          >
            Clear
          </SecondaryButton>
          <span className="text-sm text-slate-600">
            {selected.size} selected
          </span>
          <div className="ml-auto">
            <PrimaryButton
              type="button"
              disabled={exporting || selected.size === 0}
              onClick={() => void exportList()}
            >
              {exporting ? "Sending…" : "Export PDF & Email"}
            </PrimaryButton>
          </div>
        </div>
      </Card>

      {ordersLoading ? (
        <LoadingState label="Loading today’s orders…" />
      ) : ordersError ? (
        <ErrorState
          message={ordersError}
          onRetry={() => void loadTodayOrders()}
        />
      ) : orders.length === 0 ? (
        <EmptyState title="No orders for today" />
      ) : (
        <div className="space-y-3">
          {orders.map((order, index) => {
            const id = order._id || `order-${index}`;
            const checked = selected.has(id);
            return (
              <label
                key={id}
                className="flex cursor-pointer gap-3 rounded-xl border border-line bg-white p-4 hover:bg-[#f7f5f0]"
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-[#f59e0b]"
                  checked={checked}
                  onChange={() => toggle(id)}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-black">
                    {storeTitle(order) || "Store"}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {[
                      storeMarks(order) ? `Marks: ${storeMarks(order)}` : null,
                      checkLabel(order),
                      invoiceLabel(order),
                      `Assignee ${assigneeLabel(order)}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
