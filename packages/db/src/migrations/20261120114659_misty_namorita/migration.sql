CREATE TABLE "disposition_entry" (
	"id" text PRIMARY KEY,
	"list_id" text NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"retired_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disposition_list" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "dispositionEntry_listId_idx" ON "disposition_entry" ("list_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dispositionEntry_code_uidx" ON "disposition_entry" ("list_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "dispositionEntry_label_uidx" ON "disposition_entry" ("list_id","label");--> statement-breakpoint
CREATE INDEX "dispositionList_organizationId_idx" ON "disposition_list" ("organization_id");--> statement-breakpoint
ALTER TABLE "disposition_entry" ADD CONSTRAINT "disposition_entry_list_id_disposition_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "disposition_list"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "disposition_list" ADD CONSTRAINT "disposition_list_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;