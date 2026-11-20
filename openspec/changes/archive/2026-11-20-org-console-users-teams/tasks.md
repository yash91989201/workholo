# Tasks

## 1. Data and auth foundation

- [x] 1.1 Add `team`, `teamMember`, `invitation.teamId`, and their relations to `packages/db/src/schema/auth.ts`; run `bun run db:generate` and confirm the generated SQL adds two tables and one column.
- [x] 1.2 Enable the plugin: `teams: { enabled: true, defaultTeam: { enabled: false } }` in `packages/auth/src/index.ts` and the matching client option in `packages/auth-client/src/index.ts`; `check-types` passes for both packages.
- [x] 1.3 Add `team: ["create", "update", "delete"]` to the `admin` role in `packages/auth/src/permissions.ts`; extend `permissions.test.ts` so admin can create a team and agent cannot.
- [x] 1.4 Extend `beforeCreateInvitation`: `agent` requires a `teamId`, every other role rejects one; unit test both rejections and the valid agent case.
- [x] 1.5 Extend organization hooks with `beforeAddTeamMember` rejecting non-`agent` roles; unit test that an admin target is rejected and an agent target passes.
- [x] 1.6 Run `bun run db:migrate` against the dev database and confirm `team` and `team_member` exist with the new `invitation.team_id` column.

## 2. Console reads

- [x] 2.1 Replace `organization.members` with `organization.directory` returning member id, user name/email, role, joined date, and team names; tenant integration test proves another organization's members never appear.
- [x] 2.2 Add `organization.invitations` returning pending invitations with email, role, team name, and expiry; integration test proves accepted/cancelled rows are excluded and cross-organization reads are rejected.
- [x] 2.3 Add `organization.teams` with member count and created date; integration test proves scoping to the resolved organization.
- [x] 2.4 Add `organization.teamMembers(teamId)` returning agent name, email, and joined date; integration test proves a team id from another organization is rejected.
- [x] 2.5 Confirm router typing: `check-types` passes for `@workholo/api` and `@workholo/api-client`.

## 3. Console shell

- [x] 3.1 Add `@tanstack/react-table` to the root catalog and `apps/console/package.json`; `bun install` succeeds and the console typecheck passes with an empty table column config.
- [x] 3.2 Build `apps/console/src/components/sidebar/` from the sidebar-07 structure (`app-sidebar`, `nav-main`, `nav-user`, static org switcher) using existing `@workholo/ui` primitives; the sidebar renders with Users and Teams groups in the dev server.
- [x] 3.3 Add `routes/_auth/$orgSlug/route.tsx` with slug-vs-membership guard and `SidebarProvider` shell; move dashboard under it.
- [x] 3.4 Update redirects in `routes/index.tsx`, `routes/onboarding.tsx`, and `routes/accept-invitation.tsx` to `/$orgSlug/dashboard`; remove the root header and its dead `/members` link.
- [x] 3.5 Verify in the dev server: sign-in lands on `/:slug/dashboard`, a wrong slug redirects to the correct one, an agent lands on `/denied`, and a suspended organization shows the banner.

## 4. Users pages

- [x] 4.1 Build `/$orgSlug/users` with a TanStack Table over `organization.directory`: name, email, role, teams, joined, row actions. Verify owner changes an admin to agent and removing the last owner returns the continuity error.
- [x] 4.2 Build `/$orgSlug/users/add` using `useAppForm` with email, role select (owner sees admin/agent, admin sees agent only), and a required team select for agent; the request calls `inviteMember` with `teamId`. Verify the new invitation appears in Pending with its team.
- [x] 4.3 Build `/$orgSlug/users/pending` with a TanStack Table over `organization.invitations` and a cancel action; verify a cancelled invitation can no longer be accepted.

## 5. Teams pages

- [x] 5.1 Build `/$orgSlug/teams` with a TanStack Table (name, members, created) and a create dialog calling `createTeam`; rename and delete actions included. Verify delete removes the team but keeps organization members.
- [x] 5.2 Build `/$orgSlug/teams/$teamId` with the roster from `organization.teamMembers` and an add-agent select limited to organization agents not already in the team; verify adding an admin is rejected and adding the same agent twice creates no duplicate.
- [x] 5.3 Build `/$orgSlug/teams/members` with the full directory table (all roles, team column); verify owner, admins, and agents all appear.

## 6. Integration verification

- [x] 6.1 Run `bunx ultracite fix`, `bun run check-types`, `bun run build`, and the auth/API test suites; all pass.
- [x] 6.2 Walk the full flow in the dev server: owner invites an admin without a team, admin invites an agent with a team, the agent accepts from the agent panel, and the team roster plus directory both show the new membership.

## Workflow follow-up

- Archive the change after review.
