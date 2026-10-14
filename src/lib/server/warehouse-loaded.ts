import { ObjectId, type Document } from "mongodb";
import { dubaiDayStart } from "@/lib/warehouse";
import type { PendingOrder } from "@/lib/types";
import { getMongoClient } from "./mongo";
import { userIdFromAuthHeader } from "./password";

const REMOTE_API = (
  process.env.NEXT_PUBLIC_API_BASE ?? "https://stl-api-testing.herokuapp.com"
).replace(/\/$/, "");

function text(value: unknown) {
  return String(value ?? "").trim();
}

async function warehouseUser(token: string | null) {
  const id = userIdFromAuthHeader(token);
  const database = (await getMongoClient()).db();
  const user = await database.collection("users").findOne(
    { _id: new ObjectId(id) },
    { projection: { role: 1 } },
  );
  const role = text(user?.role);
  if (!user || (role !== "Admin" && role !== "Warehouse")) {
    throw new Error("Not allowed");
  }
  return { database, userId: id };
}

function checkedAt(order: Document) {
  const stamped = order.loadCheckedAt ? new Date(String(order.loadCheckedAt)) : null;
  if (stamped && !Number.isNaN(stamped.getTime())) return stamped;
  const updated = order.updatedAt ? new Date(String(order.updatedAt)) : null;
  if (updated && !Number.isNaN(updated.getTime())) return updated;
  return null;
}

async function completeLoadedOrder(userId: string, orderId: string) {
  try {
    await fetch(`${REMOTE_API}/mock/warehouse/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, orderId }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // Leave the order on Loaded if delivery cannot be completed.
  }
}

async function deliverExpiredLoadChecks(
  database: Awaited<ReturnType<typeof warehouseUser>>["database"],
  userId: string,
) {
  const start = dubaiDayStart();
  const candidates = await database
    .collection("temporders")
    .find({
      status: "Pending",
      loadCheck: true,
      isDraft: { $ne: true },
    })
    .project({ loadCheckedAt: 1, updatedAt: 1 })
    .maxTimeMS(15000)
    .toArray();

  const expired = candidates.filter((order) => {
    const at = checkedAt(order);
    return Boolean(at && at.getTime() < start.getTime());
  });

  const queue = expired.map((order) => String(order._id));
  const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
    while (queue.length > 0) {
      const orderId = queue.shift();
      if (!orderId) return;
      await completeLoadedOrder(userId, orderId);
    }
  });
  await Promise.all(workers);
}

function asStore(store: Document | undefined) {
  if (!store) return undefined;
  return {
    _id: String(store._id),
    storeName: text(store.storeName || store.name),
    name: text(store.name || store.storeName),
    alias: text(store.alias),
    marks: text(store.marks),
    city: text(store.city),
    country: text(store.country),
  };
}

export async function deliverExpiredLoadedOrders(token: string | null) {
  const { database, userId } = await warehouseUser(token);
  await deliverExpiredLoadChecks(database, userId);
}

export async function listLoadedWarehouseOrders(token: string | null) {
  const { database } = await warehouseUser(token);

  const orders = await database
    .collection("temporders")
    .find({
      status: "Pending",
      loadCheck: true,
      isDraft: { $ne: true },
    })
    .sort({ date: -1 })
    .limit(300)
    .maxTimeMS(15000)
    .toArray();

  const storeIds = orders
    .map((order) => order.store)
    .filter((id): id is ObjectId => id instanceof ObjectId);
  const [stores, tempStores] = await Promise.all([
    database.collection("stores").find({ _id: { $in: storeIds } }).toArray(),
    database.collection("tempstores").find({ _id: { $in: storeIds } }).toArray(),
  ]);
  const storeMap = new Map<string, Document>();
  for (const store of [...stores, ...tempStores]) {
    storeMap.set(String(store._id), store);
  }

  const rows: PendingOrder[] = orders.map((order) => {
    const store = storeMap.get(String(order.store || ""));
    return {
      _id: String(order._id),
      tempOrderInvoiceNo: text(order.tempOrderInvoiceNo),
      date: order.date ? new Date(String(order.date)).toISOString() : "",
      createdAt: order.createdAt
        ? new Date(String(order.createdAt)).toISOString()
        : "",
      assignee: text(order.assignee),
      firstCheck: Boolean(order.firstCheck),
      doubleCheck: Boolean(order.doubleCheck),
      loadCheck: true,
      totalPkg: Number(order.totalPkg) || 0,
      isGRV: Boolean(order.isGRV),
      status: text(order.status) || "Pending",
      store: asStore(store),
      city: text(store?.city),
      country: text(store?.country),
    };
  });

  return rows;
}

export async function stampLoadCheckedAt(token: string | null, orderId: string) {
  const { database } = await warehouseUser(token);
  if (!ObjectId.isValid(orderId)) throw new Error("Order not found");
  const result = await database.collection("temporders").updateOne(
    { _id: new ObjectId(orderId), loadCheckedAt: { $exists: false } },
    { $set: { loadCheckedAt: new Date(), loadCheck: true } },
  );
  if (result.matchedCount === 0) {
    const existing = await database.collection("temporders").findOne(
      { _id: new ObjectId(orderId) },
      { projection: { _id: 1 } },
    );
    if (!existing) throw new Error("Order not found");
  }
  return { ok: true };
}
