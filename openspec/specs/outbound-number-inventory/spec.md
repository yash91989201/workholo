# outbound-number-inventory Specification

## Purpose

Provides a platform-managed inventory of carrier-provisioned outbound numbers and safe organization assignment. Organizations can discover only numbers assigned to them that are enabled for outbound use.

## Requirements

### Requirement: Platform-managed DID inventory

The system SHALL let platform administrators register carrier-provisioned E.164 numbers in the global outbound inventory and enable or disable each number for outbound use. It MUST reject a duplicate number.

#### Scenario: Platform administrator registers a provisioned number

- **WHEN** a platform administrator registers a valid carrier-provisioned E.164 number that is not already in inventory
- **THEN** the system records it in the global inventory

#### Scenario: Duplicate number is rejected

- **WHEN** a platform administrator registers a number already in inventory
- **THEN** the system rejects the duplicate without creating another inventory record

#### Scenario: Platform administrator disables outbound use

- **WHEN** a platform administrator disables an inventory number
- **THEN** the number remains in inventory but is no longer eligible for outbound use

### Requirement: Organization assignment of inventory numbers

The system SHALL let platform administrators assign an inventory number to one organization at a time and unassign it. Assignment records MUST be scoped to their organization and MUST NOT transfer global inventory ownership to the organization.

#### Scenario: Platform administrator assigns a number

- **WHEN** a platform administrator assigns an unassigned inventory number to an existing organization
- **THEN** the system records the organization assignment

#### Scenario: Number cannot be assigned to two organizations

- **WHEN** a platform administrator assigns an inventory number already assigned to another organization
- **THEN** the system rejects the assignment and leaves the existing assignment unchanged

#### Scenario: Organization deletion removes its assignments

- **WHEN** an organization is deleted
- **THEN** its assignment records are removed and the global inventory numbers remain available for platform management

### Requirement: Organization reads eligible assigned numbers

The system SHALL let an organization owner or administrator read only that organization's numbers that are assigned and enabled for outbound use. It MUST NOT disclose unassigned, disabled, or other organizations' numbers through this read.

#### Scenario: Organization reads eligible numbers

- **WHEN** an owner or administrator reads outbound numbers for their resolved organization
- **THEN** the system returns only numbers assigned to that organization and enabled for outbound use

#### Scenario: Another organization's inventory is inaccessible

- **WHEN** a member requests eligible numbers for an organization they do not belong to
- **THEN** the system rejects the request or returns no data for that organization

#### Scenario: Non-administrator member cannot read inventory

- **WHEN** an agent requests the organization's outbound number inventory
- **THEN** the system rejects the request
