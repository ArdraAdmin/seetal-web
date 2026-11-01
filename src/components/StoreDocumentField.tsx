"use client";

import { FieldLabel } from "@/components/ui";

export function StoreDocumentField({
  label,
  file,
  existingUrl,
  onViewExisting,
  required = false,
  hint = "PDF or image",
  onChange,
}: {
  label: string;
  file: File | null;
  existingUrl?: string;
  onViewExisting?: () => void;
  required?: boolean;
  hint?: string;
  onChange: (file: File | null) => void;
}) {
  const hasExisting = Boolean(existingUrl?.trim()) || Boolean(onViewExisting);
  return (
    <label className="block space-y-1.5 sm:col-span-2">
      <FieldLabel label={label} required={required} optional={!required} />
      <input
        type="file"
        required={required && !file && !hasExisting}
        accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
        onChange={(e) => onChange(e.target.files?.[0] || null)}
        className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-slate-200"
      />
      {file ? (
        <p className="text-xs text-slate-500">Selected: {file.name}</p>
      ) : hasExisting && onViewExisting ? (
        <button
          type="button"
          onClick={onViewExisting}
          className="text-xs font-medium text-brand-dark underline"
        >
          View current document
        </button>
      ) : hasExisting ? (
        <a
          href={existingUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium text-brand-dark underline"
        >
          View current document
        </a>
      ) : (
        <p className="text-xs text-slate-500">{hint}</p>
      )}
    </label>
  );
}
