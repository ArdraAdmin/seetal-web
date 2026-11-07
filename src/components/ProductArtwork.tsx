"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FileText, Trash2 } from "lucide-react";
import { deleteProductArtwork, uploadProductArtwork } from "@/lib/api";
import {
  MAX_ARTWORK_FILES,
  artworkFileError,
  formatArtworkSize,
  isArtworkImage,
  normalizeArtwork,
} from "@/lib/product-artwork";
import type { ProductArtworkFile } from "@/lib/types";
import { useToast } from "./Toast";

const ACCEPT =
  ".pdf,.ai,.eps,.zip,.jpg,.jpeg,.png,.webp,application/pdf,application/postscript,application/zip,image/jpeg,image/png,image/webp";

function ArtworkPreview({
  name,
  url,
  image,
}: {
  name: string;
  url: string;
  image: boolean;
}) {
  if (image && url) {
    return (
      // Signed artwork URLs are temporary, so the optimizer cannot cache them.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        className="h-16 w-16 shrink-0 rounded-lg border border-line object-cover"
      />
    );
  }
  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-line bg-[#f7f5f0] text-slate-400">
      <FileText className="h-6 w-6" />
    </div>
  );
}

export function ProductArtworkGallery({
  artwork,
}: {
  artwork?: unknown;
}) {
  const files = normalizeArtwork(artwork);
  if (files.length === 0) {
    return <p className="text-sm text-slate-500">No artwork for this product.</p>;
  }
  return (
    <ul className="space-y-2">
      {files.map((file, index) => {
        const image = isArtworkImage(file);
        const size = formatArtworkSize(file.size);
        return (
          <li
            key={`${file.fileName}-${index}`}
            className="flex items-center gap-3 rounded-lg border border-line bg-white p-2"
          >
            <ArtworkPreview name={file.fileName} url={file.url} image={image} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{file.fileName}</p>
              {size ? <p className="text-xs text-slate-500">{size}</p> : null}
            </div>
            {file.url ? (
              <a
                href={file.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-[#f7f5f0]"
              >
                Open
              </a>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function ProductArtworkField({
  artwork,
  productId,
  onChange,
  onPendingFiles,
}: {
  artwork?: unknown;
  productId?: string;
  onChange?: (artwork: ProductArtworkFile[]) => void;
  onPendingFiles?: (files: File[]) => void;
}) {
  const inputId = useId();
  const { toast } = useToast();
  const saved = normalizeArtwork(artwork);
  const [pending, setPendingState] = useState<{ file: File; previewUrl: string }[]>([]);
  const pendingRef = useRef(pending);
  const [busy, setBusy] = useState(false);
  const displayedCount = productId ? saved.length : pending.length;
  const remaining = MAX_ARTWORK_FILES - displayedCount;

  useEffect(() => {
    return () => {
      for (const item of pendingRef.current) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, []);

  function setPending(nextFiles: File[]) {
    setPendingState((current) => {
      for (const item of current) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
      const next = nextFiles.map((file) => ({
        file,
        previewUrl: isArtworkImage({ fileName: file.name, contentType: file.type })
          ? URL.createObjectURL(file)
          : "",
      }));
      pendingRef.current = next;
      return next;
    });
    onPendingFiles?.(nextFiles);
  }

  function chooseFiles(list: FileList | File[] | null) {
    if (!list) return;
    const incoming = Array.from(list);
    if (incoming.length === 0) return;
    const room = productId
      ? MAX_ARTWORK_FILES - saved.length
      : MAX_ARTWORK_FILES - pending.length;
    if (room <= 0) {
      toast("Maximum of 5 artwork files per product", "error");
      return;
    }
    const selected: File[] = [];
    for (const file of incoming.slice(0, room)) {
      const error = artworkFileError(file);
      if (error) {
        toast(error, "error");
        continue;
      }
      selected.push(file);
    }
    if (selected.length === 0) return;
    if (incoming.length > room) {
      toast("Maximum of 5 artwork files per product", "error");
    }
    if (productId) {
      void uploadFiles(selected);
      return;
    }
    setPending([...pending.map((item) => item.file), ...selected]);
  }

  async function uploadFiles(files: File[]) {
    if (!productId) return;
    setBusy(true);
    try {
      let last: ProductArtworkFile[] = saved;
      for (const file of files) {
        const savedArtwork = await uploadProductArtwork(productId, file);
        last = savedArtwork.artwork;
      }
      onChange?.(last);
      toast(
        files.length === 1 ? "Artwork saved" : "Artwork files saved",
        "success",
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Artwork upload failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function removeSaved(index: number) {
    const file = saved[index];
    if (!file || !productId) return;
    if (!confirm(`Remove ${file.fileName}?`)) return;
    setBusy(true);
    try {
      const savedArtwork = await deleteProductArtwork(productId, index);
      onChange?.(savedArtwork.artwork);
      toast("Artwork removed", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not remove artwork", "error");
    } finally {
      setBusy(false);
    }
  }

  const rows = productId
    ? saved.map((file) => ({
        key: `${file.fileName}-${file.url}`,
        name: file.fileName,
        size: file.size,
        url: file.url,
        image: isArtworkImage(file),
      }))
    : pending.map((item) => ({
        key: item.previewUrl || item.file.name,
        name: item.file.name,
        size: item.file.size,
        url: item.previewUrl,
        image: Boolean(item.previewUrl),
      }));

  return (
    <div className="space-y-3 rounded-lg border border-line bg-white p-4 sm:col-span-2 lg:col-span-3">
      <div className="space-y-1">
        <label htmlFor={inputId} className="block text-[13px] font-medium text-slate-700">
          Artwork
        </label>
        <p className="text-xs text-slate-500">
          Up to 5 design files, separate from product photos. PDF, AI, EPS, ZIP,
          JPEG, PNG, or WebP, 25 MB each. Artwork is not used as the catalog
          thumbnail.
        </p>
      </div>
      {rows.length > 0 ? (
        <ul className="space-y-2">
          {rows.map((row, index) => (
            <li
              key={`${row.key}-${index}`}
              className="flex items-center gap-3 rounded-lg border border-line p-2"
            >
              <ArtworkPreview name={row.name} url={row.url} image={row.image} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{row.name}</p>
                {formatArtworkSize(row.size) ? (
                  <p className="text-xs text-slate-500">{formatArtworkSize(row.size)}</p>
                ) : null}
              </div>
              {productId && saved[index]?.url ? (
                <a
                  href={saved[index].url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-[#f7f5f0]"
                >
                  Open
                </a>
              ) : null}
              <button
                type="button"
                className="rounded border border-line bg-white p-1.5 text-red-700 hover:bg-red-50 disabled:opacity-40"
                disabled={busy}
                aria-label={`Remove ${row.name}`}
                onClick={() => {
                  if (!productId) {
                    setPending(
                      pending
                        .filter((_, itemIndex) => itemIndex !== index)
                        .map((item) => item.file),
                    );
                    return;
                  }
                  void removeSaved(index);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">No artwork added yet.</p>
      )}
      {remaining > 0 ? (
        <label
          htmlFor={inputId}
          className="inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-dashed border-line bg-[#f7f5f0] px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white"
        >
          {busy ? "Uploading…" : `Add artwork (${displayedCount}/5)`}
        </label>
      ) : (
        <p className="text-xs text-slate-500">This product already has 5 artwork files.</p>
      )}
      <input
        id={inputId}
        type="file"
        accept={ACCEPT}
        multiple
        disabled={busy || remaining <= 0}
        className="sr-only"
        onChange={(event) => {
          chooseFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
