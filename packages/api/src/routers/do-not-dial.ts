import { ORPCError } from "@orpc/server";
import { createAuditEvent } from "@workholo/auth/audit";
import { doNotDialEntry } from "@workholo/db/schema/do-not-dial";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import { consoleProcedure, orgProcedure } from "../index";
import {
  AddDoNotDialEntryInputSchema,
  AddDoNotDialEntryOutputSchema,
  CheckDoNotDialNumberInputSchema,
  CheckDoNotDialNumberOutputSchema,
  ListDoNotDialEntriesInputSchema,
  ListDoNotDialEntriesOutputSchema,
  RemoveDoNotDialEntryInputSchema,
  RemoveDoNotDialEntryOutputSchema,
} from "../lib/schemas/do-not-dial";
import { normalizePhone } from "../utils/phone";

export type DoNotDialEntryRow = z.infer<
  typeof ListDoNotDialEntriesOutputSchema
>[number];

function requireE164(input: string): string {
  const number = normalizePhone(input);
  if (!number) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Number must be explicit E.164, for example +14155550123",
    });
  }
  return number;
}

export const doNotDialRouter = {
  listDoNotDialEntries: consoleProcedure
    .input(ListDoNotDialEntriesInputSchema)
    .output(ListDoNotDialEntriesOutputSchema)
    .handler(async ({ context }) =>
      context.db
        .select({
          id: doNotDialEntry.id,
          number: doNotDialEntry.e164Number,
          createdAt: doNotDialEntry.createdAt,
        })
        .from(doNotDialEntry)
        .where(eq(doNotDialEntry.organizationId, context.organizationId))
        .orderBy(doNotDialEntry.e164Number)
    ),

  addDoNotDialEntry: consoleProcedure
    .input(AddDoNotDialEntryInputSchema)
    .output(AddDoNotDialEntryOutputSchema)
    .handler(async ({ context, input }) => {
      const number = requireE164(input.number);
      const created = await context.db
        .insert(doNotDialEntry)
        .values({
          id: crypto.randomUUID(),
          organizationId: context.organizationId,
          e164Number: number,
        })
        .onConflictDoNothing()
        .returning({ id: doNotDialEntry.id });
      const [inserted] = created;
      if (!inserted) {
        const existing = await context.db
          .select({ id: doNotDialEntry.id })
          .from(doNotDialEntry)
          .where(
            and(
              eq(doNotDialEntry.organizationId, context.organizationId),
              eq(doNotDialEntry.e164Number, number)
            )
          )
          .limit(1);
        const [row] = existing;
        if (!row) {
          throw new ORPCError("CONFLICT", {
            message: "Number is already in this organization's set",
          });
        }
        return { id: row.id, number };
      }
      context.audit(
        createAuditEvent(
          context.session?.user.id ?? "",
          "do_not_dial.entry_add",
          {
            type: "do_not_dial",
            id: inserted.id,
            organizationId: context.organizationId,
          },
          number
        )
      );
      return { id: inserted.id, number };
    }),

  removeDoNotDialEntry: consoleProcedure
    .input(RemoveDoNotDialEntryInputSchema)
    .output(RemoveDoNotDialEntryOutputSchema)
    .handler(async ({ context, input }) => {
      const removed = await context.db
        .delete(doNotDialEntry)
        .where(
          and(
            eq(doNotDialEntry.id, input.entryId),
            eq(doNotDialEntry.organizationId, context.organizationId)
          )
        )
        .returning({ id: doNotDialEntry.id });
      const [row] = removed;
      if (!row) {
        throw new ORPCError("NOT_FOUND", { message: "Entry not found" });
      }
      context.audit(
        createAuditEvent(
          context.session?.user.id ?? "",
          "do_not_dial.entry_remove",
          {
            type: "do_not_dial",
            id: row.id,
            organizationId: context.organizationId,
          }
        )
      );
      return { id: row.id };
    }),

  /** Boolean suppression check for any member of the resolved organization. */
  checkDoNotDialNumber: orgProcedure
    .input(CheckDoNotDialNumberInputSchema)
    .output(CheckDoNotDialNumberOutputSchema)
    .handler(async ({ context, input }) => {
      const number = requireE164(input.number);
      const rows = await context.db
        .select({ id: doNotDialEntry.id })
        .from(doNotDialEntry)
        .where(
          and(
            eq(doNotDialEntry.organizationId, context.organizationId),
            eq(doNotDialEntry.e164Number, number)
          )
        )
        .limit(1);
      return { suppressed: rows.length > 0 };
    }),
};
