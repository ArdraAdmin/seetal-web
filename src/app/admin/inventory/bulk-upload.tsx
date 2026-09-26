"use client";

import { FormEvent, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { uploadInventoryFile } from "@/lib/api";
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
  "Add",
];

function isSpreadsheet(file: File) {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls")
  );
}

function downloadTemplate() {
  const sample = [
    TEMPLATE_HEADERS.join(","),
    "SAMPLE-001,Sample item,PCS,10,1,FOOD,SNACKS,0,N",
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

  function chooseFile(next: File | null) {
    if (next && !isSpreadsheet(next)) {
      toast("Use a .xlsx, .xls, or .csv file", "info");
      return;
    }
    setFile(next);
    if (!next && inputRef.current) inputRef.current.value = "";
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      toast("Choose a .xlsx or .csv file first", "info");
      return;
    }
    setUploading(true);
    try {
      const message = await uploadInventoryFile(file);
      toast(message, "success");
      chooseFile(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ink">
              Upload spreadsheet
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Accepts Excel (.xlsx / .xls) and CSV. Required columns: Item Ref,
              Item Details, Unit, SP, PCS/CTNS, MASTER CATEGORY, SUB CATEGORY,
              Cl. Qty. Use Add = Y to increase stock on an existing item.
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
          <PrimaryButton type="submit" disabled={uploading || !file}>
            {uploading ? "Uploading…" : "Upload file"}
          </PrimaryButton>
        </div>
      </form>
    </Card>
  );
}
