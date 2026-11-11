"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { SelectField } from "@/components/StlFeatureUi";
import { useAuth } from "@/components/AuthProvider";
import { FieldLabel, TextField } from "@/components/ui";
import { companyLabel, getCompanies, type CompanyRecord } from "@/lib/api";
import { filterCompaniesForModule } from "@/lib/custom-users";
import { formatHrDate, stlTotalSalary, type HrProfileFormState, type HrSalaryScope } from "@/lib/hr-profile";
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

function CompanyField({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getCompanies()
      .then((rows) => {
        if (!cancelled) setCompanies(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setCompanies([]);
          setError(err instanceof Error ? err.message : "Could not load companies");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const options = useMemo(
    () => filterCompaniesForModule(companies, user?.customAccess, "hr"),
    [companies, user?.customAccess],
  );
  const known = options.some((company) => company._id === value);
  const matched = useMemo(() => {
    if (!value || known) return null;
    const needle = value.trim().toLowerCase();
    return (
      options.find((company) =>
        [company.name, company.prefix, companyLabel(company)].some(
          (part) => part?.trim().toLowerCase() === needle,
        ),
      ) ?? null
    );
  }, [known, options, value]);

  useEffect(() => {
    if (matched && matched._id !== value) onChange(matched._id);
  }, [matched, onChange, value]);

  const selected = known ? value : matched?._id || value;
  const showCurrent = Boolean(value) && !known && !matched && !loading;

  return (
    <div>
      <SelectField
        label="Company"
        required
        disabled={disabled || loading}
        value={selected}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{loading ? "Loading companies…" : "Select company"}</option>
        {showCurrent ? <option value={value}>{value}</option> : null}
        {options.map((company) => (
          <option key={company._id} value={company._id}>
            {companyLabel(company)}
          </option>
        ))}
      </SelectField>
      {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : null}
      {!loading && !error && options.length === 0 ? (
        <p className="mt-1 text-xs text-slate-500">No companies are available for this account.</p>
      ) : null}
    </div>
  );
}

export type HrFieldVisibility = {
  salary?: boolean;
  passport?: boolean;
  eid?: boolean;
  visa?: boolean;
  insurance?: boolean;
};

export function HrProfileFields({
  form,
  onChange,
  disabled,
  onUpload,
  showCompany = false,
  scope,
  shown,
  detail,
  showProductionWorker = false,
}: {
  form: HrProfileFormState;
  onChange: (form: HrProfileFormState) => void;
  disabled?: boolean;
  onUpload: (file: File) => Promise<HrFileRef>;
  showCompany?: boolean;
  scope: HrSalaryScope;
  shown?: HrFieldVisibility;
  detail?: Record<string, boolean>;
  showProductionWorker?: boolean;
}) {
  const showSalary = shown?.salary !== false;
  const showPassport = shown?.passport !== false;
  const showEid = shown?.eid !== false;
  const showVisa = shown?.visa !== false;
  const showInsurance = shown?.insurance !== false;
  const fieldOn = (id: string) => !detail || detail[id] !== false;
  function set<K extends keyof HrProfileFormState>(key: K, value: HrProfileFormState[K]) {
    onChange({ ...form, [key]: value });
  }

  function text(key: keyof HrProfileFormState) {
    return (event: ChangeEvent<HTMLInputElement>) => set(key, event.target.value);
  }

  function setSalary(
    key: "basicSalary" | "otherBenefits" | "totalSalary",
    value: string,
  ) {
    const next = { ...form, [key]: value };
    if (scope === "stl" && key !== "totalSalary") {
      next.totalSalary = stlTotalSalary(next);
    }
    onChange(next);
  }

  function salary(key: "basicSalary" | "otherBenefits" | "totalSalary") {
    return (event: ChangeEvent<HTMLInputElement>) => setSalary(key, event.target.value);
  }

  function onEidExpiry(event: ChangeEvent<HTMLInputElement>) {
    const eidExpiry = event.target.value;
    onChange({ ...form, eidExpiry, visaExpiry: eidExpiry });
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2">
        {fieldOn("visaName") ? <TextField label="Name as per visa" required value={form.visaName} disabled={disabled} onChange={text("visaName")} /> : null}
        {fieldOn("visaDesignation") ? <TextField label="Designation as per visa" required value={form.visaDesignation} disabled={disabled} onChange={text("visaDesignation")} /> : null}
        {fieldOn("foodServed") ? (
        <div className="sm:col-span-2">
          <button
            type="button"
            role="switch"
            aria-checked={form.foodServed}
            aria-label="Food served"
            disabled={disabled}
            onClick={() => set("foodServed", !form.foodServed)}
            className="inline-flex items-center gap-2 text-sm font-medium text-ink disabled:opacity-60"
          >
            <span
              className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 ease-out ${
                form.foodServed ? "bg-brand" : "bg-slate-300"
              }`}
            >
              <span
                className={`h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-out ${
                  form.foodServed ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </span>
            Food served
            <span className="text-xs font-normal text-slate-500">{form.foodServed ? "On" : "Off"}</span>
          </button>
        </div>
        ) : null}
        {showProductionWorker && fieldOn("productionWorker") ? (
          <div className="sm:col-span-2">
            <button
              type="button"
              role="switch"
              aria-checked={form.productionWorker}
              aria-label="Production worker"
              disabled={disabled}
              onClick={() => set("productionWorker", !form.productionWorker)}
              className="inline-flex items-center gap-2 text-sm font-medium text-ink disabled:opacity-60"
            >
              <span
                className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 ease-out ${
                  form.productionWorker ? "bg-brand" : "bg-slate-300"
                }`}
              >
                <span
                  className={`h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-out ${
                    form.productionWorker ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </span>
              Production worker
              <span className="text-xs font-normal text-slate-500">
                {form.productionWorker ? "Shows in the production list" : "Hidden from production"}
              </span>
            </button>
          </div>
        ) : null}
        {showCompany ? (
          <CompanyField
            value={form.company}
            disabled={disabled}
            onChange={(company) => set("company", company)}
          />
        ) : null}
        {showSalary ? (
        <>
        {fieldOn("basicSalary") ? (
        <TextField
          label="Basic salary (AED)"
          type="number"
          min={0}
          step="0.01"
          required
          value={form.basicSalary}
          disabled={disabled}
          onChange={salary("basicSalary")}
        />
        ) : null}
        {scope === "stl" ? (
          <TextField
            label="Other benefits (AED)"
            type="number"
            min={0}
            step="0.01"
            required
            value={form.otherBenefits}
            disabled={disabled}
            onChange={salary("otherBenefits")}
          />
        ) : null}
        {fieldOn("totalSalary") ? (
        <div>
          <TextField
            label="Total salary (AED)"
            type="number"
            min={0}
            step="0.01"
            required
            readOnly={scope === "stl"}
            value={form.totalSalary}
            disabled={disabled}
            onChange={salary("totalSalary")}
          />
          <p className="mt-1 text-xs text-slate-500">
            {scope === "stl"
              ? "Automatically calculated as basic salary + other benefits."
              : "Predefined monthly salary. Statutory overtime is calculated from attendance at month end."}
          </p>
        </div>
        ) : null}
        {fieldOn("sundayAllowance") ? (
        <div className="sm:col-span-2">
          <TextField label="Sunday allowance (AED per Sunday)" type="number" min={0} step="0.01" optional value={form.sundayAllowance} disabled={disabled} onChange={text("sundayAllowance")} />
          <p className="mt-1 text-xs text-slate-500">
            Company payment for each Sunday worked, separate from statutory Sunday overtime. Leave blank to use the payroll default, usually AED 80 or AED 100.
          </p>
        </div>
        ) : null}
        </>
        ) : null}
      </section>

      {showPassport ? (
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-ink">Passport</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {fieldOn("passportNumber") ? <TextField label="Passport number" required value={form.passportNumber} disabled={disabled} onChange={text("passportNumber")} /> : null}
          {fieldOn("passportExpiry") ? <TextField label="Passport expiry" type="date" required value={form.passportExpiry} disabled={disabled} onChange={text("passportExpiry")} /> : null}
          {fieldOn("passportCopy") ? <FileField label="Passport copy" required value={form.passportCopy} disabled={disabled} onUpload={onUpload} onChange={(file) => set("passportCopy", file)} /> : null}
          {fieldOn("photo") ? <FileField label="Passport-size photo" optional value={form.photo} disabled={disabled} onUpload={onUpload} onChange={(file) => set("photo", file)} /> : null}
        </div>
      </section>
      ) : null}

      {showEid ? (
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-ink">Emirates ID</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {fieldOn("eidNumber") ? <TextField label="EID number" required value={form.eidNumber} disabled={disabled} onChange={text("eidNumber")} /> : null}
          {fieldOn("eidExpiry") ? <TextField label="EID expiry" type="date" required value={form.eidExpiry} disabled={disabled} onChange={onEidExpiry} /> : null}
          {fieldOn("eidCopy") ? <FileField label="EID copy" required value={form.eidCopy} disabled={disabled} onUpload={onUpload} onChange={(file) => set("eidCopy", file)} /> : null}
        </div>
      </section>
      ) : null}

      {showVisa ? (
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-ink">Visa</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {fieldOn("visaNumber") ? <TextField label="Visa UID number" required value={form.visaNumber} disabled={disabled} onChange={text("visaNumber")} /> : null}
          {fieldOn("visaExpiry") ? (
          showEid ? (
            <div>
              <TextField label="Visa expiry" type="date" readOnly value={form.eidExpiry} disabled />
              <p className="mt-1 text-xs text-slate-500">Same as the EID expiry.</p>
            </div>
          ) : (
            <TextField label="Visa expiry" type="date" optional value={form.visaExpiry} disabled={disabled} onChange={text("visaExpiry")} />
          )
          ) : null}
          {fieldOn("visaApplicationYear") ? <TextField label="Visa application year" type="number" optional value={form.visaApplicationYear} disabled={disabled} onChange={text("visaApplicationYear")} /> : null}
          {fieldOn("visaCopy") ? <FileField label="Visa copy" required value={form.visaCopy} disabled={disabled} onUpload={onUpload} onChange={(file) => set("visaCopy", file)} /> : null}
        </div>
      </section>
      ) : null}

      {showInsurance ? (
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-ink">Insurance and contract</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {fieldOn("insuranceExpiry") ? <TextField label="Insurance expiry" type="date" required value={form.insuranceExpiry} disabled={disabled} onChange={text("insuranceExpiry")} /> : null}
          {fieldOn("insuranceCopy") ? <FileField label="Insurance copy" required value={form.insuranceCopy} disabled={disabled} onUpload={onUpload} onChange={(file) => set("insuranceCopy", file)} /> : null}
          {fieldOn("employmentContractCopy") ? <FileField label="Employment contract copy" required value={form.employmentContractCopy} disabled={disabled} onUpload={onUpload} onChange={(file) => set("employmentContractCopy", file)} /> : null}
          <div className="text-sm text-slate-600">
            <p className="font-medium text-ink">Contract expiry</p>
            <p className="mt-1">Same as the EID expiry{form.eidExpiry ? `: ${formatHrDate(form.eidExpiry)}` : ""}.</p>
          </div>
          {fieldOn("offerLetter") ? <FileField label="Offer letter" optional value={form.offerLetter} disabled={disabled} onUpload={onUpload} onChange={(file) => set("offerLetter", file)} /> : null}
        </div>
      </section>
      ) : null}

    </div>
  );
}

export function SharjahPermitFields({
  expiry,
  file,
  disabled,
  onUpload,
  onExpiryChange,
  onFileChange,
}: {
  expiry: string;
  file: HrFileRef | null;
  disabled?: boolean;
  onUpload: (file: File) => Promise<HrFileRef>;
  onExpiryChange: (value: string) => void;
  onFileChange: (file: HrFileRef | null) => void;
}) {
  return (
    <section className="space-y-3 sm:col-span-2">
      <h3 className="text-sm font-semibold text-ink">Sharjah permit</h3>
      <p className="text-xs text-slate-500">Optional. If an expiry date is set, the dashboard warns 15 days before it.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="Sharjah permit expiry"
          type="date"
          optional
          value={expiry}
          disabled={disabled}
          onChange={(event) => onExpiryChange(event.target.value)}
        />
        <FileField
          label="Sharjah permit"
          optional
          value={file}
          disabled={disabled}
          onUpload={onUpload}
          onChange={onFileChange}
        />
      </div>
    </section>
  );
}
