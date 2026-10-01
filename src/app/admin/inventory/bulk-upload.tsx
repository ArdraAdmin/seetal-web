"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import {
  checkProductsByItemRefs,
  existingItemLabel,
  getCategories,
  getCompanies,
  updateInventoryQuantities,
  type CompanyRecord,
  type ExistingInventoryItem,
} from "@/lib/api";
import { parseCategoryGroups, type CategoryGroup } from "@/lib/categories";
import {
  addInventoryUploadRows,
  parseInventoryUploadFile,
  syncInventoryUploadRows,
  type InventoryUploadRow,
  type InventoryUploadTable,
} from "@/lib/inventory-upload";
import { useToast } from "@/components/Toast";
import { Card, PrimaryButton, SecondaryButton } from "@/components/ui";

const ACCEPT = [
  ".xlsx",
  ".xls",
  ".csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
].join(",");

const TEMPLATE_HEADERS = [
  "Item Ref",
  "Item Details",
  "Unit",
  "SP",
  "PCS/CTNS",
  "MASTER CATEGORY",
  "SUB CATEGORY",
  "Cl. Qty",
  "Company",
  "Barcode",
];

const EXISTING_PREVIEW_LIMIT = 12;

function isSpreadsheet(file: File) {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls")
  );
}

function downloadTemplate() {
  const sample = [
    TEMPLATE_HEADERS.join(","),
    "SAMPLE-001,Sample item,PCS,10,1,FOOD,SNACKS,0,STL,",
  ].join("\n");
  const blob = new Blob([sample], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "inventory-upload-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function InventoryBulkUpload() {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [existingItems, setExistingItems] = useState<ExistingInventoryItem[]>(
    [],
  );
  const [newRows, setNewRows] = useState<InventoryUploadRow[]>([]);
  const [pendingTable, setPendingTable] = useState<InventoryUploadTable | null>(
    null,
  );
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getCategories(), getCompanies()])
      .then(([categoryData, companyData]) => {
        if (cancelled) return;
        setGroups(parseCategoryGroups(categoryData));
        setCompanies(companyData);
      })
      .catch(() => {
        if (!cancelled) {
          toast("Could not load categories and companies", "error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  function resetCheck() {
    setExistingItems([]);
    setNewRows([]);
    setPendingTable(null);
  }

  function chooseFile(next: File | null) {
    if (next && !isSpreadsheet(next)) {
      toast("Use a .xlsx, .xls, or .csv file", "info");
      return;
    }
    setFile(next);
    resetCheck();
    if (!next && inputRef.current) inputRef.current.value = "";
  }

  async function addNewRows(rows: InventoryUploadRow[]) {
    if (rows.length === 0) return { added: 0, errors: [] as string[] };
    return addInventoryUploadRows(rows, groups, companies);
  }

  async function finishUpload(options: { updateExisting: boolean }) {
    if (!pendingTable) return;
    setUploading(true);
    try {
      let updatedCount = 0;
      if (options.updateExisting && existingItems.length > 0) {
        const byRef = new Map(
          pendingTable.rows.map((row) => [row.itemRef, row]),
        );
        const updates = existingItems
          .map((item) => byRef.get(item.itemRef))
          .filter((row): row is InventoryUploadRow => Boolean(row))
          .map((row) => ({
            itemRef: row.itemRef,
            closingQty: row.closingQty,
          }));
        if (updates.length > 0) {
          const result = await updateInventoryQuantities(updates);
          updatedCount =
            result && typeof result === "object" && "updated" in result
              ? Number((result as { updated?: unknown }).updated) || 0
              : updates.length;
        }
      }

      const created = await addNewRows(newRows);
      const parts: string[] = [];
      if (created.added > 0) {
        parts.push(
          `${created.added} new item${created.added === 1 ? "" : "s"} added`,
        );
      }
      if (updatedCount > 0) {
        parts.push(
          `quantity updated for ${updatedCount} existing item${updatedCount === 1 ? "" : "s"}`,
        );
      }
      if (created.errors.length > 0) {
        toast(
          `${created.errors.slice(0, 4).join(". ")}${created.errors.length > 4 ? ` (+${created.errors.length - 4} more)` : ""}`,
          "error",
        );
      } else if (parts.length > 0) {
        toast(parts.join(". "), "success");
      } else if (options.updateExisting) {
        toast("No existing items were updated.", "info");
      } else {
        toast(
          "These items already exist. No new products were added.",
          "info",
        );
      }
      if (created.errors.length === 0) chooseFile(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      toast("Choose a .xlsx or .csv file first", "info");
      return;
    }
    if (groups.length === 0 || companies.length === 0) {
      toast("Categories and companies are still loading. Try again.", "info");
      return;
    }
    setUploading(true);
    resetCheck();
    try {
      const table = await parseInventoryUploadFile(file);
      if (table.rows.length === 0) {
        toast("The file has no product rows.", "error");
        return;
      }
      const existing = await checkProductsByItemRefs(
        table.rows.map((row) => row.itemRef),
      );
      const created = await syncInventoryUploadRows(
        table.rows,
        existing,
        groups,
        companies,
      );
      if (created.errors.length > 0 && created.added === 0 && created.updated === 0) {
        toast(created.errors.slice(0, 4).join(". "), "error");
        return;
      }
      const parts: string[] = [];
      if (created.added > 0) {
        parts.push(
          `${created.added} new item${created.added === 1 ? "" : "s"} added`,
        );
      }
      if (created.updated > 0) {
        parts.push(
          `${created.updated} existing item${created.updated === 1 ? "" : "s"} updated`,
        );
      }
      if (created.errors.length > 0) {
        toast(
          `${parts.join(". ")}. ${created.errors.slice(0, 3).join(". ")}`,
          "error",
        );
      } else if (parts.length > 0) {
        toast(parts.join(". "), "success");
      }
      if (created.errors.length === 0) chooseFile(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  }

  const remaining = Math.max(0, existingItems.length - EXISTING_PREVIEW_LIMIT);
  const preview = existingItems.slice(0, EXISTING_PREVIEW_LIMIT);

  return (
    <Card>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ink">
              Upload spreadsheet
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Accepts Excel (.xlsx / .xls) and CSV. Y appends quantity and
              replaces the price, unless the price is 0. R replaces quantity and
              price. N adds a new item. A price of 0 leaves the current price
              unchanged.
            </p>
          </div>
          <SecondaryButton type="button" onClick={downloadTemplate}>
            Download CSV template
          </SecondaryButton>
        </div>

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            chooseFile(e.dataTransfer.files[0] ?? null);
          }}
          className={`flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-6 text-center ${
            dragOver
              ? "border-brand bg-brand/10"
              : "border-line bg-[#f7f5f0] hover:border-brand"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            disabled={uploading}
            onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
          />
          <Upload className="mb-2 h-6 w-6 text-slate-500" strokeWidth={1.75} />
          <span className="text-sm font-medium text-ink">
            {file ? file.name : "Drop a .xlsx or .csv file here"}
          </span>
          <span className="mt-1 text-xs text-slate-500">
            {file
              ? `${Math.max(1, Math.round(file.size / 1024))} KB`
              : "or click to choose a file"}
          </span>
        </label>

        {existingItems.length > 0 ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            <p className="font-semibold">
              {existingItems.length === 1
                ? "This item already exists"
                : `${existingItems.length} items already exist`}
            </p>
            <p className="mt-1">
              {newRows.length > 0
                ? `${newRows.length} new item${newRows.length === 1 ? "" : "s"} can still be added. Existing items will not be created again.`
                : "No new products will be added."}
            </p>
            <ul className="mt-3 max-h-48 space-y-1 overflow-auto text-sm">
              {preview.map((item) => (
                <li key={item.itemRef}>{existingItemLabel(item)}</li>
              ))}
            </ul>
            {remaining > 0 ? (
              <p className="mt-2 text-xs">and {remaining} more</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <SecondaryButton
                type="button"
                disabled={uploading}
                onClick={() => void finishUpload({ updateExisting: false })}
              >
                {newRows.length > 0
                  ? `Continue with ${newRows.length} new item${newRows.length === 1 ? "" : "s"}`
                  : "Keep existing only"}
              </SecondaryButton>
              <PrimaryButton
                type="button"
                disabled={uploading}
                onClick={() => void finishUpload({ updateExisting: true })}
              >
                Update existing quantities
              </PrimaryButton>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {file ? (
            <SecondaryButton
              type="button"
              disabled={uploading}
              onClick={() => chooseFile(null)}
            >
              Clear
            </SecondaryButton>
          ) : null}
          <PrimaryButton
            type="submit"
            disabled={uploading || !file || existingItems.length > 0}
          >
            {uploading ? "Checking…" : "Upload file"}
          </PrimaryButton>
        </div>
      </form>
    </Card>
  );
}
