CREATE TABLE "do_not_dial_entry" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"e164_number" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "doNotDialEntry_organizationId_e164Number_uidx" ON "do_not_dial_entry" ("organization_id","e164_number");--> statement-breakpoint
ALTER TABLE "do_not_dial_entry" ADD CONSTRAINT "do_not_dial_entry_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;