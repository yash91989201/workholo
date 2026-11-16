# platform-administration Specification

## Purpose

Defines what platform staff can do across all organizations: inspect tenants, suspend or restore them, remove them, and temporarily act as a user for support, with auditability.

## Requirements

### Requirement: Platform-only access

Platform procedures SHALL be available only to accounts with the `platform_admin` role. Every other principal MUST be rejected, including organization owners and administrators.

#### Scenario: Owner cannot call platform procedures

- **WHEN** an organization owner calls a platform procedure
- **THEN** the system rejects the request as forbidden

#### Scenario: Platform admin can call platform procedures

- **WHEN** a `platform_admin` calls a platform procedure
- **THEN** the system authorizes the request

### Requirement: Cross-tenant organization listing

Platform staff SHALL list and inspect all organizations across tenants, including name, slug, status, member counts, and creation time. The listing MUST support searching and pagination.

#### Scenario: Platform staff list every organization

- **WHEN** platform staff request the organization listing
- **THEN** the response includes organizations regardless of which users belong to them

#### Scenario: Listing is searchable

- **WHEN** platform staff search by organization name or slug
- **THEN** the response contains only matching organizations

### Requirement: Organization suspension

Platform staff SHALL suspend an organization with a recorded actor, timestamp, and reason, and SHALL restore it. A suspended organization's tenant operations are rejected while authentication continues.

#### Scenario: Suspension records who and why

- **WHEN** platform staff suspend an organization with a reason
- **THEN** the organization status, acting administrator, and reason are stored

#### Scenario: Restoration clears the suspended state

- **WHEN** platform staff restore an organization
- **THEN** its members can use organization-scoped procedures again

### Requirement: Organization deletion

Platform staff SHALL delete an organization. Deletion MUST cascade to memberships, invitations, and tenant-owned records, and MUST be recorded in the audit trail.

#### Scenario: Deletion removes the tenant

- **WHEN** platform staff delete an organization
- **THEN** the organization and all records owned by it are removed

#### Scenario: Deletion is audited

- **WHEN** platform staff delete an organization
- **THEN** an audit record identifies the acting administrator, the organization, and the time

### Requirement: User impersonation

Platform staff SHALL impersonate a non-platform user to reproduce support issues. An impersonation session MUST be time-limited, MUST be attributed to the acting administrator, MUST be visibly marked in the UI, and MUST NOT permit impersonating another `platform_admin`.

#### Scenario: Impersonation starts a marked session

- **WHEN** platform staff impersonate an organization member
- **THEN** the resulting session acts as that user and is marked as impersonated

#### Scenario: Impersonation is attributed

- **WHEN** an impersonation session performs an action
- **THEN** the action can be attributed to the acting platform administrator

#### Scenario: Impersonating a platform admin is rejected

- **WHEN** platform staff attempt to impersonate another `platform_admin`
- **THEN** the system rejects the request

#### Scenario: Impersonation is time-limited

- **WHEN** an impersonation session exceeds its configured duration
- **THEN** it expires and the original platform session is restored

#### Scenario: Stopping impersonation restores the administrator

- **WHEN** platform staff stop impersonating
- **THEN** the session returns to the acting platform administrator

### Requirement: No platform call supervision

Platform staff MUST NOT monitor, whisper to, or barge into calls. Platform access to call data is read-only.

#### Scenario: Platform staff attempt live supervision

- **WHEN** a `platform_admin` requests a monitor, whisper, or barge action
- **THEN** the system rejects the action

### Requirement: Privileged action audit

Suspension, restoration, deletion, impersonation, and role assignments affecting platform staff SHALL emit an audit record containing actor, action, target, and timestamp.

#### Scenario: Audit record is written

- **WHEN** a privileged platform action completes
- **THEN** an audit record with actor, action, target, and timestamp is emitted
