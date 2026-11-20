CREATE TABLE "outbound_number" (
	"id" text PRIMARY KEY,
	"number" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbound_number_assignment" (
	"id" text PRIMARY KEY,
	"number_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "outboundNumber_number_uidx" ON "outbound_number" ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "outboundNumberAssignment_numberId_uidx" ON "outbound_number_assignment" ("number_id");--> statement-breakpoint
CREATE INDEX "outboundNumberAssignment_organizationId_idx" ON "outbound_number_assignment" ("organization_id");--> statement-breakpoint
ALTER TABLE "outbound_number_assignment" ADD CONSTRAINT "outbound_number_assignment_number_id_outbound_number_id_fkey" FOREIGN KEY ("number_id") REFERENCES "outbound_number"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "outbound_number_assignment" ADD CONSTRAINT "outbound_number_assignment_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;