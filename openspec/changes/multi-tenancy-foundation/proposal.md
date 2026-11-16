# Proposal

## Why

The application will host multiple organizations, but authentication is currently a single global session with no tenant context and no roles. Four separately deployed surfaces (landing, organization console, agent panel, platform staff) need one shared auth backend, a tenant boundary that every request respects, and distinct owner/admin/agent permissions.

## What Changes

- Add Better Auth `admin` and `organization` plugins. Platform role becomes `platform_admin` (global `user.role`); organization roles become `owner`, `admin`, `agent` via custom access control.
- Organization signup is self-serve from the console: an authenticated user with no membership creates one organization and becomes its owner. One organization per user, enforced in schema and plugin config.
- Invitations carry the role and route to the correct surface: `admin` invitations open the console, `agent` invitations open the agent panel. Owner invites admins; owner and admin invite agents. Role escalation is rejected in hooks, not only hidden in the UI.
- Add `organizationId` to every tenant-owned domain table, with cascade deletes. Every org-scoped server procedure resolves an explicit organization id and verifies membership before touching data. `session.activeOrganizationId` is not the authorization source.
- Split frontends by audience and deployment: `apps/web` becomes the public landing site, plus new `apps/console`, `apps/agent` (also hosts the Tauri desktop shell), and `apps/platform`.
- Add platform staff procedures for cross-organization listing, suspension, and audited impersonation. The organization plugin's per-user listing is not sufficient for platform scope.
- Share the auth client and oRPC client from packages so four apps do not fork session logic. **BREAKING**: the auth dashboard and org routes leave `apps/web`; existing `/login` and `/dashboard` URLs move to the console.

## Capabilities

### New Capabilities

- `authentication`: email/password signup and sign-in, session issuance, the global platform role, and surface gating. Covers who may authenticate on which surface without making surface a security boundary.
- `organizations`: organization creation, one-org-per-user membership, the owner/admin/agent role model, and the invitation chain including role-escalation rejection.
- `tenancy`: the tenant key on domain tables, per-request organization resolution, membership verification, and suspended-organization rejection. Covers isolation guarantees for every org-scoped procedure.
- `platform-administration`: cross-tenant organization listing, suspension and restore, and audited user impersonation available only to `platform_admin`.

### Modified Capabilities

None. The project has no existing specs.

## Impact

- `packages/auth`: plugin registration, access-control statements and roles, database hooks, invitation email routing.
- `packages/db`: user admin fields, organization/member/invitation tables, `organizationId` on domain tables, generated models, migration.
- `packages/api`: context gains organizationId and role; new org-scoped and platform-scoped middleware and procedures.
- `apps/server`: trusted origins and CORS for four frontend origins; platform procedures; mailer for invitations.
- `apps/web`: reduced to landing. `apps/console`, `apps/agent`, `apps/platform` added, plus shared auth/orpc client packages, Nx inputs, Docker/nginx per app, and root scripts.
- Out of scope: telephony media path (barge-in/whisper transport), billing, marketing content, native calling UI.
