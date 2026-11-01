import {
  assertVehicleNumberAvailable,
  createVehicleRecord,
  isVehicleStoreUnconfigured,
  parseVehicleExtras,
  requireVehicleUser,
} from "@/lib/server/vehicles";
import { deleteVehicleFiles, saveVehicleFile } from "@/lib/server/vehicle-files";
import { formText, readDocumentUploads } from "@/lib/server/vehicle-uploads";

export const runtime = "nodejs";

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function errorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status =
    message === "Not signed in"
      ? 401
      : message === "Database is not configured"
        ? 503
        : 400;
  return json({ error: message }, status);
}

export async function POST(req: Request) {
  const uploaded: string[] = [];
  try {
    requireVehicleUser(
      req.headers.get("authorization") || req.headers.get("Authorization"),
    );
    const form = await req.formData();
    const fields = parseVehicleExtras({
      vehicleNumber: formText(form, "vehicleNumber"),
      purchaseYear: formText(form, "purchaseYear"),
      price: formText(form, "price"),
      purchaseFrom: formText(form, "purchaseFrom"),
      mulkyaExpiry: formText(form, "mulkyaExpiry"),
      insurancePremium: formText(form, "insurancePremium"),
    });
    const vehicleNumber = await assertVehicleNumberAvailable(
      formText(form, "vehicleNumber"),
    );
    const uploads = await readDocumentUploads(form);
    const documents = [];
    for (const upload of uploads) {
      const key = await saveVehicleFile({
        buffer: upload.buffer,
        fileName: upload.fileName,
        contentType: upload.contentType,
        kind: "document",
      });
      uploaded.push(key);
      documents.push({
        name: upload.name,
        fileName: upload.fileName,
        contentType: upload.contentType,
        key,
      });
    }
    const id = await createVehicleRecord({
      vehicleNumber,
      extras: fields,
      documents,
    });
    return json({ id }, 201);
  } catch (error) {
    try {
      await deleteVehicleFiles(uploaded);
    } catch {
      // Keep the original save error if cleanup also fails.
    }
    if (isVehicleStoreUnconfigured(error)) {
      return json({ error: "Database is not configured" }, 503);
    }
    return errorResponse(error, "Unable to add vehicle");
  }
}
