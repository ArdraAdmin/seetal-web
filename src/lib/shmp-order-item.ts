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
