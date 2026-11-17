import type { Database } from "@workholo/db";
import { APIError } from "better-auth/api";
import type { OrganizationOptions } from "better-auth/plugins/organization";

import {
  assertNoMembership,
  assertOwnerContinuity,
  canInviteRole,
  findMembership,
  isOrganizationRole,
} from "./policy";

type OrganizationHooks = NonNullable<OrganizationOptions["organizationHooks"]>;

async function requireMembership(
  db: Database,
  userId: string,
  organizationId: string
) {
  const membership = await findMembership(db, userId, organizationId);
  if (!membership) {
    throw new APIError("FORBIDDEN", {
      message: "You do not belong to this organization",
    });
  }
  return membership;
}

export function createOrganizationHooks(db: Database): OrganizationHooks {
  return {
    beforeAddMember: async ({ member: nextMember }) => {
      await assertNoMembership(db, nextMember.userId);
    },
    beforeAcceptInvitation: async ({ user, organization }) => {
      if (organization.suspendedAt) {
        throw new APIError("FORBIDDEN", {
          message: "Organization is suspended",
        });
      }
      await assertNoMembership(db, user.id);
    },
    beforeCreateInvitation: async ({ invitation, inviter, organization }) => {
      if (organization.suspendedAt) {
        throw new APIError("FORBIDDEN", {
          message: "Organization is suspended",
        });
      }
      const actor = await requireMembership(db, inviter.id, organization.id);
      if (
        !(
          isOrganizationRole(invitation.role) &&
          canInviteRole(actor.role, invitation.role)
        )
      ) {
        throw new APIError("FORBIDDEN", {
          message: `You cannot invite the ${invitation.role} role`,
        });
      }
      const hasTeam = Boolean(invitation.teamId);
      if (invitation.role === "agent" && !hasTeam) {
        throw new APIError("BAD_REQUEST", {
          message: "Agent invitations must name a team",
        });
      }
      if (invitation.role !== "agent" && hasTeam) {
        throw new APIError("BAD_REQUEST", {
          message: "Only agent invitations may name a team",
        });
      }
    },
    beforeAddTeamMember: async ({ user, organization }) => {
      const target = await findMembership(db, user.id, organization.id);
      if (target?.role !== "agent") {
        throw new APIError("FORBIDDEN", {
          message: "Only agents can join a team",
        });
      }
    },
    // Actor-target rules run in request-guards; these hooks only see the target.
    beforeUpdateMemberRole: async ({
      member: target,
      newRole,
      organization,
    }) => {
      if (!isOrganizationRole(newRole)) {
        throw new APIError("BAD_REQUEST", {
          message: `Unknown role ${newRole}`,
        });
      }
      await assertOwnerContinuity(db, organization.id, target, newRole);
    },
    beforeRemoveMember: async ({ member: target, organization }) => {
      await assertOwnerContinuity(db, organization.id, target);
    },
  };
}
