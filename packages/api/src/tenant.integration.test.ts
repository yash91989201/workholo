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
import { and, eq, like } from "drizzle-orm";

import { appRouter } from "./routers/index";
import { organizationScope } from "./tenant";

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
  return createRouterClient(appRouter, { context: { db, session, audit } });
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
});
