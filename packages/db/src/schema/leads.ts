import { defineRelationsPart, sql } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { organization } from "./auth";

/** Organization-owned list of customer numbers for future campaign setup. */
export const leadList = pgTable(
  "lead_list",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("leadList_organizationId_idx").on(table.organizationId)]
);

/** Lead in one list: stable row, canonical E.164, removal marker not a delete. */
export const lead = pgTable(
  "lead",
  {
    id: text("id").primaryKey(),
    listId: text("list_id")
      .notNull()
      .references(() => leadList.id, { onDelete: "cascade" }),
    phone: text("phone").notNull(),
    name: text("name"),
    removedAt: timestamp("removed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("lead_listId_idx").on(table.listId),
    uniqueIndex("lead_active_phone_uidx")
      .on(table.listId, table.phone)
      .where(sql`${table.removedAt} is null`),
  ]
);

export const leadRelations = defineRelationsPart({ leadList, lead }, (r) => ({
  leadList: {
    leads: r.many.lead({
      from: r.leadList.id,
      to: r.lead.listId,
    }),
  },
  lead: {
    list: r.one.leadList({
      from: r.lead.listId,
      to: r.leadList.id,
    }),
  },
}));
