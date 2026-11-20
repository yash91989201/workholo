# Tasks

## 1. Disposition storage and API

- [x] 1.1 Add organization-owned disposition-list and entry tables, lifecycle fields, immutable unique codes/labels, relations, and migration; verify schema generation and migration on a clean database.
- [x] 1.2 Add owner/admin console procedures for list and entry creation, listing, archive, and retirement with tenant scoping; verify tests cover agent denial and cross-organization access.
- [x] 1.3 Enforce uppercase snake-case codes and immutable entry code/label values; verify tests cover invalid format, duplicate code/label, and attempted edits.
- [x] 1.4 Add separate active-option and historical-entry reads, including retired entries for history lookup; verify archived/retired entries are omitted from options and resolvable by stable ID.

## 2. Audit and console management

- [x] 2.1 Record list and entry lifecycle operations through the existing audit path; verify audit tests cover actor, organization, resource, and action.
- [x] 2.2 Add console list and entry maintenance screens with retire/archive actions; verify accessible form validation and lifecycle behavior.
- [x] 2.3 Run the relevant API, migration, and console checks together; verify historical lookup remains separate from future setup options and existing role contracts are unchanged.
