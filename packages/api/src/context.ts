import type { Session } from "@workholo/auth";
import type { AuditSink } from "@workholo/auth/audit";
import type { InvitationOrigins } from "@workholo/auth/policy";
import type { Database } from "@workholo/db";

export type Context = {
  session: Session | null;
  db: Database;
  audit: AuditSink;
  invitationOrigins: InvitationOrigins;
};

export type OrganizationContext = Context & {
  organizationId: string;
  membershipRole: string;
};
