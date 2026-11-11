"use client";

import { FormEvent, useMemo, useState } from "react";
import { City, Country } from "country-state-city";
import { X } from "lucide-react";
import { StoreDocumentField } from "@/components/StoreDocumentField";
import { useToast } from "@/components/Toast";
import { FieldLabel, PrimaryButton, SecondaryButton, TextField } from "@/components/ui";
import { submitStoreRequest } from "@/lib/api";
import { storeDocumentError } from "@/lib/store-documents";
import { storeEidRequiredError } from "@/lib/store-eid";

export function StoreRequestDialog({
  open,
  environment,
  onClose,
}: {
  open: boolean;
  environment: "stl" | "shmp";
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [storeName, setStoreName] = useState("");
  const [marks, setMarks] = useState("");
  const [alias, setAlias] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [addressLine3, setAddressLine3] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [tradeLicenseExpiry, setTradeLicenseExpiry] = useState("");
  const [eidNumber, setEidNumber] = useState("");
  const [trnDocument, setTrnDocument] = useState<File | null>(null);
  const [tradeLicenseDocument, setTradeLicenseDocument] = useState<File | null>(null);
  const [eidDocument, setEidDocument] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const countries = useMemo(() => Country.getAllCountries(), []);
  const selected = countries.find(
    (row) => row.name.toLowerCase() === country.trim().toLowerCase(),
  );
  const cityNames = useMemo(() => {
    if (!selected) return [];
    const names = (City.getCitiesOfCountry(selected.isoCode) || []).map((row) => row.name);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [selected]);
  const needle = cityFilter.trim().toLowerCase();
  const visibleCities = (
    needle ? cityNames.filter((name) => name.toLowerCase().includes(needle)) : cityNames
  ).slice(0, 300);

  if (!open) return null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!storeName.trim()) {
      toast("Enter a store name", "info");
      return;
    }
    if (!addressLine1.trim() || !country.trim() || !city.trim()) {
      toast("Enter the address, country, and city", "info");
      return;
    }
    const documentError = storeDocumentError(
      { trnDocument, tradeLicenseDocument, tradeLicenseExpiry },
      "create",
    );
    if (documentError) {
      toast(documentError, "info");
      return;
    }
    const eidError = storeEidRequiredError({
      eidNumber,
      file: eidDocument
        ? { name: eidDocument.name, type: eidDocument.type, size: eidDocument.size }
        : null,
    });
    if (eidError) {
      toast(eidError, "info");
      return;
    }
    const body = new FormData();
    body.set("environment", environment);
    body.set("storeName", storeName.trim());
    body.set("marks", marks.trim());
    body.set("alias", alias.trim());
    body.set("contactNumber", contactNumber.trim());
    body.set("addressLine1", addressLine1.trim());
    body.set("addressLine2", addressLine2.trim());
    body.set("addressLine3", addressLine3.trim());
    body.set("country", country.trim());
    body.set("city", city.trim());
    body.set("tradeLicenseExpiry", tradeLicenseExpiry.trim());
    body.set("eidNumber", eidNumber.trim());
    if (trnDocument) body.set("trnDocument", trnDocument);
    if (tradeLicenseDocument) body.set("tradeLicenseDocument", tradeLicenseDocument);
    if (eidDocument) body.set("eidDocument", eidDocument);
    setSaving(true);
    try {
      await submitStoreRequest(body);
      toast("Store sent for admin approval", "success");
      onClose();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not submit the store", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="store-request-title"
    >
      <form
        onSubmit={onSubmit}
        className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-2xl border border-line bg-white p-5 shadow-lg"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 id="store-request-title" className="text-lg font-semibold text-ink">
              New store
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              This goes to an admin. The store is created, with the next code from SHR5742, only after approval.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>
        <TextField label="Store name" required value={storeName} onChange={(e) => setStoreName(e.target.value)} />
        <TextField label="Marks" optional value={marks} onChange={(e) => setMarks(e.target.value)} />
        <TextField label="Alias" optional value={alias} onChange={(e) => setAlias(e.target.value)} />
        <TextField label="Phone" optional value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} />
        <TextField label="Address line 1" required value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
        <TextField label="Address line 2" optional value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} />
        <TextField label="Address line 3" optional value={addressLine3} onChange={(e) => setAddressLine3(e.target.value)} />
        <label className="block space-y-1.5">
          <FieldLabel label="Country" required />
          <select
            required
            value={country}
            onChange={(event) => {
              setCountry(event.target.value);
              setCity("");
              setCityFilter("");
            }}
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="">Select a country</option>
            {countries.map((row) => (
              <option key={row.isoCode} value={row.name}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <FieldLabel label="City" required />
          <input
            value={cityFilter}
            onChange={(event) => setCityFilter(event.target.value)}
            placeholder="Filter cities"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
          <select
            required
            value={city}
            onChange={(event) => setCity(event.target.value)}
            className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="">Select a city</option>
            {visibleCities.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <StoreDocumentField
          label="TRN document"
          required
          file={trnDocument}
          onChange={setTrnDocument}
        />
        <TextField
          label="Trade license expiry"
          type="date"
          required
          value={tradeLicenseExpiry}
          onChange={(event) => setTradeLicenseExpiry(event.target.value)}
        />
        <StoreDocumentField
          label="Trade license document"
          required
          file={tradeLicenseDocument}
          onChange={setTradeLicenseDocument}
        />
        <TextField
          label="EID number"
          required
          value={eidNumber}
          onChange={(event) => setEidNumber(event.target.value)}
        />
        <StoreDocumentField
          label="EID document"
          required
          file={eidDocument}
          onChange={setEidDocument}
        />
        <div className="flex justify-end gap-2">
          <SecondaryButton type="button" onClick={onClose} disabled={saving}>
            Cancel
          </SecondaryButton>
          <PrimaryButton type="submit" disabled={saving}>
            {saving ? "Sending…" : "Send for approval"}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}
