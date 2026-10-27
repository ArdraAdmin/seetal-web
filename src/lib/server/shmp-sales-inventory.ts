import { ObjectId } from "mongodb";
import type { Product } from "@/lib/types";
import {
  productFromShmpStoreDoc,
  type ShmpStoreInventoryDoc,
} from "@/lib/shmp-sales-inventory";
import { getMongoClient } from "./mongo";
import { userIdFromAuthHeader } from "./password";

type StoreDoc = {
  _id: ObjectId;
  environment?: string;
  salesPerson?: unknown;
  salesPersons?: unknown;
};

type CompanyDoc = {
  _id: ObjectId;
  name?: string;
  prefix?: string;
};

type CategoryDoc = {
  _id: ObjectId;
  masterCategoryId?: string;
  masterCategoryName?: string;
  subCategory?: string;
};

function idValues(id: string) {
  const values: Array<string | ObjectId> = [id];
  if (ObjectId.isValid(id)) values.push(new ObjectId(id));
  return values;
}

function salesmanAssignedFilter(userId: string) {
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

function normalizeCompanyToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function resolveShmpCompanyId(explicitId?: string) {
  const client = await getMongoClient();
  const companies = client.db().collection<CompanyDoc>("companies");
  const wanted = String(explicitId || "").trim();
  if (wanted && ObjectId.isValid(wanted)) {
    const match = await companies.findOne({ _id: new ObjectId(wanted) });
    if (match) return String(match._id);
  }
  const rows = await companies.find({}).project({ name: 1, prefix: 1 }).toArray();
  const match = rows.find((company) => {
    const hay = `${normalizeCompanyToken(String(company.name || ""))} ${normalizeCompanyToken(String(company.prefix || ""))}`;
    return hay.includes("shmp");
  });
  return match ? String(match._id) : "";
}

async function assignedShmpStore(
  storeId: string,
  userId: string,
) {
  if (!ObjectId.isValid(storeId)) return null;
  const client = await getMongoClient();
  return client.db().collection<StoreDoc>("stores").findOne({
    _id: new ObjectId(storeId),
    ...salesmanAssignedFilter(userId),
  });
}

function companyFilter(companyId: string) {
  if (!companyId) return {};
  return { company: { $in: idValues(companyId) } };
}

export async function shmpStoreInventoryForSalesUser(
  token: string | null,
  userId: string,
  storeId: string,
  companyId?: string,
): Promise<Product[]> {
  await assertCanRead(token, userId);
  const store = await assignedShmpStore(storeId, userId);
  if (!store) throw new Error("Store not found");

  const shmpCompanyId = await resolveShmpCompanyId(companyId);
  const client = await getMongoClient();
  const docs = await client
    .db()
    .collection<ShmpStoreInventoryDoc>("products")
    .find({
      ...companyFilter(shmpCompanyId),
      storeProfileList: {
        $elemMatch: {
          store: { $in: idValues(storeId) },
          isDisplayed: { $ne: false },
        },
      },
    })
    .sort({ itemName: 1 })
    .toArray();

  const categoryIds = [
    ...new Set(
      docs
        .map((doc) => {
          const category = doc.category;
          if (typeof category === "string") return category;
          if (category && typeof category === "object" && "_id" in category) {
            return String((category as { _id?: unknown })._id || "");
          }
          return String(category || "");
        })
        .filter((id) => ObjectId.isValid(id)),
    ),
  ];
  const categories =
    categoryIds.length > 0
      ? await client
          .db()
          .collection<CategoryDoc>("categories")
          .find({ _id: { $in: categoryIds.map((id) => new ObjectId(id)) } })
          .toArray()
      : [];
  const categoryById = new Map(
    categories.map((row) => [
      String(row._id),
      {
        _id: String(row._id),
        subCategory: row.subCategory,
        masterCategory: row.masterCategoryName,
        masterCategoryName: row.masterCategoryName,
        masterCategoryId: row.masterCategoryId,
      },
    ]),
  );

  const products: Product[] = [];
  for (const doc of docs) {
    const categoryId =
      typeof doc.category === "string"
        ? doc.category
        : doc.category && typeof doc.category === "object" && "_id" in doc.category
          ? String((doc.category as { _id?: unknown })._id || "")
          : String(doc.category || "");
    const populated = categoryById.get(categoryId);
    const product = productFromShmpStoreDoc(
      populated ? { ...doc, category: populated } : doc,
      storeId,
    );
    if (product) products.push(product);
  }
  return products;
}
