import { ORPCError } from "@orpc/server";
import { createAuditEvent } from "@workholo/auth/audit";
import { member, organization } from "@workholo/db/schema/auth";
import {
  outboundNumber,
  outboundNumberAssignment,
} from "@workholo/db/schema/numbers";
import { count, desc, eq, ilike, or } from "drizzle-orm";
import { platformProcedure } from "../index";
import {
  AssignOutboundNumberInputSchema,
  AssignOutboundNumberOutputSchema,
  ListOutboundNumbersOutputSchema,
  RegisterOutboundNumberInputSchema,
  RegisterOutboundNumberOutputSchema,
  SetOutboundNumberEnabledInputSchema,
  SetOutboundNumberEnabledOutputSchema,
  UnassignOutboundNumberInputSchema,
  UnassignOutboundNumberOutputSchema,
} from "../lib/schemas/numbers";
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
import { normalizePhone } from "../utils/phone";

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

  listOutboundNumbers: platformProcedure
    .output(ListOutboundNumbersOutputSchema)
    .handler(async ({ context }) =>
      context.db
        .select({
          id: outboundNumber.id,
          number: outboundNumber.number,
          enabled: outboundNumber.enabled,
          createdAt: outboundNumber.createdAt,
          assignedOrganizationId: outboundNumberAssignment.organizationId,
          assignedOrganizationName: organization.name,
        })
        .from(outboundNumber)
        .leftJoin(
          outboundNumberAssignment,
          eq(outboundNumberAssignment.numberId, outboundNumber.id)
        )
        .leftJoin(
          organization,
          eq(organization.id, outboundNumberAssignment.organizationId)
        )
        .orderBy(desc(outboundNumber.createdAt))
    ),

  registerOutboundNumber: platformProcedure
    .input(RegisterOutboundNumberInputSchema)
    .output(RegisterOutboundNumberOutputSchema)
    .handler(async ({ context, input }) => {
      const canonical = normalizePhone(input.number);
      if (!canonical) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Number must be explicit E.164",
        });
      }
      const created = await context.db
        .insert(outboundNumber)
        .values({ id: crypto.randomUUID(), number: canonical })
        .onConflictDoNothing({ target: outboundNumber.number })
        .returning({ id: outboundNumber.id, number: outboundNumber.number });
      const [row] = created;
      if (!row) {
        throw new ORPCError("CONFLICT", {
          message: "Number already in inventory",
        });
      }
      return row;
    }),

  setOutboundNumberEnabled: platformProcedure
    .input(SetOutboundNumberEnabledInputSchema)
    .output(SetOutboundNumberEnabledOutputSchema)
    .handler(async ({ context, input }) => {
      const rows = await context.db
        .update(outboundNumber)
        .set({ enabled: input.enabled })
        .where(eq(outboundNumber.id, input.numberId))
        .returning({ id: outboundNumber.id, enabled: outboundNumber.enabled });
      return rows[0] ?? null;
    }),

  assignOutboundNumber: platformProcedure
    .input(AssignOutboundNumberInputSchema)
    .output(AssignOutboundNumberOutputSchema)
    .handler(async ({ context, input }) => {
      const numbers = await context.db
        .select({ id: outboundNumber.id })
        .from(outboundNumber)
        .where(eq(outboundNumber.id, input.numberId))
        .limit(1);
      if (!numbers[0]) {
        throw new ORPCError("NOT_FOUND", { message: "Number not found" });
      }
      const organizations = await context.db
        .select({ id: organization.id })
        .from(organization)
        .where(eq(organization.id, input.organizationId))
        .limit(1);
      if (!organizations[0]) {
        throw new ORPCError("NOT_FOUND", { message: "Organization not found" });
      }
      const rows = await context.db
        .insert(outboundNumberAssignment)
        .values({
          id: crypto.randomUUID(),
          numberId: input.numberId,
          organizationId: input.organizationId,
        })
        .onConflictDoNothing({
          target: outboundNumberAssignment.numberId,
        })
        .returning({
          id: outboundNumberAssignment.id,
          organizationId: outboundNumberAssignment.organizationId,
        });
      const [row] = rows;
      if (!row) {
        throw new ORPCError("CONFLICT", {
          message: "Number is already assigned",
        });
      }
      return row;
    }),

  unassignOutboundNumber: platformProcedure
    .input(UnassignOutboundNumberInputSchema)
    .output(UnassignOutboundNumberOutputSchema)
    .handler(async ({ context, input }) => {
      const rows = await context.db
        .delete(outboundNumberAssignment)
        .where(eq(outboundNumberAssignment.numberId, input.numberId))
        .returning({ id: outboundNumberAssignment.id });
      return rows[0] ?? null;
    }),
};
