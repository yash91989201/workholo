# Proposal

## Why

Campaign setup needs reusable organization-owned lead lists, but organizations currently have no way to maintain the customer numbers campaigns will use. A first release should make manual entry and CSV import reliable while keeping each number normalized and duplicates predictable.

## What Changes

- Add organization-scoped lead lists with a name, optional description, and normalized leads containing an explicit E.164 phone number and optional name.
- Allow authorized console users to create and manage lists and enter leads manually or import CSV rows with a result for each row.
- Define duplicate handling within a list and allow leads to be removed and lists archived without erasing records needed by future campaign history.
- Expose active lead lists and their usable options for later campaign setup; do not implement campaign execution or assignment here.

## Capabilities

### New Capabilities

- `lead-lists`: Organization-owned lead lists, lead entry and CSV import, lifecycle, and future campaign setup options.

### Modified Capabilities

None. Resource-specific access rules belong to the new capability; existing role contracts remain unchanged.

## Impact

- Expected implementation areas: Drizzle schema and migrations, organization console oRPC procedures and screens, and CSV parsing/row reporting.
- No new dependency is assumed; implementation should reuse existing form, table, and tenant-scoping patterns.
- No campaign behavior, teams/agents assignment, suppression list, or custom field builder is included.
