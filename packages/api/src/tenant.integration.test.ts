import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createRouterClient } from "@orpc/server";
import { createAuth } from "@workholo/auth";
import type { AuditEvent } from "@workholo/auth/audit";
import { createDb, type Database } from "@workholo/db";
import {
  invitation,
  member,
  organization,
  user,
} from "@workholo/db/schema/auth";
import { call, recording } from "@workholo/db/schema/calls";
import { doNotDialEntry } from "@workholo/db/schema/do-not-dial";
import { lead } from "@workholo/db/schema/leads";
import {
  outboundNumber,
  outboundNumberAssignment,
} from "@workholo/db/schema/numbers";
import { and, eq, inArray, like } from "drizzle-orm";

import { appRouter } from "./routers/index";
import { organizationScope } from "./utils/tenant";

const RUN = `api${Date.now()}`;
const DOMAIN = `${RUN}.test`;
const PASSWORD = "password123";

function databaseUrl(): string {
  for (const file of ["../../apps/server/.env", ".env"]) {
    try {
      const match = readFileSync(file, "utf-8").match(/^DATABASE_URL=(.+)$/m);
      if (match?.[1]) {
        return match[1].trim();
      }
    } catch {
      // fall through
    }
  }
  throw new Error("DATABASE_URL is not set");
}

const env = {
  BETTER_AUTH_URL: "http://localhost:8000",
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-12",
  CORS_ORIGIN: "http://localhost:3001",
  CONSOLE_ORIGIN: "http://localhost:3003",
  AGENT_ORIGIN: "http://localhost:3004",
  PLATFORM_ORIGIN: "http://localhost:3002",
};

type Session = NonNullable<
  Awaited<ReturnType<ReturnType<typeof createAuth>["api"]["getSession"]>>
>;

let db: Database;
let auth: ReturnType<typeof createAuth>;
const auditEvents: AuditEvent[] = [];
const audit = (event: AuditEvent) => {
  auditEvents.push(event);
};

function cookieHeader(headers: Headers): string {
  const pairs = new Map<string, string>();
  for (const cookie of headers.getSetCookie()) {
    const pair = cookie.split(";")[0] ?? "";
    const index = pair.indexOf("=");
    if (index <= 0) {
      continue;
    }
    pairs.set(pair.slice(0, index), pair);
  }
  return [...pairs.values()].join("; ");
}

async function signUp(name: string) {
  const result = await auth.api.signUpEmail({
    body: { email: `${name}@${DOMAIN}`, password: PASSWORD, name },
    returnHeaders: true,
  });
  return {
    headers: new Headers({ cookie: cookieHeader(result.headers) }),
    user: result.response.user,
  };
}

async function signIn(email: string) {
  const result = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    returnHeaders: true,
  });
  return { headers: new Headers({ cookie: cookieHeader(result.headers) }) };
}

async function getSession(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  if (!session) {
    throw new Error("missing session");
  }
  return session;
}

function clientFor(session: Session | null) {
  return createRouterClient(appRouter, {
    context: {
      db,
      session,
      audit,
      invitationOrigins: {
        console: env.CONSOLE_ORIGIN,
        agent: env.AGENT_ORIGIN,
      },
    },
  });
}

describe("tenant request path", () => {
  let owner: Awaited<ReturnType<typeof signUp>>;
  let adminUser: Awaited<ReturnType<typeof signUp>>;
  let agentUser: Awaited<ReturnType<typeof signUp>>;
  let outsider: Awaited<ReturnType<typeof signUp>>;
  let platformUser: Awaited<ReturnType<typeof signUp>>;
  let doomedUser: Awaited<ReturnType<typeof signUp>>;
  let organizationId = "";
  let otherOrganizationId = "";
  let teamId = "";
  let otherTeamId = "";
  let pendingInvitationId = "";
  let cancelledInvitationId = "";
  let leadListId = "";
  let dispositionListId = "";
  let dispositionEntryId = "";
  let dispositionCallbackId = "";
  let numberId = "";
  const numberIds: string[] = [];

  beforeAll(async () => {
    db = createDb({ DATABASE_URL: databaseUrl() });
    auth = createAuth(env, db, { audit });

    owner = await signUp("owner");
    adminUser = await signUp("admin");
    agentUser = await signUp("agent");
    outsider = await signUp("outsider");
    platformUser = await signUp("platform");
    doomedUser = await signUp("doomed");

    const org = (await auth.api.createOrganization({
      body: { name: "Acme", slug: `${RUN}-acme` },
      headers: owner.headers,
    })) as { id: string };
    organizationId = org.id;

    const adminInvite = await auth.api.createInvitation({
      body: { email: adminUser.user.email, role: "admin", organizationId },
      headers: owner.headers,
    });
    await auth.api.acceptInvitation({
      body: { invitationId: adminInvite.id },
      headers: adminUser.headers,
    });

    const createdTeam = await auth.api.createTeam({
      body: { name: "Support", organizationId },
      headers: owner.headers,
    });
    teamId = createdTeam.id;

    const agentInvite = await auth.api.createInvitation({
      body: {
        email: agentUser.user.email,
        role: "agent",
        teamId,
        organizationId,
      },
      headers: owner.headers,
    });
    await auth.api.acceptInvitation({
      body: { invitationId: agentInvite.id },
      headers: agentUser.headers,
    });

    const otherOrg = (await auth.api.createOrganization({
      body: { name: "Other", slug: `${RUN}-other` },
      headers: outsider.headers,
    })) as { id: string };
    otherOrganizationId = otherOrg.id;
    const otherTeam = await auth.api.createTeam({
      body: { name: "Other team", organizationId: otherOrganizationId },
      headers: outsider.headers,
    });
    otherTeamId = otherTeam.id;

    const pendingInvite = await auth.api.createInvitation({
      body: { email: `pending@${DOMAIN}`, role: "admin", organizationId },
      headers: owner.headers,
    });
    pendingInvitationId = pendingInvite.id;
    const cancelledInvite = await auth.api.createInvitation({
      body: { email: `cancelled@${DOMAIN}`, role: "admin", organizationId },
      headers: owner.headers,
    });
    cancelledInvitationId = cancelledInvite.id;
    await auth.api.cancelInvitation({
      body: { invitationId: cancelledInvitationId },
      headers: owner.headers,
    });

    await db
      .update(user)
      .set({ role: "platform_admin" })
      .where(eq(user.id, platformUser.user.id));
    platformUser = {
      ...platformUser,
      headers: (await signIn(platformUser.user.email)).headers,
    };

    await db.insert(call).values([
      {
        id: `${RUN}-call-agent`,
        organizationId,
        agentId: agentUser.user.id,
        direction: "inbound",
        status: "completed",
      },
      {
        id: `${RUN}-call-admin`,
        organizationId,
        agentId: adminUser.user.id,
        direction: "outbound",
        status: "completed",
      },
      {
        id: `${RUN}-call-other`,
        organizationId: otherOrganizationId,
        agentId: doomedUser.user.id,
        direction: "inbound",
        status: "completed",
      },
    ]);
    await db.insert(recording).values([
      {
        id: `${RUN}-rec-agent`,
        organizationId,
        callId: `${RUN}-call-agent`,
        agentId: agentUser.user.id,
        url: "https://example.test/agent.wav",
      },
      {
        id: `${RUN}-rec-admin`,
        organizationId,
        callId: `${RUN}-call-admin`,
        agentId: adminUser.user.id,
        url: "https://example.test/admin.wav",
      },
    ]);
  });

  afterAll(async () => {
    await db.delete(organization).where(like(organization.slug, `${RUN}-%`));
    await db.delete(user).where(like(user.email, `%@${DOMAIN}`));
    if (numberIds.length > 0) {
      await db
        .delete(outboundNumber)
        .where(inArray(outboundNumber.id, numberIds));
    }
    await db.$client.end();
  });

  test("unauthenticated call is unauthorized", async () => {
    const client = clientFor(null);
    await expect(
      client.organization.directory({ organizationId })
    ).rejects.toBeDefined();
  });

  test("missing organization is a bad request", async () => {
    const client = clientFor(await getSession(owner.headers));
    await expect(
      client.organization.directory({ organizationId: "" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("non-member is forbidden", async () => {
    const client = clientFor(await getSession(outsider.headers));
    await expect(
      client.organization.directory({ organizationId })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  test("owner and admin read the directory, agent is forbidden", async () => {
    const ownerClient = clientFor(await getSession(owner.headers));
    const adminClient = clientFor(await getSession(adminUser.headers));
    const agentClient = clientFor(await getSession(agentUser.headers));
    const rows = await ownerClient.organization.directory({ organizationId });
    expect(rows.length).toBe(3);
    expect(rows.map((row) => row.role).sort()).toEqual([
      "admin",
      "agent",
      "owner",
    ]);
    const agentRow = rows.find((row) => row.userId === agentUser.user.id);
    expect(agentRow?.teams).toEqual(["Support"]);
    expect(agentRow?.email).toBe(agentUser.user.email);
    expect(
      (await adminClient.organization.directory({ organizationId })).length
    ).toBe(3);
    await expect(
      agentClient.organization.directory({ organizationId })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  test("directory never includes another organization's members", async () => {
    const outsiderClient = clientFor(await getSession(outsider.headers));
    const rows = await outsiderClient.organization.directory({
      organizationId: otherOrganizationId,
    });
    expect(rows.map((row) => row.userId)).toEqual([outsider.user.id]);
    await expect(
      outsiderClient.organization.directory({ organizationId })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("pending invitations carry role, team, and expiry", async () => {
    const ownerClient = clientFor(await getSession(owner.headers));
    const rows = await ownerClient.organization.invitations({
      organizationId,
    });
    expect(rows.map((row) => row.id)).toEqual([pendingInvitationId]);
    expect(rows[0]?.email).toBe(`pending@${DOMAIN}`);
    expect(rows[0]?.role).toBe("admin");
    expect(rows[0]?.teamName).toBeNull();
    expect(rows[0]?.expiresAt).toBeInstanceOf(Date);
    const stored = await db
      .select({ status: invitation.status })
      .from(invitation)
      .where(eq(invitation.id, cancelledInvitationId));
    expect(stored[0]?.status).toBe("canceled");
  });

  test("invitation reads reject another organization", async () => {
    const outsiderClient = clientFor(await getSession(outsider.headers));
    await expect(
      outsiderClient.organization.invitations({ organizationId })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("teams are scoped to the resolved organization", async () => {
    const ownerClient = clientFor(await getSession(owner.headers));
    const rows = await ownerClient.organization.teams({ organizationId });
    expect(rows.map((row) => row.id)).toEqual([teamId]);
    expect(rows[0]?.memberCount).toBe(1);
    expect(rows[0]?.createdAt).toBeInstanceOf(Date);
    const outsiderClient = clientFor(await getSession(outsider.headers));
    await expect(
      outsiderClient.organization.teams({ organizationId })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("team roster returns agents and rejects a foreign team id", async () => {
    const ownerClient = clientFor(await getSession(owner.headers));
    const rows = await ownerClient.organization.teamMembers({
      organizationId,
      teamId,
    });
    expect(rows.map((row) => row.email)).toEqual([agentUser.user.email]);
    await expect(
      ownerClient.organization.teamMembers({
        organizationId,
        teamId: otherTeamId,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("agent sees only its own calls; owner sees the organization's", async () => {
    const agentClient = clientFor(await getSession(agentUser.headers));
    const ownerClient = clientFor(await getSession(owner.headers));
    const agentCalls = await agentClient.calls.calls({
      organizationId,
      limit: 50,
    });
    expect(agentCalls.map((row) => row.id)).toEqual([`${RUN}-call-agent`]);
    const ownerCalls = await ownerClient.calls.calls({
      organizationId,
      limit: 50,
    });
    expect(ownerCalls.length).toBe(2);
    const agentRecordings = await agentClient.calls.recordings({
      organizationId,
      limit: 50,
    });
    expect(agentRecordings.map((row) => row.id)).toEqual([`${RUN}-rec-agent`]);
  });

  test("cross-tenant update affects no rows", async () => {
    const scope = organizationScope(otherOrganizationId);
    const updated = await db
      .update(call)
      .set({ status: "hijacked" })
      .where(
        and(scope.filter(call.organizationId), eq(call.id, `${RUN}-call-agent`))
      )
      .returning({ id: call.id });
    expect(updated).toEqual([]);
  });

  test("platform listing spans tenants the caller does not belong to", async () => {
    const client = clientFor(await getSession(platformUser.headers));
    const result = await client.platform.listOrganizations({
      page: 1,
      pageSize: 100,
    });
    const ids = result.items.map((item) => item.id);
    expect(ids).toContain(organizationId);
    expect(ids).toContain(otherOrganizationId);
    const acme = result.items.find((item) => item.id === organizationId);
    expect(acme?.memberCount).toBe(3);
    expect(acme?.status).toBe("active");
  });

  test("suspension blocks tenant procedures until restore", async () => {
    const platformClient = clientFor(await getSession(platformUser.headers));
    const ownerClient = clientFor(await getSession(owner.headers));
    await platformClient.platform.suspendOrganization({
      organizationId,
      reason: "non-payment",
    });
    await expect(
      ownerClient.calls.calls({ organizationId, limit: 50 })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await platformClient.platform.restoreOrganization({ organizationId });
    expect(
      (await ownerClient.calls.calls({ organizationId, limit: 50 })).length
    ).toBe(2);
  });

  test("owner, admin, and agent are rejected from platform procedures", async () => {
    const rejections = await Promise.all(
      [owner, adminUser, agentUser].map(async (account) => {
        const client = clientFor(await getSession(account.headers));
        return client.platform
          .listOrganizations({ page: 1, pageSize: 10 })
          .then(
            () => "allowed",
            (error: { code?: string }) => error.code ?? "unknown"
          );
      })
    );
    expect(rejections).toEqual(["FORBIDDEN", "FORBIDDEN", "FORBIDDEN"]);
  });

  test("deleting an organization cascades and audits", async () => {
    const platformClient = clientFor(await getSession(platformUser.headers));
    const doomedClient = clientFor(await getSession(doomedUser.headers));
    const created = (await auth.api.createOrganization({
      body: { name: "Doomed", slug: `${RUN}-doomed` },
      headers: doomedUser.headers,
    })) as { id: string };
    await db.insert(call).values({
      id: `${RUN}-call-doomed`,
      organizationId: created.id,
      agentId: doomedUser.user.id,
      direction: "inbound",
      status: "completed",
    });
    await db.insert(doNotDialEntry).values({
      id: `${RUN}-dnc-doomed`,
      organizationId: created.id,
      e164Number: "+14155550177",
    });

    const before = auditEvents.length;
    await platformClient.platform.deleteOrganization({
      organizationId: created.id,
    });

    expect(
      await db
        .select()
        .from(member)
        .where(eq(member.organizationId, created.id))
    ).toEqual([]);
    expect(
      await db.select().from(call).where(eq(call.organizationId, created.id))
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(doNotDialEntry)
        .where(eq(doNotDialEntry.organizationId, created.id))
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(organization)
        .where(eq(organization.id, created.id))
    ).toEqual([]);
    const event = auditEvents
      .slice(before)
      .find((row) => row.action === "organization.delete");
    expect(event?.target).toEqual({ type: "organization", id: created.id });

    // the owner keeps a session but has no organization left
    await expect(doomedClient.organization.me()).resolves.toMatchObject({
      membership: null,
    });
  });

  test("impersonation is marked, time-limited, and rejects platform admins", async () => {
    const platformHeaders = platformUser.headers;
    const platformSession = await getSession(platformHeaders);
    expect(platformSession.user.role).toBe("platform_admin");
    const started = (await auth.api.impersonateUser({
      body: { userId: agentUser.user.id },
      headers: platformHeaders,
      returnHeaders: true,
    })) as {
      headers: Headers;
      response: {
        session: { createdAt: Date; expiresAt: Date; impersonatedBy?: string };
      };
    };
    expect(started.response.session.impersonatedBy).toBe(platformUser.user.id);
    const durationSeconds =
      (new Date(started.response.session.expiresAt).getTime() -
        new Date(started.response.session.createdAt).getTime()) /
      1000;
    expect(durationSeconds).toBeLessThanOrEqual(3600);
    expect(durationSeconds).toBeGreaterThan(3500);

    const impersonatedSession = await getSession(
      new Headers({ cookie: cookieHeader(started.headers) })
    );
    expect(impersonatedSession.session.impersonatedBy).toBe(
      platformUser.user.id
    );

    const stopped = await auth.api.stopImpersonating({
      headers: new Headers({ cookie: cookieHeader(started.headers) }),
      returnHeaders: true,
    });
    expect(stopped.response.session.userId).toBe(platformUser.user.id);

    await expect(
      auth.api.impersonateUser({
        body: { userId: platformUser.user.id },
        headers: platformHeaders,
      })
    ).rejects.toBeDefined();

    const actions = auditEvents.map((event) => event.action);
    expect(actions).toContain("impersonation.start");
    expect(actions).toContain("impersonation.stop");
  });

  test("leads: owners and admins manage lists and agents are denied", async () => {
    const ownerClient = clientFor(await getSession(owner.headers));
    const adminClient = clientFor(await getSession(adminUser.headers));
    const agentClient = clientFor(await getSession(agentUser.headers));
    const outsiderClient = clientFor(await getSession(outsider.headers));

    const created = await ownerClient.leads.createLeadList({
      organizationId,
      name: "November prospects",
      description: "Q4 outreach",
    });
    leadListId = created.id;
    const adminList = await adminClient.leads.createLeadList({
      organizationId,
      name: "Admin list",
    });

    const rows = await ownerClient.leads.listLeadLists({ organizationId });
    expect(rows.map((row) => row.name)).toContain("November prospects");
    expect(rows.find((row) => row.id === leadListId)?.leadCount).toBe(0);

    await expect(
      agentClient.leads.createLeadList({
        organizationId,
        name: "Denied",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      agentClient.leads.listLeadLists({ organizationId })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      outsiderClient.leads.getLeadList({
        organizationId: otherOrganizationId,
        listId: leadListId,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await ownerClient.leads.updateLeadList({
      organizationId,
      listId: leadListId,
      name: "November prospects v2",
      description: null,
    });
    const updated = (
      await ownerClient.leads.listLeadLists({ organizationId })
    ).find((row) => row.id === leadListId);
    expect(updated?.name).toBe("November prospects v2");
    expect(updated?.description).toBeNull();
    await adminClient.leads.archiveLeadList({
      organizationId,
      listId: adminList.id,
    });
    const lists = await ownerClient.leads.listLeadLists({ organizationId });
    expect(
      lists.find((row) => row.id === adminList.id)?.archivedAt
    ).not.toBeNull();
  });

  test("leads: E.164 normalization, duplicate rejection, and re-add", async () => {
    const ownerClient = clientFor(await getSession(owner.headers));

    const added = await ownerClient.leads.addLead({
      organizationId,
      listId: leadListId,
      phone: "+1 (415) 555-0123",
      name: "Alice",
    });
    expect(added.phone).toBe("+14155550123");

    await expect(
      ownerClient.leads.addLead({
        organizationId,
        listId: leadListId,
        phone: "4155550124",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await expect(
      ownerClient.leads.addLead({
        organizationId,
        listId: leadListId,
        phone: "+14155550123",
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await ownerClient.leads.removeLead({
      organizationId,
      listId: leadListId,
      leadId: added.id,
    });
    const readded = await ownerClient.leads.addLead({
      organizationId,
      listId: leadListId,
      phone: "001 415 555 0123",
    });
    expect(readded.id).not.toBe(added.id);
    expect(readded.phone).toBe("+14155550123");
    const records = await db
      .select()
      .from(lead)
      .where(eq(lead.listId, leadListId));
    expect(records.length).toBe(2);
    expect(records.filter((row) => row.removedAt !== null).length).toBe(1);
  });

  test("leads: CSV import reports one outcome per row and persists valid rows", async () => {
    const ownerClient = clientFor(await getSession(owner.headers));
    const before = auditEvents.length;

    const csv = [
      "phone,name",
      "+14155550131,Alice",
      "+14155550131,Bob",
      "4155550132,No country",
      "+14155550133,Carol",
      '+1 (415) 555-0134,"Dana, Jr."',
      "+14155550123,Existing",
    ].join("\n");
    const results = await ownerClient.leads.importLeads({
      organizationId,
      listId: leadListId,
      csv,
    });

    expect(results.map((row) => row.line)).toEqual([2, 3, 4, 5, 6, 7]);
    expect(results.map((row) => row.status)).toEqual([
      "imported",
      "repeated",
      "invalid",
      "imported",
      "imported",
      "existing",
    ]);
    expect(results[4]?.name).toBe("Dana, Jr.");
    expect(results[2]?.reason).toContain("E.164");

    const list = await ownerClient.leads.getLeadList({
      organizationId,
      listId: leadListId,
    });
    expect(list.leads.map((row) => row.phone).sort()).toEqual([
      "+14155550123",
      "+14155550131",
      "+14155550133",
      "+14155550134",
    ]);

    const events = auditEvents.slice(before);
    const event = events.find((row) => row.action === "lead_list.import");
    expect(event?.actorId).toBe(owner.user.id);
    expect(event?.target).toEqual({
      type: "lead_list",
      id: leadListId,
      organizationId,
    });
    expect(event?.reason).toBe("imported=3 invalid=1 existing=1 repeated=1");
    expect(event?.reason).not.toContain("4155550");
  });

  test("leads: concurrent imports resolve duplicates through the database", async () => {
    const ownerClient = clientFor(await getSession(owner.headers));
    const csv = ["phone", "+14155550141", "+14155550142"].join("\n");
    const [first, second] = await Promise.all([
      ownerClient.leads.importLeads({
        organizationId,
        listId: leadListId,
        csv,
      }),
      ownerClient.leads.importLeads({
        organizationId,
        listId: leadListId,
        csv,
      }),
    ]);
    const statuses = [...first, ...second].map((row) => row.status);
    expect(statuses.filter((status) => status === "imported").length).toBe(2);
    expect(statuses.filter((status) => status === "existing").length).toBe(2);

    const list = await ownerClient.leads.getLeadList({
      organizationId,
      listId: leadListId,
    });
    expect(
      list.leads.filter((row) => row.phone.startsWith("+1415555014")).length
    ).toBe(2);
  });

  test("leads: archived lists and removed leads leave active setup options", async () => {
    const ownerClient = clientFor(await getSession(owner.headers));
    const created = await ownerClient.leads.createLeadList({
      organizationId,
      name: "Archive me",
    });
    const kept = await ownerClient.leads.addLead({
      organizationId,
      listId: created.id,
      phone: "+14155550151",
    });
    const removed = await ownerClient.leads.addLead({
      organizationId,
      listId: created.id,
      phone: "+14155550152",
    });
    await ownerClient.leads.removeLead({
      organizationId,
      listId: created.id,
      leadId: removed.id,
    });

    const activeLeads = await ownerClient.leads.listActiveLeads({
      organizationId,
      listId: created.id,
    });
    expect(activeLeads.map((row) => row.id)).toEqual([kept.id]);

    await ownerClient.leads.archiveLeadList({
      organizationId,
      listId: created.id,
    });
    const activeLists = await ownerClient.leads.listActiveLeadLists({
      organizationId,
    });
    expect(activeLists.map((row) => row.id)).not.toContain(created.id);
    await expect(
      ownerClient.leads.listActiveLeads({
        organizationId,
        listId: created.id,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      ownerClient.leads.addLead({
        organizationId,
        listId: created.id,
        phone: "+14155550153",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const detail = await ownerClient.leads.getLeadList({
      organizationId,
      listId: created.id,
    });
    expect(detail.archivedAt).toBeInstanceOf(Date);
    expect(detail.leads.map((row) => row.id)).toEqual([kept.id]);
    const retained = await db
      .select()
      .from(lead)
      .where(eq(lead.id, removed.id));
    expect(retained[0]?.removedAt).toBeInstanceOf(Date);
  });

  test("dispositions: owners and admins manage, agents denied", async () => {
    const ownerClient = clientFor(await getSession(owner.headers));
    const adminClient = clientFor(await getSession(adminUser.headers));
    const agentClient = clientFor(await getSession(agentUser.headers));
    const outsiderClient = clientFor(await getSession(outsider.headers));

    const created = await ownerClient.dispositions.createDispositionList({
      organizationId,
      name: "Call outcomes",
      description: "Initial set",
    });
    dispositionListId = created.id;

    const read = await adminClient.dispositions.getDispositionList({
      organizationId,
      listId: dispositionListId,
    });
    expect(read.name).toBe("Call outcomes");
    expect(read.entries).toEqual([]);

    await adminClient.dispositions.updateDispositionList({
      organizationId,
      listId: dispositionListId,
      name: "Call outcomes v2",
      description: null,
    });
    const updated = await ownerClient.dispositions.getDispositionList({
      organizationId,
      listId: dispositionListId,
    });
    expect(updated.name).toBe("Call outcomes v2");
    expect(updated.description).toBeNull();

    const rows = await ownerClient.dispositions.listDispositionLists({
      organizationId,
    });
    expect(rows.map((row) => row.id)).toContain(dispositionListId);

    await expect(
      agentClient.dispositions.createDispositionList({
        organizationId,
        name: "Denied",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      agentClient.dispositions.listDispositionLists({ organizationId })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const outsiderCode = await outsiderClient.dispositions
      .getDispositionList({
        organizationId: otherOrganizationId,
        listId: dispositionListId,
      })
      .then(
        () => "allowed",
        (error: { code?: string }) => error.code ?? "unknown"
      );
    expect(["FORBIDDEN", "NOT_FOUND"]).toContain(outsiderCode);
  });

  test("dispositions: codes are validated and unique within a list", async () => {
    const ownerClient = clientFor(await getSession(owner.headers));

    const added = await ownerClient.dispositions.addDispositionEntry({
      organizationId,
      listId: dispositionListId,
      code: "NOT_INTERESTED",
      label: "Not interested",
    });
    dispositionEntryId = added.id;
    expect(added).toEqual({
      id: dispositionEntryId,
      code: "NOT_INTERESTED",
      label: "Not interested",
    });

    await expect(
      ownerClient.dispositions.addDispositionEntry({
        organizationId,
        listId: dispositionListId,
        code: "not_interested",
        label: "Lowercase",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      ownerClient.dispositions.addDispositionEntry({
        organizationId,
        listId: dispositionListId,
        code: "NOT_INTERESTED",
        label: "Duplicate code",
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      ownerClient.dispositions.addDispositionEntry({
        organizationId,
        listId: dispositionListId,
        code: "CALLBACK",
        label: "Not interested",
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const callback = await ownerClient.dispositions.addDispositionEntry({
      organizationId,
      listId: dispositionListId,
      code: "CALLBACK",
      label: "Callback later",
    });
    dispositionCallbackId = callback.id;

    expect("updateDispositionEntry" in ownerClient.dispositions).toBe(false);
    expect("deleteDispositionEntry" in ownerClient.dispositions).toBe(false);
  });

  test("dispositions: retirement is historical, archive hides", async () => {
    const ownerClient = clientFor(await getSession(owner.headers));

    const before = await ownerClient.dispositions.listActiveDispositionEntries({
      organizationId,
      listId: dispositionListId,
    });
    expect(before.map((row) => row.id).sort()).toEqual(
      [dispositionEntryId, dispositionCallbackId].sort()
    );

    await ownerClient.dispositions.retireDispositionEntry({
      organizationId,
      listId: dispositionListId,
      entryId: dispositionEntryId,
    });

    const active = await ownerClient.dispositions.listActiveDispositionEntries({
      organizationId,
      listId: dispositionListId,
    });
    expect(active.map((row) => row.id)).toEqual([dispositionCallbackId]);

    const lists = await ownerClient.dispositions.listDispositionLists({
      organizationId,
    });
    expect(lists.find((row) => row.id === dispositionListId)?.entryCount).toBe(
      1
    );

    const detail = await ownerClient.dispositions.getDispositionList({
      organizationId,
      listId: dispositionListId,
    });
    const retired = detail.entries.find(
      (entry) => entry.id === dispositionEntryId
    );
    expect(retired?.retiredAt).toBeInstanceOf(Date);
    expect(retired?.code).toBe("NOT_INTERESTED");
    expect(retired?.label).toBe("Not interested");

    const historical = await ownerClient.dispositions.getDispositionEntry({
      organizationId,
      entryId: dispositionEntryId,
    });
    expect(historical).toMatchObject({
      id: dispositionEntryId,
      listId: dispositionListId,
      code: "NOT_INTERESTED",
      label: "Not interested",
      listArchivedAt: null,
    });
    expect(historical.retiredAt).toBeInstanceOf(Date);
    expect(historical.createdAt).toBeInstanceOf(Date);

    await expect(
      ownerClient.dispositions.addDispositionEntry({
        organizationId,
        listId: dispositionListId,
        code: "NOT_INTERESTED",
        label: "Reusing a retired code",
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await ownerClient.dispositions.archiveDispositionList({
      organizationId,
      listId: dispositionListId,
    });
    const activeLists =
      await ownerClient.dispositions.listActiveDispositionLists({
        organizationId,
      });
    expect(activeLists.map((row) => row.id)).not.toContain(dispositionListId);
    const noActiveEntries =
      await ownerClient.dispositions.listActiveDispositionEntries({
        organizationId,
        listId: dispositionListId,
      });
    expect(noActiveEntries).toEqual([]);
    await expect(
      ownerClient.dispositions.addDispositionEntry({
        organizationId,
        listId: dispositionListId,
        code: "AFTER_ARCHIVE",
        label: "Too late",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const archivedDetail = await ownerClient.dispositions.getDispositionList({
      organizationId,
      listId: dispositionListId,
    });
    expect(archivedDetail.archivedAt).toBeInstanceOf(Date);
    const archivedHistorical =
      await ownerClient.dispositions.getDispositionEntry({
        organizationId,
        entryId: dispositionEntryId,
      });
    expect(archivedHistorical.listArchivedAt).toBeInstanceOf(Date);
  });

  test("dispositions: every change is audited against the list", async () => {
    const expected = [
      { action: "disposition_list.create", actorId: owner.user.id },
      { action: "disposition_list.update", actorId: adminUser.user.id },
      { action: "disposition_list.entry_add", actorId: owner.user.id },
      { action: "disposition_list.entry_retire", actorId: owner.user.id },
      { action: "disposition_list.archive", actorId: owner.user.id },
    ] as const;
    for (const { action, actorId } of expected) {
      const event = auditEvents.find(
        (row) =>
          row.action === action &&
          row.target.id === dispositionListId &&
          row.target.organizationId === organizationId
      );
      expect(event).toBeDefined();
      expect(event?.actorId).toBe(actorId);
      expect(event?.target.type).toBe("disposition_list");
    }
  });

  test("numbers: platform registers inventory, duplicates rejected", async () => {
    const platformClient = clientFor(await getSession(platformUser.headers));
    const ownerClient = clientFor(await getSession(owner.headers));

    const created = await platformClient.platform.registerOutboundNumber({
      number: "+1 (415) 555-0191",
    });
    numberId = created.id;
    numberIds.push(created.id);
    expect(created.number).toBe("+14155550191");

    await expect(
      platformClient.platform.registerOutboundNumber({
        number: "+14155550191",
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await expect(
      platformClient.platform.registerOutboundNumber({ number: "4155550192" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await expect(
      ownerClient.platform.listOutboundNumbers()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await platformClient.platform.setOutboundNumberEnabled({
      numberId,
      enabled: false,
    });
    const listed = await platformClient.platform.listOutboundNumbers();
    expect(listed.find((row) => row.id === numberId)?.enabled).toBe(false);
    await platformClient.platform.setOutboundNumberEnabled({
      numberId,
      enabled: true,
    });
  });

  test("numbers: assignment is exclusive and org deletion keeps inventory", async () => {
    const platformClient = clientFor(await getSession(platformUser.headers));

    const assigned = await platformClient.platform.assignOutboundNumber({
      numberId,
      organizationId,
    });
    expect(assigned?.organizationId).toBe(organizationId);
    await expect(
      platformClient.platform.assignOutboundNumber({
        numberId,
        organizationId: otherOrganizationId,
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const listed = await platformClient.platform.listOutboundNumbers();
    expect(
      listed.find((row) => row.id === numberId)?.assignedOrganizationId
    ).toBe(organizationId);
    expect(
      listed.find((row) => row.id === numberId)?.assignedOrganizationName
    ).toBe("Acme");

    const tempOrg = (await auth.api.createOrganization({
      body: { name: "Numbers doomed", slug: `${RUN}-numbers-doomed` },
      headers: doomedUser.headers,
    })) as { id: string };
    const second = await platformClient.platform.registerOutboundNumber({
      number: "+14155550192",
    });
    numberIds.push(second.id);
    await platformClient.platform.assignOutboundNumber({
      numberId: second.id,
      organizationId: tempOrg.id,
    });
    await platformClient.platform.deleteOrganization({
      organizationId: tempOrg.id,
    });
    expect(
      await db
        .select()
        .from(outboundNumberAssignment)
        .where(eq(outboundNumberAssignment.organizationId, tempOrg.id))
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(outboundNumber)
        .where(eq(outboundNumber.id, second.id))
    ).toHaveLength(1);

    await platformClient.platform.unassignOutboundNumber({ numberId });
    const afterUnassign = await platformClient.platform.listOutboundNumbers();
    expect(
      afterUnassign.find((row) => row.id === numberId)?.assignedOrganizationId
    ).toBeNull();
  });

  test("numbers: eligible read filters and denies agents", async () => {
    const platformClient = clientFor(await getSession(platformUser.headers));
    const ownerClient = clientFor(await getSession(owner.headers));
    const adminClient = clientFor(await getSession(adminUser.headers));
    const agentClient = clientFor(await getSession(agentUser.headers));
    const outsiderClient = clientFor(await getSession(outsider.headers));

    await platformClient.platform.assignOutboundNumber({
      numberId,
      organizationId,
    });
    const disabled = await platformClient.platform.registerOutboundNumber({
      number: "+14155550193",
    });
    numberIds.push(disabled.id);
    await platformClient.platform.assignOutboundNumber({
      numberId: disabled.id,
      organizationId,
    });
    await platformClient.platform.setOutboundNumberEnabled({
      numberId: disabled.id,
      enabled: false,
    });
    const foreign = await platformClient.platform.registerOutboundNumber({
      number: "+14155550194",
    });
    numberIds.push(foreign.id);
    await platformClient.platform.assignOutboundNumber({
      numberId: foreign.id,
      organizationId: otherOrganizationId,
    });

    expect(
      (
        await ownerClient.numbers.listEligibleOutboundNumbers({
          organizationId,
        })
      ).map((row) => row.number)
    ).toEqual(["+14155550191"]);
    expect(
      (
        await adminClient.numbers.listEligibleOutboundNumbers({
          organizationId,
        })
      ).length
    ).toBe(1);
    await expect(
      agentClient.numbers.listEligibleOutboundNumbers({ organizationId })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      outsiderClient.numbers.listEligibleOutboundNumbers({ organizationId })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await platformClient.platform.setOutboundNumberEnabled({
      numberId,
      enabled: false,
    });
    expect(
      await ownerClient.numbers.listEligibleOutboundNumbers({ organizationId })
    ).toEqual([]);
  });

  test("do-not-dial: owners and admins manage, agents are denied", async () => {
    const ownerClient = clientFor(await getSession(owner.headers));
    const adminClient = clientFor(await getSession(adminUser.headers));
    const agentClient = clientFor(await getSession(agentUser.headers));

    const added = await ownerClient.doNotDial.addDoNotDialEntry({
      organizationId,
      number: "+14155550181",
    });
    expect(added.number).toBe("+14155550181");
    expect(
      (
        await adminClient.doNotDial.listDoNotDialEntries({ organizationId })
      ).map((row) => row.number)
    ).toEqual(["+14155550181"]);
    await expect(
      agentClient.doNotDial.listDoNotDialEntries({ organizationId })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      agentClient.doNotDial.addDoNotDialEntry({
        organizationId,
        number: "+14155550182",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      agentClient.doNotDial.removeDoNotDialEntry({
        organizationId,
        entryId: added.id,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("do-not-dial: numbers are normalized and duplicates stay single rows", async () => {
    const ownerClient = clientFor(await getSession(owner.headers));

    const normalized = await ownerClient.doNotDial.addDoNotDialEntry({
      organizationId,
      number: "001 (415) 555-0183",
    });
    expect(normalized.number).toBe("+14155550183");
    const repeated = await ownerClient.doNotDial.addDoNotDialEntry({
      organizationId,
      number: "+1 415 555 0183",
    });
    expect(repeated).toEqual(normalized);
    const rows = await ownerClient.doNotDial.listDoNotDialEntries({
      organizationId,
    });
    expect(rows.filter((row) => row.number === "+14155550183")).toHaveLength(1);
    await expect(
      ownerClient.doNotDial.addDoNotDialEntry({
        organizationId,
        number: "4155550184",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      ownerClient.doNotDial.addDoNotDialEntry({
        organizationId,
        number: "+04",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("do-not-dial: lookup is scoped to the resolved organization", async () => {
    const ownerClient = clientFor(await getSession(owner.headers));
    const agentClient = clientFor(await getSession(agentUser.headers));
    const outsiderClient = clientFor(await getSession(outsider.headers));

    await ownerClient.doNotDial.addDoNotDialEntry({
      organizationId,
      number: "+14155550185",
    });
    await outsiderClient.doNotDial.addDoNotDialEntry({
      organizationId: otherOrganizationId,
      number: "+14155550185",
    });

    expect(
      await agentClient.doNotDial.checkDoNotDialNumber({
        organizationId,
        number: "+1 (415) 555-0185",
      })
    ).toEqual({ suppressed: true });
    expect(
      await ownerClient.doNotDial.checkDoNotDialNumber({
        organizationId,
        number: "+14155550186",
      })
    ).toEqual({ suppressed: false });
    expect(
      await outsiderClient.doNotDial.checkDoNotDialNumber({
        organizationId: otherOrganizationId,
        number: "+14155550181",
      })
    ).toEqual({ suppressed: false });
    await expect(
      outsiderClient.doNotDial.checkDoNotDialNumber({
        organizationId,
        number: "+14155550185",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      ownerClient.doNotDial.checkDoNotDialNumber({
        organizationId,
        number: "not a number",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("do-not-dial: removal is tenant-owned and removes one entry", async () => {
    const ownerClient = clientFor(await getSession(owner.headers));
    const outsiderClient = clientFor(await getSession(outsider.headers));

    const added = await ownerClient.doNotDial.addDoNotDialEntry({
      organizationId,
      number: "+14155550187",
    });
    const foreign = await outsiderClient.doNotDial.addDoNotDialEntry({
      organizationId: otherOrganizationId,
      number: "+14155550188",
    });

    await expect(
      ownerClient.doNotDial.removeDoNotDialEntry({
        organizationId,
        entryId: foreign.id,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(
      (
        await outsiderClient.doNotDial.listDoNotDialEntries({
          organizationId: otherOrganizationId,
        })
      ).map((row) => row.number)
    ).toContain("+14155550188");

    await ownerClient.doNotDial.removeDoNotDialEntry({
      organizationId,
      entryId: added.id,
    });
    expect(
      (
        await ownerClient.doNotDial.listDoNotDialEntries({ organizationId })
      ).map((row) => row.number)
    ).not.toContain("+14155550187");
    await expect(
      ownerClient.doNotDial.removeDoNotDialEntry({
        organizationId,
        entryId: added.id,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
