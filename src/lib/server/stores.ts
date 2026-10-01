import { ObjectId, type Document, type UpdateFilter } from "mongodb";
import { storeIdentity } from "@/lib/stores";
import { getMongoClient } from "./mongo";
import { userIdFromAuthHeader } from "./password";

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

  const update: Record<string, unknown> = { $set };
  const $unset: Record<string, string> = {};
  if (!salesPerson) $unset.salesPerson = "";
  if (trnNo === undefined) $unset.trnNo = "";
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
