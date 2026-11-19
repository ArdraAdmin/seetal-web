export type CategorySalesRow = {
  categoryId: string | null;
  name: string;
  revenue: number;
};

export type CategoryPieSlice = {
  key: string;
  name: string;
  revenue: number;
  pct: number;
  color: string;
};

export const CATEGORY_PIE_COLORS = [
  "#0e3a32",
  "#f7a51c",
  "#2a6f62",
  "#c9840f",
  "#5b8a7e",
  "#d4a017",
  "#1a4f45",
  "#e8b84a",
  "#3d7a6e",
  "#8a6b1a",
];

export function parentCategoryName(name: string) {
  const text = String(name || "").trim();
  if (!text) return "Uncategorized";
  const sep = text.indexOf(" / ");
  if (sep === -1) return text;
  return text.slice(0, sep).trim() || text;
}

export function aggregateCategoryParents(
  rows: CategorySalesRow[],
): CategoryPieSlice[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const key = parentCategoryName(row.name);
    totals.set(key, (totals.get(key) || 0) + (Number(row.revenue) || 0));
  }
  const grand = [...totals.values()].reduce((sum, n) => sum + n, 0);
  return [...totals.entries()]
    .map(([name, revenue], index) => ({
      key: name,
      name,
      revenue,
      pct: grand > 0 ? (revenue * 100) / grand : 0,
      color: CATEGORY_PIE_COLORS[index % CATEGORY_PIE_COLORS.length],
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

export function pieSlicePath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}
