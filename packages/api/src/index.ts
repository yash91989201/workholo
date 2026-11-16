import { ORPCError, os } from "@orpc/server";
import { findMembership } from "@workholo/auth/policy";
import { organization } from "@workholo/db/schema/auth";
import { eq } from "drizzle-orm";

import type { Context, OrganizationContext } from "./context";

export const o = os.$context<Context>();

export const publicProcedure = o;

export const requireUser = o.middleware(async ({ context, next }) => {
  if (!context.session?.user) {
    throw new ORPCError("UNAUTHORIZED");
  }
  return next({ context: { session: context.session } });
});

/** Session is guaranteed from here on; kept concrete for downstream middleware. */
export const protectedProcedure = publicProcedure.use(requireUser);

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

export const platformProcedure = protectedProcedure.use(requirePlatformAdmin);

type OrganizationInput = { organizationId?: unknown };

function requestedOrganizationId(input: unknown): string {
  const organizationId = (input as OrganizationInput | undefined)
    ?.organizationId;
  if (typeof organizationId !== "string" || organizationId.length === 0) {
    throw new ORPCError("BAD_REQUEST", {
      message: "organizationId is required",
    });
  }
  return organizationId;
}

/**
 * Resolves the tenant from the request and the database, never from session
 * state: a stale activeOrganizationId must not authorize anything.
 */
export const requireOrg = o.middleware(async ({ context, next }, input) => {
  const organizationId = requestedOrganizationId(input);
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

export const orgProcedure = publicProcedure.use(requireUser).use(requireOrg);

export function requireRoles(roles: readonly string[]) {
  return o.middleware(async ({ context, next }) => {
    const { membershipRole } = context as OrganizationContext;
    if (!roles.includes(membershipRole)) {
      throw new ORPCError("FORBIDDEN", { message: "Insufficient role" });
    }
    return next();
  });
}

/** Console endpoints: owner or admin membership. */
export const consoleProcedure = orgProcedure.use(
  requireRoles(["owner", "admin"])
);
