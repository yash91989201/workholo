import type { Database } from "@workholo/db";
import { member } from "@workholo/db/schema/auth";
import { APIError } from "better-auth/api";
import { and, count, eq } from "drizzle-orm";

export const ORGANIZATION_ROLES = ["owner", "admin", "agent"] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export function isOrganizationRole(value: string): value is OrganizationRole {
  return (ORGANIZATION_ROLES as readonly string[]).includes(value);
}

/** Owner invites admins and agents; admins invite agents only; owner is never invitable. */
export function canInviteRole(
  inviterRole: string,
  targetRole: string
): boolean {
  if (targetRole === "owner") {
    return false;
  }
  if (targetRole === "admin") {
    return inviterRole === "owner";
  }
  if (targetRole === "agent") {
    return inviterRole === "owner" || inviterRole === "admin";
  }
  return false;
}

export type MembershipAction = "update" | "remove";

/** Admins manage agents; owners manage admins and agents; owners are never managed. */
export function canManageMember(
  actorRole: string,
  targetRole: string,
  _action: MembershipAction
): boolean {
  if (!isOrganizationRole(targetRole) || targetRole === "owner") {
    return false;
  }
  if (actorRole === "owner") {
    return true;
  }
  return actorRole === "admin" && targetRole === "agent";
}

export type InvitationOrigins = { console: string; agent: string };

/** Admin invitations open the console; agent invitations open the agent panel. */
export function invitationOrigin(
  role: string,
  origins: InvitationOrigins
): string {
  const origin = role === "admin" ? origins.console : origins.agent;
  return origin.replace(/\/$/, "");
}

export function invitationUrl(
  role: string,
  invitationId: string,
  origins: InvitationOrigins
): string {
  return `${invitationOrigin(role, origins)}/accept-invitation?id=${encodeURIComponent(invitationId)}`;
}

export async function findMembership(
  db: Database,
  userId: string,
  organizationId: string
): Promise<{ role: string } | null> {
  const rows = await db
    .select({ role: member.role })
    .from(member)
    .where(
      and(eq(member.userId, userId), eq(member.organizationId, organizationId))
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function countOwners(
  db: Database,
  organizationId: string
): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(member)
    .where(
      and(eq(member.organizationId, organizationId), eq(member.role, "owner"))
    );
  return rows[0]?.value ?? 0;
}

/** One membership per user, surfaced as a clear error before the unique index fires. */
export async function assertNoMembership(
  db: Database,
  userId: string
): Promise<void> {
  const rows = await db
    .select({ id: member.id })
    .from(member)
    .where(eq(member.userId, userId))
    .limit(1);
  if (rows[0]) {
    throw new APIError("FORBIDDEN", {
      message: "You already belong to an organization",
    });
  }
}

/**
 * The last owner cannot be demoted or removed.
 * shortcut: check-then-write, not serialized; concurrent owner changes can race.
 */
export async function assertOwnerContinuity(
  db: Database,
  organizationId: string,
  target: { role: string },
  nextRole?: string
): Promise<void> {
  if (target.role !== "owner" || nextRole === "owner") {
    return;
  }
  if ((await countOwners(db, organizationId)) <= 1) {
    throw new APIError("FORBIDDEN", {
      message: "An organization must keep at least one owner",
    });
  }
}
