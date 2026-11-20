# Design

## Context

The organization console uses `consoleProcedure` for owner/admin actions and the existing organization router for agent and team selectors. The resource changes supply reusable live lead lists, disposition lists, and eligible DIDs. See [proposal.md](proposal.md) for the build order and [spec.md](specs/preview-campaigns/spec.md) for the activation contract.

## Goals / Non-Goals

- Give the console and calling service adapter one validated representation of Preview settings.
- Keep campaign setup usable before call dispatch is deployed. An active campaign is configured work, and agents can dial it only once the calling change is enabled.

## Decisions

1. **Relational references.** Use a tenant-scoped campaign record and ordered relations for selected lead lists and caller IDs. Store assignment as exactly one existing membership or team at activation. Reuse the existing roster queries and require the assigned member to hold the agent role. Resolve team membership live so roster changes take effect naturally.
2. **Draft and activation validation.** Draft writes accept omissions and validate any supplied reference and setting. Activation loads live choices, checks that selected lists are usable (including a live lead across selected lists and a disposition list with a live option), and returns field errors atomically. Archived lists, empty teams, and unassigned or disabled DIDs fail activation. When a dependency is retired after activation, the calling change blocks affected work using current eligibility.
3. **Explicit state and revision.** Support draft or paused to active, active to paused, and draft or paused to archived. Serialize state transitions with a row version check. Both pause and activation increment a revision that runtime previews capture. This prevents a pause and quick reactivation from reviving outdated previews.
4. **Timer and policy representation.** Store preview, customer ring, wrap-up, and after-call work in whole seconds and retry interval in whole minutes. Label the UI field “Customer ring timeout” and show its units. The proposed 1–120 second bound is shared with telephony-service. Store one preview method discriminator, one disposition-list reference, the fixed or random DID policy, selected dial statuses (`new`, `not_answered` initially), and retry count. An unset retry interval represents disabled retries when count is zero.
5. **Admin surface.** Add campaign list, draft edit, and lifecycle actions under the existing organization console shell. Use the API's resource choices and field errors for form state. The server remains authoritative if a choice changes while the form is open.

## Risks / Trade-offs

- A valid active campaign can become unavailable as linked resources change. Revalidate at dispatch and show an actionable cause to the agent or admin.
- Per-agent selection, configurable traversal order, and other follow-on controls need their own policy rules. Store the first release settings directly and evolve when a second behavior needs them.

## Migration Plan

Apply the campaign schema after the lead, disposition, and DID schemas. Existing tenants start with no campaigns. On application rollback, retain campaign rows for a later redeploy.
