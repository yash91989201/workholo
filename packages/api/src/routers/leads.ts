import { ORPCError } from "@orpc/server";
import { createAuditEvent } from "@workholo/auth/audit";
import type { Database } from "@workholo/db";
import { lead, leadList } from "@workholo/db/schema/leads";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import type { z } from "zod";
import { consoleProcedure } from "../index";
import {
  AddLeadInputSchema,
  AddLeadOutputSchema,
  ArchiveLeadListInputSchema,
  ArchiveLeadListOutputSchema,
  CreateLeadListInputSchema,
  CreateLeadListOutputSchema,
  GetLeadListInputSchema,
  GetLeadListOutputSchema,
  ImportLeadsInputSchema,
  ImportLeadsOutputSchema,
  ListActiveLeadListsInputSchema,
  ListActiveLeadListsOutputSchema,
  ListActiveLeadsInputSchema,
  ListActiveLeadsOutputSchema,
  ListLeadListsInputSchema,
  ListLeadListsOutputSchema,
  RemoveLeadInputSchema,
  RemoveLeadOutputSchema,
  UpdateLeadListInputSchema,
  UpdateLeadListOutputSchema,
} from "../lib/schemas/leads";
import { CsvParseError, type LeadCsvRow, parseLeadCsv } from "../utils/csv";
import { normalizePhone } from "../utils/phone";
import { organizationScope } from "../utils/tenant";

export type LeadListRow = z.infer<typeof ListLeadListsOutputSchema>[number];

export type LeadRow = z.infer<typeof GetLeadListOutputSchema>["leads"][number];

export type ImportLeadRow = z.infer<typeof ImportLeadsOutputSchema>[number];

export type ActiveLeadListRow = z.infer<
  typeof ListActiveLeadListsOutputSchema
>[number];

type ImportStatus = "imported" | "invalid" | "existing" | "repeated";

type ImportOutcome = {
  line: number;
  phone: string;
  name: string | null;
  status: ImportStatus;
  reason: string | null;
  canonical: string | null;
};

async function requireList(
  db: Database,
  organizationId: string,
  listId: string
) {
  const rows = await db
    .select({ id: leadList.id, archivedAt: leadList.archivedAt })
    .from(leadList)
    .where(
      and(eq(leadList.id, listId), eq(leadList.organizationId, organizationId))
    )
    .limit(1);
  const [row] = rows;
  if (!row) {
    throw new ORPCError("NOT_FOUND", { message: "Lead list not found" });
  }
  return row;
}

function requireActive(list: { archivedAt: Date | null }) {
  if (list.archivedAt) {
    throw new ORPCError("BAD_REQUEST", { message: "Lead list is archived" });
  }
}

async function activeLeadCounts(db: Database, organizationId: string) {
  const rows = await db
    .select({ listId: lead.listId, value: count() })
    .from(lead)
    .innerJoin(leadList, eq(leadList.id, lead.listId))
    .where(
      and(eq(leadList.organizationId, organizationId), isNull(lead.removedAt))
    )
    .groupBy(lead.listId);
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

function classifyImportRows(
  parsed: LeadCsvRow[],
  existing: Set<string>
): ImportOutcome[] {
  const fileSeen = new Set<string>();
  return parsed.map((row) => {
    const canonical = normalizePhone(row.phone);
    const name = row.name.trim() === "" ? null : row.name.trim();
    if (!canonical) {
      return {
        line: row.line,
        phone: row.phone.trim(),
        name,
        status: "invalid",
        reason: "Number must be explicit E.164",
        canonical: null,
      };
    }
    if (existing.has(canonical)) {
      return {
        line: row.line,
        phone: canonical,
        name,
        status: "existing",
        reason: "Number already exists in this list",
        canonical,
      };
    }
    if (fileSeen.has(canonical)) {
      return {
        line: row.line,
        phone: canonical,
        name,
        status: "repeated",
        reason: "Number repeats an earlier row in this file",
        canonical,
      };
    }
    fileSeen.add(canonical);
    return {
      line: row.line,
      phone: canonical,
      name,
      status: "imported",
      reason: null,
      canonical,
    };
  });
}

async function persistImportedRows(
  db: Database,
  listId: string,
  outcomes: ImportOutcome[]
) {
  const pending = outcomes.filter((row) => row.status === "imported");
  if (pending.length === 0) {
    return;
  }
  const created = await db
    .insert(lead)
    .values(
      pending.map((row) => ({
        id: crypto.randomUUID(),
        listId,
        phone: row.phone,
        name: row.name,
      }))
    )
    .onConflictDoNothing()
    .returning({ phone: lead.phone });
  const inserted = new Set(created.map((row) => row.phone));
  for (const row of outcomes) {
    if (row.status === "imported" && !inserted.has(row.phone)) {
      row.status = "existing";
      row.reason = "Number already exists in this list";
    }
  }
}

function countImportOutcomes(outcomes: ImportOutcome[]) {
  const counts: Record<ImportStatus, number> = {
    imported: 0,
    invalid: 0,
    existing: 0,
    repeated: 0,
  };
  for (const row of outcomes) {
    counts[row.status] += 1;
  }
  return counts;
}

export const leadsRouter = {
  /** Overview: every list in the resolved organization, active or archived. */
  listLeadLists: consoleProcedure
    .input(ListLeadListsInputSchema)
    .output(ListLeadListsOutputSchema)
    .handler(async ({ context }) => {
      const rows = await context.db
        .select({
          id: leadList.id,
          name: leadList.name,
          description: leadList.description,
          archivedAt: leadList.archivedAt,
          createdAt: leadList.createdAt,
        })
        .from(leadList)
        .where(eq(leadList.organizationId, context.organizationId))
        .orderBy(desc(leadList.createdAt));
      const counts = await activeLeadCounts(context.db, context.organizationId);
      return rows.map((row) => ({
        ...row,
        leadCount: counts.get(row.id) ?? 0,
      }));
    }),

  getLeadList: consoleProcedure
    .input(GetLeadListInputSchema)
    .output(GetLeadListOutputSchema)
    .handler(async ({ context, input }) => {
      const list = await requireList(
        context.db,
        context.organizationId,
        input.listId
      );
      const rows = await context.db
        .select({
          id: leadList.id,
          name: leadList.name,
          description: leadList.description,
          archivedAt: leadList.archivedAt,
          createdAt: leadList.createdAt,
        })
        .from(leadList)
        .where(eq(leadList.id, list.id))
        .limit(1);
      const [record] = rows;
      if (!record) {
        throw new ORPCError("NOT_FOUND", { message: "Lead list not found" });
      }
      const leads = await context.db
        .select({
          id: lead.id,
          phone: lead.phone,
          name: lead.name,
          createdAt: lead.createdAt,
        })
        .from(lead)
        .where(and(eq(lead.listId, list.id), isNull(lead.removedAt)))
        .orderBy(desc(lead.createdAt));
      return { ...record, leads };
    }),

  createLeadList: consoleProcedure
    .input(CreateLeadListInputSchema)
    .output(CreateLeadListOutputSchema)
    .handler(async ({ context, input }) => {
      const scope = organizationScope(context.organizationId);
      const id = crypto.randomUUID();
      await context.db.insert(leadList).values(
        scope.stamp({
          id,
          name: input.name,
          description: input.description ?? null,
        })
      );
      context.audit(
        createAuditEvent(context.session?.user.id ?? "", "lead_list.create", {
          type: "lead_list",
          id,
          organizationId: context.organizationId,
        })
      );
      return { id };
    }),

  updateLeadList: consoleProcedure
    .input(UpdateLeadListInputSchema)
    .output(UpdateLeadListOutputSchema)
    .handler(async ({ context, input }) => {
      await requireList(context.db, context.organizationId, input.listId);
      await context.db
        .update(leadList)
        .set({
          name: input.name,
          description: input.description,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(leadList.id, input.listId),
            eq(leadList.organizationId, context.organizationId)
          )
        );
      context.audit(
        createAuditEvent(context.session?.user.id ?? "", "lead_list.update", {
          type: "lead_list",
          id: input.listId,
          organizationId: context.organizationId,
        })
      );
      return { id: input.listId };
    }),

  archiveLeadList: consoleProcedure
    .input(ArchiveLeadListInputSchema)
    .output(ArchiveLeadListOutputSchema)
    .handler(async ({ context, input }) => {
      await requireList(context.db, context.organizationId, input.listId);
      await context.db
        .update(leadList)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(leadList.id, input.listId),
            eq(leadList.organizationId, context.organizationId)
          )
        );
      context.audit(
        createAuditEvent(context.session?.user.id ?? "", "lead_list.archive", {
          type: "lead_list",
          id: input.listId,
          organizationId: context.organizationId,
        })
      );
      return { id: input.listId };
    }),

  addLead: consoleProcedure
    .input(AddLeadInputSchema)
    .output(AddLeadOutputSchema)
    .handler(async ({ context, input }) => {
      const list = await requireList(
        context.db,
        context.organizationId,
        input.listId
      );
      requireActive(list);
      const phone = normalizePhone(input.phone);
      if (!phone) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Number must be explicit E.164, for example +14155550123",
        });
      }
      const id = crypto.randomUUID();
      const name = input.name ?? null;
      try {
        await context.db
          .insert(lead)
          .values({ id, listId: list.id, phone, name });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ORPCError("CONFLICT", {
            message: "Number already exists in this list",
            cause: error,
          });
        }
        throw error;
      }
      context.audit(
        createAuditEvent(context.session?.user.id ?? "", "lead_list.lead_add", {
          type: "lead_list",
          id: list.id,
          organizationId: context.organizationId,
        })
      );
      return { id, phone, name };
    }),

  removeLead: consoleProcedure
    .input(RemoveLeadInputSchema)
    .output(RemoveLeadOutputSchema)
    .handler(async ({ context, input }) => {
      const list = await requireList(
        context.db,
        context.organizationId,
        input.listId
      );
      const rows = await context.db
        .update(lead)
        .set({ removedAt: new Date() })
        .where(
          and(
            eq(lead.id, input.leadId),
            eq(lead.listId, list.id),
            isNull(lead.removedAt)
          )
        )
        .returning({ id: lead.id });
      if (rows.length === 0) {
        throw new ORPCError("NOT_FOUND", { message: "Lead not found" });
      }
      context.audit(
        createAuditEvent(
          context.session?.user.id ?? "",
          "lead_list.lead_remove",
          {
            type: "lead_list",
            id: list.id,
            organizationId: context.organizationId,
          }
        )
      );
      return { id: input.leadId };
    }),

  importLeads: consoleProcedure
    .input(ImportLeadsInputSchema)
    .output(ImportLeadsOutputSchema)
    .handler(async ({ context, input }) => {
      const list = await requireList(
        context.db,
        context.organizationId,
        input.listId
      );
      requireActive(list);

      let parsed: LeadCsvRow[];
      try {
        parsed = parseLeadCsv(input.csv);
      } catch (error) {
        if (error instanceof CsvParseError) {
          throw new ORPCError("BAD_REQUEST", {
            message: error.message,
            cause: error,
          });
        }
        throw error;
      }

      const existingRows = await context.db
        .select({ phone: lead.phone })
        .from(lead)
        .where(and(eq(lead.listId, list.id), isNull(lead.removedAt)));
      const existing = new Set(existingRows.map((row) => row.phone));
      const outcomes = classifyImportRows(parsed, existing);
      await persistImportedRows(context.db, list.id, outcomes);
      const counts = countImportOutcomes(outcomes);
      context.audit(
        createAuditEvent(
          context.session?.user.id ?? "",
          "lead_list.import",
          {
            type: "lead_list",
            id: list.id,
            organizationId: context.organizationId,
          },
          `imported=${counts.imported} invalid=${counts.invalid} existing=${counts.existing} repeated=${counts.repeated}`
        )
      );

      return outcomes.map(({ canonical: _canonical, ...row }) => row);
    }),

  /** Active lists only, for future campaign setup. */
  listActiveLeadLists: consoleProcedure
    .input(ListActiveLeadListsInputSchema)
    .output(ListActiveLeadListsOutputSchema)
    .handler(async ({ context }) => {
      const rows = await context.db
        .select({ id: leadList.id, name: leadList.name })
        .from(leadList)
        .where(
          and(
            eq(leadList.organizationId, context.organizationId),
            isNull(leadList.archivedAt)
          )
        )
        .orderBy(leadList.name);
      const counts = await activeLeadCounts(context.db, context.organizationId);
      return rows.map((row) => ({
        ...row,
        leadCount: counts.get(row.id) ?? 0,
      }));
    }),

  /** Non-removed leads of one active list, for future campaign setup. */
  listActiveLeads: consoleProcedure
    .input(ListActiveLeadsInputSchema)
    .output(ListActiveLeadsOutputSchema)
    .handler(async ({ context, input }) => {
      const list = await requireList(
        context.db,
        context.organizationId,
        input.listId
      );
      requireActive(list);
      return context.db
        .select({
          id: lead.id,
          phone: lead.phone,
          name: lead.name,
          createdAt: lead.createdAt,
        })
        .from(lead)
        .where(and(eq(lead.listId, list.id), isNull(lead.removedAt)))
        .orderBy(desc(lead.createdAt));
    }),
};
