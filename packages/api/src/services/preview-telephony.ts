import { z } from "zod";

export const PreviewTelephonyCredentialsSchema = z.object({
  agent_id: z.string(),
  endpoint_type: z.string(),
  sip_username: z.string(),
  sip_password: z.string(),
  sip_domain: z.string(),
  wss_url: z.string().refine((value) => {
    try {
      return new URL(value).protocol === "wss:";
    } catch {
      return false;
    }
  }),
});

export const PreviewTelephonyPresenceSchema = z.object({
  agent_id: z.string(),
  presence: z.string(),
  work_status: z.string(),
  sip_registered: z.boolean(),
  updated_at: z.string().datetime({ offset: true }),
});

export const PreviewTelephonyCallSchema = z
  .object({
    call_id: z.string().uuid(),
    agent_id: z.string(),
    status: z.enum([
      "initiating",
      "agent_ringing",
      "agent_answered",
      "lead_ringing",
      "connected",
      "ended",
      "rejected",
    ]),
    to: z.string(),
    caller_id: z.string(),
    outcome: z.string().optional(),
    hangup_cause: z.string().optional(),
    ended_by: z.string().optional(),
    initiated_at: z.string().datetime({ offset: true }),
    agent_answered_at: z.string().datetime({ offset: true }).optional(),
    connected_at: z.string().datetime({ offset: true }).optional(),
    ended_at: z.string().datetime({ offset: true }).optional(),
    talk_seconds: z.number().int().nonnegative(),
  })
  .refine(
    (call) => call.status !== "ended" || Boolean(call.ended_at && call.outcome),
    { message: "Ended calls require outcome and ended_at" }
  );

export type PreviewTelephonyCredentials = z.infer<
  typeof PreviewTelephonyCredentialsSchema
>;
export type PreviewTelephonyPresence = z.infer<
  typeof PreviewTelephonyPresenceSchema
>;
export type PreviewTelephonyCall = z.infer<typeof PreviewTelephonyCallSchema>;

export type PreviewCallUpdate = {
  id: string;
  agentId: string;
  status:
    | "initiating"
    | "agent_ringing"
    | "agent_answered"
    | "lead_ringing"
    | "connected"
    | "ended"
    | "rejected";
  initiatedAt?: Date;
  endedBy?: string;
  outcome?: string;
  hangupCause?: string;
  rejectReason?: string;
  connectedAt?: Date;
  endedAt?: Date;
  talkSeconds?: number;
};

export type PreviewTelephonyClient = {
  provisionAgent(agentId: string): Promise<PreviewTelephonyCredentials>;
  deactivateAgent(agentId: string): Promise<void>;
  setStatus(
    agentId: string,
    status: "ready" | "break" | "offline"
  ): Promise<PreviewTelephonyPresence>;
  getPresence(agentId: string): Promise<PreviewTelephonyPresence>;
  getCall(callId: string): Promise<PreviewCallUpdate | null>;
};

export class TelephonyHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "TelephonyHttpError";
    this.status = status;
  }
}

export class TelephonyClient implements PreviewTelephonyClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly fetcher: (
    input: string | URL | Request,
    init?: RequestInit
  ) => Promise<Response>;

  constructor(
    baseUrl: string,
    token: string,
    fetcher: (
      input: string | URL | Request,
      init?: RequestInit
    ) => Promise<Response> = fetch
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.token = token;
    this.fetcher = fetcher;
  }

  async provisionAgent(agentId: string): Promise<PreviewTelephonyCredentials> {
    return PreviewTelephonyCredentialsSchema.parse(
      await this.request(`/agents/${encodeURIComponent(agentId)}`, {
        method: "PUT",
      })
    );
  }

  async deactivateAgent(agentId: string): Promise<void> {
    try {
      await this.request(`/agents/${encodeURIComponent(agentId)}`, {
        method: "DELETE",
        allowNoContent: true,
      });
    } catch (error) {
      if (!(error instanceof TelephonyHttpError && error.status === 404)) {
        throw error;
      }
    }
  }

  async setStatus(
    agentId: string,
    status: "ready" | "break" | "offline"
  ): Promise<PreviewTelephonyPresence> {
    return PreviewTelephonyPresenceSchema.parse(
      await this.request(`/agents/${encodeURIComponent(agentId)}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      })
    );
  }

  async getPresence(agentId: string): Promise<PreviewTelephonyPresence> {
    return PreviewTelephonyPresenceSchema.parse(
      await this.request(`/agents/${encodeURIComponent(agentId)}/presence`)
    );
  }

  async getCall(callId: string): Promise<PreviewCallUpdate | null> {
    try {
      const call = PreviewTelephonyCallSchema.parse(
        await this.request(`/calls/${encodeURIComponent(callId)}`)
      );
      return {
        id: call.call_id,
        agentId: call.agent_id,
        status: call.status,
        initiatedAt: new Date(call.initiated_at),
        ...(call.ended_by === undefined ? {} : { endedBy: call.ended_by }),
        ...(call.outcome === undefined ? {} : { outcome: call.outcome }),
        ...(call.hangup_cause === undefined
          ? {}
          : { hangupCause: call.hangup_cause }),
        ...(call.connected_at === undefined
          ? {}
          : { connectedAt: new Date(call.connected_at) }),
        ...(call.ended_at === undefined
          ? {}
          : { endedAt: new Date(call.ended_at) }),
        talkSeconds: call.talk_seconds,
      };
    } catch (error) {
      if (error instanceof TelephonyHttpError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  private async request(
    path: string,
    options: RequestInit & { allowNoContent?: boolean } = {}
  ): Promise<unknown> {
    const response = await this.fetcher(`${this.baseUrl}/api/v1${path}`, {
      ...options,
      signal: options.signal ?? AbortSignal.timeout(5000),
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(options.body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
        ...options.headers,
      },
    });
    if (options.allowNoContent && response.status === 204) {
      return undefined;
    }
    if (!response.ok) {
      throw new TelephonyHttpError(
        response.status,
        `Telephony service request failed (${response.status})`
      );
    }
    return response.json();
  }
}

const statusByEvent = new Map<string, PreviewCallUpdate["status"]>([
  ["call.agent_ringing", "agent_ringing"],
  ["call.agent_answered", "agent_answered"],
  ["call.lead_ringing", "lead_ringing"],
  ["call.connected", "connected"],
  ["call.ended", "ended"],
  ["call.rejected", "rejected"],
]);

export function parsePreviewCallEvent(raw: string): PreviewCallUpdate | null {
  const envelope = z
    .object({ id: z.string().min(1), type: z.string(), data: z.unknown() })
    .passthrough()
    .parse(JSON.parse(raw));
  const status = statusByEvent.get(envelope.type);
  if (!status) {
    return null;
  }
  const event = z
    .object({
      agent_id: z.string().min(1),
      call_id: z.string().uuid(),
      data: z.record(z.string(), z.unknown()),
    })
    .parse(envelope);
  const { data } = event;
  const timestamp = (name: string, required = false): Date | undefined => {
    const value = data[name];
    if (typeof value !== "string" || value.length === 0) {
      if (required) {
        throw new Error(`Missing telephony event timestamp: ${name}`);
      }
      return undefined;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`Invalid telephony event timestamp: ${name}`);
    }
    return date;
  };
  const { outcome } = data;
  if (status === "ended" && (typeof outcome !== "string" || !outcome)) {
    throw new Error("Missing telephony event outcome");
  }
  const connectedAt = timestamp("connected_at");
  const endedAt = timestamp("ended_at", status === "ended");
  const initiatedAt = timestamp("initiated_at");
  const talkSeconds = data.talk_seconds;
  if (
    talkSeconds !== undefined &&
    (typeof talkSeconds !== "number" ||
      !Number.isInteger(talkSeconds) ||
      talkSeconds < 0)
  ) {
    throw new Error("Invalid telephony event talk_seconds");
  }
  return {
    id: event.call_id,
    agentId: event.agent_id,
    status,
    ...(initiatedAt ? { initiatedAt } : {}),
    ...(typeof data.ended_by === "string" ? { endedBy: data.ended_by } : {}),
    ...(typeof outcome === "string" ? { outcome } : {}),
    ...(typeof data.hangup_cause === "string"
      ? { hangupCause: data.hangup_cause }
      : {}),
    ...(typeof data.reason === "string" ? { rejectReason: data.reason } : {}),
    ...(connectedAt ? { connectedAt } : {}),
    ...(endedAt ? { endedAt } : {}),
    ...(typeof talkSeconds === "number" ? { talkSeconds } : {}),
  };
}
