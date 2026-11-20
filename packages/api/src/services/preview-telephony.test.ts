import { describe, expect, it } from "bun:test";

import {
  parsePreviewCallEvent,
  TelephonyClient,
  TelephonyHttpError,
} from "./preview-telephony";

const credentials = {
  agent_id: "member-agent",
  endpoint_type: "webrtc",
  sip_username: "101",
  sip_password: "secret",
  sip_domain: "sip.example.test",
  wss_url: "wss://sip.example.test",
};

const presence = {
  agent_id: "member-agent",
  presence: "available",
  work_status: "ready",
  sip_registered: true,
  updated_at: "2026-11-20T12:00:00Z",
};

const callId = "12bcedaf-2945-4cd1-8de2-d9d000c4515d";

describe("TelephonyClient", () => {
  it("uses bearer auth, status payload, and service response fields", async () => {
    const requests: Request[] = [];
    const client = new TelephonyClient(
      "https://telephony.test/",
      "api-secret",
      async (input, init) => {
        if (input instanceof Request) {
          requests.push(input);
        } else {
          requests.push(new Request(String(input), init));
        }
        return Response.json(requests.length === 1 ? credentials : presence);
      }
    );

    expect(await client.provisionAgent("member-agent")).toEqual(credentials);
    expect(await client.setStatus("member-agent", "ready")).toEqual(presence);
    expect(requests[0]?.url).toBe(
      "https://telephony.test/api/v1/agents/member-agent"
    );
    expect(requests[0]?.method).toBe("PUT");
    expect(requests[0]?.headers.get("authorization")).toBe("Bearer api-secret");
    expect(await requests[1]?.json()).toEqual({ status: "ready" });
  });

  it("rejects SIP credentials with a non-WSS transport URL", async () => {
    const client = new TelephonyClient(
      "https://telephony.test",
      "token",
      async () =>
        Response.json({ ...credentials, wss_url: "https://sip.example.test" })
    );
    await expect(client.provisionAgent("member-agent")).rejects.toThrow();
  });

  it("treats absent calls as delayed visibility and propagates service failures", async () => {
    const client = new TelephonyClient(
      "https://telephony.test",
      "token",
      async () => new Response(null, { status: 404 })
    );
    expect(await client.getCall(callId)).toBeNull();
    const failing = new TelephonyClient(
      "https://telephony.test",
      "token",
      async () => new Response(null, { status: 503 })
    );
    await expect(failing.getCall(callId)).rejects.toBeInstanceOf(
      TelephonyHttpError
    );
  });

  it("keeps incomplete terminal reads out of projection", async () => {
    const client = new TelephonyClient(
      "https://telephony.test",
      "token",
      async () =>
        Response.json({
          call_id: callId,
          agent_id: "member-agent",
          status: "ended",
          to: "+14155550100",
          caller_id: "+14155550101",
          initiated_at: "2026-11-20T12:00:00Z",
          talk_seconds: 0,
        })
    );
    await expect(client.getCall(callId)).rejects.toThrow(
      "Ended calls require outcome and ended_at"
    );
  });

  it("accepts a service 404 during idempotent deactivation", async () => {
    const client = new TelephonyClient(
      "https://telephony.test",
      "token",
      async () => new Response(null, { status: 404 })
    );
    await expect(
      client.deactivateAgent("member-agent")
    ).resolves.toBeUndefined();
  });
});

describe("parsePreviewCallEvent", () => {
  it("maps service events and leaves unrelated agent events alone", () => {
    const update = parsePreviewCallEvent(
      JSON.stringify({
        id: "event-id",
        type: "call.ended",
        agent_id: "member-agent",
        call_id: callId,
        data: {
          outcome: "lead_unanswered",
          hangup_cause: "NO_ANSWER",
          ended_by: "system",
          initiated_at: "2026-11-20T12:00:00Z",
          ended_at: "2026-11-20T12:00:30Z",
          talk_seconds: 0,
        },
      })
    );
    expect(update).toMatchObject({
      id: callId,
      agentId: "member-agent",
      status: "ended",
      outcome: "lead_unanswered",
      hangupCause: "NO_ANSWER",
      endedBy: "system",
      talkSeconds: 0,
    });
    expect(update?.endedAt?.toISOString()).toBe("2026-11-20T12:00:30.000Z");
    expect(
      parsePreviewCallEvent(
        JSON.stringify({
          id: "presence-id",
          type: "agent.presence_changed",
          agent_id: "member-agent",
          data: {},
        })
      )
    ).toBeNull();
    expect(
      parsePreviewCallEvent(
        JSON.stringify({ id: "unknown-id", type: "toString", data: {} })
      )
    ).toBeNull();
  });

  it("rejects incomplete terminal events", () => {
    expect(() =>
      parsePreviewCallEvent(
        JSON.stringify({
          id: "event-id",
          type: "call.ended",
          agent_id: "member-agent",
          call_id: callId,
          data: { outcome: "completed" },
        })
      )
    ).toThrow("Missing telephony event timestamp: ended_at");
  });
});
