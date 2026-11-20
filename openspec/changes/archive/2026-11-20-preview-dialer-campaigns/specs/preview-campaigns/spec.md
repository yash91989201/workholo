# Spec Delta

## Purpose

Lets organization owners and admins configure preview campaigns from reusable tenant resources and validate their readiness before agents use them.

## ADDED Requirements

### Requirement: Manage tenant preview campaigns
Organization owners and admins SHALL list, read, create, update, activate, pause, and archive their own campaigns. Creation SHALL require a name and the Preview dial method. A draft SHALL allow incomplete settings. Archived campaigns SHALL remain readable to authorized admins and SHALL be unavailable for dialing.

#### Scenario: Save an incomplete draft
- **WHEN** an admin saves a named Preview campaign without any lead lists
- **THEN** it appears in the organization's campaign list as a draft

#### Scenario: Reject unauthorized campaign management
- **WHEN** an agent tries to change campaign settings or an admin tries to edit a campaign from another organization
- **THEN** the request is rejected and changes no data

#### Scenario: Retain archived campaign history
- **WHEN** an admin archives a paused campaign
- **THEN** it is readable as archived and cannot be activated again

### Requirement: Validate activation resources
Activation SHALL require at least one usable lead list, one usable disposition list, a valid caller ID selection, and exactly one current agent or team with at least one agent. Every referenced resource SHALL be valid for the resolved organization. The server SHALL refuse activation with field-specific errors when requirements are unmet.

#### Scenario: Active campaign from existing resources
- **WHEN** an admin activates a complete draft assigned to an eligible team
- **THEN** the campaign is active and references the team's current agent roster

#### Scenario: Reject invalid selection without partial activation
- **WHEN** a selected list was archived, a team has no agents, or a selected DID belongs to another organization
- **THEN** activation is refused and the campaign keeps its previous state

#### Scenario: Reactivation checks resource changes
- **WHEN** a paused campaign is reactivated after a selected DID was disabled
- **THEN** activation is refused until the caller ID configuration is repaired

### Requirement: Configure caller ID policy
Campaigns SHALL support fixed caller ID with one outbound-enabled DID or random caller ID with a nonempty pool of distinct outbound-enabled DIDs. Every DID SHALL be assigned to the campaign's organization.

#### Scenario: Reject invalid DID policy
- **WHEN** an admin supplies two DIDs in fixed mode, duplicate DIDs in random mode, or a DID that is not enabled for the organization
- **THEN** the configuration is rejected

### Requirement: Configure preview and ring timers
Activation SHALL require a positive whole-second Preview Duration and a whole-second Ring Timeout from 1 through 120. Preview Duration controls lead review. Ring Timeout limits ringing on the customer's leg after the agent answers. The agent leg uses an independent timeout.

#### Scenario: Save independent durations
- **WHEN** an admin sets 20 seconds of preview and 35 seconds of Ring Timeout
- **THEN** the settings retain a 20-second lead-review interval and a 35-second customer ring limit independently

### Requirement: Configure wrap-up and retry policies
Activation SHALL require nonnegative whole seconds for wrap-up and after-call work, a nonnegative retry count, and at least one eligible dial status. A positive retry count SHALL require a positive whole-minute retry interval. The initial selectable dial statuses SHALL include New and Not Answered.

#### Scenario: Disable retries and skip disposition
- **WHEN** an admin configures zero retries and zero wrap-up
- **THEN** the campaign can activate without a retry interval and its policy disables retry and the disposition prompt

#### Scenario: Reject incomplete retry configuration
- **WHEN** an admin tries to activate a campaign with two retries and no interval
- **THEN** activation reports that a positive retry interval is required

### Requirement: Protect active campaign settings
Admins SHALL pause an active campaign before altering its dial configuration or archiving it. Reactivation SHALL validate the latest settings and resource eligibility. Every activation and pause SHALL invalidate prior authorization to start a new attempt under an earlier active campaign revision.

#### Scenario: Pause and revise an active campaign
- **WHEN** an admin pauses the campaign, edits a dial setting, and reactivates it
- **THEN** the revised settings apply and prior preview authorizations are stale
