import type { ProductArtworkFile } from "./types";

export const MAX_ARTWORK_FILES = 5;
export const MAX_ARTWORK_BYTES = 25 * 1024 * 1024;

const ARTWORK_EXTENSIONS = new Set([
  "pdf",
  "ai",
  "eps",
  "zip",
  "jpg",
  "jpeg",
  "png",
  "webp",
]);

export function artworkFileError(file: {
  name: string;
  size: number;
}): string | null {
  const ext = file.name.toLowerCase().split(".").pop() || "";
  if (!file.name.includes(".") || !ARTWORK_EXTENSIONS.has(ext)) {
    return "Upload a PDF, AI, EPS, ZIP, JPEG, PNG, or WebP file";
  }
  if (!Number.isFinite(file.size) || file.size <= 0) return "Artwork file is empty";
  if (file.size > MAX_ARTWORK_BYTES) return "Artwork must be 25 MB or smaller";
  return null;
}

export function isArtworkImage(file: { fileName?: string; contentType?: string }) {
  const type = String(file.contentType || "").toLowerCase();
  if (type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp)$/i.test(String(file.fileName || ""));
}

export function normalizeArtwork(value: unknown): ProductArtworkFile[] {
  if (!Array.isArray(value)) return [];
  const files: ProductArtworkFile[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const fileName = String(row.fileName || "").trim();
    const rawUrl = typeof row.url === "string" ? row.url.trim() : "";
    const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : "";
    if (!fileName && !url) continue;
    files.push({
      fileName: fileName || "Artwork",
      contentType: String(row.contentType || ""),
      size: Number(row.size) || 0,
      url,
    });
    if (files.length >= MAX_ARTWORK_FILES) break;
  }
  return files;
}

export function formatArtworkSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
