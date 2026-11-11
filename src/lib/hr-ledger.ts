import type { HrFine, HrLoan } from "./stl-features-api";

function round2(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function loanBalance(loan: Pick<HrLoan, "amount" | "repayments">): number {
  const repaid = (loan.repayments || []).reduce(
    (sum, row) => sum + (Number(row.amount) || 0),
    0,
  );
  return round2(Math.max(0, (Number(loan.amount) || 0) - repaid));
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type VoucherPrint = {
  title: string;
  voucherNo: string;
  date: string;
  staffName: string;
  amount: string;
  particulars: string;
  extra?: string;
};

export function voucherDocumentHtml(voucher: VoucherPrint) {
  const extra = voucher.extra
    ? `<tr><td>Reference</td><td>${escapeHtml(voucher.extra)}</td></tr>`
    : "";
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(voucher.title)} ${escapeHtml(voucher.voucherNo)}</title>
  <style>
    body { font-family: Georgia, serif; color: #111; margin: 48px; }
    h1 { font-size: 22px; margin: 0; }
    p { margin: 4px 0 0; color: #444; }
    table { width: 100%; border-collapse: collapse; margin-top: 28px; }
    td { padding: 8px 0; vertical-align: top; border-bottom: 1px solid #e5e5e5; }
    td:first-child { width: 160px; color: #555; }
    .amount { font-size: 28px; font-weight: 700; margin-top: 20px; }
    .signs { display: flex; justify-content: space-between; margin-top: 80px; }
    .sign { width: 42%; border-top: 1px solid #111; padding-top: 8px; font-size: 13px; }
  </style>
</head>
<body>
  <p>SHMP</p>
  <h1>${escapeHtml(voucher.title)}</h1>
  <p>${escapeHtml(voucher.voucherNo)}</p>
  <table>
    <tr><td>Date</td><td>${escapeHtml(voucher.date)}</td></tr>
    <tr><td>Staff</td><td>${escapeHtml(voucher.staffName)}</td></tr>
    <tr><td>Particulars</td><td>${escapeHtml(voucher.particulars || "—")}</td></tr>
    ${extra}
  </table>
  <p class="amount">${escapeHtml(voucher.amount)}</p>
  <div class="signs">
    <div class="sign">Prepared by</div>
    <div class="sign">Received by</div>
  </div>
</body>
</html>`;
}

export function printVoucher(voucher: VoucherPrint) {
  const popup = window.open("", "_blank", "width=800,height=900");
  if (!popup) throw new Error("Allow pop-ups to print this voucher");
  popup.document.open();
  popup.document.write(voucherDocumentHtml(voucher));
  popup.document.close();
  popup.focus();
  popup.print();
}

export function fineMonthKey(fine: Pick<HrFine, "date">): string {
  const text = String(fine.date || "");
  const match = /^(\d{4}-\d{2})/.exec(text);
  return match ? match[1] : "";
}
