# Proposal

## Why

Organizations need one dependable, tenant-scoped suppression set that future dispatch paths can consult before placing an outbound call. A normalized E.164 key makes entries consistent across lead sources and future integrations.

## What Changes

- Add one organization-wide do-not-dial set with add, list, remove, and organization-scoped lookup operations.
- Normalize valid E.164 inputs to one canonical stored number and prevent duplicate entries.
- Scope every entry and lookup to one organization, and remove its entries when that organization is deleted under the existing tenant deletion rule.
- Exclude campaign UI, dial/dispatch integration, exemptions, and any claim that the set establishes legal compliance.

## Capabilities

### New Capabilities

- `do-not-dial`: Organization-wide normalized E.164 suppression entries and scoped lookup for future dispatch.

### Modified Capabilities

None.

## Impact

- Organization-scoped API procedures, persistence, authorization, and console management for owners and administrators.
- Future call dispatch may consume the lookup contract in a separate change; this change does not alter calling behavior.
