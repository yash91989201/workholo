import { defineRelationsPart } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { organization } from "./auth";

/** Organization-owned list of coded call outcomes for future campaign setup. */
export const dispositionList = pgTable(
  "disposition_list",
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
  (table) => [
    index("dispositionList_organizationId_idx").on(table.organizationId),
  ]
);

/** Outcome entry in one list: stable code and label, retired instead of deleted. */
export const dispositionEntry = pgTable(
  "disposition_entry",
  {
    id: text("id").primaryKey(),
    listId: text("list_id")
      .notNull()
      .references(() => dispositionList.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    label: text("label").notNull(),
    retiredAt: timestamp("retired_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("dispositionEntry_listId_idx").on(table.listId),
    uniqueIndex("dispositionEntry_code_uidx").on(table.listId, table.code),
    uniqueIndex("dispositionEntry_label_uidx").on(table.listId, table.label),
  ]
);

export const dispositionRelations = defineRelationsPart(
  { dispositionList, dispositionEntry },
  (r) => ({
    dispositionList: {
      entries: r.many.dispositionEntry({
        from: r.dispositionList.id,
        to: r.dispositionEntry.listId,
      }),
    },
    dispositionEntry: {
      list: r.one.dispositionList({
        from: r.dispositionEntry.listId,
        to: r.dispositionList.id,
      }),
    },
  })
);
