import { ObjectId, type Collection } from "mongodb";
import { getMongoClient, isDatabaseNotConfigured } from "./mongo";
import { userIdFromAuthHeader } from "./password";
import type { VehicleExtras, VehicleMaintenance } from "../types";

type VehicleDoc = {
  _id: ObjectId;
  value: number;
  purchaseYear?: number | null;
  price?: number | null;
  purchaseFrom?: string | null;
  mulkyaExpiry?: string | null;
  insurancePremium?: number | null;
};

type MaintenanceDoc = {
  _id: ObjectId;
  vehicleId: ObjectId;
  title: string;
  amount: number;
  description: string;
  date: string;
  createdAt: Date;
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

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
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error("Enter a valid vehicle number");
  }
  return value;
}

function optionalNumber(
  raw: unknown,
  label: string,
  opts?: { integer?: boolean; min?: number; max?: number },
): number | null {
  if (raw == null || raw === "") return null;
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Enter a valid ${label}`);
  }
  if (opts?.integer && !Number.isInteger(value)) {
    throw new Error(`${label} must be a whole number`);
  }
  if (opts?.min != null && value < opts.min) {
    throw new Error(`${label} must be at least ${opts.min}`);
  }
  if (opts?.max != null && value > opts.max) {
    throw new Error(`${label} must be at most ${opts.max}`);
  }
  return value;
}

function optionalYear(raw: unknown): number | null {
  const year = new Date().getFullYear() + 1;
  return optionalNumber(raw, "purchase year", {
    integer: true,
    min: 1980,
    max: year,
  });
}

function optionalDate(raw: unknown, label: string): string | null {
  if (raw == null || raw === "") return null;
  const value = String(raw).trim().slice(0, 10);
  if (!DATE_ONLY.test(value)) {
    throw new Error(`Enter a valid ${label}`);
  }
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Enter a valid ${label}`);
  }
  return value;
}

function requiredDate(raw: unknown, label: string): string {
  const value = optionalDate(raw, label);
  if (!value) throw new Error(`Enter a ${label}`);
  return value;
}

function extrasFromDoc(doc: VehicleDoc | null): VehicleExtras {
  if (!doc) {
    return {
      purchaseYear: null,
      price: null,
      purchaseFrom: null,
      mulkyaExpiry: null,
      insurancePremium: null,
    };
  }
  return {
    purchaseYear: doc.purchaseYear ?? null,
    price: doc.price ?? null,
    purchaseFrom: doc.purchaseFrom ?? null,
    mulkyaExpiry: doc.mulkyaExpiry ?? null,
    insurancePremium: doc.insurancePremium ?? null,
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
  };
}

export function requireVehicleUser(token: string | null): string {
  return userIdFromAuthHeader(token);
}

export function parseVehicleExtras(body: Record<string, unknown>): VehicleExtras {
  const purchaseFrom =
    body.purchaseFrom == null ? null : String(body.purchaseFrom).trim();
  return {
    purchaseYear: optionalYear(body.purchaseYear),
    price: optionalNumber(body.price, "price", { min: 0 }),
    purchaseFrom: purchaseFrom ? purchaseFrom.slice(0, 200) : null,
    mulkyaExpiry: optionalDate(body.mulkyaExpiry, "mulkya expiry"),
    insurancePremium: optionalNumber(body.insurancePremium, "insurance premium", {
      min: 0,
    }),
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

export async function deleteVehicleRecord(vehicleId: unknown): Promise<void> {
  const id = asObjectId(vehicleId);
  const col = await vehicles();
  const existing = await col.findOne({ _id: id });
  if (!existing) throw new Error("No vehicle found");
  await col.deleteOne({ _id: id });
  try {
    const maint = await maintenance();
    await maint.deleteMany({ vehicleId: id });
  } catch {
    // Maintenance cleanup is best-effort if the collection is unavailable.
  }
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
}): Promise<VehicleMaintenance> {
  const vehicleId = asObjectId(input.vehicleId);
  const title = String(input.title ?? "").trim();
  if (!title) throw new Error("Enter a maintenance title");
  const amount = optionalNumber(input.amount, "amount", { min: 0 });
  if (amount == null) throw new Error("Enter a maintenance amount");
  const description = String(input.description ?? "").trim();
  const date = requiredDate(input.date, "maintenance date");

  const vehiclesCol = await vehicles();
  const existing = await vehiclesCol.findOne({ _id: vehicleId });
  if (!existing) throw new Error("No vehicle found");

  const col = await maintenance();
  const doc: MaintenanceDoc = {
    _id: new ObjectId(),
    vehicleId,
    title: title.slice(0, 160),
    amount,
    description: description.slice(0, 2000),
    date,
    createdAt: new Date(),
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
