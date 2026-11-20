# Proposal

## Why

Future campaigns need organization-managed outcome choices so agents can classify completed calls consistently. Stable codes and non-destructive retirement let future campaign and call history keep referring to an outcome after it stops being offered for new use.

## What Changes

- Add organization-owned disposition lists with a name, optional description, and coded entries with labels.
- Let authorized console users create and maintain lists and entries, while preserving stable codes and history compatibility when entries are retired.
- Expose active disposition lists and entries as options for future campaign setup.
- Keep callback automation, automatic dispositions, and campaign execution out of this change.

## Capabilities

### New Capabilities

- `disposition-lists`: Organization-owned disposition lists and stable, retireable outcome entries for future campaign use.

### Modified Capabilities

None. Resource-specific access rules belong to the new capability; existing role contracts remain unchanged.

## Impact

- Expected implementation areas: Drizzle schema and migrations, organization console oRPC procedures, and console list management screens.
- No new dependency is assumed; implementation should reuse existing form, table, and tenant-scoping patterns.
- No campaign execution, agent callback automation, or automatic disposition behavior is included.
