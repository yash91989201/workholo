# Tasks

## 1. Auth schema and plugins

- [x] 1.1 Register `admin` and `organization` plugins in `packages/auth` with `defaultRole: "user"`, `adminRoles: ["platform_admin"]`, `organizationLimit: 1`, and custom access control; verify `bun run check-types` passes and the auth client infers `platform_admin`.
- [x] 1.2 Run `bun run auth:generate`; add user admin fields, organization/member/invitation tables, and organization suspension fields (`suspendedAt`, `suspendedReason`, `suspendedByUserId`); verify the generated migration includes those columns and tables.
- [x] 1.3 Add a unique index on `member.userId` and regenerate the migration; verify the migration SQL contains the index and `bun run db:generate` reports no pending diff.
- [x] 1.4 Apply the migration with `bun run db:migrate`; verify the tables and columns exist in Postgres.
- [x] 1.5 Regenerate Drizzle zod models and project types; verify the generator runs and `bun run check-types` passes.
- [x] 1.6 Document platform-admin provisioning (`auth create-admin --role platform_admin`) in the README; verify the documented command runs against a local database.

## 2. Access control and invariants

- [x] 2.1 Define the access-control statement and `owner`/`admin`/`agent` roles in `packages/auth/src/permissions.ts`, merging `defaultStatements` and `adminAc.statements` for owner and admin; verify a permission-matrix test asserts each role's allowed and denied actions.
- [x] 2.2 Enforce one membership per user in `beforeAddMember`/`beforeAcceptInvitation` hooks; verify tests reject a second invitation acceptance and a direct second add.
- [x] 2.3 Enforce the invitation chain in `beforeCreateInvitation`: admin invitations owner-only, agent invitations owner/admin, `owner` never invitable; verify tests for each combination.
- [x] 2.4 Enforce target-role rules for member updates and removals: admins cannot modify admins, owner-only admin removal; verify tests.
- [x] 2.5 Guard owner continuity in a transaction so the last owner cannot be removed or demoted; verify a test that attempts the change and asserts rejection.
- [x] 2.6 Route invitation emails by role (admin → console origin, agent → agent origin) behind a mailer interface; verify a test asserting the generated link origin per role.
- [x] 2.7 Emit evlog audit events for suspension, restore, delete, impersonation start/stop, and platform role change; verify the dev drain output contains actor, action, target, and timestamp.

## 3. Tenant request path

- [x] 3.1 Extend API context with `organizationId` and `membershipRole` and add `requireUser`, `requirePlatformAdmin`, and `requireOrg` middleware; verify tests for unauthenticated, missing organization, non-member, and suspended-organization responses.
- [x] 3.2 Add a query helper that always filters by the resolved organization and stamps it on create; verify a test that a cross-tenant update affects no rows.
- [x] 3.3 Expose org-scoped member and invitation procedures through `requireOrg`; verify an owner/admin/agent call succeeds per matrix and a non-member gets forbidden.
- [x] 3.4 Expose read procedures for organization call history and recordings, scoped to the organization and filtered to the caller for agents; verify with seeded rows that an agent sees only its own records and an admin sees all organization records.
- [x] 3.5 Add platform origins and CORS entries for the four frontends from env; verify a credentialed request from each configured origin is accepted and an unconfigured origin is rejected.

## 4. Platform administration

- [x] 4.1 Implement cross-tenant organization listing with search, pagination, member counts, and status; verify a test that lists organizations the caller has no membership in.
- [x] 4.2 Implement suspend and restore with actor and reason; verify a test that tenant procedures fail while suspended and succeed after restore.
- [x] 4.3 Implement organization deletion with cascade and audit; verify a test that memberships, invitations, and tenant rows are gone and an audit event exists.
- [x] 4.4 Configure impersonation (time limit, marked session, attribution, blocked for `platform_admin` targets) and stop-impersonation restore; verify tests for each rejection and for session restoration.
- [x] 4.5 Assert platform procedures reject owner, admin, and agent principals; verify tests.

## 5. Frontend split

- [x] 5.1 Extract `packages/auth-client` (organization + admin plugins, used per app) and `packages/api-client` from `apps/web/src`; verify both apps typecheck against them.
- [x] 5.2 Reduce `apps/web` to the landing site and remove auth/dashboard routes; verify only landing routes are generated and the register CTA points at the console.
- [x] 5.3 Scaffold `apps/console` with sign-in, sign-up, create-organization onboarding, role-gated navigation, and the admin/member/invitation screens; verify the owner and admin flows end to end.
- [x] 5.4 Scaffold `apps/agent` with agent-only gating and move the Tauri shell into it; verify an owner account is denied entry and an agent account reaches the panel.
- [x] 5.5 Scaffold `apps/platform` with organization listing, suspension, deletion, and impersonation; verify a platform admin completes each action and a non-platform user is denied.
- [x] 5.6 Add per-app Dockerfile/nginx, Nx `production` inputs, and root `dev:*` scripts; verify `bun run build` builds all four frontends and the server.
- [x] 5.7 Document per-app environment variables and deployment origins; verify each documented variable is read by its app.

## 6. Integration verification

- [x] 6.1 Run the full owner-to-agent journey: owner registers and creates an organization, invites an admin, admin accepts, invites an agent, agent accepts; verify each surface lands on the correct domain and role.
- [x] 6.2 Run a cross-tenant sweep for owner, admin, and agent against another organization's records; verify every request is rejected.
- [x] 6.3 Run `bun run check-types`, `bun run build`, and `bunx ultracite check`; verify all pass.

## Workflow follow-up

- Archive the change after review.
- Telephony work must enforce monitor/whisper/barge at the media layer; this change only authorizes the actions.
