import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { organization } from "./auth";
import { call } from "./calls";
import { campaign } from "./campaigns";

export type PreviewDisposition = { id: string; code: string; label: string };

/** Kept after membership deletion so remote SIP credentials can be revoked. */
export const previewPhone = pgTable("preview_phone", {
  memberId: text("member_id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  revoked: boolean("revoked").notNull().default(false),
});

export const previewClaim = pgTable(
  "preview_claim",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaign.id, { onDelete: "cascade" }),
    memberId: text("member_id").notNull(),
    leadId: text("lead_id").notNull(),
    phone: text("phone").notNull(),
    name: text("name"),
    revision: integer("revision").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    releasedAt: timestamp("released_at"),
    skippedSessionId: text("skipped_session_id"),
  },
  (t) => [
    uniqueIndex("preview_claim_live_agent_uidx")
      .on(t.memberId)
      .where(sql`${t.releasedAt} is null`),
    uniqueIndex("preview_claim_live_destination_uidx")
      .on(t.campaignId, t.phone)
      .where(sql`${t.releasedAt} is null`),
    index("preview_claim_skipped_session_idx").on(t.skippedSessionId),
    index("preview_claim_live_organization_idx")
      .on(t.organizationId, t.expiresAt)
      .where(sql`${t.releasedAt} is null`),
  ]
);

export const previewAttempt = pgTable(
  "preview_attempt",
  {
    id: text("id")
      .primaryKey()
      .references(() => call.id, { onDelete: "cascade" }),
    claimId: text("claim_id")
      .notNull()
      .references(() => previewClaim.id, { onDelete: "cascade" }),
    numberId: text("number_id").notNull(),
    callerId: text("caller_id").notNull(),
    ringTimeoutSeconds: integer("ring_timeout_seconds").notNull(),
    wrapUpSeconds: integer("wrap_up_seconds").notNull(),
    afterCallWorkSeconds: integer("after_call_work_seconds").notNull(),
    retryIntervalMinutes: integer("retry_interval_minutes").notNull(),
    isRetry: boolean("is_retry").notNull(),
    dispositionOptions: jsonb("disposition_options")
      .$type<PreviewDisposition[]>()
      .notNull(),
    disposition: jsonb("disposition").$type<PreviewDisposition>(),
    wrapupUntil: timestamp("wrapup_until"),
    holdUntil: timestamp("hold_until"),
    outcome: text("outcome"),
    hangupCause: text("hangup_cause"),
    rejectReason: text("reject_reason"),
    issuedAt: timestamp("issued_at").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    publishStarted: boolean("publish_started").notNull().default(false),
    publishedAt: timestamp("published_at"),
    nextPublishAt: timestamp("next_publish_at"),
    nextReadAt: timestamp("next_read_at"),
  },
  (t) => [
    uniqueIndex("preview_attempt_claim_uidx").on(t.claimId),
    index("preview_attempt_publish_idx")
      .on(t.nextPublishAt)
      .where(sql`${t.nextPublishAt} is not null`),
    index("preview_attempt_read_idx")
      .on(t.nextReadAt)
      .where(sql`${t.nextReadAt} is not null`),
  ]
);

/** Destination status and customer retry usage apply across the campaign's lists. */
export const previewDestination = pgTable(
  "preview_destination",
  {
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaign.id, { onDelete: "cascade" }),
    phone: text("phone").notNull(),
    status: text("status").notNull(),
    retriesUsed: integer("retries_used").notNull().default(0),
    retryAt: timestamp("retry_at"),
  },
  (t) => [primaryKey({ columns: [t.campaignId, t.phone] })]
);
