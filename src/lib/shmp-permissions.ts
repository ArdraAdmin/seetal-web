/**
 * SHMP permission grants for custom users.
 *
 * A missing permissions document means the account still has the older
 * module-level access: every action, field, and record inside an enabled
 * module. Saving from user management writes an explicit document. After that,
 * each action, field, and record list is independent.
 */

export type Crud = {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
};

export type IdScope = { mode: "all" } | { mode: "selected"; ids: string[] };

export type OrderScope =
  | { mode: "all" }
  | { mode: "orders"; ids: string[] }
  | { mode: "stores"; ids: string[] };

export type ShmpGrantMap = {
  dashboard?: { fields: Record<string, boolean> };
  approvals?: { read: boolean; approve: boolean };
  hr?: { actions: Crud; fields: Record<string, boolean>; users: IdScope };
  payroll?: { edit: boolean; fields: Record<string, boolean>; users: IdScope };
  attendance?: {
    users: IdScope;
    fines: Crud;
    attendance: Crud;
    editExisting: boolean;
  };
  stores?: {
    actions: Crud;
    fields: Record<string, boolean>;
    block: boolean;
    salesmen: IdScope;
  };
  inventory?: { actions: Crud; fields: Record<string, boolean>; items: IdScope };
  categories?: { actions: Crud; categories: IdScope };
  catalog?: { actions: Crud; items: IdScope; uploadImages: boolean };
  production?: {
    orders: OrderScope;
    logs: boolean;
    cards: Record<string, boolean>;
    users: IdScope;
  };
};

export type ShmpPermissions = {
  version: 1;
  shmp: ShmpGrantMap;
};

export type ShmpField = { id: string; label: string; group?: string };

export const SHMP_DASHBOARD_FIELDS: ShmpField[] = [
  { id: "this-month", label: "Sales this month", group: "Performance" },
  { id: "inventory-value", label: "Inventory value", group: "Performance" },
  { id: "top-salesman", label: "Top salesman", group: "Performance" },
  { id: "present", label: "Present today", group: "Today" },
  { id: "absent", label: "Absent today", group: "Today" },
  { id: "holiday", label: "On holiday today", group: "Today" },
  { id: "ready-cartons", label: "Cartons ready for delivery", group: "Today" },
  { id: "mulkiya", label: "Mulkiya expiring", group: "Needs attention" },
  { id: "visa", label: "Visa expiring", group: "Needs attention" },
  { id: "passport", label: "Passport expiring", group: "Needs attention" },
  { id: "eid", label: "EID expiring", group: "Needs attention" },
  { id: "insurance", label: "Insurance expiring", group: "Needs attention" },
  { id: "sharjah", label: "Sharjah permit expiring", group: "Needs attention" },
  { id: "trade-license", label: "Trade license expiring", group: "Needs attention" },
  { id: "pending-approvals", label: "Pending approvals", group: "Needs attention" },
  { id: "stores", label: "Stores", group: "Operations" },
  { id: "inventory-skus", label: "Inventory SKUs", group: "Operations" },
  { id: "monthly-sales", label: "Monthly sales", group: "Insights" },
  { id: "top-products", label: "Top products", group: "Insights" },
  { id: "sales-by-salesman", label: "Sales by salesman", group: "Insights" },
  { id: "sales-by-category", label: "Inventory value by category", group: "Insights" },
];

export const SHMP_HR_FIELDS: ShmpField[] = [
  { id: "email", label: "Email", group: "Person" },
  { id: "mobileNumber", label: "Mobile", group: "Person" },
  { id: "joiningDate", label: "Joined", group: "Person" },
  { id: "linkedUserId", label: "Linked login", group: "Person" },
  { id: "visaName", label: "Name as per visa", group: "Person" },
  { id: "visaDesignation", label: "Designation as per visa", group: "Person" },
  { id: "foodServed", label: "Food served", group: "Person" },
  { id: "productionWorker", label: "Production worker", group: "Person" },
  { id: "basicSalary", label: "Basic salary", group: "Salary" },
  { id: "totalSalary", label: "Total salary", group: "Salary" },
  { id: "sundayAllowance", label: "Sunday allowance", group: "Salary" },
  { id: "passportNumber", label: "Passport number", group: "Passport" },
  { id: "passportExpiry", label: "Passport expiry", group: "Passport" },
  { id: "passportCopy", label: "Passport copy", group: "Passport" },
  { id: "photo", label: "Passport-size photo", group: "Passport" },
  { id: "eidNumber", label: "EID number", group: "Emirates ID" },
  { id: "eidExpiry", label: "EID expiry", group: "Emirates ID" },
  { id: "eidCopy", label: "EID copy", group: "Emirates ID" },
  { id: "visaNumber", label: "Visa number", group: "Visa" },
  { id: "visaExpiry", label: "Visa expiry", group: "Visa" },
  { id: "visaApplicationYear", label: "Visa application year", group: "Visa" },
  { id: "visaCopy", label: "Visa copy", group: "Visa" },
  { id: "insuranceExpiry", label: "Insurance expiry", group: "Insurance and contract" },
  { id: "insuranceCopy", label: "Insurance copy", group: "Insurance and contract" },
  { id: "employmentContractCopy", label: "Employment contract", group: "Insurance and contract" },
  { id: "offerLetter", label: "Offer letter", group: "Insurance and contract" },
];

export const SHMP_PAYROLL_FIELDS: ShmpField[] = [
  { id: "people-charged", label: "People charged", group: "Summary" },
  { id: "food-total", label: "Food total", group: "Summary" },
  { id: "share-this-month", label: "Share this month", group: "Summary" },
  { id: "headcount", label: "Headcount", group: "Summary" },
  { id: "name", label: "Name", group: "Register" },
  { id: "absentDays", label: "Absent days", group: "Register" },
  { id: "presentDays", label: "Present days", group: "Register" },
  { id: "basicSalary", label: "Basic salary", group: "Register" },
  { id: "otherBenefits", label: "Other benefits", group: "Register" },
  { id: "otSundays", label: "OT Sundays", group: "Register" },
  { id: "totalSalary", label: "Total salary", group: "Register" },
  { id: "food", label: "Food", group: "Register" },
  { id: "loans", label: "Loans", group: "Register" },
  { id: "fines", label: "Fines", group: "Register" },
  { id: "finalPay", label: "Final pay", group: "Register" },
];

export const SHMP_STORE_FIELDS: ShmpField[] = [
  { id: "storeName", label: "Store name" },
  { id: "marks", label: "Marks" },
  { id: "alias", label: "Alias" },
  { id: "contactNumber", label: "Phone" },
  { id: "addressLine1", label: "Address line 1" },
  { id: "addressLine2", label: "Address line 2" },
  { id: "addressLine3", label: "Address line 3" },
  { id: "country", label: "Country" },
  { id: "city", label: "City" },
  { id: "uid", label: "Store code" },
  { id: "trnDocument", label: "TRN document" },
  { id: "tradeLicenseExpiry", label: "Trade license expiry" },
  { id: "tradeLicenseDocument", label: "Trade license document" },
  { id: "eidNumber", label: "EID number" },
  { id: "eidDocument", label: "EID document" },
  { id: "salesmen", label: "Salesmen" },
];

export const SHMP_INVENTORY_FIELDS: ShmpField[] = [
  { id: "itemRef", label: "Item ref" },
  { id: "itemName", label: "Item name" },
  { id: "barCode", label: "Barcode" },
  { id: "baseItemCode", label: "Base item code" },
  { id: "category", label: "Category" },
  { id: "subCategory", label: "Sub category" },
  { id: "company", label: "Company" },
  { id: "unit", label: "Unit" },
  { id: "ratio", label: "Pieces per carton" },
  { id: "amountInUnits", label: "Amount in units" },
  { id: "amountInCartons", label: "Amount in cartons" },
  { id: "sellingPrice", label: "Base selling price" },
  { id: "description", label: "Description" },
  { id: "cartonWeight", label: "Carton weight" },
  { id: "cartonDimensions", label: "Carton dimensions" },
  { id: "cbm", label: "CBM" },
  { id: "pieceWeight", label: "Piece weight" },
  { id: "pieceDimensions", label: "Piece dimensions" },
  { id: "isDisplay", label: "Display in catalog" },
  { id: "storePrice", label: "Store price" },
  { id: "storeItemCode", label: "Store item code" },
  { id: "images", label: "Images" },
];

export const SHMP_PRODUCTION_CARDS: ShmpField[] = [
  { id: "today-cartons", label: "Cartons packed today" },
  { id: "month-cartons", label: "Cartons packed this month" },
  { id: "today-value", label: "Today carton value" },
  { id: "month-value", label: "Total carton value" },
];

const FIELD_CATALOG: Record<string, ShmpField[]> = {
  dashboard: SHMP_DASHBOARD_FIELDS,
  hr: SHMP_HR_FIELDS,
  payroll: SHMP_PAYROLL_FIELDS,
  stores: SHMP_STORE_FIELDS,
  inventory: SHMP_INVENTORY_FIELDS,
  production: SHMP_PRODUCTION_CARDS,
};

/** Older field tokens still stored on accounts that have not been re-saved. */
const LEGACY_GROUPS: Record<string, Record<string, string>> = {
  hr: {
    salary: "salary",
    basicSalary: "salary",
    totalSalary: "salary",
    sundayAllowance: "salary",
    otherBenefits: "salary",
    passport: "passport",
    passportNumber: "passport",
    passportExpiry: "passport",
    passportCopy: "passport",
    photo: "passport",
    eid: "eid",
    eidNumber: "eid",
    eidExpiry: "eid",
    eidCopy: "eid",
    visa: "visa",
    visaNumber: "visa",
    visaExpiry: "visa",
    visaApplicationYear: "visa",
    visaCopy: "visa",
    insurance: "insurance",
    insuranceExpiry: "insurance",
    insuranceCopy: "insurance",
    employmentContractCopy: "insurance",
    offerLetter: "insurance",
  },
  inventory: {
    "selling-price": "selling-price",
    sellingPrice: "selling-price",
    storePrice: "selling-price",
    quantity: "quantity",
    amountInUnits: "quantity",
    amountInCartons: "quantity",
  },
};

const OLD_FIELD_IDS: Record<string, string[]> = {
  dashboard: SHMP_DASHBOARD_FIELDS.map((field) => field.id),
  hr: ["salary", "passport", "eid", "visa", "insurance"],
  inventory: ["selling-price", "quantity"],
};

export const SHMP_GRANULAR_MODULES = [
  "dashboard",
  "approvals",
  "hr",
  "payroll",
  "attendance",
  "stores",
  "inventory",
  "categories",
  "catalog",
  "production",
] as const;

export type ShmpAccessLike = {
  companies?: readonly string[];
  modules?: { shmp?: readonly string[] };
  explicit?: boolean;
  permissions?: ShmpPermissions | null;
};

const MAX_IDS = 2000;

function moduleIds(access: ShmpAccessLike | null | undefined) {
  return (access?.modules?.shmp || []).filter((id) => !String(id).includes(":"));
}

function selectedTokens(access: ShmpAccessLike, moduleId: string) {
  const prefix = `${moduleId}:`;
  const saved = (access.modules?.shmp || [])
    .filter((id) => id.startsWith(prefix))
    .map((id) => id.slice(prefix.length))
    .filter((id) => id !== "__none__");
  const hadToken = (access.modules?.shmp || []).some((id) => id.startsWith(prefix));
  return hadToken ? saved : null;
}

function listed(access: ShmpAccessLike, moduleId: string) {
  return moduleIds(access).includes(moduleId);
}

export function shmpModuleAllowed(
  access: ShmpAccessLike | null | undefined,
  moduleId: string,
) {
  if (!access) return true;
  if (!access.companies?.includes("shmp")) return false;
  if (listed(access, moduleId)) return true;
  if (access.explicit) return false;
  if (moduleId === "approvals") {
    return listed(access, "dashboard") && legacyFieldOn(access, "dashboard", "pending-approvals");
  }
  if (moduleId === "payroll") {
    return listed(access, "hr") && legacyFieldOn(access, "hr", "salary");
  }
  if (moduleId === "categories") return listed(access, "inventory");
  return false;
}

function legacyFieldOn(access: ShmpAccessLike, moduleId: string, fieldId: string) {
  const selected = selectedTokens(access, moduleId);
  if (selected === null) return true;
  const group = LEGACY_GROUPS[moduleId]?.[fieldId];
  if (group) return selected.includes(group);
  if (selected.includes(fieldId)) return true;
  const oldIds = OLD_FIELD_IDS[moduleId];
  if (oldIds?.includes(fieldId)) return false;
  return true;
}

export function shmpFieldOn(
  access: ShmpAccessLike | null | undefined,
  moduleId: string,
  fieldId: string,
) {
  if (!access) return true;
  if (!shmpModuleAllowed(access, moduleId)) return false;
  if (!access.explicit || !access.permissions?.shmp) {
    return legacyFieldOn(access, moduleId, fieldId);
  }
  const grant = access.permissions.shmp[moduleId as keyof ShmpGrantMap] as
    | { fields?: Record<string, boolean>; cards?: Record<string, boolean> }
    | undefined;
  if (!grant) return false;
  if (moduleId === "production") return grant.cards?.[fieldId] === true;
  if (grant.fields?.[fieldId] === true) return true;
  const members = LEGACY_GROUPS[moduleId];
  if (!members) return false;
  const grouped = Object.entries(members)
    .filter(([, name]) => name === fieldId)
    .map(([id]) => id);
  if (grouped.length === 0) return false;
  return grouped.some((id) => grant.fields?.[id] === true);
}

function crudOn(crud: Crud | undefined, action: string) {
  if (!crud) return false;
  if (action === "create" || action === "read" || action === "update" || action === "delete") {
    return crud[action] === true;
  }
  return false;
}

export function shmpActionOn(
  access: ShmpAccessLike | null | undefined,
  moduleId: string,
  action: string,
) {
  if (!access) return true;
  if (!shmpModuleAllowed(access, moduleId)) return false;
  if (!access.explicit || !access.permissions?.shmp) return true;
  const grant = access.permissions.shmp[moduleId as keyof ShmpGrantMap] as
    | {
        actions?: Crud;
        read?: boolean;
        approve?: boolean;
        edit?: boolean;
        block?: boolean;
        uploadImages?: boolean;
        logs?: boolean;
        editExisting?: boolean;
        fines?: Crud;
        attendance?: Crud;
      }
    | undefined;
  if (!grant) return false;
  if (action.startsWith("fines.")) return crudOn(grant.fines, action.slice(6));
  if (action.startsWith("attendance.")) return crudOn(grant.attendance, action.slice(11));
  if (moduleId === "approvals" && action === "read") return grant.read === true;
  if (moduleId === "approvals" && action === "approve") return grant.approve === true;
  if (moduleId === "payroll" && action === "edit") return grant.edit === true;
  if (moduleId === "payroll" && action === "read") return true;
  if (moduleId === "stores" && action === "block") return grant.block === true;
  if (moduleId === "catalog" && action === "uploadImages") return grant.uploadImages === true;
  if (moduleId === "production" && action === "logs") return grant.logs === true;
  if (moduleId === "attendance" && action === "editExisting") return grant.editExisting === true;
  if (moduleId === "dashboard" && action === "read") return true;
  if (moduleId === "production" && action === "read") return true;
  return crudOn(grant.actions, action);
}

export function scopeAllows(scope: IdScope | undefined, id: string) {
  if (!scope || scope.mode === "all") return true;
  return scope.ids.includes(String(id));
}

export function shmpRecordAllowed(
  access: ShmpAccessLike | null | undefined,
  moduleId: string,
  scopeKey: "users" | "items" | "categories" | "salesmen",
  id: string,
) {
  if (!access || !access.explicit || !access.permissions?.shmp) return true;
  const grant = access.permissions.shmp[moduleId as keyof ShmpGrantMap] as
    | { users?: IdScope; items?: IdScope; categories?: IdScope; salesmen?: IdScope }
    | undefined;
  if (!grant) return false;
  return scopeAllows(grant[scopeKey], id);
}

export function catalogItemAllowed(access: ShmpAccessLike | null | undefined, id: string) {
  if (!access) return true;
  if (!shmpActionOn(access, "catalog", "read") && !shmpModuleAllowed(access, "catalog")) {
    return false;
  }
  if (!shmpModuleAllowed(access, "catalog")) return false;
  if (!shmpRecordAllowed(access, "catalog", "items", id)) return false;
  if (shmpModuleAllowed(access, "inventory") && access.explicit) {
    return shmpRecordAllowed(access, "inventory", "items", id);
  }
  return true;
}

export function productionOrderAllowed(
  access: ShmpAccessLike | null | undefined,
  order: { _id?: unknown; id?: unknown; store?: unknown },
) {
  if (!access || !access.explicit || !access.permissions?.shmp) return true;
  const scope = access.permissions.shmp.production?.orders;
  if (!scope || scope.mode === "all") return true;
  if (scope.mode === "orders") {
    const id = String(order._id || order.id || "");
    return scope.ids.includes(id);
  }
  const store = order.store;
  const storeId =
    store && typeof store === "object"
      ? String((store as { _id?: unknown; id?: unknown })._id || (store as { id?: unknown }).id || "")
      : String(store || "");
  return scope.ids.includes(storeId);
}

function allFields(moduleId: string, on: boolean) {
  const fields: Record<string, boolean> = {};
  for (const field of FIELD_CATALOG[moduleId] || []) fields[field.id] = on;
  return fields;
}

function crud(read: boolean, rest: boolean): Crud {
  return { create: rest, read, update: rest, delete: rest };
}

function allScope(): IdScope {
  return { mode: "all" };
}

/** Turning a module on does not turn on create, update, delete, or special actions. */
export function grantWhenEnabled(moduleId: string): ShmpGrantMap[keyof ShmpGrantMap] {
  const fields = allFields(moduleId, true);
  if (moduleId === "dashboard") return { fields };
  if (moduleId === "approvals") return { read: true, approve: false };
  if (moduleId === "hr") return { actions: crud(true, false), fields, users: allScope() };
  if (moduleId === "payroll") return { edit: false, fields, users: allScope() };
  if (moduleId === "attendance") {
    return {
      users: allScope(),
      fines: crud(false, false),
      attendance: crud(true, false),
      editExisting: false,
    };
  }
  if (moduleId === "stores") {
    return { actions: crud(true, false), fields, block: false, salesmen: allScope() };
  }
  if (moduleId === "inventory") return { actions: crud(true, false), fields, items: allScope() };
  if (moduleId === "categories") return { actions: crud(true, false), categories: allScope() };
  if (moduleId === "catalog") {
    return { actions: crud(true, false), items: allScope(), uploadImages: false };
  }
  return {
    orders: { mode: "all" },
    logs: false,
    cards: allFields("production", true),
    users: allScope(),
  };
}

function legacyGrant(moduleId: string, access: ShmpAccessLike) {
  const fields = allFields(moduleId, true);
  for (const field of FIELD_CATALOG[moduleId] || []) {
    fields[field.id] = legacyFieldOn(access, moduleId, field.id);
  }
  const full = crud(true, true);
  if (moduleId === "dashboard") return { fields };
  if (moduleId === "approvals") return { read: true, approve: true };
  if (moduleId === "hr") return { actions: full, fields, users: allScope() };
  if (moduleId === "payroll") return { edit: true, fields, users: allScope() };
  if (moduleId === "attendance") {
    return { users: allScope(), fines: full, attendance: full, editExisting: true };
  }
  if (moduleId === "stores") {
    return { actions: full, fields, block: true, salesmen: allScope() };
  }
  if (moduleId === "inventory") return { actions: full, fields, items: allScope() };
  if (moduleId === "categories") return { actions: full, categories: allScope() };
  if (moduleId === "catalog") return { actions: full, items: allScope(), uploadImages: true };
  return {
    orders: { mode: "all" as const },
    logs: true,
    cards: allFields("production", true),
    users: allScope(),
  };
}

/** Older production grants have no user list. Those accounts can assign anyone. */
function withProductionUsers(permissions: ShmpPermissions): ShmpPermissions {
  const production = permissions.shmp.production;
  if (!production || production.users) return permissions;
  return {
    version: 1,
    shmp: {
      ...permissions.shmp,
      production: { ...production, users: { mode: "all" } },
    },
  };
}

/** What the editor should show for an account that has not been saved with explicit grants. */
export function permissionsForEditor(access: ShmpAccessLike | null | undefined): ShmpPermissions {
  if (access?.explicit && access.permissions?.version === 1 && access.permissions.shmp) {
    return withProductionUsers(access.permissions);
  }
  const shmp: ShmpGrantMap = {};
  for (const moduleId of SHMP_GRANULAR_MODULES) {
    if (!access || !shmpModuleAllowed(access, moduleId)) continue;
    shmp[moduleId] = legacyGrant(moduleId, access) as never;
  }
  return { version: 1, shmp };
}

function cleanIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const raw of value) {
    const id = String(raw || "").trim();
    if (!id || id.length > 80 || ids.length >= MAX_IDS) continue;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

function cleanScope(value: unknown): IdScope {
  const mode = value && typeof value === "object" ? (value as { mode?: unknown }).mode : "";
  if (mode === "selected") {
    return { mode: "selected", ids: cleanIds((value as { ids?: unknown }).ids) };
  }
  return { mode: "all" };
}

function cleanOrderScope(value: unknown): OrderScope {
  const mode = value && typeof value === "object" ? (value as { mode?: unknown }).mode : "";
  if (mode === "orders" || mode === "stores") {
    return { mode, ids: cleanIds((value as { ids?: unknown }).ids) };
  }
  return { mode: "all" };
}

function cleanFields(moduleId: string, value: unknown) {
  const known = new Set((FIELD_CATALOG[moduleId] || []).map((field) => field.id));
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const fields: Record<string, boolean> = {};
  for (const id of known) fields[id] = source[id] === true;
  return fields;
}

function cleanCrud(value: unknown, fallbackRead: boolean): Crud {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    create: source.create === true,
    read: source.read === true || (source.read == null && fallbackRead),
    update: source.update === true,
    delete: source.delete === true,
  };
}

export function sanitizeShmpPermissions(
  input: unknown,
): { ok: true; permissions: ShmpPermissions } | { ok: false; error: string } {
  if (input == null) return { ok: false, error: "Permissions are required" };
  if (typeof input !== "object") return { ok: false, error: "Permissions are invalid" };
  const body = input as { version?: unknown; shmp?: unknown };
  const source = body.shmp && typeof body.shmp === "object" ? (body.shmp as Record<string, unknown>) : {};
  const shmp: ShmpGrantMap = {};
  if (source.dashboard) shmp.dashboard = { fields: cleanFields("dashboard", (source.dashboard as { fields?: unknown }).fields) };
  if (source.approvals) {
    const row = source.approvals as { read?: unknown; approve?: unknown };
    shmp.approvals = { read: row.read === true, approve: row.approve === true };
  }
  if (source.hr) {
    const row = source.hr as { actions?: unknown; fields?: unknown; users?: unknown };
    shmp.hr = {
      actions: cleanCrud(row.actions, false),
      fields: cleanFields("hr", row.fields),
      users: cleanScope(row.users),
    };
  }
  if (source.payroll) {
    const row = source.payroll as { edit?: unknown; fields?: unknown; users?: unknown };
    shmp.payroll = {
      edit: row.edit === true,
      fields: cleanFields("payroll", row.fields),
      users: cleanScope(row.users),
    };
  }
  if (source.attendance) {
    const row = source.attendance as {
      users?: unknown;
      fines?: unknown;
      attendance?: unknown;
      editExisting?: unknown;
    };
    shmp.attendance = {
      users: cleanScope(row.users),
      fines: cleanCrud(row.fines, false),
      attendance: cleanCrud(row.attendance, false),
      editExisting: row.editExisting === true,
    };
  }
  if (source.stores) {
    const row = source.stores as {
      actions?: unknown;
      fields?: unknown;
      block?: unknown;
      salesmen?: unknown;
    };
    shmp.stores = {
      actions: cleanCrud(row.actions, false),
      fields: cleanFields("stores", row.fields),
      block: row.block === true,
      salesmen: cleanScope(row.salesmen),
    };
  }
  if (source.inventory) {
    const row = source.inventory as { actions?: unknown; fields?: unknown; items?: unknown };
    shmp.inventory = {
      actions: cleanCrud(row.actions, false),
      fields: cleanFields("inventory", row.fields),
      items: cleanScope(row.items),
    };
  }
  if (source.categories) {
    const row = source.categories as { actions?: unknown; categories?: unknown };
    shmp.categories = {
      actions: cleanCrud(row.actions, false),
      categories: cleanScope(row.categories),
    };
  }
  if (source.catalog) {
    const row = source.catalog as { actions?: unknown; items?: unknown; uploadImages?: unknown };
    shmp.catalog = {
      actions: cleanCrud(row.actions, false),
      items: cleanScope(row.items),
      uploadImages: row.uploadImages === true,
    };
  }
  if (source.production) {
    const row = source.production as {
      orders?: unknown;
      logs?: unknown;
      cards?: unknown;
      users?: unknown;
    };
    shmp.production = {
      orders: cleanOrderScope(row.orders),
      logs: row.logs === true,
      cards: cleanFields("production", row.cards),
      users: row.users == null ? { mode: "all" } : cleanScope(row.users),
    };
  }
  return { ok: true, permissions: { version: 1, shmp } };
}

function slimScope(scope: IdScope): IdScope {
  return scope.mode === "selected" ? { mode: "selected", ids: [] } : { mode: "all" };
}

function slimOrder(scope: OrderScope): OrderScope {
  return scope.mode === "all" ? { mode: "all" } : { mode: scope.mode, ids: [] };
}

/** Cookie copy. Record id lists stay in the signed-in profile, not the cookie. */
export function sessionCustomAccess<T extends ShmpAccessLike>(access: T): T {
  const copy = { ...access } as T & { permissions?: ShmpPermissions | null };
  if (!access.explicit && !access.permissions) return copy;
  copy.explicit = true;
  const shmp = access.permissions?.shmp;
  if (!shmp) {
    delete copy.permissions;
    return copy;
  }
  const next: ShmpGrantMap = {};
  if (shmp.dashboard) next.dashboard = shmp.dashboard;
  if (shmp.approvals) next.approvals = shmp.approvals;
  if (shmp.hr) next.hr = { ...shmp.hr, users: slimScope(shmp.hr.users) };
  if (shmp.payroll) next.payroll = { ...shmp.payroll, users: slimScope(shmp.payroll.users) };
  if (shmp.attendance) next.attendance = { ...shmp.attendance, users: slimScope(shmp.attendance.users) };
  if (shmp.stores) next.stores = { ...shmp.stores, salesmen: slimScope(shmp.stores.salesmen) };
  if (shmp.inventory) next.inventory = { ...shmp.inventory, items: slimScope(shmp.inventory.items) };
  if (shmp.categories) next.categories = { ...shmp.categories, categories: slimScope(shmp.categories.categories) };
  if (shmp.catalog) next.catalog = { ...shmp.catalog, items: slimScope(shmp.catalog.items) };
  if (shmp.production) {
    next.production = {
      ...shmp.production,
      orders: slimOrder(shmp.production.orders),
      users: slimScope(shmp.production.users || { mode: "all" }),
    };
  }
  copy.permissions = { version: 1, shmp: next };
  return copy;
}

export function shmpNavVisible(
  access: ShmpAccessLike | null | undefined,
  moduleId: string,
) {
  if (!access) return true;
  if (!shmpModuleAllowed(access, moduleId)) return false;
  if (moduleId === "approvals") return shmpActionOn(access, moduleId, "read");
  if (moduleId === "hr" || moduleId === "stores" || moduleId === "inventory" || moduleId === "categories" || moduleId === "catalog") {
    return shmpActionOn(access, moduleId, "read");
  }
  if (moduleId === "attendance") {
    return (
      shmpActionOn(access, moduleId, "attendance.read")
      || shmpActionOn(access, moduleId, "fines.read")
    );
  }
  return true;
}
