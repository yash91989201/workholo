import { ORPCError } from "@orpc/server";
import { createAuditEvent } from "@workholo/auth/audit";
import type { Database } from "@workholo/db";
import {
  campaign,
  campaignLeadList,
  campaignNumber,
} from "@workholo/db/schema/campaigns";
import { dispositionList } from "@workholo/db/schema/dispositions";
import { leadList } from "@workholo/db/schema/leads";
import { outboundNumber } from "@workholo/db/schema/numbers";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import type { z } from "zod";
import { consoleProcedure } from "../index";
import {
  ActivateCampaignInputSchema,
  ActivateCampaignOutputSchema,
  ArchiveCampaignInputSchema,
  ArchiveCampaignOutputSchema,
  CAMPAIGN_STATUSES,
  type CampaignFieldErrors,
  CreateCampaignInputSchema,
  CreateCampaignOutputSchema,
  GetCampaignInputSchema,
  GetCampaignOutputSchema,
  ListCampaignsInputSchema,
  ListCampaignsOutputSchema,
  PauseCampaignInputSchema,
  PauseCampaignOutputSchema,
  UpdateCampaignInputSchema,
  UpdateCampaignOutputSchema,
} from "../lib/schemas/campaigns";
import {
  type CampaignRow,
  campaignActivationErrors,
  campaignReferenceErrors,
} from "../utils/campaign";

export type CampaignRowSummary = z.infer<
  typeof ListCampaignsOutputSchema
>[number];

async function requireCampaign(
  db: Database,
  organizationId: string,
  campaignId: string
): Promise<CampaignRow> {
  const rows = await db
    .select()
    .from(campaign)
    .where(
      and(
        eq(campaign.id, campaignId),
        eq(campaign.organizationId, organizationId)
      )
    )
    .limit(1);
  const [row] = rows;
  if (!row) {
    throw new ORPCError("NOT_FOUND", { message: "Campaign not found" });
  }
  return row;
}

function rejected(errors: CampaignFieldErrors, message: string) {
  return new ORPCError("BAD_REQUEST", {
    message,
    data: { fieldErrors: errors },
  });
}

export const campaignsRouter = {
  /** Overview: every campaign, archived included. */
  listCampaigns: consoleProcedure
    .input(ListCampaignsInputSchema)
    .output(ListCampaignsOutputSchema)
    .handler(async ({ context }) => {
      const rows = await context.db
        .select({
          id: campaign.id,
          name: campaign.name,
          description: campaign.description,
          method: campaign.method,
          status: campaign.status,
          revision: campaign.revision,
          createdAt: campaign.createdAt,
          updatedAt: campaign.updatedAt,
        })
        .from(campaign)
        .where(eq(campaign.organizationId, context.organizationId))
        .orderBy(desc(campaign.createdAt));
      if (rows.length === 0) {
        return [];
      }
      const ids = rows.map((row) => row.id);
      const [leadCounts, numberCounts] = await Promise.all([
        context.db
          .select({
            campaignId: campaignLeadList.campaignId,
            value: count(),
          })
          .from(campaignLeadList)
          .where(inArray(campaignLeadList.campaignId, ids))
          .groupBy(campaignLeadList.campaignId),
        context.db
          .select({
            campaignId: campaignNumber.campaignId,
            value: count(),
          })
          .from(campaignNumber)
          .where(inArray(campaignNumber.campaignId, ids))
          .groupBy(campaignNumber.campaignId),
      ]);
      const leadMap = new Map(
        leadCounts.map((row) => [row.campaignId, row.value])
      );
      const numberMap = new Map(
        numberCounts.map((row) => [row.campaignId, row.value])
      );
      return rows.map((row) => ({
        ...row,
        method: "preview" as const,
        status:
          CAMPAIGN_STATUSES.find((value) => value === row.status) ?? "draft",
        leadListCount: leadMap.get(row.id) ?? 0,
        numberCount: numberMap.get(row.id) ?? 0,
      }));
    }),

  /** Full settings plus the current names of every referenced resource. */
  getCampaign: consoleProcedure
    .input(GetCampaignInputSchema)
    .output(GetCampaignOutputSchema)
    .handler(async ({ context, input }) => {
      const row = await requireCampaign(
        context.db,
        context.organizationId,
        input.campaignId
      );
      const [leadLists, numbers, dispositionLists] = await Promise.all([
        context.db
          .select({
            id: leadList.id,
            name: leadList.name,
            archivedAt: leadList.archivedAt,
          })
          .from(campaignLeadList)
          .innerJoin(leadList, eq(leadList.id, campaignLeadList.listId))
          .where(eq(campaignLeadList.campaignId, row.id))
          .orderBy(campaignLeadList.position),
        context.db
          .select({
            id: outboundNumber.id,
            number: outboundNumber.number,
            enabled: outboundNumber.enabled,
          })
          .from(campaignNumber)
          .innerJoin(
            outboundNumber,
            eq(outboundNumber.id, campaignNumber.numberId)
          )
          .where(eq(campaignNumber.campaignId, row.id))
          .orderBy(campaignNumber.position),
        row.dispositionListId
          ? context.db
              .select({
                id: dispositionList.id,
                name: dispositionList.name,
                archivedAt: dispositionList.archivedAt,
              })
              .from(dispositionList)
              .where(eq(dispositionList.id, row.dispositionListId))
              .limit(1)
          : Promise.resolve([]),
      ]);
      const status =
        CAMPAIGN_STATUSES.find((value) => value === row.status) ?? "draft";
      const method = "preview" as const;
      const dialStatuses = row.dialStatuses.filter(
        (value): value is "new" | "not_answered" =>
          value === "new" || value === "not_answered"
      );
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        method,
        status,
        revision: row.revision,
        leadLists,
        dispositionList: dispositionLists[0] ?? null,
        numbers,
        callerIdMode:
          row.callerIdMode === "fixed" || row.callerIdMode === "random"
            ? row.callerIdMode
            : null,
        assigneeType:
          row.assigneeType === "agent" || row.assigneeType === "team"
            ? row.assigneeType
            : null,
        assigneeId: row.assigneeId,
        previewSeconds: row.previewSeconds,
        ringTimeoutSeconds: row.ringTimeoutSeconds,
        wrapUpSeconds: row.wrapUpSeconds,
        afterCallWorkSeconds: row.afterCallWorkSeconds,
        retryCount: row.retryCount,
        retryIntervalMinutes: row.retryIntervalMinutes,
        dialStatuses,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    }),

  createCampaign: consoleProcedure
    .input(CreateCampaignInputSchema)
    .output(CreateCampaignOutputSchema)
    .handler(async ({ context, input }) => {
      const id = crypto.randomUUID();
      await context.db.insert(campaign).values({
        id,
        organizationId: context.organizationId,
        name: input.name,
        description: input.description ?? null,
        method: input.method,
        dialStatuses: [],
      });
      context.audit(
        createAuditEvent(context.session?.user.id ?? "", "campaign.create", {
          type: "campaign",
          id,
          organizationId: context.organizationId,
        })
      );
      return { id };
    }),

  /** Full replacement of draft or paused settings; resources are re-stamped. */
  updateCampaign: consoleProcedure
    .input(UpdateCampaignInputSchema)
    .output(UpdateCampaignOutputSchema)
    .handler(async ({ context, input }) => {
      const row = await requireCampaign(
        context.db,
        context.organizationId,
        input.campaignId
      );
      if (row.status === "active") {
        throw new ORPCError("BAD_REQUEST", {
          message: "Pause the campaign before editing",
        });
      }
      if (row.status === "archived") {
        throw new ORPCError("BAD_REQUEST", {
          message: "Archived campaigns cannot be edited",
        });
      }
      const errors = await campaignReferenceErrors(
        context.db,
        context.organizationId,
        input
      );
      if (Object.keys(errors).length > 0) {
        throw rejected(errors, "Campaign settings are invalid");
      }

      await context.db.transaction(async (tx) => {
        await tx
          .update(campaign)
          .set({
            name: input.name,
            description: input.description,
            dispositionListId: input.dispositionListId,
            callerIdMode: input.callerIdMode,
            assigneeType: input.assigneeType,
            assigneeId: input.assigneeId,
            previewSeconds: input.previewSeconds,
            ringTimeoutSeconds: input.ringTimeoutSeconds,
            wrapUpSeconds: input.wrapUpSeconds,
            afterCallWorkSeconds: input.afterCallWorkSeconds,
            retryCount: input.retryCount,
            retryIntervalMinutes: input.retryIntervalMinutes,
            dialStatuses: input.dialStatuses,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(campaign.id, row.id),
              eq(campaign.organizationId, context.organizationId)
            )
          );
        await tx
          .delete(campaignLeadList)
          .where(eq(campaignLeadList.campaignId, row.id));
        await tx
          .delete(campaignNumber)
          .where(eq(campaignNumber.campaignId, row.id));
        if (input.leadListIds.length > 0) {
          await tx.insert(campaignLeadList).values(
            input.leadListIds.map((listId, position) => ({
              id: crypto.randomUUID(),
              campaignId: row.id,
              listId,
              position,
            }))
          );
        }
        if (input.numberIds.length > 0) {
          await tx.insert(campaignNumber).values(
            input.numberIds.map((numberId, position) => ({
              id: crypto.randomUUID(),
              campaignId: row.id,
              numberId,
              position,
            }))
          );
        }
      });

      context.audit(
        createAuditEvent(context.session?.user.id ?? "", "campaign.update", {
          type: "campaign",
          id: row.id,
          organizationId: context.organizationId,
        })
      );
      return { id: row.id };
    }),

  activateCampaign: consoleProcedure
    .input(ActivateCampaignInputSchema)
    .output(ActivateCampaignOutputSchema)
    .handler(async ({ context, input }) => {
      const row = await requireCampaign(
        context.db,
        context.organizationId,
        input.campaignId
      );
      if (row.status !== "draft" && row.status !== "paused") {
        throw new ORPCError("BAD_REQUEST", {
          message:
            row.status === "archived"
              ? "Archived campaigns cannot be activated"
              : "Campaign is already active",
        });
      }
      if (row.revision !== input.expectedRevision) {
        throw new ORPCError("CONFLICT", {
          message: "Campaign changed; reload before activating",
        });
      }
      const errors = await campaignActivationErrors(
        context.db,
        context.organizationId,
        row
      );
      if (Object.keys(errors).length > 0) {
        throw rejected(errors, "Campaign is not ready to activate");
      }
      const updated = await context.db
        .update(campaign)
        .set({
          status: "active",
          revision: row.revision + 1,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(campaign.id, row.id),
            eq(campaign.organizationId, context.organizationId),
            eq(campaign.revision, input.expectedRevision),
            eq(campaign.status, row.status)
          )
        )
        .returning({ id: campaign.id, revision: campaign.revision });
      const [transitioned] = updated;
      if (!transitioned) {
        throw new ORPCError("CONFLICT", {
          message: "Campaign changed; reload before activating",
        });
      }
      context.audit(
        createAuditEvent(context.session?.user.id ?? "", "campaign.activate", {
          type: "campaign",
          id: row.id,
          organizationId: context.organizationId,
        })
      );
      return {
        id: transitioned.id,
        status: "active" as const,
        revision: transitioned.revision,
      };
    }),

  pauseCampaign: consoleProcedure
    .input(PauseCampaignInputSchema)
    .output(PauseCampaignOutputSchema)
    .handler(async ({ context, input }) => {
      const row = await requireCampaign(
        context.db,
        context.organizationId,
        input.campaignId
      );
      if (row.status !== "active") {
        throw new ORPCError("BAD_REQUEST", {
          message: "Only active campaigns can be paused",
        });
      }
      const updated = await context.db
        .update(campaign)
        .set({
          status: "paused",
          revision: row.revision + 1,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(campaign.id, row.id),
            eq(campaign.organizationId, context.organizationId),
            eq(campaign.revision, input.expectedRevision),
            eq(campaign.status, "active")
          )
        )
        .returning({ id: campaign.id, revision: campaign.revision });
      const [transitioned] = updated;
      if (!transitioned) {
        throw new ORPCError("CONFLICT", {
          message: "Campaign changed; reload before pausing",
        });
      }
      context.audit(
        createAuditEvent(context.session?.user.id ?? "", "campaign.pause", {
          type: "campaign",
          id: row.id,
          organizationId: context.organizationId,
        })
      );
      return {
        id: transitioned.id,
        status: "paused" as const,
        revision: transitioned.revision,
      };
    }),

  archiveCampaign: consoleProcedure
    .input(ArchiveCampaignInputSchema)
    .output(ArchiveCampaignOutputSchema)
    .handler(async ({ context, input }) => {
      const row = await requireCampaign(
        context.db,
        context.organizationId,
        input.campaignId
      );
      if (row.status !== "draft" && row.status !== "paused") {
        throw new ORPCError("BAD_REQUEST", {
          message: "Pause the campaign before archiving",
        });
      }
      const updated = await context.db
        .update(campaign)
        .set({ status: "archived", updatedAt: new Date() })
        .where(
          and(
            eq(campaign.id, row.id),
            eq(campaign.organizationId, context.organizationId),
            eq(campaign.revision, input.expectedRevision),
            eq(campaign.status, row.status)
          )
        )
        .returning({ id: campaign.id, revision: campaign.revision });
      const [transitioned] = updated;
      if (!transitioned) {
        throw new ORPCError("CONFLICT", {
          message: "Campaign changed; reload before archiving",
        });
      }
      context.audit(
        createAuditEvent(context.session?.user.id ?? "", "campaign.archive", {
          type: "campaign",
          id: row.id,
          organizationId: context.organizationId,
        })
      );
      return {
        id: transitioned.id,
        status: "archived" as const,
        revision: transitioned.revision,
      };
    }),
};
