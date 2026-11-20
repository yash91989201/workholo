CREATE TABLE "campaign" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"method" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"preview_seconds" integer,
	"ring_timeout_seconds" integer,
	"wrap_up_seconds" integer,
	"after_call_work_seconds" integer,
	"retry_count" integer,
	"retry_interval_minutes" integer,
	"dial_statuses" text[] NOT NULL,
	"disposition_list_id" text,
	"caller_id_mode" text,
	"assignee_type" text,
	"assignee_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_lead_list" (
	"id" text PRIMARY KEY,
	"campaign_id" text NOT NULL,
	"list_id" text NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_number" (
	"id" text PRIMARY KEY,
	"campaign_id" text NOT NULL,
	"number_id" text NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX "campaign_organizationId_idx" ON "campaign" ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "campaignLeadList_campaignId_listId_uidx" ON "campaign_lead_list" ("campaign_id","list_id");--> statement-breakpoint
CREATE INDEX "campaignLeadList_campaignId_idx" ON "campaign_lead_list" ("campaign_id");--> statement-breakpoint
CREATE UNIQUE INDEX "campaignNumber_campaignId_numberId_uidx" ON "campaign_number" ("campaign_id","number_id");--> statement-breakpoint
CREATE INDEX "campaignNumber_campaignId_idx" ON "campaign_number" ("campaign_id");--> statement-breakpoint
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_disposition_list_id_disposition_list_id_fkey" FOREIGN KEY ("disposition_list_id") REFERENCES "disposition_list"("id");--> statement-breakpoint
ALTER TABLE "campaign_lead_list" ADD CONSTRAINT "campaign_lead_list_campaign_id_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaign"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "campaign_lead_list" ADD CONSTRAINT "campaign_lead_list_list_id_lead_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "lead_list"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "campaign_number" ADD CONSTRAINT "campaign_number_campaign_id_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaign"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "campaign_number" ADD CONSTRAINT "campaign_number_number_id_outbound_number_id_fkey" FOREIGN KEY ("number_id") REFERENCES "outbound_number"("id") ON DELETE CASCADE;