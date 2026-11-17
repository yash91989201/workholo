import { ORPCError } from "@orpc/server";
import {
  invitation,
  member,
  organization,
  team,
  teamMember,
  user,
} from "@workholo/db/schema/auth";
import { and, desc, eq } from "drizzle-orm";
import z from "zod";

import { consoleProcedure, protectedProcedure } from "../index";

export type DirectoryRow = {
  id: string;
  userId: string;
  role: string;
  name: string;
  email: string;
  createdAt: Date;
  teams: string[];
};

export type InvitationRow = {
  id: string;
  email: string;
  role: string | null;
  expiresAt: Date;
  createdAt: Date;
  teamName: string | null;
};

export type TeamRow = {
  id: string;
  name: string;
  memberCount: number;
  createdAt: Date;
};

export type TeamMemberRow = {
  id: string;
  userId: string;
  name: string;
  email: string;
  createdAt: Date;
};

const organizationIdInput = z.object({ organizationId: z.string() });
const teamInput = z.object({
  organizationId: z.string(),
  teamId: z.string(),
});

export const organizationRouter = {
  /** Current membership, used by every surface to gate entry. */
  me: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session?.user.id ?? "";
    const rows = await context.db
      .select({
        organizationId: organization.id,
        name: organization.name,
        slug: organization.slug,
        suspendedAt: organization.suspendedAt,
        role: member.role,
      })
      .from(member)
      .innerJoin(organization, eq(organization.id, member.organizationId))
      .where(eq(member.userId, userId))
      .limit(1);
    return {
      user: context.session?.user,
      membership: rows[0] ?? null,
    };
  }),

  /** Full roster regardless of role, with each member's team names. */
  directory: consoleProcedure
    .input(organizationIdInput)
    .handler(async ({ context }): Promise<DirectoryRow[]> => {
      const rows = await context.db
        .select({
          id: member.id,
          userId: member.userId,
          role: member.role,
          name: user.name,
          email: user.email,
          createdAt: member.createdAt,
        })
        .from(member)
        .innerJoin(user, eq(user.id, member.userId))
        .where(eq(member.organizationId, context.organizationId))
        .orderBy(desc(member.createdAt));
      const memberships = await context.db
        .select({ userId: teamMember.userId, name: team.name })
        .from(teamMember)
        .innerJoin(team, eq(team.id, teamMember.teamId))
        .where(eq(team.organizationId, context.organizationId));
      const teamsByUser = new Map<string, string[]>();
      for (const row of memberships) {
        const names = teamsByUser.get(row.userId) ?? [];
        names.push(row.name);
        teamsByUser.set(row.userId, names);
      }
      return rows.map((row) => ({
        ...row,
        teams: teamsByUser.get(row.userId) ?? [],
      }));
    }),

  /** Pending invitations; `teamId` is comma-joined by the plugin, display the first. */
  invitations: consoleProcedure
    .input(organizationIdInput)
    .handler(async ({ context }): Promise<InvitationRow[]> => {
      const teams = await context.db
        .select({ id: team.id, name: team.name })
        .from(team)
        .where(eq(team.organizationId, context.organizationId));
      const teamNames = new Map(teams.map((row) => [row.id, row.name]));
      const rows = await context.db
        .select({
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          teamId: invitation.teamId,
          expiresAt: invitation.expiresAt,
          createdAt: invitation.createdAt,
        })
        .from(invitation)
        .where(
          and(
            eq(invitation.organizationId, context.organizationId),
            eq(invitation.status, "pending")
          )
        )
        .orderBy(desc(invitation.createdAt));
      return rows.map(({ teamId, ...row }) => ({
        ...row,
        teamName: teamNames.get(teamId?.split(",")[0] ?? "") ?? null,
      }));
    }),

  teams: consoleProcedure.input(organizationIdInput).handler(
    async ({ context }): Promise<TeamRow[]> =>
      context.db
        .select({
          id: team.id,
          name: team.name,
          memberCount: team.memberCount,
          createdAt: team.createdAt,
        })
        .from(team)
        .where(eq(team.organizationId, context.organizationId))
        .orderBy(team.name)
  ),

  teamMembers: consoleProcedure
    .input(teamInput)
    .handler(async ({ context, input }): Promise<TeamMemberRow[]> => {
      const rows = await context.db
        .select({ id: team.id })
        .from(team)
        .where(
          and(
            eq(team.id, input.teamId),
            eq(team.organizationId, context.organizationId)
          )
        )
        .limit(1);
      if (!rows[0]) {
        throw new ORPCError("NOT_FOUND", { message: "Team not found" });
      }
      return context.db
        .select({
          id: teamMember.id,
          userId: teamMember.userId,
          name: user.name,
          email: user.email,
          createdAt: teamMember.createdAt,
        })
        .from(teamMember)
        .innerJoin(user, eq(user.id, teamMember.userId))
        .where(eq(teamMember.teamId, input.teamId))
        .orderBy(desc(teamMember.createdAt));
    }),
};
