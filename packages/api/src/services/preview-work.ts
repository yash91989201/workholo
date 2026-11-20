import { randomInt, randomUUID } from "node:crypto";
import { ORPCError } from "@orpc/server";
import type { Database } from "@workholo/db";
import { call } from "@workholo/db/schema/calls";
import {
  dispositionEntry,
  dispositionList,
} from "@workholo/db/schema/dispositions";
import { lead } from "@workholo/db/schema/leads";
import {
  previewAttempt,
  previewClaim,
  previewPhone,
} from "@workholo/db/schema/preview";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  isNull,
  lte,
  notExists,
  or,
} from "drizzle-orm";

import type { Context } from "../context";
import { RING_TIMEOUT_MAX_SECONDS } from "../lib/schemas/campaigns";
import type { CampaignRow } from "../utils/campaign";
import {
  eligiblePreviewLeads,
  eligiblePreviewNumbers,
  findEligiblePreviewLead,
  findPreviewAgent,
  lockPreviewOrganization,
  type PreviewAgent,
  type PreviewDb,
  requirePreviewCampaign,
  serviceAgentId,
} from "../utils/preview";

export const dispatchLifetimeMs = 30_000;

function conflict(message: string) {
  return new ORPCError("CONFLICT", { message });
}

export function requireTelephony(context: Context) {
  if (!context.previewTelephony) {
    throw new ORPCError("SERVICE_UNAVAILABLE", {
      message: "Campaign phone unavailable",
    });
  }
  return context.previewTelephony;
}

export async function requirePreviewAgent(
  db: PreviewDb,
  organizationId: string,
  userId: string
) {
  const agent = await findPreviewAgent(db, organizationId, userId);
  if (!agent) {
    throw new ORPCError("FORBIDDEN", { message: "Active agents only" });
  }
  return agent;
}

export async function mappedPhone(db: PreviewDb, agent: PreviewAgent) {
  const [phone] = await db
    .select()
    .from(previewPhone)
    .where(eq(previewPhone.memberId, agent.id));
  return phone && !phone.revoked ? serviceAgentId(agent.id) : null;
}

export async function preparePreviewPhone(
  context: Context,
  agent: PreviewAgent,
  campaignId: string
) {
  const telephony = requireTelephony(context);
  await requirePreviewCampaign(context.db, agent, campaignId);
  // Save the mapping first so an ambiguous provision can still be revoked.
  await context.db
    .insert(previewPhone)
    .values({
      memberId: agent.id,
      organizationId: agent.organizationId,
    })
    .onConflictDoNothing();
  return await context.db.transaction(async (tx) => {
    await lockPreviewOrganization(tx, agent.organizationId);
    const current = await requirePreviewAgent(
      tx,
      agent.organizationId,
      agent.userId
    );
    if (current.id !== agent.id) {
      throw new ORPCError("FORBIDDEN");
    }
    await requirePreviewCampaign(tx, current, campaignId);
    const agentId = serviceAgentId(current.id);
    const [mapping] = await tx
      .select()
      .from(previewPhone)
      .where(eq(previewPhone.memberId, current.id));
    if (!mapping || mapping.revoked) {
      throw conflict("Phone revocation is pending. Try again shortly.");
    }
    const credentials = await telephony.provisionAgent(agentId);
    const authorized = await requirePreviewAgent(
      tx,
      current.organizationId,
      current.userId
    );
    if (authorized.id !== current.id || credentials.agent_id !== agentId) {
      throw new ORPCError("FORBIDDEN");
    }
    await requirePreviewCampaign(tx, authorized, campaignId);
    return {
      sipUsername: credentials.sip_username,
      sipPassword: credentials.sip_password,
      sipDomain: credentials.sip_domain,
      wssUrl: credentials.wss_url,
    };
  });
}

function ownPreview(agent: PreviewAgent) {
  return and(
    eq(previewClaim.organizationId, agent.organizationId),
    eq(previewClaim.memberId, agent.id)
  );
}

function linkedAttempt(db: PreviewDb) {
  return db
    .select({ id: previewAttempt.id })
    .from(previewAttempt)
    .where(eq(previewAttempt.claimId, previewClaim.id));
}

function previewView(row: typeof previewClaim.$inferSelect) {
  return {
    id: row.id,
    campaignId: row.campaignId,
    phone: row.phone,
    name: row.name,
    expiresAt: row.expiresAt.toISOString(),
  };
}

export async function getPreviewState(db: Database, agent: PreviewAgent) {
  const [claim] = await db
    .select()
    .from(previewClaim)
    .where(
      and(
        ownPreview(agent),
        isNull(previewClaim.releasedAt),
        gt(previewClaim.expiresAt, new Date()),
        notExists(linkedAttempt(db))
      )
    )
    .limit(1);
  const [last] = await db
    .select({
      attempt: previewAttempt,
      status: call.status,
      campaignId: previewClaim.campaignId,
    })
    .from(previewAttempt)
    .innerJoin(previewClaim, eq(previewClaim.id, previewAttempt.claimId))
    .innerJoin(call, eq(call.id, previewAttempt.id))
    .where(ownPreview(agent))
    .orderBy(desc(previewAttempt.issuedAt), desc(previewAttempt.id))
    .limit(1);
  return {
    preview: claim ? previewView(claim) : null,
    attempt: last
      ? {
          id: last.attempt.id,
          campaignId: last.campaignId,
          status: last.status,
          dispatchExpiresAt: last.attempt.expiresAt.toISOString(),
          outcome: last.attempt.outcome,
          hangupCause: last.attempt.hangupCause,
          rejectReason: last.attempt.rejectReason,
          dispositionOptions: last.attempt.dispositionOptions,
          disposition: last.attempt.disposition,
          wrapupUntil: last.attempt.wrapupUntil?.toISOString() ?? null,
          holdUntil: last.attempt.holdUntil?.toISOString() ?? null,
        }
      : null,
  };
}

export async function claimPreview(
  context: Context,
  agent: PreviewAgent,
  campaignId: string,
  sessionId: string
) {
  const telephony = requireTelephony(context);
  await requirePreviewCampaign(context.db, agent, campaignId);
  const agentId = await mappedPhone(context.db, agent);
  const presence = agentId ? await telephony.getPresence(agentId) : null;
  if (
    presence?.agent_id !== agentId ||
    presence?.presence !== "available" ||
    presence.work_status !== "ready" ||
    !presence.sip_registered
  ) {
    throw conflict(
      "Register the phone and set it to Ready before requesting a preview"
    );
  }
  return await context.db.transaction(async (tx) => {
    await lockPreviewOrganization(tx, agent.organizationId);
    const now = new Date();
    const current = await requirePreviewAgent(
      tx,
      agent.organizationId,
      agent.userId
    );
    if (current.id !== agent.id) {
      throw new ORPCError("FORBIDDEN");
    }
    const row = await requirePreviewCampaign(tx, current, campaignId);
    await tx
      .update(previewClaim)
      .set({ releasedAt: now })
      .where(
        and(
          eq(previewClaim.organizationId, agent.organizationId),
          isNull(previewClaim.releasedAt),
          lte(previewClaim.expiresAt, now),
          notExists(linkedAttempt(tx))
        )
      );
    const [live] = await tx
      .select()
      .from(previewClaim)
      .where(and(ownPreview(agent), isNull(previewClaim.releasedAt)));
    if (live) {
      const [attempt] = await tx
        .select({ id: previewAttempt.id })
        .from(previewAttempt)
        .where(eq(previewAttempt.claimId, live.id));
      if (attempt || live.campaignId !== campaignId) {
        throw conflict("Finish the current preview or call first");
      }
      if (live.revision === row.revision) {
        return previewView(live);
      }
      await tx
        .update(previewClaim)
        .set({ releasedAt: now })
        .where(eq(previewClaim.id, live.id));
    }
    const [hold] = await tx
      .select({ id: previewAttempt.id })
      .from(previewAttempt)
      .innerJoin(previewClaim, eq(previewClaim.id, previewAttempt.claimId))
      .where(and(ownPreview(agent), gt(previewAttempt.holdUntil, now)))
      .limit(1);
    if (hold) {
      throw conflict("Wrap-up or after-call work is still active");
    }
    const unavailable = tx
      .select({ id: previewClaim.id })
      .from(previewClaim)
      .where(
        and(
          eq(previewClaim.campaignId, row.id),
          eq(previewClaim.phone, lead.phone),
          or(
            isNull(previewClaim.releasedAt),
            eq(previewClaim.skippedSessionId, sessionId)
          )
        )
      );
    const { query, eligibility } = eligiblePreviewLeads(tx, row, now);
    const [next] = await query
      .where(and(eligibility, notExists(unavailable)))
      .orderBy(asc(lead.createdAt), asc(lead.id))
      .limit(1);
    if (!(next && row.previewSeconds)) {
      return null;
    }
    const claim = {
      id: randomUUID(),
      organizationId: agent.organizationId,
      memberId: agent.id,
      campaignId: row.id,
      leadId: next.id,
      phone: next.phone,
      name: next.name,
      revision: row.revision,
      expiresAt: new Date(now.getTime() + row.previewSeconds * 1000),
    };
    const [saved] = await tx.insert(previewClaim).values(claim).returning();
    if (!saved) {
      throw new Error("Preview reservation was not stored");
    }
    return previewView(saved);
  });
}

export async function skipPreview(
  db: Database,
  agent: PreviewAgent,
  previewId: string,
  sessionId: string
) {
  return await db.transaction(async (tx) => {
    await lockPreviewOrganization(tx, agent.organizationId);
    const now = new Date();
    const [skipped] = await tx
      .update(previewClaim)
      .set({ releasedAt: now, skippedSessionId: sessionId })
      .where(
        and(
          ownPreview(agent),
          eq(previewClaim.id, previewId),
          isNull(previewClaim.releasedAt),
          gt(previewClaim.expiresAt, now),
          notExists(linkedAttempt(tx))
        )
      )
      .returning({ id: previewClaim.id });
    return Boolean(skipped);
  });
}

async function authorizePreviewDial(
  db: PreviewDb,
  row: CampaignRow,
  claim: typeof previewClaim.$inferSelect,
  now: Date
) {
  const ringTimeoutSeconds = row.ringTimeoutSeconds ?? 0;
  if (
    row.revision !== claim.revision ||
    ringTimeoutSeconds < 1 ||
    ringTimeoutSeconds > RING_TIMEOUT_MAX_SECONDS
  ) {
    throw conflict("Campaign changed. Request a fresh preview");
  }
  const target = await findEligiblePreviewLead(db, row, claim, now);
  if (!target) {
    throw conflict("Preview lead changed or is no longer callable");
  }
  const numbers = await eligiblePreviewNumbers(db, row);
  const validMode =
    row.callerIdMode === "random" ||
    (row.callerIdMode === "fixed" && numbers.length === 1);
  if (!validMode || numbers.length === 0) {
    throw conflict("Campaign caller ID unavailable");
  }
  const number = numbers[randomInt(numbers.length)];
  if (!number) {
    throw new Error("Caller ID could not be selected");
  }
  return { number, target, ringTimeoutSeconds };
}

export async function dialPreview(
  context: Context,
  agent: PreviewAgent,
  previewId: string
) {
  requireTelephony(context);
  return await context.db.transaction(async (tx) => {
    await lockPreviewOrganization(tx, agent.organizationId);
    const now = new Date();
    const current = await requirePreviewAgent(
      tx,
      agent.organizationId,
      agent.userId
    );
    if (current.id !== agent.id) {
      throw new ORPCError("FORBIDDEN");
    }
    const [claim] = await tx
      .select()
      .from(previewClaim)
      .where(and(ownPreview(agent), eq(previewClaim.id, previewId)));
    if (!claim) {
      throw new ORPCError("NOT_FOUND");
    }
    const [existing] = await tx
      .select({ id: previewAttempt.id })
      .from(previewAttempt)
      .where(eq(previewAttempt.claimId, claim.id));
    if (existing) {
      return existing;
    }
    if (claim.releasedAt || claim.expiresAt <= now) {
      throw conflict("Preview expired or was released");
    }
    const row = await requirePreviewCampaign(tx, current, claim.campaignId);
    const { number, target, ringTimeoutSeconds } = await authorizePreviewDial(
      tx,
      row,
      claim,
      now
    );
    const options = await tx
      .select({
        id: dispositionEntry.id,
        code: dispositionEntry.code,
        label: dispositionEntry.label,
      })
      .from(dispositionEntry)
      .innerJoin(
        dispositionList,
        eq(dispositionList.id, dispositionEntry.listId)
      )
      .where(
        and(
          eq(dispositionList.id, row.dispositionListId ?? ""),
          eq(dispositionList.organizationId, agent.organizationId),
          isNull(dispositionList.archivedAt),
          isNull(dispositionEntry.retiredAt)
        )
      )
      .orderBy(asc(dispositionEntry.createdAt), asc(dispositionEntry.id));
    const id = randomUUID();
    await tx.insert(call).values({
      id,
      organizationId: agent.organizationId,
      agentId: agent.userId,
      direction: "outbound",
      status: "queued",
    });
    await tx.insert(previewAttempt).values({
      id,
      claimId: claim.id,
      callerId: number.number,
      numberId: number.id,
      ringTimeoutSeconds,
      wrapUpSeconds: row.wrapUpSeconds ?? 0,
      afterCallWorkSeconds: row.afterCallWorkSeconds ?? 0,
      retryIntervalMinutes: row.retryIntervalMinutes ?? 0,
      isRetry: target.status === "not_answered",
      dispositionOptions: options,
      issuedAt: now,
      expiresAt: new Date(now.getTime() + dispatchLifetimeMs),
      nextReadAt: new Date(now.getTime() + 5000),
      nextPublishAt: now,
    });
    return { id };
  });
}

export async function submitPreviewDisposition(
  db: Database,
  agent: PreviewAgent,
  callId: string,
  dispositionId: string
) {
  return await db.transaction(async (tx) => {
    await lockPreviewOrganization(tx, agent.organizationId);
    const now = new Date();
    const [row] = await tx
      .select({ attempt: previewAttempt })
      .from(previewAttempt)
      .innerJoin(previewClaim, eq(previewClaim.id, previewAttempt.claimId))
      .where(
        and(
          ownPreview(agent),
          eq(previewAttempt.id, callId),
          isNull(previewAttempt.disposition),
          gt(previewAttempt.wrapupUntil, now)
        )
      );
    const choice = row?.attempt.dispositionOptions.find(
      ({ id }) => id === dispositionId
    );
    if (!(row && choice)) {
      throw conflict("Disposition is invalid or wrap-up has ended");
    }
    await tx
      .update(previewAttempt)
      .set({
        disposition: choice,
        holdUntil: new Date(
          now.getTime() + row.attempt.afterCallWorkSeconds * 1000
        ),
      })
      .where(eq(previewAttempt.id, callId));
    return true;
  });
}
