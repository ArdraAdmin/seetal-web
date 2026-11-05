"use client";

import { FieldLabel, SecondaryButton } from "@/components/ui";
import type { FleetPhoto } from "@/lib/types";
import { PHOTO_FILE_ACCEPT } from "@/lib/vehicle-records";

export type PhotoDraft = {
  key: string;
  file: File;
};

const fileInputClass =
  "block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-slate-200";

export function photoDrafts(rows: PhotoDraft[]) {
  return rows.map((row) => ({
    name: row.file.name,
    type: row.file.type,
    size: row.file.size,
  }));
}

export function selectedPhotoFiles(rows: PhotoDraft[]) {
  return rows.map((row) => row.file);
}

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function PhotoFields({
  files,
  saved = [],
  removed = [],
  disabled,
  onChangeFiles,
  onRemoveSaved,
  onRestoreSaved,
  onDownload,
  onView,
}: {
  files: PhotoDraft[];
  saved?: FleetPhoto[];
  removed?: FleetPhoto[];
  disabled?: boolean;
  onChangeFiles: (files: PhotoDraft[]) => void;
  onRemoveSaved?: (id: string) => void;
  onRestoreSaved?: (id: string) => void;
  onDownload?: (fileId: string, fileName: string) => void;
  onView?: (fileId: string, fileName: string) => void;
}) {
  return (
    <div className="space-y-3 sm:col-span-2">
      <div>
        <FieldLabel label="Photographs" optional />
        <p className="mt-1 text-xs text-slate-500">
          Optional. Add one or more images. JPEG, PNG, or WebP, up to 10 MB each.
        </p>
      </div>

      {saved.map((photo) => (
        <div
          key={photo._id}
          className="flex flex-col gap-2 rounded-lg border border-line px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="min-w-0 truncate text-sm font-medium text-ink">
            {photo.fileName}
          </p>
          <div className="flex flex-wrap gap-2">
            <SecondaryButton
              type="button"
              disabled={disabled}
              onClick={() => onView?.(photo.fileId, photo.fileName)}
            >
              View
            </SecondaryButton>
            <SecondaryButton
              type="button"
              disabled={disabled}
              onClick={() => onDownload?.(photo.fileId, photo.fileName)}
            >
              Download
            </SecondaryButton>
            <SecondaryButton
              type="button"
              disabled={disabled}
              onClick={() => onRemoveSaved?.(photo._id)}
            >
              Remove
            </SecondaryButton>
          </div>
        </div>
      ))}

      {removed.map((photo) => (
        <div
          key={photo._id}
          className="flex flex-col gap-2 rounded-lg border border-dashed border-line px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-slate-500">
            {photo.fileName} will be removed when you save.
          </p>
          <SecondaryButton
            type="button"
            disabled={disabled}
            onClick={() => onRestoreSaved?.(photo._id)}
          >
            Undo
          </SecondaryButton>
        </div>
      ))}

      {files.map((row) => (
        <div
          key={row.key}
          className="flex flex-col gap-2 rounded-lg border border-line px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="min-w-0 truncate text-sm text-ink">{row.file.name}</p>
          <SecondaryButton
            type="button"
            disabled={disabled}
            onClick={() => onChangeFiles(files.filter((item) => item.key !== row.key))}
          >
            Remove
          </SecondaryButton>
        </div>
      ))}

      <label className="block space-y-1.5">
        <FieldLabel label="Add photographs" optional />
        <input
          type="file"
          multiple
          disabled={disabled}
          accept={PHOTO_FILE_ACCEPT}
          onChange={(event) => {
            const selected = Array.from(event.target.files ?? []);
            if (selected.length > 0) {
              onChangeFiles([
                ...files,
                ...selected.map((file) => ({ key: newKey(), file })),
              ]);
            }
            event.target.value = "";
          }}
          className={fileInputClass}
        />
      </label>
    </div>
  );
}
