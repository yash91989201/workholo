# Design

## Context

See `proposal.md` for motivation and `specs/` for requirements. Current state that shapes the approach:

- `createAuth` enables `organization` with custom `owner/admin/agent` roles; `teams` is off, and no team tables exist.
- `organizationHooks` already enforce invitation role rules and owner continuity; `request-guards` enforce actor-to-target rules for member updates and removals.
- `packages/api` exposes tenant-verified procedures (`consoleProcedure`) and one console read (`organization.members`). `packages/api-client` creates oRPC TanStack Query utils.
- Console routes are flat (`/dashboard`, `/onboarding`, …) with a global header and no org slug.
- `packages/ui` already ships shadcn `sidebar`, `table`, `dialog`, `select`, `dropdown-menu`, `collapsible`, `breadcrumb`, `avatar`, plus a TanStack Form integration (`useAppForm`, `FormInput`, `FormSelect`). `@tanstack/react-table` is not installed.
- The Better Auth `listTeamMembers` endpoint requires the caller to be a member of the team, so it cannot serve an owner/admin viewing an agent team.

## Goals / Non-Goals

**Goals:**

- Reach the change through the plugin's own team storage and invitation acceptance path, without hand-rolling team data rules that the plugin already enforces.
- Keep every read tenant-verified in one place (`consoleProcedure`) and every policy write in the existing hooks/guards.
- One console URL shape (`/:orgSlug/...`) that scales to later features.

**Non-Goals:**

- RBAC nav gating, role-based hiding of pages, or per-action UI permissions.
- Pagination, search, sorting, bulk actions, or invite resend.
- Org settings, billing, call history, supervision.
- Agent-panel changes. Agent invitations keep their existing agent-panel link.

## Decisions

### 1. Enable plugin teams, do not hand-roll team storage

Set `teams: { enabled: true, defaultTeam: { enabled: false } }` and add `team`, `teamMember`, `invitation.teamId` to the Drizzle schema.

- Rationale: the plugin already validates that an added user is an organization member, that the team belongs to the organization, that invitees match the team, and auto-adds the accepted invitee to the named team. Hand-rolling duplicates all of that.
- Alternative rejected: oRPC CRUD over new tables. More code, loses invitation-to-team integration.
- `defaultTeam` off so every organization does not start with a meaningless team.
- Admin needs `team: ["create", "update", "delete"]` in `permissions.ts`; owner already inherits `defaultStatements`. This is one capability line, not RBAC work.

### 2. All reads through oRPC console procedures

Add to `organizationRouter` (all `consoleProcedure`): `directory` (all members with role, teams, joined date), `invitations` (pending only, with team name), `teams` (with member count), `teamMembers(teamId)`.

- Rationale: user explicitly rejected the plugin's `listMembers` restriction for the directory; `listTeamMembers` rejects callers outside the team; and one guard keeps scoping consistent.
- `organization.members` is replaced by `directory` to keep one roster endpoint (owner/admin/agent plus team names).
- Alternative rejected: mixing plugin list endpoints per page. Different permission checks, different filters, two shapes.

### 3. Mutations through the Better Auth client

Use `authClient.organization.createTeam/updateTeam/removeTeam/addTeamMember/removeTeamMember`, `inviteMember`, `cancelInvitation`, `updateMemberRole`, `removeMember`.

- Rationale: policy lives in `organizationHooks` and `requestGuards`; calling those endpoints keeps one enforcement path. oRPC mutations would bypass or duplicate it.
- UI invalidates the oRPC queries after each mutation.

### 4. Invitation team rule in `beforeCreateInvitation`

Extend the hook: `agent` requires a `teamId`, any other role must not carry one. The plugin validates the team belongs to the organization.

- Rationale: one hook already owns invite rules; extending it keeps the chain coherent.
- Alternative rejected: separate oRPC invite endpoint — duplicates expiry, email link, and acceptance.

### 5. Agent-only team membership in `beforeAddTeamMember`

Extend hooks: reject adding a member whose role is not `agent`. Plugin `findOrCreateTeamMember` already prevents duplicates.

- Rationale: teams are agent groups; the plugin alone allows any organization member.

### 6. Console route layout

```
/login  /accept-invitation  /onboarding  /denied      root auth routes (exists)
/                                                      -> redirect to /:orgSlug/dashboard
/_auth/$orgSlug                                       guard + sidebar shell
  /dashboard
  /users  /users/add  /users/pending
  /teams  /teams/members  /teams/$teamId
```

- `_auth` keeps session + membership + owner/admin gate. New `$orgSlug` layout compares the route slug to `membership.slug` and redirects on mismatch; it renders `SidebarProvider` + `AppSidebar` + `SidebarInset`.
- Static `teams/members` wins over `teams/$teamId`.
- Root header is removed; the shell owns navigation. Auth pages stay header-free like today.
- Redirect targets updated in `/`, `/onboarding`, `/accept-invitation`.

### 7. Sidebar-07 adapted into the console

Copy the block's component structure into `apps/console/src/components/sidebar/`: `app-sidebar`, `nav-main`, `nav-user`, org switcher. Reuse `@workholo/ui` primitives. The block's team switcher becomes a static organization identity because a member has one organization.

### 8. TanStack-only UI stack

- Tables: `@tanstack/react-table` (new dependency, added to the root catalog and the console package) with shadcn `Table` primitives for rendering. Columns: all users (name, email, role, teams, joined, actions), pending (email, role, team, expires, actions), teams (name, members, created, actions), team roster (name, email, joined, actions).
- Forms: `useAppForm` from `@workholo/ui/components/form/hooks` with `Input`/`Select` fields and a zod `onSubmit` validator. One form per page; no new form wrapper.
- Server state: `useQuery`/`useSuspenseQuery` with `orpc.organization.<read>.queryOptions({ input: { organizationId } })`; mutations via `useMutation` for oRPC and direct awaits + `queryClient.invalidateQueries({ queryKey: orpc.organization.key() })` for Better Auth calls. Route loaders use `ensureQueryData` where the page should not flash.
- Organization id comes from the `$orgSlug` layout context (`organization.me`), not from the URL segment at request time.

## Risks / Trade-offs

- [Team endpoints reject admin until statements change] → ship the `permissions.ts` line with the schema step; verify with a `createTeam` call before building UI.
- [Migration on an existing dev database] → the change is additive only; `db:generate` then `db:migrate`. Rollback drops the three new columns/tables, no user data touched.
- [`invitation.teamId` stores comma-joined ids] → plugin behavior; read the first id for display, never parse as an id list in our code.
- [Directory read duplicates plugin member data] → one endpoint returns member + user + teams; do not call plugin listing anywhere.
- [Slug drift between session and route] → layout compares against `organization.me`, redirects to the correct slug; no slug-authoritative authorization.
- [Added dependency] → `@tanstack/react-table` is small and matches the stack rule; no alternative table library introduced.

## Migration Plan

1. Schema + migration: `team`, `teamMember`, `invitation.teamId`.
2. Auth options and permission statements; hooks.
3. oRPC reads.
4. Console shell, then pages.
5. Restart dev server; existing memberships and invitations remain valid. No backfill needed because no team assignments exist before this change.
