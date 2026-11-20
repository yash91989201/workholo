# Tasks

## 1. Inventory and assignment persistence

- [x] 1.1 Add global carrier-provisioned E.164 inventory and one-to-one organization assignment persistence; verify migrations enforce unique inventory numbers and one organization assignment per number.
- [x] 1.2 Add platform-admin inventory registration, listing, and outbound enable/disable operations; verify duplicate registration and non-platform access are rejected.
- [x] 1.3 Add platform-admin assignment and unassignment operations; verify reassignment cannot overlap and organization deletion removes assignments while preserving inventory.
- [x] 1.4 Add the platform inventory view for number registration, status, and assignment controls; verify each action reflects the platform API result.

## 2. Organization console access

- [x] 2.1 Add the owner/admin organization-scoped eligible-number read; verify disabled, unassigned, and other-organization numbers are omitted and agents are rejected.
- [x] 2.2 Add the console view for eligible assigned numbers; verify it shows only the API's eligible rows and handles an empty inventory.
- [x] 2.3 Run the relevant API and console checks; verify the new flows work without campaign or call integration.
