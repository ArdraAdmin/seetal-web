import { ObjectId } from "mongodb";
import { getMongoClient, isDatabaseNotConfigured } from "@/lib/server/mongo";
import { userIdFromAuthHeader } from "@/lib/server/password";

export const runtime = "nodejs";

function idString(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }
  if (typeof value === "object" && value && "_id" in value) {
    return idString((value as { _id?: unknown })._id);
  }
  return String(value).trim();
}

function asNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function matchingProfile(
  list: Array<Record<string, unknown>> | undefined,
  storeId: string,
) {
  if (!Array.isArray(list) || !storeId) return null;
  return list.find((row) => idString(row?.store) === storeId) || null;
}

function toAssignedProduct(doc: Record<string, unknown>, homesId: string) {
  const id = idString(doc._id);
  if (!id) return null;
  const profile = matchingProfile(
    doc.storeProfileList as Array<Record<string, unknown>> | undefined,
    homesId,
  );
  if (!profile || profile.isDisplayed === false) return null;

  const sellingPrice = asNumber(doc.sellingPrice);
  const price = asNumber(profile.storePrice, sellingPrice) || sellingPrice;
  const category =
    doc.category && typeof doc.category === "object" ? doc.category : undefined;
  const categoryId =
    idString(doc.categoryId) ||
    (category ? idString((category as { _id?: unknown })._id) : "");
  const inQty =
    doc.inQty && typeof doc.inQty === "object"
      ? (doc.inQty as Record<string, unknown>)
      : {};

  return {
    _id: id,
    itemRef: doc.itemRef ? String(doc.itemRef) : undefined,
    itemName: doc.itemName ? String(doc.itemName) : undefined,
    barCode: doc.barCode ? String(doc.barCode) : undefined,
    barcode: doc.barcode ? String(doc.barcode) : undefined,
    unit: doc.unit ? String(doc.unit) : undefined,
    ratio: asNumber(doc.ratio, 1),
    sellingPrice: price,
    currentStorePrice: price,
    isDisplay: doc.isDisplay !== false,
    inQty: {
      amountInCartons: asNumber(inQty.amountInCartons ?? doc.amountInCartons),
      amountInUnits: asNumber(inQty.amountInUnits ?? doc.amountInUnits),
    },
    category,
    categoryId: categoryId || undefined,
    masterCategoryId: doc.masterCategoryId
      ? String(doc.masterCategoryId)
      : undefined,
    masterCategoryName: doc.masterCategoryName
      ? String(doc.masterCategoryName)
      : undefined,
    imagePath: doc.imagePath,
    company: idString(doc.company) || undefined,
    storeItemCode: profile.storeItemCode
      ? String(profile.storeItemCode)
      : doc.storeItemCode
        ? String(doc.storeItemCode)
        : undefined,
    shmpCategoryId: idString(doc.shmpCategoryId) || undefined,
    shmpMasterCategory: doc.shmpMasterCategory
      ? String(doc.shmpMasterCategory).trim() || undefined
      : undefined,
    shmpSubCategory: doc.shmpSubCategory
      ? String(doc.shmpSubCategory).trim() || undefined
      : undefined,
    source: doc.source ? String(doc.source) : undefined,
    ownInventory: doc.ownInventory === true ? true : undefined,
  };
}

function asObjectIdFilter(id: string) {
  return ObjectId.isValid(id) ? new ObjectId(id) : id;
}

async function assertSalesUser(token: string | null, userId: string) {
  const actorId = userIdFromAuthHeader(token);
  if (!userId) throw new Error("Sales person is required");
  const client = await getMongoClient();
  const user = await client
    .db()
    .collection("users")
    .findOne(
      { _id: asObjectIdFilter(userId) as ObjectId },
      { projection: { _id: 1, role: 1 } },
    );
  if (!user) throw new Error("No Sales Person Found");
  if (actorId && actorId !== userId && String(user.role || "") !== "Admin") {
    const actor = await client
      .db()
      .collection("users")
      .findOne(
        { _id: asObjectIdFilter(actorId) as ObjectId },
        { projection: { role: 1 } },
      );
    if (!actor || !["Admin", "Supervisor"].includes(String(actor.role || ""))) {
      throw new Error("Not allowed");
    }
  }
}

export async function POST(req: Request) {
  const token =
    req.headers.get("authorization") || req.headers.get("Authorization");
  try {
    const body = (await req.json().catch(() => ({}))) as {
      userId?: string;
      salesId?: string;
    };
    const userId = String(body.userId || body.salesId || "").trim();
    await assertSalesUser(token, userId);
    const client = await getMongoClient();
    const database = client.db();
    const homes = await database.collection("stores").findOne(
      {
        environment: "shmp",
        storeName: { $regex: "sarvah\\s*homes", $options: "i" },
      },
      { projection: { _id: 1, storeName: 1, orderBlocked: 1 } },
    );
    if (!homes) {
      return new Response("Sarvah Homes store not found", { status: 404 });
    }
    if (homes.orderBlocked === true) {
      return new Response("This store cannot accept new orders.", {
        status: 400,
      });
    }
    const homesId = String(homes._id);
    const homesOid = homes._id instanceof ObjectId ? homes._id : new ObjectId(homesId);
    const docs = await database
      .collection("products")
      .find({
        $and: [
          {
            storeProfileList: {
              $elemMatch: {
                store: { $in: [homesOid, homesId] },
                isDisplayed: { $ne: false },
              },
            },
          },
          {
            $or: [{ source: "shmp-production" }, { ownInventory: true }],
          },
        ],
      })
      .sort({ itemName: 1 })
      .toArray();
    const products = docs
      .map((doc) => toAssignedProduct(doc as Record<string, unknown>, homesId))
      .filter(Boolean);
    return Response.json({
      store: { _id: homesId, storeName: homes.storeName },
      products,
    });
  } catch (error) {
    if (isDatabaseNotConfigured(error)) {
      return new Response("Database is not configured", { status: 503 });
    }
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "Not allowed" ? 403 : 400;
    return new Response(message, { status });
  }
}
