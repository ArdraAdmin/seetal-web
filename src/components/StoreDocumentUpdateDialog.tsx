"use client";

import { FormEvent, useState } from "react";
import { X } from "lucide-react";
import { StoreDocumentField } from "@/components/StoreDocumentField";
import { useToast } from "@/components/Toast";
import { FieldLabel, PrimaryButton, SecondaryButton, TextField } from "@/components/ui";
import { submitStoreDocumentRequest } from "@/lib/api";
import { storeTitle } from "@/lib/sales";
import { formatTradeLicenseDate, tradeLicenseDateInput } from "@/lib/store-documents";
import { storeEidNumberError } from "@/lib/store-eid";
import type { StoreProfile } from "@/lib/types";

export function StoreDocumentUpdateDialog({
  open,
  store,
  pending,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  store: StoreProfile | null;
  pending?: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
}) {
  if (!open || !store) return null;
  return (
    <StoreDocumentUpdateForm
      key={store._id}
      store={store}
      pending={pending}
      onClose={onClose}
      onSubmitted={onSubmitted}
    />
  );
}

function StoreDocumentUpdateForm({
  store,
  pending,
  onClose,
  onSubmitted,
}: {
  store: StoreProfile;
  pending?: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
}) {
  const { toast } = useToast();
  const [tradeLicenseExpiry, setTradeLicenseExpiry] = useState(
    () => tradeLicenseDateInput(store.tradeLicenseExpiry),
  );
  const [eidNumber, setEidNumber] = useState(
    () => String(store.eidNumber || "").trim(),
  );
  const [tradeLicenseDocument, setTradeLicenseDocument] = useState<File | null>(
    null,
  );
  const [eidDocument, setEidDocument] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const title = storeTitle(store);
  const currentExpiry = formatTradeLicenseDate(store.tradeLicenseExpiry);
  const currentEid = String(store.eidNumber || "").trim();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) {
      toast("A document update for this store is already under approval", "info");
      return;
    }

    const nextExpiry = tradeLicenseExpiry.trim();
    const nextEid = eidNumber.trim();
    const expiryChanged =
      nextExpiry !== "" &&
      nextExpiry !== tradeLicenseDateInput(store.tradeLicenseExpiry);
    const eidChanged = nextEid !== "" && nextEid !== currentEid;
    const licenseFileChanged = Boolean(tradeLicenseDocument);
    const eidFileChanged = Boolean(eidDocument);

    if (!expiryChanged && !eidChanged && !licenseFileChanged && !eidFileChanged) {
      toast("Change the trade license and/or EID before submitting", "info");
      return;
    }

    if (eidChanged || eidFileChanged) {
      const eidError = storeEidNumberError(nextEid || currentEid);
      if (eidError) {
        toast(eidError, "info");
        return;
      }
    }

    const body = new FormData();
    body.set("storeId", store._id);
    if (expiryChanged) body.set("tradeLicenseExpiry", nextExpiry);
    if (eidChanged) body.set("eidNumber", nextEid);
    if (tradeLicenseDocument) body.set("tradeLicenseDocument", tradeLicenseDocument);
    if (eidDocument) body.set("eidDocument", eidDocument);

    setSaving(true);
    try {
      await submitStoreDocumentRequest(body);
      toast("Update sent for admin approval", "success");
      onSubmitted?.();
      onClose();
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Could not submit the update",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="store-document-update-title"
    >
      <form
        onSubmit={onSubmit}
        className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-2xl border border-line bg-white p-5 shadow-lg"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2
              id="store-document-update-title"
              className="text-lg font-semibold text-ink"
            >
              Update store documents
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {title}. Changes go to an admin and apply only after approval.
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

        {pending ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Already under approval. Wait for an admin to review the pending update.
          </p>
        ) : null}

        <div className="rounded-xl border border-line bg-[#faf8f3] px-3 py-2 text-sm text-slate-600">
          <p>
            Current trade license expiry:{" "}
            <span className="font-medium text-ink">{currentExpiry || "Not set"}</span>
          </p>
          <p className="mt-1">
            Current EID:{" "}
            <span className="font-medium text-ink">{currentEid || "Not set"}</span>
          </p>
        </div>

        <label className="block space-y-1.5">
          <FieldLabel label="Trade license expiry" optional />
          <input
            type="date"
            value={tradeLicenseExpiry}
            disabled={pending || saving}
            onChange={(event) => setTradeLicenseExpiry(event.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm disabled:bg-slate-50"
          />
        </label>

        <StoreDocumentField
          label="Trade license document"
          file={tradeLicenseDocument}
          onChange={setTradeLicenseDocument}
        />

        <TextField
          label="EID number"
          optional
          value={eidNumber}
          disabled={pending || saving}
          onChange={(event) => setEidNumber(event.target.value)}
        />

        <StoreDocumentField
          label="EID document"
          file={eidDocument}
          onChange={setEidDocument}
        />

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <SecondaryButton type="button" onClick={onClose} disabled={saving}>
            Cancel
          </SecondaryButton>
          <PrimaryButton type="submit" disabled={pending || saving}>
            {saving ? "Submitting…" : "Send for approval"}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}
