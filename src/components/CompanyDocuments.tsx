"use client";

import { useCallback, useEffect, useMemo, useState, type DragEvent, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";
import { useToast } from "./Toast";
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from "./ui";
import {
  createCompanyDocument,
  deleteCompanyDocument,
  listCompanyDocuments,
  updateCompanyDocument,
} from "@/lib/company-documents-api";
import {
  DOCUMENT_ACCEPT,
  companyDocumentLabel,
  companyDocumentPowers,
  creatableCompanies,
  documentFileError,
  expiryDateError,
  expiryStatus,
  formatDocumentSize,
  readableCompanies,
  todayStamp,
  type CompanyDocumentPortal,
  type CompanyDocumentRecord,
} from "@/lib/company-documents";
import type { CustomCompanyKey } from "@/lib/custom-users";

type Draft = {
  id: string | null;
  title: string;
  company: CustomCompanyKey | "";
  hasExpiry: boolean;
  expiryDate: string;
  file: File | null;
  currentFileName: string;
};

const EMPTY_DRAFT: Draft = {
  id: null,
  title: "",
  company: "",
  hasExpiry: false,
  expiryDate: "",
  file: null,
  currentFileName: "",
};

export function CompanyDocuments({ portal }: { portal: CompanyDocumentPortal }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const access = user?.customAccess;
  const readable = useMemo(() => readableCompanies(access, portal), [access, portal]);
  const creatable = useMemo(() => creatableCompanies(access, portal), [access, portal]);
  const [documents, setDocuments] = useState<CompanyDocumentRecord[]>([]);
  const [companyFilter, setCompanyFilter] = useState<CustomCompanyKey | "all">("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const today = todayStamp();

  const load = useCallback(async () => {
    try {
      const rows = await listCompanyDocuments(portal);
      setDocuments(rows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load documents");
    } finally {
      setLoading(false);
    }
  }, [portal]);

  useEffect(() => {
    let cancelled = false;
    void listCompanyDocuments(portal)
      .then((rows) => {
        if (cancelled) return;
        setDocuments(rows);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load documents");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [portal]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return documents.filter((document) => {
      if (companyFilter !== "all" && document.company !== companyFilter) return false;
      if (!needle) return true;
      return (
        document.title.toLowerCase().includes(needle) ||
        document.fileName.toLowerCase().includes(needle)
      );
    });
  }, [companyFilter, documents, query]);

  function openCreate() {
    setDraft({
      ...EMPTY_DRAFT,
      company: creatable.length === 1 ? creatable[0] : "",
    });
  }

  function openEdit(document: CompanyDocumentRecord) {
    setDraft({
      id: document.id,
      title: document.title,
      company: document.company,
      hasExpiry: document.hasExpiry,
      expiryDate: document.expiryDate || "",
      file: null,
      currentFileName: document.fileName,
    });
  }

  function chooseFile(file: File | null) {
    if (!file || !draft) return;
    const problem = documentFileError(file);
    if (problem) {
      toast(problem, "error");
      return;
    }
    setDraft({ ...draft, file });
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files?.[0] || null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft || saving) return;
    const title = draft.title.trim();
    if (!title) {
      toast("Title is required", "error");
      return;
    }
    if (!draft.company) {
      toast("Choose a company", "error");
      return;
    }
    const expiryProblem = expiryDateError(draft.hasExpiry, draft.expiryDate);
    if (expiryProblem) {
      toast(expiryProblem, "error");
      return;
    }
    if (!draft.id && !draft.file) {
      toast("Choose a file", "error");
      return;
    }
    setSaving(true);
    try {
      if (draft.id) {
        await updateCompanyDocument(portal, {
          id: draft.id,
          title,
          hasExpiry: draft.hasExpiry,
          expiryDate: draft.expiryDate,
          file: draft.file,
        });
        toast("Document updated", "success");
      } else {
        await createCompanyDocument(portal, {
          company: draft.company,
          title,
          hasExpiry: draft.hasExpiry,
          expiryDate: draft.expiryDate,
          file: draft.file as File,
        });
        toast("Document added", "success");
      }
      setDraft(null);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save the document", "error");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(document: CompanyDocumentRecord) {
    if (deletingId) return;
    if (!confirm(`Delete ${document.title}?`)) return;
    setDeletingId(document.id);
    try {
      await deleteCompanyDocument(portal, document.id);
      toast("Document deleted", "success");
      setDocuments((current) => current.filter((row) => row.id !== document.id));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not delete the document", "error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="My company"
        subtitle={
          portal === "shmp"
            ? "SHMP documents stored for the company."
            : "Documents stored for STL, Sarvah, and SH Lakshmi."
        }
        actions={
          creatable.length > 0 ? (
            <PrimaryButton type="button" onClick={openCreate}>
              Add document
            </PrimaryButton>
          ) : null
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search documents"
          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand sm:max-w-xs"
        />
        {portal === "selling" && readable.length > 1 ? (
          <select
            value={companyFilter}
            onChange={(event) => setCompanyFilter(event.target.value as CustomCompanyKey | "all")}
            aria-label="Company"
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
          >
            <option value="all">All companies</option>
            {readable.map((company) => (
              <option key={company} value={company}>
                {companyDocumentLabel(company)}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {loading ? <LoadingState label="Loading documents…" /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!loading && !error && visible.length === 0 ? (
        <EmptyState
          title={documents.length === 0 ? "No documents yet" : "No matching documents"}
          description={
            documents.length === 0
              ? creatable.length > 0
                ? "Add a document to start the company file."
                : "Documents you can open will show up here."
              : "Try a different title, file name, or company."
          }
        />
      ) : null}
      {!loading && !error && visible.length > 0 ? (
        <ul className="space-y-3">
          {visible.map((document) => {
            const powers = companyDocumentPowers(access, portal, document.company);
            const expiry = expiryStatus(document.hasExpiry, document.expiryDate, today);
            const uploaded = document.uploadedAt
              ? new Date(document.uploadedAt).toLocaleDateString()
              : "";
            return (
              <li key={document.id}>
                <Card className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-sm font-semibold text-ink">{document.title}</h2>
                      {portal === "selling" ? (
                        <span className="rounded-full bg-[#f7f5f0] px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {companyDocumentLabel(document.company)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-600">{document.fileName}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {[formatDocumentSize(document.size), uploaded ? `Uploaded ${uploaded}` : ""]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className={`mt-1 text-xs ${expiry.expired ? "font-medium text-red-700" : "text-slate-500"}`}>
                      {expiry.expired ? expiry.label : `Expiry: ${expiry.label}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {document.url ? (
                      <a
                        href={document.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-[#f7f5f0]"
                      >
                        Open
                      </a>
                    ) : null}
                    {powers.update ? (
                      <SecondaryButton type="button" onClick={() => openEdit(document)}>
                        Edit
                      </SecondaryButton>
                    ) : null}
                    {powers.delete ? (
                      <SecondaryButton
                        type="button"
                        disabled={deletingId === document.id}
                        onClick={() => void onDelete(document)}
                      >
                        {deletingId === document.id ? "Deleting…" : "Delete"}
                      </SecondaryButton>
                    ) : null}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : null}

      {draft ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <form
            onSubmit={(event) => void onSubmit(event)}
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-4 shadow-lg"
          >
            <h2 className="text-base font-semibold text-ink">
              {draft.id ? "Edit document" : "Add document"}
            </h2>
            <div className="mt-4 space-y-4">
              <TextField
                label="Title"
                required
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              />
              {portal === "selling" ? (
                <label className="block space-y-1.5">
                  <span className="text-[13px] font-medium text-slate-700">Company</span>
                  <select
                    required
                    disabled={Boolean(draft.id)}
                    value={draft.company}
                    onChange={(event) =>
                      setDraft({ ...draft, company: event.target.value as CustomCompanyKey })
                    }
                    className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink disabled:bg-[#f7f5f0]"
                  >
                    <option value="">Select a company</option>
                    {(draft.id ? readable : creatable).map((company) => (
                      <option key={company} value={company}>
                        {companyDocumentLabel(company)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <div className="space-y-1.5">
                <span className="block text-[13px] font-medium text-slate-700">File</span>
                <label
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className={`flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-6 text-center ${
                    dragging ? "border-brand bg-[#fffaf2]" : "border-line bg-[#f7f5f0]"
                  }`}
                >
                  <span className="text-sm font-medium text-ink">
                    {draft.file
                      ? draft.file.name
                      : draft.currentFileName || "Drag a file here, or browse"}
                  </span>
                  <span className="mt-1 text-xs text-slate-500">
                    PDF, JPEG, PNG, WebP, Word, or Excel. Up to 25 MB.
                  </span>
                  <input
                    type="file"
                    accept={DOCUMENT_ACCEPT}
                    className="sr-only"
                    onChange={(event) => {
                      chooseFile(event.target.files?.[0] || null);
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-ink">Has expiry</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={draft.hasExpiry}
                  aria-label="Has expiry"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      hasExpiry: !draft.hasExpiry,
                      expiryDate: draft.hasExpiry ? "" : draft.expiryDate,
                    })
                  }
                  className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                    draft.hasExpiry ? "bg-brand" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                      draft.hasExpiry ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
              {draft.hasExpiry ? (
                <TextField
                  label="Expiry date"
                  type="date"
                  required
                  value={draft.expiryDate}
                  onChange={(event) => setDraft({ ...draft, expiryDate: event.target.value })}
                />
              ) : null}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <PrimaryButton type="submit" disabled={saving}>
                {saving ? "Saving…" : draft.id ? "Save changes" : "Add document"}
              </PrimaryButton>
              <SecondaryButton type="button" disabled={saving} onClick={() => setDraft(null)}>
                Cancel
              </SecondaryButton>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
