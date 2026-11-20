const E164_PATTERN = /^\+[1-9]\d{7,14}$/;
const SEPARATORS = /[\s().-]/g;

/**
 * Canonical E.164 or null. Only explicit international prefixes are accepted
 * (`+` or `00`); a bare national number is never given a country code.
 */
export function normalizePhone(input: string): string | null {
  const stripped = input.trim().replace(SEPARATORS, "");
  if (stripped.length === 0) {
    return null;
  }
  const candidate = stripped.startsWith("00")
    ? `+${stripped.slice(2)}`
    : stripped;
  return E164_PATTERN.test(candidate) ? candidate : null;
}
