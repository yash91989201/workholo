import type { Session } from "@workholo/auth";
import type { AuditSink } from "@workholo/auth/audit";
import type { Database } from "@workholo/db";

export type Context = {
  session: Session | null;
  db: Database;
  audit: AuditSink;
};

export type OrganizationContext = Context & {
  organizationId: string;
  membershipRole: string;
};
