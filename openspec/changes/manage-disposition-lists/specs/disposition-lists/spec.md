# Spec Delta

## Purpose

Lets an organization maintain reusable, coded call outcomes for future campaign setup. Stable codes and retained retired entries keep later historical outcomes interpretable as lists evolve.

## ADDED Requirements

### Requirement: Disposition list management
Owners and administrators SHALL create and edit organization-owned disposition lists with a required name and optional description. Only owners and administrators MAY create, edit, or archive disposition lists.

#### Scenario: Administrator creates a list
- **WHEN** an administrator creates a disposition list in the resolved organization with a valid name
- **THEN** the list is saved with that organization as its owner

#### Scenario: Agent cannot manage lists
- **WHEN** an agent attempts to create, edit, or archive a disposition list
- **THEN** the request is rejected and no list changes

#### Scenario: List cannot be read across organizations
- **WHEN** a member requests a disposition list owned by another organization
- **THEN** the request is rejected and no list data is returned

### Requirement: Coded disposition entries
Each disposition entry SHALL have a stable uppercase snake-case code and a label unique within its list. Once created, its code and label MUST NOT be changed or reused; entries are retired instead of deleted.

#### Scenario: Add an entry
- **WHEN** an owner or administrator adds an entry with an unused code and label
- **THEN** the entry is stored in the selected list with its code and label unchanged

#### Scenario: Duplicate code or label is rejected
- **WHEN** an owner or administrator adds an entry with a code or label already used in the same list
- **THEN** the request is rejected and the existing entry remains unchanged

#### Scenario: Invalid code format is rejected
- **WHEN** an owner or administrator adds an entry whose code is not uppercase snake-case
- **THEN** the request is rejected and no entry is created

#### Scenario: Entry identity cannot be edited
- **WHEN** an owner or administrator attempts to change the code or label of an existing entry
- **THEN** the request is rejected and the original code and label remain available

### Requirement: Disposition retirement and history compatibility
Retiring an entry or archiving its list SHALL remove it from future setup options without deleting or changing its code or label. Historical references to a retired entry MUST remain resolvable to that entry and its original label.

#### Scenario: Retire an entry
- **WHEN** an owner or administrator retires an active entry
- **THEN** it is excluded from future setup options and its code and label remain resolvable

#### Scenario: Archive a list
- **WHEN** an owner or administrator archives a disposition list
- **THEN** the list and entries are excluded from future setup options while their identities and labels remain preserved

#### Scenario: Historical reference resolves after retirement
- **WHEN** historical data references an entry that has since been retired
- **THEN** the system resolves the reference to the same stable code and original label

### Requirement: Future setup options
The system SHALL provide active disposition lists and active entries to authorized console users preparing future campaigns, scoped to the resolved organization.

#### Scenario: Active options are listed
- **WHEN** an authorized console user requests disposition options for future campaign setup
- **THEN** the response includes only active lists and active entries from the resolved organization

#### Scenario: Retired options are omitted
- **WHEN** future setup options are requested after an entry or list is retired or archived
- **THEN** that entry or list is omitted from the response
