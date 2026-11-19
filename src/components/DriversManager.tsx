"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  addDriver,
  assignVehicleDriver,
  deleteDriver,
  downloadDriverFile,
  editDriver,
  getDrivers,
  getVehicles,
  previewDriverFile,
  removeDriverLogin,
  saveDriverLogin,
} from "@/lib/api";
import type { Driver, FleetPhoto, FleetScope, Vehicle } from "@/lib/types";
import {
  driverVehicleFormError,
  resolveCreatedDriverId,
  vehicleLinkedToDriver,
  vehicleNumberLabel,
  vehiclesForDriverSelect,
} from "@/lib/driver-vehicles";
import { photosFormError } from "@/lib/vehicle-records";
import { FilePreviewDialog } from "@/components/FilePreviewDialog";
import {
  photoDrafts,
  PhotoFields,
  selectedPhotoFiles,
  type PhotoDraft,
} from "@/components/PhotoFields";
import { useAuth } from "@/components/AuthProvider";
import { fleetActionOn, fleetRecordOn, type FleetPortal } from "@/lib/custom-users";
import { useToast } from "@/components/Toast";
import {
  Card,
  EmptyState,
  ErrorState,
  FieldLabel,
  LoadingState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from "@/components/ui";

export function DriversManager({
  vehiclesHref,
  scope,
}: {
  vehiclesHref: string;
  scope: FleetScope;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const portal: FleetPortal = scope === "shmp" ? "shmp" : "selling";
  const canRead = fleetActionOn(user?.customAccess, portal, "read");
  const canCreate = fleetActionOn(user?.customAccess, portal, "create");
  const canUpdate = fleetActionOn(user?.customAccess, portal, "update");
  const canDelete = fleetActionOn(user?.customAccess, portal, "delete");
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [editing, setEditing] = useState<Driver | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [openingFile, setOpeningFile] = useState(false);
  const [preview, setPreview] = useState<{
    url: string;
    name: string;
    type: string;
  } | null>(null);
  const previewRef = useRef(preview);
  previewRef.current = preview;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [driverList, vehicleList] = await Promise.all([
        getDrivers(scope),
        getVehicles(scope),
      ]);
      setDrivers(Array.isArray(driverList) ? driverList : []);
      setVehicles(Array.isArray(vehicleList) ? vehicleList : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load drivers");
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current.url);
    };
  }, []);

  const savedPhotos = editing?.photos ?? [];
  const visiblePhotos = savedPhotos.filter(
    (photo) => !removedPhotoIds.includes(photo._id),
  );
  const removedPhotos = savedPhotos.filter((photo) =>
    removedPhotoIds.includes(photo._id),
  );

  function resetForm() {
    setEditing(null);
    setShowForm(false);
    setName("");
    setPhone("");
    setVehicleId("");
    setLoginEmail("");
    setLoginPassword("");
    setPhotos([]);
    setRemovedPhotoIds([]);
  }

  async function syncDriverLogin(driverId: string, existing?: Driver | null) {
    const email = loginEmail.trim();
    const password = loginPassword;
    if (!email && !password) return;
    if (!email) {
      throw new Error("Enter a login email for the driver account");
    }
    if (!existing?.hasLogin && !password) {
      throw new Error("Enter a password to create the driver login");
    }
    await saveDriverLogin(driverId, email, password, scope);
  }

  function closePreview() {
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  }

  async function onDownload(fileId: string, fileName: string) {
    try {
      await downloadDriverFile(fileId, fileName);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Download failed", "error");
    }
  }

  async function onView(fileId: string, fileName: string) {
    setOpeningFile(true);
    try {
      const next = await previewDriverFile(fileId, fileName);
      setPreview((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return next;
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Unable to open photograph", "error");
    } finally {
      setOpeningFile(false);
    }
  }

  const visibleDrivers = drivers.filter((driver) =>
    fleetRecordOn(user?.customAccess, portal, "drivers", driver._id),
  );

  const selectableVehicles = vehiclesForDriverSelect(
    vehicles.filter(
      (vehicle) =>
        fleetRecordOn(user?.customAccess, portal, "vehicles", vehicle._id) ||
        vehicle._id === vehicleId,
    ),
    editing?._id,
  );

  async function linkDriverToVehicle(
    driverId: string,
    nextVehicleId: string,
    previousVehicleId: string | null,
  ) {
    const nextVehicle = vehicles.find((vehicle) => vehicle._id === nextVehicleId);
    if (!nextVehicle) {
      throw new Error("Selected vehicle was not found");
    }
    if (previousVehicleId && previousVehicleId !== nextVehicleId) {
      const previous = vehicles.find((vehicle) => vehicle._id === previousVehicleId);
      if (previous) {
        await assignVehicleDriver(previous, "", scope);
      }
    }
    if (String(nextVehicle.driverId || "") !== driverId) {
      await assignVehicleDriver(nextVehicle, driverId, scope);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (editing ? !canUpdate : !canCreate) return;
    const formProblem = driverVehicleFormError({ name, phone, vehicleId });
    if (formProblem) {
      toast(formProblem, "error");
      return;
    }
    const problem = photosFormError(
      photoDrafts(photos),
      visiblePhotos.length,
      "driver",
    );
    if (problem) {
      toast(problem, "error");
      return;
    }
    setSaving(true);
    try {
      const files = selectedPhotoFiles(photos);
      const selectedVehicleId = vehicleId.trim();
      if (editing) {
        const previous = vehicleLinkedToDriver(vehicles, editing._id);
        await editDriver(
          editing._id,
          name.trim(),
          phone.trim(),
          scope,
          files,
          removedPhotoIds,
        );
        try {
          await linkDriverToVehicle(
            editing._id,
            selectedVehicleId,
            previous?._id ?? null,
          );
        } catch (linkErr) {
          toast(
            linkErr instanceof Error
              ? `Driver updated, but vehicle link failed: ${linkErr.message}`
              : "Driver updated, but vehicle link failed",
            "error",
          );
          await load();
          return;
        }
        try {
          await syncDriverLogin(editing._id, editing);
        } catch (loginErr) {
          toast(
            loginErr instanceof Error
              ? `Driver updated, but login failed: ${loginErr.message}`
              : "Driver updated, but login failed",
            "error",
          );
          await load();
          return;
        }
        toast("Driver updated", "success");
      } else {
        const created = await addDriver(name.trim(), phone.trim(), scope, files);
        const refreshed = await getDrivers(scope);
        const driverId = resolveCreatedDriverId(
          created,
          Array.isArray(refreshed) ? refreshed : [],
          name.trim(),
          phone.trim(),
        );
        if (!driverId) {
          toast(
            "Driver added, but the new driver id could not be resolved to link a vehicle",
            "error",
          );
          resetForm();
          await load();
          return;
        }
        try {
          await linkDriverToVehicle(driverId, selectedVehicleId, null);
        } catch (linkErr) {
          toast(
            linkErr instanceof Error
              ? `Driver added, but vehicle link failed: ${linkErr.message}`
              : "Driver added, but vehicle link failed",
            "error",
          );
          resetForm();
          await load();
          return;
        }
        try {
          await syncDriverLogin(driverId, null);
        } catch (loginErr) {
          toast(
            loginErr instanceof Error
              ? `Driver added, but login failed: ${loginErr.message}`
              : "Driver added, but login failed",
            "error",
          );
          resetForm();
          await load();
          return;
        }
        toast("Driver added", "success");
      }
      resetForm();
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!canDelete) return;
    if (!confirm("Delete this driver?")) return;
    try {
      const linked = vehicleLinkedToDriver(vehicles, id);
      await deleteDriver(id, scope);
      if (linked) {
        try {
          await assignVehicleDriver(linked, "", scope);
        } catch {
          // Driver is already deleted; vehicle can be reassigned from Vehicles.
        }
      }
      toast("Driver deleted", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Delete failed", "error");
    }
  }

  function startEdit(d: Driver) {
    const linked = vehicleLinkedToDriver(vehicles, d._id);
    setEditing(d);
    setShowForm(true);
    setName(d.name);
    setPhone(d.phoneNo);
    setVehicleId(linked?._id ?? "");
    setLoginEmail(d.loginEmail || "");
    setLoginPassword("");
    setPhotos([]);
    setRemovedPhotoIds([]);
  }

  async function onRemoveLogin(d: Driver) {
    if (!canUpdate) return;
    if (!d.hasLogin) return;
    if (!confirm(`Remove login access for ${d.name}?`)) return;
    try {
      await removeDriverLogin(d._id, scope);
      toast("Driver login removed", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not remove login", "error");
    }
  }

  function photoSummary(rows: FleetPhoto[] | undefined) {
    const count = rows?.length ?? 0;
    if (count === 1) return "1 photograph";
    if (count > 1) return `${count} photographs`;
    return null;
  }

  const formOpen =
    canRead && ((showForm && canCreate && !editing) || (editing && canUpdate));

  return (
    <div>
      <PageHeader
        title="Drivers"
        subtitle={
          scope === "shmp"
            ? "SHMP drivers only. Each driver needs an unassigned SHMP vehicle."
            : "STL drivers only. Each driver needs an unassigned STL vehicle."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={vehiclesHref}
              className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#f7f5f0]"
            >
              Vehicles
            </Link>
            <SecondaryButton type="button" onClick={() => void load()}>
              Refresh
            </SecondaryButton>
          </div>
        }
      />

      {!canRead ? (
        <ErrorState message="You do not have access to drivers." />
      ) : null}

      {formOpen ? (
        <Card className="mb-5">
          <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
            <TextField
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={saving}
              placeholder="Driver name"
            />
            <TextField
              label="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              disabled={saving}
              placeholder="Phone number"
            />
            <label className="block space-y-1.5">
              <FieldLabel label="Vehicle" required />
              <select
                required
                disabled={saving}
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-base text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand sm:text-sm"
              >
                <option value="">
                  {selectableVehicles.length === 0
                    ? "No unassigned vehicles"
                    : "Select a vehicle"}
                </option>
                {selectableVehicles.map((vehicle) => (
                  <option key={vehicle._id} value={vehicle._id}>
                    {vehicleNumberLabel(vehicle)}
                  </option>
                ))}
              </select>
            </label>
            <PhotoFields
              files={photos}
              saved={visiblePhotos}
              removed={removedPhotos}
              disabled={saving || openingFile}
              onChangeFiles={setPhotos}
              onRemoveSaved={(photoId) =>
                setRemovedPhotoIds((current) =>
                  current.includes(photoId) ? current : [...current, photoId],
                )
              }
              onRestoreSaved={(photoId) =>
                setRemovedPhotoIds((current) =>
                  current.filter((item) => item !== photoId),
                )
              }
              onDownload={(fileId, fileName) => void onDownload(fileId, fileName)}
              onView={(fileId, fileName) => void onView(fileId, fileName)}
            />
            <div className="sm:col-span-2 rounded-lg border border-line bg-[#fbfaf7] p-3">
              <p className="mb-2 text-sm font-medium text-slate-800">
                Driver login
              </p>
              <p className="mb-3 text-xs text-slate-500">
                Optional. Creates a separate Driver account so they can open
                deliveries on web and mobile.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  label="Login email"
                  type="email"
                  optional
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  disabled={saving}
                  placeholder="driver@example.com"
                />
                <TextField
                  label={editing?.hasLogin ? "New password" : "Password"}
                  type="password"
                  optional
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  disabled={saving}
                  placeholder={
                    editing?.hasLogin
                      ? "Leave blank to keep current"
                      : "Set a password"
                  }
                />
              </div>
              {editing?.hasLogin ? (
                <div className="mt-3">
                  <SecondaryButton
                    type="button"
                    disabled={saving}
                    className="border-red-200 text-red-700"
                    onClick={() => void onRemoveLogin(editing)}
                  >
                    Remove login
                  </SecondaryButton>
                </div>
              ) : null}
            </div>
            <div className="flex items-end gap-2">
              <PrimaryButton type="submit" disabled={saving}>
                {saving
                  ? editing
                    ? "Updating…"
                    : "Adding…"
                  : editing
                    ? "Update"
                    : "Save driver"}
              </PrimaryButton>
              <SecondaryButton type="button" disabled={saving} onClick={resetForm}>
                Cancel
              </SecondaryButton>
            </div>
          </form>
        </Card>
      ) : canRead && canCreate ? (
        <div className="mb-5">
          <PrimaryButton type="button" onClick={() => setShowForm(true)}>
            Add driver
          </PrimaryButton>
        </div>
      ) : null}

      {!canRead ? null : loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : visibleDrivers.length === 0 ? (
        <EmptyState
          title={drivers.length === 0 ? "No drivers yet" : "No drivers assigned"}
          description={
            drivers.length === 0
              ? "Use Add driver to create one and link a vehicle."
              : "This account can only open selected drivers, and none are assigned."
          }
        />
      ) : (
        <div className="space-y-3">
          {visibleDrivers.map((d) => {
            const photosLabel = photoSummary(d.photos);
            const linked = vehicleLinkedToDriver(vehicles, d._id);
            return (
              <Card
                key={d._id}
                className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{d.name}</p>
                  <p className="text-sm text-slate-500">
                    {d.phoneNo}
                    {photosLabel ? ` · ${photosLabel}` : ""}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {linked
                      ? `Vehicle: ${vehicleNumberLabel(linked)}`
                      : "No vehicle linked"}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {d.hasLogin
                      ? `Login: ${d.loginEmail || "enabled"}`
                      : "No driver login"}
                  </p>
                </div>
                <div className="flex gap-2">
                  {canUpdate ? (
                    <SecondaryButton type="button" onClick={() => startEdit(d)}>
                      Edit
                    </SecondaryButton>
                  ) : null}
                  {canDelete ? (
                    <SecondaryButton
                      type="button"
                      className="border-red-200 text-red-700"
                      onClick={() => void onDelete(d._id)}
                    >
                      Delete
                    </SecondaryButton>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {preview ? (
        <FilePreviewDialog preview={preview} onClose={closePreview} />
      ) : null}
    </div>
  );
}
