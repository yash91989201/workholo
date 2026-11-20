import { ORPCError } from "@orpc/client";

export type CampaignFieldErrors = Record<string, string>;

export type CampaignAssignee = {
  type: "agent" | "team";
  id: string;
};

/** Field-level refusals the campaign API returns with a BAD_REQUEST. */
export function campaignFieldErrors(
  error: unknown
): CampaignFieldErrors | null {
  if (!(error instanceof ORPCError) || error.code !== "BAD_REQUEST") {
    return null;
  }
  const data = error.data as { fieldErrors?: unknown } | undefined;
  const raw = data?.fieldErrors;
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const entries = Object.entries(raw).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string"
  );
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

/** Message for a failed lifecycle or save call. */
export function campaignErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ORPCError && error.code === "CONFLICT") {
    return "Campaign changed; reload";
  }
  return error instanceof Error ? error.message : fallback;
}

/** Assignee select value: `""`, `team:<id>` or `agent:<userId>`. */
export function parseCampaignAssignee(value: string): CampaignAssignee | null {
  const [type, id] = value.split(":");
  if (!id || (type !== "agent" && type !== "team")) {
    return null;
  }
  return { id, type };
}
