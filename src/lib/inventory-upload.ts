import {
  addProductManual,
  updateInventoryQuantities,
  type CompanyRecord,
  type ExistingInventoryItem,
  normalizeItemRef,
} from "./api";
import type { CategoryGroup } from "./categories";

export interface InventoryUploadRow {
  itemRef: string;
  itemName: string;
  closingQty: number;
  unit: string;
  sellingPrice: number;
  ratio: number;
  masterCategory: string;
  subCategory: string;
  barcode: string;
  company: string;
  addFlag: string;
  cells: string[];
}

export interface InventoryUploadTable {
  headers: string[];
  rows: InventoryUploadRow[];
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeMatch(value: string) {
  return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
}

function columnIndexes(header: string[]) {
  const indexes = {
    itemRef: -1,
    itemName: -1,
    qty: -1,
    unit: -1,
    sellingPrice: -1,
    ratio: -1,
    masterCategory: -1,
    subCategory: -1,
    barcode: -1,
    company: -1,
    addFlag: -1,
  };
  header.forEach((cell, index) => {
    const key = normalizeHeader(cell);
    if (
      indexes.itemRef < 0 &&
      (key === "itemref" || key === "ref" || key === "itemreference")
    ) {
      indexes.itemRef = index;
    } else if (
      indexes.itemName < 0 &&
      (key === "itemdetails" ||
        key === "itemname" ||
        key === "itemdetail" ||
        key === "name")
    ) {
      indexes.itemName = index;
    } else if (
      indexes.qty < 0 &&
      (key === "clqty" ||
        key === "qty" ||
        key === "quantity" ||
        key === "closingqty" ||
        key === "amount" ||
        key === "amountinunits")
    ) {
      indexes.qty = index;
    } else if (indexes.unit < 0 && key === "unit") {
      indexes.unit = index;
    } else if (
      indexes.sellingPrice < 0 &&
      (key === "sp" || key === "sellingprice")
    ) {
      indexes.sellingPrice = index;
    } else if (
      indexes.ratio < 0 &&
      (key === "pcsctns" || key === "ratio" || key === "pcsctn")
    ) {
      indexes.ratio = index;
    } else if (
      indexes.masterCategory < 0 &&
      (key === "mastercategory" || key === "category")
    ) {
      indexes.masterCategory = index;
    } else if (
      indexes.subCategory < 0 &&
      (key === "subcategory" || key === "subcat")
    ) {
      indexes.subCategory = index;
    } else if (
      indexes.barcode < 0 &&
      (key === "barcode" || key === "itemnumber")
    ) {
      indexes.barcode = index;
    } else if (indexes.company < 0 && key === "company") {
      indexes.company = index;
    } else if (
      indexes.addFlag < 0 &&
      (key === "add" || key === "addyrn" || key === "addy")
    ) {
      indexes.addFlag = index;
    }
  });
  return indexes;
}

function cellAt(cells: string[], index: number) {
  if (index < 0 || index >= cells.length) return "";
  return cells[index].trim();
}

function parseQty(value: string) {
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function parseNumber(value: string) {
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseAddFlag(value: string) {
  const flag = value.trim().toUpperCase();
  return flag === "Y" || flag === "R" || flag === "N" ? flag : "";
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
      unit: cellAt(cells, indexes.unit) || "PCS",
      sellingPrice: parseNumber(cellAt(cells, indexes.sellingPrice)),
      ratio: parseQty(cellAt(cells, indexes.ratio)) || 1,
      masterCategory: cellAt(cells, indexes.masterCategory),
      subCategory: cellAt(cells, indexes.subCategory),
      barcode: cellAt(cells, indexes.barcode),
      company: cellAt(cells, indexes.company),
      addFlag: parseAddFlag(cellAt(cells, indexes.addFlag)),
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

export function matchUploadCompany(
  value: string,
  companies: CompanyRecord[],
) {
  const want = normalizeMatch(value);
  if (!want) return null;
  return (
    companies.find((company) => {
      const name = normalizeMatch(company.name || "");
      const prefix = normalizeMatch(company.prefix || "");
      return want === name || want === prefix || name.includes(want) || want.includes(name);
    }) || null
  );
}

export function matchUploadCategory(
  masterName: string,
  subName: string,
  groups: CategoryGroup[],
) {
  const wantMaster = normalizeMatch(masterName);
  const wantSub = normalizeMatch(subName);
  if (!wantMaster || !wantSub) return null;
  const group =
    groups.find((item) => normalizeMatch(item.name) === wantMaster) ||
    groups.find((item) => normalizeMatch(item.name).includes(wantMaster)) ||
    groups.find((item) => wantMaster.includes(normalizeMatch(item.name)));
  if (!group) return null;
  const sub =
    group.items.find((item) => normalizeMatch(item.subCategory || "") === wantSub) ||
    group.items.find((item) =>
      normalizeMatch(item.subCategory || "").includes(wantSub),
    );
  if (!sub) return null;
  return { group, sub };
}

export async function addInventoryUploadRows(
  rows: InventoryUploadRow[],
  groups: CategoryGroup[],
  companies: CompanyRecord[],
) {
  const errors: string[] = [];
  let added = 0;

  for (const row of rows) {
    if (!row.itemName.trim()) {
      errors.push(`${row.itemRef}: missing Item Details`);
      continue;
    }
    if (!row.unit.trim() || /\d/.test(row.unit)) {
      errors.push(`${row.itemRef}: invalid Unit "${row.unit}"`);
      continue;
    }
    if (!row.ratio || row.ratio <= 0) {
      errors.push(`${row.itemRef}: PCS/CTNS must be greater than 0`);
      continue;
    }
    const category = matchUploadCategory(
      row.masterCategory,
      row.subCategory,
      groups,
    );
    if (!category) {
      errors.push(
        `${row.itemRef}: category not found — ${row.masterCategory || "(blank)"} / ${row.subCategory || "(blank)"}`,
      );
      continue;
    }
    const company = matchUploadCompany(row.company, companies);
    if (!company) {
      errors.push(
        `${row.itemRef}: company not found — ${row.company || "(blank)"}`,
      );
      continue;
    }

    try {
      await addProductManual({
        itemRef: row.itemRef,
        itemName: row.itemName,
        barCode: row.barcode,
        category: category.group.masterCategoryId || category.group.name,
        subCategory: category.sub._id || category.sub.subCategory,
        unit: row.unit,
        ratio: row.ratio,
        amountInUnits: row.closingQty,
        sellingPrice: row.sellingPrice,
        isDisplay: true,
        company: company._id,
      });
      added += 1;
    } catch (error) {
      errors.push(
        `${row.itemRef}: ${error instanceof Error ? error.message : "could not add"}`,
      );
    }
  }

  return { added, errors };
}

export async function syncInventoryUploadRows(
  rows: InventoryUploadRow[],
  existing: ExistingInventoryItem[],
  groups: CategoryGroup[],
  companies: CompanyRecord[],
) {
  const existingByRef = new Map(
    existing.map((item) => [normalizeItemRef(item.itemRef), item]),
  );
  const creates: InventoryUploadRow[] = [];
  const updates: {
    itemRef: string;
    closingQty: number;
    mode: "replace";
    sellingPrice: number;
  }[] = [];

  for (const row of rows) {
    const current = existingByRef.get(row.itemRef);
    if (!current) {
      creates.push(row);
      continue;
    }
    if (row.addFlag !== "Y" && row.addFlag !== "N" && row.addFlag !== "R") {
      continue;
    }
    const previous =
      (current.amountInCartons || 0) * (current.ratio || 0) +
      (current.amountInUnits || 0);
    updates.push({
      itemRef: row.itemRef,
      closingQty: row.addFlag === "R" ? row.closingQty : previous + row.closingQty,
      mode: "replace",
      sellingPrice: row.sellingPrice,
    });
  }

  let updated = 0;
  if (updates.length > 0) {
    await updateInventoryQuantities(updates);
    updated = updates.length;
  }
  const created = await addInventoryUploadRows(creates, groups, companies);
  return { added: created.added, updated, errors: created.errors };
}
