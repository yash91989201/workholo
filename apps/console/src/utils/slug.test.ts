import { describe, expect, test } from "bun:test";

import { generateSlug, normalizeSlugInput } from "./slug";

describe("generateSlug", () => {
  test("lowercases and joins words with single hyphens", () => {
    expect(generateSlug("  Acme   Inc.  ")).toBe("acme-inc");
  });

  test("replaces underscores and strips invalid characters", () => {
    expect(generateSlug("Acme_Inc & Co!")).toBe("acme-inc-co");
  });

  test("collapses and trims hyphens", () => {
    expect(generateSlug("--Acme---Inc--")).toBe("acme-inc");
  });
});

describe("normalizeSlugInput", () => {
  test("keeps a trailing hyphen while typing", () => {
    expect(normalizeSlugInput("Acme Inc ")).toBe("acme-inc-");
  });

  test("strips leading hyphens", () => {
    expect(normalizeSlugInput("--Acme")).toBe("acme");
  });
});
