# Tasks

## 1. Campaign model and API

- [x] 1.1 Add tenant-scoped campaign storage, resource mappings, assignment, and revision. Apply the migration after the lead list, disposition list, and DID changes and verify existing organizations have no campaigns until created.
- [x] 1.2 Add owner/admin list, detail, create, edit, activate, pause, and archive procedures. Test incomplete drafts, agent denial, cross-organization references, archive visibility, and stale revisions.
- [x] 1.3 Validate state transitions, live resource readiness, fixed/random DIDs, eligible statuses, and timer and retry inputs. Test activation with a valid team and rejection for an empty team, archived list, disabled DID, or missing retry interval.

## 2. Console workflow

- [x] 2.1 Add campaign list and editor with current lead, disposition, DID, and roster choices. Verify creating a partial draft and saving independent preview, customer-ring, wrap-up, and after-call durations.
- [x] 2.2 Display validation errors and lifecycle actions. Verify an admin can activate, pause, edit, reactivate, and archive, with disabled or retired choices identified on the next activation check.
