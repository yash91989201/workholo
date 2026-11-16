import { ac, organizationRoles } from "@workholo/auth/permissions";
import { adminClient, organizationClient } from "better-auth/client/plugins";
import type { AccessControl, Role } from "better-auth/plugins/access";
import { adminAc, userAc } from "better-auth/plugins/admin/access";
import { createAuthClient } from "better-auth/react";

function authBaseUrl(serverUrl: string): string {
  const trimmed = serverUrl.replace(/\/$/, "");
  return `${trimmed}/api/auth`;
}

/**
 * Client-side cast only: the plugin option is typed against the broad
 * `AccessControl`, while the server instance carries the extended statements.
 */
const clientAc = ac as AccessControl;
const clientRoles = organizationRoles as Record<string, Role>;

const organizationOptions = {
  ac: clientAc,
  roles: clientRoles,
};

/** Console and agent clients: organization plugin only. */
export function createOrgAuthClient(serverUrl: string) {
  return createAuthClient({
    baseURL: authBaseUrl(serverUrl),
    plugins: [organizationClient(organizationOptions)],
  });
}

/** Platform client: organization plugin plus admin plugin for impersonation. */
export function createAdminAuthClient(serverUrl: string) {
  return createAuthClient({
    baseURL: authBaseUrl(serverUrl),
    plugins: [
      organizationClient(organizationOptions),
      adminClient({ roles: { platform_admin: adminAc, user: userAc } }),
    ],
  });
}
