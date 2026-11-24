import { shmpOrderDetail } from "./shmp-api";
import {
  ratioByProductId,
  unitReqByProductId,
} from "./shmp-order-item";
import {
  dispatchFromLines,
  type ShmpOrderDispatch,
} from "./shmp-orders";

type DispatchOrder = {
  _id?: string;
  dispatch?: ShmpOrderDispatch | null;
  productDetails?: Array<{
    product?: string | { _id?: string; ratio?: number } | null;
    quantityReq?: number;
    unitReq?: string | null;
    manualCompletedQty?: number | null;
  }>;
};

type OrderDetailForDispatch = {
  order?: {
    productDetails?: Array<{
      product?: string | { _id?: string; ratio?: number } | null;
      unitReq?: string | null;
    }>;
  };
  lines?: Array<{
    product?: { _id?: string; unit?: string; ratio?: number };
    ordered?: number;
    produced?: number;
    delivered?: number;
    ready?: number;
    unitReq?: string;
    ratio?: number;
  }>;
};

export function dispatchFromOrderDetail(
  detail: OrderDetailForDispatch,
): ShmpOrderDispatch {
  const unitByProduct = unitReqByProductId(detail.order?.productDetails);
  const ratioByProduct = ratioByProductId(detail.order?.productDetails);
  return dispatchFromLines(
    (detail.lines || []).map((line) => {
      const pid = String(line.product?._id || "");
      return {
        ordered: line.ordered,
        produced: line.produced,
        delivered: line.delivered,
        ready: line.ready,
        unitReq:
          line.unitReq ||
          unitByProduct.get(pid) ||
          line.product?.unit ||
          "CARTONS",
        ratio: line.ratio || line.product?.ratio || ratioByProduct.get(pid) || 0,
      };
    }),
  );
}

/**
 * Prefer API dispatch when present, but always rebuild from order detail so
 * PCS lines are converted to cartons (list APIs may still return raw sums).
 */
export async function ensureOrderDispatch<T extends DispatchOrder>(
  orders: T[],
): Promise<T[]> {
  if (!orders.length) return orders;

  const result = new Array<T>(orders.length);
  let next = 0;

  async function worker() {
    while (next < orders.length) {
      const index = next;
      next += 1;
      const order = orders[index];
      const id = String(order._id || "");
      if (!id) {
        result[index] = order;
        continue;
      }
      try {
        const detail = (await shmpOrderDetail(id)) as OrderDetailForDispatch;
        result[index] = {
          ...order,
          dispatch: dispatchFromOrderDetail(detail),
        };
      } catch {
        result[index] = order;
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(6, orders.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return result;
}
