"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { City, Country } from "country-state-city";
import {
  createAdminStore,
  deleteAdminStore,
  editAdminStore,
  getAdminStores,
  getExpiredTradeLicenses,
  getSalesProfiles,
  openAdminStoreEidFile,
  saveAdminStoreEid,
  setAdminStoreBlocked,
  setAdminStoreSalesPeople,
} from "@/lib/api";
import type { ProfileUser, StoreProfile } from "@/lib/types";
import { salesPersonIdsFromStore } from "@/lib/store-access";
import { EXPIRY_ALERT_DAYS, isExpiringWithinDays } from "@/lib/expiry-window";
import {
  formatTradeLicenseDate,
  storeDocumentError,
  tradeLicenseDateInput,
} from "@/lib/store-documents";
import { STORE_EXPORT_HEADERS, storeExportRow } from "@/lib/store-export";
import { storeEidFileError, storeEidNumberError } from "@/lib/store-eid";
import { BlockStoreSwitch } from "@/components/BlockStoreSwitch";
import { StoreDetailGrid } from "@/components/StoreDetailGrid";
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
  RecordPager,
  SecondaryButton,
  TextField,
} from "@/components/ui";

const PAGE_SIZE = 20;

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
  salesPersonIds: string[];
  tradeLicenseExpiry: string;
  trnDocument: File | null;
  tradeLicenseDocument: File | null;
  eidNumber: string;
  eidDocument: File | null;
  existingTrnUrl?: string;
  existingTradeLicenseUrl?: string;
  existingEidFile?: boolean;
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
  salesPersonIds: [],
  tradeLicenseExpiry: "",
  trnDocument: null,
  tradeLicenseDocument: null,
  eidNumber: "",
  eidDocument: null,
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function salesPersonName(store: StoreProfile, id: string, people: ProfileUser[]) {
  const listed = people.find((person) => person._id === id);
  if (listed?.name) return listed.name;
  const fromStore = (store.salesPersons || []).find((person) => {
    if (typeof person === "string") return person === id;
    return person?._id === id;
  });
  if (fromStore && typeof fromStore === "object" && fromStore.name) {
    return fromStore.name;
  }
  if (
    store.salesman &&
    typeof store.salesman === "object" &&
    store.salesman._id === id &&
    store.salesman.name
  ) {
    return store.salesman.name;
  }
  return id;
}

function tradeLicensePayload(value: string) {
  return tradeLicenseDateInput(value);
}

function formFrom(store: StoreProfile): StoreForm {
  return {
    storeName: text(store.storeName || store.name),
    marks: text(store.marks),
    alias: text(store.alias),
    contactNumber: text(store.contactNumber || store.mobileNumber),
    addressLine1: text(store.addressLine1),
    addressLine2: text(store.addressLine2),
    addressLine3: text(store.addressLine3),
    city: text(store.city),
    country: text(store.country),
    uid: text(store.uid),
    salesPersonIds: salesPersonIdsFromStore(store),
    tradeLicenseExpiry: tradeLicenseDateInput(store.tradeLicenseExpiry),
    trnDocument: null,
    tradeLicenseDocument: null,
    eidNumber: text(store.eidNumber),
    eidDocument: null,
    existingTrnUrl: text(store.trnDocumentUrl) || undefined,
    existingTradeLicenseUrl: text(store.tradeLicenseDocumentUrl) || undefined,
    existingEidFile: Boolean(text(store.eidDocumentFileName)),
  };
}

function copyCount(store: StoreProfile) {
  const count = Number(store.copyCount);
  return Number.isFinite(count) && count > 1 ? count : 1;
}

function isDueTradeLicense(value: unknown) {
  if (value == null || value === "") return false;
  if (value instanceof Date || typeof value === "string") {
    return isExpiringWithinDays(value, EXPIRY_ALERT_DAYS);
  }
  return false;
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

function SalesPersonChecklist({
  ids,
  salesPeople,
  onChange,
}: {
  ids: string[];
  salesPeople: ProfileUser[];
  onChange: (ids: string[]) => void;
}) {
  const selected = new Set(ids);
  function toggle(id: string) {
    onChange(
      selected.has(id) ? ids.filter((value) => value !== id) : [...ids, id],
    );
  }

  return (
    <div className="space-y-2 sm:col-span-2">
      <FieldLabel label="Sales person" required />
      <p className="text-xs text-slate-500">
        Check every sales person who should see this store.
      </p>
      <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
        {salesPeople.length === 0 ? (
          <p className="px-1 py-2 text-sm text-slate-500">No sales people found.</p>
        ) : (
          salesPeople.map((person) => (
            <label
              key={person._id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={selected.has(person._id)}
                onChange={() => toggle(person._id)}
                className="rounded border-line"
              />
              <span className="truncate">{person.name || person._id}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

function StoreFields({
  form,
  setField,
  setFile,
  onViewEid,
  setSalesPersonIds,
  salesPeople,
  mode,
  isTemp = false,
}: {
  form: StoreForm;
  setField: (key: keyof StoreForm, value: string) => void;
  setFile: (
    key: "trnDocument" | "tradeLicenseDocument" | "eidDocument",
    file: File | null,
  ) => void;
  onViewEid?: () => void;
  setSalesPersonIds: (ids: string[]) => void;
  salesPeople: ProfileUser[];
  mode: "create" | "edit";
  isTemp?: boolean;
}) {
  const requireIdentity = mode === "create" || !isTemp;
  const requireFiles = mode === "create";

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
        required={requireIdentity}
        optional={!requireIdentity}
        value={form.uid}
        onChange={(e) => setField("uid", e.target.value)}
      />
      <StoreDocumentField
        label="TRN document"
        required={requireFiles}
        file={form.trnDocument}
        existingUrl={form.existingTrnUrl}
        onChange={(file) => setFile("trnDocument", file)}
      />
      <TextField
        label="Trade license expiry"
        type="date"
        required
        value={form.tradeLicenseExpiry}
        onChange={(e) => setField("tradeLicenseExpiry", e.target.value)}
      />
      <StoreDocumentField
        label="Trade license document"
        required={requireFiles}
        file={form.tradeLicenseDocument}
        existingUrl={form.existingTradeLicenseUrl}
        onChange={(file) => setFile("tradeLicenseDocument", file)}
      />
      <TextField
        label="EID number"
        optional
        value={form.eidNumber}
        onChange={(e) => setField("eidNumber", e.target.value)}
      />
      <StoreDocumentField
        label="EID document"
        hint="PDF or image · stored in S3"
        file={form.eidDocument}
        onViewExisting={form.existingEidFile ? onViewEid : undefined}
        onChange={(file) => setFile("eidDocument", file)}
      />
      <SalesPersonChecklist
        ids={form.salesPersonIds}
        salesPeople={salesPeople}
        onChange={setSalesPersonIds}
      />
    </>
  );
}

export default function StoresPage() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const expiredOnly = searchParams.get("license") === "expired";
  const [stores, setStores] = useState<StoreProfile[]>([]);
  const [expiredStores, setExpiredStores] = useState<StoreProfile[] | null>(null);
  const [salesPeople, setSalesPeople] = useState<ProfileUser[]>([]);
  const [page, setPage] = useState(1);
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
      const [data, people, expired] = await Promise.all([
        getAdminStores(),
        getSalesProfiles().catch(() => [] as ProfileUser[]),
        expiredOnly
          ? getExpiredTradeLicenses().catch(() => null)
          : Promise.resolve(null),
      ]);
      setStores(Array.isArray(data.stores) ? data.stores : []);
      setExpiredStores(Array.isArray(expired) ? expired : null);
      setSalesPeople(people);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stores");
    } finally {
      setLoading(false);
    }
  }, [expiredOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const listed = useMemo(() => {
    if (!expiredOnly) return stores;
    if (expiredStores) {
      const byId = new Map(stores.map((store) => [String(store._id), store]));
      return expiredStores.map((store) => byId.get(String(store._id)) ?? store);
    }
    return stores.filter((store) =>
      isDueTradeLicense(store.tradeLicenseExpiry),
    );
  }, [stores, expiredStores, expiredOnly]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return listed.filter((store) => {
      if (!q) return true;
      const blob = [
        store.storeName,
        store.name,
        store.alias,
        store.marks,
        store.city,
        store.contactNumber,
        store.mobileNumber,
      ]
        .map((part) => text(part).toLowerCase())
        .join(" ");
      return blob.includes(q);
    });
  }, [listed, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  function setAddField(key: keyof StoreForm, value: string) {
    setAddForm((prev) => ({ ...prev, [key]: value }));
  }

  function setAddFile(
    key: "trnDocument" | "tradeLicenseDocument" | "eidDocument",
    file: File | null,
  ) {
    setAddForm((prev) => ({ ...prev, [key]: file }));
  }

  function eidFileError(file: File | null) {
    if (!(file instanceof File)) return null;
    return storeEidFileError({
      name: file.name,
      type: file.type,
      size: file.size,
    });
  }

  async function onCreateStore() {
    if (!addForm.storeName.trim()) {
      toast("Enter a store name", "info");
      return;
    }
    if (!addForm.uid.trim()) {
      toast("Enter a store code", "info");
      return;
    }
    if (!addForm.addressLine1.trim()) {
      toast("Enter an address", "info");
      return;
    }
    if (!addForm.country.trim()) {
      toast("Select a country", "info");
      return;
    }
    if (!addForm.city.trim()) {
      toast("Select a city", "info");
      return;
    }
    const documentError = storeDocumentError(addForm, "create");
    if (documentError) {
      toast(documentError, "info");
      return;
    }
    if (addForm.salesPersonIds.length === 0) {
      toast("Choose a sales person", "info");
      return;
    }
    const eidError =
      storeEidNumberError(addForm.eidNumber) || eidFileError(addForm.eidDocument);
    if (eidError) {
      toast(eidError, "info");
      return;
    }
    setCreating(true);
    try {
      const created = await createAdminStore({
        storeName: addForm.storeName.trim(),
        marks: addForm.marks.trim(),
        alias: addForm.alias.trim(),
        contactNumber: addForm.contactNumber.trim(),
        addressLine1: addForm.addressLine1.trim(),
        addressLine2: addForm.addressLine2.trim(),
        addressLine3: addForm.addressLine3.trim(),
        city: addForm.city.trim(),
        country: addForm.country.trim(),
        uid: addForm.uid.trim(),
        salesPerson: addForm.salesPersonIds[0],
        salesPersons: addForm.salesPersonIds,
        location: "—",
        tradeLicenseExpiry: tradeLicensePayload(addForm.tradeLicenseExpiry),
        trnDocument: addForm.trnDocument,
        tradeLicenseDocument: addForm.tradeLicenseDocument,
      });
      const createdId = await resolveCreatedStoreId(
        created,
        addForm.uid.trim(),
        addForm.storeName.trim(),
      );
      if (createdId) await syncStoreSalesPeople(createdId, addForm.salesPersonIds, false);
      if (addForm.eidNumber.trim() || addForm.eidDocument instanceof File) {
        if (!createdId) {
          throw new Error(
            "Store was created, but the EID could not be saved because the new store id was missing",
          );
        }
        try {
          await saveAdminStoreEid({
            storeId: createdId,
            eidNumber: addForm.eidNumber.trim(),
            file: addForm.eidDocument,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Could not save the EID";
          throw new Error(`Store was created, but the EID was not saved. ${message}`);
        }
      }
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
        title="Stores"
        subtitle={
          expiredOnly
            ? `Stores whose trade license expires in ${EXPIRY_ALERT_DAYS} days or less, including already expired.`
            : "Edit store details or delete a store."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {expiredOnly ? (
              <SecondaryButton
                type="button"
                disabled={loading}
                onClick={() => {
                  setPage(1);
                  router.push("/admin/stores");
                }}
              >
                Show all stores
              </SecondaryButton>
            ) : null}
            <SecondaryButton
              type="button"
              disabled={loading || stores.length === 0}
              onClick={() => {
                void exportStores(stores, salesPeople).catch((err: unknown) => {
                  toast(
                    err instanceof Error ? err.message : "Could not export stores",
                    "error",
                  );
                });
              }}
            >
              Export stores
            </SecondaryButton>
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

      {expiredOnly && !loading ? (
        <Card className="mb-5 border-brand/30 bg-[#f7f5f0]">
          <p className="text-sm font-medium text-ink">
            Showing {filtered.length} store
            {filtered.length === 1 ? "" : "s"} with a trade license expiring in{" "}
            {EXPIRY_ALERT_DAYS} days or less
          </p>
        </Card>
      ) : null}

      {adding ? (
        <Card className="mb-5">
          <p className="mb-3 text-sm font-semibold text-ink">Add store</p>
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
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Name, marks, alias, city, or phone"
        />
      </Card>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={
            expiredOnly
              ? `No trade licenses expiring in the next ${EXPIRY_ALERT_DAYS} days`
              : "No stores found"
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((store) => (
            <StoreCard
              key={store._id}
              store={store}
              salesPeople={salesPeople}
              onChanged={() => void load()}
            />
          ))}
          <RecordPager
            page={safePage}
            hasNext={safePage < pageCount}
            loading={loading}
            rangeStart={(safePage - 1) * PAGE_SIZE + 1}
            rangeEnd={(safePage - 1) * PAGE_SIZE + visible.length}
            pageSize={PAGE_SIZE}
            onPage={setPage}
          />
        </div>
      )}
    </div>
  );
}

function createdStoreId(created: unknown) {
  if (!created || typeof created !== "object") return "";
  const row = created as {
    _id?: unknown;
    store?: { _id?: unknown };
    result?: { _id?: unknown };
  };
  return text(row.store?._id || row.result?._id || row._id);
}

async function resolveCreatedStoreId(
  created: unknown,
  uid: string,
  storeName: string,
) {
  const direct = createdStoreId(created);
  if (direct) return direct;
  const data = await getAdminStores();
  const match = (data.stores || []).find(
    (store) =>
      text(store.uid) === uid && text(store.storeName || store.name) === storeName,
  );
  return match ? text(match._id) : "";
}

async function exportStores(stores: StoreProfile[], salesPeople: ProfileUser[]) {
  const XLSX = await import("xlsx");
  const rows = stores.map((store) =>
    storeExportRow(
      {
        ...store,
        tradeLicenseExpiry: tradeLicenseDateInput(store.tradeLicenseExpiry),
      },
      salesPersonIdsFromStore(store)
        .map((id) => salesPersonName(store, id, salesPeople))
        .join(", "),
    ),
  );
  const sheet = XLSX.utils.json_to_sheet(rows, {
    header: [...STORE_EXPORT_HEADERS],
  });
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Stores");
  const day = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(book, `stores-${day}.xlsx`);
}

async function syncStoreSalesPeople(
  storeId: string,
  salesPersonIds: string[],
  isTemp: boolean,
) {
  try {
    await setAdminStoreSalesPeople(storeId, salesPersonIds, isTemp);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (/database is not configured/i.test(message)) return;
    throw err;
  }
}

function docLink(url?: string) {
  if (!url) return "—";
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-brand-dark underline"
    >
      View
    </a>
  );
}

function StoreCard({
  store,
  salesPeople,
  onChanged,
}: {
  store: StoreProfile;
  salesPeople: ProfileUser[];
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [form, setForm] = useState<StoreForm>(() => formFrom(store));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [blocked, setBlocked] = useState(store.orderBlocked === true);
  const [blocking, setBlocking] = useState(false);
  const title = text(store.storeName || store.name) || "Unnamed store";
  const assignedIds = salesPersonIdsFromStore(store);
  const salesLabel = assignedIds
    .map((id) => salesPersonName(store, id, salesPeople))
    .join(", ");
  const copies = copyCount(store);
  const isTemp = Boolean(store.isTemp || store.isTempStore);
  const phone = text(store.contactNumber || store.mobileNumber);
  const address = [store.addressLine1, store.addressLine2, store.addressLine3, store.city, store.country]
    .map((part) => text(part))
    .filter(Boolean)
    .join(", ");
  const licenseExpiry = formatTradeLicenseDate(store.tradeLicenseExpiry);

  function setField(key: keyof StoreForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setFile(
    key: "trnDocument" | "tradeLicenseDocument" | "eidDocument",
    file: File | null,
  ) {
    setForm((prev) => ({ ...prev, [key]: file }));
  }

  async function viewEid() {
    try {
      await openAdminStoreEidFile(store._id);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not open the EID document", "error");
    }
  }

  async function onSave() {
    if (!form.storeName.trim()) {
      toast("Enter a store name", "info");
      return;
    }
    if (!form.addressLine1.trim()) {
      toast("Enter an address", "info");
      return;
    }
    if (!form.country.trim()) {
      toast("Select a country", "info");
      return;
    }
    if (!form.city.trim()) {
      toast("Select a city", "info");
      return;
    }
    if (!isTemp && !form.uid.trim()) {
      toast("Enter a store code", "info");
      return;
    }
    if (form.salesPersonIds.length === 0) {
      toast("Choose a sales person", "info");
      return;
    }
    const eidError =
      storeEidNumberError(form.eidNumber) ||
      (form.eidDocument instanceof File
        ? storeEidFileError({
            name: form.eidDocument.name,
            type: form.eidDocument.type,
            size: form.eidDocument.size,
          })
        : null);
    if (eidError) {
      toast(eidError, "info");
      return;
    }
    const documentError = storeDocumentError(form, "edit", false);
    if (documentError) {
      toast(documentError, "info");
      return;
    }
    setSaving(true);
    try {
      const eidChanged =
        form.eidNumber.trim() !== text(store.eidNumber) ||
        form.eidDocument instanceof File;
      await editAdminStore({
        storeId: store._id,
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
        trnNo: text(store.trnNo) || undefined,
        salesPerson: form.salesPersonIds[0],
        salesPersons: form.salesPersonIds,
        location: "—",
        tradeLicenseExpiry: tradeLicensePayload(form.tradeLicenseExpiry),
        isTemp,
        isTempStore: isTemp,
        trnDocument: form.trnDocument,
        tradeLicenseDocument: form.tradeLicenseDocument,
      });
      await syncStoreSalesPeople(store._id, form.salesPersonIds, isTemp);
      if (eidChanged) {
        try {
          await saveAdminStoreEid({
            storeId: store._id,
            eidNumber: form.eidNumber.trim(),
            isTemp,
            file: form.eidDocument,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Could not save the EID";
          throw new Error(`Store was updated, but the EID was not saved. ${message}`);
        }
      }
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
    const extra =
      copies > 1
        ? ` This also deletes ${copies - 1} duplicate record${copies - 1 === 1 ? "" : "s"} with the same name and marks.`
        : "";
    if (!confirm(`Delete ${title}?${extra}`)) return;
    setDeleting(true);
    try {
      const result = await deleteAdminStore(store._id);
      toast(
        result.removed > 1
          ? `Deleted ${result.removed} store records`
          : "Store deleted",
        "success",
      );
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Delete failed", "error");
    } finally {
      setDeleting(false);
    }
  }

  const knownSalesIds = new Set(salesPeople.map((person) => person._id));
  const salesOptions = [
    ...assignedIds
      .filter((id) => !knownSalesIds.has(id))
      .map((id) => ({ _id: id, name: salesPersonName(store, id, salesPeople) })),
    ...salesPeople,
  ];

  async function onBlock(next: boolean) {
    const previous = blocked;
    setBlocked(next);
    setBlocking(true);
    try {
      await setAdminStoreBlocked(store._id, next, { isTemp });
    } catch (err) {
      setBlocked(previous);
      toast(err instanceof Error ? err.message : "Could not update store", "error");
    } finally {
      setBlocking(false);
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
            {isTemp ? " · Temporary" : ""}
            {copies > 1 ? ` · ${copies} duplicate records` : ""}
          </p>
          <p className="mt-1 text-sm text-slate-600">{address || "No address"}</p>
          <p className="mt-1 text-xs text-slate-500">
            {phone || "No phone"}
            {salesLabel ? ` · Sales: ${salesLabel}` : ""}
            {licenseExpiry ? ` · License expires ${licenseExpiry}` : ""}
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
            {text(store.eidNumber) ? ` · EID: ${text(store.eidNumber)}` : ""}
            {text(store.eidDocumentFileName) ? (
              <>
                {" · EID doc: "}
                <button
                  type="button"
                  onClick={() => void viewEid()}
                  className="font-medium text-brand-dark underline"
                >
                  View
                </button>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2">
          <div className="flex flex-wrap gap-2">
            <SecondaryButton
              type="button"
              onClick={() => {
                setViewing((open) => !open);
                setEditing(false);
              }}
            >
              {viewing ? "Close" : "View store"}
            </SecondaryButton>
            <SecondaryButton
              type="button"
              onClick={() => {
                setForm(formFrom(store));
                setEditing((open) => !open);
                setViewing(false);
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
          <BlockStoreSwitch
            checked={blocked}
            disabled={blocking}
            onChange={(next) => void onBlock(next)}
          />
        </div>
      </div>

      {viewing ? (
        <StoreDetailGrid
          rows={[
            { label: "Store name", value: title },
            { label: "Marks", value: text(store.marks) || "—" },
            { label: "Alias", value: text(store.alias) || "—" },
            { label: "Phone", value: phone || "—" },
            { label: "Address line 1", value: text(store.addressLine1) || "—" },
            { label: "Address line 2", value: text(store.addressLine2) || "—" },
            { label: "Address line 3", value: text(store.addressLine3) || "—" },
            { label: "City", value: text(store.city) || "—" },
            { label: "Country", value: text(store.country) || "—" },
            { label: "Store code", value: text(store.uid) || "—" },
            {
              label: "Trade license expiry",
              value: formatTradeLicenseDate(store.tradeLicenseExpiry) || "—",
            },
            { label: "EID number", value: text(store.eidNumber) || "—" },
            {
              label: "EID document",
              value: text(store.eidDocumentFileName) ? (
                <button
                  type="button"
                  onClick={() => void viewEid()}
                  className="font-medium text-brand-dark underline"
                >
                  View
                </button>
              ) : (
                "—"
              ),
            },
            { label: "TRN document", value: docLink(store.trnDocumentUrl) },
            {
              label: "Trade license document",
              value: docLink(store.tradeLicenseDocumentUrl),
            },
            { label: "Sales people", value: salesLabel || "—" },
            { label: "Orders", value: blocked ? "Blocked" : "Open" },
          ]}
        />
      ) : null}

      {editing ? (
        <div className="grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
          <StoreFields
            form={form}
            setField={setField}
            setFile={setFile}
            setSalesPersonIds={(ids) =>
              setForm((prev) => ({ ...prev, salesPersonIds: ids }))
            }
            salesPeople={salesOptions}
            mode="edit"
            isTemp={isTemp}
            onViewEid={() => void viewEid()}
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
