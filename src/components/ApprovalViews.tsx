import type { ApprovalLineItem, ApprovalOrder } from "@/lib/types";
import {
  approvalInvoice,
  approvalMoney,
  approvalPayable,
  approvalRejectNote,
  approvalSalesName,
  approvalStoreName,
  lineProductName,
  salesQueueStatus,
  salesQueueStatusLabel,
} from "@/lib/approval";
import { Card } from "@/components/ui";

export function statusClass(status?: string) {
  if (status === "approved") return "text-emerald-700";
  if (status === "rejected") return "text-red-700";
  return "text-slate-700";
}

export function ApprovalSummary({
  order,
  showSalesman = false,
}: {
  order: ApprovalOrder;
  showSalesman?: boolean;
}) {
  const status = salesQueueStatus(order);
  return (
    <div className="min-w-0">
      <p className="font-semibold text-black">{approvalInvoice(order)}</p>
      <p className="mt-0.5 text-sm text-slate-600">{approvalStoreName(order)}</p>
      {showSalesman && approvalSalesName(order) ? (
        <p className="text-sm text-slate-600">Sales: {approvalSalesName(order)}</p>
      ) : null}
      <p className="mt-1 text-sm font-semibold text-ink">
        {approvalMoney(approvalPayable(order))}
      </p>
      {Number(order.discount) > 0 ? (
        <p className="text-sm text-slate-600">Discount: {order.discount}%</p>
      ) : null}
      {order.payableEdited ? (
        <p className="text-sm text-slate-600">Payable was edited by salesman</p>
      ) : null}
      <p className={`mt-2 text-sm font-semibold ${statusClass(status)}`}>
        {salesQueueStatusLabel(order)}
      </p>
      {approvalRejectNote(order) ? (
        <p className="mt-1 text-sm text-slate-600">
          Admin note: {approvalRejectNote(order)}
        </p>
      ) : null}
    </div>
  );
}

export function ApprovalDetails({ order }: { order: ApprovalOrder }) {
  const lines = Array.isArray(order.productDetails) ? order.productDetails : [];
  return (
    <div className="space-y-4">
      <Card>
        <DetailRow label="Invoice" value={approvalInvoice(order)} />
        <DetailRow label="Store" value={approvalStoreName(order)} />
        {approvalSalesName(order) ? (
          <DetailRow label="Salesman" value={approvalSalesName(order)} />
        ) : null}
        <DetailRow
          label="Status"
          value={salesQueueStatusLabel(order)}
        />
        {order.note && order.note !== "No note" ? (
          <DetailRow label="Order note" value={order.note} />
        ) : null}
        {approvalRejectNote(order) ? (
          <DetailRow label="Admin note" value={approvalRejectNote(order)} />
        ) : null}
      </Card>
      <Card>
        <p className="mb-3 text-sm font-semibold text-black">Items</p>
        {lines.length === 0 ? (
          <p className="text-sm text-slate-500">No line items</p>
        ) : (
          <ul className="divide-y divide-line">
            {lines.map((line, index) => {
              return (
                <li
                  key={`${lineProductKey(line, index)}`}
                  className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium text-black">
                      {lineProductName(line)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {line.quantityReq ?? 0} {line.unitReq || ""}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-black">
                    {approvalMoney(line.aggregateCost ?? line.storeCost ?? 0)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Card>
        <DetailRow label="Subtotal" value={approvalMoney(order.totalCost)} />
        {Number(order.discount) > 0 ? (
          <DetailRow label="Discount" value={`${order.discount}%`} />
        ) : null}
        {order.isVat ? <DetailRow label="VAT" value="5%" /> : null}
        {order.payableEdited ? (
          <DetailRow label="Payable edited" value="Yes" />
        ) : null}
        <div className="mt-3 border-t border-line pt-3">
          <DetailRow
            label="Payable"
            value={approvalMoney(approvalPayable(order))}
            emphasize
          />
        </div>
      </Card>
    </div>
  );
}

function lineProductKey(line: ApprovalLineItem, index: number) {
  if (line.product && typeof line.product === "object") {
    return line.product._id || index;
  }
  if (typeof line.product === "string") return line.product;
  return index;
}

function DetailRow({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <p
        className={`text-sm ${
          emphasize ? "font-semibold text-black" : "text-slate-500"
        }`}
      >
        {label}
      </p>
      <p
        className={`max-w-[60%] text-right text-sm ${
          emphasize ? "font-semibold text-ink" : "font-medium text-black"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
