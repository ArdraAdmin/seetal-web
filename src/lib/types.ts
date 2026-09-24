export type UserRole = "Admin" | "Sales" | "Warehouse" | string;

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  token: string;
  mobileNumber?: string;
}

export interface Driver {
  _id: string;
  name: string;
  phoneNo: string;
}

export interface Vehicle {
  _id: string;
  value: number | string;
}

export interface StoreProfile {
  _id: string;
  storeName?: string;
  name?: string;
  alias?: string;
  addressLine1?: string;
  addressLine2?: string;
  addressLine3?: string;
  mobileNumber?: string;
  email?: string;
  salesman?: string | { name?: string; _id?: string };
  isTemp?: boolean;
  marks?: string;
  city?: string;
  country?: string;
  [key: string]: unknown;
}

export interface ProfileUser {
  _id: string;
  name: string;
  email?: string;
  mobileNumber?: string;
  role?: string;
  [key: string]: unknown;
}

export interface Product {
  _id: string;
  itemRef?: string;
  itemName?: string;
  barCode?: string;
  barcode?: string;
  unit?: string;
  ratio?: number;
  sellingPrice?: number;
  currentStorePrice?: number;
  isDisplay?: boolean;
  inQty?: { amountInCartons?: number; amountInUnits?: number };
  amountInCartons?: number;
  amountInUnits?: number;
  category?:
    | string
    | {
        _id?: string;
        subCategory?: string;
        masterCategory?: string;
        masterCategoryId?: string;
      };
  categoryId?: string;
  subCategoryId?: string;
  masterCategoryId?: string;
  imagePath?: string;
  [key: string]: unknown;
}

export interface SalesCartLine {
  productId: string;
  itemName: string;
  itemRef: string;
  unit: string;
  ratio: number;
  storeCost: number;
  quantityReq: number;
  unitReq: string;
  categoryId: string;
  masterCategoryId: string;
}

export interface PendingOrder {
  _id: string;
  tempOrderInvoiceNo?: string;
  invoiceNumber?: string;
  storeName?: string;
  store?: {
    storeName?: string;
    name?: string;
    _id?: string;
    alias?: string;
    marks?: string;
    city?: string;
    country?: string;
  };
  totalAmount?: number;
  amount?: number;
  quantity?: number;
  qty?: number;
  date?: string;
  createdAt?: string;
  removalDate?: string;
  assignee?: string | { name?: string };
  firstCheck?: boolean;
  doubleCheck?: boolean;
  loadCheck?: boolean;
  totalPkg?: number;
  isGRV?: boolean;
  isDraft?: boolean;
  isTempStore?: boolean;
  city?: string;
  country?: string;
  status?: string;
  [key: string]: unknown;
}

export interface WarehouseCounts {
  pendingCheckCount: number;
  firstCheckCount: number;
  doubleCheckCount: number;
  loadCheckCount: number;
  totalPkgCount: number;
}

export type WarehouseCheckStep = 1 | 2 | 3;

export interface WarehouseCheckProduct {
  _id?: string;
  itemName?: string;
  itemRef?: string;
  unit?: string;
  ratio?: number;
  barcode?: string;
  stockCheck?: boolean;
  inQty?: { amountInCartons?: number; amountInUnits?: number };
}

export interface WarehouseCheckLine {
  product?: string | WarehouseCheckProduct;
  quantityReq?: number;
  quantityAv?: number;
  unitReq?: string;
  unitAv?: string;
  firstCheck?: boolean;
  doubleCheck?: boolean;
  loadCheck?: boolean;
  isChecked?: boolean;
  cartonId?: number[];
}

export interface WarehouseCheckOrder {
  _id: string;
  tempOrderInvoiceNo?: string;
  date?: string;
  createdAt?: string;
  assignee?: string;
  driver?: string;
  firstCheck?: boolean;
  doubleCheck?: boolean;
  loadCheck?: boolean;
  status?: string;
  isTempStore?: boolean;
  store?:
    | string
    | {
        _id?: string;
        storeName?: string;
        name?: string;
        marks?: string;
        alias?: string;
        city?: string;
        country?: string;
      };
  productDetails?: WarehouseCheckLine[];
}

export interface GrvInner {
  isGRV?: boolean;
  grvQty?: number;
  grvUnit?: string;
}

export interface DamagedInner {
  isDamaged?: boolean;
  damagedQty?: number;
  damagedUnit?: string;
}

export interface GrvLineProduct {
  _id?: string;
  itemName?: string;
  itemRef?: string;
  unit?: string;
  ratio?: number;
  masterCategoryId?: string;
  inQty?: { amountInCartons?: number; amountInUnits?: number };
}

export interface GrvLine {
  product?: string | GrvLineProduct;
  categoryId?: string;
  storeCost?: number;
  aggregateCost?: number;
  quantityAv?: number;
  unitAv?: string;
  isDamaged?: boolean;
  grv?: GrvInner;
  damaged?: DamagedInner;
  [key: string]: unknown;
}

export interface GrvOrder {
  _id: string;
  invoiceNumber?: string;
  storeName?: string;
  store?: { _id?: string; storeName?: string; name?: string };
  sales?: string | { _id?: string; name?: string };
  totalAmount?: number;
  totalCost?: number;
  createdAt?: string;
  date?: string;
  productDetails?: GrvLine[];
  categoryList?: { masterCategoryId?: string; isGRV?: boolean; isDone?: boolean }[];
  isGRV?: boolean;
  [key: string]: unknown;
}

export type GrvDisposition = "inventory" | "damaged";

export interface PaymentRecord {
  _id: string;
  amountPaid?: number;
  balance?: number;
  date?: string;
  currency?: string;
  paymentMode?: string;
  note?: string;
  chequeNo?: number | string;
  order?:
    | string
    | {
        _id?: string;
        totalCost?: number;
        invoiceNumber?: string;
        date?: string;
        store?: { storeName?: string; name?: string };
      };
  [key: string]: unknown;
}

export interface PdcRecord {
  _id: string;
  amount?: number;
  givenDate?: string;
  chequeDate?: string;
  creditDays?: number;
  order?:
    | string
    | {
        _id?: string;
        totalCost?: number;
        invoiceNumber?: string;
        date?: string;
      };
  [key: string]: unknown;
}

export type ApprovalStatus = "none" | "pending" | "approved" | "rejected";

export interface ApprovalLineItem {
  product?:
    | string
    | { _id?: string; itemName?: string; itemRef?: string; sellingPrice?: number; unit?: string };
  categoryId?: string;
  storeCost?: number;
  aggregateCost?: number;
  quantityReq?: number;
  quantityAv?: number;
  unitReq?: string;
  unitAv?: string;
  isChecked?: boolean;
  cartonId?: number[];
  [key: string]: unknown;
}

export interface ApprovalOrder {
  _id: string;
  tempOrderInvoiceNo?: string;
  invoiceType?: string;
  billOfEntry?: number | string;
  note?: string;
  discount?: number;
  isVat?: boolean;
  status?: string;
  isDraft?: boolean;
  isTempStore?: boolean;
  totalQuantity?: number;
  totalCost?: number;
  payableAmount?: number;
  payableEdited?: boolean;
  needsApproval?: boolean;
  approvalStatus?: ApprovalStatus | string;
  rejectNote?: string;
  date?: string;
  createdAt?: string;
  updatedAt?: string;
  sales?: string | { _id?: string; name?: string; email?: string };
  store?:
    | string
    | {
        _id?: string;
        storeName?: string;
        name?: string;
      };
  productDetails?: ApprovalLineItem[];
  categoryList?: { masterCategoryId?: string; isDone?: boolean }[];
  [key: string]: unknown;
}
