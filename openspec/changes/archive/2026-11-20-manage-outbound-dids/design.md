# Design

## Context

The platform API already has a platform-admin-only procedure layer. Organization-owned records use organization foreign keys with cascade deletion. See proposal.md and specs/outbound-number-inventory/spec.md for the behavior contract.

## Goals / Non-Goals

**Goals:**

- Preserve one global record per carrier-provisioned E.164 number.
- Store tenant assignment separately so tenant deletion can remove assignments without deleting carrier inventory.
- Keep organization reads behind resolved-organization membership and owner/admin role checks.

**Non-Goals:**

- Managing carrier provisioning or purchases.
- Choosing a number for a campaign or call.

## Decisions

- Use a global inventory table keyed by a canonical E.164 value, plus a separate assignment relation with a unique inventory-number key. This enforces at most one organization assignment while keeping the number record independent of tenant lifetime; embedding `organization_id` on the global record would couple inventory retention to a tenant.
- Cascade organization deletion to assignment rows, while inventory rows have no tenant foreign key and remain for platform staff to manage.
- Expose separate platform operations for inventory and assignment management, and a tenant-scoped read that joins assignments to enabled inventory. Reusing a general platform listing for organization reads could reveal unassigned or disabled numbers.
- Use existing platform-admin authorization for global mutations and the existing organization membership resolution for owner/admin reads; do not trust a caller-supplied organization ID without resolving it against the session.

## Risks / Trade-offs

- [An inventory number can be disabled while assigned] → Keep the assignment and filter it out of organization eligibility; platform staff can re-enable or unassign it.
- [Historical inventory needs are unknown] → Do not add hard deletion; disabled records remain available for platform review.

## Migration Plan

Create the global inventory and organization assignment tables, then deploy the platform management and tenant read paths. No existing DID rows require migration. Rollback removes the new APIs and tables; the feature has no call-path dependency in this change.
