import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { expo } from "@better-auth/expo";
import type { Database } from "@workholo/db";
import * as schema from "@workholo/db/schema/auth";
import { betterAuth } from "better-auth";
import { admin, organization } from "better-auth/plugins";
import { adminAc } from "better-auth/plugins/admin/access";

import type { AuditSink } from "./audit";
import { createAuditHooks } from "./audit-hooks";
import { createOrganizationHooks } from "./hooks";
import type { InvitationMailer } from "./mailer";
import { noopInvitationMailer } from "./mailer";
import { invitationUrl } from "./policy";

export {
  DEFAULT_USER_ROLE,
  type GlobalRole,
  isPlatformAdmin,
  PLATFORM_ADMIN_ROLE,
} from "./roles";

import { ac, organizationRoles } from "./permissions";
import { createRequestGuards } from "./request-guards";

export type AuthConfig = {
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  CORS_ORIGIN: string;
  CONSOLE_ORIGIN: string;
  AGENT_ORIGIN: string;
  PLATFORM_ORIGIN: string;
};

export type AuthOptions = {
  desktopOrigins?: readonly string[];
  mailer?: InvitationMailer;
  audit?: AuditSink;
};

export function createAuth(
  env: AuthConfig,
  database: Database,
  options: AuthOptions = {}
) {
  const { desktopOrigins = [], mailer = noopInvitationMailer, audit } = options;
  const origins = { console: env.CONSOLE_ORIGIN, agent: env.AGENT_ORIGIN };

  return betterAuth({
    database: drizzleAdapter(database, {
      provider: "pg",
      schema,
    }),
    trustedOrigins: [
      env.CORS_ORIGIN,
      env.CONSOLE_ORIGIN,
      env.AGENT_ORIGIN,
      env.PLATFORM_ORIGIN,
      ...desktopOrigins,
      "workholo://",
      "exp://",
      "http://localhost:8081",
    ],
    emailAndPassword: { enabled: true },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    hooks: {
      before: createRequestGuards(database),
      after: createAuditHooks(audit),
    },
    advanced: {
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
        httpOnly: true,
      },
    },
    plugins: [
      expo(),
      admin({
        defaultRole: "user",
        adminRoles: ["platform_admin"],
        roles: { platform_admin: adminAc },
        impersonationSessionDuration: 60 * 60,
      }),
      organization({
        ac,
        roles: organizationRoles,
        creatorRole: "owner",
        organizationLimit: 1,
        schema: {
          organization: {
            additionalFields: {
              suspendedAt: { type: "date", required: false },
              suspendedReason: { type: "string", required: false },
              suspendedByUserId: { type: "string", required: false },
            },
          },
        },
        organizationHooks: createOrganizationHooks(database),
        sendInvitationEmail: async (data) => {
          await mailer.sendInvitation({
            invitationId: data.id,
            email: data.email,
            role: data.role,
            organizationName: data.organization.name,
            url: invitationUrl(data.role, data.id, origins),
          });
        },
      }),
    ],
  });
}

export type Session = ReturnType<typeof createAuth>["$Infer"]["Session"];
