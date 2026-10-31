"use client";

import { useState, type ChangeEvent } from "react";
import { FieldLabel, TextField } from "@/components/ui";
import type { HrProfileFormState } from "@/lib/hr-profile";
import type { HrFileRef } from "@/lib/stl-features-api";

function FileField({
  label,
  required = false,
  optional = false,
  value,
  disabled,
  onUpload,
  onChange,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  value: HrFileRef | null;
  disabled?: boolean;
  onUpload: (file: File) => Promise<HrFileRef>;
  onChange: (file: HrFileRef | null) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  return (
    <div className="space-y-1.5">
      <FieldLabel label={label} required={required} optional={optional} />
      {value ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {value.url ? (
            <a
              href={value.url}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-brand-dark underline"
            >
              {value.fileName}
            </a>
          ) : (
            <span className="font-medium text-ink">{value.fileName}</span>
          )}
          <button
            type="button"
            className="text-xs text-slate-500 underline"
            disabled={disabled || uploading}
            onClick={() => onChange(null)}
          >
            Remove
          </button>
        </div>
      ) : null}
      <input
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
        disabled={disabled || uploading}
        className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium"
        onChange={(event) => {
          const selected = event.target.files?.[0];
          event.target.value = "";
          if (!selected) return;
          setUploading(true);
          setError(null);
          void onUpload(selected)
            .then((saved) => onChange(saved))
            .catch((err: unknown) => {
              setError(err instanceof Error ? err.message : "Upload failed");
            })
            .finally(() => setUploading(false));
        }}
      />
      {uploading ? <p className="text-xs text-slate-500">Uploading…</p> : null}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}

export function HrProfileFields({
  form,
  onChange,
  disabled,
  onUpload,
  showCompany = false,
}: {
  form: HrProfileFormState;
  onChange: (form: HrProfileFormState) => void;
  disabled?: boolean;
  onUpload: (file: File) => Promise<HrFileRef>;
  showCompany?: boolean;
}) {
  function set<K extends keyof HrProfileFormState>(key: K, value: HrProfileFormState[K]) {
    onChange({ ...form, [key]: value });
  }

  function text(key: keyof HrProfileFormState) {
    return (event: ChangeEvent<HTMLInputElement>) => set(key, event.target.value);
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2">
        <TextField label="Name as per visa" required value={form.visaName} disabled={disabled} onChange={text("visaName")} />
        <TextField label="Designation as per visa" required value={form.visaDesignation} disabled={disabled} onChange={text("visaDesignation")} />
        <TextField label="Basic salary (AED)" type="number" min={0} step="0.01" optional value={form.basicSalary} disabled={disabled} onChange={text("basicSalary")} />
        <div>
          <TextField label="Total salary (AED)" type="number" min={0} step="0.01" optional value={form.totalSalary} disabled={disabled} onChange={text("totalSalary")} />
          <p className="mt-1 text-xs text-slate-500">Entered for now. This amount will be calculated later.</p>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-ink">Passport</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Passport number" required value={form.passportNumber} disabled={disabled} onChange={text("passportNumber")} />
          <TextField label="Passport expiry" type="date" required value={form.passportExpiry} disabled={disabled} onChange={text("passportExpiry")} />
          <FileField label="Passport copy" required value={form.passportCopy} disabled={disabled} onUpload={onUpload} onChange={(file) => set("passportCopy", file)} />
          <FileField label="Passport-size photo" optional value={form.photo} disabled={disabled} onUpload={onUpload} onChange={(file) => set("photo", file)} />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-ink">Emirates ID</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="EID number" required value={form.eidNumber} disabled={disabled} onChange={text("eidNumber")} />
          <TextField label="EID expiry" type="date" required value={form.eidExpiry} disabled={disabled} onChange={text("eidExpiry")} />
          <FileField label="EID copy" required value={form.eidCopy} disabled={disabled} onUpload={onUpload} onChange={(file) => set("eidCopy", file)} />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-ink">Visa</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Visa number" optional value={form.visaNumber} disabled={disabled} onChange={text("visaNumber")} />
          <TextField label="Visa expiry" type="date" optional value={form.visaExpiry} disabled={disabled} onChange={text("visaExpiry")} />
          <TextField label="Visa application year" type="number" optional value={form.visaApplicationYear} disabled={disabled} onChange={text("visaApplicationYear")} />
          <TextField label="Visa cost (AED)" type="number" min={0} step="0.01" optional value={form.visaCost} disabled={disabled} onChange={text("visaCost")} />
          <TextField label="Visa details" optional value={form.visaDetails} disabled={disabled} onChange={text("visaDetails")} />
          <FileField label="Visa copy" required value={form.visaCopy} disabled={disabled} onUpload={onUpload} onChange={(file) => set("visaCopy", file)} />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-ink">Insurance and contract</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Insurance expiry" type="date" required value={form.insuranceExpiry} disabled={disabled} onChange={text("insuranceExpiry")} />
          <FileField label="Insurance copy" required value={form.insuranceCopy} disabled={disabled} onUpload={onUpload} onChange={(file) => set("insuranceCopy", file)} />
          <FileField label="Employment contract copy" required value={form.employmentContractCopy} disabled={disabled} onUpload={onUpload} onChange={(file) => set("employmentContractCopy", file)} />
          <div className="text-sm text-slate-600">
            <p className="font-medium text-ink">Contract expiry</p>
            <p className="mt-1">Same as the EID expiry{form.eidExpiry ? `: ${form.eidExpiry}` : ""}.</p>
          </div>
          <FileField label="Offer letter" optional value={form.offerLetter} disabled={disabled} onUpload={onUpload} onChange={(file) => set("offerLetter", file)} />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-ink">Sharjah permit</h3>
        <p className="text-xs text-slate-500">Optional. If an expiry date is set, the dashboard warns 15 days before it.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Sharjah permit expiry" type="date" optional value={form.sharjahPermitExpiry} disabled={disabled} onChange={text("sharjahPermitExpiry")} />
          <FileField label="Sharjah permit" optional value={form.sharjahPermitCopy} disabled={disabled} onUpload={onUpload} onChange={(file) => set("sharjahPermitCopy", file)} />
        </div>
      </section>

      {showCompany ? (
        <section className="grid gap-3 sm:grid-cols-2">
          <TextField label="Company" optional value={form.company} disabled={disabled} onChange={text("company")} />
        </section>
      ) : null}
    </div>
  );
}
