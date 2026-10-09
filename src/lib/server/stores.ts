import { ObjectId, type Document, type UpdateFilter } from "mongodb";
import { storeDisplayName, storeIdentity } from "@/lib/stores";
import {
  getMongoClient,
  isDatabaseNotConfigured,
} from "./mongo";
import { userIdFromAuthHeader } from "./password";

const REMOTE_API = (
  process.env.NEXT_PUBLIC_API_BASE ?? "https://stl-api-testing.herokuapp.com"
).replace(/\/$/, "");

type StoreDoc = {
  _id: ObjectId;
  storeName?: string;
  marks?: string;
  alias?: string;
  addressLine1?: string;
  addressLine2?: string;
  addressLine3?: string;
  city?: string;
  country?: string;
  contactNumber?: string | number;
  uid?: string;
  trnNo?: number | string;
  salesPerson?: ObjectId;
  tradeLicenseExpiry?: Date | string | null;
  isTemp: boolean;
};

export type AdminStoreList = {
  stores: AdminStoreRow[];
  duplicateCount: number;
};

export type AdminStoreRow = {
  _id: string;
  storeName: string;
  alias: string;
  marks: string;
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
  city: string;
  country: string;
  contactNumber: string;
  mobileNumber: string;
  uid: string;
  trnNo: string;
  tradeLicenseExpiry: string;
  isTemp: boolean;
  isTempStore: boolean;
  salesPerson: string;
  salesman?: { _id: string; name: string };
  copyCount: number;
};

async function mongoDb() {
  const client = await getMongoClient();
  return client.db();
}

async function assertRole(token: string | null, roles: string[]) {
  const id = userIdFromAuthHeader(token);
  const database = await mongoDb();
  const user = await database.collection("users").findOne(
    { _id: new ObjectId(id) },
    { projection: { role: 1 } },
  );
  if (!user || !roles.includes(String(user.role || ""))) {
    throw new Error("Not allowed");
  }
}

function asId(value: unknown, message: string) {
  const id = String(value ?? "").trim();
  if (!ObjectId.isValid(id)) throw new Error(message);
  return new ObjectId(id);
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function parseTradeLicenseExpiry(value: unknown): Date | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return undefined;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function tradeLicenseExpiryIso(value: unknown) {
  const parsed = parseTradeLicenseExpiry(value);
  return parsed ? parsed.toISOString() : "";
}

function idVariants(ids: ObjectId[]) {
  return [...ids, ...ids.map((id) => id.toHexString())];
}

async function loadStores(): Promise<StoreDoc[]> {
  const database = await mongoDb();
  const projection = {
    storeName: 1,
    marks: 1,
    alias: 1,
    addressLine1: 1,
    addressLine2: 1,
    addressLine3: 1,
    city: 1,
    country: 1,
    contactNumber: 1,
    uid: 1,
    trnNo: 1,
    salesPerson: 1,
    tradeLicenseExpiry: 1,
  };
  const [permanent, temporary] = await Promise.all([
    database.collection("stores").find({}, { projection }).toArray(),
    database.collection("tempstores").find({}, { projection }).toArray(),
  ]);
  return [
    ...permanent.map((doc) => ({ ...doc, isTemp: false }) as StoreDoc),
    ...temporary.map((doc) => ({ ...doc, isTemp: true }) as StoreDoc),
  ];
}

async function referenceCounts() {
  const database = await mongoDb();
  const counts = new Map<string, number>();
  for (const name of ["temporders", "orders"] as const) {
    const rows = await database
      .collection(name)
      .aggregate<{ _id: ObjectId | string | null; n: number }>([
        { $match: { store: { $exists: true, $ne: null } } },
        { $group: { _id: "$store", n: { $sum: 1 } } },
      ])
      .toArray();
    for (const row of rows) {
      if (!row._id) continue;
      const id = String(row._id);
      counts.set(id, (counts.get(id) || 0) + row.n);
    }
  }
  return counts;
}

function pickKeeper(group: StoreDoc[], refs: Map<string, number>) {
  return [...group].sort((a, b) => {
    const score = (doc: StoreDoc) =>
      (doc.isTemp ? 0 : 1_000_000) + (refs.get(String(doc._id)) || 0) * 10;
    const diff = score(b) - score(a);
    if (diff !== 0) return diff;
    return String(a._id) < String(b._id) ? -1 : 1;
  })[0];
}

function groupStores(docs: StoreDoc[]) {
  const groups = new Map<string, StoreDoc[]>();
  for (const doc of docs) {
    const key = storeIdentity(doc);
    const list = groups.get(key) || [];
    list.push(doc);
    groups.set(key, list);
  }
  return groups;
}

async function repointProductProfiles(
  keeper: ObjectId,
  remove: ObjectId[],
) {
  const database = await mongoDb();
  const products = database.collection("products");
  const removeSet = new Set(remove.map((id) => id.toHexString()));
  const keeperId = keeper.toHexString();
  const cursor = products.find(
    { "storeProfileList.store": { $in: idVariants(remove) } },
    { projection: { storeProfileList: 1 } },
  );
  for await (const product of cursor) {
    const list = Array.isArray(product.storeProfileList)
      ? product.storeProfileList
      : [];
    let hasKeeper = list.some(
      (entry: { store?: unknown }) => String(entry?.store || "") === keeperId,
    );
    let changed = false;
    const next: Document[] = [];
    for (const entry of list as { store?: unknown }[]) {
      const sid = String(entry?.store || "");
      if (!removeSet.has(sid)) {
        next.push(entry as Document);
        continue;
      }
      changed = true;
      if (!hasKeeper) {
        next.push({ ...entry, store: keeper });
        hasKeeper = true;
      }
    }
    if (changed) {
      await products.updateOne(
        { _id: product._id },
        { $set: { storeProfileList: next } },
      );
    }
  }
}

async function repointReferences(
  keeper: ObjectId,
  keeperIsTemp: boolean,
  remove: ObjectId[],
) {
  if (!remove.length) return;
  const database = await mongoDb();
  const ids = idVariants(remove);
  await database.collection("temporders").updateMany(
    { store: { $in: ids } },
    { $set: { store: keeper, isTempStore: keeperIsTemp } },
  );
  await database.collection("orders").updateMany(
    { store: { $in: ids } },
    { $set: { store: keeper } },
  );
  await database.collection("users").updateMany(
    { "field.sales.storeAssigned": { $in: ids } },
    { $set: { "field.sales.storeAssigned": keeper } },
  );
  if (keeperIsTemp) {
    await database.collection("users").updateMany(
      { "field.sales.tempStoreAssigned": { $in: ids } },
      { $addToSet: { "field.sales.tempStoreAssigned": keeper } },
    );
  }
  await database.collection("users").updateMany(
    { "field.sales.tempStoreAssigned": { $in: ids } },
    {
      $pull: { "field.sales.tempStoreAssigned": { $in: ids } },
    } as unknown as UpdateFilter<Document>,
  );
  await repointProductProfiles(keeper, remove);
}

async function deleteDocs(docs: StoreDoc[]) {
  const database = await mongoDb();
  const permanent = docs.filter((doc) => !doc.isTemp).map((doc) => doc._id);
  const temporary = docs.filter((doc) => doc.isTemp).map((doc) => doc._id);
  if (permanent.length) {
    await database.collection("stores").deleteMany({ _id: { $in: permanent } });
  }
  if (temporary.length) {
    await database
      .collection("tempstores")
      .deleteMany({ _id: { $in: temporary } });
  }
}

function toRow(
  doc: StoreDoc,
  names: Map<string, string>,
  copyCount: number,
): AdminStoreRow {
  const salesId = doc.salesPerson ? String(doc.salesPerson) : "";
  const salesName = salesId ? names.get(salesId) : "";
  const phone = text(doc.contactNumber);
  return {
    _id: String(doc._id),
    storeName: text(doc.storeName),
    alias: text(doc.alias),
    marks: text(doc.marks),
    addressLine1: text(doc.addressLine1),
    addressLine2: text(doc.addressLine2),
    addressLine3: text(doc.addressLine3),
    city: text(doc.city),
    country: text(doc.country),
    contactNumber: phone,
    mobileNumber: phone,
    uid: text(doc.uid),
    trnNo: doc.trnNo == null || doc.trnNo === "" ? "" : String(doc.trnNo),
    tradeLicenseExpiry: tradeLicenseExpiryIso(doc.tradeLicenseExpiry),
    isTemp: doc.isTemp,
    isTempStore: doc.isTemp,
    salesPerson: salesId,
    salesman: salesId && salesName ? { _id: salesId, name: salesName } : undefined,
    copyCount,
  };
}

export async function listAdminStores(
  token: string | null,
): Promise<AdminStoreList> {
  await assertRole(token, ["Admin"]);
  const [docs, refs] = await Promise.all([loadStores(), referenceCounts()]);
  const salesIds = [
    ...new Set(
      docs
        .map((doc) => (doc.salesPerson ? String(doc.salesPerson) : ""))
        .filter(Boolean),
    ),
  ]
    .filter((id) => ObjectId.isValid(id))
    .map((id) => new ObjectId(id));
  const database = await mongoDb();
  const people = salesIds.length
    ? await database
        .collection("users")
        .find({ _id: { $in: salesIds } }, { projection: { name: 1 } })
        .toArray()
    : [];
  const names = new Map(people.map((person) => [String(person._id), text(person.name)]));
  let duplicateCount = 0;
  const stores: AdminStoreRow[] = [];
  for (const group of groupStores(docs).values()) {
    if (group.length > 1) duplicateCount += group.length - 1;
    const keeper = pickKeeper(group, refs);
    stores.push(toRow(keeper, names, group.length));
  }
  stores.sort((a, b) => a.storeName.localeCompare(b.storeName));
  return { stores, duplicateCount };
}

export async function updateStoreRecord(token: string | null, body: unknown) {
  await assertRole(token, ["Admin"]);
  const input =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const id = asId(input.storeId, "Store not found");
  const storeName = text(input.storeName);
  if (!storeName) throw new Error("Enter a store name");
  const marks = text(input.marks);
  const docs = await loadStores();
  const current = docs.find((doc) => String(doc._id) === String(id));
  if (!current) throw new Error("Store not found");

  const originalKey = storeIdentity(current);
  const nextKey = storeIdentity({ storeName, marks });
  const clash = docs.some(
    (doc) =>
      String(doc._id) !== String(id) &&
      storeIdentity(doc) !== originalKey &&
      storeIdentity(doc) === nextKey,
  );
  if (clash) {
    throw new Error("A store with this name and marks already exists");
  }

  const country = text(input.country);
  if (!current.isTemp && !country) throw new Error("Enter a country");
  const uid = text(input.uid);
  if (!current.isTemp && !uid) throw new Error("Enter a store code");
  if (uid) {
    const database = await mongoDb();
    const uidClash = await database.collection("stores").findOne({
      uid,
      _id: { $ne: id },
    });
    if (uidClash) throw new Error("That store code is already used");
  }

  const trnRaw = text(input.trnNo);
  let trnNo: number | undefined;
  if (trnRaw) {
    trnNo = Number(trnRaw);
    if (!Number.isFinite(trnNo)) throw new Error("Enter a valid TRN");
  }

  let salesPerson: ObjectId | null = null;
  const salesId = text(input.salesPerson);
  if (salesId) {
    if (!ObjectId.isValid(salesId)) throw new Error("Choose a sales person");
    const database = await mongoDb();
    const user = await database.collection("users").findOne({
      _id: new ObjectId(salesId),
      role: "Sales",
    });
    if (!user) throw new Error("Choose a sales person");
    salesPerson = user._id;
  }

  const tradeLicenseExpiry = parseTradeLicenseExpiry(input.tradeLicenseExpiry);

  const $set: Record<string, unknown> = {
    storeName,
    marks,
    alias: text(input.alias),
    addressLine1: text(input.addressLine1),
    addressLine2: text(input.addressLine2),
    addressLine3: text(input.addressLine3),
    city: text(input.city),
    country,
    contactNumber: text(input.contactNumber),
  };
  if (uid) $set.uid = uid;
  if (trnNo !== undefined) $set.trnNo = trnNo;
  if (salesPerson) $set.salesPerson = salesPerson;
  if (tradeLicenseExpiry) {
    $set.tradeLicenseExpiry = tradeLicenseExpiry;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (tradeLicenseExpiry.getTime() >= today.getTime()) {
      $set.tradeLicenseExpiryNotifiedAt = null;
    }
  }

  const update: Record<string, unknown> = { $set };
  const $unset: Record<string, string> = {};
  if (!salesPerson) $unset.salesPerson = "";
  if (trnNo === undefined) $unset.trnNo = "";
  if (!tradeLicenseExpiry) $unset.tradeLicenseExpiry = "";
  if (Object.keys($unset).length) update.$unset = $unset;

  const database = await mongoDb();
  const collection = current.isTemp ? "tempstores" : "stores";
  await database.collection(collection).updateOne({ _id: id }, update);
}

export async function deleteStoreRecord(token: string | null, storeId: unknown) {
  await assertRole(token, ["Admin"]);
  const id = asId(storeId, "Store not found");
  const docs = await loadStores();
  const current = docs.find((doc) => String(doc._id) === String(id));
  if (!current) throw new Error("Store not found");
  const key = storeIdentity(current);
  const group = docs.filter((doc) => storeIdentity(doc) === key);
  await deleteDocs(group);
  return { removed: group.length };
}

export async function removeDuplicateStores(token: string | null) {
  await assertRole(token, ["Admin"]);
  const [docs, refs] = await Promise.all([loadStores(), referenceCounts()]);
  let removed = 0;
  for (const group of groupStores(docs).values()) {
    if (group.length < 2) continue;
    const keeper = pickKeeper(group, refs);
    const extras = group.filter((doc) => String(doc._id) !== String(keeper._id));
    await repointReferences(
      keeper._id,
      keeper.isTemp,
      extras.map((doc) => doc._id),
    );
    await deleteDocs(extras);
    removed += extras.length;
  }
  return { removed };
}

export async function changeOrderStore(
  token: string | null,
  orderId: unknown,
  storeId: unknown,
) {
  await assertRole(token, ["Admin", "Warehouse"]);
  const orderOid = asId(orderId, "Order not found");
  const storeOid = asId(storeId, "Store not found");
  const database = await mongoDb();
  const order = await database.collection("temporders").findOne({ _id: orderOid });
  if (!order) throw new Error("Order not found");
  if (order.loadCheck) {
    throw new Error("Change the store during first check or double check");
  }
  if (String(order.status || "") === "Confirmed") {
    throw new Error("This order is already confirmed");
  }

  let store = await database.collection("stores").findOne({ _id: storeOid });
  let isTempStore = false;
  if (!store) {
    store = await database.collection("tempstores").findOne({ _id: storeOid });
    isTempStore = true;
  }
  if (!store) throw new Error("Store not found");

  await database.collection("temporders").updateOne(
    { _id: orderOid },
    { $set: { store: storeOid, isTempStore } },
  );

  return {
    isTempStore,
    store: {
      _id: String(store._id),
      storeName: text(store.storeName),
      marks: text(store.marks),
      alias: text(store.alias),
      city: text(store.city),
      country: text(store.country),
    },
  };
}

export function storeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to update stores";
  const status =
    message === "Not signed in" || message === "Not allowed" ? 401 : 400;
  return new Response(message, { status });
}

export function isStoreDbUnconfigured(error: unknown) {
  return isDatabaseNotConfigured(error);
}

function authHeaders(req: Request) {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  const auth =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (auth) {
    headers.set("Authorization", auth);
    headers.set("auth-token", auth);
  }
  return headers;
}

async function remoteJson(path: string, req: Request, init?: RequestInit) {
  const res = await fetch(`${REMOTE_API}${path}`, {
    ...init,
    headers: authHeaders(req),
  });
  const textBody = await res.text();
  let body: unknown = textBody;
  try {
    body = textBody ? JSON.parse(textBody) : null;
  } catch {
    /* keep text */
  }
  return { res, body, textBody };
}

function remoteErrorMessage(body: unknown, fallback: string) {
  if (typeof body === "string" && body.trim()) return body;
  if (body && typeof body === "object") {
    const o = body as Record<string, unknown>;
    if (typeof o.error === "string") return o.error;
    if (typeof o.name === "string") return o.name;
    if (typeof o.message === "string") return o.message;
  }
  return fallback;
}

function asRemoteStoreList(body: unknown) {
  if (Array.isArray(body)) return body as Record<string, unknown>[];
  return [];
}

function remoteStoreRow(store: Record<string, unknown>, copyCount: number): AdminStoreRow {
  const phone = text(store.contactNumber || store.mobileNumber);
  const sales =
    store.salesPerson && typeof store.salesPerson === "object"
      ? (store.salesPerson as { _id?: unknown; name?: unknown })
      : store.salesman && typeof store.salesman === "object"
        ? (store.salesman as { _id?: unknown; name?: unknown })
        : null;
  const salesId = sales
    ? text(sales._id)
    : text(store.salesPerson || store.salesman);
  const salesName = sales ? text(sales.name) : "";
  const isTemp = Boolean(store.isTemp || store.isTempStore);
  return {
    _id: text(store._id),
    storeName: storeDisplayName({
      storeName: text(store.storeName),
      name: text(store.name),
    }),
    alias: text(store.alias),
    marks: text(store.marks),
    addressLine1: text(store.addressLine1),
    addressLine2: text(store.addressLine2),
    addressLine3: text(store.addressLine3),
    city: text(store.city),
    country: text(store.country),
    contactNumber: phone,
    mobileNumber: phone,
    uid: text(store.uid),
    trnNo: store.trnNo == null || store.trnNo === "" ? "" : String(store.trnNo),
    tradeLicenseExpiry: tradeLicenseExpiryIso(store.tradeLicenseExpiry),
    isTemp,
    isTempStore: isTemp,
    salesPerson: salesId,
    salesman: salesId && salesName ? { _id: salesId, name: salesName } : undefined,
    copyCount,
  };
}

export async function proxyChangeOrderStore(
  req: Request,
  input: { orderId?: string; storeId?: string; userId?: string },
): Promise<Response> {
  const orderId = text(input.orderId);
  const storeId = text(input.storeId);
  if (!orderId) return new Response("Order not found", { status: 400 });
  if (!storeId) return new Response("Store not found", { status: 400 });

  let userId = text(input.userId);
  if (!userId) {
    try {
      userId = userIdFromAuthHeader(
        req.headers.get("authorization") || req.headers.get("Authorization"),
      );
    } catch (error) {
      return storeError(error);
    }
  }

  const { res, body } = await remoteJson("/warehouse/store", req, {
    method: "PATCH",
    body: JSON.stringify({ orderId, storeId, userId }),
  });
  if (!res.ok) {
    return new Response(remoteErrorMessage(body, "Could not change store"), {
      status: res.status || 400,
    });
  }
  return Response.json(body);
}

export async function proxyListAdminStores(req: Request): Promise<Response> {
  const { res, body } = await remoteJson("/sales/store", req, { method: "GET" });
  if (!res.ok) {
    return new Response(
      remoteErrorMessage(body, "Unable to load stores from the API"),
      { status: res.status || 400 },
    );
  }
  const list = asRemoteStoreList(body);
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const store of list) {
    const key = storeIdentity(store);
    const group = groups.get(key) || [];
    group.push(store);
    groups.set(key, group);
  }
  let duplicateCount = 0;
  const stores: AdminStoreRow[] = [];
  for (const group of groups.values()) {
    if (group.length > 1) duplicateCount += group.length - 1;
    const keeper =
      group.find((store) => !store.isTemp && !store.isTempStore) || group[0];
    stores.push(remoteStoreRow(keeper, group.length));
  }
  stores.sort((a, b) => a.storeName.localeCompare(b.storeName));
  return Response.json({ stores, duplicateCount });
}

export async function proxyUpdateStoreRecord(
  req: Request,
  body: unknown,
): Promise<Response> {
  const input =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const storeId = text(input.storeId);
  if (!storeId) return new Response("Store not found", { status: 400 });
  const isTemp = Boolean(input.isTemp || input.isTempStore);
  const role = isTemp ? "tempStore" : "store";

  let location = text(input.location || input.gpsLocation);
  let salesPerson = text(input.salesPerson);
  let uid = text(input.uid);
  let city = text(input.city);
  let country = text(input.country);
  let trnNo = text(input.trnNo);

  if (!isTemp) {
    const listed = await remoteJson("/sales/store", req, { method: "GET" });
    if (listed.res.ok) {
      const current = asRemoteStoreList(listed.body).find(
        (store) => text(store._id) === storeId,
      );
      if (current) {
        if (!location) location = text(current.gpsLocation || current.location) || "—";
        if (!salesPerson) {
          salesPerson =
            current.salesPerson && typeof current.salesPerson === "object"
              ? text((current.salesPerson as { _id?: unknown })._id)
              : text(current.salesPerson);
        }
        if (!uid) uid = text(current.uid);
        if (!city) city = text(current.city);
        if (!country) country = text(current.country);
        if (!trnNo && current.trnNo != null) trnNo = String(current.trnNo);
      }
    }
    if (!uid) return new Response("Enter a store code", { status: 400 });
    if (!city) return new Response("Enter a city", { status: 400 });
    if (!country) return new Response("Enter a country", { status: 400 });
    if (!trnNo) return new Response("Enter a TRN", { status: 400 });
    if (!salesPerson) {
      return new Response("Choose a sales person", { status: 400 });
    }
    if (!location) location = "—";
  }

  const tradeLicenseExpiry = text(input.tradeLicenseExpiry);

  const payload = {
    uid: uid || undefined,
    storeName: text(input.storeName),
    alias: text(input.alias),
    marks: text(input.marks),
    addressLine1: text(input.addressLine1),
    addressLine2: text(input.addressLine2),
    addressLine3: text(input.addressLine3),
    location,
    city,
    country,
    trnNo: trnNo || undefined,
    contactNumber: text(input.contactNumber),
    salesPerson: salesPerson || undefined,
    tradeLicenseExpiry: tradeLicenseExpiry || undefined,
  };

  const { res, body: result } = await remoteJson(
    `/admin/edit/${role}/${encodeURIComponent(storeId)}`,
    req,
    { method: "POST", body: JSON.stringify(payload) },
  );
  if (!res.ok) {
    return new Response(
      remoteErrorMessage(result, "Unable to update store"),
      { status: res.status || 400 },
    );
  }
  return new Response("Store updated", { status: 200 });
}

export async function proxyDeleteStoreRecord(
  req: Request,
  storeId: unknown,
): Promise<Response> {
  const id = text(storeId);
  if (!id) return new Response("Store not found", { status: 400 });
  const { res, body } = await remoteJson(
    `/admin/edit/deleteStore/${encodeURIComponent(id)}`,
    req,
    { method: "DELETE" },
  );
  if (!res.ok) {
    return new Response(
      remoteErrorMessage(body, "Unable to delete store"),
      { status: res.status || 400 },
    );
  }
  return Response.json({ removed: 1 });
}
