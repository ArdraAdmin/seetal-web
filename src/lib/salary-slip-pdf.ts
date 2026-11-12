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
const MARGIN = 36;
const OUTER_X = MARGIN;
const OUTER_Y = 72;
const OUTER_W = PAGE_W - MARGIN * 2;
const OUTER_H = PAGE_H - MARGIN - OUTER_Y;

type DrawOp =
  | { type: "text"; x: number; y: number; size: number; bold: boolean; text: string }
  | { type: "line"; x1: number; y1: number; x2: number; y2: number; width: number }
  | { type: "rect"; x: number; y: number; w: number; h: number; width: number };

type Page = { ops: DrawOp[] };

const NARROW = new Set("ijlI1|'.,:; ");
const WIDE = new Set("MWmw@#%&");

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
  const value = text.replace(/\s+/g, " ").trim();
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
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code < 32 || code > 126) {
      out += "?";
      continue;
    }
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

function centeredText(page: Page, text: string, y: number, size: number, bold: boolean) {
  const width = pdfTextWidth(text, size);
  page.ops.push({
    type: "text",
    x: OUTER_X + (OUTER_W - width) / 2,
    y,
    size,
    bold,
    text,
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

function drawSlip(page: Page, slip: SalarySlipPdfInput) {
  const x = OUTER_X;
  const yBottom = OUTER_Y;
  const w = OUTER_W;
  const h = OUTER_H;
  const yTop = yBottom + h;

  page.ops.push({ type: "rect", x, y: yBottom, w, h, width: 1.6 });

  let cursor = yTop - 16;
  centeredText(page, "PAY SLIP", cursor, 11, true);
  cursor -= 18;
  centeredText(page, SALARY_SLIP_COMPANY.name, cursor, 14, true);
  cursor -= 13;
  for (const line of SALARY_SLIP_COMPANY.addressLines) {
    centeredText(page, line, cursor, 9, false);
    cursor -= 11;
  }
  cursor -= 6;
  hLine(page, x, x + w, cursor, 1);

  const infoTop = cursor;
  const infoHeight = 54;
  const infoBottom = infoTop - infoHeight;
  const midX = x + w * 0.55;
  vLine(page, midX, infoBottom, infoTop, 0.8);
  hLine(page, x, x + w, infoBottom, 0.8);

  const name = (slip.employeeName || "").trim().toUpperCase();
  const code = (slip.code || "").trim();
  const group = (slip.group || "General").trim();
  const designation = (slip.designation || "").trim().toUpperCase();
  const month = (slip.salaryMonth || "").trim().toUpperCase();

  const leftPad = x + 8;
  const rightPad = midX + 8;
  page.ops.push({
    type: "text",
    x: leftPad,
    y: infoTop - 14,
    size: 9,
    bold: false,
    text: fitPdfText(`Name : ${name}`, 9, midX - x - 16),
  });
  page.ops.push({
    type: "text",
    x: leftPad,
    y: infoTop - 28,
    size: 9,
    bold: false,
    text: fitPdfText(`Code : ${code}`, 9, midX - x - 16),
  });
  page.ops.push({
    type: "text",
    x: leftPad,
    y: infoTop - 42,
    size: 9,
    bold: false,
    text: fitPdfText(`Group : ${group}`, 9, midX - x - 16),
  });
  cellText(page, "Designation", rightPad, infoTop - 14, 80, 9);
  cellText(page, "Month", rightPad + 130, infoTop - 14, 60, 9);
  cellText(page, `: ${designation}`, rightPad, infoTop - 28, 120, 9);
  cellText(page, `: ${month}`, rightPad + 130, infoTop - 28, w - (rightPad + 130 - x) - 16, 9);

  const colXs = [x, x + w * 0.34, x + w * 0.52, x + w * 0.70, x + w];
  const headerTop = infoBottom;
  const headerBottom = headerTop - 18;
  hLine(page, x, x + w, headerBottom, 0.8);
  for (let i = 1; i < colXs.length - 1; i += 1) vLine(page, colXs[i], headerBottom, headerTop, 0.8);
  const headers = ["Earnings", "Deductions", "Contributions", "Adjustments"];
  headers.forEach((label, index) => {
    const left = colXs[index];
    const right = colXs[index + 1];
    cellText(page, label, left + 4, headerTop - 13, right - left - 8, 9, true, "center");
  });

  const bodyTop = headerBottom;
  const bodyBottom = yBottom + 110;
  const totalsTop = bodyBottom + 22;
  hLine(page, x, x + w, totalsTop, 0.8);
  hLine(page, x, x + w, bodyBottom, 0.8);
  for (let i = 1; i < colXs.length - 1; i += 1) {
    vLine(page, colXs[i], bodyBottom, headerTop, 0.8);
  }

  const lines = earningLines(slip);
  let rowY = bodyTop - 14;
  const earnLeft = colXs[0] + 6;
  const earnRight = colXs[1] - 6;
  const earnWidth = earnRight - earnLeft;
  const labelWidth = earnWidth * 0.55;
  const amountWidth = earnWidth * 0.45;
  for (const line of lines) {
    cellText(page, line.label, earnLeft, rowY, labelWidth, 9);
    cellText(page, money(line.amount, line.label === "OB" ? 2 : 2), earnLeft + labelWidth, rowY, amountWidth, 9, false, "right");
    rowY -= 13;
  }

  const gross = grossAmount(slip);
  cellText(page, "Gross", earnLeft, totalsTop - 14, labelWidth, 9, true);
  cellText(page, money(gross, 2), earnLeft + labelWidth, totalsTop - 14, amountWidth, 9, true, "right");

  for (let index = 1; index <= 3; index += 1) {
    const left = colXs[index] + 6;
    const width = colXs[index + 1] - colXs[index] - 12;
    cellText(page, "Total", left, totalsTop - 14, width * 0.45, 9, true);
    cellText(page, money(0, 2), left + width * 0.45, totalsTop - 14, width * 0.55, 9, false, "right");
  }

  const netTop = bodyBottom;
  const signBottom = yBottom;
  const signStart = x + w * 0.52;
  vLine(page, signStart, signBottom, netTop, 0.8);

  const payable = Number.isFinite(slip.totalSalary) ? slip.totalSalary : gross;
  page.ops.push({
    type: "text",
    x: x + 10,
    y: netTop - 18,
    size: 10,
    bold: true,
    text: fitPdfText(`Net Payable : ${netPayableText(payable)}`, 10, signStart - x - 20),
  });
  page.ops.push({
    type: "text",
    x: x + 10,
    y: netTop - 34,
    size: 9,
    bold: false,
    text: fitPdfText(amountInDirhams(payable), 9, signStart - x - 20),
  });

  const signLabels = ["Prepared By", "Verified By", "Authorised By"];
  const signW = (x + w - signStart) / 3;
  for (let i = 0; i < 3; i += 1) {
    const left = signStart + i * signW;
    if (i > 0) vLine(page, left, signBottom, netTop, 0.8);
    cellText(page, signLabels[i], left + 4, netTop - 14, signW - 8, 8, false, "center");
  }
}

export function buildSalarySlipPdf(slips: SalarySlipPdfInput[]) {
  if (slips.length === 0) {
    throw new Error("Select at least one person to generate a salary slip");
  }

  const pages: Page[] = slips.map((slip) => {
    const page: Page = { ops: [] };
    drawSlip(page, slip);
    return page;
  });

  if (pages.length > 1) {
    pages.forEach((page, index) => {
      page.ops.push({
        type: "text",
        x: MARGIN,
        y: 28,
        size: 8,
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
  pages.forEach((page, index) => {
    const pageId = 5 + index * 2;
    const streamId = pageId + 1;
    kids.push(`${pageId} 0 R`);
    const stream = contentStream(page);
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
  const safe = employeeName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `salary-slip-${safe || "employee"}-${ym}.pdf`;
}
