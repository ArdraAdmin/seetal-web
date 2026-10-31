export const MAX_PRODUCT_IMAGES = 5;

export function productImageUrl(imagePath: unknown): string {
  if (Array.isArray(imagePath)) {
    return productImageUrl(imagePath[0]);
  }
  if (typeof imagePath === "string" && /^https?:\/\//i.test(imagePath.trim())) {
    return imagePath.trim();
  }
  return "";
}

export function productImageUrls(imagePath: unknown): string[] {
  if (Array.isArray(imagePath)) {
    return imagePath
      .slice(0, MAX_PRODUCT_IMAGES)
      .map((item) => productImageUrl(item))
      .filter((url) => url.length > 0);
  }
  const url = productImageUrl(imagePath);
  return url ? [url] : [];
}

export function remainingProductImageSlots(imagePath: unknown): number {
  return Math.max(0, MAX_PRODUCT_IMAGES - productImageUrls(imagePath).length);
}

export function productBelongsToCompany(
  company: unknown,
  companyId: string,
): boolean {
  const id = companyId.trim();
  if (!id) return false;
  if (typeof company === "string") return company === id;
  if (company && typeof company === "object" && "_id" in company) {
    return String((company as { _id?: unknown })._id ?? "") === id;
  }
  return false;
}

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function productImageFileError(file: File): string | null {
  const name = file.name.toLowerCase();
  const typeOk = IMAGE_TYPES.has(file.type) || !file.type;
  const nameOk = /\.(jpe?g|png|webp)$/.test(name);
  if (!typeOk && !nameOk) return "Upload a JPEG, PNG, or WebP image";
  if (file.size > 8 * 1024 * 1024) return "Image must be 8 MB or smaller";
  return null;
}
