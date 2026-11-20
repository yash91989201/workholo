import { describe, expect, test } from "bun:test";

import { normalizePhone } from "./phone";

describe("normalizePhone", () => {
  test("strips common separators into canonical E.164", () => {
    expect(normalizePhone("+1 (415) 555-0123")).toBe("+14155550123");
    expect(normalizePhone("+44.20.7946.0958")).toBe("+442079460958");
  });

  test("accepts the 00 international prefix", () => {
    expect(normalizePhone("0014155550123")).toBe("+14155550123");
  });

  test("rejects numbers without an explicit country code", () => {
    expect(normalizePhone("4155550123")).toBeNull();
    expect(normalizePhone("(415) 555-0123")).toBeNull();
  });

  test("rejects numbers outside E.164 length bounds", () => {
    expect(normalizePhone("+1234567")).toBeNull();
    expect(normalizePhone("+1234567890123456")).toBeNull();
    expect(normalizePhone("+12345678")).toBe("+12345678");
  });

  test("rejects empty and non-numeric input", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("not a phone")).toBeNull();
    expect(normalizePhone("+04155550123")).toBeNull();
  });
});
