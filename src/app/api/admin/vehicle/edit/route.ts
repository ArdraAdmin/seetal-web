import {
  isVehicleStoreUnconfigured,
  parseVehicleExtras,
  proxyVehicleMutation,
  requireVehicleUser,
  updateVehicleDocuments,
  updateVehicleExtras,
  updateVehicleRecord,
} from "@/lib/server/vehicles";
import { deleteVehicleFiles, saveVehicleFile } from "@/lib/server/vehicle-files";
import {
  formIdList,
  formText,
  readDocumentUploads,
} from "@/lib/server/vehicle-uploads";

export const runtime = "nodejs";

function errorResponse(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Unable to update vehicle";
  const status = message === "Not signed in" ? 401 : 400;
  return new Response(message, { status });
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return saveJson(req);
  }
  return saveForm(req);
}

async function saveJson(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;
  const vehicleId = body.vehicleId;
  const vehicleNumber = body.vehicleNumber;
  try {
    requireVehicleUser(
      req.headers.get("authorization") || req.headers.get("Authorization"),
    );
    const extras = parseVehicleExtras({ ...body, vehicleNumber });
    await updateVehicleRecord(vehicleId, vehicleNumber);
    await updateVehicleExtras(vehicleId, extras);
    return new Response("Done", { status: 200 });
  } catch (error) {
    if (isVehicleStoreUnconfigured(error)) {
      return proxyVehicleMutation("/admin/vehicle/edit", req, {
        vehicleId,
        vehicleNumber,
      });
    }
    return errorResponse(error);
  }
}

async function saveForm(req: Request) {
  const uploaded: string[] = [];
  try {
    requireVehicleUser(
      req.headers.get("authorization") || req.headers.get("Authorization"),
    );
    const form = await req.formData();
    const vehicleId = formText(form, "vehicleId");
    const vehicleNumber = formText(form, "vehicleNumber");
    const extras = parseVehicleExtras({
      vehicleNumber,
      purchaseYear: formText(form, "purchaseYear"),
      price: formText(form, "price"),
      purchaseFrom: formText(form, "purchaseFrom"),
      mulkyaExpiry: formText(form, "mulkyaExpiry"),
      insurancePremium: formText(form, "insurancePremium"),
    });
    const uploads = await readDocumentUploads(form);
    const removeIds = formIdList(form, "removeDocumentId");
    await updateVehicleRecord(vehicleId, vehicleNumber);
    await updateVehicleExtras(vehicleId, extras);
    const documents = [];
    for (const upload of uploads) {
      const key = await saveVehicleFile({
        buffer: upload.buffer,
        fileName: upload.fileName,
        contentType: upload.contentType,
        kind: "document",
        vehicleId,
      });
      uploaded.push(key);
      documents.push({
        name: upload.name,
        fileName: upload.fileName,
        contentType: upload.contentType,
        key,
      });
    }
    const removed = await updateVehicleDocuments(vehicleId, {
      add: documents,
      removeIds,
    });
    await deleteVehicleFiles(removed);
    return new Response("Done", { status: 200 });
  } catch (error) {
    try {
      await deleteVehicleFiles(uploaded);
    } catch {
      // Keep the original save error if cleanup also fails.
    }
    if (isVehicleStoreUnconfigured(error)) {
      return new Response("Database is not configured", { status: 503 });
    }
    return errorResponse(error);
  }
}
