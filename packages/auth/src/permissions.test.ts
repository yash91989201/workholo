import { describe, expect, test } from "bun:test";

import { admin, agent, owner } from "./permissions";

describe("organization role matrix", () => {
  test("owner manages settings and people but cannot supervise calls", () => {
    expect(owner.authorize({ organization: ["update"] }).success).toBe(true);
    expect(owner.authorize({ organization: ["delete"] }).success).toBe(true);
    expect(owner.authorize({ member: ["create"] }).success).toBe(true);
    expect(owner.authorize({ invitation: ["cancel"] }).success).toBe(true);
    expect(owner.authorize({ call: ["read"] }).success).toBe(true);
    expect(owner.authorize({ recording: ["read"] }).success).toBe(true);
    expect(owner.authorize({ call: ["monitor"] }).success).toBe(false);
    expect(owner.authorize({ call: ["whisper"] }).success).toBe(false);
    expect(owner.authorize({ call: ["barge"] }).success).toBe(false);
  });

  test("admin supervises calls and manages people but not organization settings", () => {
    expect(admin.authorize({ organization: ["update"] }).success).toBe(false);
    expect(admin.authorize({ organization: ["delete"] }).success).toBe(false);
    expect(admin.authorize({ member: ["update"] }).success).toBe(true);
    expect(admin.authorize({ invitation: ["create"] }).success).toBe(true);
    expect(admin.authorize({ team: ["create"] }).success).toBe(true);
    expect(admin.authorize({ team: ["update"] }).success).toBe(true);
    expect(admin.authorize({ team: ["delete"] }).success).toBe(true);
    expect(admin.authorize({ call: ["monitor"] }).success).toBe(true);
    expect(admin.authorize({ call: ["whisper"] }).success).toBe(true);
    expect(admin.authorize({ call: ["barge"] }).success).toBe(true);
    expect(admin.authorize({ recording: ["read"] }).success).toBe(true);
  });

  test("agent reads calls and recordings only", () => {
    expect(agent.authorize({ call: ["read"] }).success).toBe(true);
    expect(agent.authorize({ recording: ["read"] }).success).toBe(true);
    expect(agent.authorize({ call: ["monitor"] }).success).toBe(false);
    expect(agent.authorize({ member: ["create"] }).success).toBe(false);
    expect(agent.authorize({ invitation: ["create"] }).success).toBe(false);
    expect(agent.authorize({ team: ["create"] }).success).toBe(false);
    expect(agent.authorize({ organization: ["update"] }).success).toBe(false);
  });
});
