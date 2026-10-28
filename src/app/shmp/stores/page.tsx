"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { City, Country } from "country-state-city";
import {
  shmpCreateStore,
  shmpDeleteStore,
  shmpStoreSalesmen,
  shmpStores,
  shmpUpdateStore,
  type ShmpStore,
  type ShmpStorePerson,
} from "@/lib/shmp-api";
import { StoreDocumentField } from "@/components/StoreDocumentField";
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
import { storeDocumentError } from "@/lib/store-documents";

type StoreForm = {
  storeName: string;
  marks: string;
  alias: string;
  contactNumber: string;
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
  city: string;
  country: string;
  uid: string;
  tradeLicenseExpiry: string;
  salesPersonIds: string[];
  trnDocument: File | null;
  tradeLicenseDocument: File | null;
  existingTrnUrl?: string;
  existingTradeLicenseUrl?: string;
};

const EMPTY_FORM: StoreForm = {
  storeName: "",
  marks: "",
  alias: "",
  contactNumber: "",
  addressLine1: "",
  addressLine2: "",
  addressLine3: "",
  city: "",
  country: "",
  uid: "",
  tradeLicenseExpiry: "",
  salesPersonIds: [],
  trnDocument: null,
  tradeLicenseDocument: null,
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function personId(value: string | ShmpStorePerson | undefined | null) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return text(value._id);
}

function personName(value: string | ShmpStorePerson | undefined | null) {
  if (!value || typeof value === "string") return "";
  return text(value.name) || text(value.email);
}

function salesIdsFromStore(store: ShmpStore): string[] {
  const fromList = Array.isArray(store.salesPersons)
    ? store.salesPersons.map(personId).filter(Boolean)
    : [];
  if (fromList.length) return [...new Set(fromList)];
  const primary = personId(store.salesPerson);
  return primary ? [primary] : [];
}

function dateTimeLocalValue(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function tradeLicensePayload(value: string) {
  const raw = value.trim();
  if (!raw) return undefined;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function formFrom(store: ShmpStore): StoreForm {
  return {
    storeName: text(store.storeName),
    marks: text(store.marks),
    alias: text(store.alias),
    contactNumber: text(store.contactNumber),
    addressLine1: text(store.addressLine1),
    addressLine2: text(store.addressLine2),
    addressLine3: text(store.addressLine3),
    city: text(store.city),
    country: text(store.country),
    uid: text(store.uid),
    tradeLicenseExpiry: dateTimeLocalValue(store.tradeLicenseExpiry),
    salesPersonIds: salesIdsFromStore(store),
    trnDocument: null,
    tradeLicenseDocument: null,
    existingTrnUrl: store.trnDocumentUrl,
    existingTradeLicenseUrl: store.tradeLicenseDocumentUrl,
  };
}

function CountryCityFields({
  form,
  setField,
}: {
  form: StoreForm;
  setField: (key: keyof StoreForm, value: string) => void;
}) {
  const [cityFilter, setCityFilter] = useState("");
  const countries = useMemo(() => Country.getAllCountries(), []);
  const selected = countries.find(
    (country) => country.name.toLowerCase() === form.country.trim().toLowerCase(),
  );
  const cityNames = useMemo(() => {
    if (!selected) return [];
    const names = (City.getCitiesOfCountry(selected.isoCode) || []).map(
      (city) => city.name,
    );
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [selected]);
  const needle = cityFilter.trim().toLowerCase();
  const visibleCities = (
    needle
      ? cityNames.filter((name) => name.toLowerCase().includes(needle))
      : cityNames
  ).slice(0, 300);
  const countryOptions =
    form.country && !selected
      ? [form.country, ...countries.map((country) => country.name)]
      : countries.map((country) => country.name);
  const cityOptions =
    form.city && !visibleCities.includes(form.city)
      ? [form.city, ...visibleCities]
      : visibleCities;

  return (
    <>
      <label className="block space-y-1.5">
        <FieldLabel label="Country" required />
        <select
          required
          value={form.country}
          onChange={(e) => {
            setField("country", e.target.value);
            setField("city", "");
            setCityFilter("");
          }}
          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-base text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand sm:text-sm"
        >
          <option value="">Select a country</option>
          {countryOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1.5">
        <FieldLabel label="City" required />
        <input
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          placeholder="Filter cities"
          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-base text-ink outline-none placeholder:text-slate-400 focus:border-brand focus:ring-1 focus:ring-brand sm:text-sm"
        />
        <select
          required
          value={form.city}
          onChange={(e) => setField("city", e.target.value)}
          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-base text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand sm:text-sm"
        >
          <option value="">Select a city</option>
          {cityOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

function SalesmenPicker({
  form,
  salesPeople,
  onChange,
}: {
  form: StoreForm;
  salesPeople: ShmpStorePerson[];
  onChange: (ids: string[]) => void;
}) {
  const selected = new Set(form.salesPersonIds);
  const primary = form.salesPersonIds[0] || "";

  function toggle(id: string) {
    const next = selected.has(id)
      ? form.salesPersonIds.filter((x) => x !== id)
      : [...form.salesPersonIds, id];
    onChange(next);
  }

  function setPrimary(id: string) {
    if (!selected.has(id)) return;
    onChange([id, ...form.salesPersonIds.filter((x) => x !== id)]);
  }

  return (
    <div className="space-y-2 sm:col-span-2">
      <FieldLabel label="Salesmen" required />
      <p className="text-xs text-slate-500">
        Assign one or more salesmen. The first selected (or the one marked
        primary) is the primary assignee.
      </p>
      <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
        {salesPeople.length === 0 ? (
          <p className="px-1 py-2 text-sm text-slate-500">No salesmen found.</p>
        ) : (
          salesPeople.map((person) => {
            const id = person._id;
            const checked = selected.has(id);
            return (
              <div
                key={id}
                className="flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50"
              >
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(id)}
                    className="rounded border-line"
                  />
                  <span className="truncate">
                    {text(person.name) || text(person.email) || id}
                  </span>
                </label>
                {checked ? (
                  <button
                    type="button"
                    onClick={() => setPrimary(id)}
                    className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                      primary === id
                        ? "bg-brand text-black"
                        : "border border-line text-slate-600 hover:bg-white"
                    }`}
                  >
                    {primary === id ? "Primary" : "Make primary"}
                  </button>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function StoreFields({
  form,
  setField,
  setFile,
  setSalesPersonIds,
  salesPeople,
  mode,
}: {
  form: StoreForm;
  setField: (key: keyof StoreForm, value: string) => void;
  setFile: (key: "trnDocument" | "tradeLicenseDocument", file: File | null) => void;
  setSalesPersonIds: (ids: string[]) => void;
  salesPeople: ShmpStorePerson[];
  mode: "create" | "edit";
}) {
  const requireTrn =
    mode === "create" || !String(form.existingTrnUrl ?? "").trim();
  const requireLicenseDoc =
    mode === "create" || !String(form.existingTradeLicenseUrl ?? "").trim();
  return (
    <>
      <TextField
        label="Store name"
        required
        value={form.storeName}
        onChange={(e) => setField("storeName", e.target.value)}
      />
      <TextField
        label="Marks"
        optional
        value={form.marks}
        onChange={(e) => setField("marks", e.target.value)}
      />
      <TextField
        label="Alias"
        optional
        value={form.alias}
        onChange={(e) => setField("alias", e.target.value)}
      />
      <TextField
        label="Phone"
        optional
        value={form.contactNumber}
        onChange={(e) => setField("contactNumber", e.target.value)}
      />
      <TextField
        label="Address line 1"
        required
        value={form.addressLine1}
        onChange={(e) => setField("addressLine1", e.target.value)}
      />
      <TextField
        label="Address line 2"
        optional
        value={form.addressLine2}
        onChange={(e) => setField("addressLine2", e.target.value)}
      />
      <TextField
        label="Address line 3"
        optional
        value={form.addressLine3}
        onChange={(e) => setField("addressLine3", e.target.value)}
      />
      <CountryCityFields form={form} setField={setField} />
      <TextField
        label="Store code"
        required
        value={form.uid}
        onChange={(e) => setField("uid", e.target.value)}
      />
      <StoreDocumentField
        label="TRN document"
        required={requireTrn}
        file={form.trnDocument}
        existingUrl={form.existingTrnUrl}
        hint="PDF or image · stored in S3"
        onChange={(file) => setFile("trnDocument", file)}
      />
      <TextField
        label="Trade license expiry"
        type="datetime-local"
        required
        value={form.tradeLicenseExpiry}
        onChange={(e) => setField("tradeLicenseExpiry", e.target.value)}
      />
      <StoreDocumentField
        label="Trade license document"
        required={requireLicenseDoc}
        file={form.tradeLicenseDocument}
        existingUrl={form.existingTradeLicenseUrl}
        hint="PDF or image · stored in S3"
        onChange={(file) => setFile("tradeLicenseDocument", file)}
      />
      <SalesmenPicker
        form={form}
        salesPeople={salesPeople}
        onChange={setSalesPersonIds}
      />
    </>
  );
}

function validateForm(
  form: StoreForm,
  mode: "create" | "edit",
  toast: (msg: string, kind: "info") => void,
) {
  if (!form.storeName.trim()) {
    toast("Enter a store name", "info");
    return false;
  }
  if (!form.uid.trim()) {
    toast("Enter a store code", "info");
    return false;
  }
  if (!form.addressLine1.trim()) {
    toast("Enter an address", "info");
    return false;
  }
  if (!form.country.trim()) {
    toast("Select a country", "info");
    return false;
  }
  if (!form.city.trim()) {
    toast("Select a city", "info");
    return false;
  }
  const documentError = storeDocumentError(form, mode);
  if (documentError) {
    toast(documentError, "info");
    return false;
  }
  if (form.salesPersonIds.length === 0) {
    toast("Assign at least one salesman", "info");
    return false;
  }
  return true;
}

function payloadFromForm(form: StoreForm) {
  const base = {
    storeName: form.storeName.trim(),
    marks: form.marks.trim(),
    alias: form.alias.trim(),
    contactNumber: form.contactNumber.trim(),
    addressLine1: form.addressLine1.trim(),
    addressLine2: form.addressLine2.trim(),
    addressLine3: form.addressLine3.trim(),
    city: form.city.trim(),
    country: form.country.trim(),
    uid: form.uid.trim(),
    salesPersons: form.salesPersonIds,
    salesPerson: form.salesPersonIds[0],
    location: "—",
    tradeLicenseExpiry: tradeLicensePayload(form.tradeLicenseExpiry),
  };
  if (form.trnDocument instanceof File || form.tradeLicenseDocument instanceof File) {
    return {
      ...base,
      trnDocument: form.trnDocument,
      tradeLicenseDocument: form.tradeLicenseDocument,
    };
  }
  return base;
}

export default function ShmpStoresPage() {
  const { toast } = useToast();
  const [stores, setStores] = useState<ShmpStore[]>([]);
  const [salesPeople, setSalesPeople] = useState<ShmpStorePerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState<StoreForm>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, people] = await Promise.all([
        shmpStores(),
        shmpStoreSalesmen().catch(() => [] as ShmpStorePerson[]),
      ]);
      setStores(Array.isArray(list) ? list : []);
      setSalesPeople(Array.isArray(people) ? people : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stores");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stores.filter((store) => {
      if (!q) return true;
      const names = salesIdsFromStore(store)
        .map((id) => {
          const person = salesPeople.find((p) => p._id === id);
          return person ? `${person.name || ""} ${person.email || ""}` : id;
        })
        .join(" ");
      const blob = [
        store.storeName,
        store.alias,
        store.marks,
        store.city,
        store.contactNumber,
        store.uid,
        names,
      ]
        .map((part) => text(part).toLowerCase())
        .join(" ");
      return blob.includes(q);
    });
  }, [stores, salesPeople, query]);

  function setAddField(key: keyof StoreForm, value: string) {
    setAddForm((prev) => ({ ...prev, [key]: value }));
  }

  function setAddFile(
    key: "trnDocument" | "tradeLicenseDocument",
    file: File | null,
  ) {
    setAddForm((prev) => ({ ...prev, [key]: file }));
  }

  async function onCreateStore() {
    if (!validateForm(addForm, "create", toast)) return;
    setCreating(true);
    try {
      await shmpCreateStore(payloadFromForm(addForm));
      toast("Store created", "success");
      setAddForm(EMPTY_FORM);
      setAdding(false);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not create store", "error");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="SHMP Stores"
        subtitle="Sarvah store directory — same fields as STL stores, with multiple salesmen per store."
        actions={
          <div className="flex flex-wrap gap-2">
            <SecondaryButton
              type="button"
              disabled={loading}
              onClick={() => {
                setAdding((open) => !open);
                if (!adding) setAddForm(EMPTY_FORM);
              }}
            >
              {adding ? "Close add" : "Add store"}
            </SecondaryButton>
            <SecondaryButton type="button" disabled={loading} onClick={() => void load()}>
              Refresh
            </SecondaryButton>
          </div>
        }
      />

      {adding ? (
        <Card className="mb-5">
          <p className="mb-3 text-sm font-semibold text-ink">Add SHMP store</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <StoreFields
              form={addForm}
              setField={setAddField}
              setFile={setAddFile}
              setSalesPersonIds={(ids) =>
                setAddForm((prev) => ({ ...prev, salesPersonIds: ids }))
              }
              salesPeople={salesPeople}
              mode="create"
            />
            <div className="flex items-end gap-2 sm:col-span-2">
              <PrimaryButton
                type="button"
                disabled={creating}
                onClick={() => void onCreateStore()}
              >
                {creating ? "Creating…" : "Create store"}
              </PrimaryButton>
              <SecondaryButton
                type="button"
                disabled={creating}
                onClick={() => {
                  setAddForm(EMPTY_FORM);
                  setAdding(false);
                }}
              >
                Cancel
              </SecondaryButton>
            </div>
          </div>
        </Card>
      ) : null}

      <Card className="mb-5">
        <TextField
          label="Search stores"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, marks, alias, city, phone, or salesman"
        />
      </Card>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No SHMP stores found" />
      ) : (
        <div className="space-y-3">
          {filtered.map((store) => (
            <StoreCard
              key={store._id}
              store={store}
              salesPeople={salesPeople}
              onChanged={() => void load()}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StoreCard({
  store,
  salesPeople,
  onChanged,
}: {
  store: ShmpStore;
  salesPeople: ShmpStorePerson[];
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<StoreForm>(() => formFrom(store));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const title = text(store.storeName) || "Unnamed store";
  const assigned = salesIdsFromStore(store).map((id) => {
    const person = salesPeople.find((p) => p._id === id);
    if (person) return text(person.name) || text(person.email) || id;
    const fromStore = (store.salesPersons || []).find(
      (p) => personId(p) === id,
    );
    return personName(fromStore) || personName(store.salesPerson) || id;
  });
  const phone = text(store.contactNumber);
  const address = [
    store.addressLine1,
    store.addressLine2,
    store.addressLine3,
    store.city,
    store.country,
  ]
    .map((part) => text(part))
    .filter(Boolean)
    .join(", ");

  function setField(key: keyof StoreForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setFile(
    key: "trnDocument" | "tradeLicenseDocument",
    file: File | null,
  ) {
    setForm((prev) => ({ ...prev, [key]: file }));
  }

  async function onSave() {
    if (!validateForm(form, "edit", toast)) return;
    setSaving(true);
    try {
      await shmpUpdateStore(store._id, payloadFromForm(form));
      toast("Store updated", "success");
      setEditing(false);
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not update store", "error");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!confirm(`Delete ${title}?`)) return;
    setDeleting(true);
    try {
      await shmpDeleteStore(store._id);
      toast("Store deleted", "success");
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Delete failed", "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{title}</p>
          <p className="mt-1 text-sm text-slate-600">
            {store.marks ? `Marks: ${store.marks}` : "No marks"}
            {store.alias ? ` · ${store.alias}` : ""}
            {store.uid ? ` · Code ${store.uid}` : ""}
          </p>
          <p className="mt-1 text-sm text-slate-600">{address || "No address"}</p>
          <p className="mt-1 text-xs text-slate-500">
            {phone || "No phone"}
            {assigned.length
              ? ` · Sales: ${assigned.join(", ")}`
              : " · No salesman assigned"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            TRN doc:{" "}
            {store.trnDocumentUrl ? (
              <a
                href={store.trnDocumentUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-brand-dark underline"
              >
                View
              </a>
            ) : (
              "—"
            )}
            {" · License doc: "}
            {store.tradeLicenseDocumentUrl ? (
              <a
                href={store.tradeLicenseDocumentUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-brand-dark underline"
              >
                View
              </a>
            ) : (
              "—"
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/shmp/stores/${store._id}`}
            className="inline-flex items-center justify-center rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-slate-50"
          >
            Inventory
          </Link>
          <SecondaryButton
            type="button"
            onClick={() => {
              setForm(formFrom(store));
              setEditing((open) => !open);
            }}
          >
            {editing ? "Close" : "Edit"}
          </SecondaryButton>
          <SecondaryButton
            type="button"
            className="border-red-200 text-red-700"
            disabled={deleting}
            onClick={() => void onDelete()}
          >
            {deleting ? "Deleting…" : "Delete"}
          </SecondaryButton>
        </div>
      </div>

      {editing ? (
        <div className="grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
          <StoreFields
            form={form}
            setField={setField}
            setFile={setFile}
            setSalesPersonIds={(ids) =>
              setForm((prev) => ({ ...prev, salesPersonIds: ids }))
            }
            salesPeople={salesPeople}
            mode="edit"
          />
          <div className="flex items-end gap-2 sm:col-span-2">
            <PrimaryButton type="button" disabled={saving} onClick={() => void onSave()}>
              {saving ? "Saving…" : "Save store"}
            </PrimaryButton>
            <SecondaryButton
              type="button"
              disabled={saving}
              onClick={() => {
                setForm(formFrom(store));
                setEditing(false);
              }}
            >
              Cancel
            </SecondaryButton>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
