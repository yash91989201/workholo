import type { Database } from "@workholo/db";
import { member, organization, user } from "@workholo/db/schema/auth";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";
import { and, eq, or } from "drizzle-orm";

import {
  assertOwnerContinuity,
  canManageMember,
  findMembership,
} from "./policy";

type GuardBody = {
  organizationId?: string;
  memberId?: string;
  memberIdOrEmail?: string;
  role?: string;
};

type Actor = { role: string };

const GUARDED_PATHS: Record<string, true> = {
  "/organization/add-member": true,
  "/organization/update-member-role": true,
  "/organization/remove-member": true,
};

async function findMember(db: Database, organizationId: string, key: string) {
  const rows = await db
    .select({ id: member.id, role: member.role, userId: member.userId })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(
      and(
        eq(member.organizationId, organizationId),
        or(eq(member.id, key), eq(member.userId, key), eq(user.email, key))
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

async function requireActiveOrganization(
  db: Database,
  organizationId: string
): Promise<void> {
  const rows = await db
    .select({ suspendedAt: organization.suspendedAt })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);
  const [target] = rows;
  if (!target) {
    throw new APIError("BAD_REQUEST", { message: "Organization not found" });
  }
  if (target.suspendedAt) {
    throw new APIError("FORBIDDEN", { message: "Organization is suspended" });
  }
}

async function requireActor(
  db: Database,
  userId: string,
  organizationId: string
): Promise<Actor> {
  const actor = await findMembership(db, userId, organizationId);
  if (!actor) {
    throw new APIError("FORBIDDEN", {
      message: "You do not belong to this organization",
    });
  }
  return actor;
}

async function requireTargetMember(
  db: Database,
  organizationId: string,
  key: string
) {
  const targetMember = await findMember(db, organizationId, key);
  if (!targetMember) {
    throw new APIError("BAD_REQUEST", { message: "Member not found" });
  }
  return targetMember;
}

async function guardUpdateMemberRole(
  db: Database,
  organizationId: string,
  body: GuardBody,
  actor: Actor
): Promise<void> {
  const targetMember = await requireTargetMember(
    db,
    organizationId,
    body.memberId ?? ""
  );
  if (!canManageMember(actor.role, targetMember.role, "update")) {
    throw new APIError("FORBIDDEN", {
      message: "You cannot change this member's role",
    });
  }
  await assertOwnerContinuity(db, organizationId, targetMember, body.role);
}

async function guardRemoveMember(
  db: Database,
  organizationId: string,
  body: GuardBody,
  actor: Actor,
  actorUserId: string
): Promise<void> {
  const targetMember = await requireTargetMember(
    db,
    organizationId,
    body.memberIdOrEmail ?? ""
  );
  if (
    targetMember.userId !== actorUserId &&
    !canManageMember(actor.role, targetMember.role, "remove")
  ) {
    throw new APIError("FORBIDDEN", {
      message: "You cannot remove this member",
    });
  }
  await assertOwnerContinuity(db, organizationId, targetMember);
}

function guardAddMember(actor: Actor, body: GuardBody): void {
  if (!canManageMember(actor.role, body.role ?? "", "update")) {
    throw new APIError("FORBIDDEN", {
      message: "You cannot add this member",
    });
  }
}

/**
 * Actor-target rules cannot use the plugin's member hooks, which receive the
 * target user; they run on the request so the acting session is available.
 */
export function createRequestGuards(db: Database) {
  return createAuthMiddleware(async (ctx) => {
    if (!GUARDED_PATHS[ctx.path]) {
      return;
    }
    const session = await getSessionFromCtx(ctx);
    if (!session?.user) {
      return;
    }
    const body = (ctx.body ?? {}) as GuardBody;
    const organizationId =
      body.organizationId ?? session.session.activeOrganizationId;
    if (!organizationId) {
      throw new APIError("BAD_REQUEST", {
        message: "Organization is required",
      });
    }

    await requireActiveOrganization(db, organizationId);
    const actor = await requireActor(db, session.user.id, organizationId);

    if (ctx.path === "/organization/update-member-role") {
      await guardUpdateMemberRole(db, organizationId, body, actor);
      return;
    }
    if (ctx.path === "/organization/remove-member") {
      await guardRemoveMember(db, organizationId, body, actor, session.user.id);
      return;
    }
    guardAddMember(actor, body);
  });
}
