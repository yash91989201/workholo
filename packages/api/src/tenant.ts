import { eq, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/**
 * Tenant boundary for query builders: every read filters by the verified
 * organization and every create is stamped with it, never with client input.
 */
export function organizationScope(organizationId: string) {
  return {
    filter: (column: AnyPgColumn): SQL => eq(column, organizationId),
    stamp: <T extends Record<string, unknown>>(
      values: T
    ): T & { organizationId: string } => ({ ...values, organizationId }),
  };
}
