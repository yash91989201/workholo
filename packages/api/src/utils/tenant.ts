import { ORPCError } from "@orpc/server";
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

type OrganizationInput = { organizationId?: unknown };

/** Reads the organization id from raw procedure input before validation runs. */
export function parseOrganizationId(input: unknown): string {
  const organizationId = (input as OrganizationInput | undefined)
    ?.organizationId;
  if (typeof organizationId !== "string" || organizationId.length === 0) {
    throw new ORPCError("BAD_REQUEST", {
      message: "organizationId is required",
    });
  }
  return organizationId;
}
