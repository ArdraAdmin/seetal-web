import {
  addVehicleMaintenanceRecord,
  getVehicleMaintenanceList,
  isVehicleStoreUnconfigured,
  requireVehicleUser,
} from "@/lib/server/vehicles";
import { deleteVehicleFiles, saveVehicleFile } from "@/lib/server/vehicle-files";
import { formText, readInvoiceUpload } from "@/lib/server/vehicle-uploads";
import { parseMaintenanceFields } from "@/lib/vehicle-records";

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

export async function GET(req: Request) {
  try {
    requireVehicleUser(
      req.headers.get("authorization") || req.headers.get("Authorization"),
    );
    const vehicleId = new URL(req.url).searchParams.get("vehicleId");
    const maintenance = await getVehicleMaintenanceList(vehicleId);
    return json({ maintenance });
  } catch (error) {
    if (isVehicleStoreUnconfigured(error)) {
      return json({ maintenance: [] });
    }
    return errorResponse(error, "Unable to load maintenance");
  }
}

export async function POST(req: Request) {
  let uploaded: Awaited<ReturnType<typeof saveVehicleFile>> | null = null;
  try {
    requireVehicleUser(
      req.headers.get("authorization") || req.headers.get("Authorization"),
    );
    const form = await req.formData();
    const vehicleId = formText(form, "vehicleId");
    const fields = parseMaintenanceFields({
      title: formText(form, "title"),
      amount: formText(form, "amount"),
      description: formText(form, "description"),
      date: formText(form, "date"),
    });
    const invoice = await readInvoiceUpload(form.get("invoice"));
    uploaded = await saveVehicleFile({
      buffer: invoice.buffer,
      fileName: invoice.fileName,
      contentType: invoice.contentType,
      kind: "invoice",
      vehicleId,
    });
    const item = await addVehicleMaintenanceRecord({
      vehicleId,
      title: fields.title,
      amount: fields.amount,
      description: fields.description,
      date: fields.date,
      invoiceKey: uploaded,
      invoiceFileName: invoice.fileName,
      invoiceContentType: invoice.contentType,
    });
    return json(item, 201);
  } catch (error) {
    if (uploaded) {
      try {
        await deleteVehicleFiles([uploaded]);
      } catch {
        // Keep the original save error if cleanup also fails.
      }
    }
    if (isVehicleStoreUnconfigured(error)) {
      return json({ error: "Database is not configured" }, 503);
    }
    return errorResponse(error, "Unable to add maintenance");
  }
}
