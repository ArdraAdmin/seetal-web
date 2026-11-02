import { ObjectId, type Document } from "mongodb";
import { PRODUCTS_LINKED_MESSAGE } from "@/lib/categories";
import { getMongoClient, isDatabaseNotConfigured } from "./mongo";
import { userIdFromAuthHeader } from "./password";

export { isDatabaseNotConfigured };

type CategoryDoc = {
  _id: ObjectId;
  masterCategoryId?: string;
  masterCategoryName?: string;
  subCategory?: string;
};

function grantsCategories(custom: { companies?: unknown; modules?: unknown }) {
  const companies = Array.isArray(custom.companies)
    ? custom.companies.map((item) => String(item))
    : [];
  const modules =
    custom.modules && typeof custom.modules === "object"
      ? (custom.modules as Record<string, unknown>)
      : {};
  return companies.some((company) => {
    const list = modules[company];
    if (!Array.isArray(list)) return false;
    return list.some((id) => {
      const value = String(id);
      return value === "categories" || value.startsWith("categories:");
    });
  });
}

async function assertCanManageCategories(token: string | null) {
  const userId = userIdFromAuthHeader(token);
  const db = (await getMongoClient()).db();
  const user = await db.collection("users").findOne(
    { _id: new ObjectId(userId) },
    { projection: { role: 1 } },
  );
  if (!user) throw new Error("Not signed in");

  const custom = await db.collection("customUsers").findOne({
    userId: new ObjectId(userId),
  });
  if (custom) {
    if (!grantsCategories(custom)) throw new Error("Not allowed");
    return db;
  }
  if (user.role !== "Admin") throw new Error("Not allowed");
  return db;
}

function linkedProductFilter(
  docs: CategoryDoc[],
  masterCategoryIds: string[],
): Document | null {
  const or: Document[] = [];
  if (docs.length > 0) {
    const values: Array<ObjectId | string> = [
      ...docs.map((doc) => doc._id),
      ...docs.map((doc) => doc._id.toHexString()),
    ];
    or.push({ category: { $in: values } });
    or.push({ "category._id": { $in: values } });
    or.push({ categoryId: { $in: values } });
    or.push({ subCategoryId: { $in: values } });
  }
  const masters = [...new Set(masterCategoryIds.map((id) => id.trim()).filter(Boolean))];
  if (masters.length > 0) {
    or.push({ masterCategoryId: { $in: masters } });
  }
  if (or.length === 0) return null;
  return { $or: or };
}

export async function deleteMasterCategory(input: {
  token: string | null;
  masterCategoryId?: unknown;
  masterCategoryName?: unknown;
}): Promise<{ deletedSubcategories: number }> {
  const db = await assertCanManageCategories(input.token);
  const requestedId = String(input.masterCategoryId ?? "").trim();
  const requestedName = String(input.masterCategoryName ?? "").trim();
  if (!requestedId && !requestedName) throw new Error("Category not found");

  const categories = db.collection<CategoryDoc>("categories");
  const masters = db.collection("mastercategories");

  let masterDoc = requestedId
    ? await masters.findOne({ masterCategoryId: requestedId })
    : null;
  if (!masterDoc && requestedName) {
    masterDoc = await masters.findOne({ masterCategoryName: requestedName });
  }

  const resolvedId = String(
    requestedId || masterDoc?.masterCategoryId || "",
  ).trim();
  const resolvedName = String(
    requestedName || masterDoc?.masterCategoryName || "",
  ).trim();

  let docs: CategoryDoc[] = [];
  if (resolvedId) {
    docs = await categories.find({ masterCategoryId: resolvedId }).toArray();
  }
  if (docs.length === 0 && resolvedName) {
    docs = await categories.find({ masterCategoryName: resolvedName }).toArray();
  }

  const masterIds = [
    ...new Set(
      [resolvedId, ...docs.map((doc) => String(doc.masterCategoryId || ""))]
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];

  if (docs.length === 0 && !masterDoc && masterIds.length === 0) {
    throw new Error("Category not found");
  }

  const filter = linkedProductFilter(docs, masterIds);
  if (filter) {
    const linked = await db.collection("products").findOne(filter, {
      projection: { _id: 1 },
    });
    if (linked) throw new Error(PRODUCTS_LINKED_MESSAGE);
  }

  let deletedSubcategories = 0;
  if (masterIds.length > 0) {
    const removed = await categories.deleteMany({
      masterCategoryId: { $in: masterIds },
    });
    deletedSubcategories = removed.deletedCount;
    await db.collection("subcategories").deleteMany({
      masterCategoryId: { $in: masterIds },
    });
    await masters.deleteMany({ masterCategoryId: { $in: masterIds } });
  } else if (docs.length > 0) {
    const removed = await categories.deleteMany({
      _id: { $in: docs.map((doc) => doc._id) },
    });
    deletedSubcategories = removed.deletedCount;
    if (masterDoc?._id) await masters.deleteOne({ _id: masterDoc._id });
  } else if (masterDoc?._id) {
    await masters.deleteOne({ _id: masterDoc._id });
  }

  return { deletedSubcategories };
}

export async function deleteSubCategory(input: {
  token: string | null;
  catId?: unknown;
}): Promise<{ deleted: true }> {
  const db = await assertCanManageCategories(input.token);
  const catId = String(input.catId ?? "").trim();
  if (!ObjectId.isValid(catId)) throw new Error("Subcategory not found");

  const categories = db.collection<CategoryDoc>("categories");
  const doc = await categories.findOne({ _id: new ObjectId(catId) });
  if (!doc) throw new Error("Subcategory not found");

  const filter = linkedProductFilter([doc], []);
  if (filter) {
    const linked = await db.collection("products").findOne(filter, {
      projection: { _id: 1 },
    });
    if (linked) throw new Error(PRODUCTS_LINKED_MESSAGE);
  }

  await categories.deleteOne({ _id: doc._id });
  const subName = String(doc.subCategory || "").trim();
  const masterId = String(doc.masterCategoryId || "").trim();
  if (subName) {
    await db.collection("subcategories").deleteMany(
      masterId
        ? { subCategory: subName, masterCategoryId: masterId }
        : { subCategory: subName },
    );
  }

  return { deleted: true };
}
