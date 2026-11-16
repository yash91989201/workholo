import { member, organization, user } from "@workholo/db/schema/auth";
import { desc, eq } from "drizzle-orm";
import z from "zod";

import { consoleProcedure, protectedProcedure } from "../index";

const organizationIdInput = z.object({ organizationId: z.string() });

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

  members: consoleProcedure
    .input(organizationIdInput)
    .handler(async ({ context }) =>
      context.db
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
        .orderBy(desc(member.createdAt))
    ),
};
