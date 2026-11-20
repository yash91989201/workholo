import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { organization } from "./auth";
import { dispositionList } from "./dispositions";
import { leadList } from "./leads";
import { outboundNumber } from "./numbers";

/**
 * Organization-owned Preview dial campaign. Settings stay nullable while the
 * campaign is a draft; activation validates the whole row before it becomes
 * usable by the calling service.
 */
export const campaign = pgTable(
  "campaign",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    /** Dial method discriminator; only "preview" is supported. */
    method: text("method").notNull(),
    /** draft | active | paused | archived */
    status: text("status").default("draft").notNull(),
    /** Incremented by activation and pause; stale attempts are rejected. */
    revision: integer("revision").default(0).notNull(),
    previewSeconds: integer("preview_seconds"),
    ringTimeoutSeconds: integer("ring_timeout_seconds"),
    wrapUpSeconds: integer("wrap_up_seconds"),
    afterCallWorkSeconds: integer("after_call_work_seconds"),
    retryCount: integer("retry_count"),
    retryIntervalMinutes: integer("retry_interval_minutes"),
    /** Selected lead statuses eligible for dialing. */
    dialStatuses: text("dial_statuses").array().notNull(),
    dispositionListId: text("disposition_list_id").references(
      () => dispositionList.id
    ),
    /** fixed | random */
    callerIdMode: text("caller_id_mode"),
    /** agent | team */
    assigneeType: text("assignee_type"),
    assigneeId: text("assignee_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("campaign_organizationId_idx").on(table.organizationId)]
);

/** Ordered lead lists worked by one campaign. */
export const campaignLeadList = pgTable(
  "campaign_lead_list",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaign.id, { onDelete: "cascade" }),
    listId: text("list_id")
      .notNull()
      .references(() => leadList.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
  },
  (table) => [
    uniqueIndex("campaignLeadList_campaignId_listId_uidx").on(
      table.campaignId,
      table.listId
    ),
    index("campaignLeadList_campaignId_idx").on(table.campaignId),
  ]
);

/** Ordered caller ID pool: one fixed DID or several for random selection. */
export const campaignNumber = pgTable(
  "campaign_number",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaign.id, { onDelete: "cascade" }),
    numberId: text("number_id")
      .notNull()
      .references(() => outboundNumber.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
  },
  (table) => [
    uniqueIndex("campaignNumber_campaignId_numberId_uidx").on(
      table.campaignId,
      table.numberId
    ),
    index("campaignNumber_campaignId_idx").on(table.campaignId),
  ]
);
