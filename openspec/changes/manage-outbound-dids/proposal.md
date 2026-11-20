# Proposal

## Why

Outbound calling needs a reliable source of caller IDs that platform staff can manage and assign deliberately. Keeping the carrier-provisioned number inventory separate from organization assignments lets organizations see only numbers they can use while preserving platform ownership of the inventory.

## What Changes

- Add platform-managed inventory for carrier-provisioned E.164 numbers, with outbound enable/disable controls.
- Let platform staff assign or unassign inventory numbers to one organization at a time.
- Let an organization owner or administrator read only numbers assigned to that organization that are currently eligible for outbound use.
- Keep global number records after organization deletion while removing that organization's assignment rows under the existing tenant deletion rule.
- Exclude carrier purchases, random number choice, and call or campaign integration.

## Capabilities

### New Capabilities

- `outbound-number-inventory`: Platform-managed outbound number inventory, organization assignment, eligibility, and organization-scoped read access.

### Modified Capabilities

None.

## Impact

- Platform administration procedures and UI, organization console read access, API authorization, and persistence for global inventory and organization assignments.
- Existing platform-only access controls and organization tenant scoping provide the authorization baseline.
