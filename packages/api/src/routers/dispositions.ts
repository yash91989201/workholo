import { ORPCError } from "@orpc/server";
import { createAuditEvent } from "@workholo/auth/audit";
import type { Database } from "@workholo/db";
import {
  dispositionEntry,
  dispositionList,
} from "@workholo/db/schema/dispositions";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import type { z } from "zod";
import { consoleProcedure } from "../index";
import {
  AddDispositionEntryInputSchema,
  AddDispositionEntryOutputSchema,
  ArchiveDispositionListInputSchema,
  ArchiveDispositionListOutputSchema,
  CreateDispositionListInputSchema,
  CreateDispositionListOutputSchema,
  GetDispositionEntryInputSchema,
  GetDispositionEntryOutputSchema,
  GetDispositionListInputSchema,
  GetDispositionListOutputSchema,
  ListActiveDispositionEntriesInputSchema,
  ListActiveDispositionEntriesOutputSchema,
  ListActiveDispositionListsInputSchema,
  ListActiveDispositionListsOutputSchema,
  ListDispositionListsInputSchema,
  ListDispositionListsOutputSchema,
  RetireDispositionEntryInputSchema,
  RetireDispositionEntryOutputSchema,
  UpdateDispositionListInputSchema,
  UpdateDispositionListOutputSchema,
} from "../lib/schemas/dispositions";
import { organizationScope } from "../utils/tenant";

export type DispositionListRow = z.infer<
  typeof ListDispositionListsOutputSchema
>[number];

export type DispositionEntryRow = z.infer<
  typeof GetDispositionListOutputSchema
>["entries"][number];

export type ActiveDispositionListRow = z.infer<
  typeof ListActiveDispositionListsOutputSchema
>[number];

export type ActiveDispositionEntryRow = z.infer<
  typeof ListActiveDispositionEntriesOutputSchema
>[number];

async function requireList(
  db: Database,
  organizationId: string,
  listId: string
) {
  const rows = await db
    .select({
      id: dispositionList.id,
      name: dispositionList.name,
      description: dispositionList.description,
      archivedAt: dispositionList.archivedAt,
      createdAt: dispositionList.createdAt,
    })
    .from(dispositionList)
    .where(
      and(
        eq(dispositionList.id, listId),
        eq(dispositionList.organizationId, organizationId)
      )
    )
    .limit(1);
  const [row] = rows;
  if (!row) {
    throw new ORPCError("NOT_FOUND", { message: "Disposition list not found" });
  }
  return row;
}

async function activeEntryCounts(db: Database, organizationId: string) {
  const rows = await db
    .select({ listId: dispositionEntry.listId, value: count() })
    .from(dispositionEntry)
    .innerJoin(dispositionList, eq(dispositionList.id, dispositionEntry.listId))
    .where(
      and(
        eq(dispositionList.organizationId, organizationId),
        isNull(dispositionEntry.retiredAt)
      )
    )
    .groupBy(dispositionEntry.listId);
  return new Map(rows.map((row) => [row.listId, row.value]));
}

function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  if ("code" in error && error.code === "23505") {
    return true;
  }
  return isUniqueViolation(error.cause);
}

export const dispositionsRouter = {
  /** Overview: every list in the resolved organization, active or archived. */
  listDispositionLists: consoleProcedure
    .input(ListDispositionListsInputSchema)
    .output(ListDispositionListsOutputSchema)
    .handler(async ({ context }) => {
      const rows = await context.db
        .select({
          id: dispositionList.id,
          name: dispositionList.name,
          description: dispositionList.description,
          archivedAt: dispositionList.archivedAt,
          createdAt: dispositionList.createdAt,
        })
        .from(dispositionList)
        .where(eq(dispositionList.organizationId, context.organizationId))
        .orderBy(desc(dispositionList.createdAt));
      const counts = await activeEntryCounts(
        context.db,
        context.organizationId
      );
      return rows.map((row) => ({
        ...row,
        entryCount: counts.get(row.id) ?? 0,
      }));
    }),

  /** Every entry, retired or active: historical detail never disappears. */
  getDispositionList: consoleProcedure
    .input(GetDispositionListInputSchema)
    .output(GetDispositionListOutputSchema)
    .handler(async ({ context, input }) => {
      const list = await requireList(
        context.db,
        context.organizationId,
        input.listId
      );
      const entries = await context.db
        .select({
          id: dispositionEntry.id,
          code: dispositionEntry.code,
          label: dispositionEntry.label,
          retiredAt: dispositionEntry.retiredAt,
          createdAt: dispositionEntry.createdAt,
        })
        .from(dispositionEntry)
        .where(eq(dispositionEntry.listId, list.id))
        .orderBy(desc(dispositionEntry.createdAt));
      return {
        id: list.id,
        name: list.name,
        description: list.description,
        archivedAt: list.archivedAt,
        createdAt: list.createdAt,
        entries,
      };
    }),

  createDispositionList: consoleProcedure
    .input(CreateDispositionListInputSchema)
    .output(CreateDispositionListOutputSchema)
    .handler(async ({ context, input }) => {
      const scope = organizationScope(context.organizationId);
      const id = crypto.randomUUID();
      await context.db.insert(dispositionList).values(
        scope.stamp({
          id,
          name: input.name,
          description: input.description ?? null,
        })
      );
      context.audit(
        createAuditEvent(
          context.session?.user.id ?? "",
          "disposition_list.create",
          {
            type: "disposition_list",
            id,
            organizationId: context.organizationId,
          }
        )
      );
      return { id };
    }),

  updateDispositionList: consoleProcedure
    .input(UpdateDispositionListInputSchema)
    .output(UpdateDispositionListOutputSchema)
    .handler(async ({ context, input }) => {
      await requireList(context.db, context.organizationId, input.listId);
      await context.db
        .update(dispositionList)
        .set({
          name: input.name,
          description: input.description,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(dispositionList.id, input.listId),
            eq(dispositionList.organizationId, context.organizationId)
          )
        );
      context.audit(
        createAuditEvent(
          context.session?.user.id ?? "",
          "disposition_list.update",
          {
            type: "disposition_list",
            id: input.listId,
            organizationId: context.organizationId,
          }
        )
      );
      return { id: input.listId };
    }),

  archiveDispositionList: consoleProcedure
    .input(ArchiveDispositionListInputSchema)
    .output(ArchiveDispositionListOutputSchema)
    .handler(async ({ context, input }) => {
      await requireList(context.db, context.organizationId, input.listId);
      await context.db
        .update(dispositionList)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(dispositionList.id, input.listId),
            eq(dispositionList.organizationId, context.organizationId)
          )
        );
      context.audit(
        createAuditEvent(
          context.session?.user.id ?? "",
          "disposition_list.archive",
          {
            type: "disposition_list",
            id: input.listId,
            organizationId: context.organizationId,
          }
        )
      );
      return { id: input.listId };
    }),

  addDispositionEntry: consoleProcedure
    .input(AddDispositionEntryInputSchema)
    .output(AddDispositionEntryOutputSchema)
    .handler(async ({ context, input }) => {
      const list = await requireList(
        context.db,
        context.organizationId,
        input.listId
      );
      if (list.archivedAt) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Disposition list is archived",
        });
      }
      const id = crypto.randomUUID();
      try {
        await context.db.insert(dispositionEntry).values({
          id,
          listId: list.id,
          code: input.code,
          label: input.label,
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ORPCError("CONFLICT", {
            message: "Code or label already exists in this list",
            cause: error,
          });
        }
        throw error;
      }
      context.audit(
        createAuditEvent(
          context.session?.user.id ?? "",
          "disposition_list.entry_add",
          {
            type: "disposition_list",
            id: list.id,
            organizationId: context.organizationId,
          }
        )
      );
      return { id, code: input.code, label: input.label };
    }),

  retireDispositionEntry: consoleProcedure
    .input(RetireDispositionEntryInputSchema)
    .output(RetireDispositionEntryOutputSchema)
    .handler(async ({ context, input }) => {
      const list = await requireList(
        context.db,
        context.organizationId,
        input.listId
      );
      const rows = await context.db
        .update(dispositionEntry)
        .set({ retiredAt: new Date() })
        .where(
          and(
            eq(dispositionEntry.id, input.entryId),
            eq(dispositionEntry.listId, list.id),
            isNull(dispositionEntry.retiredAt)
          )
        )
        .returning({ id: dispositionEntry.id });
      if (rows.length === 0) {
        throw new ORPCError("NOT_FOUND", {
          message: "Disposition entry not found",
        });
      }
      context.audit(
        createAuditEvent(
          context.session?.user.id ?? "",
          "disposition_list.entry_retire",
          {
            type: "disposition_list",
            id: list.id,
            organizationId: context.organizationId,
          }
        )
      );
      return { id: input.entryId };
    }),

  /** Historical lookup: resolves retired entries and archived lists. */
  getDispositionEntry: consoleProcedure
    .input(GetDispositionEntryInputSchema)
    .output(GetDispositionEntryOutputSchema)
    .handler(async ({ context, input }) => {
      const rows = await context.db
        .select({
          id: dispositionEntry.id,
          listId: dispositionEntry.listId,
          code: dispositionEntry.code,
          label: dispositionEntry.label,
          retiredAt: dispositionEntry.retiredAt,
          listArchivedAt: dispositionList.archivedAt,
          createdAt: dispositionEntry.createdAt,
        })
        .from(dispositionEntry)
        .innerJoin(
          dispositionList,
          eq(dispositionList.id, dispositionEntry.listId)
        )
        .where(
          and(
            eq(dispositionEntry.id, input.entryId),
            eq(dispositionList.organizationId, context.organizationId)
          )
        )
        .limit(1);
      const [row] = rows;
      if (!row) {
        throw new ORPCError("NOT_FOUND", {
          message: "Disposition entry not found",
        });
      }
      return row;
    }),

  /** Active lists only, for future campaign setup. */
  listActiveDispositionLists: consoleProcedure
    .input(ListActiveDispositionListsInputSchema)
    .output(ListActiveDispositionListsOutputSchema)
    .handler(async ({ context }) => {
      const rows = await context.db
        .select({
          id: dispositionList.id,
          name: dispositionList.name,
        })
        .from(dispositionList)
        .where(
          and(
            eq(dispositionList.organizationId, context.organizationId),
            isNull(dispositionList.archivedAt)
          )
        )
        .orderBy(dispositionList.name);
      const counts = await activeEntryCounts(
        context.db,
        context.organizationId
      );
      return rows.map((row) => ({
        ...row,
        entryCount: counts.get(row.id) ?? 0,
      }));
    }),

  /** Non-retired entries of one active list, for future campaign setup. */
  listActiveDispositionEntries: consoleProcedure
    .input(ListActiveDispositionEntriesInputSchema)
    .output(ListActiveDispositionEntriesOutputSchema)
    .handler(async ({ context, input }) => {
      const list = await requireList(
        context.db,
        context.organizationId,
        input.listId
      );
      if (list.archivedAt) {
        return [];
      }
      return context.db
        .select({
          id: dispositionEntry.id,
          code: dispositionEntry.code,
          label: dispositionEntry.label,
        })
        .from(dispositionEntry)
        .where(
          and(
            eq(dispositionEntry.listId, list.id),
            isNull(dispositionEntry.retiredAt)
          )
        )
        .orderBy(dispositionEntry.code);
    }),
};
