# Design

## Context

See `proposal.md` for motivation. Current constraints that shape the approach:

- Better Auth `1.7.22`, Drizzle adapter (`@better-auth/drizzle-adapter/relations-v2`), Postgres, Elysia + oRPC on one server, TanStack Router SPAs, Nx monorepo.
- Auth today: email/password + Expo plugin only. No admin fields, no organization tables, no roles.
- `packages/api` context is `{ db, session }`; `protectedProcedure` checks only that a session exists.
- `apps/web` is the only SPA and holds `/login`, `/dashboard`, Docker/nginx, and the Tauri shell.
- `evlog` is already wired for structured logging.

## Goals / Non-Goals

**Goals**

- One auth backend serving four deployed frontends and the native app.
- An authorization path that cannot read or write across organizations, independent of session state.
- Owner/admin/agent permissions matching the capability specs, enforced server-side.
- Platform staff operations that are cross-tenant and audited.

**Non-Goals**

- Telephony media transport for monitor/whisper/barge. This change authorizes the actions; the media layer must enforce them separately.
- Billing, marketing content, native calling UI, white-label per-tenant domains.
- Row-level security in Postgres.

## Decisions

### One auth backend, four SPAs

`apps/web` becomes the landing site; `apps/console`, `apps/agent`, `apps/platform` are new. All call `api.domain.com`.

Alternatives: per-surface auth backends (duplicated sessions, four migrations) and a BFF per app (extra hop, more code). Rejected. Cross-app duplication of Docker/nginx/router shells is accepted deliberately; the shared auth client and oRPC client live in packages so session logic is not forked.

### Global role named `platform_admin`

Admin plugin config: `defaultRole: "user"`, `adminRoles: ["platform_admin"]`. The first administrator is provisioned with the CLI (`auth create-admin --role platform_admin`), never through a public endpoint.

Alternative: keep the plugin default `admin` globally, which collides with the organization role `admin` and makes every permission bug a naming question. Rejected.

### Custom access control with three organization roles

`createAccessControl` statement roughly:

```
organization: [update, delete]
member:       [create, update, delete]
invitation:   [create, cancel]
call:         [read, monitor, whisper, barge]
recording:    [read]
```

- `owner`: organization update/delete, all member and invitation actions, call/recording read.
- `admin`: member and invitation actions, call read, monitor/whisper/barge, recording read. No organization settings.
- `agent`: call read for own calls only, recording read for own calls only.

Better Auth overrides default role permissions when a custom role is passed, so `owner` and `admin` must merge `defaultStatements` and `adminAc.statements`. `agent` starts from the empty default. Multiple roles per membership (comma-separated) are technically supported but unused: one role per member keeps the matrix unambiguous.

Coarse actions are insufficient for "admin manages agents, not admins", so `organizationHooks` / `databaseHooks` enforce role targets: only the owner may create or modify `admin` memberships, and `owner` cannot be invited.

### One organization per user

`organizationLimit: 1` on the plugin, plus a unique index on `member.userId`. Creation requires an authenticated user with zero memberships; invitation acceptance is rejected when a membership already exists.

Alternative: multi-org membership with an org switcher. Rejected by product decision; the schema stays one-to-many so a future switcher is additive.

### Explicit organization id per request

Org-scoped procedures take `organizationId` and verify membership. `session.activeOrganizationId` is not used for authorization: the cookie cache can serve a stale value after membership changes, and four apps sharing one session would otherwise share mutable tenant state.

Alternative: derive tenant from session active organization (plugin convention) or from subdomain (not doing per-tenant domains). Rejected.

Context shape: `{ db, session, organizationId, membershipRole }` for org scoped procedures; `{ db, session }` for platform and public ones.

### Middleware layering

```
requireUser            session exists
requirePlatformAdmin   user.role === platform_admin
requireOrg             organizationId present -> membership lookup ->
                       organization not suspended -> role/permission check
```

Membership is read from the database per request. The cookie cache is treated as an optimization, never as proof of membership.

### Open signup, gated by membership

Registration is public; anyone may create an account and then one organization, becoming its owner. A user with no membership is routed to console onboarding. Surface gates: platform requires `platform_admin`, console requires `owner` or `admin` membership, agent requires `agent` membership.

Alternative: `disableSignUp` with invitation-only provisioning (rejected: owner self-serve is required) or a surface-aware signup hook (origin checks are spoofable and the hook cannot tell a console visitor from an agent invitee reliably).

### Invitations route by role

`sendInvitationEmail` maps `admin` to the console origin and `agent` to the agent origin. Both require a signed-in session whose email matches the invitation; open signup makes the new-user path work (register with the invited email, then accept). Pending invitations expire (default 48 h) and are cancellable.

### Platform operations are custom procedures

The organization plugin lists only the caller's organizations, so platform listing, suspension, deletion, and impersonation live in `platform` oRPC procedures backed by direct queries. Suspension is stored on the organization (`suspendedAt`, `suspendedReason`, `suspendedByUserId`). Impersonation uses the admin plugin's endpoint; the resulting session is marked, attributed, and time-limited.

Alternative: force platform staff into memberships and use plugin APIs. Rejected; it breaks the one-membership rule.

### Audit through evlog

Suspension, restore, deletion, impersonation start/stop, and platform role changes emit structured audit events with actor, action, target, timestamp. No new audit table in this change.

### Shared client packages

`packages/auth-client` exports the Better Auth client with `organizationClient` and (for console/platform only) `adminClient`; `packages/api-client` exports the oRPC utilities. The agent bundle omits `adminClient`.

## Risks / Trade-offs

- [Shared API cookie means one browser is signed into every surface] → Surface gates and per-procedure permissions; do not claim domain separation as isolation.
- [Session cookie cache can be stale] → Membership and suspension checks always hit the database.
- [Open signup allows organization spam] → Platform suspension, rate limits on auth endpoints, and plan-based `allowUserToCreateOrganization` later.
- [Unique `member.userId` fights the plugin's multi-org invitation flow] → `beforeAddMember` / `beforeAcceptInvitation` hooks reject early with a clear error, not a raw constraint failure.
- [Invitation role escalation] → Hooks validate the role against the inviter's role; UI hiding is not enough.
- [Last-owner race under concurrent role changes] → Serialize owner changes in a transaction and re-check the owner count.
- [Future tenant tables may omit `organizationId`] → Treat it as a schema convention reviewed in every model change; no RLS backstop.
- [Missing mailer dependency] → Invitation sending needs an email provider; the interface can land first.
- [Media layer bypass] → Monitor/whisper/barge must be authorized again at call control, not only in oRPC.

## Migration Plan

1. Add `admin` and `organization` plugins, schema columns/tables, and suspension fields; run `auth generate` + Drizzle migration. Additive only.
2. Regenerate `packages/db/src/lib/models` and types.
3. Add auth client + api-client packages and the middleware/procedures.
4. Move auth routes into `apps/console`; reduce `apps/web` to landing.
5. Scaffold `apps/agent` (with Tauri) and `apps/platform`; add origins to `trustedOrigins` and CORS.
6. Provision the first `platform_admin` out of band.
7. Rollback: redeploy the previous frontends; new tables and nullable columns do not break the old build. Removing plugins requires an explicit down migration and is not part of rollback.

No backfill needed: tenancy is greenfield.

## Open Questions

- Which email provider sends invitations. Interface shape is unaffected.
- Audit retention and export policy; evlog drain is sufficient for now.
- Per-tenant subdomains for white-label agents, deferred; explicit-org routing keeps the door open.
