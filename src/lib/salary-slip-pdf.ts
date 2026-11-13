export type SalarySlipPdfInput = {
  employeeName: string;
  salaryMonth: string;
  designation?: string;
  code?: string;
  group?: string;
  basicSalary: number;
  otWeekdays: number;
  otSundays: number;
  otPublicHolidays: number;
  otherBenefits: number;
  totalSalary: number;
};

export const SALARY_SLIP_COMPANY = {
  name: "SH MILLY PACK FZ- LLC",
  addressLines: ["PL033,, TECHONOLOGY PARK", "RAK FREE ZONE, AL JAZEERA AL HAMRA"],
} as const;

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN_X = 28;
const MARGIN_Y = 24;
const SLIP_GAP = 10;
const SLIP_W = PAGE_W - MARGIN_X * 2;

type DrawOp =
  | { type: "text"; x: number; y: number; size: number; bold: boolean; text: string }
  | { type: "line"; x1: number; y1: number; x2: number; y2: number; width: number }
  | { type: "rect"; x: number; y: number; w: number; h: number; width: number };

type Page = { ops: DrawOp[] };

const NARROW = new Set("ijlI1|'.,:; ");
const WIDE = new Set("MWmw@#%&");

/** Latin lookalikes that often appear in imported English names. */
const CONFUSABLES: Record<string, string> = {
  А: "A",
  В: "B",
  Е: "E",
  Ё: "E",
  К: "K",
  М: "M",
  Н: "H",
  О: "O",
  Р: "P",
  С: "C",
  Т: "T",
  Х: "X",
  а: "a",
  е: "e",
  ё: "e",
  о: "o",
  р: "p",
  с: "c",
  у: "y",
  х: "x",
  і: "i",
  І: "I",
  Ѕ: "S",
  ѕ: "s",
  Α: "A",
  Β: "B",
  Ε: "E",
  Ζ: "Z",
  Η: "H",
  Ι: "I",
  Κ: "K",
  Μ: "M",
  Ν: "N",
  Ο: "O",
  Ρ: "P",
  Τ: "T",
  Υ: "Y",
  Χ: "X",
  α: "a",
  ο: "o",
  "\u2018": "'",
  "\u2019": "'",
  "\u201C": '"',
  "\u201D": '"',
  "\u2013": "-",
  "\u2014": "-",
  "\u00A0": " ",
  "\u202F": " ",
  "\u2007": " ",
  "\u2009": " ",
  "／": "/",
  "∕": "/",
};

/**
 * Helvetica Type1 only supports basic ASCII in this generator.
 * Normalize English names so lookalike / accented characters do not become "?".
 */
export function toPdfAscii(text: string) {
  const normalized = String(text || "").normalize("NFKD");
  let out = "";
  for (const char of normalized) {
    const code = char.charCodeAt(0);
    if (code >= 0x0300 && code <= 0x036f) continue;
    const mapped = CONFUSABLES[char] ?? char;
    const mappedCode = mapped.charCodeAt(0);
    if (mappedCode >= 32 && mappedCode <= 126) out += mapped;
  }
  return out.replace(/\s+/g, " ").trim();
}

function unitWidth(char: string) {
  if (char === " ") return 0.28;
  if (NARROW.has(char)) return 0.32;
  if (WIDE.has(char)) return 0.82;
  if (char >= "A" && char <= "Z") return 0.68;
  if (char >= "0" && char <= "9") return 0.56;
  return 0.5;
}

function pdfTextWidth(text: string, size: number) {
  let width = 0;
  for (const char of text) width += unitWidth(char) * size;
  return width;
}

function fitPdfText(text: string, size: number, maxWidth: number) {
  const value = toPdfAscii(text);
  if (!value) return "";
  if (pdfTextWidth(value, size) <= maxWidth) return value;
  let out = "";
  for (const char of value) {
    if (pdfTextWidth(`${out}${char}...`, size) > maxWidth) break;
    out += char;
  }
  return out ? `${out}...` : value.slice(0, 1);
}

function pdfLiteral(text: string) {
  let out = "";
  for (const char of toPdfAscii(text)) {
    if (char === "\\" || char === "(" || char === ")") out += "\\";
    out += char;
  }
  return out;
}

function contentStream(page: Page) {
  const lines: string[] = [];
  for (const op of page.ops) {
    if (op.type === "line") {
      lines.push(
        "0 0 0 RG",
        `${op.width} w`,
        `${op.x1} ${op.y1} m`,
        `${op.x2} ${op.y2} l`,
        "S",
      );
      continue;
    }
    if (op.type === "rect") {
      lines.push("0 0 0 RG", `${op.width} w`, `${op.x} ${op.y} ${op.w} ${op.h} re`, "S");
      continue;
    }
    const font = op.bold ? "/F2" : "/F1";
    lines.push(
      "BT",
      `${font} ${op.size} Tf`,
      `1 0 0 1 ${op.x} ${op.y} Tm`,
      `(${pdfLiteral(op.text)}) Tj`,
      "ET",
    );
  }
  return lines.join("\n");
}

function toBytes(value: string) {
  const bytes = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i += 1) bytes[i] = value.charCodeAt(i);
  return bytes;
}

function serialize(objects: string[]) {
  let out = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(out.length);
    out += object.endsWith("\n") ? object : `${object}\n`;
  }
  const xref = out.length;
  const size = objects.length + 1;
  out += `xref\n0 ${size}\n`;
  out += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i += 1) {
    out += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return toBytes(out);
}

function money(value: number, decimals = 2) {
  const amount = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-AE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

function netPayableText(value: number) {
  return `AED${money(value, 2)}`;
}

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function wordsUnderThousand(value: number): string {
  const n = Math.floor(value);
  if (n === 0) return "";
  if (n < 20) return ONES[n] || "";
  if (n < 100) {
    const rest = n % 10;
    return `${TENS[Math.floor(n / 10)]}${rest ? ` ${ONES[rest]}` : ""}`;
  }
  const rest = n % 100;
  return `${ONES[Math.floor(n / 100)]} Hundred${rest ? ` ${wordsUnderThousand(rest)}` : ""}`;
}

/** "Dirhams Six Thousand Only" style wording for the slip footer. */
export function amountInDirhams(value: number) {
  const amount = Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
  const whole = Math.floor(amount);
  const fils = Math.round((amount - whole) * 100);
  if (whole === 0 && fils === 0) return "Dirhams Zero Only";

  const parts: string[] = [];
  const crore = Math.floor(whole / 10_000_000);
  const lakh = Math.floor((whole % 10_000_000) / 100_000);
  const thousand = Math.floor((whole % 100_000) / 1000);
  const rem = whole % 1000;
  if (crore) parts.push(`${wordsUnderThousand(crore)} Crore`);
  if (lakh) parts.push(`${wordsUnderThousand(lakh)} Lakh`);
  if (thousand) parts.push(`${wordsUnderThousand(thousand)} Thousand`);
  if (rem) parts.push(wordsUnderThousand(rem));
  let text = `Dirhams ${parts.join(" ")}`;
  if (fils) text += ` and ${wordsUnderThousand(fils)} Fils`;
  return `${text} Only`;
}

function centeredInBox(page: Page, text: string, boxX: number, boxW: number, y: number, size: number, bold: boolean) {
  const value = toPdfAscii(text);
  const width = pdfTextWidth(value, size);
  page.ops.push({
    type: "text",
    x: boxX + (boxW - width) / 2,
    y,
    size,
    bold,
    text: value,
  });
}

function hLine(page: Page, x1: number, x2: number, y: number, width = 0.8) {
  page.ops.push({ type: "line", x1, y1: y, x2, y2: y, width });
}

function vLine(page: Page, x: number, y1: number, y2: number, width = 0.8) {
  page.ops.push({ type: "line", x1: x, y1, x2: x, y2, width });
}

function cellText(
  page: Page,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  bold = false,
  align: "left" | "right" | "center" = "left",
) {
  const value = fitPdfText(text, size, maxWidth);
  if (!value) return;
  let drawX = x;
  if (align === "right") drawX = x + maxWidth - pdfTextWidth(value, size);
  if (align === "center") drawX = x + (maxWidth - pdfTextWidth(value, size)) / 2;
  page.ops.push({ type: "text", x: drawX, y, size, bold, text: value });
}

function earningLines(slip: SalarySlipPdfInput) {
  const lines = [{ label: "Basic", amount: slip.basicSalary }];
  if ((Number(slip.otWeekdays) || 0) !== 0) {
    lines.push({ label: "OT Weekdays", amount: slip.otWeekdays });
  }
  if ((Number(slip.otSundays) || 0) !== 0) {
    lines.push({ label: "OT Sundays", amount: slip.otSundays });
  }
  if ((Number(slip.otPublicHolidays) || 0) !== 0) {
    lines.push({ label: "OT Public Holidays", amount: slip.otPublicHolidays });
  }
  lines.push({ label: "OB", amount: slip.otherBenefits });
  return lines;
}

function grossAmount(slip: SalarySlipPdfInput) {
  return (
    (Number.isFinite(slip.basicSalary) ? slip.basicSalary : 0) +
    (Number.isFinite(slip.otWeekdays) ? slip.otWeekdays : 0) +
    (Number.isFinite(slip.otSundays) ? slip.otSundays : 0) +
    (Number.isFinite(slip.otPublicHolidays) ? slip.otPublicHolidays : 0) +
    (Number.isFinite(slip.otherBenefits) ? slip.otherBenefits : 0)
  );
}

/** Compact slip height matching the Excel reference proportions. */
export function measureSalarySlipHeight(slip: SalarySlipPdfInput) {
  const header = 58;
  const info = 38;
  const colHeader = 13;
  const body = Math.max(28, earningLines(slip).length * 11 + 6);
  const totals = 14;
  const footer = 46;
  return header + info + colHeader + body + totals + footer;
}

function drawSlip(
  page: Page,
  slip: SalarySlipPdfInput,
  box: { x: number; y: number; w: number; h: number },
) {
  const x = box.x;
  const yBottom = box.y;
  const w = box.w;
  const h = box.h;
  const yTop = yBottom + h;

  page.ops.push({ type: "rect", x, y: yBottom, w, h, width: 1.2 });

  let cursor = yTop - 12;
  centeredInBox(page, "PAY SLIP", x, w, cursor, 9, true);
  cursor -= 13;
  centeredInBox(page, SALARY_SLIP_COMPANY.name, x, w, cursor, 11, true);
  cursor -= 11;
  for (const line of SALARY_SLIP_COMPANY.addressLines) {
    centeredInBox(page, line, x, w, cursor, 7.5, false);
    cursor -= 9;
  }
  cursor -= 3;
  hLine(page, x, x + w, cursor, 0.9);

  const infoTop = cursor;
  const infoHeight = 38;
  const infoBottom = infoTop - infoHeight;
  const midX = x + w * 0.55;
  vLine(page, midX, infoBottom, infoTop, 0.7);
  hLine(page, x, x + w, infoBottom, 0.7);

  const name = toPdfAscii(slip.employeeName || "").toUpperCase();
  const code = toPdfAscii(slip.code || "");
  const group = toPdfAscii(slip.group || "General") || "General";
  const designation = toPdfAscii(slip.designation || "").toUpperCase();
  const month = toPdfAscii(slip.salaryMonth || "").toUpperCase();

  const leftPad = x + 6;
  const rightPad = midX + 6;
  page.ops.push({
    type: "text",
    x: leftPad,
    y: infoTop - 11,
    size: 8,
    bold: false,
    text: fitPdfText(`Name : ${name}`, 8, midX - x - 12),
  });
  page.ops.push({
    type: "text",
    x: leftPad,
    y: infoTop - 22,
    size: 8,
    bold: false,
    text: fitPdfText(`Code : ${code}`, 8, midX - x - 12),
  });
  page.ops.push({
    type: "text",
    x: leftPad,
    y: infoTop - 33,
    size: 8,
    bold: false,
    text: fitPdfText(`Group : ${group}`, 8, midX - x - 12),
  });
  cellText(page, "Designation", rightPad, infoTop - 11, 70, 8);
  cellText(page, "Month", rightPad + 110, infoTop - 11, 50, 8);
  cellText(page, `: ${designation}`, rightPad, infoTop - 22, 100, 8);
  cellText(page, `: ${month}`, rightPad + 110, infoTop - 22, w - (rightPad + 110 - x) - 10, 8);

  const colXs = [x, x + w * 0.34, x + w * 0.52, x + w * 0.70, x + w];
  const headerTop = infoBottom;
  const headerBottom = headerTop - 13;
  hLine(page, x, x + w, headerBottom, 0.7);
  for (let i = 1; i < colXs.length - 1; i += 1) vLine(page, colXs[i], headerBottom, headerTop, 0.7);
  const headers = ["Earnings", "Deductions", "Contributions", "Adjustments"];
  headers.forEach((label, index) => {
    const left = colXs[index];
    const right = colXs[index + 1];
    cellText(page, label, left + 3, headerTop - 10, right - left - 6, 8, true, "center");
  });

  const lines = earningLines(slip);
  const bodyTop = headerBottom;
  const footerH = 46;
  const totalsH = 14;
  const bodyBottom = yBottom + footerH;
  const totalsTop = bodyBottom + totalsH;
  hLine(page, x, x + w, totalsTop, 0.7);
  hLine(page, x, x + w, bodyBottom, 0.7);
  for (let i = 1; i < colXs.length - 1; i += 1) {
    vLine(page, colXs[i], bodyBottom, headerTop, 0.7);
  }

  let rowY = bodyTop - 11;
  const earnLeft = colXs[0] + 5;
  const earnRight = colXs[1] - 5;
  const earnWidth = earnRight - earnLeft;
  const labelWidth = earnWidth * 0.55;
  const amountWidth = earnWidth * 0.45;
  for (const line of lines) {
    cellText(page, line.label, earnLeft, rowY, labelWidth, 8);
    cellText(page, money(line.amount, 2), earnLeft + labelWidth, rowY, amountWidth, 8, false, "right");
    rowY -= 11;
  }

  const gross = grossAmount(slip);
  cellText(page, "Gross", earnLeft, totalsTop - 10, labelWidth, 8, true);
  cellText(page, money(gross, 2), earnLeft + labelWidth, totalsTop - 10, amountWidth, 8, true, "right");

  for (let index = 1; index <= 3; index += 1) {
    const left = colXs[index] + 4;
    const width = colXs[index + 1] - colXs[index] - 8;
    cellText(page, "Total", left, totalsTop - 10, width * 0.45, 8, true);
    cellText(page, money(0, 2), left + width * 0.45, totalsTop - 10, width * 0.55, 8, false, "right");
  }

  const netTop = bodyBottom;
  const signBottom = yBottom;
  const signStart = x + w * 0.52;
  vLine(page, signStart, signBottom, netTop, 0.7);

  const payable = Number.isFinite(slip.totalSalary) ? slip.totalSalary : gross;
  page.ops.push({
    type: "text",
    x: x + 8,
    y: netTop - 14,
    size: 9,
    bold: true,
    text: fitPdfText(`Net Payable : ${netPayableText(payable)}`, 9, signStart - x - 14),
  });
  page.ops.push({
    type: "text",
    x: x + 8,
    y: netTop - 27,
    size: 8,
    bold: false,
    text: fitPdfText(amountInDirhams(payable), 8, signStart - x - 14),
  });

  const signLabels = ["Prepared By", "Verified By", "Authorised By"];
  const signW = (x + w - signStart) / 3;
  for (let i = 0; i < 3; i += 1) {
    const left = signStart + i * signW;
    if (i > 0) vLine(page, left, signBottom, netTop, 0.7);
    cellText(page, signLabels[i], left + 2, netTop - 12, signW - 4, 7, false, "center");
  }
}

export function buildSalarySlipPdf(slips: SalarySlipPdfInput[]) {
  if (slips.length === 0) {
    throw new Error("Select at least one person to generate a salary slip");
  }

  const pages: Page[] = [];
  let page: Page = { ops: [] };
  let cursorTop = PAGE_H - MARGIN_Y;

  const flushPage = () => {
    pages.push(page);
    page = { ops: [] };
    cursorTop = PAGE_H - MARGIN_Y;
  };

  for (const slip of slips) {
    const height = measureSalarySlipHeight(slip);
    if (cursorTop - height < MARGIN_Y) {
      flushPage();
    }
    const y = cursorTop - height;
    drawSlip(page, slip, { x: MARGIN_X, y, w: SLIP_W, h: height });
    cursorTop = y - SLIP_GAP;
  }
  pages.push(page);

  if (pages.length > 1) {
    pages.forEach((item, index) => {
      item.ops.push({
        type: "text",
        x: MARGIN_X,
        y: 12,
        size: 7,
        bold: false,
        text: `Page ${index + 1} of ${pages.length}`,
      });
    });
  }

  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];
  const kids: string[] = [];
  pages.forEach((item, index) => {
    const pageId = 5 + index * 2;
    const streamId = pageId + 1;
    kids.push(`${pageId} 0 R`);
    const stream = contentStream(item);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${streamId} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>`,
    );
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  objects[1] = `<< /Type /Pages /Count ${pages.length} /Kids [${kids.join(" ")}] >>`;

  return serialize(objects.map((body, index) => `${index + 1} 0 obj\n${body}\nendobj\n`));
}

export function downloadSalarySlipPdf(bytes: Uint8Array, filename: string) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function salarySlipFilename(year: number, month: number, employeeName?: string) {
  const ym = `${year}-${String(month).padStart(2, "0")}`;
  if (!employeeName) return `salary-slips-${ym}.pdf`;
  const safe = toPdfAscii(employeeName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `salary-slip-${safe || "employee"}-${ym}.pdf`;
}
