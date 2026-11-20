# Spec Delta

## Purpose

Lets an organization group its agents into teams so work can be assigned to a group rather than one person, while keeping every team inside its own organization.

## ADDED Requirements

### Requirement: Team management

An organization's owner and administrators SHALL create, rename, and delete teams. Agents MUST NOT create, rename, or delete teams. Deleting a team MUST remove its team memberships and MUST NOT change organization membership.

#### Scenario: Administrator creates a team

- **WHEN** an administrator submits a team name in their organization
- **THEN** the system creates the team in that organization

#### Scenario: Agent cannot create a team

- **WHEN** a member with the `agent` role attempts to create, rename, or delete a team
- **THEN** the system rejects the action

#### Scenario: Team deletion keeps organization members

- **WHEN** an administrator deletes a team that has members
- **THEN** the team and its team memberships are removed and each affected user keeps their organization membership

### Requirement: Agent team membership

Only members with the `agent` role SHALL be added to a team; adding any other role MUST be rejected. An agent MAY belong to several teams in the same organization, and a user MUST NOT appear twice in one team.

#### Scenario: Agent joins several teams

- **WHEN** an administrator adds the same agent to two teams
- **THEN** both memberships exist

#### Scenario: Non-agent is rejected

- **WHEN** an administrator adds an owner or administrator to a team
- **THEN** the system rejects the addition and creates no team membership

#### Scenario: Duplicate team membership is rejected

- **WHEN** an administrator adds an agent who already belongs to the team
- **THEN** the system leaves the existing membership unchanged and creates no duplicate

### Requirement: Team tenant isolation

Every team SHALL belong to exactly one organization. Team reads and writes MUST be limited to the resolved organization, and a team identifier from another organization MUST be rejected.

#### Scenario: Cross-organization team read is rejected

- **WHEN** a member requests a team or team roster owned by another organization
- **THEN** the system rejects the request

#### Scenario: Team list is scoped

- **WHEN** a member lists teams
- **THEN** the response contains only teams from the resolved organization
