import { TelephonyClient } from "@workholo/api/services/preview-telephony";
import { createAuth } from "@workholo/auth";
import type { AuditSink } from "@workholo/auth/audit";
import { createDb } from "@workholo/db";
import { audit as emitAudit } from "evlog";

import { desktopOrigins, ENV } from "./env.server";

export const db = createDb(ENV);

if (Boolean(ENV.TELEPHONY_API_URL) !== Boolean(ENV.TELEPHONY_API_TOKEN)) {
  throw new Error(
    "TELEPHONY_API_URL and TELEPHONY_API_TOKEN must be set together"
  );
}

export const previewTelephony =
  ENV.TELEPHONY_API_URL && ENV.TELEPHONY_API_TOKEN
    ? new TelephonyClient(ENV.TELEPHONY_API_URL, ENV.TELEPHONY_API_TOKEN)
    : null;

/** Privileged actions go through the structured audit trail. */
export const audit: AuditSink = (event) => {
  emitAudit({
    action: event.action,
    actor: { type: "user", id: event.actorId },
    target: event.target,
    outcome: "success",
    ...(event.reason === undefined ? {} : { reason: event.reason }),
  });
};

export const auth = createAuth(ENV, db, { desktopOrigins, audit });
