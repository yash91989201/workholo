# authentication Specification

## Purpose

Defines how users authenticate, what a session carries, and which surface each authenticated user may enter. One authentication backend is shared by every frontend deployment.

## Requirements

### Requirement: Email and password accounts

The system SHALL allow users to register and sign in with an email address and password. Accounts are global across organizations and surfaces, and an email address MUST map to exactly one account.

#### Scenario: Registration creates an account and session

- **WHEN** a visitor registers with an unused email and valid password
- **THEN** the system creates one user record and returns an authenticated session

#### Scenario: Duplicate email is rejected

- **WHEN** a visitor registers with an email that already has an account
- **THEN** the system rejects the registration and creates no account

#### Scenario: Wrong password is rejected

- **WHEN** a user signs in with a valid email and an incorrect password
- **THEN** the system rejects the sign-in without disclosing whether the email exists

### Requirement: Platform role

Every user SHALL have exactly one global role, `platform_admin` or `user`, defaulting to `user`. The platform role MUST NOT be granted by self-service registration, organization invitation, or membership change.

#### Scenario: New accounts receive the default role

- **WHEN** a user registers through the console
- **THEN** the resulting account has the `user` role

#### Scenario: Platform role is provisioned out of band

- **WHEN** platform staff need a new platform administrator
- **THEN** the role is assigned by an administrative provisioning step, not through any public endpoint

#### Scenario: Organization invitation cannot grant platform role

- **WHEN** an organization invitation is created or accepted
- **THEN** the invited account's global role is unchanged

### Requirement: Sessions

Authenticated requests SHALL be identified by a session bound to one user. Sign-out and expiry MUST invalidate further authenticated requests. A valid session MUST NOT by itself grant access to any organization's data.

#### Scenario: Sign-out invalidates the session

- **WHEN** a signed-in user signs out
- **THEN** subsequent requests using the previous session are rejected as unauthenticated

#### Scenario: Expired session is rejected

- **WHEN** a request arrives with an expired session
- **THEN** the system treats the request as unauthenticated

#### Scenario: Session alone grants no tenant access

- **WHEN** an authenticated user with no membership calls an organization-scoped procedure
- **THEN** the system rejects the request regardless of the session's active organization field

### Requirement: Surface access

Each frontend SHALL restrict entry by role and membership: the platform surface requires `platform_admin`; the console requires an `owner` or `admin` membership; the agent panel requires an `agent` membership. Server procedures MUST enforce the same authorization, because surface checks alone are not a security boundary.

#### Scenario: Owner is blocked from the agent panel

- **WHEN** a user whose membership role is `owner` opens the agent surface
- **THEN** the surface denies entry and the agent procedures reject the same principal

#### Scenario: Agent is blocked from the console

- **WHEN** a user whose membership role is `agent` opens the console
- **THEN** the surface denies entry and console-only procedures reject the same principal

#### Scenario: Platform admin without membership is blocked from the console

- **WHEN** a `platform_admin` with no organization membership opens the console
- **THEN** the console shows the not-an-org-user state and org procedures reject the request

#### Scenario: Direct API calls are authorized independently of the surface

- **WHEN** a client calls a console-only procedure without an owner or admin membership
- **THEN** the server rejects the request even if the call did not originate from the agent surface
