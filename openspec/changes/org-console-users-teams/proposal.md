# Proposal

## Why

The console can create an organization but cannot manage one. Owners and admins have no way to see the roster, invite admins or agents, review pending invitations, or group agents into teams. The Better Auth organization plugin has team support that the codebase has not enabled, and its member listing is too narrow for a full directory.

## What Changes

- Enable the organization plugin's team support: `team` and `teamMember` tables, `invitation.teamId`, and a `team` permission set for the `admin` role.
- Agent invitations MUST name a team; admin invitations MUST NOT name a team. Accepting an agent invitation adds the new member to the named team.
- Teams are agent groups: only members with the `agent` role may join a team, and an agent may belong to several teams.
- Add organization-scoped console reads for the member directory, pending invitations, teams with member counts, and team rosters. The directory is a dedicated read and does not use the plugin's `listMembers` endpoint.
- Restructure the console: auth routes stay at the root, an organization shell owns `/:orgSlug/*`, and the sidebar is the shadcn `sidebar-07` layout.
- Build console pages for All Users, Add User, Pending Users, Teams, Team detail, and All Members.

## Capabilities

### New Capabilities

- `organization-teams`: team creation, rename, and deletion; agent team membership; team visibility scoped to one organization.

### Modified Capabilities

- `organizations`: the invitation chain gains a team requirement for agent invitations, and the console gains a full member directory read.

## Impact

- `packages/db/src/schema/auth.ts` plus a migration: new `team` and `teamMember` tables, `invitation.teamId`.
- `packages/auth`: organization plugin options, `admin` access-control statements, invitation and team-member hooks.
- `packages/api/src/routers/organization.ts`: member directory, invitations, teams, team rosters.
- `apps/console`: new `/:orgSlug` shell, sidebar components, and six pages; removed root header and dead `/members` link.
- `packages/ui`: no new primitives expected; existing `sidebar`, `table`, `dialog`, `select`, `dropdown-menu`, `collapsible`, `breadcrumb`, `avatar` are reused.
