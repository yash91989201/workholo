import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { organization } from "./auth";

/** Organization-owned suppression entry; removed with the organization. */
export const doNotDialEntry = pgTable(
  "do_not_dial_entry",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    e164Number: text("e164_number").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("doNotDialEntry_organizationId_e164Number_uidx").on(
      table.organizationId,
      table.e164Number
    ),
  ]
);
