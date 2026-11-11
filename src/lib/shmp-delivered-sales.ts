import type { AdminKpiDashboard, AdminSalesmanBreakdown } from "./stl-features-api";

const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;

export type DeliveredProduct = {
  productId: string;
  name: string;
  itemCode?: string;
  revenue: number;
  qty: number;
};

export type DeliveredSalesman = {
  salesId: string;
  name: string;
  email?: string;
  delivered: number;
};

export type DeliveredStore = {
  storeId: string;
  name: string;
  address?: string;
  value: number;
  orders: number;
};

export type DeliveredOrder = {
  orderId: string;
  invoiceNumber?: string;
  date?: string;
  storeId?: string;
  storeName?: string;
  amount: number;
  companyKey: "shmp";
};

export type ShmpDeliveredSales = {
  year: number;
  month: number;
  previousYear: number;
  previousMonth: number;
  currentTotal: number;
  previousTotal: number;
  products: DeliveredProduct[];
  salesmen: DeliveredSalesman[];
  trips: DeliveryTrip[];
};

type DeliveryLine = {
  qty?: number | null;
  lineValue?: number | null;
  product?:
    | { _id?: string; itemName?: string; itemRef?: string }
    | string
    | null;
};

type DeliveryTrip = {
  _id?: string;
  deliveryDate?: string | Date | null;
  totalValue?: number | null;
  lines?: DeliveryLine[] | null;
  tempOrder?:
    | {
        _id?: string;
        tempOrderInvoiceNo?: string;
        sales?: { _id?: string; name?: string; email?: string } | string | null;
      }
    | string
    | null;
  store?: { _id?: string; storeName?: string; name?: string } | string | null;
};

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function dubaiYearMonth(value: Date) {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
  }).format(value);
  const [year, month] = formatted.split("-").map((part) => Number(part));
  return { year, month };
}

function shiftMonth(year: number, month: number, delta: number) {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

function dubaiMonthBounds(year: number, month: number) {
  return {
    start: new Date(Date.UTC(year, month - 1, 1) - DUBAI_OFFSET_MS),
    end: new Date(Date.UTC(year, month, 1) - DUBAI_OFFSET_MS),
  };
}

function asTrip(value: unknown): DeliveryTrip | null {
  if (!value || typeof value !== "object") return null;
  return value as DeliveryTrip;
}

function tripValue(trip: DeliveryTrip) {
  const fromLines = (trip.lines || []).reduce(
    (sum, line) => sum + (Number(line.lineValue) || 0),
    0,
  );
  const total = Number(trip.totalValue);
  if (Number.isFinite(total) && total > 0) return total;
  return fromLines;
}

function salesOf(trip: DeliveryTrip) {
  const order = trip.tempOrder;
  if (!order || typeof order !== "object") return null;
  const sales = order.sales;
  if (!sales || typeof sales !== "object" || !sales._id) return null;
  return {
    salesId: String(sales._id),
    name: sales.name || sales.email || "Salesman",
    email: sales.email || "",
  };
}

function inMonth(trip: DeliveryTrip, year: number, month: number) {
  if (!trip.deliveryDate) return false;
  const date = new Date(trip.deliveryDate);
  if (Number.isNaN(date.getTime())) return false;
  const parts = dubaiYearMonth(date);
  return parts.year === year && parts.month === month;
}

function summarizeTrips(trips: DeliveryTrip[]) {
  let total = 0;
  const products = new Map<string, DeliveredProduct>();
  const salesmen = new Map<string, DeliveredSalesman>();
  for (const trip of trips) {
    total += tripValue(trip);
    const sales = salesOf(trip);
    if (sales) {
      const row = salesmen.get(sales.salesId) || { ...sales, delivered: 0 };
      row.delivered += tripValue(trip);
      salesmen.set(sales.salesId, row);
    }
    for (const line of trip.lines || []) {
      const product = line.product;
      const productId =
        product && typeof product === "object"
          ? String(product._id || "")
          : String(product || "");
      if (!productId) continue;
      const prev = products.get(productId) || {
        productId,
        name:
          product && typeof product === "object" && product.itemName
            ? product.itemName
            : "Item",
        itemCode:
          product && typeof product === "object" ? product.itemRef || "" : "",
        revenue: 0,
        qty: 0,
      };
      prev.revenue += Number(line.lineValue) || 0;
      prev.qty += Number(line.qty) || 0;
      products.set(productId, prev);
    }
  }
  return {
    total: round2(total),
    products: [...products.values()]
      .map((row) => ({
        ...row,
        revenue: round2(row.revenue),
        qty: round2(row.qty),
      }))
      .sort((a, b) => b.revenue - a.revenue),
    salesmen: [...salesmen.values()]
      .map((row) => ({ ...row, delivered: round2(row.delivered) }))
      .sort((a, b) => b.delivered - a.delivered),
  };
}

export function summarizeShmpDeliveries(
  currentTrips: unknown,
  previousTrips: unknown,
  now = new Date(),
): ShmpDeliveredSales {
  const currentParts = dubaiYearMonth(now);
  const previousParts = shiftMonth(currentParts.year, currentParts.month, -1);
  const current = (Array.isArray(currentTrips) ? currentTrips : [])
    .map(asTrip)
    .filter((trip): trip is DeliveryTrip => Boolean(trip))
    .filter((trip) => inMonth(trip, currentParts.year, currentParts.month));
  const previous = (Array.isArray(previousTrips) ? previousTrips : [])
    .map(asTrip)
    .filter((trip): trip is DeliveryTrip => Boolean(trip))
    .filter((trip) =>
      inMonth(trip, previousParts.year, previousParts.month),
    );
  const currentSummary = summarizeTrips(current);
  const previousSummary = summarizeTrips(previous);
  return {
    year: currentParts.year,
    month: currentParts.month,
    previousYear: previousParts.year,
    previousMonth: previousParts.month,
    currentTotal: currentSummary.total,
    previousTotal: previousSummary.total,
    products: currentSummary.products,
    salesmen: currentSummary.salesmen,
    trips: current,
  };
}

function blankKpi(): AdminKpiDashboard {
  return {
    now: { date: "", time: "", timezone: "Asia/Dubai" },
    companyKey: "shmp",
    companyId: null,
    topSalesman: null,
    topProducts: [],
    salesmanGraph: [],
    monthlySales: {
      current: { year: 0, month: 0, total: 0 },
      previous: { year: 0, month: 0, total: 0 },
      delta: 0,
      deltaPct: null,
    },
    users: { total: 0, salesmen: 0, warehouse: 0, admins: 0, supervisors: 0 },
    inventoryValue: 0,
    salesLost: { totalLost: 0, lineCount: 0, year: 0, month: 0 },
    visaExpiry: { count: 0, employees: [], users: [] },
  };
}

/** Replace confirmed-order sales with factory deliveries. */
export function withShmpDeliveredSales(
  kpi: AdminKpiDashboard | null,
  summary: ShmpDeliveredSales,
): AdminKpiDashboard {
  const base = kpi || blankKpi();
  const targetById = new Map(
    (base.salesmanGraph || []).map((row) => [String(row.salesId), row.target]),
  );
  const delta = round2(summary.currentTotal - summary.previousTotal);
  const salesmen = summary.salesmen
    .filter((row) => row.delivered > 0)
    .map((row) => ({
      salesId: row.salesId,
      name: row.name,
      delivered: row.delivered,
      target: targetById.get(row.salesId) ?? null,
      stl: 0,
      shmp: row.delivered,
    }));
  const top = salesmen[0] || null;
  const target = top?.target ?? null;
  return {
    ...base,
    companyKey: "shmp",
    monthlySales: {
      current: {
        year: summary.year,
        month: summary.month,
        total: summary.currentTotal,
      },
      previous: {
        year: summary.previousYear,
        month: summary.previousMonth,
        total: summary.previousTotal,
      },
      delta,
      deltaPct:
        summary.previousTotal > 0
          ? round2((delta * 100) / summary.previousTotal)
          : null,
    },
    topProducts: summary.products.slice(0, 10),
    salesmanGraph: salesmen,
    topSalesman: top
      ? {
          salesId: top.salesId,
          name: top.name,
          email: summary.salesmen.find((row) => row.salesId === top.salesId)?.email,
          delivered: top.delivered,
          target,
          progress:
            target && target > 0
              ? round2(Math.min(100, (top.delivered * 100) / target))
              : null,
        }
      : null,
  };
}

export function salesmanFromDeliveries(
  summary: ShmpDeliveredSales,
  salesId: string,
  base: AdminSalesmanBreakdown | null,
): AdminSalesmanBreakdown {
  const mine = summary.trips.filter((trip) => salesOf(trip)?.salesId === salesId);
  const rolled = summarizeTrips(mine);
  const stores = new Map<string, DeliveredStore>();
  const orders: DeliveredOrder[] = [];
  for (const trip of mine) {
    const amount = round2(tripValue(trip));
    const store = trip.store;
    const storeId =
      store && typeof store === "object"
        ? String(store._id || "")
        : String(store || "");
    const storeName =
      store && typeof store === "object"
        ? store.storeName || store.name || "Store"
        : "Store";
    if (storeId) {
      const row = stores.get(storeId) || {
        storeId,
        name: storeName,
        value: 0,
        orders: 0,
      };
      row.value = round2(row.value + amount);
      row.orders += 1;
      stores.set(storeId, row);
    }
    const order = trip.tempOrder;
    orders.push({
      orderId:
        order && typeof order === "object" && order._id
          ? String(order._id)
          : String(trip._id || ""),
      invoiceNumber:
        order && typeof order === "object" ? order.tempOrderInvoiceNo : "",
      date: trip.deliveryDate ? String(trip.deliveryDate) : undefined,
      storeId,
      storeName,
      amount,
      companyKey: "shmp",
    });
  }
  const target = base?.target ?? null;
  const progress =
    target && target > 0
      ? round2(Math.min(100, (rolled.total * 100) / target))
      : null;
  const salesman = summary.salesmen.find((row) => row.salesId === salesId);
  return {
    salesman: {
      id: salesId,
      name: salesman?.name || base?.salesman.name,
      email: salesman?.email || base?.salesman.email,
    },
    year: summary.year,
    month: summary.month,
    companyKey: "shmp",
    delivered: rolled.total,
    target,
    progress,
    performance: {
      totalDelivered: round2((base?.performance.stl.delivered || 0) + rolled.total),
      stl: base?.performance.stl || {
        delivered: 0,
        target: null,
        progress: null,
      },
      shmp: {
        delivered: rolled.total,
        target: base?.performance.shmp.target ?? target,
        progress,
      },
    },
    products: rolled.products,
    stores: [...stores.values()].sort((a, b) => b.value - a.value),
    orders: orders.sort((a, b) => b.amount - a.amount),
  };
}

export async function loadShmpDeliveredSales(now = new Date()) {
  const { shmpDeliveries } = await import("./shmp-api");
  const currentParts = dubaiYearMonth(now);
  const previousParts = shiftMonth(currentParts.year, currentParts.month, -1);
  const currentBounds = dubaiMonthBounds(currentParts.year, currentParts.month);
  const previousBounds = dubaiMonthBounds(
    previousParts.year,
    previousParts.month,
  );
  const [currentTrips, previousTrips] = await Promise.all([
    shmpDeliveries({
      from: currentBounds.start.toISOString(),
      to: currentBounds.end.toISOString(),
    }),
    shmpDeliveries({
      from: previousBounds.start.toISOString(),
      to: previousBounds.end.toISOString(),
    }),
  ]);
  return summarizeShmpDeliveries(currentTrips, previousTrips, now);
}
