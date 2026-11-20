CREATE TABLE "lead" (
	"id" text PRIMARY KEY,
	"list_id" text NOT NULL,
	"phone" text NOT NULL,
	"name" text,
	"removed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_list" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "lead_listId_idx" ON "lead" ("list_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_active_phone_uidx" ON "lead" ("list_id","phone") WHERE "removed_at" is null;--> statement-breakpoint
CREATE INDEX "leadList_organizationId_idx" ON "lead_list" ("organization_id");--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_list_id_lead_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "lead_list"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "lead_list" ADD CONSTRAINT "lead_list_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;