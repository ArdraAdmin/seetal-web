"use client";

import { FieldLabel, SecondaryButton, TextField } from "@/components/ui";
import type { Driver, VehicleDocument } from "@/lib/types";
import { VEHICLE_FILE_ACCEPT } from "@/lib/vehicle-records";

export type VehicleFormState = {
  number: string;
  driverId: string;
  purchaseYear: string;
  price: string;
  purchaseFrom: string;
  mulkyaExpiry: string;
  insurancePremium: string;
};

export const EMPTY_VEHICLE_FORM: VehicleFormState = {
  number: "",
  driverId: "",
  purchaseYear: "",
  price: "",
  purchaseFrom: "",
  mulkyaExpiry: "",
  insurancePremium: "",
};

export type DocumentRow = {
  key: string;
  name: string;
  file: File | null;
};

const fileInputClass =
  "block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-slate-200";

export function documentDrafts(rows: DocumentRow[]) {
  return rows.map((row) => ({
    name: row.name,
    file: row.file
      ? { name: row.file.name, type: row.file.type, size: row.file.size }
      : null,
  }));
}

export function documentUploads(rows: DocumentRow[]) {
  return rows.flatMap((row) =>
    row.name.trim() && row.file ? [{ name: row.name.trim(), file: row.file }] : [],
  );
}

export function newDocumentRow(): DocumentRow {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: "",
    file: null,
  };
}

function UploadField({
  label,
  required = false,
  optional = false,
  file,
  disabled,
  onChange,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  file: File | null;
  disabled?: boolean;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <FieldLabel label={label} required={required} optional={optional} />
      <input
        type="file"
        disabled={disabled}
        accept={VEHICLE_FILE_ACCEPT}
        onChange={(event) => {
          const selected = event.target.files?.[0];
          if (selected) onChange(selected);
        }}
        className={fileInputClass}
      />
      {file ? (
        <p className="text-xs text-slate-500">Selected: {file.name}</p>
      ) : (
        <p className="text-xs text-slate-500">PDF or image, up to 10 MB</p>
      )}
    </label>
  );
}

export function VehicleProfileFields({
  form,
  drivers,
  disabled,
  onChange,
}: {
  form: VehicleFormState;
  drivers: Driver[];
  disabled?: boolean;
  onChange: (form: VehicleFormState) => void;
}) {
  function set<K extends keyof VehicleFormState>(key: K, value: string) {
    onChange({ ...form, [key]: value });
  }

  return (
    <>
      <TextField
        label="Vehicle number"
        value={form.number}
        onChange={(event) => set("number", event.target.value)}
        required
        disabled={disabled}
        placeholder="e.g. 1234"
      />
      <label className="block space-y-1.5">
        <FieldLabel label="Driver" required />
        <select
          required
          disabled={disabled}
          value={form.driverId}
          onChange={(event) => set("driverId", event.target.value)}
          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-base text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand sm:text-sm"
        >
          <option value="">
            {drivers.length === 0 ? "No drivers yet" : "Select a driver"}
          </option>
          {drivers.map((driver) => (
            <option key={driver._id} value={driver._id}>
              {driver.name} · {driver.phoneNo}
            </option>
          ))}
        </select>
      </label>
      <TextField
        label="Purchase year"
        type="number"
        optional
        value={form.purchaseYear}
        onChange={(event) => set("purchaseYear", event.target.value)}
        disabled={disabled}
        placeholder="e.g. 2022"
      />
      <TextField
        label="Price"
        type="number"
        optional
        min="0"
        step="0.01"
        value={form.price}
        onChange={(event) => set("price", event.target.value)}
        disabled={disabled}
        placeholder="0.00"
      />
      <TextField
        label="Purchase from"
        optional
        value={form.purchaseFrom}
        onChange={(event) => set("purchaseFrom", event.target.value)}
        disabled={disabled}
        placeholder="Dealer or seller"
      />
      <TextField
        label="Mulkya expiry"
        type="date"
        required
        value={form.mulkyaExpiry}
        onChange={(event) => set("mulkyaExpiry", event.target.value)}
        disabled={disabled}
      />
      <TextField
        label="Insurance premium"
        type="number"
        required
        min="0"
        step="0.01"
        value={form.insurancePremium}
        onChange={(event) => set("insurancePremium", event.target.value)}
        disabled={disabled}
        placeholder="0.00"
      />
    </>
  );
}

export function VehicleDocumentFields({
  rows,
  saved = [],
  removed = [],
  disabled,
  onChangeRows,
  onRemoveSaved,
  onRestoreSaved,
  onDownload,
  onView,
}: {
  rows: DocumentRow[];
  saved?: VehicleDocument[];
  removed?: VehicleDocument[];
  disabled?: boolean;
  onChangeRows: (rows: DocumentRow[]) => void;
  onRemoveSaved?: (id: string) => void;
  onRestoreSaved?: (id: string) => void;
  onDownload?: (fileId: string, fileName: string) => void;
  onView?: (fileId: string, fileName: string) => void;
}) {
  function updateRow(key: string, patch: Partial<DocumentRow>) {
    onChangeRows(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  return (
    <div className="space-y-3 sm:col-span-2">
      <div>
        <FieldLabel label="Documents" optional />
        <p className="mt-1 text-xs text-slate-500">
          Add a document for each file. Name it, then choose the file. Leave this
          section empty if there is nothing to attach.
        </p>
      </div>

      {saved.map((document) => (
        <div
          key={document._id}
          className="flex flex-col gap-2 rounded-lg border border-line px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">{document.name}</p>
            <p className="truncate text-xs text-slate-500">{document.fileName}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SecondaryButton
              type="button"
              disabled={disabled}
              onClick={() => onView?.(document.fileId, document.fileName)}
            >
              View
            </SecondaryButton>
            <SecondaryButton
              type="button"
              disabled={disabled}
              onClick={() => onDownload?.(document.fileId, document.fileName)}
            >
              Download
            </SecondaryButton>
            <SecondaryButton
              type="button"
              disabled={disabled}
              onClick={() => onRemoveSaved?.(document._id)}
            >
              Remove
            </SecondaryButton>
          </div>
        </div>
      ))}

      {removed.map((document) => (
        <div
          key={document._id}
          className="flex flex-col gap-2 rounded-lg border border-dashed border-line px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-slate-500">
            {document.name} will be removed when you save.
          </p>
          <SecondaryButton
            type="button"
            disabled={disabled}
            onClick={() => onRestoreSaved?.(document._id)}
          >
            Undo
          </SecondaryButton>
        </div>
      ))}

      {rows.map((row) => (
        <div key={row.key} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <TextField
            label="Document name"
            required={Boolean(row.file)}
            optional={!row.file}
            value={row.name}
            disabled={disabled}
            maxLength={120}
            onChange={(event) => updateRow(row.key, { name: event.target.value })}
            placeholder="e.g. Mulkya copy"
          />
          <UploadField
            label="File"
            required={Boolean(row.name.trim())}
            optional={!row.name.trim()}
            file={row.file}
            disabled={disabled}
            onChange={(file) => updateRow(row.key, { file })}
          />
          <SecondaryButton
            type="button"
            disabled={disabled}
            onClick={() => onChangeRows(rows.filter((item) => item.key !== row.key))}
          >
            Remove
          </SecondaryButton>
        </div>
      ))}

      <SecondaryButton
        type="button"
        disabled={disabled}
        onClick={() => onChangeRows([...rows, newDocumentRow()])}
      >
        Add document
      </SecondaryButton>
    </div>
  );
}

export function InvoiceFileField({
  file,
  disabled,
  onChange,
}: {
  file: File | null;
  disabled?: boolean;
  onChange: (file: File | null) => void;
}) {
  return (
    <div className="sm:col-span-2">
      <UploadField
        label="Invoice"
        required
        file={file}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  );
}
