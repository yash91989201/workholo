import type { Session } from "@workholo/auth";
import type { AuditSink } from "@workholo/auth/audit";
import type { InvitationOrigins } from "@workholo/auth/policy";
import type { Database } from "@workholo/db";
import type { PreviewTelephonyClient } from "./services/preview-telephony";

export type Context = {
  session: Session | null;
  db: Database;
  audit: AuditSink;
  invitationOrigins: InvitationOrigins;
  previewTelephony?: PreviewTelephonyClient | null;
};

export type OrganizationContext = Context & {
  organizationId: string;
  membershipRole: string;
};
