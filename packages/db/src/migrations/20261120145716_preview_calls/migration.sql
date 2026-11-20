CREATE TABLE "preview_attempt" (
	"id" text PRIMARY KEY,
	"claim_id" text NOT NULL,
	"number_id" text NOT NULL,
	"caller_id" text NOT NULL,
	"ring_timeout_seconds" integer NOT NULL,
	"wrap_up_seconds" integer NOT NULL,
	"after_call_work_seconds" integer NOT NULL,
	"retry_interval_minutes" integer NOT NULL,
	"is_retry" boolean NOT NULL,
	"disposition_options" jsonb NOT NULL,
	"disposition" jsonb,
	"wrapup_until" timestamp,
	"hold_until" timestamp,
	"outcome" text,
	"hangup_cause" text,
	"reject_reason" text,
	"issued_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"publish_started" boolean DEFAULT false NOT NULL,
	"published_at" timestamp,
	"next_publish_at" timestamp,
	"next_read_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "preview_claim" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"campaign_id" text NOT NULL,
	"member_id" text NOT NULL,
	"lead_id" text NOT NULL,
	"phone" text NOT NULL,
	"name" text,
	"revision" integer NOT NULL,
	"expires_at" timestamp NOT NULL,
	"released_at" timestamp,
	"skipped_session_id" text
);
--> statement-breakpoint
CREATE TABLE "preview_destination" (
	"campaign_id" text,
	"phone" text,
	"status" text NOT NULL,
	"retries_used" integer DEFAULT 0 NOT NULL,
	"retry_at" timestamp,
	CONSTRAINT "preview_destination_pkey" PRIMARY KEY("campaign_id","phone")
);
--> statement-breakpoint
CREATE TABLE "preview_phone" (
	"member_id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "preview_attempt_claim_uidx" ON "preview_attempt" ("claim_id");--> statement-breakpoint
CREATE INDEX "preview_attempt_publish_idx" ON "preview_attempt" ("next_publish_at") WHERE "next_publish_at" is not null;--> statement-breakpoint
CREATE INDEX "preview_attempt_read_idx" ON "preview_attempt" ("next_read_at") WHERE "next_read_at" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "preview_claim_live_agent_uidx" ON "preview_claim" ("member_id") WHERE "released_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "preview_claim_live_destination_uidx" ON "preview_claim" ("campaign_id","phone") WHERE "released_at" is null;--> statement-breakpoint
CREATE INDEX "preview_claim_skipped_session_idx" ON "preview_claim" ("skipped_session_id");--> statement-breakpoint
CREATE INDEX "preview_claim_live_organization_idx" ON "preview_claim" ("organization_id","expires_at") WHERE "released_at" is null;--> statement-breakpoint
ALTER TABLE "preview_attempt" ADD CONSTRAINT "preview_attempt_id_call_id_fkey" FOREIGN KEY ("id") REFERENCES "call"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "preview_attempt" ADD CONSTRAINT "preview_attempt_claim_id_preview_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "preview_claim"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "preview_claim" ADD CONSTRAINT "preview_claim_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "preview_claim" ADD CONSTRAINT "preview_claim_campaign_id_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaign"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "preview_destination" ADD CONSTRAINT "preview_destination_campaign_id_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaign"("id") ON DELETE CASCADE;

--> statement-breakpoint
CREATE FUNCTION "mark_preview_phone_revoked"() RETURNS trigger AS $$
BEGIN
  IF OLD.role = 'agent' AND (TG_OP = 'DELETE' OR NEW.role <> 'agent') THEN
    UPDATE "preview_phone" SET "revoked" = true WHERE "member_id" = OLD.id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "preview_phone_membership_revocation"
AFTER UPDATE OF "role" OR DELETE ON "member"
FOR EACH ROW EXECUTE FUNCTION "mark_preview_phone_revoked"();
