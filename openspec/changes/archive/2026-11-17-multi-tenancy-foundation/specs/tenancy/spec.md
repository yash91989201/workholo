# Spec Delta

## Purpose

Defines the tenant boundary: which records belong to an organization, how every request resolves its organization, and what isolation and lifecycle guarantees apply.

## ADDED Requirements

### Requirement: Tenant key

Every tenant-owned record SHALL store the owning `organizationId` as a non-null reference to the organization. Deleting an organization MUST cascade to its members, invitations, and tenant-owned records.

#### Scenario: Tenant record always has an owner

- **WHEN** any tenant-owned record is created
- **THEN** it stores the organization that owns it

#### Scenario: Deleting an organization removes its data

- **WHEN** an organization is deleted
- **THEN** its memberships, invitations, and tenant-owned records are deleted with it

### Requirement: Request scoping

Every organization-scoped procedure SHALL resolve an explicit organization identifier for the request and MUST verify that the authenticated user holds a membership in that organization before touching data. A missing identifier MUST be rejected as a bad request and a non-member MUST be rejected as forbidden.

#### Scenario: Missing organization is a bad request

- **WHEN** an organization-scoped procedure is called without an organization identifier
- **THEN** the system rejects the request without querying tenant data

#### Scenario: Non-member is forbidden

- **WHEN** an authenticated user calls an organization-scoped procedure for an organization they do not belong to
- **THEN** the system rejects the request as forbidden

#### Scenario: Session state is not authoritative

- **WHEN** a request arrives with a session whose active organization differs from a verified membership
- **THEN** authorization follows the verified membership, not the session field

### Requirement: Cross-tenant isolation

Reads and writes SHALL be limited to the resolved organization. List operations MUST filter by the resolved organization, updates and deletes MUST match it, and created records MUST be stamped with the server-resolved organization rather than a client-supplied value.

#### Scenario: List returns only the resolved organization's records

- **WHEN** a member lists tenant-owned records
- **THEN** the response contains no record from another organization

#### Scenario: Cross-tenant update is rejected

- **WHEN** a member submits an update for a record owned by another organization
- **THEN** the system rejects or applies no change

#### Scenario: Client-supplied organization is not trusted

- **WHEN** a create request includes an organization identifier that does not match the verified membership
- **THEN** the system stamps the verified organization and rejects the mismatch

### Requirement: Suspended organization

When an organization is suspended, its members SHALL remain able to authenticate, but every organization-scoped procedure MUST be rejected until the organization is restored.

#### Scenario: Suspended organization blocks tenant operations

- **WHEN** a member of a suspended organization calls an organization-scoped procedure
- **THEN** the system rejects the request and reports the suspension

#### Scenario: Suspension does not block authentication

- **WHEN** a member of a suspended organization signs in
- **THEN** the system issues a session but tenant operations remain blocked

#### Scenario: Restore re-enables operations

- **WHEN** platform staff restore a suspended organization
- **THEN** organization-scoped procedures succeed again for its members
