import { createAuditEvent } from "@workholo/auth/audit";
import { member, organization } from "@workholo/db/schema/auth";
import { count, desc, eq, ilike, or } from "drizzle-orm";
import { platformProcedure } from "../index";
import {
  DeleteOrganizationInputSchema,
  DeleteOrganizationOutputSchema,
  ListOrganizationsInputSchema,
  ListOrganizationsOutputSchema,
  RestoreOrganizationInputSchema,
  RestoreOrganizationOutputSchema,
  SuspendOrganizationInputSchema,
  SuspendOrganizationOutputSchema,
} from "../lib/schemas/platform";

export const platformRouter = {
  /** Cross-tenant listing: platform staff are not members of these organizations. */
  listOrganizations: platformProcedure
    .input(ListOrganizationsInputSchema)
    .output(ListOrganizationsOutputSchema)
    .handler(async ({ context, input }) => {
      const where = input.search
        ? or(
            ilike(organization.name, `%${input.search}%`),
            ilike(organization.slug, `%${input.search}%`)
          )
        : undefined;

      const rows = await context.db
        .select({
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          createdAt: organization.createdAt,
          suspendedAt: organization.suspendedAt,
          suspendedReason: organization.suspendedReason,
          memberCount: count(member.id),
        })
        .from(organization)
        .leftJoin(member, eq(member.organizationId, organization.id))
        .where(where)
        .groupBy(organization.id)
        .orderBy(desc(organization.createdAt))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);

      const totals = await context.db
        .select({ value: count() })
        .from(organization)
        .where(where);

      return {
        items: rows.map((row) => ({
          ...row,
          status: row.suspendedAt
            ? ("suspended" as const)
            : ("active" as const),
        })),
        total: totals[0]?.value ?? 0,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  suspendOrganization: platformProcedure
    .input(SuspendOrganizationInputSchema)
    .output(SuspendOrganizationOutputSchema)
    .handler(async ({ context, input }) => {
      const actorId = context.session?.user.id ?? "";
      const rows = await context.db
        .update(organization)
        .set({
          suspendedAt: new Date(),
          suspendedReason: input.reason,
          suspendedByUserId: actorId,
        })
        .where(eq(organization.id, input.organizationId))
        .returning({
          id: organization.id,
          suspendedAt: organization.suspendedAt,
        });
      if (!rows[0]) {
        return null;
      }
      context.audit(
        createAuditEvent(
          actorId,
          "organization.suspend",
          {
            type: "organization",
            id: input.organizationId,
          },
          input.reason
        )
      );
      return rows[0];
    }),

  restoreOrganization: platformProcedure
    .input(RestoreOrganizationInputSchema)
    .output(RestoreOrganizationOutputSchema)
    .handler(async ({ context, input }) => {
      const actorId = context.session?.user.id ?? "";
      const rows = await context.db
        .update(organization)
        .set({
          suspendedAt: null,
          suspendedReason: null,
          suspendedByUserId: null,
        })
        .where(eq(organization.id, input.organizationId))
        .returning({ id: organization.id });
      if (!rows[0]) {
        return null;
      }
      context.audit(
        createAuditEvent(actorId, "organization.restore", {
          type: "organization",
          id: input.organizationId,
        })
      );
      return rows[0];
    }),

  deleteOrganization: platformProcedure
    .input(DeleteOrganizationInputSchema)
    .output(DeleteOrganizationOutputSchema)
    .handler(async ({ context, input }) => {
      const actorId = context.session?.user.id ?? "";
      const deleted = await context.db
        .delete(organization)
        .where(eq(organization.id, input.organizationId))
        .returning({ id: organization.id });
      if (!deleted[0]) {
        return null;
      }
      context.audit(
        createAuditEvent(actorId, "organization.delete", {
          type: "organization",
          id: input.organizationId,
        })
      );
      return deleted[0];
    }),
};
