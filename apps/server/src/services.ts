import { createAuth } from "@workholo/auth";
import type { AuditSink } from "@workholo/auth/audit";
import { createDb } from "@workholo/db";
import { audit as emitAudit } from "evlog";

import { desktopOrigins, ENV } from "./env.server";

export const db = createDb(ENV);

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
