import { describe, expect, test } from "bun:test";

import {
  canInviteRole,
  canManageMember,
  invitationOrigin,
  invitationUrl,
  isOrganizationRole,
} from "./policy";

const origins = {
  console: "http://localhost:3003",
  agent: "http://localhost:3004",
};

describe("invitation chain", () => {
  test("only the owner invites admins", () => {
    expect(canInviteRole("owner", "admin")).toBe(true);
    expect(canInviteRole("admin", "admin")).toBe(false);
    expect(canInviteRole("agent", "admin")).toBe(false);
  });

  test("owner and admin invite agents", () => {
    expect(canInviteRole("owner", "agent")).toBe(true);
    expect(canInviteRole("admin", "agent")).toBe(true);
    expect(canInviteRole("agent", "agent")).toBe(false);
  });

  test("owner is never invitable", () => {
    expect(canInviteRole("owner", "owner")).toBe(false);
    expect(canInviteRole("admin", "owner")).toBe(false);
  });

  test("unknown roles are rejected", () => {
    expect(canInviteRole("owner", "superuser")).toBe(false);
    expect(isOrganizationRole("superuser")).toBe(false);
  });
});

describe("member management", () => {
  test("admins manage agents only", () => {
    expect(canManageMember("admin", "agent", "update")).toBe(true);
    expect(canManageMember("admin", "agent", "remove")).toBe(true);
    expect(canManageMember("admin", "admin", "remove")).toBe(false);
    expect(canManageMember("admin", "owner", "remove")).toBe(false);
  });

  test("owners manage admins and agents", () => {
    expect(canManageMember("owner", "admin", "remove")).toBe(true);
    expect(canManageMember("owner", "agent", "update")).toBe(true);
    expect(canManageMember("owner", "owner", "remove")).toBe(false);
  });

  test("agents manage nobody", () => {
    expect(canManageMember("agent", "agent", "remove")).toBe(false);
    expect(canManageMember("agent", "agent", "update")).toBe(false);
  });
});

describe("invitation routing", () => {
  test("admin invitations open the console", () => {
    expect(invitationOrigin("admin", origins)).toBe("http://localhost:3003");
    expect(invitationUrl("admin", "inv_1", origins)).toBe(
      "http://localhost:3003/accept-invitation?id=inv_1"
    );
  });

  test("agent invitations open the agent panel", () => {
    expect(invitationOrigin("agent", origins)).toBe("http://localhost:3004");
    expect(invitationUrl("agent", "inv_2", origins)).toBe(
      "http://localhost:3004/accept-invitation?id=inv_2"
    );
  });

  test("trailing slashes do not double up", () => {
    expect(
      invitationUrl("agent", "inv_3", {
        console: "http://localhost:3003/",
        agent: "http://localhost:3004/",
      })
    ).toBe("http://localhost:3004/accept-invitation?id=inv_3");
  });
});
