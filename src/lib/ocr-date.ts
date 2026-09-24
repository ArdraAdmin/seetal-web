const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

function validDate(year: number, month: number, day: number) {
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  const date = new Date(year, month, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function normalizeYear(year: number) {
  if (year < 100) return year >= 70 ? 1900 + year : 2000 + year;
  return year;
}

export function parseDatesFromText(text: string) {
  const dates: Date[] = [];
  const add = (date: Date | null) => {
    if (date) dates.push(date);
  };

  const numeric =
    /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/g;
  let match: RegExpExecArray | null;
  while ((match = numeric.exec(text))) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const year = normalizeYear(Number(match[3]));
    if (first > 12) add(validDate(year, second - 1, first));
    else if (second > 12) add(validDate(year, first - 1, second));
    else add(validDate(year, second - 1, first));
  }

  const iso = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g;
  while ((match = iso.exec(text))) {
    add(
      validDate(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
      ),
    );
  }

  const named =
    /\b(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{2,4})\b/g;
  while ((match = named.exec(text))) {
    const month = MONTHS[match[2].toLowerCase()];
    if (month == null) continue;
    add(validDate(normalizeYear(Number(match[3])), month, Number(match[1])));
  }

  const namedFirst =
    /\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{2,4})\b/g;
  while ((match = namedFirst.exec(text))) {
    const month = MONTHS[match[1].toLowerCase()];
    if (month == null) continue;
    add(validDate(normalizeYear(Number(match[3])), month, Number(match[2])));
  }

  return dates;
}

export function pickChequeDate(dates: Date[]) {
  if (dates.length === 0) return null;
  return dates.reduce((latest, date) =>
    date.getTime() > latest.getTime() ? date : latest,
  );
}

export async function readChequeDateFromImage(file: File) {
  const tesseract = await import("tesseract.js");
  const result = await tesseract.recognize(file, "eng");
  const dates = parseDatesFromText(result.data.text || "");
  return {
    text: result.data.text || "",
    date: pickChequeDate(dates),
  };
}
