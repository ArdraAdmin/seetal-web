"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  addDriver,
  deleteDriver,
  downloadDriverFile,
  editDriver,
  getDrivers,
  previewDriverFile,
} from "@/lib/api";
import type { Driver, FleetPhoto, FleetScope } from "@/lib/types";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [editing, setEditing] = useState<Driver | null>(null);
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
      const data = await getDrivers(scope);
      setDrivers(Array.isArray(data) ? data : []);
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
    setName("");
    setPhone("");
    setPhotos([]);
    setRemovedPhotoIds([]);
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (editing ? !canUpdate : !canCreate) return;
    if (!name.trim() || !phone.trim()) return;
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
      if (editing) {
        await editDriver(
          editing._id,
          name.trim(),
          phone.trim(),
          scope,
          files,
          removedPhotoIds,
        );
        toast("Driver updated", "success");
      } else {
        await addDriver(name.trim(), phone.trim(), scope, files);
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
      await deleteDriver(id, scope);
      toast("Driver deleted", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Delete failed", "error");
    }
  }

  function startEdit(d: Driver) {
    setEditing(d);
    setName(d.name);
    setPhone(d.phoneNo);
    setPhotos([]);
    setRemovedPhotoIds([]);
  }

  function photoSummary(rows: FleetPhoto[] | undefined) {
    const count = rows?.length ?? 0;
    if (count === 1) return "1 photograph";
    if (count > 1) return `${count} photographs`;
    return null;
  }

  return (
    <div>
      <PageHeader
        title="Drivers"
        subtitle={
          scope === "shmp"
            ? "SHMP drivers only. These records are separate from STL."
            : "STL drivers only. These records are separate from SHMP."
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

      {canRead && (canCreate || (editing && canUpdate)) ? (
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
              setRemovedPhotoIds((current) => current.filter((item) => item !== photoId))
            }
            onDownload={(fileId, fileName) => void onDownload(fileId, fileName)}
            onView={(fileId, fileName) => void onView(fileId, fileName)}
          />
          <div className="flex items-end gap-2">
            <PrimaryButton type="submit" disabled={saving}>
              {editing ? "Update" : "Add driver"}
            </PrimaryButton>
            {editing ? (
              <SecondaryButton type="button" disabled={saving} onClick={resetForm}>
                Cancel
              </SecondaryButton>
            ) : null}
          </div>
        </form>
      </Card>
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
              ? "Add a driver above."
              : "This account can only open selected drivers, and none are assigned."
          }
        />
      ) : (
        <div className="space-y-3">
          {visibleDrivers.map((d) => {
            const photosLabel = photoSummary(d.photos);
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
