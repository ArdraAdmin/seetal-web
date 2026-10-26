import { ObjectId } from "mongodb";
import { getMongoClient } from "./mongo";
import { userIdFromAuthHeader } from "./password";

const REMOTE_API = (
  process.env.NEXT_PUBLIC_API_BASE ?? "https://stl-api-testing.herokuapp.com"
).replace(/\/$/, "");

type StoreDoc = {
  _id: ObjectId;
  storeName?: string;
  alias?: string;
  marks?: string;
  city?: string;
  country?: string;
  uid?: string;
  salesPerson?: unknown;
  salesPersons?: unknown;
  environment?: string;
  isTemp?: boolean;
};

function assignedFilter(userId: string) {
  const or: Record<string, unknown>[] = [
    { salesPerson: userId },
    { salesPersons: userId },
  ];
  if (ObjectId.isValid(userId)) {
    const oid = new ObjectId(userId);
    or.push({ salesPerson: oid }, { salesPersons: oid });
  }
  return { environment: "shmp", $or: or };
}

function searchFilter(tag: string) {
  const needle = String(tag || "").trim();
  if (!needle) return {};
  const rx = { $regex: needle, $options: "i" };
  return {
    $or: [
      { storeName: rx },
      { alias: rx },
      { marks: rx },
      { city: rx },
      { uid: rx },
    ],
  };
}

async function assertCanRead(token: string | null, userId: string) {
  const actorId = userIdFromAuthHeader(token);
  if (actorId === userId) return;
  const client = await getMongoClient();
  const actor = await client.db().collection("users").findOne(
    { _id: new ObjectId(actorId) },
    { projection: { role: 1 } },
  );
  if (!actor || String(actor.role || "") !== "Admin") {
    throw new Error("Not allowed");
  }
}

function asStoreRow(doc: StoreDoc) {
  return {
    ...doc,
    _id: String(doc._id),
  };
}

async function storesFromRemote(
  token: string | null,
  userId: string,
  tag?: string,
  page?: number,
) {
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", token);
    headers.set("auth-token", token);
  }
  if (tag || page) {
    const res = await fetch(`${REMOTE_API}/sales/searchShmpStore`, {
      method: "POST",
      headers: { ...Object.fromEntries(headers), "Content-Type": "application/json" },
      body: JSON.stringify({ userId, tag, page: page || 1 }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data : null;
  }
  const res = await fetch(
    `${REMOTE_API}/sales/shmpStore?userId=${encodeURIComponent(userId)}`,
    { headers },
  );
  if (!res.ok) return null;
  const data = await res.json();
  return Array.isArray(data) ? data : null;
}

export async function assignedShmpStoresForSalesUser(
  token: string | null,
  userId: string,
  tag?: string,
) {
  await assertCanRead(token, userId);
  try {
    const remote = await storesFromRemote(token, userId, tag);
    if (remote) return remote;
  } catch {
    /* Fall through to the database copy. */
  }
  const client = await getMongoClient();
  const extra = searchFilter(tag || "");
  const filter =
    extra && Object.keys(extra).length
      ? { $and: [assignedFilter(userId), extra] }
      : assignedFilter(userId);
  const rows = await client
    .db()
    .collection<StoreDoc>("stores")
    .find(filter)
    .sort({ storeName: 1 })
    .toArray();
  return rows.map(asStoreRow);
}
