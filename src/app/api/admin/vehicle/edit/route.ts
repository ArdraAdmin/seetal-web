import {
  isVehicleStoreUnconfigured,
  parseVehicleExtras,
  proxyVehicleMutation,
  requireVehicleUser,
  updateVehicleDocuments,
  updateVehicleExtras,
  updateVehiclePhotos,
  updateVehicleRecord,
} from "@/lib/server/vehicles";
import { deleteVehicleFiles, saveFleetPhoto, saveVehicleFile } from "@/lib/server/vehicle-files";
import {
  formIdList,
  formText,
  readDocumentUploads,
  readPhotoUploads,
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
  const uploadedDocuments: string[] = [];
  const uploadedPhotos: string[] = [];
  let documentsSaved = false;
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
    const photoUploads = await readPhotoUploads(form);
    const removeIds = formIdList(form, "removeDocumentId");
    const removePhotoIds = formIdList(form, "removePhotoId");
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
      uploadedDocuments.push(key);
      documents.push({
        name: upload.name,
        fileName: upload.fileName,
        contentType: upload.contentType,
        key,
      });
    }
    const photos = [];
    for (const upload of photoUploads) {
      const key = await saveFleetPhoto({
        buffer: upload.buffer,
        fileName: upload.fileName,
        contentType: upload.contentType,
        ownerId: vehicleId,
      });
      uploadedPhotos.push(key);
      photos.push({
        fileName: upload.fileName,
        contentType: upload.contentType,
        key,
      });
    }
    const removed = await updateVehicleDocuments(vehicleId, {
      add: documents,
      removeIds,
    });
    documentsSaved = true;
    const removedPhotos = await updateVehiclePhotos(vehicleId, {
      add: photos,
      removeIds: removePhotoIds,
    });
    await deleteVehicleFiles([...removed, ...removedPhotos]);
    return new Response("Done", { status: 200 });
  } catch (error) {
    try {
      await deleteVehicleFiles(
        documentsSaved ? uploadedPhotos : [...uploadedDocuments, ...uploadedPhotos],
      );
    } catch {
      // Keep the original save error if cleanup also fails.
    }
    if (isVehicleStoreUnconfigured(error)) {
      return new Response("Database is not configured", { status: 503 });
    }
    return errorResponse(error);
  }
}
