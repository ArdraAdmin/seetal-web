export type RmUsageLine = {
  kind?: string;
  name?: string;
  code?: string;
  qtyPerCarton?: number;
  quantity?: number;
  balance?: number | null;
};

export function formatRmQty(value: number) {
  const amount = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-AE", {
    maximumFractionDigits: 2,
  }).format(amount);
}

export function packagingSummary(lines: RmUsageLine[]) {
  let cartons = 0;
  let labels = 0;
  for (const line of lines) {
    const quantity = Number(line.quantity) || 0;
    if (line.kind === "Carton") cartons += quantity;
    if (line.kind === "Label") labels += quantity;
  }
  return { cartons, labels };
}

export function usageShortage(line: RmUsageLine) {
  const need = Number(line.quantity) || 0;
  if (line.balance == null || !Number.isFinite(Number(line.balance))) return 0;
  return Math.max(0, need - Number(line.balance));
}

export function draftCartonTotal(rows: Array<{ cartonQty: string }>) {
  return rows.reduce((sum, row) => {
    const qty = Number(row.cartonQty);
    if (!Number.isFinite(qty) || qty <= 0) return sum;
    return sum + qty;
  }, 0);
}

export function formatRmDate(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
