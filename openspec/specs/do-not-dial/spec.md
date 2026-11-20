# do-not-dial Specification

## Purpose

Provides each organization with a normalized number suppression set that authorized organization users can maintain and future dispatch systems can query within that same organization.

## Requirements

### Requirement: Organization manages its do-not-dial set

The system SHALL let an organization owner or administrator add, list, and remove E.164 numbers in that organization's do-not-dial set. Every operation MUST use the caller's resolved organization and MUST NOT expose another organization's entries.

#### Scenario: Owner adds a number
- **WHEN** an owner adds a valid E.164 number to their organization
- **THEN** the system stores its normalized form in that organization's set

#### Scenario: Administrator lists numbers
- **WHEN** an administrator lists the do-not-dial set for their resolved organization
- **THEN** the system returns only that organization's normalized numbers

#### Scenario: Owner removes a number
- **WHEN** an owner removes a number from their organization's set
- **THEN** that number is no longer present in the set

#### Scenario: Agent cannot manage the set
- **WHEN** an agent attempts to add, list, or remove do-not-dial entries
- **THEN** the system rejects the request

#### Scenario: Organization deletion removes its entries
- **WHEN** an organization is deleted
- **THEN** its do-not-dial entries are removed

### Requirement: Do-not-dial numbers use one canonical form

The system SHALL store valid E.164 numbers in canonical form as a plus sign followed by country code and digits, and MUST NOT create duplicate entries for the same canonical number within one organization.

#### Scenario: Repeated number does not create a duplicate
- **WHEN** an owner or administrator adds a canonical number already in that organization's set
- **THEN** the system keeps one canonical entry and creates no duplicate

#### Scenario: Invalid E.164 input is rejected
- **WHEN** an owner or administrator adds a value that is not a valid E.164 number
- **THEN** the system rejects it without changing the set

### Requirement: Authorized callers can check suppression by organization

The system SHALL provide a lookup that reports whether a normalized E.164 number is in the specified organization's do-not-dial set. The lookup MUST return no suppression state from any other organization and MUST NOT itself place or block a call.

#### Scenario: Lookup finds a suppressed number
- **WHEN** an authorized caller checks a number present in the specified organization's set
- **THEN** the lookup reports it as suppressed

#### Scenario: Lookup does not find a number
- **WHEN** an authorized caller checks a valid number absent from the specified organization's set
- **THEN** the lookup reports it as not suppressed

#### Scenario: Lookup is scoped to one organization
- **WHEN** a caller checks a number in an organization where it is absent but it exists in another organization
- **THEN** the lookup reports it as not suppressed for the specified organization
