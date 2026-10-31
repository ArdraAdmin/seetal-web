import { shmpOrderDetail } from "./shmp-api";
import {
  dispatchFromLines,
  type ShmpOrderDispatch,
} from "./shmp-orders";

type DispatchOrder = {
  _id?: string;
  dispatch?: ShmpOrderDispatch | null;
};

/** Older list responses omit dispatch. Fill it from each order's line quantities. */
export async function ensureOrderDispatch<T extends DispatchOrder>(
  orders: T[],
): Promise<T[]> {
  if (!orders.length) return orders;
  if (orders.some((order) => order.dispatch?.section)) return orders;

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
        const detail = (await shmpOrderDetail(id)) as {
          lines?: Array<{
            ordered?: number;
            produced?: number;
            delivered?: number;
            ready?: number;
          }>;
        };
        result[index] = {
          ...order,
          dispatch: dispatchFromLines(detail.lines || []),
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
