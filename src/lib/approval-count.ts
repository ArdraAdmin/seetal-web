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

export const APPROVALS_CHANGED_EVENT = "stl-approvals-changed";

export function notifyApprovalsChanged(count?: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(APPROVALS_CHANGED_EVENT, {
      detail: typeof count === "number" ? { count } : {},
    }),
  );
}
