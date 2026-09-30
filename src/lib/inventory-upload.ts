import { normalizeItemRef } from "./api";

export interface InventoryUploadRow {
  itemRef: string;
  itemName: string;
  closingQty: number;
  cells: string[];
}

export interface InventoryUploadTable {
  headers: string[];
  rows: InventoryUploadRow[];
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function columnIndexes(header: string[]) {
  let itemRef = -1;
  let itemName = -1;
  let qty = -1;
  header.forEach((cell, index) => {
    const key = normalizeHeader(cell);
    if (
      itemRef < 0 &&
      (key === "itemref" || key === "ref" || key === "itemreference")
    ) {
      itemRef = index;
    } else if (
      itemName < 0 &&
      (key === "itemdetails" ||
        key === "itemname" ||
        key === "itemdetail" ||
        key === "name")
    ) {
      itemName = index;
    } else if (
      qty < 0 &&
      (key === "clqty" ||
        key === "qty" ||
        key === "quantity" ||
        key === "closingqty" ||
        key === "amount" ||
        key === "amountinunits")
    ) {
      qty = index;
    }
  });
  return { itemRef, itemName, qty };
}

function cellAt(cells: string[], index: number) {
  if (index < 0 || index >= cells.length) return "";
  return cells[index].trim();
}

function parseQty(value: string) {
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsvText(text: string) {
  const content = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  return content
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .map(parseCsvLine);
}

function escapeCsv(value: string) {
  const trimmed = value.trim();
  if (/[",\n]/.test(trimmed)) {
    return `"${trimmed.replace(/"/g, '""')}"`;
  }
  return trimmed;
}

function tableFromRows(rows: string[][]): InventoryUploadTable {
  if (rows.length <= 1) {
    return { headers: rows[0] ?? [], rows: [] };
  }
  const headers = rows[0].map((cell) => cell.trim());
  const indexes = columnIndexes(headers);
  if (indexes.itemRef < 0) {
    throw new Error(
      'The file is missing an "Item Ref" column. Existing products cannot be checked without it.',
    );
  }
  const parsed: InventoryUploadRow[] = [];
  for (const cells of rows.slice(1)) {
    const itemRef = normalizeItemRef(cellAt(cells, indexes.itemRef));
    if (!itemRef) continue;
    parsed.push({
      itemRef,
      itemName: cellAt(cells, indexes.itemName),
      closingQty: parseQty(cellAt(cells, indexes.qty)),
      cells,
    });
  }
  return { headers, rows: parsed };
}

async function readSpreadsheetRows(file: File) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("The Excel file has no sheets.");
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(
    sheet,
    { header: 1, raw: false, defval: "" },
  );
  return rows
    .map((row) => row.map((cell) => String(cell ?? "").trim()))
    .filter((row) => row.some((cell) => cell.length > 0));
}

export async function parseInventoryUploadFile(
  file: File,
): Promise<InventoryUploadTable> {
  const name = file.name.toLowerCase();
  const rows = name.endsWith(".csv")
    ? parseCsvText(await file.text())
    : await readSpreadsheetRows(file);
  return tableFromRows(rows);
}

export function inventoryTableToCsvFile(
  table: InventoryUploadTable,
  rows: InventoryUploadRow[],
  filename = "inventory-new-items.csv",
) {
  const lines = [
    table.headers.map(escapeCsv).join(","),
    ...rows.map((row) => row.cells.map(escapeCsv).join(",")),
  ];
  return new File([lines.join("\n")], filename, { type: "text/csv" });
}
