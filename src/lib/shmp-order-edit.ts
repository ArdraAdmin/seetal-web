import type { ApprovalLineItem, ApprovalOrder, Product } from "./types";
import {
  lineProductId,
  resubmitTempOrderPayload,
  salesIdFromOrder,
  storeIdFromOrder,
} from "./approval";
import {
  cartTotals,
  lineAggregate,
  lineUnitPriceEdited,
  productMasterCategoryId,
  productRatio,
  productUnit,
  productUnitPrice,
  roundMoney,
} from "./sales";
import { cartLineFromProduct } from "./sales-cart";
import { dispatchFromLines, orderSection, type OrderSection } from "./shmp-orders";

export type ShmpEditLine = {
  productId: string;
  itemName: string;
  itemRef: string;
  unit: string;
  ratio: number;
  storeCost: number;
  catalogStoreCost: number;
  quantityReq: number;
  unitReq: string;
  categoryId: string;
  masterCategoryId: string;
  productionStatus?: string;
  assignedWorkers?: unknown[];
  manualCompletedQty?: number | null;
  isChecked?: boolean;
  cartonId?: number[];
  packedQty: number;
  deliveredQty: number;
};

export type ShmpOrderEditDetail = {
  order?: ApprovalOrder & {
    status?: string;
    company?: unknown;
  };
  lines?: Array<{
    product?: { _id?: string; itemName?: string; itemRef?: string; unit?: string; ratio?: number; sellingPrice?: number } | string;
    categoryId?: string;
    ordered?: number;
    produced?: number;
    delivered?: number;
    ready?: number;
    manualCompletedQty?: number | null;
    productionStatus?: string;
    assignedWorkers?: unknown[];
  }>;
};

function asProductObject(product: ApprovalLineItem["product"]) {
  return product && typeof product === "object" ? product : null;
}

/** Prefer catalog ratio; otherwise reverse from a saved aggregate for CARTONS. */
export function ratioFromApprovalLine(line: ApprovalLineItem) {
  const product = asProductObject(line.product);
  const fromProduct = Number(product && "ratio" in product ? product.ratio : 0) || 0;
  if (fromProduct > 0) return fromProduct;
  const qty = Number(line.quantityReq) || 0;
  const cost = Number(line.storeCost) || 0;
  const agg = Number(line.aggregateCost) || 0;
  if (
    String(line.unitReq || "").toUpperCase() === "CARTONS" &&
    qty > 0 &&
    cost > 0 &&
    agg > 0
  ) {
    return agg / (qty * cost);
  }
  return 1;
}

export function shmpEditLinesFromDetail(detail: ShmpOrderEditDetail): ShmpEditLine[] {
  const order = detail.order;
  const details = Array.isArray(order?.productDetails) ? order.productDetails : [];
  const summaryByProduct = new Map(
    (detail.lines || []).map((line) => {
      const product = line.product;
      const productId =
        product && typeof product === "object"
          ? String(product._id || "")
          : typeof product === "string"
            ? product
            : "";
      return [productId, line] as const;
    }),
  );

  const lines: ShmpEditLine[] = [];
  for (const line of details) {
    const productId = lineProductId(line);
    if (!productId) continue;
    const product = asProductObject(line.product);
    const summary = summaryByProduct.get(productId);
    const ratio = ratioFromApprovalLine(line);
    const unitReq = String(line.unitReq || product?.unit || "CARTONS");
    const storeCost = Number(line.storeCost) || 0;
    const catalog =
      line.catalogStoreCost != null
        ? Number(line.catalogStoreCost)
        : Number(product?.sellingPrice);
    const categoryFromProduct =
      product && typeof (product as { category?: unknown }).category === "string"
        ? (product as { category: string }).category
        : product &&
            typeof (product as { category?: { _id?: string } }).category === "object"
          ? String(
              (product as { category?: { _id?: string } }).category?._id || "",
            )
          : "";
    lines.push({
      productId,
      itemName: product?.itemName || "Item",
      itemRef: product?.itemRef || productId,
      unit: product?.unit || unitReq || "PCS",
      ratio,
      storeCost,
      catalogStoreCost: Number.isFinite(catalog) ? catalog : storeCost,
      quantityReq: Number(line.quantityReq) || 0,
      unitReq,
      categoryId: String(line.categoryId || categoryFromProduct || ""),
      masterCategoryId: String(
        (line as { masterCategoryId?: string }).masterCategoryId ||
          (product && "masterCategoryId" in product
            ? (product as { masterCategoryId?: string }).masterCategoryId
            : "") ||
          "",
      ),
      productionStatus: String(
        summary?.productionStatus ||
          (line as { productionStatus?: string }).productionStatus ||
          "Pending",
      ),
      assignedWorkers:
        summary?.assignedWorkers ||
        (line as { assignedWorkers?: unknown[] }).assignedWorkers ||
        [],
      manualCompletedQty:
        summary?.manualCompletedQty ??
        (line as { manualCompletedQty?: number | null }).manualCompletedQty ??
        null,
      isChecked: Boolean(line.isChecked),
      cartonId: Array.isArray(line.cartonId) ? line.cartonId : undefined,
      packedQty: Number(summary?.produced ?? 0) || 0,
      deliveredQty: Number(summary?.delivered ?? 0) || 0,
    });
  }
  return lines;
}

export function shmpOrderSectionFromDetail(detail: ShmpOrderEditDetail): OrderSection {
  if (detail.order?.status === "Delivered") return "delivered";
  const dispatch = dispatchFromLines(
    (detail.lines || []).map((line) => ({
      ordered: line.ordered,
      produced: line.produced,
      delivered: line.delivered,
      ready: line.ready,
    })),
  );
  return orderSection({ status: detail.order?.status, dispatch });
}

export function updateShmpEditLine(
  lines: ShmpEditLine[],
  productId: string,
  patch: Partial<ShmpEditLine>,
) {
  return lines
    .map((line) => (line.productId === productId ? { ...line, ...patch } : line))
    .filter((line) => line.quantityReq > 0);
}

export function removeShmpEditLine(lines: ShmpEditLine[], productId: string) {
  return lines.filter((line) => line.productId !== productId);
}

export function addProductToShmpEditLines(
  lines: ShmpEditLine[],
  product: Product,
  quantity: number,
  unitReq: string,
): { lines: ShmpEditLine[]; error?: string } {
  const cartLine = cartLineFromProduct(product, quantity, unitReq);
  if (!cartLine) {
    return { lines, error: "This product is missing a category and cannot be ordered" };
  }
  if (quantity <= 0) return { lines, error: "Enter a quantity first" };
  const nextLine: ShmpEditLine = {
    productId: cartLine.productId,
    itemName: cartLine.itemName,
    itemRef: cartLine.itemRef,
    unit: cartLine.unit,
    ratio: cartLine.ratio,
    storeCost: cartLine.storeCost,
    catalogStoreCost: cartLine.catalogStoreCost,
    quantityReq: cartLine.quantityReq,
    unitReq: cartLine.unitReq,
    categoryId: cartLine.categoryId,
    masterCategoryId: cartLine.masterCategoryId,
    productionStatus: "Pending",
    assignedWorkers: [],
    manualCompletedQty: null,
    packedQty: 0,
    deliveredQty: 0,
  };
  const index = lines.findIndex((line) => line.productId === nextLine.productId);
  if (index >= 0) {
    const copy = [...lines];
    copy[index] = {
      ...copy[index],
      ...nextLine,
      packedQty: copy[index].packedQty,
      deliveredQty: copy[index].deliveredQty,
      productionStatus: copy[index].productionStatus,
      assignedWorkers: copy[index].assignedWorkers,
      manualCompletedQty: copy[index].manualCompletedQty,
    };
    return { lines: copy };
  }
  return { lines: [...lines, nextLine] };
}

export function shmpEditLineAggregate(line: ShmpEditLine) {
  return lineAggregate({
    storeCost: line.storeCost,
    quantityReq: line.quantityReq,
    unitReq: line.unitReq,
    ratio: line.ratio || productRatio({ ratio: line.ratio } as Product) || 1,
  });
}

export function shmpEditCartTotals(lines: ShmpEditLine[]) {
  return cartTotals(
    lines.map((line) => ({
      productId: line.productId,
      itemName: line.itemName,
      itemRef: line.itemRef,
      unit: line.unit,
      ratio: line.ratio || 1,
      storeCost: line.storeCost,
      catalogStoreCost: line.catalogStoreCost,
      quantityReq: line.quantityReq,
      unitReq: line.unitReq,
      categoryId: line.categoryId,
      masterCategoryId: line.masterCategoryId,
    })),
  );
}

export function buildShmpEditTempOrderPayload(
  order: ApprovalOrder,
  lines: ShmpEditLine[],
  {
    discount,
    payableAmount,
    payableEdited,
    note,
    date,
  }: {
    discount: number;
    payableAmount: number;
    payableEdited: boolean;
    note: string;
    date: string;
  },
) {
  const { totalCost, totalQuantity } = shmpEditCartTotals(lines);
  const productDetails: ApprovalLineItem[] = lines.map((line) => {
    const storeCost = Number(line.storeCost) || 0;
    const catalogStoreCost =
      line.catalogStoreCost == null
        ? storeCost
        : Number(line.catalogStoreCost) || 0;
    const priceChangeReq = lineUnitPriceEdited({
      storeCost,
      catalogStoreCost,
      priceChangeReq: false,
    });
    return {
      product: line.productId,
      categoryId: line.categoryId,
      storeCost,
      catalogStoreCost,
      priceChangeReq,
      aggregateCost: shmpEditLineAggregate(line),
      quantityReq: Number(line.quantityReq) || 0,
      quantityAv: Number(line.quantityReq) || 0,
      unitReq: String(line.unitReq || "CARTONS"),
      unitAv: String(line.unitReq || "CARTONS"),
      isChecked: Boolean(line.isChecked),
    };
  });

  const categoryList: { masterCategoryId: string; isDone: boolean }[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const master = line.masterCategoryId || "none";
    if (seen.has(master)) continue;
    seen.add(master);
    const existing = (order.categoryList || []).find(
      (item) => String(item.masterCategoryId || "") === master,
    );
    categoryList.push({
      masterCategoryId: master,
      isDone: Boolean(existing?.isDone),
    });
  }

  const unitPriceEdited = lines.some((line) =>
    lineUnitPriceEdited({
      storeCost: line.storeCost,
      catalogStoreCost: line.catalogStoreCost,
    }),
  );

  const draft: ApprovalOrder = {
    ...order,
    productDetails,
    categoryList,
    totalCost,
    totalQuantity,
    discount,
    note,
    date,
    payableAmount,
    payableEdited,
    unitPriceEdited,
  };

  const base = resubmitTempOrderPayload(draft, {
    salesId: salesIdFromOrder(order),
    discount,
    payableAmount,
    payableEdited,
    needsApproval: false,
    note,
    date,
  });

  return {
    ...base,
    storeId: storeIdFromOrder(order),
    totalCost,
    totalQuantity,
    placeApprovedOrder: true,
    needsApproval: false,
  };
}

export function packedQtyPayload(lines: ShmpEditLine[]) {
  return lines.map((line) => ({
    productId: line.productId,
    completedQty: Math.max(0, Number(line.packedQty) || 0),
  }));
}

export function validateShmpEditLines(lines: ShmpEditLine[]) {
  if (lines.length === 0) return "Add at least one product";
  for (const line of lines) {
    if (!line.categoryId) {
      return `${line.itemName} is missing a category and cannot be saved`;
    }
    if ((Number(line.packedQty) || 0) > (Number(line.quantityReq) || 0) + 0.0001) {
      return `${line.itemName}: packed qty cannot exceed ordered qty`;
    }
    if ((Number(line.deliveredQty) || 0) > (Number(line.packedQty) || 0) + 0.0001) {
      return `${line.itemName}: packed qty cannot be below delivered qty`;
    }
  }
  return null;
}

export function productLabelFromCatalog(product: Product) {
  return {
    name: product.itemName || "Product",
    unit: productUnit(product),
    price: productUnitPrice(product),
    masterCategoryId: productMasterCategoryId(product),
  };
}

export function roundEditMoney(value: number) {
  return roundMoney(value);
}
