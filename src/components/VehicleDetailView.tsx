"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  addVehicleMaintenance,
  downloadVehicleFile,
  editVehicle,
  getDrivers,
  previewVehicleFile,
  getVehicleDetails,
  getVehicles,
} from "@/lib/api";
import type { Driver, FleetPhoto, FleetScope, Vehicle, VehicleDocument, VehicleExtras, VehicleMaintenance } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { fleetActionOn, fleetRecordOn, type FleetPortal } from "@/lib/custom-users";
import { useToast } from "@/components/Toast";
import { fmtDateOnly } from "@/components/StlFeatureUi";
import { salesMoney } from "@/lib/sales";
import { maintenanceFormError, vehicleFormError } from "@/lib/vehicle-records";
import { FilePreviewDialog } from "@/components/FilePreviewDialog";
import {
  photoDrafts,
  PhotoFields,
  selectedPhotoFiles,
  type PhotoDraft,
} from "@/components/PhotoFields";
import {
  documentDrafts,
  documentUploads,
  InvoiceFileField,
  VehicleDocumentFields,
  VehicleProfileFields,
  type DocumentRow,
  type VehicleFormState,
} from "@/components/VehicleFormFields";
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

type FormState = VehicleFormState;

const EMPTY_FORM: FormState = {
  number: "",
  driverId: "",
  purchaseYear: "",
  price: "",
  purchaseFrom: "",
  mulkyaExpiry: "",
  insurancePremium: "",
};

function asForm(vehicle: Vehicle, extras: VehicleExtras): FormState {
  return {
    number: vehicle.value == null ? "" : String(vehicle.value),
    driverId: vehicle.driverId || "",
    purchaseYear:
      extras.purchaseYear == null ? "" : String(extras.purchaseYear),
    price: extras.price == null ? "" : String(extras.price),
    purchaseFrom: extras.purchaseFrom ?? "",
    mulkyaExpiry: extras.mulkyaExpiry
      ? String(extras.mulkyaExpiry).slice(0, 10)
      : "",
    insurancePremium:
      extras.insurancePremium == null ? "" : String(extras.insurancePremium),
  };
}

export function VehicleDetailView({
  listHref,
  scope,
}: {
  listHref: string;
  scope: FleetScope;
}) {
  const params = useParams<{ id: string }>();
  const id = String(params?.id || "");
  const { toast } = useToast();
  const { user } = useAuth();
  const portal: FleetPortal = scope === "shmp" ? "shmp" : "selling";
  const canRead = fleetActionOn(user?.customAccess, portal, "read");
  const canUpdate = fleetActionOn(user?.customAccess, portal, "update");
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [maintenance, setMaintenance] = useState<VehicleMaintenance[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [savedDocuments, setSavedDocuments] = useState<VehicleDocument[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [newDocuments, setNewDocuments] = useState<DocumentRow[]>([]);
  const [savedPhotos, setSavedPhotos] = useState<FleetPhoto[]>([]);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);
  const [newPhotos, setNewPhotos] = useState<PhotoDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [invoice, setInvoice] = useState<File | null>(null);
  const [preview, setPreview] = useState<{
    url: string;
    name: string;
    type: string;
  } | null>(null);
  const [openingFile, setOpeningFile] = useState(false);
  const previewRef = useRef(preview);
  previewRef.current = preview;

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [list, details, driverList] = await Promise.all([
        getVehicles(scope),
        getVehicleDetails(id, scope),
        getDrivers(scope),
      ]);
      const found = (Array.isArray(list) ? list : []).find((v) => v._id === id);
      setDrivers(Array.isArray(driverList) ? driverList : []);
      if (!found || !fleetRecordOn(user?.customAccess, portal, "vehicles", found._id)) {
        setVehicle(null);
        setError(found ? "You do not have access to this vehicle." : "Vehicle not found");
        return;
      }
      setVehicle(found);
      setForm(asForm(found, details.extras || {}));
      setSavedDocuments(details.extras?.documents ?? []);
      setRemovedIds([]);
      setNewDocuments([]);
      setSavedPhotos(details.extras?.photos ?? found.photos ?? []);
      setRemovedPhotoIds([]);
      setNewPhotos([]);
      setMaintenance(details.maintenance || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load vehicle");
    } finally {
      setLoading(false);
    }
  }, [id, portal, scope, user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current.url);
    };
  }, []);

  const visibleDocuments = savedDocuments.filter(
    (document) => !removedIds.includes(document._id),
  );
  const removedDocuments = savedDocuments.filter((document) =>
    removedIds.includes(document._id),
  );
  const visiblePhotos = savedPhotos.filter(
    (photo) => !removedPhotoIds.includes(photo._id),
  );
  const removedPhotos = savedPhotos.filter((photo) =>
    removedPhotoIds.includes(photo._id),
  );

  async function onDownload(fileId: string, fileName: string) {
    try {
      await downloadVehicleFile(fileId, fileName);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Download failed", "error");
    }
  }

  function closePreview() {
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  }

  async function onView(fileId: string, fileName: string) {
    setOpeningFile(true);
    try {
      const next = await previewVehicleFile(fileId, fileName);
      setPreview((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return next;
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Unable to open document", "error");
    } finally {
      setOpeningFile(false);
    }
  }

  const assignableDrivers = drivers.filter(
    (driver) =>
      fleetRecordOn(user?.customAccess, portal, "drivers", driver._id) ||
      driver._id === form.driverId,
  );

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!vehicle || !canUpdate) return;
    const problem = vehicleFormError({
      vehicleNumber: form.number,
      driverId: form.driverId,
      purchaseYear: form.purchaseYear,
      price: form.price,
      purchaseFrom: form.purchaseFrom,
      mulkyaExpiry: form.mulkyaExpiry,
      insurancePremium: form.insurancePremium,
      documents: documentDrafts(newDocuments),
      savedDocumentCount: visibleDocuments.length,
      photos: photoDrafts(newPhotos),
      savedPhotoCount: visiblePhotos.length,
    });
    if (problem) {
      toast(problem, "error");
      return;
    }
    setSaving(true);
    try {
      await editVehicle(vehicle._id, {
        vehicleNumber: form.number,
        driverId: form.driverId,
        scope,
        purchaseYear: form.purchaseYear,
        price: form.price,
        purchaseFrom: form.purchaseFrom,
        mulkyaExpiry: form.mulkyaExpiry,
        insurancePremium: form.insurancePremium,
        documents: documentUploads(newDocuments),
        removeDocumentIds: removedIds,
        photos: selectedPhotoFiles(newPhotos),
        removePhotoIds: removedPhotoIds,
      });
      toast("Vehicle updated", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function onAddMaintenance(e: FormEvent) {
    e.preventDefault();
    if (!vehicle || !canUpdate) return;
    const problem = maintenanceFormError({
      title,
      amount,
      description,
      date,
      invoice: invoice
        ? { name: invoice.name, type: invoice.type, size: invoice.size }
        : null,
    });
    if (problem) {
      toast(problem, "error");
      return;
    }
    if (!invoice) return;
    setAdding(true);
    try {
      await addVehicleMaintenance(vehicle._id, {
        title: title.trim(),
        amount,
        description: description.trim(),
        date,
        invoice,
        scope,
      });
      toast("Maintenance added", "success");
      setTitle("");
      setAmount("");
      setDescription("");
      setDate("");
      setInvoice(null);
      setShowAdd(false);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Add failed", "error");
    } finally {
      setAdding(false);
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Vehicle" subtitle="Loading vehicle details…" />
        <LoadingState />
      </div>
    );
  }

  if (!canRead) {
    return (
      <div>
        <PageHeader
          title="Vehicle"
          actions={
            <Link
              href={listHref}
              className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#f7f5f0]"
            >
              Back to vehicles
            </Link>
          }
        />
        <ErrorState message="You do not have access to vehicles." />
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div>
        <PageHeader
          title="Vehicle"
          actions={
            <Link
              href={listHref}
              className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#f7f5f0]"
            >
              Back to vehicles
            </Link>
          }
        />
        <ErrorState
          message={error || "Vehicle not found"}
          onRetry={() => void load()}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Vehicle #${vehicle.value}`}
        subtitle={
          vehicle.driverName
            ? `Driver: ${vehicle.driverName}. Update the assignment, purchase details, documents, photographs, and maintenance here.`
            : "Choose a driver, then update purchase details, documents, photographs, and maintenance."
        }
        actions={
          <Link
            href={listHref}
            className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#f7f5f0]"
          >
            Back to vehicles
          </Link>
        }
      />

      <Card className="mb-6">
        <form onSubmit={onSave} className="grid gap-3 sm:grid-cols-2">
          <VehicleProfileFields
            form={form}
            drivers={assignableDrivers}
            disabled={saving || !canUpdate}
            onChange={setForm}
          />
          <VehicleDocumentFields
            rows={newDocuments}
            saved={visibleDocuments}
            removed={removedDocuments}
            disabled={saving || openingFile || !canUpdate}
            onChangeRows={setNewDocuments}
            onRemoveSaved={(documentId) =>
              setRemovedIds((current) =>
                current.includes(documentId) ? current : [...current, documentId],
              )
            }
            onRestoreSaved={(documentId) =>
              setRemovedIds((current) => current.filter((item) => item !== documentId))
            }
            onDownload={(fileId, fileName) => void onDownload(fileId, fileName)}
            onView={(fileId, fileName) => void onView(fileId, fileName)}
          />
          <PhotoFields
            files={newPhotos}
            saved={visiblePhotos}
            removed={removedPhotos}
            disabled={saving || openingFile || !canUpdate}
            onChangeFiles={setNewPhotos}
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
          {canUpdate ? (
          <div>
            <PrimaryButton type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save vehicle"}
            </PrimaryButton>
          </div>
          ) : null}
        </form>
      </Card>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink">Maintenance</h2>
          <p className="text-sm text-slate-500">
            Records attached to this vehicle only. An invoice file is required.
          </p>
        </div>
        {canUpdate ? (
        <PrimaryButton
          type="button"
          onClick={() => {
            setShowAdd((open) => {
              if (open) setInvoice(null);
              return !open;
            });
          }}
        >
          {showAdd ? "Cancel" : "Add maintenance"}
        </PrimaryButton>
        ) : null}
      </div>

      {showAdd ? (
        <Card className="mb-5">
          <form onSubmit={onAddMaintenance} className="grid gap-3 sm:grid-cols-2">
            <TextField
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. Oil change"
            />
            <TextField
              label="Amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="0.00"
            />
            <TextField
              label="Date of maintenance"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            <label className="block space-y-1.5 sm:col-span-2">
              <FieldLabel label="Description" optional />
              <textarea
                className="min-h-24 w-full rounded-lg border border-line bg-white px-3 py-2 text-base text-ink outline-none placeholder:text-slate-400 focus:border-brand focus:ring-1 focus:ring-brand sm:text-sm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What was done"
                disabled={adding}
              />
            </label>
            <InvoiceFileField file={invoice} disabled={adding} onChange={setInvoice} />
            <div>
              <PrimaryButton type="submit" disabled={adding}>
                {adding ? "Adding…" : "Save maintenance"}
              </PrimaryButton>
            </div>
          </form>
        </Card>
      ) : null}

      {maintenance.length === 0 ? (
        <EmptyState
          title="No maintenance yet"
          description="Use Add maintenance to attach the first record."
        />
      ) : (
        <div className="space-y-3">
          {maintenance.map((item) => (
            <Card key={item._id}>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{item.title}</p>
                  {item.description ? (
                    <p className="mt-1 text-sm text-slate-600">
                      {item.description}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-sm text-slate-500 sm:text-right">
                  <p className="font-medium text-ink">
                    {salesMoney(Number(item.amount) || 0)}
                  </p>
                  <p>{fmtDateOnly(item.date)}</p>
                  {item.invoiceFileId ? (
                    <p className="mt-1 flex flex-wrap justify-end gap-x-3">
                      <button
                        type="button"
                        className="text-sm font-medium text-brand-dark underline"
                        onClick={() =>
                          void onView(
                            item.invoiceFileId || "",
                            item.invoiceFileName || "invoice",
                          )
                        }
                      >
                        View invoice
                      </button>
                      <button
                        type="button"
                        className="text-sm font-medium text-brand-dark underline"
                        onClick={() =>
                          void onDownload(
                            item.invoiceFileId || "",
                            item.invoiceFileName || "invoice",
                          )
                        }
                      >
                        Download invoice
                      </button>
                    </p>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {preview ? (
        <FilePreviewDialog preview={preview} onClose={closePreview} />
      ) : null}
    </div>
  );
}
