import * as XLSX from "xlsx";
import { getAllWarehouseOrders, getCompanies } from "./api";
import type { PendingOrder } from "./types";
import { assigneeLabel } from "./warehouse";

type StoreDoc = {
  storeName?: string;
  name?: string;
  marks?: string;
  city?: string;
  country?: string;
  addressLine1?: string;
  addressLine2?: string;
  addressLine3?: string;
  addressLine4?: string;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function storeOf(order: PendingOrder): StoreDoc | null {
  if (!order.store || typeof order.store !== "object") return null;
  return order.store as StoreDoc;
}

function addressLines(store: StoreDoc) {
  return [store.addressLine1, store.addressLine2, store.addressLine3, store.addressLine4]
    .map((part) => text(part))
    .filter(Boolean)
    .join(", ");
}

function statusLabel(order: PendingOrder) {
  if (order.loadCheck) return "Loading";
  if (order.doubleCheck) return "Double Check";
  if (order.firstCheck) return "First Check";
  return "Pending";
}

function companyIdOf(order: PendingOrder) {
  const company = order.company;
  if (typeof company === "string") return company;
  if (company && typeof company === "object") {
    const id = (company as { _id?: unknown })._id;
    if (id) return String(id);
  }
  return "";
}

function legalName(
  company: { prefix?: string; name?: string } | undefined,
) {
  if (!company) return "";
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

function saveSheet(rows: unknown[][], sheetName: string, filename: string) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName);
  XLSX.writeFile(book, filename);
}

/** Today's loading list, from warehouse orders the API already returns. */
export async function downloadLoadingListOffline(userId: string) {
  const [{ orders }, companies] = await Promise.all([
    getAllWarehouseOrders(userId, 0),
    getCompanies().catch(() => []),
  ]);
  const companiesById = new Map(companies.map((company) => [company._id, company]));
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
  const sorted = [...orders].sort((a, b) => {
    const aMs = new Date(a.date || 0).getTime();
    const bMs = new Date(b.date || 0).getTime();
    return (Number.isNaN(bMs) ? 0 : bMs) - (Number.isNaN(aMs) ? 0 : aMs);
  });
  for (const order of sorted) {
    if (order.needsApproval === true) continue;
    if (order.loadCheck && order.unloaded !== true) continue;
    const store = storeOf(order);
    if (!store) continue;
    const cartons = Number(order.totalPkg) || 0;
    totalCartons += cartons;
    const company = companiesById.get(companyIdOf(order));
    rows.push([
      text(store.storeName || store.name),
      text(store.marks),
      statusLabel(order),
      assigneeLabel(order),
      order.firstCheck ? cartons : `Approx ${cartons}`,
      addressLines(store),
      text(store.country),
      text(store.city),
      legalName(company),
    ]);
  }
  rows.push([]);
  rows.push(["Total cartons", "", "", "", totalCartons]);
  saveSheet(rows, "Loading List", "Loading List.xlsx");
}
