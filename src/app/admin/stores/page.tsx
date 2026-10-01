"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteAdminStore,
  editAdminStore,
  getAdminStores,
  getSalesProfiles,
  removeDuplicateStores,
} from "@/lib/api";
import type { ProfileUser, StoreProfile } from "@/lib/types";
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
  trnNo: string;
  salesPerson: string;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function salesPersonId(store: StoreProfile) {
  const person = store.salesPerson ?? store.salesman;
  if (person && typeof person === "object") return person._id || "";
  if (typeof person === "string") return person;
  return "";
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
    trnNo: text(store.trnNo),
    salesPerson: salesPersonId(store),
  };
}

function copyCount(store: StoreProfile) {
  const count = Number(store.copyCount);
  return Number.isFinite(count) && count > 1 ? count : 1;
}

export default function StoresPage() {
  const { toast } = useToast();
  const [stores, setStores] = useState<StoreProfile[]>([]);
  const [salesPeople, setSalesPeople] = useState<ProfileUser[]>([]);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, people] = await Promise.all([
        getAdminStores(),
        getSalesProfiles().catch(() => [] as ProfileUser[]),
      ]);
      setStores(Array.isArray(data.stores) ? data.stores : []);
      setDuplicateCount(Number(data.duplicateCount) || 0);
      setSalesPeople(people);
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
    if (!q) return stores;
    return stores.filter((store) => {
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
  }, [stores, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  async function onRemoveDuplicates() {
    if (
      !confirm(
        "Remove duplicate stores that share the same name and marks? Orders stay on the remaining store.",
      )
    ) {
      return;
    }
    setRemoving(true);
    try {
      const result = await removeDuplicateStores();
      toast(
        result.removed
          ? `Removed ${result.removed} duplicate store${result.removed === 1 ? "" : "s"}`
          : "No duplicate stores",
        "success",
      );
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not remove duplicates", "error");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Stores"
        subtitle="Edit store details, delete a store, or remove duplicate records."
        actions={
          <div className="flex flex-wrap gap-2">
            {duplicateCount > 0 ? (
              <PrimaryButton
                type="button"
                disabled={removing || loading}
                onClick={() => void onRemoveDuplicates()}
              >
                {removing
                  ? "Removing…"
                  : `Remove ${duplicateCount} duplicate${duplicateCount === 1 ? "" : "s"}`}
              </PrimaryButton>
            ) : null}
            <SecondaryButton type="button" disabled={loading} onClick={() => void load()}>
              Refresh
            </SecondaryButton>
          </div>
        }
      />

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
        <EmptyState title="No stores found" />
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
  const [form, setForm] = useState<StoreForm>(() => formFrom(store));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const title = text(store.storeName || store.name) || "Unnamed store";
  const salesman =
    typeof store.salesman === "object" && store.salesman
      ? store.salesman.name
      : undefined;
  const copies = copyCount(store);
  const isTemp = Boolean(store.isTemp || store.isTempStore);
  const phone = text(store.contactNumber || store.mobileNumber);
  const address = [store.addressLine1, store.addressLine2, store.addressLine3, store.city, store.country]
    .map((part) => text(part))
    .filter(Boolean)
    .join(", ");

  function setField(key: keyof StoreForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSave() {
    if (!form.storeName.trim()) {
      toast("Enter a store name", "info");
      return;
    }
    if (!isTemp && !form.country.trim()) {
      toast("Enter a country", "info");
      return;
    }
    if (!isTemp && !form.uid.trim()) {
      toast("Enter a store code", "info");
      return;
    }
    setSaving(true);
    try {
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
        trnNo: form.trnNo.trim(),
        salesPerson: form.salesPerson,
      });
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

  const salesOptions = salesPeople.some((person) => person._id === form.salesPerson)
    ? salesPeople
    : salesman && form.salesPerson
      ? [{ _id: form.salesPerson, name: salesman }, ...salesPeople]
      : salesPeople;

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
            {salesman ? ` · Sales: ${salesman}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
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
            optional
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
          <TextField
            label="City"
            optional
            value={form.city}
            onChange={(e) => setField("city", e.target.value)}
          />
          <TextField
            label="Country"
            required={!isTemp}
            optional={isTemp}
            value={form.country}
            onChange={(e) => setField("country", e.target.value)}
          />
          <TextField
            label="Store code"
            required={!isTemp}
            optional={isTemp}
            value={form.uid}
            onChange={(e) => setField("uid", e.target.value)}
          />
          <TextField
            label="TRN"
            optional
            value={form.trnNo}
            onChange={(e) => setField("trnNo", e.target.value)}
          />
          <label className="block space-y-1.5">
            <FieldLabel label="Sales person" optional />
            <select
              value={form.salesPerson}
              onChange={(e) => setField("salesPerson", e.target.value)}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            >
              <option value="">None</option>
              {salesOptions.map((person) => (
                <option key={person._id} value={person._id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
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
