import { describe, expect, test } from "bun:test";

import { CsvParseError, MAX_CSV_ROWS, parseLeadCsv } from "./csv";

describe("parseLeadCsv", () => {
  test("reads phone and optional name columns", () => {
    const rows = parseLeadCsv("phone,name\n+14155550123,Alice\n+14155550124");
    expect(rows).toEqual([
      { line: 2, phone: "+14155550123", name: "Alice" },
      { line: 3, phone: "+14155550124", name: "" },
    ]);
  });

  test("handles quoted fields, commas, escaped quotes, and newlines", () => {
    const rows = parseLeadCsv(
      'phone,name\r\n+14155550123,"Dana, Jr."\r\n+14155550124,"Sam ""S"" Lee"\n+14155550125,"Line\nBreak"'
    );
    expect(rows.map((row) => row.name)).toEqual([
      "Dana, Jr.",
      'Sam "S" Lee',
      "Line\nBreak",
    ]);
    expect(rows.map((row) => row.line)).toEqual([2, 3, 4]);
  });

  test("skips blank rows but keeps original line numbers", () => {
    const rows = parseLeadCsv("phone\n+14155550123\n\n+14155550124\n");
    expect(rows.map((row) => row.line)).toEqual([2, 4]);
  });

  test("ignores a UTF-8 BOM before the header", () => {
    const rows = parseLeadCsv("\uFEFFphone,name\n+14155550123,Alice");
    expect(rows).toEqual([{ line: 2, phone: "+14155550123", name: "Alice" }]);
  });

  test("rejects a missing phone column", () => {
    expect(() => parseLeadCsv("name\nAlice")).toThrow(CsvParseError);
  });

  test("rejects an empty file and unterminated quotes before any writes", () => {
    expect(() => parseLeadCsv("")).toThrow("CSV is empty");
    expect(() => parseLeadCsv('phone\n"+14155550123')).toThrow(
      "unterminated quoted field"
    );
  });

  test("bounds the number of data rows", () => {
    const lines = ["phone"];
    for (let index = 0; index <= MAX_CSV_ROWS; index += 1) {
      lines.push(`+1415555${String(index).padStart(4, "0")}`);
    }
    expect(() => parseLeadCsv(lines.join("\n"))).toThrow(
      `more than ${MAX_CSV_ROWS}`
    );
  });
});
