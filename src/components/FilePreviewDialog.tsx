"use client";

import { SecondaryButton } from "@/components/ui";

export function FilePreviewDialog({
  preview,
  onClose,
}: {
  preview: { url: string; name: string; type: string };
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={preview.name}
      onClick={onClose}
    >
      <div
        className="flex h-[min(90vh,840px)] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <p className="min-w-0 truncate text-sm font-medium text-ink">
            {preview.name}
          </p>
          <SecondaryButton type="button" onClick={onClose}>
            Close
          </SecondaryButton>
        </div>
        <div className="min-h-0 flex-1 bg-slate-100">
          {preview.type.startsWith("image/") ? (
            <img
              src={preview.url}
              alt={preview.name}
              className="mx-auto h-full max-w-full object-contain"
            />
          ) : (
            <iframe
              title={preview.name}
              src={preview.url}
              className="h-full w-full bg-white"
            />
          )}
        </div>
      </div>
    </div>
  );
}
