# Design

## Context

See `proposal.md` for motivation and `specs/disposition-lists/spec.md` for the behavior contract. Organization-scoped requests use tenant-verified `consoleProcedure`; Drizzle schemas use organization foreign keys. The console already provides organization routing and shared forms and tables. Campaign history is not implemented yet.

## Goals / Non-Goals

**Goals:**

- Keep disposition resources isolated by organization and editable by owner/admin only.
- Preserve entry identity and label across retirement and list archival.
- Provide only current options to future campaign setup while keeping retired records readable.

**Non-Goals:**

- Implement campaigns, agent disposition selection, callbacks, or automated outcomes.
- Change the base organization role contracts or add team/agent permissions.

## Decisions

### Organization-owned lists and entries

Add disposition-list records keyed to the server-resolved organization and entry records keyed to their list. Every list and entry procedure uses `consoleProcedure`, checks organization ownership, and permits writes only to owners and admins. Keep these rules in this resource rather than modifying the organization role specs. Client-supplied organization IDs are never trusted for ownership.

### Immutable codes and labels; retire instead of delete

Create each entry with a unique machine code and label within its list. Treat both as immutable; if an option needs a different meaning or wording, add a new entry and retire the old one. Codes use a documented uppercase snake-case format so future integrations receive predictable identifiers. Enforce code and label uniqueness in storage, including retired entries, so historical values cannot be reused for a different meaning. A status marker retires entries without deleting them. Hard deletion and editing an existing entry's identity are rejected because they could make later history ambiguous.

### Archive lists, preserve history references

Archive a list by setting lifecycle state and retain its entry rows. Future history will reference stable entry IDs and preserve the code and label used at outcome time; keeping immutable entry records gives historical reads a fallback even when the source option is no longer active. Active option reads filter archived lists and retired entries. Avoid physically deleting lists or entries.

### Audit

Use the existing audit path for list/entry creation, archival, and retirement where supported. Include actor, organization, resource ID, and action; codes and labels are not contact data, but audit payloads should remain limited to resource identifiers and operation metadata. No campaign outcome event is created in this change.

## Risks / Trade-offs

- [Immutable labels make correcting a typo require a replacement entry] → allow retirement and creation of a replacement while preserving the old label for history.
- [Code format can constrain future integrations] → use a simple uppercase snake-case alphabet and keep it stable once the entry is created.
- [Future history must not depend on active-option queries] → expose a historical lookup by stable entry ID that includes retired entries and preserve code/label snapshots when outcomes are recorded.

## Migration Plan

1. Add disposition-list and entry tables with organization/list ownership, lifecycle fields, uniqueness constraints, relations, and a migration. No existing records need backfill.
2. Add tenant-scoped owner/admin API operations for list/entry management and separate active-option and historical-lookup reads.
3. Add console list and entry maintenance screens, including retire and archive actions.
4. Verify migration, role checks, cross-organization isolation, uniqueness, and retired-record resolution.

Rollback drops only the new tables after any new data is backed up or discarded. No existing records are modified.
