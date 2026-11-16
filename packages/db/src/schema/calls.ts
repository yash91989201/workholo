import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { organization, user } from "./auth";

/** Tenant-owned call record. The media layer lives outside this workspace. */
export const call = pgTable(
  "call",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    agentId: text("agent_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    direction: text("direction").notNull(),
    status: text("status").notNull(),
    startedAt: timestamp("started_at"),
    endedAt: timestamp("ended_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("call_organizationId_idx").on(table.organizationId),
    index("call_agentId_idx").on(table.agentId),
  ]
);

/** Tenant-owned recording metadata. */
export const recording = pgTable(
  "recording",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    callId: text("call_id")
      .notNull()
      .references(() => call.id, { onDelete: "cascade" }),
    agentId: text("agent_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("recording_organizationId_idx").on(table.organizationId),
    index("recording_agentId_idx").on(table.agentId),
  ]
);
