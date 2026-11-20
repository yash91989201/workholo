# Design

## Context

The API already provides owner/admin console procedures and membership-resolved organization procedures. Tenant-owned database records reference the organization with cascade deletion. No phone-number parsing dependency or shared phone model currently exists. See proposal.md and specs/do-not-dial/spec.md for the behavior contract.

## Goals / Non-Goals

**Goals:**

- Store one canonical E.164 key per organization and provide organization-scoped management and boolean lookup.
- Use existing tenant authorization and deletion patterns.

**Non-Goals:**

- Campaign screens, dial/dispatch integration, exemptions, or compliance claims.
- Guessing a country code from a local number or organization settings.

## Decisions

- Store one tenant-owned row per number with a unique `(organization_id, e164_number)` constraint and cascade deletion. A single number may appear in different organizations' independent sets.
- Accept canonical E.164 input (`+` followed by country code and digits, at most 15 digits, with a non-zero first digit) and persist that same canonical form. Do not add a phone parsing dependency or infer regional formatting; this avoids changing a number based on unstated locale.
- Gate add, list, and remove with the existing owner/admin console procedure. Gate the boolean lookup with the existing organization membership procedure so a member can only check their resolved organization; return a boolean rather than exposing a cross-tenant list.
- Keep this lookup independent of any call path. A future dispatch change must explicitly consume it and define what happens when a check fails.

## Risks / Trade-offs

- [Users may provide locally formatted numbers] → Reject non-canonical or invalid input with a clear validation error rather than guessing a country code.
- [A future dispatch path may not use the lookup] → Keep the boundary explicit in the API and require dispatch integration in its own change.

## Migration Plan

Create the organization-owned table and deploy the management and lookup procedures. There is no existing suppression data to migrate. On application rollback, keep the table and its suppression entries. Once a dial path depends on the lookup, disable dispatch before reverting the lookup.
