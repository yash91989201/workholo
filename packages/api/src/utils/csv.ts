export const MAX_CSV_BYTES = 256 * 1024;
export const MAX_CSV_ROWS = 2000;

export class CsvParseError extends Error {}

export type LeadCsvRow = { line: number; phone: string; name: string };

type Record = { line: number; fields: string[] };

const QUOTED_FIELD = /"(?:[^"]|"")*"/y;

function readField(
  text: string,
  start: number
): { value: string; next: number; newlines: number } | null {
  QUOTED_FIELD.lastIndex = start;
  const quoted = QUOTED_FIELD.exec(text);
  if (quoted) {
    const [raw = ""] = quoted;
    return {
      value: raw.slice(1, -1).replace(/""/g, '"'),
      next: QUOTED_FIELD.lastIndex,
      newlines: raw.split("\n").length - 1,
    };
  }
  if (text[start] === '"') {
    return null;
  }
  let end = start;
  while (end < text.length && text[end] !== "," && text[end] !== "\n") {
    end += 1;
  }
  return { value: text.slice(start, end), next: end, newlines: 0 };
}

function parseRecords(source: string): Record[] {
  // Normalize line endings so every record scan sees `\n` only.
  const text = source.replace(/\r\n?/g, "\n");
  const records: Record[] = [];
  let index = 0;
  let line = 1;

  while (index < text.length) {
    const recordLine = line;
    const fields: string[] = [];
    let atEnd = false;

    while (!atEnd) {
      const field = readField(text, index);
      if (!field) {
        throw new CsvParseError("CSV has an unterminated quoted field");
      }
      fields.push(field.value);
      index = field.next;
      line += field.newlines;
      const delimiter = text[index];
      if (delimiter === ",") {
        index += 1;
      } else {
        atEnd = true;
        if (delimiter === "\n") {
          index += 1;
          line += 1;
        }
      }
    }
    records.push({ line: recordLine, fields });
  }
  return records;
}

/**
 * Bounded CSV reader for lead import. The first record is the header and must
 * contain a `phone` column; `name` is optional. Returns one entry per data row.
 */
export function parseLeadCsv(source: string): LeadCsvRow[] {
  if (new TextEncoder().encode(source).length > MAX_CSV_BYTES) {
    throw new CsvParseError(`CSV is larger than ${MAX_CSV_BYTES} bytes`);
  }
  // Excel exports often start with a UTF-8 BOM.
  const records = parseRecords(source.replace(/^\uFEFF/, ""));
  const header = records.shift();
  if (!header) {
    throw new CsvParseError("CSV is empty");
  }
  const columns = header.fields.map((name) => name.trim().toLowerCase());
  const phoneIndex = columns.indexOf("phone");
  if (phoneIndex === -1) {
    throw new CsvParseError("CSV is missing a phone column");
  }
  const nameIndex = columns.indexOf("name");

  const rows = records
    .filter((record) => record.fields.some((value) => value.trim() !== ""))
    .map((record) => ({
      line: record.line,
      phone: record.fields[phoneIndex] ?? "",
      name: nameIndex === -1 ? "" : (record.fields[nameIndex] ?? ""),
    }));

  if (rows.length > MAX_CSV_ROWS) {
    throw new CsvParseError(`CSV has more than ${MAX_CSV_ROWS} data rows`);
  }
  return rows;
}
