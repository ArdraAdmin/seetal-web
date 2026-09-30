import { ObjectId, type Collection } from "mongodb";
import { getMongoClient, isDatabaseNotConfigured } from "./mongo";

type VehicleDoc = {
  _id: ObjectId;
  value: number;
};

async function vehicles(): Promise<Collection<VehicleDoc>> {
  const client = await getMongoClient();
  return client.db().collection<VehicleDoc>("vehicles");
}

function asObjectId(id: unknown): ObjectId {
  const value = String(id ?? "").trim();
  if (!ObjectId.isValid(value)) {
    throw new Error("No vehicle found");
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

export async function deleteVehicleRecord(vehicleId: unknown): Promise<void> {
  const id = asObjectId(vehicleId);
  const col = await vehicles();
  const existing = await col.findOne({ _id: id });
  if (!existing) throw new Error("No vehicle found");
  await col.deleteOne({ _id: id });
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
