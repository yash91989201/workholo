import type { Database } from "@workholo/db";
import { member, team, teamMember } from "@workholo/db/schema/auth";
import type { campaign } from "@workholo/db/schema/campaigns";
import {
  campaignLeadList,
  campaignNumber,
} from "@workholo/db/schema/campaigns";
import {
  dispositionEntry,
  dispositionList,
} from "@workholo/db/schema/dispositions";
import { lead, leadList } from "@workholo/db/schema/leads";
import {
  outboundNumber,
  outboundNumberAssignment,
} from "@workholo/db/schema/numbers";
import { and, count, eq, inArray, isNull } from "drizzle-orm";
import type { z } from "zod";
import {
  CAMPAIGN_DIAL_STATUSES,
  type CampaignFieldErrors,
  RING_TIMEOUT_MAX_SECONDS,
  type UpdateCampaignInputSchema,
} from "../lib/schemas/campaigns";

export type CampaignRow = typeof campaign.$inferSelect;

async function leadListReferenceError(
  db: Database,
  organizationId: string,
  ids: string[]
): Promise<string | undefined> {
  if (new Set(ids).size !== ids.length) {
    return "Each lead list can be selected once";
  }
  if (ids.length === 0) {
    return;
  }
  const rows = await db
    .select({ id: leadList.id })
    .from(leadList)
    .where(
      and(
        eq(leadList.organizationId, organizationId),
        inArray(leadList.id, ids)
      )
    );
  if (rows.length !== ids.length) {
    return "A selected lead list is not in this organization";
  }
}

async function dispositionReferenceError(
  db: Database,
  organizationId: string,
  dispositionListId: string | null
): Promise<string | undefined> {
  if (!dispositionListId) {
    return;
  }
  const rows = await db
    .select({ id: dispositionList.id })
    .from(dispositionList)
    .where(
      and(
        eq(dispositionList.id, dispositionListId),
        eq(dispositionList.organizationId, organizationId)
      )
    )
    .limit(1);
  if (rows.length === 0) {
    return "A selected disposition list is not in this organization";
  }
}

async function numberReferenceError(
  db: Database,
  organizationId: string,
  ids: string[],
  callerIdMode: string | null
): Promise<string | undefined> {
  if (new Set(ids).size !== ids.length) {
    return "Each caller ID can be selected once";
  }
  if (callerIdMode === "fixed" && ids.length > 1) {
    return "Fixed caller ID accepts exactly one number";
  }
  if (ids.length === 0) {
    return;
  }
  const rows = await db
    .select({ id: outboundNumber.id, enabled: outboundNumber.enabled })
    .from(outboundNumberAssignment)
    .innerJoin(
      outboundNumber,
      eq(outboundNumber.id, outboundNumberAssignment.numberId)
    )
    .where(
      and(
        eq(outboundNumberAssignment.organizationId, organizationId),
        inArray(outboundNumber.id, ids)
      )
    );
  if (rows.length !== ids.length) {
    return "A selected caller ID is not assigned to this organization";
  }
  if (rows.some((row) => !row.enabled)) {
    return "A selected caller ID is disabled for this organization";
  }
}

async function assigneeReferenceError(
  db: Database,
  organizationId: string,
  assigneeType: string | null,
  assigneeId: string | null
): Promise<string | undefined> {
  if ((assigneeType === null) !== (assigneeId === null)) {
    return "Choose both an assignee type and an assignee";
  }
  if (!(assigneeType && assigneeId)) {
    return;
  }
  if (assigneeType === "team") {
    const rows = await db
      .select({ id: team.id })
      .from(team)
      .where(
        and(eq(team.id, assigneeId), eq(team.organizationId, organizationId))
      )
      .limit(1);
    if (rows.length === 0) {
      return "The selected team is not in this organization";
    }
    return;
  }
  const rows = await db
    .select({ userId: member.userId })
    .from(member)
    .where(
      and(
        eq(member.userId, assigneeId),
        eq(member.organizationId, organizationId)
      )
    )
    .limit(1);
  if (rows.length === 0) {
    return "The selected agent is not in this organization";
  }
}

/**
 * Draft writes accept omissions but every supplied reference must belong to
 * the resolved organization and be usable today.
 */
export async function campaignReferenceErrors(
  db: Database,
  organizationId: string,
  input: z.infer<typeof UpdateCampaignInputSchema>
): Promise<CampaignFieldErrors> {
  const [leadListError, dispositionError, numberError, assigneeError] =
    await Promise.all([
      leadListReferenceError(db, organizationId, input.leadListIds),
      dispositionReferenceError(db, organizationId, input.dispositionListId),
      numberReferenceError(
        db,
        organizationId,
        input.numberIds,
        input.callerIdMode
      ),
      assigneeReferenceError(
        db,
        organizationId,
        input.assigneeType,
        input.assigneeId
      ),
    ]);
  const errors: CampaignFieldErrors = {};
  if (leadListError) {
    errors.leadListIds = leadListError;
  }
  if (dispositionError) {
    errors.dispositionListId = dispositionError;
  }
  if (numberError) {
    errors.numberIds = numberError;
  }
  if (assigneeError) {
    errors.assignee = assigneeError;
  }
  return errors;
}

async function selectedLeadListIds(
  db: Database,
  campaignId: string
): Promise<string[]> {
  const rows = await db
    .select({ id: campaignLeadList.listId })
    .from(campaignLeadList)
    .where(eq(campaignLeadList.campaignId, campaignId));
  return rows.map((row) => row.id);
}

async function leadListActivationError(
  db: Database,
  organizationId: string,
  campaignId: string
): Promise<string | undefined> {
  const ids = await selectedLeadListIds(db, campaignId);
  if (ids.length === 0) {
    return "Select at least one lead list";
  }
  const usable = await db
    .select({ id: leadList.id })
    .from(leadList)
    .where(
      and(
        eq(leadList.organizationId, organizationId),
        isNull(leadList.archivedAt),
        inArray(leadList.id, ids)
      )
    );
  if (usable.length !== ids.length) {
    return "A selected lead list was archived or removed; choose a live list";
  }
  const liveLead = await db
    .select({ id: lead.id })
    .from(lead)
    .where(and(inArray(lead.listId, ids), isNull(lead.removedAt)))
    .limit(1);
  if (liveLead.length === 0) {
    return "The selected lead lists have no live leads";
  }
}

async function dispositionActivationError(
  db: Database,
  organizationId: string,
  dispositionListId: string | null
): Promise<string | undefined> {
  if (!dispositionListId) {
    return "Select a disposition list";
  }
  const lists = await db
    .select({ id: dispositionList.id, archivedAt: dispositionList.archivedAt })
    .from(dispositionList)
    .where(
      and(
        eq(dispositionList.id, dispositionListId),
        eq(dispositionList.organizationId, organizationId)
      )
    )
    .limit(1);
  const [list] = lists;
  if (!list) {
    return "The selected disposition list was removed";
  }
  if (list.archivedAt) {
    return "The selected disposition list is archived";
  }
  const options = await db
    .select({ id: dispositionEntry.id })
    .from(dispositionEntry)
    .where(
      and(
        eq(dispositionEntry.listId, list.id),
        isNull(dispositionEntry.retiredAt)
      )
    )
    .limit(1);
  if (options.length === 0) {
    return "The selected disposition list has no live options";
  }
}

async function numberActivationError(
  db: Database,
  organizationId: string,
  campaignId: string,
  callerIdMode: string | null
): Promise<string | undefined> {
  const rows = await db
    .select({ id: campaignNumber.numberId })
    .from(campaignNumber)
    .where(eq(campaignNumber.campaignId, campaignId));
  const ids = rows.map((row) => row.id);
  if (ids.length === 0) {
    return "Select at least one caller ID";
  }
  if (callerIdMode === "fixed" && ids.length !== 1) {
    return "Fixed caller ID requires exactly one number";
  }
  const live = await db
    .select({ id: outboundNumber.id, enabled: outboundNumber.enabled })
    .from(outboundNumberAssignment)
    .innerJoin(
      outboundNumber,
      eq(outboundNumber.id, outboundNumberAssignment.numberId)
    )
    .where(
      and(
        eq(outboundNumberAssignment.organizationId, organizationId),
        inArray(outboundNumber.id, ids)
      )
    );
  if (live.length !== ids.length) {
    return "A selected caller ID is no longer assigned to this organization";
  }
  if (live.some((entry) => !entry.enabled)) {
    return "A selected caller ID is disabled; enable it or pick another";
  }
}

async function teamActivationError(
  db: Database,
  organizationId: string,
  teamId: string
): Promise<string | undefined> {
  const teams = await db
    .select({ id: team.id })
    .from(team)
    .where(and(eq(team.id, teamId), eq(team.organizationId, organizationId)))
    .limit(1);
  if (teams.length === 0) {
    return "The assigned team was removed";
  }
  const agents = await db
    .select({ value: count() })
    .from(teamMember)
    .innerJoin(member, eq(member.userId, teamMember.userId))
    .where(
      and(
        eq(teamMember.teamId, teamId),
        eq(member.organizationId, organizationId),
        eq(member.role, "agent")
      )
    );
  if ((agents[0]?.value ?? 0) === 0) {
    return "The assigned team has no agents";
  }
}

async function agentActivationError(
  db: Database,
  organizationId: string,
  userId: string
): Promise<string | undefined> {
  const agent = await db
    .select({ role: member.role })
    .from(member)
    .where(
      and(eq(member.userId, userId), eq(member.organizationId, organizationId))
    )
    .limit(1);
  if (!agent[0]) {
    return "The assigned agent was removed from this organization";
  }
  if (agent[0].role !== "agent") {
    return "The assigned member no longer holds the agent role";
  }
}

async function assigneeActivationError(
  db: Database,
  organizationId: string,
  row: CampaignRow
): Promise<string | undefined> {
  if (!(row.assigneeType && row.assigneeId)) {
    return "Assign one agent or one team";
  }
  if (row.assigneeType === "team") {
    return teamActivationError(db, organizationId, row.assigneeId);
  }
  return agentActivationError(db, organizationId, row.assigneeId);
}

function timerActivationErrors(row: CampaignRow): CampaignFieldErrors {
  const errors: CampaignFieldErrors = {};
  if (row.previewSeconds === null || row.previewSeconds < 1) {
    errors.previewSeconds = "Preview duration must be at least one second";
  }
  if (
    row.ringTimeoutSeconds === null ||
    row.ringTimeoutSeconds < 1 ||
    row.ringTimeoutSeconds > RING_TIMEOUT_MAX_SECONDS
  ) {
    errors.ringTimeoutSeconds = `Customer ring timeout must be between 1 and ${RING_TIMEOUT_MAX_SECONDS} seconds`;
  }
  if (row.wrapUpSeconds === null || row.wrapUpSeconds < 0) {
    errors.wrapUpSeconds = "Wrap-up time must be zero or more seconds";
  }
  if (row.afterCallWorkSeconds === null || row.afterCallWorkSeconds < 0) {
    errors.afterCallWorkSeconds =
      "After-call work must be zero or more seconds";
  }
  if (row.retryCount === null || row.retryCount < 0) {
    errors.retryCount = "Retry count must be zero or more";
  }
  if (
    row.retryCount !== null &&
    row.retryCount > 0 &&
    (row.retryIntervalMinutes === null || row.retryIntervalMinutes < 1)
  ) {
    errors.retryIntervalMinutes =
      "A positive retry interval is required when retries are enabled";
  }
  return errors;
}

function dialStatusActivationError(row: CampaignRow): string | undefined {
  const allowed: readonly string[] = CAMPAIGN_DIAL_STATUSES;
  if (row.dialStatuses.length === 0) {
    return "Select at least one dial status";
  }
  if (row.dialStatuses.some((status) => !allowed.includes(status))) {
    return "A selected dial status is no longer supported";
  }
}

/**
 * Activation is atomic: every live requirement is checked before the status
 * update, and all failures return together as field errors.
 */
export async function campaignActivationErrors(
  db: Database,
  organizationId: string,
  row: CampaignRow
): Promise<CampaignFieldErrors> {
  const [leadListError, dispositionError, numberError, assigneeError] =
    await Promise.all([
      leadListActivationError(db, organizationId, row.id),
      dispositionActivationError(db, organizationId, row.dispositionListId),
      numberActivationError(db, organizationId, row.id, row.callerIdMode),
      assigneeActivationError(db, organizationId, row),
    ]);

  const errors = timerActivationErrors(row);
  if (row.method !== "preview") {
    errors.method = "Only Preview campaigns can be activated";
  }
  if (leadListError) {
    errors.leadListIds = leadListError;
  }
  if (dispositionError) {
    errors.dispositionListId = dispositionError;
  }
  if (numberError) {
    errors.numberIds = numberError;
  }
  if (assigneeError) {
    errors.assignee = assigneeError;
  }
  const dialStatusError = dialStatusActivationError(row);
  if (dialStatusError) {
    errors.dialStatuses = dialStatusError;
  }
  return errors;
}
