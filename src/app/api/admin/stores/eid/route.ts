import { contentTypeForFile } from "@/lib/vehicle-records";
import { storeEidFileError } from "@/lib/store-eid";
import {
  isStoreDbUnconfigured,
  readStoreEidFile,
  saveStoreEid,
  storeError,
} from "@/lib/server/stores";

export const runtime = "nodejs";

function authHeader(req: Request) {
  return req.headers.get("authorization") || req.headers.get("Authorization");
}

function safeFileName(name: string) {
  const base = name.split(/[/\\]/).pop() || "eid-document";
  const cleaned = base.replace(/[^\w.\- ()]+/g, "_").slice(0, 180);
  return cleaned || "eid-document";
}

export async function GET(req: Request) {
  const storeId = new URL(req.url).searchParams.get("storeId");
  try {
    const file = await readStoreEidFile(authHeader(req), storeId);
    const fileName = safeFileName(file.fileName);
    return new Response(new Uint8Array(file.bytes), {
      status: 200,
      headers: {
        "Content-Type": file.contentType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${fileName.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (isStoreDbUnconfigured(error)) {
      return new Response("Database is not configured", { status: 503 });
    }
    const message = error instanceof Error ? error.message : "Unable to download file";
    if (message === "File not found" || message === "Store not found") {
      return new Response(message, { status: 404 });
    }
    return storeError(error);
  }
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const storeId = form.get("storeId");
    const eidNumber = form.get("eidNumber");
    const isTemp = form.get("isTemp") === "true";
    const entry = form.get("eidDocument");
    let file: {
      buffer: Buffer;
      fileName: string;
      contentType: string;
    } | null = null;
    if (entry instanceof File && entry.size > 0) {
      const error = storeEidFileError({
        name: entry.name || "document",
        type: entry.type || "",
        size: entry.size,
      });
      if (error) throw new Error(error);
      const fileName = safeFileName(entry.name || "eid-document");
      file = {
        buffer: Buffer.from(await entry.arrayBuffer()),
        fileName,
        contentType: contentTypeForFile(entry.type || "", fileName),
      };
    }
    await saveStoreEid(authHeader(req), {
      storeId,
      eidNumber: typeof eidNumber === "string" ? eidNumber : "",
      isTemp,
      file,
    });
    return Response.json({ ok: true });
  } catch (error) {
    if (isStoreDbUnconfigured(error)) {
      return new Response("Database is not configured", { status: 503 });
    }
    return storeError(error);
  }
}
