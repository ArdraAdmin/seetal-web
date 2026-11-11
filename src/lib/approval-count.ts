/** Orders still waiting for an admin decision. Approved and rejected stay in the queue. */
export function isWaitingApproval(order: { approvalStatus?: string | null }) {
  return String(order.approvalStatus ?? "pending").trim().toLowerCase() === "pending";
}

export function pendingApprovalCount(
  orders: Array<{ approvalStatus?: string | null }>,
) {
  return orders.reduce(
    (count, order) => count + (isWaitingApproval(order) ? 1 : 0),
    0,
  );
}

export function approvalCompanyId(order: { company?: unknown }): string {
  const company = order.company;
  if (typeof company === "string") return company;
  if (company && typeof company === "object" && "_id" in company) {
    return String((company as { _id?: unknown })._id || "");
  }
  return "";
}

export function countPendingForCompany(
  orders: Array<{ approvalStatus?: string | null; company?: unknown }>,
  companyId: string,
) {
  const id = companyId.trim();
  if (!id) return 0;
  return orders.reduce((count, order) => {
    if (!isWaitingApproval(order)) return count;
    return approvalCompanyId(order) === id ? count + 1 : count;
  }, 0);
}

export const APPROVALS_CHANGED_EVENT = "stl-approvals-changed";

export function notifyApprovalsChanged(count?: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(APPROVALS_CHANGED_EVENT, {
      detail: typeof count === "number" ? { count } : {},
    }),
  );
}
