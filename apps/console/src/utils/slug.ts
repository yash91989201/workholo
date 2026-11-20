/**
 * Organization slug: lowercase words joined by single hyphens.
 * Mirrors the original workholo slug generator.
 */
export function generateSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Live slug input normalization. Keeps a trailing hyphen so the next word can
 * still be typed.
 */
export function normalizeSlugInput(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "");
}
