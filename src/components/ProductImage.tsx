"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Star, Trash2 } from "lucide-react";
import {
  deleteProductImage,
  reorderProductImages,
  uploadProductImage,
} from "@/lib/api";
import {
  MAX_PRODUCT_IMAGES,
  productImageFileError,
  productImageUrl,
  productImageUrls,
} from "@/lib/product-image";
import { useToast } from "./Toast";

export function ProductThumb({
  imagePath,
  name,
  className = "h-16 w-16",
}: {
  imagePath?: unknown;
  name: string;
  className?: string;
}) {
  const url = productImageUrl(imagePath);
  if (!url) {
    return (
      <div
        className={`${className} flex shrink-0 items-center justify-center rounded-lg border border-line bg-[#f7f5f0] px-1 text-center text-[10px] font-medium text-slate-400`}
      >
        No image
      </div>
    );
  }
  return (
    // Signed product URLs are temporary, so the optimizer cannot cache them.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={name || "Product image"}
      className={`${className} shrink-0 rounded-lg border border-line object-cover`}
    />
  );
}

function acceptedImageFiles(list: FileList | File[]): File[] {
  return Array.from(list);
}

export function ProductImageField({
  itemName,
  imagePath,
  productId,
  onUploaded,
  onPendingFiles,
}: {
  itemName: string;
  imagePath?: unknown;
  productId?: string;
  onUploaded?: (imagePath: string | string[]) => void;
  onPendingFiles?: (files: File[]) => void;
}) {
  const inputId = useId();
  const { toast } = useToast();
  const savedUrls = productImageUrls(imagePath);
  const [pending, setPendingState] = useState<{ file: File; previewUrl: string }[]>(
    [],
  );
  const pendingRef = useRef(pending);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => {
      for (const item of pendingRef.current) URL.revokeObjectURL(item.previewUrl);
    };
  }, []);

  const displayed = productId ? savedUrls : pending.map((item) => item.previewUrl);
  const remaining = MAX_PRODUCT_IMAGES - displayed.length;

  function setPending(nextFiles: File[]) {
    setPendingState((current) => {
      for (const item of current) URL.revokeObjectURL(item.previewUrl);
      const next = nextFiles.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      pendingRef.current = next;
      return next;
    });
    onPendingFiles?.(nextFiles);
  }

  function chooseFiles(list: FileList | File[] | null) {
    if (!list) return;
    const incoming = acceptedImageFiles(list);
    if (incoming.length === 0) return;
    const room = productId
      ? MAX_PRODUCT_IMAGES - savedUrls.length
      : MAX_PRODUCT_IMAGES - pending.length;
    if (room <= 0) {
      toast("Maximum of 5 images per product", "error");
      return;
    }
    const selected: File[] = [];
    for (const file of incoming.slice(0, room)) {
      const error = productImageFileError(file);
      if (error) {
        toast(error, "error");
        continue;
      }
      selected.push(file);
    }
    if (selected.length === 0) return;
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
      let lastPath: string | string[] | undefined;
      for (const file of files) {
        const saved = await uploadProductImage(productId, file);
        lastPath = saved.imagePath;
      }
      if (lastPath !== undefined) onUploaded?.(lastPath);
      toast(
        files.length === 1 ? "Product image saved" : "Product images saved",
        "success",
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Image upload failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function move(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    if (!productId) {
      const next = pending.map((item) => item.file);
      const [moved] = next.splice(fromIndex, 1);
      if (!moved) return;
      next.splice(toIndex, 0, moved);
      setPending(next);
      return;
    }
    setBusy(true);
    try {
      const saved = await reorderProductImages(productId, fromIndex, toIndex);
      onUploaded?.(saved.imagePath);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not reorder images", "error");
    } finally {
      setBusy(false);
    }
  }

  async function removeAt(index: number) {
    const label = index === 0 ? "the thumbnail image" : `image ${index + 1}`;
    if (!confirm(`Remove ${label}?`)) return;
    if (!productId) {
      setPending(pending.filter((_, itemIndex) => itemIndex !== index).map((item) => item.file));
      return;
    }
    setBusy(true);
    try {
      const saved = await deleteProductImage(productId, index);
      onUploaded?.(saved.imagePath);
      toast("Image removed", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not remove image", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 sm:col-span-2 lg:col-span-3">
      <div className="space-y-1">
        <label htmlFor={inputId} className="block text-[13px] font-medium text-slate-700">
          Product images
        </label>
        <p className="text-xs text-slate-500">
          Up to 5 JPEG, PNG, or WebP files, 8 MB each. Image 1 is the thumbnail
          used in inventory lists and sales.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        {displayed.map((url, index) => (
          <div
            key={`${url}-${index}`}
            className="w-[7.5rem] space-y-2 rounded-lg border border-line bg-white p-2"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {index + 1}
                {index === 0 ? " · Thumbnail" : ""}
              </span>
            </div>
            <ProductThumb
              imagePath={url}
              name={`${itemName || "Product"} image ${index + 1}`}
              className="h-24 w-full"
            />
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                className="rounded border border-line bg-white p-1 text-slate-600 hover:bg-[#f7f5f0] disabled:opacity-40"
                disabled={busy || index === 0}
                aria-label={`Move image ${index + 1} earlier`}
                onClick={() => void move(index, index - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded border border-line bg-white p-1 text-slate-600 hover:bg-[#f7f5f0] disabled:opacity-40"
                disabled={busy || index === displayed.length - 1}
                aria-label={`Move image ${index + 1} later`}
                onClick={() => void move(index, index + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded border border-line bg-white p-1 text-slate-600 hover:bg-[#f7f5f0] disabled:opacity-40"
                disabled={busy || index === 0}
                aria-label={`Make image ${index + 1} the thumbnail`}
                onClick={() => void move(index, 0)}
              >
                <Star className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded border border-line bg-white p-1 text-red-700 hover:bg-red-50 disabled:opacity-40"
                disabled={busy}
                aria-label={`Remove image ${index + 1}`}
                onClick={() => void removeAt(index)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {remaining > 0 ? (
          <label
            htmlFor={inputId}
            className="flex h-[11.5rem] w-[7.5rem] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-line bg-[#f7f5f0] px-2 text-center text-xs font-medium text-slate-500 hover:bg-white"
          >
            {busy ? "Uploading…" : `Add image${remaining === 5 ? "" : ` (${displayed.length}/5)`}`}
          </label>
        ) : null}
      </div>
      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        multiple
        disabled={busy || remaining <= 0}
        className="sr-only"
        onChange={(event) => {
          chooseFiles(event.target.files);
          event.target.value = "";
        }}
      />
      {remaining <= 0 ? (
        <p className="text-xs text-slate-500">This product already has 5 images.</p>
      ) : null}
    </div>
  );
}
