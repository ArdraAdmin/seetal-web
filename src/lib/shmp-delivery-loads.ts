import type { ReadyDeliveryLine } from "./shmp-orders";

export type DeliveryLoadQtyMap = Record<string, string>;

export type DeliveryLoadDraft = {
  key: string;
  vehicleId: string;
  qtys: DeliveryLoadQtyMap;
};

export type DeliveryLoadPayload = {
  key: string;
  vehicleId: string;
  lines: Array<{ productId: string; qty: number }>;
};

let loadKeySeq = 0;

export function newDeliveryLoadKey() {
  loadKeySeq += 1;
  return `load-${loadKeySeq}`;
}

export function emptyDeliveryLoad(
  productIds: string[] = [],
): DeliveryLoadDraft {
  const qtys: DeliveryLoadQtyMap = {};
  for (const productId of productIds) qtys[productId] = "";
  return {
    key: newDeliveryLoadKey(),
    vehicleId: "",
    qtys,
  };
}

export function parseLoadQty(value: string | undefined) {
  if (value == null || value.trim() === "") return 0;
  const qty = Number(value);
  if (!Number.isFinite(qty) || qty < 0) return 0;
  return qty;
}

export function allocatedQtyForProduct(
  loads: DeliveryLoadDraft[],
  productId: string,
  exceptKey?: string,
) {
  let sum = 0;
  for (const load of loads) {
    if (exceptKey && load.key === exceptKey) continue;
    sum += parseLoadQty(load.qtys[productId]);
  }
  return sum;
}

export function remainingQtyForProduct(
  available: number,
  loads: DeliveryLoadDraft[],
  productId: string,
  exceptKey?: string,
) {
  return Math.max(
    0,
    (Number(available) || 0) -
      allocatedQtyForProduct(loads, productId, exceptKey),
  );
}

export function loadCartonTotal(load: DeliveryLoadDraft) {
  let sum = 0;
  for (const value of Object.values(load.qtys)) sum += parseLoadQty(value);
  return sum;
}

export function unassignedCartons(
  lines: ReadyDeliveryLine[],
  loads: DeliveryLoadDraft[],
) {
  return lines.reduce((sum, line) => {
    const remaining = remainingQtyForProduct(line.qty, loads, line.productId);
    return sum + remaining;
  }, 0);
}

export function maxQtyInputForLoad(
  available: number,
  loads: DeliveryLoadDraft[],
  productId: string,
  loadKey: string,
) {
  return remainingQtyForProduct(available, loads, productId, loadKey);
}

function qtyInputString(raw: string, capped: number) {
  if (raw.trim() === "") return "";
  return String(capped);
}

/**
 * Earlier loads keep their cartons first. Later loads are cut so the product
 * total never exceeds what is ready.
 */
export function reconcileProductQtys(
  loads: DeliveryLoadDraft[],
  productId: string,
  available: number,
): DeliveryLoadDraft[] {
  let left = Math.max(0, Math.floor(Number(available) || 0));
  return loads.map((load) => {
    const raw = load.qtys[productId];
    if (raw == null || String(raw).trim() === "") return load;
    const qty = Math.floor(parseLoadQty(raw));
    const capped = Math.min(Math.max(0, qty), left);
    left -= capped;
    const next = qtyInputString(String(raw), capped);
    if (next === raw) return load;
    return {
      ...load,
      qtys: { ...load.qtys, [productId]: next },
    };
  });
}

/** Set a load qty and clamp every load so totals stay within ready cartons. */
export function setLoadProductQty(
  loads: DeliveryLoadDraft[],
  loadKey: string,
  productId: string,
  raw: string,
  available: number,
): DeliveryLoadDraft[] {
  const cap = Math.max(0, Math.floor(Number(available) || 0));
  let nextValue: string;
  if (raw.trim() === "") {
    nextValue = "";
  } else {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      nextValue = "";
    } else {
      nextValue = String(Math.min(Math.floor(parsed), cap));
    }
  }

  const updated = loads.map((load) =>
    load.key === loadKey
      ? { ...load, qtys: { ...load.qtys, [productId]: nextValue } }
      : load,
  );
  return reconcileProductQtys(updated, productId, available);
}

/** Builds API payloads; skips empty loads. Returns an error string when invalid. */
export function validateAndBuildDeliveryLoads(
  lines: ReadyDeliveryLine[],
  loads: DeliveryLoadDraft[],
): { payloads: DeliveryLoadPayload[]; error: string | null } {
  const available = new Map(lines.map((line) => [line.productId, line.qty]));
  const used = new Map<string, number>();
  const payloads: DeliveryLoadPayload[] = [];

  for (const load of loads) {
    const built: Array<{ productId: string; qty: number }> = [];
    for (const [productId, raw] of Object.entries(load.qtys)) {
      const qty = parseLoadQty(raw);
      if (qty <= 0) continue;
      if (!available.has(productId)) {
        return {
          payloads: [],
          error: "A product on this delivery is no longer ready.",
        };
      }
      if (!Number.isInteger(qty)) {
        return {
          payloads: [],
          error: "Carton quantities must be whole numbers.",
        };
      }
      built.push({ productId, qty });
    }

    if (!built.length) {
      if (load.vehicleId) {
        return {
          payloads: [],
          error: "Each selected vehicle needs at least one carton.",
        };
      }
      continue;
    }

    if (!load.vehicleId) {
      return {
        payloads: [],
        error: "Select a vehicle for every load that has cartons.",
      };
    }

    for (const line of built) {
      const already = used.get(line.productId) || 0;
      const cap = available.get(line.productId) || 0;
      if (already + line.qty > cap + 0.0001) {
        return {
          payloads: [],
          error: "Carton quantities exceed what is ready to deliver.",
        };
      }
      used.set(line.productId, already + line.qty);
    }

    payloads.push({
      key: load.key,
      vehicleId: load.vehicleId,
      lines: built,
    });
  }

  if (!payloads.length) {
    return {
      payloads: [],
      error: "Assign at least one carton to a vehicle.",
    };
  }

  return { payloads, error: null };
}
