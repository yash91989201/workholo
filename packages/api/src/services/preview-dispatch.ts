import type { Database } from "@workholo/db";
import { member, organization, user } from "@workholo/db/schema/auth";
import { call } from "@workholo/db/schema/calls";
import {
  previewAttempt,
  previewClaim,
  previewDestination,
  previewPhone,
} from "@workholo/db/schema/preview";
import { and, asc, eq, isNotNull, isNull, lte, or, sql } from "drizzle-orm";

import {
  assignedPreviewCampaigns,
  eligiblePreviewNumbers,
  findEligiblePreviewLead,
  findPreviewAgent,
  isServiceNumber,
  lockPreviewOrganization,
  type PreviewDb,
  serviceAgentId,
} from "../utils/preview";
import type {
  PreviewCallUpdate,
  PreviewTelephonyClient,
} from "./preview-telephony";

const batchSize = 20;
const publishLeaseMs = 6000;
const readIntervalMs = 5000;
const statusRank = new Map([
  ["queued", 0],
  ["initiating", 1],
  ["agent_ringing", 2],
  ["agent_answered", 3],
  ["lead_ringing", 4],
  ["connected", 5],
  ["ended", 6],
  ["rejected", 6],
]);

const unansweredCauses = new Set([
  "USER_BUSY",
  "NO_ANSWER",
  "NO_USER_RESPONSE",
]);

export type PreviewCallCommand = {
  commandId: string;
  callId: string;
  agentId: string;
  to: string;
  callerId: string;
  customerRingTimeoutSeconds: number;
  issuedAt: Date;
  expiresAt: Date;
};

type PublishPreview = (
  key: string,
  command: PreviewCallCommand
) => Promise<void>;

function attempts(db: PreviewDb) {
  return db
    .select({ attempt: previewAttempt, claim: previewClaim, call })
    .from(previewAttempt)
    .innerJoin(previewClaim, eq(previewClaim.id, previewAttempt.claimId))
    .innerJoin(call, eq(call.id, previewAttempt.id));
}

type Attempt = Awaited<ReturnType<typeof attempts>>[number];

function terminalChanges(
  row: Attempt,
  update: PreviewCallUpdate,
  endedAt: Date
) {
  const completed = update.outcome === "completed";
  const unanswered =
    update.outcome === "lead_unanswered" &&
    (update.endedBy === "lead" || update.endedBy === "system") &&
    unansweredCauses.has(update.hangupCause ?? "");
  let leadStatus: "completed" | "not_answered" | null = null;
  if (completed) {
    leadStatus = "completed";
  } else if (unanswered) {
    leadStatus = "not_answered";
  }
  const needsWrapup =
    leadStatus || row.call.status === "connected" || update.connectedAt;
  const wrapupUntil =
    needsWrapup && row.attempt.wrapUpSeconds > 0
      ? new Date(endedAt.getTime() + row.attempt.wrapUpSeconds * 1000)
      : null;
  return {
    leadStatus,
    wrapupUntil,
    holdUntil: needsWrapup
      ? new Date(
          (wrapupUntil ?? endedAt).getTime() +
            row.attempt.afterCallWorkSeconds * 1000
        )
      : null,
  };
}

async function finishAttempt(
  db: PreviewDb,
  row: Attempt,
  update: PreviewCallUpdate,
  fallbackTime: Date
) {
  const endedAt = update.endedAt ?? fallbackTime;
  const outcome = update.outcome ?? null;
  const hangupCause = update.hangupCause ?? null;
  const { leadStatus, wrapupUntil, holdUntil } = terminalChanges(
    row,
    update,
    endedAt
  );
  await db
    .update(call)
    .set({
      status: update.status,
      startedAt:
        row.call.startedAt ?? update.initiatedAt ?? row.attempt.issuedAt,
      endedAt,
    })
    .where(eq(call.id, row.call.id));
  await db
    .update(previewAttempt)
    .set({
      outcome,
      nextPublishAt: null,
      nextReadAt: null,
      hangupCause,
      wrapupUntil,
      holdUntil,
      rejectReason:
        update.status === "rejected"
          ? (update.rejectReason ?? "rejected")
          : null,
    })
    .where(eq(previewAttempt.id, row.call.id));
  await db
    .update(previewClaim)
    .set({ releasedAt: fallbackTime })
    .where(eq(previewClaim.id, row.claim.id));
  if (leadStatus) {
    const retryAt =
      leadStatus === "not_answered"
        ? new Date(
            endedAt.getTime() + row.attempt.retryIntervalMinutes * 60_000
          )
        : null;
    const retriesUsed = Number(row.attempt.isRetry);
    await db
      .insert(previewDestination)
      .values({
        campaignId: row.claim.campaignId,
        phone: row.claim.phone,
        status: leadStatus,
        retryAt,
        retriesUsed,
      })
      .onConflictDoUpdate({
        target: [previewDestination.campaignId, previewDestination.phone],
        set: {
          status: leadStatus,
          retryAt,
          retriesUsed: sql`${previewDestination.retriesUsed} + ${retriesUsed}`,
        },
      });
  }
}

export async function projectPreviewCall(
  db: Database,
  update: PreviewCallUpdate
) {
  const [owner] = await attempts(db).where(eq(previewAttempt.id, update.id));
  if (!owner || serviceAgentId(owner.claim.memberId) !== update.agentId) {
    return;
  }
  await db.transaction(async (tx) => {
    await lockPreviewOrganization(tx, owner.claim.organizationId);
    const [current] = await attempts(tx).where(
      eq(previewAttempt.id, update.id)
    );
    const incomingRank = statusRank.get(update.status) ?? -1;
    if (
      !current?.attempt.publishStarted ||
      incomingRank <= (statusRank.get(current.call.status) ?? 0)
    ) {
      return;
    }
    if (update.status === "ended" || update.status === "rejected") {
      await finishAttempt(tx, current, update, new Date());
      return;
    }
    await tx
      .update(call)
      .set({
        status: update.status,
        startedAt:
          current.call.startedAt ??
          update.initiatedAt ??
          current.attempt.issuedAt,
      })
      .where(eq(call.id, update.id));
    await tx
      .update(previewAttempt)
      .set({ nextPublishAt: null })
      .where(eq(previewAttempt.id, update.id));
  });
}

async function checkDispatch(db: PreviewDb, row: Attempt, now: Date) {
  const agent = await findPreviewAgent(
    db,
    row.claim.organizationId,
    row.call.agentId
  );
  if (!agent || agent.id !== row.claim.memberId) {
    return false;
  }
  const [phone] = await db
    .select({ id: previewPhone.memberId })
    .from(previewPhone)
    .where(
      and(eq(previewPhone.memberId, agent.id), eq(previewPhone.revoked, false))
    );
  if (!phone) {
    return false;
  }
  const [campaign] = await assignedPreviewCampaigns(
    db,
    agent,
    row.claim.campaignId
  );
  if (
    !campaign ||
    campaign.revision !== row.claim.revision ||
    campaign.ringTimeoutSeconds !== row.attempt.ringTimeoutSeconds ||
    !isServiceNumber(row.claim.phone) ||
    !isServiceNumber(row.attempt.callerId)
  ) {
    return false;
  }
  const target = await findEligiblePreviewLead(db, campaign, row.claim, now);
  const [number] = await eligiblePreviewNumbers(
    db,
    campaign,
    row.attempt.numberId
  );
  return Boolean(target && number?.number === row.attempt.callerId);
}

async function leaseDispatch(
  db: Database,
  candidate: Attempt
): Promise<PreviewCallCommand | undefined> {
  return await db.transaction(async (tx) => {
    await lockPreviewOrganization(tx, candidate.claim.organizationId);
    const now = new Date();
    const [row] = await attempts(tx).where(
      and(
        eq(previewAttempt.id, candidate.call.id),
        eq(call.status, "queued"),
        isNull(previewAttempt.publishedAt),
        lte(previewAttempt.nextPublishAt, now)
      )
    );
    if (!row) {
      return;
    }
    const agentId = serviceAgentId(row.claim.memberId);
    const eligible =
      row.attempt.expiresAt > now && (await checkDispatch(tx, row, now));
    const leaseTime = new Date();
    const expired = row.attempt.expiresAt <= leaseTime;
    if (expired || !eligible) {
      if (row.attempt.publishStarted) {
        await tx
          .update(previewAttempt)
          .set({ nextPublishAt: null })
          .where(eq(previewAttempt.id, row.call.id));
      } else {
        await finishAttempt(
          tx,
          row,
          {
            id: row.call.id,
            agentId,
            status: "rejected",
            rejectReason: expired ? "dispatch_expired" : "eligibility_changed",
          },
          leaseTime
        );
      }
      return;
    }
    // A crash after committing this marker makes the send ambiguous.
    await tx
      .update(previewAttempt)
      .set({
        publishStarted: true,
        nextPublishAt: new Date(leaseTime.getTime() + publishLeaseMs),
      })
      .where(eq(previewAttempt.id, row.call.id));
    return {
      commandId: row.call.id,
      callId: row.call.id,
      agentId,
      to: row.claim.phone,
      callerId: row.attempt.callerId,
      customerRingTimeoutSeconds: row.attempt.ringTimeoutSeconds,
      issuedAt: row.attempt.issuedAt,
      expiresAt: row.attempt.expiresAt,
    };
  });
}

export async function dispatchPreviewCalls(
  db: Database,
  publish: PublishPreview
) {
  const now = new Date();
  const rows = await attempts(db)
    .where(
      and(
        eq(call.status, "queued"),
        isNull(previewAttempt.publishedAt),
        lte(previewAttempt.nextPublishAt, now)
      )
    )
    .orderBy(asc(previewAttempt.nextPublishAt))
    .limit(batchSize);
  // Isolate each lease and send so a failed command cannot starve other tenants.
  const results = await Promise.allSettled(
    rows.map(async (row) => {
      const command = await leaseDispatch(db, row);
      if (!command || command.expiresAt <= new Date()) {
        return;
      }
      await publish(command.agentId, command);
      await db
        .update(previewAttempt)
        .set({ publishedAt: new Date(), nextPublishAt: null })
        .where(eq(previewAttempt.id, command.callId));
    })
  );
  rethrowWorkerError(results, "Preview dispatch failed");
}

function rethrowWorkerError(
  results: PromiseSettledResult<unknown>[],
  message: string
) {
  const failed = results.find((result) => result.status === "rejected");
  if (failed) {
    throw new Error(message, { cause: failed.reason });
  }
}

export async function revokePreviewPhones(
  db: Database,
  telephony: PreviewTelephonyClient
) {
  const revoked = or(
    eq(previewPhone.revoked, true),
    isNull(member.id),
    sql`${member.role} <> 'agent'`,
    isNull(organization.id),
    isNotNull(organization.suspendedAt),
    and(
      eq(user.banned, true),
      or(isNull(user.banExpires), sql`${user.banExpires} > now()`)
    )
  );
  const candidates = (tx: PreviewDb) =>
    tx
      .select({
        memberId: previewPhone.memberId,
        organizationId: previewPhone.organizationId,
      })
      .from(previewPhone)
      .leftJoin(member, eq(member.id, previewPhone.memberId))
      .leftJoin(organization, eq(organization.id, previewPhone.organizationId))
      .leftJoin(user, eq(user.id, member.userId));
  const rows = await candidates(db).where(revoked).limit(batchSize);
  const results = await Promise.allSettled(
    rows.map((row) =>
      db.transaction(async (tx) => {
        await lockPreviewOrganization(tx, row.organizationId);
        const [current] = await candidates(tx).where(
          and(eq(previewPhone.memberId, row.memberId), revoked)
        );
        if (current) {
          await telephony.deactivateAgent(serviceAgentId(row.memberId));
          await tx
            .delete(previewPhone)
            .where(eq(previewPhone.memberId, row.memberId));
        }
      })
    )
  );
  rethrowWorkerError(results, "Preview phone revocation failed");
}

export async function reconcilePreviewCalls(
  db: Database,
  telephony: PreviewTelephonyClient
) {
  const now = new Date();
  const rows = await attempts(db)
    .where(
      and(
        eq(previewAttempt.publishStarted, true),
        isNull(call.endedAt),
        lte(previewAttempt.nextReadAt, now)
      )
    )
    .orderBy(asc(previewAttempt.nextReadAt))
    .limit(batchSize);
  const results = await Promise.allSettled([
    revokePreviewPhones(db, telephony),
    ...rows.map(async (row) => {
      const [leased] = await db
        .update(previewAttempt)
        .set({ nextReadAt: new Date(now.getTime() + readIntervalMs) })
        .where(
          and(
            eq(previewAttempt.id, row.call.id),
            lte(previewAttempt.nextReadAt, now)
          )
        )
        .returning({ id: previewAttempt.id });
      if (leased) {
        const update = await telephony.getCall(row.call.id);
        if (update?.id === row.call.id) {
          await projectPreviewCall(db, update);
        }
      }
    }),
  ]);
  rethrowWorkerError(results, "Preview reconciliation failed");
}
