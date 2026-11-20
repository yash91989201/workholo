import { describe, expect, it } from "bun:test";

import type { PreviewCallCommand } from "@workholo/api/services/preview-dispatch";

import { serializePreviewCommand } from "./preview-runtime";

describe("serializePreviewCommand", () => {
  it("matches the telephony-service command envelope and customer-leg timeout field", () => {
    const command: PreviewCallCommand = {
      commandId: "dispatch-id",
      callId: "d1cc6ff8-3811-4fd9-a35a-7f57d6d47294",
      agentId: "member-agent",
      to: "+14155550100",
      callerId: "+14155550101",
      customerRingTimeoutSeconds: 24,
      issuedAt: new Date("2026-11-20T12:00:00Z"),
      expiresAt: new Date("2026-11-20T12:00:30Z"),
    };

    expect(serializePreviewCommand(command)).toEqual({
      id: "dispatch-id",
      type: "call.initiate",
      issued_at: "2026-11-20T12:00:00.000Z",
      expires_at: "2026-11-20T12:00:30.000Z",
      data: {
        call_id: command.callId,
        agent_id: command.agentId,
        to: command.to,
        caller_id: command.callerId,
        customer_ring_timeout_seconds: 24,
      },
    });
  });
});
