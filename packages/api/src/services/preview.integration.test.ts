import { describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { createRouterClient } from "@orpc/server";
import type { Session } from "@workholo/auth";
import { createDb } from "@workholo/db";
import {
  member,
  organization,
  team,
  teamMember,
  user,
} from "@workholo/db/schema/auth";
import { call } from "@workholo/db/schema/calls";
import {
  campaign,
  campaignLeadList,
  campaignNumber,
} from "@workholo/db/schema/campaigns";
import {
  dispositionEntry,
  dispositionList,
} from "@workholo/db/schema/dispositions";
import { doNotDialEntry } from "@workholo/db/schema/do-not-dial";
import { lead, leadList } from "@workholo/db/schema/leads";
import {
  outboundNumber,
  outboundNumberAssignment,
} from "@workholo/db/schema/numbers";
import {
  previewAttempt,
  previewClaim,
  previewDestination,
} from "@workholo/db/schema/preview";
import { eq, sql } from "drizzle-orm";

import { appRouter } from "../routers/index";
import { isServiceNumber, serviceAgentId } from "../utils/preview";
import {
  dispatchPreviewCalls,
  type PreviewCallCommand,
  projectPreviewCall,
  reconcilePreviewCalls,
} from "./preview-dispatch";
import type {
  PreviewCallUpdate,
  PreviewTelephonyClient,
} from "./preview-telephony";

const databaseUrl = process.env.TEST_DATABASE_URL;
let sequence = 0;

function simulatedPhone() {
  const endpoints = new Map<string, "ready" | "offline" | "break">();
  const registered = new Set<string>();
  const revoked: string[] = [];
  let read: PreviewTelephonyClient["getCall"] = () => Promise.resolve(null);
  const getPresence: PreviewTelephonyClient["getPresence"] = async (
    agent_id
  ) => {
    const work_status = endpoints.get(agent_id) ?? "offline";
    const sip_registered = registered.has(agent_id);
    return {
      agent_id,
      work_status,
      sip_registered,
      presence:
        work_status === "ready" && sip_registered ? "available" : "offline",
      updated_at: new Date().toISOString(),
    };
  };
  const telephony: PreviewTelephonyClient = {
    provisionAgent(agent_id) {
      endpoints.set(agent_id, "offline");
      return Promise.resolve({
        agent_id,
        endpoint_type: "webrtc",
        sip_username: "1001",
        sip_password: "simulated",
        sip_domain: "example.test",
        wss_url: "wss://example.test/sip",
      });
    },
    deactivateAgent(agentId) {
      revoked.push(agentId);
      endpoints.delete(agentId);
      registered.delete(agentId);
      return Promise.resolve();
    },
    getPresence,
    setStatus(agentId, status) {
      endpoints.set(agentId, status);
      return getPresence(agentId);
    },
    getCall(id) {
      return read(id);
    },
  };
  return {
    telephony,
    registered,
    revoked,
    onRead(handler: PreviewTelephonyClient["getCall"]) {
      read = handler;
    },
  };
}

async function fixture(settings: Partial<typeof campaign.$inferInsert> = {}) {
  if (!databaseUrl) {
    throw new Error(
      "Set TEST_DATABASE_URL to a migrated isolated Postgres database"
    );
  }
  const db = createDb({ DATABASE_URL: databaseUrl });
  const phone = simulatedPhone();
  const organizationId = randomUUID();
  const campaignId = randomUUID();
  const now = new Date();
  const destination = "+12025550101";
  sequence += 1;
  const callerId = `+1202${String((Date.now() + sequence) % 10_000_000).padStart(7, "0")}`;
  const listId = randomUUID();
  const otherListId = randomUUID();
  const leadId = randomUUID();
  const numberId = randomUUID();
  const dispositionListId = randomUUID();
  const dispositionId = randomUUID();
  const teamId = randomUUID();

  await db.insert(organization).values({
    id: organizationId,
    name: "Preview test",
    slug: organizationId,
    createdAt: now,
  });
  await db.insert(team).values({
    id: teamId,
    organizationId,
    name: "Preview test",
    createdAt: now,
    updatedAt: now,
  });

  function client(session: Session | null) {
    return createRouterClient(appRouter, {
      context: {
        session,
        db,
        previewTelephony: phone.telephony,
        audit: () => undefined,
        invitationOrigins: {
          console: "http://example.test",
          agent: "http://example.test",
        },
      },
    });
  }

  async function person(role: "agent" | "owner", assigned = false) {
    const userId = randomUUID();
    const memberId = randomUUID();
    const [row] = await db
      .insert(user)
      .values({
        id: userId,
        name: role,
        email: `${userId}@example.test`,
      })
      .returning();
    if (!row) {
      throw new Error("missing test user");
    }
    await db
      .insert(member)
      .values({ id: memberId, organizationId, userId, role, createdAt: now });
    if (assigned) {
      await db
        .insert(teamMember)
        .values({ id: randomUUID(), teamId, userId, createdAt: now });
    }
    const sessionId = randomUUID();
    return {
      userId,
      memberId,
      client: client({
        user: row,
        session: {
          id: sessionId,
          userId,
          token: sessionId,
          createdAt: now,
          updatedAt: now,
          expiresAt: new Date(now.getTime() + 60_000),
        },
      }),
    };
  }

  const first = await person("agent", true);
  const second = await person("agent", true);
  const unassigned = await person("agent");
  const owner = await person("owner");

  await db.insert(leadList).values([
    { id: listId, organizationId, name: "Primary" },
    { id: otherListId, organizationId, name: "Duplicate" },
  ]);
  await db.insert(lead).values([
    {
      id: leadId,
      listId,
      phone: destination,
      name: "Oldest",
      createdAt: new Date(now.getTime() - 1000),
    },
    {
      id: randomUUID(),
      listId: otherListId,
      phone: destination,
      name: "Duplicate",
      createdAt: now,
    },
  ]);
  await db.insert(outboundNumber).values({ id: numberId, number: callerId });
  await db
    .insert(outboundNumberAssignment)
    .values({ id: randomUUID(), numberId, organizationId });
  await db
    .insert(dispositionList)
    .values({ id: dispositionListId, organizationId, name: "Choices" });
  await db.insert(dispositionEntry).values({
    id: dispositionId,
    listId: dispositionListId,
    code: "FOLLOW",
    label: "Follow up",
  });
  await db.insert(campaign).values({
    id: campaignId,
    organizationId,
    name: "Preview",
    method: "preview",
    status: "active",
    revision: 1,
    assigneeType: "team",
    assigneeId: teamId,
    callerIdMode: "fixed",
    dialStatuses: ["new", "not_answered"],
    dispositionListId,
    previewSeconds: 25,
    ringTimeoutSeconds: 17,
    wrapUpSeconds: 0,
    afterCallWorkSeconds: 0,
    retryIntervalMinutes: 5,
    retryCount: 1,
    ...settings,
  });
  await db.insert(campaignLeadList).values([
    { id: randomUUID(), campaignId, listId, position: 0 },
    { id: randomUUID(), campaignId, listId: otherListId, position: 1 },
  ]);
  await db
    .insert(campaignNumber)
    .values({ id: randomUUID(), campaignId, numberId, position: 0 });

  const input = { organizationId, campaignId };
  const agent = first.client.preview;
  const sent: { key: string; command: PreviewCallCommand }[] = [];
  const publish = (key: string, command: PreviewCallCommand) => {
    sent.push({ key, command });
    return Promise.resolve();
  };

  async function ready(personToReady = first) {
    await personToReady.client.preview.preparePhone(input);
    phone.registered.add(serviceAgentId(personToReady.memberId));
    await personToReady.client.preview.setWorkStatus({
      ...input,
      status: "ready",
    });
  }
  async function reserve() {
    const preview = await agent.claim(input);
    if (!preview) {
      throw new Error("missing preview");
    }
    return preview.id;
  }
  async function dial() {
    await ready();
    return await agent.dial({ organizationId, previewId: await reserve() });
  }
  async function dispatch() {
    await dispatchPreviewCalls(db, publish);
  }
  async function event(
    id: string,
    update: Omit<PreviewCallUpdate, "id" | "agentId">
  ) {
    await projectPreviewCall(db, {
      id,
      agentId: serviceAgentId(first.memberId),
      ...update,
    });
  }
  async function attempt(id: string) {
    const [row] = await db
      .select()
      .from(previewAttempt)
      .where(eq(previewAttempt.id, id));
    return row;
  }
  async function destinationState() {
    const [row] = await db
      .select()
      .from(previewDestination)
      .where(eq(previewDestination.campaignId, campaignId));
    return row;
  }
  async function stop() {
    await db.$client.end();
  }

  return {
    db,
    phone,
    input,
    first,
    second,
    unassigned,
    owner,
    agent,
    destination,
    organizationId,
    campaignId,
    callerId,
    numberId,
    dispositionId,
    leadId,
    teamId,
    publish,
    sent,
    ready,
    reserve,
    dial,
    dispatch,
    event,
    attempt,
    destinationState,
    stop,
    anonymous: client(null),
  };
}

describe.skipIf(!databaseUrl)(
  "preview campaign with isolated Postgres and simulated telephony",
  () => {
    test("credentials and presence follow assignment, active membership, and durable revocation", async () => {
      const f = await fixture();
      try {
        await expect(
          f.anonymous.preview.preparePhone(f.input)
        ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
        await expect(
          f.owner.client.preview.preparePhone(f.input)
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
        await expect(
          f.unassigned.client.preview.preparePhone(f.input)
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
        await expect(
          f.agent.preparePhone({ ...f.input, organizationId: randomUUID() })
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
        await expect(f.agent.claim(f.input)).rejects.toMatchObject({
          code: "CONFLICT",
        });
        await f.ready();
        expect(await f.agent.getPresence(f.input)).toEqual({
          presence: "available",
          sipRegistered: true,
          workStatus: "ready",
        });
        await f.agent.setWorkStatus({
          organizationId: f.organizationId,
          status: "offline",
        });
        expect((await f.agent.getPresence(f.input))?.workStatus).toBe(
          "offline"
        );
        await f.db
          .update(member)
          .set({ role: "admin" })
          .where(eq(member.id, f.first.memberId));
        await expect(f.agent.preparePhone(f.input)).rejects.toMatchObject({
          code: "FORBIDDEN",
        });
        // A brief role loss still revokes the old remote registration.
        await f.db
          .update(member)
          .set({ role: "agent" })
          .where(eq(member.id, f.first.memberId));
        await reconcilePreviewCalls(f.db, f.phone.telephony);
        expect(f.phone.revoked).toEqual([serviceAgentId(f.first.memberId)]);
        await f.ready();
        await f.db.delete(member).where(eq(member.id, f.first.memberId));
        await expect(f.agent.preparePhone(f.input)).rejects.toMatchObject({
          code: "FORBIDDEN",
        });
        await reconcilePreviewCalls(f.db, f.phone.telephony);
        expect(f.phone.revoked).toHaveLength(2);
      } finally {
        await f.stop();
      }
    });

    test("concurrent claims deduplicate normalized destinations across lists and Skip or expiry releases without a call", async () => {
      const f = await fixture();
      try {
        await f.ready();
        await f.ready(f.second);
        const second = f.second.client.preview;
        const [firstPreview, secondPreview] = await Promise.all([
          f.agent.claim(f.input),
          second.claim(f.input),
        ]);
        expect([firstPreview, secondPreview].filter(Boolean)).toHaveLength(1);
        const claimed = firstPreview ?? secondPreview;
        if (!claimed) {
          throw new Error("missing winning preview");
        }
        const winner = firstPreview ? f.agent : second;
        const loser = firstPreview ? second : f.agent;
        expect(claimed.name).toBe("Oldest");
        expect(await winner.claim(f.input)).toEqual(claimed);
        const anotherId = randomUUID();
        const [row] = await f.db
          .select()
          .from(campaign)
          .where(eq(campaign.id, f.campaignId));
        if (!row) {
          throw new Error("missing campaign");
        }
        await f.db.insert(campaign).values({ ...row, id: anotherId });
        await expect(
          winner.claim({ ...f.input, campaignId: anotherId })
        ).rejects.toMatchObject({ code: "CONFLICT" });
        expect(
          await winner.skip({
            organizationId: f.organizationId,
            previewId: claimed.id,
          })
        ).toBe(true);
        const next = await loser.claim(f.input);
        expect(next?.phone).toBe(f.destination);
        await f.db
          .update(previewClaim)
          .set({ expiresAt: new Date(0) })
          .where(eq(previewClaim.id, next?.id ?? ""));
        expect((await loser.getState(f.input)).preview).toBeNull();
        await expect(
          loser.dial({
            organizationId: f.organizationId,
            previewId: next?.id ?? "",
          })
        ).rejects.toMatchObject({ code: "CONFLICT" });
        expect(await winner.claim(f.input)).toBeNull();
        expect(await loser.claim(f.input)).toBeTruthy();
        expect(
          await f.db
            .select()
            .from(call)
            .where(eq(call.organizationId, f.organizationId))
        ).toEqual([]);
      } finally {
        await f.stop();
      }
    });

    test("Dial rejects stale revision, lost assignment, lead changes, DND and disabled or revoked DID", async () => {
      const f = await fixture();
      try {
        await f.ready();
        const request = {
          organizationId: f.organizationId,
          previewId: await f.reserve(),
        };
        await f.db
          .update(campaign)
          .set({ status: "paused", revision: 2 })
          .where(eq(campaign.id, f.campaignId));
        await f.db
          .update(campaign)
          .set({ status: "active", revision: 3 })
          .where(eq(campaign.id, f.campaignId));
        await expect(f.agent.dial(request)).rejects.toMatchObject({
          code: "CONFLICT",
        });
        request.previewId = await f.reserve();
        await f.db
          .update(campaign)
          .set({ assigneeId: randomUUID() })
          .where(eq(campaign.id, f.campaignId));
        await expect(f.agent.dial(request)).rejects.toMatchObject({
          code: "NOT_FOUND",
        });
        await f.db
          .update(campaign)
          .set({ assigneeId: f.teamId })
          .where(eq(campaign.id, f.campaignId));
        await f.db
          .update(lead)
          .set({ name: "Changed" })
          .where(eq(lead.id, f.leadId));
        await expect(f.agent.dial(request)).rejects.toMatchObject({
          code: "CONFLICT",
        });
        await f.db
          .update(lead)
          .set({ name: "Oldest" })
          .where(eq(lead.id, f.leadId));
        await f.db.insert(doNotDialEntry).values({
          id: randomUUID(),
          organizationId: f.organizationId,
          e164Number: f.destination,
        });
        await expect(f.agent.dial(request)).rejects.toMatchObject({
          code: "CONFLICT",
        });
        await f.db
          .delete(doNotDialEntry)
          .where(eq(doNotDialEntry.organizationId, f.organizationId));
        await f.db
          .update(outboundNumber)
          .set({ enabled: false })
          .where(eq(outboundNumber.id, f.numberId));
        await expect(f.agent.dial(request)).rejects.toMatchObject({
          code: "CONFLICT",
        });
        await f.db
          .update(outboundNumber)
          .set({ enabled: true })
          .where(eq(outboundNumber.id, f.numberId));
        await f.db
          .delete(outboundNumberAssignment)
          .where(eq(outboundNumberAssignment.numberId, f.numberId));
        await expect(f.agent.dial(request)).rejects.toMatchObject({
          code: "CONFLICT",
        });
        await f.dispatch();
        expect(f.sent).toEqual([]);
      } finally {
        await f.stop();
      }
    });

    test("concurrent Dial shares IDs; ambiguous Kafka acknowledgment replays the same command and blocks new previews", async () => {
      const f = await fixture();
      try {
        await f.ready();
        const request = {
          organizationId: f.organizationId,
          previewId: await f.reserve(),
        };
        const [first, second] = await Promise.all([
          f.agent.dial(request),
          f.agent.dial(request),
        ]);
        expect(first).toEqual(second);
        await expect(
          dispatchPreviewCalls(f.db, async (key, command) => {
            await f.publish(key, command);
            throw new Error("simulated lost broker acknowledgment");
          })
        ).rejects.toThrow("Preview dispatch failed");
        expect((await f.attempt(first.id))?.publishStarted).toBe(true);
        await expect(f.agent.claim(f.input)).rejects.toMatchObject({
          code: "CONFLICT",
        });
        await f.db
          .update(previewAttempt)
          .set({ nextPublishAt: new Date(0) })
          .where(eq(previewAttempt.id, first.id));
        await Promise.all([f.dispatch(), f.dispatch()]);
        expect(f.sent).toHaveLength(2);
        const [envelope, replay] = f.sent;
        if (!envelope) {
          throw new Error("missing queued command");
        }
        expect(replay).toEqual(envelope);
        expect(envelope.key).toBe(serviceAgentId(f.first.memberId));
        expect(envelope.command).toMatchObject({
          agentId: envelope.key,
          commandId: first.id,
          callId: first.id,
          to: f.destination,
          callerId: f.callerId,
          customerRingTimeoutSeconds: 17,
        });
        expect(
          envelope.command.expiresAt.getTime() -
            envelope.command.issuedAt.getTime()
        ).toBe(30_000);
      } finally {
        await f.stop();
      }
    });

    test("paused and reactivated campaign rejects a queued command from the old revision", async () => {
      const f = await fixture();
      try {
        const { id } = await f.dial();
        await f.db
          .update(campaign)
          .set({ status: "paused", revision: 2 })
          .where(eq(campaign.id, f.campaignId));
        await f.db
          .update(campaign)
          .set({ status: "active", revision: 3 })
          .where(eq(campaign.id, f.campaignId));
        await f.dispatch();
        expect(f.sent).toEqual([]);
        expect((await f.agent.getState(f.input)).attempt).toMatchObject({
          id,
          status: "rejected",
          rejectReason: "eligibility_changed",
        });
      } finally {
        await f.stop();
      }
    });

    test("replay checks new suppression; expiry and a 404 cannot release an ambiguous send", async () => {
      const f = await fixture();
      try {
        const { id } = await f.dial();
        await expect(
          dispatchPreviewCalls(f.db, async (key, command) => {
            await f.publish(key, command);
            throw new Error("ambiguous publish");
          })
        ).rejects.toThrow("Preview dispatch failed");
        await f.db.insert(doNotDialEntry).values({
          id: randomUUID(),
          organizationId: f.organizationId,
          e164Number: f.destination,
        });
        await f.db
          .update(previewAttempt)
          .set({ nextPublishAt: new Date(0) })
          .where(eq(previewAttempt.id, id));
        await f.dispatch();
        expect(f.sent).toHaveLength(1);
        await f.db
          .update(previewAttempt)
          .set({ expiresAt: new Date(0), nextReadAt: new Date(0) })
          .where(eq(previewAttempt.id, id));
        await reconcilePreviewCalls(f.db, f.phone.telephony);
        await expect(f.agent.claim(f.input)).rejects.toMatchObject({
          code: "CONFLICT",
        });
        expect((await f.agent.getState(f.input)).attempt).toMatchObject({
          id,
          status: "queued",
        });
      } finally {
        await f.stop();
      }
    });

    test("before publish a new DND entry closes the known-unsent attempt", async () => {
      const f = await fixture();
      try {
        const { id } = await f.dial();
        await f.db.insert(doNotDialEntry).values({
          id: randomUUID(),
          organizationId: f.organizationId,
          e164Number: f.destination,
        });
        await f.dispatch();
        expect(f.sent).toEqual([]);
        expect((await f.agent.getState(f.input)).attempt).toMatchObject({
          id,
          status: "rejected",
          rejectReason: "eligibility_changed",
        });
      } finally {
        await f.stop();
      }
    });

    test("DND lookup error fails closed and expired, never-published work closes safely", async () => {
      const f = await fixture();
      const timeoutUrl = new URL(databaseUrl ?? "");
      timeoutUrl.searchParams.set("options", "-c statement_timeout=500ms");
      const timeoutDb = createDb({ DATABASE_URL: timeoutUrl.toString() });
      try {
        const { id } = await f.dial();
        await f.db.transaction(async (tx) => {
          await tx.execute(
            sql`lock table do_not_dial_entry in access exclusive mode`
          );
          await expect(
            dispatchPreviewCalls(timeoutDb, f.publish)
          ).rejects.toThrow("Preview dispatch failed");
        });
        expect(f.sent).toEqual([]);
        expect((await f.attempt(id))?.publishStarted).toBe(false);
        await f.db
          .update(previewAttempt)
          .set({ expiresAt: new Date(0) })
          .where(eq(previewAttempt.id, id));
        await f.dispatch();
        expect((await f.agent.getState(f.input)).attempt).toMatchObject({
          id,
          status: "rejected",
          rejectReason: "dispatch_expired",
        });
      } finally {
        await timeoutDb.$client.end();
        await f.stop();
      }
    });

    test("events progress monotonically, while 404 and failed reads preserve unresolved calls", async () => {
      const f = await fixture({ wrapUpSeconds: 180, afterCallWorkSeconds: 40 });
      try {
        const { id } = await f.dial();
        await f.dispatch();
        await projectPreviewCall(f.db, {
          id: randomUUID(),
          agentId: serviceAgentId(f.first.memberId),
          status: "ended",
        });
        await projectPreviewCall(f.db, {
          id,
          agentId: serviceAgentId(f.second.memberId),
          status: "connected",
        });
        expect((await f.agent.getState(f.input)).attempt?.status).toBe(
          "queued"
        );
        for (const status of [
          "agent_ringing",
          "agent_answered",
          "lead_ringing",
          "connected",
        ] as const) {
          // biome-ignore lint/performance/noAwaitInLoops: assert each committed transition before sending the next event.
          await f.event(id, { status });
          expect((await f.agent.getState(f.input)).attempt?.status).toBe(
            status
          );
        }
        await f.event(id, { status: "lead_ringing" });
        expect((await f.agent.getState(f.input)).attempt?.status).toBe(
          "connected"
        );
        const readNow = () =>
          f.db
            .update(previewAttempt)
            .set({ nextReadAt: new Date(0) })
            .where(eq(previewAttempt.id, id));
        await readNow();
        await reconcilePreviewCalls(f.db, f.phone.telephony);
        await f.db
          .update(previewAttempt)
          .set({ expiresAt: new Date(0) })
          .where(eq(previewAttempt.id, id));
        await readNow();
        await reconcilePreviewCalls(f.db, f.phone.telephony);
        await expect(f.agent.claim(f.input)).rejects.toMatchObject({
          code: "CONFLICT",
        });
        f.phone.onRead(() =>
          Promise.reject(new Error("simulated HTTP outage"))
        );
        await readNow();
        await expect(
          reconcilePreviewCalls(f.db, f.phone.telephony)
        ).rejects.toThrow("Preview reconciliation failed");
        expect((await f.agent.getState(f.input)).attempt?.status).toBe(
          "connected"
        );
        const endedAt = new Date(Date.now() - 1000);
        f.phone.onRead((callId) =>
          Promise.resolve({
            id: callId,
            agentId: serviceAgentId(f.first.memberId),
            status: "ended",
            outcome: "completed",
            endedAt,
          })
        );
        await readNow();
        await reconcilePreviewCalls(f.db, f.phone.telephony);
        const before = (await f.agent.getState(f.input)).attempt;
        expect(before).toMatchObject({
          status: "ended",
          outcome: "completed",
          wrapupUntil: new Date(endedAt.getTime() + 180_000).toISOString(),
        });
        await f.db
          .update(dispositionEntry)
          .set({ retiredAt: new Date() })
          .where(eq(dispositionEntry.id, f.dispositionId));
        const disposition = {
          organizationId: f.organizationId,
          callId: id,
          dispositionId: f.dispositionId,
        };
        await expect(
          f.second.client.preview.submitDisposition(disposition)
        ).rejects.toMatchObject({ code: "CONFLICT" });
        expect(await f.agent.submitDisposition(disposition)).toBe(true);
        await expect(
          f.agent.submitDisposition(disposition)
        ).rejects.toMatchObject({ code: "CONFLICT" });
        await expect(f.agent.claim(f.input)).rejects.toMatchObject({
          code: "CONFLICT",
        });
        const after = (await f.agent.getState(f.input)).attempt;
        await f.event(id, {
          status: "ended",
          outcome: "lead_unanswered",
          hangupCause: "USER_BUSY",
          endedAt: new Date(),
        });
        expect((await f.agent.getState(f.input)).attempt).toEqual(after);
        expect(await f.destinationState()).toMatchObject({
          status: "completed",
          retriesUsed: 0,
        });
        const legacyId = randomUUID();
        await f.db.insert(call).values({
          id: legacyId,
          organizationId: f.organizationId,
          agentId: f.second.userId,
          direction: "inbound",
          status: "ended",
        });
        const history = await f.owner.client.calls.calls({
          organizationId: f.organizationId,
        });
        expect(history.find((row) => row.id === legacyId)).toMatchObject({
          campaignId: null,
          disposition: null,
        });
        expect(history.find((row) => row.id === id)).toMatchObject({
          campaignId: f.campaignId,
          outcome: "completed",
          disposition: { code: "FOLLOW", label: "Follow up" },
        });
        expect(
          (
            await f.first.client.calls.calls({
              organizationId: f.organizationId,
            })
          ).map((row) => row.id)
        ).toEqual([id]);
      } finally {
        await f.stop();
      }
    });

    test("due busy/no-answer spends exactly one retry, while agent and carrier failures preserve eligibility", async () => {
      const f = await fixture();
      try {
        const first = await f.dial();
        await f.dispatch();
        await f.event(first.id, {
          status: "ended",
          outcome: "agent_missed",
          hangupCause: "NO_ANSWER",
        });
        expect(await f.destinationState()).toBeUndefined();
        const second = await f.agent.dial({
          organizationId: f.organizationId,
          previewId: await f.reserve(),
        });
        await f.dispatch();
        await f.event(second.id, {
          status: "ended",
          outcome: "lead_unanswered",
          hangupCause: "NORMAL_TEMPORARY_FAILURE",
        });
        expect(await f.destinationState()).toBeUndefined();
        const initial = await f.agent.dial({
          organizationId: f.organizationId,
          previewId: await f.reserve(),
        });
        await f.dispatch();
        await f.event(initial.id, {
          status: "ended",
          outcome: "lead_unanswered",
          hangupCause: "USER_BUSY",
          endedBy: "lead",
        });
        expect(
          (await f.agent.getState(f.input)).attempt?.wrapupUntil
        ).toBeNull();
        expect(await f.destinationState()).toMatchObject({
          status: "not_answered",
          retriesUsed: 0,
        });
        expect(await f.agent.claim(f.input)).toBeNull();
        await f.db
          .update(previewDestination)
          .set({ retryAt: new Date(0) })
          .where(eq(previewDestination.campaignId, f.campaignId));
        await f.db
          .update(campaign)
          .set({ dialStatuses: ["new"] })
          .where(eq(campaign.id, f.campaignId));
        expect(await f.agent.claim(f.input)).toBeNull();
        await f.db
          .update(campaign)
          .set({ dialStatuses: ["new", "not_answered"], retryCount: 0 })
          .where(eq(campaign.id, f.campaignId));
        expect(await f.agent.claim(f.input)).toBeNull();
        await f.db
          .update(campaign)
          .set({ retryCount: 1 })
          .where(eq(campaign.id, f.campaignId));
        const retryPreview = await f.reserve();
        expect(f.sent).toHaveLength(3);
        const retry = await f.agent.dial({
          organizationId: f.organizationId,
          previewId: retryPreview,
        });
        await f.dispatch();
        const timeout = {
          status: "ended",
          outcome: "lead_unanswered",
          hangupCause: "NO_USER_RESPONSE",
          endedBy: "system",
        } as const;
        await f.event(retry.id, timeout);
        await f.event(retry.id, timeout);
        expect((await f.destinationState())?.retriesUsed).toBe(1);
        await f.db
          .update(previewDestination)
          .set({ retryAt: new Date(0) })
          .where(eq(previewDestination.campaignId, f.campaignId));
        expect(await f.agent.claim(f.input)).toBeNull();
      } finally {
        await f.stop();
      }
    });

    test("expired wrap-up is undisposed and after-call work uses the original deadline", async () => {
      const f = await fixture({ wrapUpSeconds: 10, afterCallWorkSeconds: 60 });
      try {
        const { id } = await f.dial();
        await f.dispatch();
        const endedAt = new Date(Date.now() - 15_000);
        await f.event(id, { status: "ended", outcome: "completed", endedAt });
        const state = (await f.agent.getState(f.input)).attempt;
        expect(state).toMatchObject({
          disposition: null,
          wrapupUntil: new Date(endedAt.getTime() + 10_000).toISOString(),
          holdUntil: new Date(endedAt.getTime() + 70_000).toISOString(),
        });
        await expect(
          f.agent.submitDisposition({
            organizationId: f.organizationId,
            callId: id,
            dispositionId: f.dispositionId,
          })
        ).rejects.toMatchObject({ code: "CONFLICT" });
        await expect(f.agent.claim(f.input)).rejects.toMatchObject({
          code: "CONFLICT",
        });
      } finally {
        await f.stop();
      }
    });
  }
);

test("service E.164 lower and upper bounds", () => {
  expect(["+1234567", "+123456789012345"].every(isServiceNumber)).toBe(true);
  expect(
    ["+123456", "+1234567890123456", "+01234567", "1234567"].some(
      isServiceNumber
    )
  ).toBe(false);
});
