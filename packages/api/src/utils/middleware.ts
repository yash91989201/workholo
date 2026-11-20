import { ORPCError } from "@orpc/server";
import { findMembership } from "@workholo/auth/policy";
import { organization } from "@workholo/db/schema/auth";
import { eq } from "drizzle-orm";

import type { OrganizationContext } from "../context";
import { o } from "./orpc";
import { parseOrganizationId } from "./tenant";

export const requireUser = o.middleware(async ({ context, next }) => {
  if (!context.session?.user) {
    throw new ORPCError("UNAUTHORIZED");
  }
  return next({ context: { session: context.session } });
});

export const requirePlatformAdmin = o.middleware(async ({ context, next }) => {
  if (!context.session?.user) {
    throw new ORPCError("UNAUTHORIZED");
  }
  if (context.session.user.role !== "platform_admin") {
    throw new ORPCError("FORBIDDEN", {
      message: "Platform administrators only",
    });
  }
  return next();
});

/**
 * Resolves the tenant from the request and the database, never from session
 * state: a stale activeOrganizationId must not authorize anything.
 */
export const requireOrg = o.middleware(async ({ context, next }, input) => {
  const organizationId = parseOrganizationId(input);
  if (!context.session?.user) {
    throw new ORPCError("UNAUTHORIZED");
  }
  const membership = await findMembership(
    context.db,
    context.session.user.id,
    organizationId
  );
  if (!membership) {
    throw new ORPCError("FORBIDDEN", {
      message: "You do not belong to this organization",
    });
  }
  const rows = await context.db
    .select({ suspendedAt: organization.suspendedAt })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);
  const [target] = rows;
  if (!target) {
    throw new ORPCError("NOT_FOUND", { message: "Organization not found" });
  }
  if (target.suspendedAt) {
    throw new ORPCError("FORBIDDEN", { message: "Organization is suspended" });
  }
  return next({ context: { organizationId, membershipRole: membership.role } });
});

export function requireRoles(roles: readonly string[]) {
  return o.middleware(async ({ context, next }) => {
    const { membershipRole } = context as OrganizationContext;
    if (!roles.includes(membershipRole)) {
      throw new ORPCError("FORBIDDEN", { message: "Insufficient role" });
    }
    return next();
  });
}
