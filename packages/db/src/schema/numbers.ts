import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { organization } from "./auth";

/**
 * Global carrier-provisioned number. No tenant foreign key: the inventory
 * outlives any organization it is assigned to.
 */
export const outboundNumber = pgTable(
  "outbound_number",
  {
    id: text("id").primaryKey(),
    number: text("number").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("outboundNumber_number_uidx").on(table.number)]
);

/** One organization per inventory number; removed with the organization. */
export const outboundNumberAssignment = pgTable(
  "outbound_number_assignment",
  {
    id: text("id").primaryKey(),
    numberId: text("number_id")
      .notNull()
      .references(() => outboundNumber.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("outboundNumberAssignment_numberId_uidx").on(table.numberId),
    index("outboundNumberAssignment_organizationId_idx").on(
      table.organizationId
    ),
  ]
);
