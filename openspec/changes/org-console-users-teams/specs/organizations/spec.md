# Spec Delta

## MODIFIED Requirements

### Requirement: Invitation chain

The owner SHALL invite administrators and agents. An administrator SHALL invite agents only. Every invitation MUST name one role, target one organization, and be accepted only by a signed-in account whose email matches the invitation. Invitations MUST expire. An agent invitation MUST name a team; an administrator invitation MUST NOT name a team, and accepting an agent invitation MUST add the member to that team.

#### Scenario: Owner invites an administrator

- **WHEN** the owner invites an email with the `admin` role
- **THEN** the system creates an `admin` invitation without a team and sends a console link

#### Scenario: Administrator invites an agent

- **WHEN** an administrator invites an email with the `agent` role and names a team
- **THEN** the system creates an `agent` invitation for that team and sends an agent-panel link

#### Scenario: Administrator invites an administrator

- **WHEN** an administrator attempts to create an invitation with the `admin` role
- **THEN** the system rejects the invitation

#### Scenario: Owner role cannot be invited

- **WHEN** any member attempts to create an invitation with the `owner` role
- **THEN** the system rejects the invitation

#### Scenario: Agent invitation without a team is rejected

- **WHEN** an invitation names the `agent` role but no team
- **THEN** the system rejects the invitation and creates nothing

#### Scenario: Administrator invitation cannot name a team

- **WHEN** an invitation names the `admin` role together with a team
- **THEN** the system rejects the invitation and creates nothing

#### Scenario: Accepting an agent invitation joins the team

- **WHEN** an invited account accepts an `agent` invitation for a team
- **THEN** the system creates the membership and adds the member to that team

#### Scenario: Email mismatch is rejected

- **WHEN** a signed-in user accepts an invitation addressed to a different email
- **THEN** the system rejects the acceptance

#### Scenario: Expired invitation is rejected

- **WHEN** an invitation past its expiry is accepted
- **THEN** the system rejects the acceptance

#### Scenario: Pending invitation is cancelled

- **WHEN** the owner or an administrator cancels a pending invitation in their organization
- **THEN** the invitation can no longer be accepted

## ADDED Requirements

### Requirement: Member directory

Owners and administrators SHALL read the full member roster of their organization and its pending invitations. The roster MUST include every member regardless of role, and every read MUST be scoped to the resolved organization.

#### Scenario: Full roster is returned

- **WHEN** an owner or administrator reads the member roster
- **THEN** the response includes the owner, all administrators, and all agents of that organization

#### Scenario: Pending invitations are listed

- **WHEN** an owner or administrator reads pending invitations
- **THEN** each invitation reports its email, role, and named team for agent invitations

#### Scenario: Directory read from another organization is rejected

- **WHEN** a member requests the roster or pending invitations of an organization they do not belong to
- **THEN** the system rejects the request
