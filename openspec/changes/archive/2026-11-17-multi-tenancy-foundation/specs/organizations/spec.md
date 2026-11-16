# Spec Delta

## Purpose

Defines organization creation, the single-membership rule, the owner/admin/agent role model, and the invitation chain that adds people to an organization.

## ADDED Requirements

### Requirement: Organization creation

The system SHALL let an authenticated user with no existing membership create one organization and become its owner. Organization slugs MUST be unique. A user who already holds a membership MUST NOT create another organization.

#### Scenario: First-time owner creates an organization

- **WHEN** a registered user with no membership submits a valid name and unique slug
- **THEN** the system creates the organization and an `owner` membership for that user

#### Scenario: Second organization is rejected

- **WHEN** a user who already holds a membership attempts to create another organization
- **THEN** the system rejects the request and creates nothing

#### Scenario: Duplicate slug is rejected

- **WHEN** organization creation uses a slug that is already taken
- **THEN** the system rejects the request with a slug-conflict error

### Requirement: Single membership per user

A user MUST hold at most one organization membership at any time. Accepting an invitation when the user already belongs to an organization MUST be rejected.

#### Scenario: Invitation acceptance blocked for existing member

- **WHEN** a user who already belongs to an organization accepts an invitation to another
- **THEN** the system rejects the acceptance and leaves both organizations unchanged

#### Scenario: Existing member cannot be added directly

- **WHEN** any flow attempts to add a user who already has a membership to a second organization
- **THEN** the system rejects the addition

### Requirement: Owner authority

The owner SHALL control organization settings and billing, invite and remove administrators and agents, change member roles, and read organization call history and recordings. The owner MUST NOT use live call supervision features.

#### Scenario: Owner manages administrators

- **WHEN** the owner invites, removes, or changes the role of an administrator
- **THEN** the system applies the change

#### Scenario: Owner sees organization call history

- **WHEN** the owner requests call history or recordings for the organization
- **THEN** the system returns records belonging to that organization

#### Scenario: Owner cannot barge into a call

- **WHEN** the owner requests a live supervision action on an active call
- **THEN** the system rejects the action as forbidden

### Requirement: Administrator authority

An administrator SHALL manage agents, read organization call history and recordings, and use live supervision actions (monitor, whisper, barge) on calls belonging to the organization. An administrator MUST NOT change organization settings, billing, or the membership of other administrators.

#### Scenario: Administrator manages agents

- **WHEN** an administrator invites, removes, or changes the role of an agent
- **THEN** the system applies the change

#### Scenario: Administrator supervises a call in the same organization

- **WHEN** an administrator requests monitor, whisper, or barge for an active call in their organization
- **THEN** the system authorizes the action

#### Scenario: Administrator cannot supervise another organization's call

- **WHEN** an administrator requests a supervision action for a call outside their organization
- **THEN** the system rejects the action

#### Scenario: Administrator cannot manage another administrator

- **WHEN** an administrator attempts to invite, remove, or change the role of an administrator
- **THEN** the system rejects the action

#### Scenario: Administrator cannot change organization settings

- **WHEN** an administrator attempts to update organization settings or billing
- **THEN** the system rejects the action

### Requirement: Agent authority

An agent SHALL place and receive calls for their organization and read only their own calls and recordings. An agent MUST NOT manage members, read organization-wide history, or use supervision actions.

#### Scenario: Agent reads own calls

- **WHEN** an agent requests their own call records
- **THEN** the system returns only calls assigned to that agent

#### Scenario: Agent cannot read a colleague's calls

- **WHEN** an agent requests call records belonging to another agent
- **THEN** the system rejects or omits those records

#### Scenario: Agent cannot manage members

- **WHEN** an agent attempts to invite or remove any member
- **THEN** the system rejects the action

### Requirement: Invitation chain

The owner SHALL invite administrators and agents. An administrator SHALL invite agents only. Every invitation MUST name one role, target one organization, and be accepted only by a signed-in account whose email matches the invitation. Invitations MUST expire.

#### Scenario: Owner invites an administrator

- **WHEN** the owner invites an email with the `admin` role
- **THEN** the system creates an `admin` invitation and sends a console link

#### Scenario: Administrator invites an agent

- **WHEN** an administrator invites an email with the `agent` role
- **THEN** the system creates an `agent` invitation and sends an agent-panel link

#### Scenario: Administrator invites an administrator

- **WHEN** an administrator attempts to create an invitation with the `admin` role
- **THEN** the system rejects the invitation

#### Scenario: Owner role cannot be invited

- **WHEN** any member attempts to create an invitation with the `owner` role
- **THEN** the system rejects the invitation

#### Scenario: Email mismatch is rejected

- **WHEN** a signed-in user accepts an invitation addressed to a different email
- **THEN** the system rejects the acceptance

#### Scenario: Expired invitation is rejected

- **WHEN** an invitation past its expiry is accepted
- **THEN** the system rejects the acceptance

#### Scenario: Pending invitation is cancelled

- **WHEN** the owner or an administrator cancels a pending invitation in their organization
- **THEN** the invitation can no longer be accepted

### Requirement: Owner continuity

An organization MUST always retain one owner. The last owner MUST NOT be removed or demoted, and ownership MUST NOT be transferred to a non-member.

#### Scenario: Last owner cannot be demoted

- **WHEN** a role change would leave the organization without an owner
- **THEN** the system rejects the change

#### Scenario: Ownership transfer requires the target to be a member

- **WHEN** ownership is assigned to a user who is not a member of the organization
- **THEN** the system rejects the assignment
