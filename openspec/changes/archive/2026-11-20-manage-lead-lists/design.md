# Design

## Context

See `proposal.md` for motivation and `specs/lead-lists/spec.md` for the behavior contract. The API already provides tenant-verified `consoleProcedure`; Drizzle tables use an `organizationId` foreign key. The console already has organization routing and shared forms and tables. There is no existing lead or campaign storage.

## Goals / Non-Goals

**Goals:**

- Keep list and lead ownership explicit and enforce organization scoping in every read and write.
- Make phone validation, duplicate policy, and partial CSV row outcomes deterministic.
- Retain stable lead and list identities when they are no longer available for future setup.

**Non-Goals:**

- Build campaign assignment, calling, retries, history, suppression, list templates, or custom fields.
- Change the meaning of existing organization roles or introduce team/agent list permissions.

## Decisions

### Tenant-owned records and console authorization

Add list and lead records in the shared database schema. Lists store the resolved organization ID, name, description, and archive state. Leads reference a list, keep a stable ID, store canonical E.164 and optional name, and use a removal marker instead of hard deletion. Every API procedure uses `consoleProcedure`, verifies list ownership through the resolved organization, and restricts writes to owner/admin actors. This keeps resource access local to the capability and follows the existing tenant boundary. Directly accepting an organization ID as authority or using client-side role hiding is rejected because neither enforces server-side isolation.

### Canonical phone storage and list-local uniqueness

Validate and normalize numbers at the API boundary using the project's installed phone-number support if available; do not apply a default country. Store only canonical E.164. Enforce uniqueness on `(listId, canonicalPhone)` for non-removed leads. This prevents concurrent requests from bypassing the duplicate rule. A removed number can be re-added as a new lead while its old stable ID remains available for future historical references; retain the old record as removed. Organization-wide uniqueness is rejected because the same contact may legitimately appear in separate lists.

### Row-oriented CSV import

Accept CSV with a phone-number column and optional name column. Parse and validate rows independently, preserving input row numbers. Treat the first row as the header and reject a file whose required phone-number column is missing. Against both existing active leads and earlier valid rows in the file, accept only the first occurrence of each canonical number; report later occurrences as duplicates. Persist valid rows even when other rows fail, then return one result per data row. Do not use a whole-file rollback because users need actionable partial-import results.

### Archival and future setup options

Archive lists and remove leads by setting lifecycle markers; never cascade-delete leads when archiving a list. The future-setup read returns active lists and non-removed leads for the resolved organization, excluding archived lists. This provides a clean future campaign option surface without adding campaign coupling now.

### Audit

Record list creation, updates, archival, manual lead changes, and imports through the existing audit mechanism when the database/API audit patterns support these actions. Import audit data should identify the actor, organization, list, and row outcome counts; do not log raw phone numbers or names. The resource-specific spec does not change the base role model.

## Risks / Trade-offs

- [CSV encodings, malformed quoting, or oversized files can make row results unreliable] → use a bounded parser and explicit file-size/row limits; report structural parse errors before writes.
- [Concurrent imports can race on the same number] → rely on a database uniqueness constraint and translate conflicts into duplicate row results.
- [Retained removed records increase storage and may contain personal data] → exclude them from active reads, keep only fields required for future references, and follow the product's eventual retention policy.
- [Phone formatting can look valid while lacking a country code] → require explicit international input and never infer a locale.

## Migration Plan

1. Add organization-owned lead-list and list-owned lead tables, indexes, and a migration; existing data needs no backfill.
2. Add tenant-scoped API reads and writes with role checks, normalization, duplicate handling, and audit events.
3. Add console list maintenance, manual entry, CSV import results, and active future-setup options.
4. Verify migrations on a clean and existing development database and exercise cross-organization and import edge cases.

Rollback drops the new tables after any newly created lead data has been explicitly backed up or discarded; no existing tables are modified.
