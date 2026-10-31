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

/** Assigned items can be marked complete. Pending items cannot. */
export function canMarkOrderItemComplete(line: {
  productionStatus?: string | null;
  assignedWorkers?: unknown[] | null;
}) {
  if (isOrderItemDone(line.productionStatus)) return false;
  if (String(line.productionStatus || "").trim() === "Assigned") return true;
  return Array.isArray(line.assignedWorkers) && line.assignedWorkers.length > 0;
}
