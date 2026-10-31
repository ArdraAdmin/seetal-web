export type ShmpProductionLog = {
  worker?: { _id?: string | null; name?: string };
  company?: { _id?: string; name?: string } | null;
  order?: { _id?: string; invoiceNo?: string } | null;
  store?: { _id?: string; storeName?: string; uid?: string } | null;
  item?: { _id?: string; name?: string; itemRef?: string } | null;
  date?: string | Date;
  cartonQty?: number;
  value?: number;
};

export function productionLogStoreName(log: { store?: unknown }) {
  const store = log.store;
  if (!store || typeof store !== "object" || !("storeName" in store)) return "";
  return String((store as { storeName?: string }).storeName || "").trim();
}

export function formatPackedCartonsValue(value: number) {
  const amount = Number.isFinite(value) ? value : 0;
  const formatted = new Intl.NumberFormat("en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `AED ${formatted}`;
}

export type ProductionSummaryCard = {
  key: string;
  label: string;
  value: string;
};

export function productionSummaryCards(input: {
  todayCartons?: number;
  monthCartons?: number;
  todayValue?: number;
  monthValue?: number;
  showValue: boolean;
}): ProductionSummaryCard[] {
  const cards: ProductionSummaryCard[] = [
    {
      key: "today-cartons",
      label: "Cartons packed today",
      value: String(Number(input.todayCartons) || 0),
    },
    {
      key: "month-cartons",
      label: "Cartons packed this month",
      value: String(Number(input.monthCartons) || 0),
    },
  ];
  if (!input.showValue) return cards;
  return [
    ...cards,
    {
      key: "today-value",
      label: "Packed cartons value today",
      value: formatPackedCartonsValue(Number(input.todayValue) || 0),
    },
    {
      key: "month-value",
      label: "Packed cartons value this month",
      value: formatPackedCartonsValue(Number(input.monthValue) || 0),
    },
  ];
}

export function formatProductionLogDate(value?: string | Date | null) {
  if (!value) return "";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function productionLogMatchesQuery(
  log: ShmpProductionLog,
  query: string,
) {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  const store = log.store;
  const storeUid =
    store && typeof store === "object" && "uid" in store
      ? String((store as { uid?: string }).uid || "").trim()
      : "";
  const packedDate = formatProductionLogDate(log.date);
  const haystack = [
    log.worker?.name,
    log.company?.name,
    log.order?.invoiceNo,
    log.item?.name,
    log.item?.itemRef,
    productionLogStoreName(log),
    storeUid,
    packedDate,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(term);
}
