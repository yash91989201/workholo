# Tasks

## 1. Tenant-scoped suppression data and API

- [ ] 1.1 Add the tenant-owned do-not-dial table with a unique organization and canonical E.164 key; verify migration constraints and organization cascade deletion.
- [ ] 1.2 Add canonical E.164 validation and owner/admin add, list, and remove procedures; verify invalid values and agent or cross-organization requests are rejected and duplicates remain single rows.
- [ ] 1.3 Add an organization-membership-scoped boolean lookup; verify present, absent, and same-number-in-another-organization cases return only the requested organization's result.
- [ ] 1.4 Add API tests for validation, role checks, tenant isolation, duplicate handling, and deletion; verify the relevant API test suite passes.

## 2. Organization console

- [ ] 2.1 Add an owner/admin do-not-dial management view with add, list, and remove actions; verify it operates only on the active organization and shows validation errors.
- [ ] 2.2 Run relevant console checks and verify suppression management does not add campaign UI or change dial behavior.
