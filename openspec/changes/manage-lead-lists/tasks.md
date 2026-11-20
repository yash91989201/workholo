# Tasks

## 1. Lead list storage and API

- [ ] 1.1 Add organization-owned lead-list and lead tables, lifecycle fields, list-local active-number uniqueness, relations, and migration; verify schema generation and migration on a clean database.
- [ ] 1.2 Add owner/admin console procedures for list reads and CRUD with resolved-organization scoping; verify API tests cover agent denial and cross-organization access.
- [ ] 1.3 Add API-boundary E.164 validation and manual lead add/remove with stable records; verify tests cover formatting, missing country codes, duplicate rejection, and re-add after removal.

## 2. CSV import and audit

- [ ] 2.1 Implement bounded CSV parsing for phone and optional name columns with one result per data row; verify tests cover malformed rows, missing headers, and quoted fields.
- [ ] 2.2 Persist valid import rows independently and report invalid, existing, repeated, and concurrent duplicate outcomes; verify mixed-result and duplicate-race tests.
- [ ] 2.3 Record list and lead management audit events without raw contact details; verify audit tests assert actor, organization, action, and import outcome counts.

## 3. Console management and future options

- [ ] 3.1 Add console list overview and detail screens for create, edit, archive, manual add, and removal; verify route-level behavior and accessible form validation.
- [ ] 3.2 Add CSV upload and row-result presentation; verify valid rows remain visible when other rows fail and rejected rows show line numbers and reasons.
- [ ] 3.3 Add the active-list and active-lead read needed by future campaign setup; verify archived lists and removed leads are excluded and tenant scope is enforced.
- [ ] 3.4 Run the relevant API, database migration, and console checks together; verify the new feature works without changes to existing role contracts.
