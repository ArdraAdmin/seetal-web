import { ObjectId, type Collection } from "mongodb";
import { getMongoClient, isDatabaseNotConfigured } from "./mongo";
import { userIdFromAuthHeader } from "./password";
import {
  mulkyaAlertsFromVehicles,
  type ExpiryAlertRow,
} from "../expiry-window";
import type { VehicleDocument, VehicleExtras, VehicleMaintenance } from "../types";
import {
  MAX_VEHICLE_DOCUMENTS,
  parseMaintenanceFields,
  parseVehicleFields,
  parseVehicleNumber,
} from "../vehicle-records";
import { isVehicleObjectKey } from "../vehicle-records";
import { deleteVehicleFiles } from "./vehicle-files";

type StoredDocument = {
  _id: ObjectId;
  name: string;
  fileName: string;
  contentType: string;
  key: string;
  uploadedAt: Date;
};

type VehicleDoc = {
  _id: ObjectId;
  value: number;
  purchaseYear?: number | null;
  price?: number | null;
  purchaseFrom?: string | null;
  mulkyaExpiry?: string | null;
  insurancePremium?: number | null;
  documents?: StoredDocument[];
};

type MaintenanceDoc = {
  _id: ObjectId;
  vehicleId: ObjectId;
  title: string;
  amount: number;
  description: string;
  date: string;
  createdAt: Date;
  invoiceKey?: string;
  invoiceFileName?: string;
  invoiceContentType?: string;
};

async function vehicles(): Promise<Collection<VehicleDoc>> {
  const client = await getMongoClient();
  return client.db().collection<VehicleDoc>("vehicles");
}

async function maintenance(): Promise<Collection<MaintenanceDoc>> {
  const client = await getMongoClient();
  return client.db().collection<MaintenanceDoc>("vehicleMaintenance");
}

function asObjectId(id: unknown, label = "vehicle"): ObjectId {
  const value = String(id ?? "").trim();
  if (!ObjectId.isValid(value)) {
    throw new Error(`No ${label} found`);
  }
  return new ObjectId(value);
}

function asVehicleNumber(raw: unknown): number {
  return parseVehicleNumber(raw);
}

function asDocument(doc: StoredDocument): VehicleDocument {
  return {
    _id: String(doc._id),
    name: doc.name,
    fileName: doc.fileName,
    contentType: doc.contentType,
    fileId: String(doc._id),
    uploadedAt: doc.uploadedAt?.toISOString?.() ?? undefined,
  };
}

function documentsFrom(raw: unknown): VehicleDocument[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const doc = item as StoredDocument;
    if (!doc._id || !isVehicleObjectKey(String(doc.key || ""))) return [];
    return [asDocument(doc)];
  });
}

function extrasFromDoc(doc: VehicleDoc | null): VehicleExtras {
  if (!doc) {
    return {
      purchaseYear: null,
      price: null,
      purchaseFrom: null,
      mulkyaExpiry: null,
      insurancePremium: null,
      documents: [],
    };
  }
  return {
    purchaseYear: doc.purchaseYear ?? null,
    price: doc.price ?? null,
    purchaseFrom: doc.purchaseFrom ?? null,
    mulkyaExpiry: doc.mulkyaExpiry ?? null,
    insurancePremium: doc.insurancePremium ?? null,
    documents: documentsFrom(doc.documents),
  };
}

function asMaintenance(doc: MaintenanceDoc): VehicleMaintenance {
  return {
    _id: String(doc._id),
    vehicleId: String(doc.vehicleId),
    title: doc.title,
    amount: doc.amount,
    description: doc.description,
    date: doc.date,
    createdAt: doc.createdAt?.toISOString?.() ?? undefined,
    invoiceFileId: isVehicleObjectKey(String(doc.invoiceKey || ""))
      ? String(doc._id)
      : undefined,
    invoiceFileName: doc.invoiceFileName,
  };
}

function keysFromVehicle(doc: VehicleDoc | null): string[] {
  return (doc?.documents ?? [])
    .map((item) => item.key)
    .filter((key) => isVehicleObjectKey(String(key || "")));
}

export function requireVehicleUser(token: string | null): string {
  return userIdFromAuthHeader(token);
}

export function parseVehicleExtras(body: Record<string, unknown>): VehicleExtras {
  const parsed = parseVehicleFields({
    vehicleNumber: body.vehicleNumber ?? 0,
    purchaseYear: body.purchaseYear,
    price: body.price,
    purchaseFrom: body.purchaseFrom,
    mulkyaExpiry: body.mulkyaExpiry,
    insurancePremium: body.insurancePremium,
  });
  return {
    purchaseYear: parsed.purchaseYear,
    price: parsed.price,
    purchaseFrom: parsed.purchaseFrom,
    mulkyaExpiry: parsed.mulkyaExpiry,
    insurancePremium: parsed.insurancePremium,
  };
}

export async function updateVehicleRecord(
  vehicleId: unknown,
  vehicleNumber: unknown,
): Promise<void> {
  const id = asObjectId(vehicleId);
  const value = asVehicleNumber(vehicleNumber);
  const col = await vehicles();
  const existing = await col.findOne({ _id: id });
  if (!existing) throw new Error("No vehicle found");
  const duplicate = await col.findOne({ value, _id: { $ne: id } });
  if (duplicate) throw new Error("Vehicle number already exists");
  await col.updateOne({ _id: id }, { $set: { value } });
}

export async function updateVehicleExtras(
  vehicleId: unknown,
  extras: VehicleExtras,
): Promise<void> {
  const id = asObjectId(vehicleId);
  const col = await vehicles();
  const existing = await col.findOne({ _id: id });
  if (!existing) throw new Error("No vehicle found");
  await col.updateOne(
    { _id: id },
    {
      $set: {
        purchaseYear: extras.purchaseYear ?? null,
        price: extras.price ?? null,
        purchaseFrom: extras.purchaseFrom ?? null,
        mulkyaExpiry: extras.mulkyaExpiry ?? null,
        insurancePremium: extras.insurancePremium ?? null,
      },
    },
  );
}

function storedDocuments(
  docs: Array<{
    name: string;
    fileName: string;
    contentType: string;
    key: string;
  }>,
): StoredDocument[] {
  const uploadedAt = new Date();
  return docs.map((doc) => ({
    _id: new ObjectId(),
    name: doc.name,
    fileName: doc.fileName,
    contentType: doc.contentType,
    key: doc.key,
    uploadedAt,
  }));
}

export async function assertVehicleNumberAvailable(
  vehicleNumber: unknown,
  exceptId?: unknown,
): Promise<number> {
  const value = asVehicleNumber(vehicleNumber);
  const col = await vehicles();
  const except = exceptId ? asObjectId(exceptId) : null;
  const duplicate = await col.findOne(
    except ? { value, _id: { $ne: except } } : { value },
  );
  if (duplicate) throw new Error("Vehicle number already exists");
  return value;
}

export async function createVehicleRecord(input: {
  vehicleNumber: number;
  extras: VehicleExtras;
  documents: Array<{
    name: string;
    fileName: string;
    contentType: string;
    key: string;
  }>;
}): Promise<string> {
  if (input.documents.length > MAX_VEHICLE_DOCUMENTS) {
    throw new Error("A vehicle can have at most 20 documents");
  }
  const col = await vehicles();
  const duplicate = await col.findOne({ value: input.vehicleNumber });
  if (duplicate) throw new Error("Vehicle number already exists");
  const _id = new ObjectId();
  await col.insertOne({
    _id,
    value: input.vehicleNumber,
    purchaseYear: input.extras.purchaseYear ?? null,
    price: input.extras.price ?? null,
    purchaseFrom: input.extras.purchaseFrom ?? null,
    mulkyaExpiry: input.extras.mulkyaExpiry ?? null,
    insurancePremium: input.extras.insurancePremium ?? null,
    documents: storedDocuments(input.documents),
  });
  return String(_id);
}

export async function updateVehicleDocuments(
  vehicleId: unknown,
  change: {
    add: Array<{
      name: string;
      fileName: string;
      contentType: string;
      key: string;
    }>;
    removeIds: string[];
  },
): Promise<string[]> {
  const id = asObjectId(vehicleId);
  const col = await vehicles();
  const existing = await col.findOne({ _id: id });
  if (!existing) throw new Error("No vehicle found");
  const remove = new Set(change.removeIds.map((value) => value.trim()).filter(Boolean));
  const kept = (existing.documents ?? []).filter((doc) => !remove.has(String(doc._id)));
  const removedFiles = (existing.documents ?? [])
    .filter((doc) => remove.has(String(doc._id)))
    .map((doc) => doc.key);
  const next = [...kept, ...storedDocuments(change.add)];
  if (next.length > MAX_VEHICLE_DOCUMENTS) {
    throw new Error("A vehicle can have at most 20 documents");
  }
  await col.updateOne({ _id: id }, { $set: { documents: next } });
  return removedFiles;
}

export async function getLinkedVehicleFile(fileId: unknown): Promise<{
  key: string;
  fileName: string;
  contentType: string;
} | null> {
  const id = String(fileId ?? "").trim();
  if (!ObjectId.isValid(id)) return null;
  const objectId = new ObjectId(id);
  const vehicleCol = await vehicles();
  const vehicle = await vehicleCol.findOne(
    { "documents._id": objectId },
    { projection: { documents: 1 } },
  );
  const document = (vehicle?.documents ?? []).find(
    (item) => String(item._id) === id,
  );
  if (document && isVehicleObjectKey(String(document.key || ""))) {
    return {
      key: document.key,
      fileName: document.fileName,
      contentType: document.contentType || "application/octet-stream",
    };
  }
  const maintCol = await maintenance();
  const record = await maintCol.findOne(
    { _id: objectId },
    { projection: { invoiceKey: 1, invoiceFileName: 1, invoiceContentType: 1 } },
  );
  if (!record || !isVehicleObjectKey(String(record.invoiceKey || ""))) return null;
  return {
    key: String(record.invoiceKey),
    fileName: record.invoiceFileName || "invoice",
    contentType: record.invoiceContentType || "application/octet-stream",
  };
}

export async function deleteVehicleRecord(vehicleId: unknown): Promise<void> {
  const id = asObjectId(vehicleId);
  const col = await vehicles();
  const existing = await col.findOne({ _id: id });
  if (!existing) throw new Error("No vehicle found");
  const maint = await maintenance();
  const records = await maint.find({ vehicleId: id }).toArray();
  const fileIds = [
    ...keysFromVehicle(existing),
    ...records.flatMap((record) =>
      isVehicleObjectKey(String(record.invoiceKey || "")) ? [String(record.invoiceKey)] : [],
    ),
  ];
  await col.deleteOne({ _id: id });
  try {
    await maint.deleteMany({ vehicleId: id });
  } catch {
    // Maintenance cleanup is best-effort if the collection is unavailable.
  }
  await deleteVehicleFiles(fileIds);
}

export async function listMulkyaExpiringSoon(
  now = Date.now(),
): Promise<ExpiryAlertRow[]> {
  const col = await vehicles();
  const rows = await col
    .find(
      { mulkyaExpiry: { $exists: true, $nin: [null, ""] } },
      { projection: { value: 1, mulkyaExpiry: 1 } },
    )
    .toArray();
  return mulkyaAlertsFromVehicles(
    rows.map((row) => ({
      _id: String(row._id),
      value: row.value,
      mulkyaExpiry: row.mulkyaExpiry,
    })),
    now,
  );
}

export async function getVehicleExtrasMap(
  ids: unknown[],
): Promise<Record<string, VehicleExtras>> {
  const objectIds = ids
    .map((id) => String(id ?? "").trim())
    .filter((id) => ObjectId.isValid(id))
    .map((id) => new ObjectId(id));
  if (objectIds.length === 0) return {};
  const col = await vehicles();
  const rows = await col
    .find(
      { _id: { $in: objectIds } },
      {
        projection: {
          purchaseYear: 1,
          price: 1,
          purchaseFrom: 1,
          mulkyaExpiry: 1,
          insurancePremium: 1,
          documents: 1,
        },
      },
    )
    .toArray();
  const out: Record<string, VehicleExtras> = {};
  for (const row of rows) {
    out[String(row._id)] = extrasFromDoc(row);
  }
  return out;
}

export async function getVehicleMaintenanceList(
  vehicleId: unknown,
): Promise<VehicleMaintenance[]> {
  const id = asObjectId(vehicleId);
  const col = await maintenance();
  const rows = await col.find({ vehicleId: id }).sort({ date: -1, createdAt: -1 }).toArray();
  return rows.map(asMaintenance);
}

export async function addVehicleMaintenanceRecord(input: {
  vehicleId: unknown;
  title: unknown;
  amount: unknown;
  description: unknown;
  date: unknown;
  invoiceKey: string;
  invoiceFileName: string;
  invoiceContentType: string;
}): Promise<VehicleMaintenance> {
  const vehicleId = asObjectId(input.vehicleId);
  const parsed = parseMaintenanceFields(input);
  if (!isVehicleObjectKey(input.invoiceKey)) throw new Error("Upload an invoice");

  const vehiclesCol = await vehicles();
  const existing = await vehiclesCol.findOne({ _id: vehicleId });
  if (!existing) throw new Error("No vehicle found");

  const col = await maintenance();
  const doc: MaintenanceDoc = {
    _id: new ObjectId(),
    vehicleId,
    title: parsed.title,
    amount: parsed.amount,
    description: parsed.description,
    date: parsed.date,
    createdAt: new Date(),
    invoiceKey: input.invoiceKey,
    invoiceFileName: input.invoiceFileName,
    invoiceContentType: input.invoiceContentType,
  };
  await col.insertOne(doc);
  return asMaintenance(doc);
}

const REMOTE_API = (
  process.env.NEXT_PUBLIC_API_BASE ?? "https://stl-api-testing.herokuapp.com"
).replace(/\/$/, "");

export async function proxyVehicleMutation(
  path: "/admin/vehicle/edit" | "/admin/vehicle/delete",
  req: Request,
  payload: unknown,
): Promise<Response> {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  const auth =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (auth) headers.set("Authorization", auth);

  const res = await fetch(`${REMOTE_API}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (res.ok && /inform developer to enable delete/i.test(text)) {
    return new Response(
      "Vehicle delete is not enabled on the API yet",
      { status: 400 },
    );
  }
  return new Response(text, { status: res.status });
}

export function isVehicleStoreUnconfigured(error: unknown): boolean {
  return isDatabaseNotConfigured(error);
}
