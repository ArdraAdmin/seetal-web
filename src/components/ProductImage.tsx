"use client";

import { useEffect, useId, useState } from "react";
import { uploadProductImage } from "@/lib/api";
import { productImageFileError, productImageUrl } from "@/lib/product-image";
import { useToast } from "./Toast";
import { SecondaryButton } from "./ui";

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

export function ProductImageField({
  itemName,
  imagePath,
  productId,
  onUploaded,
  onPendingFile,
}: {
  itemName: string;
  imagePath?: unknown;
  productId?: string;
  onUploaded?: (url: string) => void;
  onPendingFile?: (file: File | null) => void;
}) {
  const inputId = useId();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const current = uploadedUrl || previewUrl || productImageUrl(imagePath);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function chooseFile(next: File | null) {
    if (!next) {
      setFile(null);
      setPreviewUrl("");
      onPendingFile?.(null);
      return;
    }
    const error = productImageFileError(next);
    if (error) {
      toast(error, "error");
      return;
    }
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
    onPendingFile?.(next);
  }

  async function onUpload() {
    if (!productId || !file) return;
    setUploading(true);
    try {
      const saved = await uploadProductImage(productId, file);
      setUploadedUrl(saved.imagePath);
      setFile(null);
      setPreviewUrl("");
      onUploaded?.(saved.imagePath);
      toast("Product image saved", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Image upload failed", "error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3 sm:col-span-2 lg:col-span-3">
      <div className="flex items-start gap-3">
        <ProductThumb
          imagePath={current}
          name={itemName || "Product"}
          className="h-20 w-20"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <label htmlFor={inputId} className="block text-[13px] font-medium text-slate-700">
            Product image
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700"
            onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
          />
          <p className="text-xs text-slate-500">
            {productId
              ? "JPEG, PNG, or WebP up to 8 MB. Uploading replaces the current product image."
              : "JPEG, PNG, or WebP up to 8 MB. The image is saved when the product is created."}
          </p>
          {productId ? (
            <SecondaryButton
              type="button"
              disabled={!file || uploading}
              onClick={() => void onUpload()}
            >
              {uploading ? "Uploading…" : "Upload image"}
            </SecondaryButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}
