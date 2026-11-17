import { describe, expect, test } from "bun:test";

import { createOrgAuthClient } from "./index";

const authClient = createOrgAuthClient("http://localhost:8000");

/** The client must carry the server's custom roles, not better-auth defaults. */
describe("organization client role matrix", () => {
  test("owner role is recognized", () => {
    expect(
      authClient.organization.checkRolePermission({
        role: "owner",
        permissions: { organization: ["update"], member: ["create"] },
      })
    ).toBe(true);
  });

  test("admin cannot change organization settings", () => {
    expect(
      authClient.organization.checkRolePermission({
        role: "admin",
        permissions: { organization: ["update"] },
      })
    ).toBe(false);
    expect(
      authClient.organization.checkRolePermission({
        role: "admin",
        permissions: { member: ["update"] },
      })
    ).toBe(true);
  });

  test("agent has no people-management permissions", () => {
    expect(
      authClient.organization.checkRolePermission({
        role: "agent",
        permissions: { member: ["create"] },
      })
    ).toBe(false);
    expect(
      authClient.organization.checkRolePermission({
        role: "agent",
        permissions: { invitation: ["create"] },
      })
    ).toBe(false);
  });

  test("agent is an accepted invitation role", () => {
    const invite: Parameters<typeof authClient.organization.inviteMember>[0] = {
      email: "agent@example.test",
      role: "agent",
      organizationId: "org",
    };
    expect(invite.role).toBe("agent");
  });
});
