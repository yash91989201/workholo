import { createHash } from "node:crypto";
import { ORPCError } from "@orpc/server";
import type { Database } from "@workholo/db";
import {
  member,
  organization,
  team,
  teamMember,
  user,
} from "@workholo/db/schema/auth";
import {
  campaign,
  campaignLeadList,
  campaignNumber,
} from "@workholo/db/schema/campaigns";
import { doNotDialEntry } from "@workholo/db/schema/do-not-dial";
import { lead, leadList } from "@workholo/db/schema/leads";
import {
  outboundNumber,
  outboundNumberAssignment,
} from "@workholo/db/schema/numbers";
import { previewDestination } from "@workholo/db/schema/preview";
import {
  and,
  eq,
  exists,
  isNull,
  lt,
  lte,
  notExists,
  or,
  sql,
} from "drizzle-orm";

import type { CampaignRow } from "./campaign";

export type PreviewDb =
  | Database
  | Parameters<Parameters<Database["transaction"]>[0]>[0];
export type PreviewAgent = {
  id: string;
  userId: string;
  organizationId: string;
};

const serviceNumberPattern = /^\+[1-9]\d{6,14}$/;
const serviceNumberSqlPattern = "^[+][1-9][0-9]{6,14}$";

export function isServiceNumber(number: string) {
  return serviceNumberPattern.test(number);
}

export function serviceAgentId(memberId: string) {
  return createHash("sha256").update(memberId).digest("hex");
}

// One transaction at a time changes reservations and call state for an org.
export async function lockPreviewOrganization(
  db: PreviewDb,
  organizationId: string
) {
  await db.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`preview:${organizationId}`}, 0))`
  );
}

export async function findPreviewAgent(
  db: PreviewDb,
  organizationId: string,
  userId: string
) {
  const [agent] = await db
    .select({
      id: member.id,
      organizationId: member.organizationId,
      userId: member.userId,
    })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .innerJoin(user, eq(user.id, member.userId))
    .where(
      and(
        eq(member.organizationId, organizationId),
        eq(member.userId, userId),
        eq(member.role, "agent"),
        isNull(organization.suspendedAt),
        or(
          isNull(user.banned),
          eq(user.banned, false),
          lte(user.banExpires, new Date())
        )
      )
    )
    .limit(1);
  return agent;
}

export function assignedPreviewCampaigns(
  db: PreviewDb,
  agent: PreviewAgent,
  campaignId?: string
) {
  const teamAssignment = db
    .select({ id: team.id })
    .from(team)
    .innerJoin(teamMember, eq(team.id, teamMember.teamId))
    .where(
      and(
        eq(team.organizationId, agent.organizationId),
        eq(team.id, campaign.assigneeId),
        eq(teamMember.userId, agent.userId)
      )
    );
  return db
    .select()
    .from(campaign)
    .where(
      and(
        eq(campaign.organizationId, agent.organizationId),
        eq(campaign.method, "preview"),
        eq(campaign.status, "active"),
        campaignId ? eq(campaign.id, campaignId) : undefined,
        or(
          and(
            eq(campaign.assigneeType, "agent"),
            eq(campaign.assigneeId, agent.userId)
          ),
          and(eq(campaign.assigneeType, "team"), exists(teamAssignment))
        )
      )
    );
}

export async function requirePreviewCampaign(
  db: PreviewDb,
  agent: PreviewAgent,
  campaignId: string
) {
  const [row] = await assignedPreviewCampaigns(db, agent, campaignId).limit(1);
  if (!row) {
    throw new ORPCError("NOT_FOUND", {
      message: "Active assigned campaign unavailable",
    });
  }
  return row;
}

export function eligiblePreviewLeads(
  db: PreviewDb,
  row: CampaignRow,
  now: Date
) {
  const suppression = db
    .select({ id: doNotDialEntry.id })
    .from(doNotDialEntry)
    .where(
      and(
        eq(doNotDialEntry.organizationId, row.organizationId),
        eq(doNotDialEntry.e164Number, lead.phone)
      )
    );
  return {
    query: db
      .select({
        id: lead.id,
        phone: lead.phone,
        name: lead.name,
        status: previewDestination.status,
      })
      .from(lead)
      .innerJoin(leadList, eq(lead.listId, leadList.id))
      .innerJoin(
        campaignLeadList,
        and(
          eq(campaignLeadList.listId, leadList.id),
          eq(campaignLeadList.campaignId, row.id)
        )
      )
      .leftJoin(
        previewDestination,
        and(
          eq(previewDestination.campaignId, row.id),
          eq(previewDestination.phone, lead.phone)
        )
      ),
    eligibility: and(
      eq(leadList.organizationId, row.organizationId),
      isNull(leadList.archivedAt),
      isNull(lead.removedAt),
      sql`${lead.phone} ~ ${serviceNumberSqlPattern}`,
      notExists(suppression),
      or(
        row.dialStatuses.includes("new")
          ? isNull(previewDestination.status)
          : undefined,
        row.dialStatuses.includes("not_answered")
          ? and(
              eq(previewDestination.status, "not_answered"),
              lte(previewDestination.retryAt, now),
              lt(previewDestination.retriesUsed, row.retryCount ?? 0)
            )
          : undefined,
        sql`false`
      )
    ),
  };
}

export function eligiblePreviewNumbers(
  db: PreviewDb,
  row: CampaignRow,
  numberId?: string
) {
  return db
    .select({ id: outboundNumber.id, number: outboundNumber.number })
    .from(campaignNumber)
    .innerJoin(outboundNumber, eq(campaignNumber.numberId, outboundNumber.id))
    .innerJoin(
      outboundNumberAssignment,
      eq(outboundNumberAssignment.numberId, outboundNumber.id)
    )
    .where(
      and(
        eq(campaignNumber.campaignId, row.id),
        eq(outboundNumberAssignment.organizationId, row.organizationId),
        eq(outboundNumber.enabled, true),
        sql`${outboundNumber.number} ~ ${serviceNumberSqlPattern}`,
        numberId ? eq(outboundNumber.id, numberId) : undefined
      )
    );
}

export async function findEligiblePreviewLead(
  db: PreviewDb,
  row: CampaignRow,
  claim: { leadId: string; phone: string; name: string | null },
  now: Date
) {
  const { query, eligibility } = eligiblePreviewLeads(db, row, now);
  const [target] = await query
    .where(
      and(eligibility, eq(lead.id, claim.leadId), eq(lead.phone, claim.phone))
    )
    .limit(1);
  return target?.name === claim.name ? target : undefined;
}
