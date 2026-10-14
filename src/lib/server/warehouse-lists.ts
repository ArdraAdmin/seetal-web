import { ObjectId, type Document } from "mongodb";
import * as XLSX from "xlsx";
import { warehouseWorkDayRange } from "@/lib/warehouse";
import { getMongoClient } from "./mongo";
import { userIdFromAuthHeader } from "./password";

export type WarehouseListTag = "customs" | "daily" | "loading";

const FILE_NAMES: Record<WarehouseListTag, string> = {
  customs: "Custom List.xlsx",
  daily: "Zero List.xlsx",
  loading: "Loading List.xlsx",
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function asId(value: unknown): ObjectId | null {
  if (value instanceof ObjectId) return value;
  if (value && typeof value === "object" && "_id" in value) {
    return asId((value as { _id?: unknown })._id);
  }
  const raw = text(value);
  return ObjectId.isValid(raw) ? new ObjectId(raw) : null;
}

function unitIsCartons(unit: unknown) {
  return text(unit).toUpperCase() === "CARTONS";
}

function companyLegalName(company: Document | null | undefined) {
  const prefix = text(company?.prefix).toLowerCase();
  const name = text(company?.name);
  const lower = name.toLowerCase();
  if (prefix === "shmp" || lower === "shmp" || lower === "sarvah") {
    return "Sarvah Homes";
  }
  if (
    !name ||
    lower === "stl" ||
    lower.includes("general trading") ||
    lower === "shr seetal"
  ) {
    return "STL General Trading LLC";
  }
  return name;
}

function customsCompanyLabel(company: Document | null | undefined) {
  const prefix = text(company?.prefix || "STL").toUpperCase();
  return prefix === "SHMP" ? "SHMP" : "STL";
}

function orderStatusLabel(order: Document) {
  if (order.loadCheck) return "Loading";
  if (order.doubleCheck) return "Double Check";
  if (order.firstCheck) return "First Check";
  return "Pending";
}

function cartonCount(order: Document, products: Map<string, Document>) {
  const details = Array.isArray(order.productDetails) ? order.productDetails : [];
  if (details.length === 0) return Number(order.totalPkg) || 0;
  const useAvailable = Boolean(order.firstCheck);
  let total = 0;
  let computed = false;
  for (const detail of details) {
    if (!detail || typeof detail !== "object") continue;
    const line = detail as Document;
    const qty = Number(useAvailable ? line.quantityAv : line.quantityReq) || 0;
    if (qty <= 0) continue;
    computed = true;
    const unit = useAvailable ? line.unitAv : line.unitReq;
    if (unitIsCartons(unit)) {
      total += qty;
      continue;
    }
    const product = products.get(String(asId(line.product) || ""));
    const ratio = Number(product?.ratio) || 0;
    total += ratio > 0 ? Math.ceil(qty / ratio) : qty;
  }
  if (computed) return total;
  return Number(order.totalPkg) || 0;
}

function addressLines(store: Document | undefined) {
  if (!store) return "";
  return [store.addressLine1, store.addressLine2, store.addressLine3, store.addressLine4]
    .map((part) => text(part))
    .filter(Boolean)
    .join(", ");
}

async function assertWarehouseUser(token: string | null) {
  const id = userIdFromAuthHeader(token);
  const database = (await getMongoClient()).db();
  const user = await database.collection("users").findOne(
    { _id: new ObjectId(id) },
    { projection: { role: 1, email: 1 } },
  );
  const role = text(user?.role);
  if (!user || (role !== "Admin" && role !== "Warehouse")) {
    throw new Error("Not allowed");
  }
  return { database, userId: id };
}

async function loadTodayOrders(
  database: Awaited<ReturnType<typeof assertWarehouseUser>>["database"],
  extra: Document,
) {
  const { start, end } = warehouseWorkDayRange();
  const orders = await database
    .collection("temporders")
    .find({
      status: "Pending",
      isDraft: { $ne: true },
      needsApproval: { $ne: true },
      date: { $gte: start, $lte: end },
      ...extra,
    })
    .sort({ date: -1 })
    .toArray();

  const storeIds: ObjectId[] = [];
  const productIds: ObjectId[] = [];
  const companyIds: ObjectId[] = [];
  for (const order of orders) {
    const storeId = asId(order.store);
    if (storeId) storeIds.push(storeId);
    const companyId = asId(order.company);
    if (companyId) companyIds.push(companyId);
    const details = Array.isArray(order.productDetails) ? order.productDetails : [];
    for (const detail of details) {
      if (!detail || typeof detail !== "object") continue;
      const productId = asId((detail as Document).product);
      if (productId) productIds.push(productId);
    }
  }

  const [stores, tempStores, products, companies] = await Promise.all([
    database.collection("stores").find({ _id: { $in: storeIds } }).toArray(),
    database.collection("tempstores").find({ _id: { $in: storeIds } }).toArray(),
    database.collection("products").find({ _id: { $in: productIds } }).toArray(),
    database.collection("companies").find({ _id: { $in: companyIds } }).toArray(),
  ]);

  const storeMap = new Map<string, Document>();
  for (const store of [...stores, ...tempStores]) {
    storeMap.set(String(store._id), store);
  }
  const productMap = new Map<string, Document>();
  const productCompanyIds: ObjectId[] = [];
  for (const product of products) {
    productMap.set(String(product._id), product);
    const companyId = asId(product.company);
    if (companyId && !companyIds.some((id) => String(id) === String(companyId))) {
      productCompanyIds.push(companyId);
    }
  }
  if (productCompanyIds.length) {
    const more = await database
      .collection("companies")
      .find({ _id: { $in: productCompanyIds } })
      .toArray();
    companies.push(...more);
  }
  const companyMap = new Map<string, Document>();
  for (const company of companies) companyMap.set(String(company._id), company);

  return { orders, storeMap, productMap, companyMap };
}

function companyForOrder(
  order: Document,
  productMap: Map<string, Document>,
  companyMap: Map<string, Document>,
) {
  const direct = companyMap.get(String(asId(order.company) || ""));
  if (direct) return direct;
  const details = Array.isArray(order.productDetails) ? order.productDetails : [];
  for (const detail of details) {
    if (!detail || typeof detail !== "object") continue;
    const product = productMap.get(String(asId((detail as Document).product) || ""));
    const company = companyMap.get(String(asId(product?.company) || ""));
    if (company) return company;
  }
  return null;
}

function workbookBuffer(rows: unknown[][], name: string) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, name);
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export async function buildWarehouseList(token: string | null, tag: string) {
  if (tag !== "customs" && tag !== "daily" && tag !== "loading") {
    throw new Error("Invalid list type");
  }
  const { database } = await assertWarehouseUser(token);
  const extra: Document =
    tag === "daily"
      ? { invoiceGenerated: true, firstCheck: true }
      : tag === "customs"
        ? { loadCheck: { $ne: true } }
        : {};
  const { orders, storeMap, productMap, companyMap } = await loadTodayOrders(
    database,
    extra,
  );

  if (tag === "loading") {
    const rows: unknown[][] = [[
      "Store",
      "Marks",
      "Status",
      "Assignee",
      "Cartons",
      "Address",
      "Country",
      "City",
      "Company",
    ]];
    let totalCartons = 0;
    for (const order of orders) {
      const store = storeMap.get(String(asId(order.store) || ""));
      if (!store) continue;
      const cartons = cartonCount(order, productMap);
      totalCartons += cartons;
      const company = companyForOrder(order, productMap, companyMap);
      rows.push([
        text(store.storeName),
        text(store.marks),
        orderStatusLabel(order),
        text(order.assignee),
        order.firstCheck ? cartons : `Approx ${cartons}`,
        addressLines(store),
        text(store.country),
        text(store.city),
        companyLegalName(company),
      ]);
    }
    rows.push([]);
    rows.push(["Total cartons", "", "", "", totalCartons]);
    return {
      filename: FILE_NAMES.loading,
      buffer: workbookBuffer(rows, "Loading List"),
    };
  }

  if (tag === "daily") {
    const loss = new Map<
      string,
      {
        itemRef: string;
        itemName: string;
        unit: string;
        quantityLost: number;
        lossAmount: number;
      }
    >();
    let reportDate: unknown = "";
    for (const order of orders) {
      const details = Array.isArray(order.productDetails) ? order.productDetails : [];
      for (const detail of details) {
        if (!detail || typeof detail !== "object") continue;
        const line = detail as Document;
        const qtyAv = Number(line.quantityAv) || 0;
        const qtyReq = Number(line.quantityReq) || 0;
        if (qtyAv !== 0 || qtyReq <= 0) continue;
        const product = productMap.get(String(asId(line.product) || ""));
        if (!product) continue;
        if (!reportDate && order.date) reportDate = order.date;
        const key = String(product._id);
        const ratio = Number(product.ratio) || 0;
        const storeCost = Number(line.storeCost) || 0;
        const amount = unitIsCartons(line.unitReq)
          ? storeCost * qtyReq * ratio
          : storeCost * qtyReq;
        const existing = loss.get(key);
        if (existing) {
          existing.quantityLost += qtyReq;
          existing.lossAmount += amount;
        } else {
          loss.set(key, {
            itemRef: text(product.itemRef),
            itemName: text(product.itemName),
            unit: text(line.unitReq),
            quantityLost: qtyReq,
            lossAmount: amount,
          });
        }
      }
    }
    const rows: unknown[][] = [[
      "Date",
      "Item Number",
      "Product Name",
      "Total Quantity Lost",
      "Unit",
      "Loss Amount",
    ]];
    let totalQty = 0;
    let totalLoss = 0;
    const entries = [...loss.values()].sort((a, b) =>
      a.itemName.localeCompare(b.itemName),
    );
    for (const entry of entries) {
      const amount = Number(entry.lossAmount.toFixed(2));
      rows.push([
        reportDate || "",
        entry.itemRef,
        entry.itemName || entry.itemRef,
        entry.quantityLost,
        entry.unit,
        amount,
      ]);
      totalQty += entry.quantityLost;
      totalLoss += amount;
    }
    if (entries.length) {
      rows.push([]);
      rows.push(["TOTAL", "", "", totalQty, "", Number(totalLoss.toFixed(2))]);
    }
    return {
      filename: FILE_NAMES.daily,
      buffer: workbookBuffer(rows, "Zero List"),
    };
  }

  const rows: unknown[][] = [[
    "GROUP",
    "Qty.",
    "Price",
    "Amount",
    "Country",
    "Invoice No.",
    "Company",
  ]];
  let totalPkg = 0;
  let totalPrice = 0;
  for (const order of orders) {
    const store = storeMap.get(String(asId(order.store) || ""));
    if (!store) continue;
    totalPkg += cartonCount(order, productMap);
    const company = companyForOrder(order, productMap, companyMap);
    const companyName = customsCompanyLabel(company);
    const details = Array.isArray(order.productDetails) ? order.productDetails : [];
    const checked = Boolean(order.firstCheck);
    for (const detail of details) {
      if (!detail || typeof detail !== "object") continue;
      const line = detail as Document;
      const product = productMap.get(String(asId(line.product) || ""));
      if (!product) continue;
      const qty = Number(checked ? line.quantityAv : line.quantityReq) || 0;
      if (qty === 0) continue;
      const unit = checked ? line.unitAv : line.unitReq;
      const ratio = Number(product.ratio) || 0;
      const pcs = unitIsCartons(unit) ? qty * ratio : qty;
      if (!pcs) continue;
      const price = pcs * (Number(product.sellingPrice) || 0);
      rows.push([
        text(product.parentGroup),
        pcs,
        Number(product.sellingPrice) || 0,
        price,
        text(product.country),
        text(order.tempOrderInvoiceNo),
        companyName,
      ]);
      totalPrice += price;
    }
  }
  rows.push([]);
  rows.push(["Total CTNs", totalPkg, "", totalPrice]);
  return {
    filename: FILE_NAMES.customs,
    buffer: workbookBuffer(rows, "Custom List"),
  };
}
