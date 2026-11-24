export type SplitAssignment = {
  employeeId: string;
  cartonQty: number;
};

export function remainingCartons(line: {
  remainingProduction?: number | null;
  ordered?: number | null;
  produced?: number | null;
}) {
  if (line.remainingProduction != null) {
    const remaining = Number(line.remainingProduction);
    if (Number.isFinite(remaining) && remaining >= 0) return remaining;
  }
  return Math.max(0, Number(line.ordered || 0) - Number(line.produced || 0));
}

export function parseSplitAssignments(
  rows: Array<{ employeeId: string; cartonQty: string }>,
  remaining: number,
):
  | { ok: true; workers: SplitAssignment[] }
  | { ok: false; error: string } {
  if (!rows.length) {
    return { ok: false, error: "Add at least one worker." };
  }
  const workers: SplitAssignment[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const employeeId = row.employeeId.trim();
    if (!employeeId) {
      return { ok: false, error: "Choose a worker for each row." };
    }
    if (seen.has(employeeId)) {
      return { ok: false, error: "Each worker can only be added once." };
    }
    seen.add(employeeId);
    const cartonQty = Number(row.cartonQty);
    if (!Number.isFinite(cartonQty) || cartonQty <= 0) {
      return {
        ok: false,
        error: "Enter how many cartons each worker packed.",
      };
    }
    workers.push({ employeeId, cartonQty });
  }
  const total = workers.reduce((sum, row) => sum + row.cartonQty, 0);
  if (total > remaining + 0.0001) {
    return {
      ok: false,
      error: `Only ${remaining} cartons are still unpacked.`,
    };
  }
  return { ok: true, workers };
}

export function assignedWorkerName(employee: unknown) {
  if (!employee || typeof employee === "string") return "Worker";
  if (typeof employee === "object" && "name" in employee) {
    const name = String((employee as { name?: string }).name || "").trim();
    return name || "Worker";
  }
  return "Worker";
}

export function isOrderItemDone(status?: string | null) {
  return String(status || "").trim() === "Done";
}

export function productionStatusClass(status?: string | null) {
  const value = String(status || "Pending").trim().toLowerCase();
  if (value === "done" || value === "completed") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (value === "assigned") return "bg-sky-100 text-sky-800";
  return "bg-amber-100 text-amber-900";
}

/** Assigned items can be marked complete. Pending items cannot. */
export function canMarkOrderItemComplete(line: {
  productionStatus?: string | null;
  assignedWorkers?: unknown[] | null;
}) {
  if (isOrderItemDone(line.productionStatus)) return false;
  if (String(line.productionStatus || "").trim() === "Assigned") return true;
  return Array.isArray(line.assignedWorkers) && line.assignedWorkers.length > 0;
}

/** True when the order line was placed in pieces rather than cartons. */
export function isPcsUnit(unit?: string | null) {
  const raw = String(unit || "").trim().toUpperCase();
  return raw === "PCS" || raw === "PC" || raw === "PIECE" || raw === "PIECES";
}

/** Display label for an order line unit (CARTONS / PCS). */
export function orderLineUnitLabel(unit?: string | null) {
  return isPcsUnit(unit) ? "pcs" : "cartons";
}

/** Format a carton count for display (trim trailing zeros from fractions). */
export function formatCartonQty(qty: number) {
  const n = Number(qty) || 0;
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n - Math.round(n)) < 0.0001) return String(Math.round(n));
  return String(Math.round(n * 100) / 100);
}

/** Convert a line qty into cartons when unitReq is PCS. */
export function qtyInCartons(
  qty: number | null | undefined,
  unit?: string | null,
  ratio?: number | null,
) {
  const n = Number(qty) || 0;
  if (!isPcsUnit(unit)) return n;
  const r = Number(ratio) || 0;
  if (!(r > 0)) return n;
  return n / r;
}

function productIdFromDetail(product: unknown) {
  if (!product) return "";
  if (typeof product === "string") return product;
  if (typeof product === "object" && product && "_id" in product) {
    return String((product as { _id?: string })._id || "");
  }
  return "";
}

/** Map product id → unitReq from saved order productDetails. */
export function unitReqByProductId(
  productDetails:
    | Array<{
        product?: string | { _id?: string } | null;
        unitReq?: string | null;
      }>
    | null
    | undefined,
) {
  const map = new Map<string, string>();
  for (const row of productDetails || []) {
    const id = productIdFromDetail(row.product);
    if (!id) continue;
    const unit = String(row.unitReq || "").trim();
    if (unit) map.set(id, unit);
  }
  return map;
}

/** Map product id → pieces-per-carton from populated productDetails. */
export function ratioByProductId(
  productDetails:
    | Array<{
        product?: string | { _id?: string; ratio?: number } | null;
      }>
    | null
    | undefined,
) {
  const map = new Map<string, number>();
  for (const row of productDetails || []) {
    const id = productIdFromDetail(row.product);
    if (!id) continue;
    const product = row.product;
    const ratio =
      product && typeof product === "object"
        ? Number(product.ratio) || 0
        : 0;
    if (ratio > 0) map.set(id, ratio);
  }
  return map;
}

/**
 * Line quantities stay in the line unit.
 * PCS: "2400 pcs ordered · 30 pcs packed · …"
 * CARTONS: "50 cartons ordered · 0 cartons packed · …"
 */
export function formatOrderItemQtyLine(input: {
  ordered?: number | null;
  produced?: number | null;
  ready?: number | null;
  delivered?: number | null;
  unit?: string | null;
}) {
  const unit = orderLineUnitLabel(input.unit);
  return [
    `${formatCartonQty(Number(input.ordered || 0))} ${unit} ordered`,
    `${formatCartonQty(Number(input.produced || 0))} ${unit} packed`,
    `${formatCartonQty(Number(input.ready || 0))} ${unit} ready`,
    `${formatCartonQty(Number(input.delivered || 0))} ${unit} delivered`,
  ].join(" · ");
}
