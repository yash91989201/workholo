import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createDb, type Database } from "@workholo/db";
import {
  invitation,
  member,
  organization,
  team,
  teamMember,
  user,
} from "@workholo/db/schema/auth";
import { and, eq, like } from "drizzle-orm";

import { createAuth } from "./index";
import type { InvitationEmail } from "./mailer";

const RUN = `t${Date.now()}`;
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

let db: Database;
const mail: InvitationEmail[] = [];

let instance: ReturnType<typeof createAuth>;

async function signUp(name: string) {
  const result = await instance.api.signUpEmail({
    body: { email: `${name}@${DOMAIN}`, password: PASSWORD, name },
    returnHeaders: true,
  });
  const cookie = result.headers.get("set-cookie") ?? "";
  return {
    headers: new Headers({ cookie }),
    userId: result.response.user.id,
    email: result.response.user.email,
  };
}

async function createOrg(headers: Headers, slug: string) {
  const org = (await instance.api.createOrganization({
    body: { name: slug, slug: `${RUN}-${slug}` },
    headers,
  })) as { id: string };
  return org.id;
}

describe("organization invariants", () => {
  let owner: Awaited<ReturnType<typeof signUp>>;
  let adminUser: Awaited<ReturnType<typeof signUp>>;
  let agentUser: Awaited<ReturnType<typeof signUp>>;
  let outsider: Awaited<ReturnType<typeof signUp>>;
  let organizationId = "";
  let secondOrganizationId = "";
  let teamId = "";

  beforeAll(async () => {
    db = createDb({ DATABASE_URL: databaseUrl() });
    instance = createAuth(env, db, {
      mailer: {
        sendInvitation: async (message) => {
          mail.push(message);
        },
      },
    });
    owner = await signUp("owner");
    adminUser = await signUp("admin");
    agentUser = await signUp("agent");
    outsider = await signUp("outsider");
    organizationId = await createOrg(owner.headers, "acme");
  });

  afterAll(async () => {
    await db.delete(organization).where(like(organization.slug, `${RUN}-%`));
    await db.delete(user).where(like(user.email, `%@${DOMAIN}`));
    await db.$client.end();
  });

  test("owner creates the organization as owner", async () => {
    const rows = await db
      .select({ role: member.role })
      .from(member)
      .where(eq(member.organizationId, organizationId));
    expect(rows.map((row) => row.role)).toEqual(["owner"]);
  });

  test("owner invites admin with a console link; admin accepts", async () => {
    const created = await instance.api.createInvitation({
      body: { email: adminUser.email, role: "admin", organizationId },
      headers: owner.headers,
    });
    const last = mail.at(-1);
    expect(last?.role).toBe("admin");
    expect(
      last?.url.startsWith("http://localhost:3003/accept-invitation?id=")
    ).toBe(true);
    await instance.api.acceptInvitation({
      body: { invitationId: created.id },
      headers: adminUser.headers,
    });
    const role = await db
      .select({ role: member.role })
      .from(member)
      .where(eq(member.userId, adminUser.userId));
    expect(role[0]?.role).toBe("admin");
  });

  test("admin creates a team", async () => {
    const created = await instance.api.createTeam({
      body: { name: "Support", organizationId },
      headers: adminUser.headers,
    });
    teamId = created.id;
    const rows = await db
      .select({ name: team.name, organizationId: team.organizationId })
      .from(team)
      .where(eq(team.id, teamId));
    expect(rows[0]?.name).toBe("Support");
    expect(rows[0]?.organizationId).toBe(organizationId);
  });

  test("admin invites agent with an agent-panel link", async () => {
    const created = await instance.api.createInvitation({
      body: { email: agentUser.email, role: "agent", teamId, organizationId },
      headers: adminUser.headers,
    });
    const last = mail.at(-1);
    expect(last?.role).toBe("agent");
    expect(
      last?.url.startsWith("http://localhost:3004/accept-invitation?id=")
    ).toBe(true);
    await instance.api.acceptInvitation({
      body: { invitationId: created.id },
      headers: agentUser.headers,
    });
    const teamRows = await db
      .select({ id: teamMember.id })
      .from(teamMember)
      .where(eq(teamMember.userId, agentUser.userId));
    expect(teamRows).toHaveLength(1);
  });

  test("admin cannot invite another admin", async () => {
    await expect(
      instance.api.createInvitation({
        body: { email: `admin2@${DOMAIN}`, role: "admin", organizationId },
        headers: adminUser.headers,
      })
    ).rejects.toBeDefined();
  });

  test("nobody can invite the owner role", async () => {
    await expect(
      instance.api.createInvitation({
        body: { email: `admin3@${DOMAIN}`, role: "owner", organizationId },
        headers: owner.headers,
      })
    ).rejects.toBeDefined();
  });

  test("agent cannot invite anyone", async () => {
    await expect(
      instance.api.createInvitation({
        body: { email: `agent2@${DOMAIN}`, role: "agent", organizationId },
        headers: agentUser.headers,
      })
    ).rejects.toBeDefined();
  });

  test("admin cannot remove another admin or the owner", async () => {
    await expect(
      instance.api.removeMember({
        body: { memberIdOrEmail: owner.email, organizationId },
        headers: adminUser.headers,
      })
    ).rejects.toBeDefined();
  });

  test("last owner cannot be demoted", async () => {
    const ownerMember = await db
      .select({ id: member.id })
      .from(member)
      .where(eq(member.userId, owner.userId));
    await expect(
      instance.api.updateMemberRole({
        body: {
          memberId: ownerMember[0]?.id ?? "",
          role: "agent",
          organizationId,
        },
        headers: owner.headers,
      })
    ).rejects.toBeDefined();
  });

  test("last owner cannot be removed", async () => {
    await expect(
      instance.api.removeMember({
        body: { memberIdOrEmail: owner.email, organizationId },
        headers: owner.headers,
      })
    ).rejects.toBeDefined();
  });

  test("owner may demote an admin to agent", async () => {
    const adminMember = await db
      .select({ id: member.id })
      .from(member)
      .where(eq(member.userId, adminUser.userId));
    await instance.api.updateMemberRole({
      body: {
        memberId: adminMember[0]?.id ?? "",
        role: "agent",
        organizationId,
      },
      headers: owner.headers,
    });
    const rows = await db
      .select({ role: member.role })
      .from(member)
      .where(eq(member.userId, adminUser.userId));
    expect(rows[0]?.role).toBe("agent");
  });

  test("a user with a membership cannot accept a second invitation", async () => {
    secondOrganizationId = await createOrg(outsider.headers, "second");
    const secondTeam = await instance.api.createTeam({
      body: { name: "Second team", organizationId: secondOrganizationId },
      headers: outsider.headers,
    });
    const created = await instance.api.createInvitation({
      body: {
        email: adminUser.email,
        role: "agent",
        teamId: secondTeam.id,
        organizationId: secondOrganizationId,
      },
      headers: outsider.headers,
    });
    await expect(
      instance.api.acceptInvitation({
        body: { invitationId: created.id },
        headers: adminUser.headers,
      })
    ).rejects.toBeDefined();
  });

  test("a user with a membership cannot be added directly", async () => {
    await expect(
      instance.api.addMember({
        body: {
          userId: adminUser.userId,
          role: "agent",
          organizationId: secondOrganizationId,
        },
        headers: outsider.headers,
      })
    ).rejects.toBeDefined();
  });

  test("pending invitations are recorded for the organization", async () => {
    const rows = await db
      .select({ status: invitation.status })
      .from(invitation)
      .where(eq(invitation.organizationId, organizationId));
    expect(rows.length).toBeGreaterThan(0);
  });

  test("agent invitation without a team is rejected", async () => {
    await expect(
      instance.api.createInvitation({
        body: { email: `noteam@${DOMAIN}`, role: "agent", organizationId },
        headers: owner.headers,
      })
    ).rejects.toBeDefined();
  });

  test("admin invitation naming a team is rejected", async () => {
    await expect(
      instance.api.createInvitation({
        body: {
          email: `admins-team@${DOMAIN}`,
          role: "admin",
          teamId,
          organizationId,
        },
        headers: owner.headers,
      })
    ).rejects.toBeDefined();
  });

  test("a team rejects a non-agent target", async () => {
    const rows = await db
      .select({ id: member.id })
      .from(member)
      .where(eq(member.userId, agentUser.userId));
    const memberId = rows[0]?.id ?? "";
    await instance.api.updateMemberRole({
      body: { memberId, role: "admin", organizationId },
      headers: owner.headers,
    });
    await expect(
      instance.api.addTeamMember({
        body: { teamId, userId: agentUser.userId, organizationId },
        headers: owner.headers,
      })
    ).rejects.toBeDefined();
    await instance.api.updateMemberRole({
      body: { memberId, role: "agent", organizationId },
      headers: owner.headers,
    });
  });

  test("adding the same agent twice creates no duplicate", async () => {
    const added = await instance.api.addTeamMember({
      body: { teamId, userId: agentUser.userId, organizationId },
      headers: owner.headers,
    });
    const rows = await db
      .select({ id: teamMember.id })
      .from(teamMember)
      .where(
        and(
          eq(teamMember.teamId, teamId),
          eq(teamMember.userId, agentUser.userId)
        )
      );
    expect(rows).toHaveLength(1);
    expect(added.id).toBe(rows[0]?.id ?? "");
  });
});
